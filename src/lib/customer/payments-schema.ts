import { z } from "zod";

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}, "Invalid calendar date");

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

const bankStatementRowSchema = z.object({
  external_ref: z.string().trim().max(160).optional().nullable(),
  booked_on: isoDateSchema,
  value_on: isoDateSchema.optional().nullable(),
  direction: z.enum(["credit", "debit"]),
  amount: z.coerce.number().positive().max(999_999_999_999),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  counterparty_name: z.string().trim().max(255).optional().nullable(),
  counterparty_iban_masked: z.string().trim().regex(/^[A-Z]{2}[0-9]{2}\*{4,28}[A-Z0-9]{0,4}$/).optional().nullable(),
  remittance_text: z.string().trim().max(1000).optional().nullable(),
}).strict();

export const createBankStatementImportSchema = z.object({
  context_id: z.string().uuid(),
  bank_account_id: z.string().uuid(),
  source: z.string().trim().min(1).max(100),
  file_name: z.string().trim().min(1).max(255),
  statement_format: z.enum(["csv", "camt053", "json"]),
  period_start: isoDateSchema,
  period_end: isoDateSchema,
  opening_balance: z.coerce.number().optional().nullable(),
  closing_balance: z.coerce.number().optional().nullable(),
  idempotency_key: z.string().trim().min(8).max(120),
  rows: z.array(bankStatementRowSchema).min(1).max(5000),
}).strict();

export const queryBankStatementImportsSchema = z.object({
  context_id: z.string().uuid(),
  id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

export const commitBankStatementImportSchema = z.object({
  context_id: z.string().uuid(),
}).strict();

export const generateBankMatchSuggestionsSchema = z.object({
  context_id: z.string().uuid(),
  bank_account_id: z.string().uuid(),
  period_start: isoDateSchema,
  period_end: isoDateSchema,
  idempotency_key: z.string().trim().min(8).max(120),
}).strict();

export const queryBankMatchingQueueSchema = z.object({
  context_id: z.string().uuid(),
  bank_account_id: z.string().uuid().optional(),
  status: z.enum(["open", "pending_approval", "suggested"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const reviewBankMatchSuggestionSchema = z.object({
  context_id: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional().nullable(),
}).strict();

export const proposeBankExceptionResolutionSchema = z.object({
  context_id: z.string().uuid(),
  payment_id: z.string().uuid().optional().nullable(),
  receivable_id: z.string().uuid().optional().nullable(),
  matched_amount: z.coerce.number().positive().optional().nullable(),
  note: z.string().trim().min(3).max(500),
}).strict().refine((value) => Boolean(value.payment_id || value.receivable_id), {
  message: "A payment or receivable target is required",
});
