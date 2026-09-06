begin;
select plan(112);

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
  perm_ledger uuid;
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
  select id into perm_ledger from identity.permissions where code = 'finance.ledger.read';

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
    (role_admin, perm_ledger, 'allow'),
    (role_manager, perm_rep, 'allow'),
    (role_manager, perm_prd_read, 'allow'),
    (role_manager, perm_prd_close, 'allow'),
    (role_manager, perm_ledger, 'allow'),
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
    ('23500000-0000-0000-0000-000000000002', '23100000-0000-0000-0000-000000000002', 'condominium', 'Property 049 B', 'active'),
    ('23500000-0000-0000-0000-000000000003', '23100000-0000-0000-0000-000000000001', 'condominium', 'Property 049 C', 'active');

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
    ('23a00000-0000-0000-0000-000000000008', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '7042', 'Venituri valuta', 'income', 'EUR'),
    ('23a00000-0000-0000-0000-000000000009', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000003', '5121', 'Property 3 Bank', 'asset', 'RON'),
    ('23a00000-0000-0000-0000-000000000010', '23100000-0000-0000-0000-000000000002', '23500000-0000-0000-0000-000000000002', '5121', 'Tenant 2 Bank', 'asset', 'RON'),
    ('23a00000-0000-0000-0000-000000000011', '23100000-0000-0000-0000-000000000001', null, '5121', 'Tenant 1 Bank', 'asset', 'RON'),
    ('23a00000-0000-0000-0000-000000000012', '23100000-0000-0000-0000-000000000001', null, '704', 'Tenant 1 Revenue', 'income', 'RON');

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
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000003', '23a00000-0000-0000-0000-000000000008', 'credit', 50, 'EUR Revenue credit');

  -- Post Journal 2 and 3
  update finance.journals
  set status = 'posted', posted_at = statement_timestamp()
  where id in ('23b00000-0000-0000-0000-000000000002', '23b00000-0000-0000-0000-000000000003');

  -- Journal 4: 200 RON Posted in Period 1
  insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status) values
    ('23b00000-0000-0000-0000-000000000004', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2026-01-28', 'RON', 'Original journal to reverse', 'invoice', 'draft');

  insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo) values
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000004', '23a00000-0000-0000-0000-000000000001', 'debit', 200, 'Bank debit'),
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000004', '23a00000-0000-0000-0000-000000000006', 'credit', 200, 'Revenue credit');

  update finance.journals
  set status = 'posted', posted_at = statement_timestamp()
  where id = '23b00000-0000-0000-0000-000000000004';

  -- Journal 5: Reversal compensating journal for Journal 4 (status = 'reversed', reversal_of_id set)
  insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status) values
    ('23b00000-0000-0000-0000-000000000005', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2026-01-29', 'RON', 'Reversal of J4', 'reversal', 'draft');

  insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo) values
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000005', '23a00000-0000-0000-0000-000000000006', 'debit', 200, 'Revenue reversal debit'),
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000005', '23a00000-0000-0000-0000-000000000001', 'credit', 200, 'Bank reversal credit');

  update finance.journals
  set status = 'reversed', reversal_of_id = '23b00000-0000-0000-0000-000000000004', posted_at = statement_timestamp()
  where id = '23b00000-0000-0000-0000-000000000005';

  -- Tenant-wide journal in Tenant 1 (property_id is NULL): 50 RON
  insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status, posted_at) values
    ('23b00000-0000-0000-0000-000000000010', '23100000-0000-0000-0000-000000000001', null, '2026-01-10', 'RON', 'Tenant wide journal', 'invoice', 'posted', statement_timestamp());
  insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo) values
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000010', '23a00000-0000-0000-0000-000000000011', 'debit', 50, 'Tenant debit'),
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000010', '23a00000-0000-0000-0000-000000000012', 'credit', 50, 'Tenant credit');

  -- Cross-Tenant journal in Tenant 2 / Property 2: 100 RON
  insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status, posted_at) values
    ('23b00000-0000-0000-0000-000000000020', '23100000-0000-0000-0000-000000000002', '23500000-0000-0000-0000-000000000002', '2026-01-10', 'RON', 'Tenant 2 journal', 'invoice', 'posted', statement_timestamp());
  insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo) values
    ('23100000-0000-0000-0000-000000000002', '23b00000-0000-0000-0000-000000000020', '23a00000-0000-0000-0000-000000000010', 'debit', 100, 'T2 debit'),
    ('23100000-0000-0000-0000-000000000002', '23b00000-0000-0000-0000-000000000020', '23a00000-0000-0000-0000-000000000010', 'credit', 100, 'T2 credit');

  -- Cross-Property journal in Tenant 1 / Property 3: 70 RON
  insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status, posted_at) values
    ('23b00000-0000-0000-0000-000000000030', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000003', '2026-01-10', 'RON', 'Property 3 journal', 'invoice', 'posted', statement_timestamp());
  insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo) values
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000030', '23a00000-0000-0000-0000-000000000009', 'debit', 70, 'P3 debit'),
    ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000030', '23a00000-0000-0000-0000-000000000009', 'credit', 70, 'P3 credit');

  -- Empty Accounting Period for Empty Close Policy Testing (Period in Nov 2025)
  insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status) values
    ('23c00000-0000-0000-0000-000000000088', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2025-11-01', '2025-11-30', 'open');
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

-- 6b. Closed Period Ledger Seal & Integrity Verifications
-- 1. Inserting journal inside closed period is rejected
select throws_like(
  $$ insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status)
     values ('23b00000-0000-0000-0000-000000000099', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2026-01-10', 'RON', 'Late journal in closed period', 'invoice', 'draft') $$,
  '%Cannot modify journal or entry in closed accounting period%',
  'Inserting journal inside closed accounting period is strictly rejected'
);

-- 2. Updating journal inside closed period is rejected
select throws_like(
  $$ update finance.journals set description = 'Tampered description' where id = '23b00000-0000-0000-0000-000000000002' $$,
  '%Cannot modify journal or entry in closed accounting period%',
  'Updating journal inside closed accounting period is strictly rejected'
);

-- 3. Moving journal date from open into closed period is rejected
insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status)
values ('23b00000-0000-0000-0000-000000000098', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2026-02-15', 'RON', 'Feb journal', 'invoice', 'draft');

select throws_like(
  $$ update finance.journals set occurred_on = '2026-01-20' where id = '23b00000-0000-0000-0000-000000000098' $$,
  '%Cannot modify journal or entry in closed accounting period%',
  'Moving journal date into closed accounting period is strictly rejected'
);

-- 4. Deleting journal inside closed period is rejected
select throws_like(
  $$ delete from finance.journals where id = '23b00000-0000-0000-0000-000000000002' $$,
  '%Cannot modify journal or entry in closed accounting period%',
  'Deleting journal inside closed accounting period is strictly rejected'
);

-- 5. Inserting entry on journal in closed period is rejected
select throws_like(
  $$ insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo)
     values ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000002', '23a00000-0000-0000-0000-000000000001', 'debit', 50, 'Late entry') $$,
  '%Cannot modify journal or entry in closed accounting period%',
  'Inserting entry on journal in closed accounting period is strictly rejected'
);

