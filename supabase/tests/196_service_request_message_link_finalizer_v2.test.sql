begin;
select plan(15);

select has_function(
  'app_private','execute_service_request_message_link_v2',
  array['text','uuid','uuid','uuid','uuid','bigint','uuid','bigint'],
  'S2 installs the single private phase-aware finalizer');

select is((
  select pg_get_userbyid(p.proowner)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='execute_service_request_message_link_v2'
), 'cladora_service_subject_link_owner', 'S3 transfers S2 to its fixed function-only owner');

select ok((
  select p.prosecdef and p.provolatile='v'
    and p.proconfig=array['search_path=pg_catalog']
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='execute_service_request_message_link_v2'
), 'S2 finalizer is volatile SECURITY DEFINER with fixed search_path');

select is((
  select count(*)::integer
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join unnest(array[
    'public','anon','authenticated','service_role','cladora_rpc_owner',
    'cladora_ce_guide_runtime','cladora_ce_guide_executor',
    'cladora_service_subject_link_runtime'
  ]) denied(role_name)
  where n.nspname='app_private' and p.proname='execute_service_request_message_link_v2'
    and has_function_privilege(denied.role_name,p.oid,'EXECUTE')
), 0, 'S2 is exposed only through the fixed SERVICE executor capability');

select ok((
  select regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%p_modenotin(''validate'',''apply'',''replay'')%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='execute_service_request_message_link_v2'
), 'S2 admits only the three fixed internal phases');

select ok((
  select regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%v_result_request_version:=p_expected_request_version+1%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='execute_service_request_message_link_v2'
), 'result Request version is derived internally');

select ok((
  select pg_get_functiondef(p.oid)
      like '%communications.resolve_private_message_request_audience_current_v2%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='execute_service_request_message_link_v2'
), 'all phases consume the canonical current-state audience gate');

select ok((
  select strpos(regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g'),
      'fromservice_catalog.offeringsoffering')
      < strpos(regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g'),
        'fromcommunications.private_messagesm')
    and strpos(regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g'),
      'fromportfolio.partiesparty')
      < strpos(regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g'),
        'fromcommunications.private_messagesm')
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='execute_service_request_message_link_v2'
), 'Offering and deterministic party locks precede message discovery');

select ok((
  select regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%fromcommunications.private_conversationsc%forupdate;%'
    and regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%fromcommunications.private_messagesm%forshare;%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='execute_service_request_message_link_v2'
), 'conversation UPDATE and exact message SHARE locks are installed');

select ok((
  select regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%fromcommunications.private_participantsparticipant%orderbyparticipant.membership_id%forshare;%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='execute_service_request_message_link_v2'
), 'all participants are SHARE-locked in deterministic membership order');

select ok((
  select lower(pg_get_functiondef(p.oid)) like '%identity.memberships%for share of membership%'
    and lower(pg_get_functiondef(p.oid)) like '%identity.membership_parties%for share of membership_party%'
    and lower(pg_get_functiondef(p.oid)) like '%maintenance.vendor_portal_memberships%for share of vendor_membership%'
    and lower(pg_get_functiondef(p.oid)) like '%maintenance.vendors%for share of vendor%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='execute_service_request_message_link_v2'
), 'membership, party mapping and vendor resolution rows are locked');

select ok((
  select regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%fromportfolio.unitsunit_row%forshareofunit_row,building;%'
    and regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%fromplatform.workspace_property_bindingsbinding%forshare;%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='execute_service_request_message_link_v2'
), 'unit, building and Workspace-property binding rows are locked before revalidation');

select ok((
  select regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%p_mode=''replay''%'
    and regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%write_applied:=false%'
    and regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%l.request_version=v_result_request_version%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='execute_service_request_message_link_v2'
), 'replay is read-only and verifies exact Request/link version binding');

select ok((
  select pg_get_functiondef(p.oid) like '%INVALID_INPUT%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private'
    and p.proname='execute_service_request_message_link_v2'
), 'invalid phase/input has a bounded denial branch');

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='app_private' and p.proname='insert_service_request_message_link_v1'
), 1, 'immutable V1 identity remains present but is no longer the Core adapter target');

select * from finish();
rollback;
