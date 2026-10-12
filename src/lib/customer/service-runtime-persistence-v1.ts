import { z } from 'zod';
import {
  SERVICE_RUNTIME_COMMIT_LOCK_ORDER,
  serviceRuntimeCommitCommandV1Schema,
  type ServiceRuntimeCommitCommandV1,
} from './service-runtime-commit-coordinator-v1';
import {
  fingerprintServiceProviderInput,
  serviceReceiptFingerprintSchema,
  serviceReceiptVersionSchema,
} from './service-provider-receipt-v1-schema';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

export const SERVICE_RUNTIME_PERSISTENCE_CONTRACT = 'service-runtime-persistence.v1' as const;
export const SERVICE_RUNTIME_PERSISTENCE_RECEIPT_CONTRACT = 'service-runtime-persistence-receipt.v1' as const;
export const SERVICE_RUNTIME_UNKNOWN_COMMIT_RECOVERY_CONTRACT =
  'service-runtime-unknown-commit-recovery.v1' as const;

const operationSchema = z.enum([
  'subject_link',
  'delivery_evidence',
  'stage_work_order',
  'portfolio_action',
]);
const timestampSchema = z.iso.datetime({ offset: true });
const lockOrderSchema = z.tuple([
  z.literal('idempotency_key'),
  z.literal('workspace'),
  z.literal('service_aggregate'),
  z.literal('provider_source'),
]);

const effectSetSchema = z.strictObject({
  lock_order: lockOrderSchema,
  domain_mutation: z.strictObject({
    count: z.literal(1),
    operation: operationSchema,
    aggregate_id: uuidSchema,
    provider_receipt_id: uuidSchema,
  }),
  audit: z.strictObject({
    count: z.literal(1),
    contract: z.literal('audit.events'),
    redaction: z.literal('metadata_only'),
  }),
  outbox: z.strictObject({
    count: z.literal(1),
    contract: z.literal('platform.outbox_events'),
    event_version: z.literal(1),
  }),
  idempotency: z.strictObject({
    count: z.literal(1),
    contract: z.literal('platform.idempotency_keys'),
    input_fingerprint: serviceReceiptFingerprintSchema,
  }),
  atomic: z.literal(true),
});

const persistenceContextSchema = z.strictObject({
  transaction_scope_id: uuidSchema,
  authority_decision_id: uuidSchema,
  authority_evaluated_at: timestampSchema,
  authority_rechecked_after_lock: z.literal(true),
  isolation_level: z.literal('serializable'),
});

const plannedDecisionSchema = z.strictObject({
  status: z.literal('planned'),
  code: z.literal('CONTRACT_PLAN_READY'),
  executable: z.literal(false),
  command_fingerprint: serviceReceiptFingerprintSchema,
  provider_receipt_id: uuidSchema,
  plan: z.strictObject({
    lock_order: lockOrderSchema,
    domain_mutation: z.strictObject({ operation: operationSchema, aggregate_id: uuidSchema }),
    audit: z.strictObject({ count: z.literal(1), contract: z.literal('audit.events'),
      redaction: z.literal('metadata_only') }),
    outbox: z.strictObject({ count: z.literal(1), contract: z.literal('platform.outbox_events'),
      event_version: z.literal(1) }),
    idempotency: z.strictObject({ count: z.literal(1), contract: z.literal('platform.idempotency_keys'),
      input_fingerprint: serviceReceiptFingerprintSchema }),
    atomic: z.literal(true),
  }),
});

export const serviceRuntimePersistenceIntentV1Schema = z.strictObject({
  contract: z.literal(SERVICE_RUNTIME_PERSISTENCE_CONTRACT),
  version: z.literal(1),
  acceptance: z.literal('contract_only'),
  executable: z.literal(false),
  transaction_scope_id: uuidSchema,
  isolation_level: z.literal('serializable'),
  workspace_id: uuidSchema,
  actor_reference_id: uuidSchema,
  authority_decision_id: uuidSchema,
  authority_version: serviceReceiptVersionSchema,
  authority_evaluated_at: timestampSchema,
  authority_rechecked_after_lock: z.literal(true),
  operation: operationSchema,
  aggregate_type: z.enum(['service_request', 'service_order']),
  aggregate_id: uuidSchema,
  idempotency_key: idempotencyKeySchema,
  input_fingerprint: serviceReceiptFingerprintSchema,
  provider_receipt_id: uuidSchema,
  effect_set: effectSetSchema,
});

