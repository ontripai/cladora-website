import { z } from 'zod';

import {
  calculateJurisdictionDomainArtifactSha256V1,
  coreJurisdictionDomainArtifactV1Schema,
  type CoreJurisdictionDomainArtifactV1,
} from '../core/jurisdiction-domain-artifact-v1.ts';

export const DOCUMENTS_COUNTRY_RETENTION_EVALUATION_REQUEST_V1 =
  'documents-country-retention-evaluation-request.v1' as const;
export const DOCUMENTS_COUNTRY_RETENTION_DECISION_V1 =
  'documents-country-retention-decision.v1' as const;

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const code = z.string().regex(/^[a-z][a-z0-9_.:-]{2,159}$/);
const version = z.number().int().positive().safe();
const timestamp = z.string().datetime({ offset: true });
const operation = z.enum(['retain', 'dispose', 'read-policy']);
const legalHoldState = z.enum(['none', 'active']);

export const documentsCountryRetentionEvaluationRequestV1Schema = z.strictObject({
  contract_version: z.literal(DOCUMENTS_COUNTRY_RETENTION_EVALUATION_REQUEST_V1),
  artifact: z.unknown().refine(value => value !== undefined, 'Artifact is required'),
  document_type_code: code,
  document_immutable_version: version,
  effective_at: timestamp,
  legal_hold_state: legalHoldState,
  requested_operation: operation,
});

const artifactFingerprintSchema = z.strictObject({
  artifact_contract_version: z.literal('core-jurisdiction-domain-artifact.v1'),
  profile_id: uuid,
  profile_code: code,
  profile_version: version,
  country_code: z.string().regex(/^[A-Z]{2}$/),
  profile_manifest_sha256: sha256,
  domain_code: z.literal('documents.retention'),
  domain_version: z.literal('documents-retention.v1'),
  artifact_version: z.literal(1),
  artifact_sha256: sha256,
  artifact_effective_from: timestamp,
  artifact_effective_to: timestamp.nullable(),
});

const decisionBase = {
  contract_version: z.literal(DOCUMENTS_COUNTRY_RETENTION_DECISION_V1),
  evaluator_version: z.literal(1),
  requested_operation: operation.nullable(),
  effective_at: timestamp.nullable(),
  artifact_fingerprint: artifactFingerprintSchema.nullable(),
  reusable_as_command_authority: z.literal(false),
} as const;

export const documentsCountryRetentionDecisionV1Schema = z.discriminatedUnion('decision', [
  z.strictObject({
    ...decisionBase,
    decision: z.literal('accepted'),
    denial_reason: z.null(),
    artifact_fingerprint: artifactFingerprintSchema,
    resolution: z.strictObject({
      document_type_code: code,
      document_immutable_version: version,
      retention_rule_code: code,
      retention_period: z.string().min(2).max(64),
      legal_hold_state: legalHoldState,
      immutable_version_required: z.boolean(),
      disposal_requires_review: z.boolean(),
      operation_effect: z.enum([
        'retention_required',
        'disposal_review_required',
        'disposal_policy_satisfied',
        'policy_available',
      ]),
    }),
  }),
  z.strictObject({
    ...decisionBase,
    decision: z.literal('denied'),
    denial_reason: z.enum([
      'MALFORMED_INPUT',
      'MALFORMED_ARTIFACT',
      'DOMAIN_MISMATCH',
      'ARTIFACT_HASH_MISMATCH',
      'ARTIFACT_INACTIVE',
      'ARTIFACT_NOT_EFFECTIVE',
      'REVIEW_UNAVAILABLE',
      'DOCUMENT_TYPE_UNAVAILABLE',
      'LEGAL_HOLD_BLOCKS_DISPOSAL',
    ]),
    resolution: z.null(),
  }),
]);

export type DocumentsCountryRetentionEvaluationRequestV1 = z.input<
  typeof documentsCountryRetentionEvaluationRequestV1Schema
>;
export type DocumentsCountryRetentionDecisionV1 = z.infer<
  typeof documentsCountryRetentionDecisionV1Schema
>;

type ParsedRequest = z.infer<typeof documentsCountryRetentionEvaluationRequestV1Schema>;
type DenialReason = Extract<DocumentsCountryRetentionDecisionV1,
  { decision: 'denied' }>['denial_reason'];
type Fingerprint = z.infer<typeof artifactFingerprintSchema>;

function deny(
  reason: DenialReason,
  request: ParsedRequest | null,
  fingerprint: Fingerprint | null = null,
): DocumentsCountryRetentionDecisionV1 {
  return documentsCountryRetentionDecisionV1Schema.parse({
    contract_version: DOCUMENTS_COUNTRY_RETENTION_DECISION_V1,
    evaluator_version: 1,
    decision: 'denied',
    denial_reason: reason,
    requested_operation: request?.requested_operation ?? null,
    effective_at: request?.effective_at ?? null,
    artifact_fingerprint: fingerprint,
    resolution: null,
    reusable_as_command_authority: false,
  });
}

