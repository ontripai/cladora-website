begin;

-- R10 Phase 2A: Romanian HOA statutory funds and append-only subledgers.
-- Approved targets, assessed quotas, and cash movements are intentionally
-- separate. The statutory simple-entry book remains the cash source of truth;
-- the double-entry ledger is optional supplemental evidence only.

create type finance.statutory_fund_kind as enum (
  'repair', 'working_capital', 'special', 'penalty'
);
create type finance.statutory_fund_status as enum (
  'draft', 'active', 'suspended', 'retired'
);
create type finance.statutory_fund_plan_status as enum (
  'draft', 'approved', 'closed', 'cancelled'
);
create type finance.statutory_fund_delta as enum ('increase', 'decrease');
create type finance.statutory_fund_cash_effect as enum ('receipt', 'payment', 'none');
create type finance.statutory_fund_movement_kind as enum (
  'owner_contribution', 'common_property_income', 'penalty_collection',
  'expenditure', 'refund', 'reversal',
  'ownership_transfer_out', 'ownership_transfer_in'
);
create type finance.statutory_fund_purpose as enum (
  'third_party_penalties', 'common_property_repairs', 'thermal_rehabilitation',
  'condominium_consolidation', 'architectural_environmental_quality',
  'current_expenses', 'special_approved_purpose'
);
create type finance.statutory_penalty_fund_destination as enum (
  'third_party_penalties', 'common_property_repairs',
  'thermal_rehabilitation', 'condominium_consolidation'
);
create type finance.statutory_conveyance_disposition as enum (
  'refund_transferor', 'transfer_to_acquirer_by_deed', 'legal_review_required'
);
create type finance.statutory_conveyance_status as enum (
  'draft', 'finalized', 'cancelled'
);

