begin;

create table platform.internal_threads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  created_by uuid not null references platform.platform_users(id) on delete restrict,
  client_request_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  unique(created_by,client_request_id)
);
create index internal_threads_workspace_idx on platform.internal_threads(workspace_id);
create table platform.internal_participants (
  thread_id uuid not null references platform.internal_threads(id) on delete restrict,
  platform_user_id uuid not null references platform.platform_users(id) on delete restrict,
  last_read_at timestamptz,
  primary key(thread_id,platform_user_id)
);
create index internal_participants_user_idx on platform.internal_participants(platform_user_id,thread_id);
create table platform.internal_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references platform.internal_threads(id) on delete restrict,
  sender_id uuid not null references platform.platform_users(id) on delete restrict,
  body text not null check(length(trim(body)) between 1 and 5000),
  client_request_id uuid not null,
  sent_at timestamptz not null default statement_timestamp(),
  unique(thread_id,sender_id,client_request_id)
);
create index internal_messages_thread_idx on platform.internal_messages(thread_id,sent_at,id);
create index internal_messages_sender_idx on platform.internal_messages(sender_id);
create table platform.internal_notifications (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references platform.internal_threads(id) on delete restrict,
  message_id uuid not null references platform.internal_messages(id) on delete restrict,
  recipient_id uuid not null references platform.platform_users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  read_at timestamptz,
  unique(message_id,recipient_id)
);
create index internal_notifications_thread_idx on platform.internal_notifications(thread_id);
create index internal_notifications_recipient_idx on platform.internal_notifications(recipient_id,read_at);
alter table platform.internal_threads enable row level security;
alter table platform.internal_participants enable row level security;
alter table platform.internal_messages enable row level security;
alter table platform.internal_notifications enable row level security;
grant all on platform.internal_threads,platform.internal_participants,platform.internal_messages,platform.internal_notifications to service_role;

create function platform.internal_staff(p_user uuid,p_workspace uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from platform.platform_users pu
    join platform.platform_role_assignments ra on ra.platform_user_id=pu.id
      and ra.role in ('PLATFORM_SUPER_ADMIN','PLATFORM_OPERATIONS','PLATFORM_SUPPORT')
      and ra.status='active' and ra.revoked_at is null and ra.valid_from<=statement_timestamp()
      and (ra.valid_until is null or ra.valid_until>statement_timestamp())
    join platform.platform_customer_assignments a on a.platform_user_id=pu.id and a.customer_workspace_id=p_workspace
      and a.status='active' and a.revoked_at is null and a.valid_from<=statement_timestamp()
      and (a.valid_until is null or a.valid_until>statement_timestamp())
    join platform.customer_workspaces w on w.id=a.customer_workspace_id and w.lifecycle_status='ACTIVE'
    where pu.id=p_user and pu.status='active' and pu.deactivated_at is null);
$$;
revoke all on function platform.internal_staff(uuid,uuid) from public,anon,authenticated;

create function platform.can_read_internal(p_thread uuid,p_user uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select coalesce(auth.jwt()->>'aal','aal1')='aal2' and exists (
    select 1 from platform.internal_threads t
    join platform.internal_participants p on p.thread_id=t.id and p.platform_user_id=p_user
    join platform.platform_users pu on pu.id=p_user and pu.auth_user_id=auth.uid()
    where t.id=p_thread and platform.internal_staff(p_user,t.workspace_id)
      and not exists(select 1 from platform.internal_participants other
        where other.thread_id=t.id and not platform.internal_staff(other.platform_user_id,t.workspace_id)));
$$;
revoke all on function platform.can_read_internal(uuid,uuid) from public,anon,authenticated;

create function customer_api.list_internal_workspaces_v1()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id();
begin
  if v_user is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'internal_access_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'name',w.commercial_owner) order by w.commercial_owner,w.id)
    from platform.customer_workspaces w where platform.internal_staff(v_user,w.id)),'[]'::jsonb);
end; $$;

create function customer_api.list_internal_recipients_v1(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id();
begin
  if v_user is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or not platform.internal_staff(v_user,p_workspace_id) then
    raise exception 'internal_access_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.display_name) order by u.display_name,u.id)
    from platform.platform_users u where u.id<>v_user and platform.internal_staff(u.id,p_workspace_id)),'[]'::jsonb);
end; $$;

