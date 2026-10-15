import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);

function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const compiled = new Module(filename);
  compiled.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  compiled._compile(ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText, filename);
  return compiled.exports;
}

const verifier = load("src/lib/payments/webhook-verifier.ts", { "server-only": {} });
let adminCalls = 0;
let rpcCalls = [];
let rpcResult = { data: { status: "processed" }, error: null };
const route = load("src/app/api/customer/v1/payments/webhook/route.ts", {
  "@/lib/payments/webhook-verifier": verifier,
  "@/lib/supabase/admin": {
    createAdminClient() {
      adminCalls += 1;
      return {
        async rpc(name, args) {
          rpcCalls.push({ name, args });
          return rpcResult;
        },
      };
    },
  },
});
const { NextRequest } = require("next/server");

const provider = "synthetic_provider";
const secret = "synthetic-test-secret-with-at-least-32-bytes";
const now = () => Math.floor(Date.now() / 1000).toString();
const basePayload = {
  event_id: "evt_synthetic_00000001",
  event_type: "payment.succeeded",
  payment_intent_id: "00000000-0000-4000-8000-000000000001",
};

function sign(timestamp, rawBody, signingSecret = secret) {
  return crypto.createHmac("sha256", signingSecret).update(`${timestamp}.${rawBody}`).digest("hex");
}

