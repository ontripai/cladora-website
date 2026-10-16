import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

import {
  committedJurisdictionDomainArtifactEvidenceReferenceV1Schema,
} from '../core/jurisdiction-domain-artifact-resolver-v1.ts';
import type { CurrentAuthorityTransactionDecisionReceiptV1 } from
  '../core/current-authority-transaction-port-v1.ts';
import { resolveAuthority } from '../core/current-authority-postgres-provider-v1.ts';
import type {
  CoreTransactionCommandV2,
  CoreTransactionProvidersV2,
  CoreTransactionReceiptV2,
  CoreTransactionScopeV1,
} from '../core/postgres-transaction-host-v1.ts';
import {
  coreTransactionReplayCommandHashV1,
  coreTransactionReplayReceiptHashV1,
  type CoreTransactionReplayProviderDecisionV1,
} from '../core/transaction-replay-provider-hook-v1.ts';
import type { CoreTransactionProviderEvidenceV1 } from
  '../core/transaction-provider-evidence-v1.ts';
import {
  DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_REQUEST_V1,
  documentsCountryRetentionResolutionDecisionV1Schema,
  resolveDocumentsCountryRetentionV1,
  type DocumentsCountryRetentionResolutionDecisionV1,
} from './documents-country-retention-resolution-v1.ts';
import {
  docsCe012ImmutableTargetV1Schema,
  type DocsCe012ImmutableTargetV1,
} from './documents-ce012-reference-contract.ts';
import {
  selectDocumentsReferenceInCoreTransactionV1,
  type DocumentsReferenceTxSelectorDecisionV1,
} from './documents-reference-tx-selector-v1.ts';

export const DOCUMENTS_COUNTRY_RETENTION_OPERATION_REQUEST_V1 =
  'documents-country-retention-operation-request.v1' as const;
export const DOCUMENTS_COUNTRY_RETENTION_OPERATION_DECISION_V1 =
  'documents-country-retention-operation-decision.v1' as const;
export const documentsCountryRetentionOperationProviderCodeV1 =
  'documents-country-retention-operation.v1' as const;
export const documentsCountryRetentionOperationReplayPolicyV1 =
  'provider_current_state_required' as const;

const operation = z.enum(['retain', 'dispose', 'read-policy']);
const mode = z.enum(['current', 'historical']);
const requestBase = {
  contract_version: z.literal(DOCUMENTS_COUNTRY_RETENTION_OPERATION_REQUEST_V1),
  target: docsCe012ImmutableTargetV1Schema,
  requested_operation: operation,
} as const;

export const documentsCountryRetentionCurrentOperationRequestV1Schema = z.strictObject({
  ...requestBase,
  mode: z.literal('current'),
});
export const documentsCountryRetentionHistoricalOperationRequestV1Schema = z.strictObject({
  ...requestBase,
  mode: z.literal('historical'),
  committed_evidence: committedJurisdictionDomainArtifactEvidenceReferenceV1Schema,
});
export const documentsCountryRetentionOperationRequestV1Schema = z.discriminatedUnion('mode', [
  documentsCountryRetentionCurrentOperationRequestV1Schema,
  documentsCountryRetentionHistoricalOperationRequestV1Schema,
]);
export type DocumentsCountryRetentionOperationRequestV1 = z.infer<
  typeof documentsCountryRetentionOperationRequestV1Schema
>;

const decisionBase = {
  contract_version: z.literal(DOCUMENTS_COUNTRY_RETENTION_OPERATION_DECISION_V1),
  integration_version: z.literal(1),
  mode: mode.nullable(),
  requested_operation: operation.nullable(),
  evaluated_at: z.string().datetime({ offset: true }),
  document_binding: z.enum(['exact', 'unavailable']),
  retention: documentsCountryRetentionResolutionDecisionV1Schema.nullable(),
  source_disclosure: z.literal('status_only'),
  source_reference: z.null(),
  reusable_as_command_authority: z.literal(false),
} as const;

