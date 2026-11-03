import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { resolveAuthority } from '../../core/current-authority-postgres-provider-v1';
import {
  coreTransactionCommandV2Schema,
  type CoreTransactionCommandV2,
  type CoreTransactionProvidersV2,
  type CoreTransactionReceiptV2,
  type CoreTransactionScopeV1,
} from '../../core/postgres-transaction-host-v1';
import {
  coreTransactionReplayCommandHashV1,
  coreTransactionReplayReceiptHashV1,
  type CoreTransactionReplayProviderDecisionV1,
} from '../../core/transaction-replay-provider-hook-v1';
import {
  canonicalResourceReferenceV1Schema,
  providerAgreementVerificationV1Schema,
  type CanonicalResourceReferenceV1,
  type CanonicalResourceReferenceV1Input,
  type ProviderAgreementVerificationV1,
  type ProviderAgreementVerificationV1Input,
} from '../../core/resource-contracts-v1';
import type { CurrentAuthorityTransactionDecisionReceiptV1 } from '../../core/current-authority-transaction-port-v1';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const version = z.number().int().positive().safe();
const code = z.string().regex(/^[a-z][a-z0-9_.:-]{0,79}$/);

const resourceReferenceSchema = z.strictObject({
  resource_id: uuid,
  resource_version: version,
  resource_type: z.enum(['party', 'property', 'building', 'entrance', 'unit', 'asset']),
});

export const serviceV14ExecutionPlanSchema = z.discriminatedUnion('operation', [
  z.strictObject({
    operation: z.literal('create_offering'),
    context_id: uuid, workspace_id: uuid, actor_id: uuid,
    authority_version: version, transaction_id: uuid, command_id: uuid,
    offering_id: uuid, revision_id: uuid, definition_id: uuid, provider_party_id: uuid,
    provider_agreement_id: uuid, provider_agreement_version: version,
    requested_service_scope: code,
    revision_version: z.literal(1), revision: z.unknown(), coverage: z.unknown(), eligibility: z.unknown(),
    idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  }),
  z.strictObject({
    operation: z.literal('transition_offering'),
    context_id: uuid, workspace_id: uuid, actor_id: uuid,
    authority_version: version, transaction_id: uuid, command_id: uuid,
    offering_id: uuid, revision_id: uuid, expected_offering_version: version,
    expected_revision_version: version, provider_party_id: uuid,
    provider_agreement_id: uuid, provider_agreement_version: version,
    requested_service_scope: code, action: z.enum(['submit', 'publish', 'suspend', 'archive']),
    reason: z.string().trim().min(5).max(500),
    idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  }),
  z.strictObject({
    operation: z.literal('create_request'),
    context_id: uuid, workspace_id: uuid, actor_id: uuid,
    authority_version: version, transaction_id: uuid, command_id: uuid,
    request_id: uuid, offering_id: uuid, expected_offering_version: version,
    published_revision_id: uuid, published_revision_version: version,
    provider_party_id: uuid, provider_agreement_id: uuid, provider_agreement_version: version,
    requested_service_scope: code, resource: resourceReferenceSchema.nullable(),
    beneficiary_party_id: uuid, description: z.string().trim().min(5).max(5000),
    idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  }),
]);
export type ServiceV14ExecutionPlan = z.infer<typeof serviceV14ExecutionPlanSchema>;

export type ServiceV14CanonicalReaders = {
  resolveProviderAgreement(
    scope: CoreTransactionScopeV1,
    input: ProviderAgreementVerificationV1Input,
  ): Promise<ProviderAgreementVerificationV1>;
  resolveCanonicalResource(
    scope: CoreTransactionScopeV1,
    input: CanonicalResourceReferenceV1Input,
  ): Promise<CanonicalResourceReferenceV1>;
};

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function fingerprintServiceV14Execution(plan: ServiceV14ExecutionPlan) {
  return `sha256:${createHash('sha256').update('service-v14-execution.v1\0')
    .update(canonicalJson(plan)).digest('hex')}`;
}

function permissionFor(plan: ServiceV14ExecutionPlan) {
  if (plan.operation === 'create_request') {
    return { permission_code: 'services.orders.request', module_code: 'services_orders' };
  }
  if (plan.operation === 'transition_offering' && plan.action === 'publish') {
    return { permission_code: 'services.catalog.publish', module_code: 'services_catalog' };
  }
  return { permission_code: 'services.catalog.manage', module_code: 'services_catalog' };
}

