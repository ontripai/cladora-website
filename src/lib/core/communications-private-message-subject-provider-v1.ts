import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import type {
  CurrentAuthorityTransactionDecisionReceiptV1,
} from './current-authority-transaction-port-v1.ts';
import type {
  CoreTransactionCommandV2,
  CoreTransactionProvidersV2,
  CoreTransactionScopeV1,
} from './postgres-transaction-host-v1.ts';
import {
  coreTransactionProviderEvidenceV1Schema,
  type CoreTransactionProviderEvidenceV1,
} from './transaction-provider-evidence-v1.ts';

export const communicationsPrivateMessageProviderCodeV1 = 'communications.private_message_subject';

const acceptedRowSchema = z.strictObject({
  decision: z.literal('accepted'),
  denial_reason: z.null(),
  message_id: z.string().uuid().transform(value => value.toLowerCase()),
  message_version: z.string().regex(/^[1-9][0-9]*$/),
  workspace_id: z.string().uuid().transform(value => value.toLowerCase()),
  lifecycle_state: z.enum(['available', 'quarantined', 'deleted']),
  participant_current: z.boolean(),
  participant_revoked: z.boolean(),
  evaluated_at: z.string().datetime({ offset: true }),
});
const deniedRowSchema = z.strictObject({
  decision: z.literal('denied'),
  denial_reason: z.enum(['STALE_SUBJECT', 'SUBJECT_DENIED']),
  message_id: z.null(),
  message_version: z.null(),
  workspace_id: z.null(),
  lifecycle_state: z.null(),
  participant_current: z.null(),
  participant_revoked: z.null(),
  evaluated_at: z.string().datetime({ offset: true }),
});
const rowSchema = z.discriminatedUnion('decision', [acceptedRowSchema, deniedRowSchema]);
type ResolverRow = z.input<typeof rowSchema>;

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
    && authority.authority_version === command.authority_version;
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
    provider_code: communicationsPrivateMessageProviderCodeV1,
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
 * Communications-owned validation callback for CoreTransactionProvidersV2.
 *
 * Core supplies the parsed command, current authority receipt and exact SQL
 * transaction scope. This callback reads only the existing Communications row
 * and returns the merged Core evidence contract. It creates no authority type,
 * store, ledger, transaction or runtime composition of its own.
 */
export async function resolveCommunicationsPrivateMessageSubjectV1(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
): Promise<CoreTransactionProviderEvidenceV1> {
  if (!authorityMatchesCommand(scope, command, authority)) {
    return denied(scope, command, authority, 'SUBJECT_DENIED');
  }
  if (command.subject_reference.kind !== 'message'
      || command.subject_reference.relation !== 'subject_link') {
    return denied(scope, command, authority, 'RELATION_MISMATCH');
  }
  if (command.subject_reference.version !== command.subject_reference.request_version) {
    return denied(scope, command, authority, 'STALE_SUBJECT');
  }

  // Expected source denials are rows, never SQL exceptions. Any real database
  // exception must reach the Core host because PostgreSQL has already marked
  // its transaction failed; 40001 in particular belongs to the host retry loop.
  const result = await scope.query<ResolverRow>(`select
      decision,denial_reason,message_id::text,message_version::text,workspace_id::text,lifecycle_state,
      participant_current,participant_revoked,
      to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as evaluated_at
      from communications.resolve_private_message_currentness_v2($1,$2,$3,$4,$5)`, [
      command.context_id,
      command.workspace_id,
      command.actor_id,
      command.subject_reference.id,
      command.subject_reference.request_version,
    ]);

  if (result.rowCount !== 1 || result.rows.length !== 1) {
    return denied(scope, command, authority, 'SUBJECT_DENIED');
  }
  const rowResult = rowSchema.safeParse(result.rows[0]);
  if (!rowResult.success) return denied(scope, command, authority, 'PROVIDER_UNAVAILABLE');
  const row = rowResult.data;
  if (row.decision === 'denied') {
    return denied(scope, command, authority, row.denial_reason, row.evaluated_at);
  }
  const version = Number(row.message_version);
  if (!Number.isSafeInteger(version)
      || version !== command.subject_reference.version
      || row.message_id !== command.subject_reference.id) {
    return denied(scope, command, authority, 'STALE_SUBJECT', row.evaluated_at);
  }
  if (row.workspace_id !== command.workspace_id) {
    return denied(scope, command, authority, 'RELATION_MISMATCH', row.evaluated_at);
  }
  if (row.participant_revoked || !row.participant_current
      || row.lifecycle_state === 'quarantined' || row.lifecycle_state === 'deleted') {
    return denied(scope, command, authority, 'SUBJECT_DENIED', row.evaluated_at);
  }

  return coreTransactionProviderEvidenceV1Schema.parse({
    ...evidenceBase(scope, command, authority, row.evaluated_at),
    decision: 'accepted',
    denial_reason: null,
    reference_state: 'available',
    current_actor_can_read: true,
  });
}

export const communicationsPrivateMessageSubjectEvidenceProviderV1: Pick<
  CoreTransactionProvidersV2,
  'provider_code' | 'validateProviders'
> = Object.freeze({
  provider_code: communicationsPrivateMessageProviderCodeV1,
  validateProviders: resolveCommunicationsPrivateMessageSubjectV1,
});
