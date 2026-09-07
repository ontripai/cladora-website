-- Test 052: Billing, Charges & Receivables Vertical Slice
-- Scope: RPC signatures, permissions, lifecycle mutations, double-entry accounting integration,
--        closed-period protection, cross-tenant isolation, audit events.

begin;
select plan(33);

-- 1. Function existence
select ok(to_regprocedure('billing.create_bill(uuid,uuid,uuid,uuid,date,date,date,text,jsonb,text)') is not null, 'billing.create_bill exists');
select ok(to_regprocedure('billing.update_bill(uuid,uuid,date,date,date,uuid,jsonb)') is not null, 'billing.update_bill exists');
select ok(to_regprocedure('billing.issue_bill(uuid,uuid,date,text)') is not null, 'billing.issue_bill exists');
select ok(to_regprocedure('billing.cancel_bill(uuid,uuid,text)') is not null, 'billing.cancel_bill exists');

select ok(to_regprocedure('customer_api.create_bill_v1(uuid,uuid,uuid,uuid,date,date,date,text,jsonb,text)') is not null, 'customer_api.create_bill_v1 exists');
select ok(to_regprocedure('customer_api.update_bill_v1(uuid,uuid,date,date,date,uuid,jsonb)') is not null, 'customer_api.update_bill_v1 exists');
select ok(to_regprocedure('customer_api.issue_bill_v1(uuid,uuid,date,text)') is not null, 'customer_api.issue_bill_v1 exists');
select ok(to_regprocedure('customer_api.cancel_bill_v1(uuid,uuid,text)') is not null, 'customer_api.cancel_bill_v1 exists');

-- 2. Privileges
select ok(has_function_privilege('authenticated', 'customer_api.create_bill_v1(uuid,uuid,uuid,uuid,date,date,date,text,jsonb,text)', 'EXECUTE'), 'authenticated may execute create_bill_v1');
select ok(not has_function_privilege('anon', 'customer_api.create_bill_v1(uuid,uuid,uuid,uuid,date,date,date,text,jsonb,text)', 'EXECUTE'), 'anonymous create_bill_v1 is denied');

-- 3. Setup isolated test data
do $$
declare
  v_perm_manage uuid;
  v_perm_issue uuid;
  v_perm_cancel uuid;
  v_perm_read uuid;
