-- R10 Phase 1A: Romanian statutory simple-entry foundation
begin;
select plan(36);

-- Structural contract
select has_table('finance', 'statutory_accounting_regimes', 'statutory regimes table exists');
select has_table('finance', 'statutory_monthly_cycles', 'statutory monthly cycles table exists');
select has_table('finance', 'statutory_simple_entries', 'statutory simple entries table exists');
select has_table('finance', 'statutory_cycle_transitions', 'statutory cycle transitions table exists');
select has_function(
  'app_private', 'activate_statutory_accounting_regime_v1',
  array['uuid', 'integer', 'uuid', 'text'],
  'controlled statutory activation function exists'
);

select ok((select relrowsecurity from pg_class where oid = 'finance.statutory_accounting_regimes'::regclass), 'regimes RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'finance.statutory_monthly_cycles'::regclass), 'cycles RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'finance.statutory_simple_entries'::regclass), 'entries RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'finance.statutory_cycle_transitions'::regclass), 'transitions RLS enabled');

select ok(exists(select 1 from pg_roles where rolname = 'cladora_rpc_owner'), 'dedicated RPC owner exists');
select ok(not (select rolcanlogin from pg_roles where rolname = 'cladora_rpc_owner'), 'RPC owner cannot login');
select ok(not (select rolbypassrls from pg_roles where rolname = 'cladora_rpc_owner'), 'RPC owner cannot bypass RLS');
select ok(
  not has_table_privilege('anon', 'finance.statutory_accounting_regimes', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_accounting_regimes', 'SELECT,INSERT,UPDATE,DELETE'),
  'regimes expose no direct anon or authenticated DML'
);
select ok(
  not has_table_privilege('anon', 'finance.statutory_monthly_cycles', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_monthly_cycles', 'SELECT,INSERT,UPDATE,DELETE'),
  'cycles expose no direct anon or authenticated DML'
);
select ok(
  not has_table_privilege('anon', 'finance.statutory_simple_entries', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_simple_entries', 'SELECT,INSERT,UPDATE,DELETE'),
  'entries expose no direct anon or authenticated DML'
);
select ok(
  not has_table_privilege('anon', 'finance.statutory_cycle_transitions', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_cycle_transitions', 'SELECT,INSERT,UPDATE,DELETE'),
  'transitions expose no direct anon or authenticated DML'
);
select ok(
  not has_function_privilege('anon', 'app_private.activate_statutory_accounting_regime_v1(uuid,integer,uuid,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app_private.activate_statutory_accounting_regime_v1(uuid,integer,uuid,text)', 'EXECUTE'),
  'activation is not callable by anon or authenticated'
);
select ok(
  has_function_privilege('service_role', 'app_private.activate_statutory_accounting_regime_v1(uuid,integer,uuid,text)', 'EXECUTE'),
  'activation is callable by service_role'
);

-- Isolated fixtures
insert into auth.users (id, email) values
  ('09200000-0000-0000-0000-000000000001', 'r10-phase1a@test.local')
on conflict (id) do nothing;

insert into platform.tenants (id, legal_name, registration_number, status) values
  ('09200000-0000-0000-0000-000000000010', 'R10 Statutory Tenant A', 'RO-R10-092-A', 'active'),
  ('09200000-0000-0000-0000-000000000020', 'R10 Statutory Tenant B', 'RO-R10-092-B', 'active')
on conflict (id) do nothing;

insert into platform.customer_workspaces (
  id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment
) values (
  '09200000-0000-0000-0000-000000000100',
  '09200000-0000-0000-0000-000000000010',
  'ASSOCIATION', 'ACTIVE', 'R10 Test', 'PILOT'
);

insert into portfolio.properties (id, tenant_id, type, name, status) values
  ('09200000-0000-0000-0000-000000001000', '09200000-0000-0000-0000-000000000010', 'condominium', 'R10 Property A', 'active'),
  ('09200000-0000-0000-0000-000000002000', '09200000-0000-0000-0000-000000000020', 'condominium', 'R10 Property B', 'active');

insert into finance.statutory_accounting_regimes (
  id, tenant_id, customer_workspace_id, property_id, status,
  accounting_signoff_reference, accounting_signed_at
) values (
  '09200000-0000-0000-0000-000000010000',
  '09200000-0000-0000-0000-000000000010',
  '09200000-0000-0000-0000-000000000100',
  '09200000-0000-0000-0000-000000001000',
  'validated', 'CECCAR-R10-TEST', statement_timestamp()
);

select ok(
  (select statutory_operations_enabled is false
     from finance.statutory_accounting_regimes
    where id = '09200000-0000-0000-0000-000000010000'),
  'statutory operations are fail-closed by default'
);
select ok(
  (select statutory_basis @> '{"accounting_method":"partida_simpla"}'::jsonb
     from finance.statutory_accounting_regimes
    where id = '09200000-0000-0000-0000-000000010000'),
  'statutory basis records simple-entry accounting'
);

select throws_ok(
  $$insert into finance.statutory_accounting_regimes (
      tenant_id, customer_workspace_id, property_id
    ) values (
      '09200000-0000-0000-0000-000000000010',
      '09200000-0000-0000-0000-000000000100',
      '09200000-0000-0000-0000-000000002000'
    )$$,
  '23514', 'statutory_regime_scope_mismatch',
  'cross-tenant regime scope is rejected'
);

select throws_ok(
  $$select app_private.activate_statutory_accounting_regime_v1(
      '09200000-0000-0000-0000-000000010000', 1,
      '09200000-0000-0000-0000-000000000001', 'test activation'
    )$$,
  '42501', 'statutory_legal_signoff_required',
  'activation fails closed without legal sign-off'
);

update finance.statutory_accounting_regimes
set legal_signoff_reference = 'LEGAL-R10-TEST', legal_signed_at = statement_timestamp()
where id = '09200000-0000-0000-0000-000000010000';

select lives_ok(
  $$select app_private.activate_statutory_accounting_regime_v1(
      '09200000-0000-0000-0000-000000010000', 1,
      '09200000-0000-0000-0000-000000000001', 'approved test activation'
    )$$,
  'dual-signoff activation succeeds'
);
select ok(
  (select status = 'active' and statutory_operations_enabled and activated_at is not null
     from finance.statutory_accounting_regimes
    where id = '09200000-0000-0000-0000-000000010000'),
  'activation atomically enables the active regime'
);
select ok(
  (select lock_version = 2 from finance.statutory_accounting_regimes
    where id = '09200000-0000-0000-0000-000000010000'),
  'activation advances optimistic lock version'
);
select ok(
  exists(select 1 from audit.events
    where entity_id = '09200000-0000-0000-0000-000000010000'
      and action = 'statutory.accounting.regime.activated'),
  'activation writes an atomic audit event'
);
select throws_ok(
  $$select app_private.activate_statutory_accounting_regime_v1(
      '09200000-0000-0000-0000-000000010000', 1,
      '09200000-0000-0000-0000-000000000001', 'stale replay'
    )$$,
  '40001', 'statutory_regime_lock_version_conflict',
  'stale activation replay is rejected'
);

insert into finance.accounting_periods (
  id, tenant_id, property_id, starts_on, ends_on
) values (
  '09200000-0000-0000-0000-000000020000',
  '09200000-0000-0000-0000-000000000010',
  '09200000-0000-0000-0000-000000001000',
  date '2026-09-01', date '2026-09-30'
);

select lives_ok(
  $$insert into finance.statutory_monthly_cycles (
      id, regime_id, tenant_id, property_id, accounting_period_id,
      status, opening_balance, total_receipts, total_payments
    ) values (
      '09200000-0000-0000-0000-000000030000',
      '09200000-0000-0000-0000-000000010000',
      '09200000-0000-0000-0000-000000000010',
      '09200000-0000-0000-0000-000000001000',
      '09200000-0000-0000-0000-000000020000',
      'collecting', 100.00, 50.00, 20.00
    )$$,
  'enabled regime permits creation of a statutory monthly cycle'
);
select ok(
  (select closing_balance = 130.00 from finance.statutory_monthly_cycles
    where id = '09200000-0000-0000-0000-000000030000'),
  'closing balance is generated deterministically'
);

select lives_ok(
  $$insert into finance.statutory_simple_entries (
      id, cycle_id, tenant_id, property_id, entry_date, direction,
      payment_medium, document_type, document_number, amount,
      description, created_by
    ) values (
      '09200000-0000-0000-0000-000000040000',
      '09200000-0000-0000-0000-000000030000',
      '09200000-0000-0000-0000-000000000010',
      '09200000-0000-0000-0000-000000001000',
      date '2026-09-10', 'receipt', 'bank', 'EXTRAS_CONT', 'EC-001',
      50.00, 'Owner contribution receipt',
      '09200000-0000-0000-0000-000000000001'
    )$$,
  'positive RON receipt is recorded in the open cycle'
);
select throws_ok(
  $$update finance.statutory_simple_entries set amount = 51.00
    where id = '09200000-0000-0000-0000-000000040000'$$,
  '55000', 'statutory_record_is_append_only',
  'statutory entries cannot be updated'
);
select throws_ok(
  $$delete from finance.statutory_simple_entries
    where id = '09200000-0000-0000-0000-000000040000'$$,
  '55000', 'statutory_record_is_append_only',
  'statutory entries cannot be deleted'
);
select throws_ok(
  $$insert into finance.statutory_simple_entries (
      cycle_id, tenant_id, property_id, entry_date, direction,
      payment_medium, document_type, document_number, amount,
      description, created_by
    ) values (
      '09200000-0000-0000-0000-000000030000',
      '09200000-0000-0000-0000-000000000010',
      '09200000-0000-0000-0000-000000001000',
      date '2026-09-10', 'receipt', 'bank', 'EXTRAS_CONT', 'EC-001',
      50.00, 'Duplicate receipt',
      '09200000-0000-0000-0000-000000000001'
    )$$,
  '23505', null,
  'duplicate statutory source document is rejected'
);
select throws_ok(
  $$insert into finance.statutory_simple_entries (
      cycle_id, tenant_id, property_id, entry_date, direction,
      payment_medium, document_type, document_number, amount,
      description, created_by
    ) values (
      '09200000-0000-0000-0000-000000030000',
      '09200000-0000-0000-0000-000000000020',
      '09200000-0000-0000-0000-000000002000',
      date '2026-09-11', 'payment', 'cash', 'CHITANTA', 'CH-002',
      10.00, 'Cross-tenant attempt',
      '09200000-0000-0000-0000-000000000001'
    )$$,
  '23514', 'statutory_entry_scope_mismatch',
  'cross-tenant statutory entry is rejected'
);

update finance.statutory_monthly_cycles
set status = 'closed', closed_at = statement_timestamp()
where id = '09200000-0000-0000-0000-000000030000';

select throws_ok(
  $$insert into finance.statutory_simple_entries (
      cycle_id, tenant_id, property_id, entry_date, direction,
      payment_medium, document_type, document_number, amount,
      description, created_by
    ) values (
      '09200000-0000-0000-0000-000000030000',
      '09200000-0000-0000-0000-000000000010',
      '09200000-0000-0000-0000-000000001000',
      date '2026-09-12', 'payment', 'bank', 'ORDIN_PLATA', 'OP-003',
      5.00, 'Late entry attempt',
      '09200000-0000-0000-0000-000000000001'
    )$$,
  '55000', 'statutory_cycle_not_open_for_entries',
  'closed statutory cycle rejects new entries'
);

select ok(
  (select supplemental_double_entry_enabled is false
     from finance.statutory_accounting_regimes
    where id = '09200000-0000-0000-0000-000000010000'),
  'supplemental double-entry remains optional and disabled independently'
);

rollback;
