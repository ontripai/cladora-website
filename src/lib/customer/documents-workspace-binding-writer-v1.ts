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
import type { CurrentAuthorityTransactionDecisionReceiptV1 } from '../core/current-authority-transaction-port-v1';
import {
  coreTransactionReplayCommandHashV1,
  coreTransactionReplayReceiptHashV1,
  type CoreTransactionReplayProviderDecisionV1,
} from '../core/transaction-replay-provider-hook-v1';

const uuid = z.string().uuid().transform(value => value.toLowerCase());
const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
const mime = z.string().trim().toLowerCase().min(3).max(160);
const allowedMime = mime.refine(value => new Set([
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]).has(value), 'unsupported_document_mime_type');

const commandContextSchema = z.strictObject({
  transaction_id: uuid,
  command_id: uuid,
  actor_id: uuid,
  authority_version: z.number().int().positive().safe(),
});

const safeFilename = z.string().trim().min(1).max(255).refine(value => {
  const extension = value.split('.').at(-1)?.toLowerCase();
  return !extension || !new Set([
    'exe', 'sh', 'bat', 'cmd', 'js', 'mjs', 'ts', 'html', 'htm', 'svg', 'php', 'py',
    'zip', 'tar', 'gz', 'rar',
  ]).has(extension);
}, 'disallowed_file_extension');

export const documentsNewDocumentIntentV1Schema = z.strictObject({
  contract_version: z.literal('documents-new-document-intent.v1'),
  context_id: uuid,
  workspace_id: uuid,
  intent_id: uuid,
  prospective_document_id: uuid,
  filename: safeFilename,
  object_path: z.string().min(3).max(1024),
  declared_mime_type: allowedMime,
  max_size_bytes: z.number().int().positive().max(20 * 1024 * 1024),
  expires_at: z.string().datetime({ offset: true }),
  idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
});
export type DocumentsNewDocumentIntentV1 = z.input<typeof documentsNewDocumentIntentV1Schema>;

export const documentsInitialVersionV1Schema = z.strictObject({
  contract_version: z.literal('documents-initial-version.v1'),
  context_id: uuid,
  workspace_id: uuid,
  intent_id: uuid,
  document_id: uuid,
  version_id: uuid,
  title: z.string().trim().min(1).max(500),
  document_type: z.string().trim().min(1).max(120),
  classification: z.enum(['public', 'internal', 'confidential', 'restricted']),
  idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
});
export type DocumentsInitialVersionV1 = z.input<typeof documentsInitialVersionV1Schema>;

const verifiedObjectSchema = z.strictObject({
  bucket_id: z.literal('document-vault'),
  object_path: z.string().min(3).max(1024),
  sha256,
  size_bytes: z.number().int().positive().max(20 * 1024 * 1024),
  detected_mime_type: allowedMime,
  non_overwritable: z.literal(true),
});
export type DocumentsStoredObjectMeasurementV1 = z.infer<typeof verifiedObjectSchema>;

const verifiedObjectBrand = Symbol('documents-stored-object-verification.v1');
export type VerifiedDocumentsStoredObjectV1 = Readonly<DocumentsStoredObjectMeasurementV1> & {
  readonly [verifiedObjectBrand]: true;
};

export type DocumentsStoredObjectVerifierV1 = (
  target: Readonly<{ bucket_id: 'document-vault'; object_path: string }>,
) => Promise<unknown>;

/** Storage/network verification must finish before the Core SQL transaction begins. */
export async function verifyDocumentsStoredObjectBeforeTransactionV1(
  target: Readonly<{ bucket_id: 'document-vault'; object_path: string }>,
  verifier: DocumentsStoredObjectVerifierV1,
): Promise<VerifiedDocumentsStoredObjectV1> {
  const normalizedTarget = z.strictObject({
    bucket_id: z.literal('document-vault'), object_path: z.string().min(3).max(1024),
  }).parse(target);
  const measurement = verifiedObjectSchema.parse(await verifier(Object.freeze(normalizedTarget)));
  if (measurement.bucket_id !== normalizedTarget.bucket_id
    || measurement.object_path !== normalizedTarget.object_path) {
    throw new Error('stored_object_binding_mismatch');
  }
  return Object.freeze(Object.assign(measurement, { [verifiedObjectBrand]: true as const }));
}

