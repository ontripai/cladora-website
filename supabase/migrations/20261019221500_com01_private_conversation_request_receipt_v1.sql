begin;

-- Durable adapter evidence only. Existing private conversation, message and
-- notification tables remain the communication systems of record.
create table communications.request_receipts (
  id uuid primary key,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  context_id uuid not null references identity.context_grants(id) on delete restrict,
  request_id uuid not null,
  idempotency_key text not null check(idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_hash text not null check(request_hash ~ '^[0-9a-f]{64}$'),
  source_domain text not null check(source_domain = 'core'),
  source_entity_type text not null check(source_entity_type = 'private_conversation'),
  source_entity_id uuid not null,
  source_version bigint not null check(source_version = 1),
  notification_id uuid references communications.notifications(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null,
  receipt jsonb not null check(jsonb_typeof(receipt) = 'object'),
  recorded_at timestamptz not null default statement_timestamp(),
  unique(tenant_id, request_id),
  unique(tenant_id, requested_by, idempotency_key)
);
create index communication_request_receipts_workspace_time_idx
  on communications.request_receipts(tenant_id,workspace_id,recorded_at desc,id);
create index communication_request_receipts_context_idx on communications.request_receipts(context_id);
create index communication_request_receipts_notification_idx on communications.request_receipts(notification_id);
create index communication_request_receipts_requested_by_idx on communications.request_receipts(requested_by);
alter table communications.request_receipts enable row level security;
revoke all on communications.request_receipts from public,anon,authenticated,service_role;

create function communications.guard_request_receipt_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
  raise exception 'communication_request_receipt_immutable' using errcode='42501';
end;
$$;
create trigger communication_request_receipt_immutable before update or delete
  on communications.request_receipts for each row execute function communications.guard_request_receipt_v1();
revoke all on function communications.guard_request_receipt_v1()
  from public,anon,authenticated,service_role;

create function customer_api.create_private_conversation_v2(p_request jsonb)
returns jsonb
language plpgsql security definer set search_path=pg_catalog
as $$
declare
  v_actor uuid:=auth.uid(); v_context uuid; v_workspace uuid; v_conversation uuid;
  v_unit uuid; v_recipient uuid; v_message uuid; v_request_id uuid;
  v_key_input text; v_body text; v_requested_at timestamptz;
  v_membership uuid; v_tenant uuid; v_key text; v_hash text;
  v_saved platform.idempotency_keys%rowtype; v_receipt_id uuid:=gen_random_uuid();
  v_notification_id uuid; v_suppressed boolean:=false; v_receipt jsonb; v_result jsonb;
  v_marker jsonb; v_field text;
begin
  if v_actor is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'private_conversation_denied' using errcode='42501';
  end if;
  if jsonb_typeof(p_request) is distinct from 'object'
     or not(p_request ?& array['contract_version','context_id','workspace_id','conversation_id',
       'unit_id','recipient_membership_id','initial_message_id','body','client_request_id',
       'idempotency_key'])
     or p_request-array['contract_version','context_id','workspace_id','conversation_id',
       'unit_id','recipient_membership_id','initial_message_id','body','client_request_id',
       'idempotency_key']<>'{}'::jsonb then
    raise exception 'private_conversation_invalid' using errcode='22023';
  end if;
  foreach v_field in array array['contract_version','context_id','workspace_id','conversation_id',
    'unit_id','recipient_membership_id','initial_message_id','body','client_request_id',
    'idempotency_key'] loop
    if jsonb_typeof(p_request->v_field) is distinct from 'string' then
      raise exception 'private_conversation_invalid' using errcode='22023';
    end if;
  end loop;
  begin
    v_context:=(p_request->>'context_id')::uuid;
    v_workspace:=(p_request->>'workspace_id')::uuid;
    v_conversation:=(p_request->>'conversation_id')::uuid;
    v_unit:=(p_request->>'unit_id')::uuid;
    v_recipient:=(p_request->>'recipient_membership_id')::uuid;
    v_message:=(p_request->>'initial_message_id')::uuid;
    v_request_id:=(p_request->>'client_request_id')::uuid;
  exception when invalid_text_representation then
    raise exception 'private_conversation_invalid' using errcode='22023';
  end;
  v_key_input:=p_request->>'idempotency_key'; v_body:=btrim(p_request->>'body');
  if p_request->>'contract_version'<>'communications-private-conversation-workspace.v1'
     or v_context is null or v_workspace is null or v_conversation is null or v_unit is null
     or v_recipient is null or v_message is null or v_request_id is null
     or v_key_input!~'^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
     or length(v_body) not between 1 and 5000 then
    raise exception 'private_conversation_invalid' using errcode='22023';
  end if;

  v_membership:=communications.context_membership(v_context);
  v_requested_at:=statement_timestamp();
  select m.tenant_id into v_tenant from identity.memberships m
    where m.id=v_membership and m.user_id=v_actor and m.status='active';
  if v_membership is null or v_tenant is null or v_recipient=v_membership
     or app_private.check_workspace_native_permission_v2(
       v_context,v_workspace,'communications.feed.read','communications') is not true
     or not communications.member_covers_unit(v_membership,v_tenant,v_unit)
     or not communications.member_covers_unit(v_recipient,v_tenant,v_unit)
     or not communications.private_pair_allowed(v_membership,v_recipient,v_unit)
     or not exists(
       select 1 from platform.customer_workspaces w
       join platform.workspace_property_bindings b on b.customer_workspace_id=w.id
         and b.tenant_id=w.tenant_id and b.status='active'
         and b.valid_from<=clock_timestamp() and(b.valid_to is null or b.valid_to>clock_timestamp())
       join portfolio.units u on u.id=v_unit and u.tenant_id=w.tenant_id
       join portfolio.buildings building on building.id=u.building_id and building.tenant_id=u.tenant_id
         and building.property_id=b.property_id
       where w.id=v_workspace and w.tenant_id=v_tenant and w.lifecycle_status='ACTIVE' and w.archived_at is null
     ) then raise exception 'private_conversation_denied' using errcode='42501'; end if;

  v_key:='com01:private_conversation:v1:'||v_workspace||':'||v_actor||':'||v_key_input;
  v_hash:=encode(sha256(convert_to(jsonb_build_object('tenant',v_tenant,'actor',v_actor,'request',p_request)::text,'UTF8')),'hex');
  insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at)
    values(v_tenant,v_actor,v_key,v_hash,clock_timestamp()+interval '7 days')
    on conflict(tenant_id,key) do nothing;
  select * into strict v_saved from platform.idempotency_keys
    where tenant_id=v_tenant and key=v_key for update;
  if v_saved.actor_id is distinct from v_actor or v_saved.request_hash<>v_hash
     or v_saved.expires_at<=clock_timestamp() then
    raise exception 'private_conversation_request_conflict' using errcode='23505';
  end if;

  -- Recheck every current condition after serialization. A receipt cannot be
  -- replayed after a context, relationship, pair or Workspace binding revoke.
  if communications.context_membership(v_context) is distinct from v_membership
     or app_private.check_workspace_native_permission_v2(
       v_context,v_workspace,'communications.feed.read','communications') is not true
     or not communications.member_covers_unit(v_membership,v_tenant,v_unit)
     or not communications.member_covers_unit(v_recipient,v_tenant,v_unit)
     or not communications.private_pair_allowed(v_membership,v_recipient,v_unit)
     or not exists(
       select 1 from platform.customer_workspaces w
       join platform.workspace_property_bindings b on b.customer_workspace_id=w.id
         and b.tenant_id=w.tenant_id and b.status='active'
         and b.valid_from<=clock_timestamp() and(b.valid_to is null or b.valid_to>clock_timestamp())
       join portfolio.units u on u.id=v_unit and u.tenant_id=w.tenant_id
       join portfolio.buildings building on building.id=u.building_id and building.tenant_id=u.tenant_id
         and building.property_id=b.property_id
       where w.id=v_workspace and w.tenant_id=v_tenant and w.lifecycle_status='ACTIVE' and w.archived_at is null
     ) then
    raise exception 'private_conversation_denied' using errcode='42501';
  end if;
  if v_saved.response_ref is not null then
    if not exists(
      select 1 from communications.private_conversations c
      join communications.private_participants a on a.conversation_id=c.id
        and a.membership_id=v_membership and a.revoked_at is null
      join communications.private_participants r on r.conversation_id=c.id
        and r.membership_id=v_recipient and r.revoked_at is null
      join communications.private_messages m on m.id=v_message and m.conversation_id=c.id
        and m.sender_id=v_membership and m.client_request_id=v_request_id
        and m.version=1 and m.lifecycle_state='available' and m.body=v_body
      where c.id=v_conversation and c.workspace_id=v_workspace and c.unit_id=v_unit
        and c.created_by=v_membership and c.client_request_id=v_request_id
    ) then raise exception 'private_conversation_request_conflict' using errcode='40001'; end if;
    return v_saved.response_ref || jsonb_build_object('replayed',true);
  end if;

  v_marker:=jsonb_build_object('contract_version','communications-private-conversation-workspace.v1',
    'workspace_id',v_workspace,'tenant_id',v_tenant,'unit_id',v_unit,
    'actor_membership_id',v_membership,'client_request_id',v_request_id);
  perform set_config('communications.private_conversation_workspace_writer_v1',v_marker::text,true);
  insert into communications.private_conversations(
    id,tenant_id,workspace_id,unit_id,created_by,client_request_id)
    values(v_conversation,v_tenant,v_workspace,v_unit,v_membership,v_request_id);
  insert into communications.private_participants(conversation_id,membership_id)
    values(v_conversation,v_membership),(v_conversation,v_recipient);
  insert into communications.private_messages(id,conversation_id,sender_id,client_request_id,body)
    values(v_message,v_conversation,v_membership,v_request_id,v_body);

  select exists(select 1 from communications.notification_preferences p
    where p.membership_id=v_recipient and p.tenant_id=v_tenant and p.channel='in_app'
      and p.event_type='private_message' and p.enabled is false) into v_suppressed;
  if not v_suppressed then
    insert into communications.notifications(tenant_id,membership_id,type,title,action_url,payload)
      values(v_tenant,v_recipient,'private_message','New private message','/app/communications',
        jsonb_build_object('conversation_id',v_conversation,'message_id',v_message))
      returning id into v_notification_id;
  end if;

  v_receipt:=jsonb_build_object(
    'contract_version','communication-request-receipt.v1','request_id',v_request_id,
    'idempotency_key',v_key_input,'workspace_id',v_workspace,'source_domain','core',
    'source_entity_type','private_conversation','source_entity_id',v_conversation,
    'source_version',1,'receipt_id',v_receipt_id,'receipt_version',1,
    'recorded_at',statement_timestamp(),'action_authorization','not_evaluated',
    'delivery_authorization','not_implied','request_status','accepted',
    'resolved_audience_policy','communications.private_pair.current_unit',
    'selected_channels',jsonb_build_array('in_app'),
    'delivery_evidence',jsonb_build_array(jsonb_build_object(
      'channel','in_app','delivery_status',case when v_suppressed then 'suppressed' else 'queued' end,
      'delivery_reference',case when v_notification_id is null then null else 'communications.notifications:'||v_notification_id::text||':v1' end,
      'attempt_version',case when v_notification_id is null then null else 1 end,
      'occurred_at',statement_timestamp(),'recipient_disclosure','withheld')),
    'reason_codes',jsonb_build_array('communication_request_accepted'));
  insert into communications.request_receipts(id,tenant_id,workspace_id,context_id,request_id,
    idempotency_key,request_hash,source_domain,source_entity_type,source_entity_id,source_version,
    notification_id,requested_by,requested_at,receipt)
    values(v_receipt_id,v_tenant,v_workspace,v_context,v_request_id,v_key_input,v_hash,'core',
      'private_conversation',v_conversation,1,v_notification_id,v_actor,v_requested_at,v_receipt);
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,request_id,after_snapshot,reason)
    values(v_tenant,v_actor,'communication.request.accepted','communications.request_receipt',
      v_receipt_id,v_request_id,v_receipt,'COM-01 private conversation adapter');
  insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
    values(v_tenant,'communication_request',v_receipt_id,1,'communication.request.accepted',v_receipt);
  v_result:=jsonb_build_object('conversation_id',v_conversation,'message_id',v_message,
    'replayed',false,'communication_receipt',v_receipt);
  update platform.idempotency_keys set response_ref=v_result,status_code=201
    where tenant_id=v_tenant and key=v_key;
  return v_result;
end;
$$;

-- The pre-Workspace writer is now both unsafe and non-functional under D5.
revoke all on function customer_api.create_private_conversation_v1(uuid,uuid,uuid,text,uuid)
  from public,anon,authenticated,service_role;
revoke all on function customer_api.create_private_conversation_v2(jsonb)
  from public,anon,authenticated,service_role;
grant execute on function customer_api.create_private_conversation_v2(jsonb) to authenticated;

comment on function customer_api.create_private_conversation_v2(jsonb) is
  'COM-01/#166 canonical first-message writer: explicit Workspace, current AUTH01/pair checks, existing conversation/notification engines, durable withheld-recipient receipt.';

commit;
