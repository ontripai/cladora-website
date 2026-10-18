import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';

import { resolveAuthority } from '../core/current-authority-postgres-provider-v1';
import {
  coreTransactionCommandV1Schema,
  type CoreTransactionCommandV1,
  type CoreTransactionProvidersV1,
  type CoreTransactionReceiptV1,
  type CoreTransactionScopeV1,
} from '../core/postgres-transaction-host-v1';
import type { CurrentAuthorityTransactionDecisionReceiptV1 } from
  '../core/current-authority-transaction-port-v1';
import {
  coreTransactionReplayCommandHashV1,
  coreTransactionReplayReceiptHashV1,
  type CoreTransactionReplayProviderDecisionV1,
} from '../core/transaction-replay-provider-hook-v1';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const contextSchema = z.strictObject({
  transaction_id: uuid,
  command_id: uuid,
  actor_id: uuid,
  authority_version: z.number().int().positive().safe(),
});

export const documentsVaultDownloadExactWorkspaceV2Schema = z.strictObject({
  contract_version: z.literal('documents-vault-download-exact-workspace.v2'),
  context_id: uuid,
  workspace_id: uuid,
  document_id: uuid,
  version_id: uuid,
  expected_current_version: z.number().int().positive().safe(),
  idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
});
export type DocumentsVaultDownloadExactWorkspaceV2 =
  z.input<typeof documentsVaultDownloadExactWorkspaceV2Schema>;

const authorizedDownloadSchema = z.strictObject({
  contract_version: z.literal('documents-vault-authorized-download.v2'),
  document_id: uuid,
  version_id: uuid,
  version: z.number().int().positive().safe(),
  bucket_id: z.literal('document-vault'),
  object_path: z.string().min(3).max(1024),
  storage_object_id: uuid,
  storage_generation: z.string().min(1).max(255).nullable(),
  storage_etag: z.string().min(1).max(1024).nullable(),
  sha256,
  size_bytes: z.number().int().positive().safe(),
  mime_type: z.string().min(3).max(160),
  expires_in_seconds: z.literal(60),
});
export type DocumentsVaultAuthorizedDownloadV2 = z.infer<typeof authorizedDownloadSchema>;

export const DOCUMENTS_VAULT_DOWNLOAD_BINDINGS_V2 = Object.freeze({
  permission_code: 'documents.vault.read',
  module_code: 'documents',
  aggregate_type: 'documents.document',
  purpose: 'documents.vault.download.current_clean',
} as const);

export const DOCUMENTS_VAULT_DOWNLOAD_REPLAY_PROVIDER_CODE_V2 =
  'documents-vault-download-exact-workspace.v2' as const;

type ParsedInput = z.infer<typeof documentsVaultDownloadExactWorkspaceV2Schema>;
type ParsedContext = z.infer<typeof contextSchema>;

