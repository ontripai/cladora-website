import { z } from 'zod';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const version = z.number().int().positive().safe();
const identifier = z.string().regex(/^[a-z][a-z0-9_.:-]{0,79}$/);

/** Expected source identity, not an authority projection or resource payload. */
export const coreTransactionSubjectReferenceV1Schema = z.strictObject({
  kind: identifier,
  id: uuid,
  version,
  relation: identifier,
  request_version: version,
});
export type CoreTransactionSubjectReferenceV1 = z.infer<typeof coreTransactionSubjectReferenceV1Schema>;

const binding = z.strictObject({
  contract_version: z.literal('core-transaction-provider-evidence.v1'),
  evidence_id: uuid,
  provider_code: identifier,
  transaction_id: uuid,
  command_id: uuid,
  workspace_id: uuid,
  actor_id: uuid,
  context_id: uuid,
  authority_decision_id: uuid,
  authority_version: version,
  attempt: version.max(100),
  subject_reference: coreTransactionSubjectReferenceV1Schema,
  evaluated_at: z.string().datetime({ offset: true }),
  source_disclosure: z.literal('status_only'),
  source_reference: z.null(),
});
export const coreTransactionAcceptedProviderEvidenceV1Schema = binding.extend({
  decision: z.literal('accepted'),
  denial_reason: z.null(),
  reference_state: z.literal('available'),
  current_actor_can_read: z.literal(true),
});
export const coreTransactionProviderEvidenceV1Schema = z.discriminatedUnion('decision', [
  coreTransactionAcceptedProviderEvidenceV1Schema,
  binding.extend({
    decision: z.literal('denied'),
    denial_reason: z.enum(['SUBJECT_NOT_FOUND', 'STALE_SUBJECT', 'RELATION_MISMATCH',
      'SUBJECT_DENIED', 'PROVIDER_UNAVAILABLE']),
  }),
]);
export type CoreTransactionProviderEvidenceV1 = z.infer<typeof coreTransactionProviderEvidenceV1Schema>;
export type CoreTransactionAcceptedProviderEvidenceV1 = z.infer<typeof coreTransactionAcceptedProviderEvidenceV1Schema>;

export function coreSubjectReferencesMatch(
  left: CoreTransactionSubjectReferenceV1,
  right: CoreTransactionSubjectReferenceV1,
): boolean {
  return left.kind === right.kind && left.id === right.id && left.version === right.version
    && left.relation === right.relation && left.request_version === right.request_version;
}
