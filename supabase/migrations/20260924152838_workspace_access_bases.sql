begin;

-- A prepared basis is a recorded decision, never an Auth invitation or membership.
-- The paid basis records a manually checked subscription receipt, separate from
-- resident payments in payments.payments.
create table platform.workspace_access_bases (
  id uuid primary key default gen_random_uuid(),
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  normalized_email text not null,
  role_id uuid not null references identity.roles(id) on delete restrict,
  mode text not null check (mode in ('PILOT','PAID')),
  status text not null default 'prepared' check (status in ('prepared','active','revoked')),
  duration_hours integer,
  contract_id uuid references platform.workspace_contracts(id) on delete restrict,
  payment_reference text,
  payment_amount numeric(20,4),
  payment_currency text,
  paid_on date,
  paid_through date,
  evidence_note text not null,
  approved_by uuid not null references auth.users(id) on delete restrict,
  approved_at timestamptz not null default statement_timestamp(),
  activated_at timestamptz,
  expires_at timestamptz,
  membership_id uuid references identity.memberships(id) on delete restrict,
  context_grant_id uuid references identity.context_grants(id) on delete restrict,
  revoked_by uuid references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoke_reason text,
  check (normalized_email = lower(btrim(normalized_email)) and normalized_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  check (
    (mode = 'PILOT' and duration_hours in (24,48,72) and contract_id is null
      and payment_reference is null and payment_amount is null and payment_currency is null
      and paid_on is null and paid_through is null)
    or
    (mode = 'PAID' and duration_hours is null and contract_id is not null
      and length(btrim(payment_reference)) >= 3 and payment_amount > 0
      and payment_currency in ('EUR','RON','USD') and paid_on is not null and paid_through is not null)
  ),
  check (
    (status = 'prepared' and activated_at is null and expires_at is null
      and membership_id is null and context_grant_id is null and revoked_at is null)
    or (status = 'active' and activated_at is not null and expires_at > activated_at
      and membership_id is not null and context_grant_id is not null and revoked_at is null)
    or (status = 'revoked' and (revoked_by is not null or revoke_reason='Contract is no longer active') and revoked_at is not null
      and length(btrim(revoke_reason)) >= 3)
  )
);
create unique index workspace_access_bases_open_email
  on platform.workspace_access_bases(customer_workspace_id, normalized_email)
  where status in ('prepared','active');
create unique index workspace_access_bases_payment_reference
  on platform.workspace_access_bases(payment_currency, payment_reference)
  where mode='PAID' and status in ('prepared','active');
create index workspace_access_bases_expiry on platform.workspace_access_bases(expires_at)
  where status = 'active';
alter table platform.workspace_access_bases enable row level security;
revoke all on platform.workspace_access_bases from public, anon, authenticated;
grant all on platform.workspace_access_bases to service_role;

-- Existing tenants with established members must be reviewed before a new
-- commercial policy controls their memberships. This slice is for new tenants.
create or replace function platform.cap_customer_membership_to_access_basis()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_end timestamptz; v_now timestamptz:=pg_catalog.statement_timestamp(); v_prepared record;
begin
  if new.status<>'active' or not exists(
    select 1 from platform.workspace_access_bases b
    join platform.customer_workspaces w on w.id=b.customer_workspace_id
    where w.tenant_id=new.tenant_id
  ) then return new; end if;
  select max(b.expires_at) into v_end from platform.workspace_access_bases b
  join platform.customer_workspaces w on w.id=b.customer_workspace_id
  where w.tenant_id=new.tenant_id and b.status='active' and b.expires_at>v_now;
  if v_end is null then
    -- The initial primary-admin activation is the only permitted membership
    -- while the decision is prepared. It must already carry a bounded expiry.
    select b.* into v_prepared from platform.workspace_access_bases b
    join platform.customer_workspaces w on w.id=b.customer_workspace_id
    join auth.users u on pg_catalog.lower(pg_catalog.btrim(u.email))=b.normalized_email
    where w.tenant_id=new.tenant_id and w.lifecycle_status='PROVISIONING'
      and b.status='prepared' and b.approved_at+interval '7 days'>v_now
      and u.id=new.user_id and new.user_id=auth.uid()
      and coalesce(auth.jwt()->>'aal','')='aal2'
      and (b.mode='PILOT' or exists(select 1 from platform.workspace_contracts c
        where c.id=b.contract_id and c.status='active' and c.signed_at is not null
          and b.paid_through>=(v_now at time zone 'Europe/Bucharest')::date))
      and b.role_id=new.role_id and u.email_confirmed_at is not null
    limit 1;
    if not found then raise exception 'commercial_access_basis_required' using errcode='42501'; end if;
    if new.ends_at is null
      or new.ends_at > case when v_prepared.mode='PILOT'
        then v_now+pg_catalog.make_interval(hours=>v_prepared.duration_hours)
        else (v_prepared.paid_through+1)::timestamp at time zone 'Europe/Bucharest' end
      or new.ends_at<=v_now then
      raise exception 'commercial_access_basis_required' using errcode='42501';
    end if;
    return new;
  end if;
  if new.ends_at is null or new.ends_at>v_end then new.ends_at:=v_end; end if;
  if new.ends_at<=v_now then raise exception 'commercial_access_expired' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function platform.cap_customer_membership_to_access_basis() from public,anon,authenticated,service_role;
create trigger cap_customer_membership_to_access_basis
before insert or update on identity.memberships
for each row execute function platform.cap_customer_membership_to_access_basis();

create or replace function platform.cap_customer_context_to_membership()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_end timestamptz; v_tenant uuid;
begin
  select m.ends_at,m.tenant_id into v_end,v_tenant from identity.memberships m where m.id=new.membership_id;
  if v_tenant is null or v_tenant<>new.tenant_id then
    raise exception 'context_membership_tenant_mismatch' using errcode='42501';
  end if;
  if v_end is not null and (new.ends_at is null or new.ends_at>v_end) then new.ends_at:=v_end; end if;
  return new;
end;
$$;
revoke all on function platform.cap_customer_context_to_membership() from public,anon,authenticated,service_role;
create trigger cap_customer_context_to_membership
before insert or update on identity.context_grants
for each row execute function platform.cap_customer_context_to_membership();

create or replace function platform.require_workspace_access_basis_for_provisioning()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.lifecycle_status='PROVISIONING' and old.lifecycle_status<>'PROVISIONING'
    and not exists (
      select 1 from platform.workspace_access_bases b
      left join platform.workspace_contracts c on c.id=b.contract_id
      where b.customer_workspace_id=new.id
        and ((b.status='prepared' and b.approved_at+interval '7 days'>pg_catalog.statement_timestamp())
          or (b.status='active' and b.expires_at>pg_catalog.statement_timestamp()))
        and ((b.mode='PILOT' and new.environment='PILOT')
          or (b.mode='PAID' and c.status='active' and c.signed_at is not null
            and b.paid_through>=(pg_catalog.statement_timestamp() at time zone 'Europe/Bucharest')::date))
    ) then
    raise exception 'prepared_commercial_or_pilot_basis_required' using errcode='55000';
  end if;
  return new;
end;
$$;
revoke all on function platform.require_workspace_access_basis_for_provisioning() from public,anon,authenticated,service_role;
create trigger require_workspace_access_basis_for_provisioning
before update of lifecycle_status on platform.customer_workspaces
for each row execute function platform.require_workspace_access_basis_for_provisioning();

-- A pilot basis must never be converted into an email invitation or into an
-- unbounded membership by the legacy invitation delivery flow.
create or replace function platform.block_pilot_email_invitation()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if exists(select 1 from platform.workspace_access_bases b
    where b.customer_workspace_id=new.customer_workspace_id and b.mode='PILOT')
    and not exists(select 1 from platform.workspace_access_bases b
      where b.customer_workspace_id=new.customer_workspace_id and b.mode='PAID'
        and b.status='active' and b.expires_at>pg_catalog.statement_timestamp()) then
    raise exception 'pilot_access_uses_no_email_route' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function platform.block_pilot_email_invitation() from public,anon,authenticated,service_role;
create trigger block_pilot_email_invitation
before insert on platform.workspace_invitations
for each row execute function platform.block_pilot_email_invitation();

create or replace function platform.prepare_workspace_access_basis(
  p_workspace_id uuid, p_email text, p_role_id uuid, p_mode text,
  p_duration_hours integer, p_contract_id uuid, p_payment_reference text,
  p_payment_amount numeric, p_payment_currency text, p_paid_on date,
  p_paid_through date, p_evidence_note text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_ws platform.customer_workspaces;
  v_role identity.roles;
  v_contract platform.workspace_contracts;
  v_basis platform.workspace_access_bases;
  v_email text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_email,'')));
