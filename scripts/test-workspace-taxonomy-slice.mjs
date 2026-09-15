import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('=== RUNNING WORKSPACE TAXONOMY CONTRACT TESTS (CLADORA-WORKSPACE-TAXONOMY-001) ===\n');

// 1. Database Migration 100 Contract
console.log('[Suite 1] Migration 100 Structural & Seed Verification');
const migrationSql = fs.readFileSync('supabase/migrations/20260915120000_workspace_taxonomy.sql', 'utf8');

assert.match(migrationSql, /^begin;/m, 'Migration starts with begin;');
assert.match(migrationSql, /^commit;/m, 'Migration ends with commit;');
assert.match(migrationSql, /create table platform\.property_profiles/i, 'platform.property_profiles table created');
assert.match(migrationSql, /create table platform\.operating_models/i, 'platform.operating_models table created');
assert.match(migrationSql, /create table platform\.space_kinds/i, 'platform.space_kinds table created');
assert.match(migrationSql, /create table platform\.property_operating_model_compatibilities/i, 'compatibility table created');
assert.match(migrationSql, /create table platform\.property_space_kind_compatibilities/i, 'space compatibility table created');
assert.match(migrationSql, /create table platform\.workspace_taxonomy_assignments/i, 'workspace assignments table created');

// Check all 16 property profile seeds
const expectedProfiles = [
  'residential_condominium', 'residential_complex', 'gated_villa_community', 'single_villa',
  'small_landlord_portfolio', 'mixed_use_estate', 'retail_centre', 'office_centre',
  'warehouse_logistics', 'managed_township', 'industrial_park', 'serviced_residence',
  'standalone_parking', 'shared_facility', 'developer_portfolio', 'third_party_management_portfolio'
];
for (const profile of expectedProfiles) {
  assert.match(migrationSql, new RegExp(`'${profile}'`), `Profile seed ${profile} present in Migration 100`);
}

// Check all 8 operating model seeds
const expectedModels = [
  'association_managed', 'single_owner_operated', 'developer_operated', 'third_party_managed',
  'master_lease', 'multi_owner_contractual', 'institutional_owner', 'mixed_authority'
];
for (const model of expectedModels) {
  assert.match(migrationSql, new RegExp(`'${model}'`), `Operating model seed ${model} present in Migration 100`);
}

// Check all 18 space kind seeds
const expectedSpaces = [
  'residential_unit', 'villa', 'retail_unit', 'office_suite', 'warehouse_bay', 'industrial_lot',
  'factory_hall', 'parking_space', 'storage_space', 'common_area', 'shared_facility', 'amenity',
  'service_point', 'provider_location', 'technical_room', 'yard', 'loading_zone', 'land_parcel'
];
for (const space of expectedSpaces) {
  assert.match(migrationSql, new RegExp(`'${space}'`), `Space kind seed ${space} present in Migration 100`);
}
console.log('  ✔ Migration 100 structure, 16 profiles, 8 operating models and 18 space kinds verified.');

// 2. pgTAP Test 087 Contract
console.log('\n[Suite 2] pgTAP Test 087 Acceptance Contract');
const testSql = fs.readFileSync('supabase/tests/087_workspace_taxonomy.test.sql', 'utf8');
assert.match(testSql, /^begin;/m, 'Test 087 starts with begin;');
assert.match(testSql, /^rollback;/m, 'Test 087 ends with rollback;');
assert.match(testSql, /select plan\(31\);/, 'Test 087 matches 31 assertions plan');
assert.match(testSql, /workspace_taxonomy_incompatible_assignment/, 'Incompatible combination assertion tested');
assert.match(testSql, /workspace_taxonomy_review_required/, 'Review required combination assertion tested');
assert.match(testSql, /workspace_taxonomy_compatibility_rule_missing/, 'Missing rule fail-closed assertion tested');
assert.match(testSql, /workspace_taxonomy_assignment_overlap/, 'Temporal overlap assertion tested');
assert.match(testSql, /workspace_taxonomy_tenant_mismatch/, 'Tenant isolation assertion tested');
console.log('  ✔ Test 087 pgTAP plan and assertion coverage verified.');

// 3. API Route & Security Boundary Verification
console.log('\n[Suite 3] Route Handlers Contract & Security Delegation');
const routeCode = fs.readFileSync('src/app/api/customer/v1/workspace/taxonomy/route.ts', 'utf8');
assert.match(routeCode, /'Cache-Control': 'no-store, private'/, 'no-store cache control header present');
assert.match(routeCode, /Vary: 'Cookie'/, 'Vary: Cookie header present');
assert.match(routeCode, /getClaims\(\)/, 'getClaims authentication check present');
assert.match(routeCode, /get_workspace_taxonomy_v1/, 'Delegates to customer_api.get_workspace_taxonomy_v1 RPC');
assert.doesNotMatch(routeCode, /service_role|SUPABASE_SERVICE_ROLE/i, 'Strictly zero service_role in customer route');
console.log('  ✔ Customer API route handler satisfies gateway security and schema delegation.');

// 4. UI Component Trilingual & RTL Verification
console.log('\n[Suite 4] UI Component Trilingual (RO/EN/FA) & RTL Integrity');
const uiCode = fs.readFileSync('src/components/workspace/WorkspaceTaxonomyCard.tsx', 'utf8');
for (const lang of ['ro', 'en', 'fa']) {
  assert.match(uiCode, new RegExp(`${lang}:\\s*\\{`), `Language dictionary for ${lang} present`);
}
assert.match(uiCode, /dir=\{isRtl \? 'rtl' : 'ltr'\}/, 'Dynamic RTL / LTR direction support verified');
assert.match(uiCode, /طبقه‌بندی و توپولوژی فضای کاری/, 'Persian translation title verified');
assert.match(uiCode, /Clasificare și Topologie Workspace/, 'Romanian translation title verified');
console.log('  ✔ UI component provides complete RO/EN/FA copy and native RTL layout.');

// 5. Zero-Side-Effect & Invariant Boundary Verification
console.log('\n[Suite 5] Zero Side-Effect & Non-Derivation Boundary');
assert.doesNotMatch(migrationSql, /insert into finance\.journals/i, 'Zero finance journal mutation in migration');
assert.doesNotMatch(migrationSql, /insert into airprop\./i, 'Zero airprop mutations in migration');
assert.doesNotMatch(migrationSql, /default 'RO'/i, 'Zero implicit country pack defaulting on workspace taxonomy');
console.log('  ✔ Zero journal, zero airprop side-effect, and country pack independence verified.');

console.log('\n=======================================================');
console.log('ALL WORKSPACE TAXONOMY CONTRACT TESTS PASSED (5/5 SUITES)');
console.log('=======================================================\n');
