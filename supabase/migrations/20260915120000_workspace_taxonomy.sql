begin;

-- ============================================================================
-- Migration 100: Universal Workspace Taxonomy & Compatibility Matrix
-- Scope: Versioned Property Profiles, Operating Models, Space Kinds, Compatibility
-- Matrix, and Controlled Temporal Workspace Assignment.
-- Invariant: Workspace Profile != Operating Model != Building DNA != Service Profile != Country Pack
-- ============================================================================

-- 1. Property Profiles Registry
create table platform.property_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9_]{3,64}$'),
  version integer not null default 1 check (version > 0),
  name text not null check (length(trim(name)) > 0),
  labels_json jsonb not null check (
    jsonb_typeof(labels_json) = 'object'
    and coalesce(trim(labels_json->>'ro'), '') <> ''
    and coalesce(trim(labels_json->>'en'), '') <> ''
    and coalesce(trim(labels_json->>'fa'), '') <> ''
  ),
  description text,
  lifecycle_status platform.record_status not null default 'active',
  is_active boolean not null default true,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check (valid_to is null or valid_to > valid_from),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (code, version)
);

-- 2. Operating Models Registry
create table platform.operating_models (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9_]{3,64}$'),
  version integer not null default 1 check (version > 0),
  name text not null check (length(trim(name)) > 0),
  labels_json jsonb not null check (
    jsonb_typeof(labels_json) = 'object'
    and coalesce(trim(labels_json->>'ro'), '') <> ''
    and coalesce(trim(labels_json->>'en'), '') <> ''
    and coalesce(trim(labels_json->>'fa'), '') <> ''
  ),
  description text,
  lifecycle_status platform.record_status not null default 'active',
  is_active boolean not null default true,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check (valid_to is null or valid_to > valid_from),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (code, version)
);

-- 3. Space Kinds Registry
create table platform.space_kinds (
  id uuid primary key default gen_random_uuid(),
  code text not null check (code ~ '^[a-z0-9_]{3,64}$'),
  version integer not null default 1 check (version > 0),
  name text not null check (length(trim(name)) > 0),
  labels_json jsonb not null check (
    jsonb_typeof(labels_json) = 'object'
    and coalesce(trim(labels_json->>'ro'), '') <> ''
    and coalesce(trim(labels_json->>'en'), '') <> ''
    and coalesce(trim(labels_json->>'fa'), '') <> ''
  ),
  description text,
  lifecycle_status platform.record_status not null default 'active',
  is_active boolean not null default true,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check (valid_to is null or valid_to > valid_from),
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (code, version)
);

-- 4. Property Profile <-> Operating Model Compatibility Rules
create table platform.property_operating_model_compatibilities (
  id uuid primary key default gen_random_uuid(),
  property_profile_id uuid not null references platform.property_profiles(id) on delete restrict,
  operating_model_id uuid not null references platform.operating_models(id) on delete restrict,
  compatibility_level text not null check (compatibility_level in ('compatible', 'review_required', 'incompatible')),
  rule_version integer not null default 1 check (rule_version > 0),
  reason text not null,
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  unique (property_profile_id, operating_model_id, rule_version)
);

-- 5. Property Profile <-> Space Kind Compatibility Rules
create table platform.property_space_kind_compatibilities (
  id uuid primary key default gen_random_uuid(),
  property_profile_id uuid not null references platform.property_profiles(id) on delete restrict,
  space_kind_id uuid not null references platform.space_kinds(id) on delete restrict,
  compatibility_level text not null check (compatibility_level in ('compatible', 'review_required', 'incompatible')),
  rule_version integer not null default 1 check (rule_version > 0),
  reason text not null,
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default statement_timestamp(),
  unique (property_profile_id, space_kind_id, rule_version)
);

-- 6. Workspace Taxonomy Assignments (Temporal, Non-overlapping, Tenant-bound)
create table platform.workspace_taxonomy_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  property_profile_id uuid not null references platform.property_profiles(id) on delete restrict,
  operating_model_id uuid not null references platform.operating_models(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'superseded', 'archived')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  notes text,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from)
);

-- 7. Workspace Property Bindings (Canonical deterministic forward-only binding)
create table platform.workspace_property_bindings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  status text not null default 'active' check (status in ('active', 'superseded', 'archived')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  binding_source text not null check (binding_source in ('onboarding_activation', 'building_setup', 'platform_assignment', 'migration_verified')),
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from)
);

-- Indexes
create index property_profiles_code_ver_idx on platform.property_profiles (code, version);
create index operating_models_code_ver_idx on platform.operating_models (code, version);
create index space_kinds_code_ver_idx on platform.space_kinds (code, version);
create index prop_op_compat_lookup_idx on platform.property_operating_model_compatibilities (property_profile_id, operating_model_id);
create index prop_space_compat_lookup_idx on platform.property_space_kind_compatibilities (property_profile_id, space_kind_id);
create index ws_taxonomy_assignments_lookup_idx on platform.workspace_taxonomy_assignments (tenant_id, customer_workspace_id, status);
create index ws_prop_bindings_lookup_idx on platform.workspace_property_bindings (tenant_id, property_id, status);
create index ws_prop_bindings_ws_idx on platform.workspace_property_bindings (customer_workspace_id, status);

