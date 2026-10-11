import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { receiptEnvelope } from './service-receipt-test-fixtures.mjs';

const require = createRequire(import.meta.url);
const cache = new Map();
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const source = readFileSync(file, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const loadedModule = { exports: {} };
  const localRequire = moduleId => moduleId.startsWith('.') ? load(new URL(`${moduleId}.ts`, file)) : require(moduleId);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, loadedModule, loadedModule.exports);
  cache.set(file.href, loadedModule.exports);
  return loadedModule.exports;
}

const source = readFileSync(new URL('../src/lib/customer/service-portfolio-v14-schema.ts', import.meta.url), 'utf8');
const { servicePortfolioQueryV1Schema: querySchema, servicePortfolioActionIntentV1Schema: actionSchema,
  evaluateServicePortfolioAction: evaluate } = load(new URL('../src/lib/customer/service-portfolio-v14-schema.ts', import.meta.url));
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const query = { context_id: id(1), workspace_id: id(2), portfolio_id: id(3), resource_id: id(4), limit: 25 };
const intent = { context_id: id(1), workspace_id: id(2), portfolio_id: id(3), service_order_id: id(5),
  expected_portfolio_version: 9, expected_order_version: 7, action: 'continue_delivery',
  idempotency_key: 'service-portfolio-action-001' };
const orderReference = { service_order_id: id(5), order_version: 7, resource_id: id(4),
  available_actions: ['view_order', 'continue_delivery'] };
const portfolioReceipt = receiptEnvelope({ contract: 'portfolio-service-action-projection-receipt.v1', intent,
  workspaceId: id(2), sourceKind: 'service_portfolio', sourceId: id(3), sourceVersion: 9,
  portfolio_id: id(3), current_actor_can_read: true, order_references: [orderReference] });
const snapshot = { authority: 'allowed', portfolio_receipt: portfolioReceipt,
  order: { id: id(5), workspace_id: id(2),
  version: 7, resource_id: id(4), status: 'in_progress', available_actions: ['view_order', 'continue_delivery'] } };

assert.equal(querySchema.safeParse(query).success, true);
assert.equal(actionSchema.safeParse(intent).success, true);
for (const field of ['actor_id', 'tenant_id', 'owner_id', 'party_id', 'ownership_share', 'portfolio_items',
  'order_status', 'resource_label', 'available_actions']) {
  assert.equal(querySchema.safeParse({ ...query, [field]: 'client-claim' }).success, false, field);
  assert.equal(actionSchema.safeParse({ ...intent, [field]: 'client-claim' }).success, false, field);
}
for (const limit of [0, 101, 1.5, '25']) assert.equal(querySchema.safeParse({ ...query, limit }).success, false);
assert.equal(actionSchema.safeParse({ ...intent, action: 'pay_invoice' }).success, false);

assert.equal(evaluate(intent, snapshot), 'OK');
assert.equal(evaluate(intent, { ...snapshot, authority: 'denied' }), 'AUTHORITY_DENIED');
assert.equal(evaluate(intent, { ...snapshot, portfolio_receipt: null }), 'PORTFOLIO_RECEIPT_REQUIRED');
assert.equal(evaluate(intent, { ...snapshot, portfolio_receipt: { ...snapshot.portfolio_receipt, status: 'revoked' } }), 'PORTFOLIO_RECEIPT_REQUIRED');
assert.equal(evaluate(intent, { ...snapshot, portfolio_receipt: { ...snapshot.portfolio_receipt, current_actor_can_read: false } }), 'PORTFOLIO_RECEIPT_REQUIRED');
for (const source_version of [0, -1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
  assert.equal(evaluate(intent, { ...snapshot, portfolio_receipt: { ...snapshot.portfolio_receipt,
    source_identity: { ...snapshot.portfolio_receipt.source_identity, version: source_version } } }),
    'PORTFOLIO_RECEIPT_REQUIRED', `source_version=${String(source_version)}`);
}
assert.equal(evaluate(intent, { ...snapshot, portfolio_receipt: { ...snapshot.portfolio_receipt, workspace_id: id(99) } }), 'PORTFOLIO_SCOPE_MISMATCH');
assert.equal(evaluate(intent, { ...snapshot, portfolio_receipt: { ...snapshot.portfolio_receipt,
  order_references: [] } }), 'ORDER_UNAVAILABLE');
assert.equal(evaluate(intent, { ...snapshot, portfolio_receipt: { ...snapshot.portfolio_receipt,
  order_references: [orderReference, orderReference] } }), 'PORTFOLIO_RECEIPT_REQUIRED');
assert.equal(evaluate(intent, { ...snapshot, portfolio_receipt: { ...snapshot.portfolio_receipt,
  order_references: [{ ...orderReference, order_version: 8 }] } }), 'STALE_ORDER');
assert.equal(evaluate(intent, { ...snapshot, portfolio_receipt: { ...snapshot.portfolio_receipt,
  order_references: [{ ...orderReference, resource_id: id(99) }] } }), 'ORDER_UNAVAILABLE');
assert.equal(evaluate(intent, { ...snapshot, portfolio_receipt: { ...snapshot.portfolio_receipt,
  order_references: [{ ...orderReference, available_actions: ['view_order'] }] } }), 'ACTION_UNAVAILABLE');
assert.equal(evaluate(intent, { ...snapshot, order: null }), 'ORDER_UNAVAILABLE');
assert.equal(evaluate(intent, { ...snapshot, order: { ...snapshot.order, workspace_id: id(99) } }), 'ORDER_UNAVAILABLE');
assert.equal(evaluate(intent, { ...snapshot, order: { ...snapshot.order, version: 8 } }), 'STALE_ORDER');
assert.equal(evaluate({ ...intent, action: 'manage_booking' }, snapshot), 'PORTFOLIO_RECEIPT_MISMATCH');
const otherOwnerDenial = evaluate({ ...intent, service_order_id: id(98) }, { ...snapshot,
  order: { ...snapshot.order, id: id(98), resource_id: id(99) } });
assert.equal(otherOwnerDenial, 'PORTFOLIO_RECEIPT_MISMATCH');
assert.deepEqual(Object.keys({ code: otherOwnerDenial }), ['code']);

assert.match(source, /without copying portfolio identity, ownership or/i);
assert.match(source, /recheck current authority/i);
console.log('SERVICE v1.4 portfolio projection contract: PASS');
