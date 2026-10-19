import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const filename = fileURLToPath(new URL('../src/app/api/customer/v1/services/requests/execution/route.ts', import.meta.url));
let trustedOrigin = true;
let bodyValid = true;
let body = { contract_version: 'operations-execution-request-receipt.v1' };
let authenticated = true;
let result = { data: null, error: null };
const calls = [];

const accepted = {
  contract_version: 'operations-execution-request-receipt.v1',
  request_status: 'accepted',
};
const rejected = {
  contract_version: 'operations-execution-request-receipt.v1',
  request_status: 'rejected',
};
const requestSchema = {
  safeParse(value) {
    return bodyValid ? { success: true, data: value } : { success: false, error: {} };
  },
};
const receiptSchema = {
  safeParse(value) {
    return value === accepted || value === rejected
      ? { success: true, data: value }
      : { success: false, error: {} };
  },
};
const db = {
  auth: {
    getClaims: async () => authenticated
      ? { data: { claims: { sub: 'ops-user' } }, error: null }
      : { data: null, error: { code: 'NO_SESSION' } },
  },
  schema(name) {
    assert.equal(name, 'customer_api');
    return {
      rpc: async (rpc, args) => {
        calls.push({ rpc, args });
        return result;
      },
    };
  },
};
const NextResponse = {
  json(value, init = {}) {
    return new Response(JSON.stringify(value), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
    });
  },
};
const request = {
  headers: { get: name => name.toLowerCase() === 'content-type' ? 'application/json' : null },
  nextUrl: { search: '', origin: 'https://cladora.test' },
};

const routeModule = new Module(filename);
routeModule.filename = filename;
routeModule.paths = Module._nodeModulePaths(fileURLToPath(new URL('..', import.meta.url)));
routeModule.require = id => {
  if (id === 'next/server') return { NextResponse };
  if (id === '@/lib/core/operations-execution-receipt-v1') return {
    operationsExecutionRequestReceiptV1Schema: receiptSchema,
    serviceOperationsExecutionRequestV1Schema: requestSchema,
  };
  if (id === '@/lib/supabase/server') return { createClient: async () => db };
  if (id === '@/lib/security/same-origin') return { hasTrustedMutationOrigin: () => trustedOrigin };
  if (id === '@/lib/security/request-body') return {
    isApplicationJson: value => value === 'application/json',
    parseJsonWithLimit: async () => ({ data: body, errorResponse: null }),
  };
  return require(id);
};
routeModule._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, filename);
const { POST } = routeModule.exports;

trustedOrigin = false;
let response = await POST(request);
assert.equal(response.status, 403);
assert.equal(calls.length, 0, 'untrusted origin never reaches auth or RPC');

trustedOrigin = true;
bodyValid = false;
response = await POST(request);
assert.equal(response.status, 400);
assert.equal(calls.length, 0, 'invalid contract never reaches the RPC');

bodyValid = true;
authenticated = false;
response = await POST(request);
assert.equal(response.status, 401);
assert.equal(calls.length, 0, 'unauthenticated request never reaches the RPC');

authenticated = true;
result = { data: null, error: { code: '42501' } };
response = await POST(request);
assert.equal(response.status, 403);

result = { data: null, error: { code: '40001' } };
response = await POST(request);
assert.equal(response.status, 409);

result = { data: { contract_version: 'wrong' }, error: null };
response = await POST(request);
assert.equal(response.status, 502);

result = { data: accepted, error: null };
response = await POST(request);
assert.equal(response.status, 201);
assert.equal(response.headers.get('cache-control'), 'no-store, private');
assert.deepEqual(await response.json(), accepted);
assert.deepEqual(calls.at(-1), {
  rpc: 'request_service_execution_v1',
  args: { p_request: body },
});

result = { data: rejected, error: null };
response = await POST(request);
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), rejected);

console.log('  ✔ OPS01 API rejects bad origin/input/auth, maps conflicts, validates receipts and distinguishes accepted/rejected status.');
