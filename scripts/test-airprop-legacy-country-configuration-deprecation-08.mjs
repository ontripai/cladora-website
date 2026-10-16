import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const migrationsDirectory = 'supabase/migrations';
const migrationNames = readdirSync(migrationsDirectory)
  .filter(name => name.endsWith('.sql')).sort();
const foundationName = '20260914144417_airprop_core_foundation.sql';
const effectiveName = '20261003151604_20261003083859_workspace_scoped_effective_permission.sql';
const nativeName = '20261003151713_20261003142455_airprop_workspace_native_opportunities_v2.sql';
const foundation = read(`${migrationsDirectory}/${foundationName}`);
const effective = read(`${migrationsDirectory}/${effectiveName}`);
const native = read(`${migrationsDirectory}/${nativeName}`);
const contract = read('src/lib/airprop/opportunity-contract-v2.ts');
const idempotency = read('src/lib/airprop/opportunity-idempotency-v2.ts');
const route = read('src/app/api/customer/v2/airprop/opportunities/route.ts');
const ui = read('src/components/customer/CustomerAirpropWorkspace.tsx');
const page = read('src/app/[lang]/app/airprop/page.tsx');
const selector = read('src/lib/core/jurisdiction-profile-selector-v1.ts');
const resolver = read('src/lib/core/jurisdiction-domain-artifact-resolver-v1.ts');
const b2 = read('src/lib/airprop/artifact-b2-contract.ts');
const productionRoute = read('src/app/api/customer/v2/airprop/artifact-b2/route.ts');
const plan = read('docs/roadmap/AIRPROP-LEGACY-COUNTRY-CONFIGURATION-DEPRECATION-08-v1.0.md');