begin
  if v_actor is null or not app_private.has_platform_aal2()
     or not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or pg_catalog.length(v_email) > 320
     or pg_catalog.length(pg_catalog.btrim(coalesce(p_evidence_note,''))) < 15
     or pg_catalog.length(p_evidence_note) > 500 then
    raise exception 'invalid_access_basis' using errcode='22023';
  end if;
  select * into v_ws from platform.customer_workspaces where id=p_workspace_id for update;
  if not found or v_ws.lifecycle_status not in
    ('LEAD','UNDER_REVIEW','APPROVED','CONTRACT_PENDING','PAYMENT_PENDING','PROVISIONING') then
    raise exception 'workspace_unavailable' using errcode='22023';
  end if;
  if p_mode='PILOT' and exists(
    select 1 from identity.memberships m where m.tenant_id=v_ws.tenant_id
      and m.status='active' and m.starts_at<=v_now and (m.ends_at is null or m.ends_at>v_now)
  ) then
    raise exception 'existing_memberships_require_review' using errcode='42501';
  end if;
  select * into v_role from identity.roles where id=p_role_id;
  if not found or v_role.tenant_id is not null
     or v_role.code <> case when v_ws.workspace_type='PROPERTY_MANAGER' then 'property_manager' else 'association_admin' end then
    raise exception 'primary_admin_role_mismatch' using errcode='22023';
  end if;
  if p_mode='PILOT' then
    if v_ws.environment <> 'PILOT' or p_duration_hours not in (24,48,72)
      or p_contract_id is not null or p_payment_reference is not null
      or p_payment_amount is not null or p_payment_currency is not null
      or p_paid_on is not null or p_paid_through is not null then
      raise exception 'invalid_pilot_basis' using errcode='22023';
    end if;
  elsif p_mode='PAID' then
    if p_duration_hours is not null or p_payment_amount <= 0
       or p_paid_on is null or p_paid_on > current_date
       or p_paid_through is null or p_paid_through < (v_now at time zone 'Europe/Bucharest')::date
       or pg_catalog.length(pg_catalog.btrim(coalesce(p_payment_reference,''))) < 3 then
      raise exception 'invalid_paid_basis' using errcode='22023';
    end if;
    select * into v_contract from platform.workspace_contracts
      where id=p_contract_id and customer_workspace_id=p_workspace_id
      and status='active' and signed_at is not null and plan_id is not null
      and start_date <= current_date and (end_date is null or end_date >= p_paid_through)
      for update;
    if not found or v_contract.currency <> p_payment_currency or p_paid_on < v_contract.start_date then
      raise exception 'active_signed_contract_and_payment_required' using errcode='22023';
    end if;
  else
    raise exception 'invalid_access_mode' using errcode='22023';
  end if;
  insert into platform.workspace_access_bases(
    customer_workspace_id, normalized_email, role_id, mode, duration_hours,
    contract_id, payment_reference, payment_amount, payment_currency,
    paid_on, paid_through, evidence_note, approved_by)
  values (p_workspace_id,v_email,p_role_id,p_mode,p_duration_hours,p_contract_id,
    nullif(pg_catalog.btrim(p_payment_reference),''),
    p_payment_amount,p_payment_currency,p_paid_on,p_paid_through,
    pg_catalog.btrim(p_evidence_note),v_actor)
  returning * into v_basis;
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot,occurred_at)
  values(v_ws.tenant_id,v_actor,'PLATFORM_CONTROL_PLANE','WORKSPACE_ACCESS_BASIS_PREPARED',
    'workspace_access_basis',v_basis.id,v_basis.evidence_note,
    pg_catalog.jsonb_build_object('workspace_id',p_workspace_id,'mode',p_mode,
      'role_id',p_role_id,'duration_hours',p_duration_hours,'contract_id',p_contract_id,
      'payment_reference',p_payment_reference,'paid_through',p_paid_through),v_now);
  return pg_catalog.jsonb_build_object('id',v_basis.id,'status','prepared','mode',p_mode,
    'email',v_email,'preparation_expires_at',v_now + interval '7 days',
    'email_sent',false,'access_active',false);
