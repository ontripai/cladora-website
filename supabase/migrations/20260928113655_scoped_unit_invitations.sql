begin;

create table communications.unit_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id),
  workspace_id uuid not null references platform.customer_workspaces(id),
  unit_id uuid not null references portfolio.units(id),
  party_id uuid references portfolio.parties(id),
  vendor_id uuid references maintenance.vendors(id),
  normalized_email text not null,
  role_code text not null check (role_code in ('owner','tenant_resident','vendor_contact')),
  status text not null default 'pending' check (status in ('pending','accepted','revoked','expired')),
  invited_by uuid not null references auth.users(id),
  inviter_context_id uuid not null references identity.context_grants(id),
  accepted_by uuid references auth.users(id),
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default (statement_timestamp() + interval '72 hours'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (normalized_email = lower(trim(normalized_email))),
  check ((role_code='vendor_contact' and vendor_id is not null and party_id is null)
    or (role_code in ('owner','tenant_resident') and party_id is not null and vendor_id is null)),
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
create index unit_invitations_vendor_idx on communications.unit_invitations(vendor_id);
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

create function customer_api.list_managed_invite_units_v1(p_context uuid,p_query text default null,
  p_limit integer default 50,p_offset integer default 0)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_workspace uuid;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or p_limit not between 1 and 100 or p_offset<0 or length(coalesce(p_query,''))>100 then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  select resolved.workspace_id into v_workspace
    from app_private.resolve_workspace_from_customer_context_v1(p_context,false) resolved;
  if v_workspace is null then raise exception 'workspace_binding_required' using errcode='42501'; end if;
  return jsonb_build_object('workspace_id',v_workspace,'units',coalesce((
    select jsonb_agg(to_jsonb(q) order by q.building_name,q.unit_code)
      from (select u.id,b.name building_name,u.code unit_code from portfolio.units u
        join portfolio.buildings b on b.id=u.building_id
        where communications.can_manage_unit_invites(auth.uid(),p_context,v_workspace,u.id)
          and (p_query is null or u.code ilike '%'||p_query||'%' or b.name ilike '%'||p_query||'%')
        order by b.name,u.code limit p_limit offset p_offset) q),'[]'::jsonb));
end $$;

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

create function communications.unit_vendor_contract_valid(p_unit uuid,p_vendor uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id
    join maintenance.vendors v on v.id=p_vendor and v.tenant_id=u.tenant_id and v.status='approved'
    join maintenance.vendor_contracts c on c.vendor_id=v.id and c.tenant_id=u.tenant_id
      and c.property_id=b.property_id and c.status='active'
      and c.starts_on<=current_date and (c.ends_on is null or c.ends_on>current_date)
    where u.id=p_unit and u.status='active');
$$;
revoke all on function communications.unit_vendor_contract_valid(uuid,uuid) from public,anon,authenticated;

-- Manager attestation creates only a new, unambiguous relationship. Existing
-- ownership and leases are never overwritten by an invitation flow.
create function customer_api.register_unit_invite_relationship_v1(
  p_context uuid,p_workspace uuid,p_unit uuid,p_role text,p_name text,p_evidence text,
  p_starts_on date,p_ends_on date)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := auth.uid(); v_tenant uuid; v_party uuid; v_landlord uuid;
begin
  if v_actor is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or not communications.can_manage_unit_invites(v_actor,p_context,p_workspace,p_unit)
    or p_role not in ('owner','tenant_resident')
    or length(trim(coalesce(p_name,''))) not between 2 and 120
    or length(trim(coalesce(p_evidence,''))) not between 15 and 500
    or p_starts_on is null or p_starts_on>current_date
    or (p_ends_on is not null and p_ends_on<=current_date) then
    raise exception 'unit_relationship_registration_denied' using errcode='42501'; end if;
  select tenant_id into v_tenant from portfolio.units where id=p_unit for update;
  if p_role='owner' then
    if exists(select 1 from portfolio.ownerships o where o.unit_id=p_unit
      and o.tenant_id=v_tenant and o.valid_from<coalesce(p_ends_on,'infinity'::date)
      and coalesce(o.valid_to,'infinity'::date)>p_starts_on) then
      raise exception 'existing_ownership_requires_review' using errcode='23505'; end if;
  else
    select o.party_id into v_landlord from portfolio.ownerships o
      where o.unit_id=p_unit and o.tenant_id=v_tenant and o.valid_from<=current_date
        and (o.valid_to is null or o.valid_to>current_date)
      order by o.id limit 1;
    if v_landlord is null or exists(select 1 from occupancy.leases l where l.unit_id=p_unit
      and l.tenant_id=v_tenant and l.status='active'
      and l.starts_on<coalesce(p_ends_on,'infinity'::date)
      and coalesce(l.ends_on,'infinity'::date)>p_starts_on) then
      raise exception 'existing_lease_requires_review' using errcode='23505'; end if;
  end if;
  insert into portfolio.parties(tenant_id,type,legal_name)
    values(v_tenant,'person',trim(p_name)) returning id into v_party;
  if p_role='owner' then
    insert into portfolio.ownerships(tenant_id,unit_id,party_id,share,valid_from,valid_to)
      values(v_tenant,p_unit,v_party,1,p_starts_on,p_ends_on);
  else
    insert into occupancy.leases(tenant_id,unit_id,landlord_party_id,tenant_party_id,
      starts_on,ends_on,status) values(v_tenant,p_unit,v_landlord,v_party,p_starts_on,p_ends_on,'active');
  end if;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id,after_snapshot)
    values(v_tenant,v_actor,'unit_invitation.relationship_attested','portfolio.party',v_party,
      jsonb_build_object('unit_id',p_unit,'workspace_id',p_workspace,
        'role_code',p_role,'basis',trim(p_evidence),'starts_on',p_starts_on,'ends_on',p_ends_on));
  return jsonb_build_object('party_id',v_party,'role_code',p_role);
