-- Actual canonical bootstrap, assignment, AIRPROP retry/read and expiry revocation.
begin;
select plan(15);
do $$
declare
  v_tenant_id uuid := '14600000-0000-0000-0000-000000000001'::uuid;
  v_tenant2_id uuid := '14600000-0000-0000-0000-000000000002'::uuid;
  v_user_admin_id uuid := '14600000-0000-0000-0000-000000000010'::uuid;
  v_user_member_id uuid := '14600000-0000-0000-0000-000000000020'::uuid;
  v_user_other_id uuid := '14600000-0000-0000-0000-000000000030'::uuid;
  v_ws_id uuid := '14600000-0000-0000-0000-000000000100'::uuid;
  v_ws2_id uuid := '14600000-0000-0000-0000-000000000200'::uuid;
  v_prop_id uuid := '14600000-0000-0000-0000-000000001000'::uuid;
  v_prop2_id uuid := '14600000-0000-0000-0000-000000002000'::uuid;
  v_bld_id uuid := '14600000-0000-0000-0000-000000010000'::uuid;
  v_bld2_id uuid := '14600000-0000-0000-0000-000000020000'::uuid;
  v_unit1_id uuid := '14600000-0000-0000-0000-000000100001'::uuid;
  v_unit2_id uuid := '14600000-0000-0000-0000-000000100002'::uuid;
  v_admin_role_id uuid;
  v_member_role_id uuid;
  v_mem_admin_id uuid := '14600000-0000-0000-0000-000001000001'::uuid;
  v_mem_target_id uuid := '14600000-0000-0000-0000-000001000002'::uuid;
  v_mem_other_id uuid := '14600000-0000-0000-0000-000001000003'::uuid;
  v_ctx_admin_id uuid := '14600000-0000-0000-0000-000010000001'::uuid;
  v_ctx_admin_ws2_id uuid := '14600000-0000-0000-0000-000010000003'::uuid;
  v_ctx_member_id uuid := '14600000-0000-0000-0000-000010000002'::uuid;
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
    (v_tenant_id, 'Test Tenant 135', 'RO-TEST-135-A', 'active'),
    (v_tenant2_id, 'Test Tenant 135 B', 'RO-TEST-135-B', 'active')
  on conflict (id) do nothing;

  -- Workspaces
  insert into platform.customer_workspaces (id, tenant_id, workspace_type, commercial_owner, environment, lifecycle_status) values
    (v_ws_id, v_tenant_id, 'ASSOCIATION', 'Owner 135', 'PILOT', 'ACTIVE'),
    (v_ws2_id, v_tenant_id, 'ASSOCIATION', 'Owner 135 B', 'PILOT', 'ACTIVE')
  on conflict (id) do nothing;

  -- Properties, Buildings, Units
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    (v_prop_id, v_tenant_id, 'condominium', 'Property 135 A', 'active'),
    (v_prop2_id, v_tenant_id, 'condominium', 'Property 135 B', 'active')
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
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('14600000-0000-0000-0000-000010000010','14600000-0000-0000-0000-000000000001','14600000-0000-0000-0000-000001000002','tenant',now()-interval '1 day');
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('14600000-0000-0000-0000-000010000011','14600000-0000-0000-0000-000000000001','14600000-0000-0000-0000-000001000001','tenant',now()-interval '1 day');
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
 select '14600000-0000-0000-0000-000000000001','14600000-0000-0000-0000-000000000100',id,code,'active','Synthetic AIRPROP flow'
 from platform.module_definitions where code='airprop_commercial';
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
 values('14600000-0000-0000-0000-000000000100','module.airprop_commercial','boolean',true,now()-interval '1 day');
select set_config('request.jwt.claims','{"sub":"14600000-0000-0000-0000-000000000010","role":"authenticated","aal":"aal2"}',true);
select lives_ok($flow$do $$
declare result jsonb; role_id uuid; version integer;
begin
 result=customer_api.create_workspace_role_draft_v1('14600000-0000-0000-0000-000010000001','airprop_diligence_writer','AIRPROP flow reader writer','Synthetic authorized flow','workspace',null,'Synthetic authorized flow','flow_create_146');
 role_id=(result->>'id')::uuid;
 perform customer_api.attach_workspace_role_module_v1('14600000-0000-0000-0000-000010000001',role_id,(select id from platform.module_definitions where code='airprop_commercial'),1,'Synthetic module attachment','flow_module_146');
 perform customer_api.attach_workspace_role_permission_v1('14600000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.opportunity.read'),'allow',2,'Synthetic read attachment','flow_read_146');
 perform customer_api.attach_workspace_role_permission_v1('14600000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.opportunity.manage'),'allow',3,'Synthetic manage attachment','flow_manage_146');
 perform customer_api.attach_workspace_role_permission_v1('14600000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.underwriting.manage'),'allow',4,'Synthetic underwriting attachment','flow_underwriting_146');
 perform customer_api.attach_workspace_role_permission_v1('14600000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.diligence.manage'),'allow',5,'Synthetic diligence attachment','flow_diligence_146');
 perform customer_api.publish_workspace_role_v1('14600000-0000-0000-0000-000010000001',role_id,6,'Synthetic publish role','flow_publish_146');
