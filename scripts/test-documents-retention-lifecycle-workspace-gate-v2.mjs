import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';

const migration = readFileSync(
  'supabase/migrations/20261018150000_documents_retention_lifecycle_workspace_gate_v2.sql',
  'utf8',
);
const internal = [
  'place_legal_hold_internal',
  'release_legal_hold_internal',
  'request_disposition_internal',
  'approve_disposition_internal',
  'assign_retention_policy_internal',
];
const customer = [
  'place_legal_hold_v1',
  'release_legal_hold_v1',
  'request_document_disposition_v1',
  'approve_document_disposition_v1',
  'assign_retention_policy_v1',
];
for (const name of internal) {
  assert.match(migration, new RegExp(`create or replace function documents\\.${name}`));
}
for (const name of customer) {
  assert.match(migration, new RegExp(`create or replace function customer_api\\.${name}`));
}
assert.equal((migration.match(/canonical_document_retention_preflight_required/g) ?? []).length, 10);
assert.doesNotMatch(migration, /\b(?:insert\s+into|update\s+documents\.|delete\s+from)\b/i);
assert.doesNotMatch(migration, /\b(?:grant|revoke)\b[^;]*\bon\s+(?:table\s+)?documents\./i);
assert.doesNotMatch(migration, /storage\.objects|communications\./i);

const routes = [
  'src/app/api/customer/v1/documents/[id]/retention/route.ts',
  'src/app/api/customer/v1/documents/[id]/holds/route.ts',
  'src/app/api/customer/v1/documents/[id]/holds/release/route.ts',
  'src/app/api/customer/v1/documents/[id]/disposition/route.ts',
  'src/app/api/customer/v1/documents/[id]/disposition/[reqId]/approve/route.ts',
];
for (const path of routes) {
  const source = readFileSync(path, 'utf8');
  assert.match(source, /CANONICAL_DOCUMENT_RETENTION_PREFLIGHT_UNAVAILABLE/);
  assert.match(source, /status:\s*503/);
  assert.doesNotMatch(source, /\.rpc\(|createClient|createAdminClient|\.storage\b/);
  assert.doesNotMatch(source, /documents-retention-lifecycle-workspace-v2/);
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
  '../src/lib/customer/documents-retention-lifecycle-workspace-v2.ts', import.meta.url));
const id = value => `7b000000-0000-4000-8000-${String(value).padStart(12, '0')}`;
const context = { transaction_id: id(1), command_id: id(2), actor_id: id(3),
  authority_version: 14 };
const input = {
  contract_version: 'documents-retention-lifecycle-workspace.v2',
  context_id: id(4), workspace_id: id(5), property_id: id(6), property_version: 2,
  request: {
    contract_version: 'documents-country-retention-operation-request.v1',
    mode: 'current',
    target: { document_id: id(7), document_version_id: id(8), document_version: 4 },
    requested_operation: 'dispose',
  },
  idempotency_key: 'documents-retention-preflight-01',
};

const command = api.buildDocumentsRetentionLifecycleWorkspaceCommandV2(input, context);
assert.equal(command.contract_version, 'core-transaction-command.v2');
assert.equal(command.workspace_id, input.workspace_id);
assert.equal(command.aggregate_type, 'portfolio.property');
assert.equal(command.aggregate_id, input.property_id);
assert.equal(command.permission_code, 'documents.vault.read');
assert.equal(command.module_code, 'documents');
assert.equal(command.evaluation_purpose, 'documents.country-retention.resolve');
assert.deepEqual(command.provider_source_ids,
  [input.property_id, input.request.target.document_id, input.request.target.document_version_id]);
assert.deepEqual(command.subject_reference, {
  kind: 'documents.document_version', id: input.request.target.document_version_id,
  version: 4, relation: 'dispose', request_version: 1,
});
assert.match(command.input_fingerprint, /^sha256:[a-f0-9]{64}$/);

const providers = api.createDocumentsRetentionLifecycleWorkspaceProvidersV2(input);
assert.equal(providers.provider_code, 'documents-country-retention-operation.v1');
assert.equal(providers.replay_policy, 'provider_current_state_required');
assert.equal(typeof providers.validateReplay, 'function');
assert.equal(typeof providers.mutate, 'function');

for (const injected of [{ disposal_enabled: true }, { storage_delete: true },
  { permission_code: 'documents.vault.manage' }, { tenant_id: id(9) }]) {
  assert.throws(() => api.buildDocumentsRetentionLifecycleWorkspaceCommandV2(
    { ...input, ...injected }, context), /unrecognized/i);
}

console.log('Documents retention/lifecycle Workspace gate V2: PASS');