end $$;

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
      from portfolio.parties p where communications.unit_party_relationship_valid(p_unit,p.id,'tenant_resident')
      union all
      select v.id,p.legal_name,'vendor_contact'::text
      from maintenance.vendors v join portfolio.parties p on p.id=v.party_id and p.tenant_id=v.tenant_id
      where communications.unit_vendor_contract_valid(p_unit,v.id)) q),'[]'::jsonb);
end $$;

create function customer_api.create_unit_invitation_v1(p_context uuid,p_workspace uuid,p_unit uuid,p_party uuid,p_role text,p_email text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_actor uuid := auth.uid(); v_email text := lower(trim(coalesce(p_email,'')));
 v_tenant uuid; v_workspace uuid; v_id uuid; v_existing uuid;
begin
  if v_actor is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or not communications.can_manage_unit_invites(v_actor,p_context,p_workspace,p_unit)
    or p_role not in ('owner','tenant_resident','vendor_contact')
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or length(v_email)>320 then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  select u.tenant_id,w.id into v_tenant,v_workspace from portfolio.units u
    join platform.customer_workspaces w on w.id=p_workspace and w.tenant_id=u.tenant_id and w.lifecycle_status='ACTIVE'
    where u.id=p_unit;
  if v_workspace is null or (p_role<>'vendor_contact' and
    (not exists(select 1 from portfolio.parties p where p.id=p_party
      and p.tenant_id=v_tenant and p.archived_at is null)
      or not communications.unit_party_relationship_valid(p_unit,p_party,p_role)))
    or (p_role='vendor_contact' and not communications.unit_vendor_contract_valid(p_unit,p_party)) then
    raise exception 'unit_relationship_required' using errcode='42501'; end if;
  update communications.unit_invitations set status='expired' where workspace_id=v_workspace and unit_id=p_unit
    and normalized_email=v_email and role_code=p_role and status='pending'
    and expires_at<=statement_timestamp();
  select id into v_existing from communications.unit_invitations where workspace_id=v_workspace and unit_id=p_unit
    and normalized_email=v_email and role_code=p_role and status='pending';
  if v_existing is not null and exists(select 1 from communications.unit_invitations i
    where i.id=v_existing and (case when p_role='vendor_contact' then i.vendor_id else i.party_id end)<>p_party) then
    raise exception 'invitation_party_conflict' using errcode='23505'; end if;
  if v_existing is not null then return jsonb_build_object('id',v_existing,'replayed',true,
    'known_account',exists(select 1 from auth.users where lower(email)=v_email and email_confirmed_at is not null)); end if;
  insert into communications.unit_invitations(tenant_id,workspace_id,unit_id,party_id,vendor_id,
    normalized_email,role_code,invited_by,inviter_context_id) values(v_tenant,v_workspace,p_unit,
    case when p_role='vendor_contact' then null else p_party end,
    case when p_role='vendor_contact' then p_party else null end,
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
    or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or not communications.can_manage_unit_invites(auth.uid(),v_i.inviter_context_id,v_i.workspace_id,v_i.unit_id) then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  update communications.unit_invitations set status='revoked',revoked_at=statement_timestamp()
    where id=p_invitation;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id)
    values(v_i.tenant_id,auth.uid(),'unit_invitation.revoke','communications.unit_invitation',v_i.id);
  return true;
end $$;

create function customer_api.list_managed_unit_invitations_v1(p_context uuid,p_workspace uuid,p_unit uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or not communications.can_manage_unit_invites(auth.uid(),p_context,p_workspace,p_unit) then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.normalized_email,
    'role',i.role_code,'expires_at',i.expires_at) order by i.created_at desc)
    from communications.unit_invitations i where i.workspace_id=p_workspace and i.unit_id=p_unit
      and i.invited_by=auth.uid() and i.status='pending' and i.expires_at>statement_timestamp()),'[]'::jsonb);
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
    or (v_i.role_code='vendor_contact' and not communications.unit_vendor_contract_valid(v_i.unit_id,v_i.vendor_id))
    or (v_i.role_code<>'vendor_contact' and not communications.unit_party_relationship_valid(v_i.unit_id,v_i.party_id,v_i.role_code))
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
  if v_i.role_code='vendor_contact' then
    insert into maintenance.vendor_portal_memberships(tenant_id,vendor_id,membership_id,
      status,verified_by,accepted_at) values(v_i.tenant_id,v_i.vendor_id,v_membership,
      'active',v_i.invited_by,statement_timestamp())
      on conflict(tenant_id,membership_id,vendor_id) do update
        set status='active',verified_by=v_i.invited_by,accepted_at=statement_timestamp(),revoked_at=null;
    insert into identity.context_grants(membership_id,tenant_id,scope_type,property_id)
      select v_membership,v_i.tenant_id,'property',b.property_id
      from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=v_i.unit_id
        and not exists(select 1 from identity.context_grants g where g.membership_id=v_membership
          and g.scope_type='property' and g.property_id=b.property_id and g.ends_at is null);
  else
    if exists(select 1 from identity.membership_parties where membership_id=v_membership
      and party_id<>v_i.party_id) then raise exception 'unit_party_conflict' using errcode='23505'; end if;
    insert into identity.membership_parties(membership_id,tenant_id,party_id)
      values(v_membership,v_i.tenant_id,v_i.party_id)
      on conflict(membership_id) do nothing;
    insert into identity.context_grants(membership_id,tenant_id,scope_type,unit_id)
      select v_membership,v_i.tenant_id,'unit',v_i.unit_id where not exists(
        select 1 from identity.context_grants g where g.membership_id=v_membership
          and g.scope_type='unit' and g.unit_id=v_i.unit_id and g.ends_at is null);
  end if;
  update communications.unit_invitations set status='accepted',accepted_by=v_actor,
    accepted_at=statement_timestamp() where id=v_i.id;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id)
    values(v_i.tenant_id,v_actor,'unit_invitation.accept','communications.unit_invitation',v_i.id);
  return jsonb_build_object('membership_id',v_membership,'unit_id',v_i.unit_id);
