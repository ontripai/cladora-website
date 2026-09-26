begin;

-- Creation is scoped to an open customer case with a previously linked tenant.
-- The new workspace remains LEAD and cannot be linked to the case until its
-- own commercial access basis has been approved.
create function customer_api.create_case_workspace_v1(
  p_case_id uuid, p_workspace_type text, p_profile_code text,
  p_model_code text, p_commercial_owner text, p_reason text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_case platform.customer_cases; v_tenant uuid;
  v_profile platform.property_profiles; v_model platform.operating_models;
  v_workspace platform.customer_workspaces; v_compat text;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not (app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or app_private.has_platform_role('PLATFORM_OPERATIONS')) then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if p_workspace_type not in ('ASSOCIATION','PROPERTY_MANAGER','OWNER_PORTFOLIO','HYBRID')
    or length(btrim(coalesce(p_commercial_owner,'')))<3 or length(p_commercial_owner)>200
    or length(btrim(coalesce(p_reason,'')))<8 or length(p_reason)>500 then
    raise exception 'invalid_workspace_request' using errcode='22023';
  end if;
  select * into v_case from platform.customer_cases where id=p_case_id and status='open' for update;
  if not found or v_case.customer_workspace_id is null then
    raise exception 'linked_case_required' using errcode='22023';
  end if;
  select tenant_id into v_tenant from platform.customer_workspaces
  where id=v_case.customer_workspace_id and archived_at is null;
  if v_tenant is null then raise exception 'case_tenant_unavailable' using errcode='22023'; end if;
  select * into v_profile from platform.property_profiles where code=p_profile_code
    and is_active and lifecycle_status='active' and valid_from<=statement_timestamp()
    and (valid_to is null or valid_to>statement_timestamp())
  order by version desc limit 1;
  select * into v_model from platform.operating_models where code=p_model_code
    and is_active and lifecycle_status='active' and valid_from<=statement_timestamp()
    and (valid_to is null or valid_to>statement_timestamp())
  order by version desc limit 1;
  if v_profile.id is null or v_model.id is null then
    raise exception 'active_taxonomy_required' using errcode='22023';
  end if;
  select compatibility_level into v_compat from platform.property_operating_model_compatibilities
  where property_profile_id=v_profile.id and operating_model_id=v_model.id
  order by rule_version desc limit 1;
  if v_compat is distinct from 'compatible' then
    raise exception 'compatible_taxonomy_required' using errcode='22023';
  end if;
  if (p_workspace_type='ASSOCIATION') <> (p_model_code='association_managed') then
    raise exception 'workspace_model_mismatch' using errcode='22023';
  end if;
  select * into v_workspace from platform.create_customer_workspace(
    v_tenant,p_workspace_type::platform.workspace_type,btrim(p_commercial_owner),'PILOT');
  insert into platform.workspace_taxonomy_assignments
    (tenant_id,customer_workspace_id,property_profile_id,operating_model_id,notes,created_by)
  values (v_tenant,v_workspace.id,v_profile.id,v_model.id,btrim(p_reason),auth.uid());
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
  values(auth.uid(),'PLATFORM_CONTROL_PLANE','CASE_WORKSPACE_PREPARED','customer_workspace',
    v_workspace.id,btrim(p_reason),jsonb_build_object('case_id',p_case_id,'tenant_id',v_tenant,
      'profile',p_profile_code,'model',p_model_code));
  return jsonb_build_object('workspace_id',v_workspace.id,'tenant_id',v_tenant,'status','LEAD');
end $$;

create function customer_api.list_case_workspace_options_v1(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not (app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or app_private.has_platform_role('PLATFORM_OPERATIONS')) then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if not exists (select 1 from platform.customer_cases where id=p_case_id
    and status='open' and customer_workspace_id is not null) then
    raise exception 'linked_case_required' using errcode='22023';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('profile',p.code,
    'profile_label',p.labels_json,'model',m.code,'model_label',m.labels_json)
    order by p.code,m.code),'[]'::jsonb)
    from platform.property_profiles p
    join platform.property_operating_model_compatibilities c on c.property_profile_id=p.id
    join platform.operating_models m on m.id=c.operating_model_id
    where p.is_active and p.lifecycle_status='active'
      and m.is_active and m.lifecycle_status='active'
      and p.valid_from<=statement_timestamp() and (p.valid_to is null or p.valid_to>statement_timestamp())
      and m.valid_from<=statement_timestamp() and (m.valid_to is null or m.valid_to>statement_timestamp())
      and c.compatibility_level='compatible' and c.rule_version=(
        select max(x.rule_version) from platform.property_operating_model_compatibilities x
        where x.property_profile_id=p.id and x.operating_model_id=m.id));
end $$;

revoke all on function customer_api.create_case_workspace_v1(uuid,text,text,text,text,text),
  customer_api.list_case_workspace_options_v1(uuid) from public,anon,service_role;
grant execute on function customer_api.create_case_workspace_v1(uuid,text,text,text,text,text),
  customer_api.list_case_workspace_options_v1(uuid) to authenticated;
commit;