end;
$$;
revoke all on function platform.prepare_workspace_access_basis(uuid,text,uuid,text,integer,uuid,text,numeric,text,date,date,text) from public,anon,service_role;
grant execute on function platform.prepare_workspace_access_basis(uuid,text,uuid,text,integer,uuid,text,numeric,text,date,date,text) to authenticated;

create or replace function platform.list_workspace_access_bases(p_workspace_id uuid)
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not app_private.has_platform_aal2()
    or not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then
    raise exception 'access_denied' using errcode='42501';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',b.id,'email',b.normalized_email,'mode',b.mode,
    'status',case when b.status='active' and b.expires_at<=pg_catalog.statement_timestamp() then 'expired'
                  when b.status='prepared' and b.approved_at+interval '7 days'<=pg_catalog.statement_timestamp() then 'expired'
                  else b.status end,
    'duration_hours',b.duration_hours,'approved_at',b.approved_at,
    'activated_at',b.activated_at,'expires_at',b.expires_at,
    'paid_through',b.paid_through,'contract_id',b.contract_id)
    order by b.approved_at desc),'[]'::jsonb) into v_result
  from platform.workspace_access_bases b where b.customer_workspace_id=p_workspace_id;
  return v_result;
end;
$$;
revoke all on function platform.list_workspace_access_bases(uuid) from public,anon,service_role;
grant execute on function platform.list_workspace_access_bases(uuid) to authenticated;

