import { z } from 'zod';
import { uuidSchema } from '../customer/workspace-composition-schema.ts';

const timestampSchema = z.string().datetime({ offset: true });
const codeSchema = z.string().regex(/^[a-z0-9_.:-]{3,160}$/);
const authorityVersionSchema = z.number().int().positive().safe();

export const currentAuthorityTransactionDenialReasonV1Schema = z.enum([
  'CROSS_WORKSPACE',
  'TRANSACTION_CONTEXT_MISMATCH',
  'AUTHORITY_BINDING_MISMATCH',
  'ACTOR_REVOKED',
  'STALE_AUTHORITY_VERSION',
  'RECHECK_BEFORE_LOCK',
  'AUTHORITY_DENIED',
]);

export const currentAuthorityTransactionContextV1Schema = z.strictObject({
  transaction_id: uuidSchema,
  command_id: uuidSchema,
  attempt: z.number().int().positive().max(100).safe(),
  isolation_level: z.enum(['read_committed', 'repeatable_read', 'serializable']),
  lock: z.strictObject({
    kind: z.literal('command_aggregate'),
    workspace_id: uuidSchema,
    aggregate_type: codeSchema,
    aggregate_id: uuidSchema,
    acquired_at: timestampSchema,
  }),
});

export const currentAuthorityTransactionRequestV1Schema = z.strictObject({
  contract_version: z.literal('core-current-authority-transaction-port-request.v1'),
  decision_id: uuidSchema,
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  actor_id: uuidSchema,
  authority_version: authorityVersionSchema,
  permission_code: codeSchema,
  module_code: codeSchema,
  evaluation_purpose: codeSchema,
  transaction_context: currentAuthorityTransactionContextV1Schema,
});

export const canonicalCurrentAuthorityObservationV1Schema = z.strictObject({
  contract_version: z.literal('core-current-authority-observation.v1'),
  source_contract: z.literal('workspace-native-effective-authority.v2'),
  decision_id: uuidSchema,
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  actor_id: uuidSchema,
  authority_version: authorityVersionSchema,
  permission_code: codeSchema,
  module_code: codeSchema,
  transaction_context: currentAuthorityTransactionContextV1Schema,
  evaluator: z.literal('app_private.check_workspace_native_permission_v2'),
  source_disclosure: z.literal('status_only'),
  source_reference: z.null(),
  actor_status: z.enum(['current', 'revoked']),
  decision: z.enum(['allowed', 'denied']),
  evaluated_at: timestampSchema,
});

const decisionReceiptBaseV1Schema = z.strictObject({
  contract_version: z.literal('core-current-authority-decision-receipt.v1'),
  receipt_version: z.literal(1),
  decision_id: uuidSchema,
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  actor_id: uuidSchema,
  authority_version: authorityVersionSchema,
  permission_code: codeSchema,
  module_code: codeSchema,
  evaluation_purpose: codeSchema,
  transaction_context: currentAuthorityTransactionContextV1Schema,
  evaluator: z.literal('app_private.check_workspace_native_permission_v2'),
  source_disclosure: z.literal('status_only'),
  source_reference: z.null(),
  evaluated_at: timestampSchema,
  rechecked_after_lock: z.boolean(),
  transaction_bound: z.literal(true),
  reusable_as_command_authority: z.literal(false),
  current_authority_recheck_required_on_retry: z.literal(true),
});

const currentAuthorityTransactionAllowedReceiptV1Schema = decisionReceiptBaseV1Schema.extend({
  decision: z.literal('allowed'),
  denial_reason: z.null(),
  rechecked_after_lock: z.literal(true),
});

const currentAuthorityTransactionDeniedReceiptV1Schema = decisionReceiptBaseV1Schema.extend({
  decision: z.literal('denied'),
  denial_reason: currentAuthorityTransactionDenialReasonV1Schema,
});

export const currentAuthorityTransactionDecisionReceiptV1Schema = z.discriminatedUnion('decision', [
  currentAuthorityTransactionAllowedReceiptV1Schema,
  currentAuthorityTransactionDeniedReceiptV1Schema,
]);

export type CurrentAuthorityTransactionRequestV1 = z.infer<
  typeof currentAuthorityTransactionRequestV1Schema
>;
export type CanonicalCurrentAuthorityObservationV1 = z.infer<
  typeof canonicalCurrentAuthorityObservationV1Schema
>;
export type CurrentAuthorityTransactionDecisionReceiptV1 = z.infer<
  typeof currentAuthorityTransactionDecisionReceiptV1Schema
