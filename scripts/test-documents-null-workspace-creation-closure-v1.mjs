import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = path => readFileSync(path, 'utf8');
const sha256 = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const migrationPath = 'supabase/migrations/20261014200948_document_null_workspace_creation_closure_v1.sql';
const migration = read(migrationPath);
const writerPath = 'src/lib/customer/documents-workspace-binding-writer-v1.ts';
const replacementWriterPath = 'src/lib/customer/documents-replacement-workspace-writer-v1.ts';
const writer = read(writerPath);

assert.equal(sha256('supabase/migrations/20261013063739_document_reference_exact_workspace_v1.sql'),
  '988a8ddea361421cf6d75700ac3b0332c59ef0e10862201d2c2da0db48f91c51');
assert.equal(sha256('supabase/migrations/20261014083050_document_workspace_binding_writer_v1.sql'),
  '1e7b64b5e623b9ca9f3eee43e1b41ac61f9fe9be008d1c59fa90e68d9ed3804d');
assert.equal(sha256('src/lib/customer/documents-reference-authority-v1.ts'),
  '207508432524698b701f5808d4b74ee4c007950d262c238dc7164f734f47b5b5');
assert.equal(sha256('src/lib/customer/documents-reference-tx-selector-v1.ts'),
  '51d80abfd0fda5d005d7c54b734b2bc8e2a168a6d3d87b0e05050146fa7089c7');
assert.equal(sha256('src/lib/core/transaction-replay-provider-hook-v1.ts'),
  'eb20fa622ba10b9cde6ea8d4d64f1ad9f9eea93f7fba354d03f6959156487dd4');
assert.equal(sha256('src/lib/core/postgres-transaction-host-v1.ts'),
  'ce0360f30f1c49ff06e8ec944ba7263e0012c56fb2c27e5094d6604a1cf09a6e');

assert.match(migration, /before insert on documents\.upload_intents/i);
assert.match(migration, /before update of status,consumed_at on documents\.upload_intents/i);
assert.match(migration, /before insert on documents\.documents/i);
assert.match(migration, /new\.workspace_id is null/);
assert.match(migration, /ui\.prospective_document_id = new\.id/);
assert.match(migration, /ui\.status = 'consumed'/);
assert.match(migration, /current_setting\('documents\.workspace_binding_writer_v1', true\)/);
assert.match(migration, /v_marker->>'non_overwritable' <> 'true'/);
assert.match(migration, /owner to postgres/);
assert.match(migration,
  /revoke all on function documents\.reject_unbound_new_document_intent_v1\(\)[^]*from public, anon, authenticated, service_role/i);
assert.match(migration,
  /revoke all on function documents\.require_workspace_bound_document_insert_v1\(\)[^]*from public, anon, authenticated, service_role/i);
assert.doesNotMatch(migration, /\b(?:grant|update\s+documents\.documents|alter\s+column\s+workspace_id\s+set\s+default|backfill)\b/i);

const markerAt = writer.indexOf("set_config('documents.canonical_storage_identity_v1'");
const consumeAt = writer.indexOf('update documents.upload_intents', markerAt);
const documentAt = writer.indexOf('insert into documents.documents', markerAt);
assert.ok(markerAt > 0 && consumeAt > markerAt && documentAt > consumeAt);
for (const binding of ['intent_id', 'document_id', 'version_id', 'workspace_id', 'actor_id',
  'bucket_id', 'object_path', 'storage_object_id', 'generation_capability',
  'etag_capability', 'sha256', 'size_bytes', 'detected_mime_type', 'non_overwritable']) {
  assert.match(writer.slice(markerAt, consumeAt), new RegExp(`\\b${binding}\\b`));
}

const migrationInsertOwners = readdirSync('supabase/migrations')
  .filter(name => name.endsWith('.sql'))
  .filter(name => /insert\s+into\s+documents\.(?:documents|document_versions)/i
    .test(read(join('supabase/migrations', name))));
assert.deepEqual(migrationInsertOwners, [
  '20260909133706_secure_documents_evidence_vault.sql',
  '20260927211340_scoped_company_contractor_document_upload.sql',
]);
const srcInsertOwners = [];
const walk = directory => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) walk(path);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)
      && /insert\s+into\s+documents\.(?:documents|document_versions)/i.test(read(path))) srcInsertOwners.push(path);
  }
};
walk('src');
assert.deepEqual(srcInsertOwners, [replacementWriterPath, writerPath]);

const intentRoute = read('src/app/api/customer/v1/documents/upload-intent/route.ts');
const finalizeRoute = read('src/app/api/customer/v1/documents/upload/route.ts');
assert.match(intentRoute, /CANONICAL_DOCUMENT_WRITER_UNAVAILABLE/);
assert.match(finalizeRoute, /CANONICAL_DOCUMENT_WRITER_UNAVAILABLE/);
assert.doesNotMatch(intentRoute, /create_upload_intent_v1|\.rpc\(/);
assert.doesNotMatch(finalizeRoute, /finalize_upload_v1|\.rpc\(|\.upload\(/);
assert.match(read('supabase/migrations/20260909133706_secure_documents_evidence_vault.sql'),
  /create or replace function customer_api\.finalize_upload_v1[^]*return documents\.finalize_upload_internal/i);
assert.match(read('supabase/migrations/20260927211340_scoped_company_contractor_document_upload.sql'),
  /insert into documents\.documents\s*\([^]*id, tenant_id, property_id,[^]*\)/i);

console.log('Documents NULL Workspace creation closure contract: PASS', {
  migration: migrationPath,
  migrationInsertOwners,
  srcInsertOwners,
});