-- 6. Updating entry on journal in closed period is rejected
select throws_like(
  $$ update finance.journal_entries set amount = 999 where journal_id = '23b00000-0000-0000-0000-000000000002' $$,
  '%Cannot modify journal or entry in closed accounting period%',
  'Updating entry on journal in closed accounting period is strictly rejected'
);

-- 7. Deleting entry on journal in closed period is rejected
select throws_like(
  $$ delete from finance.journal_entries where journal_id = '23b00000-0000-0000-0000-000000000002' $$,
  '%Cannot modify journal or entry in closed accounting period%',
  'Deleting entry on journal in closed accounting period is strictly rejected'
);

-- 8. Overlapping period for same property is rejected by GiST exclusion constraint
select throws_like(
  $$ insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status)
     values ('23c00000-0000-0000-0000-000000000091', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2026-01-15', '2026-02-15', 'open') $$,
  '%accounting_periods_property_no_overlap%',
  'Overlapping period for same property is rejected by GiST exclusion constraint'
);

-- 9. Tenant-wide period overlapping existing property period is rejected
select throws_like(
  $$ insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status)
     values ('23c00000-0000-0000-0000-000000000092', '23100000-0000-0000-0000-000000000001', null, '2026-01-10', '2026-01-20', 'open') $$,
  '%Tenant-wide accounting period cannot overlap%',
  'Tenant-wide period overlapping property period is rejected'
);

