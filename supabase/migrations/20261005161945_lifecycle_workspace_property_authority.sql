begin;

-- LC-C01: a distinct, purpose-bound relationship. Existing operator bindings and
-- all customer API authorization remain unchanged until their consumers migrate.
create table platform.workspace_property_authorities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  purpose text not null check (purpose in ('property_operations', 'investment', 'service_delivery')),
  authority_source text not null check (length(trim(authority_source)) > 0),
  evidence_reference text not null check (length(trim(evidence_reference)) > 0),
  valid_from timestamptz not null,
  valid_to timestamptz,
  status text not null default 'active' check (status in ('active', 'revoked')),
  revoked_at timestamptz,
  revocation_reason text,
  created_at timestamptz not null default statement_timestamp(),
  check (valid_to is null or valid_to > valid_from),
  check ((status = 'active' and revoked_at is null and revocation_reason is null)
      or (status = 'revoked' and revoked_at is not null and valid_to is not null
          and length(trim(revocation_reason)) > 0))
);

create index workspace_property_authorities_target_idx
  on platform.workspace_property_authorities (tenant_id, property_id, customer_workspace_id, purpose, valid_from)
  where status = 'active';

create or replace function app_private.guard_workspace_property_authority_v1()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_property_tenant uuid;
  v_workspace_tenant uuid;
begin
  if tg_op = 'INSERT' and new.status <> 'active' then
    raise exception 'workspace_property_authority_invalid_initial_state' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    raise exception 'workspace_property_authority_history_immutable' using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' then
    if (new.tenant_id, new.property_id, new.customer_workspace_id, new.purpose,
        new.authority_source, new.evidence_reference, new.valid_from, new.created_at)
       is distinct from
       (old.tenant_id, old.property_id, old.customer_workspace_id, old.purpose,
        old.authority_source, old.evidence_reference, old.valid_from, old.created_at)
       or old.status <> 'active' or new.status <> 'revoked'
       or new.revoked_at is distinct from statement_timestamp()
       or new.valid_to is distinct from new.revoked_at
       or (old.valid_to is not null and new.valid_to > old.valid_to) then
      raise exception 'workspace_property_authority_history_immutable' using errcode = '42501';
    end if;
  end if;

  -- The property row serializes competing writes for this canonical subject.
  select tenant_id into v_property_tenant from portfolio.properties
    where id = new.property_id for update;
  select tenant_id into v_workspace_tenant from platform.customer_workspaces
    where id = new.customer_workspace_id for update;
  if v_property_tenant is distinct from new.tenant_id
     or v_workspace_tenant is distinct from new.tenant_id then
    raise exception 'workspace_property_authority_tenant_mismatch' using errcode = '42501';
  end if;
  if new.status = 'active' and exists (
    select 1 from platform.workspace_property_authorities a
    where a.property_id = new.property_id
      and a.customer_workspace_id = new.customer_workspace_id
      and a.purpose = new.purpose and a.status = 'active'
      and a.id <> new.id
      and a.valid_from < coalesce(new.valid_to, 'infinity'::timestamptz)
      and new.valid_from < coalesce(a.valid_to, 'infinity'::timestamptz)
  ) then
    raise exception 'workspace_property_authority_overlap' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger guard_workspace_property_authority
before insert or update or delete on platform.workspace_property_authorities
for each row execute function app_private.guard_workspace_property_authority_v1();

alter table platform.workspace_property_authorities enable row level security;
revoke all on platform.workspace_property_authorities from public, anon, authenticated;
grant select, insert, update on platform.workspace_property_authorities to service_role;
revoke all on function app_private.guard_workspace_property_authority_v1()
  from public, anon, authenticated, service_role;

commit;
