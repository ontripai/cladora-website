-- CLADORA DW-01A runtime pgTAP contract, v1.2.
-- Runs only inside the disposable database created by `supabase test db`.
begin;
select plan(25);

select has_function('customer_api','get_workspace_capability_snapshot_v1',array['uuid','uuid'],'reader has exactly context_id + workspace_id');
select ok(not has_function_privilege('anon','customer_api.get_workspace_capability_snapshot_v1(uuid,uuid)','EXECUTE'),'anon denied');
select ok(has_function_privilege('authenticated','customer_api.get_workspace_capability_snapshot_v1(uuid,uuid)','EXECUTE'),'authenticated may call bounded RPC');
select ok(not has_function_privilege('service_role','customer_api.get_workspace_capability_snapshot_v1(uuid,uuid)','EXECUTE'),'service_role direct call denied');

-- Real callers: an aggregate-authorized administrator and a caller with valid
-- Workspace access but without workspace.role.read/manage.
insert into auth.users(id,email) values
 ('d1010000-0000-4000-8000-000000000001','dw01a-admin@test.local'),
 ('d1010000-0000-4000-8000-000000000002','dw01a-limited@test.local');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('d1010000-0000-4000-8000-000000000010','DW01A tenant A','DW01A-A','active'),
 ('d1010000-0000-4000-8000-000000000020','DW01A tenant B','DW01A-B','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('d1010000-0000-4000-8000-000000000101','d1010000-0000-4000-8000-000000000010','ASSOCIATION','DW01A A','ACTIVE'),
 ('d1010000-0000-4000-8000-000000000102','d1010000-0000-4000-8000-000000000010','ASSOCIATION','DW01A A2','ACTIVE'),
 ('d1010000-0000-4000-8000-000000000201','d1010000-0000-4000-8000-000000000020','ASSOCIATION','DW01A B','ACTIVE');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('d1010000-0000-4000-8000-000000001101','d1010000-0000-4000-8000-000000000010','condominium','DW01A resource 1','active'),
 ('d1010000-0000-4000-8000-000000001102','d1010000-0000-4000-8000-000000000010','condominium','DW01A resource 2','active');
insert into platform.workspace_property_bindings(tenant_id,customer_workspace_id,property_id,status,binding_source,valid_from) values
 ('d1010000-0000-4000-8000-000000000010','d1010000-0000-4000-8000-000000000101','d1010000-0000-4000-8000-000000001101','active','platform_assignment',statement_timestamp()-interval '1 day'),
 ('d1010000-0000-4000-8000-000000000010','d1010000-0000-4000-8000-000000000101','d1010000-0000-4000-8000-000000001102','active','platform_assignment',statement_timestamp()-interval '1 day');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
values
 ('d1010000-0000-4000-8000-000000000301','d1010000-0000-4000-8000-000000000010','d1010000-0000-4000-8000-000000000001',(select id from identity.roles where code='association_admin' and tenant_id is null and is_system),'active',statement_timestamp()-interval '1 day'),
 ('d1010000-0000-4000-8000-000000000302','d1010000-0000-4000-8000-000000000010','d1010000-0000-4000-8000-000000000002',(select id from identity.roles where code='owner' and tenant_id is null and is_system),'active',statement_timestamp()-interval '1 day');
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000010','d1010000-0000-4000-8000-000000000301','tenant',statement_timestamp()-interval '1 day'),
 ('d1010000-0000-4000-8000-000000000402','d1010000-0000-4000-8000-000000000010','d1010000-0000-4000-8000-000000000302','tenant',statement_timestamp()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,lifecycle_status,created_by,valid_from) values
 ('d1010000-0000-4000-8000-000000000501','d1010000-0000-4000-8000-000000000010','d1010000-0000-4000-8000-000000000101','dw01a_admin','DW01A admin','workspace','published','d1010000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day'),
 ('d1010000-0000-4000-8000-000000000502','d1010000-0000-4000-8000-000000000010','d1010000-0000-4000-8000-000000000101','dw01a_limited','DW01A limited','workspace','published','d1010000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day'),
 ('d1010000-0000-4000-8000-000000000503','d1010000-0000-4000-8000-000000000010','d1010000-0000-4000-8000-000000000102','dw01a_admin_2','DW01A admin 2','workspace','published','d1010000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
insert into platform.workspace_member_roles(tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,assigned_by_user_id,assigned_by_membership_id,reason,valid_from) values
 ('d1010000-0000-4000-8000-000000000010','d1010000-0000-4000-8000-000000000101','d1010000-0000-4000-8000-000000000301','d1010000-0000-4000-8000-000000000501','workspace','d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000301','fixture',statement_timestamp()-interval '1 hour'),
 ('d1010000-0000-4000-8000-000000000010','d1010000-0000-4000-8000-000000000101','d1010000-0000-4000-8000-000000000302','d1010000-0000-4000-8000-000000000502','workspace','d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000301','fixture',statement_timestamp()-interval '1 hour'),
 ('d1010000-0000-4000-8000-000000000010','d1010000-0000-4000-8000-000000000102','d1010000-0000-4000-8000-000000000301','d1010000-0000-4000-8000-000000000503','workspace','d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000301','fixture',statement_timestamp()-interval '1 hour');

-- Workspace A intentionally has no taxonomy.
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select 'd1010000-0000-4000-8000-000000000010','d1010000-0000-4000-8000-000000000101',id,code,'active','fixture' from platform.module_definitions where code in ('maintenance','documents','security');
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from,valid_until,override_value_json,override_expires_at) values
 ('d1010000-0000-4000-8000-000000000101','module.maintenance','boolean',true,statement_timestamp()-interval '2 days',null,null,null),
 ('d1010000-0000-4000-8000-000000000101','module.documents','boolean',true,statement_timestamp()-interval '2 days',statement_timestamp()-interval '1 day',null,null),
 ('d1010000-0000-4000-8000-000000000101','module.security','boolean',false,statement_timestamp()-interval '2 days',null,'true'::jsonb,statement_timestamp()+interval '1 day');

create function pg_temp.dw01a_snapshot(p_user uuid,p_context uuid,p_workspace uuid) returns jsonb language plpgsql as $$
begin
 perform set_config('request.jwt.claims',jsonb_build_object('sub',p_user,'role','authenticated','aal','aal2')::text,true);
 return customer_api.get_workspace_capability_snapshot_v1(p_context,p_workspace);
end $$;
create function pg_temp.dw01a_has_forbidden_refs(p jsonb) returns boolean language sql immutable as $$ select
 jsonb_path_exists(p,'$.resources.resource_ids[*]') or jsonb_path_exists(p,'$.resources.visible_count ? (@ != null)')
 or jsonb_path_exists(p,'$.resources.total_count ? (@ != null)') or jsonb_path_exists(p,'$.capabilities[*].module.definition_id ? (@ != null)')
 or jsonb_path_exists(p,'$.capabilities[*].module.activation_id ? (@ != null)') or jsonb_path_exists(p,'$.capabilities[*].entitlement.entitlement_id ? (@ != null)')
 or jsonb_path_exists(p,'$.capabilities[*].entitlement.contract.status ? (@ != null)') or jsonb_path_exists(p,'$.capabilities[*].entitlement.contract.contract_id ? (@ != null)')
 or jsonb_path_exists(p,'$.capabilities[*].entitlement.contract.contract_ref ? (@ != null)') or jsonb_path_exists(p,'$.capabilities[*].entitlement.contract.contract_version ? (@ != null)')
 or jsonb_path_exists(p,'$.capabilities[*].restrictions[*].resource_id ? (@ != null)') or jsonb_path_exists(p,'$.capabilities[*].restrictions[*].source_id ? (@ != null)')
 or jsonb_path_exists(p,'$.capabilities[*].restrictions[*].source_version ? (@ != null)'); $$;

select is((pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000101')->>'reference_visibility'),'count_only','authorized reader gets count_only');
select is((pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000101')#>>'{resources,visible_count}')::integer,2,'authorized reader sees resource count');

update identity.role_permissions rp set effect='deny'
from identity.roles r,identity.permissions p
where rp.role_id=r.id and rp.permission_id=p.id
  and r.code='association_admin' and r.tenant_id is null and r.is_system
  and p.code in ('workspace.role.read','workspace.role.manage');
select is((pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000101')->>'reference_visibility'),'withheld','explicit denies take precedence over existing allows');
update identity.role_permissions rp set effect='allow'
from identity.roles r,identity.permissions p
where rp.role_id=r.id and rp.permission_id=p.id
  and r.code='association_admin' and r.tenant_id is null and r.is_system
  and p.code in ('workspace.role.read','workspace.role.manage');

delete from identity.role_permissions rp
using identity.roles r,identity.permissions p
where rp.role_id=r.id and rp.permission_id=p.id
  and r.code='association_admin' and r.tenant_id is null and r.is_system
  and p.code in ('workspace.role.read','workspace.role.manage');
select is((pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000101')->>'reference_visibility'),'withheld','permission revocation is effective on the next evaluation');
insert into identity.role_permissions(role_id,permission_id,effect)
select r.id,p.id,'allow'
from identity.roles r cross join identity.permissions p
where r.code='association_admin' and r.tenant_id is null and r.is_system
  and p.code in ('workspace.role.read','workspace.role.manage')
on conflict (role_id,permission_id) do update set effect=excluded.effect;

select is((pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000002','d1010000-0000-4000-8000-000000000402','d1010000-0000-4000-8000-000000000101')->>'reference_visibility'),'withheld','Workspace access alone is withheld');
select ok(not pg_temp.dw01a_has_forbidden_refs(pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000002','d1010000-0000-4000-8000-000000000402','d1010000-0000-4000-8000-000000000101')),'withheld real RPC leaks no count, ID, contract status or source');
select is(pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000101')#>>'{taxonomy,status}','not_configured','taxonomy absence reported');
select is((select c->>'workspace_state' from jsonb_array_elements(pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000101')->'capabilities') c where c->>'capability_key'='module.maintenance'),'available','valid legacy remains available without taxonomy');
select is((select c#>>'{entitlement,provenance}' from jsonb_array_elements(pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000101')->'capabilities') c where c->>'capability_key'='module.maintenance'),'legacy_unprovenanced','null contract_id is not guessed');
select is((select c->>'workspace_state' from jsonb_array_elements(pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000101')->'capabilities') c where c->>'capability_key'='module.documents'),'inactive','expired entitlement ineffective');
select is((select (c#>>'{entitlement,override_active}')::boolean from jsonb_array_elements(pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000101')->'capabilities') c where c->>'capability_key'='module.security'),true,'true override follows existing predicate');
select is((select (c#>>'{entitlement,currently_effective}')::boolean from jsonb_array_elements(pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000101')->'capabilities') c where c->>'capability_key'='module.security'),
 (select exists(select 1 from platform.workspace_entitlements e where e.customer_workspace_id='d1010000-0000-4000-8000-000000000101' and e.entitlement_key='module.security' and e.valid_from<=statement_timestamp() and (e.valid_until is null or e.valid_until>statement_timestamp()) and (case when e.override_value_json is not null and e.override_expires_at>statement_timestamp() then e.override_value_json='true'::jsonb else (e.boolean_value is true or e.numeric_value>0) end))),'RPC equals existing evaluator predicate');
select isnt((pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000101')->'capabilities')::text,(pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000102')->'capabilities')::text,'same workspace_type can have different composition');
select throws_ok($$select pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000201')$$,'42501','workspace_capability_context_access_denied','cross-tenant denied');
select ok((select bool_and(c->>'action_authorization'='not_evaluated') from jsonb_array_elements(pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000101')->'capabilities') c),'availability never becomes action authority');

create temporary table dw01a_before as select (select count(*) from platform.workspace_taxonomy_assignments) taxonomy_n,(select count(*) from platform.workspace_modules) modules_n,(select count(*) from platform.workspace_entitlements) entitlements_n,(select count(*) from audit.events) audit_n,(select count(*) from platform.outbox_events) outbox_n;
do $$ begin perform pg_temp.dw01a_snapshot('d1010000-0000-4000-8000-000000000001','d1010000-0000-4000-8000-000000000401','d1010000-0000-4000-8000-000000000101'); end $$;
select is((select row(taxonomy_n,modules_n,entitlements_n,audit_n,outbox_n)::text from dw01a_before),row((select count(*) from platform.workspace_taxonomy_assignments),(select count(*) from platform.workspace_modules),(select count(*) from platform.workspace_entitlements),(select count(*) from audit.events),(select count(*) from platform.outbox_events))::text,'real RPC performs zero writes');

-- Text inspection is complementary, not a substitute for fixtures above.
select is((select p.provolatile::text from pg_proc p where p.oid='customer_api.get_workspace_capability_snapshot_v1(uuid,uuid)'::regprocedure),'s','reader is STABLE');
select ok(pg_get_functiondef('customer_api.get_workspace_capability_snapshot_v1(uuid,uuid)'::regprocedure) like '%resolve_workspace_native_context_v2%','canonical two-parameter resolver used');
select ok(pg_get_functiondef('customer_api.get_workspace_capability_snapshot_v1(uuid,uuid)'::regprocedure) not like '%insert into%','function has no INSERT');
select ok(pg_get_functiondef('customer_api.get_workspace_capability_snapshot_v1(uuid,uuid)'::regprocedure) not like '%update %','function has no UPDATE');
select ok(pg_get_functiondef('customer_api.get_workspace_capability_snapshot_v1(uuid,uuid)'::regprocedure) not like '%delete from%','function has no DELETE');
select * from finish();
rollback;
