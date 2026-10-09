import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

const quantitySchema = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/);
const versionSchema = z.number().int().min(1).max(1_000_000_000);
const baseIntent = {
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  service_order_id: uuidSchema,
  expected_order_version: versionSchema,
  service_stage_id: uuidSchema,
  expected_stage_version: versionSchema,
  quantity: quantitySchema,
  idempotency_key: idempotencyKeySchema,
};

/** Customer/provider intent only. Actor, tenant, parties, cumulative quantities,
 * authority, evidence state, Operations state and financial effects are server-owned.
 */
export const serviceDeliveryIntentV1Schema = z.discriminatedUnion('action', [
  z.strictObject({
    ...baseIntent,
    action: z.literal('record_delivery'),
    evidence_reference_ids: z.array(uuidSchema).min(1).max(20),
  }),
  z.strictObject({ ...baseIntent, action: z.literal('accept_delivery') }),
  z.strictObject({ ...baseIntent, action: z.literal('reject_delivery'), reason_code: z.string().trim().min(1).max(64) }),
  z.strictObject({ ...baseIntent, action: z.literal('request_rework'), reason_code: z.string().trim().min(1).max(64) }),
]);

export type ServiceDeliveryIntentV1 = z.infer<typeof serviceDeliveryIntentV1Schema>;
export type ServiceDeliverySnapshotV1 = {
  authority: 'allowed' | 'denied';
  order: null | {
    id: string;
    workspace_id: string;
    version: number;
    status: 'ready' | 'in_progress' | 'completed' | 'cancelled' | 'disputed';
  };
  stage: null | {
    id: string;
    order_id: string;
    version: number;
    status: 'ready' | 'in_progress' | 'awaiting_acceptance' | 'partially_accepted' | 'rework_required' | 'completed';
    committed_quantity: string;
    delivered_quantity: string;
    accepted_quantity: string;
    rejected_quantity: string;
    current_actor_can_deliver: boolean;
    current_actor_can_accept: boolean;
  };
  evidence: Array<{
    id: string;
    workspace_id: string;
    state: 'available' | 'quarantined' | 'deleted';
    current_actor_can_read: boolean;
  }>;
};

export type ServiceDeliveryDecisionV1 = 'OK' | 'AUTHORITY_DENIED' | 'ORDER_UNAVAILABLE'
  | 'STALE_ORDER' | 'STAGE_UNAVAILABLE' | 'STALE_STAGE' | 'ACTION_NOT_ALLOWED'
  | 'QUANTITY_EXCEEDED' | 'EVIDENCE_REQUIRED' | 'EVIDENCE_UNAVAILABLE';

function decimalParts(value: string): { digits: string; scale: number } | null {
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(value)) return null;
  const [whole, fraction = ''] = value.split('.');
  return { digits: `${whole}${fraction}`.replace(/^0+(?=\d)/, ''), scale: fraction.length };
}

function scaledDigits(value: { digits: string; scale: number }, scale: number): string {
  return `${value.digits}${'0'.repeat(scale - value.scale)}`.replace(/^0+(?=\d)/, '');
}

function compareDecimal(left: string, right: string): number | null {
  const a = decimalParts(left);
  const b = decimalParts(right);
  if (!a || !b) return null;
  const scale = Math.max(a.scale, b.scale);
  const leftValue = scaledDigits(a, scale);
  const rightValue = scaledDigits(b, scale);
  if (leftValue.length !== rightValue.length) return leftValue.length < rightValue.length ? -1 : 1;
  return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
}

function addDigits(left: string, right: string): string {
  let carry = 0;
  let result = '';
  for (let index = Math.max(left.length, right.length) - 1; index >= 0; index -= 1) {
    const leftIndex = index - (Math.max(left.length, right.length) - left.length);
    const rightIndex = index - (Math.max(left.length, right.length) - right.length);
    const sum = Number(left[leftIndex] ?? 0) + Number(right[rightIndex] ?? 0) + carry;
    result = `${sum % 10}${result}`;
    carry = Math.floor(sum / 10);
  }
  return `${carry || ''}${result}`.replace(/^0+(?=\d)/, '');
}

