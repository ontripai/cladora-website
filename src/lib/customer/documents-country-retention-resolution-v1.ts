import { z } from 'zod';

import {
  committedJurisdictionDomainArtifactEvidenceReferenceV1Schema,
  CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1,
  resolveCurrentJurisdictionDomainArtifactV1,
  resolveHistoricalJurisdictionDomainArtifactV1,
  type JurisdictionDomainArtifactResolverDecisionV1,
} from '../core/jurisdiction-domain-artifact-resolver-v1.ts';
import {
  type CurrentAuthorityTransactionDecisionReceiptV1,
} from '../core/current-authority-transaction-port-v1.ts';
import {
  type CoreTransactionCommandV1,
  type CoreTransactionCommandV2,
  type CoreTransactionScopeV1,
} from '../core/postgres-transaction-host-v1.ts';
import {
  DOCUMENTS_COUNTRY_RETENTION_DECISION_V1,
  DOCUMENTS_COUNTRY_RETENTION_EVALUATION_REQUEST_V1,
  documentsCountryRetentionDecisionV1Schema,
  evaluateDocumentsCountryRetentionV1,
} from './documents-country-retention-evaluator-v1.ts';
import { uuidSchema } from './workspace-composition-schema.ts';

export const DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_REQUEST_V1 =
  'documents-country-retention-resolution-request.v1' as const;
export const DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_DECISION_V1 =
  'documents-country-retention-resolution-decision.v1' as const;

const code = z.string().regex(/^[a-z][a-z0-9_.:-]{2,159}$/);
const version = z.number().int().positive().safe();
const operation = z.enum(['retain', 'dispose', 'read-policy']);
const legalHoldState = z.enum(['none', 'active']);
const countryCode = z.string().regex(/^[A-Z]{2}$/);

const evaluationFields = {
  document_type_code: code,
  document_immutable_version: version,
  legal_hold_state: legalHoldState,
  requested_operation: operation,
} as const;

export const documentsCountryRetentionCurrentResolutionRequestV1Schema = z.strictObject({
  contract_version: z.literal(DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_REQUEST_V1),
  mode: z.literal('current'),
  property_id: uuidSchema,
  expected_country_code: countryCode.optional(),
  ...evaluationFields,
});

export const documentsCountryRetentionHistoricalResolutionRequestV1Schema = z.strictObject({
  contract_version: z.literal(DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_REQUEST_V1),
  mode: z.literal('historical'),
  committed_evidence: committedJurisdictionDomainArtifactEvidenceReferenceV1Schema,
  ...evaluationFields,
});

export const documentsCountryRetentionResolutionRequestV1Schema = z.discriminatedUnion('mode', [
  documentsCountryRetentionCurrentResolutionRequestV1Schema,
  documentsCountryRetentionHistoricalResolutionRequestV1Schema,
]);

const resolverDenialReason = z.enum([
  'BINDING_MISMATCH',
  'AUTHORITY_DENIED',
  'STALE_AUTHORITY',
  'PROFILE_SELECTION_UNAVAILABLE',
  'ARTIFACT_UNAVAILABLE',
  'ARTIFACT_AMBIGUOUS',
  'ARTIFACT_BYTES_MISSING',
  'ARTIFACT_HASH_MISMATCH',
  'ARTIFACT_SCHEMA_UNSUPPORTED',
  'ARTIFACT_INACTIVE',
  'ARTIFACT_NOT_EFFECTIVE',
  'REVIEW_UNAVAILABLE',
  'HISTORICAL_RECEIPT_UNAVAILABLE',
  'PROVIDER_UNAVAILABLE',
]);

const decisionBase = {
  contract_version: z.literal(DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_DECISION_V1),
  composition_version: z.literal(1),
  mode: z.enum(['current', 'historical']).nullable(),
  resolver_contract_version: z.literal(
    'core-jurisdiction-domain-artifact-resolver-decision.v1',
  ).nullable(),
  resolver_version: z.literal(1).nullable(),
  resolver_denial_reason: resolverDenialReason.nullable(),
  evaluation: documentsCountryRetentionDecisionV1Schema.nullable(),
  source_disclosure: z.literal('status_only'),
  source_reference: z.null(),
  reusable_as_command_authority: z.literal(false),
} as const;

