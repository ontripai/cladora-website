import { z } from 'zod';
import { uuidSchema } from './workspace-composition-schema';

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
  service_order_id: uuidSchema,
  expected_order_version: z.number().int().min(1).max(1_000_000_000),
  action: z.enum(['view_order', 'continue_delivery', 'manage_booking', 'request_cancellation']),
});

export type ServicePortfolioActionIntentV1 = z.infer<typeof servicePortfolioActionIntentV1Schema>;
export type ServicePortfolioSnapshotV1 = {
  authority: 'allowed' | 'denied';
  portfolio_receipt: null | { status: 'verified' | 'stale' | 'revoked'; portfolio_id: string;
    workspace_id: string; current_actor_can_read: boolean; source_version: number };
  order: null | { id: string; workspace_id: string; version: number; resource_id: string | null;
    status: 'ready' | 'in_progress' | 'completed' | 'cancelled'; available_actions: ServicePortfolioActionIntentV1['action'][] };
};
export type ServicePortfolioDecisionV1 = 'OK' | 'AUTHORITY_DENIED' | 'PORTFOLIO_RECEIPT_REQUIRED'
  | 'PORTFOLIO_SCOPE_MISMATCH' | 'ORDER_UNAVAILABLE' | 'STALE_ORDER' | 'ACTION_UNAVAILABLE';

/** Validates a PF01 reference without copying portfolio identity, ownership or
 * Service Order state. The read/action boundary must recheck current authority,
 * receipt revocation and canonical Order version for every request and replay.
 */
export function evaluateServicePortfolioAction(
  intent: ServicePortfolioActionIntentV1,
  snapshot: ServicePortfolioSnapshotV1,
): ServicePortfolioDecisionV1 {
  const same = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
  if (snapshot.authority !== 'allowed') return 'AUTHORITY_DENIED';
  const receipt = snapshot.portfolio_receipt;
  if (!receipt || receipt.status !== 'verified' || !receipt.current_actor_can_read) return 'PORTFOLIO_RECEIPT_REQUIRED';
  if (!same(receipt.portfolio_id, intent.portfolio_id) || !same(receipt.workspace_id, intent.workspace_id)) {
    return 'PORTFOLIO_SCOPE_MISMATCH';
  }
  if (!snapshot.order || !same(snapshot.order.id, intent.service_order_id)
    || !same(snapshot.order.workspace_id, intent.workspace_id)) return 'ORDER_UNAVAILABLE';
  if (snapshot.order.version !== intent.expected_order_version) return 'STALE_ORDER';
  if (!snapshot.order.available_actions.includes(intent.action)) return 'ACTION_UNAVAILABLE';
  return 'OK';
}
