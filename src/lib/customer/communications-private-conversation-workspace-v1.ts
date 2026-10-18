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

export const communicationsPrivateConversationWorkspaceV1Schema = z.strictObject({
  contract_version: z.literal('communications-private-conversation-workspace.v1'),
  context_id: uuid,
  workspace_id: uuid,
  conversation_id: uuid,
  unit_id: uuid,
  recipient_membership_id: uuid,
  initial_message_id: uuid,
  body: z.string().trim().min(1).max(5000),
  client_request_id: uuid,
  idempotency_key: z.string().min(8).max(160).regex(/^[A-Za-z0-9._:-]+$/),
});
export type CommunicationsPrivateConversationWorkspaceV1 =
  z.input<typeof communicationsPrivateConversationWorkspaceV1Schema>;

export const COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_BINDINGS_V1 = Object.freeze({
  permission_code: 'communications.feed.read',
  module_code: 'communications',
  aggregate_type: 'communications.private_conversation',
  purpose: 'communications.private_conversation.create',
} as const);

export const COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_REPLAY_PROVIDER_CODE_V1 =
  'communications-private-conversation-workspace.v1' as const;

type ParsedInput = z.infer<typeof communicationsPrivateConversationWorkspaceV1Schema>;
type ParsedContext = z.infer<typeof contextSchema>;
type ValidationRow = {
  valid: boolean;
  actor_membership_id: string;
  tenant_id: string;
  now: string;
};

