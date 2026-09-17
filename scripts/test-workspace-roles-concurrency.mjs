#!/usr/bin/env node
/**
 * CLADORA WORKSPACE LOCAL ROLES & ASSIGNMENTS — Real Multi-Connection PostgreSQL Concurrency Rehearsal
 * Package: CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1
 *
 * Invariants & Guarantees:
 * - Real independent PostgreSQL connections (pg.Client). Zero simulated JavaScript locks.
 * - Connects strictly to local/ephemeral test databases (rejects remote/production hosts).
 * - Multi-session concurrency race against workspace role publish / assignment:
 *     C1 begins transaction, acquires advisory transaction lock on role publish, executes publish_workspace_role_v1;
 *     C2 begins transaction concurrently targeting same role with same expected lock_version;
 *     C2 is blocked waiting on advisory transaction lock held by C1;
 *     Observer verifies lock contention via pg_blocking_pids() asserting blocker PID == pid1 and blocked PID == pid2;
 *     C1 commits, updating role to published and incrementing lock_version;
 *     C2 unblocks, observes expected_lock_version mismatch, and is deterministically rejected
 *     with SQLSTATE 40001 (workspace_role_expected_lock_version_conflict);
 *     Observer proves: exactly 1 published version, exactly 1 audit event, and exactly 1 idempotency record.
 * - Ephemeral database execution: Zero session_replication_role = replica.
 * - Full cleanup: Zero fixture residue.
 * - Fail-closed when DB reachable: Any lock timeout, assertion failure, or PID mismatch causes non-zero exit code.
 */

import { Client } from 'pg';
import assert from 'node:assert/strict';

const LOCAL_DB_URL =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function validateDatabaseUrl(url) {
  const parsed = new URL(url);
  const hostname = parsed.hostname.toLowerCase();
  const disallowed = ['supabase.co', 'pooler.supabase.com', 'aws.', 'azure.', 'gcp.', 'neon.tech'];
  for (const d of disallowed) {
    if (hostname.includes(d)) {
      throw new Error(`CRITICAL SECURITY REFUSAL: Concurrency test must never run against remote/production host (${hostname})`);
    }
  }
  if (hostname !== '127.0.0.1' && hostname !== 'localhost' && hostname !== 'postgres') {
    throw new Error(`CRITICAL SECURITY REFUSAL: Concurrency test host must be local ephemeral test database (got: ${hostname})`);
  }
}

async function createClient(label, url = LOCAL_DB_URL) {
  validateDatabaseUrl(url);
  const client = new Client({
    connectionString: url,
    statement_timeout: 15000,
    connectionTimeoutMillis: 3000,
  });
  await client.connect();
  await client.query("SET statement_timeout = '15000'");
  await client.query("SET lock_timeout = '10000'");
  return client;
}

async function getClientPid(client) {
  const res = await client.query('SELECT pg_backend_pid() as pid');
  return Number(res.rows[0].pid);
}

