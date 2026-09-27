begin;

-- Private conversations are deliberately separate from broadcast channels. A member's
-- presence in a tenant or public channel must never imply access to a private thread.
create table communications.private_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  unit_id uuid not null references portfolio.units(id) on delete restrict,
  created_by uuid not null references identity.memberships(id) on delete restrict,
  client_request_id uuid not null,
  created_at timestamptz not null default statement_timestamp()
);
create unique index private_conversations_retry_idx on communications.private_conversations(created_by,client_request_id);
create table communications.private_participants (
  conversation_id uuid not null references communications.private_conversations(id) on delete restrict,
  membership_id uuid not null references identity.memberships(id) on delete restrict,
  joined_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  primary key (conversation_id, membership_id)
);
create table communications.private_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references communications.private_conversations(id) on delete restrict,
  sender_id uuid not null references identity.memberships(id) on delete restrict,
  client_request_id uuid not null,
  body text not null check (length(trim(body)) between 1 and 5000),
  sent_at timestamptz not null default statement_timestamp(),
  unique (conversation_id, sender_id, client_request_id)
);
create index private_conversations_tenant_unit_idx on communications.private_conversations(tenant_id, unit_id);
create index private_conversations_unit_idx on communications.private_conversations(unit_id);
create index private_participants_membership_idx on communications.private_participants(membership_id, conversation_id);
create index private_messages_history_idx on communications.private_messages(conversation_id, sent_at, id);
create index private_messages_sender_idx on communications.private_messages(sender_id);

alter table communications.private_conversations enable row level security;
alter table communications.private_participants enable row level security;
alter table communications.private_messages enable row level security;
-- No direct Data API grants: all reads/writes go through the checked RPCs below.
grant all on communications.private_conversations, communications.private_participants,
  communications.private_messages to service_role;

create function communications.member_covers_unit(p_membership uuid, p_tenant uuid, p_unit uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $$
  select exists (
    select 1 from identity.memberships m
    join identity.context_grants g on g.membership_id=m.id and g.tenant_id=m.tenant_id
    join identity.roles r on r.id=m.role_id
    join portfolio.units u on u.id=p_unit and u.tenant_id=m.tenant_id and u.status='active'
    join portfolio.buildings b on b.id=u.building_id and b.tenant_id=m.tenant_id
    where m.id=p_membership and m.tenant_id=p_tenant and m.status='active'
      and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and lower(r.code) in ('association_admin','property_manager','president','owner','tenant_resident')
      and exists (select 1 from identity.role_permissions rp join identity.permissions perm on perm.id=rp.permission_id
        where rp.role_id=m.role_id and rp.effect='allow' and perm.code='communications.feed.read')
      and (lower(r.code) not in ('owner','tenant_resident') or
        (g.scope_type='unit' and g.unit_id=p_unit and exists (
          select 1 from identity.membership_parties mp where mp.membership_id=m.id and mp.tenant_id=m.tenant_id
            and ((lower(r.code)='owner' and exists (
              select 1 from portfolio.ownerships o where o.tenant_id=m.tenant_id and o.unit_id=p_unit
                and o.party_id=mp.party_id and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>current_date)))
              or (lower(r.code)='tenant_resident' and exists (
                select 1 from occupancy.leases l where l.tenant_id=m.tenant_id and l.unit_id=p_unit
                  and l.tenant_party_id=mp.party_id and l.status='active' and l.starts_on<=current_date
                  and (l.ends_on is null or l.ends_on>current_date)))))))
      -- Tenant-wide grants are intentionally excluded from private discovery.
      and ((g.scope_type='property' and g.property_id=b.property_id)
        or (g.scope_type='building' and g.building_id=b.id)
        or (g.scope_type='unit' and g.unit_id=u.id))
  );
$$;
revoke all on function communications.member_covers_unit(uuid,uuid,uuid) from public, anon, authenticated;

create function communications.context_membership(p_context_id uuid)
returns uuid language sql stable security definer set search_path=pg_catalog
as $$
  select m.id from identity.context_grants g join identity.memberships m
    on m.id=g.membership_id and m.tenant_id=g.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
$$;
revoke all on function communications.context_membership(uuid) from public, anon, authenticated;

