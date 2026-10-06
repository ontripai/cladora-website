-- Actual canonical bootstrap, assignment, AIRPROP retry/read and expiry revocation.
begin;
select plan(42);
do $$
declare
  v_tenant_id uuid := '13500000-0000-0000-0000-000000000001'::uuid;
  v_tenant2_id uuid := '13500000-0000-0000-0000-000000000002'::uuid;
  v_user_admin_id uuid := '13500000-0000-0000-0000-000000000010'::uuid;
  v_user_member_id uuid := '13500000-0000-0000-0000-000000000020'::uuid;
  v_user_other_id uuid := '13500000-0000-0000-0000-000000000030'::uuid;
  v_ws_id uuid := '13500000-0000-0000-0000-000000000100'::uuid;
  v_ws2_id uuid := '13500000-0000-0000-0000-000000000200'::uuid;
  v_prop_id uuid := '13500000-0000-0000-0000-000000001000'::uuid;
  v_prop2_id uuid := '13500000-0000-0000-0000-000000002000'::uuid;
  v_bld_id uuid := '13500000-0000-0000-0000-000000010000'::uuid;
  v_bld2_id uuid := '13500000-0000-0000-0000-000000020000'::uuid;
  v_unit1_id uuid := '13500000-0000-0000-0000-000000100001'::uuid;
  v_unit2_id uuid := '13500000-0000-0000-0000-000000100002'::uuid;
  v_admin_role_id uuid;
  v_member_role_id uuid;
  v_mem_admin_id uuid := '13500000-0000-0000-0000-000001000001'::uuid;
  v_mem_target_id uuid := '13500000-0000-0000-0000-000001000002'::uuid;
  v_mem_other_id uuid := '13500000-0000-0000-0000-000001000003'::uuid;
  v_ctx_admin_id uuid := '13500000-0000-0000-0000-000010000001'::uuid;
  v_ctx_admin_ws2_id uuid := '13500000-0000-0000-0000-000010000003'::uuid;
  v_ctx_member_id uuid := '13500000-0000-0000-0000-000010000002'::uuid;
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
  insert into identity.context_grants (id, tenant_id, membership_id, scope_type, property_id, starts_at, ends_at) values
    (v_ctx_admin_id, v_tenant_id, v_mem_admin_id, 'property', v_prop_id, statement_timestamp() - interval '1 day', statement_timestamp() + interval '12 hours'),
    (v_ctx_admin_ws2_id, v_tenant_id, v_mem_admin_id, 'property', v_prop2_id, statement_timestamp() - interval '1 day', null),
    (v_ctx_member_id, v_tenant_id, v_mem_target_id, 'property', v_prop_id, statement_timestamp() - interval '1 day', null)
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
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at,ends_at)
 values ('13500000-0000-0000-0000-000010000004','13500000-0000-0000-0000-000000000001',
   '13500000-0000-0000-0000-000001000001','tenant',now()-interval '1 day',now()+interval '12 hours')
 on conflict(id) do nothing;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('13500000-0000-0000-0000-000010000010','13500000-0000-0000-0000-000000000001','13500000-0000-0000-0000-000001000002','tenant',now()-interval '1 day');
insert into auth.users(id,email) values ('13500000-0000-0000-0000-000000000040','ws_child@test.local') on conflict(id) do nothing;
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '13500000-0000-0000-0000-000001000004','13500000-0000-0000-0000-000000000001',
 '13500000-0000-0000-0000-000000000040',id,'active',now()-interval '1 day'
from identity.roles where code='owner' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at)
values ('13500000-0000-0000-0000-000010000005','13500000-0000-0000-0000-000000000001',
 '13500000-0000-0000-0000-000001000004','tenant',now()-interval '1 day');

insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
 select '13500000-0000-0000-0000-000000000001','13500000-0000-0000-0000-000000000100',id,code,'active','Synthetic AIRPROP flow'
 from platform.module_definitions where code='airprop_commercial';
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
 values('13500000-0000-0000-0000-000000000100','module.airprop_commercial','boolean',true,now()-interval '1 day');
-- Make this rollback-only flow an explicitly delegable AIRPROP fixture.
update platform.module_permission_bindings b
set lifecycle_status='deprecated', valid_to=statement_timestamp()
from platform.module_definitions md, identity.permissions p
where b.module_definition_id=md.id and b.permission_id=p.id
  and ((md.code='airprop_commercial' and p.code in ('airprop.opportunity.read','airprop.opportunity.manage'))
    or (md.code='maintenance' and p.code='maintenance.requests.read'))
  and b.lifecycle_status='active' and b.valid_to is null;
