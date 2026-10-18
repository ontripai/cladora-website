begin;
select plan(14);

select ok(exists(
  select 1 from pg_trigger
  where tgrelid='communications.private_message_documents'::regclass
    and tgname='private_attachment_integrity' and tgenabled='O' and not tgisinternal
), 'D6 preserves the attachment integrity trigger');

select ok(exists(
  select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications' and p.proname='validate_private_attachment'
    and pg_get_userbyid(p.proowner)='postgres' and not p.prosecdef
    and p.proconfig=array['search_path=pg_catalog']
), 'D6 trigger is postgres-owned SECURITY INVOKER with fixed search_path');

select ok((
  select regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%c.workspace_idisnotnull%'
    and regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%d.workspace_id=c.workspace_id%'
    and regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%v.version=d.current_version%'
    and regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%a.provider=''clamav''%'
    and regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%a.verdict=''clean''%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications' and p.proname='validate_private_attachment'
), 'D6 trigger binds exact non-NULL Workspace and current clean attested version');

select ok((
  select pg_get_functiondef(p.oid)
    like '%communications.document_attachment_workspace_gate_v2%'
    and pg_get_functiondef(p.oid) like '%canonical_private_attachment_writer_required%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications' and p.proname='validate_private_attachment'
), 'D6 insert requires the exact transaction-local canonical writer marker');

select ok((
  select regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%d.workspace_id=c.workspace_id%'
    and lower(pg_get_functiondef(p.oid)) like '%documents.document_permissions%'
    and regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%permission.permission=''view''%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications' and p.proname='private_document_member_grant'
), 'participant entitlement helper requires existing permission in the exact Workspace');

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='customer_api' and p.proname in (
    'attach_private_document_v1','list_private_attachments_v1',
    'authorize_private_attachment_download_v1','list_attachable_private_documents_v1',
    'send_private_file_v1','my_private_file_scan_status_v1'
  )
), 6, 'all six legacy private attachment routines retain one exact identity');

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='customer_api' and p.proname in (
    'attach_private_document_v1','list_private_attachments_v1',
    'authorize_private_attachment_download_v1','list_attachable_private_documents_v1',
    'send_private_file_v1','my_private_file_scan_status_v1'
  ) and p.prorettype='jsonb'::regtype and pg_get_userbyid(p.proowner)='postgres'
    and not p.prosecdef and p.proconfig=array['search_path=pg_catalog']
), 6, 'all legacy identities are postgres-owned jsonb SECURITY INVOKER tombstones');

select is((
  select count(*)::integer
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join unnest(array[
    'anon','authenticated','service_role','cladora_rpc_owner',
    'cladora_ce_guide_runtime','cladora_ce_guide_executor'
  ]) denied(role_name)
  where n.nspname in ('communications','customer_api')
    and p.proname in ('validate_private_attachment','private_document_member_grant',
      'attach_private_document_v1','list_private_attachments_v1',
      'authorize_private_attachment_download_v1','list_attachable_private_documents_v1',
      'send_private_file_v1','my_private_file_scan_status_v1')
    and has_function_privilege(denied.role_name,p.oid,'EXECUTE')
), 0, 'D6 functions expose no direct runtime EXECUTE');

select throws_ok(
  $$select customer_api.attach_private_document_v1(null,null,null,null,null)$$,
  '55000','canonical_private_attachment_required',
  'legacy attachment mutation fails closed'
);

select throws_ok(
  $$select customer_api.list_private_attachments_v1(null,null)$$,
  '55000','canonical_private_attachment_required',
  'legacy attachment listing fails closed'
);

select throws_ok(
  $$select customer_api.authorize_private_attachment_download_v1(null,null)$$,
  '55000','canonical_private_attachment_required',
  'legacy attachment download authorization fails closed'
);

select throws_ok(
  $$select customer_api.list_attachable_private_documents_v1(null,null)$$,
  '55000','canonical_private_attachment_required',
  'legacy attachable-document discovery fails closed'
);

select throws_ok(
  $$select customer_api.send_private_file_v1(null,null,null,null,null)$$,
  '55000','canonical_private_attachment_required',
  'legacy combined private-file mutation fails closed'
);

select throws_ok(
  $$select customer_api.my_private_file_scan_status_v1(null,null,null,null)$$,
  '55000','canonical_private_attachment_required',
  'legacy private-file scan status fails closed'
);

select * from finish();
rollback;