create or replace function platform.list_my_prepared_workspace_access()
returns jsonb language plpgsql stable security definer set search_path = ''
as $$
declare v_email text; v_rows jsonb;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','') <> 'aal2' then
    raise exception 'mfa_required' using errcode='42501';
  end if;
  select pg_catalog.lower(pg_catalog.btrim(email)) into v_email
  from auth.users where id=auth.uid() and email_confirmed_at is not null;
  if v_email is null then raise exception 'verified_identity_required' using errcode='42501'; end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',b.id,'workspace_id',w.id,'mode',b.mode,'role_code',r.code,
    'duration_hours',b.duration_hours,'preparation_expires_at',b.approved_at+interval '7 days')
    order by b.approved_at desc),'[]'::jsonb) into v_rows
  from platform.workspace_access_bases b
  join platform.customer_workspaces w on w.id=b.customer_workspace_id
  join identity.roles r on r.id=b.role_id
  where b.normalized_email=v_email and b.status='prepared'
    and b.approved_at+interval '7 days'>pg_catalog.statement_timestamp()
    and w.lifecycle_status='PROVISIONING';
  return v_rows;
end;
$$;
revoke all on function platform.list_my_prepared_workspace_access() from public,anon,service_role;
grant execute on function platform.list_my_prepared_workspace_access() to authenticated;

create or replace function platform.activate_prepared_workspace_access(
  p_basis_id uuid, p_display_name text, p_locale text
) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := pg_catalog.statement_timestamp();
  v_email text;
  v_basis platform.workspace_access_bases;
  v_ws platform.customer_workspaces;
  v_contract platform.workspace_contracts;
  v_end timestamptz;
  v_membership uuid;
  v_grant uuid;
