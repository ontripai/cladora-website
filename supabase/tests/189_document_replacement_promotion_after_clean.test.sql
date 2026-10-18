begin;
select plan(10);

select ok(exists(
  select 1 from pg_trigger
  where tgrelid = 'documents.documents'::regclass
    and tgname = 'documents_replacement_promotion_after_clean_v1'
    and tgenabled = 'O' and not tgisinternal
), 'D3 replacement promotion guard is enabled');

select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'documents'
    and p.proname = 'guard_replacement_promotion_after_clean_v1'
    and pg_get_userbyid(p.proowner) = 'postgres'
    and not p.prosecdef
    and p.proconfig = array['search_path=pg_catalog']
), 'D3 guard is postgres-owned SECURITY INVOKER with fixed search_path');

select is((
  select count(*)::integer
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  cross join unnest(array[
    'anon', 'authenticated', 'service_role', 'cladora_rpc_owner',
    'cladora_ce_guide_runtime', 'cladora_ce_guide_executor'
  ]) denied(role_name)
  where n.nspname = 'documents'
    and p.proname = 'guard_replacement_promotion_after_clean_v1'
    and has_function_privilege(denied.role_name, p.oid, 'EXECUTE')
), 0, 'runtime roles have no direct D3 guard EXECUTE');

select ok((
  select pg_get_functiondef(p.oid) like '%documents.replacement_promotion_after_clean_v1%'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'documents'
    and p.proname = 'guard_replacement_promotion_after_clean_v1'
), 'D3 requires its transaction-local canonical marker');

select ok((
  select pg_get_functiondef(p.oid) like '%candidate.scanning_status = ''clean''%'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'documents'
    and p.proname = 'guard_replacement_promotion_after_clean_v1'
), 'candidate must have an exact clean scan state');

select ok((
  select pg_get_functiondef(p.oid) like '%attestation.provider = ''clamav''%'
    and pg_get_functiondef(p.oid) like '%attestation.verdict = ''clean''%'
    and pg_get_functiondef(p.oid) like '%attestation.content_sha256 = candidate.sha256%'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'documents'
    and p.proname = 'guard_replacement_promotion_after_clean_v1'
), 'promotion requires exact immutable ClamAV evidence');

select ok((
  select lower(pg_get_functiondef(p.oid)) like '%candidate.storage_object_id = ui.verified_storage_object_id%'
    and lower(pg_get_functiondef(p.oid)) like '%candidate.storage_generation is not distinct from ui.verified_storage_generation%'
    and lower(pg_get_functiondef(p.oid)) like '%candidate.storage_etag is not distinct from ui.verified_storage_etag%'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'documents'
    and p.proname = 'guard_replacement_promotion_after_clean_v1'
), 'promotion rechecks exact canonical Storage identity');

select ok((
  select lower(pg_get_functiondef(p.oid)) like '%new.current_version <> old.current_version + 1%'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'documents'
    and p.proname = 'guard_replacement_promotion_after_clean_v1'
), 'promotion is limited to the immediate candidate version');

select ok((
  select lower(pg_get_functiondef(p.oid)) like '%old.status <> ''active''%'
    and lower(pg_get_functiondef(p.oid)) like '%old.archived_at is not null%'
    and lower(pg_get_functiondef(p.oid)) like '%old.deleted_at is not null%'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'documents'
    and p.proname = 'guard_replacement_promotion_after_clean_v1'
), 'promotion rechecks the current document lifecycle');

select ok((
  select pg_get_functiondef(p.oid) like '%clean_replacement_promotion_required%'
    and pg_get_functiondef(p.oid) like '%operation_kind = ''replacement_version''%'
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'documents'
    and p.proname = 'guard_replacement_promotion_after_clean_v1'
), 'noncanonical or stale promotion fails closed');

select * from finish();
rollback;
