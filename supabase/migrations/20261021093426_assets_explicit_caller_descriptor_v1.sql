begin;

-- Bind the existing anonymous caller record explicitly at each consumer.
-- Only record assignment syntax changes; domain logic, signatures and ACL stay.
CREATE OR REPLACE FUNCTION assets.list_assets_internal_v1(p_context_id uuid, p_property_id uuid DEFAULT NULL::uuid, p_building_id uuid DEFAULT NULL::uuid, p_category_id uuid DEFAULT NULL::uuid, p_lifecycle_status text DEFAULT NULL::text, p_operational_status text DEFAULT NULL::text, p_condition text DEFAULT NULL::text, p_criticality_level text DEFAULT NULL::text, p_is_safety_critical boolean DEFAULT NULL::boolean, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_is_restricted boolean := false;
  v_total bigint;
  v_items jsonb;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.read', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);
  if v_caller.role_code in ('owner', 'tenant_resident') then
    v_is_restricted := true;
  end if;

  select count(*) into v_total
  from assets.assets a
  where a.tenant_id = v_caller.tenant_id
    and (p_property_id is null or a.property_id = p_property_id)
    and (p_building_id is null or a.building_id = p_building_id)
    and (p_category_id is null or a.category_id = p_category_id)
    and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
    and (p_operational_status is null or a.operational_status = p_operational_status)
    and (p_condition is null or a.condition::text = p_condition)
    and (p_criticality_level is null or a.criticality_level = p_criticality_level)
    and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
    and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%');

  if v_is_restricted then
    -- Projected allowlist for owner / resident (excludes confidential commercial, serial, cost, vendor data)
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'asset_code', a.asset_code,
        'name', a.name,
        'category_id', a.category_id,
        'property_id', a.property_id,
        'building_id', a.building_id,
        'unit_id', a.unit_id,
        'scope', a.scope,
        'location_description', a.location_description,
        'lifecycle_status', a.lifecycle_status,
        'operational_status', a.operational_status,
        'condition', a.condition,
        'criticality_level', a.criticality_level,
        'is_safety_critical', a.is_safety_critical,
        'installed_on', a.installed_on,
        'commissioned_at', a.commissioned_at,
        'created_at', a.created_at
      ) order by a.created_at desc
    ), '[]'::jsonb) into v_items
    from (
      select * from assets.assets a
      where a.tenant_id = v_caller.tenant_id
        and (p_property_id is null or a.property_id = p_property_id)
        and (p_building_id is null or a.building_id = p_building_id)
        and (p_category_id is null or a.category_id = p_category_id)
        and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
        and (p_operational_status is null or a.operational_status = p_operational_status)
        and (p_condition is null or a.condition::text = p_condition)
        and (p_criticality_level is null or a.criticality_level = p_criticality_level)
        and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
        and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%')
      order by a.created_at desc
      limit coalesce(p_limit, 25) offset coalesce(p_offset, 0)
    ) a;
  else
    -- Full administrative projection
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'asset_code', a.asset_code,
        'name', a.name,
        'description', a.description,
        'category_id', a.category_id,
        'property_id', a.property_id,
        'building_id', a.building_id,
        'unit_id', a.unit_id,
        'scope', a.scope,
        'manufacturer', a.manufacturer,
        'model', a.model,
        'serial_fingerprint', a.serial_fingerprint,
        'manufacture_year', a.manufacture_year,
        'installed_on', a.installed_on,
        'commissioned_at', a.commissioned_at,
        'location_description', a.location_description,
        'ownership_type', a.ownership_type,
        'lifecycle_status', a.lifecycle_status,
        'operational_status', a.operational_status,
        'condition', a.condition,
        'criticality_level', a.criticality_level,
        'criticality', a.criticality,
        'is_safety_critical', a.is_safety_critical,
        'replacement_cost', a.replacement_cost,
        'currency', a.currency,
        'meter_id', a.meter_id,
        'access_point_id', a.access_point_id,
        'vendor_id', a.vendor_id,
        'service_contract_id', a.service_contract_id,
        'service_frequency_months', a.service_frequency_months,
        'last_service_date', a.last_service_date,
        'next_service_date', a.next_service_date,
        'created_at', a.created_at,
        'updated_at', a.updated_at
      ) order by a.created_at desc
    ), '[]'::jsonb) into v_items
    from (
      select * from assets.assets a
      where a.tenant_id = v_caller.tenant_id
        and (p_property_id is null or a.property_id = p_property_id)
        and (p_building_id is null or a.building_id = p_building_id)
        and (p_category_id is null or a.category_id = p_category_id)
        and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
        and (p_operational_status is null or a.operational_status = p_operational_status)
        and (p_condition is null or a.condition::text = p_condition)
        and (p_criticality_level is null or a.criticality_level = p_criticality_level)
        and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
        and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%')
      order by a.created_at desc
      limit coalesce(p_limit, 25) offset coalesce(p_offset, 0)
    ) a;
  end if;

  return jsonb_build_object(
    'total', v_total,
    'limit', coalesce(p_limit, 25),
    'offset', coalesce(p_offset, 0),
    'items', v_items
  );
