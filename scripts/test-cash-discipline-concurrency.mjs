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
 * All 11 Covered Races:
 * 1. Two simultaneous EOD closures for the same cash desk and date.
 * 2. Two concurrent petty-cash expenses competing for 1,000 RON ceiling.
 * 3. Concurrent duplicate reversals for the exact same petty cash expense.
 * 4. Bank custody transfer vs daily closure contention on shared cash-desk namespace.
 * 5. Competing petty cash funding allocation vs activation.
 * 6. Competing petty cash expenses attempting to claim the exact same simple entry.
 * 7. Competing settlements on a single custody transfer exceeding transfer capacity.
 * 8. Settlement replay vs competing settlement on custody transfer.
 * 9. Competing settlements exceeding exception covered amount.
 * 10. Concurrent finalization of the same statutory cash document.
 * 11. Multi-desk concurrent petty cash authorizations in the same property and month.
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
    cashDesk1: id(),
    cashDesk2: id(),
    pettyAuth: id(),
    unfundedPettyAuth: id(),
    meeting: id(),
    agenda: id(),
    resolution: id(),
    receiptEntry1: id(),
    receiptEntry2: id(),
    receiptFunding1: id(),
    receiptFunding2: id(),
    paymentEntry1: id(),
    pettyPaymentEntry1: id(),
    pettyPaymentEntry2: id(),
    pettyPaymentEntry3: id(),
    pettyRefundEntry1: id(),
    docEntry1: id(),
    docToFinalize: id(),
    custodyTransfer1: id(),
    obligationToSettle1: id(),
    obligationCeiling1: id(),
    exceptionId1: id(),
    recordedExpenseId: null,
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
         ($3, $4, $5, $6, date '2026-06-15', 'payment', 'cash', 'DISPOZITIE', 'DP-2B-1', 2000.00, 'Plumber payment', $7),
         ($8, $4, $5, $6, date '2026-06-16', 'payment', 'cash', 'DISPOZITIE', 'DP-2B-PC1', 600.00, 'Petty cash emergency repair', $7),
         ($9, $4, $5, $6, date '2026-06-16', 'payment', 'cash', 'DISPOZITIE', 'DP-2B-PC2', 500.00, 'Petty cash sanitary parts', $7),
         ($10, $4, $5, $6, date '2026-06-16', 'payment', 'cash', 'DISPOZITIE', 'DP-2B-PC3', 400.00, 'Petty cash electrical repair', $7),
         ($11, $4, $5, $6, date '2026-06-17', 'receipt', 'cash', 'CHITANTA', 'CH-2B-REF1', 600.00, 'Refund of repair parts', $7),
         ($12, $4, $5, $6, date '2026-06-15', 'receipt', 'cash', 'CHITANTA', 'CH-2B-FUND1', 1000.00, 'Funding for petty cash', $7),
         ($13, $4, $5, $6, date '2026-06-15', 'receipt', 'cash', 'CHITANTA', 'CH-2B-FUND2', 1000.00, 'Funding for petty cash 2', $7),
         ($14, $4, $5, $6, date '2026-06-15', 'payment', 'cash', 'DISPOZITIE', 'DP-2B-DOC1', 250.00, 'Document payment entry', $7)`,
      [f.receiptEntry1, f.receiptEntry2, f.paymentEntry1, f.cycle, f.tenant, f.property, f.actor,
       f.pettyPaymentEntry1, f.pettyPaymentEntry2, f.pettyPaymentEntry3, f.pettyRefundEntry1,
       f.receiptFunding1, f.receiptFunding2, f.docEntry1],
    );
    await client.query('commit');
  } catch (error) {
    await rollbackQuietly(client);
    throw error;
  }
}

async function setupCashDesksAndFixtures(client, f) {
  await beginAsServiceRole(client);
  try {
    const desk1 = await client.query(
      `select * from app_private.create_statutory_cash_desk_v1(
         $1, 'CASH-CONCURRENCY-1', 'Casierie Concurrency 1', $2, $3, $4
       )`,
      [f.regime, f.actor, `idemp-desk-${f.cashDesk1}`, sha256(`desk-${f.cashDesk1}`)],
    );
    f.cashDesk1 = desk1.rows[0].id;

    const desk2 = await client.query(
      `select * from app_private.create_statutory_cash_desk_v1(
         $1, 'CASH-CONCURRENCY-2', 'Casierie Concurrency 2', $2, $3, $4
       )`,
      [f.regime, f.actor, `idemp-desk-${f.cashDesk2}`, sha256(`desk-${f.cashDesk2}`)],
    );
    f.cashDesk2 = desk2.rows[0].id;

    await client.query(
      `select * from app_private.activate_statutory_cash_desk_v1($1, 1, $2, 'Activate Desk 1')`,
      [f.cashDesk1, f.actor],
    );
    await client.query(
      `select * from app_private.activate_statutory_cash_desk_v1($1, 1, $2, 'Activate Desk 2')`,
      [f.cashDesk2, f.actor],
    );

    // Assign entries to Desk 1
    await client.query(
      `select * from app_private.assign_cash_simple_entry_v1($1, $2, timestamptz '2026-06-15 09:00:00+03', $3, $4, $5)`,
      [f.cashDesk1, f.receiptEntry1, f.actor, `idemp-as-1-${f.receiptEntry1}`, sha256(`as-1-${f.receiptEntry1}`)],
    );
    await client.query(
      `select * from app_private.assign_cash_simple_entry_v1($1, $2, timestamptz '2026-06-15 10:00:00+03', $3, $4, $5)`,
      [f.cashDesk1, f.receiptEntry2, f.actor, `idemp-as-2-${f.receiptEntry2}`, sha256(`as-2-${f.receiptEntry2}`)],
    );
    await client.query(
      `select * from app_private.assign_cash_simple_entry_v1($1, $2, null, $3, $4, $5)`,
      [f.cashDesk1, f.paymentEntry1, f.actor, `idemp-as-3-${f.paymentEntry1}`, sha256(`as-3-${f.paymentEntry1}`)],
    );
    await client.query(
      `select * from app_private.assign_cash_simple_entry_v1($1, $2, timestamptz '2026-06-15 11:00:00+03', $3, $4, $5)`,
      [f.cashDesk1, f.receiptFunding1, f.actor, `idemp-as-4-${f.receiptFunding1}`, sha256(`as-4-${f.receiptFunding1}`)],
    );
    await client.query(
      `select * from app_private.assign_cash_simple_entry_v1($1, $2, timestamptz '2026-06-15 12:00:00+03', $3, $4, $5)`,
      [f.cashDesk1, f.receiptFunding2, f.actor, `idemp-as-5-${f.receiptFunding2}`, sha256(`as-5-${f.receiptFunding2}`)],
    );

    // Assign petty cash payments & refund entries to Desk 1
    await client.query(
      `select * from app_private.assign_cash_simple_entry_v1($1, $2, null, $3, $4, $5)`,
      [f.cashDesk1, f.pettyPaymentEntry1, f.actor, `idemp-as-p1-${f.pettyPaymentEntry1}`, sha256(`as-p1-${f.pettyPaymentEntry1}`)],
    );
    await client.query(
      `select * from app_private.assign_cash_simple_entry_v1($1, $2, null, $3, $4, $5)`,
      [f.cashDesk1, f.pettyPaymentEntry2, f.actor, `idemp-as-p2-${f.pettyPaymentEntry2}`, sha256(`as-p2-${f.pettyPaymentEntry2}`)],
    );
    await client.query(
      `select * from app_private.assign_cash_simple_entry_v1($1, $2, null, $3, $4, $5)`,
      [f.cashDesk1, f.pettyPaymentEntry3, f.actor, `idemp-as-p3-${f.pettyPaymentEntry3}`, sha256(`as-p3-${f.pettyPaymentEntry3}`)],
    );
    await client.query(
      `select * from app_private.assign_cash_simple_entry_v1($1, $2, timestamptz '2026-06-17 09:00:00+03', $3, $4, $5)`,
      [f.cashDesk1, f.pettyRefundEntry1, f.actor, `idemp-as-ref-${f.pettyRefundEntry1}`, sha256(`as-ref-${f.pettyRefundEntry1}`)],
    );
    await client.query(
      `select * from app_private.assign_cash_simple_entry_v1($1, $2, null, $3, $4, $5)`,
      [f.cashDesk1, f.docEntry1, f.actor, `idemp-as-doc-${f.docEntry1}`, sha256(`as-doc-${f.docEntry1}`)],
    );

    // Setup petty cash authorization (1000 RON) on Desk 1, fund it, and activate it
    const pettyAuth = await client.query(
      `select * from app_private.authorize_statutory_petty_cash_v1(
         $1, $2, 1000.00, date '2026-06-01', 'Elena Ionescu', 'Cheltuieli neprevazute', $3, $4, $5
       )`,
      [f.cashDesk1, f.resolution, f.actor, `idemp-auth-${f.pettyAuth}`, sha256(`auth-${f.pettyAuth}`)],
    );
    f.pettyAuth = pettyAuth.rows[0].id;

    // Retain 1000 RON from receiptFunding1 deposit obligation
    const obFund1 = await client.query(
      `select id from finance.statutory_cash_deposit_obligations where statutory_simple_entry_id = $1`,
      [f.receiptFunding1],
    );
    await client.query(
      `select * from app_private.retain_petty_cash_from_receipt_v1($1, $2, 1000.00, $3, $4, $5)`,
      [obFund1.rows[0].id, f.pettyAuth, f.actor, `idemp-ret-f1-${f.pettyAuth}`, sha256(`ret-f1-${f.pettyAuth}`)],
    );

    await client.query(
      `select * from app_private.activate_statutory_petty_cash_v1($1, $2, $3, $4, $5)`,
      [f.pettyAuth, f.cashDesk1, f.actor, `idemp-act-${f.pettyAuth}`, sha256(`act-${f.pettyAuth}`)],
    );

    // Create a document ready for semantic verification / finalization tests
    const doc = await client.query(
      `select * from app_private.create_statutory_cash_document_v1(
         $1, 'dispozitie_14_4_4_plata', 'DP-CONC', '0001', date '2026-06-15', 250.00,
         'Test Beneficiary', 'Test payment doc', '{"form":"14-4-4"}'::jsonb, $2, null,
         $3, $4, $5
       )`,
      [f.cashDesk1, f.docEntry1, f.actor, `idemp-doc-fin-${f.docToFinalize}`, sha256(`doc-fin-${f.docToFinalize}`)],
    );
    f.docToFinalize = doc.rows[0].id;

    // Verify document semantic schema so it is ready for finalization race
    await client.query(
      `select * from app_private.verify_statutory_cash_document_semantic_schema_v1(
         $1, 1, $2, 'Verification for finalization race', $3, $4
       )`,
      [f.docToFinalize, f.actor, `idemp-doc-vfy-${f.docToFinalize}`, sha256(`doc-vfy-${f.docToFinalize}`)],
    );

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
    `select * from app_private.close_statutory_cash_day_v1($1, $2::date, 64750.00, $3, $4, $5)`,
    [f.cashDesk1, closureDate, f.actor, `idemp-close-winner-${f.cashDesk1}`, sha256(`close-win-${f.cashDesk1}`)],
  );

  const winnerResult = await winnerCall;
  assert.equal(winnerResult.rowCount, 1);
  assert.equal(winnerResult.rows[0].status, 'finalized');

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterError;

  const pendingWaiter = waiter.query(
    `select * from app_private.close_statutory_cash_day_v1($1, $2::date, 64750.00, $3, $4, $5)`,
    [f.cashDesk1, closureDate, f.actor, `idemp-close-waiter-${f.cashDesk1}`, sha256(`close-wait-${f.cashDesk1}`)],
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
    [f.cashDesk1, closureDate],
  );
  assert.equal(proof.rowCount, 1);
  assert.equal(proof.rows[0].closure_count, 1);
  console.log('  PASS: exactly one closure committed; duplicate attempt failed closed');
}

// -----------------------------------------------------------------------------
// Race 2: Two concurrent petty-cash expenses exceeding the 1,000 RON ceiling
// -----------------------------------------------------------------------------
async function runPettyCashExpenseRace(observer, winner, waiter, f) {
  console.log('\n[Race 2] Two concurrent petty-cash expenses contend for 1,000 RON ceiling');

  await beginAsServiceRole(winner);
  const winnerCall = winner.query(
    `select * from app_private.record_statutory_petty_cash_expense_v1(
       $1, $2, 'Reparatie robinet avarie', 'BF-WIN-1', $3, $4, $5
     )`,
    [f.pettyAuth, f.pettyPaymentEntry1, f.actor, `idemp-exp-win-${f.pettyAuth}`, sha256(`exp-win-${f.pettyAuth}`)],
  );

  const winnerResult = await winnerCall;
  assert.equal(winnerResult.rowCount, 1);
  assert.equal(winnerResult.rows[0].amount, '600.00');
  f.recordedExpenseId = winnerResult.rows[0].id;

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterError;

  // Waiter attempts 500 RON (600 + 500 = 1100 > 1000 limit)
  const pendingWaiter = waiter.query(
    `select * from app_private.record_statutory_petty_cash_expense_v1(
       $1, $2, 'Materiale sanitare urgente', 'BF-WAIT-1', $3, $4, $5
     )`,
    [f.pettyAuth, f.pettyPaymentEntry2, f.actor, `idemp-exp-wait-${f.pettyAuth}`, sha256(`exp-wait-${f.pettyAuth}`)],
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
      where authorization_id = $1`,
    [f.pettyAuth],
  );
  assert.equal(proof.rows[0].count, 1);
  assert.equal(proof.rows[0].total_spent, '600.00');
  assert.equal(proof.rows[0].remaining_balance, '400.00');
  console.log('  PASS: winner 600 RON committed; over-ceiling 500 RON contender failed closed');
}

