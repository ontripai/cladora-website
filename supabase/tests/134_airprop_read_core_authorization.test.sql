begin;
select plan(57);
do $$
declare
  v_tenant_id uuid := '13400000-0000-0000-0000-000000000001'::uuid;
  v_tenant2_id uuid := '13400000-0000-0000-0000-000000000002'::uuid;
  v_user_admin_id uuid := '13400000-0000-0000-0000-000000000010'::uuid;
  v_user_member_id uuid := '13400000-0000-0000-0000-000000000020'::uuid;
  v_user_other_id uuid := '13400000-0000-0000-0000-000000000030'::uuid;
  v_ws_id uuid := '13400000-0000-0000-0000-000000000100'::uuid;
  v_ws2_id uuid := '13400000-0000-0000-0000-000000000200'::uuid;
  v_prop_id uuid := '13400000-0000-0000-0000-000000001000'::uuid;
  v_prop2_id uuid := '13400000-0000-0000-0000-000000002000'::uuid;
  v_bld_id uuid := '13400000-0000-0000-0000-000000010000'::uuid;
  v_bld2_id uuid := '13400000-0000-0000-0000-000000020000'::uuid;
  v_unit1_id uuid := '13400000-0000-0000-0000-000000100001'::uuid;
  v_unit2_id uuid := '13400000-0000-0000-0000-000000100002'::uuid;
  v_admin_role_id uuid;
  v_member_role_id uuid;
  v_mem_admin_id uuid := '13400000-0000-0000-0000-000001000001'::uuid;
  v_mem_target_id uuid := '13400000-0000-0000-0000-000001000002'::uuid;
  v_mem_other_id uuid := '13400000-0000-0000-0000-000001000003'::uuid;
  v_ctx_admin_id uuid := '13400000-0000-0000-0000-000010000001'::uuid;
  v_ctx_admin_ws2_id uuid := '13400000-0000-0000-0000-000010000003'::uuid;
  v_ctx_member_id uuid := '13400000-0000-0000-0000-000010000002'::uuid;
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
    (v_tenant_id, 'Test Tenant 134', 'RO-TEST-134-A', 'active'),
    (v_tenant2_id, 'Test Tenant 134 B', 'RO-TEST-134-B', 'active')
  on conflict (id) do nothing;

  -- Workspaces
  insert into platform.customer_workspaces (id, tenant_id, workspace_type, commercial_owner, environment, lifecycle_status) values
    (v_ws_id, v_tenant_id, 'ASSOCIATION', 'Owner 134', 'PILOT', 'ACTIVE'),
    (v_ws2_id, v_tenant_id, 'ASSOCIATION', 'Owner 134 B', 'PILOT', 'ACTIVE')
  on conflict (id) do nothing;

  -- Properties, Buildings, Units
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    (v_prop_id, v_tenant_id, 'condominium', 'Property 134 A', 'active'),
    (v_prop2_id, v_tenant_id, 'condominium', 'Property 134 B', 'active')
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
update identity.memberships set role_id=(select id from identity.roles where code='airprop_portfolio_director' and tenant_id is null) where id='13400000-0000-0000-0000-000001000001';
insert into portfolio.parties(id,tenant_id,type,legal_name) values('13400000-0000-0000-0000-000000000400','13400000-0000-0000-0000-000000000001','company','AIRPROP Synthetic read party');
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '13400000-0000-0000-0000-000000000001',w.id,m.id,m.code,'active','Synthetic AIRPROP read fixture'
from platform.customer_workspaces w cross join platform.module_definitions m
where w.id in('13400000-0000-0000-0000-000000000100','13400000-0000-0000-0000-000000000200') and m.code='airprop_commercial' and m.version=1;
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
values('13400000-0000-0000-0000-000000000100','module.airprop_commercial','boolean',true,statement_timestamp()-interval '1 day'),
 ('13400000-0000-0000-0000-000000000200','module.airprop_commercial','boolean',true,statement_timestamp()-interval '1 day');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','13400000-0000-0000-0000-000000000010','aal','aal2','active_tenant_id','13400000-0000-0000-0000-000000000001','active_context_id','13400000-0000-0000-0000-000010000001')::text,true);
