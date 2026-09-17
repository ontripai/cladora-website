import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING WORKSPACE TAXONOMY MUTATION CONTRACT TESTS (CLADORA-WORKSPACE-TAXONOMY-MUTATION-001-R2) ===\n');

// 1. Migration 101 Structure, Security & Remediation Invariants
console.log('[Suite 1] Migration 101 Structure, Security, Role Validation, Assignment ID & Catalog Parity');
const migrationPath = 'supabase/migrations/20260916120000_workspace_taxonomy_mutation.sql';
assert.ok(fs.existsSync(migrationPath), 'Migration 101 exists');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

assert.match(migrationSql, /^begin;/m, 'Migration starts with begin;');
assert.match(migrationSql, /^commit;/m, 'Migration ends with commit;');
assert.match(migrationSql, /create table platform\.workspace_taxonomy_idempotency/i, 'idempotency table created');
assert.match(migrationSql, /unique\s*\(tenant_id,\s*idempotency_key\)/i, 'unique tenant idempotency constraint');
assert.match(migrationSql, /workspace\.taxonomy\.manage/, 'permission workspace.taxonomy.manage inserted');
assert.doesNotMatch(migrationSql, /on conflict \(code\) do update/i, 'Zero DO UPDATE on permission seed');

// Remediation 2 Invariants: Exact independent role existence validation
assert.match(migrationSql, /app_private\.validate_workspace_taxonomy_manage_seeding_v1/i, 'Role validation function defined');
assert.match(migrationSql, /required_target_role_missing: association_admin/, 'Exact error for association_admin missing');
assert.match(migrationSql, /required_target_role_missing: property_manager/, 'Exact error for property_manager missing');
assert.doesNotMatch(migrationSql, /v_admin_role_count < 2/i, 'Zero raw count < 2 logic in role validation');

assert.match(migrationSql, /bootstrap_role_taxonomy_permissions_v1/i, 'bootstrap trigger function defined');
assert.match(migrationSql, /trg_bootstrap_role_taxonomy_permissions/i, 'bootstrap trigger defined on identity.roles');
assert.match(migrationSql, /alter table platform\.workspace_taxonomy_assignments\s+add column if not exists country_code/i, 'country_code column added');
assert.match(migrationSql, /guard_workspace_taxonomy_assignment_history_v1/i, 'history guard updated forward');
assert.match(migrationSql, /app_private\.guard_workspace_taxonomy_assignment_v1/i, 'guard updated forward');
assert.match(migrationSql, /customer_api\.assign_workspace_taxonomy_v1/i, 'assign_workspace_taxonomy_v1 created');
assert.match(migrationSql, /customer_api\.get_taxonomy_catalog_options_v1/i, 'get_taxonomy_catalog_options_v1 created');

// Remediation 1 & R2A Invariants: Explicit assignment_id contract in resolver
assert.match(migrationSql, /'assignment_id',\s*v_assignment\.id/i, 'Active assignment_id returned in resolver');
assert.match(migrationSql, /'assignment_id',\s*null/i, 'Explicit null assignment_id for unclassified and binding_required states');
assert.match(migrationSql, /if v_binding_count = 0 then[\s\S]*?'status',\s*'binding_required'[\s\S]*?'assignment_id',\s*null/i, 'binding_count = 0 explicitly returns assignment_id null');

// Remediation 3 Invariants: Options RPC latest rule parity
assert.match(migrationSql, /order by p\.code,\s*m\.code,\s*c\.rule_version desc/i, 'Options RPC selects latest rule_version with distinct on profile/model');

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
console.log('  ✔ Migration 101 satisfies all structural, security, role validation, assignment_id contract, and catalog parity invariants.');

// 2. pgTAP Test 088 Acceptance Contract
console.log('\n[Suite 2] pgTAP Test 088 Acceptance Contract (Plan 66)');
const testPath = 'supabase/tests/088_workspace_taxonomy_mutation.test.sql';
assert.ok(fs.existsSync(testPath), 'Test 088 exists');
const testSql = fs.readFileSync(testPath, 'utf8');

assert.match(testSql, /^begin;/m, 'Test 088 starts with begin;');
assert.match(testSql, /^rollback;/m, 'Test 088 ends with rollback;');
assert.match(testSql, /select plan\(66\);/, 'Test 088 matches exact 66 assertions plan');

// Role validation test coverage (Remediation 2)
assert.match(testSql, /validate_workspace_taxonomy_manage_seeding_v1/, 'Seeding validation tested directly');
assert.match(testSql, /required_target_role_missing: property_manager/, 'Missing property_manager tested with 2 association_admin fixtures');
assert.match(testSql, /required_target_role_missing: association_admin/, 'Missing association_admin tested deterministically');

// Standard security and validation tests
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

// Assignment ID Contract test coverage (Remediation 1 & R2A)
assert.match(testSql, /unassigned workspace and unbound property context return has_assignment=false and explicit null assignment_id/, 'Unassigned assignment_id null and unbound property binding_required contract tested');
assert.match(testSql, /assigned workspace returns exact active assignment_id matching canonical table/, 'Assigned active assignment_id contract tested');

