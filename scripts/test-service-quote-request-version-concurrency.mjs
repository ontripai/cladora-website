import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// This module is inert until an official disposable-target provider attests the
// exact endpoint, fixture and lease. Environment variable names and a
// local-looking URL are inputs, never authorization.
export const SERVICE_QUOTE_TIMEOUTS = Object.freeze({
  attestation: 2_000,
  connection: 5_000,
  query: 5_000,
  statement: 4_000,
  lock: 1_000,
  lockObservation: 3_000,
  cleanup: 2_000,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SQLSTATES = new Set(['22023', '23505', '40001', '42501', '55P03', '57014', '08001', '08006', '57P01']);
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const PROOF_CONTRACT = 'cladora.disposable-postgres-fixture-proof.v1';
const CLEANUP_MODE = 'external_owner_destroys_disposable_database';

function fail(code) {
  return Object.assign(new Error(code), { code });
}

function requiredText(value, code, maximum = 512) {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum || value !== value.trim()) throw fail(code);
  return value;
}

function digest(value) {
  return createHash('sha256').update(value).digest('hex');
}

function stableFixture(fixture) {
  return JSON.stringify({
    actorId: fixture.actorId,
    deniedActorId: fixture.deniedActorId,
    contextId: fixture.contextId,
    workspaceId: fixture.workspaceId,
    foreignWorkspaceId: fixture.foreignWorkspaceId,
    requestId: fixture.requestId,
    command: fixture.command,
  });
}

export function parseServiceQuoteHarnessInputs(env) {
  const rawUrl = requiredText(env.CLADORA_SERVICE_QUOTE_TEST_DATABASE_URL, 'database_url_required', 2_048);
  let target;
  try { target = new URL(rawUrl); } catch { throw fail('database_url_invalid'); }
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) throw fail('database_protocol_invalid');
  if (!LOOPBACK_HOSTS.has(target.hostname)) throw fail('database_url_must_be_loopback');
  if (!target.port || Number(target.port) < 1 || Number(target.port) > 65_535) throw fail('database_port_invalid');
  if (!target.username || !target.password) throw fail('database_credentials_required');
  if (target.search || target.hash) throw fail('database_endpoint_overrides_prohibited');
  if (!/^\/cladora_service_quote_fixture_[0-9a-f]{32}$/.test(target.pathname)) throw fail('owned_fixture_database_required');

  const fixtureText = requiredText(env.CLADORA_SERVICE_QUOTE_CONCURRENCY_FIXTURE, 'fixture_required', 65_536);
  let fixture;
  try { fixture = JSON.parse(fixtureText); } catch { throw fail('fixture_invalid'); }
  if (!fixture || typeof fixture !== 'object' || Array.isArray(fixture)) throw fail('fixture_invalid');
  const fixtureFields = ['actorId', 'deniedActorId', 'contextId', 'workspaceId', 'foreignWorkspaceId', 'requestId', 'command'];
  if (Object.keys(fixture).length !== fixtureFields.length || !fixtureFields.every(field => Object.hasOwn(fixture, field))) {
    throw fail('fixture_shape_invalid');
  }
  for (const field of fixtureFields.slice(0, -1)) {
    if (!UUID.test(fixture[field] ?? '')) throw fail(`fixture_${field}_invalid`);
  }
  if (!fixture.command || typeof fixture.command !== 'object' || Array.isArray(fixture.command)) throw fail('fixture_command_invalid');
  if (fixture.command.workspace_id !== fixture.workspaceId) throw fail('fixture_command_workspace_mismatch');
  if (!Number.isSafeInteger(fixture.command.expected_request_version) || fixture.command.expected_request_version < 1) {
    throw fail('fixture_request_version_invalid');
  }
  requiredText(fixture.command.idempotency_key, 'fixture_idempotency_key_invalid', 200);

  return Object.freeze({
    connectionString: target.href,
    databaseName: target.pathname.slice(1),
    targetFingerprint: digest(target.href),
    fixtureFingerprint: digest(stableFixture(fixture)),
    fixture: Object.freeze(fixture),
  });
}

