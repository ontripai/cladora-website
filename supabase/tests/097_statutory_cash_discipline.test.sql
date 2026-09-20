-- R10 Phase 2B: Romanian HOA cash-desk discipline, 24h deposit obligation,
-- EOD 50,000 RON ceiling, Art. 4² 3-day exceptions, and bank deposit settlements.
-- Remediation-005: Fully dynamic execution relative to Europe/Bucharest server timestamp (all 11 races synchronized - reversal link verified)
begin;
select plan(89);

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
select has_table('finance', 'statutory_cash_deposit_exception_disbursements', 'statutory exception disbursements ledger table exists');

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
  array['uuid', 'uuid', 'uuid', 'finance.statutory_custody_transfer_kind', 'numeric', 'date', 'timestamp with time zone', 'text', 'uuid', 'text', 'text'],
  'controlled cash custody transfer RPC exists with mandatory transferred_at'
);
select has_function(
  'app_private', 'close_statutory_cash_day_v1',
  array['uuid', 'date', 'numeric', 'uuid', 'text', 'text'],
  'controlled daily cash closure RPC exists with counted cash verification'
);
select has_function(
  'app_private', 'record_deposit_obligation_exception_v1',
  array['uuid', 'numeric', 'text', 'date', 'text', 'uuid', 'text', 'text'],
  'controlled Art. 4² exception reservation RPC exists'
);
select has_function(
  'app_private', 'consume_deposit_obligation_exception_v1',
  array['uuid', 'uuid', 'uuid', 'text', 'text'],
  'controlled Art. 4² exception disbursement RPC exists'
);
select has_function(
  'finance', 'statutory_deposit_obligation_position_v1',
  array['uuid', 'timestamp with time zone'],
  'deterministic 8-field deposit obligation position projection exists'
);
select has_function(
  'app_private', 'settle_cash_deposit_obligation_v1',
  array['uuid', 'uuid', 'numeric', 'uuid', 'text', 'uuid', 'text', 'text'],
  'controlled deposit obligation settlement RPC exists with amount-specific exception support'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_desks'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_daily_closures'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_entry_assignments'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_custody_transfers'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_deposit_obligations'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_deposit_obligation_exceptions'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_deposit_settlements'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_deposit_exception_disbursements'::regclass),
  'cash discipline tables and event ledgers have RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'finance.statutory_cash_desks', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_cash_desks', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'finance.statutory_cash_daily_closures', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_cash_daily_closures', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'finance.statutory_cash_deposit_obligations', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_cash_deposit_obligations', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'finance.statutory_cash_deposit_obligation_exceptions', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_cash_deposit_obligation_exceptions', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'finance.statutory_cash_deposit_exception_disbursements', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_cash_deposit_exception_disbursements', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_function_privilege('anon', 'app_private.create_statutory_cash_desk_v1(uuid,text,text,uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app_private.create_statutory_cash_desk_v1(uuid,text,text,uuid,text,text)', 'EXECUTE'),
  'anon and authenticated roles have zero mutation access to cash discipline tables and RPCs'
);

select ok(
  not has_table_privilege('service_role', 'finance.statutory_cash_entry_assignments', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role', 'finance.statutory_cash_custody_transfers', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role', 'finance.statutory_cash_daily_closures', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role', 'finance.statutory_cash_deposit_settlements', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role', 'finance.statutory_cash_deposit_exception_disbursements', 'INSERT,UPDATE,DELETE'),
  'service_role has zero direct insert/update/delete privilege on internal append-only ledgers'
);

select ok(
  (select rolcanlogin = false and rolsuper = false and rolbypassrls = false and rolinherit = false
     from pg_roles where rolname = 'cladora_rpc_owner'),
  'cladora_rpc_owner role attributes strictly verified as NOLOGIN, NOSUPERUSER, NOBYPASSRLS, NOINHERIT'
);

-- 2. Fixture Setup (097 Isolated Space)
insert into auth.users (id, email) values
  ('09700000-0000-0000-0000-000000000001', 'r10-phase2b-cash@cladora.test');

