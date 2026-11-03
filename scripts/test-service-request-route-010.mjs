import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const cache = new Map();
const actorId = '10000000-0000-4000-8000-000000000001';
const contextId = '20000000-0000-4000-8000-000000000002';
const workspaceId = '30000000-0000-4000-8000-000000000003';
const id = '00000000-0000-0000-0000-000000000001';
const authenticated = () => ({ data: { claims: { sub: actorId } }, error: null });
let auth = authenticated();
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
const { GET, POST } = load(new URL('../src/app/api/customer/v1/services/requests/route.ts', import.meta.url));
const { NextRequest } = require('next/server');
const command = { context_id:id,workspace_id:id,offering_id:id,published_revision_id:id,beneficiary_party_id:id,description:'Synthetic request',idempotency_key:'request-010-001' };
const get = query => GET(new NextRequest(`https://cladora.test/api/customer/v1/services/requests?${query}`));
const post = (body = command, headers = {}, suffix = '') => POST(new NextRequest(`https://cladora.test/api/customer/v1/services/requests${suffix}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const readAuthorityOnly = process.argv.includes('--read-authority-only');
let cases = 0;
async function check(name, fn) {
  calls = [];
  auth = authenticated();
  result = { data: [], error: null };
  await fn(); cases++; console.log(`PASS ${name}`);
}
function assertPrivateHeaders(response) {
  assert.equal(response.headers.get('cache-control'), 'no-store, private');
  assert.equal(response.headers.get('pragma'), 'no-cache');
  assert.equal(response.headers.get('vary'), 'Cookie');
}
async function assertBoundedFailure(response, status, code) {
  assert.equal(response.status, status);
  assertPrivateHeaders(response);
  assert.deepEqual(await response.json(), { error: { code } });
}
await check('explicit tuple and no-store read gateway', async () => {
  const rows = [{ request_id: id, workspace_id: workspaceId }];
  result = { data: rows, error: null };
  const response = await get(`context_id=${contextId}&workspace_id=${workspaceId}`);
  assert.equal(response.status, 200); assertPrivateHeaders(response); assert.deepEqual(await response.json(), rows);
  assert.deepEqual(calls, [{ name: 'read_service_requests_v1', args: {
    p_context_id: contextId, p_workspace_id: workspaceId,
  } }]);
  assert.ok(calls.every(call => call.name === 'read_service_requests_v1'));
});
for (const query of ['', `context_id=${contextId}`, `workspace_id=${workspaceId}`,
  `context_id=${contextId}&workspace_id=bad`,
  `context_id=${contextId}&context_id=${contextId}&workspace_id=${workspaceId}`,
  `context_id=${contextId}&workspace_id=${workspaceId}&workspace_id=${workspaceId}`,
  `context_id=${contextId}&workspace_id=${workspaceId}&actor_id=${actorId}`,
  `context_id=${contextId}&workspace_id=${workspaceId}&tenant_id=${id}`,
  `context_id=${contextId}&workspace_id=${workspaceId}&authority_revision=7`]) {
  await check('invalid injected or duplicate query rejected', async () => {
    await assertBoundedFailure(await get(query), 400, 'INVALID_REQUEST');
    assert.deepEqual(calls, []);
  });
}
for (const [name, authResult] of [
  ['missing actor', { data: { claims: {} }, error: null }],
  ['Auth error with a subject present', { data: { claims: { sub: actorId } }, error: { message: 'private Auth failure' } }],
]) {
  await check(`${name} denies the read before RPC`, async () => {
    auth = authResult;
    await assertBoundedFailure(await get(`context_id=${contextId}&workspace_id=${workspaceId}`), 401, 'UNAUTHORIZED');
    assert.deepEqual(calls, []);
  });
}
for (const [code, status, publicCode] of [
  ['42501', 403, 'SERVICE_ACCESS_DENIED'],
  ['P0002', 404, 'SERVICE_NOT_FOUND'],
  ['40001', 409, 'SERVICE_CONFLICT'],
  ['23505', 409, 'SERVICE_CONFLICT'],
  ['22023', 400, 'INVALID_REQUEST'],
  ['22P02', 400, 'INVALID_REQUEST'],
  ['22003', 400, 'INVALID_REQUEST'],
  ['23514', 400, 'INVALID_REQUEST'],
  ['XX000', 500, 'SERVICE_QUERY_FAILED'],
]) {
  await check(`GET maps ${code} to bounded ${publicCode}`, async () => {
    result = { data: null, error: { code, message: 'private SQL internal details',
      details: `tenant=${id}`, hint: `source=${contextId}` } };
    const response = await get(`context_id=${contextId}&workspace_id=${workspaceId}`);
    await assertBoundedFailure(response, status, publicCode);
    assert.deepEqual(calls, [{ name: 'read_service_requests_v1', args: {
      p_context_id: contextId, p_workspace_id: workspaceId,
    } }]);
  });
}

if (!readAuthorityOnly) {
  await check('valid JSON writes only parsed request to canonical RPC', async () => { result = { data: { offering_id: id, status: 'draft' }, error: null }; assert.equal((await post()).status, 200); assert.deepEqual(calls, [{ name: 'create_service_request_v1', args: { p_request: command } }]); });
  for (const body of ['broken', { ...command, actor_id: id }, { ...command, tenant_id:id }, { kind: 'publish', request: command }, { ...command, workspace_id:null }]) {
    await check('malformed command or authority injection rejected', async () => { assert.equal((await post(body)).status, 400); assert.deepEqual(calls, []); });
  }
  await check('cross-origin write denied before RPC', async () => { assert.equal((await post(command, { origin: 'https://evil.test' })).status, 403); assert.deepEqual(calls, []); });
  await check('non-JSON write denied', async () => { assert.equal((await post(command, { 'content-type': 'text/plain' })).status, 400); assert.deepEqual(calls, []); });
  await check('query injection on mutation denied', async () => { assert.equal((await post(command, {}, '?actor_id=injected')).status, 400); assert.deepEqual(calls, []); });
  await check('unauthenticated reads and writes denied', async () => { auth = { data: null, error: null }; assert.equal((await post()).status, 401); assert.equal((await get(`context_id=${id}&workspace_id=${id}`)).status, 401); assert.deepEqual(calls, []); });
  for (const [code, status] of [['42501', 403], ['23505', 409], ['40001', 409], ['P0002', 404], ['22023', 400], ['22P02', 400], ['22003', 400], ['23514', 400], ['XX000', 500]]) {
    await check(`maps ${code} without leaking SQL details`, async () => { result = { data: null, error: { code, message: 'private SQL internal details', details: 'tenant secrets' } }; const response = await post(); assert.equal(response.status, status); assert.doesNotMatch(JSON.stringify(await response.json()), /private|tenant secrets/); assert.equal(response.headers.get('cache-control'), 'no-store, private'); });
  }
  await check('null mutation success is treated as server error', async () => { result = { data: null, error: null }; assert.equal((await post()).status, 500); });
}

console.log(`${cases} SERVICE request route ${readAuthorityOnly ? 'read-authority ' : ''}scenarios passed`);