export const documentsCountryRetentionResolutionDecisionV1Schema = z.discriminatedUnion(
  'decision',
  [
    z.strictObject({
      ...decisionBase,
      decision: z.literal('accepted'),
      denial_reason: z.null(),
      resolver_contract_version: z.literal(
        'core-jurisdiction-domain-artifact-resolver-decision.v1',
      ),
      resolver_version: z.literal(1),
      resolver_denial_reason: z.null(),
      evaluation: documentsCountryRetentionDecisionV1Schema.refine(
        value => value.decision === 'accepted',
        'Accepted composition requires an accepted evaluation',
      ),
    }),
    z.strictObject({
      ...decisionBase,
      decision: z.literal('denied'),
      denial_reason: z.enum([
        'MALFORMED_INPUT',
        'RESOLVER_DENIED',
        'RESOLVER_EVIDENCE_MISMATCH',
        'EVALUATOR_DENIED',
      ]),
    }),
  ],
);

export type DocumentsCountryRetentionResolutionRequestV1 = z.infer<
  typeof documentsCountryRetentionResolutionRequestV1Schema
>;
export type DocumentsCountryRetentionResolutionDecisionV1 = z.infer<
  typeof documentsCountryRetentionResolutionDecisionV1Schema
>;

type CoreCommand = CoreTransactionCommandV1 | CoreTransactionCommandV2;
type ParsedRequest = DocumentsCountryRetentionResolutionRequestV1;
type AcceptedResolverDecision = Extract<JurisdictionDomainArtifactResolverDecisionV1,
  { decision: 'accepted' }>;

function denied(
  mode: 'current' | 'historical' | null,
  reason: Extract<DocumentsCountryRetentionResolutionDecisionV1,
    { decision: 'denied' }>['denial_reason'],
  resolver: JurisdictionDomainArtifactResolverDecisionV1 | null = null,
  evaluation: z.infer<typeof documentsCountryRetentionDecisionV1Schema> | null = null,
): DocumentsCountryRetentionResolutionDecisionV1 {
  return documentsCountryRetentionResolutionDecisionV1Schema.parse({
    contract_version: DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_DECISION_V1,
    composition_version: 1,
    mode,
    decision: 'denied',
    denial_reason: reason,
    resolver_contract_version: resolver?.contract_version ?? null,
    resolver_version: resolver?.resolver_version ?? null,
    resolver_denial_reason: resolver?.decision === 'denied' ? resolver.denial_reason : null,
    evaluation,
    source_disclosure: 'status_only',
    source_reference: null,
    reusable_as_command_authority: false,
  });
}

function resolverBinding(command: CoreCommand, scope: CoreTransactionScopeV1) {
  return {
    transaction_id: command.transaction_id,
    command_id: command.command_id,
    attempt: scope.attempt,
    context_id: command.context_id,
    workspace_id: command.workspace_id,
    actor_id: command.actor_id,
    authority_version: command.authority_version,
    provider_source_ids: command.provider_source_ids,
    lock: {
      kind: 'command_aggregate' as const,
      aggregate_type: command.aggregate_type,
      aggregate_id: command.aggregate_id,
    },
  };
}

function exactAcceptedEvidence(
  request: ParsedRequest,
  resolver: AcceptedResolverDecision,
) {
  const artifact = resolver.artifact;
  const fingerprint = resolver.fingerprint;
  const exactArtifact = artifact.profile.profile_id === fingerprint.profile_id
    && artifact.profile.profile_code === fingerprint.profile_code
    && artifact.profile.profile_version === fingerprint.profile_version
    && artifact.profile.country_code === fingerprint.country_code
    && artifact.profile.manifest_sha256 === fingerprint.profile_manifest_sha256
    && artifact.domain.domain_code === fingerprint.domain_code
    && artifact.domain.domain_version === fingerprint.domain_version
    && artifact.artifact_sha256 === fingerprint.artifact_sha256
    && artifact.effective_from === fingerprint.effective_from
    && artifact.effective_to === fingerprint.effective_to
    && artifact.status === fingerprint.lifecycle_status
    && artifact.domain.domain_code === 'documents.retention'
    && artifact.domain.domain_version === 'documents-retention.v1';
  if (!exactArtifact || request.mode !== resolver.mode) return false;
  if (request.mode === 'current') return true;
  const reference = request.committed_evidence.reference;
  return reference.profile_id === fingerprint.profile_id
    && reference.profile_code === fingerprint.profile_code
    && reference.profile_version === fingerprint.profile_version
    && reference.country_code === fingerprint.country_code
    && reference.profile_manifest_sha256 === fingerprint.profile_manifest_sha256
    && reference.domain_code === fingerprint.domain_code
    && reference.domain_version === fingerprint.domain_version
    && reference.artifact_sha256 === fingerprint.artifact_sha256
    && Date.parse(reference.effective_at) >= Date.parse(fingerprint.effective_from)
    && (fingerprint.effective_to === null
      || Date.parse(reference.effective_at) < Date.parse(fingerprint.effective_to));
}