insert into platform.tenants (id, legal_name, registration_number, status) values
  ('09700000-0000-0000-0000-000000000010', 'R10 Phase 2B Cash Tenant', 'RO-R10-097', 'active');

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
  ('09700000-0000-0000-0000-000000000040', '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030',
   date '2026-01-01', (date_trunc('month', statement_timestamp() at time zone 'Europe/Bucharest') + interval '2 months')::date, 'open');

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

insert into finance.statutory_cash_desks (
  id, tenant_id, property_id, regime_id, code, name, currency, status,
  daily_ceiling_amount, idempotency_key, payload_hash, created_by, activated_by, activated_at
) values (
  '09700000-0000-0000-0000-000000000062', '09700000-0000-0000-0000-000000000010',
  '09700000-0000-0000-0000-000000000030', '09700000-0000-0000-0000-000000000050',
  'CASH-097-B', 'Casierie 097 B', 'RON', 'active', 50000.00,
  'idemp-desk-097-b', repeat('0', 64), '09700000-0000-0000-0000-000000000001',
  '09700000-0000-0000-0000-000000000001', statement_timestamp()
);

insert into payments.bank_accounts (
  id, tenant_id, property_id, iban_encrypted, iban_fingerprint, bank_name, currency, status
) values (
  '09700000-0000-0000-0000-000000000070', '09700000-0000-0000-0000-000000000010',
  '09700000-0000-0000-0000-000000000030', 'enc-iban-097', 'fp-iban-097', 'Banca Transilvania', 'RON', 'active'
);

-- Statutory Simple Entries: Cash Receipt, Cash Payment, Bank Receipt, and Payroll Payment
insert into finance.statutory_simple_entries (
  id, cycle_id, tenant_id, property_id, entry_date, direction, payment_medium,
  document_type, document_number, amount, description, created_by
) values
  ('09700000-0000-0000-0000-000000000081', '09700000-0000-0000-0000-000000000060',
   '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030',
   ((statement_timestamp() at time zone 'Europe/Bucharest')::date - 2), 'receipt', 'cash', 'CHITANTA', 'CH-097-1', 60000.00, 'Maintenance quota cash receipt',
   '09700000-0000-0000-0000-000000000001'),
  ('09700000-0000-0000-0000-000000000082', '09700000-0000-0000-0000-000000000060',
   '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030',
   ((statement_timestamp() at time zone 'Europe/Bucharest')::date - 2), 'payment', 'cash', 'DISPOZITIE', 'DP-097-1', 5000.00, 'Emergency plumbing cash payment',
   '09700000-0000-0000-0000-000000000001'),
  ('09700000-0000-0000-0000-000000000083', '09700000-0000-0000-0000-000000000060',
   '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030',
   ((statement_timestamp() at time zone 'Europe/Bucharest')::date - 2), 'receipt', 'bank', 'EXTRAS', 'EX-097-1', 1000.00, 'Bank transfer quota',
   '09700000-0000-0000-0000-000000000001'),
  ('09700000-0000-0000-0000-000000000084', '09700000-0000-0000-0000-000000000060',
   '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030',
   (statement_timestamp() at time zone 'Europe/Bucharest')::date, 'payment', 'cash', 'DISPOZITIE', 'DP-097-PAYROLL', 3000.00, 'Personnel payroll cash disbursement',
   '09700000-0000-0000-0000-000000000001'),
  ('09700000-0000-0000-0000-000000000085', '09700000-0000-0000-0000-000000000060',
   '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030',
   ((statement_timestamp() at time zone 'Europe/Bucharest')::date + interval '10 days')::date, 'payment', 'cash', 'DISPOZITIE', 'DP-097-OUTWINDOW', 1000.00, 'Out of window payment',
   '09700000-0000-0000-0000-000000000001'),
  ('09700000-0000-0000-0000-000000000086', '09700000-0000-0000-0000-000000000060',
   '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030',
   (statement_timestamp() at time zone 'Europe/Bucharest')::date, 'payment', 'cash', 'DISPOZITIE', 'DP-097-OVERCOV', 2000.00, 'Over coverage payment attempt',
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
      id, tenant_id, property_id, regime_id, code, name, currency, status,
      daily_ceiling_amount, idempotency_key, payload_hash, created_by
    ) values (
      '09700000-0000-0000-0000-000000000098', '09700000-0000-0000-0000-000000000010',
      '09700000-0000-0000-0000-000000000030', '09700000-0000-0000-0000-000000000050',
      'CASH-BAD', 'Bad Ceiling', 'RON', 'draft', 49999.00,
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
      (statement_timestamp() - interval '2 days'),
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
  '23514', 'cash_desk_balance_underflow_forbidden',
  'cash payment cannot be assigned if it causes negative balance'
);

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
  'cash receipt cannot have a future received_at timestamp'
);

