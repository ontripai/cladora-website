import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

const base = { context_id: uuidSchema, workspace_id: uuidSchema, service_order_id: uuidSchema,
  expected_order_version: z.number().int().min(1).max(1_000_000_000), idempotency_key: idempotencyKeySchema };
export const serviceExperienceIntentV1Schema = z.discriminatedUnion('action', [
  z.strictObject({ ...base, action: z.literal('acknowledge_component_status'), component_id: uuidSchema,
    expected_component_version: z.number().int().min(1).max(1_000_000_000), status_reference_id: uuidSchema }),
  z.strictObject({ ...base, action: z.literal('request_cancellation'), reason_code: z.string().trim().min(1).max(64) }),
  z.strictObject({ ...base, action: z.literal('request_compensation'), component_id: uuidSchema,
    expected_component_version: z.number().int().min(1).max(1_000_000_000), reason_code: z.string().trim().min(1).max(64) }),
  z.strictObject({ ...base, action: z.literal('accept_compensation'), compensation_reference_id: uuidSchema,
    expected_compensation_version: z.number().int().min(1).max(1_000_000_000) }),
]);

export type ServiceExperienceIntentV1 = z.infer<typeof serviceExperienceIntentV1Schema>;
export type ServiceExperienceSnapshotV1 = {
  authority: 'allowed' | 'denied';
  order: null | { id: string; workspace_id: string; version: number;
    status: 'ready' | 'in_progress' | 'completed' | 'cancelled' | 'disputed' };
  subject: null | { id: string; version: number; workspace_id: string; order_id: string;
    kind: 'component' | 'compensation'; state: 'available' | 'closed' | 'revoked' };
  coordination_receipt: null | { status: 'verified' | 'denied' | 'stale'; action: ServiceExperienceIntentV1['action'];
    workspace_id: string; order_id: string; order_version: number; subject_id: string | null; subject_version: number | null };
};
export type ServiceExperienceDecisionV1 = 'OK' | 'AUTHORITY_DENIED' | 'ORDER_UNAVAILABLE' | 'STALE_ORDER'
  | 'SUBJECT_UNAVAILABLE' | 'STALE_SUBJECT' | 'COORDINATION_RECEIPT_REQUIRED' | 'COORDINATION_RECEIPT_MISMATCH';

/** Consumes a CE coordination receipt while SERVICE retains canonical Order
 * ownership. This does not implement a second experience, cancellation,
 * compensation, benefit or financial state machine.
 */
export function evaluateServiceExperienceIntent(
  intent: ServiceExperienceIntentV1,
  snapshot: ServiceExperienceSnapshotV1,
): ServiceExperienceDecisionV1 {
  const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
  if (snapshot.authority !== 'allowed') return 'AUTHORITY_DENIED';
  if (!snapshot.order || !same(snapshot.order.id, intent.service_order_id)
    || !same(snapshot.order.workspace_id, intent.workspace_id)) return 'ORDER_UNAVAILABLE';
  if (snapshot.order.version !== intent.expected_order_version) return 'STALE_ORDER';

  const subjectId = 'component_id' in intent ? intent.component_id
    : 'compensation_reference_id' in intent ? intent.compensation_reference_id : null;
  const subjectVersion = 'expected_component_version' in intent ? intent.expected_component_version
    : 'expected_compensation_version' in intent ? intent.expected_compensation_version : null;
  if (subjectId && subjectVersion) {
    const expectedKind = intent.action === 'accept_compensation' ? 'compensation' : 'component';
    if (!snapshot.subject || !same(snapshot.subject.id, subjectId) || !same(snapshot.subject.workspace_id, intent.workspace_id)
      || !same(snapshot.subject.order_id, intent.service_order_id) || snapshot.subject.kind !== expectedKind
      || snapshot.subject.state !== 'available') return 'SUBJECT_UNAVAILABLE';
    if (snapshot.subject.version !== subjectVersion) return 'STALE_SUBJECT';
  }

  const receipt = snapshot.coordination_receipt;
  if (!receipt || receipt.status !== 'verified') return 'COORDINATION_RECEIPT_REQUIRED';
  if (receipt.action !== intent.action || !same(receipt.workspace_id, intent.workspace_id)
    || !same(receipt.order_id, intent.service_order_id) || receipt.order_version !== intent.expected_order_version
    || (subjectId ? !receipt.subject_id || !same(receipt.subject_id, subjectId) : receipt.subject_id !== null)
    || receipt.subject_version !== subjectVersion) return 'COORDINATION_RECEIPT_MISMATCH';
  return 'OK';
}
