begin;

create table platform.owner_unit_links (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  private_unit_id uuid not null,
  workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  canonical_unit_id uuid not null references portfolio.units(id) on delete restrict,
  ownership_party_id uuid references portfolio.parties(id) on delete restrict,
  evidence_reference text not null check(length(btrim(evidence_reference)) between 15 and 500),
  status text not null default 'requested' check(status in ('requested','manager_verified','linked','withdrawn','revoked')),
  requested_at timestamptz not null default statement_timestamp(),
  manager_verified_by uuid references auth.users(id),
  manager_verified_at timestamptz,
  manager_evidence text,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  approval_reason text,
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  revoke_reason text,
  foreign key(private_unit_id,owner_user_id) references public.owner_private_units(id,owner_user_id) on delete restrict,
  check((status='requested' and manager_verified_by is null and approved_by is null) or status<>'requested'),
  check(status<>'manager_verified' or (ownership_party_id is not null and manager_verified_by is not null and manager_verified_at is not null)),
  check(status<>'linked' or (ownership_party_id is not null and manager_verified_by is not null and approved_by is not null and approved_at is not null and length(btrim(approval_reason))>=15)),
  check(status<>'revoked' or (revoked_at is not null and revoked_by is not null and length(btrim(revoke_reason))>=8))
);
create unique index owner_unit_links_open_unique on platform.owner_unit_links(owner_user_id,private_unit_id,workspace_id,canonical_unit_id)
  where status in ('requested','manager_verified','linked');
create index owner_unit_links_workspace_queue_idx on platform.owner_unit_links(workspace_id,status,requested_at);
alter table platform.owner_unit_links enable row level security;
revoke all on platform.owner_unit_links from public,anon,authenticated;
grant all on platform.owner_unit_links to service_role;

create function app_private.owner_link_manager_v1(p_workspace uuid,p_unit uuid)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
  select exists(select 1 from platform.customer_workspaces w
    join portfolio.units u on u.id=p_unit and u.tenant_id=w.tenant_id
    join portfolio.buildings b on b.id=u.building_id and b.tenant_id=w.tenant_id
    join identity.memberships m on m.tenant_id=w.tenant_id and m.user_id=auth.uid()
    join identity.roles r on r.id=m.role_id and r.code in ('association_admin','property_manager')
      and (r.tenant_id is null or r.tenant_id=w.tenant_id)
    join identity.context_grants g on g.membership_id=m.id and g.tenant_id=w.tenant_id
    where w.id=p_workspace and w.lifecycle_status='ACTIVE'
      and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and (g.scope_type='tenant' or g.scope_type='property' and g.property_id=b.property_id
        or g.scope_type='building' and g.building_id=b.id or g.scope_type='unit' and g.unit_id=u.id));
$$;
revoke all on function app_private.owner_link_manager_v1(uuid,uuid) from public;
grant execute on function app_private.owner_link_manager_v1(uuid,uuid) to authenticated;

create function customer_api.request_owner_unit_link_v1(p_private_unit uuid,p_workspace uuid,p_canonical_unit uuid,p_evidence text)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare v_link uuid;
begin
  if not app_private.has_multi_unit_owner_role_v1() then raise exception 'owner_role_required' using errcode='42501'; end if;
  if length(btrim(coalesce(p_evidence,''))) not between 15 and 500 then raise exception 'evidence_required' using errcode='22023'; end if;
  if not exists(select 1 from public.owner_private_units where id=p_private_unit and owner_user_id=auth.uid() and status='active')
    or not exists(select 1 from platform.customer_workspaces w join portfolio.units u on u.tenant_id=w.tenant_id and u.id=p_canonical_unit
      where w.id=p_workspace and w.lifecycle_status='ACTIVE' and u.status='active') then
    raise exception 'unit_unavailable' using errcode='P0002';
  end if;
  insert into platform.owner_unit_links(owner_user_id,private_unit_id,workspace_id,canonical_unit_id,evidence_reference)
    values(auth.uid(),p_private_unit,p_workspace,p_canonical_unit,btrim(p_evidence)) returning id into v_link;
  return v_link;
end $$;

create function customer_api.list_my_owner_unit_links_v1()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_rows jsonb;
begin
  if not app_private.has_multi_unit_owner_role_v1() then raise exception 'owner_role_required' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'private_unit_id',l.private_unit_id,
    'workspace_id',l.workspace_id,'canonical_unit_id',l.canonical_unit_id,'status',
    case when l.status='linked' and not exists(select 1 from portfolio.ownerships o join platform.customer_workspaces w on w.tenant_id=o.tenant_id
      where w.id=l.workspace_id and o.unit_id=l.canonical_unit_id and o.party_id=l.ownership_party_id
      and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>current_date)) then 'ownership_expired' else l.status end,
    'requested_at',l.requested_at) order by l.requested_at desc),'[]'::jsonb) into v_rows
  from platform.owner_unit_links l where l.owner_user_id=auth.uid();
  return v_rows;
end $$;

create function customer_api.list_workspace_owner_link_requests_v1(p_workspace uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_rows jsonb;
begin
  if coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'aal2_required' using errcode='42501'; end if;
  if not exists(select 1 from platform.owner_unit_links l where l.workspace_id=p_workspace
    and app_private.owner_link_manager_v1(p_workspace,l.canonical_unit_id)) then
    return '[]'::jsonb;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'owner_user_id',l.owner_user_id,
    'canonical_unit_id',l.canonical_unit_id,'evidence_reference',l.evidence_reference,'status',l.status,'requested_at',l.requested_at)
    order by l.requested_at desc),'[]'::jsonb) into v_rows
  from platform.owner_unit_links l where l.workspace_id=p_workspace and l.status in ('requested','manager_verified')
    and app_private.owner_link_manager_v1(p_workspace,l.canonical_unit_id);
  return v_rows;