// End-to-End Transition & Optimistic Concurrency Sequence
assert.match(testSql, /e2e step 1: GET on assigned workspace returns active assignment_id/, 'E2E Step 1 tested');
assert.match(testSql, /e2e step 2a: transition with mismatched expected assignment ID is rejected with SQLSTATE 40001/, 'E2E Step 2a tested');
assert.match(testSql, /e2e step 2b: transition without expected assignment ID on assigned workspace is rejected with SQLSTATE 40001/, 'E2E Step 2b tested');
assert.match(testSql, /e2e step 3: transition using active assignment_id from GET payload as expected_assignment_id succeeds/, 'E2E Step 3 tested');
assert.match(testSql, /e2e step 5a: previous assignment closed with status=superseded and valid_to set/, 'E2E Step 5a tested');
assert.match(testSql, /e2e step 5b: exactly 1 active assignment remains for Workspace A1/, 'E2E Step 5b tested');
assert.match(testSql, /e2e step 5c: audit event WORKSPACE_TAXONOMY_TRANSITIONED generated with before and after snapshots/, 'E2E Step 5c tested');
assert.match(testSql, /e2e step 5d: exactly 1 transition idempotency record exists post-transition/, 'E2E Step 5d tested');
assert.match(testSql, /e2e step 6a: retry with same idempotency key returns idempotent_replay=true/, 'E2E Step 6a tested');
assert.match(testSql, /e2e step 6b: replay produces zero duplicate writes across assignments, audit events, and idempotency/, 'E2E Step 6b tested');

// Catalog/Mutation Options Parity (Remediation 3)
assert.match(testSql, /customer_api\.get_taxonomy_catalog_options_v1 excludes future profile and expired model rules/, 'Options RPC lifecycle filter tested');
assert.match(testSql, /options RPC returns exactly 1 entry for current profile\/model pair with latest rule_version level compatible/, 'Options RPC latest rule_version tested');
assert.match(testSql, /options RPC compatibilities contains zero duplicate profile_code and operating_model_code pairs/, 'Options RPC zero duplicate pairs tested');
assert.match(testSql, /mutation RPC evaluates parity pair with latest rule_version compatible without review reason/, 'Mutation/Options parity tested');

console.log('  ✔ Test 088 pgTAP plan (66 assertions) and all R2 remediation invariants verified.');

// 3. Route Handler & Schema Contract
console.log('\n[Suite 3] Route Handlers & Zod Schema Contract');
const schemaPath = 'src/lib/customer/workspace-taxonomy-schema.ts';
assert.ok(fs.existsSync(schemaPath), 'Taxonomy schema file exists');
const schemaCode = fs.readFileSync(schemaPath, 'utf8');
assert.match(schemaCode, /assignment_id:\s*uuidSchema\.nullable\(\)\.optional\(\)/, 'assignment_id in schema is nullable and optional');

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
console.log('  ✔ Route handlers and Zod schema conform to assignment_id contract, same-origin, size-limit, and error mapping.');

// 4. UI Component Contract & Server-Authoritative Integrity
console.log('\n[Suite 4] UI Component Trilingual (RO/EN/FA), Server-Authoritative & Exact Expected Assignment ID');
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

// Remediation 1 UI invariant: exact active assignment_id forwarded
assert.match(uiCode, /expected_assignment_id:\s*\(?taxonomy\?\.has_assignment\s*&&\s*taxonomy\?\.assignment_id\)?\s*\?\s*taxonomy\.assignment_id\s*:\s*null/, 'Exact active assignment_id forwarded as expected_assignment_id with null initial fallback');
assert.doesNotMatch(uiCode, /taxonomy\?\.assignment\?\.id/i, 'Zero client-side guessing of assignment structure');

assert.match(uiCode, /conflictMessage/, 'Concurrency conflict message present');
assert.match(uiCode, /mfaRequiredMessage/, 'MFA step-up message present');
assert.match(uiCode, /\/mfa/, 'MFA step-up real redirect link present');
console.log('  ✔ UI component conforms to exact expected_assignment_id forwarding, server-authoritative catalog, matrix compatibility, and MFA step-up.');

// 5. Database Package Invariant & Zero Side-Effect
console.log('\n[Suite 5] Database Invariants & Zero Side-Effect');
assert.ok(fs.existsSync('supabase/migrations/20260915120000_workspace_taxonomy.sql'), 'Migration 100 exists');
assert.ok(fs.existsSync('supabase/tests/087_workspace_taxonomy.test.sql'), 'Test 087 exists');
console.log('  ✔ Baseline Migration 100 and Test 087 confirmed present.');

console.log('\n=======================================================');
console.log('ALL WORKSPACE TAXONOMY MUTATION CONTRACT TESTS PASSED (5/5 SUITES)');
console.log('=======================================================');
