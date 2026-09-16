#!/usr/bin/env node
/**
 * CLADORA WORKSPACE TAXONOMY — Real Multi-Connection PostgreSQL Concurrency Test
 *
 * Requirements:
 * - Real independent PostgreSQL connections (pg.Client). Zero simulated JavaScript locks.
 * - Connects strictly to local/temporary test databases (rejects production hosts).
 * - Implements 2 canonical multi-session concurrency scenarios:
 *     Scenario A: Taxonomy Version Race
 *       T1 holds advisory transaction lock for code; T2 attempts overlapping insert and waits;
 *       T1 commits; T2 unblocks and is rejected with workspace_taxonomy_version_effective_period_overlap (P0001);
 *       Exactly 1 active version exists.
 *     Scenario B: Workspace Property Binding Race
 *       T1 holds FOR UPDATE lock on property row; T2 attempts binding same property to another workspace and waits;
 *       T1 commits; T2 unblocks and is rejected with workspace_property_binding_overlap (P0001);
 *       Exactly 1 active binding exists for property.
 * - Observes real lock contention via pg_blocking_pids() checking the exact blocker PID from an independent observer client.
 * - Confirms wait condition via pg_locks.
 * - Cleans up all synthetic test data safely with verification.
 * - Fail-closed: Any database connection error, lock timeout, assertion failure, or PID mismatch causes non-zero exit code.
 */

import { Client } from 'pg';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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
    throw new Error(`CRITICAL SECURITY REFUSAL: Concurrency test host must be local test database (got: ${hostname})`);
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

async function collectLifecycleError(errors, label, action) {
  try {
    await action();
  } catch (error) {
    errors.push({ label, error });
  }
}

// -----------------------------------------------------------------------------
// SCENARIO A: Taxonomy Version Race
// -----------------------------------------------------------------------------
const SYNTH_CODE_A = 'conc_space_kind_race_001';

