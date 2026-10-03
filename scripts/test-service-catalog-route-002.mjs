import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const cache = new Map();
let auth = { data: { claims: { sub: 'actor' } }, error: null };
let result = { data: [], error: null };
let calls = [];
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const filename = fileURLToPath(file);
  const mod = new Module(filename);
  mod.require = name => name === '@/lib/supabase/server' ? { createClient: async () => ({
    auth: { getClaims: async () => auth }, schema: name => { assert.equal(name, 'customer_api'); return { rpc: async (name, args) => { calls.push({ name, args }); return result; } }; },
  }) } : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url))
    : name.startsWith('.') ? load(new URL(`${name}.ts`, file)) : require(name);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
  cache.set(file.href, mod.exports); return mod.exports;
}
const { GET, POST } = load(new URL('../src/app/api/customer/v1/services/catalog/route.ts', import.meta.url));
const { NextRequest } = require('next/server');
const id = '00000000-0000-0000-0000-000000000001';
const labels = { ro: 'Serviciu', en: 'Service', fa: 'خدمت' };
const command = { kind: 'create', request: { context_id: id, workspace_id: id, definition_id: id, provider_party_id: id,
  revision: { labels, description: labels, acquisition_mode: 'direct', price: { kind: 'fixed', amount: '120.50', currency: 'RON', tax_display: 'included' }, valid_from: '2026-01-01T00:00:00Z', valid_until: null, cancellation_terms: labels, acceptance_criteria: labels, document_version_ids: [] }, idempotency_key: 'service-001' } };
const get = query => GET(new NextRequest(`https://cladora.test/api/customer/v1/services/catalog?${query}`));
const post = (body = command, headers = {}, suffix = '') => POST(new NextRequest(`https://cladora.test/api/customer/v1/services/catalog${suffix}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
let cases = 0;
async function check(name, fn) { calls = []; await fn(); cases++; console.log(`PASS ${name}`); }
await check('explicit tuple and no-store read gateway', async () => {
  const response = await get(`context_id=${id}&workspace_id=${id}`); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { offerings: [] });
  assert.equal(response.headers.get('cache-control'), 'no-store, private'); assert.equal(response.headers.get('vary'), 'Cookie');
  assert.deepEqual(calls, [{ name: 'list_service_catalog_v1', args: { p_context_id: id, p_workspace_id: id } }]);
});
for (const query of ['', `context_id=${id}`, `workspace_id=${id}`, `context_id=${id}&workspace_id=bad`, `context_id=${id}&workspace_id=${id}&workspace_id=${id}`, `context_id=${id}&workspace_id=${id}&tenant_id=${id}`]) {
  await check('invalid injected or duplicate query rejected', async () => { assert.equal((await get(query)).status, 400); assert.deepEqual(calls, []); });
}
await check('valid JSON writes only parsed request to canonical RPC', async () => { result = { data: { offering_id: id, status: 'draft' }, error: null }; assert.equal((await post()).status, 200); assert.deepEqual(calls, [{ name: 'mutate_service_catalog_v1', args: { p_kind: 'create', p_request: command.request } }]); });
for (const body of ['broken', { ...command, actor_id: id }, { ...command, request: { ...command.request, tenant_id: id } }, { kind: 'publish', request: command.request }, { ...command, request: { ...command.request, workspace_id: null } }]) {
  await check('malformed command or authority injection rejected', async () => { assert.equal((await post(body)).status, 400); assert.deepEqual(calls, []); });
}
await check('cross-origin write denied before RPC', async () => { assert.equal((await post(command, { origin: 'https://evil.test' })).status, 403); assert.deepEqual(calls, []); });
await check('non-JSON write denied', async () => { assert.equal((await post(command, { 'content-type': 'text/plain' })).status, 400); assert.deepEqual(calls, []); });
await check('query injection on mutation denied', async () => { assert.equal((await post(command, {}, '?actor_id=injected')).status, 400); assert.deepEqual(calls, []); });
await check('attachment contract limitation is explicit', async () => { assert.equal((await post({ ...command, request: { ...command.request, revision: { ...command.request.revision, document_version_ids: [id] } } })).status, 422); assert.deepEqual(calls, []); });
await check('unauthenticated reads and writes denied', async () => { auth = { data: null, error: null }; assert.equal((await post()).status, 401); assert.equal((await get(`context_id=${id}&workspace_id=${id}`)).status, 401); assert.deepEqual(calls, []); auth = { data: { claims: { sub: 'actor' } }, error: null }; });
for (const [code, status] of [['42501', 403], ['23505', 409], ['40001', 409], ['P0002', 404], ['22023', 400], ['22P02', 400], ['22003', 400], ['23514', 400], ['XX000', 500]]) {
  await check(`maps ${code} without leaking SQL details`, async () => { result = { data: null, error: { code, message: 'private SQL internal details', details: 'tenant secrets' } }; const response = await post(); assert.equal(response.status, status); assert.doesNotMatch(JSON.stringify(await response.json()), /private|tenant secrets/); assert.equal(response.headers.get('cache-control'), 'no-store, private'); });
}
await check('null mutation success is treated as server error', async () => { result = { data: null, error: null }; assert.equal((await post()).status, 500); });
const definitions = load(new URL('../src/app/api/customer/v1/services/catalog/definitions/route.ts', import.meta.url));
const definition = { context_id: id, workspace_id: id, code: 'cleaning', labels, idempotency_key: 'define-001' };
const define = body => definitions.POST(new NextRequest('https://cladora.test/api/customer/v1/services/catalog/definitions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
await check('definition command uses authenticated exact tuple RPC', async () => {
  result = { data: { definition_id: id, code: 'cleaning', labels }, error: null };
  assert.equal((await define(definition)).status, 200);
  assert.deepEqual(calls, [{ name: 'create_service_definition_v1', args: { p_request: definition } }]);
});
for (const body of ['broken', { ...definition, tenant_id: id }, { ...definition, code: 'Invalid Code' }, { ...definition, labels: { ro: 'x', en: 'x' } }]) {
  await check('definition command rejects malformed fields and authority injection', async () => { assert.equal((await define(body)).status, 400); assert.deepEqual(calls, []); });
}
await check('definition read uses scoped RPC with private cache headers', async () => {
  result = { data: [], error: null };
  const response = await definitions.GET(new NextRequest(`https://cladora.test/api/customer/v1/services/catalog/definitions?context_id=${id}&workspace_id=${id}`));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { definitions: [] }); assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.deepEqual(calls, [{ name: 'list_service_definitions_v1', args: { p_context_id: id, p_workspace_id: id } }]);
});
await check('definition auth absence never reaches database', async () => { auth = { data: null, error: null }; assert.equal((await define(definition)).status, 401); assert.deepEqual(calls, []); });
console.log(`${cases} SERVICE catalogue route cases passed`);