end $$;

create function customer_api.manager_verify_owner_unit_link_v1(p_link uuid,p_party uuid,p_evidence text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_link platform.owner_unit_links; v_tenant uuid;
begin
  if coalesce(auth.jwt()->>'aal','')<>'aal2' or length(btrim(coalesce(p_evidence,'')))<15 then
    raise exception 'verification_required' using errcode='42501';
  end if;
  select * into v_link from platform.owner_unit_links where id=p_link for update;
  if not found or v_link.status<>'requested' or v_link.owner_user_id=auth.uid()
    or not app_private.owner_link_manager_v1(v_link.workspace_id,v_link.canonical_unit_id) then
    raise exception 'verification_denied' using errcode='42501';
  end if;
  select tenant_id into v_tenant from platform.customer_workspaces where id=v_link.workspace_id;
  if not exists(select 1 from portfolio.ownerships o where o.tenant_id=v_tenant and o.unit_id=v_link.canonical_unit_id
    and o.party_id=p_party and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>current_date)) then
    raise exception 'ownership_not_recorded' using errcode='42501';
  end if;
  update platform.owner_unit_links set status='manager_verified',ownership_party_id=p_party,
    manager_verified_by=auth.uid(),manager_verified_at=statement_timestamp(),manager_evidence=btrim(p_evidence)
    where id=p_link;
  return true;
end $$;

create function customer_api.approve_owner_unit_link_v1(p_link uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_link platform.owner_unit_links; v_tenant uuid;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') or length(btrim(coalesce(p_reason,'')))<15 then
    raise exception 'approval_denied' using errcode='42501';
  end if;
  select * into v_link from platform.owner_unit_links where id=p_link for update;
  if not found or v_link.status<>'manager_verified' or v_link.manager_verified_by=auth.uid() then
    raise exception 'independent_review_required' using errcode='42501';
  end if;
  select tenant_id into v_tenant from platform.customer_workspaces where id=v_link.workspace_id and lifecycle_status='ACTIVE';
  if v_tenant is null or not exists(select 1 from portfolio.ownerships o where o.tenant_id=v_tenant and o.unit_id=v_link.canonical_unit_id
      and o.party_id=v_link.ownership_party_id and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>current_date))
    or not exists(select 1 from platform.owner_portfolio_pilots p join identity.memberships m on m.id=p.membership_id
      where p.owner_user_id=v_link.owner_user_id and p.revoked_at is null and p.expires_at>statement_timestamp()
        and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
        and exists (select 1 from platform.customer_cases c join platform.customer_case_participants cp
          on cp.case_id=c.id and cp.auth_user_id=p.owner_user_id
          join auth.users au on au.id=p.owner_user_id
          where c.id=p.case_id and c.status='open' and cp.status='active' and au.email_confirmed_at is not null)) then
    raise exception 'owner_access_or_ownership_expired' using errcode='42501';
  end if;
  update platform.owner_unit_links set status='linked',approved_by=auth.uid(),approved_at=statement_timestamp(),approval_reason=btrim(p_reason)
    where id=p_link;
  return true;
end $$;

create function customer_api.list_platform_owner_unit_links_v1()
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_rows jsonb;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then
    raise exception 'platform_access_required' using errcode='42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'workspace_id',l.workspace_id,
    'canonical_unit_id',l.canonical_unit_id,'owner_user_id',l.owner_user_id,
    'ownership_party_id',l.ownership_party_id,'manager_evidence',l.manager_evidence,
    'evidence_reference',l.evidence_reference,'requested_at',l.requested_at)
    order by l.requested_at desc),'[]'::jsonb) into v_rows
  from platform.owner_unit_links l where l.status='manager_verified';
  return v_rows;
end $$;
revoke all on function customer_api.list_platform_owner_unit_links_v1() from public;
grant execute on function customer_api.list_platform_owner_unit_links_v1() to authenticated;

create function customer_api.withdraw_owner_unit_link_v1(p_link uuid)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
begin
  if not app_private.has_multi_unit_owner_role_v1() then raise exception 'owner_role_required' using errcode='42501'; end if;
  update platform.owner_unit_links set status='withdrawn'
    where id=p_link and owner_user_id=auth.uid() and status in ('requested','manager_verified','linked');
  if not found then raise exception 'link_unavailable' using errcode='42501'; end if;
  return true;
end $$;
revoke all on function customer_api.withdraw_owner_unit_link_v1(uuid) from public;
grant execute on function customer_api.withdraw_owner_unit_link_v1(uuid) to authenticated;

revoke all on function customer_api.request_owner_unit_link_v1(uuid,uuid,uuid,text),
  customer_api.list_my_owner_unit_links_v1(),customer_api.list_workspace_owner_link_requests_v1(uuid),
  customer_api.manager_verify_owner_unit_link_v1(uuid,uuid,text),customer_api.approve_owner_unit_link_v1(uuid,text) from public;
grant execute on function customer_api.request_owner_unit_link_v1(uuid,uuid,uuid,text),
  customer_api.list_my_owner_unit_links_v1(),customer_api.list_workspace_owner_link_requests_v1(uuid),
  customer_api.manager_verify_owner_unit_link_v1(uuid,uuid,text),customer_api.approve_owner_unit_link_v1(uuid,text) to authenticated;

commit;
