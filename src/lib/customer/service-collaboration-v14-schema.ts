import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

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
export type ServiceCollaborationSnapshotV1 = {
  authority: 'allowed' | 'denied';
  request: null | { id: string; workspace_id: string; version: number; status: string; current_actor_is_party: boolean };
  reference: null | { id: string; workspace_id: string; kind: 'message' | 'document'; current_actor_can_read: boolean;
    request_party_audience_only: boolean; state: 'available' | 'quarantined' | 'deleted' };
};
export type ServiceCollaborationDecisionV1 = 'OK' | 'AUTHORITY_DENIED' | 'REQUEST_UNAVAILABLE'
  | 'STALE_REQUEST' | 'PARTY_ACCESS_REQUIRED' | 'REFERENCE_UNAVAILABLE' | 'REFERENCE_MISMATCH'
  | 'REFERENCE_ACCESS_DENIED';

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
  if (!snapshot.reference || snapshot.reference.state !== 'available') return 'REFERENCE_UNAVAILABLE';
  if (!same(snapshot.reference.id, intent.reference_id) || !same(snapshot.reference.workspace_id, intent.workspace_id)
    || snapshot.reference.kind !== intent.reference_kind) return 'REFERENCE_MISMATCH';
  if (!snapshot.reference.current_actor_can_read || !snapshot.reference.request_party_audience_only) {
    return 'REFERENCE_ACCESS_DENIED';
  }
  return 'OK';
}
