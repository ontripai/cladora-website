import { z } from 'zod';
import {
  adaptPortfolioServiceActionProjectionReceipt,
  adaptServiceDeliveryEvidenceReceipt,
  adaptServiceStageWorkOrderReceipt,
  adaptServiceSubjectLinkReceipt,
  serviceProviderAdapterAuthorityV1Schema,
  serviceStageWorkOrderAdapterIntentV1Schema,
} from './service-provider-adapter-contracts-v1';
import { serviceCollaborationIntentV1Schema } from './service-collaboration-v14-schema';
import { serviceDeliveryIntentV1Schema } from './service-delivery-v14-schema';
import { servicePortfolioActionIntentV1Schema } from './service-portfolio-v14-schema';
import {
  fingerprintServiceProviderInput,
  serviceReceiptFingerprintSchema,
  serviceReceiptVersionSchema,
} from './service-provider-receipt-v1-schema';
import { idempotencyKeySchema, uuidSchema } from './workspace-composition-schema';

export const SERVICE_RUNTIME_COMMIT_CONTRACT = 'service-runtime-commit-coordinator.v1' as const;
export const SERVICE_RUNTIME_COMMIT_LOCK_ORDER = [
  'idempotency_key',
  'workspace',
  'service_aggregate',
  'provider_source',
] as const;

const operationSchema = z.enum([
  'subject_link',
  'delivery_evidence',
  'stage_work_order',
  'portfolio_action',
]);

const commandBase = {
  contract: z.literal(SERVICE_RUNTIME_COMMIT_CONTRACT),
  transaction_id: uuidSchema,
  actor_reference_id: uuidSchema,
  expected_authority_version: serviceReceiptVersionSchema,
} as const;

export const serviceRuntimeCommitCommandV1Schema = z.discriminatedUnion('operation', [
  z.strictObject({ ...commandBase, operation: z.literal('subject_link'), intent: serviceCollaborationIntentV1Schema }),
  z.strictObject({ ...commandBase, operation: z.literal('delivery_evidence'), intent: serviceDeliveryIntentV1Schema }),
  z.strictObject({ ...commandBase, operation: z.literal('stage_work_order'), intent: serviceStageWorkOrderAdapterIntentV1Schema }),
  z.strictObject({ ...commandBase, operation: z.literal('portfolio_action'), intent: servicePortfolioActionIntentV1Schema }),
]);

export type ServiceRuntimeCommitCommandV1 = z.infer<typeof serviceRuntimeCommitCommandV1Schema>;

const replayRecordSchema = z.strictObject({
  state: z.enum(['pending', 'committed', 'unknown_commit']),
  operation: operationSchema,
  workspace_id: uuidSchema,
  actor_reference_id: uuidSchema,
  idempotency_key: idempotencyKeySchema,
  input_fingerprint: serviceReceiptFingerprintSchema,
  commit_receipt_id: uuidSchema.nullable(),
}).superRefine((value, ctx) => {
  if ((value.state === 'committed') !== (value.commit_receipt_id !== null)) {
    ctx.addIssue({ code: 'custom', path: ['commit_receipt_id'], message: 'committed_replay_requires_receipt_only' });
  }
});

export const serviceRuntimeCommitSnapshotV1Schema = z.strictObject({
  workspace_id: uuidSchema,
  acquired_locks: z.array(z.enum(SERVICE_RUNTIME_COMMIT_LOCK_ORDER)).max(SERVICE_RUNTIME_COMMIT_LOCK_ORDER.length),
  current_authority: serviceProviderAdapterAuthorityV1Schema,
  replay: replayRecordSchema.nullable(),
});

export type ServiceRuntimeCommitSnapshotV1 = z.infer<typeof serviceRuntimeCommitSnapshotV1Schema>;

const portBase = {
  acceptance: z.literal('contract_only'),
  receipt: z.unknown(),
} as const;

