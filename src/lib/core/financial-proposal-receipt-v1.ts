import { z } from 'zod';
import { uuidSchema } from '@/lib/customer/workspace-composition-schema';
import { canonicalResourceReferenceV1InputSchema } from '@/lib/core/resource-contracts-v1';

const timestampSchema = z.string().datetime({ offset: true });
const dateSchema = z.string().date();
const codeSchema = z.string().regex(/^[a-z0-9_.:-]{3,160}$/);
const decimalSchema = z.string().regex(/^(?:0|[1-9]\d*)(?:\.\d{1,4})?$/);
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);

const financialSourceV1Schema = z.strictObject({
  source_domain: z.enum(['airprop', 'service', 'community', 'operations', 'core_portfolio']),
  source_entity_type: codeSchema,
  source_entity_id: uuidSchema,
  source_version: z.number().int().positive(),
  source_reference: z.string().min(1).max(240),
});

const financialAmountsV1Schema = z.strictObject({
  currency: z.string().regex(/^[A-Z]{3}$/),
  net_amount: decimalSchema,
  tax_amount: decimalSchema,
  gross_amount: decimalSchema,
  tax_treatment_code: codeSchema,
  tax_rule_version: z.number().int().positive(),
});

const financialPayerV1Schema = z.strictObject({
  party_id: uuidSchema,
  payer_role: z.enum(['customer', 'owner', 'tenant', 'association', 'provider', 'other']),
  allocated_amount: decimalSchema,
  approval_state: z.enum(['not_required', 'pending', 'approved', 'rejected', 'expired']),
  approval_reference: z.string().min(1).max(240).nullable(),
});

export const financialProposalV1Schema = z.strictObject({
  contract_version: z.literal('financial-proposal-posting-receipt.v1'),
  proposal_id: uuidSchema,
  proposal_version: z.number().int().positive(),
  idempotency_key: idempotencyKeySchema,
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  source: financialSourceV1Schema,
  resource: canonicalResourceReferenceV1InputSchema.nullable(),
  proposal_kind: z.enum(['charge', 'invoice', 'payable', 'payment', 'refund', 'adjustment']),
  amounts: financialAmountsV1Schema,
  payers: z.array(financialPayerV1Schema).min(1).max(100),
  occurred_on: dateSchema,
  due_on: dateSchema.nullable(),
  approval_state: z.enum(['pending', 'approved', 'rejected', 'expired']),
  approval_version: z.number().int().nonnegative(),
  requested_at: timestampSchema,
  posting_authorization: z.literal('not_evaluated'),
}).superRefine((value, ctx) => {
  if (value.due_on !== null && value.due_on < value.occurred_on) {
    ctx.addIssue({ code: 'custom', path: ['due_on'], message: 'due_on_must_not_precede_occurred_on' });
  }
  if (value.approval_state === 'approved' && value.payers.some((payer) => payer.approval_state === 'pending')) {
    ctx.addIssue({ code: 'custom', path: ['payers'], message: 'approved_proposal_cannot_have_pending_payer_approval' });
  }
});

export const financialPostingRequestV1Schema = z.strictObject({
  contract_version: z.literal('financial-proposal-posting-receipt.v1'),
  posting_request_id: uuidSchema,
  idempotency_key: idempotencyKeySchema,
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  proposal_id: uuidSchema,
  expected_proposal_version: z.number().int().positive(),
  expected_approval_version: z.number().int().nonnegative(),
  posting_intent: z.enum(['post', 'reverse']),
  original_receipt_id: uuidSchema.nullable(),
  reason: z.string().trim().min(8).max(500),
}).superRefine((value, ctx) => {
  if ((value.posting_intent === 'reverse') !== (value.original_receipt_id !== null)) {
    ctx.addIssue({ code: 'custom', path: ['original_receipt_id'], message: 'reversal_requires_original_receipt_only' });
  }
});

const financialPostingReferenceV1Schema = z.strictObject({
  journal_id: uuidSchema.nullable(),
  invoice_id: uuidSchema.nullable(),
  receivable_id: uuidSchema.nullable(),
  payment_id: uuidSchema.nullable(),
  payable_id: uuidSchema.nullable(),
});

const financialReceiptBaseV1Schema = z.strictObject({
  contract_version: z.literal('financial-proposal-posting-receipt.v1'),
  receipt_id: uuidSchema,
  receipt_version: z.number().int().positive(),
  posting_request_id: uuidSchema,
  proposal_id: uuidSchema,
  proposal_version: z.number().int().positive(),
  source: financialSourceV1Schema,
  amounts: financialAmountsV1Schema,
  references: financialPostingReferenceV1Schema,
  audit_event_id: uuidSchema,
  recorded_at: timestampSchema,
  action_authorization: z.literal('not_evaluated'),
});

const financialPostedReceiptV1Schema = financialReceiptBaseV1Schema.extend({
  posting_status: z.literal('posted'),
  original_receipt_id: z.null(),
  reason_codes: z.tuple([z.literal('financial_posting_recorded')]),
}).superRefine((value, ctx) => {
  if (Object.values(value.references).every((reference) => reference === null)) {
    ctx.addIssue({ code: 'custom', path: ['references'], message: 'posted_receipt_requires_financial_reference' });
  }
});

const financialReversedReceiptV1Schema = financialReceiptBaseV1Schema.extend({
  posting_status: z.literal('reversed'),
  original_receipt_id: uuidSchema,
  reason_codes: z.tuple([z.literal('financial_reversal_recorded')]),
}).superRefine((value, ctx) => {
  if (value.references.journal_id === null) {
    ctx.addIssue({ code: 'custom', path: ['references', 'journal_id'], message: 'reversal_requires_journal_reference' });
  }
});

const financialRejectedReceiptV1Schema = financialReceiptBaseV1Schema.extend({
  posting_status: z.literal('rejected'),
  original_receipt_id: z.null(),
  references: z.strictObject({
    journal_id: z.null(),
    invoice_id: z.null(),
    receivable_id: z.null(),
    payment_id: z.null(),
    payable_id: z.null(),
  }),
  reason_codes: z.array(codeSchema).min(1).max(32),
});

export const financialProposalPostingReceiptV1Schema = z.union([
  financialPostedReceiptV1Schema,
  financialReversedReceiptV1Schema,
  financialRejectedReceiptV1Schema,
]);

export type FinancialProposalV1 = z.infer<typeof financialProposalV1Schema>;
export type FinancialPostingRequestV1 = z.infer<typeof financialPostingRequestV1Schema>;
export type FinancialProposalPostingReceiptV1 = z.infer<typeof financialProposalPostingReceiptV1Schema>;