end $$;

revoke all on function customer_api.list_unit_invite_parties_v1(uuid,uuid,uuid),
 customer_api.list_managed_invite_units_v1(uuid,text,integer,integer),
 customer_api.register_unit_invite_relationship_v1(uuid,uuid,uuid,text,text,text,date,date),
 customer_api.create_unit_invitation_v1(uuid,uuid,uuid,uuid,text,text),
 customer_api.list_managed_unit_invitations_v1(uuid,uuid,uuid),
 customer_api.revoke_unit_invitation_v1(uuid),
 customer_api.list_my_unit_invitations_v1(),
 customer_api.claim_unit_invitation_v1(uuid,text) from public,anon;
grant execute on function customer_api.list_unit_invite_parties_v1(uuid,uuid,uuid),
 customer_api.list_managed_invite_units_v1(uuid,text,integer,integer),
 customer_api.register_unit_invite_relationship_v1(uuid,uuid,uuid,text,text,text,date,date),
 customer_api.create_unit_invitation_v1(uuid,uuid,uuid,uuid,text,text),
 customer_api.list_managed_unit_invitations_v1(uuid,uuid,uuid),
 customer_api.revoke_unit_invitation_v1(uuid),
 customer_api.list_my_unit_invitations_v1(),
 customer_api.claim_unit_invitation_v1(uuid,text) to authenticated;

commit;
