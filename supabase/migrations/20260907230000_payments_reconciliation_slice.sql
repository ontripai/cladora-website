-- Migration 69: Production Payments, Allocation & Bank Reconciliation Vertical Slice
-- Scope: Payments recording, multi-bill allocation, unallocated/suspense management,
--        compensating reversal/refund, bank matching, reconciliation sessions,
--        double-entry accounting integration, closed-period protection,
--        customer_api gateway wrappers, audit events.

begin;

-- =============================================================================
-- 1. Schema & Table Enhancements
-- =============================================================================

-- Enhance payments.payments with method, idempotency, description and reversal fields
alter table payments.payments
  add column if not exists method text check (method in ('bank_transfer','card','cash','direct_debit','other')) default 'bank_transfer',
  add column if not exists idempotency_key text,
  add column if not exists description text,
  add column if not exists reversal_reason text,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid references auth.users(id) on delete restrict,
  add column if not exists reversal_journal_id uuid references finance.journals(id) on delete restrict;

create unique index if not exists payments_tenant_idempotency_idx
  on payments.payments (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists payments_tenant_status_paid_idx
  on payments.payments (tenant_id, status, paid_at desc, id desc);

create index if not exists payments_reversal_journal_id_idx
  on payments.payments (reversal_journal_id);

create index if not exists payments_reversed_by_idx
  on payments.payments (reversed_by);

-- Create payments.payment_allocations for Payment <-> Bill/Receivable allocations
create table if not exists payments.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  payment_id uuid not null references payments.payments(id) on delete restrict,
  receivable_id uuid not null references billing.receivables(id) on delete restrict,
  amount numeric(20,4) not null check(amount > 0),
  status text not null default 'active' check(status in ('active','reversed')),
  idempotency_key text,
  created_at timestamptz not null default statement_timestamp(),
  created_by uuid references auth.users(id) on delete restrict,
  reversed_at timestamptz,
  reversed_by uuid references auth.users(id) on delete restrict,
  reversal_reason text
);

create unique index if not exists payment_allocations_tenant_idempotency_idx
  on payments.payment_allocations (tenant_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists payment_allocations_tenant_id_idx
  on payments.payment_allocations (tenant_id);

create index if not exists payment_allocations_payment_idx
  on payments.payment_allocations (payment_id, status);

create index if not exists payment_allocations_receivable_idx
  on payments.payment_allocations (receivable_id, status);

create index if not exists payment_allocations_created_by_idx
  on payments.payment_allocations (created_by);

create index if not exists payment_allocations_reversed_by_idx
  on payments.payment_allocations (reversed_by);

alter table payments.payment_allocations enable row level security;

drop policy if exists payment_allocations_context_read on payments.payment_allocations;
create policy payment_allocations_context_read on payments.payment_allocations
  for select to authenticated
  using (
    tenant_id = app_private.active_tenant_id()
    and exists (
      select 1 from payments.payments p
      where p.id = payment_id
        and ((p.unit_id is not null and app_private.can_access_unit(p.unit_id))
             or (p.unit_id is null and app_private.can_access_property(p.property_id)))
    )
  );

grant select on payments.payment_allocations to authenticated;
grant all on payments.payment_allocations to service_role;

-- Create payments.reconciliation_sessions
create table if not exists payments.reconciliation_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  bank_account_id uuid not null references payments.bank_accounts(id) on delete restrict,
  statement_date date not null,
  period_start date not null,
  period_end date not null,
  opening_balance numeric(20,4) not null default 0,
  closing_balance numeric(20,4) not null default 0,
  total_credits numeric(20,4) not null default 0,
  total_debits numeric(20,4) not null default 0,
  difference numeric(20,4) not null default 0,
  status text not null default 'draft' check(status in ('draft','reconciled')),
  reconciled_at timestamptz,
  reconciled_by uuid references auth.users(id) on delete restrict,
  notes text,
  created_at timestamptz not null default statement_timestamp(),
  check(period_end >= period_start)
);

create index if not exists reconciliation_sessions_bank_account_idx
  on payments.reconciliation_sessions (tenant_id, bank_account_id, period_start, period_end);

create index if not exists reconciliation_sessions_bank_account_id_idx
  on payments.reconciliation_sessions (bank_account_id);

create index if not exists reconciliation_sessions_reconciled_by_idx
  on payments.reconciliation_sessions (reconciled_by);

alter table payments.reconciliation_sessions enable row level security;

drop policy if exists reconciliation_sessions_context_read on payments.reconciliation_sessions;
create policy reconciliation_sessions_context_read on payments.reconciliation_sessions
  for select to authenticated
  using (
    tenant_id = app_private.active_tenant_id()
    and exists (
      select 1 from payments.bank_accounts a
      where a.id = bank_account_id
        and (a.property_id is null or app_private.can_access_property(a.property_id))
    )
  );

grant select on payments.reconciliation_sessions to authenticated;
grant all on payments.reconciliation_sessions to service_role;

-- Allow bank transaction unmatching in protect_confirmed_reconciliation
create or replace function payments.protect_confirmed_reconciliation()
returns trigger language plpgsql security definer
set search_path = pg_catalog, payments, billing
as $$
declare
  v_tx payments.bank_transactions;
  v_payment payments.payments;
  v_receivable billing.receivables;
  v_invoice billing.invoices;
  v_sum numeric(20,4);
begin
  -- If updating an already confirmed reconciliation
  if tg_op = 'UPDATE' and old.status = 'confirmed' then
    -- Allow unmatching if transitioning to 'unmatched' or 'rejected'
    if new.status in ('unmatched', 'rejected') then
      return new;
    end if;
    if new is distinct from old then
      raise exception 'confirmed_reconciliation_is_immutable';
    end if;
    return new;
  end if;

  if tg_op = 'DELETE' and old.status = 'confirmed' then
    raise exception 'confirmed_reconciliation_is_immutable';
  end if;

  if tg_op = 'DELETE' or new.status <> 'confirmed' then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select * into v_tx from payments.bank_transactions where id = new.bank_transaction_id and tenant_id = new.tenant_id;
  if not found then raise exception 'bank_transaction_tenant_mismatch'; end if;
  if v_tx.direction <> 'credit' then raise exception 'only_credit_transactions_can_be_reconciled'; end if;

  select coalesce(sum(matched_amount), 0) into v_sum from payments.reconciliation_matches
    where bank_transaction_id = new.bank_transaction_id and status = 'confirmed' and id <> new.id;
  if v_sum + new.matched_amount > v_tx.amount then raise exception 'bank_transaction_overallocated'; end if;

  if new.payment_id is not null then
    select * into v_payment from payments.payments where id = new.payment_id and tenant_id = new.tenant_id;
    if not found or v_payment.currency <> v_tx.currency then raise exception 'payment_currency_mismatch'; end if;
    select coalesce(sum(matched_amount), 0) into v_sum from payments.reconciliation_matches
      where payment_id = new.payment_id and status = 'confirmed' and id <> new.id;
    if v_sum + new.matched_amount > v_payment.amount then raise exception 'payment_overallocated'; end if;
  end if;

  if new.receivable_id is not null then
    select * into v_receivable from billing.receivables where id = new.receivable_id and tenant_id = new.tenant_id;
    if not found then raise exception 'receivable_tenant_mismatch'; end if;
    select * into v_invoice from billing.invoices where id = v_receivable.invoice_id and tenant_id = new.tenant_id;
    if not found or v_invoice.currency <> v_tx.currency then raise exception 'receivable_currency_mismatch'; end if;
    select coalesce(sum(matched_amount), 0) into v_sum from payments.reconciliation_matches
      where receivable_id = new.receivable_id and status = 'confirmed' and id <> new.id;
    if v_sum + new.matched_amount > greatest(v_receivable.original_amount - v_receivable.credited_amount, 0) then
      raise exception 'receivable_overallocated';
    end if;
  end if;

  return new;
