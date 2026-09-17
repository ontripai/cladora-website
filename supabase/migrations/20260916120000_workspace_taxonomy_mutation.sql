begin;

-- ============================================================================
-- Migration 101: Controlled Workspace Taxonomy Mutation Gateway
-- Scope: Transactional assignment, controlled transition, advisory concurrency,
-- audit evidence, deterministic idempotency, fail-closed resolution,
-- canonical country_code storage, catalog options RPC, and AAL2 authorization.
-- Invariant: Workspace Profile != Operating Model != Building DNA != Service Profile != Country Pack
-- ============================================================================

-- 1. Dedicated Scoped Identity Permission & Safe Seeding
insert into identity.permissions (code, resource, action, description)
values ('workspace.taxonomy.manage', 'workspace.taxonomy', 'manage', 'Assign and transition workspace universal taxonomy profiles and operating models')
on conflict (code) do nothing;

-- Strict post-insert validation: ensure exact permission specifications and target roles
do $$
declare
  v_perm record;
  v_admin_role_count integer;
begin
  select * into v_perm
  from identity.permissions
  where code = 'workspace.taxonomy.manage';

  if not found then
    raise exception 'permission_not_found: workspace.taxonomy.manage' using errcode = 'P0002';
  end if;

  if v_perm.resource <> 'workspace.taxonomy' or v_perm.action <> 'manage' then
    raise exception 'permission_specification_mismatch: %', v_perm.code using errcode = '22023';
  end if;

  select count(*) into v_admin_role_count
  from identity.roles
  where lower(code) in ('association_admin', 'property_manager');

  if v_admin_role_count < 2 then
    raise exception 'required_target_roles_missing' using errcode = 'P0002';
  end if;
end;
$$;

-- Seed existing administrative roles
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where lower(r.code) in ('association_admin', 'property_manager')
  and p.code = 'workspace.taxonomy.manage'
on conflict do nothing;

-- Bootstrap future roles with scoped permission automatically
create or replace function app_private.bootstrap_role_taxonomy_permissions_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, identity
as $$
begin
  if lower(new.code) in ('association_admin', 'property_manager') then
    insert into identity.role_permissions (role_id, permission_id, effect)
    select new.id, p.id, 'allow'
    from identity.permissions p
    where p.code = 'workspace.taxonomy.manage'
    on conflict do nothing;
  end if;
  return new;
end;
$$;

revoke all on function app_private.bootstrap_role_taxonomy_permissions_v1() from public, anon, authenticated;

drop trigger if exists trg_bootstrap_role_taxonomy_permissions on identity.roles;
create trigger trg_bootstrap_role_taxonomy_permissions
after insert on identity.roles
for each row
execute function app_private.bootstrap_role_taxonomy_permissions_v1();

-- 2. Add canonical country_code column to platform.workspace_taxonomy_assignments
alter table platform.workspace_taxonomy_assignments
  add column if not exists country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$');

-- Forward update to historical immutability guard to guard country_code
create or replace function app_private.guard_workspace_taxonomy_assignment_history_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'workspace_taxonomy_assignment_history_immutable' using errcode = '42501';
  elsif TG_OP = 'UPDATE' then
    if old.id <> new.id
       or old.tenant_id <> new.tenant_id
       or old.customer_workspace_id <> new.customer_workspace_id
       or old.property_profile_id <> new.property_profile_id
       or old.operating_model_id <> new.operating_model_id
       or (old.country_code is distinct from new.country_code)
       or (old.created_by is distinct from new.created_by)
       or old.created_at <> new.created_at
       or old.valid_from <> new.valid_from then
      raise exception 'workspace_taxonomy_assignment_history_immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function app_private.guard_workspace_taxonomy_assignment_history_v1() from public, anon, authenticated;

-- 3. Idempotency Registry Table
create table platform.workspace_taxonomy_idempotency (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  idempotency_key uuid not null,
  request_hash text not null,
  assignment_id uuid not null references platform.workspace_taxonomy_assignments(id) on delete restrict,
  previous_assignment_id uuid references platform.workspace_taxonomy_assignments(id) on delete restrict,
  property_profile_code text not null,
  operating_model_code text not null,
  country_code text not null,
  compatibility_status text not null,
  valid_from timestamptz not null,
  audit_event_id bigint not null,
  response_payload jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, idempotency_key)
);

create index ws_taxonomy_idempotency_ws_idx
  on platform.workspace_taxonomy_idempotency (customer_workspace_id, created_at desc);

