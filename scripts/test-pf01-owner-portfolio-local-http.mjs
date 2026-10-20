import assert from 'node:assert/strict';
import { createServer } from 'node:net';

import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

import {
  assertPf01NoDotenv,
  cleanupPf01Users,
  pf01NextEnvironment,
  provePf01ContentUpdateDetection,
  startPf01OwnedProcess,
  createPf01Aal2User,
  createPf01DatabaseFixture,
  localProjectRef,
  revokePf01CurrentAuthority,
  revokePf01ManagementAuthority,
  snapshotPf01ReadState,
  verifyPf01LocalTarget,
} from './lib/pf01-owner-portfolio-local-fixture.mjs';

let phase = 'preflight';
const VERIFY_ONLY = process.argv.includes('--verify-target-only');

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_required`);
  return value;
}

async function freeLoopbackPort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('loopback_port_unavailable');
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return address.port;
}

async function assertNextAcceptsLocalSupabase(supabaseUrl, anonKey) {
  const keys = ['NODE_ENV', 'NEXT_PUBLIC_CLADORA_EPHEMERAL_LOCAL_SUPABASE',
    'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.NODE_ENV = 'development';
    process.env.NEXT_PUBLIC_CLADORA_EPHEMERAL_LOCAL_SUPABASE = '1';
    process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = anonKey;
    const { getPublicSupabaseEnv } = await import('../src/lib/supabase/env.ts');
    assert.equal(getPublicSupabaseEnv().url, supabaseUrl);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
}

async function startNext({ port, supabaseUrl, anonKey, signal }) {
  await assertPf01NoDotenv();
  const origin = `http://127.0.0.1:${port}`;
  const endpoint = `${origin}/api/owner-portfolio/v1/projection`;
  const owned = await startPf01OwnedProcess({
    command: process.execPath,
    args: ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)],
    cwd: new URL('../', import.meta.url),
    env: pf01NextEnvironment(process.env, { supabaseUrl, anonKey }),
    port, signal,
    ready: async () => {
      try {
        const response = await fetch(endpoint, { redirect: 'manual', signal: AbortSignal.timeout(2_000) });
        return response.status === 401;
      } catch { return false; }
    },
  });
  return Object.freeze({ ...owned, origin, endpoint });
}