end $$;

-- Allow invoice status recomputation when payments are reversed or unallocated
create or replace function billing.protect_issued_invoice()
returns trigger language plpgsql security definer set search_path = pg_catalog, billing
as $$
declare
  s billing.invoice_status;
  lines_subtotal numeric(20,4);
  lines_tax numeric(20,4);
begin
  if tg_table_name = 'invoices' then
    if tg_op = 'DELETE' and old.status <> 'draft' then
      raise exception 'issued_invoice_is_immutable';
    end if;

    if tg_op = 'UPDATE' and old.status in ('void', 'credited') and new is distinct from old then
      raise exception 'terminal_invoice_is_immutable';
    end if;

    if tg_op = 'UPDATE' and old.status = 'paid' then
      if new.status not in ('paid', 'partially_paid', 'issued') then
        raise exception 'terminal_invoice_is_immutable';
      end if;
      if (new.tenant_id, new.property_id, new.unit_id, new.liable_party_id, new.period_start, new.period_end, new.due_on, new.currency, new.subtotal, new.tax_total)
         is distinct from
         (old.tenant_id, old.property_id, old.unit_id, old.liable_party_id, old.period_start, old.period_end, old.due_on, old.currency, old.subtotal, old.tax_total) then
        raise exception 'terminal_invoice_is_immutable';
      end if;
    end if;

    if tg_op = 'UPDATE' and old.status <> 'draft' and
      (new.tenant_id, new.property_id, new.unit_id, new.liable_party_id, new.period_start, new.period_end, new.issued_on, new.due_on,
       new.currency, new.subtotal, new.tax_total, new.allocation_run_id, new.journal_id, new.issued_snapshot)
      is distinct from
      (old.tenant_id, old.property_id, old.unit_id, old.liable_party_id, old.period_start, old.period_end, old.issued_on, old.due_on,
       old.currency, old.subtotal, old.tax_total, old.allocation_run_id, old.journal_id, old.issued_snapshot) then
      raise exception 'issued_invoice_financial_fields_are_immutable';
    end if;

    if tg_op = 'UPDATE' and old.status = 'draft' and new.status <> 'draft' then
      select coalesce(sum(line_subtotal),0), coalesce(sum(line_tax),0) into lines_subtotal, lines_tax
      from billing.invoice_lines where invoice_id = old.id;
      if lines_subtotal <> new.subtotal or lines_tax <> new.tax_total then
        raise exception 'invoice_totals_do_not_match_lines';
      end if;
      new.issued_on = coalesce(new.issued_on, current_date);
      new.issued_snapshot = coalesce(new.issued_snapshot, jsonb_build_object('invoice_id', new.id, 'subtotal', new.subtotal, 'tax_total', new.tax_total, 'currency', new.currency));
    end if;

    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select status into s from billing.invoices where id = coalesce(new.invoice_id, old.invoice_id);
  if s <> 'draft' then raise exception 'issued_invoice_lines_are_immutable'; end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- =============================================================================
-- 2. Permissions Bootstrap
-- =============================================================================

insert into identity.permissions (code, resource, action, description)
values
  ('payments.manage', 'payments.payment', 'manage', 'Record and manage customer payment transactions'),
  ('payments.allocate', 'payments.allocation', 'allocate', 'Allocate payments to outstanding bills and receivables'),
  ('payments.reverse', 'payments.payment', 'reverse', 'Perform controlled reversals of payment transactions and allocations'),
  ('payments.reconcile', 'payments.reconciliation', 'reconcile', 'Match bank transactions and finalize bank reconciliation sessions')
on conflict (code) do nothing;

insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where p.code in ('payments.manage', 'payments.allocate', 'payments.reverse', 'payments.reconcile')
  and lower(r.code) in ('association_admin', 'property_manager')
on conflict (role_id, permission_id) do nothing;

-- =============================================================================
-- 3. Domain RPCs in schema 'payments'
-- =============================================================================

