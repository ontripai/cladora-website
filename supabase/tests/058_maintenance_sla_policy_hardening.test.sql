-- Test 058: Maintenance SLA Policy Hardening, Versioning & Immutability Slice
-- Verifies:
-- 1. Entity and column structures for maintenance.sla_policies
-- 2. Snapshot and status columns on tickets and work orders
-- 3. customer_api.create_sla_policy_v1 routine existence and privileges
-- 4. Unconfigured SLA behavior (sla_status = 'unconfigured', sla_target_at IS NULL)
-- 5. Explicit policy creation and scoped resolution (within_target, targets populated)
-- 6. Work order propagation of SLA policy snapshot
-- 7. Immutability trigger protection against mutating referenced policy parameters

begin;
select plan(21);

-- =============================================================================
-- 1. Schema & Structure Assertions
-- =============================================================================

select ok(
  to_regclass('maintenance.sla_policies') is not null,
  'maintenance.sla_policies table exists'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'maintenance' and table_name = 'sla_policies' and column_name = 'response_target_hours'
  ),
  'maintenance.sla_policies has response_target_hours'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'maintenance' and table_name = 'sla_policies' and column_name = 'attendance_target_hours'
  ),
  'maintenance.sla_policies has attendance_target_hours'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'maintenance' and table_name = 'sla_policies' and column_name = 'resolution_target_hours'
  ),
  'maintenance.sla_policies has resolution_target_hours'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'maintenance' and table_name = 'sla_policies' and column_name = 'version'
  ),
  'maintenance.sla_policies has version'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'maintenance' and table_name = 'sla_policies' and column_name = 'timezone'
  ),
  'maintenance.sla_policies has timezone'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'maintenance' and table_name = 'tickets' and column_name = 'sla_policy_id'
  ),
  'maintenance.tickets has sla_policy_id'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'maintenance' and table_name = 'tickets' and column_name = 'sla_policy_snapshot'
  ),
  'maintenance.tickets has sla_policy_snapshot'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'maintenance' and table_name = 'tickets' and column_name = 'sla_status'
  ),
  'maintenance.tickets has sla_status'
);

select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'maintenance' and table_name = 'work_orders' and column_name = 'sla_policy_snapshot'
  ),
  'maintenance.work_orders has sla_policy_snapshot'
);

select ok(
  to_regprocedure('customer_api.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text)') is not null,
  'customer_api.create_sla_policy_v1 exists'
);

select ok(
  has_function_privilege('authenticated', 'customer_api.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text)', 'EXECUTE'),
  'authenticated can execute customer_api.create_sla_policy_v1'
);

select ok(
  not has_function_privilege('anon', 'customer_api.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text)', 'EXECUTE'),
  'anon is denied execute on customer_api.create_sla_policy_v1'
);

-- =============================================================================
-- 2. Functional Test Setup
-- =============================================================================

create temp table _sla_test_results (
  unconfigured_target_is_null boolean,
  unconfigured_status text,
  unconfigured_snapshot_status text,
  configured_target_is_not_null boolean,
  configured_status text,
  configured_version integer,
  wo_snapshot_matches boolean,
  immutability_blocked boolean
);

do $$
declare
  v_admin_id uuid := '80000000-0000-0000-0000-000000000001';
  v_tenant_id uuid := '80100000-0000-0000-0000-000000000001';
  v_prop_id uuid := '80300000-0000-0000-0000-000000000001';
  v_bldg_id uuid := '80400000-0000-0000-0000-000000000001';
  v_unit_id uuid := '80500000-0000-0000-0000-000000000001';
  v_role_id uuid;
  v_ctx_admin_id uuid := '80c00000-0000-0000-0000-000000000001';
  v_mship_admin_id uuid := '80d00000-0000-0000-0000-000000000001';
  v_ws_id uuid := '80e00000-0000-0000-0000-000000000001';

  v_ticket_unconf_id uuid;
  v_ticket_conf_id uuid;
  v_policy_id uuid;
  v_wo_id uuid;

  v_req_res jsonb;
  v_pol_res jsonb;
  v_wo_res jsonb;

  v_t_unconf record;
  v_t_conf record;
  v_wo record;

  v_immut_blocked boolean := false;
