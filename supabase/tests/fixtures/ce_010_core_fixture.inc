-- Synthetic, transaction-local Core fixture. Never included by the proposal.
-- Real canonical C01/C02/C03 functions remain in use; no authority stubs.
create function pg_temp.ce010_id(n integer) returns uuid language sql immutable as $$
 select ('17300000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid
$$;
insert into auth.users(id,email) values
 (pg_temp.ce010_id(10),'ce010_manager@test.local'),(pg_temp.ce010_id(11),'ce010_member@test.local'),
 (pg_temp.ce010_id(12),'ce010_other_actor@test.local'),(pg_temp.ce010_id(13),'ce010_other_tenant@test.local');
insert into platform.tenants(id,legal_name,registration_number,status) values
 (pg_temp.ce010_id(1),'CE010 synthetic tenant','CE010-TEST-A','active'),
 (pg_temp.ce010_id(2),'CE010 second synthetic tenant','CE010-TEST-B','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values
 (pg_temp.ce010_id(20),pg_temp.ce010_id(1),'ASSOCIATION','CE010 fixture','PILOT','ACTIVE'),
 (pg_temp.ce010_id(21),pg_temp.ce010_id(1),'ASSOCIATION','CE010 fixture','PILOT','ACTIVE'),
 (pg_temp.ce010_id(22),pg_temp.ce010_id(2),'ASSOCIATION','CE010 fixture','PILOT','ACTIVE');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select pg_temp.ce010_id(30),pg_temp.ce010_id(1),pg_temp.ce010_id(10),id,'active'::identity.membership_status,now()-interval '1 day' from identity.roles where code='association_admin' and tenant_id is null
union all select pg_temp.ce010_id(31),pg_temp.ce010_id(1),pg_temp.ce010_id(11),id,'active'::identity.membership_status,now()-interval '1 day' from identity.roles where code='owner' and tenant_id is null
union all select pg_temp.ce010_id(32),pg_temp.ce010_id(1),pg_temp.ce010_id(12),id,'active'::identity.membership_status,now()-interval '1 day' from identity.roles where code='association_admin' and tenant_id is null
union all select pg_temp.ce010_id(33),pg_temp.ce010_id(2),pg_temp.ce010_id(13),id,'active'::identity.membership_status,now()-interval '1 day' from identity.roles where code='association_admin' and tenant_id is null;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at)
select pg_temp.ce010_id(40+n),case when n=3 then pg_temp.ce010_id(2) else pg_temp.ce010_id(1) end,pg_temp.ce010_id(30+n),'tenant',now()-interval '1 day'
from generate_series(0,3) n;
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,lifecycle_status,valid_from,created_by) values
 (pg_temp.ce010_id(50),pg_temp.ce010_id(1),pg_temp.ce010_id(20),'ce010_fixture_scope','CE010 fixture scope','workspace','published',now()-interval '1 day',pg_temp.ce010_id(10)),
 (pg_temp.ce010_id(51),pg_temp.ce010_id(1),pg_temp.ce010_id(21),'ce010_fixture_scope','CE010 fixture scope','workspace','published',now()-interval '1 day',pg_temp.ce010_id(10)),
 (pg_temp.ce010_id(52),pg_temp.ce010_id(2),pg_temp.ce010_id(22),'ce010_fixture_scope','CE010 fixture scope','workspace','published',now()-interval '1 day',pg_temp.ce010_id(13));
