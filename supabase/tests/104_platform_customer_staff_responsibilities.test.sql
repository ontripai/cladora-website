begin;
set local search_path = public, extensions;
select plan(12);

insert into auth.users(id,email) values
('a4010000-0000-4000-8000-000000000001','staff-admin@cladora.test'),
('a4010000-0000-4000-8000-000000000002','staff-sales@cladora.test'),
('a4010000-0000-4000-8000-000000000003','staff-ops@cladora.test'),
('a4010000-0000-4000-8000-000000000004','staff-second@cladora.test');
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status) values
('b4010000-0000-4000-8000-000000000001','a4010000-0000-4000-8000-000000000001','EMP-STF-ADM','Staff Admin','active'),
('b4010000-0000-4000-8000-000000000002','a4010000-0000-4000-8000-000000000002','EMP-STF-SAL','Staff Sales','active'),
('b4010000-0000-4000-8000-000000000003','a4010000-0000-4000-8000-000000000003','EMP-STF-OPS','Staff Ops','active'),
('b4010000-0000-4000-8000-000000000004','a4010000-0000-4000-8000-000000000004','EMP-STF-SEC','Staff Second','active');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason) values
('b4010000-0000-4000-8000-000000000001','PLATFORM_SUPER_ADMIN','Test admin'),
('b4010000-0000-4000-8000-000000000002','PLATFORM_SALES','Test sales'),
('b4010000-0000-4000-8000-000000000002','PLATFORM_ONBOARDING','Second duty'),
('b4010000-0000-4000-8000-000000000003','PLATFORM_OPERATIONS','Test ops'),
('b4010000-0000-4000-8000-000000000004','PLATFORM_SALES','Test backup');
insert into platform.tenants(id,legal_name,registration_number)
values('c4010000-0000-4000-8000-000000000001','Staff responsibility pilot','RO-STAFF-104');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner)
values('d4010000-0000-4000-8000-000000000001','c4010000-0000-4000-8000-000000000001','ASSOCIATION','Historical owner');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a4010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select platform.assign_customer_staff_responsibility('d4010000-0000-4000-8000-000000000001','b4010000-0000-4000-8000-000000000002','commercial_owner','First sales owner')$$,'Sales specialist owns customer');
select lives_ok($$select platform.assign_customer_staff_responsibility('d4010000-0000-4000-8000-000000000001','b4010000-0000-4000-8000-000000000002','onboarding_trainer','Same person trains')$$,'One account has independent duties');
select throws_like($$select platform.assign_customer_staff_responsibility('d4010000-0000-4000-8000-000000000001','b4010000-0000-4000-8000-000000000003','sales_collaborator','Operations should fail')$$,'%staff_role_required%','Operations role is insufficient for sales');
select throws_like($$select platform.assign_customer_staff_responsibility('d4010000-0000-4000-8000-000000000001','b4010000-0000-4000-8000-000000000004','commercial_owner','Second sales owner')$$,'%owner_transfer_required%','Second owner cannot be added without transfer');
select lives_ok($$select platform.transfer_customer_commercial_owner('d4010000-0000-4000-8000-000000000001','b4010000-0000-4000-8000-000000000004','Transfer with reason')$$,'Owner transfer succeeds atomically');
select is((select count(*)::integer from platform.customer_staff_responsibilities where responsibility='commercial_owner' and status='active'),1,'Exactly one current owner');
select is((select count(*)::integer from platform.customer_staff_responsibilities where responsibility='onboarding_trainer' and status='active'),1,'Training duty survives owner transfer');
select throws_like($$update platform.customer_staff_responsibilities set responsibility='finance_reviewer' where status='active'$$,'%permission denied%','Client cannot edit responsibility directly');

select set_config('request.jwt.claims','{"sub":"a4010000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select is((select count(*)::integer from customer_api.customer_staff_responsibilities_v1),2,'Sales sees only own records, including history');
select throws_like($$select platform.transfer_customer_commercial_owner('d4010000-0000-4000-8000-000000000001','b4010000-0000-4000-8000-000000000002','Unauthorized attempt')$$,'%access_denied%','Sales cannot transfer owner');
select set_config('request.jwt.claims','{"sub":"a4010000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal1"}',true);
select is((select count(*)::integer from customer_api.customer_staff_responsibilities_v1),0,'AAL1 cannot read coverage');
select throws_like($$select platform.assign_customer_staff_responsibility('d4010000-0000-4000-8000-000000000001','b4010000-0000-4000-8000-000000000002','sales_collaborator','AAL1 denied')$$,'%access_denied%','AAL1 cannot assign staff');

select * from finish();
rollback;
