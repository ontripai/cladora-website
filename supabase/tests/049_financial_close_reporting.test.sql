begin;
select plan(60);

-- 1. Schema & Privilege verifications
select ok(to_regprocedure('finance.get_close_readiness(uuid,uuid)') is not null, 'finance.get_close_readiness RPC exists');
select ok(has_function_privilege('authenticated', 'finance.get_close_readiness(uuid,uuid)', 'EXECUTE'), 'authenticated may execute get_close_readiness');
select ok(not has_function_privilege('anon', 'finance.get_close_readiness(uuid,uuid)', 'EXECUTE'), 'anon is revoked from executing get_close_readiness');

select ok(to_regprocedure('finance.get_customer_financial_report(uuid,text,date,date,text)') is not null, 'finance.get_customer_financial_report RPC exists');
select ok(has_function_privilege('authenticated', 'finance.get_customer_financial_report(uuid,text,date,date,text)', 'EXECUTE'), 'authenticated may execute get_customer_financial_report');
select ok(not has_function_privilege('anon', 'finance.get_customer_financial_report(uuid,text,date,date,text)', 'EXECUTE'), 'anon is revoked from executing get_customer_financial_report');

select ok(to_regprocedure('finance.close_accounting_period(uuid,uuid)') is not null, 'finance.close_accounting_period(uuid,uuid) RPC exists');
select ok(has_function_privilege('authenticated', 'finance.close_accounting_period(uuid,uuid)', 'EXECUTE'), 'authenticated may execute close_accounting_period(uuid,uuid)');
select ok(not has_function_privilege('anon', 'finance.close_accounting_period(uuid,uuid)', 'EXECUTE'), 'anon is revoked from executing close_accounting_period(uuid,uuid)');

select ok(to_regprocedure('finance.close_accounting_period(uuid,uuid,text)') is not null, 'finance.close_accounting_period(uuid,uuid,text) RPC exists');
select ok(has_function_privilege('authenticated', 'finance.close_accounting_period(uuid,uuid,text)', 'EXECUTE'), 'authenticated may execute close_accounting_period(uuid,uuid,text)');

select ok(to_regprocedure('app_private.resolve_financial_context_scope(uuid)') is not null, 'app_private.resolve_financial_context_scope helper exists');

-- 2. Columns & Permissions check
select ok(exists(
  select 1 from information_schema.columns
  where table_schema = 'finance'
    and table_name = 'accounting_periods'
    and column_name = 'closed_by'
), 'finance.accounting_periods has closed_by column');

select ok(exists(select 1 from identity.permissions where code = 'finance.reports.read'), 'finance.reports.read exists');
select ok(exists(select 1 from identity.permissions where code = 'finance.periods.read'), 'finance.periods.read exists');
select ok(exists(select 1 from identity.permissions where code = 'finance.periods.close'), 'finance.periods.close exists');

-- 3. Setup Test Data
do $$
declare
  perm_rep uuid;
  perm_prd_read uuid;
  perm_prd_close uuid;
  role_admin uuid := '23200000-0000-0000-0000-000000000001';
  role_manager uuid := '23200000-0000-0000-0000-000000000002';
  role_pres uuid := '23200000-0000-0000-0000-000000000003';
  role_censor uuid := '23200000-0000-0000-0000-000000000004';
  role_owner uuid := '23200000-0000-0000-0000-000000000005';
  role_resident uuid := '23200000-0000-0000-0000-000000000006';
  role_other uuid := '23200000-0000-0000-0000-000000000007';
