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

const api = load(new URL('../src/lib/customer/documents-workspace-binding-writer-v1.ts', import.meta.url));
const id = value => `74000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const actor = id(1), workspace = id(2), context = id(3), intentId = id(4), documentId = id(5), versionId = id(6), tenant = id(10);
const commandContext = { transaction_id: id(7), command_id: id(8), actor_id: actor, authority_version: 12 };
const intent = {
  contract_version: 'documents-new-document-intent.v1', context_id: context, workspace_id: workspace,
  intent_id: intentId, prospective_document_id: documentId, filename: 'evidence.pdf',
  object_path: `${tenant}/${intentId}/v1.pdf`, declared_mime_type: 'application/pdf',
  max_size_bytes: 4096, expires_at: new Date(Date.now() + 5 * 60_000).toISOString(),
  idempotency_key: 'documents-intent-unit-01',
};
const initial = {
  contract_version: 'documents-initial-version.v1', context_id: context, workspace_id: workspace,
  intent_id: intentId, document_id: documentId, version_id: versionId, title: 'Evidence',
  document_type: 'general', classification: 'internal', idempotency_key: 'documents-finalize-unit-01',
};
const authority = purpose => ({
  contract_version: 'core-current-authority-decision-receipt.v1', receipt_version: 1,
  decision_id: id(9), context_id: context, workspace_id: workspace, actor_id: actor,
  authority_version: 12, permission_code: 'documents.vault.upload', module_code: 'documents',
  evaluation_purpose: purpose, decision: 'allowed',
});

let verifiedBeforeProvider = false;
const verified = await api.verifyDocumentsStoredObjectBeforeTransactionV1(
  { bucket_id: 'document-vault', object_path: intent.object_path }, async target => {
    verifiedBeforeProvider = true;
    return { ...target, sha256: 'a'.repeat(64), size_bytes: 1024,
      detected_mime_type: 'application/pdf', non_overwritable: true };
  });

function scopeHarness() {
  const calls = [];
  const scope = {
    transaction_id: commandContext.transaction_id, database_transaction_id: '44', workspace_id: workspace,
    tenant_id: tenant, actor_id: actor, attempt: 1,
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("auth.jwt()->>'aal'")) return { rows: [{ valid: true }], rowCount: 1 };
      if (text.includes('not exists(select 1 from documents.documents') && !text.includes('from documents.upload_intents ui where')) {
        return { rows: [{ valid: true }], rowCount: 1 };
      }
      if (text.includes('from documents.upload_intents ui where ui.id=')) return { rows: [{ valid: true }], rowCount: 1 };
      if (text.includes('insert into documents.upload_intents')) return { rows: [{ mutation_id: intentId }], rowCount: 1 };
      if (text.includes('update documents.upload_intents')) return { rows: [], rowCount: 1 };
      if (text.includes('insert into documents.documents')) return { rows: [], rowCount: 1 };
      if (text.includes('insert into documents.document_versions')) return { rows: [{ mutation_id: versionId }], rowCount: 1 };
      if (text.includes('insert into documents.access_events')) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected query: ${text}`);
    },
  };
  return { scope, calls };
}

let checks = 0;
const check = async (name, run) => { await run(); console.log(`ok ${++checks} - ${name}`); };

