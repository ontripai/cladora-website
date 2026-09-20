-- R10 Phase 2B: Romanian HOA cash-desk discipline, bank-deposit obligations,
-- petty-cash controls and statutory cash documents (Law 196/2018 & Law 70/2015).
begin;

-- =============================================================================
-- Enums
-- =============================================================================

create type finance.statutory_cash_desk_status as enum ('draft', 'active', 'suspended', 'closed');
create type finance.statutory_custody_transfer_kind as enum ('bank_deposit', 'bank_withdrawal');
create type finance.statutory_custody_transfer_status as enum ('draft', 'confirmed', 'cancelled');
create type finance.statutory_cash_closure_status as enum ('finalized');
create type finance.statutory_deposit_obligation_kind as enum ('hoa_24h_receipt', 'ceiling_50k_excess');
create type finance.statutory_deposit_obligation_status as enum ('pending', 'partially_settled', 'settled', 'expired');
create type finance.statutory_petty_cash_status as enum ('authorized', 'active', 'exhausted', 'closed', 'cancelled');
create type finance.statutory_petty_cash_expense_status as enum ('recorded', 'reversed');
create type finance.statutory_cash_document_type as enum (
  'chitanta_14_4_1',
  'dispozitie_14_4_4_plata',
  'dispozitie_14_4_4_incasare'
);
create type finance.statutory_cash_document_status as enum ('draft', 'finalized', 'superseded');

-- =============================================================================
-- Romanian Compliance Calendar Contract
-- =============================================================================

create table finance.statutory_compliance_calendars (
  jurisdiction char(2) not null default 'RO',
  calendar_date date not null,
  is_business_day boolean not null,
  source_version text not null default 'RO-LEGEA-53-2003-V2026',
  notes text,
  primary key (jurisdiction, calendar_date),
  check (jurisdiction = 'RO')
);

-- Seed Romanian business-day calendar (2025 to 2027) with statutory public holidays under Law 53/2003 Art. 139
insert into finance.statutory_compliance_calendars (jurisdiction, calendar_date, is_business_day, source_version, notes)
select
  'RO',
  d::date,
  case
    when extract(isodow from d) in (6, 7) then false
    -- Statutory holidays 2025
    when d::date in ('2025-01-01', '2025-01-02', '2025-01-06', '2025-01-07', '2025-01-24',
                     '2025-04-18', '2025-04-20', '2025-04-21', '2025-05-01', '2025-06-01',
                     '2025-06-08', '2025-06-09', '2025-08-15', '2025-11-30', '2025-12-01',
                     '2025-12-25', '2025-12-26') then false
    -- Statutory holidays 2026
    when d::date in ('2026-01-01', '2026-01-02', '2026-01-06', '2026-01-07', '2026-01-24',
                     '2026-04-10', '2026-04-12', '2026-04-13', '2026-05-01', '2026-05-31',
                     '2026-06-01', '2026-08-15', '2026-11-30', '2026-12-01', '2026-12-25',
                     '2026-12-26') then false
    -- Statutory holidays 2027
    when d::date in ('2027-01-01', '2027-01-02', '2027-01-06', '2027-01-07', '2027-01-24',
                     '2027-04-30', '2027-05-01', '2027-05-02', '2027-05-03', '2027-06-01',
                     '2027-06-20', '2027-06-21', '2027-08-15', '2027-11-30', '2027-12-01',
                     '2027-12-25', '2027-12-26') then false
    else true
  end,
  'RO-LEGEA-53-2003-V2026',
  'Romanian statutory business day definition'
from generate_series('2025-01-01'::date, '2027-12-31'::date, interval '1 day') as s(d);

-- Fail-closed business-day calculation
create or replace function finance.add_romanian_business_days_v1(
  p_start_date date,
  p_business_days integer,
  p_jurisdiction char(2) default 'RO'
)
returns date
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  v_curr date := p_start_date;
  v_remaining integer := p_business_days;
  v_is_biz boolean;
begin
  if p_start_date is null or p_business_days is null or p_business_days < 0 then
    raise exception 'invalid_business_day_arguments' using errcode = '22023';
  end if;
  while v_remaining > 0 loop
    v_curr := v_curr + 1;
    select is_business_day into v_is_biz
      from finance.statutory_compliance_calendars
     where jurisdiction = p_jurisdiction and calendar_date = v_curr;
    if not found then
      raise exception 'compliance_calendar_coverage_missing' using errcode = '22023';
    end if;
    if v_is_biz then
      v_remaining := v_remaining - 1;
    end if;
  end loop;
  return v_curr;
end;
$$;

-- =============================================================================
-- Cash Desk Tables
-- =============================================================================

create table finance.statutory_cash_desks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  regime_id uuid not null references finance.statutory_accounting_regimes(id) on delete restrict,
  code text not null check (btrim(code) <> ''),
  name text not null check (btrim(name) <> ''),
  currency char(3) not null default 'RON' check (currency = 'RON'),
  status finance.statutory_cash_desk_status not null default 'draft',
  daily_ceiling_amount numeric(20,2) not null default 50000.00 check (daily_ceiling_amount > 0),
  lock_version integer not null default 1 check (lock_version > 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  activated_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  activated_at timestamptz,
  unique (tenant_id, property_id, code),
  unique (tenant_id, idempotency_key),
  check ((status = 'draft' and activated_at is null and activated_by is null) or
         (status <> 'draft' and activated_at is not null and activated_by is not null))
);

