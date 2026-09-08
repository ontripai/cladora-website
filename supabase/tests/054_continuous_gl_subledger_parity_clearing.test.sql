-- Test 054: Continuous GL/Subledger Parity & Payment Clearing Hardening
-- Scope: Two-stage clearing model (419), atomic multi-bill allocation,
--        continuous 4111 / receivables parity, unallocation, split reversal/refund,
--        idempotency, concurrency safety, closed-period & scope isolation,
--        and internal continuous parity diagnostic RPC.

begin;
select plan(38);

-- 1. Function existence
select ok(to_regprocedure('finance.provision_clearing_account(uuid,uuid,text)') is not null, 'finance.provision_clearing_account exists');
select ok(to_regprocedure('finance.get_ar_subledger_parity(uuid,uuid,text)') is not null, 'finance.get_ar_subledger_parity exists');
select ok(to_regprocedure('customer_api.get_parity_diagnostic_v1(uuid,uuid,text)') is not null, 'customer_api.get_parity_diagnostic_v1 exists');

-- 2. Privileges and access control
select ok(has_function_privilege('authenticated', 'customer_api.get_parity_diagnostic_v1(uuid,uuid,text)', 'EXECUTE'), 'authenticated can execute get_parity_diagnostic_v1');
select ok(not has_function_privilege('anon', 'customer_api.get_parity_diagnostic_v1(uuid,uuid,text)', 'EXECUTE'), 'anon denied get_parity_diagnostic_v1');
select ok(not has_function_privilege('anon', 'finance.get_ar_subledger_parity(uuid,uuid,text)', 'EXECUTE'), 'anon denied internal finance.get_ar_subledger_parity');

-- 3. Isolated Test Fixtures Setup
do $$
declare
  v_perm_manage uuid;
  v_perm_alloc uuid;
  v_perm_rev uuid;
  v_perm_rec uuid;
  v_perm_read uuid;
  v_journal_id uuid;
