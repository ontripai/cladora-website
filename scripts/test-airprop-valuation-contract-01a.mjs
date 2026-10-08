import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = mkdtempSync(join(root, '.airprop-valuation-test-'));
let passed = 0;
const check = (name, test) => { test(); passed++; console.log(`ok ${passed} - ${name}`); };
try {
  execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'),
    '--strict', '--skipLibCheck', '--esModuleInterop', '--target', 'ES2020',
    '--module', 'commonjs', '--moduleResolution', 'node', '--outDir', output,
    'src/lib/airprop/valuation-contract-v1.ts',
  ], { cwd: root, stdio: 'inherit' });
  const require = createRequire(import.meta.url);
  const contract = require(join(output, 'valuation-contract-v1.js'));
  const id = n => `${n.repeat(8)}-${n.repeat(4)}-4${n.repeat(3)}-8${n.repeat(3)}-${n.repeat(12)}`;
  const workspace = id('1');
  const resource = id('2');
  const observation = {
    contract: 'market-observation.v1', observation_id: id('3'), resource_type: 'apartment',
    transaction_kind: 'sale', evidence_kind: 'asking', observed_at: '2026-10-08T10:00:00+00:00',
    location_key: 'RO/B/sector-1', currency: 'RON', amount: '500000', area: '80', area_unit: 'sqm',
    attributes: { bedrooms: 2 }, verification: 'source_verified', quarantined: false, quarantine_reasons: [],
    source: { source_id: 'market-a', source_type: 'market_site', source_record_id: 'listing-42',
      collected_at: '2026-10-08T11:00:00+00:00', usage_rights: 'licensed' },
  };

  check('asking evidence remains distinct and parseable', () => assert.equal(contract.marketObservationV1Schema.parse(observation).evidence_kind, 'asking'));
  check('unknown authority fields are rejected', () => assert.equal(contract.marketObservationV1Schema.safeParse({ ...observation, can_publish: true }).success, false));
  check('verified deal requires transaction verification', () => assert.equal(contract.marketObservationV1Schema.safeParse({ ...observation, evidence_kind: 'verified_transaction' }).success, false));
  check('area and unit are atomic', () => { const { area_unit, ...withoutUnit } = observation; assert.equal(contract.marketObservationV1Schema.safeParse(withoutUnit).success, false); });
  check('quarantine reasons require quarantine state', () => assert.equal(contract.marketObservationV1Schema.safeParse({ ...observation, quarantine_reasons: ['outlier'] }).success, false));
  check('fingerprint is stable across UUID and non-identity attributes', () => {
    assert.equal(contract.marketObservationFingerprintV1(observation), contract.marketObservationFingerprintV1({ ...observation, observation_id: id('4'), attributes: { bedrooms: 3 } }));
  });
  check('source record change changes fingerprint', () => assert.notEqual(contract.marketObservationFingerprintV1(observation), contract.marketObservationFingerprintV1({ ...observation, source: { ...observation.source, source_record_id: 'listing-43' } })));

  const result = {
    contract: 'resource-valuation-result.v1', valuation_id: id('5'), resource_id: resource, resource_version: 7,
    workspace_id: workspace, as_of: '2026-10-08T10:00:00+00:00', computed_at: '2026-10-08T12:00:00+00:00',
    outcome: 'sufficient', currency: 'RON', sale_range: { low: '450000', high: '520000', central: '490000' },
    rent_range: null, price_per_area_basis: { amount: '6125', area_unit: 'sqm' },
    evidence: { asking_count: 12, verified_transaction_count: 3, external_estimate_count: 1, quarantined_count: 2,
      oldest_observed_at: '2026-01-01T00:00:00+00:00', newest_observed_at: '2026-10-01T00:00:00+00:00', freshness_days: 7 },
    explanations: ['Comparable evidence adjusted for freshness.'], assumptions: [], missing_inputs: [], quality_score: 0.72,
    model_version: 'baseline-1', dataset_version: 'fixture-1', policy_version: 'policy-1', review_status: 'not_reviewed',
    scope_disclaimer: 'Decision support only; not a published listing price.',
  };
  check('sufficient result requires at least one bounded range', () => assert.equal(contract.resourceValuationResultV1Schema.parse(result).outcome, 'sufficient'));
  check('central estimate must remain within range', () => assert.equal(contract.resourceValuationResultV1Schema.safeParse({ ...result, sale_range: { low: '450000', high: '520000', central: '600000' } }).success, false));
  check('insufficient result emits no numeric range and names missing inputs', () => assert.equal(contract.resourceValuationResultV1Schema.safeParse({ ...result, outcome: 'insufficient_data', sale_range: null, price_per_area_basis: null, missing_inputs: ['verified transactions'] }).success, true));
  check('insufficient result cannot emit a price range', () => assert.equal(contract.resourceValuationResultV1Schema.safeParse({ ...result, outcome: 'insufficient_data', missing_inputs: ['verified transactions'] }).success, false));

  const decision = { contract: 'listing-price-decision.v1', valuation_id: id('5'), resource_id: resource, resource_version: 7,
    workspace_id: workspace, listing_id: null, decision: 'use_suggestion', currency: 'RON', selected_amount: '490000',
    reason: 'Reviewed independently.', decided_at: '2026-10-08T13:00:00+00:00', decided_by_party_id: id('6'), publish: false };
  check('listing decision is explicitly non-publishing', () => assert.equal(contract.listingPriceDecisionV1Schema.parse(decision).publish, false));
  check('automatic publish cannot enter the contract', () => assert.equal(contract.listingPriceDecisionV1Schema.safeParse({ ...decision, publish: true }).success, false));
  check('expert override requires a reason and replacement range', () => assert.equal(contract.valuationReviewV1Schema.safeParse({ contract: 'valuation-review.v1', valuation_id: id('5'), workspace_id: workspace, decision: 'override', reason: 'Local condition evidence.', reviewed_at: '2026-10-08T13:00:00+00:00', reviewer_party_id: id('6') }).success, false));
  check('resource input is versioned and rejects client permission flags', () => assert.equal(contract.resourceValuationInputV1Schema.safeParse({ contract: 'resource-valuation-input.v1', resource_id: resource, resource_version: 7, resource_type: 'apartment', workspace_id: workspace, snapshot_as_of: '2026-10-08T10:00:00+00:00', country_code: 'RO', location: { locality: 'București' }, attributes: {}, evidence_refs: [], can_manage: true }).success, false));
  console.log(`AIRPROP AP-VAL-01A: ${passed} behavioral checks passed`);
} finally {
  rmSync(output, { recursive: true, force: true });
}

