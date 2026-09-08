-- Migration 71: Production Utilities, Meter Readings, Consumption & Billing Integration
-- Scope: Complete Utilities vertical slice with meter lifecycle, readings, OCR candidate human approval boundary,
--        deterministic consumption, anomaly detection, tariffs, cost allocation, and direct billing/GL integration.

begin;

-- =============================================================================
-- 1. Schema Enhancements & Tariffs Table
-- =============================================================================

-- Add lifecycle and metadata fields to utilities.meters
alter table utilities.meters
  add column if not exists lifecycle_status text not null default 'active'
    check (lifecycle_status in ('draft', 'active', 'suspended', 'faulty', 'replaced', 'decommissioned')),
  add column if not exists replaces_meter_id uuid references utilities.meters(id) on delete restrict,
  add column if not exists replaced_by_meter_id uuid references utilities.meters(id) on delete restrict,
  add column if not exists replaced_at timestamptz,
  add column if not exists calibration_expires_on date,
  add column if not exists initial_reading numeric(20,6) not null default 0 check (initial_reading >= 0),
  add column if not exists decimal_precision smallint not null default 2 check (decimal_precision between 0 and 6);

create index if not exists meters_lifecycle_status_idx
  on utilities.meters (tenant_id, lifecycle_status);

create index if not exists meters_replaces_meter_idx
  on utilities.meters (tenant_id, replaces_meter_id);

-- Add OCR candidate and review fields to utilities.meter_readings
alter table utilities.meter_readings
  add column if not exists is_ocr_candidate boolean not null default false,
  add column if not exists ocr_extracted_value numeric(20,6),
  add column if not exists ocr_confidence numeric(6,5) check (ocr_confidence is null or (ocr_confidence >= 0 and ocr_confidence <= 1)),
  add column if not exists review_status text not null default 'approved'
    check (review_status in ('pending_review', 'approved', 'rejected', 'corrected')),
  add column if not exists rejection_reason text,
  add column if not exists correction_notes text,
  add column if not exists idempotency_key text;

create unique index if not exists meter_readings_idempotency_idx
  on utilities.meter_readings (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists meter_readings_review_status_idx
  on utilities.meter_readings (tenant_id, review_status, reading_at desc);

-- Dedicated Tariffs Table
create table if not exists utilities.tariffs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  service_type utilities.service_type not null,
  tariff_code text not null,
  name text not null,
  provider_id uuid references utilities.providers(id) on delete restrict,
  currency char(3) not null default 'RON',
  valid_from date not null,
  valid_to date,
  unit_rate numeric(20,6) not null check (unit_rate >= 0),
  fixed_charge numeric(20,4) not null default 0 check (fixed_charge >= 0),
  tax_rate numeric(9,6) not null default 0 check (tax_rate >= 0 and tax_rate <= 1),
  description text,
  status platform.record_status not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to >= valid_from),
  unique nulls not distinct (tenant_id, property_id, service_type, tariff_code, valid_from)
);

create index if not exists tariffs_lookup_idx
  on utilities.tariffs (tenant_id, property_id, service_type, valid_from, valid_to, status);

alter table utilities.tariffs enable row level security;

create policy tariffs_context_read on utilities.tariffs
  for select to authenticated
  using (tenant_id = app_private.active_tenant_id());

grant select on utilities.tariffs to authenticated;
grant all on utilities.tariffs to service_role;

-- Add Billing & Approval Fields to utilities.consumption_periods
alter table utilities.consumption_periods
  add column if not exists status text not null default 'calculated'
    check (status in ('calculated', 'approved', 'billed', 'cancelled')),
  add column if not exists approved_by uuid references auth.users(id) on delete restrict,
  add column if not exists approved_at timestamptz,
  add column if not exists invoice_id uuid references billing.invoices(id) on delete restrict,
  add column if not exists invoice_line_id uuid references billing.invoice_lines(id) on delete restrict,
  add column if not exists tariff_id uuid references utilities.tariffs(id) on delete restrict,
  add column if not exists tariff_snapshot jsonb,
  add column if not exists charged_subtotal numeric(20,4),
  add column if not exists charged_tax numeric(20,4),
  add column if not exists charged_total numeric(20,4),
  add column if not exists billed_by uuid references auth.users(id) on delete restrict,
  add column if not exists billed_at timestamptz;

create index if not exists consumption_periods_status_idx
  on utilities.consumption_periods (tenant_id, status);

create index if not exists consumption_periods_invoice_idx
  on utilities.consumption_periods (invoice_id)
  where invoice_id is not null;

-- =============================================================================
-- 2. Storage Bucket for Meter Evidence (Photo / OCR Evidence)
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'utility-evidence',
  'utility-evidence',
  false,
  10485760, -- 10MB max
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

create policy utility_evidence_tenant_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'utility-evidence'
    and (storage.foldername(name))[1] = app_private.active_tenant_id()::text
  );

create policy utility_evidence_tenant_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'utility-evidence'
    and (storage.foldername(name))[1] = app_private.active_tenant_id()::text
  );

-- =============================================================================
-- 3. Permissions & Role Mapping
-- =============================================================================

insert into identity.permissions (code, resource, action, description)
values
  ('utilities.manage', 'utilities', 'manage', 'Manage utility meters, configuration, and lifecycles'),
  ('utilities.readings.capture', 'utilities.readings', 'capture', 'Capture meter readings via manual, CSV, or candidate workflow'),
  ('utilities.readings.approve', 'utilities.readings', 'approve', 'Approve or reject captured readings and OCR candidates'),
  ('utilities.tariffs.manage', 'utilities.tariffs', 'manage', 'Manage utility tariffs, rates, and effective date schedules'),
  ('utilities.billing.create', 'utilities.billing', 'create', 'Calculate charges and generate draft/issued bills from consumption')
on conflict (code) do nothing;

-- Association Admin & Property Manager get full utilities permissions
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where p.code in (
  'utilities.manage',
  'utilities.readings.capture',
  'utilities.readings.approve',
  'utilities.tariffs.manage',
  'utilities.billing.create'
)
and lower(r.code) in ('association_admin', 'property_manager')
on conflict (role_id, permission_id) do update set effect = 'allow';

-- President & Censor have read-only by default
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where p.code = 'utilities.metering.read'
and lower(r.code) in ('president', 'censor')
on conflict (role_id, permission_id) do update set effect = 'allow';

-- =============================================================================
-- 4. Meter Lifecycle & Integrity Protections
-- =============================================================================

create or replace function utilities.protect_meter_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, utilities
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from utilities.meter_readings where meter_id = old.id) then
      raise exception 'cannot_delete_meter_with_readings' using errcode = '23503';
    end if;
    if exists (select 1 from utilities.consumption_periods where meter_id = old.id) then
      raise exception 'cannot_delete_meter_with_consumption' using errcode = '23503';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- Prevent changing serial fingerprint if readings exist
    if new.serial_fingerprint <> old.serial_fingerprint and exists (select 1 from utilities.meter_readings where meter_id = old.id) then
      raise exception 'meter_serial_immutable_with_history' using errcode = '42501';
    end if;
    -- Prevent changing tenant or property scope
    if (new.tenant_id, new.property_id) is distinct from (old.tenant_id, old.property_id) then
      raise exception 'meter_tenant_property_immutable' using errcode = '42501';
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists meters_protect_lifecycle on utilities.meters;
create trigger meters_protect_lifecycle
  before update or delete on utilities.meters
  for each row execute function utilities.protect_meter_lifecycle();

