/** Actual profile handler and security helpers, controlled Auth/RPC; no live I/O. */
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve, join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url)));
const require = createRequire(join(root, 'package.json'));
const ts = require('typescript');
const {NextRequest} = require('next/server');
const profile = 'core-service-real-app-assembly.v1';
const actor = '11111111-1111-4111-8111-111111111111';
let checks = 0, failed = 0;
async function check(name, fn) {
  checks++;
  try { await fn(); console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}
function fixture({privateProfile = profile, publicProfile = 'v1', metadata = {},
  email = 'self@example.invalid', user = true, authError = null, thrownAuth = null,
  rpcError = null, claims = true} = {}) {
  const env = {};
  if (typeof privateProfile === 'string') env.CLADORA_CORE_SERVICE_ASSEMBLY_PROFILE = privateProfile;
  if (typeof publicProfile === 'string') env.NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY = publicProfile;
  const calls = {user: 0, claims: 0, schema: [], rpc: []};
  const client = {
    auth: {
      async getUser() {
        calls.user++;
        if (thrownAuth) throw thrownAuth;
        return {data: {user: user ? {id: actor, email, user_metadata: metadata} : null}, error: authError};
      },
      async getClaims() { calls.claims++; return {data: {claims: claims ? {sub: actor} : null}, error: null}; },
      getSession() { throw Error('Unverified cached session must not supply profile identity'); },
    },
    schema(name) {
      calls.schema.push(name);
      if (privateProfile === profile) throw Error('Owned profile called unavailable legacy schema');
      assert.equal(name, 'customer_api');
      return {async rpc(name, args) {
        calls.rpc.push({name, args});
        return {data: {display_name: 'Stored profile', locale: 'ro', timezone: 'Europe/Bucharest'}, error: rpcError};
      }};
    },
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const compiledModule = {exports: {}};
    cache.set(filename, compiledModule.exports);
    function resolveImport(id) {
      if (id === '@/lib/supabase/server') return {createClient: async () => client};
      if (id.startsWith('@/') || id.startsWith('.')) {
        const base = id.startsWith('@/') ? join(root, 'src', id.slice(2)) : resolve(dirname(filename), id);
        const target = [base, base + '.ts', base + '.tsx'].find(p => existsSync(p));
        if (target) return load(target);
      }
      return require(id);
    }
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {fileName: filename,
      compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
    new Function('require', 'module', 'exports', 'process', code)(resolveImport, compiledModule,
      compiledModule.exports, {env});
    cache.set(filename, compiledModule.exports);
    return compiledModule.exports;
  }
  return {route: load(join(root, 'src/app/api/customer/v1/profile/route.ts')), calls};
}
async function own(options = {}, expectedName = 'self@example.invalid', expectedLocale = null, expectedTimezone = null) {
  const f = fixture(options);
  const response = await f.route.GET(new NextRequest('http://localhost:3008/api/customer/v1/profile?actor_id=other'));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {email: options.email ?? 'self@example.invalid',
    display_name: expectedName, locale: expectedLocale, timezone: expectedTimezone});
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(response.headers.get('vary'), 'Cookie');
  assert.equal(f.calls.user, 1);
  assert.deepEqual(f.calls.schema, []);
  assert.deepEqual(f.calls.rpc, []);
}

await check('owned self email works despite unavailable legacy RPC and caller actor_id', () => own());
await check('display_name has presentation precedence and is trimmed', () =>
  own({metadata: {display_name: '  نام واقعی  ', full_name: 'Other'}}, 'نام واقعی'));
await check('blank display_name uses real full_name', () =>
  own({metadata: {display_name: '  ', full_name: '  Nume  '}}, 'Nume'));
for (const [name, metadata] of [['absent', undefined], ['null', null], ['scalar', 12],
  ['wrong field types', {display_name: {role: 'admin'}, full_name: ['not a string']}],
  ['empty names', {display_name: '', full_name: '  '}]]) {
  await check(name + ' metadata falls back to actual self email', () => own({metadata}));
}
await check('metadata role, tenant, token and session fields are never output or queried', () =>
  own({metadata: {role: 'admin', tenant_id: 'other', access_token: 'synthetic-secret', session_id: 'other'}}));
await check('locale/timezone are optional self presentation strings, not stored profile claims', () =>
  own({metadata: {locale: ' fa ', timezone: ' Asia/Tehran '}}, 'self@example.invalid', 'fa', 'Asia/Tehran'));
await check('invalid locale/timezone types become null', () =>
  own({metadata: {locale: {language: 'fa'}, timezone: ['UTC']}}));
await check('absent email creates no fictional identity or profile', () => own({email: ''}, ''));
for (const [name, options] of [['no authenticated user', {user: false}],
  ['Auth error even when user data is present', {authError: Error('expired')}],
  ['Auth error without user', {user: false, authError: Error('expired')}]]) {
  await check(name + ' gives401 with no legacy read', async () => {
    const f = fixture(options), response = await f.route.GET();
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {error: {code: 'UNAUTHORIZED'}});
    assert.deepEqual(f.calls.schema, []);
  });
}
await check('thrown Auth failure cannot become successful fallback', async () => {
  const error = Error('controlled Auth transport failure'), f = fixture({thrownAuth: error});
  await assert.rejects(() => f.route.GET(), e => e === error);
  assert.deepEqual(f.calls.schema, []);
});
for (const [name, privateProfile, publicProfile] of [['public-only', null, 'v1'],
  ['no markers', null, null], ['wrong private marker', 'another-profile', 'v1']]) {
  await check(name + ' keeps stored profile and ignores user-edited Auth label', async () => {
    const f = fixture({privateProfile, publicProfile, metadata: {display_name: 'Editable Auth label'}});
    const response = await f.route.GET();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {email: 'self@example.invalid',
      display_name: 'Stored profile', locale: 'ro', timezone: 'Europe/Bucharest'});
    assert.deepEqual(f.calls.rpc, [{name: 'my_profile_v1', args: undefined}]);
  });
}
for (const code of ['PGRST106', '42883', '42501']) {
  await check('standard RPC error ' + code + ' remains HTTP500 without private error leak', async () => {
    const f = fixture({privateProfile: null, rpcError: {code, message: 'private database detail'}});
    const response = await f.route.GET();
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {error: {code: 'PROFILE_UNAVAILABLE'}});
  });
}
function mutation({origin = 'http://localhost:3008', contentType = 'application/json', body = '{"display_name":"New name"}'} = {}) {
  return new NextRequest('http://localhost:3008/api/customer/v1/profile', {method: 'PUT',
    headers: {origin, host: 'localhost:3008', 'content-type': contentType}, body});
}
for (const [name, options, status] of [['origin', {origin: 'https://other.invalid'}, 403],
  ['media type', {contentType: 'text/plain'}, 415], ['schema', {body: '{"display_name":"x"}'}, 400],
  ['extra actor field', {body: '{"display_name":"Valid name","actor_id":"other"}'}, 400],
  ['actual oversized body', {body: JSON.stringify({display_name: 'x'.repeat(4200)})}, 413]]) {
  await check('PUT ' + name + ' guard rejects before Auth or database', async () => {
    const f = fixture({privateProfile: null});
    assert.equal((await f.route.PUT(mutation(options))).status, status);
    assert.equal(f.calls.claims, 0);
    assert.deepEqual(f.calls.schema, []);
  });
}
await check('PUT without verified claims stays401', async () => {
  const f = fixture({privateProfile: null, claims: false});
  assert.equal((await f.route.PUT(mutation())).status, 401);
  assert.deepEqual(f.calls.schema, []);
});
await check('standard valid PUT preserves exact canonical RPC arguments', async () => {
  const f = fixture({privateProfile: null});
  assert.equal((await f.route.PUT(mutation({body: '{"display_name":"  Valid name  "}'}))).status, 200);
  assert.deepEqual(f.calls.rpc, [{name: 'update_my_profile_v1', args: {p_display_name: 'Valid name'}}]);
});
console.log(JSON.stringify({checks, failed, evidence: 'ACTUAL_HANDLER_CONTROLLED_AUTH_RPC', native: 'NOT_RUN'}));
if (failed) process.exitCode = 1;
