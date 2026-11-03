import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const migrationsDirectory = 'supabase/migrations';
const migrationNames = readdirSync(migrationsDirectory)
  .filter(name => name.endsWith('.sql')).sort();
const migrations = migrationNames.map(name => read(`${migrationsDirectory}/${name}`)).join('\n');
const audit = read('docs/airprop/AIRPROP-LEGACY-COUNTRY-DEFAULTS-AUDIT-07-v1.0.md');
const foundationName = '20260914144417_airprop_core_foundation.sql';
const effectiveName = '20261003151604_20261003083859_workspace_scoped_effective_permission.sql';
const v2Name = '20261003151713_20261003142455_airprop_workspace_native_opportunities_v2.sql';
const reportName = '20261009121000_airprop_management_portfolio_report_v1.sql';
const addressName = '20260825000300_portfolio_properties_buildings_units.sql';
const jurisdictionName = '20261015183000_core_jurisdiction_profile_v1.sql';
const foundation = read(`${migrationsDirectory}/${foundationName}`);
const effective = read(`${migrationsDirectory}/${effectiveName}`);
const v2 = read(`${migrationsDirectory}/${v2Name}`);
const report = read(`${migrationsDirectory}/${reportName}`);
const address = read(`${migrationsDirectory}/${addressName}`);
const jurisdiction = read(`${migrationsDirectory}/${jurisdictionName}`);
const opportunityContract = read('src/lib/airprop/opportunity-contract-v2.ts');
const opportunityIdempotency = read('src/lib/airprop/opportunity-idempotency-v2.ts');
const opportunityUi = read('src/components/customer/CustomerAirpropWorkspace.tsx');
const opportunityRoute = read('src/app/api/customer/v2/airprop/opportunities/route.ts');
const valuationContract = read('src/lib/airprop/valuation-contract-v1.ts');
const formatter = read('src/config/formatters.ts');
const taxonomyUi = read('src/components/workspace/WorkspaceTaxonomyCard.tsx');
const importSchema = read('src/lib/customer/onboarding-import-schema.ts');
const importRuntime = read(`${migrationsDirectory}/20260913063638_residential_pilot_import_completion.sql`);
const b2 = read('src/lib/airprop/artifact-b2-contract.ts');
const b2Http = read('src/lib/airprop/artifact-b2-read-http-v1.ts');
const productionRoute = read('src/app/api/customer/v2/airprop/artifact-b2/route.ts');

let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions += 1; };
const matches = (value, pattern, message) => {
  assert.match(value, pattern, message); assertions += 1;
};
const excludes = (value, pattern, message) => {
  assert.doesNotMatch(value, pattern, message); assertions += 1;
};

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

function sliceFunction(source, marker) {
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `missing function marker: ${marker}`);
  const next = source.indexOf('\ncreate ', start + marker.length);
  return source.slice(start, next === -1 ? source.length : next);
}

// Filename order determines the effective SQL definition. Freeze both history
// and the last live body so an older occurrence cannot be misreported as live.
check(migrationNames.indexOf(addressName) < migrationNames.indexOf(jurisdictionName),
  'DROP DEFAULT migration must follow the historical address default');
check(migrationNames.indexOf(foundationName) < migrationNames.indexOf(effectiveName)
  && migrationNames.indexOf(effectiveName) < migrationNames.indexOf(v2Name),
'AIRPROP replacement and v2 order changed');
assert.deepEqual(definitionFiles('app_private.create_airprop_opportunity_internal_v1'),
  [foundationName, effectiveName]); assertions += 1;
assert.deepEqual(definitionFiles('app_private.configure_airprop_property_internal_v1'),
  [foundationName, effectiveName]); assertions += 1;
assert.deepEqual(definitionFiles('customer_api.configure_airprop_property_v1'),
  [foundationName]); assertions += 1;
assert.deepEqual(definitionFiles('customer_api.create_airprop_opportunity_v2'),
  [v2Name]); assertions += 1;
assert.deepEqual(definitionFiles('customer_api.read_airprop_management_portfolio_v1'),
  [reportName]); assertions += 1;

