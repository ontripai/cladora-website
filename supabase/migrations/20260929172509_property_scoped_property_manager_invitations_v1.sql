begin;

create table communications.property_manager_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id),
  workspace_id uuid not null references platform.customer_workspaces(id),
  property_id uuid not null references portfolio.properties(id),
  normalized_email text not null check (normalized_email=lower(trim(normalized_email))),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id),
  inviter_membership_id uuid not null references identity.memberships(id),
  inviter_context_id uuid not null references identity.context_grants(id),
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default (statement_timestamp()+interval '72 hours'),
  accepted_by uuid references auth.users(id),
  accepted_membership_id uuid references identity.memberships(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (expires_at>created_at),
  check ((status='accepted' and accepted_by is not null and accepted_membership_id is not null and accepted_at is not null)
    or (status<>'accepted' and accepted_by is null and accepted_membership_id is null and accepted_at is null))
);
create unique index property_manager_invitation_pending_unique
  on communications.property_manager_invitations(workspace_id,property_id,normalized_email) where status='pending';
create index property_manager_invitation_email_idx
  on communications.property_manager_invitations(normalized_email,status,expires_at);
create index property_manager_invitation_tenant_idx
  on communications.property_manager_invitations(tenant_id);
create index property_manager_invitation_property_idx
  on communications.property_manager_invitations(property_id);
create index property_manager_invitation_invited_by_idx
  on communications.property_manager_invitations(invited_by);
create index property_manager_invitation_inviter_membership_idx
  on communications.property_manager_invitations(inviter_membership_id);
create index property_manager_invitation_inviter_context_idx
  on communications.property_manager_invitations(inviter_context_id);
create index property_manager_invitation_accepted_by_idx
  on communications.property_manager_invitations(accepted_by);
create index property_manager_invitation_accepted_membership_idx
  on communications.property_manager_invitations(accepted_membership_id);
alter table communications.property_manager_invitations enable row level security;
revoke all on communications.property_manager_invitations from public,anon,authenticated;
grant all on communications.property_manager_invitations to service_role;

create function communications.can_manage_property_manager_invites(p_actor uuid,p_context uuid,p_workspace uuid,p_property uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(
    select 1 from identity.context_grants g
    join identity.memberships m on m.id=g.membership_id and m.user_id=p_actor
      and m.tenant_id=g.tenant_id and m.status='active'
      and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    join identity.roles r on r.id=m.role_id
    join identity.role_permissions rp on rp.role_id=m.role_id and rp.effect='allow'
    join identity.permissions pm on pm.id=rp.permission_id and pm.code='workspace.role.assign'
    join platform.customer_workspaces w on w.id=p_workspace
      and w.tenant_id=g.tenant_id and w.lifecycle_status='ACTIVE'
    join platform.workspace_property_bindings b on b.customer_workspace_id=w.id and b.tenant_id=w.tenant_id
      and b.property_id=p_property and b.status='active' and b.valid_from<=statement_timestamp()
      and (b.valid_to is null or b.valid_to>statement_timestamp())
    join portfolio.properties p on p.id=b.property_id and p.tenant_id=b.tenant_id and p.status='active'
    where g.id=p_context and g.starts_at<=statement_timestamp()
      and (g.ends_at is null or g.ends_at>statement_timestamp())
      and coalesce(auth.jwt()->>'aal','aal1')='aal2'
      and lower(r.code) in ('association_admin','property_manager')
      and ((g.scope_type='tenant' and lower(r.code)='association_admin')
        or (g.scope_type='property' and g.property_id=p_property)
        or (g.scope_type='building' and exists(select 1 from portfolio.buildings x where x.id=g.building_id and x.property_id=p_property)))
  );
$$;
revoke all on function communications.can_manage_property_manager_invites(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create function customer_api.list_invitable_manager_properties_v1(p_context uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'property_manager_invitation_denied' using errcode='42501'; end if;
  select * into v from app_private.resolve_workspace_from_customer_context_v1(p_context,false);
  if v.workspace_id is null then raise exception 'workspace_binding_required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.name) order by p.name,p.id)
    from portfolio.properties p where communications.can_manage_property_manager_invites(auth.uid(),p_context,v.workspace_id,p.id)),'[]'::jsonb);
end $$;

create function customer_api.create_property_manager_invitation_v1(p_context uuid,p_property uuid,p_email text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=auth.uid(); v record; v_id uuid; v_email text:=lower(trim(coalesce(p_email,'')));
begin
  if v_actor is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email)>320 then
    raise exception 'property_manager_invitation_denied' using errcode='42501'; end if;
  select * into v from app_private.resolve_workspace_from_customer_context_v1(p_context,false);
  if v.workspace_id is null or not communications.can_manage_property_manager_invites(v_actor,p_context,v.workspace_id,p_property) then
    raise exception 'property_manager_invitation_denied' using errcode='42501'; end if;
  update communications.property_manager_invitations set status='expired'
    where workspace_id=v.workspace_id and property_id=p_property and normalized_email=v_email
      and status='pending' and expires_at<=statement_timestamp();
  perform pg_advisory_xact_lock(hashtextextended(
    'property_manager_invitation:'||v.workspace_id::text||':'||p_property::text||':'||v_email,0));
  select id into v_id from communications.property_manager_invitations
    where workspace_id=v.workspace_id and property_id=p_property and normalized_email=v_email and status='pending';
  if v_id is not null then return jsonb_build_object('id',v_id,'replayed',true,
    'known_account',exists(select 1 from auth.users where lower(email)=v_email and email_confirmed_at is not null)); end if;
  insert into communications.property_manager_invitations(tenant_id,workspace_id,property_id,normalized_email,
    invited_by,inviter_membership_id,inviter_context_id)
    values(v.tenant_id,v.workspace_id,p_property,v_email,v_actor,v.membership_id,p_context) returning id into v_id;
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
    values(v.tenant_id,v_actor,v.role_code,'property_manager_invitation.create',
      'communications.property_manager_invitation',v_id,'Property-scoped manager invitation',
      jsonb_build_object('workspace_id',v.workspace_id,'property_id',p_property,'email',v_email));
  return jsonb_build_object('id',v_id,'replayed',false,
    'known_account',exists(select 1 from auth.users where lower(email)=v_email and email_confirmed_at is not null));
end $$;

create function customer_api.list_managed_property_manager_invitations_v1(p_context uuid,p_property uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record;
begin
  select * into v from app_private.resolve_workspace_from_customer_context_v1(p_context,false);
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2' or v.workspace_id is null
    or not communications.can_manage_property_manager_invites(auth.uid(),p_context,v.workspace_id,p_property) then
    raise exception 'property_manager_invitation_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.normalized_email,'expires_at',i.expires_at) order by i.created_at desc)
    from communications.property_manager_invitations i where i.workspace_id=v.workspace_id and i.property_id=p_property
      and i.status='pending' and i.expires_at>statement_timestamp()),'[]'::jsonb);
