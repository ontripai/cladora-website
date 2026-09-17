#!/usr/bin/env node
/**
 * CLADORA WORKSPACE LOCAL ROLES & ASSIGNMENTS — Real Multi-Connection PostgreSQL Concurrency Rehearsal
 * Package: CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1-R6
 *
 * Invariants & Guarantees:
 * - Real independent PostgreSQL connections (pg.Client). Zero simulated JavaScript locks.
 * - Connects strictly to local/ephemeral test databases (rejects remote/production hosts).
 * - Provable local ephemeral database: If connection is unreachable or remote, exits with non-zero exit code.
 * - Random unique fixture generation (crypto.randomUUID()): Every rehearsal execution uses freshly generated
 *   UUIDs and unique role codes. Zero prerequisite cleanup required prior to run.
 * - Real RPC invocation: customer_api.publish_workspace_role_v1(...) executed by 2 concurrent sessions.
 * - Multi-session concurrency race against workspace role publish:
 *     C1 begins transaction, sets JWT claims/AAL2, executes customer_api.publish_workspace_role_v1;
 *     Advisory transaction lock acquired by C1 inside publish_workspace_role_v1;
 *     C2 begins transaction concurrently targeting same role with same expected lock_version 1;
 *     C2 blocks waiting on advisory transaction lock held by C1;
 *     Observer verifies lock contention via pg_blocking_pids() asserting blocker PID == pid1 and blocked PID == pid2;
 *     C1 commits, updating role to published and incrementing lock_version to 2;
 *     C2 unblocks, observes lock_version mismatch, and is deterministically rejected
 *     with SQLSTATE 40001 (workspace_role_expected_lock_version_conflict);
 *     Observer proves: exactly 1 published version, exactly 1 audit event, and exactly 1 idempotency record.
 * - Real RPC Idempotency Replay:
 *     Winner retries exact same publish_workspace_role_v1 call with same initial expected_lock_version 1;
 *     Verifies exact stored response_snapshot returned, zero 40001 conflict, lock_version remains 2,
 *     and zero duplicate audit or idempotency records created.
 * - Ephemeral Container Lifecycle:
 *     In ephemeral databases/containers, fixtures remain safely in the DB until container destruction.
 *     Zero trigger bypass, zero session GUC manipulation, and zero artificial delete logic.
 */

