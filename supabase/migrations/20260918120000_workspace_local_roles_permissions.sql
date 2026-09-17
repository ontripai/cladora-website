begin;

-- ============================================================================
-- Migration 103: Workspace-Local Roles, Module Scoping & Effective Permission Engine (001B.1)
-- Package: CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1
-- Scope: Versioned Module-Permission Registry, Workspace Roles & Versions,
-- Module/Permission Attachments, Scoped Member Assignments, Versioned Idempotency,
-- Atomic RPCs, Audit, and Deny-First Effective Permission Resolution Engine.
-- Cardinal Invariant:
-- Workspace Taxonomy != Module Activation != Entitlement != Permission != Role != Delegation != Country Pack
-- Delegation, Approvals & Four-Eyes Dual Control are strictly DEFERRED to 001B.2 (Migration 104)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Scoped Permission Seeds for Workspace Roles Management
-- ----------------------------------------------------------------------------
insert into identity.permissions (code, resource, action, description)
values
  ('workspace.role.read', 'workspace.role', 'read', 'View workspace-local roles, module bindings, and member assignments'),
  ('workspace.role.manage', 'workspace.role', 'manage', 'Create and modify draft workspace-local roles, module attachments, and permission attachments'),
  ('workspace.role.publish', 'workspace.role', 'publish', 'Publish and supersede workspace-local roles with atomic version transition'),
  ('workspace.role.assign', 'workspace.role', 'assign', 'Assign and revoke workspace-local roles to workspace members with scope boundaries')
on conflict (code) do nothing;

create or replace function app_private.validate_workspace_role_permissions_seeding_v1()
returns void
language plpgsql
security definer
set search_path = pg_catalog, identity
as $$
declare
  v_perm record;
begin
  for v_perm in
    select code, resource, action from identity.permissions
    where code in ('workspace.role.read', 'workspace.role.manage', 'workspace.role.publish', 'workspace.role.assign')
  loop
    if v_perm.resource <> 'workspace.role' then
      raise exception 'permission_specification_mismatch: invalid resource for %', v_perm.code using errcode = '22023';
    end if;
  end loop;

  if (select count(*) from identity.permissions where code in ('workspace.role.read', 'workspace.role.manage', 'workspace.role.publish', 'workspace.role.assign')) <> 4 then
    raise exception 'workspace_role_permissions_seeding_incomplete' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from identity.roles
    where code = 'association_admin' and tenant_id is null and is_system = true
  ) then
    raise exception 'required_target_role_missing: association_admin' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from identity.roles
    where code = 'property_manager' and tenant_id is null and is_system = true
  ) then
    raise exception 'required_target_role_missing: property_manager' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function app_private.validate_workspace_role_permissions_seeding_v1() from public, anon, authenticated;
select app_private.validate_workspace_role_permissions_seeding_v1();

-- Grant all 4 permissions to canonical system administrative roles
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'::platform.decision_effect
from identity.roles r
cross join identity.permissions p
where r.code in ('association_admin', 'property_manager')
  and r.tenant_id is null
  and r.is_system = true
  and p.code in ('workspace.role.read', 'workspace.role.manage', 'workspace.role.publish', 'workspace.role.assign')
on conflict do nothing;

-- Grant read-only permission to canonical review roles
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'::platform.decision_effect
from identity.roles r
cross join identity.permissions p
where r.code in ('president', 'censor')
  and r.tenant_id is null
  and r.is_system = true
  and p.code = 'workspace.role.read'
on conflict do nothing;

-- Bootstrap future system roles with scoped workspace role permissions
create or replace function app_private.bootstrap_role_workspace_role_permissions_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, identity
as $$
begin
  if new.tenant_id is null and new.is_system = true and new.name is not null and length(trim(new.name)) > 0 then
    if new.code in ('association_admin', 'property_manager') then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code in ('workspace.role.read', 'workspace.role.manage', 'workspace.role.publish', 'workspace.role.assign')
      on conflict do nothing;
    elsif new.code in ('president', 'censor') then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code = 'workspace.role.read'
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.bootstrap_role_workspace_role_permissions_v1() from public, anon, authenticated;

drop trigger if exists trg_bootstrap_role_workspace_role_permissions on identity.roles;
create trigger trg_bootstrap_role_workspace_role_permissions
after insert on identity.roles
for each row
execute function app_private.bootstrap_role_workspace_role_permissions_v1();


-- ----------------------------------------------------------------------------
-- 2. Table 1: platform.module_permission_bindings (Registry)
-- ----------------------------------------------------------------------------
create table platform.module_permission_bindings (
  id uuid primary key default gen_random_uuid(),
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  permission_id uuid not null references identity.permissions(id) on delete restrict,
  binding_version integer not null default 1 check (binding_version >= 1),
  permission_mode text not null default 'read' check (permission_mode in ('read', 'manage', 'execute', 'admin')),
  is_assignable_to_local_role boolean not null default true,
  is_delegable boolean not null default false, -- Strictly false in 001B.1
  requires_aal2 boolean not null default false,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('active', 'deprecated', 'retired')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  unique (module_definition_id, permission_id, binding_version)
);

create unique index module_permission_bindings_active_idx
  on platform.module_permission_bindings (module_definition_id, permission_id)
  where (lifecycle_status = 'active' and valid_to is null);

create index mod_perm_bindings_lookup_idx
  on platform.module_permission_bindings (module_definition_id, permission_id, lifecycle_status);

-- Guard: In 001B.1 is_delegable MUST remain false. Delegation runtime deferred to 001B.2.
create or replace function app_private.guard_module_permission_binding_invariants_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_mod_status text;
begin
  if new.is_delegable is true then
    raise exception 'delegation_runtime_deferred_to_001b2' using errcode = '42501';
  end if;

  select lifecycle_status into v_mod_status
  from platform.module_definitions
  where id = new.module_definition_id;

  if v_mod_status = 'catalog_only' then
    raise exception 'catalog_only_modules_cannot_have_permission_bindings' using errcode = '42501';
  end if;

  -- Prevent temporal overlap among active records
  if new.lifecycle_status = 'active' and exists (
    select 1 from platform.module_permission_bindings b
    where b.module_definition_id = new.module_definition_id
      and b.permission_id = new.permission_id
      and b.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and b.lifecycle_status = 'active'
      and (
        (new.valid_to is null and (b.valid_to is null or b.valid_to > new.valid_from))
        or (new.valid_to is not null and b.valid_from < new.valid_to and (b.valid_to is null or b.valid_to > new.valid_from))
      )
  ) then
    raise exception 'module_permission_binding_temporal_overlap' using errcode = '23505';
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_module_permission_binding_invariants_v1() from public, anon, authenticated;

create trigger trg_guard_module_permission_binding_invariants
before insert or update on platform.module_permission_bindings
for each row
execute function app_private.guard_module_permission_binding_invariants_v1();


-- ----------------------------------------------------------------------------
-- 3. Table 2: platform.workspace_roles
-- ----------------------------------------------------------------------------
create table platform.workspace_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  code text not null check (code ~ '^[a-z0-9_]{3,50}$'),
  role_version integer not null default 1 check (role_version >= 1),
  lock_version integer not null default 1 check (lock_version >= 1),
  name text not null check (length(trim(name)) >= 2),
  description text check (description is null or length(trim(description)) >= 5),
  base_role_id uuid references identity.roles(id) on delete restrict,
  scope_ceiling text not null default 'workspace' check (scope_ceiling in ('workspace', 'property', 'building', 'unit')),
  lifecycle_status text not null default 'draft' check (lifecycle_status in ('draft', 'published', 'archived')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  unique (customer_workspace_id, code, role_version)
);

create unique index workspace_roles_active_published_idx
  on platform.workspace_roles (customer_workspace_id, code)
  where (lifecycle_status = 'published' and valid_to is null);

create index ws_roles_tenant_ws_idx
  on platform.workspace_roles (tenant_id, customer_workspace_id, lifecycle_status);

