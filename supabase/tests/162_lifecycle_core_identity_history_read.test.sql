begin;
select plan(8);
insert into auth.users(id,email) values ('16200000-0000-4000-8000-000000000001','core162@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('16200000-0000-4000-8000-000000000002','Core identity tenant','LC162','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('16200000-0000-4000-8000-000000000003','16200000-0000-4000-8000-000000000002','condominium','Test property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 ('16200000-0000-4000-8000-000000000004','16200000-0000-4000-8000-000000000002','16200000-0000-4000-8000-000000000003','B','Test building');
insert into portfolio.units(id,tenant_id,building_id,code) values
 ('16200000-0000-4000-8000-000000000005','16200000-0000-4000-8000-000000000002','16200000-0000-4000-8000-000000000004','P-01'),
 ('16200000-0000-4000-8000-000000000011','16200000-0000-4000-8000-000000000002','16200000-0000-4000-8000-000000000004','P-02'),
 ('16200000-0000-4000-8000-000000000012','16200000-0000-4000-8000-000000000002','16200000-0000-4000-8000-000000000004','P-03');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('16200000-0000-4000-8000-000000000006','16200000-0000-4000-8000-000000000002','ASSOCIATION','Test operator','ACTIVE');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '16200000-0000-4000-8000-000000000007','16200000-0000-4000-8000-000000000002',
 '16200000-0000-4000-8000-000000000001',id,'active',now()-interval '1 day'
from identity.roles where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('16200000-0000-4000-8000-000000000008','16200000-0000-4000-8000-000000000002',
 '16200000-0000-4000-8000-000000000007','tenant',now()-interval '1 day');
insert into platform.workspace_taxonomy_assignments
 (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '16200000-0000-4000-8000-000000000002','16200000-0000-4000-8000-000000000006',p.id,o.id,
 'active',now()-interval '1 day','16200000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o
where p.code='residential_condominium' and p.version=1
  and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '16200000-0000-4000-8000-000000000002','16200000-0000-4000-8000-000000000006',id,code,
 'active','Synthetic activation' from platform.module_definitions where code='core_unit_identity';
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
values('16200000-0000-4000-8000-000000000006','module.core_unit_identity','boolean',true,now()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from)
values('16200000-0000-4000-8000-000000000009','16200000-0000-4000-8000-000000000002',
 '16200000-0000-4000-8000-000000000006','unit_identity_writer','Unit identity writer','workspace',
 '16200000-0000-4000-8000-000000000001',now()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '16200000-0000-4000-8000-000000000002','16200000-0000-4000-8000-000000000009',id
from platform.module_definitions where code='core_unit_identity';
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '16200000-0000-4000-8000-000000000002','16200000-0000-4000-8000-000000000009',id,'allow'
from identity.permissions where code='core.units.identity.read';
update platform.workspace_roles set lifecycle_status='published',lock_version=2
where id='16200000-0000-4000-8000-000000000009';
insert into platform.workspace_member_roles
 (tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
  assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('16200000-0000-4000-8000-000000000002','16200000-0000-4000-8000-000000000006',
 '16200000-0000-4000-8000-000000000007','16200000-0000-4000-8000-000000000009',
 'workspace','16200000-0000-4000-8000-000000000001','16200000-0000-4000-8000-000000000007',
 'Synthetic assignment',now()-interval '1 hour');


select throws_ok($$select customer_api.get_core_unit_identity_history_v1(
 '16200000-0000-4000-8000-000000000008','16200000-0000-4000-8000-000000000006',
 '16200000-0000-4000-8000-000000000005')$$,
 '42501','core_unit_history_access_denied','Anonymous denied');
select set_config('request.jwt.claims','{"sub":"16200000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.get_core_unit_identity_history_v1(
 '16200000-0000-4000-8000-000000000008','16200000-0000-4000-8000-000000000006',
 '16200000-0000-4000-8000-000000000005')$$,
 '42501','core_unit_history_access_denied','Role without mandate denied');
insert into platform.workspace_property_authorities
 (id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
values('16200000-0000-4000-8000-000000000010','16200000-0000-4000-8000-000000000002',
 '16200000-0000-4000-8000-000000000003','16200000-0000-4000-8000-000000000006',
 'property_operations','synthetic','test://mandate',now()-interval '1 day');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('16200000-0000-4000-8000-000000000020','16200000-0000-4000-8000-000000000002',
 'ASSOCIATION','Other workspace','ACTIVE');
insert into portfolio.unit_specification_versions
 (tenant_id,unit_id,version,building_id,unit_code,source_reference,recorded_by,customer_workspace_id) values
 ('16200000-0000-4000-8000-000000000002','16200000-0000-4000-8000-000000000005',1,
 '16200000-0000-4000-8000-000000000004','Own','test://own','16200000-0000-4000-8000-000000000001',
 '16200000-0000-4000-8000-000000000006');
insert into portfolio.unit_specification_versions
 (tenant_id,unit_id,version,building_id,unit_code,source_reference,recorded_by,customer_workspace_id) values
 ('16200000-0000-4000-8000-000000000002','16200000-0000-4000-8000-000000000005',2,
 '16200000-0000-4000-8000-000000000004','Internal','test://internal','16200000-0000-4000-8000-000000000001',null);
insert into portfolio.unit_specification_versions
 (tenant_id,unit_id,version,building_id,unit_code,source_reference,recorded_by,customer_workspace_id) values
 ('16200000-0000-4000-8000-000000000002','16200000-0000-4000-8000-000000000005',3,
 '16200000-0000-4000-8000-000000000004','Other','test://other','16200000-0000-4000-8000-000000000001',
 '16200000-0000-4000-8000-000000000020');
insert into portfolio.unit_lineage_events
 (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by,customer_workspace_id) values
 ('16200000-0000-4000-8000-000000000002','16200000-0000-4000-8000-000000000003','split',
 array['16200000-0000-4000-8000-000000000005']::uuid[],
 array['16200000-0000-4000-8000-000000000011','16200000-0000-4000-8000-000000000012']::uuid[],
 'test://other-lineage','16200000-0000-4000-8000-000000000001',
 '16200000-0000-4000-8000-000000000020');
select is((customer_api.get_core_unit_identity_history_v1(
 '16200000-0000-4000-8000-000000000008','16200000-0000-4000-8000-000000000006',
 '16200000-0000-4000-8000-000000000005')->'snapshots'->0->>'unit_code'),
 'Own'::text,'Only originating workspace snapshot visible');
select is(jsonb_array_length(customer_api.get_core_unit_identity_history_v1(
 '16200000-0000-4000-8000-000000000008','16200000-0000-4000-8000-000000000006',
 '16200000-0000-4000-8000-000000000005')->'snapshots'),1,
 'Internal and other workspace snapshots hidden');
select is(jsonb_array_length(customer_api.get_core_unit_identity_history_v1(
 '16200000-0000-4000-8000-000000000008','16200000-0000-4000-8000-000000000006',
 '16200000-0000-4000-8000-000000000005')->'lineage'),0,
 'Other workspace lineage hidden');
update platform.workspace_property_authorities set status='revoked',revoked_at=statement_timestamp(),
 valid_to=statement_timestamp(),revocation_reason='Synthetic revocation'
where id='16200000-0000-4000-8000-000000000010';
select throws_ok($$select customer_api.get_core_unit_identity_history_v1(
 '16200000-0000-4000-8000-000000000008','16200000-0000-4000-8000-000000000006',
 '16200000-0000-4000-8000-000000000005')$$,
 '42501','core_unit_history_access_denied','Revoked mandate denies history');
select ok(not has_table_privilege('authenticated','portfolio.unit_specification_versions','SELECT')
 and not has_table_privilege('authenticated','portfolio.unit_lineage_events','SELECT'),
 'Private tables remain inaccessible');
select ok(not has_function_privilege('service_role',
 'customer_api.get_core_unit_identity_history_v1(uuid,uuid,uuid)','EXECUTE'),
 'Service role read denied');
select * from finish();
rollback;