export const serviceCanonicalProviderPortResultV1Schema = z.discriminatedUnion('port', [
  z.strictObject({ ...portBase, port: z.literal('subject'), owner: z.literal('communications_documents'),
    source_contract: z.enum(['communication-request-receipt.v1', 'documents-reference-authority.v1']),
    contract: z.literal('service-subject-link-adapter.v1') }),
  z.strictObject({ ...portBase, port: z.literal('delivery_evidence'), owner: z.literal('documents_vault'),
    source_contract: z.literal('documents-delivery-evidence.v1'),
    contract: z.literal('service-delivery-evidence-receipt.v1') }),
  z.strictObject({ ...portBase, port: z.literal('stage_work_order'), owner: z.literal('operations_ops01'),
    source_contract: z.literal('operations-execution-request-receipt.v1'),
    contract: z.literal('service-order-stage-work-order-adapter.v1') }),
  z.strictObject({ ...portBase, port: z.literal('portfolio_action'), owner: z.literal('portfolio_pf01'),
    source_contract: z.literal('owner-portfolio-projection.v1'),
    contract: z.literal('portfolio-service-action-projection-receipt.v1') }),
]);

export type ServiceCanonicalProviderPortResultV1 = z.infer<typeof serviceCanonicalProviderPortResultV1Schema>;

export type ServiceRuntimeCanonicalProviderPortsV1 = {
  subject: (intent: Extract<ServiceRuntimeCommitCommandV1, { operation: 'subject_link' }>['intent']) => unknown;
  deliveryEvidence: (intent: Extract<ServiceRuntimeCommitCommandV1, { operation: 'delivery_evidence' }>['intent']) => unknown;
  stageWorkOrder: (intent: Extract<ServiceRuntimeCommitCommandV1, { operation: 'stage_work_order' }>['intent']) => unknown;
  portfolioAction: (intent: Extract<ServiceRuntimeCommitCommandV1, { operation: 'portfolio_action' }>['intent']) => unknown;
};

export type ServiceRuntimeCommitDecisionV1 =
  | {
    status: 'planned';
    code: 'CONTRACT_PLAN_READY';
    executable: false;
    command_fingerprint: string;
    provider_receipt_id: string;
    plan: {
      lock_order: typeof SERVICE_RUNTIME_COMMIT_LOCK_ORDER;
      domain_mutation: { operation: ServiceRuntimeCommitCommandV1['operation']; aggregate_id: string };
      audit: { count: 1; contract: 'audit.events'; redaction: 'metadata_only' };
      outbox: { count: 1; contract: 'platform.outbox_events'; event_version: 1 };
      idempotency: { count: 1; contract: 'platform.idempotency_keys'; input_fingerprint: string };
      atomic: true;
    };
  }
  | { status: 'replayed'; code: 'REPLAY_VERIFIED'; prior_commit_receipt_id: string; executable: false }
  | { status: 'denied' | 'conflict' | 'unknown'; code: string };

const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
const bounded = (status: 'denied' | 'conflict' | 'unknown', code: string): ServiceRuntimeCommitDecisionV1 => ({ status, code });

function commandWorkspace(command: ServiceRuntimeCommitCommandV1) {
  return command.intent.workspace_id;
}

function commandIdempotencyKey(command: ServiceRuntimeCommitCommandV1) {
  return command.intent.idempotency_key;
}

function commandAggregateId(command: ServiceRuntimeCommitCommandV1) {
  if (command.operation === 'subject_link') return command.intent.service_request_id;
  return command.intent.service_order_id;
}

function exactLockOrder(locks: ServiceRuntimeCommitSnapshotV1['acquired_locks']) {
  return locks.length === SERVICE_RUNTIME_COMMIT_LOCK_ORDER.length
    && locks.every((lock, index) => lock === SERVICE_RUNTIME_COMMIT_LOCK_ORDER[index]);
}

/**
 * Creates a pure contract planner over injected canonical provider ports. It
 * executes no database, network, audit, outbox, or idempotency write. Even a
 * successful result is explicitly non-executable until every runtime port and
 * the atomic persistence boundary receive separate acceptance.
 */