function bounded(promise, milliseconds, code) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(fail(code)), milliseconds); });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => clearTimeout(timer));
}

export async function attestServiceQuoteTarget(inputs, attestTarget, {
  now = () => Date.now(),
  timeout = SERVICE_QUOTE_TIMEOUTS.attestation,
} = {}) {
  if (typeof attestTarget !== 'function') throw fail('official_disposable_target_provider_required');
  const request = Object.freeze({
    contract: PROOF_CONTRACT,
    target_fingerprint: inputs.targetFingerprint,
    fixture_fingerprint: inputs.fixtureFingerprint,
    database_name: inputs.databaseName,
  });
  const proof = await bounded(attestTarget(request), timeout, 'disposable_target_attestation_timeout');
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) throw fail('disposable_target_proof_invalid');
  if (proof.contract !== PROOF_CONTRACT || proof.authorized !== true) throw fail('disposable_target_not_authorized');
  if (proof.target_fingerprint !== request.target_fingerprint || proof.fixture_fingerprint !== request.fixture_fingerprint) {
    throw fail('disposable_target_proof_mismatch');
  }
  requiredText(proof.lease_id, 'disposable_lease_invalid', 200);
  const fixtureOwner = requiredText(proof.fixture_owner, 'fixture_owner_invalid', 200);
  const cleanupOwner = requiredText(proof.cleanup_owner, 'cleanup_owner_invalid', 200);
  if (fixtureOwner !== cleanupOwner || proof.cleanup_mode !== CLEANUP_MODE) throw fail('fixture_cleanup_ownership_invalid');
  const expiresAt = Date.parse(proof.expires_at);
  const current = now();
  if (!Number.isFinite(expiresAt) || expiresAt <= current || expiresAt > current + 86_400_000) throw fail('disposable_lease_stale');
  return Object.freeze({ leaseId: proof.lease_id, fixtureOwner, cleanupOwner, expiresAt });
}

export function sanitizeHarnessFailure(error, stage = 'operation') {
  return Object.freeze({
    stage,
    category: /_timeout$/.test(error?.code ?? '') ? 'timeout' : 'operation-failed',
    sqlstate: SQLSTATES.has(error?.code) ? error.code : null,
  });
}

export class ServiceQuoteHarnessFailure extends Error {
  constructor(primary, cleanup) {
    super('SERVICE quote concurrency harness failed; sensitive details withheld');
    this.diagnostic = Object.freeze({
      suite: 'service-quote-request-version-concurrency',
      result: 'FAIL',
      primary,
      cleanup: Object.freeze(cleanup),
    });
  }
}

export async function withServiceQuoteCleanup(operation, steps, timeouts = SERVICE_QUOTE_TIMEOUTS) {
  let result;
  let primary = null;
  const cleanup = [];
  try { result = await operation(); } catch (error) {
    if (error instanceof ServiceQuoteHarnessFailure) {
      primary = error.diagnostic.primary;
      cleanup.push(...error.diagnostic.cleanup);
    } else {
      primary = sanitizeHarnessFailure(error);
    }
  }
  for (const step of steps) {
    try { await bounded(step.run(), timeouts.cleanup, 'cleanup_timeout'); }
    catch (error) { cleanup.push({ ...sanitizeHarnessFailure(error, step.stage), stage: step.stage }); }
  }
  if (primary || cleanup.length) throw new ServiceQuoteHarnessFailure(primary, cleanup);
  return result;
}

export function createBoundedServiceQuoteSession(Client, inputs, name, timeouts = SERVICE_QUOTE_TIMEOUTS) {
  const client = new Client({
    connectionString: inputs.connectionString,
    application_name: name,
    connectionTimeoutMillis: timeouts.connection,
    query_timeout: timeouts.query,
    statement_timeout: timeouts.statement,
    lock_timeout: timeouts.lock,
    idle_in_transaction_session_timeout: timeouts.query,
  });
  return { client, name, inTransaction: false, connectStarted: false, connected: false };
}