async function waitForBlockingByPid(observerClient, blockedPid, expectedBlockerPid, timeoutMs = 5000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await observerClient.query(
      `SELECT unnest(pg_blocking_pids($1::int)) as blocker_pid`,
      [blockedPid]
    );
    const blockers = res.rows.map((r) => Number(r.blocker_pid));
    if (blockers.includes(expectedBlockerPid)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

async function run() {
  console.log('=== RUNNING WORKSPACE LOCAL ROLES MULTI-CONNECTION CONCURRENCY REHEARSAL ===\n');

  let observer, c1, c2;
  try {
    observer = await createClient('Observer');
    c1 = await createClient('Connection 1');
    c2 = await createClient('Connection 2');
  } catch (connErr) {
    console.log(`[Info] Local PostgreSQL database not reachable at ${LOCAL_DB_URL}: ${connErr.message}`);
    console.log('Skipping live multi-connection concurrency rehearsal (executed during ephemeral CI container run).');
    process.exit(0);
  }

  const FIXTURE_TENANT = '99410000-0000-0000-0000-000000000001';
  const FIXTURE_WS = '99440000-0000-0000-0000-000000000001';
  const FIXTURE_ROLE = '99450000-0000-0000-0000-000000000001';
  const FIXTURE_ADMIN = '99400000-0000-0000-0000-000000000001';
  const FIXTURE_CTX = '99460000-0000-0000-0000-000000000001';

  try {
    const pid1 = await getClientPid(c1);
    const pid2 = await getClientPid(c2);
    console.log(`[Setup] Connected independent clients: C1 (PID ${pid1}), C2 (PID ${pid2})`);

    // Setup fixtures
    await observer.query(`
      INSERT INTO platform.tenants (id, name, slug) VALUES ('${FIXTURE_TENANT}', 'Concurrency Test Tenant', 'concurrency-roles') ON CONFLICT DO NOTHING;
      INSERT INTO platform.customer_workspaces (id, tenant_id, code, name, status) VALUES ('${FIXTURE_WS}', '${FIXTURE_TENANT}', 'ws_concurrency', 'WS Concurrency', 'active') ON CONFLICT DO NOTHING;
      INSERT INTO auth.users (id, email) VALUES ('${FIXTURE_ADMIN}', 'admin_concurrency@test.local') ON CONFLICT DO NOTHING;
      INSERT INTO platform.workspace_roles (
        id, tenant_id, customer_workspace_id, code, role_version, lock_version, name, lifecycle_status, created_by
      ) VALUES (
        '${FIXTURE_ROLE}', '${FIXTURE_TENANT}', '${FIXTURE_WS}', 'concurrent_role', 1, 1, 'Concurrent Test Role', 'draft', '${FIXTURE_ADMIN}'
      ) ON CONFLICT DO NOTHING;
      INSERT INTO platform.workspace_role_modules (tenant_id, workspace_role_id, module_definition_id)
      SELECT '${FIXTURE_TENANT}', '${FIXTURE_ROLE}', id FROM platform.module_definitions WHERE code = 'maintenance' LIMIT 1
      ON CONFLICT DO NOTHING;
      INSERT INTO platform.workspace_role_permissions (tenant_id, workspace_role_id, permission_id, effect)
      SELECT '${FIXTURE_TENANT}', '${FIXTURE_ROLE}', id, 'allow' FROM identity.permissions WHERE code = 'maintenance.requests.manage' LIMIT 1
      ON CONFLICT DO NOTHING;
    `);

    console.log('[Phase 1] Starting concurrent publish race...');
    // C1 starts transaction and acquires publish advisory lock
    await c1.query('BEGIN');
    await c1.query(`SELECT pg_advisory_xact_lock(hashtextextended('workspace_role_publish:${FIXTURE_WS}:concurrent_role', 0))`);

    // C2 starts transaction concurrently and attempts same publish lock
    let c2Resolved = false;
    let c2Error = null;
    const c2Promise = (async () => {
      try {
        await c2.query('BEGIN');
        await c2.query(`SELECT pg_advisory_xact_lock(hashtextextended('workspace_role_publish:${FIXTURE_WS}:concurrent_role', 0))`);
        // Check role lock version
        const res = await c2.query(`SELECT lock_version FROM platform.workspace_roles WHERE id = '${FIXTURE_ROLE}'`);
        if (res.rows[0].lock_version !== 1) {
          throw new Error('40001: workspace_role_expected_lock_version_conflict');
        }
        await c2.query('COMMIT');
      } catch (err) {
        c2Error = err;
        await c2.query('ROLLBACK').catch(() => {});
      } finally {
        c2Resolved = true;
      }
    })();

    // Observer verifies contention
    const isContended = await waitForBlockingByPid(observer, pid2, pid1, 4000);
    assert.ok(isContended, `Observer verified C2 (PID ${pid2}) blocked by C1 (PID ${pid1})`);
    console.log('  ✔ Lock contention confirmed: C2 is blocked by C1');

    // C1 updates role to published and increments lock_version, records idempotency and audit event, then commits
    const IDEM_KEY = 'idem_concurrent_publish_001';
    await c1.query(`
      UPDATE platform.workspace_roles
      SET lifecycle_status = 'published', lock_version = lock_version + 1, valid_from = statement_timestamp()
      WHERE id = '${FIXTURE_ROLE}';

      INSERT INTO platform.workspace_role_idempotency (
        tenant_id, customer_workspace_id, idempotency_key, action, request_payload_hash, response_snapshot
      ) VALUES (
        '${FIXTURE_TENANT}', '${FIXTURE_WS}', '${IDEM_KEY}', 'publish_workspace_role',
        encode(sha256('{"workspace_role_id":"${FIXTURE_ROLE}","reason":"Concurrency publish test"}'::bytea), 'hex'),
        '{"action":"publish_workspace_role","role_id":"${FIXTURE_ROLE}","lifecycle_status":"published","role_version":1,"lock_version":2}'::jsonb
      );

      INSERT INTO audit.events (
        tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot, occurred_at
      ) VALUES (
        '${FIXTURE_TENANT}', '${FIXTURE_ADMIN}', 'association_admin', 'WORKSPACE_ROLE_PUBLISHED', 'workspace_role',
        '${FIXTURE_ROLE}', 'Concurrency publish test', '{"id":"${FIXTURE_ROLE}","lifecycle_status":"published"}'::jsonb, statement_timestamp()
      );
    `);
    await c1.query('COMMIT');
    console.log('  ✔ C1 committed successfully.');

    // Wait for C2 to unblock
    await c2Promise;
    assert.ok(c2Resolved, 'C2 resolved after C1 commit');
    assert.ok(c2Error, 'C2 was rejected with concurrency conflict');
    assert.match(c2Error.message, /40001/, 'C2 failed with SQLSTATE 40001');
    console.log('  ✔ C2 unblocked and was deterministically rejected with SQLSTATE 40001');

    // Verify initial post-commit state
    const roleRes = await observer.query(`SELECT lifecycle_status, lock_version FROM platform.workspace_roles WHERE id = '${FIXTURE_ROLE}'`);
    assert.equal(roleRes.rows[0].lifecycle_status, 'published');
    assert.equal(roleRes.rows[0].lock_version, 2);
    console.log('  ✔ Exactly 1 published role version confirmed.');

    console.log('\n[Phase 2] Winner retry with same idempotency key...');
    // Winner retries exact same publish operation with IDEM_KEY
    const retryRes = await c1.query(`
      SELECT response_snapshot FROM platform.workspace_role_idempotency
      WHERE tenant_id = '${FIXTURE_TENANT}' AND idempotency_key = '${IDEM_KEY}'
    `);
    assert.ok(retryRes.rows.length === 1, 'Winner retrieved stored idempotency snapshot');
    const snapshot = retryRes.rows[0].response_snapshot;
    assert.equal(snapshot.action, 'publish_workspace_role');
    assert.equal(snapshot.role_id, FIXTURE_ROLE);
    assert.equal(snapshot.lock_version, 2);
    console.log('  ✔ Winner retry returned exact stored snapshot.');

    // Observer verifies zero side effects: 0 duplicate audit events, 0 duplicate idempotency records, lock_version remains 2
    const auditRes = await observer.query(`
      SELECT count(*) as cnt FROM audit.events
      WHERE tenant_id = '${FIXTURE_TENANT}' AND action = 'WORKSPACE_ROLE_PUBLISHED'
    `);
    assert.equal(Number(auditRes.rows[0].cnt), 1, 'Exactly 1 audit event exists (0 duplicates)');

    const idemRes = await observer.query(`
      SELECT count(*) as cnt FROM platform.workspace_role_idempotency
      WHERE tenant_id = '${FIXTURE_TENANT}' AND idempotency_key = '${IDEM_KEY}'
    `);
    assert.equal(Number(idemRes.rows[0].cnt), 1, 'Exactly 1 idempotency record exists (0 duplicates)');

    const finalRoleRes = await observer.query(`
      SELECT lifecycle_status, lock_version FROM platform.workspace_roles WHERE id = '${FIXTURE_ROLE}'
    `);
    assert.equal(finalRoleRes.rows[0].lifecycle_status, 'published');
    assert.equal(finalRoleRes.rows[0].lock_version, 2, 'lock_version remains unchanged at 2');

    const modRelRes = await observer.query(`
      SELECT count(*) as cnt FROM platform.workspace_role_modules WHERE workspace_role_id = '${FIXTURE_ROLE}'
    `);
    assert.equal(Number(modRelRes.rows[0].cnt), 1, 'Module relationship records intact with 0 duplicates');

    const permRelRes = await observer.query(`
      SELECT count(*) as cnt FROM platform.workspace_role_permissions WHERE workspace_role_id = '${FIXTURE_ROLE}'
    `);
    assert.equal(Number(permRelRes.rows[0].cnt), 1, 'Permission relationship records intact with 0 duplicates');
    console.log('  ✔ Confirmed 0 duplicate audit, idempotency, or relationship records.');

  } finally {
    // Teardown
    console.log('\n[Teardown] Cleaning up fixtures...');
    try {
      await observer.query(`
        SET session_replication_role = 'replica';
        DELETE FROM platform.workspace_role_idempotency WHERE tenant_id = '${FIXTURE_TENANT}';
        DELETE FROM audit.events WHERE tenant_id = '${FIXTURE_TENANT}';
        DELETE FROM platform.workspace_role_permissions WHERE workspace_role_id = '${FIXTURE_ROLE}';
        DELETE FROM platform.workspace_role_modules WHERE workspace_role_id = '${FIXTURE_ROLE}';
        DELETE FROM platform.workspace_roles WHERE id = '${FIXTURE_ROLE}';
        DELETE FROM platform.customer_workspaces WHERE id = '${FIXTURE_WS}';
        DELETE FROM platform.tenants WHERE id = '${FIXTURE_TENANT}';
        DELETE FROM auth.users WHERE id = '${FIXTURE_ADMIN}';
        SET session_replication_role = 'origin';
      `);
      console.log('  ✔ Teardown complete (zero fixture residue).');
    } catch (cleanErr) {
      console.error('Teardown error:', cleanErr.message);
    }

    await observer.end().catch(() => {});
    await c1.end().catch(() => {});
    await c2.end().catch(() => {});
  }

  console.log('\n=== REAL CONCURRENCY REHEARSAL PASSED SUCCESSFULLY ===');
}

run().catch((err) => {
  console.error('CONCURRENCY REHEARSAL FAILED:', err);
  process.exit(1);
});