-- 10. Concurrent periods across different properties for same tenant succeed
select lives_ok(
  $$ insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status)
     values ('23c00000-0000-0000-0000-000000000093', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000003', '2026-01-01', '2026-01-31', 'open') $$,
  'Concurrent periods across different properties for same tenant succeed'
);

-- 11. Closed period on Property 1 does not seal Property 3
select lives_ok(
  $$ insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status)
     values ('23b00000-0000-0000-0000-000000000097', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000003', '2026-01-15', 'RON', 'Property 3 concurrent journal', 'invoice', 'draft') $$,
  'Closed period on Property 1 does not seal Property 3 journals on same dates'
);

-- 12. Cross-tenant journal entry is strictly rejected
select throws_like(
  $$ insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo)
     values ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000098', '23a00000-0000-0000-0000-000000000010', 'debit', 100, 'Cross tenant attack') $$,
  '%Cross-tenant journal entry denied%',
  'Cross-tenant account in journal entry is strictly rejected'
);

-- 13. Currency mismatch between account and journal is strictly rejected
select throws_like(
  $$ insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo)
     values ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000098', '23a00000-0000-0000-0000-000000000007', 'debit', 100, 'Currency mismatch attack') $$,
  '%Journal currency mismatch%',
  'Currency mismatch between account and journal is strictly rejected'
);

-- 14. Journal with property belonging to another tenant is strictly rejected
select throws_like(
  $$ insert into finance.journals (tenant_id, property_id, occurred_on, currency, description, source_type, status)
     values ('23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000002', '2026-02-15', 'RON', 'Cross-tenant property journal', 'invoice', 'draft') $$,
  '%Cross-tenant property denied%',
  'Journal with property belonging to another tenant is strictly rejected'
);

-- 15. Period 1 snapshot currency summaries are stably sorted ascending (EUR, then RON)
select ok(
  (select (snapshot_json->'currency_summaries'->0->>'currency' = 'EUR') and
          (snapshot_json->'currency_summaries'->1->>'currency' = 'RON')
   from finance.accounting_periods where id = '23c00000-0000-0000-0000-000000000001'),
  'Period 1 snapshot currency summaries are stably sorted: EUR first, then RON'
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
  (select abs((elem->>'net_balance')::numeric) = 500
   from jsonb_array_elements(finance.get_customer_financial_report(
     '23400000-0000-0000-0000-000000000001', 'trial_balance', '2026-01-01', '2026-01-31', 'RON'
   )->'rows') elem
   where elem->>'account_code' = '704'),
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

-- 10. Dedicated RPC finance.list_customer_accounting_periods Exists & Permissions
select ok(to_regprocedure('finance.list_customer_accounting_periods(uuid)') is not null, 'finance.list_customer_accounting_periods RPC exists');
select ok(has_function_privilege('authenticated', 'finance.list_customer_accounting_periods(uuid)', 'EXECUTE'), 'authenticated may execute list_customer_accounting_periods');
select ok(not has_function_privilege('anon', 'finance.list_customer_accounting_periods(uuid)', 'EXECUTE'), 'anon is revoked from executing list_customer_accounting_periods');

-- 11. Scope Isolation & Leak Prevention on Accounting Periods
-- Tenant-scoped admin sees all periods
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select ok(
  jsonb_array_length(finance.list_customer_accounting_periods('23400000-0000-0000-0000-000000000001')->'periods') >= 3,
  'Tenant-scoped context receives all tenant periods in list RPC'
);

-- Property-scoped manager strictly receives ONLY own property periods (zero tenant-wide periods)
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select ok(
  (
    select count(*) = 0
    from jsonb_array_elements(finance.list_customer_accounting_periods('23400000-0000-0000-0000-000000000009')->'periods') p
    where p->>'property_id' is null or p->>'property_id' <> '23500000-0000-0000-0000-000000000001'
  ),
  'Property-scoped context never receives tenant-wide or cross-property periods from list RPC'
);

-- Property-scoped context in legacy get_customer_ledger never receives tenant-wide periods
select ok(
  (
    select count(*) = 0
    from jsonb_array_elements(finance.get_customer_ledger('23400000-0000-0000-0000-000000000009')->'periods') p
    where (select property_id from finance.accounting_periods where id = (p->>'id')::uuid) is null
  ),
  'Property-scoped context in legacy get_customer_ledger never receives tenant-wide periods'
);

-- Resident (unit context) is rejected with 42501 from list_customer_accounting_periods
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000006","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.list_customer_accounting_periods('23400000-0000-0000-0000-000000000006') $$,
  '%financial_reporting_requires_property_or_association_scope%',
  'Resident in unit context is strictly fail-closed from listing accounting periods'
);