begin
  select id into perm_rep from identity.permissions where code = 'finance.reports.read';
  select id into perm_prd_read from identity.permissions where code = 'finance.periods.read';
  select id into perm_prd_close from identity.permissions where code = 'finance.periods.close';

  -- Users
  insert into auth.users (id, email) values
    ('23000000-0000-0000-0000-000000000001', 'admin-049@cladora.test'),
    ('23000000-0000-0000-0000-000000000002', 'manager-049@cladora.test'),
    ('23000000-0000-0000-0000-000000000003', 'pres-049@cladora.test'),
    ('23000000-0000-0000-0000-000000000004', 'censor-049@cladora.test'),
    ('23000000-0000-0000-0000-000000000005', 'owner-049@cladora.test'),
    ('23000000-0000-0000-0000-000000000006', 'resident-049@cladora.test'),
    ('23000000-0000-0000-0000-000000000007', 'denied-049@cladora.test');

  -- Tenants
  insert into platform.tenants (id, legal_name, registration_number, status) values
    ('23100000-0000-0000-0000-000000000001', 'Close Tenant 1', 'RO-ENG-049-1', 'active'),
    ('23100000-0000-0000-0000-000000000002', 'Close Tenant 2', 'RO-ENG-049-2', 'active');

  -- Roles
  insert into identity.roles (id, tenant_id, code, name) values
    (role_admin, '23100000-0000-0000-0000-000000000001', 'association_admin', 'Administrator'),
    (role_manager, '23100000-0000-0000-0000-000000000001', 'property_manager', 'Manager'),
    (role_pres, '23100000-0000-0000-0000-000000000001', 'president', 'President'),
    (role_censor, '23100000-0000-0000-0000-000000000001', 'censor', 'Censor'),
    (role_owner, '23100000-0000-0000-0000-000000000001', 'owner', 'Owner'),
    (role_resident, '23100000-0000-0000-0000-000000000001', 'tenant_resident', 'Resident'),
    (role_other, '23100000-0000-0000-0000-000000000002', 'association_admin', 'Other Admin');

  -- Role Permissions
  insert into identity.role_permissions (role_id, permission_id, effect) values
    (role_admin, perm_rep, 'allow'),
    (role_admin, perm_prd_read, 'allow'),
    (role_admin, perm_prd_close, 'allow'),
    (role_manager, perm_rep, 'allow'),
    (role_manager, perm_prd_read, 'allow'),
    (role_manager, perm_prd_close, 'allow'),
    (role_pres, perm_rep, 'allow'),
    (role_pres, perm_prd_read, 'allow'),
    (role_censor, perm_rep, 'allow'),
    (role_censor, perm_prd_read, 'allow'),
    (role_other, perm_rep, 'allow'),
    (role_other, perm_prd_read, 'allow'),
    (role_other, perm_prd_close, 'allow');

  -- Memberships
  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at) values
    ('23300000-0000-0000-0000-000000000001', '23100000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001', role_admin, 'active', statement_timestamp() - interval '1 day'),
    ('23300000-0000-0000-0000-000000000002', '23100000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000002', role_manager, 'active', statement_timestamp() - interval '1 day'),
    ('23300000-0000-0000-0000-000000000003', '23100000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000003', role_pres, 'active', statement_timestamp() - interval '1 day'),
    ('23300000-0000-0000-0000-000000000004', '23100000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000004', role_censor, 'active', statement_timestamp() - interval '1 day'),
    ('23300000-0000-0000-0000-000000000005', '23100000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000005', role_owner, 'active', statement_timestamp() - interval '1 day'),
    ('23300000-0000-0000-0000-000000000006', '23100000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000006', role_resident, 'active', statement_timestamp() - interval '1 day'),
    ('23300000-0000-0000-0000-000000000007', '23100000-0000-0000-0000-000000000002', '23000000-0000-0000-0000-000000000007', role_other, 'active', statement_timestamp() - interval '1 day');

  -- Portfolio Structure
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    ('23500000-0000-0000-0000-000000000001', '23100000-0000-0000-0000-000000000001', 'condominium', 'Property 049', 'active'),
    ('23500000-0000-0000-0000-000000000002', '23100000-0000-0000-0000-000000000002', 'condominium', 'Property 049 B', 'active');

  insert into portfolio.buildings (id, tenant_id, property_id, code, name, status) values
    ('23600000-0000-0000-0000-000000000001', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', 'B1', 'Building 1', 'active');

  insert into portfolio.units (id, tenant_id, building_id, code, status) values
    ('23700000-0000-0000-0000-000000000001', '23100000-0000-0000-0000-000000000001', '23600000-0000-0000-0000-000000000001', 'U1', 'active');

  -- Context Grants
  insert into identity.context_grants (id, membership_id, tenant_id, scope_type, property_id, building_id, unit_id, starts_at, ends_at) values
    ('23400000-0000-0000-0000-000000000001', '23300000-0000-0000-0000-000000000001', '23100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null),
    ('23400000-0000-0000-0000-000000000002', '23300000-0000-0000-0000-000000000002', '23100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null),
    ('23400000-0000-0000-0000-000000000003', '23300000-0000-0000-0000-000000000003', '23100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null),
    ('23400000-0000-0000-0000-000000000004', '23300000-0000-0000-0000-000000000004', '23100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null),
    ('23400000-0000-0000-0000-000000000005', '23300000-0000-0000-0000-000000000005', '23100000-0000-0000-0000-000000000001', 'unit', null, null, '23700000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day', null),
    ('23400000-0000-0000-0000-000000000006', '23300000-0000-0000-0000-000000000006', '23100000-0000-0000-0000-000000000001', 'unit', null, null, '23700000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day', null),
    ('23400000-0000-0000-0000-000000000007', '23300000-0000-0000-0000-000000000001', '23100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '3 days', statement_timestamp() - interval '1 day'),
    ('23400000-0000-0000-0000-000000000008', '23300000-0000-0000-0000-000000000007', '23100000-0000-0000-0000-000000000002', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null),
    -- Property-scoped context grant for Property Manager:
    ('23400000-0000-0000-0000-000000000009', '23300000-0000-0000-0000-000000000002', '23100000-0000-0000-0000-000000000001', 'property', '23500000-0000-0000-0000-000000000001', null, null, statement_timestamp() - interval '1 day', null),
    -- Tenant-scoped context grants for Owner and Resident (to test role-denial separate from unit-scope rejection):
    ('23400000-0000-0000-0000-000000000010', '23300000-0000-0000-0000-000000000005', '23100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null),
    ('23400000-0000-0000-0000-000000000011', '23300000-0000-0000-0000-000000000006', '23100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null);

  -- Workspaces & Entitlements
  insert into platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version) values
    ('23800000-0000-0000-0000-000000000001', '23100000-0000-0000-0000-000000000001', 'ASSOCIATION', 'ACTIVE', 'Admin 049', 'PILOT', 1),
    ('23800000-0000-0000-0000-000000000002', '23100000-0000-0000-0000-000000000002', 'ASSOCIATION', 'ACTIVE', 'Other 049', 'PILOT', 1);

  insert into platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value) values
    ('23800000-0000-0000-0000-000000000001', 'module.accounting', 'boolean', true),
    ('23800000-0000-0000-0000-000000000002', 'module.accounting', 'boolean', false);

  -- Chart of Accounts (Romanian plan de conturi compliant)
  insert into finance.accounts (id, tenant_id, property_id, code, name, type, currency) values
    ('23a00000-0000-0000-0000-000000000001', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '5121', 'Conturi la banci in lei', 'asset', 'RON'),
    ('23a00000-0000-0000-0000-000000000002', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '4111', 'Clienti', 'asset', 'RON'),
    ('23a00000-0000-0000-0000-000000000003', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '401', 'Furnizori', 'liability', 'RON'),
    ('23a00000-0000-0000-0000-000000000004', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '1012', 'Capital subscris varsat', 'equity', 'RON'),
    ('23a00000-0000-0000-0000-000000000005', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '605', 'Cheltuieli privind utilitatile', 'expense', 'RON'),
    ('23a00000-0000-0000-0000-000000000006', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '704', 'Venituri din servicii prestate', 'income', 'RON'),
    ('23a00000-0000-0000-0000-000000000007', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '5124', 'Conturi la banci in valuta', 'asset', 'EUR'),
    ('23a00000-0000-0000-0000-000000000008', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '7042', 'Venituri valuta', 'income', 'EUR');

  -- Accounting Periods: Period 1 (Jan 2026), Period 2 (Feb 2026), Period 3 (Future)
  insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status) values
    ('23c00000-0000-0000-0000-000000000001', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2026-01-01', '2026-01-31', 'open'),
    ('23c00000-0000-0000-0000-000000000002', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2026-02-01', '2026-02-28', 'open'),
    ('23c00000-0000-0000-0000-000000000003', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', current_date, current_date + interval '30 days', 'open');

  -- Journals in Period 1:
  -- Journal 1: Draft in Period 1 (500 RON)
  insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status) values
    ('23b00000-0000-0000-0000-000000000001', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2026-01-15', 'RON', 'Maintenance revenue draft', 'invoice', 'draft');

  insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo) values
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000001', '23a00000-0000-0000-0000-000000000001', 'debit', 500, 'Bank debit'),
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000001', '23a00000-0000-0000-0000-000000000006', 'credit', 500, 'Revenue credit');

  -- Journal 2: in Period 1 (Expense 100 RON)
  insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status) values
    ('23b00000-0000-0000-0000-000000000002', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2026-01-20', 'RON', 'Electricity invoice', 'vendor_bill', 'draft');

  insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo) values
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000002', '23a00000-0000-0000-0000-000000000005', 'debit', 100, 'Utility expense'),
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000002', '23a00000-0000-0000-0000-000000000003', 'credit', 100, 'Supplier payable');

  -- Journal 3: in Period 1 (50 EUR)
  insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status) values
    ('23b00000-0000-0000-0000-000000000003', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2026-01-25', 'EUR', 'Foreign service', 'invoice', 'draft');

  insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo) values
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000003', '23a00000-0000-0000-0000-000000000007', 'debit', 50, 'EUR Bank debit'),
    ('23100000-0000-0000-0000-000000000003', '23a00000-0000-0000-0000-000000000008', 'credit', 50, 'EUR Revenue credit');

  -- Post Journal 2 and 3
  update finance.journals
  set status = 'posted', posted_at = statement_timestamp()
  where id in ('23b00000-0000-0000-0000-000000000002', '23b00000-0000-0000-0000-000000000003');

  -- Journal 4: 200 RON Posted in Period 1
  insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status, posted_at) values
    ('23b00000-0000-0000-0000-000000000004', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2026-01-28', 'RON', 'Original journal to reverse', 'invoice', 'posted', statement_timestamp());

  insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo) values
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000004', '23a00000-0000-0000-0000-000000000001', 'debit', 200, 'Bank debit'),
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000004', '23a00000-0000-0000-0000-000000000006', 'credit', 200, 'Revenue credit');

  -- Journal 5: Reversal compensating journal for Journal 4 (status = 'reversed', reversal_of_id set)
  insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status, reversal_of_id, posted_at) values
    ('23b00000-0000-0000-0000-000000000005', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2026-01-29', 'RON', 'Reversal of J4', 'reversal', 'reversed', '23b00000-0000-0000-0000-000000000004', statement_timestamp());

  insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo) values
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000005', '23a00000-0000-0000-0000-000000000006', 'debit', 200, 'Revenue reversal debit'),
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000005', '23a00000-0000-0000-0000-000000000001', 'credit', 200, 'Bank reversal credit');
end $$;

-- 4. Role & Claims Security Execution
set local role authenticated;

-- Test AAL1 rejection
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select throws_like(
  $$ select finance.get_close_readiness('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000001') $$,
  '%mfa_required%',
  'AAL1 fails close readiness check'
);

-- Test Expired Context rejection
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.get_close_readiness('23400000-0000-0000-0000-000000000007', '23c00000-0000-0000-0000-000000000001') $$,
  '%customer_context_access_denied%',
  'Expired context is denied'
);

-- Test Cross-tenant Context rejection
select throws_like(
  $$ select finance.get_close_readiness('23400000-0000-0000-0000-000000000008', '23c00000-0000-0000-0000-000000000001') $$,
  '%customer_context_access_denied%',
  'Cross-tenant context is denied'
);

-- Test Unit Context rejection on get_close_readiness (fail-closed)
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000005","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.get_close_readiness('23400000-0000-0000-0000-000000000005', '23c00000-0000-0000-0000-000000000001') $$,
  '%financial_reporting_requires_property_or_association_scope%',
  'Unit scope is rejected from close readiness (fail-closed)'
);

-- Test Unit Context rejection on get_customer_financial_report (fail-closed)
select throws_like(
  $$ select finance.get_customer_financial_report('23400000-0000-0000-0000-000000000005', 'trial_balance', '2026-01-01', '2026-01-31', 'RON') $$,
  '%financial_reporting_requires_property_or_association_scope%',
  'Unit scope is rejected from financial reports (fail-closed)'
);

-- 5. Close Readiness Inspection with Draft Blocker
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select ok(
  (finance.get_close_readiness('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000001')->>'can_close')::boolean = false,
  'Period 1 is not ready while draft journal exists'
);
select ok(
  (finance.get_close_readiness('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000001')->>'draft_journals_count')::int = 1,
  'Readiness identifies 1 draft journal'
);
select ok(
  (finance.get_close_readiness('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000001')->'currency_summaries') is not null,
  'Readiness returns currency_summaries array'
);

-- Censor and President can read readiness
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select ok(
  finance.get_close_readiness('23400000-0000-0000-0000-000000000003', '23c00000-0000-0000-0000-000000000001') is not null,
  'President can inspect close readiness'
);

select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}', true);
select ok(
  finance.get_close_readiness('23400000-0000-0000-0000-000000000004', '23c00000-0000-0000-0000-000000000001') is not null,
  'Censor can inspect close readiness'
);