// -----------------------------------------------------------------------------
// Race 3: Concurrent duplicate reversals for the exact same petty cash expense
// -----------------------------------------------------------------------------
async function runPettyCashReversalRace(observer, winner, waiter, f) {
  console.log('\n[Race 3] Two concurrent reversals contend on the same petty cash expense');

  await beginAsServiceRole(winner);
  const winnerCall = winner.query(
    `select * from app_private.reverse_statutory_petty_cash_expense_v1(
       $1, $2, 'Returned plumbing parts for full refund',
       $3, $4, $5
     )`,
    [f.recordedExpenseId, f.pettyRefundEntry1, f.actor, `idemp-rev-win-${f.recordedExpenseId}`, sha256(`rev-win-${f.recordedExpenseId}`)],
  );

  const winnerResult = await winnerCall;
  assert.equal(winnerResult.rowCount, 1);

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterError;

  const pendingWaiter = waiter.query(
    `select * from app_private.reverse_statutory_petty_cash_expense_v1(
       $1, $2, 'Duplicate reversal attempt',
       $3, $4, $5
     )`,
    [f.recordedExpenseId, f.pettyRefundEntry1, f.actor, `idemp-rev-wait-${f.recordedExpenseId}`, sha256(`rev-wait-${f.recordedExpenseId}`)],
  ).catch((error) => {
    waiterError = error;
  });

  await waitForBlocking(observer, waiterPid, winnerPid);
  console.log(`  observed PID ${waiterPid} blocked by PID ${winnerPid} on statutory_petty_cash lock`);

  await winner.query('commit');
  await pendingWaiter;

  expectSqlState(waiterError, '55000', 'petty cash already reversed');
  assert.equal(waiterError.message, 'petty_cash_expense_already_reversed');
  await rollbackQuietly(waiter);

  const proof = await observer.query(
    `select count(*)::int as reversal_count,
            finance.statutory_petty_cash_balance_v1($1) as remaining_balance
       from finance.statutory_petty_cash_expense_reversals
      where authorization_id = $1`,
    [f.pettyAuth],
  );
  assert.equal(proof.rows[0].reversal_count, 1);
  assert.equal(proof.rows[0].remaining_balance, '1000.00');
  console.log('  PASS: exactly one append-only reversal committed; duplicate reversal failed closed');
}