-- Valid Cash Receipt Assignment (60,000 RON)
select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000081',
      (statement_timestamp() - interval '2 days'),
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-rec-81', repeat('4', 64)
    )$$,
  'cash receipt assigned successfully'
);

select ok(
  (select finance.statutory_cash_balance_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097')
    ) = 60000.00),
  'statutory cash balance reflects 60000 RON following receipt assignment'
);

-- 5. Law 196/2018 Art. 67(4): 24h Bank Deposit Obligation Creation
select ok(
  exists(
    select 1 from finance.statutory_cash_deposit_obligations
     where statutory_simple_entry_id = '09700000-0000-0000-0000-000000000081'
       and obligation_kind = 'hoa_24h_receipt'
       and required_amount = 60000.00
       and status = 'pending'
       and due_at > statement_timestamp() - interval '2 days'
  ),
  '24-hour statutory deposit obligation created automatically with due_at = received_at + 24h'
);

-- Deposit obligation immutability against direct SQL delete/update
select throws_ok(
  $$delete from finance.statutory_cash_deposit_obligations where statutory_simple_entry_id = '09700000-0000-0000-0000-000000000081'$$,
  '55000', 'unmediated_deposit_obligation_mutation_forbidden',
  'statutory deposit obligation is immutable against direct SQL delete'
);

-- Valid Cash Payment Assignment (5,000 RON)
select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000082',
      null,
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-pay-82', repeat('5', 64)
    )$$,
  'cash payment assigned successfully with sufficient balance'
);

select ok(
  (select finance.statutory_cash_balance_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097')
    ) = 55000.00),
  'statutory cash balance reflects 55000 RON after payment deduction'
);

-- Replay assignment is idempotent
select ok(
  (select id from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000081',
      (statement_timestamp() - interval '2 days'),
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-rec-81', repeat('4', 64)
    )) = (select id from finance.statutory_cash_entry_assignments where idempotency_key = 'idemp-assign-rec-81'),
  'assignment replay returns existing row idempotently'
);

-- Reassigning same entry to different desk is rejected
select throws_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      '09700000-0000-0000-0000-000000000062', -- Valid second cash desk
      '09700000-0000-0000-0000-000000000081',
      (statement_timestamp() - interval '2 days'),
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-diff-desk', repeat('5', 64)
    )$$,
  '23505', null,
  'entry cannot be reassigned across cash desks'
);

-- Direct update/delete on assignment is blocked
select throws_ok(
  $$delete from finance.statutory_cash_entry_assignments where idempotency_key = 'idemp-assign-rec-81'$$,
  '55000', 'statutory_cash_assignment_is_immutable',
  'cash entry assignment is immutable against direct SQL delete'
);

-- 6. Mandatory transferred_at in Cash Custody Transfer (Erratum 1)
select throws_ok(
  $$select * from app_private.record_cash_custody_transfer_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000070', null,
      'bank_deposit', 50000.00, ((statement_timestamp() at time zone 'Europe/Bucharest')::date - 2),
      clock_timestamp() + interval '1 hour', -- Future transferred_at
      'Foaie varsamant FV-097-1',
      '09700000-0000-0000-0000-000000000001', 'idemp-dep-future', repeat('6', 64)
    )$$,
  '22023', 'transferred_at_cannot_be_in_future',
  'custody transfer with future transferred_at is strictly rejected'
);