create table finance.statutory_cash_entry_assignments (
  id uuid primary key default gen_random_uuid(),
  cash_desk_id uuid not null references finance.statutory_cash_desks(id) on delete restrict,
  statutory_simple_entry_id uuid not null unique references finance.statutory_simple_entries(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  entry_direction finance.statutory_entry_direction not null,
  amount numeric(20,2) not null check (amount > 0),
  assigned_at timestamptz not null default statement_timestamp(),
  assigned_by uuid not null references auth.users(id) on delete restrict,
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  unique (tenant_id, idempotency_key)
);

create table finance.statutory_cash_custody_transfers (
  id uuid primary key default gen_random_uuid(),
  cash_desk_id uuid not null references finance.statutory_cash_desks(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  bank_account_id uuid not null references payments.bank_accounts(id) on delete restrict,
  bank_transaction_id uuid references payments.bank_transactions(id) on delete restrict,
  transfer_kind finance.statutory_custody_transfer_kind not null,
  status finance.statutory_custody_transfer_status not null default 'draft',
  amount numeric(20,2) not null check (amount > 0),
  transfer_date date not null,
  supporting_document_reference text not null check (btrim(supporting_document_reference) <> ''),
  lock_version integer not null default 1 check (lock_version > 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  confirmed_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  confirmed_at timestamptz,
  unique (tenant_id, idempotency_key),
  check ((status = 'confirmed') = (confirmed_at is not null and confirmed_by is not null))
);

create table finance.statutory_cash_daily_closures (
  id uuid primary key default gen_random_uuid(),
  cash_desk_id uuid not null references finance.statutory_cash_desks(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  closure_date date not null,
  opening_balance numeric(20,2) not null check (opening_balance >= 0),
  total_receipts numeric(20,2) not null check (total_receipts >= 0),
  total_payments numeric(20,2) not null check (total_payments >= 0),
  total_deposits numeric(20,2) not null check (total_deposits >= 0),
  total_withdrawals numeric(20,2) not null check (total_withdrawals >= 0),
  closing_balance numeric(20,2) not null check (closing_balance >= 0),
  ceiling_threshold numeric(20,2) not null check (ceiling_threshold > 0),
  ceiling_exceeded boolean not null default false,
  excess_amount numeric(20,2) not null default 0.00 check (excess_amount >= 0),
  status finance.statutory_cash_closure_status not null default 'finalized',
  lock_version integer not null default 1 check (lock_version > 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  closed_by uuid not null references auth.users(id) on delete restrict,
  closed_at timestamptz not null default statement_timestamp(),
  unique (cash_desk_id, closure_date),
  unique (tenant_id, idempotency_key),
  check (closing_balance = opening_balance + total_receipts - total_payments - total_deposits + total_withdrawals),
  check ((ceiling_exceeded and excess_amount > 0 and closing_balance > ceiling_threshold) or
         (not ceiling_exceeded and excess_amount = 0 and closing_balance <= ceiling_threshold))
);

create or replace function finance.protect_finalized_cash_closure_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' or old.status = 'finalized' then
    raise exception 'finalized_cash_closure_is_immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger statutory_cash_closure_immutable
before update or delete on finance.statutory_cash_daily_closures
for each row execute function finance.protect_finalized_cash_closure_v1();

-- =============================================================================
-- Petty Cash & Deposit Obligations Tables
-- =============================================================================

create table finance.statutory_petty_cash_authorizations (
  id uuid primary key default gen_random_uuid(),
  cash_desk_id uuid not null references finance.statutory_cash_desks(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  adopted_resolution_id uuid not null references governance.resolutions(id) on delete restrict,
  calendar_month date not null check (calendar_month = date_trunc('month', calendar_month)::date),
  authorized_amount numeric(20,2) not null check (authorized_amount > 0 and authorized_amount <= 1000.00),
  purpose text not null check (btrim(purpose) <> ''),
  is_unforeseen_expense boolean not null check (is_unforeseen_expense = true),
  status finance.statutory_petty_cash_status not null default 'authorized',
  lock_version integer not null default 1 check (lock_version > 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (cash_desk_id, calendar_month),
  unique (tenant_id, idempotency_key)
);

create table finance.statutory_petty_cash_expenses (
  id uuid primary key default gen_random_uuid(),
  authorization_id uuid not null references finance.statutory_petty_cash_authorizations(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  amount numeric(20,2) not null check (amount > 0),
  expense_date date not null,
  description text not null check (btrim(description) <> ''),
  supporting_document_type text not null check (btrim(supporting_document_type) <> ''),
  supporting_document_number text not null check (btrim(supporting_document_number) <> ''),
  supporting_document_hash text not null check (supporting_document_hash ~ '^[0-9a-f]{64}$'),
  written_authority_reference text not null check (btrim(written_authority_reference) <> ''),
  status finance.statutory_petty_cash_expense_status not null default 'recorded',
  reversal_of_id uuid references finance.statutory_petty_cash_expenses(id) on delete restrict,
  reversal_reason text,
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, idempotency_key),
  check (reversal_of_id is null or reversal_of_id <> id),
  check ((status = 'reversed') = (reversal_reason is not null))
);

create table finance.statutory_cash_deposit_obligations (
  id uuid primary key default gen_random_uuid(),
  cash_desk_id uuid not null references finance.statutory_cash_desks(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  obligation_kind finance.statutory_deposit_obligation_kind not null,
  statutory_simple_entry_id uuid references finance.statutory_simple_entries(id) on delete restrict,
  closure_id uuid references finance.statutory_cash_daily_closures(id) on delete restrict,
  petty_cash_authorization_id uuid references finance.statutory_petty_cash_authorizations(id) on delete restrict,
  required_amount numeric(20,2) not null check (required_amount > 0),
  settled_amount numeric(20,2) not null default 0.00 check (settled_amount >= 0 and settled_amount <= required_amount),
  due_at timestamptz not null,
  status finance.statutory_deposit_obligation_status not null default 'pending',
  has_exception boolean not null default false,
  exception_reason text,
  exception_evidence jsonb check (exception_evidence is null or jsonb_typeof(exception_evidence) = 'object'),
  exception_beneficiary_class text,
  exception_scheduled_date date,
  exception_expiry_date date,
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default statement_timestamp(),
  settled_at timestamptz,
  unique (tenant_id, idempotency_key),
  check ((obligation_kind = 'hoa_24h_receipt' and statutory_simple_entry_id is not null) or
         (obligation_kind = 'ceiling_50k_excess' and closure_id is not null)),
  check (status <> 'settled' or settled_amount = required_amount),
  check (not has_exception or (exception_reason is not null and exception_evidence is not null and exception_beneficiary_class is not null and exception_scheduled_date is not null and exception_expiry_date is not null))
);

create table finance.statutory_cash_documents (
  id uuid primary key default gen_random_uuid(),
  cash_desk_id uuid not null references finance.statutory_cash_desks(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  document_type finance.statutory_cash_document_type not null,
  document_series text not null check (btrim(document_series) <> ''),
  document_number text not null check (btrim(document_number) <> ''),
  document_date date not null,
  amount numeric(20,2) not null check (amount > 0),
  currency char(3) not null default 'RON' check (currency = 'RON'),
  beneficiary_or_payer text not null check (btrim(beneficiary_or_payer) <> ''),
  purpose text not null check (btrim(purpose) <> ''),
  statutory_simple_entry_id uuid references finance.statutory_simple_entries(id) on delete restrict,
  petty_cash_expense_id uuid references finance.statutory_petty_cash_expenses(id) on delete restrict,
  semantic_payload jsonb not null check (jsonb_typeof(semantic_payload) = 'object'),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  renderer_status text not null default 'legal_review_required' check (renderer_status in ('semantic_schema_verified', 'legal_review_required')),
  status finance.statutory_cash_document_status not null default 'draft',
  supersedes_id uuid references finance.statutory_cash_documents(id) on delete restrict,
  lock_version integer not null default 1 check (lock_version > 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  created_by uuid not null references auth.users(id) on delete restrict,
  finalized_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  finalized_at timestamptz,
  unique (cash_desk_id, document_type, document_series, document_number),
  unique (tenant_id, idempotency_key),
  check ((status in ('finalized', 'superseded')) = (finalized_at is not null and finalized_by is not null)),
  check (supersedes_id is null or supersedes_id <> id)
);

create or replace function finance.protect_finalized_cash_document_v1()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' or old.status = 'finalized' then
    raise exception 'finalized_cash_document_is_immutable' using errcode = '55000';
  end if;
  return new;
end;
$$;

create trigger statutory_cash_document_immutable
before update or delete on finance.statutory_cash_documents
for each row execute function finance.protect_finalized_cash_document_v1();

-- =============================================================================
-- Indexes
-- =============================================================================

create index statutory_cash_desks_property_idx on finance.statutory_cash_desks(property_id);
create index statutory_cash_desks_regime_idx on finance.statutory_cash_desks(regime_id);
create index statutory_cash_desks_status_idx on finance.statutory_cash_desks(status);
create index statutory_cash_desks_created_by_idx on finance.statutory_cash_desks(created_by);
create index statutory_cash_desks_activated_by_idx on finance.statutory_cash_desks(activated_by);

create index statutory_cash_entry_assign_desk_idx on finance.statutory_cash_entry_assignments(cash_desk_id);
create index statutory_cash_entry_assign_entry_idx on finance.statutory_cash_entry_assignments(statutory_simple_entry_id);
create index statutory_cash_entry_assign_property_idx on finance.statutory_cash_entry_assignments(property_id);
create index statutory_cash_entry_assign_user_idx on finance.statutory_cash_entry_assignments(assigned_by);

create index statutory_cash_transfers_desk_idx on finance.statutory_cash_custody_transfers(cash_desk_id);
create index statutory_cash_transfers_bank_acc_idx on finance.statutory_cash_custody_transfers(bank_account_id);
create index statutory_cash_transfers_bank_tx_idx on finance.statutory_cash_custody_transfers(bank_transaction_id);
create index statutory_cash_transfers_property_idx on finance.statutory_cash_custody_transfers(property_id);
create index statutory_cash_transfers_created_by_idx on finance.statutory_cash_custody_transfers(created_by);
create index statutory_cash_transfers_confirmed_by_idx on finance.statutory_cash_custody_transfers(confirmed_by);

create index statutory_cash_closures_desk_date_idx on finance.statutory_cash_daily_closures(cash_desk_id, closure_date);
create index statutory_cash_closures_property_idx on finance.statutory_cash_daily_closures(property_id);
create index statutory_cash_closures_user_idx on finance.statutory_cash_daily_closures(closed_by);

create index statutory_deposit_obligations_desk_idx on finance.statutory_cash_deposit_obligations(cash_desk_id);
create index statutory_deposit_obligations_entry_idx on finance.statutory_cash_deposit_obligations(statutory_simple_entry_id);
create index statutory_deposit_obligations_closure_idx on finance.statutory_cash_deposit_obligations(closure_id);
create index statutory_deposit_obligations_petty_idx on finance.statutory_cash_deposit_obligations(petty_cash_authorization_id);
create index statutory_deposit_obligations_property_idx on finance.statutory_cash_deposit_obligations(property_id);
create index statutory_deposit_obligations_status_idx on finance.statutory_cash_deposit_obligations(status);

create index statutory_petty_authorizations_desk_idx on finance.statutory_petty_cash_authorizations(cash_desk_id);
create index statutory_petty_authorizations_res_idx on finance.statutory_petty_cash_authorizations(adopted_resolution_id);
create index statutory_petty_authorizations_property_idx on finance.statutory_petty_cash_authorizations(property_id);
create index statutory_petty_authorizations_user_idx on finance.statutory_petty_cash_authorizations(created_by);

create index statutory_petty_expenses_auth_idx on finance.statutory_petty_cash_expenses(authorization_id);
create index statutory_petty_expenses_rev_idx on finance.statutory_petty_cash_expenses(reversal_of_id);
create index statutory_petty_expenses_property_idx on finance.statutory_petty_cash_expenses(property_id);
create index statutory_petty_expenses_user_idx on finance.statutory_petty_cash_expenses(created_by);

create index statutory_cash_documents_desk_idx on finance.statutory_cash_documents(cash_desk_id);
create index statutory_cash_documents_entry_idx on finance.statutory_cash_documents(statutory_simple_entry_id);
create index statutory_cash_documents_petty_idx on finance.statutory_cash_documents(petty_cash_expense_id);
create index statutory_cash_documents_super_idx on finance.statutory_cash_documents(supersedes_id);
create index statutory_cash_documents_property_idx on finance.statutory_cash_documents(property_id);
create index statutory_cash_documents_created_by_idx on finance.statutory_cash_documents(created_by);
create index statutory_cash_documents_finalized_by_idx on finance.statutory_cash_documents(finalized_by);

-- =============================================================================
-- Derived Balance Calculations
-- =============================================================================

create or replace function finance.statutory_cash_balance_v1(p_cash_desk_id uuid)
returns numeric(20,2)
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  v_desk finance.statutory_cash_desks;
  v_receipts numeric(20,2);
  v_payments numeric(20,2);
  v_deposits numeric(20,2);
  v_withdrawals numeric(20,2);
begin
  select * into v_desk from finance.statutory_cash_desks where id = p_cash_desk_id;
  if not found then
    raise exception 'statutory_cash_desk_not_found' using errcode = 'P0002';
  end if;

  select coalesce(sum(amount), 0.00)::numeric(20,2) into v_receipts
    from finance.statutory_cash_entry_assignments
   where cash_desk_id = p_cash_desk_id and entry_direction = 'receipt';

  select coalesce(sum(amount), 0.00)::numeric(20,2) into v_payments
    from finance.statutory_cash_entry_assignments
   where cash_desk_id = p_cash_desk_id and entry_direction = 'payment';

  select coalesce(sum(amount), 0.00)::numeric(20,2) into v_deposits
    from finance.statutory_cash_custody_transfers
   where cash_desk_id = p_cash_desk_id and transfer_kind = 'bank_deposit' and status = 'confirmed';

  select coalesce(sum(amount), 0.00)::numeric(20,2) into v_withdrawals
    from finance.statutory_cash_custody_transfers
   where cash_desk_id = p_cash_desk_id and transfer_kind = 'bank_withdrawal' and status = 'confirmed';

  return (v_receipts - v_payments - v_deposits + v_withdrawals);
end;
$$;

create or replace function finance.statutory_petty_cash_balance_v1(p_authorization_id uuid)
returns numeric(20,2)
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  v_auth finance.statutory_petty_cash_authorizations;
  v_active_spent numeric(20,2);
begin
  select * into v_auth from finance.statutory_petty_cash_authorizations where id = p_authorization_id;
  if not found then
    raise exception 'statutory_petty_cash_authorization_not_found' using errcode = 'P0002';
  end if;

  select coalesce(sum(amount), 0.00)::numeric(20,2) into v_active_spent
    from finance.statutory_petty_cash_expenses
   where authorization_id = p_authorization_id
     and status = 'recorded'
     and reversal_of_id is null;

  return (v_auth.authorized_amount - v_active_spent);
end;
$$;

-- =============================================================================
-- Mutation RPCs
-- =============================================================================

create or replace function app_private.create_statutory_cash_desk_v1(
  p_regime_id uuid,
  p_code text,
  p_name text,
  p_daily_ceiling numeric,
  p_actor_id uuid,
  p_idempotency_key text,
  p_payload_hash text
)
returns finance.statutory_cash_desks
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_regime finance.statutory_accounting_regimes;
  v_desk finance.statutory_cash_desks;
  v_ceiling numeric(20,2) := coalesce(p_daily_ceiling, 50000.00);
begin
  if p_regime_id is null or nullif(btrim(p_code), '') is null or nullif(btrim(p_name), '') is null
     or v_ceiling <= 0 or p_actor_id is null or nullif(btrim(p_idempotency_key), '') is null
     or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'statutory_cash_desk_invalid_arguments' using errcode = '22023';
  end if;

  select * into v_regime from finance.statutory_accounting_regimes where id = p_regime_id;
  if not found then
    raise exception 'statutory_regime_not_found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('statutory_cash_desk_create:' || p_regime_id::text || ':' || btrim(p_code) || ':' || p_idempotency_key, 0));

  select * into v_desk from finance.statutory_cash_desks
   where tenant_id = v_regime.tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_desk.payload_hash <> p_payload_hash then
      raise exception 'statutory_cash_desk_idempotency_conflict' using errcode = '23505';
    end if;
    return v_desk;
  end if;

  insert into finance.statutory_cash_desks (
    tenant_id, property_id, regime_id, code, name, currency, status,
    daily_ceiling_amount, idempotency_key, payload_hash, created_by
  ) values (
    v_regime.tenant_id, v_regime.property_id, p_regime_id, btrim(p_code), btrim(p_name), 'RON', 'draft',
    v_ceiling, p_idempotency_key, p_payload_hash, p_actor_id
  ) returning * into v_desk;

  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_desk.tenant_id, p_actor_id, 'service_role', 'statutory.cash_desk.created', 'statutory_cash_desk', v_desk.id,
    jsonb_build_object('code', v_desk.code, 'daily_ceiling', v_desk.daily_ceiling_amount), 'R10 statutory cash desk registered');

  return v_desk;
end;
$$;

create or replace function app_private.activate_statutory_cash_desk_v1(
  p_cash_desk_id uuid,
  p_expected_lock_version integer,
  p_actor_id uuid,
  p_reason text
)
returns finance.statutory_cash_desks
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_desk finance.statutory_cash_desks;
begin
  if p_cash_desk_id is null or p_expected_lock_version is null or p_actor_id is null or nullif(btrim(p_reason), '') is null then
    raise exception 'statutory_cash_desk_activate_invalid_arguments' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('statutory_cash_desk:' || p_cash_desk_id::text, 0));

  select * into v_desk from finance.statutory_cash_desks where id = p_cash_desk_id for update;
  if not found then
    raise exception 'statutory_cash_desk_not_found' using errcode = 'P0002';
  end if;

  if v_desk.lock_version <> p_expected_lock_version then
    raise exception 'statutory_cash_desk_lock_version_conflict' using errcode = '40001';
  end if;

  if v_desk.status <> 'draft' then
    raise exception 'statutory_cash_desk_not_draft' using errcode = '55000';
  end if;

  update finance.statutory_cash_desks
     set status = 'active',
         activated_by = p_actor_id,
         activated_at = statement_timestamp(),
         lock_version = lock_version + 1
   where id = p_cash_desk_id
  returning * into v_desk;

  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_desk.tenant_id, p_actor_id, 'service_role', 'statutory.cash_desk.activated', 'statutory_cash_desk', v_desk.id,
    jsonb_build_object('status', v_desk.status, 'lock_version', v_desk.lock_version), p_reason);

  return v_desk;
end;
$$;

create or replace function app_private.assign_cash_simple_entry_v1(
  p_cash_desk_id uuid,
  p_statutory_simple_entry_id uuid,
  p_actor_id uuid,
  p_idempotency_key text,
  p_payload_hash text
)
returns finance.statutory_cash_entry_assignments
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_desk finance.statutory_cash_desks;
  v_entry finance.statutory_simple_entries;
  v_assign finance.statutory_cash_entry_assignments;
  v_curr_balance numeric(20,2);
  v_due timestamptz;
  v_ob_idempotency text;
  v_ob_hash text;
begin
  if p_cash_desk_id is null or p_statutory_simple_entry_id is null or p_actor_id is null
     or nullif(btrim(p_idempotency_key), '') is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'cash_entry_assignment_invalid_arguments' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('statutory_cash_desk:' || p_cash_desk_id::text, 0));

  select * into v_desk from finance.statutory_cash_desks where id = p_cash_desk_id;
  if not found then
    raise exception 'statutory_cash_desk_not_found' using errcode = 'P0002';
  end if;

  if v_desk.status <> 'active' then
    raise exception 'statutory_cash_desk_not_active' using errcode = '55000';
  end if;

  select * into v_assign from finance.statutory_cash_entry_assignments
   where tenant_id = v_desk.tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_assign.payload_hash <> p_payload_hash then
      raise exception 'cash_entry_assignment_idempotency_conflict' using errcode = '23505';
    end if;
    return v_assign;
  end if;

  select * into v_entry from finance.statutory_simple_entries where id = p_statutory_simple_entry_id for update;
  if not found then
    raise exception 'statutory_simple_entry_not_found' using errcode = 'P0002';
  end if;

  if v_entry.payment_medium <> 'cash' then
    raise exception 'only_cash_entries_can_be_assigned_to_cash_desk' using errcode = '23514';
  end if;

  if v_entry.tenant_id <> v_desk.tenant_id or v_entry.property_id <> v_desk.property_id then
    raise exception 'cash_entry_scope_mismatch' using errcode = '23514';
  end if;

  -- Verify current balance does not drop below zero if payment
  if v_entry.direction = 'payment' then
    v_curr_balance := finance.statutory_cash_balance_v1(p_cash_desk_id);
    if v_curr_balance < v_entry.amount then
      raise exception 'cash_desk_balance_insufficient' using errcode = '23514';
    end if;
  end if;

  insert into finance.statutory_cash_entry_assignments (
    cash_desk_id, statutory_simple_entry_id, tenant_id, property_id,
    entry_direction, amount, assigned_by, idempotency_key, payload_hash
  ) values (
    p_cash_desk_id, p_statutory_simple_entry_id, v_desk.tenant_id, v_desk.property_id,
    v_entry.direction, v_entry.amount, p_actor_id, p_idempotency_key, p_payload_hash
  ) returning * into v_assign;

  -- Law 196/2018 Art. 67(2): 24-hour statutory deposit obligation created for cash receipts
  if v_entry.direction = 'receipt' then
    v_due := v_entry.entry_date::timestamptz + interval '24 hours';
    v_ob_idempotency := 'obligation:hoa24h:' || v_assign.id::text;
    v_ob_hash := encode(extensions.digest(convert_to(v_ob_idempotency, 'UTF8'), 'sha256'), 'hex');

    insert into finance.statutory_cash_deposit_obligations (
      cash_desk_id, tenant_id, property_id, obligation_kind, statutory_simple_entry_id,
      required_amount, settled_amount, due_at, status, idempotency_key, payload_hash
    ) values (
      p_cash_desk_id, v_desk.tenant_id, v_desk.property_id, 'hoa_24h_receipt', v_entry.id,
      v_entry.amount, 0.00, v_due, 'pending', v_ob_idempotency, v_ob_hash
    );
  end if;

  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_desk.tenant_id, p_actor_id, 'service_role', 'statutory.cash_entry.assigned', 'statutory_cash_entry_assignment', v_assign.id,
    jsonb_build_object('direction', v_assign.entry_direction, 'amount', v_assign.amount), 'Cash entry assigned to cash desk');

  return v_assign;
end;
$$;

create or replace function app_private.record_cash_custody_transfer_v1(
  p_cash_desk_id uuid,
  p_bank_account_id uuid,
  p_transfer_kind finance.statutory_custody_transfer_kind,
  p_amount numeric,
  p_transfer_date date,
  p_supporting_document_reference text,
  p_bank_transaction_id uuid,
  p_actor_id uuid,
  p_idempotency_key text,
  p_payload_hash text
)
returns finance.statutory_cash_custody_transfers
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_desk finance.statutory_cash_desks;
  v_bank payments.bank_accounts;
  v_transfer finance.statutory_cash_custody_transfers;
  v_curr_balance numeric(20,2);
begin
  if p_cash_desk_id is null or p_bank_account_id is null or p_transfer_kind is null
     or p_amount is null or p_amount <= 0 or p_transfer_date is null
     or nullif(btrim(p_supporting_document_reference), '') is null or p_actor_id is null
     or nullif(btrim(p_idempotency_key), '') is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'cash_custody_transfer_invalid_arguments' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('statutory_cash_desk:' || p_cash_desk_id::text, 0));

  select * into v_desk from finance.statutory_cash_desks where id = p_cash_desk_id;
  if not found then
    raise exception 'statutory_cash_desk_not_found' using errcode = 'P0002';
  end if;

  if v_desk.status <> 'active' then
    raise exception 'statutory_cash_desk_not_active' using errcode = '55000';
  end if;

  select * into v_transfer from finance.statutory_cash_custody_transfers
   where tenant_id = v_desk.tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_transfer.payload_hash <> p_payload_hash then
      raise exception 'cash_custody_transfer_idempotency_conflict' using errcode = '23505';
    end if;
    return v_transfer;
  end if;

  select * into v_bank from payments.bank_accounts where id = p_bank_account_id;
  if not found then
    raise exception 'bank_account_not_found' using errcode = 'P0002';
  end if;

  if v_bank.tenant_id <> v_desk.tenant_id or (v_bank.property_id is not null and v_bank.property_id <> v_desk.property_id) then
    raise exception 'bank_account_scope_mismatch' using errcode = '23514';
  end if;

  -- Invariant 8: Bank deposit decreases cash desk balance, so desk must have sufficient funds
  if p_transfer_kind = 'bank_deposit' then
    v_curr_balance := finance.statutory_cash_balance_v1(p_cash_desk_id);
    if v_curr_balance < p_amount then
      raise exception 'cash_desk_insufficient_for_bank_deposit' using errcode = '23514';
    end if;
  end if;

  insert into finance.statutory_cash_custody_transfers (
    cash_desk_id, tenant_id, property_id, bank_account_id, bank_transaction_id,
    transfer_kind, status, amount, transfer_date, supporting_document_reference,
    lock_version, idempotency_key, payload_hash, created_by, confirmed_by, confirmed_at
  ) values (
    p_cash_desk_id, v_desk.tenant_id, v_desk.property_id, p_bank_account_id, p_bank_transaction_id,
    p_transfer_kind, 'confirmed', p_amount, p_transfer_date, btrim(p_supporting_document_reference),
    1, p_idempotency_key, p_payload_hash, p_actor_id, p_actor_id, statement_timestamp()
  ) returning * into v_transfer;

  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_desk.tenant_id, p_actor_id, 'service_role', 'statutory.custody_transfer.confirmed', 'statutory_cash_custody_transfer', v_transfer.id,
    jsonb_build_object('kind', v_transfer.transfer_kind, 'amount', v_transfer.amount), 'Internal bank cash custody transfer confirmed');

  return v_transfer;
end;
$$;

create or replace function app_private.close_statutory_cash_day_v1(
  p_cash_desk_id uuid,
  p_closure_date date,
  p_actor_id uuid,
  p_idempotency_key text,
  p_payload_hash text
)
returns finance.statutory_cash_daily_closures
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_desk finance.statutory_cash_desks;
  v_closure finance.statutory_cash_daily_closures;
  v_prev_closure finance.statutory_cash_daily_closures;
  v_opening numeric(20,2) := 0.00;
  v_receipts numeric(20,2);
  v_payments numeric(20,2);
  v_deposits numeric(20,2);
  v_withdrawals numeric(20,2);
  v_closing numeric(20,2);
  v_exceeded boolean := false;
  v_excess numeric(20,2) := 0.00;
  v_due_date date;
  v_ob_idempotency text;
  v_ob_hash text;
begin
  if p_cash_desk_id is null or p_closure_date is null or p_actor_id is null
     or nullif(btrim(p_idempotency_key), '') is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'cash_daily_closure_invalid_arguments' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('statutory_cash_desk:' || p_cash_desk_id::text, 0));

  select * into v_desk from finance.statutory_cash_desks where id = p_cash_desk_id;
  if not found then
    raise exception 'statutory_cash_desk_not_found' using errcode = 'P0002';
  end if;

  if v_desk.status <> 'active' then
    raise exception 'statutory_cash_desk_not_active' using errcode = '55000';
  end if;

  select * into v_closure from finance.statutory_cash_daily_closures
   where tenant_id = v_desk.tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_closure.payload_hash <> p_payload_hash then
      raise exception 'cash_daily_closure_idempotency_conflict' using errcode = '23505';
    end if;
    return v_closure;
  end if;

  -- Ensure date is not already closed
  if exists (select 1 from finance.statutory_cash_daily_closures where cash_desk_id = p_cash_desk_id and closure_date = p_closure_date) then
    raise exception 'statutory_cash_day_already_closed' using errcode = '23505';
  end if;

  -- Find opening balance from most recent previous closure
  select * into v_prev_closure from finance.statutory_cash_daily_closures
   where cash_desk_id = p_cash_desk_id and closure_date < p_closure_date
   order by closure_date desc limit 1;
  if found then
    v_opening := v_prev_closure.closing_balance;
  end if;

  -- Compute totals for the given closure date
  select coalesce(sum(a.amount), 0.00)::numeric(20,2) into v_receipts
    from finance.statutory_cash_entry_assignments a
    join finance.statutory_simple_entries e on e.id = a.statutory_simple_entry_id
   where a.cash_desk_id = p_cash_desk_id and a.entry_direction = 'receipt' and e.entry_date = p_closure_date;

  select coalesce(sum(a.amount), 0.00)::numeric(20,2) into v_payments
    from finance.statutory_cash_entry_assignments a
    join finance.statutory_simple_entries e on e.id = a.statutory_simple_entry_id
   where a.cash_desk_id = p_cash_desk_id and a.entry_direction = 'payment' and e.entry_date = p_closure_date;

  select coalesce(sum(t.amount), 0.00)::numeric(20,2) into v_deposits
    from finance.statutory_cash_custody_transfers t
   where t.cash_desk_id = p_cash_desk_id and t.transfer_kind = 'bank_deposit'
     and t.status = 'confirmed' and t.transfer_date = p_closure_date;

  select coalesce(sum(t.amount), 0.00)::numeric(20,2) into v_withdrawals
    from finance.statutory_cash_custody_transfers t
   where t.cash_desk_id = p_cash_desk_id and t.transfer_kind = 'bank_withdrawal'
     and t.status = 'confirmed' and t.transfer_date = p_closure_date;

  v_closing := v_opening + v_receipts - v_payments - v_deposits + v_withdrawals;
  if v_closing < 0 then
    raise exception 'closing_cash_balance_cannot_be_negative' using errcode = '23514';
  end if;

  if v_closing > v_desk.daily_ceiling_amount then
    v_exceeded := true;
    v_excess := v_closing - v_desk.daily_ceiling_amount;
  end if;

  insert into finance.statutory_cash_daily_closures (
    cash_desk_id, tenant_id, property_id, closure_date,
    opening_balance, total_receipts, total_payments, total_deposits, total_withdrawals,
    closing_balance, ceiling_threshold, ceiling_exceeded, excess_amount,
    status, lock_version, idempotency_key, payload_hash, closed_by
  ) values (
    p_cash_desk_id, v_desk.tenant_id, v_desk.property_id, p_closure_date,
    v_opening, v_receipts, v_payments, v_deposits, v_withdrawals,
    v_closing, v_desk.daily_ceiling_amount, v_exceeded, v_excess,
    'finalized', 1, p_idempotency_key, p_payload_hash, p_actor_id
  ) returning * into v_closure;

  -- Law 70/2015 Art. 4²: If 50,000 RON ceiling exceeded, deposit obligation due within 2 Romanian business days
  if v_exceeded then
    v_due_date := finance.add_romanian_business_days_v1(p_closure_date, 2);
    v_ob_idempotency := 'obligation:ceiling50k:' || v_closure.id::text;
    v_ob_hash := encode(extensions.digest(convert_to(v_ob_idempotency, 'UTF8'), 'sha256'), 'hex');

    insert into finance.statutory_cash_deposit_obligations (
      cash_desk_id, tenant_id, property_id, obligation_kind, closure_id,
      required_amount, settled_amount, due_at, status, idempotency_key, payload_hash
    ) values (
      p_cash_desk_id, v_desk.tenant_id, v_desk.property_id, 'ceiling_50k_excess', v_closure.id,
      v_excess, 0.00, v_due_date::timestamptz + interval '18 hours', 'pending', v_ob_idempotency, v_ob_hash
    );
  end if;

  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_desk.tenant_id, p_actor_id, 'service_role', 'statutory.cash_day.closed', 'statutory_cash_daily_closure', v_closure.id,
    jsonb_build_object('closing_balance', v_closure.closing_balance, 'ceiling_exceeded', v_closure.ceiling_exceeded),
    'End of day cash closure recorded');

  return v_closure;
end;
$$;

create or replace function app_private.settle_cash_deposit_obligation_v1(
  p_obligation_id uuid,
  p_custody_transfer_id uuid,
  p_settled_amount numeric,
  p_actor_id uuid,
  p_reason text
)
returns finance.statutory_cash_deposit_obligations
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_ob finance.statutory_cash_deposit_obligations;
  v_transfer finance.statutory_cash_custody_transfers;
  v_new_settled numeric(20,2);
  v_new_status finance.statutory_deposit_obligation_status;
begin
  if p_obligation_id is null or p_custody_transfer_id is null or p_settled_amount is null
     or p_settled_amount <= 0 or p_actor_id is null or nullif(btrim(p_reason), '') is null then
    raise exception 'settle_obligation_invalid_arguments' using errcode = '22023';
  end if;

  select * into v_ob from finance.statutory_cash_deposit_obligations where id = p_obligation_id for update;
  if not found then
    raise exception 'statutory_deposit_obligation_not_found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('statutory_cash_desk:' || v_ob.cash_desk_id::text, 0));

  select * into v_transfer from finance.statutory_cash_custody_transfers where id = p_custody_transfer_id;
  if not found then
    raise exception 'custody_transfer_not_found' using errcode = 'P0002';
  end if;

  if v_transfer.transfer_kind <> 'bank_deposit' or v_transfer.status <> 'confirmed' then
    raise exception 'transfer_must_be_confirmed_bank_deposit' using errcode = '23514';
  end if;

  if v_transfer.cash_desk_id <> v_ob.cash_desk_id then
    raise exception 'obligation_transfer_desk_mismatch' using errcode = '23514';
  end if;

  v_new_settled := v_ob.settled_amount + p_settled_amount;
  if v_new_settled > v_ob.required_amount then
    raise exception 'settlement_amount_exceeds_obligation' using errcode = '23514';
  end if;

  if v_new_settled = v_ob.required_amount then
    v_new_status := 'settled';
  else
    v_new_status := 'partially_settled';
  end if;

  update finance.statutory_cash_deposit_obligations
     set settled_amount = v_new_settled,
         status = v_new_status,
         settled_at = case when v_new_status = 'settled' then statement_timestamp() else settled_at end
   where id = p_obligation_id
  returning * into v_ob;

  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_ob.tenant_id, p_actor_id, 'service_role', 'statutory.deposit_obligation.settled', 'statutory_cash_deposit_obligation', v_ob.id,
    jsonb_build_object('settled_amount', v_ob.settled_amount, 'status', v_ob.status), p_reason);

  return v_ob;