create function communications.context_covers_unit(p_context_id uuid, p_unit uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $$
  select exists(select 1 from identity.context_grants g
    join portfolio.units u on u.id=p_unit and u.tenant_id=g.tenant_id
    join portfolio.buildings b on b.id=u.building_id
    where g.id=p_context_id and g.membership_id=communications.context_membership(p_context_id)
      and ((g.scope_type='unit' and g.unit_id=u.id)
        or (g.scope_type='building' and g.building_id=b.id)
        or (g.scope_type='property' and g.property_id=b.property_id)))
$$;
revoke all on function communications.context_covers_unit(uuid,uuid) from public, anon, authenticated;

create function communications.can_read_private(p_conversation uuid, p_membership uuid)
returns boolean language sql stable security definer set search_path=pg_catalog
as $$
  select exists (
    select 1 from communications.private_conversations c
    join communications.private_participants p on p.conversation_id=c.id
    join identity.memberships m on m.id=p.membership_id and m.tenant_id=c.tenant_id
    where c.id=p_conversation and p.membership_id=p_membership and p.revoked_at is null
      and m.user_id=auth.uid()
      and coalesce(auth.jwt()->>'aal','aal1')='aal2'
      and exists(select 1 from platform.customer_workspaces w join platform.workspace_entitlements e
        on e.customer_workspace_id=w.id where w.tenant_id=c.tenant_id and w.lifecycle_status='ACTIVE'
          and e.entitlement_key='module.communications' and e.valid_from<=statement_timestamp()
          and (e.valid_until is null or e.valid_until>statement_timestamp())
          and (case when e.override_value_json is not null and e.override_expires_at>statement_timestamp()
            then e.override_value_json='true'::jsonb else e.boolean_value is true end))
      and communications.member_covers_unit(m.id,c.tenant_id,c.unit_id)
  );
$$;
revoke all on function communications.can_read_private(uuid,uuid) from public, anon, authenticated;

create function customer_api.create_private_conversation_v1(
  p_context_id uuid, p_unit_id uuid, p_recipient_membership_id uuid, p_body text, p_request_id uuid
) returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare v_actor uuid := communications.context_membership(p_context_id);
  v_tenant uuid; v_thread uuid; v_message uuid;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
      or v_actor is null or p_recipient_membership_id is null
      or p_recipient_membership_id=v_actor or p_request_id is null
      or length(trim(coalesce(p_body,''))) not between 1 and 5000 then
    raise exception 'private_conversation_denied' using errcode='42501';
  end if;
  select tenant_id into v_tenant from identity.memberships where id=v_actor;
  if not communications.member_covers_unit(v_actor,v_tenant,p_unit_id)
     or not communications.member_covers_unit(p_recipient_membership_id,v_tenant,p_unit_id)
     or not exists(select 1 from platform.customer_workspaces w join platform.workspace_entitlements e
       on e.customer_workspace_id=w.id where w.tenant_id=v_tenant and w.lifecycle_status='ACTIVE'
         and e.entitlement_key='module.communications' and e.valid_from<=statement_timestamp()
         and (e.valid_until is null or e.valid_until>statement_timestamp())
         and (case when e.override_value_json is not null and e.override_expires_at>statement_timestamp()
           then e.override_value_json='true'::jsonb else e.boolean_value is true end))
     or not communications.context_covers_unit(p_context_id,p_unit_id)
     then raise exception 'private_conversation_denied' using errcode='42501'; end if;
  -- Both identities must be active in the same tenant and have a current,
  -- explicit property/building/unit grant. Raw vendor rows cannot participate.
  insert into communications.private_conversations(tenant_id,unit_id,created_by,client_request_id)
    values(v_tenant,p_unit_id,v_actor,p_request_id)
    on conflict (created_by,client_request_id) do nothing returning id into v_thread;
  if v_thread is null then
    select c.id into v_thread from communications.private_conversations c
    where c.created_by=v_actor and c.client_request_id=p_request_id and c.unit_id=p_unit_id
      and exists(select 1 from communications.private_participants p
        where p.conversation_id=c.id and p.membership_id=p_recipient_membership_id and p.revoked_at is null);
    if v_thread is null then raise exception 'private_conversation_request_conflict' using errcode='23505'; end if;
    select id into v_message from communications.private_messages
      where conversation_id=v_thread and sender_id=v_actor and client_request_id=p_request_id;
    return jsonb_build_object('conversation_id',v_thread,'message_id',v_message,'replayed',true);
  end if;
  insert into communications.private_participants(conversation_id,membership_id)
    values(v_thread,v_actor),(v_thread,p_recipient_membership_id);
  insert into communications.private_messages(conversation_id,sender_id,client_request_id,body)
    values(v_thread,v_actor,p_request_id,trim(p_body)) returning id into v_message;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot)
    values(v_tenant,auth.uid(),'private_conversation.create','communications.private_conversation',v_thread,
      jsonb_build_object('unit_id',p_unit_id,'recipient_membership_id',p_recipient_membership_id,'message_id',v_message));
  insert into communications.notifications(tenant_id,membership_id,type,title,action_url,payload)
    values(v_tenant,p_recipient_membership_id,'private_message','New private message','/app/communications',jsonb_build_object('conversation_id',v_thread));
  return jsonb_build_object('conversation_id',v_thread,'message_id',v_message);
