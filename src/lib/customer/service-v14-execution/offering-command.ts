import { z } from 'zod';
import {
  createServiceOfferingV14Schema,
  serviceProviderAgreementReferenceSchema,
} from '../service-offering-v14-schema';
import { uuidSchema } from '../workspace-composition-schema';
import type { CoreTransactionHostV1 } from '../../core/postgres-transaction-host-v1';
import {
  prepareServiceV14Execution,
  type ServiceV14CanonicalReaders,
  type ServiceV14ExecutionDispatch,
} from './provider-binding';
import { parseServiceV14ExecutionResponse } from './response-schema';

const version = z.number().int().positive().safe();
const trustedEnvelope = {
  actor_id: uuidSchema,
  authority_version: version,
  transaction_id: uuidSchema,
  command_id: uuidSchema,
};

export const createVersionedServiceOfferingCommandV1Schema = z.strictObject({
  ...trustedEnvelope,
  offering_id: uuidSchema,
  revision_id: uuidSchema,
  input: createServiceOfferingV14Schema,
});

export const transitionVersionedServiceOfferingCommandV1Schema = z.strictObject({
  ...trustedEnvelope,
  context_id: uuidSchema,
  workspace_id: uuidSchema,
  offering_id: uuidSchema,
  revision_id: uuidSchema,
  expected_offering_version: version,
  expected_revision_version: version,
  provider_party_id: uuidSchema,
  provider_agreement: serviceProviderAgreementReferenceSchema,
  action: z.enum(['submit', 'publish', 'suspend', 'archive']),
  reason: z.string().trim().min(5).max(500),
  idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
});

export type CreateVersionedServiceOfferingCommandV1 = z.infer<
  typeof createVersionedServiceOfferingCommandV1Schema
>;
export type TransitionVersionedServiceOfferingCommandV1 = z.infer<
  typeof transitionVersionedServiceOfferingCommandV1Schema
>;

export function prepareCreateVersionedServiceOfferingV1(
  value: unknown,
  readers: ServiceV14CanonicalReaders,
): ServiceV14ExecutionDispatch {
  const command = createVersionedServiceOfferingCommandV1Schema.parse(value);
  return prepareServiceV14Execution({
    operation: 'create_offering',
    context_id: command.input.context_id,
    workspace_id: command.input.workspace_id,
    actor_id: command.actor_id,
    authority_version: command.authority_version,
    transaction_id: command.transaction_id,
    command_id: command.command_id,
    offering_id: command.offering_id,
    revision_id: command.revision_id,
    definition_id: command.input.definition_id,
    provider_party_id: command.input.provider_party_id,
    provider_agreement_id: command.input.provider_agreement.agreement_id,
    provider_agreement_version: command.input.provider_agreement.agreement_version,
    requested_service_scope: 'service.offering.create',
    revision_version: 1,
    revision: command.input.revision,
    coverage: command.input.coverage,
    eligibility: command.input.eligibility,
    idempotency_key: command.input.idempotency_key,
  }, readers);
}

export function prepareTransitionVersionedServiceOfferingV1(
  value: unknown,
  readers: ServiceV14CanonicalReaders,
): ServiceV14ExecutionDispatch {
  const command = transitionVersionedServiceOfferingCommandV1Schema.parse(value);
  return prepareServiceV14Execution({
    operation: 'transition_offering',
    context_id: command.context_id,
    workspace_id: command.workspace_id,
    actor_id: command.actor_id,
    authority_version: command.authority_version,
    transaction_id: command.transaction_id,
    command_id: command.command_id,
    offering_id: command.offering_id,
    revision_id: command.revision_id,
    expected_offering_version: command.expected_offering_version,
    expected_revision_version: command.expected_revision_version,
    provider_party_id: command.provider_party_id,
    provider_agreement_id: command.provider_agreement.agreement_id,
    provider_agreement_version: command.provider_agreement.agreement_version,
    requested_service_scope: command.action === 'publish'
      ? 'service.offering.publish' : `service.offering.${command.action}`,
    action: command.action,
    reason: command.reason,
    idempotency_key: command.idempotency_key,
  }, readers);
}

export async function executeCreateVersionedServiceOfferingV1(
  host: CoreTransactionHostV1,
  value: unknown,
  readers: ServiceV14CanonicalReaders,
) {
  const dispatch = prepareCreateVersionedServiceOfferingV1(value, readers);
  return parseServiceV14ExecutionResponse(await host.execute(dispatch.command, dispatch.providers));
}

export async function executeTransitionVersionedServiceOfferingV1(
  host: CoreTransactionHostV1,
  value: unknown,
  readers: ServiceV14CanonicalReaders,
) {
  const dispatch = prepareTransitionVersionedServiceOfferingV1(value, readers);
  return parseServiceV14ExecutionResponse(await host.execute(dispatch.command, dispatch.providers));
}
