import { z } from 'zod';
import { uuidSchema } from '@/lib/customer/workspace-composition-schema';
import { canonicalResourceReferenceV1InputSchema } from '@/lib/core/resource-contracts-v1';

const timestampSchema = z.string().datetime({ offset: true });
const codeSchema = z.string().regex(/^[a-z0-9_.:-]{3,160}$/);
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/);

export const operationsWorkOrderStatusV1Schema = z.enum([
  'draft',
  'scheduled',
  'assigned',
  'in_progress',
  'blocked',
  'completed',
  'verified',
  'cancelled',
]);

const operationsExecutionSourceV1Schema = z.strictObject({
  source_domain: z.enum(['core_portfolio', 'airprop', 'service', 'community', 'operations']),
  source_entity_type: codeSchema,
  source_entity_id: uuidSchema,
  source_version: z.number().int().positive(),
  source_reference: z.string().min(1).max(240),
});

export const operationsExecutionRequestV1Schema = z.strictObject({
  contract_version: z.literal('operations-execution-request-receipt.v1'),
  request_id: uuidSchema,
  idempotency_key: idempotencyKeySchema,
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  source: operationsExecutionSourceV1Schema,
  resource: canonicalResourceReferenceV1InputSchema,
  request_kind: z.enum(['inspect', 'maintain', 'repair', 'install', 'remove', 'other']),
  title: z.string().trim().min(3).max(200),
  scope_reference: z.string().min(1).max(240),
  priority: z.enum(['low', 'normal', 'high', 'urgent', 'emergency']),
  desired_start: timestampSchema.nullable(),
  desired_end: timestampSchema.nullable(),
  financial_proposal_id: uuidSchema.nullable(),
  financial_proposal_version: z.number().int().positive().nullable(),
  requested_at: timestampSchema,
  current_authority_recheck_required: z.literal(true),
}).superRefine((value, ctx) => {
  if (value.desired_end !== null && (value.desired_start === null || value.desired_end <= value.desired_start)) {
    ctx.addIssue({ code: 'custom', path: ['desired_end'], message: 'desired_end_requires_earlier_desired_start' });
  }
  if ((value.financial_proposal_id === null) !== (value.financial_proposal_version === null)) {
    ctx.addIssue({ code: 'custom', path: ['financial_proposal_id'], message: 'financial_proposal_id_and_version_must_coexist' });
  }
});

const operationsExecutionReceiptBaseV1Schema = z.strictObject({
  contract_version: z.literal('operations-execution-request-receipt.v1'),
  request_id: uuidSchema,
  idempotency_key: idempotencyKeySchema,
  workspace_id: uuidSchema,
  source: operationsExecutionSourceV1Schema,
  receipt_id: uuidSchema,
  receipt_version: z.number().int().positive(),
  recorded_at: timestampSchema,
  action_authorization: z.literal('not_evaluated'),
});

const operationsExecutionAcceptedReceiptV1Schema = operationsExecutionReceiptBaseV1Schema.extend({
  request_status: z.literal('accepted'),
  work_order_id: uuidSchema,
  work_order_version: z.number().int().positive(),
  work_order_status: operationsWorkOrderStatusV1Schema,
  status_reference: z.string().min(1).max(240),
  financial_receipt_ids: z.array(uuidSchema).max(32),
  reason_codes: z.tuple([z.literal('operations_execution_request_accepted')]),
});

const operationsExecutionRejectedReceiptV1Schema = operationsExecutionReceiptBaseV1Schema.extend({
  request_status: z.literal('rejected'),
  work_order_id: z.null(),
  work_order_version: z.null(),
  work_order_status: z.null(),
  status_reference: z.null(),
  financial_receipt_ids: z.array(z.never()).max(0),
  reason_codes: z.array(codeSchema).min(1).max(32),
});

export const operationsExecutionRequestReceiptV1Schema = z.discriminatedUnion('request_status', [
  operationsExecutionAcceptedReceiptV1Schema,
  operationsExecutionRejectedReceiptV1Schema,
]);

export type OperationsExecutionRequestV1 = z.infer<typeof operationsExecutionRequestV1Schema>;
export type OperationsExecutionRequestReceiptV1 = z.infer<typeof operationsExecutionRequestReceiptV1Schema>;