create table finance.statutory_funds (
  id uuid primary key default gen_random_uuid(),
  regime_id uuid not null references finance.statutory_accounting_regimes(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  kind finance.statutory_fund_kind not null,
  code text not null check (btrim(code) <> ''),
  name_ro text not null check (btrim(name_ro) <> ''),
  adopted_resolution_id uuid not null references governance.resolutions(id) on delete restrict,
  statutory_basis jsonb not null check (jsonb_typeof(statutory_basis) = 'object'),
  purpose_policy jsonb not null check (jsonb_typeof(purpose_policy) = 'object'),
  policy_hash text not null check (policy_hash ~ '^[0-9a-f]{64}$'),
  status finance.statutory_fund_status not null default 'draft',
  currency char(3) not null default 'RON' check (currency = 'RON'),
  valid_from date not null,
  valid_to date,
  lock_version integer not null default 1 check (lock_version > 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  activated_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  activated_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  unique (regime_id, code),
  unique (tenant_id, idempotency_key),
  check (valid_to is null or valid_to >= valid_from),
  check ((activated_by is null) = (activated_at is null)),
  check (status <> 'active' or activated_at is not null)
);

create unique index statutory_funds_singleton_active_idx
  on finance.statutory_funds (regime_id, kind)
  where status = 'active' and kind in ('repair', 'working_capital', 'penalty');

create table finance.statutory_fund_plans (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references finance.statutory_funds(id) on delete restrict,
  accounting_period_id uuid not null references finance.accounting_periods(id) on delete restrict,
  cycle_id uuid references finance.statutory_monthly_cycles(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  adopted_resolution_id uuid not null references governance.resolutions(id) on delete restrict,
  target_amount numeric(20,2) not null check (target_amount >= 0),
  calculation_evidence jsonb not null check (jsonb_typeof(calculation_evidence) = 'object'),
  inflation_source text,
  reference_month date,
  formation_policy jsonb not null check (jsonb_typeof(formation_policy) = 'object'),
  policy_hash text not null check (policy_hash ~ '^[0-9a-f]{64}$'),
  status finance.statutory_fund_plan_status not null default 'draft',
  lock_version integer not null default 1 check (lock_version > 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  approved_at timestamptz,
  updated_at timestamptz not null default statement_timestamp(),
  unique (fund_id, accounting_period_id),
  unique (tenant_id, idempotency_key),
  check ((approved_by is null) = (approved_at is null)),
  check (status <> 'approved' or approved_at is not null),
  check ((inflation_source is null) = (reference_month is null))
);

-- A plan may point at a finalized statutory allocation batch. Unit shares are
-- always derived from statutory_allocation_results and are never copied here.
create table finance.statutory_fund_assessment_links (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null unique references finance.statutory_fund_plans(id) on delete restrict,
  allocation_batch_id uuid not null unique references finance.statutory_allocation_batches(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  linked_by uuid not null references auth.users(id) on delete restrict,
  linked_at timestamptz not null default statement_timestamp()
);

create table finance.statutory_working_capital_conveyances (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references finance.statutory_funds(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  unit_id uuid not null references portfolio.units(id) on delete restrict,
  outgoing_ownership_id uuid not null references portfolio.ownerships(id) on delete restrict,
  incoming_ownership_id uuid not null references portfolio.ownerships(id) on delete restrict,
  outgoing_party_id uuid not null references portfolio.parties(id) on delete restrict,
  incoming_party_id uuid not null references portfolio.parties(id) on delete restrict,
  effective_on date not null,
  frozen_owner_balance numeric(20,2) not null check (frozen_owner_balance >= 0),
  disposition finance.statutory_conveyance_disposition not null,
  deed_reference text,
  deed_evidence jsonb not null check (jsonb_typeof(deed_evidence) = 'object'),
  evidence_hash text not null check (evidence_hash ~ '^[0-9a-f]{64}$'),
  legal_review_reference text,
  refund_simple_entry_id uuid references finance.statutory_simple_entries(id) on delete restrict,
  status finance.statutory_conveyance_status not null default 'draft',
  lock_version integer not null default 1 check (lock_version > 0),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  finalized_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  finalized_at timestamptz,
  unique (fund_id, unit_id, outgoing_ownership_id, incoming_ownership_id),
  unique (tenant_id, idempotency_key),
  check (outgoing_ownership_id <> incoming_ownership_id),
  check (outgoing_party_id <> incoming_party_id),
  check ((finalized_by is null) = (finalized_at is null)),
  check (status <> 'finalized' or finalized_at is not null),
  check (disposition <> 'transfer_to_acquirer_by_deed' or nullif(btrim(deed_reference), '') is not null),
  check (disposition <> 'legal_review_required' or legal_review_reference is null),
  check (disposition = 'refund_transferor' or refund_simple_entry_id is null)
);

create table finance.statutory_fund_movements (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references finance.statutory_funds(id) on delete restrict,
  cycle_id uuid references finance.statutory_monthly_cycles(id) on delete restrict,
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid not null references portfolio.properties(id) on delete restrict,
  statutory_simple_entry_id uuid references finance.statutory_simple_entries(id) on delete restrict,
  payment_id uuid references payments.payments(id) on delete restrict,
  supplemental_journal_id uuid references finance.journals(id) on delete restrict,
  work_order_id uuid references maintenance.work_orders(id) on delete restrict,
  conveyance_id uuid references finance.statutory_working_capital_conveyances(id) on delete restrict,
  reversal_of_movement_id uuid references finance.statutory_fund_movements(id) on delete restrict,
  delta finance.statutory_fund_delta not null,
  cash_effect finance.statutory_fund_cash_effect not null,
  movement_kind finance.statutory_fund_movement_kind not null,
  purpose finance.statutory_fund_purpose,
  penalty_destination finance.statutory_penalty_fund_destination,
  amount numeric(20,2) not null check (amount > 0),
  currency char(3) not null default 'RON' check (currency = 'RON'),
  unit_id uuid references portfolio.units(id) on delete restrict,
  party_id uuid references portfolio.parties(id) on delete restrict,
  named_receipt_reference text,
  written_authority_reference text,
  supporting_document_reference text not null check (btrim(supporting_document_reference) <> ''),
  third_party_penalty_clearance_reference text,
  source_snapshot jsonb not null check (jsonb_typeof(source_snapshot) = 'object'),
  source_hash text not null check (source_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key text not null check (btrim(idempotency_key) <> ''),
  payload_hash text not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, idempotency_key),
  check (reversal_of_movement_id is null or reversal_of_movement_id <> id),
  check (
    (cash_effect in ('receipt', 'payment') and statutory_simple_entry_id is not null and conveyance_id is null)
    or (cash_effect = 'none' and statutory_simple_entry_id is null and conveyance_id is not null)
  ),
  check ((movement_kind in ('ownership_transfer_out', 'ownership_transfer_in')) = (cash_effect = 'none')),
  check (movement_kind <> 'owner_contribution' or (delta = 'increase' and cash_effect = 'receipt' and unit_id is not null and party_id is not null and nullif(btrim(named_receipt_reference), '') is not null)),
  check (movement_kind <> 'common_property_income' or (delta = 'increase' and cash_effect = 'receipt')),
  check (movement_kind <> 'penalty_collection' or (delta = 'increase' and cash_effect = 'receipt')),
  check (movement_kind <> 'expenditure' or (delta = 'decrease' and cash_effect = 'payment' and purpose is not null and nullif(btrim(written_authority_reference), '') is not null)),
  check (movement_kind <> 'refund' or (delta = 'decrease' and cash_effect = 'payment' and unit_id is not null and party_id is not null)),
  check (movement_kind <> 'ownership_transfer_out' or delta = 'decrease'),
  check (movement_kind <> 'ownership_transfer_in' or delta = 'increase'),
  check (penalty_destination is null or purpose::text = penalty_destination::text)
);

-- Cover every FK and primary query path.
create index statutory_funds_regime_idx on finance.statutory_funds(regime_id);
create index statutory_funds_tenant_status_idx on finance.statutory_funds(tenant_id, status, kind);
create index statutory_funds_property_idx on finance.statutory_funds(property_id);
create index statutory_funds_resolution_idx on finance.statutory_funds(adopted_resolution_id);
create index statutory_funds_created_by_idx on finance.statutory_funds(created_by);
create index statutory_funds_activated_by_idx on finance.statutory_funds(activated_by);
create index statutory_fund_plans_period_idx on finance.statutory_fund_plans(accounting_period_id);
create index statutory_fund_plans_cycle_idx on finance.statutory_fund_plans(cycle_id);
create index statutory_fund_plans_tenant_idx on finance.statutory_fund_plans(tenant_id);
create index statutory_fund_plans_property_idx on finance.statutory_fund_plans(property_id);
create index statutory_fund_plans_resolution_idx on finance.statutory_fund_plans(adopted_resolution_id);
create index statutory_fund_plans_created_by_idx on finance.statutory_fund_plans(created_by);
create index statutory_fund_plans_approved_by_idx on finance.statutory_fund_plans(approved_by);
create index statutory_fund_assessment_batch_idx on finance.statutory_fund_assessment_links(allocation_batch_id);
create index statutory_fund_assessment_tenant_idx on finance.statutory_fund_assessment_links(tenant_id);
create index statutory_fund_assessment_actor_idx on finance.statutory_fund_assessment_links(linked_by);
create index statutory_conveyances_fund_status_idx on finance.statutory_working_capital_conveyances(fund_id, status);
create index statutory_conveyances_tenant_idx on finance.statutory_working_capital_conveyances(tenant_id);
create index statutory_conveyances_property_idx on finance.statutory_working_capital_conveyances(property_id);
create index statutory_conveyances_unit_idx on finance.statutory_working_capital_conveyances(unit_id);
create index statutory_conveyances_out_ownership_idx on finance.statutory_working_capital_conveyances(outgoing_ownership_id);
create index statutory_conveyances_in_ownership_idx on finance.statutory_working_capital_conveyances(incoming_ownership_id);
create index statutory_conveyances_out_party_idx on finance.statutory_working_capital_conveyances(outgoing_party_id);
create index statutory_conveyances_in_party_idx on finance.statutory_working_capital_conveyances(incoming_party_id);
create index statutory_conveyances_refund_entry_idx on finance.statutory_working_capital_conveyances(refund_simple_entry_id);
create index statutory_conveyances_created_by_idx on finance.statutory_working_capital_conveyances(created_by);
create index statutory_conveyances_finalized_by_idx on finance.statutory_working_capital_conveyances(finalized_by);
create index statutory_fund_movements_fund_time_idx on finance.statutory_fund_movements(fund_id, created_at, id);
create index statutory_fund_movements_cycle_idx on finance.statutory_fund_movements(cycle_id);
create index statutory_fund_movements_tenant_idx on finance.statutory_fund_movements(tenant_id);
create index statutory_fund_movements_property_idx on finance.statutory_fund_movements(property_id);
create index statutory_fund_movements_entry_idx on finance.statutory_fund_movements(statutory_simple_entry_id);
create index statutory_fund_movements_payment_idx on finance.statutory_fund_movements(payment_id);
create index statutory_fund_movements_journal_idx on finance.statutory_fund_movements(supplemental_journal_id);
create index statutory_fund_movements_work_order_idx on finance.statutory_fund_movements(work_order_id);
create index statutory_fund_movements_conveyance_idx on finance.statutory_fund_movements(conveyance_id);
create index statutory_fund_movements_reversal_idx on finance.statutory_fund_movements(reversal_of_movement_id);
create index statutory_fund_movements_unit_party_idx on finance.statutory_fund_movements(fund_id, unit_id, party_id);
create index statutory_fund_movements_party_idx on finance.statutory_fund_movements(party_id);
create index statutory_fund_movements_created_by_idx on finance.statutory_fund_movements(created_by);

create or replace function finance.statutory_fund_balance_v1(p_fund_id uuid)
returns numeric
language sql stable security invoker
set search_path = pg_catalog
as $$
  select coalesce(sum(case when delta = 'increase' then amount else -amount end), 0)::numeric(20,2)
  from finance.statutory_fund_movements where fund_id = p_fund_id
$$;

create or replace function finance.statutory_owner_fund_position_v1(
  p_fund_id uuid, p_unit_id uuid, p_party_id uuid
)
returns numeric
language sql stable security invoker
set search_path = pg_catalog
as $$
  select coalesce(sum(case when delta = 'increase' then amount else -amount end), 0)::numeric(20,2)
  from finance.statutory_fund_movements
  where fund_id = p_fund_id and unit_id = p_unit_id and party_id = p_party_id
$$;

create or replace function finance.validate_statutory_fund_scope_v1()
returns trigger
language plpgsql security definer
set search_path = pg_catalog
as $$
declare
  v_fund finance.statutory_funds;
  v_regime finance.statutory_accounting_regimes;
  v_resolution record;
  v_batch record;
  v_plan finance.statutory_fund_plans;
  v_period record;
  v_cycle finance.statutory_monthly_cycles;
begin
  if tg_table_name = 'statutory_funds' then
    select * into v_regime from finance.statutory_accounting_regimes where id = new.regime_id;
    select r.tenant_id, r.adopted, m.property_id into v_resolution
      from governance.resolutions r join governance.meetings m on m.id = r.meeting_id
      where r.id = new.adopted_resolution_id;
    if v_regime.id is null or v_regime.tenant_id is distinct from new.tenant_id
       or v_regime.property_id is distinct from new.property_id
       or v_resolution.tenant_id is distinct from new.tenant_id
       or v_resolution.property_id is distinct from new.property_id
       or v_resolution.adopted is not true then
      raise exception 'statutory_fund_scope_or_resolution_invalid' using errcode = '23514';
    end if;
  elsif tg_table_name = 'statutory_fund_plans' then
    select * into v_fund from finance.statutory_funds where id = new.fund_id;
    select tenant_id, property_id into v_period
      from finance.accounting_periods where id = new.accounting_period_id;
    if new.cycle_id is not null then
      select * into v_cycle from finance.statutory_monthly_cycles where id = new.cycle_id;
    end if;
    select r.tenant_id, r.adopted, m.property_id into v_resolution
      from governance.resolutions r join governance.meetings m on m.id = r.meeting_id
      where r.id = new.adopted_resolution_id;
    if v_fund.tenant_id is distinct from new.tenant_id or v_fund.property_id is distinct from new.property_id
       or v_period.tenant_id is distinct from new.tenant_id or v_period.property_id is distinct from new.property_id
       or v_resolution.tenant_id is distinct from new.tenant_id
       or v_resolution.property_id is distinct from new.property_id or v_resolution.adopted is not true then
      raise exception 'statutory_fund_plan_scope_or_resolution_invalid' using errcode = '23514';
    end if;
    if new.cycle_id is not null and (
      v_cycle.tenant_id is distinct from new.tenant_id
      or v_cycle.property_id is distinct from new.property_id
      or v_cycle.accounting_period_id is distinct from new.accounting_period_id
    ) then
      raise exception 'statutory_fund_plan_cycle_invalid' using errcode = '23514';
    end if;
    if v_fund.kind = 'working_capital'
       and (nullif(btrim(new.inflation_source), '') is null or new.reference_month is null) then
      raise exception 'working_capital_calculation_evidence_required' using errcode = '23514';
    end if;
  elsif tg_table_name = 'statutory_fund_assessment_links' then
    select * into v_plan from finance.statutory_fund_plans where id = new.plan_id;
    select tenant_id, property_id, status into v_batch
      from finance.statutory_allocation_batches where id = new.allocation_batch_id;
    if v_plan.tenant_id is distinct from new.tenant_id or v_batch.tenant_id is distinct from new.tenant_id
       or v_plan.property_id is distinct from v_batch.property_id or v_batch.status <> 'finalized' then
      raise exception 'statutory_fund_assessment_scope_or_state_invalid' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

create trigger statutory_funds_scope_guard before insert or update on finance.statutory_funds
for each row execute function finance.validate_statutory_fund_scope_v1();
create trigger statutory_fund_plans_scope_guard before insert or update on finance.statutory_fund_plans
for each row execute function finance.validate_statutory_fund_scope_v1();
create trigger statutory_fund_assessment_scope_guard before insert or update on finance.statutory_fund_assessment_links
for each row execute function finance.validate_statutory_fund_scope_v1();

create or replace function finance.protect_statutory_fund_append_only_v1()
returns trigger language plpgsql set search_path = pg_catalog
as $$ begin
  raise exception 'statutory_fund_record_is_append_only' using errcode = '55000';
end $$;

create trigger statutory_fund_movements_append_only before update or delete on finance.statutory_fund_movements
for each row execute function finance.protect_statutory_fund_append_only_v1();
create trigger statutory_fund_assessment_links_append_only before update or delete on finance.statutory_fund_assessment_links
for each row execute function finance.protect_statutory_fund_append_only_v1();

create or replace function finance.protect_finalized_working_capital_conveyance_v1()
returns trigger language plpgsql set search_path = pg_catalog
as $$
begin
  if tg_op = 'DELETE' or old.status = 'finalized' then
    raise exception 'finalized_working_capital_conveyance_is_immutable' using errcode = '55000';
  end if;
  return new;
end
$$;

create trigger statutory_working_capital_conveyance_immutable
before update or delete on finance.statutory_working_capital_conveyances
for each row execute function finance.protect_finalized_working_capital_conveyance_v1();

create or replace function app_private.create_statutory_fund_v1(
  p_regime_id uuid, p_kind finance.statutory_fund_kind, p_code text, p_name_ro text,
  p_adopted_resolution_id uuid, p_statutory_basis jsonb, p_purpose_policy jsonb,
  p_valid_from date, p_actor_id uuid, p_idempotency_key text, p_payload_hash text
)
returns finance.statutory_funds
language plpgsql security invoker set search_path = pg_catalog
as $$
declare v_regime finance.statutory_accounting_regimes; v_fund finance.statutory_funds;
begin
  if p_regime_id is null or p_kind is null or nullif(btrim(p_code), '') is null
     or nullif(btrim(p_name_ro), '') is null or p_adopted_resolution_id is null
     or jsonb_typeof(p_statutory_basis) <> 'object' or jsonb_typeof(p_purpose_policy) <> 'object'
     or p_valid_from is null or p_actor_id is null or nullif(btrim(p_idempotency_key), '') is null
     or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'statutory_fund_create_invalid_arguments' using errcode = '22023';
  end if;
  select * into v_regime from finance.statutory_accounting_regimes where id = p_regime_id;
  if not found then raise exception 'statutory_regime_not_found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended('statutory_fund_create:' || p_regime_id::text || ':' || p_kind::text || ':' || p_idempotency_key, 0));
  select * into v_fund from finance.statutory_funds
    where tenant_id = v_regime.tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_fund.payload_hash <> p_payload_hash then
      raise exception 'statutory_fund_idempotency_conflict' using errcode = '23505';
    end if;
    return v_fund;
  end if;
  insert into finance.statutory_funds (
    regime_id, tenant_id, property_id, kind, code, name_ro, adopted_resolution_id,
    statutory_basis, purpose_policy, policy_hash, valid_from, idempotency_key,
    payload_hash, created_by
  ) values (
    p_regime_id, v_regime.tenant_id, v_regime.property_id, p_kind, btrim(p_code), btrim(p_name_ro),
    p_adopted_resolution_id, p_statutory_basis, p_purpose_policy,
    encode(extensions.digest(convert_to(p_purpose_policy::text, 'UTF8'), 'sha256'), 'hex'), p_valid_from,
    p_idempotency_key, p_payload_hash, p_actor_id
  ) returning * into v_fund;
  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_fund.tenant_id, p_actor_id, 'service_role', 'statutory.fund.created', 'statutory_fund', v_fund.id,
    jsonb_build_object('kind', v_fund.kind, 'status', v_fund.status), 'R10 statutory fund creation');
  return v_fund;
end
$$;

create or replace function app_private.create_statutory_fund_plan_v1(
  p_fund_id uuid, p_accounting_period_id uuid, p_cycle_id uuid,
  p_adopted_resolution_id uuid, p_target_amount numeric,
  p_calculation_evidence jsonb, p_inflation_source text, p_reference_month date,
  p_formation_policy jsonb, p_actor_id uuid, p_idempotency_key text, p_payload_hash text
)
returns finance.statutory_fund_plans
language plpgsql security invoker set search_path = pg_catalog
as $$
declare v_fund finance.statutory_funds; v_plan finance.statutory_fund_plans;
begin
  if p_fund_id is null or p_accounting_period_id is null or p_adopted_resolution_id is null
     or p_target_amount is null or p_target_amount < 0
     or jsonb_typeof(p_calculation_evidence) <> 'object' or jsonb_typeof(p_formation_policy) <> 'object'
     or p_actor_id is null or nullif(btrim(p_idempotency_key), '') is null
     or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'statutory_fund_plan_invalid_arguments' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('statutory_fund:' || p_fund_id::text, 0));
  select * into v_fund from finance.statutory_funds where id = p_fund_id for update;
  if not found then raise exception 'statutory_fund_not_found' using errcode = 'P0002'; end if;
  select * into v_plan from finance.statutory_fund_plans
    where tenant_id = v_fund.tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_plan.payload_hash <> p_payload_hash then raise exception 'statutory_fund_plan_idempotency_conflict' using errcode = '23505'; end if;
    return v_plan;
  end if;
  if v_fund.status <> 'active' then raise exception 'statutory_fund_not_active' using errcode = '55000'; end if;
  insert into finance.statutory_fund_plans (
    fund_id, accounting_period_id, cycle_id, tenant_id, property_id,
    adopted_resolution_id, target_amount, calculation_evidence, inflation_source,
    reference_month, formation_policy, policy_hash, idempotency_key, payload_hash, created_by
  ) values (
    p_fund_id, p_accounting_period_id, p_cycle_id, v_fund.tenant_id, v_fund.property_id,
    p_adopted_resolution_id, p_target_amount, p_calculation_evidence, p_inflation_source,
    p_reference_month, p_formation_policy,
    encode(extensions.digest(convert_to(p_formation_policy::text, 'UTF8'), 'sha256'), 'hex'),
    p_idempotency_key, p_payload_hash, p_actor_id
  ) returning * into v_plan;
  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_plan.tenant_id, p_actor_id, 'service_role', 'statutory.fund.plan.created', 'statutory_fund_plan', v_plan.id,
    jsonb_build_object('fund_id', v_plan.fund_id, 'target_amount', v_plan.target_amount), 'R10 statutory fund plan creation');
  return v_plan;
end
$$;

create or replace function app_private.approve_statutory_fund_plan_v1(
  p_plan_id uuid, p_expected_lock_version integer, p_actor_id uuid, p_reason text
)
returns finance.statutory_fund_plans
language plpgsql security invoker set search_path = pg_catalog
as $$
declare v_plan finance.statutory_fund_plans; v_fund finance.statutory_funds;
begin
  if p_plan_id is null or p_expected_lock_version is null or p_actor_id is null or nullif(btrim(p_reason), '') is null then
    raise exception 'statutory_fund_plan_approval_invalid_arguments' using errcode = '22023';
  end if;
  select fund_id into v_plan.fund_id from finance.statutory_fund_plans where id = p_plan_id;
  if not found then raise exception 'statutory_fund_plan_not_found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended('statutory_fund:' || v_plan.fund_id::text, 0));
  select * into v_fund from finance.statutory_funds where id = v_plan.fund_id for update;
  select * into v_plan from finance.statutory_fund_plans where id = p_plan_id for update;
  if v_plan.lock_version <> p_expected_lock_version then raise exception 'statutory_fund_plan_lock_version_conflict' using errcode = '40001'; end if;
  if v_plan.status <> 'draft' then raise exception 'statutory_fund_plan_not_draft' using errcode = '55000'; end if;
  if v_fund.status <> 'active' then raise exception 'statutory_fund_not_active' using errcode = '55000'; end if;
  update finance.statutory_fund_plans set status = 'approved', approved_by = p_actor_id,
    approved_at = statement_timestamp(), lock_version = lock_version + 1, updated_at = statement_timestamp()
    where id = p_plan_id returning * into v_plan;
  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_plan.tenant_id, p_actor_id, 'service_role', 'statutory.fund.plan.approved', 'statutory_fund_plan', v_plan.id,
    jsonb_build_object('status', v_plan.status, 'target_amount', v_plan.target_amount), p_reason);
  return v_plan;
end
$$;

create or replace function app_private.link_statutory_fund_assessment_v1(
  p_plan_id uuid, p_allocation_batch_id uuid, p_actor_id uuid
)
returns finance.statutory_fund_assessment_links
language plpgsql security invoker set search_path = pg_catalog
as $$
declare v_plan finance.statutory_fund_plans; v_batch finance.statutory_allocation_batches; v_link finance.statutory_fund_assessment_links;
begin
  if p_plan_id is null or p_allocation_batch_id is null or p_actor_id is null then
    raise exception 'statutory_fund_assessment_invalid_arguments' using errcode = '22023';
  end if;
  select * into v_plan from finance.statutory_fund_plans where id = p_plan_id;
  if not found then raise exception 'statutory_fund_plan_not_found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended('statutory_fund:' || v_plan.fund_id::text, 0));
  select * into v_plan from finance.statutory_fund_plans where id = p_plan_id for update;
  select * into v_batch from finance.statutory_allocation_batches where id = p_allocation_batch_id for update;
  if v_plan.status <> 'approved' or v_batch.status <> 'finalized' then
    raise exception 'statutory_fund_assessment_not_ready' using errcode = '55000';
  end if;
  if v_plan.tenant_id <> v_batch.tenant_id or v_plan.property_id <> v_batch.property_id
     or (v_plan.cycle_id is not null and v_plan.cycle_id <> v_batch.cycle_id)
     or v_plan.target_amount <> v_batch.source_amount then
    raise exception 'statutory_fund_assessment_scope_or_amount_mismatch' using errcode = '23514';
  end if;
  insert into finance.statutory_fund_assessment_links(plan_id, allocation_batch_id, tenant_id, linked_by)
  values (p_plan_id, p_allocation_batch_id, v_plan.tenant_id, p_actor_id)
  returning * into v_link;
  return v_link;
end
$$;

create or replace function app_private.activate_statutory_fund_v1(
  p_fund_id uuid, p_expected_lock_version integer, p_actor_id uuid, p_reason text
)
returns finance.statutory_funds
language plpgsql security invoker set search_path = pg_catalog
as $$
declare v_fund finance.statutory_funds; v_regime finance.statutory_accounting_regimes;
begin
  if p_fund_id is null or p_expected_lock_version is null or p_actor_id is null or nullif(btrim(p_reason), '') is null then
    raise exception 'statutory_fund_activation_invalid_arguments' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('statutory_fund:' || p_fund_id::text, 0));
  select * into v_fund from finance.statutory_funds where id = p_fund_id for update;
  if not found then raise exception 'statutory_fund_not_found' using errcode = 'P0002'; end if;
  if v_fund.lock_version <> p_expected_lock_version then raise exception 'statutory_fund_lock_version_conflict' using errcode = '40001'; end if;
  if v_fund.status <> 'draft' then raise exception 'statutory_fund_not_draft' using errcode = '55000'; end if;
  select * into v_regime from finance.statutory_accounting_regimes where id = v_fund.regime_id for update;
  if v_regime.status <> 'active' or v_regime.statutory_operations_enabled is not true then
    raise exception 'statutory_operations_not_enabled' using errcode = '42501';
  end if;
  update finance.statutory_funds set status = 'active', activated_by = p_actor_id,
    activated_at = statement_timestamp(), lock_version = lock_version + 1, updated_at = statement_timestamp()
    where id = p_fund_id returning * into v_fund;
  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_fund.tenant_id, p_actor_id, 'service_role', 'statutory.fund.activated', 'statutory_fund', v_fund.id,
    jsonb_build_object('status', v_fund.status, 'lock_version', v_fund.lock_version), p_reason);
  return v_fund;
