import { z } from 'zod';
import { coreTransactionAcceptedProviderEvidenceV1Schema } from '../../core/transaction-provider-evidence-v1';
import { currentAuthorityTransactionDecisionReceiptV1Schema } from '../../core/current-authority-transaction-port-v1';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const version = z.number().int().positive().safe();
const fingerprint = z.string().regex(/^sha256:[a-f0-9]{64}$/);

const receiptSchema = z.strictObject({
  contract_version: z.literal('core-transaction-receipt.v2'),
  receipt_version: z.literal(2),
  receipt_id: uuid,
  transaction_id: uuid,
  command_id: uuid,
  workspace_id: uuid,
  actor_id: uuid,
  aggregate_type: z.enum(['service_offering', 'service_request']),
  aggregate_id: uuid,
  aggregate_version: version,
  input_fingerprint: fingerprint,
  idempotency_key: z.string().min(8).max(160),
  authority: currentAuthorityTransactionDecisionReceiptV1Schema,
  mutation_id: uuid,
  audit_event_id: z.string().regex(/^[1-9][0-9]*$/),
  outbox_event_id: uuid,
  committed_at: z.string().datetime({ offset: true }),
  subject_reference: z.strictObject({
    kind: z.string(), id: uuid, version, relation: z.string(), request_version: version,
  }),
  provider_evidence: coreTransactionAcceptedProviderEvidenceV1Schema,
  replay_validation: z.strictObject({
    contract_version: z.literal('core-transaction-replay-provider-requirement.v1'),
    provider_code: z.literal('service_v14_execution'),
  }).optional(),
  jurisdiction_artifacts: z.array(z.unknown()).optional(),
});

export const serviceV14ExecutionResponseSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.enum(['committed', 'exact_replay']), receipt: receiptSchema }),
  z.strictObject({
    status: z.literal('denied'),
    code: z.enum(['INVALID_COMMAND', 'WORKSPACE_UNAVAILABLE', 'REPLAY_CONFLICT',
      'AUTHORITY_DENIED', 'PROVIDER_UNAVAILABLE', 'TRANSACTION_FAILED']),
    authority: currentAuthorityTransactionDecisionReceiptV1Schema.optional(),
  }),
  z.strictObject({ status: z.literal('unknown_commit'), code: z.literal('READBACK_REQUIRED') }),
  z.strictObject({
    status: z.literal('not_ready'),
    code: z.enum(['PROVIDER_AGREEMENT_SOURCE_UNAVAILABLE', 'GEOGRAPHY_SOURCE_UNAVAILABLE',
      'ELIGIBILITY_SOURCE_UNAVAILABLE', 'RUNTIME_BINDING_INACTIVE']),
  }),
]);

export type ServiceV14ExecutionResponse = z.infer<typeof serviceV14ExecutionResponseSchema>;

/** A success is valid only when the official Core host returned a committed receipt. */
export function parseServiceV14ExecutionResponse(value: unknown): ServiceV14ExecutionResponse {
  return serviceV14ExecutionResponseSchema.parse(value);
}
