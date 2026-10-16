import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import {
  CLDR_REGION_FILTER_POLICY_VERSION,
  CLDR_REGION_PARSER_VERSION,
  applyCountryTerritoryFilter,
  expandCldrRegionToken,
  normalizeCldrRegionValidity,
  parseCldrRegionValidity,
} from './lib/parse-cldr-region-validity-v1.mjs';

const referenceDirectory =
  'docs/contracts/references/CORE-CANONICAL-COUNTRY-REGISTRY-01';
const contractPath =
  'docs/contracts/CLADORA-CORE-CANONICAL-COUNTRY-REGISTRY-v1.0.md';
const executionPath =
  'docs/roadmap/CLADORA-CORE-CANONICAL-COUNTRY-REGISTRY-01-EXECUTION-PACKAGE-v1.0.md';
const parserPath = 'scripts/lib/parse-cldr-region-validity-v1.mjs';
const sourcePath = `${referenceDirectory}/cldr-release-48-2-region.xml`;
const licensePath = `${referenceDirectory}/cldr-release-48-2-LICENSE.txt`;
const manifestPath = `${referenceDirectory}/source-manifest.json`;
const read = path => readFileSync(path, 'utf8');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

const contract = read(contractPath);
const execution = read(executionPath);
const parserSource = read(parserPath);
const sourceBytes = readFileSync(sourcePath);
const licenseBytes = readFileSync(licensePath);
const source = sourceBytes.toString('utf8');
const manifest = JSON.parse(read(manifestPath));
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
const equal = (actual, expected, message) => {
  assert.equal(actual, expected, message); checks += 1;
};
const deepEqual = (actual, expected, message) => {
  assert.deepEqual(actual, expected, message); checks += 1;
};
const matches = (value, pattern, message) => {
  assert.match(value, pattern, message); checks += 1;
};
const excludes = (value, pattern, message) => {
  assert.doesNotMatch(value, pattern, message); checks += 1;
};

matches(contract, /Status: \*\*`approved_source_pinned_static_contract`\*\*/,
  'contract must record the approved source pin');
matches(execution,
  /Status: \*\*`source_pinned_ready_for_implementation_package`\*\*/,
  'execution package must stop before persistence implementation');
for (const token of [
  'country/territory region codes', 'Unicode Consortium', 'CLDR release-48-2',
  '2026-03-17', 'fc1fd058cc6f50544a450a3b15a4bba0e0c1e653',
  '11299982335beb974c1c63c45265184e759c0f41',
  'e751e0eedd46b52c38f3cdb72b0fab61ac8b48e052e8b28ba74b6ac26c4c8cb1',
  'Unicode License v3',
  'b49d0e9f8ead51ca8b7df6fec89cc3ae6809198b4b9d43c74216da0118f23f5b',
  CLDR_REGION_PARSER_VERSION, CLDR_REGION_FILTER_POLICY_VERSION,
  '4ee7bbf11b19a8f6b5dd467d06f5ecf7fdbe0d89af1d14bc928ce8e684ccf814',
  'AC~G', '001~3', 'macroregion', 'special', 'reserved', 'private_use',
  'unknown', 'deprecated', 'ZZ', 'XK', 'exceptional_regular=true',
  'active', 'withdrawn', 'historical', 'draft', 'retired', 'revoked',
  'reusable_as_command_authority=false', 'NOT_RUN_NOT_PASS',
]) {
  ok(contract.includes(token), `contract evidence missing: ${token}`);
}
for (const token of [
  'Reproducible source verification', 'Generated inventory review',
  'Core persistence migration', 'Database protection', 'Typed lookup port',
  'Disposable PostgreSQL evidence', 'Remote preflight and installation',
  'zero durable writes', 'AIRPROP guard', 'NOT_RUN_NOT_PASS',
]) {
  ok(execution.includes(token), `execution evidence missing: ${token}`);
}
matches(contract, /not a statement about sovereignty,[\s\S]*legal jurisdiction/i,
  'technical region code must not claim sovereignty or legal jurisdiction');
matches(contract,
  /CLDR locale data,[\s\S]*display names[\s\S]*forbidden country inference/i,
  'locale/display data must remain forbidden for inference');
excludes(contract, /ISO(?: 3166-1)? alpha-2/i,
  'contract must not mislabel CLDR region output as ISO alpha-2 authority');

equal(manifest.schema, 'core-canonical-country-territory-source-manifest.v1',
  'source manifest schema changed');