-- Residents (Owner, Resident) are denied from readiness inspection even with tenant context
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000005","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.get_close_readiness('23400000-0000-0000-0000-000000000010', '23c00000-0000-0000-0000-000000000001') $$,
  '%periods_role_denied%',
  'Owner cannot inspect period close readiness'
);

select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000006","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.get_close_readiness('23400000-0000-0000-0000-000000000011', '23c00000-0000-0000-0000-000000000001') $$,
  '%periods_role_denied%',
  'Resident cannot inspect period close readiness'
);

-- 6. Close Period Mutation Checks
-- Attempt to close with draft journal -> rejected
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.close_accounting_period('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000001') $$,
  '%cannot_close_period_with_draft_journals%',
  'Closing period with draft journals fails'
);

-- Post the draft journal
reset role;
update finance.journals
set status = 'posted', posted_at = statement_timestamp()
where id = '23b00000-0000-0000-0000-000000000001';
set local role authenticated;

-- Attempt to close Period 2 while Period 1 is unclosed -> rejected
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.close_accounting_period('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000002') $$,
  '%preceding_periods_unclosed%',
  'Closing period out of sequence fails'
);

-- Attempt to close Future Period 3 -> rejected (period_not_ended)
select throws_like(
  $$ select finance.close_accounting_period('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000003') $$,
  '%period_not_ended%',
  'Closing future period fails with period_not_ended'
);

