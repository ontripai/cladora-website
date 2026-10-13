import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import {
  communicationsPrivateMessageRequestAudienceProviderCodeV1,
  resolveCommunicationsPrivateMessageRequestAudienceV1,
} from '../core/communications-private-message-request-audience-provider-v1';
import { resolveAuthority } from '../core/current-authority-postgres-provider-v1';
import {
  coreTransactionCommandV2Schema,
  type CoreTransactionCommandV2,
  type CoreTransactionProvidersV2,
  type CoreTransactionScopeV1,
} from '../core/postgres-transaction-host-v1';
import type { CurrentAuthorityTransactionDecisionReceiptV1 } from '../core/current-authority-transaction-port-v1';
import { coreTransactionProviderEvidenceV1Schema,
  type CoreTransactionProviderEvidenceV1 } from '../core/transaction-provider-evidence-v1';
import {
  fingerprintServiceProviderInput,
  serviceCollaborationIntentV1Schema,
  type ServiceCollaborationIntentV1,
} from './service-collaboration-v14-schema';

export const SERVICE_SUBJECT_LINK_CORE_BINDING_V1 = Object.freeze({
  permission_code: 'services.orders.subject_link',
  module_code: 'services_orders',
  evaluation_purpose: 'service.request.subject_link',
  aggregate_type: 'service_request',
} as const);

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const commandContextSchema = z.strictObject({
  transaction_id: uuid,
  command_id: uuid,
  actor_id: uuid,
  authority_version: z.number().int().positive().safe(),
});
export type ServiceSubjectLinkCommandContextV1 = z.input<typeof commandContextSchema>;

/**
 * Maps the existing collaboration intent onto the merged Core V2 command.
 * This adds no second SERVICE command or receipt contract.
 */
export function buildServiceSubjectLinkCoreCommandV1(
  intentInput: ServiceCollaborationIntentV1,
  contextInput: ServiceSubjectLinkCommandContextV1,
): CoreTransactionCommandV2 {
  const intent = serviceCollaborationIntentV1Schema.parse(intentInput);
  const context = commandContextSchema.parse(contextInput);
  if (intent.reference_kind !== 'message' || intent.relation !== 'conversation') {
    throw new Error('private_message_conversation_required');
  }
  return coreTransactionCommandV2Schema.parse({
    contract_version: 'core-transaction-command.v2',
    transaction_id: context.transaction_id,
    command_id: context.command_id,
    context_id: intent.context_id,
    workspace_id: intent.workspace_id,
    actor_id: context.actor_id,
    authority_version: context.authority_version,
    ...SERVICE_SUBJECT_LINK_CORE_BINDING_V1,
    aggregate_id: intent.service_request_id,
    // Core records the resulting aggregate version. Providers and the domain
    // CAS derive the locked current version as aggregate_version - 1.
    aggregate_version: intent.expected_request_version + 1,
    provider_source_ids: [intent.reference_id],
    idempotency_key: intent.idempotency_key,
    input_fingerprint: fingerprintServiceProviderInput(intent),
    subject_reference: {
      kind: 'message',
      id: intent.reference_id,
      version: intent.source_version,
      relation: 'subject_link',
      request_version: intent.source_version,
    },
  });
}

function commandIntent(command: CoreTransactionCommandV2) {
  return serviceCollaborationIntentV1Schema.safeParse({
    context_id: command.context_id,
    workspace_id: command.workspace_id,
    service_request_id: command.aggregate_id,
    expected_request_version: command.aggregate_version - 1,
    reference_kind: command.subject_reference.kind,
    reference_id: command.subject_reference.id,
    source_version: command.subject_reference.version,
    relation: command.subject_reference.relation === 'subject_link' ? 'conversation' : command.subject_reference.relation,
    idempotency_key: command.idempotency_key,
  });
}

