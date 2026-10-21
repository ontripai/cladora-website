import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const mod = new Module(filename);
  mod.require = name => Object.hasOwn(mocks, name) ? mocks[name] : require(name);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, esModuleInterop: true, target: ts.ScriptTarget.ES2022,
  } }).outputText, filename);
  return mod.exports;
}
const { NextRequest } = require('next/server');
const origin = 'http://127.0.0.1:41957';
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const body = { context_id: id(1), unit_id: id(2), amount: 10, currency: 'RON', payment_method: 'bank_transfer',
  selected_invoices: [{ invoice_id: id(3), amount: 10 }], idempotency_key: `direct-${id(4)}` };
let rpcCalls = [], rpcResult, authError = null;
const rpcMock = { '@/lib/supabase/server': { createClient: async () => ({ auth: {
  getClaims: async () => ({ data: { claims: { sub: id(5) } }, error: authError }),
}, schema: name => { assert.equal(name, 'customer_api'); return { rpc: async (name, args) => { rpcCalls.push({ name, args }); return rpcResult; } }; } }) } };
const security = {
  '@/lib/security/same-origin': load('src/lib/security/same-origin.ts'),
  '@/lib/security/request-body': load('src/lib/security/request-body.ts'),
};
const bank = load('src/lib/payments/bank-instruction.ts');
const post = load('src/app/api/customer/v1/payments/intents/route.ts', { ...rpcMock, ...security,
  '@/lib/payments/provider-adapter': { getPaymentProviderAdapter: () => { throw new Error('card provider forbidden in bank proof'); } },
  '@/lib/payments/bank-instruction': bank });
const get = load('src/app/api/customer/v1/payments/intents/[id]/route.ts', { ...rpcMock, ...security });
const instruction = load('src/app/api/customer/v1/payments/intents/[id]/bank-instruction/route.ts', { ...rpcMock,
  '@/lib/payments/bank-instruction': bank });
const req = (payload = body, trusted = true) => new NextRequest(`${origin}/api/customer/v1/payments/intents`, {
  method: 'POST', headers: { host: new URL(origin).host, 'content-type': 'application/json', origin: trusted ? origin : 'https://untrusted.invalid' }, body: JSON.stringify(payload),
});
let scenarios = 0;
rpcResult = { data: { payment_intent_id: id(6), status: 'created' }, error: null };
let r = await post.POST(req()); assert.equal(r.status, 201); assert.equal(rpcCalls[0].name, 'create_payment_intent_v1');
assert.equal(rpcCalls[0].args.p_idempotency_key, body.idempotency_key); assert.deepEqual(rpcCalls[0].args.p_invoices, body.selected_invoices);
assert.match(r.headers.get('cache-control'), /no-store/); scenarios++;
rpcCalls = []; r = await post.POST(req(body, false)); assert.equal(r.status, 403); assert.equal(rpcCalls.length, 0); scenarios++;
rpcCalls = []; r = await post.POST(req({ ...body, unit_id: undefined })); assert.equal(r.status, 400); assert.equal(rpcCalls.length, 0); scenarios++;
for (const [code, message, expectedStatus, expectedCode] of [
  ['42501', 'customer_context_access_denied', 403, 'PAYMENT_CONTEXT_UNAVAILABLE'],
  ['42501', 'payment_allocation_policy_unconfigured', 409, 'PAYMENT_SETUP_REQUIRED'],
  ['23505', 'payment_idempotency_conflict', 400, 'INVALID_INTENT_REQUEST'],
]) {
  rpcResult = { data: null, error: { code, message } }; r = await post.POST(req());
  assert.equal(r.status, expectedStatus); assert.equal((await r.json()).error.code, expectedCode); scenarios++;
}
rpcResult = { data: { payment_intent_id: id(6), status: 'created' }, error: null };
r = await get.GET(new NextRequest(`${origin}/api/customer/v1/payments/intents/${id(6)}?context_id=${id(1)}`), { params: Promise.resolve({ id: id(6) }) });
assert.equal(r.status, 200); assert.equal(rpcCalls.at(-1).name, 'get_payment_intent_v1'); scenarios++;
rpcResult = { data: { beneficiary_name: 'Synthetic', iban: 'RO49****0000', amount: 10, currency: 'RON' }, error: null };
r = await instruction.GET(new NextRequest(`${origin}/api/customer/v1/payments/intents/${id(6)}/bank-instruction?context_id=${id(1)}`), { params: Promise.resolve({ id: id(6) }) });
assert.equal(r.status, 409); assert.equal((await r.json()).error.code, 'PAYMENT_DESTINATION_UNAVAILABLE'); scenarios++;
authError = { message: 'unavailable' }; rpcCalls = []; r = await post.POST(req()); assert.equal(r.status, 401); assert.equal(rpcCalls.length, 0); scenarios++;

