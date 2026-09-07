import { z } from "zod";

export const recordPaymentRequestSchema = z.object({
  context_id: z.string().uuid(),
  property_id: z.string().uuid(),
  unit_id: z.string().uuid().optional().nullable(),
  payer_party_id: z.string().uuid().optional().nullable(),
  amount: z.coerce.number().positive(),
  currency: z.string().trim().length(3).default("RON"),
  paid_at: z.string().optional(),
  method: z.enum(["bank_transfer", "card", "cash", "direct_debit", "other"]).default("bank_transfer"),
  provider_ref: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(255).optional().nullable(),
  idempotency_key: z.string().trim().max(100).optional().nullable(),
});

export const paymentAllocationItemSchema = z.object({
  receivable_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
});

export const allocatePaymentRequestSchema = z.object({
  context_id: z.string().uuid(),
  allocations: z.array(paymentAllocationItemSchema).min(1),
  idempotency_key: z.string().trim().max(100).optional().nullable(),
});

export const unallocatePaymentRequestSchema = z.object({
  context_id: z.string().uuid(),
  reason: z.string().trim().min(1).max(255),
});

export const reversePaymentRequestSchema = z.object({
  context_id: z.string().uuid(),
  reason: z.string().trim().min(1).max(255),
});

export const matchBankTransactionRequestSchema = z.object({
  context_id: z.string().uuid(),
  payment_id: z.string().uuid().optional().nullable(),
  receivable_id: z.string().uuid().optional().nullable(),
  matched_amount: z.coerce.number().positive().optional().nullable(),
  notes: z.string().trim().max(255).optional().nullable(),
});

export const unmatchBankTransactionRequestSchema = z.object({
  context_id: z.string().uuid(),
  reason: z.string().trim().min(1).max(255),
});

export const finalizeReconciliationRequestSchema = z.object({
  context_id: z.string().uuid(),
  bank_account_id: z.string().uuid(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)"),
  closing_balance: z.coerce.number(),
  notes: z.string().trim().max(255).optional().nullable(),
});

export const queryPaymentsSchema = z.object({
  context_id: z.string().uuid(),
  view: z.enum(["payments", "reconciliation"]).default("payments"),
  query: z.string().trim().max(120).optional(),
  status: z.string().trim().max(30).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  id: z.string().uuid().optional(),
});

export const queryBankTransactionsSchema = z.object({
  context_id: z.string().uuid(),
  bank_account_id: z.string().uuid().optional(),
  match_status: z.enum(["all", "unmatched", "matched"]).default("all"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const queryReconciliationSummarySchema = z.object({
  context_id: z.string().uuid(),
  bank_account_id: z.string().uuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)").optional(),
});
