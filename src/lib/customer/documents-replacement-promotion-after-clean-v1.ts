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
const contextSchema = z.strictObject({
  transaction_id: uuid,
  command_id: uuid,
  actor_id: uuid,
  authority_version: z.number().int().positive().safe(),
});

export const documentsReplacementPromotionAfterCleanV1Schema = z.strictObject({
  contract_version: z.literal('documents-replacement-promotion-after-clean.v1'),
  context_id: uuid,
  workspace_id: uuid,
  intent_id: uuid,
  document_id: uuid,
  parent_version_id: uuid,
  parent_version: z.number().int().positive().safe(),
  candidate_version_id: uuid,
  candidate_version: z.number().int().min(2).safe(),
  attestation_id: uuid,
  idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
}).superRefine((value, refinement) => {
  if (value.candidate_version !== value.parent_version + 1) {
    refinement.addIssue({ code: 'custom', path: ['candidate_version'],
      message: 'candidate_version_must_follow_parent' });
  }
});
export type DocumentsReplacementPromotionAfterCleanV1 =
  z.input<typeof documentsReplacementPromotionAfterCleanV1Schema>;

export const DOCUMENTS_REPLACEMENT_PROMOTION_BINDINGS_V1 = Object.freeze({
  permission_code: 'documents.vault.upload',
  module_code: 'documents',
  aggregate_type: 'documents.document',
  purpose: 'documents.workspace_replacement.promote_after_clean',
} as const);

export const DOCUMENTS_REPLACEMENT_PROMOTION_REPLAY_PROVIDER_CODE_V1 =
  'documents-replacement-promotion-after-clean.v1' as const;

type ParsedInput = z.infer<typeof documentsReplacementPromotionAfterCleanV1Schema>;
type ParsedContext = z.infer<typeof contextSchema>;

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
    && authority.permission_code === DOCUMENTS_REPLACEMENT_PROMOTION_BINDINGS_V1.permission_code
    && authority.module_code === DOCUMENTS_REPLACEMENT_PROMOTION_BINDINGS_V1.module_code;
}

