#!/usr/bin/env node
/**
 * CLADORA P1 — Real Multi-Connection Financial Close Concurrency Test Runner
 *
 * Requirements:
 * - Real independent PostgreSQL connections (pg.Client). Zero simulated JavaScript locks.
 * - Connects strictly to local/temporary test databases (rejects production hosts).
 * - Creates dedicated valid fixtures matching the authoritative database schema.
 * - Decouples Scenarios A, B, and C with independent properties & periods.
 * - Implements 3 canonical concurrency scenarios:
 *     Scenario A: Journal First (Writer holds SHARE lock on period, Close FOR UPDATE waits, commits with journal in snapshot)
 *     Scenario B: Close First (Closer holds FOR UPDATE lock on period, Journal INSERT waits, rejected on unblock with SQLSTATE 25000)
 *     Scenario C: Double Close (First close holds FOR UPDATE lock, second close waits, second rejected on unblock with SQLSTATE 40001)
 * - Observes real lock contention via pg_blocking_pids() checking the exact blocker PID from an independent observer client.
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

// Authoritative Fixture Constants
const F_TENANT = '99100000-0000-0000-0000-000000000001';
const F_USER = '99000000-0000-0000-0000-000000000001';
const F_ROLE = '99200000-0000-0000-0000-000000000001';
const F_MEMBERSHIP = '99300000-0000-0000-0000-000000000001';
const F_CONTEXT = '99400000-0000-0000-0000-000000000001';
const F_WORKSPACE = '99800000-0000-0000-0000-000000000001';

// Property & Account Fixtures for Scenario A (Decoupled)
const F_PROP_A = '99500000-0000-0000-0000-000000000001';
const F_ACC_BANK_A = '99a00000-0000-0000-0000-000000000001';
const F_ACC_REV_A = '99a00000-0000-0000-0000-000000000002';
const F_PERIOD_A = '99c00000-0000-0000-0000-000000000001'; // 2025-01
const F_JOURNAL_A = '99b00000-0000-0000-0000-000000000001';

// Property & Account Fixtures for Scenario B (Decoupled)
const F_PROP_B = '99500000-0000-0000-0000-000000000002';
const F_ACC_BANK_B = '99a00000-0000-0000-0000-000000000003';
const F_ACC_REV_B = '99a00000-0000-0000-0000-000000000004';
const F_PERIOD_B = '99c00000-0000-0000-0000-000000000002'; // 2025-01
const F_JOURNAL_B = '99b00000-0000-0000-0000-000000000002';

// Property & Account Fixtures for Scenario C (Decoupled)
const F_PROP_C = '99500000-0000-0000-0000-000000000003';
const F_ACC_BANK_C = '99a00000-0000-0000-0000-000000000005';
const F_ACC_REV_C = '99a00000-0000-0000-0000-000000000006';
const F_PERIOD_C = '99c00000-0000-0000-0000-000000000003'; // 2025-01

async function setupFixtures(client) {
  console.log('-> Setting up isolated test fixtures in PostgreSQL...');
  await client.query('BEGIN');

  // 1. User
  await client.query(`
    INSERT INTO auth.users (id, email)
    VALUES ('${F_USER}', 'concurrency-admin@cladora.test')
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email
  `);

  // 2. Tenant
  await client.query(`
    INSERT INTO platform.tenants (id, legal_name, registration_number, status)
    VALUES ('${F_TENANT}', 'Concurrency Test Tenant SA', 'RO-CONC-991', 'active')
    ON CONFLICT (id) DO UPDATE SET status = 'active'
  `);

  // 3. Properties (A, B, C)
  await client.query(`
    INSERT INTO portfolio.properties (id, tenant_id, type, name, status)
    VALUES
      ('${F_PROP_A}', '${F_TENANT}', 'condominium', 'Property Concurrency A', 'active'),
      ('${F_PROP_B}', '${F_TENANT}', 'condominium', 'Property Concurrency B', 'active'),
      ('${F_PROP_C}', '${F_TENANT}', 'condominium', 'Property Concurrency C', 'active')
    ON CONFLICT (id) DO UPDATE SET status = 'active'
  `);

  // 4. Role
  await client.query(`
    INSERT INTO identity.roles (id, tenant_id, code, name)
    VALUES ('${F_ROLE}', '${F_TENANT}', 'association_admin', 'Association Administrator')
    ON CONFLICT (id) DO UPDATE SET code = 'association_admin'
  `);

  // 5. Role Permissions
  await client.query(`
    INSERT INTO identity.role_permissions (role_id, permission_id, effect)
    SELECT '${F_ROLE}', p.id, 'allow'
    FROM identity.permissions p
    WHERE p.code IN ('finance.periods.read', 'finance.periods.close', 'finance.ledger.read', 'finance.reports.read')
    ON CONFLICT DO NOTHING
  `);

  // 6. Membership
  await client.query(`
    INSERT INTO identity.memberships (id, tenant_id, user_id, role_id, status, starts_at)
    VALUES ('${F_MEMBERSHIP}', '${F_TENANT}', '${F_USER}', '${F_ROLE}', 'active', statement_timestamp() - interval '1 day')
    ON CONFLICT (id) DO UPDATE SET status = 'active'
  `);

  // 7. Context Grant (Tenant-level association_admin)
  await client.query(`
    INSERT INTO identity.context_grants (id, membership_id, tenant_id, scope_type, property_id, starts_at)
    VALUES ('${F_CONTEXT}', '${F_MEMBERSHIP}', '${F_TENANT}', 'tenant', null, statement_timestamp() - interval '1 day')
    ON CONFLICT (id) DO NOTHING
  `);

  // 8. Customer Workspace & Entitlements
  await client.query(`
    INSERT INTO platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version)
    VALUES ('${F_WORKSPACE}', '${F_TENANT}', 'ASSOCIATION', 'ACTIVE', 'Concurrency Tester', 'PILOT', 1)
    ON CONFLICT (id) DO UPDATE SET lifecycle_status = 'ACTIVE'
  `);

  await client.query(`
    INSERT INTO platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value)
    VALUES ('${F_WORKSPACE}', 'module.accounting', 'boolean', true)
    ON CONFLICT (customer_workspace_id, entitlement_key) DO UPDATE SET boolean_value = true
  `);

  // 9. Chart of Accounts (Property A, B, C)
  await client.query(`
    INSERT INTO finance.accounts (id, tenant_id, property_id, code, name, type, currency)
    VALUES
      ('${F_ACC_BANK_A}', '${F_TENANT}', '${F_PROP_A}', '5121', 'Bank RON A', 'asset', 'RON'),
      ('${F_ACC_REV_A}', '${F_TENANT}', '${F_PROP_A}', '704', 'Revenue RON A', 'income', 'RON'),
      ('${F_ACC_BANK_B}', '${F_TENANT}', '${F_PROP_B}', '5121', 'Bank RON B', 'asset', 'RON'),
      ('${F_ACC_REV_B}', '${F_TENANT}', '${F_PROP_B}', '704', 'Revenue RON B', 'income', 'RON'),
      ('${F_ACC_BANK_C}', '${F_TENANT}', '${F_PROP_C}', '5121', 'Bank RON C', 'asset', 'RON'),
      ('${F_ACC_REV_C}', '${F_TENANT}', '${F_PROP_C}', '704', 'Revenue RON C', 'income', 'RON')
    ON CONFLICT (id) DO NOTHING
  `);

  // 10. Accounting Periods (Period A, B, C: past concluded dates 2025-01-01 to 2025-01-31)
  await client.query(`
    INSERT INTO finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status)
    VALUES
      ('${F_PERIOD_A}', '${F_TENANT}', '${F_PROP_A}', '2025-01-01', '2025-01-31', 'open'),
      ('${F_PERIOD_B}', '${F_TENANT}', '${F_PROP_B}', '2025-01-01', '2025-01-31', 'open'),
      ('${F_PERIOD_C}', '${F_TENANT}', '${F_PROP_C}', '2025-01-01', '2025-01-31', 'open')
    ON CONFLICT (id) DO UPDATE SET status = 'open'
  `);

  await client.query('COMMIT');
  console.log('✓ Isolated fixtures committed successfully.');
}

async function setAuthContext(client) {
  await client.query('SET LOCAL ROLE authenticated');
  await client.query(
    `SELECT set_config('request.jwt.claims', $1, true)`,
    [JSON.stringify({ sub: F_USER, role: 'authenticated', aal: 'aal2' })]
  );
}

async function getClientPid(client) {
  const res = await client.query('SELECT pg_backend_pid() as pid');
  return Number(res.rows[0].pid);
}

export async function waitForBlockingByPid(observerClient, blockedPid, expectedBlockerPid, timeoutMs = 5000) {
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

// -----------------------------------------------------------------------------
// SCENARIO A: Journal First
// -----------------------------------------------------------------------------
async function runScenarioA(conA, conB, conObs) {
  console.log('\n[Scenario A] Journal First — Writer holds SHARE lock on period, Close FOR UPDATE waits, commits with journal in snapshot');

  const pidA = await getClientPid(conA);
  const pidB = await getClientPid(conB);

  console.log(`  -> Connection A (Writer): pid ${pidA}`);
  console.log(`  -> Connection B (Close RPC): pid ${pidB}`);

  // 1. Connection A begins transaction, inserts balanced journal, and posts it in Period A
  await conA.query('BEGIN');
  await conA.query(`
    INSERT INTO finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status)
    VALUES ('${F_JOURNAL_A}', '${F_TENANT}', '${F_PROP_A}', '2025-01-15', 'RON', 'Scenario A journal', 'invoice', 'draft')
  `);
  await conA.query(`
    INSERT INTO finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo)
    VALUES
      ('${F_TENANT}', '${F_JOURNAL_A}', '${F_ACC_BANK_A}', 'debit', 450, 'Bank debit'),
      ('${F_TENANT}', '${F_JOURNAL_A}', '${F_ACC_REV_A}', 'credit', 450, 'Revenue credit')
  `);
  await conA.query(`
    UPDATE finance.journals
    SET status = 'posted', posted_at = statement_timestamp()
    WHERE id = '${F_JOURNAL_A}'
  `);

  console.log('  1. Con A inserted and posted journal in Period A (holds open transaction & FOR SHARE lock on Period A).');

  // 2. Connection B attempts to close Period A via real RPC
  console.log('  2. Con B launches finance.close_accounting_period concurrently...');
  let conBResolved = false;
  let conBError = null;

  const bPromise = (async () => {
    try {
      await conB.query('BEGIN');
      await setAuthContext(conB);
      await conB.query(`SELECT finance.close_accounting_period($1, $2, $3) as res`, [
        F_CONTEXT,
        F_PERIOD_A,
        'Closed by Scenario A',
      ]);
      await conB.query('COMMIT');
    } catch (err) {
      conBError = err;
      await conB.query('ROLLBACK').catch(() => {});
    } finally {
      conBResolved = true;
    }
  })();

  // 3. Observer verifies Con B is strictly blocked waiting for Con A
  const blockCheck = await waitForBlockingByPid(conObs, pidB, pidA, 5000);
  if (!blockCheck.blocked) {
    if (conBResolved && conBError) {
      throw new Error(`Scenario A FAILED: Con B failed before blocking could be observed: ${conBError.message}`);
    }
    throw new Error(`Scenario A FAILED: Con B (pid ${pidB}) was NOT blocked by Con A (pid ${pidA})! Blockers: [${blockCheck.allBlockers.join(', ')}]`);
  }
  console.log(`  3. ✓ Proven via pg_blocking_pids: Con B (pid ${pidB}) is strictly blocked waiting for Con A (pid ${pidA}).`);

  // 4. Con A commits journal transaction
  console.log('  4. Con A commits journal transaction...');
  await conA.query('COMMIT');

  // 5. Con B should unblock and complete close
  await bPromise;
  if (conBError) {
    throw new Error(`Scenario A FAILED: Con B threw error after unblocking: ${conBError.message}`);
  }
  console.log('  5. ✓ Con B unblocked, executed close_accounting_period, and committed.');

  // 6. Verify snapshot has Con A's journal totals (450 RON) and audit event exists
  const checkRes = await conObs.query(`
    SELECT status, snapshot_json
    FROM finance.accounting_periods
    WHERE id = '${F_PERIOD_A}'
  `);

  const periodRow = checkRes.rows[0];
  assert.equal(periodRow.status, 'closed', "Period A status must be 'closed'");

  const snapshot = periodRow.snapshot_json;
  assert.equal(snapshot?.version, 2, 'Snapshot must be Version 2');
  assert.equal(snapshot?.is_balanced, true, 'Snapshot must be balanced');

  const curSummary = snapshot.currency_summaries?.find((c) => c.currency === 'RON');
  assert(curSummary, 'Snapshot must contain RON currency summary');
  assert.equal(Number(curSummary.total_debit), 450, 'Snapshot debit must equal 450');
  assert.equal(Number(curSummary.total_credit), 450, 'Snapshot credit must equal 450');
  assert.equal(curSummary.is_balanced, true, 'Currency summary must be balanced');

  const auditRes = await conObs.query(`
    SELECT count(*) as count FROM audit.events
    WHERE entity_id = '${F_PERIOD_A}' AND action = 'ACCOUNTING_PERIOD_CLOSED'
  `);
  assert.equal(Number(auditRes.rows[0].count), 1, 'Exactly 1 close audit event must be recorded');

  console.log('✓ Scenario A PASSED: Real concurrency journal-first ordering validated.');
}

// -----------------------------------------------------------------------------
// SCENARIO B: Close First
// -----------------------------------------------------------------------------
async function runScenarioB(conA, conB, conObs) {
  console.log('\n[Scenario B] Close First — Closer holds FOR UPDATE lock on period, Journal INSERT waits, rejected on unblock with SQLSTATE 25000');

  const pidA = await getClientPid(conA);
  const pidB = await getClientPid(conB);

  console.log(`  -> Connection A (Close RPC): pid ${pidA}`);
  console.log(`  -> Connection B (Writer): pid ${pidB}`);

  // 1. Connection A begins transaction and runs close_accounting_period on Period B, holding open
  await conA.query('BEGIN');
  await setAuthContext(conA);
  await conA.query(`SELECT finance.close_accounting_period($1, $2, $3)`, [
    F_CONTEXT,
    F_PERIOD_B,
    'Closing in progress Scenario B',
  ]);
  console.log('  1. Con A executed close_accounting_period on Period B and holds transaction open.');

  // 2. Connection B attempts to insert journal into Period B concurrently
  console.log('  2. Con B attempts to insert journal into Period B concurrently...');
  let conBResolved = false;
  let conBError = null;

  const bPromise = (async () => {
    try {
      await conB.query('BEGIN');
      // Inserting draft journal invokes assert_scope_date_not_in_closed_period which attempts SELECT ... FOR SHARE on Period B
      await conB.query(`
        INSERT INTO finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status)
        VALUES ('${F_JOURNAL_B}', '${F_TENANT}', '${F_PROP_B}', '2025-01-15', 'RON', 'Illicit journal', 'invoice', 'draft')
      `);
      await conB.query(`
        INSERT INTO finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo)
        VALUES
          ('${F_TENANT}', '${F_JOURNAL_B}', '${F_ACC_BANK_B}', 'debit', 100, 'Bank debit'),
          ('${F_TENANT}', '${F_JOURNAL_B}', '${F_ACC_REV_B}', 'credit', 100, 'Revenue credit')
      `);
      await conB.query(`
        UPDATE finance.journals
        SET status = 'posted', posted_at = statement_timestamp()
        WHERE id = '${F_JOURNAL_B}'
      `);
      await conB.query('COMMIT');
    } catch (err) {
      conBError = err;
      await conB.query('ROLLBACK').catch(() => {});
    } finally {
      conBResolved = true;
    }
  })();

  // 3. Observer verifies Con B is blocked by Con A
  const blockCheck = await waitForBlockingByPid(conObs, pidB, pidA, 5000);
  if (!blockCheck.blocked) {
    if (conBResolved && conBError) {
      throw new Error(`Scenario B FAILED: Con B failed before blocking could be observed: ${conBError.message}`);
    }
    throw new Error(`Scenario B FAILED: Con B (pid ${pidB}) was NOT blocked by Con A (pid ${pidA})! Blockers: [${blockCheck.allBlockers.join(', ')}]`);
  }
  console.log(`  3. ✓ Proven via pg_blocking_pids: Con B (pid ${pidB}) is strictly blocked waiting for Con A (pid ${pidA}).`);

  // 4. Con A commits close transaction
  console.log('  4. Con A commits close transaction...');
  await conA.query('COMMIT');

  // 5. Con B should unblock and be rejected with SQLSTATE 25000
  await bPromise;
  assert(conBError, 'Scenario B FAILED: Con B succeeded inserting journal into closed period! Expected rejection.');

  console.log(`  5. ✓ Con B was rejected as expected with code '${conBError.code}': ${conBError.message}`);
  assert.equal(conBError.code, '25000', `Expected SQLSTATE 25000, got ${conBError.code}`);
  assert(
    conBError.message.includes('closed accounting period'),
    `Expected error message to mention closed accounting period, got: ${conBError.message}`
  );

  // 6. Verify illicit journal does not exist in DB and snapshot is valid
  const jCheck = await conObs.query(`SELECT count(*) as count FROM finance.journals WHERE id = '${F_JOURNAL_B}'`);
  assert.equal(Number(jCheck.rows[0].count), 0, 'Illicit journal must not exist in database');

  const pCheck = await conObs.query(`SELECT status, snapshot_json FROM finance.accounting_periods WHERE id = '${F_PERIOD_B}'`);
  assert.equal(pCheck.rows[0].status, 'closed', "Period B status must be 'closed'");
  assert.deepEqual(pCheck.rows[0].snapshot_json.currency_summaries, [], 'Period B snapshot must have empty currency summaries');

  const auditRes = await conObs.query(`
    SELECT count(*) as count FROM audit.events
    WHERE entity_id = '${F_PERIOD_B}' AND action = 'ACCOUNTING_PERIOD_CLOSED'
  `);
  assert.equal(Number(auditRes.rows[0].count), 1, 'Exactly 1 close audit event must be recorded for Period B');

  console.log('✓ Scenario B PASSED: Real concurrency close-first rejection validated.');
}

// -----------------------------------------------------------------------------
// SCENARIO C: Double Close
// -----------------------------------------------------------------------------
async function runScenarioC(conA, conB, conObs) {
  console.log('\n[Scenario C] Double Close — First close holds FOR UPDATE lock, second close waits, second rejected on unblock with SQLSTATE 40001');

  const pidA = await getClientPid(conA);
  const pidB = await getClientPid(conB);

  console.log(`  -> Connection A (Close 1): pid ${pidA}`);
  console.log(`  -> Connection B (Close 2): pid ${pidB}`);

  // 1. Connection A starts transaction and runs close_accounting_period on Period C, holding open
  await conA.query('BEGIN');
  await setAuthContext(conA);
  await conA.query(`SELECT finance.close_accounting_period($1, $2, $3)`, [
    F_CONTEXT,
    F_PERIOD_C,
    'Closing A in Scenario C',
  ]);
  console.log('  1. Con A executed close_accounting_period on Period C and holds transaction open.');

  // 2. Connection B calls close_accounting_period concurrently on the same period
  console.log('  2. Con B attempts close_accounting_period on Period C concurrently...');
  let conBResolved = false;
  let conBError = null;

  const bPromise = (async () => {
    try {
      await conB.query('BEGIN');
      await setAuthContext(conB);
      await conB.query(`SELECT finance.close_accounting_period($1, $2, $3)`, [
        F_CONTEXT,
        F_PERIOD_C,
        'Closing B in Scenario C',
      ]);
      await conB.query('COMMIT');
    } catch (err) {
      conBError = err;
      await conB.query('ROLLBACK').catch(() => {});
    } finally {
      conBResolved = true;
    }
  })();

  // 3. Observer verifies Con B is blocked by Con A
  const blockCheck = await waitForBlockingByPid(conObs, pidB, pidA, 5000);
  if (!blockCheck.blocked) {
    if (conBResolved && conBError) {
      throw new Error(`Scenario C FAILED: Con B failed before blocking could be observed: ${conBError.message}`);
    }
    throw new Error(`Scenario C FAILED: Con B (pid ${pidB}) was NOT blocked by Con A (pid ${pidA})! Blockers: [${blockCheck.allBlockers.join(', ')}]`);
  }
  console.log(`  3. ✓ Proven via pg_blocking_pids: Con B (pid ${pidB}) is strictly blocked waiting for Con A (pid ${pidA}).`);

  // 4. Con A commits
  console.log('  4. Con A commits close transaction...');
  await conA.query('COMMIT');

  // 5. Con B should unblock and fail with conflict (period_already_closed / SQLSTATE 40001)
  await bPromise;
  assert(conBError, 'Scenario C FAILED: Con B second close succeeded! Expected conflict rejection.');

  console.log(`  5. ✓ Con B was rejected with conflict as expected: code '${conBError.code}', message: ${conBError.message}`);
  assert.equal(conBError.code, '40001', `Expected SQLSTATE 40001 for double close conflict, got ${conBError.code}`);
  assert(
    conBError.message.includes('period_already_closed'),
    `Expected error message to mention period_already_closed, got: ${conBError.message}`
  );

  // 6. Verify exactly 1 close state and 1 audit event exists
  const pCheck = await conObs.query(`SELECT status, snapshot_json FROM finance.accounting_periods WHERE id = '${F_PERIOD_C}'`);
  assert.equal(pCheck.rows[0].status, 'closed', "Period C status must be 'closed'");

  const auditCheck = await conObs.query(`
    SELECT count(*) as count FROM audit.events
    WHERE entity_id = '${F_PERIOD_C}' AND action = 'ACCOUNTING_PERIOD_CLOSED'
  `);
  assert.equal(Number(auditCheck.rows[0].count), 1, 'Exactly 1 close audit event must be recorded for Period C');

  console.log('✓ Scenario C PASSED: Real concurrency double-close conflict validated.');
}

// -----------------------------------------------------------------------------
// MAIN ENTRY POINT & LIFECYCLE MANAGEMENT
// -----------------------------------------------------------------------------
async function main() {
  console.log('=== CLADORA P1 — REAL MULTI-CONNECTION CONCURRENCY RUNNER ===');
  console.log(`Connecting to local test database: ${LOCAL_DB_URL.replace(/:[^:@]+@/, ':***@')}`);

  let conA, conB, conObs;

  try {
    conA = await createClient('Connection A');
    conB = await createClient('Connection B');
    conObs = await createClient('Observer Connection');

    console.log('✓ 3 independent PostgreSQL connections established successfully.');

    await setupFixtures(conObs);

    await runScenarioA(conA, conB, conObs);
    await runScenarioB(conA, conB, conObs);
    await runScenarioC(conA, conB, conObs);

    console.log('\n=============================================================');
    console.log('🎉 ALL 3 REAL CONCURRENCY SCENARIOS PASSED WITH ZERO SIMULATIONS');
    console.log('=============================================================');
  } catch (err) {
    console.error('\n❌ CONCURRENCY TEST RUNNER FAILED:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    // Ensure all active transactions are rolled back before closing
    await conA?.query('ROLLBACK').catch(() => {});
    await conB?.query('ROLLBACK').catch(() => {});
    await conObs?.query('ROLLBACK').catch(() => {});

    await conA?.end().catch(() => {});
    await conB?.end().catch(() => {});
    await conObs?.end().catch(() => {});
  }
}
import { fileURLToPath } from 'node:url';
import path from 'node:path';

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error('Fatal runner error:', err);
    process.exit(1);
  });
}
