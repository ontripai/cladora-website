import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

import { jurisdictionProfileSelectorDecisionV1Schema } from './jurisdiction-profile-selector-v1.ts';

export const CORE_JURISDICTION_DOMAIN_ARTIFACT_V1 =
  'core-jurisdiction-domain-artifact.v1' as const;
export const CORE_JURISDICTION_DOMAIN_BIND_REQUEST_V1 =
  'core-jurisdiction-domain-bind-request.v1' as const;
export const CORE_JURISDICTION_DOMAIN_BIND_DECISION_V1 =
  'core-jurisdiction-domain-bind-decision.v1' as const;

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const code = z.string().regex(/^[a-z][a-z0-9_.:-]{2,159}$/);
const countryCode = z.string().regex(/^[A-Z]{2}$/);
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const version = z.number().int().positive().safe();
const timestamp = z.string().datetime({ offset: true });

const canonicalUniqueCodes = (values: string[]) =>
  new Set(values).size === values.length
  && values.every((value, index) => index === 0 || values[index - 1] < value);

const reviewSchema = z.strictObject({
  status: z.enum(['pending', 'approved', 'rejected']),
  review_version: version,
  reviewed_at: timestamp.nullable(),
  evidence_sha256: sha256.nullable(),
});

const addressFieldSchema = z.strictObject({
  field_code: code,
  required: z.boolean(),
  max_length: z.number().int().positive().max(4096).safe(),
});

const postalSegmentSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.enum(['digits', 'letters', 'alphanumeric']),
    length: z.number().int().positive().max(64).safe(),
  }),
  z.strictObject({
    kind: z.literal('literal'),
    value: z.string().min(1).max(16).refine(value => value.split('').every(character => {
      const point = character.codePointAt(0);
      return point !== undefined && point >= 0x20 && point <= 0x7e;
    }), 'Postal literals must contain printable ASCII characters'),
  }),
]);

const postalFormatSchema = z.strictObject({
  segments: z.array(postalSegmentSchema).min(1).max(32),
}).superRefine((format, context) => {
  const maximumLength = format.segments.reduce((length, segment) =>
    length + (segment.kind === 'literal' ? segment.value.length : segment.length), 0);
  if (maximumLength > 256) {
    context.addIssue({ code: 'custom', message: 'Postal format exceeds the input bound' });
  }
});

const postalValidationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('none') }),
  z.strictObject({
    kind: z.literal('country_artifact_grammar'),
    formats: z.array(postalFormatSchema).min(1).max(32)
      .refine(formats => new Set(formats.map(format => JSON.stringify(format))).size
        === formats.length, 'Postal formats must be unique'),
  }),
]);

export const countryAddressStructurePolicyV1Schema = z.strictObject({
  country_source: z.literal('explicit_address_country'),
  forbidden_country_inference_sources: z.tuple([
    z.literal('currency'),
    z.literal('ip_address'),
    z.literal('language'),
    z.literal('locale'),
    z.literal('phone_number'),
    z.literal('timezone'),
  ]),
  ordered_fields: z.array(addressFieldSchema).min(2).max(64),
  postal_code: z.strictObject({
    value_type: z.literal('country_text'),
    required: z.boolean(),
    globally_unique: z.literal(false),
    normalization: z.enum(['preserve', 'trim', 'uppercase_trim']),
    validation: postalValidationSchema,
  }),
}).superRefine((policy, context) => {
  const fields = policy.ordered_fields.map(field => field.field_code);
  if (new Set(fields).size !== fields.length) {
    context.addIssue({ code: 'custom', message: 'Address fields must be unique' });
  }
  const country = policy.ordered_fields.find(field => field.field_code === 'country_code');
  if (country?.required !== true) {
    context.addIssue({ code: 'custom', message: 'Explicit country is required' });
  }
  const postal = policy.ordered_fields.find(field => field.field_code === 'postal_code');
  if (policy.postal_code.required && postal?.required !== true) {
    context.addIssue({ code: 'custom', message: 'Required postal field is missing' });
  }
});

const moneyRoundingSchema = z.strictObject({
  currency_code: currencyCode,
  exponent: z.number().int().min(0).max(6).safe(),
  rounding_mode: z.enum(['half_even', 'half_up', 'down', 'up']),
  increment_minor_units: z.number().int().positive().max(1_000_000).safe(),
});