-- Trigger: Updated At
create trigger property_profiles_updated_at before update on platform.property_profiles for each row execute function app_private.set_updated_at();
create trigger operating_models_updated_at before update on platform.operating_models for each row execute function app_private.set_updated_at();
create trigger space_kinds_updated_at before update on platform.space_kinds for each row execute function app_private.set_updated_at();
create trigger ws_taxonomy_assignments_updated_at before update on platform.workspace_taxonomy_assignments for each row execute function app_private.set_updated_at();
create trigger ws_property_bindings_updated_at before update on platform.workspace_property_bindings for each row execute function app_private.set_updated_at();

-- Trigger: Guard Taxonomy Version Effective Period Overlap
create or replace function app_private.guard_taxonomy_version_effective_period_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_overlap boolean;
begin
  if new.is_active = true and new.lifecycle_status = 'active' then
    if TG_TABLE_NAME = 'property_profiles' then
      select exists (
        select 1 from platform.property_profiles p
        where p.code = new.code
          and p.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
          and p.is_active = true and p.lifecycle_status = 'active'
          and (
            (p.valid_to is null and (new.valid_to is null or new.valid_to > p.valid_from))
            or
            (p.valid_to is not null and new.valid_from < p.valid_to and (new.valid_to is null or new.valid_to > p.valid_from))
          )
      ) into v_overlap;
    elsif TG_TABLE_NAME = 'operating_models' then
      select exists (
        select 1 from platform.operating_models m
        where m.code = new.code
          and m.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
          and m.is_active = true and m.lifecycle_status = 'active'
          and (
            (m.valid_to is null and (new.valid_to is null or new.valid_to > m.valid_from))
            or
            (m.valid_to is not null and new.valid_from < m.valid_to and (new.valid_to is null or new.valid_to > m.valid_from))
          )
      ) into v_overlap;
    elsif TG_TABLE_NAME = 'space_kinds' then
      select exists (
        select 1 from platform.space_kinds s
        where s.code = new.code
          and s.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
          and s.is_active = true and s.lifecycle_status = 'active'
          and (
            (s.valid_to is null and (new.valid_to is null or new.valid_to > s.valid_from))
            or
            (s.valid_to is not null and new.valid_from < s.valid_to and (new.valid_to is null or new.valid_to > s.valid_from))
          )
      ) into v_overlap;
    end if;

    if coalesce(v_overlap, false) then
      raise exception 'workspace_taxonomy_version_effective_period_overlap' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_property_profiles_version_overlap
before insert or update on platform.property_profiles
for each row execute function app_private.guard_taxonomy_version_effective_period_v1();

create trigger guard_operating_models_version_overlap
before insert or update on platform.operating_models
for each row execute function app_private.guard_taxonomy_version_effective_period_v1();

create trigger guard_space_kinds_version_overlap
before insert or update on platform.space_kinds
for each row execute function app_private.guard_taxonomy_version_effective_period_v1();

-- Trigger: Prevent Deletion of Referenced Taxonomy Records
create or replace function app_private.guard_taxonomy_record_immutability_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_TABLE_NAME = 'property_profiles' then
    if exists (select 1 from platform.workspace_taxonomy_assignments where property_profile_id = old.id)
       or exists (select 1 from platform.property_operating_model_compatibilities where property_profile_id = old.id)
       or exists (select 1 from platform.property_space_kind_compatibilities where property_profile_id = old.id) then
      raise exception 'workspace_taxonomy_immutable_record' using errcode = '42501';
    end if;
  elsif TG_TABLE_NAME = 'operating_models' then
    if exists (select 1 from platform.workspace_taxonomy_assignments where operating_model_id = old.id)
       or exists (select 1 from platform.property_operating_model_compatibilities where operating_model_id = old.id) then
      raise exception 'workspace_taxonomy_immutable_record' using errcode = '42501';
    end if;
  elsif TG_TABLE_NAME = 'space_kinds' then
    if exists (select 1 from platform.property_space_kind_compatibilities where space_kind_id = old.id) then
      raise exception 'workspace_taxonomy_immutable_record' using errcode = '42501';
    end if;
  end if;
  return old;
end;
$$;

create trigger guard_property_profiles_immutability before delete on platform.property_profiles for each row execute function app_private.guard_taxonomy_record_immutability_v1();
create trigger guard_operating_models_immutability before delete on platform.operating_models for each row execute function app_private.guard_taxonomy_record_immutability_v1();
create trigger guard_space_kinds_immutability before delete on platform.space_kinds for each row execute function app_private.guard_taxonomy_record_immutability_v1();

-- Trigger: Guard Workspace Taxonomy Assignment History (Immutable audit baseline)
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
       or (old.created_by is distinct from new.created_by)
       or old.created_at <> new.created_at
       or old.valid_from <> new.valid_from then
      raise exception 'workspace_taxonomy_assignment_history_immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger a_guard_ws_taxonomy_assignments_history
before update or delete on platform.workspace_taxonomy_assignments
for each row execute function app_private.guard_workspace_taxonomy_assignment_history_v1();

