-- R10 Phase 2B: Romanian HOA cash-desk discipline, 24h deposit obligation,
-- EOD 50,000 RON ceiling and business-day calculation under Law 196/2018 & Law 70/2015.
begin;
select plan(45);

-- 1. Structural, RLS and ACL contracts
select has_table('finance', 'statutory_compliance_calendars', 'statutory compliance calendar table exists');
select has_table('finance', 'statutory_cash_desks', 'statutory cash desks table exists');
select has_table('finance', 'statutory_cash_entry_assignments', 'statutory cash entry assignments table exists');
select has_table('finance', 'statutory_cash_custody_transfers', 'statutory cash custody transfers table exists');
select has_table('finance', 'statutory_cash_daily_closures', 'statutory cash daily closures table exists');
select has_table('finance', 'statutory_cash_deposit_obligations', 'statutory cash deposit obligations table exists');

select has_function('finance', 'add_romanian_business_days_v1', array['date', 'integer', 'character'], 'business days calculation function exists');
select has_function('finance', 'statutory_cash_balance_v1', array['uuid'], 'derived statutory cash balance function exists');

select has_function(
  'app_private', 'create_statutory_cash_desk_v1',
  array['uuid', 'text', 'text', 'numeric', 'uuid', 'text', 'text'],
  'controlled cash desk creation RPC exists'
);
select has_function(
  'app_private', 'activate_statutory_cash_desk_v1',
  array['uuid', 'integer', 'uuid', 'text'],
  'controlled cash desk activation RPC exists'
);
select has_function(
  'app_private', 'assign_cash_simple_entry_v1',
  array['uuid', 'uuid', 'uuid', 'text', 'text'],
  'controlled cash entry assignment RPC exists'
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
  'app_private', 'settle_cash_deposit_obligation_v1',
  array['uuid', 'uuid', 'numeric', 'uuid', 'text'],
  'controlled deposit obligation settlement RPC exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_desks'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_daily_closures'::regclass),
  'cash desks and closures have RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'finance.statutory_cash_desks', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_cash_desks', 'INSERT,UPDATE,DELETE')
  and not has_function_privilege('anon', 'app_private.create_statutory_cash_desk_v1(uuid,text,text,numeric,uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app_private.create_statutory_cash_desk_v1(uuid,text,text,numeric,uuid,text,text)', 'EXECUTE'),
  'anon and authenticated roles have zero mutation access to cash desk RPCs'
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

-- 3. Cash Desk Creation and Activation
select lives_ok(
  $$select * from app_private.create_statutory_cash_desk_v1(
      '09700000-0000-0000-0000-000000000050', 'CASH-MAIN', 'Casierie Centrala',
      50000.00, '09700000-0000-0000-0000-000000000001', 'idemp-desk-097', repeat('1', 64)
    )$$,
  'cash desk is created in draft status'
);

select ok(
  (select status = 'draft' and daily_ceiling_amount = 50000.00 and currency = 'RON'
     from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
  'cash desk draft defaults and ceiling verified'
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
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-bank', repeat('2', 64)
    )$$,
  '23514', 'only_cash_entries_can_be_assigned_to_cash_desk',
  'non-cash entry cannot be assigned to cash desk'
);

select throws_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000082', -- Cash payment of 5000 RON when balance is 0.00
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-pay-nobal', repeat('3', 64)
    )$$,
  '23514', 'cash_desk_balance_insufficient',
  'cash payment cannot be assigned if it causes negative balance'
);

-- 5. Cash Receipt Assignment & Automatic 24h HOA Deposit Obligation (Law 196/2018 Art. 67(2))
select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000081', -- Cash receipt of 60,000 RON
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-rec', repeat('4', 64)
    )$$,
  'cash receipt assigned to cash desk'
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
       and status = 'pending'
  ),
  'deterministic 24-hour bank-deposit obligation created under Law 196/2018 Art. 67(2)'
);

-- One cash entry can only be assigned once (Invariant 7)
select throws_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000081',
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-rec-dup', repeat('5', 64)
    )$$,
  '23505',
  'cash entry cannot be assigned multiple times'
);

-- Now assign the payment of 5,000 RON
select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000082',
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

-- Closure immutability (Invariant 11)
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

-- 8. Internal Custody Transfer (Bank Deposit) & Obligation Settlement
select lives_ok(
  $$select * from app_private.record_cash_custody_transfer_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000070', 'bank_deposit', 50000.00,
      date '2026-06-16', 'DEPOZIT-BT-097-01', null,
      '09700000-0000-0000-0000-000000000001', 'idemp-dep-097', repeat('9', 64)
    )$$,
  'bank deposit custody transfer recorded'
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
      50000.00, '09700000-0000-0000-0000-000000000001', 'partial settlement of 60k obligation'
    )$$,
  'partial settlement of 24h deposit obligation recorded'
);

select ok(
  (select status = 'partially_settled' and settled_amount = 50000.00
     from finance.statutory_cash_deposit_obligations where obligation_kind = 'hoa_24h_receipt'),
  'obligation status is partially_settled'
);

-- Settlement cannot exceed required amount
select throws_ok(
  $$select * from app_private.settle_cash_deposit_obligation_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'hoa_24h_receipt'),
      (select id from finance.statutory_cash_custody_transfers where idempotency_key = 'idemp-dep-097'),
      20000.00, '09700000-0000-0000-0000-000000000001', 'excessive settlement attempt'
    )$$,
  '23514', 'settlement_amount_exceeds_obligation',
  'settlement exceeding remaining required amount is rejected'
);

-- Settle the 50k ceiling excess obligation
select lives_ok(
  $$select * from app_private.record_cash_custody_transfer_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000070', 'bank_deposit', 5000.00,
      date '2026-06-16', 'DEPOZIT-BT-097-02', null,
      '09700000-0000-0000-0000-000000000001', 'idemp-dep-097-2', repeat('a', 64)
    )$$,
  'second bank deposit of 5000 RON recorded'
);

select lives_ok(
  $$select * from app_private.settle_cash_deposit_obligation_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
      (select id from finance.statutory_cash_custody_transfers where idempotency_key = 'idemp-dep-097-2'),
      5000.00, '09700000-0000-0000-0000-000000000001', 'full settlement of 5k ceiling obligation'
    )$$,
  'ceiling excess obligation fully settled'
);

select ok(
  (select status = 'settled' and settled_amount = 5000.00 and settled_at is not null
     from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
  'ceiling obligation status is settled and settled_at timestamp populated'
);

-- 9. Documented 3-Business-Day Exception Validation
select ok(
  (select has_exception = false from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
  'obligation has no exception by default'
);

-- Audit completeness
select ok(
  (select count(*) >= 6 from audit.events where tenant_id = '09700000-0000-0000-0000-000000000010'),
  'audit events logged for cash desk operations'
);

rollback;
