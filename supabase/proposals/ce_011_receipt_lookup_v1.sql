-- INACTIVE review-only additive reader. No installation or positive grant.
begin;
create function customer_api.lookup_ce_event_receipt_v1(p_request jsonb) returns jsonb
language plpgsql security definer set search_path=pg_catalog set lock_timeout='1s' as $$
declare
 v_actor uuid:=auth.uid(); v_context uuid;v_workspace uuid;v_request_id uuid;v_event_id uuid;v_member uuid;
 v_command text;v_permission text;v_client_key text;v_key text;v_hash text;v_scope record;v_before_scope record;
 v_idem platform.idempotency_keys%rowtype;v_receipt community.event_command_receipts%rowtype;
 v_result jsonb;v_expected integer;v_entity text;v_unresolved jsonb:='{"contract":"ce011-receipt-lookup.v1","status":"unresolved"}';
begin
 if v_actor is null then raise exception 'access_denied' using errcode='42501';end if;
 if jsonb_typeof(p_request) is distinct from 'object' then raise exception 'invalid_request' using errcode='22023';end if;
 begin
  v_context:=(p_request->>'context_id')::uuid;v_workspace:=(p_request->>'workspace_id')::uuid;
  v_request_id:=(p_request->>'command_id')::uuid;v_event_id:=(p_request->>'event_id')::uuid;
 exception when others then raise exception 'invalid_request' using errcode='22023';end;
 v_command:=p_request->>'type';v_client_key:=p_request->>'idempotency_key';
 if v_context is null or v_workspace is null or v_request_id is null or v_event_id is null
  or v_client_key is null or v_client_key!~'^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
  or v_command is null or v_command not in('create_event','publish_event','cancel_event','register_interest','withdraw_interest','record_attendance','correct_attendance')
 then raise exception 'invalid_request' using errcode='22023';end if;
 -- Actor, tenant, membership, represented party and permission are server-owned.
 v_permission:=case when v_command in('create_event','publish_event') then 'events.event.publish' when v_command='cancel_event' then 'events.event.cancel'
  when v_command in('register_interest','withdraw_interest') then 'events.interest.manage_self' when v_command='record_attendance' then 'events.attendance.record' else 'events.attendance.correct' end;
 select * into strict v_before_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 v_key:='ce.event.'||v_command||'.v1/'||v_workspace||'/'||v_request_id||'/'||v_client_key;
 -- EXACT existing SQL jsonb text encoding, not JSON.stringify or a client digest.
 v_hash:=encode(sha256(convert_to(jsonb_build_object('schema_version',1,'actor_user_id',v_actor,'context_id',v_context,'workspace_id',v_workspace,'command',p_request)::text,'UTF8')),'hex');
 begin
  -- Synchronize with existing command's idempotency lock, but never reserve a key.
  select * into v_idem from platform.idempotency_keys where tenant_id=v_before_scope.tenant_id and key=v_key for share;
 exception when lock_not_available then
  v_idem:=null;
 end;
 select * into strict v_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 if v_scope.tenant_id is distinct from v_before_scope.tenant_id or v_scope.membership_id is distinct from v_before_scope.membership_id
  or v_scope.represented_party_id is distinct from v_before_scope.represented_party_id or auth.uid() is distinct from v_actor
 then raise exception 'access_denied' using errcode='42501';end if;
 v_member:=case when v_command in('register_interest','withdraw_interest') then v_scope.membership_id
  when v_command='record_attendance' then (p_request->>'target_membership_id')::uuid
  when v_command='correct_attendance' then (select a.membership_id from community.event_attendance a
   where a.id=(p_request->>'attendance_id')::uuid and a.tenant_id=v_scope.tenant_id and a.workspace_id=v_workspace and a.event_id=v_event_id)
  else null end;
 if v_command in('register_interest','withdraw_interest','record_attendance','correct_attendance')
  and(v_member is null or app_private.ce_event_audience_eligible_v1(v_event_id,v_member) is not true)
 then raise exception 'access_denied' using errcode='42501';end if;
 if v_idem.key is null then return v_unresolved;end if;
 if v_idem.actor_id is distinct from v_actor or v_idem.request_hash is distinct from v_hash then
  raise exception 'receipt_mismatch' using errcode='23505';end if;
 if v_idem.expires_at is null or v_idem.expires_at<=clock_timestamp() or v_idem.response_ref is null then return v_unresolved;end if;
 select * into v_receipt from community.event_command_receipts where tenant_id=v_scope.tenant_id and canonical_key=v_key;
 if not found then return v_unresolved;end if;
 v_result:=v_receipt.response_json;
 v_expected:=case when v_command in('create_event','record_attendance') then 1
  when v_command in('register_interest','withdraw_interest') then (p_request->>'expected_interest_version')::integer+1
  when v_command='correct_attendance' then (p_request->>'expected_attendance_version')::integer+1 else (p_request->>'expected_version')::integer+1 end;
 v_entity:=case when v_command in('create_event','publish_event','cancel_event') then 'event'
  when v_command in('register_interest','withdraw_interest') then 'event_interest' else 'event_attendance' end;
 if v_receipt.request_id is distinct from v_request_id or v_receipt.workspace_id is distinct from v_workspace
  or v_receipt.context_id is distinct from v_context or v_receipt.actor_id is distinct from v_actor
  or v_receipt.membership_id is distinct from v_scope.membership_id or v_receipt.represented_party_id is distinct from v_scope.represented_party_id
  or v_receipt.command is distinct from v_command or v_receipt.canonical_key is distinct from v_key
  or v_idem.status_code is distinct from 200 or v_idem.response_ref is distinct from v_result
  or jsonb_typeof(v_result) is distinct from 'object' then raise exception 'receipt_mismatch' using errcode='23505';end if;
 if (select count(*) from jsonb_object_keys(v_result))<>5
  or v_result->>'entity_type' is distinct from v_entity or v_result->>'command' is distinct from v_command
  or v_result->'replayed' is distinct from 'false'::jsonb
  or v_result->'version' is distinct from to_jsonb(v_expected)
  or v_receipt.entity_type is distinct from v_entity or v_receipt.result_version is distinct from v_expected
  or v_result->>'entity_id' is distinct from v_receipt.entity_id::text
  or(v_entity='event' and v_receipt.entity_id is distinct from v_event_id)
  or(v_command='correct_attendance' and v_receipt.entity_id is distinct from (p_request->>'attendance_id')::uuid)
 then raise exception 'receipt_mismatch' using errcode='23505';end if;
 select * into strict v_before_scope from app_private.ce_event_authorize_v1(v_context,v_workspace,v_permission);
 if auth.uid() is distinct from v_actor or v_before_scope.tenant_id is distinct from v_scope.tenant_id
  or v_before_scope.membership_id is distinct from v_scope.membership_id
  or v_before_scope.represented_party_id is distinct from v_scope.represented_party_id
  or(v_member is not null and app_private.ce_event_audience_eligible_v1(v_event_id,v_member) is not true)
 then raise exception 'access_denied' using errcode='42501';end if;
 return jsonb_build_object('contract','ce011-receipt-lookup.v1','status','matched','result',v_result);
end$$;
revoke all on function customer_api.lookup_ce_event_receipt_v1(jsonb) from public,anon,authenticated,service_role;
commit;
