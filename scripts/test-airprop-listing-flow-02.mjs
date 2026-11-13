import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fixture, scope, id, loader } from './lib/airprop-listing-flow-test-fixture.mjs';
const { NextRequest } = createRequire(import.meta.url)('next/server');
let cases = 0;
const test = async (name, fn) => { await fn(); console.log('PASS', ++cases, name); };
const get = () => new NextRequest(`https://cladora.test/api/customer/v2/airprop/listings?${new URLSearchParams(scope)}`);
const post = (body, extra = {}) => new NextRequest('https://cladora.test/api/customer/v2/airprop/listings', {
  method: 'POST', headers: { Origin: 'https://cladora.test', 'Content-Type': 'application/json', ...extra }, body: JSON.stringify(body),
});
const fetchBefore = globalThis.fetch;
globalThis.fetch = () => { throw Error('REAL_NETWORK_FORBIDDEN'); };
try {
  await test('current actual Core mapping -> bounded named listing, no private provenance', async () => {
    const f = fixture(), r = await f.api.GET(get()), b = await r.json(); assert.equal(r.status, 200);
    assert.equal(b.listings[0].source_name, 'Apartament sintetic Unirii'); assert.equal(b.listings[0].selection.resource_version, 4);
    assert.equal(b.listings[0].selection.party_id, id(7)); assert.match(r.headers.get('Cache-Control'), /no-store.*private/);
    assert.doesNotMatch(JSON.stringify(b), /private-source-marker|private-evidence-marker|tenant_id|evaluated_at/); assert.equal(f.state.writes, 0);
  });
  for (const kind of ['person', 'company', 'representation']) await test('canonical relationship ' + kind, async () => {
    const f = fixture(), row = f.state.row;
    if (kind === 'representation') { row.core.request.relationship.relationship_kind = kind; row.core.companion.relationship.relationship_kind = kind; }
    else row.core.companion.relationship.party_kind = kind;
    const r = await f.api.GET(get()); assert.equal(r.status, 200); const b = await r.json();
    assert.equal(b.listings[0].selection[kind === 'representation' ? 'relationship_kind' : 'party_kind'], kind);
  });
  const changes = [
    r => { r.workspace_id = id(99); }, r => { r.core.companion.source.source_context_id = id(99); },
    r => { r.core.companion.relationship.relationship_status = 'revoked'; },
    r => { r.core.companion.relationship.valid_until = '2026-11-02T09:00:00Z'; },
    r => { r.core.authority.decision = 'denied'; },
    r => { r.core.authority.evaluated_at = '2026-11-02T08:59:59Z'; },
    r => { r.core.companion.canonical_reference.resource_version++; },
    r => { r.core.companion.relationship.relationship_version++; },
    r => { r.unit_id = id(99); }, r => { r.core.companion.canonical_reference.display_name = id(99); },
  ];
  for (let i = 0; i < changes.length; i++) await test('foreign/stale/revoked/expiry/redaction ' + i, async () => {
    const f = fixture(); changes[i](f.state.row); const r = await f.api.GET(get()); assert.equal(r.status, 403);
    assert.deepEqual(await r.json(), { error: { code: 'LISTING_READ_UNAVAILABLE' } }); assert.equal(f.state.writes, 0);
  });
  await test('an otherwise valid Property companion is never a fallback for the explicit Listing Unit', async () => {
    const f = fixture(), row = f.state.row;
    for (const source of [row.core.request.resource, row.core.companion.canonical_reference, row.core.companion.relationship]) {
      source.resource_type = 'property'; source.resource_id = row.property_id;
    }
    assert.equal((await f.api.GET(get())).status, 403); assert.equal(f.state.writes, 0);
  });
  await test('edit -> withdraw -> republish existing native command shapes, version increments', async () => {
    const f = fixture(); let version = 1;
    for (const action of ['edit_listing', 'withdraw_listing', 'republish_listing']) {
      const c = await f.command(action, 'listing-' + action), r = await f.api.POST(post(c));
      assert.equal(r.status, 200); assert.equal(f.contract.matchesListingReceipt(await r.json(), c), true);
      assert.equal(f.state.row.listing_version, ++version);
    }
    assert.equal(f.state.row.status, 'published'); assert.equal(f.state.writes, 3);
  });
  await test('stale listing version fails and does not write', async () => {
    const f = fixture(), c = await f.command(); f.state.row.listing_version++;
    assert.equal((await f.api.POST(post(c))).status, 409); assert.equal(f.state.writes, 0);
  });
  for (const field of ['resource_id', 'resource_version', 'party_id', 'relationship_id', 'relationship_version', 'unit_id', 'property_id']) await test('explicit same-selection join rejects ' + field, async () => {
    const f = fixture(), c = await f.command(); c.selection[field] = typeof c.selection[field] === 'number' ? 999 : id(99);
    assert.equal((await f.api.POST(post(c))).status, 409); assert.equal(f.state.writes, 0);
  });
  await test('cross workspace request -> denial, no fake authority accepted', async () => {
    const f = fixture(), c = await f.command(); c.command.workspace_id = id(99);
    assert.equal((await f.api.POST(post(c))).status, 403); assert.equal(f.state.writes, 0);
  });
  await test('lost reply/exact replay one modeled write; changed body conflict', async () => {
    const f = fixture(), c = await f.command(); const first = await f.api.POST(post(c)); assert.equal(first.status, 200); // reply deliberately ignored
    const replay = await f.api.POST(post(c)); assert.equal(replay.status, 200); assert.equal((await replay.json()).receipt.idempotent, true);
    assert.equal(f.state.writes, 1); c.command.reason = 'A different reason'; assert.equal((await f.api.POST(post(c))).status, 409); assert.equal(f.state.writes, 1);
  });
  await test('revoke blocks replay despite existing fake receipt', async () => {
    const f = fixture(), c = await f.command(); await f.api.POST(post(c)); f.state.manage = false;
    assert.equal((await f.api.POST(post(c))).status, 403); assert.equal(f.state.writes, 1);
  });
  await test('malformed or foreign receipt is unknown, never success', async () => {
    const f = fixture(), c = await f.command(); f.state.malformed = true; const r = await f.api.POST(post(c)); assert.equal(r.status, 502);
    assert.deepEqual(await r.json(), { error: { code: 'LISTING_RESULT_UNKNOWN' } });
    const good = f.state.ledger.get(c.command.idempotency_key).value;
    for (const changed of [{ ...good, context_id: id(99) }, { ...good, command_key: 'different' }, { ...good, receipt: { ...good.receipt, listing_version: 90 } }]) assert.equal(f.contract.matchesListingReceipt(changed, c), false);
  });
  await test('origin, strict selection/command and duplicate query guards precede bridge', async () => {
    const f = fixture(), c = await f.command(); assert.equal((await f.api.POST(post(c, { Origin: 'https://other.test' }))).status, 403);
    c.selection.listing_version++; assert.equal((await f.api.POST(post(c))).status, 400); assert.equal(f.state.bridgeCalls, 0);
    assert.equal((await f.api.GET(new NextRequest(get().url + '&context_id=' + scope.context_id))).status, 400);
  });
  await test('read connection independent of absent C03; absent both is fail-closed', async () => {
    const f = fixture(), c = await f.command();
    const readOnly = f.createListingFlowApi({ session: f.session, read: f.read, control: null });
    assert.equal((await (await readOnly.GET(get())).json()).can_edit, false); assert.equal((await readOnly.POST(post(c))).status, 503);
    const closed = f.createListingFlowApi({ session: f.session, read: null, control: null }); assert.equal((await closed.GET(get())).status, 503);
    f.state.actor = null; assert.equal((await closed.GET(get())).status, 401);
  });
  await test('real product route retains null adapters, zero control/read dispatch', async () => {
    const f = fixture(), c = await f.command();
    const load = loader({ '@/lib/supabase/server': { createClient: async () => ({ auth: { getClaims: async () => ({ data: { claims: { sub: id(3), aal: 'aal2' } }, error: null }) } }) } });
    const route = load('src/app/api/customer/v2/airprop/listings/route.ts');
    assert.equal((await route.GET(get())).status, 503); assert.equal((await route.POST(post(c))).status, 503);
  });
  await test('versioned local recovery preserves exact wire and fails closed', async () => {
    const f = fixture(), wire = JSON.stringify(await f.command());
    const owner = { ...scope, actor_id: f.state.actor, membership_id: id(40) };
    for (const state of ['uncertain', 'blocked']) assert.deepEqual(f.contract.readListingRecovery(f.contract.writeListingRecovery(wire, state, owner), scope, owner), { state, wire });
    assert.equal(f.contract.readListingRecovery('bad', scope, owner).state, 'invalid');
    assert.equal(f.contract.readListingRecovery(f.contract.writeListingRecovery(wire, 'uncertain', owner), { ...scope, workspace_id: id(99) }, owner).state, 'invalid');
    assert.equal(f.contract.readListingRecovery(JSON.stringify({ recovery_version: 1, state: 'uncertain', wire }), scope, owner).state, 'unverified');
  });
  await test('existing B2 AAL2 gate retained; missing/AAL1 never calls command bridge', async () => {
    const f = fixture(), c = await f.command();
    for (const aal of ['', 'aal1']) {
      f.state.aal = aal;
      assert.equal((await f.api.GET(get())).status, 200); assert.equal((await (await f.api.GET(get())).json()).can_edit, false);
      const denied = await f.api.POST(post(c)); assert.equal(denied.status, 403); assert.deepEqual(await denied.json(), { error: { code: 'MFA_REQUIRED' } });
    }
    assert.equal(f.state.bridgeCalls, 0); assert.equal(f.state.writes, 0);
  });
} finally { globalThis.fetch = fetchBefore; }
console.log(`${cases}/${cases} PASS_CONTROLLED_SOURCE; real C01/DW02/C03, PostgreSQL/Auth and activation NOT_RUN_NOT_PASS`);