-- Guard: Immutability of published roles, controlled supersession to archived, zero physical delete
create or replace function app_private.guard_workspace_role_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if tg_op = 'DELETE' then
    if current_setting('app.operational_cleanup', true) = 'true' then
      return old;
    end if;
    raise exception 'workspace_role_delete_prohibited' using errcode = '42501';
  end if;

  if old.lifecycle_status = 'archived' then
    raise exception 'workspace_role_archived_immutable' using errcode = '42501';
  end if;

  if old.lifecycle_status = 'published' then
    -- Only permitted transition is published -> archived
    if new.lifecycle_status = 'archived' then
      if new.valid_to is null or new.valid_to < old.valid_from then
        raise exception 'archived_role_requires_valid_to' using errcode = '22023';
      end if;
      -- Immutable fields cannot be modified during supersession
      if new.id <> old.id
         or new.tenant_id <> old.tenant_id
         or new.customer_workspace_id <> old.customer_workspace_id
         or new.code <> old.code
         or new.role_version <> old.role_version
         or new.name <> old.name
         or new.description is distinct from old.description
         or new.base_role_id is distinct from old.base_role_id
         or new.scope_ceiling <> old.scope_ceiling
         or new.valid_from <> old.valid_from
         or new.created_by <> old.created_by
         or new.created_at <> old.created_at
         or new.lock_version <> old.lock_version + 1 then
        raise exception 'published_workspace_role_content_immutable' using errcode = '42501';
      end if;
    else
      raise exception 'published_workspace_role_immutable' using errcode = '42501';
    end if;
  end if;

  if old.lifecycle_status = 'draft' then
    if new.lifecycle_status not in ('draft', 'published') then
      raise exception 'draft_role_invalid_lifecycle_transition' using errcode = '42501';
    end if;
    if new.id <> old.id
       or new.tenant_id <> old.tenant_id
       or new.customer_workspace_id <> old.customer_workspace_id
       or new.code <> old.code
       or new.role_version <> old.role_version
       or new.created_by <> old.created_by
       or new.created_at <> old.created_at then
      raise exception 'draft_role_identity_immutable' using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_workspace_role_immutability_v1() from public, anon, authenticated;

create trigger trg_guard_workspace_role_immutability
before update or delete on platform.workspace_roles
for each row
execute function app_private.guard_workspace_role_immutability_v1();


-- ----------------------------------------------------------------------------
-- 4. Table 3: platform.workspace_role_modules
-- ----------------------------------------------------------------------------
create table platform.workspace_role_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_role_id uuid not null references platform.workspace_roles(id) on delete restrict,
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_role_id, module_definition_id)
);

create index ws_role_modules_lookup_idx
  on platform.workspace_role_modules (workspace_role_id, module_definition_id);

create or replace function app_private.guard_workspace_role_module_draft_only_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_role_status text;
  v_target_role_id uuid;
begin
  v_target_role_id := case when tg_op = 'DELETE' then old.workspace_role_id else new.workspace_role_id end;

  if tg_op = 'DELETE' and current_setting('app.operational_cleanup', true) = 'true' then
    return old;
  end if;

  select lifecycle_status into v_role_status
  from platform.workspace_roles
  where id = v_target_role_id;

  if v_role_status is null or v_role_status <> 'draft' then
    raise exception 'workspace_role_not_in_draft_state' using errcode = '42501';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function app_private.guard_workspace_role_module_draft_only_v1() from public, anon, authenticated;

create trigger trg_guard_workspace_role_module_draft_only
before insert or update or delete on platform.workspace_role_modules
for each row
execute function app_private.guard_workspace_role_module_draft_only_v1();


-- ----------------------------------------------------------------------------
-- 5. Table 4: platform.workspace_role_permissions
-- ----------------------------------------------------------------------------
create table platform.workspace_role_permissions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  workspace_role_id uuid not null references platform.workspace_roles(id) on delete restrict,
  permission_id uuid not null references identity.permissions(id) on delete restrict,
  effect platform.decision_effect not null default 'allow',
  created_at timestamptz not null default statement_timestamp(),
  unique (workspace_role_id, permission_id)
);

create index ws_role_permissions_lookup_idx
  on platform.workspace_role_permissions (workspace_role_id, permission_id, effect);

create or replace function app_private.guard_workspace_role_permission_bindings_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_role_status text;
  v_target_role_id uuid;
begin
  v_target_role_id := case when tg_op = 'DELETE' then old.workspace_role_id else new.workspace_role_id end;

  if tg_op = 'DELETE' and current_setting('app.operational_cleanup', true) = 'true' then
    return old;
  end if;

  select lifecycle_status into v_role_status
  from platform.workspace_roles
  where id = v_target_role_id;

  if v_role_status is null or v_role_status <> 'draft' then
    raise exception 'workspace_role_not_in_draft_state' using errcode = '42501';
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    -- Guard: Permission must be registered and assignable for at least one module currently attached to this role
    if not exists (
      select 1
      from platform.workspace_role_modules wrm
      join platform.module_permission_bindings mpb
        on mpb.module_definition_id = wrm.module_definition_id
      where wrm.workspace_role_id = new.workspace_role_id
        and mpb.permission_id = new.permission_id
        and mpb.is_assignable_to_local_role = true
        and mpb.lifecycle_status = 'active'
        and mpb.valid_from <= statement_timestamp()
        and (mpb.valid_to is null or mpb.valid_to > statement_timestamp())
    ) then
      raise exception 'permission_not_assignable_to_role_modules' using errcode = '42501';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function app_private.guard_workspace_role_permission_bindings_v1() from public, anon, authenticated;

create trigger trg_guard_workspace_role_permission_bindings
before insert or update or delete on platform.workspace_role_permissions
for each row
execute function app_private.guard_workspace_role_permission_bindings_v1();


-- ----------------------------------------------------------------------------
-- 6. Table 5: platform.workspace_member_roles (Scoped Assignment)
-- ----------------------------------------------------------------------------
create table platform.workspace_member_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  membership_id uuid not null references identity.memberships(id) on delete restrict,
  workspace_role_id uuid not null references platform.workspace_roles(id) on delete restrict,
  scope_type text not null check (scope_type in ('workspace', 'property', 'building', 'unit')),
  property_id uuid references portfolio.properties(id) on delete restrict,
  building_id uuid references portfolio.buildings(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  assigned_by_user_id uuid not null references auth.users(id) on delete restrict,
  assigned_by_membership_id uuid not null references identity.memberships(id) on delete restrict,
  lock_version integer not null default 1 check (lock_version >= 1),
  reason text not null check (length(trim(reason)) >= 5),
  created_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  -- Exactly-one-scope constraint
  check (
    (scope_type = 'workspace' and property_id is null and building_id is null and unit_id is null)
    or (scope_type = 'property' and property_id is not null and building_id is null and unit_id is null)
    or (scope_type = 'building' and property_id is not null and building_id is not null and unit_id is null)
    or (scope_type = 'unit' and property_id is not null and building_id is not null and unit_id is not null)
  )
);

create index ws_member_roles_active_lookup_idx
  on platform.workspace_member_roles (customer_workspace_id, membership_id, workspace_role_id)
  where (valid_to is null);

create index ws_member_roles_tenant_idx
  on platform.workspace_member_roles (tenant_id, customer_workspace_id);

-- Guard: Ancestry, scope ceiling, tenant consistency, and immutability (zero physical delete)
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
    if current_setting('app.operational_cleanup', true) = 'true' then
      return old;
    end if;
    raise exception 'workspace_member_role_delete_prohibited' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    -- Reopening prohibited: once revoked, no updates are allowed
    if old.valid_to is not null then
      raise exception 'workspace_member_role_already_revoked' using errcode = '42501';
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

create trigger trg_guard_workspace_member_role_invariants
before insert or update or delete on platform.workspace_member_roles
for each row
execute function app_private.guard_workspace_member_role_invariants_v1();


-- ----------------------------------------------------------------------------
-- 7. Table 6: platform.workspace_role_idempotency
-- ----------------------------------------------------------------------------
create table platform.workspace_role_idempotency (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  action text not null,
  request_hash text not null,
  request_hash_version integer not null default 1,
  result_entity_id uuid not null,
  response_snapshot jsonb not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, idempotency_key)
);

create index ws_role_idempotency_lookup_idx
  on platform.workspace_role_idempotency (tenant_id, customer_workspace_id, action);


-- ----------------------------------------------------------------------------
-- 8. Seed Module–Permission Registry Manifest (48 Proven Mappings)
-- ----------------------------------------------------------------------------
insert into platform.module_permission_bindings (
  module_definition_id,
  permission_id,
  binding_version,
  permission_mode,
  is_assignable_to_local_role,
  is_delegable,
  requires_aal2,
  lifecycle_status
)
select
  m.id,
  p.id,
  1,
  v.permission_mode,
  true,
  false, -- Cardinal Rule: false in 001B.1
  v.requires_aal2,
  'active'