// -----------------------------------------------------------------------------
// Race 4: Bank custody deposit vs daily closure contention on shared cash desk
// -----------------------------------------------------------------------------
async function runDepositSettlementContentionRace(observer, winner, waiter, f) {
  console.log('\n[Race 4] Bank custody transfer vs daily closure contention on shared cash-desk namespace');

  await beginAsServiceRole(winner);
  const winnerCall = await winner.query(
    `select * from app_private.record_cash_custody_transfer_v1(
       $1, $2, null, 'bank_deposit', 10000.00, date '2026-06-16', timestamptz '2026-06-16 10:00:00+03', 'DEPOZIT-CONCURRENCY-1',
       $3, $4, $5
     )`,
    [f.cashDesk1, f.bankAccount, f.actor, `idemp-dep-race-${f.cashDesk1}`, sha256(`dep-race-${f.cashDesk1}`)],
  );
  assert.equal(winnerCall.rowCount, 1);
  f.custodyTransfer1 = winnerCall.rows[0].id;

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterResult;

  const pendingWaiter = waiter.query(
    `select * from app_private.close_statutory_cash_day_v1($1, date '2026-06-16', 53250.00, $2, $3, $4)`,
    [f.cashDesk1, f.actor, `idemp-close-race-${f.cashDesk1}`, sha256(`close-race-${f.cashDesk1}`)],
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
    `select (select closing_balance from finance.statutory_cash_daily_closures where cash_desk_id = $1 and closure_date = date '2026-06-16') as closing_balance,
            (select count(*)::int from finance.statutory_cash_custody_transfers where cash_desk_id = $1 and status = 'confirmed') as confirmed_deposits`,
    [f.cashDesk1],
  );
  assert.equal(proof.rows[0].confirmed_deposits, 1);
  console.log('  PASS: bank deposit and serial closure completed with exact balance tracking');
}