export const countryTaxAccountingPolicyV1Schema = z.strictObject({
  reporting_currency_code: currencyCode,
  accounting_basis_code: code,
  monetary_rules: z.array(moneyRoundingSchema).min(1).max(16)
    .refine(values => canonicalUniqueCodes(values.map(value => value.currency_code)),
      'Currency rules must be unique and sorted'),
  tax_rules: z.array(z.strictObject({
    rule_code: code,
    rule_version: version,
    status: z.enum(['active', 'inactive']),
    calculation_basis_code: code,
    evidence_codes: z.array(code).max(32)
      .refine(canonicalUniqueCodes, 'Evidence codes must be unique and sorted'),
  })).max(128).refine(values => canonicalUniqueCodes(values.map(value => value.rule_code)),
    'Tax rules must be unique and sorted'),
  posting_rules: z.array(z.strictObject({
    event_code: code,
    mapping_version: version,
    debit_class_code: code,
    credit_class_code: code,
  })).max(128).refine(values => canonicalUniqueCodes(values.map(value => value.event_code)),
    'Posting rules must be unique and sorted'),
}).superRefine((policy, context) => {
  if (!policy.monetary_rules.some(rule =>
    rule.currency_code === policy.reporting_currency_code)) {
    context.addIssue({
      code: 'custom',
      message: 'Reporting currency must have a monetary rule',
    });
  }
});

const retentionPeriodSchema = z.string().min(2).max(64).refine(value => {
  const components = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?$/.exec(value);
  return components !== null
    && components.slice(1).some(component => component !== undefined && /[1-9]/.test(component));
}, 'Retention period must contain a positive numeric component');

export const countryDocumentsRetentionPolicyV1Schema = z.strictObject({
  document_types: z.array(z.strictObject({
    document_type_code: code,
    retention_rule_code: code,
    retention_period: retentionPeriodSchema,
    legal_hold_overrides_disposal: z.literal(true),
    immutable_version_required: z.boolean(),
    evidence_codes: z.array(code).max(32)
      .refine(canonicalUniqueCodes, 'Evidence codes must be unique and sorted'),
  })).min(1).max(128)
    .refine(values => canonicalUniqueCodes(values.map(value => value.document_type_code)),
      'Document types must be unique and sorted'),
  disposal_requires_review: z.boolean(),
  residency_rule_code: code,
});

const paymentOperationSchema = z.enum(['authorize', 'capture', 'settle', 'refund']);

const paymentRailSchema = z.strictObject({
  rail_code: code,
  status: z.enum(['active', 'inactive']),
  supported_currency_codes: z.array(currencyCode).min(1).max(16)
    .refine(canonicalUniqueCodes, 'Rail currencies must be unique and sorted'),
  supported_operations: z.array(paymentOperationSchema).min(1).max(4)
    .refine(canonicalUniqueCodes, 'Rail operations must be unique and sorted'),
  settlement: z.strictObject({
    mode: z.enum(['instant', 'same_day', 'deferred']),
    maximum_business_days: z.number().int().min(0).max(365).safe(),
    finality_code: code,
  }),
  refund: z.strictObject({
    supported: z.boolean(),
    original_rail_required: z.boolean(),
    maximum_days: z.number().int().min(0).max(3650).safe().nullable(),
  }),
  receipt_invoice: z.strictObject({
    receipt_required: z.boolean(),
    invoice_required: z.boolean(),
    evidence_codes: z.array(code).max(32)
      .refine(canonicalUniqueCodes, 'Receipt evidence must be unique and sorted'),
  }),
  regulatory_evidence: z.strictObject({
    required: z.boolean(),
    evidence_codes: z.array(code).max(32)
      .refine(canonicalUniqueCodes, 'Regulatory evidence must be unique and sorted'),
  }),
}).superRefine((rail, context) => {
  const supportsRefund = rail.supported_operations.includes('refund');
  if (rail.refund.supported !== supportsRefund) {
    context.addIssue({
      code: 'custom',
      message: 'Refund operation and refund policy must agree',
    });
  }
  if (rail.refund.supported
    ? rail.refund.maximum_days === null || rail.refund.maximum_days <= 0
    : rail.refund.maximum_days !== null) {
    context.addIssue({
      code: 'custom',
      message: 'Refund maximum days must be positive exactly when refunds are supported',
    });
  }
  const sameDaySettlement = rail.settlement.mode === 'instant'
    || rail.settlement.mode === 'same_day';
  if (sameDaySettlement
    ? rail.settlement.maximum_business_days !== 0
    : rail.settlement.maximum_business_days <= 0) {
    context.addIssue({
      code: 'custom',
      message: 'Settlement mode and maximum business days are inconsistent',
    });
  }
  if ((rail.receipt_invoice.receipt_required || rail.receipt_invoice.invoice_required)
    && rail.receipt_invoice.evidence_codes.length === 0) {
    context.addIssue({
      code: 'custom',
      message: 'Required receipt or invoice evidence must declare evidence codes',
    });
  }
  if (rail.regulatory_evidence.required
    && rail.regulatory_evidence.evidence_codes.length === 0) {
    context.addIssue({
      code: 'custom',
      message: 'Required regulatory evidence must declare evidence codes',
    });
  }
});

