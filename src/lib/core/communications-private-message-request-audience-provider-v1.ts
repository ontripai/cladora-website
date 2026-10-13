import { z } from 'zod';

import type {
  CurrentAuthorityTransactionDecisionReceiptV1,
} from './current-authority-transaction-port-v1.ts';
import {
  resolveCommunicationsPrivateMessageSubjectV1,
} from './communications-private-message-subject-provider-v1.ts';
import type {
  CoreTransactionCommandV2,
  CoreTransactionProvidersV2,
  CoreTransactionScopeV1,
} from './postgres-transaction-host-v1.ts';
import {
  coreTransactionProviderEvidenceV1Schema,
  type CoreTransactionProviderEvidenceV1,
} from './transaction-provider-evidence-v1.ts';

export const communicationsPrivateMessageRequestAudienceProviderCodeV1 =
  'communications.private_message_request_audience';

const acceptedRowSchema = z.strictObject({
  decision: z.literal('accepted'),
  denial_reason: z.null(),
  current_actor_can_read: z.literal(true),
  request_party_audience_only: z.literal(true),
  evaluated_at: z.string().datetime({ offset: true }),
});
const deniedRowSchema = z.strictObject({
  decision: z.literal('denied'),
  denial_reason: z.enum(['STALE_SUBJECT', 'STALE_REQUEST', 'AUDIENCE_DENIED']),
  current_actor_can_read: z.null(),
  request_party_audience_only: z.null(),
  evaluated_at: z.string().datetime({ offset: true }),
});
const rowSchema = z.discriminatedUnion('decision', [acceptedRowSchema, deniedRowSchema]);
type AudienceRow = z.input<typeof rowSchema>;

function bindProviderCode(
  evidence: CoreTransactionProviderEvidenceV1,
  evaluatedAt = evidence.evaluated_at,
): CoreTransactionProviderEvidenceV1 {
  return coreTransactionProviderEvidenceV1Schema.parse({
    ...evidence,
    provider_code: communicationsPrivateMessageRequestAudienceProviderCodeV1,
    evaluated_at: evaluatedAt,
  });
}

function denyFromEvidence(
  evidence: CoreTransactionProviderEvidenceV1,
  reason: 'STALE_SUBJECT' | 'RELATION_MISMATCH' | 'SUBJECT_DENIED' | 'PROVIDER_UNAVAILABLE',
  evaluatedAt = evidence.evaluated_at,
): CoreTransactionProviderEvidenceV1 {
  const { reference_state: _referenceState, current_actor_can_read: _canRead, ...base } =
    evidence as CoreTransactionProviderEvidenceV1 & {
      reference_state?: 'available'; current_actor_can_read?: true;
    };
  return coreTransactionProviderEvidenceV1Schema.parse({
    ...base,
    provider_code: communicationsPrivateMessageRequestAudienceProviderCodeV1,
    decision: 'denied',
    denial_reason: reason,
    evaluated_at: evaluatedAt,
  });
}

/**
 * CE-owned Request/message audience gate for CoreTransactionProvidersV2.
 *
 * The existing Communications provider proves current permission, module,
 * exact source scope, lifecycle and actor access first. This adapter then asks
 * the private SQL gate to compare the message-time audience with the canonical
 * SERVICE beneficiary/provider parties. It returns status-only Core evidence
 * and creates no runtime wiring, store, authority source, receipt or mutation.
 */
export async function resolveCommunicationsPrivateMessageRequestAudienceV1(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
): Promise<CoreTransactionProviderEvidenceV1> {
  const subjectEvidence = await resolveCommunicationsPrivateMessageSubjectV1(scope, command, authority);
  if (subjectEvidence.decision === 'denied') return bindProviderCode(subjectEvidence);
  if (command.aggregate_type !== 'service_request') {
    return denyFromEvidence(subjectEvidence, 'RELATION_MISMATCH');
  }

  // SQL errors are deliberately not caught. In particular a real PostgreSQL
  // 40001 must reach the Core host's fresh-transaction retry loop.
  const result = await scope.query<AudienceRow>(`select
      decision,denial_reason,current_actor_can_read,request_party_audience_only,
      to_char(evaluated_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as evaluated_at
    from communications.resolve_private_message_request_audience_v1($1,$2,$3,$4,$5,$6,$7)`, [
    command.context_id,
    command.workspace_id,
    command.actor_id,
    command.subject_reference.id,
    command.subject_reference.version,
    command.aggregate_id,
    command.aggregate_version,
  ]);
  if (result.rowCount !== 1 || result.rows.length !== 1) {
    return denyFromEvidence(subjectEvidence, 'PROVIDER_UNAVAILABLE');
  }
  const parsed = rowSchema.safeParse(result.rows[0]);
  if (!parsed.success) {
    return denyFromEvidence(subjectEvidence, 'PROVIDER_UNAVAILABLE');
  }
  const row = parsed.data;
  if (row.decision === 'denied') {
    return denyFromEvidence(subjectEvidence,
      row.denial_reason === 'AUDIENCE_DENIED' ? 'SUBJECT_DENIED' : 'STALE_SUBJECT', row.evaluated_at);
  }
  return bindProviderCode(subjectEvidence, row.evaluated_at);
}

export const communicationsPrivateMessageRequestAudienceEvidenceProviderV1: Pick<
  CoreTransactionProvidersV2,
  'provider_code' | 'validateProviders'
> = Object.freeze({
  provider_code: communicationsPrivateMessageRequestAudienceProviderCodeV1,
  validateProviders: resolveCommunicationsPrivateMessageRequestAudienceV1,
});
