begin;
set local search_path = customer_api, public, extensions;

-- Total assertions: 1 (schema) + 2 (schema privs) + 20 (function existence) + 20 (security invoker) + 20 (anon revoked) + 20 (authenticated granted) + 20 (search_path hardened) = 103
select plan(103);

-- 1. Schema existence
select has_schema('customer_api', 'customer_api schema exists');

-- 2. Schema permissions
select ok(
  not has_schema_privilege('anon', 'customer_api', 'USAGE'),
  'anon does not have USAGE on customer_api schema'
);

select ok(
  has_schema_privilege('authenticated', 'customer_api', 'USAGE'),
  'authenticated has USAGE on customer_api schema'
);

-- ----------------------------------------------------------------------------
-- 3. Function Existence (20 functions)
-- ----------------------------------------------------------------------------
select has_function('customer_api', 'get_dashboard_v1', array['uuid'], 'get_dashboard_v1 exists');
select has_function('customer_api', 'list_contexts_v1', array[]::text[], 'list_contexts_v1 exists');
select has_function('customer_api', 'my_mfa_requirement_v1', array[]::text[], 'my_mfa_requirement_v1 exists');
select has_function('customer_api', 'get_ledger_v1', array['uuid', 'text', 'text', 'text', 'date', 'date', 'integer', 'integer', 'uuid'], 'get_ledger_v1 exists');
select has_function('customer_api', 'list_accounting_periods_v1', array['uuid'], 'list_accounting_periods_v1 exists');
select has_function('customer_api', 'get_close_readiness_v1', array['uuid', 'uuid'], 'get_close_readiness_v1 exists');
select has_function('customer_api', 'close_accounting_period_v1', array['uuid', 'uuid', 'text'], 'close_accounting_period_v1 exists');
select has_function('customer_api', 'get_financial_report_v1', array['uuid', 'text', 'date', 'date', 'text'], 'get_financial_report_v1 exists');
select has_function('customer_api', 'get_allocations_v1', array['uuid', 'text', 'text', 'text', 'text', 'date', 'date', 'integer', 'integer', 'uuid'], 'get_allocations_v1 exists');
select has_function('customer_api', 'get_audit_events_v1', array['uuid', 'integer', 'integer', 'text', 'text', 'timestamp with time zone', 'timestamp with time zone'], 'get_audit_events_v1 exists');
select has_function('customer_api', 'get_billing_v1', array['uuid', 'text', 'text', 'date', 'date', 'integer', 'integer', 'uuid'], 'get_billing_v1 exists');
select has_function('customer_api', 'get_payments_v1', array['uuid', 'text', 'text', 'text', 'date', 'date', 'integer', 'integer', 'uuid'], 'get_payments_v1 exists');
select has_function('customer_api', 'get_utilities_v1', array['uuid', 'text', 'text', 'text', 'text', 'date', 'date', 'integer', 'integer', 'uuid'], 'get_utilities_v1 exists');
select has_function('customer_api', 'get_maintenance_v1', array['uuid', 'text', 'text', 'text', 'text', 'date', 'date', 'integer', 'integer', 'uuid'], 'get_maintenance_v1 exists');
select has_function('customer_api', 'get_procurement_v1', array['uuid', 'text', 'text', 'text', 'text', 'date', 'date', 'integer', 'integer', 'uuid'], 'get_procurement_v1 exists');
select has_function('customer_api', 'get_governance_v1', array['uuid', 'text', 'text', 'text', 'date', 'date', 'integer', 'integer', 'uuid'], 'get_governance_v1 exists');
select has_function('customer_api', 'get_communications_v1', array['uuid', 'text', 'text', 'text', 'date', 'date', 'integer', 'integer', 'uuid'], 'get_communications_v1 exists');
select has_function('customer_api', 'get_documents_v1', array['uuid', 'text', 'text', 'text', 'text', 'date', 'date', 'integer', 'integer', 'uuid'], 'get_documents_v1 exists');
select has_function('customer_api', 'get_occupancy_registry_v1', array['uuid', 'text', 'text', 'text', 'text', 'date', 'date', 'integer', 'integer', 'uuid'], 'get_occupancy_registry_v1 exists');
select has_function('customer_api', 'get_security_access_v1', array['uuid', 'text', 'text', 'text', 'text', 'timestamp with time zone', 'timestamp with time zone', 'integer', 'integer', 'uuid'], 'get_security_access_v1 exists');