export function buildServiceV14CoreCommand(planValue: ServiceV14ExecutionPlan): CoreTransactionCommandV2 {
  const plan = serviceV14ExecutionPlanSchema.parse(planValue);
  const permission = permissionFor(plan);
  const aggregateId = plan.operation === 'create_request' ? plan.request_id : plan.offering_id;
  const aggregateVersion = plan.operation === 'create_offering' ? 1
    : plan.operation === 'create_request' ? 1 : plan.expected_offering_version + 1;
  const subjectId = plan.operation === 'create_request' ? plan.published_revision_id : plan.offering_id;
  const subjectVersion = plan.operation === 'create_request'
    ? plan.published_revision_version
    : plan.operation === 'create_offering' ? 1 : plan.expected_revision_version;
  const providerSourceIds = [subjectId, plan.provider_agreement_id,
    ...(plan.operation === 'create_request' && plan.resource ? [plan.resource.resource_id] : [])];
  return coreTransactionCommandV2Schema.parse({
    contract_version: 'core-transaction-command.v2',
    transaction_id: plan.transaction_id,
    command_id: plan.command_id,
    context_id: plan.context_id,
    workspace_id: plan.workspace_id,
    actor_id: plan.actor_id,
    authority_version: plan.authority_version,
    ...permission,
    evaluation_purpose: `service.${plan.operation}`,
    aggregate_type: plan.operation === 'create_request' ? 'service_request' : 'service_offering',
    aggregate_id: aggregateId,
    aggregate_version: aggregateVersion,
    provider_source_ids: Array.from(new Set(providerSourceIds)).sort(),
    idempotency_key: plan.idempotency_key,
    input_fingerprint: fingerprintServiceV14Execution(plan),
    subject_reference: {
      kind: plan.operation === 'create_request' ? 'service_offering_revision' : 'service_offering',
      id: subjectId,
      version: subjectVersion,
      relation: plan.operation === 'create_request' ? 'request_source' : 'execution_source',
      request_version: aggregateVersion,
    },
  });
}

type ProviderCheck = { accepted: true } | {
  accepted: false;
  reason: 'SUBJECT_NOT_FOUND' | 'STALE_SUBJECT' | 'RELATION_MISMATCH' | 'SUBJECT_DENIED' | 'PROVIDER_UNAVAILABLE';
};

function preserveSerializationFailure(error: unknown) {
  if (typeof error === 'object' && error !== null && 'code' in error
    && (error as { code?: unknown }).code === '40001') throw error;
}