alter table platform.workspace_taxonomy_idempotency enable row level security;
revoke all on platform.workspace_taxonomy_idempotency from public, anon, authenticated;
grant select, insert on platform.workspace_taxonomy_idempotency to service_role;

-- 4. Forward Update to Guard Function: Allow review_required with mandatory reason/notes
create or replace function app_private.guard_workspace_taxonomy_assignment_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, app_private
as $$
declare
  v_workspace_tenant uuid;
  v_compat_level text;
  v_profile_active boolean;
  v_model_active boolean;
begin
  -- 1. Tenant boundary check
  select tenant_id into v_workspace_tenant from platform.customer_workspaces where id = new.customer_workspace_id for update;
  if not found then
    raise exception 'workspace_taxonomy_not_found' using errcode = 'P0002';
  end if;
  if v_workspace_tenant <> new.tenant_id then
    raise exception 'workspace_taxonomy_tenant_mismatch' using errcode = '42501';
  end if;

  -- 2. Verify Profile and Operating Model active status
  select is_active into v_profile_active from platform.property_profiles
  where id = new.property_profile_id and lifecycle_status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp());
  if not coalesce(v_profile_active, false) then
    raise exception 'workspace_taxonomy_profile_inactive' using errcode = '22023';
  end if;

  select is_active into v_model_active from platform.operating_models
  where id = new.operating_model_id and lifecycle_status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp());
  if not coalesce(v_model_active, false) then
    raise exception 'workspace_taxonomy_operating_model_inactive' using errcode = '22023';
  end if;

  -- 3. Evaluate Compatibility Rule
  select compatibility_level into v_compat_level
  from platform.property_operating_model_compatibilities
  where property_profile_id = new.property_profile_id
    and operating_model_id = new.operating_model_id
  order by rule_version desc limit 1;

  if v_compat_level is null then
    raise exception 'workspace_taxonomy_compatibility_rule_missing' using errcode = 'P0001';
  end if;

  if v_compat_level = 'incompatible' then
    raise exception 'workspace_taxonomy_incompatible' using errcode = 'P0001';
  elsif v_compat_level = 'review_required' then
    if new.status = 'active' and (new.notes is null or length(trim(new.notes)) = 0) then
      raise exception 'workspace_taxonomy_review_reason_required' using errcode = 'P0001';
    end if;
  end if;

  -- 4. Check for overlapping active assignments for this workspace
  if new.status = 'active' then
    if exists (
      select 1 from platform.workspace_taxonomy_assignments a
      where a.customer_workspace_id = new.customer_workspace_id
        and a.status = 'active'
        and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and (
          (a.valid_to is null and (new.valid_to is null or new.valid_to > a.valid_from))
          or
          (a.valid_to is not null and new.valid_from < a.valid_to and (new.valid_to is null or new.valid_to > a.valid_from))
        )
    ) then
      raise exception 'workspace_taxonomy_assignment_overlap' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function app_private.guard_workspace_taxonomy_assignment_v1() from public, anon, authenticated;

