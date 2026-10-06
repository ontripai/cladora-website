begin;

-- A delegated workspace role may not outlive its recipient, the assigning
-- manager, the role definition, or the property binding that anchors its scope.
-- When the manager has no end date, an omitted child end date remains open.
create or replace function app_private.cap_workspace_member_role_to_supervisor_validity_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, identity
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_target_end timestamptz;
  v_manager_end timestamptz;
  v_role_end timestamptz;
  v_property_end timestamptz;
  v_ceiling timestamptz;
begin
  select m.ends_at into v_target_end
  from identity.memberships m
  where m.id = new.membership_id and m.tenant_id = new.tenant_id
    and m.status = 'active' and m.starts_at <= v_now
    and (m.ends_at is null or m.ends_at > v_now);
  if not found then
    raise exception 'workspace_member_role_target_membership_invalid' using errcode = '42501';
  end if;

  select m.ends_at into v_manager_end
  from identity.memberships m
  where m.id = new.assigned_by_membership_id and m.tenant_id = new.tenant_id
    and m.user_id = new.assigned_by_user_id and m.status = 'active'
    and m.starts_at <= v_now and (m.ends_at is null or m.ends_at > v_now);
  if not found then
    raise exception 'workspace_role_assigning_manager_inactive' using errcode = '42501';
  end if;

  select r.valid_to into v_role_end
  from platform.workspace_roles r
  where r.id = new.workspace_role_id and r.customer_workspace_id = new.customer_workspace_id
    and r.lifecycle_status = 'published'
    and (r.valid_to is null or r.valid_to > v_now);
  if not found then
    raise exception 'workspace_role_not_published' using errcode = '42501';
  end if;

  select b.valid_to into v_property_end
  from platform.workspace_property_bindings b
  where b.customer_workspace_id = new.customer_workspace_id
    and b.tenant_id = new.tenant_id and b.property_id = new.property_id
    and b.status = 'active' and b.valid_from <= v_now
    and (b.valid_to is null or b.valid_to > v_now);

  select min(x.ends_at) into v_ceiling
  from (values (v_target_end), (v_manager_end), (v_role_end), (v_property_end)) as x(ends_at)
  where x.ends_at is not null;

  if new.valid_to is null then
    new.valid_to := v_ceiling;
  elsif v_ceiling is not null then
    new.valid_to := least(new.valid_to, v_ceiling);
  end if;

  if new.valid_to is not null and new.valid_to <= new.valid_from then
    raise exception 'workspace_member_role_validity_exhausted' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function app_private.cap_workspace_member_role_to_supervisor_validity_v1()
  from public, anon, authenticated, service_role;

create trigger trg_cap_workspace_member_role_supervisor_validity
before insert on platform.workspace_member_roles
for each row execute function app_private.cap_workspace_member_role_to_supervisor_validity_v1();

-- Shorten delegated role assignments when their assigning manager's own
-- membership ends or is shortened. The assignment remains as an accountability
-- record; only its validity end and reason change.
create or replace function app_private.revoke_workspace_member_roles_on_supervisor_end_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, audit
as $$
declare
  v_now timestamptz := statement_timestamp();
  v_end timestamptz;
  v_assignment platform.workspace_member_roles%rowtype;
  v_after platform.workspace_member_roles%rowtype;
begin
  if old.status = 'active' and (new.status <> 'active'
      or (new.ends_at is not null and (old.ends_at is null or new.ends_at < old.ends_at))) then
    v_end := case when new.status <> 'active' or new.ends_at <= v_now then v_now else new.ends_at end;
    for v_assignment in
      select * from platform.workspace_member_roles
      where assigned_by_membership_id = old.id
        and (valid_to is null or valid_to > v_end)
      for update
    loop
      update platform.workspace_member_roles
      set valid_to = greatest(v_end, valid_from + interval '1 microsecond'),
          lock_version = lock_version + 1,
          reason = left('Supervisor membership ended or shortened: ' || v_assignment.reason, 500)
      where id = v_assignment.id
      returning * into v_after;

      insert into audit.events (
        tenant_id, actor_id, actor_role, action, entity_type, entity_id,
        before_snapshot, after_snapshot, reason, occurred_at
      ) values (
        v_after.tenant_id, auth.uid(), 'SUPERVISOR_VALIDITY_GUARD', 'WORKSPACE_ROLE_ASSIGNMENT_SUPERVISOR_CAPPED',
        'workspace_member_role', v_after.id, to_jsonb(v_assignment), to_jsonb(v_after),
        'Assigning manager membership validity changed', v_now
      );
    end loop;
  end if;
  return new;
end;
$$;

revoke all on function app_private.revoke_workspace_member_roles_on_supervisor_end_v1()
  from public, anon, authenticated, service_role;

create trigger trg_revoke_delegated_roles_on_supervisor_end
after update of status, ends_at on identity.memberships
for each row execute function app_private.revoke_workspace_member_roles_on_supervisor_end_v1();


