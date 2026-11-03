import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';

const migrationName = '20261018151500_documents_service_role_acl_cleanup_v1.sql';
const testName = '194_documents_service_role_acl_cleanup.test.sql';
const d7Name = '20261018150000_documents_retention_lifecycle_workspace_gate_v2.sql';
const s1Name = '20261018153000_communications_private_message_currentness_gate_v2.sql';
const migrations = readdirSync('supabase/migrations').filter(name => name.endsWith('.sql')).sort();
const migration = readFileSync(`supabase/migrations/${migrationName}`, 'utf8');
const test = readFileSync(`supabase/tests/${testName}`, 'utf8');

// Preserve the historical 296-file inventory and account only for the four
// byte-exact additions accepted by B01/SERVICE297. This is not installed ACL proof.
const reviewedAdditions = {
 '20261022071629_service_quote_request_version_binding_v2.sql':'472f74027b5ccd250432cb1ff16879461f74633808a386498883cfc28dd3d324',
 '20261022071709_ce_notice_ack_read_shape_v1.sql':'76beec0cd96f9dc1c72cd884c073a4c1a58f828a9ead65ab05378f032d2d96e5',
 '20261022082451_core_notice_ack_receipt_replay_v1.sql':'368a8cbfefaa5292eed640789fd811411d2996eee1220cd532cc9efa8026c679',
 '20261025214155_building_setup_command_receipts_v1.sql':'254e17c9e5f21ce4e50786d3325c2cc84759097b16cb53028602d1e8db5e02e3',
};
for (const [name, hash] of Object.entries(reviewedAdditions)) {
 assert.ok(migrations.includes(name), `missing reviewed addition ${name}`);
 assert.equal(createHash('sha256').update(readFileSync(`supabase/migrations/${name}`)).digest('hex'), hash, name);
}
assert.equal(migrations.filter(name => !Object.hasOwn(reviewedAdditions, name)).length, 296);
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
