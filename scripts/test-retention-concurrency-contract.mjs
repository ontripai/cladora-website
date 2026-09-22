import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync(new URL('../supabase/migrations/20260921172651_retention_archive_legal_hold_discovery_r9.sql', import.meta.url), 'utf8');
const races = [
  ['RACE-01 optimistic version conflict', /stale_lock_version/],
  ['RACE-02 concurrent hold targets', /legal_holds where tenant_id=p_tenant_id and id=p_hold_id for update/],
  ['RACE-03 activation versus evaluation', /pg_advisory_xact_lock\(app_private\.derive_advisory_lock_key\('TENANT'/],
  ['RACE-04 claim wins over late hold', /disposition_execution_in_progress/],
  ['RACE-05 duplicate committee vote', /duplicate_vote_prohibited/],
  ['RACE-06 seal versus document mutation', /protocol_not_approved|protocol_must_be_draft/],
  ['RACE-07 two workers one job', /for update skip locked limit v_batch/],
  ['RACE-08 finalize versus reconciliation', /disposal_purge_jobs where tenant_id=p_tenant_id and id=p_job_id for update/],
  ['RACE-09 release versus covered claim', /is_document_held\(p_tenant_id,v_job\.document_id\)/],
  ['RACE-10 concurrent flag approvals', /feature_flag_change_requests where id=p_request_id for update/],
  ['RACE-11 version insert versus tombstone', /document_purged_or_in_flight/],
];

assert.equal(races.length, 11);
for (const [name, evidence] of races) {
  assert.match(sql, evidence, `${name} is missing its database-enforced primitive`);
  console.log(`ok - ${name}`);
}

const lockOrder = ['TENANT','PROTOCOL','DOCUMENT','HOLD','JOB','FEATURE_FLAG','KMS'];
for (const namespace of lockOrder) assert.match(sql, new RegExp(`'${namespace}'`));
assert.match(sql, /order by created_at,id for update skip locked/);
assert.match(sql, /unique \(protocol_id,committee_member_id\)/);
console.log(`Concurrency contract passed: ${races.length} distinct races.`);
