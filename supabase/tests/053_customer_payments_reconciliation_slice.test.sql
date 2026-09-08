-- Test 053: Production Payments, Allocation & Bank Reconciliation Vertical Slice
-- Scope: RPC existence, permissions, recording payments, multi-bill allocation,
--        unallocation, double-entry accounting integration, closed-period protection,
--        bank matching, reconciliation difference check, zero partial writes.

begin;
select plan(41);

-- 1. Function existence in payments schema
select ok(to_regprocedure('payments.record_payment(uuid,uuid,numeric,text,timestamptz,uuid,uuid,text,text,text,text)') is not null, 'payments.record_payment exists');
select ok(to_regprocedure('payments.allocate_payment(uuid,uuid,jsonb,text)') is not null, 'payments.allocate_payment exists');
select ok(to_regprocedure('payments.unallocate_payment(uuid,uuid,text)') is not null, 'payments.unallocate_payment exists');
select ok(to_regprocedure('payments.reverse_payment(uuid,uuid,text)') is not null, 'payments.reverse_payment exists');
select ok(to_regprocedure('payments.list_bank_transactions(uuid,uuid,text,date,date,integer,integer)') is not null, 'payments.list_bank_transactions exists');
select ok(to_regprocedure('payments.match_bank_transaction(uuid,uuid,uuid,uuid,numeric,text)') is not null, 'payments.match_bank_transaction exists');
select ok(to_regprocedure('payments.unmatch_bank_transaction(uuid,uuid,text)') is not null, 'payments.unmatch_bank_transaction exists');
select ok(to_regprocedure('payments.get_reconciliation_summary(uuid,uuid,date,date)') is not null, 'payments.get_reconciliation_summary exists');
select ok(to_regprocedure('payments.finalize_bank_reconciliation(uuid,uuid,date,date,numeric,text)') is not null, 'payments.finalize_bank_reconciliation exists');

-- 2. Customer API Gateway wrappers existence
select ok(to_regprocedure('customer_api.record_payment_v1(uuid,uuid,numeric,text,timestamptz,uuid,uuid,text,text,text,text)') is not null, 'customer_api.record_payment_v1 exists');
select ok(to_regprocedure('customer_api.allocate_payment_v1(uuid,uuid,jsonb,text)') is not null, 'customer_api.allocate_payment_v1 exists');
select ok(to_regprocedure('customer_api.unallocate_payment_v1(uuid,uuid,text)') is not null, 'customer_api.unallocate_payment_v1 exists');
select ok(to_regprocedure('customer_api.reverse_payment_v1(uuid,uuid,text)') is not null, 'customer_api.reverse_payment_v1 exists');
select ok(to_regprocedure('customer_api.list_bank_transactions_v1(uuid,uuid,text,date,date,integer,integer)') is not null, 'customer_api.list_bank_transactions_v1 exists');
select ok(to_regprocedure('customer_api.match_bank_transaction_v1(uuid,uuid,uuid,uuid,numeric,text)') is not null, 'customer_api.match_bank_transaction_v1 exists');
select ok(to_regprocedure('customer_api.unmatch_bank_transaction_v1(uuid,uuid,text)') is not null, 'customer_api.unmatch_bank_transaction_v1 exists');
select ok(to_regprocedure('customer_api.get_reconciliation_summary_v1(uuid,uuid,date,date)') is not null, 'customer_api.get_reconciliation_summary_v1 exists');
select ok(to_regprocedure('customer_api.finalize_bank_reconciliation_v1(uuid,uuid,date,date,numeric,text)') is not null, 'customer_api.finalize_bank_reconciliation_v1 exists');

-- 3. Execution Privileges
select ok(has_function_privilege('authenticated', 'customer_api.record_payment_v1(uuid,uuid,numeric,text,timestamptz,uuid,uuid,text,text,text,text)', 'EXECUTE'), 'authenticated can execute record_payment_v1');
select ok(not has_function_privilege('anon', 'customer_api.record_payment_v1(uuid,uuid,numeric,text,timestamptz,uuid,uuid,text,text,text,text)', 'EXECUTE'), 'anon denied record_payment_v1');
select ok(has_function_privilege('authenticated', 'customer_api.allocate_payment_v1(uuid,uuid,jsonb,text)', 'EXECUTE'), 'authenticated can execute allocate_payment_v1');
select ok(not has_function_privilege('anon', 'customer_api.allocate_payment_v1(uuid,uuid,jsonb,text)', 'EXECUTE'), 'anon denied allocate_payment_v1');

