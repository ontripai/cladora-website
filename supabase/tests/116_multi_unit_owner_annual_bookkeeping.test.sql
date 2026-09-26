begin;
set local search_path=public,extensions;
select plan(4);
insert into auth.users(id,email,email_confirmed_at) values
('a1160000-0000-4000-8000-000000000001','book-owner-116@cladora.test',now()),
('a1160000-0000-4000-8000-000000000002','book-manager-116@cladora.test',now()),
('a1160000-0000-4000-8000-000000000003','book-admin-116@cladora.test',now()),
('a1160000-0000-4000-8000-000000000004','book-stranger-116@cladora.test',now());
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status)
values('b1160000-0000-4000-8000-000000000003','a1160000-0000-4000-8000-000000000003','OWNER-BOOK-116','Link Admin','active');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason)
values('b1160000-0000-4000-8000-000000000003','PLATFORM_SUPER_ADMIN','Link test');
insert into platform.tenants(id,legal_name,registration_number,status) values
('c1160000-0000-4000-8000-000000000001','Owner Private Tenant 116','CLD-116-PERSONAL','active'),
('c1160000-0000-4000-8000-000000000002','Building Tenant 116','CLD-116-BUILDING','active');
insert into public.marketing_leads(id,reference_id,lead_type,full_name,email,locale,consent_privacy,applicant_type)
values('d1160000-0000-4000-8000-000000000001','OWNER-BOOK-116','pilot','Link Owner','book-owner-116@cladora.test','ro',true,'multi_unit_owner');
insert into platform.customer_cases(id,lead_id,customer_email,created_by)
values('e1160000-0000-4000-8000-000000000001','d1160000-0000-4000-8000-000000000001','book-owner-116@cladora.test','a1160000-0000-4000-8000-000000000003');
insert into platform.customer_case_participants(case_id,auth_user_id)
values('e1160000-0000-4000-8000-000000000001','a1160000-0000-4000-8000-000000000001');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,ends_at) values
('f1160000-0000-4000-8000-000000000001','c1160000-0000-4000-8000-000000000001','a1160000-0000-4000-8000-000000000001',(select id from identity.roles where tenant_id is null and code='multi_unit_owner'),'active',now()+interval '72 hours'),
('f1160000-0000-4000-8000-000000000002','c1160000-0000-4000-8000-000000000002','a1160000-0000-4000-8000-000000000002',(select id from identity.roles where tenant_id is null and code='association_admin'),'active',null);
insert into platform.owner_portfolio_pilots(case_id,owner_user_id,tenant_id,membership_id,approved_by,approval_reason,expires_at)
values('e1160000-0000-4000-8000-000000000001','a1160000-0000-4000-8000-000000000001','c1160000-0000-4000-8000-000000000001','f1160000-0000-4000-8000-000000000001','a1160000-0000-4000-8000-000000000003','Verified linked unit test case',now()+interval '72 hours');
insert into public.owner_private_units(id,owner_user_id,building_label,unit_label,address_text)
values('01160000-0000-4000-8000-000000000001','a1160000-0000-4000-8000-000000000001','Personal building','A1','Bucharest Sector 2');
insert into public.owner_private_cash_entries(owner_user_id,unit_id,kind,direction,amount,currency,paid_on)
values('a1160000-0000-4000-8000-000000000001','01160000-0000-4000-8000-000000000001','rent','income',100,'RON',make_date(2025,6,1)),
('a1160000-0000-4000-8000-000000000001','01160000-0000-4000-8000-000000000001','rent','income',200,'RON',make_date(2025,7,1)),
('a1160000-0000-4000-8000-000000000001','01160000-0000-4000-8000-000000000001','rent','income',300,'EUR',make_date(2025,8,1)),
('a1160000-0000-4000-8000-000000000001','01160000-0000-4000-8000-000000000001','rent','income',400,'RON',make_date(2024,6,1));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1160000-0000-4000-8000-000000000004","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.owner_annual_bookkeeping_v1(2025)$$,'%owner_role_required%','Unassigned actor denied');
select set_config('request.jwt.claims','{"sub":"a1160000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.owner_annual_bookkeeping_v1(2025)->'groups'),2,'Currencies remain separate');
select is((select (x->>'amount')::numeric from jsonb_array_elements(customer_api.owner_annual_bookkeeping_v1(2025)->'groups') x where x->>'currency'='RON'),300::numeric,'Only payments in selected year are summed');
select throws_like($$select customer_api.owner_annual_bookkeeping_v1(1999)$$,'%invalid_year%','Year bounds enforced');
select * from finish();
rollback;
