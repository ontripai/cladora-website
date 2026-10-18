begin;

select app_private.acquire_core_platform_role_safety_mutation_lock_v1();

-- S1 consumes the physical D5 Workspace binding directly. It performs no
-- unit/property-to-Workspace inference and treats historical NULL rows as
-- permanently ineligible for the canonical SERVICE subject-link path.
create function communications.resolve_private_message_currentness_v2(
  p_context_id uuid,
  p_workspace_id uuid,
  p_actor_id uuid,
  p_message_id uuid,
  p_expected_version bigint
)
returns table(
  decision text,
  denial_reason text,
  message_id uuid,
  message_version bigint,
  workspace_id uuid,
  lifecycle_state text,
  participant_current boolean,
  participant_revoked boolean
)
language plpgsql
stable
security definer
set search_path=pg_catalog
as $$
declare
  v_membership uuid;
  v_message communications.private_messages%rowtype;
  v_conversation communications.private_conversations%rowtype;
  v_participant communications.private_participants%rowtype;
begin
  if p_context_id is null or p_workspace_id is null or p_actor_id is null
      or p_message_id is null or p_expected_version is null
      or p_expected_version not between 1 and 9007199254740991
      or auth.uid() is null or auth.uid()<>p_actor_id then
    decision:='denied'; denial_reason:='SUBJECT_DENIED';
    return next; return;
  end if;

  v_membership:=communications.context_membership(p_context_id);
  if v_membership is null then
    decision:='denied'; denial_reason:='SUBJECT_DENIED';
    return next; return;
  end if;

  select m.* into v_message
  from communications.private_messages m
  where m.id=p_message_id;
  if not found then
    decision:='denied'; denial_reason:='SUBJECT_DENIED';
    return next; return;
  end if;
  if v_message.version<>p_expected_version then
    decision:='denied'; denial_reason:='STALE_SUBJECT';
    return next; return;
  end if;

  select c.* into v_conversation
  from communications.private_conversations c
  where c.id=v_message.conversation_id
    and c.workspace_id is not null
    and c.workspace_id=p_workspace_id;
  if not found then
    decision:='denied'; denial_reason:='SUBJECT_DENIED';
    return next; return;
  end if;

  select p.* into v_participant
  from communications.private_participants p
  where p.conversation_id=v_conversation.id and p.membership_id=v_membership;
  if not found then
    decision:='denied'; denial_reason:='SUBJECT_DENIED';
    return next; return;
  end if;

  if not exists(
      select 1 from platform.customer_workspaces w
      where w.id=v_conversation.workspace_id
        and w.tenant_id=v_conversation.tenant_id
        and w.archived_at is null and w.lifecycle_status='ACTIVE'
    ) or not exists(
      select 1 from platform.workspace_entitlements e
      where e.customer_workspace_id=v_conversation.workspace_id
        and e.entitlement_key='module.communications'
        and e.valid_from<=statement_timestamp()
        and (e.valid_until is null or e.valid_until>statement_timestamp())
        and (case when e.override_value_json is not null
                       and e.override_expires_at>statement_timestamp()
                  then e.override_value_json='true'::jsonb
                  else e.boolean_value is true end)
    ) or app_private.check_workspace_native_permission_v2(
      p_context_id,p_workspace_id,'communications.feed.read','communications'
    ) is not true then
    decision:='denied'; denial_reason:='SUBJECT_DENIED';
    return next; return;
  end if;

  if v_participant.revoked_at is not null
      or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
      or v_message.lifecycle_state<>'available' then
    decision:='denied'; denial_reason:='SUBJECT_DENIED';
    return next; return;
  end if;

  decision:='accepted'; denial_reason:=null;
  message_id:=v_message.id; message_version:=v_message.version;
  workspace_id:=v_conversation.workspace_id;
  lifecycle_state:=v_message.lifecycle_state;
  participant_current:=true; participant_revoked:=false;
  return next;
end;
$$;

-- The V2 audience entrypoint first enforces the physical D5 binding through
-- the new currentness resolver. The existing audience resolver remains an
-- ungranted implementation dependency until S2 installs its finalizer; no V1
-- routine becomes a runtime entrypoint.
create function communications.resolve_private_message_request_audience_current_v2(
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
set search_path=pg_catalog
as $$
declare
  v_current record;
  v_audience record;
begin
  select * into v_current
  from communications.resolve_private_message_currentness_v2(
    p_context_id,p_workspace_id,p_actor_id,p_message_id,p_expected_message_version
  );
  if v_current.decision is distinct from 'accepted' then
    decision:='denied';
    denial_reason:=case when v_current.denial_reason='STALE_SUBJECT'
      then 'STALE_SUBJECT' else 'AUDIENCE_DENIED' end;
    current_actor_can_read:=null; request_party_audience_only:=null;
    evaluated_at:=clock_timestamp(); return next; return;
  end if;

  select * into v_audience
  from communications.resolve_private_message_request_audience_v1(
    p_context_id,p_workspace_id,p_actor_id,p_message_id,p_expected_message_version,
    p_request_id,p_expected_request_version
  );
  if not found then
    decision:='denied'; denial_reason:='AUDIENCE_DENIED';
    current_actor_can_read:=null; request_party_audience_only:=null;
    evaluated_at:=clock_timestamp(); return next; return;
  end if;

  decision:=v_audience.decision;
  denial_reason:=v_audience.denial_reason;
  current_actor_can_read:=v_audience.current_actor_can_read;
  request_party_audience_only:=v_audience.request_party_audience_only;
  evaluated_at:=v_audience.evaluated_at;
  return next;
end;
$$;

alter function communications.resolve_private_message_currentness_v2(
  uuid,uuid,uuid,uuid,bigint) owner to postgres;
alter function communications.resolve_private_message_request_audience_current_v2(
  uuid,uuid,uuid,uuid,bigint,uuid,bigint) owner to postgres;

revoke all on function
  communications.resolve_private_message_currentness_v2(uuid,uuid,uuid,uuid,bigint),
  communications.resolve_private_message_request_audience_current_v2(
    uuid,uuid,uuid,uuid,bigint,uuid,bigint)
from public,anon,authenticated,service_role,cladora_rpc_owner,
  cladora_ce_guide_runtime,cladora_ce_guide_executor;

comment on function communications.resolve_private_message_currentness_v2(
  uuid,uuid,uuid,uuid,bigint) is
  'S1 metadata-only currentness resolver bound directly to the physical conversation Workspace.';
comment on function communications.resolve_private_message_request_audience_current_v2(
  uuid,uuid,uuid,uuid,bigint,uuid,bigint) is
  'S1 metadata-only SERVICE Request audience resolver gated by physical conversation Workspace currentness.';

commit;
