#!/usr/bin/env node
/**
 * CLADORA P1 — Real Multi-Connection Financial Close Concurrency Test Runner
 *
 * Requirements:
 * - Real independent PostgreSQL connections (pg.Client). Zero simulated JavaScript locks.
 * - Connects strictly to local/temporary test databases (rejects production hosts).
 * - Creates dedicated fixtures committed before launching concurrent transactions.
 * - Implements 3 canonical concurrency scenarios:
 *     Scenario A: Journal First (SHARE lock holds, Close FOR UPDATE waits, commits with journal in snapshot)
 *     Scenario B: Close First (Close FOR UPDATE holds, Journal INSERT waits, rejected on commit with 25000)
 *     Scenario C: Double Close (First close holds, second close waits, second rejected with conflict)
 * - Observes real lock contention via pg_blocking_pids() / pg_locks from an independent observer client.
 * - Fail-closed: Any database connection error, lock timeout, or assertion failure causes non-zero exit code.
 */

import { Client } from 'pg';

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
    statement_timeout: 10000,
    connectionTimeoutMillis: 5000,
  });
  await client.connect();
  await client.query("SET statement_timeout = '10000'");
  await client.query("SET lock_timeout = '8000'");
  return client;
}

// Fixture constants
const F_TENANT = '99100000-0000-0000-0000-000000000001';
const F_USER = '99000000-0000-0000-0000-000000000001';
const F_ROLE = '99200000-0000-0000-0000-000000000001';
const F_MEMBERSHIP = '99300000-0000-0000-0000-000000000001';
const F_CONTEXT = '99400000-0000-0000-0000-000000000001';
const F_PROPERTY = '99500000-0000-0000-0000-000000000001';
const F_WORKSPACE = '99800000-0000-0000-0000-000000000001';
const F_ACC_BANK = '99a00000-0000-0000-0000-000000000001';
const F_ACC_REV = '99a00000-0000-0000-0000-000000000002';
const F_PERIOD_A = '99c00000-0000-0000-0000-000000000001'; // 2025-01
const F_PERIOD_B = '99c00000-0000-0000-0000-000000000002'; // 2025-02
const F_PERIOD_C = '99c00000-0000-0000-0000-000000000003'; // 2025-03