from (values
  -- occupancy (2)
  ('occupancy', 'occupancy.occupancies.manage', 'manage', false),
  ('occupancy', 'occupancy.registry.read', 'read', false),

  -- billing (4)
  ('billing', 'billing.manage', 'manage', true),
  ('billing', 'billing.issue', 'execute', true),
  ('billing', 'billing.cancel', 'manage', true),
  ('billing', 'billing.receivables.read', 'read', false),

  -- payments (5)
  ('payments', 'payments.manage', 'manage', true),
  ('payments', 'payments.allocate', 'execute', true),
  ('payments', 'payments.reverse', 'manage', true),
  ('payments', 'payments.reconcile', 'manage', true),
  ('payments', 'payments.reconciliation.read', 'read', false),

  -- accounting (1)
  ('accounting', 'finance.ledger.read', 'read', false),

  -- maintenance (11)
  ('maintenance', 'maintenance.requests.read', 'read', false),
  ('maintenance', 'maintenance.requests.create', 'execute', false),
  ('maintenance', 'maintenance.requests.manage', 'manage', false),
  ('maintenance', 'maintenance.requests.assign', 'manage', false),
  ('maintenance', 'maintenance.work_orders.read', 'read', false),
  ('maintenance', 'maintenance.work_orders.manage', 'manage', false),
  ('maintenance', 'maintenance.work_orders.verify', 'manage', false),
  ('maintenance', 'maintenance.procurement.read', 'read', false),
  ('maintenance', 'maintenance.procurement.manage', 'manage', false),
  ('maintenance', 'maintenance.procurement.approve', 'manage', true),
  ('maintenance', 'maintenance.assets.read', 'read', false),

  -- utilities (6)
  ('utilities', 'utilities.manage', 'manage', false),
  ('utilities', 'utilities.readings.capture', 'execute', false),
  ('utilities', 'utilities.readings.approve', 'manage', false),
  ('utilities', 'utilities.tariffs.manage', 'manage', false),
  ('utilities', 'utilities.billing.create', 'execute', true),
  ('utilities', 'utilities.metering.read', 'read', false),

  -- governance (11)
  ('governance', 'governance.meetings.manage', 'manage', false),
  ('governance', 'governance.agenda.manage', 'manage', false),
  ('governance', 'governance.attendance.manage', 'manage', false),
  ('governance', 'governance.proxies.manage', 'manage', false),
  ('governance', 'governance.votes.cast', 'execute', false),
  ('governance', 'governance.votes.administer', 'admin', true),
  ('governance', 'governance.resolutions.read', 'read', false),
  ('governance', 'governance.resolutions.manage', 'manage', false),
  ('governance', 'governance.minutes.read', 'read', false),
  ('governance', 'governance.minutes.finalize', 'manage', true),
  ('governance', 'governance.meetings.read', 'read', false),

  -- communications (4)
  ('communications', 'communications.notices.read', 'read', false),
  ('communications', 'communications.notices.manage', 'manage', false),
  ('communications', 'communications.notices.publish', 'execute', true),
  ('communications', 'communications.feed.read', 'read', false),

  -- documents (3)
  ('documents', 'documents.vault.manage', 'manage', false),
  ('documents', 'documents.vault.upload', 'execute', false),
  ('documents', 'documents.vault.read', 'read', false),

  -- security (1)
  ('security', 'security.access.read', 'read', false)
) as v(module_code, permission_code, permission_mode, requires_aal2)
join platform.module_definitions m on m.code = v.module_code and m.lifecycle_status in ('active', 'published')
join identity.permissions p on p.code = v.permission_code
on conflict (module_definition_id, permission_id, binding_version) do nothing;

create or replace function app_private.validate_module_permission_bindings_seeding_v1()
returns void
language plpgsql
security definer
set search_path = pg_catalog, platform, identity
as $$
declare
  v_expected_count integer := 48;
  v_actual_count integer;
  v_matching_count integer;
  v_catalog_only_bindings integer;
begin
  select count(*) into v_actual_count
  from platform.module_permission_bindings;

  if v_actual_count <> v_expected_count then
    raise exception 'module_permission_bindings_seed_count_mismatch: expected %, got %', v_expected_count, v_actual_count using errcode = 'P0002';
  end if;

  -- Verify exact match against manifest
  select count(*) into v_matching_count
  from (values
    ('occupancy', 'occupancy.occupancies.manage', 'manage', false),
    ('occupancy', 'occupancy.registry.read', 'read', false),
    ('billing', 'billing.manage', 'manage', true),
    ('billing', 'billing.issue', 'execute', true),
    ('billing', 'billing.cancel', 'manage', true),
    ('billing', 'billing.receivables.read', 'read', false),
    ('payments', 'payments.manage', 'manage', true),
    ('payments', 'payments.allocate', 'execute', true),
    ('payments', 'payments.reverse', 'manage', true),
    ('payments', 'payments.reconcile', 'manage', true),
    ('payments', 'payments.reconciliation.read', 'read', false),
    ('accounting', 'finance.ledger.read', 'read', false),
    ('maintenance', 'maintenance.requests.read', 'read', false),
    ('maintenance', 'maintenance.requests.create', 'execute', false),
    ('maintenance', 'maintenance.requests.manage', 'manage', false),
    ('maintenance', 'maintenance.requests.assign', 'manage', false),
    ('maintenance', 'maintenance.work_orders.read', 'read', false),
    ('maintenance', 'maintenance.work_orders.manage', 'manage', false),
    ('maintenance', 'maintenance.work_orders.verify', 'manage', false),
    ('maintenance', 'maintenance.procurement.read', 'read', false),
    ('maintenance', 'maintenance.procurement.manage', 'manage', false),
    ('maintenance', 'maintenance.procurement.approve', 'manage', true),
    ('maintenance', 'maintenance.assets.read', 'read', false),
    ('utilities', 'utilities.manage', 'manage', false),
    ('utilities', 'utilities.readings.capture', 'execute', false),
    ('utilities', 'utilities.readings.approve', 'manage', false),
    ('utilities', 'utilities.tariffs.manage', 'manage', false),
    ('utilities', 'utilities.billing.create', 'execute', true),
    ('utilities', 'utilities.metering.read', 'read', false),
    ('governance', 'governance.meetings.manage', 'manage', false),
    ('governance', 'governance.agenda.manage', 'manage', false),
    ('governance', 'governance.attendance.manage', 'manage', false),
    ('governance', 'governance.proxies.manage', 'manage', false),
    ('governance', 'governance.votes.cast', 'execute', false),
    ('governance', 'governance.votes.administer', 'admin', true),
    ('governance', 'governance.resolutions.read', 'read', false),
    ('governance', 'governance.resolutions.manage', 'manage', false),
    ('governance', 'governance.minutes.read', 'read', false),
    ('governance', 'governance.minutes.finalize', 'manage', true),
    ('governance', 'governance.meetings.read', 'read', false),
    ('communications', 'communications.notices.read', 'read', false),
    ('communications', 'communications.notices.manage', 'manage', false),
    ('communications', 'communications.notices.publish', 'execute', true),
    ('communications', 'communications.feed.read', 'read', false),
    ('documents', 'documents.vault.manage', 'manage', false),
    ('documents', 'documents.vault.upload', 'execute', false),
    ('documents', 'documents.vault.read', 'read', false),
    ('security', 'security.access.read', 'read', false)
  ) as m(module_code, permission_code, permission_mode, requires_aal2)
  join platform.module_definitions md on md.code = m.module_code
  join identity.permissions p on p.code = m.permission_code
  join platform.module_permission_bindings b
    on b.module_definition_id = md.id
   and b.permission_id = p.id
   and b.binding_version = 1
   and b.permission_mode = m.permission_mode
   and b.requires_aal2 = m.requires_aal2
   and b.is_assignable_to_local_role = true
   and b.is_delegable = false
   and b.lifecycle_status = 'active';

  if v_matching_count <> v_expected_count then
    raise exception 'module_permission_bindings_seed_mismatch: expected % exact matches, got %', v_expected_count, v_matching_count using errcode = 'P0002';
  end if;

  -- Ensure catalog-only modules have 0 bindings
  select count(*) into v_catalog_only_bindings
  from platform.module_permission_bindings b
  join platform.module_definitions md on md.id = b.module_definition_id
  where md.lifecycle_status = 'catalog_only';

  if v_catalog_only_bindings > 0 then
    raise exception 'catalog_only_modules_have_bindings: % bindings found', v_catalog_only_bindings using errcode = '42501';
  end if;

  -- Ensure zero delegable bindings in 001B.1
  if exists (select 1 from platform.module_permission_bindings where is_delegable is true) then
    raise exception 'module_permission_bindings_invalid_delegation: is_delegable must be false in 001B.1' using errcode = '42501';
  end if;
end;
$$;

revoke all on function app_private.validate_module_permission_bindings_seeding_v1() from public, anon, authenticated;
select app_private.validate_module_permission_bindings_seeding_v1();


