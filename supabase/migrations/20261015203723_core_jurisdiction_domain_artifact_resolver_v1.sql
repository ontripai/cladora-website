begin;

-- CORE-JURISDICTION-DOMAIN-ARTIFACT-RESOLVER-04
-- Empty, inactive canonical-byte inventory. This migration installs no Country
-- Pack, country rule, rate, rail, credential, execution grant or route.

create table platform.jurisdiction_domain_artifacts(
  id uuid primary key default gen_random_uuid(),
  jurisdiction_profile_id uuid not null,
  profile_code text not null check(profile_code ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  profile_version integer not null check(profile_version>0),
  country_code char(2) not null check(country_code::text ~ '^[A-Z]{2}$'),
  profile_manifest_sha256 text not null
    check(profile_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  artifact_contract_version text not null
    check(artifact_contract_version='core-jurisdiction-domain-artifact.v1'),
  artifact_version integer not null check(artifact_version=1),
  domain_code text not null check(domain_code ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  domain_version text not null check(domain_version ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  artifact_sha256 text not null check(artifact_sha256 ~ '^[a-f0-9]{64}$'),
  canonical_bytes bytea not null check(octet_length(canonical_bytes) between 2 and 1048576),
  canonical_bytes_sha256 text generated always as
    (encode(extensions.digest(canonical_bytes,'sha256'),'hex')) stored,
  effective_from timestamptz not null,
  effective_to timestamptz,
  lifecycle_status text not null check(lifecycle_status in
    ('draft','validated','active','suspended','retired')),
  created_at timestamptz not null default statement_timestamp(),
  constraint jurisdiction_domain_artifact_profile_domain_fk
    foreign key(jurisdiction_profile_id,domain_code)
    references platform.jurisdiction_profile_domains(jurisdiction_profile_id,domain_code)
    on delete restrict,
  constraint jurisdiction_domain_artifact_hash_matches_bytes
    check(artifact_sha256=canonical_bytes_sha256),
  constraint jurisdiction_domain_artifact_period_valid
    check(effective_to is null or effective_to>effective_from),
  constraint jurisdiction_domain_artifact_identity_unique
    unique(jurisdiction_profile_id,domain_code,domain_version,artifact_sha256),
  constraint jurisdiction_domain_artifact_period_no_overlap
    exclude using gist(
      jurisdiction_profile_id with =,
      domain_code with =,
      domain_version with =,
      tstzrange(effective_from,coalesce(effective_to,'infinity'::timestamptz),'[)') with &&
    )
);

create index jurisdiction_domain_artifact_current_lookup_idx
  on platform.jurisdiction_domain_artifacts(
    jurisdiction_profile_id,domain_code,domain_version,effective_from,effective_to
  );

-- Empty canonical evidence source for artifact identities that were actually
-- committed by a future Core-hosted command. It is deliberately ungranted and
-- unseeded; installing this table does not enable any writer or consumer.
create table platform.jurisdiction_domain_artifact_receipt_evidence(
  receipt_id uuid primary key,
  tenant_id uuid not null,
  workspace_id uuid not null,
  source_property_id uuid not null,
  source_actor_id uuid not null,
  source_transaction_id uuid not null,
  source_command_id uuid not null,
  source_attempt integer not null check(source_attempt between 1 and 100),
  artifact_id uuid not null references platform.jurisdiction_domain_artifacts(id)
    on delete restrict,
  jurisdiction_profile_id uuid not null,
  profile_code text not null check(profile_code ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  profile_version integer not null check(profile_version>0),
  country_code char(2) not null check(country_code::text ~ '^[A-Z]{2}$'),
  profile_manifest_sha256 text not null
    check(profile_manifest_sha256 ~ '^[a-f0-9]{64}$'),
  domain_code text not null check(domain_code ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  domain_version text not null check(domain_version ~ '^[a-z][a-z0-9_.:-]{2,79}$'),
  artifact_sha256 text not null check(artifact_sha256 ~ '^[a-f0-9]{64}$'),
  effective_at timestamptz not null,
  committed_at timestamptz not null default statement_timestamp(),
  constraint jurisdiction_domain_artifact_receipt_source_unique
    unique(source_transaction_id,source_command_id,artifact_id)
);

create function app_private.canonical_jsonb_text_v1(p_value jsonb)
returns text language plpgsql immutable strict security invoker set search_path=pg_catalog as $$
declare v_type text;v_result text;
begin
  v_type:=pg_catalog.jsonb_typeof(p_value);
  if v_type='object' then
    select '{'||coalesce(pg_catalog.string_agg(
      pg_catalog.to_jsonb(entry.key)::text||':'||
        app_private.canonical_jsonb_text_v1(entry.value),','
          order by entry.key collate "C"),'')||'}'
      into v_result from pg_catalog.jsonb_each(p_value) as entry;
    return v_result;
  end if;
  if v_type='array' then
    select '['||coalesce(pg_catalog.string_agg(
      app_private.canonical_jsonb_text_v1(item.value),',' order by item.ordinality),'')||']'
      into v_result from pg_catalog.jsonb_array_elements(p_value)
        with ordinality as item(value,ordinality);
    return v_result;
  end if;
  return p_value::text;
end;
$$;

create function app_private.guard_jurisdiction_domain_artifact_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_body_text text;v_body jsonb;v_profile record;v_domain record;
begin
  if tg_op in ('UPDATE','DELETE') then
    raise exception 'jurisdiction_domain_artifact_history_immutable' using errcode='42501';
  end if;
  begin
    v_body_text:=pg_catalog.convert_from(new.canonical_bytes,'UTF8');
    v_body:=v_body_text::jsonb;
  exception when others then
    raise exception 'jurisdiction_domain_artifact_bytes_invalid' using errcode='22023';
  end;
  if v_body_text<>app_private.canonical_jsonb_text_v1(v_body)
    or v_body ? 'artifact_sha256' then
    raise exception 'jurisdiction_domain_artifact_bytes_not_canonical' using errcode='22023';
  end if;
  if pg_catalog.encode(extensions.digest(new.canonical_bytes,'sha256'),'hex')
      <>new.artifact_sha256 then
    raise exception 'jurisdiction_domain_artifact_hash_mismatch' using errcode='22000';
  end if;
  if v_body->>'contract_version' is distinct from new.artifact_contract_version
    or (v_body->>'artifact_version')::integer is distinct from new.artifact_version
    or v_body#>>'{profile,profile_id}' is distinct from new.jurisdiction_profile_id::text
    or v_body#>>'{profile,profile_code}' is distinct from new.profile_code
    or (v_body#>>'{profile,profile_version}')::integer is distinct from new.profile_version
    or v_body#>>'{profile,country_code}' is distinct from
      pg_catalog.btrim(new.country_code::text)
    or v_body#>>'{profile,manifest_sha256}' is distinct from new.profile_manifest_sha256
    or v_body#>>'{domain,domain_code}' is distinct from new.domain_code
    or v_body#>>'{domain,domain_version}' is distinct from new.domain_version
    or (v_body->>'effective_from')::timestamptz is distinct from new.effective_from
    or (v_body->>'effective_to')::timestamptz is distinct from new.effective_to
    or v_body->>'status' is distinct from new.lifecycle_status
    or v_body->>'reusable_as_command_authority' is distinct from 'false' then
    raise exception 'jurisdiction_domain_artifact_identity_mismatch' using errcode='22023';
  end if;

  select p.id,p.code,p.version,pg_catalog.btrim(p.country_code::text) as country_code,
    p.manifest_sha256,p.valid_from,p.valid_to
    into v_profile from platform.jurisdiction_profiles p
    where p.id=new.jurisdiction_profile_id for share;
  select d.contract_version,d.artifact_sha256,d.valid_from,d.valid_to
    into v_domain from platform.jurisdiction_profile_domains d
    where d.jurisdiction_profile_id=new.jurisdiction_profile_id
      and d.domain_code=new.domain_code for share;
  if v_profile.id is null or v_domain.contract_version is null then
    raise exception 'jurisdiction_domain_artifact_parent_missing' using errcode='P0002';
  end if;
  if (v_profile.code,v_profile.version,v_profile.country_code,v_profile.manifest_sha256)
      is distinct from
      (new.profile_code,new.profile_version,pg_catalog.btrim(new.country_code::text),
        new.profile_manifest_sha256)
    or (v_domain.contract_version,v_domain.artifact_sha256)
      is distinct from (new.domain_version,new.artifact_sha256) then
    raise exception 'jurisdiction_domain_artifact_parent_mismatch' using errcode='22023';
  end if;
  if new.effective_from::date<v_profile.valid_from
    or (v_profile.valid_to is not null and
      (new.effective_to is null or new.effective_to::date>v_profile.valid_to))
    or new.effective_from::date<v_domain.valid_from
    or (v_domain.valid_to is not null and
      (new.effective_to is null or new.effective_to::date>v_domain.valid_to)) then
    raise exception 'jurisdiction_domain_artifact_period_outside_parent' using errcode='22023';
  end if;
  return new;
exception when invalid_text_representation or numeric_value_out_of_range
  or datetime_field_overflow then
  raise exception 'jurisdiction_domain_artifact_identity_invalid' using errcode='22023';
end;
$$;

create trigger jurisdiction_domain_artifacts_guard
before insert or update or delete on platform.jurisdiction_domain_artifacts
for each row execute function app_private.guard_jurisdiction_domain_artifact_v1();

create function app_private.guard_jurisdiction_domain_artifact_receipt_evidence_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_artifact record;
begin
  if tg_op in ('UPDATE','DELETE') then
    raise exception 'jurisdiction_domain_artifact_receipt_immutable' using errcode='42501';
  end if;
  select a.id,a.jurisdiction_profile_id,a.profile_code,a.profile_version,
    pg_catalog.btrim(a.country_code::text) as country_code,a.profile_manifest_sha256,
    a.domain_code,a.domain_version,a.artifact_sha256,a.effective_from,a.effective_to,
    a.lifecycle_status,p.status::text as profile_status,p.valid_from as profile_valid_from,
    p.valid_to as profile_valid_to,p.legal_signoff_reference,p.legal_signed_at,
    p.accounting_signoff_reference,p.accounting_signed_at,
    d.status::text as domain_status,d.valid_from as domain_valid_from,
    d.valid_to as domain_valid_to
    into v_artifact
    from platform.jurisdiction_domain_artifacts a
    join platform.jurisdiction_profiles p on p.id=a.jurisdiction_profile_id
    join platform.jurisdiction_profile_domains d
      on d.jurisdiction_profile_id=a.jurisdiction_profile_id and d.domain_code=a.domain_code
    where a.id=new.artifact_id for share of a,p,d;
  if v_artifact.id is null then
    raise exception 'jurisdiction_domain_artifact_receipt_artifact_missing' using errcode='P0002';
  end if;
  if (v_artifact.jurisdiction_profile_id,v_artifact.profile_code,v_artifact.profile_version,
      v_artifact.country_code,v_artifact.profile_manifest_sha256,v_artifact.domain_code,
      v_artifact.domain_version,v_artifact.artifact_sha256)
      is distinct from
      (new.jurisdiction_profile_id,new.profile_code,new.profile_version,
       pg_catalog.btrim(new.country_code::text),new.profile_manifest_sha256,new.domain_code,
       new.domain_version,new.artifact_sha256) then
    raise exception 'jurisdiction_domain_artifact_receipt_identity_mismatch' using errcode='22023';
  end if;
  if v_artifact.lifecycle_status<>'active' or v_artifact.profile_status<>'active'
    or v_artifact.domain_status<>'active'
    or v_artifact.legal_signoff_reference is null or v_artifact.legal_signed_at is null
    or v_artifact.accounting_signoff_reference is null
    or v_artifact.accounting_signed_at is null
    or new.effective_at<v_artifact.effective_from
    or (v_artifact.effective_to is not null and new.effective_at>=v_artifact.effective_to)
    or new.effective_at::date<v_artifact.profile_valid_from
    or (v_artifact.profile_valid_to is not null
      and new.effective_at::date>=v_artifact.profile_valid_to)
    or new.effective_at::date<v_artifact.domain_valid_from
    or (v_artifact.domain_valid_to is not null
      and new.effective_at::date>=v_artifact.domain_valid_to)
    or new.effective_at>statement_timestamp() then
    raise exception 'jurisdiction_domain_artifact_receipt_not_activatable' using errcode='55000';
  end if;
  new.committed_at:=statement_timestamp();
  return new;
end;
$$;

create trigger jurisdiction_domain_artifact_receipt_evidence_guard
before insert or update or delete
on platform.jurisdiction_domain_artifact_receipt_evidence
for each row execute function
  app_private.guard_jurisdiction_domain_artifact_receipt_evidence_v1();

alter table platform.jurisdiction_domain_artifacts enable row level security;
alter table platform.jurisdiction_domain_artifact_receipt_evidence enable row level security;
revoke all on platform.jurisdiction_domain_artifacts
  from public,anon,authenticated,service_role;
revoke all on platform.jurisdiction_domain_artifact_receipt_evidence
  from public,anon,authenticated,service_role;
revoke all on function app_private.canonical_jsonb_text_v1(jsonb),
  app_private.guard_jurisdiction_domain_artifact_v1(),
  app_private.guard_jurisdiction_domain_artifact_receipt_evidence_v1()
  from public,anon,authenticated,service_role;

-- The canonical NOLOGIN owner receives only the source reads required by the
-- private immutable-insert guard. No execution role or product role is granted.
grant select on platform.jurisdiction_profiles,
  platform.jurisdiction_profile_domains,
  platform.jurisdiction_domain_artifacts to cladora_rpc_owner;
-- PostgreSQL requires UPDATE privilege on at least one column for SELECT ...
-- FOR SHARE. The guarded identity columns cannot be changed, and this NOLOGIN
-- owner is unreachable from product roles.
grant update(id) on platform.jurisdiction_profiles,
  platform.jurisdiction_profile_domains,
  platform.jurisdiction_domain_artifacts to cladora_rpc_owner;
create policy jurisdiction_artifact_owner_profiles_read_v1
  on platform.jurisdiction_profiles for select to cladora_rpc_owner using(true);
create policy jurisdiction_artifact_owner_domains_read_v1
  on platform.jurisdiction_profile_domains for select to cladora_rpc_owner using(true);
create policy jurisdiction_artifact_owner_profiles_lock_v1
  on platform.jurisdiction_profiles for update to cladora_rpc_owner
  using(true) with check(false);
create policy jurisdiction_artifact_owner_domains_lock_v1
  on platform.jurisdiction_profile_domains for update to cladora_rpc_owner
  using(true) with check(false);
create policy jurisdiction_artifact_owner_artifacts_read_v1
  on platform.jurisdiction_domain_artifacts for select to cladora_rpc_owner using(true);
create policy jurisdiction_artifact_owner_artifacts_lock_v1
  on platform.jurisdiction_domain_artifacts for update to cladora_rpc_owner
  using(true) with check(false);
grant create on schema app_private to cladora_rpc_owner;
grant create on schema platform to cladora_rpc_owner;
grant usage on schema extensions to cladora_rpc_owner;
grant execute on function extensions.digest(bytea,text) to cladora_rpc_owner;
alter function app_private.canonical_jsonb_text_v1(jsonb) owner to cladora_rpc_owner;
alter function app_private.guard_jurisdiction_domain_artifact_v1()
  owner to cladora_rpc_owner;
alter function app_private.guard_jurisdiction_domain_artifact_receipt_evidence_v1()
  owner to cladora_rpc_owner;
alter table platform.jurisdiction_domain_artifact_receipt_evidence
  owner to cladora_rpc_owner;
revoke create on schema app_private from cladora_rpc_owner;
revoke create on schema platform from cladora_rpc_owner;

comment on table platform.jurisdiction_domain_artifacts is
  'Empty immutable canonical-byte Country Pack artifact inventory; no seed or runtime grant.';
comment on column platform.jurisdiction_domain_artifacts.canonical_bytes is
  'Exact canonical UTF-8 hash-input bytes; JSONB is never the authoritative digest source.';
comment on table platform.jurisdiction_domain_artifact_receipt_evidence is
  'Empty immutable Core evidence source for artifact identities committed by future commands; no writer grant or activation.';

commit;
