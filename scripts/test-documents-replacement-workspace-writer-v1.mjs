import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

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

const api = load(new URL('../src/lib/customer/documents-replacement-workspace-writer-v1.ts', import.meta.url));
const storageApi = load(new URL('../src/lib/customer/documents-workspace-binding-writer-v1.ts', import.meta.url));
const id = value => `76000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const actor = id(1), workspace = id(2), contextId = id(3), intentId = id(4), documentId = id(5);
const parentId = id(6), versionId = id(7), tenant = id(8), storageObjectId = id(9);
const commandContext = { transaction_id: id(10), command_id: id(11), actor_id: actor, authority_version: 7 };
const intent = {
  contract_version: 'documents-replacement-intent.v1', context_id: contextId,
  workspace_id: workspace, intent_id: intentId, document_id: documentId,
  expected_parent_version_id: parentId, expected_parent_version: 3,
  filename: 'replacement.pdf', object_path: `${tenant}/${intentId}/v4.pdf`,
  declared_mime_type: 'application/pdf', max_size_bytes: 4096,
  expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  idempotency_key: 'documents-replacement-intent-01',
};
const candidate = {
  contract_version: 'documents-replacement-candidate.v1', context_id: contextId,
  workspace_id: workspace, intent_id: intentId, document_id: documentId,
  parent_version_id: parentId, parent_version: 3, version_id: versionId,
  idempotency_key: 'documents-replacement-final-01',
};
const verified = await storageApi.verifyDocumentsStoredObjectBeforeTransactionV1({
  bucket_id: 'document-vault', object_path: intent.object_path,
}, async target => ({ ...target, storage_object_id: storageObjectId,
  generation_capability: 'exposed', storage_generation: 'generation-4',
  etag_capability: 'exposed', storage_etag: 'etag-4', sha256: 'b'.repeat(64),
  size_bytes: 2048, detected_mime_type: 'application/pdf', non_overwritable: true }));

const authority = purpose => ({
  contract_version: 'core-current-authority-decision-receipt.v1', receipt_version: 1,
  decision_id: id(12), context_id: contextId, workspace_id: workspace, actor_id: actor,
  authority_version: 7, permission_code: 'documents.vault.upload', module_code: 'documents',
  evaluation_purpose: purpose, decision: 'allowed', evaluated_at: new Date().toISOString(),
  transaction_context: { transaction_id: commandContext.transaction_id,
    command_id: commandContext.command_id, attempt: 1, isolation_level: 'serializable',
    lock: { kind: 'command_aggregate', workspace_id: workspace,
      aggregate_type: 'documents.document', aggregate_id: documentId,
      acquired_at: new Date().toISOString() } },
});

function scopeHarness({ replayValid = true } = {}) {
  const calls = [];
  const scope = { transaction_id: commandContext.transaction_id, database_transaction_id: '91',
    workspace_id: workspace, tenant_id: tenant, actor_id: actor, attempt: 1,
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes('select exists(') && text.includes('join documents.documents')) {
        return { rows: [{ valid: replayValid, now: new Date().toISOString() }], rowCount: 1 };
      }
      if (text.includes("auth.jwt()->>'aal'")) return { rows: [{ valid: true }], rowCount: 1 };
      if (text.includes('from documents.upload_intents ui where ui.id=')) return { rows: [{ valid: true }], rowCount: 1 };
      if (text.includes('from documents.documents d where d.id=')) return { rows: [{ valid: true }], rowCount: 1 };
      if (text.includes('from documents.document_versions v where v.id=')) return { rows: [{ valid: true }], rowCount: 1 };
      if (text.includes('select not exists(')) return { rows: [{ valid: true }], rowCount: 1 };
      if (text.includes("set_config('documents.canonical_storage_identity_v1'")) return { rows: [{}], rowCount: 1 };
      if (text.includes('insert into documents.upload_intents')) return { rows: [{ mutation_id: intentId }], rowCount: 1 };
      if (text.includes('update documents.upload_intents')) return { rows: [], rowCount: 1 };
      if (text.includes('insert into documents.document_versions')) return { rows: [{ mutation_id: versionId }], rowCount: 1 };
      if (text.includes('insert into documents.access_events')) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected query: ${text}`);
    } };
  return { scope, calls };
}

