begin;

-- PF-01 minimal vertical slice. This is a read-only collection of the existing
-- owner-portfolio-projection.v1 envelope, one envelope per source Workspace.
-- It reuses owner links/ownerships, AUTH-01, DW-02 and the single accepted
-- PC-01 capability; it creates no owner, Unit, relationship or ledger state.
create function customer_api.list_my_owner_portfolio_projections_v1(
  p_expected_unit_versions jsonb
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := statement_timestamp();
  v_candidate record;
  v_requested_version integer;
  v_reference jsonb;
  v_product jsonb;
  v_action jsonb;
  v_item jsonb;
  v_items_by_workspace jsonb := '{}'::jsonb;
  v_context_by_workspace jsonb := '{}'::jsonb;
  v_result jsonb;
begin
  if v_actor is null or not app_private.has_multi_unit_owner_role_v1() then
    raise exception 'pf01_owner_portfolio_access_denied' using errcode = '42501';
  end if;
  if p_expected_unit_versions is null
     or jsonb_typeof(p_expected_unit_versions) <> 'object'
     or exists (
       select 1
       from jsonb_each_text(p_expected_unit_versions) e
       where e.key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          or e.value !~ '^[1-9][0-9]{0,8}$'
     )
     or (select count(*) from jsonb_object_keys(p_expected_unit_versions)) > 100 then
    raise exception 'pf01_owner_portfolio_input_invalid' using errcode = '22023';
  end if;

  for v_candidate in
    select distinct on (l.id)
      l.id as link_id,
      l.workspace_id,
      l.canonical_unit_id,
      o.id as ownership_id,
      o.tenant_id,
      o.party_id,
      p.type::text as party_kind,
      o.valid_from,
      o.valid_to,
      g.id as context_id,
      greatest(1, coalesce((
        select max(s.version)
        from portfolio.unit_specification_versions s
        where s.tenant_id = u.tenant_id and s.unit_id = u.id
      ), 0))::integer as current_unit_version
    from platform.owner_unit_links l
    join public.owner_private_units pu
      on pu.id = l.private_unit_id
     and pu.owner_user_id = l.owner_user_id
     and pu.status = 'active'
    join platform.customer_workspaces w
      on w.id = l.workspace_id
     and w.lifecycle_status = 'ACTIVE'
    join portfolio.units u
      on u.id = l.canonical_unit_id
     and u.tenant_id = w.tenant_id
     and u.status = 'active'
    join portfolio.ownerships o
      on o.tenant_id = u.tenant_id
     and o.unit_id = u.id
     and o.party_id = l.ownership_party_id
     and o.valid_from <= current_date
     and (o.valid_to is null or o.valid_to > current_date)
    join portfolio.parties p
      on p.id = o.party_id
     and p.tenant_id = o.tenant_id
     and p.archived_at is null
    join identity.memberships m
      on m.user_id = v_actor
     and m.tenant_id = w.tenant_id
     and m.status = 'active'
     and m.starts_at <= v_now
     and (m.ends_at is null or m.ends_at > v_now)
    join identity.context_grants g
      on g.membership_id = m.id
     and g.tenant_id = m.tenant_id
     and g.scope_type = 'tenant'
     and g.property_id is null
     and g.building_id is null
     and g.unit_id is null
     and g.starts_at <= v_now
     and (g.ends_at is null or g.ends_at > v_now)
    where l.owner_user_id = v_actor
      and l.status = 'linked'
      and app_private.native_workspace_scope_for_membership_v2(g.id, m.id, w.id)
    order by l.id, g.id
    limit 100
  loop
    v_requested_version := coalesce(
      (p_expected_unit_versions ->> v_candidate.canonical_unit_id::text)::integer,
      v_candidate.current_unit_version
    );

    v_reference := customer_api.resolve_canonical_resource_reference_v1(
      v_candidate.context_id,
      v_candidate.workspace_id,
      'unit',
      v_candidate.canonical_unit_id,
      v_requested_version,
      'core.units.identity.read',
      'core.unit_identity.history'
    );
    if v_reference->>'reference_status' not in ('verified', 'stale') then
      continue;
    end if;

    v_action := jsonb_build_object(
      'action_status', 'withheld',
      'action_code', null,
      'domain_owner', null,
      'href', null,
      'required_permission', null,
      'product_decision_reference', null,
      'authority_decision_reference', null,
      'current_authority_recheck_required', true,
      'reason_codes', jsonb_build_array(
        case when v_reference->>'reference_status' = 'stale'
          then 'canonical_unit_version_stale'
          else 'pc01_capability_or_auth01_unavailable'
        end
      )
    );

    if v_reference->>'reference_status' = 'verified' then
      begin
        v_product := customer_api.get_product_capability_decision_v1(
          v_candidate.context_id,
          v_candidate.workspace_id,
          'module.services_catalog'
        );
      exception when others then
        v_product := null;
      end;
      if v_product->>'product_availability' = 'available'
         and v_product->'activation'->>'status' = 'active'
         and app_private.check_workspace_native_permission_v2(
           v_candidate.context_id,
           v_candidate.workspace_id,
           'services.catalog.read',
           'services_catalog'
         ) is true then
        v_action := jsonb_build_object(
          'action_status', 'allowed',
          'action_code', 'service.catalog.browse',
          'domain_owner', 'service',
          'href', '/app/services',
          'required_permission', 'services.catalog.read',
          'product_decision_reference',
            'product-capability-decision.v1:module.services_catalog:' || v_candidate.workspace_id::text,
          'authority_decision_reference',
            'auth01:' || v_candidate.context_id::text || ':services.catalog.read',
          'current_authority_recheck_required', true,
          'reason_codes', '[]'::jsonb
        );
      end if;
    end if;

    v_item := jsonb_build_object(
      'resource', jsonb_build_object(
        'item_kind', 'canonical_resource',
        'source', jsonb_build_object(
          'source_class', 'official_workspace_record',
          'source_reference', 'portfolio.ownerships:' || v_candidate.ownership_id::text || ':v1',
          'source_workspace_id', v_candidate.workspace_id,
          'source_context_id', v_candidate.context_id
        ),
        'canonical_reference', v_reference,
        'relationship', jsonb_build_object(
          'contract_version', 'resource-relationship.v1',
          'relationship_id', v_candidate.ownership_id,
          'relationship_version', 1,
          'tenant_id', v_candidate.tenant_id,
          'workspace_id', v_candidate.workspace_id,
          'party_id', v_candidate.party_id,
          'party_kind', v_candidate.party_kind,
          'resource_type', 'unit',
          'resource_id', v_candidate.canonical_unit_id,
          'relationship_kind', 'ownership',
          'scope_codes', jsonb_build_array('unit:' || v_candidate.canonical_unit_id::text),
          'valid_from', v_candidate.valid_from::timestamp at time zone 'UTC',
          'valid_until', case when v_candidate.valid_to is null then null
            else v_candidate.valid_to::timestamp at time zone 'UTC' end,
          'evidence_reference', 'portfolio.ownerships:' || v_candidate.ownership_id::text || ':v1',
          'relationship_status', 'effective',
          'evaluated_at', v_now,
          'action_authorization', 'not_evaluated'
        )
      ),
      'balances', '[]'::jsonb,
      'actions', jsonb_build_array(v_action)
    );

    v_items_by_workspace := jsonb_set(
      v_items_by_workspace,
      array[v_candidate.workspace_id::text],
      coalesce(v_items_by_workspace -> v_candidate.workspace_id::text, '[]'::jsonb)
        || jsonb_build_array(v_item),
      true
    );
    v_context_by_workspace := jsonb_set(
      v_context_by_workspace,
      array[v_candidate.workspace_id::text],
      to_jsonb(v_candidate.context_id),
      true
    );
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'contract_version', 'owner-portfolio-projection.v1',
    'projection_status', 'available',
    'portfolio_workspace_id', e.key::uuid,
    'owner_subject_id', v_actor,
    'as_of', v_now,
    'evaluated_at', v_now,
    'items', e.value,
    'next_cursor', null,
    'action_authorization', 'not_evaluated'
  ) order by e.key), '[]'::jsonb)
  into v_result
  from jsonb_each(v_items_by_workspace) e;

  return v_result;
end;
$$;

revoke all on function customer_api.list_my_owner_portfolio_projections_v1(jsonb)
  from public, anon, authenticated, service_role;
grant execute on function customer_api.list_my_owner_portfolio_projections_v1(jsonb)
  to authenticated;

comment on function customer_api.list_my_owner_portfolio_projections_v1(jsonb) is
  'PF-01 read-only owner portfolio projection. AUTH-01 and DW-02 recheck each canonical Unit; PC-01 may expose navigation only and never authorizes a mutation.';

commit;
