begin;

-- DW-02 vertical slice: a bounded canonical Unit reference. The resolver
-- delegates current Workspace access and permission evaluation to AUTH-01 and
-- reuses the accepted Core Unit identity history and property-mandate sources.
-- It creates no resource, relationship, permission, audit or command store.
create function customer_api.resolve_canonical_resource_reference_v1(
  p_context_id uuid,
  p_workspace_id uuid,
  p_resource_type text,
  p_resource_id uuid,
  p_resource_version integer,
  p_permission_code text,
  p_purpose text
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_context record;
  v_tenant_id uuid;
  v_property_id uuid;
  v_display_name text;
  v_lifecycle_status text;
  v_current_version integer;
  v_evaluated_at timestamptz := statement_timestamp();
  v_withheld jsonb;
begin
  if auth.uid() is null then
    raise exception 'canonical_resource_reference_access_denied' using errcode = '42501';
  end if;

  if p_context_id is null
     or p_workspace_id is null
     or p_resource_type is null
     or p_resource_id is null
     or p_resource_version is null
     or p_resource_version <= 0
     or p_permission_code is null
     or p_permission_code !~ '^[a-z0-9_.:-]{3,128}$'
     or p_purpose is null
     or p_purpose !~ '^[a-z0-9_.:-]{3,128}$'
     or p_resource_type not in ('party', 'property', 'building', 'entrance', 'unit', 'asset') then
    raise exception 'canonical_resource_reference_input_invalid' using errcode = '22023';
  end if;

  select * into strict v_context
  from app_private.resolve_workspace_native_context_v2(p_context_id, p_workspace_id);

  v_withheld := jsonb_build_object(
    'contract_version', 'canonical-resource-reference.v1',
    'reference_status', 'withheld',
    'tenant_id', null,
    'workspace_id', null,
    'resource_type', null,
    'resource_id', null,
    'resource_version', null,
    'party_kind', null,
    'display_name', null,
    'lifecycle_status', null,
    'evaluated_at', v_evaluated_at,
    'action_authorization', 'not_evaluated'
  );

  -- This accepted slice deliberately maps only the existing Core Unit identity
  -- reader. Other contract resource kinds remain withheld until their own
  -- canonical source, permission and real consumer are accepted.
  if p_resource_type <> 'unit'
     or p_permission_code <> 'core.units.identity.read'
     or p_purpose <> 'core.unit_identity.history'
     or app_private.check_workspace_native_permission_v2(
       p_context_id,
       p_workspace_id,
       'core.units.identity.read',
       'core_unit_identity'
     ) is not true then
    return v_withheld;
  end if;

  select
    u.tenant_id,
    b.property_id,
    u.code,
    u.status::text,
    greatest(1, coalesce((
      select max(s.version)
      from portfolio.unit_specification_versions s
      where s.tenant_id = u.tenant_id
        and s.unit_id = u.id
    ), 0))::integer
  into
    v_tenant_id,
    v_property_id,
    v_display_name,
    v_lifecycle_status,
    v_current_version
  from portfolio.units u
  join portfolio.buildings b
    on b.id = u.building_id
   and b.tenant_id = u.tenant_id
  where u.id = p_resource_id;

  if not found then
    return jsonb_build_object(
      'contract_version', 'canonical-resource-reference.v1',
      'reference_status', 'not_found',
      'tenant_id', v_context.tenant_id,
      'workspace_id', v_context.workspace_id,
      'resource_type', p_resource_type,
      'resource_id', p_resource_id,
      'resource_version', null,
      'party_kind', null,
      'display_name', null,
      'lifecycle_status', null,
      'evaluated_at', v_evaluated_at,
      'action_authorization', 'not_evaluated'
    );
  end if;

  if v_tenant_id is distinct from v_context.tenant_id
     or app_private.current_workspace_property_mandate_v1(
       p_context_id,
       p_workspace_id,
       v_property_id,
       'property_operations'
     ) is null then
    return v_withheld;
  end if;

  return jsonb_build_object(
    'contract_version', 'canonical-resource-reference.v1',
    'reference_status', case
      when p_resource_version = v_current_version then 'verified'
      else 'stale'
    end,
    'tenant_id', v_context.tenant_id,
    'workspace_id', v_context.workspace_id,
    'resource_type', 'unit',
    'resource_id', p_resource_id,
    'resource_version', v_current_version,
    'party_kind', null,
    'display_name', v_display_name,
    'lifecycle_status', v_lifecycle_status,
    'evaluated_at', v_evaluated_at,
    'action_authorization', 'not_evaluated'
  );
end;
$$;

revoke all on function customer_api.resolve_canonical_resource_reference_v1(
  uuid, uuid, text, uuid, integer, text, text
) from public, anon, authenticated, service_role;
grant execute on function customer_api.resolve_canonical_resource_reference_v1(
  uuid, uuid, text, uuid, integer, text, text
) to authenticated;

comment on function customer_api.resolve_canonical_resource_reference_v1(
  uuid, uuid, text, uuid, integer, text, text
) is
  'DW-02 canonical Unit reference vertical slice. AUTH-01 and the current property mandate bound disclosure; every result remains non-authoritative for commands.';

-- Real consumer cut-over: the existing Core Unit identity history reader now
-- obtains its resource identity/disclosure decision from DW-02 instead of
-- evaluating AUTH-01 and the mandate in a parallel path.
create or replace function customer_api.get_core_unit_identity_history_v1(
  p_context_id uuid,
  p_workspace_id uuid,
  p_unit_id uuid
) returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_tenant uuid;
  v_property uuid;
  v_mandate uuid;
  v_resource_version integer;
  v_reference jsonb;
  v_snapshots jsonb;
  v_lineage jsonb;
begin
  if auth.uid() is null or p_context_id is null or p_workspace_id is null or p_unit_id is null then
    raise exception 'core_unit_history_access_denied' using errcode = '42501';
  end if;

  select
    u.tenant_id,
    b.property_id,
    greatest(1, coalesce((
      select max(s.version)
      from portfolio.unit_specification_versions s
      where s.tenant_id = u.tenant_id
        and s.unit_id = u.id
    ), 0))::integer
  into v_tenant, v_property, v_resource_version
  from portfolio.units u
  join portfolio.buildings b
    on b.id = u.building_id
   and b.tenant_id = u.tenant_id
  where u.id = p_unit_id;

  if v_property is null then
    raise exception 'core_unit_history_access_denied' using errcode = '42501';
  end if;

  -- Share the property and Unit locks with mandate revocation and command writes.
  perform 1
  from portfolio.properties
  where id = v_property
    and tenant_id = v_tenant
  for share;
  perform 1
  from portfolio.units u
  join portfolio.buildings b
    on b.id = u.building_id
   and b.tenant_id = u.tenant_id
  where u.id = p_unit_id
    and u.tenant_id = v_tenant
    and b.property_id = v_property
  for share of u;
  if not found then
    raise exception 'core_unit_history_access_denied' using errcode = '42501';
  end if;

  v_reference := customer_api.resolve_canonical_resource_reference_v1(
    p_context_id,
    p_workspace_id,
    'unit',
    p_unit_id,
    v_resource_version,
    'core.units.identity.read',
    'core.unit_identity.history'
  );
  if v_reference->>'reference_status' is distinct from 'verified' then
    raise exception 'core_unit_history_access_denied' using errcode = '42501';
  end if;

  select id into v_mandate
  from platform.workspace_property_authorities
  where property_id = v_property
    and customer_workspace_id = p_workspace_id
    and tenant_id = v_tenant
    and purpose = 'property_operations'
    and status = 'active'
    and valid_from <= clock_timestamp()
    and (valid_to is null or valid_to > clock_timestamp())
  for share;
  if v_mandate is null then
    raise exception 'core_unit_history_access_denied' using errcode = '42501';
  end if;

  -- NULL provenance is internal history and is never exposed by this command.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'version', s.version,
    'unit_code', s.unit_code,
    'floor', s.floor,
    'area_m2', s.area_m2,
    'bedrooms', s.bedrooms,
    'source_reference', s.source_reference,
    'recorded_at', s.recorded_at
  ) order by s.version), '[]'::jsonb)
  into v_snapshots
  from portfolio.unit_specification_versions s
  where s.unit_id = p_unit_id
    and s.tenant_id = v_tenant
    and s.customer_workspace_id = p_workspace_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'kind', e.kind,
    'predecessor_unit_ids', e.predecessor_unit_ids,
    'successor_unit_ids', e.successor_unit_ids,
    'source_reference', e.source_reference,
    'recorded_at', e.recorded_at
  ) order by e.recorded_at, e.id), '[]'::jsonb)
  into v_lineage
  from portfolio.unit_lineage_events e
  where e.property_id = v_property
    and e.tenant_id = v_tenant
    and e.customer_workspace_id = p_workspace_id
    and (p_unit_id = any(e.predecessor_unit_ids) or p_unit_id = any(e.successor_unit_ids));

  return jsonb_build_object(
    'unit_id', p_unit_id,
    'resource_reference', v_reference,
    'snapshots', v_snapshots,
    'lineage', v_lineage
  );
end;
$$;

revoke all on function customer_api.get_core_unit_identity_history_v1(
  uuid, uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function customer_api.get_core_unit_identity_history_v1(
  uuid, uuid, uuid
) to authenticated;

comment on function customer_api.get_core_unit_identity_history_v1(uuid, uuid, uuid) is
  'Core Unit identity history consumer of the DW-02 canonical reference resolver. Exact live mandate and AUTH-01 permission remain required; other Workspace history is never exposed.';

commit;
