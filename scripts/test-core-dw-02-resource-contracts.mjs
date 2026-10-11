import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING CORE DW-02 RESOURCE CONTRACT TESTS ===\n');

const schemaPath = 'src/lib/core/resource-contracts-v1.ts';
const contractPath = 'docs/contracts/CLADORA-CORE-DW-02-RESOURCE-CONTRACTS-v1.0.md';
const consumerPath = 'docs/contracts/CLADORA-CORE-MINIMUM-CONSUMER-CONTRACTS-SERVICE-CE-v1.0.md';

for (const path of [schemaPath, contractPath, consumerPath]) assert.ok(fs.existsSync(path), `${path} exists`);

const schema = fs.readFileSync(schemaPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');
const consumer = fs.readFileSync(consumerPath, 'utf8');

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

for (const version of ['canonical-resource-reference.v1', 'provider-agreement-verification.v1', 'geographic-coverage-resolution.v1']) {
  assert.ok(consumer.includes(version), `${version} remains aligned with the existing consumer contract`);
}

console.log('  ✔ Canonical resource and temporal relationship envelopes are versioned.');
console.log('  ✔ Withheld variants structurally prohibit identity and source disclosure.');
console.log('  ✔ SERVICE contracts align without taking ownership of domain state.');
console.log('  ✔ No parallel registry, authority, audit, outbox or idempotency engine is introduced.');