async function validateCurrentState(
  scope: CoreTransactionScopeV1,
  plan: ServiceV14ExecutionPlan,
  readers: ServiceV14CanonicalReaders,
): Promise<ProviderCheck> {
  const agreementInput: ProviderAgreementVerificationV1Input = {
    contract_version: 'provider-agreement-verification.v1',
    context_id: plan.context_id,
    workspace_id: plan.workspace_id,
    provider_agreement_id: plan.provider_agreement_id,
    provider_agreement_version: plan.provider_agreement_version,
    requested_service_scope: [plan.requested_service_scope],
    permission_code: permissionFor(plan).permission_code,
  };
  let agreement: ProviderAgreementVerificationV1;
  try {
    agreement = providerAgreementVerificationV1Schema.parse(
      await readers.resolveProviderAgreement(scope, agreementInput),
    );
  } catch (error) {
    preserveSerializationFailure(error);
    return { accepted: false, reason: 'PROVIDER_UNAVAILABLE' };
  }
  if (agreement.agreement_status === 'withheld') return { accepted: false, reason: 'SUBJECT_DENIED' };
  if (agreement.workspace_id !== plan.workspace_id
    || agreement.provider_party_id !== plan.provider_party_id
    || agreement.provider_agreement_id !== plan.provider_agreement_id) {
    return { accepted: false, reason: 'RELATION_MISMATCH' };
  }
  if (agreement.provider_agreement_version !== plan.provider_agreement_version) {
    return { accepted: false, reason: 'STALE_SUBJECT' };
  }
  if (agreement.agreement_status !== 'effective'
    || !agreement.allowed_service_scope.includes(plan.requested_service_scope)) {
    return { accepted: false, reason: 'SUBJECT_DENIED' };
  }

  if (plan.operation !== 'create_offering') {
    const source = await scope.query<{ source: unknown }>(
      'select app_private.resolve_service_v14_execution_source_v1($1,$2,$3,$4,$5) as source',
      [plan.workspace_id, plan.offering_id,
        plan.operation === 'create_request' ? plan.published_revision_id : plan.revision_id,
        plan.operation === 'create_request' ? plan.expected_offering_version : plan.expected_offering_version,
        plan.operation === 'create_request' ? plan.published_revision_version : plan.expected_revision_version],
    );
    if (source.rowCount !== 1 || source.rows[0]?.source === null) {
      return { accepted: false, reason: 'SUBJECT_NOT_FOUND' };
    }
    const expected = {
      workspace_id: plan.workspace_id,
      offering_id: plan.offering_id,
      revision_id: plan.operation === 'create_request' ? plan.published_revision_id : plan.revision_id,
      offering_version: plan.expected_offering_version,
      revision_version: plan.operation === 'create_request'
        ? plan.published_revision_version : plan.expected_revision_version,
      provider_party_id: plan.provider_party_id,
      provider_agreement_id: plan.provider_agreement_id,
      provider_agreement_version: plan.provider_agreement_version,
    };
    const sourceObject = source.rows[0].source as Record<string, unknown>;
    if (Object.entries(expected).some(([key, value]) => sourceObject[key] !== value)) {
      return { accepted: false, reason: 'STALE_SUBJECT' };
    }
    if (plan.operation === 'create_request' && sourceObject.status !== 'published') {
      return { accepted: false, reason: 'SUBJECT_DENIED' };
    }
    if (plan.operation === 'create_request' && sourceObject.offering_available !== true) {
      return { accepted: false, reason: 'SUBJECT_DENIED' };
    }
    if (sourceObject.coverage_kind === 'geographic') {
      return { accepted: false, reason: 'PROVIDER_UNAVAILABLE' };
    }
    if ((sourceObject.requires_capability_policy_resolution as boolean) === true) {
      return { accepted: false, reason: 'PROVIDER_UNAVAILABLE' };
    }
    if (plan.operation === 'create_request') {
      const coverage = sourceObject.coverage as { kind?: unknown; resources?: unknown } | undefined;
      const requiredTypes = sourceObject.required_resource_types;
      if (coverage?.kind === 'resources') {
        if (plan.resource === null || !Array.isArray(coverage.resources)
          || !coverage.resources.some(candidate => {
            const item = candidate as Record<string, unknown>;
            return item.resource_id === plan.resource?.resource_id
              && item.resource_version === plan.resource?.resource_version
              && item.resource_type === plan.resource?.resource_type;
          })) return { accepted: false, reason: 'SUBJECT_DENIED' };
      }
      if (Array.isArray(requiredTypes) && requiredTypes.length > 0
        && (plan.resource === null || !requiredTypes.includes(plan.resource.resource_type))) {
        return { accepted: false, reason: 'SUBJECT_DENIED' };
      }
    }
  }

  if (plan.operation === 'create_request' && plan.resource !== null) {
    let resource: CanonicalResourceReferenceV1;
    try {
      resource = canonicalResourceReferenceV1Schema.parse(await readers.resolveCanonicalResource(scope, {
        contract_version: 'canonical-resource-reference.v1',
        context_id: plan.context_id,
        workspace_id: plan.workspace_id,
        resource_type: plan.resource.resource_type,
        resource_id: plan.resource.resource_id,
        resource_version: plan.resource.resource_version,
        permission_code: 'services.orders.request',
        purpose: 'service.request.resource',
      }));
    } catch {
      return { accepted: false, reason: 'PROVIDER_UNAVAILABLE' };
    }
    if (resource.reference_status === 'not_found') return { accepted: false, reason: 'SUBJECT_NOT_FOUND' };
    if (resource.reference_status === 'withheld') return { accepted: false, reason: 'SUBJECT_DENIED' };
    if (resource.reference_status === 'stale'
      || resource.resource_version !== plan.resource.resource_version) {
      return { accepted: false, reason: 'STALE_SUBJECT' };
    }
    if (resource.workspace_id !== plan.workspace_id
      || resource.resource_id !== plan.resource.resource_id
      || resource.resource_type !== plan.resource.resource_type) {
      return { accepted: false, reason: 'RELATION_MISMATCH' };
    }
  }
  return { accepted: true };
}