export function createServiceRuntimeCommitCoordinatorV1(ports: ServiceRuntimeCanonicalProviderPortsV1) {
  return function planServiceRuntimeCommitV1(
    commandInput: unknown,
    snapshotInput: unknown,
  ): ServiceRuntimeCommitDecisionV1 {
    const commandResult = serviceRuntimeCommitCommandV1Schema.safeParse(commandInput);
    const snapshotResult = serviceRuntimeCommitSnapshotV1Schema.safeParse(snapshotInput);
    if (!commandResult.success || !snapshotResult.success) return bounded('denied', 'INVALID_COMMIT_INPUT');
    const command = commandResult.data;
    const snapshot = snapshotResult.data;
    if (command.operation === 'delivery_evidence' && command.intent.action !== 'record_delivery') {
      return bounded('denied', 'PROVIDER_NOT_REQUIRED_FOR_ACTION');
    }
    if (!sameId(commandWorkspace(command), snapshot.workspace_id)) return bounded('denied', 'WORKSPACE_MISMATCH');
    if (!exactLockOrder(snapshot.acquired_locks)) return bounded('denied', 'LOCK_ORDER_VIOLATION');
    if (snapshot.current_authority.outcome !== 'allowed') return bounded('denied', 'AUTHORITY_REVOKED');
    if (!sameId(snapshot.current_authority.actor_reference_id, command.actor_reference_id)
      || snapshot.current_authority.authority_version !== command.expected_authority_version) {
      return bounded('denied', 'AUTHORITY_STALE');
    }

    const inputFingerprint = fingerprintServiceProviderInput(command);
    const replay = snapshot.replay;
    if (replay !== null) {
      if (replay.operation !== command.operation
        || !sameId(replay.workspace_id, commandWorkspace(command))
        || !sameId(replay.actor_reference_id, command.actor_reference_id)
        || replay.idempotency_key !== commandIdempotencyKey(command)
        || replay.input_fingerprint !== inputFingerprint) return bounded('conflict', 'REPLAY_CONFLICT');
      if (replay.state === 'committed' && replay.commit_receipt_id !== null) {
        return { status: 'replayed', code: 'REPLAY_VERIFIED', prior_commit_receipt_id: replay.commit_receipt_id,
          executable: false };
      }
      return bounded('unknown', 'COMMIT_OUTCOME_UNKNOWN');
    }

    let rawPortResult: unknown;
    try {
      if (command.operation === 'subject_link') rawPortResult = ports.subject(command.intent);
      else if (command.operation === 'delivery_evidence') rawPortResult = ports.deliveryEvidence(command.intent);
      else if (command.operation === 'stage_work_order') rawPortResult = ports.stageWorkOrder(command.intent);
      else rawPortResult = ports.portfolioAction(command.intent);
    } catch {
      return bounded('unknown', 'PROVIDER_RESULT_UNKNOWN');
    }
    const portResult = serviceCanonicalProviderPortResultV1Schema.safeParse(rawPortResult);
    if (!portResult.success) return bounded('denied', 'PROVIDER_PORT_UNAVAILABLE');
    const port = portResult.data;

    let adapterDecision;
    if (command.operation === 'subject_link' && port.port === 'subject') {
      adapterDecision = adaptServiceSubjectLinkReceipt(command.intent, snapshot.current_authority, port.receipt);
    } else if (command.operation === 'delivery_evidence' && command.intent.action === 'record_delivery'
      && port.port === 'delivery_evidence') {
      adapterDecision = adaptServiceDeliveryEvidenceReceipt(command.intent, snapshot.current_authority, port.receipt);
    } else if (command.operation === 'stage_work_order' && port.port === 'stage_work_order') {
      adapterDecision = adaptServiceStageWorkOrderReceipt(command.intent, snapshot.current_authority, port.receipt);
    } else if (command.operation === 'portfolio_action' && port.port === 'portfolio_action') {
      adapterDecision = adaptPortfolioServiceActionProjectionReceipt(command.intent, snapshot.current_authority, port.receipt);
    } else {
      return bounded('denied', 'PROVIDER_PORT_MISMATCH');
    }
    if (adapterDecision.status !== 'verified') return bounded(adapterDecision.status, adapterDecision.code);

    return {
      status: 'planned',
      code: 'CONTRACT_PLAN_READY',
      executable: false,
      command_fingerprint: inputFingerprint,
      provider_receipt_id: adapterDecision.receipt.receipt_id,
      plan: {
        lock_order: SERVICE_RUNTIME_COMMIT_LOCK_ORDER,
        domain_mutation: { operation: command.operation, aggregate_id: commandAggregateId(command) },
        audit: { count: 1, contract: 'audit.events', redaction: 'metadata_only' },
        outbox: { count: 1, contract: 'platform.outbox_events', event_version: 1 },
        idempotency: { count: 1, contract: 'platform.idempotency_keys', input_fingerprint: inputFingerprint },
        atomic: true,
      },
    };
  };
}

