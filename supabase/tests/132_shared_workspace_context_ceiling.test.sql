begin;
select plan(33);
do $$
declare
  v_tenant_id uuid := '13200000-0000-0000-0000-000000000001'::uuid;
  v_tenant2_id uuid := '13200000-0000-0000-0000-000000000002'::uuid;
  v_user_admin_id uuid := '13200000-0000-0000-0000-000000000010'::uuid;
  v_user_member_id uuid := '13200000-0000-0000-0000-000000000020'::uuid;
  v_user_other_id uuid := '13200000-0000-0000-0000-000000000030'::uuid;
  v_ws_id uuid := '13200000-0000-0000-0000-000000000100'::uuid;
  v_ws2_id uuid := '13200000-0000-0000-0000-000000000200'::uuid;
  v_prop_id uuid := '13200000-0000-0000-0000-000000001000'::uuid;
  v_prop2_id uuid := '13200000-0000-0000-0000-000000002000'::uuid;
  v_bld_id uuid := '13200000-0000-0000-0000-000000010000'::uuid;
  v_bld2_id uuid := '13200000-0000-0000-0000-000000020000'::uuid;
  v_unit1_id uuid := '13200000-0000-0000-0000-000000100001'::uuid;
  v_unit2_id uuid := '13200000-0000-0000-0000-000000100002'::uuid;
  v_admin_role_id uuid;
  v_member_role_id uuid;
  v_mem_admin_id uuid := '13200000-0000-0000-0000-000001000001'::uuid;
  v_mem_target_id uuid := '13200000-0000-0000-0000-000001000002'::uuid;
  v_mem_other_id uuid := '13200000-0000-0000-0000-000001000003'::uuid;
  v_ctx_admin_id uuid := '13200000-0000-0000-0000-000010000001'::uuid;
  v_ctx_admin_ws2_id uuid := '13200000-0000-0000-0000-000010000003'::uuid;
  v_ctx_member_id uuid := '13200000-0000-0000-0000-000010000002'::uuid;
  v_profile_id uuid;
  v_model_id uuid;
