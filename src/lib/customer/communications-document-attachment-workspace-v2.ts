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
const contextSchema = z.strictObject({
  transaction_id: uuid,
  command_id: uuid,
  actor_id: uuid,
  authority_version: z.number().int().positive().safe(),
});

export const communicationsDocumentAttachmentWorkspaceV2Schema = z.strictObject({
  contract_version: z.literal('communications-document-attachment-workspace.v2'),
  context_id: uuid,
  workspace_id: uuid,
  attachment_id: uuid,
  conversation_id: uuid,
  message_id: uuid,
  expected_message_version: z.number().int().positive().safe(),
  document_id: uuid,
  version_id: uuid,
  expected_document_version: z.number().int().positive().safe(),
  idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
});
export type CommunicationsDocumentAttachmentWorkspaceV2 =
  z.input<typeof communicationsDocumentAttachmentWorkspaceV2Schema>;

export const COMMUNICATIONS_DOCUMENT_ATTACHMENT_BINDINGS_V2 = Object.freeze({
  permission_code: 'communications.feed.read',
  module_code: 'communications',
  aggregate_type: 'communications.private_message_document',
  purpose: 'communications.private_document.attach',
} as const);

export const COMMUNICATIONS_DOCUMENT_ATTACHMENT_REPLAY_PROVIDER_CODE_V2 =
  'communications-document-attachment-workspace.v2' as const;

type ParsedInput = z.infer<typeof communicationsDocumentAttachmentWorkspaceV2Schema>;
type ParsedContext = z.infer<typeof contextSchema>;
type ValidationRow = {
  valid: boolean;
  actor_membership_id: string;
  tenant_id: string;
  now: string;
};

