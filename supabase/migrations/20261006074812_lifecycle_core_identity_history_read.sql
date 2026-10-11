begin;

insert into identity.permissions(code,resource,action,description) values
 ('core.units.identity.read','core.units.identity','read',
  'Read private unit specification and lineage evidence from the originating workspace')
on conflict(code) do nothing;
insert into platform.module_permission_bindings
 (module_definition_id,permission_id,binding_version,permission_mode,
  is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
select m.id,p.id,1,'read',true,false,true,'active'
from platform.module_definitions m cross join identity.permissions p
where m.code='core_unit_identity' and m.version=1 and p.code='core.units.identity.read'
on conflict(module_definition_id,permission_id,binding_version) do nothing;

create function customer_api.get_core_unit_identity_history_v1(
 p_context_id uuid,p_workspace_id uuid,p_unit_id uuid
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog
as $$
declare v_tenant uuid; v_property uuid; v_mandate uuid; v_snapshots jsonb; v_lineage jsonb;
begin
 if auth.uid() is null or p_context_id is null or p_workspace_id is null or p_unit_id is null then
  raise exception 'core_unit_history_access_denied' using errcode='42501';
 end if;
 select u.tenant_id,b.property_id into v_tenant,v_property
 from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
 where u.id=p_unit_id;
 if v_property is null then raise exception 'core_unit_history_access_denied' using errcode='42501';end if;
 -- Share the property lock with mandate revocation and command writes.
 perform 1 from portfolio.properties where id=v_property and tenant_id=v_tenant for share;
 perform 1 from portfolio.units u
 join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
 where u.id=p_unit_id and u.tenant_id=v_tenant and b.property_id=v_property for share of u;
 if not found then raise exception 'core_unit_history_access_denied' using errcode='42501';end if;
 if app_private.current_workspace_property_mandate_v1(
    p_context_id,p_workspace_id,v_property,'property_operations') is null
    or app_private.check_workspace_native_permission_v2(
    p_context_id,p_workspace_id,'core.units.identity.read','core_unit_identity') is not true then
  raise exception 'core_unit_history_access_denied' using errcode='42501';
 end if;
 select id into v_mandate from platform.workspace_property_authorities
 where property_id=v_property and customer_workspace_id=p_workspace_id and tenant_id=v_tenant
   and purpose='property_operations' and status='active' and valid_from<=clock_timestamp()
   and (valid_to is null or valid_to>clock_timestamp()) for share;
 if v_mandate is null then raise exception 'core_unit_history_access_denied' using errcode='42501';end if;
 -- NULL provenance is internal history and is never exposed by this command.
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',s.id,'version',s.version,'unit_code',s.unit_code,'floor',s.floor,
  'area_m2',s.area_m2,'bedrooms',s.bedrooms,'source_reference',s.source_reference,
  'recorded_at',s.recorded_at) order by s.version),'[]'::jsonb) into v_snapshots
 from portfolio.unit_specification_versions s
 where s.unit_id=p_unit_id and s.tenant_id=v_tenant and s.customer_workspace_id=p_workspace_id;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',e.id,'kind',e.kind,'predecessor_unit_ids',e.predecessor_unit_ids,
  'successor_unit_ids',e.successor_unit_ids,'source_reference',e.source_reference,
  'recorded_at',e.recorded_at) order by e.recorded_at,e.id),'[]'::jsonb) into v_lineage
 from portfolio.unit_lineage_events e
 where e.property_id=v_property and e.tenant_id=v_tenant
   and e.customer_workspace_id=p_workspace_id
   and (p_unit_id=any(e.predecessor_unit_ids) or p_unit_id=any(e.successor_unit_ids));
 return jsonb_build_object('unit_id',p_unit_id,'snapshots',v_snapshots,'lineage',v_lineage);
end;
$$;
revoke all on function customer_api.get_core_unit_identity_history_v1(uuid,uuid,uuid)
 from public,anon,service_role;
grant execute on function customer_api.get_core_unit_identity_history_v1(uuid,uuid,uuid)
 to authenticated;
comment on function customer_api.get_core_unit_identity_history_v1(uuid,uuid,uuid) is
 'Exact live mandate and Core read permission; returns only evidence attributed to the caller workspace. No internal or other workspace history is exposed.';
commit;
