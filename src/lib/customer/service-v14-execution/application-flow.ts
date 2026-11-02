import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { CoreTransactionHostV1 } from '../../core/postgres-transaction-host-v1';
import {
  canonicalResourceReferenceV1Schema,
  canonicalResourceTypeV1Schema,
  providerAgreementVerificationV1Schema,
  type CanonicalResourceReferenceV1,
  type CanonicalResourceReferenceV1Input,
  type ProviderAgreementVerificationV1,
  type ProviderAgreementVerificationV1Input,
} from '../../core/resource-contracts-v1';
import {
  serviceEligibilityPolicySchema,
  serviceOfferingCoverageSchema,
} from '../service-offering-v14-schema';
import {
  SERVICE_OFFERING_REQUEST_FLOW_CONTRACT,
  namedServiceResourceV1Schema,
  serviceOfferingRequestPreflightInputV1Schema,
  serviceOfferingRequestPreflightResultV1Schema,
  serviceOfferingRequestPublicInputV1Schema,
  type NamedServiceResourceV1,
  type ServiceOfferingRequestPreflightInputV1,
  type ServiceOfferingRequestPreflightResultV1,
  type ServiceOfferingRequestPublicInputV1,
} from '../service-offering-request-flow-contract';
import { uuidSchema } from '../workspace-composition-schema';
import {
  executeCreateVersionedServiceRequestV1,
  type CreateVersionedServiceRequestCommandV1,
} from './request-command';
import type { ServiceV14CanonicalReaders } from './provider-binding';
import type { ServiceV14ExecutionResponse } from './response-schema';

export const SERVICE_S01_PROVIDER_AGREEMENT = 'provider-agreement-verification.v1' as const;
export const SERVICE_S02_CANONICAL_RESOURCE = 'canonical-resource-reference.v1' as const;
export const SERVICE_S03_GEOGRAPHY = 'geographic-coverage-resolution.v1' as const;

const versionSchema = z.number().int().positive().safe();
const timestampSchema = z.iso.datetime({ offset: true });

export const serviceOfferingRequestSnapshotV1Schema = z.strictObject({
  workspace_id: uuidSchema,
  offering_id: uuidSchema,
  offering_version: versionSchema,
  published_revision_id: uuidSchema,
  published_revision_version: versionSchema,
  provider_party_id: uuidSchema,
  provider_agreement_id: uuidSchema,
  provider_agreement_version: versionSchema,
  status: z.literal('published'),
  acquisition_mode: z.enum(['direct', 'pre_quote', 'on_site', 'project', 'reservation']),
  valid_from: timestampSchema,
  valid_until: timestampSchema.nullable(),
  coverage: serviceOfferingCoverageSchema,
  eligibility: serviceEligibilityPolicySchema,
  current_actor_can_request: z.boolean(),
});

export type ServiceOfferingRequestSnapshotV1 = z.infer<
  typeof serviceOfferingRequestSnapshotV1Schema
>;

export type ServiceOfferingRequestPrincipalV1 = {
  actor_id: string;
  authority_version: number;
};

export type ServiceOfferingRequestFlowPortsV1 = {
  loadOffering(
    input: ServiceOfferingRequestPreflightInputV1,
  ): Promise<ServiceOfferingRequestSnapshotV1 | null>;
  resolvePrincipal(input: {
    context_id: string;
    workspace_id: string;
  }): Promise<ServiceOfferingRequestPrincipalV1 | null>;
  resolveProviderAgreement(
    input: ProviderAgreementVerificationV1Input,
  ): Promise<ProviderAgreementVerificationV1>;
  resolveCanonicalResource(
    input: CanonicalResourceReferenceV1Input,
  ): Promise<CanonicalResourceReferenceV1>;
  transactionalReaders: ServiceV14CanonicalReaders;
  host: CoreTransactionHostV1;
  now(): number;
};

export type ServiceOfferingRequestSubmissionV1 =
  | { status: 'submitted'; request_id: string; replayed: boolean }
  | { status: 'denied'; code: string }
  | { status: 'conflict'; code: string }
  | { status: 'not_ready'; code: string }
  | { status: 'unknown'; code: 'READBACK_REQUIRED' };