begin
  -- Users
  insert into auth.users (id, email) values
    ('50000000-0000-0000-0000-000000000001', 'parity-admin@cladora.test'),
    ('50000000-0000-0000-0000-000000000002', 'parity-resident@cladora.test'),
    ('50000000-0000-0000-0000-000000000003', 'parity-censor@cladora.test');

  -- Tenant & Workspace
  insert into platform.tenants (id, legal_name, registration_number, status) values
    ('50100000-0000-0000-0000-000000000001', 'Parity Test Tenant', 'REG-PARITY-001', 'active');

  insert into platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version) values
    ('50800000-0000-0000-0000-000000000001', '50100000-0000-0000-0000-000000000001', 'ASSOCIATION', 'ACTIVE', 'Parity Owner', 'PILOT', 1);

  insert into platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value) values
    ('50800000-0000-0000-0000-000000000001', 'module.payments', 'boolean', true),
    ('50800000-0000-0000-0000-000000000001', 'module.accounting', 'boolean', true),
    ('50800000-0000-0000-0000-000000000001', 'module.billing', 'boolean', true);

  -- Roles & Permissions
  insert into identity.roles (id, tenant_id, code, name) values
    ('50200000-0000-0000-0000-000000000001', '50100000-0000-0000-0000-000000000001', 'association_admin', 'Administrator'),
    ('50200000-0000-0000-0000-000000000002', '50100000-0000-0000-0000-000000000001', 'owner', 'Owner'),
    ('50200000-0000-0000-0000-000000000003', '50100000-0000-0000-0000-000000000001', 'censor', 'Censor');

  select id into v_perm_manage from identity.permissions where code = 'payments.manage';
  select id into v_perm_alloc from identity.permissions where code = 'payments.allocate';
  select id into v_perm_rev from identity.permissions where code = 'payments.reverse';
  select id into v_perm_rec from identity.permissions where code = 'payments.reconcile';
  select id into v_perm_read from identity.permissions where code = 'payments.reconciliation.read';

  insert into identity.role_permissions (role_id, permission_id, effect) values
    ('50200000-0000-0000-0000-000000000001', v_perm_manage, 'allow'),
    ('50200000-0000-0000-0000-000000000001', v_perm_alloc, 'allow'),
    ('50200000-0000-0000-0000-000000000001', v_perm_rev, 'allow'),
    ('50200000-0000-0000-0000-000000000001', v_perm_rec, 'allow'),
    ('50200000-0000-0000-0000-000000000001', v_perm_read, 'allow'),
    ('50200000-0000-0000-0000-000000000002', v_perm_read, 'allow'),
    ('50200000-0000-0000-0000-000000000003', v_perm_read, 'allow');

  -- Memberships
  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at) values
    ('50300000-0000-0000-0000-000000000001', '50100000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000001', '50200000-0000-0000-0000-000000000001', 'active', statement_timestamp() - interval '1 day'),
    ('50300000-0000-0000-0000-000000000002', '50100000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000002', '50200000-0000-0000-0000-000000000002', 'active', statement_timestamp() - interval '1 day'),
    ('50300000-0000-0000-0000-000000000003', '50100000-0000-0000-0000-000000000001', '50000000-0000-0000-0000-000000000003', '50200000-0000-0000-0000-000000000003', 'active', statement_timestamp() - interval '1 day');

  -- Portfolio
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    ('50500000-0000-0000-0000-000000000001', '50100000-0000-0000-0000-000000000001', 'condominium', 'Parity Complex', 'active');

  insert into portfolio.buildings (id, tenant_id, property_id, code, name, status) values
    ('50600000-0000-0000-0000-000000000001', '50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', 'B-PARITY', 'Parity Building 1', 'active');

  insert into portfolio.units (id, tenant_id, building_id, code, status) values
    ('50700000-0000-0000-0000-000000000001', '50100000-0000-0000-0000-000000000001', '50600000-0000-0000-0000-000000000001', 'U-101', 'active'),
    ('50700000-0000-0000-0000-000000000002', '50100000-0000-0000-0000-000000000001', '50600000-0000-0000-0000-000000000001', 'U-102', 'active');

  insert into portfolio.parties (id, tenant_id, type, legal_name) values
    ('50900000-0000-0000-0000-000000000001', '50100000-0000-0000-0000-000000000001', 'person', 'Parity Resident 101'),
    ('50900000-0000-0000-0000-000000000002', '50100000-0000-0000-0000-000000000001', 'person', 'Parity Resident 102');

  -- Context Grants
  insert into identity.context_grants (id, membership_id, tenant_id, scope_type, unit_id, starts_at) values
    ('50400000-0000-0000-0000-000000000001', '50300000-0000-0000-0000-000000000001', '50100000-0000-0000-0000-000000000001', 'tenant', null, statement_timestamp() - interval '1 day'),
    ('50400000-0000-0000-0000-000000000002', '50300000-0000-0000-0000-000000000002', '50100000-0000-0000-0000-000000000001', 'unit', '50700000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day'),
    ('50400000-0000-0000-0000-000000000003', '50300000-0000-0000-0000-000000000003', '50100000-0000-0000-0000-000000000001', 'tenant', null, statement_timestamp() - interval '1 day');

  insert into identity.membership_parties (membership_id, tenant_id, party_id) values
    ('50300000-0000-0000-0000-000000000002', '50100000-0000-0000-0000-000000000001', '50900000-0000-0000-0000-000000000001');

  insert into portfolio.ownerships (tenant_id, unit_id, party_id, share, valid_from) values
    ('50100000-0000-0000-0000-000000000001', '50700000-0000-0000-0000-000000000001', '50900000-0000-0000-0000-000000000001', 1, current_date - 10);

  -- GL Accounts (4111 AR, 5121 Bank, 419 Clearing, 704 Revenue)
  insert into finance.accounts (id, tenant_id, property_id, code, name, type, currency) values
    ('50a00000-0000-0000-0000-000000000001', '50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', '4111', 'Parity AR', 'asset', 'RON'),
    ('50a00000-0000-0000-0000-000000000002', '50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', '5121', 'Parity Bank', 'asset', 'RON'),
    ('50a00000-0000-0000-0000-000000000003', '50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', '419', 'Parity Clearing', 'liability', 'RON'),
    ('50a00000-0000-0000-0000-000000000004', '50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', '704', 'Parity Revenue', 'income', 'RON');

  -- Accounting Periods: August closed, September open
  insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status, closed_at, snapshot_json) values
    ('50b00000-0000-0000-0000-000000000001', '50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', '2026-08-01', '2026-08-31', 'closed', statement_timestamp() - interval '5 days', '{"closed":true}'::jsonb),
    ('50b00000-0000-0000-0000-000000000002', '50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', '2026-09-01', '2026-09-30', 'open', null, null);

  -- Bank Account
  insert into payments.bank_accounts (id, tenant_id, property_id, iban_encrypted, iban_fingerprint, bank_name, currency, status) values
    ('50e00000-0000-0000-0000-000000000001', '50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', 'enc_parity_iban', 'fp_parity_iban_01', 'Banca Transilvania', 'RON', 'active');

  -- Two Invoices for Unit 101: 300.00 RON each (Total 600.00 RON)
  insert into billing.invoices (
    id, tenant_id, property_id, unit_id, liable_party_id, period_start, period_end, due_on, currency, subtotal, tax_total, status, issued_on
  ) values
    ('50c00000-0000-0000-0000-000000000001', '50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', '50700000-0000-0000-0000-000000000001', '50900000-0000-0000-0000-000000000001', '2026-09-01', '2026-09-30', '2026-09-25', 'RON', 300.00, 0, 'issued', '2026-09-02'),
    ('50c00000-0000-0000-0000-000000000002', '50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', '50700000-0000-0000-0000-000000000001', '50900000-0000-0000-0000-000000000001', '2026-09-01', '2026-09-30', '2026-09-25', 'RON', 300.00, 0, 'issued', '2026-09-02');

  insert into billing.receivables (id, tenant_id, invoice_id, original_amount, paid_amount, credited_amount) values
    ('50d00000-0000-0000-0000-000000000001', '50100000-0000-0000-0000-000000000001', '50c00000-0000-0000-0000-000000000001', 300.00, 0, 0),
    ('50d00000-0000-0000-0000-000000000002', '50100000-0000-0000-0000-000000000001', '50c00000-0000-0000-0000-000000000002', 300.00, 0, 0);

  -- Post AR Recognition Journal: Debit 4111 600.00, Credit 704 600.00
  insert into finance.journals (
    tenant_id, property_id, occurred_on, currency, description, source_type, source_id, status
  ) values (
    '50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', '2026-09-02', 'RON', 'Maintenance bill issuance', 'billing.invoice', '50c00000-0000-0000-0000-000000000001', 'draft'
  ) returning id into v_journal_id;

  insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo) values
    ('50100000-0000-0000-0000-000000000001', v_journal_id, '50a00000-0000-0000-0000-000000000001', 'debit', 600.00, 'AR from bills'),
    ('50100000-0000-0000-0000-000000000001', v_journal_id, '50a00000-0000-0000-0000-000000000004', 'credit', 600.00, 'Revenue recognized');

  update finance.journals set status = 'posted', posted_at = statement_timestamp() where id = v_journal_id;
