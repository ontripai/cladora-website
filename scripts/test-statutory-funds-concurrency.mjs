#!/usr/bin/env node
/**
 * CLADORA R10 Phase 2A — statutory funds real PostgreSQL concurrency rehearsal.
 *
 * Safety contract:
 * - Refuses every non-local database URL.
 * - Additionally requires CLADORA_EPHEMERAL_DB=1 (or CI=true) so an ordinary
 *   developer database cannot be used accidentally.
 * - Uses independent pg.Client connections and observes actual PostgreSQL
 *   blocking with pg_blocking_pids().
 * - Does not disable triggers, RLS, constraints, or use any cleanup/bypass GUC.
 * - Leaves fixtures only in the disposable database; the runner never tries to
 *   weaken append-only protections in order to clean them up.
 *
 * Covered races:
 * 1. Two classifications compete for one statutory simple entry. The winner
 *    commits 70 RON; the waiter is serialized and then rejected because the
 *    shared 100 RON entry would be overclassified.
 * 2. Refund versus deed retention for the same working-capital owner position.
 *    Both finalizers contend on the identical statutory_fund:{fund_id} lock.
 *    The refund wins; retention observes the changed frozen position and fails.
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
      `CRITICAL SECURITY REFUSAL: statutory-fund concurrency tests require a local ephemeral database (got ${host})`,
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
    application_name: `cladora-r10-phase2a-${label}`,
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
    // A failed statement may already have aborted the transaction. Rollback is
    // best-effort only and never changes database protections.
  }
}

function expectSqlState(error, expected, label) {
  assert.ok(error, `${label}: the losing operation unexpectedly succeeded`);
  assert.equal(error.code, expected, `${label}: expected SQLSTATE ${expected}, got ${error.code}`);
}

function fixtures() {
  return {
    tenant: id(),
    actor: id(),
    workspace: id(),
    property: id(),
    building: id(),
    unit: id(),
    outgoingParty: id(),
    incomingRefundParty: id(),
    incomingRetentionParty: id(),
    outgoingOwnership: id(),
    incomingRefundOwnership: id(),
    incomingRetentionOwnership: id(),
    meeting: id(),
    agenda: id(),
    resolution: id(),
    period: id(),
    regime: id(),
    cycle: id(),
    classificationEntry: id(),
    seedEntry: id(),
    refundEntry: id(),
    fund: id(),
    seedMovement: id(),
    refundConveyance: id(),
    retentionConveyance: id(),
  };
}

async function setupFixtures(client, f) {
  const policy = JSON.stringify({ law: 'Legea 196/2018', article: '72' });
  const seedSnapshot = JSON.stringify({ source: 'ephemeral-concurrency-fixture' });
  await client.query('begin');
  try {
    await client.query(
      `insert into auth.users (id, email)
       values ($1, $2)`,
      [f.actor, `phase2a-${f.actor}@example.invalid`],
    );
    await client.query(
      `insert into platform.tenants (id, legal_name, registration_number, status)
       values ($1, 'R10 Phase 2A Ephemeral Tenant', $2, 'active')`,
      [f.tenant, `R10-${f.tenant}`],
    );
    await client.query(
      `insert into platform.customer_workspaces
         (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment)
       values ($1, $2, 'ASSOCIATION', 'ACTIVE', 'Ephemeral Test', 'PILOT')`,
      [f.workspace, f.tenant],
    );
    await client.query(
      `insert into portfolio.properties (id, tenant_id, type, name, status)
       values ($1, $2, 'condominium', 'R10 Phase 2A Property', 'active')`,
      [f.property, f.tenant],
    );
    await client.query(
      `insert into portfolio.buildings (id, tenant_id, property_id, code, name, status)
       values ($1, $2, $3, 'B1', 'Building 1', 'active')`,
      [f.building, f.tenant, f.property],
    );
    await client.query(
      `insert into portfolio.units (id, tenant_id, building_id, code, status)
       values ($1, $2, $3, 'U1', 'active')`,
      [f.unit, f.tenant, f.building],
    );
    await client.query(
      `insert into portfolio.parties (id, tenant_id, type, legal_name)
       values
         ($1, $4, 'person', 'Outgoing Owner'),
         ($2, $4, 'person', 'Refund Incoming Owner'),
         ($3, $4, 'person', 'Retention Incoming Owner')`,
      [f.outgoingParty, f.incomingRefundParty, f.incomingRetentionParty, f.tenant],
    );
    await client.query(
      `insert into portfolio.ownerships
         (id, tenant_id, unit_id, party_id, share, valid_from, valid_to)
       values
         ($1, $7, $6, $2, 1, current_date - 365, current_date),
         ($3, $7, $6, $4, 0.5, current_date, null),
         ($5, $7, $6, $8, 0.5, current_date, null)`,
      [
        f.outgoingOwnership,
        f.outgoingParty,
        f.incomingRefundOwnership,
        f.incomingRefundParty,
        f.incomingRetentionOwnership,
        f.unit,
        f.tenant,
        f.incomingRetentionParty,
      ],
    );
    await client.query(
      `insert into governance.meetings
         (id, tenant_id, property_id, title, meeting_type, scheduled_at, status, quorum_rule, created_by)
       values ($1, $2, $3, 'Fund approval', 'general_assembly', statement_timestamp(),
               'closed', '{"rule":"fixture"}'::jsonb, $4)`,
      [f.meeting, f.tenant, f.property, f.actor],
    );
    await client.query(
      `insert into governance.agenda_items
         (id, tenant_id, meeting_id, sequence_no, title, decision_required)
       values ($1, $2, $3, 1, 'Working-capital fund', true)`,
      [f.agenda, f.tenant, f.meeting],
    );
    await client.query(
      `insert into governance.resolutions
         (id, tenant_id, meeting_id, agenda_item_id, resolution_no, title, text_body,
          adopted, result_snapshot, effective_on)
       values ($1, $2, $3, $4, 'R10-1', 'Working-capital fund', 'Approved', true,
               '{"approved":true}'::jsonb, current_date)`,
      [f.resolution, f.tenant, f.meeting, f.agenda],
    );
    await client.query(
      `insert into finance.accounting_periods
         (id, tenant_id, property_id, starts_on, ends_on, status)
       values ($1, $2, $3, current_date - 15, current_date + 15, 'open')`,
      [f.period, f.tenant, f.property],
    );
    await client.query(
      `insert into finance.statutory_accounting_regimes
         (id, tenant_id, customer_workspace_id, property_id, status,
          statutory_operations_enabled, accounting_signoff_reference, accounting_signed_at,
          legal_signoff_reference, legal_signed_at, activated_at, valid_from)
       values ($1, $2, $3, $4, 'active', true, 'CECCAR-EPHEMERAL', statement_timestamp(),
               'LEGAL-EPHEMERAL', statement_timestamp(), statement_timestamp(), current_date - 30)`,
      [f.regime, f.tenant, f.workspace, f.property],
    );
    await client.query(
      `insert into finance.statutory_monthly_cycles
         (id, regime_id, tenant_id, property_id, accounting_period_id, status)
       values ($1, $2, $3, $4, $5, 'collecting')`,
      [f.cycle, f.regime, f.tenant, f.property, f.period],
    );
    await client.query(
      `insert into finance.statutory_simple_entries
         (id, cycle_id, tenant_id, property_id, entry_date, direction, payment_medium,
          document_type, document_number, amount, description, created_by)
       values
         ($1, $4, $5, $6, current_date, 'receipt', 'bank', 'TEST', 'CLASSIFY-100', 100,
          'Shared classification entry', $7),
         ($2, $4, $5, $6, current_date, 'receipt', 'bank', 'TEST', 'SEED-200', 200,
          'Owner working-capital seed', $7),
         ($3, $4, $5, $6, current_date, 'payment', 'bank', 'TEST', 'REFUND-200', 200,
          'Conveyance refund evidence', $7)`,
      [f.classificationEntry, f.seedEntry, f.refundEntry, f.cycle, f.tenant, f.property, f.actor],
    );
    await client.query(
      `insert into finance.statutory_funds
         (id, regime_id, tenant_id, property_id, kind, code, name_ro,
          adopted_resolution_id, statutory_basis, purpose_policy, policy_hash, status,
          valid_from, idempotency_key, payload_hash, created_by, activated_by, activated_at)
       values ($1, $2, $3, $4, 'working_capital', 'working-capital', 'Fond de rulment',
               $5, $6::jsonb, $6::jsonb, $7, 'active', current_date - 30,
               $8, $9, $10, $10, statement_timestamp())`,
      [
        f.fund,
        f.regime,
        f.tenant,
        f.property,
        f.resolution,
        policy,
        sha256(policy),
        `fixture-fund-${f.fund}`,
        sha256(`fixture-fund-${f.fund}`),
        f.actor,
      ],
    );
    await client.query(
      `insert into finance.statutory_fund_movements
         (id, fund_id, cycle_id, tenant_id, property_id, statutory_simple_entry_id,
          delta, cash_effect, movement_kind, amount, unit_id, party_id,
          named_receipt_reference, supporting_document_reference, source_snapshot,
          source_hash, idempotency_key, payload_hash, created_by)
       values ($1, $2, $3, $4, $5, $6, 'increase', 'receipt', 'owner_contribution', 200,
               $7, $8, 'RECEIPT-SEED-200', 'EPHEMERAL-SEED', $9::jsonb, $10, $11, $12, $13)`,
      [
        f.seedMovement,
        f.fund,
        f.cycle,
        f.tenant,
        f.property,
        f.seedEntry,
        f.unit,
        f.outgoingParty,
        seedSnapshot,
        sha256(seedSnapshot),
        `seed-movement-${f.seedMovement}`,
        sha256(`seed-movement-${f.seedMovement}`),
        f.actor,
      ],
    );
    await client.query('commit');
  } catch (error) {
    await rollbackQuietly(client);
    throw error;
  }
}

async function createConveyances(client, f) {
  await beginAsServiceRole(client);
  try {
    const refundPayload = sha256(`refund-conveyance-${f.refundConveyance}`);
    const retentionPayload = sha256(`retention-conveyance-${f.retentionConveyance}`);
    const refund = await client.query(
      `select * from app_private.create_working_capital_conveyance_v1(
         $1, $2, $3, $4, current_date, 'refund_transferor', null,
         '{"deed":"default-refund"}'::jsonb, $5, $6, $7
       )`,
      [
        f.fund,
        f.unit,
        f.outgoingOwnership,
        f.incomingRefundOwnership,
        f.actor,
        `create-refund-${f.refundConveyance}`,
        refundPayload,
      ],
    );
    const retention = await client.query(
      `select * from app_private.create_working_capital_conveyance_v1(
         $1, $2, $3, $4, current_date, 'transfer_to_acquirer_by_deed', 'DEED-EPHEMERAL',
         '{"deed":"retention"}'::jsonb, $5, $6, $7
       )`,
      [
        f.fund,
        f.unit,
        f.outgoingOwnership,
        f.incomingRetentionOwnership,
        f.actor,
        `create-retention-${f.retentionConveyance}`,
        retentionPayload,
      ],
    );
    f.refundConveyance = refund.rows[0].id;
    f.retentionConveyance = retention.rows[0].id;
    assert.equal(refund.rows[0].frozen_owner_balance, '200.00');
    assert.equal(retention.rows[0].frozen_owner_balance, '200.00');
    await client.query('commit');
  } catch (error) {
    await rollbackQuietly(client);
    throw error;
  }
}

async function movementCall(client, f, suffix) {
  return client.query(
    `select * from app_private.record_statutory_fund_movement_v1(
       $1, $2, $3, null, null, null,
       'increase', 'owner_contribution', null, 70,
       $4, $5, $6, null, $7, null,
       $8::jsonb, $9, $10, $11
     )`,
    [
      f.fund,
      f.cycle,
      f.classificationEntry,
      f.unit,
      f.incomingRefundParty,
      `RECEIPT-RACE-${suffix}`,
      `Movement race ${suffix}`,
      JSON.stringify({ race: 'simple-entry-classification', contender: suffix }),
      f.actor,
      `movement-race-${suffix}-${f.fund}`,
      sha256(`movement-race-${suffix}-${f.fund}`),
    ],
  );
}

async function runMovementRace(observer, winner, waiter, f) {
  console.log('\n[Race 1] Two movements compete for one 100 RON simple entry');
  await beginAsServiceRole(winner);
  const winnerResult = await movementCall(winner, f, 'winner');
  assert.equal(winnerResult.rowCount, 1);

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterError;
  const pending = movementCall(waiter, f, 'waiter').catch((error) => {
    waiterError = error;
  });

  await waitForBlocking(observer, waiterPid, winnerPid);
  console.log(`  observed PID ${waiterPid} blocked by PID ${winnerPid}`);
  await winner.query('commit');
  await pending;
  expectSqlState(waiterError, '23514', 'same-entry overclassification loser');
  assert.equal(waiterError.message, 'statutory_simple_entry_overclassified');
  await rollbackQuietly(waiter);

  const proof = await observer.query(
    `select count(*)::int as movement_count, coalesce(sum(amount), 0)::numeric(20,2) as classified
       from finance.statutory_fund_movements
      where statutory_simple_entry_id = $1`,
    [f.classificationEntry],
  );
  assert.equal(proof.rows[0].movement_count, 1);
  assert.equal(proof.rows[0].classified, '70.00');
  console.log('  PASS: exactly one 70 RON classification committed; overclassification failed closed');
}

async function finalizeRefund(client, f) {
  return client.query(
    `select * from app_private.finalize_working_capital_conveyance_v1(
       $1, 1, $2, 'LEGAL-SIGNOFF-EPHEMERAL', $3, 'Conveyance refund concurrency winner'
     )`,
    [f.refundConveyance, f.refundEntry, f.actor],
  );
}

async function finalizeRetention(client, f) {
  return client.query(
    `select * from app_private.finalize_working_capital_conveyance_v1(
       $1, 1, null, 'LEGAL-SIGNOFF-EPHEMERAL', $2, 'Deed retention concurrency contender'
     )`,
    [f.retentionConveyance, f.actor],
  );
}

async function runConveyanceRace(observer, winner, waiter, f) {
  console.log('\n[Race 2] Refund versus deed retention on one statutory fund lock');
  await beginAsServiceRole(winner);
  const refund = await finalizeRefund(winner, f);
  assert.equal(refund.rows[0].status, 'finalized');

  await beginAsServiceRole(waiter);
  const waiterPid = await backendPid(waiter);
  const winnerPid = await backendPid(winner);
  let waiterError;
  const pending = finalizeRetention(waiter, f).catch((error) => {
    waiterError = error;
  });

  await waitForBlocking(observer, waiterPid, winnerPid);
  console.log(`  observed PID ${waiterPid} blocked by PID ${winnerPid} on shared statutory_fund lock`);
  await winner.query('commit');
  await pending;
  expectSqlState(waiterError, '40001', 'refund-versus-retention loser');
  assert.equal(waiterError.message, 'working_capital_conveyance_balance_changed');
  await rollbackQuietly(waiter);

  const proof = await observer.query(
    `select
       (select status from finance.statutory_working_capital_conveyances where id = $1) as refund_status,
       (select status from finance.statutory_working_capital_conveyances where id = $2) as retention_status,
       (select count(*)::int from finance.statutory_fund_movements
         where conveyance_id in ($1, $2)) as zero_cash_transfer_legs,
       (select count(*)::int from finance.statutory_fund_movements
         where statutory_simple_entry_id = $3 and movement_kind = 'refund') as refund_legs`,
    [f.refundConveyance, f.retentionConveyance, f.refundEntry],
  );
  assert.equal(proof.rows[0].refund_status, 'finalized');
  assert.equal(proof.rows[0].retention_status, 'draft');
  assert.equal(proof.rows[0].zero_cash_transfer_legs, 0);
  assert.equal(proof.rows[0].refund_legs, 1);
  console.log('  PASS: refund finalized once; conflicting deed retention remained draft with zero transfer legs');
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
    await createConveyances(observer, f);
    await runMovementRace(observer, winner, waiter, f);
    await runConveyanceRace(observer, winner, waiter, f);
    console.log('\nR10 PHASE 2A CONCURRENCY: PASS');
  } finally {
    await Promise.allSettled([rollbackQuietly(winner), rollbackQuietly(waiter)]);
    await Promise.allSettled([observer?.end(), winner?.end(), waiter?.end()]);
  }
}

run().catch((error) => {
  console.error('\nR10 PHASE 2A CONCURRENCY: FAIL');
  console.error(error);
  process.exitCode = 1;
});
