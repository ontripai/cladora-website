begin;

-- R10 Phase 1A: statutory simple-entry accounting foundation for Romanian
-- condominium associations. The existing double-entry ledger remains an
-- optional supplemental analytical control and is not modified here.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'cladora_rpc_owner') then
    create role cladora_rpc_owner
      nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
  end if;
end
$$;

create type finance.statutory_regime_status as enum (
  'draft', 'validation_pending', 'validated', 'active', 'suspended', 'retired'
);

create type finance.statutory_cycle_status as enum (
  'draft', 'collecting', 'prepared', 'pending_review', 'approved', 'closed', 'cancelled'
);

create type finance.statutory_entry_direction as enum ('receipt', 'payment');
create type finance.statutory_payment_medium as enum ('cash', 'bank');

create table finance.statutory_accounting_regimes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  jurisdiction char(2) not null default 'RO' check (jurisdiction = 'RO'),
  regime_code text not null default 'ro_hoa_simple_entry'
    check (regime_code = 'ro_hoa_simple_entry'),
  statutory_basis jsonb not null default jsonb_build_object(
    'law', 'Legea nr. 196/2018',
    'articles', jsonb_build_array('66(1)(f)', '74(1)'),
    'accounting_method', 'partida_simpla'
  ),
  status finance.statutory_regime_status not null default 'draft',
  statutory_operations_enabled boolean not null default false,
  supplemental_double_entry_enabled boolean not null default false,
  accounting_signoff_reference text,
  accounting_signed_at timestamptz,
  legal_signoff_reference text,
  legal_signed_at timestamptz,
  activated_at timestamptz,
  suspended_at timestamptz,
  retired_at timestamptz,
  valid_from date not null default current_date,
  valid_to date,
  lock_version integer not null default 1 check (lock_version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (customer_workspace_id, property_id),
  check (jsonb_typeof(statutory_basis) = 'object'),
  check (valid_to is null or valid_to >= valid_from),
  check ((accounting_signoff_reference is null) = (accounting_signed_at is null)),
  check ((legal_signoff_reference is null) = (legal_signed_at is null)),
  check (
    statutory_operations_enabled is false
    or (
      status = 'active'
      and accounting_signoff_reference is not null
      and legal_signoff_reference is not null
      and activated_at is not null
    )
  )
);

create index statutory_regimes_tenant_status_idx
  on finance.statutory_accounting_regimes (tenant_id, status, property_id);
create index statutory_regimes_property_idx
  on finance.statutory_accounting_regimes (property_id);