-- 5. Forward Update to customer_api.get_workspace_taxonomy_v1 to return stored country_code
create or replace function customer_api.get_workspace_taxonomy_v1(p_context_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
declare
  v_grant record;
  v_target_property_id uuid;
  v_binding_count integer;
  v_binding record;
  v_workspace platform.customer_workspaces%rowtype;
  v_assignment record;
  v_profile record;
  v_model record;
  v_allowed_space_kinds jsonb;
  v_ws_count integer;
begin
  -- 1. Authentication check
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. Context grant & active membership validation
  select g.*, m.tenant_id as membership_tenant
  into v_grant
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  -- 3. Resolve target property if scoped
  if v_grant.property_id is not null then
    v_target_property_id := v_grant.property_id;
  elsif v_grant.building_id is not null then
    select property_id into v_target_property_id
    from portfolio.buildings
    where id = v_grant.building_id and tenant_id = v_grant.membership_tenant;
  elsif v_grant.unit_id is not null then
    select b.property_id into v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = v_grant.unit_id and u.tenant_id = v_grant.membership_tenant;
  end if;

  -- 4. Context-to-Workspace resolution (read-only GET retains existing behavior)
  if v_target_property_id is not null then
    select count(*)
    into v_binding_count
    from platform.workspace_property_bindings b
    where b.property_id = v_target_property_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp());

    if v_binding_count = 0 then
      return jsonb_build_object(
        'has_assignment', false,
        'status', 'binding_required',
        'workspace_id', null
      );
    elsif v_binding_count > 1 then
      raise exception 'workspace_taxonomy_workspace_binding_ambiguous' using errcode = '42501';
    end if;

    select * into v_binding
    from platform.workspace_property_bindings b
    where b.property_id = v_target_property_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp())
    limit 1;

    if v_binding.tenant_id <> v_grant.membership_tenant then
      raise exception 'workspace_taxonomy_workspace_binding_tenant_mismatch' using errcode = '42501';
    end if;

    select * into v_workspace
    from platform.customer_workspaces
    where id = v_binding.customer_workspace_id
      and tenant_id = v_grant.membership_tenant
      and lifecycle_status in ('PROVISIONING', 'ACTIVE');

    if v_workspace.id is null then
      return jsonb_build_object(
        'has_assignment', false,
        'status', 'binding_required',
        'workspace_id', null
      );
    end if;
  else
    select count(*) into v_ws_count
    from platform.customer_workspaces
    where tenant_id = v_grant.membership_tenant and lifecycle_status in ('PROVISIONING', 'ACTIVE');

    if v_ws_count = 1 then
      select * into v_workspace
      from platform.customer_workspaces
      where tenant_id = v_grant.membership_tenant and lifecycle_status in ('PROVISIONING', 'ACTIVE');
    elsif v_ws_count = 0 then
      return jsonb_build_object(
        'has_assignment', false,
        'status', 'binding_required',
        'workspace_id', null
      );
    else
      raise exception 'workspace_taxonomy_context_not_workspace_bound' using errcode = '42501';
    end if;
  end if;

  if v_workspace.id is null then
    return jsonb_build_object(
      'has_assignment', false,
      'status', 'binding_required',
      'workspace_id', null
    );
  end if;

  -- 5. Resolve active taxonomy assignment
  select a.* into v_assignment
  from platform.workspace_taxonomy_assignments a
  where a.customer_workspace_id = v_workspace.id
    and a.status = 'active'
    and a.valid_from <= statement_timestamp() and (a.valid_to is null or a.valid_to > statement_timestamp())
  order by a.valid_from desc, a.created_at desc limit 1;

  if not found then
    return jsonb_build_object(
      'has_assignment', false,
      'status', 'unclassified',
      'workspace_id', v_workspace.id
    );
  end if;

  -- 6. Profile & Operating Model details
  select * into v_profile from platform.property_profiles where id = v_assignment.property_profile_id;
  select * into v_model from platform.operating_models where id = v_assignment.operating_model_id;

  -- 7. Allowed space kinds for this profile
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', k.id,
    'code', k.code,
    'name', k.name,
    'labels', k.labels_json,
    'compatibility_level', c.compatibility_level
  ) order by k.code), '[]'::jsonb)
  into v_allowed_space_kinds
  from platform.property_space_kind_compatibilities c
  join platform.space_kinds k on k.id = c.space_kind_id
  where c.property_profile_id = v_profile.id and c.compatibility_level in ('compatible', 'review_required');

  return jsonb_build_object(
    'has_assignment', true,
    'workspace_id', v_workspace.id,
    'status', v_assignment.status,
    'country_code', v_assignment.country_code,
    'valid_from', v_assignment.valid_from,
    'valid_to', v_assignment.valid_to,
    'profile', jsonb_build_object(
      'id', v_profile.id,
      'code', v_profile.code,
      'version', v_profile.version,
      'name', v_profile.name,
      'labels', v_profile.labels_json,
      'description', v_profile.description
    ),
    'operating_model', jsonb_build_object(
      'id', v_model.id,
      'code', v_model.code,
      'version', v_model.version,
      'name', v_model.name,
      'labels', v_model.labels_json,
      'description', v_model.description
    ),
    'allowed_space_kinds', v_allowed_space_kinds
  );
end;
$$;

revoke all on function customer_api.get_workspace_taxonomy_v1(uuid) from public, anon;
grant execute on function customer_api.get_workspace_taxonomy_v1(uuid) to authenticated, service_role;

