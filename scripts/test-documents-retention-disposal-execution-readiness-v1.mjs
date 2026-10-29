import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const files = Object.freeze({
  document: 'docs/roadmap/CLADORA-DOCUMENTS-RETENTION-DISPOSAL-EXECUTION-READINESS-04-v1.0.md',
  operation: 'src/lib/customer/documents-country-retention-operation-integration-v1.ts',
  operationContract: 'docs/contracts/CLADORA-DOCUMENTS-COUNTRY-RETENTION-OPERATION-INTEGRATION-v1.0.md',
  writer: 'src/lib/customer/documents-workspace-binding-writer-v1.ts',
  host: 'src/lib/core/postgres-transaction-host-v1.ts',
  replay: 'src/lib/core/transaction-replay-provider-hook-v1.ts',
  baseVault: 'supabase/migrations/20260825001900_documents_vault_legal_records.sql',
  canonicalVault: 'supabase/migrations/20260829005100_customer_document_vault_secure_evidence.sql',
  secureVault: 'supabase/migrations/20260909133706_secure_documents_evidence_vault.sql',
  legacyRetention: 'supabase/migrations/20260921172651_retention_archive_legal_hold_discovery_r9.sql',
  legacyDryRun: 'supabase/migrations/20260923060219_retention_operations_read_model_dry_run.sql',
  storageIntent: 'supabase/migrations/20260928042750_document_vault_storage_intent_rls.sql',
  scanner: 'scripts/document-clamav-worker.mjs',
  requestRoute: 'src/app/api/customer/v1/documents/[id]/disposition/route.ts',
  approvalRoute: 'src/app/api/customer/v1/documents/[id]/disposition/[reqId]/approve/route.ts',
});

const expectedHashes = Object.freeze({
  operation: 'fa0d815e149b64f02ff864f2293b89fe2acfffb8b1b6e821fc2b7d85c907ce3c',
  operationContract: 'cb167391603adaca55a96cb0b8c5fd4fd918b5b03892d1d309d8462254ecbcd0',
  writer: '33946d944b49eea1495bddca1979aa19f227694e533106c91d4ceed234f83c94',
  host: '5ae0d49cde0850c3d8b2c55bc2398d685e1c833d2e9a9e176ee8eab8d1cdce06',
  replay: 'eb20fa622ba10b9cde6ea8d4d64f1ad9f9eea93f7fba354d03f6959156487dd4',
  baseVault: 'c5533819e44344d06619f2887c2a24d16fbfa7b9ccd31e6eb87f21dda5a04375',
  canonicalVault: 'd7f41f90b94336bfaae4fea2c6a35be77eb30dd5640fe9c87fbe01f9d7ecaaf1',
  secureVault: '2ce2159b0b8cfb6c80323e6260ce28a8e0773ce8be2e143ab22d835b2a087e71',
  legacyRetention: 'f23ad93220d27b3c8a95e6fbbec2f92d904ee5aec1c1e8dbd7923feb9ab72629',
  legacyDryRun: 'dbe7c3dc7a3eb395b1aab4ec430f947b1f56989683b4f8bae4dac652d69fb67b',
  storageIntent: '34aa45f269042ac0d409103040d3e39968320da76cad81f770a77bcac430935f',
  scanner: '359c09bf7848861f88d2cf2d081f818bc44274b9454488e2ca201c08719a6e9c',
  requestRoute: '935b9489fbe425c3a09e1c30e4c193e970d15d21e7aa193990f337d38d9029ea',
  approvalRoute: '8d24c69e82d9ae4d1d48f46fe0fb2cfbec338f760f469cf8b6574956cc2b04cf',
});

const source = Object.fromEntries(Object.entries(files).map(([key, path]) => [
  key, readFileSync(path, 'utf8'),
]));
const sha256 = value => createHash('sha256').update(value).digest('hex');

let count = 0;
function test(name, fn) {
  fn();
  count += 1;
  console.log(`ok ${count} - ${name}`);
}

test('reviewed Repository artifacts remain byte-exact', () => {
  for (const [key, expected] of Object.entries(expectedHashes)) {
    assert.equal(sha256(source[key]), expected, `${files[key]} changed after readiness audit`);
  }
});

test('package is extension-blocked and contains no execution activation', () => {
  assert.match(source.document, /Status: `core_or_storage_extension_required`/);
  assert.match(source.document, /no executable[\s\S]*disposal provider/);
  assert.match(source.document, /no executable[\s\S]*migration[\s\S]*route[\s\S]*Storage call/);
  assert.match(source.document, /not ready for disposal implementation or activation/);
});