end; $$;$flow$,'publish role through canonical commands');
select lives_ok($$select customer_api.assign_workspace_role_v1('14600000-0000-0000-0000-000010000011','14600000-0000-0000-0000-000001000002',(select id from platform.workspace_roles where code='airprop_diligence_writer'),'workspace',null,null,null,now()+interval '1 day','Synthetic bounded assignment','diligence_assign_146')$$,'assign explicit diligence role');
select set_config('request.jwt.claims','{"sub":"14600000-0000-0000-0000-000000000020","aal":"aal2"}',true);
select lives_ok($$select customer_api.create_airprop_opportunity_v2('14600000-0000-0000-0000-000010000010','14600000-0000-0000-0000-000000000100','diligence_opportunity_146','{"name":"Synthetic diligence flow","country_code":"RO","city":"Bucuresti","currency":"EUR","asking_price":"100000"}')$$,'create native opportunity');
create temporary table diligence_test_response(result jsonb);
select lives_ok($$select customer_api.create_airprop_underwriting_v2('14600000-0000-0000-0000-000010000010','14600000-0000-0000-0000-000000000100',(select id from airprop.investment_opportunities where workspace_id='14600000-0000-0000-0000-000000000100'),'diligence_eval_146',0,'{"acquisition_cost":"100000","annual_rent":"8000","annual_opex":"1000","currency":"EUR"}')$$,'evaluate exact baseline');
select lives_ok($$insert into diligence_test_response select customer_api.create_airprop_diligence_draft_v1('14600000-0000-0000-0000-000010000010','14600000-0000-0000-0000-000000000100',(select id from airprop.investment_opportunities where workspace_id='14600000-0000-0000-0000-000000000100'),1,'diligence_draft_146')$$,'create exact-version draft through gateway');
select is((select count(*) from airprop.diligence_cases where tenant_id='14600000-0000-0000-0000-000000000001'),1::bigint,'one draft');
select ok((select result->>'status'='draft' and result->>'underwriting_version'='1' from diligence_test_response),'draft exact baseline');
select ok(customer_api.create_airprop_diligence_draft_v1('14600000-0000-0000-0000-000010000010','14600000-0000-0000-0000-000000000100',(select id from airprop.investment_opportunities where workspace_id='14600000-0000-0000-0000-000000000100'),1,'diligence_draft_146')->>'idempotent'='true','same-key replay');
select is((select count(*) from audit.events where tenant_id='14600000-0000-0000-0000-000000000001' and action='AIRPROP_DILIGENCE_DRAFT_CREATED'),1::bigint,'one audit');
select is((select count(*) from platform.outbox_events where tenant_id='14600000-0000-0000-0000-000000000001' and event_type='airprop.diligence.draft_created.v1'),1::bigint,'one outbox event');
select throws_ok($$update airprop.diligence_cases set status='draft'$$,'22023','airprop_diligence_draft_immutable','immutable initial draft');
select ok(not has_table_privilege('authenticated','airprop.diligence_cases','SELECT'),'no direct customer read');
select ok(not has_function_privilege('service_role','customer_api.create_airprop_diligence_draft_v1(uuid,uuid,uuid,integer,text)','EXECUTE'),'no privileged client execute');
select set_config('request.jwt.claims','{"sub":"14600000-0000-0000-0000-000000000020","aal":"aal1"}',true);
select throws_ok($$select customer_api.list_airprop_diligence_drafts_v1('14600000-0000-0000-0000-000010000010','14600000-0000-0000-0000-000000000100',(select id from airprop.investment_opportunities where workspace_id='14600000-0000-0000-0000-000000000100'))$$,'42501','mfa_required','draft read requires MFA');
select lives_ok($$select app_private.validate_airprop_module_bindings_v1()$$,'current exact module manifest');
select * from finish();
rollback;
