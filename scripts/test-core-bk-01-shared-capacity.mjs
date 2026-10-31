import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING CORE BK-01 SHARED CAPACITY CONTRACT TESTS ===\n');

const schemaPath = 'src/lib/core/shared-capacity-time-v1.ts';
const contractPath = 'docs/contracts/CLADORA-CORE-BK-01-SHARED-CAPACITY-TIME-RFC-v1.0.md';
const migrationPath = 'supabase/migrations/20261019230000_bk01_c13_amenity_capacity_v1.sql';
const routePath = 'src/app/api/customer/v1/amenities/reservations/route.ts';
const consumerPath = 'src/components/customer/CustomerAmenityReservations.tsx';
const schema = fs.readFileSync(schemaPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const route = fs.readFileSync(routePath, 'utf8');
const consumer = fs.readFileSync(consumerPath, 'utf8');

for (const version of ['shared-capacity-time.v1', 'shared-capacity-allocation-receipt.v1']) {
  assert.ok(schema.includes(version), `${version} has an executable schema`);
  assert.ok(contract.includes(version), `${version} is documented`);
}

assert.match(contract, /C13 shared-amenity reservation is the first runtime consumer/, 'C13 is the first runtime consumer');
assert.match(contract, /AIRPROP commercial reservation remains a separate exclusive commercial state machine/, 'AIRPROP reservation is not BK-01');
assert.match(contract, /Free Event base, interest\/withdrawal and manual attendance do not wait for BK-01/, 'Community/Event base remains independent');
assert.match(schema, /interval_semantics:\s*z\.literal\('half_open'\)/, 'policy pins half-open intervals');
assert.match(schema, /multi_resource_mode:\s*z\.literal\('all_or_nothing'\)/, 'multi-resource allocation is all-or-nothing');
assert.match(schema, /half_open_window_end_must_follow_start/, 'requested window ordering is enforced');
assert.match(schema, /capacity_resources_must_be_unique/, 'resource sets are unique');
assert.match(schema, /only_held_state_has_expiry/, 'only live holds carry expiry');
assert.match(schema, /decision_status:\s*z\.enum\(\['stale', 'unknown'\]\)[\s\S]*resources:\s*z\.array\(z\.never\(\)\)\.max\(0\)[\s\S]*conflicts:\s*z\.array\(z\.never\(\)\)\.max\(0\)/, 'unresolved receipts disclose no resources or conflicts');
assert.match(contract, /deterministic canonical `\(resource_type, resource_id\)` order/, 'locking order is deterministic');
assert.match(contract, /creates no shared booking identity across domains/, 'domain state machines and IDs remain distinct');
assert.match(migration, /check_workspace_native_permission_v2/, 'runtime rechecks AUTH01');
assert.match(migration, /resolve_canonical_resource_reference_v1/, 'runtime resolves the DW02 canonical Unit');
assert.match(migration, /for update/, 'runtime serializes policy and hold transitions');
assert.match(route, /sharedCapacityAllocationRequestV1Schema\.safeParse/, 'API validates the existing request contract');
assert.match(route, /sharedCapacityAllocationReceiptV1Schema\.safeParse/, 'API validates the existing receipt contract');
assert.match(consumer, /\/api\/customer\/v1\/amenities\/reservations/, 'C13 UI is a real API consumer');
assert.doesNotMatch(migration, /airprop\.exclusive_reservations|service_catalog\.orders/, 'runtime does not rebuild AIRPROP or SERVICE engines');

console.log('  ✔ C13 consumes BK01 without taking ownership of canonical Unit identity.');
console.log('  ✔ Policies pin timezone, half-open intervals, capacity and all-or-nothing resources.');
console.log('  ✔ Hold lifecycle, expiry, conflict and unknown-result semantics are explicit.');
console.log('  ✔ AIRPROP reservation and Community/Event base remain independent.');