end; $$;

create function customer_api.send_private_message_v1(p_context_id uuid, p_conversation_id uuid, p_body text, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $$
declare v_actor uuid := communications.context_membership(p_context_id); v_message uuid; v_tenant uuid;
begin
  if p_request_id is null or length(trim(coalesce(p_body,''))) not between 1 and 5000
    or not communications.can_read_private(p_conversation_id,v_actor)
    or not exists(select 1 from communications.private_conversations c where c.id=p_conversation_id
      and communications.context_covers_unit(p_context_id,c.unit_id)) then
    raise exception 'private_message_denied' using errcode='42501'; end if;
  select tenant_id into v_tenant from communications.private_conversations where id=p_conversation_id;
  insert into communications.private_messages(conversation_id,sender_id,client_request_id,body)
    values(p_conversation_id,v_actor,p_request_id,trim(p_body))
    on conflict (conversation_id,sender_id,client_request_id) do nothing returning id into v_message;
  if v_message is null then
    select id into v_message from communications.private_messages
    where conversation_id=p_conversation_id and sender_id=v_actor and client_request_id=p_request_id;
    return jsonb_build_object('message_id',v_message,'replayed',true);
  end if;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot)
    values(v_tenant,auth.uid(),'private_message.send','communications.private_message',v_message,
      jsonb_build_object('conversation_id',p_conversation_id));
  insert into communications.notifications(tenant_id,membership_id,type,title,action_url,payload)
    select v_tenant,p.membership_id,'private_message','New private message','/app/communications',
      jsonb_build_object('conversation_id',p_conversation_id,'message_id',v_message)
    from communications.private_participants p
    where p.conversation_id=p_conversation_id and p.membership_id<>v_actor and p.revoked_at is null
      and exists(select 1 from communications.private_conversations c where c.id=p.conversation_id
        and communications.member_covers_unit(p.membership_id,c.tenant_id,c.unit_id));
  return jsonb_build_object('message_id',v_message,'replayed',false);
end; $$;

create function customer_api.get_private_conversations_v1(p_context_id uuid, p_conversation_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare v_actor uuid := communications.context_membership(p_context_id); v_tenant uuid;
begin
  if auth.uid() is null or v_actor is null then raise exception 'private_conversation_denied' using errcode='42501'; end if;
  select tenant_id into v_tenant from identity.memberships where id=v_actor;
  if p_conversation_id is not null and not exists(select 1 from communications.private_conversations c
    where c.id=p_conversation_id and communications.can_read_private(c.id,v_actor)
      and communications.context_covers_unit(p_context_id,c.unit_id)) then
    raise exception 'private_conversation_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'unit_id',c.unit_id,
      'created_at',c.created_at,'participants',(select jsonb_agg(jsonb_build_object('membership_id',p.membership_id,'name',pr.display_name))
        from communications.private_participants p join identity.memberships m on m.id=p.membership_id
        join identity.profiles pr on pr.user_id=m.user_id where p.conversation_id=c.id and p.revoked_at is null
          and communications.member_covers_unit(p.membership_id,c.tenant_id,c.unit_id)),
      'messages',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'sender_id',x.sender_id,
        'body',x.body,'sent_at',x.sent_at) order by x.sent_at,x.id),'[]'::jsonb)
        from (select id,sender_id,body,sent_at from communications.private_messages
          where conversation_id=c.id order by sent_at desc,id desc limit 100) x)) order by c.created_at desc)
    from communications.private_conversations c where c.tenant_id=v_tenant
      and (p_conversation_id is null or c.id=p_conversation_id)
      and communications.can_read_private(c.id,v_actor)
      and communications.context_covers_unit(p_context_id,c.unit_id)), '[]'::jsonb);
end; $$;

revoke all on function customer_api.create_private_conversation_v1(uuid,uuid,uuid,text,uuid),
  customer_api.send_private_message_v1(uuid,uuid,text,uuid),
  customer_api.get_private_conversations_v1(uuid,uuid) from public, anon;
grant execute on function customer_api.create_private_conversation_v1(uuid,uuid,uuid,text,uuid),
  customer_api.send_private_message_v1(uuid,uuid,text,uuid),
  customer_api.get_private_conversations_v1(uuid,uuid) to authenticated;

commit;
