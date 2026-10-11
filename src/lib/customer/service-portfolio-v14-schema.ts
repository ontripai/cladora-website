import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';
import { fingerprintServiceProviderInput, receiptEnvelopeMatches,
  serviceProviderReceiptEnvelopeShape } from './service-provider-receipt-v1-schema';

export { fingerprintServiceProviderInput } from './service-provider-receipt-v1-schema';
export const PORTFOLIO_SERVICE_ACTION_PROJECTION_RECEIPT_CONTRACT = 'portfolio-service-action-projection-receipt.v1' as const;

const servicePortfolioActions = ['view_order', 'continue_delivery', 'manage_booking', 'request_cancellation'] as const;

export const servicePortfolioQueryV1Schema = z.strictObject({
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  portfolio_id: uuidSchema,
  resource_id: uuidSchema.optional(),
  cursor: z.string().trim().min(1).max(256).optional(),
  limit: z.number().int().min(1).max(100).default(25),
});

export const servicePortfolioActionIntentV1Schema = z.strictObject({
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  portfolio_id: uuidSchema,
  expected_portfolio_version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  service_order_id: uuidSchema,
  expected_order_version: z.number().int().min(1).max(1_000_000_000),
  action: z.enum(servicePortfolioActions),
  idempotency_key: idempotencyKeySchema,
});

export type ServicePortfolioActionIntentV1 = z.infer<typeof servicePortfolioActionIntentV1Schema>;

export const portfolioServiceActionProjectionReceiptV1Schema = z.strictObject({
  ...serviceProviderReceiptEnvelopeShape,
  contract: z.literal(PORTFOLIO_SERVICE_ACTION_PROJECTION_RECEIPT_CONTRACT),
  result_code: z.enum(['OK', 'PORTFOLIO_REVOKED', 'STALE_PORTFOLIO', 'PORTFOLIO_ACCESS_DENIED']),
  portfolio_id: uuidSchema,
  current_actor_can_read: z.boolean(),
  order_references: z.array(z.strictObject({
    service_order_id: uuidSchema,
    order_version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    resource_id: uuidSchema.nullable(),
    available_actions: z.array(z.enum(servicePortfolioActions)).max(servicePortfolioActions.length),
  })).max(100),
});

export type ServicePortfolioSnapshotV1 = {
  authority: 'allowed' | 'denied';
  portfolio_receipt: z.infer<typeof portfolioServiceActionProjectionReceiptV1Schema> | null;
  order: null | { id: string; workspace_id: string; version: number; resource_id: string | null;
    status: 'ready' | 'in_progress' | 'completed' | 'cancelled'; available_actions: ServicePortfolioActionIntentV1['action'][] };
};
export type ServicePortfolioDecisionV1 = 'OK' | 'AUTHORITY_DENIED' | 'PORTFOLIO_RECEIPT_REQUIRED'
  | 'PORTFOLIO_SCOPE_MISMATCH' | 'PORTFOLIO_RECEIPT_MISMATCH'
  | 'ORDER_UNAVAILABLE' | 'STALE_ORDER' | 'ACTION_UNAVAILABLE';

/** Validates a PF01 reference without copying portfolio identity, ownership or
 * Service Order state. The read/action boundary must recheck current authority,
 * receipt revocation and canonical Order version for every request and replay.
 */
export function evaluateServicePortfolioAction(
  intent: ServicePortfolioActionIntentV1,
  snapshot: ServicePortfolioSnapshotV1,
): ServicePortfolioDecisionV1 {
  const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
  const validAction = (value: unknown): value is ServicePortfolioActionIntentV1['action'] => (
    typeof value === 'string' && servicePortfolioActions.includes(value as ServicePortfolioActionIntentV1['action'])
  );
  if (snapshot.authority !== 'allowed') return 'AUTHORITY_DENIED';
  const parsedReceipt = portfolioServiceActionProjectionReceiptV1Schema.safeParse(snapshot.portfolio_receipt);
  if (!parsedReceipt.success) return 'PORTFOLIO_RECEIPT_REQUIRED';
  const receipt = parsedReceipt.data;
  if (!same(receipt.portfolio_id, intent.portfolio_id) || !same(receipt.workspace_id, intent.workspace_id)) {
    return 'PORTFOLIO_SCOPE_MISMATCH';
  }
  if (!receiptEnvelopeMatches(receipt, {
    contract: PORTFOLIO_SERVICE_ACTION_PROJECTION_RECEIPT_CONTRACT,
    workspaceId: intent.workspace_id,
    sourceKind: 'service_portfolio',
    sourceId: intent.portfolio_id,
    sourceVersion: intent.expected_portfolio_version,
    idempotencyKey: intent.idempotency_key,
    inputFingerprint: fingerprintServiceProviderInput(intent),
  })) return 'PORTFOLIO_RECEIPT_MISMATCH';
  if (!receipt.current_actor_can_read) return 'PORTFOLIO_RECEIPT_REQUIRED';
  const malformedReference = receipt.order_references.some(reference => (
    !reference || typeof reference.service_order_id !== 'string'
    || !uuidSchema.safeParse(reference.service_order_id).success
    || !Number.isSafeInteger(reference.order_version) || reference.order_version < 1
    || (reference.resource_id !== null && typeof reference.resource_id !== 'string')
    || (typeof reference.resource_id === 'string' && !uuidSchema.safeParse(reference.resource_id).success)
    || !Array.isArray(reference.available_actions) || !reference.available_actions.every(validAction)
  ));
  const referenceIds = receipt.order_references.map(reference => reference.service_order_id.toLowerCase());
  if (malformedReference || new Set(referenceIds).size !== referenceIds.length) return 'PORTFOLIO_RECEIPT_REQUIRED';
  const orderReference = receipt.order_references.find(reference => same(reference.service_order_id, intent.service_order_id));
  if (!orderReference) return 'ORDER_UNAVAILABLE';
  if (orderReference.order_version !== intent.expected_order_version) return 'STALE_ORDER';
  if (!snapshot.order || typeof snapshot.order.id !== 'string' || typeof snapshot.order.workspace_id !== 'string'
    || !same(snapshot.order.id, intent.service_order_id)
    || !same(snapshot.order.workspace_id, intent.workspace_id)
    || (snapshot.order.resource_id !== null && typeof snapshot.order.resource_id !== 'string')
    || (snapshot.order.resource_id === null) !== (orderReference.resource_id === null)
    || (typeof snapshot.order.resource_id === 'string' && typeof orderReference.resource_id === 'string'
      && !same(snapshot.order.resource_id, orderReference.resource_id))) return 'ORDER_UNAVAILABLE';
  if (!Number.isSafeInteger(snapshot.order.version)
    || snapshot.order.version !== intent.expected_order_version) return 'STALE_ORDER';
  if (!Array.isArray(snapshot.order.available_actions)
    || !snapshot.order.available_actions.includes(intent.action)
    || !orderReference.available_actions.includes(intent.action)) return 'ACTION_UNAVAILABLE';
  return 'OK';
}
