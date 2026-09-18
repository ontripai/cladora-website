#!/usr/bin/env node
/**
 * CLADORA WORKSPACE DELEGATIONS & FOUR-EYES APPROVALS — Real Multi-Connection PostgreSQL Concurrency Rehearsal
 * Package: CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.2
 *
 * Invariants & Guarantees:
 * - Real independent PostgreSQL connections (pg.Client). Zero simulated JavaScript locks.
 * - Connects strictly to local/ephemeral test databases (rejects remote/production hosts).
 * - Provable local ephemeral database: If connection is unreachable or remote, exits with non-zero exit code.
 * - Random unique fixture generation (crypto.randomUUID()): Every rehearsal execution uses freshly generated UUIDs.
 * - Unified Advisory Lock Namespace:
 *     hashtextextended('delegation_lock:' || p_delegation_id::text, 0)
 *     Shared between approve_workspace_delegation_v1 and revoke_workspace_delegation_v1.
 * - Concurrency Race 1: Concurrent Approve vs Approve
 *     C1 begins transaction, executes approve_workspace_delegation_v1 holding advisory lock;
 *     C2 begins transaction concurrently targeting same delegation with same expected lock_version;
 *     C2 blocks waiting on advisory lock held by C1;
 *     Observer verifies lock contention via pg_blocking_pids();
 *     C1 commits, updating delegation to active, lock_version to 6, and emitting dual audit events;
 *     C2 unblocks, observes lock_version mismatch, and is deterministically rejected with SQLSTATE 40001;
 *     Observer proves: exactly 1 approval record, exactly 1 active delegation, atomic dual audit.
 * - Concurrency Race 2: Concurrent Approve vs Revoke (Unified Lock Namespace Proof)
 *     C1 executes approve while C2 executes revoke targeting identical delegation_lock namespace;
 *     Observer proves real contention between approve and revoke;
 *     Winner commits, loser rejected with 40001 conflict.
 * - Concurrency Race 3: Success-Only Idempotent Replay
 *     Winner replays exact same call with original expected lock version;
 *     Returns stored response snapshot without 40001 conflict and with zero duplicate audit events.
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
  console.log('=== RUNNING WORKSPACE DELEGATIONS & APPROVALS CONCURRENCY REHEARSAL ===\n');

  let observer, c1, c2;
  try {
    observer = await createClient('Observer');
    c1 = await createClient('Connection 1');
    c2 = await createClient('Connection 2');
  } catch (connErr) {
    console.error(`[CRITICAL] Local ephemeral PostgreSQL database not reachable at ${LOCAL_DB_URL}: ${connErr.message}`);
    process.exit(1);
  }

  const F_TENANT = crypto.randomUUID();
  const F_WS = crypto.randomUUID();
  const F_PROP = crypto.randomUUID();

  const F_GRANTOR_USER = crypto.randomUUID();
  const F_GRANTOR_MEM = crypto.randomUUID();
  const F_GRANTOR_CTX = crypto.randomUUID();

  const F_GRANTEE_USER = crypto.randomUUID();
  const F_GRANTEE_MEM = crypto.randomUUID();

  const F_APPROVER1_USER = crypto.randomUUID();
  const F_APPROVER1_MEM = crypto.randomUUID();
  const F_APPROVER1_CTX = crypto.randomUUID();

  const F_APPROVER2_USER = crypto.randomUUID();
  const F_APPROVER2_MEM = crypto.randomUUID();
  const F_APPROVER2_CTX = crypto.randomUUID();

  const F_DEL_1 = crypto.randomUUID();
  const F_DEL_2 = crypto.randomUUID();

  const F_IDEM_WIN1 = `idem_app_win_${crypto.randomBytes(6).toString('hex')}`;
  const F_IDEM_LOSE1 = `idem_app_lose_${crypto.randomBytes(6).toString('hex')}`;

  const F_IDEM_WIN2 = `idem_app_win2_${crypto.randomBytes(6).toString('hex')}`;
  const F_IDEM_LOSE2 = `idem_rev_lose2_${crypto.randomBytes(6).toString('hex')}`;

  try {
    const pid1 = await getClientPid(c1);
    const pid2 = await getClientPid(c2);
    console.log(`[Setup] Connected independent clients to ephemeral DB: C1 (PID ${pid1}), C2 (PID ${pid2})`);
    console.log(`[Setup] Provisioning isolated delegation fixtures with fresh UUIDs (Tenant: ${F_TENANT})...`);

    // Provision fixtures
    await observer.query(`
      -- 1. Tenant & Customer Workspace
      INSERT INTO platform.tenants (id, legal_name, registration_number, status)
      VALUES ('${F_TENANT}', 'Ephemeral Concurrency Test Tenant', 'RO-DEL-EPH', 'active');

      INSERT INTO platform.customer_workspaces (id, tenant_id, workspace_type, commercial_owner, environment, lifecycle_status)
      VALUES ('${F_WS}', '${F_TENANT}', 'ASSOCIATION', 'Owner Ephemeral', 'PILOT', 'ACTIVE');

      -- 2. Property and Workspace Property Binding
      INSERT INTO portfolio.properties (id, tenant_id, type, name, status)
      VALUES ('${F_PROP}', '${F_TENANT}', 'condominium', 'Property Ephemeral Delegation', 'active');

      INSERT INTO platform.workspace_property_bindings (tenant_id, customer_workspace_id, property_id, status, binding_source, valid_from)
      VALUES ('${F_TENANT}', '${F_WS}', '${F_PROP}', 'active', 'platform_assignment', statement_timestamp() - interval '1 day');

      -- 3. Users
      INSERT INTO auth.users (id, email) VALUES
        ('${F_GRANTOR_USER}', 'grantor_${F_GRANTOR_USER}@test.local'),
        ('${F_GRANTEE_USER}', 'grantee_${F_GRANTEE_USER}@test.local'),
        ('${F_APPROVER1_USER}', 'approver1_${F_APPROVER1_USER}@test.local'),
        ('${F_APPROVER2_USER}', 'approver2_${F_APPROVER2_USER}@test.local');

      -- 4. Memberships & Context Grants
      INSERT INTO identity.memberships (id, tenant_id, user_id, role_id, status, starts_at, ends_at) VALUES
        ('${F_GRANTOR_MEM}', '${F_TENANT}', '${F_GRANTOR_USER}', (SELECT id FROM identity.roles WHERE code = 'property_manager' AND tenant_id IS NULL AND is_system = true LIMIT 1), 'active', statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days'),
        ('${F_GRANTEE_MEM}', '${F_TENANT}', '${F_GRANTEE_USER}', (SELECT id FROM identity.roles WHERE code = 'owner' AND tenant_id IS NULL AND is_system = true LIMIT 1), 'active', statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days'),
        ('${F_APPROVER1_MEM}', '${F_TENANT}', '${F_APPROVER1_USER}', (SELECT id FROM identity.roles WHERE code = 'president' AND tenant_id IS NULL AND is_system = true LIMIT 1), 'active', statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days'),
        ('${F_APPROVER2_MEM}', '${F_TENANT}', '${F_APPROVER2_USER}', (SELECT id FROM identity.roles WHERE code = 'association_admin' AND tenant_id IS NULL AND is_system = true LIMIT 1), 'active', statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days');

      INSERT INTO identity.context_grants (id, tenant_id, membership_id, scope_type, property_id, starts_at, ends_at) VALUES
        ('${F_GRANTOR_CTX}', '${F_TENANT}', '${F_GRANTOR_MEM}', 'property', '${F_PROP}', statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days'),
        ('${F_APPROVER1_CTX}', '${F_TENANT}', '${F_APPROVER1_MEM}', 'property', '${F_PROP}', statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days'),
        ('${F_APPROVER2_CTX}', '${F_TENANT}', '${F_APPROVER2_MEM}', 'property', '${F_PROP}', statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days');

      -- 5. Taxonomy Assignment
      INSERT INTO platform.workspace_taxonomy_assignments (
        tenant_id, customer_workspace_id, property_profile_id, operating_model_id, status, valid_from, created_by, country_code
      ) VALUES (
        '${F_TENANT}', '${F_WS}',
        (SELECT id FROM platform.property_profiles WHERE code = 'residential_condominium' AND version = 1 LIMIT 1),
        (SELECT id FROM platform.operating_models WHERE code = 'association_managed' AND version = 1 LIMIT 1),
        'active', statement_timestamp() - interval '1 day', '${F_GRANTOR_USER}', 'RO'
      );

      -- 6. Modules & Entitlements
      INSERT INTO platform.workspace_modules (tenant_id, customer_workspace_id, module_definition_id, module_code, status, reason)
      SELECT '${F_TENANT}', '${F_WS}', id, code, 'active', 'Concurrency rehearsal activation'
      FROM platform.module_definitions WHERE code IN ('maintenance', 'billing');

      INSERT INTO platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from)
      VALUES
        ('${F_WS}', 'module.maintenance', 'boolean', true, statement_timestamp() - interval '1 day'),
        ('${F_WS}', 'module.billing', 'boolean', true, statement_timestamp() - interval '1 day');

      -- 7. Seed Delegation 1 in pending_approval state (lock_version = 5)
      INSERT INTO platform.workspace_delegations (
        id, delegation_code, tenant_id, customer_workspace_id,
        grantor_membership_id, grantor_user_id, grantee_membership_id, grantee_user_id,
        scope_type, property_id, lifecycle_status, delegation_depth,
        purpose, valid_from, valid_until, lock_version,
        approval_policy_code, required_approval_count, payload_hash,
        submitted_at, accepted_at
      ) VALUES (
        '${F_DEL_1}', 'DEL-CONCUR-1', '${F_TENANT}', '${F_WS}',
        '${F_GRANTOR_MEM}', '${F_GRANTOR_USER}', '${F_GRANTEE_MEM}', '${F_GRANTEE_USER}',
        'property', '${F_PROP}', 'pending_approval', 0,
        'Concurrency Delegation 1',
        statement_timestamp() - interval '1 minute', statement_timestamp() + interval '5 days', 5,
        'single_manager', 1, 'dummy_hash_1',
        statement_timestamp() - interval '2 minutes', statement_timestamp() - interval '1 minute'
      );

      INSERT INTO platform.workspace_delegation_permissions (
        delegation_id, module_definition_id, permission_id, module_permission_binding_id
      ) VALUES (
        '${F_DEL_1}',
        (SELECT id FROM platform.module_definitions WHERE code = 'maintenance' LIMIT 1),
        (SELECT id FROM identity.permissions WHERE code = 'maintenance.requests.manage' LIMIT 1),
        (SELECT id FROM platform.module_permission_bindings WHERE module_definition_id = (SELECT id FROM platform.module_definitions WHERE code = 'maintenance' LIMIT 1) AND permission_id = (SELECT id FROM identity.permissions WHERE code = 'maintenance.requests.manage' LIMIT 1) AND binding_version = 2 LIMIT 1)
      );

      UPDATE platform.workspace_delegations
      SET payload_hash = app_private.compute_delegation_payload_hash_v1('${F_DEL_1}')
      WHERE id = '${F_DEL_1}';

      -- 8. Seed Delegation 2 in pending_approval state (lock_version = 5)
      INSERT INTO platform.workspace_delegations (
        id, delegation_code, tenant_id, customer_workspace_id,
        grantor_membership_id, grantor_user_id, grantee_membership_id, grantee_user_id,
        scope_type, property_id, lifecycle_status, delegation_depth,
        purpose, valid_from, valid_until, lock_version,
        approval_policy_code, required_approval_count, payload_hash,
        submitted_at, accepted_at
      ) VALUES (
        '${F_DEL_2}', 'DEL-CONCUR-2', '${F_TENANT}', '${F_WS}',
        '${F_GRANTOR_MEM}', '${F_GRANTOR_USER}', '${F_GRANTEE_MEM}', '${F_GRANTEE_USER}',
        'property', '${F_PROP}', 'pending_approval', 0,
        'Concurrency Delegation 2',
        statement_timestamp() - interval '1 minute', statement_timestamp() + interval '5 days', 5,
        'single_manager', 1, 'dummy_hash_2',
        statement_timestamp() - interval '2 minutes', statement_timestamp() - interval '1 minute'
      );

      INSERT INTO platform.workspace_delegation_permissions (
        delegation_id, module_definition_id, permission_id, module_permission_binding_id
      ) VALUES (
        '${F_DEL_2}',
        (SELECT id FROM platform.module_definitions WHERE code = 'maintenance' LIMIT 1),
        (SELECT id FROM identity.permissions WHERE code = 'maintenance.requests.manage' LIMIT 1),
        (SELECT id FROM platform.module_permission_bindings WHERE module_definition_id = (SELECT id FROM platform.module_definitions WHERE code = 'maintenance' LIMIT 1) AND permission_id = (SELECT id FROM identity.permissions WHERE code = 'maintenance.requests.manage' LIMIT 1) AND binding_version = 2 LIMIT 1)
      );

      UPDATE platform.workspace_delegations
      SET payload_hash = app_private.compute_delegation_payload_hash_v1('${F_DEL_2}')
      WHERE id = '${F_DEL_2}';
    `);
    console.log('  ✔ Fixtures and pending delegations seeded with authentic payload hashes.');

    // ------------------------------------------------------------------------
    // Race 1: Concurrent Approve vs Approve on Delegation 1
    // ------------------------------------------------------------------------
    console.log('\n[Race 1] Concurrent Approve vs Approve on Delegation 1...');

    await c1.query('BEGIN');
    await c1.query(`
      SET LOCAL role = 'authenticated';
      SET LOCAL request.jwt.claims = '{"sub":"${F_APPROVER1_USER}","role":"authenticated","aal":"aal2"}';
    `);

    const c1WinnerRes = await c1.query(`
      SELECT customer_api.approve_workspace_delegation_v1(
        '${F_APPROVER1_CTX}'::uuid,
        '${F_DEL_1}'::uuid,
        'approved',
        5,
        'Winner approval via C1',
        '${F_IDEM_WIN1}'
      ) as result
    `);
    const c1WinnerResult = c1WinnerRes.rows[0].result;
    assert.equal(c1WinnerResult.action, 'approve');
    assert.equal(c1WinnerResult.lifecycle_status, 'active');
    assert.equal(c1WinnerResult.lock_version, 6);
    console.log('  ✔ C1 executed approve_workspace_delegation_v1 inside open transaction holding delegation_lock.');

    // C2 starts concurrent transaction targeting same delegation with same expected lock_version 5
    await c2.query('BEGIN');
    await c2.query(`
      SET LOCAL role = 'authenticated';
      SET LOCAL request.jwt.claims = '{"sub":"${F_APPROVER2_USER}","role":"authenticated","aal":"aal2"}';
    `);

    let c2Resolved = false;
    let c2Error = null;
    const c2Promise = (async () => {
      try {
        await c2.query(`
          SELECT customer_api.approve_workspace_delegation_v1(
            '${F_APPROVER2_CTX}'::uuid,
            '${F_DEL_1}'::uuid,
            'approved',
            5,
            'Concurrent approval via C2',
            '${F_IDEM_LOSE1}'
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

    // Observer verifies contention on identical advisory lock
    const isContended = await waitForBlockingByPid(observer, pid2, pid1, 4000);
    assert.ok(isContended, `Observer verified C2 (PID ${pid2}) actively blocked by C1 (PID ${pid1}) on delegation_lock`);
    console.log('  ✔ Lock contention confirmed via pg_blocking_pids: C2 is actively blocked by C1.');

    // C1 commits
    await c1.query('COMMIT');
    console.log('  ✔ C1 committed transaction successfully.');

    // Wait for C2 to unblock
    await c2Promise;
    assert.ok(c2Resolved, 'C2 resolved after C1 commit');
    assert.ok(c2Error, 'C2 was rejected with concurrency conflict');
    assert.match(c2Error.message, /40001|workspace_delegation_expected_lock_version_conflict/, 'C2 failed with SQLSTATE 40001');
    console.log('  ✔ C2 unblocked and was deterministically rejected with SQLSTATE 40001 (lock version mismatch).');

    // Observer verifies single winner invariants
    const del1Res = await observer.query(`SELECT lifecycle_status, lock_version FROM platform.workspace_delegations WHERE id = '${F_DEL_1}'`);
    assert.equal(del1Res.rows[0].lifecycle_status, 'active');
    assert.equal(del1Res.rows[0].lock_version, 6);

    const app1Count = await observer.query(`SELECT count(*) as cnt FROM platform.workspace_delegation_approvals WHERE delegation_id = '${F_DEL_1}'`);
    assert.equal(Number(app1Count.rows[0].cnt), 1, 'Exactly 1 approval record created');

    const audit1App = await observer.query(`SELECT count(*) as cnt FROM audit.events WHERE entity_id = '${F_DEL_1}' AND action = 'WORKSPACE_DELEGATION_APPROVED'`);
    assert.equal(Number(audit1App.rows[0].cnt), 1, 'Exactly 1 WORKSPACE_DELEGATION_APPROVED audit event');

    const audit1Act = await observer.query(`SELECT count(*) as cnt FROM audit.events WHERE entity_id = '${F_DEL_1}' AND action = 'WORKSPACE_DELEGATION_ACTIVATED'`);
    assert.equal(Number(audit1Act.rows[0].cnt), 1, 'Exactly 1 WORKSPACE_DELEGATION_ACTIVATED audit event');

    console.log('  ✔ Confirmed exactly 1 active delegation, 1 approval record, and dual atomic audit events.');

    // ------------------------------------------------------------------------
    // Race 2: Concurrent Approve vs Revoke on Delegation 2 (Unified Lock Namespace Proof)
    // ------------------------------------------------------------------------
    console.log('\n[Race 2] Concurrent Approve vs Revoke on Delegation 2 (Unified Lock Namespace Proof)...');

    await c1.query('BEGIN');
    await c1.query(`
      SET LOCAL role = 'authenticated';
      SET LOCAL request.jwt.claims = '{"sub":"${F_APPROVER1_USER}","role":"authenticated","aal":"aal2"}';
    `);

    const c1Approve2Res = await c1.query(`
      SELECT customer_api.approve_workspace_delegation_v1(
        '${F_APPROVER1_CTX}'::uuid,
        '${F_DEL_2}'::uuid,
        'approved',
        5,
        'Winner approval on Del 2',
        '${F_IDEM_WIN2}'
      ) as result
    `);
    assert.equal(c1Approve2Res.rows[0].result.action, 'approve');
    console.log('  ✔ C1 executed approve_workspace_delegation_v1 on Delegation 2 holding lock.');

    // C2 attempts revoke targeting same delegation with same expected lock_version 5
    await c2.query('BEGIN');
    await c2.query(`
      SET LOCAL role = 'authenticated';
      SET LOCAL request.jwt.claims = '{"sub":"${F_GRANTOR_USER}","role":"authenticated","aal":"aal2"}';
    `);

    let c2RevokeResolved = false;
    let c2RevokeError = null;
    const c2RevokePromise = (async () => {
      try {
        await c2.query(`
          SELECT customer_api.revoke_workspace_delegation_v1(
            '${F_GRANTOR_CTX}'::uuid,
            '${F_DEL_2}'::uuid,
            5,
            'Concurrent grantor revoke attempt',
            '${F_IDEM_LOSE2}'
          ) as result
        `);
        await c2.query('COMMIT');
      } catch (err) {
        c2RevokeError = err;
        await c2.query('ROLLBACK').catch(() => {});
      } finally {
        c2RevokeResolved = true;
      }
    })();

    // Observer verifies contention on unified lock namespace between approve and revoke
    const isContendedRevoke = await waitForBlockingByPid(observer, pid2, pid1, 4000);
    assert.ok(isContendedRevoke, 'Observer verified revoke (PID 2) actively blocked by approve (PID 1) on unified delegation_lock');
    console.log('  ✔ Unified lock namespace confirmed: revoke is serialized behind approve.');

    await c1.query('COMMIT');
    console.log('  ✔ C1 committed approval transaction.');

    await c2RevokePromise;
    assert.ok(c2RevokeResolved, 'C2 revoke resolved after C1 commit');
    assert.ok(c2RevokeError, 'C2 revoke was rejected due to lock version conflict');
    assert.match(c2RevokeError.message, /40001|workspace_delegation_expected_lock_version_conflict/, 'C2 revoke failed with 40001');
    console.log('  ✔ C2 revoke unblocked and was deterministically rejected with SQLSTATE 40001.');

    // ------------------------------------------------------------------------
    // Race 3: Success-Only Idempotent Replay Verification
    // ------------------------------------------------------------------------
    console.log('\n[Race 3] Success-Only Idempotent Replay Verification...');

    await c1.query('BEGIN');
    await c1.query(`
      SET LOCAL role = 'authenticated';
      SET LOCAL request.jwt.claims = '{"sub":"${F_APPROVER1_USER}","role":"authenticated","aal":"aal2"}';
    `);

    const replayRes = await c1.query(`
      SELECT customer_api.approve_workspace_delegation_v1(
        '${F_APPROVER1_CTX}'::uuid,
        '${F_DEL_1}'::uuid,
        'approved',
        5,
        'Winner approval via C1',
        '${F_IDEM_WIN1}'
      ) as result
    `);
    await c1.query('COMMIT');

    assert.deepEqual(replayRes.rows[0].result, c1WinnerResult, 'Replay returns exact stored response snapshot without 40001');
    console.log('  ✔ Replay succeeded returning identical stored response snapshot without 40001 conflict.');

    // Proves zero duplicate audit records
    const auditReplayApp = await observer.query(`SELECT count(*) as cnt FROM audit.events WHERE entity_id = '${F_DEL_1}' AND action = 'WORKSPACE_DELEGATION_APPROVED'`);
    assert.equal(Number(auditReplayApp.rows[0].cnt), 1, 'Zero duplicate WORKSPACE_DELEGATION_APPROVED audit events');

    const auditReplayAct = await observer.query(`SELECT count(*) as cnt FROM audit.events WHERE entity_id = '${F_DEL_1}' AND action = 'WORKSPACE_DELEGATION_ACTIVATED'`);
    assert.equal(Number(auditReplayAct.rows[0].cnt), 1, 'Zero duplicate WORKSPACE_DELEGATION_ACTIVATED audit events');

    const idemCount = await observer.query(`SELECT count(*) as cnt FROM platform.workspace_delegation_idempotency WHERE tenant_id = '${F_TENANT}' AND idempotency_key = '${F_IDEM_WIN1}'`);
    assert.equal(Number(idemCount.rows[0].cnt), 1, 'Zero duplicate idempotency records');

    console.log('  ✔ Proved 0 duplicate audit events and 0 duplicate idempotency records on replay.');

  } finally {
    console.log('\n[Teardown] In ephemeral container, fixtures remain safely until container teardown (zero trigger bypass).');
    await observer.end().catch(() => {});
    await c1.end().catch(() => {});
    await c2.end().catch(() => {});
  }

  console.log('\n=== REAL RPC DELEGATION CONCURRENCY REHEARSAL PASSED SUCCESSFULLY ===');
}

run().catch((err) => {
  console.error('CONCURRENCY REHEARSAL FAILED:', err);
  process.exit(1);
});
