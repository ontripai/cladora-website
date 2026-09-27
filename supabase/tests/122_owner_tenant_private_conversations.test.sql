begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(9);

insert into auth.users(id,email) values
  ('12200000-0000-4000-8000-000000000001','one122@cladora.test'),
  ('12200000-0000-4000-8000-000000000002','two122@cladora.test'),
  ('12200000-0000-4000-8000-000000000003','other122@cladora.test');
insert into identity.profiles(user_id,display_name) values
  ('12200000-0000-4000-8000-000000000001','First manager'),
  ('12200000-0000-4000-8000-000000000002','Second manager'),
  ('12200000-0000-4000-8000-000000000003','Other manager');
insert into platform.tenants(id,legal_name,registration_number,status) values
  ('12200000-0000-4000-8000-000000000004','Private Test','PRIVATE122','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
  ('12200000-0000-4000-8000-000000000005','12200000-0000-4000-8000-000000000004','condominium','One','active'),
  ('12200000-0000-4000-8000-000000000006','12200000-0000-4000-8000-000000000004','condominium','Other','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
  ('12200000-0000-4000-8000-000000000007','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000005','A','Building A'),
  ('12200000-0000-4000-8000-000000000008','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000006','B','Building B');
insert into portfolio.units(id,tenant_id,building_id,code) values
  ('12200000-0000-4000-8000-000000000009','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000007','1');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select ('12200000-0000-4000-8000-0000000000' || n)::uuid,
 '12200000-0000-4000-8000-000000000004',
 ('12200000-0000-4000-8000-0000000000' || n)::uuid,id,'active',statement_timestamp()-interval '1 day'
from identity.roles cross join (values ('01'),('02'),('03')) v(n)
where code='association_admin' and tenant_id is null and is_system;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,property_id,starts_at) values
 ('12200000-0000-4000-8000-000000000011','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000001','property','12200000-0000-4000-8000-000000000005',statement_timestamp()-interval '1 day'),
 ('12200000-0000-4000-8000-000000000012','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000002','property','12200000-0000-4000-8000-000000000005',statement_timestamp()-interval '1 day'),
 ('12200000-0000-4000-8000-000000000013','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000003','property','12200000-0000-4000-8000-000000000006',statement_timestamp()-interval '1 day');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('12200000-0000-4000-8000-000000000014','12200000-0000-4000-8000-000000000004','ASSOCIATION','Private Test','ACTIVE');
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('12200000-0000-4000-8000-000000000014','module.communications','boolean',true,statement_timestamp()-interval '1 day');


insert into auth.users(id,email,email_confirmed_at) values
 ('12200000-0000-4000-8000-000000000041','owner122@cladora.test',statement_timestamp()),
 ('12200000-0000-4000-8000-000000000042','tenant122@cladora.test',statement_timestamp());
insert into identity.profiles(user_id,display_name) values
 ('12200000-0000-4000-8000-000000000041','Owner'),
 ('12200000-0000-4000-8000-000000000042','Tenant');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select ('12200000-0000-4000-8000-0000000000'||v.suffix)::uuid,
 '12200000-0000-4000-8000-000000000004',('12200000-0000-4000-8000-0000000000'||v.suffix)::uuid,r.id,'active',statement_timestamp()-interval '1 day'
from (values('41','owner'),('42','tenant_resident')) v(suffix,role) join identity.roles r on r.code=v.role and r.tenant_id is null;
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,unit_id,starts_at) values
 ('12200000-0000-4000-8000-000000000043','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000041','unit','12200000-0000-4000-8000-000000000009',statement_timestamp()-interval '1 day'),
 ('12200000-0000-4000-8000-000000000044','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000042','unit','12200000-0000-4000-8000-000000000009',statement_timestamp()-interval '1 day');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('12200000-0000-4000-8000-000000000045','12200000-0000-4000-8000-000000000004','person','Owner'),
 ('12200000-0000-4000-8000-000000000046','12200000-0000-4000-8000-000000000004','person','Tenant');
insert into identity.membership_parties(membership_id,tenant_id,party_id) values
 ('12200000-0000-4000-8000-000000000041','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000045'),
 ('12200000-0000-4000-8000-000000000042','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000046');
insert into portfolio.ownerships(tenant_id,unit_id,party_id,share,valid_from) values
 ('12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000009','12200000-0000-4000-8000-000000000045',1,current_date-10);
insert into occupancy.leases(id,tenant_id,unit_id,landlord_party_id,tenant_party_id,starts_on,status) values
 ('12200000-0000-4000-8000-000000000047','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000009','12200000-0000-4000-8000-000000000045','12200000-0000-4000-8000-000000000046',current_date-5,'active');
select ok(communications.member_covers_unit('12200000-0000-4000-8000-000000000041','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000009'),'Verified owner covers unit');
select ok(communications.member_covers_unit('12200000-0000-4000-8000-000000000042','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000009'),'Active tenant covers unit');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','12200000-0000-4000-8000-000000000041','role','authenticated','aal','aal2','active_tenant_id','12200000-0000-4000-8000-000000000004','active_context_id','12200000-0000-4000-8000-000000000043')::text,true);
select is(jsonb_array_length(customer_api.list_private_units_v1('12200000-0000-4000-8000-000000000043',null,25,0)),1,'Owner discovers owned unit');
select ok((customer_api.create_private_conversation_v1('12200000-0000-4000-8000-000000000043','12200000-0000-4000-8000-000000000009','12200000-0000-4000-8000-000000000042','Lease note','12200000-0000-4000-8000-000000000051')->>'conversation_id') is not null,'Owner contacts active tenant');
select set_config('request.jwt.claims',jsonb_build_object('sub','12200000-0000-4000-8000-000000000042','role','authenticated','aal','aal2','active_tenant_id','12200000-0000-4000-8000-000000000004','active_context_id','12200000-0000-4000-8000-000000000044')::text,true);
select is(jsonb_array_length(customer_api.get_private_conversations_v1('12200000-0000-4000-8000-000000000044',null)),1,'Tenant reads owner message');
select ok((customer_api.send_private_message_v1('12200000-0000-4000-8000-000000000044',(customer_api.get_private_conversations_v1('12200000-0000-4000-8000-000000000044',null)->0->>'id')::uuid,'Tenant reply','12200000-0000-4000-8000-000000000052')->>'message_id') is not null,'Tenant replies');
reset role;
update occupancy.leases set status='archived' where id='12200000-0000-4000-8000-000000000047';
select ok(not communications.member_covers_unit('12200000-0000-4000-8000-000000000042','12200000-0000-4000-8000-000000000004','12200000-0000-4000-8000-000000000009'),'Ended lease removes tenant unit coverage');
set local role authenticated;
select throws_ok($$select customer_api.get_private_conversations_v1('12200000-0000-4000-8000-000000000044',null)$$,'42501','private_conversation_denied','Ended lease denies tenant history');
select set_config('request.jwt.claims',jsonb_build_object('sub','12200000-0000-4000-8000-000000000041','role','authenticated','aal','aal2','active_tenant_id','12200000-0000-4000-8000-000000000004','active_context_id','12200000-0000-4000-8000-000000000043')::text,true);
select is(jsonb_array_length(customer_api.get_private_conversations_v1('12200000-0000-4000-8000-000000000043',null)),0,'Ended lease also hides thread from owner');
select * from finish();
rollback;
