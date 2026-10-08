import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const source = readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const loadedModule = { exports: {} };
  const localRequire = id => id.startsWith('.') ? load(new URL(`${id}.ts`, file))
    : id.startsWith('@/') ? load(new URL(`../src/${id.slice(2)}.ts`, import.meta.url)) : require(id);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, loadedModule, loadedModule.exports);
  cache.set(file.href, loadedModule.exports);
  return loadedModule.exports;
}

const { acceptServiceQuoteV14Schema: schema, evaluateServiceQuoteAcceptance: evaluate } = load(
  new URL('../src/lib/customer/service-order-acceptance-v14-schema.ts', import.meta.url),
);
const id = n => `${String(n).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const command = {
  context_id: id(1), workspace_id: id(2), quote_id: id(3), expected_quote_version: 4,
  idempotency_key: 'service-order-acceptance-v14-001',
};
assert.equal(schema.safeParse(command).success, true);
for (const field of Object.keys(command)) assert.equal(schema.safeParse({ ...command, [field]: undefined }).success, false);
for (const field of ['context_id', 'workspace_id', 'quote_id']) {
  for (const value of [null, 'bad']) assert.equal(schema.safeParse({ ...command, [field]: value }).success, false);
}
for (const expected_quote_version of [null, 0, -1, 1.2, 1_000_000_001, '4']) {
  assert.equal(schema.safeParse({ ...command, expected_quote_version }).success, false);
}
for (const field of [
  'actor_id', 'tenant_id', 'request_id', 'provider_party_id', 'beneficiary_party_id', 'status',
  'total_minor', 'currency', 'tax_minor', 'payer_shares', 'payment_id', 'finance_status',
  'accepted_at', 'order_id', 'work_order_id',
]) assert.equal(schema.safeParse({ ...command, [field]: 'client-claim' }).success, false);

const snapshot = {
  now: Date.parse('2026-10-08T12:00:00Z'), authorityEffective: true,
  workspaceId: id(2), quoteId: id(3), quoteVersion: 4, quoteState: 'presented',
  quoteValidUntil: '2026-10-09T12:00:00Z', requestState: 'submitted',
  providerActive: true, beneficiaryActive: true, financeContractStatus: 'verified',
};
assert.equal(evaluate(command, snapshot), 'OK');
assert.equal(evaluate(command, { ...snapshot, authorityEffective: false }), 'AUTHORITY_DENIED');
assert.equal(evaluate(command, { ...snapshot, workspaceId: id(99) }), 'REFERENCE_UNAVAILABLE');
assert.equal(evaluate(command, { ...snapshot, quoteId: id(99) }), 'REFERENCE_UNAVAILABLE');
assert.equal(evaluate(command, { ...snapshot, quoteVersion: 5 }), 'STALE_QUOTE');
for (const quoteState of ['draft', 'superseded', 'expired', 'accepted']) {
  assert.equal(evaluate(command, { ...snapshot, quoteState }), 'QUOTE_UNAVAILABLE');
}
for (const now of [NaN, Infinity, Date.parse(snapshot.quoteValidUntil), Date.parse(snapshot.quoteValidUntil) + 1]) {
  assert.equal(evaluate(command, { ...snapshot, now }), 'QUOTE_UNAVAILABLE');
}
assert.equal(evaluate(command, { ...snapshot, quoteValidUntil: 'bad' }), 'QUOTE_UNAVAILABLE');
for (const requestState of ['cancelled', 'completed']) {
  assert.equal(evaluate(command, { ...snapshot, requestState }), 'REQUEST_UNAVAILABLE');
}
assert.equal(evaluate(command, { ...snapshot, providerActive: false }), 'PARTY_UNAVAILABLE');
assert.equal(evaluate(command, { ...snapshot, beneficiaryActive: false }), 'PARTY_UNAVAILABLE');
for (const financeContractStatus of ['missing', 'stale', 'rejected']) {
  assert.equal(evaluate(command, { ...snapshot, financeContractStatus }), 'FINANCE_CONTRACT_REQUIRED');
}

console.log('PASS V14 SERVICE 02 order acceptance contract: strict intent, exact quote version and bounded Core/Finance prerequisites');