insert into platform.workspace_member_roles(tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,valid_from,assigned_by_user_id,assigned_by_membership_id,reason) values
 (pg_temp.ce010_id(1),pg_temp.ce010_id(20),pg_temp.ce010_id(30),pg_temp.ce010_id(50),'workspace',now()-interval '1 day',pg_temp.ce010_id(10),pg_temp.ce010_id(30),'Synthetic CE010 fixture'),
 (pg_temp.ce010_id(1),pg_temp.ce010_id(20),pg_temp.ce010_id(31),pg_temp.ce010_id(50),'workspace',now()-interval '1 day',pg_temp.ce010_id(10),pg_temp.ce010_id(30),'Synthetic CE010 fixture'),
 (pg_temp.ce010_id(1),pg_temp.ce010_id(20),pg_temp.ce010_id(32),pg_temp.ce010_id(50),'workspace',now()-interval '1 day',pg_temp.ce010_id(10),pg_temp.ce010_id(30),'Synthetic CE010 fixture'),
 (pg_temp.ce010_id(1),pg_temp.ce010_id(21),pg_temp.ce010_id(30),pg_temp.ce010_id(51),'workspace',now()-interval '1 day',pg_temp.ce010_id(10),pg_temp.ce010_id(30),'Synthetic CE010 fixture'),
 (pg_temp.ce010_id(2),pg_temp.ce010_id(22),pg_temp.ce010_id(33),pg_temp.ce010_id(52),'workspace',now()-interval '1 day',pg_temp.ce010_id(13),pg_temp.ce010_id(33),'Synthetic CE010 fixture');

-- Proposed mapping is installed only in this rollback/local synthetic fixture.
insert into identity.permissions(code,resource,action,description) values
 ('community.community.read','community.community','read','Synthetic CE010 proposed read mapping'),
 ('community.community.manage','community.community','manage','Synthetic CE010 proposed manage mapping'),
 ('community.announcement.publish','community.announcement','publish','Synthetic CE010 proposed publish mapping'),
 ('community.report.create','community.report','create','Synthetic CE010 proposed report mapping'),
 ('community.report.decide','community.report','decide','Synthetic CE010 proposed decide mapping');
insert into platform.module_definitions(code,version,name,labels_json,description,category,lifecycle_status,entitlement_key,published_at)
values('community_basic',1,'CE010 fixture','{"ro":"Comunitate","en":"Community","fa":"جامعه"}',
 'Synthetic proposed mapping, not Core acceptance','services','published','module.community_basic',now());
insert into platform.module_permission_bindings(module_definition_id,permission_id,permission_mode,is_delegable,requires_aal2)
select m.id,p.id,case when p.action='read' then 'read' else 'manage' end,false,false
from platform.module_definitions m cross join identity.permissions p where m.code='community_basic' and p.code like 'community.%';
insert into platform.module_property_profile_compatibilities(module_definition_id,property_profile_id,compatibility_level,reason)
select m.id,p.id,'compatible','Synthetic CE010 fixture' from platform.module_definitions m cross join platform.property_profiles p where m.code='community_basic';
insert into platform.module_operating_model_compatibilities(module_definition_id,operating_model_id,compatibility_level,reason)
select m.id,o.id,'compatible','Synthetic CE010 fixture' from platform.module_definitions m cross join platform.operating_models o where m.code='community_basic';
insert into platform.workspace_taxonomy_assignments(tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select w.tenant_id,w.id,p.id,o.id,'active',now()-interval '1 day',case when w.id=pg_temp.ce010_id(22) then pg_temp.ce010_id(13) else pg_temp.ce010_id(10) end,'RO'
from platform.customer_workspaces w cross join platform.property_profiles p cross join platform.operating_models o
where w.id in (pg_temp.ce010_id(20),pg_temp.ce010_id(21),pg_temp.ce010_id(22))
 and p.code='residential_condominium' and p.version=1 and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select w.tenant_id,w.id,m.id,m.code,'active','Synthetic independent CE010 activation' from platform.customer_workspaces w cross join platform.module_definitions m
where w.id in (pg_temp.ce010_id(20),pg_temp.ce010_id(21),pg_temp.ce010_id(22)) and m.code='community_basic';
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
select pg_temp.ce010_id(n),'module.community_basic','boolean',true,now()-interval '1 day' from generate_series(20,22) n;
insert into identity.role_permissions(role_id,permission_id,effect)
select r.id,p.id,'allow' from identity.roles r cross join identity.permissions p where r.tenant_id is null
 and ((r.code='association_admin' and p.code like 'community.%') or (r.code='owner' and p.code in ('community.community.read','community.report.create')));
