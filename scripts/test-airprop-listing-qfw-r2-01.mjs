// QFW-R2-01 only: QA's two source witnesses and affected HTTP classifications.
// Real owner/Core code; controlled SDK/SQL. No native Auth/PG/runtime/browser.
import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import ts from 'typescript';
import { createAirpropR2ReadFixture } from './lib/airprop-r2-test-fixture.mjs';
import { id, scope, fixture } from './lib/airprop-listing-flow-test-fixture.mjs';
const require = createRequire(import.meta.url), { NextRequest } = require('next/server');
const originalFetch = globalThis.fetch; globalThis.fetch = async () => { throw Error('NATIVE_NETWORK_FORBIDDEN'); };
const before = process.argv.includes('--before') ? process.argv[process.argv.indexOf('--before') + 1] : null;
const only = process.argv.includes('--case') ? process.argv[process.argv.indexOf('--case') + 1] : '';
let groups = 0;
const check = async (name, run) => { if (only && !name.includes(only)) return; await run(); console.log('PASS', ++groups, name); };
const get = () => new NextRequest('https://cladora.test/api/customer/v2/airprop/listings?' + new URLSearchParams(scope));
const post = body => new NextRequest('https://cladora.test/api/customer/v2/airprop/listings', { method: 'POST',
  headers: { Origin: 'https://cladora.test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const session = async () => ({ actor_id: id(3), aal: 'aal2' });
function apiFactory(f) {
  if (!before) return f.load('src/lib/airprop/listing-flow-api-v1.ts').createListingFlowApi;
  const mod = new Module(resolve('src/lib/airprop/listing-flow-api-v1.ts')); mod.filename = mod.id;
  mod.require = name => name.startsWith('.') ? f.load(resolve(dirname(mod.filename), name)) : require(name);
  mod._compile(ts.transpileModule(readFileSync(before, 'utf8'), { fileName: mod.filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText, mod.filename); return mod.exports.createListingFlowApi;
}
async function failure(response, expected) {
  assert.equal(response.status, expected);
  assert.match(response.headers.get('cache-control'), /no-store/);
  assert.equal(response.headers.get('x-cladora-listing-actor'), null);
  const body = await response.json(); assert.deepEqual(Object.keys(body), ['error']);
  assert.doesNotMatch(JSON.stringify(body), /PRIVATE_|CONTROLLED_|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/);
  return body;
}
await check('QA AUTH-LISTING-CORE-HOST: outer session exists, real host rejects issuer SDK before checkout', async () => {
  const f = createAirpropR2ReadFixture(); let checkouts = 0;
  f.auth.auth.getUser = async () => ({ data: { user: null }, error: Error('PRIVATE_CONTROLLED_ISSUER_FAILURE') });
  f.pool.connect = async () => { checkouts++; throw Error('SQL_FORBIDDEN'); };
  const api = apiFactory(f)({ session, read: async (actor, selected) => f.host.withScope(actor, selected, async () => []), control: null });
  const body = await failure(await api.GET(get()), before ? 403 : 401);
  assert.equal(body.error.code, before ? 'LISTING_READ_UNAVAILABLE' : 'UNAUTHORIZED'); assert.equal(checkouts, 0);
});
await check('QA MISSING-LISTING-CANONICAL: actual native reader with null producer and exact QA host negative', async () => {
  const f = createAirpropR2ReadFixture();
  const read = f.native.createListingNativeReadV1({ withScope: async () => { throw Error('MUST_NOT_ENTER_SQL'); } }, null);
  const api = apiFactory(f)({ session, read, control: null });
  await failure(await api.GET(get()), before ? 403 : 503); assert.equal(f.x.calls.length, 0);
});
if (!before) {
  await check('genuine R2 host + selector reaches absent companion and remains503 without command effects', async () => {
    const f = createAirpropR2ReadFixture(), api = apiFactory(f)({ session,
      read: f.native.createListingNativeReadV1(f.host, null), control: null });
    const body = await failure(await api.GET(get()), 503); assert.equal(body.error.code, 'LISTING_SOURCE_NOT_READY');
    assert.ok(f.x.calls.some(q => q.text === f.q.spec));
    assert.ok(f.x.calls.every(q => !/^\s*(insert|update|delete)\b|idempotency_keys|audit\.events|outbox_events/i.test(q.text)));
  });
  const f = createAirpropR2ReadFixture(), make = apiFactory(f);
  const { CoreReadHostUnavailableV1: ReadFailure } = f.core;
  const { CoreFunctionalRuntimeUnavailableV1: RuntimeFailure } = f.load('src/lib/core/functional-command-runtime-v1.ts');
  const { ListingSourceReadUnavailable: SourceFailure } = f.load('src/lib/airprop/listing-flow-read-v1.ts');
  const command = await fixture().command();
  const cases = [
    ['Core read Auth', () => new ReadFailure('AUTHENTICATION_REQUIRED'), 401, 401],
    ['Core command Auth', () => new RuntimeFailure('AUTHENTICATION_REQUIRED'), 401, 401],
    ['Core actor mismatch', () => new ReadFailure('ACTOR_BINDING_MISMATCH'), 401, 401],
    ['Core explicit scope denial', () => new ReadFailure('SCOPE_DENIED'), 403, 403],
    ['Core runtime scope denial', () => new RuntimeFailure('SCOPE_DENIED'), 403, 403],
    ['domain selector denial', () => new SourceFailure('SELECTOR_DENIED'), 403, 403],
    ['actual missing host', () => new ReadFailure('HOST_NOT_READY'), 503, 503],
    ['actual unavailable principal', () => new ReadFailure('PRINCIPAL_PROFILE_NOT_READY'), 503, 503],
    ['actual missing canonical producer', () => new SourceFailure('CANONICAL_PRODUCER_NOT_READY'), 503, 503],
    ['runtime preparation unavailable', () => new RuntimeFailure('POOL_BINDING_MISMATCH'), 503, 503],
    ['unknown private error', () => Error('PRIVATE_UNCLASSIFIED_FAILURE'), 503, 502],
    ['raw serialization failure', () => Object.assign(Error('PRIVATE_SERIALIZATION'), { code: '40001' }), 503, 502],
    ['unknown COMMIT acknowledgment', () => new RuntimeFailure('COMMIT_ACK_UNKNOWN'), 503, 502],
    ['driver permission code is not business-denial evidence', () => Object.assign(Error('PRIVATE_DRIVER'), { code: '42501' }), 503, 502],
    ['code/name lookalike is not genuine Core Auth', () => Object.assign(Error('PRIVATE_LOOKALIKE'), { name: 'CoreReadHostUnavailableV1', code: 'AUTHENTICATION_REQUIRED' }), 503, 502],
    ['plain JSON Auth code is not issuer evidence', () => ({ code: 'AUTHENTICATION_REQUIRED' }), 503, 502],
  ];
  for (const [name, build, readStatus, postStatus] of cases) await check('shared GET/POST direct control: ' + name, async () => {
    for (const phase of ['session', 'resolver', 'operation']) {
      const error = build(), descriptor = error instanceof Error ? Object.getOwnPropertyDescriptor(error, 'code') : null;
      const api = make({ session: phase === 'session' ? async () => { throw error; } : session,
        read: async () => { throw error; }, control: async () => { throw error; },
        ...(phase === 'resolver' ? { resolveRuntime: async () => { throw error; } } : {}) });
      await failure(await api.GET(get()), readStatus); await failure(await api.POST(post(command)), postStatus);
      if (descriptor) assert.deepEqual(Object.getOwnPropertyDescriptor(error, 'code'), descriptor);
    }
  });
  await check('accessor error fields are never invoked or promoted to Auth/denial', async () => {
    let reads = 0; const error = Error('PRIVATE_ACCESSOR');
    Object.defineProperty(error, 'code', { get() { reads++; return 'AUTHENTICATION_REQUIRED'; } });
    Object.defineProperty(error, 'name', { get() { reads++; return 'CoreReadHostUnavailableV1'; } });
    const api = make({ session, read: async () => { throw error; }, control: async () => { throw error; } });
    await failure(await api.GET(get()), 503); await failure(await api.POST(post(command)), 502); assert.equal(reads, 0);
  });
  await check('real host40001 and lost read COMMIT keep original error/settlement and discard all values', async () => {
    for (const fault of ['selector', 'commit']) {
      const x = createAirpropR2ReadFixture(), error = Object.assign(Error('PRIVATE_FAULT'), { code: fault === 'selector' ? '40001' : '08006' });
      x.x.fault = { sql: fault === 'selector' ? x.q.spec : 'commit', error };
      const api = apiFactory(x)({ session, read: x.native.createListingNativeReadV1(x.host, x.producer), control: null });
      await failure(await api.GET(get()), 503);
      const metadata = x.core.coreReadFailureInfoV1(error); assert.ok(metadata);
      assert.equal(metadata.settlement, fault === 'commit' ? 'unknown' : 'rolled_back'); assert.equal(x.x.fault.error, error);
    }
  });
  await check('direct null/session/producer controls and positive binding/actions remain unchanged', async () => {
    await failure(await make({ session: async () => null, read: null, control: null }).GET(get()), 401);
    await failure(await make({ session, read: null, control: null }).GET(get()), 503);
    const x = fixture(); const positive = await x.api.GET(get()); assert.equal(positive.status, 200);
    const value = await positive.json(); assert.equal(value.listings[0].binding_state, 'bound'); assert.equal(value.can_edit, true);
    x.state.readDenied = true; await failure(await x.api.GET(get()), 403);
  });
  await check('explicit command UNKNOWN and malformed receipt stay uncertain; guards still precede dispatch', async () => {
    let calls = 0;
    const api = make({ session, read: null, control: async () => { calls++; return { status: 'unknown_commit' }; } });
    const unknown = await failure(await api.POST(post(command)), 409); assert.equal(unknown.error.code, 'READBACK_REQUIRED');
    const invalid = make({ session, read: null, control: async () => ({ status: 'receipt', value: {} }) });
    await failure(await invalid.POST(post(command)), 502);
    assert.equal((await api.POST(post({}))).status, 400); assert.equal(calls, 1);
  });
}
globalThis.fetch = originalFetch;
console.log(JSON.stringify({ groups, witness_mode: before ? 'BEFORE_BOTH_403_REPRODUCED' : 'SUCCESSOR_BOUNDED_CATEGORIES',
  native_sql_auth_browser: 'NOT_RUN_NOT_PASS', post_review: 'RELATED_QFW_R2_01_NOT_A_SEPARATE_FINDING' }));
