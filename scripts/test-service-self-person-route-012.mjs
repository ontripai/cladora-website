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
const { POST } = load(new URL('../src/app/api/customer/v1/services/self-person/route.ts', import.meta.url));
const { NextRequest } = require('next/server');
const id = '00000000-0000-0000-0000-000000000001';
const command = { context_id:id,workspace_id:id,name:'Synthetic self person',valid_until:'2026-10-05T08:23:00Z',confirm_self:true,idempotency_key:'self-person-012-001' };
const post = (body = command, headers = {}, suffix = '') => POST(new NextRequest(`https://cladora.test/api/customer/v1/services/self-person${suffix}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
let cases = 0;
async function check(name, fn) { calls = []; await fn(); cases++; console.log(`PASS ${name}`); }
await check('valid JSON writes only parsed request to canonical RPC', async () => { result = { data: { party_id: id, status: 'draft' }, error: null }; assert.equal((await post()).status, 200); assert.deepEqual(calls, [{ name: 'register_service_self_person_v1', args: { p_request: command } }]); });
for (const body of ['broken', { ...command, actor_id: id }, { ...command, tenant_id:id }, { ...command, party_id:id }, { ...command, membership_id:id }, {...command,confirm_self:false}, {...command,valid_until:null}, { ...command, workspace_id:null }]) {
  await check('malformed command or authority injection rejected', async () => { assert.equal((await post(body)).status, 400); assert.deepEqual(calls, []); });
}
await check('cross-origin write denied before RPC', async () => { assert.equal((await post(command, { origin: 'https://evil.test' })).status, 403); assert.deepEqual(calls, []); });
await check('non-JSON write denied', async () => { assert.equal((await post(command, { 'content-type': 'text/plain' })).status, 400); assert.deepEqual(calls, []); });
await check('query injection on mutation denied', async () => { assert.equal((await post(command, {}, '?actor_id=injected')).status, 400); assert.deepEqual(calls, []); });
await check('unauthenticated reads and writes denied', async () => { auth = { data: null, error: null }; assert.equal((await post()).status, 401);  assert.deepEqual(calls, []); auth = { data: { claims: { sub: 'actor' } }, error: null }; });
for (const [code, status] of [['42501', 403], ['23505', 409], ['40001', 409], ['P0002', 404], ['22023', 400], ['22P02', 400], ['22003', 400], ['23514', 400], ['XX000', 500]]) {
  await check(`maps ${code} without leaking SQL details`, async () => { result = { data: null, error: { code, message: 'private SQL internal details', details: 'tenant secrets' } }; const response = await post(); assert.equal(response.status, status); assert.doesNotMatch(JSON.stringify(await response.json()), /private|tenant secrets/); assert.equal(response.headers.get('cache-control'), 'no-store, private'); });
}
await check('null mutation success is treated as server error', async () => { result = { data: null, error: null }; assert.equal((await post()).status, 500); });

console.log(`${cases} SERVICE request route scenarios passed`);