-- 12. Period Property-to-Tenant Mandatory Integrity
reset role;
select throws_like(
  $$ insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status)
     values ('23c00000-0000-0000-0000-000000000098', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000002', '2026-06-01', '2026-06-30', 'open') $$,
  '%Accounting period property (%) belongs to tenant %, not period tenant %',
  'Accounting period with property of different tenant is strictly rejected'
);

-- 13. Parent-Update Structural Integrity (Journal & Account)
-- Create a valid test journal and entries for integrity testing
insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, status)
values ('23b00000-0000-0000-0000-000000000050', '23100000-0000-0000-0000-000000000001', '23500000-0000-0000-0000-000000000001', '2026-02-10', 'RON', 'Parent integrity test journal', 'invoice', 'draft');

insert into finance.journal_entries (tenant_id, journal_id, account_id, side, amount, memo) values
  ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000050', '23a00000-0000-0000-0000-000000000001', 'debit', 300, 'Integrity debit'),
  ('23100000-0000-0000-0000-000000000001', '23b00000-0000-0000-0000-000000000050', '23a00000-0000-0000-0000-000000000006', 'credit', 300, 'Integrity credit');

-- 13a. Mutating journal currency when entries exist is rejected
select throws_like(
  $$ update finance.journals set currency = 'EUR' where id = '23b00000-0000-0000-0000-000000000050' $$,
  '%Cannot update journal tenant, property, or currency because existing entries or accounts would become inconsistent%',
  'Updating journal currency when entries exist is strictly rejected'
);

-- 13b. Mutating journal property_id when entries exist is rejected
select throws_like(
  $$ update finance.journals set property_id = null where id = '23b00000-0000-0000-0000-000000000050' $$,
  '%Cannot update journal tenant, property, or currency because existing entries or accounts would become inconsistent%',
  'Updating journal property_id when entries exist is strictly rejected'
);

-- 13c. Mutating journal tenant_id when entries exist is rejected
select throws_like(
  $$ update finance.journals set tenant_id = '23100000-0000-0000-0000-000000000002' where id = '23b00000-0000-0000-0000-000000000050' $$,
  '%Cannot update journal tenant, property, or currency because existing entries or accounts would become inconsistent%',
  'Updating journal tenant_id when entries exist is strictly rejected'
);

-- 13d. Mutating account currency when entries exist is rejected
select throws_like(
  $$ update finance.accounts set currency = 'EUR' where id = '23a00000-0000-0000-0000-000000000001' $$,
  '%Cannot update account tenant, property, or currency because existing journal entries would become inconsistent%',
  'Updating account currency when entries exist is strictly rejected'
);

-- 13e. Mutating account property_id when entries exist is rejected
select throws_like(
  $$ update finance.accounts set property_id = '23500000-0000-0000-0000-000000000002' where id = '23a00000-0000-0000-0000-000000000001' $$,
  '%Cannot update account tenant, property, or currency because existing journal entries would become inconsistent%',
  'Updating account property_id when entries exist is strictly rejected'
);