-- 6. Canonical Catalog Options RPC: get_taxonomy_catalog_options_v1
create or replace function customer_api.get_taxonomy_catalog_options_v1(p_context_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, app_private
as $$
declare
  v_grant record;
  v_profiles jsonb;
  v_models jsonb;
  v_compatibilities jsonb;
begin
  -- 1. Authentication
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. Context grant & active membership
  select g.* into v_grant
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  -- 3. Query active profiles
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', p.code,
    'name', p.name,
    'labels', p.labels_json,
    'description', p.description
  ) order by p.code), '[]'::jsonb)
  into v_profiles
  from platform.property_profiles p
  where p.is_active = true and p.lifecycle_status = 'active'
    and p.valid_from <= statement_timestamp() and (p.valid_to is null or p.valid_to > statement_timestamp());

  -- 4. Query active operating models
  select coalesce(jsonb_agg(jsonb_build_object(
    'code', m.code,
    'name', m.name,
    'labels', m.labels_json,
    'description', m.description
  ) order by m.code), '[]'::jsonb)
  into v_models
  from platform.operating_models m
  where m.is_active = true and m.lifecycle_status = 'active'
    and m.valid_from <= statement_timestamp() and (m.valid_to is null or m.valid_to > statement_timestamp());

  -- 5. Query active compatibilities
  select coalesce(jsonb_agg(jsonb_build_object(
    'profile_code', p.code,
    'operating_model_code', m.code,
    'compatibility_level', c.compatibility_level
  )), '[]'::jsonb)
  into v_compatibilities
  from platform.property_operating_model_compatibilities c
  join platform.property_profiles p on p.id = c.property_profile_id
  join platform.operating_models m on m.id = c.operating_model_id
  where p.is_active = true and m.is_active = true;

  return jsonb_build_object(
    'profiles', v_profiles,
    'operating_models', v_models,
    'compatibilities', v_compatibilities
  );
end;
$$;

revoke all on function customer_api.get_taxonomy_catalog_options_v1(uuid) from public, anon;
grant execute on function customer_api.get_taxonomy_catalog_options_v1(uuid) to authenticated, service_role;

