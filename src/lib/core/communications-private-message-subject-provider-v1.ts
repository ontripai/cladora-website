import { z } from 'zod';

import { uuidSchema } from '../customer/workspace-composition-schema.ts';
import {
  currentAuthorityTransactionDecisionReceiptV1Schema,
} from './current-authority-transaction-port-v1.ts';
import type { CoreTransactionScopeV1 } from './postgres-transaction-host-v1.ts';

const safeVersionSchema = z.number().int().positive().safe();

export const communicationsPrivateMessageSubjectRequestV1Schema = z.strictObject({
  contract_version: z.literal('communications-private-message-subject-provider.v1'),
  message_id: uuidSchema,
  expected_version: safeVersionSchema,
  authority: currentAuthorityTransactionDecisionReceiptV1Schema,
});

export type CommunicationsPrivateMessageSubjectRequestV1 = z.infer<
  typeof communicationsPrivateMessageSubjectRequestV1Schema
>;

const verifiedDecisionSchema = z.strictObject({
  contract_version: z.literal('communications-private-message-subject-provider.v1'),
  decision: z.literal('verified'),
  code: z.literal('OK'),
  reference: z.strictObject({
    kind: z.literal('message'),
    id: uuidSchema,
    version: safeVersionSchema,
  }),
  workspace_id: uuidSchema,
  lifecycle_state: z.literal('available'),
  participant_current: z.literal(true),
  participant_revoked: z.literal(false),
  authority_reference: z.strictObject({
    decision_id: uuidSchema,
    authority_version: safeVersionSchema,
    evaluated_at: z.string().datetime({ offset: true }),
  }),
});

const boundedDecisionSchema = z.strictObject({
  contract_version: z.literal('communications-private-message-subject-provider.v1'),
  decision: z.enum(['denied', 'conflict', 'unknown']),
  code: z.enum([
    'INVALID_REQUEST',
    'AUTHORITY_DENIED',
    'AUTHORITY_BINDING_MISMATCH',
    'REFERENCE_UNAVAILABLE',
    'STALE_REFERENCE',
    'PARTICIPANT_NOT_CURRENT',
    'PARTICIPANT_REVOKED',
    'REFERENCE_QUARANTINED',
    'REFERENCE_DELETED',
    'PROVIDER_UNKNOWN',
  ]),
  reference: z.null(),
});

export const communicationsPrivateMessageSubjectDecisionV1Schema = z.union([
  verifiedDecisionSchema,
  boundedDecisionSchema,
]);

export type CommunicationsPrivateMessageSubjectDecisionV1 = z.infer<
  typeof communicationsPrivateMessageSubjectDecisionV1Schema
>;

type ResolverRow = {
  message_id: string;
  message_version: string;
  workspace_id: string;
  lifecycle_state: string;
  participant_current: boolean;
  participant_revoked: boolean;
};

const rowSchema = z.strictObject({
  message_id: uuidSchema,
  message_version: z.string().regex(/^[1-9][0-9]*$/),
  workspace_id: uuidSchema,
  lifecycle_state: z.enum(['available', 'quarantined', 'deleted']),
  participant_current: z.boolean(),
  participant_revoked: z.boolean(),
});

function bounded(
  decision: 'denied' | 'conflict' | 'unknown',
  code: z.infer<typeof boundedDecisionSchema>['code'],
): CommunicationsPrivateMessageSubjectDecisionV1 {
  return { contract_version: 'communications-private-message-subject-provider.v1', decision, code, reference: null };
}

function authorityMatchesScope(
  scope: CoreTransactionScopeV1,
  authority: z.infer<typeof currentAuthorityTransactionDecisionReceiptV1Schema>,
) {
  return authority.decision === 'allowed'
    && authority.rechecked_after_lock === true
    && authority.transaction_bound === true
    && authority.transaction_context.transaction_id === scope.transaction_id
    && authority.transaction_context.attempt === scope.attempt
    && authority.workspace_id === scope.workspace_id
    && authority.transaction_context.lock.workspace_id === scope.workspace_id
    && authority.actor_id === scope.actor_id;
}

/**
 * Communications-owned read provider for a Core transaction scope.
 *
 * It consumes the Core authority receipt and the existing Communications store.
 * Its only SQL statement is the metadata-only resolver SELECT; it never writes,
 * mints authority, or persists replay/audit/outbox state.
 */
export async function resolveCommunicationsPrivateMessageSubjectV1(
  scope: CoreTransactionScopeV1,
  requestInput: unknown,
): Promise<CommunicationsPrivateMessageSubjectDecisionV1> {
  const parsed = communicationsPrivateMessageSubjectRequestV1Schema.safeParse(requestInput);
  if (!parsed.success) return bounded('denied', 'INVALID_REQUEST');
  const request = parsed.data;
  if (request.authority.decision !== 'allowed') return bounded('denied', 'AUTHORITY_DENIED');
  if (!authorityMatchesScope(scope, request.authority)) {
    return bounded('denied', 'AUTHORITY_BINDING_MISMATCH');
  }

  let result: { rows: ResolverRow[]; rowCount: number | null };
  try {
    result = await scope.query<ResolverRow>(`select
      message_id::text,message_version::text,workspace_id::text,lifecycle_state,
      participant_current,participant_revoked
      from communications.resolve_private_message_subject_v1($1,$2,$3,$4,$5)`, [
      request.authority.context_id,
      request.authority.workspace_id,
      request.authority.actor_id,
      request.message_id,
      request.expected_version,
    ]);
  } catch (error) {
    const sqlState = (error as { code?: string })?.code;
    if (sqlState === '40001') return bounded('conflict', 'STALE_REFERENCE');
    if (sqlState === '42501' || sqlState === 'P0002') {
      return bounded('denied', 'REFERENCE_UNAVAILABLE');
    }
    return bounded('unknown', 'PROVIDER_UNKNOWN');
  }

  if (result.rowCount !== 1 || result.rows.length !== 1) {
    return bounded('denied', 'REFERENCE_UNAVAILABLE');
  }
  const rowResult = rowSchema.safeParse(result.rows[0]);
  if (!rowResult.success) return bounded('unknown', 'PROVIDER_UNKNOWN');
  const row = rowResult.data;
  const version = Number(row.message_version);
  if (!Number.isSafeInteger(version) || version !== request.expected_version
      || row.message_id !== request.message_id
      || row.workspace_id !== request.authority.workspace_id) {
    return bounded('conflict', 'STALE_REFERENCE');
  }
  if (row.participant_revoked) return bounded('denied', 'PARTICIPANT_REVOKED');
  if (!row.participant_current) return bounded('denied', 'PARTICIPANT_NOT_CURRENT');
  if (row.lifecycle_state === 'quarantined') return bounded('denied', 'REFERENCE_QUARANTINED');
  if (row.lifecycle_state === 'deleted') return bounded('denied', 'REFERENCE_DELETED');

  return communicationsPrivateMessageSubjectDecisionV1Schema.parse({
    contract_version: 'communications-private-message-subject-provider.v1',
    decision: 'verified',
    code: 'OK',
    reference: { kind: 'message', id: row.message_id, version },
    workspace_id: row.workspace_id,
    lifecycle_state: 'available',
    participant_current: true,
    participant_revoked: false,
    authority_reference: {
      decision_id: request.authority.decision_id,
      authority_version: request.authority.authority_version,
      evaluated_at: request.authority.evaluated_at,
    },
  });
}
