/** Real Core, request Auth adapter and HTTP; controlled SDK, no DB/network. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve, dirname, extname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(process.argv[2] ?? fileURLToPath(new URL('../', import.meta.url)));
const require = createRequire(join(root, 'package.json'));
const ts = require('typescript');
const {NextRequest} = require('next/server');
const {parseCookieHeader} = require('@supabase/ssr');
const id = n => String(n).padStart(8, '0') + '-0000-4000-8000-' + String(n).padStart(12, '0');
const input = {context_id: id(1), workspace_id: id(2), offering_id: id(3),
  published_revision_id: id(4), beneficiary_party_id: id(5), resource: null,
  description: 'Controlled source boundary test', idempotency_key: 'synthetic-auth-boundary-command'};
const target = {contract: 'core-functional-development-target.v1', backend_id: 'core15-dev:' + 'a'.repeat(32),
  purpose: 'owned-isolated-persistent-development', host: '127.0.0.1', port: 55422,
  database_name: 'postgres', database_oid: 1234, runtime_role: 'cladora_core_runtime',
  auth_origin: 'http://127.0.0.1:55421'};

function fixture(mode) {
  const counts = {getUser: 0, getClaims: 0, poolCheckout: 0};
  const verified = {auth: {
    async getUser() {
      counts.getUser++;
      if (mode === 'transport') throw Error('private synthetic transport detail');
      return {data: {user: mode === 'anonymous' || mode === 'expired' ? null : {id: id(6)}},
        error: mode === 'expired' ? Error('expired synthetic token') : null};
    },
    async getClaims() {
      counts.getClaims++;
      return {data: {claims: mode === 'anonymous' || mode === 'expired' ? null : {
        sub: mode === 'mismatch' ? id(7) : id(6), session_id: id(8), role: 'authenticated',
        aal: 'aal2', exp: 2000000000}}, error: null};
    },
  }};
  const cache = new Map();
  function load(filename) {
    if (!extname(filename)) filename += '.ts';
    if (filename.endsWith('/src/lib/supabase/env.ts')) {
      return {getPublicSupabaseEnv: () => ({url: target.auth_origin, publishableKey: 'synthetic-public-key'})};
    }
    if (filename.endsWith('/src/lib/supabase/server.ts')) return {createClient: async () => verified};
    if (cache.has(filename)) return cache.get(filename).exports;
    const compiledModule = {exports: {}};
    cache.set(filename, compiledModule);
    if (filename.endsWith('.json')) {
      compiledModule.exports = JSON.parse(readFileSync(filename, 'utf8'));
      return compiledModule.exports;
    }
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {fileName: filename,
      compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
        esModuleInterop: true}}).outputText;
    function imports(name) {
      if (name === 'server-only') return {};
      // Keep the actual request-local cookie adapter and Core authenticate code.
      // Only the official SDK's Auth responses are controlled, not the verifier.
      if (name === '@supabase/ssr') return {parseCookieHeader, createServerClient: () => verified};
      if (name.startsWith('@/')) return load(resolve(root, 'src', name.slice(2)));
      if (name.startsWith('.')) return load(resolve(dirname(filename), name));
      return require(name);
    }
    new Function('require', 'module', 'exports', code)(imports, compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  const pool = {options: {host: target.host, port: target.port, database: target.database_name,
    user: target.runtime_role, connectionTimeoutMillis: 5000, query_timeout: 15000},
  async connect() { counts.poolCheckout++; throw Error('UNEXPECTED_DATABASE_CHECKOUT'); }};
  const core = load(join(root, 'src/lib/core/service-functional-binding-v1.ts'))
    .createCoreServiceFunctionalBindingV1({pool, target});
  const make = load(join(root, 'src/lib/customer/service-v14-execution/http.ts'))
    .createServiceOfferingRequestFlowHandlers;
  return {counts, core, make};
}
function post() {
  return new NextRequest('http://localhost:3008/api/customer/v1/services/offering-request-flow', {
    method: 'POST', headers: {origin: 'http://localhost:3008', 'content-type': 'application/json'},
    body: JSON.stringify(input),
  });
}
async function responseIs(response, status, code) {
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), {error: {code}});
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(response.headers.get('vary'), 'Cookie');
}
let checks = 0, failed = 0;
async function check(name, fn) {
  checks++;
  try { await fn(); console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + ': ' + error.message); }
}
for (const mode of ['anonymous', 'expired', 'mismatch', 'transport']) {
  await check(mode + ' actual Core/request-adapter error reaches correct HTTP class without DB checkout', async () => {
    const f = fixture(mode), request = post();
    let producerError;
    try { await f.core.bind(request); } catch (error) { producerError = error; }
    assert.ok(producerError);
    if (mode === 'anonymous' || mode === 'expired') assert.equal(producerError.code, 'AUTHENTICATION_REQUIRED');
    if (mode === 'mismatch') assert.equal(producerError.code, 'ACTOR_BINDING_MISMATCH');
    const response = await f.make(r => f.core.bind(r)).POST(request);
    assert.equal(f.counts.poolCheckout, 0);
    assert.ok(f.counts.getUser > 0 && f.counts.getClaims > 0);
    await responseIs(response, mode === 'transport' ? 503 : 401,
      mode === 'transport' ? 'RUNTIME_BINDING_INACTIVE' : 'UNAUTHORIZED');
  });
}
await check('genuinely inactive binding remains503 without Auth or DB invocation', async () => {
  const f = fixture('anonymous');
  await responseIs(await f.make(null).POST(post()), 503, 'RUNTIME_BINDING_INACTIVE');
  assert.deepEqual(f.counts, {getUser: 0, getClaims: 0, poolCheckout: 0});
});
await check('anonymous valid preflight GET propagates actual Core Auth denial as401', async () => {
  const f = fixture('anonymous');
  const params = new URLSearchParams(Object.fromEntries(Object.entries(input).filter(([key]) =>
    ['context_id', 'workspace_id', 'offering_id', 'published_revision_id'].includes(key))));
  const request = new NextRequest('http://localhost:3008/api/customer/v1/services/offering-request-flow?' + params);
  const response = await f.make(r => f.core.bind(r)).GET(request);
  assert.equal(f.counts.poolCheckout, 0);
  await responseIs(response, 401, 'UNAUTHORIZED');
});
console.log(JSON.stringify({checks, failed, proof: 'REAL_CORE_REQUEST_AUTH_ADAPTER_HTTP_CONTROLLED_SDK',
  native_Auth_DB: 'NOT_RUN'}));
if (failed) process.exitCode = 1;