export const countryPaymentPolicyV1Schema = z.strictObject({
  currencies: z.array(moneyRoundingSchema).min(1).max(16)
    .refine(values => canonicalUniqueCodes(values.map(value => value.currency_code)),
      'Currencies must be unique and sorted'),
  rails: z.array(paymentRailSchema).min(1).max(64)
    .refine(values => canonicalUniqueCodes(values.map(value => value.rail_code)),
      'Payment rails must be unique and sorted'),
}).superRefine((policy, context) => {
  const currencies = new Set(policy.currencies.map(value => value.currency_code));
  for (const rail of policy.rails) {
    if (rail.supported_currency_codes.some(value => !currencies.has(value))) {
      context.addIssue({ code: 'custom', message: 'Rail references an unsupported currency' });
    }
  }
});

export const countryPackDomainPolicyV1Schema = z.discriminatedUnion('domain_code', [
  z.strictObject({
    domain_code: z.literal('address.structure'),
    domain_version: z.literal('address-structure.v1'),
    policy: countryAddressStructurePolicyV1Schema,
  }),
  z.strictObject({
    domain_code: z.literal('finance.tax-accounting'),
    domain_version: z.literal('finance-tax-accounting.v1'),
    policy: countryTaxAccountingPolicyV1Schema,
  }),
  z.strictObject({
    domain_code: z.literal('documents.retention'),
    domain_version: z.literal('documents-retention.v1'),
    policy: countryDocumentsRetentionPolicyV1Schema,
  }),
  z.strictObject({
    domain_code: z.literal('payments.policy'),
    domain_version: z.literal('payments-policy.v1'),
    policy: countryPaymentPolicyV1Schema,
  }),
]);

const artifactBaseShape = {
  contract_version: z.literal(CORE_JURISDICTION_DOMAIN_ARTIFACT_V1),
  artifact_version: z.literal(1),
  profile: z.strictObject({
    profile_id: uuid,
    profile_code: code,
    profile_version: version,
    country_code: countryCode,
    manifest_sha256: sha256,
  }),
  domain: countryPackDomainPolicyV1Schema,
  effective_from: timestamp,
  effective_to: timestamp.nullable(),
  status: z.enum(['draft', 'validated', 'active', 'suspended', 'retired']),
  legal_review: reviewSchema,
  accounting_review: reviewSchema,
  reusable_as_command_authority: z.literal(false),
} as const;

function validateEffectivePeriod(
  artifact: { effective_from: string; effective_to: string | null },
  context: z.RefinementCtx,
) {
  if (artifact.effective_to !== null
    && Date.parse(artifact.effective_to) <= Date.parse(artifact.effective_from)) {
    context.addIssue({ code: 'custom', message: 'Artifact effective period is invalid' });
  }
}

export const coreJurisdictionDomainArtifactHashInputV1Schema = z.strictObject(
  artifactBaseShape,
).superRefine(validateEffectivePeriod);

export const coreJurisdictionDomainArtifactV1Schema = z.strictObject({
  ...artifactBaseShape,
  artifact_sha256: sha256,
}).superRefine(validateEffectivePeriod);

