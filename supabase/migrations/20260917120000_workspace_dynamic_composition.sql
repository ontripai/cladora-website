begin;

-- ============================================================================
-- Migration 102: Workspace Dynamic Composition Engine (001A)
-- Package: CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A
-- Scope: Canonical Module Registry, Context-Scoped Activation & Deactivation,
-- Relational Dependency DAG, Relational Incompatibilities, Universal Taxonomy
-- Compatibilities, Guarded Temporal State, Versioned Idempotency, and Audit.
-- Invariant: Property Profile != Operating Model != Building DNA != Service Profile != Country Pack
-- ============================================================================

-- 1. Scoped Permission & Administrative Role Grant Seed
insert into identity.permissions (code, resource, action, description)
values ('workspace.module.manage', 'workspace.module', 'manage', 'Activate, configure, and deactivate workspace dynamic composition modules')
on conflict (code) do nothing;

create or replace function app_private.validate_workspace_module_manage_seeding_v1()
returns void
language plpgsql
security definer
set search_path = pg_catalog, identity
as $$
declare
  v_perm record;
begin
  select * into v_perm
  from identity.permissions
  where code = 'workspace.module.manage';

  if not found then
    raise exception 'permission_not_found: workspace.module.manage' using errcode = 'P0002';
  end if;

  if v_perm.resource <> 'workspace.module' or v_perm.action <> 'manage' then
    raise exception 'permission_specification_mismatch: %', v_perm.code using errcode = '22023';
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

revoke all on function app_private.validate_workspace_module_manage_seeding_v1() from public, anon, authenticated;
select app_private.validate_workspace_module_manage_seeding_v1();

-- Grant to verified existing canonical system administrative roles only
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where r.code in ('association_admin', 'property_manager')
  and r.tenant_id is null
  and r.is_system = true
  and p.code = 'workspace.module.manage'
on conflict do nothing;

-- Bootstrap future roles with scoped permission automatically (hardened validation)
create or replace function app_private.bootstrap_role_module_permissions_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, identity
as $$
begin
  -- Only grant to canonical global system management roles (tenant_id is null, is_system = true)
  -- Rogue/spoof roles with prefix/suffix or non-canonical properties are strictly rejected
  if new.code in ('association_admin', 'property_manager')
     and new.tenant_id is null
     and new.is_system = true
     and new.name is not null and length(trim(new.name)) > 0 then
    insert into identity.role_permissions (role_id, permission_id, effect)
    select new.id, p.id, 'allow'
    from identity.permissions p
    where p.code = 'workspace.module.manage'
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function app_private.bootstrap_role_module_permissions_v1() from public, anon, authenticated;

drop trigger if exists trg_bootstrap_role_module_permissions on identity.roles;
create trigger trg_bootstrap_role_module_permissions
after insert on identity.roles
for each row
execute function app_private.bootstrap_role_module_permissions_v1();


-- 2. Module Definitions Table
create table platform.module_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9_]{2,64}$'),
  version integer not null default 1 check (version > 0),
  name text not null,
  labels_json jsonb not null check (labels_json ? 'ro' and labels_json ? 'en' and labels_json ? 'fa'),
  description text not null,
  category text not null check (category in ('core', 'financial', 'operations', 'governance', 'security', 'occupancy', 'services', 'investment')),
  is_active boolean not null default true,
  lifecycle_status text not null default 'active' check (lifecycle_status in ('draft', 'active', 'published', 'deprecated', 'retired', 'catalog_only')),
  sensitivity_level text not null default 'standard' check (sensitivity_level in ('standard', 'sensitive', 'high_impact')),
  requires_aal2 boolean not null default false,
  entitlement_key text,
  config_schema jsonb not null default '{"type":"object","additionalProperties":false}'::jsonb,
  default_config jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check (valid_to is null or valid_to > valid_from),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (
    (lifecycle_status = 'catalog_only' and entitlement_key is null)
    or
    (lifecycle_status <> 'catalog_only' and entitlement_key is not null and entitlement_key ~ '^module\.[a-z0-9_]{2,64}$')
  ),
  unique (code, version)
);

create index module_definitions_code_ver_idx on platform.module_definitions (code, version);
create index module_definitions_lifecycle_idx on platform.module_definitions (lifecycle_status, is_active);

-- 3. Relational Module Dependencies Table
create table platform.module_dependencies (
  id uuid primary key default gen_random_uuid(),
  module_definition_id uuid not null references platform.module_definitions(id) on delete cascade,
  required_module_definition_id uuid not null references platform.module_definitions(id) on delete cascade,
  is_required boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  check (module_definition_id <> required_module_definition_id),
  unique (module_definition_id, required_module_definition_id)
);

create index module_dependencies_mod_idx on platform.module_dependencies (module_definition_id);
create index module_dependencies_req_idx on platform.module_dependencies (required_module_definition_id);

-- 4. Relational Module Incompatibilities Table
create table platform.module_incompatibilities (
  id uuid primary key default gen_random_uuid(),
  module_definition_id uuid not null references platform.module_definitions(id) on delete cascade,
  incompatible_module_definition_id uuid not null references platform.module_definitions(id) on delete cascade,
  reason_ro text not null default 'Incompatibilitate arhitecturală definită',
  reason_en text not null default 'Defined architectural incompatibility',
  reason_fa text not null default 'ناسازگاری معماری تعریف‌شده',
  created_at timestamptz not null default statement_timestamp(),
  check (module_definition_id <> incompatible_module_definition_id),
  unique (module_definition_id, incompatible_module_definition_id)
);

create index module_incompatibilities_mod_idx on platform.module_incompatibilities (module_definition_id);

-- 5. Module Property Profile Compatibility Matrix
create table platform.module_property_profile_compatibilities (
  id uuid primary key default gen_random_uuid(),
  module_definition_id uuid not null references platform.module_definitions(id) on delete cascade,
  property_profile_id uuid not null references platform.property_profiles(id) on delete cascade,
  compatibility_level text not null check (compatibility_level in ('compatible', 'review_required', 'incompatible')),
  reason text not null default 'Canonical module profile compatibility rule',
  created_at timestamptz not null default statement_timestamp(),
  unique (module_definition_id, property_profile_id)
);

create index mod_prop_compat_lookup_idx on platform.module_property_profile_compatibilities (module_definition_id, property_profile_id);

