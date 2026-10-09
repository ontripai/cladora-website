import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url); const cache = new Map();
function load(file) { if (cache.has(file.href)) return cache.get(file.href); const result = ts.transpileModule(readFileSync(file, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }); const mod = { exports: {} };
  const localRequire = moduleId => moduleId.startsWith('.') ? load(new URL(`${moduleId}.ts`, file)) : require(moduleId);
  new Function('require', 'module', 'exports', result.outputText)(localRequire, mod, mod.exports); cache.set(file.href, mod.exports); return mod.exports; }
const sourceText = readFileSync(new URL('../src/lib/customer/service-experience-v14-schema.ts', import.meta.url), 'utf8');
const { serviceExperienceIntentV1Schema: schema, evaluateServiceExperienceIntent: evaluate } = load(
  new URL('../src/lib/customer/service-experience-v14-schema.ts', import.meta.url));
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const intent = { context_id: id(1), workspace_id: id(2), service_order_id: id(3), expected_order_version: 4,
  action: 'acknowledge_component_status', component_id: id(5), expected_component_version: 6,
  status_reference_id: id(7), idempotency_key: 'service-experience-001' };
const snapshot = { authority: 'allowed', order: { id: id(3), workspace_id: id(2), version: 4, status: 'in_progress' },
  subject: { id: id(5), version: 6, workspace_id: id(2), order_id: id(3), kind: 'component', state: 'available' },
  coordination_receipt: { status: 'verified', action: 'acknowledge_component_status', workspace_id: id(2), order_id: id(3),
    order_version: 4, subject_id: id(5), subject_version: 6 } };
assert.equal(schema.safeParse(intent).success, true);
const base = { context_id: id(1), workspace_id: id(2), service_order_id: id(3), expected_order_version: 4,
  idempotency_key: 'service-experience-action-001' };
assert.equal(schema.safeParse({ ...base, action: 'request_cancellation', reason_code: 'CUSTOMER_REQUEST' }).success, true);
assert.equal(schema.safeParse({ ...base, action: 'request_compensation', component_id: id(5), expected_component_version: 6,
  reason_code: 'SERVICE_FAILURE' }).success, true);
assert.equal(schema.safeParse({ ...base, action: 'accept_compensation', compensation_reference_id: id(8),
  expected_compensation_version: 2 }).success, true);
for (const field of ['actor_id', 'tenant_id', 'experience_state', 'cancellation_state', 'compensation_amount',
  'benefit_id', 'payment_id', 'refund_id', 'ledger_entry_id', 'notification_status']) {
  assert.equal(schema.safeParse({ ...intent, [field]: 'client-claim' }).success, false, field);
}
assert.equal(evaluate(intent, snapshot), 'OK');
assert.equal(evaluate(intent, { ...snapshot, authority: 'denied' }), 'AUTHORITY_DENIED');
assert.equal(evaluate(intent, { ...snapshot, order: null }), 'ORDER_UNAVAILABLE');
assert.equal(evaluate(intent, { ...snapshot, order: { ...snapshot.order, version: 5 } }), 'STALE_ORDER');
assert.equal(evaluate(intent, { ...snapshot, subject: null }), 'SUBJECT_UNAVAILABLE');
assert.equal(evaluate(intent, { ...snapshot, subject: { ...snapshot.subject, state: 'revoked' } }), 'SUBJECT_UNAVAILABLE');
assert.equal(evaluate(intent, { ...snapshot, subject: { ...snapshot.subject, version: 7 } }), 'STALE_SUBJECT');
assert.equal(evaluate(intent, { ...snapshot, coordination_receipt: null }), 'COORDINATION_RECEIPT_REQUIRED');
assert.equal(evaluate(intent, { ...snapshot, coordination_receipt: { ...snapshot.coordination_receipt, status: 'denied' } }), 'COORDINATION_RECEIPT_REQUIRED');
assert.equal(evaluate(intent, { ...snapshot, coordination_receipt: { ...snapshot.coordination_receipt, subject_id: id(99) } }), 'COORDINATION_RECEIPT_MISMATCH');
const cancellation = { ...base, action: 'request_cancellation', reason_code: 'CUSTOMER_REQUEST' };
assert.equal(evaluate(cancellation, { ...snapshot, subject: null, coordination_receipt: { ...snapshot.coordination_receipt,
  action: 'request_cancellation', subject_id: null, subject_version: null } }), 'OK');
assert.match(sourceText, /SERVICE retains canonical Order/i);
assert.match(sourceText, /does not implement a second experience/i);
console.log('SERVICE v1.4 experience coordination contract: PASS');