-- ----------------------------------------------------------------------------
-- 9. Deny-First Effective Permission Resolution Engine
-- ----------------------------------------------------------------------------
create or replace function app_private.check_effective_permission_v1(
  p_context_id uuid,
  p_permission_code text,
  p_module_code text,
  p_target_scope_type text,
  p_target_scope_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
declare
  v_res record;
  v_perm identity.permissions%rowtype;
  v_mod_ids uuid[];
  v_mod platform.module_definitions%rowtype;
  v_binding_ids uuid[];
  v_binding platform.module_permission_bindings%rowtype;
  v_tax_ids uuid[];
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_profile record;
  v_model record;
  v_has_allow boolean := false;
begin
  -- Step 1: Input Validation
  if p_context_id is null or p_permission_code is null or p_module_code is null or p_target_scope_type is null then
    return false;
  end if;

  if p_target_scope_type not in ('workspace', 'property', 'building', 'unit') then
    return false;
  end if;

  if p_target_scope_type <> 'workspace' and p_target_scope_id is null then
    return false;
  end if;

  -- Step 2: Context Resolution & Actor Active Membership
  begin
    select * into v_res
    from app_private.resolve_workspace_from_customer_context_v1(p_context_id, false);
  exception when others then
    return false;
  end;

  if v_res.workspace_id is null or v_res.membership_id is null then
    return false;
  end if;

  -- Step 3: Permission & Module Verification (Deterministic & temporal non-ambiguous)
  select * into v_perm from identity.permissions where code = p_permission_code;
  if not found then return false; end if;

  select array_agg(id)
  into v_mod_ids
  from platform.module_definitions
  where code = p_module_code
    and is_active = true
    and lifecycle_status in ('active', 'published')
    and lifecycle_status <> 'catalog_only'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  -- Exactly one effective runtime module definition required; zero or ambiguous (>1) => fail-closed
  if coalesce(cardinality(v_mod_ids), 0) <> 1 then
    return false;
  end if;

  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  -- Step 4: Active Module-Permission Binding Gate (Deterministic & temporal non-ambiguous)
  select array_agg(id)
  into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  -- Exactly one effective binding required; zero or ambiguous (>1) => fail-closed
  if coalesce(cardinality(v_binding_ids), 0) <> 1 then
    return false;
  end if;

  select * into v_binding from platform.module_permission_bindings where id = v_binding_ids[1];

  -- Step 5: Active Workspace Module Activation Gate
  if not exists (
    select 1 from platform.workspace_modules
    where customer_workspace_id = v_res.workspace_id
      and module_code = p_module_code
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Step 6: Workspace Entitlement Gate
  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
            then e.override_value_json = 'true'::jsonb
          else (e.boolean_value is true or e.numeric_value > 0)
        end
      )
  ) then
    return false;
  end if;

  -- Step 7: Universal Taxonomy Compatibility Gate (Deterministic & temporal non-ambiguous)
  select array_agg(wta.id)
  into v_tax_ids
  from platform.workspace_taxonomy_assignments wta
  where wta.customer_workspace_id = v_res.workspace_id
    and wta.status = 'active'
    and wta.valid_from <= statement_timestamp()
    and (wta.valid_to is null or wta.valid_to > statement_timestamp());

  -- Exactly one active taxonomy assignment required; zero or ambiguous (>1) => fail-closed
  if coalesce(cardinality(v_tax_ids), 0) <> 1 then
    return false;
  end if;

  select pp.id as profile_id, om.id as model_id
  into v_profile
  from platform.workspace_taxonomy_assignments wta
  join platform.property_profiles pp on pp.id = wta.property_profile_id
  join platform.operating_models om on om.id = wta.operating_model_id
  where wta.id = v_tax_ids[1];

  if not exists (
    select 1
    from platform.module_property_profile_compatibilities ppc
    join platform.module_operating_model_compatibilities omc
      on omc.module_definition_id = ppc.module_definition_id
    where ppc.module_definition_id = v_mod.id
      and ppc.property_profile_id = v_profile.profile_id
      and ppc.compatibility_level = 'compatible'
      and omc.operating_model_id = v_profile.model_id
      and omc.compatibility_level = 'compatible'
  ) then
    return false;
  end if;

  -- Step 8: Resolve Target Hierarchy Ancestry
  if p_target_scope_type = 'property' then
    v_target_property_id := p_target_scope_id;
  elsif p_target_scope_type = 'building' then
    select property_id into v_target_property_id from portfolio.buildings where id = p_target_scope_id;
    v_target_building_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  elsif p_target_scope_type = 'unit' then
    select u.building_id, b.property_id
    into v_target_building_id, v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_target_scope_id;
    v_target_unit_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  end if;

  -- Target property must be bound to workspace
  if v_target_property_id is not null and not exists (
    select 1 from platform.workspace_property_bindings
    where customer_workspace_id = v_res.workspace_id
      and property_id = v_target_property_id
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Step 9: DENY-FIRST EVALUATION across BOTH Paths

  -- Path A Deny: Existing Identity Role Deny
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id
      and rp.permission_id = v_perm.id
      and rp.effect = 'deny'
  ) then
    return false;
  end if;

  -- Path B Deny: Workspace-Local Roles Deny (Encompassing Target Scope & Bound to target module)
  if exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = v_res.membership_id
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'deny'
      and (
        wmr.scope_type = 'workspace'
        or (wmr.scope_type = 'property' and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    return false;
  end if;

  -- Step 10: ALLOW EVALUATION across BOTH Paths

  -- Path A Allow: Existing Identity Role Allow
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id
      and rp.permission_id = v_perm.id
      and rp.effect = 'allow'
  ) then
    v_has_allow := true;
  end if;

  -- Path B Allow: Workspace-Local Role Allow
  if not v_has_allow and exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = v_res.membership_id
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and (
        wmr.scope_type = 'workspace'
        or (wmr.scope_type = 'property' and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$$;

revoke all on function app_private.check_effective_permission_v1(uuid, text, text, text, uuid) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 10. Customer RPC 1: customer_api.get_workspace_roles_v1 (STABLE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_workspace_roles_v1(p_context_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
declare
  v_res record;
  v_roles jsonb;
  v_assignments jsonb;
  v_available_modules jsonb;
  v_available_permissions jsonb;
  v_templates jsonb;
begin
  select * into v_res
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id, false);

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id
      and rp.effect = 'allow'
      and p.code in ('workspace.role.read', 'workspace.role.manage')
  ) then
    raise exception 'workspace_role_read_permission_required' using errcode = '42501';
  end if;

  -- 1. Roles in this workspace
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'code', r.code,
      'name', r.name,
      'description', r.description,
      'role_version', r.role_version,
      'lock_version', r.lock_version,
      'scope_ceiling', r.scope_ceiling,
      'lifecycle_status', r.lifecycle_status,
      'base_role_id', r.base_role_id,
      'base_role_code', br.code,
      'valid_from', r.valid_from,
      'valid_to', r.valid_to,
      'modules', coalesce((
        select jsonb_agg(jsonb_build_object('id', md.id, 'code', md.code, 'name', md.name))
        from platform.workspace_role_modules wrm
        join platform.module_definitions md on md.id = wrm.module_definition_id
        where wrm.workspace_role_id = r.id
      ), '[]'::jsonb),
      'permissions', coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'code', p.code, 'effect', wrp.effect))
        from platform.workspace_role_permissions wrp
        join identity.permissions p on p.id = wrp.permission_id
        where wrp.workspace_role_id = r.id
      ), '[]'::jsonb)
    ) order by r.code, r.role_version desc
  ), '[]'::jsonb)
  into v_roles
  from platform.workspace_roles r
  left join identity.roles br on br.id = r.base_role_id
  where r.customer_workspace_id = v_res.workspace_id;

  -- 2. Member Assignments in this workspace
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'membership_id', a.membership_id,
      'member_name', u.raw_user_meta_data->>'full_name',
      'workspace_role_id', a.workspace_role_id,
      'role_code', r.code,
      'role_name', r.name,
      'scope_type', a.scope_type,
      'property_id', a.property_id,
      'property_name', prop.name,
      'building_id', a.building_id,
      'building_name', bld.name,
      'unit_id', a.unit_id,
      'unit_number', unt.code,
      'valid_from', a.valid_from,
      'valid_to', a.valid_to,
      'lock_version', a.lock_version,
      'reason', a.reason
    ) order by a.created_at desc
  ), '[]'::jsonb)
  into v_assignments
  from platform.workspace_member_roles a
  join platform.workspace_roles r on r.id = a.workspace_role_id
  join identity.memberships m on m.id = a.membership_id
  left join auth.users u on u.id = m.user_id
  left join portfolio.properties prop on prop.id = a.property_id
  left join portfolio.buildings bld on bld.id = a.building_id
  left join portfolio.units unt on unt.id = a.unit_id
  where a.customer_workspace_id = v_res.workspace_id
    and (a.valid_to is null or a.valid_to > statement_timestamp());

  -- 3. Available Active Installed Modules
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', md.id,
      'code', md.code,
      'name', md.name,
      'category', md.category
    ) order by md.code
  ), '[]'::jsonb)
  into v_available_modules
  from platform.workspace_modules wm
  join platform.module_definitions md on md.id = wm.module_definition_id
  where wm.customer_workspace_id = v_res.workspace_id
    and wm.status = 'active'
    and wm.valid_from <= statement_timestamp()
    and (wm.valid_to is null or wm.valid_to > statement_timestamp())
    and md.is_active = true
    and md.lifecycle_status in ('active', 'published')
    and md.lifecycle_status <> 'catalog_only'
    and md.valid_from <= statement_timestamp()
    and (md.valid_to is null or md.valid_to > statement_timestamp());

  -- 4. Available Permissions for Installed Modules
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', sub.id,
      'code', sub.code,
      'module_code', sub.module_code,
      'permission_mode', sub.permission_mode,
      'requires_aal2', sub.requires_aal2
    ) order by sub.code, sub.module_code
  ), '[]'::jsonb)
  into v_available_permissions
  from (
    select distinct
      p.id,
      p.code,
      md.code as module_code,
      mpb.permission_mode,
      mpb.requires_aal2
    from platform.workspace_modules wm
    join platform.module_definitions md on md.id = wm.module_definition_id
    join platform.module_permission_bindings mpb on mpb.module_definition_id = md.id
    join identity.permissions p on p.id = mpb.permission_id
    where wm.customer_workspace_id = v_res.workspace_id
      and wm.status = 'active'
      and wm.valid_from <= statement_timestamp()
      and (wm.valid_to is null or wm.valid_to > statement_timestamp())
      and md.is_active = true
      and md.lifecycle_status in ('active', 'published')
      and md.lifecycle_status <> 'catalog_only'
      and md.valid_from <= statement_timestamp()
      and (md.valid_to is null or md.valid_to > statement_timestamp())
      and mpb.is_assignable_to_local_role = true
      and mpb.lifecycle_status = 'active'
      and mpb.valid_from <= statement_timestamp()
      and (mpb.valid_to is null or mpb.valid_to > statement_timestamp())
  ) sub;

  -- 5. Available Base Role Templates
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', tr.id,
      'code', tr.code,
      'name', tr.name
    ) order by tr.code
  ), '[]'::jsonb)
  into v_templates
  from identity.roles tr
  where tr.tenant_id is null and tr.is_system = true;

  return jsonb_build_object(
    'workspace_id', v_res.workspace_id,
    'roles', v_roles,
    'assignments', v_assignments,
    'available_modules', v_available_modules,
    'available_permissions', v_available_permissions,
    'templates', v_templates
  );
