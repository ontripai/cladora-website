begin;
select plan(60);

-- Test 064 retains the base Vault/storage/ACL contract. Its pre-cutover
-- mutation lifecycle was deliberately closed by D1-D8 and is covered by the
-- canonical Documents tests 183 and 187-194.

select has_table('documents', 'upload_intents', 'documents.upload_intents table exists');
select has_table('documents', 'document_retention_assignments', 'documents.document_retention_assignments table exists');
select has_table('documents', 'disposition_requests', 'documents.disposition_requests table exists');

select ok(
  exists(select 1 from storage.buckets where id = 'document-vault' and public = false),
  'document-vault bucket exists and is private-by-default'
);
select ok(
  (select file_size_limit from storage.buckets where id = 'document-vault') = 20971520::bigint,
  'document-vault file size limit is 20MB'
);
select ok(
  exists(select 1 from storage.buckets where id = 'utility-evidence' and public = false),
  'utility-evidence bucket remains untouched and private'
);

select ok(
  exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'document_vault_intent_insert'),
  'document_vault_intent_insert policy exists on storage.objects'
);
select ok(
  not exists(select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'document_vault_tenant_select'),
  'document-vault denies direct authenticated Storage SELECT'
);
select ok(
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'SELECT' and qual like '%bucket_id = ''document-vault''%'
      and qual not like '%upload_intents%'
  ),
  'authenticated broad bucket LIST denied'
);
select ok(
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'UPDATE' and (qual like '%document-vault%' or with_check like '%document-vault%')
  ),
  'direct overwrite/upsert denied on document-vault'
);
select ok(
  not exists(
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and cmd = 'DELETE' and qual like '%document-vault%'
  ),
  'direct DELETE denied on document-vault'
);

select ok(not has_function_privilege('anon', 'customer_api.create_upload_intent_v1(uuid, uuid, text, text, bigint, text)', 'EXECUTE'), 'anon denied create_upload_intent_v1');
select ok(not has_function_privilege('anon', 'customer_api.finalize_upload_v1(uuid, uuid, text, bigint, text, text, text, text, uuid)', 'EXECUTE'), 'anon denied finalize_upload_v1');
select ok(not has_function_privilege('anon', 'customer_api.authorize_document_download_v1(uuid, uuid, uuid, boolean)', 'EXECUTE'), 'anon denied authorize_document_download_v1');
select ok(not has_function_privilege('anon', 'customer_api.verify_document_evidence_v1(uuid, uuid, text, text, text)', 'EXECUTE'), 'anon denied verify_document_evidence_v1');
select ok(not has_function_privilege('anon', 'customer_api.place_legal_hold_v1(uuid, uuid, text)', 'EXECUTE'), 'anon denied place_legal_hold_v1');
select ok(not has_function_privilege('anon', 'customer_api.release_legal_hold_v1(uuid, uuid, text)', 'EXECUTE'), 'anon denied release_legal_hold_v1');
select ok(not has_function_privilege('anon', 'customer_api.request_document_disposition_v1(uuid, uuid, text)', 'EXECUTE'), 'anon denied request_document_disposition_v1');
select ok(not has_function_privilege('anon', 'customer_api.approve_document_disposition_v1(uuid, uuid, text, text)', 'EXECUTE'), 'anon denied approve_document_disposition_v1');
select ok(not has_function_privilege('anon', 'customer_api.assign_retention_policy_v1(uuid, uuid, text, text)', 'EXECUTE'), 'anon denied assign_retention_policy_v1');
select ok(not has_function_privilege('anon', 'customer_api.link_document_entity_v1(uuid, uuid, text, uuid, text)', 'EXECUTE'), 'anon denied link_document_entity_v1');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'customer_api'
    and p.proname in (
      'create_upload_intent_v1', 'finalize_upload_v1',
      'authorize_document_download_v1', 'verify_document_evidence_v1',
      'place_legal_hold_v1', 'release_legal_hold_v1',
      'request_document_disposition_v1', 'approve_document_disposition_v1',
      'assign_retention_policy_v1', 'link_document_entity_v1'
    )
    and not p.prosecdef
), 10, 'all 10 closed legacy document RPCs are SECURITY INVOKER');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'customer_api'
    and p.proname in (
      'create_upload_intent_v1', 'finalize_upload_v1',
      'authorize_document_download_v1', 'verify_document_evidence_v1',
      'place_legal_hold_v1', 'release_legal_hold_v1',
      'request_document_disposition_v1', 'approve_document_disposition_v1',
      'assign_retention_policy_v1', 'link_document_entity_v1'
    )
    and p.proconfig = array['search_path=pg_catalog']
), 10, 'all 10 closed legacy document RPCs have fixed search_path');

select * from skip(
  'pre-cutover mutation lifecycle superseded by canonical Documents tests 183 and 187-194',
  37
);

select * from finish();
rollback;