// -----------------------------------------------------------------------------
// Race 5: Competing petty cash funding allocation vs activation
// -----------------------------------------------------------------------------
async function runPettyFundingAndActivationRace(observer, winner, waiter, f) {
  console.log('\n[Race 5] Competing funding retention allocation vs un-funded activation');

  await beginAsServiceRole(winner);
  const authRes = await winner.query(
    `select * from app_private.authorize_statutory_petty_cash_v1(
       $1, $2, 500.00, date '2026-07-01', 'Elena Ionescu', 'Cheltuieli neprevazute iulie', $3, $4, $5
     )`,
    [f.cashDesk1, f.resolution, f.actor, `idemp-auth-july-${f.cashDesk1}`, sha256(`auth-july-${f.cashDesk1}`)],
  );
  f.unfundedPettyAuth = authRes.rows[0].id;
  await winner.query('commit');

  await beginAsServiceRole(winner);
  const obFund2 = await winner.query(
    `select id from finance.statutory_cash_deposit_obligations where statutory_simple_entry_id = $1`,
    [f.receiptFunding2],
  );
  const winnerCall = winner.query(
    `select * from app_private.retain_petty_cash_from_receipt_v1($1, $2, 500.00, $3, $4, $5)`,
    [obFund2.rows[0].id, f.unfundedPettyAuth, f.actor, `idemp-ret-july-${f.unfundedPettyAuth}`, sha256(`ret-july-${f.unfundedPettyAuth}`)],
  );
  await winnerCall;

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterResult;

  const pendingWaiter = waiter.query(
    `select * from app_private.activate_statutory_petty_cash_v1($1, $2, $3, $4, $5)`,
    [f.unfundedPettyAuth, f.cashDesk1, f.actor, `idemp-act-july-${f.unfundedPettyAuth}`, sha256(`act-july-${f.unfundedPettyAuth}`)],
  ).then((res) => {
    waiterResult = res;
  });

  await waitForBlocking(observer, waiterPid, winnerPid);
  console.log(`  observed PID ${waiterPid} blocked by PID ${winnerPid} on statutory_petty_cash lock`);

  await winner.query('commit');
  await pendingWaiter;

  assert.equal(waiterResult.rowCount, 1);
  assert.equal(waiterResult.rows[0].status, 'active');
  await waiter.query('commit');

  const proof = await observer.query(
    `select a.status,
            finance.statutory_petty_cash_balance_v1(a.id) as allocated_funding_amount
       from finance.statutory_petty_cash_authorizations a
      where a.id = $1`,
    [f.unfundedPettyAuth],
  );
  assert.equal(proof.rows[0].status, 'active');
  assert.equal(proof.rows[0].allocated_funding_amount, '500.00');
  console.log('  PASS: funding retained and activation committed serially');
}

