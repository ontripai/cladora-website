begin;
select plan(20);

insert into platform.tenants(id,legal_name,registration_number,status)
values('18300000-0000-4000-8000-000000000001','Documents closure fixture','DOC-CLOSURE-183','active');
insert into auth.users(id,email)
values('18300000-0000-4000-8000-000000000005','documents-closure-183@cladora.test');
insert into identity.roles(id,tenant_id,code,name,is_system)
values('18300000-0000-4000-8000-000000000012','18300000-0000-4000-8000-000000000001',
  'documents_closure_fixture','Documents closure fixture',false);
insert into identity.memberships(id,tenant_id,user_id,role_id,status,starts_at)
values('18300000-0000-4000-8000-000000000013','18300000-0000-4000-8000-000000000001',
  '18300000-0000-4000-8000-000000000005','18300000-0000-4000-8000-000000000012',
  'active',statement_timestamp()-interval '1 day');
insert into identity.context_grants(id,tenant_id,membership_id,scope_type,starts_at)
values('18300000-0000-4000-8000-000000000004','18300000-0000-4000-8000-000000000001',
  '18300000-0000-4000-8000-000000000013','tenant',statement_timestamp()-interval '1 day');

-- Model rows that existed before the cutover. The DDL and fixtures roll back
-- with this test and do not expose a production bypass.
alter table documents.documents disable trigger document_workspace_creation_guard_v1;
insert into documents.documents(id,tenant_id,title,document_type)
values('18300000-0000-4000-8000-000000000002','18300000-0000-4000-8000-000000000001',
  'Historical NULL document','legacy');
alter table documents.documents enable trigger document_workspace_creation_guard_v1;

alter table documents.upload_intents
  disable trigger upload_intent_new_document_binding_required_v1;
alter table documents.upload_intents
  disable trigger upload_intent_unbound_consumption_denied_v1;
alter table documents.upload_intents
  disable trigger upload_intent_canonical_identity_v1;
insert into documents.upload_intents(
  id,tenant_id,context_id,user_id,document_id,bucket_id,object_path,expected_version,
  declared_mime_type,max_size_bytes,status,server_auth_hash
) values(
  '18300000-0000-4000-8000-000000000003','18300000-0000-4000-8000-000000000001',
  '18300000-0000-4000-8000-000000000004','18300000-0000-4000-8000-000000000005',
  null,'document-vault','historical/183.pdf',1,'application/pdf',1024,'authorized',repeat('a',64)
);
set constraints all immediate;
alter table documents.upload_intents
  enable trigger upload_intent_new_document_binding_required_v1;
alter table documents.upload_intents
  enable trigger upload_intent_unbound_consumption_denied_v1;
alter table documents.upload_intents
  enable trigger upload_intent_canonical_identity_v1;

select ok(exists(select 1 from documents.documents
  where id='18300000-0000-4000-8000-000000000002' and workspace_id is null),
  'historical NULL document remains present');
select lives_ok($$update documents.documents set title='Historical row remains mutable'
  where id='18300000-0000-4000-8000-000000000002'$$,
  'unrelated historical lifecycle update does not infer a binding');
select throws_ok($$update documents.documents
  set workspace_id='18300000-0000-4000-8000-000000000006'
  where id='18300000-0000-4000-8000-000000000002'$$,
  '55000','document_workspace_binding_is_immutable','historical NULL cannot be rebound');

select throws_ok($$insert into documents.documents(id,tenant_id,title,document_type)
  values('18300000-0000-4000-8000-000000000007','18300000-0000-4000-8000-000000000001',
    'Rejected NULL document','test')$$,
  '23502','document_workspace_binding_required_on_insert','new NULL document is rejected');
select is((select count(*)::integer from documents.documents
  where id='18300000-0000-4000-8000-000000000007'),0,'NULL document denial is zero-write');

