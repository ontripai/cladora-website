-- R10 Phase 2B: Romanian HOA cash-desk discipline, 24h deposit obligation,
-- EOD 50,000 RON ceiling, Art. 4² 3-day exceptions, and bank deposit settlements.
begin;
select plan(63);

-- 1. Structural, RLS and ACL contracts
select has_table('finance', 'statutory_compliance_calendars', 'statutory compliance calendar table exists');
select has_table('finance', 'statutory_cash_desks', 'statutory cash desks table exists');
select has_table('finance', 'statutory_cash_entry_assignments', 'statutory cash entry assignments table exists');
select has_table('finance', 'statutory_cash_custody_transfers', 'statutory cash custody transfers table exists');
select has_table('finance', 'statutory_cash_daily_closures', 'statutory cash daily closures table exists');
select has_table('finance', 'statutory_cash_deposit_obligations', 'statutory cash deposit obligations table exists');
select has_table('finance', 'statutory_cash_deposit_obligation_exceptions', 'statutory deposit obligation exceptions table exists');
select has_table('finance', 'statutory_cash_deposit_settlements', 'statutory deposit settlements table exists');
select has_table('finance', 'statutory_cash_receipt_petty_cash_retentions', 'statutory cash receipt petty cash retentions table exists');

select has_function('finance', 'add_romanian_business_days_v1', array['date', 'integer', 'character'], 'business days calculation function exists');
select has_function('finance', 'statutory_cash_balance_v1', array['uuid'], 'derived statutory cash balance function exists');

select has_function(
  'app_private', 'create_statutory_cash_desk_v1',
  array['uuid', 'text', 'text', 'uuid', 'text', 'text'],
  'controlled cash desk creation RPC exists without configurable ceiling'
);
select has_function(
  'app_private', 'activate_statutory_cash_desk_v1',
  array['uuid', 'integer', 'uuid', 'text'],
  'controlled cash desk activation RPC exists'
);
select has_function(
  'app_private', 'assign_cash_simple_entry_v1',
  array['uuid', 'uuid', 'timestamp with time zone', 'uuid', 'text', 'text'],
  'controlled cash entry assignment RPC exists with explicit received_at'
);
select has_function(
  'app_private', 'record_cash_custody_transfer_v1',
  array['uuid', 'uuid', 'finance.statutory_custody_transfer_kind', 'numeric', 'date', 'text', 'uuid', 'uuid', 'text', 'text'],
  'controlled cash custody transfer RPC exists'
);
select has_function(
  'app_private', 'close_statutory_cash_day_v1',
  array['uuid', 'date', 'uuid', 'text', 'text'],
  'controlled daily cash closure RPC exists'
);
select has_function(
  'app_private', 'record_deposit_obligation_exception_v1',
  array['uuid', 'numeric', 'text', 'date', 'text', 'uuid', 'text', 'text'],
  'controlled Art. 4² exception recording RPC exists'
);
select has_function(
  'app_private', 'settle_cash_deposit_obligation_v1',
  array['uuid', 'uuid', 'numeric', 'uuid', 'text', 'text', 'text'],
  'controlled deposit obligation settlement RPC exists with idempotency'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_desks'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_daily_closures'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_deposit_settlements'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_deposit_obligation_exceptions'::regclass),
  'cash desks, closures, settlements and exceptions have RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'finance.statutory_cash_desks', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_cash_desks', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'finance.statutory_cash_deposit_settlements', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_cash_deposit_settlements', 'INSERT,UPDATE,DELETE')
  and not has_function_privilege('anon', 'app_private.create_statutory_cash_desk_v1(uuid,text,text,uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app_private.create_statutory_cash_desk_v1(uuid,text,text,uuid,text,text)', 'EXECUTE'),
  'anon and authenticated roles have zero mutation access to cash desk tables and RPCs'
);

-- 2. Fixture Setup (097 Isolated Space)
insert into auth.users (id, email) values
  ('09700000-0000-0000-0000-000000000001', 'r10-phase2b-cash@cladora.test');

insert into platform.tenants (id, legal_name, registration_number, status) values
  ('09700000-0000-0000-0000-000000000010', 'R10 Phase 2B Ephemeral Tenant', 'RO-R10-097', 'active');

insert into platform.customer_workspaces (
  id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment
) values (
  '09700000-0000-0000-0000-000000000020', '09700000-0000-0000-0000-000000000010',
  'ASSOCIATION', 'ACTIVE', 'R10 Test', 'PILOT'
);