end $$;

-- Verify Initial Parity: 4111 balance = 600.00, Receivables outstanding = 600.00, Delta = 0
select ok(
  (select (finance.get_ar_subledger_parity('50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', 'RON'))->>'ar_gl_subledger_delta') = '0.0000',
  'initial baseline: 4111 GL matches receivables outstanding with zero delta'
);

-- 4. Test Positive: Record Unallocated Payment (800.00 RON)
-- Accounting Contract A: Dr 5121 Bank, Cr 419 Clearing. 4111 is untouched! Receivables untouched!
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000001","aal":"aal2"}', true);

do $$
declare
  v_res jsonb;
begin
  v_res := payments.record_payment(
    '50400000-0000-0000-0000-000000000001',
    '50500000-0000-0000-0000-000000000001',
    800.00,
    'RON',
    '2026-09-05T10:00:00Z',
    '50700000-0000-0000-0000-000000000001',
    '50900000-0000-0000-0000-000000000001',
    'bank_transfer',
    'PARITY-TX-001',
    'Prepayment / Advance',
    'IDEMP-PARITY-REC-001'
  );
end $$;

-- Assert 4111 is still exactly 600.00 (Untouched!)
select ok(
  (select coalesce(sum(case when side = 'debit' then amount else -amount end), 0)
   from finance.journal_entries je
   join finance.journals j on j.id = je.journal_id
   where je.account_id = '50a00000-0000-0000-0000-000000000001' and j.status = 'posted') = 600.0000,
  'stage 1: 4111 GL is untouched by unallocated payment'
);