-- Update enforce_metering_integrity to allow consumption lifecycle updates (status, approval, billing)
create or replace function utilities.enforce_metering_integrity()
returns trigger language plpgsql security definer
set search_path = pg_catalog, utilities, portfolio
as $$
declare
  m utilities.meters;
  sr utilities.meter_readings;
  er utilities.meter_readings;
  delta numeric(20,6);
begin
  if tg_table_name = 'meters' then
    if tg_op = 'DELETE' then return old; end if;
    if not exists (select 1 from portfolio.properties p where p.id = new.property_id and p.tenant_id = new.tenant_id) then
      raise exception 'meter_property_scope_invalid';
    end if;
    if new.building_id is not null and not exists (select 1 from portfolio.buildings b where b.id = new.building_id and b.tenant_id = new.tenant_id and b.property_id = new.property_id) then
      raise exception 'meter_building_scope_invalid';
    end if;
    if new.unit_id is not null and not exists (select 1 from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.id = new.unit_id and u.tenant_id = new.tenant_id and b.property_id = new.property_id and (new.building_id is null or b.id = new.building_id)) then
      raise exception 'meter_unit_scope_invalid';
    end if;
    if new.parent_meter_id is not null and not exists (select 1 from utilities.meters p where p.id = new.parent_meter_id and p.tenant_id = new.tenant_id and p.property_id = new.property_id and p.service_type = new.service_type) then
      raise exception 'parent_meter_scope_invalid';
    end if;
    return new;
  end if;

  if tg_table_name = 'meter_readings' then
    if tg_op = 'DELETE' then return old; end if;
    select * into m from utilities.meters where id = new.meter_id and tenant_id = new.tenant_id;
    if not found then raise exception 'reading_meter_scope_invalid'; end if;
    if m.installed_on is not null and new.reading_at::date < m.installed_on or m.removed_on is not null and new.reading_at::date > m.removed_on then
      raise exception 'reading_outside_meter_lifecycle';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' then raise exception 'consumption_snapshot_is_immutable'; end if;

  if tg_op = 'UPDATE' then
    -- Core calculation fields must remain immutable
    if (new.tenant_id, new.meter_id, new.start_reading_id, new.end_reading_id, new.period_start, new.period_end, new.raw_consumption, new.adjusted_consumption, new.calculation_snapshot)
       is distinct from
       (old.tenant_id, old.meter_id, old.start_reading_id, old.end_reading_id, old.period_start, old.period_end, old.raw_consumption, old.adjusted_consumption, old.calculation_snapshot) then
      raise exception 'consumption_snapshot_is_immutable';
    end if;
    return new;
  end if;

  select * into m from utilities.meters where id = new.meter_id and tenant_id = new.tenant_id;
  select * into sr from utilities.meter_readings where id = new.start_reading_id and meter_id = new.meter_id and tenant_id = new.tenant_id and status = 'validated';
  select * into er from utilities.meter_readings where id = new.end_reading_id and meter_id = new.meter_id and tenant_id = new.tenant_id and status = 'validated';
  if m.id is null or sr.id is null or er.id is null then raise exception 'consumption_reading_scope_invalid'; end if;
  if sr.reading_at >= er.reading_at or new.period_start <> sr.reading_at or new.period_end <> er.reading_at then
    raise exception 'consumption_period_readings_mismatch';
  end if;

  delta := case when er.reading_value >= sr.reading_value then er.reading_value - sr.reading_value when m.rollover_value is not null then (m.rollover_value - sr.reading_value) + er.reading_value else -1 end;
  if delta < 0 then raise exception 'negative_consumption'; end if;
  new.raw_consumption := delta;
  new.adjusted_consumption := delta * m.multiplier;
  new.calculation_snapshot := jsonb_build_object('start_reading_id', sr.id, 'end_reading_id', er.id, 'start_value', sr.reading_value, 'end_value', er.reading_value, 'multiplier', m.multiplier, 'rollover_value', m.rollover_value, 'formula', 'delta_times_multiplier');
  return new;
end;
$$;

-- =============================================================================
-- 5. Human Approval Boundary for OCR Candidates & Reading Integrity
-- =============================================================================

create or replace function utilities.enforce_ocr_human_boundary()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, utilities
as $$
declare
  v_meter utilities.meters;
begin
  if tg_op = 'INSERT' then
    -- Ensure meter is eligible for readings
    select * into v_meter from utilities.meters where id = new.meter_id and tenant_id = new.tenant_id;
    if not found then
      raise exception 'reading_meter_scope_invalid' using errcode = '42501';
    end if;
    if v_meter.lifecycle_status in ('decommissioned', 'replaced') then
      raise exception 'meter_not_active_for_readings' using errcode = '42501';
    end if;

    -- If created as OCR candidate, MUST be pending_review and CANNOT be validated immediately
    if new.is_ocr_candidate then
      new.review_status := 'pending_review';
      new.status := 'captured';
      new.validated_at := null;
      new.validated_by := null;
    end if;

    return new;
  end if;

  if tg_op = 'UPDATE' then
    -- Human approval boundary: OCR candidate cannot be validated without human actor
    if old.is_ocr_candidate and old.review_status = 'pending_review' and new.status = 'validated' then
      if new.validated_by is null then
        raise exception 'ocr_candidate_requires_human_approval' using errcode = '42501';
      end if;
      if new.review_status <> 'approved' then
        new.review_status := 'approved';
      end if;
    end if;

    -- Rejected reading cannot be validated
    if new.review_status = 'rejected' then
      new.status := 'rejected';
      new.validated_at := null;
      new.validated_by := null;
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists meter_readings_ocr_boundary on utilities.meter_readings;
create trigger meter_readings_ocr_boundary
  before insert or update on utilities.meter_readings
  for each row execute function utilities.enforce_ocr_human_boundary();

-- =============================================================================
-- 6. Domain Business Functions
-- =============================================================================

-- 6.1 Create Meter
create or replace function utilities.create_meter(
  p_context_id uuid,
  p_property_id uuid,
  p_building_id uuid default null,
  p_unit_id uuid default null,
  p_service_type utilities.service_type default 'water',
  p_scope utilities.meter_scope default 'unit',
  p_serial_number text default '',
  p_unit_code text default 'm3',
  p_multiplier numeric default 1,
  p_initial_reading numeric default 0,
  p_installed_on date default current_date,
  p_calibration_expires_on date default null,
  p_parent_meter_id uuid default null,
  p_decimal_precision smallint default 2
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_meter_id uuid;
  v_serial text;
  v_fp text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  v_serial := trim(p_serial_number);
  if length(v_serial) < 2 then raise exception 'invalid_serial_number' using errcode = '22023'; end if;
  v_fp := upper(v_serial);

  if exists (select 1 from utilities.meters where tenant_id = v.tenant_id and serial_fingerprint = v_fp) then
    raise exception 'duplicate_meter_serial' using errcode = '23505';
  end if;

  insert into utilities.meters (
    tenant_id, property_id, building_id, unit_id, service_type, scope,
    serial_number_encrypted, serial_fingerprint, unit_code, multiplier,
    initial_reading, installed_on, calibration_expires_on, parent_meter_id,
    decimal_precision, lifecycle_status
  ) values (
    v.tenant_id, p_property_id, p_building_id, p_unit_id, p_service_type, p_scope,
    v_serial, v_fp, p_unit_code, p_multiplier,
    p_initial_reading, p_installed_on, p_calibration_expires_on, p_parent_meter_id,
    p_decimal_precision, 'active'
  ) returning id into v_meter_id;

  -- Initial reading if > 0
  if p_initial_reading > 0 then
    insert into utilities.meter_readings (
      tenant_id, meter_id, reading_at, reading_value, method, status, validated_at, validated_by, note
    ) values (
      v.tenant_id, v_meter_id, p_installed_on::timestamptz, p_initial_reading, 'manual', 'validated', statement_timestamp(), auth.uid(), 'Initial installation reading'
    );
  end if;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'METER_CREATED', 'meter', v_meter_id,
    'Meter registered in registry',
    jsonb_build_object('serial', v_serial, 'service_type', p_service_type, 'scope', p_scope, 'property_id', p_property_id),
    statement_timestamp()
  );

  return jsonb_build_object('meter_id', v_meter_id, 'serial', v_serial, 'status', 'active');
