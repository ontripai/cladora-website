begin;

-- Historical internal evidence remains private with NULL provenance; only
-- customer commands assign an explicit workspace to newly written evidence.
alter table portfolio.unit_specification_versions
 add column customer_workspace_id uuid references platform.customer_workspaces(id) on delete restrict;
alter table portfolio.unit_lineage_events
 add column customer_workspace_id uuid references platform.customer_workspaces(id) on delete restrict;
create index unit_specification_versions_workspace_idx
 on portfolio.unit_specification_versions(customer_workspace_id,unit_id,version desc)
 where customer_workspace_id is not null;
create index unit_lineage_events_workspace_idx
 on portfolio.unit_lineage_events(customer_workspace_id,property_id,recorded_at)
 where customer_workspace_id is not null;

create function app_private.guard_core_evidence_workspace_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
 if new.customer_workspace_id is not null and not exists (
  select 1 from platform.customer_workspaces w
  where w.id=new.customer_workspace_id and w.tenant_id=new.tenant_id
 ) then
  raise exception 'core_evidence_workspace_mismatch' using errcode='42501';
 end if;
 return new;
end;
$$;
create trigger guard_core_evidence_workspace
 before insert on portfolio.unit_specification_versions
 for each row execute function app_private.guard_core_evidence_workspace_v1();
create trigger guard_core_evidence_workspace
 before insert on portfolio.unit_lineage_events
 for each row execute function app_private.guard_core_evidence_workspace_v1();
revoke all on function app_private.guard_core_evidence_workspace_v1()
 from public,anon,authenticated,service_role;

create or replace function customer_api.record_core_unit_specification_v1(
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
  (tenant_id,unit_id,version,building_id,unit_code,floor,area_m2,bedrooms,source_reference,recorded_by,customer_workspace_id)
 values(v_tenant,p_unit_id,v_version+1,v_unit.building_id,p_unit_code,p_floor,p_area_m2,p_bedrooms,
  p_source_reference,auth.uid(),p_workspace_id) returning id into v_id;
 return jsonb_build_object('snapshot_id',v_id,'unit_id',p_unit_id,'version',v_version+1);
end;
$$;

create or replace function customer_api.record_core_unit_lineage_v1(
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
  (tenant_id,property_id,kind,predecessor_unit_ids,successor_unit_ids,source_reference,recorded_by,customer_workspace_id)
 values(v_tenant,p_property_id,p_kind,p_predecessor_unit_ids,p_successor_unit_ids,
  p_source_reference,auth.uid(),p_workspace_id) returning id into v_id;
 return jsonb_build_object('event_id',v_id,'property_id',p_property_id,'kind',p_kind);
end;
$$;

comment on column portfolio.unit_specification_versions.customer_workspace_id is
 'Originating workspace for customer-command evidence; NULL for internal history with no attributable workspace.';
comment on column portfolio.unit_lineage_events.customer_workspace_id is
 'Originating workspace for customer-command evidence; NULL for internal history with no attributable workspace.';
commit;