end
$$;

create or replace function app_private.record_statutory_fund_movement_v1(
  p_fund_id uuid, p_cycle_id uuid, p_simple_entry_id uuid, p_payment_id uuid,
  p_supplemental_journal_id uuid, p_work_order_id uuid,
  p_delta finance.statutory_fund_delta, p_movement_kind finance.statutory_fund_movement_kind,
  p_purpose finance.statutory_fund_purpose, p_amount numeric,
  p_unit_id uuid, p_party_id uuid, p_named_receipt_reference text,
  p_written_authority_reference text, p_supporting_document_reference text,
  p_third_party_penalty_clearance_reference text, p_source_snapshot jsonb,
  p_actor_id uuid, p_idempotency_key text, p_payload_hash text
)
returns finance.statutory_fund_movements
language plpgsql security invoker set search_path = pg_catalog
as $$
declare
  v_fund finance.statutory_funds; v_cycle finance.statutory_monthly_cycles;
  v_entry finance.statutory_simple_entries; v_payment payments.payments;
  v_existing finance.statutory_fund_movements; v_result finance.statutory_fund_movements;
  v_classified numeric(20,2); v_balance numeric(20,2); v_owner_balance numeric(20,2);
  v_cash finance.statutory_fund_cash_effect;
begin
  if p_fund_id is null or p_cycle_id is null or p_simple_entry_id is null or p_delta is null
     or p_movement_kind is null or p_movement_kind in ('ownership_transfer_out','ownership_transfer_in','reversal')
     or p_amount is null or p_amount <= 0 or nullif(btrim(p_supporting_document_reference), '') is null
     or jsonb_typeof(p_source_snapshot) <> 'object' or p_actor_id is null
     or nullif(btrim(p_idempotency_key), '') is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'statutory_fund_movement_invalid_arguments' using errcode = '22023';
  end if;
  v_cash := case p_delta when 'increase' then 'receipt'::finance.statutory_fund_cash_effect else 'payment'::finance.statutory_fund_cash_effect end;
  perform pg_advisory_xact_lock(hashtextextended('statutory_cycle:' || p_cycle_id::text, 0));
  select * into v_cycle from finance.statutory_monthly_cycles where id = p_cycle_id for update;
  if not found then raise exception 'statutory_cycle_not_found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended('statutory_fund:' || p_fund_id::text, 0));
  select * into v_fund from finance.statutory_funds where id = p_fund_id for update;
  if not found then raise exception 'statutory_fund_not_found' using errcode = 'P0002'; end if;
  select * into v_entry from finance.statutory_simple_entries where id = p_simple_entry_id for update;
  if not found then raise exception 'statutory_simple_entry_not_found' using errcode = 'P0002'; end if;
  select * into v_existing from finance.statutory_fund_movements
    where tenant_id = v_fund.tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> p_payload_hash then raise exception 'statutory_fund_movement_idempotency_conflict' using errcode = '23505'; end if;
    return v_existing;
  end if;
  if v_fund.status <> 'active' then raise exception 'statutory_fund_not_active' using errcode = '55000'; end if;
  if v_cycle.status not in ('draft','collecting') then raise exception 'statutory_cycle_not_open_for_fund_movement' using errcode = '55000'; end if;
  if v_fund.tenant_id <> v_cycle.tenant_id or v_fund.property_id <> v_cycle.property_id
     or v_entry.cycle_id <> v_cycle.id or v_entry.tenant_id <> v_fund.tenant_id or v_entry.property_id <> v_fund.property_id
     or v_entry.direction::text <> v_cash::text then
    raise exception 'statutory_fund_movement_scope_or_direction_mismatch' using errcode = '23514';
  end if;
  select coalesce(sum(amount), 0) into v_classified
    from finance.statutory_fund_movements where statutory_simple_entry_id = p_simple_entry_id;
  if v_classified + p_amount > v_entry.amount then raise exception 'statutory_simple_entry_overclassified' using errcode = '23514'; end if;
  if p_payment_id is not null then
    select * into v_payment from payments.payments where id = p_payment_id;
    if v_payment.status <> 'settled' or v_payment.tenant_id <> v_fund.tenant_id
       or v_payment.property_id <> v_fund.property_id or v_payment.amount < p_amount or v_payment.currency <> 'RON' then
      raise exception 'statutory_fund_payment_evidence_invalid' using errcode = '23514';
    end if;
  end if;
  if p_movement_kind = 'common_property_income' and v_fund.kind <> 'repair' then
    raise exception 'common_property_income_must_feed_repair_fund' using errcode = '23514';
  elsif p_movement_kind = 'penalty_collection' and v_fund.kind <> 'penalty' then
    raise exception 'penalty_collection_requires_penalty_fund' using errcode = '23514';
  elsif p_movement_kind = 'refund' and v_fund.kind <> 'working_capital' then
    raise exception 'refund_requires_working_capital_fund' using errcode = '23514';
  end if;
  if p_movement_kind = 'expenditure' then
    if v_fund.kind = 'repair' and p_purpose not in ('common_property_repairs','thermal_rehabilitation','condominium_consolidation','architectural_environmental_quality') then
      raise exception 'repair_fund_purpose_not_allowed' using errcode = '23514';
    elsif v_fund.kind = 'working_capital' and p_purpose <> 'current_expenses' then
      raise exception 'working_capital_purpose_not_allowed' using errcode = '23514';
    elsif v_fund.kind = 'special' and p_purpose <> 'special_approved_purpose' then
      raise exception 'special_fund_purpose_not_allowed' using errcode = '23514';
    elsif v_fund.kind = 'penalty' and p_purpose not in ('third_party_penalties','common_property_repairs','thermal_rehabilitation','condominium_consolidation') then
      raise exception 'penalty_fund_destination_not_allowed' using errcode = '23514';
    elsif v_fund.kind = 'penalty' and p_purpose <> 'third_party_penalties'
      and nullif(btrim(p_third_party_penalty_clearance_reference), '') is null then
      raise exception 'third_party_penalty_priority_clearance_required' using errcode = '23514';
    end if;
  end if;
  if p_delta = 'decrease' then
    v_balance := finance.statutory_fund_balance_v1(p_fund_id);
    if v_balance < p_amount then raise exception 'statutory_fund_balance_insufficient' using errcode = '23514'; end if;
    if p_movement_kind = 'refund' then
      v_owner_balance := finance.statutory_owner_fund_position_v1(p_fund_id, p_unit_id, p_party_id);
      if v_owner_balance < p_amount then raise exception 'working_capital_owner_balance_insufficient' using errcode = '23514'; end if;
    end if;
  end if;
  insert into finance.statutory_fund_movements (
    fund_id, cycle_id, tenant_id, property_id, statutory_simple_entry_id, payment_id,
    supplemental_journal_id, work_order_id, delta, cash_effect, movement_kind, purpose, penalty_destination,
    amount, unit_id, party_id, named_receipt_reference, written_authority_reference,
    supporting_document_reference, third_party_penalty_clearance_reference,
    source_snapshot, source_hash, idempotency_key, payload_hash, created_by
  ) values (
    p_fund_id, p_cycle_id, v_fund.tenant_id, v_fund.property_id, p_simple_entry_id, p_payment_id,
    p_supplemental_journal_id, p_work_order_id, p_delta, v_cash, p_movement_kind, p_purpose,
    case when v_fund.kind = 'penalty' and p_movement_kind = 'expenditure'
      then p_purpose::text::finance.statutory_penalty_fund_destination else null end,
    p_amount, p_unit_id, p_party_id, p_named_receipt_reference, p_written_authority_reference,
    p_supporting_document_reference, p_third_party_penalty_clearance_reference,
    p_source_snapshot, encode(extensions.digest(convert_to(p_source_snapshot::text, 'UTF8'), 'sha256'), 'hex'),
    p_idempotency_key, p_payload_hash, p_actor_id
  ) returning * into v_result;
  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_fund.tenant_id, p_actor_id, 'service_role', 'statutory.fund.movement.recorded', 'statutory_fund_movement', v_result.id,
    jsonb_build_object('fund_id', p_fund_id, 'kind', p_movement_kind, 'delta', p_delta, 'amount', p_amount),
    p_supporting_document_reference);
  return v_result;
