import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const migration = readFileSync(
  'supabase/migrations/20261018143000_communications_document_attachment_workspace_gate_v2.sql',
  'utf8',
);

assert.match(migration, /create or replace function communications\.validate_private_attachment\(\)/);
assert.match(migration, /c\.workspace_id is not null/);
assert.match(migration, /d\.workspace_id=c\.workspace_id/);
assert.match(migration, /v\.version=d\.current_version/);
assert.match(migration, /a\.provider='clamav' and a\.verdict='clean'/);
assert.match(migration, /communications\.document_attachment_workspace_gate_v2/);
assert.match(migration, /security invoker/g);
assert.match(migration, /private_document_member_grant[\s\S]*d\.workspace_id=c\.workspace_id/);

const tombstones = [
  'attach_private_document_v1',
  'list_private_attachments_v1',
  'authorize_private_attachment_download_v1',
  'list_attachable_private_documents_v1',
  'send_private_file_v1',
  'my_private_file_scan_status_v1',
];
for (const name of tombstones) {
  assert.match(migration, new RegExp(`create or replace function customer_api\\.${name}`));
}
assert.equal((migration.match(/canonical_private_attachment_required/g) ?? []).length, 6);
assert.doesNotMatch(migration, /grant\s+(?:all|select|insert|update|delete)\s+on\s+(?:table\s+)?communications\.private_message_documents/i);
assert.doesNotMatch(migration, /revoke\s+[^;]*on\s+(?:table\s+)?communications\.private_message_documents/i);

const routes = [
  'src/app/api/customer/v1/private-conversations/[id]/attachments/route.ts',
  'src/app/api/customer/v1/private-conversations/[id]/files/route.ts',
  'src/app/api/customer/v1/private-conversations/[id]/files/status/route.ts',
  'src/app/api/customer/v1/private-conversations/[id]/upload-context/route.ts',
  'src/app/api/customer/v1/private-conversations/attachments/[id]/download/route.ts',
];
for (const path of routes) {
  const source = readFileSync(path, 'utf8');
  assert.match(source, /CANONICAL_PRIVATE_ATTACHMENT_UNAVAILABLE/);
  assert.match(source, /status:\s*503/);
  assert.doesNotMatch(source, /\.rpc\(|createAdminClient|createSignedUrl|\.storage\b/);
  assert.doesNotMatch(source, /communications-document-attachment-workspace-v2/);
}

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
  '../src/lib/customer/communications-document-attachment-workspace-v2.ts', import.meta.url));
