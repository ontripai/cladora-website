begin;

-- Canonical version and lifecycle remain on the existing Communications row.
-- This migration does not introduce a second message store, authority source,
-- receipt ledger, or runtime activation.
alter table communications.private_messages
  add column version bigint not null default 1
    check (version between 1 and 9007199254740991),
  add column lifecycle_state text not null default 'available'
    check (lifecycle_state in ('available','quarantined','deleted'));

create or replace function communications.enforce_private_message_version_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if new.version <> 1 or new.lifecycle_state <> 'available' then
      raise exception 'private_message_initial_version_invalid' using errcode = '23514';
    end if;
    return new;
  end if;

  if (new.id,new.conversation_id,new.sender_id,new.client_request_id,new.sent_at)
      is distinct from
     (old.id,old.conversation_id,old.sender_id,old.client_request_id,old.sent_at) then
    raise exception 'private_message_identity_immutable' using errcode = '23514';
  end if;

  if new.body is distinct from old.body
      or new.lifecycle_state is distinct from old.lifecycle_state then
    if new.version <> old.version + 1 then
      raise exception 'private_message_version_increment_required' using errcode = '23514';
    end if;
  elsif new.version <> old.version then
    raise exception 'private_message_version_change_requires_revision' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function communications.enforce_private_message_version_v1()
  from public,anon,authenticated,service_role;

create trigger private_message_version_guard
before insert or update on communications.private_messages
for each row execute function communications.enforce_private_message_version_v1();

-- Trusted transaction-scoped resolver. The caller supplies the actor identity
-- already bound by Core authority; auth.uid() must still match. The message's
-- unit is resolved through the one current canonical Workspace/property
-- binding. Ambiguous bindings fail closed.
create or replace function communications.resolve_private_message_subject_v1(
  p_context_id uuid,
  p_workspace_id uuid,
  p_actor_id uuid,
  p_message_id uuid,
  p_expected_version bigint
)
returns table(
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
set search_path = pg_catalog
as $$
declare
  v_membership uuid;
  v_message communications.private_messages%rowtype;
  v_conversation communications.private_conversations%rowtype;
  v_participant communications.private_participants%rowtype;
  v_property_id uuid;
  v_binding_count integer;
  v_bound_workspace uuid;
  v_current boolean;
begin
  if p_context_id is null or p_workspace_id is null or p_actor_id is null
      or p_message_id is null or p_expected_version is null
      or p_expected_version not between 1 and 9007199254740991 then
    raise exception 'private_message_subject_invalid' using errcode = '22023';
  end if;
  if auth.uid() is null or auth.uid() <> p_actor_id then
    raise exception 'private_message_subject_denied' using errcode = '42501';
  end if;

  v_membership := communications.context_membership(p_context_id);
  if v_membership is null then
    raise exception 'private_message_subject_denied' using errcode = '42501';
  end if;

  select m.* into v_message
  from communications.private_messages m
  where m.id=p_message_id;
  if not found then
    raise exception 'private_message_subject_denied' using errcode = '42501';
  end if;
  select c.* into v_conversation
  from communications.private_conversations c
  where c.id=v_message.conversation_id;
  if not found then
    raise exception 'private_message_subject_denied' using errcode = '42501';
  end if;

  select p.* into v_participant
  from communications.private_participants p
  where p.conversation_id=v_conversation.id and p.membership_id=v_membership;
  if not found then
    raise exception 'private_message_subject_denied' using errcode = '42501';
  end if;

  select b.property_id into v_property_id
  from portfolio.units u
  join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
  where u.id=v_conversation.unit_id and u.tenant_id=v_conversation.tenant_id;
  if v_property_id is null
      or not communications.context_covers_unit(p_context_id,v_conversation.unit_id) then
    raise exception 'private_message_subject_denied' using errcode = '42501';
  end if;

  select count(*),min(b.customer_workspace_id::text)::uuid
    into v_binding_count,v_bound_workspace
  from platform.workspace_property_bindings b
  where b.tenant_id=v_conversation.tenant_id and b.property_id=v_property_id
    and b.status='active' and b.valid_from<=statement_timestamp()
    and (b.valid_to is null or b.valid_to>statement_timestamp());
  if v_binding_count <> 1 or v_bound_workspace <> p_workspace_id
      or not exists(
        select 1 from platform.customer_workspaces w
        where w.id=p_workspace_id and w.tenant_id=v_conversation.tenant_id
          and w.archived_at is null and w.lifecycle_status='ACTIVE'
      )
      or not exists(
        select 1 from platform.workspace_entitlements e
        where e.customer_workspace_id=p_workspace_id
          and e.entitlement_key='module.communications'
          and e.valid_from<=statement_timestamp()
          and (e.valid_until is null or e.valid_until>statement_timestamp())
          and (case when e.override_value_json is not null
                         and e.override_expires_at>statement_timestamp()
                    then e.override_value_json='true'::jsonb
                    else e.boolean_value is true end)
      ) then
    raise exception 'private_message_subject_denied' using errcode = '42501';
  end if;

  if v_message.version <> p_expected_version then
    raise exception 'private_message_version_conflict' using errcode = '40001';
  end if;

  v_current := v_participant.revoked_at is null
    and communications.can_read_private(v_conversation.id,v_membership)
    and communications.member_covers_unit(
      v_membership,v_conversation.tenant_id,v_conversation.unit_id
    );

  return query select
    v_message.id,
    v_message.version,
    p_workspace_id,
    v_message.lifecycle_state,
    v_current,
    v_participant.revoked_at is not null;
end;
$$;

revoke all on function communications.resolve_private_message_subject_v1(
  uuid,uuid,uuid,uuid,bigint
) from public,anon,authenticated;
grant usage on schema communications to service_role;
grant execute on function communications.resolve_private_message_subject_v1(
  uuid,uuid,uuid,uuid,bigint
) to service_role;

comment on function communications.resolve_private_message_subject_v1(
  uuid,uuid,uuid,uuid,bigint
) is
  'Transaction-scoped, metadata-only private-message resolver. Returns no body, sender, conversation, unit, or other participant identity.';

commit;