-- 3.1 Record Payment
create or replace function payments.record_payment(
  p_context_id uuid,
  p_property_id uuid,
  p_amount numeric,
  p_currency text default 'RON',
  p_paid_at timestamptz default statement_timestamp(),
  p_unit_id uuid default null,
  p_payer_party_id uuid default null,
  p_method text default 'bank_transfer',
  p_provider_ref text default null,
  p_description text default null,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, billing, finance, identity, platform, portfolio, occupancy, audit
as $$
declare
  v record;
  v_workspace uuid;
  v_existing payments.payments;
  v_bank_account_id uuid;
  v_ar_account_id uuid;
  v_journal_id uuid;
  v_journal_no integer;
  v_payment_id uuid;
  v_payment payments.payments;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  if p_amount <= 0 then raise exception 'payment_amount_must_be_positive' using errcode = '22023'; end if;
  if p_currency is null or length(trim(p_currency)) <> 3 then raise exception 'invalid_currency' using errcode = '22023'; end if;
  if p_method not in ('bank_transfer', 'card', 'cash', 'direct_debit', 'other') then
    raise exception 'invalid_payment_method' using errcode = '22023';
  end if;

  -- Verify active context and membership
  select g.*, m.id as membership_key, m.role_id, r.code as role_code, r.name as role_name, t.legal_name as tenant_name
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  join platform.tenants t on t.id = m.tenant_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;

  if lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'payment_permission_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code = 'payments.manage'
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  -- Entitlement check
  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace
      and e.entitlement_key = 'module.payments'
      and e.valid_from <= statement_timestamp()
      and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb
                else e.boolean_value is true end)
  ) then
    raise exception 'payment_entitlement_required' using errcode = '42501';
  end if;

  -- Idempotency check
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    select * into v_existing from payments.payments
    where tenant_id = v.tenant_id and idempotency_key = trim(p_idempotency_key);
    if found then
      return jsonb_build_object(
        'payment', jsonb_build_object(
          'id', v_existing.id,
          'amount', v_existing.amount,
          'currency', v_existing.currency,
          'paid_at', v_existing.paid_at,
          'status', v_existing.status,
          'method', v_existing.method,
          'provider_ref', v_existing.provider_ref,
          'journal_id', v_existing.journal_id,
          'allocated_amount', coalesce((select sum(amount) from payments.payment_allocations where payment_id = v_existing.id and status = 'active'), 0),
          'unallocated_amount', greatest(v_existing.amount - coalesce((select sum(amount) from payments.payment_allocations where payment_id = v_existing.id and status = 'active'), 0), 0)
        ),
        'idempotent', true
      );
    end if;
  end if;

  -- Verify property scope
  if not exists (select 1 from portfolio.properties where id = p_property_id and tenant_id = v.tenant_id) then
    raise exception 'property_not_found' using errcode = '22023';
  end if;

  -- Verify unit scope if provided
  if p_unit_id is not null and not exists (
    select 1 from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.tenant_id = v.tenant_id and b.property_id = p_property_id
  ) then
    raise exception 'unit_property_mismatch' using errcode = '22023';
  end if;

  -- Verify open financial period
  perform finance.assert_scope_date_not_in_closed_period(v.tenant_id, p_property_id, p_paid_at::date);

  -- Select Bank/Cash account (5121 or 5311)
  select id into v_bank_account_id from finance.accounts
  where tenant_id = v.tenant_id and (property_id is null or property_id = p_property_id)
    and (code = '5121' or code like '512%' or code like '531%') and status = 'active'
  order by (case when property_id = p_property_id then 0 else 1 end), code limit 1;

  if v_bank_account_id is null then
    raise exception 'bank_gl_account_not_found' using errcode = '22023';
  end if;

  -- Select Accounts Receivable account (4111)
  select id into v_ar_account_id from finance.accounts
  where tenant_id = v.tenant_id and (property_id is null or property_id = p_property_id)
    and (code = '4111' or code like '411%') and status = 'active'
  order by (case when property_id = p_property_id then 0 else 1 end), code limit 1;

  if v_ar_account_id is null then
    raise exception 'ar_gl_account_not_found' using errcode = '22023';
  end if;

  v_payment_id := gen_random_uuid();

  -- Create Draft Journal
  insert into finance.journals (
    tenant_id, property_id, occurred_on, currency, description, source_type, source_id, status
  ) values (
    v.tenant_id, p_property_id, p_paid_at::date, p_currency,
    'Payment received: ' || coalesce(p_provider_ref, p_description, 'Receipt'),
    'payments.payment', v_payment_id, 'draft'
  ) returning id, journal_no into v_journal_id, v_journal_no;

  -- Balanced Journal Entries: Debit Bank, Credit Accounts Receivable
  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    v.tenant_id, v_journal_id, v_bank_account_id, p_unit_id, p_payer_party_id,
    'debit', p_amount, 'Payment receipt to bank'
  );

  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    v.tenant_id, v_journal_id, v_ar_account_id, p_unit_id, p_payer_party_id,
    'credit', p_amount, 'Payment clearing against receivables'
  );

  -- Post Journal (triggers enforce double-entry balance and open period)
  update finance.journals
  set status = 'posted',
      posted_at = statement_timestamp(),
      posted_by = auth.uid()
  where id = v_journal_id;

  -- Insert Payment record with pre-generated id
  insert into payments.payments (
    id, tenant_id, property_id, unit_id, payer_party_id, amount, currency,
    paid_at, status, journal_id, method, provider_ref, description, idempotency_key
  ) values (
    v_payment_id, v.tenant_id, p_property_id, p_unit_id, p_payer_party_id, p_amount, p_currency,
    p_paid_at, 'settled', v_journal_id, p_method, p_provider_ref, p_description, trim(p_idempotency_key)
  ) returning * into v_payment;

  -- Audit event
  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'PAYMENT_RECORDED', 'payments.payment', v_payment.id,
    jsonb_build_object(
      'payment_id', v_payment.id,
      'amount', v_payment.amount,
      'currency', v_payment.currency,
      'paid_at', v_payment.paid_at,
      'method', v_payment.method,
      'journal_id', v_journal_id,
      'journal_no', v_journal_no
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'payment', jsonb_build_object(
      'id', v_payment.id,
      'amount', v_payment.amount,
      'currency', v_payment.currency,
      'paid_at', v_payment.paid_at,
      'status', v_payment.status,
      'method', v_payment.method,
      'provider_ref', v_payment.provider_ref,
      'description', v_payment.description,
      'journal_id', v_payment.journal_id,
      'journal_no', v_journal_no,
      'allocated_amount', 0,
      'unallocated_amount', v_payment.amount
    )
  );
end $$;

-- 3.2 Allocate Payment
create or replace function payments.allocate_payment(
  p_context_id uuid,
  p_payment_id uuid,
  p_allocations jsonb,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, billing, finance, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_payment payments.payments;
  v_allocated_so_far numeric(20,4);
  v_total_allocating numeric(20,4) := 0;
  v_alloc_item jsonb;
  v_rec_id uuid;
  v_alloc_amount numeric(20,4);
  v_receivable billing.receivables;
  v_invoice billing.invoices;
  v_new_paid numeric(20,4);
  v_new_status billing.invoice_status;
  v_result_allocations jsonb := '[]'::jsonb;
  v_alloc_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  if p_allocations is null or jsonb_array_length(p_allocations) = 0 then
    raise exception 'allocations_array_required' using errcode = '22023';
  end if;

  -- Validate context and permissions
  select g.*, m.id as membership_key, m.role_id, r.code as role_code, r.name as role_name, t.legal_name as tenant_name
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  join platform.tenants t on t.id = m.tenant_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;

  if lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'payment_permission_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.allocate', 'payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  -- Check payment
  select * into v_payment from payments.payments
  where id = p_payment_id and tenant_id = v.tenant_id for update;

  if not found then raise exception 'payment_not_found' using errcode = '22023'; end if;
  if v_payment.status in ('failed', 'refunded') then
    raise exception 'payment_not_in_allocatable_status' using errcode = '22023';
  end if;

  select coalesce(sum(amount), 0) into v_allocated_so_far
  from payments.payment_allocations
  where payment_id = p_payment_id and status = 'active';

  -- Pre-validate total allocation amount
  for v_alloc_item in select * from jsonb_array_elements(p_allocations) loop
    v_alloc_amount := (v_alloc_item->>'amount')::numeric(20,4);
    if v_alloc_amount <= 0 then raise exception 'allocation_amount_must_be_positive' using errcode = '22023'; end if;
    v_total_allocating := v_total_allocating + v_alloc_amount;
  end loop;

  if v_allocated_so_far + v_total_allocating > v_payment.amount then
    raise exception 'payment_overallocated' using errcode = '22023';
  end if;

  -- Process each allocation
  for v_alloc_item in select * from jsonb_array_elements(p_allocations) loop
    v_rec_id := (v_alloc_item->>'receivable_id')::uuid;
    v_alloc_amount := (v_alloc_item->>'amount')::numeric(20,4);

    select * into v_receivable from billing.receivables
    where id = v_rec_id and tenant_id = v.tenant_id for update;

    if not found then raise exception 'receivable_not_found' using errcode = '22023'; end if;

    select * into v_invoice from billing.invoices
    where id = v_receivable.invoice_id and tenant_id = v.tenant_id;

    if v_invoice.currency <> v_payment.currency then
      raise exception 'allocation_currency_mismatch' using errcode = '22023';
    end if;

    -- Cross-unit liability guard
    if v_payment.unit_id is not null and v_invoice.unit_id <> v_payment.unit_id then
      raise exception 'cross_unit_allocation_forbidden' using errcode = '22023';
    end if;

    -- Prevent over-allocation on the receivable
    if v_alloc_amount > v_receivable.outstanding_amount then
      raise exception 'receivable_overallocated' using errcode = '22023';
    end if;

    -- Insert allocation record
    insert into payments.payment_allocations (
      tenant_id, payment_id, receivable_id, amount, status, created_by, idempotency_key
    ) values (
      v.tenant_id, p_payment_id, v_rec_id, v_alloc_amount, 'active', auth.uid(),
      case when p_idempotency_key is not null then p_idempotency_key || ':' || v_rec_id::text else null end
    ) returning id into v_alloc_id;

    -- Update receivable
    v_new_paid := v_receivable.paid_amount + v_alloc_amount;
    update billing.receivables
    set paid_amount = v_new_paid,
        last_payment_at = statement_timestamp(),
        updated_at = statement_timestamp()
    where id = v_rec_id;

    -- Recompute invoice status
    if (v_receivable.original_amount - v_new_paid - v_receivable.credited_amount) <= 0 then
      v_new_status := 'paid';
    else
      v_new_status := 'partially_paid';
    end if;

    update billing.invoices
    set status = v_new_status,
        updated_at = statement_timestamp()
    where id = v_receivable.invoice_id;

    -- Audit event
    insert into audit.events (
      tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
    ) values (
      v.tenant_id, auth.uid(), v.role_code, 'PAYMENT_ALLOCATED', 'payments.payment_allocation', v_alloc_id,
      jsonb_build_object(
        'allocation_id', v_alloc_id,
        'payment_id', p_payment_id,
        'receivable_id', v_rec_id,
        'invoice_id', v_receivable.invoice_id,
        'invoice_no', v_invoice.invoice_no,
        'amount', v_alloc_amount,
        'new_invoice_status', v_new_status
      ),
      statement_timestamp()
    );

    v_result_allocations := v_result_allocations || jsonb_build_object(
      'id', v_alloc_id,
      'receivable_id', v_rec_id,
      'invoice_id', v_receivable.invoice_id,
      'invoice_no', v_invoice.invoice_no,
      'amount', v_alloc_amount,
      'status', 'active'
    );
  end loop;

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'total_allocated', v_allocated_so_far + v_total_allocating,
    'unallocated_balance', greatest(v_payment.amount - (v_allocated_so_far + v_total_allocating), 0),
    'allocations', v_result_allocations
  );