-- 6. Module Operating Model Compatibility Matrix
create table platform.module_operating_model_compatibilities (
  id uuid primary key default gen_random_uuid(),
  module_definition_id uuid not null references platform.module_definitions(id) on delete cascade,
  operating_model_id uuid not null references platform.operating_models(id) on delete cascade,
  compatibility_level text not null check (compatibility_level in ('compatible', 'review_required', 'incompatible')),
  reason text not null default 'Canonical module operating model compatibility rule',
  created_at timestamptz not null default statement_timestamp(),
  unique (module_definition_id, operating_model_id)
);

create index mod_op_compat_lookup_idx on platform.module_operating_model_compatibilities (module_definition_id, operating_model_id);

-- 7. Workspace Modules Temporal State Table
create table platform.workspace_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  module_code text not null,
  status text not null check (status in ('active', 'deactivated', 'superseded')),
  config_json jsonb not null default '{}'::jsonb check (config_json = '{}'::jsonb and octet_length(config_json::text) <= 16384),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  activated_at timestamptz not null default statement_timestamp(),
  deactivated_at timestamptz,
  activated_by uuid references auth.users(id) on delete set null,
  deactivated_by uuid references auth.users(id) on delete set null,
  reason text,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  check ((valid_to is null and status = 'active') or (valid_to is not null and status in ('deactivated', 'superseded')))
);

create index ws_modules_ws_code_idx on platform.workspace_modules (customer_workspace_id, module_code);
create index ws_modules_tenant_ws_idx on platform.workspace_modules (tenant_id, customer_workspace_id);
create unique index uq_workspace_modules_active_code on platform.workspace_modules (customer_workspace_id, module_code) where (valid_to is null);

-- 8. Workspace Module Idempotency Table (Canonical tenant-level unique boundary)
create table platform.workspace_module_idempotency (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  idempotency_key text not null check (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'),
  request_hash text not null,
  request_hash_version integer not null default 1,
  action text not null check (action in ('activate', 'deactivate')),
  module_definition_id uuid not null references platform.module_definitions(id) on delete restrict,
  expected_workspace_module_id uuid,
  result_workspace_module_id uuid not null references platform.workspace_modules(id) on delete restrict,
  response_snapshot jsonb not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, idempotency_key)
);

create index ws_mod_idem_lookup_idx on platform.workspace_module_idempotency (tenant_id, customer_workspace_id, idempotency_key);

-- 9. Trigger Functions for Immutability, Overlap, and DAG Protection

-- 9.1 Module Definition Immutability Guard
create or replace function app_private.guard_module_definition_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_OP = 'DELETE' then
    if old.lifecycle_status in ('active', 'published') then
      raise exception 'platform_module_definition_immutable' using errcode = '42501';
    end if;
  elsif TG_OP = 'UPDATE' then
    if old.lifecycle_status in ('active', 'published') then
      if old.id <> new.id
         or old.code <> new.code
         or old.version <> new.version
         or old.name <> new.name
         or old.description <> new.description
         or old.entitlement_key <> new.entitlement_key
         or old.requires_aal2 <> new.requires_aal2
         or old.sensitivity_level <> new.sensitivity_level
         or old.category <> new.category
         or old.labels_json <> new.labels_json
         or old.config_schema <> new.config_schema
         or old.created_at <> new.created_at
         or old.valid_from <> new.valid_from then
        raise exception 'platform_module_definition_immutable' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_module_definition_immutability_v1() from public, anon, authenticated;

create trigger trg_guard_module_definition_immutability
before update or delete on platform.module_definitions
for each row
execute function app_private.guard_module_definition_immutability_v1();

-- 9.2 Module Definition Effective-Period Overlap Guard
create or replace function app_private.guard_module_definition_effective_period_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_overlap boolean;
begin
  if new.is_active = true and new.lifecycle_status in ('active', 'published') then
    if new.valid_to is not null and new.valid_to <= new.valid_from then
      return new; -- Allow table check constraint (valid_to is null or valid_to > valid_from) to raise check_violation (23514)
    end if;

    perform pg_advisory_xact_lock(hashtextextended('module_definition:' || new.code, 0));

    select exists (
      select 1
      from platform.module_definitions d
      where d.code = new.code
        and d.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and d.is_active = true
        and d.lifecycle_status in ('active', 'published')
        and tstzrange(d.valid_from, coalesce(d.valid_to, 'infinity'), '[)') &&
            tstzrange(new.valid_from, coalesce(new.valid_to, 'infinity'), '[)')
    ) into v_overlap;

    if v_overlap then
      raise exception 'platform_module_definition_version_overlap' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_module_definition_effective_period_v1() from public, anon, authenticated;

create trigger trg_guard_module_definition_effective_period
before insert or update on platform.module_definitions
for each row
execute function app_private.guard_module_definition_effective_period_v1();

-- 9.3 Relational Dependency DAG Cycle Detection Guard
create or replace function app_private.guard_module_dependency_dag_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_has_cycle boolean;
begin
  if new.module_definition_id = new.required_module_definition_id then
    raise exception 'workspace_module_self_dependency_prohibited' using errcode = '42501';
  end if;

  with recursive dep_graph as (
    select required_module_definition_id as next_id, array[new.module_definition_id, new.required_module_definition_id] as path
    from platform.module_dependencies
    where module_definition_id = new.required_module_definition_id
    union all
    select d.required_module_definition_id, path || d.required_module_definition_id
    from platform.module_dependencies d
    join dep_graph g on g.next_id = d.module_definition_id
    where not (d.required_module_definition_id = any(path))
  )
  select exists (
    select 1 from dep_graph where next_id = new.module_definition_id
  ) into v_has_cycle;

  if v_has_cycle then
    raise exception 'workspace_module_dependency_cycle_detected' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_module_dependency_dag_v1() from public, anon, authenticated;

create trigger trg_guard_module_dependency_dag
before insert or update on platform.module_dependencies
for each row
execute function app_private.guard_module_dependency_dag_v1();

-- 9.4 Workspace Module Code & Tenant Synchronization Guard
create or replace function app_private.guard_workspace_module_code_sync_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_expected_code text;
  v_expected_tenant uuid;
begin
  select code into v_expected_code
  from platform.module_definitions
  where id = new.module_definition_id;

  if v_expected_code is null then
    raise exception 'workspace_module_definition_not_found' using errcode = 'P0002';
  end if;

  if new.module_code <> v_expected_code then
    raise exception 'workspace_module_code_mismatch' using errcode = '22023';
  end if;

  select tenant_id into v_expected_tenant
  from platform.customer_workspaces
  where id = new.customer_workspace_id;

  if v_expected_tenant is null or new.tenant_id <> v_expected_tenant then
    raise exception 'workspace_module_tenant_mismatch' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_workspace_module_code_sync_v1() from public, anon, authenticated;