const effectiveV1Opportunity = sliceFunction(effective,
  'create or replace function app_private.create_airprop_opportunity_internal_v1');
const effectiveConfiguration = sliceFunction(effective,
  'create or replace function app_private.configure_airprop_property_internal_v1');
const publicConfiguration = sliceFunction(foundation,
  'create function customer_api.configure_airprop_property_v1');
const publicV2Opportunity = sliceFunction(v2,
  'create function customer_api.create_airprop_opportunity_v2');

matches(effectiveV1Opportunity, /upper\(coalesce\(p_payload->>'country_code',''\)\)<>'RO'/,
  'effective v1 opportunity must retain its exact legacy RO restriction');
excludes(effectiveV1Opportunity, /portfolio\.addresses|jurisdiction_profiles|country_pack|compliance/i,
  'opportunity snapshot must not become address or Country Pack authority');
matches(publicConfiguration,
  /p_country_pack_code text default 'AIRPROP-RO',p_country_pack_version text default '1\.0'/,
  'live public configuration defaults changed');
matches(publicConfiguration, /app_private\.configure_airprop_property_internal_v1/,
  'public configuration wrapper must dispatch to the replaced internal signature');
matches(effectiveConfiguration,
  /p_country_pack_code<>'AIRPROP-RO' or p_country_pack_version<>'1\.0'[\s\S]*airprop_country_pack_not_active/,
  'effective configuration must retain the exact AIRPROP-RO v1.0 restriction');
excludes(effectiveConfiguration, /portfolio\.addresses|country_code|jurisdiction|compliance/i,
  'legacy property configuration must not become address or compliance authority');
matches(publicV2Opportunity, /p_payload->>'country_code'<>'RO'/,
  'live v2 SQL must retain its declared legacy RO restriction');
matches(publicV2Opportunity, /"country_code":"RO"/,
  'v2 idempotency input must retain the exact declared opportunity country');
excludes(publicV2Opportunity, /portfolio\.addresses|country_pack|compliance/i,
  'v2 opportunity must not become address or Country Pack authority');

// Product TypeScript preserves the same fixed legacy opportunity contract. It
// does not inspect presentation or request metadata to infer country.
matches(opportunityContract, /country_code:\s*z\.literal\("RO"\)/,
  'opportunity contract legacy country changed');
matches(opportunityUi, /country_code:\s*'RO'/,
  'opportunity UI legacy literal changed');
matches(opportunityIdempotency, /country_code:\s*payload\.country_code/,
  'idempotency descriptor must preserve rather than infer the input country');
matches(opportunityRoute, /p_payload:\s*p\.payload/,
  'route must pass only the validated explicit payload');
const airpropRuntimeSources = walk('src/lib/airprop')
  .concat(walk('src/app/api/customer/v2/airprop'))
  .concat(walk('src/components/customer').filter(path => /CustomerAirprop[^/]*\.tsx$/.test(path)))
  .map(read).join('\n');
excludes(airpropRuntimeSources,
  /accept-language|x-forwarded-for|cf-ipcountry|navigator\.language|resolvedOptions\(\)\.timeZone/i,
  'AIRPROP runtime must not infer country from locale, browser, network or timezone metadata');
excludes(airpropRuntimeSources,
  /country_code\s*[:=]\s*[^,;\n]{0,100}\b(?:locale|language|currency|timezone|phone|workspace|tenant)\b|(?:defaultCountry|countryDefault|inferredCountry|resolvedCountry)\s*[:=]\s*[^,;\n]{0,100}\b(?:locale|language|currency|timezone|phone|workspace|tenant)\b/i,
  'AIRPROP runtime must not derive country from locale, currency or scope defaults');

// Workspace taxonomy is explicit configuration and has no RO fallback. It is
// not consumed as AIRPROP address authority.
matches(taxonomyUi, /useState<string>\(countryCode \|\| ''\)/,
  'Workspace taxonomy must start empty when explicit/stored country is absent');
matches(taxonomyUi, /if \(taxonomy\?\.country_code && !selectedCountry\)[\s\S]*setSelectedCountry\(taxonomy\.country_code\)/,
  'Workspace taxonomy may restore only its stored explicit value');