end;
$$;

create or replace function app_private.authorize_statutory_petty_cash_v1(
  p_cash_desk_id uuid,
  p_adopted_resolution_id uuid,
  p_calendar_month date,
  p_authorized_amount numeric,
  p_purpose text,
  p_is_unforeseen_expense boolean,
  p_actor_id uuid,
  p_idempotency_key text,
  p_payload_hash text
)
returns finance.statutory_petty_cash_authorizations
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_desk finance.statutory_cash_desks;
  v_res governance.resolutions;
  v_meeting governance.meetings;
  v_auth finance.statutory_petty_cash_authorizations;
  v_month date;
begin
  if p_cash_desk_id is null or p_adopted_resolution_id is null or p_calendar_month is null
     or p_authorized_amount is null or p_authorized_amount <= 0 or p_authorized_amount > 1000.00
     or nullif(btrim(p_purpose), '') is null or p_is_unforeseen_expense is not true
     or p_actor_id is null or nullif(btrim(p_idempotency_key), '') is null
     or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'petty_cash_authorization_invalid_arguments' using errcode = '22023';
  end if;

  v_month := date_trunc('month', p_calendar_month)::date;

  perform pg_advisory_xact_lock(hashtextextended('statutory_cash_desk:' || p_cash_desk_id::text, 0));

  select * into v_desk from finance.statutory_cash_desks where id = p_cash_desk_id;
  if not found then
    raise exception 'statutory_cash_desk_not_found' using errcode = 'P0002';
  end if;

  if v_desk.status <> 'active' then
    raise exception 'statutory_cash_desk_not_active' using errcode = '55000';
  end if;

  select * into v_auth from finance.statutory_petty_cash_authorizations
   where tenant_id = v_desk.tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_auth.payload_hash <> p_payload_hash then
      raise exception 'petty_cash_authorization_idempotency_conflict' using errcode = '23505';
    end if;
    return v_auth;
  end if;

  -- Validate General Assembly adopted resolution
  select r.* into v_res from governance.resolutions r where r.id = p_adopted_resolution_id;
  if not found or not v_res.adopted then
    raise exception 'adopted_resolution_required_for_petty_cash' using errcode = '23514';
  end if;

  select m.* into v_meeting from governance.meetings m where m.id = v_res.meeting_id;
  if not found or v_meeting.property_id <> v_desk.property_id or v_res.tenant_id <> v_desk.tenant_id then
    raise exception 'resolution_property_scope_mismatch' using errcode = '23514';
  end if;

  -- Ensure cumulative authorizations for this cash desk and month do not exceed 1000 RON
  if exists (
    select 1 from finance.statutory_petty_cash_authorizations
     where cash_desk_id = p_cash_desk_id and calendar_month = v_month
  ) then
    raise exception 'petty_cash_already_authorized_for_month' using errcode = '23505';
  end if;

  insert into finance.statutory_petty_cash_authorizations (
    cash_desk_id, tenant_id, property_id, adopted_resolution_id, calendar_month,
    authorized_amount, purpose, is_unforeseen_expense, status,
    idempotency_key, payload_hash, created_by
  ) values (
    p_cash_desk_id, v_desk.tenant_id, v_desk.property_id, p_adopted_resolution_id, v_month,
    p_authorized_amount, btrim(p_purpose), true, 'authorized',
    p_idempotency_key, p_payload_hash, p_actor_id
  ) returning * into v_auth;

  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_desk.tenant_id, p_actor_id, 'service_role', 'statutory.petty_cash.authorized', 'statutory_petty_cash_authorization', v_auth.id,
    jsonb_build_object('amount', v_auth.authorized_amount, 'month', v_auth.calendar_month), 'Art. 67(5) petty cash authorized');

  return v_auth;