insert into portfolio.properties (id, tenant_id, type, name, status) values
  ('09700000-0000-0000-0000-000000000030', '09700000-0000-0000-0000-000000000010', 'condominium', 'Property 097', 'active'),
  ('09700000-0000-0000-0000-000000000031', '09700000-0000-0000-0000-000000000010', 'condominium', 'Other Property 097', 'active');

insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status) values
  ('09700000-0000-0000-0000-000000000040', '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030', date '2026-06-01', date '2026-06-30', 'open');

insert into finance.statutory_accounting_regimes (
  id, tenant_id, customer_workspace_id, property_id, status, statutory_operations_enabled,
  accounting_signoff_reference, accounting_signed_at, legal_signoff_reference, legal_signed_at,
  activated_at, valid_from
) values (
  '09700000-0000-0000-0000-000000000050', '09700000-0000-0000-0000-000000000010',
  '09700000-0000-0000-0000-000000000020', '09700000-0000-0000-0000-000000000030',
  'active', true, 'CECCAR-097', statement_timestamp(), 'LEGAL-097', statement_timestamp(),
  statement_timestamp(), date '2026-01-01'
);

insert into finance.statutory_monthly_cycles (
  id, regime_id, tenant_id, property_id, accounting_period_id, status
) values (
  '09700000-0000-0000-0000-000000000060', '09700000-0000-0000-0000-000000000050',
  '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030',
  '09700000-0000-0000-0000-000000000040', 'collecting'
);

insert into payments.bank_accounts (
  id, tenant_id, property_id, iban_encrypted, iban_fingerprint, bank_name, currency, status
) values (
  '09700000-0000-0000-0000-000000000070', '09700000-0000-0000-0000-000000000010',
  '09700000-0000-0000-0000-000000000030', 'enc-iban-097', 'fp-iban-097', 'Banca Transilvania', 'RON', 'active'
);

-- Statutory Simple Entries: Cash Receipt, Cash Payment, and Bank Receipt
insert into finance.statutory_simple_entries (
  id, cycle_id, tenant_id, property_id, entry_date, direction, payment_medium,
  document_type, document_number, amount, description, created_by
) values
  ('09700000-0000-0000-0000-000000000081', '09700000-0000-0000-0000-000000000060',
   '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030',
   date '2026-06-15', 'receipt', 'cash', 'CHITANTA', 'CH-097-1', 60000.00, 'Maintenance quota cash receipt',
   '09700000-0000-0000-0000-000000000001'),
  ('09700000-0000-0000-0000-000000000082', '09700000-0000-0000-0000-000000000060',
   '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030',
   date '2026-06-15', 'payment', 'cash', 'DISPOZITIE', 'DP-097-1', 5000.00, 'Emergency plumbing cash payment',
   '09700000-0000-0000-0000-000000000001'),
  ('09700000-0000-0000-0000-000000000083', '09700000-0000-0000-0000-000000000060',
   '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030',
   date '2026-06-15', 'receipt', 'bank', 'EXTRAS', 'EX-097-1', 1000.00, 'Bank transfer quota',
   '09700000-0000-0000-0000-000000000001');

-- 3. Cash Desk Creation and Fixed 50,000 RON Ceiling
select lives_ok(
  $$select * from app_private.create_statutory_cash_desk_v1(
      '09700000-0000-0000-0000-000000000050', 'CASH-MAIN', 'Casierie Centrala',
      '09700000-0000-0000-0000-000000000001', 'idemp-desk-097', repeat('1', 64)
    )$$,
  'cash desk is created in draft status'
);

select ok(
  (select status = 'draft' and daily_ceiling_amount = 50000.00 and currency = 'RON'
     from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
  'cash desk draft defaults and fixed 50000 RON ceiling verified'
);

-- Blocker 4: DB check constraint rejects non-50000 RON ceiling
select throws_ok(
  $$insert into finance.statutory_cash_desks (
      tenant_id, property_id, regime_id, code, name, currency, daily_ceiling_amount,
      idempotency_key, payload_hash, created_by
    ) values (
      '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030',
      '09700000-0000-0000-0000-000000000050', 'CASH-BAD', 'Bad Ceiling', 'RON', 49999.00,
      'idemp-desk-bad', repeat('f', 64), '09700000-0000-0000-0000-000000000001'
    )$$,
  '23514', null,
  'database check constraint strictly rejects any ceiling other than 50000.00 RON'
);

select lives_ok(
  $$select * from app_private.activate_statutory_cash_desk_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      1, '09700000-0000-0000-0000-000000000001', 'activation for operations'
    )$$,
  'cash desk is activated successfully'
);