function receipt(command) {
  return { contract_version: 'core-transaction-receipt.v1', receipt_version: 1,
    receipt_id: id(13), transaction_id: command.transaction_id, command_id: command.command_id,
    workspace_id: command.workspace_id, actor_id: command.actor_id,
    aggregate_type: command.aggregate_type, aggregate_id: command.aggregate_id,
    aggregate_version: command.aggregate_version, input_fingerprint: command.input_fingerprint,
    idempotency_key: command.idempotency_key,
    replay_validation: { contract_version: 'core-transaction-replay-provider-requirement.v1',
      provider_code: api.DOCUMENTS_REPLACEMENT_WRITER_REPLAY_PROVIDER_CODE_V1 },
    authority: authority(command.evaluation_purpose), mutation_id: versionId,
    audit_event_id: '1', outbox_event_id: id(14), committed_at: new Date().toISOString() };
}

let checks = 0;
const check = async (name, run) => { await run(); console.log(`ok ${++checks} - ${name}`); };

await check('replacement intent binds exact Workspace, document and parent', async () => {
  const command = api.buildDocumentsReplacementIntentCommandV1(intent, commandContext);
  assert.equal(command.aggregate_id, documentId); assert.equal(command.aggregate_version, 3);
  assert.deepEqual(command.provider_source_ids, [intentId, documentId, parentId]);
  const provider = api.createDocumentsReplacementIntentProvidersV1(intent, commandContext);
  const { scope, calls } = scopeHarness();
  assert.equal(await provider.validateProviders(scope, command, authority(command.evaluation_purpose)), true);
  assert.deepEqual(await provider.mutate(scope, command), { mutation_id: intentId });
  const insert = calls.find(call => call.text.includes('insert into documents.upload_intents'));
  assert.match(insert.text, /'replacement_version'/); assert.equal(insert.values.at(-1), parentId);
  assert.ok(calls.find(call => call.text.includes('for update of d')));
  assert.ok(calls.find(call => call.text.includes('for share of v')));
});

await check('candidate commit is pending and does not promote current_version', async () => {
  const command = api.buildDocumentsReplacementCandidateCommandV1(candidate, commandContext, verified);
  assert.equal(command.aggregate_version, 4);
  assert.deepEqual(command.provider_source_ids, [intentId, documentId, parentId, versionId]);
  const provider = api.createDocumentsReplacementCandidateProvidersV1(candidate, commandContext, verified);
  const { scope, calls } = scopeHarness();
  assert.equal(provider.replay_policy, 'provider_current_state_required');
  assert.equal(await provider.validateProviders(scope, command, authority(command.evaluation_purpose)), true);
  assert.deepEqual(await provider.mutate(scope, command), { mutation_id: versionId });
  const version = calls.find(call => call.text.includes('insert into documents.document_versions'));
  assert.match(version.text, /'scanning_pending'/); assert.match(version.text, /replaces_version_id/);
  assert.equal(calls.some(call => /update\s+documents\.documents/i.test(call.text)), false);
});

await check('exact replay checks consumed candidate state and is read-only', async () => {
  const command = api.buildDocumentsReplacementCandidateCommandV1(candidate, commandContext, verified);
  const provider = api.createDocumentsReplacementCandidateProvidersV1(candidate, commandContext, verified);
  const { scope, calls } = scopeHarness();
  const decision = await provider.validateReplay(scope, command,
    authority(command.evaluation_purpose), receipt(command));
  assert.equal(decision.decision, 'accepted'); assert.equal(decision.read_only, true);
  assert.match(calls.at(-1).text, /ui\.status='consumed'/);
  assert.match(calls.at(-1).text, /v\.scanning_status in \('scanning_pending','clean'\)/);
  assert.equal(calls.some(call => /^\s*(?:insert|update|delete)\b/i.test(call.text)), false);
  const changed = scopeHarness({ replayValid: false });
  assert.equal((await provider.validateReplay(changed.scope, command,
    authority(command.evaluation_purpose), receipt(command))).decision, 'denied');
});

await check('forged object proof and cross-Workspace bindings fail closed', async () => {
  assert.throws(() => api.buildDocumentsReplacementCandidateCommandV1(candidate, commandContext, {
    bucket_id: 'document-vault', object_path: intent.object_path, storage_object_id: storageObjectId,
    generation_capability: 'not_exposed', storage_generation: null,
    etag_capability: 'not_exposed', storage_etag: null, sha256: 'b'.repeat(64), size_bytes: 2048,
    detected_mime_type: 'application/pdf', non_overwritable: true,
  }), /stored_object_verification_required/);
  const command = api.buildDocumentsReplacementCandidateCommandV1(candidate, commandContext, verified);
  const provider = api.createDocumentsReplacementCandidateProvidersV1(candidate, commandContext, verified);
  const cross = scopeHarness(); cross.scope.workspace_id = id(99);
  assert.equal(await provider.validateProviders(cross.scope, command, authority(command.evaluation_purpose)), false);
  assert.equal(cross.calls.length, 0);
});

console.log(`Documents replacement Workspace writer contract: ${checks}/${checks} PASS`);
