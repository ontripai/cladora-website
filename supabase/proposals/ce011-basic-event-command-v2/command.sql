-- CE011 basic-event command v2: INACTIVE source, not a migration/installer.
-- Reuses existing tables, canonical C01/C03 key/hash/receipt/audit/outbox.
BEGIN;
SET LOCAL search_path=pg_catalog;
DO $review$ BEGIN RAISE EXCEPTION 'ce011_v2_source_only_no_admission' USING ERRCODE='55000'; END $review$;
create function app_private.ce011_audience_current_v2(p_event_id uuid,p_membership_id uuid)
returns boolean language sql volatile security definer set search_path=pg_catalog as $$
 select exists(
  select 1 from community.events e join identity.memberships m on m.id=p_membership_id and m.tenant_id=e.tenant_id
  where e.id=p_event_id and m.status='active' and m.starts_at<=clock_timestamp() and(m.ends_at is null or m.ends_at>clock_timestamp())
  and exists(select 1 from platform.workspace_member_roles a join platform.workspace_roles wr on wr.id=a.workspace_role_id
   where a.membership_id=m.id and a.customer_workspace_id=e.workspace_id and a.tenant_id=e.tenant_id
   and a.valid_from<=clock_timestamp() and(a.valid_to is null or a.valid_to>clock_timestamp())
   and wr.lifecycle_status='published' and wr.valid_from<=clock_timestamp() and(wr.valid_to is null or wr.valid_to>clock_timestamp()))
  and(e.audience_kind='workspace'
   or(e.audience_kind='members' and exists(select 1 from community.event_audience_members am where am.event_id=e.id and am.membership_id=m.id))
   or(e.audience_kind='roles' and exists(
     select 1 from identity.roles r where r.id=m.role_id and exists(select 1 from community.event_audience_roles ar where ar.event_id=e.id and ar.role_code=r.code)
     union all
     select 1 from platform.workspace_member_roles a join platform.workspace_roles wr on wr.id=a.workspace_role_id
      where a.membership_id=m.id and a.customer_workspace_id=e.workspace_id and a.tenant_id=e.tenant_id
      and a.valid_from<=clock_timestamp() and(a.valid_to is null or a.valid_to>clock_timestamp())
      and wr.lifecycle_status='published' and wr.valid_from<=clock_timestamp() and(wr.valid_to is null or wr.valid_to>clock_timestamp()) and exists(select 1 from community.event_audience_roles ar where ar.event_id=e.id and ar.role_code=wr.code)
   )))
 )
$$;

