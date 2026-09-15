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
  code text not null,
  version integer not null default 1 check (version > 0),
  name text not null,
  labels_json jsonb not null,
  description text,
  lifecycle_status platform.record_status not null default 'active',
  is_active boolean not null default true,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (code, version),
  check (valid_to is null or valid_to > valid_from)
);

-- 2. Operating Models Registry
create table platform.operating_models (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null default 1 check (version > 0),
  name text not null,
  labels_json jsonb not null,
  description text,
  lifecycle_status platform.record_status not null default 'active',
  is_active boolean not null default true,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (code, version),
  check (valid_to is null or valid_to > valid_from)
);

-- 3. Space Kinds Registry
create table platform.space_kinds (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  version integer not null default 1 check (version > 0),
  name text not null,
  labels_json jsonb not null,
  description text,
  lifecycle_status platform.record_status not null default 'active',
  is_active boolean not null default true,
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (code, version),
  check (valid_to is null or valid_to > valid_from)
);

-- 4. Property Profile <-> Operating Model Compatibility Rules
create table platform.property_operating_model_compatibilities (
  id uuid primary key default gen_random_uuid(),
  property_profile_id uuid not null references platform.property_profiles(id) on delete restrict,
  operating_model_id uuid not null references platform.operating_models(id) on delete restrict,
  compatibility_level text not null check (compatibility_level in ('compatible', 'review_required', 'incompatible')),
  rule_version integer not null default 1 check (rule_version > 0),
  reason text not null,
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

-- Indexes
create index property_profiles_code_ver_idx on platform.property_profiles (code, version);
create index operating_models_code_ver_idx on platform.operating_models (code, version);
create index space_kinds_code_ver_idx on platform.space_kinds (code, version);
create index prop_op_compat_lookup_idx on platform.property_operating_model_compatibilities (property_profile_id, operating_model_id);
create index prop_space_compat_lookup_idx on platform.property_space_kind_compatibilities (property_profile_id, space_kind_id);
create index ws_taxonomy_assignments_lookup_idx on platform.workspace_taxonomy_assignments (tenant_id, customer_workspace_id, status);

-- Trigger: Updated At
create trigger property_profiles_updated_at before update on platform.property_profiles for each row execute function app_private.set_updated_at();
create trigger operating_models_updated_at before update on platform.operating_models for each row execute function app_private.set_updated_at();
create trigger space_kinds_updated_at before update on platform.space_kinds for each row execute function app_private.set_updated_at();
create trigger ws_taxonomy_assignments_updated_at before update on platform.workspace_taxonomy_assignments for each row execute function app_private.set_updated_at();

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
    raise exception 'workspace_taxonomy_not_found' using errcode = 'P0002';
  end if;

  select is_active into v_model_active from platform.operating_models
  where id = new.operating_model_id and lifecycle_status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp());
  if not coalesce(v_model_active, false) then
    raise exception 'workspace_taxonomy_not_found' using errcode = 'P0002';
  end if;

  -- 3. Compatibility Rule check (Fail-closed)
  select compatibility_level into v_compat_level
  from platform.property_operating_model_compatibilities
  where property_profile_id = new.property_profile_id and operating_model_id = new.operating_model_id
  order by rule_version desc limit 1;

  if v_compat_level is null then
    raise exception 'workspace_taxonomy_compatibility_rule_missing' using errcode = 'P0001';
  elsif v_compat_level = 'incompatible' then
    raise exception 'workspace_taxonomy_incompatible_assignment' using errcode = 'P0001';
  elsif v_compat_level = 'review_required' then
    raise exception 'workspace_taxonomy_review_required' using errcode = 'P0001';
  end if;

  -- 4. Temporal non-overlapping active assignment check
  if new.status = 'active' then
    if exists (
      select 1 from platform.workspace_taxonomy_assignments a
      where a.customer_workspace_id = new.customer_workspace_id
        and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and a.status = 'active'
        and (
          (a.valid_to is null and (new.valid_to is null or new.valid_to > a.valid_from))
          or (new.valid_to is null and a.valid_to > new.valid_from)
          or (a.valid_to is not null and new.valid_to is not null and a.valid_from < new.valid_to and new.valid_from < a.valid_to)
        )
    ) then
      raise exception 'workspace_taxonomy_assignment_overlap' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

