begin;
set local search_path=public,extensions;
select plan(10);

insert into auth.users(id,email,email_confirmed_at) values
('a8010000-0000-4000-8000-000000000001','file-admin@cladora.test',now()),
('a8010000-0000-4000-8000-000000000002','file-customer@cladora.test',now()),
('a8010000-0000-4000-8000-000000000003','file-auditor@cladora.test',now());
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name,status) values
('b8010000-0000-4000-8000-000000000001','a8010000-0000-4000-8000-000000000001','EMP-FILE-ADMIN','File Admin','active'),
('b8010000-0000-4000-8000-000000000003','a8010000-0000-4000-8000-000000000003','EMP-FILE-AUD','File Auditor','active');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason) values
('b8010000-0000-4000-8000-000000000001','PLATFORM_SUPER_ADMIN','Case admin'),
('b8010000-0000-4000-8000-000000000003','PLATFORM_AUDITOR','Case auditor');
insert into public.marketing_leads(id,reference_id,lead_type,full_name,email,locale,consent_privacy)
values('c8010000-0000-4000-8000-000000000001','CASE-108-1','pilot','File Tester','file-customer@cladora.test','fa',true);

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a8010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',true);
select set_config('case.test.id',customer_api.open_customer_case_v1('c8010000-0000-4000-8000-000000000001','Verify customer before case invite')->>'case_id',true);
select lives_ok($$select customer_api.assign_customer_case_staff_v1(current_setting('case.test.id')::uuid,'b8010000-0000-4000-8000-000000000003','audit','active','Independent review of submitted files')$$,'Admin assigns scoped auditor');
select throws_like($$select customer_api.link_customer_case_workspace_v1(current_setting('case.test.id')::uuid,'d8010000-0000-4000-8000-000000000001',null,'Premature link forbidden')$$,'%approved_access_basis_required%','No workspace link without approved basis');
select set_config('case.test.version',customer_api.begin_customer_case_document_v1(current_setting('case.test.id')::uuid,null,'Internal evidence','internal','application/pdf',6,repeat('a',64))->>'version_id',true);
select is(jsonb_array_length(customer_api.get_customer_case_documents_v1(current_setting('case.test.id')::uuid)),1,'Staff sees internal pending version');
select throws_like($$select customer_api.get_customer_case_download_v1(current_setting('case.test.version')::uuid)$$,'%scan_clearance_required%','Unreviewed file cannot download');
select throws_like($$select customer_api.review_customer_case_document_v1(current_setting('case.test.version')::uuid,'clean','Independent scan evidence for review')$$,'%independent_review_required%','Uploader cannot clear own file');

select set_config('request.jwt.claims','{"sub":"a8010000-0000-4000-8000-000000000003","role":"authenticated","aal":"aal2"}',true);
select lives_ok($$select customer_api.get_customer_case_v1(current_setting('case.test.id')::uuid)$$,'Assigned auditor reads scoped case');
select throws_like($$select customer_api.review_customer_case_document_v1(current_setting('case.test.version')::uuid,'clean','Independent scan evidence for review')$$,'%file_not_uploaded%','Reviewer cannot clear a file absent from private storage');
select throws_like($$select customer_api.get_customer_case_download_v1(current_setting('case.test.version')::uuid)$$,'%scan_clearance_required%','Assigned auditor cannot bypass quarantine');

select set_config('request.jwt.claims','{"sub":"a8010000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',true);
select throws_like($$select customer_api.get_customer_case_documents_v1(current_setting('case.test.id')::uuid)$$,'%case_access_denied%','Unclaimed customer cannot list documents');
select set_config('request.jwt.claims','{"sub":"a8010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal1"}',true);
select throws_like($$select customer_api.get_customer_case_documents_v1(current_setting('case.test.id')::uuid)$$,'%case_access_denied%','AAL1 cannot see case documents');
select * from finish();
rollback;
