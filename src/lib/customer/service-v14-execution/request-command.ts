import { z } from 'zod';
import { createServiceRequestV14Schema } from '../service-offering-v14-schema';
import { canonicalResourceTypeV1Schema } from '../../core/resource-contracts-v1';
import type { CoreTransactionHostV1 } from '../../core/postgres-transaction-host-v1';
import { uuidSchema } from '../workspace-composition-schema';
import {
  prepareServiceV14Execution,
  type ServiceV14CanonicalReaders,
  type ServiceV14ExecutionDispatch,
} from './provider-binding';
import { parseServiceV14ExecutionResponse } from './response-schema';

const version = z.number().int().positive().safe();

export const createVersionedServiceRequestCommandV1Schema = z.strictObject({
  actor_id: uuidSchema,
  authority_version: version,
  transaction_id: uuidSchema,
  command_id: uuidSchema,
  request_id: uuidSchema,
  expected_offering_version: version,
  published_revision_version: version,
  provider_party_id: uuidSchema,
  input: createServiceRequestV14Schema,
});

export type CreateVersionedServiceRequestCommandV1 = z.infer<
  typeof createVersionedServiceRequestCommandV1Schema
>;

export function prepareCreateVersionedServiceRequestV1(
  value: unknown,
  readers: ServiceV14CanonicalReaders,
): ServiceV14ExecutionDispatch {
  const command = createVersionedServiceRequestCommandV1Schema.parse(value);
  return prepareServiceV14Execution({
    operation: 'create_request',
    context_id: command.input.context_id,
    workspace_id: command.input.workspace_id,
    actor_id: command.actor_id,
    authority_version: command.authority_version,
    transaction_id: command.transaction_id,
    command_id: command.command_id,
    request_id: command.request_id,
    offering_id: command.input.offering_id,
    expected_offering_version: command.expected_offering_version,
    published_revision_id: command.input.published_revision_id,
    published_revision_version: command.published_revision_version,
    provider_party_id: command.provider_party_id,
    provider_agreement_id: command.input.provider_agreement.agreement_id,
    provider_agreement_version: command.input.provider_agreement.agreement_version,
    requested_service_scope: 'service.request.create',
    resource: command.input.resource === null ? null : {
      ...command.input.resource,
      resource_type: canonicalResourceTypeV1Schema.parse(command.input.resource.resource_type),
    },
    beneficiary_party_id: command.input.beneficiary_party_id,
    description: command.input.description,
    idempotency_key: command.input.idempotency_key,
  }, readers);
}

export async function executeCreateVersionedServiceRequestV1(
  host: CoreTransactionHostV1,
  value: unknown,
  readers: ServiceV14CanonicalReaders,
) {
  const dispatch = prepareCreateVersionedServiceRequestV1(value, readers);
  return parseServiceV14ExecutionResponse(await host.execute(dispatch.command, dispatch.providers));
}