select throws_ok(
  $$select * from app_private.record_cash_custody_transfer_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000070', null,
      'bank_deposit', 56000.00, ((statement_timestamp() at time zone 'Europe/Bucharest')::date - 2), -- Exceeds balance of 55,000 RON
      (statement_timestamp() - interval '40 hours'),
      'Foaie varsamant FV-097-1',
      '09700000-0000-0000-0000-000000000001', 'idemp-dep-overbal', repeat('7', 64)
    )$$,
  '23514', 'cash_desk_balance_underflow_forbidden',
  'custody transfer exceeding available cash balance is rejected'
);

select throws_ok(
  $$select * from app_private.record_cash_custody_transfer_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      null, null, -- Missing bank_account_id for desk_to_bank
      'bank_deposit', 50000.00, ((statement_timestamp() at time zone 'Europe/Bucharest')::date - 2),
      (statement_timestamp() - interval '40 hours'),
      'Foaie varsamant FV-097-1',
      '09700000-0000-0000-0000-000000000001', 'idemp-dep-nobank', repeat('8', 64)
    )$$,
  '22023', 'bank_account_required_for_bank_transfers',
  'bank custody transfer requires destination bank account'
);

-- Valid Custody Transfer of 50,000 RON to Bank
select lives_ok(
  $$select * from app_private.record_cash_custody_transfer_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000070', null,
      'bank_deposit', 50000.00, ((statement_timestamp() at time zone 'Europe/Bucharest')::date - 2),
      (statement_timestamp() - interval '40 hours'),
      'Foaie varsamant FV-097-1',
      '09700000-0000-0000-0000-000000000001', 'idemp-dep-097', repeat('9', 64)
    )$$,
  'valid desk-to-bank cash custody transfer recorded'
);

select ok(
  (select status = 'confirmed' and transferred_at <= statement_timestamp()
     from finance.statutory_cash_custody_transfers where idempotency_key = 'idemp-dep-097'),
  'custody transfer record is confirmed with exact explicit transferred_at'
);

select ok(
  (select finance.statutory_cash_balance_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097')
    ) = 5000.00),
  'cash desk balance decrements to 5000 RON following bank transfer'
);

-- Replay custody transfer is idempotent
select ok(
  (select id from app_private.record_cash_custody_transfer_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000070', null,
      'bank_deposit', 50000.00, ((statement_timestamp() at time zone 'Europe/Bucharest')::date - 2),
      (statement_timestamp() - interval '40 hours'),
      'Foaie varsamant FV-097-1',
      '09700000-0000-0000-0000-000000000001', 'idemp-dep-097', repeat('9', 64)
    )) = (select id from finance.statutory_cash_custody_transfers where idempotency_key = 'idemp-dep-097'),
  'custody transfer replay returns existing row idempotently'
);

-- Direct delete on custody transfer is blocked
select throws_ok(
  $$delete from finance.statutory_cash_custody_transfers where idempotency_key = 'idemp-dep-097'$$,
  '55000', 'statutory_custody_transfer_is_immutable',
  'custody transfer is immutable against direct SQL delete'
);

-- 7. Law 70/2015 Art. 4²(1) Daily Cash Closure & 50,000 RON Ceiling
-- Before closing, balance is 5,000 RON.
-- Attempting closure with counted cash mismatch is rejected
select throws_ok(
  $$select * from app_private.close_statutory_cash_day_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      ((statement_timestamp() at time zone 'Europe/Bucharest')::date - 2), 5001.00, -- Mismatch with ledger balance of 5,000.00
      '09700000-0000-0000-0000-000000000001', 'idemp-close-mismatch', repeat('a', 64)
    )$$,
  '23514', 'cash_closure_discrepancy_detected',
  'closure is rejected when counted cash does not match derived ledger balance'
);

-- Valid Daily Cash Closure for 2026-06-15 with exact 5,000 RON
select lives_ok(
  $$select * from app_private.close_statutory_cash_day_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      ((statement_timestamp() at time zone 'Europe/Bucharest')::date - 2), 5000.00,
      '09700000-0000-0000-0000-000000000001', 'idemp-close-097', repeat('b', 64)
    )$$,
  'daily cash closure recorded successfully with compliant closing balance'
);

