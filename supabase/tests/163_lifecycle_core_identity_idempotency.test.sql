begin;
select plan(12);
insert into auth.users(id,email) values ('16300000-0000-4000-8000-000000000001','core163@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('16300000-0000-4000-8000-000000000002','Core identity tenant','LC163','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('16300000-0000-4000-8000-000000000003','16300000-0000-4000-8000-000000000002','condominium','Test property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 ('16300000-0000-4000-8000-000000000004','16300000-0000-4000-8000-000000000002','16300000-0000-4000-8000-000000000003','B','Test building');
insert into portfolio.units(id,tenant_id,building_id,code) values
 ('16300000-0000-4000-8000-000000000005','16300000-0000-4000-8000-000000000002','16300000-0000-4000-8000-000000000004','P-01'),
 ('16300000-0000-4000-8000-000000000011','16300000-0000-4000-8000-000000000002','16300000-0000-4000-8000-000000000004','P-02'),
 ('16300000-0000-4000-8000-000000000012','16300000-0000-4000-8000-000000000002','16300000-0000-4000-8000-000000000004','P-03');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('16300000-0000-4000-8000-000000000006','16300000-0000-4000-8000-000000000002','ASSOCIATION','Test operator','ACTIVE');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '16300000-0000-4000-8000-000000000007','16300000-0000-4000-8000-000000000002',
 '16300000-0000-4000-8000-000000000001',id,'active',now()-interval '1 day'
from identity.roles where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('16300000-0000-4000-8000-000000000008','16300000-0000-4000-8000-000000000002',
 '16300000-0000-4000-8000-000000000007','tenant',now()-interval '1 day');
insert into platform.workspace_taxonomy_assignments
 (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '16300000-0000-4000-8000-000000000002','16300000-0000-4000-8000-000000000006',p.id,o.id,
 'active',now()-interval '1 day','16300000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o
where p.code='residential_condominium' and p.version=1
  and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '16300000-0000-4000-8000-000000000002','16300000-0000-4000-8000-000000000006',id,code,
 'active','Synthetic activation' from platform.module_definitions where code='core_unit_identity';
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
values('16300000-0000-4000-8000-000000000006','module.core_unit_identity','boolean',true,now()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from)
values('16300000-0000-4000-8000-000000000009','16300000-0000-4000-8000-000000000002',
 '16300000-0000-4000-8000-000000000006','unit_identity_writer','Unit identity writer','workspace',
 '16300000-0000-4000-8000-000000000001',now()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '16300000-0000-4000-8000-000000000002','16300000-0000-4000-8000-000000000009',id
from platform.module_definitions where code='core_unit_identity';
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '16300000-0000-4000-8000-000000000002','16300000-0000-4000-8000-000000000009',id,'allow'
from identity.permissions where code='core.units.specifications.record';
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '16300000-0000-4000-8000-000000000002','16300000-0000-4000-8000-000000000009',id,'allow'
from identity.permissions where code='core.units.lineage.record';
update platform.workspace_roles set lifecycle_status='published',lock_version=2
where id='16300000-0000-4000-8000-000000000009';
insert into platform.workspace_member_roles
 (tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
  assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('16300000-0000-4000-8000-000000000002','16300000-0000-4000-8000-000000000006',
 '16300000-0000-4000-8000-000000000007','16300000-0000-4000-8000-000000000009',
 'workspace','16300000-0000-4000-8000-000000000001','16300000-0000-4000-8000-000000000007',
 'Synthetic assignment',now()-interval '1 hour');


select throws_ok($$select customer_api.record_core_unit_specification_v2('16300000-0000-4000-8000-000000000008','16300000-0000-4000-8000-000000000006',
 '16300000-0000-4000-8000-000000000005',0,'P-01',1::smallint,50::numeric,2::smallint,'test://plan/1',
 '16300000-0000-4000-8000-000000000030','core-spec-001')$$,
 '22023','core_unit_request_invalid','Anonymous mutation denied');
select set_config('request.jwt.claims','{"sub":"16300000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.record_core_unit_specification_v2('16300000-0000-4000-8000-000000000008','16300000-0000-4000-8000-000000000006',
 '16300000-0000-4000-8000-000000000005',0,'P-01',1::smallint,50::numeric,2::smallint,'test://plan/1',
 '16300000-0000-4000-8000-000000000030','core-spec-001')$$,
 '42501','core_unit_request_access_denied','No property mandate');
insert into platform.workspace_property_authorities
 (id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
values('16300000-0000-4000-8000-000000000010','16300000-0000-4000-8000-000000000002',
 '16300000-0000-4000-8000-000000000003','16300000-0000-4000-8000-000000000006',
 'property_operations','synthetic','test://mandate',now()-interval '1 day');
select is((customer_api.record_core_unit_specification_v2('16300000-0000-4000-8000-000000000008','16300000-0000-4000-8000-000000000006',
 '16300000-0000-4000-8000-000000000005',0,'P-01',1::smallint,50::numeric,2::smallint,'test://plan/1',
 '16300000-0000-4000-8000-000000000030','core-spec-001')->>'idempotent')::boolean,false,
 'Initial specification records exactly once');
select is((customer_api.record_core_unit_specification_v2('16300000-0000-4000-8000-000000000008','16300000-0000-4000-8000-000000000006',
 '16300000-0000-4000-8000-000000000005',0,'P-01',1::smallint,50::numeric,2::smallint,'test://plan/1',
 '16300000-0000-4000-8000-000000000030','core-spec-001')->>'idempotent')::boolean,true,
 'Exact specification retry returns prior result');
select is((select count(*) from portfolio.unit_specification_versions),1::bigint,'One snapshot after retry');
select throws_ok($$select customer_api.record_core_unit_specification_v2(
 '16300000-0000-4000-8000-000000000008','16300000-0000-4000-8000-000000000006',
 '16300000-0000-4000-8000-000000000005',0,'Changed',1::smallint,50::numeric,2::smallint,'test://plan/1',
 '16300000-0000-4000-8000-000000000030','core-spec-001')$$,
 '23505','core_unit_idempotency_conflict','Same key with changed payload denied');
select is((customer_api.record_core_unit_lineage_v2('16300000-0000-4000-8000-000000000008','16300000-0000-4000-8000-000000000006',
 '16300000-0000-4000-8000-000000000003','split',
 array['16300000-0000-4000-8000-000000000005']::uuid[],
 array['16300000-0000-4000-8000-000000000011','16300000-0000-4000-8000-000000000012']::uuid[],
 'test://split','16300000-0000-4000-8000-000000000031','core-lineage-001')->>'idempotent')::boolean,false,
 'Initial split records exactly once');
select is((customer_api.record_core_unit_lineage_v2('16300000-0000-4000-8000-000000000008','16300000-0000-4000-8000-000000000006',
 '16300000-0000-4000-8000-000000000003','split',
 array['16300000-0000-4000-8000-000000000005']::uuid[],
 array['16300000-0000-4000-8000-000000000011','16300000-0000-4000-8000-000000000012']::uuid[],
 'test://split','16300000-0000-4000-8000-000000000031','core-lineage-001')->>'idempotent')::boolean,true,
 'Exact split retry returns prior result');
select is((select count(*) from portfolio.unit_lineage_events),1::bigint,'One lineage event after retry');
update platform.workspace_property_authorities set status='revoked',revoked_at=statement_timestamp(),
 valid_to=statement_timestamp(),revocation_reason='Synthetic revocation'
where id='16300000-0000-4000-8000-000000000010';
select throws_ok($$select customer_api.record_core_unit_specification_v2('16300000-0000-4000-8000-000000000008','16300000-0000-4000-8000-000000000006',
 '16300000-0000-4000-8000-000000000005',0,'P-01',1::smallint,50::numeric,2::smallint,'test://plan/1',
 '16300000-0000-4000-8000-000000000030','core-spec-001')$$,
 '42501','core_unit_request_access_denied','Revocation also denies cached replay');
select ok(not has_function_privilege('authenticated',
 'customer_api.record_core_unit_specification_v1(uuid,uuid,uuid,integer,text,smallint,numeric,smallint,text)','EXECUTE')
 and not has_function_privilege('authenticated',
 'customer_api.record_core_unit_lineage_v1(uuid,uuid,uuid,text,uuid[],uuid[],text)','EXECUTE'),
 'Old direct customer commands revoked');
select ok(not has_function_privilege('service_role',
 'customer_api.record_core_unit_specification_v2(uuid,uuid,uuid,integer,text,smallint,numeric,smallint,text,uuid,text)','EXECUTE')
 and not has_function_privilege('service_role',
 'customer_api.record_core_unit_lineage_v2(uuid,uuid,uuid,text,uuid[],uuid[],text,uuid,text)','EXECUTE'),
 'Service role cannot bypass customer path');
select * from finish();
rollback;
