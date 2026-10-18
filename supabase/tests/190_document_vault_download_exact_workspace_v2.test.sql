begin;
select plan(12);

create temp table d4_write_baseline as
select count(*) as access_events
from documents.access_events;

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where (n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)) in (
    ('documents', 'authorize_download_internal', 'p_context_id uuid, p_document_id uuid, p_version_id uuid, p_admin_inspection boolean'),
    ('customer_api', 'authorize_document_download_v1', 'p_context_id uuid, p_document_id uuid, p_version_id uuid, p_admin_inspection boolean')
  )
), 2, 'both legacy download routines retain their exact identities');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('customer_api', 'documents')
    and p.proname in ('authorize_document_download_v1', 'authorize_download_internal')
    and p.prorettype = 'jsonb'::regtype
), 2, 'legacy download routines retain the jsonb return contract');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('customer_api', 'documents')
    and p.proname in ('authorize_document_download_v1', 'authorize_download_internal')
    and pg_get_userbyid(p.proowner) = 'postgres'
), 2, 'legacy download routines use the canonical postgres owner');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('customer_api', 'documents')
    and p.proname in ('authorize_document_download_v1', 'authorize_download_internal')
    and not p.prosecdef
), 2, 'legacy download routines are SECURITY INVOKER');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('customer_api', 'documents')
    and p.proname in ('authorize_document_download_v1', 'authorize_download_internal')
    and p.proconfig = array['search_path=pg_catalog']
), 2, 'legacy download routines have a fixed pg_catalog search_path');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  cross join unnest(array[
    'anon', 'authenticated', 'service_role', 'cladora_rpc_owner',
    'cladora_ce_guide_runtime', 'cladora_ce_guide_executor'
  ]) denied(role_name)
  where n.nspname in ('customer_api', 'documents')
    and p.proname in ('authorize_document_download_v1', 'authorize_download_internal')
    and has_function_privilege(denied.role_name, p.oid, 'EXECUTE')
), 0, 'PUBLIC-derived and direct runtime EXECUTE privileges are absent');

select throws_ok(
  $$select customer_api.authorize_document_download_v1(null, null, null, false)$$,
  '55000', 'canonical_document_download_required',
  'customer download entrypoint fails closed'
);

select throws_ok(
  $$select documents.authorize_download_internal(null, null, null, false)$$,
  '55000', 'canonical_document_download_required',
  'internal download entrypoint fails closed'
);

select is((
  select count(*) from documents.access_events
), (
  select access_events from d4_write_baseline
), 'failed legacy calls create no access event');

select is((
  select count(*)::integer
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('customer_api', 'documents')
    and p.proname in ('authorize_document_download_v1', 'authorize_download_internal')
    and pg_get_functiondef(p.oid) like '%canonical_document_download_required%'
), 2, 'both exact legacy signatures are deterministic D4 tombstones');

select ok((
  select pg_get_functiondef(p.oid) like '%d.workspace_id is distinct from w.id%'
    and pg_get_functiondef(p.oid) like '%actor.tenant_id is distinct from w.tenant_id%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private'
    and p.proname='require_airprop_diligence_evidence_v1'
), 'AIRPROP evidence validation binds the explicit canonical Workspace and tenant');

select ok((
  select pg_get_functiondef(p.oid) not like '%authorize_download_internal%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private'
    and p.proname='require_airprop_diligence_evidence_v1'
), 'AIRPROP evidence validation cannot reopen the D4 legacy download path');

select * from finish();
rollback;
