begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(17);

insert into auth.users(id,email,email_confirmed_at) values
 ('12700000-0000-4000-8000-000000000001','manager127@cladora.test',statement_timestamp()),
 ('12700000-0000-4000-8000-000000000002','owner127@cladora.test',statement_timestamp()),
 ('12700000-0000-4000-8000-000000000003','outsider127@cladora.test',statement_timestamp());
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('12700000-0000-4000-8000-000000000004','Invite 127','INVITE127','active');
insert into portfolio.properties(id,tenant_id,type,name,status) values
 ('12700000-0000-4000-8000-000000000005','12700000-0000-4000-8000-000000000004','condominium','Invite property','active');
insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 ('12700000-0000-4000-8000-000000000006','12700000-0000-4000-8000-000000000004','12700000-0000-4000-8000-000000000005','A','Invite building');
insert into portfolio.units(id,tenant_id,building_id,code) values
 ('12700000-0000-4000-8000-000000000007','12700000-0000-4000-8000-000000000004','12700000-0000-4000-8000-000000000006','1');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('12700000-0000-4000-8000-000000000008','12700000-0000-4000-8000-000000000004','person','Owner 127'),
 ('12700000-0000-4000-8000-000000000009','12700000-0000-4000-8000-000000000004','person','No lease 127');
insert into portfolio.ownerships(tenant_id,unit_id,party_id,share,valid_from) values
 ('12700000-0000-4000-8000-000000000004','12700000-0000-4000-8000-000000000007','12700000-0000-4000-8000-000000000008',1,current_date);
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('12700000-0000-4000-8000-000000000010','12700000-0000-4000-8000-000000000004','ASSOCIATION','Invite test','ACTIVE'),
 ('12700000-0000-4000-8000-000000000013','12700000-0000-4000-8000-000000000004','HYBRID','Second workspace','ACTIVE');
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value,valid_from) values
 ('12700000-0000-4000-8000-000000000010','module.communications','boolean',true,statement_timestamp()-interval '1 day');
insert into platform.workspace_property_bindings(tenant_id,customer_workspace_id,property_id,binding_source)
values ('12700000-0000-4000-8000-000000000004','12700000-0000-4000-8000-000000000010',
 '12700000-0000-4000-8000-000000000005','migration_verified');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
select '12700000-0000-4000-8000-000000000011','12700000-0000-4000-8000-000000000004',
 '12700000-0000-4000-8000-000000000001',id,'active',statement_timestamp()-interval '1 day'
 from identity.roles where code='association_admin' and tenant_id is null;
insert into identity.context_grants(id,membership_id,tenant_id,scope_type,property_id,starts_at) values
 ('12700000-0000-4000-8000-000000000012','12700000-0000-4000-8000-000000000011','12700000-0000-4000-8000-000000000004','property',
 '12700000-0000-4000-8000-000000000005',statement_timestamp()-interval '1 day');

select ok(not has_table_privilege('authenticated','communications.unit_invitations','SELECT'),
 'Invitation table is not directly readable');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','12700000-0000-4000-8000-000000000001','role','authenticated','aal','aal1')::text,true);
select throws_ok($$select customer_api.create_unit_invitation_v1(
 '12700000-0000-4000-8000-000000000012','12700000-0000-4000-8000-000000000010','12700000-0000-4000-8000-000000000007','12700000-0000-4000-8000-000000000008','owner','owner127@cladora.test')$$,
 '42501','unit_invitation_denied','Manager requires MFA');
select set_config('request.jwt.claims',jsonb_build_object('sub','12700000-0000-4000-8000-000000000001','role','authenticated','aal','aal2')::text,true);
select throws_ok($$select customer_api.create_unit_invitation_v1(
 '12700000-0000-4000-8000-000000000012','12700000-0000-4000-8000-000000000013',
 '12700000-0000-4000-8000-000000000007','12700000-0000-4000-8000-000000000008','owner','owner127@cladora.test')$$,
 '42501','unit_invitation_denied','Cannot invite into a workspace without communications entitlement');
