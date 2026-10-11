import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';
import { fingerprintServiceProviderInput, receiptEnvelopeMatches,
  serviceProviderReceiptEnvelopeShape } from './service-provider-receipt-v1-schema';

export { fingerprintServiceProviderInput } from './service-provider-receipt-v1-schema';
export const SERVICE_SUBJECT_LINK_ADAPTER_RECEIPT_CONTRACT = 'service-subject-link-adapter.v1' as const;

const versionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);

/** SERVICE intent for attaching an authorized Communications/Vault reference.
 * Actor, tenant, audience, delivery, and storage claims remain server-owned.
 */
export const serviceCollaborationIntentV1Schema = z.strictObject({
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  service_request_id: uuidSchema,
  expected_request_version: z.number().int().positive(),
  reference_kind: z.enum(['message', 'document']),
  reference_id: uuidSchema,
  source_version: versionSchema,
  relation: z.enum(['conversation', 'attachment', 'evidence']),
  idempotency_key: idempotencyKeySchema,
}).superRefine((value, ctx) => {
  if (value.reference_kind === 'message' && value.relation !== 'conversation') {
    ctx.addIssue({ code: 'custom', path: ['relation'], message: 'Message references require the conversation relation' });
  }
  if (value.reference_kind === 'document' && value.relation === 'conversation') {
    ctx.addIssue({ code: 'custom', path: ['relation'], message: 'Document references require attachment or evidence relation' });
  }
});

export type ServiceCollaborationIntentV1 = z.infer<typeof serviceCollaborationIntentV1Schema>;

export const serviceSubjectLinkAdapterReceiptV1Schema = z.strictObject({
  ...serviceProviderReceiptEnvelopeShape,
  contract: z.literal(SERVICE_SUBJECT_LINK_ADAPTER_RECEIPT_CONTRACT),
  result_code: z.enum(['OK', 'REFERENCE_UNAVAILABLE', 'STALE_REFERENCE', 'REFERENCE_ACCESS_DENIED', 'REFERENCE_QUARANTINED']),
  request_id: uuidSchema,
  request_version: versionSchema,
  reference_kind: z.enum(['message', 'document']),
  reference_id: uuidSchema,
  reference_version: versionSchema,
  relation: z.enum(['conversation', 'attachment', 'evidence']),
  reference_state: z.enum(['available', 'quarantined', 'deleted']),
  current_actor_can_read: z.boolean(),
  request_party_audience_only: z.boolean(),
});

export type ServiceCollaborationSnapshotV1 = {
  authority: 'allowed' | 'denied';
  request: null | { id: string; workspace_id: string; version: number; status: string; current_actor_is_party: boolean };
  subjectLinkReceipt: z.infer<typeof serviceSubjectLinkAdapterReceiptV1Schema> | null;
};
export type ServiceCollaborationDecisionV1 = 'OK' | 'AUTHORITY_DENIED' | 'REQUEST_UNAVAILABLE'
  | 'STALE_REQUEST' | 'PARTY_ACCESS_REQUIRED' | 'REFERENCE_UNAVAILABLE' | 'REFERENCE_MISMATCH'
  | 'STALE_REFERENCE' | 'REFERENCE_ACCESS_DENIED';

/** Pure planning over server-read state. This is not an authorization boundary:
 * the transaction must lock/re-read records and current authority before writing
 * the link, audit row, and outbox receipt atomically.
 */
export function evaluateServiceCollaborationLink(
  intent: ServiceCollaborationIntentV1,
  snapshot: ServiceCollaborationSnapshotV1,
): ServiceCollaborationDecisionV1 {
  const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
  if (snapshot.authority !== 'allowed') return 'AUTHORITY_DENIED';
  if (!snapshot.request || !same(snapshot.request.id, intent.service_request_id)
    || !same(snapshot.request.workspace_id, intent.workspace_id)
    || !['submitted', 'quoted', 'in_progress'].includes(snapshot.request.status)) return 'REQUEST_UNAVAILABLE';
  if (snapshot.request.version !== intent.expected_request_version) return 'STALE_REQUEST';
  if (!snapshot.request.current_actor_is_party) return 'PARTY_ACCESS_REQUIRED';
  const parsedReceipt = serviceSubjectLinkAdapterReceiptV1Schema.safeParse(snapshot.subjectLinkReceipt);
  if (!parsedReceipt.success) return 'REFERENCE_UNAVAILABLE';
  const receipt = parsedReceipt.data;
  if (!receiptEnvelopeMatches(receipt, {
    contract: SERVICE_SUBJECT_LINK_ADAPTER_RECEIPT_CONTRACT,
    workspaceId: intent.workspace_id,
    sourceKind: intent.reference_kind,
    sourceId: intent.reference_id,
    sourceVersion: intent.source_version,
    idempotencyKey: intent.idempotency_key,
    inputFingerprint: fingerprintServiceProviderInput(intent),
  })) return receipt.source_identity.version === intent.source_version ? 'REFERENCE_MISMATCH' : 'STALE_REFERENCE';
  if (!same(receipt.request_id, intent.service_request_id)
    || receipt.request_version !== intent.expected_request_version
    || !same(receipt.reference_id, intent.reference_id)
    || receipt.reference_kind !== intent.reference_kind || receipt.relation !== intent.relation) return 'REFERENCE_MISMATCH';
  if (receipt.reference_version !== intent.source_version) return 'STALE_REFERENCE';
  if (receipt.reference_state !== 'available') return 'REFERENCE_UNAVAILABLE';
  if (!receipt.current_actor_can_read || !receipt.request_party_audience_only) {
    return 'REFERENCE_ACCESS_DENIED';
  }
  return 'OK';
}
