import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = mkdtempSync(join(root, '.airprop-valuation-quality-test-'));
let passed = 0;
const check = (name, test) => { test(); passed++; console.log(`ok ${passed} - ${name}`); };

try {
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
    '--strict', '--skipLibCheck', '--esModuleInterop', '--target', 'ES2020',
    '--module', 'commonjs', '--moduleResolution', 'node', '--outDir', output,
    'src/lib/airprop/valuation-contract-v1.ts',
    'src/lib/airprop/valuation-quality-v1.ts',
  ], { cwd: root, stdio: 'inherit' });
  const require = createRequire(import.meta.url);
  const quality = require(join(output, 'valuation-quality-v1.js'));
  const id = n => `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
  const base = {
    contract: 'market-observation.v1', observation_id: id('1'), resource_type: 'apartment',
    transaction_kind: 'sale', evidence_kind: 'asking', observed_at: '2026-09-20T10:00:00+00:00',
    location_key: 'RO/B/sector-1', currency: 'EUR', amount: '100000', area: '100', area_unit: 'sqm',
    attributes: { bedrooms: 2 }, verification: 'source_verified', quarantined: false, quarantine_reasons: [],
    source: { source_id: 'licensed-a', source_type: 'licensed_dataset', source_record_id: 'record-1',
      collected_at: '2026-09-20T11:00:00+00:00', usage_rights: 'licensed' },
  };
  const policy = {
    contract: 'valuation-quality-policy.v1', policy_version: 'quality-1', as_of: '2026-10-01T00:00:00+00:00',
    target_currency: 'RON', target_area_unit: 'sqm',
    freshness_days: { asking: 45, verified_transaction: 365, external_estimate: 90 },
    fx_rates: [
      { from_currency: 'EUR', to_currency: 'RON', rate: '4.9700', effective_at: '2026-09-19T00:00:00+00:00', published_at: '2026-09-19T08:00:00+00:00', source_ref: 'fx/ecb/2026-09-19' },
      { from_currency: 'EUR', to_currency: 'RON', rate: '9.9999', effective_at: '2026-09-21T00:00:00+00:00', published_at: '2026-09-21T08:00:00+00:00', source_ref: 'fx/future-for-observation' },
    ],
  };
  const run = observations => quality.evaluateValuationObservationQualityV1({ policy, observations });

  check('eligible observation is normalized with an as-of-safe FX rate', () => {
    const result = run([base]);
    assert.equal(result.observations[0].status, 'eligible');
    assert.equal(result.observations[0].normalized_amount, '497000');
    assert.equal(result.observations[0].fx_source_ref, 'fx/ecb/2026-09-19');
  });
  check('future FX information is not used for an earlier observation', () => assert.equal(run([base]).observations[0].normalized_amount, '497000'));
  check('amount and area bases remain separately normalized', () => {
    const row = run([base]).observations[0];
    assert.equal(row.normalized_amount, '497000');
    assert.equal(row.normalized_area_sqm, '100');
  });
  check('large decimal normalization does not use binary floating point', () => {
    const largePolicy = { ...policy, fx_rates: [{ ...policy.fx_rates[0], rate: '9.99999999' }] };
    const result = quality.evaluateValuationObservationQualityV1({
      policy: largePolicy,
      observations: [{ ...base, amount: '9999999999999999' }],
    });
    assert.equal(result.observations[0].normalized_amount, '99999999899999990.00000001');
  });
  check('target-currency observations do not invent an FX reference', () => {
    const row = run([{ ...base, currency: 'RON', amount: '497000' }]).observations[0];
    assert.equal(row.normalized_amount, '497000');
    assert.equal(row.fx_source_ref, null);
  });
  check('square feet are converted without changing the source contract', () => {
    const result = run([{ ...base, observation_id: id('2'), area: '1076.391', area_unit: 'sqft' }]);
    assert.match(result.observations[0].normalized_area_sqm, /^99\.9999/);
    assert.equal(result.observations[0].status, 'eligible');
  });
  check('asking and verified transactions remain separate evidence classes', () => {
    const deal = { ...base, observation_id: id('2'), evidence_kind: 'verified_transaction', verification: 'transaction_verified', source: { ...base.source, source_record_id: 'deal-1' } };
    const result = run([base, deal]);
    assert.deepEqual({ asking: result.summary.asking, verified: result.summary.verified_transaction }, { asking: 1, verified: 1 });
  });
  check('same source record is deduplicated independently of input order', () => {
    const duplicate = { ...base, observation_id: id('2'), attributes: { bedrooms: 3 } };
    const first = run([duplicate, base]);
    const second = run([base, duplicate]);
    assert.equal(first.dataset_version, second.dataset_version);
    assert.equal(first.summary.duplicates, 1);
    assert.equal(first.observations.find(row => row.observation_id === id('2')).duplicate_of, id('1'));
  });
  check('cross-source records are not silently collapsed', () => {
    const other = { ...base, observation_id: id('2'), source: { ...base.source, source_id: 'licensed-b' } };
    assert.equal(run([base, other]).summary.duplicates, 0);
  });
  check('stale evidence is quarantined rather than deleted', () => {
    const stale = { ...base, observed_at: '2026-01-01T00:00:00+00:00', source: { ...base.source, collected_at: '2026-01-02T00:00:00+00:00' } };
    const row = run([stale]).observations[0];
    assert.equal(row.status, 'quarantined');
    assert.ok(row.quality_flags.includes('stale_observation'));
  });
  check('observation after valuation as-of is quarantined', () => {
    const future = { ...base, observed_at: '2026-10-02T00:00:00+00:00', source: { ...base.source, collected_at: '2026-10-02T01:00:00+00:00' } };
    assert.ok(run([future]).observations[0].quality_flags.includes('observation_after_as_of'));
  });
  check('collection after valuation as-of is quarantined', () => {
    const late = { ...base, source: { ...base.source, collected_at: '2026-10-02T01:00:00+00:00' } };
    assert.ok(run([late]).observations[0].quality_flags.includes('source_collected_after_as_of'));
  });
  check('missing eligible FX rate produces no fabricated normalized amount', () => {
    const usd = { ...base, currency: 'USD' };
    const row = run([usd]).observations[0];
    assert.equal(row.normalized_amount, null);
    assert.ok(row.quality_flags.includes('missing_eligible_fx_rate'));
  });
  check('source quarantine and reasons remain visible', () => {
    const row = run([{ ...base, quarantined: true, quarantine_reasons: ['outlier'] }]).observations[0];
    assert.ok(row.quality_flags.includes('source_quarantined'));
    assert.ok(row.quality_flags.includes('source:outlier'));
  });
  check('missing area stays missing and is not converted to zero', () => {
    const { area, area_unit, ...withoutArea } = base;
    const row = run([withoutArea]).observations[0];
    assert.equal(row.normalized_area_sqm, null);
  });
  check('dataset version changes when policy version changes', () => {
    const original = run([base]);
    const revised = quality.evaluateValuationObservationQualityV1({ policy: { ...policy, policy_version: 'quality-2' }, observations: [base] });
    assert.notEqual(original.dataset_version, revised.dataset_version);
  });
  check('unknown policy authority fields are rejected', () => assert.equal(quality.valuationQualityPolicyV1Schema.safeParse({ ...policy, can_read_all_workspaces: true }).success, false));
  check('quality pipeline creates no valuation or listing decision', () => {
    const result = run([base]);
    assert.equal('sale_range' in result, false);
    assert.equal('publish' in result, false);
  });

  console.log(`AIRPROP AP-VAL-01A quality pipeline: ${passed} behavioral checks passed`);
} finally {
  rmSync(output, { recursive: true, force: true });
}
