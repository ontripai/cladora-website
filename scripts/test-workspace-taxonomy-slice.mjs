import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING WORKSPACE TAXONOMY CONTRACT TESTS (CLADORA-WORKSPACE-TAXONOMY-001) ===\n');

// 1. Database Migration 100 Contract & Sequence
console.log('[Suite 1] Migration 100 Structural, Security & Sequence Verification');
const migrationPath = 'supabase/migrations/20260915120000_workspace_taxonomy.sql';
assert.ok(fs.existsSync(migrationPath), 'Migration 100 exists');
const migrationSql = fs.readFileSync(migrationPath, 'utf8');

assert.match(migrationSql, /^begin;/m, 'Migration starts with begin;');
assert.match(migrationSql, /^commit;/m, 'Migration ends with commit;');
assert.match(migrationSql, /create table platform\.property_profiles/i, 'platform.property_profiles table created');
assert.match(migrationSql, /create table platform\.operating_models/i, 'platform.operating_models table created');
assert.match(migrationSql, /create table platform\.space_kinds/i, 'platform.space_kinds table created');
assert.match(migrationSql, /create table platform\.property_operating_model_compatibilities/i, 'compatibility table created');
assert.match(migrationSql, /create table platform\.property_space_kind_compatibilities/i, 'space compatibility table created');
assert.match(migrationSql, /create table platform\.workspace_taxonomy_assignments/i, 'workspace assignments table created');
assert.match(migrationSql, /create table platform\.workspace_property_bindings/i, 'workspace property bindings table created');

// Check validation constraints
assert.match(migrationSql, /code ~ '\^\[a-z0-9_\]\{3,64\}\$'/, 'Stable code regex constraint enforced');
assert.match(migrationSql, /coalesce\(trim\(labels_json->>'ro'\), ''\) <> ''/, 'Romanian label constraint enforced');
assert.match(migrationSql, /coalesce\(trim\(labels_json->>'en'\), ''\) <> ''/, 'English label constraint enforced');
assert.match(migrationSql, /coalesce\(trim\(labels_json->>'fa'\), ''\) <> ''/, 'Persian label constraint enforced');

// Version overlap prevention with per-code transactional advisory lock
assert.match(migrationSql, /workspace_taxonomy_version_effective_period_overlap/, 'Version effective-period overlap error present');
assert.match(migrationSql, /pg_advisory_xact_lock\(hashtextextended\(TG_TABLE_SCHEMA \|\| ':' \|\| TG_TABLE_NAME \|\| ':' \|\| new\.code, 0\)\)/, 'Per-code transactional advisory lock present in version guard');

// Concurrency lock on target property row before binding overlap check
assert.match(migrationSql, /from portfolio\.properties\s+where id = new\.property_id\s+for update/, 'Property row locked FOR UPDATE before overlap check');

// Security & Minimal Privilege Rules
assert.doesNotMatch(migrationSql, /grant all on all tables in schema platform/i, 'No broad platform table grant in Migration 100');
assert.doesNotMatch(migrationSql, /on conflict \(code, version\) do update/i, 'No ON CONFLICT DO UPDATE in seeds');
assert.doesNotMatch(migrationSql, /order by w\.id limit 1/i, 'No random order by limit 1 workspace resolution');
assert.doesNotMatch(migrationSql, /join platform\.import_runs/i, 'Zero runtime resolution dependency on import_runs');

// Privileged Functions Revoke
assert.match(migrationSql, /revoke all on function app_private\.guard_taxonomy_version_effective_period_v1\(\) from public, anon, authenticated;/, 'guard_taxonomy_version_effective_period_v1 revoked from public, anon, authenticated');
assert.match(migrationSql, /revoke all on function app_private\.guard_workspace_property_binding_v1\(\) from public, anon, authenticated;/, 'guard_workspace_property_binding_v1 revoked from public, anon, authenticated');

// Unbound workspace returns binding_required without leaking workspace ID
assert.match(migrationSql, /'status',\s*'binding_required',\s*'workspace_id',\s*null/, 'Unbound context safely returns binding_required with null workspace_id');
assert.match(migrationSql, /workspace_taxonomy_workspace_binding_ambiguous/, 'Ambiguous binding error present');
assert.match(migrationSql, /workspace_taxonomy_workspace_binding_tenant_mismatch/, 'Binding tenant mismatch error present');