-- Trigger: Guard Workspace Property Binding History (Immutable forward-only binding)
create or replace function app_private.guard_workspace_property_binding_history_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'workspace_property_binding_history_immutable' using errcode = '42501';
  elsif TG_OP = 'UPDATE' then
    if old.id <> new.id
       or old.tenant_id <> new.tenant_id
       or old.customer_workspace_id <> new.customer_workspace_id
       or old.property_id <> new.property_id
       or old.binding_source <> new.binding_source
       or (old.created_by is distinct from new.created_by)
       or old.created_at <> new.created_at
       or old.valid_from <> new.valid_from then
      raise exception 'workspace_property_binding_history_immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger a_guard_ws_property_bindings_history
before update or delete on platform.workspace_property_bindings
for each row execute function app_private.guard_workspace_property_binding_history_v1();

-- Trigger: Guard Workspace Property Binding (Tenant consistency, non-overlapping active periods for same property)
create or replace function app_private.guard_workspace_property_binding_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, portfolio
as $$
declare
  v_workspace_tenant uuid;
  v_property_tenant uuid;
begin
  -- 1. Validate Customer Workspace tenant
  select tenant_id into v_workspace_tenant
  from platform.customer_workspaces
  where id = new.customer_workspace_id for update;

  if not found then
    raise exception 'workspace_property_binding_workspace_not_found' using errcode = 'P0002';
  end if;

  if v_workspace_tenant <> new.tenant_id then
    raise exception 'workspace_taxonomy_workspace_binding_tenant_mismatch' using errcode = '42501';
  end if;

  -- 2. Validate Property tenant
  select tenant_id into v_property_tenant
  from portfolio.properties
  where id = new.property_id;

  if not found then
    raise exception 'workspace_property_binding_property_not_found' using errcode = 'P0002';
  end if;

  if v_property_tenant <> new.tenant_id then
    raise exception 'workspace_taxonomy_workspace_binding_tenant_mismatch' using errcode = '42501';
  end if;

  -- 3. Non-overlapping active bindings for this property
  if new.status = 'active' then
    if exists (
      select 1 from platform.workspace_property_bindings b
      where b.property_id = new.property_id
        and b.status = 'active'
        and b.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and (
          (b.valid_to is null and (new.valid_to is null or new.valid_to > b.valid_from))
          or
          (b.valid_to is not null and new.valid_from < b.valid_to and (new.valid_to is null or new.valid_to > b.valid_from))
        )
    ) then
      raise exception 'workspace_property_binding_overlap' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_ws_property_binding_before_ins_upd
before insert or update on platform.workspace_property_bindings
for each row execute function app_private.guard_workspace_property_binding_v1();

-- Trigger: Guard Workspace Taxonomy Assignment (Tenant isolation, compatibility evaluation, concurrency lock, non-overlapping active periods)
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

  -- Fail-closed default deny if compatibility rule does not exist
  if v_compat_level is null then
    raise exception 'workspace_taxonomy_compatibility_rule_missing' using errcode = 'P0001';
  end if;

  if v_compat_level = 'incompatible' then
    raise exception 'workspace_taxonomy_incompatible_assignment' using errcode = 'P0001';
  elsif v_compat_level = 'review_required' then
    -- Review required combinations cannot become active without independent approval
    if new.status = 'active' then
      raise exception 'workspace_taxonomy_review_required' using errcode = 'P0001';
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

create trigger guard_ws_taxonomy_assignment_before_ins_upd
before insert or update on platform.workspace_taxonomy_assignments
for each row execute function app_private.guard_workspace_taxonomy_assignment_v1();