>;
export type CurrentAuthorityTransactionDenialReasonV1 = z.infer<
  typeof currentAuthorityTransactionDenialReasonV1Schema
>;

/**
 * Runtime boundary for a future provider. Implementations must resolve the
 * canonical Core authority inside the command transaction after its lock.
 * This contract intentionally provides no store, projection, or provider.
 */
export interface CurrentAuthorityTransactionalPortV1 {
  recheckAfterLock(
    request: CurrentAuthorityTransactionRequestV1,
  ): Promise<CurrentAuthorityTransactionDecisionReceiptV1>;
}

function requestBoundReceipt(
  request: CurrentAuthorityTransactionRequestV1,
  observation: CanonicalCurrentAuthorityObservationV1,
) {
  return {
    contract_version: 'core-current-authority-decision-receipt.v1' as const,
    receipt_version: 1 as const,
    decision_id: request.decision_id,
    context_id: request.context_id,
    workspace_id: request.workspace_id,
    actor_id: request.actor_id,
    authority_version: request.authority_version,
    permission_code: request.permission_code,
    module_code: request.module_code,
    evaluation_purpose: request.evaluation_purpose,
    transaction_context: request.transaction_context,
    evaluator: 'app_private.check_workspace_native_permission_v2' as const,
    source_disclosure: 'status_only' as const,
    source_reference: null,
    evaluated_at: observation.evaluated_at,
    rechecked_after_lock:
      Date.parse(observation.evaluated_at) >= Date.parse(request.transaction_context.lock.acquired_at),
    transaction_bound: true as const,
    reusable_as_command_authority: false as const,
    current_authority_recheck_required_on_retry: true as const,
  };
}

function transactionContextsMatch(
  request: CurrentAuthorityTransactionRequestV1['transaction_context'],
  observation: CanonicalCurrentAuthorityObservationV1['transaction_context'],
) {
  return observation.transaction_id === request.transaction_id
    && observation.command_id === request.command_id
    && observation.attempt === request.attempt
    && observation.isolation_level === request.isolation_level
    && observation.lock.kind === request.lock.kind
    && observation.lock.workspace_id === request.lock.workspace_id
    && observation.lock.aggregate_type === request.lock.aggregate_type
    && observation.lock.aggregate_id === request.lock.aggregate_id
    && Date.parse(observation.lock.acquired_at) === Date.parse(request.lock.acquired_at);
}

export function bindCanonicalCurrentAuthorityObservationV1(
  requestValue: CurrentAuthorityTransactionRequestV1,
  observationValue: CanonicalCurrentAuthorityObservationV1,
): CurrentAuthorityTransactionDecisionReceiptV1 {
  const request = currentAuthorityTransactionRequestV1Schema.parse(requestValue);
  const observation = canonicalCurrentAuthorityObservationV1Schema.parse(observationValue);
  const base = requestBoundReceipt(request, observation);

  let denialReason: CurrentAuthorityTransactionDenialReasonV1 | null = null;

  if (
    request.transaction_context.lock.workspace_id !== request.workspace_id
    || observation.workspace_id !== request.workspace_id
    || observation.transaction_context.lock.workspace_id !== request.workspace_id
  ) {
    denialReason = 'CROSS_WORKSPACE';
  } else if (!transactionContextsMatch(request.transaction_context, observation.transaction_context)) {
    denialReason = 'TRANSACTION_CONTEXT_MISMATCH';
  } else if (
    observation.decision_id !== request.decision_id
    || observation.context_id !== request.context_id
    || observation.actor_id !== request.actor_id
    || observation.permission_code !== request.permission_code
    || observation.module_code !== request.module_code
  ) {
    denialReason = 'AUTHORITY_BINDING_MISMATCH';
  } else if (observation.actor_status === 'revoked') {
    denialReason = 'ACTOR_REVOKED';
  } else if (observation.authority_version !== request.authority_version) {
    denialReason = 'STALE_AUTHORITY_VERSION';
  } else if (!base.rechecked_after_lock) {
    denialReason = 'RECHECK_BEFORE_LOCK';
  } else if (observation.decision === 'denied') {
    denialReason = 'AUTHORITY_DENIED';
  }

  return currentAuthorityTransactionDecisionReceiptV1Schema.parse(
    denialReason === null
      ? { ...base, decision: 'allowed', denial_reason: null }
      : { ...base, decision: 'denied', denial_reason: denialReason },
  );
}
