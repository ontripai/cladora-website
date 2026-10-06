begin;
select plan(9);
insert into auth.users(id,email) values ('16100000-0000-4000-8000-000000000001','core161@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('16100000-0000-4000-8000-000000000002','Core identity tenant','LC161','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('16100000-0000-4000-8000-000000000003','16100000-0000-4000-8000-000000000002','condominium','Test property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 ('16100000-0000-4000-8000-000000000004','16100000-0000-4000-8000-000000000002','16100000-0000-4000-8000-000000000003','B','Test building');
insert into portfolio.units(id,tenant_id,building_id,code) values
 ('16100000-0000-4000-8000-000000000005','16100000-0000-4000-8000-000000000002','16100000-0000-4000-8000-000000000004','P-01'),
 ('16100000-0000-4000-8000-000000000011','16100000-0000-4000-8000-000000000002','16100000-0000-4000-8000-000000000004','P-02'),
 ('16100000-0000-4000-8000-000000000012','16100000-0000-4000-8000-000000000002','16100000-0000-4000-8000-000000000004','P-03');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('16100000-0000-4000-8000-000000000006','16100000-0000-4000-8000-000000000002','ASSOCIATION','Test operator','ACTIVE');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '16100000-0000-4000-8000-000000000007','16100000-0000-4000-8000-000000000002',
 '16100000-0000-4000-8000-000000000001',id,'active',now()-interval '1 day'
from identity.roles where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('16100000-0000-4000-8000-000000000008','16100000-0000-4000-8000-000000000002',
 '16100000-0000-4000-8000-000000000007','tenant',now()-interval '1 day');
insert into platform.workspace_taxonomy_assignments
 (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,valid_from,created_by,country_code)
select '16100000-0000-4000-8000-000000000002','16100000-0000-4000-8000-000000000006',p.id,o.id,
 'active',now()-interval '1 day','16100000-0000-4000-8000-000000000001','RO'
from platform.property_profiles p cross join platform.operating_models o
where p.code='residential_condominium' and p.version=1
  and o.code='association_managed' and o.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select '16100000-0000-4000-8000-000000000002','16100000-0000-4000-8000-000000000006',id,code,
 'active','Synthetic activation' from platform.module_definitions where code='core_unit_identity';
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from)
values('16100000-0000-4000-8000-000000000006','module.core_unit_identity','boolean',true,now()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,created_by,valid_from)
values('16100000-0000-4000-8000-000000000009','16100000-0000-4000-8000-000000000002',
 '16100000-0000-4000-8000-000000000006','unit_identity_writer','Unit identity writer','workspace',
 '16100000-0000-4000-8000-000000000001',now()-interval '1 day');
insert into platform.workspace_role_modules(tenant_id,workspace_role_id,module_definition_id)
select '16100000-0000-4000-8000-000000000002','16100000-0000-4000-8000-000000000009',id
from platform.module_definitions where code='core_unit_identity';
insert into platform.workspace_role_permissions(tenant_id,workspace_role_id,permission_id,effect)
select '16100000-0000-4000-8000-000000000002','16100000-0000-4000-8000-000000000009',id,'allow'
from identity.permissions where code='core.units.lineage.record';
update platform.workspace_roles set lifecycle_status='published',lock_version=2
where id='16100000-0000-4000-8000-000000000009';
insert into platform.workspace_member_roles
 (tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
  assigned_by_user_id,assigned_by_membership_id,reason,valid_from)
values('16100000-0000-4000-8000-000000000002','16100000-0000-4000-8000-000000000006',
 '16100000-0000-4000-8000-000000000007','16100000-0000-4000-8000-000000000009',
 'workspace','16100000-0000-4000-8000-000000000001','16100000-0000-4000-8000-000000000007',
 'Synthetic assignment',now()-interval '1 hour');


select throws_ok($$select customer_api.record_core_unit_lineage_v1(
 '16100000-0000-4000-8000-000000000008','16100000-0000-4000-8000-000000000006',
 '16100000-0000-4000-8000-000000000003','split',
 array['16100000-0000-4000-8000-000000000005']::uuid[],
 array['16100000-0000-4000-8000-000000000011','16100000-0000-4000-8000-000000000012']::uuid[],
 'test://plan/1')$$,'22023','core_unit_lineage_invalid','Anonymous denied');
select set_config('request.jwt.claims','{"sub":"16100000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_ok($$select customer_api.record_core_unit_lineage_v1(
 '16100000-0000-4000-8000-000000000008','16100000-0000-4000-8000-000000000006',
 '16100000-0000-4000-8000-000000000003','split',
 array['16100000-0000-4000-8000-000000000005']::uuid[],
 array['16100000-0000-4000-8000-000000000011','16100000-0000-4000-8000-000000000012']::uuid[],
 'test://plan/1')$$,'42501','core_unit_lineage_access_denied','Role without mandate denied');
insert into platform.workspace_property_authorities
 (id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from)
values('16100000-0000-4000-8000-000000000010','16100000-0000-4000-8000-000000000002',
 '16100000-0000-4000-8000-000000000003','16100000-0000-4000-8000-000000000006',
 'property_operations','synthetic','test://mandate',now()-interval '1 day');
select lives_ok($$select customer_api.record_core_unit_lineage_v1(
 '16100000-0000-4000-8000-000000000008','16100000-0000-4000-8000-000000000006',
 '16100000-0000-4000-8000-000000000003','split',
 array['16100000-0000-4000-8000-000000000005']::uuid[],
 array['16100000-0000-4000-8000-000000000011','16100000-0000-4000-8000-000000000012']::uuid[],
 'test://plan/1')$$,'Authorized split');
select throws_ok($$select customer_api.record_core_unit_lineage_v1(
 '16100000-0000-4000-8000-000000000008','16100000-0000-4000-8000-000000000006',
 '16100000-0000-4000-8000-000000000003','split',
 array['16100000-0000-4000-8000-000000000005']::uuid[],
 array['16100000-0000-4000-8000-000000000011','16100000-0000-4000-8000-000000000012']::uuid[],
 'test://again')$$,'23505','unit_lineage_transition_conflict','Duplicate transition denied');
select is((select count(*) from portfolio.unit_lineage_events),1::bigint,'Only one event retained');
update platform.workspace_property_authorities set status='revoked',revoked_at=statement_timestamp(),
 valid_to=statement_timestamp(),revocation_reason='Synthetic revocation'
where id='16100000-0000-4000-8000-000000000010';
select throws_ok($$select customer_api.record_core_unit_lineage_v1(
 '16100000-0000-4000-8000-000000000008','16100000-0000-4000-8000-000000000006',
 '16100000-0000-4000-8000-000000000003','merge',
 array['16100000-0000-4000-8000-000000000011','16100000-0000-4000-8000-000000000012']::uuid[],
 array['16100000-0000-4000-8000-000000000005']::uuid[],
 'test://revoke')$$,'42501','core_unit_lineage_access_denied','Revoked mandate denies merge');
select ok(not has_table_privilege('authenticated','portfolio.unit_lineage_events','INSERT'),
 'Direct lineage insert denied');
select ok(not has_function_privilege('service_role',
 'customer_api.record_core_unit_lineage_v1(uuid,uuid,uuid,text,uuid[],uuid[],text)','EXECUTE'),
 'Service role command denied');
select is((select code from portfolio.units where id='16100000-0000-4000-8000-000000000005'),
 'P-01'::text,'Canonical unit unchanged');
select * from finish();
rollback;
