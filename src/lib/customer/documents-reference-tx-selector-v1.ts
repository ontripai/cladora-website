import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import {
  bindCanonicalCurrentAuthorityObservationV1,
  currentAuthorityTransactionRequestV1Schema,
  type CurrentAuthorityTransactionDecisionReceiptV1,
} from '../core/current-authority-transaction-port-v1';
import {
  CoreAuthorityProviderUnavailableV1,
  resolveAuthority,
} from '../core/current-authority-postgres-provider-v1';
import type {
  CoreTransactionCommandV1,
  CoreTransactionCommandV2,
  CoreTransactionScopeV1,
} from '../core/postgres-transaction-host-v1';
import { docsCe012ImmutableTargetV1Schema } from './documents-ce012-reference-contract';
import { selectDocumentsReferenceCurrentStateV1 } from './documents-reference-authority-v1';

export const DOCUMENTS_REFERENCE_TX_SELECTOR_CONTRACT_V1 =
  'documents-reference-tx-selector-decision.v1' as const;

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const version = z.number().int().positive().safe();
const decisionBinding = {
  contract_version: z.literal(DOCUMENTS_REFERENCE_TX_SELECTOR_CONTRACT_V1),
  decision_id: uuid,
  context_id: uuid,
  workspace_id: uuid,
  actor_id: uuid,
  authority_version: version,
  target: docsCe012ImmutableTargetV1Schema.nullable(),
  evaluated_at: z.string().datetime({ offset: true }),
  source_disclosure: z.literal('status_only'),
  source_reference: z.null(),
};

export const documentsReferenceTxSelectorDecisionV1Schema = z.discriminatedUnion('decision', [
  z.strictObject({
    ...decisionBinding,
    decision: z.literal('accepted'),
    target: docsCe012ImmutableTargetV1Schema,
    denial_reason: z.null(),
    reference_state: z.literal('available'),
    current_actor_can_read: z.literal(true),
  }),
  z.strictObject({
    ...decisionBinding,
    decision: z.literal('denied'),
    denial_reason: z.enum([
      'BINDING_MISMATCH',
      'AUTHORITY_DENIED',
      'STALE_REFERENCE',
      'REFERENCE_DENIED',
      'PROVIDER_UNAVAILABLE',
    ]),
  }),
]);
export type DocumentsReferenceTxSelectorDecisionV1 = z.infer<
  typeof documentsReferenceTxSelectorDecisionV1Schema
>;

type TransactionCommand = CoreTransactionCommandV1 | CoreTransactionCommandV2;
type DenialReason = Extract<DocumentsReferenceTxSelectorDecisionV1,
  { decision: 'denied' }>['denial_reason'];

function decisionBase(
  command: TransactionCommand,
  target: z.infer<typeof docsCe012ImmutableTargetV1Schema> | null,
  evaluatedAt: string,
) {
  return {
    contract_version: DOCUMENTS_REFERENCE_TX_SELECTOR_CONTRACT_V1,
    decision_id: randomUUID(),
    context_id: command.context_id,
    workspace_id: command.workspace_id,
    actor_id: command.actor_id,
    authority_version: command.authority_version,
    target,
    evaluated_at: evaluatedAt,
    source_disclosure: 'status_only' as const,
    source_reference: null,
  };
}

function denied(
  command: TransactionCommand,
  target: z.infer<typeof docsCe012ImmutableTargetV1Schema> | null,
  evaluatedAt: string,
  reason: DenialReason,
): DocumentsReferenceTxSelectorDecisionV1 {
  return documentsReferenceTxSelectorDecisionV1Schema.parse({
    ...decisionBase(command, target, evaluatedAt),
    decision: 'denied',
    denial_reason: reason,
  });
}

function transactionAuthorityMatches(
  scope: CoreTransactionScopeV1,
  command: TransactionCommand,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
) {
  return authority.decision === 'allowed'
    && authority.rechecked_after_lock === true
    && authority.transaction_bound === true
    && scope.transaction_id === command.transaction_id
    && scope.workspace_id === command.workspace_id
    && scope.actor_id === command.actor_id
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
    && authority.entitlement?.workspace_id === command.workspace_id
    && authority.entitlement.module_code === command.module_code
    && authority.entitlement.authority_revision === command.authority_version
    && Date.parse(authority.evaluated_at)
      >= Date.parse(authority.transaction_context.lock.acquired_at);
}