select ok(
  (select status = 'active' and lock_version = 2
     from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
  'cash desk status is active and lock_version advanced'
);

-- 4. Entry Assignment Constraints & Cross-Scope Rejection
select throws_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000083', -- Bank medium entry
      timestamptz '2026-06-15 10:00:00+03',
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-bank', repeat('2', 64)
    )$$,
  '23514', 'only_cash_entries_can_be_assigned_to_cash_desk',
  'non-cash entry cannot be assigned to cash desk'
);

select throws_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000082', -- Cash payment of 5000 RON when balance is 0.00
      null,
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-pay-nobal', repeat('3', 64)
    )$$,
  '23514', 'cash_desk_balance_insufficient',
  'cash payment cannot be assigned if it causes negative balance'
);

-- Blocker 8: received_at validation
select throws_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000081',
      null, -- Missing received_at for receipt
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-no-ts', repeat('3', 64)
    )$$,
  '22023', 'receipt_requires_received_at_timestamp',
  'cash receipt requires explicit received_at timestamp'
);

select throws_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000081',
      clock_timestamp() + interval '1 day', -- Future timestamp
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-future-ts', repeat('3', 64)
    )$$,
  '22023', 'received_at_cannot_be_in_future',
  'future received_at timestamp is rejected'
);

-- 5. Cash Receipt Assignment & Exact 24h HOA Deposit Obligation
select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000081', -- Cash receipt of 60,000 RON
      timestamptz '2026-06-15 14:30:00+03',
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-rec', repeat('4', 64)
    )$$,
  'cash receipt assigned to cash desk with exact received_at timestamp'
);

select ok(
  (select finance.statutory_cash_balance_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097')
    ) = 60000.00),
  'derived cash balance equals 60000 RON after receipt assignment'
);

select ok(
  exists(
    select 1 from finance.statutory_cash_deposit_obligations
     where statutory_simple_entry_id = '09700000-0000-0000-0000-000000000081'
       and obligation_kind = 'hoa_24h_receipt'
       and required_amount = 60000.00
       and due_at = timestamptz '2026-06-15 14:30:00+03' + interval '24 hours'
       and status = 'pending'
  ),
  'deterministic 24-hour bank-deposit obligation created exactly 24h from received_at'
);

-- One cash entry can only be assigned once
select throws_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000081',
      timestamptz '2026-06-15 14:30:00+03',
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-rec-dup', repeat('5', 64)
    )$$,
  '23505', null,
  'cash entry cannot be assigned multiple times'
);

-- Assign payment of 5,000 RON
select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000082',
      null,
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-pay', repeat('6', 64)
    )$$,
  'cash payment assigned when balance is sufficient'
);

select ok(
  (select finance.statutory_cash_balance_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097')
    ) = 55000.00),
  'derived balance correctly decrements to 55000 RON'
);

-- 6. Romanian Compliance Calendar & Business Day Calculations
select ok(
  (select finance.add_romanian_business_days_v1(date '2026-06-12', 2) = date '2026-06-16'),
  '2 business days from Friday 2026-06-12 is Tuesday 2026-06-16 (skipping weekend)'
);

-- Calendar coverage fail-closed: date 2035 is not in calendar
select throws_ok(
  $$select finance.add_romanian_business_days_v1(date '2035-01-01', 2)$$,
  '22023', 'compliance_calendar_coverage_missing',
  'business day calculation fails closed when calendar coverage is missing'
);

-- 7. Daily Cash Closure and 50,000 RON Ceiling Evaluation (Law 70/2015 Art. 4²)
select lives_ok(
  $$select * from app_private.close_statutory_cash_day_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      date '2026-06-15', '09700000-0000-0000-0000-000000000001', 'idemp-close-097', repeat('7', 64)
    )$$,
  'end-of-day cash closure recorded successfully'
);

select ok(
  (select closing_balance = 55000.00 and ceiling_exceeded = true and excess_amount = 5000.00
     from finance.statutory_cash_daily_closures where idempotency_key = 'idemp-close-097'),
  'daily closure detected 50000 RON ceiling excess of 5000 RON'
);

select ok(
  exists(
    select 1 from finance.statutory_cash_deposit_obligations
     where obligation_kind = 'ceiling_50k_excess'
       and required_amount = 5000.00
       and status = 'pending'
  ),
  'deposit obligation for 50k ceiling excess created due in 2 business days'
);