function addDecimal(...values: string[]): string | null {
  const parsed = values.map(decimalParts);
  if (parsed.some(value => !value)) return null;
  const parts = parsed as Array<{ digits: string; scale: number }>;
  const scale = Math.max(...parts.map(value => value.scale));
  const total = parts.reduce((sum, value) => addDigits(sum, scaledDigits(value, scale)), '0');
  if (scale === 0) return total;
  const padded = total.padStart(scale + 1, '0');
  return `${padded.slice(0, -scale)}.${padded.slice(-scale)}`;
}

/** Pure planning over server-read facts. The write boundary must lock and re-read
 * current authority, Order, stage and canonical evidence before atomically writing
 * delivery/decision, audit, outbox and idempotency receipts.
 */
export function evaluateServiceDelivery(
  intent: ServiceDeliveryIntentV1,
  snapshot: ServiceDeliverySnapshotV1,
): ServiceDeliveryDecisionV1 {
  const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
  if (snapshot.authority !== 'allowed') return 'AUTHORITY_DENIED';
  if (!snapshot.order || !same(snapshot.order.id, intent.service_order_id)
    || !same(snapshot.order.workspace_id, intent.workspace_id)
    || !['ready', 'in_progress'].includes(snapshot.order.status)) return 'ORDER_UNAVAILABLE';
  if (snapshot.order.version !== intent.expected_order_version) return 'STALE_ORDER';
  if (!snapshot.stage || !same(snapshot.stage.id, intent.service_stage_id)
    || !same(snapshot.stage.order_id, intent.service_order_id)) return 'STAGE_UNAVAILABLE';
  if (snapshot.stage.version !== intent.expected_stage_version) return 'STALE_STAGE';

  const quantityPositive = compareDecimal(intent.quantity, '0');
  if (quantityPositive !== 1) return 'QUANTITY_EXCEEDED';

  if (intent.action === 'record_delivery') {
    if (!snapshot.stage.current_actor_can_deliver
      || !['in_progress', 'rework_required'].includes(snapshot.stage.status)) return 'ACTION_NOT_ALLOWED';
    const totalDelivered = addDecimal(snapshot.stage.delivered_quantity, intent.quantity);
    if (!totalDelivered || compareDecimal(totalDelivered, snapshot.stage.committed_quantity) === 1) return 'QUANTITY_EXCEEDED';
    if (intent.evidence_reference_ids.length === 0) return 'EVIDENCE_REQUIRED';
    const uniqueIds = new Set(intent.evidence_reference_ids.map(value => value.toLowerCase()));
    if (uniqueIds.size !== intent.evidence_reference_ids.length) return 'EVIDENCE_UNAVAILABLE';
    const evidenceById = new Map(snapshot.evidence.map(value => [value.id.toLowerCase(), value]));
    for (const referenceId of Array.from(uniqueIds)) {
      const evidence = evidenceById.get(referenceId);
      if (!evidence || !same(evidence.workspace_id, intent.workspace_id)
        || evidence.state !== 'available' || !evidence.current_actor_can_read) return 'EVIDENCE_UNAVAILABLE';
    }
    return 'OK';
  }

  if (!snapshot.stage.current_actor_can_accept
    || !['awaiting_acceptance', 'partially_accepted'].includes(snapshot.stage.status)) return 'ACTION_NOT_ALLOWED';
  const decided = addDecimal(snapshot.stage.accepted_quantity, snapshot.stage.rejected_quantity, intent.quantity);
  if (!decided || compareDecimal(decided, snapshot.stage.delivered_quantity) === 1) return 'QUANTITY_EXCEEDED';
  return 'OK';
}
