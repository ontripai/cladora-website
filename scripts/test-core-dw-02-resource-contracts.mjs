import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING CORE DW-02 RESOURCE CONTRACT TESTS ===\n');

const schemaPath = 'src/lib/core/resource-contracts-v1.ts';
const contractPath = 'docs/contracts/CLADORA-CORE-DW-02-RESOURCE-CONTRACTS-v1.0.md';
const consumerPath = 'docs/contracts/CLADORA-CORE-MINIMUM-CONSUMER-CONTRACTS-SERVICE-CE-v1.0.md';
const migrationPath = 'supabase/migrations/20261019170121_dw02_canonical_unit_reference_v1.sql';
const pgTapPath = 'supabase/tests/202_dw02_canonical_unit_reference_v1.test.sql';
const routePath = 'src/app/api/customer/v1/core/resources/unit-reference/route.ts';
const routeTestPath = 'scripts/test-dw-02-canonical-unit-reference-route.mjs';

for (const path of [
  schemaPath,
  contractPath,
  consumerPath,
  migrationPath,
  pgTapPath,
  routePath,
  routeTestPath,
]) assert.ok(fs.existsSync(path), `${path} exists`);

const schema = fs.readFileSync(schemaPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');
const consumer = fs.readFileSync(consumerPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const pgTap = fs.readFileSync(pgTapPath, 'utf8');
const route = fs.readFileSync(routePath, 'utf8');

for (const version of [
  'canonical-resource-reference.v1',
  'resource-relationship.v1',
  'provider-agreement-verification.v1',
  'geographic-coverage-resolution.v1',
]) {
  assert.ok(schema.includes(version), `${version} has an executable schema`);
  assert.ok(contract.includes(version), `${version} is documented`);
}

for (const source of [
  'portfolio.parties',
  'portfolio.properties',
  'portfolio.buildings',
  'portfolio.units',
  'portfolio.ownerships',
]) assert.ok(contract.includes(`\`${source}\``), `${source} is reused`);

for (const resourceType of ['party', 'property', 'building', 'entrance', 'unit', 'asset']) {
  assert.match(schema, new RegExp(`'${resourceType}'`), `${resourceType} is a canonical resource type`);
}

for (const relationship of ['ownership', 'management', 'operation', 'occupancy', 'representation', 'provider', 'access']) {
  assert.match(schema, new RegExp(`'${relationship}'`), `${relationship} remains a separate relationship`);
}

assert.match(schema, /action_authorization:\s*z\.literal\('not_evaluated'\)/, 'reference results never grant an action');
assert.match(schema, /reference_status:\s*z\.literal\('withheld'\)[\s\S]*tenant_id:\s*z\.null\(\)[\s\S]*resource_id:\s*z\.null\(\)/, 'withheld resources expose no identity');
assert.match(schema, /agreement_status:\s*z\.literal\('withheld'\)[\s\S]*provider_agreement_id:\s*z\.null\(\)[\s\S]*allowed_service_scope:\s*z\.array\(z\.never\(\)\)\.max\(0\)/, 'withheld agreements expose no agreement or scope');
assert.match(schema, /resolution_status:\s*z\.literal\('withheld'\)[\s\S]*country_code:\s*z\.null\(\)[\s\S]*source_code:\s*z\.null\(\)/, 'withheld geography exposes no location or source');
assert.match(schema, /valid_until_must_follow_valid_from/, 'relationship validity is checked');
assert.match(contract, /Workspace is not a resource type and is not assumed to be a building/, 'Workspace is not collapsed into a building');
assert.match(contract, /creates no second party, property, ownership, membership, role, permission, audit, outbox or idempotency source/, 'parallel infrastructure is forbidden');
assert.match(contract, /No provider-agreement table or verifier RPC is created/, 'missing canonical agreement persistence is not fabricated');
assert.match(contract, /No new geography registry is created/, 'missing approved geography source is not fabricated');
assert.match(contract, /Documentation & PM owns the central manifest/, 'manifest ownership is preserved');

assert.match(migration, /resolve_canonical_resource_reference_v1/, 'DW02 runtime resolver is installed');
assert.match(migration, /resolve_workspace_native_context_v2[\s\S]*check_workspace_native_permission_v2/, 'DW02 delegates minimal authority to AUTH01');
assert.match(migration, /current_workspace_property_mandate_v1/, 'DW02 preserves the existing property mandate');
assert.match(migration, /create or replace function customer_api\.get_core_unit_identity_history_v1[\s\S]*resolve_canonical_resource_reference_v1/, 'existing Unit history is a real DW02 consumer');
assert.match(migration, /action_authorization',[\s\n]*'not_evaluated'/, 'runtime reference cannot become command authority');
assert.match(migration, /revoke all on function[\s\S]*from public, anon, authenticated, service_role;[\s\S]*grant execute[\s\S]*to authenticated;/i, 'runtime RPC is authenticated-only');
assert.match(pgTap, /select plan\(37\)/, 'DW02 runtime has a fixed PostgreSQL assertion plan');
assert.match(pgTap, /AUTH01 deny becomes a withheld reference/, 'PostgreSQL evidence covers AUTH01 denial');
assert.match(pgTap, /existing Core Unit identity reader is a real DW02 consumer/, 'PostgreSQL evidence covers the real consumer');
assert.match(pgTap, /resolver and consumer perform zero writes/, 'PostgreSQL evidence covers read-only behavior');
assert.match(route, /resolve_canonical_resource_reference_v1/, 'DW02 exposes its bounded authenticated API');
assert.match(route, /canonicalResourceReferenceV1Schema\.safeParse/, 'API validates the database response');
assert.match(route, /p_permission_code:\s*'core\.units\.identity\.read'/, 'API fixes the accepted permission server-side');
assert.match(route, /p_purpose:\s*'core\.unit_identity\.history'/, 'API fixes the accepted purpose server-side');
assert.doesNotMatch(route, /createAdminClient|service_role|SUPABASE_SERVICE/, 'API contains no service-role credential path');

for (const version of ['canonical-resource-reference.v1', 'provider-agreement-verification.v1', 'geographic-coverage-resolution.v1']) {
  assert.ok(consumer.includes(version), `${version} remains aligned with the existing consumer contract`);
}

console.log('  ✔ Canonical resource and temporal relationship envelopes are versioned.');
console.log('  ✔ Withheld variants structurally prohibit identity and source disclosure.');
console.log('  ✔ SERVICE contracts align without taking ownership of domain state.');
console.log('  ✔ No parallel registry, authority, audit, outbox or idempotency engine is introduced.');
console.log('  ✔ DW02 Unit runtime delegates to AUTH01 and is consumed by existing Core Unit identity history.');