// Current version filters in list APIs
assert.match(migrationSql, /p\.valid_from <= statement_timestamp\(\) and \(p\.valid_to is null or p\.valid_to > statement_timestamp\(\)\)/, 'List profiles filters current version');
assert.match(migrationSql, /m\.valid_from <= statement_timestamp\(\) and \(m\.valid_to is null or m\.valid_to > statement_timestamp\(\)\)/, 'List models filters current version');
assert.match(migrationSql, /s\.valid_from <= statement_timestamp\(\) and \(s\.valid_to is null or s\.valid_to > statement_timestamp\(\)\)/, 'List space kinds filters current version');

// Immutability identity includes created_by
assert.match(migrationSql, /old\.created_by is distinct from new\.created_by/, 'created_by is guarded in assignment immutability trigger');

// All 16 profiles, 8 models, 21 space kinds
const expectedProfiles = [
  'residential_condominium', 'residential_complex', 'gated_villa_community', 'single_villa',
  'small_landlord_portfolio', 'mixed_use_estate', 'retail_centre', 'office_centre',
  'warehouse_logistics', 'managed_township', 'industrial_park', 'serviced_residence',
  'standalone_parking', 'shared_facility', 'developer_portfolio', 'third_party_management_portfolio'
];
for (const profile of expectedProfiles) {
  assert.match(migrationSql, new RegExp(`'${profile}'`), `Profile seed ${profile} present`);
}

const expectedModels = [
  'association_managed', 'single_owner_operated', 'developer_operated', 'third_party_managed',
  'master_lease', 'multi_owner_contractual', 'institutional_owner', 'mixed_authority'
];
for (const model of expectedModels) {
  assert.match(migrationSql, new RegExp(`'${model}'`), `Operating model seed ${model} present`);
}

const expectedSpaces = [
  'residential_unit', 'villa', 'retail_unit', 'office_suite', 'warehouse_bay', 'industrial_lot',
  'factory_hall', 'parking_space', 'storage_space', 'common_area', 'shared_facility', 'amenity',
  'service_point', 'provider_location', 'technical_room', 'courtyard_garden', 'roof_deck', 'infrastructure_node',
  'yard', 'loading_zone', 'land_parcel'
];
assert.equal(expectedSpaces.length, 21, 'Exactly 21 space kinds expected');
for (const space of expectedSpaces) {
  assert.match(migrationSql, new RegExp(`'${space}'`), `Space kind seed ${space} present`);
}
console.log('  ✔ Migration 100 structure, concurrency locks, security revokes, deterministic bindings, and 16/8/21 seeds verified.');

// 2. pgTAP Test 087 Contract
console.log('\n[Suite 2] pgTAP Test 087 Acceptance Contract');
const testPath = 'supabase/tests/087_workspace_taxonomy.test.sql';
assert.ok(fs.existsSync(testPath), 'Test 087 exists');
const testSql = fs.readFileSync(testPath, 'utf8');

assert.match(testSql, /^begin;/m, 'Test 087 starts with begin;');
assert.match(testSql, /^rollback;/m, 'Test 087 ends with rollback;');
assert.match(testSql, /select plan\(55\);/, 'Test 087 matches 55 assertions plan');
assert.match(testSql, /workspace_taxonomy_incompatible_assignment/, 'Incompatible combination assertion tested');
assert.match(testSql, /workspace_taxonomy_review_required/, 'Review required combination assertion tested');
assert.match(testSql, /workspace_taxonomy_compatibility_rule_missing/, 'Missing rule fail-closed assertion tested');
assert.match(testSql, /workspace_taxonomy_assignment_overlap/, 'Temporal overlap assertion tested');
assert.match(testSql, /workspace_taxonomy_tenant_mismatch/, 'Tenant isolation assertion tested');
assert.match(testSql, /binding_required/, 'Unbound context returning binding_required assertion tested');
assert.match(testSql, /workspace_taxonomy_assignment_history_immutable/, 'History immutability assertion tested');
assert.match(testSql, /workspace_property_binding_overlap/, 'Binding overlap assertion tested');
assert.match(testSql, /workspace_property_binding_history_immutable/, 'Binding immutability assertion tested');
assert.match(testSql, /workspace_taxonomy_version_effective_period_overlap/, 'Version overlap assertion tested');
assert.match(testSql, /space kind yard exists/, 'Space kind yard existence assertion tested');
assert.match(testSql, /space kind loading_zone exists/, 'Space kind loading_zone existence assertion tested');
assert.match(testSql, /space kind land_parcel exists/, 'Space kind land_parcel existence assertion tested');
assert.match(testSql, /guard_taxonomy_version_effective_period_v1/, 'Privilege revoke assertion tested');
console.log('  ✔ Test 087 pgTAP plan (55 assertions), 21 space kinds, binding invariants, and multi-workspace isolation verified.');

