import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const migrationName = '20261018151500_documents_service_role_acl_cleanup_v1.sql';
const testName = '194_documents_service_role_acl_cleanup.test.sql';
const d7Name = '20261018150000_documents_retention_lifecycle_workspace_gate_v2.sql';
const s1Name = '20261018153000_communications_private_message_currentness_gate_v2.sql';
const migrations = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort();
const migration = readFileSync(`supabase/migrations/${migrationName}`, 'utf8');
const test = readFileSync(`supabase/tests/${testName}`, 'utf8');

// Includes the bounded handoff and forward Finance/Governance and Assets corrections.
assert.equal(migrations.length, 294);
assert.ok(migrations.indexOf(d7Name) < migrations.indexOf(migrationName));
assert.ok(migrations.indexOf(migrationName) < migrations.indexOf(s1Name));
assert.match(migration, /expected 96 direct privileges across 12 application tables/i);
assert.match(migration, /revoke all privileges on table\s+documents\.access_events,\s+documents\.document_audit_links,\s+documents\.document_links,\s+documents\.document_permissions,\s+documents\.document_versions,\s+documents\.documents,\s+documents\.folders,\s+documents\.legal_holds,\s+documents\.legal_records,\s+documents\.lifecycle_events,\s+documents\.retention_policies,\s+documents\.retention_records\s+from service_role/i);

const mutationStatements = migration.match(/(?:grant|revoke|alter|create|drop)\s+[^;]+;/gi) ?? [];
for (const statement of mutationStatements) {
  assert.doesNotMatch(statement, /communications\.|storage\.|document_scan_(?:attestations|jobs)|(?:claim|complete|fail|get|record)_document_scan/i);
}
assert.doesNotMatch(migration, /alter\s+default\s+privileges|alter\s+role|create\s+role|drop\s+role|on\s+(?:all\s+)?sequences?/i);
assert.match(test, /select plan\(9\);/i);
assert.match(test, /preserves all six scanner security definer rpc grants/i);
assert.match(test, /preserves the exact scanner table boundary/i);

console.log(JSON.stringify({
  contract: 'documents-service-role-acl-cleanup.v1',
  migration_count: migrations.length,
  migration: migrationName,
  pgtap: testName,
  order: `${d7Name} -> ${migrationName} -> ${s1Name}`,
}));
