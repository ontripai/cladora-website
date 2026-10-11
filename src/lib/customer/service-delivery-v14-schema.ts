import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';
import { fingerprintServiceProviderInput, receiptEnvelopeMatches,
  serviceProviderReceiptEnvelopeShape } from './service-provider-receipt-v1-schema';

export { fingerprintServiceProviderInput } from './service-provider-receipt-v1-schema';
export const SERVICE_DELIVERY_EVIDENCE_RECEIPT_CONTRACT = 'service-delivery-evidence-receipt.v1' as const;

const quantitySchema = z.string().regex(/^(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/);
const versionSchema = z.number().int().min(1).max(1_000_000_000);
const sourceVersionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const serviceDeliveryEvidenceReferenceV1Schema = z.strictObject({
  reference_id: uuidSchema,
  source_version: sourceVersionSchema,
});
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
    evidence_references: z.array(serviceDeliveryEvidenceReferenceV1Schema).min(1).max(20),
  }),
  z.strictObject({ ...baseIntent, action: z.literal('accept_delivery') }),
  z.strictObject({ ...baseIntent, action: z.literal('reject_delivery'), reason_code: z.string().trim().min(1).max(64) }),
  z.strictObject({ ...baseIntent, action: z.literal('request_rework'), reason_code: z.string().trim().min(1).max(64) }),
]);

export type ServiceDeliveryIntentV1 = z.infer<typeof serviceDeliveryIntentV1Schema>;

export const serviceDeliveryEvidenceReceiptV1Schema = z.strictObject({
  ...serviceProviderReceiptEnvelopeShape,
  contract: z.literal(SERVICE_DELIVERY_EVIDENCE_RECEIPT_CONTRACT),
  result_code: z.enum(['OK', 'EVIDENCE_UNAVAILABLE', 'STALE_EVIDENCE', 'EVIDENCE_ACCESS_DENIED', 'EVIDENCE_QUARANTINED']),
  order_id: uuidSchema,
  order_version: versionSchema,
  stage_id: uuidSchema,
  stage_version: versionSchema,
  evidence_references: z.array(z.strictObject({
    reference_id: uuidSchema,
    source_version: sourceVersionSchema,
    workspace_id: uuidSchema,
    state: z.enum(['available', 'quarantined', 'deleted']),
    current_actor_can_read: z.boolean(),
  })).min(1).max(20),
});

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
  evidenceReceipt: z.infer<typeof serviceDeliveryEvidenceReceiptV1Schema> | null;
};

export type ServiceDeliveryDecisionV1 = 'OK' | 'AUTHORITY_DENIED' | 'ORDER_UNAVAILABLE'
  | 'STALE_ORDER' | 'STAGE_UNAVAILABLE' | 'STALE_STAGE' | 'ACTION_NOT_ALLOWED'
  | 'QUANTITY_EXCEEDED' | 'EVIDENCE_REQUIRED' | 'EVIDENCE_UNAVAILABLE'
  | 'STALE_EVIDENCE_REFERENCE' | 'EVIDENCE_RECEIPT_MISMATCH';

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
    const withinCommitment = totalDelivered ? compareDecimal(totalDelivered, snapshot.stage.committed_quantity) : null;
    if (withinCommitment === null || withinCommitment === 1) return 'QUANTITY_EXCEEDED';
    if (intent.evidence_references.length === 0) return 'EVIDENCE_REQUIRED';
    const uniqueIds = new Set(intent.evidence_references.map(value => value.reference_id.toLowerCase()));
    if (uniqueIds.size !== intent.evidence_references.length) return 'EVIDENCE_UNAVAILABLE';
    const parsedReceipt = serviceDeliveryEvidenceReceiptV1Schema.safeParse(snapshot.evidenceReceipt);
    if (!parsedReceipt.success) return 'EVIDENCE_UNAVAILABLE';
    const receipt = parsedReceipt.data;
    if (!receiptEnvelopeMatches(receipt, {
      contract: SERVICE_DELIVERY_EVIDENCE_RECEIPT_CONTRACT,
      workspaceId: intent.workspace_id,
      sourceKind: 'service_stage',
      sourceId: intent.service_stage_id,
      sourceVersion: intent.expected_stage_version,
      idempotencyKey: intent.idempotency_key,
      inputFingerprint: fingerprintServiceProviderInput(intent),
    }) || !same(receipt.order_id, intent.service_order_id)
      || receipt.order_version !== intent.expected_order_version
      || !same(receipt.stage_id, intent.service_stage_id)
      || receipt.stage_version !== intent.expected_stage_version) return 'EVIDENCE_RECEIPT_MISMATCH';
    const evidenceById = new Map(receipt.evidence_references.map(value => [value.reference_id.toLowerCase(), value]));
    if (evidenceById.size !== intent.evidence_references.length
      || evidenceById.size !== receipt.evidence_references.length) return 'EVIDENCE_RECEIPT_MISMATCH';
    for (const reference of intent.evidence_references) {
      const evidence = evidenceById.get(reference.reference_id.toLowerCase());
      if (!evidence || !same(evidence.workspace_id, intent.workspace_id)
        || evidence.state !== 'available' || !evidence.current_actor_can_read) return 'EVIDENCE_UNAVAILABLE';
      if (evidence.source_version !== reference.source_version) return 'STALE_EVIDENCE_REFERENCE';
    }
    return 'OK';
  }

  if (!snapshot.stage.current_actor_can_accept
    || !['awaiting_acceptance', 'partially_accepted'].includes(snapshot.stage.status)) return 'ACTION_NOT_ALLOWED';
  const decided = addDecimal(snapshot.stage.accepted_quantity, snapshot.stage.rejected_quantity, intent.quantity);
  const withinDelivery = decided ? compareDecimal(decided, snapshot.stage.delivered_quantity) : null;
  if (withinDelivery === null || withinDelivery === 1) return 'QUANTITY_EXCEEDED';
  return 'OK';
}
