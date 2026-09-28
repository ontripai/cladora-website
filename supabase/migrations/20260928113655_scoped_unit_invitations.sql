begin;

create table communications.unit_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id),
  workspace_id uuid not null references platform.customer_workspaces(id),
  unit_id uuid not null references portfolio.units(id),
  party_id uuid not null references portfolio.parties(id),
  normalized_email text not null,
  role_code text not null check (role_code in ('owner','tenant_resident')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id),
  inviter_context_id uuid not null references identity.context_grants(id),
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default (statement_timestamp() + interval '72 hours'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (normalized_email = lower(trim(normalized_email))),
  check (expires_at > created_at),
  check ((status='accepted' and accepted_by is not null and accepted_at is not null)
    or (status<>'accepted' and accepted_by is null and accepted_at is null))
);
create unique index unit_invitations_pending_unique on communications.unit_invitations
  (workspace_id,unit_id,normalized_email,role_code) where status='pending';
create index unit_invitations_email_idx on communications.unit_invitations(normalized_email,status,expires_at);
create index unit_invitations_tenant_idx on communications.unit_invitations(tenant_id);
create index unit_invitations_workspace_idx on communications.unit_invitations(workspace_id);
create index unit_invitations_unit_idx on communications.unit_invitations(unit_id);
create index unit_invitations_party_idx on communications.unit_invitations(party_id);
create index unit_invitations_inviter_idx on communications.unit_invitations(invited_by);
create index unit_invitations_inviter_context_idx on communications.unit_invitations(inviter_context_id);
create index unit_invitations_acceptor_idx on communications.unit_invitations(accepted_by);
alter table communications.unit_invitations enable row level security;
revoke all on communications.unit_invitations from public,anon,authenticated;
grant all on communications.unit_invitations to service_role;

create function communications.can_manage_unit_invites(p_actor uuid,p_context uuid,p_workspace uuid,p_unit uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id
    join identity.memberships m on m.tenant_id=u.tenant_id and m.user_id=p_actor
    join identity.roles r on r.id=m.role_id and lower(r.code) in ('association_admin','property_manager')
    join identity.context_grants g on g.membership_id=m.id and g.tenant_id=u.tenant_id and g.id=p_context
    join platform.customer_workspaces w on w.id=p_workspace and w.tenant_id=u.tenant_id and w.lifecycle_status='ACTIVE'
    join platform.workspace_property_bindings wb on wb.customer_workspace_id=w.id
      and wb.tenant_id=u.tenant_id and wb.property_id=b.property_id and wb.status='active'
      and wb.valid_from<=statement_timestamp() and (wb.valid_to is null or wb.valid_to>statement_timestamp())
    join platform.workspace_entitlements e on e.customer_workspace_id=w.id
      and e.entitlement_key='module.communications' and e.boolean_value=true
      and e.valid_from<=statement_timestamp()
      and (e.valid_until is null or e.valid_until>statement_timestamp())
    where u.id=p_unit and u.status='active' and b.status='active'
      and not exists (select 1 from platform.workspace_property_bindings other
        where other.property_id=b.property_id and other.id<>wb.id and other.status='active'
          and other.valid_from<=statement_timestamp() and (other.valid_to is null or other.valid_to>statement_timestamp()))
      and m.status='active' and m.starts_at<=statement_timestamp()
      and (m.ends_at is null or m.ends_at>statement_timestamp())
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and ((g.scope_type='property' and g.property_id=b.property_id)
        or (g.scope_type='building' and g.building_id=b.id)));
$$;
revoke all on function communications.can_manage_unit_invites(uuid,uuid,uuid,uuid) from public,anon,authenticated;

create function communications.unit_party_relationship_valid(p_unit uuid,p_party uuid,p_role text)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select case when p_role='owner' then exists(select 1 from portfolio.ownerships o
      join portfolio.units u on u.id=o.unit_id and u.tenant_id=o.tenant_id
      join portfolio.parties p on p.id=o.party_id and p.tenant_id=o.tenant_id
      where o.unit_id=p_unit and o.party_id=p_party and o.valid_from<=current_date
        and (o.valid_to is null or o.valid_to>current_date))
    when p_role='tenant_resident' then exists(select 1 from occupancy.leases l
      join portfolio.units u on u.id=l.unit_id and u.tenant_id=l.tenant_id
      join portfolio.parties p on p.id=l.tenant_party_id and p.tenant_id=l.tenant_id
      where l.unit_id=p_unit and l.tenant_party_id=p_party and l.status='active'
        and l.starts_on<=current_date and (l.ends_on is null or l.ends_on>current_date))
    else false end;
