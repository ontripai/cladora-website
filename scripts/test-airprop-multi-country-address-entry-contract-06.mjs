import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const migrationDirectory = 'supabase/migrations';
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
const formatter = read('src/config/formatters.ts');
const privateUnits = read(`${migrationDirectory}/20260925131751_multi_unit_owner_private_portfolio_v1.sql`);
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
  'effective schema must require explicit uppercase alpha-2 country');
matches(portfolio, /postal_code text/i, 'postal code remains text');
excludes(migrations, /create\s+unique\s+index[^;]*postal_code|unique\s*\([^)]*postal_code/i,
  'postal code must not be globally unique');
excludes(migrations, /postal_code\s+text[^,;\n]*(?:check\s*\(|~|similar\s+to|length\s*\()/i,
  'postal code must not have one global SQL grammar');
matches(jurisdiction, /property_jurisdiction_address_country_immutable/,
  'bound address country must reject in-place change');
matches(jurisdiction, /property_jurisdiction_property_country_immutable/,
  'cross-country Property address replacement must fail closed');
matches(jurisdiction, /unique\(property_id,assignment_version\)/i,
  'country/address history must retain versioned assignment identity');

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
]) {
  check(document.includes(token), `contract evidence missing: ${token}`);
}
matches(document, /Status: \*\*`contract_defined_implementation_blocked`\*\*/,
  'documentation package must stop before implementation');
matches(document, /PostgreSQL, Auth\/TOTP\/AAL2, runtime and Production: \*\*`NOT_RUN_NOT_PASS`\*\*/,
  'unexecuted acceptance layers must not be reported as pass');
matches(document, /`commands=null`, `can_edit=false`, `state=pre_activation`/,
  'inactive AIRPROP state must remain explicit');
matches(projectionPackage, /Status: \*\*`core_extension_required`\*\*/,
  'merged #440 Core dependency must remain unresolved by this package');

// Test-only contract oracle. It does not implement a product selector, schema,
// authority interface, form, route or persistence path.
const forbiddenInference = [
  'locale', 'language', 'currency', 'timezone', 'phone_prefix', 'ip',
  'browser_headers', 'workspace_default', 'tenant_default',
];
function validateAddressEntry(input) {
  if (typeof input.country_code !== 'string' || !/^[A-Z]{2}$/.test(input.country_code)) {
    return { accepted: false, code: 'ADDRESS_COUNTRY_REQUIRED', effects: 0 };
  }
  return {
    accepted: true,
    country_code: input.country_code,
    postal_code: input.postal_code ?? null,
    effects: 0,
  };
}
const de = validateAddressEntry({ country_code: 'DE', postal_code: '10115' });
const ro = validateAddressEntry({ country_code: 'RO', postal_code: '10115' });
check(de.accepted && ro.accepted && de.postal_code === ro.postal_code,
  'duplicate postal text must remain valid across explicit countries');
for (const source of forbiddenInference) {
  const denied = validateAddressEntry({ [source]: 'RO', postal_code: '10115' });
  check(!denied.accepted && denied.effects === 0,
    `${source} must never supply missing country`);
}
check(!validateAddressEntry({ country_code: null }).accepted,
  'missing country must fail closed');
check(!validateAddressEntry({ country_code: 'de' }).accepted,
  'non-canonical country must fail closed');

function changeCountry({ connected, from, to }) {
  if (connected && from !== to) {
    return { accepted: false, code: 'ADDRESS_COUNTRY_CHANGE_REQUIRES_NEW_VERSION', effects: 0 };
  }
  return { accepted: true, effects: 0 };
}
check(!changeCountry({ connected: true, from: 'DE', to: 'RO' }).accepted,
  'connected address country cannot change in place');

function validateImport(rows) {
  const issues = rows.flatMap((row, index) => validateAddressEntry(row).accepted
    ? [] : [{ row: index + 1, code: 'ADDRESS_COUNTRY_REQUIRED' }]);
  return { accepted: issues.length === 0, issues, committed: 0, effects: 0 };
}
const rejectedBatch = validateImport([
  { country_code: 'DE', postal_code: '10115' },
  { locale: 'ro', postal_code: '10115' },
]);
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
  core_read_dependency: 'CORE-CURRENT-PROPERTY-ADDRESS-COUNTRY-READ-SELECTOR-01',
  postgres_http_aal2_production: 'NOT_RUN_NOT_PASS',
}, null, 2));
