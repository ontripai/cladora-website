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
import {
  requireVerifiedDocumentsStoredObjectV1,
  type VerifiedDocumentsStoredObjectV1,
} from './documents-workspace-binding-writer-v1';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const allowedMime = z.string().trim().toLowerCase().refine(value => new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]).has(value), 'unsupported_document_mime_type');
const safeFilename = z.string().trim().min(1).max(255).refine(value => {
  const extension = value.split('.').at(-1)?.toLowerCase();
  return !extension || !new Set([
    'exe', 'sh', 'bat', 'cmd', 'js', 'mjs', 'ts', 'html', 'htm', 'svg', 'php', 'py',
    'zip', 'tar', 'gz', 'rar',
  ]).has(extension);
}, 'disallowed_file_extension');

const commandContextSchema = z.strictObject({
  transaction_id: uuid,
  command_id: uuid,
  actor_id: uuid,
  authority_version: z.number().int().positive().safe(),
});

export const documentsReplacementIntentV1Schema = z.strictObject({
  contract_version: z.literal('documents-replacement-intent.v1'),
  context_id: uuid,
  workspace_id: uuid,
  intent_id: uuid,
  document_id: uuid,
  expected_parent_version_id: uuid,
  expected_parent_version: z.number().int().positive().safe(),
  filename: safeFilename,
  object_path: z.string().min(3).max(1024),
  declared_mime_type: allowedMime,
  max_size_bytes: z.number().int().positive().max(20 * 1024 * 1024),
  expires_at: z.string().datetime({ offset: true }),
  idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
});
export type DocumentsReplacementIntentV1 = z.input<typeof documentsReplacementIntentV1Schema>;

export const documentsReplacementCandidateV1Schema = z.strictObject({
  contract_version: z.literal('documents-replacement-candidate.v1'),
  context_id: uuid,
  workspace_id: uuid,
  intent_id: uuid,
  document_id: uuid,
  parent_version_id: uuid,
  parent_version: z.number().int().positive().safe(),
  version_id: uuid,
  idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
});
export type DocumentsReplacementCandidateV1 = z.input<typeof documentsReplacementCandidateV1Schema>;

export const DOCUMENTS_REPLACEMENT_WRITER_BINDINGS_V1 = Object.freeze({
  permission_code: 'documents.vault.upload',
  module_code: 'documents',
  aggregate_type: 'documents.document',
  intent_purpose: 'documents.workspace_replacement.intent',
  finalize_purpose: 'documents.workspace_replacement.finalize',
} as const);

export const DOCUMENTS_REPLACEMENT_WRITER_REPLAY_PROVIDER_CODE_V1 =
  'documents-replacement-workspace-writer.v1' as const;

type CommandContext = z.infer<typeof commandContextSchema>;
type ParsedIntent = z.infer<typeof documentsReplacementIntentV1Schema>;
type ParsedCandidate = z.infer<typeof documentsReplacementCandidateV1Schema>;