begin
  -- Users
  insert into auth.users (id, email) values
    (v_user_admin_id, 'ws_admin@test.local'),
    (v_user_member_id, 'ws_member@test.local'),
    (v_user_other_id, 'ws_other@test.local')
  on conflict (id) do nothing;

  -- Tenants
  insert into platform.tenants (id, legal_name, registration_number, status) values
    (v_tenant_id, 'Test Tenant 132', 'RO-TEST-132-A', 'active'),
    (v_tenant2_id, 'Test Tenant 132 B', 'RO-TEST-132-B', 'active')
  on conflict (id) do nothing;

  -- Workspaces
  insert into platform.customer_workspaces (id, tenant_id, workspace_type, commercial_owner, environment, lifecycle_status) values
    (v_ws_id, v_tenant_id, 'ASSOCIATION', 'Owner 132', 'PILOT', 'ACTIVE'),
    (v_ws2_id, v_tenant_id, 'ASSOCIATION', 'Owner 132 B', 'PILOT', 'ACTIVE')
  on conflict (id) do nothing;

  -- Properties, Buildings, Units
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    (v_prop_id, v_tenant_id, 'condominium', 'Property 132 A', 'active'),
    (v_prop2_id, v_tenant_id, 'condominium', 'Property 132 B', 'active')
  on conflict (id) do nothing;

  insert into portfolio.buildings (id, tenant_id, property_id, code, name, status) values
    (v_bld_id, v_tenant_id, v_prop_id, 'BLD-1', 'Building 1', 'active'),
    (v_bld2_id, v_tenant_id, v_prop_id, 'BLD-2', 'Building 2', 'active')
  on conflict (id) do nothing;

  insert into portfolio.units (id, tenant_id, building_id, code, status) values
    (v_unit1_id, v_tenant_id, v_bld_id, '101', 'active'),
    (v_unit2_id, v_tenant_id, v_bld_id, '102', 'active')
  on conflict (id) do nothing;

  -- Workspace Property Bindings
  insert into platform.workspace_property_bindings (tenant_id, customer_workspace_id, property_id, status, binding_source) values
    (v_tenant_id, v_ws_id, v_prop_id, 'active', 'platform_assignment'),
    (v_tenant_id, v_ws2_id, v_prop2_id, 'active', 'platform_assignment')
  on conflict do nothing;

  -- Roles & Memberships
  select id into v_admin_role_id from identity.roles where lower(code) = 'association_admin' and tenant_id is null and is_system = true limit 1;
  select id into v_member_role_id from identity.roles where lower(code) = 'owner' and tenant_id is null and is_system = true limit 1;

  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at) values
    (v_mem_admin_id, v_tenant_id, v_user_admin_id, v_admin_role_id, 'active', statement_timestamp() - interval '1 day'),
    (v_mem_target_id, v_tenant_id, v_user_member_id, v_member_role_id, 'active', statement_timestamp() - interval '1 day'),
    (v_mem_other_id, v_tenant2_id, v_user_other_id, v_member_role_id, 'active', statement_timestamp() - interval '1 day')
  on conflict (id) do nothing;

  -- Context Grants
  insert into identity.context_grants (id, tenant_id, membership_id, scope_type, property_id, starts_at) values
    (v_ctx_admin_id, v_tenant_id, v_mem_admin_id, 'property', v_prop_id, statement_timestamp() - interval '1 day'),
    (v_ctx_admin_ws2_id, v_tenant_id, v_mem_admin_id, 'property', v_prop2_id, statement_timestamp() - interval '1 day'),
    (v_ctx_member_id, v_tenant_id, v_mem_target_id, 'property', v_prop_id, statement_timestamp() - interval '1 day')
  on conflict (id) do nothing;

  -- Active Taxonomy Assignment
  select id into v_profile_id from platform.property_profiles where code = 'residential_condominium' and version = 1 limit 1;
  select id into v_model_id from platform.operating_models where code = 'association_managed' and version = 1 limit 1;

  insert into platform.workspace_taxonomy_assignments (
    tenant_id, customer_workspace_id, property_profile_id, operating_model_id, status, valid_from, created_by, country_code
  ) values
    (v_tenant_id, v_ws_id, v_profile_id, v_model_id, 'active', statement_timestamp() - interval '1 day', v_user_admin_id, 'RO'),
    (v_tenant_id, v_ws2_id, v_profile_id, v_model_id, 'active', statement_timestamp() - interval '1 day', v_user_admin_id, 'RO')
  on conflict do nothing;

  -- Active Modules & Entitlements for Maintenance and Documents
  insert into platform.workspace_modules (
    tenant_id, customer_workspace_id, module_definition_id, module_code, status, reason
  ) select v_tenant_id, v_ws_id, id, code, 'active', 'Initial test activation'
  from platform.module_definitions where code in ('maintenance', 'documents')
  on conflict do nothing;

  insert into platform.workspace_entitlements (
    customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from
  ) values
    (v_ws_id, 'module.maintenance', 'boolean', true, statement_timestamp() - interval '1 day'),
    (v_ws_id, 'module.documents', 'boolean', true, statement_timestamp() - interval '1 day')
  on conflict do nothing;
end;
$$;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,building_id,unit_id,starts_at) values
 ('13200000-0000-0000-0000-000010000004','13200000-0000-0000-0000-000000000001','13200000-0000-0000-0000-000001000001','building','13200000-0000-0000-0000-000000010000',null,statement_timestamp()-interval '1 day'),
 ('13200000-0000-0000-0000-000010000005','13200000-0000-0000-0000-000000000001','13200000-0000-0000-0000-000001000001','unit',null,'13200000-0000-0000-0000-000000100001',statement_timestamp()-interval '1 day');
select set_config('request.jwt.claims',jsonb_build_object('sub','13200000-0000-0000-0000-000000000010','aal','aal2')::text,true);
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000001','property','13200000-0000-0000-0000-000000001000'),true,'property exact');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000001','building','13200000-0000-0000-0000-000000010000'),true,'property to building');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000001','unit','13200000-0000-0000-0000-000000100001'),true,'property to unit');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000001','property','13200000-0000-0000-0000-000000002000'),false,'other workspace target');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000001','workspace','13200000-0000-0000-0000-000000000100'),false,'property cannot widen to workspace');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000004','building','13200000-0000-0000-0000-000000010000'),true,'building exact');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000004','unit','13200000-0000-0000-0000-000000100001'),true,'building to child unit');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000004','building','13200000-0000-0000-0000-000000020000'),false,'sibling building denied');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000004','property','13200000-0000-0000-0000-000000001000'),false,'building cannot widen to parent');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000004','workspace','13200000-0000-0000-0000-000000000100'),false,'building cannot widen to workspace');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000005','unit','13200000-0000-0000-0000-000000100001'),true,'unit exact');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000005','unit','13200000-0000-0000-0000-000000100002'),false,'sibling unit denied');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000005','building','13200000-0000-0000-0000-000000010000'),false,'unit cannot widen to building');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000005','property','13200000-0000-0000-0000-000000001000'),false,'unit cannot widen to parent');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000005','workspace','13200000-0000-0000-0000-000000000100'),false,'unit cannot widen to workspace');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000001','unit','13200000-0000-0000-0000-000000000999'),false,'missing target denied');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000001','tenant','13200000-0000-0000-0000-000000000001'),false,'invalid target scope denied');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000001','property',null),false,'null target denied');
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000000000999','property','13200000-0000-0000-0000-000000001000'),false,'unknown context denied');
insert into identity.role_permissions(role_id,permission_id,effect)
 select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p
 where r.code='association_admin' and r.tenant_id is null and p.code='maintenance.requests.manage'
 on conflict(role_id,permission_id) do update set effect='allow';
