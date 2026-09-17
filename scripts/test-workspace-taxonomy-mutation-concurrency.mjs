#!/usr/bin/env node
/**
 * CLADORA WORKSPACE TAXONOMY MUTATION — Real Multi-Connection PostgreSQL Concurrency Rehearsal
 *
 * Invariants & Guarantees:
 * - Real independent PostgreSQL connections (pg.Client). Zero simulated JavaScript locks.
 * - Connects strictly to local/ephemeral test databases (rejects remote/production hosts).
 * - Multi-session concurrency race against target workspace:
 *     T1 begins transaction, acquires advisory transaction lock, executes assign_workspace_taxonomy_v1;
 *     T2 begins transaction concurrently targeting same workspace with expected_assignment_id = A0;
 *     T2 is blocked waiting on advisory transaction lock held by T1;
 *     Observer verifies lock contention via pg_blocking_pids() asserting blocker PID == pid1 and blocked PID == pid2;
 *     T1 result is awaited and asserted BEFORE T1 commits;
 *     T1 commits, creating assignment A1;
 *     T2 unblocks, observes current assignment is now A1 (mismatching expected A0),
 *     and is deterministically rejected with SQLSTATE 40001 and workspace_taxonomy_expected_assignment_conflict;
 *     Observer proves: exactly 1 active assignment, 1 superseded assignment, zero overlap, exactly 1 audit event,
 *     and exactly 1 idempotency record.
 * - Ephemeral database execution: Zero session_replication_role = replica.
 * - Fail-closed: Any database connection error, lock timeout, assertion failure, or PID mismatch causes non-zero exit code.
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

async function createClient(label) {
  validateDatabaseUrl(LOCAL_DB_URL);
  const client = new Client({
    connectionString: LOCAL_DB_URL,
    statement_timeout: 15000,
    connectionTimeoutMillis: 5000,
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
  let lastBlockers = [];
  while (Date.now() - start < timeoutMs) {
    const res = await observerClient.query(
      `SELECT unnest(pg_blocking_pids($1::int)) as blocker_pid`,
      [blockedPid]
    );
    lastBlockers = res.rows.map((r) => Number(r.blocker_pid));
    if (lastBlockers.includes(Number(expectedBlockerPid))) {
      return {
        blocked: true,
        blockerPid: Number(expectedBlockerPid),
        allBlockers: lastBlockers,
      };
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return {
    blocked: false,
    blockerPid: null,
    allBlockers: lastBlockers,
  };
}

async function run() {
  console.log('=== CLADORA WORKSPACE TAXONOMY MUTATION — REAL CONCURRENCY REHEARSAL ===\n');

  // Strict Fail-Closed Connection: Zero graceful skip on missing DB
  let observer;
  let c1;
  let c2;

  try {
    observer = await createClient('observer');
    c1 = await createClient('client-1');
    c2 = await createClient('client-2');
  } catch (err) {
    console.error('CRITICAL: Local ephemeral database connection failed:', err.message);
    process.exit(1);
  }

  try {
    const pid1 = await getClientPid(c1);
    const pid2 = await getClientPid(c2);
    const pidObs = await getClientPid(observer);
    console.log(`Connected 3 independent PostgreSQL sessions: Observer (PID: ${pidObs}), Client 1 (PID: ${pid1}), Client 2 (PID: ${pid2})`);

    // Setup synthetic fixtures
    const fixtureTenant = '99100000-0000-0000-0000-000000000001';
    const fixtureUser1 = '99000000-0000-0000-0000-000000000001';
    const fixtureUser2 = '99000000-0000-0000-0000-000000000002';
    const fixtureWs = '99400000-0000-0000-0000-000000000001';
    const fixtureProp = '99700000-0000-0000-0000-000000000001';
    const fixtureAddr = '99800000-0000-0000-0000-000000000001';
    const fixtureRole = '99300000-0000-0000-0000-000000000001';
    const fixtureMem1 = '99500000-0000-0000-0000-000000000001';
    const fixtureMem2 = '99500000-0000-0000-0000-000000000002';
    const fixtureGrant1 = '99600000-0000-0000-0000-000000000001';
    const fixtureGrant2 = '99600000-0000-0000-0000-000000000002';
    const initialAssignmentId = '99a00000-0000-0000-0000-000000000001';
    const idemKey1 = '99900000-0000-0000-0000-000000000001';
    const idemKey2 = '99900000-0000-0000-0000-000000000002';

    await observer.query('BEGIN');
    await observer.query(`
      INSERT INTO auth.users(id, email) VALUES
        ('${fixtureUser1}', 'c1@test.com'),
        ('${fixtureUser2}', 'c2@test.com')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO platform.tenants(id, legal_name, registration_number, status) VALUES
        ('${fixtureTenant}', 'Tenant Concurrency', 'RO-CONC-99', 'active')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO platform.customer_workspaces(id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment) VALUES
        ('${fixtureWs}', '${fixtureTenant}', 'ASSOCIATION', 'ACTIVE', 'Conc WS', 'PILOT')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO identity.roles(id, tenant_id, code, name) VALUES
        ('${fixtureRole}', '${fixtureTenant}', 'association_admin', 'Admin')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO identity.memberships(id, tenant_id, user_id, role_id, status) VALUES
        ('${fixtureMem1}', '${fixtureTenant}', '${fixtureUser1}', '${fixtureRole}', 'active'),
        ('${fixtureMem2}', '${fixtureTenant}', '${fixtureUser2}', '${fixtureRole}', 'active')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO portfolio.addresses(id, tenant_id, city, street, building_no) VALUES
        ('${fixtureAddr}', '${fixtureTenant}', 'Bucharest', 'Strada Conc', '1')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO portfolio.properties(id, tenant_id, type, name, address_id, status) VALUES
        ('${fixtureProp}', '${fixtureTenant}', 'condominium', 'Conc Prop', '${fixtureAddr}', 'active')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO platform.workspace_property_bindings(id, tenant_id, customer_workspace_id, property_id, status, binding_source, created_by) VALUES
        ('99b10000-0000-0000-0000-000000000001', '${fixtureTenant}', '${fixtureWs}', '${fixtureProp}', 'active', 'building_setup', '${fixtureUser1}')
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO identity.context_grants(id, membership_id, tenant_id, scope_type, property_id) VALUES
        ('${fixtureGrant1}', '${fixtureMem1}', '${fixtureTenant}', 'property', '${fixtureProp}'),
        ('${fixtureGrant2}', '${fixtureMem2}', '${fixtureTenant}', 'property', '${fixtureProp}')
      ON CONFLICT (id) DO NOTHING;

      -- Initial active assignment A0 with country_code RO
      INSERT INTO platform.workspace_taxonomy_assignments(id, tenant_id, customer_workspace_id, property_profile_id, operating_model_id, country_code, status, valid_from, created_by) VALUES
        ('${initialAssignmentId}', '${fixtureTenant}', '${fixtureWs}',
         (SELECT id FROM platform.property_profiles WHERE code='residential_condominium' AND version=1),
         (SELECT id FROM platform.operating_models WHERE code='association_managed' AND version=1),
         'RO', 'active', statement_timestamp() - interval '1 day', '${fixtureUser1}')
      ON CONFLICT (id) DO NOTHING;
    `);
    await observer.query('COMMIT');
    console.log('  ✔ Synthetic test fixtures and initial assignment A0 committed.');

    // -------------------------------------------------------------------------
    // Concurrency Rehearsal:
    // Client 1 transitions from A0 to third_party_managed
    // Client 2 concurrently attempts transition from A0 to developer_operated
    // -------------------------------------------------------------------------
    console.log('\n[Rehearsal] Client 1 begins transaction and executes mutation...');
    await c1.query('BEGIN');
    await c1.query("SET LOCAL role authenticated");
    await c1.query(`SELECT set_config('request.jwt.claims', '{"sub":"${fixtureUser1}","role":"authenticated","aal":"aal2"}', true)`);

    const c1Promise = c1.query(`
      SELECT customer_api.assign_workspace_taxonomy_v1(
        '${fixtureGrant1}',
        'residential_condominium',
        'third_party_managed',
        'RO',
        '${idemKey1}'::uuid,
        '${initialAssignmentId}'::uuid,
        'Client 1 winning transition'
      ) as res;
    `);

    // Give C1 a brief moment to acquire per-workspace advisory lock inside RPC
    await new Promise((r) => setTimeout(r, 200));

    console.log('Client 2 concurrently begins transaction and attempts mutation with expected assignment A0...');
    await c2.query('BEGIN');
    await c2.query("SET LOCAL role authenticated");
    await c2.query(`SELECT set_config('request.jwt.claims', '{"sub":"${fixtureUser2}","role":"authenticated","aal":"aal2"}', true)`);

    let c2Resolved = false;
    let c2Error = null;
    const c2Promise = c2.query(`
      SELECT customer_api.assign_workspace_taxonomy_v1(
        '${fixtureGrant2}',
        'residential_condominium',
        'developer_operated',
        'RO',
        '${idemKey2}'::uuid,
        '${initialAssignmentId}'::uuid,
        'Client 2 conflicting transition'
      ) as res;
    `).then(() => {
      c2Resolved = true;
    }).catch((err) => {
      c2Resolved = true;
      c2Error = err;
    });

    // Verify Client 2 is blocked by Client 1
    const blockInfo = await waitForBlockingByPid(observer, pid2, pid1, 5000);
    assert.equal(blockInfo.blocked, true, `Client 2 (PID ${pid2}) must be actively blocked by Client 1 (PID ${pid1})`);
    assert.equal(c2Resolved, false, 'Client 2 must remain blocked while Client 1 holds advisory transaction lock');
    console.log(`  ✔ Observer verified: Client 2 (PID ${pid2}) is blocked by Client 1 (PID ${pid1}) via pg_blocking_pids.`);

    // Explicitly await and assert Client 1 result BEFORE Client 1 commits
    const c1Result = await c1Promise;
    assert.ok(c1Result.rows[0]?.res, 'Client 1 must return successful mutation result before commit');
    assert.equal(c1Result.rows[0].res.operating_model_code, 'third_party_managed');
    assert.equal(c1Result.rows[0].res.country_code, 'RO');
    assert.equal(c1Result.rows[0].res.idempotent_replay, false);
    console.log('  ✔ Client 1 result successfully returned and asserted prior to commit.');

    // Client 1 commits
    await c1.query('COMMIT');
    console.log('Client 1 transaction COMMITTED.');

    // Wait for Client 2 to unblock and receive expected conflict error
    await c2Promise;
    try {
      await c2.query('ROLLBACK');
    } catch {
      // Transaction was aborted by error, ignore
    }

    assert.ok(c2Error !== null, 'Client 2 must be rejected with an error');
    assert.equal(c2Error.code, '40001', `Client 2 error code must be 40001 (got: ${c2Error.code})`);
    assert.match(
      c2Error.message,
      /workspace_taxonomy_expected_assignment_conflict/,
      'Client 2 must receive workspace_taxonomy_expected_assignment_conflict'
    );
    console.log('  ✔ Client 2 unblocked and was deterministically rejected with SQLSTATE 40001 workspace_taxonomy_expected_assignment_conflict.');

    // Verify Database State from Observer
    const state = await observer.query(`
      SELECT count(*) as total,
             count(*) FILTER (WHERE status = 'active') as active_count,
             count(*) FILTER (WHERE status = 'superseded') as superseded_count
      FROM platform.workspace_taxonomy_assignments
      WHERE customer_workspace_id = $1
    `, [fixtureWs]);

    assert.equal(parseInt(state.rows[0].active_count, 10), 1, 'Exactly 1 active assignment remains');
    assert.equal(parseInt(state.rows[0].superseded_count, 10), 1, 'Exactly 1 superseded assignment exists');

    // Verify Zero Time Overlap
    const overlapCheck = await observer.query(`
      SELECT count(*) as overlap_count
      FROM platform.workspace_taxonomy_assignments a
      JOIN platform.workspace_taxonomy_assignments b ON a.customer_workspace_id = b.customer_workspace_id AND a.id <> b.id
      WHERE a.customer_workspace_id = $1
        AND a.status = 'active' AND b.status = 'active'
    `, [fixtureWs]);
    assert.equal(parseInt(overlapCheck.rows[0].overlap_count, 10), 0, 'Zero overlapping active assignments');

    // Verify Exactly 1 Audit Event for this workspace transition
    const auditCheck = await observer.query(`
      SELECT count(*) as audit_count
      FROM audit.events
      WHERE tenant_id = $1 AND action = 'WORKSPACE_TAXONOMY_TRANSITIONED'
    `, [fixtureTenant]);
    assert.equal(parseInt(auditCheck.rows[0].audit_count, 10), 1, 'Exactly 1 WORKSPACE_TAXONOMY_TRANSITIONED audit event recorded');

    // Verify Exactly 1 Idempotency Record (Winner only)
    const idemCheck = await observer.query(`
      SELECT count(*) as idem_count
      FROM platform.workspace_taxonomy_idempotency
      WHERE customer_workspace_id = $1
    `, [fixtureWs]);
    assert.equal(parseInt(idemCheck.rows[0].idem_count, 10), 1, 'Exactly 1 idempotency record recorded (Client 1 winner)');

    console.log('  ✔ Database invariants verified: 1 winner, 1 active assignment, no overlap, 1 audit event, 1 idempotency record.');

    // Clean teardown: close all connections cleanly.
    // In accordance with instructions: Zero session_replication_role = replica is used.
    // Ephemeral database lifecycle handles container teardown.
    await c1.end();
    await c2.end();
    await observer.end();

    console.log('\n=======================================================');
    console.log('REAL CONCURRENCY REHEARSAL PASSED (DETERMINISTIC WINNER & LOSER)');
    console.log('=======================================================');
  } catch (err) {
    if (c1) await c1.end().catch(() => {});
    if (c2) await c2.end().catch(() => {});
    if (observer) await observer.end().catch(() => {});
    throw err;
  }
}

run().catch((err) => {
  console.error('Concurrency rehearsal fatal error:', err);
  process.exit(1);
});
