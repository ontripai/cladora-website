// Pure owner-domain preparation, not authority, C03, SQL or a live picker.
import assert from 'node:assert/strict';
import { loader, id, scope } from './lib/airprop-listing-flow-test-fixture.mjs';
const { prepareListingPublicationV1, LISTING_PUBLICATION_NATIVE_SQL } = loader()('src/lib/airprop/listing-publication-v1.ts');
const input = () => ({ contract: 'airprop-listing-publication.v1', selection: {
  property_id: id(8), unit_id: id(9), resource_id: id(9), resource_version: 4, resource_type: 'unit',
  party_id: id(7), party_kind: 'person', relationship_id: id(4), relationship_version: 2, relationship_kind: 'ownership',
}, command: { version: 1, ...scope, action: 'publish_listing', opportunity_id: id(30), property_id: id(8), unit_id: id(9),
  kind: 'resale', available_from: '2026-11-08T10:00:31.123456+02:00', available_until: null, idempotency_key: 'listing-publication-original-01' } });
let checks = 0;
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : ''; 
const check = (name, fn) => { if (only && !name.includes(only)) return; fn(); console.log('PASS', ++checks, name); };
check('existing native publish call, full selected source and original wire/timestamp/key', () => {
  const body = input(), wire = JSON.stringify(body, null, 2), plan = prepareListingPublicationV1(wire, scope);
  assert.equal(plan.wire, wire); assert.equal(plan.status, 'CURRENT_CORE_SOURCE_VALIDATION_REQUIRED');
  assert.deepEqual(plan.native.values, [scope.context_id, scope.workspace_id, id(30), id(8), id(9), 'resale', body.command.available_from, null, body.command.idempotency_key]);
  assert.equal(plan.native.sql, LISTING_PUBLICATION_NATIVE_SQL); assert.ok(Object.isFrozen(plan.native.values) && Object.isFrozen(plan.request.selection));
});
for (const kind of ['presale', 'lease']) check('native ' + kind + ' intent has no valuation/Finance prerequisite', () => {
  const body = input(); body.command.kind = kind; assert.equal(prepareListingPublicationV1(JSON.stringify(body), scope).native.values[5], kind);
});
for (const key of ['context_id', 'workspace_id']) check('foreign routing scope ' + key, () => {
  assert.throws(() => prepareListingPublicationV1(JSON.stringify(input()), { ...scope, [key]: id(99) }), /BINDING/);
});
for (const key of ['property_id', 'unit_id', 'resource_id']) check('no implicit resource fallback ' + key, () => {
  const body = input(); body.selection[key] = id(99); assert.throws(() => prepareListingPublicationV1(JSON.stringify(body), scope), /BINDING/);
});
check('missing canonical version, wrong resource kind, claimed actor/allow and other action rejected', () => {
  for (const mutate of [b => delete b.selection.resource_version, b => { b.selection.resource_type = 'property'; },
    b => { b.actor_id = id(99); }, b => { b.selection.allowed = true; }, b => { b.command.action = 'submit_applicant'; }]) {
    const body = input(); mutate(body); assert.throws(() => prepareListingPublicationV1(JSON.stringify(body), scope));
  }
});
check('invalid date interval, malformed JSON and oversized wire rejected', () => {
  const body = input(); body.command.available_until = '2026-11-07T09:00:00Z';
  assert.throws(() => prepareListingPublicationV1(JSON.stringify(body), scope));
  assert.throws(() => prepareListingPublicationV1('{bad', scope)); assert.throws(() => prepareListingPublicationV1(' '.repeat(16385), scope), /TOO_LARGE/);
});
check('microsecond interval uses existing precise parser without rewriting wire', () => {
  const body = input(); body.command.available_until = '2026-11-08T10:00:31.123457+02:00';
  const wire = JSON.stringify(body), plan = prepareListingPublicationV1(wire, scope);
  assert.equal(plan.wire, wire); assert.equal(plan.native.values[7], body.command.available_until);
  body.command.available_until = body.command.available_from; assert.throws(() => prepareListingPublicationV1(JSON.stringify(body), scope), /INTERVAL/);
});
console.log('Domain-only checks:', checks, '; current authority/native execution NOT_RUN_NOT_PASS');
