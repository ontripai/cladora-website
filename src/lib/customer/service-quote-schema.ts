import { z } from 'zod';
import { currencyConfig, type SupportedCurrency } from '../../config/currencies';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

// Draft validation only. Party references confer no authority or consent.
const minorAmount = z.string().regex(/^(0|[1-9][0-9]{0,17})$/);
const currency = z.enum(Object.keys(currencyConfig) as [SupportedCurrency, ...SupportedCurrency[]]);
export const createServiceQuoteDraftSchema = z.strictObject({
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  request_id: uuidSchema,
  published_revision_id: uuidSchema,
  scope: z.string().trim().min(5).max(5000),
  total_minor: minorAmount,
  currency,
  payer_shares: z.array(z.strictObject({ party_id: uuidSchema, amount_minor: minorAmount })).min(1).max(32),
  valid_until: z.iso.datetime({ offset: true }),
  idempotency_key: idempotencyKeySchema,
}).superRefine((value, ctx) => {
  // Zod may run refinements after a regex issue; never parse invalid amounts.
  if (!minorAmount.safeParse(value.total_minor).success
    || value.payer_shares.some(share => !minorAmount.safeParse(share.amount_minor).success)) return;
  const parties = value.payer_shares.map(share => share.party_id.toLowerCase());
  if (new Set(parties).size !== parties.length) ctx.addIssue({ code: 'custom', path: ['payer_shares'], message: 'Duplicate payer' });
  // No Number conversion: preserve exact minor-unit sums above 2^53.
  if (value.payer_shares.reduce((sum, share) => sum + BigInt(share.amount_minor), BigInt(0)) !== BigInt(value.total_minor)) {
    ctx.addIssue({ code: 'custom', path: ['payer_shares'], message: 'Shares must equal total' });
  }
});

export type CreateServiceQuoteDraft = z.infer<typeof createServiceQuoteDraftSchema>;

/** Uses the historical request revision, never the latest catalogue pointer.
 * The future RPC must authorize provider/coordinator and every referenced party,
 * lock the request, and commit draft/audit/outbox/idempotency atomically.
 * Passing this check neither accepts the proposal nor creates an order.
 */
export function checkServiceQuoteRequest(
  quote: CreateServiceQuoteDraft,
  request: { id: string; workspace_id: string; published_revision_id: string; status: string },
  now: number,
): 'OK' | 'REQUEST_MISMATCH' | 'REVISION_MISMATCH' | 'UNAVAILABLE' {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (!same(quote.request_id, request.id) || !same(quote.workspace_id, request.workspace_id)) return 'REQUEST_MISMATCH';
  if (!same(quote.published_revision_id, request.published_revision_id)) return 'REVISION_MISMATCH';
  const expiry = Date.parse(quote.valid_until);
  if (request.status !== 'submitted' || !Number.isFinite(now) || !Number.isFinite(expiry) || now >= expiry) return 'UNAVAILABLE';
  return 'OK';
}