-- Closure immutability
select throws_ok(
  $$delete from finance.statutory_cash_daily_closures where idempotency_key = 'idemp-close-097'$$,
  '55000', 'finalized_cash_closure_is_immutable',
  'finalized daily closure cannot be deleted'
);

-- Day cannot be closed twice
select throws_ok(
  $$select * from app_private.close_statutory_cash_day_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      date '2026-06-15', '09700000-0000-0000-0000-000000000001', 'idemp-close-dup', repeat('8', 64)
    )$$,
  '23505', 'statutory_cash_day_already_closed',
  'same date cannot be closed multiple times for a cash desk'
);

-- Blocker 8 & 9: Mutation on finalized day is rejected
select throws_ok(
  $$select * from app_private.record_cash_custody_transfer_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000070', 'bank_deposit', 1000.00,
      date '2026-06-15', -- On closed date
      'BACKDATED-DEP', null,
      '09700000-0000-0000-0000-000000000001', 'idemp-dep-backdated', repeat('9', 64)
    )$$,
  '55000', 'cash_desk_day_already_finalized',
  'custody transfer on finalized closure date is rejected'
);

-- Blocker 8: Closure calendar gap detected (skipping 2026-06-16 and trying 2026-06-17)
select throws_ok(
  $$select * from app_private.close_statutory_cash_day_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      date '2026-06-17', '09700000-0000-0000-0000-000000000001', 'idemp-close-gap', repeat('8', 64)
    )$$,
  '22023', 'cash_closure_calendar_gap_detected',
  'skipping calendar days in cash closure sequence is rejected'
);

-- 8. Law 70/2015 Art. 4²(2) 3-Business-Day Exception Validation
select throws_ok(
  $$select * from app_private.record_deposit_obligation_exception_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'hoa_24h_receipt'),
      1000.00, 'personnel_rights', date '2026-06-16', 'Salarii casier',
      '09700000-0000-0000-0000-000000000001', 'idemp-ex-wrong-kind', repeat('a', 64)
    )$$,
  '22023', 'exception_only_allowed_for_50k_ceiling_excess',
  'exception cannot be recorded against 24-hour receipt obligations'
);

select throws_ok(
  $$select * from app_private.record_deposit_obligation_exception_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
      1000.00, 'unauthorized_class', date '2026-06-16', 'Salarii casier',
      '09700000-0000-0000-0000-000000000001', 'idemp-ex-bad-class', repeat('a', 64)
    )$$,
  '22023', 'deposit_obligation_exception_invalid_arguments',
  'exception with non-statutory beneficiary class is rejected'
);

select throws_ok(
  $$select * from app_private.record_deposit_obligation_exception_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
      6000.00, 'personnel_rights', date '2026-06-16', 'Salarii casier',
      '09700000-0000-0000-0000-000000000001', 'idemp-ex-over', repeat('a', 64)
    )$$,
  '23514', 'exception_amount_exceeds_obligation',
  'exception amount exceeding obligation required amount is rejected'
);

-- Record valid exception of 3,000 RON (partially covers 5,000 RON excess)
select lives_ok(
  $$select * from app_private.record_deposit_obligation_exception_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
      3000.00, 'personnel_rights', date '2026-06-16', 'Stat de plata salarii personal ingrijire',
      '09700000-0000-0000-0000-000000000001', 'idemp-ex-valid', repeat('b', 64)
    )$$,
  'valid 3-business-day exception recorded for personnel rights'
);

select ok(
  (select expiry_date = date '2026-06-19' and covered_amount = 3000.00
     from finance.statutory_cash_deposit_obligation_exceptions where idempotency_key = 'idemp-ex-valid'),
  'exception expiry is calculated as 3 Romanian business days from scheduled date'
);

-- Exception immutability
select throws_ok(
  $$delete from finance.statutory_cash_deposit_obligation_exceptions where idempotency_key = 'idemp-ex-valid'$$,
  '55000', 'statutory_deposit_exception_is_immutable',
  'exception record is immutable and cannot be deleted'
);

-- 9. Internal Custody Transfer (Bank Deposit) & Append-Only Settlement
select lives_ok(
  $$select * from app_private.record_cash_custody_transfer_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000070', 'bank_deposit', 50000.00,
      date '2026-06-16', 'DEPOZIT-BT-097-01', null,
      '09700000-0000-0000-0000-000000000001', 'idemp-dep-097', repeat('c', 64)
    )$$,
  'bank deposit custody transfer recorded on 2026-06-16'
);

