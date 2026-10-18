begin;

select app_private.acquire_core_platform_role_safety_mutation_lock_v1();

-- S2 is one private phase-aware finalizer. Core selects the fixed phase from
-- its trusted provider callbacks; no HTTP/public caller receives EXECUTE.
-- Core continues to own idempotency, receipts, audit and outbox effects.
create function app_private.execute_service_request_message_link_v2(
  p_mode text,
  p_context_id uuid,
  p_workspace_id uuid,
  p_actor_id uuid,
  p_request_id uuid,
  p_expected_request_version bigint,
  p_message_id uuid,
  p_expected_message_version bigint
)
returns table(
  decision text,
  denial_reason text,
  mutation_id uuid,
  request_version bigint,
  message_version bigint,
  evaluated_at timestamptz,
  write_applied boolean
)
language plpgsql
volatile
security definer
set search_path=pg_catalog
as $$
declare
  v_gate record;
  v_request service_catalog.requests%rowtype;
  v_link service_catalog.request_subject_links%rowtype;
  v_result_request_version bigint;
  v_link_id uuid;
  v_conversation_id uuid;
  v_conversation_tenant_id uuid;
  v_conversation_unit_id uuid;
  v_provider_party_id uuid;
  v_property_id uuid;
begin
  decision:='denied'; denial_reason:='INVALID_INPUT';
  mutation_id:=null; request_version:=null; message_version:=null;
  evaluated_at:=clock_timestamp(); write_applied:=false;

  if p_mode not in ('validate','apply','replay')
      or p_context_id is null or p_workspace_id is null or p_actor_id is null
      or p_request_id is null or p_message_id is null
      or p_expected_request_version not between 1 and 9007199254740990
      or p_expected_message_version not between 1 and 9007199254740991 then
    return next; return;
  end if;
  v_result_request_version:=p_expected_request_version+1;

  if auth.uid() is null or auth.uid()<>p_actor_id
      or app_private.check_workspace_native_permission_v2(
        p_context_id,p_workspace_id,'services.orders.subject_link','services_orders'
      ) is not true then
    denial_reason:='AUTHORITY_DENIED'; evaluated_at:=clock_timestamp();
    return next; return;
  end if;

  if p_mode='apply' then
    perform app_private.lock_service_request_version_v1(
      p_workspace_id,p_request_id,p_expected_request_version
    );
    select r.* into v_request
    from service_catalog.requests r
    where r.id=p_request_id and r.workspace_id=p_workspace_id
      and r.requester_id=p_actor_id and r.version=p_expected_request_version;
  elsif p_mode='validate' then
    select r.* into v_request
    from service_catalog.requests r
    where r.id=p_request_id and r.workspace_id=p_workspace_id
      and r.requester_id=p_actor_id and r.version=p_expected_request_version
    for update;
  else
    select r.* into v_request
    from service_catalog.requests r
    where r.id=p_request_id and r.workspace_id=p_workspace_id
      and r.requester_id=p_actor_id and r.version=v_result_request_version
    for share;
  end if;
  if not found then
    denial_reason:=case when p_mode='replay' then 'REPLAY_STATE_CHANGED'
      else 'STALE_REQUEST' end;
    evaluated_at:=clock_timestamp(); return next; return;
  end if;

  -- Request dependencies precede Communications locks in the canonical order.
  select offering.provider_party_id into v_provider_party_id
  from service_catalog.offerings offering
  where offering.id=v_request.offering_id
    and offering.tenant_id=v_request.tenant_id
    and offering.workspace_id=v_request.workspace_id
  for key share;
  if not found then
    denial_reason:=case when p_mode='replay' then 'REPLAY_STATE_CHANGED'
      else 'AUDIENCE_DENIED' end;
    evaluated_at:=clock_timestamp(); return next; return;
  end if;

  perform party.id
  from portfolio.parties party
  where party.id in(v_request.beneficiary_party_id,v_provider_party_id)
    and party.tenant_id=v_request.tenant_id and party.archived_at is null
  order by party.id
  for share;
  if not found then
    denial_reason:=case when p_mode='replay' then 'REPLAY_STATE_CHANGED'
      else 'AUDIENCE_DENIED' end;
    evaluated_at:=clock_timestamp(); return next; return;
  end if;

  -- The first message read discovers only the parent key. It is not authority
  -- evidence. Lock the parent before re-reading the exact message so the FK's
  -- KEY SHARE lock queues concurrent participant inserts behind this command.
  select m.conversation_id into v_conversation_id
  from communications.private_messages m
  where m.id=p_message_id;
  if not found then
    denial_reason:=case when p_mode='replay' then 'REPLAY_STATE_CHANGED'
      else 'STALE_SUBJECT' end;
    evaluated_at:=clock_timestamp(); return next; return;
  end if;

  select c.tenant_id,c.unit_id
    into v_conversation_tenant_id,v_conversation_unit_id
  from communications.private_conversations c
  where c.id=v_conversation_id
    and c.workspace_id is not null
    and c.workspace_id=p_workspace_id
    and c.tenant_id=v_request.tenant_id
  for update;
  if not found then
    denial_reason:=case when p_mode='replay' then 'REPLAY_STATE_CHANGED'
      else 'AUDIENCE_DENIED' end;
    evaluated_at:=clock_timestamp(); return next; return;
  end if;

  perform m.id
  from communications.private_messages m
  where m.id=p_message_id and m.conversation_id=v_conversation_id
    and m.version=p_expected_message_version
    and m.lifecycle_state='available'
  for share;
  if not found then
    denial_reason:=case when p_mode='replay' then 'REPLAY_STATE_CHANGED'
      else 'STALE_SUBJECT' end;
    evaluated_at:=clock_timestamp(); return next; return;
  end if;

  -- Freeze the complete current audience, then its membership and party
  -- resolution rows, in deterministic UUID order. The locks survive both
  -- validate and apply because Core owns the surrounding transaction.
  perform participant.membership_id
  from communications.private_participants participant
  where participant.conversation_id=v_conversation_id
  order by participant.membership_id
  for share;

  perform membership.id
  from identity.memberships membership
  join communications.private_participants participant
    on participant.membership_id=membership.id
  where participant.conversation_id=v_conversation_id
  order by membership.id
  for share of membership;

  perform membership_party.membership_id
  from identity.membership_parties membership_party
  join communications.private_participants participant
    on participant.membership_id=membership_party.membership_id
  where participant.conversation_id=v_conversation_id
  order by membership_party.membership_id,membership_party.party_id
  for share of membership_party;

  perform vendor_membership.id
  from maintenance.vendor_portal_memberships vendor_membership
  join communications.private_participants participant
    on participant.membership_id=vendor_membership.membership_id
  where participant.conversation_id=v_conversation_id
  order by vendor_membership.membership_id,vendor_membership.vendor_id
  for share of vendor_membership;

  perform vendor.id
  from maintenance.vendors vendor
  join maintenance.vendor_portal_memberships vendor_membership
    on vendor_membership.vendor_id=vendor.id
  join communications.private_participants participant
    on participant.membership_id=vendor_membership.membership_id
  where participant.conversation_id=v_conversation_id
  order by vendor.id
  for share of vendor;

  select building.property_id into v_property_id
  from portfolio.units unit_row
  join portfolio.buildings building
    on building.id=unit_row.building_id and building.tenant_id=unit_row.tenant_id
  where unit_row.id=v_conversation_unit_id
    and unit_row.tenant_id=v_conversation_tenant_id
  for share of unit_row,building;
  if not found then
    denial_reason:=case when p_mode='replay' then 'REPLAY_STATE_CHANGED'
      else 'AUDIENCE_DENIED' end;
    evaluated_at:=clock_timestamp(); return next; return;
  end if;

  perform binding.id
  from platform.workspace_property_bindings binding
  where binding.tenant_id=v_conversation_tenant_id
    and binding.customer_workspace_id=p_workspace_id
    and binding.property_id=v_property_id
    and binding.status='active'
    and binding.valid_from<=statement_timestamp()
    and (binding.valid_to is null or binding.valid_to>statement_timestamp())
  order by binding.id
  for share;
  if not found then
    denial_reason:=case when p_mode='replay' then 'REPLAY_STATE_CHANGED'
      else 'AUDIENCE_DENIED' end;
    evaluated_at:=clock_timestamp(); return next; return;
  end if;

  select * into v_gate
  from communications.resolve_private_message_request_audience_current_v2(
    p_context_id,p_workspace_id,p_actor_id,p_message_id,p_expected_message_version,
    p_request_id,case when p_mode='replay' then v_result_request_version
      else p_expected_request_version end
  );
  if not found or v_gate.decision is distinct from 'accepted'
      or v_gate.current_actor_can_read is distinct from true
      or v_gate.request_party_audience_only is distinct from true then
    denial_reason:=case
      when p_mode='replay' then 'REPLAY_STATE_CHANGED'
      when v_gate.denial_reason in ('STALE_REQUEST','STALE_SUBJECT')
        then v_gate.denial_reason
      else 'AUDIENCE_DENIED' end;
    evaluated_at:=coalesce(v_gate.evaluated_at,clock_timestamp());
    return next; return;
  end if;

  -- Recheck current authority after all provider and row-lock waits.
  if app_private.check_workspace_native_permission_v2(
      p_context_id,p_workspace_id,'services.orders.subject_link','services_orders'
    ) is not true then
    denial_reason:='AUTHORITY_DENIED'; evaluated_at:=clock_timestamp();
    return next; return;
  end if;

  if p_mode='replay' then
    select l.* into v_link
    from service_catalog.request_subject_links l
    where l.tenant_id=v_request.tenant_id and l.workspace_id=p_workspace_id
      and l.request_id=p_request_id and l.request_version=v_result_request_version
      and l.message_id=p_message_id and l.message_version=p_expected_message_version
      and l.relation='conversation' and l.created_by=p_actor_id
    for share;
    if not found then
      denial_reason:='REPLAY_STATE_CHANGED'; evaluated_at:=clock_timestamp();
      return next; return;
    end if;
    decision:='accepted'; denial_reason:=null; mutation_id:=v_link.id;
    request_version:=v_result_request_version;
    message_version:=p_expected_message_version;
    evaluated_at:=clock_timestamp(); write_applied:=false;
    return next; return;
  end if;

  if exists(
      select 1 from service_catalog.request_subject_links l
      where l.request_id=p_request_id and l.message_id=p_message_id
    ) then
    denial_reason:='LINK_CONFLICT'; evaluated_at:=clock_timestamp();
    return next; return;
  end if;

  if p_mode='validate' then
    decision:='accepted'; denial_reason:=null;
    request_version:=v_result_request_version;
    message_version:=p_expected_message_version;
    evaluated_at:=clock_timestamp(); write_applied:=false;
    return next; return;
  end if;

  v_link_id:=gen_random_uuid();
  insert into service_catalog.request_subject_links(
    id,tenant_id,workspace_id,request_id,request_version,
    message_id,message_version,relation,created_by
  ) values(
    v_link_id,v_request.tenant_id,v_request.workspace_id,v_request.id,
    v_result_request_version,p_message_id,p_expected_message_version,
    'conversation',p_actor_id
  );
  update service_catalog.requests
  set version=v_result_request_version
  where id=p_request_id and workspace_id=p_workspace_id
    and version=p_expected_request_version;
  if not found then
    raise exception 'service_request_link_stale' using errcode='40001';
  end if;

  decision:='accepted'; denial_reason:=null; mutation_id:=v_link_id;
  request_version:=v_result_request_version;
  message_version:=p_expected_message_version;
  evaluated_at:=clock_timestamp(); write_applied:=true;
  return next;
end;
$$;

alter function app_private.execute_service_request_message_link_v2(
  text,uuid,uuid,uuid,uuid,bigint,uuid,bigint
) owner to postgres;

revoke all on function app_private.execute_service_request_message_link_v2(
  text,uuid,uuid,uuid,uuid,bigint,uuid,bigint
) from public,anon,authenticated,service_role,cladora_rpc_owner,
  cladora_ce_guide_runtime,cladora_ce_guide_executor;

comment on function app_private.execute_service_request_message_link_v2(
  text,uuid,uuid,uuid,uuid,bigint,uuid,bigint
) is
  'S2 private validate/apply/replay finalizer; provider-current-state replay is read-only and Core retains ledger ownership.';

commit;