end;
$function$;

CREATE OR REPLACE FUNCTION assets.get_asset_detail_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_is_restricted boolean := false;
  v_asset record;
  v_warranty record;
  v_active_downtime record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.read', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);
  if v_caller.role_code in ('owner', 'tenant_resident') then
    v_is_restricted := true;
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  select * into v_active_downtime from assets.asset_downtimes
  where asset_id = p_asset_id and ended_at is null
  order by started_at desc limit 1;

  if v_is_restricted then
    return jsonb_build_object(
      'id', v_asset.id,
      'asset_code', v_asset.asset_code,
      'name', v_asset.name,
      'category_id', v_asset.category_id,
      'property_id', v_asset.property_id,
      'building_id', v_asset.building_id,
      'unit_id', v_asset.unit_id,
      'scope', v_asset.scope,
      'location_description', v_asset.location_description,
      'lifecycle_status', v_asset.lifecycle_status,
      'operational_status', v_asset.operational_status,
      'condition', v_asset.condition,
      'criticality_level', v_asset.criticality_level,
      'is_safety_critical', v_asset.is_safety_critical,
      'installed_on', v_asset.installed_on,
      'commissioned_at', v_asset.commissioned_at,
      'is_in_downtime', (v_active_downtime.id is not null)
    );
  end if;

  select * into v_warranty from assets.asset_warranties
  where asset_id = p_asset_id order by ends_on desc limit 1;

  return jsonb_build_object(
    'id', v_asset.id,
    'asset_code', v_asset.asset_code,
    'name', v_asset.name,
    'description', v_asset.description,
    'category_id', v_asset.category_id,
    'property_id', v_asset.property_id,
    'building_id', v_asset.building_id,
    'unit_id', v_asset.unit_id,
    'scope', v_asset.scope,
    'manufacturer', v_asset.manufacturer,
    'model', v_asset.model,
    'serial_fingerprint', v_asset.serial_fingerprint,
    'manufacture_year', v_asset.manufacture_year,
    'installed_on', v_asset.installed_on,
    'commissioned_at', v_asset.commissioned_at,
    'location_description', v_asset.location_description,
    'ownership_type', v_asset.ownership_type,
    'lifecycle_status', v_asset.lifecycle_status,
    'operational_status', v_asset.operational_status,
    'condition', v_asset.condition,
    'criticality_level', v_asset.criticality_level,
    'criticality', v_asset.criticality,
    'is_safety_critical', v_asset.is_safety_critical,
    'replacement_cost', v_asset.replacement_cost,
    'currency', v_asset.currency,
    'meter_id', v_asset.meter_id,
    'access_point_id', v_asset.access_point_id,
    'vendor_id', v_asset.vendor_id,
    'service_contract_id', v_asset.service_contract_id,
    'service_frequency_months', v_asset.service_frequency_months,
    'last_service_date', v_asset.last_service_date,
    'next_service_date', v_asset.next_service_date,
    'warranty', case when v_warranty.id is not null then jsonb_build_object(
      'id', v_warranty.id,
      'status', v_warranty.status,
      'starts_on', v_warranty.starts_on,
      'ends_on', v_warranty.ends_on,
      'vendor_id', v_warranty.vendor_id,
      'coverage_json', v_warranty.coverage_json,
      'document_id', v_warranty.document_id
    ) else null end,
    'active_downtime', case when v_active_downtime.id is not null then jsonb_build_object(
      'id', v_active_downtime.id,
      'started_at', v_active_downtime.started_at,
      'reason', v_active_downtime.reason,
      'is_planned', v_active_downtime.is_planned
    ) else null end,
    'created_at', v_asset.created_at,
    'updated_at', v_asset.updated_at
  );
end;
$function$;

