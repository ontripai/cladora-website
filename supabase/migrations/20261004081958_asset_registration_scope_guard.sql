begin;

-- Tighten existing asset creation; no role or EXECUTE grants change.
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
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

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

commit;