end;
$$;

revoke all on function customer_api.get_workspace_roles_v1(uuid) from public, anon;
grant execute on function customer_api.get_workspace_roles_v1(uuid) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 11. Customer RPC 2: customer_api.create_workspace_role_draft_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.create_workspace_role_draft_v1(
  p_context_id uuid,
  p_code text,
  p_name text,
  p_description text,
  p_scope_ceiling text,
  p_base_role_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_normalized_code text;
  v_normalized_name text;
  v_normalized_reason text;
  v_ceiling text;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_idem platform.workspace_role_idempotency%rowtype;
  v_next_role_ver integer;
  v_role platform.workspace_roles%rowtype;
  v_response jsonb;
begin
  -- Idempotency key validation
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_role_idempotency_key_invalid' using errcode = '22023';
  end if;

  -- Reason validation
  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'workspace_role_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  -- Context resolution (Mutation fail-closed)
  select * into v_res
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);

  -- Permission & AAL2 check
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.role.manage'
  ) then
    raise exception 'workspace_role_manage_permission_required' using errcode = '42501';
  end if;

  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- Format & Scope Ceiling validation
  v_normalized_code := lower(trim(p_code));
  if v_normalized_code is null or v_normalized_code !~ '^[a-z0-9_]{3,50}$' then
    raise exception 'workspace_role_code_invalid' using errcode = '22023';
  end if;

  v_normalized_name := trim(p_name);
  if v_normalized_name is null or length(v_normalized_name) < 2 then
    raise exception 'workspace_role_name_invalid' using errcode = '22023';
  end if;

  v_ceiling := coalesce(p_scope_ceiling, 'workspace');
  if v_ceiling not in ('workspace', 'property', 'building', 'unit') then
    raise exception 'workspace_role_scope_ceiling_invalid' using errcode = '22023';
  end if;

  if p_base_role_id is not null and not exists (
    select 1 from identity.roles where id = p_base_role_id and tenant_id is null and is_system = true
  ) then
    raise exception 'workspace_role_base_template_not_found' using errcode = 'P0002';
  end if;

  -- Hash & Lock
  v_canonical_payload := jsonb_build_object(
    'action', 'create_draft',
    'base_role_id', p_base_role_id,
    'code', v_normalized_code,
    'context_id', p_context_id,
    'description', p_description,
    'name', v_normalized_name,
    'reason', v_normalized_reason,
    'scope_ceiling', v_ceiling,
    'workspace_id', v_res.workspace_id
  );
  v_request_hash := encode(extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended('workspace_role:' || v_res.workspace_id::text || ':' || v_normalized_code, 0));

  select * into v_idem
  from platform.workspace_role_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'create_draft'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_role_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  -- Reject if active draft already exists for this code in this workspace
  if exists (
    select 1 from platform.workspace_roles
    where customer_workspace_id = v_res.workspace_id
      and code = v_normalized_code
      and lifecycle_status = 'draft'
  ) then
    raise exception 'workspace_role_draft_already_exists' using errcode = '40001';
  end if;

  -- Calculate next role_version
  select coalesce(max(role_version), 0) + 1 into v_next_role_ver
  from platform.workspace_roles
  where customer_workspace_id = v_res.workspace_id and code = v_normalized_code;

  insert into platform.workspace_roles (
    tenant_id,
    customer_workspace_id,
    code,
    role_version,
    lock_version,
    name,
    description,
    base_role_id,
    scope_ceiling,
    lifecycle_status,
    valid_from,
    valid_to,
    created_by
  ) values (
    v_res.tenant_id,
    v_res.workspace_id,
    v_normalized_code,
    v_next_role_ver,
    1,
    v_normalized_name,
    p_description,
    p_base_role_id,
    v_ceiling,
    'draft',
    statement_timestamp(),
    null,
    auth.uid()
  ) returning * into v_role;

  v_response := jsonb_build_object(
    'action', 'create_draft',
    'id', v_role.id,
    'code', v_role.code,
    'role_version', v_role.role_version,
    'lock_version', v_role.lock_version,
    'name', v_role.name,
    'scope_ceiling', v_role.scope_ceiling,
    'lifecycle_status', v_role.lifecycle_status,
    'workspace_id', v_res.workspace_id
  );

  insert into platform.workspace_role_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'create_draft',
    v_request_hash, 1, v_role.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_ROLE_CREATED', 'workspace_role',
    v_role.id, null, to_jsonb(v_role), v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.create_workspace_role_draft_v1(uuid, text, text, text, text, uuid, text, text) from public, anon;