create or replace function assets.create_asset_internal_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_category_id uuid,
  p_asset_code text,
  p_name text,
  p_scope text default 'property',
  p_building_id uuid default null,
  p_unit_id uuid default null,
  p_description text default null,
  p_manufacturer text default null,
  p_model text default null,
  p_serial_number text default null,
  p_manufacture_year integer default null,
  p_installed_on date default null,
  p_location_description text default null,
  p_ownership_type text default 'association',
  p_condition text default 'unknown',
  p_criticality_level text default 'medium',
  p_is_safety_critical boolean default false,
  p_replacement_cost numeric default null,
  p_currency text default 'RON',
  p_meter_id uuid default null,
  p_access_point_id uuid default null,
  p_vendor_id uuid default null,
  p_service_contract_id uuid default null,
  p_service_frequency_months integer default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_asset_id uuid;
  v_serial_fp text := null;
  v_crit_num smallint := 3;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  -- Authorization ceiling is independent of entity relationship integrity triggers.
  if not exists (
    select 1 from identity.context_grants g join identity.memberships m
      on m.id=g.membership_id and m.tenant_id=g.tenant_id
    where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
  ) then raise exception 'asset_context_access_denied' using errcode='42501'; end if;

  if not exists (select 1 from portfolio.properties p where p.id=p_property_id and p.tenant_id=v_caller.tenant_id)
    or not exists (select 1 from assets.asset_categories c where c.id=p_category_id and c.tenant_id=v_caller.tenant_id and c.status='active')
  then raise exception 'asset_entity_scope_invalid' using errcode='22023'; end if;

  if v_caller.scope_type not in ('tenant','property','building','unit')
    or (v_caller.scope_type='property' and p_property_id is distinct from v_caller.property_id)
    or (v_caller.scope_type='building' and (p_building_id is distinct from v_caller.building_id or p_scope not in ('building','common_area','unit')))
    or (v_caller.scope_type='unit' and (p_unit_id is distinct from v_caller.unit_id or p_scope<>'unit'))
  then raise exception 'asset_context_scope_violation' using errcode='42501'; end if;


  if p_is_safety_critical or p_criticality_level = 'critical' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  if p_serial_number is not null and trim(p_serial_number) <> '' then
    v_serial_fp := encode(digest(trim(p_serial_number), 'sha256'), 'hex');
  end if;

  case p_criticality_level
    when 'low' then v_crit_num := 1;
    when 'medium' then v_crit_num := 3;
    when 'high' then v_crit_num := 4;
    when 'critical' then v_crit_num := 5;
    else v_crit_num := 3;
  end case;

  insert into assets.assets (
    tenant_id, property_id, category_id, asset_code, name, scope,
    building_id, unit_id, description, manufacturer, model,
    serial_number_encrypted, serial_fingerprint, manufacture_year, installed_on,
    location_description, ownership_type, lifecycle_status, operational_status,
    condition, criticality_level, criticality, is_safety_critical, replacement_cost,
    currency, meter_id, access_point_id, vendor_id, service_contract_id,
    service_frequency_months, created_by
  ) values (
    v_caller.tenant_id, p_property_id, p_category_id, trim(p_asset_code), trim(p_name), p_scope::assets.asset_scope,
    p_building_id, p_unit_id, p_description, p_manufacturer, p_model,
    p_serial_number, v_serial_fp, p_manufacture_year, p_installed_on,
    p_location_description, p_ownership_type, 'planned', 'operational',
    p_condition::assets.asset_condition, p_criticality_level, v_crit_num, p_is_safety_critical, p_replacement_cost,
    p_currency, p_meter_id, p_access_point_id, p_vendor_id, p_service_contract_id,
    p_service_frequency_months, auth.uid()
  ) returning id into v_asset_id;

  -- Record audit event
  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason, occurred_at
  ) values (
    v_caller.tenant_id, v_asset_id, 'asset_created', auth.uid(), 'Initial creation in planned status', statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', v_asset_id);
end;
$$;

CREATE OR REPLACE FUNCTION assets.update_asset_internal_v1(p_context_id uuid, p_asset_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_location_description text DEFAULT NULL::text, p_meter_id uuid DEFAULT NULL::uuid, p_access_point_id uuid DEFAULT NULL::uuid, p_vendor_id uuid DEFAULT NULL::uuid, p_service_contract_id uuid DEFAULT NULL::uuid, p_service_frequency_months integer DEFAULT NULL::integer, p_replacement_cost numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if v_asset.is_safety_critical or v_asset.criticality_level = 'critical' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    name = coalesce(trim(p_name), name),
    description = coalesce(p_description, description),
    location_description = coalesce(p_location_description, location_description),
    meter_id = coalesce(p_meter_id, meter_id),
    access_point_id = coalesce(p_access_point_id, access_point_id),
    vendor_id = coalesce(p_vendor_id, vendor_id),
    service_contract_id = coalesce(p_service_contract_id, service_contract_id),
    service_frequency_months = coalesce(p_service_frequency_months, service_frequency_months),
    replacement_cost = coalesce(p_replacement_cost, replacement_cost),
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'asset_id', p_asset_id);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.transition_asset_lifecycle_internal_v1(p_context_id uuid, p_asset_id uuid, p_target_status text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  if p_target_status in ('decommissioned', 'decommission_pending') then
    raise exception 'direct_decommission_forbidden: asset decommissioning requires formal request and approval';
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  -- Commissioning requires AAL2 and verification
  if p_target_status = 'commissioned' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.manage', true);
  end if;

  if v_asset.is_safety_critical and p_target_status in ('commissioned','out_of_service') then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    lifecycle_status = p_target_status,
    commissioned_at = case when p_target_status = 'commissioned' and commissioned_at is null then statement_timestamp() else commissioned_at end,
    updated_at = statement_timestamp()
  where id = p_asset_id;

  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason,
    before_snapshot, after_snapshot, occurred_at
  ) values (
    v_caller.tenant_id, p_asset_id, 'lifecycle_transition', auth.uid(), p_reason,
    jsonb_build_object('lifecycle_status', v_asset.lifecycle_status),
    jsonb_build_object('lifecycle_status', p_target_status),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', p_asset_id, 'lifecycle_status', p_target_status);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.update_asset_operational_status_internal_v1(p_context_id uuid, p_asset_id uuid, p_operational_status text, p_condition text DEFAULT NULL::text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if v_asset.is_safety_critical and p_operational_status in ('unavailable', 'isolated') then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    operational_status = p_operational_status,
    condition = coalesce(p_condition::assets.asset_condition, condition),
    updated_at = statement_timestamp()
  where id = p_asset_id;

  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason,
    before_snapshot, after_snapshot, occurred_at
  ) values (
    v_caller.tenant_id, p_asset_id, 'operational_status_change', auth.uid(), p_reason,
    jsonb_build_object('operational_status', v_asset.operational_status, 'condition', v_asset.condition),
    jsonb_build_object('operational_status', p_operational_status, 'condition', coalesce(p_condition, v_asset.condition::text)),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', p_asset_id, 'operational_status', p_operational_status);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.start_asset_downtime_internal_v1(p_context_id uuid, p_asset_id uuid, p_reason text, p_is_planned boolean DEFAULT false, p_work_order_id uuid DEFAULT NULL::uuid, p_ticket_id uuid DEFAULT NULL::uuid, p_started_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_downtime_id uuid;
  v_start timestamptz := coalesce(p_started_at, statement_timestamp());
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  -- Row lock asset
  perform 1 from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  insert into assets.asset_downtimes (
    tenant_id, asset_id, started_at, reason, is_planned,
    work_order_id, ticket_id, recorded_by
  ) values (
    v_caller.tenant_id, p_asset_id, v_start, p_reason, p_is_planned,
    p_work_order_id, p_ticket_id, auth.uid()
  ) returning id into v_downtime_id;

  -- Automatically update operational status to unavailable
  update assets.assets set
    operational_status = 'unavailable',
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'downtime_id', v_downtime_id, 'asset_id', p_asset_id);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.end_asset_downtime_internal_v1(p_context_id uuid, p_downtime_id uuid, p_ended_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_restored_operational_status text DEFAULT 'operational'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_dt record;
  v_end timestamptz := coalesce(p_ended_at, statement_timestamp());
  v_duration integer;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  -- Atomic select for update ensuring exactly one winner
  select * into v_dt from assets.asset_downtimes
  where id = p_downtime_id and tenant_id = v_caller.tenant_id and ended_at is null
  for update;

  if not found then
    raise exception 'DOWNTIME_NOT_ACTIVE: Active downtime session % not found', p_downtime_id;
  end if;

  if v_end <= v_dt.started_at then
    raise exception 'INVALID_END_TIME: Downtime end time must be strictly after started_at';
  end if;

  v_duration := greatest(0, floor(extract(epoch from (v_end - v_dt.started_at)) / 60)::integer);

  update assets.asset_downtimes set
    ended_at = v_end,
    duration_minutes = v_duration
  where id = p_downtime_id;

  -- Restore operational status
  update assets.assets set
    operational_status = p_restored_operational_status,
    updated_at = statement_timestamp()
  where id = v_dt.asset_id;

  return jsonb_build_object('success', true, 'downtime_id', p_downtime_id, 'duration_minutes', v_duration);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.list_asset_inspections_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_items jsonb;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.read', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'inspection_type', i.inspection_type,
      'scheduled_date', i.scheduled_date,
      'performed_at', i.performed_at,
      'result', i.result,
      'inspector_name', i.inspector_name,
      'observations', i.observations,
      'corrective_action_required', i.corrective_action_required,
      'next_due_date', i.next_due_date,
      'is_verified', i.is_verified,
      'verified_at', i.verified_at,
      'document_id', i.document_id,
      'policy_id', i.policy_id
    ) order by i.scheduled_date desc
  ), '[]'::jsonb) into v_items
  from assets.asset_inspections i
  where i.asset_id = p_asset_id and i.tenant_id = v_caller.tenant_id;

  return jsonb_build_object('items', v_items);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.record_asset_inspection_internal_v1(p_context_id uuid, p_asset_id uuid, p_inspection_type text, p_scheduled_date date, p_performed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_result text DEFAULT 'pending'::text, p_inspector_name text DEFAULT NULL::text, p_inspector_vendor_id uuid DEFAULT NULL::uuid, p_observations text DEFAULT NULL::text, p_corrective_action_required text DEFAULT NULL::text, p_document_id uuid DEFAULT NULL::uuid, p_policy_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
  v_policy record;
  v_snapshot jsonb := null;
  v_next_due date := null;
  v_insp_id uuid;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if p_policy_id is not null then
    select * into v_policy from assets.compliance_policies
    where id = p_policy_id and tenant_id = v_caller.tenant_id;
    if not found then
      raise exception 'compliance_policy_unconfigured: Compliance policy % not found or inactive', p_policy_id;
    end if;

    v_snapshot := jsonb_build_object(
      'policy_code', v_policy.policy_code,
      'version', v_policy.version,
      'interval_months', v_policy.interval_months,
      'legal_source_reference', v_policy.legal_source_reference
    );

    if p_result in ('passed', 'passed_with_observations') and p_performed_at is not null then
      v_next_due := (p_performed_at::date + (v_policy.interval_months || ' months')::interval)::date;
    end if;
  elsif p_inspection_type in ('statutory_compliance', 'statutory', 'mandatory_safety', 'annual_safety') then
    select cp.* into v_policy from assets.compliance_policies cp
    join assets.asset_categories ac on ac.id = v_asset.category_id
    where cp.tenant_id = v_caller.tenant_id
      and cp.category_code = ac.code
      and cp.approval_status = 'APPROVED'
      and (cp.property_id is null or cp.property_id = v_asset.property_id)
      and (cp.effective_to is null or cp.effective_to >= current_date)
      and cp.effective_from <= current_date
    order by (cp.property_id is not null) desc, cp.version desc
    limit 1;

    if not found then
      raise exception 'compliance_policy_unconfigured: No active statutory compliance policy configured for asset category';
    end if;

    p_policy_id := v_policy.id;
    v_snapshot := jsonb_build_object(
      'policy_code', v_policy.policy_code,
      'version', v_policy.version,
      'interval_months', v_policy.interval_months,
      'legal_source_reference', v_policy.legal_source_reference
    );

    if p_result in ('passed', 'passed_with_observations') and p_performed_at is not null then
      v_next_due := (p_performed_at::date + (v_policy.interval_months || ' months')::interval)::date;
    end if;
  end if;

  insert into assets.asset_inspections (
    tenant_id, asset_id, policy_id, policy_version_snapshot, inspection_type,
    scheduled_date, performed_at, result, inspector_name, inspector_vendor_id,
    observations, corrective_action_required, next_due_date, document_id, created_by
  ) values (
    v_caller.tenant_id, p_asset_id, p_policy_id, v_snapshot, p_inspection_type,
    p_scheduled_date, p_performed_at, p_result, p_inspector_name, p_inspector_vendor_id,
    p_observations, p_corrective_action_required, v_next_due, p_document_id, auth.uid()
  ) returning id into v_insp_id;

  -- If inspection failed and asset is safety critical, degrade operational status
  if p_result = 'failed' and v_asset.is_safety_critical then
    update assets.assets set
      operational_status = 'degraded',
      updated_at = statement_timestamp()
    where id = p_asset_id;
  end if;

  return jsonb_build_object('success', true, 'inspection_id', v_insp_id, 'next_due_date', v_next_due);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.verify_asset_inspection_internal_v1(p_context_id uuid, p_inspection_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_insp record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.inspections.verify', true)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_insp from assets.asset_inspections
  where id = p_inspection_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'INSPECTION_NOT_FOUND: Inspection % not found', p_inspection_id;
  end if;

  if v_insp.is_verified then
    raise exception 'ALREADY_VERIFIED: Inspection has already been certified';
  end if;

  update assets.asset_inspections set
    is_verified = true,
    verified_by = auth.uid(),
    verified_at = statement_timestamp(),
    updated_at = statement_timestamp()
  where id = p_inspection_id;

  return jsonb_build_object('success', true, 'inspection_id', p_inspection_id, 'verified_at', statement_timestamp());
end;
$function$;

CREATE OR REPLACE FUNCTION assets.get_asset_warranty_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_w record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.read', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  if v_caller.role_code in ('owner', 'tenant_resident') then
    raise exception 'ACCESS_DENIED: Commercial warranty terms restricted';
  end if;

  select * into v_w from assets.asset_warranties
  where asset_id = p_asset_id and tenant_id = v_caller.tenant_id
  order by ends_on desc limit 1;

  if not found then
    return jsonb_build_object('warranty', null);
  end if;

  return jsonb_build_object(
    'warranty', jsonb_build_object(
      'id', v_w.id,
      'status', case when v_w.ends_on < current_date and v_w.status = 'active' then 'expired' else v_w.status end,
      'starts_on', v_w.starts_on,
      'ends_on', v_w.ends_on,
      'vendor_id', v_w.vendor_id,
      'coverage_json', v_w.coverage_json,
      'warranty_terms', v_w.warranty_terms,
      'document_id', v_w.document_id,
      'created_at', v_w.created_at
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION assets.upsert_asset_warranty_internal_v1(p_context_id uuid, p_asset_id uuid, p_starts_on date, p_ends_on date, p_vendor_id uuid DEFAULT NULL::uuid, p_coverage_json jsonb DEFAULT '{}'::jsonb, p_warranty_terms text DEFAULT NULL::text, p_document_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
  v_w_id uuid;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  if p_ends_on < p_starts_on then
    raise exception 'INVALID_WARRANTY_DATES: Warranty ends_on must be on or after starts_on';
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  insert into assets.asset_warranties (
    tenant_id, asset_id, starts_on, ends_on, vendor_id,
    coverage_json, warranty_terms, document_id
  ) values (
    v_caller.tenant_id, p_asset_id, p_starts_on, p_ends_on, p_vendor_id,
    coalesce(p_coverage_json, '{}'::jsonb), p_warranty_terms, p_document_id
  ) returning id into v_w_id;

  return jsonb_build_object('success', true, 'warranty_id', v_w_id);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.list_warranty_claims_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_items jsonb;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.read', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  if v_caller.role_code in ('owner', 'tenant_resident') then
    raise exception 'ACCESS_DENIED: Commercial warranty claims restricted';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'claim_reference', c.claim_reference,
      'claim_date', c.claim_date,
      'description', c.description,
      'resolution_status', c.resolution_status,
      'resolution_notes', c.resolution_notes,
      'document_id', c.document_id,
      'created_at', c.created_at
    ) order by c.claim_date desc
  ), '[]'::jsonb) into v_items
  from assets.asset_warranty_claims c
  where c.asset_id = p_asset_id and c.tenant_id = v_caller.tenant_id;

  return jsonb_build_object('items', v_items);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.create_warranty_claim_internal_v1(p_context_id uuid, p_warranty_id uuid, p_claim_reference text, p_description text, p_claim_date date DEFAULT CURRENT_DATE, p_document_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_w record;
  v_a record;
  v_snapshot jsonb;
  v_claim_id uuid;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_w from assets.asset_warranties
  where id = p_warranty_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'WARRANTY_NOT_FOUND: Warranty % not found', p_warranty_id;
  end if;

  select * into v_a from assets.assets where id = v_w.asset_id;

  v_snapshot := jsonb_build_object(
    'warranty_id', v_w.id,
    'starts_on', v_w.starts_on,
    'ends_on', v_w.ends_on,
    'vendor_id', v_w.vendor_id,
    'asset_code', v_a.asset_code,
    'asset_name', v_a.name
  );

  insert into assets.asset_warranty_claims (
    tenant_id, warranty_id, asset_id, claim_reference, claim_date,
    description, warranty_snapshot, document_id, created_by
  ) values (
    v_caller.tenant_id, p_warranty_id, v_w.asset_id, trim(p_claim_reference), p_claim_date,
    p_description, v_snapshot, p_document_id, auth.uid()
  ) returning id into v_claim_id;

  return jsonb_build_object('success', true, 'claim_id', v_claim_id);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.resolve_warranty_claim_internal_v1(p_context_id uuid, p_claim_id uuid, p_resolution_status text, p_resolution_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_claim record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  if p_resolution_status not in ('in_review','accepted','rejected','resolved') then
    raise exception 'INVALID_STATUS: Resolution status % not allowed', p_resolution_status;
  end if;

  select * into v_claim from assets.asset_warranty_claims
  where id = p_claim_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'CLAIM_NOT_FOUND: Claim % not found', p_claim_id;
  end if;

  update assets.asset_warranty_claims set
    resolution_status = p_resolution_status,
    resolution_notes = coalesce(p_resolution_notes, resolution_notes),
    updated_at = statement_timestamp()
  where id = p_claim_id;

  return jsonb_build_object('success', true, 'claim_id', p_claim_id, 'resolution_status', p_resolution_status);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.list_compliance_policies_internal_v1(p_context_id uuid, p_category_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_items jsonb;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.read', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'policy_code', p.policy_code,
      'category_code', p.category_code,
      'property_id', p.property_id,
      'jurisdiction', p.jurisdiction,
      'interval_months', p.interval_months,
      'is_safety_mandatory', p.is_safety_mandatory,
      'legal_source_reference', p.legal_source_reference,
      'approval_status', p.approval_status,
      'effective_from', p.effective_from,
      'effective_to', p.effective_to,
      'version', p.version
    ) order by p.created_at desc
  ), '[]'::jsonb) into v_items
  from assets.compliance_policies p
  where p.tenant_id = v_caller.tenant_id
    and (p_category_code is null or p.category_code = p_category_code);

  return jsonb_build_object('items', v_items);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.configure_compliance_policy_internal_v1(p_context_id uuid, p_policy_code text, p_category_code text, p_interval_months integer, p_legal_source_reference text, p_effective_from date, p_effective_to date DEFAULT NULL::date, p_property_id uuid DEFAULT NULL::uuid, p_is_safety_mandatory boolean DEFAULT false, p_jurisdiction text DEFAULT 'RO'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_policy_id uuid;
  v_ver integer := 1;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', true)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  -- Determine version
  select coalesce(max(version), 0) + 1 into v_ver
  from assets.compliance_policies
  where tenant_id = v_caller.tenant_id and policy_code = trim(p_policy_code);

  insert into assets.compliance_policies (
    tenant_id, policy_code, category_code, property_id, jurisdiction,
    interval_months, is_safety_mandatory, legal_source_reference,
    approval_status, effective_from, effective_to, version, created_by
  ) values (
    v_caller.tenant_id, trim(p_policy_code), trim(p_category_code), p_property_id, p_jurisdiction,
    p_interval_months, p_is_safety_mandatory, trim(p_legal_source_reference),
    'APPROVED', p_effective_from, p_effective_to, v_ver, auth.uid()
  ) returning id into v_policy_id;

  return jsonb_build_object('success', true, 'policy_id', v_policy_id, 'version', v_ver);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.request_asset_decommission_internal_v1(p_context_id uuid, p_asset_id uuid, p_reason text, p_replacement_asset_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
  v_req_id uuid;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % not found in tenant', p_asset_id;
  end if;

  if v_asset.lifecycle_status in ('decommissioned', 'disposed') then
    raise exception 'ASSET_ALREADY_DECOMMISSIONED: Cannot request decommission for already decommissioned asset';
  end if;

  if p_replacement_asset_id is not null then
    perform 1 from assets.assets
    where id = p_replacement_asset_id and tenant_id = v_caller.tenant_id;
    if not found then
      raise exception 'REPLACEMENT_ASSET_NOT_FOUND: Replacement asset not found in same tenant';
    end if;
  end if;

  insert into assets.asset_decommission_requests (
    tenant_id, asset_id, replacement_asset_id, status, reason, requested_by
  ) values (
    v_caller.tenant_id, p_asset_id, p_replacement_asset_id, 'pending', p_reason, auth.uid()
  ) returning id into v_req_id;

  -- Set session authorization flag for decommission transition
  perform set_config('cladora.decommission_authorized', 'true', true);

  update assets.assets set
    lifecycle_status = 'decommission_pending',
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'request_id', v_req_id);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.approve_asset_decommission_internal_v1(p_context_id uuid, p_request_id uuid, p_approved boolean, p_rejection_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_req record;
  v_asset record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.decommission', true)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_req from assets.asset_decommission_requests
  where id = p_request_id and tenant_id = v_caller.tenant_id for update;

  if not found or v_req.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING: Decommission request % is not pending', p_request_id;
  end if;

  select * into v_asset from assets.assets
  where id = v_req.asset_id and tenant_id = v_caller.tenant_id for update;

  -- Dual-control: If safety-critical, approver cannot be the same as requester
  if (v_asset.is_safety_critical or v_asset.criticality_level = 'critical') and v_req.requested_by = auth.uid() then
    raise exception 'dual_control_required_for_critical_asset: independent approver required for critical asset decommission';
  end if;

  if p_approved then
    update assets.asset_decommission_requests set
      status = 'approved',
      approved_by = auth.uid(),
      approved_at = statement_timestamp()
    where id = p_request_id;

    -- Set session authorization flag
    perform set_config('cladora.decommission_authorized', 'true', true);

    update assets.assets set
      lifecycle_status = 'decommissioned',
      operational_status = 'isolated',
      retired_at = statement_timestamp(),
      updated_at = statement_timestamp()
    where id = v_asset.id;

    insert into assets.asset_history (
      tenant_id, asset_id, event_type, actor_id, reason, occurred_at
    ) values (
      v_caller.tenant_id, v_asset.id, 'asset_decommissioned', auth.uid(), v_req.reason, statement_timestamp()
    );
  else
    update assets.asset_decommission_requests set
      status = 'rejected',
      approved_by = auth.uid(),
      approved_at = statement_timestamp(),
      rejection_reason = p_rejection_reason
    where id = p_request_id;

    perform set_config('cladora.decommission_authorized', 'true', true);

    update assets.assets set
      lifecycle_status = 'active',
      updated_at = statement_timestamp()
    where id = v_asset.id;
  end if;

  return jsonb_build_object('success', true, 'request_id', p_request_id, 'approved', p_approved);
end;
$function$;

create or replace function assets.registration_context_v1(p_context_id uuid) returns record
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record;
begin
 select typed_caller.* into v
  from assets.check_asset_caller_v1(p_context_id,'assets.manage',false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);
 if v.scope_type not in ('tenant','property','building') or not exists(
  select 1 from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
   and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
 ) then raise exception 'asset_context_access_denied' using errcode='42501'; end if;
 return v;
end $$;

create or replace function assets.registration_choices_v1(p_context_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record; properties jsonb; buildings jsonb;
begin
 select typed_caller.* into v
  from assets.registration_context_v1(p_context_id)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);
 select coalesce(jsonb_agg(q),'[]'::jsonb) into properties from (
  select p.id,p.name from portfolio.properties p where p.tenant_id=v.tenant_id and p.status='active'
   and (v.scope_type='tenant' or (v.scope_type='property' and p.id=v.property_id)
    or (v.scope_type='building' and exists(select 1 from portfolio.buildings b where b.id=v.building_id and b.tenant_id=v.tenant_id and b.property_id=p.id)))
  order by p.name,p.id limit 200
 ) q;
 select coalesce(jsonb_agg(q),'[]'::jsonb) into buildings from (
  select b.id,b.name,b.property_id from portfolio.buildings b where b.tenant_id=v.tenant_id and b.status='active'
   and exists(select 1 from jsonb_array_elements(properties) p where p->>'id'=b.property_id::text)
   and (v.scope_type<>'building' or b.id=v.building_id)
  order by b.name,b.id limit 500
 ) q;
 return jsonb_build_object('properties',properties,'buildings',buildings,'building_required',v.scope_type='building');
end $$;

create or replace function assets.register_equipment_v1(p_context_id uuid,p_property_id uuid,p_building_id uuid,p_category_code text,p_asset_code text,p_name text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v record; category_id uuid; category_name text; result jsonb;
begin
 select typed_caller.* into v
  from assets.registration_context_v1(p_context_id)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);
 if p_category_code not in ('ventilation','pump','elevator','fire_safety','other') or p_category_code is null
  or p_asset_code is null or length(trim(p_asset_code)) not between 1 and 64
  or p_name is null or length(trim(p_name)) not between 1 and 255
 then raise exception 'asset_registration_invalid' using errcode='22023'; end if;
 category_name:=case p_category_code when 'ventilation' then 'Ventilation' when 'pump' then 'Pump' when 'elevator' then 'Elevator' when 'fire_safety' then 'Fire safety' else 'Other equipment' end;
 -- The transaction rolls category creation back if guarded registration fails.
 insert into assets.asset_categories(tenant_id,code,name,status) values(v.tenant_id,p_category_code,category_name,'active')
 on conflict(tenant_id,code) do nothing returning id into category_id;
 if category_id is not null then
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
  values(v.tenant_id,auth.uid(),v.role_code,'ASSET_CATEGORY_CREATED','assets.category',category_id,'Equipment registration category',jsonb_build_object('code',p_category_code,'name',category_name));
 end if;
 select c.id into category_id from assets.asset_categories c where c.tenant_id=v.tenant_id and c.code=p_category_code and c.status='active';
 if category_id is null then raise exception 'asset_category_inactive' using errcode='22023'; end if;
 result:=assets.create_asset_internal_v1(p_context_id=>p_context_id,p_property_id=>p_property_id,p_category_id=>category_id,
  p_asset_code=>p_asset_code,p_name=>p_name,p_scope=>case when p_building_id is null then 'property' else 'building' end,
  p_building_id=>p_building_id,p_is_safety_critical=>p_category_code in ('elevator','fire_safety'),
  p_criticality_level=>case when p_category_code in ('elevator','fire_safety') then 'critical' else 'medium' end);
 return result;
end $$;

commit;