export type ServiceRuntimePersistenceIntentV1 = z.infer<typeof serviceRuntimePersistenceIntentV1Schema>;

const effectReceiptSchema = z.strictObject({
  domain_mutation_id: uuidSchema,
  audit_event_id: uuidSchema,
  outbox_event_id: uuidSchema,
  idempotency_record_id: uuidSchema,
  domain_mutation_count: z.literal(1),
  audit_event_count: z.literal(1),
  outbox_event_count: z.literal(1),
  idempotency_record_count: z.literal(1),
});

export const serviceRuntimePersistenceReceiptV1Schema = z.strictObject({
  contract: z.literal(SERVICE_RUNTIME_PERSISTENCE_RECEIPT_CONTRACT),
  version: z.literal(1),
  receipt_id: uuidSchema,
  transaction_scope_id: uuidSchema,
  workspace_id: uuidSchema,
  actor_reference_id: uuidSchema,
  authority_decision_id: uuidSchema,
  authority_version: serviceReceiptVersionSchema,
  operation: operationSchema,
  aggregate_id: uuidSchema,
  idempotency_key: idempotencyKeySchema,
  input_fingerprint: serviceReceiptFingerprintSchema,
  provider_receipt_id: uuidSchema,
  state: z.literal('committed'),
  effects: effectReceiptSchema,
  committed_at: timestampSchema,
});

export type ServiceRuntimePersistenceReceiptV1 = z.infer<typeof serviceRuntimePersistenceReceiptV1Schema>;

const replayIdentityShape = {
  transaction_scope_id: uuidSchema,
  workspace_id: uuidSchema,
  actor_reference_id: uuidSchema,
  idempotency_key: idempotencyKeySchema,
  input_fingerprint: serviceReceiptFingerprintSchema,
} as const;

export const serviceRuntimeIdempotencyClaimV1Schema = z.discriminatedUnion('outcome', [
  z.strictObject({ outcome: z.literal('claimed'), ...replayIdentityShape,
    idempotency_record_id: uuidSchema, state: z.literal('pending') }),
  z.strictObject({ outcome: z.literal('exact_readback'), ...replayIdentityShape,
    idempotency_record_id: uuidSchema, receipt: serviceRuntimePersistenceReceiptV1Schema }),
  z.strictObject({ outcome: z.literal('changed_replay'), ...replayIdentityShape,
    idempotency_record_id: uuidSchema, stored_input_fingerprint: serviceReceiptFingerprintSchema }),
  z.strictObject({ outcome: z.literal('unknown_commit'), ...replayIdentityShape,
    idempotency_record_id: uuidSchema, recovery_required: z.literal(true) }),
]);

export type ServiceRuntimeIdempotencyClaimV1 = z.infer<typeof serviceRuntimeIdempotencyClaimV1Schema>;

export const serviceRuntimePersistencePortResultV1Schema = z.discriminatedUnion('outcome', [
  z.strictObject({ outcome: z.literal('committed'), replayed: z.literal(false),
    receipt: serviceRuntimePersistenceReceiptV1Schema }),
  z.strictObject({ outcome: z.literal('exact_replay'), replayed: z.literal(true),
    receipt: serviceRuntimePersistenceReceiptV1Schema }),
  z.strictObject({ outcome: z.literal('changed_replay'), ...replayIdentityShape,
    stored_input_fingerprint: serviceReceiptFingerprintSchema }),
  z.strictObject({ outcome: z.literal('unknown_commit'), ...replayIdentityShape,
    recovery_required: z.literal(true) }),
]);