export const documentsCountryRetentionOperationDecisionV1Schema = z.discriminatedUnion(
  'decision',
  [
    z.strictObject({
      ...decisionBase,
      decision: z.literal('accepted'),
      denial_reason: z.null(),
      document_binding: z.literal('exact'),
      retention: documentsCountryRetentionResolutionDecisionV1Schema.refine(
        value => value.decision === 'accepted',
        'Accepted operation requires an accepted retention decision',
      ),
    }),
    z.strictObject({
      ...decisionBase,
      decision: z.literal('denied'),
      denial_reason: z.enum([
        'MALFORMED_INPUT',
        'COMMAND_PROFILE_MISMATCH',
        'DOCUMENT_REFERENCE_DENIED',
        'STALE_DOCUMENT_VERSION',
        'DOCUMENT_BINDING_MISMATCH',
        'RETENTION_DENIED',
        'PROVIDER_UNAVAILABLE',
      ]),
    }),
  ],
);
export type DocumentsCountryRetentionOperationDecisionV1 = z.infer<
  typeof documentsCountryRetentionOperationDecisionV1Schema
>;

type ParsedRequest = DocumentsCountryRetentionOperationRequestV1;
type DenialReason = Extract<DocumentsCountryRetentionOperationDecisionV1,
  { decision: 'denied' }>['denial_reason'];
type ProviderDenialReason = Extract<CoreTransactionProviderEvidenceV1,
  { decision: 'denied' }>['denial_reason'];
type ReplayDenialReason = Extract<CoreTransactionReplayProviderDecisionV1,
  { decision: 'denied' }>['denial_reason'];

function denied(
  request: ParsedRequest | null,
  reason: DenialReason,
  evaluatedAt: string,
  retention: DocumentsCountryRetentionResolutionDecisionV1 | null = null,
  exactDocument = false,
): DocumentsCountryRetentionOperationDecisionV1 {
  return documentsCountryRetentionOperationDecisionV1Schema.parse({
    contract_version: DOCUMENTS_COUNTRY_RETENTION_OPERATION_DECISION_V1,
    integration_version: 1,
    mode: request?.mode ?? null,
    requested_operation: request?.requested_operation ?? null,
    evaluated_at: evaluatedAt,
    decision: 'denied',
    denial_reason: reason,
    document_binding: exactDocument ? 'exact' : 'unavailable',
    retention,
    source_disclosure: 'status_only',
    source_reference: null,
    reusable_as_command_authority: false,
  });
}

function accepted(
  request: ParsedRequest,
  retention: DocumentsCountryRetentionResolutionDecisionV1,
  evaluatedAt: string,
): DocumentsCountryRetentionOperationDecisionV1 {
  return documentsCountryRetentionOperationDecisionV1Schema.parse({
    contract_version: DOCUMENTS_COUNTRY_RETENTION_OPERATION_DECISION_V1,
    integration_version: 1,
    mode: request.mode,
    requested_operation: request.requested_operation,
    evaluated_at: evaluatedAt,
    decision: 'accepted',
    denial_reason: null,
    document_binding: 'exact',
    retention,
    source_disclosure: 'status_only',
    source_reference: null,
    reusable_as_command_authority: false,
  });
}

/** Domain-separated fingerprint used by trusted command construction. */
export function documentsCountryRetentionOperationInputFingerprintV1(inputValue: unknown) {
  const request = documentsCountryRetentionOperationRequestV1Schema.parse(inputValue);
  return `sha256:${createHash('sha256')
    .update('documents-country-retention-operation-input.v1\0')
    .update(JSON.stringify(request))
    .digest('hex')}`;
}

