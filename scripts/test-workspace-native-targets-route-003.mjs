import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const compiled = new Module(filename);
  compiled.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  } }).outputText, filename);
  return compiled.exports;
}
const { NextRequest } = require('next/server');
const schemas = load('src/lib/customer/workspace-composition-schema.ts');
const context = '00000000-0000-0000-0000-000000000001';
const workspace = '00000000-0000-0000-0000-000000000002';
let cases = 0;
let auth = { data: { claims: { sub: 'server-actor' } }, error: null };
let result = { data: [{ workspace_id: workspace, workspace_type: 'building', environment: 'PILOT' }], error: null };
let calls = [];
const { GET } = load('src/app/api/customer/v1/workspace/targets/route.ts', {
  '@/lib/customer/workspace-composition-schema': schemas,
  '@/lib/supabase/server': { createClient: async () => ({
    auth: { getClaims: async () => auth },
    schema: name => { assert.equal(name, 'customer_api'); return { rpc: async (name, args) => { calls.push({ name, args }); return result; } }; },
  }) },
});
const request = query => new NextRequest(`https://cladora.test/api/customer/v1/workspace/targets?${query}`);
async function check(name, fn) { calls = []; await fn(); cases++; console.log(`PASS ${name}`); }
await check('returns only gateway-authorized workspace targets', async () => {
  const response = await GET(request(`context_id=${context}`));
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { workspaces: result.data });
  assert.deepEqual(calls, [{ name: 'list_workspace_targets_v2', args: { p_context_id: context } }]);
  assert.match(response.headers.get('cache-control'), /no-store/); assert.equal(response.headers.get('vary'), 'Cookie');
});
for (const query of ['', 'context_id=invalid', `context_id=${context}&context_id=${workspace}`, `context_id=${context}&workspace_id=${workspace}`, `context_id=${context}&tenant_id=${workspace}`]) {
  await check(`invalid or injected query rejected: ${query}`, async () => { assert.equal((await GET(request(query))).status, 400); assert.equal(calls.length, 0); });
}
await check('missing principal cannot call gateway', async () => { auth = { data: { claims: {} }, error: null }; assert.equal((await GET(request(`context_id=${context}`))).status, 401); assert.equal(calls.length, 0); });
await check('claims error cannot call gateway', async () => { auth = { data: { claims: { sub: 'actor' } }, error: { message: 'private auth detail' } }; assert.equal((await GET(request(`context_id=${context}`))).status, 401); assert.equal(calls.length, 0); });
auth = { data: { claims: { sub: 'server-actor' } }, error: null };
await check('database access denial mapped without private details', async () => {
  result = { data: null, error: { code: '42501', message: 'sensitive internal detail' } };
  const response = await GET(request(`context_id=${context}`)); assert.equal(response.status, 403); assert.deepEqual(await response.json(), { error: { code: 'WORKSPACE_ACCESS_DENIED' } });
});
await check('database failure is not a successful empty list', async () => {
  result = { data: null, error: { code: 'XX000', message: 'private schema detail' } };
  const response = await GET(request(`context_id=${context}`)); assert.equal(response.status, 500); assert.deepEqual(await response.json(), { error: { code: 'WORKSPACE_TARGET_QUERY_FAILED' } });
});
await check('no assignments is a successful empty list', async () => {
  result = { data: [], error: null }; const response = await GET(request(`context_id=${context}`)); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { workspaces: [] });
});
console.log(`${cases} native workspace target gateway cases passed`);