insert into platform.module_permission_bindings
 (module_definition_id,permission_id,binding_version,permission_mode,
  is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status,valid_from)
select md.id,p.id,coalesce(max(old.binding_version),0)+1,
       case when p.code like '%.read' then 'read' else 'manage' end,
       true,true,false,'active',statement_timestamp()
from platform.module_definitions md
join identity.permissions p on p.code in ('airprop.opportunity.read','airprop.opportunity.manage','maintenance.requests.read')
left join platform.module_permission_bindings old
  on old.module_definition_id=md.id and old.permission_id=p.id
where (md.code='airprop_commercial' and p.code in ('airprop.opportunity.read','airprop.opportunity.manage'))
   or (md.code='maintenance' and p.code='maintenance.requests.read')
group by md.id,p.id,p.code;
insert into identity.role_permissions(role_id,permission_id,effect)
select r.id,p.id,'allow'
from identity.roles r cross join identity.permissions p
where r.code='association_admin' and r.tenant_id is null and r.is_system
  and p.code in ('airprop.opportunity.read','airprop.opportunity.manage','maintenance.requests.read')
on conflict (role_id,permission_id) do update set effect='allow';
select set_config('request.jwt.claims','{"sub":"13500000-0000-0000-0000-000000000010","role":"authenticated","aal":"aal2"}',true);
select ok(not has_function_privilege('anon','customer_api.list_workspace_role_assignment_candidates_v1(uuid)','execute'),'anonymous cannot enumerate candidates');
select ok(not has_function_privilege('authenticated','app_private.require_workspace_role_assignment_context_v1(uuid)','execute'),'internal helper is not exposed');
select ok(jsonb_array_length(customer_api.list_workspace_role_assignment_candidates_v1('13500000-0000-0000-0000-000010000001')->'members')=2,'only active native-eligible tenant members other than the grantor are listed');
select set_config('request.jwt.claims','{"sub":"13500000-0000-0000-0000-000000000010","aal":"aal1"}',true);
select throws_ok($$select customer_api.list_workspace_role_assignment_candidates_v1('13500000-0000-0000-0000-000010000001')$$,'42501','mfa_required','candidate lookup requires AAL2');
select set_config('request.jwt.claims','{"sub":"13500000-0000-0000-0000-000000000010","aal":"aal2"}',true);
select lives_ok($flow$do $$
declare result jsonb; role_id uuid; version integer;
begin
 result=customer_api.create_workspace_role_draft_v1('13500000-0000-0000-0000-000010000001','airprop_flow_reader_writer','AIRPROP flow reader writer','Synthetic authorized flow','workspace',null,'Synthetic authorized flow','flow_create_135');
 role_id=(result->>'id')::uuid;
 perform customer_api.attach_workspace_role_module_v1('13500000-0000-0000-0000-000010000001',role_id,(select id from platform.module_definitions where code='airprop_commercial'),1,'Synthetic module attachment','flow_module_135');
 perform customer_api.attach_workspace_role_permission_v1('13500000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.opportunity.read'),'allow',2,'Synthetic read attachment','flow_read_135');
 perform customer_api.attach_workspace_role_permission_v1('13500000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.opportunity.manage'),'allow',3,'Synthetic manage attachment','flow_manage_135');
 perform customer_api.publish_workspace_role_v1('13500000-0000-0000-0000-000010000001',role_id,4,'Synthetic publish role','flow_publish_135');