end;
$$;

-- 6.2 Replace Meter
create or replace function utilities.replace_meter(
  p_context_id uuid,
  p_old_meter_id uuid,
  p_final_reading numeric,
  p_new_serial_number text,
  p_new_initial_reading numeric default 0,
  p_replaced_at date default current_date,
  p_reason text default 'Regular meter replacement'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_old utilities.meters;
  v_new_id uuid;
  v_new_fp text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_old from utilities.meters where id = p_old_meter_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'meter_not_found' using errcode = '42501'; end if;
  if v_old.lifecycle_status in ('decommissioned', 'replaced') then
    raise exception 'meter_already_inactive' using errcode = '42501';
  end if;

  v_new_fp := upper(trim(p_new_serial_number));
  if exists (select 1 from utilities.meters where tenant_id = v.tenant_id and serial_fingerprint = v_new_fp) then
    raise exception 'duplicate_meter_serial' using errcode = '23505';
  end if;

  -- 1. Capture final reading on old meter if given
  if p_final_reading is not null then
    insert into utilities.meter_readings (
      tenant_id, meter_id, reading_at, reading_value, method, status, validated_at, validated_by, note
    ) values (
      v.tenant_id, v_old.id, p_replaced_at::timestamptz, p_final_reading, 'manual', 'validated', statement_timestamp(), auth.uid(), 'Handover final reading before replacement'
    ) on conflict (meter_id, reading_at) do update set reading_value = p_final_reading, status = 'validated';
  end if;

  -- 2. Create new meter
  insert into utilities.meters (
    tenant_id, property_id, building_id, unit_id, service_type, scope,
    serial_number_encrypted, serial_fingerprint, unit_code, multiplier,
    initial_reading, installed_on, parent_meter_id, decimal_precision,
    lifecycle_status, replaces_meter_id
  ) values (
    v.tenant_id, v_old.property_id, v_old.building_id, v_old.unit_id, v_old.service_type, v_old.scope,
    trim(p_new_serial_number), v_new_fp, v_old.unit_code, v_old.multiplier,
    p_new_initial_reading, p_replaced_at, v_old.parent_meter_id, v_old.decimal_precision,
    'active', v_old.id
  ) returning id into v_new_id;

  -- 3. Capture initial reading on new meter
  insert into utilities.meter_readings (
    tenant_id, meter_id, reading_at, reading_value, method, status, validated_at, validated_by, note
  ) values (
    v.tenant_id, v_new_id, p_replaced_at::timestamptz, p_new_initial_reading, 'manual', 'validated', statement_timestamp(), auth.uid(), 'Installation initial reading'
  );

  -- 4. Mark old meter as replaced
  update utilities.meters set
    lifecycle_status = 'replaced',
    replaced_by_meter_id = v_new_id,
    replaced_at = p_replaced_at::timestamptz,
    removed_on = p_replaced_at,
    updated_at = statement_timestamp()
  where id = v_old.id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_snapshot, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'METER_REPLACED', 'meter', v_old.id, p_reason,
    jsonb_build_object('old_meter_id', v_old.id, 'final_reading', p_final_reading),
    jsonb_build_object('new_meter_id', v_new_id, 'initial_reading', p_new_initial_reading, 'replaced_at', p_replaced_at),
    statement_timestamp()
  );

  return jsonb_build_object(
    'old_meter_id', v_old.id,
    'new_meter_id', v_new_id,
    'final_reading', p_final_reading,
    'new_initial_reading', p_new_initial_reading,
    'status', 'replaced'
  );
end;
$$;

-- 6.3 Decommission Meter
create or replace function utilities.decommission_meter(
  p_context_id uuid,
  p_meter_id uuid,
  p_final_reading numeric default null,
  p_decommissioned_on date default current_date,
  p_reason text default 'Meter decommissioned'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_meter utilities.meters;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_meter from utilities.meters where id = p_meter_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'meter_not_found' using errcode = '42501'; end if;

  if p_final_reading is not null then
    insert into utilities.meter_readings (
      tenant_id, meter_id, reading_at, reading_value, method, status, validated_at, validated_by, note
    ) values (
      v.tenant_id, v_meter.id, p_decommissioned_on::timestamptz, p_final_reading, 'manual', 'validated', statement_timestamp(), auth.uid(), 'Decommissioning final reading'
    ) on conflict (meter_id, reading_at) do update set reading_value = p_final_reading, status = 'validated';
  end if;

  update utilities.meters set
    lifecycle_status = 'decommissioned',
    removed_on = p_decommissioned_on,
    updated_at = statement_timestamp()
  where id = v_meter.id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'METER_DECOMMISSIONED', 'meter', v_meter.id, p_reason,
    jsonb_build_object('meter_id', v_meter.id, 'final_reading', p_final_reading, 'decommissioned_on', p_decommissioned_on),
    statement_timestamp()
  );

  return jsonb_build_object('meter_id', v_meter.id, 'status', 'decommissioned');
end;
$$;