select is(app_private.check_scoped_effective_permission_v1('13200000-0000-0000-0000-000010000001','maintenance.requests.manage','maintenance','property','13200000-0000-0000-0000-000000001000'),true,'canonical allow retained');
select is(app_private.check_scoped_effective_permission_v1('13200000-0000-0000-0000-000010000005','maintenance.requests.manage','maintenance','unit','13200000-0000-0000-0000-000000100001'),true,'base allow within unit ceiling');
select is(app_private.check_scoped_effective_permission_v1('13200000-0000-0000-0000-000010000005','maintenance.requests.manage','maintenance','property','13200000-0000-0000-0000-000000001000'),false,'base allow cannot widen context');
select is(app_private.check_scoped_effective_permission_v1('13200000-0000-0000-0000-000010000001','maintenance.requests.manage','missing','property','13200000-0000-0000-0000-000000001000'),false,'missing module fails closed');
update identity.role_permissions rp set effect='deny' from identity.roles r,identity.permissions p
 where rp.role_id=r.id and rp.permission_id=p.id and r.code='association_admin' and r.tenant_id is null and p.code='maintenance.requests.manage';
select is(app_private.check_scoped_effective_permission_v1('13200000-0000-0000-0000-000010000001','maintenance.requests.manage','maintenance','property','13200000-0000-0000-0000-000000001000'),false,'canonical deny retained');
update identity.role_permissions rp set effect='allow' from identity.roles r,identity.permissions p
 where rp.role_id=r.id and rp.permission_id=p.id and r.code='association_admin' and r.tenant_id is null and p.code='maintenance.requests.manage';
update platform.workspace_entitlements set boolean_value=false where customer_workspace_id='13200000-0000-0000-0000-000000000100' and entitlement_key='module.maintenance';
select is(app_private.check_scoped_effective_permission_v1('13200000-0000-0000-0000-000010000001','maintenance.requests.manage','maintenance','property','13200000-0000-0000-0000-000000001000'),false,'disabled entitlement retained');
select set_config('request.jwt.claims',jsonb_build_object('sub','13200000-0000-0000-0000-000000000030','aal','aal2')::text,true);
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000001','property','13200000-0000-0000-0000-000000001000'),false,'unrelated actor denied');
select set_config('request.jwt.claims','{}',true);
select is(app_private.context_covers_workspace_target_v1('13200000-0000-0000-0000-000010000001','property','13200000-0000-0000-0000-000000001000'),false,'anonymous actor denied');
select ok(not has_function_privilege('anon','app_private.context_covers_workspace_target_v1(uuid,text,uuid)','execute'),'anon cannot invoke context_covers_workspace_target_v1 directly');
select ok(not has_function_privilege('anon','app_private.check_scoped_effective_permission_v1(uuid,text,text,text,uuid)','execute'),'anon cannot invoke check_scoped_effective_permission_v1 directly');
select ok(not has_function_privilege('authenticated','app_private.context_covers_workspace_target_v1(uuid,text,uuid)','execute'),'authenticated cannot invoke context_covers_workspace_target_v1 directly');
select ok(not has_function_privilege('authenticated','app_private.check_scoped_effective_permission_v1(uuid,text,text,text,uuid)','execute'),'authenticated cannot invoke check_scoped_effective_permission_v1 directly');
select ok(not has_function_privilege('service_role','app_private.context_covers_workspace_target_v1(uuid,text,uuid)','execute'),'service_role cannot invoke context_covers_workspace_target_v1 directly');
select ok(not has_function_privilege('service_role','app_private.check_scoped_effective_permission_v1(uuid,text,text,text,uuid)','execute'),'service_role cannot invoke check_scoped_effective_permission_v1 directly');
select * from finish();
rollback;
