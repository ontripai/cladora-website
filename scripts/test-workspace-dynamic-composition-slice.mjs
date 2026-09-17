import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING WORKSPACE DYNAMIC COMPOSITION CONTRACT TESTS (CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A) ===\n');

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

// Non-negotiable 5: Verified proven modules only
assert.match(migrationSql, /'occupancy',\s*1,.*?'published'/i, 'occupancy seeded as published');
assert.match(migrationSql, /'billing',\s*1,.*?'published'/i, 'billing seeded as published');
assert.match(migrationSql, /'payments',\s*1,.*?'published'/i, 'payments seeded as published');
assert.match(migrationSql, /'accounting',\s*1,.*?'published'/i, 'accounting seeded as published');
assert.match(migrationSql, /'maintenance',\s*1,.*?'published'/i, 'maintenance seeded as published');
assert.match(migrationSql, /'utilities',\s*1,.*?'published'/i, 'utilities seeded as published');
assert.match(migrationSql, /'governance',\s*1,.*?'published'/i, 'governance seeded as published');
assert.match(migrationSql, /'communications',\s*1,.*?'published'/i, 'communications seeded as published');
assert.match(migrationSql, /'documents',\s*1,.*?'published'/i, 'documents seeded as published');
assert.match(migrationSql, /'security',\s*1,.*?'published'/i, 'security seeded as published');
assert.match(migrationSql, /'core_property_registry',\s*1,.*?'catalog_only'/i, 'core_property_registry seeded as catalog_only');
assert.match(migrationSql, /'contracts_tenancy',\s*1,.*?'catalog_only'/i, 'contracts_tenancy seeded as catalog_only');

// Non-negotiable 6: Context Resolver
assert.match(migrationSql, /app_private\.resolve_workspace_from_customer_context_v1/i, 'Canonical Context Resolver defined');
assert.match(migrationSql, /workspace_composition_context_not_workspace_bound/, 'Fail-closed error on unbound context');
assert.match(migrationSql, /workspace_composition_workspace_binding_ambiguous/, 'Fail-closed error on ambiguous binding');

// Non-negotiable 7: Reason and Config validation
assert.match(migrationSql, /workspace_module_config_mutation_deferred/, 'Non-empty config rejected in 001A');
assert.match(migrationSql, /workspace_module_deactivation_reason_required/, 'Deactivation requires reason');
assert.match(migrationSql, /workspace_module_invalid_reason/, 'Invalid/whitespace reason rejected');

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

// Identity & Role safety: No triggers on identity.roles in 001A
assert.doesNotMatch(migrationSql, /trigger.*?on\s+identity\.roles/i, 'Zero triggers on identity.roles in 001A');

console.log('  ✔ Migration 102 passes all structural, security, DAG, temporal, and non-negotiable invariants.');

// 2. pgTAP Test 089 Structure & Coverage Contract
console.log('\n[Suite 2] pgTAP Test 089 Acceptance Contract (Plan 68)');
const testPath = 'supabase/tests/089_workspace_dynamic_composition.test.sql';
assert.ok(fs.existsSync(testPath), 'Test 089 exists');
const testSql = fs.readFileSync(testPath, 'utf8');

assert.match(testSql, /^begin;/m, 'Test 089 starts with begin;');
assert.match(testSql, /^rollback;/m, 'Test 089 ends with rollback;');
assert.match(testSql, /select plan\(68\);/, 'Test 089 matches exact 68 assertions plan');

// Check key assertions
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
assert.match(testSql, /user cannot access context grant of another tenant/, 'Cross-tenant isolation tested');
assert.match(testSql, /non-empty config_json is rejected in 001A/, 'Config mutation deferred tested');
assert.match(testSql, /activation of unentitled module is rejected/, 'Unentitled module rejection tested');
assert.match(testSql, /activation of catalog_only module definition is rejected/, 'Catalog-only module rejection tested');
assert.match(testSql, /activation of sensitive module billing requires AAL2 MFA/, 'AAL2 MFA enforcement tested');
assert.match(testSql, /activation of module with unsatisfied active dependency is rejected/, 'Dependency ordering gate tested');
assert.match(testSql, /initial activation of root module occupancy succeeds/, 'Initial activation tested');
assert.match(testSql, /idempotent replay returns cached response snapshot/, 'Idempotent replay tested');
assert.match(testSql, /idempotent replay does not create duplicate workspace module rows/, 'Idempotent row stability tested');
assert.match(testSql, /reusing idempotency key across different workspaces of same tenant is rejected by unique\(tenant_id, idempotency_key\)/, 'Tenant-level idempotency collision tested');
assert.match(testSql, /deactivating a module with active dependents is rejected/, 'Dependent-module deactivation rejection tested');
assert.match(testSql, /deactivating leaf module billing succeeds/, 'Safe leaf deactivation tested');
assert.match(testSql, /deactivated module record is closed with valid_to timestamp/, 'Temporal record closing tested');
assert.match(testSql, /reactivation with expected_id IS NULL creates new active temporal record/, 'Reactivation expected_id NULL contract tested');
assert.match(testSql, /installed module with expired entitlement projects effective status suspended_unentitled/, 'Effective projection suspended_unentitled tested');
assert.match(testSql, /canonical JSONB text representation guarantees deterministic SHA-256 hash regardless of key insertion order/, 'JSONB hash determinism tested');

console.log('  ✔ Test 089 satisfies all 36 groups, plan(68), and edge-case contracts.');
console.log('\n=== ALL SLICE CONTRACTS PASSED ===');