end;
$$;

create or replace function app_private.record_statutory_petty_cash_expense_v1(
  p_authorization_id uuid,
  p_amount numeric,
  p_expense_date date,
  p_description text,
  p_supporting_document_type text,
  p_supporting_document_number text,
  p_supporting_document_hash text,
  p_written_authority_reference text,
  p_actor_id uuid,
  p_idempotency_key text,
  p_payload_hash text
)
returns finance.statutory_petty_cash_expenses
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_auth finance.statutory_petty_cash_authorizations;
  v_exp finance.statutory_petty_cash_expenses;
  v_remaining numeric(20,2);
begin
  if p_authorization_id is null or p_amount is null or p_amount <= 0 or p_expense_date is null
     or nullif(btrim(p_description), '') is null or nullif(btrim(p_supporting_document_type), '') is null
     or nullif(btrim(p_supporting_document_number), '') is null
     or p_supporting_document_hash !~ '^[0-9a-f]{64}$'
     or nullif(btrim(p_written_authority_reference), '') is null or p_actor_id is null
     or nullif(btrim(p_idempotency_key), '') is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'petty_cash_expense_invalid_arguments' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('statutory_petty_cash:' || p_authorization_id::text, 0));

  select * into v_auth from finance.statutory_petty_cash_authorizations where id = p_authorization_id for update;
  if not found then
    raise exception 'statutory_petty_cash_authorization_not_found' using errcode = 'P0002';
  end if;

  select * into v_exp from finance.statutory_petty_cash_expenses
   where tenant_id = v_auth.tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_exp.payload_hash <> p_payload_hash then
      raise exception 'petty_cash_expense_idempotency_conflict' using errcode = '23505';
    end if;
    return v_exp;
  end if;

  -- Law 196/2018 Art. 67(5): Cumulative spending cannot exceed authorized amount (and max 1,000 RON)
  v_remaining := finance.statutory_petty_cash_balance_v1(p_authorization_id);
  if v_remaining < p_amount then
    raise exception 'petty_cash_ceiling_exceeded' using errcode = '23514';
  end if;

  insert into finance.statutory_petty_cash_expenses (
    authorization_id, tenant_id, property_id, amount, expense_date,
    description, supporting_document_type, supporting_document_number,
    supporting_document_hash, written_authority_reference, status,
    idempotency_key, payload_hash, created_by
  ) values (
    p_authorization_id, v_auth.tenant_id, v_auth.property_id, p_amount, p_expense_date,
    btrim(p_description), btrim(p_supporting_document_type), btrim(p_supporting_document_number),
    p_supporting_document_hash, btrim(p_written_authority_reference), 'recorded',
    p_idempotency_key, p_payload_hash, p_actor_id
  ) returning * into v_exp;

  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_auth.tenant_id, p_actor_id, 'service_role', 'statutory.petty_cash_expense.recorded', 'statutory_petty_cash_expense', v_exp.id,
    jsonb_build_object('amount', v_exp.amount, 'description', v_exp.description), 'Petty cash unforeseen expense recorded');

  return v_exp;