function exactCommandProfile(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  request: ParsedRequest,
) {
  const entitlement = authority.entitlement;
  return command.contract_version === 'core-transaction-command.v2'
    && command.permission_code === 'documents.vault.read'
    && command.module_code === 'documents'
    && command.evaluation_purpose === 'documents.country-retention.resolve'
    && command.aggregate_type === 'portfolio.property'
    && command.input_fingerprint
      === documentsCountryRetentionOperationInputFingerprintV1(request)
    && command.subject_reference.kind === 'documents.document_version'
    && command.subject_reference.id === request.target.document_version_id
    && command.subject_reference.version === request.target.document_version
    && command.subject_reference.relation === request.requested_operation
    && command.subject_reference.request_version === 1
    && command.provider_source_ids.includes(command.aggregate_id)
    && command.provider_source_ids.includes(request.target.document_id)
    && command.provider_source_ids.includes(request.target.document_version_id)
    && scope.transaction_id === command.transaction_id
    && scope.workspace_id === command.workspace_id
    && scope.actor_id === command.actor_id
    && authority.decision === 'allowed'
    && authority.rechecked_after_lock === true
    && authority.transaction_bound === true
    && authority.reusable_as_command_authority === false
    && authority.context_id === command.context_id
    && authority.workspace_id === command.workspace_id
    && authority.actor_id === command.actor_id
    && authority.authority_version === command.authority_version
    && authority.permission_code === command.permission_code
    && authority.module_code === command.module_code
    && authority.evaluation_purpose === command.evaluation_purpose
    && authority.transaction_context.transaction_id === command.transaction_id
    && authority.transaction_context.command_id === command.command_id
    && authority.transaction_context.attempt === scope.attempt
    && authority.transaction_context.isolation_level === 'serializable'
    && authority.transaction_context.lock.workspace_id === command.workspace_id
    && authority.transaction_context.lock.aggregate_type === command.aggregate_type
    && authority.transaction_context.lock.aggregate_id === command.aggregate_id
    && entitlement?.entitlement_key === 'module.documents'
    && entitlement.workspace_id === command.workspace_id
    && entitlement.module_code === 'documents'
    && entitlement.authority_revision === command.authority_version;
}

function selectorMatches(
  selector: DocumentsReferenceTxSelectorDecisionV1,
  command: CoreTransactionCommandV2,
  target: DocsCe012ImmutableTargetV1,
) {
  return selector.context_id === command.context_id
    && selector.workspace_id === command.workspace_id
    && selector.actor_id === command.actor_id
    && selector.authority_version === command.authority_version
    && selector.target?.document_id === target.document_id
    && selector.target.document_version_id === target.document_version_id
    && selector.target.document_version === target.document_version
    && selector.source_disclosure === 'status_only'
    && selector.source_reference === null;
}

type LockedDocumentState = Readonly<{
  property_id: string;
  document_type_code: string;
  legal_hold_state: 'none' | 'active';
  evaluated_at: string;
}>;

async function selectLockedDocumentState(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  target: DocsCe012ImmutableTargetV1,
): Promise<LockedDocumentState | null> {
  const document = await scope.query<{
    property_id: string | null;
    document_type_code: string;
    legacy_legal_hold: boolean;
    current_version: number;
    immutable_version: number;
  }>(`select d.property_id::text,d.document_type as document_type_code,
      d.legal_hold as legacy_legal_hold,d.current_version,
      v.version as immutable_version
    from documents.documents d
    join documents.document_versions v
      on v.id=$2 and v.document_id=d.id and v.tenant_id=d.tenant_id
    where d.id=$1 and d.workspace_id=$3 and d.tenant_id=$4
    for share of d,v`, [
    target.document_id,
    target.document_version_id,
    command.workspace_id,
    scope.tenant_id,
  ]);
  const row = document.rows[0];
  if (document.rowCount !== 1 || row.property_id === null
    || row.property_id !== command.aggregate_id
    || row.current_version !== target.document_version
    || row.immutable_version !== target.document_version) return null;

  const propertyBinding = await scope.query<{ id: string }>(`select b.id::text
    from platform.workspace_property_bindings b
    join portfolio.properties p on p.id=b.property_id and p.tenant_id=b.tenant_id
    where b.tenant_id=$1 and b.customer_workspace_id=$2 and b.property_id=$3
      and b.status='active' and b.valid_from<=statement_timestamp()
      and (b.valid_to is null or b.valid_to>statement_timestamp())
      and p.status='active'
    order by b.id for share of b,p`, [
    scope.tenant_id,
    command.workspace_id,
    row.property_id,
  ]);
  if (propertyBinding.rowCount !== 1) return null;

  // Legal hold is intentionally read only after the document/version locks.
  // The serializable predicate read also turns a concurrent hold insertion into
  // a retry instead of permitting a stale disposal decision.
  const holds = await scope.query<{ id: string; status: string }>(`select h.id::text,h.status
    from documents.legal_holds h
    where h.tenant_id=$1 and h.document_id=$2
    order by h.id for share`, [scope.tenant_id, target.document_id]);
  if (holds.rows.some(hold => hold.status !== 'active' && hold.status !== 'released')
    || holds.rows.filter(hold => hold.status === 'active').length > 1) return null;
  const instant = await scope.query<{ now: string }>('select clock_timestamp()::text as now');
  if (instant.rowCount !== 1 || !Number.isFinite(Date.parse(instant.rows[0].now))) return null;
  return {
    property_id: row.property_id,
    document_type_code: row.document_type_code,
    legal_hold_state: row.legacy_legal_hold
      || holds.rows.some(hold => hold.status === 'active') ? 'active' : 'none',
    evaluated_at: new Date(instant.rows[0].now).toISOString(),
  };
}