export const coreJurisdictionDomainBindRequestV1Schema = z.strictObject({
  contract_version: z.literal(CORE_JURISDICTION_DOMAIN_BIND_REQUEST_V1),
  domain_code: z.enum([
    'address.structure',
    'finance.tax-accounting',
    'documents.retention',
    'payments.policy',
  ]),
  domain_version: code,
  effective_at: timestamp,
  payment_use: z.strictObject({
    currency_code: currencyCode,
    rail_code: code,
    operation: paymentOperationSchema,
  }).nullable(),
});

const paymentResolutionSchema = z.strictObject({
  currency_code: currencyCode,
  exponent: z.number().int().min(0).max(6).safe(),
  rounding_mode: z.enum(['half_even', 'half_up', 'down', 'up']),
  increment_minor_units: z.number().int().positive().max(1_000_000).safe(),
  rail_code: code,
  operation: paymentOperationSchema,
  settlement_mode: z.enum(['instant', 'same_day', 'deferred']),
  refund_supported: z.boolean(),
  receipt_required: z.boolean(),
  invoice_required: z.boolean(),
  regulatory_evidence_required: z.boolean(),
});

const bindDecisionBase = {
  contract_version: z.literal(CORE_JURISDICTION_DOMAIN_BIND_DECISION_V1),
  binder_version: z.literal(1),
  decision_id: uuid,
  evaluated_at: timestamp,
  reusable_as_command_authority: z.literal(false),
} as const;

export const coreJurisdictionDomainBindDecisionV1Schema = z.discriminatedUnion('decision', [
  z.strictObject({
    ...bindDecisionBase,
    decision: z.literal('accepted'),
    denial_reason: z.null(),
    artifact: coreJurisdictionDomainArtifactV1Schema,
    payment_resolution: paymentResolutionSchema.nullable(),
  }),
  z.strictObject({
    ...bindDecisionBase,
    decision: z.literal('denied'),
    denial_reason: z.enum([
      'MALFORMED_INPUT',
      'CREDENTIAL_DATA_FORBIDDEN',
      'JURISDICTION_SELECTION_UNAVAILABLE',
      'DOMAIN_UNAVAILABLE',
      'PROFILE_MISMATCH',
      'DOMAIN_MISMATCH',
      'EFFECTIVE_TIME_MISMATCH',
      'ARTIFACT_HASH_MISMATCH',
      'ARTIFACT_INACTIVE',
      'ARTIFACT_NOT_EFFECTIVE',
      'REVIEW_UNAVAILABLE',
      'PAYMENT_POLICY_UNAVAILABLE',
    ]),
    artifact: z.null(),
    payment_resolution: z.null(),
  }),
]);

export type CoreJurisdictionDomainArtifactV1 = z.infer<
  typeof coreJurisdictionDomainArtifactV1Schema
>;
export type CoreJurisdictionDomainBindDecisionV1 = z.infer<
  typeof coreJurisdictionDomainBindDecisionV1Schema
>;

const forbiddenArtifactKeys = new Set([
  'account_number',
  'api_key',
  'credential',
  'credentials',
  'merchant_id',
  'password',
  'provider_token',
  'secret',
]);

function containsForbiddenCredentialData(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenCredentialData);
  if (value === null || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, child]) => {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    return forbiddenArtifactKeys.has(normalized)
      || /(?:^|_)(?:account_number|merchant_id)(?:_|$)/.test(normalized)
      || /_(?:api_key|credential|password|secret|token)$/.test(normalized)
      || containsForbiddenCredentialData(child);
  });
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function calculateJurisdictionDomainArtifactSha256V1(value: unknown): string {
  if (containsForbiddenCredentialData(value)) throw new Error('credential_data_forbidden');
  const artifact = coreJurisdictionDomainArtifactHashInputV1Schema.parse(value);
  return createHash('sha256').update(canonicalJson(artifact)).digest('hex');
}

type DenialReason = Extract<CoreJurisdictionDomainBindDecisionV1,
  { decision: 'denied' }>['denial_reason'];