function fingerprint(artifact: CoreJurisdictionDomainArtifactV1): Fingerprint | null {
  if (artifact.domain.domain_code !== 'documents.retention') return null;
  return artifactFingerprintSchema.parse({
    artifact_contract_version: artifact.contract_version,
    profile_id: artifact.profile.profile_id,
    profile_code: artifact.profile.profile_code,
    profile_version: artifact.profile.profile_version,
    country_code: artifact.profile.country_code,
    profile_manifest_sha256: artifact.profile.manifest_sha256,
    domain_code: artifact.domain.domain_code,
    domain_version: artifact.domain.domain_version,
    artifact_version: artifact.artifact_version,
    artifact_sha256: artifact.artifact_sha256,
    artifact_effective_from: artifact.effective_from,
    artifact_effective_to: artifact.effective_to,
  });
}

/**
 * Pure, inactive evaluation of an already supplied Core jurisdiction artifact.
 * This function performs no lookup, authority resolution, replay, clock read or
 * mutation. The caller remains responsible for obtaining the artifact through
 * the future canonical Core resolver before any runtime composition.
 */
export function evaluateDocumentsCountryRetentionV1(
  inputValue: unknown,
): DocumentsCountryRetentionDecisionV1 {
  const request = documentsCountryRetentionEvaluationRequestV1Schema.safeParse(inputValue);
  if (!request.success) return deny('MALFORMED_INPUT', null);

  const artifact = coreJurisdictionDomainArtifactV1Schema.safeParse(request.data.artifact);
  if (!artifact.success) return deny('MALFORMED_ARTIFACT', request.data);

  const { artifact_sha256: declaredHash, ...hashInput } = artifact.data;
  let calculatedHash: string;
  try {
    calculatedHash = calculateJurisdictionDomainArtifactSha256V1(hashInput);
  } catch {
    return deny('MALFORMED_ARTIFACT', request.data);
  }
  if (declaredHash !== calculatedHash) {
    return deny('ARTIFACT_HASH_MISMATCH', request.data);
  }

  if (artifact.data.domain.domain_code !== 'documents.retention'
    || artifact.data.domain.domain_version !== 'documents-retention.v1') {
    return deny('DOMAIN_MISMATCH', request.data);
  }
  const exactFingerprint = fingerprint(artifact.data);
  if (exactFingerprint === null) return deny('DOMAIN_MISMATCH', request.data);

  if (artifact.data.status !== 'active') {
    return deny('ARTIFACT_INACTIVE', request.data, exactFingerprint);
  }

  const effectiveAt = Date.parse(request.data.effective_at);
  if (effectiveAt < Date.parse(artifact.data.effective_from)
    || artifact.data.effective_to !== null
      && effectiveAt >= Date.parse(artifact.data.effective_to)) {
    return deny('ARTIFACT_NOT_EFFECTIVE', request.data, exactFingerprint);
  }

  if (artifact.data.legal_review.status !== 'approved'
    || artifact.data.legal_review.reviewed_at === null
    || artifact.data.legal_review.evidence_sha256 === null
    || Date.parse(artifact.data.legal_review.reviewed_at) > effectiveAt
    || artifact.data.accounting_review.status !== 'approved'
    || artifact.data.accounting_review.reviewed_at === null
    || artifact.data.accounting_review.evidence_sha256 === null
    || Date.parse(artifact.data.accounting_review.reviewed_at) > effectiveAt) {
    return deny('REVIEW_UNAVAILABLE', request.data, exactFingerprint);
  }

  const rules = artifact.data.domain.policy.document_types.filter(rule =>
    rule.document_type_code === request.data.document_type_code);
  if (rules.length !== 1) {
    return deny('DOCUMENT_TYPE_UNAVAILABLE', request.data, exactFingerprint);
  }
  const rule = rules[0];

  if (request.data.requested_operation === 'dispose'
    && request.data.legal_hold_state === 'active') {
    return deny('LEGAL_HOLD_BLOCKS_DISPOSAL', request.data, exactFingerprint);
  }

  const operationEffect = request.data.requested_operation === 'retain'
    ? 'retention_required'
    : request.data.requested_operation === 'read-policy'
      ? 'policy_available'
      : artifact.data.domain.policy.disposal_requires_review
        ? 'disposal_review_required'
        : 'disposal_policy_satisfied';

  return documentsCountryRetentionDecisionV1Schema.parse({
    contract_version: DOCUMENTS_COUNTRY_RETENTION_DECISION_V1,
    evaluator_version: 1,
    decision: 'accepted',
    denial_reason: null,
    requested_operation: request.data.requested_operation,
    effective_at: request.data.effective_at,
    artifact_fingerprint: exactFingerprint,
    resolution: {
      document_type_code: rule.document_type_code,
      document_immutable_version: request.data.document_immutable_version,
      retention_rule_code: rule.retention_rule_code,
      retention_period: rule.retention_period,
      legal_hold_state: request.data.legal_hold_state,
      immutable_version_required: rule.immutable_version_required,
      disposal_requires_review: artifact.data.domain.policy.disposal_requires_review,
      operation_effect: operationEffect,
    },
    reusable_as_command_authority: false,
  });
}
