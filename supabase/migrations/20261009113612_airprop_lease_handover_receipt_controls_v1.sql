begin;

-- AP05: enforce parity between AIRPROP lease commercial terms and the
-- existing immutable Core lease/handover receipt. Finance settlement remains
-- separate until the Finance owner publishes an accepted FIN01 receipt contract.
create function airprop.validate_lease_execution_link_v1()
returns trigger language plpgsql set search_path=pg_catalog as $$
declare
 v_handover occupancy.lease_handover_receipts%rowtype;
 v_lease occupancy.leases%rowtype;
 v_rent numeric;
 v_schedule_rent numeric;
begin
 if new.kind<>'lease' then return new;end if;
 begin
  if new.unit_id is null
   or jsonb_typeof(new.commercial_terms->'rent_amount') is distinct from 'number'
   or jsonb_typeof(new.commercial_terms->'currency') is distinct from 'string'
   or (new.commercial_terms->>'currency') !~ '^[A-Z]{3}$' then
   raise exception 'airprop_lease_receipt_invalid' using errcode='22023';
  end if;
  v_rent=(new.commercial_terms->>'rent_amount')::numeric;
  if v_rent<=0 or scale(v_rent)>4 or v_rent>=10000000000000000 then
   raise exception 'airprop_lease_receipt_invalid' using errcode='22023';
  end if;
 exception when sqlstate '22023' then raise;
  when others then raise exception 'airprop_lease_receipt_invalid' using errcode='22023';
 end;
 select * into v_handover from occupancy.lease_handover_receipts
  where id=new.core_record_id and tenant_id=new.tenant_id and property_id=new.property_id
   and unit_id=new.unit_id and effective_on=new.effective_from;
 if v_handover.id is null then
  raise exception 'airprop_execution_link_core_mismatch' using errcode='22023';
 end if;
 select * into v_lease from occupancy.leases where id=v_handover.lease_id
  and tenant_id=new.tenant_id and unit_id=new.unit_id;
 begin v_schedule_rent=(v_handover.schedule_snapshot->>'rent_amount')::numeric;
 exception when others then raise exception 'airprop_execution_link_core_mismatch' using errcode='22023';end;
 if v_lease.id is null or new.effective_to is distinct from v_lease.ends_on
  or v_rent is distinct from v_schedule_rent
  or new.commercial_terms->>'currency' is distinct from v_handover.schedule_snapshot->>'currency'
  or new.commercial_terms->>'currency' is distinct from v_lease.currency::text then
  raise exception 'airprop_execution_link_core_mismatch' using errcode='22023';
 end if;
 return new;
end;$$;
revoke all on function airprop.validate_lease_execution_link_v1()
 from public,anon,authenticated,service_role;
create trigger a_validate_lease_execution_link
 before insert on airprop.commercial_execution_links
 for each row execute function airprop.validate_lease_execution_link_v1();

commit;