await check('intent command binds explicit Context, Workspace, prospective document and intent lock', async () => {
  const command = api.buildDocumentsNewDocumentIntentCommandV1(intent, commandContext);
  assert.equal(command.context_id, context); assert.equal(command.workspace_id, workspace);
  assert.equal(command.aggregate_id, documentId);
  assert.deepEqual(command.provider_source_ids, [intentId, documentId]);
  assert.equal(command.evaluation_purpose, 'documents.workspace_upload.intent');
  const { scope, calls } = scopeHarness();
  const provider = api.createDocumentsNewDocumentIntentProvidersV1(intent, commandContext);
  assert.equal(await provider.validateProviders(scope, command, authority(command.evaluation_purpose)), true);
  assert.deepEqual(await provider.mutate(scope, command), { mutation_id: intentId });
  const insert = calls.find(call => call.text.includes('insert into documents.upload_intents'));
  assert.equal(insert.values.at(-2), workspace); assert.equal(insert.values.at(-1), documentId);
  assert.match(insert.text, /document_id[^]*values\([^]*null/i);
});

await check('finalization requires pretransaction object proof and fresh unconsumed intent state', async () => {
  assert.equal(verifiedBeforeProvider, true);
  const command = api.buildDocumentsInitialVersionCommandV1(initial, commandContext, verified);
  assert.equal(command.aggregate_id, documentId); assert.equal(command.aggregate_version, 1);
  assert.deepEqual(command.provider_source_ids, [intentId, documentId, versionId]);
  const { scope, calls } = scopeHarness();
  const provider = api.createDocumentsInitialVersionProvidersV1(initial, commandContext, verified);
  assert.equal(await provider.validateProviders(scope, command, authority(command.evaluation_purpose)), true);
  const validation = calls.find(call => call.text.includes('from documents.upload_intents ui where ui.id='));
  assert.match(validation.text, /ui\.workspace_id=\$4/);
  assert.match(validation.text, /ui\.status='authorized' and ui\.consumed_at is null/);
  assert.match(validation.text, /for update of ui/);
  assert.deepEqual(await provider.mutate(scope, command), { mutation_id: versionId });
  const documentInsert = calls.find(call => call.text.includes('insert into documents.documents'));
  assert.equal(documentInsert.values[2], workspace);
  const versionInsert = calls.find(call => call.text.includes('insert into documents.document_versions'));
  assert.match(versionInsert.text, /'verified','deferred'/);
  assert.match(versionInsert.text, /binding_contract/);
});

await check('cross-Workspace and changed command bindings deny before mutation', async () => {
  const command = api.buildDocumentsInitialVersionCommandV1(initial, commandContext, verified);
  const provider = api.createDocumentsInitialVersionProvidersV1(initial, commandContext, verified);
  const { scope, calls } = scopeHarness();
  assert.equal(await provider.validateProviders(scope, { ...command, workspace_id: id(99) },
    authority(command.evaluation_purpose)), false);
  assert.equal(calls.length, 0);
});

await check('schemas reject inferred/NULL Workspace, replacement fields and forged object proof', async () => {
  assert.equal(api.documentsNewDocumentIntentV1Schema.safeParse({ ...intent, workspace_id: null }).success, false);
  assert.equal(api.documentsNewDocumentIntentV1Schema.safeParse({ ...intent, tenant_id: id(88) }).success, false);
  assert.equal(api.documentsInitialVersionV1Schema.safeParse({ ...initial, document_version: 2 }).success, false);
  assert.throws(() => api.buildDocumentsInitialVersionCommandV1(initial, commandContext, {
    bucket_id: 'document-vault', object_path: intent.object_path, sha256: 'a'.repeat(64),
    size_bytes: 1024, detected_mime_type: 'application/pdf', non_overwritable: true,
  }), /stored_object_verification_required/);
});

await check('writer consumes canonical Core types and defines no host, authority interface or ledger', () => {
  const source = readFileSync(new URL('../src/lib/customer/documents-workspace-binding-writer-v1.ts', import.meta.url), 'utf8');
  assert.match(source, /CoreTransactionProvidersV1/); assert.match(source, /CoreTransactionScopeV1/);
  assert.match(source, /current-authority-postgres-provider-v1/);
  assert.doesNotMatch(source, /interface\s+(?:CoreTransaction|.*Authority)|createCorePostgresTransactionHost/);
  assert.doesNotMatch(source, /create table|idempotency_keys|outbox_events|audit\.events/i);
});

console.log(`Documents Workspace binding writer contract: ${checks}/${checks} PASS`);
