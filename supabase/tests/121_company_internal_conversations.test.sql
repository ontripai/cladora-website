begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(11);

insert into auth.users(id,email) values
  ('12100000-0000-4000-8000-000000000001','one121@cladora.test'),
  ('12100000-0000-4000-8000-000000000002','two121@cladora.test'),
  ('12100000-0000-4000-8000-000000000003','other121@cladora.test');
insert into identity.profiles(user_id,display_name) values
  ('12100000-0000-4000-8000-000000000001','First manager'),
  ('12100000-0000-4000-8000-000000000002','Second manager'),
  ('12100000-0000-4000-8000-000000000003','Other manager');
insert into platform.tenants(id,legal_name,registration_number,status) values
  ('12100000-0000-4000-8000-000000000004','Private Test','PRIVATE121','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
  ('12100000-0000-4000-8000-000000000005','12100000-0000-4000-8000-000000000004','condominium','One','active'),
  ('12100000-0000-4000-8000-000000000006','12100000-0000-4000-8000-000000000004','condominium','Other','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
  ('12100000-0000-4000-8000-000000000007','12100000-0000-4000-8000-000000000004','12100000-0000-4000-8000-000000000005','A','Building A'),
  ('12100000-0000-4000-8000-000000000008','12100000-0000-4000-8000-000000000004','12100000-0000-4000-8000-000000000006','B','Building B');
insert into portfolio.units(id,tenant_id,building_id,code) values
  ('12100000-0000-4000-8000-000000000009','12100000-0000-4000-8000-000000000004','12100000-0000-4000-8000-000000000007','1');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select ('12100000-0000-4000-8000-0000000000' || n)::uuid,
 '12100000-0000-4000-8000-000000000004',
 ('12100000-0000-4000-8000-0000000000' || n)::uuid,id,'active',statement_timestamp()-interval '1 day'
from identity.roles cross join (values ('01'),('02'),('03')) v(n)
where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,property_id,starts_at) values
 ('12100000-0000-4000-8000-000000000011','12100000-0000-4000-8000-000000000004','12100000-0000-4000-8000-000000000001','property','12100000-0000-4000-8000-000000000005',statement_timestamp()-interval '1 day'),
 ('12100000-0000-4000-8000-000000000012','12100000-0000-4000-8000-000000000004','12100000-0000-4000-8000-000000000002','property','12100000-0000-4000-8000-000000000005',statement_timestamp()-interval '1 day'),
 ('12100000-0000-4000-8000-000000000013','12100000-0000-4000-8000-000000000004','12100000-0000-4000-8000-000000000003','property','12100000-0000-4000-8000-000000000006',statement_timestamp()-interval '1 day');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('12100000-0000-4000-8000-000000000014','12100000-0000-4000-8000-000000000004','ASSOCIATION','Private Test','ACTIVE');
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('12100000-0000-4000-8000-000000000014','module.communications','boolean',true,statement_timestamp()-interval '1 day');


insert into auth.users(id,email,email_confirmed_at) values
 ('12100000-0000-4000-8000-000000000041','staff121@cladora.test',statement_timestamp()),
 ('12100000-0000-4000-8000-000000000042','vendor121@cladora.test',statement_timestamp());
insert into identity.profiles(user_id,display_name) values
 ('12100000-0000-4000-8000-000000000041','Assigned company staff'),
 ('12100000-0000-4000-8000-000000000042','Approved vendor contact');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select ('12100000-0000-4000-8000-0000000000'||v.suffix)::uuid,
 '12100000-0000-4000-8000-000000000004',('12100000-0000-4000-8000-0000000000'||v.suffix)::uuid,r.id,'active',statement_timestamp()-interval '1 day'
from (values('41','company_staff'),('42','vendor_contact')) v(suffix,role) join identity.roles r on r.code=v.role and r.tenant_id is null;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,property_id,starts_at) values
 ('12100000-0000-4000-8000-000000000043','12100000-0000-4000-8000-000000000004','12100000-0000-4000-8000-000000000041','property','12100000-0000-4000-8000-000000000005',statement_timestamp()-interval '1 day'),
 ('12100000-0000-4000-8000-000000000044','12100000-0000-4000-8000-000000000004','12100000-0000-4000-8000-000000000042','property','12100000-0000-4000-8000-000000000005',statement_timestamp()-interval '1 day');
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name) values
 ('12100000-0000-4000-8000-000000000045','12100000-0000-4000-8000-000000000041','employee-121','Company staff');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason) values
 ('12100000-0000-4000-8000-000000000045','PLATFORM_SUPPORT','Fixture');