let assertions = 0;
function check(condition, message) {
  assert.ok(condition, message);
  assertions += 1;
}
function matches(value, pattern, message) {
  assert.match(value, pattern, message);
  assertions += 1;
}
function excludes(value, pattern, message) {
  assert.doesNotMatch(value, pattern, message);
  assertions += 1;
}
function walk(root) {
  return readdirSync(root).flatMap(name => {
    const path = `${root}/${name}`;
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}
function definitionFiles(functionName) {
  const escaped = functionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`create(?: or replace)? function\\s+${escaped}\\s*\\(`, 'i');
  return migrationNames.filter(name => pattern.test(read(`${migrationsDirectory}/${name}`)));
}
function functionSlice(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing function marker: ${marker}`);
  const next = source.indexOf('\ncreate ', start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

const sourceRoots = ['src', 'scripts', 'supabase/tests', migrationsDirectory];
const sourceFiles = sourceRoots.flatMap(walk)
  .filter(path => /\.(?:ts|tsx|mjs|sql)$/.test(path)
    && path !== 'scripts/test-airprop-legacy-country-configuration-deprecation-08.mjs');
const occurrenceFiles = symbol => sourceFiles.filter(path => read(path).includes(symbol)).sort();

// Freeze all direct definitions, calls and static readers. A new caller must be
// explicitly added to the deprecation inventory.
assert.deepEqual(occurrenceFiles('configure_airprop_property_v1'), [
  'scripts/test-airprop-legacy-country-defaults-audit-07.mjs',
  'scripts/test-airprop-multi-country-address-entry-contract-06.mjs',
  'supabase/migrations/20260914144417_airprop_core_foundation.sql',
  'supabase/tests/086_airprop_core_foundation.test.sql',
  'supabase/tests/133_airprop_workspace_module_gate.test.sql',
  'supabase/tests/134_airprop_read_core_authorization.test.sql',
]); assertions += 1;
assert.deepEqual(occurrenceFiles('create_airprop_opportunity_v1'), [
  'supabase/migrations/20260914144417_airprop_core_foundation.sql',
  'supabase/tests/086_airprop_core_foundation.test.sql',
  'supabase/tests/134_airprop_read_core_authorization.test.sql',
]); assertions += 1;
assert.deepEqual(occurrenceFiles('create_airprop_opportunity_v2'), [
  'scripts/test-airprop-acquisition-runtime-013.mjs',
  'scripts/test-airprop-diligence-runtime-011.mjs',
  'scripts/test-airprop-diligence-runtime-012.mjs',
  'scripts/test-airprop-legacy-country-defaults-audit-07.mjs',
  'scripts/test-airprop-native-route-004.mjs',
  'scripts/test-airprop-native-runtime-004.mjs',
  'scripts/test-airprop-underwriting-runtime-007.mjs',
  'scripts/test-workspace-role-assignment-runtime.mjs',
  'src/app/api/customer/v2/airprop/opportunities/route.ts',
  'supabase/migrations/20261003151713_20261003142455_airprop_workspace_native_opportunities_v2.sql',
  'supabase/tests/135_workspace_role_assignment_airprop_flow.test.sql',
  'supabase/tests/146_airprop_diligence_drafts.test.sql',
  'supabase/tests/149_airprop_diligence_review.test.sql',
  'supabase/tests/151_airprop_acquisition_decision.test.sql',
  'supabase/tests/170_workspace_role_handover.test.sql',
]); assertions += 1;

assert.deepEqual(definitionFiles('customer_api.configure_airprop_property_v1'),
  [foundationName]); assertions += 1;
assert.deepEqual(definitionFiles('app_private.configure_airprop_property_internal_v1'),
  [foundationName, effectiveName]); assertions += 1;
assert.deepEqual(definitionFiles('customer_api.create_airprop_opportunity_v1'),
  [foundationName]); assertions += 1;
assert.deepEqual(definitionFiles('app_private.create_airprop_opportunity_internal_v1'),
  [foundationName, effectiveName]); assertions += 1;
assert.deepEqual(definitionFiles('customer_api.create_airprop_opportunity_v2'),
  [nativeName]); assertions += 1;
check(migrationNames.indexOf(foundationName) < migrationNames.indexOf(effectiveName)
  && migrationNames.indexOf(effectiveName) < migrationNames.indexOf(nativeName),
'effective SQL order changed');

const publicConfiguration = functionSlice(foundation,
  'create function customer_api.configure_airprop_property_v1');
const effectiveConfiguration = functionSlice(effective,
  'create or replace function app_private.configure_airprop_property_internal_v1');
const effectiveV1 = functionSlice(effective,
  'create or replace function app_private.create_airprop_opportunity_internal_v1');
const effectiveV2 = functionSlice(native,
  'create function customer_api.create_airprop_opportunity_v2');

// Current runtime remains byte-behavior compatible: this task documents its
// retirement without weakening or replacing any current restriction.
matches(publicConfiguration,
  /p_country_pack_code text default 'AIRPROP-RO',p_country_pack_version text default '1\.0'/,
  'public configuration defaults changed');
matches(publicConfiguration, /app_private\.configure_airprop_property_internal_v1/,
  'public wrapper no longer dispatches to the effective internal function');
matches(effectiveConfiguration,
  /p_country_pack_code<>'AIRPROP-RO' or p_country_pack_version<>'1\.0'[\s\S]*airprop_country_pack_not_active/,
  'effective configuration restriction changed');
matches(effectiveConfiguration,
  /insert into airprop\.property_interests[\s\S]*insert into airprop\.property_operating_models[\s\S]*AIRPROP_PROPERTY_CONFIGURED/,
  'legacy configuration evidence writes changed');
excludes(effectiveConfiguration,
  /portfolio\.addresses|property_jurisdiction_assignments|jurisdiction_domain_artifact|country_registry/i,
  'legacy configuration must not gain canonical authority in this package');
matches(effectiveV1, /upper\(coalesce\(p_payload->>'country_code',''\)\)<>'RO'/,
  'effective v1 country restriction changed');
matches(effectiveV1,
  /insert into airprop\.investment_opportunities[\s\S]*'RO'[\s\S]*AIRPROP_OPPORTUNITY_CREATED/,
  'v1 persisted legacy evidence changed');
matches(effectiveV2, /p_payload->>'country_code'<>'RO'/,
  'effective v2 country restriction changed');
matches(effectiveV2,
  /"country_code":"RO"[\s\S]*v_key='airprop\.opportunity\.create\.v2\/'/,
  'v2 canonical payload or idempotency namespace changed');
matches(effectiveV2,
  /insert into airprop\.investment_opportunities[\s\S]*AIRPROP_OPPORTUNITY_CREATED[\s\S]*airprop\.opportunity\.created\.v2[\s\S]*interval '30 days'/,
  'v2 evidence or retention behavior changed');
matches(effective,
  /airprop_opportunity_scope_immutable[\s\S]*before update on airprop\.investment_opportunities/,
  'persisted opportunity scope protection changed');

// Freeze the current product chain and prove that locale/currency/Workspace do
// not generate country. They remain distinct legacy inputs and scope metadata.
matches(page, /CustomerAirpropWorkspace/, 'AIRPROP page no longer mounts the v2 UI');
matches(ui, /country_code:\s*'RO'/, 'UI no longer carries the current explicit legacy literal');
matches(ui, /fetch\('\/api\/customer\/v2\/airprop\/opportunities'/,
  'UI writer route changed');
matches(contract, /country_code:\s*z\.literal\("RO"\)/,
  'v2 contract no longer records its legacy restriction');
matches(route,
  /schema\('customer_api'\)\.rpc\('create_airprop_opportunity_v2'[\s\S]*p_payload:\s*p\.payload/,
  'route no longer forwards only the validated payload');
matches(idempotency,
  /country_code:\s*payload\.country_code[\s\S]*namespace:\s*"airprop\.opportunity\.create\.v2"/,
  'descriptor must preserve the legacy payload and namespace');
excludes([contract, route, ui].join('\n'),
  /accept-language|cf-ipcountry|x-forwarded-for|navigator\.language|resolvedOptions\(\)\.timeZone/i,
  'current product chain must not infer country from locale or request metadata');

// Record the accepted Core building blocks while keeping the missing registry
// and future Property-address move/assignment contract explicit.
matches(selector,
  /join portfolio\.addresses a on a\.id=p\.address_id[\s\S]*platform\.property_jurisdiction_assignments/,
  'Core selector no longer binds Property address to jurisdiction assignment');
matches(selector,
  /selected\.assignment_country_code !== propertyRow\.country_code[\s\S]*selected\.profile_country_code !== propertyRow\.country_code/,
  'Core selector country agreement checks changed');
matches(resolver,
  /selectCurrentPropertyJurisdictionProfileV1[\s\S]*ARTIFACT_UNAVAILABLE[\s\S]*ARTIFACT_INACTIVE/,
  'Core artifact resolver fail-closed chain changed');
check(!readdirSync('src/lib/core').some(name => /canonical-country-registry|country-registry/i.test(name)),
  'canonical-country registry unexpectedly exists and requires plan refresh');

// The document must preserve history, zero-write failure, a bounded compatibility
// window and explicit removal gates rather than treating this audit as authority.
for (const phrase of [
  'CORE-CANONICAL-COUNTRY-REGISTRY-01',
  'Canonical Property address assignment',
  'Official Country Pack/domain artifact resolver',
  'zero writes',
  '30-day v2 idempotency retention horizon',
  'two consecutive release cycles',
  'LEGACY_COUNTRY_CONFIGURATION_RETIRED',
  'PROPERTY_BINDING_REQUIRED',
  'NOT_RUN_NOT_PASS',
  'deprecation_plan_defined_no_runtime_change',
]) matches(plan, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
  `plan is missing required contract: ${phrase}`);
for (const evidence of [
  'airprop.investment_opportunities',
  'AIRPROP_OPPORTUNITY_CREATED',
  'platform.idempotency_keys',
  'airprop.property_interests',
  'airprop.property_operating_models',
  'AIRPROP_PROPERTY_CONFIGURED',
]) matches(plan, new RegExp(evidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  `historical evidence missing from plan: ${evidence}`);
matches(plan,
  /Locale and language[\s\S]*Currency[\s\S]*Workspace identity[\s\S]*`AIRPROP-RO`/,
  'authority-separation proof is incomplete');
matches(plan,
  /never dual-writes[\s\S]*Dependency gate[\s\S]*Successor dark launch[\s\S]*Caller migration[\s\S]*Legacy new-write freeze[\s\S]*Compatibility window[\s\S]*Endpoint removal/,
  'cutover sequence is incomplete');
matches(plan,
  /After the freeze[\s\S]*must not reopen default-driven legacy creation/,
  'rollback must fail closed after the write freeze');

matches(b2, /commands: null, can_edit: false, state: 'pre_activation'/,
  'Artifact B2 state changed');
matches(productionRoute, /runtime: null[\s\S]*portfolio: null/,
  'Production B2 wiring changed');

console.log(JSON.stringify({
  package: 'AIRPROP-LEGACY-COUNTRY-CONFIGURATION-DEPRECATION-08',
  assertions,
  result: 'deprecation_plan_defined_no_runtime_change',
  configure_v1_product_callers: 0,
  opportunity_v1_product_callers: 0,
  opportunity_v2_product_chain: 'UI_ROUTE_RPC',
  legacy_history_rewrite: 'FORBIDDEN',
  canonical_country_registry: 'DEPENDENCY_UNAVAILABLE',
  missing_dependency_behavior: 'FAIL_CLOSED_ZERO_WRITE',
  compatibility_minimum: '30_DAYS_PLUS_TWO_RELEASE_CYCLES',
  product_code_changes: 0,
  runtime_activation: 'PRE_ACTIVATION',
}, null, 2));