-- Role prohibition: President and Censor cannot close period
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.close_accounting_period('23400000-0000-0000-0000-000000000003', '23c00000-0000-0000-0000-000000000001') $$,
  '%period_close_forbidden_for_role%',
  'President cannot execute close period mutation'
);

select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.close_accounting_period('23400000-0000-0000-0000-000000000004', '23c00000-0000-0000-0000-000000000001') $$,
  '%period_close_forbidden_for_role%',
  'Censor cannot execute close period mutation'
);

-- Successful Close Execution by Admin with optional reason
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select ok(
  (finance.close_accounting_period('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000001', 'Monthly close verification')->>'success')::boolean = true,
  'Admin successfully closes Period 1 with reason'
);

-- Verify immutable closed state
reset role;
select ok(
  (select status = 'closed' and closed_by = '23000000-0000-0000-0000-000000000001'::uuid and closed_at is not null
   from finance.accounting_periods where id = '23c00000-0000-0000-0000-000000000001'),
  'Period 1 status is closed with closed_by and closed_at set'
);

-- Verify Version 2 snapshot stored
select ok(
  (select (snapshot_json->>'snapshot_version')::int = 2
   from finance.accounting_periods where id = '23c00000-0000-0000-0000-000000000001'),
  'Period 1 snapshot has snapshot_version = 2'
);