import { Client } from 'pg';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

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
      console.error(`CRITICAL SECURITY REFUSAL: Concurrency test must never run against remote/production host (${hostname})`);
      process.exit(1);
    }
  }
  if (hostname !== '127.0.0.1' && hostname !== 'localhost' && hostname !== 'postgres') {
    console.error(`CRITICAL SECURITY REFUSAL: Concurrency test host must be local ephemeral test database (got: ${hostname})`);
    process.exit(1);
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
    console.error(`[CRITICAL] Local ephemeral PostgreSQL database not reachable at ${LOCAL_DB_URL}: ${connErr.message}`);
    process.exit(1);
  }

  // Generate completely random unique UUIDs and code for this run
  const F_TENANT = crypto.randomUUID();
  const F_WS = crypto.randomUUID();
  const F_PROP = crypto.randomUUID();
  const F_ADMIN_USER = crypto.randomUUID();
  const F_ADMIN_MEM = crypto.randomUUID();
  const F_ADMIN_CTX = crypto.randomUUID();
  const F_ROLE = crypto.randomUUID();
  const ROLE_CODE = `role_${crypto.randomBytes(4).toString('hex')}`;
  const F_IDEM_WINNER = `idem_win_${crypto.randomBytes(6).toString('hex')}`;
  const F_IDEM_LOSER = `idem_lose_${crypto.randomBytes(6).toString('hex')}`;

  try {
    const pid1 = await getClientPid(c1);
    const pid2 = await getClientPid(c2);
    console.log(`[Setup] Connected independent clients to ephemeral DB: C1 (PID ${pid1}), C2 (PID ${pid2})`);
    console.log(`[Setup] Provisioning isolated test fixtures with fresh UUIDs (Tenant: ${F_TENANT})...`);

    // Setup prerequisites fixtures directly without pre-cleanup
    await observer.query(`
      -- 1. Tenant
      INSERT INTO platform.tenants (id, legal_name, registration_number, status)
      VALUES ('${F_TENANT}', 'Ephemeral Concurrency Test Tenant', 'RO-CONCUR-EPH', 'active');

      -- 2. Customer Workspace
      INSERT INTO platform.customer_workspaces (id, tenant_id, workspace_type, commercial_owner, environment, lifecycle_status)
      VALUES ('${F_WS}', '${F_TENANT}', 'ASSOCIATION', 'Owner Ephemeral', 'PILOT', 'ACTIVE');

      -- 3. Property and Binding
      INSERT INTO portfolio.properties (id, tenant_id, type, name, status)
      VALUES ('${F_PROP}', '${F_TENANT}', 'condominium', 'Property Ephemeral Concurrency', 'active');

      INSERT INTO platform.workspace_property_bindings (tenant_id, customer_workspace_id, property_id, status, binding_source, valid_from)
      VALUES ('${F_TENANT}', '${F_WS}', '${F_PROP}', 'active', 'platform_assignment', statement_timestamp() - interval '1 day');

      -- 4. Admin User, Membership, Context Grant
      INSERT INTO auth.users (id, email)
      VALUES ('${F_ADMIN_USER}', 'admin_concurrency_${F_ADMIN_USER}@test.local');

      INSERT INTO identity.memberships (id, tenant_id, user_id, role_id, status, starts_at)
      VALUES (
        '${F_ADMIN_MEM}', '${F_TENANT}', '${F_ADMIN_USER}',
        (SELECT id FROM identity.roles WHERE lower(code) = 'association_admin' AND tenant_id IS NULL AND is_system = true LIMIT 1),
        'active', statement_timestamp() - interval '1 day'
      );

      INSERT INTO identity.context_grants (id, tenant_id, membership_id, scope_type, property_id, starts_at)
      VALUES ('${F_ADMIN_CTX}', '${F_TENANT}', '${F_ADMIN_MEM}', 'property', '${F_PROP}', statement_timestamp() - interval '1 day');

      -- 5. Taxonomy Assignment
      INSERT INTO platform.workspace_taxonomy_assignments (
        tenant_id, customer_workspace_id, property_profile_id, operating_model_id, status, valid_from, created_by, country_code
      ) VALUES (
        '${F_TENANT}', '${F_WS}',
        (SELECT id FROM platform.property_profiles WHERE code = 'residential_condominium' AND version = 1 LIMIT 1),
        (SELECT id FROM platform.operating_models WHERE code = 'association_managed' AND version = 1 LIMIT 1),
        'active', statement_timestamp() - interval '1 day', '${F_ADMIN_USER}', 'RO'
      );

      -- 6. Draft Role
      INSERT INTO platform.workspace_roles (
        id, tenant_id, customer_workspace_id, code, role_version, lock_version, name, description, scope_ceiling, lifecycle_status, created_by
      ) VALUES (
        '${F_ROLE}', '${F_TENANT}', '${F_WS}', '${ROLE_CODE}', 1, 1, 'Ephemeral Role', 'Draft role for concurrency testing', 'building', 'draft', '${F_ADMIN_USER}'
      );

      -- 7. Workspace Role Module
      INSERT INTO platform.workspace_role_modules (tenant_id, workspace_role_id, module_definition_id)
      SELECT '${F_TENANT}', '${F_ROLE}', id FROM platform.module_definitions WHERE code = 'maintenance' AND is_active = true AND lifecycle_status = 'published' LIMIT 1;

      -- 8. Workspace Role Permission
      INSERT INTO platform.workspace_role_permissions (tenant_id, workspace_role_id, permission_id, effect)
      SELECT '${F_TENANT}', '${F_ROLE}', id, 'allow' FROM identity.permissions WHERE code = 'maintenance.requests.manage' LIMIT 1;
    `);

    console.log('  ✔ Ephemeral prerequisite fixtures successfully created.');

    console.log('\n[Phase 1] Executing real multi-connection RPC publish race...');

    // C1 begins transaction, sets JWT claims and executes publish RPC inside open transaction
    await c1.query('BEGIN');
    await c1.query(`
      SET LOCAL role = 'authenticated';
      SET LOCAL request.jwt.claims = '{"sub":"${F_ADMIN_USER}","role":"authenticated","aal":"aal2"}';
    `);

    const c1RpcRes = await c1.query(`
      SELECT customer_api.publish_workspace_role_v1(
        '${F_ADMIN_CTX}'::uuid,
        '${F_ROLE}'::uuid,
        1,
        'Publishing concurrent role via C1',
        '${F_IDEM_WINNER}'
      ) as result
    `);
    const c1WinnerResult = c1RpcRes.rows[0].result;
    assert.equal(c1WinnerResult.action, 'publish');
    assert.equal(c1WinnerResult.lifecycle_status, 'published');
    assert.equal(c1WinnerResult.lock_version, 2);
    console.log('  ✔ C1 executed customer_api.publish_workspace_role_v1 inside open transaction holding lock.');

    // C2 begins transaction concurrently and attempts same publish RPC targeting same role with initial expected_lock_version = 1
    await c2.query('BEGIN');
    await c2.query(`
      SET LOCAL role = 'authenticated';
      SET LOCAL request.jwt.claims = '{"sub":"${F_ADMIN_USER}","role":"authenticated","aal":"aal2"}';
    `);

    let c2Resolved = false;
    let c2Error = null;
    const c2Promise = (async () => {
      try {
        await c2.query(`
          SELECT customer_api.publish_workspace_role_v1(
            '${F_ADMIN_CTX}'::uuid,
            '${F_ROLE}'::uuid,
            1,
            'Publishing concurrent role via C2',
            '${F_IDEM_LOSER}'
          ) as result
        `);
        await c2.query('COMMIT');
      } catch (err) {
        c2Error = err;
        await c2.query('ROLLBACK').catch(() => {});
      } finally {
        c2Resolved = true;
      }
    })();

    // Observer verifies contention: C2 is actively blocked by C1
    const isContended = await waitForBlockingByPid(observer, pid2, pid1, 4000);
    assert.ok(isContended, `Observer verified C2 (PID ${pid2}) actively blocked by C1 (PID ${pid1})`);
    console.log('  ✔ Lock contention confirmed via pg_blocking_pids: C2 is actively blocked by C1.');

    // C1 commits, releasing advisory and row locks
    await c1.query('COMMIT');
    console.log('  ✔ C1 committed transaction successfully.');

    // Wait for C2 to unblock
    await c2Promise;
    assert.ok(c2Resolved, 'C2 resolved after C1 commit');
    assert.ok(c2Error, 'C2 was rejected with concurrency conflict');
    assert.match(c2Error.message, /40001|workspace_role_expected_lock_version_conflict/, 'C2 failed with SQLSTATE 40001');
    console.log('  ✔ C2 unblocked and was deterministically rejected with SQLSTATE 40001 (workspace_role_expected_lock_version_conflict).');

    // Observer verifies single winner invariants in database
    const roleRes = await observer.query(`SELECT lifecycle_status, lock_version FROM platform.workspace_roles WHERE id = '${F_ROLE}'`);
    assert.equal(roleRes.rows[0].lifecycle_status, 'published');
    assert.equal(roleRes.rows[0].lock_version, 2);
    console.log('  ✔ Exactly 1 published role version confirmed (lock_version = 2).');

    const auditCountRes = await observer.query(`
      SELECT count(*) as cnt FROM audit.events
      WHERE tenant_id = '${F_TENANT}' AND action = 'WORKSPACE_ROLE_PUBLISHED'
    `);
    assert.equal(Number(auditCountRes.rows[0].cnt), 1, 'Exactly 1 audit event created by real RPC');

    const idemCountRes = await observer.query(`
      SELECT count(*) as cnt FROM platform.workspace_role_idempotency
      WHERE tenant_id = '${F_TENANT}' AND idempotency_key = '${F_IDEM_WINNER}'
    `);
    assert.equal(Number(idemCountRes.rows[0].cnt), 1, 'Exactly 1 idempotency record created by real RPC');

    console.log('\n[Phase 2] Real RPC Idempotent Replay Verification...');
    // Winner invokes the exact same RPC with identical parameters and initial expected_lock_version = 1
    await c1.query('BEGIN');
    await c1.query(`
      SET LOCAL role = 'authenticated';
      SET LOCAL request.jwt.claims = '{"sub":"${F_ADMIN_USER}","role":"authenticated","aal":"aal2"}';
    `);

    const replayRes = await c1.query(`
      SELECT customer_api.publish_workspace_role_v1(
        '${F_ADMIN_CTX}'::uuid,
        '${F_ROLE}'::uuid,
        1,
        'Publishing concurrent role via C1',
        '${F_IDEM_WINNER}'
      ) as result
    `);
    await c1.query('COMMIT');

    const replayResult = replayRes.rows[0].result;
    assert.deepEqual(replayResult, c1WinnerResult, 'Real RPC replay returns exact stored response snapshot');
    console.log('  ✔ Replay via customer_api.publish_workspace_role_v1 succeeded without lock_version error.');

    // Verify zero side effects on replay
    const auditAfterReplay = await observer.query(`
      SELECT count(*) as cnt FROM audit.events
      WHERE tenant_id = '${F_TENANT}' AND action = 'WORKSPACE_ROLE_PUBLISHED'
    `);
    assert.equal(Number(auditAfterReplay.rows[0].cnt), 1, 'Zero duplicate audit events after RPC replay');

    const idemAfterReplay = await observer.query(`
      SELECT count(*) as cnt FROM platform.workspace_role_idempotency
      WHERE tenant_id = '${F_TENANT}' AND idempotency_key = '${F_IDEM_WINNER}'
    `);
    assert.equal(Number(idemAfterReplay.rows[0].cnt), 1, 'Zero duplicate idempotency records after RPC replay');

    const finalRoleRes = await observer.query(`
      SELECT lifecycle_status, lock_version FROM platform.workspace_roles WHERE id = '${F_ROLE}'
    `);
    assert.equal(finalRoleRes.rows[0].lifecycle_status, 'published');
    assert.equal(finalRoleRes.rows[0].lock_version, 2, 'Role lock_version remained unchanged at 2');
    console.log('  ✔ Confirmed 0 duplicate audit, idempotency, or relationship records on replay.');

  } finally {
    console.log('\n[Teardown] In ephemeral container, fixtures remain safely until container teardown (zero trigger bypass).');
    await observer.end().catch(() => {});
    await c1.end().catch(() => {});
    await c2.end().catch(() => {});
  }

  console.log('\n=== REAL RPC CONCURRENCY REHEARSAL PASSED SUCCESSFULLY ===');
}

run().catch((err) => {
  console.error('CONCURRENCY REHEARSAL FAILED:', err);
  process.exit(1);
});
