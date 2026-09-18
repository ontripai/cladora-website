begin;

-- ============================================================================
-- Migration 104: Controlled Workspace Delegation, Independent Approvals,
-- Four-Eyes Control & Effective Permission Integration (001B.2)
-- Package: CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.2
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Seed Dedicated Delegation Permissions
-- ----------------------------------------------------------------------------
insert into identity.permissions (code, resource, action, description)
values
  ('workspace.delegation.read', 'workspace.delegation', 'read', 'View workspace delegations, permission bindings, and audit trails'),
  ('workspace.delegation.manage', 'workspace.delegation', 'manage', 'Create delegation drafts, attach/detach permissions, and submit for acceptance'),
  ('workspace.delegation.approve', 'workspace.delegation', 'approve', 'Execute independent Four-Eyes approval or rejection decisions'),
  ('workspace.delegation.revoke', 'workspace.delegation', 'revoke', 'Execute administrative or emergency revocation of active delegations')
on conflict (code) do nothing;

create or replace function app_private.validate_workspace_delegation_permissions_seeding_v1()
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
    where code in ('workspace.delegation.read', 'workspace.delegation.manage', 'workspace.delegation.approve', 'workspace.delegation.revoke')
  loop
    if v_perm.resource <> 'workspace.delegation' then
      raise exception 'permission_specification_mismatch: invalid resource for %', v_perm.code using errcode = '22023';
    end if;
  end loop;

  if (select count(*) from identity.permissions where code in ('workspace.delegation.read', 'workspace.delegation.manage', 'workspace.delegation.approve', 'workspace.delegation.revoke')) <> 4 then
    raise exception 'workspace_delegation_permissions_seeding_incomplete' using errcode = 'P0002';
  end if;

  if not exists (select 1 from identity.roles where code = 'association_admin' and tenant_id is null and is_system = true) then
    raise exception 'required_target_role_missing: association_admin' using errcode = 'P0002';
  end if;
  if not exists (select 1 from identity.roles where code = 'property_manager' and tenant_id is null and is_system = true) then
    raise exception 'required_target_role_missing: property_manager' using errcode = 'P0002';
  end if;
  if not exists (select 1 from identity.roles where code = 'president' and tenant_id is null and is_system = true) then
    raise exception 'required_target_role_missing: president' using errcode = 'P0002';
  end if;
  if not exists (select 1 from identity.roles where code = 'censor' and tenant_id is null and is_system = true) then
    raise exception 'required_target_role_missing: censor' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function app_private.validate_workspace_delegation_permissions_seeding_v1() from public, anon, authenticated;
select app_private.validate_workspace_delegation_permissions_seeding_v1();

-- Grant to canonical system roles
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'::platform.decision_effect
from identity.roles r
cross join identity.permissions p
where r.code = 'association_admin'
  and r.tenant_id is null and r.is_system = true
  and p.code in ('workspace.delegation.read', 'workspace.delegation.manage', 'workspace.delegation.approve', 'workspace.delegation.revoke')
on conflict do nothing;

insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'::platform.decision_effect
from identity.roles r
cross join identity.permissions p
where r.code = 'property_manager'
  and r.tenant_id is null and r.is_system = true
  and p.code in ('workspace.delegation.read', 'workspace.delegation.manage', 'workspace.delegation.approve', 'workspace.delegation.revoke')
on conflict do nothing;

insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'::platform.decision_effect
from identity.roles r
cross join identity.permissions p
where r.code = 'president'
  and r.tenant_id is null and r.is_system = true
  and p.code in ('workspace.delegation.read', 'workspace.delegation.approve', 'workspace.delegation.revoke')
on conflict do nothing;

insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'::platform.decision_effect
from identity.roles r
cross join identity.permissions p
where r.code = 'censor'
  and r.tenant_id is null and r.is_system = true
  and p.code in ('workspace.delegation.read', 'workspace.delegation.approve')
on conflict do nothing;

-- Bootstrap future system roles trigger
create or replace function app_private.bootstrap_role_workspace_delegation_permissions_v1()
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
      where p.code in ('workspace.delegation.read', 'workspace.delegation.manage', 'workspace.delegation.approve', 'workspace.delegation.revoke')
      on conflict do nothing;
    elsif new.code = 'president' then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code in ('workspace.delegation.read', 'workspace.delegation.approve', 'workspace.delegation.revoke')
      on conflict do nothing;
    elsif new.code = 'censor' then
      insert into identity.role_permissions (role_id, permission_id, effect)
      select new.id, p.id, 'allow'::platform.decision_effect
      from identity.permissions p
      where p.code in ('workspace.delegation.read', 'workspace.delegation.approve')
      on conflict do nothing;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.bootstrap_role_workspace_delegation_permissions_v1() from public, anon, authenticated;

drop trigger if exists trg_bootstrap_role_workspace_delegation_permissions on identity.roles;
create trigger trg_bootstrap_role_workspace_delegation_permissions
after insert on identity.roles
for each row
execute function app_private.bootstrap_role_workspace_delegation_permissions_v1();


-- ----------------------------------------------------------------------------
-- 2. Upgrade Module Permission Binding Invariant Guard & Forward Versioning
-- ----------------------------------------------------------------------------
create or replace function app_private.guard_module_permission_binding_invariants_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, identity
as $$
declare
  v_mod_status text;
  v_perm_code text;
begin
  if tg_op = 'UPDATE' then
    -- Allow controlled forward-close handoff: only lifecycle_status active -> deprecated and valid_to null -> timestamp
    if old.binding_version = new.binding_version
       and old.module_definition_id = new.module_definition_id
       and old.permission_id = new.permission_id
       and old.is_assignable_to_local_role = new.is_assignable_to_local_role
       and old.is_delegable = new.is_delegable
       and old.requires_aal2 = new.requires_aal2
       and old.valid_from = new.valid_from
       and old.lifecycle_status = 'active'
       and new.lifecycle_status = 'deprecated'
       and old.valid_to is null
       and new.valid_to is not null
    then
      return new;
    end if;
    raise exception 'module_permission_binding_historical_records_are_immutable' using errcode = '42501';
  end if;

  -- Validation for INSERT
  select code into v_perm_code from identity.permissions where id = new.permission_id;
  select lifecycle_status into v_mod_status from platform.module_definitions where id = new.module_definition_id;

  if v_mod_status = 'catalog_only' then
    raise exception 'catalog_only_modules_cannot_have_permission_bindings' using errcode = '42501';
  end if;

  -- Strict Non-Delegable Invariant
  if new.is_delegable is true then
    if v_perm_code in (
      'billing.cancel',
      'payments.reverse',
      'payments.reconcile',
      'utilities.tariffs.manage',
      'governance.votes.administer',
      'governance.minutes.finalize',
      'workspace.role.read',
      'workspace.role.manage',
      'workspace.role.publish',
      'workspace.role.assign',
      'workspace.delegation.read',
      'workspace.delegation.manage',
      'workspace.delegation.approve',
      'workspace.delegation.revoke'
    ) then
      raise exception 'permission_is_strictly_non_delegable: %', v_perm_code using errcode = '42501';
    end if;
  end if;

  -- Prevent temporal overlap among active records
  if new.lifecycle_status = 'active' and exists (
    select 1 from platform.module_permission_bindings b
    where b.module_definition_id = new.module_definition_id
      and b.permission_id = new.permission_id
      and b.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and b.lifecycle_status = 'active'
      and (
        (new.valid_to is null and b.valid_to is null) or
        (new.valid_to is null and b.valid_to > new.valid_from) or
        (b.valid_to is null and new.valid_to > b.valid_from) or
        (new.valid_from < b.valid_to and new.valid_to > b.valid_from)
      )
  ) then
    raise exception 'active_module_permission_binding_temporal_overlap' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Execute atomic forward handoff for exactly 42 delegable bindings
do $$
declare
  v_transition_ts timestamptz := statement_timestamp();