-- Verify multi-currency segregation in snapshot
select ok(
  (select jsonb_array_length(snapshot_json->'currency_summaries') >= 2
   from finance.accounting_periods where id = '23c00000-0000-0000-0000-000000000001'),
  'Period 1 snapshot contains multi-currency segregated summaries (RON and EUR)'
);

-- Verify close_reason preserved in snapshot
select ok(
  (select snapshot_json->>'close_reason' = 'Monthly close verification'
   from finance.accounting_periods where id = '23c00000-0000-0000-0000-000000000001'),
  'Period 1 snapshot contains close_reason'
);

-- Verify atomic audit event logged in audit.events
select ok(
  (select count(*) = 1 from audit.events
   where action = 'ACCOUNTING_PERIOD_CLOSED'
     and entity_type = 'accounting_period'
     and entity_id = '23c00000-0000-0000-0000-000000000001'::uuid),
  'Atomic audit event recorded for period close in audit.events'
);
set local role authenticated;

-- Conflict / Idempotency check: Closing already closed period fails
select throws_like(
  $$ select finance.close_accounting_period('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000001') $$,
  '%period_already_closed%',
  'Closing an already closed period fails with conflict'
);

-- 7. Management Financial Reports
-- Trial Balance in RON
select ok(
  (finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000001',
    'trial_balance',
    '2026-01-01',
    '2026-01-31',
    'RON'
  )->>'is_balanced')::boolean = true,
  'RON Trial Balance is balanced'
);

