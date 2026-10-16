import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const migrationDirectory = 'supabase/migrations';
const coreFileNames = readdirSync('src/lib/core');
const migrations = readdirSync(migrationDirectory)
  .filter(name => name.endsWith('.sql')).sort()
  .map(name => read(`${migrationDirectory}/${name}`)).join('\n');
const document = read(
  'docs/roadmap/AIRPROP-MULTI-COUNTRY-ADDRESS-ENTRY-CONTRACT-06-v1.0.md',
);
const portfolio = read(`${migrationDirectory}/20260825000300_portfolio_properties_buildings_units.sql`);
const jurisdiction = read(`${migrationDirectory}/20261015183000_core_jurisdiction_profile_v1.sql`);
const buildingSchema = read('src/lib/customer/building-setup-schema.ts');
const buildingProvision = read(`${migrationDirectory}/20260926143510_pilot_reviewer_access_v1.sql`);
const importSchema = read('src/lib/customer/onboarding-import-schema.ts');
const importRuntime = read(`${migrationDirectory}/20260913063638_residential_pilot_import_completion.sql`);
const csv = read('src/lib/onboarding/csv-stream-parser.ts');
const opportunityContract = read('src/lib/airprop/opportunity-contract-v2.ts');
const opportunityUi = read('src/components/customer/CustomerAirpropWorkspace.tsx');
const legacyAirprop = read(`${migrationDirectory}/20260914144417_airprop_core_foundation.sql`);
const effectiveAirprop = read(
  `${migrationDirectory}/20261003151604_20261003083859_workspace_scoped_effective_permission.sql`,
);
const effectiveAirpropConfig = effectiveAirprop.slice(
  effectiveAirprop.indexOf('create or replace function app_private.configure_airprop_property_internal_v1'),
  effectiveAirprop.indexOf('end$$;', effectiveAirprop.indexOf(
    'create or replace function app_private.configure_airprop_property_internal_v1',
  )) + 'end$$;'.length,
);
const formatter = read('src/config/formatters.ts');
const privateUnits = read(`${migrationDirectory}/20260925131751_multi_unit_owner_private_portfolio_v1.sql`);
const b2Artifact = read('src/lib/airprop/artifact-b2-contract.ts');
const productionRoute = read('src/app/api/customer/v2/airprop/artifact-b2/route.ts');
const projectionPackage = read(
  'docs/roadmap/AIRPROP-EXPLICIT-ADDRESS-COUNTRY-PROJECTION-05-EXECUTION-PACKAGE-v1.0.md',
);

let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions += 1; };
const matches = (value, pattern, message) => {
  assert.match(value, pattern, message); assertions += 1;
};
const excludes = (value, pattern, message) => {
  assert.doesNotMatch(value, pattern, message); assertions += 1;
};

// Effective storage requires explicit country while retaining immutable history.
matches(portfolio, /country_code char\(2\) not null default 'RO'/i,
  'historical default must remain visible to the audit');
matches(jurisdiction, /alter table portfolio\.addresses alter column country_code drop default/i,
  'effective schema must remove the country default');
matches(jurisdiction, /addresses_country_code_explicit_v1[\s\S]*\^\[A-Z\]\{2\}\$/i,
  'effective schema must require uppercase two-letter syntax');
matches(portfolio, /postal_code text/i, 'postal code remains text');
excludes(migrations, /create\s+unique\s+index[^;]*postal_code|unique\s*\([^)]*postal_code/i,
  'postal code must not be globally unique');