-- 4. Isolated Test Data Setup
do $$
declare
  v_perm_manage uuid;
  v_perm_alloc uuid;
  v_perm_rev uuid;
  v_perm_rec uuid;
  v_perm_read uuid;
  v_inv_id uuid;
begin
  -- Users
  insert into auth.users (id, email) values
    ('40000000-0000-0000-0000-000000000001', 'pay-admin@cladora.test'),
    ('40000000-0000-0000-0000-000000000002', 'pay-owner@cladora.test'),
    ('40000000-0000-0000-0000-000000000003', 'pay-censor@cladora.test');

  -- Tenant and Workspace
  insert into platform.tenants (id, legal_name, registration_number, status) values
    ('40100000-0000-0000-0000-000000000001', 'Payments Test Tenant', 'REG-PAY-001', 'active');

  insert into platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version) values
    ('40800000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001', 'ASSOCIATION', 'ACTIVE', 'Payments Owner', 'PILOT', 1);

  insert into platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value) values
    ('40800000-0000-0000-0000-000000000001', 'module.payments', 'boolean', true);

  -- Roles
  insert into identity.roles (id, tenant_id, code, name) values
    ('40200000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001', 'association_admin', 'Administrator'),
    ('40200000-0000-0000-0000-000000000002', '40100000-0000-0000-0000-000000000001', 'owner', 'Owner'),
    ('40200000-0000-0000-0000-000000000003', '40100000-0000-0000-0000-000000000001', 'censor', 'Censor');

  select id into v_perm_manage from identity.permissions where code = 'payments.manage';
  select id into v_perm_alloc from identity.permissions where code = 'payments.allocate';
  select id into v_perm_rev from identity.permissions where code = 'payments.reverse';
  select id into v_perm_rec from identity.permissions where code = 'payments.reconcile';
  select id into v_perm_read from identity.permissions where code = 'payments.reconciliation.read';

  insert into identity.role_permissions (role_id, permission_id, effect) values
    ('40200000-0000-0000-0000-000000000001', v_perm_manage, 'allow'),
    ('40200000-0000-0000-0000-000000000001', v_perm_alloc, 'allow'),
    ('40200000-0000-0000-0000-000000000001', v_perm_rev, 'allow'),
    ('40200000-0000-0000-0000-000000000001', v_perm_rec, 'allow'),
    ('40200000-0000-0000-0000-000000000001', v_perm_read, 'allow'),
    ('40200000-0000-0000-0000-000000000002', v_perm_read, 'allow'),
    ('40200000-0000-0000-0000-000000000003', v_perm_read, 'allow');

  -- Memberships
  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at) values
    ('40300000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '40200000-0000-0000-0000-000000000001', 'active', statement_timestamp() - interval '1 day'),
    ('40300000-0000-0000-0000-000000000002', '40100000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '40200000-0000-0000-0000-000000000002', 'active', statement_timestamp() - interval '1 day'),
    ('40300000-0000-0000-0000-000000000003', '40100000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '40200000-0000-0000-0000-000000000003', 'active', statement_timestamp() - interval '1 day');

  -- Portfolio
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    ('40500000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001', 'condominium', 'Pay Complex', 'active');

  insert into portfolio.buildings (id, tenant_id, property_id, code, name, status) values
    ('40600000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001', '40500000-0000-0000-0000-000000000001', 'PB-01', 'Pay Building 1', 'active');

  insert into portfolio.units (id, tenant_id, building_id, code, status) values
    ('40700000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001', '40600000-0000-0000-0000-000000000001', 'PU-101', 'active');

  insert into portfolio.parties (id, tenant_id, type, legal_name) values
    ('40900000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001', 'person', 'Payment Resident');

  -- Context Grants
  insert into identity.context_grants (id, membership_id, tenant_id, scope_type, unit_id, starts_at) values
    ('40400000-0000-0000-0000-000000000001', '40300000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001', 'tenant', null, statement_timestamp() - interval '1 day'),
    ('40400000-0000-0000-0000-000000000002', '40300000-0000-0000-0000-000000000002', '40100000-0000-0000-0000-000000000001', 'unit', '40700000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day'),
    ('40400000-0000-0000-0000-000000000003', '40300000-0000-0000-0000-000000000003', '40100000-0000-0000-0000-000000000001', 'tenant', null, statement_timestamp() - interval '1 day');

  insert into identity.membership_parties (membership_id, tenant_id, party_id) values
    ('40300000-0000-0000-0000-000000000002', '40100000-0000-0000-0000-000000000001', '40900000-0000-0000-0000-000000000001');

  insert into portfolio.ownerships (tenant_id, unit_id, party_id, share, valid_from) values
    ('40100000-0000-0000-0000-000000000001', '40700000-0000-0000-0000-000000000001', '40900000-0000-0000-0000-000000000001', 1, current_date - 10);

  -- GL Accounts
  insert into finance.accounts (id, tenant_id, property_id, code, name, type, currency) values
    ('40a00000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001', '40500000-0000-0000-0000-000000000001', '4111', 'Test AR', 'asset', 'RON'),
    ('40a00000-0000-0000-0000-000000000002', '40100000-0000-0000-0000-000000000001', '40500000-0000-0000-0000-000000000001', '5121', 'Test Bank', 'asset', 'RON'),
    ('40a00000-0000-0000-0000-000000000003', '40100000-0000-0000-0000-000000000001', '40500000-0000-0000-0000-000000000001', '419', 'Test Clearing', 'liability', 'RON');

  -- Accounting Periods: September open, August closed
  insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status, closed_at, snapshot_json) values
    ('40b00000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001', '40500000-0000-0000-0000-000000000001', '2026-08-01', '2026-08-31', 'closed', statement_timestamp() - interval '5 days', '{"closed":true}'::jsonb),
    ('40b00000-0000-0000-0000-000000000002', '40100000-0000-0000-0000-000000000001', '40500000-0000-0000-0000-000000000001', '2026-09-01', '2026-09-30', 'open', null, null);

  -- Test Invoice & Receivable
  insert into billing.invoices (
    id, tenant_id, property_id, unit_id, liable_party_id,
    period_start, period_end, due_on, currency, subtotal, tax_total, status, issued_on
  ) values (
    '40c00000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001',
    '40500000-0000-0000-0000-000000000001', '40700000-0000-0000-0000-000000000001',
    '40900000-0000-0000-0000-000000000001',
    '2026-09-01', '2026-09-30', '2026-09-25', 'RON', 500.00, 0, 'issued', '2026-09-02'
  );

  insert into billing.receivables (
    id, tenant_id, invoice_id, original_amount, paid_amount, credited_amount
  ) values (
    '40d00000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001',
    '40c00000-0000-0000-0000-000000000001', 500.00, 0, 0
  );

  -- Bank Account
  insert into payments.bank_accounts (
    id, tenant_id, property_id, iban_encrypted, iban_fingerprint, bank_name, currency, status
  ) values (
    '40e00000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001',
    '40500000-0000-0000-0000-000000000001', 'enc_iban_test', 'fp_iban_test_01', 'Test Bank RO', 'RON', 'active'
  );

  -- Bank Import batch and transaction
  insert into payments.import_batches (
    id, tenant_id, bank_account_id, source, source_hash, period_start, period_end
  ) values (
    '40f00000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001',
    '40e00000-0000-0000-0000-000000000001', 'statement.csv', 'hash_test_01', '2026-09-01', '2026-09-30'
  );

  insert into payments.bank_transactions (
    id, tenant_id, batch_id, bank_account_id, direction, amount, currency, booked_on, fingerprint, raw_snapshot
  ) values (
    '40f10000-0000-0000-0000-000000000001', '40100000-0000-0000-0000-000000000001',
    '40f00000-0000-0000-0000-000000000001', '40e00000-0000-0000-0000-000000000001',
    'credit', 500.00, 'RON', '2026-09-05', 'fp_tx_01', '{}'::jsonb
  );
end $$;

-- 5. Test Positive: Record Payment as Administrator (AAL2 context)
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000001","aal":"aal2"}', true);

do $$
declare
  v_res jsonb;
  v_payment_id uuid;
  v_journal_id uuid;
  v_dr numeric;
  v_cr numeric;
begin
  v_res := payments.record_payment(
    '40400000-0000-0000-0000-000000000001',
    '40500000-0000-0000-0000-000000000001',
    500.00,
    'RON',
    '2026-09-05T10:00:00Z',
    '40700000-0000-0000-0000-000000000001',
    '40900000-0000-0000-0000-000000000001',
    'bank_transfer',
    'P1TEST-REF-001',
    'September Maintenance Fee',
    'IDEMP-PAY-001'
  );

  v_payment_id := (v_res->'payment'->>'id')::uuid;
  v_journal_id := (v_res->'payment'->>'journal_id')::uuid;

  -- Verify balanced journal entries
  select coalesce(sum(amount) filter (where side = 'debit'), 0),
         coalesce(sum(amount) filter (where side = 'credit'), 0)
  into v_dr, v_cr
  from finance.journal_entries
  where journal_id = v_journal_id;

  if v_dr <> 500.00 or v_cr <> 500.00 then
    raise exception 'journal_not_balanced: dr=%, cr=%', v_dr, v_cr;
  end if;
end $$;

select ok(exists (select 1 from payments.payments where provider_ref = 'P1TEST-REF-001' and amount = 500.00), 'payment recorded successfully');
select ok((select status::text from payments.payments where provider_ref = 'P1TEST-REF-001') = 'settled', 'payment status is settled');
select ok(exists (select 1 from audit.events where action = 'PAYMENT_RECORDED'), 'PAYMENT_RECORDED audit event emitted');

-- 6. Test Positive: Allocate Payment to Invoice
do $$
declare
  v_payment_id uuid;
  v_rec_id uuid := '40d00000-0000-0000-0000-000000000001';
  v_res jsonb;
begin
  select id into v_payment_id from payments.payments where provider_ref = 'P1TEST-REF-001';

  v_res := payments.allocate_payment(
    '40400000-0000-0000-0000-000000000001',
    v_payment_id,
    jsonb_build_array(jsonb_build_object('receivable_id', v_rec_id, 'amount', 500.00)),
    'IDEMP-ALLOC-001'
  );
end $$;

select ok((select paid_amount from billing.receivables where id = '40d00000-0000-0000-0000-000000000001') = 500.0000, 'receivable paid_amount updated to 500');
select ok((select outstanding_amount from billing.receivables where id = '40d00000-0000-0000-0000-000000000001') = 0.0000, 'receivable outstanding_amount is 0');
select ok((select status::text from billing.invoices where id = '40c00000-0000-0000-0000-000000000001') = 'paid', 'invoice status updated to paid');
select ok(exists (select 1 from audit.events where action = 'PAYMENT_ALLOCATED'), 'PAYMENT_ALLOCATED audit event emitted');

-- 7. Test Negative: Over-allocation prevented
select throws_ok(
  $$
  select payments.allocate_payment(
    '40400000-0000-0000-0000-000000000001',
    (select id from payments.payments where provider_ref = 'P1TEST-REF-001'),
    jsonb_build_array(jsonb_build_object('receivable_id', '40d00000-0000-0000-0000-000000000001'::uuid, 'amount', 10.00))
  )
  $$,
  'payment_overallocated',
  'over-allocation exceeding payment balance is rejected'
);

-- 8. Test Positive: Unallocation
do $$
declare
  v_alloc_id uuid;
begin
  select id into v_alloc_id from payments.payment_allocations where status = 'active' limit 1;
  perform payments.unallocate_payment('40400000-0000-0000-0000-000000000001', v_alloc_id, 'Correction of wrong bill');
end $$;

select ok((select paid_amount from billing.receivables where id = '40d00000-0000-0000-0000-000000000001') = 0.0000, 'receivable paid_amount reverted after unallocation');
select ok((select status::text from billing.invoices where id = '40c00000-0000-0000-0000-000000000001') = 'issued', 'invoice status restored to issued');
select ok(exists (select 1 from audit.events where action = 'PAYMENT_UNALLOCATED'), 'PAYMENT_UNALLOCATED audit event emitted');

-- 9. Test Positive: Reverse Payment with Compensating Journal
do $$
declare
  v_payment_id uuid;
  v_res jsonb;
  v_rev_journal_id uuid;
  v_dr numeric;
  v_cr numeric;
begin
  select id into v_payment_id from payments.payments where provider_ref = 'P1TEST-REF-001';
  v_res := payments.reverse_payment('40400000-0000-0000-0000-000000000001', v_payment_id, 'Bounced check');
  v_rev_journal_id := (v_res->>'reversal_journal_id')::uuid;

  select coalesce(sum(amount) filter (where side = 'debit'), 0),
         coalesce(sum(amount) filter (where side = 'credit'), 0)
  into v_dr, v_cr
  from finance.journal_entries
  where journal_id = v_rev_journal_id;

  if v_dr <> 500.00 or v_cr <> 500.00 then
    raise exception 'reversal_journal_not_balanced: dr=%, cr=%', v_dr, v_cr;
  end if;
end $$;

select ok((select status::text from payments.payments where provider_ref = 'P1TEST-REF-001') = 'refunded', 'payment status marked refunded/reversed');
select ok(exists (select 1 from audit.events where action = 'PAYMENT_REVERSED'), 'PAYMENT_REVERSED audit event emitted');

-- 10. Test Negative: Closed Period posting rejected
select throws_like(
  $$
  select payments.record_payment(
    '40400000-0000-0000-0000-000000000001',
    '40500000-0000-0000-0000-000000000001',
    100.00,
    'RON',
    '2026-08-15T10:00:00Z' -- In closed August period!
  )
  $$,
  '%closed%',
  'posting into closed financial period is rejected'
);

-- 11. Test Negative: Read-only role (President) denied mutation
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000003","aal":"aal2"}', true);

select throws_ok(
  $$
  select payments.record_payment(
    '40400000-0000-0000-0000-000000000003',
    '40500000-0000-0000-0000-000000000001',
    200.00,
    'RON',
    '2026-09-10T10:00:00Z'
  )
  $$,
  'payment_permission_denied',
  'censor role denied recording payment'
);

-- 12. Test Bank Transaction Match & Finalize
select set_config('request.jwt.claim.sub', '40000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"40000000-0000-0000-0000-000000000001","aal":"aal2"}', true);

do $$
begin
  perform payments.match_bank_transaction(
    '40400000-0000-0000-0000-000000000001',
    '40f10000-0000-0000-0000-000000000001',
    (select id from payments.payments where provider_ref = 'P1TEST-REF-001'),
    '40d00000-0000-0000-0000-000000000001',
    500.00,
    'Matched during test'
  );
end $$;

select ok(exists (select 1 from payments.reconciliation_matches where bank_transaction_id = '40f10000-0000-0000-0000-000000000001' and status = 'confirmed'), 'bank transaction matched');

-- Finalize with non-zero difference should fail
select throws_ok(
  $$
  select payments.finalize_bank_reconciliation(
    '40400000-0000-0000-0000-000000000001',
    '40e00000-0000-0000-0000-000000000001',
    '2026-09-01',
    '2026-09-30',
    999.00 -- incorrect closing balance!
  )
  $$,
  'reconciliation_difference_must_be_zero',
  'finalize with nonzero difference is rejected'
);

-- Finalize with zero difference should succeed (opening 0 + credits 500 - debits 0 = 500)
do $$
begin
  perform payments.finalize_bank_reconciliation(
    '40400000-0000-0000-0000-000000000001',
    '40e00000-0000-0000-0000-000000000001',
    '2026-09-01',
    '2026-09-30',
    500.00,
    'Reconciled successfully'
  );
end $$;

select ok(exists (select 1 from payments.reconciliation_sessions where status = 'reconciled' and difference = 0), 'reconciliation session finalized with zero difference');
select ok(exists (select 1 from audit.events where action = 'BANK_STATEMENT_RECONCILED'), 'BANK_STATEMENT_RECONCILED audit event emitted');

rollback;
