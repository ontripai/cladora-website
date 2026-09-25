begin;
set local search_path = public, extensions;
select plan(10);

insert into auth.users(id,email) values
('a6010000-0000-4000-8000-000000000001','inbox-admin@cladora.test'),
('a6010000-0000-4000-8000-000000000002','inbox-sales@cladora.test'),
('a6010000-0000-4000-8000-000000000003','inbox-other@cladora.test');
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status) values
('b6010000-0000-4000-8000-000000000001','a6010000-0000-4000-8000-000000000001','EMP-INBOX-ADMIN','Inbox Admin','active'),
('b6010000-0000-4000-8000-000000000002','a6010000-0000-4000-8000-000000000002','EMP-INBOX-SALES','Inbox Sales','active'),
('b6010000-0000-4000-8000-000000000003','a6010000-0000-4000-8000-000000000003','EMP-INBOX-OTHER','Inbox Other','active');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason) values
('b6010000-0000-4000-8000-000000000001','PLATFORM_SUPER_ADMIN','Inbox admin'),
('b6010000-0000-4000-8000-000000000002','PLATFORM_SALES','Inbox sales'),
('b6010000-0000-4000-8000-000000000003','PLATFORM_SUPPORT','Inbox other');
insert into public.marketing_leads(id,reference_id,lead_type,full_name,email,locale,consent_privacy)
values('c6010000-0000-4000-8000-000000000001','INBOX-106-1','pilot','Start Tester','tester@cladora.test','fa',true);
select is((select assigned_platform_user_id from public.marketing_leads where reference_id='INBOX-106-1'),
  'b6010000-0000-4000-8000-000000000002'::uuid,'New lead gets active salesperson');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a6010000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is(jsonb_array_length(customer_api.list_start_requests_v1(10)),1,'Salesperson sees own lead');
select throws_like($$select customer_api.assign_start_request_v1('c6010000-0000-4000-8000-000000000001',null,'Unauthorized owner removal')$$,'%access_denied%','Salesperson cannot reassign');
select lives_ok($$select customer_api.update_start_request_v1('c6010000-0000-4000-8000-000000000001','contacted','Called the customer')$$,'Salesperson records follow-up');
select throws_like($$select customer_api.update_start_request_v1('c6010000-0000-4000-8000-000000000001','converted','Bypass contract review')$$,'%invalid_start_request_update%','Cannot bypass contract and finance approval');
select set_config('request.jwt.claims','{"sub":"a6010000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.list_start_requests_v1(10)$$,'%access_denied%','Support cannot read sales inbox');
select throws_like($$select customer_api.update_start_request_v1('c6010000-0000-4000-8000-000000000001','qualified','Unauthorized qualification')$$,'%access_denied%','Unrelated staff cannot update lead');
select set_config('request.jwt.claims','{"sub":"a6010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.assign_start_request_v1('c6010000-0000-4000-8000-000000000001','b6010000-0000-4000-8000-000000000003','Invalid sales role')$$,'%active_sales_required%','Manager cannot assign to non-sales role');
select lives_ok($$select customer_api.assign_start_request_v1('c6010000-0000-4000-8000-000000000001',null,'Return to manager queue')$$,'Manager can put request in unassigned queue');
reset role;
select is((select assigned_platform_user_id from public.marketing_leads where reference_id='INBOX-106-1'),null::uuid,'Unassigned lead remains in manager queue');
select * from finish();
rollback;