const sameId = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();

function deterministicUuid(namespace: string, value: string): string {
  const hex = createHash('sha256').update(`${namespace}\0${value}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function identitySeed(principal: ServiceOfferingRequestPrincipalV1, input: ServiceOfferingRequestPublicInputV1) {
  return [principal.actor_id.toLowerCase(), input.workspace_id.toLowerCase(), input.idempotency_key].join(':');
}

function offeringUnavailable(snapshot: ServiceOfferingRequestSnapshotV1, now: number) {
  const start = Date.parse(snapshot.valid_from);
  const end = snapshot.valid_until === null ? null : Date.parse(snapshot.valid_until);
  return snapshot.status !== 'published' || snapshot.acquisition_mode === 'reservation'
    || !Number.isFinite(now) || !Number.isFinite(start) || now < start
    || (end !== null && (!Number.isFinite(end) || end <= start || now >= end));
}

async function providerAgreementGate(
  ports: ServiceOfferingRequestFlowPortsV1,
  input: ServiceOfferingRequestPreflightInputV1,
  snapshot: ServiceOfferingRequestSnapshotV1,
): Promise<ServiceOfferingRequestPreflightResultV1 | null> {
  let raw: ProviderAgreementVerificationV1;
  try {
    raw = await ports.resolveProviderAgreement({
      contract_version: SERVICE_S01_PROVIDER_AGREEMENT,
      context_id: input.context_id,
      workspace_id: input.workspace_id,
      provider_agreement_id: snapshot.provider_agreement_id,
      provider_agreement_version: snapshot.provider_agreement_version,
      requested_service_scope: ['service.request.create'],
      permission_code: 'services.orders.request',
    });
  } catch {
    return { status: 'not_ready', code: 'SERVICE_S01_NOT_READY' };
  }
  const parsed = providerAgreementVerificationV1Schema.safeParse(raw);
  if (!parsed.success) return { status: 'not_ready', code: 'SERVICE_S01_NOT_READY' };
  const agreement = parsed.data;
  if (agreement.agreement_status === 'withheld') {
    return { status: 'denied', code: 'SOURCE_ACCESS_DENIED' };
  }
  if (!sameId(agreement.workspace_id, snapshot.workspace_id)
    || !sameId(agreement.provider_party_id, snapshot.provider_party_id)
    || !sameId(agreement.provider_agreement_id, snapshot.provider_agreement_id)) {
    return { status: 'denied', code: 'SOURCE_ACCESS_DENIED' };
  }
  if (agreement.provider_agreement_version !== snapshot.provider_agreement_version) {
    return { status: 'conflict', code: 'SOURCE_CHANGED' };
  }
  if (agreement.agreement_status !== 'effective'
    || !agreement.allowed_service_scope.includes('service.request.create')) {
    return { status: 'denied', code: 'SOURCE_ACCESS_DENIED' };
  }
  return null;
}

async function resolveNamedResource(
  ports: ServiceOfferingRequestFlowPortsV1,
  input: ServiceOfferingRequestPreflightInputV1,
  reference: NamedServiceResourceV1['reference'],
): Promise<{ state: 'ready'; resource: NamedServiceResourceV1 }
  | { state: 'denied' | 'conflict' | 'not_ready' }> {
  const resourceType = canonicalResourceTypeV1Schema.safeParse(reference.resource_type);
  if (!resourceType.success) return { state: 'not_ready' };
  let raw: CanonicalResourceReferenceV1;
  try {
    raw = await ports.resolveCanonicalResource({
      contract_version: SERVICE_S02_CANONICAL_RESOURCE,
      context_id: input.context_id,
      workspace_id: input.workspace_id,
      resource_type: resourceType.data,
      resource_id: reference.resource_id,
      resource_version: reference.resource_version,
      permission_code: 'services.orders.request',
      purpose: 'service.request.resource',
    });
  } catch {
    return { state: 'not_ready' };
  }
  const parsed = canonicalResourceReferenceV1Schema.safeParse(raw);
  if (!parsed.success) return { state: 'not_ready' };
  const resource = parsed.data;
  if (resource.reference_status === 'withheld') return { state: 'denied' };
  if (resource.reference_status === 'not_found' || resource.reference_status === 'stale') {
    return { state: 'conflict' };
  }
  if (!sameId(resource.workspace_id, input.workspace_id)
    || !sameId(resource.resource_id, reference.resource_id)
    || resource.resource_version !== reference.resource_version
    || resource.resource_type !== reference.resource_type) return { state: 'denied' };
  if (resource.display_name === null) return { state: 'not_ready' };
  return {
    state: 'ready',
    resource: {
      reference,
      label: resource.display_name,
      detail: resource.resource_type,
    },
  };
}

export async function preflightServiceOfferingRequestV1(
  inputValue: unknown,
  ports: ServiceOfferingRequestFlowPortsV1,
): Promise<ServiceOfferingRequestPreflightResultV1> {
  const parsedInput = serviceOfferingRequestPreflightInputV1Schema.safeParse(inputValue);
  if (!parsedInput.success) return { status: 'denied', code: 'OFFERING_UNAVAILABLE' };
  const input = parsedInput.data;
  let snapshot: ServiceOfferingRequestSnapshotV1 | null;
  try {
    snapshot = serviceOfferingRequestSnapshotV1Schema.nullable().parse(await ports.loadOffering(input));
  } catch {
    return { status: 'not_ready', code: 'RUNTIME_BINDING_INACTIVE' };
  }
  if (snapshot === null || !sameId(snapshot.workspace_id, input.workspace_id)
    || !sameId(snapshot.offering_id, input.offering_id)) {
    return { status: 'denied', code: 'OFFERING_UNAVAILABLE' };
  }
  if (!sameId(snapshot.published_revision_id, input.published_revision_id)) {
    return { status: 'conflict', code: 'OFFERING_CHANGED' };
  }
  if (!snapshot.current_actor_can_request) return { status: 'denied', code: 'SERVICE_ACCESS_DENIED' };
  if (offeringUnavailable(snapshot, ports.now())) return { status: 'denied', code: 'OFFERING_UNAVAILABLE' };
  const agreementFailure = await providerAgreementGate(ports, input, snapshot);
  if (agreementFailure) return agreementFailure;
  if (snapshot.eligibility.required_capabilities.length > 0
    || snapshot.eligibility.required_policy_codes.length > 0) {
    return { status: 'not_ready', code: 'ELIGIBILITY_SOURCE_NOT_READY' };
  }
  if (snapshot.coverage.kind === 'geographic') {
    return { status: 'not_ready', code: 'SERVICE_S03_NOT_READY' };
  }
  if (snapshot.coverage.kind === 'workspace') {
    if (snapshot.eligibility.required_resource_types.length > 0) {
      return { status: 'not_ready', code: 'SERVICE_S02_NOT_READY' };
    }
    return { status: 'ready', contract: SERVICE_OFFERING_REQUEST_FLOW_CONTRACT,
      source_kind: 'workspace', resources: [] };
  }
  const resources: NamedServiceResourceV1[] = [];
  for (const reference of snapshot.coverage.resources) {
    const result = await resolveNamedResource(ports, input, reference);
    if (result.state === 'not_ready') return { status: 'not_ready', code: 'SERVICE_S02_NOT_READY' };
    if (result.state === 'ready') resources.push(result.resource);
  }
  if (resources.length === 0) return { status: 'denied', code: 'SOURCE_ACCESS_DENIED' };
  return { status: 'ready', contract: SERVICE_OFFERING_REQUEST_FLOW_CONTRACT,
    source_kind: 'resources', resources };
}

function mapExecutionResult(result: ServiceV14ExecutionResponse): ServiceOfferingRequestSubmissionV1 {
  switch (result.status) {
    case 'committed':
    case 'exact_replay':
      return { status: 'submitted', request_id: result.receipt.aggregate_id,
        replayed: result.status === 'exact_replay' };
    case 'unknown_commit':
      return { status: 'unknown', code: 'READBACK_REQUIRED' };
    case 'not_ready':
      return { status: 'not_ready', code: result.code };
    case 'denied':
      return result.code === 'REPLAY_CONFLICT'
        ? { status: 'conflict', code: result.code }
        : { status: 'denied', code: result.code };
  }
}

export async function submitServiceOfferingRequestV1(
  inputValue: unknown,
  ports: ServiceOfferingRequestFlowPortsV1,
): Promise<ServiceOfferingRequestSubmissionV1> {
  const parsedInput = serviceOfferingRequestPublicInputV1Schema.safeParse(inputValue);
  if (!parsedInput.success) return { status: 'denied', code: 'INVALID_REQUEST' };
  const input = parsedInput.data;
  const preflightInput = {
    context_id: input.context_id,
    workspace_id: input.workspace_id,
    offering_id: input.offering_id,
    published_revision_id: input.published_revision_id,
  };
  const preflight = await preflightServiceOfferingRequestV1(preflightInput, ports);
  if (preflight.status !== 'ready') return preflight;
  let snapshot: ServiceOfferingRequestSnapshotV1;
  try {
    const current = await ports.loadOffering(preflightInput);
    snapshot = serviceOfferingRequestSnapshotV1Schema.parse(current);
  } catch {
    return { status: 'not_ready', code: 'RUNTIME_BINDING_INACTIVE' };
  }
  if (!sameId(snapshot.workspace_id, input.workspace_id)
    || !sameId(snapshot.offering_id, input.offering_id)
    || !sameId(snapshot.published_revision_id, input.published_revision_id)
    || offeringUnavailable(snapshot, ports.now())
    || !snapshot.current_actor_can_request) {
    return { status: 'conflict', code: 'OFFERING_CHANGED' };
  }
  const resource = input.resource;
  if (preflight.source_kind === 'workspace' && resource !== null) {
    return { status: 'denied', code: 'SOURCE_ACCESS_DENIED' };
  }
  if (preflight.source_kind === 'resources') {
    if (resource === null || !preflight.resources.some(item => sameId(item.reference.resource_id, resource.resource_id)
      && item.reference.resource_version === resource.resource_version
      && item.reference.resource_type === resource.resource_type)) {
      return { status: 'denied', code: 'SOURCE_ACCESS_DENIED' };
    }
  }
  let principal: ServiceOfferingRequestPrincipalV1 | null;
  try {
    principal = await ports.resolvePrincipal({
      context_id: input.context_id,
      workspace_id: input.workspace_id,
    });
  } catch {
    return { status: 'not_ready', code: 'RUNTIME_BINDING_INACTIVE' };
  }
  if (principal === null) return { status: 'denied', code: 'SERVICE_ACCESS_DENIED' };
  const actor = uuidSchema.safeParse(principal.actor_id);
  const authority = versionSchema.safeParse(principal.authority_version);
  if (!actor.success || !authority.success) return { status: 'not_ready', code: 'RUNTIME_BINDING_INACTIVE' };
  const seed = identitySeed({ actor_id: actor.data, authority_version: authority.data }, input);
  const command: CreateVersionedServiceRequestCommandV1 = {
    actor_id: actor.data,
    authority_version: authority.data,
    transaction_id: deterministicUuid('service-request-transaction', seed),
    command_id: deterministicUuid('service-request-command', seed),
    request_id: deterministicUuid('service-request', seed),
    expected_offering_version: snapshot.offering_version,
    published_revision_version: snapshot.published_revision_version,
    provider_party_id: snapshot.provider_party_id,
    input: {
      ...input,
      provider_agreement: {
        agreement_id: snapshot.provider_agreement_id,
        agreement_version: snapshot.provider_agreement_version,
      },
    },
  };
  try {
    return mapExecutionResult(await executeCreateVersionedServiceRequestV1(
      ports.host,
      command,
      ports.transactionalReaders,
    ));
  } catch {
    return { status: 'unknown', code: 'READBACK_REQUIRED' };
  }
}