end $$;

-- 3.3 Unallocate Payment
create or replace function payments.unallocate_payment(
  p_context_id uuid,
  p_allocation_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, billing, finance, identity, platform, audit
as $$
declare
  v record;
  v_alloc payments.payment_allocations;
  v_receivable billing.receivables;
  v_new_paid numeric(20,4);
  v_new_status billing.invoice_status;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'unallocation_reason_required' using errcode = '22023';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'payment_permission_denied' using errcode = '42501';
  end if;

  select * into v_alloc from payments.payment_allocations
  where id = p_allocation_id and tenant_id = v.tenant_id for update;

  if not found then raise exception 'allocation_not_found' using errcode = '22023'; end if;
  if v_alloc.status <> 'active' then raise exception 'allocation_already_reversed' using errcode = '22023'; end if;

  -- Mark reversed
  update payments.payment_allocations
  set status = 'reversed',
      reversed_at = statement_timestamp(),
      reversed_by = auth.uid(),
      reversal_reason = trim(p_reason)
  where id = p_allocation_id;

  -- Decrement receivable paid_amount
  select * into v_receivable from billing.receivables where id = v_alloc.receivable_id for update;
  v_new_paid := greatest(v_receivable.paid_amount - v_alloc.amount, 0);

  update billing.receivables
  set paid_amount = v_new_paid,
      updated_at = statement_timestamp()
  where id = v_alloc.receivable_id;

  -- Recalculate invoice status
  if v_new_paid = 0 then
    v_new_status := 'issued';
  else
    v_new_status := 'partially_paid';
  end if;

  update billing.invoices
  set status = v_new_status,
      updated_at = statement_timestamp()
  where id = v_receivable.invoice_id;

  -- Audit event
  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'PAYMENT_UNALLOCATED', 'payments.payment_allocation', p_allocation_id,
    jsonb_build_object(
      'allocation_id', p_allocation_id,
      'payment_id', v_alloc.payment_id,
      'receivable_id', v_alloc.receivable_id,
      'amount', v_alloc.amount,
      'reason', trim(p_reason),
      'new_invoice_status', v_new_status
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'allocation_id', p_allocation_id,
    'payment_id', v_alloc.payment_id,
    'status', 'reversed',
    'reversal_reason', trim(p_reason),
    'new_invoice_status', v_new_status
  );
end $$;

-- 3.4 Reverse Payment
create or replace function payments.reverse_payment(
  p_context_id uuid,
  p_payment_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, billing, finance, identity, platform, audit
as $$
declare
  v record;
  v_payment payments.payments;
  v_bank_account_id uuid;
  v_ar_account_id uuid;
  v_reversal_journal_id uuid;
  v_reversal_journal_no integer;
  v_alloc record;
  v_receivable billing.receivables;
  v_new_paid numeric(20,4);
  v_new_status billing.invoice_status;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'reversal_reason_required' using errcode = '22023';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'payment_permission_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.reverse', 'payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select * into v_payment from payments.payments
  where id = p_payment_id and tenant_id = v.tenant_id for update;

  if not found then raise exception 'payment_not_found' using errcode = '22023'; end if;
  if v_payment.status = 'refunded' then
    raise exception 'payment_already_reversed' using errcode = '22023';
  end if;

  -- Verify open financial period for current reversal date
  perform finance.assert_scope_date_not_in_closed_period(v.tenant_id, v_payment.property_id, current_date);

  -- Reverse any active allocations on this payment
  for v_alloc in select * from payments.payment_allocations where payment_id = p_payment_id and status = 'active' for update loop
    update payments.payment_allocations
    set status = 'reversed',
        reversed_at = statement_timestamp(),
        reversed_by = auth.uid(),
        reversal_reason = 'Payment reversed: ' || trim(p_reason)
    where id = v_alloc.id;

    select * into v_receivable from billing.receivables where id = v_alloc.receivable_id for update;
    v_new_paid := greatest(v_receivable.paid_amount - v_alloc.amount, 0);

    update billing.receivables
    set paid_amount = v_new_paid,
        updated_at = statement_timestamp()
    where id = v_alloc.receivable_id;

    if v_new_paid = 0 then
      v_new_status := 'issued';
    else
      v_new_status := 'partially_paid';
    end if;

    update billing.invoices
    set status = v_new_status,
        updated_at = statement_timestamp()
    where id = v_receivable.invoice_id;
  end loop;

  -- Select Bank and AR accounts for compensating entry
  select id into v_bank_account_id from finance.accounts
  where tenant_id = v.tenant_id and (property_id is null or property_id = v_payment.property_id)
    and (code = '5121' or code like '512%' or code like '531%') and status = 'active'
  order by (case when property_id = v_payment.property_id then 0 else 1 end), code limit 1;

  select id into v_ar_account_id from finance.accounts
  where tenant_id = v.tenant_id and (property_id is null or property_id = v_payment.property_id)
    and (code = '4111' or code like '411%') and status = 'active'
  order by (case when property_id = v_payment.property_id then 0 else 1 end), code limit 1;

  -- Post Compensating Journal: Debit AR, Credit Bank
  insert into finance.journals (
    tenant_id, property_id, occurred_on, currency, description, source_type, source_id, status
  ) values (
    v.tenant_id, v_payment.property_id, current_date, v_payment.currency,
    'Payment reversal: ' || trim(p_reason),
    'payments.payment_reversal', p_payment_id, 'draft'
  ) returning id, journal_no into v_reversal_journal_id, v_reversal_journal_no;

  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    v.tenant_id, v_reversal_journal_id, v_ar_account_id, v_payment.unit_id, v_payment.payer_party_id,
    'debit', v_payment.amount, 'Reversal restoring accounts receivable'
  );

  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    v.tenant_id, v_reversal_journal_id, v_bank_account_id, v_payment.unit_id, v_payment.payer_party_id,
    'credit', v_payment.amount, 'Reversal deducting bank balance'
  );

  update finance.journals
  set status = 'posted',
      posted_at = statement_timestamp(),
      posted_by = auth.uid()
  where id = v_reversal_journal_id;

  -- Update Payment record
  update payments.payments
  set status = 'refunded',
      reversal_reason = trim(p_reason),
      reversed_at = statement_timestamp(),
      reversed_by = auth.uid(),
      reversal_journal_id = v_reversal_journal_id
  where id = p_payment_id;

  -- Audit event
  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'PAYMENT_REVERSED', 'payments.payment', p_payment_id,
    jsonb_build_object(
      'payment_id', p_payment_id,
      'amount', v_payment.amount,
      'reason', trim(p_reason),
      'reversal_journal_id', v_reversal_journal_id,
      'reversal_journal_no', v_reversal_journal_no
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'status', 'refunded',
    'reversal_reason', trim(p_reason),
    'reversal_journal_id', v_reversal_journal_id,
    'reversal_journal_no', v_reversal_journal_no
  );