async function runScenarioA(conA, conB, conObs) {
  console.log('\n[Scenario A] Taxonomy Version Race — Per-Code Transactional Advisory Lock');
  console.log(`  Target code: ${SYNTH_CODE_A}`);

  const pidA = await getClientPid(conA);
  const pidB = await getClientPid(conB);

  console.log(`  -> Connection T1 (Winner Session): pid ${pidA}`);
  console.log(`  -> Connection T2 (Competitor Session): pid ${pidB}`);

  // Pre-cleanup in case of previous aborted runs
  await conObs.query(`DELETE FROM platform.space_kinds WHERE code = $1`, [SYNTH_CODE_A]);

  // 1. T1 begins transaction and inserts current active version
  console.log('  1. T1 begins transaction and inserts active space kind version 1...');
  await conA.query('BEGIN');
  await conA.query(
    `INSERT INTO platform.space_kinds (code, version, name, labels_json, is_active, lifecycle_status, valid_from)
     VALUES ($1, 1, 'Concurrency Test Space V1', '{"en":"Test Space V1","ro":"Spatiu Test V1","fa":"فضای آزمایشی نسخه ۱"}'::jsonb, true, 'active', statement_timestamp())`,
    [SYNTH_CODE_A]
  );
  console.log('     -> T1 successfully inserted row and acquired transactional advisory lock; remains uncommitted.');

  // 2. T2 attempts to insert an overlapping current active version for the same code
  console.log('  2. T2 attempts to insert overlapping active space kind version 2 concurrently...');
  let conBResolved = false;
  let conBError = null;

  const t2Promise = (async () => {
    try {
      await conB.query('BEGIN');
      await conB.query(
        `INSERT INTO platform.space_kinds (code, version, name, labels_json, is_active, lifecycle_status, valid_from)
         VALUES ($1, 2, 'Concurrency Test Space V2', '{"en":"Test Space V2","ro":"Spatiu Test V2","fa":"فضای آزمایشی نسخه ۲"}'::jsonb, true, 'active', statement_timestamp())`,
        [SYNTH_CODE_A]
      );
      await conB.query('COMMIT');
    } catch (err) {
      conBError = err;
      try {
        await conB.query('ROLLBACK');
      } catch (rollbackErr) {
        conBError = new AggregateError([err, rollbackErr], 'T2 rollback failed');
      }
    } finally {
      conBResolved = true;
    }
  })();

  // 3. Observer verifies T2 is actively blocked by T1 via pg_blocking_pids
  const blockCheck = await waitForBlockingByPid(conObs, pidB, pidA, 5000);
  if (!blockCheck.blocked) {
    if (conBResolved && conBError) {
      throw new Error(`Scenario A FAILED: T2 failed before blocking was observed: ${conBError.message}`);
    }
    throw new Error(`Scenario A FAILED: T2 (pid ${pidB}) was NOT blocked by T1 (pid ${pidA})! Blockers: [${blockCheck.allBlockers.join(', ')}]`);
  }
  console.log(`  3. ✓ Proven via pg_blocking_pids: T2 (pid ${pidB}) is waiting on T1 (pid ${pidA}).`);

  // Verify advisory lock contention in pg_locks
  const lockQuery = await conObs.query(
    `SELECT count(*)::int as waiting_count
     FROM pg_locks
     WHERE pid = $1 AND locktype = 'advisory' AND NOT granted`,
    [pidB]
  );
  assert.ok(lockQuery.rows[0].waiting_count >= 1, 'pg_locks must show T2 waiting for ungranted advisory lock');
  console.log(`     -> Verified via pg_locks: T2 has ungranted advisory lock request waiting on T1.`);

  // 4. T1 commits its transaction
  console.log('  4. T1 commits active version 1...');
  await conA.query('COMMIT');

  // 5. T2 should unblock and fail deterministically with workspace_taxonomy_version_effective_period_overlap
  await t2Promise;
  assert.ok(conBError, 'T2 must fail after unblocking');
  assert.equal(conBError.code, 'P0001', `T2 expected error code P0001, got ${conBError.code}`);
  assert.ok(
    conBError.message.includes('workspace_taxonomy_version_effective_period_overlap'),
    `T2 expected workspace_taxonomy_version_effective_period_overlap, got: ${conBError.message}`
  );
  console.log(`  5. ✓ T2 unblocked and failed deterministically with P0001: ${conBError.message}`);

  // 6. Prove exactly one current effective version exists
  const rowsRes = await conObs.query(
    `SELECT version, is_active, lifecycle_status
     FROM platform.space_kinds
     WHERE code = $1`,
    [SYNTH_CODE_A]
  );
  assert.equal(rowsRes.rowCount, 1, 'Exactly one space kind version must exist');
  assert.equal(rowsRes.rows[0].version, 1, 'Only version 1 (T1 winner) must be present');
  assert.equal(rowsRes.rows[0].is_active, true, 'Version 1 must be active');
  console.log('  6. ✓ Verified: Exactly 1 effective active version exists in platform.space_kinds.');

  // 7. Clean up synthetic space kind
  await conObs.query(`DELETE FROM platform.space_kinds WHERE code = $1`, [SYNTH_CODE_A]);
  const postCleanRes = await conObs.query(`SELECT count(*)::int as count FROM platform.space_kinds WHERE code = $1`, [SYNTH_CODE_A]);
  assert.equal(postCleanRes.rows[0].count, 0, 'Synthetic space kind rows must be completely cleaned up');
  console.log('  7. ✓ Cleaned up synthetic space kind records safely.');
  console.log('✓ Scenario A PASSED: Real multi-session version concurrency race validated.');
}

// -----------------------------------------------------------------------------
// SCENARIO B: Workspace/Property Binding Race
// -----------------------------------------------------------------------------
const F_TENANT = '88100000-0000-0000-0000-000000000001';
const F_USER = '88000000-0000-0000-0000-000000000001';
const F_WS_W1 = '88400000-0000-0000-0000-000000000001';
const F_WS_W2 = '88400000-0000-0000-0000-000000000002';
const F_ADDR_P = '88800000-0000-0000-0000-000000000001';
const F_PROP_P = '88700000-0000-0000-0000-000000000001';