function request(payload = basePayload, options = {}) {
  const rawBody = typeof payload === "string" ? payload : JSON.stringify(payload);
  const timestamp = options.timestamp === undefined ? now() : options.timestamp;
  const signature = options.signature === undefined ? sign(timestamp, rawBody) : options.signature;
  const headers = {
    "content-type": "application/json",
    "x-payment-provider": options.provider ?? provider,
    ...(options.includeTimestamp === false ? {} : { "x-webhook-timestamp": timestamp }),
    ...(options.includeSignature === false ? {} : { "x-webhook-signature": signature }),
  };
  return new NextRequest("https://cladora.test/api/customer/v1/payments/webhook", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

function configure() {
  process.env.PAYMENT_WEBHOOK_PROVIDER_ALLOWLIST = provider;
  process.env.PAYMENT_WEBHOOK_SECRET_SYNTHETIC_PROVIDER = secret;
  delete process.env.PAYMENT_WEBHOOK_SECRET;
}

function resetCalls() {
  adminCalls = 0;
  rpcCalls = [];
  rpcResult = { data: { status: "processed" }, error: null };
}

async function expectDenial(name, input, status, code) {
  resetCalls();
  const response = await route.POST(input);
  assert.equal(response.status, status, name);
  assert.deepEqual(await response.json(), { error: { code } }, name);
  assert.equal(adminCalls, 0, `${name}: admin client must not be constructed`);
  assert.equal(rpcCalls.length, 0, `${name}: RPC must not be called`);
  console.log(`PASS ${name}`);
}

const previousEnvironment = {
  allowlist: process.env.PAYMENT_WEBHOOK_PROVIDER_ALLOWLIST,
  exactSecret: process.env.PAYMENT_WEBHOOK_SECRET_SYNTHETIC_PROVIDER,
  genericSecret: process.env.PAYMENT_WEBHOOK_SECRET,
  unknownSecret: process.env.PAYMENT_WEBHOOK_SECRET_UNKNOWN_PROVIDER,
};

try {
  configure();

  delete process.env.PAYMENT_WEBHOOK_SECRET_SYNTHETIC_PROVIDER;
  process.env.PAYMENT_WEBHOOK_SECRET = secret;
  await expectDenial(
    "missing exact provider secret rejects generic fallback",
    request(),
    503,
    "WEBHOOK_UNAVAILABLE",
  );

  configure();
  process.env.PAYMENT_WEBHOOK_SECRET_UNKNOWN_PROVIDER = secret;
  await expectDenial(
    "unknown provider is rejected even when a matching environment key exists",
    request(basePayload, { provider: "unknown_provider" }),
    503,
    "WEBHOOK_UNAVAILABLE",
  );
  await expectDenial(
    "malformed provider code is rejected before body processing",
    request(basePayload, { provider: "../synthetic_provider" }),
    503,
    "WEBHOOK_UNAVAILABLE",
  );
  await expectDenial(
    "missing signature fails closed",
    request(basePayload, { includeSignature: false }),
    401,
    "WEBHOOK_UNAUTHORIZED",
  );
  await expectDenial(
    "missing timestamp fails closed",
    request(basePayload, { includeTimestamp: false }),
    401,
    "WEBHOOK_UNAUTHORIZED",
  );
  await expectDenial(
    "invalid signature fails closed",
    request(basePayload, { signature: "00".repeat(32) }),
    401,
    "WEBHOOK_UNAUTHORIZED",
  );
  await expectDenial(
    "raw-body-only signature cannot bypass timestamp binding",
    request(basePayload, {
      signature: crypto.createHmac("sha256", secret).update(JSON.stringify(basePayload)).digest("hex"),
    }),
    401,
    "WEBHOOK_UNAUTHORIZED",
  );
  await expectDenial(
    "invalid timestamp fails closed",
    request(basePayload, { timestamp: "not-a-time", signature: "00".repeat(32) }),
    401,
    "WEBHOOK_UNAUTHORIZED",
  );
  const expiredTimestamp = (Math.floor(Date.now() / 1000) - 301).toString();
  const expiredBody = JSON.stringify(basePayload);
  await expectDenial(
    "expired timestamp fails closed",
    request(expiredBody, { timestamp: expiredTimestamp, signature: sign(expiredTimestamp, expiredBody) }),
    401,
    "WEBHOOK_UNAUTHORIZED",
  );
  const futureTimestamp = (Math.floor(Date.now() / 1000) + 301).toString();
  await expectDenial(
    "future timestamp outside the replay window fails closed",
    request(expiredBody, { timestamp: futureTimestamp, signature: sign(futureTimestamp, expiredBody) }),
    401,
    "WEBHOOK_UNAUTHORIZED",
  );
  await expectDenial(
    "valid signature with malformed JSON returns bounded 400",
    request("{"),
    400,
    "INVALID_WEBHOOK_PAYLOAD",
  );
  await expectDenial(
    "missing event ID fails closed",
    request({ event_type: "payment.succeeded" }),
    400,
    "INVALID_WEBHOOK_PAYLOAD",
  );
  await expectDenial(
    "unstable event ID fails closed",
    request({ ...basePayload, event_id: "short" }),
    400,
    "INVALID_WEBHOOK_PAYLOAD",
  );
  await expectDenial(
    "conflicting event identities fail closed",
    request({ ...basePayload, id: "evt_synthetic_00000002" }),
    400,
    "INVALID_WEBHOOK_PAYLOAD",
  );

  resetCalls();
  const injectedPayload = {
    ...basePayload,
    provider_code: "unknown_provider",
    webhook_secret: "attacker-controlled",
  };
  const success = await route.POST(request(injectedPayload));
  assert.equal(success.status, 200);
  assert.equal(adminCalls, 1);
  assert.equal(rpcCalls.length, 1);
  assert.equal(rpcCalls[0].name, "process_webhook_event_v1");
  assert.equal(rpcCalls[0].args.p_provider_code, provider);
  assert.equal(rpcCalls[0].args.p_provider_event_id, basePayload.event_id);
  assert.equal(rpcCalls[0].args.p_event_type, basePayload.event_type);
  assert.equal(rpcCalls[0].args.p_payload.provider_code, "unknown_provider");
  console.log("PASS configured synthetic provider uses exact HMAC and server allowlist");

  resetCalls();
  rpcResult = { data: { status: "ignored", reason: "duplicate_event" }, error: null };
  const duplicate = await route.POST(request());
  assert.equal(duplicate.status, 200);
  assert.deepEqual(await duplicate.json(), { status: "ignored", reason: "duplicate_event" });
  assert.equal(adminCalls, 1);
  assert.equal(rpcCalls.length, 1);
  console.log("PASS duplicate event preserves database idempotent response");

  resetCalls();
  rpcResult = { data: null, error: { code: "XX000", message: "private database detail" } };
  const failed = await route.POST(request());
  assert.equal(failed.status, 500);
  const failedBody = await failed.json();
  assert.deepEqual(failedBody, { error: { code: "WEBHOOK_PROCESSING_FAILED" } });
  assert.doesNotMatch(JSON.stringify(failedBody), /private database detail/);
  console.log("PASS database error details are not disclosed");

  console.log("17 payment webhook fail-closed checks passed");
} finally {
  const restore = (name, value) => {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  };
  restore("PAYMENT_WEBHOOK_PROVIDER_ALLOWLIST", previousEnvironment.allowlist);
  restore("PAYMENT_WEBHOOK_SECRET_SYNTHETIC_PROVIDER", previousEnvironment.exactSecret);
  restore("PAYMENT_WEBHOOK_SECRET", previousEnvironment.genericSecret);
  restore("PAYMENT_WEBHOOK_SECRET_UNKNOWN_PROVIDER", previousEnvironment.unknownSecret);
}