export async function connectServiceQuoteSession(session, timeouts = SERVICE_QUOTE_TIMEOUTS) {
  session.connectStarted = true;
  await bounded(Promise.resolve().then(() => session.client.connect()), timeouts.connection + 250, 'connection_timeout');
  session.connected = true;
  return session;
}

export function boundedServiceQuoteQuery(session, text, values = [], timeouts = SERVICE_QUOTE_TIMEOUTS) {
  return bounded(Promise.resolve().then(() => session.client.query({ text, values, query_timeout: timeouts.query })),
    timeouts.query + 250, 'query_timeout');
}

async function begin(session, timeouts) {
  await boundedServiceQuoteQuery(session, 'begin', [], timeouts);
  session.inTransaction = true;
}

async function commit(session, timeouts) {
  await boundedServiceQuoteQuery(session, 'commit', [], timeouts);
  session.inTransaction = false;
}

async function rollback(session, timeouts) {
  if (!session.inTransaction) return;
  await boundedServiceQuoteQuery(session, 'rollback', [], timeouts);
  session.inTransaction = false;
}

export async function waitForServiceQuoteLock(control, applicationName, timeouts, now, sleep) {
  const deadline = now() + timeouts.lockObservation;
  while (now() < deadline) {
    const remaining = Math.max(1, deadline - now());
    const observationTimeouts = { ...timeouts, query: Math.min(timeouts.query, remaining) };
    const result = await boundedServiceQuoteQuery(control,
      "select wait_event_type from pg_stat_activity where application_name=$1 and state='active'",
      [applicationName], observationTimeouts);
    if (result.rows[0]?.wait_event_type === 'Lock') return;
    await bounded(sleep(Math.min(20, Math.max(1, deadline - now()))), Math.min(250, timeouts.lockObservation), 'lock_observation_sleep_timeout');
  }
  throw fail('lock_observation_timeout');
}