-- 7. Transactional Mutation RPC: assign_workspace_taxonomy_v1 (Fail-Closed, Canonical country_code, Versioned Idempotency)
create or replace function customer_api.assign_workspace_taxonomy_v1(
  p_context_id uuid,
  p_property_profile_code text,
  p_operating_model_code text,
  p_country_code text,
  p_idempotency_key uuid,
  p_expected_assignment_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, app_private
as $$
declare
  v_grant record;
  v_target_property_id uuid;
  v_binding_count integer;
  v_binding record;
  v_workspace platform.customer_workspaces%rowtype;
  v_normalized_reason text;
  v_expected_assignment_text text;
  v_request_hash text;
  v_idem record;
  v_profile record;
  v_model record;
  v_compat_level text;
  v_current_assignment record;
  v_now timestamptz;
  v_prev_profile_code text;
  v_prev_model_code text;
  v_before_snapshot jsonb;
  v_after_snapshot jsonb;
  v_action text;
  v_new_assignment_id uuid;
  v_audit_event_id bigint;
  v_response jsonb;
begin
  -- 1. Authentication check
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. Mandatory AAL2 verification
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- 3. Mandatory Idempotency Key
  if p_idempotency_key is null then
    raise exception 'workspace_taxonomy_idempotency_key_required' using errcode = '22023';
  end if;

  -- 4. Mandatory & Canonical Country Code verification (^([A-Z]{2})$ trimmed, no whitespace, no lowercase)
  if p_country_code is null then
    raise exception 'workspace_taxonomy_country_code_required' using errcode = '22023';
  elsif p_country_code <> trim(p_country_code) or p_country_code !~ '^[A-Z]{2}$' then
    raise exception 'workspace_taxonomy_country_code_invalid' using errcode = '22023';
  end if;

  -- 5. Context grant & active membership validation
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

  -- 6. Permission check: workspace.taxonomy.manage required
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_grant.role_id
      and rp.effect = 'allow'
      and p.code = 'workspace.taxonomy.manage'
  ) then
    raise exception 'workspace_taxonomy_manage_permission_required' using errcode = '42501';
  end if;

  -- 7. Fail-Closed Context-to-Workspace resolution:
  -- Context MUST have Property/Building/Unit scoped object connecting via workspace_property_bindings.
  -- Tenant-only fallback is strictly FORBIDDEN in mutation gateway.
  if v_grant.property_id is not null then
    v_target_property_id := v_grant.property_id;
  elsif v_grant.building_id is not null then
    select property_id into v_target_property_id
    from portfolio.buildings
    where id = v_grant.building_id and tenant_id = v_grant.membership_tenant;
  elsif v_grant.unit_id is not null then
    select b.property_id into v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = v_grant.unit_id and u.tenant_id = v_grant.membership_tenant;
  end if;

  if v_target_property_id is null then
    raise exception 'workspace_taxonomy_context_not_workspace_bound' using errcode = '42501';
  end if;

  select count(*)
  into v_binding_count
  from platform.workspace_property_bindings b
  where b.property_id = v_target_property_id
    and b.status = 'active'
    and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp());

  if v_binding_count = 0 then
    raise exception 'workspace_taxonomy_context_not_workspace_bound' using errcode = '42501';
  elsif v_binding_count > 1 then
    raise exception 'workspace_taxonomy_workspace_binding_ambiguous' using errcode = '42501';
  end if;

  select * into v_binding
  from platform.workspace_property_bindings b
  where b.property_id = v_target_property_id
    and b.status = 'active'
    and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp())
  limit 1;

  if v_binding.tenant_id <> v_grant.membership_tenant then
    raise exception 'workspace_taxonomy_workspace_binding_tenant_mismatch' using errcode = '42501';
  end if;

  select * into v_workspace
  from platform.customer_workspaces
  where id = v_binding.customer_workspace_id
    and tenant_id = v_grant.membership_tenant
    and lifecycle_status in ('PROVISIONING', 'ACTIVE');

  if v_workspace.id is null then
    raise exception 'workspace_taxonomy_context_not_workspace_bound' using errcode = '42501';
  end if;

  -- 8. Deterministic transactional lock per target workspace to serialize concurrent mutations
  perform pg_advisory_xact_lock(hashtextextended('workspace_taxonomy_mutation:' || v_workspace.id::text, 0));

  -- 9. Compute versioned request hash with explicit extensions schema call
  v_normalized_reason := coalesce(trim(p_reason), '');
  v_expected_assignment_text := coalesce(p_expected_assignment_id::text, '');

  v_request_hash := encode(extensions.digest(
    'v1|' ||
    v_workspace.id::text || '|' ||
    p_context_id::text || '|' ||
    p_property_profile_code || '|' ||
    p_operating_model_code || '|' ||
    p_country_code || '|' ||
    v_normalized_reason || '|' ||
    v_expected_assignment_text,
    'sha256'
  ), 'hex');

  -- 10. Check existing idempotency record
  select * into v_idem
  from platform.workspace_taxonomy_idempotency
  where tenant_id = v_grant.membership_tenant
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_idem.customer_workspace_id <> v_workspace.id or v_idem.request_hash <> v_request_hash then
      raise exception 'workspace_taxonomy_idempotency_conflict' using errcode = '23505';
    end if;
    return jsonb_set(v_idem.response_payload, '{idempotent_replay}', 'true'::jsonb);
  end if;

  -- 11. Lookup active Catalog records
  select * into v_profile
  from platform.property_profiles
  where code = p_property_profile_code
    and is_active = true and lifecycle_status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp())
  order by version desc limit 1;

  if not found then
    raise exception 'workspace_taxonomy_catalog_version_not_current' using errcode = '22023';
  end if;

  select * into v_model
  from platform.operating_models
  where code = p_operating_model_code
    and is_active = true and lifecycle_status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp())
  order by version desc limit 1;

  if not found then
    raise exception 'workspace_taxonomy_catalog_version_not_current' using errcode = '22023';
  end if;

  -- 12. Evaluate Compatibility Matrix
  select compatibility_level into v_compat_level
  from platform.property_operating_model_compatibilities
  where property_profile_id = v_profile.id
    and operating_model_id = v_model.id
  order by rule_version desc limit 1;

  if v_compat_level is null or v_compat_level = 'incompatible' then
    raise exception 'workspace_taxonomy_incompatible' using errcode = 'P0001';
  elsif v_compat_level = 'review_required' then
    if length(v_normalized_reason) = 0 then
      raise exception 'workspace_taxonomy_review_reason_required' using errcode = '22023';
    end if;
  end if;

  -- 13. Resolve current active assignment for the workspace
  select a.* into v_current_assignment
  from platform.workspace_taxonomy_assignments a
  where a.customer_workspace_id = v_workspace.id
    and a.status = 'active'
    and a.valid_from <= statement_timestamp() and (a.valid_to is null or a.valid_to > statement_timestamp())
  order by a.valid_from desc, a.created_at desc limit 1;

  -- 14. Validate Expected Assignment (Optimistic Concurrency Control)
  if v_current_assignment.id is not null then
    if p_expected_assignment_id is null or p_expected_assignment_id <> v_current_assignment.id then
      raise exception 'workspace_taxonomy_expected_assignment_conflict' using errcode = '40001';
    end if;
  else
    if p_expected_assignment_id is not null then
      raise exception 'workspace_taxonomy_expected_assignment_conflict' using errcode = '40001';
    end if;
  end if;

  -- 15. Timestamp and Transition / Creation Execution
  v_now := statement_timestamp();

  if v_current_assignment.id is not null then
    update platform.workspace_taxonomy_assignments
    set status = 'superseded',
        valid_to = v_now,
        updated_at = v_now
    where id = v_current_assignment.id;

    select code into v_prev_profile_code from platform.property_profiles where id = v_current_assignment.property_profile_id;
    select code into v_prev_model_code from platform.operating_models where id = v_current_assignment.operating_model_id;

    v_before_snapshot := jsonb_build_object(
      'assignment_id', v_current_assignment.id,
      'property_profile_id', v_current_assignment.property_profile_id,
      'property_profile_code', v_prev_profile_code,
      'operating_model_id', v_current_assignment.operating_model_id,
      'operating_model_code', v_prev_model_code,
      'country_code', v_current_assignment.country_code,
      'valid_from', v_current_assignment.valid_from,
      'valid_to', v_now
    );
    v_action := 'WORKSPACE_TAXONOMY_TRANSITIONED';
  else
    v_before_snapshot := null;
    v_action := 'WORKSPACE_TAXONOMY_ASSIGNED';
  end if;

  -- 16. Insert new assignment with canonical country_code
  insert into platform.workspace_taxonomy_assignments (
    tenant_id,
    customer_workspace_id,
    property_profile_id,
    operating_model_id,
    country_code,
    status,
    valid_from,
    valid_to,
    notes,
    created_by,
    created_at,
    updated_at
  ) values (
    v_grant.membership_tenant,
    v_workspace.id,
    v_profile.id,
    v_model.id,
    p_country_code,
    'active',
    v_now,
    null,
    p_reason,
    auth.uid(),
    v_now,
    v_now
  )
  returning id into v_new_assignment_id;

  -- 17. Insert Transactional Audit Evidence
  v_after_snapshot := jsonb_build_object(
    'assignment_id', v_new_assignment_id,
    'workspace_id', v_workspace.id,
    'property_profile_id', v_profile.id,
    'property_profile_code', v_profile.code,
    'operating_model_id', v_model.id,
    'operating_model_code', v_model.code,
    'country_code', p_country_code,
    'compatibility_status', v_compat_level,
    'valid_from', v_now,
    'valid_to', null,
    'reason', p_reason,
    'idempotency_key', p_idempotency_key
  );

  insert into audit.events (
    tenant_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    reason,
    before_snapshot,
    after_snapshot,
    occurred_at
  ) values (
    v_grant.membership_tenant,
    auth.uid(),
    v_grant.role_code,
    v_action,
    'workspace_taxonomy_assignment',
    v_new_assignment_id,
    p_reason,
    v_before_snapshot,
    v_after_snapshot,
    v_now
  )
  returning id into v_audit_event_id;

  -- 18. Build Response Payload
  v_response := jsonb_build_object(
    'workspace_id', v_workspace.id,
    'assignment_id', v_new_assignment_id,
    'previous_assignment_id', v_current_assignment.id,
    'property_profile_code', v_profile.code,
    'operating_model_code', v_model.code,
    'country_code', p_country_code,
    'compatibility_status', v_compat_level,
    'valid_from', v_now,
    'idempotent_replay', false,
    'audit_event_id', v_audit_event_id
  );

  -- 19. Store in Idempotency Registry
  insert into platform.workspace_taxonomy_idempotency (
    tenant_id,
    customer_workspace_id,
    idempotency_key,
    request_hash,
    assignment_id,
    previous_assignment_id,
    property_profile_code,
    operating_model_code,
    country_code,
    compatibility_status,
    valid_from,
    audit_event_id,
    response_payload
  ) values (
    v_grant.membership_tenant,
    v_workspace.id,
    p_idempotency_key,
    v_request_hash,
    v_new_assignment_id,
    v_current_assignment.id,
    v_profile.code,
    v_model.code,
    p_country_code,
    v_compat_level,
    v_now,
    v_audit_event_id,
    v_response
  );

  return v_response;
end;
$$;

-- 8. Revoke / Grant Permissions
revoke all on function customer_api.assign_workspace_taxonomy_v1(uuid, text, text, text, uuid, uuid, text) from public, anon;
grant execute on function customer_api.assign_workspace_taxonomy_v1(uuid, text, text, text, uuid, uuid, text) to authenticated, service_role;

commit;