-- ----------------------------------------------------------------------------
-- 4. SECURITY INVOKER Enforcement (20 functions)
-- ----------------------------------------------------------------------------
select ok(
  not prosecdef,
  'customer_api.get_dashboard_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_dashboard_v1';

select ok(
  not prosecdef,
  'customer_api.list_contexts_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'list_contexts_v1';

select ok(
  not prosecdef,
  'customer_api.my_mfa_requirement_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'my_mfa_requirement_v1';

select ok(
  not prosecdef,
  'customer_api.get_ledger_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_ledger_v1';

select ok(
  not prosecdef,
  'customer_api.list_accounting_periods_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'list_accounting_periods_v1';

select ok(
  not prosecdef,
  'customer_api.get_close_readiness_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_close_readiness_v1';

select ok(
  not prosecdef,
  'customer_api.close_accounting_period_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'close_accounting_period_v1';

select ok(
  not prosecdef,
  'customer_api.get_financial_report_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_financial_report_v1';

select ok(
  not prosecdef,
  'customer_api.get_allocations_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_allocations_v1';

select ok(
  not prosecdef,
  'customer_api.get_audit_events_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_audit_events_v1';

select ok(
  not prosecdef,
  'customer_api.get_billing_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_billing_v1';

select ok(
  not prosecdef,
  'customer_api.get_payments_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_payments_v1';

select ok(
  not prosecdef,
  'customer_api.get_utilities_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_utilities_v1';

select ok(
  not prosecdef,
  'customer_api.get_maintenance_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_maintenance_v1';

select ok(
  not prosecdef,
  'customer_api.get_procurement_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_procurement_v1';

select ok(
  not prosecdef,
  'customer_api.get_governance_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_governance_v1';

select ok(
  not prosecdef,
  'customer_api.get_communications_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_communications_v1';

select ok(
  not prosecdef,
  'customer_api.get_documents_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_documents_v1';

select ok(
  not prosecdef,
  'customer_api.get_occupancy_registry_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_occupancy_registry_v1';

select ok(
  not prosecdef,
  'customer_api.get_security_access_v1 is SECURITY INVOKER'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_security_access_v1';

-- ----------------------------------------------------------------------------
-- 5. Revocation from Anon (20 functions)
-- ----------------------------------------------------------------------------
select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_dashboard_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_dashboard_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.list_contexts_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'list_contexts_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.my_mfa_requirement_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'my_mfa_requirement_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_ledger_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_ledger_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.list_accounting_periods_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'list_accounting_periods_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_close_readiness_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_close_readiness_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.close_accounting_period_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'close_accounting_period_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_financial_report_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_financial_report_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_allocations_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_allocations_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_audit_events_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_audit_events_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_billing_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_billing_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_payments_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_payments_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_utilities_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_utilities_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_maintenance_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_maintenance_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_procurement_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_procurement_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_governance_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_governance_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_communications_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_communications_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_documents_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_documents_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_occupancy_registry_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_occupancy_registry_v1';

select ok(
  not has_function_privilege('anon', p.oid, 'EXECUTE'),
  'anon cannot execute customer_api.get_security_access_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_security_access_v1';

-- ----------------------------------------------------------------------------
-- 6. Grant to Authenticated (20 functions)
-- ----------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_dashboard_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_dashboard_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.list_contexts_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'list_contexts_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.my_mfa_requirement_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'my_mfa_requirement_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_ledger_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_ledger_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.list_accounting_periods_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'list_accounting_periods_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_close_readiness_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_close_readiness_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.close_accounting_period_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'close_accounting_period_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_financial_report_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_financial_report_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_allocations_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_allocations_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_audit_events_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_audit_events_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_billing_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_billing_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_payments_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_payments_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_utilities_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_utilities_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_maintenance_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_maintenance_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_procurement_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_procurement_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_governance_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_governance_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_communications_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_communications_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_documents_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_documents_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_occupancy_registry_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_occupancy_registry_v1';

select ok(
  has_function_privilege('authenticated', p.oid, 'EXECUTE'),
  'authenticated can execute customer_api.get_security_access_v1'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_security_access_v1';

-- ----------------------------------------------------------------------------
-- 7. Hardened search_path (pg_catalog) (20 functions)
-- ----------------------------------------------------------------------------
select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_dashboard_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_dashboard_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.list_contexts_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'list_contexts_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.my_mfa_requirement_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'my_mfa_requirement_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_ledger_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_ledger_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.list_accounting_periods_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'list_accounting_periods_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_close_readiness_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_close_readiness_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.close_accounting_period_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'close_accounting_period_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_financial_report_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_financial_report_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_allocations_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_allocations_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_audit_events_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_audit_events_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_billing_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_billing_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_payments_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_payments_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_utilities_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_utilities_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_maintenance_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_maintenance_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_procurement_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_procurement_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_governance_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_governance_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_communications_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_communications_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_documents_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_documents_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_occupancy_registry_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_occupancy_registry_v1';

select ok(
  'search_path=pg_catalog' = any(p.proconfig),
  'customer_api.get_security_access_v1 search_path begins with pg_catalog'
) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_security_access_v1';

select * from finish();
rollback;