export function createServiceV14Providers(
  planValue: ServiceV14ExecutionPlan,
  readers: ServiceV14CanonicalReaders,
): CoreTransactionProvidersV2 {
  const plan = serviceV14ExecutionPlanSchema.parse(planValue);
  return {
    provider_code: 'service_v14_execution',
    replay_policy: 'provider_current_state_required',
    resolveAuthority,
    async validateProviders(scope, command, authority) {
      const check = await validateCurrentState(scope, plan, readers);
      const base = {
        contract_version: 'core-transaction-provider-evidence.v1' as const,
        evidence_id: randomUUID(), provider_code: 'service_v14_execution',
        transaction_id: command.transaction_id, command_id: command.command_id,
        workspace_id: command.workspace_id, actor_id: command.actor_id,
        context_id: command.context_id, authority_decision_id: authority.decision_id,
        authority_version: authority.authority_version, attempt: scope.attempt,
        subject_reference: command.subject_reference,
        evaluated_at: new Date().toISOString(), source_disclosure: 'status_only' as const,
        source_reference: null,
      };
      return check.accepted
        ? { ...base, decision: 'accepted', denial_reason: null,
          reference_state: 'available', current_actor_can_read: true }
        : { ...base, decision: 'denied', denial_reason: check.reason };
    },
    async validateReplay(scope, command, authority, receipt): Promise<CoreTransactionReplayProviderDecisionV1> {
      const check = await validateCurrentState(scope, plan, readers);
      const base = {
        contract_version: 'core-transaction-replay-provider-decision.v1',
        decision_id: randomUUID(), provider_code: 'service_v14_execution',
        database_transaction_id: scope.database_transaction_id,
        transaction_id: command.transaction_id, command_id: command.command_id,
        workspace_id: command.workspace_id, actor_id: command.actor_id,
        context_id: command.context_id, authority_decision_id: authority.decision_id,
        authority_version: authority.authority_version, attempt: scope.attempt,
        receipt_id: receipt.receipt_id,
        receipt_contract_version: receipt.contract_version,
        command_hash: coreTransactionReplayCommandHashV1(command),
        receipt_hash: coreTransactionReplayReceiptHashV1(receipt),
        evaluated_at: new Date().toISOString(), read_only: true,
      } as const;
      if (check.accepted) return { ...base, decision: 'accepted', denial_reason: null };
      return { ...base, decision: 'denied',
        denial_reason: check.reason === 'PROVIDER_UNAVAILABLE'
          ? 'PROVIDER_UNAVAILABLE' : 'REPLAY_STATE_CHANGED' };
    },
    async mutate(scope, command) {
      if (command.input_fingerprint !== fingerprintServiceV14Execution(plan)
        || command.workspace_id !== plan.workspace_id || command.actor_id !== plan.actor_id) {
        throw new Error('service_v14_command_binding_mismatch');
      }
      const result = await scope.query<{ mutation_id: string }>(
        'select app_private.apply_service_v14_execution_v1($1,$2::jsonb)::text as mutation_id',
        [plan.operation, JSON.stringify(plan)],
      );
      if (result.rowCount !== 1) throw new Error('service_v14_mutation_missing');
      return { mutation_id: uuid.parse(result.rows[0].mutation_id) };
    },
  };
}

export type ServiceV14ExecutionDispatch = {
  command: CoreTransactionCommandV2;
  providers: CoreTransactionProvidersV2;
};

export function prepareServiceV14Execution(
  plan: ServiceV14ExecutionPlan,
  readers: ServiceV14CanonicalReaders,
): ServiceV14ExecutionDispatch {
  const parsed = serviceV14ExecutionPlanSchema.parse(plan);
  return { command: buildServiceV14CoreCommand(parsed), providers: createServiceV14Providers(parsed, readers) };
}

export type ServiceV14CommittedReceipt = CoreTransactionReceiptV2;
