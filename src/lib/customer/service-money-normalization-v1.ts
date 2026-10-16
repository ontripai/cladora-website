import { z } from 'zod';

import {
  calculateJurisdictionDomainArtifactSha256V1,
  coreJurisdictionDomainArtifactV1Schema,
} from '../core/jurisdiction-domain-artifact-v1.ts';

export const SERVICE_MONEY_NORMALIZATION_REQUEST_V1 =
  'service-money-normalization-request.v1' as const;
export const SERVICE_MONEY_NORMALIZATION_DECISION_V1 =
  'service-money-normalization-decision.v1' as const;

const timestamp = z.string().datetime({ offset: true });
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const operation = z.enum(['decimal_to_minor', 'minor_to_decimal']);
const roundingMode = z.enum(['half_even', 'half_up', 'down', 'up']);

export const serviceMoneyNormalizationRequestV1Schema = z.strictObject({
  contract_version: z.literal(SERVICE_MONEY_NORMALIZATION_REQUEST_V1),
  operation,
  currency_code: currencyCode,
  amount: z.string().max(256),
  effective_at: timestamp,
});

const denialReason = z.enum([
  'MALFORMED_REQUEST',
  'ARTIFACT_INVALID',
  'PAYMENT_POLICY_UNAVAILABLE',
  'ARTIFACT_HASH_MISMATCH',
  'ARTIFACT_INACTIVE',
  'ARTIFACT_NOT_EFFECTIVE',
  'REVIEW_UNAVAILABLE',
  'CURRENCY_POLICY_UNAVAILABLE',
  'INVALID_DECIMAL_AMOUNT',
  'INVALID_MINOR_AMOUNT',
  'MINOR_INCREMENT_MISMATCH',
  'AMOUNT_OVERFLOW',
]);

const decisionBase = {
  contract_version: z.literal(SERVICE_MONEY_NORMALIZATION_DECISION_V1),
  evaluator_version: z.literal(1),
  durable_writes: z.literal(0),
  rail_selected: z.literal(false),
  provider_selected: z.literal(false),
  payment_intent_created: z.literal(false),
} as const;

export const serviceMoneyNormalizationDecisionV1Schema = z.discriminatedUnion('decision', [
  z.strictObject({
    ...decisionBase,
    decision: z.literal('accepted'),
    denial_reason: z.null(),
    evaluated_at: timestamp,
    operation,
    currency_code: currencyCode,
    exponent: z.number().int().min(0).max(6).safe(),
    rounding_mode: roundingMode,
    increment_minor_units: z.number().int().positive().max(1_000_000).safe(),
    decimal_amount: z.string(),
    minor_units: z.string().regex(/^-?(?:0|[1-9][0-9]*)$/),
    artifact_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  }),
  z.strictObject({
    ...decisionBase,
    decision: z.literal('denied'),
    denial_reason: denialReason,
    evaluated_at: timestamp.nullable(),
    operation: operation.nullable(),
    currency_code: currencyCode.nullable(),
    exponent: z.null(),
    rounding_mode: z.null(),
    increment_minor_units: z.null(),
    decimal_amount: z.null(),
    minor_units: z.null(),
    artifact_sha256: z.null(),
  }),
]);

export type ServiceMoneyNormalizationDecisionV1 = z.infer<
  typeof serviceMoneyNormalizationDecisionV1Schema
>;

type DenialReason = z.infer<typeof denialReason>;
type ParsedRequest = z.infer<typeof serviceMoneyNormalizationRequestV1Schema>;

const DECIMAL_AMOUNT = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const MINOR_AMOUNT = /^-?(?:0|[1-9][0-9]*)$/;
const BIGINT_ZERO = BigInt(0);
const BIGINT_ONE = BigInt(1);
const BIGINT_TWO = BigInt(2);
const BIGINT_TEN = BigInt(10);

function denied(request: ParsedRequest | null, reason: DenialReason):
ServiceMoneyNormalizationDecisionV1 {
  return serviceMoneyNormalizationDecisionV1Schema.parse({
    contract_version: SERVICE_MONEY_NORMALIZATION_DECISION_V1,
    evaluator_version: 1,
    decision: 'denied',
    denial_reason: reason,
    evaluated_at: request?.effective_at ?? null,
    operation: request?.operation ?? null,
    currency_code: request?.currency_code ?? null,
    exponent: null,
    rounding_mode: null,
    increment_minor_units: null,
    decimal_amount: null,
    minor_units: null,
    artifact_sha256: null,
    durable_writes: 0,
    rail_selected: false,
    provider_selected: false,
    payment_intent_created: false,
  });
}

function absolute(value: bigint): bigint {
  return value < BIGINT_ZERO ? -value : value;
}

function powerOfTen(exponent: number): bigint {
  let result = BIGINT_ONE;
  for (let index = 0; index < exponent; index += 1) result *= BIGINT_TEN;
  return result;
}

const MAX_MINOR_MAGNITUDE = powerOfTen(38) - BIGINT_ONE;

function roundedQuotient(
  dividend: bigint,
  divisor: bigint,
  mode: z.infer<typeof roundingMode>,
): bigint {
  const quotient = dividend / divisor;
  const remainder = dividend % divisor;
  if (remainder === BIGINT_ZERO || mode === 'down') return quotient;
  if (mode === 'up') return quotient + BIGINT_ONE;
  const comparison = remainder * BIGINT_TWO - divisor;
  if (comparison > BIGINT_ZERO
    || comparison === BIGINT_ZERO && mode === 'half_up') return quotient + BIGINT_ONE;
  if (comparison === BIGINT_ZERO && mode === 'half_even'
    && quotient % BIGINT_TWO !== BIGINT_ZERO) {
    return quotient + BIGINT_ONE;
  }
  return quotient;
}

