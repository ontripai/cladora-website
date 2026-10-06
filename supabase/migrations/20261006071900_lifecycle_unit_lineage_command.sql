begin;

-- A separate assignable right within the existing Core identity module.
insert into identity.permissions(code,resource,action,description) values
 ('core.units.lineage.record','core.units.lineage','record',
  'Record an immutable unit split or merge event')
on conflict(code) do nothing;
insert into platform.module_permission_bindings
 (module_definition_id,permission_id,binding_version,permission_mode,
  is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
select m.id,p.id,1,'manage',true,false,true,'active'
from platform.module_definitions m cross join identity.permissions p
where m.code='core_unit_identity' and m.version=1 and p.code='core.units.lineage.record'
on conflict(module_definition_id,permission_id,binding_version) do nothing;

create function customer_api.record_core_unit_lineage_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_kind text,
 p_predecessor_unit_ids uuid[],p_successor_unit_ids uuid[],p_source_reference text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog
as $$
declare v_tenant uuid; v_mandate uuid; v_id uuid;
begin
 if auth.uid() is null or p_context_id is null or p_workspace_id is null or p_property_id is null
    or p_kind not in ('split','merge') or p_kind is null
    or p_predecessor_unit_ids is null or p_successor_unit_ids is null
    or cardinality(p_predecessor_unit_ids) not between 1 and 100
    or cardinality(p_successor_unit_ids) not between 1 and 100
    or (p_kind='split' and (cardinality(p_predecessor_unit_ids)<>1 or cardinality(p_successor_unit_ids)<2))
    or (p_kind='merge' and (cardinality(p_predecessor_unit_ids)<2 or cardinality(p_successor_unit_ids)<>1))
    or p_source_reference is null or length(btrim(p_source_reference)) not between 1 and 500 then
  raise exception 'core_unit_lineage_invalid' using errcode='22023';
 end if;
 -- Share the same property lock as the graph guard and mandate revocation.
 select tenant_id into v_tenant from portfolio.properties where id=p_property_id for update;
 if v_tenant is null or app_private.current_workspace_property_mandate_v1(
    p_context_id,p_workspace_id,p_property_id,'property_operations') is null
    or app_private.check_workspace_native_permission_v2(
    p_context_id,p_workspace_id,'core.units.lineage.record','core_unit_identity') is not true then
  raise exception 'core_unit_lineage_access_denied' using errcode='42501';
 end if;
 select id into v_mandate from platform.workspace_property_authorities
 where property_id=p_property_id and customer_workspace_id=p_workspace_id and tenant_id=v_tenant
   and purpose='property_operations' and status='active' and valid_from<=clock_timestamp()
   and (valid_to is null or valid_to>clock_timestamp()) for share;
 if v_mandate is null then raise exception 'core_unit_lineage_access_denied' using errcode='42501';end if;
 insert into portfolio.unit_lineage_events
  (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by)
 values(v_tenant,p_property_id,p_kind,p_predecessor_unit_ids,p_successor_unit_ids,
  p_source_reference,auth.uid()) returning id into v_id;
 return jsonb_build_object('event_id',v_id,'property_id',p_property_id,'kind',p_kind);
end;
$$;
revoke all on function customer_api.record_core_unit_lineage_v1
 (uuid,uuid,uuid,text,uuid[],uuid[],text) from public,anon,service_role;
grant execute on function customer_api.record_core_unit_lineage_v1
 (uuid,uuid,uuid,text,uuid[],uuid[],text) to authenticated;
comment on function customer_api.record_core_unit_lineage_v1
 (uuid,uuid,uuid,text,uuid[],uuid[],text) is
 'Exact workspace/property mandate and Core module permission gated split/merge evidence; canonical units and historical references remain unchanged.';
commit;
