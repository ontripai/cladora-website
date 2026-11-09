-- INACTIVE Core candidate, not an installer. No historical adoption or privilege grant.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='3s';
SET LOCAL statement_timeout='30s';
DO $proposal$ BEGIN RAISE EXCEPTION 'listing_companion_adoption_required' USING ERRCODE='55000';END $proposal$;
-- Do not strip the guard. Platform needs exact owner/ACL/writer coverage review.
ALTER TABLE portfolio.parties ADD COLUMN native_revision_v1 bigint;
ALTER TABLE portfolio.parties ADD CONSTRAINT core_listing_party_revision_range_v1 CHECK(native_revision_v1 IS NULL OR native_revision_v1 BETWEEN 1 AND 9007199254740991);
-- Reuse the SAME row-version function from the ownership proposal; no new registry.
CREATE TRIGGER zz_core_listing_party_revision_v1 BEFORE INSERT OR UPDATE ON portfolio.parties FOR EACH ROW EXECUTE FUNCTION app_private.core_listing_ownership_revision_v1();
ALTER TABLE portfolio.parties ENABLE ALWAYS TRIGGER zz_core_listing_party_revision_v1;
-- Extend BEFORE-statement invalidation to latest-spec INSERT and ancestry/label edits.
CREATE TRIGGER aa_core_listing_source_epoch_v1 BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON portfolio.properties FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_canonical_authority_revision_v1();
ALTER TABLE portfolio.properties ENABLE ALWAYS TRIGGER aa_core_listing_source_epoch_v1;
CREATE TRIGGER aa_core_listing_source_epoch_v1 BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON portfolio.buildings FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_canonical_authority_revision_v1();
ALTER TABLE portfolio.buildings ENABLE ALWAYS TRIGGER aa_core_listing_source_epoch_v1;
CREATE TRIGGER aa_core_listing_source_epoch_v1 BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON portfolio.units FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_canonical_authority_revision_v1();
ALTER TABLE portfolio.units ENABLE ALWAYS TRIGGER aa_core_listing_source_epoch_v1;
CREATE TRIGGER aa_core_listing_source_epoch_v1 BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON portfolio.unit_specification_versions FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_canonical_authority_revision_v1();
ALTER TABLE portfolio.unit_specification_versions ENABLE ALWAYS TRIGGER aa_core_listing_source_epoch_v1;
CREATE TRIGGER aa_core_listing_source_epoch_v1 BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON portfolio.unit_lineage_events FOR EACH STATEMENT EXECUTE FUNCTION app_private.bump_canonical_authority_revision_v1();
ALTER TABLE portfolio.unit_lineage_events ENABLE ALWAYS TRIGGER aa_core_listing_source_epoch_v1;

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
 -- CORE_LISTING_SOURCE_BARRIER16_BEGIN
 -- Lock BEFORE Property/Unit/source rows; existing statement trigger owns bumps.
 perform 1 from app_private.canonical_authority_revision_v1 where singleton for update;
 if not found then raise exception 'canonical_authority_revision_unavailable' using errcode='55000';end if;
 -- CORE_LISTING_SOURCE_BARRIER16_END
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
 -- CORE_LISTING_SOURCE_BARRIER16_BEGIN
 -- Lock BEFORE Property/Unit/source rows; existing statement trigger owns bumps.
 perform 1 from app_private.canonical_authority_revision_v1 where singleton for update;
 if not found then raise exception 'canonical_authority_revision_unavailable' using errcode='55000';end if;
 -- CORE_LISTING_SOURCE_BARRIER16_END
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
-- Existing AFTER invalidators remain; monotone epoch may bump more than once.
ROLLBACK;