excludes(taxonomyUi, /selectedCountry[^\n]{0,120}\|\|\s*['"]RO['"]|countryCode[^\n]{0,120}\?\?\s*['"]RO['"]/,
  'Workspace taxonomy must not default country to RO');

// The generic Romanian formatter is presentation-only and has no AIRPROP call.
matches(formatter, /function formatAddress[\s\S]*Str\\\.[\s\S]*Sector/i,
  'Romania-shaped formatter inventory changed');
const formatterCallers = walk('src')
  .filter(path => /\.(?:ts|tsx)$/.test(path) && path !== 'src/config/formatters.ts')
  .filter(path => /\bformatAddress\s*\(/.test(read(path))).sort();
assert.deepEqual(formatterCallers, [
  'src/components/demo/DemoDashboardPage.tsx',
  'src/components/home/PortfolioIntelligenceSection.tsx',
]); assertions += 1;
check(formatterCallers.every(path => !path.toLowerCase().includes('airprop')),
  'AIRPROP must not consume the Romania-shaped formatter');

// Current controlled import has no address-country input or fallback. Treating
// the addressless Property it creates as country evidence remains unsafe.
matches(importSchema, /code:\s*z\.enum\(\["property","building"/,
  'controlled Property import inventory changed');
matches(importRuntime, /required_field_missing[\s\S]*when 'property' then 'name'/i,
  'Property import must still be classified as lacking country/address requirements');
matches(importRuntime,
  /z\.template_code='property'[\s\S]*insert into portfolio\.properties\(tenant_id,type,name,base_currency,status\)/i,
  'Property import still creates an addressless Property');

// Canonical address storage: the old default is historical, the later syntax
// check is not a registry, and postal text remains globally unconstrained.
matches(address, /country_code char\(2\) not null default 'RO'/i,
  'historical address default must remain visible as superseded evidence');
matches(jurisdiction, /alter table portfolio\.addresses alter column country_code drop default/i,
  'effective schema must remove the historical country default');
matches(jurisdiction, /addresses_country_code_explicit_v1[\s\S]*\^\[A-Z\]\{2\}\$/i,
  'effective storage must retain its syntactic two-letter check');
check(!readdirSync('src/lib/core').some(name => /canonical-country-registry|country-registry/i.test(name)),
  'Core canonical-country registry unexpectedly exists under src/lib/core');
excludes(migrations, /create\s+table\s+(?:platform\.)?(?:canonical_)?country_registry\b/i,
  'schema unexpectedly contains a canonical-country registry');
matches(address, /postal_code text/i, 'postal code must remain text');
excludes(migrations, /create\s+unique\s+index[^;]*postal_code|unique\s*\([^)]*postal_code/i,
  'postal code must not be globally unique');
excludes(migrations, /postal_code\s+text[^,;\n]*(?:check\s*\(|~|similar\s+to|length\s*\()/i,
  'postal code must not have one global SQL grammar');

// No pack/compliance claim is constructed by the current read projection.
excludes(report, /join\s+portfolio\.addresses|country_code|postal_code|country_pack|compliance/i,
  'inactive management projection must emit no address/pack/compliance claim');
matches(report, /revoke all on function customer_api\.read_airprop_management_portfolio_v1[\s\S]*authenticated,service_role/i,
  'management projection product-role activation must remain revoked');
matches(b2, /commands: null, can_edit: false, state: 'pre_activation'/,
  'Artifact B2 must remain inactive and commandless');
matches(productionRoute, /runtime: null[\s\S]*portfolio: null/,
  'Production runtime and portfolio must remain unwired');
matches(b2Http, /AIRPROP_UNIT_SCOPE_UNRESOLVED/,
  'unit-linked output must remain fail-closed');

// Freeze the inventory boundary. Any new source/test path with a country signal
// must be classified by a future audit update rather than silently accepted.
const signal = /AIRPROP-RO|country_code|Bucure(?:ști|sti)|Romania|Romanian/i;
const signalCandidates = [
  ...walk('src'), ...walk('scripts'), ...walk(migrationsDirectory), ...walk('supabase/tests'),
].filter(path => /\.(?:ts|tsx|mjs|sql)$/.test(path)
  && path !== 'scripts/test-airprop-legacy-country-defaults-audit-07.mjs')
  .filter(path => {
    const source = read(path);
    return signal.test(source) && (/airprop/i.test(path) || /\bairprop\b/i.test(source));
  }).sort();
const expectedSignalCandidates = [
  'scripts/test-airprop-acquisition-runtime-013.mjs',
  'scripts/test-airprop-address-structure-presentation-evaluator-v1.mjs',
  'scripts/test-airprop-diligence-runtime-011.mjs',
  'scripts/test-airprop-diligence-runtime-012.mjs',
  'scripts/test-airprop-explicit-address-country-projection-05.mjs',
  'scripts/test-airprop-legacy-country-configuration-deprecation-08.mjs',
  'scripts/test-airprop-multi-country-address-entry-contract-06.mjs',
  'scripts/test-airprop-multi-country-address-readiness-04.mjs',
  'scripts/test-airprop-native-route-004.mjs',
  'scripts/test-airprop-native-runtime-004.mjs',
  'scripts/test-airprop-native-ui-004.mjs',
  'scripts/test-airprop-opportunity-contract-v2.mjs',
  'scripts/test-airprop-underwriting-runtime-007.mjs',
  'scripts/test-airprop-underwriting-ui-008.mjs',
  'scripts/test-airprop-valuation-contract-01a.mjs',
  'scripts/test-core-canonical-country-registry-v1.mjs',
  'scripts/test-core-jurisdiction-domain-artifact-resolver-postgres-v1.mjs',
  'scripts/test-core-jurisdiction-domain-artifact-resolver-v1.mjs',
  'scripts/test-core-jurisdiction-profile-selector-postgres-v1.mjs',
  'scripts/test-core-jurisdiction-profile-selector-v1.mjs',
  'scripts/test-documents-country-retention-operation-integration-v1.mjs',
  'scripts/test-documents-country-retention-resolution-postgres-v1.mjs',
  'scripts/test-documents-country-retention-resolution-v1.mjs',
  'scripts/test-workspace-role-assignment-runtime.mjs',
  'scripts/test-workspace-taxonomy-slice.mjs',
  'src/app/[lang]/ai/page.tsx',
  'src/app/[lang]/industries/page.tsx',
  'src/app/[lang]/platform/architecture/page.tsx',
  'src/app/[lang]/resources/glossary/page.tsx',
  'src/app/[lang]/resources/guides/page.tsx',
  'src/app/[lang]/solutions/page.tsx',
  'src/components/contact/ContactForm.tsx',
  'src/components/customer/CustomerAirpropWorkspace.tsx',
  'src/config/routes-metadata.ts',
  'src/lib/airprop/address-structure-presentation-evaluator-v1.ts',
  'src/lib/airprop/opportunity-contract-v2.ts',
  'src/lib/airprop/opportunity-idempotency-v2.ts',
  'src/lib/airprop/valuation-contract-v1.ts',
  'supabase/migrations/20260914144417_airprop_core_foundation.sql',
  'supabase/migrations/20261003151604_20261003083859_workspace_scoped_effective_permission.sql',
  'supabase/migrations/20261003151713_20261003142455_airprop_workspace_native_opportunities_v2.sql',
  'supabase/tests/086_airprop_core_foundation.test.sql',
  'supabase/tests/133_airprop_workspace_module_gate.test.sql',
  'supabase/tests/134_airprop_read_core_authorization.test.sql',
  'supabase/tests/135_workspace_role_assignment_airprop_flow.test.sql',
  'supabase/tests/146_airprop_diligence_drafts.test.sql',
  'supabase/tests/149_airprop_diligence_review.test.sql',
  'supabase/tests/151_airprop_acquisition_decision.test.sql',
  'supabase/tests/170_workspace_role_handover.test.sql',
  'supabase/tests/172_airprop_listing_controls.test.sql',
  'supabase/tests/173_airprop_reservation_controls.test.sql',
  'supabase/tests/174_airprop_presale_obligation_controls.test.sql',
  'supabase/tests/175_airprop_resale_receipt_controls.test.sql',
  'supabase/tests/176_airprop_lease_handover_receipt_controls.test.sql',
  'supabase/tests/177_airprop_management_mandate_controls.test.sql',
  'supabase/tests/178_airprop_management_action_links.test.sql',
  'supabase/tests/179_airprop_management_portfolio_report.test.sql',
].sort();
// Keep the frozen audit's exact inventory and classify only byte-exact additions
// from the independently reconstructed official Platform264 packet.
const supplement=JSON.parse(read('docs/verification/CLADORA-V14-COUNTRY-SIGNAL-ADDITIONS.json'));
assert.equal(supplement.official_manifest_blob,'3a52004d7281fac5f64780d00101c5daebdb3639');
assert.equal(supplement.authority,'NONE');assert.equal(supplement.runtime_adoption,'NOT_READY');
assert.equal(supplement.entries.length,5);
const additions=supplement.entries.map(entry=>entry.path).sort();
assert.deepEqual(signalCandidates.filter(path=>!additions.includes(path)), expectedSignalCandidates);
assert.deepEqual(signalCandidates.filter(path=>additions.includes(path)),additions);
for(const entry of supplement.entries){
 const bytes=readFileSync(entry.path);assert.equal(bytes.length,entry.bytes);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256);
 assert.ok(['presentation-only','synthetic/test fixture','dormant or superseded definition'].includes(entry.classification));
 assert.ok(entry.reason.length>20);
}
assertions += 1;

// The audit itself must use each allowed classification and keep every finding
// in exactly one table row.
const classifications = [
  'canonical address authority', 'legacy AIRPROP configuration',
  'presentation-only', 'synthetic/test fixture',
  'dormant or superseded definition', 'unsafe runtime dependency',
];
const findingRows = [...audit.matchAll(/^\| ([A-Z][0-9]{2}) \| [^|]* \| ([^|]+) \|/gm)]
  .map(match => ({ id: match[1], classification: match[2].trim() }));
check(findingRows.length === 15, 'classified finding count changed');
check(new Set(findingRows.map(row => row.id)).size === findingRows.length,
  'each finding ID must occur exactly once');
for (const classification of classifications) {
  check(findingRows.some(row => row.classification === classification),
    `missing required classification: ${classification}`);
}
check(findingRows.every(row => classifications.includes(row.classification)),
  'every finding must have exactly one allowed classification');
for (const dependency of [
  'CORE-CANONICAL-COUNTRY-REGISTRY-01',
  'CORE-COUNTRY-MOVE-REBINDING-CONTRACT-01',
  'CORE-COUNTRY-MOVE-GUARD-IMPLEMENTATION-01',
  'CORE-CURRENT-PROPERTY-ADDRESS-COUNTRY-READ-SELECTOR-01',
  'AIRPROP-PROPERTY-COUNTRY-MOVE-09',
]) matches(audit, new RegExp(dependency), `missing dependency: ${dependency}`);
matches(audit, /active_country_inference=NONE/,
  'audit must record that no active inference required a product fix');
matches(audit, /NOT_RUN_NOT_PASS/,
  'unexecuted runtime/Production evidence must not be reported as pass');

console.log(JSON.stringify({
  package: 'AIRPROP-LEGACY-COUNTRY-DEFAULTS-AUDIT-07',
  assertions,
  result: 'audit_complete_no_active_inference_fix_required',
  classified_findings: findingRows.length,
  effective_v1_opportunity_definition: effectiveName,
  effective_v1_property_configuration_definition: effectiveName,
  live_v2_opportunity_definition: v2Name,
  active_country_inference: 'NONE',
  canonical_country_registry: 'DEPENDENCY_UNAVAILABLE',
  postal_global_uniqueness: false,
  global_postal_regex: 'NONE',
  country_pack_from_literal: 'DENIED_AS_AUTHORITY',
  unit_linked_output: 'FAIL_CLOSED',
  runtime_activation: 'PRE_ACTIVATION',
  product_code_changes: 0,
}, null, 2));
