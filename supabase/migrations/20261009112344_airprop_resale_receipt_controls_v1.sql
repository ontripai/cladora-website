begin;

-- AP04: bind an AIRPROP resale receipt to the existing immutable Core title
-- transfer. This command records commercial context; it cannot execute title.
create function airprop.protect_commercial_execution_link_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
begin
 raise exception 'airprop_commercial_execution_history_immutable' using errcode='55000';
end;$$;
revoke all on function airprop.protect_commercial_execution_link_v1()
 from public,anon,authenticated,service_role;
create trigger immutable_commercial_execution_link
 before update or delete on airprop.commercial_execution_links
 for each row execute function airprop.protect_commercial_execution_link_v1();

create or replace function customer_api.link_airprop_commercial_execution_v1(
 p_context_id uuid,p_workspace_id uuid,p_property_id uuid,p_unit_id uuid,p_kind text,
 p_core_record_id uuid,p_commercial_terms jsonb,p_effective_from date,p_effective_to date,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare
 v_actor record;
 v_type text;
 v_existing airprop.commercial_execution_links%rowtype;
 v_conflict airprop.commercial_execution_links%rowtype;
 v_row airprop.commercial_execution_links%rowtype;
 v_hash text;
 v_price numeric;
begin
 if p_kind not in('resale','lease','management_mandate') or jsonb_typeof(p_commercial_terms)<>'object'
  or p_effective_from is null or(p_effective_to is not null and p_effective_to<=p_effective_from)
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'airprop_execution_link_invalid' using errcode='22023';
 end if;
 if p_kind='resale' then
  begin
   if p_unit_id is null or p_effective_to is not null
    or jsonb_typeof(p_commercial_terms->'price')<>'string'
    or (p_commercial_terms->>'price') !~ '^(0|[1-9][0-9]{0,15})(\.[0-9]{1,4})?$'
    or jsonb_typeof(p_commercial_terms->'currency')<>'string'
    or (p_commercial_terms->>'currency') !~ '^[A-Z]{3}$' then
    raise exception 'airprop_resale_receipt_invalid' using errcode='22023';
   end if;
   v_price=(p_commercial_terms->>'price')::numeric;
   if v_price<=0 then raise exception 'airprop_resale_receipt_invalid' using errcode='22023';end if;
  exception when sqlstate '22023' then raise;
   when others then raise exception 'airprop_resale_receipt_invalid' using errcode='22023';
  end;
 end if;

 select * into v_actor from app_private.require_airprop_commercial_property_v1(
  p_context_id,p_workspace_id,p_property_id,'airprop.asset.manage');
 if p_kind='resale' then
  v_type='portfolio.ownership_transfer';
  if not exists(select 1 from portfolio.ownership_transfers where id=p_core_record_id
   and tenant_id=v_actor.tenant_id and property_id=p_property_id and unit_id=p_unit_id
   and effective_on=p_effective_from) then
   raise exception 'airprop_execution_link_core_mismatch' using errcode='22023';
  end if;
 elsif p_kind='lease' then
  v_type='occupancy.lease_handover';
  if not exists(select 1 from occupancy.lease_handover_receipts where id=p_core_record_id
   and tenant_id=v_actor.tenant_id and property_id=p_property_id and unit_id=p_unit_id
   and effective_on=p_effective_from) then
   raise exception 'airprop_execution_link_core_mismatch' using errcode='22023';
  end if;
 else
  v_type='platform.workspace_property_authority';
  if p_unit_id is not null or not exists(select 1 from platform.workspace_property_authorities
   where id=p_core_record_id and tenant_id=v_actor.tenant_id and property_id=p_property_id
   and customer_workspace_id=p_workspace_id and purpose='property_operations' and status='active'
   and valid_from<=p_effective_from::timestamptz
   and(valid_to is null or valid_to>p_effective_from::timestamptz)) then
   raise exception 'airprop_execution_link_core_mismatch' using errcode='22023';
  end if;
 end if;

 perform pg_advisory_xact_lock(hashtextextended(
  v_actor.tenant_id::text||'/'||p_kind||'/'||p_core_record_id::text,0));
 select * into v_actor from app_private.require_airprop_commercial_property_v1(
  p_context_id,p_workspace_id,p_property_id,'airprop.asset.manage');
 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'workspace',p_workspace_id,
  'property',p_property_id,'unit',p_unit_id,'kind',p_kind,'core',p_core_record_id,
  'terms',p_commercial_terms,'from',p_effective_from,'to',p_effective_to)::text,'UTF8')),'hex');
 select * into v_existing from airprop.commercial_execution_links
  where tenant_id=v_actor.tenant_id and workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.recorded_by is distinct from auth.uid() or v_existing.request_hash<>v_hash then
   raise exception 'airprop_execution_link_idempotency_conflict' using errcode='23505';
  end if;
  return jsonb_build_object('version',1,'link_id',v_existing.id,'kind',v_existing.kind,
   'core_record_type',v_existing.core_record_type,'core_record_id',v_existing.core_record_id,
   'effective_from',v_existing.effective_from,'idempotent',true);
 end if;
 select * into v_conflict from airprop.commercial_execution_links
  where kind=p_kind and core_record_id=p_core_record_id;
 if found then raise exception 'airprop_execution_link_conflict' using errcode='23505';end if;

 insert into airprop.commercial_execution_links(
  tenant_id,workspace_id,property_id,unit_id,kind,core_record_type,core_record_id,
  commercial_terms,effective_from,effective_to,recorded_by,idempotency_key,request_hash)
 values(v_actor.tenant_id,p_workspace_id,p_property_id,p_unit_id,p_kind,v_type,p_core_record_id,
  p_commercial_terms,p_effective_from,p_effective_to,auth.uid(),p_idempotency_key,v_hash)
 returning * into v_row;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(v_actor.tenant_id,auth.uid(),v_actor.role_code,
  case p_kind when 'resale' then 'AIRPROP_RESALE_RECEIPT_RECORDED'
   when 'lease' then 'AIRPROP_LEASE_RECEIPT_RECORDED' else 'AIRPROP_MANAGEMENT_RECEIPT_RECORDED' end,
  'airprop.commercial_execution_link',v_row.id,
  jsonb_build_object('version',1,'workspace_id',p_workspace_id,'kind',p_kind,
   'core_record_type',v_type,'core_record_id',p_core_record_id,'effective_from',p_effective_from),
  'Authorized commercial receipt linked to canonical Core fact');
 return jsonb_build_object('version',1,'link_id',v_row.id,'kind',v_row.kind,
  'core_record_type',v_row.core_record_type,'core_record_id',v_row.core_record_id,
  'effective_from',v_row.effective_from,'idempotent',false);
end;$$;

revoke all on function customer_api.link_airprop_commercial_execution_v1(
 uuid,uuid,uuid,uuid,text,uuid,jsonb,date,date,text) from public,anon,service_role;
grant execute on function customer_api.link_airprop_commercial_execution_v1(
 uuid,uuid,uuid,uuid,text,uuid,jsonb,date,date,text) to authenticated;

commit;