end; $$;$flow$,'publish role through canonical commands');
select lives_ok($flow$do $
declare result jsonb; role_id uuid;
begin
 result=customer_api.create_workspace_role_draft_v1('13500000-0000-0000-0000-000010000001','airprop_flow_child_manager','AIRPROP flow child manager','Synthetic delegated child authority','workspace',null,'Synthetic child authority','flow_child_create_135');
 role_id=(result->>'id')::uuid;
 perform customer_api.attach_workspace_role_module_v1('13500000-0000-0000-0000-000010000001',role_id,(select id from platform.module_definitions where code='airprop_commercial'),1,'Attach child module','flow_child_module_135');
 perform customer_api.attach_workspace_role_permission_v1('13500000-0000-0000-0000-000010000001',role_id,(select id from identity.permissions where code='airprop.opportunity.manage'),'allow',2,'Attach child manage permission','flow_child_manage_135');
 perform customer_api.publish_workspace_role_v1('13500000-0000-0000-0000-000010000001',role_id,3,'Publish child role','flow_child_publish_135');
end; $$;$flow$,'publish narrower child role through canonical commands');
select lives_ok($$select customer_api.assign_workspace_role_v1('13500000-0000-0000-0000-000010000004','13500000-0000-0000-0000-000001000002',(select id from platform.workspace_roles where code='airprop_flow_reader_writer'),'workspace',null,null,null,now()+interval '1 day','Synthetic bounded assignment','flow_assign_135')$$,'assign published workspace role with future expiry');
select lives_ok($$select customer_api.assign_workspace_role_v1('13500000-0000-0000-0000-000010000004','13500000-0000-0000-0000-000001000002',(select id from platform.workspace_roles where code='airprop_flow_reader_writer'),'workspace',null,null,null,now()+interval '1 day','Synthetic bounded assignment','flow_assign_135')$$,'exact assignment retry succeeds');
select ok((select count(*) from platform.workspace_member_roles where membership_id='13500000-0000-0000-0000-000001000002')=1,'retry creates one assignment');
select ok((select assigned_by_context_grant_id='13500000-0000-0000-0000-000010000004'
  and authority_policy_version=2 from platform.workspace_member_roles
  where membership_id='13500000-0000-0000-0000-000001000002'),'assignment stores exact grantor context and policy version');
select ok((select valid_to=(select ends_at from identity.context_grants
  where id='13500000-0000-0000-0000-000010000004')
  from platform.workspace_member_roles where membership_id='13500000-0000-0000-0000-000001000002'),
  'assignment expiry is capped to the manager context');
select ok((select count(*)=2 and bool_and(source_kind='identity_role')
  from platform.workspace_member_role_authority_sources s
  join platform.workspace_member_roles a on a.id=s.assignment_id
  where a.membership_id='13500000-0000-0000-0000-000001000002'),
  'each delegated permission has an identity-role authority source');
insert into identity.role_permissions(role_id,permission_id,effect)
select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p
where r.code='owner' and r.tenant_id is null and r.is_system and p.code='workspace.role.assign'
on conflict(role_id,permission_id) do update set effect='allow';
select set_config('request.jwt.claims','{"sub":"13500000-0000-0000-0000-000000000020","aal":"aal2"}',true);
select lives_ok($$select customer_api.assign_workspace_role_v1(
 '13500000-0000-0000-0000-000010000010','13500000-0000-0000-0000-000001000004',
 (select id from platform.workspace_roles where code='airprop_flow_child_manager'),
 'workspace',null,null,null,now()+interval '1 day','Narrow delegated child role','flow_child_assign_135')$$,
 'manager with active parent role assigns a narrower child role');
select ok((select count(*)=1 and bool_and(source_kind='workspace_role_assignment' and s.authority_depth=1)
 from platform.workspace_member_role_authority_sources s
 join platform.workspace_member_roles a on a.id=s.assignment_id
 where a.membership_id='13500000-0000-0000-0000-000001000004'),
 'child permission cites the parent assignment at depth one');
select ok(app_private.check_effective_permission_v2(
 '13500000-0000-0000-0000-000010000005','airprop.opportunity.manage','airprop_commercial',
 'workspace','13500000-0000-0000-0000-000000000100','13500000-0000-0000-0000-000000000100'),
 'child role is effective while its parent authority remains active');
select set_config('request.jwt.claims','{"sub":"13500000-0000-0000-0000-000000000010","aal":"aal2"}',true);

update identity.role_permissions set effect='deny'
where role_id=(select role_id from identity.memberships where id='13500000-0000-0000-0000-000001000001')
  and permission_id=(select id from identity.permissions where code='airprop.opportunity.manage');
select set_config('request.jwt.claims','{"sub":"13500000-0000-0000-0000-000000000020","aal":"aal2"}',true);
select ok(not app_private.check_effective_permission_v2(
 '13500000-0000-0000-0000-000010000010','airprop.opportunity.manage','airprop_commercial',
 'workspace','13500000-0000-0000-0000-000000000100','13500000-0000-0000-0000-000000000100'),
 'grantor permission reduction immediately disables descendant access');