create function customer_api.command_ce_event_v2(p_request jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare
 v_actor uuid:=auth.uid();v_context uuid;v_workspace uuid;v_request_id uuid;v_event_id uuid;v_occurrence_id uuid;v_member_id uuid;
 v_command text;v_permission text;v_client_key text;v_key text;v_hash text;v_reason text;v_scope record;v_initial record;v_current record;v_event community.events%rowtype;
 v_interest community.event_interests%rowtype;v_attendance community.event_attendance%rowtype;v_receipt community.event_command_receipts%rowtype;v_idem platform.idempotency_keys%rowtype;
 v_expected integer;v_record_expected integer;v_result_version integer;v_entity_type text;v_entity_id uuid;v_before jsonb;v_after jsonb;v_response jsonb;
begin
 if v_actor is null or jsonb_typeof(p_request) is distinct from 'object' then raise exception 'invalid_request' using errcode='22023';end if;
 begin
  v_command:=p_request->>'type';v_context:=(p_request->>'context_id')::uuid;v_workspace:=(p_request->>'workspace_id')::uuid;
  v_request_id:=(p_request->>'command_id')::uuid;v_event_id:=(p_request->>'event_id')::uuid;v_expected:=(p_request->>'expected_version')::integer;
 exception when others then raise exception 'invalid_request' using errcode='22023';end;
 v_client_key:=p_request->>'idempotency_key';v_reason:=btrim(coalesce(p_request->>'reason',''));
 if v_command not in('create_event','publish_event','cancel_event','register_interest','withdraw_interest','record_attendance','correct_attendance')
  or v_client_key is null or v_client_key!~'^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  or not(p_request?'expected_version') or jsonb_typeof(p_request->'expected_version')<>'number'
  or v_expected is null or v_expected<0
  or length(v_reason) not between 5 and 500 then raise exception 'invalid_request' using errcode='22023';end if;
 if v_command in('register_interest','withdraw_interest') and(
  not(p_request?'expected_interest_version') or jsonb_typeof(p_request->'expected_interest_version')<>'number'
  or (p_request->>'expected_interest_version')::integer is null or (p_request->>'expected_interest_version')::integer<0
  or (v_command='withdraw_interest' and (p_request->>'expected_interest_version')::integer=0)
 ) then raise exception 'invalid_request' using errcode='22023';end if;
 if v_command='correct_attendance' and(
  not(p_request?'expected_attendance_version') or jsonb_typeof(p_request->'expected_attendance_version')<>'number'
  or (p_request->>'expected_attendance_version')::integer is null or (p_request->>'expected_attendance_version')::integer<=0
 ) then raise exception 'invalid_request' using errcode='22023';end if;
 if (p_request-array['type','command_id','idempotency_key','context_id','workspace_id','event_id','expected_version','reason']-
  case v_command when 'create_event' then array['occurrence_id','title','starts_at','ends_at','timezone','community_ref','audience']
   when 'register_interest' then array['expected_interest_version'] when 'withdraw_interest' then array['expected_interest_version']
   when 'record_attendance' then array['target_membership_id','observed_local','timezone']
   when 'correct_attendance' then array['attendance_id','expected_attendance_version','attended','observed_local','timezone'] else array[]::text[] end)<>'{}'::jsonb
 then raise exception 'ce_event_invalid_fields' using errcode='22023';end if;
 v_permission:=case when v_command in('create_event','publish_event') then 'events.event.publish' when v_command='cancel_event' then 'events.event.cancel'
  when v_command in('register_interest','withdraw_interest') then 'events.interest.manage_self' when v_command='record_attendance' then 'events.attendance.record' else 'events.attendance.correct' end;
 select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 v_initial:=v_scope;
 -- Canonical Core primitives; no local evaluator/role grant/allow callback.
 select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 if v_member_id is not null and app_private.ce011_audience_current_v2(v_event_id,v_member_id) is not true
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 if v_command='create_event' and exists(select 1 from community.event_audience_members am where am.event_id=v_event_id
  and app_private.ce011_audience_current_v2(v_event_id,am.membership_id) is not true)
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 perform app_private.require_request_session_current_at_v1(clock_timestamp());
 select * into strict v_current from app_private.resolve_workspace_native_context_v2_at_v1(v_context,v_workspace,clock_timestamp());
 if auth.uid() is distinct from v_actor or v_current.tenant_id is distinct from v_initial.tenant_id
  or v_current.membership_id is distinct from v_initial.membership_id
  or v_scope.tenant_id is distinct from v_initial.tenant_id or v_scope.membership_id is distinct from v_initial.membership_id
  or v_scope.represented_party_id is distinct from v_initial.represented_party_id
  or app_private.check_workspace_native_permission_v2_at_v1(v_context,v_workspace,v_permission,'community_events',clock_timestamp()) is not true
 then raise exception 'ce_event_current_authority_denied' using errcode='42501';end if;
 if v_command<>'create_event' then
  select * into v_event from community.events where id=v_event_id and tenant_id=v_scope.tenant_id and workspace_id=v_workspace for update;
  if not found then raise exception 'ce_event_not_found' using errcode='P0002';end if;
 end if;
 v_member_id:=case when v_command in('register_interest','withdraw_interest') then v_scope.membership_id
  when v_command='record_attendance' then (p_request->>'target_membership_id')::uuid
  when v_command='correct_attendance' then (select membership_id from community.event_attendance where id=(p_request->>'attendance_id')::uuid and event_id=v_event_id)
  else null end;
 if v_member_id is not null and app_private.ce011_audience_current_v2(v_event_id,v_member_id) is not true then raise exception 'ce_event_audience_denied' using errcode='42501';end if;
 v_key:='ce.event.'||v_command||'.v1/'||v_workspace||'/'||v_request_id||'/'||v_client_key;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('schema_version',1,'actor_user_id',v_actor,'context_id',v_context,'workspace_id',v_workspace,'command',p_request)::text,'UTF8')),'hex');
 -- Canonical Core primitives; no local evaluator/role grant/allow callback.
 select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 if v_member_id is not null and app_private.ce011_audience_current_v2(v_event_id,v_member_id) is not true
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 if v_command='create_event' and exists(select 1 from community.event_audience_members am where am.event_id=v_event_id
  and app_private.ce011_audience_current_v2(v_event_id,am.membership_id) is not true)
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 perform app_private.require_request_session_current_at_v1(clock_timestamp());
 select * into strict v_current from app_private.resolve_workspace_native_context_v2_at_v1(v_context,v_workspace,clock_timestamp());
 if auth.uid() is distinct from v_actor or v_current.tenant_id is distinct from v_initial.tenant_id
  or v_current.membership_id is distinct from v_initial.membership_id
  or v_scope.tenant_id is distinct from v_initial.tenant_id or v_scope.membership_id is distinct from v_initial.membership_id
  or v_scope.represented_party_id is distinct from v_initial.represented_party_id
  or app_private.check_workspace_native_permission_v2_at_v1(v_context,v_workspace,v_permission,'community_events',clock_timestamp()) is not true
 then raise exception 'ce_event_current_authority_denied' using errcode='42501';end if;
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at) values(v_scope.tenant_id,v_actor,v_key,v_hash,clock_timestamp()+interval '7 days') on conflict(tenant_id,key) do nothing;
 select * into strict v_idem from platform.idempotency_keys where tenant_id=v_scope.tenant_id and key=v_key for update;
 select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 -- Canonical Core primitives; no local evaluator/role grant/allow callback.
 select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 if v_member_id is not null and app_private.ce011_audience_current_v2(v_event_id,v_member_id) is not true
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 if v_command='create_event' and exists(select 1 from community.event_audience_members am where am.event_id=v_event_id
  and app_private.ce011_audience_current_v2(v_event_id,am.membership_id) is not true)
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 perform app_private.require_request_session_current_at_v1(clock_timestamp());
 select * into strict v_current from app_private.resolve_workspace_native_context_v2_at_v1(v_context,v_workspace,clock_timestamp());
 if auth.uid() is distinct from v_actor or v_current.tenant_id is distinct from v_initial.tenant_id
  or v_current.membership_id is distinct from v_initial.membership_id
  or v_scope.tenant_id is distinct from v_initial.tenant_id or v_scope.membership_id is distinct from v_initial.membership_id
  or v_scope.represented_party_id is distinct from v_initial.represented_party_id
  or app_private.check_workspace_native_permission_v2_at_v1(v_context,v_workspace,v_permission,'community_events',clock_timestamp()) is not true
 then raise exception 'ce_event_current_authority_denied' using errcode='42501';end if;
 if v_member_id is not null and app_private.ce011_audience_current_v2(v_event_id,v_member_id) is not true then raise exception 'ce_event_audience_denied' using errcode='42501';end if;
 if v_idem.actor_id is distinct from v_actor or v_idem.request_hash<>v_hash or v_idem.expires_at<=clock_timestamp() then raise exception 'ce_event_idempotency_conflict' using errcode='23505';end if;
 if v_idem.response_ref is not null then
  select * into v_receipt from community.event_command_receipts where tenant_id=v_scope.tenant_id and canonical_key=v_key;
  if not found or v_receipt.request_id<>v_request_id or v_receipt.workspace_id<>v_workspace or v_receipt.context_id<>v_context
   or v_receipt.actor_id<>v_actor or v_receipt.membership_id<>v_scope.membership_id
   or v_receipt.represented_party_id is distinct from v_scope.represented_party_id or v_receipt.command<>v_command
  then raise exception 'ce_event_idempotency_conflict' using errcode='23505';end if;
  -- Canonical Core primitives; no local evaluator/role grant/allow callback.
 select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 if v_member_id is not null and app_private.ce011_audience_current_v2(v_event_id,v_member_id) is not true
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 if v_command='create_event' and exists(select 1 from community.event_audience_members am where am.event_id=v_event_id
  and app_private.ce011_audience_current_v2(v_event_id,am.membership_id) is not true)
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 perform app_private.require_request_session_current_at_v1(clock_timestamp());
 select * into strict v_current from app_private.resolve_workspace_native_context_v2_at_v1(v_context,v_workspace,clock_timestamp());
 if auth.uid() is distinct from v_actor or v_current.tenant_id is distinct from v_initial.tenant_id
  or v_current.membership_id is distinct from v_initial.membership_id
  or v_scope.tenant_id is distinct from v_initial.tenant_id or v_scope.membership_id is distinct from v_initial.membership_id
  or v_scope.represented_party_id is distinct from v_initial.represented_party_id
  or app_private.check_workspace_native_permission_v2_at_v1(v_context,v_workspace,v_permission,'community_events',clock_timestamp()) is not true
 then raise exception 'ce_event_current_authority_denied' using errcode='42501';end if;
 return v_receipt.response_json||jsonb_build_object('replayed',true);
 end if;

 if v_command='create_event' then
  if v_expected<>0 or exists(select 1 from community.events where id=v_event_id) then raise exception 'ce_event_version_conflict' using errcode='40001';end if;
  if not exists(select 1 from pg_timezone_names where name=p_request->>'timezone') then raise exception 'invalid_timezone' using errcode='22023';end if;
  v_occurrence_id:=(p_request->>'occurrence_id')::uuid;
  insert into community.events(id,tenant_id,workspace_id,community_ref,title,audience_kind,created_by)
  values(v_event_id,v_scope.tenant_id,v_workspace,nullif(p_request->>'community_ref','')::uuid,btrim(p_request->>'title'),p_request->'audience'->>'kind',v_actor);
  insert into community.event_occurrences(id,tenant_id,workspace_id,event_id,starts_at,ends_at,timezone)
  values(v_occurrence_id,v_scope.tenant_id,v_workspace,v_event_id,(p_request->>'starts_at')::timestamptz,(p_request->>'ends_at')::timestamptz,p_request->>'timezone');
  insert into community.event_audience_roles(event_id,role_code) select v_event_id,jsonb_array_elements_text(p_request->'audience'->'role_codes') where p_request->'audience'->>'kind'='roles';
  insert into community.event_audience_members(event_id,membership_id) select v_event_id,(jsonb_array_elements_text(p_request->'audience'->'membership_ids'))::uuid where p_request->'audience'->>'kind'='members';
  if (p_request->'audience'->>'kind'='roles' and not exists(select 1 from community.event_audience_roles where event_id=v_event_id))
   or (p_request->'audience'->>'kind'='members' and (not exists(select 1 from community.event_audience_members where event_id=v_event_id)
    or exists(select 1 from community.event_audience_members am where am.event_id=v_event_id and app_private.ce011_audience_current_v2(v_event_id,am.membership_id) is not true)))
   or p_request->'audience'->>'kind' not in('workspace','roles','members')
  then raise exception 'ce_event_audience_denied' using errcode='42501';end if;
  v_result_version:=1;v_entity_type:='event';v_entity_id:=v_event_id;
 elsif v_command in('publish_event','cancel_event') then
  if v_event.version<>v_expected or(v_command='publish_event' and v_event.status<>'draft')or(v_command='cancel_event' and v_event.status<>'published') then raise exception 'ce_event_version_conflict' using errcode='40001';end if;
  v_before:=to_jsonb(v_event);update community.events set status=case when v_command='publish_event' then 'published' else 'cancelled' end,version=version+1,updated_at=clock_timestamp() where id=v_event_id returning * into v_event;
  v_result_version:=v_event.version;v_entity_type:='event';v_entity_id:=v_event_id;
 elsif v_command in('register_interest','withdraw_interest') then
  if v_event.status<>'published' or v_event.version<>v_expected then raise exception 'ce_event_version_conflict' using errcode='40001';end if;
  v_record_expected:=(p_request->>'expected_interest_version')::integer;select * into v_interest from community.event_interests where event_id=v_event_id and membership_id=v_scope.membership_id for update;
  if coalesce(v_interest.version,0)<>v_record_expected or(v_command='register_interest' and v_interest.status='interested')or(v_command='withdraw_interest' and(v_interest.id is null or v_interest.status<>'interested')) then raise exception 'ce_interest_version_conflict' using errcode='40001';end if;
  select id into v_occurrence_id from community.event_occurrences where event_id=v_event_id;
  -- Canonical Core primitives; no local evaluator/role grant/allow callback.
 select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 if v_member_id is not null and app_private.ce011_audience_current_v2(v_event_id,v_member_id) is not true
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 if v_command='create_event' and exists(select 1 from community.event_audience_members am where am.event_id=v_event_id
  and app_private.ce011_audience_current_v2(v_event_id,am.membership_id) is not true)
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 perform app_private.require_request_session_current_at_v1(clock_timestamp());
 select * into strict v_current from app_private.resolve_workspace_native_context_v2_at_v1(v_context,v_workspace,clock_timestamp());
 if auth.uid() is distinct from v_actor or v_current.tenant_id is distinct from v_initial.tenant_id
  or v_current.membership_id is distinct from v_initial.membership_id
  or v_scope.tenant_id is distinct from v_initial.tenant_id or v_scope.membership_id is distinct from v_initial.membership_id
  or v_scope.represented_party_id is distinct from v_initial.represented_party_id
  or app_private.check_workspace_native_permission_v2_at_v1(v_context,v_workspace,v_permission,'community_events',clock_timestamp()) is not true
 then raise exception 'ce_event_current_authority_denied' using errcode='42501';end if;
 if v_interest.id is null then insert into community.event_interests(tenant_id,workspace_id,event_id,occurrence_id,membership_id,status,version,updated_by) values(v_scope.tenant_id,v_workspace,v_event_id,v_occurrence_id,v_scope.membership_id,'interested',1,v_actor) returning * into v_interest;
  else update community.event_interests set status=case when v_command='register_interest' then 'interested' else 'withdrawn' end,version=version+1,updated_by=v_actor,updated_at=clock_timestamp() where id=v_interest.id returning * into v_interest;end if;
  v_result_version:=v_interest.version;v_entity_type:='event_interest';v_entity_id:=v_interest.id;
 elsif v_command='record_attendance' then
  if v_event.status<>'published' then raise exception 'ce_event_status_rejects_new_attendance' using errcode='40001';end if;
  if v_event.version<>v_expected then raise exception 'ce_event_version_conflict' using errcode='40001';end if;
  if exists(select 1 from community.event_attendance where event_id=v_event_id and membership_id=v_member_id) then raise exception 'ce_attendance_exists' using errcode='23505';end if;
  select id into strict v_occurrence_id from community.event_occurrences where event_id=v_event_id and timezone=p_request->>'timezone';
  insert into community.event_attendance(tenant_id,workspace_id,event_id,occurrence_id,membership_id,attended,observed_local,timezone,version,updated_by)
  values(v_scope.tenant_id,v_workspace,v_event_id,v_occurrence_id,v_member_id,true,(p_request->>'observed_local')::timestamp,p_request->>'timezone',1,v_actor) returning * into v_attendance;
  v_result_version:=1;v_entity_type:='event_attendance';v_entity_id:=v_attendance.id;
 elsif v_command='correct_attendance' then
  if v_event.status='draft' then raise exception 'ce_event_status_rejects_attendance_correction' using errcode='40001';end if;
  if v_event.version<>v_expected then raise exception 'ce_event_version_conflict' using errcode='40001';end if;
  if v_event.status='cancelled' and length(v_reason)<12 then raise exception 'ce_event_cancelled_correction_reason_required' using errcode='22023';end if;
  select * into v_attendance from community.event_attendance where id=(p_request->>'attendance_id')::uuid and event_id=v_event_id for update;
  v_record_expected:=(p_request->>'expected_attendance_version')::integer;
  if not found or v_attendance.version<>v_record_expected or v_attendance.timezone<>p_request->>'timezone' then raise exception 'ce_attendance_version_conflict' using errcode='40001';end if;
  v_member_id:=v_attendance.membership_id;
 -- Canonical Core primitives; no local evaluator/role grant/allow callback.
 select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 if v_member_id is not null and app_private.ce011_audience_current_v2(v_event_id,v_member_id) is not true
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 if v_command='create_event' and exists(select 1 from community.event_audience_members am where am.event_id=v_event_id
  and app_private.ce011_audience_current_v2(v_event_id,am.membership_id) is not true)
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 perform app_private.require_request_session_current_at_v1(clock_timestamp());
 select * into strict v_current from app_private.resolve_workspace_native_context_v2_at_v1(v_context,v_workspace,clock_timestamp());
 if auth.uid() is distinct from v_actor or v_current.tenant_id is distinct from v_initial.tenant_id
  or v_current.membership_id is distinct from v_initial.membership_id
  or v_scope.tenant_id is distinct from v_initial.tenant_id or v_scope.membership_id is distinct from v_initial.membership_id
  or v_scope.represented_party_id is distinct from v_initial.represented_party_id
  or app_private.check_workspace_native_permission_v2_at_v1(v_context,v_workspace,v_permission,'community_events',clock_timestamp()) is not true
 then raise exception 'ce_event_current_authority_denied' using errcode='42501';end if;
 v_before:=to_jsonb(v_attendance);update community.event_attendance set attended=(p_request->>'attended')::boolean,observed_local=(p_request->>'observed_local')::timestamp,
   version=version+1,corrected_after_cancellation=(v_event.status='cancelled'),updated_by=v_actor,updated_at=clock_timestamp() where id=v_attendance.id returning * into v_attendance;
  v_result_version:=v_attendance.version;v_entity_type:='event_attendance';v_entity_id:=v_attendance.id;
 end if;
 v_after:=jsonb_build_object('entity_type',v_entity_type,'entity_id',v_entity_id,'version',v_result_version,'command',v_command);
 v_response:=v_after||jsonb_build_object('replayed',false);
 insert into community.event_command_receipts(request_id,tenant_id,workspace_id,context_id,actor_id,membership_id,represented_party_id,command,canonical_key,entity_type,entity_id,result_version,response_json)
 values(v_request_id,v_scope.tenant_id,v_workspace,v_context,v_actor,v_scope.membership_id,v_scope.represented_party_id,v_command,v_key,v_entity_type,v_entity_id,v_result_version,v_response);
 insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,request_id,before_snapshot,after_snapshot,reason)
 values(v_scope.tenant_id,v_actor,'ce.'||v_command,v_entity_type,v_entity_id,v_request_id,v_before,v_after,v_reason);
 insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,trace_id)
 values(v_scope.tenant_id,v_entity_type,v_entity_id,v_result_version,'ce.'||v_command||'.v1',v_after,v_request_id);
 update platform.idempotency_keys set response_ref=v_response,status_code=200 where tenant_id=v_scope.tenant_id and key=v_key;
 -- Canonical Core primitives; no local evaluator/role grant/allow callback.
 select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 if v_member_id is not null and app_private.ce011_audience_current_v2(v_event_id,v_member_id) is not true
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 if v_command='create_event' and exists(select 1 from community.event_audience_members am where am.event_id=v_event_id
  and app_private.ce011_audience_current_v2(v_event_id,am.membership_id) is not true)
 then raise exception 'ce_event_current_audience_denied' using errcode='42501';end if;
 perform app_private.require_request_session_current_at_v1(clock_timestamp());
 select * into strict v_current from app_private.resolve_workspace_native_context_v2_at_v1(v_context,v_workspace,clock_timestamp());
 if auth.uid() is distinct from v_actor or v_current.tenant_id is distinct from v_initial.tenant_id
  or v_current.membership_id is distinct from v_initial.membership_id
  or v_scope.tenant_id is distinct from v_initial.tenant_id or v_scope.membership_id is distinct from v_initial.membership_id
  or v_scope.represented_party_id is distinct from v_initial.represented_party_id
  or app_private.check_workspace_native_permission_v2_at_v1(v_context,v_workspace,v_permission,'community_events',clock_timestamp()) is not true
 then raise exception 'ce_event_current_authority_denied' using errcode='42501';end if;
 return v_response;
end$$;

REVOKE ALL ON FUNCTION app_private.ce011_audience_current_v2(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION customer_api.command_ce_event_v2(jsonb) FROM PUBLIC,anon,authenticated,service_role;
-- Actual owners/RLS/ACL, recursive helper/session closure and Core request-local
-- profile are separate. No permission/module/entitlement/role seed or grant.
COMMIT;