-- 6.4 Capture Reading (Manual or Bulk)
create or replace function utilities.capture_reading(
  p_context_id uuid,
  p_meter_id uuid,
  p_reading_value numeric,
  p_reading_at timestamptz default statement_timestamp(),
  p_method utilities.reading_method default 'manual',
  p_source_object_path text default null,
  p_note text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_meter utilities.meters;
  v_reading_id uuid;
  v_prev utilities.meter_readings;
  v_existing utilities.meter_readings;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(v.role_code) not in ('association_admin', 'property_manager', 'owner', 'tenant_resident') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if p_idempotency_key is not null then
    select * into v_existing from utilities.meter_readings
    where tenant_id = v.tenant_id and idempotency_key = p_idempotency_key;
    if found then
      return jsonb_build_object(
        'reading_id', v_existing.id,
        'reading_value', v_existing.reading_value,
        'status', v_existing.status,
        'idempotent_replay', true
      );
    end if;
  end if;

  select * into v_meter from utilities.meters where id = p_meter_id and tenant_id = v.tenant_id;
  if not found then raise exception 'meter_not_found' using errcode = '42501'; end if;
  if v_meter.lifecycle_status in ('decommissioned', 'replaced') then
    raise exception 'meter_not_active_for_readings' using errcode = '42501';
  end if;

  -- Verify scope for resident roles
  if lower(v.role_code) in ('owner', 'tenant_resident') then
    if v.unit_id is null or v_meter.unit_id <> v.unit_id then
      raise exception 'resident_meter_access_denied' using errcode = '42501';
    end if;
  end if;

  if p_reading_value < 0 then
    raise exception 'negative_reading_value_prohibited' using errcode = '22023';
  end if;

  -- Check previous reading ordering
  select * into v_prev from utilities.meter_readings
  where meter_id = v_meter.id and tenant_id = v.tenant_id and status in ('validated', 'captured')
  order by reading_at desc limit 1;

  if v_prev.id is not null and p_reading_at < v_prev.reading_at then
    raise exception 'out_of_order_reading' using errcode = '22023';
  end if;

  -- If management role enters, validate immediately; if resident self-submits, mark captured pending review
  insert into utilities.meter_readings (
    tenant_id, meter_id, reading_at, reading_value, method,
    status, review_status, source_object_path, note, idempotency_key,
    entered_by, validated_by, validated_at
  ) values (
    v.tenant_id, v_meter.id, p_reading_at, p_reading_value, p_method,
    case when lower(v.role_code) in ('association_admin', 'property_manager') then 'validated'::utilities.reading_status else 'captured'::utilities.reading_status end,
    case when lower(v.role_code) in ('association_admin', 'property_manager') then 'approved' else 'pending_review' end,
    p_source_object_path, p_note, p_idempotency_key,
    auth.uid(),
    case when lower(v.role_code) in ('association_admin', 'property_manager') then auth.uid() else null end,
    case when lower(v.role_code) in ('association_admin', 'property_manager') then statement_timestamp() else null end
  ) returning id into v_reading_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'READING_CAPTURED', 'meter_reading', v_reading_id,
    'Meter reading captured',
    jsonb_build_object('meter_id', v_meter.id, 'reading_value', p_reading_value, 'reading_at', p_reading_at, 'method', p_method),
    statement_timestamp()
  );

  return jsonb_build_object(
    'reading_id', v_reading_id,
    'meter_id', v_meter.id,
    'reading_value', p_reading_value,
    'reading_at', p_reading_at,
    'status', case when lower(v.role_code) in ('association_admin', 'property_manager') then 'validated' else 'captured' end
  );
end;
$$;

-- 6.5 Create OCR Candidate (Human Boundary Protected)
create or replace function utilities.create_ocr_candidate(
  p_context_id uuid,
  p_meter_id uuid,
  p_reading_value numeric,
  p_reading_at timestamptz default statement_timestamp(),
  p_confidence numeric default 0.85,
  p_photo_object_path text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_meter utilities.meters;
  v_reading_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_meter from utilities.meters where id = p_meter_id and tenant_id = v.tenant_id;
  if not found then raise exception 'meter_not_found' using errcode = '42501'; end if;

  -- Insert strictly as unvalidated candidate requiring human approval
  insert into utilities.meter_readings (
    tenant_id, meter_id, reading_at, reading_value, method,
    status, review_status, is_ocr_candidate, ocr_extracted_value, ocr_confidence,
    source_object_path, idempotency_key, entered_by
  ) values (
    v.tenant_id, v_meter.id, p_reading_at, p_reading_value, 'photo_ocr',
    'captured', 'pending_review', true, p_reading_value, p_confidence,
    p_photo_object_path, p_idempotency_key, auth.uid()
  ) returning id into v_reading_id;

  -- Create anomaly flag if confidence < 0.80
  if p_confidence < 0.80 then
    insert into utilities.utility_anomalies (
      tenant_id, meter_id, type, severity, title, details_json
    ) values (
      v.tenant_id, v_meter.id, 'ocr_low_confidence', 'warning',
      'Low Confidence OCR Candidate Requires Verification',
      jsonb_build_object('reading_id', v_reading_id, 'confidence', p_confidence, 'extracted_value', p_reading_value)
    );
  end if;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'READING_OCR_CANDIDATE_CREATED', 'meter_reading', v_reading_id,
    'OCR reading candidate created pending human review',
    jsonb_build_object('meter_id', v_meter.id, 'extracted_value', p_reading_value, 'confidence', p_confidence),
    statement_timestamp()
  );

  return jsonb_build_object(
    'reading_id', v_reading_id,
    'is_ocr_candidate', true,
    'review_status', 'pending_review',
    'confidence', p_confidence,
    'requires_human_approval', true
  );
end;
$$;

-- 6.6 Approve Reading (Human Operator Decision)
create or replace function utilities.approve_reading(
  p_context_id uuid,
  p_reading_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_reading utilities.meter_readings;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_reading from utilities.meter_readings where id = p_reading_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'reading_not_found' using errcode = '42501'; end if;

  update utilities.meter_readings set
    status = 'validated',
    review_status = 'approved',
    validated_by = auth.uid(),
    validated_at = statement_timestamp(),
    note = coalesce(p_notes, note)
  where id = v_reading.id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_snapshot, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'READING_APPROVED', 'meter_reading', v_reading.id,
    coalesce(p_notes, 'Human approval of meter reading'),
    jsonb_build_object('status', v_reading.status, 'review_status', v_reading.review_status),
    jsonb_build_object('status', 'validated', 'review_status', 'approved', 'validated_by', auth.uid()),
    statement_timestamp()
  );

  return jsonb_build_object('reading_id', v_reading.id, 'status', 'validated', 'review_status', 'approved');
end;
$$;

-- 6.7 Reject Reading
create or replace function utilities.reject_reading(
  p_context_id uuid,
  p_reading_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_reading utilities.meter_readings;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  if trim(p_reason) = '' or p_reason is null then
    raise exception 'rejection_reason_required' using errcode = '22023';
  end if;

  select * into v_reading from utilities.meter_readings where id = p_reading_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'reading_not_found' using errcode = '42501'; end if;

  update utilities.meter_readings set
    status = 'rejected',
    review_status = 'rejected',
    rejection_reason = p_reason
  where id = v_reading.id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_snapshot, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'READING_REJECTED', 'meter_reading', v_reading.id, p_reason,
    jsonb_build_object('status', v_reading.status, 'review_status', v_reading.review_status),
    jsonb_build_object('status', 'rejected', 'review_status', 'rejected', 'rejection_reason', p_reason),
    statement_timestamp()
  );

  return jsonb_build_object('reading_id', v_reading.id, 'status', 'rejected', 'review_status', 'rejected');
end;
$$;

-- 6.8 Correct Reading (Correction Workflow Preserving Audit Trace)
create or replace function utilities.correct_reading(
  p_context_id uuid,
  p_reading_id uuid,
  p_corrected_value numeric,
  p_correction_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_old utilities.meter_readings;
  v_new_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_old from utilities.meter_readings where id = p_reading_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'reading_not_found' using errcode = '42501'; end if;

  -- Mark old reading as superseded
  update utilities.meter_readings set
    status = 'superseded',
    review_status = 'corrected',
    correction_notes = p_correction_reason
  where id = v_old.id;

  -- Create new validated reading linking to old
  insert into utilities.meter_readings (
    tenant_id, meter_id, reading_at, reading_value, method,
    status, review_status, supersedes_reading_id, note, correction_notes,
    entered_by, validated_by, validated_at
  ) values (
    v.tenant_id, v_old.meter_id, v_old.reading_at, p_corrected_value, v_old.method,
    'validated', 'approved', v_old.id, 'Corrected from previous reading', p_correction_reason,
    auth.uid(), auth.uid(), statement_timestamp()
  ) returning id into v_new_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_snapshot, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'READING_CORRECTED', 'meter_reading', v_new_id, p_correction_reason,
    jsonb_build_object('superseded_reading_id', v_old.id, 'old_value', v_old.reading_value),
    jsonb_build_object('new_reading_id', v_new_id, 'corrected_value', p_corrected_value),
    statement_timestamp()
  );

  return jsonb_build_object('old_reading_id', v_old.id, 'new_reading_id', v_new_id, 'corrected_value', p_corrected_value);