const id = value => `7a000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const actor = id(1), workspace = id(2), contextId = id(3), attachmentId = id(4);
const conversationId = id(5), messageId = id(6), documentId = id(7), versionId = id(8);
const tenant = id(9), membership = id(10);
const context = { transaction_id: id(11), command_id: id(12), actor_id: actor,
  authority_version: 12 };
const input = {
  contract_version: 'communications-document-attachment-workspace.v2',
  context_id: contextId, workspace_id: workspace, attachment_id: attachmentId,
  conversation_id: conversationId, message_id: messageId, expected_message_version: 3,
  document_id: documentId, version_id: versionId, expected_document_version: 4,
  idempotency_key: 'communications-attachment-01',
};

const authority = purpose => ({
  contract_version: 'core-current-authority-decision-receipt.v1', receipt_version: 1,
  decision_id: id(13), context_id: contextId, workspace_id: workspace, actor_id: actor,
  authority_version: 12, permission_code: 'communications.feed.read',
  module_code: 'communications', evaluation_purpose: purpose, decision: 'allowed',
  evaluated_at: new Date().toISOString(), transaction_context: {
    transaction_id: context.transaction_id, command_id: context.command_id, attempt: 1,
    isolation_level: 'serializable', lock: { kind: 'command_aggregate', workspace_id: workspace,
      aggregate_type: 'communications.private_message_document', aggregate_id: attachmentId,
      acquired_at: new Date().toISOString() },
  },
});

function harness({ valid = true } = {}) {
  const calls = [];
  const scope = { transaction_id: context.transaction_id, database_transaction_id: '223',
    workspace_id: workspace, tenant_id: tenant, actor_id: actor, attempt: 1,
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes('from identity.context_grants context_grant')) {
        return { rows: [{ valid, actor_membership_id: membership, tenant_id: tenant,
          now: new Date().toISOString() }], rowCount: 1 };
      }
      if (text.includes("set_config(\n        'communications.document_attachment_workspace_gate_v2'")) {
        return { rows: [{ set_config: values[0] }], rowCount: 1 };
      }
      if (text.includes('insert into communications.private_message_documents')) {
        return { rows: [{ mutation_id: attachmentId }], rowCount: 1 };
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
    aggregate_id: attachmentId, aggregate_version: 1,
    input_fingerprint: command.input_fingerprint, idempotency_key: command.idempotency_key,
    replay_validation: { contract_version: 'core-transaction-replay-provider-requirement.v1',
      provider_code: api.COMMUNICATIONS_DOCUMENT_ATTACHMENT_REPLAY_PROVIDER_CODE_V2 },
    authority: authority(command.evaluation_purpose), mutation_id: attachmentId,
    audit_event_id: '1', outbox_event_id: id(15), committed_at: new Date().toISOString(),
  };
}

let checks = 0;
const check = async (name, run) => { await run(); console.log(`ok ${++checks} - ${name}`); };

await check('command binds exact Workspace, attachment, message, document and version', async () => {
  const command = api.buildCommunicationsDocumentAttachmentWorkspaceCommandV2(input, context);
  assert.equal(command.aggregate_id, attachmentId);
  assert.equal(command.aggregate_version, 1);
  assert.deepEqual(command.provider_source_ids,
    [conversationId, messageId, documentId, versionId]);
});

await check('provider requires current participant grants and exact cross-domain state', async () => {
  const command = api.buildCommunicationsDocumentAttachmentWorkspaceCommandV2(input, context);
  const providers = api.createCommunicationsDocumentAttachmentWorkspaceProvidersV2(input, context);
  const { scope, calls } = harness();
  assert.equal(await providers.validateProviders(scope, command,
    authority(command.evaluation_purpose)), true);
  assert.match(calls[0].text, /conversation\.workspace_id=\$3 and document\.workspace_id=\$3/);
  assert.match(calls[0].text, /private_document_member_grant/);
  assert.match(calls[0].text, /not exists\(select 1 from communications\.private_message_documents/);
  assert.deepEqual(await providers.mutate(scope, command), { mutation_id: attachmentId });
  assert.equal(calls.some(call => call.text.includes('document_attachment_workspace_gate_v2')), true);
  assert.equal(calls.some(call => /insert into documents\.document_permissions/i.test(call.text)), false);
});

await check('changed provider state denies with zero writes', async () => {
  const command = api.buildCommunicationsDocumentAttachmentWorkspaceCommandV2(input, context);
  const providers = api.createCommunicationsDocumentAttachmentWorkspaceProvidersV2(input, context);
  const { scope, calls } = harness({ valid: false });
  assert.equal(await providers.validateProviders(scope, command,
    authority(command.evaluation_purpose)), false);
  assert.equal(calls.some(call => /^\s*(?:insert|update|delete)\b/i.test(call.text)), false);
  await assert.rejects(providers.mutate(scope, command), /attachment_validation_required/);
});

await check('exact replay revalidates current state read-only', async () => {
  const command = api.buildCommunicationsDocumentAttachmentWorkspaceCommandV2(input, context);
  const providers = api.createCommunicationsDocumentAttachmentWorkspaceProvidersV2(input, context);
  const { scope, calls } = harness();
  const decision = await providers.validateReplay(scope, command,
    authority(command.evaluation_purpose), receipt(command));
  assert.equal(decision.decision, 'accepted');
  assert.equal(decision.read_only, true);
  assert.match(calls[0].text, /attachment\.id=\$4/);
  assert.equal(calls.some(call => /^\s*(?:insert|update|delete)\b/i.test(call.text)), false);
});

await check('caller cannot inject tenant, membership, marker or automatic grant', async () => {
  for (const injected of [{ tenant_id: tenant }, { actor_membership_id: membership },
    { writer_marker: 'forged' }, { auto_grant: true }]) {
    assert.throws(() => api.buildCommunicationsDocumentAttachmentWorkspaceCommandV2(
      { ...input, ...injected }, context), /unrecognized/i);
  }
});

console.log(`Communications document attachment Workspace gate V2: ${checks}/${checks} PASS`);