$$;
revoke all on function communications.unit_party_relationship_valid(uuid,uuid,text) from public,anon,authenticated;

create function customer_api.list_unit_invite_parties_v1(p_context uuid,p_workspace uuid,p_unit uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or not communications.can_manage_unit_invites(v_actor,p_context,p_workspace,p_unit) then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(to_jsonb(q) order by q.role_code,q.legal_name)
    from (select distinct p.id as party_id,p.legal_name,'owner'::text as role_code
      from portfolio.parties p where communications.unit_party_relationship_valid(p_unit,p.id,'owner')
      union all
      select distinct p.id,p.legal_name,'tenant_resident'::text
      from portfolio.parties p where communications.unit_party_relationship_valid(p_unit,p.id,'tenant_resident')) q),'[]'::jsonb);
end $$;

create function customer_api.create_unit_invitation_v1(p_context uuid,p_workspace uuid,p_unit uuid,p_party uuid,p_role text,p_email text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := auth.uid(); v_email text := lower(trim(coalesce(p_email,'')));
 v_tenant uuid; v_workspace uuid; v_id uuid; v_existing uuid;
begin
  if v_actor is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or not communications.can_manage_unit_invites(v_actor,p_context,p_workspace,p_unit)
    or p_role not in ('owner','tenant_resident')
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(v_email)>320 then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  select u.tenant_id,w.id into v_tenant,v_workspace from portfolio.units u
    join platform.customer_workspaces w on w.id=p_workspace and w.tenant_id=u.tenant_id and w.lifecycle_status='ACTIVE'
    where u.id=p_unit;
  if v_workspace is null or not exists(select 1 from portfolio.parties p where p.id=p_party
    and p.tenant_id=v_tenant and p.archived_at is null)
    or not communications.unit_party_relationship_valid(p_unit,p_party,p_role) then
    raise exception 'unit_relationship_required' using errcode='42501'; end if;
  update communications.unit_invitations set status='expired' where workspace_id=v_workspace and unit_id=p_unit
    and normalized_email=v_email and role_code=p_role and status='pending'
    and expires_at<=statement_timestamp();
  select id into v_existing from communications.unit_invitations where workspace_id=v_workspace and unit_id=p_unit
    and normalized_email=v_email and role_code=p_role and status='pending';
  if v_existing is not null then return jsonb_build_object('id',v_existing,'replayed',true,
    'known_account',exists(select 1 from auth.users where lower(email)=v_email and email_confirmed_at is not null)); end if;
  insert into communications.unit_invitations(tenant_id,workspace_id,unit_id,party_id,
    normalized_email,role_code,invited_by,inviter_context_id) values(v_tenant,v_workspace,p_unit,p_party,
    v_email,p_role,v_actor,p_context) returning id into v_id;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id)
    values(v_tenant,v_actor,'unit_invitation.create','communications.unit_invitation',v_id);
  return jsonb_build_object('id',v_id,'replayed',false,
    'known_account',exists(select 1 from auth.users where lower(email)=v_email and email_confirmed_at is not null));
end $$;

create function customer_api.revoke_unit_invitation_v1(p_invitation uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_i communications.unit_invitations;
begin
  select * into v_i from communications.unit_invitations where id=p_invitation for update;
  if v_i.id is null or v_i.status<>'pending' or auth.uid()<>v_i.invited_by
    or not communications.can_manage_unit_invites(auth.uid(),v_i.inviter_context_id,v_i.workspace_id,v_i.unit_id) then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  update communications.unit_invitations set status='revoked',revoked_at=statement_timestamp()
    where id=p_invitation;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id)
    values(v_i.tenant_id,auth.uid(),'unit_invitation.revoke','communications.unit_invitation',v_i.id);
  return true;
end $$;

