import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const contract = read(
  'docs/contracts/CLADORA-CORE-CANONICAL-COUNTRY-REGISTRY-v1.0.md',
);
const execution = read(
  'docs/roadmap/CLADORA-CORE-CANONICAL-COUNTRY-REGISTRY-01-EXECUTION-PACKAGE-v1.0.md',
);
const packageJson = read('package.json');
const lockfile = read('package-lock.json');
const migrations = readdirSync('supabase/migrations')
  .filter(name => name.endsWith('.sql'))
  .sort()
  .map(name => read(`supabase/migrations/${name}`))
  .join('\n');
const coreFiles = readdirSync('src/lib/core');

let checks = 0;
const ok = (value, message) => { assert.ok(value, message); checks += 1; };
const matches = (value, pattern, message) => {
  assert.match(value, pattern, message); checks += 1;
};
const excludes = (value, pattern, message) => {
  assert.doesNotMatch(value, pattern, message); checks += 1;
};

matches(contract, /Status: \*\*`canonical_source_required`\*\*/,
  'contract must stop at the source gate');
matches(execution, /Status: \*\*`blocked_canonical_source_required`\*\*/,
  'execution package must remain blocked');
for (const token of [
  'authoritative publisher', 'source edition', 'source-byte SHA-256',
  'normalized-manifest SHA-256', 'active', 'withdrawn', 'historical',
  'effective_from', 'effective_to', 'reusable_as_command_authority=false',
  'CANONICAL_SOURCE_REQUIRED', 'COUNTRY_CODE_UNKNOWN',
  'COUNTRY_REGISTRY_AMBIGUOUS', 'COUNTRY_HISTORY_UNAVAILABLE',
  'Locale', 'language', 'currency', 'timezone', 'phone', 'IP/geolocation',
  'Workspace defaults', 'Property', 'Country Pack', 'postal grammar',
  'NOT_RUN_NOT_PASS',
]) {
  ok(contract.includes(token), `contract evidence missing: ${token}`);
}
for (const token of [
  'Source admission', 'Deterministic manifest', 'Core persistence migration',
  'Database protection', 'Typed lookup port', 'Disposable evidence',
  'Remote preflight and installation', 'zero durable writes',
  'AIRPROP guard', 'NOT_RUN_NOT_PASS',
]) {
  ok(execution.includes(token), `execution evidence missing: ${token}`);
}

ok(!coreFiles.some(name => /canonical-country-registry|country-registry/i.test(name)),
  'docs-only package must not add a Core registry implementation');
excludes(migrations,
  /create\s+table\s+(?:platform\.)?(?:canonical_)?country_(?:code_)?registry/i,
  'docs-only package must not add registry persistence');
excludes(`${packageJson}\n${lockfile}`,
  /"(?:i18n-iso-countries|country-list|iso-3166|world-countries|cldr-countries)"\s*:/i,
  'an unreviewed country dataset dependency must not appear');

// A test-only oracle fixes the intended fail-closed semantics without creating
// a product registry or claiming that synthetic tokens are real countries.
const release = Object.freeze({
  version: 7,
  status: 'active',
  effective_from: '2026-01-01T00:00:00.000Z',
  effective_to: null,
});
const entries = Object.freeze([
  Object.freeze({
    code: 'QA', status: 'historical',
    effective_from: '2020-01-01T00:00:00.000Z',
    effective_to: '2022-01-01T00:00:00.000Z',
  }),
  Object.freeze({
    code: 'QB', status: 'active',
    effective_from: '2022-01-01T00:00:00.000Z', effective_to: null,
  }),
]);

const inInterval = (instant, row) => instant >= row.effective_from
  && (row.effective_to === null || instant < row.effective_to);