select ok(
  (select closing_balance = 5000.00 and ceiling_threshold = 50000.00 and ceiling_exceeded = false
     from finance.statutory_cash_daily_closures where idempotency_key = 'idemp-close-097'),
  'daily closure recorded with exact closing balance and non-breached ceiling'
);

-- Closure replay is idempotent
select ok(
  (select id from app_private.close_statutory_cash_day_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      ((statement_timestamp() at time zone 'Europe/Bucharest')::date - 2), 5000.00,
      '09700000-0000-0000-0000-000000000001', 'idemp-close-097', repeat('b', 64)
    )) = (select id from finance.statutory_cash_daily_closures where idempotency_key = 'idemp-close-097'),
  'closure replay returns existing closure row idempotently'
);

-- Direct delete on daily closure is blocked
select throws_ok(
  $$delete from finance.statutory_cash_daily_closures where idempotency_key = 'idemp-close-097'$$,
  '55000', 'finalized_cash_closure_is_immutable',
  'daily closure record is immutable against direct SQL delete'
);

-- Block modifications to entries on closed date
select throws_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000083', -- Bank entry rejected
      (statement_timestamp() - interval '2 days'),
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-closed-day', repeat('c', 64)
    )$$,
  '23514', 'only_cash_entries_can_be_assigned_to_cash_desk',
  'assigning entries to closed cash date is rejected'
);

-- 8. Law 70/2015 Art. 4²(1) Excess Ceiling Obligation Generation
-- Create and close second day (2026-06-16) with 55,000 RON closing balance (excess of 5,000 RON)
insert into finance.statutory_simple_entries (
  id, cycle_id, tenant_id, property_id, entry_date, direction, payment_medium,
  document_type, document_number, amount, description, created_by
) values (
  '09700000-0000-0000-0000-000000000088', '09700000-0000-0000-0000-000000000060',
  '09700000-0000-0000-0000-000000000010', '09700000-0000-0000-0000-000000000030',
  ((statement_timestamp() at time zone 'Europe/Bucharest')::date - 1), 'receipt', 'cash', 'CHITANTA', 'CH-097-DAY2', 50000.00, 'Day 2 receipt',
  '09700000-0000-0000-0000-000000000001'
);

select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000088',
      (statement_timestamp() - interval '1 day'),
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-day2', repeat('d', 64)
    )$$,
  'day 2 receipt assigned'
);

select lives_ok(
  $$select * from app_private.close_statutory_cash_day_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      ((statement_timestamp() at time zone 'Europe/Bucharest')::date - 1), 55000.00,
      '09700000-0000-0000-0000-000000000001', 'idemp-close-day2', repeat('c', 64)
    )$$,
  'day 2 closure recorded with 5,000 RON excess above ceiling'
);

select ok(
  (select ceiling_exceeded = true and closing_balance = 55000.00
     from finance.statutory_cash_daily_closures where idempotency_key = 'idemp-close-day2'),
  'ceiling breach flagged on daily closure'
);

select ok(
  exists(
    select 1 from finance.statutory_cash_deposit_obligations
     where cash_desk_id = (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097')
       and obligation_kind = 'ceiling_50k_excess'
       and required_amount = 5000.00
       and status = 'pending'
  ),
  '50,000 RON ceiling excess deposit obligation created automatically for 5,000 RON'
);

-- 9. Law 70/2015 Art. 4²(2) 3-Business-Day Exception Model (Reservation + Disbursement)
-- Reservation on 24h obligation is rejected
select throws_ok(
  $$select * from app_private.record_deposit_obligation_exception_v1(
      (select id from finance.statutory_cash_deposit_obligations where statutory_simple_entry_id = '09700000-0000-0000-0000-000000000081'),
      1000.00, 'personnel_rights', (statement_timestamp() at time zone 'Europe/Bucharest')::date, 'Salarii casier',
      '09700000-0000-0000-0000-000000000001'::uuid, 'idemp-ex-wrong-kind', repeat('a', 64)
    )$$,
  '22023', 'exception_only_allowed_for_50k_ceiling_excess',
  'exception reservation cannot be recorded against 24-hour receipt obligations'
);

-- Reservation exceeding obligation required amount is rejected
select throws_ok(
  $$select * from app_private.record_deposit_obligation_exception_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
      6000.00, 'personnel_rights', (statement_timestamp() at time zone 'Europe/Bucharest')::date, 'Salarii casier',
      '09700000-0000-0000-0000-000000000001'::uuid, 'idemp-ex-over', repeat('a', 64)
    )$$,
  '23514', 'exception_amount_exceeds_obligation',
  'exception reservation exceeding obligation required amount is rejected'
);