end;
$$;

-- 6.9 Calculate Consumption & Detect Anomalies
create or replace function utilities.calculate_consumption(
  p_context_id uuid,
  p_meter_id uuid,
  p_start_reading_id uuid,
  p_end_reading_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_meter utilities.meters;
  v_start utilities.meter_readings;
  v_end utilities.meter_readings;
  v_raw numeric(20,6);
  v_adj numeric(20,6);
  v_id uuid;
  v_prev_adj numeric(20,6);
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_meter from utilities.meters where id = p_meter_id and tenant_id = v.tenant_id;
  if not found then raise exception 'meter_not_found' using errcode = '42501'; end if;

  select * into v_start from utilities.meter_readings where id = p_start_reading_id and meter_id = v_meter.id and status = 'validated';
  select * into v_end from utilities.meter_readings where id = p_end_reading_id and meter_id = v_meter.id and status = 'validated';

  if v_start.id is null or v_end.id is null then
    raise exception 'both_readings_must_be_validated' using errcode = '42501';
  end if;

  if v_start.reading_at >= v_end.reading_at then
    raise exception 'start_reading_must_precede_end' using errcode = '22023';
  end if;

  if v_end.reading_value < v_start.reading_value then
    if v_meter.rollover_value is not null and v_meter.rollover_value > v_start.reading_value then
      v_raw := (v_meter.rollover_value - v_start.reading_value) + v_end.reading_value;
    else
      raise exception 'negative_consumption_detected' using errcode = '22023';
    end if;
  else
    v_raw := v_end.reading_value - v_start.reading_value;
  end if;

  v_adj := round(v_raw * v_meter.multiplier, v_meter.decimal_precision);

  -- Insert or return existing consumption period
  insert into utilities.consumption_periods (
    tenant_id, meter_id, start_reading_id, end_reading_id,
    period_start, period_end, raw_consumption, adjusted_consumption,
    status, calculation_snapshot
  ) values (
    v.tenant_id, v_meter.id, v_start.id, v_end.id,
    v_start.reading_at, v_end.reading_at, v_raw, v_adj,
    'calculated',
    jsonb_build_object(
      'start_reading', v_start.reading_value,
      'end_reading', v_end.reading_value,
      'multiplier', v_meter.multiplier,
      'unit_code', v_meter.unit_code,
      'formula', 'raw_delta_times_multiplier'
    )
  )
  on conflict (meter_id, start_reading_id, end_reading_id)
  do update set adjusted_consumption = v_adj
  returning id into v_id;

  -- Anomaly Detection: check if > 2x previous period consumption
  select adjusted_consumption into v_prev_adj
  from utilities.consumption_periods
  where meter_id = v_meter.id and period_end <= v_start.reading_at
  order by period_end desc limit 1;

  if v_prev_adj is not null and v_prev_adj > 0 and v_adj > (v_prev_adj * 2.5) then
    insert into utilities.utility_anomalies (
      tenant_id, meter_id, type, severity, title, details_json
    ) values (
      v.tenant_id, v_meter.id, 'quantity_variance', 'warning',
      'Abnormal consumption spike detected (> 250% of previous period)',
      jsonb_build_object('current_consumption', v_adj, 'previous_consumption', v_prev_adj, 'meter_id', v_meter.id)
    );
  end if;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'CONSUMPTION_CALCULATED', 'consumption_period', v_id,
    'Consumption calculated deterministically',
    jsonb_build_object('raw_consumption', v_raw, 'adjusted_consumption', v_adj, 'multiplier', v_meter.multiplier),
    statement_timestamp()
  );

  return jsonb_build_object(
    'consumption_id', v_id,
    'meter_id', v_meter.id,
    'raw_consumption', v_raw,
    'adjusted_consumption', v_adj,
    'period_start', v_start.reading_at,
    'period_end', v_end.reading_at,
    'status', 'calculated'
  );
end;
$$;

-- 6.10 Approve Consumption
create or replace function utilities.approve_consumption(
  p_context_id uuid,
  p_consumption_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_cp utilities.consumption_periods;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_cp from utilities.consumption_periods where id = p_consumption_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'consumption_period_not_found' using errcode = '42501'; end if;

  update utilities.consumption_periods set
    status = 'approved',
    approved_by = auth.uid(),
    approved_at = statement_timestamp()
  where id = v_cp.id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'CONSUMPTION_APPROVED', 'consumption_period', v_cp.id,
    'Consumption approved for utility billing',
    jsonb_build_object('status', 'approved', 'approved_by', auth.uid()),
    statement_timestamp()
  );

  return jsonb_build_object('consumption_id', v_cp.id, 'status', 'approved');
end;
$$;

