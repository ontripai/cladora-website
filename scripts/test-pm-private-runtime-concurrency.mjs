#!/usr/bin/env node

import assert from 'node:assert/strict';
import { Client } from 'pg';

const databaseUrl = process.env.SUPABASE_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const ids = {
  auth: '17300000-0000-4000-8000-000000000001',
  actor: '17300000-0000-4000-8000-000000000101',
  reviewerAuth: '17300000-0000-4000-8000-000000000002',
  reviewer: '17300000-0000-4000-8000-000000000102',
  program: '17300000-0000-4000-8000-000000000201',
  baseline: '17300000-0000-4000-8000-000000000202',
  workstream: '17300000-0000-4000-8000-000000000203',
  requestRegister: '17300000-0000-4000-8000-000000000301',
  requestTransitionA: '17300000-0000-4000-8000-000000000302',
  requestTransitionB: '17300000-0000-4000-8000-000000000303',
  requestStart: '17300000-0000-4000-8000-000000000304',
  requestReview: '17300000-0000-4000-8000-000000000305',
  requestAcceptanceA: '17300000-0000-4000-8000-000000000306',
  requestAcceptanceB: '17300000-0000-4000-8000-000000000307',
  evidence: '17300000-0000-4000-8000-000000000401',
  testRun: '17300000-0000-4000-8000-000000000402',
};

function assertLocalTarget(raw) {
  const parsed = new URL(raw);
  if (!['127.0.0.1', 'localhost', 'postgres'].includes(parsed.hostname.toLowerCase())) {
    throw new Error(`CRITICAL SECURITY REFUSAL: PM concurrency test requires a local database, got ${parsed.hostname}`);
  }
}

async function connect() {
  assertLocalTarget(databaseUrl);
  const client = new Client({ connectionString: databaseUrl, statement_timeout: 15_000, connectionTimeoutMillis: 5_000 });
  await client.connect();
  await client.query(`set statement_timeout='15000'`);
  await client.query(`set lock_timeout='10000'`);
  return client;
}

async function setActor(client, authId = ids.auth) {
  await client.query(`select set_config('request.jwt.claims',$1,false)`, [
    JSON.stringify({ sub: authId, role: 'authenticated', aal: 'aal2' }),
  ]);
}

async function pid(client) {
  return Number((await client.query('select pg_backend_pid() as pid')).rows[0].pid);
}