async function evaluateOperationCurrentState(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  request: ParsedRequest,
): Promise<DocumentsCountryRetentionOperationDecisionV1> {
  const selector = await selectDocumentsReferenceInCoreTransactionV1(
    scope, command, authority, request.target,
  );
  if (!selectorMatches(selector, command, request.target)) {
    return denied(request, 'DOCUMENT_BINDING_MISMATCH', selector.evaluated_at);
  }
  if (selector.decision !== 'accepted') {
    return denied(request, selector.denial_reason === 'STALE_REFERENCE'
      ? 'STALE_DOCUMENT_VERSION' : selector.denial_reason === 'PROVIDER_UNAVAILABLE'
        ? 'PROVIDER_UNAVAILABLE' : 'DOCUMENT_REFERENCE_DENIED', selector.evaluated_at);
  }

  const document = await selectLockedDocumentState(scope, command, request.target);
  if (document === null) {
    return denied(request, 'DOCUMENT_BINDING_MISMATCH', selector.evaluated_at);
  }
  if (request.mode === 'historical'
    && (request.committed_evidence.source_workspace_id !== command.workspace_id
      || request.committed_evidence.source_property_id !== document.property_id)) {
    return denied(request, 'DOCUMENT_BINDING_MISMATCH', document.evaluated_at, null, true);
  }

  const resolutionInput = request.mode === 'current' ? {
    contract_version: DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_REQUEST_V1,
    mode: 'current' as const,
    property_id: document.property_id,
    document_type_code: document.document_type_code,
    document_immutable_version: request.target.document_version,
    legal_hold_state: document.legal_hold_state,
    requested_operation: request.requested_operation,
  } : {
    contract_version: DOCUMENTS_COUNTRY_RETENTION_RESOLUTION_REQUEST_V1,
    mode: 'historical' as const,
    committed_evidence: request.committed_evidence,
    document_type_code: document.document_type_code,
    document_immutable_version: request.target.document_version,
    legal_hold_state: document.legal_hold_state,
    requested_operation: request.requested_operation,
  };
  const retention = await resolveDocumentsCountryRetentionV1(
    scope, command, authority, resolutionInput,
  );
  if (retention.decision !== 'accepted') {
    return denied(request, 'RETENTION_DENIED', document.evaluated_at, retention, true);
  }
  return accepted(request, retention, document.evaluated_at);
}

/**
 * Inactive Documents preflight composition. It consumes the accepted
 * transaction-scoped document selector and retention composition, opens no
 * transaction and performs no document, version, hold, metadata or Storage
 * mutation.
 */
export async function resolveDocumentsCountryRetentionOperationV1(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  inputValue: unknown,
): Promise<DocumentsCountryRetentionOperationDecisionV1> {
  const request = documentsCountryRetentionOperationRequestV1Schema.safeParse(inputValue);
  if (!request.success) return denied(null, 'MALFORMED_INPUT', authority.evaluated_at);
  if (!exactCommandProfile(scope, command, authority, request.data)) {
    return denied(request.data, 'COMMAND_PROFILE_MISMATCH', authority.evaluated_at);
  }
  try {
    return await evaluateOperationCurrentState(scope, command, authority, request.data);
  } catch (error) {
    if ((error as { code?: string })?.code === '40001') throw error;
    return denied(request.data, 'PROVIDER_UNAVAILABLE', authority.evaluated_at);
  }
}

