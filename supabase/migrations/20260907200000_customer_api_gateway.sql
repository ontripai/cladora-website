begin;

-- ============================================================================
-- Migration: 20260907200000_customer_api_gateway.sql
-- Module: Customer API Gateway (Protected Customer Portal RPC Wrappers)
-- Purpose: Create dedicated customer_api schema with secure, versioned,
--          SECURITY INVOKER wrapper functions for Customer Portal consumers,
--          eliminating the need to expose internal domain schemas in PostgREST.
-- ============================================================================

-- 1. Create dedicated customer_api schema
create schema if not exists customer_api;

-- Revoke all permissions on customer_api from public and anon
revoke all on schema customer_api from public, anon;
revoke create on schema customer_api from public, anon, authenticated;

-- Grant USAGE strictly to authenticated and service_role
grant usage on schema customer_api to authenticated, service_role;

comment on schema customer_api is
  'Dedicated, restricted PostgREST-exposed gateway schema for Customer Portal. Contains only versioned SECURITY INVOKER thin wrappers delegating to protected domain schemas.';


-- ----------------------------------------------------------------------------
-- 1. Dashboard Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_dashboard_v1(p_context_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return platform.get_customer_dashboard(p_context_id);
end;
$$;

revoke all on function customer_api.get_dashboard_v1(uuid) from public;
revoke all on function customer_api.get_dashboard_v1(uuid) from anon;
grant execute on function customer_api.get_dashboard_v1(uuid) to authenticated;
grant execute on function customer_api.get_dashboard_v1(uuid) to service_role;

comment on function customer_api.get_dashboard_v1(uuid) is
  'Customer API Gateway v1: Retrieves role-aware customer dashboard payload. Delegates to platform.get_customer_dashboard.';


-- ----------------------------------------------------------------------------
-- 2. Contexts List Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.list_contexts_v1()
returns table(
  context_id uuid,
  membership_id uuid,
  tenant_id uuid,
  tenant_name text,
  role_code text,
  role_name text,
  scope_type text,
  property_id uuid,
  building_id uuid,
  unit_id uuid,
  context_label text,
  starts_at timestamp with time zone,
  ends_at timestamp with time zone
)
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return query select * from platform.list_my_customer_contexts();
end;
$$;

revoke all on function customer_api.list_contexts_v1() from public;
revoke all on function customer_api.list_contexts_v1() from anon;
grant execute on function customer_api.list_contexts_v1() to authenticated;
grant execute on function customer_api.list_contexts_v1() to service_role;

comment on function customer_api.list_contexts_v1() is
  'Customer API Gateway v1: Lists all active customer context grants for authenticated user. Delegates to platform.list_my_customer_contexts.';


-- ----------------------------------------------------------------------------
-- 3. MFA Requirement Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.my_mfa_requirement_v1()
returns boolean
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return platform.my_customer_mfa_requirement();
end;
$$;

revoke all on function customer_api.my_mfa_requirement_v1() from public;
revoke all on function customer_api.my_mfa_requirement_v1() from anon;
grant execute on function customer_api.my_mfa_requirement_v1() to authenticated;
grant execute on function customer_api.my_mfa_requirement_v1() to service_role;

comment on function customer_api.my_mfa_requirement_v1() is
  'Customer API Gateway v1: Checks whether authenticated user has mandatory customer MFA policy. Delegates to platform.my_customer_mfa_requirement.';


-- ----------------------------------------------------------------------------
-- 4. Accounting Ledger Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_ledger_v1(
  p_context_id uuid,
  p_query text default null::text,
  p_status text default null::text,
  p_account_type text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_journal_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return finance.get_customer_ledger(
    p_context_id,
    p_query,
    p_status,
    p_account_type,
    p_from,
    p_to,
    p_limit,
    p_offset,
    p_journal_id
  );
end;
$$;

revoke all on function customer_api.get_ledger_v1(uuid, text, text, text, date, date, integer, integer, uuid) from public;
revoke all on function customer_api.get_ledger_v1(uuid, text, text, text, date, date, integer, integer, uuid) from anon;
grant execute on function customer_api.get_ledger_v1(uuid, text, text, text, date, date, integer, integer, uuid) to authenticated;
grant execute on function customer_api.get_ledger_v1(uuid, text, text, text, date, date, integer, integer, uuid) to service_role;

comment on function customer_api.get_ledger_v1(uuid, text, text, text, date, date, integer, integer, uuid) is
  'Customer API Gateway v1: Retrieves accounting journals and entries. Delegates to finance.get_customer_ledger.';


-- ----------------------------------------------------------------------------
-- 5. List Accounting Periods Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.list_accounting_periods_v1(p_context_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return finance.list_customer_accounting_periods(p_context_id);
end;
$$;

revoke all on function customer_api.list_accounting_periods_v1(uuid) from public;
revoke all on function customer_api.list_accounting_periods_v1(uuid) from anon;
grant execute on function customer_api.list_accounting_periods_v1(uuid) to authenticated;
grant execute on function customer_api.list_accounting_periods_v1(uuid) to service_role;

comment on function customer_api.list_accounting_periods_v1(uuid) is
  'Customer API Gateway v1: Lists accounting periods for customer context. Delegates to finance.list_customer_accounting_periods.';


-- ----------------------------------------------------------------------------
-- 6. Close Readiness Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_close_readiness_v1(
  p_context_id uuid,
  p_period_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return finance.get_close_readiness(p_context_id, p_period_id);
end;
$$;

revoke all on function customer_api.get_close_readiness_v1(uuid, uuid) from public;
revoke all on function customer_api.get_close_readiness_v1(uuid, uuid) from anon;
grant execute on function customer_api.get_close_readiness_v1(uuid, uuid) to authenticated;
grant execute on function customer_api.get_close_readiness_v1(uuid, uuid) to service_role;

comment on function customer_api.get_close_readiness_v1(uuid, uuid) is
  'Customer API Gateway v1: Checks accounting period month-close readiness. Delegates to finance.get_close_readiness.';


-- ----------------------------------------------------------------------------
-- 7. Close Accounting Period Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.close_accounting_period_v1(
  p_context_id uuid,
  p_period_id uuid,
  p_reason text default null::text
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_reason is null then
    return finance.close_accounting_period(p_context_id, p_period_id);
  else
    return finance.close_accounting_period(p_context_id, p_period_id, p_reason);
  end if;
end;
$$;

revoke all on function customer_api.close_accounting_period_v1(uuid, uuid, text) from public;
revoke all on function customer_api.close_accounting_period_v1(uuid, uuid, text) from anon;
grant execute on function customer_api.close_accounting_period_v1(uuid, uuid, text) to authenticated;
grant execute on function customer_api.close_accounting_period_v1(uuid, uuid, text) to service_role;

comment on function customer_api.close_accounting_period_v1(uuid, uuid, text) is
  'Customer API Gateway v1: Authoritatively closes accounting period with optional reason. Delegates to finance.close_accounting_period.';


-- ----------------------------------------------------------------------------
-- 8. Financial Report Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_financial_report_v1(
  p_context_id uuid,
  p_report_type text,
  p_from date,
  p_to date,
  p_currency text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return finance.get_customer_financial_report(
    p_context_id,
    p_report_type,
    p_from,
    p_to,
    p_currency
  );
end;
$$;

revoke all on function customer_api.get_financial_report_v1(uuid, text, date, date, text) from public;
revoke all on function customer_api.get_financial_report_v1(uuid, text, date, date, text) from anon;
grant execute on function customer_api.get_financial_report_v1(uuid, text, date, date, text) to authenticated;
grant execute on function customer_api.get_financial_report_v1(uuid, text, date, date, text) to service_role;

comment on function customer_api.get_financial_report_v1(uuid, text, date, date, text) is
  'Customer API Gateway v1: Generates customer financial management report. Delegates to finance.get_customer_financial_report.';


-- ----------------------------------------------------------------------------
-- 9. Charge Allocations Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_allocations_v1(
  p_context_id uuid,
  p_view text default 'runs'::text,
  p_query text default null::text,
  p_status text default null::text,
  p_method text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return finance.get_customer_allocations(
    p_context_id,
    p_view,
    p_query,
    p_status,
    p_method,
    p_from,
    p_to,
    p_limit,
    p_offset,
    p_id
  );
end;
$$;

revoke all on function customer_api.get_allocations_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) from public;
revoke all on function customer_api.get_allocations_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) from anon;
grant execute on function customer_api.get_allocations_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) to authenticated;
grant execute on function customer_api.get_allocations_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) to service_role;

comment on function customer_api.get_allocations_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) is
  'Customer API Gateway v1: Retrieves charge allocation runs and line items. Delegates to finance.get_customer_allocations.';


-- ----------------------------------------------------------------------------
-- 10. Audit Events Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_audit_events_v1(
  p_context_id uuid,
  p_limit integer default 25,
  p_offset integer default 0,
  p_query text default null::text,
  p_action text default null::text,
  p_from timestamp with time zone default null::timestamp with time zone,
  p_until timestamp with time zone default null::timestamp with time zone
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return audit.get_customer_events(
    p_context_id,
    p_limit,
    p_offset,
    p_query,
    p_action,
    p_from,
    p_until
  );
end;
$$;

revoke all on function customer_api.get_audit_events_v1(uuid, integer, integer, text, text, timestamp with time zone, timestamp with time zone) from public;
revoke all on function customer_api.get_audit_events_v1(uuid, integer, integer, text, text, timestamp with time zone, timestamp with time zone) from anon;
grant execute on function customer_api.get_audit_events_v1(uuid, integer, integer, text, text, timestamp with time zone, timestamp with time zone) to authenticated;
grant execute on function customer_api.get_audit_events_v1(uuid, integer, integer, text, text, timestamp with time zone, timestamp with time zone) to service_role;

comment on function customer_api.get_audit_events_v1(uuid, integer, integer, text, text, timestamp with time zone, timestamp with time zone) is
  'Customer API Gateway v1: Retrieves customer audit trail events. Delegates to audit.get_customer_events.';


-- ----------------------------------------------------------------------------
-- 11. Billing Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_billing_v1(
  p_context_id uuid,
  p_query text default null::text,
  p_status text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_invoice_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return billing.get_customer_billing(
    p_context_id,
    p_query,
    p_status,
    p_from,
    p_to,
    p_limit,
    p_offset,
    p_invoice_id
  );
end;
$$;

revoke all on function customer_api.get_billing_v1(uuid, text, text, date, date, integer, integer, uuid) from public;
revoke all on function customer_api.get_billing_v1(uuid, text, text, date, date, integer, integer, uuid) from anon;
grant execute on function customer_api.get_billing_v1(uuid, text, text, date, date, integer, integer, uuid) to authenticated;
grant execute on function customer_api.get_billing_v1(uuid, text, text, date, date, integer, integer, uuid) to service_role;

comment on function customer_api.get_billing_v1(uuid, text, text, date, date, integer, integer, uuid) is
  'Customer API Gateway v1: Retrieves invoices and receivables billing records. Delegates to billing.get_customer_billing.';


-- ----------------------------------------------------------------------------
-- 12. Payments Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_payments_v1(
  p_context_id uuid,
  p_view text default 'payments'::text,
  p_query text default null::text,
  p_status text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return payments.get_customer_payments(
    p_context_id,
    p_view,
    p_query,
    p_status,
    p_from,
    p_to,
    p_limit,
    p_offset,
    p_id
  );
end;
$$;

revoke all on function customer_api.get_payments_v1(uuid, text, text, text, date, date, integer, integer, uuid) from public;
revoke all on function customer_api.get_payments_v1(uuid, text, text, text, date, date, integer, integer, uuid) from anon;
grant execute on function customer_api.get_payments_v1(uuid, text, text, text, date, date, integer, integer, uuid) to authenticated;
grant execute on function customer_api.get_payments_v1(uuid, text, text, text, date, date, integer, integer, uuid) to service_role;

comment on function customer_api.get_payments_v1(uuid, text, text, text, date, date, integer, integer, uuid) is
  'Customer API Gateway v1: Retrieves payment transactions and reconciliation batches. Delegates to payments.get_customer_payments.';


-- ----------------------------------------------------------------------------
-- 13. Utilities Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_utilities_v1(
  p_context_id uuid,
  p_view text default 'meters'::text,
  p_query text default null::text,
  p_status text default null::text,
  p_service text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return utilities.get_customer_utilities(
    p_context_id,
    p_view,
    p_query,
    p_status,
    p_service,
    p_from,
    p_to,
    p_limit,
    p_offset,
    p_id
  );
end;
$$;

revoke all on function customer_api.get_utilities_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) from public;
revoke all on function customer_api.get_utilities_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) from anon;
grant execute on function customer_api.get_utilities_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) to authenticated;
grant execute on function customer_api.get_utilities_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) to service_role;

comment on function customer_api.get_utilities_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) is
  'Customer API Gateway v1: Retrieves utility meters, readings, and invoices. Delegates to utilities.get_customer_utilities.';


-- ----------------------------------------------------------------------------
-- 14. Maintenance Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_maintenance_v1(
  p_context_id uuid,
  p_view text default 'assets'::text,
  p_query text default null::text,
  p_status text default null::text,
  p_priority text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return maintenance.get_customer_maintenance(
    p_context_id,
    p_view,
    p_query,
    p_status,
    p_priority,
    p_from,
    p_to,
    p_limit,
    p_offset,
    p_id
  );
end;
$$;

revoke all on function customer_api.get_maintenance_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) from public;
revoke all on function customer_api.get_maintenance_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) from anon;
grant execute on function customer_api.get_maintenance_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) to authenticated;
grant execute on function customer_api.get_maintenance_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) to service_role;