create function customer_api.create_internal_conversation_v1(p_workspace_id uuid,p_recipient_id uuid,p_body text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id(); v_thread uuid; v_message uuid; v_tenant uuid;
begin
  if v_user is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' or p_request_id is null
    or length(trim(coalesce(p_body,''))) not between 1 and 5000 or p_recipient_id=v_user
    or not platform.internal_staff(v_user,p_workspace_id) or not platform.internal_staff(p_recipient_id,p_workspace_id)
    then raise exception 'internal_access_denied' using errcode='42501'; end if;
  select tenant_id into v_tenant from platform.customer_workspaces where id=p_workspace_id;
  insert into platform.internal_threads(workspace_id,created_by,client_request_id)
    values(p_workspace_id,v_user,p_request_id)
    on conflict(created_by,client_request_id) do nothing returning id into v_thread;
  if v_thread is null then
    select t.id into v_thread from platform.internal_threads t
      join platform.internal_participants p on p.thread_id=t.id and p.platform_user_id=p_recipient_id
      where t.created_by=v_user and t.client_request_id=p_request_id and t.workspace_id=p_workspace_id;
    if v_thread is null then raise exception 'internal_retry_conflict' using errcode='23505'; end if;
    select id into v_message from platform.internal_messages where thread_id=v_thread and sender_id=v_user and client_request_id=p_request_id;
    return jsonb_build_object('thread_id',v_thread,'message_id',v_message,'replayed',true);
  end if;
  insert into platform.internal_participants(thread_id,platform_user_id) values(v_thread,v_user),(v_thread,p_recipient_id);
  insert into platform.internal_messages(thread_id,sender_id,body,client_request_id)
    values(v_thread,v_user,trim(p_body),p_request_id) returning id into v_message;
  insert into platform.internal_notifications(thread_id,message_id,recipient_id) values(v_thread,v_message,p_recipient_id);
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot)
    values(v_tenant,auth.uid(),'internal_conversation.create','platform.internal_thread',v_thread,
      jsonb_build_object('workspace_id',p_workspace_id,'recipient_id',p_recipient_id));
  return jsonb_build_object('thread_id',v_thread,'message_id',v_message,'replayed',false);
end; $$;

create function customer_api.send_internal_message_v1(p_thread_id uuid,p_body text,p_request_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id(); v_message uuid; v_tenant uuid;
begin
  if p_request_id is null or length(trim(coalesce(p_body,''))) not between 1 and 5000
    or not platform.can_read_internal(p_thread_id,v_user) then
    raise exception 'internal_access_denied' using errcode='42501'; end if;
  select w.tenant_id into v_tenant from platform.internal_threads t
    join platform.customer_workspaces w on w.id=t.workspace_id where t.id=p_thread_id;
  insert into platform.internal_messages(thread_id,sender_id,body,client_request_id)
    values(p_thread_id,v_user,trim(p_body),p_request_id)
    on conflict(thread_id,sender_id,client_request_id) do nothing returning id into v_message;
  if v_message is null then
    select id into v_message from platform.internal_messages
      where thread_id=p_thread_id and sender_id=v_user and client_request_id=p_request_id;
    return jsonb_build_object('message_id',v_message,'replayed',true); end if;
  insert into platform.internal_notifications(thread_id,message_id,recipient_id)
    select p_thread_id,v_message,p.platform_user_id from platform.internal_participants p
      where p.thread_id=p_thread_id and p.platform_user_id<>v_user;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot)
    values(v_tenant,auth.uid(),'internal_message.send','platform.internal_message',v_message,
      jsonb_build_object('thread_id',p_thread_id));
  return jsonb_build_object('message_id',v_message,'replayed',false);
end; $$;

create function customer_api.get_internal_conversations_v1(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id();
begin
  if v_user is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or not platform.internal_staff(v_user,p_workspace_id) then
    raise exception 'internal_access_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',t.id,
      'participants',(select jsonb_agg(jsonb_build_object('id',p.platform_user_id,'name',pu.display_name))
        from platform.internal_participants p join platform.platform_users pu on pu.id=p.platform_user_id where p.thread_id=t.id),
      'unread',(select count(*) from platform.internal_messages m
        where m.thread_id=t.id and m.sender_id<>v_user and (me.last_read_at is null or m.sent_at>me.last_read_at)),
      'messages',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'body',x.body,'sender_id',x.sender_id,'sent_at',x.sent_at)
        order by x.sent_at,x.id),'[]'::jsonb) from (select id,body,sender_id,sent_at from platform.internal_messages
          where thread_id=t.id order by sent_at desc,id desc limit 100) x)) order by t.created_at desc,t.id)
    from platform.internal_threads t join platform.internal_participants me on me.thread_id=t.id and me.platform_user_id=v_user
    where t.workspace_id=p_workspace_id and platform.can_read_internal(t.id,v_user)),'[]'::jsonb);
end; $$;

create function customer_api.mark_internal_read_v1(p_thread_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_user uuid := app_private.current_platform_user_id();
begin
  if not platform.can_read_internal(p_thread_id,v_user) then
    raise exception 'internal_access_denied' using errcode='42501'; end if;
  update platform.internal_participants set last_read_at=clock_timestamp()
    where thread_id=p_thread_id and platform_user_id=v_user;
  update platform.internal_notifications set read_at=clock_timestamp()
    where thread_id=p_thread_id and recipient_id=v_user and read_at is null;
  return jsonb_build_object('thread_id',p_thread_id);
end; $$;

revoke all on function customer_api.list_internal_workspaces_v1(),
  customer_api.list_internal_recipients_v1(uuid),customer_api.create_internal_conversation_v1(uuid,uuid,text,uuid),
  customer_api.send_internal_message_v1(uuid,text,uuid),customer_api.get_internal_conversations_v1(uuid),
  customer_api.mark_internal_read_v1(uuid) from public,anon;
grant execute on function customer_api.list_internal_workspaces_v1(),
  customer_api.list_internal_recipients_v1(uuid),customer_api.create_internal_conversation_v1(uuid,uuid,text,uuid),
  customer_api.send_internal_message_v1(uuid,text,uuid),customer_api.get_internal_conversations_v1(uuid),
  customer_api.mark_internal_read_v1(uuid) to authenticated;

commit;
