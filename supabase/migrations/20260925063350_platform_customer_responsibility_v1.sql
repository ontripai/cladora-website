begin;

-- Responsibilities describe accountable work. They never grant Customer Data Plane access.
create table platform.customer_staff_responsibilities (
  id uuid primary key default gen_random_uuid(),
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  platform_user_id uuid not null references platform.platform_users(id) on delete restrict,
  responsibility text not null check (responsibility in
    ('commercial_owner','sales_collaborator','contract_reviewer','finance_reviewer','onboarding_trainer','technical_contact')),
  status text not null default 'active' check (status in ('active','revoked')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_until timestamptz,
  assigned_by uuid not null references auth.users(id) on delete restrict,
  assignment_reason text not null check (length(btrim(assignment_reason)) between 8 and 500),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  revoke_reason text,
  created_at timestamptz not null default statement_timestamp(),
  check (valid_until is null or valid_until > valid_from),
  check (responsibility<>'commercial_owner' or valid_until is null),
  check ((status='active' and revoked_at is null and revoked_by is null)
    or (status='revoked' and revoked_at is not null and revoked_by is not null
      and length(btrim(revoke_reason)) between 8 and 500))
);
create unique index customer_staff_one_owner on platform.customer_staff_responsibilities(customer_workspace_id)
  where responsibility='commercial_owner' and status='active';
create index customer_staff_coverage on platform.customer_staff_responsibilities(platform_user_id,customer_workspace_id,responsibility)
  where status='active';
alter table platform.customer_staff_responsibilities enable row level security;
revoke all on platform.customer_staff_responsibilities from public,anon,authenticated;
grant select on platform.customer_staff_responsibilities to authenticated;
grant all on platform.customer_staff_responsibilities to service_role;
create policy customer_staff_read on platform.customer_staff_responsibilities for select to authenticated
  using (app_private.has_platform_aal2() and
    (app_private.has_platform_role('PLATFORM_SUPER_ADMIN') or platform_user_id=app_private.current_platform_user_id()));
create policy customer_staff_service on platform.customer_staff_responsibilities for all to service_role
  using (true) with check (true);

create or replace function platform.assign_customer_staff_responsibility(
  p_workspace_id uuid,p_platform_user_id uuid,p_responsibility text,p_reason text,
  p_valid_until timestamptz default null)
returns platform.customer_staff_responsibilities language plpgsql security definer set search_path=''
as $$
declare v_row platform.customer_staff_responsibilities; v_role platform.platform_role_type;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','')<>'aal2'
     or not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if p_responsibility not in ('commercial_owner','sales_collaborator','contract_reviewer',
      'finance_reviewer','onboarding_trainer','technical_contact') or p_responsibility is null then
    raise exception 'invalid_responsibility' using errcode='22023';
  end if;
  if length(pg_catalog.btrim(coalesce(p_reason,''))) not between 8 and 500
    or (p_valid_until is not null and p_valid_until<=pg_catalog.statement_timestamp()) then
    raise exception 'invalid_assignment' using errcode='22023';
  end if;
  if not exists(select 1 from platform.customer_workspaces where id=p_workspace_id) then
    raise exception 'workspace_not_found' using errcode='P0002';
  end if;
  select case when p_responsibility='finance_reviewer' then 'PLATFORM_FINANCE'
      when p_responsibility='technical_contact' then 'PLATFORM_SUPPORT'
      when p_responsibility='contract_reviewer' then 'PLATFORM_CONTRACTS'
      when p_responsibility='onboarding_trainer' then 'PLATFORM_ONBOARDING'
      else 'PLATFORM_SALES' end::platform.platform_role_type into v_role;
  if not exists(select 1 from platform.platform_users u
    join platform.platform_role_assignments r on r.platform_user_id=u.id
    where u.id=p_platform_user_id and u.status='active' and u.deactivated_at is null
      and r.role=v_role and r.status='active' and r.valid_from<=pg_catalog.statement_timestamp()
      and (r.valid_until is null or r.valid_until>pg_catalog.statement_timestamp())) then
    raise exception 'staff_role_required' using errcode='42501';
  end if;
  -- Advisory transaction lock serializes owner transfer and assignment for this workspace.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text, 53));
  if p_responsibility='commercial_owner' and exists(select 1 from platform.customer_staff_responsibilities
    where customer_workspace_id=p_workspace_id and responsibility='commercial_owner' and status='active') then
    raise exception 'owner_transfer_required' using errcode='23505';
  end if;
  if exists(select 1 from platform.customer_staff_responsibilities
    where customer_workspace_id=p_workspace_id and platform_user_id=p_platform_user_id
      and responsibility=p_responsibility and status='active') then
    raise exception 'duplicate_responsibility' using errcode='23505';
  end if;
  insert into platform.customer_staff_responsibilities
    (customer_workspace_id,platform_user_id,responsibility,assigned_by,assignment_reason,valid_until)
    values(p_workspace_id,p_platform_user_id,p_responsibility,auth.uid(),pg_catalog.btrim(p_reason),p_valid_until)
    returning * into v_row;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason,occurred_at)
    values(auth.uid(),'PLATFORM_CONTROL_PLANE','CUSTOMER_STAFF_ASSIGNED','customer_staff_responsibility',
      v_row.id,pg_catalog.jsonb_build_object('workspace_id',p_workspace_id,'platform_user_id',p_platform_user_id,
        'responsibility',p_responsibility,'valid_until',p_valid_until),pg_catalog.btrim(p_reason),pg_catalog.statement_timestamp());
  return v_row;
