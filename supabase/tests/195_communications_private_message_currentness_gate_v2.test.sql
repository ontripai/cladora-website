begin;
select plan(10);

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications' and p.proname in (
    'resolve_private_message_currentness_v2',
    'resolve_private_message_request_audience_current_v2')
), 2, 'S1 installs both canonical V2 resolver identities');

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications' and p.proname in (
    'resolve_private_message_currentness_v2',
    'resolve_private_message_request_audience_current_v2')
    and pg_get_userbyid(p.proowner)='cladora_service_subject_link_owner' and p.prosecdef
    and p.proconfig=array['search_path=pg_catalog']
), 2, 'S3 transfers both S1 resolvers to the fixed function-only owner');

select is((
  select count(*)::integer
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  cross join unnest(array[
    'anon','authenticated','service_role','cladora_rpc_owner',
    'cladora_ce_guide_runtime','cladora_ce_guide_executor',
    'cladora_service_subject_link_runtime','cladora_service_subject_link_executor'
  ]) denied(role_name)
  where n.nspname='communications' and p.proname in (
    'resolve_private_message_currentness_v2',
    'resolve_private_message_request_audience_current_v2')
    and has_function_privilege(denied.role_name,p.oid,'EXECUTE')
), 0, 'S1 resolvers remain unavailable as direct executor/runtime entrypoints');

select ok((
  select regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%c.workspace_idisnotnull%'
    and regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%c.workspace_id=p_workspace_id%'
    and regexp_replace(lower(pg_get_functiondef(p.oid)), '\s+', '', 'g')
      like '%w.tenant_id=v_conversation.tenant_id%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications' and p.proname='resolve_private_message_currentness_v2'
), 'currentness consumes the physical non-NULL conversation Workspace and exact tenant');

select ok((
  select pg_get_functiondef(p.oid) not like '%workspace_property_bindings%'
    and pg_get_functiondef(p.oid) not like '%portfolio.units%'
    and pg_get_functiondef(p.oid) not like '%portfolio.buildings%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications' and p.proname='resolve_private_message_currentness_v2'
), 'currentness performs no unit/property Workspace inference');

select ok((
  select pg_get_functiondef(p.oid) like '%check_workspace_native_permission_v2%'
    and pg_get_functiondef(p.oid) like '%communications.feed.read%'
    and pg_get_functiondef(p.oid) like '%module.communications%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications' and p.proname='resolve_private_message_currentness_v2'
), 'currentness preserves canonical permission, module and entitlement checks');

select ok((
  select pg_get_functiondef(p.oid) like '%resolve_private_message_currentness_v2%'
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications'
    and p.proname='resolve_private_message_request_audience_current_v2'
), 'audience V2 rechecks the physical currentness gate first');

select is((select denial_reason
  from communications.resolve_private_message_currentness_v2(null,null,null,null,null)),
  'SUBJECT_DENIED','malformed currentness input returns one bounded denial row');

select is((select denial_reason
  from communications.resolve_private_message_request_audience_current_v2(
    null,null,null,null,null,null,null)),
  'AUDIENCE_DENIED','malformed audience input returns one bounded denial row');

select is((
  select count(*)::integer from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='communications' and p.proname in (
    'resolve_private_message_subject_v1','resolve_private_message_request_audience_v1')
), 2, 'S1 preserves both ungranted V1 identities for immutable compatibility');

select * from finish();
rollback;