function fingerprint(prefix: string, value: unknown) {
  return `${prefix}:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

function exactCommand(expected: CoreTransactionCommandV1, actual: CoreTransactionCommandV1) {
  return JSON.stringify(actual) === JSON.stringify(expected);
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
    && authority.permission_code === DOCUMENTS_REPLACEMENT_WRITER_BINDINGS_V1.permission_code
    && authority.module_code === DOCUMENTS_REPLACEMENT_WRITER_BINDINGS_V1.module_code;
}

function command(
  input: ParsedIntent | ParsedCandidate,
  context: CommandContext,
  purpose: string,
  aggregateVersion: number,
  providerSourceIds: string[],
  prefix: string,
  fingerprintBinding?: unknown,
) {
  return coreTransactionCommandV1Schema.parse({
    contract_version: 'core-transaction-command.v1',
    transaction_id: context.transaction_id,
    command_id: context.command_id,
    context_id: input.context_id,
    workspace_id: input.workspace_id,
    actor_id: context.actor_id,
    authority_version: context.authority_version,
    permission_code: DOCUMENTS_REPLACEMENT_WRITER_BINDINGS_V1.permission_code,
    module_code: DOCUMENTS_REPLACEMENT_WRITER_BINDINGS_V1.module_code,
    evaluation_purpose: purpose,
    aggregate_type: DOCUMENTS_REPLACEMENT_WRITER_BINDINGS_V1.aggregate_type,
    aggregate_id: input.document_id,
    aggregate_version: aggregateVersion,
    provider_source_ids: providerSourceIds,
    idempotency_key: input.idempotency_key,
    input_fingerprint: fingerprint(prefix, {
      input, actor_id: context.actor_id, binding: fingerprintBinding ?? null,
    }),
  });
}

export function buildDocumentsReplacementIntentCommandV1(
  inputValue: DocumentsReplacementIntentV1,
  contextValue: z.input<typeof commandContextSchema>,
) {
  const input = documentsReplacementIntentV1Schema.parse(inputValue);
  const context = commandContextSchema.parse(contextValue);
  return command(input, context, DOCUMENTS_REPLACEMENT_WRITER_BINDINGS_V1.intent_purpose,
    input.expected_parent_version, [input.intent_id, input.document_id,
      input.expected_parent_version_id], 'docrpi1');
}

export function buildDocumentsReplacementCandidateCommandV1(
  inputValue: DocumentsReplacementCandidateV1,
  contextValue: z.input<typeof commandContextSchema>,
  verifiedObjectValue: VerifiedDocumentsStoredObjectV1,
) {
  const input = documentsReplacementCandidateV1Schema.parse(inputValue);
  const context = commandContextSchema.parse(contextValue);
  const object = requireVerifiedDocumentsStoredObjectV1(verifiedObjectValue);
  return command(input, context, DOCUMENTS_REPLACEMENT_WRITER_BINDINGS_V1.finalize_purpose,
    input.parent_version + 1, [input.intent_id, input.document_id, input.parent_version_id,
      input.version_id], 'docrpf1', object);
}

async function requestIsAal2(scope: CoreTransactionScopeV1) {
  const result = await scope.query<{ valid: boolean }>(
    `select auth.uid()=$1::uuid and coalesce(auth.jwt()->>'aal','')='aal2' as valid`,
    [scope.actor_id],
  );
  return result.rowCount === 1 && result.rows[0]?.valid === true;
}

function replayDecision(
  scope: CoreTransactionScopeV1,
  commandValue: CoreTransactionCommandV1,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  receipt: CoreTransactionReceiptV1,
  evaluatedAt: string,
  accepted: boolean,
): CoreTransactionReplayProviderDecisionV1 {
  const binding = {
    contract_version: 'core-transaction-replay-provider-decision.v1' as const,
    decision_id: randomUUID(),
    provider_code: DOCUMENTS_REPLACEMENT_WRITER_REPLAY_PROVIDER_CODE_V1,
    database_transaction_id: scope.database_transaction_id,
    transaction_id: commandValue.transaction_id,
    command_id: commandValue.command_id,
    workspace_id: commandValue.workspace_id,
    actor_id: commandValue.actor_id,
    context_id: commandValue.context_id,
    authority_decision_id: authority.decision_id,
    authority_version: authority.authority_version,
    attempt: scope.attempt,
    receipt_id: receipt.receipt_id,
    receipt_contract_version: receipt.contract_version,
    command_hash: coreTransactionReplayCommandHashV1(commandValue),
    receipt_hash: coreTransactionReplayReceiptHashV1(receipt),
    evaluated_at: evaluatedAt,
    read_only: true as const,
  };
  return accepted
    ? { ...binding, decision: 'accepted', denial_reason: null }
    : { ...binding, decision: 'denied', denial_reason: 'REPLAY_STATE_CHANGED' };
}

export function createDocumentsReplacementIntentProvidersV1(
  inputValue: DocumentsReplacementIntentV1,
  contextValue: z.input<typeof commandContextSchema>,
): CoreTransactionProvidersV1 {
  const input = documentsReplacementIntentV1Schema.parse(inputValue);
  const context = commandContextSchema.parse(contextValue);
  const expected = buildDocumentsReplacementIntentCommandV1(input, context);
  return Object.freeze({
    resolveAuthority,
    async validateProviders(scope: CoreTransactionScopeV1, commandValue: CoreTransactionCommandV1,
      authority: CurrentAuthorityTransactionDecisionReceiptV1) {
      if (!exactCommand(expected, commandValue) || !authorityMatches(scope, commandValue, authority)
        || scope.workspace_id !== input.workspace_id || scope.actor_id !== context.actor_id
        || input.object_path.includes('..') || !input.object_path.startsWith(
          `${scope.tenant_id}/${input.intent_id}/v${input.expected_parent_version + 1}.`)
        || !await requestIsAal2(scope)) return false;
      const document = await scope.query<{ valid: boolean }>(`select
          d.tenant_id=$2 and d.workspace_id=$3 and d.current_version=$4
          and d.status='active'::platform.record_status
          and d.archived_at is null and d.deleted_at is null
          and not exists(select 1 from documents.upload_intents ui
            where ui.id=$5 or ui.object_path=$6) as valid
        from documents.documents d where d.id=$1 for update of d`, [
        input.document_id, scope.tenant_id, input.workspace_id, input.expected_parent_version,
        input.intent_id, input.object_path,
      ]);
      if (document.rowCount !== 1 || document.rows[0]?.valid !== true) return false;
      const parent = await scope.query<{ valid: boolean }>(`select
          v.tenant_id=$2 and v.document_id=$3 and v.version=$4 as valid
        from documents.document_versions v where v.id=$1 for share of v`, [
        input.expected_parent_version_id, scope.tenant_id, input.document_id,
        input.expected_parent_version,
      ]);
      return parent.rowCount === 1 && parent.rows[0]?.valid === true
        && new Date(input.expires_at).getTime() > Date.now()
        && new Date(input.expires_at).getTime() <= Date.now() + 15 * 60_000;
    },
    async mutate(scope: CoreTransactionScopeV1, commandValue: CoreTransactionCommandV1) {
      if (!exactCommand(expected, commandValue)) throw new Error('documents_replacement_intent_command_mismatch');
      const authHash = createHash('sha256').update([
        input.intent_id, input.document_id, input.expected_parent_version_id, input.object_path,
        scope.actor_id, input.workspace_id,
      ].join(':')).digest('hex');
      const inserted = await scope.query<{ mutation_id: string }>(`insert into documents.upload_intents(
          id,tenant_id,context_id,user_id,document_id,bucket_id,object_path,expected_version,
          declared_mime_type,max_size_bytes,idempotency_key,status,server_auth_hash,expires_at,
          workspace_id,prospective_document_id,operation_kind,expected_parent_version_id)
        values($1,$2,$3,$4,$5,'document-vault',$6,$7,$8,$9,$10,'authorized',$11,$12,$13,null,
          'replacement_version',$14)
        returning id::text as mutation_id`, [
        input.intent_id, scope.tenant_id, input.context_id, scope.actor_id, input.document_id,
        input.object_path, input.expected_parent_version + 1, input.declared_mime_type,
        input.max_size_bytes, input.idempotency_key, authHash, input.expires_at,
        input.workspace_id, input.expected_parent_version_id,
      ]);
      if (inserted.rowCount !== 1) throw new Error('documents_replacement_intent_insert_failed');
      return { mutation_id: inserted.rows[0].mutation_id };
    },
  });
}

export function createDocumentsReplacementCandidateProvidersV1(
  inputValue: DocumentsReplacementCandidateV1,
  contextValue: z.input<typeof commandContextSchema>,
  verifiedObjectValue: VerifiedDocumentsStoredObjectV1,
): CoreTransactionProvidersV1 {
  const input = documentsReplacementCandidateV1Schema.parse(inputValue);
  const context = commandContextSchema.parse(contextValue);
  const object = requireVerifiedDocumentsStoredObjectV1(verifiedObjectValue);
  const expected = buildDocumentsReplacementCandidateCommandV1(input, context, verifiedObjectValue);
  return Object.freeze({
    replay_policy: 'provider_current_state_required' as const,
    replay_provider_code: DOCUMENTS_REPLACEMENT_WRITER_REPLAY_PROVIDER_CODE_V1,
    resolveAuthority,
    async validateProviders(scope: CoreTransactionScopeV1, commandValue: CoreTransactionCommandV1,
      authority: CurrentAuthorityTransactionDecisionReceiptV1) {
      if (!exactCommand(expected, commandValue) || !authorityMatches(scope, commandValue, authority)
        || scope.workspace_id !== input.workspace_id || scope.actor_id !== context.actor_id
        || !await requestIsAal2(scope)) return false;
      const intent = await scope.query<{ valid: boolean }>(`select
          ui.tenant_id=$2 and ui.context_id=$3 and ui.workspace_id=$4 and ui.user_id=$5
          and ui.operation_kind='replacement_version' and ui.document_id=$6
          and ui.prospective_document_id is null and ui.expected_parent_version_id=$7
          and ui.expected_version=$8+1 and ui.bucket_id=$9 and ui.object_path=$10
          and ui.declared_mime_type=$11 and ui.max_size_bytes >= $12
          and ui.status='authorized' and ui.consumed_at is null
          and ui.committed_document_id is null and ui.committed_version_id is null
          and ui.verified_storage_object_id is null and ui.verified_sha256 is null
          and ui.attempts < ui.max_attempts and ui.expires_at > clock_timestamp() as valid
        from documents.upload_intents ui where ui.id=$1 for update of ui`, [
        input.intent_id, scope.tenant_id, input.context_id, input.workspace_id, scope.actor_id,
        input.document_id, input.parent_version_id, input.parent_version, object.bucket_id,
        object.object_path, object.detected_mime_type, object.size_bytes,
      ]);
      if (intent.rowCount !== 1 || intent.rows[0]?.valid !== true) return false;
      const document = await scope.query<{ valid: boolean }>(`select
          d.tenant_id=$2 and d.workspace_id=$3 and d.current_version=$4
          and d.status='active'::platform.record_status
          and d.archived_at is null and d.deleted_at is null as valid
        from documents.documents d where d.id=$1 for update of d`, [
        input.document_id, scope.tenant_id, input.workspace_id, input.parent_version,
      ]);
      if (document.rowCount !== 1 || document.rows[0]?.valid !== true) return false;
      const parent = await scope.query<{ valid: boolean }>(`select
          v.tenant_id=$2 and v.document_id=$3 and v.version=$4 as valid
        from documents.document_versions v where v.id=$1 for share of v`, [
        input.parent_version_id, scope.tenant_id, input.document_id, input.parent_version,
      ]);
      if (parent.rowCount !== 1 || parent.rows[0]?.valid !== true) return false;
      const candidate = await scope.query<{ valid: boolean }>(`select not exists(
          select 1 from documents.document_versions v where v.id=$1
            or (v.document_id=$2 and v.version=$3)) as valid`, [
        input.version_id, input.document_id, input.parent_version + 1,
      ]);
      return candidate.rowCount === 1 && candidate.rows[0]?.valid === true;
    },
    async validateReplay(scope: CoreTransactionScopeV1, commandValue: CoreTransactionCommandV1,
      authority: CurrentAuthorityTransactionDecisionReceiptV1, receipt: CoreTransactionReceiptV1) {
      const exactReceipt = receipt.contract_version === 'core-transaction-receipt.v1'
        && receipt.replay_validation?.contract_version
          === 'core-transaction-replay-provider-requirement.v1'
        && receipt.replay_validation.provider_code
          === DOCUMENTS_REPLACEMENT_WRITER_REPLAY_PROVIDER_CODE_V1
        && receipt.transaction_id === commandValue.transaction_id
        && receipt.command_id === commandValue.command_id
        && receipt.workspace_id === input.workspace_id
        && receipt.actor_id === context.actor_id
        && receipt.aggregate_type === DOCUMENTS_REPLACEMENT_WRITER_BINDINGS_V1.aggregate_type
        && receipt.aggregate_id === input.document_id
        && receipt.aggregate_version === input.parent_version + 1
        && receipt.input_fingerprint === commandValue.input_fingerprint
        && receipt.idempotency_key === input.idempotency_key
        && receipt.mutation_id === input.version_id
        && receipt.authority.context_id === input.context_id
        && receipt.authority.workspace_id === input.workspace_id
        && receipt.authority.actor_id === context.actor_id
        && receipt.authority.permission_code
          === DOCUMENTS_REPLACEMENT_WRITER_BINDINGS_V1.permission_code
        && receipt.authority.module_code === DOCUMENTS_REPLACEMENT_WRITER_BINDINGS_V1.module_code
        && receipt.authority.evaluation_purpose
          === DOCUMENTS_REPLACEMENT_WRITER_BINDINGS_V1.finalize_purpose;
      const exactBindings = exactCommand(expected, commandValue)
        && authorityMatches(scope, commandValue, authority)
        && scope.transaction_id === context.transaction_id
        && scope.workspace_id === input.workspace_id && scope.actor_id === context.actor_id;
      const state = await scope.query<{ valid: boolean; now: string }>(`select exists(
          select 1 from documents.upload_intents ui
          join documents.documents d on d.id=$6 and d.tenant_id=ui.tenant_id
          join documents.document_versions p on p.id=$7 and p.tenant_id=ui.tenant_id
            and p.document_id=d.id
          join documents.document_versions v on v.id=$13 and v.tenant_id=ui.tenant_id
            and v.document_id=d.id
          where ui.id=$1 and ui.tenant_id=$2 and ui.context_id=$3 and ui.workspace_id=$4
            and ui.user_id=$5 and ui.operation_kind='replacement_version'
            and ui.document_id=$6 and ui.prospective_document_id is null
            and ui.expected_parent_version_id=$7 and ui.expected_version=$8+1
            and ui.bucket_id=$9 and ui.object_path=$10
            and ui.declared_mime_type=$11 and ui.max_size_bytes >= $12
            and ui.status='consumed' and ui.consumed_at is not null and ui.attempts=1
            and ui.committed_document_id=$6 and ui.committed_version_id=$13
            and ui.verified_storage_object_id=$14
            and ui.verified_storage_generation is not distinct from $15
            and ui.verified_storage_etag is not distinct from $16
            and ui.verified_sha256=$17 and ui.verified_size_bytes=$12
            and d.workspace_id=$4 and d.status='active'::platform.record_status
            and d.archived_at is null and d.deleted_at is null
            and d.current_version in ($8,$8+1)
            and p.version=$8
            and v.version=$8+1 and v.replaces_version_id=$7 and v.upload_intent_id=$1
            and v.bucket_id=$9 and v.object_path=$10 and v.storage_object_id=$14
            and v.storage_generation is not distinct from $15
            and v.storage_etag is not distinct from $16
            and v.sha256=$17 and v.size_bytes=$12 and v.mime_type=$11
            and v.detected_mime_type=$11 and v.checksum_status='verified'
            and v.scanning_status in ('scanning_pending','clean')
            and v.uploaded_by=$5
            and auth.uid()=$5 and coalesce(auth.jwt()->>'aal','')='aal2'
          for share of ui,d,p,v
        ) as valid,clock_timestamp()::text as now`, [
        input.intent_id, scope.tenant_id, input.context_id, input.workspace_id, scope.actor_id,
        input.document_id, input.parent_version_id, input.parent_version, object.bucket_id,
        object.object_path, object.detected_mime_type, object.size_bytes, input.version_id,
        object.storage_object_id, object.storage_generation, object.storage_etag, object.sha256,
      ]);
      const evaluatedAt = new Date(state.rows[0]?.now ?? authority.evaluated_at).toISOString();
      return replayDecision(scope, commandValue, authority, receipt, evaluatedAt,
        exactBindings && exactReceipt && state.rowCount === 1 && state.rows[0]?.valid === true);
    },
    async mutate(scope: CoreTransactionScopeV1, commandValue: CoreTransactionCommandV1) {
      if (!exactCommand(expected, commandValue)) throw new Error('documents_replacement_candidate_command_mismatch');
      await scope.query(`select set_config('documents.canonical_storage_identity_v1',$1,true)`, [
        JSON.stringify({
          contract_version: 'documents-canonical-storage-identity.v1',
          intent_id: input.intent_id, document_id: input.document_id,
          version_id: input.version_id, workspace_id: input.workspace_id, actor_id: scope.actor_id,
          bucket_id: object.bucket_id, object_path: object.object_path,
          storage_object_id: object.storage_object_id,
          generation_capability: object.generation_capability,
          storage_generation: object.storage_generation,
          etag_capability: object.etag_capability, storage_etag: object.storage_etag,
          sha256: object.sha256, size_bytes: object.size_bytes,
          detected_mime_type: object.detected_mime_type,
          non_overwritable: object.non_overwritable,
        }),
      ]);
      const consumed = await scope.query(`update documents.upload_intents
        set status='consumed',consumed_at=clock_timestamp(),attempts=attempts+1,
          committed_document_id=$4,committed_version_id=$5,
          verified_storage_object_id=$6,verified_storage_generation=$7,
          verified_storage_etag=$8,verified_sha256=$9,verified_size_bytes=$10
        where id=$1 and tenant_id=$2 and workspace_id=$3 and document_id=$4
          and operation_kind='replacement_version' and expected_parent_version_id=$11
          and status='authorized' and consumed_at is null`, [
        input.intent_id, scope.tenant_id, input.workspace_id, input.document_id,
        input.version_id, object.storage_object_id, object.storage_generation,
        object.storage_etag, object.sha256, object.size_bytes, input.parent_version_id,
      ]);
      if (consumed.rowCount !== 1) throw new Error('documents_replacement_intent_consume_failed');
      const version = await scope.query<{ mutation_id: string }>(`insert into documents.document_versions(
          id,tenant_id,document_id,version,object_path,sha256,mime_type,size_bytes,metadata_json,
          uploaded_by,checksum_status,scanning_status,detected_mime_type,created_at,
          upload_intent_id,replaces_version_id,bucket_id,storage_object_id,
          storage_generation,storage_etag)
        values($1,$2,$3,$4,$5,$6,$7,$8,jsonb_build_object(
          'binding_contract','documents-replacement-workspace-writer.v1',
          'workspace_id',$9::text,'upload_intent_id',$10::text,
          'parent_version_id',$11::text,'transaction_id',$12::text,'command_id',$13::text),
          $14,'verified','scanning_pending',$7,clock_timestamp(),
          $10::uuid,$11::uuid,'document-vault',$15::uuid,$16,$17)
        returning id::text as mutation_id`, [
        input.version_id, scope.tenant_id, input.document_id, input.parent_version + 1,
        object.object_path, object.sha256, object.detected_mime_type, object.size_bytes,
        input.workspace_id, input.intent_id, input.parent_version_id,
        commandValue.transaction_id, commandValue.command_id, scope.actor_id,
        object.storage_object_id, object.storage_generation, object.storage_etag,
      ]);
      if (version.rowCount !== 1) throw new Error('documents_replacement_version_insert_failed');
      await scope.query(`insert into documents.access_events(
          tenant_id,document_id,version_id,actor_id,action,purpose)
        values($1,$2,$3,$4,'finalize_upload','Replacement candidate committed pending clean promotion')`, [
        scope.tenant_id, input.document_id, input.version_id, scope.actor_id,
      ]);
      return { mutation_id: version.rows[0].mutation_id };
    },
  });
}
