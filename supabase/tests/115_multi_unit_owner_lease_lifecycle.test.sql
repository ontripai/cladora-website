begin;
set local search_path=public,extensions;
select plan(6);
insert into auth.users(id,email,email_confirmed_at) values
('a1150000-0000-4000-8000-000000000001','lease-owner-115@cladora.test',now()),
('a1150000-0000-4000-8000-000000000002','lease-manager-115@cladora.test',now()),
('a1150000-0000-4000-8000-000000000003','lease-admin-115@cladora.test',now()),
('a1150000-0000-4000-8000-000000000004','lease-stranger-115@cladora.test',now());
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status)
values('b1150000-0000-4000-8000-000000000003','a1150000-0000-4000-8000-000000000003','OWNER-LEASE-115','Link Admin','active');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason)
values('b1150000-0000-4000-8000-000000000003','PLATFORM_SUPER_ADMIN','Link test');
insert into platform.tenants(id,legal_name,registration_number,status) values
('c1150000-0000-4000-8000-000000000001','Owner Private Tenant 115','CLD-115-PERSONAL','active'),
('c1150000-0000-4000-8000-000000000002','Building Tenant 115','CLD-115-BUILDING','active');
insert into public.marketing_leads(id,reference_id,lead_type,full_name,email,locale,consent_privacy,applicant_type)
values('d1150000-0000-4000-8000-000000000001','OWNER-LEASE-115','pilot','Link Owner','lease-owner-115@cladora.test','ro',true,'multi_unit_owner');
insert into platform.customer_cases(id,lead_id,customer_email,created_by)
values('e1150000-0000-4000-8000-000000000001','d1150000-0000-4000-8000-000000000001','lease-owner-115@cladora.test','a1150000-0000-4000-8000-000000000003');
insert into platform.customer_case_participants(case_id,auth_user_id)
values('e1150000-0000-4000-8000-000000000001','a1150000-0000-4000-8000-000000000001');
insert into identity.memberships(id,tenant_id,user_id,role_id,status,ends_at) values
('f1150000-0000-4000-8000-000000000001','c1150000-0000-4000-8000-000000000001','a1150000-0000-4000-8000-000000000001',(select id from identity.roles where tenant_id is null and code='multi_unit_owner'),'active',now()+interval '72 hours'),
('f1150000-0000-4000-8000-000000000002','c1150000-0000-4000-8000-000000000002','a1150000-0000-4000-8000-000000000002',(select id from identity.roles where tenant_id is null and code='association_admin'),'active',null);
insert into platform.owner_portfolio_pilots(case_id,owner_user_id,tenant_id,membership_id,approved_by,approval_reason,expires_at)
values('e1150000-0000-4000-8000-000000000001','a1150000-0000-4000-8000-000000000001','c1150000-0000-4000-8000-000000000001','f1150000-0000-4000-8000-000000000001','a1150000-0000-4000-8000-000000000003','Verified linked unit test case',now()+interval '72 hours');
insert into public.owner_private_units(id,owner_user_id,building_label,unit_label,address_text)
values('01150000-0000-4000-8000-000000000001','a1150000-0000-4000-8000-000000000001','Personal building','A1','Bucharest Sector 2');
insert into public.owner_private_units(id,owner_user_id,building_label,unit_label,address_text)
values('01150000-0000-4000-8000-000000000002','a1150000-0000-4000-8000-000000000001','Other private building','B2','Bucharest Sector 3');
insert into public.owner_private_leases(id,owner_user_id,unit_id,tenant_label,starts_on,ends_on,monthly_rent,currency)
values('11150000-0000-4000-8000-000000000001','a1150000-0000-4000-8000-000000000001','01150000-0000-4000-8000-000000000001','Private tenant',current_date-10,current_date+300,1200,'RON');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1150000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$update public.owner_private_leases set status='active' where id='11150000-0000-4000-8000-000000000001'$$,'Owner activates draft lease');
select throws_like($$update public.owner_private_leases set monthly_rent=1300 where id='11150000-0000-4000-8000-000000000001'$$,'%active_lease_terms_immutable%','Agreed amount cannot silently change');
select throws_like($$update public.owner_private_leases set status='draft' where id='11150000-0000-4000-8000-000000000001'$$,'%invalid_lease_transition%','Active lease cannot revert to draft');
select throws_like($$insert into public.owner_private_cash_entries(owner_user_id,unit_id,lease_id,kind,direction,amount,due_on,paid_on)
values('a1150000-0000-4000-8000-000000000001','01150000-0000-4000-8000-000000000002','11150000-0000-4000-8000-000000000001','rent','income',100,current_date,current_date)$$,'%foreign key%','Lease payment cannot attach to a different unit');
select lives_ok($$insert into public.owner_private_cash_entries(owner_user_id,unit_id,lease_id,kind,direction,amount,due_on,paid_on)
values('a1150000-0000-4000-8000-000000000001','01150000-0000-4000-8000-000000000001','11150000-0000-4000-8000-000000000001','rent','income',1200,current_date,current_date)$$,'Owner records a self-reported linked rent receipt');
select lives_ok($$update public.owner_private_leases set status='ended' where id='11150000-0000-4000-8000-000000000001'$$,'Owner ends active lease');
select * from finish();
rollback;