create trigger guard_workspace_taxonomy_assignment
before insert or update on platform.workspace_taxonomy_assignments
for each row execute function app_private.guard_workspace_taxonomy_assignment_v1();

-- Enable RLS on all tables
alter table platform.property_profiles enable row level security;
alter table platform.operating_models enable row level security;
alter table platform.space_kinds enable row level security;
alter table platform.property_operating_model_compatibilities enable row level security;
alter table platform.property_space_kind_compatibilities enable row level security;
alter table platform.workspace_taxonomy_assignments enable row level security;

-- Read-only policies for authenticated principals
create policy property_profiles_active_read on platform.property_profiles
  for select to authenticated using (is_active = true and lifecycle_status = 'active');

create policy operating_models_active_read on platform.operating_models
  for select to authenticated using (is_active = true and lifecycle_status = 'active');

create policy space_kinds_active_read on platform.space_kinds
  for select to authenticated using (is_active = true and lifecycle_status = 'active');

create policy prop_op_compat_catalog_read on platform.property_operating_model_compatibilities
  for select to authenticated using (true);

create policy prop_space_compat_catalog_read on platform.property_space_kind_compatibilities
  for select to authenticated using (true);

create policy ws_taxonomy_assignments_context_read on platform.workspace_taxonomy_assignments
  for select to authenticated using (tenant_id = app_private.active_tenant_id());

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
  ('third_party_management_portfolio', 1, 'Third-Party Management Portfolio', jsonb_build_object('en','Third-Party Management Portfolio','ro','Portofoliu administrare terță','fa','پورتفولیوی مدیریت قراردادهای ثالث'), 'Property management company portfolio operating third-party real estate assets')
on conflict (code, version) do update
set name = excluded.name, labels_json = excluded.labels_json, description = excluded.description;

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
  ('mixed_authority', 1, 'Mixed Authority Management', jsonb_build_object('en','Mixed Authority Management','ro','Administrare cu autoritate mixtă','fa','مدیریت با ساختار اختیارات ترکیبی'), 'Composite governance combining association rights for residential and contractual mandates for commercial')
on conflict (code, version) do update
set name = excluded.name, labels_json = excluded.labels_json, description = excluded.description;

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
  ('yard', 1, 'Yard', jsonb_build_object('en','Yard','ro','Curte / Platformă exterioară','fa','محوطه باز / حیاط لجستیکی'), 'Outdoor logistics yard, loading yard or storage ground'),
  ('loading_zone', 1, 'Loading Zone', jsonb_build_object('en','Loading Zone','ro','Zonă de încărcare/descărcare','fa','سکوی بارگیری و تخلیه'), 'Dedicated loading dock, freight ramp or delivery bay'),
  ('land_parcel', 1, 'Land Parcel', jsonb_build_object('en','Land Parcel','ro','Parcelă de teren','fa','قطعه زمین'), 'Zoned land parcel or development plot')
on conflict (code, version) do update
set name = excluded.name, labels_json = excluded.labels_json, description = excluded.description;

-- ============================================================================
-- Compatibility Rules Seed
-- ============================================================================