begin
  perform pg_advisory_xact_lock(hashtextextended('platform:module_permission_bindings_registry', 0));

  with delegable_manifest(module_code, perm_code) as (
    values
      ('occupancy', 'occupancy.occupancies.manage'),
      ('occupancy', 'occupancy.registry.read'),
      ('billing', 'billing.manage'),
      ('billing', 'billing.issue'),
      ('billing', 'billing.receivables.read'),
      ('payments', 'payments.manage'),
      ('payments', 'payments.allocate'),
      ('payments', 'payments.reconciliation.read'),
      ('accounting', 'finance.ledger.read'),
      ('maintenance', 'maintenance.requests.read'),
      ('maintenance', 'maintenance.requests.create'),
      ('maintenance', 'maintenance.requests.manage'),
      ('maintenance', 'maintenance.requests.assign'),
      ('maintenance', 'maintenance.work_orders.read'),
      ('maintenance', 'maintenance.work_orders.manage'),
      ('maintenance', 'maintenance.work_orders.verify'),
      ('maintenance', 'maintenance.procurement.read'),
      ('maintenance', 'maintenance.procurement.manage'),
      ('maintenance', 'maintenance.procurement.approve'),
      ('maintenance', 'maintenance.assets.read'),
      ('utilities', 'utilities.manage'),
      ('utilities', 'utilities.readings.capture'),
      ('utilities', 'utilities.readings.approve'),
      ('utilities', 'utilities.billing.create'),
      ('utilities', 'utilities.metering.read'),
      ('governance', 'governance.meetings.manage'),
      ('governance', 'governance.agenda.manage'),
      ('governance', 'governance.attendance.manage'),
      ('governance', 'governance.proxies.manage'),
      ('governance', 'governance.votes.cast'),
      ('governance', 'governance.resolutions.read'),
      ('governance', 'governance.resolutions.manage'),
      ('governance', 'governance.minutes.read'),
      ('governance', 'governance.meetings.read'),
      ('communications', 'communications.notices.read'),
      ('communications', 'communications.notices.manage'),
      ('communications', 'communications.notices.publish'),
      ('communications', 'communications.feed.read'),
      ('documents', 'documents.vault.manage'),
      ('documents', 'documents.vault.upload'),
      ('documents', 'documents.vault.read'),
      ('security', 'security.access.read')
  ),
  locked_v1 as (
    select b.id, b.module_definition_id, b.permission_id, b.permission_mode, b.requires_aal2
    from platform.module_permission_bindings b
    join platform.module_definitions m on m.id = b.module_definition_id
    join identity.permissions p on p.id = b.permission_id
    join delegable_manifest dm on dm.module_code = m.code and dm.perm_code = p.code
    where b.binding_version = 1 and b.lifecycle_status = 'active'
    for update
  ),
  closed_v1 as (
    update platform.module_permission_bindings b
    set lifecycle_status = 'deprecated',
        valid_to = v_transition_ts
    from locked_v1 l
    where b.id = l.id
    returning l.module_definition_id, l.permission_id, l.permission_mode, l.requires_aal2
  )
  insert into platform.module_permission_bindings (
    module_definition_id, permission_id, binding_version,
    permission_mode, is_assignable_to_local_role, is_delegable,
    requires_aal2, lifecycle_status, valid_from, valid_to
  )
  select
    c.module_definition_id, c.permission_id, 2,
    c.permission_mode, true, true,
    c.requires_aal2, 'active', v_transition_ts, null
  from closed_v1 c;
end;
$$;

-- Validation function for module permission bindings seeding
create or replace function app_private.validate_module_permission_bindings_v2_seeding_v1()
returns void
language plpgsql
security definer
set search_path = pg_catalog, platform, identity
as $$
declare
  v_total_count integer;
  v_active_count integer;
  v_delegable_active_count integer;
  v_non_delegable_active_count integer;
  v_v2_non_delegable_count integer;
begin
  select count(*) into v_total_count from platform.module_permission_bindings;
  if v_total_count <> 90 then
    raise exception 'module_permission_bindings_total_count_mismatch: expected 90, got %', v_total_count using errcode = 'P0002';
  end if;

  select count(*) into v_active_count from platform.module_permission_bindings where lifecycle_status = 'active';
  if v_active_count <> 48 then
    raise exception 'module_permission_bindings_active_count_mismatch: expected 48, got %', v_active_count using errcode = 'P0002';
  end if;

  select count(*) into v_delegable_active_count from platform.module_permission_bindings where lifecycle_status = 'active' and is_delegable = true;
  if v_delegable_active_count <> 42 then
    raise exception 'delegable_active_count_mismatch: expected 42, got %', v_delegable_active_count using errcode = 'P0002';
  end if;

  select count(*) into v_non_delegable_active_count from platform.module_permission_bindings where lifecycle_status = 'active' and is_delegable = false;
  if v_non_delegable_active_count <> 6 then
    raise exception 'non_delegable_active_count_mismatch: expected 6, got %', v_non_delegable_active_count using errcode = 'P0002';
  end if;

  -- Ensure 6 non-delegable permissions have zero v2 records
  select count(*) into v_v2_non_delegable_count
  from platform.module_permission_bindings b
  join identity.permissions p on p.id = b.permission_id
  where p.code in ('billing.cancel', 'payments.reverse', 'payments.reconcile', 'utilities.tariffs.manage', 'governance.votes.administer', 'governance.minutes.finalize')
    and b.binding_version = 2;

  if v_v2_non_delegable_count <> 0 then
    raise exception 'non_delegable_permissions_must_not_have_v2_records' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function app_private.validate_module_permission_bindings_v2_seeding_v1() from public, anon, authenticated;
select app_private.validate_module_permission_bindings_v2_seeding_v1();


-- ----------------------------------------------------------------------------
-- 3. Table: platform.workspace_delegations
-- ----------------------------------------------------------------------------
create table platform.workspace_delegations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  delegation_code text not null,
  grantor_membership_id uuid not null references identity.memberships(id) on delete restrict,
  grantee_membership_id uuid not null references identity.memberships(id) on delete restrict,
  grantor_user_id uuid not null references auth.users(id) on delete restrict,
  grantee_user_id uuid not null references auth.users(id) on delete restrict,
  scope_type text not null check (scope_type in ('workspace', 'property', 'building', 'unit')),
  property_id uuid references portfolio.properties(id) on delete restrict,
  building_id uuid references portfolio.buildings(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict,
  lifecycle_status text not null default 'draft' check (
    lifecycle_status in ('draft', 'pending_acceptance', 'pending_approval', 'active', 'revoked', 'rejected')
  ),
  delegation_depth integer not null default 0 check (delegation_depth = 0),
  purpose text not null check (length(trim(purpose)) between 5 and 500),
  valid_from timestamptz not null,
  valid_until timestamptz not null,
  lock_version integer not null default 1 check (lock_version >= 1),
  approval_policy_code text check (approval_policy_code is null or approval_policy_code in ('single_manager', 'four_eyes_financial', 'four_eyes_sensitive')),
  required_approval_count integer not null default 1 check (required_approval_count = 1),
  payload_hash text,
  submitted_at timestamptz,
  accepted_at timestamptz,
  activated_at timestamptz,
  rejected_at timestamptz,
  rejected_by_user_id uuid references auth.users(id) on delete restrict,
  rejection_reason text,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete restrict,
  revocation_reason text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (grantor_membership_id <> grantee_membership_id),
  check (grantor_user_id <> grantee_user_id),
  check (valid_until > valid_from),
  check (
    (scope_type = 'workspace' and property_id is null and building_id is null and unit_id is null) or
    (scope_type = 'property' and property_id is not null and building_id is null and unit_id is null) or
    (scope_type = 'building' and property_id is not null and building_id is not null and unit_id is null) or
    (scope_type = 'unit' and property_id is not null and building_id is not null and unit_id is not null)
  ),
  unique (customer_workspace_id, delegation_code)
);

create index ws_delegations_lookup_idx
  on platform.workspace_delegations (customer_workspace_id, lifecycle_status, valid_from, valid_until);

create index ws_delegations_grantee_idx
  on platform.workspace_delegations (customer_workspace_id, grantee_membership_id, lifecycle_status);

create index ws_delegations_grantor_idx
  on platform.workspace_delegations (customer_workspace_id, grantor_membership_id, lifecycle_status);

-- Immutability and protection trigger on workspace_delegations
create or replace function app_private.guard_workspace_delegation_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'workspace_delegations_deletion_prohibited' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if old.customer_workspace_id <> new.customer_workspace_id or
       old.tenant_id <> new.tenant_id or
       old.delegation_code <> new.delegation_code or
       old.grantor_membership_id <> new.grantor_membership_id or
       old.grantee_membership_id <> new.grantee_membership_id or
       old.grantor_user_id <> new.grantor_user_id or
       old.grantee_user_id <> new.grantee_user_id or
       old.delegation_depth <> new.delegation_depth or
       old.created_by <> new.created_by or
       old.created_at <> new.created_at
    then
      raise exception 'workspace_delegation_core_identity_immutable' using errcode = '42501';
    end if;

    -- Once submitted, scope, timeframes, purpose, and policy become immutable
    if old.lifecycle_status <> 'draft' then
      if old.scope_type <> new.scope_type or
         old.property_id is distinct from new.property_id or
         old.building_id is distinct from new.building_id or
         old.unit_id is distinct from new.unit_id or
         old.valid_from <> new.valid_from or
         old.valid_until <> new.valid_until or
         old.purpose <> new.purpose or
         old.approval_policy_code is distinct from new.approval_policy_code or
         old.required_approval_count <> new.required_approval_count or
         old.payload_hash is distinct from new.payload_hash
      then
        raise exception 'workspace_delegation_submitted_parameters_are_immutable' using errcode = '42501';
      end if;
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_workspace_delegation_immutability_v1() from public, anon, authenticated;

create trigger trg_guard_workspace_delegation_immutability
before update or delete on platform.workspace_delegations
for each row
execute function app_private.guard_workspace_delegation_immutability_v1();


