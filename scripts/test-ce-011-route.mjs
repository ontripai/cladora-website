import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const cache = new Map();
let result = { data: null, error: null };
let calls = [];

function load(file) {
  if (cache.has(file.href)) return cache.get(file.href);
  const filename = fileURLToPath(file);
  const mod = new Module(filename);
  mod.require = (name) => name === '@/lib/supabase/server' ? { createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: { sub: 'actor' } }, error: null }) },
    schema: (schema) => {
      assert.equal(schema, 'customer_api');
      return { rpc: async (rpc, args) => { calls.push({ rpc, args }); return result; } };
    },
  }) } : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url))
    : name.startsWith('.') ? load(new URL(`${name}.ts`, file)) : require(name);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  cache.set(file.href, mod.exports);
  return mod.exports;
}

const { GET, POST } = load(new URL('../src/app/api/customer/v1/community/events/route.ts', import.meta.url));
const { NextRequest } = require('next/server');
const id = '10000000-0000-4000-8000-000000000001';
const command = {
  type: 'publish_event', command_id: id, idempotency_key: 'ce011.route.rpc.missing',
  context_id: id, workspace_id: id, event_id: id, expected_version: 1,
  reason: 'Verify unavailable proposal RPC response',
};

result = { data: null, error: { code: '42883', message: 'internal function name' } };
let response = await POST(new NextRequest('https://cladora.test/api/customer/v1/community/events', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://cladora.test' }, body: JSON.stringify(command),
}));
assert.equal(response.status, 503);
assert.deepEqual(await response.json(), { error: { code: 'CE_EVENT_CONNECTION_NOT_READY' } });
assert.equal(calls.at(-1).rpc, 'command_ce_event_v1');

result = { data: null, error: { code: 'PGRST202', message: 'schema cache detail' } };
response = await GET(new NextRequest(`https://cladora.test/api/customer/v1/community/events?context_id=${id}&workspace_id=${id}`));
assert.equal(response.status, 503);
assert.deepEqual(await response.json(), { error: { code: 'CE_EVENT_CONNECTION_NOT_READY' } });
assert.equal(calls.at(-1).rpc, 'read_ce_events_v1');

console.log('CE-011 route acceptance passed: absent proposal RPCs fail closed as connection-not-ready without leaking database details.');
