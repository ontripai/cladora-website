import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

export const serviceFinanceIntentV1Schema = z.discriminatedUnion('action', [
  z.strictObject({ context_id: uuidSchema, workspace_id: uuidSchema, service_order_id: uuidSchema,
    expected_order_version: z.number().int().min(1).max(1_000_000_000), action: z.literal('request_invoice'),
    delivery_acceptance_id: uuidSchema, expected_delivery_version: z.number().int().min(1).max(1_000_000_000),
    idempotency_key: idempotencyKeySchema }),
  z.strictObject({ context_id: uuidSchema, workspace_id: uuidSchema, service_order_id: uuidSchema,
    expected_order_version: z.number().int().min(1).max(1_000_000_000), action: z.literal('apply_payment'),
    payment_reference_id: uuidSchema, expected_payment_version: z.number().int().min(1).max(1_000_000_000),
    idempotency_key: idempotencyKeySchema }),
  z.strictObject({ context_id: uuidSchema, workspace_id: uuidSchema, service_order_id: uuidSchema,
    expected_order_version: z.number().int().min(1).max(1_000_000_000), action: z.literal('request_refund'),
    payment_reference_id: uuidSchema, expected_payment_version: z.number().int().min(1).max(1_000_000_000),
    reason_code: z.string().trim().min(1).max(64), idempotency_key: idempotencyKeySchema }),
  z.strictObject({ context_id: uuidSchema, workspace_id: uuidSchema, service_order_id: uuidSchema,
    expected_order_version: z.number().int().min(1).max(1_000_000_000), action: z.literal('request_provider_settlement'),
    settlement_source_id: uuidSchema, expected_settlement_source_version: z.number().int().min(1).max(1_000_000_000),
    idempotency_key: idempotencyKeySchema }),
]);

export type ServiceFinanceIntentV1 = z.infer<typeof serviceFinanceIntentV1Schema>;
export type ServiceFinanceSnapshotV1 = {
  authority: 'allowed' | 'denied';
  order: null | { id: string; workspace_id: string; version: number;
    status: 'ready' | 'in_progress' | 'completed' | 'cancelled' | 'disputed' };
  source: null | { id: string; version: number; workspace_id: string; order_id: string;
    kind: 'delivery_acceptance' | 'payment' | 'settlement_source'; state: 'eligible' | 'reversed' | 'void' | 'disputed' };
  finance_receipt: null | { status: 'verified' | 'denied' | 'stale'; action: ServiceFinanceIntentV1['action'];
    workspace_id: string; order_id: string; order_version: number; source_id: string; source_version: number };
};
export type ServiceFinanceDecisionV1 = 'OK' | 'AUTHORITY_DENIED' | 'ORDER_UNAVAILABLE' | 'STALE_ORDER'
  | 'SOURCE_UNAVAILABLE' | 'STALE_SOURCE' | 'FINANCE_RECEIPT_REQUIRED' | 'FINANCE_RECEIPT_MISMATCH';

/** Consumes a FIN01 decision without computing money, tax, invoice state,
 * payment allocation, refund or provider settlement inside SERVICE.
 */
export function evaluateServiceFinanceIntent(
  intent: ServiceFinanceIntentV1,
  snapshot: ServiceFinanceSnapshotV1,
): ServiceFinanceDecisionV1 {
  const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
  if (snapshot.authority !== 'allowed') return 'AUTHORITY_DENIED';
  if (!snapshot.order || !same(snapshot.order.id, intent.service_order_id)
    || !same(snapshot.order.workspace_id, intent.workspace_id)
    || snapshot.order.status === 'cancelled') return 'ORDER_UNAVAILABLE';
  if (snapshot.order.version !== intent.expected_order_version) return 'STALE_ORDER';

  const sourceId = 'delivery_acceptance_id' in intent ? intent.delivery_acceptance_id
    : 'payment_reference_id' in intent ? intent.payment_reference_id : intent.settlement_source_id;
  const sourceVersion = 'expected_delivery_version' in intent ? intent.expected_delivery_version
    : 'expected_payment_version' in intent ? intent.expected_payment_version : intent.expected_settlement_source_version;
  const expectedKind = intent.action === 'request_invoice' ? 'delivery_acceptance'
    : intent.action === 'request_provider_settlement' ? 'settlement_source' : 'payment';
  if (!snapshot.source || !same(snapshot.source.id, sourceId) || !same(snapshot.source.workspace_id, intent.workspace_id)
    || !same(snapshot.source.order_id, intent.service_order_id) || snapshot.source.kind !== expectedKind
    || snapshot.source.state !== 'eligible') return 'SOURCE_UNAVAILABLE';
  if (snapshot.source.version !== sourceVersion) return 'STALE_SOURCE';

  const receipt = snapshot.finance_receipt;
  if (!receipt || receipt.status !== 'verified') return 'FINANCE_RECEIPT_REQUIRED';
  if (receipt.action !== intent.action || !same(receipt.workspace_id, intent.workspace_id)
    || !same(receipt.order_id, intent.service_order_id) || receipt.order_version !== intent.expected_order_version
    || !same(receipt.source_id, sourceId) || receipt.source_version !== sourceVersion) return 'FINANCE_RECEIPT_MISMATCH';
  return 'OK';
}