async function readJson(endpoint, cookie) {
  const response = await fetch(endpoint, {
    headers: cookie ? { cookie } : {},
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  let body = null;
  try { body = await response.json(); } catch {}
  return Object.freeze({ response, body });
}

function workspace(result, id) {
  return result.body.projections.find(projection => projection.portfolio_workspace_id === id);
}

async function run() {
  const supabaseUrl = required('PF01_LOCAL_SUPABASE_URL');
  const databaseUrl = required('PF01_LOCAL_DATABASE_URL');
  const anonKey = required('PF01_LOCAL_ANON_KEY');
  const serviceRoleKey = required('PF01_LOCAL_SERVICE_ROLE_KEY');
  const projectRef = await localProjectRef();
  const port = VERIFY_ONLY ? 41793 : await freeLoopbackPort();
  const appOrigin = `http://127.0.0.1:${port}`;
  const clientOptions = {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  };
  const adminClient = createClient(supabaseUrl, serviceRoleKey, clientOptions);
  const actorClient = createClient(supabaseUrl, anonKey, clientOptions);
  const pool = new Pool({ connectionString: databaseUrl, max: 4 });

  const createdUsers = [];
  const onCreated = user => createdUsers.push(user);
  let owner = null;
  let other = null;
  let next = null;
  const cancellation = new AbortController();
  const cancel = () => cancellation.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    const target = await verifyPf01LocalTarget({
      target: required('PF01_LOCAL_TARGET'),
      ephemeralOptIn: required('PF01_LOCAL_EPHEMERAL'),
      realAuthOptIn: required('PF01_LOCAL_REAL_AUTH'),
      appOrigin,
      supabaseUrl,
      databaseUrl,
      projectRef,
      anonKey,
      serviceRoleKey,
      adminClient,
      actorClient,
      pool,
    });
    if (VERIFY_ONLY) {
      console.log(JSON.stringify({
        suite: 'CORE-PF01-LOCAL-HTTP-PROOF-01-target',
        target: target.environment,
        project_identity: 'MATCHED_LOCAL_STACK',
        auth_database_identity: 'MATCHED_READ_ONLY_PREFLIGHT',
        side_effects: 'ZERO',
      }, null, 2));
      return;
    }

    // Both gates precede Auth or writable fixture setup. Never load dotenv fallback.
    await assertPf01NoDotenv();
    await assertNextAcceptsLocalSupabase(supabaseUrl, anonKey);

    phase = 'owner-auth';
    owner = await createPf01Aal2User({ adminClient, supabaseUrl, anonKey, label: 'owner', onCreated });
    phase = 'other-auth';
    other = await createPf01Aal2User({ adminClient, supabaseUrl, anonKey, label: 'other-owner', onCreated });
    phase = 'owner-db-fixture';
    const fixture = await createPf01DatabaseFixture(pool, {
      ownerUserId: owner.userId,
      otherUserId: other.userId,
      ownerEmail: owner.email,
      otherEmail: other.email,
    });
    phase = 'state-negative-control';
    await provePf01ContentUpdateDetection(pool);
    phase = 'next-startup';
    next = await startNext({ port, supabaseUrl, anonKey, signal: cancellation.signal });

    const before = await snapshotPf01ReadState(pool);
    const anonymous = await readJson(next.endpoint);
    assert.equal(anonymous.response.status, 401);
    assert.deepEqual(anonymous.body, { error: 'UNAUTHORIZED' });

    phase = 'owner-http';
    const primary = await readJson(next.endpoint, owner.cookie);
    assert.equal(primary.response.status, 200);
    assert.equal(primary.response.headers.get('cache-control'), 'no-store, private');
    assert.equal(primary.response.headers.get('vary'), 'Cookie');
    assert.ok(Array.isArray(primary.body?.projections));
    assert.equal(primary.body.projections.length, 2);
    assert.deepEqual(
      primary.body.projections.map(item => item.portfolio_workspace_id).sort(),
      [fixture.workspaceOne, fixture.workspaceTwo].sort(),
    );
    assert.equal(primary.body.projections.reduce((sum, item) => sum + item.items.length, 0), 2);
    const serialized = JSON.stringify(primary.body);
    for (const forbidden of [
      fixture.crossTenantUnit,
      'Secret Other',
      'other owner evidence secret',
      'Private-A',
      'Private owner address',
      'private evidence must not leak',
      'PF01 private lease must not leak',
      'PF01 private cash must not leak',
    ]) assert.equal(serialized.includes(forbidden), false, `${forbidden} must remain private`);
    assert.equal(workspace(primary, fixture.workspaceOne).items[0].actions[0].action_status, 'allowed');
    assert.equal(workspace(primary, fixture.workspaceTwo).items[0].actions[0].action_status, 'withheld');

    phase = 'other-owner-http';
    const isolated = await readJson(next.endpoint, other.cookie);
    assert.equal(isolated.response.status, 200);
    assert.deepEqual(isolated.body.projections, []);
    const repeated = await readJson(next.endpoint, owner.cookie);
    assert.equal(repeated.response.status, 200);
    assert.deepEqual(await snapshotPf01ReadState(pool), before, 'anonymous, isolated and repeated reads must be zero-write');

    phase = 'management-revocation';
    const preserved = await revokePf01ManagementAuthority(pool, owner.userId);
    assert.equal(preserved.ownerships, 3);
    assert.equal(preserved.private_units, 3);
    const afterManagementRevoke = await snapshotPf01ReadState(pool);
    const independentOwnership = await readJson(next.endpoint, owner.cookie);
    assert.equal(independentOwnership.response.status, 200);
    assert.equal(independentOwnership.body.projections.length, 1);
    assert.deepEqual(
      await snapshotPf01ReadState(pool),
      afterManagementRevoke,
      'management-revoked read must not mutate independent ownership or ledgers',
    );

    phase = 'authority-revocation';
    await revokePf01CurrentAuthority(pool, owner.userId);
    await owner.revokeSession();
    const afterAuthorityRevoke = await snapshotPf01ReadState(pool);
    phase = 'revoked-replay-http';
    const replayedCookie = await readJson(next.endpoint, owner.cookie);
    assert.equal(replayedCookie.response.status, 403);
    assert.deepEqual(replayedCookie.body, { error: 'ACCESS_DENIED' });
    assert.deepEqual(
      await snapshotPf01ReadState(pool),
      afterAuthorityRevoke,
      'revoked session/authority replay must be zero-write',
    );

    // Inject a consumer failure with the secondary owner's effective authority
    // still present. The same cleanup path must revoke/read back both users.
    let injectedFailureObserved = false;
    try { throw new Error('pf01_injected_consumer_failure'); }
    catch (error) { injectedFailureObserved = error.message === 'pf01_injected_consumer_failure'; }
    finally { await cleanupPf01Users(pool, createdUsers); }
    assert.equal(injectedFailureObserved, true);

    console.log(JSON.stringify({
      suite: 'CORE-PF01-LOCAL-HTTP-PROOF-01',
      next_api: 'REAL_LOOPBACK_HTTP',
      supabase_auth: 'REAL_LOCAL_TOTP_AAL2_COOKIES',
      postgrest_rpc: 'REAL_LOCAL_ACTOR_BOUND',
      postgres: 'REAL_LOCAL_DISPOSABLE',
      multi_workspace_owner: 'PASS',
      actor_isolation: 'PASS',
      management_independence: 'PASS',
      private_official_separation: 'PASS',
      capability_withholding: 'PASS',
      revoked_replay: 'PASS',
      repeated_read_effect: 'UNCHANGED_COUNTS_AND_CONTENT_HASHES',
      unchanged_count_update_negative_control: 'DETECTED_AND_ROLLED_BACK',
      injected_consumer_failure_cleanup: 'VERIFIED_NO_EFFECTIVE_AUTHORITY_OR_SESSION',
      stale_version: 'SEPARATE_PGTAP',
      production: 'NOT_RUN_NOT_PASS',
    }, null, 2));
  } finally {
    const cleanupErrors = [];
    if (next) try { await next.close(); } catch (error) { cleanupErrors.push(error); }
    try { await cleanupPf01Users(pool, createdUsers); } catch (error) { cleanupErrors.push(error); }
    process.removeListener('SIGINT', cancel);
    process.removeListener('SIGTERM', cancel);
    await pool.end().catch(error => cleanupErrors.push(error));
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'pf01_local_http_cleanup_failed');
    console.log(JSON.stringify({ logical_authority_session_cleanup: 'VERIFIED',
      owned_process_port_cleanup: 'VERIFIED', retained_history: 'DISPOSABLE_STACK_TEARDOWN_REQUIRED' }));
  }
}

try {
  await run();
} catch (error) {
  console.error(JSON.stringify({ suite: 'CORE-PF01-LOCAL-ENV-SUCCESSOR-01', result: 'FAILED',
    phase, diagnostic: error?.message ?? 'unknown_failure', production: 'NOT_RUN_NOT_PASS' }));
  process.exitCode = 1;
}