begin
  -- Fixtures
  insert into auth.users (id, email) values (v_admin_id, 'sla-admin@cladora.test');
  insert into platform.tenants (id, legal_name, registration_number, status)
  values (v_tenant_id, 'P1TEST SLA Tenant', 'SLA-001', 'active');

  insert into portfolio.properties (id, tenant_id, type, name, status)
  values (v_prop_id, v_tenant_id, 'condominium', 'P1TEST SLA Property', 'active');

  insert into portfolio.buildings (id, tenant_id, property_id, code, name)
  values (v_bldg_id, v_tenant_id, v_prop_id, 'BLD-SLA', 'SLA Building');

  insert into portfolio.units (id, tenant_id, building_id, code, status)
  values (v_unit_id, v_tenant_id, v_bldg_id, 'U-SLA', 'active');

  select id into v_role_id from identity.roles where code = 'association_admin';

  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at)
  values (v_mship_admin_id, v_tenant_id, v_admin_id, v_role_id, 'active', statement_timestamp());

  insert into identity.context_grants (id, tenant_id, membership_id, scope_type, property_id, starts_at)
  values (v_ctx_admin_id, v_tenant_id, v_mship_admin_id, 'property', v_prop_id, statement_timestamp());

  insert into platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version)
  values (v_ws_id, v_tenant_id, 'ASSOCIATION', 'ACTIVE', 'P1TEST Owner', 'PILOT', 1);

  insert into platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from)
  values (v_ws_id, 'module.maintenance', 'boolean', true, statement_timestamp());

  -- Impersonate admin with AAL2
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_id::text, 'role', 'authenticated', 'aal', 'aal2')::text, true);

  -- 1. Create request when NO policy exists -> unconfigured
  v_req_res := maintenance.create_maintenance_request(
    v_ctx_admin_id, v_prop_id, v_bldg_id, v_unit_id,
    'Unconfigured SLA Ticket', 'No SLA policy configured yet',
    'HVAC', 'urgent', 'moderate', false
  );
  v_ticket_unconf_id := (v_req_res->>'id')::uuid;

  select * into v_t_unconf from maintenance.tickets where id = v_ticket_unconf_id;

  -- 2. Create explicit SLA policy via Customer API
  v_pol_res := customer_api.create_sla_policy_v1(
    v_ctx_admin_id, 'HVAC Urgent SLA Policy', 'urgent',
    4.0, 8.0, 24.0, '2026-01-01'::date, null, v_prop_id, 'HVAC', 'Europe/Bucharest'
  );
  v_policy_id := (v_pol_res->>'id')::uuid;

  -- 3. Create request with configured policy
  v_req_res := maintenance.create_maintenance_request(
    v_ctx_admin_id, v_prop_id, v_bldg_id, v_unit_id,
    'Configured SLA Ticket', 'SLA policy is active',
    'HVAC', 'urgent', 'moderate', false
  );
  v_ticket_conf_id := (v_req_res->>'id')::uuid;

  select * into v_t_conf from maintenance.tickets where id = v_ticket_conf_id;

  -- 4. Create Work Order linked to configured ticket
  v_wo_res := maintenance.create_work_order(
    v_ctx_admin_id, v_prop_id, v_bldg_id, v_unit_id, null, v_ticket_conf_id,
    'HVAC Inspection', 'Inspect compressor unit', 'urgent'
  );
  v_wo_id := (v_wo_res->>'id')::uuid;

  select * into v_wo from maintenance.work_orders where id = v_wo_id;

  -- 5. Test immutability trigger: Attempt to update resolution target on referenced policy
  begin
    update maintenance.sla_policies
    set resolution_target_hours = 12.0
    where id = v_policy_id;
  exception when others then
    if sqlerrm like '%referenced_sla_policy_is_immutable%' then
      v_immut_blocked := true;
    end if;
  end;

  insert into _sla_test_results (
    unconfigured_target_is_null,
    unconfigured_status,
    unconfigured_snapshot_status,
    configured_target_is_not_null,
    configured_status,
    configured_version,
    wo_snapshot_matches,
    immutability_blocked
  ) values (
    v_t_unconf.sla_target_at is null,
    v_t_unconf.sla_status,
    v_t_unconf.sla_policy_snapshot->>'status',
    v_t_conf.sla_target_at is not null,
    v_t_conf.sla_status,
    (v_t_conf.sla_policy_snapshot->>'version')::integer,
    (v_wo.sla_policy_snapshot->>'policy_id')::uuid = v_policy_id,
    v_immut_blocked
  );
end $$;

-- =============================================================================
-- 3. Functional Assertions
-- =============================================================================

select ok(
  (select unconfigured_target_is_null from _sla_test_results) is true,
  'Unconfigured maintenance request has null sla_target_at'
);

select ok(
  (select unconfigured_status from _sla_test_results) = 'unconfigured',
  'Unconfigured maintenance request has sla_status unconfigured'
);

select ok(
  (select unconfigured_snapshot_status from _sla_test_results) = 'unconfigured',
  'Unconfigured maintenance request snapshot explicitly notes unconfigured status'
);

select ok(
  (select configured_target_is_not_null from _sla_test_results) is true,
  'Configured maintenance request has non-null sla_target_at'
);

select ok(
  (select configured_status from _sla_test_results) = 'within_target',
  'Configured maintenance request has sla_status within_target'
);

select ok(
  (select configured_version from _sla_test_results) = 1,
  'Configured maintenance request snapshot captures policy version 1'
);

select ok(
  (select wo_snapshot_matches from _sla_test_results) is true,
  'Work order accurately inherits SLA policy snapshot from parent ticket'
);

select ok(
  (select immutability_blocked from _sla_test_results) is true,
  'Immutability trigger strictly prevents mutating economic/temporal terms of referenced SLA policy'
);

select * from finish();
rollback;