comment on function customer_api.get_maintenance_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) is
  'Customer API Gateway v1: Retrieves maintenance assets, tickets, and work orders. Delegates to maintenance.get_customer_maintenance.';


-- ----------------------------------------------------------------------------
-- 15. Procurement Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_procurement_v1(
  p_context_id uuid,
  p_view text default 'vendors'::text,
  p_query text default null::text,
  p_status text default null::text,
  p_currency text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return maintenance.get_customer_procurement(
    p_context_id,
    p_view,
    p_query,
    p_status,
    p_currency,
    p_from,
    p_to,
    p_limit,
    p_offset,
    p_id
  );
end;
$$;

revoke all on function customer_api.get_procurement_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) from public;
revoke all on function customer_api.get_procurement_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) from anon;
grant execute on function customer_api.get_procurement_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) to authenticated;
grant execute on function customer_api.get_procurement_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) to service_role;

comment on function customer_api.get_procurement_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) is
  'Customer API Gateway v1: Retrieves procurement vendors and contracts. Delegates to maintenance.get_customer_procurement.';


-- ----------------------------------------------------------------------------
-- 16. Governance Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_governance_v1(
  p_context_id uuid,
  p_view text default 'meetings'::text,
  p_query text default null::text,
  p_status text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return governance.get_customer_governance(
    p_context_id,
    p_view,
    p_query,
    p_status,
    p_from,
    p_to,
    p_limit,
    p_offset,
    p_id
  );
end;
$$;

revoke all on function customer_api.get_governance_v1(uuid, text, text, text, date, date, integer, integer, uuid) from public;
revoke all on function customer_api.get_governance_v1(uuid, text, text, text, date, date, integer, integer, uuid) from anon;
grant execute on function customer_api.get_governance_v1(uuid, text, text, text, date, date, integer, integer, uuid) to authenticated;
grant execute on function customer_api.get_governance_v1(uuid, text, text, text, date, date, integer, integer, uuid) to service_role;

comment on function customer_api.get_governance_v1(uuid, text, text, text, date, date, integer, integer, uuid) is
  'Customer API Gateway v1: Retrieves governance meetings, votes, and resolutions. Delegates to governance.get_customer_governance.';


-- ----------------------------------------------------------------------------
-- 17. Communications Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_communications_v1(
  p_context_id uuid,
  p_view text default 'posts'::text,
  p_query text default null::text,
  p_status text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return communications.get_customer_communications(
    p_context_id,
    p_view,
    p_query,
    p_status,
    p_from,
    p_to,
    p_limit,
    p_offset,
    p_id
  );
end;
$$;

revoke all on function customer_api.get_communications_v1(uuid, text, text, text, date, date, integer, integer, uuid) from public;
revoke all on function customer_api.get_communications_v1(uuid, text, text, text, date, date, integer, integer, uuid) from anon;
grant execute on function customer_api.get_communications_v1(uuid, text, text, text, date, date, integer, integer, uuid) to authenticated;
grant execute on function customer_api.get_communications_v1(uuid, text, text, text, date, date, integer, integer, uuid) to service_role;

comment on function customer_api.get_communications_v1(uuid, text, text, text, date, date, integer, integer, uuid) is
  'Customer API Gateway v1: Retrieves community feed posts and notifications. Delegates to communications.get_customer_communications.';


-- ----------------------------------------------------------------------------
-- 18. Documents Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_documents_v1(
  p_context_id uuid,
  p_view text default 'documents'::text,
  p_query text default null::text,
  p_status text default null::text,
  p_classification text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return documents.get_customer_documents(
    p_context_id,
    p_view,
    p_query,
    p_status,
    p_classification,
    p_from,
    p_to,
    p_limit,
    p_offset,
    p_id
  );
end;
$$;

revoke all on function customer_api.get_documents_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) from public;
revoke all on function customer_api.get_documents_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) from anon;
grant execute on function customer_api.get_documents_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) to authenticated;
grant execute on function customer_api.get_documents_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) to service_role;

