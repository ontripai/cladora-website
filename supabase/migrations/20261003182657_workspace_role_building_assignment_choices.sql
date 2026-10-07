begin;

-- Add physical choices without changing the AIRPROP workspace assignment contract.
create function customer_api.list_workspace_role_assignment_candidates_v2(p_context_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare a record; buildings jsonb; members jsonb;
begin
  select * into a from app_private.require_workspace_role_assignment_context_v1(p_context_id);
  select coalesce(jsonb_agg(jsonb_build_object('building_id',b.id,'property_id',b.property_id,'name',b.name) order by b.name,b.id),'[]'::jsonb)
  into buildings from portfolio.buildings b
  where b.tenant_id=a.tenant_id
    and app_private.context_covers_workspace_target_v1(p_context_id,'building',b.id)
    and exists(select 1 from platform.workspace_property_bindings w
      where w.customer_workspace_id=a.workspace_id and w.tenant_id=a.tenant_id and w.property_id=b.property_id
        and w.status='active' and w.valid_from<=statement_timestamp() and (w.valid_to is null or w.valid_to>statement_timestamp()));
  select coalesce(jsonb_agg(jsonb_build_object('membership_id',m.id,
    'member_name',nullif(btrim(u.raw_user_meta_data->>'full_name'),''),'role_code',r.code,
    'workspace_eligible',exists(select 1 from identity.context_grants g where g.membership_id=m.id and g.tenant_id=a.tenant_id
      and g.scope_type='tenant' and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())),
    'building_ids',(select coalesce(jsonb_agg(x->>'building_id'),'[]'::jsonb) from jsonb_array_elements(buildings) x
      where exists(select 1 from identity.context_grants g where g.membership_id=m.id and g.tenant_id=a.tenant_id
        and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
        and (g.scope_type='tenant' or (g.scope_type='property' and g.property_id=(x->>'property_id')::uuid)
          or (g.scope_type='building' and g.building_id=(x->>'building_id')::uuid
            and (g.property_id is null or g.property_id=(x->>'property_id')::uuid)))))
    ) order by m.id),'[]'::jsonb) into members
  from identity.memberships m join identity.roles r on r.id=m.role_id and (r.tenant_id is null or r.tenant_id=m.tenant_id)
  join auth.users u on u.id=m.user_id
  where m.tenant_id=a.tenant_id and m.status='active' and m.starts_at<=statement_timestamp()
    and (m.ends_at is null or m.ends_at>statement_timestamp())
    and exists(select 1 from identity.context_grants g where g.membership_id=m.id and g.tenant_id=a.tenant_id
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and (g.scope_type='tenant' or exists(select 1 from jsonb_array_elements(buildings) x
        where (g.scope_type='property' and g.property_id=(x->>'property_id')::uuid)
          or (g.scope_type='building' and g.building_id=(x->>'building_id')::uuid
            and (g.property_id is null or g.property_id=(x->>'property_id')::uuid)))));
  return jsonb_build_object('workspace_id',a.workspace_id,'members',members,'buildings',buildings);
end;
$$;
revoke all on function customer_api.list_workspace_role_assignment_candidates_v2(uuid) from public,anon,service_role;
grant execute on function customer_api.list_workspace_role_assignment_candidates_v2(uuid) to authenticated;

create function customer_api.assign_workspace_building_role_v1(
  p_context_id uuid,p_target_membership_id uuid,p_workspace_role_id uuid,p_scope_type text,
  p_property_id uuid,p_building_id uuid,p_unit_id uuid,p_valid_until timestamptz,p_reason text,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog
as $$
declare a record; response jsonb;
begin
  select * into a from app_private.require_workspace_role_assignment_context_v1(p_context_id);
  perform pg_advisory_xact_lock(hashtextextended('workspace_role_command:' || a.tenant_id::text || ':' || p_idempotency_key,0));
  select * into a from app_private.require_workspace_role_assignment_context_v1(p_context_id);
  if p_scope_type is distinct from 'building' or p_property_id is null or p_building_id is null or p_unit_id is not null then
    raise exception 'workspace_building_scope_invalid' using errcode='22023';
  end if;
  if not app_private.context_covers_workspace_target_v1(p_context_id,'building',p_building_id)
    or not exists(select 1 from portfolio.buildings b where b.id=p_building_id and b.property_id=p_property_id and b.tenant_id=a.tenant_id) then
    raise exception 'workspace_building_context_required' using errcode='42501';
  end if;
  if not exists(select 1 from identity.context_grants g where g.membership_id=p_target_membership_id and g.tenant_id=a.tenant_id
    and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
    and (g.scope_type='tenant' or (g.scope_type='property' and g.property_id=p_property_id)
      or (g.scope_type='building' and g.building_id=p_building_id and (g.property_id is null or g.property_id=p_property_id)))) then
    raise exception 'workspace_building_member_context_required' using errcode='42501';
  end if;
  response := customer_api.assign_workspace_role_v1(p_context_id,p_target_membership_id,p_workspace_role_id,
    p_scope_type,p_property_id,p_building_id,p_unit_id,p_valid_until,p_reason,p_idempotency_key);
  return response || jsonb_build_object('property_id',p_property_id,'building_id',p_building_id,'unit_id',null);
end;
$$;
revoke all on function customer_api.assign_workspace_building_role_v1(uuid,uuid,uuid,text,uuid,uuid,uuid,timestamptz,text,text) from public,anon,service_role;
grant execute on function customer_api.assign_workspace_building_role_v1(uuid,uuid,uuid,text,uuid,uuid,uuid,timestamptz,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
