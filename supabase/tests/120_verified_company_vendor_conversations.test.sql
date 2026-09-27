begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(12);

insert into auth.users(id,email) values
  ('12000000-0000-4000-8000-000000000001','one120@cladora.test'),
  ('12000000-0000-4000-8000-000000000002','two120@cladora.test'),
  ('12000000-0000-4000-8000-000000000003','other120@cladora.test');
insert into identity.profiles(user_id,display_name) values
  ('12000000-0000-4000-8000-000000000001','First manager'),
  ('12000000-0000-4000-8000-000000000002','Second manager'),
  ('12000000-0000-4000-8000-000000000003','Other manager');
insert into platform.tenants(id,legal_name,registration_number,status) values
  ('12000000-0000-4000-8000-000000000004','Private Test','PRIVATE120','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
  ('12000000-0000-4000-8000-000000000005','12000000-0000-4000-8000-000000000004','condominium','One','active'),
  ('12000000-0000-4000-8000-000000000006','12000000-0000-4000-8000-000000000004','condominium','Other','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
  ('12000000-0000-4000-8000-000000000007','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000005','A','Building A'),
  ('12000000-0000-4000-8000-000000000008','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000006','B','Building B');
insert into portfolio.units(id,tenant_id,building_id,code) values
  ('12000000-0000-4000-8000-000000000009','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000007','1');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select ('12000000-0000-4000-8000-0000000000' || n)::uuid,
 '12000000-0000-4000-8000-000000000004',
 ('12000000-0000-4000-8000-0000000000' || n)::uuid,id,'active',statement_timestamp()-interval '1 day'
from identity.roles cross join (values ('01'),('02'),('03')) v(n)
where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,property_id,starts_at) values
 ('12000000-0000-4000-8000-000000000011','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000001','property','12000000-0000-4000-8000-000000000005',statement_timestamp()-interval '1 day'),
 ('12000000-0000-4000-8000-000000000012','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000002','property','12000000-0000-4000-8000-000000000005',statement_timestamp()-interval '1 day'),
 ('12000000-0000-4000-8000-000000000013','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000003','property','12000000-0000-4000-8000-000000000006',statement_timestamp()-interval '1 day');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('12000000-0000-4000-8000-000000000014','12000000-0000-4000-8000-000000000004','ASSOCIATION','Private Test','ACTIVE');
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('12000000-0000-4000-8000-000000000014','module.communications','boolean',true,statement_timestamp()-interval '1 day');


insert into auth.users(id,email,email_confirmed_at) values
 ('12000000-0000-4000-8000-000000000041','staff120@cladora.test',statement_timestamp()),
 ('12000000-0000-4000-8000-000000000042','vendor120@cladora.test',statement_timestamp());
insert into identity.profiles(user_id,display_name) values
 ('12000000-0000-4000-8000-000000000041','Assigned company staff'),
 ('12000000-0000-4000-8000-000000000042','Approved vendor contact');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select ('12000000-0000-4000-8000-0000000000'||v.suffix)::uuid,
 '12000000-0000-4000-8000-000000000004',('12000000-0000-4000-8000-0000000000'||v.suffix)::uuid,r.id,'active',statement_timestamp()-interval '1 day'
from (values('41','company_staff'),('42','vendor_contact')) v(suffix,role) join identity.roles r on r.code=v.role and r.tenant_id is null;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,property_id,starts_at) values
 ('12000000-0000-4000-8000-000000000043','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000041','property','12000000-0000-4000-8000-000000000005',statement_timestamp()-interval '1 day'),
 ('12000000-0000-4000-8000-000000000044','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000042','property','12000000-0000-4000-8000-000000000005',statement_timestamp()-interval '1 day');
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name) values
 ('12000000-0000-4000-8000-000000000045','12000000-0000-4000-8000-000000000041','employee-120','Company staff');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason) values
 ('12000000-0000-4000-8000-000000000045','PLATFORM_SUPPORT','Fixture');
insert into platform.platform_customer_assignments(platform_user_id,customer_workspace_id,assignment_reason) values
 ('12000000-0000-4000-8000-000000000045','12000000-0000-4000-8000-000000000014','Fixture');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('12000000-0000-4000-8000-000000000046','12000000-0000-4000-8000-000000000004','company','Approved vendor');
