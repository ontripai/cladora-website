begin;
create extension if not exists pgtap with schema extensions;
set search_path=public,extensions;
select plan(8);

insert into auth.users(id,email,email_confirmed_at) values
 ('12600000-0000-4000-8000-000000000001','internal-owner-126@cladora.test',statement_timestamp()),
 ('12600000-0000-4000-8000-000000000002','internal-recipient-126@cladora.test',statement_timestamp()),
 ('12600000-0000-4000-8000-000000000003','internal-outsider-126@cladora.test',statement_timestamp());
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('12600000-0000-4000-8000-000000000004','Internal document fixture','INTERNAL126','active');
insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,lifecycle_status) values
 ('12600000-0000-4000-8000-000000000005','12600000-0000-4000-8000-000000000004','ASSOCIATION','Internal fixture','ACTIVE');
insert into platform.platform_users(id,auth_user_id,employee_ref,display_name) values
 ('12600000-0000-4000-8000-000000000011','12600000-0000-4000-8000-000000000001','employee-126-1','Sender'),
 ('12600000-0000-4000-8000-000000000012','12600000-0000-4000-8000-000000000002','employee-126-2','Recipient'),
 ('12600000-0000-4000-8000-000000000013','12600000-0000-4000-8000-000000000003','employee-126-3','Outsider');
insert into platform.platform_role_assignments(platform_user_id,role,grant_reason) values
 ('12600000-0000-4000-8000-000000000011','PLATFORM_SUPPORT','Fixture'),
 ('12600000-0000-4000-8000-000000000012','PLATFORM_SUPPORT','Fixture'),
 ('12600000-0000-4000-8000-000000000013','PLATFORM_SUPPORT','Fixture');
insert into platform.platform_customer_assignments(platform_user_id,customer_workspace_id,assignment_reason) values
 ('12600000-0000-4000-8000-000000000011','12600000-0000-4000-8000-000000000005','Fixture'),
 ('12600000-0000-4000-8000-000000000012','12600000-0000-4000-8000-000000000005','Fixture'),
 ('12600000-0000-4000-8000-000000000013','12600000-0000-4000-8000-000000000005','Fixture');
insert into platform.internal_threads(id,workspace_id,created_by,client_request_id) values
 ('12600000-0000-4000-8000-000000000021','12600000-0000-4000-8000-000000000005','12600000-0000-4000-8000-000000000011','12600000-0000-4000-8000-000000000022');
insert into platform.internal_participants(thread_id,platform_user_id) values
 ('12600000-0000-4000-8000-000000000021','12600000-0000-4000-8000-000000000011'),
 ('12600000-0000-4000-8000-000000000021','12600000-0000-4000-8000-000000000012');
insert into platform.internal_messages(id,thread_id,sender_id,body,client_request_id) values
 ('12600000-0000-4000-8000-000000000023','12600000-0000-4000-8000-000000000021','12600000-0000-4000-8000-000000000011','Test document','12600000-0000-4000-8000-000000000024');
insert into documents.documents(id,tenant_id,title,document_type,classification,created_by) values
 ('12600000-0000-4000-8000-000000000031','12600000-0000-4000-8000-000000000004','Internal file','internal_message','confidential','12600000-0000-4000-8000-000000000001');
insert into documents.document_versions(id,tenant_id,document_id,version,object_path,sha256,mime_type,size_bytes,
  uploaded_by,scanning_status) values
 ('12600000-0000-4000-8000-000000000032','12600000-0000-4000-8000-000000000004',
  '12600000-0000-4000-8000-000000000031',1,'126/internal/test.pdf',repeat('a',64),'application/pdf',5,
  '12600000-0000-4000-8000-000000000001','clean');

select ok(not has_table_privilege('authenticated','platform.internal_message_documents','SELECT'),
 'Internal attachment rows have no direct customer read');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','12600000-0000-4000-8000-000000000001','role','authenticated','aal','aal1')::text,true);
select throws_ok($$select customer_api.attach_internal_document_v1('12600000-0000-4000-8000-000000000021',
 '12600000-0000-4000-8000-000000000023','12600000-0000-4000-8000-000000000031','12600000-0000-4000-8000-000000000032')$$,
 '42501','internal_document_denied','AAL1 cannot attach');
select set_config('request.jwt.claims',jsonb_build_object('sub','12600000-0000-4000-8000-000000000001','role','authenticated','aal','aal2')::text,true);
select is(jsonb_array_length(customer_api.list_internal_attachable_documents_v1('12600000-0000-4000-8000-000000000021')),1,
 'Sender discovers own clean document');
select is((customer_api.attach_internal_document_v1('12600000-0000-4000-8000-000000000021',
 '12600000-0000-4000-8000-000000000023','12600000-0000-4000-8000-000000000031','12600000-0000-4000-8000-000000000032')->>'replayed')::boolean,false,
 'Sender attaches scanned document');
select set_config('request.jwt.claims',jsonb_build_object('sub','12600000-0000-4000-8000-000000000002','role','authenticated','aal','aal2')::text,true);
select is(jsonb_array_length(customer_api.list_internal_attachments_v1('12600000-0000-4000-8000-000000000021')),1,
 'Recipient sees shared document');
select set_config('test.internal_attachment',(customer_api.list_internal_attachments_v1('12600000-0000-4000-8000-000000000021')->0->>'id'),true);
select is((customer_api.authorize_internal_attachment_download_v1(current_setting('test.internal_attachment')::uuid)->>'bucket_id'),
 'document-vault','Recipient can authorize a short-lived download');
select set_config('request.jwt.claims',jsonb_build_object('sub','12600000-0000-4000-8000-000000000003','role','authenticated','aal','aal2')::text,true);
select throws_ok($$select customer_api.authorize_internal_attachment_download_v1(current_setting('test.internal_attachment')::uuid)$$,
 '42501','internal_document_denied','Assigned outsider cannot read another thread');
reset role;
update platform.platform_customer_assignments set status='revoked',revoked_at=statement_timestamp()
 where platform_user_id='12600000-0000-4000-8000-000000000012';
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub','12600000-0000-4000-8000-000000000002','role','authenticated','aal','aal2')::text,true);
select throws_ok($$select customer_api.authorize_internal_attachment_download_v1(current_setting('test.internal_attachment')::uuid)$$,
 '42501','internal_document_denied','Revoked assignment blocks document download');
select * from finish();
rollback;