export const serviceRuntimeUnknownCommitRecoveryRequestV1Schema = z.strictObject({
  contract: z.literal(SERVICE_RUNTIME_UNKNOWN_COMMIT_RECOVERY_CONTRACT),
  version: z.literal(1),
  transaction_scope_id: uuidSchema,
  workspace_id: uuidSchema,
  actor_reference_id: uuidSchema,
  idempotency_key: idempotencyKeySchema,
  input_fingerprint: serviceReceiptFingerprintSchema,
  recovery_attempt: z.number().int().positive().max(100).safe(),
});

export type ServiceRuntimeUnknownCommitRecoveryRequestV1 = z.infer<
  typeof serviceRuntimeUnknownCommitRecoveryRequestV1Schema
>;

export const serviceRuntimeUnknownCommitRecoveryResultV1Schema = z.discriminatedUnion('outcome', [
  z.strictObject({ outcome: z.literal('committed'), receipt: serviceRuntimePersistenceReceiptV1Schema }),
  z.strictObject({ outcome: z.literal('absent'), ...replayIdentityShape,
    retry_requires_fresh_authority_and_providers: z.literal(true) }),
  z.strictObject({ outcome: z.literal('pending'), ...replayIdentityShape,
    retry_allowed: z.literal(false) }),
  z.strictObject({ outcome: z.literal('changed_replay'), ...replayIdentityShape,
    stored_input_fingerprint: serviceReceiptFingerprintSchema }),
]);

/** Contract only. A real implementation must own one database transaction. */
export interface ServiceRuntimeAtomicPersistencePortV1 {
  executeAtomic(intent: ServiceRuntimePersistenceIntentV1): Promise<unknown>;
  recoverUnknownCommit(request: ServiceRuntimeUnknownCommitRecoveryRequestV1): Promise<unknown>;
}

export type ServiceRuntimePersistencePreparationV1 =
  | { status: 'prepared'; code: 'PERSISTENCE_CONTRACT_READY'; executable: false;
    intent: ServiceRuntimePersistenceIntentV1 }
  | { status: 'denied'; code: 'INVALID_PERSISTENCE_INPUT' | 'PERSISTENCE_PLAN_MISMATCH' };

export type ServiceRuntimePersistenceEvaluationV1 =
  | { status: 'verified'; code: 'ATOMIC_COMMIT_VERIFIED' | 'EXACT_REPLAY_VERIFIED'; executable: false;
    receipt: ServiceRuntimePersistenceReceiptV1 }
  | { status: 'conflict'; code: 'REPLAY_CONFLICT' }
  | { status: 'unknown'; code: 'COMMIT_OUTCOME_UNKNOWN' }
  | { status: 'denied'; code: 'PERSISTENCE_RESULT_UNAVAILABLE' | 'PERSISTENCE_BINDING_MISMATCH' };

export type ServiceRuntimeRecoveryEvaluationV1 =
  | { status: 'recovered'; code: 'COMMIT_RECOVERED'; executable: false;
    receipt: ServiceRuntimePersistenceReceiptV1 }
  | { status: 'absent'; code: 'RECOVERY_ABSENT_RECHECK_REQUIRED'; executable: false;
    retryable: true; requires_fresh_authority_and_providers: true }
  | { status: 'unknown'; code: 'COMMIT_OUTCOME_UNKNOWN'; retryable: false }
  | { status: 'conflict'; code: 'REPLAY_CONFLICT' }
  | { status: 'denied'; code: 'RECOVERY_RESULT_UNAVAILABLE' | 'RECOVERY_BINDING_MISMATCH' };

const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

function commandAggregate(command: ServiceRuntimeCommitCommandV1) {
  return command.operation === 'subject_link'
    ? { type: 'service_request' as const, id: command.intent.service_request_id }
    : { type: 'service_order' as const, id: command.intent.service_order_id };
}