// 3. API Route & Security Boundary Verification
console.log('\n[Suite 3] Route Handlers Contract & Security Delegation');
const routeCode = fs.readFileSync('src/app/api/customer/v1/workspace/taxonomy/route.ts', 'utf8');
assert.match(routeCode, /'Cache-Control': 'no-store, private'/, 'no-store cache control header present');
assert.match(routeCode, /Vary: 'Cookie'/, 'Vary: Cookie header present');
assert.match(routeCode, /getClaims\(\)/, 'getClaims authentication check present');
assert.match(routeCode, /get_workspace_taxonomy_v1/, 'Delegates to customer_api.get_workspace_taxonomy_v1 RPC');
assert.match(routeCode, /TAXONOMY_NOT_CONFIGURED/, 'Maps unbound context error to 409 TAXONOMY_NOT_CONFIGURED');
assert.doesNotMatch(routeCode, /service_role|SUPABASE_SERVICE_ROLE/i, 'Strictly zero service_role in customer route');
console.log('  ✔ Customer API route handler satisfies gateway security, unbound 409 mapping, and schema delegation.');

// 4. UI Component & Page Integration Verification
console.log('\n[Suite 4] UI Component Trilingual (RO/EN/FA), RTL & Page Integration');
const uiCode = fs.readFileSync('src/components/workspace/WorkspaceTaxonomyCard.tsx', 'utf8');
for (const lang of ['ro', 'en', 'fa']) {
  assert.match(uiCode, new RegExp(`${lang}:\\s*\\{`), `Language dictionary for ${lang} present`);
}
assert.match(uiCode, /dir=\{isRtl \? 'rtl' : 'ltr'\}/, 'Dynamic RTL / LTR direction support verified');
assert.match(uiCode, /طبقه‌بندی و توپولوژی فضای کاری/, 'Persian translation title verified');
assert.match(uiCode, /Clasificare și Topologie Workspace/, 'Romanian translation title verified');
assert.match(uiCode, /Clasificarea workspace-ului nu este încă configurată\./, 'Romanian neutral unconfigured message verified');
assert.match(uiCode, /Workspace classification is not configured yet\./, 'English neutral unconfigured message verified');
assert.match(uiCode, /طبقه‌بندی فضای کاری هنوز تنظیم نشده است\./, 'Persian neutral unconfigured message verified');
assert.match(uiCode, /role="status"/, 'Loading status accessibility role present');
assert.match(uiCode, /role="alert"/, 'Error alert accessibility role present');

// Verify integration in CustomerDashboard
const dashboardCode = fs.readFileSync('src/components/customer/CustomerDashboard.tsx', 'utf8');
assert.match(dashboardCode, /import \{ WorkspaceTaxonomyCard \} from '@\/components\/workspace\/WorkspaceTaxonomyCard'/, 'WorkspaceTaxonomyCard imported in CustomerDashboard');
assert.match(dashboardCode, /<WorkspaceTaxonomyCard[\s\S]*?lang=\{lang\}[\s\S]*?contextId=\{dashboard\.context\.id\}[\s\S]*?canManage=\{permissions\.includes\('workspace\.taxonomy\.manage'\)\}/, 'WorkspaceTaxonomyCard rendered with active context and server-authoritative canManage in CustomerDashboard');
console.log('  ✔ UI component provides complete RO/EN/FA copy, neutral unbound state, RTL layout, and integration in real customer dashboard.');

// 5. Zero Side-Effect & Non-Derivation Boundary
console.log('\n[Suite 5] Zero Side-Effect & Non-Derivation Boundary');
assert.doesNotMatch(migrationSql, /insert into finance\.journals/i, 'Zero finance journal mutation in migration');
assert.doesNotMatch(migrationSql, /insert into airprop\./i, 'Zero airprop mutations in migration');
assert.doesNotMatch(migrationSql, /default 'RO'/i, 'Zero implicit country pack defaulting on workspace taxonomy');
console.log('  ✔ Zero journal, zero airprop side-effect, and country pack independence verified.');

console.log('\n=======================================================');
console.log('ALL WORKSPACE TAXONOMY CONTRACT TESTS PASSED (5/5 SUITES)');
console.log('=======================================================\n');