function fingerprint(value: unknown) {
  return `docrpp1:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
}

export function buildDocumentsReplacementPromotionAfterCleanCommandV1(
  inputValue: DocumentsReplacementPromotionAfterCleanV1,
  contextValue: z.input<typeof contextSchema>,
  verifiedObjectValue: VerifiedDocumentsStoredObjectV1,
) {
  const input = documentsReplacementPromotionAfterCleanV1Schema.parse(inputValue);
  const context = contextSchema.parse(contextValue);
  const object = requireVerifiedDocumentsStoredObjectV1(verifiedObjectValue);
  return coreTransactionCommandV1Schema.parse({
    contract_version: 'core-transaction-command.v1',
    transaction_id: context.transaction_id,
    command_id: context.command_id,
    context_id: input.context_id,
    workspace_id: input.workspace_id,
    actor_id: context.actor_id,
    authority_version: context.authority_version,
    permission_code: DOCUMENTS_REPLACEMENT_PROMOTION_BINDINGS_V1.permission_code,
    module_code: DOCUMENTS_REPLACEMENT_PROMOTION_BINDINGS_V1.module_code,
    evaluation_purpose: DOCUMENTS_REPLACEMENT_PROMOTION_BINDINGS_V1.purpose,
    aggregate_type: DOCUMENTS_REPLACEMENT_PROMOTION_BINDINGS_V1.aggregate_type,
    aggregate_id: input.document_id,
    aggregate_version: input.candidate_version,
    provider_source_ids: [input.intent_id, input.document_id, input.parent_version_id,
      input.candidate_version_id, input.attestation_id, object.storage_object_id],
    idempotency_key: input.idempotency_key,
    input_fingerprint: fingerprint({ input, object, actor_id: context.actor_id }),
  });
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
  command: CoreTransactionCommandV1,
  authority: CurrentAuthorityTransactionDecisionReceiptV1,
  receipt: CoreTransactionReceiptV1,
  evaluatedAt: string,
  accepted: boolean,
): CoreTransactionReplayProviderDecisionV1 {
  const binding = {
    contract_version: 'core-transaction-replay-provider-decision.v1' as const,
    decision_id: randomUUID(),
    provider_code: DOCUMENTS_REPLACEMENT_PROMOTION_REPLAY_PROVIDER_CODE_V1,
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

function promotionStateQuery(locking: boolean) {
  return `select
      ui.tenant_id=$2 and ui.context_id=$3 and ui.workspace_id=$4 and ui.user_id=$5
      and ui.operation_kind='replacement_version' and ui.document_id=$6
      and ui.prospective_document_id is null and ui.expected_parent_version_id=$7
      and ui.expected_version=$8+1 and ui.status='consumed' and ui.consumed_at is not null
      and ui.attempts=1 and ui.committed_document_id=$6 and ui.committed_version_id=$9
      and ui.bucket_id=$10 and ui.object_path=$11
      and ui.verified_storage_object_id=$12
      and ui.verified_storage_generation is not distinct from $13
      and ui.verified_storage_etag is not distinct from $14
      and ui.verified_sha256=$15 and ui.verified_size_bytes=$16 as valid
    from documents.upload_intents ui where ui.id=$1 ${locking ? 'for update of ui' : 'for share of ui'}`;
}

export function createDocumentsReplacementPromotionAfterCleanProvidersV1(
  inputValue: DocumentsReplacementPromotionAfterCleanV1,
  contextValue: z.input<typeof contextSchema>,
  verifiedObjectValue: VerifiedDocumentsStoredObjectV1,
): CoreTransactionProvidersV1 {
  const input: ParsedInput = documentsReplacementPromotionAfterCleanV1Schema.parse(inputValue);
  const context: ParsedContext = contextSchema.parse(contextValue);
  const object = requireVerifiedDocumentsStoredObjectV1(verifiedObjectValue);
  const expected = buildDocumentsReplacementPromotionAfterCleanCommandV1(
    input, context, verifiedObjectValue);
  const stateValues = (scope: CoreTransactionScopeV1) => [
    input.intent_id, scope.tenant_id, input.context_id, input.workspace_id, scope.actor_id,
    input.document_id, input.parent_version_id, input.parent_version,
    input.candidate_version_id, object.bucket_id, object.object_path, object.storage_object_id,
    object.storage_generation, object.storage_etag, object.sha256, object.size_bytes,
  ];
  return Object.freeze({
    replay_policy: 'provider_current_state_required' as const,
    replay_provider_code: DOCUMENTS_REPLACEMENT_PROMOTION_REPLAY_PROVIDER_CODE_V1,
    resolveAuthority,
    async validateProviders(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1,
      authority: CurrentAuthorityTransactionDecisionReceiptV1) {
      if (!exactCommand(expected, command) || !authorityMatches(scope, command, authority)
        || scope.workspace_id !== input.workspace_id || scope.actor_id !== context.actor_id
        || !await requestIsAal2(scope)) return false;
      const intent = await scope.query<{ valid: boolean }>(promotionStateQuery(true), stateValues(scope));
      if (intent.rowCount !== 1 || intent.rows[0]?.valid !== true) return false;
      const document = await scope.query<{ valid: boolean }>(`select
          d.tenant_id=$2 and d.workspace_id=$3 and d.current_version=$4
          and d.status='active'::platform.record_status and d.archived_at is null
          and d.deleted_at is null
          and coalesce(to_jsonb(d)->>'disposition_status','retained')
            not in ('disposition_approved','expired') as valid
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
      const candidate = await scope.query<{ valid: boolean }>(`select
          v.tenant_id=$2 and v.document_id=$3 and v.version=$4+1
          and v.replaces_version_id=$5 and v.upload_intent_id=$6
          and v.bucket_id=$7 and v.object_path=$8 and v.storage_object_id=$9
          and v.storage_generation is not distinct from $10
          and v.storage_etag is not distinct from $11
          and v.sha256=$12 and v.size_bytes=$13 and v.detected_mime_type=$14
          and v.checksum_status='verified' and v.scanning_status='clean' as valid
        from documents.document_versions v where v.id=$1 for share of v`, [
        input.candidate_version_id, scope.tenant_id, input.document_id, input.parent_version,
        input.parent_version_id, input.intent_id, object.bucket_id, object.object_path,
        object.storage_object_id, object.storage_generation, object.storage_etag, object.sha256,
        object.size_bytes, object.detected_mime_type,
      ]);
      if (candidate.rowCount !== 1 || candidate.rows[0]?.valid !== true) return false;
      const attestation = await scope.query<{ valid: boolean }>(`select
          a.tenant_id=$2 and a.version_id=$3 and a.provider='clamav'
          and a.verdict='clean' and a.content_sha256=$4 as valid
        from documents.document_scan_attestations a where a.id=$1 for share of a`, [
        input.attestation_id, scope.tenant_id, input.candidate_version_id, object.sha256,
      ]);
      return attestation.rowCount === 1 && attestation.rows[0]?.valid === true;
    },
    async validateReplay(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1,
      authority: CurrentAuthorityTransactionDecisionReceiptV1, receipt: CoreTransactionReceiptV1) {
      const exactReceipt = receipt.contract_version === 'core-transaction-receipt.v1'
        && receipt.replay_validation?.contract_version
          === 'core-transaction-replay-provider-requirement.v1'
        && receipt.replay_validation.provider_code
          === DOCUMENTS_REPLACEMENT_PROMOTION_REPLAY_PROVIDER_CODE_V1
        && receipt.transaction_id === command.transaction_id
        && receipt.command_id === command.command_id
        && receipt.workspace_id === input.workspace_id
        && receipt.actor_id === context.actor_id
        && receipt.aggregate_type === DOCUMENTS_REPLACEMENT_PROMOTION_BINDINGS_V1.aggregate_type
        && receipt.aggregate_id === input.document_id
        && receipt.aggregate_version === input.candidate_version
        && receipt.input_fingerprint === command.input_fingerprint
        && receipt.idempotency_key === input.idempotency_key
        && receipt.mutation_id === input.candidate_version_id
        && receipt.authority.context_id === input.context_id
        && receipt.authority.workspace_id === input.workspace_id
        && receipt.authority.actor_id === context.actor_id
        && receipt.authority.evaluation_purpose
          === DOCUMENTS_REPLACEMENT_PROMOTION_BINDINGS_V1.purpose;
      const state = await scope.query<{ valid: boolean; now: string }>(`select exists(
          select 1 from documents.upload_intents ui
          join documents.documents d on d.id=$6 and d.tenant_id=ui.tenant_id
          join documents.document_versions p on p.id=$7 and p.tenant_id=ui.tenant_id
          join documents.document_versions v on v.id=$9 and v.tenant_id=ui.tenant_id
          join documents.document_scan_attestations a on a.id=$17 and a.tenant_id=ui.tenant_id
          where ui.id=$1 and ui.tenant_id=$2 and ui.context_id=$3 and ui.workspace_id=$4
            and ui.user_id=$5 and ui.operation_kind='replacement_version'
            and ui.document_id=$6 and ui.expected_parent_version_id=$7
            and ui.expected_version=$8+1 and ui.status='consumed'
            and ui.committed_document_id=$6 and ui.committed_version_id=$9
            and ui.bucket_id=$10 and ui.object_path=$11
            and ui.verified_storage_object_id=$12
            and ui.verified_storage_generation is not distinct from $13
            and ui.verified_storage_etag is not distinct from $14
            and ui.verified_sha256=$15 and ui.verified_size_bytes=$16
            and d.workspace_id=$4 and d.current_version=$8+1
            and d.status='active'::platform.record_status and d.archived_at is null
            and d.deleted_at is null
            and p.document_id=d.id and p.version=$8
            and v.document_id=d.id and v.version=$8+1 and v.replaces_version_id=p.id
            and v.upload_intent_id=ui.id and v.storage_object_id=$12
            and v.sha256=$15 and v.size_bytes=$16 and v.scanning_status='clean'
            and a.version_id=v.id and a.provider='clamav' and a.verdict='clean'
            and a.content_sha256=v.sha256
            and auth.uid()=$5 and coalesce(auth.jwt()->>'aal','')='aal2'
          for share of ui,d,p,v,a
        ) as valid,clock_timestamp()::text as now`, [...stateValues(scope), input.attestation_id]);
      const evaluatedAt = new Date(state.rows[0]?.now ?? authority.evaluated_at).toISOString();
      return replayDecision(scope, command, authority, receipt, evaluatedAt,
        exactCommand(expected, command) && authorityMatches(scope, command, authority)
          && scope.transaction_id === context.transaction_id
          && state.rowCount === 1 && state.rows[0]?.valid === true && exactReceipt);
    },
    async mutate(scope: CoreTransactionScopeV1, command: CoreTransactionCommandV1) {
      if (!exactCommand(expected, command)) throw new Error('documents_replacement_promotion_command_mismatch');
      await scope.query(`select set_config('documents.replacement_promotion_after_clean_v1',$1,true)`, [
        JSON.stringify({
          contract_version: 'documents-replacement-promotion-after-clean.v1',
          context_id: input.context_id, intent_id: input.intent_id,
          document_id: input.document_id, workspace_id: input.workspace_id,
          actor_id: scope.actor_id, parent_version_id: input.parent_version_id,
          parent_version: input.parent_version, candidate_version_id: input.candidate_version_id,
          candidate_version: input.candidate_version, attestation_id: input.attestation_id,
          bucket_id: object.bucket_id, object_path: object.object_path,
          storage_object_id: object.storage_object_id,
          storage_generation: object.storage_generation, storage_etag: object.storage_etag,
          sha256: object.sha256, size_bytes: object.size_bytes,
        }),
      ]);
      const promoted = await scope.query<{ mutation_id: string }>(`update documents.documents
        set current_version=$4
        where id=$1 and tenant_id=$2 and workspace_id=$3 and current_version=$5
          and status='active'::platform.record_status and archived_at is null and deleted_at is null
        returning id::text as mutation_id`, [
        input.document_id, scope.tenant_id, input.workspace_id,
        input.candidate_version, input.parent_version,
      ]);
      if (promoted.rowCount !== 1) throw new Error('documents_replacement_promotion_cas_failed');
      await scope.query(`insert into documents.access_events(
          tenant_id,document_id,version_id,actor_id,action,purpose)
        values($1,$2,$3,$4,'promote_version','Clean replacement candidate promoted by CAS')`, [
        scope.tenant_id, input.document_id, input.candidate_version_id, scope.actor_id,
      ]);
      return { mutation_id: input.candidate_version_id };
    },
  });
}