// -----------------------------------------------------------------------------
// Race 6: Competing petty cash expenses attempting to claim same simple entry
// -----------------------------------------------------------------------------
async function runCompetingExpensesForSameSimpleEntryRace(observer, winner, waiter, f) {
  console.log('\n[Race 6] Two concurrent expense RPCs trying to claim the exact same simple-entry');

  await beginAsServiceRole(winner);
  const winnerCall = winner.query(
    `select * from app_private.record_statutory_petty_cash_expense_v1(
       $1, $2, 'Reparatie electrica', 'BF-SE-1', $3, $4, $5
     )`,
    [f.pettyAuth, f.pettyPaymentEntry3, f.actor, `idemp-exp-se-win-${f.pettyAuth}`, sha256(`exp-se-win-${f.pettyAuth}`)],
  );
  await winnerCall;

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterError;

  const pendingWaiter = waiter.query(
    `select * from app_private.record_statutory_petty_cash_expense_v1(
       $1, $2, 'Reparatie electrica tentativa 2', 'BF-SE-2', $3, $4, $5
     )`,
    [f.pettyAuth, f.pettyPaymentEntry3, f.actor, `idemp-exp-se-wait-${f.pettyAuth}`, sha256(`exp-se-wait-${f.pettyAuth}`)],
  ).catch((error) => {
    waiterError = error;
  });

  await waitForBlocking(observer, waiterPid, winnerPid);
  console.log(`  observed PID ${waiterPid} blocked by PID ${winnerPid} on statutory_petty_cash lock`);

  await winner.query('commit');
  await pendingWaiter;

  expectSqlState(waiterError, '23505', 'duplicate simple entry in petty cash expense');
  await rollbackQuietly(waiter);
  console.log('  PASS: winner claimed simple-entry; waiter rejected with unique constraint violation');
}