-- Helper block for seeding compatibility matrix
do $$
declare
  p_condo uuid := (select id from platform.property_profiles where code='residential_condominium' and version=1);
  p_complex uuid := (select id from platform.property_profiles where code='residential_complex' and version=1);
  p_villa_gated uuid := (select id from platform.property_profiles where code='gated_villa_community' and version=1);
  p_single_villa uuid := (select id from platform.property_profiles where code='single_villa' and version=1);
  p_small_landlord uuid := (select id from platform.property_profiles where code='small_landlord_portfolio' and version=1);
  p_mixed uuid := (select id from platform.property_profiles where code='mixed_use_estate' and version=1);
  p_retail uuid := (select id from platform.property_profiles where code='retail_centre' and version=1);
  p_office uuid := (select id from platform.property_profiles where code='office_centre' and version=1);
  p_warehouse uuid := (select id from platform.property_profiles where code='warehouse_logistics' and version=1);
  p_township uuid := (select id from platform.property_profiles where code='managed_township' and version=1);
  p_industrial uuid := (select id from platform.property_profiles where code='industrial_park' and version=1);
  p_serviced uuid := (select id from platform.property_profiles where code='serviced_residence' and version=1);
  p_parking uuid := (select id from platform.property_profiles where code='standalone_parking' and version=1);
  p_facility uuid := (select id from platform.property_profiles where code='shared_facility' and version=1);
  p_dev_port uuid := (select id from platform.property_profiles where code='developer_portfolio' and version=1);
  p_pm_port uuid := (select id from platform.property_profiles where code='third_party_management_portfolio' and version=1);

  m_assoc uuid := (select id from platform.operating_models where code='association_managed' and version=1);
  m_owner uuid := (select id from platform.operating_models where code='single_owner_operated' and version=1);
  m_dev uuid := (select id from platform.operating_models where code='developer_operated' and version=1);
  m_tp uuid := (select id from platform.operating_models where code='third_party_managed' and version=1);
  m_lease uuid := (select id from platform.operating_models where code='master_lease' and version=1);
  m_multi uuid := (select id from platform.operating_models where code='multi_owner_contractual' and version=1);
  m_inst uuid := (select id from platform.operating_models where code='institutional_owner' and version=1);
  m_mixed uuid := (select id from platform.operating_models where code='mixed_authority' and version=1);

  s_res uuid := (select id from platform.space_kinds where code='residential_unit' and version=1);
  s_villa uuid := (select id from platform.space_kinds where code='villa' and version=1);
  s_ret uuid := (select id from platform.space_kinds where code='retail_unit' and version=1);
  s_off uuid := (select id from platform.space_kinds where code='office_suite' and version=1);
  s_wh uuid := (select id from platform.space_kinds where code='warehouse_bay' and version=1);
  s_ind_lot uuid := (select id from platform.space_kinds where code='industrial_lot' and version=1);
  s_fact uuid := (select id from platform.space_kinds where code='factory_hall' and version=1);
  s_park uuid := (select id from platform.space_kinds where code='parking_space' and version=1);
  s_store uuid := (select id from platform.space_kinds where code='storage_space' and version=1);
  s_comm uuid := (select id from platform.space_kinds where code='common_area' and version=1);
  s_fac uuid := (select id from platform.space_kinds where code='shared_facility' and version=1);
  s_amen uuid := (select id from platform.space_kinds where code='amenity' and version=1);
  s_srv uuid := (select id from platform.space_kinds where code='service_point' and version=1);
  s_prov uuid := (select id from platform.space_kinds where code='provider_location' and version=1);
  s_tech uuid := (select id from platform.space_kinds where code='technical_room' and version=1);
  s_yard uuid := (select id from platform.space_kinds where code='yard' and version=1);
  s_load uuid := (select id from platform.space_kinds where code='loading_zone' and version=1);
  s_land uuid := (select id from platform.space_kinds where code='land_parcel' and version=1);
