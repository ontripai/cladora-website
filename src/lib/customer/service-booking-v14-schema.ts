import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

const timestampSchema = z.iso.datetime({ offset: true });
const versionSchema = z.number().int().min(1).max(1_000_000_000);
const capacitySchema = z.number().int().min(1).max(1_000_000);
const baseIntent = {
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  service_order_id: uuidSchema,
  expected_order_version: versionSchema,
  service_stage_id: uuidSchema,
  expected_stage_version: versionSchema,
  idempotency_key: idempotencyKeySchema,
};
const requestedWindow = {
  requested_start: timestampSchema,
  requested_end: timestampSchema,
  requested_capacity: capacitySchema,
  resource_ids: z.array(uuidSchema).min(1).max(20),
};

/** Booking intent only. Capacity availability, allocation state, expiry,
 * resource state, authority and financial effects remain server-owned.
 */
export const serviceBookingIntentV1Schema = z.discriminatedUnion('action', [
  z.strictObject({ ...baseIntent, ...requestedWindow, action: z.literal('request_hold') }),
  z.strictObject({ ...baseIntent, allocation_id: uuidSchema, expected_allocation_version: versionSchema,
    action: z.literal('confirm_hold') }),
  z.strictObject({ ...baseIntent, ...requestedWindow, allocation_id: uuidSchema,
    expected_allocation_version: versionSchema, action: z.literal('reschedule') }),
  z.strictObject({ ...baseIntent, allocation_id: uuidSchema, expected_allocation_version: versionSchema,
    action: z.literal('cancel'), reason_code: z.string().trim().min(1).max(64) }),
]).superRefine((value, ctx) => {
  if ('requested_start' in value && Date.parse(value.requested_start) >= Date.parse(value.requested_end)) {
    ctx.addIssue({ code: 'custom', path: ['requested_end'], message: 'Requested end must be after start' });
  }
  if ('resource_ids' in value && new Set(value.resource_ids.map(id => id.toLowerCase())).size !== value.resource_ids.length) {
    ctx.addIssue({ code: 'custom', path: ['resource_ids'], message: 'Resource IDs must be unique' });
  }
});

export type ServiceBookingIntentV1 = z.infer<typeof serviceBookingIntentV1Schema>;
export type ServiceBookingSnapshotV1 = {
  now: number;
  authority: 'allowed' | 'denied';
  order: null | { id: string; workspace_id: string; version: number; status: 'ready' | 'in_progress' | 'completed' | 'cancelled' };
  stage: null | { id: string; order_id: string; version: number; status: 'ready' | 'scheduled' | 'in_progress' | 'completed'; booking_required: boolean };
  allocation: null | { id: string; workspace_id: string; order_id: string; stage_id: string; version: number;
    state: 'held' | 'confirmed' | 'released' | 'expired'; expires_at: string | null };
  capacity_receipt: null | { status: 'verified' | 'denied' | 'stale'; action: ServiceBookingIntentV1['action'];
    workspace_id: string; order_id: string; stage_id: string; allocation_id: string | null;
    allocation_version: number | null; requested_start: string | null; requested_end: string | null;
    requested_capacity: number | null; resource_ids: string[] };
};
export type ServiceBookingDecisionV1 = 'OK' | 'AUTHORITY_DENIED' | 'ORDER_UNAVAILABLE' | 'STALE_ORDER'
  | 'STAGE_UNAVAILABLE' | 'STALE_STAGE' | 'BOOKING_NOT_REQUIRED' | 'ALLOCATION_UNAVAILABLE'
  | 'STALE_ALLOCATION' | 'ACTION_NOT_ALLOWED' | 'CAPACITY_DECISION_REQUIRED' | 'CAPACITY_DECISION_MISMATCH';

/** Pure consumer planning over server-read state and one BK01 receipt. This is
 * not a capacity or authorization engine. The write boundary must recheck all
 * current facts before atomic allocation link, audit, outbox and idempotency writes.
 */
export function evaluateServiceBooking(
  intent: ServiceBookingIntentV1,
  snapshot: ServiceBookingSnapshotV1,
): ServiceBookingDecisionV1 {
  const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
  if (snapshot.authority !== 'allowed') return 'AUTHORITY_DENIED';
  if (!snapshot.order || !same(snapshot.order.id, intent.service_order_id)
    || !same(snapshot.order.workspace_id, intent.workspace_id)
    || !['ready', 'in_progress'].includes(snapshot.order.status)) return 'ORDER_UNAVAILABLE';
  if (snapshot.order.version !== intent.expected_order_version) return 'STALE_ORDER';
  if (!snapshot.stage || !same(snapshot.stage.id, intent.service_stage_id)
    || !same(snapshot.stage.order_id, intent.service_order_id)
    || !['ready', 'scheduled'].includes(snapshot.stage.status)) return 'STAGE_UNAVAILABLE';
  if (snapshot.stage.version !== intent.expected_stage_version) return 'STALE_STAGE';
  if (!snapshot.stage.booking_required) return 'BOOKING_NOT_REQUIRED';

  if (intent.action === 'request_hold') {
    if (snapshot.allocation) return 'ACTION_NOT_ALLOWED';
  } else {
    if (!snapshot.allocation || !same(snapshot.allocation.id, intent.allocation_id)
      || !same(snapshot.allocation.workspace_id, intent.workspace_id)
      || !same(snapshot.allocation.order_id, intent.service_order_id)
      || !same(snapshot.allocation.stage_id, intent.service_stage_id)) return 'ALLOCATION_UNAVAILABLE';
    if (snapshot.allocation.version !== intent.expected_allocation_version) return 'STALE_ALLOCATION';
    if (intent.action === 'confirm_hold') {
      const expiry = snapshot.allocation.expires_at ? Date.parse(snapshot.allocation.expires_at) : Number.NaN;
      if (snapshot.allocation.state !== 'held' || !Number.isFinite(expiry)
        || !Number.isFinite(snapshot.now) || snapshot.now >= expiry) return 'ACTION_NOT_ALLOWED';
    } else if (!['held', 'confirmed'].includes(snapshot.allocation.state)) return 'ACTION_NOT_ALLOWED';
  }

  const receipt = snapshot.capacity_receipt;
  if (!receipt || receipt.status !== 'verified') return 'CAPACITY_DECISION_REQUIRED';
  if (receipt.action !== intent.action || !same(receipt.workspace_id, intent.workspace_id)
    || !same(receipt.order_id, intent.service_order_id) || !same(receipt.stage_id, intent.service_stage_id)) {
    return 'CAPACITY_DECISION_MISMATCH';
  }
  if (intent.action === 'request_hold' || intent.action === 'reschedule') {
    const resources = [...intent.resource_ids].map(id => id.toLowerCase()).sort();
    const receiptResources = [...receipt.resource_ids].map(id => id.toLowerCase()).sort();
    if (receipt.requested_start !== intent.requested_start || receipt.requested_end !== intent.requested_end
      || receipt.requested_capacity !== intent.requested_capacity
      || resources.length !== receiptResources.length
      || resources.some((resource, index) => resource !== receiptResources[index])) return 'CAPACITY_DECISION_MISMATCH';
  }
  if (intent.action !== 'request_hold' && (!receipt.allocation_id || !same(receipt.allocation_id, intent.allocation_id)
    || receipt.allocation_version !== intent.expected_allocation_version)) return 'CAPACITY_DECISION_MISMATCH';
  return 'OK';
}
