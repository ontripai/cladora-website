begin;

-- An owner invitation may additionally start a personal portfolio. A normal
-- unit invitation keeps its existing role and behaviour.
alter table communications.unit_invitations
  add column owner_portfolio_requested boolean not null default false;
alter table communications.unit_invitations
  add constraint owner_portfolio_owner_only check (not owner_portfolio_requested or role_code='owner');

create table platform.invited_owner_portfolios (
  owner_user_id uuid primary key references auth.users(id) on delete restrict,
  tenant_id uuid not null unique references platform.tenants(id) on delete restrict,
  membership_id uuid not null unique references identity.memberships(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp()
);
create table platform.invited_owner_units (
  invitation_id uuid primary key references communications.unit_invitations(id) on delete restrict,
  owner_user_id uuid not null references platform.invited_owner_portfolios(owner_user_id) on delete restrict,
  private_unit_id uuid not null,
  canonical_unit_id uuid not null references portfolio.units(id) on delete restrict,
  ownership_party_id uuid not null references portfolio.parties(id) on delete restrict,
  revoked_at timestamptz,
  unique(owner_user_id,canonical_unit_id),
  foreign key(private_unit_id,owner_user_id) references public.owner_private_units(id,owner_user_id) on delete restrict
);
create index invited_owner_units_actor_idx on platform.invited_owner_units(owner_user_id,revoked_at);
alter table platform.invited_owner_portfolios enable row level security;
alter table platform.invited_owner_units enable row level security;
revoke all on platform.invited_owner_portfolios,platform.invited_owner_units from public,anon,authenticated;
grant all on platform.invited_owner_portfolios,platform.invited_owner_units to service_role;

create or replace function app_private.has_multi_unit_owner_role_v1()
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select auth.uid() is not null and (auth.jwt()->>'aal')='aal2' and (
    exists(select 1 from platform.owner_portfolio_pilots p
      join identity.memberships m on m.id=p.membership_id and m.user_id=p.owner_user_id and m.tenant_id=p.tenant_id
      join identity.roles r on r.id=m.role_id join platform.tenants t on t.id=m.tenant_id
      join auth.users u on u.id=m.user_id join platform.customer_cases c on c.id=p.case_id
      join platform.customer_case_participants cp on cp.case_id=p.case_id and cp.auth_user_id=p.owner_user_id
      where p.owner_user_id=auth.uid() and p.revoked_at is null and p.expires_at>statement_timestamp()
        and c.status='open' and cp.status='active' and u.email_confirmed_at is not null
        and r.code='multi_unit_owner' and r.is_system and r.tenant_id is null and t.status='active'
        and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp()))
    or exists(select 1 from platform.invited_owner_portfolios a
      join identity.memberships m on m.id=a.membership_id and m.user_id=a.owner_user_id and m.tenant_id=a.tenant_id
      join identity.roles r on r.id=m.role_id join platform.tenants t on t.id=a.tenant_id
      join auth.users u on u.id=a.owner_user_id
      where a.owner_user_id=auth.uid() and u.email_confirmed_at is not null and t.status='active'
        and r.code='multi_unit_owner' and r.is_system and r.tenant_id is null
        and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
        and exists(select 1 from platform.invited_owner_units iu
          join portfolio.units cu on cu.id=iu.canonical_unit_id and cu.status='active'
          join portfolio.ownerships o on o.unit_id=cu.id and o.party_id=iu.ownership_party_id
          where iu.owner_user_id=a.owner_user_id and iu.revoked_at is null
            and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>current_date)))
  );
$$;

create function customer_api.create_owner_portfolio_invitation_v1(
  p_context uuid,p_workspace uuid,p_unit uuid,p_party uuid,p_email text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_result jsonb; v_id uuid;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or not communications.can_manage_unit_invites(auth.uid(),p_context,p_workspace,p_unit)
    or not communications.unit_party_relationship_valid(p_unit,p_party,'owner') then
    raise exception 'owner_invitation_denied' using errcode='42501'; end if;
  v_result:=customer_api.create_unit_invitation_v1(p_context,p_workspace,p_unit,p_party,'owner',p_email);
  v_id:=(v_result->>'id')::uuid;
  if coalesce((v_result->>'replayed')::boolean,false) and not exists(
    select 1 from communications.unit_invitations where id=v_id and owner_portfolio_requested) then
    raise exception 'existing_owner_invitation_requires_review' using errcode='23505'; end if;
  update communications.unit_invitations set owner_portfolio_requested=true where id=v_id;
  return v_result;
end $$;

create or replace function customer_api.list_my_unit_invitations_v1()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_email text;
begin
  select lower(email) into v_email from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if v_email is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'unit',u.code,
    'building',b.name,'role',i.role_code,'owner_portfolio',i.owner_portfolio_requested,
    'expires_at',i.expires_at) order by i.created_at desc)
    from communications.unit_invitations i join portfolio.units u on u.id=i.unit_id
    join portfolio.buildings b on b.id=u.building_id where i.normalized_email=v_email
      and i.status='pending' and i.expires_at>statement_timestamp()),'[]'::jsonb);