-- Assert Receivables outstanding is still 600.00 (Untouched!)
select ok(
  (select sum(outstanding_amount) from billing.receivables where tenant_id = '50100000-0000-0000-0000-000000000001') = 600.0000,
  'stage 1: receivables subledger is untouched by unallocated payment'
);

-- Assert 419 balance is exactly 800.00 credit
select ok(
  (select coalesce(sum(case when side = 'credit' then amount else -amount end), 0)
   from finance.journal_entries je
   join finance.journals j on j.id = je.journal_id
   where je.account_id = '50a00000-0000-0000-0000-000000000003' and j.status = 'posted') = 800.0000,
  'stage 1: 419 clearing account holds exactly unallocated payment balance'
);

-- Assert Bank 5121 balance is 800.00 debit
select ok(
  (select coalesce(sum(case when side = 'debit' then amount else -amount end), 0)
   from finance.journal_entries je
   join finance.journals j on j.id = je.journal_id
   where je.account_id = '50a00000-0000-0000-0000-000000000002' and j.status = 'posted') = 800.0000,
  'stage 1: 5121 bank account holds exactly received payment'
);

-- Assert Parity Diagnostic confirms zero delta for both 4111 and 419
select ok(
  (select (finance.get_ar_subledger_parity('50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', 'RON'))->>'parity_preserved') = 'true',
  'stage 1: diagnostic confirms continuous parity is preserved after unallocated payment'
);

-- 5. Test Positive: Multi-Bill Allocation (300 to Invoice 1, 200 to Invoice 2 = 500 total)
-- Accounting Contract B: Dr 419 Clearing 500, Cr 4111 AR 500.
do $$
declare
  v_pay_id uuid;
  v_res jsonb;
begin
  select id into v_pay_id from payments.payments where provider_ref = 'PARITY-TX-001';

  v_res := payments.allocate_payment(
    '50400000-0000-0000-0000-000000000001',
    v_pay_id,
    jsonb_build_array(
      jsonb_build_object('receivable_id', '50d00000-0000-0000-0000-000000000001'::uuid, 'amount', 300.00),
      jsonb_build_object('receivable_id', '50d00000-0000-0000-0000-000000000002'::uuid, 'amount', 200.00)
    ),
    'IDEMP-PARITY-ALLOC-001'
  );
end $$;

-- Assert Invoice 1 is fully paid
select ok((select status::text from billing.invoices where id = '50c00000-0000-0000-0000-000000000001') = 'paid', 'stage 2: invoice 1 is paid');
select ok((select outstanding_amount from billing.receivables where id = '50d00000-0000-0000-0000-000000000001') = 0.0000, 'stage 2: invoice 1 outstanding is 0');

-- Assert Invoice 2 is partially paid (100 remaining)
select ok((select status::text from billing.invoices where id = '50c00000-0000-0000-0000-000000000002') = 'partially_paid', 'stage 2: invoice 2 is partially_paid');
select ok((select outstanding_amount from billing.receivables where id = '50d00000-0000-0000-0000-000000000002') = 100.0000, 'stage 2: invoice 2 outstanding is 100');

-- Assert 4111 GL net balance decreased by 500 (from 600 to 100)
select ok(
  (select coalesce(sum(case when side = 'debit' then amount else -amount end), 0)
   from finance.journal_entries je
   join finance.journals j on j.id = je.journal_id
   where je.account_id = '50a00000-0000-0000-0000-000000000001' and j.status = 'posted') = 100.0000,
  'stage 2: 4111 GL net balance is exactly 100.00'
);

-- Assert Parity Diagnostic confirms zero delta after multi-bill allocation
select ok(
  (select (finance.get_ar_subledger_parity('50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', 'RON'))->>'parity_preserved') = 'true',
  'stage 2: diagnostic confirms continuous parity after multi-bill allocation'
);

-- 6. Test Positive: Partial Unallocation (Unallocate 200 from Invoice 2)
-- Accounting Contract D: Compensating journal Dr 4111 200, Cr 419 200.
do $$
declare
  v_alloc_id uuid;
