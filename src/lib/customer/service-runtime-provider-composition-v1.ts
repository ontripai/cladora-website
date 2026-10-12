import { z } from 'zod';
import {
  currentAuthorityTransactionDecisionReceiptV1Schema,
  currentAuthorityTransactionRequestV1Schema,
  type CurrentAuthorityTransactionDecisionReceiptV1,
  type CurrentAuthorityTransactionRequestV1,
  type CurrentAuthorityTransactionalPortV1,
} from '../core/current-authority-transaction-port-v1';
import {
  createServiceRuntimeCommitCoordinatorV1,
  SERVICE_RUNTIME_COMMIT_LOCK_ORDER,
  serviceRuntimeCommitCommandV1Schema,
  serviceRuntimeCommitSnapshotV1Schema,
  type ServiceRuntimeCanonicalProviderPortsV1,
  type ServiceRuntimeCommitCommandV1,
  type ServiceRuntimeCommitDecisionV1,
} from './service-runtime-commit-coordinator-v1';
import { uuidSchema } from './workspace-composition-schema';

export const SERVICE_CURRENT_AUTHORITY_BINDING_V1 = {
  permission_code: 'services.orders.request',
  module_code: 'services_orders',
  evaluation_purpose: 'service.order.transition',
} as const;

const timestampSchema = z.iso.datetime({ offset: true });

const authorityContextSchema = z.strictObject({
  decision_id: uuidSchema,
  command_id: uuidSchema,
  attempt: z.number().int().positive().max(100).safe(),
  isolation_level: z.enum(['read_committed', 'repeatable_read', 'serializable']),
  lock_acquired_at: timestampSchema,
});

export const serviceRuntimeProviderCompositionSnapshotV1Schema = serviceRuntimeCommitSnapshotV1Schema
  .omit({ current_authority: true })
  .extend({ authority_context: authorityContextSchema });

export type ServiceRuntimeProviderCompositionSnapshotV1 = z.infer<
  typeof serviceRuntimeProviderCompositionSnapshotV1Schema
>;

export type ServiceRuntimeProviderCompositionPortsV1 = {
  currentAuthority: CurrentAuthorityTransactionalPortV1;
  canonicalProviders: ServiceRuntimeCanonicalProviderPortsV1;
};

const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

const bounded = (
  status: 'denied' | 'conflict' | 'unknown',
  code: string,
): ServiceRuntimeCommitDecisionV1 => ({ status, code });

function commandWorkspace(command: ServiceRuntimeCommitCommandV1) {
  return command.intent.workspace_id;
}

function commandAggregate(command: ServiceRuntimeCommitCommandV1) {
  return command.operation === 'subject_link'
    ? { type: 'service_request', id: command.intent.service_request_id }
    : { type: 'service_order', id: command.intent.service_order_id };
}

function exactLockOrder(locks: ServiceRuntimeProviderCompositionSnapshotV1['acquired_locks']) {
  return locks.length === SERVICE_RUNTIME_COMMIT_LOCK_ORDER.length
    && locks.every((lock, index) => lock === SERVICE_RUNTIME_COMMIT_LOCK_ORDER[index]);
}

function buildAuthorityRequest(
  command: ServiceRuntimeCommitCommandV1,
  snapshot: ServiceRuntimeProviderCompositionSnapshotV1,
): CurrentAuthorityTransactionRequestV1 {
  const aggregate = commandAggregate(command);
  return currentAuthorityTransactionRequestV1Schema.parse({
    contract_version: 'core-current-authority-transaction-port-request.v1',
    decision_id: snapshot.authority_context.decision_id,
    context_id: command.intent.context_id,
    workspace_id: commandWorkspace(command),
    actor_id: command.actor_reference_id,
    authority_version: command.expected_authority_version,
    ...SERVICE_CURRENT_AUTHORITY_BINDING_V1,
    transaction_context: {
      transaction_id: command.transaction_id,
      command_id: snapshot.authority_context.command_id,
      attempt: snapshot.authority_context.attempt,
      isolation_level: snapshot.authority_context.isolation_level,
      lock: {
        kind: 'command_aggregate',
        workspace_id: commandWorkspace(command),
        aggregate_type: aggregate.type,
        aggregate_id: aggregate.id,
        acquired_at: snapshot.authority_context.lock_acquired_at,
      },
    },
  });
}

