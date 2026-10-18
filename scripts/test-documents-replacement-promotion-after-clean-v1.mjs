import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const migration = readFileSync(
  'supabase/migrations/20261018130000_documents_replacement_promotion_after_clean_v1.sql', 'utf8');
const providerSource = readFileSync(
  'src/lib/customer/documents-replacement-promotion-after-clean-v1.ts', 'utf8');
assert.match(migration, /acquire_core_platform_role_safety_mutation_lock_v1/);
assert.match(migration, /candidate\.scanning_status = 'clean'/);
assert.match(migration, /attestation\.provider = 'clamav'/);
assert.match(migration, /attestation\.content_sha256 = candidate\.sha256/);
assert.match(migration, /new\.current_version <> old\.current_version \+ 1/);
assert.match(migration, /clean_replacement_promotion_required/);
assert.doesNotMatch(migration.replace(/--.*$/gm, ''), /grant\s+execute/i);
assert.match(providerSource, /for update of ui/);
assert.match(providerSource, /for update of d/);
assert.match(providerSource, /for share of v/);
assert.match(providerSource, /for share of a/);
assert.match(providerSource, /provider_current_state_required/);

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

const api = load(new URL('../src/lib/customer/documents-replacement-promotion-after-clean-v1.ts', import.meta.url));
const storageApi = load(new URL('../src/lib/customer/documents-workspace-binding-writer-v1.ts', import.meta.url));
const id = value => `77000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const actor = id(1), workspace = id(2), contextId = id(3), intentId = id(4), documentId = id(5);
const parentId = id(6), candidateId = id(7), attestationId = id(8), tenant = id(9), objectId = id(10);
const context = { transaction_id: id(11), command_id: id(12), actor_id: actor, authority_version: 4 };
const input = { contract_version: 'documents-replacement-promotion-after-clean.v1',
  context_id: contextId, workspace_id: workspace, intent_id: intentId, document_id: documentId,
  parent_version_id: parentId, parent_version: 1, candidate_version_id: candidateId,
  candidate_version: 2, attestation_id: attestationId,
  idempotency_key: 'documents-replacement-promote-01' };
const objectPath = `${tenant}/${intentId}/v2.pdf`;
const verified = await storageApi.verifyDocumentsStoredObjectBeforeTransactionV1({
  bucket_id: 'document-vault', object_path: objectPath,
}, async target => ({ ...target, storage_object_id: objectId,
  generation_capability: 'not_exposed', storage_generation: null,
  etag_capability: 'not_exposed', storage_etag: null, sha256: 'c'.repeat(64),
  size_bytes: 1024, detected_mime_type: 'application/pdf', non_overwritable: true }));
const authority = purpose => ({ contract_version: 'core-current-authority-decision-receipt.v1',
  receipt_version: 1, decision_id: id(13), context_id: contextId, workspace_id: workspace,
  actor_id: actor, authority_version: 4, permission_code: 'documents.vault.upload',
  module_code: 'documents', evaluation_purpose: purpose, decision: 'allowed',
  evaluated_at: new Date().toISOString(), transaction_context: { transaction_id: context.transaction_id,
    command_id: context.command_id, attempt: 1, isolation_level: 'serializable', lock: {
      kind: 'command_aggregate', workspace_id: workspace, aggregate_type: 'documents.document',
      aggregate_id: documentId, acquired_at: new Date().toISOString() } } });

function harness({ replayValid = true } = {}) {
  const calls = [];
  const scope = { transaction_id: context.transaction_id, database_transaction_id: '103',
    workspace_id: workspace, tenant_id: tenant, actor_id: actor, attempt: 1,
    async query(text, values) {
      calls.push({ text, values });
      if (text.includes('select exists(')) return { rows: [{ valid: replayValid,
        now: new Date().toISOString() }], rowCount: 1 };
      if (text.includes("auth.jwt()->>'aal'")) return { rows: [{ valid: true }], rowCount: 1 };
      if (/from documents\.(upload_intents|documents|document_versions|document_scan_attestations)/.test(text)) {
        return { rows: [{ valid: true }], rowCount: 1 };
      }
      if (text.includes("set_config('documents.replacement_promotion_after_clean_v1'")) {
        return { rows: [{}], rowCount: 1 };
      }
      if (text.includes('update documents.documents')) return { rows: [{ mutation_id: documentId }], rowCount: 1 };
      if (text.includes('insert into documents.access_events')) return { rows: [], rowCount: 1 };
      throw new Error(`unexpected query: ${text}`);
    } };
  return { scope, calls };
}

function receipt(command) {
  return { contract_version: 'core-transaction-receipt.v1', receipt_version: 1,
    receipt_id: id(14), transaction_id: command.transaction_id, command_id: command.command_id,
    workspace_id: workspace, actor_id: actor, aggregate_type: command.aggregate_type,
    aggregate_id: documentId, aggregate_version: 2, input_fingerprint: command.input_fingerprint,
    idempotency_key: command.idempotency_key, replay_validation: {
      contract_version: 'core-transaction-replay-provider-requirement.v1',
      provider_code: api.DOCUMENTS_REPLACEMENT_PROMOTION_REPLAY_PROVIDER_CODE_V1 },
    authority: authority(command.evaluation_purpose), mutation_id: candidateId,
    audit_event_id: '1', outbox_event_id: id(15), committed_at: new Date().toISOString() };
}

let checks = 0;
const check = async (name, run) => { await run(); console.log(`ok ${++checks} - ${name}`); };

await check('promotion command binds intent, parent, candidate, attestation and exact object', async () => {
  const command = api.buildDocumentsReplacementPromotionAfterCleanCommandV1(input, context, verified);
  assert.equal(command.aggregate_id, documentId); assert.equal(command.aggregate_version, 2);
  assert.deepEqual(command.provider_source_ids,
    [intentId, documentId, parentId, candidateId, attestationId, objectId]);
});

await check('validation follows canonical lock order and mutation is a single CAS', async () => {
  const command = api.buildDocumentsReplacementPromotionAfterCleanCommandV1(input, context, verified);
  const provider = api.createDocumentsReplacementPromotionAfterCleanProvidersV1(input, context, verified);
  const { scope, calls } = harness();
  assert.equal(await provider.validateProviders(scope, command, authority(command.evaluation_purpose)), true);
  const locked = calls.filter(call => /for (?:update|share) of/.test(call.text));
  assert.match(locked[0].text, /for update of ui/); assert.match(locked[1].text, /for update of d/);
  assert.match(locked[2].text, /for share of v/); assert.match(locked[3].text, /for share of v/);
  assert.match(locked[4].text, /for share of a/);
  assert.deepEqual(await provider.mutate(scope, command), { mutation_id: candidateId });
  const update = calls.find(call => call.text.includes('update documents.documents'));
  assert.match(update.text, /set current_version=\$4/);
  assert.doesNotMatch(update.text, /title|document_type|classification/);
  const marker = JSON.parse(calls.find(call => call.text.includes(
    "set_config('documents.replacement_promotion_after_clean_v1'")).values[0]);
  assert.equal(marker.attestation_id, attestationId); assert.equal(marker.storage_object_id, objectId);
});

await check('exact replay is current-state required and read-only', async () => {
  const command = api.buildDocumentsReplacementPromotionAfterCleanCommandV1(input, context, verified);
  const provider = api.createDocumentsReplacementPromotionAfterCleanProvidersV1(input, context, verified);
  const { scope, calls } = harness();
  const decision = await provider.validateReplay(scope, command,
    authority(command.evaluation_purpose), receipt(command));
  assert.equal(decision.decision, 'accepted'); assert.equal(decision.read_only, true);
  assert.equal(calls.some(call => /^\s*(?:insert|update|delete)\b/i.test(call.text)), false);
  const changed = harness({ replayValid: false });
  assert.equal((await provider.validateReplay(changed.scope, command,
    authority(command.evaluation_purpose), receipt(command))).decision, 'denied');
});

await check('invalid sequence, forged object and cross-Workspace input fail closed', async () => {
  assert.throws(() => api.buildDocumentsReplacementPromotionAfterCleanCommandV1(
    { ...input, candidate_version: 3 }, context, verified), /candidate_version_must_follow_parent/);
  assert.throws(() => api.buildDocumentsReplacementPromotionAfterCleanCommandV1(input, context, {
    bucket_id: 'document-vault', object_path: objectPath, storage_object_id: objectId,
    generation_capability: 'not_exposed', storage_generation: null,
    etag_capability: 'not_exposed', storage_etag: null, sha256: 'c'.repeat(64), size_bytes: 1024,
    detected_mime_type: 'application/pdf', non_overwritable: true,
  }), /stored_object_verification_required/);
  const command = api.buildDocumentsReplacementPromotionAfterCleanCommandV1(input, context, verified);
  const provider = api.createDocumentsReplacementPromotionAfterCleanProvidersV1(input, context, verified);
  const cross = harness(); cross.scope.workspace_id = id(99);
  assert.equal(await provider.validateProviders(cross.scope, command, authority(command.evaluation_purpose)), false);
  assert.equal(cross.calls.length, 0);
});

console.log(`Documents replacement promotion after clean contract: ${checks}/${checks} PASS`);
