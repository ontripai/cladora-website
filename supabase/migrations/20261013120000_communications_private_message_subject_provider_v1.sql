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
  if tg_op = 'DELETE' then
    raise exception 'private_message_physical_delete_forbidden' using errcode = '42501';
  end if;

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
before insert or update or delete on communications.private_messages
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
set search_path = pg_catalog
as $$
declare
  v_membership uuid;
  v_message communications.private_messages%rowtype;
  v_conversation communications.private_conversations%rowtype;
  v_participant communications.private_participants%rowtype;
  v_property_id uuid;
  v_building_id uuid;
  v_binding_count integer;
  v_bound_workspace uuid;
  v_core_workspace_context boolean := false;
  v_permission_id uuid;
  v_permission_count integer;
  v_module_id uuid;
  v_module_count integer;
  v_scoped_allow boolean := false;
  v_scoped_deny boolean := false;
  v_current boolean;
begin
  if p_context_id is null or p_workspace_id is null or p_actor_id is null
      or p_message_id is null or p_expected_version is null
      or p_expected_version not between 1 and 9007199254740991 then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    return next; return;
  end if;
  if auth.uid() is null or auth.uid() <> p_actor_id then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    return next; return;
  end if;

  v_membership := communications.context_membership(p_context_id);
  if v_membership is null then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    return next; return;
  end if;

  select m.* into v_message
  from communications.private_messages m
  where m.id=p_message_id;
  if not found then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    return next; return;
  end if;
  select c.* into v_conversation
  from communications.private_conversations c
  where c.id=v_message.conversation_id;
  if not found then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    return next; return;
  end if;

  select p.* into v_participant
  from communications.private_participants p
  where p.conversation_id=v_conversation.id and p.membership_id=v_membership;
  if not found then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    return next; return;
  end if;

  select b.property_id,u.building_id into v_property_id,v_building_id
  from portfolio.units u
  join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
  where u.id=v_conversation.unit_id and u.tenant_id=v_conversation.tenant_id;
  v_core_workspace_context := app_private.native_workspace_scope_for_membership_v2(
    p_context_id,v_membership,p_workspace_id
  );
  if v_property_id is null or v_building_id is null
      or not v_core_workspace_context then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    return next; return;
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
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    return next; return;
  end if;

  select count(*),min(p.id::text)::uuid into v_permission_count,v_permission_id
  from identity.permissions p
  where p.code='communications.feed.read';
  select count(*),min(d.id::text)::uuid into v_module_count,v_module_id
  from platform.module_definitions d
  where d.code='communications' and d.is_active
    and d.lifecycle_status in ('active','published')
    and d.valid_from<=statement_timestamp()
    and (d.valid_to is null or d.valid_to>statement_timestamp());
  if v_permission_count<>1 or v_module_count<>1
      or app_private.check_workspace_native_permission_v2(
        p_context_id,p_workspace_id,'communications.feed.read','communications'
      ) is not true then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    return next; return;
  end if;

  select exists(
    select 1
    from platform.workspace_member_roles a
    join platform.workspace_roles r on r.id=a.workspace_role_id
      and r.tenant_id=a.tenant_id
      and r.customer_workspace_id=a.customer_workspace_id
    join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id
      and rp.permission_id=v_permission_id and rp.effect='deny'
    join platform.workspace_role_modules rm on rm.workspace_role_id=r.id
      and rm.module_definition_id=v_module_id
    where a.membership_id=v_membership
      and a.tenant_id=v_conversation.tenant_id
      and a.customer_workspace_id=p_workspace_id
      and a.valid_from<=statement_timestamp()
      and (a.valid_to is null or a.valid_to>statement_timestamp())
      and r.lifecycle_status='published'
      and r.valid_from<=statement_timestamp()
      and (r.valid_to is null or r.valid_to>statement_timestamp())
      and app_private.workspace_role_scope_contains_v1(
        a.scope_type,a.property_id,a.building_id,a.unit_id,
        'unit',v_property_id,v_building_id,v_conversation.unit_id
      )
  ) into v_scoped_deny;
  select exists(
    select 1
    from platform.workspace_member_roles a
    join platform.workspace_roles r on r.id=a.workspace_role_id
      and r.tenant_id=a.tenant_id
      and r.customer_workspace_id=a.customer_workspace_id
    join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id
      and rp.permission_id=v_permission_id and rp.effect='allow'
    join platform.workspace_role_modules rm on rm.workspace_role_id=r.id
      and rm.module_definition_id=v_module_id
    where a.membership_id=v_membership
      and a.tenant_id=v_conversation.tenant_id
      and a.customer_workspace_id=p_workspace_id
      and a.valid_from<=statement_timestamp()
      and (a.valid_to is null or a.valid_to>statement_timestamp())
      and r.lifecycle_status='published'
      and r.valid_from<=statement_timestamp()
      and (r.valid_to is null or r.valid_to>statement_timestamp())
      and app_private.workspace_member_role_authority_active_v1(
        a.id,v_permission_id,v_module_id,'unit',v_conversation.unit_id
      )
  ) into v_scoped_allow;
  if v_scoped_deny or not v_scoped_allow then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    return next; return;
  end if;

  if v_message.version <> p_expected_version then
    decision := 'denied'; denial_reason := 'STALE_SUBJECT';
    return next; return;
  end if;

  v_current := v_participant.revoked_at is null
    and coalesce(auth.jwt()->>'aal','aal1')='aal2';

  if not v_current or v_participant.revoked_at is not null
      or v_message.lifecycle_state <> 'available' then
    decision := 'denied'; denial_reason := 'SUBJECT_DENIED';
    return next; return;
  end if;

  decision := 'accepted';
  denial_reason := null;
  message_id := v_message.id;
  message_version := v_message.version;
  workspace_id := p_workspace_id;
  lifecycle_state := v_message.lifecycle_state;
  participant_current := true;
  participant_revoked := false;
  return next;
end;
$$;

revoke all on function communications.resolve_private_message_subject_v1(
  uuid,uuid,uuid,uuid,bigint
) from public,anon,authenticated,service_role;

comment on function communications.resolve_private_message_subject_v1(
  uuid,uuid,uuid,uuid,bigint
) is
  'Transaction-scoped, metadata-only private-message resolver. Expected denials are bounded rows, not SQL exceptions. Returns no body, sender, conversation, unit, or other participant identity.';

commit;
