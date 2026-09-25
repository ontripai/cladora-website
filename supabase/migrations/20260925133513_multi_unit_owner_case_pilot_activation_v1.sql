begin;

-- A personal account is anchored to its own tenant. It has no context grants
-- into any building workspace; unit linking remains a separate approval.
create table platform.owner_portfolio_pilots (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references platform.customer_cases(id) on delete restrict,
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  tenant_id uuid not null unique references platform.tenants(id) on delete restrict,
  membership_id uuid not null unique references identity.memberships(id) on delete restrict,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approval_reason text not null check(length(btrim(approval_reason)) between 15 and 500),
  approved_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  revoked_by uuid references auth.users(id),
  revoked_at timestamptz,
  revoke_reason text,
  check(expires_at>approved_at),
  check((revoked_at is null and revoked_by is null and revoke_reason is null)
    or (revoked_at is not null and revoked_by is not null and length(btrim(revoke_reason))>=8))
);
alter table platform.owner_portfolio_pilots enable row level security;
revoke all on platform.owner_portfolio_pilots from public,anon,authenticated;
grant all on platform.owner_portfolio_pilots to service_role;

-- An identity membership alone does not unlock the private ledger. The
-- membership must be bound to a still-valid decision on a claimed case.
create or replace function app_private.has_multi_unit_owner_role_v1()
returns boolean language sql stable security definer
set search_path=pg_catalog as $$
  select auth.uid() is not null and (auth.jwt()->>'aal')='aal2'
    and exists (
      select 1 from platform.owner_portfolio_pilots p
      join identity.memberships m on m.id=p.membership_id and m.user_id=p.owner_user_id and m.tenant_id=p.tenant_id
      join identity.roles r on r.id=m.role_id
      join platform.tenants t on t.id=m.tenant_id
      join auth.users u on u.id=m.user_id
      join platform.customer_cases c on c.id=p.case_id
      join platform.customer_case_participants cp on cp.case_id=p.case_id and cp.auth_user_id=p.owner_user_id
      where p.owner_user_id=auth.uid() and p.revoked_at is null and p.expires_at>statement_timestamp()
        and c.status='open' and cp.status='active' and u.email_confirmed_at is not null
        and r.code='multi_unit_owner' and r.is_system and r.tenant_id is null
        and t.status='active' and m.status='active' and m.starts_at<=statement_timestamp()
        and (m.ends_at is null or m.ends_at>statement_timestamp())
    );
$$;
revoke all on function app_private.has_multi_unit_owner_role_v1() from public;
grant execute on function app_private.has_multi_unit_owner_role_v1() to authenticated,service_role;

create function customer_api.activate_owner_portfolio_pilot_v1(p_case_id uuid,p_hours integer,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_case platform.customer_cases; v_lead public.marketing_leads;
  v_user auth.users; v_tenant uuid; v_membership uuid; v_expiry timestamptz;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if p_hours not in (24,48,72) or length(btrim(coalesce(p_reason,''))) not between 15 and 500 then
    raise exception 'invalid_approval' using errcode='22023';
  end if;
  select * into v_case from platform.customer_cases where id=p_case_id for update;
  if not found or v_case.status<>'open' then raise exception 'case_unavailable' using errcode='P0002'; end if;
  select * into v_lead from public.marketing_leads where id=v_case.lead_id;
  if v_lead.lead_type<>'pilot' or v_lead.applicant_type<>'multi_unit_owner' or v_lead.status='spam' then
    raise exception 'incompatible_request' using errcode='22023';
  end if;
  if exists(select 1 from platform.owner_portfolio_pilots where case_id=p_case_id) then
    raise exception 'pilot_already_decided' using errcode='23505';
  end if;
  select u.* into v_user from auth.users u
    join platform.customer_case_participants cp on cp.auth_user_id=u.id
    where cp.case_id=p_case_id and cp.status='active'
      and lower(u.email)=v_case.customer_email and u.email_confirmed_at is not null
    order by cp.joined_at limit 1;
  if not found then raise exception 'verified_case_customer_required' using errcode='42501'; end if;
  v_expiry:=statement_timestamp()+make_interval(hours=>p_hours);
  insert into platform.tenants(legal_name,registration_number,status,default_locale)
    values(left('Owner portfolio · '||v_lead.full_name,255),'CLD-OWNER-'||replace(p_case_id::text,'-',''),'active',v_lead.locale)
    returning id into v_tenant;
  insert into identity.memberships(tenant_id,user_id,role_id,status,starts_at,ends_at)
    values(v_tenant,v_user.id,(select id from identity.roles where tenant_id is null and code='multi_unit_owner'),
      'active',statement_timestamp(),v_expiry) returning id into v_membership;
  insert into platform.owner_portfolio_pilots(case_id,owner_user_id,tenant_id,membership_id,approved_by,approval_reason,expires_at)
    values(p_case_id,v_user.id,v_tenant,v_membership,auth.uid(),btrim(p_reason),v_expiry);
  return jsonb_build_object('owner_user_id',v_user.id,'expires_at',v_expiry,'pilot',true);
end $$;

create function customer_api.revoke_owner_portfolio_pilot_v1(p_case_id uuid,p_reason text)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare v_pilot platform.owner_portfolio_pilots;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then raise exception 'access_denied' using errcode='42501'; end if;
  if length(btrim(coalesce(p_reason,'')))<8 then raise exception 'invalid_reason' using errcode='22023'; end if;
  select * into v_pilot from platform.owner_portfolio_pilots where case_id=p_case_id for update;
  if not found or v_pilot.revoked_at is not null then raise exception 'pilot_unavailable' using errcode='P0002'; end if;
  update platform.owner_portfolio_pilots set revoked_at=statement_timestamp(),revoked_by=auth.uid(),revoke_reason=btrim(p_reason)
    where id=v_pilot.id;
  update identity.memberships set status='revoked' where id=v_pilot.membership_id;
  return true;
end $$;

create function customer_api.owner_portfolio_pilot_status_v1(p_case_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_status jsonb;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then raise exception 'access_denied' using errcode='42501'; end if;
  select jsonb_build_object('eligible',c.status='open' and l.lead_type='pilot' and l.applicant_type='multi_unit_owner',
    'customer_claimed',exists(select 1 from platform.customer_case_participants cp join auth.users u on u.id=cp.auth_user_id
      where cp.case_id=c.id and cp.status='active' and u.email_confirmed_at is not null and lower(u.email)=c.customer_email),
    'expires_at',p.expires_at,'revoked_at',p.revoked_at)
  into v_status from platform.customer_cases c join public.marketing_leads l on l.id=c.lead_id
  left join platform.owner_portfolio_pilots p on p.case_id=c.id where c.id=p_case_id;
  return coalesce(v_status,'{}'::jsonb);
end $$;

revoke all on function customer_api.activate_owner_portfolio_pilot_v1(uuid,integer,text),
  customer_api.revoke_owner_portfolio_pilot_v1(uuid,text),
  customer_api.owner_portfolio_pilot_status_v1(uuid) from public;
grant execute on function customer_api.activate_owner_portfolio_pilot_v1(uuid,integer,text),
  customer_api.revoke_owner_portfolio_pilot_v1(uuid,text),
  customer_api.owner_portfolio_pilot_status_v1(uuid) to authenticated;

commit;