const { createDirectPaymentAttemptsV1 } = load('src/lib/payments/direct-payment-attempt-v1.ts');
const tuple = { actor_id: id(5), context_id: id(1), workspace_id: id(7), unit_id: id(2), invoice_id: id(3), amount: 10, currency: 'RON' };
let posts = 0, observedPayload;
const unknown = createDirectPaymentAttemptsV1();
const fail = async (_url, init) => { posts++; observedPayload = init.body; throw new Error('synthetic unknown POST'); };
const first = unknown.run(tuple, fail); const second = unknown.run(tuple, fail);
assert.equal(first, second); assert.equal((await first).state, 'unknown'); assert.equal(posts, 1);
assert.equal((await unknown.run(tuple, fail)).state, 'unknown'); assert.equal(posts, 1);
assert.equal(JSON.parse(observedPayload).idempotency_key.startsWith('direct-'), true);
assert.equal((await unknown.run({ ...tuple, amount: 11 }, fail)).state, 'unknown');
assert.equal((await unknown.run({ ...tuple, workspace_id: id(8) }, fail)).state, 'unknown');
assert.equal(posts, 1, 'changed selection cannot mint a new attempt for an unresolved invoice'); scenarios++;
const missing = createDirectPaymentAttemptsV1(); assert.equal((await missing.run({ ...tuple, unit_id: '00000000-0000-0000-0000-000000000000' }, fail)).state, 'unavailable'); assert.equal(posts, 1); scenarios++;
// Known-ID retry and binding denials: UI helper transport contract, not SQL evidence.
for (const change of [{ unit_id: id(9) }, { currency: 'EUR' }, { amount: 12 }, { payment_method: 'card' },
  { selected_invoices: [] }, { expires_at: 'invalid' }, { expires_at: new Date(0).toISOString() }, { status: 'expired' }]) {
  const attempts = createDirectPaymentAttemptsV1(); let count = 0;
  const transport = async (_url, init) => {
    if (init.method === 'POST') { count++; return new Response(JSON.stringify({ payment_intent_id: id(6) }), { status: 201 }); }
    return new Response(JSON.stringify({ payment_intent_id: id(6), unit_id: tuple.unit_id, amount: tuple.amount, currency: tuple.currency,
      payment_method: 'bank_transfer', expires_at: new Date(Date.now() + 60000).toISOString(), status: 'created',
      selected_invoices: [{ invoice_id: tuple.invoice_id }], ...change }));
  };
  assert.notEqual((await attempts.run(tuple, transport)).state, 'instruction_ready');
  assert.notEqual((await attempts.run(tuple, transport)).state, 'instruction_ready'); assert.equal(count, 1); scenarios++;
}
console.log(JSON.stringify({ suite: 'CORE-MOBILE-PAYMENT-ATTEMPT-01-handler-contract', result: 'PASS', scenarios,
  provenance: 'actual route handlers and NextRequest; mocked Supabase Auth/RPC, NOT connected PostgreSQL proof',
  connected_security_and_idempotency: 'NOT_RUN_NOT_PASS' }));
