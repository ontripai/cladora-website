begin;

-- Serialize a retry against the exact property and recheck live authority
-- before returning even a previously committed result.
create function app_private.claim_core_unit_idempotency_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_operation text,
 p_request_id uuid,p_idempotency_key text,p_payload jsonb
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_tenant uuid; v_permission text; v_key text; v_hash text; v_claim platform.idempotency_keys%rowtype;
begin
 if auth.uid() is null or p_context_id is null or p_workspace_id is null or p_property_id is null
    or p_request_id is null or p_idempotency_key is null
    or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    or p_operation not in ('specification','lineage') or p_operation is null then
  raise exception 'core_unit_request_invalid' using errcode='22023';
 end if;
 v_permission:=case p_operation when 'specification' then 'core.units.specifications.record'
   else 'core.units.lineage.record' end;
 select tenant_id into v_tenant from portfolio.properties where id=p_property_id for update;
 if v_tenant is null or app_private.current_workspace_property_mandate_v1(
    p_context_id,p_workspace_id,p_property_id,'property_operations') is null
    or app_private.check_workspace_native_permission_v2(
    p_context_id,p_workspace_id,v_permission,'core_unit_identity') is not true then
  raise exception 'core_unit_request_access_denied' using errcode='42501';
 end if;
 perform 1 from platform.workspace_property_authorities
 where property_id=p_property_id and customer_workspace_id=p_workspace_id and tenant_id=v_tenant
   and purpose='property_operations' and status='active' and valid_from<=clock_timestamp()
   and (valid_to is null or valid_to>clock_timestamp()) for share;
 if not found then raise exception 'core_unit_request_access_denied' using errcode='42501';end if;
 v_key:='core.unit.'||p_operation||'.v2/'||p_workspace_id||'/'||p_request_id||'/'||p_idempotency_key;
 v_hash:=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),
   'context',p_context_id,'workspace',p_workspace_id,'property',p_property_id,
   'request_id',p_request_id,'payload',p_payload)::text,'UTF8')),'hex');
 insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at)
 values(v_tenant,auth.uid(),v_key,v_hash,statement_timestamp()+interval '30 days')
 on conflict(tenant_id,key) do nothing;
 select * into strict v_claim from platform.idempotency_keys
 where tenant_id=v_tenant and key=v_key for update;
 if v_claim.actor_id is distinct from auth.uid() or v_claim.request_hash is distinct from v_hash
    or v_claim.expires_at<=clock_timestamp() then
  raise exception 'core_unit_idempotency_conflict' using errcode='23505';
 end if;
 return v_claim.response_ref;
end;$$;
revoke all on function app_private.claim_core_unit_idempotency_v1
 (uuid,uuid,uuid,text,uuid,text,jsonb) from public,anon,authenticated,service_role;

create function customer_api.record_core_unit_specification_v2(
 p_context_id uuid,p_workspace_id uuid,p_unit_id uuid,p_expected_version integer,
 p_unit_code text,p_floor smallint,p_area_m2 numeric,p_bedrooms smallint,p_source_reference text,
 p_request_id uuid,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_property uuid; v_tenant uuid; v_prior jsonb; v_response jsonb; v_key text;
begin
 select b.property_id,p.tenant_id into v_property,v_tenant from portfolio.units u
 join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
 join portfolio.properties p on p.id=b.property_id and p.tenant_id=u.tenant_id
 where u.id=p_unit_id;
 if v_property is null then raise exception 'core_unit_request_access_denied' using errcode='42501';end if;
 v_prior:=app_private.claim_core_unit_idempotency_v1(p_context_id,p_workspace_id,v_property,
  'specification',p_request_id,p_idempotency_key,jsonb_build_object(
   'unit_id',p_unit_id,'expected_version',p_expected_version,'unit_code',p_unit_code,
   'floor',p_floor,'area_m2',p_area_m2,'bedrooms',p_bedrooms,'source_reference',p_source_reference));
 if v_prior is not null then return v_prior||jsonb_build_object('idempotent',true);end if;
 v_response:=customer_api.record_core_unit_specification_v1(p_context_id,p_workspace_id,p_unit_id,
  p_expected_version,p_unit_code,p_floor,p_area_m2,p_bedrooms,p_source_reference);
 v_key:='core.unit.specification.v2/'||p_workspace_id||'/'||p_request_id||'/'||p_idempotency_key;
 update platform.idempotency_keys set response_ref=v_response,status_code=201
 where tenant_id=v_tenant and key=v_key;
 return v_response||jsonb_build_object('idempotent',false);
end;$$;
revoke all on function customer_api.record_core_unit_specification_v2
 (uuid,uuid,uuid,integer,text,smallint,numeric,smallint,text,uuid,text) from public,anon,service_role;
grant execute on function customer_api.record_core_unit_specification_v2
 (uuid,uuid,uuid,integer,text,smallint,numeric,smallint,text,uuid,text) to authenticated;

create function customer_api.record_core_unit_lineage_v2(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_kind text,
 p_predecessor_unit_ids uuid[],p_successor_unit_ids uuid[],p_source_reference text,
 p_request_id uuid,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_tenant uuid; v_prior jsonb; v_response jsonb; v_key text;
begin
 select tenant_id into v_tenant from portfolio.properties where id=p_property_id;
 if v_tenant is null then raise exception 'core_unit_request_access_denied' using errcode='42501';end if;
 v_prior:=app_private.claim_core_unit_idempotency_v1(p_context_id,p_workspace_id,p_property_id,
  'lineage',p_request_id,p_idempotency_key,jsonb_build_object(
   'kind',p_kind,'predecessor_unit_ids',p_predecessor_unit_ids,
   'successor_unit_ids',p_successor_unit_ids,'source_reference',p_source_reference));
 if v_prior is not null then return v_prior||jsonb_build_object('idempotent',true);end if;
 v_response:=customer_api.record_core_unit_lineage_v1(p_context_id,p_workspace_id,p_property_id,
  p_kind,p_predecessor_unit_ids,p_successor_unit_ids,p_source_reference);
 v_key:='core.unit.lineage.v2/'||p_workspace_id||'/'||p_request_id||'/'||p_idempotency_key;
 update platform.idempotency_keys set response_ref=v_response,status_code=201
 where tenant_id=v_tenant and key=v_key;
 return v_response||jsonb_build_object('idempotent',false);
end;$$;
revoke all on function customer_api.record_core_unit_lineage_v2
 (uuid,uuid,uuid,text,uuid[],uuid[],text,uuid,text) from public,anon,service_role;
grant execute on function customer_api.record_core_unit_lineage_v2
 (uuid,uuid,uuid,text,uuid[],uuid[],text,uuid,text) to authenticated;

-- Existing v1 functions remain available to the owner for the v2 wrappers,
-- but can no longer be called directly by a customer without an idempotency key.
revoke execute on function customer_api.record_core_unit_specification_v1
 (uuid,uuid,uuid,integer,text,smallint,numeric,smallint,text) from authenticated;
revoke execute on function customer_api.record_core_unit_lineage_v1
 (uuid,uuid,uuid,text,uuid[],uuid[],text) from authenticated;
commit;