function canonicalDecimal(minorUnits: bigint, exponent: number): string {
  const negative = minorUnits < BIGINT_ZERO;
  const digits = absolute(minorUnits).toString();
  if (exponent === 0) {
    return `${negative && minorUnits !== BIGINT_ZERO ? '-' : ''}${digits}`;
  }
  const padded = digits.padStart(exponent + 1, '0');
  const split = padded.length - exponent;
  return `${negative && minorUnits !== BIGINT_ZERO ? '-' : ''}${padded.slice(0, split)}.${padded.slice(split)}`;
}

function decimalToMinor(input: {
  amount: string;
  exponent: number;
  increment: bigint;
  rounding: z.infer<typeof roundingMode>;
}): { decimal: string; minor: bigint } | DenialReason {
  if (!DECIMAL_AMOUNT.test(input.amount)) return 'INVALID_DECIMAL_AMOUNT';
  const negative = input.amount.startsWith('-');
  const unsigned = negative ? input.amount.slice(1) : input.amount;
  const [whole, fraction = ''] = unsigned.split('.');
  const magnitude = BigInt(`${whole}${fraction}`);
  const dividend = magnitude * powerOfTen(input.exponent);
  const divisor = powerOfTen(fraction.length) * input.increment;
  const rounded = roundedQuotient(dividend, divisor, input.rounding) * input.increment;
  if (rounded > MAX_MINOR_MAGNITUDE) return 'AMOUNT_OVERFLOW';
  const minor = negative && rounded !== BIGINT_ZERO ? -rounded : rounded;
  return { decimal: canonicalDecimal(minor, input.exponent), minor };
}

function minorToDecimal(input: {
  amount: string;
  exponent: number;
  increment: bigint;
}): { decimal: string; minor: bigint } | DenialReason {
  if (!MINOR_AMOUNT.test(input.amount)) return 'INVALID_MINOR_AMOUNT';
  const minor = BigInt(input.amount);
  if (absolute(minor) > MAX_MINOR_MAGNITUDE) return 'AMOUNT_OVERFLOW';
  if (minor % input.increment !== BIGINT_ZERO) return 'MINOR_INCREMENT_MISMATCH';
  return { decimal: canonicalDecimal(minor, input.exponent), minor };
}

export function evaluateServiceMoneyNormalizationV1(input: {
  request: unknown;
  artifact: unknown;
}): ServiceMoneyNormalizationDecisionV1 {
  const requestResult = serviceMoneyNormalizationRequestV1Schema.safeParse(input.request);
  if (!requestResult.success) return denied(null, 'MALFORMED_REQUEST');
  const request = requestResult.data;
  const artifactResult = coreJurisdictionDomainArtifactV1Schema.safeParse(input.artifact);
  if (!artifactResult.success) return denied(request, 'ARTIFACT_INVALID');
  const artifact = artifactResult.data;
  if (artifact.domain.domain_code !== 'payments.policy'
    || artifact.domain.domain_version !== 'payments-policy.v1') {
    return denied(request, 'PAYMENT_POLICY_UNAVAILABLE');
  }
  const { artifact_sha256: artifactHash, ...hashInput } = artifact;
  let calculatedHash: string;
  try {
    calculatedHash = calculateJurisdictionDomainArtifactSha256V1(hashInput);
  } catch {
    return denied(request, 'ARTIFACT_INVALID');
  }
  if (artifactHash !== calculatedHash) return denied(request, 'ARTIFACT_HASH_MISMATCH');
  if (artifact.status !== 'active') return denied(request, 'ARTIFACT_INACTIVE');
  const effectiveAt = Date.parse(request.effective_at);
  if (effectiveAt < Date.parse(artifact.effective_from)
    || artifact.effective_to !== null && effectiveAt >= Date.parse(artifact.effective_to)) {
    return denied(request, 'ARTIFACT_NOT_EFFECTIVE');
  }
  if (artifact.legal_review.status !== 'approved'
    || artifact.legal_review.reviewed_at === null
    || artifact.legal_review.evidence_sha256 === null
    || Date.parse(artifact.legal_review.reviewed_at ?? '') > effectiveAt
    || artifact.accounting_review.status !== 'approved'
    || artifact.accounting_review.reviewed_at === null
    || artifact.accounting_review.evidence_sha256 === null
    || Date.parse(artifact.accounting_review.reviewed_at ?? '') > effectiveAt) {
    return denied(request, 'REVIEW_UNAVAILABLE');
  }
  const policy = artifact.domain.policy.currencies.find(candidate =>
    candidate.currency_code === request.currency_code);
  if (policy === undefined) return denied(request, 'CURRENCY_POLICY_UNAVAILABLE');
  const increment = BigInt(policy.increment_minor_units);
  const normalized = request.operation === 'decimal_to_minor'
    ? decimalToMinor({ amount: request.amount, exponent: policy.exponent,
      increment, rounding: policy.rounding_mode })
    : minorToDecimal({ amount: request.amount, exponent: policy.exponent, increment });
  if (typeof normalized === 'string') return denied(request, normalized);
  return serviceMoneyNormalizationDecisionV1Schema.parse({
    contract_version: SERVICE_MONEY_NORMALIZATION_DECISION_V1,
    evaluator_version: 1,
    decision: 'accepted',
    denial_reason: null,
    evaluated_at: request.effective_at,
    operation: request.operation,
    currency_code: request.currency_code,
    exponent: policy.exponent,
    rounding_mode: policy.rounding_mode,
    increment_minor_units: policy.increment_minor_units,
    decimal_amount: normalized.decimal,
    minor_units: normalized.minor.toString(),
    artifact_sha256: artifactHash,
    durable_writes: 0,
    rail_selected: false,
    provider_selected: false,
    payment_intent_created: false,
  });
}
