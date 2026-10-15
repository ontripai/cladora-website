begin;

-- CORE-JURISDICTION-PROFILE-01
-- Inactive multi-country foundation. No country profile, assignment, grant,
-- backfill, Remote installation or runtime activation is introduced here.

-- Every newly created address must state its country explicitly. Historical
-- rows are neither inferred nor rewritten. Postal codes remain country-owned
-- free-form text: they are neither globally unique nor constrained to one
-- international shape by Core.
alter table portfolio.addresses alter column country_code drop default;
alter table portfolio.addresses
  add constraint addresses_country_code_explicit_v1
  check(country_code::text ~ '^[A-Z]{2}$') not valid;
alter table portfolio.addresses
  validate constraint addresses_country_code_explicit_v1;

comment on column portfolio.addresses.country_code is
  'Explicit ISO 3166-1 alpha-2 country supplied for each address; never inferred from locale, currency, Workspace or user location.';
comment on column portfolio.addresses.postal_code is
  'Optional country-specific postal text. Core imposes no global format or uniqueness; an activated Country Pack may validate local syntax.';

create type platform.jurisdiction_profile_status as enum
  ('draft','validated','active','suspended','retired');
create type platform.jurisdiction_domain_status as enum
  ('validated','active','retired');
create type platform.property_jurisdiction_assignment_status as enum
  ('draft','active','superseded','archived');

