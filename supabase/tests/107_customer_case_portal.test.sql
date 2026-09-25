begin;
set local search_path=public,extensions;
select plan(14);

insert into auth.users(id,email,email_confirmed_at) values
('a7010000-0000-4000-8000-000000000001','case-admin@cladora.test',now()),
('a7010000-0000-4000-8000-000000000002','case-customer@cladora.test',now()),
('a7010000-0000-4000-8000-000000000003','case-stranger@cladora.test',now());
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status)
values('b7010000-0000-4000-8000-000000000001','a7010000-0000-4000-8000-000000000001','EMP-CASE-ADMIN','Case Admin','active');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason)
values('b7010000-0000-4000-8000-000000000001','PLATFORM_SUPER_ADMIN','Case test admin');
insert into public.marketing_leads(id,reference_id,lead_type,full_name,email,locale,consent_privacy)
values('c7010000-0000-4000-8000-000000000001','CASE-107-1','pilot','Customer Example','case-customer@cladora.test','fa',true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a7010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select customer_api.open_customer_case_v1('c7010000-0000-4000-8000-000000000001','Verified customer identity before invitation')$$,'Admin opens case and prepares invitation');
select set_config('case.test.case_id',customer_api.open_customer_case_v1('c7010000-0000-4000-8000-000000000001','Case reference for the test')->>'case_id',true);
select set_config('case.test.invite_id',customer_api.open_customer_case_v1('c7010000-0000-4000-8000-000000000001','Invite reference for the test')->>'invitation_id',true);
select is(jsonb_array_length(customer_api.my_case_invitations_v1()),0,'Admin has no customer invitations');
select lives_ok($$select customer_api.post_customer_case_message_v1(current_setting('case.test.case_id')::uuid,'Internal handoff','internal')$$,'Staff writes internal note');

select set_config('request.jwt.claims','{"sub":"a7010000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.my_case_invitations_v1()),0,'Another verified account cannot find invitation');
select throws_like($$select customer_api.claim_customer_case_v1(current_setting('case.test.invite_id')::uuid)$$,'%invitation_unavailable%','Forwarded invitation ID does not grant access');

select set_config('request.jwt.claims','{"sub":"a7010000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select throws_like($$select customer_api.my_case_invitations_v1()$$,'%aal2_required%','AAL1 cannot enumerate case invitations');
select set_config('request.jwt.claims','{"sub":"a7010000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.my_case_invitations_v1()),1,'Matching verified customer sees invitation');
select lives_ok($$select customer_api.claim_customer_case_v1(current_setting('case.test.invite_id')::uuid)$$,'Matching customer claims case');
select is(jsonb_array_length(customer_api.my_customer_cases_v1()),1,'Customer sees own case');
select is(jsonb_array_length((customer_api.get_customer_case_v1(current_setting('case.test.case_id')::uuid)->'messages')),0,'Internal note remains invisible to customer');
select throws_like($$select customer_api.post_customer_case_message_v1(current_setting('case.test.case_id')::uuid,'Trying internal','internal')$$,'%invalid_case_message%','Customer cannot write internal note');
select lives_ok($$select customer_api.post_customer_case_message_v1(current_setting('case.test.case_id')::uuid,'Hello from customer','shared')$$,'Customer sends shared reply');
select is(jsonb_array_length((customer_api.get_customer_case_v1(current_setting('case.test.case_id')::uuid)->'messages')),1,'Shared reply is visible to customer');
select throws_like($$select customer_api.open_customer_case_v1('c7010000-0000-4000-8000-000000000001','Unauthorized case operation')$$,'%platform_access_required%','Customer cannot use staff case creation gateway');
select * from finish();
rollback;