create trigger trg_guard_workspace_module_code_sync
before insert or update on platform.workspace_modules
for each row
execute function app_private.guard_workspace_module_code_sync_v1();

-- 9.5 Workspace Module Historical Immutability Guard
create or replace function app_private.guard_workspace_module_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'workspace_module_history_immutable' using errcode = '42501';
  elsif TG_OP = 'UPDATE' then
    if old.valid_to is not null then
      raise exception 'workspace_module_history_immutable' using errcode = '42501';
    end if;
    if old.id <> new.id
       or old.tenant_id <> new.tenant_id
       or old.customer_workspace_id <> new.customer_workspace_id
       or old.module_definition_id <> new.module_definition_id
       or old.module_code <> new.module_code
       or old.valid_from <> new.valid_from
       or old.activated_at <> new.activated_at
       or old.activated_by is distinct from new.activated_by
       or old.config_json <> new.config_json
       or old.created_at <> new.created_at then
      raise exception 'workspace_module_history_immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_workspace_module_immutability_v1() from public, anon, authenticated;

create trigger trg_guard_workspace_module_immutability
before update or delete on platform.workspace_modules
for each row
execute function app_private.guard_workspace_module_immutability_v1();

-- 10. Canonical Context-Scoped Workspace Resolver Function
create or replace function app_private.resolve_workspace_from_customer_context_v1(
  p_context_id uuid,
  p_is_mutation boolean
)
returns table (
  workspace_id uuid,
  tenant_id uuid,
  membership_id uuid,
  role_id uuid,
  role_code text,
  status text
)
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
#variable_conflict use_column
declare
  v_grant record;
  v_target_property_id uuid;
  v_binding_count integer;
  v_binding record;
  v_workspace platform.customer_workspaces%rowtype;
  v_ws_count integer;
begin
  -- 1. Authentication
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. Context grant & active membership
  select g.*, m.id as membership_key, m.tenant_id as membership_tenant, m.role_id, r.code as role_code
  into v_grant
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  -- 3. Resolve target property if scoped
  if v_grant.property_id is not null then
    v_target_property_id := v_grant.property_id;
  elsif v_grant.building_id is not null then
    select b.property_id into v_target_property_id
    from portfolio.buildings b
    where b.id = v_grant.building_id and b.tenant_id = v_grant.membership_tenant;
  elsif v_grant.unit_id is not null then
    select b.property_id into v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = v_grant.unit_id and u.tenant_id = v_grant.membership_tenant;
  end if;

  -- 4. Context-to-Workspace resolution
  if p_is_mutation then
    -- Mutation strictly requires Property/Building/Unit binding. Tenant-only fallback is prohibited.
    if v_target_property_id is null then
      raise exception 'workspace_composition_context_not_workspace_bound' using errcode = '42501';
    end if;

    select count(*)
    into v_binding_count
    from platform.workspace_property_bindings b
    where b.property_id = v_target_property_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp());

    if v_binding_count = 0 then
      raise exception 'workspace_composition_context_not_workspace_bound' using errcode = '42501';
    elsif v_binding_count > 1 then
      raise exception 'workspace_composition_workspace_binding_ambiguous' using errcode = '42501';
    end if;

    select * into v_binding
    from platform.workspace_property_bindings b
    where b.property_id = v_target_property_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp())
    limit 1;

    if v_binding.tenant_id <> v_grant.membership_tenant then
      raise exception 'workspace_composition_workspace_binding_tenant_mismatch' using errcode = '42501';
    end if;

    select * into v_workspace
    from platform.customer_workspaces cw
    where cw.id = v_binding.customer_workspace_id
      and cw.tenant_id = v_grant.membership_tenant
      and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE');

    if v_workspace.id is null then
      raise exception 'workspace_composition_workspace_inactive' using errcode = '42501';
    end if;

    return query select v_workspace.id, v_workspace.tenant_id, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'active'::text;
    return;
  else
    -- Read projection
    if v_target_property_id is not null then
      select count(*)
      into v_binding_count
      from platform.workspace_property_bindings b
      where b.property_id = v_target_property_id
        and b.status = 'active'
        and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp());

      if v_binding_count = 0 then
        return query select null::uuid, v_grant.membership_tenant, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'binding_required'::text;
        return;
      elsif v_binding_count > 1 then
        raise exception 'workspace_composition_workspace_binding_ambiguous' using errcode = '42501';
      end if;

      select * into v_binding
      from platform.workspace_property_bindings b
      where b.property_id = v_target_property_id
        and b.status = 'active'
        and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp())
      limit 1;

      if v_binding.tenant_id <> v_grant.membership_tenant then
        raise exception 'workspace_composition_workspace_binding_tenant_mismatch' using errcode = '42501';
      end if;

      select * into v_workspace
      from platform.customer_workspaces cw
      where cw.id = v_binding.customer_workspace_id
        and cw.tenant_id = v_grant.membership_tenant
        and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE');

      if v_workspace.id is null then
        return query select null::uuid, v_grant.membership_tenant, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'binding_required'::text;
        return;
      end if;

      return query select v_workspace.id, v_workspace.tenant_id, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'active'::text;
      return;
    else
      -- Pure tenant-scoped context read
      select count(*) into v_ws_count
      from platform.customer_workspaces cw
      where cw.tenant_id = v_grant.membership_tenant and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE');

      if v_ws_count = 1 then
        select * into v_workspace
        from platform.customer_workspaces cw
        where cw.tenant_id = v_grant.membership_tenant and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE');
        return query select v_workspace.id, v_workspace.tenant_id, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'active'::text;
        return;
      elsif v_ws_count = 0 then
        return query select null::uuid, v_grant.membership_tenant, v_grant.membership_key, v_grant.role_id, v_grant.role_code, 'binding_required'::text;
        return;
      else
        raise exception 'workspace_composition_context_not_workspace_bound' using errcode = '42501';
      end if;
    end if;
  end if;
end;
$$;

revoke all on function app_private.resolve_workspace_from_customer_context_v1(uuid, boolean) from public, anon, authenticated;