end $$;

-- 3.5 List Bank Transactions
create or replace function payments.list_bank_transactions(
  p_context_id uuid,
  p_bank_account_id uuid default null,
  p_match_status text default null,
  p_from date default null,
  p_to date default null,
  p_limit integer default 25,
  p_offset integer default 0
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, payments, platform, identity
as $$
declare
  v record;
  v_total bigint;
  v_rows jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;

  with tx as (
    select bt.*,
      ba.bank_name,
      ba.currency as account_currency,
      coalesce((
        select sum(rm.matched_amount)
        from payments.reconciliation_matches rm
        where rm.bank_transaction_id = bt.id and rm.status = 'confirmed'
      ), 0) as matched_amount,
      (
        select jsonb_agg(jsonb_build_object(
          'match_id', rm.id,
          'status', rm.status,
          'matched_amount', rm.matched_amount,
          'payment_id', rm.payment_id,
          'receivable_id', rm.receivable_id
        ))
        from payments.reconciliation_matches rm
        where rm.bank_transaction_id = bt.id and rm.status <> 'rejected'
      ) as matches
    from payments.bank_transactions bt
    join payments.bank_accounts ba on ba.id = bt.bank_account_id
    where bt.tenant_id = v.tenant_id
      and (p_bank_account_id is null or bt.bank_account_id = p_bank_account_id)
      and (p_from is null or bt.booked_on >= p_from)
      and (p_to is null or bt.booked_on <= p_to)
  ),
  filtered as (
    select * from tx
    where (
      p_match_status is null
      or (p_match_status = 'unmatched' and matched_amount = 0)
      or (p_match_status = 'matched' and matched_amount > 0)
    )
  ),
  page as (
    select *, count(*) over() as total_count
    from filtered
    order by booked_on desc, id desc
    limit p_limit offset p_offset
  )
  select coalesce(max(total_count), 0),
         coalesce(jsonb_agg(to_jsonb(page.*) - 'total_count' order by booked_on desc, id desc), '[]'::jsonb)
  into v_total, v_rows
  from page;

  return jsonb_build_object(
    'total', v_total,
    'bank_transactions', v_rows,
    'limit', p_limit,
    'offset', p_offset
  );
end $$;

-- 3.6 Match Bank Transaction
create or replace function payments.match_bank_transaction(
  p_context_id uuid,
  p_bank_transaction_id uuid,
  p_payment_id uuid default null,
  p_receivable_id uuid default null,
  p_matched_amount numeric default null,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, billing, identity, platform, audit
as $$
declare
  v record;
  v_tx payments.bank_transactions;
  v_payment payments.payments;
  v_receivable billing.receivables;
  v_amount numeric(20,4);
  v_match_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'payment_permission_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.reconcile', 'payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select * into v_tx from payments.bank_transactions
  where id = p_bank_transaction_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'bank_transaction_not_found' using errcode = '22023'; end if;

  if p_payment_id is null and p_receivable_id is null then
    raise exception 'match_target_required' using errcode = '22023';
  end if;

  v_amount := coalesce(p_matched_amount, v_tx.amount);
  if v_amount <= 0 then raise exception 'match_amount_must_be_positive' using errcode = '22023'; end if;

  if p_payment_id is not null then
    select * into v_payment from payments.payments where id = p_payment_id and tenant_id = v.tenant_id;
    if not found then raise exception 'payment_not_found' using errcode = '22023'; end if;
    if v_payment.currency <> v_tx.currency then raise exception 'payment_currency_mismatch' using errcode = '22023'; end if;
  end if;

  if p_receivable_id is not null then
    select * into v_receivable from billing.receivables where id = p_receivable_id and tenant_id = v.tenant_id;
    if not found then raise exception 'receivable_not_found' using errcode = '22023'; end if;
  end if;

  insert into payments.reconciliation_matches (
    tenant_id, bank_transaction_id, payment_id, receivable_id,
    matched_amount, confidence, status, rationale_json, confirmed_by, confirmed_at
  ) values (
    v.tenant_id, p_bank_transaction_id, p_payment_id, p_receivable_id,
    v_amount, 1.00000, 'confirmed',
    jsonb_build_object('notes', p_notes, 'matched_by', auth.uid()),
    auth.uid(), statement_timestamp()
  ) returning id into v_match_id;

  -- Audit event
  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BANK_TRANSACTION_MATCHED', 'payments.reconciliation_match', v_match_id,
    jsonb_build_object(
      'match_id', v_match_id,
      'bank_transaction_id', p_bank_transaction_id,
      'payment_id', p_payment_id,
      'receivable_id', p_receivable_id,
      'matched_amount', v_amount
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'match_id', v_match_id,
    'bank_transaction_id', p_bank_transaction_id,
    'payment_id', p_payment_id,
    'receivable_id', p_receivable_id,
    'matched_amount', v_amount,
    'status', 'confirmed'
  );
end $$;

-- 3.7 Unmatch Bank Transaction
create or replace function payments.unmatch_bank_transaction(
  p_context_id uuid,
  p_match_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, identity, platform, audit
as $$
declare
  v record;
  v_match payments.reconciliation_matches;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  if p_reason is null or length(trim(p_reason)) = 0 then
    raise exception 'unmatch_reason_required' using errcode = '22023';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'payment_permission_denied' using errcode = '42501';
  end if;

  select * into v_match from payments.reconciliation_matches
  where id = p_match_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'match_not_found' using errcode = '22023'; end if;

  update payments.reconciliation_matches
  set status = 'unmatched',
      rationale_json = rationale_json || jsonb_build_object(
        'unmatch_reason', trim(p_reason),
        'unmatched_by', auth.uid(),
        'unmatched_at', statement_timestamp()
      )
  where id = p_match_id;

  -- Audit event
  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BANK_TRANSACTION_UNMATCHED', 'payments.reconciliation_match', p_match_id,
    jsonb_build_object(
      'match_id', p_match_id,
      'bank_transaction_id', v_match.bank_transaction_id,
      'reason', trim(p_reason)
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'match_id', p_match_id,
    'bank_transaction_id', v_match.bank_transaction_id,
    'status', 'unmatched',
    'unmatch_reason', trim(p_reason)
  );
end $$;

-- 3.8 Get Reconciliation Summary
create or replace function payments.get_reconciliation_summary(
  p_context_id uuid,
  p_bank_account_id uuid default null,
  p_from date default null,
  p_to date default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, payments, finance, platform, identity
as $$
declare
  v record;
  v_bank_account payments.bank_accounts;
  v_credits numeric(20,4) := 0;
  v_debits numeric(20,4) := 0;
  v_matched numeric(20,4) := 0;
  v_unmatched numeric(20,4) := 0;
  v_last_session payments.reconciliation_sessions;
  v_unmatched_count bigint := 0;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;

  -- Select bank account if provided or first active bank account
  if p_bank_account_id is not null then
    select * into v_bank_account from payments.bank_accounts where id = p_bank_account_id and tenant_id = v.tenant_id;
  else
    select * into v_bank_account from payments.bank_accounts where tenant_id = v.tenant_id and status = 'active' order by created_at limit 1;
  end if;

  if v_bank_account.id is not null then
    select
      coalesce(sum(amount) filter (where direction = 'credit'), 0),
      coalesce(sum(amount) filter (where direction = 'debit'), 0)
    into v_credits, v_debits
    from payments.bank_transactions
    where bank_account_id = v_bank_account.id and tenant_id = v.tenant_id
      and (p_from is null or booked_on >= p_from) and (p_to is null or booked_on <= p_to);

    select
      coalesce(sum(rm.matched_amount), 0)
    into v_matched
    from payments.reconciliation_matches rm
    join payments.bank_transactions bt on bt.id = rm.bank_transaction_id
    where bt.bank_account_id = v_bank_account.id and rm.tenant_id = v.tenant_id and rm.status = 'confirmed'
      and (p_from is null or bt.booked_on >= p_from) and (p_to is null or bt.booked_on <= p_to);

    v_unmatched := greatest(v_credits - v_matched, 0);

    select count(*) into v_unmatched_count
    from payments.bank_transactions bt
    where bt.bank_account_id = v_bank_account.id and bt.tenant_id = v.tenant_id
      and (p_from is null or bt.booked_on >= p_from) and (p_to is null or bt.booked_on <= p_to)
      and not exists (
        select 1 from payments.reconciliation_matches rm
        where rm.bank_transaction_id = bt.id and rm.status = 'confirmed'
      );

    select * into v_last_session
    from payments.reconciliation_sessions
    where bank_account_id = v_bank_account.id and tenant_id = v.tenant_id and status = 'reconciled'
    order by period_end desc, created_at desc limit 1;
  end if;

  return jsonb_build_object(
    'bank_account', case when v_bank_account.id is not null then jsonb_build_object(
      'id', v_bank_account.id,
      'bank_name', v_bank_account.bank_name,
      'currency', v_bank_account.currency,
      'status', v_bank_account.status
    ) else null end,
    'total_credits', v_credits,
    'total_debits', v_debits,
    'matched_amount', v_matched,
    'unmatched_amount', v_unmatched,
    'unmatched_transactions_count', v_unmatched_count,
    'reconciliation_difference', v_unmatched,
    'last_reconciliation_date', v_last_session.period_end,
    'last_reconciled_at', v_last_session.reconciled_at
  );
end $$;

-- 3.9 Finalize Bank Reconciliation
create or replace function payments.finalize_bank_reconciliation(
  p_context_id uuid,
  p_bank_account_id uuid,
  p_period_start date,
  p_period_end date,
  p_closing_balance numeric,
  p_notes text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, identity, platform, audit
as $$
declare
  v record;
  v_bank_account payments.bank_accounts;
  v_opening numeric(20,4) := 0;
  v_credits numeric(20,4) := 0;
  v_debits numeric(20,4) := 0;
  v_calculated_closing numeric(20,4);
  v_diff numeric(20,4);
  v_session_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.role_id, r.code as role_code into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'payment_permission_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.reconcile', 'payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select * into v_bank_account from payments.bank_accounts
  where id = p_bank_account_id and tenant_id = v.tenant_id;
  if not found then raise exception 'bank_account_not_found' using errcode = '22023'; end if;

  -- Previous closing balance is opening balance
  select closing_balance into v_opening from payments.reconciliation_sessions
  where bank_account_id = p_bank_account_id and tenant_id = v.tenant_id and status = 'reconciled'
  order by period_end desc, created_at desc limit 1;

  v_opening := coalesce(v_opening, 0);

  -- Sum credits and debits in period
  select
    coalesce(sum(amount) filter (where direction = 'credit'), 0),
    coalesce(sum(amount) filter (where direction = 'debit'), 0)
  into v_credits, v_debits
  from payments.bank_transactions
  where bank_account_id = p_bank_account_id and tenant_id = v.tenant_id
    and booked_on between p_period_start and p_period_end;

  v_calculated_closing := v_opening + v_credits - v_debits;
  v_diff := abs(p_closing_balance - v_calculated_closing);

  -- HARD STOP: Difference must be 0 for finalization
  if v_diff <> 0 then
    raise exception 'reconciliation_difference_must_be_zero' using errcode = '22023';
  end if;

  insert into payments.reconciliation_sessions (
    tenant_id, bank_account_id, statement_date, period_start, period_end,
    opening_balance, closing_balance, total_credits, total_debits, difference,
    status, reconciled_at, reconciled_by, notes
  ) values (
    v.tenant_id, p_bank_account_id, current_date, p_period_start, p_period_end,
    v_opening, p_closing_balance, v_credits, v_debits, 0,
    'reconciled', statement_timestamp(), auth.uid(), p_notes
  ) returning id into v_session_id;

  -- Audit event
  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BANK_STATEMENT_RECONCILED', 'payments.reconciliation_session', v_session_id,
    jsonb_build_object(
      'session_id', v_session_id,
      'bank_account_id', p_bank_account_id,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'closing_balance', p_closing_balance,
      'difference', 0
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'session_id', v_session_id,
    'bank_account_id', p_bank_account_id,
    'period_start', p_period_start,
    'period_end', p_period_end,
    'opening_balance', v_opening,
    'closing_balance', p_closing_balance,
    'difference', 0,
    'status', 'reconciled'
  );
end $$;

-- =============================================================================
-- 4. Update payments.get_customer_payments to integrate payment_allocations
-- =============================================================================

create or replace function payments.get_customer_payments(
  p_context_id uuid,
  p_view text default 'payments',
  p_query text default null,
  p_status text default null,
  p_from date default null,
  p_to date default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, payments, billing, finance, identity, platform, portfolio, occupancy
as $$
declare
  v record;
  v_workspace uuid;
  v_party uuid;
  v_resident boolean;
  v_tenant boolean;
  v_total bigint;
  v_rows jsonb;
  v_matches jsonb;
  v_summary jsonb;
  v_journal jsonb;
  v_allocations jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;

  if p_view not in ('payments', 'reconciliation') or p_limit < 1 or p_limit > 100 or p_offset < 0 then
    raise exception 'invalid_query' using errcode = '22023';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code, r.name as role_name, t.legal_name as tenant_name
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  join platform.tenants t on t.id = m.tenant_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then raise exception 'customer_context_access_denied' using errcode = '42501'; end if;
  if lower(v.role_code) not in ('association_admin', 'property_manager', 'president', 'censor', 'owner', 'tenant_resident') then
    raise exception 'payment_role_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code='payments.reconciliation.read'
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select w.id into v_workspace from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id and w.lifecycle_status = 'ACTIVE' order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace
      and e.entitlement_key='module.payments'
      and e.valid_from <= statement_timestamp()
      and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb
                else e.boolean_value is true end)
  ) then
    raise exception 'payment_entitlement_required' using errcode = '42501';
  end if;

  v_resident := lower(v.role_code) in ('owner', 'tenant_resident');
  v_tenant := lower(v.role_code) = 'tenant_resident';

  if v_resident then
    if v.scope_type <> 'unit' then raise exception 'resident_unit_context_required' using errcode = '42501'; end if;
    select mp.party_id into v_party from identity.membership_parties mp where mp.membership_id = v.membership_key and mp.tenant_id = v.tenant_id;
    if v_party is null then raise exception 'resident_party_mapping_required' using errcode = '42501'; end if;
    if not v_tenant and not exists (
      select 1 from portfolio.ownerships o
      where o.tenant_id = v.tenant_id and o.unit_id = v.unit_id and o.party_id=v_party
        and o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date)
    ) then raise exception 'ownership_required' using errcode = '42501'; end if;
    if v_tenant and not exists (
      select 1 from occupancy.leases l
      where l.tenant_id = v.tenant_id and l.unit_id = v.unit_id and l.tenant_party_id = v_party
        and l.status='active' and l.starts_on <= current_date and (l.ends_on is null or l.ends_on > current_date)
    ) then raise exception 'active_lease_required' using errcode = '42501'; end if;
  end if;

  -- Visible Payments with unified allocation total
  with visible as (
    select p.*, j.journal_no,
      greatest(
        coalesce((select sum(pa.amount) from payments.payment_allocations pa where pa.payment_id = p.id and pa.status = 'active'), 0),
        coalesce((select sum(rm.matched_amount) from payments.reconciliation_matches rm where rm.payment_id = p.id and rm.status = 'confirmed'), 0)
      ) as allocated_amount
    from payments.payments p
    left join finance.journals j on j.id = p.journal_id and j.tenant_id = p.tenant_id
    where p.tenant_id = v.tenant_id
      and (v.scope_type = 'tenant' or p.property_id = v.property_id or p.property_id = (select b.property_id from portfolio.buildings b where b.id = v.building_id and b.tenant_id = v.tenant_id) or (v.scope_type = 'unit' and p.unit_id = v.unit_id))
      and (not v_resident or (p.unit_id = v.unit_id and (not v_tenant or p.payer_party_id=v_party)))
  ),
  filtered as (
    select * from visible x
    where (p_id is null or id = p_id)
      and (p_status is null or status::text = p_status)
      and (p_from is null or paid_at::date >= p_from)
      and (p_to is null or paid_at::date <= p_to)
      and (p_query is null or length(trim(p_query)) = 0 or coalesce(provider_ref, '') ilike '%' || trim(p_query) || '%' or coalesce(journal_no::text, '') ilike '%' || trim(p_query) || '%')
  ),
  page as (
    select *, count(*) over() as total_count
    from filtered
    order by paid_at desc, id desc
    limit p_limit offset p_offset
  )
  select coalesce(max(total_count), 0),
         coalesce(jsonb_agg(jsonb_build_object(
           'id', id,
           'provider_ref', provider_ref,
           'amount', amount,
           'currency', currency,
           'paid_at', paid_at,
           'status', status,
           'method', method,
           'description', description,
           'allocated_amount', allocated_amount,
           'unallocated_amount', greatest(amount - allocated_amount, 0),
           'journal_id', journal_id,
           'journal_no', journal_no,
           'reversal_reason', reversal_reason,
           'reversed_at', reversed_at
         ) order by paid_at desc, id desc), '[]'::jsonb)
  into v_total, v_rows
  from page;

  -- Visible Reconciliations
  with visible as (
    select rm.*, bt.booked_on, bt.direction, bt.amount as transaction_amount, bt.currency,
      p.provider_ref, i.invoice_no, coalesce(p.unit_id, i.unit_id) as unit_id, coalesce(p.payer_party_id, i.liable_party_id) as party_id
    from payments.reconciliation_matches rm
    join payments.bank_transactions bt on bt.id = rm.bank_transaction_id and bt.tenant_id = rm.tenant_id
    left join payments.payments p on p.id = rm.payment_id and p.tenant_id = rm.tenant_id
    left join billing.receivables br on br.id = rm.receivable_id and br.tenant_id = rm.tenant_id
    left join billing.invoices i on i.id = br.invoice_id and i.tenant_id = rm.tenant_id
    join payments.bank_accounts ba on ba.id = bt.bank_account_id
    where rm.tenant_id = v.tenant_id
      and (v.scope_type = 'tenant' or ba.property_id = v.property_id
           or ba.property_id = (select b.property_id from portfolio.buildings b where b.id = v.building_id and b.tenant_id = v.tenant_id)
           or (v.scope_type = 'unit' and coalesce(p.unit_id, i.unit_id) = v.unit_id))
      and (not v_resident or (coalesce(p.unit_id, i.unit_id) = v.unit_id and (not v_tenant or coalesce(p.payer_party_id, i.liable_party_id) = v_party)))
  ),
  filtered as (
    select * from visible x
    where (p_id is null or id = p_id)
      and (p_status is null or status::text = p_status)
      and (p_from is null or booked_on >= p_from)
      and (p_to is null or booked_on <= p_to)
      and (p_query is null or length(trim(p_query)) = 0 or coalesce(provider_ref, '') ilike '%' || trim(p_query) || '%' or coalesce(invoice_no::text, '') ilike '%' || trim(p_query) || '%')
  ),
  page as (
    select *, count(*) over() as total_count
    from filtered
    order by booked_on desc, id desc
    limit p_limit offset p_offset
  )
  select case when p_view = 'reconciliation' then coalesce(max(total_count), 0) else v_total end,
         coalesce(jsonb_agg(jsonb_build_object(
           'id', id,
           'booked_on', booked_on,
           'direction', direction,
           'transaction_amount', transaction_amount,
           'currency', currency,
           'matched_amount', matched_amount,
           'confidence', confidence,
           'status', status,
           'provider_ref', provider_ref,
           'invoice_no', invoice_no
         ) order by booked_on desc, id desc), '[]'::jsonb)
  into v_total, v_matches
  from page;

  -- KPI Summary
  with pay_rows as (
    select p.*,
      greatest(
        coalesce((select sum(pa.amount) from payments.payment_allocations pa where pa.payment_id = p.id and pa.status = 'active'), 0),
        coalesce((select sum(rm.matched_amount) from payments.reconciliation_matches rm where rm.payment_id = p.id and rm.status = 'confirmed'), 0)
      ) as allocated
    from payments.payments p
    where p.tenant_id = v.tenant_id
      and (v.scope_type = 'tenant' or p.property_id = v.property_id or p.property_id = (select b.property_id from portfolio.buildings b where b.id = v.building_id) or (v.scope_type = 'unit' and p.unit_id = v.unit_id))
      and (not v_resident or (p.unit_id = v.unit_id and (not v_tenant or p.payer_party_id = v_party)))
  ),
  grouped as (
    select
      currency,
      coalesce(sum(amount) filter (where status = 'settled'), 0) as paid,
      coalesce(sum(allocated) filter (where status = 'settled'), 0) as reconciled,
      coalesce(sum(greatest(amount - allocated, 0)) filter (where status in ('pending', 'settled')), 0) as unallocated,
      count(*) filter (where allocated = 0 and status in ('pending', 'settled')) as unmatched_count,
      count(*) filter (where allocated > 0 and allocated < amount and status = 'settled') as partial_count,
      count(*) filter (where allocated >= amount and status = 'settled') as fully_allocated_count,
      count(*) filter (where status = 'refunded' or reversal_reason is not null) as reversed_count
    from pay_rows
    group by currency
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'currency', currency,
    'paid', paid,
    'reconciled', reconciled,
    'unallocated', unallocated,
    'unmatched_count', unmatched_count,
    'partial_count', partial_count,
    'fully_allocated_count', fully_allocated_count,
    'reversed_count', reversed_count
  ) order by currency), '[]'::jsonb)
  into v_summary
  from grouped;

  -- Detail view: journal and allocations
  if p_id is not null and p_view = 'payments' then
    select jsonb_build_object(
      'id', j.id,
      'journal_no', j.journal_no,
      'status', j.status,
      'occurred_on', j.occurred_on,
      'entries', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', e.id,
          'account_code', a.code,
          'account_name', a.name,
          'side', e.side,
          'amount', e.amount,
          'memo', e.memo
        ) order by e.created_at, e.id)
        from finance.journal_entries e
        join finance.accounts a on a.id = e.account_id
        where e.journal_id = j.id
      ), '[]'::jsonb)
    )
    into v_journal
    from payments.payments p
    join finance.journals j on j.id = p.journal_id and j.tenant_id = p.tenant_id
    where p.id = p_id and p.tenant_id = v.tenant_id;

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', pa.id,
      'receivable_id', pa.receivable_id,
      'invoice_id', r.invoice_id,
      'invoice_no', i.invoice_no,
      'amount', pa.amount,
      'status', pa.status,
      'created_at', pa.created_at,
      'reversal_reason', pa.reversal_reason
    ) order by pa.created_at desc), '[]'::jsonb)
    into v_allocations
    from payments.payment_allocations pa
    join billing.receivables r on r.id = pa.receivable_id
    join billing.invoices i on i.id = r.invoice_id
    where pa.payment_id = p_id and pa.tenant_id = v.tenant_id;
  end if;

  return jsonb_build_object(
    'context', jsonb_build_object('id', v.id, 'tenant_name', v.tenant_name, 'role_code', v.role_code, 'scope_type', v.scope_type),
    'view', p_view,
    'total', v_total,
    'payments', v_rows,
    'reconciliations', v_matches,
    'summary', v_summary,
    'journal', v_journal,
    'allocations', v_allocations,
    'limit', p_limit,
    'offset', p_offset,
    'read_only', lower(v.role_code) in ('president', 'censor', 'owner', 'tenant_resident'),
    'generated_at', statement_timestamp()
  );
