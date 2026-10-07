begin;

-- One canonical unit may be consumed as a predecessor once and introduced as
-- a successor once. A successor can later be the predecessor of another event.
create function app_private.guard_unit_lineage_single_transition_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $$
begin
  -- Independent of the original guard's trigger order, serialize competing
  -- changes for this property before inspecting existing lineage.
  perform 1 from portfolio.properties where id=new.property_id for update;
  if exists (
    select 1 from portfolio.unit_lineage_events e
    where e.property_id=new.property_id and e.tenant_id=new.tenant_id
      and (e.predecessor_unit_ids && new.predecessor_unit_ids
        or e.successor_unit_ids && new.successor_unit_ids)
  ) then
    raise exception 'unit_lineage_transition_conflict' using errcode='23505';
  end if;
  return new;
end;
$$;
create trigger guard_unit_lineage_single_transition
before insert on portfolio.unit_lineage_events
for each row execute function app_private.guard_unit_lineage_single_transition_v1();
revoke all on function app_private.guard_unit_lineage_single_transition_v1()
  from public,anon,authenticated,service_role;

commit;