test('#452 remains fixed-profile, non-authorizing preflight', () => {
  assert.match(source.operation, /permission_code === 'documents\.vault\.read'/);
  assert.match(source.operation, /evaluation_purpose === 'documents\.country-retention\.resolve'/);
  assert.match(source.operation, /reusable_as_command_authority: z\.literal\(false\)/);
  assert.match(source.operation, /requested_operation: operation/);
  assert.doesNotMatch(source.operation, /\.storage\.from|deleteObject|\.remove\(/);
  assert.match(source.operationContract, /`dispose` a denied preflight/);
});

test('current document, lifecycle and hold sources are inventoried separately', () => {
  assert.match(source.baseVault, /create table documents\.documents/);
  assert.match(source.baseVault, /create table documents\.document_versions/);
  assert.match(source.baseVault, /legal_hold boolean not null default false/);
  assert.match(source.canonicalVault, /create table documents\.legal_holds/);
  assert.match(source.canonicalVault, /create table documents\.lifecycle_events/);
  assert.match(source.operation, /d\.legal_hold as legacy_legal_hold/);
  assert.match(source.operation, /from documents\.legal_holds h/);
  assert.match(source.document, /`app_private\.legal_holds` plus\s+`app_private\.legal_hold_targets`[\s\S]*third,[\s\S]*separate control plane/);
  assert.match(source.legacyRetention, /create table app_private\.legal_hold_scope_epochs/);
  assert.match(source.legacyRetention, /target_type text not null check \(target_type in \('document','property','vendor','class_date_range'\)\)/);
});

test('legacy disposal paths are recorded but cannot authorize canonical execution', () => {
  assert.match(source.secureVault, /DEFERRED-PHYSICAL-DISPOSITION-EXECUTION/);
  assert.match(source.secureVault, /dual_control_requester_cannot_approve_disposition/);
  assert.match(source.legacyRetention, /create table app_private\.storage_delete_outbox/);
  assert.match(source.legacyRetention, /delete from documents\.document_versions/);
  const legacyHoldFunction = source.legacyRetention.match(
    /create or replace function app_private\.is_document_held[\s\S]*?end \$\$;/,
  )?.[0] ?? '';
  assert.match(legacyHoldFunction, /app_private\.legal_holds/);
  assert.doesNotMatch(legacyHoldFunction, /documents\.legal_holds|d\.legal_hold/);
  assert.match(source.document, /all three legal-hold control[\s\n]+planes as safety inputs/);
  assert.match(source.document, /direct document targets and indirect property, vendor and[\s\n]+class\/date targets/i);
  assert.match(source.legacyRetention, /from documents\.document_links l/);
  assert.match(source.legacyRetention, /maintenance\.vendor_quotes q/);
  assert.match(source.legacyRetention, /maintenance\.purchase_orders o/);
  assert.match(source.legacyRetention, /app_private\.document_retention_requirements rr/);
  assert.match(source.legacyRetention, /app_private\.retention_policy_rules pr/);
  assert.match(source.secureVault, /create or replace function customer_api\.link_document_entity_v1/);
  assert.match(source.secureVault, /insert into documents\.document_links/);
  assert.match(source.secureVault, /grant execute on function customer_api\.link_document_entity_v1[\s\S]*to authenticated/);
  assert.match(source.document, /`customer_api\.link_document_entity_v1` can make an already active vendor hold[\s\n]+applicable without changing `legal_hold_scope_epochs`/);
  for (const functionName of [
    'create_legal_hold_v1',
    'add_legal_hold_target_v1',
    'activate_legal_hold_v1',
    'release_legal_hold_v1',
  ]) {
    assert.match(source.legacyRetention, new RegExp(`create or replace function app_private\\.${functionName}`));
  }
  assert.match(source.legacyRetention, /app_private\.create_legal_hold_v1[\s\S]*app_private\.add_legal_hold_target_v1[\s\S]*app_private\.activate_legal_hold_v1[\s\S]*app_private\.release_legal_hold_v1[\s\S]*to authenticated;/);
  const epochMutations = source.legacyRetention.match(/legal_hold_scope_epochs/g) ?? [];
  assert.ok(epochMutations.length >= 5, 'Phase 3A hold mutations must expose the shared scope epoch');
});

test('Core database atomicity is not represented as external delete recovery', () => {
  assert.match(source.host, /No network effects, durable writes or cached allow/);
  assert.match(source.host, /insert into platform\.idempotency_keys/);
  assert.match(source.host, /insert into audit\.events/);
  assert.match(source.host, /insert into platform\.outbox_events/);
  assert.match(source.host, /READBACK_REQUIRED/);
  assert.match(source.replay, /read_only: z\.literal\(true\)/);
  assert.match(source.document, /Those guarantees stop at the database transaction/);
});

test('Storage inventory proves upload identity but no official version-delete worker', () => {
  assert.match(source.writer, /non_overwritable: z\.literal\(true\)/);
  assert.doesNotMatch(source.writer, /object_version|generation|etag/i);
  assert.match(source.storageIntent, /for insert to authenticated/);
  assert.doesNotMatch(source.storageIntent, /for delete to authenticated|for update to authenticated/i);
  assert.match(source.scanner, /\.download\(target\.object_path\)/);
  assert.doesNotMatch(source.scanner, /\.remove\(|deleteObject|conditionalDelete/i);
  assert.match(source.document, /Path-only delete is[\s\n]+forbidden/);
});

test('approval and final fence contract binds every destructive prerequisite', () => {
  assert.match(source.secureVault, /resolve_vault_actor\(p_context_id, 'documents\.vault\.disposition', false\)/);
  assert.match(source.secureVault, /resolve_vault_actor\(p_context_id, 'documents\.vault\.disposition', true\)/);
  assert.match(source.document, /legacy request RPC resolves `documents\.vault\.disposition` with[\s\S]*`p_require_aal2=false`/);
  assert.match(source.document, /approval RPC requires AAL2 and one reviewer distinct from the[\s\n]+requester/);
  for (const phrase of [
    'at least two distinct current human approval decisions',
    'current AAL2 session',
    'Property, document ID, document immutable version ID and numeric version',
    'provider object-version/generation token',
    'all three legal-hold observations',
    'app_private.legal_hold_scope_epochs',
    'all three legal-hold control planes',
    'Phase 3A scope epoch',
    'Phase 3A applicability',
    'document-link insert/delete',
    'retention requirement/rule class or classification-date changes',
    'every other writer of a Phase 3A',
    'exact committed receipt evidence',
    'make hold/version changes and Storage gateway',
    'zero destructive effect',
  ]) assert.ok(source.document.includes(phrase), `missing contract phrase: ${phrase}`);
});

test('acknowledgement loss, replay and tombstone behavior is fail-closed', () => {
  assert.match(source.document, /never issues an unqualified second[\s\n]+delete/);
  assert.match(source.document, /another version\/object now occupies the path: quarantine/);
  assert.match(source.document, /Exact Core replay returns the original receipt/);
  assert.match(source.document, /Only verified absence of the exact provider object version/);
  assert.match(source.document, /[Oo]ne immutable tombstone\/evidence set; no second\s+Storage operation/);
});

test('rollback and restore boundaries do not promise reversible deletion', () => {
  assert.match(source.document, /Before Storage gateway acceptance, rollback means/);
  assert.match(source.document, /database rollback[\s\n]+cannot restore bytes/);
  assert.match(source.document, /restore boundary is `restore_unavailable`/);
  assert.match(source.document, /never rewrites or resurrects the disposed immutable version/);
});

test('required owner dependencies are explicit and no legacy ledger is adopted', () => {
  assert.match(source.document, /`CORE-DESTRUCTIVE-EFFECT-APPROVAL-DISPATCH-01`/);
  assert.match(source.document, /`STORAGE-CONDITIONAL-OBJECT-VERSION-DELETE-RECEIPT-01`/);
  assert.match(source.document, /must not\s+define a parallel approval, audit, outbox or idempotency\s+store/);
  assert.match(source.document, /Either missing extension keeps the package at[\s\n]+`core_or_storage_extension_required`/);
});

test('legacy HTTP surface remains deferred and contains no Storage delete', () => {
  assert.match(source.requestRoute, /request_document_disposition_v1/);
  assert.match(source.approvalRoute, /approve_document_disposition_v1/);
  assert.doesNotMatch(source.requestRoute + source.approvalRoute,
    /\.storage\.from|deleteObject|\.remove\(/);
});

console.log(`Documents retention disposal execution readiness: ${count}/${count} PASS`);
