import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);

function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const compiled = new Module(filename);
  compiled.require = (id) => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText, filename);
  return compiled.exports;
}

const id = (suffix) => `d1020000-0000-4000-8000-${String(suffix).padStart(12, '0')}`;
const verified = {
  contract_version: 'canonical-resource-reference.v1',
  reference_status: 'verified',
  tenant_id: id(1),
  workspace_id: id(2),
  resource_type: 'unit',
  resource_id: id(3),
  resource_version: 2,
  party_kind: null,
  display_name: 'A-01',
  lifecycle_status: 'active',
  evaluated_at: '2026-10-19T17:00:00.000Z',
  action_authorization: 'not_evaluated',
};
const withheld = {
  ...verified,
  reference_status: 'withheld',
  tenant_id: null,
  workspace_id: null,
  resource_type: null,
  resource_id: null,
  resource_version: null,
  party_kind: null,
  display_name: null,
  lifecycle_status: null,
};

let auth = { data: { claims: { sub: id(4) } }, error: null };
let result = { data: verified, error: null };
let calls = [];
const schema = load('src/lib/core/resource-contracts-v1.ts', {
  '../customer/workspace-composition-schema.ts': load('src/lib/customer/workspace-composition-schema.ts'),
});
const route = load('src/app/api/customer/v1/core/resources/unit-reference/route.ts', {
  '@/lib/core/resource-contracts-v1': schema,
  '@/lib/customer/occupancy-schema': { uuidSchema: require('zod').z.string().uuid() },
  '@/lib/supabase/server': {
    createClient: async () => ({
      auth: { getClaims: async () => auth },
      schema: (name) => {
        assert.equal(name, 'customer_api');
        return {
          rpc: async (rpc, args) => {
            calls.push({ rpc, args });
            return result;
          },
        };
      },
    }),
  },
});
const { NextRequest } = require('next/server');
const request = (query = {
  context_id: id(5),
  workspace_id: id(2),
  unit_id: id(3),
  resource_version: '2',
}) => new NextRequest(
  `https://cladora.test/api/customer/v1/core/resources/unit-reference?${new URLSearchParams(query)}`,
);

let response = await route.GET(request());
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), verified);
assert.equal(response.headers.get('cache-control'), 'private, no-store');
assert.equal(response.headers.get('vary'), 'Cookie');
assert.deepEqual(calls.at(-1), {
  rpc: 'resolve_canonical_resource_reference_v1',
  args: {
    p_context_id: id(5),
    p_workspace_id: id(2),
    p_resource_type: 'unit',
    p_resource_id: id(3),
    p_resource_version: 2,
    p_permission_code: 'core.units.identity.read',
    p_purpose: 'core.unit_identity.history',
  },
});

calls = [];
response = await route.GET(request({
  context_id: id(5), workspace_id: id(2), unit_id: id(3), resource_version: '0',
}));
assert.equal(response.status, 400);
assert.equal(calls.length, 0);

response = await route.GET(request({
  context_id: id(5), workspace_id: id(2), unit_id: id(3), resource_version: '2', injected: 'true',
}));
assert.equal(response.status, 400);
assert.equal(calls.length, 0);

auth = { data: null, error: null };
response = await route.GET(request());
assert.equal(response.status, 401);
assert.equal(calls.length, 0);
auth = { data: { claims: { sub: id(4) } }, error: null };

for (const [code, status, visible] of [
  ['42501', 403, 'FORBIDDEN'],
  ['22023', 400, 'INVALID_REQUEST'],
  ['XX000', 500, 'INTERNAL_ERROR'],
]) {
  result = { data: null, error: { code, message: 'private database detail' } };
  response = await route.GET(request());
  assert.equal(response.status, status);
  assert.deepEqual(await response.json(), { error: { code: visible } });
}

result = { data: { ...verified, action_authorization: 'allowed' }, error: null };
response = await route.GET(request());
assert.equal(response.status, 502);
assert.deepEqual(await response.json(), { error: { code: 'INVALID_UPSTREAM_RESPONSE' } });

result = { data: withheld, error: null };
response = await route.GET(request());
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), withheld);

console.log('PASS DW02 canonical Unit reference route: exact RPC, redacted failures, strict response and no shared cache');