-- 6.11 Create Tariff
create or replace function utilities.create_tariff(
  p_context_id uuid,
  p_property_id uuid,
  p_service_type utilities.service_type,
  p_tariff_code text,
  p_name text,
  p_unit_rate numeric,
  p_fixed_charge numeric default 0,
  p_tax_rate numeric default 0.19,
  p_currency text default 'RON',
  p_valid_from date default current_date,
  p_valid_to date default null,
  p_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_tariff_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  insert into utilities.tariffs (
    tenant_id, property_id, service_type, tariff_code, name,
    unit_rate, fixed_charge, tax_rate, currency, valid_from, valid_to, description
  ) values (
    v.tenant_id, p_property_id, p_service_type, upper(trim(p_tariff_code)), p_name,
    p_unit_rate, p_fixed_charge, p_tax_rate, upper(trim(p_currency)), p_valid_from, p_valid_to, p_description
  ) returning id into v_tariff_id;

  return jsonb_build_object('tariff_id', v_tariff_id, 'tariff_code', p_tariff_code, 'unit_rate', p_unit_rate);
end;
$$;

-- 6.12 Bill Consumption (Direct integration with Billing & Accounting contracts)
create or replace function utilities.bill_consumption(
  p_context_id uuid,
  p_consumption_id uuid,
  p_tariff_id uuid default null,
  p_due_on date default (current_date + interval '15 days')::date,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, billing, finance, identity, platform, portfolio, occupancy, audit
as $$
declare
  v record;
  v_cp utilities.consumption_periods;
  v_meter utilities.meters;
  v_tariff utilities.tariffs;
  v_liable_party_id uuid;
  v_subtotal numeric(20,4);
  v_tax numeric(20,4);
  v_total numeric(20,4);
  v_lines jsonb;
  v_draft_res jsonb;
  v_invoice_id uuid;
  v_issue_res jsonb;
  v_idemp text;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_cp from utilities.consumption_periods where id = p_consumption_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'consumption_period_not_found' using errcode = '42501'; end if;

  if v_cp.status = 'billed' or v_cp.invoice_id is not null then
    raise exception 'consumption_already_billed' using errcode = '42501';
  end if;

  select * into v_meter from utilities.meters where id = v_cp.meter_id and tenant_id = v.tenant_id;

  -- Closed-Period Protection: Verify period is open
  perform finance.assert_scope_date_not_in_closed_period(v.tenant_id, v_meter.property_id, v_cp.period_end::date);

  -- Select active tariff
  if p_tariff_id is not null then
    select * into v_tariff from utilities.tariffs where id = p_tariff_id and tenant_id = v.tenant_id;
  else
    select * into v_tariff from utilities.tariffs
    where tenant_id = v.tenant_id and (property_id is null or property_id = v_meter.property_id)
      and service_type = v_meter.service_type and valid_from <= v_cp.period_end::date
      and (valid_to is null or valid_to >= v_cp.period_end::date) and status = 'active'
    order by (case when property_id = v_meter.property_id then 0 else 1 end), valid_from desc limit 1;
  end if;

  if v_tariff.id is null then
    raise exception 'no_valid_tariff_found_for_utility' using errcode = '42501';
  end if;

  -- Calculate charges
  v_subtotal := round((v_cp.adjusted_consumption * v_tariff.unit_rate) + v_tariff.fixed_charge, 4);
  v_tax := round(v_subtotal * v_tariff.tax_rate, 4);
  v_total := v_subtotal + v_tax;

  -- Determine liable party: Owner of unit, or default property management party
  if v_meter.unit_id is not null then
    select party_id into v_liable_party_id from portfolio.ownerships
    where tenant_id = v.tenant_id and unit_id = v_meter.unit_id
    order by valid_from desc limit 1;
  end if;

  if v_liable_party_id is null then
    select id into v_liable_party_id from portfolio.parties where tenant_id = v.tenant_id limit 1;
  end if;

  v_idemp := coalesce(p_idempotency_key, 'UTIL-BILL-' || v_cp.id::text);

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'description', 'Utility consumption: ' || v_meter.service_type::text || ' (' || v_cp.adjusted_consumption || ' ' || v_meter.unit_code || ')',
      'quantity', v_cp.adjusted_consumption,
      'unit_price', v_tariff.unit_rate,
      'tax_rate', v_tariff.tax_rate
    )
  );

  -- 1. Create Draft Bill using authoritative Billing contract
  v_draft_res := billing.create_bill(
    p_context_id => p_context_id,
    p_property_id => v_meter.property_id,
    p_unit_id => v_meter.unit_id,
    p_liable_party_id => v_liable_party_id,
    p_period_start => v_cp.period_start::date,
    p_period_end => v_cp.period_end::date,
    p_due_on => p_due_on,
    p_currency => v_tariff.currency,
    p_lines => v_lines,
    p_idempotency_key => v_idemp
  );

  v_invoice_id := (v_draft_res->>'id')::uuid;

  -- 2. Issue Bill using authoritative Billing contract
  v_issue_res := billing.issue_bill(
    p_context_id => p_context_id,
    p_invoice_id => v_invoice_id
  );

  -- 3. Link consumption period to invoice
  update utilities.consumption_periods set
    status = 'billed',
    invoice_id = v_invoice_id,
    tariff_id = v_tariff.id,
    tariff_snapshot = jsonb_build_object(
      'tariff_id', v_tariff.id,
      'tariff_code', v_tariff.tariff_code,
      'unit_rate', v_tariff.unit_rate,
      'fixed_charge', v_tariff.fixed_charge,
      'tax_rate', v_tariff.tax_rate
    ),
    charged_subtotal = v_subtotal,
    charged_tax = v_tax,
    charged_total = v_total,
    billed_by = auth.uid(),
    billed_at = statement_timestamp()
  where id = v_cp.id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'UTILITY_CHARGE_BILLED', 'consumption_period', v_cp.id,
    'Utility consumption converted to issued bill with GL journal',
    jsonb_build_object('invoice_id', v_invoice_id, 'charged_total', v_total, 'tariff_id', v_tariff.id),
    statement_timestamp()
  );

  return jsonb_build_object(
    'consumption_id', v_cp.id,
    'invoice_id', v_invoice_id,
    'invoice_no', v_issue_res->>'invoice_no',
    'status', 'billed',
    'charged_subtotal', v_subtotal,
    'charged_tax', v_tax,
    'charged_total', v_total,
    'currency', v_tariff.currency
  );
end;
$$;

