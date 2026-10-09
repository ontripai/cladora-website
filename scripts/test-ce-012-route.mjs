import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
let authenticated = true;
let result = { data: { version: 1, replayed: false }, error: null };
let calls = [];
let checks = 0;
function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const mod = new Module(fileURLToPath(file));
  mod.require = (name) => name === '@/lib/supabase/server' ? { createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: authenticated ? { sub: id(1) } : {} }, error: null }) },
    schema: (schema) => {
      assert.equal(schema, 'customer_api');
      return { rpc: async (name, args) => { calls.push({ name, args }); return result; } };
    },
  }) } : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url))
    : name.startsWith('.') ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, file)) : require(name);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, fileURLToPath(file));
  cache.set(file.href, mod.exports);
  return mod.exports;
}
const { GET, POST } = load(new URL('../src/app/api/customer/v1/experience/guides/route.ts', import.meta.url));
const { NextRequest } = require('next/server');
const id = (n) => `17400000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const reference = { target_type: 'document', target_id: id(9), label: 'Approved document' };
const steps = [{ id: id(8), title: 'Arrival', body: 'Follow the approved guidance.', references: [reference] }];
const base = { command_id: id(10), idempotency_key: 'ce012.route.test', context_id: id(3), workspace_id: id(4), guide_id: id(5), expected_version: 1, reason: 'Synthetic CE guide command' };
const commands = [
  { ...base, type: 'create_guide', expected_version: 0, title: 'Arrival guide', audience: { kind: 'workspace' }, steps },
  { ...base, type: 'revise_guide', title: 'Revised arrival guide', audience: { kind: 'members', membership_ids: [id(7)] }, steps },
  { ...base, type: 'publish_guide' },
  { ...base, type: 'cancel_guide' },
];
const post = (body = commands[2], headers = {}) => new NextRequest('https://cladora.test/api/customer/v1/experience/guides', {
  method: 'POST', headers: { origin: 'https://cladora.test', 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
const get = (query = `context_id=${id(3)}&workspace_id=${id(4)}`) => new NextRequest(`https://cladora.test/api/customer/v1/experience/guides?${query}`);
async function verify(response, status, code) {
  assert.equal(response.status, status);
  assert.match(response.headers.get('cache-control'), /no-store/);
  if (code) assert.equal((await response.json()).error.code, code);
  checks++;
}
for (const command of commands) {
  calls = [];
  await verify(await POST(post(command)), 200);
  assert.deepEqual(calls, [{ name: 'command_ce_guide_v1', args: { p_request: command } }]);
}
for (const changes of [{ tenant_id: id(1) }, { actor_user_id: id(1) }, { membership_id: id(2) }, { expected_version: null },
  { expected_version: -1 }, { expected_version: 1.5 }, { expected_version: Number.MAX_SAFE_INTEGER + 1 },
  { context_id: 'not-a-uuid' }, { reason: '' }, { type: 'activate_module' }]) {
  calls = [];
  await verify(await POST(post({ ...commands[2], ...changes })), 400, 'INVALID_REQUEST');
  assert.equal(calls.length, 0);
}
const badReference = structuredClone(commands[0]); badReference.steps[0].references[0].url = 'https://private.invalid';
await verify(await POST(post(badReference)), 400, 'INVALID_REQUEST');
const missingVersion = { ...commands[2] }; delete missingVersion.expected_version;
await verify(await POST(post(missingVersion)), 400, 'INVALID_REQUEST');
await verify(await POST(post(commands[2], { origin: 'https://evil.test' })), 403, 'BAD_ORIGIN');
await verify(await POST(post(commands[2], { 'content-type': 'text/plain' })), 415, 'UNSUPPORTED_MEDIA_TYPE');
await verify(await POST(post('{')), 400);
await verify(await POST(post('x'.repeat(768 * 1024 + 1))), 413);
for (const query of ['', `context_id=${id(3)}`, `context_id=${id(3)}&workspace_id=${id(4)}&tenant_id=${id(1)}`,
  `context_id=${id(3)}&context_id=${id(3)}&workspace_id=${id(4)}`, `context_id=${id(3)}&workspace_id=${id(4)}&reference_id=${id(9)}&reference_id=${id(9)}`]) {
  calls = [];
  await verify(await GET(get(query)), 400, 'INVALID_REQUEST');
  assert.equal(calls.length, 0);
}
authenticated = false; calls = [];
await verify(await POST(post()), 401, 'UNAUTHORIZED');
await verify(await GET(get()), 401, 'UNAUTHORIZED');
assert.equal(calls.length, 0);
authenticated = true; calls = [];
await verify(await GET(get()), 200);
assert.deepEqual(calls, [{ name: 'read_ce_guides_v1', args: { p_context_id: id(3), p_workspace_id: id(4) } }]);
calls = [];
await verify(await GET(get(`context_id=${id(3)}&workspace_id=${id(4)}&reference_id=${id(9)}`)), 200);
assert.deepEqual(calls, [{ name: 'resolve_ce_guide_reference_v1', args: { p_context_id: id(3), p_workspace_id: id(4), p_reference_id: id(9) } }]);
for (const [code, status] of [['42883', 503], ['PGRST202', 503], ['PGRST106', 503], ['55000', 503], ['42501', 403],
  ['23505', 409], ['23514', 409], ['40001', 409], ['22023', 400], ['22P02', 400], ['P0002', 404], ['XX000', 500]]) {
  result = { data: null, error: { code, message: 'PRIVATE detail must not leak' } };
  for (const response of [await POST(post()), await GET(get())]) {
    await verify(response, status);
    assert.equal(JSON.stringify(await response.json()).includes('PRIVATE'), false);
  }
}
result = { data: null, error: null };
await verify(await POST(post()), 500, 'CE_GUIDE_QUERY_FAILED');
await verify(await GET(get()), 500, 'CE_GUIDE_QUERY_FAILED');
console.log(`CE012-OPS-01 route: ${checks} checks passed (compiled handlers, mocked RPC boundary; no live DB implied).`);
