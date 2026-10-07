begin;
set local search_path = public, extensions;
select plan(8);

insert into auth.users(id,email,email_confirmed_at) values
('a5010000-0000-4000-8000-000000000001','multi-admin@cladora.test',now()),
('a5010000-0000-4000-8000-000000000002','multi-worker@cladora.test',now());
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status)
values('b5010000-0000-4000-8000-000000000001','a5010000-0000-4000-8000-000000000001','EMP-MULTI-ADM','Multi Admin','active');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason)
values('b5010000-0000-4000-8000-000000000001','PLATFORM_SUPER_ADMIN','Test admin');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a5010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.create_platform_operator_multi_role_v1('multi-worker@cladora.test','EMP-MULTI-WRK','Multi Worker',array['PLATFORM_SALES','PLATFORM_SUPER_ADMIN'],'Invalid role rejected')$$,'%invalid_role_grant%','Invalid second role rolls back the first');
select is((select count(*)::integer from platform.platform_users where employee_ref='EMP-MULTI-WRK'),0,'Failed creation leaves no operator');
select lives_ok($$select customer_api.create_platform_operator_multi_role_v1('multi-worker@cladora.test','EMP-MULTI-WRK','Multi Worker',array['PLATFORM_SALES','PLATFORM_ONBOARDING'],'Multiple initial duties')$$,'Creates one operator with two roles');
select is((select count(*)::integer from platform.platform_role_assignments a join platform.platform_users u on u.id=a.platform_user_id where u.employee_ref='EMP-MULTI-WRK' and a.status='active'),2,'Both initial roles active');
select lives_ok($$select customer_api.grant_platform_operator_roles_v1((select id from platform.platform_users where employee_ref='EMP-MULTI-WRK'),array['PLATFORM_SALES','PLATFORM_FINANCE'],'Add finance duty')$$,'Existing role skipped while granting another');
select is((select count(*)::integer from platform.platform_role_assignments a join platform.platform_users u on u.id=a.platform_user_id where u.employee_ref='EMP-MULTI-WRK' and a.status='active'),3,'No duplicate role assignment');
select set_config('request.jwt.claims','{"sub":"a5010000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.grant_platform_operator_roles_v1((select id from platform.platform_users where employee_ref='EMP-MULTI-WRK'),array['PLATFORM_SUPPORT'],'Unauthorized role grant')$$,'%access_denied%','Ordinary employee cannot grant roles');
reset role;
select is((select count(*)::integer from platform.platform_role_assignments a join platform.platform_users u on u.id=a.platform_user_id where u.employee_ref='EMP-MULTI-WRK' and a.status='active'),3,'Unauthorized attempt leaves assignments unchanged');
select * from finish();
rollback;