function receiptMatchesRequest(
  receipt: CurrentAuthorityTransactionDecisionReceiptV1,
  request: CurrentAuthorityTransactionRequestV1,
) {
  const transaction = receipt.transaction_context;
  const expected = request.transaction_context;
  return sameId(receipt.decision_id, request.decision_id)
    && sameId(receipt.context_id, request.context_id)
    && sameId(receipt.workspace_id, request.workspace_id)
    && sameId(receipt.actor_id, request.actor_id)
    && receipt.authority_version === request.authority_version
    && receipt.permission_code === request.permission_code
    && receipt.module_code === request.module_code
    && receipt.evaluation_purpose === request.evaluation_purpose
    && sameId(transaction.transaction_id, expected.transaction_id)
    && sameId(transaction.command_id, expected.command_id)
    && transaction.attempt === expected.attempt
    && transaction.isolation_level === expected.isolation_level
    && transaction.lock.kind === expected.lock.kind
    && sameId(transaction.lock.workspace_id, expected.lock.workspace_id)
    && transaction.lock.aggregate_type === expected.lock.aggregate_type
    && sameId(transaction.lock.aggregate_id, expected.lock.aggregate_id)
    && Date.parse(transaction.lock.acquired_at) === Date.parse(expected.lock.acquired_at)
    && Date.parse(receipt.evaluated_at) >= Date.parse(expected.lock.acquired_at);
}

function authorityDenial(receipt: CurrentAuthorityTransactionDecisionReceiptV1) {
  if (receipt.decision !== 'denied') return null;
  if (receipt.denial_reason === 'ACTOR_REVOKED') return bounded('denied', 'AUTHORITY_REVOKED');
  if (receipt.denial_reason === 'STALE_AUTHORITY_VERSION') return bounded('denied', 'AUTHORITY_STALE');
  return bounded('denied', 'AUTHORITY_DENIED');
}

/**
 * Composes the contract-only SERVICE coordinator with the injected Core
 * transactional authority port and the four injected canonical provider ports.
 * It contains no provider implementation or I/O and cannot execute its plan.
 */
export function createServiceRuntimeProviderCompositionV1(
  ports: ServiceRuntimeProviderCompositionPortsV1,
) {
  const coordinator = createServiceRuntimeCommitCoordinatorV1(ports.canonicalProviders);

  return async function composeServiceRuntimeCommitV1(
    commandInput: unknown,
    snapshotInput: unknown,
  ): Promise<ServiceRuntimeCommitDecisionV1> {
    const commandResult = serviceRuntimeCommitCommandV1Schema.safeParse(commandInput);
    const snapshotResult = serviceRuntimeProviderCompositionSnapshotV1Schema.safeParse(snapshotInput);
    if (!commandResult.success || !snapshotResult.success) return bounded('denied', 'INVALID_COMMIT_INPUT');
    const command = commandResult.data;
    const snapshot = snapshotResult.data;

    if (!sameId(commandWorkspace(command), snapshot.workspace_id)) {
      return bounded('denied', 'WORKSPACE_MISMATCH');
    }
    if (!exactLockOrder(snapshot.acquired_locks)) return bounded('denied', 'LOCK_ORDER_VIOLATION');

    const authorityRequest = buildAuthorityRequest(command, snapshot);
    let authorityValue: unknown;
    try {
      authorityValue = await ports.currentAuthority.recheckAfterLock(authorityRequest);
    } catch {
      return bounded('unknown', 'AUTHORITY_RESULT_UNKNOWN');
    }
    const authorityResult = currentAuthorityTransactionDecisionReceiptV1Schema.safeParse(authorityValue);
    if (!authorityResult.success) return bounded('denied', 'AUTHORITY_PORT_UNAVAILABLE');
    const authorityReceipt = authorityResult.data;
    if (!receiptMatchesRequest(authorityReceipt, authorityRequest)) {
      return bounded('denied', 'AUTHORITY_BINDING_MISMATCH');
    }
    const denial = authorityDenial(authorityReceipt);
    if (denial !== null) return denial;

    return coordinator(command, {
      workspace_id: snapshot.workspace_id,
      acquired_locks: snapshot.acquired_locks,
      current_authority: {
        actor_reference_id: authorityReceipt.actor_id,
        authority_version: authorityReceipt.authority_version,
        outcome: 'allowed',
      },
      replay: snapshot.replay,
    });
  };
}
