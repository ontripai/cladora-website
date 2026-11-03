import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { z } from 'zod';

const require = createRequire(import.meta.url);
const filename = fileURLToPath(new URL('../src/app/api/owner-portfolio/v1/projection/route.ts', import.meta.url));
const projectionSchema = z.strictObject({ contract_version: z.literal('owner-portfolio-projection.v1') }).passthrough();
let authenticated = true;
let result = { data: [{ contract_version: 'owner-portfolio-projection.v1' }], error: null };
const calls = [];
const db = {
  auth: { getClaims: async () => ({ data: authenticated ? { claims: { sub: 'owner' } } : null }) },
  schema(name) {
    assert.equal(name, 'customer_api');
    return { rpc: async (rpc, args) => { calls.push({ rpc, args }); return result; } };
  },
};
const routeModule = new Module(filename);
routeModule.filename = filename;
routeModule.paths = Module._nodeModulePaths(fileURLToPath(new URL('..', import.meta.url)));
routeModule.require = id => id === '@/lib/supabase/server'
  ? { createClient: async () => db }
  : id === '@/lib/core/owner-portfolio-projection-v1'
    ? { ownerPortfolioProjectionV1Schema: projectionSchema }
    : require(id);
routeModule._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText, filename);
const { GET } = routeModule.exports;

authenticated = false;
let response = await GET();
assert.equal(response.status, 401);
assert.equal(calls.length, 0, 'unauthenticated requests never reach the RPC');

authenticated = true;
result = { data: null, error: { code: '42501' } };
response = await GET();
assert.equal(response.status, 403);

result = { data: [{ contract_version: 'wrong' }], error: null };
response = await GET();
assert.equal(response.status, 502);

const projection = { contract_version: 'owner-portfolio-projection.v1', projection_status: 'available' };
result = { data: [projection], error: null };
response = await GET();
assert.equal(response.status, 200);
assert.equal(response.headers.get('cache-control'), 'no-store, private');
assert.deepEqual(await response.json(), { projections: [projection] });
assert.deepEqual(calls.at(-1), {
  rpc: 'list_my_owner_portfolio_projections_v1',
  args: { p_expected_unit_versions: {} },
});

console.log('PASS PF01 API: authentication, fail-closed RPC handling, response validation and no-store output');