function fingerprint(value: unknown) {
  return `commpcw1:${createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
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
    && authority.permission_code
      === COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_BINDINGS_V1.permission_code
    && authority.module_code
      === COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_BINDINGS_V1.module_code;
}

export function buildCommunicationsPrivateConversationWorkspaceCommandV1(
  inputValue: CommunicationsPrivateConversationWorkspaceV1,
  contextValue: z.input<typeof contextSchema>,
) {
  const input = communicationsPrivateConversationWorkspaceV1Schema.parse(inputValue);
  const context = contextSchema.parse(contextValue);
  return coreTransactionCommandV1Schema.parse({
    contract_version: 'core-transaction-command.v1',
    transaction_id: context.transaction_id,
    command_id: context.command_id,
    context_id: input.context_id,
    workspace_id: input.workspace_id,
    actor_id: context.actor_id,
    authority_version: context.authority_version,
    permission_code: COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_BINDINGS_V1.permission_code,
    module_code: COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_BINDINGS_V1.module_code,
    evaluation_purpose: COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_BINDINGS_V1.purpose,
    aggregate_type: COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_BINDINGS_V1.aggregate_type,
    aggregate_id: input.conversation_id,
    aggregate_version: 1,
    provider_source_ids: [input.unit_id, input.recipient_membership_id, input.initial_message_id],
    idempotency_key: input.idempotency_key,
    input_fingerprint: fingerprint({ input, actor_id: context.actor_id }),
  });
}

function validationSql(replay: boolean) {
  const freshOnly = replay ? '' : `and not exists(
      select 1 from communications.private_conversations existing
      where existing.id=$4 or (existing.created_by=m.id and existing.client_request_id=$8)
    )`;
  const replayState = replay ? `and exists(
      select 1
      from communications.private_conversations c
      join communications.private_participants actor_participant
        on actor_participant.conversation_id=c.id
        and actor_participant.membership_id=m.id
        and actor_participant.revoked_at is null
      join communications.private_participants recipient_participant
        on recipient_participant.conversation_id=c.id
        and recipient_participant.membership_id=$6
        and recipient_participant.revoked_at is null
      join communications.private_messages message
        on message.id=$7 and message.conversation_id=c.id
        and message.sender_id=m.id and message.client_request_id=$8
      where c.id=$4 and c.tenant_id=m.tenant_id and c.workspace_id=$3
        and c.unit_id=$5 and c.created_by=m.id and c.client_request_id=$8
        and message.body=$9 and message.version=1 and message.lifecycle_state='available'
        and (select count(*) from communications.private_participants current_participant
          where current_participant.conversation_id=c.id
            and current_participant.revoked_at is null)=2
    )` : '';
  return `select
      m.id::text actor_membership_id,m.tenant_id::text tenant_id,
      clock_timestamp()::text now,
      auth.uid()=$2 and coalesce(auth.jwt()->>'role','')='authenticated'
      and coalesce(auth.jwt()->>'aal','')='aal2'
      and m.status='active' and m.starts_at<=clock_timestamp()
      and (m.ends_at is null or m.ends_at>clock_timestamp())
      and g.starts_at<=clock_timestamp()
      and (g.ends_at is null or g.ends_at>clock_timestamp())
      and w.lifecycle_status='ACTIVE' and w.archived_at is null
      and binding.status='active' and binding.valid_from<=clock_timestamp()
      and (binding.valid_to is null or binding.valid_to>clock_timestamp())
      and communications.member_covers_unit(m.id,m.tenant_id,$5)
      and communications.member_covers_unit($6,m.tenant_id,$5)
      and communications.private_pair_allowed(m.id,$6,$5)
      ${freshOnly}
      ${replayState} as valid
    from identity.context_grants g
    join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
      and m.user_id=$2
    join platform.customer_workspaces w on w.id=$3 and w.tenant_id=m.tenant_id
    join portfolio.units u on u.id=$5 and u.tenant_id=m.tenant_id
    join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
    join platform.workspace_property_bindings binding
      on binding.customer_workspace_id=w.id and binding.tenant_id=w.tenant_id
      and binding.property_id=b.property_id
    where g.id=$1
    for share of g,m,w,u,b,binding`;
}

function selectorValues(input: ParsedInput, scope: CoreTransactionScopeV1) {
  return [input.context_id, scope.actor_id, input.workspace_id, input.conversation_id,
    input.unit_id, input.recipient_membership_id, input.initial_message_id,
    input.client_request_id, input.body];
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
    provider_code: COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_REPLAY_PROVIDER_CODE_V1,
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

export function createCommunicationsPrivateConversationWorkspaceProvidersV1(
  inputValue: CommunicationsPrivateConversationWorkspaceV1,
  contextValue: z.input<typeof contextSchema>,
): CoreTransactionProvidersV1 {
  const input: ParsedInput = communicationsPrivateConversationWorkspaceV1Schema.parse(inputValue);
  const context: ParsedContext = contextSchema.parse(contextValue);
  const expected = buildCommunicationsPrivateConversationWorkspaceCommandV1(input, context);
  let actorMembershipId: string | null = null;
  let tenantId: string | null = null;
  const providers: CoreTransactionProvidersV1 = {
    replay_policy: 'provider_current_state_required',
    replay_provider_code: COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_REPLAY_PROVIDER_CODE_V1,
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
          === COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_REPLAY_PROVIDER_CODE_V1
        && receipt.transaction_id === command.transaction_id
        && receipt.command_id === command.command_id
        && receipt.workspace_id === input.workspace_id
        && receipt.actor_id === context.actor_id
        && receipt.aggregate_type
          === COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_BINDINGS_V1.aggregate_type
        && receipt.aggregate_id === input.conversation_id
        && receipt.aggregate_version === 1
        && receipt.input_fingerprint === command.input_fingerprint
        && receipt.idempotency_key === input.idempotency_key
        && receipt.mutation_id === input.conversation_id
        && receipt.authority.context_id === input.context_id
        && receipt.authority.workspace_id === input.workspace_id
        && receipt.authority.actor_id === context.actor_id
        && receipt.authority.evaluation_purpose
          === COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_BINDINGS_V1.purpose;
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
        throw new Error('private_conversation_workspace_validation_required');
      }
      const marker = JSON.stringify({
        contract_version: input.contract_version,
        workspace_id: input.workspace_id,
        tenant_id: scope.tenant_id,
        unit_id: input.unit_id,
        actor_membership_id: actorMembershipId,
        client_request_id: input.client_request_id,
      });
      await scope.query(`select set_config(
        'communications.private_conversation_workspace_writer_v1',$1,true)`, [marker]);
      const inserted = await scope.query<{ mutation_id: string }>(`insert into communications.private_conversations(
          id,tenant_id,workspace_id,unit_id,created_by,client_request_id)
        values($1,$2,$3,$4,$5,$6)
        returning id::text mutation_id`, [input.conversation_id, scope.tenant_id,
        input.workspace_id, input.unit_id, actorMembershipId, input.client_request_id]);
      if (inserted.rowCount !== 1 || inserted.rows[0]?.mutation_id !== input.conversation_id) {
        throw new Error('private_conversation_workspace_insert_failed');
      }
      await scope.query(`insert into communications.private_participants(conversation_id,membership_id)
        values($1,$2),($1,$3)`, [input.conversation_id, actorMembershipId,
        input.recipient_membership_id]);
      await scope.query(`insert into communications.private_messages(
          id,conversation_id,sender_id,client_request_id,body)
        values($1,$2,$3,$4,$5)`, [input.initial_message_id, input.conversation_id,
        actorMembershipId, input.client_request_id, input.body]);
      return { mutation_id: input.conversation_id };
    },
  };
  return Object.freeze(providers);
}