select lives_ok($$select customer_api.create_airprop_opportunity_v1('13400000-0000-0000-0000-000010000001','AIRPROP-134-READ','{"name":"Synthetic read opportunity","country_code":"RO","city":"București","asking_price":100000,"currency":"RON","property_id":"13400000-0000-0000-0000-000000001000"}'::jsonb)$$,'authorized command creates opportunity');
select lives_ok($$select customer_api.add_airprop_underwriting_version_v1('13400000-0000-0000-0000-000010000001',(select id from airprop.investment_opportunities limit 1),'{"acquisition_cost":100000,"annual_rent":10000,"annual_opex":1000,"currency":"RON"}'::jsonb)$$,'authorized command creates underwriting');
select lives_ok($$select customer_api.configure_airprop_property_v1('13400000-0000-0000-0000-000010000001','13400000-0000-0000-0000-000000001000','13400000-0000-0000-0000-000000000400','legal_owner',1,'own_asset','2026-01-01','AIRPROP-RO','1.0')$$,'authorized command creates commercial interests');
select is((select count(*)::integer from airprop.investment_opportunities),1,'base role reads authorized subject: investment_opportunities');
select is((select count(*)::integer from airprop.underwriting_cases),1,'base role reads authorized subject: underwriting_cases');
select is((select count(*)::integer from airprop.underwriting_versions),1,'base role reads authorized subject: underwriting_versions');
select is((select count(*)::integer from airprop.property_interests),1,'base role reads authorized subject: property_interests');
select is((select count(*)::integer from airprop.property_operating_models),1,'base role reads authorized subject: property_operating_models');
select set_config('request.jwt.claims',jsonb_build_object('sub','13400000-0000-0000-0000-000000000010','aal','aal1','active_tenant_id','13400000-0000-0000-0000-000000000001','active_context_id','13400000-0000-0000-0000-000010000001')::text,true);
select is((select count(*)::integer from airprop.investment_opportunities),0,'AAL1 hides sensitive AIRPROP reads: investment_opportunities');
select is((select count(*)::integer from airprop.underwriting_cases),0,'AAL1 hides sensitive AIRPROP reads: underwriting_cases');
select is((select count(*)::integer from airprop.underwriting_versions),0,'AAL1 hides sensitive AIRPROP reads: underwriting_versions');
select is((select count(*)::integer from airprop.property_interests),0,'AAL1 hides sensitive AIRPROP reads: property_interests');
select is((select count(*)::integer from airprop.property_operating_models),0,'AAL1 hides sensitive AIRPROP reads: property_operating_models');
select set_config('request.jwt.claims',jsonb_build_object('sub','13400000-0000-0000-0000-000000000010','aal','aal2','active_tenant_id','13400000-0000-0000-0000-000000000001','active_context_id','13400000-0000-0000-0000-000010000001')::text,true);
select set_config('request.jwt.claims',jsonb_build_object('sub','13400000-0000-0000-0000-000000000010','aal','aal2','active_tenant_id','13400000-0000-0000-0000-000000000001','active_context_id','13400000-0000-0000-0000-000010000003')::text,true);
select is((select count(*)::integer from airprop.investment_opportunities),0,'another fully activated workspace cannot read subject: investment_opportunities');
select is((select count(*)::integer from airprop.underwriting_cases),0,'another fully activated workspace cannot read subject: underwriting_cases');
select is((select count(*)::integer from airprop.underwriting_versions),0,'another fully activated workspace cannot read subject: underwriting_versions');
select is((select count(*)::integer from airprop.property_interests),0,'another fully activated workspace cannot read subject: property_interests');
select is((select count(*)::integer from airprop.property_operating_models),0,'another fully activated workspace cannot read subject: property_operating_models');
select set_config('request.jwt.claims',jsonb_build_object('sub','13400000-0000-0000-0000-000000000010','aal','aal2','active_tenant_id','13400000-0000-0000-0000-000000000001','active_context_id','13400000-0000-0000-0000-000010000001')::text,true);
select set_config('request.jwt.claims',jsonb_build_object('sub','13400000-0000-0000-0000-000000000010','aal','aal2','active_tenant_id','13400000-0000-0000-0000-000000000002','active_context_id','13400000-0000-0000-0000-000010000001')::text,true);
select is((select count(*)::integer from airprop.investment_opportunities),0,'tenant claim mismatch hides subject: investment_opportunities');
select is((select count(*)::integer from airprop.underwriting_cases),0,'tenant claim mismatch hides subject: underwriting_cases');
select is((select count(*)::integer from airprop.underwriting_versions),0,'tenant claim mismatch hides subject: underwriting_versions');
select is((select count(*)::integer from airprop.property_interests),0,'tenant claim mismatch hides subject: property_interests');
select is((select count(*)::integer from airprop.property_operating_models),0,'tenant claim mismatch hides subject: property_operating_models');
select set_config('request.jwt.claims',jsonb_build_object('sub','13400000-0000-0000-0000-000000000010','aal','aal2','active_tenant_id','13400000-0000-0000-0000-000000000001','active_context_id','13400000-0000-0000-0000-000010000001')::text,true);
reset role;
update platform.workspace_entitlements set boolean_value=false where customer_workspace_id='13400000-0000-0000-0000-000000000100' and entitlement_key='module.airprop_commercial';
set local role authenticated;
select is((select count(*)::integer from airprop.investment_opportunities),0,'disabled entitlement hides reads: investment_opportunities');
select is((select count(*)::integer from airprop.underwriting_cases),0,'disabled entitlement hides reads: underwriting_cases');
select is((select count(*)::integer from airprop.underwriting_versions),0,'disabled entitlement hides reads: underwriting_versions');
select is((select count(*)::integer from airprop.property_interests),0,'disabled entitlement hides reads: property_interests');
select is((select count(*)::integer from airprop.property_operating_models),0,'disabled entitlement hides reads: property_operating_models');
reset role;
update platform.workspace_entitlements set boolean_value=true where customer_workspace_id='13400000-0000-0000-0000-000000000100' and entitlement_key='module.airprop_commercial';
update platform.workspace_modules set status='deactivated',valid_to=statement_timestamp(),deactivated_at=statement_timestamp()
where customer_workspace_id='13400000-0000-0000-0000-000000000100' and module_code='airprop_commercial';
set local role authenticated;
select is((select count(*)::integer from airprop.investment_opportunities),0,'inactive module hides reads: investment_opportunities');
select is((select count(*)::integer from airprop.underwriting_cases),0,'inactive module hides reads: underwriting_cases');
select is((select count(*)::integer from airprop.underwriting_versions),0,'inactive module hides reads: underwriting_versions');
select is((select count(*)::integer from airprop.property_interests),0,'inactive module hides reads: property_interests');
select is((select count(*)::integer from airprop.property_operating_models),0,'inactive module hides reads: property_operating_models');
reset role;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select tenant_id,customer_workspace_id,module_definition_id,module_code,'active','Synthetic AIRPROP read restoration'
from platform.workspace_modules where customer_workspace_id='13400000-0000-0000-0000-000000000100' and module_code='airprop_commercial' and status='deactivated';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','13400000-0000-0000-0000-000000000020','aal','aal2','active_tenant_id','13400000-0000-0000-0000-000000000001','active_context_id','13400000-0000-0000-0000-000010000002')::text,true);
select is((select count(*)::integer from airprop.investment_opportunities),0,'unassigned owner has no AIRPROP read permission: investment_opportunities');
select is((select count(*)::integer from airprop.underwriting_cases),0,'unassigned owner has no AIRPROP read permission: underwriting_cases');
select is((select count(*)::integer from airprop.underwriting_versions),0,'unassigned owner has no AIRPROP read permission: underwriting_versions');
select is((select count(*)::integer from airprop.property_interests),0,'unassigned owner has no AIRPROP read permission: property_interests');
select is((select count(*)::integer from airprop.property_operating_models),0,'unassigned owner has no AIRPROP read permission: property_operating_models');
reset role;
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from)
values('13400000-0000-0000-0000-000000000300','13400000-0000-0000-0000-000000000001','13400000-0000-0000-0000-000000000100','airprop_read_allow','AIRPROP read allow','property','13400000-0000-0000-0000-000000000010',statement_timestamp()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '13400000-0000-0000-0000-000000000001','13400000-0000-0000-0000-000000000300',id from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '13400000-0000-0000-0000-000000000001','13400000-0000-0000-0000-000000000300',id,'allow' from identity.permissions where code in('airprop.opportunity.read','airprop.asset.read');
update platform.workspace_roles set lifecycle_status='published' where id='13400000-0000-0000-0000-000000000300';
insert into platform.workspace_member_roles(tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,property_id,
assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('13400000-0000-0000-0000-000000000001','13400000-0000-0000-0000-000000000100','13400000-0000-0000-0000-000001000002','13400000-0000-0000-0000-000000000300','property','13400000-0000-0000-0000-000000001000','13400000-0000-0000-0000-000000000010','13400000-0000-0000-0000-000001000001','Synthetic AIRPROP read assignment',statement_timestamp()-interval '1 hour');
set local role authenticated;
select is((select count(*)::integer from airprop.investment_opportunities),1,'local allow applies to AIRPROP reads: investment_opportunities');
select is((select count(*)::integer from airprop.underwriting_cases),1,'local allow applies to AIRPROP reads: underwriting_cases');
select is((select count(*)::integer from airprop.underwriting_versions),1,'local allow applies to AIRPROP reads: underwriting_versions');
select is((select count(*)::integer from airprop.property_interests),1,'local allow applies to AIRPROP reads: property_interests');
select is((select count(*)::integer from airprop.property_operating_models),1,'local allow applies to AIRPROP reads: property_operating_models');
reset role;
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from)
values('13400000-0000-0000-0000-000000000301','13400000-0000-0000-0000-000000000001','13400000-0000-0000-0000-000000000100','airprop_read_deny','AIRPROP read deny','property','13400000-0000-0000-0000-000000000010',statement_timestamp()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '13400000-0000-0000-0000-000000000001','13400000-0000-0000-0000-000000000301',id from platform.module_definitions where code='airprop_commercial' and version=1;
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '13400000-0000-0000-0000-000000000001','13400000-0000-0000-0000-000000000301',id,'deny' from identity.permissions where code in('airprop.opportunity.read','airprop.asset.read');
update platform.workspace_roles set lifecycle_status='published' where id='13400000-0000-0000-0000-000000000301';
insert into platform.workspace_member_roles(tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,property_id,
assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('13400000-0000-0000-0000-000000000001','13400000-0000-0000-0000-000000000100','13400000-0000-0000-0000-000001000002','13400000-0000-0000-0000-000000000301','property','13400000-0000-0000-0000-000000001000','13400000-0000-0000-0000-000000000010','13400000-0000-0000-0000-000001000001','Synthetic AIRPROP read assignment',statement_timestamp()-interval '1 hour');
set local role authenticated;
select is((select count(*)::integer from airprop.investment_opportunities),0,'local deny applies to AIRPROP reads: investment_opportunities');
select is((select count(*)::integer from airprop.underwriting_cases),0,'local deny applies to AIRPROP reads: underwriting_cases');
select is((select count(*)::integer from airprop.underwriting_versions),0,'local deny applies to AIRPROP reads: underwriting_versions');
select is((select count(*)::integer from airprop.property_interests),0,'local deny applies to AIRPROP reads: property_interests');
select is((select count(*)::integer from airprop.property_operating_models),0,'local deny applies to AIRPROP reads: property_operating_models');
reset role;
update identity.context_grants set ends_at=statement_timestamp()-interval '1 second' where id='13400000-0000-0000-0000-000010000001';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','13400000-0000-0000-0000-000000000010','aal','aal2','active_tenant_id','13400000-0000-0000-0000-000000000001','active_context_id','13400000-0000-0000-0000-000010000001')::text,true);
select is((select count(*)::integer from airprop.investment_opportunities),0,'expired context hides reads: investment_opportunities');
select is((select count(*)::integer from airprop.underwriting_cases),0,'expired context hides reads: underwriting_cases');
select is((select count(*)::integer from airprop.underwriting_versions),0,'expired context hides reads: underwriting_versions');
select is((select count(*)::integer from airprop.property_interests),0,'expired context hides reads: property_interests');
select is((select count(*)::integer from airprop.property_operating_models),0,'expired context hides reads: property_operating_models');
reset role;
update identity.context_grants set ends_at=null where id='13400000-0000-0000-0000-000010000001';
insert into airprop.investment_opportunities(tenant_id,idempotency_key,name,country_code,city,asking_price,currency,input_hash,created_by)
values('13400000-0000-0000-0000-000000000001','AIRPROP-134-LEGACY','Synthetic legacy unbound','RO','București',100000,'RON','synthetic-unbound-hash','13400000-0000-0000-0000-000000000010');
set local role authenticated;
select is((select count(*)::integer from airprop.investment_opportunities),1,'legacy unbound opportunity remains hidden until explicit scope resolution');
select throws_ok($$insert into airprop.investment_opportunities(tenant_id,idempotency_key,name,country_code,city,asking_price,currency,input_hash,created_by) values('13400000-0000-0000-0000-000000000001','AIRPROP-134-DIRECT','Unauthorized direct','RO','București',100000,'RON','hash','13400000-0000-0000-0000-000000000010')$$,'42501',null,'read helper grants no direct insert access');
reset role;
select ok(has_function_privilege('authenticated','app_private.can_read_airprop_subject_v1(uuid,uuid,text)','execute'),'authenticated can evaluate RLS read predicate');
select ok(not has_function_privilege('anon','app_private.can_read_airprop_subject_v1(uuid,uuid,text)','execute'),'anonymous cannot evaluate private read predicate');
select * from finish();
rollback;