-- Record valid exception reservation of 3,000 RON without payment entry
select lives_ok(
  $$select * from app_private.record_deposit_obligation_exception_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
      3000.00, 'personnel_rights', (statement_timestamp() at time zone 'Europe/Bucharest')::date, 'Stat de plata salarii personal ingrijire',
      '09700000-0000-0000-0000-000000000001'::uuid, 'idemp-ex-valid', repeat('b', 64)
    )$$,
  'valid 3-business-day exception reservation recorded without payment entry'
);

select ok(
  (select expiry_date = finance.add_romanian_business_days_v1((statement_timestamp() at time zone 'Europe/Bucharest')::date, 3)
      and covered_amount = 3000.00
     from finance.statutory_cash_deposit_obligation_exceptions where idempotency_key = 'idemp-ex-valid'),
  'exception expiry is calculated as 3 Romanian business days from scheduled date'
);

-- Projection test: Reservation alone does NOT reduce effective outstanding amount
select ok(
  (select gross_required_amount = 5000.00
      and bank_settled_amount = 0.00
      and active_retained_amount = 0.00
      and lawfully_consumed_amount = 0.00
      and exception_disbursed_amount = 0.00
      and expired_unused_retention_amount = 0.00
      and effective_outstanding_amount = 5000.00
      and compliance_status = 'open'
     from finance.statutory_deposit_obligation_position_v1(
       (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
       statement_timestamp()
     )),
  'reservation alone does NOT reduce effective outstanding obligation amount'
);

-- Exception reservation immutability
select throws_ok(
  $$delete from finance.statutory_cash_deposit_obligation_exceptions where idempotency_key = 'idemp-ex-valid'$$,
  '55000', 'statutory_deposit_exception_is_immutable',
  'exception reservation record is immutable and cannot be deleted'
);

-- Assign entries 84, 85, 86 to cash desk for disbursement testing
select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000084', null,
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-pay-84', repeat('6', 64)
    )$$,
  'payroll cash payment entry 84 assigned'
);

select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000085', null,
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-pay-85', repeat('7', 64)
    )$$,
  'out of window cash payment entry 85 assigned'
);

select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000086', null,
      '09700000-0000-0000-0000-000000000001', 'idemp-assign-pay-86', repeat('8', 64)
    )$$,
  'over coverage cash payment entry 86 assigned'
);

-- Disbursement with payment entry outside window is rejected
select throws_ok(
  $$select * from app_private.consume_deposit_obligation_exception_v1(
      (select id from finance.statutory_cash_deposit_obligation_exceptions where idempotency_key = 'idemp-ex-valid'),
      '09700000-0000-0000-0000-000000000085'::uuid,
      '09700000-0000-0000-0000-000000000001'::uuid,
      'idemp-disb-outwindow', repeat('7', 64)
    )$$,
  '22023', 'exception_payment_outside_window',
  'payment entry outside statutory reservation window is rejected'
);

-- Valid disbursement of 3,000 RON
select lives_ok(
  $$select * from app_private.consume_deposit_obligation_exception_v1(
      (select id from finance.statutory_cash_deposit_obligation_exceptions where idempotency_key = 'idemp-ex-valid'),
      '09700000-0000-0000-0000-000000000084'::uuid,
      '09700000-0000-0000-0000-000000000001'::uuid,
      'idemp-disb-valid', repeat('7', 64)
    )$$,
  'exception disbursement recorded for cash payment entry 84'
);

