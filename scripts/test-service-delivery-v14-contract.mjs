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
  const localRequire = moduleId => moduleId.startsWith('.') ? load(new URL(`${moduleId}.ts`, file)) : require(moduleId);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, loadedModule, loadedModule.exports);
  cache.set(file.href, loadedModule.exports);
  return loadedModule.exports;
}

const source = readFileSync(new URL('../src/lib/customer/service-delivery-v14-schema.ts', import.meta.url), 'utf8');
const { serviceDeliveryIntentV1Schema: schema, evaluateServiceDelivery: evaluate } = load(
  new URL('../src/lib/customer/service-delivery-v14-schema.ts', import.meta.url));
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const delivery = { context_id: id(1), workspace_id: id(2), service_order_id: id(3), expected_order_version: 4,
  service_stage_id: id(5), expected_stage_version: 6, quantity: '2.250', action: 'record_delivery',
  evidence_reference_ids: [id(7)], idempotency_key: 'service-delivery-001' };
const decision = { context_id: id(1), workspace_id: id(2), service_order_id: id(3), expected_order_version: 4,
  service_stage_id: id(5), expected_stage_version: 6, quantity: '1.25', action: 'accept_delivery',
  idempotency_key: 'service-delivery-accept-001' };
const snapshot = { authority: 'allowed', order: { id: id(3), workspace_id: id(2), version: 4, status: 'in_progress' },
  stage: { id: id(5), order_id: id(3), version: 6, status: 'in_progress', committed_quantity: '10',
    delivered_quantity: '7.5', accepted_quantity: '3', rejected_quantity: '1', current_actor_can_deliver: true,
    current_actor_can_accept: true }, evidence: [{ id: id(7), workspace_id: id(2), state: 'available', current_actor_can_read: true }] };

assert.equal(schema.safeParse(delivery).success, true);
assert.equal(schema.safeParse(decision).success, true);
assert.equal(schema.safeParse({ ...decision, action: 'reject_delivery', reason_code: 'OUT_OF_SCOPE' }).success, true);
assert.equal(schema.safeParse({ ...decision, action: 'request_rework', reason_code: 'INCOMPLETE' }).success, true);
for (const field of ['actor_id', 'tenant_id', 'provider_party_id', 'acceptor_party_id', 'order_status', 'stage_status',
  'work_order_id', 'financial_receipt_id', 'delivered_quantity', 'accepted_quantity', 'audit_id', 'outbox_id']) {
  assert.equal(schema.safeParse({ ...delivery, [field]: 'client-claim' }).success, false, field);
}
for (const quantity of ['-1', '01', '1.1234567', '1e2', 2]) {
  assert.equal(schema.safeParse({ ...delivery, quantity }).success, false, String(quantity));
}
assert.equal(schema.safeParse({ ...delivery, quantity: '0' }).success, true);
assert.equal(schema.safeParse({ ...decision, action: 'record_delivery' }).success, false);
assert.equal(schema.safeParse({ ...decision, action: 'reject_delivery' }).success, false);
assert.equal(schema.safeParse({ ...decision, action: 'accept_delivery', reason_code: 'forged' }).success, false);

assert.equal(evaluate(delivery, snapshot), 'OK');
assert.equal(evaluate({ ...delivery, quantity: '0' }, snapshot), 'QUANTITY_EXCEEDED');
assert.equal(evaluate(delivery, { ...snapshot, authority: 'denied' }), 'AUTHORITY_DENIED');
assert.equal(evaluate(delivery, { ...snapshot, order: null }), 'ORDER_UNAVAILABLE');
assert.equal(evaluate(delivery, { ...snapshot, order: { ...snapshot.order, workspace_id: id(99) } }), 'ORDER_UNAVAILABLE');
assert.equal(evaluate(delivery, { ...snapshot, order: { ...snapshot.order, status: 'cancelled' } }), 'ORDER_UNAVAILABLE');
assert.equal(evaluate(delivery, { ...snapshot, order: { ...snapshot.order, version: 5 } }), 'STALE_ORDER');
assert.equal(evaluate(delivery, { ...snapshot, stage: null }), 'STAGE_UNAVAILABLE');
assert.equal(evaluate(delivery, { ...snapshot, stage: { ...snapshot.stage, order_id: id(99) } }), 'STAGE_UNAVAILABLE');
assert.equal(evaluate(delivery, { ...snapshot, stage: { ...snapshot.stage, version: 7 } }), 'STALE_STAGE');
assert.equal(evaluate(delivery, { ...snapshot, stage: { ...snapshot.stage, current_actor_can_deliver: false } }), 'ACTION_NOT_ALLOWED');
assert.equal(evaluate(delivery, { ...snapshot, stage: { ...snapshot.stage, status: 'completed' } }), 'ACTION_NOT_ALLOWED');
assert.equal(evaluate({ ...delivery, quantity: '2.500001' }, snapshot), 'QUANTITY_EXCEEDED');
assert.equal(evaluate(delivery, { ...snapshot, evidence: [] }), 'EVIDENCE_UNAVAILABLE');
assert.equal(evaluate(delivery, { ...snapshot, evidence: [{ ...snapshot.evidence[0], workspace_id: id(99) }] }), 'EVIDENCE_UNAVAILABLE');
assert.equal(evaluate(delivery, { ...snapshot, evidence: [{ ...snapshot.evidence[0], state: 'quarantined' }] }), 'EVIDENCE_UNAVAILABLE');
assert.equal(evaluate(delivery, { ...snapshot, evidence: [{ ...snapshot.evidence[0], current_actor_can_read: false }] }), 'EVIDENCE_UNAVAILABLE');
assert.equal(evaluate({ ...delivery, evidence_reference_ids: [id(7), id(7)] }, snapshot), 'EVIDENCE_UNAVAILABLE');

const review = { ...snapshot, stage: { ...snapshot.stage, status: 'awaiting_acceptance' } };
assert.equal(evaluate(decision, review), 'OK');
assert.equal(evaluate(decision, { ...review, stage: { ...review.stage, current_actor_can_accept: false } }), 'ACTION_NOT_ALLOWED');
assert.equal(evaluate({ ...decision, quantity: '3.500001' }, review), 'QUANTITY_EXCEEDED');
assert.equal(evaluate({ ...decision, action: 'reject_delivery', reason_code: 'OUT_OF_SCOPE' }, review), 'OK');
assert.equal(evaluate({ ...decision, action: 'request_rework', reason_code: 'INCOMPLETE' }, review), 'OK');

assert.match(source, /not an authorization boundary|must lock and re-read/i);
assert.match(source, /audit, outbox and idempotency receipts/i);
console.log('SERVICE v1.4 delivery contract: PASS');
