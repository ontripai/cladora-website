begin;
select plan(15);

insert into auth.users(id,email) values('15500000-0000-4000-8000-000000000001','mandate155@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('15500000-0000-4000-8000-000000000002','Mandate tenant','LC155A','active'),
 ('15500000-0000-4000-8000-000000000003','Other mandate tenant','LC155B','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('15500000-0000-4000-8000-000000000004','15500000-0000-4000-8000-000000000002','condominium','Shared property','active'),
 ('15500000-0000-4000-8000-000000000005','15500000-0000-4000-8000-000000000003','condominium','Foreign property','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('15500000-0000-4000-8000-000000000006','15500000-0000-4000-8000-000000000002','ASSOCIATION','Association','ACTIVE'),
 ('15500000-0000-4000-8000-000000000007','15500000-0000-4000-8000-000000000002','PROPERTY_MANAGER','Manager','ACTIVE');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '15500000-0000-4000-8000-000000000008','15500000-0000-4000-8000-000000000002',
 '15500000-0000-4000-8000-000000000001',id,'active',statement_timestamp()-interval '1 day'
from identity.roles where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at) values
 ('15500000-0000-4000-8000-000000000009','15500000-0000-4000-8000-000000000002',
  '15500000-0000-4000-8000-000000000008','tenant',statement_timestamp()-interval '1 day');
insert into platform.workspace_roles(id,tenant_id,customer_workspace_id,code,name,scope_ceiling,lifecycle_status,created_by,valid_from) values
 ('15500000-0000-4000-8000-000000000010','15500000-0000-4000-8000-000000000002',
  '15500000-0000-4000-8000-000000000006','mandate_test_a','Mandate test A','workspace','published',
  '15500000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day'),
 ('15500000-0000-4000-8000-000000000011','15500000-0000-4000-8000-000000000002',
  '15500000-0000-4000-8000-000000000007','mandate_test_b','Mandate test B','workspace','published',
  '15500000-0000-4000-8000-000000000001',statement_timestamp()-interval '1 day');
insert into platform.workspace_member_roles
 (id,tenant_id,customer_workspace_id,membership_id,workspace_role_id,scope_type,
  assigned_by_user_id,assigned_by_membership_id,reason,valid_from) values
 ('15500000-0000-4000-8000-000000000012','15500000-0000-4000-8000-000000000002',
  '15500000-0000-4000-8000-000000000006','15500000-0000-4000-8000-000000000008',
  '15500000-0000-4000-8000-000000000010','workspace','15500000-0000-4000-8000-000000000001',
  '15500000-0000-4000-8000-000000000008','Synthetic assignment A',statement_timestamp()-interval '1 hour'),
 ('15500000-0000-4000-8000-000000000013','15500000-0000-4000-8000-000000000002',
  '15500000-0000-4000-8000-000000000007','15500000-0000-4000-8000-000000000008',
  '15500000-0000-4000-8000-000000000011','workspace','15500000-0000-4000-8000-000000000001',
  '15500000-0000-4000-8000-000000000008','Synthetic assignment B',statement_timestamp()-interval '1 hour');
insert into platform.workspace_property_authorities
 (id,tenant_id,property_id,customer_workspace_id,purpose,authority_source,evidence_reference,valid_from) values
 ('15500000-0000-4000-8000-000000000014','15500000-0000-4000-8000-000000000002',
  '15500000-0000-4000-8000-000000000004','15500000-0000-4000-8000-000000000006',
  'property_operations','synthetic mandate','test://mandate/A',statement_timestamp()-interval '1 day'),
 ('15500000-0000-4000-8000-000000000015','15500000-0000-4000-8000-000000000002',
  '15500000-0000-4000-8000-000000000004','15500000-0000-4000-8000-000000000007',
  'service_delivery','synthetic mandate','test://mandate/B',statement_timestamp()-interval '1 day'),
 ('15500000-0000-4000-8000-000000000016','15500000-0000-4000-8000-000000000002',
  '15500000-0000-4000-8000-000000000004','15500000-0000-4000-8000-000000000006',
  'investment','future mandate','test://mandate/future',statement_timestamp()+interval '1 day');

select is(app_private.current_workspace_property_mandate_v1('15500000-0000-4000-8000-000000000009','15500000-0000-4000-8000-000000000006','15500000-0000-4000-8000-000000000004','property_operations'),null::uuid,'Without authentication no relationship returned');
select set_config('request.jwt.claims','{"sub":"15500000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(app_private.current_workspace_property_mandate_v1('15500000-0000-4000-8000-000000000009','15500000-0000-4000-8000-000000000006','15500000-0000-4000-8000-000000000004','property_operations'),'15500000-0000-4000-8000-000000000014'::uuid,'First workspace resolves exact mandate');
select is(app_private.current_workspace_property_mandate_v1('15500000-0000-4000-8000-000000000009','15500000-0000-4000-8000-000000000007','15500000-0000-4000-8000-000000000004','service_delivery'),'15500000-0000-4000-8000-000000000015'::uuid,'Second workspace resolves distinct mandate for same property');
select is(app_private.current_workspace_property_mandate_v1('15500000-0000-4000-8000-000000000009','15500000-0000-4000-8000-000000000007','15500000-0000-4000-8000-000000000004','property_operations'),null::uuid,'Purpose cannot bleed across workspace');
select is(app_private.current_workspace_property_mandate_v1('15500000-0000-4000-8000-000000000009','15500000-0000-4000-8000-000000000006','15500000-0000-4000-8000-000000000004','investment'),null::uuid,'Future mandate is not current');
select is(app_private.current_workspace_property_mandate_v1('15500000-0000-4000-8000-000000000009','15500000-0000-4000-8000-000000000006','15500000-0000-4000-8000-000000000005','property_operations'),null::uuid,'Foreign property is hidden');
select is(app_private.current_workspace_property_mandate_v1('15500000-0000-4000-8000-000000000099','15500000-0000-4000-8000-000000000006','15500000-0000-4000-8000-000000000004','property_operations'),null::uuid,'Unknown context denied');
select is(app_private.current_workspace_property_mandate_v1('15500000-0000-4000-8000-000000000009','15500000-0000-4000-8000-000000000006','15500000-0000-4000-8000-000000000004','invalid'),null::uuid,'Unknown purpose denied');
select is(app_private.current_workspace_property_mandate_v1(null,'15500000-0000-4000-8000-000000000006','15500000-0000-4000-8000-000000000004','property_operations'),null::uuid,'Null context denied');
update platform.workspace_property_authorities set status='revoked',revoked_at=statement_timestamp(),valid_to=statement_timestamp(),revocation_reason='test revocation' where id='15500000-0000-4000-8000-000000000014';
select is(app_private.current_workspace_property_mandate_v1('15500000-0000-4000-8000-000000000009','15500000-0000-4000-8000-000000000006','15500000-0000-4000-8000-000000000004','property_operations'),null::uuid,'Revoked mandate denied immediately');
select is(app_private.current_workspace_property_mandate_v1('15500000-0000-4000-8000-000000000009','15500000-0000-4000-8000-000000000007','15500000-0000-4000-8000-000000000004','service_delivery'),'15500000-0000-4000-8000-000000000015'::uuid,'Other workspace remains independent');
update platform.workspace_member_roles set valid_to=statement_timestamp(),lock_version=2,reason='Synthetic assignment ended' where id='15500000-0000-4000-8000-000000000013';
select is(app_private.current_workspace_property_mandate_v1('15500000-0000-4000-8000-000000000009','15500000-0000-4000-8000-000000000007','15500000-0000-4000-8000-000000000004','service_delivery'),null::uuid,'Revoked actor assignment denies mandate');
select ok(not has_function_privilege('authenticated','app_private.current_workspace_property_mandate_v1(uuid,uuid,uuid,text)','EXECUTE'),'Customer cannot invoke private helper');
select ok(not has_function_privilege('service_role','app_private.current_workspace_property_mandate_v1(uuid,uuid,uuid,text)','EXECUTE'),'Service role cannot invoke private helper directly');
select is((select count(*) from platform.workspace_property_authorities where tenant_id='15500000-0000-4000-8000-000000000002'),3::bigint,'Resolution does not mutate relationships');
select * from finish();
rollback;
