begin;

-- Separate Core authority; no workspace activation or role grant is seeded.
insert into identity.permissions(code,resource,action,description) values
 ('core.units.specifications.record','core.units.specifications','record',
  'Record an immutable canonical unit specification snapshot')
on conflict(code) do nothing;
insert into platform.module_definitions
 (code,version,name,labels_json,description,category,is_active,lifecycle_status,
  sensitivity_level,requires_aal2,entitlement_key,published_at)
values('core_unit_identity',1,'Core unit identity',
 '{"ro":"Identitatea unității","en":"Unit identity","fa":"هویت واحد"}',
 'Canonical unit specification evidence; no ownership or status transfer',
 'operations',true,'published','high_impact',true,'module.core_unit_identity',statement_timestamp())
on conflict(code,version) do nothing;
insert into platform.module_permission_bindings
 (module_definition_id,permission_id,binding_version,permission_mode,
  is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
select m.id,p.id,1,'manage',true,false,true,'active'
from platform.module_definitions m cross join identity.permissions p
where m.code='core_unit_identity' and m.version=1 and p.code='core.units.specifications.record'
on conflict(module_definition_id,permission_id,binding_version) do nothing;
insert into platform.module_property_profile_compatibilities
 (module_definition_id,property_profile_id,compatibility_level,reason)
select m.id,p.id,'compatible','Canonical unit identity for existing taxonomy v1'
from platform.module_definitions m cross join platform.property_profiles p
where m.code='core_unit_identity' and m.version=1 and p.version=1
on conflict(module_definition_id,property_profile_id) do nothing;
insert into platform.module_operating_model_compatibilities
 (module_definition_id,operating_model_id,compatibility_level,reason)
select m.id,o.id,'compatible','Canonical unit identity independent of operating model'
from platform.module_definitions m cross join platform.operating_models o
where m.code='core_unit_identity' and m.version=1 and o.version=1
on conflict(module_definition_id,operating_model_id) do nothing;

create function customer_api.record_core_unit_specification_v1(
 p_context_id uuid,p_workspace_id uuid,p_unit_id uuid,p_expected_version integer,
 p_unit_code text,p_floor smallint,p_area_m2 numeric,p_bedrooms smallint,p_source_reference text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog
as $$
declare v_unit record; v_tenant uuid; v_property uuid; v_mandate uuid; v_id uuid; v_version integer;
begin
 if auth.uid() is null or p_context_id is null or p_workspace_id is null or p_unit_id is null
    or p_expected_version is null or p_expected_version < 0
    or p_unit_code is null or p_unit_code <> btrim(p_unit_code) or length(p_unit_code) not between 1 and 80
    or p_source_reference is null or length(btrim(p_source_reference)) not between 1 and 500
    or (p_area_m2 is not null and p_area_m2<=0)
    or (p_bedrooms is not null and p_bedrooms<0) then
  raise exception 'core_unit_specification_invalid' using errcode='22023';
 end if;
 select u.tenant_id,b.property_id into v_tenant,v_property
 from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
 where u.id=p_unit_id;
 if v_property is null then raise exception 'core_unit_specification_access_denied' using errcode='42501';end if;
 -- Serialize with mandate revocation (its guard locks this property) and other
 -- revisions. Recheck the actual subject after waiting for the property row.
 perform 1 from portfolio.properties where id=v_property and tenant_id=v_tenant for update;
 select u.tenant_id,u.building_id,b.property_id into v_unit
 from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
 where u.id=p_unit_id for update of u;
 if v_unit.tenant_id is distinct from v_tenant or v_unit.property_id is distinct from v_property
    or app_private.current_workspace_property_mandate_v1(
     p_context_id,p_workspace_id,v_property,'property_operations') is null
    or app_private.check_workspace_native_permission_v2(
     p_context_id,p_workspace_id,'core.units.specifications.record','core_unit_identity') is not true then
  raise exception 'core_unit_specification_access_denied' using errcode='42501';
 end if;
 select id into v_mandate from platform.workspace_property_authorities
 where property_id=v_property and customer_workspace_id=p_workspace_id and tenant_id=v_tenant
   and purpose='property_operations' and status='active' and valid_from<=clock_timestamp()
   and (valid_to is null or valid_to>clock_timestamp()) for share;
 if v_mandate is null then raise exception 'core_unit_specification_access_denied' using errcode='42501';end if;
 select coalesce(max(version),0) into v_version from portfolio.unit_specification_versions where unit_id=p_unit_id;
 if v_version<>p_expected_version then
  raise exception 'core_unit_specification_version_conflict' using errcode='40001';
 end if;
 insert into portfolio.unit_specification_versions
  (tenant_id,unit_id,version,building_id,unit_code,floor,area_m2,bedrooms,source_reference,recorded_by)
 values(v_tenant,p_unit_id,v_version+1,v_unit.building_id,p_unit_code,p_floor,p_area_m2,p_bedrooms,
  p_source_reference,auth.uid()) returning id into v_id;
 return jsonb_build_object('snapshot_id',v_id,'unit_id',p_unit_id,'version',v_version+1);
end;
$$;
revoke all on function customer_api.record_core_unit_specification_v1
 (uuid,uuid,uuid,integer,text,smallint,numeric,smallint,text) from public,anon,service_role;
grant execute on function customer_api.record_core_unit_specification_v1
 (uuid,uuid,uuid,integer,text,smallint,numeric,smallint,text) to authenticated;
comment on function customer_api.record_core_unit_specification_v1
 (uuid,uuid,uuid,integer,text,smallint,numeric,smallint,text) is
 'Exact workspace/property mandate and Core module permission gated snapshot. Does not mutate the canonical current unit or confer ownership.';
commit;