export const DOCUMENTS_WORKSPACE_WRITER_BINDINGS_V1 = Object.freeze({
  permission_code: 'documents.vault.upload',
  module_code: 'documents',
  aggregate_type: 'documents.document',
  intent_purpose: 'documents.workspace_upload.intent',
  finalize_purpose: 'documents.workspace_upload.finalize',
} as const);

export const DOCUMENTS_WORKSPACE_WRITER_REPLAY_PROVIDER_CODE_V1 =
  'documents-workspace-binding-writer.v1' as const;

type CommandContext = z.infer<typeof commandContextSchema>;
type ParsedIntent = z.infer<typeof documentsNewDocumentIntentV1Schema>;
type ParsedVersion = z.infer<typeof documentsInitialVersionV1Schema>;

function fingerprint(prefix: string, value: unknown) {
  return `${prefix}:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
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
    && authority.permission_code === DOCUMENTS_WORKSPACE_WRITER_BINDINGS_V1.permission_code
    && authority.module_code === DOCUMENTS_WORKSPACE_WRITER_BINDINGS_V1.module_code;
}

function baseCommand(
  input: { context_id: string; workspace_id: string; idempotency_key: string },
  context: CommandContext,
  purpose: string,
  documentId: string,
  providerSourceIds: string[],
  inputFingerprint: string,
): CoreTransactionCommandV1 {
  return coreTransactionCommandV1Schema.parse({
    contract_version: 'core-transaction-command.v1',
    transaction_id: context.transaction_id,
    command_id: context.command_id,
    context_id: input.context_id,
    workspace_id: input.workspace_id,
    actor_id: context.actor_id,
    authority_version: context.authority_version,
    permission_code: DOCUMENTS_WORKSPACE_WRITER_BINDINGS_V1.permission_code,
    module_code: DOCUMENTS_WORKSPACE_WRITER_BINDINGS_V1.module_code,
    evaluation_purpose: purpose,
    aggregate_type: DOCUMENTS_WORKSPACE_WRITER_BINDINGS_V1.aggregate_type,
    aggregate_id: documentId,
    aggregate_version: 1,
    provider_source_ids: providerSourceIds,
    idempotency_key: input.idempotency_key,
    input_fingerprint: inputFingerprint,
  });
}

export function buildDocumentsNewDocumentIntentCommandV1(
  inputValue: DocumentsNewDocumentIntentV1,
  contextValue: z.input<typeof commandContextSchema>,
): CoreTransactionCommandV1 {
  const input = documentsNewDocumentIntentV1Schema.parse(inputValue);
  const context = commandContextSchema.parse(contextValue);
  return baseCommand(input, context, DOCUMENTS_WORKSPACE_WRITER_BINDINGS_V1.intent_purpose,
    input.prospective_document_id, [input.intent_id, input.prospective_document_id],
    fingerprint('docwi1', { input, actor_id: context.actor_id }));
}

export function buildDocumentsInitialVersionCommandV1(
  inputValue: DocumentsInitialVersionV1,
  contextValue: z.input<typeof commandContextSchema>,
  verifiedObject: VerifiedDocumentsStoredObjectV1,
): CoreTransactionCommandV1 {
  const input = documentsInitialVersionV1Schema.parse(inputValue);
  const context = commandContextSchema.parse(contextValue);
  const object = requireVerifiedObject(verifiedObject);
  return baseCommand(input, context, DOCUMENTS_WORKSPACE_WRITER_BINDINGS_V1.finalize_purpose,
    input.document_id, [input.intent_id, input.document_id, input.version_id],
    fingerprint('docwf1', { input, object, actor_id: context.actor_id }));
}

function requireVerifiedObject(value: VerifiedDocumentsStoredObjectV1) {
  if (!value || value[verifiedObjectBrand] !== true) throw new Error('stored_object_verification_required');
  return verifiedObjectSchema.parse(value);
}

function exactCommand(expected: CoreTransactionCommandV1, actual: CoreTransactionCommandV1) {
  return JSON.stringify(actual) === JSON.stringify(expected);
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
    provider_code: DOCUMENTS_WORKSPACE_WRITER_REPLAY_PROVIDER_CODE_V1,
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

async function requestIsAal2(scope: CoreTransactionScopeV1) {
  const result = await scope.query<{ valid: boolean }>(
    `select auth.uid()=$1::uuid and coalesce(auth.jwt()->>'aal','')='aal2' as valid`,
    [scope.actor_id],
  );
  return result.rowCount === 1 && result.rows[0]?.valid === true;
}

export function createDocumentsNewDocumentIntentProvidersV1(
  inputValue: DocumentsNewDocumentIntentV1,
  contextValue: z.input<typeof commandContextSchema>,
): CoreTransactionProvidersV1 {
  const input = documentsNewDocumentIntentV1Schema.parse(inputValue);
  const context = commandContextSchema.parse(contextValue);
  const expected = buildDocumentsNewDocumentIntentCommandV1(input, context);
  const providers: CoreTransactionProvidersV1 = {
    resolveAuthority,
    async validateProviders(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1,
      authority: CurrentAuthorityTransactionDecisionReceiptV1) {
      if (!exactCommand(expected, command) || !authorityMatches(scope, command, authority)
        || scope.workspace_id !== input.workspace_id || scope.actor_id !== context.actor_id
        || !input.object_path.startsWith(`${scope.tenant_id}/${input.intent_id}/v1.`)
        || input.object_path.includes('..') || !await requestIsAal2(scope)) return false;
      const state = await scope.query<{ valid: boolean }>(`select
          $1::timestamptz > clock_timestamp()
          and $1::timestamptz <= clock_timestamp() + interval '15 minutes'
          and not exists(select 1 from documents.documents d where d.id=$2)
          and not exists(select 1 from documents.upload_intents ui
            where ui.id=$3 or ui.prospective_document_id=$2) as valid`,
        [input.expires_at, input.prospective_document_id, input.intent_id]);
      return state.rowCount === 1 && state.rows[0]?.valid === true;
    },
    async mutate(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1) {
      if (!exactCommand(expected, command)) throw new Error('documents_intent_command_mismatch');
      const authHash = createHash('sha256').update([
        input.intent_id, input.object_path, scope.actor_id, input.workspace_id,
      ].join(':')).digest('hex');
      const inserted = await scope.query<{ mutation_id: string }>(`insert into documents.upload_intents(
          id,tenant_id,context_id,user_id,document_id,bucket_id,object_path,expected_version,
          declared_mime_type,max_size_bytes,idempotency_key,status,server_auth_hash,expires_at,
          workspace_id,prospective_document_id)
        values($1,$2,$3,$4,null,'document-vault',$5,1,$6,$7,$8,'authorized',$9,$10,$11,$12)
        returning id::text as mutation_id`, [
        input.intent_id, scope.tenant_id, input.context_id, scope.actor_id, input.object_path,
        input.declared_mime_type, input.max_size_bytes, input.idempotency_key, authHash,
        input.expires_at, input.workspace_id, input.prospective_document_id,
      ]);
      if (inserted.rowCount !== 1) throw new Error('documents_intent_insert_failed');
      return { mutation_id: inserted.rows[0].mutation_id };
    },
  };
  return Object.freeze(providers);
}

export function createDocumentsInitialVersionProvidersV1(
  inputValue: DocumentsInitialVersionV1,
  contextValue: z.input<typeof commandContextSchema>,
  verifiedObjectValue: VerifiedDocumentsStoredObjectV1,
): CoreTransactionProvidersV1 {
  const input = documentsInitialVersionV1Schema.parse(inputValue);
  const context = commandContextSchema.parse(contextValue);
  const object = requireVerifiedObject(verifiedObjectValue);
  const expected = buildDocumentsInitialVersionCommandV1(input, context, verifiedObjectValue);
  const providers: CoreTransactionProvidersV1 = {
    replay_policy: 'provider_current_state_required',
    replay_provider_code: DOCUMENTS_WORKSPACE_WRITER_REPLAY_PROVIDER_CODE_V1,
    resolveAuthority,
    async validateProviders(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1,
      authority: CurrentAuthorityTransactionDecisionReceiptV1) {
      if (!exactCommand(expected, command) || !authorityMatches(scope, command, authority)
        || scope.workspace_id !== input.workspace_id || scope.actor_id !== context.actor_id
        || !await requestIsAal2(scope)) return false;
      const state = await scope.query<{ valid: boolean }>(`select
          ui.tenant_id=$2 and ui.context_id=$3 and ui.workspace_id=$4
          and ui.user_id=$5 and ui.prospective_document_id=$6
          and ui.document_id is null and ui.expected_version=1
          and ui.bucket_id=$7 and ui.object_path=$8
          and ui.declared_mime_type=$9 and ui.max_size_bytes >= $10
          and ui.status='authorized' and ui.consumed_at is null
          and ui.attempts < ui.max_attempts and ui.expires_at > clock_timestamp()
          and not exists(select 1 from documents.documents d where d.id=$6)
          and not exists(select 1 from documents.document_versions v where v.id=$11)
          as valid
        from documents.upload_intents ui where ui.id=$1
        for update of ui`, [
        input.intent_id, scope.tenant_id, input.context_id, input.workspace_id, scope.actor_id,
        input.document_id, object.bucket_id, object.object_path, object.detected_mime_type,
        object.size_bytes, input.version_id,
      ]);
      return state.rowCount === 1 && state.rows[0]?.valid === true;
    },
    async validateReplay(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1,
      authority: CurrentAuthorityTransactionDecisionReceiptV1, receipt: CoreTransactionReceiptV1) {
      const exactReceipt = receipt.contract_version === 'core-transaction-receipt.v1'
        && receipt.replay_validation?.contract_version
          === 'core-transaction-replay-provider-requirement.v1'
        && receipt.replay_validation.provider_code
          === DOCUMENTS_WORKSPACE_WRITER_REPLAY_PROVIDER_CODE_V1
        && receipt.transaction_id === command.transaction_id
        && receipt.command_id === command.command_id
        && receipt.workspace_id === input.workspace_id
        && receipt.actor_id === context.actor_id
        && receipt.aggregate_type === DOCUMENTS_WORKSPACE_WRITER_BINDINGS_V1.aggregate_type
        && receipt.aggregate_id === input.document_id
        && receipt.aggregate_version === 1
        && receipt.input_fingerprint === command.input_fingerprint
        && receipt.idempotency_key === input.idempotency_key
        && receipt.mutation_id === input.version_id
        && receipt.authority.context_id === input.context_id
        && receipt.authority.workspace_id === input.workspace_id
        && receipt.authority.actor_id === context.actor_id
        && receipt.authority.permission_code
          === DOCUMENTS_WORKSPACE_WRITER_BINDINGS_V1.permission_code
        && receipt.authority.module_code === DOCUMENTS_WORKSPACE_WRITER_BINDINGS_V1.module_code
        && receipt.authority.evaluation_purpose
          === DOCUMENTS_WORKSPACE_WRITER_BINDINGS_V1.finalize_purpose
        && receipt.authority.transaction_context.transaction_id === command.transaction_id
        && receipt.authority.transaction_context.command_id === command.command_id
        && receipt.authority.transaction_context.lock.workspace_id === input.workspace_id
        && receipt.authority.transaction_context.lock.aggregate_type
          === DOCUMENTS_WORKSPACE_WRITER_BINDINGS_V1.aggregate_type
        && receipt.authority.transaction_context.lock.aggregate_id === input.document_id;
      const exactBindings = exactCommand(expected, command)
        && authorityMatches(scope, command, authority)
        && scope.transaction_id === context.transaction_id
        && scope.workspace_id === input.workspace_id
        && scope.actor_id === context.actor_id;
      const state = await scope.query<{ valid: boolean; now: string }>(`select exists(
          select 1
          from documents.upload_intents ui
          join documents.documents d on d.id=$6 and d.tenant_id=ui.tenant_id
          join documents.document_versions v on v.id=$11 and v.tenant_id=ui.tenant_id
            and v.document_id=d.id
          where ui.id=$1 and ui.tenant_id=$2 and ui.context_id=$3 and ui.workspace_id=$4
            and ui.user_id=$5 and ui.prospective_document_id=$6 and ui.document_id is null
            and ui.expected_version=1 and ui.bucket_id=$7 and ui.object_path=$8
            and ui.declared_mime_type=$9 and ui.max_size_bytes >= $10
            and ui.status='consumed' and ui.consumed_at is not null and ui.attempts=1
            and d.workspace_id=$4 and d.title=$12 and d.document_type=$13
            and d.classification=$14::documents.classification and d.current_version=1
            and d.status='active'::platform.record_status and d.created_by=$5
            and d.property_id is null and d.category=$13
            and d.archived_at is null and d.deleted_at is null
            and v.version=1 and v.object_path=$8 and v.sha256=$15 and v.mime_type=$16
            and v.size_bytes=$10 and v.uploaded_by=$5 and v.checksum_status='verified'
            and v.detected_mime_type=$16
            and v.metadata_json=jsonb_build_object(
              'binding_contract','documents-workspace-binding-writer.v1',
              'workspace_id',$4::text,'upload_intent_id',$1::text,
              'transaction_id',$17::text,'command_id',$18::text)
            and auth.uid()=$5 and coalesce(auth.jwt()->>'aal','')='aal2'
            and exists(select 1 from documents.access_events ae
              where ae.tenant_id=ui.tenant_id and ae.document_id=d.id and ae.version_id=v.id
                and ae.actor_id=$5 and ae.action='finalize_upload'
                and ae.purpose='Initial Workspace-bound document finalized')
          for share of ui,d,v
        ) as valid,clock_timestamp()::text as now`, [
        input.intent_id, scope.tenant_id, input.context_id, input.workspace_id, scope.actor_id,
        input.document_id, object.bucket_id, object.object_path, object.detected_mime_type,
        object.size_bytes, input.version_id, input.title, input.document_type, input.classification,
        object.sha256, object.detected_mime_type, command.transaction_id, command.command_id,
      ]);
      const evaluatedAt = new Date(state.rows[0]?.now ?? authority.evaluated_at).toISOString();
      return replayDecision(scope, command, authority, receipt, evaluatedAt,
        exactBindings && exactReceipt && state.rowCount === 1 && state.rows[0]?.valid === true);
    },
    async mutate(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1) {
      if (!exactCommand(expected, command)) throw new Error('documents_finalize_command_mismatch');
      const consumed = await scope.query(`update documents.upload_intents
        set status='consumed',consumed_at=clock_timestamp(),attempts=attempts+1
        where id=$1 and tenant_id=$2 and workspace_id=$3 and prospective_document_id=$4
          and status='authorized' and consumed_at is null`,
      [input.intent_id, scope.tenant_id, input.workspace_id, input.document_id]);
      if (consumed.rowCount !== 1) throw new Error('documents_intent_consume_failed');
      const document = await scope.query(`insert into documents.documents(
          id,tenant_id,workspace_id,property_id,title,document_type,classification,current_version,
          status,created_by,category)
        values($1,$2,$3,null,$4,$5,$6::documents.classification,1,'active'::platform.record_status,$7,$5)`,
      [input.document_id, scope.tenant_id, input.workspace_id, input.title,
        input.document_type, input.classification, scope.actor_id]);
      if (document.rowCount !== 1) throw new Error('documents_document_insert_failed');
      const version = await scope.query<{ mutation_id: string }>(`insert into documents.document_versions(
          id,tenant_id,document_id,version,object_path,sha256,mime_type,size_bytes,metadata_json,
          uploaded_by,checksum_status,scanning_status,detected_mime_type,created_at)
        values($1,$2,$3,1,$4,$5,$6,$7,jsonb_build_object(
          'binding_contract','documents-workspace-binding-writer.v1',
          'workspace_id',$8::text,'upload_intent_id',$9::text,
          'transaction_id',$10::text,'command_id',$11::text),
          $12,'verified','deferred',$6,clock_timestamp())
        returning id::text as mutation_id`, [
        input.version_id, scope.tenant_id, input.document_id, object.object_path, object.sha256,
        object.detected_mime_type, object.size_bytes, input.workspace_id, input.intent_id,
        command.transaction_id, command.command_id, scope.actor_id,
      ]);
      if (version.rowCount !== 1) throw new Error('documents_version_insert_failed');
      await scope.query(`insert into documents.access_events(
          tenant_id,document_id,version_id,actor_id,action,purpose)
        values($1,$2,$3,$4,'finalize_upload','Initial Workspace-bound document finalized')`,
      [scope.tenant_id, input.document_id, input.version_id, scope.actor_id]);
      return { mutation_id: version.rows[0].mutation_id };
    },
  };
  return Object.freeze(providers);
}