function commandMatchesBinding(command: CoreTransactionCommandV2) {
  const intent = commandIntent(command);
  return intent.success
    && command.permission_code === SERVICE_SUBJECT_LINK_CORE_BINDING_V1.permission_code
    && command.module_code === SERVICE_SUBJECT_LINK_CORE_BINDING_V1.module_code
    && command.evaluation_purpose === SERVICE_SUBJECT_LINK_CORE_BINDING_V1.evaluation_purpose
    && command.aggregate_type === SERVICE_SUBJECT_LINK_CORE_BINDING_V1.aggregate_type
    && command.aggregate_version === intent.data.expected_request_version + 1
    && command.subject_reference.request_version === intent.data.source_version
    && command.provider_source_ids.length === 1
    && command.provider_source_ids[0] === intent.data.reference_id
    && command.input_fingerprint === fingerprintServiceProviderInput(intent.data);
}

function evidence(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  evaluatedAt: string,
  decision: 'accepted' | 'denied',
  denialReason: 'STALE_SUBJECT' | 'RELATION_MISMATCH' | 'SUBJECT_DENIED' | 'PROVIDER_UNAVAILABLE' | null,
): CoreTransactionProviderEvidenceV1 {
  return coreTransactionProviderEvidenceV1Schema.parse({
    contract_version: 'core-transaction-provider-evidence.v1',
    evidence_id: randomUUID(),
    provider_code: communicationsPrivateMessageRequestAudienceProviderCodeV1,
    transaction_id: command.transaction_id,
    command_id: command.command_id,
    workspace_id: scope.workspace_id,
    actor_id: scope.actor_id,
    context_id: command.context_id,
    authority_decision_id: authority.decision_id,
    authority_version: authority.authority_version,
    attempt: scope.attempt,
    subject_reference: command.subject_reference,
    evaluated_at: evaluatedAt,
    source_disclosure: 'status_only',
    source_reference: null,
    decision,
    denial_reason: denialReason,
    ...(decision === 'accepted'
      ? { reference_state: 'available' as const, current_actor_can_read: true as const }
      : {}),
  });
}

async function validateServiceSubjectLinkV1(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
): Promise<CoreTransactionProviderEvidenceV1> {
  if (!commandMatchesBinding(command)) {
    return evidence(scope, command, authority, authority.evaluated_at,
      'denied', 'RELATION_MISMATCH');
  }
  return resolveCommunicationsPrivateMessageRequestAudienceV1(scope, command, authority);
}

async function mutateServiceSubjectLinkV1(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV2,
): Promise<{ mutation_id: string }> {
  if (!commandMatchesBinding(command)) throw new Error('service_subject_link_binding_mismatch');
  const intent = commandIntent(command);
  if (!intent.success) throw new Error('service_subject_link_binding_mismatch');
  const result = await scope.query<{ mutation_id: string }>(`select
      app_private.insert_service_request_message_link_v1($1,$2,$3,$4,$5,$6,$7)::text
        as mutation_id`, [
    intent.data.context_id,
    intent.data.workspace_id,
    scope.actor_id,
    intent.data.service_request_id,
    intent.data.expected_request_version,
    intent.data.reference_id,
    intent.data.source_version,
  ]);
  const mutationId = uuid.safeParse(result.rows[0]?.mutation_id);
  if (result.rowCount !== 1 || !mutationId.success) throw new Error('service_subject_link_mutation_failed');
  return { mutation_id: mutationId.data };
}

/**
 * Inactive composition for one SERVICE subject-link operation. The returned
 * provider is executable only when an internal caller explicitly supplies it to
 * the Core host; no route, scheduled worker or production import does so here.
 */
export function createServiceSubjectLinkCoreProvidersV1(): CoreTransactionProvidersV2 {
  return Object.freeze({
    provider_code: communicationsPrivateMessageRequestAudienceProviderCodeV1,
    resolveAuthority,
    validateProviders: validateServiceSubjectLinkV1,
    mutate: mutateServiceSubjectLinkV1,
  });
}