end;
$$;

create or replace function app_private.reverse_statutory_petty_cash_expense_v1(
  p_expense_id uuid,
  p_reversal_reason text,
  p_actor_id uuid,
  p_idempotency_key text,
  p_payload_hash text
)
returns finance.statutory_petty_cash_expenses
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_orig finance.statutory_petty_cash_expenses;
  v_rev finance.statutory_petty_cash_expenses;
begin
  if p_expense_id is null or nullif(btrim(p_reversal_reason), '') is null or p_actor_id is null
     or nullif(btrim(p_idempotency_key), '') is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'reverse_petty_cash_invalid_arguments' using errcode = '22023';
  end if;

  select * into v_orig from finance.statutory_petty_cash_expenses where id = p_expense_id for update;
  if not found then
    raise exception 'petty_cash_expense_not_found' using errcode = 'P0002';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('statutory_petty_cash:' || v_orig.authorization_id::text, 0));

  if v_orig.status = 'reversed' then
    raise exception 'petty_cash_expense_already_reversed' using errcode = '55000';
  end if;

  select * into v_rev from finance.statutory_petty_cash_expenses
   where tenant_id = v_orig.tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_rev.payload_hash <> p_payload_hash then
      raise exception 'reverse_petty_cash_idempotency_conflict' using errcode = '23505';
    end if;
    return v_rev;
  end if;

  update finance.statutory_petty_cash_expenses
     set status = 'reversed',
         reversal_reason = btrim(p_reversal_reason)
   where id = p_expense_id;

  insert into finance.statutory_petty_cash_expenses (
    authorization_id, tenant_id, property_id, amount, expense_date,
    description, supporting_document_type, supporting_document_number,
    supporting_document_hash, written_authority_reference, status,
    reversal_of_id, reversal_reason, idempotency_key, payload_hash, created_by
  ) values (
    v_orig.authorization_id, v_orig.tenant_id, v_orig.property_id, v_orig.amount, current_date,
    'Reversal of expense: ' || v_orig.description, v_orig.supporting_document_type, v_orig.supporting_document_number,
    v_orig.supporting_document_hash, v_orig.written_authority_reference, 'reversed',
    v_orig.id, btrim(p_reversal_reason), p_idempotency_key, p_payload_hash, p_actor_id
  ) returning * into v_rev;

  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_orig.tenant_id, p_actor_id, 'service_role', 'statutory.petty_cash_expense.reversed', 'statutory_petty_cash_expense', v_rev.id,
    jsonb_build_object('reversed_expense_id', v_orig.id, 'amount', v_orig.amount), p_reversal_reason);

  return v_rev;