insert into platform.platform_customer_assignments(platform_user_id,customer_workspace_id,assignment_reason) values
 ('12100000-0000-4000-8000-000000000045','12100000-0000-4000-8000-000000000014','Fixture');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('12100000-0000-4000-8000-000000000046','12100000-0000-4000-8000-000000000004','company','Approved vendor');
insert into maintenance.vendors(id,tenant_id,party_id,status) values
 ('12100000-0000-4000-8000-000000000047','12100000-0000-4000-8000-000000000004','12100000-0000-4000-8000-000000000046','approved');
insert into maintenance.vendor_contracts(id,tenant_id,vendor_id,property_id,starts_on,status) values
 ('12100000-0000-4000-8000-000000000048','12100000-0000-4000-8000-000000000004','12100000-0000-4000-8000-000000000047','12100000-0000-4000-8000-000000000005',current_date-1,'active');
insert into maintenance.vendor_portal_memberships(tenant_id,vendor_id,membership_id,status,verified_by,accepted_at) values
 ('12100000-0000-4000-8000-000000000004','12100000-0000-4000-8000-000000000047','12100000-0000-4000-8000-000000000042','active','12100000-0000-4000-8000-000000000001',statement_timestamp());

insert into auth.users(id,email,email_confirmed_at) values
 ('12100000-0000-4000-8000-000000000049','colleague121@cladora.test',statement_timestamp());
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name) values
 ('12100000-0000-4000-8000-000000000050','12100000-0000-4000-8000-000000000049','colleague-121','Other staff');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason) values
 ('12100000-0000-4000-8000-000000000050','PLATFORM_SUPPORT','Fixture');
insert into platform.platform_customer_assignments(platform_user_id,customer_workspace_id,assignment_reason) values
 ('12100000-0000-4000-8000-000000000050','12100000-0000-4000-8000-000000000014','Fixture');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('12100000-0000-4000-8000-000000000053','12100000-0000-4000-8000-000000000004','ASSOCIATION','Unassigned workspace','ACTIVE');
select ok(not has_table_privilege('authenticated','platform.internal_messages','SELECT'),'Internal messages cannot be directly read');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','12100000-0000-4000-8000-000000000041','role','authenticated','aal','aal1')::text,true);
select throws_ok($$select customer_api.list_internal_workspaces_v1()$$,'42501','internal_access_denied','AAL1 blocks internal list');
select set_config('request.jwt.claims',jsonb_build_object('sub','12100000-0000-4000-8000-000000000041','role','authenticated','aal','aal2')::text,true);
select is(jsonb_array_length(customer_api.list_internal_workspaces_v1()),1,'Staff sees only assigned workspace');
select is(jsonb_array_length(customer_api.list_internal_recipients_v1('12100000-0000-4000-8000-000000000014')),1,'Staff discovers assigned colleague only');
select throws_ok($$select customer_api.list_internal_recipients_v1('12100000-0000-4000-8000-000000000053')$$,'42501','internal_access_denied','Unassigned workspace denied');
select is((customer_api.create_internal_conversation_v1('12100000-0000-4000-8000-000000000014','12100000-0000-4000-8000-000000000050','Internal case','12100000-0000-4000-8000-000000000051')->>'replayed')::boolean,false,'Staff creates internal thread');
select is((customer_api.create_internal_conversation_v1('12100000-0000-4000-8000-000000000014','12100000-0000-4000-8000-000000000050','Internal case','12100000-0000-4000-8000-000000000051')->>'replayed')::boolean,true,'Retry has no duplicate');
select set_config('test.internal_thread',customer_api.get_internal_conversations_v1('12100000-0000-4000-8000-000000000014')->0->>'id',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','12100000-0000-4000-8000-000000000049','role','authenticated','aal','aal2')::text,true);
select is((customer_api.get_internal_conversations_v1('12100000-0000-4000-8000-000000000014')->0->>'unread')::int,1,'Recipient sees unread internal message');
select is((customer_api.mark_internal_read_v1(current_setting('test.internal_thread')::uuid)->>'thread_id')::uuid,current_setting('test.internal_thread')::uuid,'Recipient marks internal read');
select is((customer_api.get_internal_conversations_v1('12100000-0000-4000-8000-000000000014')->0->>'unread')::int,0,'Unread count resets');
reset role;
update platform.platform_customer_assignments set status='revoked',revoked_at=statement_timestamp()
 where platform_user_id='12100000-0000-4000-8000-000000000050';
set local role authenticated;
select throws_ok($$select customer_api.get_internal_conversations_v1('12100000-0000-4000-8000-000000000014')$$,'42501','internal_access_denied','Revoked colleague loses thread');
select * from finish();
rollback;