end $$;
revoke all on function platform.assign_customer_staff_responsibility(uuid,uuid,text,text,timestamptz) from public,anon;
grant execute on function platform.assign_customer_staff_responsibility(uuid,uuid,text,text,timestamptz) to authenticated;

create or replace function platform.revoke_customer_staff_responsibility(p_id uuid,p_reason text)
returns platform.customer_staff_responsibilities language plpgsql security definer set search_path=''
as $$
declare v_row platform.customer_staff_responsibilities;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','')<>'aal2'
    or not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then
    raise exception 'access_denied' using errcode='42501'; end if;
  if length(pg_catalog.btrim(coalesce(p_reason,''))) not between 8 and 500 then
    raise exception 'invalid_reason' using errcode='22023'; end if;
  select * into v_row from platform.customer_staff_responsibilities where id=p_id and status='active' for update;
  if not found then raise exception 'assignment_not_found' using errcode='P0002'; end if;
  update platform.customer_staff_responsibilities set status='revoked',revoked_at=pg_catalog.statement_timestamp(),
    revoked_by=auth.uid(),revoke_reason=pg_catalog.btrim(p_reason) where id=p_id returning * into v_row;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,before_snapshot,after_snapshot,reason,occurred_at)
    values(auth.uid(),'PLATFORM_CONTROL_PLANE','CUSTOMER_STAFF_REVOKED','customer_staff_responsibility',v_row.id,
      pg_catalog.jsonb_build_object('status','active'),pg_catalog.jsonb_build_object('status','revoked'),
      pg_catalog.btrim(p_reason),pg_catalog.statement_timestamp());
  return v_row;
end $$;
revoke all on function platform.revoke_customer_staff_responsibility(uuid,text) from public,anon;
grant execute on function platform.revoke_customer_staff_responsibility(uuid,text) to authenticated;

-- Transfer is atomic; the previous owner remains in the immutable audit history.
create or replace function platform.transfer_customer_commercial_owner(p_workspace_id uuid,p_new_user_id uuid,p_reason text)
returns platform.customer_staff_responsibilities language plpgsql security definer set search_path=''
as $$
declare v_old platform.customer_staff_responsibilities; v_new platform.customer_staff_responsibilities;
begin
  if auth.uid() is null or coalesce(auth.jwt()->>'aal','')<>'aal2'
    or not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then
    raise exception 'access_denied' using errcode='42501'; end if;
  if length(pg_catalog.btrim(coalesce(p_reason,''))) not between 8 and 500 then
    raise exception 'invalid_reason' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text, 53));
  select * into v_old from platform.customer_staff_responsibilities
    where customer_workspace_id=p_workspace_id and responsibility='commercial_owner' and status='active' for update;
  if not found then raise exception 'owner_not_found' using errcode='P0002'; end if;
  if v_old.platform_user_id=p_new_user_id then raise exception 'same_owner' using errcode='22023'; end if;
  perform platform.revoke_customer_staff_responsibility(v_old.id,p_reason);
  v_new:=platform.assign_customer_staff_responsibility(p_workspace_id,p_new_user_id,'commercial_owner',p_reason,null);
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,before_snapshot,after_snapshot,reason,occurred_at)
    values(auth.uid(),'PLATFORM_CONTROL_PLANE','COMMERCIAL_OWNER_TRANSFERRED','customer_workspace',p_workspace_id,
      pg_catalog.jsonb_build_object('owner_id',v_old.platform_user_id),
      pg_catalog.jsonb_build_object('owner_id',p_new_user_id),pg_catalog.btrim(p_reason),pg_catalog.statement_timestamp());
  return v_new;
end $$;
revoke all on function platform.transfer_customer_commercial_owner(uuid,uuid,text) from public,anon;
grant execute on function platform.transfer_customer_commercial_owner(uuid,uuid,text) to authenticated;

create view customer_api.customer_staff_responsibilities_v1 with (security_invoker=true)
  as select * from platform.customer_staff_responsibilities;
revoke all on customer_api.customer_staff_responsibilities_v1 from public,anon,service_role;
grant select on customer_api.customer_staff_responsibilities_v1 to authenticated;
create function customer_api.assign_customer_staff_responsibility_v1(p_workspace_id uuid,p_platform_user_id uuid,
  p_responsibility text,p_reason text,p_valid_until timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin perform app_private.assert_control_plane_gateway_access_v1();
  return to_jsonb(platform.assign_customer_staff_responsibility(p_workspace_id,p_platform_user_id,p_responsibility,p_reason,p_valid_until)); end $$;
create function customer_api.revoke_customer_staff_responsibility_v1(p_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin perform app_private.assert_control_plane_gateway_access_v1();
  return to_jsonb(platform.revoke_customer_staff_responsibility(p_id,p_reason)); end $$;
create function customer_api.transfer_customer_commercial_owner_v1(p_workspace_id uuid,p_new_user_id uuid,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
begin perform app_private.assert_control_plane_gateway_access_v1();
  return to_jsonb(platform.transfer_customer_commercial_owner(p_workspace_id,p_new_user_id,p_reason)); end $$;
revoke all on function customer_api.assign_customer_staff_responsibility_v1(uuid,uuid,text,text,timestamptz),
  customer_api.revoke_customer_staff_responsibility_v1(uuid,text),
  customer_api.transfer_customer_commercial_owner_v1(uuid,uuid,text) from public,anon,service_role;
grant execute on function customer_api.assign_customer_staff_responsibility_v1(uuid,uuid,text,text,timestamptz),
  customer_api.revoke_customer_staff_responsibility_v1(uuid,text),
  customer_api.transfer_customer_commercial_owner_v1(uuid,uuid,text) to authenticated;

commit;