end;
$$;

create or replace function app_private.create_statutory_cash_document_v1(
  p_cash_desk_id uuid,
  p_document_type finance.statutory_cash_document_type,
  p_document_series text,
  p_document_number text,
  p_document_date date,
  p_amount numeric,
  p_beneficiary_or_payer text,
  p_purpose text,
  p_semantic_payload jsonb,
  p_statutory_simple_entry_id uuid,
  p_petty_cash_expense_id uuid,
  p_actor_id uuid,
  p_idempotency_key text,
  p_payload_hash text
)
returns finance.statutory_cash_documents
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_desk finance.statutory_cash_desks;
  v_doc finance.statutory_cash_documents;
begin
  if p_cash_desk_id is null or p_document_type is null or nullif(btrim(p_document_series), '') is null
     or nullif(btrim(p_document_number), '') is null or p_document_date is null
     or p_amount is null or p_amount <= 0 or nullif(btrim(p_beneficiary_or_payer), '') is null
     or nullif(btrim(p_purpose), '') is null or jsonb_typeof(p_semantic_payload) <> 'object'
     or p_actor_id is null or nullif(btrim(p_idempotency_key), '') is null
     or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'cash_document_invalid_arguments' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('statutory_cash_desk:' || p_cash_desk_id::text, 0));

  select * into v_desk from finance.statutory_cash_desks where id = p_cash_desk_id;
  if not found then
    raise exception 'statutory_cash_desk_not_found' using errcode = 'P0002';
  end if;

  select * into v_doc from finance.statutory_cash_documents
   where tenant_id = v_desk.tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_doc.payload_hash <> p_payload_hash then
      raise exception 'cash_document_idempotency_conflict' using errcode = '23505';
    end if;
    return v_doc;
  end if;

  insert into finance.statutory_cash_documents (
    cash_desk_id, tenant_id, property_id, document_type, document_series, document_number,
    document_date, amount, currency, beneficiary_or_payer, purpose,
    statutory_simple_entry_id, petty_cash_expense_id, semantic_payload, payload_hash,
    renderer_status, status, idempotency_key, created_by
  ) values (
    p_cash_desk_id, v_desk.tenant_id, v_desk.property_id, p_document_type, btrim(p_document_series), btrim(p_document_number),
    p_document_date, p_amount, 'RON', btrim(p_beneficiary_or_payer), btrim(p_purpose),
    p_statutory_simple_entry_id, p_petty_cash_expense_id, p_semantic_payload, p_payload_hash,
    'legal_review_required', 'draft', p_idempotency_key, p_actor_id
  ) returning * into v_doc;

  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_desk.tenant_id, p_actor_id, 'service_role', 'statutory.cash_document.created', 'statutory_cash_document', v_doc.id,
    jsonb_build_object('type', v_doc.document_type, 'series', v_doc.document_series, 'number', v_doc.document_number),
    'Statutory cash document registered');

  return v_doc;