export const serviceRuntimeCommitStateV1Schema = z.strictObject({
  phase: z.enum([
    'idle',
    'locks_acquired',
    'authority_rechecked',
    'providers_verified',
    'effects_staged',
    'unknown_commit',
    'committed',
    'rolled_back',
  ]),
  effects_observation: z.enum(['none', 'staged_not_written', 'unknown', 'committed_once']),
  retryable: z.boolean(),
});

export type ServiceRuntimeCommitStateV1 = z.infer<typeof serviceRuntimeCommitStateV1Schema>;

export const serviceRuntimeCommitEventV1Schema = z.discriminatedUnion('event', [
  z.strictObject({ event: z.literal('acquire_locks'), lock_order: z.array(z.enum(SERVICE_RUNTIME_COMMIT_LOCK_ORDER)) }),
  z.strictObject({ event: z.literal('authority_allowed') }),
  z.strictObject({ event: z.literal('providers_verified') }),
  z.strictObject({ event: z.literal('stage_effects') }),
  z.strictObject({ event: z.literal('commit_acknowledged') }),
  z.strictObject({ event: z.literal('connection_lost_after_commit_attempt') }),
  z.strictObject({ event: z.literal('recovery_committed') }),
  z.strictObject({ event: z.literal('recovery_absent') }),
  z.strictObject({ event: z.literal('deny') }),
]);

export type ServiceRuntimeCommitEventV1 = z.infer<typeof serviceRuntimeCommitEventV1Schema>;

export type ServiceRuntimeCommitTransitionV1 =
  | { status: 'advanced'; state: ServiceRuntimeCommitStateV1 }
  | { status: 'denied'; code: 'INVALID_STATE_TRANSITION'; state: ServiceRuntimeCommitStateV1 };

const state = (
  phase: ServiceRuntimeCommitStateV1['phase'],
  effects: ServiceRuntimeCommitStateV1['effects_observation'],
  retryable = false,
): ServiceRuntimeCommitTransitionV1 => ({
  status: 'advanced',
  state: { phase, effects_observation: effects, retryable },
});

/** Models transaction visibility only; it never performs an effect. */
export function transitionServiceRuntimeCommitV1(
  stateInput: unknown,
  eventInput: unknown,
): ServiceRuntimeCommitTransitionV1 {
  const current = serviceRuntimeCommitStateV1Schema.safeParse(stateInput);
  const event = serviceRuntimeCommitEventV1Schema.safeParse(eventInput);
  const fallback: ServiceRuntimeCommitStateV1 = current.success
    ? current.data : { phase: 'rolled_back', effects_observation: 'none', retryable: false };
  if (!current.success || !event.success) return { status: 'denied', code: 'INVALID_STATE_TRANSITION', state: fallback };
  if (event.data.event === 'deny' && !['committed', 'unknown_commit'].includes(current.data.phase)) {
    return state('rolled_back', 'none');
  }
  if (current.data.phase === 'idle' && event.data.event === 'acquire_locks'
    && exactLockOrder(event.data.lock_order)) return state('locks_acquired', 'none');
  if (current.data.phase === 'locks_acquired' && event.data.event === 'authority_allowed') {
    return state('authority_rechecked', 'none');
  }
  if (current.data.phase === 'authority_rechecked' && event.data.event === 'providers_verified') {
    return state('providers_verified', 'none');
  }
  if (current.data.phase === 'providers_verified' && event.data.event === 'stage_effects') {
    return state('effects_staged', 'staged_not_written');
  }
  if (current.data.phase === 'effects_staged' && event.data.event === 'commit_acknowledged') {
    return state('committed', 'committed_once');
  }
  if (current.data.phase === 'effects_staged' && event.data.event === 'connection_lost_after_commit_attempt') {
    return state('unknown_commit', 'unknown');
  }
  if (current.data.phase === 'unknown_commit' && event.data.event === 'recovery_committed') {
    return state('committed', 'committed_once');
  }
  if (current.data.phase === 'unknown_commit' && event.data.event === 'recovery_absent') {
    return state('rolled_back', 'none', true);
  }
  return { status: 'denied', code: 'INVALID_STATE_TRANSITION', state: current.data };
}
