import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const migrationPath = 'supabase/migrations/20261018133000_documents_vault_download_exact_workspace_v2.sql';
const migration = readFileSync(migrationPath, 'utf8');
const route = readFileSync('src/app/api/customer/v1/documents/[id]/download/route.ts', 'utf8');
for (const routine of ['documents.authorize_download_internal',
  'customer_api.authorize_document_download_v1']) {
  assert.match(migration, new RegExp(`create or replace function ${routine.replace('.', '\\.')}`));
}
assert.match(migration, /canonical_document_download_required/g);
assert.match(migration, /security invoker/g);
assert.doesNotMatch(migration.replace(/--.*$/gm, ''), /grant\s+execute/i);
assert.match(migration, /create or replace function app_private\.require_airprop_diligence_evidence_v1/);
assert.match(migration, /d\.workspace_id is distinct from w\.id/);
assert.match(migration, /actor\.tenant_id is distinct from w\.tenant_id/);
const airpropReconciliation = migration.slice(
  migration.indexOf('create or replace function app_private.require_airprop_diligence_evidence_v1'),
);
assert.doesNotMatch(airpropReconciliation, /authorize_download_internal/);
assert.match(route, /CANONICAL_DOCUMENT_DOWNLOAD_UNAVAILABLE/);
assert.match(route, /status:\s*503/);
assert.doesNotMatch(route, /\.rpc\(|createAdminClient|createSignedUrl|\.storage\s*\./);

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

const api = load(new URL('../src/lib/customer/documents-vault-download-exact-workspace-v2.ts', import.meta.url));
const id = value => `78000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const actor = id(1), workspace = id(2), contextId = id(3), documentId = id(4), versionId = id(5);
const tenant = id(6), objectId = id(7);
const context = { transaction_id: id(8), command_id: id(9), actor_id: actor, authority_version: 8 };
const input = { contract_version: 'documents-vault-download-exact-workspace.v2',
  context_id: contextId, workspace_id: workspace, document_id: documentId,
  version_id: versionId, expected_current_version: 2,
  idempotency_key: 'documents-download-exact-01' };
const authority = purpose => ({ contract_version: 'core-current-authority-decision-receipt.v1',
  receipt_version: 1, decision_id: id(10), context_id: contextId, workspace_id: workspace,
  actor_id: actor, authority_version: 8, permission_code: 'documents.vault.read',
  module_code: 'documents', evaluation_purpose: purpose, decision: 'allowed',
  evaluated_at: new Date().toISOString(), transaction_context: { transaction_id: context.transaction_id,
    command_id: context.command_id, attempt: 1, isolation_level: 'serializable', lock: {
      kind: 'command_aggregate', workspace_id: workspace, aggregate_type: 'documents.document',
      aggregate_id: documentId, acquired_at: new Date().toISOString() } } });
const selectedRow = { valid: true, document_id: documentId, version_id: versionId, version: 2,
  bucket_id: 'document-vault', object_path: `${tenant}/canonical/current.pdf`,
  storage_object_id: objectId, storage_generation: 'generation-2', storage_etag: 'etag-2',
  sha256: 'd'.repeat(64), size_bytes: '4096', mime_type: 'application/pdf',
  now: new Date().toISOString() };

function harness({ valid = true } = {}) {
  const calls = [];
  const scope = { transaction_id: context.transaction_id, database_transaction_id: '118',
    workspace_id: workspace, tenant_id: tenant, actor_id: actor, attempt: 1,
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes("auth.jwt()->>'role'") && !text.includes('from documents.documents')) {
        return { rows: [{ valid: true }], rowCount: 1 };
      }
      if (text.includes('from documents.documents d')) {
        return { rows: [{ ...selectedRow, valid }], rowCount: 1 };
      }
      if (text.includes('insert into documents.access_events')) {
        return { rows: [{ mutation_id: versionId }], rowCount: 1 };
      }
      throw new Error(`unexpected query: ${text}`);
    } };
  return { scope, calls };
}

function receipt(command) {
  return { contract_version: 'core-transaction-receipt.v1', receipt_version: 1,
    receipt_id: id(11), transaction_id: command.transaction_id, command_id: command.command_id,
    workspace_id: workspace, actor_id: actor, aggregate_type: command.aggregate_type,
    aggregate_id: documentId, aggregate_version: 2, input_fingerprint: command.input_fingerprint,
    idempotency_key: command.idempotency_key, replay_validation: {
      contract_version: 'core-transaction-replay-provider-requirement.v1',
      provider_code: api.DOCUMENTS_VAULT_DOWNLOAD_REPLAY_PROVIDER_CODE_V2 },
    authority: authority(command.evaluation_purpose), mutation_id: versionId,
    audit_event_id: '1', outbox_event_id: id(12), committed_at: new Date().toISOString() };
}

let checks = 0;
const check = async (name, run) => { await run(); console.log(`ok ${++checks} - ${name}`); };

await check('command binds exact Workspace, document and current version', async () => {
  const command = api.buildDocumentsVaultDownloadExactWorkspaceCommandV2(input, context);
  assert.equal(command.aggregate_id, documentId); assert.equal(command.aggregate_version, 2);
  assert.deepEqual(command.provider_source_ids, [documentId, versionId]);
  assert.equal(command.permission_code, 'documents.vault.read');
});

await check('selector accepts only exact current clean attested canonical object', async () => {
  const command = api.buildDocumentsVaultDownloadExactWorkspaceCommandV2(input, context);
  const adapter = api.createDocumentsVaultDownloadExactWorkspaceProvidersV2(input, context);
  const { scope, calls } = harness();
  assert.equal(await adapter.providers.validateProviders(scope, command,
    authority(command.evaluation_purpose)), true);
  const query = calls.at(-1);
  assert.match(query.text, /d\.workspace_id=\$4 and d\.current_version=\$5/);
  assert.match(query.text, /v\.scanning_status='clean'/);
  assert.match(query.text, /a\.provider='clamav' and a\.verdict='clean'/);
  assert.match(query.text, /for share of d,v,a/);
  assert.deepEqual(await adapter.providers.mutate(scope, command), { mutation_id: versionId });
  assert.deepEqual(adapter.readAuthorizedDownload(), {
    contract_version: 'documents-vault-authorized-download.v2', document_id: documentId,
    version_id: versionId, version: 2, bucket_id: 'document-vault',
    object_path: selectedRow.object_path, storage_object_id: objectId,
    storage_generation: 'generation-2', storage_etag: 'etag-2', sha256: 'd'.repeat(64),
    size_bytes: 4096, mime_type: 'application/pdf', expires_in_seconds: 60,
  });
});

await check('changed provider state denies with no authorization output', async () => {
  const command = api.buildDocumentsVaultDownloadExactWorkspaceCommandV2(input, context);
  const adapter = api.createDocumentsVaultDownloadExactWorkspaceProvidersV2(input, context);
  const { scope, calls } = harness({ valid: false });
  assert.equal(await adapter.providers.validateProviders(scope, command,
    authority(command.evaluation_purpose)), false);
  assert.equal(adapter.readAuthorizedDownload(), null);
  assert.equal(calls.some(call => /^\s*(?:insert|update|delete)\b/i.test(call.text)), false);
});

await check('exact replay rechecks state and exposes no new write', async () => {
  const command = api.buildDocumentsVaultDownloadExactWorkspaceCommandV2(input, context);
  const adapter = api.createDocumentsVaultDownloadExactWorkspaceProvidersV2(input, context);
  const { scope, calls } = harness();
  const decision = await adapter.providers.validateReplay(scope, command,
    authority(command.evaluation_purpose), receipt(command));
  assert.equal(decision.decision, 'accepted'); assert.equal(decision.read_only, true);
  assert.equal(adapter.readAuthorizedDownload()?.version_id, versionId);
  assert.equal(calls.some(call => /^\s*(?:insert|update|delete)\b/i.test(call.text)), false);
});

await check('admin inspection and caller-injected object identity are rejected', async () => {
  assert.throws(() => api.buildDocumentsVaultDownloadExactWorkspaceCommandV2(
    { ...input, admin_inspection: true }, context), /unrecognized/i);
  assert.throws(() => api.buildDocumentsVaultDownloadExactWorkspaceCommandV2(
    { ...input, object_path: selectedRow.object_path }, context), /unrecognized/i);
});

console.log(`Documents vault exact Workspace download V2: ${checks}/${checks} PASS`);
