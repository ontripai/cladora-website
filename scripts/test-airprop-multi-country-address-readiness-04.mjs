import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const migrationDirectory = 'supabase/migrations';
const migrations = readdirSync(migrationDirectory)
  .filter(name => name.endsWith('.sql')).sort()
  .map(name => read(`${migrationDirectory}/${name}`)).join('\n');

const portfolio = read(`${migrationDirectory}/20260825000300_portfolio_properties_buildings_units.sql`);
const jurisdiction = read(`${migrationDirectory}/20261015183000_core_jurisdiction_profile_v1.sql`);
const workspaceBindings = read(`${migrationDirectory}/20260915120000_workspace_taxonomy.sql`);
const report = read(`${migrationDirectory}/20261009121000_airprop_management_portfolio_report_v1.sql`);
const b2Contract = read('src/lib/airprop/commercial-lifecycle-v1.ts');
const b2Http = read('src/lib/airprop/artifact-b2-read-http-v1.ts');
const opportunity = read('src/lib/airprop/opportunity-contract-v2.ts');
const opportunityUi = read('src/components/customer/CustomerAirpropWorkspace.tsx');
const artifact = read('src/lib/core/jurisdiction-domain-artifact-v1.ts');

let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions += 1; };
const matches = (value, pattern, message) => {
  assert.match(value, pattern, message); assertions += 1;
};
const excludes = (value, pattern, message) => {
  assert.doesNotMatch(value, pattern, message); assertions += 1;
};

// The historical table default exists in the immutable baseline, but the later
// migration removes it. Effective schema therefore requires explicit input.
matches(portfolio, /create table portfolio\.addresses[\s\S]*country_code char\(2\) not null default 'RO'/i,
  'historical address default must remain visible to the audit');
matches(jurisdiction, /alter table portfolio\.addresses alter column country_code drop default/i,
  'effective address country must have no default');
matches(jurisdiction, /addresses_country_code_explicit_v1[\s\S]*\^\[A-Z\]\{2\}\$/i,
  'effective address country must be explicit ISO alpha-2');

// Postal text is intentionally non-unique and has no platform-wide grammar.
matches(portfolio, /\bpostal_code text\b/i, 'postal code must remain text');
matches(jurisdiction, /Optional country-specific postal text[\s\S]*no global format or uniqueness/i,
  'postal policy must explicitly reject global format and uniqueness');
excludes(migrations, /create\s+unique\s+index[^;]*postal_code|unique\s*\([^)]*postal_code/i,
  'postal code must not be globally unique');
excludes(migrations, /postal_code\s+text[^,;\n]*(?:check\s*\(|~|similar\s+to|length\s*\()/i,
  'postal code must not have one global SQL format');

// Country is selected only by explicit address/profile binding. The artifact
// records every forbidden inference source and cannot become command authority.
matches(artifact, /country_source:\s*z\.literal\('explicit_address_country'\)/,
  'Country Pack address policy must use the explicit address country');
for (const source of ['currency', 'ip_address', 'language', 'locale', 'phone_number', 'timezone']) {
  matches(artifact, new RegExp(`z\\.literal\\('${source}'\\)`),
    `forbidden country inference source missing: ${source}`);
}
matches(artifact, /reusable_as_command_authority:\s*z\.literal\(false\)/,
  'Country Pack data must not grant command authority');

// Property/Workspace and jurisdiction bindings are forward-only. A bound
// address country cannot be rewritten, and a property move needs another
// immutable binding row. There is still no AIRPROP move/address command.
matches(workspaceBindings, /guard_workspace_property_binding_history_v1[\s\S]*old\.customer_workspace_id\s*<>\s*new\.customer_workspace_id[\s\S]*old\.property_id\s*<>\s*new\.property_id/i,
  'property Workspace binding identity must be immutable');
matches(jurisdiction, /assignment_version integer not null[\s\S]*unique\(property_id,assignment_version\)/i,
  'jurisdiction changes must use versioned assignments');
matches(jurisdiction, /property_jurisdiction_address_country_immutable/,
  'bound address country changes must fail closed');
matches(jurisdiction, /property_jurisdiction_property_country_immutable/,
  'bound property address changes must preserve assigned country');

// The current AIRPROP read does not fabricate country/Country Pack fields, but
// it also cannot preserve an explicit country because the projection omits it.
matches(b2Contract, /property:\s*z\.strictObject\(\{ id: uuid, label:/,
  'known B2 property projection shape changed');
excludes(b2Contract, /property:\s*z\.strictObject\([^)]*country_code/s,
  'B2 projection unexpectedly claims a country before reviewed integration');
excludes(report, /['"]country_code['"]|['"]postal_code['"]|['"]country_pack['"]/i,
  'current portfolio SQL must not fabricate address or Country Pack output');
matches(b2Http, /AIRPROP_UNIT_SCOPE_UNRESOLVED/,
  'unit-linked output must remain fail-closed during readiness work');

// These are explicit known blockers, frozen so the audit cannot silently turn
// them into readiness claims. Their removal requires a later implementation PR.
matches(opportunity, /country_code:\s*z\.literal\("RO"\)/,
  'legacy opportunity contract is expected to remain Romania-only in this audit');
matches(opportunityUi, /country_code:\s*'RO'/,
  'legacy opportunity UI is expected to remain Romania-only in this audit');
check(!/country_code|postal_code|address/i.test(report),
  'management portfolio report must still be classified as address-country omitted');

console.log(JSON.stringify({
  package: 'AIRPROP-MULTI-COUNTRY-ADDRESS-READINESS-AUDIT-04',
  assertions,
  storage: {
    explicit_country_for_new_address: 'PASS',
    postal_code_globally_unique: false,
    global_postal_format: 'NONE',
    forbidden_country_inference_sources: 'PASS',
  },
  movement: {
    workspace_property_binding: 'FORWARD_ONLY_NEW_ASSIGNMENT_REQUIRED',
    address_country_change: 'FAIL_CLOSED_FOR_BOUND_PROPERTY',
    supported_airprop_move_command: 'ABSENT',
  },
  read_projection: {
    country_preserved: 'BLOCKED_COUNTRY_OMITTED',
    country_pack_fabricated: false,
    unit_linked_output: 'FAIL_CLOSED',
  },
  legacy_opportunity: 'ROMANIA_ONLY_NOT_CANONICAL_ADDRESS',
  dependency: {
    pr: 431,
    head: 'b7dece9358b8e1a0c761a9cbf7b018c342398f78',
    tree: '1e72a58270dd1fad5bee29b5cc61e7ecaf0bc98f',
    hashes_registered: false,
  },
  result: 'NOT_READY_FOR_RUNTIME_RESOLUTION',
}, null, 2));
