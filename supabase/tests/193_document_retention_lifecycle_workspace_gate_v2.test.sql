begin;
select plan(13);

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('documents','customer_api') and p.proname in (
    'place_legal_hold_internal','release_legal_hold_internal','request_disposition_internal',
    'approve_disposition_internal','assign_retention_policy_internal','place_legal_hold_v1',
    'release_legal_hold_v1','request_document_disposition_v1',
    'approve_document_disposition_v1','assign_retention_policy_v1')
), 10, 'D7 retains all ten exact legacy routine identities');

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('documents','customer_api') and p.proname in (
    'place_legal_hold_internal','release_legal_hold_internal','request_disposition_internal',
    'approve_disposition_internal','assign_retention_policy_internal','place_legal_hold_v1',
    'release_legal_hold_v1','request_document_disposition_v1',
    'approve_document_disposition_v1','assign_retention_policy_v1')
    and p.prorettype='jsonb'::regtype
), 10, 'D7 preserves every jsonb return contract');

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('documents','customer_api') and p.proname in (
    'place_legal_hold_internal','release_legal_hold_internal','request_disposition_internal',
    'approve_disposition_internal','assign_retention_policy_internal','place_legal_hold_v1',
    'release_legal_hold_v1','request_document_disposition_v1',
    'approve_document_disposition_v1','assign_retention_policy_v1')
    and pg_get_userbyid(p.proowner)='postgres'
), 10, 'D7 uses the canonical postgres owner');

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('documents','customer_api') and p.proname in (
    'place_legal_hold_internal','release_legal_hold_internal','request_disposition_internal',
    'approve_disposition_internal','assign_retention_policy_internal','place_legal_hold_v1',
    'release_legal_hold_v1','request_document_disposition_v1',
    'approve_document_disposition_v1','assign_retention_policy_v1')
    and not p.prosecdef and p.proconfig=array['search_path=pg_catalog']
), 10, 'all D7 tombstones are SECURITY INVOKER with fixed search_path');

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('documents','customer_api') and p.proname in (
    'place_legal_hold_internal','release_legal_hold_internal','request_disposition_internal',
    'approve_disposition_internal','assign_retention_policy_internal','place_legal_hold_v1',
    'release_legal_hold_v1','request_document_disposition_v1',
    'approve_document_disposition_v1','assign_retention_policy_v1')
    and pg_get_functiondef(p.oid) like '%canonical_document_retention_preflight_required%'
), 10, 'all D7 tombstones fail with the canonical preflight requirement');

select is((
  select count(*)::integer
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join unnest(array[
    'anon','authenticated','service_role','cladora_rpc_owner',
    'cladora_ce_guide_runtime','cladora_ce_guide_executor'
  ]) denied(role_name)
  where n.nspname in ('documents','customer_api') and p.proname in (
    'place_legal_hold_internal','release_legal_hold_internal','request_disposition_internal',
    'approve_disposition_internal','assign_retention_policy_internal','place_legal_hold_v1',
    'release_legal_hold_v1','request_document_disposition_v1',
    'approve_document_disposition_v1','assign_retention_policy_v1')
    and has_function_privilege(denied.role_name,p.oid,'EXECUTE')
), 0, 'D7 exposes no legacy runtime EXECUTE');

select throws_ok(
  $$select customer_api.place_legal_hold_v1(null,null,null)$$,
  '55000','canonical_document_retention_preflight_required','legacy hold placement fails closed');
select throws_ok(
  $$select customer_api.release_legal_hold_v1(null,null,null)$$,
  '55000','canonical_document_retention_preflight_required','legacy hold release fails closed');
select throws_ok(
  $$select customer_api.request_document_disposition_v1(null,null,null)$$,
  '55000','canonical_document_retention_preflight_required','legacy disposition request fails closed');
select throws_ok(
  $$select customer_api.approve_document_disposition_v1(null,null,null,null)$$,
  '55000','canonical_document_retention_preflight_required','legacy disposition approval fails closed');
select throws_ok(
  $$select customer_api.assign_retention_policy_v1(null,null,null,null)$$,
  '55000','canonical_document_retention_preflight_required','legacy retention assignment fails closed');

select ok(not has_table_privilege('service_role','documents.documents','SELECT'),
  'D8 completes the Documents application ACL cleanup after D7');

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='documents' and p.proname='execute_document_disposal_v2'
), 0, 'D7 installs no destructive disposal executor');

select * from finish();
rollback;