end;
$$;

-- =============================================================================
-- Row Level Security & Access Control
-- =============================================================================

alter table finance.statutory_compliance_calendars enable row level security;
alter table finance.statutory_cash_desks enable row level security;
alter table finance.statutory_cash_entry_assignments enable row level security;
alter table finance.statutory_cash_custody_transfers enable row level security;
alter table finance.statutory_cash_daily_closures enable row level security;
alter table finance.statutory_petty_cash_authorizations enable row level security;
alter table finance.statutory_petty_cash_expenses enable row level security;
alter table finance.statutory_cash_deposit_obligations enable row level security;
alter table finance.statutory_cash_documents enable row level security;

create policy statutory_compliance_calendars_rpc_owner_all on finance.statutory_compliance_calendars for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_cash_desks_rpc_owner_all on finance.statutory_cash_desks for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_cash_entry_assignments_rpc_owner_all on finance.statutory_cash_entry_assignments for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_cash_custody_transfers_rpc_owner_all on finance.statutory_cash_custody_transfers for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_cash_daily_closures_rpc_owner_all on finance.statutory_cash_daily_closures for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_petty_cash_authorizations_rpc_owner_all on finance.statutory_petty_cash_authorizations for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_petty_cash_expenses_rpc_owner_all on finance.statutory_petty_cash_expenses for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_cash_deposit_obligations_rpc_owner_all on finance.statutory_cash_deposit_obligations for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_cash_documents_rpc_owner_all on finance.statutory_cash_documents for all to cladora_rpc_owner using (true) with check (true);

