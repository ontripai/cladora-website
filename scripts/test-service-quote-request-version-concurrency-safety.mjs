import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import {
  SERVICE_QUOTE_TIMEOUTS,
  ServiceQuoteHarnessFailure,
  attestServiceQuoteTarget,
  boundedServiceQuoteQuery,
  connectServiceQuoteSession,
  createBoundedServiceQuoteSession,
  parseServiceQuoteHarnessInputs,
  runServiceQuoteConcurrency,
  waitForServiceQuoteLock,
  withServiceQuoteCleanup,
} from './test-service-quote-request-version-concurrency.mjs';

// Offline only: fake clients and timers. No PostgreSQL, Docker, Auth, HTTP,
// socket, server, process startup or remote resource is used by this suite.
const id = suffix => `00000000-0000-4000-8000-${suffix.padStart(12, '0')}`;
const fixture = {
  actorId: id('1'), deniedActorId: id('2'), contextId: id('3'), workspaceId: id('4'),
  foreignWorkspaceId: id('5'), requestId: id('6'),
  command: { workspace_id: id('4'), expected_request_version: 1, idempotency_key: 'quote-safe-1', scope: 'synthetic' },
};
const env = {
  CLADORA_SERVICE_QUOTE_TEST_DATABASE_URL:
    `postgresql://fixture:private@127.0.0.1:54322/cladora_service_quote_fixture_${'a'.repeat(32)}`,
  CLADORA_SERVICE_QUOTE_CONCURRENCY_FIXTURE: JSON.stringify(fixture),
};
const now = 2_000_000_000_000;
const proofFor = request => ({
  contract: request.contract,
  authorized: true,
  target_fingerprint: request.target_fingerprint,
  fixture_fingerprint: request.fixture_fingerprint,
  lease_id: `service-quote-owned-${'b'.repeat(32)}`,
  fixture_owner: 'platform-disposable-fixture-owner',
  cleanup_owner: 'platform-disposable-fixture-owner',
  cleanup_mode: 'external_owner_destroys_disposable_database',
  expires_at: new Date(now + 60_000).toISOString(),
});

test('valid loopback inputs require an independent exact target/fixture attestation', async () => {
  const inputs = parseServiceQuoteHarnessInputs(env);
  const proof = await attestServiceQuoteTarget(inputs, async request => proofFor(request), { now: () => now, timeout: 50 });
  assert.equal(proof.fixtureOwner, 'platform-disposable-fixture-owner');
  assert.equal(proof.cleanupOwner, proof.fixtureOwner);
});

test('remote, ambiguous, shared and override targets fail before attestation or Client construction', async () => {
  const rejected = [
    env.CLADORA_SERVICE_QUOTE_TEST_DATABASE_URL.replace('127.0.0.1', 'db.example.test'),
    env.CLADORA_SERVICE_QUOTE_TEST_DATABASE_URL.replace('127.0.0.1', '127.0.0.2'),
    env.CLADORA_SERVICE_QUOTE_TEST_DATABASE_URL.replace('postgresql:', 'https:'),
    env.CLADORA_SERVICE_QUOTE_TEST_DATABASE_URL.replace(`cladora_service_quote_fixture_${'a'.repeat(32)}`, 'postgres'),
    `${env.CLADORA_SERVICE_QUOTE_TEST_DATABASE_URL}?host=db.example.test`,
    `${env.CLADORA_SERVICE_QUOTE_TEST_DATABASE_URL}#override`,
  ];
  for (const connectionString of rejected) {
    let attestCalls = 0; let loaderCalls = 0; let clientCalls = 0;
    await assert.rejects(runServiceQuoteConcurrency({
      env: { ...env, CLADORA_SERVICE_QUOTE_TEST_DATABASE_URL: connectionString },
      attestTarget: async request => { attestCalls += 1; return proofFor(request); },
      pgModuleLoader: async () => { loaderCalls += 1; return { Client: class { constructor() { clientCalls += 1; } } }; },
      now: () => now,
    }));
    assert.deepEqual({ attestCalls, loaderCalls, clientCalls }, { attestCalls: 0, loaderCalls: 0, clientCalls: 0 });
  }
});

test('missing provider, mismatched ownership and stale lease fail before pg import/connect/write', async () => {
  const inputs = parseServiceQuoteHarnessInputs(env);
  await assert.rejects(attestServiceQuoteTarget(inputs), /official_disposable_target_provider_required/);
  const variants = [
    request => ({ ...proofFor(request), target_fingerprint: 'c'.repeat(64) }),
    request => ({ ...proofFor(request), fixture_fingerprint: 'd'.repeat(64) }),
    request => ({ ...proofFor(request), cleanup_owner: 'different-owner' }),
    request => ({ ...proofFor(request), expires_at: new Date(now - 1).toISOString() }),
  ];
  for (const attestTarget of [undefined, ...variants]) {
    let loaderCalls = 0; let clientCalls = 0;
    await assert.rejects(runServiceQuoteConcurrency({
      env, attestTarget,
      pgModuleLoader: async () => { loaderCalls += 1; return { Client: class { constructor() { clientCalls += 1; } } }; },
      now: () => now,
      timeouts: { ...SERVICE_QUOTE_TIMEOUTS, attestation: 50 },
    }));
    assert.equal(loaderCalls, 0); assert.equal(clientCalls, 0);
  }
});

test('attestation itself is deadline bounded and cannot silently fall back', async () => {
  const inputs = parseServiceQuoteHarnessInputs(env);
  await assert.rejects(attestServiceQuoteTarget(inputs, () => new Promise(() => {}), {
    now: () => now, timeout: 5,
  }), /disposable_target_attestation_timeout/);
});