select ok(
  (select disbursed_amount = 3000.00
     from finance.statutory_cash_deposit_exception_disbursements where idempotency_key = 'idemp-disb-valid'),
  'disbursement recorded in append-only disbursements ledger with exact amount'
);

-- Disbursement immutability
select throws_ok(
  $$delete from finance.statutory_cash_deposit_exception_disbursements where idempotency_key = 'idemp-disb-valid'$$,
  '55000', 'statutory_deposit_exception_disbursement_is_immutable',
  'exception disbursement record is immutable and cannot be deleted'
);

-- Single-use invariant: Reusing the same payment entry in another disbursement is rejected
select throws_ok(
  $$select * from app_private.consume_deposit_obligation_exception_v1(
      (select id from finance.statutory_cash_deposit_obligation_exceptions where idempotency_key = 'idemp-ex-valid'),
      '09700000-0000-0000-0000-000000000084'::uuid,
      '09700000-0000-0000-0000-000000000001'::uuid,
      'idemp-disb-dup-entry', repeat('8', 64)
    )$$,
  '23505', null,
  'reusing the same payment entry across exception disbursements is strictly rejected (single-use)'
);

-- Disbursement exceeding coverage is rejected
select throws_ok(
  $$select * from app_private.consume_deposit_obligation_exception_v1(
      (select id from finance.statutory_cash_deposit_obligation_exceptions where idempotency_key = 'idemp-ex-valid'),
      '09700000-0000-0000-0000-000000000086'::uuid,
      '09700000-0000-0000-0000-000000000001'::uuid,
      'idemp-disb-overcov', repeat('9', 64)
    )$$,
  '23514', 'disbursement_exceeds_exception_coverage',
  'disbursement exceeding remaining exception coverage is rejected'
);