create table platform.jurisdiction_profiles(
  id uuid primary key default gen_random_uuid(),
  code text not null check(code ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  version integer not null check(version>0),
  country_code char(2) not null check(country_code::text ~ '^[A-Z]{2}$'),
  name text not null check(nullif(btrim(name),'') is not null),
  default_currency_code char(3) not null
    check(default_currency_code::text ~ '^[A-Z]{3}$'),
  default_timezone text not null check(length(default_timezone) between 1 and 80),
  calendar_code text not null check(calendar_code ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  manifest_sha256 text not null check(manifest_sha256 ~ '^[a-f0-9]{64}$'),
  status platform.jurisdiction_profile_status not null default 'draft',
  valid_from date not null,
  valid_to date check(valid_to is null or valid_to>valid_from),
  legal_signoff_reference text,
  legal_signed_at timestamptz,
  accounting_signoff_reference text,
  accounting_signed_at timestamptz,
  activated_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(code,version),
  check((legal_signoff_reference is null)=(legal_signed_at is null)),
  check((accounting_signoff_reference is null)=(accounting_signed_at is null))
);

create table platform.jurisdiction_profile_domains(
  id uuid primary key default gen_random_uuid(),
  jurisdiction_profile_id uuid not null
    references platform.jurisdiction_profiles(id) on delete restrict,
  domain_code text not null check(domain_code ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  contract_version text not null
    check(contract_version ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  artifact_sha256 text not null check(artifact_sha256 ~ '^[a-f0-9]{64}$'),
  required boolean not null default true,
  status platform.jurisdiction_domain_status not null,
  valid_from date not null,
  valid_to date check(valid_to is null or valid_to>valid_from),
  created_at timestamptz not null default statement_timestamp(),
  unique(jurisdiction_profile_id,domain_code)
);

create table platform.property_jurisdiction_assignments(
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null
    references platform.customer_workspaces(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  jurisdiction_profile_id uuid not null
    references platform.jurisdiction_profiles(id) on delete restrict,
  assignment_version integer not null check(assignment_version>0),
  country_code char(2) not null check(country_code::text ~ '^[A-Z]{2}$'),
  profile_manifest_sha256 text not null
    check(profile_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  status platform.property_jurisdiction_assignment_status not null default 'draft',
  binding_source text not null check(binding_source in
    ('onboarding_verified','platform_verified','migration_verified')),
  valid_from timestamptz not null default statement_timestamp(),
  valid_to timestamptz check(valid_to is null or valid_to>valid_from),
  reason text not null check(nullif(btrim(reason),'') is not null),
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique(property_id,assignment_version)
);

create index jurisdiction_profiles_country_status_idx
  on platform.jurisdiction_profiles(country_code,status,valid_from,valid_to);
create index jurisdiction_domains_profile_idx
  on platform.jurisdiction_profile_domains(jurisdiction_profile_id,domain_code);
create index property_jurisdiction_current_idx
  on platform.property_jurisdiction_assignments
  (tenant_id,property_id,status,valid_from,valid_to);
create index property_jurisdiction_workspace_idx
  on platform.property_jurisdiction_assignments
  (customer_workspace_id,property_id,status);

create function app_private.guard_jurisdiction_profile_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare domain_count integer; unavailable_count integer;
begin
  if tg_op='DELETE' then
    raise exception 'jurisdiction_profile_history_immutable' using errcode='42501';
  end if;
  if tg_op='UPDATE' then
    if (old.id,old.code,old.version,old.country_code,old.name,
        old.default_currency_code,old.default_timezone,old.calendar_code,
        old.manifest_sha256,old.valid_from,old.created_at)
       is distinct from
       (new.id,new.code,new.version,new.country_code,new.name,
        new.default_currency_code,new.default_timezone,new.calendar_code,
        new.manifest_sha256,new.valid_from,new.created_at) then
      raise exception 'jurisdiction_profile_definition_immutable' using errcode='42501';
    end if;
    if old.legal_signoff_reference is not null and
       (new.legal_signoff_reference,new.legal_signed_at) is distinct from
       (old.legal_signoff_reference,old.legal_signed_at) then
      raise exception 'jurisdiction_profile_legal_signoff_immutable' using errcode='42501';
    end if;
    if old.accounting_signoff_reference is not null and
       (new.accounting_signoff_reference,new.accounting_signed_at) is distinct from
       (old.accounting_signoff_reference,old.accounting_signed_at) then
      raise exception 'jurisdiction_profile_accounting_signoff_immutable' using errcode='42501';
    end if;
    if old.activated_at is not null and new.activated_at is distinct from old.activated_at then
      raise exception 'jurisdiction_profile_activation_evidence_immutable' using errcode='42501';
    end if;
    if old.retired_at is not null and new.retired_at is distinct from old.retired_at then
      raise exception 'jurisdiction_profile_retirement_evidence_immutable' using errcode='42501';
    end if;
    if old.status in ('active','suspended','retired') and
       new.valid_to is distinct from old.valid_to then
      raise exception 'jurisdiction_profile_effective_period_immutable' using errcode='42501';
    end if;
    if new.status<>old.status and not (
      (old.status='draft' and new.status in ('validated','retired')) or
      (old.status='validated' and new.status in ('active','retired')) or
      (old.status='active' and new.status in ('suspended','retired')) or
      (old.status='suspended' and new.status in ('active','retired'))
    ) then
      raise exception 'jurisdiction_profile_status_transition_invalid' using errcode='22023';
    end if;
  end if;
  if not exists(select 1 from pg_timezone_names where name=new.default_timezone) then
    raise exception 'jurisdiction_profile_timezone_invalid' using errcode='22023';
  end if;
  if new.status not in ('active','suspended','retired') and new.activated_at is not null then
    raise exception 'jurisdiction_profile_activation_evidence_invalid' using errcode='22023';
  end if;
  if new.status<>'retired' and new.retired_at is not null then
    raise exception 'jurisdiction_profile_retirement_evidence_invalid' using errcode='22023';
  end if;
  if new.status='active' then
    if new.legal_signoff_reference is null or new.accounting_signoff_reference is null then
      raise exception 'jurisdiction_profile_signoff_required' using errcode='42501';
    end if;
    select count(*)::integer,
      count(*) filter(where required and status<>'active')::integer
      into domain_count,unavailable_count
    from platform.jurisdiction_profile_domains
    where jurisdiction_profile_id=new.id and required;
    if domain_count=0 or unavailable_count<>0 then
      raise exception 'jurisdiction_profile_required_domain_unavailable' using errcode='42501';
    end if;
    perform pg_advisory_xact_lock(hashtextextended('jurisdiction-profile:'||new.code,0));
    if exists(select 1 from platform.jurisdiction_profiles p
      where p.id<>new.id and p.code=new.code and p.status='active'
        and daterange(p.valid_from,coalesce(p.valid_to,'infinity'::date),'[)') &&
          daterange(new.valid_from,coalesce(new.valid_to,'infinity'::date),'[)')) then
      raise exception 'jurisdiction_profile_effective_period_overlap' using errcode='P0001';
    end if;
    new.activated_at:=coalesce(new.activated_at,statement_timestamp());
  end if;
  if new.status='retired' then
    new.retired_at:=coalesce(new.retired_at,statement_timestamp());
  end if;
  new.updated_at:=statement_timestamp();
  return new;
end;
$$;

create function app_private.guard_jurisdiction_domain_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare profile platform.jurisdiction_profiles%rowtype;
begin
  if tg_op in ('UPDATE','DELETE') then
    raise exception 'jurisdiction_domain_artifact_immutable' using errcode='42501';
  end if;
  select * into profile from platform.jurisdiction_profiles p
    where p.id=new.jurisdiction_profile_id for share;
  if profile.id is null then
    raise exception 'jurisdiction_profile_not_found' using errcode='P0002';
  end if;
  if profile.status<>'draft' then
    raise exception 'jurisdiction_profile_definition_closed' using errcode='42501';
  end if;
  if new.valid_from<profile.valid_from or
     (profile.valid_to is not null and (new.valid_to is null or new.valid_to>profile.valid_to)) then
    raise exception 'jurisdiction_domain_effective_period_invalid' using errcode='22023';
  end if;
  return new;
end;
$$;

create function app_private.guard_property_jurisdiction_assignment_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare workspace_tenant uuid; property_tenant uuid; address_country char(2);
  profile platform.jurisdiction_profiles%rowtype;
begin
  if tg_op='DELETE' then
    raise exception 'property_jurisdiction_history_immutable' using errcode='42501';
  end if;
  if tg_op='UPDATE' then
    if (old.id,old.tenant_id,old.customer_workspace_id,old.property_id,
        old.jurisdiction_profile_id,old.assignment_version,old.country_code,
        old.profile_manifest_sha256,old.binding_source,old.valid_from,old.reason,
        old.created_by,old.created_at)
       is distinct from
       (new.id,new.tenant_id,new.customer_workspace_id,new.property_id,
        new.jurisdiction_profile_id,new.assignment_version,new.country_code,
        new.profile_manifest_sha256,new.binding_source,new.valid_from,new.reason,
        new.created_by,new.created_at) then
      raise exception 'property_jurisdiction_assignment_immutable' using errcode='42501';
    end if;
    if new.status<>old.status and not (
      (old.status='draft' and new.status in ('active','archived')) or
      (old.status='active' and new.status in ('superseded','archived'))
    ) then
      raise exception 'property_jurisdiction_status_transition_invalid' using errcode='22023';
    end if;
    if old.status='active' and new.status='active' and
       new.valid_to is distinct from old.valid_to then
      raise exception 'property_jurisdiction_effective_period_immutable' using errcode='42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('property-jurisdiction:'||new.property_id::text,0));
  select w.tenant_id into workspace_tenant from platform.customer_workspaces w
    where w.id=new.customer_workspace_id for share;
  select p.tenant_id,a.country_code into property_tenant,address_country
    from portfolio.properties p join portfolio.addresses a on a.id=p.address_id
    where p.id=new.property_id for share of p,a;
  select * into profile from platform.jurisdiction_profiles p
    where p.id=new.jurisdiction_profile_id for share;
  if workspace_tenant is null or property_tenant is null or profile.id is null then
    raise exception 'property_jurisdiction_source_missing' using errcode='P0002';
  end if;
  if workspace_tenant<>new.tenant_id or property_tenant<>new.tenant_id then
    raise exception 'property_jurisdiction_tenant_mismatch' using errcode='42501';
  end if;
  if not exists(select 1 from platform.workspace_property_bindings b
    where b.tenant_id=new.tenant_id and b.customer_workspace_id=new.customer_workspace_id
      and b.property_id=new.property_id and b.status='active'
      and b.valid_from<=new.valid_from and (b.valid_to is null or b.valid_to>new.valid_from)) then
    raise exception 'property_jurisdiction_workspace_binding_missing' using errcode='42501';
  end if;
  if address_country is null or address_country<>profile.country_code then
    raise exception 'property_jurisdiction_address_country_mismatch' using errcode='42501';
  end if;
  if tg_op='INSERT' then
    new.country_code:=profile.country_code;
    new.profile_manifest_sha256:=profile.manifest_sha256;
  end if;
  if exists(select 1 from platform.property_jurisdiction_assignments a
    where a.property_id=new.property_id and a.id<>new.id
      and a.status in ('active','superseded','archived')
      and a.country_code<>profile.country_code) then
    raise exception 'property_jurisdiction_country_rebind_forbidden' using errcode='42501';
  end if;
  if new.status='active' then
    if profile.status<>'active' or profile.valid_from>new.valid_from::date
      or (profile.valid_to is not null and profile.valid_to<=new.valid_from::date) then
      raise exception 'property_jurisdiction_profile_inactive' using errcode='42501';
    end if;
    if exists(select 1 from platform.property_jurisdiction_assignments a
      where a.property_id=new.property_id and a.id<>new.id and a.status='active'
        and tstzrange(a.valid_from,coalesce(a.valid_to,'infinity'::timestamptz),'[)') &&
          tstzrange(new.valid_from,coalesce(new.valid_to,'infinity'::timestamptz),'[)')) then
      raise exception 'property_jurisdiction_effective_period_overlap' using errcode='P0001';
    end if;
  end if;
  if new.status in ('superseded','archived') and new.valid_to is null then
    new.valid_to:=statement_timestamp();
  end if;
  new.updated_at:=statement_timestamp();
  return new;
end;
$$;

create function app_private.guard_jurisdiction_bound_address_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
begin
  if old.country_code is distinct from new.country_code and exists(
    select 1 from portfolio.properties p
    join platform.property_jurisdiction_assignments a on a.property_id=p.id
    where p.address_id=old.id and a.status in ('active','superseded','archived')
      and a.country_code<>new.country_code
  ) then
    raise exception 'property_jurisdiction_address_country_immutable' using errcode='42501';
  end if;
  return new;
end;
$$;

create function app_private.guard_jurisdiction_bound_property_address_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare target_country char(2); bound_country char(2);
begin
  if old.address_id is distinct from new.address_id and exists(
    select 1 from platform.property_jurisdiction_assignments a
    where a.property_id=old.id and a.status in ('active','superseded','archived')) then
    select country_code into target_country from portfolio.addresses where id=new.address_id;
    select country_code into bound_country from platform.property_jurisdiction_assignments
      where property_id=old.id and status in ('active','superseded','archived')
      order by assignment_version desc limit 1;
    if target_country is null or target_country<>bound_country then
      raise exception 'property_jurisdiction_property_country_immutable' using errcode='42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger jurisdiction_profiles_guard
before insert or update or delete on platform.jurisdiction_profiles
for each row execute function app_private.guard_jurisdiction_profile_v1();
create trigger jurisdiction_domains_guard
before insert or update or delete on platform.jurisdiction_profile_domains
for each row execute function app_private.guard_jurisdiction_domain_v1();
create trigger property_jurisdiction_assignments_guard
before insert or update or delete on platform.property_jurisdiction_assignments
for each row execute function app_private.guard_property_jurisdiction_assignment_v1();
create trigger jurisdiction_bound_address_guard
before update of country_code on portfolio.addresses
for each row execute function app_private.guard_jurisdiction_bound_address_v1();
create trigger jurisdiction_bound_property_address_guard
before update of address_id on portfolio.properties
for each row execute function app_private.guard_jurisdiction_bound_property_address_v1();

alter table platform.jurisdiction_profiles enable row level security;
alter table platform.jurisdiction_profile_domains enable row level security;
alter table platform.property_jurisdiction_assignments enable row level security;
revoke all on platform.jurisdiction_profiles,
  platform.jurisdiction_profile_domains,
  platform.property_jurisdiction_assignments
  from public,anon,authenticated,service_role;

revoke all on function
  app_private.guard_jurisdiction_profile_v1(),
  app_private.guard_jurisdiction_domain_v1(),
  app_private.guard_property_jurisdiction_assignment_v1(),
  app_private.guard_jurisdiction_bound_address_v1(),
  app_private.guard_jurisdiction_bound_property_address_v1()
  from public,anon,authenticated,service_role;

alter function app_private.guard_jurisdiction_profile_v1() owner to postgres;
alter function app_private.guard_jurisdiction_domain_v1() owner to postgres;
alter function app_private.guard_property_jurisdiction_assignment_v1() owner to postgres;
alter function app_private.guard_jurisdiction_bound_address_v1() owner to postgres;
alter function app_private.guard_jurisdiction_bound_property_address_v1() owner to postgres;

comment on table platform.jurisdiction_profiles is
  'Inactive versioned Country Pack registry; locale never selects jurisdiction.';
comment on table platform.property_jurisdiction_assignments is
  'Exact per-property jurisdiction binding; one Workspace may contain properties in several countries.';

commit;
