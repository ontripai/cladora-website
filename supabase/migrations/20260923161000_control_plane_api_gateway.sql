begin;

-- Keep the internal platform and audit schemas out of PostgREST.  The control
-- plane only reaches them through this narrow, authenticated gateway.
create or replace function app_private.assert_control_plane_gateway_access_v1()
returns void
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'aal2_required' using errcode = '42501';
  end if;
  if app_private.current_platform_user_id() is null then
    raise exception 'platform_access_required' using errcode = '42501';
  end if;
end;
$$;

revoke all on function app_private.assert_control_plane_gateway_access_v1() from public, anon, service_role;
grant execute on function app_private.assert_control_plane_gateway_access_v1() to authenticated;

-- Read models remain protected by the RLS policies of their base tables.
create or replace view customer_api.platform_users_v1
with (security_invoker = true) as select * from platform.platform_users;
create or replace view customer_api.platform_role_assignments_v1
with (security_invoker = true) as select * from platform.platform_role_assignments;
create or replace view customer_api.platform_customer_assignments_v1
with (security_invoker = true) as select * from platform.platform_customer_assignments;
create or replace view customer_api.customer_workspaces_v1
with (security_invoker = true) as select * from platform.customer_workspaces;
create or replace view customer_api.subscription_plans_v1
with (security_invoker = true) as select * from platform.subscription_plans;
create or replace view customer_api.provisioning_runs_v1
with (security_invoker = true) as select * from platform.provisioning_runs;
create or replace view customer_api.provisioning_tasks_v1
with (security_invoker = true) as select * from platform.provisioning_tasks;
create or replace view customer_api.workspace_contracts_v1
with (security_invoker = true) as select * from platform.workspace_contracts;
create or replace view customer_api.workspace_entitlements_v1
with (security_invoker = true) as select * from platform.workspace_entitlements;

revoke all on customer_api.platform_users_v1,
  customer_api.platform_role_assignments_v1,
  customer_api.platform_customer_assignments_v1,
  customer_api.customer_workspaces_v1,
  customer_api.subscription_plans_v1,
  customer_api.provisioning_runs_v1,
  customer_api.provisioning_tasks_v1,
  customer_api.workspace_contracts_v1,
  customer_api.workspace_entitlements_v1 from public, anon, service_role;
grant select on customer_api.platform_users_v1,
  customer_api.platform_role_assignments_v1,
  customer_api.platform_customer_assignments_v1,
  customer_api.customer_workspaces_v1,
  customer_api.subscription_plans_v1,
  customer_api.provisioning_runs_v1,
  customer_api.provisioning_tasks_v1,
  customer_api.workspace_contracts_v1,
  customer_api.workspace_entitlements_v1 to authenticated;

create or replace function customer_api.get_control_plane_overview_v1()
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return platform.get_control_plane_overview(); end $$;

create or replace function customer_api.list_support_access_v1(p_limit integer, p_offset integer, p_query text, p_status text, p_workspace_id uuid)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog as $$
declare v jsonb; begin perform app_private.assert_control_plane_gateway_access_v1();
select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v from platform.list_support_access(p_limit,p_offset,p_query,p_status,p_workspace_id) x; return v; end $$;

create or replace function customer_api.list_support_workspaces_v1()
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog as $$
declare v jsonb; begin perform app_private.assert_control_plane_gateway_access_v1();
select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v from platform.list_support_workspaces() x; return v; end $$;

create or replace function customer_api.request_support_access_v1(p_workspace_id uuid,p_ticket_ref text,p_purpose text,p_requested_scope text,p_sensitivity_level text,p_duration_minutes integer,p_evidence jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.request_support_access(p_workspace_id,p_ticket_ref,p_purpose,p_requested_scope,p_sensitivity_level,p_duration_minutes,p_evidence)); end $$;

create or replace function customer_api.approve_support_access_v1(p_request_id uuid,p_evidence jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.approve_support_access(p_request_id,p_evidence)); end $$;
create or replace function customer_api.cancel_support_access_request_v1(p_request_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.cancel_support_access_request(p_request_id,p_reason)); end $$;
create or replace function customer_api.revoke_support_access_v1(p_grant_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.revoke_support_access(p_grant_id,p_reason)); end $$;

create or replace function customer_api.list_control_plane_audit_events_v1(p_limit integer,p_offset integer,p_query text,p_action text,p_actor_role text,p_entity_type text,p_workspace_id uuid,p_occurred_from timestamptz,p_occurred_until timestamptz)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog as $$
declare v jsonb; begin perform app_private.assert_control_plane_gateway_access_v1();
select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v from platform.list_audit_events(p_limit,p_offset,p_query,p_action,p_actor_role,p_entity_type,p_workspace_id,p_occurred_from,p_occurred_until) x; return v; end $$;

create or replace function customer_api.get_plan_dependency_counts_v1(p_plan_ids uuid[])
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog as $$
declare v jsonb; begin perform app_private.assert_control_plane_gateway_access_v1();
select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v from platform.get_plan_dependency_counts(p_plan_ids) x; return v; end $$;
create or replace function customer_api.create_subscription_plan_version_v1(p_plan_code text,p_display_name text,p_feature_catalogue jsonb,p_limit_schema jsonb,p_effective_from timestamptz,p_effective_until timestamptz,p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.create_subscription_plan_version(p_plan_code,p_display_name,p_feature_catalogue,p_limit_schema,p_effective_from,p_effective_until,p_reason)); end $$;
create or replace function customer_api.activate_subscription_plan_v1(p_plan_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.activate_subscription_plan(p_plan_id,p_reason)); end $$;
create or replace function customer_api.retire_subscription_plan_v1(p_plan_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.retire_subscription_plan(p_plan_id,p_reason)); end $$;