function fingerprint(value: unknown) {
  return `commdav2:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
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
    && authority.permission_code === COMMUNICATIONS_DOCUMENT_ATTACHMENT_BINDINGS_V2.permission_code
    && authority.module_code === COMMUNICATIONS_DOCUMENT_ATTACHMENT_BINDINGS_V2.module_code;
}

export function buildCommunicationsDocumentAttachmentWorkspaceCommandV2(
  inputValue: CommunicationsDocumentAttachmentWorkspaceV2,
  contextValue: z.input<typeof contextSchema>,
) {
  const input = communicationsDocumentAttachmentWorkspaceV2Schema.parse(inputValue);
  const context = contextSchema.parse(contextValue);
  return coreTransactionCommandV1Schema.parse({
    contract_version: 'core-transaction-command.v1',
    transaction_id: context.transaction_id,
    command_id: context.command_id,
    context_id: input.context_id,
    workspace_id: input.workspace_id,
    actor_id: context.actor_id,
    authority_version: context.authority_version,
    permission_code: COMMUNICATIONS_DOCUMENT_ATTACHMENT_BINDINGS_V2.permission_code,
    module_code: COMMUNICATIONS_DOCUMENT_ATTACHMENT_BINDINGS_V2.module_code,
    evaluation_purpose: COMMUNICATIONS_DOCUMENT_ATTACHMENT_BINDINGS_V2.purpose,
    aggregate_type: COMMUNICATIONS_DOCUMENT_ATTACHMENT_BINDINGS_V2.aggregate_type,
    aggregate_id: input.attachment_id,
    aggregate_version: 1,
    provider_source_ids: [input.conversation_id, input.message_id, input.document_id,
      input.version_id],
    idempotency_key: input.idempotency_key,
    input_fingerprint: fingerprint({ input, actor_id: context.actor_id }),
  });
}

function validationSql(replay: boolean) {
  const attachmentState = replay
    ? `and exists(select 1 from communications.private_message_documents attachment
        where attachment.id=$4 and attachment.conversation_id=$5
          and attachment.message_id=$6 and attachment.document_id=$8
          and attachment.version_id=$9 and attachment.attached_by=membership.id)`
    : `and not exists(select 1 from communications.private_message_documents attachment
        where attachment.id=$4
          or (attachment.message_id=$6 and attachment.document_id=$8
            and attachment.version_id=$9))`;
  return `select membership.id::text actor_membership_id,
      membership.tenant_id::text tenant_id,clock_timestamp()::text now,
      auth.uid()=$2 and coalesce(auth.jwt()->>'role','')='authenticated'
      and coalesce(auth.jwt()->>'aal','')='aal2'
      and app_private.check_workspace_native_permission_v2(
        $1,$3,'communications.feed.read','communications') is true
      and conversation.workspace_id is not null
      and conversation.workspace_id=$3 and document.workspace_id=$3
      and conversation.tenant_id=membership.tenant_id
      and document.tenant_id=membership.tenant_id
      and message.conversation_id=conversation.id and message.sender_id=membership.id
      and message.version=$7 and message.lifecycle_state='available'
      and document.current_version=$10
      and document.status='active'::platform.record_status
      and document.archived_at is null and document.deleted_at is null
      and version.document_id=document.id and version.tenant_id=document.tenant_id
      and version.version=document.current_version
      and version.checksum_status='verified' and version.scanning_status='clean'
      and attestation.tenant_id=version.tenant_id and attestation.version_id=version.id
      and attestation.provider='clamav' and attestation.verdict='clean'
      and attestation.content_sha256=version.sha256
      and participant.membership_id=membership.id and participant.revoked_at is null
      and (select count(*) from communications.private_participants current_participant
        where current_participant.conversation_id=conversation.id
          and current_participant.revoked_at is null)>=2
      and not exists(
        select 1 from communications.private_participants current_participant
        where current_participant.conversation_id=conversation.id
          and current_participant.revoked_at is null
          and not communications.private_document_member_grant(
            conversation.id,document.id,current_participant.membership_id))
      ${attachmentState} as valid
    from identity.context_grants context_grant
    join identity.memberships membership
      on membership.id=context_grant.membership_id
      and membership.tenant_id=context_grant.tenant_id and membership.user_id=$2
      and membership.status='active' and membership.starts_at<=clock_timestamp()
      and (membership.ends_at is null or membership.ends_at>clock_timestamp())
    join communications.private_conversations conversation on conversation.id=$5
    join communications.private_messages message on message.id=$6
    join communications.private_participants participant
      on participant.conversation_id=conversation.id
    join documents.documents document on document.id=$8
    join documents.document_versions version on version.id=$9
    join documents.document_scan_attestations attestation on attestation.version_id=version.id
    where context_grant.id=$1 and context_grant.starts_at<=clock_timestamp()
      and (context_grant.ends_at is null or context_grant.ends_at>clock_timestamp())
    for share of context_grant,membership,conversation,message,participant,
      document,version,attestation`;
}

function selectorValues(input: ParsedInput, scope: CoreTransactionScopeV1) {
  return [input.context_id, scope.actor_id, input.workspace_id, input.attachment_id,
    input.conversation_id, input.message_id, input.expected_message_version,
    input.document_id, input.version_id, input.expected_document_version];
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
    provider_code: COMMUNICATIONS_DOCUMENT_ATTACHMENT_REPLAY_PROVIDER_CODE_V2,
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

export function createCommunicationsDocumentAttachmentWorkspaceProvidersV2(
  inputValue: CommunicationsDocumentAttachmentWorkspaceV2,
  contextValue: z.input<typeof contextSchema>,
): CoreTransactionProvidersV1 {
  const input: ParsedInput = communicationsDocumentAttachmentWorkspaceV2Schema.parse(inputValue);
  const context: ParsedContext = contextSchema.parse(contextValue);
  const expected = buildCommunicationsDocumentAttachmentWorkspaceCommandV2(input, context);
  let actorMembershipId: string | null = null;
  let tenantId: string | null = null;
  const providers: CoreTransactionProvidersV1 = {
    replay_policy: 'provider_current_state_required',
    replay_provider_code: COMMUNICATIONS_DOCUMENT_ATTACHMENT_REPLAY_PROVIDER_CODE_V2,
    resolveAuthority,
    async validateProviders(scope, command, authority) {
      actorMembershipId = null;
      tenantId = null;
      if (!exactCommand(expected, command) || !authorityMatches(scope, command, authority)
        || scope.workspace_id !== input.workspace_id || scope.actor_id !== context.actor_id) return false;
      const state = await scope.query<ValidationRow>(validationSql(false), selectorValues(input, scope));
      if (state.rowCount !== 1 || state.rows[0]?.valid !== true
        || state.rows[0].tenant_id !== scope.tenant_id) return false;
      actorMembershipId = state.rows[0].actor_membership_id;
      tenantId = state.rows[0].tenant_id;
      return true;
    },
    async validateReplay(scope, command, authority, receipt) {
      actorMembershipId = null;
      tenantId = null;
      const state = await scope.query<ValidationRow>(validationSql(true), selectorValues(input, scope));
      const exactReceipt = receipt.contract_version === 'core-transaction-receipt.v1'
        && receipt.replay_validation?.contract_version
          === 'core-transaction-replay-provider-requirement.v1'
        && receipt.replay_validation.provider_code
          === COMMUNICATIONS_DOCUMENT_ATTACHMENT_REPLAY_PROVIDER_CODE_V2
        && receipt.transaction_id === command.transaction_id
        && receipt.command_id === command.command_id
        && receipt.workspace_id === input.workspace_id
        && receipt.actor_id === context.actor_id
        && receipt.aggregate_type === COMMUNICATIONS_DOCUMENT_ATTACHMENT_BINDINGS_V2.aggregate_type
        && receipt.aggregate_id === input.attachment_id
        && receipt.aggregate_version === 1
        && receipt.input_fingerprint === command.input_fingerprint
        && receipt.idempotency_key === input.idempotency_key
        && receipt.mutation_id === input.attachment_id
        && receipt.authority.context_id === input.context_id
        && receipt.authority.workspace_id === input.workspace_id
        && receipt.authority.actor_id === context.actor_id
        && receipt.authority.evaluation_purpose
          === COMMUNICATIONS_DOCUMENT_ATTACHMENT_BINDINGS_V2.purpose;
      const accepted = exactCommand(expected, command) && authorityMatches(scope, command, authority)
        && scope.transaction_id === context.transaction_id
        && state.rowCount === 1 && state.rows[0]?.valid === true
        && state.rows[0].tenant_id === scope.tenant_id && exactReceipt;
      if (accepted) {
        actorMembershipId = state.rows[0].actor_membership_id;
        tenantId = state.rows[0].tenant_id;
      }
      return replayDecision(scope, command, authority, receipt,
        new Date(state.rows[0]?.now ?? authority.evaluated_at).toISOString(), accepted);
    },
    async mutate(scope, command) {
      if (!exactCommand(expected, command) || actorMembershipId === null
        || tenantId !== scope.tenant_id) {
        throw new Error('private_document_attachment_validation_required');
      }
      const marker = JSON.stringify({
        contract_version: input.contract_version,
        tenant_id: scope.tenant_id,
        workspace_id: input.workspace_id,
        conversation_id: input.conversation_id,
        message_id: input.message_id,
        document_id: input.document_id,
        version_id: input.version_id,
        attached_by: actorMembershipId,
      });
      await scope.query(`select set_config(
        'communications.document_attachment_workspace_gate_v2',$1,true)`, [marker]);
      const inserted = await scope.query<{ mutation_id: string }>(
        `insert into communications.private_message_documents(
          id,conversation_id,message_id,document_id,version_id,attached_by)
        values($1,$2,$3,$4,$5,$6)
        returning id::text mutation_id`, [input.attachment_id, input.conversation_id,
        input.message_id, input.document_id, input.version_id, actorMembershipId]);
      if (inserted.rowCount !== 1 || inserted.rows[0]?.mutation_id !== input.attachment_id) {
        throw new Error('private_document_attachment_insert_failed');
      }
      return { mutation_id: input.attachment_id };
    },
  };
  return Object.freeze(providers);
}
