import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const commercial = read('src/lib/airprop/commercial-lifecycle-v1.ts');
const responseContract = commercial.slice(commercial.indexOf(
  'export const managementPortfolioResponseV1Schema',
));
const portfolioAdapter = read('src/lib/airprop/artifact-b2-portfolio.ts');
const readHttp = read('src/lib/airprop/artifact-b2-read-http-v1.ts');
const productionRoute = read('src/app/api/customer/v2/airprop/artifact-b2/route.ts');
const ui = read('src/components/customer/CustomerAirpropB2.tsx');
const report = read('supabase/migrations/20261009121000_airprop_management_portfolio_report_v1.sql');
const jurisdiction = read('supabase/migrations/20261015183000_core_jurisdiction_profile_v1.sql');
const profileSelector = read('src/lib/core/jurisdiction-profile-selector-v1.ts');
const artifactResolver = read('src/lib/core/jurisdiction-domain-artifact-resolver-v1.ts');
const artifact = read('src/lib/core/jurisdiction-domain-artifact-v1.ts');
const audit = read('docs/airprop/AIRPROP-MULTI-COUNTRY-ADDRESS-READINESS-AUDIT-04-v1.0.md');
const executionPackage = read(
  'docs/roadmap/AIRPROP-EXPLICIT-ADDRESS-COUNTRY-PROJECTION-05-EXECUTION-PACKAGE-v1.0.md',
);
const httpContract = read('scripts/test-airprop-gateway-read-http-v1.mjs');
const httpPostgres = read('scripts/test-airprop-gateway-read-http-postgres-v1.mjs');
const migrations = readdirSync('supabase/migrations')
  .filter(name => name.endsWith('.sql')).sort()
  .map(name => read(`supabase/migrations/${name}`)).join('\n');

let assertions = 0;
const check = (condition, message) => { assert.ok(condition, message); assertions += 1; };
const matches = (value, pattern, message) => {
  assert.match(value, pattern, message); assertions += 1;
};
const excludes = (value, pattern, message) => {
  assert.doesNotMatch(value, pattern, message); assertions += 1;
};

