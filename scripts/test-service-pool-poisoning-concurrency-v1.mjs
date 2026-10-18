import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import pg from 'pg';
import ts from 'typescript';

const connectionString = process.env.SERVICE_POOL_POISONING_TEST_DATABASE_URL;
if (!connectionString || process.env.SERVICE_POOL_POISONING_EPHEMERAL !== '1') {
  throw new Error('Explicit disposable SERVICE PostgreSQL target required');
}
const target = new URL(connectionString);
if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  || !['/postgres', '/service_pool_poisoning_test'].includes(target.pathname)) {
  throw new Error('Local disposable PostgreSQL only');
}

const require = createRequire(import.meta.url);
const cache = new Map();
function load(url) {
  if (cache.has(url.href)) return cache.get(url.href);
  const compiled = ts.transpileModule(readFileSync(url, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const loaded = { exports: {} };
  cache.set(url.href, loaded.exports);
  new Function('require', 'module', 'exports', compiled.outputText)(name => {
    if (name === 'server-only') return {};
    return name.startsWith('.')
      ? load(new URL(name.endsWith('.ts') ? name : `${name}.ts`, url)) : require(name);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const platform = load(new URL(
  '../src/lib/core/platform-role-bound-pool-v1.ts', import.meta.url,
));
const serviceHttp = load(new URL(
  '../src/lib/customer/service-request-subject-link-http-v1.ts', import.meta.url,
));

const runtimeRole = 'cladora_service_subject_link_runtime';
const executorRole = 'cladora_service_subject_link_executor';
const gucs = Object.freeze([
  'request.jwt.claims',
  'request.jwt.claim.sub',
  'request.jwt.claim.aal',
  'request.jwt.claim.role',
  'request.cladora.context_id',
  'request.cladora.workspace_id',
]);
const actorA = '10000000-0000-4000-8000-000000000001';
const actorB = '10000000-0000-4000-8000-000000000002';
const contextA = '20000000-0000-4000-8000-000000000001';
const contextB = '20000000-0000-4000-8000-000000000002';
const workspaceA = '30000000-0000-4000-8000-000000000001';
const workspaceB = '30000000-0000-4000-8000-000000000002';

const adminConnection = new URL(connectionString);
// supabase_admin is deliberately NOLOGIN. Connect through the disposable
// postgres fixture and assume the fixed administrator role at startup without
// creating a credential or weakening the production role contract.
adminConnection.searchParams.set('options', '-c role=supabase_admin');
const runtimeConnection = new URL(connectionString);
// The local trust-only fixture can authenticate the fixed LOGIN runtime role
// without manufacturing a password. Its session_user therefore matches the
// production pool contract throughout physical connection reuse.
runtimeConnection.username = runtimeRole;
const adminPool = new pg.Pool({ connectionString: adminConnection.toString(), max: 5 });
const liveRuntimePools = new Set();

let checks = 0;
let probeTable;
async function check(name, operation) {
  await operation();
  checks += 1;
  console.log(`ok ${checks} - ${name}`);
}
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
async function waitFor(predicate, label) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) return;
    await delay(10);
  }
  throw new Error(`${label}_timeout`);
}

function runtimePool(max = 2) {
  const physical = new pg.Pool({ connectionString: runtimeConnection.toString(), max });
  const pool = {
    get totalCount() { return physical.totalCount; },
    async connect() { return physical.connect(); },
    async end() { await physical.end(); },
  };
  liveRuntimePools.add(pool);
  return pool;
}
async function endRuntimePool(pool) {
  liveRuntimePools.delete(pool);
  await pool.end();
}

function boundPool(pool, connectionModel = 'direct') {
  return platform.createCorePlatformServiceSubjectLinkRoleBoundPoolV1({
    runtime_pool: pool,
    connection_model: connectionModel,
  });
}

function requestPool(pool, actorId, contextId, workspaceId) {
  return serviceHttp.createServiceSubjectLinkRequestPoolV1(pool, {
    source: 'supabase_verified_session',
    actor_id: actorId,
    assurance_level: 'aal2',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  }, { context_id: contextId, workspace_id: workspaceId });
}

const stateSql = `select pg_backend_pid()::int as pid,
  current_user::text as current_user,session_user::text as session_user,
  coalesce(current_setting('request.jwt.claims',true),'') as claims,
  coalesce(current_setting('request.jwt.claim.sub',true),'') as subject,
  coalesce(current_setting('request.jwt.claim.aal',true),'') as assurance,
  coalesce(current_setting('request.jwt.claim.role',true),'') as jwt_role,
  coalesce(current_setting('request.cladora.context_id',true),'') as context_id,
  coalesce(current_setting('request.cladora.workspace_id',true),'') as workspace_id`;
async function state(client) {
  return (await client.query(stateSql)).rows[0];
}
function assertEmptyIdentity(row, currentUser) {
  assert.equal(row.current_user, currentUser);
  assert.equal(row.session_user, runtimeRole);
  for (const key of ['claims', 'subject', 'assurance', 'jwt_role', 'context_id', 'workspace_id']) {
    assert.equal(row[key], '', `${key} must be empty`);
  }
}
function assertRequestIdentity(row, actorId, contextId, workspaceId) {
  assert.equal(row.current_user, executorRole);
  assert.equal(row.session_user, runtimeRole);
  assert.deepEqual(JSON.parse(row.claims), {
    sub: actorId, role: 'authenticated', aal: 'aal2',
  });
  assert.equal(row.subject, actorId);
  assert.equal(row.assurance, 'aal2');
  assert.equal(row.jwt_role, 'authenticated');
  assert.equal(row.context_id, contextId);
  assert.equal(row.workspace_id, workspaceId);
}

function tracedRuntimePool(pool, hook = async (_client, text, values) =>
  _client.query(text, values)) {
  const trace = [];
  return {
    trace,
    async connect() {
      const client = await pool.connect();
      const wrapped = Object.create(client);
      wrapped.query = async (text, values) => {
        trace.push({ text: typeof text === 'string' ? text : '<non-text>', values });
        return hook(client, text, values);
      };
      wrapped.release = error => client.release(error);
      return wrapped;
    },
  };
}

async function poison(client, suffix) {
  await client.query(`set role ${executorRole}`);
  for (const [index, name] of gucs.entries()) {
    await client.query('select set_config($1,$2,false)', [name, `poison-${suffix}-${index}`]);
  }
}

async function exerciseModel(connectionModel) {
  const physical = runtimePool(1);
  const raw = await physical.connect();
  await poison(raw, connectionModel);
  const poisonedPid = (await state(raw)).pid;
  raw.release();

  const traced = tracedRuntimePool(physical);
  const fixed = boundPool(traced, connectionModel);
  const clean = await fixed.connect();
  assert.equal((await state(clean)).pid, poisonedPid, 'the poisoned physical session must be reused');
  assertEmptyIdentity(await state(clean), executorRole);
  clean.release();

  const request = await requestPool(fixed, actorA, contextA, workspaceA).connect();
  await request.query('begin isolation level serializable');
  const active = await state(request);
  assert.equal(active.pid, poisonedPid);
  assertRequestIdentity(active, actorA, contextA, workspaceA);
  assert.equal((await request.query('select auth.uid()::text as actor_id')).rows[0].actor_id, actorA);
  const beginIndex = traced.trace.findIndex(entry => /^begin\b/i.test(entry.text.trim()));
  const settingsIndex = traced.trace.findIndex(entry => entry.text.includes(
    "set_config('request.jwt.claims',$1,true)",
  ));
  assert(beginIndex >= 0 && settingsIndex > beginIndex,
    'all transaction-local identity settings must be installed only after BEGIN');
  assert.equal((traced.trace[settingsIndex].text.match(/set_config\([^\n]+,true\)/g) ?? []).length, 6);
  await request.query('rollback');
  assertEmptyIdentity(await state(request), executorRole);
  request.release();

  const after = await physical.connect();
  assert.equal((await state(after)).pid, poisonedPid);
  assertEmptyIdentity(await state(after), runtimeRole);
  after.release();
  await endRuntimePool(physical);
}

async function assertDestroyedAfter(operation, label) {
  const physical = runtimePool(1);
  await operation(physical);
  await waitFor(() => physical.totalCount === 0, label);
  await endRuntimePool(physical);
}

async function realSerializationRetry() {
  const suffix = randomUUID().replaceAll('-', '');
  probeTable = `service_pool_40001_${suffix}`;
  const qualified = `app_private.${probeTable}`;
  await adminPool.query(`create table ${qualified}(id integer primary key,value integer not null)`);
  await adminPool.query(`insert into ${qualified} values(1,0)`);
  await adminPool.query(`grant select,update on ${qualified} to public`);

  const physical = runtimePool(2);
  const fixed = boundPool(physical, 'session_pooler');
  const blocker = await adminPool.connect();
  const first = await requestPool(fixed, actorA, contextA, workspaceA).connect();
  let firstPid;
  try {
    await blocker.query('begin isolation level serializable');
    await blocker.query(`select value from ${qualified} where id=1`);
    await first.query('begin isolation level serializable');
    firstPid = (await state(first)).pid;
    assertRequestIdentity(await state(first), actorA, contextA, workspaceA);
    await first.query(`select value from ${qualified} where id=1`);
    await blocker.query(`update ${qualified} set value=value+1 where id=1`);
    await blocker.query('commit');
    await assert.rejects(first.query(`update ${qualified} set value=value+1 where id=1`),
      error => error?.code === '40001');
    await first.query('rollback');
  } finally {
    await blocker.query('rollback').catch(() => undefined);
    blocker.release();
    first.release(true);
  }

  const second = await requestPool(fixed, actorB, contextB, workspaceB).connect();
  try {
    await second.query('begin isolation level serializable');
    const rebound = await state(second);
    assertRequestIdentity(rebound, actorB, contextB, workspaceB);
    assert.equal((await second.query('select auth.uid()::text as actor_id')).rows[0].actor_id, actorB);
    assert.equal((await second.query(
      'select app_private.acquire_service_subject_link_role_safety_lease_v1() as safe',
    )).rows[0].safe, true);
    await second.query(`select value from ${qualified} where id=1`);
    await second.query(`update ${qualified} set value=value+1 where id=1`);
    await second.query('commit');
  } finally {
    second.release();
  }
  await waitFor(() => physical.totalCount === 0, 'commit_attempt_connection_destroy');
  assert.notEqual(firstPid, undefined);
  assert.equal((await adminPool.query(`select value from ${qualified} where id=1`)).rows[0].value, 2);
  await endRuntimePool(physical);
  await adminPool.query(`drop table ${qualified}`);
  probeTable = undefined;
}

function sourceEvidence() {
  const http = readFileSync(new URL(
    './test-service-request-subject-link-http-postgres-v1.mjs', import.meta.url,
  ), 'utf8');
  const message = readFileSync(new URL(
    './test-communications-private-message-version-concurrency-v1.mjs', import.meta.url,
  ), 'utf8');
  const direct = readFileSync(new URL(
    './test-service-request-subject-link-postgres-v1.mjs', import.meta.url,
  ), 'utf8');
  assert.equal((http.match(/await check\(/g) ?? []).length, 20);
  for (const evidence of [
    'participant audience denies with zero writes',
    'stale Request and message versions deny with zero writes',
    'two concurrent commands from the same Request version commit exactly once',
    'active SERVICE lease blocks the global catalog mutation protocol',
    'Core binder scrubs poisoned pooled role and all six GUCs before reuse',
    'real PostgreSQL SSI 40001 retries the HTTP command on a fresh transaction',
    'lost COMMIT acknowledgement returns 202 and exact replay recovers once',
  ]) assert.match(http, new RegExp(evidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(http, /authority_attempt: 2, provider_attempt: 2/);
  assert.match(http, /55P03/);
  assert.equal((message.match(/await check\(/g) ?? []).length, 5);
  for (const evidence of [
    'two exact-version writers produce one success and one stale result',
    'body and lifecycle changes require the exact next version',
    'physical delete and cross-Workspace identity move fail closed',
  ]) assert.ok(message.includes(evidence));
  assert.ok(direct.includes('exact replay rejects changed participant currentness with zero writes'));
  assert.ok(direct.includes('exact replay rechecks authority and writes nothing'));
  assert.match(direct, /links: before\.links \+ 1/);
  return Object.freeze({ http_cases: 20, message_cases: 5 });
}

try {
  const admin = await adminPool.query(
    'select current_user,rolsuper from pg_roles where rolname=current_user',
  );
  assert.deepEqual(admin.rows, [{ current_user: 'supabase_admin', rolsuper: true }]);
  assert.equal((await adminPool.query(`select count(*)::int as count from pg_roles
    where rolname in ('${runtimeRole}','${executorRole}',
      'cladora_service_subject_link_owner')`)).rows[0].count, 3);
  assert.equal((await adminPool.query(`select
    to_regprocedure('app_private.assert_service_subject_link_role_safety_v1()') is not null
    and to_regprocedure('app_private.acquire_service_subject_link_role_safety_lease_v1()') is not null
    as ready`)).rows[0].ready, true);
  await check('transaction_pooler and absent runtime pools reject before checkout', async () => {
    let connects = 0;
    const never = { async connect() { connects += 1; throw new Error('must_not_checkout'); } };
    assert.throws(() => platform.createCorePlatformServiceSubjectLinkRoleBoundPoolV1({
      runtime_pool: never, connection_model: 'transaction_pooler',
    }), /connection_model_unsupported/);
    assert.equal(connects, 0);
    assert.throws(() => platform.createCorePlatformServiceSubjectLinkRoleBoundPoolV1({
      runtime_pool: null, connection_model: 'direct',
    }), /runtime_pool_unavailable/);
  });

  await check('direct model scrubs role and all six GUCs around transaction-local identity', () =>
    exerciseModel('direct'));
  await check('declared session model scrubs role and all six GUCs around transaction-local identity', () =>
    exerciseModel('session_pooler'));

  await check('concurrent actors and Workspaces leave no identity residue on reused sessions', async () => {
    const physical = runtimePool(2);
    const fixed = boundPool(physical, 'session_pooler');
    const [left, right] = await Promise.all([
      requestPool(fixed, actorA, contextA, workspaceA).connect(),
      requestPool(fixed, actorB, contextB, workspaceB).connect(),
    ]);
    await Promise.all([
      left.query('begin isolation level serializable'),
      right.query('begin isolation level serializable'),
    ]);
    const [leftState, rightState] = await Promise.all([state(left), state(right)]);
    assert.notEqual(leftState.pid, rightState.pid);
    assertRequestIdentity(leftState, actorA, contextA, workspaceA);
    assertRequestIdentity(rightState, actorB, contextB, workspaceB);
    await Promise.all([left.query('rollback'), right.query('rollback')]);
    left.release();
    right.release();
    const [rawLeft, rawRight] = await Promise.all([physical.connect(), physical.connect()]);
    const [rawLeftState, rawRightState] = await Promise.all([state(rawLeft), state(rawRight)]);
    assert.deepEqual(new Set([rawLeftState.pid, rawRightState.pid]),
      new Set([leftState.pid, rightState.pid]));
    assertEmptyIdentity(rawLeftState, runtimeRole);
    assertEmptyIdentity(rawRightState, runtimeRole);
    rawLeft.release();
    rawRight.release();
    await endRuntimePool(physical);
  });

  await check('cleanup failure destroys the physical connection', () =>
    assertDestroyedAfter(async physical => {
      let cleanupCalls = 0;
      const injected = tracedRuntimePool(physical, async (client, text, values) => {
        if (typeof text === 'string'
          && text.includes("set_config('request.jwt.claims','',false)")) {
          cleanupCalls += 1;
          if (cleanupCalls === 2) throw new Error('injected_cleanup_failure');
        }
        return client.query(text, values);
      });
      const client = await boundPool(injected).connect();
      client.release();
    }, 'cleanup_failure_destroy'));

  await check('open transaction release destroys the physical connection', () =>
    assertDestroyedAfter(async physical => {
      const client = await boundPool(physical).connect();
      await client.query('begin isolation level serializable');
      client.release();
    }, 'open_transaction_destroy'));

  await check('failed COMMIT acknowledgement destroys the unknown-outcome connection', () =>
    assertDestroyedAfter(async physical => {
      const injected = tracedRuntimePool(physical, async (client, text, values) => {
        if (typeof text === 'string' && text.trim().toLowerCase() === 'commit') {
          await client.query(text, values);
          const error = new Error('injected_commit_ack_loss');
          error.code = 'ECONNRESET';
          throw error;
        }
        return client.query(text, values);
      });
      const client = await boundPool(injected).connect();
      await client.query('begin isolation level serializable');
      await assert.rejects(client.query('commit'), /injected_commit_ack_loss/);
      client.release();
    }, 'unknown_commit_destroy'));

  await check('server-rejected COMMIT also destroys the failed-transaction connection', () =>
    assertDestroyedAfter(async physical => {
      const injected = tracedRuntimePool(physical, async (client, text, values) => {
        if (typeof text === 'string' && text.trim().toLowerCase() === 'commit') {
          const error = new Error('injected_serialization_commit_failure');
          error.code = '40001';
          throw error;
        }
        return client.query(text, values);
      });
      const client = await boundPool(injected).connect();
      await client.query('begin isolation level serializable');
      await assert.rejects(client.query('commit'), error => error?.code === '40001');
      client.release();
    }, 'failed_commit_destroy'));

  await check('safety mismatch rejects checkout and destroys the physical connection', () =>
    assertDestroyedAfter(async physical => {
      const injected = tracedRuntimePool(physical, async (client, text, values) => {
        if (text === 'select app_private.assert_service_subject_link_role_safety_v1() as safe') {
          return { command: 'SELECT', rowCount: 1, oid: 0, fields: [], rows: [{ safe: false }] };
        }
        return client.query(text, values);
      });
      await assert.rejects(boundPool(injected).connect(), /role_safety_invalid/);
    }, 'safety_mismatch_destroy'));

  await check('real PostgreSQL 40001 is followed by fresh identity and safety rebinding',
    realSerializationRetry);

  const integrated = sourceEvidence();
  await check('existing SERVICE-05 race harnesses are explicitly source-integrated, not rerun',
    async () => assert.deepEqual(integrated, { http_cases: 20, message_cases: 5 }));

  console.log(JSON.stringify({
    suite: 'service-pool-poisoning-concurrency-v1',
    checks,
    models: ['direct', 'session_pooler'],
    real_postgresql_40001: 'EXECUTED_WITH_FRESH_REQUEST_IDENTITY_AND_SAFETY_REBIND',
    existing_service_http_harness: '20_CASE_SOURCE_CONTRACT_INTEGRATED_NOT_RERUN',
    existing_message_concurrency_harness: '5_CASE_SOURCE_CONTRACT_INTEGRATED_NOT_RERUN',
    step_su_02_executed: false,
    activation: false,
    limitations: [
      'This script does not independently rerun the full SERVICE HTTP/AAL2 20-case harness.',
      'Participant insert/revoke/update/delete races execute in the independent SERVICE subject-link PostgreSQL harness; this pool-focused script verifies only their source integration.',
      'Duplicate-link behavior is represented by exact replay plus unchanged link counts, not by an independent competing duplicate-link race.',
      'A reverse authority-revision/domain-row interleaving can still produce SQLSTATE 40P01; the independent harness proves atomic rollback, not deadlock freedom.',
      'COMMIT acknowledgement loss and cleanup failure are deterministic client fault injections; the connection-destruction behavior is real, but no kernel-level socket fault is induced.',
    ],
  }));
} finally {
  if (probeTable) {
    await adminPool.query(`drop table if exists app_private.${probeTable}`).catch(() => undefined);
  }
  await Promise.allSettled([...liveRuntimePools].map(pool => endRuntimePool(pool)));
  await adminPool.end();
}
