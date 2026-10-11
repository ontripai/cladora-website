import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';
import { fingerprintServiceProviderInput, receiptEnvelopeMatches,
  serviceProviderReceiptEnvelopeShape } from './service-provider-receipt-v1-schema';

export { fingerprintServiceProviderInput } from './service-provider-receipt-v1-schema';
export const SERVICE_FINANCIAL_OPERATION_RECEIPT_CONTRACT = 'service-financial-operation-receipt.v1' as const;

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

export const serviceFinancialOperationReceiptV1Schema = z.strictObject({
  ...serviceProviderReceiptEnvelopeShape,
  contract: z.literal(SERVICE_FINANCIAL_OPERATION_RECEIPT_CONTRACT),
  result_code: z.enum(['OK', 'CLOSED_PERIOD', 'DUPLICATE_SOURCE', 'STALE_SOURCE', 'FINANCE_DENIED']),
  action: z.enum(['request_invoice', 'apply_payment', 'request_refund', 'request_provider_settlement']),
  order_id: uuidSchema,
  order_version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  source_kind: z.enum(['delivery_acceptance', 'payment', 'settlement_source']),
  source_id: uuidSchema,
  source_version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  posting_reference_id: uuidSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  amount_minor: z.string().regex(/^(0|[1-9][0-9]{0,17})$/),
  tax_snapshot_id: uuidSchema,
  rounding_policy_version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  payer_share_snapshot_id: uuidSchema,
});

export type ServiceFinanceSnapshotV1 = {
  authority: 'allowed' | 'denied';
  order: null | { id: string; workspace_id: string; version: number;
    status: 'ready' | 'in_progress' | 'completed' | 'cancelled' | 'disputed' };
  source: null | { id: string; version: number; workspace_id: string; order_id: string;
    kind: 'delivery_acceptance' | 'payment' | 'settlement_source'; state: 'eligible' | 'reversed' | 'void' | 'disputed' };
  finance_receipt: z.infer<typeof serviceFinancialOperationReceiptV1Schema> | null;
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
  const parsedReceipt = serviceFinancialOperationReceiptV1Schema.safeParse(receipt);
  if (!receipt) return 'FINANCE_RECEIPT_REQUIRED';
  if (!parsedReceipt.success) return 'FINANCE_RECEIPT_MISMATCH';
  const verifiedReceipt = parsedReceipt.data;
  if (!receiptEnvelopeMatches(verifiedReceipt, {
    contract: SERVICE_FINANCIAL_OPERATION_RECEIPT_CONTRACT,
    workspaceId: intent.workspace_id,
    sourceKind: expectedKind,
    sourceId,
    sourceVersion,
    idempotencyKey: intent.idempotency_key,
    inputFingerprint: fingerprintServiceProviderInput(intent),
  })) return 'FINANCE_RECEIPT_MISMATCH';
  if (verifiedReceipt.action !== intent.action || !same(verifiedReceipt.workspace_id, intent.workspace_id)
    || !same(verifiedReceipt.order_id, intent.service_order_id) || verifiedReceipt.order_version !== intent.expected_order_version
    || verifiedReceipt.source_kind !== expectedKind
    || !same(verifiedReceipt.source_id, sourceId) || verifiedReceipt.source_version !== sourceVersion) {
    return 'FINANCE_RECEIPT_MISMATCH';
  }
  return 'OK';
}