async function waitForBlock(observer, blockedPid, blockerPid) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const rows = await observer.query('select unnest(pg_blocking_pids($1::int))::int as pid', [blockedPid]);
    if (rows.rows.some((row) => Number(row.pid) === blockerPid)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Expected pid ${blockedPid} to be blocked by pid ${blockerPid}`);
}

async function cleanup(client) {
  await client.query('begin');
  await client.query(`set local session_replication_role='replica'`);
  await client.query(`delete from audit.events where request_id = any($1::uuid[])`, [[
    ids.requestRegister, ids.requestTransitionA, ids.requestTransitionB, ids.requestStart,
    ids.requestReview, ids.requestAcceptanceA, ids.requestAcceptanceB,
  ]]);
  await client.query(`delete from pm_private.outbox_events where program_id=$1`, [ids.program]);
  await client.query(`delete from pm_private.command_receipts where program_id=$1`, [ids.program]);
  await client.query(`delete from pm_private.transitions where program_id=$1`, [ids.program]);
  await client.query(`delete from pm_private.acceptance_decisions where program_id=$1`, [ids.program]);
  await client.query(`delete from pm_private.test_runs where program_id=$1`, [ids.program]);
  await client.query(`delete from pm_private.evidence_references where program_id=$1`, [ids.program]);
  await client.query(`delete from pm_private.assignments where program_id=$1`, [ids.program]);
  await client.query(`update pm_private.work_packages set current_cycle_id=null where program_id=$1`, [ids.program]);
  await client.query(`delete from pm_private.execution_cycles where program_id=$1`, [ids.program]);
  await client.query(`delete from pm_private.work_packages where program_id=$1`, [ids.program]);
  await client.query(`delete from pm_private.workstreams where program_id=$1`, [ids.program]);
  await client.query(`delete from pm_private.baselines where program_id=$1`, [ids.program]);
  await client.query(`delete from pm_private.programs where id=$1`, [ids.program]);
  await client.query(`delete from platform.platform_role_assignments where platform_user_id in ($1,$2)`, [ids.actor, ids.reviewer]);
  await client.query(`delete from platform.platform_users where id in ($1,$2)`, [ids.actor, ids.reviewer]);
  await client.query(`delete from auth.users where id in ($1,$2)`, [ids.auth, ids.reviewerAuth]);
  await client.query('commit');
}

const clients = [];
try {
  const setup = await connect();
  const first = await connect();
  const second = await connect();
  const observer = await connect();
  clients.push(setup, first, second, observer);
  const firstPid = await pid(first);
  const secondPid = await pid(second);
  await cleanup(setup).catch(async () => { try { await setup.query('rollback'); } catch {} });
  await setup.query('begin');
  await setup.query(`insert into auth.users(id,email) values
    ($1,'pm-concurrency-173@cladora.test'),($2,'pm-concurrency-reviewer-173@cladora.test')`, [ids.auth, ids.reviewerAuth]);
  await setup.query(`insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status)
    values($1,$2,'PM-173-ACTOR','PM Concurrency Actor','active'),
      ($3,$4,'PM-173-REVIEWER','PM Concurrency Reviewer','active')`, [ids.actor, ids.auth, ids.reviewer, ids.reviewerAuth]);
  await setup.query(`insert into platform.platform_role_assignments(platform_user_id,role,status,grant_reason)
    values($1,'PLATFORM_OPERATIONS','active','PM concurrency fixture'),
      ($2,'PLATFORM_AUDITOR','active','PM acceptance concurrency fixture')`, [ids.actor, ids.reviewer]);
  await setup.query(`insert into pm_private.programs(id,code,repository_provider,repository_id,repository_owner,repository_name)
    values($1,'CLADORA173','github','repo-173','ontripai','cladora-website')`, [ids.program]);
  await setup.query(`insert into pm_private.baselines(id,program_id,version_label,controlling_commit,status,effective_at)
    values($1,$2,'1.4',$3,'current',statement_timestamp())`, [ids.baseline, ids.program, 'c'.repeat(40)]);
  await setup.query(`insert into pm_private.workstreams(id,program_id,code,owner_label,scope)
    values($1,$2,'CORE173','Core Platform','Concurrency fixture')`, [ids.workstream, ids.program]);
  await setup.query(`insert into pm_private.assignments(program_id,platform_user_id,workstream_id,permission,effect,reason)
    values($1,$2,$3,'pm.package.manage','allow','Concurrency command authority'),
      ($1,$2,$3,'pm.evidence.attach','allow','Concurrency evidence authority'),
      ($1,$4,$3,'pm.review.decide','allow','Independent acceptance race authority')`,
    [ids.program, ids.actor, ids.workstream, ids.reviewer]);
  await setup.query('commit');
  await Promise.all([setActor(first), setActor(second)]);

  const registerCommand = {
    program_id: ids.program,
    baseline_id: ids.baseline,
    workstream_id: ids.workstream,
    package_key: 'PM01-RUNTIME-173',
    title: 'PM registration race',
    bounded_scope: 'Synthetic isolated registration race',
    expected_version: 0,
    request_id: ids.requestRegister,
    idempotency_key: 'pm-runtime-173-register',
  };
  await first.query('begin');
  const winner = await first.query('select pm_private.register_package_internal_v1($1::jsonb) as value', [registerCommand]);
  await second.query('begin');
  let replaySettled = false;
  const replayPromise = second.query('select pm_private.register_package_internal_v1($1::jsonb) as value', [registerCommand])
    .then((result) => { replaySettled = true; return result; });
  await waitForBlock(observer, secondPid, firstPid);
  assert.equal(replaySettled, false, 'Replay must wait on the actor-bound advisory lock');
  await first.query('commit');
  const replay = await replayPromise;
  await second.query('commit');
  assert.equal(winner.rows[0].value.idempotent, false);
  assert.equal(replay.rows[0].value.idempotent, true);
  assert.equal(winner.rows[0].value.package_id, replay.rows[0].value.package_id);
  const registrationCounts = await observer.query(`select
    (select count(*)::int from pm_private.work_packages where program_id=$1) packages,
    (select count(*)::int from pm_private.command_receipts where program_id=$1 and namespace='pm.package.register') receipts,
    (select count(*)::int from pm_private.outbox_events where program_id=$1 and event_type='pm.package.registered') events`, [ids.program]);
  assert.deepEqual(registrationCounts.rows[0], { packages: 1, receipts: 1, events: 1 });

  const cycleId = winner.rows[0].value.cycle_id;
  const transitionA = { program_id: ids.program, cycle_id: cycleId, expected_version: 1, target_state: 'ready',
    reason: 'Concurrency winner', request_id: ids.requestTransitionA, idempotency_key: 'pm-runtime-173-transition-a' };
  const transitionB = { program_id: ids.program, cycle_id: cycleId, expected_version: 1, target_state: 'blocked',
    reason: 'Concurrency loser', request_id: ids.requestTransitionB, idempotency_key: 'pm-runtime-173-transition-b' };
  await first.query('begin');
  const firstTransition = await first.query('select pm_private.transition_cycle_internal_v1($1::jsonb) as value', [transitionA]);
  await second.query('begin');
  let loserError;
  const loserPromise = second.query('select pm_private.transition_cycle_internal_v1($1::jsonb) as value', [transitionB])
    .catch((error) => { loserError = error; });
  await waitForBlock(observer, secondPid, firstPid);
  await first.query('commit');
  await loserPromise;
  await second.query('rollback');
  assert.equal(firstTransition.rows[0].value.state, 'ready');
  assert.equal(loserError?.code, '40001');
  assert.match(loserError?.message ?? '', /pm_concurrency_conflict/);
  const finalCycle = await observer.query('select state::text,version from pm_private.execution_cycles where id=$1', [cycleId]);
  assert.deepEqual(finalCycle.rows[0], { state: 'ready', version: 2 });

  const startCommand = { program_id: ids.program, cycle_id: cycleId, expected_version: 2, target_state: 'in_progress',
    reason: 'Prepare acceptance race', request_id: ids.requestStart, idempotency_key: 'pm-runtime-173-start' };
  const reviewCommand = { program_id: ids.program, cycle_id: cycleId, expected_version: 3, target_state: 'in_review',
    delivery_commit_sha: 'd'.repeat(40), required_checks: ['authorization'], reason: 'Bind exact delivery for review',
    request_id: ids.requestReview, idempotency_key: 'pm-runtime-173-review' };
  await first.query('select pm_private.transition_cycle_internal_v1($1::jsonb)', [startCommand]);
  await first.query('select pm_private.transition_cycle_internal_v1($1::jsonb)', [reviewCommand]);
  await setup.query(`insert into pm_private.evidence_references(
      id,program_id,cycle_id,commit_sha,evidence_type,provider,provider_reference,result,attached_by
    ) values($1,$2,$3,$4,'ci_run','github','github:run:173:acceptance','passed',$5)`,
    [ids.evidence, ids.program, cycleId, 'd'.repeat(40), ids.actor]);
  await setup.query(`insert into pm_private.test_runs(
      id,program_id,cycle_id,evidence_id,commit_sha,provider,check_name,provider_run_id,status,recorded_by
    ) values($1,$2,$3,$4,$5,'github','authorization','run:173:acceptance','passed',$6)`,
    [ids.testRun, ids.program, cycleId, ids.evidence, 'd'.repeat(40), ids.actor]);

  await Promise.all([setActor(first, ids.reviewerAuth), setActor(second, ids.reviewerAuth)]);
  const acceptanceA = { program_id: ids.program, cycle_id: cycleId, expected_version: 4, commit_sha: 'd'.repeat(40),
    decision: 'accepted', criteria_snapshot: { authorization: 'passed' }, reason: 'Acceptance race winner',
    request_id: ids.requestAcceptanceA, idempotency_key: 'pm-runtime-173-accept-a' };
  const acceptanceB = { ...acceptanceA, reason: 'Acceptance race loser', request_id: ids.requestAcceptanceB,
    idempotency_key: 'pm-runtime-173-accept-b' };
  await first.query('begin');
  const accepted = await first.query('select pm_private.record_acceptance_internal_v1($1::jsonb) as value', [acceptanceA]);
  await second.query('begin');
  let acceptanceLoserError;
  const acceptanceLoser = second.query('select pm_private.record_acceptance_internal_v1($1::jsonb) as value', [acceptanceB])
    .catch((error) => { acceptanceLoserError = error; });
  await waitForBlock(observer, secondPid, firstPid);
  await first.query('commit');
  await acceptanceLoser;
  await second.query('rollback');
  assert.equal(accepted.rows[0].value.state, 'accepted');
  assert.equal(acceptanceLoserError?.code, '40001');
  assert.match(acceptanceLoserError?.message ?? '', /pm_concurrency_conflict/);
  const acceptanceCounts = await observer.query(`select
    (select state::text from pm_private.execution_cycles where id=$1) state,
    (select version from pm_private.execution_cycles where id=$1) version,
    (select count(*)::int from pm_private.acceptance_decisions where cycle_id=$1) decisions,
    (select count(*)::int from pm_private.transitions where cycle_id=$1 and to_state='accepted') transitions,
    (select count(*)::int from pm_private.command_receipts where request_id in ($2,$3)) receipts,
    (select count(*)::int from pm_private.outbox_events where payload->>'request_id' in ($2::text,$3::text)) events`,
    [cycleId, ids.requestAcceptanceA, ids.requestAcceptanceB]);
  assert.deepEqual(acceptanceCounts.rows[0], {
    state: 'accepted', version: 5, decisions: 1, transitions: 1, receipts: 1, events: 1,
  });
  console.log('PM private runtime concurrency passed: registration replay, transition race, and atomic acceptance race each have one durable winner.');
  await cleanup(setup);
} finally {
  await Promise.allSettled(clients.map((client) => client.end()));
}
