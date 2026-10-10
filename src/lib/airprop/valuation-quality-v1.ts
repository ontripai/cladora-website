import { createHash } from 'node:crypto';
import { z } from 'zod';

import {
  marketObservationFingerprintV1,
  marketObservationV1Schema,
} from './valuation-contract-v1';

const isoTimestamp = z.string().datetime({ offset: true });
const currency = z.string().regex(/^[A-Z]{3}$/);
const positiveDecimal = z.string().regex(/^(0|[1-9][0-9]{0,15})(\.[0-9]{1,8})?$/)
  .refine(value => Number(value) > 0, 'must_be_positive');
const versionLabel = z.string().trim().min(1).max(80);

const freshnessPolicyV1Schema = z.strictObject({
  asking: z.number().int().positive().max(3650),
  verified_transaction: z.number().int().positive().max(3650),
  external_estimate: z.number().int().positive().max(3650),
});

const fxRateV1Schema = z.strictObject({
  from_currency: currency,
  to_currency: currency,
  rate: positiveDecimal,
  effective_at: isoTimestamp,
  published_at: isoTimestamp,
  source_ref: z.string().trim().min(1).max(240),
});

export const valuationQualityPolicyV1Schema = z.strictObject({
  contract: z.literal('valuation-quality-policy.v1'),
  policy_version: versionLabel,
  as_of: isoTimestamp,
  target_currency: currency,
  target_area_unit: z.literal('sqm'),
  freshness_days: freshnessPolicyV1Schema,
  fx_rates: z.array(fxRateV1Schema).max(500),
});

type DecimalParts = { coefficient: string; scale: number };
type QualityStatus = 'eligible' | 'quarantined' | 'duplicate';

function parseDecimal(value: string): DecimalParts {
  const [whole, fraction = ''] = value.split('.');
  return { coefficient: `${whole}${fraction}`.replace(/^0+(?=\d)/, ''), scale: fraction.length };
}

function renderDecimal(coefficient: string, scale: number): string {
  if (scale === 0) return coefficient;
  const digits = coefficient.padStart(scale + 1, '0');
  const whole = digits.slice(0, -scale);
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}

function multiplyIntegers(left: string, right: string): string {
  const result = Array.from({ length: left.length + right.length }, () => 0);
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      const position = i + j + 1;
      const product = Number(left[i]) * Number(right[j]) + result[position];
      result[position] = product % 10;
      result[position - 1] += Math.floor(product / 10);
    }
  }
  return result.join('').replace(/^0+(?=\d)/, '');
}

function multiplyDecimal(left: string, right: string): string {
  const a = parseDecimal(left);
  const b = parseDecimal(right);
  return renderDecimal(multiplyIntegers(a.coefficient, b.coefficient), a.scale + b.scale);
}

function timestamp(value: string): number {
  return new Date(value).getTime();
}