select ok(
  (finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000001',
    'trial_balance',
    '2026-01-01',
    '2026-01-31',
    'RON'
  )->'totals'->>'total_debit')::numeric = 1000,
  'RON Trial Balance total debit includes posted and reversed journals (1000 RON)'
);

-- Multi-currency segregation: EUR report
select ok(
  (finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000001',
    'trial_balance',
    '2026-01-01',
    '2026-01-31',
    'EUR'
  )->'totals'->>'total_debit')::numeric = 50,
  'EUR Trial Balance isolates EUR currency only'
);

-- Reversed journal fixture check: Net profit/loss on 704 revenue reflects cancellation
select ok(
  (select (elem->>'net_balance')::numeric = -500
   from jsonb_array_elements(finance.get_customer_financial_report(
     '23400000-0000-0000-0000-000000000001', 'trial_balance', '2026-01-01', '2026-01-31', 'RON'
   )->'accounts') elem
   where elem->>'code' = '704'),
  'Reversed journal net balance cancels out on revenue account 704'
);

-- Profit & Loss in RON
select ok(
  (finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000001',
    'profit_and_loss',
    '2026-01-01',
    '2026-01-31',
    'RON'
  )->'totals'->>'total_income')::numeric = 500,
  'RON P&L shows 500 revenue'
);

select ok(
  (finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000001',
    'profit_and_loss',
    '2026-01-01',
    '2026-01-31',
    'RON'
  )->'totals'->>'total_expense')::numeric = 100,
  'RON P&L shows 100 expense'
);

