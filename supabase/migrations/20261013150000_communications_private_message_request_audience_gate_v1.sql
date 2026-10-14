begin;

-- Private, read-only composition gate for linking a Communications message to
-- a canonical SERVICE Request. SERVICE remains the owner of Request parties;
-- Communications remains the owner of the message audience. This migration
-- adds no store, grant, receipt ledger, route, or runtime activation.
create function communications.resolve_private_message_request_audience_v1(
  p_context_id uuid,
  p_workspace_id uuid,
  p_actor_id uuid,
  p_message_id uuid,
  p_expected_message_version bigint,
  p_request_id uuid,
  p_expected_request_version bigint
)
returns table(
  decision text,
  denial_reason text,
  current_actor_can_read boolean,
  request_party_audience_only boolean,
  evaluated_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_subject record;
  v_request_context jsonb;
  v_message communications.private_messages%rowtype;
  v_conversation communications.private_conversations%rowtype;
  v_beneficiary_party_id uuid;
  v_provider_party_id uuid;
  v_context_party_id uuid;
  v_audience_count integer;
  v_resolved_count integer;
  v_compatible_count integer;
  v_required_party_count integer;
  v_present_party_count integer;
begin
  if p_context_id is null or p_workspace_id is null or p_actor_id is null
      or p_message_id is null or p_request_id is null
      or p_expected_message_version is null
      or p_expected_message_version not between 1 and 9007199254740991
      or p_expected_request_version is null
      or p_expected_request_version not between 1 and 9007199254740991 then
    decision := 'denied'; denial_reason := 'AUDIENCE_DENIED';
    current_actor_can_read := null; request_party_audience_only := null;
    evaluated_at := clock_timestamp(); return next; return;
  end if;

  -- Preserve the existing current permission/module, exact scope, lifecycle,
  -- participant, Workspace and message-version boundary before audience work.
  select * into v_subject
  from communications.resolve_private_message_subject_v1(
    p_context_id,p_workspace_id,p_actor_id,p_message_id,p_expected_message_version
  );
  if v_subject.decision is distinct from 'accepted' then
    decision := 'denied';
    denial_reason := case when v_subject.denial_reason='STALE_SUBJECT'
      then 'STALE_SUBJECT' else 'AUDIENCE_DENIED' end;
    current_actor_can_read := null; request_party_audience_only := null;
    evaluated_at := clock_timestamp(); return next; return;
  end if;

  -- Consume the canonical SERVICE context. Expected Request denials are
  -- converted inside a PostgreSQL subtransaction, so the outer transaction
  -- remains usable. Unrelated serialization failures are never swallowed.
  begin
    v_request_context := app_private.service_request_subject_context_v1(
      p_context_id,p_workspace_id,p_request_id,p_expected_request_version
    );
  exception
    when sqlstate '42501' or sqlstate '22023' then
      decision := 'denied'; denial_reason := 'AUDIENCE_DENIED';
      current_actor_can_read := null; request_party_audience_only := null;
      evaluated_at := clock_timestamp(); return next; return;
    when sqlstate '40001' then
      if sqlerrm='request_version_conflict' then
        decision := 'denied'; denial_reason := 'STALE_REQUEST';
        current_actor_can_read := null; request_party_audience_only := null;
        evaluated_at := clock_timestamp(); return next; return;
      end if;
      raise;
  end;

  if jsonb_typeof(v_request_context) is distinct from 'object'
      or v_request_context->>'request_id' is distinct from p_request_id::text
      or v_request_context->>'workspace_id' is distinct from p_workspace_id::text
      or (v_request_context->>'request_version')::bigint is distinct from p_expected_request_version
      or v_request_context#>>'{audience_party_snapshot,request_party_only}' is distinct from 'true'
      or jsonb_array_length(v_request_context#>'{audience_party_snapshot,party_ids}') <> 1
      or v_request_context#>>'{actor_party_snapshot,current_actor_is_party}' is distinct from 'true'
      or v_request_context#>>'{actor_party_snapshot,party_id}'
         is distinct from v_request_context#>>'{audience_party_snapshot,party_ids,0}' then
    decision := 'denied'; denial_reason := 'AUDIENCE_DENIED';
    current_actor_can_read := null; request_party_audience_only := null;
    evaluated_at := clock_timestamp(); return next; return;
  end if;
  begin
    v_context_party_id := (v_request_context#>>'{audience_party_snapshot,party_ids,0}')::uuid;
  exception when invalid_text_representation then
    decision := 'denied'; denial_reason := 'AUDIENCE_DENIED';
    current_actor_can_read := null; request_party_audience_only := null;
    evaluated_at := clock_timestamp(); return next; return;
  end;

  select m.* into v_message
  from communications.private_messages m
  join communications.private_conversations c on c.id=m.conversation_id
  where m.id=p_message_id and m.version=p_expected_message_version
    and m.lifecycle_state='available';
  if not found then
    decision := 'denied'; denial_reason := 'STALE_SUBJECT';
    current_actor_can_read := null; request_party_audience_only := null;
    evaluated_at := clock_timestamp(); return next; return;
  end if;
  select c.* into v_conversation
  from communications.private_conversations c
  where c.id=v_message.conversation_id;
  if not found then
    decision := 'denied'; denial_reason := 'AUDIENCE_DENIED';
    current_actor_can_read := null; request_party_audience_only := null;
    evaluated_at := clock_timestamp(); return next; return;
  end if;

  select r.beneficiary_party_id,o.provider_party_id
    into v_beneficiary_party_id,v_provider_party_id
  from service_catalog.requests r
  join service_catalog.offerings o on o.id=r.offering_id
    and o.tenant_id=r.tenant_id and o.workspace_id=r.workspace_id
  join portfolio.parties beneficiary on beneficiary.id=r.beneficiary_party_id
    and beneficiary.tenant_id=r.tenant_id and beneficiary.archived_at is null
  join portfolio.parties provider on provider.id=o.provider_party_id
    and provider.tenant_id=r.tenant_id and provider.archived_at is null
  where r.id=p_request_id and r.workspace_id=p_workspace_id
    and r.tenant_id=v_conversation.tenant_id
    and r.version=p_expected_request_version
  for share of r,o,beneficiary,provider;
  if not found or v_context_party_id<>v_beneficiary_party_id then
    decision := 'denied'; denial_reason := 'AUDIENCE_DENIED';
    current_actor_can_read := null; request_party_audience_only := null;
    evaluated_at := clock_timestamp(); return next; return;
  end if;

  -- Resolve every membership that could read this message when it was sent.
  -- A membership must map unambiguously to the beneficiary or provider party.
  -- Missing or conflicting mappings deny; no role- or Workspace-based fallback.
  with audience as (
    select p.membership_id
    from communications.private_participants p
    where p.conversation_id=v_conversation.id
      and p.joined_at<=v_message.sent_at
      and (p.revoked_at is null or p.revoked_at>v_message.sent_at)
  ), current_audience as (
    select a.membership_id
    from audience a
    join communications.private_participants p on p.conversation_id=v_conversation.id
      and p.membership_id=a.membership_id and p.revoked_at is null
    join identity.memberships m on m.id=a.membership_id
      and m.tenant_id=v_conversation.tenant_id
      and m.status='active'
      and m.starts_at<=v_message.sent_at
      and (m.ends_at is null or m.ends_at>statement_timestamp())
  ), resolutions as (
    select a.membership_id,mp.party_id
    from current_audience a
    join identity.membership_parties mp on mp.membership_id=a.membership_id
      and mp.tenant_id=v_conversation.tenant_id
      and mp.valid_from<=v_message.sent_at
      and (mp.valid_until is null or mp.valid_until>statement_timestamp())
    join portfolio.parties p on p.id=mp.party_id and p.tenant_id=mp.tenant_id
      and p.archived_at is null
    union all
    select a.membership_id,v.party_id
    from current_audience a
    join maintenance.vendor_portal_memberships vp on vp.membership_id=a.membership_id
      and vp.tenant_id=v_conversation.tenant_id
      and vp.status='active' and vp.accepted_at is not null
      and vp.accepted_at<=v_message.sent_at
      and (vp.revoked_at is null or vp.revoked_at>v_message.sent_at)
    join maintenance.vendors v on v.id=vp.vendor_id and v.tenant_id=vp.tenant_id
      and v.status='approved'
    join portfolio.parties p on p.id=v.party_id and p.tenant_id=v.tenant_id
      and p.archived_at is null
  ), per_member as (
    select a.membership_id,count(distinct r.party_id) resolution_count,
      min(r.party_id::text)::uuid party_id
    from audience a left join resolutions r on r.membership_id=a.membership_id
    group by a.membership_id
  )
  select count(*),count(*) filter(where resolution_count=1),
    count(*) filter(where resolution_count=1
      and party_id in(v_beneficiary_party_id,v_provider_party_id)),
    count(distinct party_id) filter(where resolution_count=1
      and party_id in(v_beneficiary_party_id,v_provider_party_id))
  into v_audience_count,v_resolved_count,v_compatible_count,v_present_party_count
  from per_member;

  v_required_party_count := case
    when v_beneficiary_party_id=v_provider_party_id then 1 else 2 end;

  if v_audience_count<1 or v_resolved_count<>v_audience_count
      or v_compatible_count<>v_audience_count
      or v_present_party_count<>v_required_party_count then
    decision := 'denied'; denial_reason := 'AUDIENCE_DENIED';
    current_actor_can_read := null; request_party_audience_only := null;
    evaluated_at := clock_timestamp(); return next; return;
  end if;

  decision := 'accepted'; denial_reason := null;
  current_actor_can_read := true; request_party_audience_only := true;
  evaluated_at := clock_timestamp(); return next;
end;
$$;

revoke all on function communications.resolve_private_message_request_audience_v1(
  uuid,uuid,uuid,uuid,bigint,uuid,bigint
) from public,anon,authenticated,service_role;

comment on function communications.resolve_private_message_request_audience_v1(
  uuid,uuid,uuid,uuid,bigint,uuid,bigint
) is
  'Private CE gate: current message read authority plus exact canonical SERVICE beneficiary/provider audience. Returns status only; no body, participant, membership, conversation, unit, or party identity.';

commit;
