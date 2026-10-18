begin;
select plan(17);

select is((
  select count(*)::integer
  from information_schema.columns
  where table_schema = 'documents' and table_name = 'upload_intents'
    and column_name in (
      'operation_kind', 'expected_parent_version_id', 'committed_document_id',
      'committed_version_id', 'verified_storage_object_id',
      'verified_storage_generation', 'verified_storage_etag',
      'verified_sha256', 'verified_size_bytes'
    )
), 9, 'upload intents expose all canonical D2 fields');

select is((
  select count(*)::integer
  from information_schema.columns
  where table_schema = 'documents' and table_name = 'document_versions'
    and column_name in (
      'upload_intent_id', 'replaces_version_id', 'bucket_id',
      'storage_object_id', 'storage_generation', 'storage_etag'
    )
), 6, 'document versions expose all canonical Storage provenance fields');

select is((
  select count(*)::integer
  from information_schema.columns
  where table_schema = 'documents'
    and ((table_name = 'upload_intents' and column_name in (
      'operation_kind', 'expected_parent_version_id', 'committed_document_id',
      'committed_version_id', 'verified_storage_object_id',
      'verified_storage_generation', 'verified_storage_etag',
      'verified_sha256', 'verified_size_bytes'
    )) or (table_name = 'document_versions' and column_name in (
      'upload_intent_id', 'replaces_version_id', 'bucket_id',
      'storage_object_id', 'storage_generation', 'storage_etag'
    ))) and column_default is null
), 15, 'all D2 additions are nullable without inferred defaults');

select ok(not exists(
  select 1 from information_schema.columns
  where table_schema = 'documents' and column_name = 'prospective_version_id'
), 'forbidden prospective_version_id is absent');

select ok(exists(
  select 1 from pg_trigger
  where tgrelid = 'documents.upload_intents'::regclass
    and tgname = 'upload_intent_canonical_identity_v1'
    and tgenabled = 'O' and not tgisinternal
), 'canonical intent guard is enabled');

select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'documents'
    and p.proname = 'protect_canonical_upload_intent_v1'
    and pg_get_userbyid(p.proowner) = 'postgres'
    and not p.prosecdef
    and p.proconfig = array['search_path=pg_catalog']
), 'canonical intent guard is postgres-owned SECURITY INVOKER with fixed search_path');

select is((
  select count(*)::integer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join unnest(array[
    'anon', 'authenticated', 'service_role', 'cladora_rpc_owner',
    'cladora_ce_guide_runtime', 'cladora_ce_guide_executor'
  ]) denied(role_name)
  where n.nspname = 'documents'
    and p.proname = 'protect_canonical_upload_intent_v1'
    and has_function_privilege(denied.role_name, p.oid, 'EXECUTE')
), 0, 'runtime roles have no direct canonical-guard EXECUTE');

select ok(exists(
  select 1 from pg_constraint
  where conrelid = 'documents.upload_intents'::regclass
    and conname = 'upload_intents_operation_kind_v1'
    and pg_get_constraintdef(oid) like '%new_document%replacement_version%'
), 'operation kind is restricted to the two canonical modes');

select ok(exists(
  select 1 from pg_constraint
  where conrelid = 'documents.upload_intents'::regclass
    and conname = 'upload_intents_canonical_shape_v1'
    and pg_get_constraintdef(oid) like '%expected_parent_version_id%'
), 'intent shape binds new and replacement parent identities');

select ok(exists(
  select 1 from pg_constraint
  where conrelid = 'documents.upload_intents'::regclass
    and conname = 'upload_intents_canonical_commit_v1'
    and pg_get_constraintdef(oid) like '%verified_storage_object_id%'
), 'consumption requires committed identities and trusted Storage evidence');

select is((
  select count(*)::integer from pg_constraint
  where conname in (
    'upload_intents_expected_parent_v1_fk', 'upload_intents_committed_version_v1_fk',
    'document_versions_upload_intent_v1_fk', 'document_versions_replaces_version_v1_fk'
  ) and condeferrable and condeferred
), 4, 'all four circular provenance FKs are initially deferred');

select is((
  select count(*)::integer from pg_indexes
  where schemaname = 'documents'
    and indexname in (
      'document_versions_upload_intent_v1_idx',
      'document_versions_upload_intent_fk_v1_idx',
      'document_versions_replaces_version_v1_idx',
      'upload_intents_expected_parent_v1_idx',
      'upload_intents_committed_version_v1_idx'
    )
), 5, 'canonical intent and parent provenance indexes exist');

select ok(not exists(
  with expected(constraint_name, index_name) as (values
    ('upload_intents_expected_parent_v1_fk', 'upload_intents_expected_parent_v1_idx'),
    ('upload_intents_committed_version_v1_fk', 'upload_intents_committed_version_v1_idx'),
    ('document_versions_upload_intent_v1_fk', 'document_versions_upload_intent_fk_v1_idx')
  )
  select 1
  from expected e
  join pg_constraint fk on fk.conname = e.constraint_name
  left join pg_class i on i.relname = e.index_name
  left join pg_index ix on ix.indexrelid = i.oid
    and ix.indrelid = fk.conrelid
    and ix.indisvalid and ix.indisready
    and (ix.indkey::smallint[])[0:cardinality(fk.conkey)-1] = fk.conkey
  where ix.indexrelid is null
), 'all three D2 foreign keys have valid ready covering indexes');

select ok(not exists(
  select 1
  from pg_class i
  join pg_index ix on ix.indexrelid = i.oid
  where i.relname in (
    'document_versions_upload_intent_fk_v1_idx',
    'upload_intents_expected_parent_v1_idx',
    'upload_intents_committed_version_v1_idx'
  ) and ix.indisunique
), 'D2 foreign-key support indexes introduce no new uniqueness');

select throws_ok($$insert into documents.upload_intents(
    id,tenant_id,context_id,user_id,bucket_id,object_path,expected_version,
    declared_mime_type,max_size_bytes,status,server_auth_hash)
  values(
    '18800000-0000-4000-8000-000000000001',
    '18800000-0000-4000-8000-000000000002',
    '18800000-0000-4000-8000-000000000003',
    '18800000-0000-4000-8000-000000000004',
    'document-vault','d2/forbidden.pdf',1,'application/pdf',1,'authorized',repeat('a',64)
  )$$,
  '23502', 'document_operation_kind_required',
  'fresh intent without explicit operation kind fails before any inferred binding');

select is((
  select count(*)::integer from documents.upload_intents
  where id = '18800000-0000-4000-8000-000000000001'
), 0, 'rejected untyped intent is zero-write');

select ok((
  select pg_get_functiondef(p.oid) like '%documents.canonical_storage_identity_v1%'
    and pg_get_functiondef(p.oid) like '%verified_storage_object_id%'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'documents'
    and p.proname = 'require_workspace_bound_document_insert_v1'
), 'document creation guard consumes the exact D2 Storage marker');

select * from finish();
rollback;