end $$;

create or replace function customer_api.list_managed_unit_invitations_v1(p_context uuid,p_workspace uuid,p_unit uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','aal1')<>'aal2'
    or not communications.can_manage_unit_invites(auth.uid(),p_context,p_workspace,p_unit) then
    raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'email',i.normalized_email,
    'role',i.role_code,'owner_portfolio',i.owner_portfolio_requested,'expires_at',i.expires_at) order by i.created_at desc)
    from communications.unit_invitations i where i.workspace_id=p_workspace and i.unit_id=p_unit
      and i.invited_by=auth.uid() and i.status='pending' and i.expires_at>statement_timestamp()),'[]'::jsonb);
end $$;

-- Keep the original unit acceptance intact, then add the personal role only
-- after the email, owner relationship, workspace and AAL2 checks pass.
alter function customer_api.claim_unit_invitation_v1(uuid,text) rename to claim_unit_invitation_core_v1;
revoke all on function customer_api.claim_unit_invitation_core_v1(uuid,text) from public,anon,authenticated;

create function customer_api.claim_unit_invitation_v1(p_invitation uuid,p_display_name text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_i communications.unit_invitations; v_result jsonb; v_portfolio platform.invited_owner_portfolios;
  v_tenant uuid; v_membership uuid; v_private uuid; v_unit portfolio.units; v_building portfolio.buildings;
begin
  select * into v_i from communications.unit_invitations where id=p_invitation for update;
  if not found then raise exception 'unit_invitation_denied' using errcode='42501'; end if;
  v_result:=customer_api.claim_unit_invitation_core_v1(p_invitation,p_display_name);
  if not v_i.owner_portfolio_requested then return v_result; end if;
  if v_i.role_code<>'owner' or not communications.unit_party_relationship_valid(v_i.unit_id,v_i.party_id,'owner') then
    raise exception 'owner_relationship_required' using errcode='42501'; end if;
  select * into v_portfolio from platform.invited_owner_portfolios where owner_user_id=auth.uid() for update;
  if v_portfolio.owner_user_id is null then
    insert into platform.tenants(legal_name,registration_number,status,default_locale)
      values(left('Owner portfolio · '||trim(p_display_name),255),
        'CLD-INVITED-'||replace(auth.uid()::text,'-',''),'active','ro') returning id into v_tenant;
    insert into identity.memberships(tenant_id,user_id,role_id,status)
      values(v_tenant,auth.uid(),(select id from identity.roles where tenant_id is null and code='multi_unit_owner'),
        'active') returning id into v_membership;
    insert into platform.invited_owner_portfolios(owner_user_id,tenant_id,membership_id)
      values(auth.uid(),v_tenant,v_membership);
  else
    update identity.memberships set status='active' where id=v_portfolio.membership_id and status<>'active';
  end if;
  select * into v_unit from portfolio.units where id=v_i.unit_id;
  select * into v_building from portfolio.buildings where id=v_unit.building_id;
  select private_unit_id into v_private from platform.invited_owner_units
    where owner_user_id=auth.uid() and canonical_unit_id=v_i.unit_id;
  if v_private is null then
    insert into public.owner_private_units(owner_user_id,building_label,unit_label,address_text)
      values(auth.uid(),v_building.name,v_unit.code,
        left(coalesce(nullif(trim(v_building.name),''),'Building')||' · '||v_unit.code,500)) returning id into v_private;
    insert into platform.invited_owner_units(invitation_id,owner_user_id,private_unit_id,canonical_unit_id,ownership_party_id)
      values(v_i.id,auth.uid(),v_private,v_i.unit_id,v_i.party_id);
  else
    update platform.invited_owner_units set invitation_id=v_i.id,
      ownership_party_id=v_i.party_id,revoked_at=null
      where owner_user_id=auth.uid() and canonical_unit_id=v_i.unit_id;
    update public.owner_private_units set status='active' where id=v_private and owner_user_id=auth.uid();
  end if;
  insert into audit.events(tenant_id,actor_id,action,entity_type,entity_id)
    values(v_i.tenant_id,auth.uid(),'owner_portfolio.invitation_accept','communications.unit_invitation',v_i.id);
  return v_result||jsonb_build_object('owner_portfolio',true,'private_unit_id',v_private);
end $$;

revoke all on function customer_api.create_owner_portfolio_invitation_v1(uuid,uuid,uuid,uuid,text),
  customer_api.claim_unit_invitation_v1(uuid,text) from public,anon;
grant execute on function customer_api.create_owner_portfolio_invitation_v1(uuid,uuid,uuid,uuid,text),
  customer_api.claim_unit_invitation_v1(uuid,text) to authenticated;

commit;