select ok(not app_private.check_effective_permission_v2(
 '13500000-0000-0000-0000-000010000005','airprop.opportunity.manage','airprop_commercial',
 'workspace','13500000-0000-0000-0000-000000000100','13500000-0000-0000-0000-000000000100'),
 'manager permission reduction immediately disables the child role');
update identity.role_permissions set effect='allow'
where role_id=(select role_id from identity.memberships where id='13500000-0000-0000-0000-000001000001')
  and permission_id=(select id from identity.permissions where code='airprop.opportunity.manage');
select ok(exists(select 1 from platform.workspace_member_role_authority_sources s
 join platform.workspace_member_roles a on a.id=s.assignment_id
 where a.membership_id='13500000-0000-0000-0000-000001000002'
 and s.source_kind='identity_role' and s.permission_id=(select id from identity.permissions where code='airprop.opportunity.manage')),
 'manager assignment stores its expected identity authority source');
select ok(exists(select 1 from platform.workspace_member_roles a
 where a.membership_id='13500000-0000-0000-0000-000001000002'
 and a.scope_type='workspace' and a.valid_to>statement_timestamp()
 and app_private.workspace_role_scope_contains_v1(a.scope_type,a.property_id,a.building_id,a.unit_id,'workspace',null,null,null)),
 'active manager assignment covers the exact workspace target');
select ok(exists(select 1 from platform.workspace_member_roles a
 join platform.workspace_role_permissions rp on rp.workspace_role_id=a.workspace_role_id
 join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
 where a.membership_id='13500000-0000-0000-0000-000001000002'
 and rp.permission_id=(select id from identity.permissions where code='airprop.opportunity.manage')
 and rp.effect='allow' and rm.module_definition_id=(select id from platform.module_definitions where code='airprop_commercial')),
 'manager role includes its exact allow permission and module');
select ok(app_private.workspace_role_identity_source_current_v1(
 (select assigned_by_context_grant_id from platform.workspace_member_roles where membership_id='13500000-0000-0000-0000-000001000002'),
 (select assigned_by_membership_id from platform.workspace_member_roles where membership_id='13500000-0000-0000-0000-000001000002'),
 (select source_identity_role_id from platform.workspace_member_role_authority_sources s join platform.workspace_member_roles a on a.id=s.assignment_id where a.membership_id='13500000-0000-0000-0000-000001000002' and s.permission_id=(select id from identity.permissions where code='airprop.opportunity.manage')),
 '13500000-0000-0000-0000-000000000001','13500000-0000-0000-0000-000000000100',
 (select id from identity.permissions where code='airprop.opportunity.manage'),
 (select id from platform.module_definitions where code='airprop_commercial'),'workspace',null),
 'manager identity source remains current for the workspace manage permission');
select ok(app_private.workspace_member_role_authority_active_v1(
 (select id from platform.workspace_member_roles where membership_id='13500000-0000-0000-0000-000001000002'),
 (select id from identity.permissions where code='airprop.opportunity.manage'),
 (select id from platform.module_definitions where code='airprop_commercial'),
 'workspace',null,'{}'::uuid[]), 'restored descendant lineage remains active');
select ok(app_private.native_workspace_scope_for_membership_v2(
 '13500000-0000-0000-0000-000010000010','13500000-0000-0000-0000-000001000002','13500000-0000-0000-0000-000000000100'), 'target tenant context resolves the exact assigned workspace');
select ok(app_private.check_effective_permission_v2(
 '13500000-0000-0000-0000-000010000010','airprop.opportunity.manage','airprop_commercial',
 'workspace','13500000-0000-0000-0000-000000000100','13500000-0000-0000-0000-000000000100'),
 'descendant access returns when grantor authority is restored');
select ok(app_private.check_effective_permission_v2(
 '13500000-0000-0000-0000-000010000005','airprop.opportunity.manage','airprop_commercial',
 'workspace','13500000-0000-0000-0000-000000000100','13500000-0000-0000-0000-000000000100'),
 'child role access returns when parent authority is restored');