grant execute on function customer_api.create_workspace_role_draft_v1(uuid, text, text, text, text, uuid, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 12. Customer RPC 3: customer_api.attach_workspace_role_module_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.attach_workspace_role_module_v1(
  p_context_id uuid,
  p_workspace_role_id uuid,
  p_module_definition_id uuid,
  p_expected_lock_version integer,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_role platform.workspace_roles%rowtype;
  v_mod platform.module_definitions%rowtype;
  v_normalized_reason text;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_idem platform.workspace_role_idempotency%rowtype;
  v_new_m platform.workspace_role_modules%rowtype;
  v_response jsonb;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_role_idempotency_key_invalid' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'workspace_role_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  select * into v_res
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.role.manage'
  ) then
    raise exception 'workspace_role_manage_permission_required' using errcode = '42501';
  end if;

  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  v_canonical_payload := jsonb_build_object(
    'action', 'attach_module',
    'expected_lock_version', p_expected_lock_version,
    'module_definition_id', p_module_definition_id,
    'reason', v_normalized_reason,
    'workspace_role_id', p_workspace_role_id
  );
  v_request_hash := encode(extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_idem from platform.workspace_role_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'attach_module'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_role_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace_role_lock:' || p_workspace_role_id::text, 0));

  select * into v_role from platform.workspace_roles where id = p_workspace_role_id for update;
  if not found or v_role.customer_workspace_id <> v_res.workspace_id then
    raise exception 'workspace_role_not_found' using errcode = 'P0002';
  end if;

  if v_role.lifecycle_status <> 'draft' then
    raise exception 'workspace_role_not_in_draft_state' using errcode = '42501';
  end if;

  if p_expected_lock_version is null or v_role.lock_version <> p_expected_lock_version then
    raise exception 'workspace_role_expected_lock_version_conflict' using errcode = '40001';
  end if;

  -- Verify module definition exists and is active, published, and temporally effective
  select * into v_mod from platform.module_definitions where id = p_module_definition_id;
  if not found
     or v_mod.is_active = false
     or v_mod.lifecycle_status <> 'published'
     or v_mod.valid_from > statement_timestamp()
     or (v_mod.valid_to is not null and v_mod.valid_to <= statement_timestamp()) then
    raise exception 'workspace_module_definition_invalid' using errcode = '42501';
  end if;

  if not exists (
    select 1 from platform.workspace_modules
    where customer_workspace_id = v_res.workspace_id
      and module_code = v_mod.code
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    raise exception 'workspace_module_not_active_in_workspace' using errcode = '42501';
  end if;

  insert into platform.workspace_role_modules (tenant_id, workspace_role_id, module_definition_id)
  values (v_res.tenant_id, v_role.id, v_mod.id)
  returning * into v_new_m;

  update platform.workspace_roles
  set lock_version = lock_version + 1
  where id = v_role.id
  returning * into v_role;

  v_response := jsonb_build_object(
    'action', 'attach_module',
    'workspace_role_id', v_role.id,
    'module_code', v_mod.code,
    'lock_version', v_role.lock_version
  );

  insert into platform.workspace_role_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'attach_module',
    v_request_hash, 1, v_new_m.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_ROLE_MODULE_ATTACHED', 'workspace_role_module',
    v_new_m.id, null, to_jsonb(v_new_m), v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.attach_workspace_role_module_v1(uuid, uuid, uuid, integer, text, text) from public, anon;
grant execute on function customer_api.attach_workspace_role_module_v1(uuid, uuid, uuid, integer, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 13. Customer RPC 4: customer_api.detach_workspace_role_module_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.detach_workspace_role_module_v1(
  p_context_id uuid,
  p_workspace_role_id uuid,
  p_module_definition_id uuid,
  p_expected_lock_version integer,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_role platform.workspace_roles%rowtype;
  v_mod platform.module_definitions%rowtype;
  v_normalized_reason text;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_idem platform.workspace_role_idempotency%rowtype;
  v_response jsonb;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_role_idempotency_key_invalid' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'workspace_role_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  select * into v_res
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.role.manage'
  ) then
    raise exception 'workspace_role_manage_permission_required' using errcode = '42501';
  end if;

  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  v_canonical_payload := jsonb_build_object(
    'action', 'detach_module',
    'expected_lock_version', p_expected_lock_version,
    'module_definition_id', p_module_definition_id,
    'reason', v_normalized_reason,
    'workspace_role_id', p_workspace_role_id
  );
  v_request_hash := encode(extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_idem from platform.workspace_role_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'detach_module'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_role_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace_role_lock:' || p_workspace_role_id::text, 0));

  select * into v_role from platform.workspace_roles where id = p_workspace_role_id for update;
  if not found or v_role.customer_workspace_id <> v_res.workspace_id then
    raise exception 'workspace_role_not_found' using errcode = 'P0002';
  end if;

  if v_role.lifecycle_status <> 'draft' then
    raise exception 'workspace_role_not_in_draft_state' using errcode = '42501';
  end if;

  if p_expected_lock_version is null or v_role.lock_version <> p_expected_lock_version then
    raise exception 'workspace_role_expected_lock_version_conflict' using errcode = '40001';
  end if;

  select * into v_mod from platform.module_definitions where id = p_module_definition_id;
  if not found then raise exception 'workspace_module_definition_not_found' using errcode = 'P0002'; end if;

  -- Detach permissions orphaned by this module detachment
  delete from platform.workspace_role_permissions wrp
  where wrp.workspace_role_id = v_role.id
    and not exists (
      select 1
      from platform.workspace_role_modules wrm
      join platform.module_permission_bindings mpb on mpb.module_definition_id = wrm.module_definition_id
      where wrm.workspace_role_id = v_role.id
        and wrm.module_definition_id <> v_mod.id
        and mpb.permission_id = wrp.permission_id
        and mpb.is_assignable_to_local_role = true
        and mpb.lifecycle_status = 'active'
    );

  delete from platform.workspace_role_modules
  where workspace_role_id = v_role.id and module_definition_id = v_mod.id;

  update platform.workspace_roles
  set lock_version = lock_version + 1
  where id = v_role.id
  returning * into v_role;

  v_response := jsonb_build_object(
    'action', 'detach_module',
    'workspace_role_id', v_role.id,
    'module_code', v_mod.code,
    'lock_version', v_role.lock_version
  );

  insert into platform.workspace_role_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'detach_module',
    v_request_hash, 1, v_role.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_ROLE_MODULE_DETACHED', 'workspace_role',
    v_role.id, jsonb_build_object('module_code', v_mod.code), null, v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.detach_workspace_role_module_v1(uuid, uuid, uuid, integer, text, text) from public, anon;
grant execute on function customer_api.detach_workspace_role_module_v1(uuid, uuid, uuid, integer, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 14. Customer RPC 5: customer_api.attach_workspace_role_permission_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.attach_workspace_role_permission_v1(
  p_context_id uuid,
  p_workspace_role_id uuid,
  p_permission_id uuid,
  p_effect text,
  p_expected_lock_version integer,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_role platform.workspace_roles%rowtype;
  v_perm identity.permissions%rowtype;
  v_effect platform.decision_effect;
  v_normalized_reason text;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_idem platform.workspace_role_idempotency%rowtype;
  v_new_p platform.workspace_role_permissions%rowtype;
  v_response jsonb;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_role_idempotency_key_invalid' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'workspace_role_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  if p_effect not in ('allow', 'deny') then
    raise exception 'workspace_role_permission_effect_invalid' using errcode = '22023';
  end if;
  v_effect := p_effect::platform.decision_effect;

  select * into v_res
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.role.manage'
  ) then
    raise exception 'workspace_role_manage_permission_required' using errcode = '42501';
  end if;

  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  v_canonical_payload := jsonb_build_object(
    'action', 'attach_permission',
    'effect', p_effect,
    'expected_lock_version', p_expected_lock_version,
    'permission_id', p_permission_id,
    'reason', v_normalized_reason,
    'workspace_role_id', p_workspace_role_id
  );
  v_request_hash := encode(extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_idem from platform.workspace_role_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'attach_permission'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_role_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace_role_lock:' || p_workspace_role_id::text, 0));

  select * into v_role from platform.workspace_roles where id = p_workspace_role_id for update;
  if not found or v_role.customer_workspace_id <> v_res.workspace_id then
    raise exception 'workspace_role_not_found' using errcode = 'P0002';
  end if;

  if v_role.lifecycle_status <> 'draft' then
    raise exception 'workspace_role_not_in_draft_state' using errcode = '42501';
  end if;

  if p_expected_lock_version is null or v_role.lock_version <> p_expected_lock_version then
    raise exception 'workspace_role_expected_lock_version_conflict' using errcode = '40001';
  end if;

  select * into v_perm from identity.permissions where id = p_permission_id;
  if not found then raise exception 'permission_not_found' using errcode = 'P0002'; end if;

  insert into platform.workspace_role_permissions (tenant_id, workspace_role_id, permission_id, effect)
  values (v_res.tenant_id, v_role.id, v_perm.id, v_effect)
  on conflict (workspace_role_id, permission_id)
  do update set effect = excluded.effect
  returning * into v_new_p;

  update platform.workspace_roles
  set lock_version = lock_version + 1
  where id = v_role.id
  returning * into v_role;

  v_response := jsonb_build_object(
    'action', 'attach_permission',
    'workspace_role_id', v_role.id,
    'permission_code', v_perm.code,
    'effect', v_new_p.effect,
    'lock_version', v_role.lock_version
  );

  insert into platform.workspace_role_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'attach_permission',
    v_request_hash, 1, v_new_p.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_ROLE_PERMISSION_ATTACHED', 'workspace_role_permission',
    v_new_p.id, null, to_jsonb(v_new_p), v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.attach_workspace_role_permission_v1(uuid, uuid, uuid, text, integer, text, text) from public, anon;
grant execute on function customer_api.attach_workspace_role_permission_v1(uuid, uuid, uuid, text, integer, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 15. Customer RPC 6: customer_api.detach_workspace_role_permission_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.detach_workspace_role_permission_v1(
  p_context_id uuid,
  p_workspace_role_id uuid,
  p_permission_id uuid,
  p_expected_lock_version integer,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_role platform.workspace_roles%rowtype;
  v_perm identity.permissions%rowtype;
  v_normalized_reason text;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_idem platform.workspace_role_idempotency%rowtype;
  v_response jsonb;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_role_idempotency_key_invalid' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'workspace_role_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  select * into v_res
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.role.manage'
  ) then
    raise exception 'workspace_role_manage_permission_required' using errcode = '42501';
  end if;

  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  v_canonical_payload := jsonb_build_object(
    'action', 'detach_permission',
    'expected_lock_version', p_expected_lock_version,
    'permission_id', p_permission_id,
    'reason', v_normalized_reason,
    'workspace_role_id', p_workspace_role_id
  );
  v_request_hash := encode(extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_idem from platform.workspace_role_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'detach_permission'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_role_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace_role_lock:' || p_workspace_role_id::text, 0));

  select * into v_role from platform.workspace_roles where id = p_workspace_role_id for update;
  if not found or v_role.customer_workspace_id <> v_res.workspace_id then
    raise exception 'workspace_role_not_found' using errcode = 'P0002';
  end if;

  if v_role.lifecycle_status <> 'draft' then
    raise exception 'workspace_role_not_in_draft_state' using errcode = '42501';
  end if;

  if p_expected_lock_version is null or v_role.lock_version <> p_expected_lock_version then
    raise exception 'workspace_role_expected_lock_version_conflict' using errcode = '40001';
  end if;

  select * into v_perm from identity.permissions where id = p_permission_id;
  if not found then raise exception 'permission_not_found' using errcode = 'P0002'; end if;

  delete from platform.workspace_role_permissions
  where workspace_role_id = v_role.id and permission_id = v_perm.id;

  update platform.workspace_roles
  set lock_version = lock_version + 1
  where id = v_role.id
  returning * into v_role;

  v_response := jsonb_build_object(
    'action', 'detach_permission',
    'workspace_role_id', v_role.id,
    'permission_code', v_perm.code,
    'lock_version', v_role.lock_version
  );

  insert into platform.workspace_role_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'detach_permission',
    v_request_hash, 1, v_role.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_ROLE_PERMISSION_DETACHED', 'workspace_role',
    v_role.id, jsonb_build_object('permission_code', v_perm.code), null, v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.detach_workspace_role_permission_v1(uuid, uuid, uuid, integer, text, text) from public, anon;
grant execute on function customer_api.detach_workspace_role_permission_v1(uuid, uuid, uuid, integer, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 16. Customer RPC 7: customer_api.snapshot_workspace_role_template_permissions_v1
-- ----------------------------------------------------------------------------
create or replace function customer_api.snapshot_workspace_role_template_permissions_v1(
  p_context_id uuid,
  p_workspace_role_id uuid,
  p_expected_lock_version integer,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_role platform.workspace_roles%rowtype;
  v_normalized_reason text;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_idem platform.workspace_role_idempotency%rowtype;
  v_copied_count integer := 0;
  v_omitted_count integer := 0;
  v_response jsonb;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_role_idempotency_key_invalid' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'workspace_role_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  select * into v_res
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.role.manage'
  ) then
    raise exception 'workspace_role_manage_permission_required' using errcode = '42501';
  end if;

  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  v_canonical_payload := jsonb_build_object(
    'action', 'snapshot_template',
    'expected_lock_version', p_expected_lock_version,
    'reason', v_normalized_reason,
    'workspace_role_id', p_workspace_role_id
  );
  v_request_hash := encode(extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_idem from platform.workspace_role_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'snapshot_template'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_role_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace_role_lock:' || p_workspace_role_id::text, 0));

  select * into v_role from platform.workspace_roles where id = p_workspace_role_id for update;
  if not found or v_role.customer_workspace_id <> v_res.workspace_id then
    raise exception 'workspace_role_not_found' using errcode = 'P0002';
  end if;

  if v_role.lifecycle_status <> 'draft' then
    raise exception 'workspace_role_not_in_draft_state' using errcode = '42501';
  end if;

  if v_role.base_role_id is null then
    raise exception 'workspace_role_no_base_template' using errcode = '22023';
  end if;

  if p_expected_lock_version is null or v_role.lock_version <> p_expected_lock_version then
    raise exception 'workspace_role_expected_lock_version_conflict' using errcode = '40001';
  end if;

  -- Insert matching permissions:
  -- Only permissions that exist in base role, are in module_permission_bindings with is_assignable_to_local_role=true,
  -- and whose module is CURRENTLY attached to this draft role.
  insert into platform.workspace_role_permissions (
    tenant_id,
    workspace_role_id,
    permission_id,
    effect
  )
  select distinct
    v_res.tenant_id,
    v_role.id,
    rp.permission_id,
    rp.effect
  from identity.role_permissions rp
  join platform.module_permission_bindings mpb on mpb.permission_id = rp.permission_id
  join platform.workspace_role_modules wrm on wrm.module_definition_id = mpb.module_definition_id
  where rp.role_id = v_role.base_role_id
    and wrm.workspace_role_id = v_role.id
    and mpb.is_assignable_to_local_role = true
    and mpb.lifecycle_status = 'active'
    and (mpb.valid_to is null or mpb.valid_to > statement_timestamp())
  on conflict (workspace_role_id, permission_id) do nothing;

  get diagnostics v_copied_count = row_count;

  -- Count omitted permissions (base role permissions that do NOT match attached modules / assignable bindings)
  select count(*) into v_omitted_count
  from identity.role_permissions rp
  where rp.role_id = v_role.base_role_id
    and not exists (
      select 1
      from platform.workspace_role_modules wrm
      join platform.module_permission_bindings mpb on mpb.module_definition_id = wrm.module_definition_id
      where wrm.workspace_role_id = v_role.id
        and mpb.permission_id = rp.permission_id
        and mpb.is_assignable_to_local_role = true
        and mpb.lifecycle_status = 'active'
    );

  update platform.workspace_roles
  set lock_version = lock_version + 1
  where id = v_role.id
  returning * into v_role;

  v_response := jsonb_build_object(
    'action', 'snapshot_template',
    'workspace_role_id', v_role.id,
    'copied_count', v_copied_count,
    'omitted_count', v_omitted_count,
    'lock_version', v_role.lock_version
  );

  insert into platform.workspace_role_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'snapshot_template',
    v_request_hash, 1, v_role.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_ROLE_TEMPLATE_SNAPSHOTTED', 'workspace_role',
    v_role.id, jsonb_build_object('copied_count', v_copied_count, 'omitted_count', v_omitted_count),
    to_jsonb(v_role), v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.snapshot_workspace_role_template_permissions_v1(uuid, uuid, integer, text, text) from public, anon;
grant execute on function customer_api.snapshot_workspace_role_template_permissions_v1(uuid, uuid, integer, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 17. Customer RPC 8: customer_api.publish_workspace_role_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.publish_workspace_role_v1(
  p_context_id uuid,
  p_workspace_role_id uuid,
  p_expected_lock_version integer,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_role platform.workspace_roles%rowtype;
  v_prior platform.workspace_roles%rowtype;
  v_normalized_reason text;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_idem platform.workspace_role_idempotency%rowtype;
  v_response jsonb;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_role_idempotency_key_invalid' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'workspace_role_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  select * into v_res
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.role.publish'
  ) then
    raise exception 'workspace_role_publish_permission_required' using errcode = '42501';
  end if;

  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  v_canonical_payload := jsonb_build_object(
    'action', 'publish',
    'expected_lock_version', p_expected_lock_version,
    'reason', v_normalized_reason,
    'workspace_role_id', p_workspace_role_id
  );
  v_request_hash := encode(extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_idem from platform.workspace_role_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'publish'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_role_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  select * into v_role from platform.workspace_roles where id = p_workspace_role_id;
  if not found or v_role.customer_workspace_id <> v_res.workspace_id then
    raise exception 'workspace_role_not_found' using errcode = 'P0002';
  end if;

  -- Advisory lock on code within workspace to serialize publish concurrency
  perform pg_advisory_xact_lock(hashtextextended('workspace_role_publish:' || v_res.workspace_id::text || ':' || v_role.code, 0));

  select * into v_role from platform.workspace_roles where id = p_workspace_role_id for update;

  if p_expected_lock_version is null or v_role.lock_version <> p_expected_lock_version then
    raise exception 'workspace_role_expected_lock_version_conflict' using errcode = '40001';
  end if;

  if v_role.lifecycle_status <> 'draft' then
    raise exception 'workspace_role_not_in_draft_state' using errcode = '42501';
  end if;

  -- Minimum 1 module and 1 permission
  if not exists (select 1 from platform.workspace_role_modules where workspace_role_id = v_role.id) then
    raise exception 'workspace_role_publish_requires_at_least_one_module' using errcode = '42501';
  end if;

  if not exists (select 1 from platform.workspace_role_permissions where workspace_role_id = v_role.id) then
    raise exception 'workspace_role_publish_requires_at_least_one_permission' using errcode = '42501';
  end if;

  -- Re-validate that all attached modules are currently active, published, and temporally effective
  if exists (
    select 1
    from platform.workspace_role_modules wrm
    join platform.module_definitions md on md.id = wrm.module_definition_id
    where wrm.workspace_role_id = v_role.id
      and (
        md.is_active = false
        or md.lifecycle_status <> 'published'
        or md.valid_from > statement_timestamp()
        or (md.valid_to is not null and md.valid_to <= statement_timestamp())
      )
  ) then
    raise exception 'workspace_role_publish_module_invalid' using errcode = '42501';
  end if;

  -- Re-validate that all attached permissions have an active, assignable, and temporally effective binding
  if exists (
    select 1
    from platform.workspace_role_permissions wrp
    where wrp.workspace_role_id = v_role.id
      and not exists (
        select 1
        from platform.workspace_role_modules wrm
        join platform.module_permission_bindings mpb
          on mpb.module_definition_id = wrm.module_definition_id
        where wrm.workspace_role_id = wrp.workspace_role_id
          and mpb.permission_id = wrp.permission_id
          and mpb.is_assignable_to_local_role = true
          and mpb.lifecycle_status = 'active'
          and mpb.valid_from <= statement_timestamp()
          and (mpb.valid_to is null or mpb.valid_to > statement_timestamp())
      )
  ) then
    raise exception 'workspace_role_publish_permission_binding_invalid' using errcode = '42501';
  end if;

  -- Atomically archive currently active published role with same code
  select * into v_prior
  from platform.workspace_roles
  where customer_workspace_id = v_res.workspace_id
    and code = v_role.code
    and lifecycle_status = 'published'
    and valid_to is null
  for update;

  if v_prior.id is not null then
    update platform.workspace_roles
    set lifecycle_status = 'archived',
        valid_to = statement_timestamp(),
        lock_version = lock_version + 1
    where id = v_prior.id;
  end if;

  -- Publish target draft
  update platform.workspace_roles
  set lifecycle_status = 'published',
      valid_from = statement_timestamp(),
      valid_to = null,
      lock_version = lock_version + 1
  where id = v_role.id
  returning * into v_role;

  v_response := jsonb_build_object(
    'action', 'publish',
    'id', v_role.id,
    'code', v_role.code,
    'role_version', v_role.role_version,
    'lifecycle_status', v_role.lifecycle_status,
    'superseded_role_id', v_prior.id,
    'lock_version', v_role.lock_version
  );

  insert into platform.workspace_role_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'publish',
    v_request_hash, 1, v_role.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_ROLE_PUBLISHED', 'workspace_role',
    v_role.id, case when v_prior.id is not null then to_jsonb(v_prior) else null end,
    to_jsonb(v_role), v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.publish_workspace_role_v1(uuid, uuid, integer, text, text) from public, anon;
grant execute on function customer_api.publish_workspace_role_v1(uuid, uuid, integer, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 18. Customer RPC 9: customer_api.assign_workspace_role_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.assign_workspace_role_v1(
  p_context_id uuid,
  p_target_membership_id uuid,
  p_workspace_role_id uuid,
  p_scope_type text,
  p_property_id uuid,
  p_building_id uuid,
  p_unit_id uuid,
  p_valid_until timestamptz,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_role platform.workspace_roles%rowtype;
  v_mem identity.memberships%rowtype;
  v_normalized_reason text;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_idem platform.workspace_role_idempotency%rowtype;
  v_assignment platform.workspace_member_roles%rowtype;
  v_response jsonb;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_role_idempotency_key_invalid' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'workspace_role_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  select * into v_res
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.role.assign'
  ) then
    raise exception 'workspace_role_assign_permission_required' using errcode = '42501';
  end if;

  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  v_canonical_payload := jsonb_build_object(
    'action', 'assign_role',
    'building_id', p_building_id,
    'membership_id', p_target_membership_id,
    'property_id', p_property_id,
    'reason', v_normalized_reason,
    'scope_type', p_scope_type,
    'unit_id', p_unit_id,
    'valid_until', p_valid_until,
    'workspace_role_id', p_workspace_role_id
  );
  v_request_hash := encode(extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_idem from platform.workspace_role_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'assign_role'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_role_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace_member_role:' || v_res.workspace_id::text || ':' || p_target_membership_id::text, 0));

  select * into v_role from platform.workspace_roles where id = p_workspace_role_id;
  if not found or v_role.customer_workspace_id <> v_res.workspace_id then
    raise exception 'workspace_role_not_found' using errcode = 'P0002';
  end if;

  if v_role.lifecycle_status <> 'published' or (v_role.valid_to is not null and v_role.valid_to <= statement_timestamp()) then
    raise exception 'workspace_role_not_published' using errcode = '42501';
  end if;

  select * into v_mem from identity.memberships where id = p_target_membership_id;
  if not found
     or v_mem.tenant_id <> v_res.tenant_id
     or v_mem.status <> 'active'
     or v_mem.starts_at > statement_timestamp()
     or (v_mem.ends_at is not null and v_mem.ends_at <= statement_timestamp()) then
    raise exception 'workspace_member_role_target_membership_invalid' using errcode = '42501';
  end if;

  insert into platform.workspace_member_roles (
    tenant_id,
    customer_workspace_id,
    membership_id,
    workspace_role_id,
    scope_type,
    property_id,
    building_id,
    unit_id,
    valid_from,
    valid_to,
    assigned_by_user_id,
    assigned_by_membership_id,
    lock_version,
    reason
  ) values (
    v_res.tenant_id,
    v_res.workspace_id,
    p_target_membership_id,
    v_role.id,
    p_scope_type,
    p_property_id,
    p_building_id,
    p_unit_id,
    statement_timestamp(),
    p_valid_until,
    auth.uid(),
    v_res.membership_id,
    1,
    v_normalized_reason
  ) returning * into v_assignment;

  v_response := jsonb_build_object(
    'action', 'assign_role',
    'id', v_assignment.id,
    'membership_id', v_assignment.membership_id,
    'workspace_role_id', v_assignment.workspace_role_id,
    'scope_type', v_assignment.scope_type,
    'valid_from', v_assignment.valid_from,
    'valid_to', v_assignment.valid_to,
    'lock_version', v_assignment.lock_version
  );

  insert into platform.workspace_role_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'assign_role',
    v_request_hash, 1, v_assignment.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_ROLE_ASSIGNED', 'workspace_member_role',
    v_assignment.id, null, to_jsonb(v_assignment), v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.assign_workspace_role_v1(uuid, uuid, uuid, text, uuid, uuid, uuid, timestamptz, text, text) from public, anon;
grant execute on function customer_api.assign_workspace_role_v1(uuid, uuid, uuid, text, uuid, uuid, uuid, timestamptz, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 19. Customer RPC 10: customer_api.revoke_workspace_role_assignment_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.revoke_workspace_role_assignment_v1(
  p_context_id uuid,
  p_assignment_id uuid,
  p_expected_lock_version integer,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_assignment platform.workspace_member_roles%rowtype;
  v_assignment_after platform.workspace_member_roles%rowtype;
  v_before_snapshot jsonb;
  v_normalized_reason text;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_idem platform.workspace_role_idempotency%rowtype;
  v_response jsonb;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_role_idempotency_key_invalid' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'workspace_role_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  select * into v_res
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.role.assign'
  ) then
    raise exception 'workspace_role_assign_permission_required' using errcode = '42501';
  end if;

  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  v_canonical_payload := jsonb_build_object(
    'action', 'revoke_assignment',
    'assignment_id', p_assignment_id,
    'expected_lock_version', p_expected_lock_version,
    'reason', v_normalized_reason
  );
  v_request_hash := encode(extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'), 'hex');

  select * into v_idem from platform.workspace_role_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'revoke_assignment'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_role_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace_member_role_revoke:' || p_assignment_id::text, 0));

  select * into v_assignment
  from platform.workspace_member_roles
  where id = p_assignment_id
  for update;

  if not found or v_assignment.customer_workspace_id <> v_res.workspace_id then
    raise exception 'workspace_member_role_not_found' using errcode = 'P0002';
  end if;

  if v_assignment.valid_to is not null and v_assignment.valid_to <= statement_timestamp() then
    raise exception 'workspace_member_role_already_revoked' using errcode = '42501';
  end if;

  if p_expected_lock_version is null or v_assignment.lock_version <> p_expected_lock_version then
    raise exception 'workspace_member_role_expected_lock_version_conflict' using errcode = '40001';
  end if;

  v_before_snapshot := to_jsonb(v_assignment);

  update platform.workspace_member_roles
  set valid_to = statement_timestamp(),
      lock_version = lock_version + 1,
      reason = v_normalized_reason
  where id = v_assignment.id
  returning * into v_assignment_after;

  v_response := jsonb_build_object(
    'action', 'revoke_assignment',
    'id', v_assignment_after.id,
    'valid_to', v_assignment_after.valid_to,
    'lock_version', v_assignment_after.lock_version
  );

  insert into platform.workspace_role_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'revoke_assignment',
    v_request_hash, 1, v_assignment_after.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_ROLE_ASSIGNMENT_REVOKED', 'workspace_member_role',
    v_assignment_after.id, v_before_snapshot, to_jsonb(v_assignment_after), v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.revoke_workspace_role_assignment_v1(uuid, uuid, integer, text, text) from public, anon;
grant execute on function customer_api.revoke_workspace_role_assignment_v1(uuid, uuid, integer, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 20. RLS Deny-By-Default & Service Role Grants for the 6 Tables
-- ----------------------------------------------------------------------------
alter table platform.module_permission_bindings enable row level security;
alter table platform.workspace_roles enable row level security;
alter table platform.workspace_role_modules enable row level security;
alter table platform.workspace_role_permissions enable row level security;
alter table platform.workspace_member_roles enable row level security;
alter table platform.workspace_role_idempotency enable row level security;

revoke all on platform.module_permission_bindings from public, anon, authenticated;
revoke all on platform.workspace_roles from public, anon, authenticated;
revoke all on platform.workspace_role_modules from public, anon, authenticated;
revoke all on platform.workspace_role_permissions from public, anon, authenticated;
revoke all on platform.workspace_member_roles from public, anon, authenticated;
revoke all on platform.workspace_role_idempotency from public, anon, authenticated;

grant select, insert, update, delete on platform.module_permission_bindings to service_role;
grant select, insert, update, delete on platform.workspace_roles to service_role;
grant select, insert, update, delete on platform.workspace_role_modules to service_role;
grant select, insert, update, delete on platform.workspace_role_permissions to service_role;
grant select, insert, update, delete on platform.workspace_member_roles to service_role;
grant select, insert, update, delete on platform.workspace_role_idempotency to service_role;

commit;
