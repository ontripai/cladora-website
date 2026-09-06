import { z } from 'zod';
import { uuidSchema } from './dashboard-schema.ts';

export const REPORT_TYPES = ['trial_balance', 'profit_and_loss', 'balance_sheet'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const financialReportQuerySchema = z
  .object({
    context_id: uuidSchema,
    report_type: z.enum(REPORT_TYPES),
    from: z.iso.date('Invalid start date format (must be YYYY-MM-DD calendar date)'),
    to: z.iso.date('Invalid end date format (must be YYYY-MM-DD calendar date)'),
    currency: z
      .string()
      .trim()
      .length(3, 'Currency must be a 3-letter code')
      .transform((val) => val.toUpperCase()),
  })
  .refine((data) => data.from <= data.to, {
    message: 'Start date (from) must be less than or equal to end date (to)',
    path: ['from'],
  });

export const trialBalanceRowSchema = z
  .object({
    account_id: uuidSchema,
    account_code: z.string(),
    account_name: z.string(),
    account_type: z.enum(['asset', 'liability', 'equity', 'income', 'expense']),
    debit: z.number(),
    credit: z.number(),
    net_balance: z.number(),
  })
  .strict();

export const profitAndLossRowSchema = z
  .object({
    account_id: uuidSchema,
    account_code: z.string(),
    account_name: z.string(),
    account_type: z.enum(['income', 'expense']),
    debit: z.number(),
    credit: z.number(),
    amount: z.number(),
  })
  .strict();

export const balanceSheetRowSchema = z
  .object({
    account_id: uuidSchema,
    account_code: z.string(),
    account_name: z.string(),
    account_type: z.enum(['asset', 'liability', 'equity']),
    debit: z.number(),
    credit: z.number(),
    amount: z.number(),
  })
  .strict();

export const currencySummarySchema = z
  .object({
    currency: z.string().length(3),
    posted_journals_count: z.number().optional(),
    draft_journals_count: z.number().optional(),
    total_debit: z.number(),
    total_credit: z.number(),
    difference: z.number(),
    is_balanced: z.boolean().optional(),
    trial_balance: z.array(trialBalanceRowSchema).optional(),
  })
  .strict();

export const reportTotalsSchema = z
  .object({
    total_debit: z.number().optional(),
    total_credit: z.number().optional(),
    total_income: z.number().optional(),
    total_expense: z.number().optional(),
    net_profit_loss: z.number().optional(),
    total_assets: z.number().optional(),
    total_liabilities: z.number().optional(),
    equity_base: z.number().optional(),
    retained_earnings: z.number().optional(),
    total_equity: z.number().optional(),
  })
  .strict();

export const financialReportResponseSchema = z
  .object({
    version: z.literal(1),
    report_type: z.enum(REPORT_TYPES),
    tenant_id: uuidSchema,
    property_id: uuidSchema.nullable(),
    currency: z.string().length(3),
    from: z.string(),
    to: z.string(),
    rows: z.array(z.union([trialBalanceRowSchema, profitAndLossRowSchema, balanceSheetRowSchema])),
    totals: reportTotalsSchema,
    is_balanced: z.boolean(),
    difference: z.number(),
    other_currencies_in_period: z.array(z.string()).optional(),
    generated_at: z.iso.datetime(),
  })
  .strict();

export const closeReadinessQuerySchema = z
  .object({
    context_id: uuidSchema,
  })
  .strict();

export const periodSnapshotSchema = z
  .object({
    id: uuidSchema,
    tenant_id: uuidSchema,
    property_id: uuidSchema.nullable(),
    starts_on: z.string(),
    ends_on: z.string(),
    status: z.enum(['open', 'closed']),
    closed_at: z.string().nullable(),
    closed_by: uuidSchema.nullable(),
    snapshot_json: z.record(z.string(), z.unknown()).nullable(),
  })
  .strict();

export const closeReadinessResponseSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2)]),
    period: periodSnapshotSchema,
    tenant_id: uuidSchema,
    property_id: uuidSchema.nullable(),
    scope_type: z.string(),
    status: z.enum(['open', 'closed']),
    draft_journals_count: z.number(),
    unbalanced_journals_count: z.number(),
    posted_journals_count: z.number(),
    total_debit: z.number().optional(),
    total_credit: z.number().optional(),
    currencies: z.array(z.string()),
    currency_summaries: z.array(currencySummarySchema).optional(),
    is_balanced: z.boolean(),
    difference: z.number().optional(),
    warnings: z.array(z.string()),
    can_close: z.boolean(),
    blocking_reasons: z.array(z.string()),
    generated_at: z.iso.datetime(),
  })
  .strict();

export const closePeriodRequestSchema = z
  .object({
    context_id: uuidSchema,
    reason: z.string().trim().max(500).optional(),
  })
  .strict();

export const closePeriodResponseSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2)]),
    success: z.literal(true),
    period_id: uuidSchema,
    status: z.literal('closed'),
    closed_at: z.iso.datetime(),
    closed_by: uuidSchema,
    snapshot: z.record(z.string(), z.unknown()),
  })
  .strict();

export type FinancialReportQuery = z.infer<typeof financialReportQuerySchema>;
export type FinancialReportResponse = z.infer<typeof financialReportResponseSchema>;
export type CurrencySummary = z.infer<typeof currencySummarySchema>;
export type CloseReadinessResponse = z.infer<typeof closeReadinessResponseSchema>;
export type ClosePeriodRequest = z.infer<typeof closePeriodRequestSchema>;
export type ClosePeriodResponse = z.infer<typeof closePeriodResponseSchema>;