select throws_ok($$select customer_api.create_unit_invitation_v1(
 '12700000-0000-4000-8000-000000000012','12700000-0000-4000-8000-000000000010','12700000-0000-4000-8000-000000000007','12700000-0000-4000-8000-000000000009','tenant_resident','outsider127@cladora.test')$$,
 '42501','unit_relationship_required','Unverified lease cannot be invited');
select is(jsonb_array_length(customer_api.list_unit_invite_parties_v1('12700000-0000-4000-8000-000000000012','12700000-0000-4000-8000-000000000010','12700000-0000-4000-8000-000000000007')),1,
 'Manager sees only verified owner');
select set_config('test.invite127',customer_api.create_unit_invitation_v1(
 '12700000-0000-4000-8000-000000000012','12700000-0000-4000-8000-000000000010','12700000-0000-4000-8000-000000000007','12700000-0000-4000-8000-000000000008','owner','owner127@cladora.test')->>'id',true);
select ok(current_setting('test.invite127')::uuid is not null,'Manager creates a scoped invite');
select throws_ok($$select customer_api.register_unit_invite_relationship_v1(
 '12700000-0000-4000-8000-000000000012','12700000-0000-4000-8000-000000000013',
 '12700000-0000-4000-8000-000000000007','tenant_resident','Tenant 127','Verified lease reference 127')$$,
 '42501','unit_relationship_registration_denied','Unbound workspace cannot record tenant');
select throws_ok($$select customer_api.register_unit_invite_relationship_v1(
 '12700000-0000-4000-8000-000000000012','12700000-0000-4000-8000-000000000010',
 '12700000-0000-4000-8000-000000000007','owner','Other owner','Verified title reference 127')$$,
 '23505','existing_ownership_requires_review','Existing owner is not silently replaced');
select ok((customer_api.register_unit_invite_relationship_v1(
 '12700000-0000-4000-8000-000000000012','12700000-0000-4000-8000-000000000010',
 '12700000-0000-4000-8000-000000000007','tenant_resident','Tenant 127','Verified lease reference 127')->>'party_id') is not null,
 'Manager can record a tenant relationship after ownership');
select throws_ok($$select customer_api.register_unit_invite_relationship_v1(
 '12700000-0000-4000-8000-000000000012','12700000-0000-4000-8000-000000000010',
 '12700000-0000-4000-8000-000000000007','tenant_resident','Second tenant','Verified lease reference 128')$$,
 '23505','existing_lease_requires_review','Active lease is not silently replaced');
select throws_ok($$select customer_api.create_unit_invitation_v1(
 '12700000-0000-4000-8000-000000000012','12700000-0000-4000-8000-000000000010',
 '12700000-0000-4000-8000-000000000007','12700000-0000-4000-8000-000000000009','owner','owner127@cladora.test')$$,
 '42501','unit_relationship_required','Unverified relationship cannot replace existing invitation');
reset role;
select is((select workspace_id::text from communications.unit_invitations where id=current_setting('test.invite127')::uuid),
 '12700000-0000-4000-8000-000000000010','Invitation retains selected workspace');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','12700000-0000-4000-8000-000000000003','role','authenticated','aal','aal2')::text,true);
select throws_ok($$select customer_api.claim_unit_invitation_v1(current_setting('test.invite127')::uuid,'Outsider')$$,
 '42501','unit_invitation_denied','Another email cannot claim invite');
select set_config('request.jwt.claims',jsonb_build_object('sub','12700000-0000-4000-8000-000000000002','role','authenticated','aal','aal2')::text,true);
select is(jsonb_array_length(customer_api.list_my_unit_invitations_v1()),1,'Only email owner discovers invite');
select ok((customer_api.claim_unit_invitation_v1(current_setting('test.invite127')::uuid,'Owner 127')->>'membership_id') is not null,
 'Verified owner accepts invitation');
reset role;
select ok(exists(select 1 from identity.memberships m join identity.context_grants g on g.membership_id=m.id
  where m.user_id='12700000-0000-4000-8000-000000000002' and g.scope_type='unit'
  and g.unit_id='12700000-0000-4000-8000-000000000007'),
  'Acceptance grants only the invited unit');
set local role authenticated;
select is(jsonb_array_length(customer_api.list_my_unit_invitations_v1()),0,'Claimed invite leaves pending list');
select * from finish();
rollback;