// -----------------------------------------------------------------------------
// Race 7: Competing settlements exceeding custody transfer capacity
// -----------------------------------------------------------------------------
async function runCompetingSettlementsTransferCapacityRace(observer, winner, waiter, f) {
  console.log('\n[Race 7] Two concurrent settlements competing for custody transfer capacity');

  const obRes = await observer.query(
    `select id from finance.statutory_cash_deposit_obligations where statutory_simple_entry_id = $1`,
    [f.receiptEntry1],
  );
  f.obligationToSettle1 = obRes.rows[0].id;

  await beginAsServiceRole(winner);
  const winnerCall = winner.query(
    `select * from app_private.settle_cash_deposit_obligation_v1(
       $1, $2, 8000.00, null, 'settle capacity race', $3, $4, $5
     )`,
    [f.obligationToSettle1, f.custodyTransfer1, f.actor, `idemp-settle-cap-win-${f.custodyTransfer1}`, sha256(`settle-cap-win-${f.custodyTransfer1}`)],
  );
  await winnerCall;

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterError;

  const pendingWaiter = waiter.query(
    `select * from app_private.settle_cash_deposit_obligation_v1(
       $1, $2, 4000.00, null, 'settle capacity race 2', $3, $4, $5
     )`,
    [f.obligationToSettle1, f.custodyTransfer1, f.actor, `idemp-settle-cap-wait-${f.custodyTransfer1}`, sha256(`settle-cap-wait-${f.custodyTransfer1}`)],
  ).catch((error) => {
    waiterError = error;
  });

  await waitForBlocking(observer, waiterPid, winnerPid);
  console.log(`  observed PID ${waiterPid} blocked by PID ${winnerPid} on custody transfer lock`);

  await winner.query('commit');
  await pendingWaiter;

  expectSqlState(waiterError, '23514', 'custody transfer capacity exceeded');
  assert.equal(waiterError.message, 'custody_transfer_capacity_exceeded');
  await rollbackQuietly(waiter);
  console.log('  PASS: winner 8,000 RON allocated; over-capacity 4,000 RON contender failed closed');
}

// -----------------------------------------------------------------------------
// Race 8: Settlement replay vs competing settlement on custody transfer
// -----------------------------------------------------------------------------
async function runSettlementReplayVsCompetingRace(observer, winner, waiter, f) {
  console.log('\n[Race 8] True contention: Settlement uncommitted winner vs concurrent replay/competing waiter');

  // Create dedicated custody transfer for Race 8 so capacity is isolated and exact
  const trRes = await observer.query(
    `select * from app_private.record_cash_custody_transfer_v1(
       $1, $2, null, 'bank_deposit', 10000.00, date '2026-06-16', timestamptz '2026-06-16 10:00:00+03', 'DEPOZIT-RACE-8',
       $3, $4, $5
     )`,
    [f.cashDesk1, f.bankAccount, f.actor, `idemp-transfer-race-8-${id()}`, sha256(`transfer-race-8`)],
  );
  const transfer8Id = trRes.rows[0].id;

  // Winner begins and executes settlement without committing (holding lock and uncommitted event)
  await beginAsServiceRole(winner);
  const winnerPid = await backendPid(winner);

  const idempKey8 = `idemp-race-8-contention-${id()}`;
  const winnerCall = await winner.query(
    `select * from app_private.settle_cash_deposit_obligation_v1(
       $1, $2, 6000.00, null, 'settle race 8 true contention', $3, $4, $5
     )`,
    [f.obligationToSettle1, transfer8Id, f.actor, idempKey8, sha256(`race-8-settle`)],
  );
  assert.equal(winnerCall.rowCount, 1);
  const winnerRow = winnerCall.rows[0];

  // Waiter begins and concurrently attempts replay of the EXACT same uncommitted settlement key
  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  let waiterResult;
  let waiterError;

  const pendingWaiter = waiter.query(
    `select * from app_private.settle_cash_deposit_obligation_v1(
       $1, $2, 6000.00, null, 'settle race 8 true contention', $3, $4, $5
     )`,
    [f.obligationToSettle1, transfer8Id, f.actor, idempKey8, sha256(`race-8-settle`)],
  ).then((res) => {
    waiterResult = res;
  }).catch((err) => {
    waiterError = err;
  });

  // Observer proves true contention by observing waiter blocked by winner PID
  await waitForBlocking(observer, waiterPid, winnerPid);
  console.log(`  observed PID ${waiterPid} blocked by PID ${winnerPid} on uncommitted settlement`);

  // Winner commits, releasing lock
  await winner.query('commit');
  await pendingWaiter;

  if (waiterError) {
    throw waiterError;
  }
  assert.equal(waiterResult.rowCount, 1);
  assert.equal(waiterResult.rows[0].id, winnerRow.id, 'Waiter idempotent replay must return exact same settlement record');
  await waiter.query('commit');

  // Verify count and transfer capacity
  const countRes = await observer.query(
    `select count(*) as cnt, sum(settled_amount) as total_settled from finance.statutory_cash_deposit_settlements
      where custody_transfer_id = $1`,
    [transfer8Id],
  );
  assert.equal(countRes.rows[0].cnt, '1', 'Exactly 1 settlement record created despite concurrent race');
  assert.equal(countRes.rows[0].total_settled, '6000.00', 'Transfer capacity consumed exactly once');

  console.log('  PASS: verified PID blocking, uncommitted contention, idempotent waiter resolution, and exact settlement capacity');
}

