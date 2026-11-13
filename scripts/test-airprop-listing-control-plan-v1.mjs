// Offline domain mapping only. No SQL, Auth, C03, permission or receipt fixture.
import assert from 'node:assert/strict';
import { loader, id, scope } from './lib/airprop-listing-flow-test-fixture.mjs';
const { prepareListingControlV1, LISTING_CONTROL_NATIVE_SQL } = loader()('src/lib/airprop/listing-control-plan-v1.ts');
const input = (action = 'edit_listing') => ({ contract: 'airprop-listing-flow.v1', selection: {
  listing_id: id(10), listing_version: 4, property_id: id(8), unit_id: id(9), resource_id: id(9), resource_version: 3,
  resource_type: 'unit', party_id: id(7), party_kind: 'person', relationship_id: id(4), relationship_version: 2, relationship_kind: 'ownership',
}, command: { version: 1, ...scope, action, listing_id: id(10), expected_version: 4, reason: 'Original reason',
  ...(action === 'withdraw_listing' ? {} : { available_from: '2026-11-08T10:00:31.123456Z', available_until: null }),
  idempotency_key: 'original-listing-control-01' } });
let checks = 0;
const test = (name, run) => { run(); console.log('PASS', ++checks, name); };
for (const [action, native] of [['edit_listing', 'edit'], ['withdraw_listing', 'withdraw'], ['republish_listing', 'republish']]) {
  test(action + ': exact existing native call; same original selection, wire and key', () => {
    const body = input(action), wire = JSON.stringify(body, null, 2), plan = prepareListingControlV1(wire, scope);
    assert.equal(plan.wire, wire); assert.equal(plan.status, 'CURRENT_CORE_SOURCE_VALIDATION_REQUIRED');
    assert.deepEqual(plan.request.selection, body.selection);
    assert.equal(plan.native.sql, LISTING_CONTROL_NATIVE_SQL);
    assert.deepEqual(plan.native.values, [scope.context_id, scope.workspace_id, id(10), native, 4,
      body.command.available_from ?? null, body.command.available_until ?? null, body.command.reason, body.command.idempotency_key]);
    assert.ok(Object.isFrozen(plan.request.command) && Object.isFrozen(plan.request.selection) && Object.isFrozen(plan.native.values));
  });
}
test('foreign Context/Workspace and Property-as-Unit fail closed', () => {
  for (const key of ['context_id', 'workspace_id']) assert.throws(() => prepareListingControlV1(JSON.stringify(input()), { ...scope, [key]: id(99) }), /BINDING/);
  const body = input(); body.selection.resource_id = body.selection.property_id;
  assert.throws(() => prepareListingControlV1(JSON.stringify(body), scope), /BINDING/);
});
test('explicit tuple and version are required, never inferred from another row', () => {
  for (const key of ['party_id', 'relationship_id', 'relationship_version', 'resource_version', 'unit_id']) {
    const body = input(); delete body.selection[key]; assert.throws(() => prepareListingControlV1(JSON.stringify(body), scope));
  }
  const body = input(); body.command.expected_version = 5;
  assert.throws(() => prepareListingControlV1(JSON.stringify(body), scope));
});
test('exact retry is repeatable and never substitutes a new key/body/version', () => {
  const wire = JSON.stringify(input()), first = prepareListingControlV1(wire, scope), retry = prepareListingControlV1(wire, scope);
  assert.deepEqual(retry, first); assert.equal(retry.request.command.expected_version, 4);
  assert.equal(Object.hasOwn(retry, 'core_receipt_id'), false);
});
test('microsecond interval and invalid calendar rejected without native dispatch', () => {
  const body = input(); body.command.available_until = '2026-11-08T10:00:31.123457Z';
  assert.equal(prepareListingControlV1(JSON.stringify(body), scope).native.values[6], body.command.available_until);
  for (const start of ['2026-11-08T10:00:31.123457Z', '2026-02-30T10:00:31Z']) {
    body.command.available_from = start; assert.throws(() => prepareListingControlV1(JSON.stringify(body), scope));
  }
});
test('native integer limit and successor overflow fail before execution', () => {
  for (const version of [2147483647, 2147483648, Number.MAX_SAFE_INTEGER + 1]) {
    const body = input(); body.selection.listing_version = body.command.expected_version = version;
    assert.throws(() => prepareListingControlV1(JSON.stringify(body), scope));
  }
  const body = input(); body.selection.listing_version = body.command.expected_version = 2147483646;
  assert.equal(prepareListingControlV1(JSON.stringify(body), scope).native.values[4], 2147483646);
});
test('malformed/oversized and claimed authorization or withdraw dates rejected', () => {
  assert.throws(() => prepareListingControlV1('{', scope));
  assert.throws(() => prepareListingControlV1(' '.repeat(16385), scope), /TOO_LARGE/);
  for (const mutate of [b => { b.authority = true; }, b => { b.selection.allowed = true; },
    b => { b.command.available_from = '2026-11-08T10:00:00Z'; }]) {
    const body = input('withdraw_listing'); mutate(body); assert.throws(() => prepareListingControlV1(JSON.stringify(body), scope));
  }
});
console.log('PASS', checks, 'offline domain preparation groups; native authority/C03/DB NOT_RUN_NOT_PASS');
