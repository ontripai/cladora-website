import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

// This runner installs synthetic fixture grants in a disposable local DB only.
// No linked Supabase project, remote host or Production fallback is accepted.
const url = process.env.SUPABASE_DB_URL;
if (process.env.CLADORA_EPHEMERAL_DB !== '1' || !url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('CE010 concurrency requires CLADORA_EPHEMERAL_DB=1 and an explicit localhost database');
}
const id = n => `17300000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const clients = [];
const proposal = readFileSync(new URL('../supabase/proposals/ce_010_community_operational_v1.sql', import.meta.url), 'utf8');
assert.equal(readFileSync(new URL('../supabase/tests/fixtures/ce_010_community_operational_v1.inc', import.meta.url), 'utf8'), proposal, 'pgTAP fixture must match the proposal');
const fixture = readFileSync(new URL('../supabase/tests/fixtures/ce_010_core_fixture.inc', import.meta.url), 'utf8');
const command = (type, n, expected_version, extra = {}) => ({ type, command_id: id(n), idempotency_key: `ce010.race.${n}`,
  context_id: id(40), workspace_id: id(20), community_id: id(70), expected_version, reason: 'Synthetic CE010 concurrent acceptance', ...extra });
async function connect() {
  const client = new Client({ connectionString: url, statement_timeout: 15000, connectionTimeoutMillis: 5000 });
  await client.connect(); clients.push(client); return client;
}
const claims = (c, n) => c.query('select set_config($1,$2,false)', ['request.jwt.claims', JSON.stringify({ sub: id(n), role: 'authenticated', aal: 'aal2' })]);
const execute = async (c, cmd) => (await c.query('select customer_api.command_ce_community_v1($1::jsonb) result', [JSON.stringify(cmd)])).rows[0].result;
async function blocking(observer, pid, blocker) {
  for (let i = 0; i < 80; i++) {
    const { rows } = await observer.query('select pg_blocking_pids($1::int) blockers', [pid]);
    if (rows[0].blockers.includes(blocker)) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}
const capture = promise => promise.then(result => ({ result }), error => ({ error }));
try {
  const a = await connect(), b = await connect(), observer = await connect();
  await a.query(proposal);
  await a.query(`begin; ${fixture} commit;`);
  await claims(a, 10); await claims(b, 10);
  const pidA = (await a.query('select pg_backend_pid() pid')).rows[0].pid;
  const pidB = (await b.query('select pg_backend_pid() pid')).rows[0].pid;
  const create = command('create_community', 80, 0, { name: 'Concurrent community', audience: { kind: 'workspace' } });
  await a.query('begin'); await b.query('begin');
  assert.equal((await execute(a, create)).replayed, false);
  const replayPending = capture(execute(b, create));
  assert.ok(await blocking(observer, pidB, pidA), 'Same key must block on the shared idempotency row');
  await a.query('commit');
  const replay = await replayPending;
  assert.equal(replay.error, undefined); assert.equal(replay.result.replayed, true);
  await b.query('commit');
  const counts = await observer.query(`select
    (select count(*)::int from community.communities) communities,
    (select count(*)::int from community.community_command_receipts) receipts,
    (select count(*)::int from audit.events where tenant_id=$1) audits,
    (select count(*)::int from platform.outbox_events where tenant_id=$1) outbox`, [id(1)]);
  assert.deepEqual(counts.rows[0], { communities: 1, receipts: 1, audits: 1, outbox: 1 });
  console.log('CE010 same-key concurrency: exactly one Community, receipt, audit and outbox');

  await execute(a, command('create_announcement', 81, 1, { announcement_id: id(71), body: 'Concurrent announcement', audience: { kind: 'workspace' } }));
  await execute(a, command('publish_announcement', 82, 1, { announcement_id: id(71) }));
  await claims(a, 11); await claims(b, 11);
  const report = command('report_content', 83, 0, { context_id: id(41), report_id: id(72), target_type: 'announcement', target_id: id(71), report_reason: 'Concurrent content report' });
  const duplicate = { ...report, command_id: id(84), idempotency_key: 'ce010.race.84', report_id: id(73) };
  await a.query('begin'); await b.query('begin');
  await execute(a, report);
  const duplicatePending = capture(execute(b, duplicate));
  assert.ok(await blocking(observer, pidB, pidA), 'Different-key reports must serialize on the Community');
  await a.query('commit');
  assert.equal((await duplicatePending).error?.code, '23505'); await b.query('rollback');
  assert.equal((await observer.query('select count(*)::int n from community.content_reports')).rows[0].n, 1);
  assert.equal((await observer.query('select count(*)::int n from platform.idempotency_keys where tenant_id=$1 and key like $2', [id(1), `%/${id(84)}/%`])).rows[0].n, 0);
  console.log('CE010 duplicate-report race: one active report; losing shared key rolled back');

  await claims(a, 10); await claims(b, 10);
  const decision = command('decide_content_report', 85, 1, { report_id: id(72), decision: 'dismissed', decision_reason: 'Concurrent moderator decision' });
  await a.query('begin'); await b.query('begin');
  await execute(a, decision);
  const decisionPending = capture(execute(b, { ...decision, command_id: id(86), idempotency_key: 'ce010.race.86', decision: 'action_required' }));
  assert.ok(await blocking(observer, pidB, pidA), 'Competing decisions must serialize');
  await a.query('commit');
  assert.equal((await decisionPending).error?.code, '40001'); await b.query('rollback');
  const row = (await observer.query('select status,version::int from community.content_reports where id=$1', [id(72)])).rows[0];
  assert.deepEqual(row, { status: 'dismissed', version: 2 });
  assert.equal((await observer.query("select count(*)::int n from audit.events where tenant_id=$1 and action='ce.decide_content_report'", [id(1)])).rows[0].n, 1);
  console.log('CE010 decision race: one versioned decision and shared audit; stale competitor rejected');

  // Prove authority is re-evaluated after waiting, rather than trusting the entry snapshot.
  await a.query('begin'); await b.query('begin'); await claims(b, 11);
  await a.query('select key from platform.idempotency_keys where tenant_id=$1 and key=$2 for update',
    [id(1), `ce.community.report_content.v1/${id(20)}/${id(83)}/ce010.race.83`]);
  const revokedPending = capture(execute(b, report));
  assert.ok(await blocking(observer, pidB, pidA), 'Replay waits on canonical shared key');
  await observer.query("update identity.memberships set status='suspended' where id=$1", [id(31)]);
  await a.query('commit');
  assert.equal((await revokedPending).error?.code, '42501'); await b.query('rollback');
  console.log('CE010 replay-after-wait: newly suspended membership denied');
} finally {
  await Promise.allSettled(clients.map(c => c.query('rollback')));
  await Promise.allSettled(clients.map(c => c.end()));
}