select throws_ok($$insert into documents.documents(id,tenant_id,workspace_id,title,document_type)
  values('18300000-0000-4000-8000-000000000008','18300000-0000-4000-8000-000000000001',
    '18300000-0000-4000-8000-000000000006','Noncanonical document','test')$$,
  '42501','canonical_document_writer_intent_required',
  'explicit Workspace without canonical consumed intent is rejected');
select is((select count(*)::integer from documents.documents
  where id='18300000-0000-4000-8000-000000000008'),0,'noncanonical document denial is zero-write');

select throws_ok($$insert into documents.upload_intents(
    id,tenant_id,context_id,user_id,object_path,declared_mime_type,max_size_bytes,status,server_auth_hash)
  values('18300000-0000-4000-8000-000000000009','18300000-0000-4000-8000-000000000001',
    '18300000-0000-4000-8000-000000000010','18300000-0000-4000-8000-000000000011',
    'legacy/new-183.pdf','application/pdf',1024,'authorized',repeat('b',64))$$,
  '23502','document_operation_kind_required',
  'legacy unbound intent is rejected by the canonical D2 operation-kind guard');
select is((select count(*)::integer from documents.upload_intents
  where id='18300000-0000-4000-8000-000000000009'),0,'legacy intent denial is zero-write');

select throws_ok($$update documents.upload_intents
  set status='consumed',consumed_at=statement_timestamp(),attempts=attempts+1
  where id='18300000-0000-4000-8000-000000000003'$$,
  '23502','document_workspace_binding_required_for_new_intent',
  'historical unbound new-document intent cannot be consumed');
select is((select status from documents.upload_intents
  where id='18300000-0000-4000-8000-000000000003'),'authorized',
  'historical intent consumption denial is zero-write');

select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='documents' and p.proname in (
    'reject_unbound_new_document_intent_v1','require_workspace_bound_document_insert_v1')
    and pg_get_userbyid(p.proowner)='postgres'),2,'closure functions use canonical postgres owner');
select is((select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='documents' and p.proname in (
    'reject_unbound_new_document_intent_v1','require_workspace_bound_document_insert_v1')
    and not p.prosecdef),2,'closure functions are SECURITY INVOKER');
select ok(not has_function_privilege('anon','documents.reject_unbound_new_document_intent_v1()','EXECUTE')
  and not has_function_privilege('anon','documents.require_workspace_bound_document_insert_v1()','EXECUTE'),
  'anon has no closure-function EXECUTE');
select ok(not has_function_privilege('authenticated','documents.reject_unbound_new_document_intent_v1()','EXECUTE')
  and not has_function_privilege('authenticated','documents.require_workspace_bound_document_insert_v1()','EXECUTE'),
  'authenticated has no closure-function EXECUTE');
select ok(not has_function_privilege('service_role','documents.reject_unbound_new_document_intent_v1()','EXECUTE')
  and not has_function_privilege('service_role','documents.require_workspace_bound_document_insert_v1()','EXECUTE'),
  'service_role has no closure-function EXECUTE');
select is((select count(*)::integer from pg_trigger
  where tgrelid in ('documents.documents'::regclass,'documents.upload_intents'::regclass)
    and tgname in ('document_workspace_creation_guard_v1',
      'upload_intent_new_document_binding_required_v1','upload_intent_unbound_consumption_denied_v1')
    and tgenabled='O'),3,'all closure triggers are enabled');
select ok((select relrowsecurity from pg_class where oid='documents.documents'::regclass)
  and (select relrowsecurity from pg_class where oid='documents.upload_intents'::regclass),
  'Documents and intent RLS remain enabled');
select ok((select column_default is null from information_schema.columns
  where table_schema='documents' and table_name='documents' and column_name='workspace_id'),
  'Workspace binding still has no default or inference');
select is((select workspace_id from documents.documents
  where id='18300000-0000-4000-8000-000000000002'),null::uuid,
  'historical NULL binding is not backfilled');

select * from finish();
rollback;
