// Controlled SQL transport/model only: no PostgreSQL/Auth/DDL/installation.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loader, id, scope as routeScope, sourceRow, actionProjection } from './lib/airprop-listing-flow-test-fixture.mjs';
const load = loader({ 'server-only': {} });
const api = load('src/lib/airprop/listing-selected-binding-v1.ts');
const { prepareListingPublicationV1 } = load('src/lib/airprop/listing-publication-v1.ts');
const { prepareListingControlV1 } = load('src/lib/airprop/listing-control-plan-v1.ts');
const { readListingFlow } = load('src/lib/airprop/listing-flow-read-v1.ts');
const selected = (await readListingFlow(async () => [sourceRow()], id(3), routeScope))[0].selection;
const withoutListing = () => { const { listing_id: _id, listing_version: _v, ...value } = selected; return value; };
const publication = () => ({ contract: 'airprop-listing-publication.v1', selection: withoutListing(), command: {
  version: 1, ...routeScope, action: 'publish_listing', opportunity_id: id(50), property_id: selected.property_id,
  unit_id: selected.unit_id, kind: 'resale', available_from: '2026-11-08T12:00:00Z', available_until: null,
  idempotency_key: 'original-selected-listing-01',
} });
function fixture() {
  const x = { queries: [], rows: new Map(), listing: null, failInsert: false, nativeReplay: false,
    spec: { id: id(55), version: 4 }, failSpec: false, wrongResult: false, badReturn: false };
  const tx = { transaction_id: id(70), database_transaction_id: '9001', workspace_id: id(2), tenant_id: id(6), actor_id: id(3), attempt: 1,
    async query(sql, values) {
      x.queries.push({ sql, values, transaction_id: tx.database_transaction_id });
      if (sql === api.LISTING_SELECTED_SPEC_SQL) return { rowCount: x.failSpec ? 0 : 1, rows: x.failSpec ? [] : [{ ...x.spec }] };
      if (sql === api.LISTING_SELECTED_BINDING_READ_SQL) {
        const value = x.rows.get(values[3] + ':' + values[4]); return { rowCount: value ? 1 : 0, rows: value ? [{ value: structuredClone(value) }] : [] };
      }
      if (sql === api.LISTING_SELECTED_BINDING_INSERT_SQL) {
        if (x.failInsert) throw Error('SYNTHETIC_BINDING_INSERT_FAILURE');
        const value = JSON.parse(values[5]), key = values[3] + ':' + values[4];
        if (x.rows.has(key)) throw Object.assign(Error('duplicate immutable binding'), { code: '23505' });
        x.rows.set(key, value); return { rowCount: 1, rows: [{ value: x.badReturn ? { ...value, command_key: 'wrong' } : value }] };
      }
      if (sql.includes('customer_api.publish_airprop_listing_v1(')) {
        x.listing = { id: id(30), version: 1, status: 'published' };
        return { rowCount: 1, rows: [{ result: { version: 1, listing_id: id(30), status: 'published', idempotent: x.nativeReplay } }] };
      }
      if (sql.includes('customer_api.control_airprop_listing_v1(')) {
        x.listing = { id: id(30), version: values[4] + 1, status: values[3] === 'withdraw' ? 'withdrawn' : 'published' };
        return { rowCount: 1, rows: [{ result: { version: 1, listing_id: x.wrongResult ? id(99) : id(30),
          listing_version: x.listing.version, status: x.listing.status, idempotent: x.nativeReplay } }] };
      }
      throw Error('Unexpected SQL in domain model');
    },
  };
  const canonical = () => ({ core: actionProjection(sourceRow(), id(3), selected, 'edit_listing').core, spec: { ...x.spec } });
  const command = plan => ({ contract_version: 'core-transaction-command.v1', transaction_id: tx.transaction_id,
    command_id: id(71 + (x.listing?.version ?? 0)), actor_id: tx.actor_id, ...routeScope, authority_version: 2,
    permission_code: 'airprop.opportunity.manage', module_code: 'airprop_commercial', evaluation_purpose: 'airprop.b2',
    aggregate_type: 'portfolio.unit', aggregate_id: selected.unit_id, aggregate_version: 1,
    provider_source_ids: [selected.unit_id, selected.property_id, selected.party_id, selected.relationship_id, x.spec.id],
    idempotency_key: plan.request.command.idempotency_key, input_fingerprint: 'sha256:' + createHash('sha256').update(plan.wire).digest('hex') });
  const plan = () => prepareListingPublicationV1(JSON.stringify(publication()), routeScope);
  const run = async (p = plan(), c = command(p), evidence = canonical()) => {
    // Explicit MODEL rollback, not a claim that PostgreSQL or Core COMMIT ran.
    const before = structuredClone({ rows: x.rows, listing: x.listing });
    try { return await api.mutateListingWithSelectedBindingV1(tx, c, p, async () => evidence); }
    catch (error) { x.rows = before.rows; x.listing = before.listing; throw error; }
  };
  const control = action => {
    const c = { version: 1, ...routeScope, action, listing_id: id(30), expected_version: x.listing.version,
      reason: 'Explicit lifecycle change', idempotency_key: 'original-control-' + x.listing.version,
      ...(action === 'withdraw_listing' ? {} : { available_from: '2026-11-08T12:00:00Z', available_until: null }) };
    return prepareListingControlV1(JSON.stringify({ contract: 'airprop-listing-flow.v1', selection: {
      ...selected, listing_version: x.listing.version }, command: c }), routeScope);
  };
  return { x, tx, canonical, command, plan, run, control };
}
let groups = 0;
async function test(name, fn) { await fn(); console.log('PASS', ++groups, name); }
await test('publish stores full actual selected tuple/spec and original command identity on SAME supplied scope', async () => {
  const f = fixture(), p = f.plan(); assert.deepEqual(await f.run(p), { mutation_id: id(30) });
  const b = await api.readListingSelectedBindingV1(f.tx, id(1), id(30), 1);
  assert.deepEqual(b.selection, selected); assert.equal(b.spec_id, id(55)); assert.equal(b.spec_version, 4);
  assert.equal(b.command_id, id(71)); assert.equal(b.transaction_id, id(70));
  assert.equal(b.wire_sha256, createHash('sha256').update(p.wire).digest('hex'));
  assert.ok(f.x.queries.every(q => q.transaction_id === '9001'));
  assert.equal(Object.hasOwn(b, 'core_receipt_id'), false); assert.equal(Object.hasOwn(b, 'wire'), false);
});
await test('edit/withdraw/republish retain same Listing ID and immutable per-version bindings', async () => {
  const f = fixture(); await f.run();
  for (const action of ['edit_listing', 'withdraw_listing', 'republish_listing']) await f.run(f.control(action));
  assert.equal(f.x.rows.size, 4); assert.equal(f.x.listing.id, id(30)); assert.equal(f.x.listing.version, 4);
  for (let n = 1; n <= 4; n++) assert.equal(f.x.rows.get(id(30) + ':' + n).selection.listing_version, n);
});
await test('historical Listing without binding is NOT adopted/backfilled and no native control occurs', async () => {
  const f = fixture(); f.x.listing = { id: id(30), version: 1, status: 'published' };
  await assert.rejects(f.run(f.control('withdraw_listing')), /LEGACY_BINDING_UNAVAILABLE/);
  assert.equal(f.x.rows.size, 0); assert.equal(f.x.queries.some(q => q.sql.includes('control_airprop_listing')), false);
});
await test('missing actual spec does not turn resource_version fallback1 into spec history', async () => {
  const f = fixture(); f.x.failSpec = true; await assert.rejects(f.run(), /BINDING_SPEC/);
  assert.equal(f.x.listing, null); assert.equal(f.x.rows.size, 0);
});
await test('foreign scope/actor/transaction/key/profile/aggregate/fingerprint fail before any query', async () => {
  for (const change of [{ actor_id: id(99) }, { workspace_id: id(99) }, { transaction_id: id(99) }, { context_id: id(99) },
    { idempotency_key: 'different-key-01' }, { permission_code: 'airprop.asset.read' }, { aggregate_id: id(99) },
    { input_fingerprint: 'sha256:' + '0'.repeat(64) }, { provider_source_ids: [] }]) {
    const f = fixture(), p = f.plan(); await assert.rejects(f.run(p, { ...f.command(p), ...change }), /BINDING_COMMAND/);
    assert.equal(f.x.queries.length, 0);
  }
});
await test('canonical permission/revoke/Party/relationship/resource version cannot be replaced by client tuple', async () => {
  for (const mutate of [e => { e.core.authority.decision = 'denied'; }, e => { e.core = sourceRow().core; },
    e => { e.core.companion.relationship.party_id = id(99); }, e => { e.core.companion.relationship.relationship_version = 99; },
    e => { e.core.companion.canonical_reference.resource_version = 99; }, e => { e.spec.version = 99; }]) {
    const f = fixture(), evidence = f.canonical(); mutate(evidence);
    await assert.rejects(f.run(f.plan(), undefined, evidence)); assert.equal(f.x.listing, null);
  }
});
await test('native write followed by failed binding insert is rolled back by MODEL, error not swallowed', async () => {
  const f = fixture(); f.x.failInsert = true; await assert.rejects(f.run(), /SYNTHETIC_BINDING_INSERT_FAILURE/);
  assert.ok(f.x.queries.some(q => q.sql.includes('publish_airprop_listing'))); assert.equal(f.x.listing, null); assert.equal(f.x.rows.size, 0);
});
await test('existing Core mutate-port adapter passes the identical scope/command to canonical recheck and storage', async () => {
  const f = fixture(), p = f.plan(), c = f.command(p); let calls = 0;
  const mutate = api.createListingSelectedBindingMutatorV1(p, async (scope, command) => {
    assert.equal(scope, f.tx); assert.equal(command, c); calls++; return f.canonical();
  });
  assert.deepEqual(await mutate(f.tx, c), { mutation_id: id(30) }); assert.equal(calls, 2);
  assert.equal(f.x.rows.size, 1);
  const g = fixture(), q = g.plan(), fault = Object.assign(Error('SYNTHETIC_40001'), { code: '40001' });
  const denied = api.createListingSelectedBindingMutatorV1(q, async () => { throw fault; });
  await assert.rejects(denied(g.tx, g.command(q)), error => error === fault);
  assert.equal(g.x.queries.length, 0); assert.equal(g.x.rows.size, 0);
});
await test('post-wait canonical revoke/spec drift stops before native mutation, never reuses pre-lock allow', async () => {
  for (const change of [e => { e.core.authority.decision = 'denied'; }, e => { e.spec.id = id(99); }]) {
    const f = fixture(), p = f.plan(), c = f.command(p); let n = 0;
    const mutate = api.createListingSelectedBindingMutatorV1(p, async () => {
      const e = f.canonical(); if (++n === 2) change(e); return e;
    });
    await assert.rejects(mutate(f.tx, c)); assert.equal(n, 2);
    assert.equal(f.x.queries.some(q => q.sql.includes('publish_airprop_listing')), false);
    assert.equal(f.x.rows.size, 0); assert.equal(f.x.listing, null);
  }
});
await test('binding read is SELECT-only; missing/foreign/corrupt is not success', async () => {
  const f = fixture(); assert.equal(await api.readListingSelectedBindingV1(f.tx, id(1), id(30), 1), null);
  await f.run(); const n = f.x.queries.length; await api.readListingSelectedBindingV1(f.tx, id(1), id(30), 1);
  assert.ok(f.x.queries.slice(n).every(q => q.sql === api.LISTING_SELECTED_BINDING_READ_SQL));
  await assert.rejects(api.readListingSelectedBindingV1(f.tx, id(99), id(30), 1), /BINDING_SCOPE/);
  f.x.rows.set(id(30) + ':1', { wrong: true }); await assert.rejects(api.readListingSelectedBindingV1(f.tx, id(1), id(30), 1));
});
await test('stored tuple drift and wrong native result abort rather than transfer a Party', async () => {
  const f = fixture(); await f.run(); f.x.rows.get(id(30) + ':1').selection.party_id = id(99);
  await assert.rejects(f.run(f.control('withdraw_listing')), /BINDING_DRIFT/); assert.equal(f.x.listing.version, 1);
  const g = fixture(); await g.run(); g.x.wrongResult = true;
  await assert.rejects(g.run(g.control('withdraw_listing')), /BINDING_RESULT/); assert.equal(g.x.listing.version, 1);
});
await test('native idempotent response without real Core receipt never creates/adopts binding', async () => {
  const f = fixture(); f.x.nativeReplay = true; await assert.rejects(f.run(), /REQUIRES_CORE_RECEIPT/);
  assert.equal(f.x.listing, null); assert.equal(f.x.rows.size, 0);
});
await test('tampered plan and insert return mismatch roll back without receipt synthesis', async () => {
  const f = fixture(), p = f.plan(), changed = { ...p, native: { ...p.native, sql: 'select attacker()' } };
  await assert.rejects(f.run(changed, f.command(p)), /BINDING_PLAN/); assert.equal(f.x.queries.length, 0);
  f.x.badReturn = true; await assert.rejects(f.run(), /BINDING_PERSISTENCE/); assert.equal(f.x.listing, null);
});
await test('inactive DDL has explicit stop, scoped FK, immutable UPDATE/DELETE/TRUNCATE and no backfill/grant', () => {
  const sql = readFileSync(new URL('../supabase/proposals/airprop_listing_selected_bindings_v1.sql', import.meta.url), 'utf8');
  assert.ok(sql.indexOf("errcode='55000'") < sql.indexOf('create table'));
  assert.match(sql, /foreign key\(listing_id,tenant_id,workspace_id\)/);
  assert.match(sql, /after insert or update or delete/); assert.match(sql, /before truncate/);
  assert.match(sql, /force row level security/); assert.doesNotMatch(sql, /\bgrant\s+(select|insert|execute)|\bon conflict|\bupdate airprop\./i);
});
await test('deferred real-receipt linkage source names current transaction, command, mutation, audit and outbox', () => {
  const sql = readFileSync(new URL('../supabase/proposals/airprop_listing_selected_bindings_v1.sql', import.meta.url), 'utf8');
  assert.match(sql, /deferrable initially deferred/);
  for (const marker of ['platform.idempotency_keys k', 'join audit.events a', 'join platform.outbox_events o',
    "k.xmin::text=(pg_catalog.txid_current()%4294967296)::text", "k.response_ref->>'command_id'",
    "k.response_ref->>'transaction_id'", "k.response_ref->>'input_fingerprint'", "k.response_ref->>'mutation_id'",
    "listing_selected_binding_core_receipt_required"]) assert.ok(sql.includes(marker), marker);
});
console.log(JSON.stringify({ groups, layer: 'REAL_DOMAIN_CODE_WITH_CONTROLLED_SQL_MODEL', native: 'NOT_RUN_NOT_PASS', real_core_host_execution: 'NOT_RUN_NOT_PASS' }));