export function prepareServiceRuntimePersistenceV1(
  commandInput: unknown,
  decisionInput: unknown,
  contextInput: unknown,
): ServiceRuntimePersistencePreparationV1 {
  const commandResult = serviceRuntimeCommitCommandV1Schema.safeParse(commandInput);
  const decisionResult = plannedDecisionSchema.safeParse(decisionInput);
  const contextResult = persistenceContextSchema.safeParse(contextInput);
  if (!commandResult.success || !decisionResult.success || !contextResult.success) {
    return { status: 'denied', code: 'INVALID_PERSISTENCE_INPUT' };
  }
  const command = commandResult.data;
  const decision = decisionResult.data;
  const context = contextResult.data;
  const fingerprint = fingerprintServiceProviderInput(command);
  const aggregate = commandAggregate(command);
  if (!sameId(context.transaction_scope_id, command.transaction_id)
    || decision.command_fingerprint !== fingerprint
    || decision.plan.idempotency.input_fingerprint !== fingerprint
    || decision.plan.domain_mutation.operation !== command.operation
    || !sameId(decision.plan.domain_mutation.aggregate_id, aggregate.id)
    || decision.plan.lock_order.some((value, index) => value !== SERVICE_RUNTIME_COMMIT_LOCK_ORDER[index])) {
    return { status: 'denied', code: 'PERSISTENCE_PLAN_MISMATCH' };
  }

  return {
    status: 'prepared',
    code: 'PERSISTENCE_CONTRACT_READY',
    executable: false,
    intent: serviceRuntimePersistenceIntentV1Schema.parse({
      contract: SERVICE_RUNTIME_PERSISTENCE_CONTRACT,
      version: 1,
      acceptance: 'contract_only',
      executable: false,
      transaction_scope_id: context.transaction_scope_id,
      isolation_level: context.isolation_level,
      workspace_id: command.intent.workspace_id,
      actor_reference_id: command.actor_reference_id,
      authority_decision_id: context.authority_decision_id,
      authority_version: command.expected_authority_version,
      authority_evaluated_at: context.authority_evaluated_at,
      authority_rechecked_after_lock: context.authority_rechecked_after_lock,
      operation: command.operation,
      aggregate_type: aggregate.type,
      aggregate_id: aggregate.id,
      idempotency_key: command.intent.idempotency_key,
      input_fingerprint: fingerprint,
      provider_receipt_id: decision.provider_receipt_id,
      effect_set: {
        lock_order: SERVICE_RUNTIME_COMMIT_LOCK_ORDER,
        domain_mutation: { count: 1, operation: command.operation, aggregate_id: aggregate.id,
          provider_receipt_id: decision.provider_receipt_id },
        audit: decision.plan.audit,
        outbox: decision.plan.outbox,
        idempotency: decision.plan.idempotency,
        atomic: true,
      },
    }),
  };
}

function receiptMatchesIntent(
  receipt: ServiceRuntimePersistenceReceiptV1,
  intent: ServiceRuntimePersistenceIntentV1,
) {
  return sameId(receipt.transaction_scope_id, intent.transaction_scope_id)
    && sameId(receipt.workspace_id, intent.workspace_id)
    && sameId(receipt.actor_reference_id, intent.actor_reference_id)
    && sameId(receipt.authority_decision_id, intent.authority_decision_id)
    && receipt.authority_version === intent.authority_version
    && receipt.operation === intent.operation
    && sameId(receipt.aggregate_id, intent.aggregate_id)
    && receipt.idempotency_key === intent.idempotency_key
    && receipt.input_fingerprint === intent.input_fingerprint
    && sameId(receipt.provider_receipt_id, intent.provider_receipt_id);
}

function replayIdentityMatches(
  value: z.infer<typeof serviceRuntimePersistencePortResultV1Schema>,
  intent: ServiceRuntimePersistenceIntentV1,
) {
  if (value.outcome === 'committed' || value.outcome === 'exact_replay') return true;
  return sameId(value.transaction_scope_id, intent.transaction_scope_id)
    && sameId(value.workspace_id, intent.workspace_id)
    && sameId(value.actor_reference_id, intent.actor_reference_id)
    && value.idempotency_key === intent.idempotency_key
    && value.input_fingerprint === intent.input_fingerprint;
}

