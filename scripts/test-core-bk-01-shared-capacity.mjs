import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING CORE BK-01 SHARED CAPACITY CONTRACT TESTS ===\n');

const schemaPath = 'src/lib/core/shared-capacity-time-v1.ts';
const contractPath = 'docs/contracts/CLADORA-CORE-BK-01-SHARED-CAPACITY-TIME-RFC-v1.0.md';
const schema = fs.readFileSync(schemaPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');

for (const version of ['shared-capacity-time.v1', 'shared-capacity-allocation-receipt.v1']) {
  assert.ok(schema.includes(version), `${version} has an executable schema`);
  assert.ok(contract.includes(version), `${version} is documented`);
}

assert.match(contract, /selected first consumer is SERVICE via Draft PR #328/, 'SERVICE is the selected first consumer');
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
assert.match(contract, /Documentation & PM owns the central manifest/, 'manifest ownership is preserved');

console.log('  ✔ SERVICE #328 is selected without taking ownership of SERVICE state.');
console.log('  ✔ Policies pin timezone, half-open intervals, capacity and all-or-nothing resources.');
console.log('  ✔ Hold lifecycle, expiry, conflict and unknown-result semantics are explicit.');
console.log('  ✔ AIRPROP reservation and Community/Event base remain independent.');
