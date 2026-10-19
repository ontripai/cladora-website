begin;

-- PC-01 accepted vertical slice. This function projects one existing product
-- right and its module activation. It does not mutate commercial state, consume
-- quota, activate a module or authorize a domain action.
create function customer_api.get_product_capability_decision_v1(
  p_context_id uuid,
  p_workspace_id uuid,
  p_capability_key text
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_context record;
  v_ent platform.workspace_entitlements%rowtype;
  v_ent_found boolean := false;
  v_contract platform.workspace_contracts%rowtype;
  v_contract_found boolean := false;
  v_module platform.module_definitions%rowtype;
  v_module_found boolean := false;
  v_activation platform.workspace_modules%rowtype;
  v_activation_found boolean := false;
  v_now timestamptz := statement_timestamp();
  v_value jsonb;
  v_provenance jsonb;
  v_override jsonb;
  v_right jsonb := null;
  v_right_result text;
  v_right_reasons jsonb;
  v_product_availability text;
  v_activation_projection jsonb;
  v_activation_status text;
  v_reason_codes jsonb;
  v_override_active boolean;
  v_effective boolean := false;
  v_shape_valid boolean := true;
begin
  if auth.uid() is null then
    raise exception 'pc01_product_capability_access_denied' using errcode = '42501';
  end if;

  if p_context_id is null
     or p_workspace_id is null
     or p_capability_key is distinct from 'module.services_catalog' then
    raise exception 'pc01_product_capability_input_invalid' using errcode = '22023';
  end if;

  -- AUTH-01 supplies the authenticated actor/Workspace boundary. Product
  -- availability remains separate from action permission evaluation.
  select * into strict v_context
  from app_private.resolve_workspace_native_context_v2(p_context_id, p_workspace_id);

  select e.* into v_ent
  from platform.workspace_entitlements e
  where e.customer_workspace_id = v_context.workspace_id
    and e.entitlement_key = p_capability_key;
  v_ent_found := found;

  select m.* into v_module
  from platform.module_definitions m
  where m.code = 'services_catalog'
    and m.entitlement_key = p_capability_key
    and m.is_active
    and m.lifecycle_status in ('active', 'published')
    and m.valid_from <= v_now
    and (m.valid_to is null or m.valid_to > v_now)
  order by m.version desc
  limit 1;
  v_module_found := found;

  if v_module_found then
    select wm.* into v_activation
    from platform.workspace_modules wm
    where wm.customer_workspace_id = v_context.workspace_id
      and wm.module_definition_id = v_module.id
      and wm.module_code = v_module.code
    order by
      (wm.status = 'active' and wm.valid_from <= v_now
       and (wm.valid_to is null or wm.valid_to > v_now)) desc,
      wm.valid_from desc,
      wm.id
    limit 1;
    v_activation_found := found;
  end if;

  if v_activation_found
     and v_activation.status = 'active'
     and v_activation.valid_from <= v_now
     and (v_activation.valid_to is null or v_activation.valid_to > v_now) then
    v_activation_status := 'active';
  elsif v_activation_found then
    v_activation_status := v_activation.status;
  else
    v_activation_status := 'not_installed';
  end if;

  v_activation_projection := jsonb_build_object(
    'status', v_activation_status,
    'activation_id', case when v_activation_found then to_jsonb(v_activation.id) else 'null'::jsonb end,
    'module_definition_id', case when v_module_found then to_jsonb(v_module.id) else 'null'::jsonb end,
    'module_code', 'services_catalog',
    'module_version', case when v_module_found then to_jsonb(v_module.version) else 'null'::jsonb end,
    'valid_from', case when v_activation_found then to_jsonb(v_activation.valid_from) else 'null'::jsonb end,
    'valid_until', case when v_activation_found then to_jsonb(v_activation.valid_to) else 'null'::jsonb end
  );

  if v_ent_found then
    v_override_active := v_ent.override_value_json is not null
      and v_ent.override_expires_at is not null
      and v_ent.override_expires_at > v_now;

    v_value := case v_ent.value_type
      when 'boolean' then jsonb_build_object(
        'value_type', 'boolean', 'boolean_value', v_ent.boolean_value)
      when 'numeric' then jsonb_build_object(
        'value_type', 'numeric', 'numeric_value',
        case when v_ent.numeric_value is null then null else v_ent.numeric_value::text end)
      when 'string' then jsonb_build_object(
        'value_type', 'string', 'string_value', v_ent.text_value)
      when 'array' then jsonb_build_object(
        'value_type', 'array', 'array_value',
        case when v_ent.json_value is null or jsonb_typeof(v_ent.json_value) = 'array'
          then v_ent.json_value else null end)
      when 'json' then jsonb_build_object(
        'value_type', 'json', 'json_value',
        case when v_ent.json_value is null or jsonb_typeof(v_ent.json_value) = 'object'
          then v_ent.json_value else null end)
    end;

    v_shape_valid := case v_ent.value_type
      when 'array' then v_ent.json_value is null or jsonb_typeof(v_ent.json_value) = 'array'
      when 'json' then v_ent.json_value is null or jsonb_typeof(v_ent.json_value) = 'object'
      else true
    end;

    if v_ent.contract_id is not null then
      select c.* into v_contract
      from platform.workspace_contracts c
      where c.id = v_ent.contract_id
        and c.customer_workspace_id = v_context.workspace_id;
      v_contract_found := found;
      if not v_contract_found then
        raise exception 'pc01_contract_provenance_invalid' using errcode = '55000';
      end if;
      v_provenance := jsonb_build_object(
        'kind', 'contract',
        'contract_id', v_contract.id,
        'contract_version', v_contract.version,
        'source_reference', v_contract.contract_ref
      );
    else
      v_provenance := jsonb_build_object(
        'kind', 'legacy_unprovenanced',
        'contract_id', null,
        'contract_version', null,
        'source_reference', null
      );
    end if;

    v_override := case when v_override_active then jsonb_build_object(
      'status', 'active',
      'value', v_ent.override_value_json,
      'expires_at', v_ent.override_expires_at
    ) else jsonb_build_object(
      'status', 'inactive',
      'value', null,
      'expires_at', null
    ) end;

    if v_ent.valid_from > v_now
       or (v_ent.valid_until is not null and v_ent.valid_until <= v_now) then
      v_right_result := 'ineffective';
      v_right_reasons := jsonb_build_array('right_not_current');
    elsif not v_shape_valid then
      v_right_result := 'review_required';
      v_right_reasons := jsonb_build_array('right_value_shape_invalid');
    elsif (v_ent.value_type = 'boolean' and v_ent.boolean_value is null)
       or (v_ent.value_type = 'numeric' and v_ent.numeric_value is null)
       or (v_ent.value_type = 'string' and v_ent.text_value is null)
       or (v_ent.value_type in ('array', 'json') and v_ent.json_value is null) then
      v_right_result := 'ineffective';
      v_right_reasons := jsonb_build_array('right_value_null');
    elsif v_ent.value_type in ('string', 'array', 'json') then
      v_right_result := 'review_required';
      v_right_reasons := jsonb_build_array('no_shared_comparator');
    else
      v_effective := case
        when v_override_active then v_ent.override_value_json = 'true'::jsonb
        else v_ent.boolean_value is true or v_ent.numeric_value > 0
      end;
      v_right_result := case when v_effective then 'effective' else 'ineffective' end;
      v_right_reasons := jsonb_build_array(
        case
          when v_override_active and v_effective then 'active_override_true'
          when v_override_active then 'active_override_not_true'
          when v_ent.value_type = 'boolean' and v_effective then 'boolean_true'
          when v_ent.value_type = 'boolean' then 'boolean_not_true'
          when v_ent.value_type = 'numeric' and v_effective then 'numeric_positive'
          else 'numeric_not_positive'
        end
      );
    end if;

    v_right := jsonb_build_object(
      'contract_version', 'product-right-evaluation.v1',
      'workspace_id', v_context.workspace_id,
      'entitlement_id', v_ent.id,
      'entitlement_key', v_ent.entitlement_key,
      'value', v_value,
      'provenance', v_provenance,
      'valid_from', v_ent.valid_from,
      'valid_until', v_ent.valid_until,
      'override', v_override,
      'evaluation_purpose', 'capability_availability',
      'evaluation_result', v_right_result,
      'reason_codes', v_right_reasons,
      'evaluated_at', v_now
    );
  else
    v_right_result := 'ineffective';
    v_right_reasons := jsonb_build_array('right_missing');
  end if;

  v_product_availability := case v_right_result
    when 'effective' then 'available'
    when 'review_required' then 'review_required'
    else 'unavailable'
  end;
  v_reason_codes := v_right_reasons || jsonb_build_array(
    case when v_activation_status = 'active' then 'module_active' else 'module_not_active' end
  );

  return jsonb_build_object(
    'contract_version', 'product-capability-decision.v1',
    'evaluated_at', v_now,
    'workspace_id', v_context.workspace_id,
    'capability_key', p_capability_key,
    'product_availability', v_product_availability,
    'right', v_right,
    'activation', v_activation_projection,
    'action_authorization', 'not_evaluated',
    'reason_codes', v_reason_codes
  );
end;
$$;

revoke all on function customer_api.get_product_capability_decision_v1(
  uuid, uuid, text
) from public, anon, authenticated, service_role;
grant execute on function customer_api.get_product_capability_decision_v1(
  uuid, uuid, text
) to authenticated;

comment on function customer_api.get_product_capability_decision_v1(uuid, uuid, text) is
  'PC-01 read-only services_catalog capability projection. AUTH-01 bounds disclosure; product availability, activation and action authorization remain separate.';

commit;
