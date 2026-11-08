// Real read-host/selector/API/route and real command bind over controlled Auth/PG.
// Command projection tests explicitly mock only Core host result transport.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createAirpropR2ReadFixture, r2Loader } from './lib/airprop-r2-test-fixture.mjs';
import { id, scope, fixture as domainFixture } from './lib/airprop-listing-flow-test-fixture.mjs';
const require = createRequire(import.meta.url), { NextRequest } = require('next/server');
const originalFetch = globalThis.fetch;
globalThis.fetch = async () => { throw Error('REAL_NETWORK_FORBIDDEN_IN_OFFLINE_PROOF'); };
let groups = 0;
const only = process.argv.includes('--case') ? process.argv[process.argv.indexOf('--case') + 1] : '';
const check = async (name, run) => { if (only && !name.includes(only)) return; await run(); console.log('PASS', ++groups, name); };
const get = () => new NextRequest('https://cladora.test/api/customer/v2/airprop/listings?' + new URLSearchParams(scope));
const post = body => new NextRequest('https://cladora.test/api/customer/v2/airprop/listings', { method: 'POST', headers: { Origin: 'https://cladora.test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const noWrites = f => { for (const q of f.x.calls) assert.doesNotMatch(q.text, /^\s*(insert|update|delete)\b|idempotency_keys|audit\.events|outbox_events/i); };
await check('actual R2 read selector is called with live scope; missing companion alone becomes503 with zero command receipt', async () => {
  const f = createAirpropR2ReadFixture(), read = f.native.createListingNativeReadV1(f.host, null);
  const { createListingFlowApi } = f.load('src/lib/airprop/listing-flow-api-v1.ts');
  const api = createListingFlowApi({ session: async () => ({ actor_id: id(3), aal: 'aal1' }), read, control: null });
  const response = await api.GET(get()); assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'LISTING_SOURCE_NOT_READY');
  for (const sql of [f.q.binding, f.q.ancestry, f.q.spec]) assert.ok(f.x.calls.some(q => q.text === sql));
  assert.ok(f.x.calls.some(q => q.text === 'rollback')); noWrites(f);
});
await check('empty authorized Listing read does not wait for companion or management authority', async () => {
  const f = createAirpropR2ReadFixture(); f.x.rows = 0;
  const rows = await f.native.createListingNativeReadV1(f.host, null)(id(3), scope);
  assert.deepEqual(rows, []); assert.ok(f.x.calls.some(q => q.text === 'commit')); noWrites(f);
});
await check('real selector identity reaches canonical seam; GET never calls old bindSelector or command receipt', async () => {
  const f = createAirpropR2ReadFixture(), rows = await f.native.createListingNativeReadV1(f.host, f.producer)(id(3), scope);
  const mapped = await f.load('src/lib/airprop/listing-flow-read-v1.ts').readListingFlow(async () => rows, id(3), scope);
  assert.equal(mapped[0].binding_state, 'unavailable'); assert.equal(mapped[0].actions.edit_listing, 'unavailable');
  assert.ok(f.x.guards > 3); noWrites(f);
});
await check('foreign ancestry withheld; no spec fallback1; original40001 passes through actual host', async () => {
  const f = createAirpropR2ReadFixture(); f.x.foreign = true;
  await assert.rejects(f.native.createListingNativeReadV1(f.host, null)(id(3), scope), /SELECTOR_DENIED/); noWrites(f);
  const g = createAirpropR2ReadFixture(); g.x.specs = false;
  await assert.rejects(g.native.createListingNativeReadV1(g.host, null)(id(3), scope), /CANONICAL_PRODUCER_NOT_READY/); noWrites(g);
  const h = createAirpropR2ReadFixture(), error = Object.assign(Error('CONTROLLED_40001'), { code: '40001' });
  h.x.fault = { sql: h.q.spec, error };
  await assert.rejects(h.native.createListingNativeReadV1(h.host, null)(id(3), scope), e => e === error); noWrites(h);
});
await check('canonical spec version and full expiry cannot exceed actual read selector evidence', async () => {
  const f = createAirpropR2ReadFixture(), original = f.producer.readCanonical;
  f.producer.readCanonical = async (...args) => { const e = await original(...args); e.current_until = '2026-11-02T11:00:00.000000Z'; return e; };
  await assert.rejects(f.native.createListingNativeReadV1(f.host, f.producer)(id(3), scope), /CURRENTNESS_UNPROVEN/); noWrites(f);
  const g = createAirpropR2ReadFixture(), originalG = g.producer.readCanonical;
  g.producer.readCanonical = async (...args) => { const e = await originalG(...args);
    e.core.request.resource.resource_version = e.core.companion.canonical_reference.resource_version = 3; return e; };
  await assert.rejects(g.native.createListingNativeReadV1(g.host, g.producer)(id(3), scope), /SOURCE_DRIFT/); noWrites(g);
});
const target = { contract: 'core-functional-development-target.v1', backend_id: 'controlled-owner-r2-not-native',
  purpose: 'owned-isolated-persistent-development', host: '127.0.0.1', port: 55432, database_name: 'cladora_dev_listing_model',
  database_oid: 1234, runtime_role: 'synthetic_read_runtime', auth_origin: 'http://127.0.0.1:55421' };
function options(f) { f.pool.options = { host: target.host, port: target.port, database: target.database_name,
  user: target.runtime_role, connectionTimeoutMillis: 5000, query_timeout: 15000 }; return { pool: f.pool, target }; }
await check('real route → resolver → official request-local command bind; missing canonical preparation returns503/zeroSQL', async () => {
  let auth;
  const f = createAirpropR2ReadFixture({ '@supabase/ssr': { ...require('@supabase/ssr'), createServerClient: () => auth },
    'next/headers': { cookies: async () => ({ set() {} }) },
    'src/lib/supabase/env.ts': { getPublicSupabaseEnv: () => ({ url: target.auth_origin, publishableKey: 'synthetic-no-network' }) } });
  auth = f.auth; f.x.aal = 'aal2';
  const config = { pool: f.pool, principal: f.principal, canonical: null, command: options(f) };
  const resolver = f.load('src/lib/airprop/listing-runtime-binding-v1.ts').createListingRequestRuntimeResolverV1(async () => config);
  // Only composition configuration is injected; the real API and resolver/official
  // Core binding/auth implementation execute. No configured runtime is installed.
  const routeLoad = r2Loader({ 'src/lib/supabase/server.ts': { createClient: async () => auth },
    'src/lib/airprop/listing-runtime-binding-v1.ts': { resolveListingRuntimeForRequest: resolver } });
  const route = routeLoad('src/app/api/customer/v2/airprop/listings/route.ts');
  const response = await route.POST(post(await domainFixture().command()));
  assert.equal(response.status, 503); assert.equal((await response.json()).error.code, 'LISTING_COMMAND_NOT_READY');
  assert.ok(f.x.authCalls > 0); assert.equal(f.x.calls.length, 0);
  // Outer claims alone are not sufficient: official verified Auth can still deny.
  auth.auth.getUser = async () => ({ data: { user: null }, error: Error('CONTROLLED_EXPIRED_AUTH') });
  const denied = await route.POST(post(await domainFixture().command()));
  assert.equal(denied.status, 401); assert.equal(f.x.calls.length, 0);
});
await check('AAL1 POST denied before official bind; GET remains read-profile and never invokes command binding', async () => {
  const f = createAirpropR2ReadFixture(); f.x.rows = 0;
  const resolver = f.load('src/lib/airprop/listing-runtime-binding-v1.ts').createListingRequestRuntimeResolverV1(async () => ({
    pool: f.pool, principal: f.principal, canonical: null, command: options(f) }));
  const api = f.load('src/lib/airprop/listing-flow-api-v1.ts').createListingFlowApi({ read: null, control: null, resolveRuntime: resolver,
    session: async () => ({ actor_id: id(3), aal: 'aal1' }) });
  assert.equal((await api.POST(post(await domainFixture().command()))).status, 403); assert.equal(f.x.authCalls, 0);
  assert.equal((await api.GET(get())).status, 200); noWrites(f);
});
await check('owner forwards original command/providers once; exact replay/UNKNOWN never resolve fresh identity', async () => {
  const d = domainFixture(), request = await d.command(), wire = JSON.stringify(request);
  let boundRequest, forwarded, result = 'unknown_commit', identityCalls = 0, prepares = 0, executes = 0;
  const f = createAirpropR2ReadFixture({ 'src/lib/core/listing-command-binding-v1.ts': {
    createCoreListingCommandBindingV1() { return { async bind(original) { boundRequest = original; return {
      resolveIdentity() { identityCalls++; throw Error('DO_NOT_MINT_REPLACEMENT'); }, host: { async execute(command, providers) {
        executes++;
        forwarded = { command, providers };
        return result === 'unknown_commit' ? { status: 'unknown_commit', code: 'READBACK_REQUIRED' } : { status: result,
          receipt: { mutation_id: request.command.listing_id, command_id: id(71), transaction_id: id(70), actor_id: id(3), workspace_id: id(2),
            idempotency_key: request.command.idempotency_key, input_fingerprint: 'sha256:' + createHash('sha256').update(wire).digest('hex'), receipt_id: id(90) } };
      } } }; } }; },
  } });
  const plan = f.load('src/lib/airprop/listing-control-plan-v1.ts').prepareListingControlV1(wire, scope);
  const c = { contract_version: 'core-transaction-command.v1', command_id: id(71), transaction_id: id(70), ...scope, actor_id: id(3),
    authority_version: 7, permission_code: 'airprop.opportunity.manage', module_code: 'airprop_commercial', evaluation_purpose: 'airprop.b2',
    aggregate_type: 'portfolio.unit', aggregate_id: id(9), aggregate_version: 1, provider_source_ids: [id(9)],
    idempotency_key: request.command.idempotency_key, input_fingerprint: 'sha256:' + createHash('sha256').update(wire).digest('hex') };
  const providers = { replay_policy: 'provider_current_state_required', replay_provider_code: 'controlled-listing-forwarding-only',
    async resolveAuthority() { assert.fail('MOCK_HOST_ONLY'); }, async validateProviders() { return false; },
    async validateReplay() { assert.fail('MOCK_HOST_ONLY'); }, async mutate() { assert.fail('MOCK_HOST_ONLY'); } };
  const resolver = f.load('src/lib/airprop/listing-runtime-binding-v1.ts').createListingRequestRuntimeResolverV1(async () => ({
    pool: f.pool, principal: f.principal, canonical: null, command: { ...options(f), async prepareControl(_port, actor, body) {
      prepares++; assert.equal(actor, id(3)); assert.deepEqual(body, request); return { command: c, plan, providers };
    } } }));
  const api = f.load('src/lib/airprop/listing-flow-api-v1.ts').createListingFlowApi({ read: null, control: null, resolveRuntime: resolver,
    session: async () => ({ actor_id: id(3), aal: 'aal2' }) });
  const original = post(request), unknown = await api.POST(original);
  assert.equal(unknown.status, 409); assert.equal((await unknown.json()).error.code, 'READBACK_REQUIRED');
  assert.equal(boundRequest, original); assert.equal(forwarded.command, c); assert.equal(forwarded.providers, providers);
  result = 'exact_replay'; const replay = await api.POST(post(request)); assert.equal(replay.status, 200);
  assert.equal((await replay.json()).receipt.idempotent, true); assert.equal(identityCalls, 0); assert.equal(prepares, 2);
  c.input_fingerprint = 'sha256:' + '0'.repeat(64);
  assert.equal((await api.POST(post(request))).status, 503); assert.equal(executes, 2);
  assert.equal(plan.wire, wire); assert.equal(f.x.calls.length, 0);
});
globalThis.fetch = originalFetch;
console.log(JSON.stringify({ groups, actual_read_host_selector: 'CONTROLLED_TRANSPORT', actual_command_bind_missing_source: 'CONTROLLED_AUTH_ZERO_SQL',
  command_result_projection: 'MOCK_CORE_RESULT_NOT_NATIVE', pg_auth_runtime_browser: 'NOT_RUN_NOT_PASS' }));