end
$$;

create or replace function app_private.reverse_statutory_fund_movement_v1(
  p_movement_id uuid, p_cycle_id uuid, p_simple_entry_id uuid,
  p_supporting_document_reference text, p_source_snapshot jsonb,
  p_actor_id uuid, p_idempotency_key text, p_payload_hash text
)
returns finance.statutory_fund_movements
language plpgsql security invoker set search_path = pg_catalog
as $$
declare
  v_original finance.statutory_fund_movements; v_fund finance.statutory_funds;
  v_cycle finance.statutory_monthly_cycles; v_entry finance.statutory_simple_entries;
  v_existing finance.statutory_fund_movements; v_result finance.statutory_fund_movements;
  v_delta finance.statutory_fund_delta; v_cash finance.statutory_fund_cash_effect;
  v_classified numeric(20,2);
begin
  if p_movement_id is null or p_cycle_id is null or p_simple_entry_id is null
     or nullif(btrim(p_supporting_document_reference), '') is null
     or jsonb_typeof(p_source_snapshot) <> 'object' or p_actor_id is null
     or nullif(btrim(p_idempotency_key), '') is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'statutory_fund_reversal_invalid_arguments' using errcode = '22023';
  end if;
  select * into v_original from finance.statutory_fund_movements where id = p_movement_id;
  if not found then raise exception 'statutory_fund_movement_not_found' using errcode = 'P0002'; end if;
  if v_original.cash_effect = 'none' or v_original.movement_kind = 'reversal' then
    raise exception 'statutory_fund_movement_not_reversible_by_cash_entry' using errcode = '55000';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('statutory_cycle:' || p_cycle_id::text, 0));
  select * into v_cycle from finance.statutory_monthly_cycles where id = p_cycle_id for update;
  perform pg_advisory_xact_lock(hashtextextended('statutory_fund:' || v_original.fund_id::text, 0));
  select * into v_fund from finance.statutory_funds where id = v_original.fund_id for update;
  select * into v_entry from finance.statutory_simple_entries where id = p_simple_entry_id for update;
  select * into v_existing from finance.statutory_fund_movements
    where tenant_id = v_original.tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> p_payload_hash then raise exception 'statutory_fund_reversal_idempotency_conflict' using errcode = '23505'; end if;
    return v_existing;
  end if;
  if exists (select 1 from finance.statutory_fund_movements where reversal_of_movement_id = p_movement_id) then
    raise exception 'statutory_fund_movement_already_reversed' using errcode = '23505';
  end if;
  if v_cycle.status not in ('draft','collecting') or v_cycle.tenant_id <> v_original.tenant_id
     or v_cycle.property_id <> v_original.property_id or v_entry.cycle_id <> v_cycle.id
     or v_entry.tenant_id <> v_original.tenant_id or v_entry.property_id <> v_original.property_id then
    raise exception 'statutory_fund_reversal_scope_invalid' using errcode = '23514';
  end if;
  v_delta := case v_original.delta when 'increase' then 'decrease'::finance.statutory_fund_delta else 'increase'::finance.statutory_fund_delta end;
  v_cash := case v_delta when 'increase' then 'receipt'::finance.statutory_fund_cash_effect else 'payment'::finance.statutory_fund_cash_effect end;
  if v_entry.direction::text <> v_cash::text or v_entry.amount < v_original.amount then
    raise exception 'statutory_fund_reversal_entry_invalid' using errcode = '23514';
  end if;
  select coalesce(sum(amount),0) into v_classified from finance.statutory_fund_movements where statutory_simple_entry_id = p_simple_entry_id;
  if v_classified + v_original.amount > v_entry.amount then raise exception 'statutory_simple_entry_overclassified' using errcode = '23514'; end if;
  if v_delta = 'decrease' and finance.statutory_fund_balance_v1(v_original.fund_id) < v_original.amount then
    raise exception 'statutory_fund_balance_insufficient' using errcode = '23514';
  end if;
  insert into finance.statutory_fund_movements (
    fund_id, cycle_id, tenant_id, property_id, statutory_simple_entry_id,
    reversal_of_movement_id, delta, cash_effect, movement_kind, purpose, amount,
    unit_id, party_id, supporting_document_reference, source_snapshot, source_hash,
    idempotency_key, payload_hash, created_by
  ) values (
    v_original.fund_id, p_cycle_id, v_original.tenant_id, v_original.property_id, p_simple_entry_id,
    v_original.id, v_delta, v_cash, 'reversal', v_original.purpose, v_original.amount,
    v_original.unit_id, v_original.party_id, p_supporting_document_reference, p_source_snapshot,
    encode(extensions.digest(convert_to(p_source_snapshot::text, 'UTF8'), 'sha256'), 'hex'),
    p_idempotency_key, p_payload_hash, p_actor_id
  ) returning * into v_result;
  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_original.tenant_id, p_actor_id, 'service_role', 'statutory.fund.movement.reversed', 'statutory_fund_movement', v_result.id,
    jsonb_build_object('reversal_of', v_original.id, 'amount', v_result.amount), p_supporting_document_reference);
  return v_result;