-- ----------------------------------------------------------------------------
-- 4. Table: platform.workspace_delegation_permissions (Pure Delegated Allow)
-- ----------------------------------------------------------------------------
create table platform.workspace_delegation_permissions (
  id uuid primary key default gen_random_uuid(),
  delegation_id uuid not null references platform.workspace_delegations(id) on delete restrict,
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  permission_id uuid not null references identity.permissions(id) on delete restrict,
  module_permission_binding_id uuid not null references platform.module_permission_bindings(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (delegation_id, module_definition_id, permission_id)
);

create index ws_del_perms_delegation_idx
  on platform.workspace_delegation_permissions (delegation_id);

create or replace function app_private.guard_workspace_delegation_permission_bindings_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_del_status text;
  v_binding platform.module_permission_bindings%rowtype;
begin
  if tg_op = 'DELETE' then
    select lifecycle_status into v_del_status
    from platform.workspace_delegations where id = old.delegation_id;
    if v_del_status <> 'draft' then
      raise exception 'draft_mutations_only' using errcode = 'P0001';
    end if;
    return old;
  end if;

  if tg_op = 'INSERT' then
    select lifecycle_status into v_del_status
    from platform.workspace_delegations where id = new.delegation_id;
    if v_del_status <> 'draft' then
      raise exception 'draft_mutations_only' using errcode = 'P0001';
    end if;

    select * into v_binding
    from platform.module_permission_bindings where id = new.module_permission_binding_id;
    if not found or v_binding.is_delegable is not true or v_binding.lifecycle_status <> 'active' then
      raise exception 'delegation_binding_not_delegable' using errcode = '42501';
    end if;

    if v_binding.module_definition_id <> new.module_definition_id or v_binding.permission_id <> new.permission_id then
      raise exception 'delegation_permission_binding_mismatch' using errcode = '22023';
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' then
    raise exception 'workspace_delegation_permissions_updates_prohibited' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_workspace_delegation_permission_bindings_v1() from public, anon, authenticated;

create trigger trg_guard_workspace_delegation_permission_bindings
before insert or update or delete on platform.workspace_delegation_permissions
for each row
execute function app_private.guard_workspace_delegation_permission_bindings_v1();


-- ----------------------------------------------------------------------------
-- 5. Table: platform.workspace_delegation_approvals (Independent Four-Eyes)
-- ----------------------------------------------------------------------------
create table platform.workspace_delegation_approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  delegation_id uuid not null references platform.workspace_delegations(id) on delete restrict,
  approval_step integer not null default 1 check (approval_step = 1),
  approver_membership_id uuid not null references identity.memberships(id) on delete restrict,
  approver_user_id uuid not null references auth.users(id) on delete restrict,
  approver_role text not null,
  decision text not null check (decision in ('approved', 'rejected')),
  decision_reason text not null check (length(trim(decision_reason)) between 5 and 500),
  payload_hash text not null,
  decided_at timestamptz not null default statement_timestamp(),
  unique (delegation_id, approval_step),
  unique (delegation_id, approver_user_id)
);

create index ws_del_approvals_del_idx
  on platform.workspace_delegation_approvals (delegation_id);

create or replace function app_private.guard_workspace_delegation_approvals_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_del platform.workspace_delegations%rowtype;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    raise exception 'workspace_delegation_approvals_are_immutable' using errcode = '42501';
  end if;

  select * into v_del from platform.workspace_delegations where id = new.delegation_id;
  if not found then
    raise exception 'delegation_not_found' using errcode = 'P0002';
  end if;

  if new.approver_user_id = v_del.grantor_user_id or new.approver_user_id = v_del.grantee_user_id then
    raise exception 'delegation_self_approval_prohibited' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_workspace_delegation_approvals_immutability_v1() from public, anon, authenticated;

create trigger trg_guard_workspace_delegation_approvals_immutability
before insert or update or delete on platform.workspace_delegation_approvals
for each row
execute function app_private.guard_workspace_delegation_approvals_immutability_v1();


-- ----------------------------------------------------------------------------
-- 6. Table: platform.workspace_delegation_idempotency
-- ----------------------------------------------------------------------------
create table platform.workspace_delegation_idempotency (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  idempotency_key text not null,
  action text not null,
  request_hash text not null,
  request_hash_version integer not null default 1,
  result_entity_id uuid,
  response_snapshot jsonb not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, idempotency_key)
);

create index ws_del_idempotency_lookup_idx
  on platform.workspace_delegation_idempotency (tenant_id, idempotency_key, action);


-- ----------------------------------------------------------------------------
-- 7. RLS & Grants on New Tables (Deny-By-Default)
-- ----------------------------------------------------------------------------
alter table platform.workspace_delegations enable row level security;
alter table platform.workspace_delegation_permissions enable row level security;
alter table platform.workspace_delegation_approvals enable row level security;
alter table platform.workspace_delegation_idempotency enable row level security;

revoke all on platform.workspace_delegations,
               platform.workspace_delegation_permissions,
               platform.workspace_delegation_approvals,
               platform.workspace_delegation_idempotency from public, anon, authenticated;

grant select, insert, update, delete on platform.workspace_delegations,
                                       platform.workspace_delegation_permissions,
                                       platform.workspace_delegation_approvals,
                                       platform.workspace_delegation_idempotency to service_role;


-- ----------------------------------------------------------------------------
-- 8. Internal Helpers & Payload Hash Engine
-- ----------------------------------------------------------------------------
create or replace function app_private.compute_delegation_payload_hash_v1(p_delegation_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, extensions
as $$
declare
  v_del platform.workspace_delegations%rowtype;
  v_perms text;
  v_canonical text;
begin
  select * into v_del from platform.workspace_delegations where id = p_delegation_id;
  if not found then return null; end if;

  select coalesce(string_agg(
    p.code || ':' || wdp.module_definition_id::text || ':' || wdp.module_permission_binding_id::text,
    ',' order by p.code
  ), '')
  into v_perms
  from platform.workspace_delegation_permissions wdp
  join identity.permissions p on p.id = wdp.permission_id
  where wdp.delegation_id = p_delegation_id;

  v_canonical := 'v1|' || v_del.id::text || '|' ||
                 v_del.tenant_id::text || '|' ||
                 v_del.customer_workspace_id::text || '|' ||
                 v_del.grantor_user_id::text || '|' ||
                 v_del.grantee_user_id::text || '|' ||
                 v_del.scope_type || '|' ||
                 coalesce(v_del.unit_id::text, v_del.building_id::text, v_del.property_id::text, 'workspace') || '|' ||
                 to_char(v_del.valid_from at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' ||
                 to_char(v_del.valid_until at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') || '|' ||
                 v_perms || '|' ||
                 coalesce(v_del.approval_policy_code, 'none');

  return encode(extensions.digest(v_canonical, 'sha256'), 'hex');
end;
$$;

revoke all on function app_private.compute_delegation_payload_hash_v1(uuid) from public, anon, authenticated;

-- Helper: Direct Effective Permission (Paths A and B only, zero recursion)
create or replace function app_private.check_direct_effective_permission_v1(
  p_context_id uuid,
  p_membership_id uuid,
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
  v_member record;
  v_perm identity.permissions%rowtype;
  v_mod_ids uuid[];
  v_mod platform.module_definitions%rowtype;
  v_binding_ids uuid[];
  v_binding platform.module_permission_bindings%rowtype;
  v_tax_ids uuid[];
  v_profile record;
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_has_allow boolean := false;
begin
  if p_context_id is null or p_membership_id is null or p_permission_code is null or p_module_code is null or p_target_scope_type is null then
    return false;
  end if;

  if p_target_scope_type not in ('workspace', 'property', 'building', 'unit') then
    return false;
  end if;

  if p_target_scope_type <> 'workspace' and p_target_scope_id is null then
    return false;
  end if;

  begin
    select * into v_res
    from app_private.resolve_workspace_from_customer_context_v1(p_context_id, false);
  exception when others then
    return false;
  end;

  if v_res.workspace_id is null then return false; end if;

  -- Verify target member exists, active and belongs to same tenant
  select m.id, m.tenant_id, m.user_id, m.role_id, r.code as role_code
  into v_member
  from identity.memberships m
  left join identity.roles r on r.id = m.role_id
  where m.id = p_membership_id
    and m.tenant_id = v_res.tenant_id
    and m.status = 'active'
    and m.starts_at <= statement_timestamp()
    and (m.ends_at is null or m.ends_at > statement_timestamp());

  if not found then return false; end if;

  -- Permission & Module Verification
  select * into v_perm from identity.permissions where code = p_permission_code;
  if not found then return false; end if;

  select array_agg(id) into v_mod_ids
  from platform.module_definitions
  where code = p_module_code
    and is_active = true
    and lifecycle_status in ('active', 'published')
    and lifecycle_status <> 'catalog_only'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  -- Active Module Permission Binding Gate
  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_binding_ids), 0) <> 1 then return false; end if;
  select * into v_binding from platform.module_permission_bindings where id = v_binding_ids[1];

  -- Workspace Module Activation Gate
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

  -- Entitlement Gate
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

  -- Taxonomy Gate
  select array_agg(wta.id) into v_tax_ids
  from platform.workspace_taxonomy_assignments wta
  where wta.customer_workspace_id = v_res.workspace_id
    and wta.status = 'active'
    and wta.valid_from <= statement_timestamp()
    and (wta.valid_to is null or wta.valid_to > statement_timestamp());

  if coalesce(cardinality(v_tax_ids), 0) <> 1 then return false; end if;

  select pp.id as profile_id, om.id as model_id into v_profile
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

  -- Target Scope Ancestry
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

  -- Deny Path A
  if v_member.role_id is not null and exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_member.role_id and rp.permission_id = v_perm.id and rp.effect = 'deny'
  ) then
    return false;
  end if;

  -- Deny Path B
  if exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = p_membership_id
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

  -- Allow Path A
  if v_member.role_id is not null and exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_member.role_id and rp.permission_id = v_perm.id and rp.effect = 'allow'
  ) then
    v_has_allow := true;
  end if;

  -- Allow Path B
  if not v_has_allow and exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = p_membership_id
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