begin
  -- Profile <-> Operating Model Compatibilities
  -- 1. Residential Condominium
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_condo, m_assoc, 'compatible', 'Standard statutory condominium association governance'),
    (p_condo, m_tp, 'compatible', 'Third-party property manager contracted by condominium association'),
    (p_condo, m_dev, 'review_required', 'Developer management transition period requires active governance audit'),
    (p_condo, m_owner, 'incompatible', 'Multi-owner condominium cannot be operated under single-owner structure without consolidation'),
    (p_condo, m_lease, 'incompatible', 'Entire condominium co-ownership cannot be master-leased as a single asset'),
    (p_condo, m_multi, 'review_required', 'Multi-owner contractual governance outside association law requires legal review'),
    (p_condo, m_inst, 'review_required', 'Institutional majority ownership requires co-ownership governance alignment'),
    (p_condo, m_mixed, 'review_required', 'Mixed authority condominium requires explicit delegation review');

  -- 2. Residential Complex
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_complex, m_assoc, 'compatible', 'Multi-building residential association governance'),
    (p_complex, m_tp, 'compatible', 'Professional estate management contract'),
    (p_complex, m_dev, 'compatible', 'Developer operated residential estate during sales/handover'),
    (p_complex, m_mixed, 'compatible', 'Complex with mixed master and building-level associations'),
    (p_complex, m_owner, 'review_required', 'Single owner operating multi-building complex requires tenant lease verification'),
    (p_complex, m_multi, 'compatible', 'Multi-building co-ownership contractual framework'),
    (p_complex, m_inst, 'compatible', 'Institutional multi-family residential portfolio'),
    (p_complex, m_lease, 'incompatible', 'Multi-building scattered co-ownership cannot be single master-leased');

  -- 3. Gated Villa Community
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_villa_gated, m_assoc, 'compatible', 'HOA / Villa owners association management'),
    (p_villa_gated, m_tp, 'compatible', 'Contracted third-party estate manager'),
    (p_villa_gated, m_dev, 'compatible', 'Developer maintained villa infrastructure'),
    (p_villa_gated, m_multi, 'compatible', 'Contractual villa community governance');

  -- 4. Single Villa
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_single_villa, m_owner, 'compatible', 'Direct single villa owner operation'),
    (p_single_villa, m_tp, 'compatible', 'Contracted villa management agent'),
    (p_single_villa, m_lease, 'compatible', 'Single villa long-term master lease'),
    (p_single_villa, m_assoc, 'incompatible', 'Standalone single villa has no multi-owner association');

  -- 5. Small Landlord Portfolio
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_small_landlord, m_owner, 'compatible', 'Direct individual landlord management'),
    (p_small_landlord, m_tp, 'compatible', 'Rental property management agency'),
    (p_small_landlord, m_lease, 'compatible', 'Sub-lease portfolio operator');

  -- 6. Mixed-Use Estate
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_mixed, m_mixed, 'compatible', 'Mixed residential-commercial operational authority'),
    (p_mixed, m_tp, 'compatible', 'Integrated property management provider'),
    (p_mixed, m_assoc, 'review_required', 'Association managing commercial podium requires commercial rights audit'),
    (p_mixed, m_dev, 'compatible', 'Developer operated mixed-use community'),
    (p_mixed, m_inst, 'compatible', 'Institutional mixed-use asset operator');

  -- 7. Retail Centre / Mall
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_retail, m_owner, 'compatible', 'Single mall owner operator'),
    (p_retail, m_inst, 'compatible', 'Institutional retail REIT / Asset manager'),
    (p_retail, m_tp, 'compatible', 'Commercial centre management company'),
    (p_retail, m_lease, 'compatible', 'Master leased shopping mall operator'),
    (p_retail, m_assoc, 'incompatible', 'Shopping mall does not operate as residential association');

  -- 8. Office Centre
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_office, m_owner, 'compatible', 'Commercial office building owner operated'),
    (p_office, m_inst, 'compatible', 'Institutional commercial fund operator'),
    (p_office, m_tp, 'compatible', 'Professional facility and property manager'),
    (p_office, m_lease, 'compatible', 'Master tenant / flex office operator'),
    (p_office, m_assoc, 'incompatible', 'Commercial office centre does not operate as residential association');

  -- 9. Warehouse & Logistics
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_warehouse, m_owner, 'compatible', 'Logistics park owner operated'),
    (p_warehouse, m_inst, 'compatible', 'Institutional logistics fund'),
    (p_warehouse, m_tp, 'compatible', 'Third-party logistics park manager'),
    (p_warehouse, m_lease, 'compatible', 'Master lease logistics operator'),
    (p_warehouse, m_assoc, 'incompatible', 'Industrial logistics does not operate as residential association');

  -- 10. Managed Township
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_township, m_dev, 'compatible', 'Master developer township authority'),
    (p_township, m_mixed, 'compatible', 'Composite district authority'),
    (p_township, m_tp, 'compatible', 'Master estate management operator');

  -- 11. Industrial Park
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_industrial, m_owner, 'compatible', 'Industrial park owner operator'),
    (p_industrial, m_inst, 'compatible', 'Institutional industrial estate fund'),
    (p_industrial, m_tp, 'compatible', 'Industrial property manager'),
    (p_industrial, m_dev, 'compatible', 'Industrial developer operated'),
    (p_industrial, m_assoc, 'incompatible', 'Industrial park does not operate as residential association');

  -- 12. Serviced Residence
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_serviced, m_owner, 'compatible', 'Direct hospitality/co-living owner operator'),
    (p_serviced, m_lease, 'compatible', 'Hospitality master lease operator'),
    (p_serviced, m_tp, 'compatible', 'Third-party serviced residence operator'),
    (p_serviced, m_inst, 'compatible', 'Institutional student housing or co-living fund');

  -- 13. Standalone Parking
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_parking, m_owner, 'compatible', 'Parking structure owner operated'),
    (p_parking, m_tp, 'compatible', 'Professional parking operator mandate'),
    (p_parking, m_lease, 'compatible', 'Master leased commercial parking');

  -- 14. Shared Facility
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_facility, m_owner, 'compatible', 'Direct facility owner operator'),
    (p_facility, m_tp, 'compatible', 'Third-party facility management operator'),
    (p_facility, m_mixed, 'compatible', 'Joint facility governance');

  -- 15. Developer Portfolio
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_dev_port, m_dev, 'compatible', 'Developer corporate portfolio oversight'),
    (p_dev_port, m_mixed, 'compatible', 'Mixed developer portfolio management');

  -- 16. Third-Party Management Portfolio
  insert into platform.property_operating_model_compatibilities(property_profile_id, operating_model_id, compatibility_level, reason) values
    (p_pm_port, m_tp, 'compatible', 'Multi-property management contract portfolio');

  -- Profile <-> Space Kind Compatibilities (Representative allowed combinations)
  -- Residential Condominium
  insert into platform.property_space_kind_compatibilities(property_profile_id, space_kind_id, compatibility_level, reason) values
    (p_condo, s_res, 'compatible', 'Primary residential apartment units'),
    (p_condo, s_park, 'compatible', 'Resident parking spaces'),
    (p_condo, s_store, 'compatible', 'Resident storage lockers / box'),
    (p_condo, s_comm, 'compatible', 'Shared corridors, lobbies, roofs'),
    (p_condo, s_tech, 'compatible', 'Building boiler and plant rooms'),
    (p_condo, s_amen, 'compatible', 'Resident amenity spaces'),
    (p_condo, s_wh, 'incompatible', 'Heavy logistics warehouse bays not permitted in residential condominium'),
    (p_condo, s_fact, 'incompatible', 'Factory production halls prohibited in residential condominium');

  -- Retail Centre / Mall
  insert into platform.property_space_kind_compatibilities(property_profile_id, space_kind_id, compatibility_level, reason) values
    (p_retail, s_ret, 'compatible', 'Commercial shops and retail premises'),
    (p_retail, s_comm, 'compatible', 'Mall atriums, corridors, public areas'),
    (p_retail, s_load, 'compatible', 'Freight loading and delivery bays'),
    (p_retail, s_park, 'compatible', 'Customer and staff parking'),
    (p_retail, s_prov, 'compatible', 'Kiosks, ATMs, pop-up locations'),
    (p_retail, s_tech, 'compatible', 'Mall HVAC and transformer rooms'),
    (p_retail, s_res, 'incompatible', 'Standard residential apartments not permitted in standalone retail centre');

  -- Warehouse & Logistics
  insert into platform.property_space_kind_compatibilities(property_profile_id, space_kind_id, compatibility_level, reason) values
    (p_warehouse, s_wh, 'compatible', 'Industrial storage bays'),
    (p_warehouse, s_yard, 'compatible', 'Outdoor storage and maneuvering yards'),
    (p_warehouse, s_load, 'compatible', 'Dock levelers and loading bays'),
    (p_warehouse, s_off, 'compatible', 'Logistics office and dispatch suites'),
    (p_warehouse, s_park, 'compatible', 'Heavy truck and fleet parking'),
    (p_warehouse, s_tech, 'compatible', 'Fire pump stations and substations'),
    (p_warehouse, s_res, 'incompatible', 'Residential living prohibited in logistics park');