select ok(exists(select 1 from audit.events where action='WORKSPACE_ROLE_ASSIGNED' and tenant_id='13500000-0000-0000-0000-000000000001'),'assignment audit contains tenant');
select set_config('request.jwt.claims','{"sub":"13500000-0000-0000-0000-000000000020","aal":"aal2"}',true);
select ok((select count(*) from customer_api.list_workspace_targets_v2('13500000-0000-0000-0000-000010000010'))=1,'assigned account discovers one exact workspace');
select lives_ok($$select customer_api.create_airprop_opportunity_v2('13500000-0000-0000-0000-000010000010','13500000-0000-0000-0000-000000000100','flow_opportunity_135','{"name":"Synthetic AIRPROP authorized flow","country_code":"RO","city":"Bucuresti","currency":"EUR","asking_price":"12.3400"}')$$,'authorized account creates native opportunity without physical subject');
select lives_ok($$select customer_api.create_airprop_opportunity_v2('13500000-0000-0000-0000-000010000010','13500000-0000-0000-0000-000000000100','flow_opportunity_135','{"name":"Synthetic AIRPROP authorized flow","country_code":"RO","city":"Bucuresti","currency":"EUR","asking_price":"12.3400"}')$$,'authorized opportunity retry succeeds');
select ok((select count(*) from airprop.investment_opportunities where workspace_id='13500000-0000-0000-0000-000000000100')=1,'retry creates one commercial record');
select ok(jsonb_array_length(customer_api.list_airprop_opportunities_v2('13500000-0000-0000-0000-000010000010','13500000-0000-0000-0000-000000000100',50)->'opportunities')=1,'account can read its native opportunity');
select throws_ok($$select customer_api.list_airprop_opportunities_v2('13500000-0000-0000-0000-000010000010','13500000-0000-0000-0000-000000000200',50)$$,'42501','workspace_native_context_access_denied','second workspace denied');
select set_config('request.jwt.claims','{"sub":"13500000-0000-0000-0000-000000000010","aal":"aal2"}',true);
select lives_ok($$select customer_api.revoke_workspace_role_assignment_v1('13500000-0000-0000-0000-000010000001',(select id from platform.workspace_member_roles where membership_id='13500000-0000-0000-0000-000001000002'),1,'Synthetic revoke before expiry','flow_revoke_135')$$,'future-expiring assignment can be revoked early');
select lives_ok($$select customer_api.revoke_workspace_role_assignment_v1('13500000-0000-0000-0000-000010000001',(select id from platform.workspace_member_roles where membership_id='13500000-0000-0000-0000-000001000002'),1,'Synthetic revoke before expiry','flow_revoke_135')$$,'revocation exact retry succeeds');
select set_config('request.jwt.claims','{"sub":"13500000-0000-0000-0000-000000000040","aal":"aal2"}',true);
select ok(not app_private.check_effective_permission_v2(
 '13500000-0000-0000-0000-000010000005','airprop.opportunity.manage','airprop_commercial',
 'workspace','13500000-0000-0000-0000-000000000100','13500000-0000-0000-0000-000000000100'),
 'revoking the parent role immediately removes child authority');
select set_config('request.jwt.claims','{"sub":"13500000-0000-0000-0000-000000000010","aal":"aal2"}',true);

select ok((select lock_version from platform.workspace_member_roles where membership_id='13500000-0000-0000-0000-000001000002')=2,'revocation retry increments version once');
select set_config('request.jwt.claims','{"sub":"13500000-0000-0000-0000-000000000020","aal":"aal2"}',true);
select ok((select count(*) from customer_api.list_workspace_targets_v2('13500000-0000-0000-0000-000010000010'))=0,'revocation removes workspace discovery');
select throws_ok($$select customer_api.create_airprop_opportunity_v2('13500000-0000-0000-0000-000010000010','13500000-0000-0000-0000-000000000100','flow_opportunity_135','{"name":"Synthetic AIRPROP authorized flow","country_code":"RO","city":"Bucuresti","currency":"EUR","asking_price":"12.3400"}')$$,'42501','workspace_native_context_access_denied','revoked account cannot replay successful commercial command');
select throws_ok($$select customer_api.list_workspace_role_assignment_candidates_v1('13500000-0000-0000-0000-000010000001')$$,'42501','customer_context_access_denied','foreign actor cannot enumerate members');
select ok(not exists(select 1 from platform.workspace_member_roles where membership_id='13500000-0000-0000-0000-000001000002' and valid_to>statement_timestamp()),'revocation does not retain future access');
select ok((select count(*) from platform.outbox_events where tenant_id='13500000-0000-0000-0000-000000000001' and event_type='workspace.role.assigned.v1')=2,'parent and child assignments publish shared events');
select ok((select count(*) from platform.outbox_events where tenant_id='13500000-0000-0000-0000-000000000001' and event_type='workspace.role.assignment.revoked.v1')=1,'revocation publishes one shared event');
select * from finish();
rollback;