-- 13f. Mutating account tenant_id when entries exist is rejected
select throws_like(
  $$ update finance.accounts set tenant_id = '23100000-0000-0000-0000-000000000002' where id = '23a00000-0000-0000-0000-000000000001' $$,
  '%Cannot update account tenant, property, or currency because existing journal entries would become inconsistent%',
  'Updating account tenant_id when entries exist is strictly rejected'
);

-- 14. Authoritative Reason Redaction
select ok(
  app_private.redact_audit_text('Clean monthly close reason') = 'Clean monthly close reason',
  'Clean audit reason is preserved intact'
);
select ok(
  app_private.redact_audit_text('Close with secret password123 and token') = '[REDACTED]',
  'Audit reason containing password and token is redacted'
);
select ok(
  app_private.redact_audit_text('Authorization Bearer eyJhbGciOiJIUzI1NiJ9.test') = '[REDACTED]',
  'Audit reason containing Bearer authorization token is redacted'
);
select ok(
  app_private.redact_audit_text('Cookie session=abc&service-role=xyz') = '[REDACTED]',
  'Audit reason containing cookie and service-role is redacted'
);

-- 15. Atomic Audit Event Rollback Verification
-- Clean up temporary test journal 23b...98 created for date moving verification
delete from finance.journals where id = '23b00000-0000-0000-0000-000000000098';

-- Post the draft journal 23b...50 so period 2 is balanced and ready
update finance.journals
set status = 'posted', posted_at = statement_timestamp()
where id = '23b00000-0000-0000-0000-000000000050';

-- Set up a controlled temporary failing trigger on audit.events for Period 2
create or replace function test_fail_audit_trigger_fn()
returns trigger language plpgsql as $$
begin
  if new.entity_id = '23c00000-0000-0000-0000-000000000002'::uuid then
    raise exception 'simulated_audit_failure';
  end if;
  return new;
end;
$$;

create trigger trg_test_fail_audit
before insert on audit.events
for each row
execute function test_fail_audit_trigger_fn();

-- Attempt to close Period 2 with admin claims: must fail due to audit trigger
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.close_accounting_period('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000002', 'Audit failure test') $$,
  '%simulated_audit_failure%',
  'Audit event insertion failure causes close_accounting_period to fail'
);

-- Reset role and assert complete rollback:
reset role;
select ok(
  (select status = 'open' from finance.accounting_periods where id = '23c00000-0000-0000-0000-000000000002'),
  'Period 2 status remains open after atomic rollback'
);
select ok(
  (select closed_at is null and closed_by is null and snapshot_json is null
   from finance.accounting_periods where id = '23c00000-0000-0000-0000-000000000002'),
  'Period 2 closed_at, closed_by, and snapshot_json remain null after atomic rollback'
);
select ok(
  (select count(*) = 0 from audit.events where entity_id = '23c00000-0000-0000-0000-000000000002'::uuid),
  'No incomplete audit event exists for Period 2 after atomic rollback'
);

-- Clean up temporary test trigger
drop trigger trg_test_fail_audit on audit.events;
drop function test_fail_audit_trigger_fn();

-- 16. Authoritative Ledger Detail Scope & Zero-Disclosure Verification
-- 16a. Tenant 1 Admin attempting to read Tenant 2 journal detail is rejected with P0002
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.get_customer_ledger('23400000-0000-0000-0000-000000000001', null, null, null, null, null, 25, 0, '23b00000-0000-0000-0000-000000000020') $$,
  '%ledger_journal_not_found%',
  'Tenant 1 context reading Tenant 2 journal detail throws P0002 ledger_journal_not_found'
);

-- 16b. Property 1 Manager attempting to read Property 3 journal detail is rejected with P0002
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.get_customer_ledger('23400000-0000-0000-0000-000000000009', null, null, null, null, null, 25, 0, '23b00000-0000-0000-0000-000000000030') $$,
  '%ledger_journal_not_found%',
  'Property 1 context reading Property 3 journal detail throws P0002 ledger_journal_not_found'
);