begin
  select id into v_alloc_id
  from payments.payment_allocations
  where receivable_id = '50d00000-0000-0000-0000-000000000002' and status = 'active';

  perform payments.unallocate_payment('50400000-0000-0000-0000-000000000001', v_alloc_id, 'Correction of invoice 2 allocation');
end $$;

-- Assert Invoice 2 restored to issued, outstanding restored to 300
select ok((select status::text from billing.invoices where id = '50c00000-0000-0000-0000-000000000002') = 'issued', 'stage 3: invoice 2 restored to issued');
select ok((select outstanding_amount from billing.receivables where id = '50d00000-0000-0000-0000-000000000002') = 300.0000, 'stage 3: invoice 2 outstanding restored to 300');

-- Assert 4111 net balance restored to 300 (Invoice 1 is still paid with 300)
select ok(
  (select coalesce(sum(case when side = 'debit' then amount else -amount end), 0)
   from finance.journal_entries je
   join finance.journals j on j.id = je.journal_id
   where je.account_id = '50a00000-0000-0000-0000-000000000001' and j.status = 'posted') = 300.0000,
  'stage 3: 4111 GL net balance restored to 300.00'
);

-- Assert Parity Diagnostic confirms zero delta after unallocation
select ok(
  (select (finance.get_ar_subledger_parity('50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', 'RON'))->>'parity_preserved') = 'true',
  'stage 3: diagnostic confirms continuous parity after unallocation'
);

-- 7. Test Positive: Split Reversal / Refund
-- Payment currently has: 300 allocated (to Invoice 1), 500 unallocated.
-- Accounting Contract E: Allocated portion posts Dr 4111 300. Unallocated portion posts Dr 419 500. Total Bank Cr 5121 800.
do $$
declare
  v_pay_id uuid;
  v_res jsonb;
  v_rev_journal_id uuid;
  v_dr numeric;
  v_cr numeric;
begin
  select id into v_pay_id from payments.payments where provider_ref = 'PARITY-TX-001';
  v_res := payments.reverse_payment('50400000-0000-0000-0000-000000000001', v_pay_id, 'Bank chargeback');
  v_rev_journal_id := (v_res->>'reversal_journal_id')::uuid;

  select coalesce(sum(amount) filter (where side = 'debit'), 0),
         coalesce(sum(amount) filter (where side = 'credit'), 0)
  into v_dr, v_cr
  from finance.journal_entries
  where journal_id = v_rev_journal_id;

  if v_dr <> 800.00 or v_cr <> 800.00 then
    raise exception 'reversal_not_balanced: dr=%, cr=%', v_dr, v_cr;
  end if;
end $$;

-- Assert Invoice 1 outstanding restored to 300 and status restored to issued
select ok((select status::text from billing.invoices where id = '50c00000-0000-0000-0000-000000000001') = 'issued', 'stage 4: invoice 1 restored to issued after payment reversal');
select ok((select outstanding_amount from billing.receivables where id = '50d00000-0000-0000-0000-000000000001') = 300.0000, 'stage 4: invoice 1 outstanding restored to 300');

-- Assert 4111 balance restored to original 600.00
select ok(
  (select coalesce(sum(case when side = 'debit' then amount else -amount end), 0)
   from finance.journal_entries je
   join finance.journals j on j.id = je.journal_id
   where je.account_id = '50a00000-0000-0000-0000-000000000001' and j.status = 'posted') = 600.0000,
  'stage 4: 4111 GL net balance restored to full receivables total (600.00)'
);

-- Assert 419 clearing account balance is 0.00 (completely cleared)
select ok(
  (select coalesce(sum(case when side = 'credit' then amount else -amount end), 0)
   from finance.journal_entries je
   join finance.journals j on j.id = je.journal_id
   where je.account_id = '50a00000-0000-0000-0000-000000000003' and j.status = 'posted') = 0.0000,
  'stage 4: 419 clearing account balance is 0.00 after split reversal'
);

-- Assert double reversal is rejected
select throws_ok(
  $$
  select payments.reverse_payment(
    '50400000-0000-0000-0000-000000000001',
    (select id from payments.payments where provider_ref = 'PARITY-TX-001'),
    'Duplicate reversal attempt'
  )
  $$,
  'payment_already_reversed',
  'stage 4: duplicate reversal is strictly rejected'
);