// Current v1 cannot carry a trustworthy country and must remain unchanged.
matches(responseContract, /property:\s*z\.strictObject\(\{ id: uuid, label:/,
  'known strict Property projection changed');
excludes(responseContract, /\bcountry_code\b/,
  'v1 response must not claim country before the Core read selector exists');
excludes(report, /['"]country_code['"]|['"]postal_code['"]|['"]country_pack['"]/i,
  'current RPC must not fabricate address or Country Pack output');
excludes(report, /join\s+portfolio\.addresses/i,
  'current RPC unexpectedly acquired an unreviewed address join');
check([...portfolioAdapter.matchAll(/gateway\.rpc\(/g)].length === 1,
  'adapter must keep exactly one Artifact A authority RPC');
matches(portfolioAdapter, /read_airprop_management_portfolio_v1/,
  'adapter must retain the canonical Artifact A read');
matches(productionRoute, /runtime:\s*null/,
  'Production runtime must remain inactive');
matches(productionRoute, /portfolio:\s*null/,
  'Production portfolio must remain inactive');
matches(readHttp, /AIRPROP_UNIT_SCOPE_UNRESOLVED/,
  'unit-linked output must remain fail-closed');

// Canonical storage supplies explicit country and rejects global postal policy.
matches(jurisdiction, /alter table portfolio\.addresses alter column country_code drop default/i,
  'effective address country must not have a default');
matches(jurisdiction, /addresses_country_code_explicit_v1[\s\S]*\^\[A-Z\]\{2\}\$/i,
  'effective country must be explicit uppercase alpha-2');
matches(jurisdiction, /unique\(property_id,assignment_version\)/i,
  'jurisdiction history must be versioned per Property');
matches(jurisdiction, /property_jurisdiction_address_country_immutable/,
  'bound address country must be immutable');
matches(jurisdiction, /property_jurisdiction_property_country_immutable/,
  'cross-country Property address replacement must fail closed');
excludes(migrations, /create\s+unique\s+index[^;]*postal_code|unique\s*\([^)]*postal_code/i,
  'postal code must not be globally unique');
excludes(migrations, /postal_code\s+text[^,;\n]*(?:check\s*\(|~|similar\s+to|length\s*\()/i,
  'postal code must not have a global SQL grammar');

// Core records explicit-address provenance and every forbidden inference source.
matches(artifact, /country_source:\s*z\.literal\('explicit_address_country'\)/,
  'country source must remain the explicit address');
for (const source of ['currency', 'ip_address', 'language', 'locale', 'phone_number', 'timezone']) {
  matches(artifact, new RegExp(`z\\.literal\\('${source}'\\)`),
    `missing forbidden inference source: ${source}`);
}
matches(jurisdiction, /never inferred from locale, currency, Workspace or user location/i,
  'Workspace/default inference prohibition must remain explicit');
excludes(`${portfolioAdapter}\n${readHttp}\n${ui}\n${report}`,
  /accept-language|x-forwarded-for|cf-ipcountry|navigator\.language|resolvedOptions\(\)\.timeZone/i,
  'AIRPROP read path must not infer country from browser or network metadata');

// Existing Core selectors are command-bound; a consumer-side shortcut is forbidden.
matches(profileSelector, /function authorityIsBoundToCommand/,
  'profile selector must remain bound to Core command authority');
matches(profileSelector, /isolation_level === 'serializable'/,
  'profile selector must retain its transaction binding');
matches(artifactResolver, /command_id:\s*uuidSchema/,
  'artifact resolver must remain command-bound');
matches(artifactResolver, /reusable_as_command_authority:\s*z\.literal\(false\)/,
  'artifact evidence must not become command authority');
matches(executionPackage, /CORE-CURRENT-PROPERTY-ADDRESS-COUNTRY-READ-SELECTOR-01/,
  'execution package must name the required Core dependency');
matches(executionPackage, /Status: \*\*`core_extension_required`\*\*/,
  'package must stop rather than build parallel authority');
matches(executionPackage, /PostgreSQL projection harness: \*\*`NOT_RUN_NO_IMPLEMENTATION`\*\*/,
  'PostgreSQL evidence must not be claimed without implementation');

// Existing inactive HTTP/UI boundaries preserve empty/unavailable and request identity.
matches(httpContract, /authorized empty is a 200 projection and unavailable remains 503/,
  'authorized empty and unavailable must stay distinct');
matches(httpContract, /unit-linked rows remain unavailable/,
  'unit-linked output regression evidence missing');
matches(httpContract, /concurrent actor switch keeps late responses bound to their request session/,
  'actor/session late-response regression evidence missing');
matches(ui, /controller\.abort\(\)/,
  'UI must abort the previous identity request');
matches(ui, /result\?\.identity === identity/,
  'UI must render only the current Context/Workspace identity');
matches(httpPostgres, /read_effect:\s*'ZERO_WRITE'/,
  'real-local harness must retain its zero-write assertion');

// A test-only acceptance oracle freezes the future behavior without creating a
// product selector, response schema, route or authority implementation.
function acceptanceOracle({ rows, unitLinked = false }) {
  if (rows.length === 0) return { status: 'read', properties: [], effects: 0 };
  if (unitLinked || rows.some(row => row.workspace_match !== true
    || row.address_count !== 1 || row.assignment_count !== 1
    || !/^[A-Z]{2}$/.test(row.address_country ?? '')
    || row.address_country !== row.assignment_country
    || row.assignment_current !== true)) {
    return { status: 'unavailable', effects: 0 };
  }
  return {
    status: 'read',
    properties: rows.map(row => ({ id: row.id, country_code: row.address_country })),
    effects: 0,
  };
}

const de = { id: 'property-de', workspace_match: true, address_count: 1,
  assignment_count: 1, address_country: 'DE', assignment_country: 'DE',
  assignment_current: true, postal_code: '10115' };
const ro = { id: 'property-ro', workspace_match: true, address_count: 1,
  assignment_count: 1, address_country: 'RO', assignment_country: 'RO',
  assignment_current: true, postal_code: '10115' };
const accepted = acceptanceOracle({ rows: [de, ro] });
check(accepted.status === 'read' && accepted.properties[0].country_code === 'DE'
  && accepted.properties[1].country_code === 'RO',
'multi-country fixture must preserve each explicit country');
check(de.postal_code === ro.postal_code && accepted.properties.length === 2,
  'duplicate postal text must not collide');
check(!('postal_code' in accepted.properties[0]) && !('country_pack' in accepted.properties[0])
  && !('compliance_status' in accepted.properties[0]),
'projection must remain metadata-only without postal/Country Pack claims');
for (const patch of [
  { address_country: null },
  { address_count: 0 },
  { address_count: 2 },
  { workspace_match: false },
  { assignment_count: 0 },
  { assignment_count: 2 },
  { assignment_country: 'RO' },
  { assignment_current: false },
]) {
  check(acceptanceOracle({ rows: [{ ...de, ...patch }] }).status === 'unavailable',
    `fixture must fail closed: ${JSON.stringify(patch)}`);
}
check(acceptanceOracle({ rows: [] }).status === 'read'
  && acceptanceOracle({ rows: [] }).properties.length === 0,
'authorized empty must remain distinct from unavailable');
check(acceptanceOracle({ rows: [de], unitLinked: true }).status === 'unavailable',
  'unit-linked fixture must remain unavailable');
check(accepted.effects === 0 && acceptanceOracle({ rows: [{ ...de, workspace_match: false }] }).effects === 0,
  'accepted and denied reads must be zero-write');

// The merged audit remains the source of the blocker that this package narrows.
matches(audit, /BLOCKER: explicit country cannot yet be preserved in the read output/,
  'merged audit blocker changed unexpectedly');

console.log(JSON.stringify({
  package: 'AIRPROP-EXPLICIT-ADDRESS-COUNTRY-PROJECTION-05',
  assertions,
  result: 'core_extension_required',
  implementation: 'NOT_CREATED',
  static_contract: 'PASS',
  multi_country_duplicate_postal_fixture: 'PASS',
  missing_ambiguous_cross_workspace: 'FAIL_CLOSED',
  authorized_empty_vs_unavailable: 'PASS',
  unit_linked_output: 'FAIL_CLOSED',
  actor_session_late_response: 'PRESERVED_BY_EXISTING_CONTRACT',
  read_effect: 'ZERO_WRITE',
  postgres_projection: 'NOT_RUN_NO_IMPLEMENTATION',
  real_local_http_aal2: 'NOT_RUN_NOT_PASS',
  production: 'NOT_RUN_NOT_PASS',
}, null, 2));