const bounded = (accepted, code, entry = null) => ({
  accepted, code, entry,
  reusable_as_command_authority: false,
  effects: 0,
});
function currentLookup({ code, evaluatedAt, sourceReady = false, rows = entries }) {
  if (!sourceReady) return bounded(false, 'CANONICAL_SOURCE_REQUIRED');
  if (!/^[A-Z]{2}$/.test(code ?? '')) return bounded(false, 'COUNTRY_CODE_INVALID');
  const found = rows.filter(row => row.code === code && inInterval(evaluatedAt, row));
  if (found.length > 1) return bounded(false, 'COUNTRY_REGISTRY_AMBIGUOUS');
  if (found.length === 0 || code === 'ZZ') return bounded(false, 'COUNTRY_CODE_UNKNOWN');
  if (found[0].status !== 'active') return bounded(false, 'COUNTRY_CODE_NOT_CURRENT');
  return bounded(true, null, { registry_version: release.version, ...found[0] });
}
function historicalLookup({ code, registryVersion, effectiveAt, rows = entries }) {
  if (registryVersion !== release.version) return bounded(false, 'COUNTRY_HISTORY_UNAVAILABLE');
  const found = rows.filter(row => row.code === code && inInterval(effectiveAt, row));
  if (found.length !== 1) return bounded(false,
    found.length > 1 ? 'COUNTRY_REGISTRY_AMBIGUOUS' : 'COUNTRY_HISTORY_UNAVAILABLE');
  return bounded(true, null, { registry_version: registryVersion, ...found[0] });
}

ok(currentLookup({ code: 'QB', evaluatedAt: '2026-10-16T00:00:00.000Z' }).code
  === 'CANONICAL_SOURCE_REQUIRED', 'source gate must precede syntax membership');
ok(currentLookup({ code: 'ZZ', evaluatedAt: '2026-10-16T00:00:00.000Z', sourceReady: true }).code
  === 'COUNTRY_CODE_UNKNOWN', 'ZZ must fail closed');
ok(currentLookup({ code: 'QC', evaluatedAt: '2026-10-16T00:00:00.000Z', sourceReady: true }).code
  === 'COUNTRY_CODE_UNKNOWN', 'unknown uppercase code must fail closed');
ok(currentLookup({ code: 'QB', evaluatedAt: '2026-10-16T00:00:00.000Z', sourceReady: true }).accepted,
  'synthetic active entry should illustrate exact current resolution');
ok(currentLookup({ code: 'QA', evaluatedAt: '2021-06-01T00:00:00.000Z', sourceReady: true }).code
  === 'COUNTRY_CODE_NOT_CURRENT', 'historical classification cannot pass current lookup');
const historical = historicalLookup({
  code: 'QA', registryVersion: 7, effectiveAt: '2021-06-01T00:00:00.000Z',
});
ok(historical.accepted && historical.entry.status === 'historical'
  && !historical.reusable_as_command_authority,
  'exact historical lookup must retain classification without command authority');
ok(historicalLookup({ code: 'QA', registryVersion: 8,
  effectiveAt: '2021-06-01T00:00:00.000Z' }).code === 'COUNTRY_HISTORY_UNAVAILABLE',
  'historical lookup cannot upgrade to another version');
const duplicate = [...entries, { ...entries[1] }];
ok(currentLookup({ code: 'QB', evaluatedAt: '2026-10-16T00:00:00.000Z',
  sourceReady: true, rows: duplicate }).code === 'COUNTRY_REGISTRY_AMBIGUOUS',
  'duplicate effective entries must fail closed');
for (const inferred of [
  'locale', 'language', 'currency', 'timezone', 'phone', 'ip', 'workspace_default',
]) {
  const result = currentLookup({
    [inferred]: 'QB', evaluatedAt: '2026-10-16T00:00:00.000Z', sourceReady: true,
  });
  ok(result.code === 'COUNTRY_CODE_INVALID' && result.effects === 0,
    `${inferred} must not infer the country token`);
}

console.log(`Core canonical country registry source-gate contract: ${checks}/${checks} PASS; canonical_source_required; no country list, migration or runtime implementation`);