begin
  if v_actor is null or coalesce(auth.jwt()->>'aal','') <> 'aal2'
    or pg_catalog.length(pg_catalog.btrim(coalesce(p_display_name,''))) not between 2 and 120
    or p_locale not in ('ro','en','fa') then
    raise exception 'verified_aal2_session_required' using errcode='42501';
  end if;
  select pg_catalog.lower(pg_catalog.btrim(email)) into v_email from auth.users
    where id=v_actor and email_confirmed_at is not null;
  if v_email is null then raise exception 'verified_identity_required' using errcode='42501'; end if;
  select * into v_basis from platform.workspace_access_bases where id=p_basis_id for update;
  if not found or v_basis.status<>'prepared' or v_basis.normalized_email<>v_email
    or v_basis.approved_at+interval '7 days' <= v_now then
    raise exception 'access_preparation_unavailable' using errcode='42501';
  end if;
  select * into v_ws from platform.customer_workspaces
    where id=v_basis.customer_workspace_id for update;
  if not found or v_ws.lifecycle_status<>'PROVISIONING'
    or (v_ws.primary_admin_user_id is not null and v_ws.primary_admin_user_id<>v_actor) then
    raise exception 'workspace_not_available_for_access' using errcode='55000';
  end if;
  if v_basis.mode='PILOT' then
    if v_ws.environment<>'PILOT' then raise exception 'pilot_environment_required' using errcode='42501'; end if;
    v_end:=v_now + pg_catalog.make_interval(hours=>v_basis.duration_hours);
  else
    select * into v_contract from platform.workspace_contracts
      where id=v_basis.contract_id and customer_workspace_id=v_ws.id
        and status='active' and signed_at is not null
        and start_date<=current_date and (end_date is null or end_date>=v_basis.paid_through);
    if not found or v_basis.paid_through<(v_now at time zone 'Europe/Bucharest')::date then
      raise exception 'paid_basis_expired' using errcode='55000';
    end if;
    v_end := (v_basis.paid_through+1)::timestamp at time zone 'Europe/Bucharest';
  end if;
  if exists (select 1 from identity.memberships m
     where m.tenant_id=v_ws.tenant_id and m.user_id=v_actor and m.role_id=v_basis.role_id
       and m.status in ('invited','active')) then
    raise exception 'existing_membership_requires_review' using errcode='23505';
  end if;
  insert into identity.profiles(user_id,display_name,locale)
    values(v_actor,pg_catalog.btrim(p_display_name),p_locale)
    on conflict(user_id) do nothing;
  insert into identity.memberships(tenant_id,user_id,role_id,status,starts_at,ends_at)
    values(v_ws.tenant_id,v_actor,v_basis.role_id,'active',v_now,v_end) returning id into v_membership;
  insert into identity.context_grants(membership_id,tenant_id,scope_type,starts_at,ends_at)
    values(v_membership,v_ws.tenant_id,'tenant',v_now,v_end) returning id into v_grant;
  update platform.workspace_access_bases
    set status='active',activated_at=v_now,expires_at=v_end,
      membership_id=v_membership,context_grant_id=v_grant where id=v_basis.id;
  if v_ws.primary_admin_user_id is null or v_ws.primary_admin_user_id=v_actor then
    update platform.customer_workspaces
      set primary_admin_user_id=v_actor,primary_admin_membership_id=v_membership,
          primary_admin_accepted_at=v_now,version=version+1,updated_at=v_now
      where id=v_ws.id;
  end if;
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot,occurred_at)
    values(v_ws.tenant_id,v_actor,'CUSTOMER_PRIMARY_ADMIN','WORKSPACE_ACCESS_BASIS_ACTIVATED',
      'workspace_access_basis',v_basis.id,'Verified account activated a prepared access basis',
      pg_catalog.jsonb_build_object('mode',v_basis.mode,'membership_id',v_membership,
        'expires_at',v_end),v_now);
  return pg_catalog.jsonb_build_object('workspace_id',v_ws.id,'membership_id',v_membership,
    'mode',v_basis.mode,'expires_at',v_end);
end;
$$;
revoke all on function platform.activate_prepared_workspace_access(uuid,text,text) from public,anon,service_role;
grant execute on function platform.activate_prepared_workspace_access(uuid,text,text) to authenticated;

create or replace function platform.revoke_workspace_access_basis(p_basis_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_basis platform.workspace_access_bases; v_now timestamptz:=pg_catalog.statement_timestamp(); v_tenant uuid;
begin
  if auth.uid() is null or not app_private.has_platform_aal2()
     or not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if pg_catalog.length(pg_catalog.btrim(coalesce(p_reason,''))) < 3 then
    raise exception 'reason_required' using errcode='22023';
  end if;
  select * into v_basis from platform.workspace_access_bases where id=p_basis_id for update;
  if not found or v_basis.status='revoked' then raise exception 'basis_unavailable' using errcode='22023'; end if;
  if v_basis.membership_id is not null then
    update identity.memberships set status='revoked',
      ends_at=greatest(starts_at+interval '1 microsecond',v_now)
      where id=v_basis.membership_id;
    update identity.context_grants set ends_at=greatest(starts_at+interval '1 microsecond',v_now)
      where id=v_basis.context_grant_id;
  end if;
  update platform.workspace_access_bases set status='revoked',
      revoked_by=auth.uid(),revoked_at=v_now,revoke_reason=pg_catalog.btrim(p_reason)
    where id=p_basis_id;
  select tenant_id into v_tenant from platform.customer_workspaces where id=v_basis.customer_workspace_id;
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot,occurred_at)
    values(v_tenant,auth.uid(),'PLATFORM_CONTROL_PLANE','WORKSPACE_ACCESS_BASIS_REVOKED',
      'workspace_access_basis',p_basis_id,p_reason,
      pg_catalog.jsonb_build_object('membership_id',v_basis.membership_id,'revoked_at',v_now),v_now);
  return pg_catalog.jsonb_build_object('id',p_basis_id,'status','revoked');