select ok(
  (select finance.statutory_cash_balance_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097')
    ) = 5000.00),
  'cash desk balance decremented by bank deposit to 5000 RON'
);

-- Settle 24h deposit obligation with the bank deposit
select lives_ok(
  $$select * from app_private.settle_cash_deposit_obligation_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'hoa_24h_receipt'),
      (select id from finance.statutory_cash_custody_transfers where idempotency_key = 'idemp-dep-097'),
      50000.00, '09700000-0000-0000-0000-000000000001', 'partial settlement of 60k obligation',
      'idemp-settle-097-1', repeat('d', 64)
    )$$,
  'partial settlement of 24h deposit obligation recorded in settlements table'
);

select ok(
  (select status = 'partially_settled' and settled_amount = 50000.00
     from finance.statutory_cash_deposit_obligations where obligation_kind = 'hoa_24h_receipt'),
  'obligation projected status is partially_settled and settled_amount is 50000 RON'
);

-- Settlement replay is idempotent
select ok(
  (select id from app_private.settle_cash_deposit_obligation_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'hoa_24h_receipt'),
      (select id from finance.statutory_cash_custody_transfers where idempotency_key = 'idemp-dep-097'),
      50000.00, '09700000-0000-0000-0000-000000000001', 'replay',
      'idemp-settle-097-1', repeat('d', 64)
    )) = (select id from finance.statutory_cash_deposit_settlements where idempotency_key = 'idemp-settle-097-1'),
  'settlement replay with identical key and payload returns existing settlement without duplicate allocation'
);

-- Blocker 3: Double-spending custody transfer is rejected
select throws_ok(
  $$select * from app_private.settle_cash_deposit_obligation_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
      (select id from finance.statutory_cash_custody_transfers where idempotency_key = 'idemp-dep-097'), -- already 50k allocated
      5000.00, '09700000-0000-0000-0000-000000000001', 'double spend attempt',
      'idemp-settle-double-spend', repeat('e', 64)
    )$$,
  '23514', 'custody_transfer_capacity_exceeded',
  'settlement exceeding custody transfer capacity is rejected (prevents double-spend)'
);

-- Settlement immutability
select throws_ok(
  $$delete from finance.statutory_cash_deposit_settlements where idempotency_key = 'idemp-settle-097-1'$$,
  '55000', 'statutory_deposit_settlement_is_immutable',
  'settlement allocation record is immutable and cannot be deleted'
);

-- Settle the 50k ceiling excess obligation with a new bank deposit
select lives_ok(
  $$select * from app_private.record_cash_custody_transfer_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000070', 'bank_deposit', 5000.00,
      date '2026-06-16', 'DEPOZIT-BT-097-02', null,
      '09700000-0000-0000-0000-000000000001', 'idemp-dep-097-2', repeat('e', 64)
    )$$,
  'second bank deposit of 5000 RON recorded'
);

select lives_ok(
  $$select * from app_private.settle_cash_deposit_obligation_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
      (select id from finance.statutory_cash_custody_transfers where idempotency_key = 'idemp-dep-097-2'),
      5000.00, '09700000-0000-0000-0000-000000000001', 'full settlement of 5k ceiling obligation',
      'idemp-settle-097-2', repeat('f', 64)
    )$$,
  'ceiling excess obligation fully settled'
);

select ok(
  (select status = 'settled' and settled_amount = 5000.00 and settled_at is not null
     from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
  'ceiling obligation status is settled and settled_at timestamp populated'
);

-- Now close 2026-06-16 cleanly (no gap)
select lives_ok(
  $$select * from app_private.close_statutory_cash_day_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      date '2026-06-16', '09700000-0000-0000-0000-000000000001', 'idemp-close-097-2', repeat('f', 64)
    )$$,
  'subsequent daily closure for next consecutive calendar date succeeds'
);

select ok(
  (select opening_balance = 55000.00 and closing_balance = 0.00
     from finance.statutory_cash_daily_closures where idempotency_key = 'idemp-close-097-2'),
  'consecutive day opening balance matches previous day closing balance exactly'
);

-- Audit completeness
select ok(
  (select count(*) >= 8 from audit.events where tenant_id = '09700000-0000-0000-0000-000000000010'),
  'audit events logged for cash desk operations'
);

rollback;