// -----------------------------------------------------------------------------
// Race 9: Competing settlements exceeding exception covered amount
// -----------------------------------------------------------------------------
async function runExceptionAllocationRace(observer, winner, waiter, f) {
  console.log('\n[Race 9] Two concurrent settlements competing for exception-covered allocation');

  const ceilingOb = await observer.query(
    `select id, required_amount from finance.statutory_cash_deposit_obligations
      where obligation_kind = 'ceiling_50k_excess' limit 1`,
  );
  f.obligationCeiling1 = ceilingOb.rows[0].id;

  await beginAsServiceRole(winner);
  const exRes = await winner.query(
    `select * from app_private.record_deposit_obligation_exception_v1(
       $1, 3000.00, 'personnel_rights', date '2026-06-16', 'Salarii casier', $2, $3, $4, $5
     )`,
    [f.obligationCeiling1, f.paymentEntry1, f.actor, `idemp-ex-race-${f.obligationCeiling1}`, sha256(`ex-race-${f.obligationCeiling1}`)],
  );
  f.exceptionId1 = exRes.rows[0].id;

  const depRes = await winner.query(
    `select * from app_private.record_cash_custody_transfer_v1(
       $1, $2, null, 'bank_deposit', 5000.00, date '2026-06-17', timestamptz '2026-06-17 10:00:00+03', 'DEPOZIT-EX-RACE',
       $3, $4, $5
     )`,
    [f.cashDesk1, f.bankAccount, f.actor, `idemp-dep-ex-race-${f.cashDesk1}`, sha256(`dep-ex-race-${f.cashDesk1}`)],
  );
  const depId = depRes.rows[0].id;

  const winnerCall = winner.query(
    `select * from app_private.settle_cash_deposit_obligation_v1(
       $1, $2, 2500.00, $3, 'ex settlement win', $4, $5, $6
     )`,
    [f.obligationCeiling1, depId, f.exceptionId1, f.actor, `idemp-settle-ex-win-${depId}`, sha256(`ex-win-${depId}`)],
  );
  await winnerCall;

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterError;

  const pendingWaiter = waiter.query(
    `select * from app_private.settle_cash_deposit_obligation_v1(
       $1, $2, 1000.00, $3, 'ex settlement wait', $4, $5, $6
     )`,
    [f.obligationCeiling1, depId, f.exceptionId1, f.actor, `idemp-settle-ex-wait-${depId}`, sha256(`ex-wait-${depId}`)],
  ).catch((error) => {
    waiterError = error;
  });

  await waitForBlocking(observer, waiterPid, winnerPid);
  console.log(`  observed PID ${waiterPid} blocked by PID ${winnerPid} on exception lock`);

  await winner.query('commit');
  await pendingWaiter;

  expectSqlState(waiterError, '23514', 'exception capacity exceeded');
  assert.equal(waiterError.message, 'exception_capacity_exceeded');
  await rollbackQuietly(waiter);
  console.log('  PASS: winner 2,500 RON allocated; over-exception contender failed closed');
}

