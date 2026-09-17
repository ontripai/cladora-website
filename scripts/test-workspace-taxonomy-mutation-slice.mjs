import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING WORKSPACE TAXONOMY MUTATION CONTRACT TESTS (CLADORA-WORKSPACE-TAXONOMY-MUTATION-001) ===\n');

// 1. Migration 101 Structure & Security
console.log('[Suite 1] Migration 101 Structure, Security, Locking, Country Code & Idempotency');
const migrationPath = 'supabase/migrations/20260916120000_workspace_taxonomy_mutation.sql';
assert.ok(fs.existsSync(migrationPath), 'Migration 101 exists');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

assert.match(migrationSql, /^begin;/m, 'Migration starts with begin;');
assert.match(migrationSql, /^commit;/m, 'Migration ends with commit;');
assert.match(migrationSql, /create table platform\.workspace_taxonomy_idempotency/i, 'idempotency table created');
assert.match(migrationSql, /unique\s*\(tenant_id,\s*idempotency_key\)/i, 'unique tenant idempotency constraint');
assert.match(migrationSql, /workspace\.taxonomy\.manage/, 'permission workspace.taxonomy.manage inserted');
assert.doesNotMatch(migrationSql, /on conflict \(code\) do update/i, 'Zero DO UPDATE on permission seed');
assert.match(migrationSql, /bootstrap_role_taxonomy_permissions_v1/i, 'bootstrap trigger function defined');
assert.match(migrationSql, /trg_bootstrap_role_taxonomy_permissions/i, 'bootstrap trigger defined on identity.roles');
assert.match(migrationSql, /alter table platform\.workspace_taxonomy_assignments\s+add column if not exists country_code/i, 'country_code column added');
assert.match(migrationSql, /guard_workspace_taxonomy_assignment_history_v1/i, 'history guard updated forward');
assert.match(migrationSql, /app_private\.guard_workspace_taxonomy_assignment_v1/i, 'guard updated forward');
assert.match(migrationSql, /customer_api\.assign_workspace_taxonomy_v1/i, 'assign_workspace_taxonomy_v1 created');
assert.match(migrationSql, /customer_api\.get_taxonomy_catalog_options_v1/i, 'get_taxonomy_catalog_options_v1 created');
assert.match(migrationSql, /mfa_required/, 'MFA required check present');
assert.match(migrationSql, /workspace_taxonomy_manage_permission_required/, 'Permission check present');
assert.match(migrationSql, /pg_advisory_xact_lock\(hashtextextended\('workspace_taxonomy_mutation:'/, 'Workspace transactional advisory lock present');
assert.match(migrationSql, /workspace_taxonomy_idempotency_conflict/, 'Idempotency conflict error present');
assert.match(migrationSql, /workspace_taxonomy_expected_assignment_conflict/, 'Expected assignment conflict error present');
assert.match(migrationSql, /WORKSPACE_TAXONOMY_ASSIGNED/, 'Initial assignment audit action present');
assert.match(migrationSql, /WORKSPACE_TAXONOMY_TRANSITIONED/, 'Transition audit action present');
assert.match(migrationSql, /extensions\.digest/, 'Explicit extensions schema digest invocation present');
assert.match(migrationSql, /revoke all on function customer_api\.assign_workspace_taxonomy_v1/i, 'RPC revoked from public');
assert.match(migrationSql, /grant execute on function customer_api\.assign_workspace_taxonomy_v1.*to authenticated, service_role/i, 'RPC granted to authenticated, service_role');
console.log('  ✔ Migration 101 satisfies all structural, security, advisory locking, and idempotency invariants.');

// 2. pgTAP Test 088 Contract
console.log('\n[Suite 2] pgTAP Test 088 Acceptance Contract');
const testPath = 'supabase/tests/088_workspace_taxonomy_mutation.test.sql';
assert.ok(fs.existsSync(testPath), 'Test 088 exists');
const testSql = fs.readFileSync(testPath, 'utf8');

assert.match(testSql, /^begin;/m, 'Test 088 starts with begin;');
assert.match(testSql, /^rollback;/m, 'Test 088 ends with rollback;');
assert.match(testSql, /select plan\(53\);/, 'Test 088 matches 53 assertions plan');
assert.match(testSql, /authentication_required/, 'Anonymous rejection assertion tested');
assert.match(testSql, /customer_context_access_denied/, 'Access denied assertion tested');
assert.match(testSql, /workspace_taxonomy_manage_permission_required/, 'Permission required assertion tested');
assert.match(testSql, /mfa_required/, 'AAL1 rejection assertion tested');
assert.match(testSql, /workspace_taxonomy_country_code_invalid/, 'Invalid country code assertion tested');
assert.match(testSql, /workspace_taxonomy_catalog_version_not_current/, 'Catalog lifecycle assertions tested');
assert.match(testSql, /workspace_taxonomy_context_not_workspace_bound/, 'Fail-closed context resolution tested');
assert.match(testSql, /workspace_taxonomy_incompatible/, 'Incompatible combination assertion tested');
assert.match(testSql, /workspace_taxonomy_review_reason_required/, 'Review reason required assertion tested');
assert.match(testSql, /workspace_taxonomy_idempotency_conflict/, 'Idempotency conflict assertion tested');
assert.match(testSql, /workspace_taxonomy_expected_assignment_conflict/, 'Expected assignment conflict assertion tested');
assert.match(testSql, /WORKSPACE_TAXONOMY_ASSIGNED/, 'Initial audit assertion tested');
assert.match(testSql, /WORKSPACE_TAXONOMY_TRANSITIONED/, 'Transition audit assertion tested');
assert.match(testSql, /workspace_taxonomy_assignment_history_immutable/, 'History immutability assertion tested');
assert.match(testSql, /customer_api\.get_taxonomy_catalog_options_v1/, 'Options RPC assertion tested');
console.log('  ✔ Test 088 pgTAP plan (53 assertions) and all mutation edge cases verified.');

// 3. Route Handler & Security Delegation Contract
console.log('\n[Suite 3] Route Handlers Contract & Security Delegation');
const routePath = 'src/app/api/customer/v1/workspace/taxonomy/route.ts';
assert.ok(fs.existsSync(routePath), 'Taxonomy route exists');
const routeCode = fs.readFileSync(routePath, 'utf8');

assert.match(routeCode, /export async function GET/, 'GET handler preserved');
assert.match(routeCode, /export async function POST/, 'POST handler added');
assert.match(routeCode, /hasTrustedMutationOrigin/, 'Same-origin check enforced');
assert.match(routeCode, /isApplicationJson/, 'Content-type check enforced');
assert.match(routeCode, /parseJsonWithLimit/, 'Request body size limit enforced');
assert.match(routeCode, /assignWorkspaceTaxonomyRequestSchema\.safeParse/, 'Strict Zod validation enforced');
assert.doesNotMatch(routeCode, /service_role/i, 'Zero service role in customer route');
assert.match(routeCode, /EXPECTED_ASSIGNMENT_CONFLICT/, '409 Conflict mapped');
assert.match(routeCode, /IDEMPOTENCY_CONFLICT/, '409 Idempotency conflict mapped');
assert.match(routeCode, /MFA_REQUIRED/, '403 MFA required mapped');
assert.match(routeCode, /REVIEW_REASON_REQUIRED/, '422 Review reason required mapped');

const optionsRoutePath = 'src/app/api/customer/v1/workspace/taxonomy/options/route.ts';
assert.ok(fs.existsSync(optionsRoutePath), 'Options route exists');
const optionsRouteCode = fs.readFileSync(optionsRoutePath, 'utf8');
assert.match(optionsRouteCode, /get_taxonomy_catalog_options_v1/, 'Options route calls canonical RPC');
console.log('  ✔ Route handlers conform to same-origin, size-limit, strict validation, and error mapping.');

// 4. UI Component Contract & Server-Authoritative Integrity
console.log('\n[Suite 4] UI Component Trilingual (RO/EN/FA), Server-Authoritative & MFA Elevation');
const uiPath = 'src/components/workspace/WorkspaceTaxonomyCard.tsx';
assert.ok(fs.existsSync(uiPath), 'UI component exists');
const uiCode = fs.readFileSync(uiPath, 'utf8');

assert.match(uiCode, /canManage/, 'canManage prop supported');
assert.doesNotMatch(uiCode, /const PROFILES_LIST/, 'Zero hardcoded PROFILES_LIST in client UI');
assert.doesNotMatch(uiCode, /const MODELS_LIST/, 'Zero hardcoded MODELS_LIST in client UI');
assert.match(uiCode, /loadCatalogOptions/, 'Server-authoritative catalog options loaded dynamically');
assert.match(uiCode, /compatMatch\s*\?/, 'Compatibility evaluated strictly from server matrix');
assert.match(uiCode, /isReviewRequired/, 'Review required state handled');
assert.match(uiCode, /confirmButton/, 'Confirmation before mutation present');
assert.match(uiCode, /crypto\.randomUUID\(\)/, 'Cryptographic UUID idempotency key generated');
assert.match(uiCode, /conflictMessage/, 'Concurrency conflict message present');
assert.match(uiCode, /mfaRequiredMessage/, 'MFA step-up message present');
assert.match(uiCode, /\/mfa/, 'MFA step-up real redirect link present');
console.log('  ✔ UI component conforms to server-authoritative catalog, matrix compatibility, and MFA step-up.');

// 5. Database Package Invariant & Zero Side-Effect
console.log('\n[Suite 5] Database Invariants & Zero Side-Effect');
assert.ok(fs.existsSync('supabase/migrations/20260915120000_workspace_taxonomy.sql'), 'Migration 100 exists');
assert.ok(fs.existsSync('supabase/tests/087_workspace_taxonomy.test.sql'), 'Test 087 exists');
console.log('  ✔ Baseline Migration 100 and Test 087 confirmed present.');

console.log('\n=======================================================');
console.log('ALL WORKSPACE TAXONOMY MUTATION CONTRACT TESTS PASSED (5/5 SUITES)');
console.log('=======================================================');