function providerEvidence(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  result: DocumentsCountryRetentionOperationDecisionV1,
): CoreTransactionProviderEvidenceV1 {
  const denialReason: ProviderDenialReason | null = result.decision === 'accepted' ? null
    : result.denial_reason === 'STALE_DOCUMENT_VERSION' ? 'STALE_SUBJECT'
      : result.denial_reason === 'PROVIDER_UNAVAILABLE' ? 'PROVIDER_UNAVAILABLE'
        : ['MALFORMED_INPUT', 'COMMAND_PROFILE_MISMATCH', 'DOCUMENT_BINDING_MISMATCH']
            .includes(result.denial_reason) ? 'RELATION_MISMATCH' : 'SUBJECT_DENIED';
  const evaluatedAt = result.evaluated_at;
  return {
    contract_version: 'core-transaction-provider-evidence.v1',
    evidence_id: randomUUID(),
    provider_code: documentsCountryRetentionOperationProviderCodeV1,
    transaction_id: command.transaction_id,
    command_id: command.command_id,
    workspace_id: command.workspace_id,
    actor_id: command.actor_id,
    context_id: command.context_id,
    authority_decision_id: authority.decision_id,
    authority_version: authority.authority_version,
    attempt: scope.attempt,
    subject_reference: command.subject_reference,
    evaluated_at: evaluatedAt,
    source_disclosure: 'status_only',
    source_reference: null,
    decision: result.decision,
    denial_reason: denialReason,
    ...(result.decision === 'accepted'
      ? { reference_state: 'available' as const, current_actor_can_read: true as const }
      : {}),
  } as CoreTransactionProviderEvidenceV1;
}

function replayReceiptMatches(
  command: CoreTransactionCommandV2,
  receipt: CoreTransactionReceiptV2,
) {
  const evidence = receipt.provider_evidence;
  return receipt.contract_version === 'core-transaction-receipt.v2'
    && receipt.receipt_version === 2
    && receipt.replay_validation?.contract_version
      === 'core-transaction-replay-provider-requirement.v1'
    && receipt.replay_validation.provider_code
      === documentsCountryRetentionOperationProviderCodeV1
    && receipt.transaction_id === command.transaction_id
    && receipt.command_id === command.command_id
    && receipt.workspace_id === command.workspace_id
    && receipt.actor_id === command.actor_id
    && receipt.aggregate_type === command.aggregate_type
    && receipt.aggregate_id === command.aggregate_id
    && receipt.aggregate_version === command.aggregate_version
    && receipt.input_fingerprint === command.input_fingerprint
    && receipt.idempotency_key === command.idempotency_key
    && receipt.mutation_id === command.command_id
    && receipt.subject_reference.kind === command.subject_reference.kind
    && receipt.subject_reference.id === command.subject_reference.id
    && receipt.subject_reference.version === command.subject_reference.version
    && receipt.subject_reference.relation === command.subject_reference.relation
    && receipt.subject_reference.request_version === command.subject_reference.request_version
    && evidence.provider_code === documentsCountryRetentionOperationProviderCodeV1
    && evidence.decision === 'accepted'
    && evidence.transaction_id === command.transaction_id
    && evidence.command_id === command.command_id
    && evidence.workspace_id === command.workspace_id
    && evidence.actor_id === command.actor_id
    && evidence.context_id === command.context_id
    && evidence.subject_reference.id === command.subject_reference.id
    && evidence.subject_reference.version === command.subject_reference.version
    && evidence.subject_reference.relation === command.subject_reference.relation
    && evidence.source_disclosure === 'status_only'
    && evidence.source_reference === null
    && evidence.reference_state === 'available'
    && evidence.current_actor_can_read === true
    && receipt.authority.context_id === command.context_id
    && receipt.authority.workspace_id === command.workspace_id
    && receipt.authority.actor_id === command.actor_id
    && receipt.authority.authority_version === command.authority_version
    && receipt.authority.permission_code === command.permission_code
    && receipt.authority.module_code === command.module_code
    && receipt.authority.evaluation_purpose === command.evaluation_purpose;
}