end $$;

create function customer_api.revoke_property_manager_invitation_v1(p_context uuid,p_invitation uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare i communications.property_manager_invitations%rowtype;
begin
  select * into i from communications.property_manager_invitations where id=p_invitation for update;
  if i.id is null or i.status<>'pending' or i.invited_by<>auth.uid()
    or not communications.can_manage_property_manager_invites(auth.uid(),p_context,i.workspace_id,i.property_id) then
    raise exception 'property_manager_invitation_denied' using errcode='42501'; end if;
  update communications.property_manager_invitations set status='revoked',revoked_at=statement_timestamp() where id=i.id;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id)
    values(i.tenant_id,auth.uid(),'property_manager_invitation.revoke','communications.property_manager_invitation',i.id);
  return true;
end $$;

create function customer_api.list_my_property_manager_invitations_v1()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_email text;
begin
  select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if v_email is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'property',p.name,'workspace',w.id,'expires_at',i.expires_at) order by i.created_at desc)
    from communications.property_manager_invitations i join portfolio.properties p on p.id=i.property_id
    join platform.customer_workspaces w on w.id=i.workspace_id
    where i.normalized_email=v_email and i.status='pending' and i.expires_at>statement_timestamp()
      and w.lifecycle_status='ACTIVE'),'[]'::jsonb);
end $$;

