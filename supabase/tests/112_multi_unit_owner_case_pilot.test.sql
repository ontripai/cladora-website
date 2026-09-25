begin;
set local search_path=public,extensions;
select plan(9);

insert into auth.users(id,email,email_confirmed_at) values
('a1120000-0000-4000-8000-000000000001','pilot-admin-112@cladora.test',now()),
('a1120000-0000-4000-8000-000000000002','pilot-owner-112@cladora.test',now()),
('a1120000-0000-4000-8000-000000000003','pilot-stranger-112@cladora.test',now());
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status)
values('b1120000-0000-4000-8000-000000000001','a1120000-0000-4000-8000-000000000001','OWNER-PILOT-112','Pilot Admin','active');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason)
values('b1120000-0000-4000-8000-000000000001','PLATFORM_SUPER_ADMIN','Owner pilot test');
insert into public.marketing_leads(id,reference_id,lead_type,full_name,email,locale,consent_privacy,applicant_type)
values('c1120000-0000-4000-8000-000000000001','OWNER-PILOT-112','pilot','Pilot Portfolio Owner','pilot-owner-112@cladora.test','ro',true,'multi_unit_owner');
insert into platform.customer_cases(id,lead_id,customer_email,created_by)
values('d1120000-0000-4000-8000-000000000001','c1120000-0000-4000-8000-000000000001','pilot-owner-112@cladora.test','a1120000-0000-4000-8000-000000000001');
insert into platform.customer_case_participants(case_id,auth_user_id)
values('d1120000-0000-4000-8000-000000000001','a1120000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a1120000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.activate_owner_portfolio_pilot_v1('d1120000-0000-4000-8000-000000000001',24,'Unauthorized owner pilot approval')$$,'%platform_access_required%','Unassigned actor cannot approve pilot');
select set_config('request.jwt.claims','{"sub":"a1120000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_like($$select customer_api.activate_owner_portfolio_pilot_v1('d1120000-0000-4000-8000-000000000001',24,'Approval without MFA denied')$$,'%aal2%','Platform approval requires MFA');
select set_config('request.jwt.claims','{"sub":"a1120000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.activate_owner_portfolio_pilot_v1('d1120000-0000-4000-8000-000000000001',100,'Invalid pilot duration denied')$$,'%invalid_approval%','Duration cannot exceed defined pilot options');
select lives_ok($$select customer_api.activate_owner_portfolio_pilot_v1('d1120000-0000-4000-8000-000000000001',24,'Approved case for verified customer')$$,'Superadmin approves verified owner case');
reset role;
select is((select count(*)::integer from platform.owner_portfolio_pilots where case_id='d1120000-0000-4000-8000-000000000001'),1,'One auditable decision per case');
select is((select count(*)::integer from identity.context_grants g join platform.owner_portfolio_pilots p on p.membership_id=g.membership_id where p.case_id='d1120000-0000-4000-8000-000000000001'),0,'Pilot has no building context grant');
set local role authenticated;
select throws_like($$select customer_api.activate_owner_portfolio_pilot_v1('d1120000-0000-4000-8000-000000000001',24,'Cannot issue duplicate owner trial')$$,'%pilot_already_decided%','Duplicate pilot denied');
select set_config('request.jwt.claims','{"sub":"a1120000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is(app_private.has_multi_unit_owner_role_v1(),true,'Approved owner can access private ledger');
select set_config('request.jwt.claims','{"sub":"a1120000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select customer_api.revoke_owner_portfolio_pilot_v1('d1120000-0000-4000-8000-000000000001','Customer cancelled the pilot')$$,'Superadmin revokes pilot');
select * from finish();
rollback;
