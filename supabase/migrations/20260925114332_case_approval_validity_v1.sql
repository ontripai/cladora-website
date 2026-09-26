begin;
create or replace function customer_api.link_customer_case_workspace_v1(
  p_case_id uuid,p_workspace_id uuid,p_contract_id uuid,p_reason text
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v_case platform.customer_cases; v_basis platform.workspace_access_bases;
  v_workspace platform.customer_workspaces; v_primary platform.customer_workspaces;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not (app_private.has_platform_role('PLATFORM_SUPER_ADMIN')
    or app_private.has_platform_role('PLATFORM_OPERATIONS')) then
    raise exception 'access_denied' using errcode='42501';
  end if;
  if length(trim(coalesce(p_reason,'')))<8 or length(p_reason)>500 then
    raise exception 'invalid_reason' using errcode='22023';
  end if;
  select * into v_case from platform.customer_cases where id=p_case_id and status='open' for update;
  if not found then raise exception 'case_unavailable' using errcode='22023'; end if;
  if exists(select 1 from platform.customer_case_workspace_links l
    where l.case_id=p_case_id and l.customer_workspace_id=p_workspace_id) then
    raise exception 'workspace_already_linked' using errcode='23505';
  end if;
  -- An existing customer-specific commercial approval is mandatory for EVERY
  -- link; no membership, account, contract or workspace is created here.
  select * into v_basis from platform.workspace_access_bases
  where customer_workspace_id=p_workspace_id and normalized_email=v_case.customer_email
    and status in ('prepared','active')
    and ((status='prepared' and approved_at+interval '7 days'>statement_timestamp())
      or (status='active' and expires_at>statement_timestamp())) and
    ((mode='PILOT' and p_contract_id is null) or
      (mode='PAID' and contract_id=p_contract_id and p_contract_id is not null
        and paid_through >= (statement_timestamp() at time zone 'Europe/Bucharest')::date))
  order by approved_at desc limit 1;
  if not found then raise exception 'approved_access_basis_required' using errcode='42501'; end if;
  select * into v_workspace from platform.customer_workspaces where id=p_workspace_id;
  if not found or v_workspace.archived_at is not null or v_workspace.lifecycle_status in ('TERMINATED','ARCHIVED') then
    raise exception 'workspace_unavailable' using errcode='22023';
  end if;
  if v_case.customer_workspace_id is not null then
    select * into v_primary from platform.customer_workspaces where id=v_case.customer_workspace_id;
    if v_primary.tenant_id <> v_workspace.tenant_id then
      raise exception 'case_workspace_tenant_mismatch' using errcode='42501';
    end if;
  end if;
  if p_contract_id is not null and not exists (
    select 1 from platform.workspace_contracts c where c.id=p_contract_id
      and c.customer_workspace_id=p_workspace_id and c.status='active'
      and c.signed_at is not null
  ) then raise exception 'active_signed_contract_required' using errcode='42501'; end if;
  insert into platform.customer_case_workspace_links(case_id,customer_workspace_id,contract_id,access_basis_id,linked_by,reason)
  values(p_case_id,p_workspace_id,p_contract_id,v_basis.id,auth.uid(),trim(p_reason));
  if v_case.customer_workspace_id is null then
    update platform.customer_cases set customer_workspace_id=p_workspace_id,
      contract_id=p_contract_id,linked_at=statement_timestamp() where id=v_case.id;
  end if;
  insert into audit.events(actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
  values(auth.uid(),'PLATFORM_CONTROL_PLANE','CUSTOMER_CASE_LINKED','customer_case',v_case.id,
    trim(p_reason),jsonb_build_object('workspace_id',p_workspace_id,'contract_id',p_contract_id,'basis_id',v_basis.id));
  return jsonb_build_object('case_id',v_case.id,'workspace_id',p_workspace_id,
    'contract_id',p_contract_id);
end $$;

create or replace function customer_api.list_case_prepared_workspaces_v1(p_case_id uuid)
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
        and ((b.status='prepared' and b.approved_at+interval '7 days'>statement_timestamp())
          or (b.status='active' and b.expires_at>statement_timestamp()))
        and (b.mode='PILOT' or (b.mode='PAID' and exists (
          select 1 from platform.workspace_contracts contract
          where contract.id=b.contract_id and contract.customer_workspace_id=w.id
            and contract.status='active' and contract.signed_at is not null
            and b.paid_through >= (statement_timestamp() at time zone 'Europe/Bucharest')::date)))
      order by b.approved_at desc limit 1) basis on true
    where p.case_id=p_case_id);
end $$;

commit;