function denied(evaluatedAt: string, reason: DenialReason): CoreJurisdictionDomainBindDecisionV1 {
  return coreJurisdictionDomainBindDecisionV1Schema.parse({
    contract_version: CORE_JURISDICTION_DOMAIN_BIND_DECISION_V1,
    binder_version: 1,
    decision_id: randomUUID(),
    evaluated_at: evaluatedAt,
    decision: 'denied',
    denial_reason: reason,
    artifact: null,
    payment_resolution: null,
    reusable_as_command_authority: false,
  });
}

export function bindCoreJurisdictionDomainArtifactV1(input: {
  selection: unknown;
  artifact: unknown;
  request: unknown;
}): CoreJurisdictionDomainBindDecisionV1 {
  const request = coreJurisdictionDomainBindRequestV1Schema.safeParse(input.request);
  const evaluatedAt = request.success ? request.data.effective_at : new Date().toISOString();
  if (containsForbiddenCredentialData(input.artifact)) {
    return denied(evaluatedAt, 'CREDENTIAL_DATA_FORBIDDEN');
  }
  const selection = jurisdictionProfileSelectorDecisionV1Schema.safeParse(input.selection);
  const artifact = coreJurisdictionDomainArtifactV1Schema.safeParse(input.artifact);
  if (!request.success || !selection.success || !artifact.success) {
    return denied(evaluatedAt, 'MALFORMED_INPUT');
  }
  if (selection.data.decision !== 'accepted') {
    return denied(evaluatedAt, 'JURISDICTION_SELECTION_UNAVAILABLE');
  }
  if (Date.parse(request.data.effective_at) !== Date.parse(selection.data.evaluated_at)) {
    return denied(evaluatedAt, 'EFFECTIVE_TIME_MISMATCH');
  }
  const selected = selection.data.binding;
  const matchingDomains = selected.domains.filter(domain =>
    domain.domain_code === request.data.domain_code);
  if (matchingDomains.length !== 1) return denied(evaluatedAt, 'DOMAIN_UNAVAILABLE');
  const selectedDomain = matchingDomains[0];

  if (artifact.data.profile.profile_id !== selected.profile_id
    || artifact.data.profile.profile_code !== selected.profile_code
    || artifact.data.profile.profile_version !== selected.profile_version
    || artifact.data.profile.country_code !== selected.country_code
    || artifact.data.profile.manifest_sha256 !== selected.profile_manifest_sha256) {
    return denied(evaluatedAt, 'PROFILE_MISMATCH');
  }
  if (artifact.data.domain.domain_code !== request.data.domain_code
    || artifact.data.domain.domain_version !== request.data.domain_version
    || selectedDomain.contract_version !== request.data.domain_version) {
    return denied(evaluatedAt, 'DOMAIN_MISMATCH');
  }
  const { artifact_sha256: artifactHash, ...hashInput } = artifact.data;
  const calculatedHash = calculateJurisdictionDomainArtifactSha256V1(hashInput);
  if (artifactHash !== calculatedHash || selectedDomain.artifact_sha256 !== calculatedHash) {
    return denied(evaluatedAt, 'ARTIFACT_HASH_MISMATCH');
  }
  if (artifact.data.status !== 'active') return denied(evaluatedAt, 'ARTIFACT_INACTIVE');
  const effectiveAt = Date.parse(request.data.effective_at);
  if (effectiveAt < Date.parse(artifact.data.effective_from)
    || artifact.data.effective_to !== null
      && effectiveAt >= Date.parse(artifact.data.effective_to)) {
    return denied(evaluatedAt, 'ARTIFACT_NOT_EFFECTIVE');
  }
  if (artifact.data.legal_review.status !== 'approved'
    || artifact.data.legal_review.reviewed_at === null
    || artifact.data.legal_review.evidence_sha256 === null
    || Date.parse(artifact.data.legal_review.reviewed_at ?? '') > effectiveAt
    || artifact.data.accounting_review.status !== 'approved'
    || artifact.data.accounting_review.reviewed_at === null
    || artifact.data.accounting_review.evidence_sha256 === null
    || Date.parse(artifact.data.accounting_review.reviewed_at ?? '') > effectiveAt) {
    return denied(evaluatedAt, 'REVIEW_UNAVAILABLE');
  }

  let paymentResolution: z.infer<typeof paymentResolutionSchema> | null = null;
  if (artifact.data.domain.domain_code === 'payments.policy') {
    if (request.data.payment_use === null) {
      return denied(evaluatedAt, 'PAYMENT_POLICY_UNAVAILABLE');
    }
    const currency = artifact.data.domain.policy.currencies.find(value =>
      value.currency_code === request.data.payment_use?.currency_code);
    const rail = artifact.data.domain.policy.rails.find(value =>
      value.rail_code === request.data.payment_use?.rail_code);
    if (currency === undefined || rail === undefined || rail.status !== 'active'
      || !rail.supported_currency_codes.includes(currency.currency_code)
      || !rail.supported_operations.includes(request.data.payment_use.operation)
      || request.data.payment_use.operation === 'refund'
        && (!rail.refund.supported || rail.refund.maximum_days === null
          || rail.refund.maximum_days <= 0)) {
      return denied(evaluatedAt, 'PAYMENT_POLICY_UNAVAILABLE');
    }
    paymentResolution = {
      currency_code: currency.currency_code,
      exponent: currency.exponent,
      rounding_mode: currency.rounding_mode,
      increment_minor_units: currency.increment_minor_units,
      rail_code: rail.rail_code,
      operation: request.data.payment_use.operation,
      settlement_mode: rail.settlement.mode,
      refund_supported: rail.refund.supported,
      receipt_required: rail.receipt_invoice.receipt_required,
      invoice_required: rail.receipt_invoice.invoice_required,
      regulatory_evidence_required: rail.regulatory_evidence.required,
    };
  } else if (request.data.payment_use !== null) {
    return denied(evaluatedAt, 'DOMAIN_MISMATCH');
  }

  return coreJurisdictionDomainBindDecisionV1Schema.parse({
    contract_version: CORE_JURISDICTION_DOMAIN_BIND_DECISION_V1,
    binder_version: 1,
    decision_id: randomUUID(),
    evaluated_at: request.data.effective_at,
    decision: 'accepted',
    denial_reason: null,
    artifact: artifact.data,
    payment_resolution: paymentResolution,
    reusable_as_command_authority: false,
  });
}