end $$;

-- =============================================================================
-- 5. Customer API Gateway Wrappers in schema 'customer_api'
-- =============================================================================

-- 5.1 record_payment_v1
create or replace function customer_api.record_payment_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_amount numeric,
  p_currency text default 'RON',
  p_paid_at timestamptz default statement_timestamp(),
  p_unit_id uuid default null,
  p_payer_party_id uuid default null,
  p_method text default 'bank_transfer',
  p_provider_ref text default null,
  p_description text default null,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return payments.record_payment(
    p_context_id, p_property_id, p_amount, p_currency, p_paid_at,
    p_unit_id, p_payer_party_id, p_method, p_provider_ref, p_description, p_idempotency_key
  );
end $$;

-- 5.2 allocate_payment_v1
create or replace function customer_api.allocate_payment_v1(
  p_context_id uuid,
  p_payment_id uuid,
  p_allocations jsonb,
  p_idempotency_key text default null
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return payments.allocate_payment(
    p_context_id, p_payment_id, p_allocations, p_idempotency_key
  );
end $$;

-- 5.3 unallocate_payment_v1
create or replace function customer_api.unallocate_payment_v1(
  p_context_id uuid,
  p_allocation_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return payments.unallocate_payment(
    p_context_id, p_allocation_id, p_reason
  );
end $$;

-- 5.4 reverse_payment_v1
create or replace function customer_api.reverse_payment_v1(
  p_context_id uuid,
  p_payment_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return payments.reverse_payment(
    p_context_id, p_payment_id, p_reason
  );
end $$;

-- 5.5 list_bank_transactions_v1
create or replace function customer_api.list_bank_transactions_v1(
  p_context_id uuid,
  p_bank_account_id uuid default null,
  p_match_status text default null,
  p_from date default null,
  p_to date default null,
  p_limit integer default 25,
  p_offset integer default 0
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return payments.list_bank_transactions(
    p_context_id, p_bank_account_id, p_match_status, p_from, p_to, p_limit, p_offset
  );
end $$;

-- 5.6 match_bank_transaction_v1
create or replace function customer_api.match_bank_transaction_v1(
  p_context_id uuid,
  p_bank_transaction_id uuid,
  p_payment_id uuid default null,
  p_receivable_id uuid default null,
  p_matched_amount numeric default null,
  p_notes text default null
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return payments.match_bank_transaction(
    p_context_id, p_bank_transaction_id, p_payment_id, p_receivable_id, p_matched_amount, p_notes
  );
end $$;

-- 5.7 unmatch_bank_transaction_v1
create or replace function customer_api.unmatch_bank_transaction_v1(
  p_context_id uuid,
  p_match_id uuid,
  p_reason text
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return payments.unmatch_bank_transaction(
    p_context_id, p_match_id, p_reason
  );
end $$;

-- 5.8 get_reconciliation_summary_v1
create or replace function customer_api.get_reconciliation_summary_v1(
  p_context_id uuid,
  p_bank_account_id uuid default null,
  p_from date default null,
  p_to date default null
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return payments.get_reconciliation_summary(
    p_context_id, p_bank_account_id, p_from, p_to
  );
end $$;

-- 5.9 finalize_bank_reconciliation_v1
create or replace function customer_api.finalize_bank_reconciliation_v1(
  p_context_id uuid,
  p_bank_account_id uuid,
  p_period_start date,
  p_period_end date,
  p_closing_balance numeric,
  p_notes text default null
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return payments.finalize_bank_reconciliation(
    p_context_id, p_bank_account_id, p_period_start, p_period_end, p_closing_balance, p_notes
  );
end $$;

-- Revoke all customer_api wrappers from public and anon
revoke all on function customer_api.record_payment_v1 from public, anon;
revoke all on function customer_api.allocate_payment_v1 from public, anon;
revoke all on function customer_api.unallocate_payment_v1 from public, anon;
revoke all on function customer_api.reverse_payment_v1 from public, anon;
revoke all on function customer_api.list_bank_transactions_v1 from public, anon;
revoke all on function customer_api.match_bank_transaction_v1 from public, anon;
revoke all on function customer_api.unmatch_bank_transaction_v1 from public, anon;
revoke all on function customer_api.get_reconciliation_summary_v1 from public, anon;
revoke all on function customer_api.finalize_bank_reconciliation_v1 from public, anon;

-- Grant execution to authenticated and service_role
grant execute on function customer_api.record_payment_v1 to authenticated, service_role;
grant execute on function customer_api.allocate_payment_v1 to authenticated, service_role;
grant execute on function customer_api.unallocate_payment_v1 to authenticated, service_role;
grant execute on function customer_api.reverse_payment_v1 to authenticated, service_role;
grant execute on function customer_api.list_bank_transactions_v1 to authenticated, service_role;
grant execute on function customer_api.match_bank_transaction_v1 to authenticated, service_role;
grant execute on function customer_api.unmatch_bank_transaction_v1 to authenticated, service_role;
grant execute on function customer_api.get_reconciliation_summary_v1 to authenticated, service_role;
grant execute on function customer_api.finalize_bank_reconciliation_v1 to authenticated, service_role;

commit;
