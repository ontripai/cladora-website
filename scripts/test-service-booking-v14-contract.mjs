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

const source = readFileSync(new URL('../src/lib/customer/service-booking-v14-schema.ts', import.meta.url), 'utf8');
const { serviceBookingIntentV1Schema: schema, evaluateServiceBooking: evaluate } = load(
  new URL('../src/lib/customer/service-booking-v14-schema.ts', import.meta.url));
const id = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const hold = { context_id: id(1), workspace_id: id(2), service_order_id: id(3), expected_order_version: 4,
  service_stage_id: id(5), expected_stage_version: 6, action: 'request_hold',
  requested_start: '2026-10-10T09:00:00+03:30', requested_end: '2026-10-10T10:00:00+03:30',
  requested_capacity: 2, resource_ids: [id(7), id(8)], idempotency_key: 'service-booking-hold-001' };
const confirm = { context_id: id(1), workspace_id: id(2), service_order_id: id(3), expected_order_version: 4,
  service_stage_id: id(5), expected_stage_version: 6, allocation_id: id(9), expected_allocation_version: 2,
  action: 'confirm_hold', idempotency_key: 'service-booking-confirm-001' };
const order = { id: id(3), workspace_id: id(2), version: 4, status: 'in_progress' };
const stage = { id: id(5), order_id: id(3), version: 6, status: 'ready', booking_required: true };
const allocation = { id: id(9), workspace_id: id(2), order_id: id(3), stage_id: id(5), version: 2,
  state: 'held', expires_at: '2026-10-09T13:00:00Z' };
const holdReceipt = { status: 'verified', action: 'request_hold', workspace_id: id(2), order_id: id(3), stage_id: id(5),
  allocation_id: null, allocation_version: null, requested_start: hold.requested_start, requested_end: hold.requested_end,
  requested_capacity: 2, resource_ids: [id(8), id(7)] };
const snapshot = { now: Date.parse('2026-10-09T12:00:00Z'), authority: 'allowed', order, stage,
  allocation: null, capacity_receipt: holdReceipt };

assert.equal(schema.safeParse(hold).success, true);
assert.equal(schema.safeParse(confirm).success, true);
assert.equal(schema.safeParse({ ...confirm, action: 'cancel', reason_code: 'CUSTOMER_REQUEST' }).success, true);
assert.equal(schema.safeParse({ ...hold, action: 'reschedule', allocation_id: id(9), expected_allocation_version: 2 }).success, true);
for (const field of ['actor_id', 'tenant_id', 'available_capacity', 'allocation_state', 'expires_at', 'capacity_receipt_id',
  'payment_status', 'audit_id', 'outbox_id']) assert.equal(schema.safeParse({ ...hold, [field]: 'client-claim' }).success, false, field);
assert.equal(schema.safeParse({ ...hold, requested_end: hold.requested_start }).success, false);
assert.equal(schema.safeParse({ ...hold, resource_ids: [id(7), id(7)] }).success, false);
assert.equal(schema.safeParse({ ...hold, requested_capacity: 0 }).success, false);
assert.equal(schema.safeParse({ ...confirm, action: 'cancel' }).success, false);

assert.equal(evaluate(hold, snapshot), 'OK');
assert.equal(evaluate(hold, { ...snapshot, authority: 'denied' }), 'AUTHORITY_DENIED');
assert.equal(evaluate(hold, { ...snapshot, order: null }), 'ORDER_UNAVAILABLE');
assert.equal(evaluate(hold, { ...snapshot, order: { ...order, workspace_id: id(99) } }), 'ORDER_UNAVAILABLE');
assert.equal(evaluate(hold, { ...snapshot, order: { ...order, version: 5 } }), 'STALE_ORDER');
assert.equal(evaluate(hold, { ...snapshot, stage: null }), 'STAGE_UNAVAILABLE');
assert.equal(evaluate(hold, { ...snapshot, stage: { ...stage, status: 'completed' } }), 'STAGE_UNAVAILABLE');
assert.equal(evaluate(hold, { ...snapshot, stage: { ...stage, version: 7 } }), 'STALE_STAGE');
assert.equal(evaluate(hold, { ...snapshot, stage: { ...stage, booking_required: false } }), 'BOOKING_NOT_REQUIRED');
assert.equal(evaluate(hold, { ...snapshot, allocation }), 'ACTION_NOT_ALLOWED');
assert.equal(evaluate(hold, { ...snapshot, capacity_receipt: null }), 'CAPACITY_DECISION_REQUIRED');
assert.equal(evaluate(hold, { ...snapshot, capacity_receipt: { ...holdReceipt, status: 'denied' } }), 'CAPACITY_DECISION_REQUIRED');
assert.equal(evaluate(hold, { ...snapshot, capacity_receipt: { ...holdReceipt, requested_capacity: 1 } }), 'CAPACITY_DECISION_MISMATCH');
assert.equal(evaluate(hold, { ...snapshot, capacity_receipt: { ...holdReceipt, resource_ids: [id(7)] } }), 'CAPACITY_DECISION_MISMATCH');

const confirmReceipt = { ...holdReceipt, action: 'confirm_hold', allocation_id: id(9), allocation_version: 2,
  requested_start: null, requested_end: null, requested_capacity: null, resource_ids: [] };
const confirmSnapshot = { ...snapshot, allocation, capacity_receipt: confirmReceipt };
assert.equal(evaluate(confirm, confirmSnapshot), 'OK');
assert.equal(evaluate(confirm, { ...confirmSnapshot, allocation: { ...allocation, version: 3 } }), 'STALE_ALLOCATION');
assert.equal(evaluate(confirm, { ...confirmSnapshot, allocation: { ...allocation, state: 'expired' } }), 'ACTION_NOT_ALLOWED');
assert.equal(evaluate(confirm, { ...confirmSnapshot, now: Date.parse(allocation.expires_at) }), 'ACTION_NOT_ALLOWED');
assert.equal(evaluate(confirm, { ...confirmSnapshot, capacity_receipt: { ...confirmReceipt, allocation_id: id(99) } }), 'CAPACITY_DECISION_MISMATCH');
const cancel = { ...confirm, action: 'cancel', reason_code: 'CUSTOMER_REQUEST' };
assert.equal(evaluate(cancel, { ...confirmSnapshot, capacity_receipt: { ...confirmReceipt, action: 'cancel' } }), 'OK');

assert.match(source, /not a capacity or authorization engine/i);
assert.match(source, /atomic allocation link, audit, outbox and idempotency writes/i);
console.log('SERVICE v1.4 booking contract: PASS');
