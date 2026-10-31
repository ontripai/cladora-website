import assert from 'node:assert/strict';
import fs from 'node:fs';

console.log('=== RUNNING CORE PC-01 TYPED RIGHTS TESTS ===\n');

const schemaPath = 'src/lib/core/product-rights-v1.ts';
const contractPath = 'docs/contracts/CLADORA-CORE-PC-01-TYPED-RIGHTS-v1.0.md';
const evaluatorPath = 'supabase/migrations/20261003151649_20261003122445_workspace_native_context_authority_v2.sql';
const quotaPath = 'supabase/migrations/20260825002400_subscription_plans_contracts_entitlements.sql';
const migrationPath = 'supabase/migrations/20261019183450_pc01_product_capability_projection_v1.sql';
const consumerPath = 'src/app/api/customer/v1/services/catalog/route.ts';

for (const path of [schemaPath, contractPath, evaluatorPath, quotaPath, migrationPath, consumerPath]) assert.ok(fs.existsSync(path), `${path} exists`);

const schema = fs.readFileSync(schemaPath, 'utf8');
const contract = fs.readFileSync(contractPath, 'utf8');
const evaluator = fs.readFileSync(evaluatorPath, 'utf8');
const quota = fs.readFileSync(quotaPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const consumer = fs.readFileSync(consumerPath, 'utf8');

for (const type of ['boolean', 'numeric', 'string', 'array', 'json']) {
  assert.match(schema, new RegExp(`'${type}'`), `${type} is represented`);
  assert.match(contract, new RegExp(`\\| ${type} \\|`), `${type} has a truth-table row`);
}

for (const source of [
  'platform.subscription_plans',
  'platform.workspace_contracts',
  'platform.workspace_entitlements',
  'platform.entitlement_usage_ledger',
  'platform.module_definitions',
  'platform.workspace_modules',
  'app_private.check_effective_permission_v2',
]) assert.ok(contract.includes(`\`${source}\``), `${source} is reused`);

assert.match(evaluator, /override_value_json is not null[\s\S]*override_expires_at > statement_timestamp\(\)[\s\S]*override_value_json = 'true'::jsonb[\s\S]*boolean_value is true or e\.numeric_value > 0/, 'documented availability rule matches the current evaluator');
assert.match(quota, /value_type <> 'numeric'/, 'quota path requires numeric type');
assert.match(quota, /entitlement_usage_ledger/, 'quota path reuses the existing usage ledger');
assert.match(quota, /override_value_json ->> 'numeric_value'/, 'numeric quota override shape is preserved');

assert.match(schema, /kind:\s*z\.literal\('legacy_unprovenanced'\)[\s\S]*contract_id:\s*z\.null\(\)/, 'legacy rights cannot claim a contract');
assert.match(schema, /action_authorization:\s*z\.literal\('not_evaluated'\)/, 'capability projection never authorizes an action');
assert.match(schema, /no_shared_comparator[\s\S]*supported:\s*false/, 'unsupported shared comparisons are explicit');
assert.match(contract, /unsupported type\/purpose combination is `review_required`, never silently truthy/, 'unsupported values fail to review');
assert.match(contract, /available product right does not activate a module/i, 'right does not imply activation');
assert.match(contract, /active module does not create a contractual right/i, 'activation does not imply right');
assert.match(contract, /does not add a competing ledger/, 'parallel product-right ledger is forbidden');
assert.match(contract, /central manifest change/, 'manifest ownership boundary is explicit');
assert.match(migration, /resolve_workspace_native_context_v2/, 'PC01 uses the canonical AUTH01 Workspace resolver');
assert.match(migration, /p_capability_key is distinct from 'module\.services_catalog'/, 'PC01 is bounded to one accepted capability');
assert.match(migration, /action_authorization', 'not_evaluated'/, 'database projection does not authorize actions');
assert.match(migration, /revoke all[\s\S]*service_role[\s\S]*grant execute[\s\S]*to authenticated/, 'projection has authenticated-only direct execution');
assert.doesNotMatch(migration, /\b(insert into|update|delete from)\b/i, 'PC01 projection migration introduces no product-state writes');
assert.match(consumer, /list_service_catalog_v1[\s\S]*get_product_capability_decision_v1/, 'existing operation remains first and consumes PC01 afterward');
assert.match(consumer, /projection\.error[\s\S]*\? null/, 'projection failure is non-blocking');
assert.match(contract, /Full commercial PC-01 is not a prerequisite or runtime gate for PF-01/i, 'full commercial PC01 cannot block PF01');

console.log('  ✔ Current boolean/numeric and quota semantics are pinned without replacement.');
console.log('  ✔ String, array and JSON rights require an accepted domain comparator.');
console.log('  ✔ Legacy rights remain effective without invented contract provenance.');
console.log('  ✔ Product availability, activation and action authority remain separate.');
