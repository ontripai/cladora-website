import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import type {
  CurrentAuthorityTransactionDecisionReceiptV1,
} from '../core/current-authority-transaction-port-v1.ts';
import type {
  CoreTransactionCommandV2,
  CoreTransactionProvidersV2,
  CoreTransactionScopeV1,
} from '../core/postgres-transaction-host-v1.ts';
import {
  coreSubjectReferencesMatch,
  coreTransactionProviderEvidenceV1Schema,
  type CoreTransactionProviderEvidenceV1,
} from '../core/transaction-provider-evidence-v1.ts';
import {
  serviceRequestSubjectContextToCoreReferenceV1,
  serviceRequestSubjectContextV1Schema,
} from './service-request-subject-context-v1.ts';

export const serviceRequestSubjectProviderCodeV2 = 'service.request_subject';

const acceptedRowSchema = z.strictObject({
  decision: z.literal('accepted'),
  denial_reason: z.null(),
  request_context: serviceRequestSubjectContextV1Schema,
  evaluated_at: z.string().datetime({ offset: true }),
});
const deniedRowSchema = z.strictObject({
  decision: z.literal('denied'),
  denial_reason: z.enum(['STALE_SUBJECT', 'SUBJECT_DENIED']),
  request_context: z.null(),
  evaluated_at: z.string().datetime({ offset: true }),
});
const resolverRowSchema = z.discriminatedUnion('decision', [acceptedRowSchema, deniedRowSchema]);
type ResolverRow = z.input<typeof resolverRowSchema>;

function authorityMatchesCommand(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
) {
  return authority.decision === 'allowed'
    && authority.rechecked_after_lock === true
    && authority.transaction_bound === true
    && authority.transaction_context.transaction_id === scope.transaction_id
    && authority.transaction_context.transaction_id === command.transaction_id
    && authority.transaction_context.command_id === command.command_id
    && authority.transaction_context.attempt === scope.attempt
    && authority.transaction_context.lock.workspace_id === scope.workspace_id
    && authority.transaction_context.lock.aggregate_type === command.aggregate_type
    && authority.transaction_context.lock.aggregate_id === command.aggregate_id
    && authority.context_id === command.context_id
    && authority.workspace_id === scope.workspace_id
    && authority.workspace_id === command.workspace_id
    && authority.actor_id === scope.actor_id
    && authority.actor_id === command.actor_id
    && authority.authority_version === command.authority_version
    && authority.permission_code === command.permission_code
    && authority.module_code === command.module_code
    && authority.evaluation_purpose === command.evaluation_purpose;
}

function evidenceBase(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  evaluatedAt: string,
) {
  return {
    contract_version: 'core-transaction-provider-evidence.v1' as const,
    evidence_id: randomUUID(),
    provider_code: serviceRequestSubjectProviderCodeV2,
    transaction_id: command.transaction_id,
    command_id: command.command_id,
    workspace_id: scope.workspace_id,
    actor_id: scope.actor_id,
    context_id: command.context_id,
    authority_decision_id: authority.decision_id,
    authority_version: authority.authority_version,
    attempt: scope.attempt,
    subject_reference: command.subject_reference,
    evaluated_at: evaluatedAt,
    source_disclosure: 'status_only' as const,
    source_reference: null,
  };
}

function denied(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  reason: 'STALE_SUBJECT' | 'RELATION_MISMATCH' | 'SUBJECT_DENIED' | 'PROVIDER_UNAVAILABLE',
  evaluatedAt = authority.evaluated_at,
): CoreTransactionProviderEvidenceV1 {
  return coreTransactionProviderEvidenceV1Schema.parse({
    ...evidenceBase(scope, command, authority, evaluatedAt),
    decision: 'denied',
    denial_reason: reason,
  });
}

/**
 * Inactive SERVICE validation callback for CoreTransactionProvidersV2.
 *
 * Core owns the serializable transaction, lock order, retry and durable effect
 * commit. This provider only resolves the current canonical own-Request
 * reference through that transaction scope and emits the shared Core evidence.
 */
export async function resolveServiceRequestSubjectProviderV2(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
): Promise<CoreTransactionProviderEvidenceV1> {
  if (scope.workspace_id !== command.workspace_id || scope.actor_id !== command.actor_id
      || command.permission_code !== 'services.orders.read'
      || command.module_code !== 'services_orders'
      || command.evaluation_purpose !== 'service.request.subject_context'
      || command.subject_reference.kind !== 'service_request'
      || command.subject_reference.relation !== 'request_party'
      || !command.provider_source_ids.includes(command.subject_reference.id)) {
    return denied(scope, command, authority, 'RELATION_MISMATCH');
  }
  if (command.subject_reference.version !== command.subject_reference.request_version) {
    return denied(scope, command, authority, 'STALE_SUBJECT');
  }
  if (!authorityMatchesCommand(scope, command, authority)) {
    return denied(scope, command, authority, 'SUBJECT_DENIED');
  }

  // Expected stale/unavailable cases are rows from the private V2 resolver.
  // Do not catch database errors: a real 40001 must reach Core's retry loop and
  // any unexpected SQL failure must abort the transaction rather than become an allow.
  const result = await scope.query<ResolverRow>(`select
      decision,denial_reason,request_context,
      to_char(evaluated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as evaluated_at
    from app_private.resolve_service_request_subject_provider_v2($1,$2,$3,$4,$5)`, [
    command.context_id,
    command.workspace_id,
    command.actor_id,
    command.subject_reference.id,
    command.subject_reference.request_version,
  ]);
  if (result.rowCount !== 1 || result.rows.length !== 1) {
    return denied(scope, command, authority, 'SUBJECT_DENIED');
  }
  const parsed = resolverRowSchema.safeParse(result.rows[0]);
  if (!parsed.success) return denied(scope, command, authority, 'PROVIDER_UNAVAILABLE');
  const row = parsed.data;
  if (row.decision === 'denied') {
    return denied(scope, command, authority, row.denial_reason, row.evaluated_at);
  }

  const canonicalReference = serviceRequestSubjectContextToCoreReferenceV1(row.request_context);
  if (!coreSubjectReferencesMatch(canonicalReference, command.subject_reference)) {
    return denied(scope, command, authority, 'STALE_SUBJECT', row.evaluated_at);
  }
  if (row.request_context.workspace_id !== command.workspace_id) {
    return denied(scope, command, authority, 'RELATION_MISMATCH', row.evaluated_at);
  }

  return coreTransactionProviderEvidenceV1Schema.parse({
    ...evidenceBase(scope, command, authority, row.evaluated_at),
    decision: 'accepted',
    denial_reason: null,
    reference_state: 'available',
    current_actor_can_read: true,
  });
}

export const serviceRequestSubjectEvidenceProviderV2: Pick<
  CoreTransactionProvidersV2,
  'provider_code' | 'validateProviders'
> = Object.freeze({
  provider_code: serviceRequestSubjectProviderCodeV2,
  validateProviders: resolveServiceRequestSubjectProviderV2,
});