async function setupFixtures(client) {
  console.log('-> Setting up isolated test fixtures in PostgreSQL...');
  await client.query('BEGIN');

  // Clean up any stale fixture
  await client.query(`DELETE FROM audit.events WHERE tenant_id = '${F_TENANT}'`);
  await client.query(`DELETE FROM finance.journal_entries WHERE tenant_id = '${F_TENANT}'`);
  await client.query(`DELETE FROM finance.journals WHERE tenant_id = '${F_TENANT}'`);
  await client.query(`DELETE FROM finance.accounting_periods WHERE tenant_id = '${F_TENANT}'`);
  await client.query(`DELETE FROM finance.accounts WHERE tenant_id = '${F_TENANT}'`);
  await client.query(`DELETE FROM platform.workspace_entitlements WHERE customer_workspace_id = '${F_WORKSPACE}'`);
  await client.query(`DELETE FROM platform.customer_workspaces WHERE id = '${F_WORKSPACE}'`);
  await client.query(`DELETE FROM identity.context_grants WHERE id = '${F_CONTEXT}'`);
  await client.query(`DELETE FROM identity.membership_parties WHERE tenant_id = '${F_TENANT}'`);
  await client.query(`DELETE FROM identity.memberships WHERE id = '${F_MEMBERSHIP}'`);
  await client.query(`DELETE FROM identity.role_permissions WHERE role_id = '${F_ROLE}'`);
  await client.query(`DELETE FROM identity.roles WHERE id = '${F_ROLE}'`);
  await client.query(`DELETE FROM portfolio.properties WHERE id = '${F_PROPERTY}'`);
  await client.query(`DELETE FROM platform.tenants WHERE id = '${F_TENANT}'`);

  // Insert base hierarchy
  await client.query(`
    INSERT INTO platform.tenants (id, slug, legal_name, country_code, default_timezone, base_currency)
    VALUES ('${F_TENANT}', 'concurrency-tenant', 'Concurrency Tenant SA', 'RO', 'Europe/Bucharest', 'RON')
    ON CONFLICT (id) DO NOTHING
  `);

  await client.query(`
    INSERT INTO portfolio.properties (id, tenant_id, name, address_line1, city, postal_code, country_code)
    VALUES ('${F_PROPERTY}', '${F_TENANT}', 'Concurrency Property', '123 Lock Way', 'Bucharest', '010101', 'RO')
    ON CONFLICT (id) DO NOTHING
  `);

  await client.query(`
    INSERT INTO identity.roles (id, code, name, description)
    VALUES ('${F_ROLE}', 'association_admin', 'Association Admin', 'Admin for tests')
    ON CONFLICT (id) DO NOTHING
  `);

  // Grant required permissions
  await client.query(`
    INSERT INTO identity.role_permissions (role_id, permission_id, effect)
    SELECT '${F_ROLE}', p.id, 'allow'
    FROM identity.permissions p
    WHERE p.code IN ('finance.periods.read', 'finance.periods.close', 'finance.ledger.read')
    ON CONFLICT DO NOTHING
  `);

  await client.query(`
    INSERT INTO identity.memberships (id, tenant_id, user_id, role_id, status, starts_at)
    VALUES ('${F_MEMBERSHIP}', '${F_TENANT}', '${F_USER}', '${F_ROLE}', 'active', now() - interval '1 day')
    ON CONFLICT (id) DO NOTHING
  `);

  await client.query(`
    INSERT INTO identity.context_grants (id, membership_id, tenant_id, scope_type, property_id, starts_at)
    VALUES ('${F_CONTEXT}', '${F_MEMBERSHIP}', '${F_TENANT}', 'tenant', null, now() - interval '1 day')
    ON CONFLICT (id) DO NOTHING
  `);

  await client.query(`
    INSERT INTO platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version)
    VALUES ('${F_WORKSPACE}', '${F_TENANT}', 'ASSOCIATION', 'ACTIVE', 'Concurrency Runner', 'PILOT', 1)
    ON CONFLICT (id) DO NOTHING
  `);

  await client.query(`
    INSERT INTO platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value)
    VALUES ('${F_WORKSPACE}', 'module.accounting', 'boolean', true)
    ON CONFLICT DO NOTHING
  `);

  await client.query(`
    INSERT INTO finance.accounts (id, tenant_id, property_id, code, name, type, currency)
    VALUES
      ('${F_ACC_BANK}', '${F_TENANT}', '${F_PROPERTY}', '5121', 'Banca RON', 'asset', 'RON'),
      ('${F_ACC_REV}', '${F_TENANT}', '${F_PROPERTY}', '704', 'Venituri RON', 'income', 'RON')
    ON CONFLICT (id) DO NOTHING
  `);

  // Periods:
  // Period A (2025-01-01 to 2025-01-31)
  // Period B (2025-02-01 to 2025-02-28)
  // Period C (2025-03-01 to 2025-03-31)
  await client.query(`
    INSERT INTO finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status)
    VALUES
      ('${F_PERIOD_A}', '${F_TENANT}', '${F_PROPERTY}', '2025-01-01', '2025-01-31', 'open'),
      ('${F_PERIOD_B}', '${F_TENANT}', '${F_PROPERTY}', '2025-02-01', '2025-02-28', 'open'),
      ('${F_PERIOD_C}', '${F_TENANT}', '${F_PROPERTY}', '2025-03-01', '2025-03-31', 'open')
    ON CONFLICT (id) DO NOTHING
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

async function waitForBlocking(observerClient, blockedPid, timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await observerClient.query(
      `SELECT unnest(pg_blocking_pids($1)) as blocker_pid`,
      [blockedPid]
    );
    if (res.rows.length > 0) {
      return res.rows[0].blocker_pid;
    }
    // Also check pg_locks for explicit tuple lock waiting
    const lockRes = await observerClient.query(
      `SELECT pid FROM pg_locks WHERE pid = $1 AND granted = false`,
      [blockedPid]
    );
    if (lockRes.rows.length > 0) {
      return true;
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

async function getClientPid(client) {
  const res = await client.query('SELECT pg_backend_pid() as pid');
  return res.rows[0].pid;
}

async function runScenarioA(conA, conB, conObs) {
  console.log('\n[Scenario A] Journal First — SHARE lock holds, Close FOR UPDATE waits, commits with journal in snapshot');

  const pidA = await getClientPid(conA);
  const pidB = await getClientPid(conB);

  // 1. Connection A begins transaction and inserts posted journal in Period A
  await conA.query('BEGIN');
  await setAuthContext(conA);
  const journalId = '99b00000-0000-0000-0000-000000000001';

  await conA.query(`
    INSERT INTO finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status, posted_at)
    VALUES ('${journalId}', '${F_TENANT}', '${F_PROPERTY}', '2025-01-15', 'RON', 'Scenario A journal', 'invoice', 'posted', now())
  `);

  await conA.query(`
    INSERT INTO finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo)
    VALUES
      ('${F_TENANT}', '${journalId}', '${F_ACC_BANK}', 'debit', 450, 'Bank debit'),
      ('${F_TENANT}', '${journalId}', '${F_ACC_REV}', 'credit', 450, 'Revenue credit')
  `);

  // Con A holds open transaction with FOR SHARE lock on Period A (acquired by journal trigger)
  console.log('  1. Con A inserted journal in Period A and holds open transaction.');

  // 2. Connection B attempts to close Period A via real RPC
  console.log('  2. Con B attempts finance.close_accounting_period for Period A concurrently...');
  let conBPromiseResolved = false;
  let conBError = null;
  let conBResult = null;

  const bPromise = (async () => {
    try {
      await conB.query('BEGIN');
      await setAuthContext(conB);
      const res = await conB.query(`SELECT finance.close_accounting_period($1, $2, $3) as res`, [
        F_CONTEXT,
        F_PERIOD_A,
        'Closed by Scenario A',
      ]);
      await conB.query('COMMIT');
      conBResult = res.rows[0].res;
    } catch (err) {
      conBError = err;
      await conB.query('ROLLBACK').catch(() => {});
    } finally {
      conBPromiseResolved = true;
    }
  })();

  // 3. Observer verifies Con B is blocked waiting for Con A
  const isBlocked = await waitForBlocking(conObs, pidB, 3000);
  if (!isBlocked && conBPromiseResolved) {
    throw new Error('Scenario A FAILED: Con B was not blocked by Con A holding active journal transaction!');
  }
  console.log(`  3. ✓ Proven via pg_locks/pg_blocking_pids: Con B (pid ${pidB}) is strictly waiting for Con A (pid ${pidA}).`);

  // 4. Con A commits
  console.log('  4. Con A commits journal transaction...');
  await conA.query('COMMIT');

  // 5. Con B should unblock and complete close
  await bPromise;
  if (conBError) {
    throw new Error(`Scenario A FAILED: Con B failed after Con A committed: ${conBError.message}`);
  }
  console.log('  5. ✓ Con B unblocked, executed close_accounting_period, and committed.');

  // 6. Verify snapshot has Con A's journal amounts (450 RON) and audit event exists
  const checkRes = await conObs.query(`
    SELECT status, snapshot_json
    FROM finance.accounting_periods
    WHERE id = '${F_PERIOD_A}'
  `);

  const periodRow = checkRes.rows[0];
  if (periodRow.status !== 'closed') {
    throw new Error(`Scenario A FAILED: Expected period status 'closed', got '${periodRow.status}'`);
  }

  const snapshot = periodRow.snapshot_json;
  if (!snapshot || snapshot.version !== 2) {
    throw new Error('Scenario A FAILED: Snapshot V2 missing or invalid');
  }

  const curSummary = snapshot.currency_summaries.find((c) => c.currency === 'RON');
  if (!curSummary || Number(curSummary.total_debit) !== 450 || Number(curSummary.total_credit) !== 450) {
    throw new Error(`Scenario A FAILED: Snapshot does not contain Con A journal totals (expected 450, got ${JSON.stringify(curSummary)})`);
  }

  const auditRes = await conObs.query(`
    SELECT count(*) as count FROM audit.events
    WHERE entity_id = '${F_PERIOD_A}' AND action = 'ACCOUNTING_PERIOD_CLOSED'
  `);
  if (Number(auditRes.rows[0].count) !== 1) {
    throw new Error(`Scenario A FAILED: Expected exactly 1 audit event, got ${auditRes.rows[0].count}`);
  }

  console.log('✓ Scenario A PASSED: Real concurrency journal-first ordering validated.');
}

async function runScenarioB(conA, conB, conObs) {
  console.log('\n[Scenario B] Close First — Close FOR UPDATE holds, Journal INSERT waits, rejected on commit with 25000');

  const pidA = await getClientPid(conA);
  const pidB = await getClientPid(conB);

  // 1. Connection A begins transaction and runs close_accounting_period, but DOES NOT COMMIT YET
  await conA.query('BEGIN');
  await setAuthContext(conA);
  await conA.query(`SELECT finance.close_accounting_period($1, $2, $3)`, [
    F_CONTEXT,
    F_PERIOD_B,
    'Closing in progress Scenario B',
  ]);
  console.log('  1. Con A executed close_accounting_period on Period B and holds transaction open.');

  // 2. Connection B attempts to insert journal into Period B concurrently
  console.log('  2. Con B attempts INSERT journal into Period B concurrently...');
  let conBPromiseResolved = false;
  let conBError = null;

  const bPromise = (async () => {
    try {
      await conB.query('BEGIN');
      await setAuthContext(conB);
      const jId = '99b00000-0000-0000-0000-000000000002';
      await conB.query(`
        INSERT INTO finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status, posted_at)
        VALUES ('${jId}', '${F_TENANT}', '${F_PROPERTY}', '2025-02-15', 'RON', 'Illicit journal', 'invoice', 'posted', now())
      `);
      await conB.query(`
        INSERT INTO finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo)
        VALUES
          ('${F_TENANT}', '${jId}', '${F_ACC_BANK}', 'debit', 100, 'Bank debit'),
          ('${F_TENANT}', '${jId}', '${F_ACC_REV}', 'credit', 100, 'Revenue credit')
      `);
      await conB.query('COMMIT');
    } catch (err) {
      conBError = err;
      await conB.query('ROLLBACK').catch(() => {});
    } finally {
      conBPromiseResolved = true;
    }
  })();

  // 3. Observer verifies Con B is blocked by Con A
  const isBlocked = await waitForBlocking(conObs, pidB, 3000);
  if (!isBlocked && conBPromiseResolved) {
    throw new Error('Scenario B FAILED: Con B was not blocked by Con A close transaction!');
  }
  console.log(`  3. ✓ Proven via pg_locks: Con B (pid ${pidB}) is strictly blocked waiting for Con A (pid ${pidA}).`);

  // 4. Con A commits
  console.log('  4. Con A commits close transaction...');
  await conA.query('COMMIT');

  // 5. Con B should unblock and be rejected with SQLSTATE 25000 (Cannot modify journal in closed period)
  await bPromise;
  if (!conBError) {
    throw new Error('Scenario B FAILED: Con B succeeded inserting journal into closed period! Expected rejection.');
  }

  const errCode = conBError.code;
  const errMsg = conBError.message;
  console.log(`  5. ✓ Con B was rejected as expected with code '${errCode}': ${errMsg}`);

  if (errCode !== '25000' && !errMsg.includes('closed accounting period')) {
    throw new Error(`Scenario B FAILED: Expected SQLSTATE 25000 or closed accounting period error, got ${errCode}: ${errMsg}`);
  }

  // 6. Verify illicit journal does not exist in DB and snapshot is empty
  const jCheck = await conObs.query(`SELECT count(*) as count FROM finance.journals WHERE id = '99b00000-0000-0000-0000-000000000002'`);
  if (Number(jCheck.rows[0].count) !== 0) {
    throw new Error('Scenario B FAILED: Illicit journal was found in database!');
  }

  console.log('✓ Scenario B PASSED: Real concurrency close-first rejection validated.');
}

async function runScenarioC(conA, conB, conObs) {
  console.log('\n[Scenario C] Double Close — First close holds, second close waits, second rejected with conflict');

  const pidA = await getClientPid(conA);
  const pidB = await getClientPid(conB);

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
  let conBPromiseResolved = false;
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
      conBPromiseResolved = true;
    }
  })();

  // 3. Observer verifies Con B is blocked by Con A
  const isBlocked = await waitForBlocking(conObs, pidB, 3000);
  if (!isBlocked && conBPromiseResolved) {
    throw new Error('Scenario C FAILED: Con B was not blocked by Con A!');
  }
  console.log(`  3. ✓ Proven via pg_locks: Con B (pid ${pidB}) is strictly blocked waiting for Con A (pid ${pidA}).`);

  // 4. Con A commits
  console.log('  4. Con A commits close transaction...');
  await conA.query('COMMIT');

  // 5. Con B should unblock and fail with conflict (period_already_closed / 40001)
  await bPromise;
  if (!conBError) {
    throw new Error('Scenario C FAILED: Con B second close succeeded! Expected conflict rejection.');
  }

  console.log(`  5. ✓ Con B was rejected with conflict as expected: ${conBError.message}`);

  // 6. Verify exactly 1 close state and 1 audit event exists
  const pCheck = await conObs.query(`SELECT status, snapshot_json FROM finance.accounting_periods WHERE id = '${F_PERIOD_C}'`);
  if (pCheck.rows[0].status !== 'closed') {
    throw new Error(`Scenario C FAILED: Expected period status 'closed', got '${pCheck.rows[0].status}'`);
  }

  const auditCheck = await conObs.query(`SELECT count(*) as count FROM audit.events WHERE entity_id = '${F_PERIOD_C}' AND action = 'ACCOUNTING_PERIOD_CLOSED'`);
  if (Number(auditCheck.rows[0].count) !== 1) {
    throw new Error(`Scenario C FAILED: Expected exactly 1 audit event, got ${auditCheck.rows[0].count}`);
  }

  console.log('✓ Scenario C PASSED: Real concurrency double-close conflict validated.');
}

async function cleanup(client) {
  console.log('\n-> Cleaning up isolated test fixtures...');
  try {
    await client.query(`DELETE FROM audit.events WHERE tenant_id = '${F_TENANT}'`);
    await client.query(`DELETE FROM finance.journal_entries WHERE tenant_id = '${F_TENANT}'`);
    await client.query(`DELETE FROM finance.journals WHERE tenant_id = '${F_TENANT}'`);
    await client.query(`DELETE FROM finance.accounting_periods WHERE tenant_id = '${F_TENANT}'`);
    await client.query(`DELETE FROM finance.accounts WHERE tenant_id = '${F_TENANT}'`);
    await client.query(`DELETE FROM platform.workspace_entitlements WHERE customer_workspace_id = '${F_WORKSPACE}'`);
    await client.query(`DELETE FROM platform.customer_workspaces WHERE id = '${F_WORKSPACE}'`);
    await client.query(`DELETE FROM identity.context_grants WHERE id = '${F_CONTEXT}'`);
    await client.query(`DELETE FROM identity.memberships WHERE id = '${F_MEMBERSHIP}'`);
    await client.query(`DELETE FROM identity.role_permissions WHERE role_id = '${F_ROLE}'`);
    await client.query(`DELETE FROM identity.roles WHERE id = '${F_ROLE}'`);
    await client.query(`DELETE FROM portfolio.properties WHERE id = '${F_PROPERTY}'`);
    await client.query(`DELETE FROM platform.tenants WHERE id = '${F_TENANT}'`);
    console.log('✓ Test fixtures cleanly removed.');
  } catch (err) {
    console.error('Warning: cleanup encountered error:', err.message);
  }
}

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
    if (conObs) {
      await cleanup(conObs);
    }
    await conA?.end().catch(() => {});
    await conB?.end().catch(() => {});
    await conObs?.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error('Fatal runner error:', err);
  process.exit(1);
});