create or replace function customer_api.list_provisionable_workspaces_v1()
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog as $$
declare v jsonb; begin perform app_private.assert_control_plane_gateway_access_v1();
select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) into v from platform.list_provisionable_workspaces() x; return v; end $$;
create or replace function customer_api.create_provisioning_run_v1(p_workspace_id uuid,p_idempotency_key text,p_task_types text[])
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.create_provisioning_run(p_workspace_id,p_idempotency_key,p_task_types)); end $$;
create or replace function customer_api.cancel_provisioning_run_v1(p_run_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.cancel_provisioning_run(p_run_id,p_reason)); end $$;
create or replace function customer_api.retry_provisioning_task_v1(p_task_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.retry_provisioning_task(p_task_id,p_reason)); end $$;

create or replace function customer_api.grant_customer_assignment_v1(p_platform_user_id uuid,p_customer_workspace_id uuid,p_scope_type text,p_scope_id text,p_valid_from timestamptz,p_valid_until timestamptz,p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.grant_customer_assignment(p_platform_user_id,p_customer_workspace_id,p_scope_type,p_scope_id,p_valid_from,p_valid_until,p_reason)); end $$;
create or replace function customer_api.revoke_customer_assignment_v1(p_assignment_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.revoke_customer_assignment(p_assignment_id,p_reason)); end $$;

create or replace function customer_api.create_workspace_contract_v1(p_workspace_id uuid,p_contract_ref text,p_plan_id uuid,p_currency text,p_start_date date,p_end_date date,p_commercial_terms jsonb)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.create_workspace_contract(p_workspace_id,p_contract_ref,p_plan_id,p_currency,p_start_date,p_end_date,p_commercial_terms)); end $$;
create or replace function customer_api.transition_workspace_lifecycle_v1(p_workspace_id uuid,p_target_status text,p_expected_version integer,p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.transition_workspace_lifecycle(p_workspace_id,p_target_status::platform.workspace_lifecycle_status,p_expected_version,p_reason)); end $$;
create or replace function customer_api.create_customer_workspace_v1(p_tenant_id uuid,p_workspace_type text,p_commercial_owner text,p_environment text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.create_customer_workspace(p_tenant_id,p_workspace_type::platform.workspace_type,p_commercial_owner,p_environment::platform.workspace_environment)); end $$;
create or replace function customer_api.set_workspace_entitlement_v1(p_workspace_id uuid,p_entitlement_key text,p_value_type text,p_numeric_value numeric,p_boolean_value boolean,p_text_value text,p_json_value jsonb,p_override_value_json jsonb,p_override_reason text,p_override_expires_at timestamptz)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.set_workspace_entitlement(p_workspace_id,p_entitlement_key,p_value_type,p_numeric_value,p_boolean_value,p_text_value,p_json_value,p_override_value_json,p_override_reason,p_override_expires_at)); end $$;

create or replace function customer_api.create_workspace_invitation_v1(p_workspace_id uuid,p_email text,p_role_id uuid,p_scope_type text,p_expires_in interval,p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare v jsonb; begin perform app_private.assert_control_plane_gateway_access_v1();
select to_jsonb(x) into v from platform.create_workspace_invitation(p_workspace_id,p_email,p_role_id,p_scope_type::identity.scope_type,p_expires_in,p_reason) x; return v; end $$;
create or replace function customer_api.revoke_workspace_invitation_v1(p_invitation_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return to_jsonb(platform.revoke_workspace_invitation(p_invitation_id,p_reason)); end $$;

create or replace function customer_api.get_retention_operations_v1(p_section text,p_tenant_id uuid,p_status text,p_limit integer,p_offset integer)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return platform.get_retention_operations_v1(p_section,p_tenant_id,p_status,p_limit,p_offset); end $$;
create or replace function customer_api.preview_retention_workers_v1(p_tenant_id uuid,p_limit integer)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog as $$
begin perform app_private.assert_control_plane_gateway_access_v1(); return platform.preview_retention_workers_v1(p_tenant_id,p_limit); end $$;

-- Default function privileges grant EXECUTE to PUBLIC; explicitly close every
-- gateway and opt authenticated users in.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as signature
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='customer_api'
      and p.proname in (
        'get_control_plane_overview_v1','list_support_access_v1','list_support_workspaces_v1',
        'request_support_access_v1','approve_support_access_v1','cancel_support_access_request_v1','revoke_support_access_v1',
        'list_control_plane_audit_events_v1','get_plan_dependency_counts_v1','create_subscription_plan_version_v1',
        'activate_subscription_plan_v1','retire_subscription_plan_v1','list_provisionable_workspaces_v1',
        'create_provisioning_run_v1','cancel_provisioning_run_v1','retry_provisioning_task_v1',
        'grant_customer_assignment_v1','revoke_customer_assignment_v1','create_workspace_contract_v1',
        'transition_workspace_lifecycle_v1','create_customer_workspace_v1','set_workspace_entitlement_v1',
        'create_workspace_invitation_v1','revoke_workspace_invitation_v1','get_retention_operations_v1',
        'preview_retention_workers_v1')
  loop
    execute format('revoke all on function %s from public, anon, service_role', r.signature);
    execute format('grant execute on function %s to authenticated', r.signature);
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