create function customer_api.claim_property_manager_invitation_v1(p_invitation uuid,p_display_name text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid:=auth.uid(); v_email text; i communications.property_manager_invitations%rowtype;
  v_role uuid; v_membership identity.memberships%rowtype; v_context uuid; v_access_expires timestamptz;
begin
  select lower(email) into v_email from auth.users where id=v_actor and email_confirmed_at is not null;
  if v_actor is null or v_email is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or length(trim(coalesce(p_display_name,''))) not between 2 and 120 then
    raise exception 'property_manager_invitation_unavailable' using errcode='42501'; end if;
  select * into i from communications.property_manager_invitations where id=p_invitation for update;
  if i.id is null or i.normalized_email<>v_email
    or not communications.can_manage_property_manager_invites(i.invited_by,i.inviter_context_id,i.workspace_id,i.property_id)
    or not exists(select 1 from platform.workspace_property_bindings b join platform.customer_workspaces w
      on w.id=b.customer_workspace_id and w.tenant_id=b.tenant_id and w.lifecycle_status='ACTIVE'
      where b.customer_workspace_id=i.workspace_id and b.property_id=i.property_id and b.tenant_id=i.tenant_id
        and b.status='active' and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())) then
    raise exception 'property_manager_invitation_unavailable' using errcode='42501'; end if;
  if i.status='accepted' then
    if i.accepted_by<>v_actor then raise exception 'property_manager_invitation_unavailable' using errcode='42501'; end if;
    select id into v_context from identity.context_grants where membership_id=i.accepted_membership_id
      and tenant_id=i.tenant_id and scope_type='property' and property_id=i.property_id
      and starts_at<=statement_timestamp() and (ends_at is null or ends_at>statement_timestamp()) limit 1;
    return jsonb_build_object('membership_id',i.accepted_membership_id,'property_id',i.property_id,'context_id',v_context);
  end if;
  if i.status<>'pending' or i.expires_at<=statement_timestamp() then
    raise exception 'property_manager_invitation_unavailable' using errcode='42501'; end if;
  select id into v_role from identity.roles where tenant_id is null and code='property_manager' and is_system=true;
  if v_role is null then raise exception 'property_manager_role_unavailable' using errcode='55000'; end if;
  select least(m.ends_at,g.ends_at,b.valid_to) into v_access_expires
  from identity.memberships m
  join identity.context_grants g on g.id=i.inviter_context_id and g.membership_id=m.id
    and g.tenant_id=i.tenant_id and g.starts_at<=statement_timestamp()
    and (g.ends_at is null or g.ends_at>statement_timestamp())
  join platform.workspace_property_bindings b on b.customer_workspace_id=i.workspace_id
    and b.tenant_id=i.tenant_id and b.property_id=i.property_id and b.status='active'
    and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp())
  where m.id=i.inviter_membership_id and m.user_id=i.invited_by and m.tenant_id=i.tenant_id
    and m.status='active' and m.starts_at<=statement_timestamp()
    and (m.ends_at is null or m.ends_at>statement_timestamp());
  if not found then raise exception 'property_manager_invitation_unavailable' using errcode='42501'; end if;
  insert into identity.profiles(user_id,display_name) values(v_actor,trim(p_display_name)) on conflict(user_id) do nothing;
  perform pg_advisory_xact_lock(hashtextextended('property_manager_invitation:'||i.tenant_id::text||':'||v_actor::text,0));
  insert into identity.memberships(tenant_id,user_id,role_id,status,starts_at,ends_at)
    values(i.tenant_id,v_actor,v_role,'active',statement_timestamp(),v_access_expires)
    on conflict(tenant_id,user_id,role_id) where status in ('invited','active')
    do update set status='active',starts_at=least(identity.memberships.starts_at,excluded.starts_at),
      ends_at=case when identity.memberships.status='invited' then
        case when identity.memberships.ends_at is null then excluded.ends_at
          when excluded.ends_at is null then identity.memberships.ends_at
          else least(identity.memberships.ends_at,excluded.ends_at) end
      else identity.memberships.ends_at end,
      updated_at=statement_timestamp()
    returning * into v_membership;
  if v_membership.ends_at is not null and v_membership.ends_at<=statement_timestamp() then
    raise exception 'property_manager_invitation_unavailable' using errcode='42501';
  end if;
  v_access_expires:=least(v_access_expires,v_membership.ends_at);
  update identity.context_grants set ends_at=v_access_expires where membership_id=v_membership.id
    and tenant_id=i.tenant_id and scope_type='property' and property_id=i.property_id
    and building_id is null and unit_id is null
    and (ends_at is null or ends_at<=statement_timestamp() or ends_at>v_access_expires);
  if not found and not exists(select 1 from identity.context_grants g where g.membership_id=v_membership.id
    and g.tenant_id=i.tenant_id and g.scope_type='property' and g.property_id=i.property_id
    and g.building_id is null and g.unit_id is null and g.starts_at<=statement_timestamp()
    and (g.ends_at is null or g.ends_at>statement_timestamp())) then
    insert into identity.context_grants(membership_id,tenant_id,scope_type,property_id,starts_at,ends_at)
      values(v_membership.id,i.tenant_id,'property',i.property_id,statement_timestamp(),v_access_expires);
  end if;
  update communications.property_manager_invitations set status='accepted',accepted_by=v_actor,
    accepted_membership_id=v_membership.id,accepted_at=statement_timestamp() where id=i.id;
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot)
    values(i.tenant_id,v_actor,'property_manager','property_manager_invitation.accept',
      'communications.property_manager_invitation',i.id,jsonb_build_object('membership_id',v_membership.id,'property_id',i.property_id));
  select id into v_context from identity.context_grants where membership_id=v_membership.id and tenant_id=i.tenant_id
    and scope_type='property' and property_id=i.property_id and starts_at<=statement_timestamp()
    and (ends_at is null or ends_at>statement_timestamp()) limit 1;
  return jsonb_build_object('membership_id',v_membership.id,'property_id',i.property_id,'context_id',v_context);
end $$;

revoke all on function customer_api.list_invitable_manager_properties_v1(uuid),
 customer_api.create_property_manager_invitation_v1(uuid,uuid,text),
 customer_api.list_managed_property_manager_invitations_v1(uuid,uuid),
 customer_api.revoke_property_manager_invitation_v1(uuid,uuid),
 customer_api.list_my_property_manager_invitations_v1(),
 customer_api.claim_property_manager_invitation_v1(uuid,text) from public,anon;
grant execute on function customer_api.list_invitable_manager_properties_v1(uuid),
 customer_api.create_property_manager_invitation_v1(uuid,uuid,text),
 customer_api.list_managed_property_manager_invitations_v1(uuid,uuid),
 customer_api.revoke_property_manager_invitation_v1(uuid,uuid),
 customer_api.list_my_property_manager_invitations_v1(),
 customer_api.claim_property_manager_invitation_v1(uuid,text) to authenticated;

commit;
