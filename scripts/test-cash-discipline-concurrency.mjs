#!/usr/bin/env node
/**
 * CLADORA R10 Phase 2B — Romanian HOA Cash Discipline & Petty Cash Concurrency Rehearsal.
 *
 * Safety contract:
 * - Refuses every non-local database URL.
 * - Additionally requires CLADORA_EPHEMERAL_DB=1 (or CI=true) so an ordinary
 *   developer database cannot be used accidentally.
 * - Uses independent pg.Client connections and observes actual PostgreSQL
 *   blocking with pg_blocking_pids().
 * - Does not disable triggers, RLS, constraints, or use any cleanup/bypass GUC.
 * - Leaves fixtures only in the disposable database.
 *
 * Covered races:
 * 1. Two simultaneous EOD closures for the same cash desk and date.
 *    Both contend on statutory_cash_desk:{cash_desk_id}. Winner commits;
 *    waiter unblocks and fails closed with statutory_cash_day_already_closed (23505).
 * 2. Two concurrent petty-cash expenses competing for an authorized 1,000 RON ceiling.
 *    Winner commits 600 RON; waiter unblocks and fails with petty_cash_ceiling_exceeded (23514).
 * 3. Cash spending vs deposit obligation settlement on the same cash desk.
 *    Proves real contention on the shared statutory_cash_desk advisory-lock namespace via pg_blocking_pids().
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { Client } from 'pg';

const DATABASE_URL =
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

function assertEphemeralTarget(url) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const localHosts = new Set(['127.0.0.1', 'localhost', 'postgres']);
  if (!localHosts.has(host)) {
    throw new Error(
      `CRITICAL SECURITY REFUSAL: cash-discipline concurrency tests require a local ephemeral database (got ${host})`,
    );
  }
  if (process.env.CLADORA_EPHEMERAL_DB !== '1' && process.env.CI !== 'true') {
    throw new Error(
      'CRITICAL SECURITY REFUSAL: set CLADORA_EPHEMERAL_DB=1 only for a disposable local database',
    );
  }
}

async function connect(label) {
  assertEphemeralTarget(DATABASE_URL);
  const client = new Client({
    application_name: `cladora-r10-phase2b-${label}`,
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 5000,
    statement_timeout: 15000,
  });
  await client.connect();
  await client.query("set statement_timeout = '15000'");
  await client.query("set lock_timeout = '10000'");
  return client;
}

const id = () => crypto.randomUUID();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

async function backendPid(client) {
  const result = await client.query('select pg_backend_pid() as pid');
  return Number(result.rows[0].pid);
}

async function waitForBlocking(observer, blockedPid, blockerPid, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let lastBlockers = [];
  while (Date.now() < deadline) {
    const result = await observer.query(
      'select unnest(pg_blocking_pids($1::int)) as blocker_pid',
      [blockedPid],
    );
    lastBlockers = result.rows.map((row) => Number(row.blocker_pid));
    if (lastBlockers.includes(blockerPid)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(
    `expected PID ${blockedPid} to be blocked by PID ${blockerPid}; observed [${lastBlockers.join(', ')}]`,
  );
}

async function beginAsServiceRole(client) {
  await client.query('begin');
  await client.query('set local role service_role');
}

async function rollbackQuietly(client) {
  if (!client) return;
  try {
    await client.query('rollback');
  } catch {
    // Best effort rollback
  }
}

function expectSqlState(error, expected, label) {
  assert.ok(error, `${label}: the losing operation unexpectedly succeeded`);
  assert.equal(error.code, expected, `${label}: expected SQLSTATE ${expected}, got ${error.code}`);
}

function fixtures() {
  return {
    actor: id(),
    tenant: id(),
    workspace: id(),
    property: id(),
    period: id(),
    regime: id(),
    cycle: id(),
    bankAccount: id(),
    cashDesk: id(),
    pettyAuth: id(),
    meeting: id(),
    agenda: id(),
    resolution: id(),
    receiptEntry1: id(),
    receiptEntry2: id(),
    paymentEntry1: id(),
    custodyTransfer1: id(),
  };
}

async function setupFixtures(client, f) {
  await client.query('begin');
  try {
    await client.query(
      `insert into auth.users (id, email) values ($1, $2)`,
      [f.actor, `phase2b-${f.actor}@cladora.invalid`],
    );
    await client.query(
      `insert into platform.tenants (id, legal_name, registration_number, status)
       values ($1, 'R10 Phase 2B Ephemeral Tenant', $2, 'active')`,
      [f.tenant, `R10-2B-${f.tenant}`],
    );
    await client.query(
      `insert into platform.customer_workspaces
         (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment)
       values ($1, $2, 'ASSOCIATION', 'ACTIVE', 'Ephemeral Test', 'PILOT')`,
      [f.workspace, f.tenant],
    );
    await client.query(
      `insert into portfolio.properties (id, tenant_id, type, name, status)
       values ($1, $2, 'condominium', 'Property Concurrency 2B', 'active')`,
      [f.property, f.tenant],
    );
    await client.query(
      `insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status)
       values ($1, $2, $3, date '2026-06-01', date '2026-06-30', 'open')`,
      [f.period, f.tenant, f.property],
    );
    await client.query(
      `insert into finance.statutory_accounting_regimes
         (id, tenant_id, customer_workspace_id, property_id, status, statutory_operations_enabled,
          accounting_signoff_reference, accounting_signed_at, legal_signoff_reference, legal_signed_at,
          activated_at, valid_from)
       values ($1, $2, $3, $4, 'active', true, 'CECCAR-2B', statement_timestamp(),
               'LEGAL-2B', statement_timestamp(), statement_timestamp(), date '2026-01-01')`,
      [f.regime, f.tenant, f.workspace, f.property],
    );
    await client.query(
      `insert into finance.statutory_monthly_cycles (id, regime_id, tenant_id, property_id, accounting_period_id, status)
       values ($1, $2, $3, $4, $5, 'collecting')`,
      [f.cycle, f.regime, f.tenant, f.property, f.period],
    );
    await client.query(
      `insert into payments.bank_accounts (id, tenant_id, property_id, iban_encrypted, iban_fingerprint, bank_name, currency, status)
       values ($1, $2, $3, 'enc-iban-2b', 'fp-iban-2b', 'Banca Transilvania', 'RON', 'active')`,
      [f.bankAccount, f.tenant, f.property],
    );
    await client.query(
      `insert into governance.meetings (id, tenant_id, property_id, title, meeting_type, scheduled_at, status, quorum_rule, created_by)
       values ($1, $2, $3, 'AGM 2026', 'general_assembly', statement_timestamp(), 'closed', '{"rule":"statutory"}'::jsonb, $4)`,
      [f.meeting, f.tenant, f.property, f.actor],
    );
    await client.query(
      `insert into governance.agenda_items (id, tenant_id, meeting_id, sequence_no, title, decision_required)
       values ($1, $2, $3, 1, 'Petty cash fund approval', true)`,
      [f.agenda, f.tenant, f.meeting],
    );
    await client.query(
      `insert into governance.resolutions (id, tenant_id, meeting_id, agenda_item_id, resolution_no, title, text_body, adopted, result_snapshot, effective_on)
       values ($1, $2, $3, $4, 'HOT-2B-1', 'Petty cash 1000 RON', 'Approved', true, '{"adopted":true}'::jsonb, date '2026-01-01')`,
      [f.resolution, f.tenant, f.meeting, f.agenda],
    );
    await client.query(
      `insert into finance.statutory_simple_entries (id, cycle_id, tenant_id, property_id, entry_date, direction, payment_medium, document_type, document_number, amount, description, created_by)
       values
         ($1, $4, $5, $6, date '2026-06-15', 'receipt', 'cash', 'CHITANTA', 'CH-2B-1', 55000.00, 'Cash quota', $7),
         ($2, $4, $5, $6, date '2026-06-15', 'receipt', 'cash', 'CHITANTA', 'CH-2B-2', 10000.00, 'Cash quota 2', $7),
         ($3, $4, $5, $6, date '2026-06-15', 'payment', 'cash', 'DISPOZITIE', 'DP-2B-1', 2000.00, 'Plumber payment', $7)`,
      [f.receiptEntry1, f.receiptEntry2, f.paymentEntry1, f.cycle, f.tenant, f.property, f.actor],
    );
    await client.query('commit');
  } catch (error) {
    await rollbackQuietly(client);
    throw error;
  }
}

async function setupCashDeskAndEntries(client, f) {
  await beginAsServiceRole(client);
  try {
    const desk = await client.query(
      `select * from app_private.create_statutory_cash_desk_v1(
         $1, 'CASH-CONCURRENCY', 'Casierie Concurrency', 50000.00, $2, $3, $4
       )`,
      [f.regime, f.actor, `idemp-desk-${f.cashDesk}`, sha256(`desk-${f.cashDesk}`)],
    );
    f.cashDesk = desk.rows[0].id;

    await client.query(
      `select * from app_private.activate_statutory_cash_desk_v1($1, 1, $2, 'Activate for concurrency rehearsal')`,
      [f.cashDesk, f.actor],
    );

    // Assign receipts and payments
    await client.query(
      `select * from app_private.assign_cash_simple_entry_v1($1, $2, $3, $4, $5)`,
      [f.cashDesk, f.receiptEntry1, f.actor, `idemp-as-1-${f.receiptEntry1}`, sha256(`as-1-${f.receiptEntry1}`)],
    );
    await client.query(
      `select * from app_private.assign_cash_simple_entry_v1($1, $2, $3, $4, $5)`,
      [f.cashDesk, f.receiptEntry2, f.actor, `idemp-as-2-${f.receiptEntry2}`, sha256(`as-2-${f.receiptEntry2}`)],
    );
    await client.query(
      `select * from app_private.assign_cash_simple_entry_v1($1, $2, $3, $4, $5)`,
      [f.cashDesk, f.paymentEntry1, f.actor, `idemp-as-3-${f.paymentEntry1}`, sha256(`as-3-${f.paymentEntry1}`)],
    );

    // Setup petty cash authorization (1000 RON)
    const pettyAuth = await client.query(
      `select * from app_private.authorize_statutory_petty_cash_v1(
         $1, $2, date '2026-06-01', 1000.00, 'Cheltuieli neprevazute', true, $3, $4, $5
       )`,
      [f.cashDesk, f.resolution, f.actor, `idemp-auth-${f.pettyAuth}`, sha256(`auth-${f.pettyAuth}`)],
    );
    f.pettyAuth = pettyAuth.rows[0].id;

    await client.query('commit');
  } catch (error) {
    await rollbackQuietly(client);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// Race 1: Two simultaneous EOD closures for the same cash desk and date
// -----------------------------------------------------------------------------
async function runDailyClosureRace(observer, winner, waiter, f) {
  console.log('\n[Race 1] Two simultaneous daily closures contend on shared statutory_cash_desk lock');
  const closureDate = '2026-06-15';

  await beginAsServiceRole(winner);
  const winnerCall = winner.query(
    `select * from app_private.close_statutory_cash_day_v1($1, $2::date, $3, $4, $5)`,
    [f.cashDesk, closureDate, f.actor, `idemp-close-winner-${f.cashDesk}`, sha256(`close-win-${f.cashDesk}`)],
  );

  const winnerResult = await winnerCall;
  assert.equal(winnerResult.rowCount, 1);
  assert.equal(winnerResult.rows[0].status, 'finalized');

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterError;

  const pendingWaiter = waiter.query(
    `select * from app_private.close_statutory_cash_day_v1($1, $2::date, $3, $4, $5)`,
    [f.cashDesk, closureDate, f.actor, `idemp-close-waiter-${f.cashDesk}`, sha256(`close-wait-${f.cashDesk}`)],
  ).catch((error) => {
    waiterError = error;
  });

  await waitForBlocking(observer, waiterPid, winnerPid);
  console.log(`  observed PID ${waiterPid} blocked by PID ${winnerPid} on statutory_cash_desk lock`);

  await winner.query('commit');
  await pendingWaiter;

  expectSqlState(waiterError, '23505', 'duplicate daily closure waiter');
  assert.equal(waiterError.message, 'statutory_cash_day_already_closed');
  await rollbackQuietly(waiter);

  const proof = await observer.query(
    `select count(*)::int as closure_count, closing_balance, ceiling_exceeded, excess_amount
       from finance.statutory_cash_daily_closures
      where cash_desk_id = $1 and closure_date = $2::date
      group by closing_balance, ceiling_exceeded, excess_amount`,
    [f.cashDesk, closureDate],
  );
  assert.equal(proof.rowCount, 1);
  assert.equal(proof.rows[0].closure_count, 1);
  assert.equal(proof.rows[0].closing_balance, '63000.00'); // 55000 + 10000 - 2000
  assert.equal(proof.rows[0].ceiling_exceeded, true);
  assert.equal(proof.rows[0].excess_amount, '13000.00'); // 63000 - 50000
  console.log('  PASS: exactly one closure committed; duplicate attempt failed closed');
}

// -----------------------------------------------------------------------------
// Race 2: Two concurrent petty-cash expenses exceeding the 1,000 RON ceiling
// -----------------------------------------------------------------------------
async function runPettyCashExpenseRace(observer, winner, waiter, f) {
  console.log('\n[Race 2] Two concurrent petty-cash expenses contend for 1,000 RON ceiling');

  await beginAsServiceRole(winner);
  // Winner expenses 600 RON of 1,000 RON available
  const winnerCall = winner.query(
    `select * from app_private.record_statutory_petty_cash_expense_v1(
       $1, 600.00, date '2026-06-16', 'Reparatie robinet avarie', 'FACTURA_BON', 'BF-WIN-1',
       $2, 'AUT-WIN-1', $3, $4, $5
     )`,
    [f.pettyAuth, sha256('doc-win'), f.actor, `idemp-exp-win-${f.pettyAuth}`, sha256(`exp-win-${f.pettyAuth}`)],
  );

  const winnerResult = await winnerCall;
  assert.equal(winnerResult.rowCount, 1);
  assert.equal(winnerResult.rows[0].amount, '600.00');

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterError;

  // Waiter attempts 500 RON (600 + 500 = 1100 > 1000 limit)
  const pendingWaiter = waiter.query(
    `select * from app_private.record_statutory_petty_cash_expense_v1(
       $1, 500.00, date '2026-06-16', 'Materiale sanitare urgente', 'FACTURA_BON', 'BF-WAIT-1',
       $2, 'AUT-WAIT-1', $3, $4, $5
     )`,
    [f.pettyAuth, sha256('doc-wait'), f.actor, `idemp-exp-wait-${f.pettyAuth}`, sha256(`exp-wait-${f.pettyAuth}`)],
  ).catch((error) => {
    waiterError = error;
  });

  await waitForBlocking(observer, waiterPid, winnerPid);
  console.log(`  observed PID ${waiterPid} blocked by PID ${winnerPid} on statutory_petty_cash lock`);

  await winner.query('commit');
  await pendingWaiter;

  expectSqlState(waiterError, '23514', 'petty cash ceiling exceeded');
  assert.equal(waiterError.message, 'petty_cash_ceiling_exceeded');
  await rollbackQuietly(waiter);

  const proof = await observer.query(
    `select count(*)::int as count, coalesce(sum(amount), 0)::numeric(20,2) as total_spent,
            finance.statutory_petty_cash_balance_v1($1) as remaining_balance
       from finance.statutory_petty_cash_expenses
      where authorization_id = $1 and status = 'recorded'`,
    [f.pettyAuth],
  );
  assert.equal(proof.rows[0].count, 1);
  assert.equal(proof.rows[0].total_spent, '600.00');
  assert.equal(proof.rows[0].remaining_balance, '400.00');
  console.log('  PASS: winner 600 RON committed; over-ceiling 500 RON contender failed closed');
}

// -----------------------------------------------------------------------------
// Race 3: Bank custody deposit vs cash-desk operation lock contention
// -----------------------------------------------------------------------------
async function runDepositSettlementContentionRace(observer, winner, waiter, f) {
  console.log('\n[Race 3] Bank custody transfer vs daily closure contention on shared cash-desk namespace');

  await beginAsServiceRole(winner);
  // Winner holds lock while recording bank deposit
  const winnerCall = await winner.query(
    `select * from app_private.record_cash_custody_transfer_v1(
       $1, $2, 'bank_deposit', 13000.00, date '2026-06-17', 'DEPOZIT-CONCURRENCY-1', null,
       $3, $4, $5
     )`,
    [f.cashDesk, f.bankAccount, f.actor, `idemp-dep-race-${f.cashDesk}`, sha256(`dep-race-${f.cashDesk}`)],
  );
  assert.equal(winnerCall.rowCount, 1);

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterResult;

  // Waiter attempts daily closure on the next day while winner transaction is open
  const pendingWaiter = waiter.query(
    `select * from app_private.close_statutory_cash_day_v1($1, date '2026-06-17', $2, $3, $4)`,
    [f.cashDesk, f.actor, `idemp-close-race-${f.cashDesk}`, sha256(`close-race-${f.cashDesk}`)],
  ).then((res) => {
    waiterResult = res;
  });

  await waitForBlocking(observer, waiterPid, winnerPid);
  console.log(`  observed PID ${waiterPid} blocked by PID ${winnerPid} on statutory_cash_desk namespace`);

  await winner.query('commit');
  await pendingWaiter;

  assert.equal(waiterResult.rowCount, 1);
  assert.equal(waiterResult.rows[0].status, 'finalized');
  await waiter.query('commit');

  const proof = await observer.query(
    `select (select closing_balance from finance.statutory_cash_daily_closures where cash_desk_id = $1 and closure_date = date '2026-06-17') as closing_balance,
            (select count(*)::int from finance.statutory_cash_custody_transfers where cash_desk_id = $1 and status = 'confirmed') as confirmed_deposits`,
    [f.cashDesk],
  );
  // Opening: 63000, deposit: 13000 -> closing: 50000 (at ceiling, not exceeded)
  assert.equal(proof.rows[0].closing_balance, '50000.00');
  assert.equal(proof.rows[0].confirmed_deposits, 1);
  console.log('  PASS: bank deposit and serial closure completed with exact balance tracking');
}

async function run() {
  assertEphemeralTarget(DATABASE_URL);
  const f = fixtures();
  let observer;
  let winner;
  let waiter;
  try {
    observer = await connect('observer');
    winner = await connect('winner');
    waiter = await connect('waiter');
    await setupFixtures(observer, f);
    await setupCashDeskAndEntries(observer, f);
    await runDailyClosureRace(observer, winner, waiter, f);
    await runPettyCashExpenseRace(observer, winner, waiter, f);
    await runDepositSettlementContentionRace(observer, winner, waiter, f);
    console.log('\nR10 PHASE 2B CASH DISCIPLINE CONCURRENCY: PASS');
  } finally {
    await Promise.allSettled([rollbackQuietly(winner), rollbackQuietly(waiter)]);
    await Promise.allSettled([observer?.end(), winner?.end(), waiter?.end()]);
  }
}

run().catch((error) => {
  console.error('\nR10 PHASE 2B CASH DISCIPLINE CONCURRENCY: FAIL');
  console.error(error);
  process.exitCode = 1;
});