insert into maintenance.vendors(id,tenant_id,party_id,status) values
 ('12000000-0000-4000-8000-000000000047','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000046','approved');
insert into maintenance.vendor_contracts(id,tenant_id,vendor_id,property_id,starts_on,status) values
 ('12000000-0000-4000-8000-000000000048','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000047','12000000-0000-4000-8000-000000000005',current_date-1,'active');
insert into maintenance.vendor_portal_memberships(tenant_id,vendor_id,membership_id,status,verified_by,accepted_at) values
 ('12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000047','12000000-0000-4000-8000-000000000042','active','12000000-0000-4000-8000-000000000001',statement_timestamp());
select ok(communications.member_covers_unit('12000000-0000-4000-8000-000000000041','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000009'),'Company assignment permits staff');
select ok(communications.member_covers_unit('12000000-0000-4000-8000-000000000042','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000009'),'Accepted approved vendor permits contractor');
select ok(not communications.private_pair_allowed('12000000-0000-4000-8000-000000000041','12000000-0000-4000-8000-000000000042','12000000-0000-4000-8000-000000000009'),'Company and vendor cannot contact directly');
select ok(communications.private_pair_allowed('12000000-0000-4000-8000-000000000001','12000000-0000-4000-8000-000000000042','12000000-0000-4000-8000-000000000009'),'Manager and vendor can contact');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','12000000-0000-4000-8000-000000000001','role','authenticated','aal','aal2','active_tenant_id','12000000-0000-4000-8000-000000000004','active_context_id','12000000-0000-4000-8000-000000000011')::text,true);
select is(jsonb_array_length(customer_api.list_private_recipients_v1('12000000-0000-4000-8000-000000000011','12000000-0000-4000-8000-000000000009')),3,'Manager discovers company, vendor and other manager');
select is((customer_api.create_private_conversation_v1('12000000-0000-4000-8000-000000000011','12000000-0000-4000-8000-000000000009','12000000-0000-4000-8000-000000000042','Service question','12000000-0000-4000-8000-000000000051')->>'conversation_id') is not null,true,'Manager creates vendor conversation');
reset role;
update maintenance.vendor_contracts set status='archived' where id='12000000-0000-4000-8000-000000000048';
set local role authenticated;
select is(jsonb_array_length(customer_api.get_private_conversations_v1('12000000-0000-4000-8000-000000000011',null)),0,'Contract end revokes existing conversation');
reset role;
update platform.platform_customer_assignments set status='revoked',revoked_at=statement_timestamp() where platform_user_id='12000000-0000-4000-8000-000000000045';
select ok(not communications.member_covers_unit('12000000-0000-4000-8000-000000000041','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000009'),'Company assignment revokes staff');
select ok(not communications.member_covers_unit('12000000-0000-4000-8000-000000000042','12000000-0000-4000-8000-000000000004','12000000-0000-4000-8000-000000000009'),'Contract revokes vendor');
select set_config('request.jwt.claims',jsonb_build_object('sub','12000000-0000-4000-8000-000000000042','role','authenticated','aal','aal2','active_tenant_id','12000000-0000-4000-8000-000000000004','active_context_id','12000000-0000-4000-8000-000000000044')::text,true);
select throws_ok($$select * from documents.resolve_vault_actor('12000000-0000-4000-8000-000000000044','documents.vault.read',false)$$,'42501','relationship_expired','Expired vendor contract denies vault authorization');
select set_config('request.jwt.claims',jsonb_build_object('sub','12000000-0000-4000-8000-000000000041','role','authenticated','aal','aal2','active_tenant_id','12000000-0000-4000-8000-000000000004','active_context_id','12000000-0000-4000-8000-000000000043')::text,true);
select throws_ok($$select * from documents.resolve_vault_actor('12000000-0000-4000-8000-000000000043','documents.vault.read',false)$$,'42501','relationship_expired','Revoked staff assignment denies vault authorization');
select ok(not has_table_privilege('authenticated','maintenance.vendor_portal_memberships','SELECT'),'Vendor binding table stays private');
select * from finish();
rollback;
