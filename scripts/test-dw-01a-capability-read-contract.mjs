import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING DW-01A CAPABILITY READ CONTRACT TESTS ===\n');

const schemaPath = 'src/lib/customer/workspace-capability-snapshot-schema.ts';
const adapterPath = 'src/lib/customer/workspace-capability-snapshot-adapter.ts';
const contractPath = 'docs/contracts/CLADORA-DW-01A-WORKSPACE-CAPABILITY-READ-CONTRACT-v1.0.md';
const databasePackagePath = 'docs/contracts/CLADORA-DW-01A-DATABASE-READER-CHANGE-PACKAGE-v1.0.md';
const proposedSqlPath = 'docs/contracts/CLADORA-DW-01A-DATABASE-READER-PROPOSED.sql';
const proposedPgTapPath = 'docs/contracts/CLADORA-DW-01A-DATABASE-READER-PGTAP-PROPOSED.sql';
const migrationPath = 'supabase/migrations/20261007120000_dw01a_workspace_capability_snapshot.sql';
const runtimePgTapPath = 'supabase/tests/172_dw01a_workspace_capability_snapshot.test.sql';

for (const path of [schemaPath, adapterPath, contractPath, databasePackagePath, proposedSqlPath, proposedPgTapPath, migrationPath, runtimePgTapPath]) {
  assert.ok(fs.existsSync(path), `${path} exists`);
}