-- Existing assignment guards treated every non-null valid_to as final. Permit
-- monotonic shortening for supervisor cascades while still forbidding reopen
-- and extension; all other identity and scope invariants remain unchanged.
create or replace function app_private.guard_workspace_member_role_invariants_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, portfolio, identity
as $$
declare
  v_role record;
  v_mem record;
  v_bld record;
  v_unit record;
  v_ceiling_rank integer;
  v_scope_rank integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'workspace_member_role_delete_prohibited' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    -- A finalized assignment may only be shortened, never reopened or extended.
    if old.valid_to is not null
       and (new.valid_to is null or new.valid_to >= old.valid_to) then
      raise exception 'workspace_member_role_already_revoked' using errcode = '42501';
    end if;

    -- All identity, scope, role, membership, timestamps, and creator provenance fields are strictly immutable
    if new.id <> old.id
       or new.customer_workspace_id <> old.customer_workspace_id
       or new.tenant_id <> old.tenant_id
       or new.membership_id <> old.membership_id
       or new.workspace_role_id <> old.workspace_role_id
       or new.scope_type <> old.scope_type
       or new.property_id is distinct from old.property_id
       or new.building_id is distinct from old.building_id
       or new.unit_id is distinct from old.unit_id
       or new.valid_from <> old.valid_from
       or new.created_at <> old.created_at
       or new.assigned_by_user_id <> old.assigned_by_user_id
       or new.assigned_by_membership_id <> old.assigned_by_membership_id then
      raise exception 'workspace_member_role_fields_immutable' using errcode = '42501';
    end if;

    -- Revocation transition only: valid_to must transition from NULL to a valid timestamp
    if new.valid_to is null or new.valid_to < old.valid_from then
      raise exception 'workspace_member_role_update_must_be_revocation' using errcode = '42501';
    end if;

    -- lock_version must increment by exactly 1
    if new.lock_version <> old.lock_version + 1 then
      raise exception 'workspace_member_role_expected_lock_version_conflict' using errcode = '40001';
    end if;

    -- Reason must be valid
    if new.reason is null or length(trim(new.reason)) < 5 then
      raise exception 'workspace_member_role_reason_invalid' using errcode = '22023';
    end if;

    return new;
  end if;

  -- INSERT Validations:
  -- 1. Tenant & Membership consistency and active validity
  select * into v_mem
  from identity.memberships
  where id = new.membership_id;

  if not found or v_mem.tenant_id <> new.tenant_id or v_mem.status <> 'active'
     or v_mem.starts_at > statement_timestamp()
     or (v_mem.ends_at is not null and v_mem.ends_at <= statement_timestamp()) then
    raise exception 'workspace_member_role_target_membership_invalid' using errcode = '42501';
  end if;

  -- 2. Role Status & Tenant/Workspace consistency
  select * into v_role
  from platform.workspace_roles
  where id = new.workspace_role_id;

  if not found or v_role.tenant_id <> new.tenant_id or v_role.customer_workspace_id <> new.customer_workspace_id then
    raise exception 'workspace_member_role_cross_workspace_prohibited' using errcode = '42501';
  end if;

  if v_role.lifecycle_status <> 'published' or (v_role.valid_to is not null and v_role.valid_to <= statement_timestamp()) then
    raise exception 'workspace_role_not_published' using errcode = '42501';
  end if;

  -- 3. Scope Ceiling Enforcement: workspace(0) > property(1) > building(2) > unit(3)
  v_ceiling_rank := case v_role.scope_ceiling
    when 'workspace' then 0
    when 'property' then 1
    when 'building' then 2
    when 'unit' then 3
    else 99
  end;

  v_scope_rank := case new.scope_type
    when 'workspace' then 0
    when 'property' then 1
    when 'building' then 2
    when 'unit' then 3
    else 99
  end;

  if v_scope_rank < v_ceiling_rank then
    raise exception 'workspace_member_role_exceeds_scope_ceiling' using errcode = '42501';
  end if;

  -- 4. Scope Ancestry & Workspace Property Binding
  if new.property_id is not null then
    if not exists (
      select 1 from platform.workspace_property_bindings
      where customer_workspace_id = new.customer_workspace_id
        and property_id = new.property_id
        and status = 'active'
        and valid_from <= statement_timestamp()
        and (valid_to is null or valid_to > statement_timestamp())
    ) then
      raise exception 'property_not_bound_to_workspace' using errcode = '42501';
    end if;
  end if;

  if new.building_id is not null then
    select * into v_bld from portfolio.buildings where id = new.building_id;
    if not found or v_bld.property_id <> new.property_id or v_bld.tenant_id <> new.tenant_id then
      raise exception 'building_scope_ancestry_mismatch' using errcode = '22023';
    end if;
  end if;

  if new.unit_id is not null then
    select * into v_unit from portfolio.units where id = new.unit_id;
    if not found or v_unit.building_id <> new.building_id or v_unit.tenant_id <> new.tenant_id then
      raise exception 'unit_scope_ancestry_mismatch' using errcode = '22023';
    end if;
  end if;

  -- 5. Temporal Non-Overlap for identical assignment target
  if exists (
    select 1 from platform.workspace_member_roles r
    where r.customer_workspace_id = new.customer_workspace_id
      and r.membership_id = new.membership_id
      and r.workspace_role_id = new.workspace_role_id
      and r.scope_type = new.scope_type
      and r.property_id is not distinct from new.property_id
      and r.building_id is not distinct from new.building_id
      and r.unit_id is not distinct from new.unit_id
      and (r.valid_to is null or r.valid_to > new.valid_from)
  ) then
    raise exception 'workspace_member_role_overlapping_assignment' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_workspace_member_role_invariants_v1() from public, anon, authenticated;

commit;
