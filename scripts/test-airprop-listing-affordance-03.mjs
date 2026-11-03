// Targeted synthetic transport only. No native Auth/DB/installed projection is claimed.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixture, scope, id, actionProjection } from './lib/airprop-listing-flow-test-fixture.mjs';
const require = createRequire(import.meta.url);
const lock = JSON.parse(require('node:fs').readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
for (const name of ['next', 'zod', 'react', 'typescript']) {
  assert.equal(require(name + '/package.json').version, lock.packages['node_modules/' + name].version, 'EXACT_LOCK_REQUIRED: ' + name);
}
const { NextRequest } = require('next/server');
const get = () => new NextRequest('https://cladora.test/api/customer/v2/airprop/listings?' + new URLSearchParams(scope));
const post = value => new NextRequest('https://cladora.test/api/customer/v2/airprop/listings', { method: 'POST', headers: { Origin: 'https://cladora.test', 'Content-Type': 'application/json' }, body: JSON.stringify(value) });
let count = 0;
const check = async (name, fn) => { await fn(); console.log('PASS', ++count, name); };
await check('review witness: old bridge+AAL2 expression true, current read200/manage denied actions false/POST403/writes0', async () => {
  const f = fixture(); f.state.manage = false;
  assert.equal(f.control !== null && f.state.aal === 'aal2', true);
  const response = await f.api.GET(get()), view = await response.json();
  assert.equal(response.status, 200); assert.equal(view.version, 2); assert.equal(view.can_edit, false);
  for (const action of f.contract.listingActions) assert.equal(view.listings[0].actions[action], 'denied');
  assert.equal((await f.api.POST(post(await f.command()))).status, 403); assert.equal(f.state.writes, 0);
});
await check('missing projection preserves read; not_evaluated cannot enable actions', async () => {
  const f = fixture(); f.state.row.action_projections = [];
  const view = await (await f.api.GET(get())).json(); assert.equal(view.can_edit, false);
  assert.deepEqual(view.listings[0].actions, f.contract.unavailableListingActions());
});
await check('malformed action projection cannot deny independently authorized read', async () => {
  const f = fixture(); f.state.row.action_projections = { action_authorization: 'not_evaluated' };
  const response = await f.api.GET(get()); assert.equal(response.status, 200);
  assert.equal((await response.json()).can_edit, false); assert.equal(f.state.writes, 0);
});
await check('read denied with management available withholds all rows', async () => {
  const f = fixture(); f.state.readDenied = true;
  assert.equal((await f.api.GET(get())).status, 403); assert.equal((await f.api.POST(post({}))).status, 400); assert.equal(f.state.writes, 0);
});
await check('AAL1 masks action affordances and denies bridge dispatch', async () => {
  const f = fixture(); f.state.aal = 'aal1';
  assert.equal((await (await f.api.GET(get())).json()).can_edit, false);
  assert.equal((await f.api.POST(post(await f.command()))).status, 403); assert.equal(f.state.bridgeCalls, 0);
});
for (const field of ['actor_id', 'context_id', 'workspace_id', 'listing_id', 'listing_version', 'property_id', 'unit_id', 'resource_id', 'resource_version', 'party_id', 'relationship_id', 'relationship_version']) await check('projection exact binding ' + field, async () => {
  const f = fixture(), command = await f.command();
  const projection = actionProjection(f.state.row, f.state.actor, command.selection, 'edit_listing');
  if (Object.hasOwn(projection, field)) projection[field] = id(900);
  else projection.selection[field] = typeof projection.selection[field] === 'number' ? 99 : id(900);
  f.state.row.action_projections = [projection];
  assert.equal((await (await f.api.GET(get())).json()).can_edit, false); assert.equal(f.state.writes, 0);
});
for (const change of ['purpose', 'time', 'duplicate', 'read_permission', 'core_resource', 'core_party']) await check('canonical evidence rejects ' + change, async () => {
  const f = fixture(), command = await f.command();
  const projection = actionProjection(f.state.row, f.state.actor, command.selection, 'edit_listing');
  if (change === 'purpose') projection.core.request.resource.purpose = 'airprop.portfolio.read';
  if (change === 'time') projection.core.request.evaluation_time = '2026-11-02T08:00:00Z';
  if (change === 'read_permission') projection.core.request.resource.permission_code = 'airprop.asset.read';
  if (change === 'core_resource') projection.core.companion.canonical_reference.resource_version++;
  if (change === 'core_party') projection.core.companion.relationship.party_id = id(900);
  f.state.row.action_projections = change === 'duplicate' ? [projection, structuredClone(projection)] : [projection];
  const response = await f.api.GET(get()); assert.equal(response.status, 200);
  assert.equal((await response.json()).can_edit, false); assert.equal(f.state.writes, 0);
});
await check('mixed rows and actions do not inherit another row permission', async () => {
  const f = fixture(), command = await f.command(), other = structuredClone(f.state.row);
  other.listing_id = id(31); other.action_projections = [];
  f.state.row.action_projections = [actionProjection(f.state.row, f.state.actor, command.selection, 'withdraw_listing')];
  const api = f.createListingFlowApi({ session: f.session, read: async (...args) => [...await f.read(...args), other], control: f.control });
  const view = await (await api.GET(get())).json();
  assert.equal(view.can_edit, true); assert.equal(view.listings[0].actions.edit_listing, 'unavailable');
  assert.equal(view.listings[0].actions.withdraw_listing, 'allowed');
  assert.deepEqual(view.listings[1].actions, f.contract.unavailableListingActions());
});
await check('positive current authority, exact lost-reply retry, revoke and changed resource fail closed', async () => {
  const f = fixture(), request = await f.command(), wire = JSON.stringify(request);
  let view = await (await f.api.GET(get())).json(); assert.equal(f.contract.listingActionAvailable(view, request), true);
  assert.equal((await f.api.POST(post(request))).status, 200);
  view = await (await f.api.GET(get())).json();
  assert.equal(f.contract.listingActionAvailable(view, request), false);
  assert.equal(f.contract.listingActionAvailable(view, request, true), true);
  assert.equal((await f.api.POST(post(JSON.parse(wire)))).status, 200); assert.equal(f.state.writes, 1);
  f.state.manage = false; view = await (await f.api.GET(get())).json();
  assert.equal(f.contract.listingActionAvailable(view, request, true), false);
  assert.equal((await f.api.POST(post(request))).status, 403); assert.equal(f.state.writes, 1);
  f.state.manage = true; f.state.row.core.request.resource.resource_version++;
  f.state.row.core.companion.canonical_reference.resource_version++;
  view = await (await f.api.GET(get())).json(); assert.equal(f.contract.listingActionAvailable(view, request, true), false);
  assert.equal(JSON.stringify(request), wire);
});
await check('lifecycle eligibility remains distinct from authority; reserved row still not editable in UI', async () => {
  const f = fixture(); f.state.row.status = 'reserved';
  const view = await (await f.api.GET(get())).json();
  assert.equal(view.listings[0].actions.edit_listing, 'allowed'); assert.equal(view.listings[0].status, 'reserved');
  assert.equal((await f.api.POST(post(await f.command()))).status, 409); assert.equal(f.state.writes, 0);
});
console.log('Targeted affordance groups:', count);