-- Function: Validate Compatibility Helper
create or replace function app_private.validate_taxonomy_compatibility_v1(
  p_property_profile_id uuid,
  p_operating_model_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_compat record;
begin
  select * into v_compat
  from platform.property_operating_model_compatibilities
  where property_profile_id = p_property_profile_id
    and operating_model_id = p_operating_model_id
  order by rule_version desc limit 1;

  if not found then
    return jsonb_build_object(
      'is_allowed', false,
      'compatibility_level', 'missing_rule',
      'reason', 'No explicit compatibility rule defined for this profile and operating model combination.'
    );
  end if;

  return jsonb_build_object(
    'is_allowed', (v_compat.compatibility_level = 'compatible'),
    'compatibility_level', v_compat.compatibility_level,
    'reason', v_compat.reason
  );
end;
$$;

-- RLS Configuration
alter table platform.property_profiles enable row level security;
alter table platform.operating_models enable row level security;
alter table platform.space_kinds enable row level security;
alter table platform.property_operating_model_compatibilities enable row level security;
alter table platform.property_space_kind_compatibilities enable row level security;
alter table platform.workspace_taxonomy_assignments enable row level security;
alter table platform.workspace_property_bindings enable row level security;

-- Default Deny on all tables for public, anon, authenticated
revoke all on platform.property_profiles from public, anon, authenticated;
revoke all on platform.operating_models from public, anon, authenticated;
revoke all on platform.space_kinds from public, anon, authenticated;
revoke all on platform.property_operating_model_compatibilities from public, anon, authenticated;
revoke all on platform.property_space_kind_compatibilities from public, anon, authenticated;
revoke all on platform.workspace_taxonomy_assignments from public, anon, authenticated;
revoke all on platform.workspace_property_bindings from public, anon, authenticated;

-- Minimal grants strictly to service_role on the newly created tables
grant select, insert, update, delete on platform.property_profiles to service_role;
grant select, insert, update, delete on platform.operating_models to service_role;
grant select, insert, update, delete on platform.space_kinds to service_role;
grant select, insert, update, delete on platform.property_operating_model_compatibilities to service_role;
grant select, insert, update, delete on platform.property_space_kind_compatibilities to service_role;
grant select, insert, update, delete on platform.workspace_taxonomy_assignments to service_role;
grant select, insert, update, delete on platform.workspace_property_bindings to service_role;

-- ============================================================================
-- Seed Registries (16 Property Profiles, 8 Operating Models, 18 Space Kinds)
-- ============================================================================

-- 1. Property Profiles Seeds
insert into platform.property_profiles (code, version, name, labels_json, description)
values
  ('residential_condominium', 1, 'Residential Condominium', jsonb_build_object('en','Residential Condominium','ro','Condominiu rezidențial','fa','مجتمع آپارتمانی مسکونی'), 'Apartment building or condominium block under co-ownership governance'),
  ('residential_complex', 1, 'Residential Complex', jsonb_build_object('en','Residential Complex','ro','Complex rezidențial','fa','شهرک یا مجتمع بزرگ مسکونی'), 'Multi-building residential development with shared amenities and roads'),
  ('gated_villa_community', 1, 'Gated Villa Community', jsonb_build_object('en','Gated Villa Community','ro','Ansamblu rezidențial de vile','fa','شهرک ویلایی محصور'), 'Gated community of detached or semi-detached villas with perimeter security'),
  ('single_villa', 1, 'Single Villa', jsonb_build_object('en','Single Villa','ro','Vilă individuală','fa','ویلای مستقل'), 'Individual standalone private residential villa or estate'),
  ('small_landlord_portfolio', 1, 'Small Landlord Portfolio', jsonb_build_object('en','Small Landlord Portfolio','ro','Portofoliu proprietar individual','fa','پورتفولیوی مالک خرد'), 'Individual or family portfolio of multiple residential or light rental properties'),
  ('mixed_use_estate', 1, 'Mixed-Use Estate', jsonb_build_object('en','Mixed-Use Estate','ro','Complex cu funcțiuni mixte','fa','مجتمع چندمنظوره / تجاری مسکونی'), 'Integrated estate combining residential apartments, retail shops, and commercial offices'),
  ('retail_centre', 1, 'Retail Centre', jsonb_build_object('en','Retail Centre','ro','Centru comercial / Mall','fa','مرکز تجاری و فروشگاهی'), 'Shopping mall, retail park or commercial shopping centre'),
  ('office_centre', 1, 'Office Centre', jsonb_build_object('en','Office Centre','ro','Centru de birouri','fa','مجتمع اداری'), 'Corporate office building, business park or multi-tenant commercial centre'),
  ('warehouse_logistics', 1, 'Warehouse & Logistics Centre', jsonb_build_object('en','Warehouse & Logistics Centre','ro','Centru logistic și depozite','fa','مرکز لجستیک و انبارداری'), 'Logistics park, distribution center or multi-bay industrial warehouse'),
  ('managed_township', 1, 'Managed Township', jsonb_build_object('en','Managed Township','ro','District administrat / Township','fa','شهرک شهری مدیریت‌شده'), 'Large-scale master-planned district or private managed township'),
  ('industrial_park', 1, 'Industrial Park', jsonb_build_object('en','Industrial Park','ro','Parc industrial','fa','پارک / منطقه صنعتی'), 'Industrial zone or manufacturing estate with heavy infrastructure'),
  ('serviced_residence', 1, 'Serviced Residence', jsonb_build_object('en','Serviced Residence','ro','Reședință cu servicii incluse','fa','اقامتگاه مبله / هتلی'), 'Serviced apartments, co-living or student housing with integrated hospitality services'),
  ('standalone_parking', 1, 'Standalone Parking Facility', jsonb_build_object('en','Standalone Parking Facility','ro','Parcare autonomă administrată','fa','پارکینگ طبقاتی یا مستقل'), 'Dedicated multi-story parking structure or managed surface parking facility'),
  ('shared_facility', 1, 'Shared Facility', jsonb_build_object('en','Shared Facility','ro','Facilitate comună administrată','fa','مرکز خدمات و امکانات مشترک'), 'Standalone sports club, business hub, community centre or amenity facility'),
  ('developer_portfolio', 1, 'Developer Portfolio', jsonb_build_object('en','Developer Portfolio','ro','Portofoliu dezvoltator','fa','پورتفولیوی توسعه‌دهنده'), 'Institutional real estate portfolio managed by the master developer'),
  ('third_party_management_portfolio', 1, 'Third-Party Management Portfolio', jsonb_build_object('en','Third-Party Management Portfolio','ro','Portofoliu administrare terță','fa','پورتفولیوی مدیریت قراردادهای ثالث'), 'Property management company portfolio operating third-party real estate assets');

-- 2. Operating Models Seeds
insert into platform.operating_models (code, version, name, labels_json, description)
values
  ('association_managed', 1, 'Owners Association Managed', jsonb_build_object('en','Owners Association Managed','ro','Administrare prin Asociație de Proprietari','fa','مدیریت هیئت مدیره / انجمن مالکان'), 'Statutory condominium or HOA association governance under co-ownership law'),
  ('single_owner_operated', 1, 'Single Owner Operated', jsonb_build_object('en','Single Owner Operated','ro','Operat de proprietar unic','fa','بهره‌برداری توسط تک مالک'), 'Direct operational authority by single asset owner or landlord entity'),
  ('developer_operated', 1, 'Developer Operated', jsonb_build_object('en','Developer Operated','ro','Operat de dezvoltator','fa','بهره‌برداری مستقیم توسعه‌دهنده'), 'Direct operational and warranty management by master real estate developer'),
  ('third_party_managed', 1, 'Third-Party Contract Managed', jsonb_build_object('en','Third-Party Contract Managed','ro','Administrare prin companie de property management','fa','مدیریت پیمانکاری توسط شرکت مدیریت ملک'), 'Professional property management company acting under commercial mandate'),
  ('master_lease', 1, 'Master Lease & Operated', jsonb_build_object('en','Master Lease & Operated','ro','Închiriere generală și operare','fa','اجاره کل و بهره‌برداری تجاری'), 'Single master lessee entity sub-leasing and operating the property'),
  ('multi_owner_contractual', 1, 'Multi-Owner Contractual Governance', jsonb_build_object('en','Multi-Owner Contractual Governance','ro','Guvernanță contractuală între co-proprietari','fa','مدیریت قراردادی میان چند مالک'), 'Contractual multi-party management agreement without statutory association structure'),
  ('institutional_owner', 1, 'Institutional / Fund Owner Operated', jsonb_build_object('en','Institutional / Fund Owner Operated','ro','Proprietar instituțional / Fond de investiții','fa','مالکیت نهادی و صندوق سرمایه‌گذاری'), 'Corporate real estate investment trust (REIT) or institutional fund asset operator'),
  ('mixed_authority', 1, 'Mixed Authority Management', jsonb_build_object('en','Mixed Authority Management','ro','Administrare cu autoritate mixtă','fa','مدیریت با ساختار اختیارات ترکیبی'), 'Composite governance combining association rights for residential and contractual mandates for commercial');

-- 3. Space Kinds Seeds
insert into platform.space_kinds (code, version, name, labels_json, description)
values
  ('residential_unit', 1, 'Residential Unit', jsonb_build_object('en','Residential Unit','ro','Apartament / Unitate rezidențială','fa','واحد مسکونی / آپارتمان'), 'Private apartment or residential living space'),
  ('villa', 1, 'Villa', jsonb_build_object('en','Villa','ro','Vilă','fa','ویلای مستقل یا دوبلکس'), 'Standalone or semi-detached residential villa'),
  ('retail_unit', 1, 'Retail Unit', jsonb_build_object('en','Retail Unit','ro','Spațiu comercial / Magazin','fa','واحد تجاری / فروشگاه'), 'Commercial retail shop, storefront or restaurant premises'),
  ('office_suite', 1, 'Office Suite', jsonb_build_object('en','Office Suite','ro','Spațiu de birouri','fa','واحد اداری / سوئیت شرکتی'), 'Corporate office, suite or floor section'),
  ('warehouse_bay', 1, 'Warehouse Bay', jsonb_build_object('en','Warehouse Bay','ro','Hală depozitare / Modul logistic','fa','دهانه انبار / سالن لجستیک'), 'Industrial storage bay or distribution module'),
  ('industrial_lot', 1, 'Industrial Lot', jsonb_build_object('en','Industrial Lot','ro','Lot industrial','fa','قطعه زمین صنعتی'), 'Designated industrial plot with heavy utility access'),
  ('factory_hall', 1, 'Factory Hall', jsonb_build_object('en','Factory Hall','ro','Hală de producție','fa','سالن تولید / کارخانه'), 'Manufacturing or industrial production facility'),
  ('parking_space', 1, 'Parking Space', jsonb_build_object('en','Parking Space','ro','Loc de parcare','fa','جایگاه پارکینگ'), 'Designated vehicle parking stall or garage space'),
  ('storage_space', 1, 'Storage Space', jsonb_build_object('en','Storage Space','ro','Boxă / Spațiu depozitare','fa','انبارچه / باکس ذخیره‌سازی'), 'Private storage room, basement locker or box'),
  ('common_area', 1, 'Common Area', jsonb_build_object('en','Common Area','ro','Spațiu comun','fa','مشاعات عمومی'), 'Shared building corridor, lobby, roof or stairwell'),
  ('shared_facility', 1, 'Shared Facility', jsonb_build_object('en','Shared Facility','ro','Facilitate comună','fa','امکانات مشترک'), 'Shared business lounge, meeting room, or community hall'),
  ('amenity', 1, 'Amenity', jsonb_build_object('en','Amenity','ro','Facilitate agrement','fa','امکانات رفاهی و ورزشی'), 'Swimming pool, gym, spa, playground or tennis court'),
  ('service_point', 1, 'Service Point', jsonb_build_object('en','Service Point','ro','Punct de servicii','fa','نقطه ارائه خدمت / نگهبانی'), 'Concierge desk, security checkpoint, maintenance hub or parcel locker'),
  ('provider_location', 1, 'Provider Location', jsonb_build_object('en','Provider Location','ro','Locație furnizor on-site','fa','موقعیت ارائه‌دهنده خدمات'), 'On-site commercial partner location (café, branch, ATM)'),
  ('technical_room', 1, 'Technical Room', jsonb_build_object('en','Technical Room','ro','Cameră tehnică','fa','اتاق تأسیسات فنی'), 'HVAC room, electrical transformer, boiler room or pump station'),
  ('courtyard_garden', 1, 'Courtyard & Garden', jsonb_build_object('en','Courtyard & Garden','ro','Curte interioară și grădină','fa','حیاط مرکزی و فضای سبز'), 'Shared residential courtyard, landscaped garden or park area'),
  ('roof_deck', 1, 'Roof Deck & Terrace', jsonb_build_object('en','Roof Deck & Terrace','ro','Terasă pe acoperiș','fa','تراس / روف‌گاردن'), 'Accessible shared rooftop terrace or private penthouse deck'),
  ('infrastructure_node', 1, 'Infrastructure Node', jsonb_build_object('en','Infrastructure Node','ro','Nod de infrastructură','fa','گره زیرساخت و دسترسی'), 'Access gates, telecom rooms, waste management hub or utility metering point');

-- 4. Seed Canonical Compatibility Rules (Property Profile <-> Operating Model)
insert into platform.property_operating_model_compatibilities (property_profile_id, operating_model_id, compatibility_level, reason)
select p.id, m.id,
  case
    -- Condominium
    when p.code = 'residential_condominium' and m.code in ('association_managed', 'third_party_managed') then 'compatible'
    when p.code = 'residential_condominium' and m.code in ('developer_operated', 'multi_owner_contractual') then 'review_required'
    when p.code = 'residential_condominium' then 'incompatible'

    -- Residential Complex
    when p.code = 'residential_complex' and m.code in ('association_managed', 'third_party_managed', 'mixed_authority') then 'compatible'
    when p.code = 'residential_complex' and m.code in ('developer_operated', 'multi_owner_contractual') then 'review_required'
    when p.code = 'residential_complex' then 'incompatible'

    -- Gated Villa Community
    when p.code = 'gated_villa_community' and m.code in ('association_managed', 'third_party_managed', 'multi_owner_contractual') then 'compatible'
    when p.code = 'gated_villa_community' and m.code = 'developer_operated' then 'review_required'
    when p.code = 'gated_villa_community' then 'incompatible'

    -- Single Villa
    when p.code = 'single_villa' and m.code in ('single_owner_operated', 'third_party_managed', 'master_lease') then 'compatible'
    when p.code = 'single_villa' then 'incompatible'

    -- Small Landlord Portfolio
    when p.code = 'small_landlord_portfolio' and m.code in ('single_owner_operated', 'third_party_managed', 'master_lease') then 'compatible'
    when p.code = 'small_landlord_portfolio' then 'incompatible'

    -- Mixed-Use Estate
    when p.code = 'mixed_use_estate' and m.code in ('mixed_authority', 'third_party_managed', 'institutional_owner') then 'compatible'
    when p.code = 'mixed_use_estate' and m.code in ('association_managed', 'developer_operated', 'multi_owner_contractual') then 'review_required'
    when p.code = 'mixed_use_estate' then 'incompatible'

    -- Retail Centre
    when p.code = 'retail_centre' and m.code in ('single_owner_operated', 'third_party_managed', 'institutional_owner', 'master_lease') then 'compatible'
    when p.code = 'retail_centre' and m.code = 'developer_operated' then 'review_required'
    when p.code = 'retail_centre' then 'incompatible'

    -- Office Centre
    when p.code = 'office_centre' and m.code in ('single_owner_operated', 'third_party_managed', 'institutional_owner', 'master_lease') then 'compatible'
    when p.code = 'office_centre' and m.code = 'developer_operated' then 'review_required'
    when p.code = 'office_centre' then 'incompatible'

    -- Warehouse Logistics
    when p.code = 'warehouse_logistics' and m.code in ('single_owner_operated', 'third_party_managed', 'institutional_owner', 'master_lease') then 'compatible'
    when p.code = 'warehouse_logistics' then 'incompatible'

    -- Managed Township
    when p.code = 'managed_township' and m.code in ('mixed_authority', 'third_party_managed', 'developer_operated', 'institutional_owner') then 'compatible'
    when p.code = 'managed_township' then 'incompatible'

    -- Industrial Park
    when p.code = 'industrial_park' and m.code in ('single_owner_operated', 'third_party_managed', 'institutional_owner', 'mixed_authority') then 'compatible'
    when p.code = 'industrial_park' then 'incompatible'

    -- Serviced Residence
    when p.code = 'serviced_residence' and m.code in ('single_owner_operated', 'third_party_managed', 'master_lease', 'institutional_owner') then 'compatible'
    when p.code = 'serviced_residence' and m.code = 'developer_operated' then 'review_required'
    when p.code = 'serviced_residence' then 'incompatible'

    -- Standalone Parking
    when p.code = 'standalone_parking' and m.code in ('single_owner_operated', 'third_party_managed', 'master_lease', 'mixed_authority') then 'compatible'
    when p.code = 'standalone_parking' then 'incompatible'

    -- Shared Facility
    when p.code = 'shared_facility' and m.code in ('third_party_managed', 'single_owner_operated', 'mixed_authority') then 'compatible'
    when p.code = 'shared_facility' and m.code = 'association_managed' then 'review_required'
    when p.code = 'shared_facility' then 'incompatible'

    -- Developer Portfolio
    when p.code = 'developer_portfolio' and m.code in ('developer_operated', 'third_party_managed') then 'compatible'
    when p.code = 'developer_portfolio' then 'incompatible'

    -- Third-Party Portfolio
    when p.code = 'third_party_management_portfolio' and m.code in ('third_party_managed', 'mixed_authority') then 'compatible'
    when p.code = 'third_party_management_portfolio' then 'incompatible'

    else 'incompatible'
  end as compatibility_level,
  'Canonical architectural compatibility matrix v1.0' as reason
from platform.property_profiles p
cross join platform.operating_models m;

-- 5. Seed Canonical Compatibility Rules (Property Profile <-> Space Kind)
insert into platform.property_space_kind_compatibilities (property_profile_id, space_kind_id, compatibility_level, reason)
select p.id, s.id,
  case
    -- Condominium Allowed Spaces
    when p.code = 'residential_condominium' and s.code in ('residential_unit', 'parking_space', 'storage_space', 'common_area', 'technical_room', 'service_point', 'roof_deck') then 'compatible'
    when p.code = 'residential_condominium' and s.code in ('retail_unit', 'amenity', 'shared_facility', 'courtyard_garden') then 'review_required'
    when p.code = 'residential_condominium' then 'incompatible'

    -- Residential Complex
    when p.code = 'residential_complex' and s.code in ('residential_unit', 'villa', 'parking_space', 'storage_space', 'common_area', 'amenity', 'shared_facility', 'technical_room', 'service_point', 'courtyard_garden', 'roof_deck', 'infrastructure_node') then 'compatible'
    when p.code = 'residential_complex' and s.code in ('retail_unit', 'provider_location') then 'review_required'
    when p.code = 'residential_complex' then 'incompatible'

    -- Gated Villa Community
    when p.code = 'gated_villa_community' and s.code in ('villa', 'parking_space', 'storage_space', 'common_area', 'amenity', 'shared_facility', 'technical_room', 'service_point', 'courtyard_garden', 'infrastructure_node') then 'compatible'
    when p.code = 'gated_villa_community' and s.code in ('provider_location', 'retail_unit') then 'review_required'
    when p.code = 'gated_villa_community' then 'incompatible'

    -- Single Villa
    when p.code = 'single_villa' and s.code in ('villa', 'parking_space', 'storage_space', 'courtyard_garden', 'amenity', 'technical_room') then 'compatible'
    when p.code = 'single_villa' then 'incompatible'

    -- Small Landlord Portfolio
    when p.code = 'small_landlord_portfolio' and s.code in ('residential_unit', 'villa', 'parking_space', 'storage_space') then 'compatible'
    when p.code = 'small_landlord_portfolio' and s.code in ('retail_unit', 'office_suite') then 'review_required'
    when p.code = 'small_landlord_portfolio' then 'incompatible'

    -- Mixed Use Estate
    when p.code = 'mixed_use_estate' and s.code in ('residential_unit', 'retail_unit', 'office_suite', 'parking_space', 'storage_space', 'common_area', 'shared_facility', 'amenity', 'service_point', 'provider_location', 'technical_room', 'courtyard_garden', 'roof_deck', 'infrastructure_node') then 'compatible'
    when p.code = 'mixed_use_estate' and s.code = 'warehouse_bay' then 'review_required'
    when p.code = 'mixed_use_estate' then 'incompatible'

    -- Retail Centre
    when p.code = 'retail_centre' and s.code in ('retail_unit', 'parking_space', 'storage_space', 'common_area', 'service_point', 'provider_location', 'technical_room', 'infrastructure_node', 'amenity') then 'compatible'
    when p.code = 'retail_centre' and s.code in ('office_suite', 'warehouse_bay') then 'review_required'
    when p.code = 'retail_centre' then 'incompatible'

    -- Office Centre
    when p.code = 'office_centre' and s.code in ('office_suite', 'retail_unit', 'parking_space', 'storage_space', 'common_area', 'shared_facility', 'service_point', 'provider_location', 'technical_room', 'infrastructure_node') then 'compatible'
    when p.code = 'office_centre' and s.code = 'warehouse_bay' then 'review_required'
    when p.code = 'office_centre' then 'incompatible'

    -- Warehouse & Logistics
    when p.code = 'warehouse_logistics' and s.code in ('warehouse_bay', 'industrial_lot', 'office_suite', 'parking_space', 'storage_space', 'technical_room', 'infrastructure_node', 'service_point') then 'compatible'
    when p.code = 'warehouse_logistics' then 'incompatible'

    -- Managed Township
    when p.code = 'managed_township' then 'compatible'

    -- Industrial Park
    when p.code = 'industrial_park' and s.code in ('industrial_lot', 'factory_hall', 'warehouse_bay', 'office_suite', 'parking_space', 'storage_space', 'technical_room', 'infrastructure_node', 'service_point') then 'compatible'
    when p.code = 'industrial_park' then 'incompatible'

    -- Serviced Residence
    when p.code = 'serviced_residence' and s.code in ('residential_unit', 'parking_space', 'storage_space', 'common_area', 'amenity', 'shared_facility', 'service_point', 'provider_location', 'technical_room') then 'compatible'
    when p.code = 'serviced_residence' and s.code in ('retail_unit', 'office_suite') then 'review_required'
    when p.code = 'serviced_residence' then 'incompatible'

    -- Standalone Parking
    when p.code = 'standalone_parking' and s.code in ('parking_space', 'technical_room', 'service_point', 'infrastructure_node') then 'compatible'
    when p.code = 'standalone_parking' and s.code = 'storage_space' then 'review_required'
    when p.code = 'standalone_parking' then 'incompatible'

    -- Shared Facility
    when p.code = 'shared_facility' and s.code in ('shared_facility', 'amenity', 'service_point', 'common_area', 'technical_room', 'parking_space', 'provider_location') then 'compatible'
    when p.code = 'shared_facility' then 'incompatible'

    -- Developer Portfolio
    when p.code = 'developer_portfolio' then 'compatible'

    -- Third-Party Management Portfolio
    when p.code = 'third_party_management_portfolio' then 'compatible'

    else 'incompatible'
  end as compatibility_level,
  'Canonical architectural space kind matrix v1.0' as reason
from platform.property_profiles p
cross join platform.space_kinds s;

-- ============================================================================
-- Customer-Facing Controlled Read APIs
-- ============================================================================

-- Customer API: Get Resolved Workspace Taxonomy & Compatibility
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

  -- 4. Context-to-Workspace resolution (Canonical chain: Context Grant -> Scoped Object -> Property -> workspace_property_bindings -> Customer Workspace)
  if v_target_property_id is not null then
    -- Property-scoped context REQUIRES explicit canonical binding; NO fallback to single-workspace
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
  else
    -- Pure tenant-scoped context without property/building/unit scope
    select count(*) into v_ws_count
    from platform.customer_workspaces
    where tenant_id = v_grant.membership_tenant and lifecycle_status in ('PROVISIONING', 'ACTIVE');

    if v_ws_count = 1 then
      select * into v_workspace
      from platform.customer_workspaces
      where tenant_id = v_grant.membership_tenant and lifecycle_status in ('PROVISIONING', 'ACTIVE');
    else
      -- Tenant has 0 or >1 workspaces; fail-closed without guessing
      raise exception 'workspace_taxonomy_context_not_workspace_bound' using errcode = '42501';
    end if;
  end if;

  if v_workspace.id is null then
    raise exception 'workspace_taxonomy_context_not_workspace_bound' using errcode = '42501';
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

-- Customer API: List Active Taxonomy Profiles
create or replace function customer_api.list_taxonomy_profiles_v1(p_context_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, app_private
as $$
declare
  v_grant record;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select g.* into v_grant
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'code', p.code,
      'version', p.version,
      'name', p.name,
      'labels', p.labels_json,
      'description', p.description
    ) order by p.code), '[]'::jsonb)
    from platform.property_profiles p
    where p.is_active = true and p.lifecycle_status = 'active'
      and p.valid_from <= statement_timestamp() and (p.valid_to is null or p.valid_to > statement_timestamp())
  );
