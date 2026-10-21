import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';
import {
  assertPf01LocalExecutionInputs, assertPf01NoDotenv, createPf01Aal2User,
  localProjectRef, pf01FreeLoopbackPort, startPf01BrowserNextApp, verifyPf01LocalTarget,
} from './pf01-owner-portfolio-local-fixture.mjs';

const exec = promisify(execFile);
export const id = n => `c2110000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const required = name => {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_required`);
  return value;
};
const options = { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } };
const root = new URL('../../', import.meta.url);
const localDockerEnv = () => {
  const env = { ...process.env, DOCKER_HOST: 'unix:///var/run/docker.sock' };
  for (const key of ['DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key];
  return env;
};
async function docker(args) {
  const { stdout } = await exec('docker', ['--host=unix:///var/run/docker.sock', ...args],
    { env: localDockerEnv(), timeout: 30_000, maxBuffer: 1024 * 1024 });
  return stdout.trim().split('\n').filter(Boolean);
}
async function fingerprint(project) {
  const containers = await docker(['ps', '-a', '--format', '{{.ID}} {{.Names}}']);
  const owned = containers.filter(row => row.split(' ')[1]?.endsWith(`_${project}`)).sort();
  assert.ok(owned.length > 0 && owned.some(row => row.endsWith(`supabase_db_${project}`)), 'owned official stack must exist');
  for (const row of owned) {
    assert.ok(row.split(' ')[1].startsWith('supabase_'), 'unknown container ownership');
    assert.deepEqual(await docker(['inspect', '--format', '{{index .Config.Labels "com.supabase.cli.project"}}', row.split(' ')[0]]),
      [project], 'official project label must match before destructive opt-in is accepted');
  }
  const volumes = await docker(['volume', 'ls', '--filter', `label=com.supabase.cli.project=${project}`, '--format', '{{.Name}}']);
  const networks = await docker(['network', 'ls', '--filter', `label=com.supabase.cli.project=${project}`, '--format', '{{.ID}}']);
  return { owned, volumes, networks, unrelated: containers.filter(row => !owned.includes(row)),
    hash: createHash('sha256').update(JSON.stringify({ owned, volumes, networks })).digest('hex') };
}
async function financialState(pool) {
  const { rows } = await pool.query(`select
    (select count(*)::int from payments.payments) as payments,
    (select count(*)::int from payments.settlements) as settlements,
    (select count(*)::int from payments.webhook_receipts) as webhooks,
    (select count(*)::int from finance.journals) as journals,
    (select coalesce(sum(paid_amount),0)::text from billing.receivables) as paid,
    (select count(*)::int from public.owner_private_units) as private_units,
    (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from payments.payments t) as payment_hash,
    (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from payments.settlements t) as settlement_hash,
    (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from payments.webhook_receipts t) as webhook_hash,
    (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from finance.journals t) as journal_hash,
    (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from billing.receivables t) as receivable_hash,
    (select md5(coalesce(jsonb_agg(to_jsonb(t) order by id),'[]'::jsonb)::text) from public.owner_private_units t) as private_hash`);
  return rows[0];
}

// No startup, grants, invented permissions or remote fallback. The caller must
// already hold the exclusive registered lease and own the entire disposable
// official stack. Explicit destruction opt-in is required BEFORE any writes.
export async function runConnected() {
  for (const key of ['CORE_MOBILE_PAYMENT_LOCAL_OPT_IN', 'CORE_MOBILE_PAYMENT_REAL_AUTH_OPT_IN',
    'CORE_MOBILE_PAYMENT_DESTROY_OWNED_STACK']) assert.equal(required(key), '1', key);
  assert.match(required('CORE_MOBILE_PAYMENT_LEASE_URL'), /^https:\/\/github\.com\/ontripai\/cladora-website\/issues\/463#issuecomment-\d+$/);
  const supabaseUrl = required('CORE_MOBILE_PAYMENT_LOCAL_SUPABASE_URL');
  const databaseUrl = required('CORE_MOBILE_PAYMENT_LOCAL_DATABASE_URL');
  const anonKey = required('CORE_MOBILE_PAYMENT_LOCAL_ANON_KEY');
  const serviceRoleKey = required('CORE_MOBILE_PAYMENT_LOCAL_SERVICE_ROLE_KEY');
  const projectRef = await localProjectRef();
  const port = await pf01FreeLoopbackPort();
  const appOrigin = `http://127.0.0.1:${port}`;
  const inputs = { target: 'local', ephemeralOptIn: '1', realAuthOptIn: '1',
    appOrigin, supabaseUrl, databaseUrl, projectRef, anonKey, serviceRoleKey };
  // Reject all remote/malformed identities before any DB/Auth client is used.
  assertPf01LocalExecutionInputs(inputs);
  await assertPf01NoDotenv();
  const pool = new Pool({ connectionString: databaseUrl, max: 12, connectionTimeoutMillis: 5000,
    statement_timeout: 30_000, query_timeout: 35_000 });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, options);
  const actorClient = createClient(supabaseUrl, anonKey, options);
  const users = [];
  const actors = [];
  let owned, app, phase = 'target-verification', failure;
  const cleanupErrors = [];
  const abort = new AbortController();
  const cancel = () => abort.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  const pass = name => console.log(JSON.stringify({ check: name, result: 'PASS', provenance: 'real local Next/Auth/PostgreSQL' }));
  try {
    await verifyPf01LocalTarget({ ...inputs, pool, adminClient, actorClient });
    const resources = await fingerprint(projectRef);
    // A lease/CLI project label alone cannot establish ownership of existing
    // data. Accept only a fresh stack before claiming destructive teardown.
    // Nonempty Auth or a colliding fixture is preserved, never reset/deleted.
    const fresh = await pool.query(`select
      (select count(*)::int from auth.users) as users,
      exists(select 1 from platform.tenants where id=any($1::uuid[])) as collision`, [[id(10), id(20)]]);
    assert.equal(fresh.rows[0].users, 0, 'existing Auth data: cannot claim fresh owned stack');
    assert.equal(fresh.rows[0].collision, false, 'existing fixture: preserve stack');
    owned = resources;
    console.log(JSON.stringify({ owned_resource_fingerprint: owned.hash,
      expected_writes: ['isolated fixture rows from test 211', 'ephemeral Auth users/MFA/sessions',
        'payment intents via canonical RPC', 'isolated Context/membership/entitlement negative controls',
        'existing audit/revision trigger effects derived from these isolated rows'],
      forbidden_financial_effects: ['payments', 'settlements', 'webhooks', 'journals', 'receivable paid amounts'] }));
    phase = 'auth-fixture';
    for (let i = 1; i <= 3; i++) {
      if (abort.signal.aborted) throw new Error('cancelled');
      const user = await createPf01Aal2User({ adminClient, supabaseUrl, anonKey,
        label: `core-mobile-${i}`, onCreated: user => users.push(user) });
      actors.push(user);
    }
    phase = 'canonical-fixture';
    const sql = await readFile(new URL('../../supabase/tests/211_core_mobile_payment_authority_v1_test.sql', import.meta.url), 'utf8');
    const start = sql.indexOf('-- CORE_MOBILE_FIXTURE_BEGIN');
    const end = sql.indexOf('-- CORE_MOBILE_FIXTURE_END');
    assert.ok(start >= 0 && end > start, 'fixture boundaries');
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('create temp table core_mobile_users(slot integer primary key,user_id uuid not null)');
      for (let i = 0; i < actors.length; i++) await client.query('insert into core_mobile_users values($1,$2)', [i + 1, actors[i].userId]);
      await client.query(sql.slice(start, end));
      await client.query('commit');
    } catch (error) { await client.query('rollback'); throw error; }
    finally { client.release(); }
    const before = await financialState(pool);
    phase = 'next-start';
    app = await startPf01BrowserNextApp({ port, supabaseUrl, anonKey, signal: abort.signal });
    const base = `${app.origin}/api/customer/v1/payments/intents`;
    const body = { context_id: id(101), unit_id: id(51), amount: 10, currency: 'RON',
      payment_method: 'bank_transfer', provider_code: 'unconfigured',
      selected_invoices: [{ invoice_id: id(71), amount: 10 }], idempotency_key: 'core-mobile-http-exact-211' };
    async function request(method, url, actor, payload, timeout = 60_000) {
      const response = await fetch(url, { method, redirect: 'manual',
        headers: { origin: app.origin, ...(actor ? { cookie: actor.cookie } : {}),
          ...(payload ? { 'content-type': 'application/json' } : {}) },
        ...(payload ? { body: JSON.stringify(payload) } : {}), signal: AbortSignal.any([abort.signal, AbortSignal.timeout(timeout)]) });
      const data = await response.json();
      assert.match(response.headers.get('cache-control') ?? '', /no-store/);
      return { status: response.status, data };
    }
    const post = (payload = body, actor = actors[0]) => request('POST', base, actor, payload);
    phase = 'anonymous-denial';
    assert.equal((await post(body, null)).status, 401); pass(phase);
    phase = 'exact-replay';
    const first = await post(); assert.equal(first.status, 201);
    const intent = first.data.payment_intent_id; assert.match(intent, /^[\da-f-]{36}$/);
    const replay = await post(); assert.equal(replay.status, 201);
    assert.equal(replay.data.payment_intent_id, intent); assert.equal(replay.data.is_idempotent_replay, true); pass(phase);
    const getUrl = (ctx = 101) => `${base}/${intent}?context_id=${id(ctx)}`;
    const instructionUrl = (ctx = 101) => `${base}/${intent}/bank-instruction?context_id=${id(ctx)}`;
    assert.equal((await request('GET', getUrl(), actors[0])).status, 200);
    assert.equal((await request('GET', instructionUrl(), actors[0])).status, 200);
    phase = 'concurrent-first-writes';
    const concurrent = { ...body, idempotency_key: 'core-mobile-concurrent-211' };
    const responses = await Promise.all(Array.from({ length: 8 }, () => post(concurrent)));
    responses.forEach(result => assert.equal(result.status, 201));
    assert.equal(new Set(responses.map(result => result.data.payment_intent_id)).size, 1);
    assert.equal(responses.filter(result => result.data.is_idempotent_replay === false).length, 1);
    const count = key => pool.query('select count(*)::int as n from payments.payment_intents where tenant_id=$1 and idempotency_key=$2', [id(10), key]);
    assert.equal((await count(concurrent.idempotency_key)).rows[0].n, 1); pass(phase);
    phase = 'unknown-timeout-same-key-recovery';
    const unknown = { ...body, idempotency_key: 'core-mobile-timeout-211' };
    const blocker = await pool.connect();
    try {
      await blocker.query('begin');
      await blocker.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`${id(10)}:${unknown.idempotency_key}`]);
      await assert.rejects(request('POST', base, actors[0], unknown, 500), { name: 'TimeoutError' });
    } finally { await blocker.query('rollback'); blocker.release(); }
    // The timed-out write may have committed or been cancelled. Recovery uses
    // exactly the same request/key in either case, never a new payment attempt.
    const recovered = await post(unknown);
    assert.equal(recovered.status, 201);
    assert.equal((await post(unknown)).data.payment_intent_id, recovered.data.payment_intent_id);
    assert.equal((await count(unknown.idempotency_key)).rows[0].n, 1); pass(phase);
    phase = 'expiry-while-waiting-for-key';
    const waiting = { ...body, idempotency_key: 'core-mobile-wait-expiry-211' };
    const held = await pool.connect();
    let pending;
    try {
      await held.query('begin');
      await held.query('select pg_advisory_xact_lock(hashtextextended($1,0))', [`${id(10)}:${waiting.idempotency_key}`]);
      pending = post(waiting);
      // Observe rejection immediately even while inspecting the real waiter.
      pending.catch(() => {});
      // A real waiter must be observed before changing authority. Merely
      // sleeping and assuming the request reached PostgreSQL is not evidence.
      let waiter = false;
      for (let attempt = 0; attempt < 80; attempt++) {
        const { rows } = await pool.query(`select exists(select 1 from pg_stat_activity
          where wait_event='advisory' and query ilike '%create_payment_intent_v1%') as waiting`);
        if (rows[0].waiting) { waiter = true; break; }
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      assert.equal(waiter, true, 'PostgREST must actually wait on the key');
      await pool.query(`update identity.context_grants set ends_at=clock_timestamp()-interval '1 millisecond' where id=$1`, [id(101)]);
      await held.query('rollback');
      assert.equal((await pending).status, 403);
      assert.equal((await count(waiting.idempotency_key)).rows[0].n, 0); pass(phase);
    } finally {
      await held.query('rollback'); held.release();
      if (pending) await pending.catch(() => {});
      await pool.query('update identity.context_grants set ends_at=null where id=$1', [id(101)]);
    }
    for (const [label, change, expected] of [
      ['changed-invoice', { selected_invoices: [{ invoice_id: id(74), amount: 10 }] }, 400],
      ['changed-allocation', { selected_invoices: [{ invoice_id: id(71), amount: 9 }] }, 400],
      ['changed-amount', { amount: 11 }, 400], ['changed-currency', { currency: 'EUR' }, 400],
      ['foreign-unit', { unit_id: id(52) }, 403], ['private-unit-not-official', { unit_id: id(55) }, 403],
    ]) {
      phase = label; const result = await post({ ...body, ...change });
      assert.equal(result.status, expected);
      if (expected === 400) assert.equal(result.data.error.code, 'INVALID_INTENT_REQUEST');
      pass(phase);
    }
    phase = 'changed-method-real-rpc';
    // Exercise the RPC directly for card, so a pre-fix failure can NEVER call a
    // PSP checkout adapter. All real HTTP requests above remain bank-transfer.
    const ownerRpc = createClient(supabaseUrl, anonKey, { ...options,
      global: { headers: { Authorization: `Bearer ${actors[0].accessToken}` } } });
    const methodChange = await ownerRpc.schema('customer_api').rpc('create_payment_intent_v1', {
      p_context_id: body.context_id, p_unit_id: body.unit_id, p_invoices: body.selected_invoices,
      p_amount: body.amount, p_currency: body.currency, p_payment_method: 'card', p_idempotency_key: body.idempotency_key,
    });
    assert.equal(methodChange.error?.code, '23505'); pass(phase);
    phase = 'foreign-authority';
    assert.equal((await post(body, actors[1])).status, 403);
    assert.equal((await post({ ...body, context_id: id(102), unit_id: id(52),
      selected_invoices: [{ invoice_id: id(72), amount: 10 }] }, actors[1])).status, 400);
    assert.equal((await request('GET', getUrl(102), actors[1])).status, 403);
    assert.equal((await request('GET', getUrl(103), actors[2])).status, 404); pass(phase);
    for (const [label, mutate, restore] of [
      ['context-expiry', `update identity.context_grants set ends_at=statement_timestamp()-interval '1 second' where id=$1`, `update identity.context_grants set ends_at=null where id=$1`],
      ['context-future', `update identity.context_grants set starts_at=statement_timestamp()+interval '1 day' where id=$1`, `update identity.context_grants set starts_at=statement_timestamp()-interval '1 day' where id=$1`],
      ['context-revoke', 'delete from identity.context_grants where id=$1',
        `insert into identity.context_grants(id,membership_id,tenant_id,scope_type,unit_id,starts_at) values($1,'${id(91)}','${id(10)}','unit','${id(51)}',statement_timestamp()-interval '1 day')`],
      ['membership-expiry', `update identity.memberships set ends_at=statement_timestamp()-interval '1 second' where id=$1`, `update identity.memberships set ends_at=null where id=$1`],
      ['membership-future', `update identity.memberships set starts_at=statement_timestamp()+interval '1 day' where id=$1`, `update identity.memberships set starts_at=statement_timestamp()-interval '1 day' where id=$1`],
      ['membership-revoke', `update identity.memberships set status='revoked' where id=$1`, `update identity.memberships set status='active' where id=$1`],
      ['missing-permission', `update identity.memberships set role_id=(select id from identity.roles where tenant_id is null and code='multi_unit_owner') where id=$1`,
        `update identity.memberships set role_id=(select id from identity.roles where tenant_id is null and code='owner') where id=$1`],
      ['missing-entitlement', `update platform.workspace_entitlements set boolean_value=false where customer_workspace_id=$1 and entitlement_key='module.payments'`,
        `update platform.workspace_entitlements set boolean_value=true where customer_workspace_id=$1 and entitlement_key='module.payments'`],
    ]) {
      phase = label;
      const target = id(label.startsWith('context') ? 101 : label === 'missing-entitlement' ? 160 : 91);
      await pool.query(mutate, [target]);
      try {
        assert.equal((await post()).status, 403);
        assert.equal((await request('GET', getUrl(), actors[0])).status, 403);
        assert.equal((await request('GET', instructionUrl(), actors[0])).status, 403);
        assert.equal((await count(body.idempotency_key)).rows[0].n, 1); pass(phase);
      } finally { await pool.query(restore, [target]); }
    }
    phase = 'financial-integrity';
    assert.deepEqual(await financialState(pool), before);
    const { rows } = await pool.query('select status,settled_at from payments.payment_intents where tenant_id=$1', [id(10)]);
    assert.ok(rows.every(row => row.status === 'created' && row.settled_at === null)); pass(phase);
  } catch (error) {
    failure = error;
    console.error(JSON.stringify({ suite: 'core-mobile-payment-real-http', result: 'FAIL', phase,
      error: error.code ?? error.name, ...(error instanceof assert.AssertionError ? { expected: error.expected, actual: error.actual } : {}) }));
  } finally {
    if (app) try { await app.close(); } catch { cleanupErrors.push('next_process_cleanup'); }
    for (const user of users.reverse()) try { await user.cleanup(); } catch { cleanupErrors.push('auth_cleanup'); }
    await pool.end().catch(() => cleanupErrors.push('pool_cleanup'));
    if (owned) {
      try {
        // Do not stop an instance replaced by another task since preflight.
        const now = await fingerprint(projectRef);
        assert.deepEqual(now.owned, owned.owned, 'owned container IDs must not change');
        await exec('supabase', ['stop', '--project-id', projectRef, '--no-backup'],
          { cwd: root, env: localDockerEnv(), timeout: 60_000, maxBuffer: 1024 * 1024 });
        const containers = await docker(['ps', '-a', '--format', '{{.ID}} {{.Names}}']);
        assert.ok(owned.owned.every(row => !containers.includes(row)));
        assert.ok(owned.unrelated.every(row => containers.includes(row)), 'unrelated containers preserved');
        assert.deepEqual(await docker(['volume', 'ls', '--filter', `label=com.supabase.cli.project=${projectRef}`, '--format', '{{.Name}}']), []);
        assert.deepEqual(await docker(['network', 'ls', '--filter', `label=com.supabase.cli.project=${projectRef}`, '--format', '{{.ID}}']), []);
        console.log(JSON.stringify({ cleanup: 'PASS', owned_resource_fingerprint: owned.hash,
          disposable_database_and_fixture: 'DESTROYED', unrelated_containers: 'PRESERVED' }));
      } catch { cleanupErrors.push('owned_stack_cleanup_requires_operator'); }
    }
    process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel);
  }
  if (cleanupErrors.length) console.error(JSON.stringify({ cleanup: 'FAIL', stages: cleanupErrors }));
  if (failure || cleanupErrors.length) { process.exitCode = 1; return; }
  console.log(JSON.stringify({ suite: 'core-mobile-payment-real-http', result: 'PASS',
    provenance: 'real Next routes -> real local Auth/RPC -> PostgreSQL; no provider/webhook/settlement action',
    mobile_device_and_paid_receipt: 'NOT_RUN_NOT_PASS' }));
}