excludes(migrations, /postal_code\s+text[^,;\n]*(?:check\s*\(|~|similar\s+to|length\s*\()/i,
  'postal code must not have one global SQL grammar');
matches(jurisdiction, /property_jurisdiction_address_country_immutable/,
  'bound address country must reject in-place change');
matches(jurisdiction, /property_jurisdiction_property_country_immutable/,
  'cross-country Property address replacement must fail closed');
matches(jurisdiction,
  /status in \('active','superseded','archived'\)[\s\S]*a\.country_code<>profile\.country_code[\s\S]*property_jurisdiction_country_rebind_forbidden/i,
  'assignment guard must reject a different-country rebind when history exists');
matches(jurisdiction,
  /old\.address_id is distinct from new\.address_id[\s\S]*target_country<>bound_country[\s\S]*property_jurisdiction_property_country_immutable/i,
  'Property address guard must reject exact cross-country replacement');
matches(jurisdiction, /unique\(property_id,assignment_version\)/i,
  'country/address history must retain versioned assignment identity');
check(!coreFileNames.some(name => /canonical-country-registry|country-registry/i.test(name)),
  'Core canonical-country registry must remain an explicit missing dependency');
excludes(migrations, /create\s+table\s+(?:platform\.)?(?:canonical_)?country_registry\b/i,
  'schema unexpectedly added an unreviewed canonical-country registry');

// Current entry paths are deliberately frozen as blockers instead of being fixed
// by this documentation package.
excludes(buildingSchema, /country_code|postal_code|address/i,
  'building setup remains without an address-entry contract in this audit');
matches(buildingProvision,
  /insert into portfolio\.properties\(tenant_id,type,name,base_currency,status\)/i,
  'building provisioning addressless-Property blocker changed unexpectedly');
matches(importSchema, /z\.enum\(\["property","building","entrance","unit"/,
  'controlled import still includes the Property template');
matches(importRuntime,
  /required_field_missing[\s\S]*when 'property' then 'name'/i,
  'current Property import still requires only its legacy name field');
matches(importRuntime,
  /z\.template_code='property'[\s\S]*insert into portfolio\.properties\(tenant_id,type,name,base_currency,status\)/i,
  'Property import addressless creation blocker changed unexpectedly');
matches(importRuntime, /blocking_import_issues_exist/,
  'blocking import issues must prevent canonical commit');
matches(importRuntime, /non_new_row_requires_forward_correction/,
  'current importer must remain insert-only');
matches(importRuntime, /comment on function app_private\.onboarding_commit_residential_internal_v1[\s\S]*Insert-only atomic residential pilot commit/i,
  'current importer atomicity classification changed');
matches(csv, /escapeFormula\(values\[i\]/,
  'bounded CSV ingestion must keep formula escaping');
matches(opportunityContract, /country_code:\s*z\.literal\("RO"\)/,
  'legacy opportunity remains a documented Romania-only blocker');
matches(opportunityUi, /country_code:\s*'RO'/,
  'legacy opportunity UI remains a documented Romania-only blocker');
matches(legacyAirprop,
  /function app_private\.configure_airprop_property_internal_v1\([\s\S]*p_country_pack_code text default 'AIRPROP-RO'[\s\S]*p_country_pack_version text default '1\.0'/i,
  'legacy AIRPROP internal configuration must retain its AIRPROP-RO default');
matches(legacyAirprop,
  /function customer_api\.configure_airprop_property_v1\([\s\S]*p_country_pack_code text default 'AIRPROP-RO'[\s\S]*app_private\.configure_airprop_property_internal_v1/i,
  'customer API wrapper must remain inventoried as legacy AIRPROP configuration');
matches(effectiveAirprop,
  /p_country_pack_code<>'AIRPROP-RO' or p_country_pack_version<>'1\.0'[\s\S]*airprop_country_pack_not_active/i,
  'effective legacy AIRPROP configuration must reject packs other than AIRPROP-RO v1.0');
excludes(effectiveAirpropConfig, /portfolio\.addresses|country_code/i,
  'legacy AIRPROP configuration must not become address authority');
matches(formatter, /function formatAddress[\s\S]*Str\\\.[\s\S]*Sector/i,
  'legacy Romania-shaped display formatter changed unexpectedly');
matches(privateUnits, /address_text text not null/,
  'opaque owner-private address label remains separate from canonical address');

// The document must bind every requested contract boundary without claiming
// implementation or expanding Core ownership.
for (const token of [
  'country_code', 'locale', 'language', 'currency', 'timezone', 'phone prefix',
  'IP', 'browser headers', 'Workspace defaults', 'tenant defaults',
  'globally unique', 'universal numeric', 'administrative levels',
  'new canonical address', 'new effective-dated Property address assignment',
  'Historical NULL and legacy policy', 'all-or-none', 'Bounded error taxonomy',
  'Threat model', 'CORE-CURRENT-PROPERTY-ADDRESS-COUNTRY-READ-SELECTOR-01',
  'CORE-CANONICAL-COUNTRY-REGISTRY-01', 'CORE-COUNTRY-MOVE-REBINDING-CONTRACT-01',
  'CORE-COUNTRY-MOVE-GUARD-IMPLEMENTATION-01', 'AIRPROP-PROPERTY-COUNTRY-MOVE-09',
  'customer_api.configure_airprop_property_v1',
  'app_private.configure_airprop_property_internal_v1', 'AIRPROP-RO',
  'DEPENDENCY_UNAVAILABLE', 'property_jurisdiction_country_rebind_forbidden',
  'property_jurisdiction_property_country_immutable',
]) {
  check(document.includes(token), `contract evidence missing: ${token}`);
}
matches(document, /Status: \*\*`contract_defined_implementation_blocked`\*\*/,
  'documentation package must stop before implementation');
matches(document, /PostgreSQL, Auth\/TOTP\/AAL2, runtime and Production: \*\*`NOT_RUN_NOT_PASS`\*\*/,
  'unexecuted acceptance layers must not be reported as pass');
matches(document, /`commands=null`, `can_edit=false`, `state=pre_activation`/,
  'inactive AIRPROP state must remain explicit');
matches(document, /syntactic validation only; it does not prove that a token names a canonical country/i,
  'uppercase two-letter storage syntax must not be described as canonical validation');
matches(document,
  /Core canonical-country registry,[\s\S]*Core country-move\/rebinding contract,[\s\S]*Core guard implementation,[\s\S]*AIRPROP-PROPERTY-COUNTRY-MOVE-09/i,
  'future country-move delivery order must remain Core-owned and explicit');
matches(projectionPackage, /Status: \*\*`core_extension_required`\*\*/,
  'merged #440 Core dependency must remain unresolved by this package');
matches(b2Artifact, /commands: null, can_edit: false, state: 'pre_activation'/,
  'Artifact B2 must remain inactive and commandless');
matches(productionRoute, /runtime: null[\s\S]*portfolio: null/,
  'Production route must retain zero implementation');

// Test-only contract oracle. It does not implement a product selector, schema,
// authority interface, form, route or persistence path.
const forbiddenInference = [
  'locale', 'language', 'currency', 'timezone', 'phone_prefix', 'ip',
  'browser_headers', 'workspace_default', 'tenant_default',
];
function validateAddressEntry(input, canonicalCountryRegistry) {
  if (typeof input.country_code !== 'string') {
    return { accepted: false, code: 'ADDRESS_COUNTRY_REQUIRED', effects: 0 };
  }
  if (!/^[A-Z]{2}$/.test(input.country_code)) {
    return { accepted: false, code: 'ADDRESS_COUNTRY_INVALID_SYNTAX', effects: 0 };
  }
  if (!canonicalCountryRegistry) {
    return { accepted: false, code: 'DEPENDENCY_UNAVAILABLE', effects: 0 };
  }
  if (!canonicalCountryRegistry.has(input.country_code)) {
    return { accepted: false, code: 'ADDRESS_COUNTRY_UNRECOGNIZED', effects: 0 };
  }
  return {
    accepted: true,
    country_code: input.country_code,
    postal_code: input.postal_code ?? null,
    effects: 0,
  };
}
const syntheticFutureRegistry = new Set(['DE', 'RO']);
const de = validateAddressEntry(
  { country_code: 'DE', postal_code: '10115' }, syntheticFutureRegistry,
);
const ro = validateAddressEntry(
  { country_code: 'RO', postal_code: '10115' }, syntheticFutureRegistry,
);
check(de.accepted && ro.accepted && de.postal_code === ro.postal_code,
  'duplicate postal text must remain valid across explicit countries');
for (const source of forbiddenInference) {
  const denied = validateAddressEntry({ [source]: 'RO', postal_code: '10115' });
  check(!denied.accepted && denied.effects === 0,
    `${source} must never supply missing country`);
}
check(!validateAddressEntry({ country_code: null }, syntheticFutureRegistry).accepted,
  'missing country must fail closed');
check(validateAddressEntry({ country_code: 'de' }, syntheticFutureRegistry).code
  === 'ADDRESS_COUNTRY_INVALID_SYNTAX',
  'lowercase token must fail the syntactic boundary');
check(validateAddressEntry({ country_code: 'ZZ' }).code === 'DEPENDENCY_UNAVAILABLE',
  'without the Core registry, a syntactically valid token must remain unavailable');
check(validateAddressEntry({ country_code: 'ZZ' }, syntheticFutureRegistry).code
  === 'ADDRESS_COUNTRY_UNRECOGNIZED',
  'an unknown token must never become canonical by syntax alone');

function changeCountry({ connected, from, to }) {
  if (connected && from !== to) {
    return { accepted: false, code: 'ADDRESS_COUNTRY_CHANGE_REQUIRES_NEW_VERSION', effects: 0 };
  }
  return { accepted: true, effects: 0 };
}
check(!changeCountry({ connected: true, from: 'DE', to: 'RO' }).accepted,
  'connected address country cannot change in place');

function validateImport(rows, canonicalCountryRegistry) {
  const issues = rows.flatMap((row, index) => validateAddressEntry(
    row, canonicalCountryRegistry,
  ).accepted
    ? [] : [{ row: index + 1, code: 'ADDRESS_COUNTRY_REQUIRED' }]);
  return { accepted: issues.length === 0, issues, committed: 0, effects: 0 };
}
const rejectedBatch = validateImport([
  { country_code: 'DE', postal_code: '10115' },
  { locale: 'ro', postal_code: '10115' },
], syntheticFutureRegistry);
check(!rejectedBatch.accepted && rejectedBatch.issues.length === 1
  && rejectedBatch.committed === 0 && rejectedBatch.effects === 0,
'one invalid import row must reject canonical commit without defaulting other rows');

function presentAddress(address, locale) {
  return {
    data: { ...address },
    labels: locale === 'de' ? { locality: 'Ort' } : { locality: 'Locality' },
  };
}
const stored = { country_code: 'DE', locality: 'Berlin', postal_code: '10115' };
check(JSON.stringify(presentAddress(stored, 'de').data)
  === JSON.stringify(presentAddress(stored, 'en').data),
'locale may change presentation labels only');

console.log(JSON.stringify({
  package: 'AIRPROP-MULTI-COUNTRY-ADDRESS-ENTRY-CONTRACT-06',
  assertions,
  result: 'contract_defined_implementation_blocked',
  documentation_static_audit: 'PASS',
  explicit_country_create_import: 'CONTRACT_DEFINED',
  inference_sources: 'DENIED',
  postal_global_uniqueness: false,
  global_postal_regex: 'NONE',
  in_place_country_change: 'DENIED',
  locale_effect: 'PRESENTATION_ONLY',
  canonical_runtime_implementation: 'NOT_CREATED',
  canonical_country_registry: 'DEPENDENCY_UNAVAILABLE',
  unknown_country_token: 'DENIED',
  legacy_airprop_ro_configuration: 'LIVE_NOT_ADDRESS_AUTHORITY',
  core_read_dependency: 'CORE-CURRENT-PROPERTY-ADDRESS-COUNTRY-READ-SELECTOR-01',
  postgres_http_aal2_production: 'NOT_RUN_NOT_PASS',
}, null, 2));
