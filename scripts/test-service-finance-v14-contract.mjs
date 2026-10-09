import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const result = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const loadedModule = { exports: {} };
  const localRequire = moduleId => moduleId.startsWith('.') ? load(new URL(`${moduleId}.ts`, file)) : require(moduleId);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, loadedModule, loadedModule.exports);
  cache.set(file.href, loadedModule.exports); return loadedModule.exports;
}
const sourceText = readFileSync(new URL('../src/lib/customer/service-finance-v14-schema.ts', import.meta.url), 'utf8');
const { serviceFinanceIntentV1Schema: schema, evaluateServiceFinanceIntent: evaluate } = load(
  new URL('../src/lib/customer/service-finance-v14-schema.ts', import.meta.url));
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const invoice = { context_id: id(1), workspace_id: id(2), service_order_id: id(3), expected_order_version: 4,
  action: 'request_invoice', delivery_acceptance_id: id(5), expected_delivery_version: 6,
  idempotency_key: 'service-finance-invoice-001' };
const snapshot = { authority: 'allowed', order: { id: id(3), workspace_id: id(2), version: 4, status: 'in_progress' },
  source: { id: id(5), version: 6, workspace_id: id(2), order_id: id(3), kind: 'delivery_acceptance', state: 'eligible' },
  finance_receipt: { status: 'verified', action: 'request_invoice', workspace_id: id(2), order_id: id(3),
    order_version: 4, source_id: id(5), source_version: 6 } };

assert.equal(schema.safeParse(invoice).success, true);
const base = { context_id: id(1), workspace_id: id(2), service_order_id: id(3), expected_order_version: 4,
  idempotency_key: 'service-finance-action-001' };
assert.equal(schema.safeParse({ ...base, action: 'apply_payment', payment_reference_id: id(7), expected_payment_version: 2 }).success, true);
assert.equal(schema.safeParse({ ...base, action: 'request_refund', payment_reference_id: id(7), expected_payment_version: 2,
  reason_code: 'SERVICE_CANCELLED' }).success, true);
assert.equal(schema.safeParse({ ...base, action: 'request_provider_settlement', settlement_source_id: id(8),
  expected_settlement_source_version: 3 }).success, true);
for (const field of ['actor_id', 'tenant_id', 'amount_minor', 'currency', 'tax_minor', 'payer_shares', 'invoice_id',
  'refund_amount', 'provider_amount', 'ledger_entry_id', 'posting_state', 'settled_at']) {
  assert.equal(schema.safeParse({ ...invoice, [field]: 'client-claim' }).success, false, field);
}
assert.equal(schema.safeParse({ ...invoice, action: 'request_refund' }).success, false);

assert.equal(evaluate(invoice, snapshot), 'OK');
assert.equal(evaluate(invoice, { ...snapshot, authority: 'denied' }), 'AUTHORITY_DENIED');
assert.equal(evaluate(invoice, { ...snapshot, order: null }), 'ORDER_UNAVAILABLE');
assert.equal(evaluate(invoice, { ...snapshot, order: { ...snapshot.order, status: 'cancelled' } }), 'ORDER_UNAVAILABLE');
assert.equal(evaluate(invoice, { ...snapshot, order: { ...snapshot.order, version: 5 } }), 'STALE_ORDER');
assert.equal(evaluate(invoice, { ...snapshot, source: null }), 'SOURCE_UNAVAILABLE');
assert.equal(evaluate(invoice, { ...snapshot, source: { ...snapshot.source, kind: 'payment' } }), 'SOURCE_UNAVAILABLE');
assert.equal(evaluate(invoice, { ...snapshot, source: { ...snapshot.source, state: 'reversed' } }), 'SOURCE_UNAVAILABLE');
assert.equal(evaluate(invoice, { ...snapshot, source: { ...snapshot.source, version: 7 } }), 'STALE_SOURCE');
assert.equal(evaluate(invoice, { ...snapshot, finance_receipt: null }), 'FINANCE_RECEIPT_REQUIRED');
assert.equal(evaluate(invoice, { ...snapshot, finance_receipt: { ...snapshot.finance_receipt, status: 'denied' } }), 'FINANCE_RECEIPT_REQUIRED');
assert.equal(evaluate(invoice, { ...snapshot, finance_receipt: { ...snapshot.finance_receipt, source_version: 7 } }), 'FINANCE_RECEIPT_MISMATCH');
assert.match(sourceText, /without computing money, tax, invoice state/i);
console.log('SERVICE v1.4 finance contract: PASS');