export async function runServiceQuoteConcurrency({
  env = process.env,
  attestTarget,
  pgModuleLoader = () => import('pg'),
  now = () => Date.now(),
  sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
  timeouts = SERVICE_QUOTE_TIMEOUTS,
} = {}) {
  // Parsing and independent attestation finish before pg is imported or a
  // Client is constructed. A caller cannot authorize itself with an env flag.
  const inputs = parseServiceQuoteHarnessInputs(env);
  const proof = await attestServiceQuoteTarget(inputs, attestTarget, { now, timeout: timeouts.attestation });
  const pg = await pgModuleLoader();
  const Client = pg.Client ?? pg.default?.Client;
  if (typeof Client !== 'function') throw fail('pg_client_unavailable');

  const sessions = [
    createBoundedServiceQuoteSession(Client, inputs, 'service-quote-v2-control', timeouts),
    createBoundedServiceQuoteSession(Client, inputs, 'service-quote-v2-first', timeouts),
    createBoundedServiceQuoteSession(Client, inputs, 'service-quote-v2-second', timeouts),
  ];
  const [control, first, second] = sessions;
  let cases = 0;
  const check = async fn => { await fn(); cases += 1; };
  const query = (session, text, values = []) => boundedServiceQuoteQuery(session, text, values, timeouts);
  const setActor = (session, actorId) => query(session, "select set_config('request.jwt.claim.sub',$1,false)", [actorId]);
  const rpc = (session, command) => query(session,
    'select customer_api.create_service_quote_draft_v2($1::jsonb) result', [JSON.stringify(command)])
    .then(result => result.rows[0].result);
  const denied = (promise, code) => assert.rejects(promise, error => error.code === code);
  const keyFor = command => `service_quote:sql_v2:${command.workspace_id}:${inputs.fixture.actorId}:${command.idempotency_key}`;
  const snapshot = async command => (await query(control, `
    select
      (select count(*)::int from service_catalog.quote_drafts where request_id=$1) drafts,
      (select count(*)::int from audit.events where entity_type='service_quote_draft') audits,
      (select count(*)::int from platform.outbox_events where aggregate_type='service_quote_draft') outbox,
      (select count(*)::int from platform.idempotency_keys where key=$2) keys`,
  [inputs.fixture.requestId, keyFor(command)])).rows[0];
  const nextKey = label => `${label}-${now()}-${Math.random().toString(16).slice(2)}`;
  const advanceRequest = async (session, expectedVersion) => {
    await begin(session, timeouts);
    try {
      await query(session, 'select app_private.lock_service_request_version_v1($1,$2,$3)',
        [inputs.fixture.workspaceId, inputs.fixture.requestId, expectedVersion]);
      const result = await query(session,
        'update service_catalog.requests set version=version+1 where id=$1 and workspace_id=$2 returning version',
        [inputs.fixture.requestId, inputs.fixture.workspaceId]);
      assert.equal(result.rowCount, 1);
      await commit(session, timeouts);
      return Number(result.rows[0].version);
    } catch (error) {
      try { await rollback(session, timeouts); } catch (cleanupError) {
        throw new ServiceQuoteHarnessFailure(sanitizeHarnessFailure(error), [sanitizeHarnessFailure(cleanupError, 'rollback')]);
      }
      throw error;
    }
  };

  return withServiceQuoteCleanup(async () => {
    for (const session of sessions) await connectServiceQuoteSession(session, timeouts);
    for (const session of sessions) {
      const identity = await query(session, 'select current_database() name');
      assert.equal(identity.rows[0]?.name, inputs.databaseName, 'connected database must match attested fixture');
    }
    await Promise.all(sessions.map(session => setActor(session, inputs.fixture.actorId)));
    const initial = (await query(control,
      'select version::int from service_catalog.requests where id=$1 and workspace_id=$2',
      [inputs.fixture.requestId, inputs.fixture.workspaceId])).rows[0]?.version;
    assert.equal(initial, inputs.fixture.command.expected_request_version, 'fixture command must name the current Request version');

    await check(async () => {
      const stale = { ...inputs.fixture.command, idempotency_key: nextKey('stale-after-lock') };
      const before = await snapshot(stale);
      await begin(first, timeouts);
      await query(first, 'select app_private.lock_service_request_version_v1($1,$2,$3)',
        [inputs.fixture.workspaceId, inputs.fixture.requestId, initial]);
      const waiting = rpc(second, stale);
      await waitForServiceQuoteLock(control, second.name, timeouts, now, sleep);
      await query(first, 'update service_catalog.requests set version=version+1 where id=$1 and workspace_id=$2',
        [inputs.fixture.requestId, inputs.fixture.workspaceId]);
      await commit(first, timeouts);
      await denied(waiting, '40001');
      assert.deepEqual(await snapshot(stale), before);
    });

    const current = initial + 1;
    await check(async () => {
      const revoked = { ...inputs.fixture.command, expected_request_version: current, idempotency_key: nextKey('revoked-after-lock') };
      const before = await snapshot(revoked);
      await begin(first, timeouts);
      await query(first, 'select id from service_catalog.requests where id=$1 and workspace_id=$2 for update',
        [inputs.fixture.requestId, inputs.fixture.workspaceId]);
      const waiting = rpc(second, revoked);
      await waitForServiceQuoteLock(control, second.name, timeouts, now, sleep);
      const removed = await query(control,
        "delete from app_private.test_authority where actor_id=$1 and workspace_id=$2 and permission='services.quotes.manage' returning actor_id",
        [inputs.fixture.actorId, inputs.fixture.workspaceId]);
      assert.equal(removed.rowCount, 1, 'owned disposable fixture must contain one quote authority row');
      await commit(first, timeouts);
      try { await denied(waiting, '42501'); assert.deepEqual(await snapshot(revoked), before); }
      finally {
        await query(control,
          "insert into app_private.test_authority(actor_id,workspace_id,permission) values($1,$2,'services.quotes.manage')",
          [inputs.fixture.actorId, inputs.fixture.workspaceId]);
      }
    });

    const fresh = { ...inputs.fixture.command, expected_request_version: current, idempotency_key: nextKey('fresh') };
    let committed;
    await check(async () => {
      const before = await snapshot(fresh); committed = await rpc(control, fresh); assert.equal(committed.request_version, current);
      const after = await snapshot(fresh);
      assert.equal(after.drafts, before.drafts + 1); assert.equal(after.audits, before.audits + 1);
      assert.equal(after.outbox, before.outbox + 1); assert.equal(after.keys, 1);
    });
    await check(async () => {
      assert.equal(await advanceRequest(first, current), current + 1);
      assert.deepEqual(await rpc(control, fresh), committed);
      await denied(rpc(control, { ...fresh, scope: `${fresh.scope} changed` }), '23505');
      assert.equal((await snapshot(fresh)).keys, 1);
    });
    await check(async () => {
      const duplicate = { ...inputs.fixture.command, expected_request_version: current + 1, idempotency_key: nextKey('duplicate') };
      const before = await snapshot(duplicate);
      const [left, right] = await Promise.all([rpc(first, duplicate), rpc(second, duplicate)]);
      assert.deepEqual(left, right); const after = await snapshot(duplicate);
      assert.equal(after.drafts, before.drafts + 1); assert.equal(after.audits, before.audits + 1);
      assert.equal(after.outbox, before.outbox + 1); assert.equal(after.keys, 1);
    });
    await check(async () => {
      const missing = { ...inputs.fixture.command, idempotency_key: nextKey('missing-version') };
      delete missing.expected_request_version;
      const beforeMissing = await snapshot(missing); await denied(rpc(control, missing), '22023'); assert.deepEqual(await snapshot(missing), beforeMissing);
      const unauthorized = { ...inputs.fixture.command, expected_request_version: current + 1, idempotency_key: nextKey('denied-actor') };
      const beforeDenied = await snapshot(unauthorized); await setActor(second, inputs.fixture.deniedActorId);
      await denied(rpc(second, unauthorized), '42501'); assert.deepEqual(await snapshot(unauthorized), beforeDenied);
      await setActor(second, inputs.fixture.actorId);
    });
    await check(async () => {
      const cross = { ...inputs.fixture.command, workspace_id: inputs.fixture.foreignWorkspaceId,
        expected_request_version: current + 1, idempotency_key: nextKey('cross-workspace') };
      const before = await snapshot(cross); await denied(rpc(control, cross), '42501'); assert.deepEqual(await snapshot(cross), before);
    });

    return Object.freeze({
      suite: 'service-quote-request-version-concurrency', result: 'PASS', cases,
      fixture_owner: proof.fixtureOwner,
      fixture_cleanup: 'OWNED_BY_ATTESTED_EXTERNAL_PROVIDER',
      postgres: 'EXECUTED_BY_CALLER', auth: 'FIXTURE_ONLY_NOT_ISSUED_AUTH',
    });
  }, sessions.flatMap(session => [
    { stage: `${session.name}:rollback`, run: () => rollback(session, timeouts) },
    { stage: `${session.name}:end`, run: () => session.connectStarted ? session.client.end() : undefined },
  ]), timeouts);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runServiceQuoteConcurrency().then(result => console.log(JSON.stringify(result))).catch(error => {
    const diagnostic = error instanceof ServiceQuoteHarnessFailure
      ? error.diagnostic
      : { suite: 'service-quote-request-version-concurrency', result: 'FAIL', primary: sanitizeHarnessFailure(error), cleanup: [] };
    console.error(JSON.stringify(diagnostic));
    process.exitCode = 1;
  });
}