create function customer_api.list_my_unit_invitations_v1()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid := auth.uid(); v_email text;
begin
  select lower(email) into v_email from auth.users where id=v_actor and email_confirmed_at is not null;
  if v_email is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'unit',u.code,
    'building',b.name,'role',i.role_code,'expires_at',i.expires_at) order by i.created_at desc)
    from communications.unit_invitations i join portfolio.units u on u.id=i.unit_id
    join portfolio.buildings b on b.id=u.building_id where i.normalized_email=v_email
      and i.status='pending' and i.expires_at>statement_timestamp()),'[]'::jsonb);
end $$;

create function customer_api.claim_unit_invitation_v1(p_invitation uuid,p_display_name text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := auth.uid(); v_email text; v_i communications.unit_invitations;
 v_role uuid; v_membership uuid;
begin
  select lower(email) into v_email from auth.users where id=v_actor and email_confirmed_at is not null;
  if v_email is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or length(trim(coalesce(p_display_name,''))) not between 2 and 120 then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  select * into v_i from communications.unit_invitations where id=p_invitation for update;
  if v_i.id is null or v_i.status<>'pending' or v_i.expires_at<=statement_timestamp()
    or v_i.normalized_email<>v_email
    or not communications.can_manage_unit_invites(v_i.invited_by,v_i.inviter_context_id,v_i.workspace_id,v_i.unit_id)
    or not communications.unit_party_relationship_valid(v_i.unit_id,v_i.party_id,v_i.role_code)
    or not exists(select 1 from platform.customer_workspaces w where w.id=v_i.workspace_id
      and w.tenant_id=v_i.tenant_id and w.lifecycle_status='ACTIVE') then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  select id into v_role from identity.roles where code=v_i.role_code
    and (tenant_id is null or tenant_id=v_i.tenant_id)
    order by (tenant_id=v_i.tenant_id) desc limit 1;
  if v_role is null then raise exception 'unit_role_unavailable' using errcode='55000'; end if;
  insert into identity.profiles(user_id,display_name) values(v_actor,trim(p_display_name))
    on conflict(user_id) do nothing;
  insert into identity.memberships(tenant_id,user_id,role_id,status)
    values(v_i.tenant_id,v_actor,v_role,'active')
    on conflict(tenant_id,user_id,role_id) where status in ('invited','active')
    do update set status='active' returning id into v_membership;
  if exists(select 1 from identity.membership_parties where membership_id=v_membership
    and party_id<>v_i.party_id) then raise exception 'unit_party_conflict' using errcode='23505'; end if;
  insert into identity.membership_parties(membership_id,tenant_id,party_id)
    values(v_membership,v_i.tenant_id,v_i.party_id)
    on conflict(membership_id) do nothing;
  insert into identity.context_grants(membership_id,tenant_id,scope_type,unit_id)
    select v_membership,v_i.tenant_id,'unit',v_i.unit_id where not exists(
      select 1 from identity.context_grants g where g.membership_id=v_membership
        and g.scope_type='unit' and g.unit_id=v_i.unit_id and g.ends_at is null);
  update communications.unit_invitations set status='accepted',accepted_by=v_actor,
    accepted_at=statement_timestamp() where id=v_i.id;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id)
    values(v_i.tenant_id,v_actor,'unit_invitation.accept','communications.unit_invitation',v_i.id);
  return jsonb_build_object('membership_id',v_membership,'unit_id',v_i.unit_id);
end $$;

revoke all on function customer_api.list_unit_invite_parties_v1(uuid,uuid,uuid),
 customer_api.create_unit_invitation_v1(uuid,uuid,uuid,uuid,text,text),
 customer_api.revoke_unit_invitation_v1(uuid),
 customer_api.list_my_unit_invitations_v1(),
 customer_api.claim_unit_invitation_v1(uuid,text) from public,anon;
grant execute on function customer_api.list_unit_invite_parties_v1(uuid,uuid,uuid),
 customer_api.create_unit_invitation_v1(uuid,uuid,uuid,uuid,text,text),
 customer_api.revoke_unit_invitation_v1(uuid),
 customer_api.list_my_unit_invitations_v1(),
 customer_api.claim_unit_invitation_v1(uuid,text) to authenticated;

commit;