end;
$$;
revoke all on function platform.revoke_workspace_access_basis(uuid,text) from public,anon,service_role;
grant execute on function platform.revoke_workspace_access_basis(uuid,text) to authenticated;

-- An early commercial suspension also ends paid access, even before paid_through.
create or replace function platform.stop_suspended_contract_access()
returns trigger language plpgsql security definer set search_path=''
as $$
declare v_basis platform.workspace_access_bases; v_now timestamptz:=pg_catalog.statement_timestamp(); v_tenant uuid;
begin
  if old.status='active' and new.status <> 'active' then
    select tenant_id into v_tenant from platform.customer_workspaces where id=new.customer_workspace_id;
    for v_basis in select * from platform.workspace_access_bases
      where contract_id=new.id and mode='PAID' and status='active' for update loop
      update identity.memberships set status='revoked',
        ends_at=greatest(starts_at+interval '1 microsecond',v_now) where id=v_basis.membership_id;
      update identity.context_grants set ends_at=greatest(starts_at+interval '1 microsecond',v_now)
        where id=v_basis.context_grant_id;
      update platform.workspace_access_bases set status='revoked',revoked_by=auth.uid(),
        revoked_at=v_now,revoke_reason='Contract is no longer active' where id=v_basis.id;
      insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,occurred_at)
        values(v_tenant,auth.uid(),'PLATFORM_CONTROL_PLANE','WORKSPACE_ACCESS_BASIS_REVOKED',
          'workspace_access_basis',v_basis.id,'Contract is no longer active',v_now);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function platform.stop_suspended_contract_access() from public,anon,authenticated,service_role;
create trigger workspace_contract_access_suspension
after update of status on platform.workspace_contracts
for each row execute function platform.stop_suspended_contract_access();

-- No exposed table or unrestricted direct-DML path; the gateway checks AAL2
-- and the underlying private RPCs also validate the caller.
create or replace function customer_api.prepare_workspace_access_basis_v1(
  p_workspace_id uuid,p_email text,p_role_id uuid,p_mode text,
  p_duration_hours integer,p_contract_id uuid,p_payment_reference text,
  p_payment_amount numeric,p_payment_currency text,p_paid_on date,
  p_paid_through date,p_evidence_note text
) returns jsonb language sql security invoker set search_path=''
as $$select platform.prepare_workspace_access_basis(p_workspace_id,p_email,p_role_id,p_mode,
  p_duration_hours,p_contract_id,p_payment_reference,p_payment_amount,p_payment_currency,
  p_paid_on,p_paid_through,p_evidence_note)$$;
create or replace function customer_api.list_workspace_access_bases_v1(p_workspace_id uuid)
returns jsonb language sql stable security invoker set search_path=''
as $$select platform.list_workspace_access_bases(p_workspace_id)$$;
create or replace function customer_api.list_my_prepared_workspace_access_v1()
returns jsonb language sql stable security invoker set search_path=''
as $$select platform.list_my_prepared_workspace_access()$$;
create or replace function customer_api.activate_prepared_workspace_access_v1(p_basis_id uuid,p_display_name text,p_locale text)
returns jsonb language sql security invoker set search_path=''
as $$select platform.activate_prepared_workspace_access(p_basis_id,p_display_name,p_locale)$$;
create or replace function customer_api.revoke_workspace_access_basis_v1(p_basis_id uuid,p_reason text)
returns jsonb language sql security invoker set search_path=''
as $$select platform.revoke_workspace_access_basis(p_basis_id,p_reason)$$;

revoke all on function customer_api.prepare_workspace_access_basis_v1(uuid,text,uuid,text,integer,uuid,text,numeric,text,date,date,text),
  customer_api.list_workspace_access_bases_v1(uuid),
  customer_api.list_my_prepared_workspace_access_v1(),
  customer_api.activate_prepared_workspace_access_v1(uuid,text,text),
  customer_api.revoke_workspace_access_basis_v1(uuid,text)
  from public,anon,service_role;
grant execute on function customer_api.prepare_workspace_access_basis_v1(uuid,text,uuid,text,integer,uuid,text,numeric,text,date,date,text),
  customer_api.list_workspace_access_bases_v1(uuid),
  customer_api.list_my_prepared_workspace_access_v1(),
  customer_api.activate_prepared_workspace_access_v1(uuid,text,text),
  customer_api.revoke_workspace_access_basis_v1(uuid,text) to authenticated;

commit;