comment on function customer_api.get_documents_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) is
  'Customer API Gateway v1: Retrieves document vault records. Delegates to documents.get_customer_documents.';


-- ----------------------------------------------------------------------------
-- 19. Occupancy Registry Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_occupancy_registry_v1(
  p_context_id uuid,
  p_view text default 'occupancies'::text,
  p_query text default null::text,
  p_status text default null::text,
  p_kind text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return occupancy.get_customer_registry(
    p_context_id,
    p_view,
    p_query,
    p_status,
    p_kind,
    p_from,
    p_to,
    p_limit,
    p_offset,
    p_id
  );
end;
$$;

revoke all on function customer_api.get_occupancy_registry_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) from public;
revoke all on function customer_api.get_occupancy_registry_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) from anon;
grant execute on function customer_api.get_occupancy_registry_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) to authenticated;
grant execute on function customer_api.get_occupancy_registry_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) to service_role;

comment on function customer_api.get_occupancy_registry_v1(uuid, text, text, text, text, date, date, integer, integer, uuid) is
  'Customer API Gateway v1: Retrieves unit occupancy, party, ownership, and lease registry. Delegates to occupancy.get_customer_registry.';


-- ----------------------------------------------------------------------------
-- 20. Security Access Wrapper
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_security_access_v1(
  p_context_id uuid,
  p_view text default 'access_points'::text,
  p_query text default null::text,
  p_status text default null::text,
  p_kind text default null::text,
  p_from timestamp with time zone default null::timestamp with time zone,
  p_to timestamp with time zone default null::timestamp with time zone,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return security_access.get_customer_security_access(
    p_context_id,
    p_view,
    p_query,
    p_status,
    p_kind,
    p_from,
    p_to,
    p_limit,
    p_offset,
    p_id
  );
end;
$$;

revoke all on function customer_api.get_security_access_v1(uuid, text, text, text, text, timestamp with time zone, timestamp with time zone, integer, integer, uuid) from public;
revoke all on function customer_api.get_security_access_v1(uuid, text, text, text, text, timestamp with time zone, timestamp with time zone, integer, integer, uuid) from anon;
grant execute on function customer_api.get_security_access_v1(uuid, text, text, text, text, timestamp with time zone, timestamp with time zone, integer, integer, uuid) to authenticated;
grant execute on function customer_api.get_security_access_v1(uuid, text, text, text, text, timestamp with time zone, timestamp with time zone, integer, integer, uuid) to service_role;

comment on function customer_api.get_security_access_v1(uuid, text, text, text, text, timestamp with time zone, timestamp with time zone, integer, integer, uuid) is
  'Customer API Gateway v1: Retrieves access points, credentials, and visitor logs. Delegates to security_access.get_customer_security_access.';

commit;