const schema = fs.readFileSync(schemaPath, 'utf8');
const adapter = fs.readFileSync(adapterPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');
const databasePackage = fs.readFileSync(databasePackagePath, 'utf8');
const proposedSql = fs.readFileSync(proposedSqlPath, 'utf8');
const proposedPgTap = fs.readFileSync(proposedPgTapPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const runtimePgTap = fs.readFileSync(runtimePgTapPath, 'utf8');

assert.match(schema, /p_context_id:\s*uuidSchema[\s\S]*?p_workspace_id:\s*uuidSchema/, 'RPC arguments are exactly context + Workspace');
assert.match(schema, /workspace_state:\s*workspaceCapabilityStateSchema/, 'Workspace capability state is explicit');
assert.match(schema, /reference_visibility:\s*capabilityReferenceVisibilitySchema/, 'One response-wide reference disclosure ceiling is explicit');
assert.match(schema, /action_authorization:\s*z\.literal\('not_evaluated'\)/, 'Action authorization is explicitly not evaluated');
assert.match(schema, /visibility:\s*z\.literal\('full'\)/, 'Full resource/contract disclosure is modelled');
assert.match(schema, /visibility:\s*z\.literal\('count_only'\)/, 'Count-only resource disclosure is modelled');
assert.match(schema, /visibility:\s*z\.literal\('withheld'\)/, 'Withheld resource/contract disclosure is modelled');
assert.match(schema, /resource_ids:\s*z\.array\(z\.never\(\)\)\.max\(0\)/, 'Restricted disclosure cannot leak resource IDs');
assert.match(schema, /legacy_unprovenanced/, 'Legacy entitlement provenance is explicit');
assert.match(schema, /contract:\s*contractDisclosureSchema/, 'Contract disclosure is independently bounded');

for (const reason of [
  'taxonomy_not_configured',
  'property_profile_missing',
  'operating_model_missing',
  'contract_id_missing',
]) {
  assert.match(adapter, new RegExp(`'${reason}'`), `${reason} cannot be a sole denial reason`);
}
assert.match(adapter, /Legacy unprovenanced entitlements cannot expose or infer a contract/, 'Adapter prevents inferred legacy contracts');
assert.match(adapter, /Withheld responses cannot expose resource IDs or counts/, 'Withheld response blocks all resource IDs and counts');
assert.match(adapter, /Withheld responses cannot expose module, entitlement, contract, resource or source references/, 'Withheld response blocks cross-section reference leaks');
assert.match(adapter, /restriction\.resource_id !== null[\s\S]*?restriction\.source_id !== null[\s\S]*?restriction\.source_version !== null/, 'Restrictions are covered by withheld disclosure checks');
assert.match(adapter, /capability\.module\?\.definition_id !== null/, 'Module definition references are covered by withheld checks');
assert.match(adapter, /capability\.entitlement\?\.entitlement_id !== null/, 'Entitlement references are covered by withheld checks');
assert.match(adapter, /Count-only responses cannot expose resource or source identifiers/, 'Count-only response blocks identifiers outside resource summary');
assert.doesNotMatch(adapter, /fetch\(|\.rpc\(|createClient\(/, 'Adapter has no endpoint, database or network dependency');

assert.match(contract, /C01 — Authority and audience/, 'CE C01 maps to existing Core authority');
assert.match(contract, /C02 — Independent activation/, 'CE C02 maps to the DW-01A read gap');
assert.match(contract, /C03 — Basic audit and recovery/, 'CE C03 maps to existing audit/idempotency foundations');
assert.match(contract, /ce\.event\.basic/, 'Official CE-011 capability code is fixed');
for (const permission of [
  'events.event.read',
  'events.event.publish',
  'events.event.cancel',
  'events.interest.manage_self',
  'events.attendance.record',
  'events.attendance.correct',
]) {
  assert.ok(contract.includes(permission), `Official permission ${permission} is fixed`);
}
assert.doesNotMatch(contract, /unlimited free|unlimited-free|رویداد نامحدود/i, 'Forbidden unlimited-event wording is absent');
assert.match(contract, /not a reservation, confirmed place, capacity allocation or admission guarantee/i, 'Event interest disclaimer is explicit');

assert.match(databasePackage, /No migration file is included/, 'Database package is design-only');
assert.match(databasePackage, /customer_api\.get_workspace_capability_snapshot_v1/, 'Future RPC is named exactly once in the database package');
assert.match(databasePackage, /Core\/Platform/, 'Database owner is explicit');
assert.match(databasePackage, /DATABASE-READER-PGTAP-PROPOSED\.sql/, 'Proposed pgTAP attachment is linked');
assert.match(proposedSql, /get_workspace_capability_snapshot_v1\(\s*p_context_id uuid,\s*p_workspace_id uuid\s*\)/, 'SQL uses the exact two-parameter signature');
assert.match(proposedSql, /v_reference_visibility text := 'withheld'/, 'Withheld is the real default');
assert.match(proposedSql, /workspace\.role\.read[\s\S]*workspace\.role\.manage/, 'Disclosure derives from existing permissions');
assert.match(proposedSql, /case when e\.override_value_json is not null and e\.override_expires_at > statement_timestamp\(\)[\s\S]*e\.boolean_value is true or e\.numeric_value > 0/, 'Existing entitlement predicate is reused without a new aggregator');
assert.match(proposedPgTap, /pg_temp\.dw01a_snapshot[\s\S]*customer_api\.get_workspace_capability_snapshot_v1\(p_context,p_workspace\)/, 'Fixtures call the real RPC');
for (const fixture of ['taxonomy absence reported', 'valid legacy remains available', 'expired entitlement ineffective', 'true override follows existing predicate', 'cross-tenant denied', 'real RPC performs zero writes']) {
  assert.ok(proposedPgTap.includes(fixture), `pgTAP covers ${fixture}`);
}
assert.match(proposedPgTap, /Workspace access alone is withheld/, 'A valid Workspace caller without disclosure permission is tested');
assert.match(proposedPgTap, /visible_count \? \(@ != null\)[\s\S]*total_count \? \(@ != null\)/, 'Withheld whole-document predicate forbids resource counts');

assert.match(migration, /check_workspace_disclosure_permission_v1/, 'Runtime reader centralizes disclosure authorization');
assert.match(migration, /check_effective_permission_v2\(/, 'Disclosure authorization invokes the canonical effective-authority evaluator');
assert.match(migration, /workspace\.role\.read/, 'Resource-count disclosure permission is explicit');
assert.match(migration, /workspace\.role\.manage/, 'Contract-status disclosure permission is explicit');
assert.match(runtimePgTap, /select plan\(28\)/, 'Runtime pgTAP plan is current');
assert.match(runtimePgTap, /validate_module_permission_bindings_v2_seeding_v1/, 'Runtime pgTAP protects the historic module manifest');
assert.match(runtimePgTap, /validate_airprop_module_bindings_v1/, 'Runtime pgTAP protects the AIRPROP domain manifest');
assert.match(runtimePgTap, /explicit denies take precedence/, 'Runtime pgTAP covers deny precedence');
assert.match(runtimePgTap, /permission revocation is effective/, 'Runtime pgTAP covers permission revocation');

const routePath = 'src/app/api/customer/v1/workspace/capabilities/route.ts';
assert.equal(fs.existsSync(routePath), false, 'Endpoint is intentionally absent until the RPC is accepted');

console.log('  ✔ Contract separates Workspace state from action authorization.');
console.log('  ✔ Resource and contract disclosure are bounded.');
console.log('  ✔ Taxonomy and null contract_id cannot independently revoke legacy-valid access.');
console.log('  ✔ CE-011 C01/C02/C03 mappings and Event wording are fixed.');
console.log('  ✔ Migration and runtime pgTAP are prepared; endpoint remains intentionally absent.');