-- Assert Parity Diagnostic confirms zero delta after reversal
select ok(
  (select (finance.get_ar_subledger_parity('50100000-0000-0000-0000-000000000001', '50500000-0000-0000-0000-000000000001', 'RON'))->>'parity_preserved') = 'true',
  'stage 4: diagnostic confirms continuous parity after payment reversal'
);

-- 8. Negative Tests
-- A. Cross-Tenant allocation rejected
select throws_like(
  $$
  select payments.allocate_payment(
    '50400000-0000-0000-0000-000000000001',
    (select id from payments.payments where provider_ref = 'PARITY-TX-001'),
    jsonb_build_array(jsonb_build_object('receivable_id', '40d00000-0000-0000-0000-000000000001'::uuid, 'amount', 10.00))
  )
  $$,
  '%receivable_not_found%',
  'cross-tenant receivable allocation rejected'
);

-- B. Closed-period allocation rejected
select throws_like(
  $$
  select payments.record_payment(
    '50400000-0000-0000-0000-000000000001',
    '50500000-0000-0000-0000-000000000001',
    100.00,
    'RON',
    '2026-08-10T10:00:00Z'
  )
  $$,
  '%closed%',
  'recording payment in closed period is rejected'
);

-- C. Over-allocation rejected
select throws_like(
  $$
  select payments.allocate_payment(
    '50400000-0000-0000-0000-000000000001',
    (select id from payments.payments where provider_ref = 'PARITY-TX-001'),
    jsonb_build_array(jsonb_build_object('receivable_id', '50d00000-0000-0000-0000-000000000001'::uuid, 'amount', 1000.00))
  )
  $$,
  '%payment_overallocated%',
  'over-allocation rejected'
);

-- D. Cross-unit allocation rejected for resident role
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000002","aal":"aal2"}', true);

select throws_like(
  $$
  select payments.record_payment(
    '50400000-0000-0000-0000-000000000002',
    '50500000-0000-0000-0000-000000000001',
    50.00,
    'RON',
    '2026-09-08T10:00:00Z',
    '50700000-0000-0000-0000-000000000002'
  )
  $$,
  '%payment_unit_scope_mismatch%',
  'resident cannot record payment for another unit'
);

-- E. Anon execution denied
select set_config('request.jwt.claim.role', 'anon', true);
select throws_like(
  $$
  select customer_api.record_payment_v1(
    '50400000-0000-0000-0000-000000000001',
    '50500000-0000-0000-0000-000000000001',
    100.00,
    'RON',
    '2026-09-08T10:00:00Z'
  )
  $$,
  '%permission denied%',
  'anon execution of record_payment_v1 denied'
);

-- 9. Idempotency replay check
select set_config('request.jwt.claim.sub', '50000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000001","aal":"aal2"}', true);

select ok(
  (select (payments.record_payment(
    '50400000-0000-0000-0000-000000000001',
    '50500000-0000-0000-0000-000000000001',
    800.00,
    'RON',
    '2026-09-05T10:00:00Z',
    '50700000-0000-0000-0000-000000000001',
    '50900000-0000-0000-0000-000000000001',
    'bank_transfer',
    'PARITY-TX-001',
    'Prepayment / Advance',
    'IDEMP-PARITY-REC-001'
  )->'payment'->>'id')::uuid) = (select id from payments.payments where provider_ref = 'PARITY-TX-001'),
  'replaying record_payment with same idempotency key returns existing payment ID'
);

-- 10. Audit trail emitted
select ok(exists (select 1 from audit.events where action = 'PAYMENT_RECORDED'), 'PAYMENT_RECORDED audit event exists');
select ok(exists (select 1 from audit.events where action = 'PAYMENT_ALLOCATED'), 'PAYMENT_ALLOCATED audit event exists');
select ok(exists (select 1 from audit.events where action = 'PAYMENT_UNALLOCATED'), 'PAYMENT_UNALLOCATED audit event exists');
select ok(exists (select 1 from audit.events where action = 'PAYMENT_REVERSED'), 'PAYMENT_REVERSED audit event exists');

rollback;
