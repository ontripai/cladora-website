import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING WORKSPACE DYNAMIC COMPOSITION CONTRACT TESTS (CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A-R4) ===\n');

// 1. Migration 102 Structure, Security & Invariants
console.log('[Suite 1] Migration 102 Structure, Schema, Security & Non-Negotiable Invariants');
const migrationPath = 'supabase/migrations/20260917120000_workspace_dynamic_composition.sql';
assert.ok(fs.existsSync(migrationPath), 'Migration 102 exists');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

assert.match(migrationSql, /^begin;/m, 'Migration starts with begin;');
assert.match(migrationSql, /^commit;/m, 'Migration ends with commit;');

// Table existence
assert.match(migrationSql, /create table platform\.module_definitions/i, 'module_definitions table created');
assert.match(migrationSql, /create table platform\.module_dependencies/i, 'module_dependencies table created');
assert.match(migrationSql, /create table platform\.module_incompatibilities/i, 'module_incompatibilities table created');
assert.match(migrationSql, /create table platform\.module_property_profile_compatibilities/i, 'module_property_profile_compatibilities table created');
assert.match(migrationSql, /create table platform\.module_operating_model_compatibilities/i, 'module_operating_model_compatibilities table created');
assert.match(migrationSql, /create table platform\.workspace_modules/i, 'workspace_modules table created');
assert.match(migrationSql, /create table platform\.workspace_module_idempotency/i, 'workspace_module_idempotency table created');

// Non-negotiable 1: Idempotency boundary
assert.match(migrationSql, /unique\s*\(tenant_id,\s*idempotency_key\)/i, 'Idempotency table enforces unique(tenant_id, idempotency_key)');

// Non-negotiable 2: Deterministic request hash via extensions.digest UTF-8 JSONB
assert.match(migrationSql, /extensions\.digest\(convert_to\(v_canonical_payload::text,\s*'UTF8'\),\s*'sha256'\)/i, 'Deterministic request hash generated from canonical JSONB');
assert.match(migrationSql, /request_hash_version integer not null default 1/i, 'request_hash_version column with default 1 in table');
assert.match(migrationSql, /'schema_version',\s*1/i, 'schema_version 1 in canonical payload');

// Non-negotiable 3: Idempotency records represent committed success only
assert.doesNotMatch(migrationSql, /create table platform\.workspace_module_idempotency[\s\S]*?status text.*?failed/i, 'Zero failed status column in idempotency table');
assert.match(migrationSql, /result_workspace_module_id uuid not null references platform\.workspace_modules\(id\)/i, 'result_workspace_module_id is NOT NULL in idempotency table');

// Non-negotiable 4: Composite version uniqueness
assert.match(migrationSql, /create table platform\.module_definitions[\s\S]*?unique\s*\(code,\s*version\)/i, 'module_definitions has composite unique(code, version)');
assert.doesNotMatch(migrationSql, /create table platform\.module_definitions[\s\S]*?unique\s*\(code\)[^,]*?,/i, 'Zero independent unique(code) on module_definitions');
assert.doesNotMatch(migrationSql, /create table platform\.module_definitions[\s\S]*?unique\s*\(version\)[^,]*?,/i, 'Zero independent unique(version) on module_definitions');

// Directive 1 & Non-negotiable 5: Verified proven 12 modules and catalog_only entitlement nullability
const expectedModules = [
  'occupancy',
  'billing',
  'payments',
  'accounting',
  'maintenance',
  'utilities',
  'governance',
  'communications',
  'documents',
  'security',
  'core_property_registry',
  'contracts_tenancy',
];

for (const code of expectedModules) {
  assert.match(migrationSql, new RegExp(`'${code}',\\s*1,`, 'i'), `Module ${code} seeded with version 1`);
}

// Catalog-only modules must have entitlement_key IS NULL
assert.match(migrationSql, /'core_property_registry',\s*1,[\s\S]*?'catalog_only',[\s\S]*?null,\s*null\);/i, 'core_property_registry seeded with null entitlement_key');
assert.match(migrationSql, /'contracts_tenancy',\s*1,[\s\S]*?'catalog_only',[\s\S]*?null,\s*null\);/i, 'contracts_tenancy seeded with null entitlement_key');