revoke all on function app_private.check_direct_effective_permission_v1(uuid, uuid, text, text, text, uuid) from public, anon, authenticated;

-- Extend app_private.check_effective_permission_v1 with Path C (Valid Delegated Allow)
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
  v_profile record;
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_has_allow boolean := false;
begin
  if p_context_id is null or p_permission_code is null or p_module_code is null or p_target_scope_type is null then
    return false;
  end if;

  if p_target_scope_type not in ('workspace', 'property', 'building', 'unit') then
    return false;
  end if;

  if p_target_scope_type <> 'workspace' and p_target_scope_id is null then
    return false;
  end if;

  begin
    select * into v_res
    from app_private.resolve_workspace_from_customer_context_v1(p_context_id, false);
  exception when others then
    return false;
  end;

  if v_res.workspace_id is null or v_res.membership_id is null then
    return false;
  end if;

  select * into v_perm from identity.permissions where code = p_permission_code;
  if not found then return false; end if;

  select array_agg(id) into v_mod_ids
  from platform.module_definitions
  where code = p_module_code
    and is_active = true
    and lifecycle_status in ('active', 'published')
    and lifecycle_status <> 'catalog_only'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_binding_ids), 0) <> 1 then return false; end if;
  select * into v_binding from platform.module_permission_bindings where id = v_binding_ids[1];

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

  select array_agg(wta.id) into v_tax_ids
  from platform.workspace_taxonomy_assignments wta
  where wta.customer_workspace_id = v_res.workspace_id
    and wta.status = 'active'
    and wta.valid_from <= statement_timestamp()
    and (wta.valid_to is null or wta.valid_to > statement_timestamp());

  if coalesce(cardinality(v_tax_ids), 0) <> 1 then return false; end if;

  select pp.id as profile_id, om.id as model_id into v_profile
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

  -- Deny Path A
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id and rp.permission_id = v_perm.id and rp.effect = 'deny'
  ) then
    return false;
  end if;

  -- Deny Path B
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

  -- Allow Path A
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id and rp.permission_id = v_perm.id and rp.effect = 'allow'
  ) then
    v_has_allow := true;
  end if;

  -- Allow Path B
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

  -- Path C: Valid Delegated Allow (Zero recursion: checks grantor via direct helper only)
  if not v_has_allow and exists (
    select 1
    from platform.workspace_delegations wd
    join platform.workspace_delegation_permissions wdp on wdp.delegation_id = wd.id
    join platform.module_permission_bindings mpb on mpb.id = wdp.module_permission_binding_id
    where wd.customer_workspace_id = v_res.workspace_id
      and wd.grantee_membership_id = v_res.membership_id
      and wd.lifecycle_status = 'active'
      and wd.valid_from <= statement_timestamp()
      and wd.valid_until > statement_timestamp()
      and wdp.module_definition_id = v_mod.id
      and wdp.permission_id = v_perm.id
      and mpb.is_delegable = true
      and mpb.lifecycle_status = 'active'
      and (
        wd.scope_type = 'workspace'
        or (wd.scope_type = 'property' and wd.property_id = v_target_property_id)
        or (wd.scope_type = 'building' and wd.building_id = v_target_building_id)
        or (wd.scope_type = 'unit' and wd.unit_id = v_target_unit_id)
      )
      -- Dynamic Fail-Closed Grantor Check:
      and app_private.check_direct_effective_permission_v1(
        p_context_id,
        wd.grantor_membership_id,
        p_permission_code,
        p_module_code,
        wd.scope_type,
        coalesce(wd.unit_id, wd.building_id, wd.property_id, v_res.workspace_id)
      ) = true
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$$;

revoke all on function app_private.check_effective_permission_v1(uuid, text, text, text, uuid) from public, anon, authenticated;


-- ----------------------------------------------------------------------------
-- 9. RPC 1: customer_api.get_workspace_delegations_v1 (STABLE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.get_workspace_delegations_v1(
  p_context_id uuid,
  p_status_filter text default null
)
returns table (
  delegation_id uuid,
  delegation_code text,
  grantor_membership_id uuid,
  grantor_user_id uuid,
  grantee_membership_id uuid,
  grantee_user_id uuid,
  scope_type text,
  scope_id uuid,
  stored_lifecycle_status text,
  effective_status text,
  delegation_depth integer,
  purpose text,
  valid_from timestamptz,
  valid_until timestamptz,
  lock_version integer,
  approval_policy_code text,
  required_approval_count integer,
  recorded_approval_count bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
declare
  v_res record;
  v_has_read_perm boolean;
begin
  select * into v_res from app_private.resolve_workspace_from_customer_context_v1(p_context_id, false);
  if v_res.workspace_id is null or v_res.membership_id is null then
    raise exception 'invalid_context_or_membership' using errcode = '42501';
  end if;

  select exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.delegation.read'
  ) into v_has_read_perm;

  return query
  select
    wd.id as delegation_id,
    wd.delegation_code,
    wd.grantor_membership_id,
    wd.grantor_user_id,
    wd.grantee_membership_id,
    wd.grantee_user_id,
    wd.scope_type,
    coalesce(wd.unit_id, wd.building_id, wd.property_id, wd.customer_workspace_id) as scope_id,
    wd.lifecycle_status as stored_lifecycle_status,
    case
      when wd.lifecycle_status = 'active' and wd.valid_until <= statement_timestamp() then 'expired'
      else wd.lifecycle_status
    end as effective_status,
    wd.delegation_depth,
    wd.purpose,
    wd.valid_from,
    wd.valid_until,
    wd.lock_version,
    wd.approval_policy_code,
    wd.required_approval_count,
    (select count(*) from platform.workspace_delegation_approvals a where a.delegation_id = wd.id) as recorded_approval_count,
    wd.created_at
  from platform.workspace_delegations wd
  where wd.customer_workspace_id = v_res.workspace_id
    and (
      v_has_read_perm is true or
      wd.grantor_membership_id = v_res.membership_id or
      wd.grantee_membership_id = v_res.membership_id
    )
    and (
      p_status_filter is null or
      p_status_filter = 'all' or
      (p_status_filter = 'expired' and wd.lifecycle_status = 'active' and wd.valid_until <= statement_timestamp()) or
      (p_status_filter = 'active' and wd.lifecycle_status = 'active' and wd.valid_until > statement_timestamp()) or
      wd.lifecycle_status = p_status_filter
    )
  order by wd.created_at desc;
end;
$$;

revoke all on function customer_api.get_workspace_delegations_v1(uuid, text) from public, anon;
grant execute on function customer_api.get_workspace_delegations_v1(uuid, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 10. RPC 2: customer_api.create_workspace_delegation_draft_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.create_workspace_delegation_draft_v1(
  p_context_id uuid,
  p_grantee_membership_id uuid,
  p_scope_type text,
  p_property_id uuid,
  p_building_id uuid,
  p_unit_id uuid,
  p_valid_from timestamptz,
  p_valid_until timestamptz,
  p_purpose text,
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
  v_grantee record;
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_code text;
  v_del platform.workspace_delegations%rowtype;
  v_request_hash text;
  v_canonical_request text;
  v_existing_idempotency platform.workspace_delegation_idempotency%rowtype;
  v_response jsonb;
  v_normalized_reason text;
  v_normalized_purpose text;
begin
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'delegation_aal2_required' using errcode = '42501';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 or length(trim(p_reason)) > 500 then
    raise exception 'delegation_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  if p_purpose is null or length(trim(p_purpose)) < 5 or length(trim(p_purpose)) > 500 then
    raise exception 'delegation_purpose_required' using errcode = '22023';
  end if;
  v_normalized_purpose := trim(p_purpose);

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'delegation_idempotency_key_invalid' using errcode = '22023';
  end if;

  select * into v_res from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);
  if v_res.workspace_id is null or v_res.membership_id is null then
    raise exception 'invalid_context_or_membership' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.delegation.manage'
  ) then
    raise exception 'workspace_delegation_manage_permission_required' using errcode = '42501';
  end if;

  -- Resolve grantee
  select m.id, m.tenant_id, m.user_id, m.status into v_grantee
  from identity.memberships m
  where m.id = p_grantee_membership_id and m.tenant_id = v_res.tenant_id;

  if not found or v_grantee.status <> 'active' then
    raise exception 'delegation_grantee_inactive_or_not_found' using errcode = '42501';
  end if;

  if v_grantee.user_id = auth.uid() then
    raise exception 'delegation_self_delegation_prohibited' using errcode = '42501';
  end if;

  if p_scope_type not in ('workspace', 'property', 'building', 'unit') then
    raise exception 'delegation_scope_type_invalid' using errcode = '22023';
  end if;

  if p_valid_from is null or p_valid_until is null or p_valid_until <= p_valid_from then
    raise exception 'delegation_validity_window_invalid' using errcode = '22023';
  end if;

  -- Scope Hierarchy Validation
  if p_scope_type = 'workspace' then
    if p_property_id is not null or p_building_id is not null or p_unit_id is not null then
      raise exception 'delegation_scope_mismatch' using errcode = '22023';
    end if;
  elsif p_scope_type = 'property' then
    if p_property_id is null or p_building_id is not null or p_unit_id is not null then
      raise exception 'delegation_scope_mismatch' using errcode = '22023';
    end if;
    v_target_property_id := p_property_id;
  elsif p_scope_type = 'building' then
    if p_property_id is null or p_building_id is null or p_unit_id is not null then
      raise exception 'delegation_scope_mismatch' using errcode = '22023';
    end if;
    if not exists (select 1 from portfolio.buildings where id = p_building_id and property_id = p_property_id) then
      raise exception 'delegation_scope_hierarchy_invalid' using errcode = '22023';
    end if;
    v_target_property_id := p_property_id;
    v_target_building_id := p_building_id;
  elsif p_scope_type = 'unit' then
    if p_property_id is null or p_building_id is null or p_unit_id is null then
      raise exception 'delegation_scope_mismatch' using errcode = '22023';
    end if;
    if not exists (
      select 1 from portfolio.units u
      join portfolio.buildings b on b.id = u.building_id
      where u.id = p_unit_id and b.id = p_building_id and b.property_id = p_property_id
    ) then
      raise exception 'delegation_scope_hierarchy_invalid' using errcode = '22023';
    end if;
    v_target_property_id := p_property_id;
    v_target_building_id := p_building_id;
    v_target_unit_id := p_unit_id;
  end if;

  if v_target_property_id is not null and not exists (
    select 1 from platform.workspace_property_bindings
    where customer_workspace_id = v_res.workspace_id and property_id = v_target_property_id and status = 'active'
  ) then
    raise exception 'delegation_target_property_not_bound_to_workspace' using errcode = '42501';
  end if;

  -- Transactional Advisory Lock on Create
  perform pg_advisory_xact_lock(
    hashtextextended('delegation_create:' || v_res.tenant_id::text || ':' || v_res.workspace_id::text || ':' || p_idempotency_key, 0)
  );

  v_canonical_request := 'create_draft|' || v_res.tenant_id::text || '|' || v_res.workspace_id::text || '|' ||
                         p_grantee_membership_id::text || '|' || p_scope_type || '|' ||
                         coalesce(p_property_id::text, '') || '|' || coalesce(p_building_id::text, '') || '|' || coalesce(p_unit_id::text, '') || '|' ||
                         p_valid_from::text || '|' || p_valid_until::text || '|' || v_normalized_purpose;
  v_request_hash := encode(extensions.digest(v_canonical_request, 'sha256'), 'hex');

  -- Idempotency Pre-Check
  select * into v_existing_idempotency
  from platform.workspace_delegation_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_existing_idempotency.customer_workspace_id = v_res.workspace_id and v_existing_idempotency.request_hash = v_request_hash then
      return v_existing_idempotency.response_snapshot;
    else
      raise exception 'workspace_delegation_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  v_code := 'DEL-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into platform.workspace_delegations (
    tenant_id, customer_workspace_id, delegation_code,
    grantor_membership_id, grantee_membership_id, grantor_user_id, grantee_user_id,
    scope_type, property_id, building_id, unit_id,
    lifecycle_status, delegation_depth, purpose, valid_from, valid_until,
    lock_version, created_by
  ) values (
    v_res.tenant_id, v_res.workspace_id, v_code,
    v_res.membership_id, p_grantee_membership_id, auth.uid(), v_grantee.user_id,
    p_scope_type, p_property_id, p_building_id, p_unit_id,
    'draft', 0, v_normalized_purpose, p_valid_from, p_valid_until,
    1, auth.uid()
  ) returning * into v_del;

  v_response := jsonb_build_object(
    'action', 'create_draft',
    'delegation_id', v_del.id,
    'delegation_code', v_del.delegation_code,
    'lifecycle_status', v_del.lifecycle_status,
    'lock_version', v_del.lock_version,
    'workspace_id', v_del.customer_workspace_id
  );

  insert into platform.workspace_delegation_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'create_draft',
    v_request_hash, 1, v_del.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_DELEGATION_CREATED', 'workspace_delegation',
    v_del.id, null, to_jsonb(v_del), v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.create_workspace_delegation_draft_v1(uuid, uuid, text, uuid, uuid, uuid, timestamptz, timestamptz, text, text, text) from public, anon;
grant execute on function customer_api.create_workspace_delegation_draft_v1(uuid, uuid, text, uuid, uuid, uuid, timestamptz, timestamptz, text, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 11. RPC 3: customer_api.attach_workspace_delegation_permission_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.attach_workspace_delegation_permission_v1(
  p_context_id uuid,
  p_delegation_id uuid,
  p_module_definition_id uuid,
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
  v_del platform.workspace_delegations%rowtype;
  v_mod platform.module_definitions%rowtype;
  v_perm identity.permissions%rowtype;
  v_binding platform.module_permission_bindings%rowtype;
  v_perm_record platform.workspace_delegation_permissions%rowtype;
  v_request_hash text;
  v_existing_idempotency platform.workspace_delegation_idempotency%rowtype;
  v_response jsonb;
  v_normalized_reason text;
  v_target_scope_id uuid;
begin
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'delegation_aal2_required' using errcode = '42501';
  end if;

  if p_expected_lock_version is null or p_expected_lock_version < 1 then
    raise exception 'expected_lock_version_required' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 or length(trim(p_reason)) > 500 then
    raise exception 'delegation_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'delegation_idempotency_key_invalid' using errcode = '22023';
  end if;

  select * into v_res from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);
  if v_res.workspace_id is null or v_res.membership_id is null then
    raise exception 'invalid_context_or_membership' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.delegation.manage'
  ) then
    raise exception 'workspace_delegation_manage_permission_required' using errcode = '42501';
  end if;

  -- Unified Transactional Advisory Lock on Delegation ID
  perform pg_advisory_xact_lock(hashtextextended('delegation_lock:' || p_delegation_id::text, 0));

  v_request_hash := encode(extensions.digest(
    'attach_perm|' || v_res.tenant_id::text || '|' || v_res.workspace_id::text || '|' ||
    p_delegation_id::text || '|' || p_module_definition_id::text || '|' || p_permission_id::text || '|' || p_expected_lock_version::text,
    'sha256'
  ), 'hex');

  -- Idempotency Check BEFORE lock version check
  select * into v_existing_idempotency
  from platform.workspace_delegation_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_existing_idempotency.customer_workspace_id = v_res.workspace_id and v_existing_idempotency.request_hash = v_request_hash then
      return v_existing_idempotency.response_snapshot;
    else
      raise exception 'workspace_delegation_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  select * into v_del from platform.workspace_delegations where id = p_delegation_id for update;
  if not found or v_del.customer_workspace_id <> v_res.workspace_id then
    raise exception 'delegation_not_found' using errcode = 'P0002';
  end if;

  if v_del.lock_version <> p_expected_lock_version then
    raise exception 'workspace_delegation_expected_lock_version_conflict' using errcode = '40001';
  end if;

  if v_del.lifecycle_status <> 'draft' then
    raise exception 'draft_mutations_only' using errcode = 'P0001';
  end if;

  select * into v_mod from platform.module_definitions where id = p_module_definition_id;
  select * into v_perm from identity.permissions where id = p_permission_id;
  if not found then raise exception 'invalid_module_or_permission' using errcode = '22023'; end if;

  select * into v_binding
  from platform.module_permission_bindings
  where module_definition_id = p_module_definition_id
    and permission_id = p_permission_id
    and lifecycle_status = 'active';

  if not found or v_binding.is_delegable is not true then
    raise exception 'delegation_binding_not_delegable' using errcode = '42501';
  end if;

  v_target_scope_id := coalesce(v_del.unit_id, v_del.building_id, v_del.property_id, v_del.customer_workspace_id);

  -- Dynamic Grantor Check: Grantor must possess direct effective permission right now
  if app_private.check_direct_effective_permission_v1(
    p_context_id, v_del.grantor_membership_id, v_perm.code, v_mod.code, v_del.scope_type, v_target_scope_id
  ) is not true then
    raise exception 'delegation_grantor_lacks_effective_permission' using errcode = '42501';
  end if;

  insert into platform.workspace_delegation_permissions (
    delegation_id, module_definition_id, permission_id, module_permission_binding_id
  ) values (
    v_del.id, v_mod.id, v_perm.id, v_binding.id
  ) returning * into v_perm_record;

  update platform.workspace_delegations
  set lock_version = lock_version + 1, updated_at = statement_timestamp()
  where id = v_del.id;

  v_response := jsonb_build_object(
    'action', 'attach_permission',
    'delegation_id', v_del.id,
    'permission_id', v_perm.id,
    'module_definition_id', v_mod.id,
    'lock_version', v_del.lock_version + 1
  );

  insert into platform.workspace_delegation_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'attach_permission',
    v_request_hash, 1, v_perm_record.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_DELEGATION_PERMISSION_ATTACHED', 'workspace_delegation_permission',
    v_perm_record.id, null, to_jsonb(v_perm_record), v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.attach_workspace_delegation_permission_v1(uuid, uuid, uuid, uuid, integer, text, text) from public, anon;
grant execute on function customer_api.attach_workspace_delegation_permission_v1(uuid, uuid, uuid, uuid, integer, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 12. RPC 4: customer_api.detach_workspace_delegation_permission_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.detach_workspace_delegation_permission_v1(
  p_context_id uuid,
  p_delegation_id uuid,
  p_module_definition_id uuid,
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
  v_del platform.workspace_delegations%rowtype;
  v_perm_record platform.workspace_delegation_permissions%rowtype;
  v_request_hash text;
  v_existing_idempotency platform.workspace_delegation_idempotency%rowtype;
  v_response jsonb;
  v_normalized_reason text;
begin
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'delegation_aal2_required' using errcode = '42501';
  end if;

  if p_expected_lock_version is null or p_expected_lock_version < 1 then
    raise exception 'expected_lock_version_required' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 or length(trim(p_reason)) > 500 then
    raise exception 'delegation_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'delegation_idempotency_key_invalid' using errcode = '22023';
  end if;

  select * into v_res from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);
  if v_res.workspace_id is null or v_res.membership_id is null then
    raise exception 'invalid_context_or_membership' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.delegation.manage'
  ) then
    raise exception 'workspace_delegation_manage_permission_required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('delegation_lock:' || p_delegation_id::text, 0));

  v_request_hash := encode(extensions.digest(
    'detach_perm|' || v_res.tenant_id::text || '|' || v_res.workspace_id::text || '|' ||
    p_delegation_id::text || '|' || p_module_definition_id::text || '|' || p_permission_id::text || '|' || p_expected_lock_version::text,
    'sha256'
  ), 'hex');

  select * into v_existing_idempotency
  from platform.workspace_delegation_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_existing_idempotency.customer_workspace_id = v_res.workspace_id and v_existing_idempotency.request_hash = v_request_hash then
      return v_existing_idempotency.response_snapshot;
    else
      raise exception 'workspace_delegation_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  select * into v_del from platform.workspace_delegations where id = p_delegation_id for update;
  if not found or v_del.customer_workspace_id <> v_res.workspace_id then
    raise exception 'delegation_not_found' using errcode = 'P0002';
  end if;

  if v_del.lock_version <> p_expected_lock_version then
    raise exception 'workspace_delegation_expected_lock_version_conflict' using errcode = '40001';
  end if;

  if v_del.lifecycle_status <> 'draft' then
    raise exception 'draft_mutations_only' using errcode = 'P0001';
  end if;

  select * into v_perm_record
  from platform.workspace_delegation_permissions
  where delegation_id = p_delegation_id
    and module_definition_id = p_module_definition_id
    and permission_id = p_permission_id;

  if not found then
    raise exception 'delegation_permission_not_attached' using errcode = 'P0002';
  end if;

  delete from platform.workspace_delegation_permissions where id = v_perm_record.id;

  update platform.workspace_delegations
  set lock_version = lock_version + 1, updated_at = statement_timestamp()
  where id = v_del.id;

  v_response := jsonb_build_object(
    'action', 'detach_permission',
    'delegation_id', v_del.id,
    'permission_id', p_permission_id,
    'module_definition_id', p_module_definition_id,
    'lock_version', v_del.lock_version + 1
  );

  insert into platform.workspace_delegation_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'detach_permission',
    v_request_hash, 1, v_perm_record.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_DELEGATION_PERMISSION_DETACHED', 'workspace_delegation_permission',
    v_perm_record.id, to_jsonb(v_perm_record), null, v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.detach_workspace_delegation_permission_v1(uuid, uuid, uuid, uuid, integer, text, text) from public, anon;
grant execute on function customer_api.detach_workspace_delegation_permission_v1(uuid, uuid, uuid, uuid, integer, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 13. RPC 5: customer_api.submit_workspace_delegation_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.submit_workspace_delegation_v1(
  p_context_id uuid,
  p_delegation_id uuid,
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
  v_del platform.workspace_delegations%rowtype;
  v_perm_count integer;
  v_policy text := 'single_manager';
  v_max_duration integer := 90;
  v_perm record;
  v_target_scope_id uuid;
  v_grantor_ceiling timestamptz;
  v_hash text;
  v_request_hash text;
  v_existing_idempotency platform.workspace_delegation_idempotency%rowtype;
  v_response jsonb;
  v_normalized_reason text;
  v_old_snapshot jsonb;
begin
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'delegation_aal2_required' using errcode = '42501';
  end if;

  if p_expected_lock_version is null or p_expected_lock_version < 1 then
    raise exception 'expected_lock_version_required' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 or length(trim(p_reason)) > 500 then
    raise exception 'delegation_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'delegation_idempotency_key_invalid' using errcode = '22023';
  end if;

  select * into v_res from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);
  if v_res.workspace_id is null or v_res.membership_id is null then
    raise exception 'invalid_context_or_membership' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.delegation.manage'
  ) then
    raise exception 'workspace_delegation_manage_permission_required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('delegation_lock:' || p_delegation_id::text, 0));

  v_request_hash := encode(extensions.digest(
    'submit|' || v_res.tenant_id::text || '|' || v_res.workspace_id::text || '|' ||
    p_delegation_id::text || '|' || p_expected_lock_version::text,
    'sha256'
  ), 'hex');

  select * into v_existing_idempotency
  from platform.workspace_delegation_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_existing_idempotency.customer_workspace_id = v_res.workspace_id and v_existing_idempotency.request_hash = v_request_hash then
      return v_existing_idempotency.response_snapshot;
    else
      raise exception 'workspace_delegation_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  select * into v_del from platform.workspace_delegations where id = p_delegation_id for update;
  if not found or v_del.customer_workspace_id <> v_res.workspace_id then
    raise exception 'delegation_not_found' using errcode = 'P0002';
  end if;

  if v_del.lock_version <> p_expected_lock_version then
    raise exception 'workspace_delegation_expected_lock_version_conflict' using errcode = '40001';
  end if;

  if v_del.lifecycle_status <> 'draft' then
    raise exception 'workspace_delegation_invalid_lifecycle_transition' using errcode = 'P0001';
  end if;

  select count(*) into v_perm_count
  from platform.workspace_delegation_permissions
  where delegation_id = v_del.id;

  if v_perm_count < 1 then
    raise exception 'zero_permissions_attached' using errcode = '42501';
  end if;

  -- Determine Policy Sensitivity
  if exists (
    select 1 from platform.workspace_delegation_permissions wdp
    join identity.permissions p on p.id = wdp.permission_id
    where wdp.delegation_id = v_del.id and p.code in ('billing.manage', 'billing.issue', 'payments.manage', 'payments.allocate', 'utilities.billing.create')
  ) then
    v_policy := 'four_eyes_financial';
    v_max_duration := 14;
  elsif exists (
    select 1 from platform.workspace_delegation_permissions wdp
    join identity.permissions p on p.id = wdp.permission_id
    where wdp.delegation_id = v_del.id and p.code = 'maintenance.procurement.approve'
  ) then
    v_policy := 'four_eyes_sensitive';
    v_max_duration := 14;
  else
    v_policy := 'single_manager';
    v_max_duration := 90;
  end if;

  -- Verify Policy Duration Ceiling
  if (v_del.valid_until - v_del.valid_from) > (v_max_duration || ' days')::interval then
    raise exception 'delegation_duration_exceeds_grantor_authority' using errcode = '42501';
  end if;

  v_target_scope_id := coalesce(v_del.unit_id, v_del.building_id, v_del.property_id, v_del.customer_workspace_id);

  -- Grantor Authority Ceiling Algorithm across every attached permission
  for v_perm in
    select p.code as perm_code, m.code as mod_code, mpb.valid_to as binding_valid_to
    from platform.workspace_delegation_permissions wdp
    join identity.permissions p on p.id = wdp.permission_id
    join platform.module_definitions m on m.id = wdp.module_definition_id
    join platform.module_permission_bindings mpb on mpb.id = wdp.module_permission_binding_id
    where wdp.delegation_id = v_del.id
  loop
    if app_private.check_direct_effective_permission_v1(
      p_context_id, v_del.grantor_membership_id, v_perm.perm_code, v_perm.mod_code, v_del.scope_type, v_target_scope_id
    ) is not true then
      raise exception 'delegation_grantor_lacks_effective_permission' using errcode = '42501';
    end if;

    -- Compute grantor direct authority ceiling
    select least(
      coalesce((select m.ends_at from identity.memberships m where m.id = v_del.grantor_membership_id), 'infinity'::timestamptz),
      coalesce((select cg.ends_at from identity.context_grants cg where cg.membership_id = v_del.grantor_membership_id and cg.tenant_id = v_res.tenant_id order by cg.ends_at asc nulls last limit 1), 'infinity'::timestamptz),
      coalesce((select min(wmr.valid_to) from platform.workspace_member_roles wmr join platform.workspace_roles wr on wr.id = wmr.workspace_role_id join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id where wmr.customer_workspace_id = v_res.workspace_id and wmr.membership_id = v_del.grantor_membership_id and wrp.permission_id = (select id from identity.permissions where code = v_perm.perm_code) and wrp.effect = 'allow' and wmr.valid_to is not null), 'infinity'::timestamptz),
      coalesce((select wm.valid_to from platform.workspace_modules wm where wm.customer_workspace_id = v_res.workspace_id and wm.module_code = v_perm.mod_code), 'infinity'::timestamptz),
      coalesce(v_perm.binding_valid_to, 'infinity'::timestamptz),
      v_del.valid_from + (v_max_duration || ' days')::interval
    ) into v_grantor_ceiling;

    if v_del.valid_until > v_grantor_ceiling then
      raise exception 'delegation_duration_exceeds_grantor_authority' using errcode = '42501';
    end if;
  end loop;

  v_old_snapshot := to_jsonb(v_del);

  -- Snapshot policy onto delegation before hashing
  update platform.workspace_delegations
  set approval_policy_code = v_policy,
      required_approval_count = 1
  where id = v_del.id;

  v_hash := app_private.compute_delegation_payload_hash_v1(v_del.id);

  update platform.workspace_delegations
  set lifecycle_status = 'pending_acceptance',
      payload_hash = v_hash,
      submitted_at = statement_timestamp(),
      lock_version = lock_version + 1,
      updated_at = statement_timestamp()
  where id = v_del.id
  returning * into v_del;

  v_response := jsonb_build_object(
    'action', 'submit',
    'delegation_id', v_del.id,
    'lifecycle_status', v_del.lifecycle_status,
    'approval_policy_code', v_del.approval_policy_code,
    'required_approval_count', v_del.required_approval_count,
    'payload_hash', v_del.payload_hash,
    'lock_version', v_del.lock_version
  );

  insert into platform.workspace_delegation_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'submit',
    v_request_hash, 1, v_del.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_DELEGATION_SUBMITTED', 'workspace_delegation',
    v_del.id, v_old_snapshot, to_jsonb(v_del), v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.submit_workspace_delegation_v1(uuid, uuid, integer, text, text) from public, anon;
grant execute on function customer_api.submit_workspace_delegation_v1(uuid, uuid, integer, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 14. RPC 6: customer_api.accept_workspace_delegation_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.accept_workspace_delegation_v1(
  p_context_id uuid,
  p_delegation_id uuid,
  p_decision text,
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
  v_del platform.workspace_delegations%rowtype;
  v_request_hash text;
  v_existing_idempotency platform.workspace_delegation_idempotency%rowtype;
  v_response jsonb;
  v_normalized_reason text;
  v_old_snapshot jsonb;
  v_action text;
  v_audit_action text;
begin
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'delegation_aal2_required' using errcode = '42501';
  end if;

  if p_decision not in ('accepted', 'rejected') then
    raise exception 'delegation_invalid_decision_parameter' using errcode = '22023';
  end if;

  if p_expected_lock_version is null or p_expected_lock_version < 1 then
    raise exception 'expected_lock_version_required' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 or length(trim(p_reason)) > 500 then
    raise exception 'delegation_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'delegation_idempotency_key_invalid' using errcode = '22023';
  end if;

  select * into v_res from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);
  if v_res.workspace_id is null or v_res.membership_id is null then
    raise exception 'invalid_context_or_membership' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('delegation_lock:' || p_delegation_id::text, 0));

  v_request_hash := encode(extensions.digest(
    'accept|' || v_res.tenant_id::text || '|' || v_res.workspace_id::text || '|' ||
    p_delegation_id::text || '|' || p_decision || '|' || p_expected_lock_version::text,
    'sha256'
  ), 'hex');

  select * into v_existing_idempotency
  from platform.workspace_delegation_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_existing_idempotency.customer_workspace_id = v_res.workspace_id and v_existing_idempotency.request_hash = v_request_hash then
      return v_existing_idempotency.response_snapshot;
    else
      raise exception 'workspace_delegation_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  select * into v_del from platform.workspace_delegations where id = p_delegation_id for update;
  if not found or v_del.customer_workspace_id <> v_res.workspace_id then
    raise exception 'delegation_not_found' using errcode = 'P0002';
  end if;

  if v_del.lock_version <> p_expected_lock_version then
    raise exception 'workspace_delegation_expected_lock_version_conflict' using errcode = '40001';
  end if;

  if v_del.lifecycle_status <> 'pending_acceptance' then
    raise exception 'workspace_delegation_invalid_lifecycle_transition' using errcode = 'P0001';
  end if;

  -- Caller must be Grantee
  if auth.uid() <> v_del.grantee_user_id then
    raise exception 'delegation_caller_not_grantee' using errcode = '42501';
  end if;

  v_old_snapshot := to_jsonb(v_del);

  if p_decision = 'accepted' then
    v_action := 'accept';
    v_audit_action := 'WORKSPACE_DELEGATION_ACCEPTED';
    update platform.workspace_delegations
    set lifecycle_status = 'pending_approval',
        accepted_at = statement_timestamp(),
        lock_version = lock_version + 1,
        updated_at = statement_timestamp()
    where id = v_del.id
    returning * into v_del;
  else
    v_action := 'reject';
    v_audit_action := 'WORKSPACE_DELEGATION_REJECTED';
    update platform.workspace_delegations
    set lifecycle_status = 'rejected',
        rejected_at = statement_timestamp(),
        rejected_by_user_id = auth.uid(),
        rejection_reason = v_normalized_reason,
        lock_version = lock_version + 1,
        updated_at = statement_timestamp()
    where id = v_del.id
    returning * into v_del;
  end if;

  v_response := jsonb_build_object(
    'action', v_action,
    'delegation_id', v_del.id,
    'lifecycle_status', v_del.lifecycle_status,
    'lock_version', v_del.lock_version
  );

  insert into platform.workspace_delegation_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'accept',
    v_request_hash, 1, v_del.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, v_audit_action, 'workspace_delegation',
    v_del.id, v_old_snapshot, to_jsonb(v_del), v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.accept_workspace_delegation_v1(uuid, uuid, text, integer, text, text) from public, anon;
grant execute on function customer_api.accept_workspace_delegation_v1(uuid, uuid, text, integer, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 15. RPC 7: customer_api.approve_workspace_delegation_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.approve_workspace_delegation_v1(
  p_context_id uuid,
  p_delegation_id uuid,
  p_decision text,
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
  v_del platform.workspace_delegations%rowtype;
  v_request_hash text;
  v_existing_idempotency platform.workspace_delegation_idempotency%rowtype;
  v_response jsonb;
  v_normalized_reason text;
  v_current_hash text;
  v_old_snapshot jsonb;
  v_approved_snapshot jsonb;
  v_action text;
  v_approver_role text;
begin
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'delegation_aal2_required' using errcode = '42501';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'delegation_invalid_decision_parameter' using errcode = '22023';
  end if;

  if p_expected_lock_version is null or p_expected_lock_version < 1 then
    raise exception 'expected_lock_version_required' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 or length(trim(p_reason)) > 500 then
    raise exception 'delegation_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'delegation_idempotency_key_invalid' using errcode = '22023';
  end if;

  select * into v_res from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);
  if v_res.workspace_id is null or v_res.membership_id is null then
    raise exception 'invalid_context_or_membership' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.delegation.approve'
  ) then
    raise exception 'workspace_delegation_approve_permission_required' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('delegation_lock:' || p_delegation_id::text, 0));

  v_request_hash := encode(extensions.digest(
    'approve|' || v_res.tenant_id::text || '|' || v_res.workspace_id::text || '|' ||
    p_delegation_id::text || '|' || p_decision || '|' || p_expected_lock_version::text,
    'sha256'
  ), 'hex');

  select * into v_existing_idempotency
  from platform.workspace_delegation_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_existing_idempotency.customer_workspace_id = v_res.workspace_id and v_existing_idempotency.request_hash = v_request_hash then
      return v_existing_idempotency.response_snapshot;
    else
      raise exception 'workspace_delegation_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  select * into v_del from platform.workspace_delegations where id = p_delegation_id for update;
  if not found or v_del.customer_workspace_id <> v_res.workspace_id then
    raise exception 'delegation_not_found' using errcode = 'P0002';
  end if;

  if v_del.lock_version <> p_expected_lock_version then
    raise exception 'workspace_delegation_expected_lock_version_conflict' using errcode = '40001';
  end if;

  if v_del.lifecycle_status <> 'pending_approval' then
    raise exception 'workspace_delegation_invalid_lifecycle_transition' using errcode = 'P0001';
  end if;

  -- Four-Eyes Prohibitions
  if auth.uid() = v_del.grantor_user_id or auth.uid() = v_del.grantee_user_id then
    raise exception 'delegation_self_approval_prohibited' using errcode = '42501';
  end if;

  -- Verify Approver Role according to Policy
  v_approver_role := v_res.role_code;
  if v_del.approval_policy_code = 'four_eyes_financial' then
    if v_approver_role not in ('president', 'association_admin', 'censor') then
      raise exception 'delegation_unauthorized_approver_role' using errcode = '42501';
    end if;
  elsif v_del.approval_policy_code = 'four_eyes_sensitive' then
    if v_approver_role not in ('president', 'association_admin') then
      raise exception 'delegation_unauthorized_approver_role' using errcode = '42501';
    end if;
  elsif v_del.approval_policy_code = 'single_manager' then
    if v_approver_role not in ('association_admin', 'property_manager') then
      raise exception 'delegation_unauthorized_approver_role' using errcode = '42501';
    end if;
  else
    raise exception 'delegation_unauthorized_approver_role' using errcode = '42501';
  end if;

  -- Payload Hash Verification
  v_current_hash := app_private.compute_delegation_payload_hash_v1(v_del.id);
  if v_del.payload_hash is distinct from v_current_hash then
    raise exception 'delegation_stale_payload_hash' using errcode = '42501';
  end if;

  -- Expiry Gate
  if v_del.valid_until <= statement_timestamp() then
    raise exception 'delegation_expired_immutable' using errcode = 'P0001';
  end if;

  v_old_snapshot := to_jsonb(v_del);

  if p_decision = 'rejected' then
    v_action := 'reject';
    update platform.workspace_delegations
    set lifecycle_status = 'rejected',
        rejected_at = statement_timestamp(),
        rejected_by_user_id = auth.uid(),
        rejection_reason = v_normalized_reason,
        lock_version = lock_version + 1,
        updated_at = statement_timestamp()
    where id = v_del.id
    returning * into v_del;

    insert into audit.events (
      actor_id, actor_role, action, entity_type, entity_id,
      before_snapshot, after_snapshot, reason, occurred_at
    ) values (
      auth.uid(), v_res.role_code, 'WORKSPACE_DELEGATION_REJECTED', 'workspace_delegation',
      v_del.id, v_old_snapshot, to_jsonb(v_del), v_normalized_reason, statement_timestamp()
    );
  else
    v_action := 'approve';
    -- Insert into approvals table
    insert into platform.workspace_delegation_approvals (
      tenant_id, customer_workspace_id, delegation_id, approval_step,
      approver_membership_id, approver_user_id, approver_role,
      decision, decision_reason, payload_hash
    ) values (
      v_res.tenant_id, v_res.workspace_id, v_del.id, 1,
      v_res.membership_id, auth.uid(), v_approver_role,
      'approved', v_normalized_reason, v_current_hash
    );

    -- Atomic Activation
    update platform.workspace_delegations
    set lifecycle_status = 'active',
        activated_at = statement_timestamp(),
        lock_version = lock_version + 1,
        updated_at = statement_timestamp()
    where id = v_del.id
    returning * into v_del;

    v_approved_snapshot := to_jsonb(v_del);

    -- Emit dual audit events in order
    insert into audit.events (
      actor_id, actor_role, action, entity_type, entity_id,
      before_snapshot, after_snapshot, reason, occurred_at
    ) values (
      auth.uid(), v_res.role_code, 'WORKSPACE_DELEGATION_APPROVED', 'workspace_delegation',
      v_del.id, v_old_snapshot, v_approved_snapshot, v_normalized_reason, statement_timestamp()
    );

    insert into audit.events (
      actor_id, actor_role, action, entity_type, entity_id,
      before_snapshot, after_snapshot, reason, occurred_at
    ) values (
      auth.uid(), v_res.role_code, 'WORKSPACE_DELEGATION_ACTIVATED', 'workspace_delegation',
      v_del.id, v_old_snapshot, v_approved_snapshot, v_normalized_reason, statement_timestamp()
    );
  end if;

  v_response := jsonb_build_object(
    'action', v_action,
    'delegation_id', v_del.id,
    'lifecycle_status', v_del.lifecycle_status,
    'lock_version', v_del.lock_version
  );

  insert into platform.workspace_delegation_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'approve',
    v_request_hash, 1, v_del.id, v_response, auth.uid()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.approve_workspace_delegation_v1(uuid, uuid, text, integer, text, text) from public, anon;
grant execute on function customer_api.approve_workspace_delegation_v1(uuid, uuid, text, integer, text, text) to authenticated, service_role;


-- ----------------------------------------------------------------------------
-- 16. RPC 8: customer_api.revoke_workspace_delegation_v1 (VOLATILE)
-- ----------------------------------------------------------------------------
create or replace function customer_api.revoke_workspace_delegation_v1(
  p_context_id uuid,
  p_delegation_id uuid,
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
  v_del platform.workspace_delegations%rowtype;
  v_request_hash text;
  v_existing_idempotency platform.workspace_delegation_idempotency%rowtype;
  v_response jsonb;
  v_normalized_reason text;
  v_old_snapshot jsonb;
  v_has_admin_revoke boolean := false;
begin
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'delegation_aal2_required' using errcode = '42501';
  end if;

  if p_expected_lock_version is null or p_expected_lock_version < 1 then
    raise exception 'expected_lock_version_required' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 or length(trim(p_reason)) > 500 then
    raise exception 'delegation_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'delegation_idempotency_key_invalid' using errcode = '22023';
  end if;

  select * into v_res from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);
  if v_res.workspace_id is null or v_res.membership_id is null then
    raise exception 'invalid_context_or_membership' using errcode = '42501';
  end if;

  -- Unified Lock Anchor (Identical to Approve)
  perform pg_advisory_xact_lock(hashtextextended('delegation_lock:' || p_delegation_id::text, 0));

  v_request_hash := encode(extensions.digest(
    'revoke|' || v_res.tenant_id::text || '|' || v_res.workspace_id::text || '|' ||
    p_delegation_id::text || '|' || p_expected_lock_version::text,
    'sha256'
  ), 'hex');

  select * into v_existing_idempotency
  from platform.workspace_delegation_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_existing_idempotency.customer_workspace_id = v_res.workspace_id and v_existing_idempotency.request_hash = v_request_hash then
      return v_existing_idempotency.response_snapshot;
    else
      raise exception 'workspace_delegation_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  select * into v_del from platform.workspace_delegations where id = p_delegation_id for update;
  if not found or v_del.customer_workspace_id <> v_res.workspace_id then
    raise exception 'delegation_not_found' using errcode = 'P0002';
  end if;

  if v_del.lock_version <> p_expected_lock_version then
    raise exception 'workspace_delegation_expected_lock_version_conflict' using errcode = '40001';
  end if;

  if v_del.lifecycle_status not in ('pending_acceptance', 'pending_approval', 'active') then
    raise exception 'workspace_delegation_invalid_lifecycle_transition' using errcode = 'P0001';
  end if;

  select exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id and rp.effect = 'allow' and p.code = 'workspace.delegation.revoke'
  ) into v_has_admin_revoke;

  -- Authorized Revocation Actors: Grantor, Grantee, or Admin with revoke permission
  if auth.uid() <> v_del.grantor_user_id and
     auth.uid() <> v_del.grantee_user_id and
     v_has_admin_revoke is not true
  then
    raise exception 'delegation_unauthorized_revocation_actor' using errcode = '42501';
  end if;

  v_old_snapshot := to_jsonb(v_del);

  update platform.workspace_delegations
  set lifecycle_status = 'revoked',
      revoked_at = statement_timestamp(),
      revoked_by_user_id = auth.uid(),
      revocation_reason = v_normalized_reason,
      lock_version = lock_version + 1,
      updated_at = statement_timestamp()
  where id = v_del.id
  returning * into v_del;

  v_response := jsonb_build_object(
    'action', 'revoke',
    'delegation_id', v_del.id,
    'lifecycle_status', v_del.lifecycle_status,
    'lock_version', v_del.lock_version
  );

  insert into platform.workspace_delegation_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'revoke',
    v_request_hash, 1, v_del.id, v_response, auth.uid()
  );

  insert into audit.events (
    actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    auth.uid(), v_res.role_code, 'WORKSPACE_DELEGATION_REVOKED', 'workspace_delegation',
    v_del.id, v_old_snapshot, to_jsonb(v_del), v_normalized_reason, statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.revoke_workspace_delegation_v1(uuid, uuid, integer, text, text) from public, anon;
grant execute on function customer_api.revoke_workspace_delegation_v1(uuid, uuid, integer, text, text) to authenticated, service_role;

commit;