-- 11. Customer Gateway RPC: get_workspace_composition_v1
create or replace function customer_api.get_workspace_composition_v1(
  p_context_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
declare
  v_res record;
  v_assignment platform.workspace_taxonomy_assignments%rowtype;
  v_profile platform.property_profiles%rowtype;
  v_model platform.operating_models%rowtype;
  v_modules jsonb;
begin
  -- Resolve context and workspace
  select * into v_res
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id, false);

  if v_res.status = 'binding_required' or v_res.workspace_id is null then
    return jsonb_build_object(
      'has_assignment', false,
      'status', 'binding_required',
      'workspace_id', null,
      'modules', '[]'::jsonb
    );
  end if;

  -- Active taxonomy assignment
  select * into v_assignment
  from platform.workspace_taxonomy_assignments
  where customer_workspace_id = v_res.workspace_id
    and status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp())
  order by valid_from desc, created_at desc limit 1;

  if v_assignment.id is not null then
    select * into v_profile from platform.property_profiles where id = v_assignment.property_profile_id;
    select * into v_model from platform.operating_models where id = v_assignment.operating_model_id;
  end if;

  -- Query catalog and evaluate server-authoritative projection flags
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'module_definition_id', d.id,
      'code', d.code,
      'version', d.version,
      'name', d.name,
      'labels', d.labels_json,
      'category', d.category,
      'sensitivity_level', d.sensitivity_level,
      'requires_aal2', d.requires_aal2,
      'lifecycle_status', d.lifecycle_status,
      'workspace_module_id', wm.id,
      'entitlement_key', d.entitlement_key,
      'status', case
        when wm.id is not null and (d.entitlement_key is null or e.id is null or e.valid_until <= statement_timestamp()) then 'suspended_unentitled'
        when wm.id is not null then wm.status
        when d.lifecycle_status = 'catalog_only' then 'catalog_only'
        when d.entitlement_key is null or e.id is null then 'unentitled'
        when v_assignment.id is null then 'taxonomy_required'
        when ppc.compatibility_level is null or omc.compatibility_level is null then 'rule_missing'
        when ppc.compatibility_level = 'incompatible' or omc.compatibility_level = 'incompatible' then 'incompatible'
        when ppc.compatibility_level = 'review_required' or omc.compatibility_level = 'review_required' then 'review_required'
        else 'not_installed'
      end,
      'profile_compatibility', case
        when v_assignment.id is null then 'taxonomy_required'
        when ppc.compatibility_level is null then 'rule_missing'
        else ppc.compatibility_level
      end,
      'operating_model_compatibility', case
        when v_assignment.id is null then 'taxonomy_required'
        when omc.compatibility_level is null then 'rule_missing'
        else omc.compatibility_level
      end,
      'effective_compatibility', case
        when v_assignment.id is null then 'taxonomy_required'
        when ppc.compatibility_level is null or omc.compatibility_level is null then 'rule_missing'
        when ppc.compatibility_level = 'incompatible' or omc.compatibility_level = 'incompatible' then 'incompatible'
        when ppc.compatibility_level = 'review_required' or omc.compatibility_level = 'review_required' then 'review_required'
        when ppc.compatibility_level = 'compatible' and omc.compatibility_level = 'compatible' then 'compatible'
        else 'incompatible'
      end,
      'is_installed', (wm.id is not null),
      'is_entitled', (d.entitlement_key is not null and e.id is not null and (e.valid_until is null or e.valid_until > statement_timestamp())),
      'is_compatible', (
        v_assignment.id is not null
        and ppc.compatibility_level = 'compatible'
        and omc.compatibility_level = 'compatible'
      ),
      'activation_allowed', (
        wm.id is null
        and d.lifecycle_status in ('active', 'published')
        and d.entitlement_key is not null
        and e.id is not null and (e.valid_until is null or e.valid_until > statement_timestamp())
        and v_assignment.id is not null
        and ppc.compatibility_level = 'compatible'
        and omc.compatibility_level = 'compatible'
        and not exists (
          select 1 from platform.module_dependencies req_dep
          join platform.module_definitions req_def on req_def.id = req_dep.required_module_definition_id
          where req_dep.module_definition_id = d.id
            and req_dep.is_required = true
            and not exists (
              select 1 from platform.workspace_modules req_wm
              where req_wm.customer_workspace_id = v_res.workspace_id
                and req_wm.module_code = req_def.code
                and req_wm.valid_to is null
                and req_wm.status = 'active'
            )
        )
      ),
      'can_activate', (
        wm.id is null
        and d.lifecycle_status in ('active', 'published')
        and d.entitlement_key is not null
        and e.id is not null and (e.valid_until is null or e.valid_until > statement_timestamp())
        and v_assignment.id is not null
        and ppc.compatibility_level = 'compatible'
        and omc.compatibility_level = 'compatible'
        and not exists (
          select 1 from platform.module_dependencies req_dep
          join platform.module_definitions req_def on req_def.id = req_dep.required_module_definition_id
          where req_dep.module_definition_id = d.id
            and req_dep.is_required = true
            and not exists (
              select 1 from platform.workspace_modules req_wm
              where req_wm.customer_workspace_id = v_res.workspace_id
                and req_wm.module_code = req_def.code
                and req_wm.valid_to is null
                and req_wm.status = 'active'
            )
        )
      ),
      'can_deactivate', (wm.id is not null and wm.status = 'active')
    ) order by d.code
  ), '[]'::jsonb)
  into v_modules
  from platform.module_definitions d
  -- Left join active installed record
  left join platform.workspace_modules wm on wm.customer_workspace_id = v_res.workspace_id
    and wm.module_code = d.code
    and wm.valid_to is null
  -- Left join active entitlement
  left join platform.workspace_entitlements e on e.customer_workspace_id = v_res.workspace_id
    and d.entitlement_key is not null
    and e.entitlement_key = d.entitlement_key
    and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
    and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp() then e.override_value_json = 'true'::jsonb else (e.boolean_value is true or e.numeric_value > 0) end)
  -- Left join profile compatibility
  left join platform.module_property_profile_compatibilities ppc on ppc.module_definition_id = d.id
    and ppc.property_profile_id = v_profile.id
  -- Left join operating model compatibility
  left join platform.module_operating_model_compatibilities omc on omc.module_definition_id = d.id
    and omc.operating_model_id = v_model.id
  where d.is_active = true and d.lifecycle_status in ('active', 'published', 'catalog_only');

  return jsonb_build_object(
    'has_assignment', (v_assignment.id is not null),
    'status', 'active',
    'workspace_id', v_res.workspace_id,
    'country_code', v_assignment.country_code,
    'profile', case when v_profile.id is not null then jsonb_build_object('id', v_profile.id, 'code', v_profile.code, 'name', v_profile.name) else null end,
    'operating_model', case when v_model.id is not null then jsonb_build_object('id', v_model.id, 'code', v_model.code, 'name', v_model.name) else null end,
    'modules', v_modules
  );
end;
$$;

revoke all on function customer_api.get_workspace_composition_v1(uuid) from public, anon;
grant execute on function customer_api.get_workspace_composition_v1(uuid) to authenticated, service_role;