-- 16c. Property 1 Manager attempting to read Tenant-wide journal detail (property_id is NULL) is rejected with P0002
select throws_like(
  $$ select finance.get_customer_ledger('23400000-0000-0000-0000-000000000009', null, null, null, null, null, 25, 0, '23b00000-0000-0000-0000-000000000010') $$,
  '%ledger_journal_not_found%',
  'Property 1 context reading tenant-wide journal detail throws P0002 ledger_journal_not_found'
);

-- 16d. Property 1 Manager reading authorized Property 1 journal detail succeeds and returns entries
select ok(
  jsonb_array_length(finance.get_customer_ledger('23400000-0000-0000-0000-000000000009', null, null, null, null, null, 25, 0, '23b00000-0000-0000-0000-000000000001')->'detail') = 2,
  'Property 1 context reading authorized Property 1 journal detail returns exact 2 entries'
);

-- 16e. Non-existent random journal UUID throws identical P0002 ledger_journal_not_found
select throws_like(
  $$ select finance.get_customer_ledger('23400000-0000-0000-0000-000000000009', null, null, null, null, null, 25, 0, '23b00000-0000-0000-0000-000000000099') $$,
  '%ledger_journal_not_found%',
  'Non-existent journal UUID throws identical P0002 ledger_journal_not_found'
);

-- 16f. Resident in unit context attempting to read non-resident journal detail is rejected with P0002
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000006","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$ select finance.get_customer_ledger('23400000-0000-0000-0000-000000000006', null, null, null, null, null, 25, 0, '23b00000-0000-0000-0000-000000000001') $$,
  '%ledger_journal_not_found%',
  'Resident attempting to read non-resident journal detail throws P0002 ledger_journal_not_found'
);

-- 17. Empty Accounting Period Close & Snapshot V2 Verification
-- 17a. Readiness check for empty period in past returns can_close = true
select set_config('request.jwt.claims', '{"sub":"23000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select ok(
  (finance.get_close_readiness('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000088')->>'can_close')::boolean = true,
  'Empty eligible accounting period has can_close = true'
);

-- 17b. Readiness check for empty period returns empty currency_summaries array
select ok(
  jsonb_array_length(finance.get_close_readiness('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000088')->'currency_summaries') = 0,
  'Empty eligible accounting period has empty currency_summaries array in readiness'
);

-- 17c. Closing empty accounting period succeeds
select ok(
  (finance.close_accounting_period('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000088', 'Close empty period')->>'success')::boolean = true,
  'Closing empty accounting period succeeds with success: true'
);

-- 17d. Closed empty period snapshot has empty currency_summaries array
select ok(
  jsonb_array_length((select snapshot_json->'currency_summaries' from finance.accounting_periods where id = '23c00000-0000-0000-0000-000000000088')) = 0,
  'Closed empty period snapshot has empty currency_summaries array'
);

-- 17e. Closed empty period snapshot is_balanced is true
select ok(
  (select (snapshot_json->>'is_balanced')::boolean from finance.accounting_periods where id = '23c00000-0000-0000-0000-000000000088') = true,
  'Closed empty period snapshot is_balanced is true'
);

-- 17f. Re-closing empty period fails with period_already_closed
select throws_like(
  $$ select finance.close_accounting_period('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000088') $$,
  '%period_already_closed%',
  'Re-closing already closed empty period fails with conflict'
);

-- 17g. Readiness after closing empty period returns valid closed status
select ok(
  (finance.get_close_readiness('23400000-0000-0000-0000-000000000001', '23c00000-0000-0000-0000-000000000088')->>'status') = 'closed',
  'Readiness check on closed empty period returns status closed'
);

-- 18. Atomic Serialization on Period Close & Snapshot Integrity
select ok(
  (select count(*) = 1 from finance.accounting_periods where id = '23c00000-0000-0000-0000-000000000001' and status = 'closed'),
  'Period 1 has exactly one authoritative closed state with single snapshot'
);

select ok(
  (select count(*) = 1 from audit.events
   where action = 'ACCOUNTING_PERIOD_CLOSED'
     and entity_type = 'accounting_period'
     and entity_id = '23c00000-0000-0000-0000-000000000001'::uuid),
  'Exactly one audit event exists for closed Period 1'
);

rollback;