end;
$$;

-- Customer API: List Active Operating Models
create or replace function customer_api.list_taxonomy_operating_models_v1(p_context_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, app_private
as $$
declare
  v_grant record;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select g.* into v_grant
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id,
      'code', m.code,
      'version', m.version,
      'name', m.name,
      'labels', m.labels_json,
      'description', m.description
    ) order by m.code), '[]'::jsonb)
    from platform.operating_models m
    where m.is_active = true and m.lifecycle_status = 'active'
      and m.valid_from <= statement_timestamp() and (m.valid_to is null or m.valid_to > statement_timestamp())
  );
end;
$$;

-- Customer API: List Active Space Kinds
create or replace function customer_api.list_taxonomy_space_kinds_v1(p_context_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, app_private
as $$
declare
  v_grant record;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select g.* into v_grant
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'code', s.code,
      'version', s.version,
      'name', s.name,
      'labels', s.labels_json,
      'description', s.description
    ) order by s.code), '[]'::jsonb)
    from platform.space_kinds s
    where s.is_active = true and s.lifecycle_status = 'active'
      and s.valid_from <= statement_timestamp() and (s.valid_to is null or s.valid_to > statement_timestamp())
  );
end;
$$;

-- Revoke / Grant Permissions
revoke all on function customer_api.get_workspace_taxonomy_v1(uuid) from public;
revoke all on function customer_api.list_taxonomy_profiles_v1(uuid) from public;
revoke all on function customer_api.list_taxonomy_operating_models_v1(uuid) from public;
revoke all on function customer_api.list_taxonomy_space_kinds_v1(uuid) from public;

grant execute on function customer_api.get_workspace_taxonomy_v1(uuid) to authenticated, service_role;
grant execute on function customer_api.list_taxonomy_profiles_v1(uuid) to authenticated, service_role;
grant execute on function customer_api.list_taxonomy_operating_models_v1(uuid) to authenticated, service_role;
grant execute on function customer_api.list_taxonomy_space_kinds_v1(uuid) to authenticated, service_role;

revoke all on function app_private.validate_taxonomy_compatibility_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function app_private.validate_taxonomy_compatibility_v1(uuid, uuid) to service_role;

commit;
