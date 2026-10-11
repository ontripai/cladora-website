import { z } from 'zod';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';
import { fingerprintServiceProviderInput, receiptEnvelopeMatches,
  serviceProviderReceiptEnvelopeShape } from './service-provider-receipt-v1-schema';

export { fingerprintServiceProviderInput } from './service-provider-receipt-v1-schema';
export const FINANCIAL_PROPOSAL_POSTING_RECEIPT_CONTRACT = 'financial-proposal-posting-receipt.v1' as const;

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

export const financialProposalPostingReceiptV1Schema = z.strictObject({
  ...serviceProviderReceiptEnvelopeShape,
  contract: z.literal(FINANCIAL_PROPOSAL_POSTING_RECEIPT_CONTRACT),
  result_code: z.enum(['OK', 'QUOTE_UNAVAILABLE', 'STALE_QUOTE', 'PARTY_UNAVAILABLE', 'FINANCE_DENIED']),
  quote_id: uuidSchema,
  quote_version: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  provider_party_id: uuidSchema,
  beneficiary_party_id: uuidSchema,
  price_snapshot_id: uuidSchema,
  tax_snapshot_id: uuidSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  amount_minor: z.string().regex(/^(0|[1-9][0-9]{0,17})$/),
});

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
  financeReceipt: z.infer<typeof financialProposalPostingReceiptV1Schema> | null;
};

export type ServiceQuoteAcceptanceDecision =
  | 'OK'
  | 'AUTHORITY_DENIED'
  | 'REFERENCE_UNAVAILABLE'
  | 'STALE_QUOTE'
  | 'QUOTE_UNAVAILABLE'
  | 'REQUEST_UNAVAILABLE'
  | 'PARTY_UNAVAILABLE'
  | 'FINANCE_CONTRACT_REQUIRED'
  | 'FINANCE_RECEIPT_MISMATCH';

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
  const parsedReceipt = financialProposalPostingReceiptV1Schema.safeParse(snapshot.financeReceipt);
  if (!parsedReceipt.success) return 'FINANCE_CONTRACT_REQUIRED';
  const receipt = parsedReceipt.data;
  if (!receiptEnvelopeMatches(receipt, {
    contract: FINANCIAL_PROPOSAL_POSTING_RECEIPT_CONTRACT,
    workspaceId: command.workspace_id,
    sourceKind: 'service_quote',
    sourceId: command.quote_id,
    sourceVersion: command.expected_quote_version,
    idempotencyKey: command.idempotency_key,
    inputFingerprint: fingerprintServiceProviderInput(command),
  }) || !same(receipt.quote_id, command.quote_id)
    || receipt.quote_version !== command.expected_quote_version) return 'FINANCE_RECEIPT_MISMATCH';
  return 'OK';
}
