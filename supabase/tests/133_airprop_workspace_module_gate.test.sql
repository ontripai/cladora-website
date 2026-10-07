begin;
select plan(24);
select ok(exists(select 1 from platform.module_definitions where code='airprop_commercial' and version=1 and lifecycle_status='published' and requires_aal2 and entitlement_key='module.airprop_commercial'),'AIRPROP uses canonical runtime catalogue');
select lives_ok($$select app_private.validate_airprop_module_bindings_v1()$$,'AIRPROP exact current binding manifest');
select lives_ok($$select app_private.validate_module_permission_bindings_v2_seeding_v1()$$,'historic manifest survives added domain');
select is((select count(*)::integer from platform.workspace_modules where module_code='airprop_commercial'),0,'migration does not activate any workspace');
select is((select count(*)::integer from platform.workspace_entitlements where entitlement_key='module.airprop_commercial'),0,'migration grants no entitlement');
do $$
declare
  v_tenant_id uuid := '13300000-0000-0000-0000-000000000001'::uuid;
  v_tenant2_id uuid := '13300000-0000-0000-0000-000000000002'::uuid;
  v_user_admin_id uuid := '13300000-0000-0000-0000-000000000010'::uuid;
  v_user_member_id uuid := '13300000-0000-0000-0000-000000000020'::uuid;
  v_user_other_id uuid := '13300000-0000-0000-0000-000000000030'::uuid;
  v_ws_id uuid := '13300000-0000-0000-0000-000000000100'::uuid;
  v_ws2_id uuid := '13300000-0000-0000-0000-000000000200'::uuid;
  v_prop_id uuid := '13300000-0000-0000-0000-000000001000'::uuid;
  v_prop2_id uuid := '13300000-0000-0000-0000-000000002000'::uuid;
  v_bld_id uuid := '13300000-0000-0000-0000-000000010000'::uuid;
  v_bld2_id uuid := '13300000-0000-0000-0000-000000020000'::uuid;
  v_unit1_id uuid := '13300000-0000-0000-0000-000000100001'::uuid;
  v_unit2_id uuid := '13300000-0000-0000-0000-000000100002'::uuid;
  v_admin_role_id uuid;
  v_member_role_id uuid;
  v_mem_admin_id uuid := '13300000-0000-0000-0000-000001000001'::uuid;
  v_mem_target_id uuid := '13300000-0000-0000-0000-000001000002'::uuid;
  v_mem_other_id uuid := '13300000-0000-0000-0000-000001000003'::uuid;
  v_ctx_admin_id uuid := '13300000-0000-0000-0000-000010000001'::uuid;
  v_ctx_admin_ws2_id uuid := '13300000-0000-0000-0000-000010000003'::uuid;
  v_ctx_member_id uuid := '13300000-0000-0000-0000-000010000002'::uuid;
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
    (v_tenant_id, 'Test Tenant 133', 'RO-TEST-133-A', 'active'),
    (v_tenant2_id, 'Test Tenant 133 B', 'RO-TEST-133-B', 'active')
  on conflict (id) do nothing;

  -- Workspaces
  insert into platform.customer_workspaces (id, tenant_id, workspace_type, commercial_owner, environment, lifecycle_status) values
    (v_ws_id, v_tenant_id, 'ASSOCIATION', 'Owner 133', 'PILOT', 'ACTIVE'),
    (v_ws2_id, v_tenant_id, 'ASSOCIATION', 'Owner 133 B', 'PILOT', 'ACTIVE')
  on conflict (id) do nothing;

  -- Properties, Buildings, Units
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    (v_prop_id, v_tenant_id, 'condominium', 'Property 133 A', 'active'),
    (v_prop2_id, v_tenant_id, 'condominium', 'Property 133 B', 'active')
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
update identity.memberships set role_id=(select id from identity.roles where code='airprop_portfolio_director' and tenant_id is null) where id='13300000-0000-0000-0000-000001000001';
select set_config('request.jwt.claims',jsonb_build_object('sub','13300000-0000-0000-0000-000000000010','aal','aal2')::text,true);
insert into portfolio.parties(id,tenant_id,type,legal_name)
values('13300000-0000-0000-0000-000000000400','13300000-0000-0000-0000-000000000001','company','Synthetic AIRPROP commercial party');
select throws_ok($$select * from app_private.require_airprop_workspace_context_v1('13300000-0000-0000-0000-000010000001','airprop.asset.manage','13300000-0000-0000-0000-000000001000')$$,'42501','airprop_workspace_access_denied','module inactive denies access');
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000100',id,code,'active','Synthetic AIRPROP module activation'
from platform.module_definitions where code='airprop_commercial' and version=1;
select throws_ok($$select * from app_private.require_airprop_workspace_context_v1('13300000-0000-0000-0000-000010000001','airprop.asset.manage','13300000-0000-0000-0000-000000001000')$$,'42501','airprop_workspace_access_denied','activation without entitlement denies access');
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
values('13300000-0000-0000-0000-000000000100','module.airprop_commercial','boolean',true,statement_timestamp()-interval '1 day');
select lives_ok($$select * from app_private.require_airprop_workspace_context_v1('13300000-0000-0000-0000-000010000001','airprop.asset.manage','13300000-0000-0000-0000-000000001000')$$,'base AIRPROP role allowed after module entitlement and scope gates');
select is((select workspace_id from app_private.require_airprop_workspace_context_v1('13300000-0000-0000-0000-000010000001','airprop.asset.manage','13300000-0000-0000-0000-000000001000')),'13300000-0000-0000-0000-000000000100','gate returns canonical workspace');
select throws_ok($$select * from app_private.require_airprop_workspace_context_v1('13300000-0000-0000-0000-000010000001','airprop.asset.manage','13300000-0000-0000-0000-000000002000')$$,'42501','airprop_workspace_access_denied','cross-workspace target denied');
select throws_ok($$select * from app_private.require_airprop_workspace_context_v1('13300000-0000-0000-0000-000010000001','airprop.asset.manage',null)$$,'42501','airprop_workspace_access_denied','null target denied');
select throws_ok($$select * from app_private.require_airprop_workspace_context_v1('13300000-0000-0000-0000-000010000001','airprop.invalid','13300000-0000-0000-0000-000000001000')$$,'42501','airprop_workspace_access_denied','unregistered AIRPROP permission denied');
select set_config('request.jwt.claims',jsonb_build_object('sub','13300000-0000-0000-0000-000000000010','aal','aal1')::text,true);
select throws_ok($$select * from app_private.require_airprop_workspace_context_v1('13300000-0000-0000-0000-000010000001','airprop.asset.manage','13300000-0000-0000-0000-000000001000')$$,'42501','mfa_required','AAL1 mutation denied');
select set_config('request.jwt.claims',jsonb_build_object('sub','13300000-0000-0000-0000-000000000010','aal','aal2')::text,true);
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,unit_id,starts_at)
values('13300000-0000-0000-0000-000010000005','13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000001000001','unit','13300000-0000-0000-0000-000000100001',statement_timestamp()-interval '1 day');
select throws_ok($$select * from app_private.require_airprop_workspace_context_v1('13300000-0000-0000-0000-000010000005','airprop.asset.manage','13300000-0000-0000-0000-000000001000')$$,'42501','airprop_workspace_access_denied','unit context cannot widen to full target');
update platform.workspace_entitlements set boolean_value=false where customer_workspace_id='13300000-0000-0000-0000-000000000100' and entitlement_key='module.airprop_commercial';
select throws_ok($$select * from app_private.require_airprop_workspace_context_v1('13300000-0000-0000-0000-000010000001','airprop.asset.manage','13300000-0000-0000-0000-000000001000')$$,'42501','airprop_workspace_access_denied','disabled entitlement denies access');
update platform.workspace_entitlements set boolean_value=true where customer_workspace_id='13300000-0000-0000-0000-000000000100' and entitlement_key='module.airprop_commercial';
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from)
 values('13300000-0000-0000-0000-000000000300','13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000100','airprop_test_deny','AIRPROP test deny','property','13300000-0000-0000-0000-000000000010',statement_timestamp()-interval '1 day');
 insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
 select '13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000300',id from platform.module_definitions where code='airprop_commercial' and version=1;
 insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
 select '13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000300',id,'deny' from identity.permissions where code='airprop.asset.manage';
 update platform.workspace_roles set lifecycle_status='published' where id='13300000-0000-0000-0000-000000000300';
 insert into platform.workspace_member_roles(tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,property_id,
 assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
 values('13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000100','13300000-0000-0000-0000-000001000001','13300000-0000-0000-0000-000000000300','property','13300000-0000-0000-0000-000000001000','13300000-0000-0000-0000-000000000010','13300000-0000-0000-0000-000001000001','Synthetic AIRPROP role assignment',statement_timestamp()-interval '1 hour');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from)
 values('13300000-0000-0000-0000-000000000301','13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000100','airprop_test_allow','AIRPROP test allow','property','13300000-0000-0000-0000-000000000010',statement_timestamp()-interval '1 day');
 insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
 select '13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000301',id from platform.module_definitions where code='airprop_commercial' and version=1;
 insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
 select '13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000301',id,'allow' from identity.permissions where code='airprop.asset.manage';
 update platform.workspace_roles set lifecycle_status='published' where id='13300000-0000-0000-0000-000000000301';
 insert into platform.workspace_member_roles(tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,property_id,
 assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
 values('13300000-0000-0000-0000-000000000001','13300000-0000-0000-0000-000000000100','13300000-0000-0000-0000-000001000002','13300000-0000-0000-0000-000000000301','property','13300000-0000-0000-0000-000000001000','13300000-0000-0000-0000-000000000010','13300000-0000-0000-0000-000001000001','Synthetic AIRPROP role assignment',statement_timestamp()-interval '1 hour');
select throws_ok($$select * from app_private.require_airprop_workspace_context_v1('13300000-0000-0000-0000-000010000001','airprop.asset.manage','13300000-0000-0000-0000-000000001000')$$,'42501','airprop_workspace_access_denied','local deny overrides base AIRPROP allow');
select throws_ok($$select customer_api.configure_airprop_property_v1('13300000-0000-0000-0000-000010000001','13300000-0000-0000-0000-000000001000','13300000-0000-0000-0000-000000000400','legal_owner',1,'own_asset','2026-01-01','AIRPROP-RO','1.0')$$,'42501','airprop_workspace_access_denied','public command respects local deny');
select set_config('request.jwt.claims',jsonb_build_object('sub','13300000-0000-0000-0000-000000000020','aal','aal2')::text,true);
select lives_ok($$select * from app_private.require_airprop_workspace_context_v1('13300000-0000-0000-0000-000010000002','airprop.asset.manage','13300000-0000-0000-0000-000000001000')$$,'local role enables AIRPROP without AIRPROP base role');
select lives_ok($$select customer_api.configure_airprop_property_v1('13300000-0000-0000-0000-000010000002','13300000-0000-0000-0000-000000001000','13300000-0000-0000-0000-000000000400','legal_owner',1,'own_asset','2026-01-01','AIRPROP-RO','1.0')$$,'public command supports canonical local role');
select is((select count(*)::integer from airprop.property_interests where tenant_id='13300000-0000-0000-0000-000000000001'),1,'local-role command writes exactly one interest');
select set_config('request.jwt.claims','{}',true);
select throws_ok($$select * from app_private.require_airprop_workspace_context_v1('13300000-0000-0000-0000-000010000001','airprop.asset.manage','13300000-0000-0000-0000-000000001000')$$,'42501','authentication_required','anonymous denied');
select ok(not has_function_privilege('anon','app_private.require_airprop_workspace_context_v1(uuid,text,uuid)','execute'),'anon cannot directly invoke private AIRPROP gate');
select ok(not has_function_privilege('authenticated','app_private.require_airprop_workspace_context_v1(uuid,text,uuid)','execute'),'authenticated cannot directly invoke private AIRPROP gate');
select ok(not has_function_privilege('service_role','app_private.require_airprop_workspace_context_v1(uuid,text,uuid)','execute'),'service_role cannot directly invoke private AIRPROP gate');
select * from finish();
rollback;