create table finance.statutory_monthly_cycles (
  id uuid primary key default gen_random_uuid(),
  regime_id uuid not null references finance.statutory_accounting_regimes(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  accounting_period_id uuid not null references finance.accounting_periods(id) on delete restrict,
  operational_monthly_cycle_id uuid references finance.monthly_cycles(id) on delete restrict,
  status finance.statutory_cycle_status not null default 'draft',
  currency char(3) not null default 'RON' check (currency = 'RON'),
  opening_balance numeric(20,2) not null default 0,
  total_receipts numeric(20,2) not null default 0 check (total_receipts >= 0),
  total_payments numeric(20,2) not null default 0 check (total_payments >= 0),
  closing_balance numeric(20,2) generated always as
    (opening_balance + total_receipts - total_payments) stored,
  source_hash text check (source_hash is null or source_hash ~ '^[0-9a-f]{64}$'),
  snapshot_hash text check (snapshot_hash is null or snapshot_hash ~ '^[0-9a-f]{64}$'),
  prepared_at timestamptz,
  submitted_at timestamptz,
  approved_at timestamptz,
  closed_at timestamptz,
  cancelled_at timestamptz,
  lock_version integer not null default 1 check (lock_version > 0),
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique (regime_id, accounting_period_id)
);

create index statutory_cycles_tenant_status_idx
  on finance.statutory_monthly_cycles (tenant_id, status, created_at desc);
create index statutory_cycles_period_idx
  on finance.statutory_monthly_cycles (accounting_period_id);

create table finance.statutory_simple_entries (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references finance.statutory_monthly_cycles(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  entry_sequence bigint generated always as identity,
  entry_date date not null,
  direction finance.statutory_entry_direction not null,
  payment_medium finance.statutory_payment_medium not null,
  document_type text not null check (btrim(document_type) <> ''),
  document_number text not null check (btrim(document_number) <> ''),
  amount numeric(20,2) not null check (amount > 0),
  currency char(3) not null default 'RON' check (currency = 'RON'),
  description text not null check (btrim(description) <> ''),
  counterparty_name text,
  source_type text,
  source_id uuid,
  reversal_of_entry_id uuid references finance.statutory_simple_entries(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (cycle_id, document_type, document_number, direction),
  check ((source_type is null) = (source_id is null)),
  check (reversal_of_entry_id is null or reversal_of_entry_id <> id)
);

create index statutory_entries_cycle_sequence_idx
  on finance.statutory_simple_entries (cycle_id, entry_sequence);
create index statutory_entries_tenant_date_idx
  on finance.statutory_simple_entries (tenant_id, entry_date, id);

create table finance.statutory_cycle_transitions (
  id bigint generated always as identity primary key,
  cycle_id uuid not null references finance.statutory_monthly_cycles(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  from_status finance.statutory_cycle_status not null,
  to_status finance.statutory_cycle_status not null,
  actor_id uuid references auth.users(id) on delete restrict,
  reason text not null check (btrim(reason) <> ''),
  occurred_at timestamptz not null default statement_timestamp(),
  check (from_status <> to_status)
);

create index statutory_cycle_transitions_cycle_idx
  on finance.statutory_cycle_transitions (cycle_id, occurred_at, id);

create or replace function finance.validate_statutory_accounting_scope_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_workspace_tenant uuid;
  v_property_tenant uuid;
  v_regime record;
  v_period record;
begin
  if tg_table_name = 'statutory_accounting_regimes' then
    select tenant_id into v_workspace_tenant
      from platform.customer_workspaces where id = new.customer_workspace_id;
    select tenant_id into v_property_tenant
      from portfolio.properties where id = new.property_id;
    if v_workspace_tenant is distinct from new.tenant_id
       or v_property_tenant is distinct from new.tenant_id then
      raise exception 'statutory_regime_scope_mismatch' using errcode = '23514';
    end if;
  elsif tg_table_name = 'statutory_monthly_cycles' then
    select tenant_id, property_id, statutory_operations_enabled
      into v_regime
      from finance.statutory_accounting_regimes where id = new.regime_id;
    select tenant_id, property_id, starts_on, ends_on
      into v_period
      from finance.accounting_periods where id = new.accounting_period_id;
    if v_regime.tenant_id is distinct from new.tenant_id
       or v_regime.property_id is distinct from new.property_id
       or v_period.tenant_id is distinct from new.tenant_id
       or v_period.property_id is distinct from new.property_id then
      raise exception 'statutory_cycle_scope_mismatch' using errcode = '23514';
    end if;
    if v_regime.statutory_operations_enabled is not true then
      raise exception 'statutory_operations_not_enabled' using errcode = '42501';
    end if;
  elsif tg_table_name = 'statutory_simple_entries' then
    select tenant_id, property_id, status into v_regime
      from finance.statutory_monthly_cycles where id = new.cycle_id;
    if v_regime.tenant_id is distinct from new.tenant_id
       or v_regime.property_id is distinct from new.property_id then
      raise exception 'statutory_entry_scope_mismatch' using errcode = '23514';
    end if;
    if v_regime.status not in ('draft', 'collecting') then
      raise exception 'statutory_cycle_not_open_for_entries' using errcode = '55000';
    end if;
  end if;
  return new;
end
$$;

create trigger statutory_regimes_scope_guard
before insert or update on finance.statutory_accounting_regimes
for each row execute function finance.validate_statutory_accounting_scope_v1();
create trigger statutory_cycles_scope_guard
before insert or update on finance.statutory_monthly_cycles
for each row execute function finance.validate_statutory_accounting_scope_v1();
create trigger statutory_entries_scope_guard
before insert on finance.statutory_simple_entries
for each row execute function finance.validate_statutory_accounting_scope_v1();

create or replace function finance.protect_statutory_append_only_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'statutory_record_is_append_only' using errcode = '55000';
end
$$;

create trigger statutory_entries_append_only
before update or delete on finance.statutory_simple_entries
for each row execute function finance.protect_statutory_append_only_v1();
create trigger statutory_transitions_append_only
before update or delete on finance.statutory_cycle_transitions
for each row execute function finance.protect_statutory_append_only_v1();

create or replace function app_private.activate_statutory_accounting_regime_v1(
  p_regime_id uuid,
  p_expected_lock_version integer,
  p_actor_id uuid,
  p_reason text
)
returns finance.statutory_accounting_regimes
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_regime finance.statutory_accounting_regimes;
begin
  if p_regime_id is null or p_expected_lock_version is null or p_actor_id is null
     or nullif(btrim(p_reason), '') is null then
    raise exception 'statutory_activation_invalid_arguments' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('statutory_regime:' || p_regime_id::text, 0));
  select * into v_regime
    from finance.statutory_accounting_regimes
    where id = p_regime_id
    for update;
  if not found then
    raise exception 'statutory_regime_not_found' using errcode = 'P0002';
  end if;
  if v_regime.lock_version <> p_expected_lock_version then
    raise exception 'statutory_regime_lock_version_conflict' using errcode = '40001';
  end if;
  if v_regime.status not in ('validated', 'suspended') then
    raise exception 'statutory_regime_not_ready_for_activation' using errcode = '55000';
  end if;
  if v_regime.accounting_signoff_reference is null or v_regime.accounting_signed_at is null then
    raise exception 'statutory_accounting_signoff_required' using errcode = '42501';
  end if;
  if v_regime.legal_signoff_reference is null or v_regime.legal_signed_at is null then
    raise exception 'statutory_legal_signoff_required' using errcode = '42501';
  end if;

  update finance.statutory_accounting_regimes
  set status = 'active', statutory_operations_enabled = true,
      activated_at = statement_timestamp(), suspended_at = null,
      lock_version = lock_version + 1, updated_at = statement_timestamp()
  where id = p_regime_id
  returning * into v_regime;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    after_snapshot, reason
  ) values (
    v_regime.tenant_id, p_actor_id, 'service_role',
    'statutory.accounting.regime.activated', 'statutory_accounting_regime',
    v_regime.id,
    jsonb_build_object('status', v_regime.status, 'lock_version', v_regime.lock_version),
    p_reason
  );

  return v_regime;
end
$$;

-- PostgreSQL requires the migration actor to be able to SET ROLE to a new
-- owner. Grant that membership only for the ownership handoff, then remove it.
grant cladora_rpc_owner to current_user;
alter function app_private.activate_statutory_accounting_regime_v1(uuid, integer, uuid, text)
  owner to cladora_rpc_owner;
revoke cladora_rpc_owner from current_user;

alter table finance.statutory_accounting_regimes enable row level security;
alter table finance.statutory_monthly_cycles enable row level security;
alter table finance.statutory_simple_entries enable row level security;
alter table finance.statutory_cycle_transitions enable row level security;

create policy statutory_regimes_rpc_owner_all
  on finance.statutory_accounting_regimes for all to cladora_rpc_owner
  using (true) with check (true);
create policy statutory_cycles_rpc_owner_all
  on finance.statutory_monthly_cycles for all to cladora_rpc_owner
  using (true) with check (true);
create policy statutory_entries_rpc_owner_all
  on finance.statutory_simple_entries for all to cladora_rpc_owner
  using (true) with check (true);
create policy statutory_transitions_rpc_owner_all
  on finance.statutory_cycle_transitions for all to cladora_rpc_owner
  using (true) with check (true);
create policy statutory_audit_rpc_owner_insert
  on audit.events for insert to cladora_rpc_owner with check (true);

grant usage on schema finance, audit to cladora_rpc_owner;
grant select, update on finance.statutory_accounting_regimes to cladora_rpc_owner;
grant select, insert, update on finance.statutory_monthly_cycles to cladora_rpc_owner;
grant select, insert on finance.statutory_simple_entries to cladora_rpc_owner;
grant select, insert on finance.statutory_cycle_transitions to cladora_rpc_owner;
grant insert on audit.events to cladora_rpc_owner;
grant usage, select on sequence audit.events_id_seq to cladora_rpc_owner;

revoke all on table finance.statutory_accounting_regimes from public, anon, authenticated;
revoke all on table finance.statutory_monthly_cycles from public, anon, authenticated;
revoke all on table finance.statutory_simple_entries from public, anon, authenticated;
revoke all on table finance.statutory_cycle_transitions from public, anon, authenticated;
grant all on table finance.statutory_accounting_regimes to service_role;
grant all on table finance.statutory_monthly_cycles to service_role;
grant all on table finance.statutory_simple_entries to service_role;
grant all on table finance.statutory_cycle_transitions to service_role;
grant usage, select on sequence finance.statutory_simple_entries_entry_sequence_seq to service_role;
grant usage, select on sequence finance.statutory_cycle_transitions_id_seq to service_role;

revoke all on function finance.validate_statutory_accounting_scope_v1() from public, anon, authenticated;
revoke all on function finance.protect_statutory_append_only_v1() from public, anon, authenticated;
revoke all on function app_private.activate_statutory_accounting_regime_v1(uuid, integer, uuid, text)
  from public, anon, authenticated;
grant execute on function app_private.activate_statutory_accounting_regime_v1(uuid, integer, uuid, text)
  to service_role;

comment on table finance.statutory_accounting_regimes is
  'Romanian HOA statutory simple-entry regime. Supplemental double-entry never replaces statutory books.';
comment on table finance.statutory_simple_entries is
  'Append-only statutory receipt/payment records; corrections are new reversal records.';
comment on function app_private.activate_statutory_accounting_regime_v1(uuid, integer, uuid, text) is
  'Fail-closed service-role activation after independent accounting and legal sign-off.';

commit;
