begin;
set local search_path=public,extensions;
select plan(13);

select ok(exists(select 1 from identity.roles where code='multi_unit_owner' and tenant_id is null and is_system),'Dedicated global role exists');
select is((select count(*)::integer from identity.role_permissions rp join identity.roles r on r.id=rp.role_id where r.code='multi_unit_owner'),0,'No inherited workspace permissions');
select ok(not has_table_privilege('anon','public.owner_private_units','SELECT'),'Anonymous callers have no private inventory access');
select ok(not has_table_privilege('authenticated','public.owner_private_units','DELETE'),'Authenticated callers cannot delete private inventory');

insert into auth.users(id,email,email_confirmed_at) values
('a1110000-0000-4000-8000-000000000001','portfolio-owner-a@cladora.test',now()),
('a1110000-0000-4000-8000-000000000002','portfolio-owner-b@cladora.test',now()),
('a1110000-0000-4000-8000-000000000003','portfolio-unassigned@cladora.test',now());
insert into platform.tenants(id,legal_name,registration_number,status)
values('b1110000-0000-4000-8000-000000000001','Portfolio Owner Test A','CLD-111-OWNER-A','active'),
('b1110000-0000-4000-8000-000000000002','Portfolio Owner Test B','CLD-111-OWNER-B','active');
insert into identity.memberships(tenant_id,user_id,role_id,status) values
('b1110000-0000-4000-8000-000000000001','a1110000-0000-4000-8000-000000000001',(select id from identity.roles where tenant_id is null and code='multi_unit_owner'),'active'),
('b1110000-0000-4000-8000-000000000002','a1110000-0000-4000-8000-000000000002',(select id from identity.roles where tenant_id is null and code='multi_unit_owner'),'active');
insert into public.marketing_leads(id,reference_id,lead_type,full_name,email,locale,consent_privacy,applicant_type)
values('d1110000-0000-4000-8000-000000000001','OWNER-111-A','pilot','Test Owner A','portfolio-owner-a@cladora.test','ro',true,'multi_unit_owner'),
('d1110000-0000-4000-8000-000000000002','OWNER-111-B','pilot','Test Owner B','portfolio-owner-b@cladora.test','ro',true,'multi_unit_owner');
insert into platform.customer_cases(id,lead_id,customer_email,created_by)
values('e1110000-0000-4000-8000-000000000001','d1110000-0000-4000-8000-000000000001','portfolio-owner-a@cladora.test','a1110000-0000-4000-8000-000000000001'),
('e1110000-0000-4000-8000-000000000002','d1110000-0000-4000-8000-000000000002','portfolio-owner-b@cladora.test','a1110000-0000-4000-8000-000000000002');
insert into platform.customer_case_participants(case_id,auth_user_id)
values('e1110000-0000-4000-8000-000000000001','a1110000-0000-4000-8000-000000000001'),
('e1110000-0000-4000-8000-000000000002','a1110000-0000-4000-8000-000000000002');
insert into platform.owner_portfolio_pilots(case_id,owner_user_id,tenant_id,membership_id,approved_by,approval_reason,expires_at)
values('e1110000-0000-4000-8000-000000000001','a1110000-0000-4000-8000-000000000001','b1110000-0000-4000-8000-000000000001',
 (select id from identity.memberships where user_id='a1110000-0000-4000-8000-000000000001' and tenant_id='b1110000-0000-4000-8000-000000000001'),
 'a1110000-0000-4000-8000-000000000001','Test approved multi-unit owner A',now()+interval '72 hours'),
('e1110000-0000-4000-8000-000000000002','a1110000-0000-4000-8000-000000000002','b1110000-0000-4000-8000-000000000002',
 (select id from identity.memberships where user_id='a1110000-0000-4000-8000-000000000002' and tenant_id='b1110000-0000-4000-8000-000000000002'),
 'a1110000-0000-4000-8000-000000000002','Test approved multi-unit owner B',now()+interval '72 hours');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1110000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select is(app_private.has_multi_unit_owner_role_v1(),false,'AAL1 cannot use private portfolio');
select throws_like($$insert into public.owner_private_units(building_label,unit_label,address_text) values('Building A','A1','Bucharest Sector 2')$$,'%row-level security%','AAL1 cannot create units');

select set_config('request.jwt.claims','{"sub":"a1110000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
insert into public.owner_private_units(id,building_label,unit_label,address_text) values
('c1110000-0000-4000-8000-000000000001','Building A','A1','Bucharest Sector 2'),
('c1110000-0000-4000-8000-000000000002','Building B','B2','Bucharest Sector 3');
select is((select count(*)::integer from public.owner_private_units),2,'One owner can track units in two buildings');
insert into public.owner_private_leases(owner_user_id,unit_id,tenant_label,starts_on,monthly_rent)
values('a1110000-0000-4000-8000-000000000001','c1110000-0000-4000-8000-000000000001','Test Tenant',current_date,1000);
insert into public.owner_private_cash_entries(owner_user_id,unit_id,kind,direction,amount)
values('a1110000-0000-4000-8000-000000000001','c1110000-0000-4000-8000-000000000001','rent','income',1000);
select throws_like($$insert into public.owner_private_units(owner_user_id,building_label,unit_label,address_text) values('a1110000-0000-4000-8000-000000000002','Impersonated','B1','Bucharest Sector 1')$$,'%row-level security%','Owner cannot impersonate another account');

select set_config('request.jwt.claims','{"sub":"a1110000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from public.owner_private_units),0,'Another approved owner sees no first-owner units');
select is((select count(*)::integer from public.owner_private_leases),0,'Another owner sees no first-owner leases');
select is((select count(*)::integer from public.owner_private_cash_entries),0,'Another owner sees no first-owner cash entries');
select throws_like($$insert into public.owner_private_leases(unit_id,tenant_label,starts_on,monthly_rent) values('c1110000-0000-4000-8000-000000000001','Cross-owner',current_date,1000)$$,'%foreign key%','Composite FK blocks leasing another owner unit');

select set_config('request.jwt.claims','{"sub":"a1110000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select is(app_private.has_multi_unit_owner_role_v1(),false,'Unassigned account has no portfolio role');
select * from finish();
rollback;