async function setupScenarioBFixtures(client) {
  console.log('  -> Setting up committed synthetic prerequisites (Tenant, Workspaces, Property)...');
  await client.query('BEGIN');

  await client.query(
    `INSERT INTO auth.users (id, email)
     VALUES ($1, 'conc-binding-runner@cladora.test')
     ON CONFLICT (id) DO NOTHING`,
    [F_USER]
  );

  await client.query(
    `INSERT INTO platform.tenants (id, legal_name, registration_number, status)
     VALUES ($1, 'Concurrency Binding Test Tenant', 'RO-CONC-BIND-01', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [F_TENANT]
  );

  await client.query(
    `INSERT INTO platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment)
     VALUES
       ($1, $3, 'ASSOCIATION', 'ACTIVE', 'Alpha Residential Workspace', 'PILOT'),
       ($2, $3, 'PROPERTY_MANAGER', 'ACTIVE', 'Beta Commercial Workspace', 'PILOT')
     ON CONFLICT (id) DO NOTHING`,
    [F_WS_W1, F_WS_W2, F_TENANT]
  );

  await client.query(
    `INSERT INTO portfolio.addresses (id, tenant_id, city, street, building_no)
     VALUES ($1, $2, 'Bucharest', 'Strada Concurrency', '10')
     ON CONFLICT (id) DO NOTHING`,
    [F_ADDR_P, F_TENANT]
  );

  await client.query(
    `INSERT INTO portfolio.properties (id, tenant_id, type, name, address_id, status)
     VALUES ($1, $2, 'condominium', 'Property Concurrency P', $3, 'active')
     ON CONFLICT (id) DO NOTHING`,
    [F_PROP_P, F_TENANT, F_ADDR_P]
  );

  await client.query('COMMIT');
  console.log('     -> Prerequisites committed.');
}

async function cleanupScenarioBFixtures(client) {
  await client.query('SET session_replication_role = replica');
  await client.query(`DELETE FROM platform.workspace_property_bindings WHERE tenant_id = $1`, [F_TENANT]);
  await client.query(`DELETE FROM portfolio.properties WHERE tenant_id = $1`, [F_TENANT]);
  await client.query(`DELETE FROM portfolio.addresses WHERE tenant_id = $1`, [F_TENANT]);
  await client.query(`DELETE FROM platform.customer_workspaces WHERE tenant_id = $1`, [F_TENANT]);
  await client.query(`DELETE FROM platform.tenants WHERE id = $1`, [F_TENANT]);
  await client.query(`DELETE FROM auth.users WHERE id = $1`, [F_USER]);
  await client.query('SET session_replication_role = DEFAULT');
}

async function runScenarioB(conA, conB, conObs) {
  console.log('\n[Scenario B] Workspace/Property Binding Race — Property Row FOR UPDATE Lock');
  console.log(`  Target Property: ${F_PROP_P}`);
  console.log(`  Competitor Workspaces: W1 (${F_WS_W1}) vs W2 (${F_WS_W2})`);

  const pidA = await getClientPid(conA);
  const pidB = await getClientPid(conB);

  console.log(`  -> Connection T1 (W1 Binder): pid ${pidA}`);
  console.log(`  -> Connection T2 (W2 Binder): pid ${pidB}`);

  // Setup fixtures
  await setupScenarioBFixtures(conObs);

  // 1. T1 begins transaction and inserts binding for Property P -> Workspace W1
  console.log('  1. T1 begins transaction and binds Property P to Workspace W1...');
  await conA.query('BEGIN');
  await conA.query(
    `INSERT INTO platform.workspace_property_bindings (tenant_id, customer_workspace_id, property_id, status, binding_source, created_by)
     VALUES ($1, $2, $3, 'active', 'onboarding_activation', $4)`,
    [F_TENANT, F_WS_W1, F_PROP_P, F_USER]
  );
  console.log('     -> T1 acquired FOR UPDATE lock on Property row in portfolio.properties; remains uncommitted.');

  // 2. T2 attempts to bind the same Property P to Workspace W2 concurrently
  console.log('  2. T2 attempts to bind same Property P to Workspace W2 concurrently...');
  let conBResolved = false;
  let conBError = null;

  const t2Promise = (async () => {
    try {
      await conB.query('BEGIN');
      await conB.query(
        `INSERT INTO platform.workspace_property_bindings (tenant_id, customer_workspace_id, property_id, status, binding_source, created_by)
         VALUES ($1, $2, $3, 'active', 'onboarding_activation', $4)`,
        [F_TENANT, F_WS_W2, F_PROP_P, F_USER]
      );
      await conB.query('COMMIT');
    } catch (err) {
      conBError = err;
      try {
        await conB.query('ROLLBACK');
      } catch (rollbackErr) {
        conBError = new AggregateError([err, rollbackErr], 'T2 rollback failed');
      }
    } finally {
      conBResolved = true;
    }
  })();

  // 3. Observer verifies T2 is waiting on T1's Property row lock via pg_blocking_pids
  const blockCheck = await waitForBlockingByPid(conObs, pidB, pidA, 5000);
  if (!blockCheck.blocked) {
    if (conBResolved && conBError) {
      throw new Error(`Scenario B FAILED: T2 failed before blocking was observed: ${conBError.message}`);
    }
    throw new Error(`Scenario B FAILED: T2 (pid ${pidB}) was NOT blocked by T1 (pid ${pidA})! Blockers: [${blockCheck.allBlockers.join(', ')}]`);
  }
  console.log(`  3. ✓ Proven via pg_blocking_pids: T2 (pid ${pidB}) is waiting on Property row lock held by T1 (pid ${pidA}).`);

  // Verify tuple lock contention in pg_locks
  const lockQuery = await conObs.query(
    `SELECT count(*)::int as waiting_count
     FROM pg_locks
     WHERE pid = $1 AND NOT granted`,
    [pidB]
  );
  assert.ok(lockQuery.rows[0].waiting_count >= 1, 'pg_locks must show T2 waiting for ungranted row lock');
  console.log(`     -> Verified via pg_locks: T2 has ungranted lock request waiting on T1.`);

  // 4. T1 commits its binding transaction
  console.log('  4. T1 commits binding (Property P -> Workspace W1)...');
  await conA.query('COMMIT');

  // 5. T2 should unblock and fail deterministically with workspace_property_binding_overlap
  await t2Promise;
  assert.ok(conBError, 'T2 must fail after unblocking');
  assert.equal(conBError.code, 'P0001', `T2 expected error code P0001, got ${conBError.code}`);
  assert.ok(
    conBError.message.includes('workspace_property_binding_overlap'),
    `T2 expected workspace_property_binding_overlap, got: ${conBError.message}`
  );
  console.log(`  5. ✓ T2 unblocked and failed deterministically with P0001: ${conBError.message}`);

  // 6. Prove exactly one active binding exists for Property P, and winner is W1
  const bindingRes = await conObs.query(
    `SELECT customer_workspace_id, status
     FROM platform.workspace_property_bindings
     WHERE property_id = $1 AND status = 'active'`,
    [F_PROP_P]
  );
  assert.equal(bindingRes.rowCount, 1, 'Exactly one active binding must exist for Property P');
  assert.equal(bindingRes.rows[0].customer_workspace_id, F_WS_W1, 'Winning binding must be Workspace W1');
  console.log(`  6. ✓ Verified: Exactly 1 active binding exists for Property P, bound to winner Workspace W1 (${F_WS_W1}).`);

  // 7. Clean up all synthetic records
  console.log('  7. Cleaning up synthetic records...');
  await cleanupScenarioBFixtures(conObs);
  const remainingBindings = await conObs.query(
    `SELECT count(*)::int as count FROM platform.workspace_property_bindings WHERE tenant_id = $1`,
    [F_TENANT]
  );
  assert.equal(remainingBindings.rows[0].count, 0, 'All synthetic bindings must be cleaned up');
  console.log('     -> Verified: Zero residual synthetic rows.');
  console.log('✓ Scenario B PASSED: Real multi-session binding concurrency race validated.');
}

// -----------------------------------------------------------------------------
// MAIN RUNNER
// -----------------------------------------------------------------------------
async function main() {
  console.log('=== CLADORA — REAL MULTI-CONNECTION POSTGRESQL CONCURRENCY TEST ===');
  console.log(`Target database: ${LOCAL_DB_URL.replace(/:[^:@]+@/, ':***@')}`);

  const connectedClients = [];
  let mainError = null;

  try {
    const conA = await createClient('Connection T1');
    connectedClients.push(['Connection T1', conA]);

    const conB = await createClient('Connection T2');
    connectedClients.push(['Connection T2', conB]);

    const conObs = await createClient('Observer Connection');
    connectedClients.push(['Observer Connection', conObs]);

    console.log('✓ 3 independent PostgreSQL sessions established successfully.');

    // Pre-flight check: ensure Migration 100 tables exist
    const checkTables = await conObs.query(`
      SELECT to_regclass('platform.space_kinds') as sk,
             to_regclass('platform.workspace_property_bindings') as pb
    `);
    if (!checkTables.rows[0].sk || !checkTables.rows[0].pb) {
      throw new Error('Migration 100 tables (platform.space_kinds, platform.workspace_property_bindings) do not exist in target database');
    }
    console.log('✓ Migration 100 schema verified in target database.');

    await runScenarioA(conA, conB, conObs);
    await runScenarioB(conA, conB, conObs);
  } catch (err) {
    mainError = err;
    console.error('\n❌ CONCURRENCY TEST RUNNER FAILED:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    const lifecycleErrors = [];

    for (const [label, client] of connectedClients) {
      await collectLifecycleError(lifecycleErrors, `${label}: rollback`, () => client.query('ROLLBACK'));
      await collectLifecycleError(lifecycleErrors, `${label}: disconnect`, () => client.end());
    }

    if (lifecycleErrors.length > 0) {
      process.exitCode = 1;
      for (const { label, error } of lifecycleErrors) {
        console.error(`${label} cleanup error:`, error?.message ?? String(error));
      }
    }

    if (!mainError && lifecycleErrors.length === 0) {
      console.log('\n=============================================================================');
      console.log('🎉 ALL REAL POSTGRESQL MULTI-SESSION CONCURRENCY RACES PASSED WITH ZERO SIMULATIONS');
      console.log('=============================================================================\n');
    }
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error('Fatal runner error:', err);
    process.exit(1);
  });
}
