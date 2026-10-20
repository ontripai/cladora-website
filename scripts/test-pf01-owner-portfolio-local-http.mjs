import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

import {
  createPf01Aal2User,
  createPf01DatabaseFixture,
  localProjectRef,
  revokePf01CurrentAuthority,
  revokePf01ManagementAuthority,
  snapshotPf01ReadState,
  verifyPf01LocalTarget,
} from './lib/pf01-owner-portfolio-local-fixture.mjs';

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
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = supabaseUrl;
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = anonKey;
  try {
    const { getPublicSupabaseEnv } = await import('../src/lib/supabase/env.ts');
    const selected = getPublicSupabaseEnv();
    assert.equal(selected.url, supabaseUrl);
    assert.equal(selected.publishableKey, anonKey);
  } catch (cause) {
    if (String(cause?.message).includes('must be an HTTPS Supabase project URL')) {
      const error = new Error('next_local_supabase_url_policy_blocks_connected_proof', { cause });
      error.exitCode = 78;
      throw error;
    }
    throw cause;
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
}

async function startNext({ port, supabaseUrl, anonKey }) {
  const child = spawn(process.execPath, [
    'node_modules/next/dist/bin/next',
    'dev',
    '--hostname',
    '127.0.0.1',
    '--port',
    String(port),
  ], {
    cwd: new URL('../', import.meta.url),
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: anonKey,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const append = chunk => {
    output = `${output}${chunk}`.slice(-16_384);
  };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  const origin = `http://127.0.0.1:${port}`;
  const endpoint = `${origin}/api/owner-portfolio/v1/projection`;
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('next_server_exited_before_ready');
    try {
      const response = await fetch(endpoint, { redirect: 'manual', signal: AbortSignal.timeout(2_000) });
      if (response.status === 401) {
        return Object.freeze({
          origin,
          endpoint,
          async close() {
            if (child.exitCode !== null) return;
            child.kill('SIGTERM');
            await Promise.race([
              new Promise(resolve => child.once('exit', resolve)),
              new Promise(resolve => setTimeout(resolve, 10_000)),
            ]);
            if (child.exitCode === null) child.kill('SIGKILL');
          },
        });
      }
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(output.includes('must be an HTTPS Supabase project URL')
    ? 'next_local_supabase_url_policy_blocks_connected_proof'
    : 'next_server_readiness_timeout');
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

  let owner = null;
  let other = null;
  let next = null;
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

    // This check precedes Auth user creation and every writable PostgreSQL
    // fixture statement. The current baseline intentionally fails here because
    // its public environment contract rejects every loopback Supabase URL.
    await assertNextAcceptsLocalSupabase(supabaseUrl, anonKey);

    owner = await createPf01Aal2User({ adminClient, supabaseUrl, anonKey, label: 'owner' });
    other = await createPf01Aal2User({ adminClient, supabaseUrl, anonKey, label: 'other-owner' });
    const fixture = await createPf01DatabaseFixture(pool, {
      ownerUserId: owner.userId,
      otherUserId: other.userId,
      ownerEmail: owner.email,
      otherEmail: other.email,
    });
    next = await startNext({ port, supabaseUrl, anonKey });

    const anonymous = await readJson(next.endpoint);
    assert.equal(anonymous.response.status, 401);
    assert.deepEqual(anonymous.body, { error: 'UNAUTHORIZED' });

    const before = await snapshotPf01ReadState(pool);
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

    const isolated = await readJson(next.endpoint, other.cookie);
    assert.equal(isolated.response.status, 200);
    assert.deepEqual(isolated.body.projections, []);
    const repeated = await readJson(next.endpoint, owner.cookie);
    assert.equal(repeated.response.status, 200);
    assert.deepEqual(await snapshotPf01ReadState(pool), before, 'anonymous, isolated and repeated reads must be zero-write');

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

    await revokePf01CurrentAuthority(pool, owner.userId);
    await owner.revokeSession();
    const afterAuthorityRevoke = await snapshotPf01ReadState(pool);
    const replayedCookie = await readJson(next.endpoint, owner.cookie);
    assert.equal(replayedCookie.response.status, 403);
    assert.deepEqual(replayedCookie.body, { error: 'ACCESS_DENIED' });
    assert.deepEqual(
      await snapshotPf01ReadState(pool),
      afterAuthorityRevoke,
      'revoked session/authority replay must be zero-write',
    );

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
      repeated_read_effect: 'ZERO_WRITE',
      stale_version: 'SEPARATE_PGTAP',
      production: 'NOT_RUN_NOT_PASS',
    }, null, 2));
  } finally {
    const cleanupErrors = [];
    if (next) try { await next.close(); } catch (error) { cleanupErrors.push(error); }
    if (owner) try { await owner.cleanup(); } catch (error) { cleanupErrors.push(error); }
    if (other) try { await other.cleanup(); } catch (error) { cleanupErrors.push(error); }
    await pool.end().catch(error => cleanupErrors.push(error));
    if (cleanupErrors.length) throw new AggregateError(cleanupErrors, 'pf01_local_http_cleanup_failed');
  }
}

try {
  await run();
} catch (error) {
  if (error?.exitCode === 78 || error?.message === 'next_local_supabase_url_policy_blocks_connected_proof') {
    console.error(JSON.stringify({
      suite: 'CORE-PF01-LOCAL-HTTP-PROOF-01',
      result: 'BLOCKED',
      connected_http: 'NOT_RUN_NOT_PASS',
      blocker: 'NEXT_PUBLIC_SUPABASE_URL rejects the verified loopback local Supabase API before fixture side effects',
      required_successor: 'bounded local-only Supabase URL support in src/lib/supabase/env.ts',
      auth_database_mutations: 'ZERO',
      production: 'NOT_RUN_NOT_PASS',
    }, null, 2));
    process.exitCode = 78;
  } else {
    console.error(JSON.stringify({
      suite: 'CORE-PF01-LOCAL-HTTP-PROOF-01',
      result: 'FAILED',
      diagnostic: error?.message ?? 'unknown_failure',
      production: 'NOT_RUN_NOT_PASS',
    }));
    process.exitCode = 1;
  }
}