begin
  -- Insert test users
  insert into auth.users (id, email) values
    ('30000000-0000-0000-0000-000000000001', 'bill-admin@cladora.test'),
    ('30000000-0000-0000-0000-000000000002', 'bill-owner@cladora.test'),
    ('30000000-0000-0000-0000-000000000003', 'bill-denied@cladora.test');

  -- Insert test tenant and workspace
  insert into platform.tenants (id, legal_name, registration_number, status) values
    ('30100000-0000-0000-0000-000000000001', 'Billing Test Tenant', 'REG-BILL-001', 'active');

  insert into platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version) values
    ('30800000-0000-0000-0000-000000000001', '30100000-0000-0000-0000-000000000001', 'ASSOCIATION', 'ACTIVE', 'Billing Owner', 'PILOT', 1);

  insert into platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value) values
    ('30800000-0000-0000-0000-000000000001', 'module.billing', 'boolean', true);

  -- Roles
  insert into identity.roles (id, tenant_id, code, name) values
    ('30200000-0000-0000-0000-000000000001', '30100000-0000-0000-0000-000000000001', 'association_admin', 'Administrator'),
    ('30200000-0000-0000-0000-000000000002', '30100000-0000-0000-0000-000000000001', 'owner', 'Owner'),
    ('30200000-0000-0000-0000-000000000003', '30100000-0000-0000-0000-000000000001', 'censor', 'Censor');

  select id into v_perm_manage from identity.permissions where code = 'billing.manage';
  select id into v_perm_issue from identity.permissions where code = 'billing.issue';
  select id into v_perm_cancel from identity.permissions where code = 'billing.cancel';
  select id into v_perm_read from identity.permissions where code = 'billing.receivables.read';

  insert into identity.role_permissions (role_id, permission_id, effect) values
    ('30200000-0000-0000-0000-000000000001', v_perm_manage, 'allow'),
    ('30200000-0000-0000-0000-000000000001', v_perm_issue, 'allow'),
    ('30200000-0000-0000-0000-000000000001', v_perm_cancel, 'allow'),
    ('30200000-0000-0000-0000-000000000001', v_perm_read, 'allow'),
    ('30200000-0000-0000-0000-000000000002', v_perm_read, 'allow');

  -- Memberships
  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at) values
    ('30300000-0000-0000-0000-000000000001', '30100000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '30200000-0000-0000-0000-000000000001', 'active', statement_timestamp() - interval '1 day'),
    ('30300000-0000-0000-0000-000000000002', '30100000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '30200000-0000-0000-0000-000000000002', 'active', statement_timestamp() - interval '1 day'),
    ('30300000-0000-0000-0000-000000000003', '30100000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '30200000-0000-0000-0000-000000000003', 'active', statement_timestamp() - interval '1 day');

  -- Portfolio
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    ('30500000-0000-0000-0000-000000000001', '30100000-0000-0000-0000-000000000001', 'condominium', 'Test Complex', 'active');

  insert into portfolio.buildings (id, tenant_id, property_id, code, name, status) values
    ('30600000-0000-0000-0000-000000000001', '30100000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000001', 'B-01', 'Building 1', 'active');

  insert into portfolio.units (id, tenant_id, building_id, code, status) values
    ('30700000-0000-0000-0000-000000000001', '30100000-0000-0000-0000-000000000001', '30600000-0000-0000-0000-000000000001', 'U-101', 'active');

  insert into portfolio.parties (id, tenant_id, type, legal_name) values
    ('30900000-0000-0000-0000-000000000001', '30100000-0000-0000-0000-000000000001', 'person', 'Unit Owner');

  -- Context Grants
  insert into identity.context_grants (id, membership_id, tenant_id, scope_type, unit_id, starts_at) values
    ('30400000-0000-0000-0000-000000000001', '30300000-0000-0000-0000-000000000001', '30100000-0000-0000-0000-000000000001', 'tenant', null, statement_timestamp() - interval '1 day'),
    ('30400000-0000-0000-0000-000000000002', '30300000-0000-0000-0000-000000000002', '30100000-0000-0000-0000-000000000001', 'unit', '30700000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day'),
    ('30400000-0000-0000-0000-000000000003', '30300000-0000-0000-0000-000000000003', '30100000-0000-0000-0000-000000000001', 'tenant', null, statement_timestamp() - interval '1 day');

  insert into identity.membership_parties (membership_id, tenant_id, party_id) values
    ('30300000-0000-0000-0000-000000000002', '30100000-0000-0000-0000-000000000001', '30900000-0000-0000-0000-000000000001');

  insert into portfolio.ownerships (tenant_id, unit_id, party_id, share, valid_from) values
    ('30100000-0000-0000-0000-000000000001', '30700000-0000-0000-0000-000000000001', '30900000-0000-0000-0000-000000000001', 1, current_date - 1);

  -- Finance: Accounts
  insert into finance.accounts (id, tenant_id, property_id, code, name, type, currency) values
    ('30a00000-0000-0000-0000-000000000001', '30100000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000001', '4111', 'Test Receivables', 'asset', 'RON'),
    ('30a00000-0000-0000-0000-000000000002', '30100000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000001', '704', 'Test Revenue', 'income', 'RON');

  -- Financial Periods: One Closed (2025), One Open (current 2026)
  insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status, closed_at, snapshot_json) values
    ('30b00000-0000-0000-0000-000000000001', '30100000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000001', '2025-01-01', '2025-01-31', 'closed', statement_timestamp(), '{"closed":true}'::jsonb),
    ('30b00000-0000-0000-0000-000000000002', '30100000-0000-0000-0000-000000000001', '30500000-0000-0000-0000-000000000001', '2026-09-01', '2026-09-30', 'open', null, null);
end $$;

-- 4. Test Draft Bill Creation
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

do $$
declare
  v_res jsonb;
  v_inv_id uuid;
begin
  v_res := billing.create_bill(
    '30400000-0000-0000-0000-000000000001',
    '30500000-0000-0000-0000-000000000001',
    '30700000-0000-0000-0000-000000000001',
    '30900000-0000-0000-0000-000000000001',
    '2026-09-01'::date,
    '2026-09-30'::date,
    '2026-10-15'::date,
    'RON',
    '[{"description":"Maintenance fee","quantity":1,"unit_price":150,"tax_rate":0.19}]'::jsonb,
    'idemp-test-001'
  );

  v_inv_id := (v_res->>'id')::uuid;
  perform set_config('test.created_invoice_id', v_inv_id::text, true);
end $$;

reset role;
select ok(current_setting('test.created_invoice_id', true) is not null, 'draft bill created successfully');

select ok(
  (select status = 'draft' and total = 178.5000 and subtotal = 150.0000 and tax_total = 28.5000
   from billing.invoices where id = current_setting('test.created_invoice_id', true)::uuid),
  'draft bill amounts and status stored correctly'
);

select ok(
  exists (select 1 from billing.invoice_lines where invoice_id = current_setting('test.created_invoice_id', true)::uuid and line_subtotal = 150 and line_tax = 28.5),
  'draft bill lines stored with computed totals'
);

select ok(
  exists (select 1 from audit.events where action = 'BILL_CREATED' and entity_id = current_setting('test.created_invoice_id', true)::uuid),
  'BILL_CREATED audit event emitted'
);

-- Idempotent create replay
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

select ok(
  (billing.create_bill(
    '30400000-0000-0000-0000-000000000001',
    '30500000-0000-0000-0000-000000000001',
    '30700000-0000-0000-0000-000000000001',
    '30900000-0000-0000-0000-000000000001',
    '2026-09-01'::date,
    '2026-09-30'::date,
    '2026-10-15'::date,
    'RON',
    '[{"description":"Maintenance fee","quantity":1,"unit_price":150,"tax_rate":0.19}]'::jsonb,
    'idemp-test-001'
  )->>'idempotent_replay')::boolean,
  'idempotency replay returns existing bill without duplicate creation'
);

-- 5. Test Update Draft Bill
do $$
begin
  perform billing.update_bill(
    '30400000-0000-0000-0000-000000000001',
    current_setting('test.created_invoice_id', true)::uuid,
    '2026-10-20'::date,
    null, null, null,
    '[{"description":"Updated Maintenance fee","quantity":1,"unit_price":200,"tax_rate":0.19}]'::jsonb
  );
end $$;

reset role;
select ok(
  (select subtotal = 200.0000 and tax_total = 38.0000 and total = 238.0000 and due_on = '2026-10-20'::date
   from billing.invoices where id = current_setting('test.created_invoice_id', true)::uuid),
  'draft bill successfully updated with new lines and total'
);

-- 6. NEGATIVE FINANCIAL TEST: Issue Bill in CLOSED PERIOD must FAIL
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

select throws_like(
  format('select billing.issue_bill(''30400000-0000-0000-0000-000000000001'', ''%s''::uuid, ''2025-01-15''::date)', current_setting('test.created_invoice_id', true)),
  '%closed%',
  'issuing bill in closed accounting period is strictly rejected'
);

-- Verify invoice remained untouched in draft status after rejection (Zero Partial Write)
reset role;
select ok(
  (select status = 'draft' and journal_id is null from billing.invoices where id = current_setting('test.created_invoice_id', true)::uuid),
  'zero partial write: invoice remains in draft state when issue in closed period fails'
);

-- 7. POSITIVE FINANCIAL TEST: Issue Bill in OPEN PERIOD
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

do $$
declare
  v_issue_res jsonb;
begin
  v_issue_res := billing.issue_bill(
    '30400000-0000-0000-0000-000000000001',
    current_setting('test.created_invoice_id', true)::uuid,
    '2026-09-15'::date
  );
  perform set_config('test.issued_journal_id', v_issue_res->>'journal_id', true);
end $$;

reset role;
select ok(
  (select status = 'issued' and issued_on = '2026-09-15'::date and journal_id is not null
   from billing.invoices where id = current_setting('test.created_invoice_id', true)::uuid),
  'bill issued with posted status and journal link'
);

-- Double-Entry Accounting Proof: Journal is posted, balanced, occurred_on matches, debit = credit
select ok(
  (select status = 'posted' and posted_at is not null and occurred_on = '2026-09-15'::date
   from finance.journals where id = current_setting('test.issued_journal_id', true)::uuid),
  'accounting journal is posted with non-null posted_at in open period'
);

select ok(
  (select count(*) = 2 and sum(case when side='debit' then amount else -amount end) = 0 and sum(amount) = 476.0000
   from finance.journal_entries where journal_id = current_setting('test.issued_journal_id', true)::uuid),
  'double-entry proof: debit matches credit exactly (2 balanced entries, zero net difference)'
);

-- Receivable proof: original_amount = total, outstanding_amount = total
select ok(
  (select original_amount = 238.0000 and outstanding_amount = 238.0000 and paid_amount = 0
   from billing.receivables where invoice_id = current_setting('test.created_invoice_id', true)::uuid),
  'receivable tracking row created with outstanding balance equal to total'
);

select ok(
  exists (select 1 from audit.events where action = 'BILL_ISSUED' and entity_id = current_setting('test.created_invoice_id', true)::uuid),
  'BILL_ISSUED audit event emitted'
);

-- 8. Test Mutation Immutability: Cannot update issued bill lines
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

select throws_like(
  format('select billing.update_bill(''30400000-0000-0000-0000-000000000001'', ''%s''::uuid, ''2026-11-01''::date)', current_setting('test.created_invoice_id', true)),
  '%cannot_update_non_draft_bill%',
  'cannot update bill once issued'
);

-- 9. Role Matrix Authorizations
-- Owner can READ own unit bill with AAL1
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal1"}', true);
select ok(
  ((billing.get_customer_billing('30400000-0000-0000-0000-000000000002')->>'total')::int = 1),
  'owner with AAL1 can read own unit issued bills'
);

-- Owner cannot mutate (DENIED)
select throws_like(
  format('select billing.create_bill(''30400000-0000-0000-0000-000000000002'', ''30500000-0000-0000-0000-000000000001'', ''30700000-0000-0000-0000-000000000001'', ''30900000-0000-0000-0000-000000000001'', ''2026-09-01''::date, ''2026-09-30''::date, ''2026-10-15''::date, ''RON'', ''[{"description":"x","quantity":1,"unit_price":10,"tax_rate":0}]''::jsonb)'),
  '%billing_mutation_role_denied%',
  'owner is denied from creating bills'
);

-- Censor is READ-ONLY (DENIED mutation)
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  format('select billing.create_bill(''30400000-0000-0000-0000-000000000003'', ''30500000-0000-0000-0000-000000000001'', ''30700000-0000-0000-0000-000000000001'', ''30900000-0000-0000-0000-000000000001'', ''2026-09-01''::date, ''2026-09-30''::date, ''2026-10-15''::date, ''RON'', ''[{"description":"x","quantity":1,"unit_price":10,"tax_rate":0}]''::jsonb)'),
  '%billing_mutation_role_denied%',
  'censor is denied from creating bills'
);

-- Admin with AAL1 is DENIED (MFA required)
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select throws_like(
  format('select billing.issue_bill(''30400000-0000-0000-0000-000000000001'', ''%s''::uuid)', current_setting('test.created_invoice_id', true)),
  '%mfa_required%',
  'admin with AAL1 is rejected due to mandatory AAL2 MFA policy'
);

-- 10. Cancellation & Reversal Test (with AAL2)
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

do $$
declare
  v_cancel_res jsonb;
begin
  v_cancel_res := billing.cancel_bill(
    '30400000-0000-0000-0000-000000000001',
    current_setting('test.created_invoice_id', true)::uuid,
    'Client requested cancellation'
  );
  perform set_config('test.reversal_journal_id', v_cancel_res->>'reversal_journal_id', true);
end $$;

reset role;
select ok(
  (select status = 'void' from billing.invoices where id = current_setting('test.created_invoice_id', true)::uuid),
  'cancelled bill status transitioned to void'
);

select ok(
  (select credited_amount = original_amount and outstanding_amount = 0
   from billing.receivables where invoice_id = current_setting('test.created_invoice_id', true)::uuid),
  'receivable outstanding balance reduced to 0 upon cancellation'
);

select ok(
  (select status = 'reversed' and reversal_of_id = current_setting('test.issued_journal_id', true)::uuid
   from finance.journals where id = current_setting('test.reversal_journal_id', true)::uuid),
  'reversal journal posted with reversed status referencing original journal'
);

select ok(
  exists (select 1 from audit.events where action = 'BILL_CANCELLED' and entity_id = current_setting('test.created_invoice_id', true)::uuid),
  'BILL_CANCELLED audit event emitted'
);

-- 11. Customer API Gateway Wrapper Test
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"30000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

select ok(
  (customer_api.create_bill_v1(
    '30400000-0000-0000-0000-000000000001',
    '30500000-0000-0000-0000-000000000001',
    '30700000-0000-0000-0000-000000000001',
    '30900000-0000-0000-0000-000000000001',
    '2026-09-01'::date,
    '2026-09-30'::date,
    '2026-10-15'::date,
    'RON',
    '[{"description":"Customer API fee","quantity":1,"unit_price":75,"tax_rate":0}]'::jsonb
  )->>'total')::numeric = 75.0000,
  'customer_api.create_bill_v1 successfully creates draft invoice via gateway wrapper'
);

reset role;
rollback;