// -----------------------------------------------------------------------------
// Race 10: Concurrent finalization of the same statutory cash document
// -----------------------------------------------------------------------------
async function runDocumentFinalizationRace(observer, winner, waiter, f) {
  console.log('\n[Race 10] Concurrent finalization of the same verified cash document');

  await beginAsServiceRole(winner);
  const winnerCall = winner.query(
    `select * from app_private.finalize_statutory_cash_document_v1(
       $1, 2, $2, 'Finalize winner', $3, $4
     )`,
    [f.docToFinalize, f.actor, `idemp-fin-win-${f.docToFinalize}`, sha256(`fin-win-${f.docToFinalize}`)],
  );
  await winnerCall;

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterError;

  const pendingWaiter = waiter.query(
    `select * from app_private.finalize_statutory_cash_document_v1(
       $1, 2, $2, 'Finalize waiter', $3, $4
     )`,
    [f.docToFinalize, f.actor, `idemp-fin-wait-${f.docToFinalize}`, sha256(`fin-wait-${f.docToFinalize}`)],
  ).catch((error) => {
    waiterError = error;
  });

  await waitForBlocking(observer, waiterPid, winnerPid);
  console.log(`  observed PID ${waiterPid} blocked by PID ${winnerPid} on cash document lock`);

  await winner.query('commit');
  await pendingWaiter;

  expectSqlState(waiterError, '55000', 'document already finalized');
  assert.equal(waiterError.message, 'cash_document_already_finalized');
  await rollbackQuietly(waiter);
  console.log('  PASS: winner finalized document; concurrent contender failed closed');
}

// -----------------------------------------------------------------------------
// Race 11: Multi-desk concurrent authorizations in same property and month
// -----------------------------------------------------------------------------
async function runMultiDeskPropertyMonthAuthorizationRace(observer, winner, waiter, f) {
  console.log('\n[Race 11] Multi-desk concurrent petty cash authorizations in same property and month');

  await beginAsServiceRole(winner);
  const winnerCall = winner.query(
    `select * from app_private.authorize_statutory_petty_cash_v1(
       $1, $2, 300.00, date '2026-08-01', 'Elena Ionescu', 'Cheltuieli neprevazute august Desk 1', $3, $4, $5
     )`,
    [f.cashDesk1, f.resolution, f.actor, `idemp-auth-aug1-${f.property}`, sha256(`auth-aug1-${f.property}`)],
  );
  await winnerCall;

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterError;

  const pendingWaiter = waiter.query(
    `select * from app_private.authorize_statutory_petty_cash_v1(
       $1, $2, 400.00, date '2026-08-01', 'Elena Ionescu', 'Cheltuieli neprevazute august Desk 2', $3, $4, $5
     )`,
    [f.cashDesk2, f.resolution, f.actor, `idemp-auth-aug2-${f.property}`, sha256(`auth-aug2-${f.property}`)],
  ).catch((error) => {
    waiterError = error;
  });

  await waitForBlocking(observer, waiterPid, winnerPid);
  console.log(`  observed PID ${waiterPid} blocked by PID ${winnerPid} on property authorization unique lock`);

  await winner.query('commit');
  await pendingWaiter;

  expectSqlState(waiterError, '23505', 'duplicate property month authorization');
  await rollbackQuietly(waiter);
  console.log('  PASS: winner authorized August for Property; Desk 2 contender failed closed (23505)');
}

// -----------------------------------------------------------------------------
// Main execution suite
// -----------------------------------------------------------------------------
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
    await setupCashDesksAndFixtures(observer, f);

    await runDailyClosureRace(observer, winner, waiter, f);
    await runPettyCashExpenseRace(observer, winner, waiter, f);
    await runPettyCashReversalRace(observer, winner, waiter, f);
    await runDepositSettlementContentionRace(observer, winner, waiter, f);
    await runPettyFundingAndActivationRace(observer, winner, waiter, f);
    await runCompetingExpensesForSameSimpleEntryRace(observer, winner, waiter, f);
    await runCompetingSettlementsTransferCapacityRace(observer, winner, waiter, f);
    await runSettlementReplayVsCompetingRace(observer, winner, waiter, f);
    await runExceptionAllocationRace(observer, winner, waiter, f);
    await runDocumentFinalizationRace(observer, winner, waiter, f);
    await runMultiDeskPropertyMonthAuthorizationRace(observer, winner, waiter, f);

    console.log('\nR10 PHASE 2B CASH DISCIPLINE CONCURRENCY: ALL 11 RACES PASSED');
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