function fingerprint(value: unknown) {
  return `docdlv2:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function exactCommand(expected: CoreTransactionCommandV1, actual: CoreTransactionCommandV1) {
  return JSON.stringify(expected) === JSON.stringify(actual);
}

function authorityMatches(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV1,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
) {
  return authority.decision === 'allowed'
    && authority.context_id === command.context_id
    && authority.workspace_id === scope.workspace_id
    && authority.actor_id === scope.actor_id
    && authority.authority_version === command.authority_version
    && authority.permission_code === DOCUMENTS_VAULT_DOWNLOAD_BINDINGS_V2.permission_code
    && authority.module_code === DOCUMENTS_VAULT_DOWNLOAD_BINDINGS_V2.module_code;
}

export function buildDocumentsVaultDownloadExactWorkspaceCommandV2(
  inputValue: DocumentsVaultDownloadExactWorkspaceV2,
  contextValue: z.input<typeof contextSchema>,
) {
  const input = documentsVaultDownloadExactWorkspaceV2Schema.parse(inputValue);
  const context = contextSchema.parse(contextValue);
  return coreTransactionCommandV1Schema.parse({
    contract_version: 'core-transaction-command.v1',
    transaction_id: context.transaction_id,
    command_id: context.command_id,
    context_id: input.context_id,
    workspace_id: input.workspace_id,
    actor_id: context.actor_id,
    authority_version: context.authority_version,
    permission_code: DOCUMENTS_VAULT_DOWNLOAD_BINDINGS_V2.permission_code,
    module_code: DOCUMENTS_VAULT_DOWNLOAD_BINDINGS_V2.module_code,
    evaluation_purpose: DOCUMENTS_VAULT_DOWNLOAD_BINDINGS_V2.purpose,
    aggregate_type: DOCUMENTS_VAULT_DOWNLOAD_BINDINGS_V2.aggregate_type,
    aggregate_id: input.document_id,
    aggregate_version: input.expected_current_version,
    provider_source_ids: [input.document_id, input.version_id],
    idempotency_key: input.idempotency_key,
    input_fingerprint: fingerprint({ input, actor_id: context.actor_id }),
  });
}

async function requestActorMatches(scope: CoreTransactionScopeV1) {
  const result = await scope.query<{ valid: boolean }>(`select
    auth.uid()=$1::uuid and coalesce(auth.jwt()->>'role','')='authenticated' as valid`, [scope.actor_id]);
  return result.rowCount === 1 && result.rows[0]?.valid === true;
}

function replayDecision(
  scope: CoreTransactionScopeV1,
  command: CoreTransactionCommandV1,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  receipt: CoreTransactionReceiptV1,
  evaluatedAt: string,
  accepted: boolean,
): CoreTransactionReplayProviderDecisionV1 {
  const binding = {
    contract_version: 'core-transaction-replay-provider-decision.v1' as const,
    decision_id: randomUUID(),
    provider_code: DOCUMENTS_VAULT_DOWNLOAD_REPLAY_PROVIDER_CODE_V2,
    database_transaction_id: scope.database_transaction_id,
    transaction_id: command.transaction_id,
    command_id: command.command_id,
    workspace_id: command.workspace_id,
    actor_id: command.actor_id,
    context_id: command.context_id,
    authority_decision_id: authority.decision_id,
    authority_version: authority.authority_version,
    attempt: scope.attempt,
    receipt_id: receipt.receipt_id,
    receipt_contract_version: receipt.contract_version,
    command_hash: coreTransactionReplayCommandHashV1(command),
    receipt_hash: coreTransactionReplayReceiptHashV1(receipt),
    evaluated_at: evaluatedAt,
    read_only: true as const,
  };
  return accepted
    ? { ...binding, decision: 'accepted', denial_reason: null }
    : { ...binding, decision: 'denied', denial_reason: 'REPLAY_STATE_CHANGED' };
}

type DownloadRow = {
  valid: boolean;
  document_id: string;
  version_id: string;
  version: number;
  bucket_id: 'document-vault';
  object_path: string;
  storage_object_id: string;
  storage_generation: string | null;
  storage_etag: string | null;
  sha256: string;
  size_bytes: string;
  mime_type: string;
  now: string;
};

function selectorSql(locking: boolean) {
  return `select
      d.tenant_id=$3 and d.workspace_id=$4 and d.current_version=$5
      and d.status='active'::platform.record_status
      and d.archived_at is null and d.deleted_at is null
      and coalesce(to_jsonb(d)->>'disposition_status','retained')
        not in ('disposition_approved','expired')
      and v.tenant_id=d.tenant_id and v.document_id=d.id and v.version=d.current_version
      and v.checksum_status='verified' and v.scanning_status='clean'
      and v.bucket_id='document-vault' and v.storage_object_id is not null
      and v.sha256 ~ '^[a-f0-9]{64}$' and v.size_bytes > 0
      and v.detected_mime_type is not null
      and a.tenant_id=v.tenant_id and a.version_id=v.id
      and a.provider='clamav' and a.verdict='clean' and a.content_sha256=v.sha256
      and auth.uid()=$6 and coalesce(auth.jwt()->>'role','')='authenticated' as valid,
      d.id::text document_id,v.id::text version_id,v.version,
      v.bucket_id,v.object_path,v.storage_object_id::text storage_object_id,
      v.storage_generation,v.storage_etag,v.sha256,v.size_bytes::text,
      v.detected_mime_type mime_type,clock_timestamp()::text now
    from documents.documents d
    join documents.document_versions v on v.id=$2 and v.document_id=d.id
    join documents.document_scan_attestations a on a.version_id=v.id and a.tenant_id=v.tenant_id
    where d.id=$1 ${locking ? 'for share of d,v,a' : ''}`;
}

function parseAuthorized(row: DownloadRow): DocumentsVaultAuthorizedDownloadV2 {
  return authorizedDownloadSchema.parse({
    contract_version: 'documents-vault-authorized-download.v2',
    document_id: row.document_id,
    version_id: row.version_id,
    version: row.version,
    bucket_id: row.bucket_id,
    object_path: row.object_path,
    storage_object_id: row.storage_object_id,
    storage_generation: row.storage_generation,
    storage_etag: row.storage_etag,
    sha256: row.sha256,
    size_bytes: Number(row.size_bytes),
    mime_type: row.mime_type,
    expires_in_seconds: 60,
  });
}

export function createDocumentsVaultDownloadExactWorkspaceProvidersV2(
  inputValue: DocumentsVaultDownloadExactWorkspaceV2,
  contextValue: z.input<typeof contextSchema>,
) {
  const input: ParsedInput = documentsVaultDownloadExactWorkspaceV2Schema.parse(inputValue);
  const context: ParsedContext = contextSchema.parse(contextValue);
  const expected = buildDocumentsVaultDownloadExactWorkspaceCommandV2(input, context);
  let authorized: DocumentsVaultAuthorizedDownloadV2 | null = null;
  const selectorValues = (scope: CoreTransactionScopeV1) => [input.document_id, input.version_id,
    scope.tenant_id, input.workspace_id, input.expected_current_version, scope.actor_id];
  const providers: CoreTransactionProvidersV1 = {
    replay_policy: 'provider_current_state_required',
    replay_provider_code: DOCUMENTS_VAULT_DOWNLOAD_REPLAY_PROVIDER_CODE_V2,
    resolveAuthority,
    async validateProviders(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1,
      authority: CurrentAuthorityTransactionDecisionReceiptV1) {
      authorized = null;
      if (!exactCommand(expected, command) || !authorityMatches(scope, command, authority)
        || scope.workspace_id !== input.workspace_id || scope.actor_id !== context.actor_id
        || !await requestActorMatches(scope)) return false;
      const selected = await scope.query<DownloadRow>(selectorSql(true), selectorValues(scope));
      if (selected.rowCount !== 1 || selected.rows[0]?.valid !== true) return false;
      authorized = parseAuthorized(selected.rows[0]);
      return true;
    },
    async validateReplay(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1,
      authority: CurrentAuthorityTransactionDecisionReceiptV1, receipt: CoreTransactionReceiptV1) {
      authorized = null;
      const selected = await scope.query<DownloadRow>(selectorSql(true), selectorValues(scope));
      const exactReceipt = receipt.contract_version === 'core-transaction-receipt.v1'
        && receipt.replay_validation?.contract_version
          === 'core-transaction-replay-provider-requirement.v1'
        && receipt.replay_validation.provider_code === DOCUMENTS_VAULT_DOWNLOAD_REPLAY_PROVIDER_CODE_V2
        && receipt.transaction_id === command.transaction_id
        && receipt.command_id === command.command_id
        && receipt.workspace_id === input.workspace_id
        && receipt.actor_id === context.actor_id
        && receipt.aggregate_type === DOCUMENTS_VAULT_DOWNLOAD_BINDINGS_V2.aggregate_type
        && receipt.aggregate_id === input.document_id
        && receipt.aggregate_version === input.expected_current_version
        && receipt.input_fingerprint === command.input_fingerprint
        && receipt.idempotency_key === input.idempotency_key
        && receipt.mutation_id === input.version_id
        && receipt.authority.context_id === input.context_id
        && receipt.authority.workspace_id === input.workspace_id
        && receipt.authority.actor_id === context.actor_id
        && receipt.authority.evaluation_purpose === DOCUMENTS_VAULT_DOWNLOAD_BINDINGS_V2.purpose;
      const accepted = exactCommand(expected, command) && authorityMatches(scope, command, authority)
        && scope.transaction_id === context.transaction_id
        && selected.rowCount === 1 && selected.rows[0]?.valid === true && exactReceipt;
      if (accepted) authorized = parseAuthorized(selected.rows[0]);
      const evaluatedAt = new Date(selected.rows[0]?.now ?? authority.evaluated_at).toISOString();
      return replayDecision(scope, command, authority, receipt, evaluatedAt, accepted);
    },
    async mutate(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1) {
      if (!exactCommand(expected, command) || authorized === null) {
        throw new Error('documents_download_authorization_required');
      }
      const event = await scope.query<{ mutation_id: string }>(`insert into documents.access_events(
          tenant_id,document_id,version_id,actor_id,action,purpose)
        values($1,$2,$3,$4,'authorized_download','Exact Workspace current clean download authorized')
        returning version_id::text as mutation_id`, [
        scope.tenant_id, input.document_id, input.version_id, scope.actor_id,
      ]);
      if (event.rowCount !== 1 || event.rows[0]?.mutation_id !== input.version_id) {
        throw new Error('documents_download_access_event_failed');
      }
      return { mutation_id: input.version_id };
    },
  };
  return Object.freeze({
    providers: Object.freeze(providers),
    readAuthorizedDownload() {
      return authorized ? Object.freeze({ ...authorized }) : null;
    },
  });
}