function documentsAuthorityMatches(
  scope: CoreTransactionScopeV1,
  command: TransactionCommand,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
) {
  return authority.decision === 'allowed'
    && authority.rechecked_after_lock === true
    && authority.transaction_bound === true
    && authority.context_id === command.context_id
    && authority.workspace_id === scope.workspace_id
    && authority.actor_id === scope.actor_id
    && authority.authority_version === command.authority_version
    && authority.permission_code === 'documents.vault.read'
    && authority.module_code === 'documents'
    && authority.evaluation_purpose === 'documents.reference.read'
    && authority.transaction_context.transaction_id === scope.transaction_id
    && authority.transaction_context.command_id === command.command_id
    && authority.transaction_context.attempt === scope.attempt
    && authority.entitlement?.workspace_id === scope.workspace_id
    && authority.entitlement.module_code === 'documents'
    && authority.entitlement.authority_revision === command.authority_version;
}

/**
 * Inactive Documents-owned selector for a reference inside an existing Core
 * transaction. The caller supplies the host-parsed command and post-lock Core
 * authority receipt. Documents rechecks its own canonical read authority and
 * canonical Vault rows in that same read phase; it opens no transaction and
 * returns no document payload, permission rows or storage metadata.
 */
export async function selectDocumentsReferenceInCoreTransactionV1(
  scope: CoreTransactionScopeV1,
  command: TransactionCommand,
  transactionAuthority: CurrentAuthorityTransactionDecisionReceiptV1,
  targetValue: unknown,
): Promise<DocumentsReferenceTxSelectorDecisionV1> {
  const target = docsCe012ImmutableTargetV1Schema.safeParse(targetValue);
  const safeTarget = target.success ? target.data : null;
  if (!target.success || !transactionAuthorityMatches(scope, command, transactionAuthority)
    || !command.provider_source_ids.includes(target.data.document_id)
    || !command.provider_source_ids.includes(target.data.document_version_id)) {
    return denied(command, safeTarget, transactionAuthority.evaluated_at, 'BINDING_MISMATCH');
  }

  try {
    const request = currentAuthorityTransactionRequestV1Schema.parse({
      contract_version: 'core-current-authority-transaction-port-request.v1',
      decision_id: randomUUID(),
      context_id: command.context_id,
      workspace_id: command.workspace_id,
      actor_id: command.actor_id,
      authority_version: command.authority_version,
      permission_code: 'documents.vault.read',
      module_code: 'documents',
      evaluation_purpose: 'documents.reference.read',
      transaction_context: transactionAuthority.transaction_context,
    });
    const observation = await resolveAuthority(scope, request);
    const documentsAuthority = bindCanonicalCurrentAuthorityObservationV1(request, observation);
    if (!documentsAuthorityMatches(scope, command, documentsAuthority)) {
      return denied(command, target.data, documentsAuthority.evaluated_at, 'AUTHORITY_DENIED');
    }

    const state = await selectDocumentsReferenceCurrentStateV1(scope, {
      context_id: command.context_id,
      workspace_id: command.workspace_id,
      actor_id: command.actor_id,
      authority_version: documentsAuthority.authority_version,
      document_id: target.data.document_id,
      document_version_id: target.data.document_version_id,
      document_version: target.data.document_version,
      authority_evaluated_at: documentsAuthority.evaluated_at,
    });
    if (state.decision !== 'accepted') {
      return denied(command, target.data, state.evaluated_at,
        state.denial_reason === 'STALE_REFERENCE' ? 'STALE_REFERENCE' : 'REFERENCE_DENIED');
    }
    return documentsReferenceTxSelectorDecisionV1Schema.parse({
      ...decisionBase(command, target.data, state.evaluated_at),
      decision: 'accepted',
      denial_reason: null,
      reference_state: 'available',
      current_actor_can_read: true,
    });
  } catch (error) {
    if ((error as { code?: string })?.code === '40001') throw error;
    if (error instanceof CoreAuthorityProviderUnavailableV1 && error.code === 'ACTOR_REVOKED') {
      return denied(command, target.data, transactionAuthority.evaluated_at, 'AUTHORITY_DENIED');
    }
    return denied(command, target.data, transactionAuthority.evaluated_at, 'PROVIDER_UNAVAILABLE');
  }
}
