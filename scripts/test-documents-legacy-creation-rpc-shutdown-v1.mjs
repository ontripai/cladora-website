import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migrationPath =
  'supabase/migrations/20261018092958_documents_legacy_creation_rpc_shutdown_v1.sql';
const migration = readFileSync(migrationPath, 'utf8');

const routines = [
  'customer_api.create_upload_intent_v1',
  'customer_api.finalize_upload_v1',
  'documents.create_upload_intent_internal',
  'documents.finalize_upload_internal',
];

for (const routine of routines) {
  const escaped = routine.replace('.', '\\.');
  assert.match(migration, new RegExp(`create or replace function ${escaped}\\(`, 'i'));
  assert.match(migration, new RegExp(`alter function ${escaped}\\([^;]+owner to postgres`, 'is'));
  assert.match(migration, new RegExp(`revoke all on function ${escaped}\\([^;]+from public, anon, authenticated, service_role, cladora_rpc_owner,[^;]+cladora_ce_guide_runtime, cladora_ce_guide_executor`, 'is'));
}

assert.equal((migration.match(/security invoker/gi) ?? []).length, 4);
assert.equal((migration.match(/set search_path = pg_catalog/gi) ?? []).length, 4);
assert.equal((migration.match(/errcode = '55000'/gi) ?? []).length, 4);
assert.equal((migration.match(/message = 'canonical_document_writer_required'/gi) ?? []).length, 4);

assert.doesNotMatch(migration, /security definer/i);
assert.doesNotMatch(migration, /\bgrant\b/i);
assert.doesNotMatch(migration, /\b(?:insert|update|delete)\s+(?:into\s+|from\s+)?documents\./i);
assert.doesNotMatch(migration, /return\s+(?:documents|customer_api)\./i);

console.log('Documents legacy creation RPC shutdown contract: PASS', {
  migration: migrationPath,
  routines,
});