equal(manifest.publisher, 'Unicode Consortium', 'publisher pin changed');
equal(manifest.release, 'CLDR release-48-2', 'release pin changed');
equal(manifest.published_on, '2026-03-17', 'publication date changed');
equal(manifest.tag_object, 'fc1fd058cc6f50544a450a3b15a4bba0e0c1e653',
  'tag object changed');
equal(manifest.commit, '11299982335beb974c1c63c45265184e759c0f41',
  'source commit changed');
equal(sha256(sourceBytes), manifest.artifact.sha256,
  'vendored CLDR source bytes do not match the approved digest');
equal(sha256(licenseBytes), manifest.license.sha256,
  'vendored license bytes do not match the approved digest');
equal(manifest.license.spdx, 'Unicode-3.0', 'license identity changed');
equal(manifest.parser.version, CLDR_REGION_PARSER_VERSION,
  'parser version and manifest diverged');
equal(manifest.filter_policy.version, CLDR_REGION_FILTER_POLICY_VERSION,
  'filter policy and manifest diverged');
equal(manifest.network_runtime_dependency, false,
  'runtime network dependency must remain false');
excludes(parserSource, /\bfetch\s*\(|https?:\/\/|\blatest\b/i,
  'parser must use only pinned local bytes');

deepEqual(expandCldrRegionToken('AC~G'), ['AC', 'AD', 'AE', 'AF', 'AG'],
  'alphabetic CLDR range expansion changed');
deepEqual(expandCldrRegionToken('001~3'), ['001', '002', '003'],
  'numeric CLDR range expansion changed');
assert.throws(() => expandCldrRegionToken('AZ~A'), /CLDR_REGION_RANGE_INVALID/);
checks += 1;
assert.throws(() => expandCldrRegionToken('A~99'), /CLDR_REGION_RANGE_INVALID/);
checks += 1;

const records = parseCldrRegionValidity(source);
const normalized = normalizeCldrRegionValidity(records);
equal(records.length, 343, 'expanded CLDR record count changed');
equal(sha256(normalized), manifest.normalized_output.sha256,
  'normalized output hash changed');
equal(manifest.normalized_output.sha256,
  '4ee7bbf11b19a8f6b5dd467d06f5ecf7fdbe0d89af1d14bc928ce8e684ccf814',
  'approved normalized digest changed');
for (const [status, expected] of Object.entries({
  regular: 257, deprecated: 12, macroregion: 35, special: 2,
  reserved: 13, private_use: 23, unknown: 1,
})) {
  equal(records.filter(record => record.source_status === status).length,
    expected, `${status} record count changed`);
}
const duplicatedSource = source.replace(/\n\s*ZZ\n/, '\n\t\t\tZZ RO\n');
assert.throws(() => parseCldrRegionValidity(duplicatedSource),
  /CLDR_REGION_CODE_DUPLICATE/);
checks += 1;

const byCode = new Map(records.map(record => [record.code,
  applyCountryTerritoryFilter(record)]));
const bounded = (accepted, code, entry = null) => ({
  accepted, code, entry, reusable_as_command_authority: false, effects: 0,
});
const release = Object.freeze({
  registry_version: 48_002,
  effective_from: '2026-04-01T00:00:00.000Z',
  effective_to: '2027-04-01T00:00:00.000Z',
});
const inReleaseInterval = instant => instant >= release.effective_from
  && instant < release.effective_to;
function currentLookup({ code, releaseStatus = 'active', evaluatedAt, inferred = {} }) {
  void inferred;
  if (releaseStatus !== 'active') return bounded(false, 'COUNTRY_REGISTRY_NOT_CURRENT');
  if (!inReleaseInterval(evaluatedAt)) return bounded(false, 'COUNTRY_REGISTRY_NOT_EFFECTIVE');
  if (!/^[A-Z]{2}$/.test(code ?? '') || code === 'ZZ') {
    return bounded(false, 'COUNTRY_CODE_UNKNOWN');
  }
  const entry = byCode.get(code);
  if (!entry || entry.new_assignment !== 'allowed') {
    return bounded(false, 'COUNTRY_CODE_NOT_ASSIGNABLE');
  }
  return bounded(true, null, { registry_version: release.registry_version, ...entry });
}
function historicalLookup({
  code, releaseStatus, requestedVersion, evidenceVersion, effectiveAt,
}) {
  if (!['active', 'retired'].includes(releaseStatus)) {
    return bounded(false, 'COUNTRY_HISTORY_UNAVAILABLE');
  }
  if (requestedVersion !== release.registry_version
    || evidenceVersion !== release.registry_version
    || !inReleaseInterval(effectiveAt)) {
    return bounded(false, 'COUNTRY_HISTORY_UNAVAILABLE');
  }
  const entry = byCode.get(code);
  if (!entry || !['active', 'historical'].includes(entry.registry_entry_status)) {
    return bounded(false, 'COUNTRY_HISTORY_UNAVAILABLE');
  }
  return bounded(true, null, { registry_version: release.registry_version, ...entry });
}

const evaluatedAt = '2026-10-16T00:00:00.000Z';
ok(currentLookup({ code: 'RO', evaluatedAt }).accepted,
  'regular two-letter region must pass the active-release fixture');
for (const [code, expectedStatus] of [
  ['ZZ', 'unknown'], ['AN', 'deprecated'], ['XC', 'private_use'],
  ['001', 'macroregion'], ['XA', 'special'], ['AA', 'reserved'],
]) {
  const entry = byCode.get(code);
  equal(entry.source_status, expectedStatus, `${code} fixture source status changed`);
  const decision = currentLookup({ code, evaluatedAt });
  ok(!decision.accepted && decision.effects === 0,
    `${expectedStatus} ${code} must reject new assignment with zero effects`);
}
const xk = currentLookup({ code: 'XK', evaluatedAt });
ok(xk.accepted && xk.entry.exceptional_regular
  && xk.entry.governance_decision
    === 'technical_interoperability_without_political_or_legal_meaning',
  'XK requires the exact non-political exceptional governance decision');
equal(manifest.filter_policy.exceptional_regular.XK.meaning,
  'no_political_sovereignty_or_legal_jurisdiction_recognition',
  'XK manifest disclaimer changed');

for (const releaseStatus of ['draft', 'retired', 'revoked']) {
  ok(!currentLookup({ code: 'RO', releaseStatus, evaluatedAt }).accepted,
    `${releaseStatus} release must deny current lookup`);
}
for (const releaseStatus of ['draft', 'revoked']) {
  ok(!historicalLookup({ code: 'RO', releaseStatus,
    requestedVersion: release.registry_version,
    evidenceVersion: release.registry_version, effectiveAt: evaluatedAt }).accepted,
  `${releaseStatus} release must deny historical lookup`);
}
const retiredHistorical = historicalLookup({
  code: 'AN', releaseStatus: 'retired',
  requestedVersion: release.registry_version,
  evidenceVersion: release.registry_version, effectiveAt: evaluatedAt,
});
ok(retiredHistorical.accepted
  && retiredHistorical.entry.registry_entry_status === 'historical'
  && !retiredHistorical.reusable_as_command_authority,
  'retired release must allow only exact same-version historical evidence');
ok(!historicalLookup({ code: 'AN', releaseStatus: 'retired',
  requestedVersion: release.registry_version + 1,
  evidenceVersion: release.registry_version, effectiveAt: evaluatedAt }).accepted,
  'historical lookup must not upgrade, remap or fall back');
ok(!historicalLookup({ code: 'AN', releaseStatus: 'retired',
  requestedVersion: release.registry_version,
  evidenceVersion: release.registry_version,
  effectiveAt: '2028-01-01T00:00:00.000Z' }).accepted,
  'release-scoped platform effective interval must be exact');

for (const inferred of [
  'locale', 'display_name', 'language', 'currency', 'timezone',
  'phone', 'ip', 'workspace_default',
]) {
  const decision = currentLookup({
    evaluatedAt, inferred: { [inferred]: 'RO' },
  });
  ok(!decision.accepted && decision.effects === 0,
    `${inferred} must not infer a region code`);
}

ok(!coreFiles.some(name => /canonical-country-registry|country-registry/i.test(name)),
  'static package must not add a Core runtime registry implementation');
excludes(migrations,
  /create\s+table\s+(?:platform\.)?(?:canonical_)?country_(?:code_)?registry/i,
  'static package must not add registry persistence');
excludes(`${packageJson}\n${lockfile}`,
  /"(?:i18n-iso-countries|country-list|iso-3166|world-countries|cldr-countries)"\s*:/i,
  'runtime dependency must not replace the pinned source bytes');

console.log(`Core canonical country/territory source and lifecycle contract: ${checks}/${checks} PASS; source/parser/filter/hash pinned; no migration or runtime registry`);