test('Client configuration bounds connection, statement, query, lock and idle transaction waits', async () => {
  let options;
  class Client { constructor(value) { options = value; } async connect() {} }
  const inputs = parseServiceQuoteHarnessInputs(env);
  const session = createBoundedServiceQuoteSession(Client, inputs, 'safe-client');
  await connectServiceQuoteSession(session);
  assert.deepEqual({
    connection: options.connectionTimeoutMillis,
    query: options.query_timeout,
    statement: options.statement_timeout,
    lock: options.lock_timeout,
    idle: options.idle_in_transaction_session_timeout,
  }, {
    connection: SERVICE_QUOTE_TIMEOUTS.connection,
    query: SERVICE_QUOTE_TIMEOUTS.query,
    statement: SERVICE_QUOTE_TIMEOUTS.statement,
    lock: SERVICE_QUOTE_TIMEOUTS.lock,
    idle: SERVICE_QUOTE_TIMEOUTS.query,
  });
  assert.equal(options.application_name, 'safe-client');
});

test('connection and query transport hangs fail on deadlines', async () => {
  class HungClient {
    connect() { return new Promise(() => {}); }
    query() { return new Promise(() => {}); }
  }
  const inputs = parseServiceQuoteHarnessInputs(env);
  const timeouts = { ...SERVICE_QUOTE_TIMEOUTS, connection: 5, query: 5 };
  const session = createBoundedServiceQuoteSession(HungClient, inputs, 'hung-client', timeouts);
  await assert.rejects(connectServiceQuoteSession(session, timeouts), /connection_timeout/);
  await assert.rejects(boundedServiceQuoteQuery(session, 'select 1', [], timeouts), /query_timeout/);

  class FailedClient {
    connect() { throw Object.assign(new Error('private transport detail'), { code: '08006' }); }
    query() { throw Object.assign(new Error('private query detail'), { code: '08006' }); }
  }
  const failed = createBoundedServiceQuoteSession(FailedClient, inputs, 'failed-client', timeouts);
  await assert.rejects(connectServiceQuoteSession(failed, timeouts), error => error.code === '08006');
  assert.equal(failed.connectStarted, true); assert.equal(failed.connected, false);
  await assert.rejects(boundedServiceQuoteQuery(failed, 'select 1', [], timeouts), error => error.code === '08006');
});

test('lock observation has a deterministic deadline', async () => {
  let clock = 0; let queries = 0;
  const control = {
    client: { query: async () => { queries += 1; return { rows: [{ wait_event_type: null }] }; } },
  };
  const timeouts = { ...SERVICE_QUOTE_TIMEOUTS, query: 20, lockObservation: 5 };
  await assert.rejects(waitForServiceQuoteLock(control, 'waiting-client', timeouts,
    () => clock, async milliseconds => { clock += milliseconds; }), /lock_observation_timeout/);
  assert.equal(queries, 1);
});

test('primary and cleanup failures remain separate; unknown cleanup never becomes PASS', async () => {
  const events = [];
  await assert.rejects(withServiceQuoteCleanup(async () => {
    events.push('operation'); throw Object.assign(new Error('sensitive-primary'), { code: '40001' });
  }, [
    { stage: 'rollback', run: async () => { events.push('rollback'); throw new Error('sensitive-cleanup'); } },
    { stage: 'end', run: async () => { events.push('end'); } },
  ], { ...SERVICE_QUOTE_TIMEOUTS, cleanup: 50 }), error => {
    assert.ok(error instanceof ServiceQuoteHarnessFailure);
    assert.equal(error.diagnostic.primary.sqlstate, '40001');
    assert.deepEqual(error.diagnostic.cleanup.map(item => item.stage), ['rollback']);
    assert.deepEqual(events, ['operation', 'rollback', 'end']);
    assert.ok(!JSON.stringify(error.diagnostic).includes('sensitive'));
    return true;
  });
  await assert.rejects(withServiceQuoteCleanup(async () => 'PASS', [
    { stage: 'end', run: () => new Promise(() => {}) },
  ], { ...SERVICE_QUOTE_TIMEOUTS, cleanup: 5 }), error => {
    assert.equal(error.diagnostic.primary, null);
    assert.equal(error.diagnostic.cleanup[0].category, 'timeout');
    return true;
  });

  const nested = new ServiceQuoteHarnessFailure(
    { stage: 'operation', category: 'operation-failed', sqlstate: '40001' },
    [{ stage: 'inner-rollback', category: 'operation-failed', sqlstate: null }],
  );
  await assert.rejects(withServiceQuoteCleanup(async () => { throw nested; }, [
    { stage: 'outer-end', run: async () => { throw new Error('outer-cleanup'); } },
  ]), error => {
    assert.equal(error.diagnostic.primary.sqlstate, '40001');
    assert.deepEqual(error.diagnostic.cleanup.map(item => item.stage), ['inner-rollback', 'outer-end']);
    return true;
  });
});

test('the harness never deletes shared rows or grants authority during cleanup', async () => {
  const source = await readFile(new URL('./test-service-quote-request-version-concurrency.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes('external_owner_destroys_disposable_database'));
  assert.doesNotMatch(source, /drop\s+database|truncate\s+|pg_terminate_backend|grant\s+|revoke\s+/i);
  assert.doesNotMatch(source, /CLADORA_PG_PACKAGE|DATABASE_URL_FALLBACK|ALLOW_REMOTE/i);
});