grant usage on schema app_private, finance, governance, portfolio, payments, maintenance, audit to cladora_rpc_owner, service_role;

grant select on finance.statutory_compliance_calendars to cladora_rpc_owner, service_role;
grant select, insert, update on finance.statutory_cash_desks to cladora_rpc_owner, service_role;
grant select, insert on finance.statutory_cash_entry_assignments to cladora_rpc_owner, service_role;
grant select, insert, update on finance.statutory_cash_custody_transfers to cladora_rpc_owner, service_role;
grant select, insert on finance.statutory_cash_daily_closures to cladora_rpc_owner, service_role;
grant select, insert, update on finance.statutory_petty_cash_authorizations to cladora_rpc_owner, service_role;
grant select, insert, update on finance.statutory_petty_cash_expenses to cladora_rpc_owner, service_role;
grant select, insert, update on finance.statutory_cash_deposit_obligations to cladora_rpc_owner, service_role;
grant select, insert, update on finance.statutory_cash_documents to cladora_rpc_owner, service_role;

revoke all on function finance.add_romanian_business_days_v1(date, integer, char(2)) from public, anon, authenticated;
revoke all on function finance.statutory_cash_balance_v1(uuid) from public, anon, authenticated;
revoke all on function finance.statutory_petty_cash_balance_v1(uuid) from public, anon, authenticated;
revoke all on function app_private.create_statutory_cash_desk_v1(uuid, text, text, numeric, uuid, text, text) from public, anon, authenticated;
revoke all on function app_private.activate_statutory_cash_desk_v1(uuid, integer, uuid, text) from public, anon, authenticated;
revoke all on function app_private.assign_cash_simple_entry_v1(uuid, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function app_private.record_cash_custody_transfer_v1(uuid, uuid, finance.statutory_custody_transfer_kind, numeric, date, text, uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function app_private.close_statutory_cash_day_v1(uuid, date, uuid, text, text) from public, anon, authenticated;
revoke all on function app_private.settle_cash_deposit_obligation_v1(uuid, uuid, numeric, uuid, text) from public, anon, authenticated;
revoke all on function app_private.authorize_statutory_petty_cash_v1(uuid, uuid, date, numeric, text, boolean, uuid, text, text) from public, anon, authenticated;
revoke all on function app_private.record_statutory_petty_cash_expense_v1(uuid, numeric, date, text, text, text, text, text, uuid, text, text) from public, anon, authenticated;
revoke all on function app_private.reverse_statutory_petty_cash_expense_v1(uuid, text, uuid, text, text) from public, anon, authenticated;
revoke all on function app_private.create_statutory_cash_document_v1(uuid, finance.statutory_cash_document_type, text, text, date, numeric, text, text, jsonb, uuid, uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function finance.add_romanian_business_days_v1(date, integer, char(2)) to cladora_rpc_owner, service_role;
grant execute on function finance.statutory_cash_balance_v1(uuid) to cladora_rpc_owner, service_role;
grant execute on function finance.statutory_petty_cash_balance_v1(uuid) to cladora_rpc_owner, service_role;
grant execute on function app_private.create_statutory_cash_desk_v1(uuid, text, text, numeric, uuid, text, text) to cladora_rpc_owner, service_role;
grant execute on function app_private.activate_statutory_cash_desk_v1(uuid, integer, uuid, text) to cladora_rpc_owner, service_role;
grant execute on function app_private.assign_cash_simple_entry_v1(uuid, uuid, uuid, text, text) to cladora_rpc_owner, service_role;
grant execute on function app_private.record_cash_custody_transfer_v1(uuid, uuid, finance.statutory_custody_transfer_kind, numeric, date, text, uuid, uuid, text, text) to cladora_rpc_owner, service_role;
grant execute on function app_private.close_statutory_cash_day_v1(uuid, date, uuid, text, text) to cladora_rpc_owner, service_role;
grant execute on function app_private.settle_cash_deposit_obligation_v1(uuid, uuid, numeric, uuid, text) to cladora_rpc_owner, service_role;
grant execute on function app_private.authorize_statutory_petty_cash_v1(uuid, uuid, date, numeric, text, boolean, uuid, text, text) to cladora_rpc_owner, service_role;
grant execute on function app_private.record_statutory_petty_cash_expense_v1(uuid, numeric, date, text, text, text, text, text, uuid, text, text) to cladora_rpc_owner, service_role;
grant execute on function app_private.reverse_statutory_petty_cash_expense_v1(uuid, text, uuid, text, text) to cladora_rpc_owner, service_role;
grant execute on function app_private.create_statutory_cash_document_v1(uuid, finance.statutory_cash_document_type, text, text, date, numeric, text, text, jsonb, uuid, uuid, uuid, text, text) to cladora_rpc_owner, service_role;

comment on table finance.statutory_cash_desks is 'Physical cash desks under Romanian Law 70/2015 and Law 196/2018 with independent EOD ceiling evaluation';
comment on table finance.statutory_cash_entry_assignments is 'Statutory evidence linking simple-entry cash movements to physical cash desks without ledger duplication';
comment on table finance.statutory_cash_custody_transfers is 'Internal custody movements between physical cash desks and association bank accounts';
comment on table finance.statutory_cash_daily_closures is 'Immutable end-of-day cash desk balance and ceiling compliance snapshots';
comment on table finance.statutory_petty_cash_authorizations is 'Romanian Law 196/2018 Art. 67(5) petty-cash limits bound to adopted AGM resolution';
comment on table finance.statutory_petty_cash_expenses is 'Audited unforeseen petty-cash expenses with written authority and reversal capability';
comment on table finance.statutory_cash_deposit_obligations is 'Statutory bank-deposit obligations under Law 196/2018 24h rule and Law 70/2015 50k ceiling excess';
comment on table finance.statutory_cash_documents is 'Semantic evidence for Romanian statutory cash forms 14-4-1 (Chitanță) and 14-4-4 (Dispoziție casierie)';

commit;
