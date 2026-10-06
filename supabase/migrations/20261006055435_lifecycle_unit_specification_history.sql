begin;

-- LC-C02: retain the canonical unit UUID while specifications and display codes
-- evolve. This private history does not publish a unit or confer ownership.
create table portfolio.unit_specification_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  unit_id uuid not null references portfolio.units(id) on delete restrict,
  version integer not null check (version > 0),
  building_id uuid not null references portfolio.buildings(id) on delete restrict,
  unit_code text not null check (unit_code = btrim(unit_code) and length(unit_code) between 1 and 80),
  floor smallint,
  area_m2 numeric(12,3) check (area_m2 is null or area_m2 > 0),
  bedrooms smallint check (bedrooms is null or bedrooms >= 0),
  source_reference text not null check (length(btrim(source_reference)) between 1 and 500),
  recorded_by uuid not null references auth.users(id) on delete restrict,
  recorded_at timestamptz not null default statement_timestamp(),
  unique (unit_id,version)
);
create index unit_specification_versions_tenant_unit_idx
  on portfolio.unit_specification_versions (tenant_id,unit_id,version desc);

create function app_private.guard_unit_specification_version_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $$
declare v_unit record; v_next integer;
begin
  if tg_op <> 'INSERT' then
    raise exception 'unit_specification_history_immutable' using errcode='42501';
  end if;
  -- Serializes competing revisions for the same canonical unit.
  select u.tenant_id,u.building_id,b.property_id,p.tenant_id as property_tenant
    into v_unit from portfolio.units u
    join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
    join portfolio.properties p on p.id=b.property_id
    where u.id=new.unit_id for update of u;
  if not found or v_unit.tenant_id is distinct from new.tenant_id
    or v_unit.property_tenant is distinct from new.tenant_id
    or v_unit.building_id is distinct from new.building_id then
    raise exception 'unit_specification_subject_mismatch' using errcode='42501';
  end if;
  select coalesce(max(version),0)+1 into v_next
    from portfolio.unit_specification_versions where unit_id=new.unit_id;
  if new.version <> v_next then
    raise exception 'unit_specification_version_conflict' using errcode='23505';
  end if;
  return new;
end;
$$;
create trigger guard_unit_specification_version
before insert or update or delete on portfolio.unit_specification_versions
for each row execute function app_private.guard_unit_specification_version_v1();

alter table portfolio.unit_specification_versions enable row level security;
revoke all on portfolio.unit_specification_versions from public,anon,authenticated,service_role;
revoke all on function app_private.guard_unit_specification_version_v1()
  from public,anon,authenticated,service_role;
comment on table portfolio.unit_specification_versions is
  'Private append-only canonical unit specification snapshots. A code or area revision preserves the unit UUID and earlier snapshots; no customer command or cross-workspace read is granted.';

commit;
