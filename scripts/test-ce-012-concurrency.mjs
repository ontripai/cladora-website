import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const url = process.env.SUPABASE_DB_URL;
if (process.env.CLADORA_EPHEMERAL_DB !== '1' || !url || !['localhost', '127.0.0.1', '[::1]'].includes(new URL(url).hostname)) {
  throw new Error('CE012 concurrency requires CLADORA_EPHEMERAL_DB=1 and an explicit localhost database');
}
const id = n => `17400000-0000-0000-0000-${String(n).padStart(12, '0')}`;
const clients = [];
const proposal = readFileSync(new URL('../supabase/proposals/ce_012_experience_guide_operational_v1.sql', import.meta.url), 'utf8');
assert.equal(readFileSync(new URL('../supabase/tests/fixtures/ce_012_experience_guide_operational_v1.inc', import.meta.url), 'utf8'), proposal, 'pgTAP fixture must match proposal');
const fixture = readFileSync(new URL('../supabase/tests/fixtures/ce_012_core_fixture.inc', import.meta.url), 'utf8');
const steps = n => [{ id: id(n), title: 'Arrival', body: 'Follow approved guidance.', references: [{ target_type: 'document', target_id: id(90), label: 'Approved document' }] }];
const command = (type, n, expected_version, extra = {}) => ({ type, command_id: id(n), idempotency_key: `ce012.race.${n}`,
  context_id: id(40), workspace_id: id(20), guide_id: id(70), expected_version, reason: 'Synthetic CE012 concurrent acceptance', ...extra });
async function connect() {
  const client = new Client({ connectionString: url, statement_timeout: 15000, connectionTimeoutMillis: 5000 });
  await client.connect(); clients.push(client); return client;
}
const claims = (client, n) => client.query('select set_config($1,$2,false)', ['request.jwt.claims', JSON.stringify({ sub: id(n), role: 'authenticated', aal: 'aal2' })]);
const execute = async (client, value) => (await client.query('select customer_api.command_ce_guide_v1($1::jsonb) result', [JSON.stringify(value)])).rows[0].result;
async function blocking(observer, pid, blocker) {
  for (let attempt = 0; attempt < 80; attempt++) {
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
  const create = command('create_guide', 80, 0, { title: 'Concurrent guide', audience: { kind: 'workspace' }, steps: steps(71) });

  await a.query('begin'); await b.query('begin');
  assert.equal((await execute(a, create)).replayed, false);
  const replayPending = capture(execute(b, create));
  assert.ok(await blocking(observer, pidB, pidA), 'Same key must block on shared idempotency');
  await a.query('commit');
  const replay = await replayPending;
  assert.equal(replay.error, undefined); assert.equal(replay.result.replayed, true);
  await b.query('commit');
  const counts = await observer.query(`select
    (select count(*)::int from experience.guides) guides,
    (select count(*)::int from experience.guide_steps) steps,
    (select count(*)::int from experience.guide_references) refs,
    (select count(*)::int from experience.guide_command_receipts) receipts,
    (select count(*)::int from audit.events where tenant_id=$1) audits,
    (select count(*)::int from platform.outbox_events where tenant_id=$1) outbox`, [id(1)]);
  assert.deepEqual(counts.rows[0], { guides: 1, steps: 1, refs: 1, receipts: 1, audits: 1, outbox: 1 });
  console.log('CE012 same-key concurrency: exactly one Guide, step set, receipt, audit and outbox');

  const reviseA = command('revise_guide', 81, 1, { title: 'Revision A', audience: { kind: 'workspace' }, steps: steps(72) });
  const reviseB = command('revise_guide', 82, 1, { title: 'Revision B', audience: { kind: 'workspace' }, steps: steps(73) });
  await a.query('begin'); await b.query('begin');
  assert.equal((await execute(a, reviseA)).version, 2);
  const competing = capture(execute(b, reviseB));
  assert.ok(await blocking(observer, pidB, pidA), 'Competing revisions must serialize on Guide');
  await a.query('commit');
  assert.equal((await competing).error?.code, '40001'); await b.query('rollback');
  const guide = (await observer.query('select title,version::int from experience.guides where id=$1', [id(70)])).rows[0];
  assert.deepEqual(guide, { title: 'Revision A', version: 2 });
  assert.equal((await observer.query('select count(*)::int n from experience.guide_steps')).rows[0].n, 1);
  console.log('CE012 revision race: one exact-version revision and one atomic step set');

  const publish = command('publish_guide', 83, 2);
  await a.query('begin'); await b.query('begin');
  await a.query('select id from experience.guides where id=$1 for update', [id(70)]);
  const publishPending = capture(execute(b, publish));
  assert.ok(await blocking(observer, pidB, pidA), 'Publish must wait on Guide aggregate');
  await observer.query("update documents.documents set status='archived' where id=$1", [id(90)]);
  await a.query('commit');
  assert.equal((await publishPending).error?.code, '42501'); await b.query('rollback');
  await observer.query("update documents.documents set status='active' where id=$1", [id(90)]);
  assert.equal((await observer.query('select version::int from experience.guides where id=$1', [id(70)])).rows[0].version, 2);
  console.log('CE012 publish-after-wait: newly unavailable document reference denied');

  await a.query('begin'); await b.query('begin');
  await a.query('select key from platform.idempotency_keys where tenant_id=$1 and key=$2 for update',
    [id(1), `ce.guide.create_guide.v1/${id(20)}/${id(80)}/ce012.race.80`]);
  const revokedPending = capture(execute(b, create));
  assert.ok(await blocking(observer, pidB, pidA), 'Replay waits on canonical shared key');
  await observer.query("update identity.memberships set status='suspended' where id=$1", [id(30)]);
  await a.query('commit');
  assert.equal((await revokedPending).error?.code, '42501'); await b.query('rollback');
  console.log('CE012 replay-after-wait: newly suspended membership denied');
} finally {
  await Promise.allSettled(clients.map(client => client.query('rollback')));
  await Promise.allSettled(clients.map(client => client.end()));
}