/**
 * Inactive, SELECT-only Documents composition. Artifact selection remains
 * exclusively owned by the canonical Core resolver in the supplied
 * CoreTransactionScopeV1; callers cannot provide artifact bytes.
 */
export async function resolveDocumentsCountryRetentionV1(
  scope: CoreTransactionScopeV1,
  command: CoreCommand,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  inputValue: unknown,
): Promise<DocumentsCountryRetentionResolutionDecisionV1> {
  const request = documentsCountryRetentionResolutionRequestV1Schema.safeParse(inputValue);
  if (!request.success) return denied(null, 'MALFORMED_INPUT');

  const binding = resolverBinding(command, scope);
  const resolver = request.data.mode === 'current'
    ? await resolveCurrentJurisdictionDomainArtifactV1(scope, command, authority, {
      contract_version: CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1,
      mode: 'current',
      ...binding,
      property_id: request.data.property_id,
      expected_country_code: request.data.expected_country_code,
      domain_code: 'documents.retention',
      domain_version: 'documents-retention.v1',
    })
    : await resolveHistoricalJurisdictionDomainArtifactV1(scope, command, authority, {
      contract_version: CORE_JURISDICTION_DOMAIN_ARTIFACT_RESOLVER_REQUEST_V1,
      mode: 'historical',
      ...binding,
      committed_evidence: request.data.committed_evidence,
    });

  if (resolver.decision === 'denied') {
    return denied(request.data.mode, 'RESOLVER_DENIED', resolver);
  }
  if (!exactAcceptedEvidence(request.data, resolver)) {
    return denied(request.data.mode, 'RESOLVER_EVIDENCE_MISMATCH', resolver);
  }

  const effectiveAt = request.data.mode === 'current'
    ? resolver.evaluated_at
    : request.data.committed_evidence.reference.effective_at;
  const evaluation = evaluateDocumentsCountryRetentionV1({
    contract_version: DOCUMENTS_COUNTRY_RETENTION_EVALUATION_REQUEST_V1,
    artifact: resolver.artifact,
    document_type_code: request.data.document_type_code,
    document_immutable_version: request.data.document_immutable_version,
    effective_at: effectiveAt,
    legal_hold_state: request.data.legal_hold_state,
    requested_operation: request.data.requested_operation,
  });

  if (evaluation.decision === 'denied') {
    return denied(request.data.mode, 'EVALUATOR_DENIED', resolver, evaluation);
  }
  if (evaluation.artifact_fingerprint.artifact_sha256 !== resolver.fingerprint.artifact_sha256
    || evaluation.artifact_fingerprint.artifact_contract_version
      !== resolver.artifact.contract_version
    || evaluation.artifact_fingerprint.artifact_version !== resolver.artifact.artifact_version
    || evaluation.artifact_fingerprint.profile_id !== resolver.fingerprint.profile_id
    || evaluation.artifact_fingerprint.profile_code !== resolver.fingerprint.profile_code
    || evaluation.artifact_fingerprint.profile_version !== resolver.fingerprint.profile_version
    || evaluation.artifact_fingerprint.country_code !== resolver.fingerprint.country_code
    || evaluation.artifact_fingerprint.profile_manifest_sha256
      !== resolver.fingerprint.profile_manifest_sha256
    || evaluation.artifact_fingerprint.domain_code !== resolver.fingerprint.domain_code
    || evaluation.artifact_fingerprint.domain_version !== resolver.fingerprint.domain_version
    || evaluation.artifact_fingerprint.artifact_effective_from
      !== resolver.fingerprint.effective_from
    || evaluation.artifact_fingerprint.artifact_effective_to
      !== resolver.fingerprint.effective_to) {
    return denied(request.data.mode, 'RESOLVER_EVIDENCE_MISMATCH', resolver);
  }

  return documentsCountryRetentionResolutionDecisionV1Schema.parse({
    contract_version: DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_DECISION_V1,
    composition_version: 1,
    mode: request.data.mode,
    decision: 'accepted',
    denial_reason: null,
    resolver_contract_version: resolver.contract_version,
    resolver_version: resolver.resolver_version,
    resolver_denial_reason: null,
    evaluation,
    source_disclosure: 'status_only',
    source_reference: null,
    reusable_as_command_authority: false,
  });
}
