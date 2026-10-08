import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

/**
 * Customer intent only. The server must load the published quote, request,
 * provider, beneficiary and financial decision; none of those facts are
 * accepted from this command.
 */
export const acceptServiceQuoteV14Schema = z.strictObject({
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  quote_id: uuidSchema,
  expected_quote_version: z.number().int().min(1).max(1_000_000_000),
  idempotency_key: idempotencyKeySchema,
});

export type AcceptServiceQuoteV14 = z.infer<typeof acceptServiceQuoteV14Schema>;

export type TrustedServiceQuoteAcceptanceSnapshot = {
  now: number;
  authorityEffective: boolean;
  workspaceId: string;
  quoteId: string;
  quoteVersion: number;
  quoteState: 'draft' | 'presented' | 'superseded' | 'expired' | 'accepted';
  quoteValidUntil: string;
  requestState: 'submitted' | 'cancelled' | 'completed';
  providerActive: boolean;
  beneficiaryActive: boolean;
  financeContractStatus: 'verified' | 'missing' | 'stale' | 'rejected';
};

export type ServiceQuoteAcceptanceDecision =
  | 'OK'
  | 'AUTHORITY_DENIED'
  | 'REFERENCE_UNAVAILABLE'
  | 'STALE_QUOTE'
  | 'QUOTE_UNAVAILABLE'
  | 'REQUEST_UNAVAILABLE'
  | 'PARTY_UNAVAILABLE'
  | 'FINANCE_CONTRACT_REQUIRED';

/** Pure planning over server-read facts; this does not create an Order. */
export function evaluateServiceQuoteAcceptance(
  command: AcceptServiceQuoteV14,
  snapshot: TrustedServiceQuoteAcceptanceSnapshot,
): ServiceQuoteAcceptanceDecision {
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  if (!snapshot.authorityEffective) return 'AUTHORITY_DENIED';
  if (!same(command.workspace_id, snapshot.workspaceId) || !same(command.quote_id, snapshot.quoteId)) {
    return 'REFERENCE_UNAVAILABLE';
  }
  if (command.expected_quote_version !== snapshot.quoteVersion) return 'STALE_QUOTE';
  if (snapshot.quoteState !== 'presented') return 'QUOTE_UNAVAILABLE';
  const expiry = Date.parse(snapshot.quoteValidUntil);
  if (!Number.isFinite(snapshot.now) || !Number.isFinite(expiry) || snapshot.now >= expiry) return 'QUOTE_UNAVAILABLE';
  if (snapshot.requestState !== 'submitted') return 'REQUEST_UNAVAILABLE';
  if (!snapshot.providerActive || !snapshot.beneficiaryActive) return 'PARTY_UNAVAILABLE';
  if (snapshot.financeContractStatus !== 'verified') return 'FINANCE_CONTRACT_REQUIRED';
  return 'OK';
}