function replayDecision(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  receipt: CoreTransactionReceiptV2,
  evaluatedAt: string,
  denialReason: ReplayDenialReason | null,
): CoreTransactionReplayProviderDecisionV1 {
  const binding = {
    contract_version: 'core-transaction-replay-provider-decision.v1' as const,
    decision_id: randomUUID(),
    provider_code: documentsCountryRetentionOperationProviderCodeV1,
    database_transaction_id: scope.database_transaction_id,
    transaction_id: command.transaction_id,
    command_id: command.command_id,
    workspace_id: command.workspace_id,
    actor_id: command.actor_id,
    context_id: command.context_id,
    authority_decision_id: authority.decision_id,
    authority_version: authority.authority_version,
    attempt: scope.attempt,
    receipt_id: receipt.receipt_id,
    receipt_contract_version: receipt.contract_version,
    command_hash: coreTransactionReplayCommandHashV1(command),
    receipt_hash: coreTransactionReplayReceiptHashV1(receipt),
    evaluated_at: evaluatedAt,
    read_only: true as const,
  };
  return denialReason === null
    ? { ...binding, decision: 'accepted', denial_reason: null }
    : { ...binding, decision: 'denied', denial_reason: denialReason };
}

/** Replay-only current-state evaluation; it never invokes validateProviders or mutate. */
export async function validateDocumentsCountryRetentionOperationReplayV1(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  receipt: CoreTransactionReceiptV2,
  inputValue: unknown,
): Promise<CoreTransactionReplayProviderDecisionV1> {
  const request = documentsCountryRetentionOperationRequestV1Schema.safeParse(inputValue);
  if (!request.success || !exactCommandProfile(scope, command, authority, request.data)) {
    return replayDecision(scope, command, authority, receipt, authority.evaluated_at,
      'REPLAY_DISCLOSURE_DENIED');
  }
  if (!replayReceiptMatches(command, receipt)) {
    return replayDecision(scope, command, authority, receipt, authority.evaluated_at,
      'STALE_PROVIDER_EVIDENCE');
  }
  try {
    const result = await evaluateOperationCurrentState(scope, command, authority, request.data);
    const evaluatedAt = result.evaluated_at;
    if (result.decision === 'accepted') {
      return replayDecision(scope, command, authority, receipt, evaluatedAt, null);
    }
    return replayDecision(scope, command, authority, receipt, evaluatedAt,
      result.denial_reason === 'PROVIDER_UNAVAILABLE'
        ? 'PROVIDER_UNAVAILABLE' : result.denial_reason === 'STALE_DOCUMENT_VERSION'
          ? 'REPLAY_STATE_CHANGED' : 'REPLAY_DISCLOSURE_DENIED');
  } catch (error) {
    if ((error as { code?: string })?.code === '40001') throw error;
    return replayDecision(scope, command, authority, receipt, authority.evaluated_at,
      'PROVIDER_UNAVAILABLE');
  }
}

/**
 * Inactive Core v2 provider composition. Fresh acceptance commits only the
 * existing Core receipt/audit/outbox effect. `mutate` performs no Documents or
 * Storage write; disposal remains a preflight decision.
 */
export function createDocumentsCountryRetentionOperationProvidersV1(
  inputValue: unknown,
): CoreTransactionProvidersV2 {
  let acceptedReadPhase: string | null = null;
  return {
    provider_code: documentsCountryRetentionOperationProviderCodeV1,
    replay_policy: documentsCountryRetentionOperationReplayPolicyV1,
    resolveAuthority,
    async validateProviders(scope, command, authority) {
      const result = await resolveDocumentsCountryRetentionOperationV1(
        scope, command, authority, inputValue,
      );
      acceptedReadPhase = result.decision === 'accepted'
        ? `${scope.database_transaction_id}:${command.command_id}:${scope.attempt}` : null;
      return providerEvidence(scope, command, authority, result);
    },
    async validateReplay(scope, command, authority, receipt) {
      return validateDocumentsCountryRetentionOperationReplayV1(
        scope, command, authority, receipt, inputValue,
      );
    },
    async mutate(scope, command) {
      if (acceptedReadPhase
        !== `${scope.database_transaction_id}:${command.command_id}:${scope.attempt}`) {
        throw new Error('documents_retention_preflight_not_validated');
      }
      acceptedReadPhase = null;
      return { mutation_id: command.command_id };
    },
  };
}
