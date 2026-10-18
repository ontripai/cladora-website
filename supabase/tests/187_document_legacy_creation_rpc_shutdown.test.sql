begin;
select plan(13);

create temp table d1_write_baseline as
select
  (select count(*) from documents.upload_intents) as upload_intents,
  (select count(*) from documents.documents) as documents,
  (select count(*) from documents.document_versions) as document_versions;

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) in (
    ('customer_api', 'create_upload_intent_v1', 'p_context_id uuid, p_document_id uuid, p_filename text, p_declared_mime text, p_size_bytes bigint, p_idempotency_key text'),
    ('customer_api', 'finalize_upload_v1', 'p_context_id uuid, p_intent_id uuid, p_computed_sha256 text, p_actual_size_bytes bigint, p_detected_mime text, p_title text, p_document_type text, p_classification text, p_property_id uuid'),
    ('documents', 'create_upload_intent_internal', 'p_context_id uuid, p_document_id uuid, p_filename text, p_declared_mime text, p_size_bytes bigint, p_idempotency_key text'),
    ('documents', 'finalize_upload_internal', 'p_context_id uuid, p_intent_id uuid, p_computed_sha256 text, p_actual_size_bytes bigint, p_detected_mime text, p_title text, p_document_type text, p_classification text, p_property_id uuid')
  )
), 4, 'all four legacy creation routines retain their exact identities');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('customer_api', 'documents')
    and p.proname in ('create_upload_intent_v1', 'finalize_upload_v1',
      'create_upload_intent_internal', 'finalize_upload_internal')
    and p.prorettype = 'jsonb'::regtype
), 4, 'legacy creation routines retain the jsonb return contract');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('customer_api', 'documents')
    and p.proname in ('create_upload_intent_v1', 'finalize_upload_v1',
      'create_upload_intent_internal', 'finalize_upload_internal')
    and pg_get_userbyid(p.proowner) = 'postgres'
), 4, 'legacy creation routines use the canonical postgres owner');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('customer_api', 'documents')
    and p.proname in ('create_upload_intent_v1', 'finalize_upload_v1',
      'create_upload_intent_internal', 'finalize_upload_internal')
    and not p.prosecdef
), 4, 'legacy creation routines are SECURITY INVOKER');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('customer_api', 'documents')
    and p.proname in ('create_upload_intent_v1', 'finalize_upload_v1',
      'create_upload_intent_internal', 'finalize_upload_internal')
    and p.proconfig = array['search_path=pg_catalog']
), 4, 'legacy creation routines have a fixed pg_catalog search_path');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join unnest(array[
    'anon', 'authenticated', 'service_role', 'cladora_rpc_owner',
    'cladora_ce_guide_runtime', 'cladora_ce_guide_executor'
  ]) denied(role_name)
  where n.nspname in ('customer_api', 'documents')
    and p.proname in ('create_upload_intent_v1', 'finalize_upload_v1',
      'create_upload_intent_internal', 'finalize_upload_internal')
    and has_function_privilege(denied.role_name, p.oid, 'EXECUTE')
), 0, 'PUBLIC-derived and direct runtime EXECUTE privileges are absent');

select throws_ok(
  $$select customer_api.create_upload_intent_v1(null, null, 'blocked.pdf', 'application/pdf', 1, null)$$,
  '55000', 'canonical_document_writer_required',
  'customer create-intent entrypoint fails closed'
);
select throws_ok(
  $$select customer_api.finalize_upload_v1(null, null, repeat('a', 64), 1, 'application/pdf', null, 'general', 'internal', null)$$,
  '55000', 'canonical_document_writer_required',
  'customer finalize entrypoint fails closed'
);
select throws_ok(
  $$select documents.create_upload_intent_internal(null, null, 'blocked.pdf', 'application/pdf', 1, null)$$,
  '55000', 'canonical_document_writer_required',
  'internal create-intent entrypoint fails closed'
);
select throws_ok(
  $$select documents.finalize_upload_internal(null, null, repeat('a', 64), 1, 'application/pdf', null, 'general', 'internal', null)$$,
  '55000', 'canonical_document_writer_required',
  'internal finalize entrypoint fails closed'
);

select is((select count(*) from documents.upload_intents),
  (select upload_intents from d1_write_baseline),
  'failed legacy calls create no upload intent');
select is((select count(*) from documents.documents),
  (select documents from d1_write_baseline),
  'failed legacy calls create no document');
select is((select count(*) from documents.document_versions),
  (select document_versions from d1_write_baseline),
  'failed legacy calls create no document version');

select * from finish();
rollback;