end
$$;

create or replace function app_private.create_working_capital_conveyance_v1(
  p_fund_id uuid, p_unit_id uuid, p_outgoing_ownership_id uuid, p_incoming_ownership_id uuid,
  p_effective_on date, p_disposition finance.statutory_conveyance_disposition,
  p_deed_reference text, p_deed_evidence jsonb, p_actor_id uuid,
  p_idempotency_key text, p_payload_hash text
)
returns finance.statutory_working_capital_conveyances
language plpgsql security invoker set search_path = pg_catalog
as $$
declare
  v_fund finance.statutory_funds; v_out portfolio.ownerships; v_in portfolio.ownerships;
  v_existing finance.statutory_working_capital_conveyances; v_result finance.statutory_working_capital_conveyances;
  v_property_id uuid; v_balance numeric(20,2);
begin
  if p_fund_id is null or p_unit_id is null or p_outgoing_ownership_id is null or p_incoming_ownership_id is null
     or p_effective_on is null or p_disposition is null or jsonb_typeof(p_deed_evidence) <> 'object'
     or p_actor_id is null or nullif(btrim(p_idempotency_key), '') is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'working_capital_conveyance_invalid_arguments' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('statutory_fund:' || p_fund_id::text, 0));
  select * into v_fund from finance.statutory_funds where id = p_fund_id for update;
  if not found then raise exception 'statutory_fund_not_found' using errcode = 'P0002'; end if;
  select * into v_existing from finance.statutory_working_capital_conveyances
    where tenant_id = v_fund.tenant_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.payload_hash <> p_payload_hash then raise exception 'working_capital_conveyance_idempotency_conflict' using errcode = '23505'; end if;
    return v_existing;
  end if;
  if v_fund.kind <> 'working_capital' or v_fund.status <> 'active' then
    raise exception 'active_working_capital_fund_required' using errcode = '55000';
  end if;
  select * into v_out from portfolio.ownerships where id = p_outgoing_ownership_id;
  select * into v_in from portfolio.ownerships where id = p_incoming_ownership_id;
  select b.property_id into v_property_id from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.id = p_unit_id;
  if v_out.id is null or v_in.id is null
     or v_out.unit_id <> p_unit_id or v_in.unit_id <> p_unit_id or v_out.tenant_id <> v_fund.tenant_id
     or v_in.tenant_id <> v_fund.tenant_id or v_property_id <> v_fund.property_id
     or v_out.valid_from >= p_effective_on or v_out.valid_to is distinct from p_effective_on
     or v_in.valid_from is distinct from p_effective_on
     or (v_in.valid_to is not null and v_in.valid_to <= p_effective_on) then
    raise exception 'working_capital_conveyance_ownership_scope_invalid' using errcode = '23514';
  end if;
  if p_disposition = 'transfer_to_acquirer_by_deed' and nullif(btrim(p_deed_reference), '') is null then
    raise exception 'working_capital_deed_reference_required' using errcode = '23514';
  end if;
  v_balance := finance.statutory_owner_fund_position_v1(p_fund_id, p_unit_id, v_out.party_id);
  insert into finance.statutory_working_capital_conveyances (
    fund_id, tenant_id, property_id, unit_id, outgoing_ownership_id, incoming_ownership_id,
    outgoing_party_id, incoming_party_id, effective_on, frozen_owner_balance, disposition,
    deed_reference, deed_evidence, evidence_hash, idempotency_key, payload_hash, created_by
  ) values (
    p_fund_id, v_fund.tenant_id, v_fund.property_id, p_unit_id, p_outgoing_ownership_id, p_incoming_ownership_id,
    v_out.party_id, v_in.party_id, p_effective_on, v_balance, p_disposition, p_deed_reference,
    p_deed_evidence, encode(extensions.digest(convert_to(p_deed_evidence::text, 'UTF8'), 'sha256'), 'hex'),
    p_idempotency_key, p_payload_hash, p_actor_id
  ) returning * into v_result;
  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_result.tenant_id, p_actor_id, 'service_role', 'statutory.working_capital.conveyance.created',
    'statutory_working_capital_conveyance', v_result.id,
    jsonb_build_object('disposition', v_result.disposition, 'amount', v_result.frozen_owner_balance),
    'R10 Art. 72(5) conveyance decision');
  return v_result;
