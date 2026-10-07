begin;
create table platform.case_workspace_preparations (
  case_id uuid not null references platform.customer_cases(id) on delete restrict,
  customer_workspace_id uuid primary key references platform.customer_workspaces(id) on delete restrict,
  prepared_by uuid not null references auth.users(id) on delete restrict,
  prepared_at timestamptz not null default statement_timestamp()
);
create index case_workspace_preparations_case_idx on platform.case_workspace_preparations(case_id,prepared_at);
alter table platform.case_workspace_preparations enable row level security;
revoke all on platform.case_workspace_preparations from public,anon,authenticated;

create or replace function customer_api.create_case_workspace_v1(
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
  insert into platform.case_workspace_preparations(case_id,customer_workspace_id,prepared_by)
  values(p_case_id,v_workspace.id,auth.uid());
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
  values(auth.uid(),'PLATFORM_CONTROL_PLANE','CASE_WORKSPACE_PREPARED','customer_workspace',
    v_workspace.id,btrim(p_reason),jsonb_build_object('case_id',p_case_id,'tenant_id',v_tenant,
      'profile',p_profile_code,'model',p_model_code));
  return jsonb_build_object('workspace_id',v_workspace.id,'tenant_id',v_tenant,'status','LEAD');
end $$;

create function customer_api.list_case_prepared_workspaces_v1(p_case_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not (app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or app_private.has_platform_role('PLATFORM_OPERATIONS')) then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if not exists (select 1 from platform.customer_cases
    where id=p_case_id and status='open') then
    raise exception 'case_unavailable' using errcode='22023';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'workspace_id',w.id,'workspace_type',w.workspace_type,'lifecycle_status',w.lifecycle_status,
    'environment',w.environment,'commercial_owner',w.commercial_owner,
    'tenant_id',w.tenant_id,'customer_email',c.customer_email,'prepared_at',p.prepared_at,
    'profile',profile.code,'model',model.code,
    'approval_mode',basis.mode,'contract_id',basis.contract_id,
    'approval_ready',basis.id is not null,'linked',link.customer_workspace_id is not null)
    order by p.prepared_at,w.id),'[]'::jsonb)
    from platform.case_workspace_preparations p
    join platform.customer_cases c on c.id=p.case_id
    join platform.customer_workspaces w on w.id=p.customer_workspace_id
    left join platform.workspace_taxonomy_assignments a on a.customer_workspace_id=w.id and a.status='active'
    left join platform.property_profiles profile on profile.id=a.property_profile_id
    left join platform.operating_models model on model.id=a.operating_model_id
    left join platform.customer_case_workspace_links link on link.case_id=p.case_id
      and link.customer_workspace_id=w.id
    left join lateral (select b.id,b.mode,b.contract_id
      from platform.workspace_access_bases b
      where b.customer_workspace_id=w.id and b.normalized_email=c.customer_email
        and b.status in ('prepared','active')
        and (b.mode='PILOT' or (b.mode='PAID' and exists (
          select 1 from platform.workspace_contracts contract
          where contract.id=b.contract_id and contract.customer_workspace_id=w.id
            and contract.status='active' and contract.signed_at is not null)))
      order by b.approved_at desc limit 1) basis on true
    where p.case_id=p_case_id);
end $$;

revoke all on function customer_api.list_case_prepared_workspaces_v1(uuid) from public,anon,service_role;
grant execute on function customer_api.list_case_prepared_workspaces_v1(uuid) to authenticated;
commit;