-- 12. Customer Gateway RPC: activate_workspace_module_v1
create or replace function customer_api.activate_workspace_module_v1(
  p_context_id uuid,
  p_module_definition_id uuid,
  p_expected_workspace_module_id uuid,
  p_config_json jsonb,
  p_idempotency_key text,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_module_def platform.module_definitions%rowtype;
  v_current platform.workspace_modules%rowtype;
  v_new_module platform.workspace_modules%rowtype;
  v_idem platform.workspace_module_idempotency%rowtype;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_normalized_reason text;
  v_assignment record;
  v_assignment_count integer;
  v_profile_compat text;
  v_model_compat text;
  v_response jsonb;
  v_missing_dep text;
begin
  -- 1. Idempotency Key validation
  if p_idempotency_key is null or trim(p_idempotency_key) = '' then
    raise exception 'workspace_module_idempotency_key_required' using errcode = '22023';
  elsif p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_module_idempotency_key_invalid' using errcode = '22023';
  end if;

  -- 2. Configuration Mutation Constraint: in 001A strictly constrained to empty object {}
  if p_config_json is null or p_config_json <> '{}'::jsonb then
    raise exception 'workspace_module_config_mutation_deferred' using errcode = '42501';
  end if;

  -- 3. Mandatory Reason validation
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'workspace_module_activation_reason_required' using errcode = '22023';
  end if;

  v_normalized_reason := trim(p_reason);
  if length(v_normalized_reason) < 5 or length(v_normalized_reason) > 500 then
    raise exception 'workspace_module_invalid_reason' using errcode = '22023';
  end if;

  -- 4. Context & Workspace resolution (Mutation fail-closed)
  select * into v_res
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);

  -- 5. Permission Check: workspace.module.manage
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id
      and rp.effect = 'allow'
      and p.code = 'workspace.module.manage'
  ) then
    raise exception 'workspace_module_manage_permission_required' using errcode = '42501';
  end if;

  -- 6. Target Module Definition Verification
  select * into v_module_def
  from platform.module_definitions
  where id = p_module_definition_id;

  if not found then
    raise exception 'workspace_module_definition_not_found' using errcode = 'P0002';
  end if;

  if v_module_def.lifecycle_status = 'catalog_only' or v_module_def.lifecycle_status not in ('active', 'published') or v_module_def.entitlement_key is null then
    raise exception 'workspace_module_definition_not_activatable' using errcode = '42501';
  end if;

  -- 7. MFA AAL2 Enforcement for sensitive modules
  if v_module_def.requires_aal2 or v_module_def.sensitivity_level in ('sensitive', 'high_impact') then
    if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
      raise exception 'mfa_required' using errcode = '42501';
    end if;
  end if;

  -- 8. Deterministic Request Hash (Canonical JSONB payload)
  v_canonical_payload := jsonb_build_object(
    'action', 'activate',
    'config', '{}'::jsonb,
    'context_id', p_context_id,
    'expected_workspace_module_id', p_expected_workspace_module_id,
    'module_definition_id', p_module_definition_id,
    'normalized_reason', v_normalized_reason,
    'schema_version', 1,
    'tenant_id', v_res.tenant_id,
    'workspace_id', v_res.workspace_id
  );

  v_request_hash := encode(
    extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  -- 9. Transactional Concurrency Lock (Workspace + Module Code)
  perform pg_advisory_xact_lock(hashtextextended('workspace_module:' || v_res.workspace_id::text || ':' || v_module_def.code, 0));

  -- 10. Check Idempotency Boundary (tenant_id, idempotency_key)
  select * into v_idem
  from platform.workspace_module_idempotency
  where tenant_id = v_res.tenant_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'activate'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_module_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  -- 11. Entitlement Enforcement (temporal + active plan)
  if not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_module_def.entitlement_key
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp() then e.override_value_json = 'true'::jsonb else (e.boolean_value is true or e.numeric_value > 0) end)
  ) then
    raise exception 'workspace_module_entitlement_required' using errcode = '42501';
  end if;

  -- 12. Universal Taxonomy Compatibility Gate (Fail-Closed Enforcement)
  select count(*) into v_assignment_count
  from platform.workspace_taxonomy_assignments a
  where a.customer_workspace_id = v_res.workspace_id
    and a.status = 'active'
    and a.valid_from <= statement_timestamp() and (a.valid_to is null or a.valid_to > statement_timestamp());

  if v_assignment_count = 0 then
    raise exception 'workspace_module_taxonomy_assignment_required' using errcode = '42501';
  elsif v_assignment_count > 1 then
    raise exception 'workspace_module_taxonomy_assignment_ambiguous' using errcode = '42501';
  end if;

  select a.* into v_assignment
  from platform.workspace_taxonomy_assignments a
  where a.customer_workspace_id = v_res.workspace_id
    and a.status = 'active'
    and a.valid_from <= statement_timestamp() and (a.valid_to is null or a.valid_to > statement_timestamp())
  limit 1;

  -- Property Profile compatibility rule verification
  select compatibility_level into v_profile_compat
  from platform.module_property_profile_compatibilities
  where module_definition_id = v_module_def.id and property_profile_id = v_assignment.property_profile_id;

  if v_profile_compat is null then
    raise exception 'workspace_module_compatibility_rule_missing' using errcode = '42501';
  elsif v_profile_compat = 'incompatible' then
    raise exception 'workspace_module_taxonomy_incompatible' using errcode = '42501';
  elsif v_profile_compat = 'review_required' then
    raise exception 'workspace_module_compatibility_review_required' using errcode = '42501';
  elsif v_profile_compat <> 'compatible' then
    raise exception 'workspace_module_taxonomy_incompatible' using errcode = '42501';
  end if;

  -- Operating Model compatibility rule verification
  select compatibility_level into v_model_compat
  from platform.module_operating_model_compatibilities
  where module_definition_id = v_module_def.id and operating_model_id = v_assignment.operating_model_id;

  if v_model_compat is null then
    raise exception 'workspace_module_compatibility_rule_missing' using errcode = '42501';
  elsif v_model_compat = 'incompatible' then
    raise exception 'workspace_module_taxonomy_incompatible' using errcode = '42501';
  elsif v_model_compat = 'review_required' then
    raise exception 'workspace_module_compatibility_review_required' using errcode = '42501';
  elsif v_model_compat <> 'compatible' then
    raise exception 'workspace_module_taxonomy_incompatible' using errcode = '42501';
  end if;

  -- 13. Relational Dependency Gate: all required dependencies must be active in workspace
  select req_def.code into v_missing_dep
  from platform.module_dependencies d
  join platform.module_definitions req_def on req_def.id = d.required_module_definition_id
  where d.module_definition_id = v_module_def.id
    and d.is_required = true
    and not exists (
      select 1 from platform.workspace_modules wm
      where wm.customer_workspace_id = v_res.workspace_id
        and wm.module_code = req_def.code
        and wm.valid_to is null
        and wm.status = 'active'
    )
  limit 1;

  if v_missing_dep is not null then
    raise exception 'workspace_module_dependency_missing: %', v_missing_dep using errcode = '42501';
  end if;

  -- 14. Relational Incompatibility Gate: no incompatible modules active in workspace
  if exists (
    select 1
    from platform.module_incompatibilities inc
    join platform.module_definitions inc_def on inc_def.id = inc.incompatible_module_definition_id
    join platform.workspace_modules wm on wm.customer_workspace_id = v_res.workspace_id
      and wm.module_code = inc_def.code
      and wm.valid_to is null
      and wm.status = 'active'
    where inc.module_definition_id = v_module_def.id
  ) then
    raise exception 'workspace_module_incompatibility_detected' using errcode = '42501';
  end if;

  -- 15. Optimistic Concurrency Check
  select * into v_current
  from platform.workspace_modules
  where customer_workspace_id = v_res.workspace_id
    and module_code = v_module_def.code
    and valid_to is null
  for update;

  if v_current.id is not null then
    -- In 001A reconfiguration is deferred; existing active record cannot be re-activated without change
    raise exception 'workspace_module_expected_state_conflict' using errcode = '40001';
  else
    -- Initial activation or reactivation requires p_expected_workspace_module_id IS NULL
    if p_expected_workspace_module_id is not null then
      raise exception 'workspace_module_expected_state_conflict' using errcode = '40001';
    end if;
  end if;

  -- 16. Insert New Active Workspace Module Record
  insert into platform.workspace_modules (
    tenant_id,
    customer_workspace_id,
    module_definition_id,
    module_code,
    status,
    config_json,
    valid_from,
    valid_to,
    activated_at,
    activated_by,
    reason
  ) values (
    v_res.tenant_id,
    v_res.workspace_id,
    v_module_def.id,
    v_module_def.code,
    'active',
    '{}'::jsonb,
    statement_timestamp(),
    null,
    statement_timestamp(),
    auth.uid(),
    v_normalized_reason
  ) returning * into v_new_module;

  -- 17. Build Response Snapshot
  v_response := jsonb_build_object(
    'action', 'activate',
    'module_code', v_module_def.code,
    'module_definition_id', v_module_def.id,
    'reason', v_normalized_reason,
    'status', 'active',
    'valid_from', v_new_module.valid_from,
    'workspace_id', v_res.workspace_id,
    'workspace_module_id', v_new_module.id
  );

  -- 18. Record Successful Idempotency Snapshot (Committed success only)
  insert into platform.workspace_module_idempotency (
    tenant_id,
    customer_workspace_id,
    idempotency_key,
    request_hash,
    request_hash_version,
    action,
    module_definition_id,
    expected_workspace_module_id,
    result_workspace_module_id,
    response_snapshot,
    actor_id
  ) values (
    v_res.tenant_id,
    v_res.workspace_id,
    p_idempotency_key,
    v_request_hash,
    1,
    'activate',
    v_module_def.id,
    p_expected_workspace_module_id,
    v_new_module.id,
    v_response,
    auth.uid()
  );

  -- 19. Record Audit Event
  insert into audit.events (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_snapshot,
    after_snapshot,
    reason,
    occurred_at
  ) values (
    auth.uid(),
    v_res.role_code,
    'WORKSPACE_MODULE_ACTIVATED',
    'workspace_module',
    v_new_module.id,
    null,
    to_jsonb(v_new_module),
    v_normalized_reason,
    statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.activate_workspace_module_v1(uuid, uuid, uuid, jsonb, text, text) from public, anon;
grant execute on function customer_api.activate_workspace_module_v1(uuid, uuid, uuid, jsonb, text, text) to authenticated, service_role;

-- 13. Customer Gateway RPC: deactivate_workspace_module_v1
create or replace function customer_api.deactivate_workspace_module_v1(
  p_context_id uuid,
  p_expected_workspace_module_id uuid,
  p_idempotency_key text,
  p_reason text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_current platform.workspace_modules%rowtype;
  v_module_def platform.module_definitions%rowtype;
  v_idem platform.workspace_module_idempotency%rowtype;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_normalized_reason text;
  v_response jsonb;
  v_dependent_active text;
begin
  -- 1. Mandatory Idempotency Key
  if p_idempotency_key is null or trim(p_idempotency_key) = '' then
    raise exception 'workspace_module_idempotency_key_required' using errcode = '22023';
  elsif p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_module_idempotency_key_invalid' using errcode = '22023';
  end if;

  -- 2. Mandatory Expected Workspace Module ID
  if p_expected_workspace_module_id is null then
    raise exception 'workspace_module_expected_id_required' using errcode = '22023';
  end if;

  -- 3. Mandatory Reason Validation
  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'workspace_module_deactivation_reason_required' using errcode = '22023';
  end if;

  v_normalized_reason := trim(p_reason);
  if length(v_normalized_reason) < 5 or length(v_normalized_reason) > 500 then
    raise exception 'workspace_module_invalid_reason' using errcode = '22023';
  end if;

  -- 4. Context & Workspace resolution (Mutation fail-closed)
  select * into v_res
  from app_private.resolve_workspace_from_customer_context_v1(p_context_id, true);

  -- 5. Permission Check: workspace.module.manage
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_res.role_id
      and rp.effect = 'allow'
      and p.code = 'workspace.module.manage'
  ) then
    raise exception 'workspace_module_manage_permission_required' using errcode = '42501';
  end if;

  -- 6. Inspect target current record by expected ID
  select * into v_current
  from platform.workspace_modules
  where id = p_expected_workspace_module_id
    and customer_workspace_id = v_res.workspace_id;

  if not found then
    raise exception 'workspace_module_expected_state_conflict' using errcode = '40001';
  end if;

  select * into v_module_def
  from platform.module_definitions
  where id = v_current.module_definition_id;

  -- 7. MFA AAL2 Enforcement for sensitive modules
  if v_module_def.requires_aal2 or v_module_def.sensitivity_level in ('sensitive', 'high_impact') then
    if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
      raise exception 'mfa_required' using errcode = '42501';
    end if;
  end if;

  -- 8. Deterministic Request Hash (Canonical JSONB payload)
  v_canonical_payload := jsonb_build_object(
    'action', 'deactivate',
    'config', '{}'::jsonb,
    'context_id', p_context_id,
    'expected_workspace_module_id', p_expected_workspace_module_id,
    'module_definition_id', v_module_def.id,
    'normalized_reason', v_normalized_reason,
    'schema_version', 1,
    'tenant_id', v_res.tenant_id,
    'workspace_id', v_res.workspace_id
  );

  v_request_hash := encode(
    extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'),
    'hex'
  );

  -- 9. Transactional Concurrency Lock
  perform pg_advisory_xact_lock(hashtextextended('workspace_module:' || v_res.workspace_id::text || ':' || v_current.module_code, 0));

  -- 10. Check Idempotency Boundary (tenant_id, idempotency_key)
  select * into v_idem
  from platform.workspace_module_idempotency
  where tenant_id = v_res.tenant_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'deactivate'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_module_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  -- 11. Concurrency Check: Assert record is currently active
  if v_current.valid_to is not null or v_current.status <> 'active' then
    raise exception 'workspace_module_expected_state_conflict' using errcode = '40001';
  end if;

  -- 12. Dependent-Module Deactivation Protection: No other active module must depend on this module
  select dep_def.code into v_dependent_active
  from platform.module_dependencies d
  join platform.module_definitions dep_def on dep_def.id = d.module_definition_id
  join platform.workspace_modules wm on wm.module_code = dep_def.code
  where d.required_module_definition_id = v_module_def.id
    and d.is_required = true
    and wm.customer_workspace_id = v_res.workspace_id
    and wm.valid_to is null
    and wm.status = 'active'
  limit 1;

  if v_dependent_active is not null then
    raise exception 'workspace_module_dependent_active: %', v_dependent_active using errcode = '42501';
  end if;

  -- 13. Close Current Record (Temporal Invariant)
  update platform.workspace_modules
  set status = 'deactivated',
      valid_to = statement_timestamp(),
      deactivated_at = statement_timestamp(),
      deactivated_by = auth.uid(),
      reason = v_normalized_reason,
      updated_at = statement_timestamp()
  where id = v_current.id;

  -- 14. Build Response Snapshot
  v_response := jsonb_build_object(
    'action', 'deactivate',
    'deactivated_at', statement_timestamp(),
    'module_code', v_module_def.code,
    'module_definition_id', v_module_def.id,
    'reason', v_normalized_reason,
    'status', 'deactivated',
    'workspace_id', v_res.workspace_id,
    'workspace_module_id', v_current.id
  );

  -- 15. Record Idempotency Snapshot
  insert into platform.workspace_module_idempotency (
    tenant_id,
    customer_workspace_id,
    idempotency_key,
    request_hash,
    request_hash_version,
    action,
    module_definition_id,
    expected_workspace_module_id,
    result_workspace_module_id,
    response_snapshot,
    actor_id
  ) values (
    v_res.tenant_id,
    v_res.workspace_id,
    p_idempotency_key,
    v_request_hash,
    1,
    'deactivate',
    v_module_def.id,
    p_expected_workspace_module_id,
    v_current.id,
    v_response,
    auth.uid()
  );

  -- 16. Record Audit Event
  insert into audit.events (
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    before_snapshot,
    after_snapshot,
    reason,
    occurred_at
  ) values (
    auth.uid(),
    v_res.role_code,
    'WORKSPACE_MODULE_DEACTIVATED',
    'workspace_module',
    v_current.id,
    to_jsonb(v_current),
    jsonb_build_object('id', v_current.id, 'status', 'deactivated', 'valid_to', statement_timestamp()),
    v_normalized_reason,
    statement_timestamp()
  );

  return v_response;
end;
$$;

revoke all on function customer_api.deactivate_workspace_module_v1(uuid, uuid, text, text) from public, anon;
grant execute on function customer_api.deactivate_workspace_module_v1(uuid, uuid, text, text) to authenticated, service_role;

-- 14. Seed Canonically Proven Module Definitions (10 Runtime + 2 Catalog-Only)
insert into platform.module_definitions (
  code, version, name, labels_json, description, category, is_active, lifecycle_status, sensitivity_level, requires_aal2, entitlement_key, published_at
) values
  ('occupancy', 1, 'Occupancy & Resident Registry', jsonb_build_object('ro','Unități și Ocupare','en','Occupancy & Residents','fa','سکونت و ساکنان'), 'Residency rights, occupancy registry, and unit allocations', 'occupancy', true, 'published', 'standard', false, 'module.occupancy', statement_timestamp()),
  ('billing', 1, 'Billing & Receivables', jsonb_build_object('ro','Facturare și Creanțe','en','Billing & Receivables','fa','صورتحساب و مطالبات'), 'Automated fee calculation, invoices, and debt tracking', 'financial', true, 'published', 'sensitive', true, 'module.billing', statement_timestamp()),
  ('payments', 1, 'Payments & Reconciliation', jsonb_build_object('ro','Plăți și Casierie','en','Payments & Reconciliation','fa','پرداخت و تطبیق بانکی'), 'Bank statement imports, clearing transactions, and cash desk', 'financial', true, 'published', 'sensitive', true, 'module.payments', statement_timestamp()),
  ('accounting', 1, 'Accounting & General Ledger', jsonb_build_object('ro','Registru Contabil','en','Accounting Ledger & Close','fa','دفتر کل و حسابداری'), 'Statutory double-entry general ledger and period close', 'financial', true, 'published', 'sensitive', true, 'module.accounting', statement_timestamp()),
  ('maintenance', 1, 'Maintenance & Work Orders', jsonb_build_object('ro','Mentenanță și Lucrări','en','Maintenance & Work Orders','fa','تعمیرات و نگهداری'), 'Corrective work orders, asset management, and vendor jobs', 'operations', true, 'published', 'standard', false, 'module.maintenance', statement_timestamp()),
  ('utilities', 1, 'Utilities & Metering', jsonb_build_object('ro','Contoare și Consum','en','Utilities & Meter Readings','fa','کنتورها و خدمات'), 'Meter readings, utility consumption allocations, and index logs', 'operations', true, 'published', 'standard', false, 'module.utilities', statement_timestamp()),
  ('governance', 1, 'Association Governance', jsonb_build_object('ro','Guvernanță Asociație','en','Association Governance','fa','حاکمیت و مجامع'), 'General meetings, proxy voting, and statutory resolutions', 'governance', true, 'published', 'standard', false, 'module.governance', statement_timestamp()),
  ('communications', 1, 'Official Communications', jsonb_build_object('ro','Comunicări și Înștiințări','en','Official Communications','fa','ارتباطات و اعلان‌ها'), 'Formal announcements, notice feed, and delivery evidence', 'operations', true, 'published', 'standard', false, 'module.communications', statement_timestamp()),
  ('documents', 1, 'Document Evidence Vault', jsonb_build_object('ro','Seif Documente','en','Document Evidence Vault','fa','مخزن امن اسناد'), 'Tamper-evident document repository and verification evidence', 'security', true, 'published', 'standard', false, 'module.documents', statement_timestamp()),
  ('security', 1, 'Security & Access Control', jsonb_build_object('ro','Control Acces și Vizitatori','en','Security & Visitor Access','fa','امنیت و کنترل تردد'), 'Access credentials, visitor logs, and key management', 'security', true, 'published', 'standard', false, 'module.security', statement_timestamp()),
  ('core_property_registry', 1, 'Master Property Registry', jsonb_build_object('ro','Registru Fond Imobiliar','en','Master Property Registry','fa','رجیستری کل املاک'), 'Conceptual master portfolio registry reserved for future expansion', 'core', true, 'catalog_only', 'standard', false, null, null),
  ('contracts_tenancy', 1, 'Tenancy Contracts', jsonb_build_object('ro','Contracte Închiriere','en','Tenancy Contracts','fa','قراردادهای حقوقی اجاره'), 'Conceptual legal lease engine reserved for future expansion', 'occupancy', true, 'catalog_only', 'standard', false, null, null);

-- 15. Seed Relational Dependencies
-- billing requires occupancy
insert into platform.module_dependencies (module_definition_id, required_module_definition_id)
select m.id, req.id
from platform.module_definitions m
cross join platform.module_definitions req
where m.code = 'billing' and req.code = 'occupancy';

-- payments requires billing
insert into platform.module_dependencies (module_definition_id, required_module_definition_id)
select m.id, req.id
from platform.module_definitions m
cross join platform.module_definitions req
where m.code = 'payments' and req.code = 'billing';

-- accounting requires billing
insert into platform.module_dependencies (module_definition_id, required_module_definition_id)
select m.id, req.id
from platform.module_definitions m
cross join platform.module_definitions req
where m.code = 'accounting' and req.code = 'billing';

-- maintenance requires occupancy
insert into platform.module_dependencies (module_definition_id, required_module_definition_id)
select m.id, req.id
from platform.module_definitions m
cross join platform.module_definitions req
where m.code = 'maintenance' and req.code = 'occupancy';

-- utilities requires occupancy
insert into platform.module_dependencies (module_definition_id, required_module_definition_id)
select m.id, req.id
from platform.module_definitions m
cross join platform.module_definitions req
where m.code = 'utilities' and req.code = 'occupancy';

-- governance requires occupancy
insert into platform.module_dependencies (module_definition_id, required_module_definition_id)
select m.id, req.id
from platform.module_definitions m
cross join platform.module_definitions req
where m.code = 'governance' and req.code = 'occupancy';

-- communications requires occupancy
insert into platform.module_dependencies (module_definition_id, required_module_definition_id)
select m.id, req.id
from platform.module_definitions m
cross join platform.module_definitions req
where m.code = 'communications' and req.code = 'occupancy';

-- security requires occupancy
insert into platform.module_dependencies (module_definition_id, required_module_definition_id)
select m.id, req.id
from platform.module_definitions m
cross join platform.module_definitions req
where m.code = 'security' and req.code = 'occupancy';

-- 16. Seed Universal Taxonomy Compatibilities
-- Connect all definitions with existing property profiles and operating models
insert into platform.module_property_profile_compatibilities (module_definition_id, property_profile_id, compatibility_level, reason)
select m.id, p.id,
  case
    when m.code = 'governance' and p.code not in ('residential_condominium', 'residential_complex', 'gated_villa_community', 'mixed_use_estate') then 'review_required'
    else 'compatible'
  end,
  'Standard canonical profile module mapping v1.0'
from platform.module_definitions m
cross join platform.property_profiles p;

insert into platform.module_operating_model_compatibilities (module_definition_id, operating_model_id, compatibility_level, reason)
select m.id, o.id,
  case
    when m.code = 'governance' and o.code <> 'association_managed' then 'review_required'
    else 'compatible'
  end,
  'Standard canonical operating model module mapping v1.0'
from platform.module_definitions m
cross join platform.operating_models o;

-- 17. Security & Row Level Security Enforcement
alter table platform.module_definitions enable row level security;
alter table platform.module_dependencies enable row level security;
alter table platform.module_incompatibilities enable row level security;
alter table platform.module_property_profile_compatibilities enable row level security;
alter table platform.module_operating_model_compatibilities enable row level security;
alter table platform.workspace_modules enable row level security;
alter table platform.workspace_module_idempotency enable row level security;

-- Revoke all direct table access from public, anon, authenticated
revoke all on platform.module_definitions from public, anon, authenticated;
revoke all on platform.module_dependencies from public, anon, authenticated;
revoke all on platform.module_incompatibilities from public, anon, authenticated;
revoke all on platform.module_property_profile_compatibilities from public, anon, authenticated;
revoke all on platform.module_operating_model_compatibilities from public, anon, authenticated;
revoke all on platform.workspace_modules from public, anon, authenticated;
revoke all on platform.workspace_module_idempotency from public, anon, authenticated;

-- Minimal service_role access grants
grant select on platform.module_definitions to service_role;
grant select on platform.module_dependencies to service_role;
grant select on platform.module_incompatibilities to service_role;
grant select on platform.module_property_profile_compatibilities to service_role;
grant select on platform.module_operating_model_compatibilities to service_role;
grant select, insert, update on platform.workspace_modules to service_role;
grant select, insert, update on platform.workspace_module_idempotency to service_role;

-- Minimal RLS policies for service_role
create policy service_role_all on platform.module_definitions for all to service_role using (true) with check (true);
create policy service_role_all on platform.module_dependencies for all to service_role using (true) with check (true);
create policy service_role_all on platform.module_incompatibilities for all to service_role using (true) with check (true);
create policy service_role_all on platform.module_property_profile_compatibilities for all to service_role using (true) with check (true);
create policy service_role_all on platform.module_operating_model_compatibilities for all to service_role using (true) with check (true);
create policy service_role_all on platform.workspace_modules for all to service_role using (true) with check (true);
create policy service_role_all on platform.workspace_module_idempotency for all to service_role using (true) with check (true);

commit;