select ok(
  (finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000001',
    'profit_and_loss',
    '2026-01-01',
    '2026-01-31',
    'RON'
  )->'totals'->>'net_profit_loss')::numeric = 400,
  'RON P&L calculates net surplus of 400'
);

-- Balance Sheet in RON
select ok(
  (finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000001',
    'balance_sheet',
    '2026-01-01',
    '2026-01-31',
    'RON'
  )->'totals'->>'total_assets')::numeric = 500,
  'RON Balance Sheet total assets equals 500'
);

-- Supervisory & Audit Personas can run reports
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select ok(
  finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000003',
    'trial_balance',
    '2026-01-01',
    '2026-01-31',
    'RON'
  ) is not null,
  'President can generate financial reports'
);

select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}', true);
select ok(
  finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000004',
    'profit_and_loss',
    '2026-01-01',
    '2026-01-31',
    'RON'
  ) is not null,
  'Censor can generate financial reports'
);

-- Residents cannot run reports even with tenant context
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000005","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000010',
    'trial_balance',
    '2026-01-01',
    '2026-01-31',
    'RON'
  ) $$,
  '%reports_role_denied%',
  'Owner cannot generate financial reports'
);

select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000006","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000011',
    'balance_sheet',
    '2026-01-01',
    '2026-01-31',
    'RON'
  ) $$,
  '%reports_role_denied%',
  'Resident cannot generate financial reports'
);

-- Strict date range validation
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000001',
    'trial_balance',
    '2026-02-01',
    '2026-01-01',
    'RON'
  ) $$,
  '%invalid_date_range%',
  'Inverted date range fails with invalid_date_range'
);

-- Invalid report type validation
select throws_like(
  $$ select finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000001',
    'invalid_type',
    '2026-01-01',
    '2026-01-31',
    'RON'
  ) $$,
  '%invalid_report_type%',
  'Unknown report type fails with invalid_report_type'
);

-- 8. Property-Scoped Context Isolation
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select ok(
  finance.get_customer_financial_report(
    '23400000-0000-0000-0000-000000000009',
    'trial_balance',
    '2026-01-01',
    '2026-01-31',
    'RON'
  ) is not null,
  'Property-scoped context can access report for own property'
);

select throws_like(
  $$ select finance.get_close_readiness(
    '23400000-0000-0000-0000-000000000009',
    '23c00000-0000-0000-0000-000000000099'
  ) $$,
  '%accounting_period_not_found%',
  'Property-scoped context cannot access non-existent or cross-property period'
);

-- 9. Role Permissions Matrix Direct Asserts
reset role;
select ok(exists(
  select 1 from identity.role_permissions rp
  join identity.roles r on r.id = rp.role_id
  join identity.permissions p on p.id = rp.permission_id
  where r.code = 'president' and p.code = 'finance.reports.read' and rp.effect = 'allow'
), 'president has finance.reports.read');

select ok(exists(
  select 1 from identity.role_permissions rp
  join identity.roles r on r.id = rp.role_id
  join identity.permissions p on p.id = rp.permission_id
  where r.code = 'censor' and p.code = 'finance.reports.read' and rp.effect = 'allow'
), 'censor has finance.reports.read');

select ok(not exists(
  select 1 from identity.role_permissions rp
  join identity.roles r on r.id = rp.role_id
  join identity.permissions p on p.id = rp.permission_id
  where r.code in ('president', 'censor') and p.code = 'finance.periods.close' and rp.effect = 'allow'
), 'president and censor do not have finance.periods.close');

select ok(not exists(
  select 1 from identity.role_permissions rp
  join identity.roles r on r.id = rp.role_id
  join identity.permissions p on p.id = rp.permission_id
  where r.code in ('owner', 'tenant_resident')
    and p.code in ('finance.reports.read', 'finance.periods.read', 'finance.periods.close')
    and rp.effect = 'allow'
), 'owner and tenant_resident have no financial management permissions');

rollback;
