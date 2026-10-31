import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const route = readFileSync('src/app/api/customer/v1/private-conversations/route.ts', 'utf8');
assert.doesNotMatch(route, /CANONICAL_PRIVATE_CONVERSATION_WRITER_UNAVAILABLE/);
assert.match(route, /communicationsPrivateConversationWorkspaceV1Schema/);
assert.match(route, /create_private_conversation_v2/);

const require = createRequire(import.meta.url), cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const mod = { exports: {} }; cache.set(url.href, mod.exports);
  new Function('require', 'module', 'exports', compiled.outputText)(name => name.startsWith('.')
    ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url)) : require(name), mod, mod.exports);
  return mod.exports;
}

const api = load(new URL(
  '../src/lib/customer/communications-private-conversation-workspace-v1.ts', import.meta.url));
const id = value => `79000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const actor = id(1), workspace = id(2), contextId = id(3), conversationId = id(4);
const unitId = id(5), recipient = id(6), messageId = id(7), tenant = id(8), membership = id(9);
const context = { transaction_id: id(10), command_id: id(11), actor_id: actor,
  authority_version: 9 };
const input = {
  contract_version: 'communications-private-conversation-workspace.v1',
  context_id: contextId, workspace_id: workspace, conversation_id: conversationId,
  unit_id: unitId, recipient_membership_id: recipient, initial_message_id: messageId,
  body: 'Canonical private message', client_request_id: id(12),
  idempotency_key: 'communications-private-create-01',
};

const authority = purpose => ({
  contract_version: 'core-current-authority-decision-receipt.v1', receipt_version: 1,
  decision_id: id(13), context_id: contextId, workspace_id: workspace, actor_id: actor,
  authority_version: 9, permission_code: 'communications.feed.read',
  module_code: 'communications', evaluation_purpose: purpose, decision: 'allowed',
  evaluated_at: new Date().toISOString(), transaction_context: {
    transaction_id: context.transaction_id, command_id: context.command_id, attempt: 1,
    isolation_level: 'serializable', lock: { kind: 'command_aggregate', workspace_id: workspace,
      aggregate_type: 'communications.private_conversation', aggregate_id: conversationId,
      acquired_at: new Date().toISOString() },
  },
});

function harness({ valid = true } = {}) {
  const calls = [];
  const scope = { transaction_id: context.transaction_id, database_transaction_id: '219',
    workspace_id: workspace, tenant_id: tenant, actor_id: actor, attempt: 1,
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes('from identity.context_grants g')) {
        return { rows: [{ valid, actor_membership_id: membership, tenant_id: tenant,
          now: new Date().toISOString() }], rowCount: 1 };
      }
      if (text.includes("set_config(\n        'communications.private_conversation_workspace_writer_v1'")) {
        return { rows: [{ set_config: values[0] }], rowCount: 1 };
      }
      if (text.includes('insert into communications.private_conversations')) {
        return { rows: [{ mutation_id: conversationId }], rowCount: 1 };
      }
      if (text.includes('insert into communications.private_participants')
          || text.includes('insert into communications.private_messages')) {
        return { rows: [], rowCount: text.includes('private_participants') ? 2 : 1 };
      }
      throw new Error(`unexpected query: ${text}`);
    } };
  return { scope, calls };
}

function receipt(command) {
  return {
    contract_version: 'core-transaction-receipt.v1', receipt_version: 1,
    receipt_id: id(14), transaction_id: command.transaction_id, command_id: command.command_id,
    workspace_id: workspace, actor_id: actor, aggregate_type: command.aggregate_type,
    aggregate_id: conversationId, aggregate_version: 1,
    input_fingerprint: command.input_fingerprint, idempotency_key: command.idempotency_key,
    replay_validation: { contract_version: 'core-transaction-replay-provider-requirement.v1',
      provider_code: api.COMMUNICATIONS_PRIVATE_CONVERSATION_WORKSPACE_REPLAY_PROVIDER_CODE_V1 },
    authority: authority(command.evaluation_purpose), mutation_id: conversationId,
    audit_event_id: '1', outbox_event_id: id(15), committed_at: new Date().toISOString(),
  };
}

let checks = 0;
const check = async (name, run) => { await run(); console.log(`ok ${++checks} - ${name}`); };

await check('command binds exact Workspace, conversation, unit, recipient and initial message', async () => {
  const command = api.buildCommunicationsPrivateConversationWorkspaceCommandV1(input, context);
  assert.equal(command.aggregate_id, conversationId);
  assert.equal(command.aggregate_version, 1);
  assert.equal(command.permission_code, 'communications.feed.read');
  assert.deepEqual(command.provider_source_ids, [unitId, recipient, messageId]);
});

await check('provider validates exact physical Workspace and writes through the trusted marker', async () => {
  const command = api.buildCommunicationsPrivateConversationWorkspaceCommandV1(input, context);
  const providers = api.createCommunicationsPrivateConversationWorkspaceProvidersV1(input, context);
  const { scope, calls } = harness();
  assert.equal(await providers.validateProviders(scope, command,
    authority(command.evaluation_purpose)), true);
  const selector = calls.at(-1);
  assert.match(selector.text, /binding\.customer_workspace_id=w\.id/);
  assert.match(selector.text, /communications\.member_covers_unit\(m\.id,m\.tenant_id,\$5\)/);
  assert.match(selector.text, /communications\.private_pair_allowed\(m\.id,\$6,\$5\)/);
  assert.match(selector.text, /for share of g,m,w,u,b,binding/);
  assert.deepEqual(await providers.mutate(scope, command), { mutation_id: conversationId });
  assert.equal(calls.some(call => call.text.includes('private_conversation_workspace_writer_v1')), true);
  assert.equal(calls.filter(call => /^\s*insert into communications\./i.test(call.text)).length, 3);
});

await check('changed provider state denies before every write', async () => {
  const command = api.buildCommunicationsPrivateConversationWorkspaceCommandV1(input, context);
  const providers = api.createCommunicationsPrivateConversationWorkspaceProvidersV1(input, context);
  const { scope, calls } = harness({ valid: false });
  assert.equal(await providers.validateProviders(scope, command,
    authority(command.evaluation_purpose)), false);
  assert.equal(calls.some(call => /^\s*(?:insert|update|delete)\b/i.test(call.text)), false);
  await assert.rejects(providers.mutate(scope, command),
    /private_conversation_workspace_validation_required/);
});

await check('exact replay rechecks current conversation, participants and initial message read-only', async () => {
  const command = api.buildCommunicationsPrivateConversationWorkspaceCommandV1(input, context);
  const providers = api.createCommunicationsPrivateConversationWorkspaceProvidersV1(input, context);
  const { scope, calls } = harness();
  const decision = await providers.validateReplay(scope, command,
    authority(command.evaluation_purpose), receipt(command));
  assert.equal(decision.decision, 'accepted');
  assert.equal(decision.read_only, true);
  assert.match(calls[0].text, /recipient_participant\.revoked_at is null/);
  assert.match(calls[0].text, /message\.version=1 and message\.lifecycle_state='available'/);
  assert.equal(calls.some(call => /^\s*(?:insert|update|delete)\b/i.test(call.text)), false);
});

await check('caller cannot inject tenant, membership or transaction marker', async () => {
  for (const injected of [{ tenant_id: tenant }, { actor_membership_id: membership },
    { writer_marker: 'forged' }]) {
    assert.throws(() => api.buildCommunicationsPrivateConversationWorkspaceCommandV1(
      { ...input, ...injected }, context), /unrecognized/i);
  }
});

console.log(`Communications private conversation Workspace writer: ${checks}/${checks} PASS`);