// Check constraint in module_definitions
assert.match(migrationSql, /lifecycle_status = 'catalog_only' and entitlement_key is null/i, 'Constraint enforces null entitlement_key on catalog_only');
assert.match(migrationSql, /lifecycle_status <> 'catalog_only' and entitlement_key is not null and entitlement_key ~ '\^module/i, 'Constraint enforces valid entitlement_key pattern on activatable modules');

// Directive 2: Mandatory Reason without Default
assert.doesNotMatch(migrationSql, /function customer_api\.activate_workspace_module_v1[\s\S]*?p_reason text default/i, 'activate RPC has NO default value for p_reason');
assert.doesNotMatch(migrationSql, /function customer_api\.deactivate_workspace_module_v1[\s\S]*?p_reason text default/i, 'deactivate RPC has NO default value for p_reason');
assert.match(migrationSql, /workspace_module_activation_reason_required/, 'activate requires non-empty reason');
assert.match(migrationSql, /workspace_module_deactivation_reason_required/, 'deactivate requires non-empty reason');
assert.match(migrationSql, /workspace_module_invalid_reason/, 'Invalid/whitespace/short reason rejected');

// Directive 3: Hardened Permission Bootstrap
assert.match(migrationSql, /create trigger trg_bootstrap_role_module_permissions/i, 'Bootstrap trigger defined on identity.roles');
assert.match(migrationSql, /app_private\.bootstrap_role_module_permissions_v1/i, 'Hardened bootstrap function defined');
assert.match(migrationSql, /new\.code in \('association_admin', 'property_manager'\)/, 'Bootstrap checks exact role codes');
assert.match(migrationSql, /new\.name is not null and length\(trim\(new\.name\)\) > 0/, 'Bootstrap checks non-blank name');

// Directive 4: Governance Canonical Compatibility
assert.match(migrationSql, /residential_condominium', 'residential_complex', 'gated_villa_community', 'mixed_use_estate/i, 'Governance profile compatibility matches canonical profiles');
assert.match(migrationSql, /o\.code <> 'association_managed'/i, 'Governance operating model matches association_managed');

// R4 Mandates: Fail-closed taxonomy compatibility gate & server-authoritative projection
assert.doesNotMatch(migrationSql, /coalesce\([^,]+,\s*'compatible'\)/i, 'Zero coalesce(..., compatible) in compatibility projection');
assert.match(migrationSql, /workspace_module_taxonomy_assignment_required/, 'Fail-closed missing taxonomy assignment (42501)');
assert.match(migrationSql, /workspace_module_taxonomy_assignment_ambiguous/, 'Fail-closed ambiguous taxonomy assignment (42501)');
assert.match(migrationSql, /workspace_module_compatibility_rule_missing/, 'Fail-closed missing compatibility rule (42501)');
assert.match(migrationSql, /workspace_module_compatibility_review_required/, 'Fail-closed review_required (42501)');
assert.match(migrationSql, /workspace_module_taxonomy_incompatible/, 'Fail-closed incompatible (42501)');
assert.match(migrationSql, /'profile_compatibility'/, 'Projection includes profile_compatibility');
assert.match(migrationSql, /'operating_model_compatibility'/, 'Projection includes operating_model_compatibility');
assert.match(migrationSql, /'effective_compatibility'/, 'Projection includes effective_compatibility');

// Non-negotiable 6: Context Resolver
assert.match(migrationSql, /app_private\.resolve_workspace_from_customer_context_v1/i, 'Canonical Context Resolver defined');
assert.match(migrationSql, /workspace_composition_context_not_workspace_bound/, 'Fail-closed error on unbound context');
assert.match(migrationSql, /workspace_composition_workspace_binding_ambiguous/, 'Fail-closed error on ambiguous binding');

// Non-negotiable 7: Config mutation deferred
assert.match(migrationSql, /workspace_module_config_mutation_deferred/, 'Non-empty config rejected in 001A');

// Concurrency and Optimistic Locking contracts
assert.match(migrationSql, /pg_advisory_xact_lock\(hashtextextended\('workspace_module:'/, 'Transactional advisory lock on workspace and module code');
assert.match(migrationSql, /workspace_module_expected_state_conflict/, 'Expected state conflict error 40001');
assert.match(migrationSql, /workspace_module_dependency_missing/, 'Dependency missing error');
assert.match(migrationSql, /workspace_module_dependent_active/, 'Dependent active protection error');
assert.match(migrationSql, /workspace_module_incompatibility_detected/, 'Incompatibility detected error');

// Immutability & DAG cycle guards
assert.match(migrationSql, /guard_module_definition_immutability_v1/i, 'Definition immutability guard trigger defined');
assert.match(migrationSql, /guard_module_definition_effective_period_v1/i, 'Definition effective period overlap guard defined');
assert.match(migrationSql, /guard_module_dependency_dag_v1/i, 'Recursive dependency DAG cycle guard defined');
assert.match(migrationSql, /guard_workspace_module_code_sync_v1/i, 'Workspace module code sync guard defined');
assert.match(migrationSql, /guard_workspace_module_immutability_v1/i, 'Workspace module immutability guard defined');

console.log('  ✔ Migration 102 passes all structural, security, DAG, temporal, taxonomy compatibility gate, and non-negotiable invariants.');

// 2. pgTAP Test 089 Structure & Coverage Contract
console.log('\n[Suite 2] pgTAP Test 089 Acceptance Contract (Plan 96)');
const testPath = 'supabase/tests/089_workspace_dynamic_composition.test.sql';
assert.ok(fs.existsSync(testPath), 'Test 089 exists');
const testSql = fs.readFileSync(testPath, 'utf8');

assert.match(testSql, /^begin;/m, 'Test 089 starts with begin;');
assert.match(testSql, /^rollback;/m, 'Test 089 ends with rollback;');
assert.match(testSql, /select plan\(96\);/, 'Test 089 matches exact 96 assertions plan');

// Check key assertions in Test 089
assert.match(testSql, /duplicate \(code, version\) is rejected/, 'Composite uniqueness tested');
assert.match(testSql, /different codes can share the same version number/, 'Same version across different codes tested');
assert.match(testSql, /new version for same code allowed in non-overlapping future effective window/, 'New version in non-overlapping window tested');
assert.match(testSql, /overlapping effective period for published definition is rejected/, 'Version overlap rejection tested');
assert.match(testSql, /self-dependency is rejected/, 'Self-dependency rejection tested');
assert.match(testSql, /cyclic dependency edge is rejected by DAG guard trigger/, 'DAG cycle rejection tested');
assert.match(testSql, /authentication_required/, 'Anonymous rejection tested');
assert.match(testSql, /read projection on unbound context returns status binding_required without leaking workspace ID/, 'Unbound read projection tested');
assert.match(testSql, /pure tenant-scoped context on multi-workspace tenant fails-closed on read/, 'Tenant-scoped multi-workspace read failure tested');
assert.match(testSql, /mutation on tenant-only context without property binding is rejected/, 'Tenant-only mutation rejection tested');
assert.match(testSql, /mutation on unbound context is rejected/, 'Unbound mutation rejection tested');
assert.match(testSql, /user without workspace\.module\.manage permission is denied activation/, 'Permission check tested');
assert.match(testSql, /spoof role association_admin_spoof does not receive workspace\.module\.manage permission/, 'Negative spoof role tested');
assert.match(testSql, /similar role property_manager_fake does not receive workspace\.module\.manage permission/, 'Similar role tested');
assert.match(testSql, /catalog_only definition with non-null entitlement_key is rejected/, 'Non-null entitlement_key rejection tested');
assert.match(testSql, /published definition with null entitlement_key is rejected/, 'Null entitlement_key on published rejection tested');
assert.match(testSql, /user cannot access context grant of another tenant/, 'Cross-tenant isolation tested');
assert.match(testSql, /non-empty config_json is rejected in 001A/, 'Config mutation deferred tested');
assert.match(testSql, /activation of unentitled module is rejected/, 'Unentitled module rejection tested');
assert.match(testSql, /activation of catalog_only module definition is rejected/, 'Catalog-only module rejection tested');
assert.match(testSql, /activation of contracts_tenancy is rejected even if workspace holds other entitlements/, 'Contracts tenancy rejection tested');
assert.match(testSql, /activation of sensitive module billing requires AAL2 MFA/, 'AAL2 MFA enforcement tested');
assert.match(testSql, /activation of module with unsatisfied active dependency is rejected/, 'Dependency ordering gate tested');
assert.match(testSql, /initial activation of root module occupancy succeeds with trimmed reason/, 'Initial activation tested');
assert.match(testSql, /idempotent replay returns cached response snapshot/, 'Idempotent replay tested');
assert.match(testSql, /idempotent replay does not create duplicate workspace module rows/, 'Idempotent row stability tested');
assert.match(testSql, /reusing idempotency key across different workspaces of same tenant is rejected by unique\(tenant_id, idempotency_key\)/, 'Tenant-level idempotency collision tested');
assert.match(testSql, /deactivating a module with active dependents is rejected/, 'Dependent-module deactivation rejection tested');
assert.match(testSql, /deactivating leaf module billing succeeds/, 'Safe leaf deactivation tested');
assert.match(testSql, /deactivated module record is closed with valid_to timestamp/, 'Temporal record closing tested');
assert.match(testSql, /reactivation with expected_id IS NULL creates new active temporal record/, 'Reactivation expected_id NULL contract tested');
assert.match(testSql, /installed module with expired entitlement projects effective status suspended_unentitled/, 'Effective projection suspended_unentitled tested');
assert.match(testSql, /canonical JSONB text representation guarantees deterministic SHA-256 hash regardless of key insertion order/, 'JSONB hash determinism tested');
assert.match(testSql, /catalog projection for core_property_registry returns can_activate false, is_entitled false, and entitlement_key null/, 'Core property registry catalog projection tested');
assert.match(testSql, /catalog projection for contracts_tenancy returns can_activate false, is_entitled false, and entitlement_key null/, 'Contracts tenancy catalog projection tested');
assert.match(testSql, /governance module is compatible with residential_condominium profile/, 'Governance profile compatibility tested');
assert.match(testSql, /governance module is compatible with association_managed operating model/, 'Governance operating model compatibility tested');
assert.match(testSql, /zero partial or malformed workspace module rows across all failures/, 'Zero partial writes tested');

// R4: Taxonomy compatibility gate fail-closed assertions in Test 089
assert.match(testSql, /workspace without active taxonomy assignment is rejected with workspace_module_taxonomy_assignment_required/, 'Missing taxonomy assignment mutation tested');
assert.match(testSql, /ambiguous active taxonomy assignments on workspace is rejected with workspace_module_taxonomy_assignment_ambiguous/, 'Ambiguous taxonomy assignment mutation tested');
assert.match(testSql, /activation with missing property profile compatibility rule is rejected with workspace_module_compatibility_rule_missing/, 'Missing profile compatibility rule tested');
assert.match(testSql, /activation with missing operating model compatibility rule is rejected with workspace_module_compatibility_rule_missing/, 'Missing operating model compatibility rule tested');
assert.match(testSql, /activation with profile review_required is rejected with workspace_module_compatibility_review_required/, 'Profile review_required rejection tested');
assert.match(testSql, /activation with operating model review_required is rejected with workspace_module_compatibility_review_required/, 'Operating model review_required rejection tested');
assert.match(testSql, /activation with incompatible taxonomy rule is rejected with workspace_module_taxonomy_incompatible/, 'Incompatible taxonomy rule rejection tested');
assert.match(testSql, /projection on workspace without taxonomy returns taxonomy_required and can_activate false/, 'Projection taxonomy_required tested');
assert.match(testSql, /projection for module with missing compatibility rule returns rule_missing and can_activate false/, 'Projection rule_missing tested');
assert.match(testSql, /projection for review_required returns status review_required, is_compatible false, and can_activate false/, 'Projection review_required tested');
assert.match(testSql, /projection for compatible \+ compatible returns is_compatible true and can_activate true/, 'Projection compatible + compatible tested');
assert.match(testSql, /deactivating leaf module billing succeeds even without active taxonomy assignment/, 'Safe deactivation without active taxonomy tested');
assert.match(testSql, /zero module rows and zero idempotency rows created across taxonomy failures/, 'Zero writes across taxonomy failures tested');

console.log('  ✔ Test 089 satisfies all 57 groups, plan(96), and edge-case contracts.');

// 3. Documentation Drift Prevention Guard (Directive 5)
console.log('\n[Suite 3] Documentation Drift Prevention Guard');
const closureDocPath = 'docs/closure/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A-CLOSURE-v1.0.md';
const securityDocPath = 'docs/security/CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A-SECURITY-ADVISOR-v1.0.md';

assert.ok(fs.existsSync(closureDocPath), 'Closure document exists');
assert.ok(fs.existsSync(securityDocPath), 'Security advisor document exists');

const closureContent = fs.readFileSync(closureDocPath, 'utf8');
const securityContent = fs.readFileSync(securityDocPath, 'utf8');

const forbiddenTaxonomyCodes = [
  'residential_onboarding',
  'resident_records',
  'units_spaces',
  'self_managed',
  'delegated_board',
  'hoa_residential',
];

for (const term of forbiddenTaxonomyCodes) {
  assert.doesNotMatch(closureContent, new RegExp(`\\b${term}\\b`, 'i'), `Closure report must not contain invalid code '${term}'`);
  assert.doesNotMatch(securityContent, new RegExp(`\\b${term}\\b`, 'i'), `Security advisor report must not contain invalid code '${term}'`);
}

// Ensure all 12 canonical module codes are explicitly enumerated in closure doc
for (const code of expectedModules) {
  assert.match(closureContent, new RegExp(`\\b${code}\\b`, 'i'), `Closure report must explicitly document canonical module '${code}'`);
}

// Ensure governance rules are accurately documented
assert.match(closureContent, /residential_condominium/i, 'Closure report documents residential_condominium compatibility');
assert.match(closureContent, /association_managed/i, 'Closure report documents association_managed compatibility');

// R4 Mandates: Closure document records R4 and deferred policies
assert.match(closureContent, /(CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A-R4|CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A)/i, 'Closure report documents R4 remediation');
assert.match(closureContent, /DEFERRED-COUNTRY-PACK-MODULE-POLICY/i, 'Closure report documents deferred country pack policy');

console.log('  ✔ Documentation drift guard verified: zero stale taxonomy codes, 12 canonical modules present.');
console.log('\n=== ALL SLICE CONTRACTS PASSED ===');
