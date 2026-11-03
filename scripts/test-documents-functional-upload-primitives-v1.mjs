// New Documents primitives only. Real SDK/code; controlled HTTP/SQL transports.
// No real Storage/PG/Auth/scanner or clean attestation is produced by this test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
const require = createRequire(import.meta.url), cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const m = { exports: {} }; cache.set(url.href, m.exports);
  const js = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', js)(n => n.startsWith('.')
    ? load(new URL(n.endsWith('.ts') ? n : `${n}.ts`, url)) : require(n), m, m.exports);
  cache.set(url.href, m.exports); return m.exports;
}
const storageApi = load(new URL('../src/lib/customer/documents-storage-readback-v1.ts', import.meta.url));
const functional = load(new URL('../src/lib/customer/documents-functional-download-provider-v1.ts', import.meta.url));
const vault = load(new URL('../src/lib/customer/documents-vault-download-exact-workspace-v2.ts', import.meta.url));
const authorityApi = load(new URL('../src/lib/core/current-authority-transaction-port-v1.ts', import.meta.url));
const id = n => `91000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tenant = id(1), contextId = id(2), workspace = id(3), actor = id(4), document = id(5), version = id(6), intentId = id(7), objectId = id(8);
const path = `${tenant}/${intentId}/v1.pdf`, bytes = Buffer.from('%PDF-1.7\nCLADORA synthetic upload only\n');
const intent = { contract_version: 'documents-new-document-intent.v1', context_id: contextId, workspace_id: workspace,
  intent_id: intentId, prospective_document_id: document, filename: 'synthetic.pdf', object_path: path,
  declared_mime_type: 'application/pdf', max_size_bytes: 20971520, expires_at: '2099-01-01T00:00:00Z', idempotency_key: 'docs-functional-11-intent' };
function storageFixture(options = {}) {
  const requests = []; let content = null, reads = 0;
  const fetch = async (url, init = {}) => {
    const u = new URL(url); assert.equal(u.hostname, '127.0.0.1'); requests.push({ method: init.method, path: u.pathname, headers: init.headers });
    if (init.method === 'POST') {
      assert.equal(new Headers(init.headers).get('x-upsert'), 'false');
      if (options.duplicate) return Response.json({ statusCode: '409', error: 'Duplicate', message: 'Object exists' }, { status: 409 });
      content = Uint8Array.from(init.body); return Response.json({ Id: objectId, Key: `document-vault/${path}` });
    }
    if (u.pathname.includes('/object/info/')) {
      reads++; return Response.json({ id: options.changed && reads > 1 ? id(99) : objectId,
        name: path, bucket_id: 'document-vault', size: bytes.length, content_type: 'application/pdf',
        version: 'generation-1', etag: 'etag-1', metadata: { PRIVATE_UNRELATED: 'not-returned' } });
    }
    if (u.pathname.includes('/object/')) return new Response(options.corrupt ? new Uint8Array(bytes.length).fill(65) : content,
      { headers: { 'content-type': 'application/pdf' } });
    throw Error('unexpected controlled Storage request');
  };
  const client = createClient('http://127.0.0.1:54321', 'synthetic-test-key', {
    global: { fetch }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  return { api: storageApi.createDocumentsStorageReadbackV1(client), requests };
}
const onlyWorkflow = process.argv.includes('--only-workflow');
const onlyStorage = process.argv.includes('--only-storage');
let n = 0; async function check(name, fn) { if (onlyWorkflow && !name.startsWith('application commands')) return; if (onlyStorage && !(name.startsWith('actual SDK') || name.startsWith('already-exists') || name.startsWith('changing object') || name.startsWith('invalid active'))) return; await fn(); console.log(`ok ${++n} - ${name}`); }
await check('actual SDK upload upsert=false -> info/download/info -> SHA/MIME/identity readback, never scan authority', async () => {
  const f = storageFixture(), result = await f.api.uploadNew(intent, bytes);
  assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex')); assert.equal(result.storage_object_id, objectId);
  assert.equal(result.storage_generation, 'generation-1'); assert.equal(result.storage_etag, 'etag-1');
  assert.equal(result.non_overwrite_verified, false); assert.equal(result.scan_authority, false);
  assert.equal(result.reusable_as_download_authority, false); assert.doesNotMatch(JSON.stringify(result), /PRIVATE_UNRELATED|clean/);
  assert.equal(f.requests.length, 4);
});
await check('already-exists is not success or automatic readback/reupload', async () => {
  const f = storageFixture({ duplicate: true });
  await assert.rejects(f.api.uploadNew(intent, bytes), e => e.code === 'UPLOAD_OUTCOME_UNCONFIRMED');
  assert.equal(f.requests.length, 1);
});
await check('changing object identity and mismatched actual bytes fail before writer finalization', async () => {
  for (const opts of [{ changed: true }, { corrupt: true }]) {
    const f = storageFixture(opts); await assert.rejects(f.api.uploadNew(intent, bytes));
  }
});
await check('invalid active bytes/size fail before Storage POST', async () => {
  const f = storageFixture(); await assert.rejects(f.api.uploadNew(intent, Buffer.from('<html>active</html>')));
  await assert.rejects(f.api.uploadNew({ ...intent, max_size_bytes: 2 }, bytes));
  for (const object_path of ['/absolute/path.pdf', `${tenant}/${intentId}/../other.pdf`]) await assert.rejects(f.api.uploadNew({ ...intent, object_path }, bytes));
  assert.equal(f.requests.length, 0);
});
const now = '2026-11-03T10:00:01.000Z';
const ctx = { transaction_id: id(10), command_id: id(11), actor_id: actor, authority_version: 2 };
const download = { contract_version: 'documents-vault-download-exact-workspace.v2', context_id: contextId, workspace_id: workspace,
  document_id: document, version_id: version, expected_current_version: 1, idempotency_key: 'docs-functional-11-download' };
const command = vault.buildDocumentsVaultDownloadExactWorkspaceCommandV2(download, ctx);
const tx = { transaction_id: ctx.transaction_id, command_id: ctx.command_id, attempt: 1, isolation_level: 'serializable',
  lock: { kind: 'command_aggregate', workspace_id: workspace, aggregate_type: 'documents.document', aggregate_id: document,
    acquired_at: '2026-11-03T10:00:00.000Z' } };
const auth = authorityApi.bindCanonicalCurrentAuthorityObservationV1({ contract_version: 'core-current-authority-transaction-port-request.v1',
  decision_id: id(12), context_id: contextId, workspace_id: workspace, actor_id: actor, authority_version: 2,
  permission_code: command.permission_code, module_code: command.module_code, evaluation_purpose: command.evaluation_purpose,
  transaction_context: tx }, { contract_version: 'core-current-authority-observation.v1', source_contract: 'workspace-native-effective-authority.v2',
  decision_id: id(12), context_id: contextId, workspace_id: workspace, actor_id: actor, authority_version: 2,
  permission_code: 'documents.vault.read', module_code: 'documents', transaction_context: tx,
  evaluator: 'app_private.check_workspace_native_permission_v2', source_disclosure: 'status_only', source_reference: null,
  actor_status: 'current', decision: 'allowed', evaluated_at: now,
  entitlement: { contract_version: 'core-authority-entitlement-binding.v1', workspace_id: workspace, module_definition_id: id(13),
    module_code: 'documents', entitlement_key: 'module.documents', authority_revision: 2 } });
function scopeFixture(options = {}) {
  const calls = [], one = x => ({ rowCount: 1, rows: [x] });
  const scope = { transaction_id: ctx.transaction_id, database_transaction_id: '200', workspace_id: workspace,
    tenant_id: tenant, actor_id: actor, attempt: 1, async query(sql) {
      calls.push(sql);
      if (sql.includes('authorized_download')) return one({ mutation_id: version });
      if (sql.includes("auth.jwt()->>'role'") && !sql.includes('from documents.documents')) return one({ valid: true });
      if (sql.includes('d.tenant_id=$3') && sql.includes('storage_object_id')) return one({ valid: true, document_id: document, version_id: version, version: 1,
        bucket_id: 'document-vault', object_path: path, storage_object_id: objectId, storage_generation: 'generation-1',
        storage_etag: 'etag-1', sha256: 'a'.repeat(64), size_bytes: String(bytes.length), mime_type: 'application/pdf', now });
      if (sql.includes('as evaluated_at') && sql.includes('txid_current()')) return one({ transaction_id: '200', actor_id: actor, isolation: 'serializable', evaluated_at: now });
      if (sql.includes('canonical_authority_revision_v1')) return one({ revision: '2' });
      if (sql.includes('m.user_id::text as actor_id')) return one({ tenant_id: tenant, actor_id: actor,
        status: 'active', current: !options.revoked });
      if (sql.includes('from platform.customer_workspaces')) return one({ tenant_id: tenant });
      if (sql.includes('check_workspace_native_permission_v2')) return one({ allowed: true, evaluated_at: now,
        module_definition_id: id(13), entitlement_key: 'module.documents' });
      if (sql.includes('actor_bound')) return one({ transaction_id: '200', isolation: 'serializable', actor_bound: true, aal2: true });
      if (sql.includes('from documents.documents d where')) return one({ current_version: options.replaced ? 2 : 1, active: true });
      if (sql.includes('from documents.document_versions v\n')) return one({ version: 1, scanning_status: options.pending ? 'pending' : 'clean', checksum_status: 'verified' });
      if (sql.includes('from documents.document_permissions p\n')) return { rows: [], rowCount: 0 };
      if (sql.includes('customer_document_scope_matches')) return one({ allowed: !options.foreignReader });
      if (sql.includes('document_scan_attestations')) return one({ clean: true });
      if (sql.includes('clock_timestamp()::text as now')) return one({ now });
      throw Error('unexpected controlled SQL');
    } }; return { scope, calls };
}
await check('existing download provider additionally consumes exact current target visibility; access event only after accepted', async () => {
  const f = scopeFixture(), p = functional.createDocumentsFunctionalDownloadProviderV1(download, ctx);
  assert.equal(await p.providers.validateProviders(f.scope, command, auth), true, f.calls.map(s => s.slice(0,100)).join('\n'));
  assert.equal(p.readPrivateDownloadCandidate().reusable_as_download_authority, false);
  await p.providers.mutate(f.scope, command);
  assert.ok(f.calls.some(s => s.includes('customer_document_scope_matches'))); assert.equal(f.calls.filter(s => s.includes('insert into')).length, 1);
});
await check('module allow cannot bypass other-reader/revoked/replacement/pending target denials; zero modeled write', async () => {
  for (const options of [{ foreignReader: true }, { revoked: true }, { replaced: true }, { pending: true }]) {
    const f = scopeFixture(options), p = functional.createDocumentsFunctionalDownloadProviderV1(download, ctx);
    assert.equal(await p.providers.validateProviders(f.scope, command, auth), false);
    assert.equal(p.readPrivateDownloadCandidate(), null); await assert.rejects(p.providers.mutate(f.scope, command));
    assert.equal(f.calls.some(s => s.includes('insert into')), false);
  }
});
const { scanVaultDocumentOnceV1 } = await import('./documents-vault-scan-once-v1.mjs');
await check('Vault-only idle scanner entry does not scan other bucket or invoke fake verdict', async () => {
  const calls = [];
  const idle = await scanVaultDocumentOnceV1({ workerId: 'docs-functional-11', client: { async rpc(name) {
    calls.push(name); return { data: null, error: null };
  } } });
  assert.equal(idle.outcome, 'idle'); assert.deepEqual(calls, ['claim_document_scan_job_v1']);
});
await check('bad worker/lease/claim rejects before actual scanner; real scan remains NOT_RUN', async () => {
  let calls = 0; const client = { async rpc() { calls++; return { data: { job_id: 'bad' }, error: null }; } };
  await assert.rejects(scanVaultDocumentOnceV1({ workerId: '', client }), /WORKER_ID_INVALID/); assert.equal(calls, 0);
  await assert.rejects(scanVaultDocumentOnceV1({ workerId: 'docs-functional-11', client }), /SCAN_LEASE_INVALID/); assert.equal(calls, 1);
});
const commandsApi = load(new URL('../src/lib/customer/documents-functional-commands-v1.ts', import.meta.url));
const realAuthority = load(new URL('../src/lib/core/current-authority-postgres-provider-v1.ts', import.meta.url));
await check('application commands delegate canonical providers once, preserve UNKNOWN key/identity, never fabricate completion', async () => {
  const calls = [], unknown = { status: 'unknown_commit', code: 'READBACK_REQUIRED' };
  const commands = commandsApi.createDocumentsFunctionalCommandsV1({ async execute(cmd, providers) {
    assert.equal(providers.resolveAuthority, realAuthority.resolveAuthority);
    calls.push(structuredClone(cmd)); return unknown;
  } });
  assert.equal(await commands.issueNewIntent(intent, ctx), unknown); assert.equal(calls.length, 1);
  assert.equal(await commands.issueNewIntent(intent, ctx), unknown); assert.deepEqual(calls[0], calls[1]);
  assert.equal(calls[0].idempotency_key, intent.idempotency_key); assert.equal(calls[0].actor_id, ctx.actor_id);
  await assert.rejects(async () => commands.finalizeInitial({ contract_version: 'documents-initial-version.v1',
    context_id: contextId, workspace_id: workspace, intent_id: intentId, document_id: document, version_id: version,
    title: 'Synthetic', document_type: 'test', classification: 'confidential', idempotency_key: 'docs11-finalize' }, ctx, {}));
  assert.equal(calls.length, 2, 'unverified object must not dispatch finalization');
  await assert.rejects(async () => commands.promoteCleanReplacement({
    contract_version: 'documents-replacement-promotion-after-clean.v1', context_id: contextId, workspace_id: workspace,
    intent_id: intentId, document_id: document, parent_version_id: version, parent_version: 1,
    candidate_version_id: id(20), candidate_version: 2, attestation_id: id(21), idempotency_key: 'docs11-promote' }, ctx, {}));
  assert.equal(calls.length, 2, 'even a supplied attestation UUID cannot replace Storage verification');
  const prepared = await commands.preparePrivateDownload(download, ctx);
  assert.equal(prepared.result, unknown); assert.equal(prepared.private_candidate, null);
  assert.equal(prepared.outward_projection, null); assert.equal(prepared.current_disclosure, 'not_evaluated');
});
console.log(JSON.stringify({ result: 'PASS_CONTROLLED_SDK_AND_SQL_TRANSPORT_ONLY', groups: n,
  actual_storage_pg_scanner_core15_restart: 'NOT_RUN_NOT_PASS', task_completion: 'OPEN_PLATFORM12_CORE15_BINDING_REQUIRED' }));
