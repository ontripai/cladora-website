import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const migrationPath =
  'supabase/migrations/20261018094131_documents_canonical_storage_identity_v1.sql';
const migration = read(migrationPath);
const executableMigration = migration.replace(/--.*$/gm, '');
const writer = read('src/lib/customer/documents-workspace-binding-writer-v1.ts');
const replacementWriter = read('src/lib/customer/documents-replacement-workspace-writer-v1.ts');
const intentRoute = read('src/app/api/customer/v1/documents/upload-intent/route.ts');
const uploadRoute = read('src/app/api/customer/v1/documents/upload/route.ts');

for (const column of [
  'operation_kind', 'expected_parent_version_id', 'committed_document_id',
  'committed_version_id', 'verified_storage_object_id', 'verified_storage_generation',
  'verified_storage_etag', 'verified_sha256', 'verified_size_bytes',
]) assert.match(migration, new RegExp(`add column ${column}\\b`, 'i'));

for (const column of [
  'upload_intent_id', 'replaces_version_id', 'bucket_id', 'storage_object_id',
  'storage_generation', 'storage_etag',
]) assert.match(migration, new RegExp(`add column ${column}\\b`, 'i'));

assert.doesNotMatch(migration, /prospective_version_id/i);
assert.match(migration, /operation_kind in \('new_document', 'replacement_version'\)/i);
assert.match(migration, /document_operation_kind_required/);
assert.match(migration, /historical_upload_intent_cannot_be_rebound/);
assert.match(migration, /trusted_storage_identity_required/);
assert.match(migration, /deferrable initially deferred/gi);
for (const [indexName, columns] of [
  ['document_versions_upload_intent_fk_v1_idx', 'tenant_id, upload_intent_id'],
  ['upload_intents_expected_parent_v1_idx', 'tenant_id, document_id, expected_parent_version_id'],
  ['upload_intents_committed_version_v1_idx', 'tenant_id, committed_document_id, committed_version_id'],
]) {
  assert.match(
    migration,
    new RegExp(`create index ${indexName}\\s+on documents\\.[a-z_]+\\(${columns}\\)`, 'i'),
  );
}
assert.match(migration, /storage_object_id' <> new\.verified_storage_object_id::text/);
assert.match(migration, /generation_capability' not in \('exposed', 'not_exposed'\)/);
assert.match(migration, /etag_capability' not in \('exposed', 'not_exposed'\)/);
assert.doesNotMatch(executableMigration, /\bbackfill\b|alter column[^;]+set default/i);

assert.match(writer, /operation_kind,expected_parent_version_id/);
assert.match(writer, /committed_document_id=\$4,committed_version_id=\$5/);
assert.match(writer, /verified_storage_object_id=\$6/);
assert.match(writer, /upload_intent_id,replaces_version_id,bucket_id,storage_object_id/);
assert.match(writer, /DocumentsStoredObjectProviderUnavailableV1/);
assert.match(writer, /documents\.canonical_storage_identity_v1/);
assert.doesNotMatch(writer, /prospective_version_id/);

assert.match(replacementWriter, /operation_kind='replacement_version'/);
assert.match(replacementWriter, /expected_parent_version_id/);
assert.match(replacementWriter, /'verified','scanning_pending'/);
assert.match(replacementWriter, /replaces_version_id/);
assert.match(replacementWriter, /provider_current_state_required/);
assert.match(replacementWriter, /for update of ui/);
assert.match(replacementWriter, /for update of d/);
assert.match(replacementWriter, /for share of v/);
assert.doesNotMatch(replacementWriter, /prospective_version_id/);
assert.doesNotMatch(replacementWriter, /update\s+documents\.documents/i);

for (const route of [intentRoute, uploadRoute]) {
  assert.match(route, /CANONICAL_DOCUMENT_WRITER_UNAVAILABLE/);
  assert.match(route, /status:\s*503/);
  assert.doesNotMatch(route, /\.rpc\(|\.upload\(|already exists/i);
}

console.log('Documents canonical Storage identity contract: PASS', {
  migration: migrationPath,
  route_state: 'MAINTENANCE',
});