end $$;

-- ============================================================================
-- Read-Only Customer APIs & Validation Helpers
-- ============================================================================

-- Validation Helper
create or replace function app_private.validate_taxonomy_compatibility_v1(
  p_property_profile_id uuid,
  p_operating_model_id uuid
)
returns table(
  is_compatible boolean,
  compatibility_level text,
  reason text,
  rule_version integer
)
language sql
stable
security definer
set search_path = pg_catalog, platform
as $$
  select
    coalesce(c.compatibility_level = 'compatible', false) as is_compatible,
    coalesce(c.compatibility_level, 'incompatible') as compatibility_level,
    coalesce(c.reason, 'No explicit compatibility rule found (default-deny)') as reason,
    coalesce(c.rule_version, 0) as rule_version
  from (select 1) _
  left join platform.property_operating_model_compatibilities c
    on c.property_profile_id = p_property_profile_id
   and c.operating_model_id = p_operating_model_id
  order by c.rule_version desc nulls last
  limit 1;
$$;

revoke all on function app_private.validate_taxonomy_compatibility_v1(uuid, uuid) from public;
grant execute on function app_private.validate_taxonomy_compatibility_v1(uuid, uuid) to authenticated, service_role;

-- Customer API: Get Workspace Taxonomy (Active Assignment & Catalog Metadata)
create or replace function customer_api.get_workspace_taxonomy_v1(p_context_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, app_private
as $$
declare
  v_grant record;
  v_workspace record;
  v_assignment record;
  v_profile record;
  v_model record;
  v_allowed_space_kinds jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 1. Validate Context & Membership
  select g.*, m.tenant_id as membership_tenant
  into v_grant
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  -- 2. Resolve Workspace for active tenant
  select w.* into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v_grant.membership_tenant and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if not found then
    return jsonb_build_object(
      'has_assignment', false,
      'status', 'unclassified',
      'workspace_id', null
    );
  end if;

  -- 3. Resolve active taxonomy assignment
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

  -- 4. Profile & Operating Model details
  select * into v_profile from platform.property_profiles where id = v_assignment.property_profile_id;
  select * into v_model from platform.operating_models where id = v_assignment.operating_model_id;

  -- 5. Allowed space kinds for this profile
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
    'assignment_id', v_assignment.id,
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

grant select on platform.property_profiles to authenticated, service_role;
grant select on platform.operating_models to authenticated, service_role;
grant select on platform.space_kinds to authenticated, service_role;
grant select on platform.property_operating_model_compatibilities to authenticated, service_role;
grant select on platform.property_space_kind_compatibilities to authenticated, service_role;
grant select on platform.workspace_taxonomy_assignments to authenticated, service_role;

grant all on all tables in schema platform to service_role;

commit;
