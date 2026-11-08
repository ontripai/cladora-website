// Same Listing card: direct effect of official Core ae1fe671 Auth correction.
// Actual Listing route/resolver/Core binder, controlled SDK/PG; no native login.
import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { createAirpropR2ReadFixture, r2Loader } from './lib/airprop-r2-test-fixture.mjs';
import { fixture, id, scope } from './lib/airprop-listing-flow-test-fixture.mjs';
const require = createRequire(import.meta.url), { NextRequest } = require('next/server');
const before = process.argv.includes('--before-dir') ? process.argv[process.argv.indexOf('--before-dir') + 1] : null;
const originalFetch = globalThis.fetch; globalThis.fetch = async () => { throw Error('REAL_NETWORK_FORBIDDEN'); };
let groups = 0;
const check = async (name, run) => { await run(); console.log('PASS', ++groups, name); };
const target = { contract: 'core-functional-development-target.v1', backend_id: 'controlled-ae1-listing-auth',
  purpose: 'owned-isolated-persistent-development', host: '127.0.0.1', port: 55432,
  database_name: 'cladora_dev_listing_model', database_oid: 1234, runtime_role: 'synthetic_read_runtime', auth_origin: 'http://127.0.0.1:55421' };
function snapshot(load, path) {
  if (!before) return load(path);
  const file = resolve(path), mod = new Module(file); mod.filename = file;
  mod.require = name => name === 'server-only' ? {} : name.startsWith('.') ? load(resolve(dirname(file), name)) : require(name);
  mod._compile(ts.transpileModule(readFileSync(resolve(before, path.split('/').at(-1)), 'utf8'), { fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, file); return mod.exports;
}
async function setup() {
  let sdk; const state = { checkouts: 0, prepared: 0, outerAal: 'aal2', dropAfterBind: false };
  const f = createAirpropR2ReadFixture({ '@supabase/ssr': { ...require('@supabase/ssr'), createServerClient: () => sdk },
    'next/headers': { cookies: async () => ({ set() {} }) },
    'src/lib/supabase/env.ts': { getPublicSupabaseEnv: () => ({ url: target.auth_origin, publishableKey: 'synthetic-no-network' }) } });
  sdk = f.auth;
  const connect = f.pool.connect; f.pool.connect = async () => { state.checkouts++; return connect(); };
  f.pool.options = { host: target.host, port: target.port, database: target.database_name, user: target.runtime_role,
    connectionTimeoutMillis: 5000, query_timeout: 15000 };
  const body = await fixture().command(), wire = JSON.stringify(body);
  const api = snapshot(f.load, 'src/lib/airprop/listing-flow-api-v1.ts');
  const runtime = snapshot(f.load, 'src/lib/airprop/listing-runtime-binding-v1.ts');
  const resolver = runtime.createListingRequestRuntimeResolverV1(async () => ({ pool: f.pool, principal: f.principal, canonical: null,
    command: { pool: f.pool, target, async prepareControl() {
      state.prepared++;
      if (!state.dropAfterBind) return null; // Absent producer, not a positive preparation.
      f.x.aal = 'aal1';
      const plan = f.load('src/lib/airprop/listing-control-plan-v1.ts').prepareListingControlV1(wire, scope);
      const hash = (await import('node:crypto')).createHash('sha256').update(wire).digest('hex');
      // Negative-only original command: Auth must stop before these providers.
      return { plan, command: { contract_version: 'core-transaction-command.v1', transaction_id: id(70), command_id: id(71),
        ...scope, actor_id: id(3), authority_version: 7, permission_code: 'airprop.opportunity.manage', module_code: 'airprop_commercial',
        evaluation_purpose: 'airprop.b2', aggregate_type: 'portfolio.unit', aggregate_id: id(9), aggregate_version: 1,
        provider_source_ids: [id(9)], idempotency_key: body.command.idempotency_key, input_fingerprint: 'sha256:' + hash },
      providers: { replay_policy: 'provider_current_state_required', replay_provider_code: 'negative-auth-only',
        async resolveAuthority() { assert.fail('AUTH_MUST_PRECEDE_PROVIDER'); }, async validateProviders() { assert.fail('NO_PROVIDER'); },
        async validateReplay() { assert.fail('NO_REPLAY'); }, async mutate() { assert.fail('NO_MUTATION'); } } };
    } } }));
  const route = r2Loader({ 'src/lib/supabase/server.ts': { createClient: async () => ({ auth: { getClaims: async () => ({ data: {
    claims: { sub: id(3), aal: state.outerAal } }, error: null }) } }) },
    'src/lib/airprop/listing-flow-api-v1.ts': api,
    'src/lib/airprop/listing-runtime-binding-v1.ts': { resolveListingRuntimeForRequest: resolver } })('src/app/api/customer/v2/airprop/listings/route.ts');
  const post = () => new NextRequest('https://cladora.test/api/customer/v2/airprop/listings', { method: 'POST',
    headers: { Origin: 'https://cladora.test', 'Content-Type': 'application/json' }, body: wire });
  return { f, state, sdk, route, post, body, wire };
}
await check('official verified AAL1 reaches real Listing route: predecessor502, successor403/MFA_REQUIRED', async () => {
  const x = await setup();
  const actualCore = x.f.load('src/lib/core/listing-command-binding-v1.ts').createCoreListingCommandBindingV1({ pool: x.f.pool, target });
  await assert.rejects(actualCore.bind(x.post()), e => e.code === 'MFA_REQUIRED');
  const r = await x.route.POST(x.post()); assert.equal(r.status, before ? 502 : 403);
  assert.deepEqual(await r.json(), { error: { code: before ? 'LISTING_RESULT_UNKNOWN' : 'MFA_REQUIRED' } });
  assert.equal(x.state.checkouts, 0); assert.equal(x.state.prepared, 0); assert.equal(x.f.x.calls.length, 0);
});
if (!before) {
  for (const kind of ['malformed claims', 'actor mismatch', 'SDK denial']) await check(kind + ' remains401 before preparation/SQL, not an MFA hint', async () => {
    const x = await setup();
    if (kind === 'malformed claims') { const get = x.sdk.auth.getClaims; x.sdk.auth.getClaims = async () => { const r = await get(); delete r.data.claims.session_id; return r; }; }
    if (kind === 'actor mismatch') x.sdk.auth.getUser = async () => ({ data: { user: { id: id(99) } }, error: null });
    if (kind === 'SDK denial') x.sdk.auth.getUser = async () => ({ data: { user: null }, error: Error('CONTROLLED_DENIAL') });
    const r = await x.route.POST(x.post()); assert.equal(r.status, 401); assert.deepEqual(await r.json(), { error: { code: 'UNAUTHORIZED' } });
    assert.equal(x.state.prepared, 0); assert.equal(x.state.checkouts, 0); assert.equal(x.f.x.calls.length, 0);
  });
  await check('AAL2 reaches absent canonical source503 only; it is not a positive native producer', async () => {
    const x = await setup(); x.f.x.aal = 'aal2'; const r = await x.route.POST(x.post());
    assert.equal(r.status, 503); assert.equal((await r.json()).error.code, 'LISTING_COMMAND_NOT_READY');
    assert.equal(x.state.prepared, 1); assert.equal(x.state.checkouts, 0); assert.equal(x.f.x.calls.length, 0);
  });
  await check('verified assurance drop after bind is403 before host checkout; original command/wire retained', async () => {
    const x = await setup(); x.f.x.aal = 'aal2'; x.state.dropAfterBind = true;
    const r = await x.route.POST(x.post()); assert.equal(r.status, 403); assert.equal((await r.json()).error.code, 'MFA_REQUIRED');
    assert.equal(x.state.prepared, 1); assert.equal(x.state.checkouts, 0); assert.equal(x.f.x.calls.length, 0);
    assert.deepEqual(JSON.parse(x.wire), x.body);
  });
  await check('AAL1 GET remains independent read, without command bind/preparation', async () => {
    const x = await setup(); x.state.outerAal = 'aal1'; x.f.x.rows = 0;
    const r = await x.route.GET(new NextRequest('https://cladora.test/api/customer/v2/airprop/listings?' + new URLSearchParams(scope)));
    assert.equal(r.status, 200); assert.deepEqual((await r.json()).listings, []); assert.equal(x.state.prepared, 0);
    assert.ok(x.f.x.calls.every(q => !/^\s*(insert|update|delete)\b|idempotency_keys|audit\.events|outbox_events/i.test(q.text)));
  });
}
globalThis.fetch = originalFetch;
console.log(JSON.stringify({ groups, proof: 'ACTUAL_ROUTE_BINDER_WITH_CONTROLLED_SDK_SQL', before: !!before,
  native_auth_login_mfa_db_browser: 'NOT_RUN_NOT_PASS', qfw_r2_01_source_closure: 'PRESERVED_NOT_RETESTED' }));
