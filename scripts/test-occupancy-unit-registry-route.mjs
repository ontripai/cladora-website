import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire, Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(path, mocks = {}) {
  const filename = fileURLToPath(new URL(`../${path}`, import.meta.url));
  const compiled = new Module(filename);
  compiled.require = id => Object.hasOwn(mocks, id) ? mocks[id] : require(id);
  compiled._compile(ts.transpileModule(readFileSync(filename, 'utf8'), {compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022,
  }}).outputText, filename);
  return compiled.exports;
}
const schemas = load('src/lib/customer/occupancy-schema.ts');
const contextId = '80000000-0000-0000-0000-000000000004';
const unitId = '80000000-0000-0000-0000-000000000007';
const {NextRequest} = require('next/server');
for (const view of ['units', 'occupancies', 'ownerships', 'unit_detail']) {
  let calls = [];
  const {GET} = load('src/app/api/customer/v1/occupancy/route.ts', {
    '@/lib/customer/occupancy-schema': schemas,
    '@/lib/supabase/server': {createClient: async () => ({
      auth: {getClaims: async () => ({data: {claims: {sub: 'actor'}}})},
      schema: name => {
        assert.equal(name, 'customer_api');
        return {rpc: async (rpc, args) => {
          calls.push({rpc, args});
          return {data: view === 'units' ? {rows: [{id: unitId, unit_code: 'SYN-UNIT-001', occupancy_kind: 'vacant'}], total: 1} : {rows: []}};
        }};
      },
    })},
  });
  const request = query => new NextRequest(`https://cladora.test/api/customer/v1/occupancy?${query}`);
  const response = await GET(request(`context_id=${contextId}&view=${view}${view === 'unit_detail' ? `&unit_id=${unitId}` : ''}`));
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.p_context_id, contextId);
  if (view === 'unit_detail') {
    assert.equal(calls[0].rpc, 'get_unit_occupancy_detail_v1');
    assert.equal(calls[0].args.p_unit_id, unitId);
  } else {
    assert.equal(calls[0].rpc, 'get_occupancy_registry_v1');
    assert.equal(calls[0].args.p_view, view, 'preserve units instead of querying occupancies');
  }
  if (view === 'units') assert.equal((await response.json()).rows[0].unit_code, 'SYN-UNIT-001');
  calls = [];
  for (const query of [`context_id=${contextId}&view=unit_detail`, `context_id=invalid&view=units`, `context_id=${contextId}&view=units&from=2026-02-31`]) {
    assert.equal((await GET(request(query))).status, 400);
    assert.equal(calls.length, 0, 'invalid requests cannot reach RPC');
  }
}
const authorizedPartyId = '80000000-0000-0000-0000-000000000008';
const validTenantOccupancy = {context_id: contextId, unit_id: unitId, kind: 'tenant', starts_at: '2026-09-30', occupant_party_ids: [authorizedPartyId]};
assert.ok(schemas.createOccupancyRequestSchema.safeParse(validTenantOccupancy).success);
assert.ok(!schemas.createOccupancyRequestSchema.safeParse({...validTenantOccupancy, occupant_party_ids: []}).success, 'non-empty occupancy requires a linked party');
assert.ok(!schemas.createOccupancyRequestSchema.safeParse({...validTenantOccupancy, unit_id: 'SYN-UNIT-001'}).success);
assert.ok(!schemas.createOccupancyRequestSchema.safeParse({...validTenantOccupancy, occupant_party_ids: [authorizedPartyId, authorizedPartyId]}).success, 'party IDs must be unique');
console.log('PASS occupancy registry and creation contract: views, UUIDs, invalid requests, linked parties and duplicate rejection');
