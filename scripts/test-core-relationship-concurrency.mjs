#!/usr/bin/env node
// Run only against the disposable local Supabase database. Two independent
// reviewer connections race the exact same immutable decision.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const url = process.env.SUPABASE_DB_URL || 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const host = new URL(url).hostname.toLowerCase();
if (!['localhost', '127.0.0.1', 'postgres'].includes(host)) throw new Error('Local test database required');
const fixture = readFileSync(new URL('../supabase/tests/165_lifecycle_relationship_review_gateway.test.sql', import.meta.url), 'utf8');
const between = (start, end, from = 0) => {
  const a = fixture.indexOf(start, from);
  const b = fixture.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Fixture section missing: ${start}`);
  return fixture.slice(a + start.length, b);
};
// Triggers used by this fixture call pgTAP helpers, so retain a plan for setup.
const setup = 'select plan(21);' + between('select plan(21);', 'select throws_ok');
const mandate = 'insert into platform.workspace_property_authorities' + between(
  'insert into platform.workspace_property_authorities', 'select lives_ok');
const reviewerSection = fixture.indexOf('Independent account without reviewer role denied');
const reviewer = 'insert into platform.workspace_roles' + between(
  'insert into platform.workspace_roles', 'select lives_ok', reviewerSection);
const id = n => `16500000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const clients = [];
async function connect() {
  const client = new Client({ connectionString: url, statement_timeout: 15000, connectionTimeoutMillis: 5000 });
  await client.connect();
  clients.push(client);
  return client;
}
async function claims(client, user) {
  await client.query('select set_config($1,$2,false)', ['request.jwt.claims',
    JSON.stringify({ sub: user, role: 'authenticated', aal: 'aal2' })]);
}
async function blocking(observer, pid, blocker) {
  for (let i = 0; i < 80; i++) {
    const result = await observer.query('select pg_blocking_pids($1::int) blockers', [pid]);
    if (result.rows[0].blockers.includes(blocker)) return true;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}
try {
  const a = await connect(), b = await connect(), observer = await connect();
  await a.query(`begin; ${setup} ${mandate} ${reviewer} commit;`);
  await claims(a, id(1));
  const proposed = await a.query(`select customer_api.propose_core_relationship_v1(
   $1,$2,$3,$4,'ownership_transfer',$5,$6,current_date,null,
   'test://race-transfer','Race proposal',$7,'race-proposal-key') result`,
   [id(8),id(6),id(3),id(5),id(13),id(14),id(17)]);
  const proposal = proposed.rows[0].result.proposal_id;
  await claims(a, id(11));
  await claims(b, id(11));
  const [{ pid: firstPid }] = (await a.query('select pg_backend_pid() pid')).rows;
  const [{ pid: secondPid }] = (await b.query('select pg_backend_pid() pid')).rows;
  const reviewSql = `select customer_api.review_core_relationship_v1(
    $1,$2,$3,'verified','test://race-review','Race review',$4,'race-review-key') result`;
  const args = [id(16), id(6), proposal, id(18)];
  await a.query('begin');
  const first = await a.query(reviewSql, args);
  assert.equal(first.rows[0].result.idempotent, false);
  const secondPromise = b.query(reviewSql, args);
  assert.ok(await blocking(observer, secondPid, firstPid), 'Second reviewer must wait on the property row');
  await a.query('commit');
  const second = await secondPromise;
  assert.equal(second.rows[0].result.idempotent, true);
  assert.equal(second.rows[0].result.review_id, first.rows[0].result.review_id);
  const count = await observer.query('select count(*)::int n from portfolio.relationship_reviews where proposal_id=$1', [proposal]);
  assert.equal(count.rows[0].n, 1);
  const title = await observer.query('select count(*)::int n from portfolio.ownerships where unit_id=$1', [id(5)]);
  assert.equal(title.rows[0].n, 0);
  console.log('Core relationship concurrent review: one immutable decision, replayed receipt, no title change');
} catch (error) {
  await Promise.allSettled(clients.map(client => client.query('rollback')));
  throw error;
} finally {
  await Promise.allSettled(clients.map(client => client.end()));
}
