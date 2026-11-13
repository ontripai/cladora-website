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
const integrationOnly = process.argv.includes('--integration-only');
const originalFetch = globalThis.fetch; globalThis.fetch = async () => { throw Error('REAL_NETWORK_FORBIDDEN'); };
let groups = 0;
const caseFilter = process.argv.includes('--case') ? process.argv[process.argv.indexOf('--case') + 1] : '';
const check = async (name, run) => { if (caseFilter && !name.includes(caseFilter)) return; await run(); console.log('PASS', ++groups, name); };
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
      if (state.prepareFault) throw state.prepareFault;
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
  return { f, state, sdk, route, post, body, wire, api };
}
if (!integrationOnly) {
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
}
if (integrationOnly) {
  const get = () => new NextRequest('https://cladora.test/api/customer/v2/airprop/listings?' + new URLSearchParams(scope));
  async function composition(error) {
    const x = await setup(); let resolved = 0;
    const binder = x.f.load('src/lib/core/listing-command-binding-v1.ts').createCoreListingCommandBindingV1({ pool: x.f.pool, target });
    const http = x.api.createListingFlowApi({ session: async () => ({ actor_id: id(3), aal: x.state.outerAal }), read: null, control: null,
      resolveRuntime: async (_session, _scope, request) => {
        resolved++; if (error) throw error;
        await binder.bind(request); assert.fail('GENUINE_AAL1_MUST_STOP');
      } });
    return { ...x, http, resolved: () => resolved };
  }
  for (const method of ['GET', 'POST']) await check(method + ' actual ae1 binder MFA at resolver: predecessor unavailable/unknown ->403 MFA_REQUIRED', async () => {
    const x = await composition(), r = await x.http[method](method === 'GET' ? get() : x.post());
    assert.equal(r.status, before ? (method === 'GET' ? 503 : 502) : 403);
    assert.equal((await r.json()).error.code, before ? (method === 'GET' ? 'LISTING_READ_UNAVAILABLE' : 'LISTING_RESULT_UNKNOWN') : 'MFA_REQUIRED');
    assert.equal(x.resolved(), 1); assert.equal(x.state.checkouts, 0); assert.equal(x.state.prepared, 0); assert.equal(x.f.x.calls.length, 0);
  });
  await check('QA direct outer AAL1 POST control stops before resolver', async () => {
    const x = await composition(); x.state.outerAal = 'aal1'; const r = await x.http.POST(x.post());
    assert.equal(r.status, 403); assert.equal((await r.json()).error.code, 'MFA_REQUIRED'); assert.equal(x.resolved(), 0);
    assert.equal(x.state.checkouts, 0);
  });
  if (!before) {
    await check('message/JSON/lookalike/getter/inherited MFA are not trusted; raw40001 and COMMIT ACK stay uncertain', async () => {
      const x = await setup(), CoreError = x.f.load('src/lib/core/functional-command-runtime-v1.ts').CoreFunctionalRuntimeUnavailableV1;
      let getterCalls = 0;
      const getter = new CoreError('MFA_REQUIRED'); Object.defineProperty(getter, 'code', { get() { getterCalls++; return 'MFA_REQUIRED'; } });
      const inherited = new CoreError('MFA_REQUIRED'); delete inherited.code;
      Object.setPrototypeOf(inherited, Object.assign(Object.create(CoreError.prototype), { code: 'MFA_REQUIRED' }));
      const errors = [new Error('MFA_REQUIRED'), { name: 'CoreFunctionalRuntimeUnavailableV1', code: 'MFA_REQUIRED' },
        Object.assign(new Error('lookalike'), { name: 'CoreFunctionalRuntimeUnavailableV1', code: 'MFA_REQUIRED' }), getter, inherited,
        Object.assign(new Error('serialization'), { code: '40001' }), new Error('COMMIT acknowledgement lost')];
      for (const error of errors) for (const method of ['GET', 'POST']) {
        const y = await composition(error), r = await y.http[method](method === 'GET' ? get() : y.post());
        assert.equal(r.status, method === 'GET' ? 503 : 502);
        assert.equal((await r.json()).error.code, method === 'GET' ? 'LISTING_READ_UNAVAILABLE' : 'LISTING_RESULT_UNKNOWN');
        assert.equal(y.state.checkouts, 0);
      }
      assert.equal(getterCalls, 0);
    });
    await check('actual request-local bridge accepts own typed MFA only, never accessor code', async () => {
      for (const kind of ['own', 'getter']) {
        const x = await setup(); x.f.x.aal = 'aal2';
        const CoreError = x.f.load('src/lib/core/functional-command-runtime-v1.ts').CoreFunctionalRuntimeUnavailableV1;
        const error = new CoreError('MFA_REQUIRED'); let getterCalls = 0;
        if (kind === 'getter') Object.defineProperty(error, 'code', { get() { getterCalls++; return 'MFA_REQUIRED'; } });
        x.state.prepareFault = error; const r = await x.route.POST(x.post());
        assert.equal(r.status, kind === 'own' ? 403 : 502);
        assert.equal((await r.json()).error.code, kind === 'own' ? 'MFA_REQUIRED' : 'LISTING_RESULT_UNKNOWN');
        assert.equal(getterCalls, 0); assert.equal(x.state.checkouts, 0); assert.equal(x.state.prepared, 1);
      }
    });
    await check('mounted lost reply/reload + genuine GET/POST MFA retains exact UNKNOWN custody and no auto dispatch', async () => {
      const { default: React, act } = await import('react'); const { JSDOM } = await import('jsdom');
      const dom = new JSDOM('<div id="root"></div>', { url: 'https://cladora.test' }), saved = new Map();
      for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true })) {
        saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key)); Object.defineProperty(globalThis, key, { value, configurable: true, writable: true });
      }
      const { createRoot } = await import('react-dom/client'), root = createRoot(document.getElementById('root'));
      const context = { useCustomerContext: () => ({ active: { ...scope, membership_id: id(40) }, loading: false, error: null, registerUnsavedGuard: () => () => {} }) };
      const Component = r2Loader({ 'src/components/customer/CustomerContextProvider.ts': context })('src/components/customer/CustomerAirpropListings.tsx').CustomerAirpropListings;
      const model = fixture(), x = await composition(); let mode = 'lost', posts = [], serial = 0;
      const button = text => Array.from(document.querySelectorAll('button')).find(b => b.textContent === text);
      const click = async el => { assert.ok(el); await act(async () => el.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))); };
      const render = () => act(async () => root.render(React.createElement(Component, { key: ++serial, lang: 'ro', contextId: scope.context_id, workspaceId: scope.workspace_id, membershipId: id(40), registerDraftGuard: () => () => {} })));
      globalThis.fetch = async (url, options = {}) => {
        assert.ok(String(url).startsWith('/api/customer/v2/airprop/listings'));
        if (options.method === 'POST') {
          posts.push(options.body); if (mode === 'lost') throw Error('CONTROLLED_LOST_REPLY');
          return x.http.POST(new NextRequest('https://cladora.test' + url, { ...options, headers: { Origin: 'https://cladora.test', ...options.headers } }));
        }
        const req = new NextRequest('https://cladora.test' + url);
        return mode === 'mfa-get' ? x.http.GET(req) : model.api.GET(req);
      };
      try {
        await render(); await act(async () => { const el = document.querySelector('select'); el.value = id(30); el.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
        await act(async () => { const el = document.querySelectorAll('input')[2]; Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(el, 'Motiv sintetic păstrat'); el.dispatchEvent(new dom.window.Event('input', { bubbles: true })); });
        await click(button('Salvează perioada')); assert.equal(posts.length, 1);
        const key = sessionStorage.key(0), raw = sessionStorage.getItem(key), original = posts[0];
        assert.equal(JSON.parse(raw).wire, original); assert.equal(JSON.parse(raw).state, 'uncertain');
        mode = 'mfa-get'; await render(); assert.equal(posts.length, 1); assert.equal(sessionStorage.getItem(key), raw);
        await click(button('Verifică din nou')); assert.equal(posts.length, 1); assert.equal(sessionStorage.getItem(key), raw);
        mode = 'mfa-post'; await click(button('Verifică din nou')); await click(button('Reîncearcă aceeași cerere'));
        assert.equal(posts.length, 2); assert.equal(posts[1], original); assert.equal(sessionStorage.getItem(key), raw);
        await render(); assert.equal(posts.length, 2); assert.equal(sessionStorage.getItem(key), raw);
        assert.equal(model.state.writes, 0); assert.equal(x.state.checkouts, 0); assert.equal(x.f.x.calls.length, 0);
      } finally {
        await act(async () => root.unmount()); dom.window.close(); globalThis.fetch = async () => { throw Error('REAL_NETWORK_FORBIDDEN'); };
        for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key]; }
      }
    });
  }
}
globalThis.fetch = originalFetch;
console.log(JSON.stringify({ groups, proof: 'ACTUAL_ROUTE_BINDER_WITH_CONTROLLED_SDK_SQL', before: !!before,
  native_auth_login_mfa_db_browser: 'NOT_RUN_NOT_PASS', qfw_r2_01_source_closure: 'PRESERVED_NOT_RETESTED' }));