end
$$;

create or replace function app_private.finalize_working_capital_conveyance_v1(
  p_conveyance_id uuid, p_expected_lock_version integer, p_refund_simple_entry_id uuid,
  p_legal_review_reference text, p_actor_id uuid, p_reason text
)
returns finance.statutory_working_capital_conveyances
language plpgsql security invoker set search_path = pg_catalog
as $$
declare v_c finance.statutory_working_capital_conveyances; v_fund finance.statutory_funds; v_entry finance.statutory_simple_entries;
begin
  if p_conveyance_id is null or p_expected_lock_version is null or p_actor_id is null or nullif(btrim(p_reason), '') is null then
    raise exception 'working_capital_conveyance_finalize_invalid_arguments' using errcode = '22023';
  end if;
  select fund_id into v_c.fund_id from finance.statutory_working_capital_conveyances where id = p_conveyance_id;
  if not found then raise exception 'working_capital_conveyance_not_found' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(hashtextextended('statutory_fund:' || v_c.fund_id::text, 0));
  select * into v_c from finance.statutory_working_capital_conveyances where id = p_conveyance_id for update;
  select * into v_fund from finance.statutory_funds where id = v_c.fund_id for update;
  if v_c.lock_version <> p_expected_lock_version then raise exception 'working_capital_conveyance_lock_version_conflict' using errcode = '40001'; end if;
  if v_c.status <> 'draft' then raise exception 'working_capital_conveyance_not_draft' using errcode = '55000'; end if;
  if v_c.disposition = 'legal_review_required' then raise exception 'working_capital_conveyance_legal_review_required' using errcode = '42501'; end if;
  if nullif(btrim(p_legal_review_reference), '') is null then raise exception 'working_capital_legal_signoff_required' using errcode = '42501'; end if;
  if finance.statutory_owner_fund_position_v1(v_c.fund_id, v_c.unit_id, v_c.outgoing_party_id) <> v_c.frozen_owner_balance then
    raise exception 'working_capital_conveyance_balance_changed' using errcode = '40001';
  end if;
  if v_c.disposition = 'refund_transferor' then
    if p_refund_simple_entry_id is null then raise exception 'working_capital_refund_entry_required' using errcode = '23514'; end if;
    select * into v_entry from finance.statutory_simple_entries where id = p_refund_simple_entry_id for update;
    if v_entry.direction <> 'payment' or v_entry.tenant_id <> v_c.tenant_id or v_entry.property_id <> v_c.property_id
       or v_entry.amount <> v_c.frozen_owner_balance then
      raise exception 'working_capital_refund_entry_invalid' using errcode = '23514';
    end if;
    insert into finance.statutory_fund_movements (
      fund_id, cycle_id, tenant_id, property_id, statutory_simple_entry_id, delta, cash_effect,
      movement_kind, purpose, amount, unit_id, party_id, supporting_document_reference,
      source_snapshot, source_hash, idempotency_key, payload_hash, created_by
    ) values (
      v_c.fund_id, v_entry.cycle_id, v_c.tenant_id, v_c.property_id, v_entry.id, 'decrease', 'payment',
      'refund', null, v_c.frozen_owner_balance, v_c.unit_id, v_c.outgoing_party_id, p_reason,
      jsonb_build_object('conveyance_id', v_c.id, 'legal_review_reference', p_legal_review_reference),
      encode(extensions.digest(convert_to(jsonb_build_object('conveyance_id', v_c.id, 'legal_review_reference', p_legal_review_reference)::text, 'UTF8'), 'sha256'), 'hex'),
      'conveyance-refund:' || v_c.id::text,
      encode(extensions.digest(convert_to('conveyance-refund:' || v_c.id::text, 'UTF8'), 'sha256'), 'hex'), p_actor_id
    );
  else
    insert into finance.statutory_fund_movements (
      fund_id, tenant_id, property_id, conveyance_id, delta, cash_effect, movement_kind,
      amount, unit_id, party_id, supporting_document_reference, source_snapshot, source_hash,
      idempotency_key, payload_hash, created_by
    ) values
      (v_c.fund_id, v_c.tenant_id, v_c.property_id, v_c.id, 'decrease', 'none', 'ownership_transfer_out',
       v_c.frozen_owner_balance, v_c.unit_id, v_c.outgoing_party_id, p_reason,
       jsonb_build_object('deed_reference', v_c.deed_reference), encode(extensions.digest(convert_to(v_c.deed_evidence::text, 'UTF8'),'sha256'),'hex'),
       'conveyance-out:' || v_c.id::text, encode(extensions.digest(convert_to('conveyance-out:' || v_c.id::text, 'UTF8'),'sha256'),'hex'), p_actor_id),
      (v_c.fund_id, v_c.tenant_id, v_c.property_id, v_c.id, 'increase', 'none', 'ownership_transfer_in',
       v_c.frozen_owner_balance, v_c.unit_id, v_c.incoming_party_id, p_reason,
       jsonb_build_object('deed_reference', v_c.deed_reference), encode(extensions.digest(convert_to(v_c.deed_evidence::text, 'UTF8'),'sha256'),'hex'),
       'conveyance-in:' || v_c.id::text, encode(extensions.digest(convert_to('conveyance-in:' || v_c.id::text, 'UTF8'),'sha256'),'hex'), p_actor_id);
  end if;
  update finance.statutory_working_capital_conveyances set status = 'finalized',
    refund_simple_entry_id = p_refund_simple_entry_id, legal_review_reference = p_legal_review_reference,
    finalized_by = p_actor_id, finalized_at = statement_timestamp(), lock_version = lock_version + 1
    where id = p_conveyance_id returning * into v_c;
  insert into audit.events (tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (v_c.tenant_id, p_actor_id, 'service_role', 'statutory.working_capital.conveyance.finalized',
    'statutory_working_capital_conveyance', v_c.id,
    jsonb_build_object('disposition', v_c.disposition, 'amount', v_c.frozen_owner_balance), p_reason);
  return v_c;
end
$$;

alter table finance.statutory_funds enable row level security;
alter table finance.statutory_fund_plans enable row level security;
alter table finance.statutory_fund_assessment_links enable row level security;
alter table finance.statutory_working_capital_conveyances enable row level security;
alter table finance.statutory_fund_movements enable row level security;

create policy statutory_funds_rpc_owner_all on finance.statutory_funds for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_fund_plans_rpc_owner_all on finance.statutory_fund_plans for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_fund_assessment_rpc_owner_all on finance.statutory_fund_assessment_links for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_conveyances_rpc_owner_all on finance.statutory_working_capital_conveyances for all to cladora_rpc_owner using (true) with check (true);
create policy statutory_fund_movements_rpc_owner_all on finance.statutory_fund_movements for all to cladora_rpc_owner using (true) with check (true);

grant usage on schema finance, governance, portfolio, payments, maintenance, audit to cladora_rpc_owner;
grant select, insert, update on finance.statutory_funds, finance.statutory_fund_plans,
  finance.statutory_working_capital_conveyances to cladora_rpc_owner;
grant select, insert on finance.statutory_fund_assessment_links, finance.statutory_fund_movements to cladora_rpc_owner;
grant select on finance.statutory_accounting_regimes, finance.statutory_monthly_cycles,
  finance.statutory_simple_entries, finance.statutory_allocation_batches,
  finance.accounting_periods, finance.journals to cladora_rpc_owner;
grant select on governance.resolutions, governance.meetings to cladora_rpc_owner;
grant select on portfolio.units, portfolio.buildings, portfolio.ownerships, portfolio.parties to cladora_rpc_owner;
grant select on payments.payments to cladora_rpc_owner;
grant select on maintenance.work_orders to cladora_rpc_owner;

revoke all on finance.statutory_funds, finance.statutory_fund_plans,
  finance.statutory_fund_assessment_links, finance.statutory_working_capital_conveyances,
  finance.statutory_fund_movements from public, anon, authenticated;
grant all on finance.statutory_funds, finance.statutory_fund_plans,
  finance.statutory_fund_assessment_links, finance.statutory_working_capital_conveyances,
  finance.statutory_fund_movements to service_role;

revoke all on function finance.statutory_fund_balance_v1(uuid),
  finance.statutory_owner_fund_position_v1(uuid, uuid, uuid),
  finance.validate_statutory_fund_scope_v1(),
  finance.protect_statutory_fund_append_only_v1(),
  finance.protect_finalized_working_capital_conveyance_v1(),
  app_private.create_statutory_fund_v1(uuid, finance.statutory_fund_kind, text, text, uuid, jsonb, jsonb, date, uuid, text, text),
  app_private.activate_statutory_fund_v1(uuid, integer, uuid, text),
  app_private.create_statutory_fund_plan_v1(uuid, uuid, uuid, uuid, numeric, jsonb, text, date, jsonb, uuid, text, text),
  app_private.approve_statutory_fund_plan_v1(uuid, integer, uuid, text),
  app_private.link_statutory_fund_assessment_v1(uuid, uuid, uuid),
  app_private.record_statutory_fund_movement_v1(uuid, uuid, uuid, uuid, uuid, uuid, finance.statutory_fund_delta, finance.statutory_fund_movement_kind, finance.statutory_fund_purpose, numeric, uuid, uuid, text, text, text, text, jsonb, uuid, text, text),
  app_private.reverse_statutory_fund_movement_v1(uuid, uuid, uuid, text, jsonb, uuid, text, text),
  app_private.create_working_capital_conveyance_v1(uuid, uuid, uuid, uuid, date, finance.statutory_conveyance_disposition, text, jsonb, uuid, text, text),
  app_private.finalize_working_capital_conveyance_v1(uuid, integer, uuid, text, uuid, text)
from public, anon, authenticated;

grant execute on function finance.statutory_fund_balance_v1(uuid),
  finance.statutory_owner_fund_position_v1(uuid, uuid, uuid),
  app_private.create_statutory_fund_v1(uuid, finance.statutory_fund_kind, text, text, uuid, jsonb, jsonb, date, uuid, text, text),
  app_private.activate_statutory_fund_v1(uuid, integer, uuid, text),
  app_private.create_statutory_fund_plan_v1(uuid, uuid, uuid, uuid, numeric, jsonb, text, date, jsonb, uuid, text, text),
  app_private.approve_statutory_fund_plan_v1(uuid, integer, uuid, text),
  app_private.link_statutory_fund_assessment_v1(uuid, uuid, uuid),
  app_private.record_statutory_fund_movement_v1(uuid, uuid, uuid, uuid, uuid, uuid, finance.statutory_fund_delta, finance.statutory_fund_movement_kind, finance.statutory_fund_purpose, numeric, uuid, uuid, text, text, text, text, jsonb, uuid, text, text),
  app_private.reverse_statutory_fund_movement_v1(uuid, uuid, uuid, text, jsonb, uuid, text, text),
  app_private.create_working_capital_conveyance_v1(uuid, uuid, uuid, uuid, date, finance.statutory_conveyance_disposition, text, jsonb, uuid, text, text),
  app_private.finalize_working_capital_conveyance_v1(uuid, integer, uuid, text, uuid, text)
to service_role;

comment on table finance.statutory_fund_plans is
  'Approved statutory target/budget; it is neither an assessment nor a cash balance.';
comment on table finance.statutory_fund_assessment_links is
  'One-to-one evidence link to a finalized statutory allocation batch; unit results are never duplicated.';
comment on table finance.statutory_fund_movements is
  'Append-only fund subledger. Cash legs reference statutory simple-entry records; deed retention uses zero-cash paired legs.';
comment on table finance.statutory_working_capital_conveyances is
  'Law 196/2018 Art. 72(5) conveyance decision. Ambiguity is fail-closed as legal_review_required.';

commit;