export const countryPostalCodeInputV1Schema = z.strictObject({
  country_code: countryCode,
  postal_code: z.string().max(256),
});

function postalCharacterMatches(kind: 'digits' | 'letters' | 'alphanumeric',
  character: string): boolean {
  const point = character.charCodeAt(0);
  const digit = point >= 0x30 && point <= 0x39;
  const letter = point >= 0x41 && point <= 0x5a || point >= 0x61 && point <= 0x7a;
  return kind === 'digits' ? digit : kind === 'letters' ? letter : digit || letter;
}

function postalFormatMatches(format: z.infer<typeof postalFormatSchema>, value: string): boolean {
  let offset = 0;
  for (const segment of format.segments) {
    if (segment.kind === 'literal') {
      if (!value.startsWith(segment.value, offset)) return false;
      offset += segment.value.length;
      continue;
    }
    const candidate = value.slice(offset, offset + segment.length);
    if (candidate.length !== segment.length
      || candidate.split('').some(character =>
        !postalCharacterMatches(segment.kind, character))) {
      return false;
    }
    offset += segment.length;
  }
  return offset === value.length;
}

/** Artifact-specific postal validation. It carries no registry or uniqueness check. */
export function postalCodeMatchesBoundCountryArtifactV1(
  decisionValue: unknown,
  addressValue: unknown,
): boolean {
  const decision = coreJurisdictionDomainBindDecisionV1Schema.parse(decisionValue);
  const address = countryPostalCodeInputV1Schema.parse(addressValue);
  if (decision.decision !== 'accepted'
    || decision.artifact.domain.domain_code !== 'address.structure'
    || decision.artifact.profile.country_code !== address.country_code) return false;
  const postal = decision.artifact.domain.policy.postal_code;
  let value = address.postal_code;
  if (postal.normalization === 'trim') value = value.trim();
  if (postal.normalization === 'uppercase_trim') value = value.trim().toUpperCase();
  if (postal.required && value.length === 0) return false;
  if (postal.validation.kind === 'none') return true;
  return postal.validation.formats.some(format => postalFormatMatches(format, value));
}
