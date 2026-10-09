begin;

-- AP03: harden the AIRPROP-owned schedule command while preserving the
-- Finance-owned posting boundary. A schedule is neither a journal nor a
-- payment and its external source reference is not treated as authority.
create or replace function customer_api.record_airprop_obligation_schedule_v1(
 p_context_id uuid,p_workspace_id uuid,p_presale_contract_id uuid,p_currency text,p_total_amount numeric,
 p_terms jsonb,p_financial_source_reference text,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare
 v_contract airprop.presale_contracts%rowtype;
 v_opp airprop.investment_opportunities%rowtype;
 v_actor record;
 v_existing airprop.purchase_obligation_schedules%rowtype;
 v_row airprop.purchase_obligation_schedules%rowtype;
 v_term jsonb;
 v_amount numeric;
 v_due_on date;
 v_hash text;
 v_sum numeric:=0;
begin
 if p_presale_contract_id is null or p_currency !~ '^[A-Z]{3}$'
  or p_total_amount<=0 or scale(p_total_amount)>4 or p_total_amount>=10000000000000000
  or jsonb_typeof(p_terms)<>'array' or jsonb_array_length(p_terms) not between 1 and 120
  or length(btrim(coalesce(p_financial_source_reference,''))) not between 8 and 500
  or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
  raise exception 'airprop_obligation_invalid' using errcode='22023';
 end if;

 begin
  for v_term in select value from jsonb_array_elements(p_terms) loop
   if jsonb_typeof(v_term)<>'object'
    or not(v_term ?& array['due_on','amount','label'])
    or (select count(*) from jsonb_object_keys(v_term))<>3
    or jsonb_typeof(v_term->'due_on')<>'string'
    or jsonb_typeof(v_term->'amount')<>'number'
    or jsonb_typeof(v_term->'label')<>'string' then
    raise exception 'airprop_obligation_invalid' using errcode='22023';
   end if;
   v_amount=(v_term->>'amount')::numeric;
   v_due_on=(v_term->>'due_on')::date;
   if v_due_on::text<>v_term->>'due_on' or v_amount<=0 or scale(v_amount)>4
    or v_amount>=10000000000000000
    or length(btrim(v_term->>'label')) not between 1 and 160
    or v_term->>'label' ~ '[[:cntrl:]]' then
    raise exception 'airprop_obligation_invalid' using errcode='22023';
   end if;
   v_sum=v_sum+v_amount;
  end loop;
 exception when sqlstate '22023' then raise;
  when others then raise exception 'airprop_obligation_invalid' using errcode='22023';
 end;
 if v_sum is distinct from p_total_amount then
  raise exception 'airprop_obligation_total_mismatch' using errcode='22023';
 end if;

 select * into v_contract from airprop.presale_contracts where id=p_presale_contract_id for share;
 select * into v_opp from airprop.investment_opportunities where id=v_contract.opportunity_id for share;
 if v_contract.id is null or v_opp.id is null then
  raise exception 'airprop_obligation_invalid' using errcode='22023';
 end if;
 select * into v_actor from app_private.require_airprop_commercial_property_v1(
  p_context_id,p_workspace_id,v_opp.property_id,'airprop.presale.execute');
 if v_contract.workspace_id<>p_workspace_id or v_contract.tenant_id<>v_actor.tenant_id
  or v_opp.workspace_id<>p_workspace_id or v_opp.tenant_id<>v_actor.tenant_id then
  raise exception 'airprop_obligation_access_denied' using errcode='42501';
 end if;

 -- Serialize both same-key replay and different-key attempts for one presale.
 perform pg_advisory_xact_lock(hashtextextended(
  v_actor.tenant_id::text||'/'||p_workspace_id::text||'/'||p_presale_contract_id::text,0));
 select * into v_actor from app_private.require_airprop_commercial_property_v1(
  p_context_id,p_workspace_id,v_opp.property_id,'airprop.presale.execute');
 if v_contract.workspace_id<>p_workspace_id or v_contract.tenant_id<>v_actor.tenant_id then
  raise exception 'airprop_obligation_access_denied' using errcode='42501';
 end if;

 v_hash=encode(sha256(convert_to(jsonb_build_object('actor',auth.uid(),'contract',p_presale_contract_id,
  'currency',p_currency,'total',p_total_amount,'terms',p_terms,
  'source',btrim(p_financial_source_reference))::text,'UTF8')),'hex');
 select * into v_existing from airprop.purchase_obligation_schedules
  where tenant_id=v_actor.tenant_id and workspace_id=p_workspace_id and idempotency_key=p_idempotency_key;
 if found then
  if v_existing.recorded_by is distinct from auth.uid() or v_existing.request_hash<>v_hash then
   raise exception 'airprop_obligation_idempotency_conflict' using errcode='23505';
  end if;
  return jsonb_build_object('version',1,'schedule_id',v_existing.id,'status',v_existing.status,'idempotent',true);
 end if;
 if exists(select 1 from airprop.purchase_obligation_schedules where presale_contract_id=p_presale_contract_id) then
  raise exception 'airprop_obligation_schedule_conflict' using errcode='23505';
 end if;

 insert into airprop.purchase_obligation_schedules(
  tenant_id,workspace_id,presale_contract_id,currency,total_amount,terms,
  financial_source_reference,recorded_by,idempotency_key,request_hash)
 values(v_actor.tenant_id,p_workspace_id,p_presale_contract_id,p_currency,p_total_amount,p_terms,
  btrim(p_financial_source_reference),auth.uid(),p_idempotency_key,v_hash)
 returning * into v_row;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,after_snapshot,reason)
 values(v_actor.tenant_id,auth.uid(),v_actor.role_code,'AIRPROP_OBLIGATION_SCHEDULE_RECORDED',
  'airprop.purchase_obligation_schedule',v_row.id,
  jsonb_build_object('version',1,'workspace_id',p_workspace_id,'presale_contract_id',p_presale_contract_id,
   'currency',v_row.currency,'total_amount',v_row.total_amount::text,'status',v_row.status),
  'Authorized presale obligation schedule');
 return jsonb_build_object('version',1,'schedule_id',v_row.id,'status',v_row.status,'idempotent',false);
end;$$;

revoke all on function customer_api.record_airprop_obligation_schedule_v1(
 uuid,uuid,uuid,text,numeric,jsonb,text,text) from public,anon,service_role;
grant execute on function customer_api.record_airprop_obligation_schedule_v1(
 uuid,uuid,uuid,text,numeric,jsonb,text,text) to authenticated;

commit;
