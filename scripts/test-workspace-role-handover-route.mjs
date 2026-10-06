import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const mod = new Module(filename);
  mod.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  mod._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
  return mod.exports;
}
const { NextRequest } = require('next/server');
const uuid = '11111111-1111-4111-8111-111111111111';
const successor = '22222222-2222-4222-8222-222222222222';
let authenticated = true;
let outcome = { data: { action: 'handover_role' }, error: null };
const calls = [];
const mocks = {
  '@/lib/customer/workspace-roles-schema': load('src/lib/customer/workspace-roles-schema.ts'),
  '@/lib/security/same-origin': load('src/lib/security/same-origin.ts'),
  '@/lib/security/request-body': load('src/lib/security/request-body.ts'),
  '@/lib/supabase/server': { createClient: async () => ({
    auth: { getClaims: async () => ({ data: { claims: authenticated ? { sub: uuid } : {} }, error: null }) },
    schema: schema => { assert.equal(schema, 'customer_api'); return {
      rpc: async (name, args) => { calls.push({ name, args }); return outcome; },
    }; },
  }) },
};
const { POST } = load('src/app/api/customer/v1/workspace/roles/handover/route.ts', mocks);
const payload = { context_id: uuid, assignment_id: uuid, expected_lock_version: 1,
  successor_membership_id: successor, valid_until: null, reason: 'Staff transition', idempotency_key: 'handover-test-001' };
const post = (body = payload, origin = 'https://cladora.test') => new NextRequest(
  'https://cladora.test/api/customer/v1/workspace/roles/handover',
  { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) });

for (const bad of [{ ...payload, successor_membership_id: 'invalid' },
  { ...payload, expected_lock_version: 0 }, { ...payload, tenant_id: uuid }]) {
  assert.equal((await POST(post(bad))).status, 400);
}
assert.equal(calls.length, 0);
assert.equal((await POST(post(payload, 'https://evil.test'))).status, 403);
authenticated = false;
assert.equal((await POST(post())).status, 401);
authenticated = true;
const success = await POST(post());
assert.equal(success.status, 200);
assert.equal(success.headers.get('cache-control'), 'no-store, private');
assert.deepEqual(calls.at(-1), { name: 'handover_workspace_role_v1', args: {
  p_context_id: uuid, p_assignment_id: uuid, p_expected_lock_version: 1,
  p_successor_membership_id: successor, p_valid_until: null,
  p_reason: 'Staff transition', p_idempotency_key: 'handover-test-001',
} });
for (const [code, message, status] of [['42501', 'mfa_required', 403],
  ['42501', 'private authority detail', 403], ['40001', 'private conflict', 409],
  ['22023', 'private input detail', 400], ['XX000', 'private database detail', 500]]) {
  outcome = { data: null, error: { code, message } };
  const response = await POST(post());
  assert.equal(response.status, status);
  assert.equal(JSON.stringify(await response.json()).includes('private'), false);
}
console.log('PASS handover gateway authentication, strict payload, exact RPC, origin and sanitized errors');
