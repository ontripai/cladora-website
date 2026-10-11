begin;

-- LC-C02 private evidence of a split or merge. The canonical unit rows and
-- their historical references remain untouched by this record.
create table portfolio.unit_lineage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  kind text not null check (kind in ('split','merge')),
  predecessor_unit_ids uuid[] not null,
  successor_unit_ids uuid[] not null,
  source_reference text not null check (length(btrim(source_reference)) between 1 and 500),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default statement_timestamp(),
  check (cardinality(predecessor_unit_ids) between 1 and 100),
  check (cardinality(successor_unit_ids) between 1 and 100),
  check ((kind='split' and cardinality(predecessor_unit_ids)=1 and cardinality(successor_unit_ids)>=2)
      or (kind='merge' and cardinality(predecessor_unit_ids)>=2 and cardinality(successor_unit_ids)=1))
);
create index unit_lineage_events_tenant_property_idx
  on portfolio.unit_lineage_events (tenant_id,property_id,recorded_at);
create index unit_lineage_events_property_idx
  on portfolio.unit_lineage_events (property_id);
create index unit_lineage_events_recorded_by_idx
  on portfolio.unit_lineage_events (recorded_by);

create function app_private.guard_unit_lineage_event_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $$
declare v_ids uuid[]; v_count integer; v_property_tenant uuid; v_loop boolean;
begin
  if tg_op <> 'INSERT' then
    raise exception 'unit_lineage_immutable' using errcode='42501';
  end if;
  -- One property lock serializes graph changes, including competing events.
  select tenant_id into v_property_tenant from portfolio.properties
    where id=new.property_id for update;
  if v_property_tenant is distinct from new.tenant_id then
    raise exception 'unit_lineage_subject_mismatch' using errcode='42501';
  end if;
  v_ids := new.predecessor_unit_ids || new.successor_unit_ids;
  if array_position(v_ids,null) is not null or
     (select count(distinct x) from unnest(v_ids) as x) <> cardinality(v_ids) then
    raise exception 'unit_lineage_duplicate_subject' using errcode='23505';
  end if;
  select count(*) into v_count from portfolio.units u
    join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
    where u.id=any(v_ids) and u.tenant_id=new.tenant_id
      and b.property_id=new.property_id;
  if v_count <> cardinality(v_ids) then
    raise exception 'unit_lineage_subject_mismatch' using errcode='42501';
  end if;
  -- A successor must not already reach a predecessor through prior events.
  with recursive reach(id,path) as (
    select unnest(new.successor_unit_ids),array[]::uuid[]
    union all
    select next_id,reach.path || reach.id
      from reach join portfolio.unit_lineage_events e
        on reach.id=any(e.predecessor_unit_ids) and e.property_id=new.property_id
      cross join lateral unnest(e.successor_unit_ids) as next_id
      where not reach.id=any(reach.path)
  ) select exists(select 1 from reach where id=any(new.predecessor_unit_ids)) into v_loop;
  if v_loop then
    raise exception 'unit_lineage_cycle' using errcode='23514';
  end if;
  return new;
end;
$$;
create trigger guard_unit_lineage_event
before insert or update or delete on portfolio.unit_lineage_events
for each row execute function app_private.guard_unit_lineage_event_v1();

alter table portfolio.unit_lineage_events enable row level security;
revoke all on portfolio.unit_lineage_events from public,anon,authenticated,service_role;
revoke all on function app_private.guard_unit_lineage_event_v1()
  from public,anon,authenticated,service_role;
comment on table portfolio.unit_lineage_events is
  'Private immutable split/merge evidence. No unit status, title, customer access, or historical reference changes follow automatically.';
commit;