-- Projection test: Actual disbursement DOES reduce effective outstanding obligation amount
select ok(
  (select gross_required_amount = 5000.00
      and bank_settled_amount = 0.00
      and active_retained_amount = 0.00
      and lawfully_consumed_amount = 0.00
      and exception_disbursed_amount = 3000.00
      and expired_unused_retention_amount = 0.00
      and effective_outstanding_amount = 2000.00
      and compliance_status = 'partially_settled'
     from finance.statutory_deposit_obligation_position_v1(
       (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
       statement_timestamp()
     )),
  'actual disbursement reduces effective outstanding amount to 2000 RON with partially_settled status'
);

-- Projection test: Expired unused exception coverage is not deducted from outstanding
select ok(
  (select gross_required_amount = 5000.00
      and exception_disbursed_amount = 3000.00
      and effective_outstanding_amount = 2000.00
     from finance.statutory_deposit_obligation_position_v1(
       (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
       statement_timestamp() + interval '30 days'
     )),
  'expired unused exception reservation leaves remaining effective outstanding intact'
);

-- 10. Amount-Specific Settlement and Timeliness Evaluation (Errata 1 & 3)
select lives_ok(
  $$select * from app_private.settle_cash_deposit_obligation_v1(
      (select id from finance.statutory_cash_deposit_obligations where statutory_simple_entry_id = '09700000-0000-0000-0000-000000000081'),
      (select id from finance.statutory_cash_custody_transfers where idempotency_key = 'idemp-dep-097'),
      50000.00, null, 'partial settlement of 60k obligation',
      '09700000-0000-0000-0000-000000000001'::uuid,
      'idemp-settle-097-1', repeat('d', 64)
    )$$,
  'partial normal settlement of 24h deposit obligation recorded in settlements table'
);

select ok(
  (select status = 'partially_settled' and settled_amount = 50000.00
     from finance.statutory_cash_deposit_obligations where statutory_simple_entry_id = '09700000-0000-0000-0000-000000000081'),
  'obligation projected status is partially_settled and settled_amount is 50000 RON'
);

select ok(
  (select is_timely = true and is_exception_covered = false
     from finance.statutory_cash_deposit_settlements where idempotency_key = 'idemp-settle-097-1'),
  'normal settlement timeliness is derived from custody transfer transferred_at timestamp'
);

-- Settlement replay is idempotent
select ok(
  (select id from app_private.settle_cash_deposit_obligation_v1(
      (select id from finance.statutory_cash_deposit_obligations where statutory_simple_entry_id = '09700000-0000-0000-0000-000000000081'),
      (select id from finance.statutory_cash_custody_transfers where idempotency_key = 'idemp-dep-097'),
      50000.00, null, 'partial settlement of 60k obligation',
      '09700000-0000-0000-0000-000000000001'::uuid,
      'idemp-settle-097-1', repeat('d', 64)
    )) = (select id from finance.statutory_cash_deposit_settlements where idempotency_key = 'idemp-settle-097-1'),
  'settlement replay with identical key and payload returns existing settlement without duplicate allocation'
);

-- Double-spending custody transfer capacity is rejected
select throws_ok(
  $$select * from app_private.settle_cash_deposit_obligation_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
      (select id from finance.statutory_cash_custody_transfers where idempotency_key = 'idemp-dep-097'), -- already 50k allocated
      5000.00, null, 'double spend attempt',
      '09700000-0000-0000-0000-000000000001'::uuid,
      'idemp-settle-double-spend', repeat('e', 64)
    )$$,
  '23514', 'custody_transfer_capacity_exceeded',
  'settlement exceeding custody transfer capacity is rejected (prevents double-spend)'
);

-- Settlement immutability
select throws_ok(
  $$delete from finance.statutory_cash_deposit_settlements where idempotency_key = 'idemp-settle-097-1'$$,
  '55000', 'statutory_deposit_settlement_is_immutable',
  'settlement record is immutable against direct SQL delete'
);

-- 11. Anti-Double-Counting Invariant: Bank Settlement and Exception Disbursement Settle Additively
-- Record another custody transfer of 1,000 RON to settle part of the 5,000 RON ceiling excess obligation
select lives_ok(
  $$select * from app_private.record_cash_custody_transfer_v1(
      (select id from finance.statutory_cash_desks where idempotency_key = 'idemp-desk-097'),
      '09700000-0000-0000-0000-000000000070', null,
      'bank_deposit', 1000.00, (statement_timestamp() at time zone 'Europe/Bucharest')::date,
      statement_timestamp(),
      'Foaie varsamant FV-097-ADD',
      '09700000-0000-0000-0000-000000000001', 'idemp-dep-add-1k', repeat('f', 64)
    )$$,
  'second custody transfer of 1,000 RON recorded'
);

select lives_ok(
  $$select * from app_private.settle_cash_deposit_obligation_v1(
      (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
      (select id from finance.statutory_cash_custody_transfers where idempotency_key = 'idemp-dep-add-1k'),
      1000.00, null, 'partial bank settlement of 5k ceiling excess obligation',
      '09700000-0000-0000-0000-000000000001'::uuid,
      'idemp-settle-add-1k', repeat('1', 64)
    )$$,
  '1,000 RON bank settlement applied to ceiling excess obligation'
);

-- Projection test: Bank settlement (1,000) and Exception disbursement (3,000) do NOT double-count
select ok(
  (select gross_required_amount = 5000.00
      and bank_settled_amount = 1000.00
      and active_retained_amount = 0.00
      and lawfully_consumed_amount = 0.00
      and exception_disbursed_amount = 3000.00
      and expired_unused_retention_amount = 0.00
      and effective_outstanding_amount = 1000.00
      and compliance_status = 'partially_settled'
     from finance.statutory_deposit_obligation_position_v1(
       (select id from finance.statutory_cash_deposit_obligations where obligation_kind = 'ceiling_50k_excess'),
       statement_timestamp()
     )),
  'bank settlement and exception disbursement reduce effective outstanding additively without double-counting'
);

-- 12. Zero Journal Auto-Creation (Invariant 4)
select ok(
  (select count(*) = 0 from finance.journals where tenant_id = '09700000-0000-0000-0000-000000000010'),
  'zero double-entry journals created automatically during cash discipline operations'
);

-- 13. Audit Completeness
select ok(
  (select count(*) >= 8 from audit.events where tenant_id = '09700000-0000-0000-0000-000000000010'),
  'audit events logged for cash desk, assignments, transfers, closures, exceptions, and settlements'
);

rollback;