/** Pure result validation; this function never calls the persistence port. */
export function evaluateServiceRuntimePersistenceResultV1(
  intentInput: unknown,
  resultInput: unknown,
): ServiceRuntimePersistenceEvaluationV1 {
  const intentResult = serviceRuntimePersistenceIntentV1Schema.safeParse(intentInput);
  const result = serviceRuntimePersistencePortResultV1Schema.safeParse(resultInput);
  if (!intentResult.success || !result.success) {
    return { status: 'denied', code: 'PERSISTENCE_RESULT_UNAVAILABLE' };
  }
  const intent = intentResult.data;
  const value = result.data;
  if (!replayIdentityMatches(value, intent)) {
    return { status: 'denied', code: 'PERSISTENCE_BINDING_MISMATCH' };
  }
  if (value.outcome === 'committed' || value.outcome === 'exact_replay') {
    if (!receiptMatchesIntent(value.receipt, intent)) {
      return { status: 'denied', code: 'PERSISTENCE_BINDING_MISMATCH' };
    }
    return { status: 'verified', code: value.outcome === 'committed'
      ? 'ATOMIC_COMMIT_VERIFIED' : 'EXACT_REPLAY_VERIFIED', executable: false, receipt: value.receipt };
  }
  if (value.outcome === 'changed_replay') {
    if (value.stored_input_fingerprint === intent.input_fingerprint) {
      return { status: 'denied', code: 'PERSISTENCE_BINDING_MISMATCH' };
    }
    return { status: 'conflict', code: 'REPLAY_CONFLICT' };
  }
  return { status: 'unknown', code: 'COMMIT_OUTCOME_UNKNOWN' };
}

function recoveryIdentityMatches(
  value: z.infer<typeof serviceRuntimeUnknownCommitRecoveryResultV1Schema>,
  request: ServiceRuntimeUnknownCommitRecoveryRequestV1,
) {
  if (value.outcome === 'committed') return receiptMatchesRecovery(value.receipt, request);
  return sameId(value.transaction_scope_id, request.transaction_scope_id)
    && sameId(value.workspace_id, request.workspace_id)
    && sameId(value.actor_reference_id, request.actor_reference_id)
    && value.idempotency_key === request.idempotency_key
    && value.input_fingerprint === request.input_fingerprint;
}

function receiptMatchesRecovery(
  receipt: ServiceRuntimePersistenceReceiptV1,
  request: ServiceRuntimeUnknownCommitRecoveryRequestV1,
) {
  return sameId(receipt.transaction_scope_id, request.transaction_scope_id)
    && sameId(receipt.workspace_id, request.workspace_id)
    && sameId(receipt.actor_reference_id, request.actor_reference_id)
    && receipt.idempotency_key === request.idempotency_key
    && receipt.input_fingerprint === request.input_fingerprint;
}

/** Pure recovery validation. An absent result requires fresh authority and provider checks before retry. */
export function evaluateServiceRuntimeUnknownCommitRecoveryV1(
  requestInput: unknown,
  resultInput: unknown,
): ServiceRuntimeRecoveryEvaluationV1 {
  const requestResult = serviceRuntimeUnknownCommitRecoveryRequestV1Schema.safeParse(requestInput);
  const result = serviceRuntimeUnknownCommitRecoveryResultV1Schema.safeParse(resultInput);
  if (!requestResult.success || !result.success) {
    return { status: 'denied', code: 'RECOVERY_RESULT_UNAVAILABLE' };
  }
  const request = requestResult.data;
  const value = result.data;
  if (!recoveryIdentityMatches(value, request)) {
    return { status: 'denied', code: 'RECOVERY_BINDING_MISMATCH' };
  }
  if (value.outcome === 'committed') {
    return { status: 'recovered', code: 'COMMIT_RECOVERED', executable: false, receipt: value.receipt };
  }
  if (value.outcome === 'absent') {
    return { status: 'absent', code: 'RECOVERY_ABSENT_RECHECK_REQUIRED', executable: false,
      retryable: true, requires_fresh_authority_and_providers: true };
  }
  if (value.outcome === 'changed_replay') {
    if (value.stored_input_fingerprint === request.input_fingerprint) {
      return { status: 'denied', code: 'RECOVERY_BINDING_MISMATCH' };
    }
    return { status: 'conflict', code: 'REPLAY_CONFLICT' };
  }
  return { status: 'unknown', code: 'COMMIT_OUTCOME_UNKNOWN', retryable: false };
}