-- 6.13 Main vs Submeter Variance Diagnostic Routine
create or replace function utilities.get_meter_variance(
  p_context_id uuid,
  p_building_id uuid,
  p_service_type utilities.service_type default 'water',
  p_from date default (current_date - interval '30 days')::date,
  p_to date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio
as $$
declare
  v record;
  v_main_meter_id uuid;
  v_main_consumption numeric(20,4) := 0;
  v_submeters_consumption numeric(20,4) := 0;
  v_variance numeric(20,4) := 0;
  v_variance_pct numeric(12,4) := 0;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;

  -- 1. Main meter of the building
  select id into v_main_meter_id
  from utilities.meters
  where tenant_id = v.tenant_id and building_id = p_building_id and service_type = p_service_type
    and scope = 'building' and lifecycle_status = 'active' limit 1;

  if v_main_meter_id is not null then
    select coalesce(sum(adjusted_consumption), 0) into v_main_consumption
    from utilities.consumption_periods
    where meter_id = v_main_meter_id and period_start::date >= p_from and period_end::date <= p_to;
  end if;

  -- 2. Sum of unit submeters
  select coalesce(sum(cp.adjusted_consumption), 0) into v_submeters_consumption
  from utilities.consumption_periods cp
  join utilities.meters m on m.id = cp.meter_id
  where m.tenant_id = v.tenant_id and m.building_id = p_building_id and m.service_type = p_service_type
    and m.scope in ('unit', 'submeter') and cp.period_start::date >= p_from and cp.period_end::date <= p_to;

  v_variance := v_main_consumption - v_submeters_consumption;
  if v_main_consumption > 0 then
    v_variance_pct := round((v_variance / v_main_consumption) * 100, 2);
  else
    v_variance_pct := 0;
  end if;

  return jsonb_build_object(
    'building_id', p_building_id,
    'service_type', p_service_type,
    'from', p_from,
    'to', p_to,
    'main_meter_id', v_main_meter_id,
    'main_consumption', v_main_consumption,
    'submeters_consumption', v_submeters_consumption,
    'variance', v_variance,
    'variance_pct', v_variance_pct,
    'unallocated_common_consumption', greatest(v_variance, 0)
  );
end;
$$;

-- =============================================================================
-- 7. Customer API Gateway Wrappers (Versioned, SECURITY INVOKER, search_path = pg_catalog)
-- =============================================================================

create or replace function customer_api.create_meter_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_building_id uuid default null,
  p_unit_id uuid default null,
  p_service_type text default 'water',
  p_scope text default 'unit',
  p_serial_number text default '',
  p_unit_code text default 'm3',
  p_multiplier numeric default 1,
  p_initial_reading numeric default 0,
  p_installed_on date default current_date,
  p_calibration_expires_on date default null,
  p_parent_meter_id uuid default null,
  p_decimal_precision smallint default 2
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.create_meter(
    p_context_id, p_property_id, p_building_id, p_unit_id,
    p_service_type::utilities.service_type, p_scope::utilities.meter_scope,
    p_serial_number, p_unit_code, p_multiplier, p_initial_reading,
    p_installed_on, p_calibration_expires_on, p_parent_meter_id, p_decimal_precision
  );
end;
$$;

create or replace function customer_api.replace_meter_v1(
  p_context_id uuid,
  p_old_meter_id uuid,
  p_final_reading numeric,
  p_new_serial_number text,
  p_new_initial_reading numeric default 0,
  p_replaced_at date default current_date,
  p_reason text default 'Regular meter replacement'
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.replace_meter(
    p_context_id, p_old_meter_id, p_final_reading, p_new_serial_number,
    p_new_initial_reading, p_replaced_at, p_reason
  );
end;
$$;

create or replace function customer_api.decommission_meter_v1(
  p_context_id uuid,
  p_meter_id uuid,
  p_final_reading numeric default null,
  p_decommissioned_on date default current_date,
  p_reason text default 'Meter decommissioned'
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.decommission_meter(
    p_context_id, p_meter_id, p_final_reading, p_decommissioned_on, p_reason
  );
end;
$$;

create or replace function customer_api.capture_reading_v1(
  p_context_id uuid,
  p_meter_id uuid,
  p_reading_value numeric,
  p_reading_at timestamptz default statement_timestamp(),
  p_method text default 'manual',
  p_source_object_path text default null,
  p_note text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.capture_reading(
    p_context_id, p_meter_id, p_reading_value, p_reading_at,
    p_method::utilities.reading_method, p_source_object_path, p_note, p_idempotency_key
  );
end;
$$;

create or replace function customer_api.create_ocr_candidate_v1(
  p_context_id uuid,
  p_meter_id uuid,
  p_reading_value numeric,
  p_reading_at timestamptz default statement_timestamp(),
  p_confidence numeric default 0.85,
  p_photo_object_path text default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.create_ocr_candidate(
    p_context_id, p_meter_id, p_reading_value, p_reading_at,
    p_confidence, p_photo_object_path, p_idempotency_key
  );
end;
$$;

create or replace function customer_api.approve_reading_v1(
  p_context_id uuid,
  p_reading_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.approve_reading(p_context_id, p_reading_id, p_notes);
end;
$$;

create or replace function customer_api.reject_reading_v1(
  p_context_id uuid,
  p_reading_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.reject_reading(p_context_id, p_reading_id, p_reason);
end;
$$;

create or replace function customer_api.correct_reading_v1(
  p_context_id uuid,
  p_reading_id uuid,
  p_corrected_value numeric,
  p_correction_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.correct_reading(p_context_id, p_reading_id, p_corrected_value, p_correction_reason);
end;
$$;

create or replace function customer_api.calculate_consumption_v1(
  p_context_id uuid,
  p_meter_id uuid,
  p_start_reading_id uuid,
  p_end_reading_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.calculate_consumption(p_context_id, p_meter_id, p_start_reading_id, p_end_reading_id);
end;
$$;

create or replace function customer_api.approve_consumption_v1(
  p_context_id uuid,
  p_consumption_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.approve_consumption(p_context_id, p_consumption_id);
end;
$$;

create or replace function customer_api.create_tariff_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_service_type text,
  p_tariff_code text,
  p_name text,
  p_unit_rate numeric,
  p_fixed_charge numeric default 0,
  p_tax_rate numeric default 0.19,
  p_currency text default 'RON',
  p_valid_from date default current_date,
  p_valid_to date default null,
  p_description text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.create_tariff(
    p_context_id, p_property_id, p_service_type::utilities.service_type, p_tariff_code,
    p_name, p_unit_rate, p_fixed_charge, p_tax_rate, p_currency, p_valid_from, p_valid_to, p_description
  );
end;
$$;

create or replace function customer_api.bill_consumption_v1(
  p_context_id uuid,
  p_consumption_id uuid,
  p_tariff_id uuid default null,
  p_due_on date default (current_date + interval '15 days')::date,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.bill_consumption(
    p_context_id, p_consumption_id, p_tariff_id, p_due_on, p_idempotency_key
  );
end;
$$;

create or replace function customer_api.get_meter_variance_v1(
  p_context_id uuid,
  p_building_id uuid,
  p_service_type text default 'water',
  p_from date default (current_date - interval '30 days')::date,
  p_to date default current_date
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.get_meter_variance(
    p_context_id, p_building_id, p_service_type::utilities.service_type, p_from, p_to
  );
end;
$$;

create or replace function utilities.update_meter(
  p_context_id uuid,
  p_meter_id uuid,
  p_calibration_expires_on date default null,
  p_multiplier numeric default null,
  p_unit_code text default null,
  p_decimal_precision smallint default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_meter utilities.meters;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_meter from utilities.meters where id = p_meter_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'meter_not_found' using errcode = '42501'; end if;

  update utilities.meters set
    calibration_expires_on = coalesce(p_calibration_expires_on, calibration_expires_on),
    multiplier = coalesce(p_multiplier, multiplier),
    unit_code = coalesce(p_unit_code, unit_code),
    decimal_precision = coalesce(p_decimal_precision, decimal_precision),
    updated_at = statement_timestamp()
  where id = v_meter.id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, before_snapshot, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'METER_UPDATED', 'meter', v_meter.id,
    'Meter configuration updated',
    jsonb_build_object('multiplier', v_meter.multiplier, 'unit_code', v_meter.unit_code),
    jsonb_build_object('multiplier', coalesce(p_multiplier, v_meter.multiplier), 'unit_code', coalesce(p_unit_code, v_meter.unit_code)),
    statement_timestamp()
  );

  return jsonb_build_object('meter_id', v_meter.id, 'status', 'updated');
end;
$$;

create or replace function utilities.import_readings(
  p_context_id uuid,
  p_meter_id uuid,
  p_readings jsonb
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_meter utilities.meters;
  v_item jsonb;
  v_count integer := 0;
  v_val numeric;
  v_at timestamptz;
  v_note text;
  v_idemp text;
  v_reading_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  select * into v_meter from utilities.meters where id = p_meter_id and tenant_id = v.tenant_id;
  if not found then raise exception 'meter_not_found' using errcode = '42501'; end if;

  for v_item in select * from jsonb_array_elements(p_readings) loop
    v_val := (v_item->>'reading_value')::numeric;
    v_at := coalesce((v_item->>'reading_at')::timestamptz, statement_timestamp());
    v_note := v_item->>'note';
    v_idemp := v_item->>'idempotency_key';

    if v_val >= 0 then
      insert into utilities.meter_readings (
        tenant_id, meter_id, reading_at, reading_value, method,
        status, review_status, note, idempotency_key, entered_by, validated_by, validated_at
      ) values (
        v.tenant_id, v_meter.id, v_at, v_val, 'bulk_import',
        'validated', 'approved', coalesce(v_note, 'Bulk CSV import'), v_idemp,
        auth.uid(), auth.uid(), statement_timestamp()
      )
      on conflict (meter_id, reading_at) do update set reading_value = v_val
      returning id into v_reading_id;

      v_count := v_count + 1;
    end if;
  end loop;

  return jsonb_build_object('imported_count', v_count, 'meter_id', v_meter.id);
end;
$$;

create or replace function utilities.get_utilities_summary(
  p_context_id uuid
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, utilities, identity, platform, portfolio
as $$
declare
  v record;
  v_resident boolean;
  v_summary jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  v_resident := lower(v.role_code) in ('owner', 'tenant_resident');

  select jsonb_build_object(
    'total_meters', (select count(*) from utilities.meters m where m.tenant_id = v.tenant_id and utilities.customer_utility_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, m.property_id, m.building_id, m.unit_id) and (not v_resident or m.unit_id = v.unit_id)),
    'active_meters', (select count(*) from utilities.meters m where m.tenant_id = v.tenant_id and m.lifecycle_status = 'active' and utilities.customer_utility_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, m.property_id, m.building_id, m.unit_id) and (not v_resident or m.unit_id = v.unit_id)),
    'pending_readings', (select count(*) from utilities.meter_readings r join utilities.meters m on m.id = r.meter_id where r.tenant_id = v.tenant_id and r.review_status = 'pending_review' and utilities.customer_utility_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, m.property_id, m.building_id, m.unit_id) and (not v_resident or m.unit_id = v.unit_id)),
    'validated_readings', (select count(*) from utilities.meter_readings r join utilities.meters m on m.id = r.meter_id where r.tenant_id = v.tenant_id and r.status = 'validated' and utilities.customer_utility_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, m.property_id, m.building_id, m.unit_id) and (not v_resident or m.unit_id = v.unit_id)),
    'current_consumption', (select coalesce(sum(c.adjusted_consumption), 0) from utilities.consumption_periods c join utilities.meters m on m.id = c.meter_id where c.tenant_id = v.tenant_id and utilities.customer_utility_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, m.property_id, m.building_id, m.unit_id) and (not v_resident or m.unit_id = v.unit_id)),
    'billed_consumption', (select coalesce(sum(c.adjusted_consumption), 0) from utilities.consumption_periods c join utilities.meters m on m.id = c.meter_id where c.tenant_id = v.tenant_id and c.status = 'billed' and utilities.customer_utility_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, m.property_id, m.building_id, m.unit_id) and (not v_resident or m.unit_id = v.unit_id)),
    'open_anomalies', (select count(*) from utilities.utility_anomalies a left join utilities.meters m on m.id = a.meter_id where a.tenant_id = v.tenant_id and a.resolved_at is null and (not v_resident or m.unit_id = v.unit_id))
  ) into v_summary;

  return v_summary;
end;
$$;

create or replace function customer_api.update_meter_v1(
  p_context_id uuid,
  p_meter_id uuid,
  p_calibration_expires_on date default null,
  p_multiplier numeric default null,
  p_unit_code text default null,
  p_decimal_precision smallint default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.update_meter(
    p_context_id, p_meter_id, p_calibration_expires_on, p_multiplier, p_unit_code, p_decimal_precision
  );
end;
$$;

create or replace function customer_api.import_readings_v1(
  p_context_id uuid,
  p_meter_id uuid,
  p_readings jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.import_readings(p_context_id, p_meter_id, p_readings);
end;
$$;

create or replace function customer_api.get_utilities_summary_v1(
  p_context_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  return utilities.get_utilities_summary(p_context_id);
end;
$$;

-- Covering indexes for all added foreign keys in utilities (for constraint performance and 022 FK check)
create index if not exists meters_replaces_meter_id_fk_idx on utilities.meters (replaces_meter_id);
create index if not exists meters_replaced_by_meter_id_fk_idx on utilities.meters (replaced_by_meter_id);

create index if not exists consumption_periods_approved_by_fk_idx on utilities.consumption_periods (approved_by);
create index if not exists consumption_periods_invoice_id_fk_idx on utilities.consumption_periods (invoice_id);
create index if not exists consumption_periods_invoice_line_id_fk_idx on utilities.consumption_periods (invoice_line_id);
create index if not exists consumption_periods_tariff_id_fk_idx on utilities.consumption_periods (tariff_id);
create index if not exists consumption_periods_billed_by_fk_idx on utilities.consumption_periods (billed_by);

create index if not exists tariffs_tenant_id_fk_idx on utilities.tariffs (tenant_id);
create index if not exists tariffs_property_id_fk_idx on utilities.tariffs (property_id);
create index if not exists tariffs_provider_id_fk_idx on utilities.tariffs (provider_id);

-- Explicit Revokes and Grants on all customer_api utilities routines
revoke all on function customer_api.create_meter_v1 from public, anon;
revoke all on function customer_api.update_meter_v1 from public, anon;
revoke all on function customer_api.replace_meter_v1 from public, anon;
revoke all on function customer_api.decommission_meter_v1 from public, anon;
revoke all on function customer_api.capture_reading_v1 from public, anon;
revoke all on function customer_api.import_readings_v1 from public, anon;
revoke all on function customer_api.create_ocr_candidate_v1 from public, anon;
revoke all on function customer_api.approve_reading_v1 from public, anon;
revoke all on function customer_api.reject_reading_v1 from public, anon;
revoke all on function customer_api.correct_reading_v1 from public, anon;
revoke all on function customer_api.calculate_consumption_v1 from public, anon;
revoke all on function customer_api.approve_consumption_v1 from public, anon;
revoke all on function customer_api.create_tariff_v1 from public, anon;
revoke all on function customer_api.bill_consumption_v1 from public, anon;
revoke all on function customer_api.get_meter_variance_v1 from public, anon;
revoke all on function customer_api.get_utilities_summary_v1 from public, anon;

grant execute on function customer_api.create_meter_v1 to authenticated;
grant execute on function customer_api.update_meter_v1 to authenticated;
grant execute on function customer_api.replace_meter_v1 to authenticated;
grant execute on function customer_api.decommission_meter_v1 to authenticated;
grant execute on function customer_api.capture_reading_v1 to authenticated;
grant execute on function customer_api.import_readings_v1 to authenticated;
grant execute on function customer_api.create_ocr_candidate_v1 to authenticated;
grant execute on function customer_api.approve_reading_v1 to authenticated;
grant execute on function customer_api.reject_reading_v1 to authenticated;
grant execute on function customer_api.correct_reading_v1 to authenticated;
grant execute on function customer_api.calculate_consumption_v1 to authenticated;
grant execute on function customer_api.approve_consumption_v1 to authenticated;
grant execute on function customer_api.create_tariff_v1 to authenticated;
grant execute on function customer_api.bill_consumption_v1 to authenticated;
grant execute on function customer_api.get_meter_variance_v1 to authenticated;
grant execute on function customer_api.get_utilities_summary_v1 to authenticated;

revoke all on function utilities.create_meter from public, anon;
revoke all on function utilities.update_meter from public, anon;
revoke all on function utilities.replace_meter from public, anon;
revoke all on function utilities.decommission_meter from public, anon;
revoke all on function utilities.capture_reading from public, anon;
revoke all on function utilities.import_readings from public, anon;
revoke all on function utilities.create_ocr_candidate from public, anon;
revoke all on function utilities.approve_reading from public, anon;
revoke all on function utilities.reject_reading from public, anon;
revoke all on function utilities.correct_reading from public, anon;
revoke all on function utilities.calculate_consumption from public, anon;
revoke all on function utilities.approve_consumption from public, anon;
revoke all on function utilities.create_tariff from public, anon;
revoke all on function utilities.bill_consumption from public, anon;
revoke all on function utilities.get_meter_variance from public, anon;
revoke all on function utilities.get_utilities_summary from public, anon;

grant execute on function utilities.create_meter to authenticated;
grant execute on function utilities.update_meter to authenticated;
grant execute on function utilities.replace_meter to authenticated;
grant execute on function utilities.decommission_meter to authenticated;
grant execute on function utilities.capture_reading to authenticated;
grant execute on function utilities.import_readings to authenticated;
grant execute on function utilities.create_ocr_candidate to authenticated;
grant execute on function utilities.approve_reading to authenticated;
grant execute on function utilities.reject_reading to authenticated;
grant execute on function utilities.correct_reading to authenticated;
grant execute on function utilities.calculate_consumption to authenticated;
grant execute on function utilities.approve_consumption to authenticated;
grant execute on function utilities.create_tariff to authenticated;
grant execute on function utilities.bill_consumption to authenticated;
grant execute on function utilities.get_meter_variance to authenticated;
grant execute on function utilities.get_utilities_summary to authenticated;

commit;