function canonicalHash(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function evaluateValuationObservationQualityV1(input: {
  policy: unknown;
  observations: unknown[];
}) {
  const policy = valuationQualityPolicyV1Schema.parse(input.policy);
  const observations = input.observations.map(value => marketObservationV1Schema.parse(value));
  const asOf = timestamp(policy.as_of);

  const prepared = observations.map(observation => {
    const flags = new Set<string>();
    const observedAt = timestamp(observation.observed_at);
    const collectedAt = timestamp(observation.source.collected_at);
    const freshnessLimit = policy.freshness_days[observation.evidence_kind] * 86_400_000;

    if (observation.quarantined) {
      flags.add('source_quarantined');
      for (const reason of observation.quarantine_reasons) flags.add(`source:${reason}`);
    }
    if (observedAt > asOf) flags.add('observation_after_as_of');
    if (collectedAt > asOf) flags.add('source_collected_after_as_of');
    if (collectedAt < observedAt) flags.add('source_collected_before_observation');
    if (asOf - observedAt > freshnessLimit) flags.add('stale_observation');

    let normalizedAmount: string | null = observation.amount;
    let fxSourceRef: string | null = null;
    if (observation.currency !== policy.target_currency) {
      const rate = policy.fx_rates
        .filter(candidate => candidate.from_currency === observation.currency
          && candidate.to_currency === policy.target_currency
          && timestamp(candidate.effective_at) <= observedAt
          && timestamp(candidate.published_at) <= asOf)
        .sort((a, b) => timestamp(b.effective_at) - timestamp(a.effective_at)
          || timestamp(b.published_at) - timestamp(a.published_at)
          || a.source_ref.localeCompare(b.source_ref))[0];
      if (!rate) {
        normalizedAmount = null;
        flags.add('missing_eligible_fx_rate');
      } else {
        normalizedAmount = multiplyDecimal(observation.amount, rate.rate);
        fxSourceRef = rate.source_ref;
      }
    }

    let normalizedAreaSqm: string | null = null;
    if (observation.area !== undefined) {
      normalizedAreaSqm = observation.area_unit === 'sqft'
        ? multiplyDecimal(observation.area, '0.09290304')
        : observation.area;
    }

    return {
      observation_id: observation.observation_id,
      fingerprint: marketObservationFingerprintV1(observation),
      evidence_kind: observation.evidence_kind,
      transaction_kind: observation.transaction_kind,
      observed_at: observation.observed_at,
      normalized_currency: policy.target_currency,
      normalized_amount: normalizedAmount,
      normalized_area_sqm: normalizedAreaSqm,
      fx_source_ref: fxSourceRef,
      quality_flags: Array.from(flags).sort(),
      status: (flags.size === 0 ? 'eligible' : 'quarantined') as QualityStatus,
      duplicate_of: null as string | null,
    };
  });

  const canonicalByFingerprint = new Map<string, string>();
  for (const row of [...prepared].sort((a, b) => a.fingerprint.localeCompare(b.fingerprint)
    || a.observation_id.localeCompare(b.observation_id))) {
    const canonical = canonicalByFingerprint.get(row.fingerprint);
    if (canonical) {
      row.status = 'duplicate';
      row.duplicate_of = canonical;
      row.quality_flags = Array.from(new Set([...row.quality_flags, 'duplicate_source_record'])).sort();
    } else {
      canonicalByFingerprint.set(row.fingerprint, row.observation_id);
    }
  }

  const rows = prepared.sort((a, b) => a.observation_id.localeCompare(b.observation_id));
  const summary = {
    total: rows.length,
    eligible: rows.filter(row => row.status === 'eligible').length,
    quarantined: rows.filter(row => row.status === 'quarantined').length,
    duplicates: rows.filter(row => row.status === 'duplicate').length,
    asking: rows.filter(row => row.evidence_kind === 'asking').length,
    verified_transaction: rows.filter(row => row.evidence_kind === 'verified_transaction').length,
    external_estimate: rows.filter(row => row.evidence_kind === 'external_estimate').length,
  };
  const dataset_version = canonicalHash({
    policy_version: policy.policy_version,
    as_of: policy.as_of,
    target_currency: policy.target_currency,
    target_area_unit: policy.target_area_unit,
    rows: rows.map(row => ({
      observation_id: row.observation_id,
      fingerprint: row.fingerprint,
      status: row.status,
      duplicate_of: row.duplicate_of,
      normalized_amount: row.normalized_amount,
      normalized_area_sqm: row.normalized_area_sqm,
      fx_source_ref: row.fx_source_ref,
      quality_flags: row.quality_flags,
    })),
  });

  return {
    contract: 'valuation-quality-result.v1' as const,
    policy_version: policy.policy_version,
    as_of: policy.as_of,
    target_currency: policy.target_currency,
    target_area_unit: policy.target_area_unit,
    dataset_version,
    summary,
    observations: rows,
  };
}
