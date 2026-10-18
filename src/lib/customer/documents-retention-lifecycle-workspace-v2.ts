import { z } from 'zod';

import {
  coreTransactionCommandV2Schema,
  type CoreTransactionCommandV2,
  type CoreTransactionProvidersV2,
} from '../core/postgres-transaction-host-v1';
import {
  createDocumentsCountryRetentionOperationProvidersV1,
  documentsCountryRetentionOperationInputFingerprintV1,
  documentsCountryRetentionOperationRequestV1Schema,
} from './documents-country-retention-operation-integration-v1';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const commandContextSchema = z.strictObject({
  transaction_id: uuid,
  command_id: uuid,
  actor_id: uuid,
  authority_version: z.number().int().positive().safe(),
});

export const documentsRetentionLifecycleWorkspaceV2Schema = z.strictObject({
  contract_version: z.literal('documents-retention-lifecycle-workspace.v2'),
  context_id: uuid,
  workspace_id: uuid,
  property_id: uuid,
  property_version: z.number().int().positive().safe(),
  request: documentsCountryRetentionOperationRequestV1Schema,
  idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
});
export type DocumentsRetentionLifecycleWorkspaceV2 =
  z.input<typeof documentsRetentionLifecycleWorkspaceV2Schema>;
export type DocumentsRetentionLifecycleCommandContextV2 = z.input<typeof commandContextSchema>;

export const DOCUMENTS_RETENTION_LIFECYCLE_BINDINGS_V2 = Object.freeze({
  permission_code: 'documents.vault.read',
  module_code: 'documents',
  evaluation_purpose: 'documents.country-retention.resolve',
  aggregate_type: 'portfolio.property',
} as const);

/**
 * Trusted server-only command construction for the inactive D7 preflight.
 * The command delegates to the already-reviewed country-retention composition;
 * it does not create a second policy resolver or disposal contract.
 */
export function buildDocumentsRetentionLifecycleWorkspaceCommandV2(
  inputValue: DocumentsRetentionLifecycleWorkspaceV2,
  contextValue: DocumentsRetentionLifecycleCommandContextV2,
): CoreTransactionCommandV2 {
  const input = documentsRetentionLifecycleWorkspaceV2Schema.parse(inputValue);
  const context = commandContextSchema.parse(contextValue);
  return coreTransactionCommandV2Schema.parse({
    contract_version: 'core-transaction-command.v2',
    transaction_id: context.transaction_id,
    command_id: context.command_id,
    context_id: input.context_id,
    workspace_id: input.workspace_id,
    actor_id: context.actor_id,
    authority_version: context.authority_version,
    ...DOCUMENTS_RETENTION_LIFECYCLE_BINDINGS_V2,
    aggregate_id: input.property_id,
    aggregate_version: input.property_version,
    provider_source_ids: [input.property_id, input.request.target.document_id,
      input.request.target.document_version_id],
    idempotency_key: input.idempotency_key,
    input_fingerprint: documentsCountryRetentionOperationInputFingerprintV1(input.request),
    subject_reference: {
      kind: 'documents.document_version',
      id: input.request.target.document_version_id,
      version: input.request.target.document_version,
      relation: input.request.requested_operation,
      request_version: 1,
    },
  });
}

export function createDocumentsRetentionLifecycleWorkspaceProvidersV2(
  inputValue: DocumentsRetentionLifecycleWorkspaceV2,
): CoreTransactionProvidersV2 {
  const input = documentsRetentionLifecycleWorkspaceV2Schema.parse(inputValue);
  return createDocumentsCountryRetentionOperationProvidersV1(input.request);
}
