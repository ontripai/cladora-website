// Synthetic SQL transport/Auth only: real adapter, Core selector, mapper and schemas.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fixture, sourceRow, id, scope, loader } from './lib/airprop-listing-flow-test-fixture.mjs';
const require = createRequire(import.meta.url);
const lock = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
for (const name of ['next', 'zod', 'react', 'typescript']) assert.equal(require(name + '/package.json').version,
  lock.packages['node_modules/' + name].version, 'EXACT_LOCK_REQUIRED: ' + name);
const load = loader(), native = load('src/lib/airprop/listing-native-read-v1.ts');
const authorityPort = load('src/lib/core/current-authority-transaction-port-v1.ts');
const time = '2026-11-02T09:00:00.000000Z';
function setup() {
  const original = sourceRow(), calls = [], server = { ...scope, actor_id: id(3), tenant_id: id(6) };
  const row = { listing_id: id(30), tenant_id: id(6), workspace_id: id(2), property_id: id(8), unit_id: id(9),
    listing_version: 1, status: 'published', available_from: original.available_from, available_until: null };
  const state = { rows: [row], phase: 0, canonical: 0, selectorProperty: id(8), permission: true, expiry: '2026-11-03T09:00:00Z', clock: time,
    mutateEvidence: () => {}, mutateRows: () => {}, hostReturns: false, completedAt: time };
  const sql = { transaction_id: id(50), database_transaction_id: '41', workspace_id: id(2), tenant_id: id(6), actor_id: id(3), attempt: 1,
    async query(text, values) {
      calls.push({ text, values }); assert.match(text.trim(), /^select\b/i);
      if (text === native.LISTING_NATIVE_PAGE_SQL) {
        state.phase++; state.mutateRows(state);
        return { rows: structuredClone(state.rows), rowCount: state.rows.length };
      }
      const one = value => ({ rows: [value], rowCount: 1 });
      if (text.includes('txid_current()')) return one({ transaction_id: '41', actor_id: server.actor_id, isolation: 'serializable', evaluated_at: time });
      if (text.includes('canonical_authority_revision_v1')) return one({ revision: '7' });
      if (text.includes('from platform.customer_workspaces w')) return one({ tenant_id: server.tenant_id, workspace_status: 'ACTIVE', actor_id: server.actor_id,
        membership_status: 'active', membership_current: true, context_current: true, scope_type: 'tenant', property_id: null, building_id: null, unit_id: null });
      if (text.includes('check_workspace_native_permission_v2')) return one({ allowed: state.permission });
      if (text.includes('workspace_property_bindings')) return one({ id: id(60) });
      if (text.includes('from portfolio.properties p where')) return one({ status: 'active' });
      if (text.includes('from portfolio.units u')) return one({ unit_status: 'active', building_status: 'active', property_status: 'active', building_id: id(61), property_id: state.selectorProperty });
      if (text.includes('clock_timestamp()')) return one({ at: state.clock });
      throw Error('unexpected fake SQL');
    } };
  const host = { async withScope(actor, requested, work) { assert.equal(actor, server.actor_id); assert.deepEqual(requested, scope);
    const result = await work(sql, server); state.hostReturns = true; return { value: result, completed_at: state.completedAt }; } };
  const producer = {
    async bindSelector() {
      const request = { contract_version: 'core-current-unit-property-selector-request.v1', ...scope, actor_id: server.actor_id, authority_version: 7,
        permission_code: 'airprop.asset.read', module_code: 'airprop_commercial', evaluation_purpose: 'airprop.current-unit-property.select',
        transaction_id: sql.transaction_id, command_id: id(51), attempt: 1, lock: { kind: 'command_aggregate', aggregate_type: 'portfolio.unit', aggregate_id: id(9) }, property_id: id(8), unit_id: id(9) };
      const context = { transaction_id: sql.transaction_id, command_id: id(51), attempt: 1, isolation_level: 'serializable',
        lock: { ...request.lock, workspace_id: server.workspace_id, acquired_at: '2026-11-02T08:59:59Z' } };
      const authorityRequest = { contract_version: 'core-current-authority-transaction-port-request.v1', decision_id: id(52), ...scope, actor_id: server.actor_id,
        authority_version: 7, permission_code: request.permission_code, module_code: request.module_code, evaluation_purpose: request.evaluation_purpose, transaction_context: context };
      // Synthetic evidence is created ONLY in this fixture; product never fabricates it.
      const authority = authorityPort.bindCanonicalCurrentAuthorityObservationV1(authorityRequest, {
        contract_version: 'core-current-authority-observation.v1', source_contract: 'workspace-native-effective-authority.v2', decision_id: id(52), ...scope,
        actor_id: server.actor_id, authority_version: 7, permission_code: request.permission_code, module_code: request.module_code, transaction_context: context,
        evaluator: 'app_private.check_workspace_native_permission_v2', source_disclosure: 'status_only', source_reference: null, actor_status: 'current', decision: 'allowed', evaluated_at: time,
        entitlement: { contract_version: 'core-authority-entitlement-binding.v1', workspace_id: server.workspace_id, module_definition_id: id(53), module_code: request.module_code, entitlement_key: 'module.airprop_commercial', authority_revision: 7 } });
      return { request, authority };
    },
    async readCanonical() { state.canonical++; const core = structuredClone(original.core); state.mutateEvidence(core, state.canonical); return { core, current_until: state.expiry }; },
  };
  return { state, server, sql, host, producer, calls, read: () => native.createListingNativeReadV1(host, producer)(server.actor_id, scope) };
}
let count = 0;
async function check(name, work) { await work(); console.log('PASS', ++count, name); }
await check('actual query/Core selector/mapper compose a bounded named Unit read; no edit escalation', async () => {
  const f = setup(), raw = await f.read(); assert.equal(raw.length, 1); assert.equal(f.state.hostReturns, true);
  const view = await load('src/lib/airprop/listing-flow-read-v1.ts').readListingFlow(async () => raw, f.server.actor_id, scope);
  assert.equal(view[0].selection.unit_id, id(9)); assert.equal(view[0].source_name, sourceRow().core.companion.canonical_reference.display_name);
  assert.deepEqual(view[0].actions, fixture().contract.unavailableListingActions());
  assert.equal(f.calls.filter(x => x.text === native.LISTING_NATIVE_PAGE_SQL).length, 2);
  assert.deepEqual(f.calls.find(x => x.text === native.LISTING_NATIVE_PAGE_SQL).values, [id(6), id(2), null, 100]);
});
for (const missing of ['host', 'producer']) await check('missing ' + missing + ' fails before query', async () => {
  const f = setup(); await assert.rejects(() => native.createListingNativeReadV1(missing === 'host' ? null : f.host, missing === 'producer' ? null : f.producer)(f.server.actor_id, scope));
  assert.equal(f.calls.length, 0);
});
for (const field of ['actor_id', 'context_id', 'workspace_id', 'tenant_id']) await check('foreign server ' + field, async () => {
  const f = setup(); f.server[field] = id(99); await assert.rejects(f.read); assert.equal(f.state.hostReturns, false);
});
for (const change of ['foreign_row', 'property', 'unit', 'revoked', 'stale_resource', 'foreign_companion', 'property_fallback', 'party_drift', 'relationship_drift', 'version_drift']) await check('reject ' + change, async () => {
  const f = setup();
  if (change === 'foreign_row') f.state.rows[0].tenant_id = id(99);
  if (change === 'property') f.state.selectorProperty = id(99);
  if (change === 'unit') f.state.rows[0].unit_id = id(99);
  if (change === 'revoked') f.state.permission = false;
  if (change === 'stale_resource') f.state.mutateEvidence = core => core.companion.canonical_reference.resource_version++;
  if (change === 'foreign_companion') f.state.mutateEvidence = core => core.companion.source.source_workspace_id = id(99);
  if (change === 'property_fallback') f.state.mutateEvidence = core => { core.request.resource.resource_type = 'property'; core.request.resource.resource_id = id(8); core.companion.canonical_reference.resource_type = 'property'; core.companion.canonical_reference.resource_id = id(8); core.companion.relationship.resource_type = 'property'; core.companion.relationship.resource_id = id(8); };
  if (change === 'party_drift') f.state.mutateEvidence = (core, n) => { if (n > 1) core.companion.relationship.party_id = id(99); };
  if (change === 'relationship_drift') f.state.mutateEvidence = (core, n) => { if (n > 1) { core.request.relationship.relationship_version++; core.companion.relationship.relationship_version++; } };
  if (change === 'version_drift') f.state.mutateRows = state => { if (state.phase > 1) state.rows[0].listing_version++; };
  await assert.rejects(f.read); assert.equal(f.state.hostReturns, false);
});
await check('real producer cannot backdate post observation or cross expiry while waiting', async () => {
  const f = setup(); f.state.clock = '2026-11-02T09:00:00.000001Z'; await assert.rejects(f.read, /CURRENTNESS_UNPROVEN/);
  const g = setup(); g.state.expiry = time; await assert.rejects(g.read, /CURRENTNESS_UNPROVEN/);
  const commitWait = setup(); commitWait.state.completedAt = commitWait.state.expiry;
  await assert.rejects(commitWait.read, /CURRENTNESS_UNPROVEN/);
  const backdated = setup(); backdated.state.completedAt = '2026-11-02T08:59:59Z';
  await assert.rejects(backdated.read, /CURRENTNESS_UNPROVEN/);
});
await check('40001 passes unchanged, partial collection never returns', async () => {
  const f = setup(), error = Object.assign(new Error('synthetic serialization'), { code: '40001' });
  f.sql.query = async () => { throw error; }; await assert.rejects(f.read, value => value === error); assert.equal(f.state.hostReturns, false);
});
await check('page size, foreign cursor, overcount and order are rejected', async () => {
  for (const limit of [0, 101, 1.5]) { const f = setup(); await assert.rejects(() => native.queryListingNativePageV1(f.sql, f.server, { limit, cursor: null })); assert.equal(f.calls.length, 0); }
  const positive = setup(); await native.queryListingNativePageV1(positive.sql, positive.server, { limit: 1, cursor: { ...positive.server, after_id: id(29) } });
  assert.deepEqual(positive.calls[0].values, [id(6), id(2), id(29), 1]);
  const f = setup(); await assert.rejects(() => native.queryListingNativePageV1(f.sql, f.server, { limit: 1, cursor: { ...f.server, context_id: id(99), after_id: id(29) } }));
  f.state.rows.push({ ...f.state.rows[0], listing_id: id(31) }); await assert.rejects(() => native.queryListingNativePageV1(f.sql, f.server, { limit: 1, cursor: null }));
  f.state.rows.reverse(); await assert.rejects(() => native.queryListingNativePageV1(f.sql, f.server));
});
console.log('New native-read controlled groups:', count, '; PostgreSQL/Auth NOT_RUN_NOT_PASS');
