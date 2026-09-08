-- Migration 70: Continuous GL/Subledger Parity & Payment Clearing Hardening
-- Scope: Two-stage payment clearing via account 419 (Customer Advances / Clearing),
--        continuous parity between 4111 and billing.receivables, atomic multi-bill allocation,
--        split reversal/refund, unallocation GL compensation, internal parity diagnostic function.

begin;

-- =============================================================================
-- 1. Schema Enhancements
-- =============================================================================

-- Add journal_id and reversal_journal_id to payments.payment_allocations
alter table payments.payment_allocations
  add column if not exists journal_id uuid references finance.journals(id) on delete restrict,
  add column if not exists reversal_journal_id uuid references finance.journals(id) on delete restrict;

create index if not exists payment_allocations_journal_id_idx
  on payments.payment_allocations (journal_id);

create index if not exists payment_allocations_reversal_journal_id_idx
  on payments.payment_allocations (reversal_journal_id);

-- Add clearing_account_id to payments.payments
alter table payments.payments
  add column if not exists clearing_account_id uuid references finance.accounts(id) on delete restrict;

create index if not exists payments_clearing_account_id_idx
  on payments.payments (clearing_account_id);

-- =============================================================================
-- 2. Standard Clearing Account Provisioning Routine
-- =============================================================================

create or replace function finance.provision_clearing_account(
  p_tenant_id uuid,
  p_property_id uuid default null,
  p_currency text default 'RON'
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, finance, platform, portfolio
as $$
declare
  v_id uuid;
  v_curr text;
begin
  v_curr := upper(trim(coalesce(p_currency, 'RON')));

  select id into v_id from finance.accounts
  where tenant_id = p_tenant_id and (property_id is null or property_id = p_property_id)
    and (code = '419' or code like '419%') and status = 'active'
  order by (case when property_id = p_property_id then 0 else 1 end), code limit 1;

  if v_id is not null then
    return v_id;
  end if;

  insert into finance.accounts (
    id, tenant_id, property_id, code, name, type, currency, status
  ) values (
    gen_random_uuid(), p_tenant_id, p_property_id, '419',
    'Clienți creditori / Avansuri de la locatari', 'liability'::finance.account_type,
    v_curr, 'active'::platform.record_status
  ) returning id into v_id;

  return v_id;
end $$;

-- =============================================================================
-- 3. Correct payments.record_payment
-- Stage 1: Dr. Bank (5121), Cr. Customer Advances / Clearing (419)
-- 4111 is NOT touched. Receivables are NOT touched.
-- =============================================================================

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
set search_path = pg_catalog, payments, finance, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_workspace uuid;
  v_bank_account_id uuid;
  v_clearing_account_id uuid;
  v_journal_id uuid;
  v_journal_no bigint;
  v_payment_id uuid;
  v_payment payments.payments;
  v_paid_at timestamptz;
  v_existing payments.payments;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
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

  if lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'payment_permission_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key='module.payments'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'payment_entitlement_required' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_payment_amount' using errcode = '22023';
  end if;

  if not exists (select 1 from portfolio.properties where id = p_property_id and tenant_id = v.tenant_id) then
    raise exception 'property_not_found_or_access_denied' using errcode = '42501';
  end if;

  if v.scope_type = 'property' and v.property_id <> p_property_id then
    raise exception 'property_context_scope_denied' using errcode = '42501';
  end if;

  if p_unit_id is not null and not exists (
    select 1 from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_unit_id and u.tenant_id = v.tenant_id and b.property_id = p_property_id
  ) then
    raise exception 'unit_not_found_or_property_mismatch' using errcode = '22023';
  end if;

  if v.scope_type = 'unit' and v.unit_id <> p_unit_id then
    raise exception 'unit_context_scope_denied' using errcode = '42501';
  end if;

  if p_payer_party_id is not null and not exists (
    select 1 from portfolio.parties where id = p_payer_party_id and tenant_id = v.tenant_id
  ) then
    raise exception 'payer_party_not_found' using errcode = '22023';
  end if;

  v_paid_at := coalesce(p_paid_at, statement_timestamp());

  -- Period guard: payment receipt date must not fall in a closed period
  perform finance.assert_scope_date_not_in_closed_period(v.tenant_id, p_property_id, v_paid_at::date);

  -- Idempotency replay check
  if p_idempotency_key is not null then
    select * into v_payment from payments.payments
    where tenant_id = v.tenant_id and idempotency_key = trim(p_idempotency_key);
    if found then
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
          'clearing_account_id', v_payment.clearing_account_id,
          'allocated_amount', coalesce((select sum(pa.amount) from payments.payment_allocations pa where pa.payment_id = v_payment.id and pa.status = 'active'), 0),
          'unallocated_amount', greatest(v_payment.amount - coalesce((select sum(pa.amount) from payments.payment_allocations pa where pa.payment_id = v_payment.id and pa.status = 'active'), 0), 0)
        )
      );
    end if;
  end if;

  -- Select Bank account (5121)
  select id into v_bank_account_id from finance.accounts
  where tenant_id = v.tenant_id and (property_id is null or property_id = p_property_id)
    and (code = '5121' or code like '512%' or code like '531%') and status = 'active'
  order by (case when property_id = p_property_id then 0 else 1 end), code limit 1;

  if v_bank_account_id is null then
    raise exception 'bank_gl_account_not_found' using errcode = '22023';
  end if;

  -- Select Clearing account (419 preferred, fallback to 473)
  select id into v_clearing_account_id from finance.accounts
  where tenant_id = v.tenant_id and (property_id is null or property_id = p_property_id)
    and (code = '419' or code like '419%' or code = '473' or code like '473%') and status = 'active'
  order by (case when code = '419' or code like '419%' then 0 else 1 end),
           (case when property_id = p_property_id then 0 else 1 end), code limit 1;

  if v_clearing_account_id is null then
    raise exception 'clearing_gl_account_not_found' using errcode = '22023';
  end if;

  v_payment_id := gen_random_uuid();

  -- Create Draft Journal: Debit Bank (5121), Credit Clearing/Advances (419)
  insert into finance.journals (
    tenant_id, property_id, occurred_on, currency, description, source_type, source_id, status
  ) values (
    v.tenant_id, p_property_id, v_paid_at::date, p_currency,
    'Payment received: ' || coalesce(p_provider_ref, p_description, 'Receipt'),
    'payments.payment', v_payment_id, 'draft'
  ) returning id, journal_no into v_journal_id, v_journal_no;

  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    v.tenant_id, v_journal_id, v_bank_account_id, p_unit_id, p_payer_party_id,
    'debit', p_amount, 'Payment receipt to bank'
  );

  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    v.tenant_id, v_journal_id, v_clearing_account_id, p_unit_id, p_payer_party_id,
    'credit', p_amount, 'Unallocated payment clearing / advance'
  );

  -- Post Journal (triggers enforce double-entry balance and open period)
  update finance.journals
  set status = 'posted',
      posted_at = statement_timestamp(),
      posted_by = auth.uid()
  where id = v_journal_id;

  -- Insert Payment record
  insert into payments.payments (
    id, tenant_id, property_id, unit_id, payer_party_id, amount, currency,
    paid_at, status, journal_id, method, provider_ref, description, idempotency_key, clearing_account_id
  ) values (
    v_payment_id, v.tenant_id, p_property_id, p_unit_id, p_payer_party_id, p_amount, p_currency,
    v_paid_at, 'settled', v_journal_id, p_method, p_provider_ref, p_description, trim(p_idempotency_key), v_clearing_account_id
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
      'journal_no', v_journal_no,
      'clearing_account_id', v_clearing_account_id
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
      'clearing_account_id', v_clearing_account_id,
      'allocated_amount', 0,
      'unallocated_amount', v_payment.amount
    )
  );
end $$;

-- =============================================================================
-- 4. Correct payments.allocate_payment
-- Stage 2: Dr. Customer Advances / Clearing (419), Cr. Accounts Receivable (4111)
-- Receivables Subledger and GL 4111 decrease simultaneously by the exact allocated amount.
-- =============================================================================

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
  v_clearing_account_id uuid;
  v_ar_account_id uuid;
  v_allocation_journal_id uuid;
  v_allocation_journal_no bigint;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  if p_allocations is null or jsonb_array_length(p_allocations) = 0 then
    raise exception 'allocations_array_required' using errcode = '22023';
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

  -- Lock payment row
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

  -- Verify current date is not in a closed period
  perform finance.assert_scope_date_not_in_closed_period(v.tenant_id, v_payment.property_id, current_date);

  -- Select Clearing account (419)
  if v_payment.clearing_account_id is not null then
    v_clearing_account_id := v_payment.clearing_account_id;
  else
    select id into v_clearing_account_id from finance.accounts
    where tenant_id = v.tenant_id and (property_id is null or property_id = v_payment.property_id)
      and (code = '419' or code like '419%' or code = '473' or code like '473%') and status = 'active'
    order by (case when code = '419' or code like '419%' then 0 else 1 end),
             (case when property_id = v_payment.property_id then 0 else 1 end), code limit 1;
  end if;

  if v_clearing_account_id is null then
    raise exception 'clearing_gl_account_not_found' using errcode = '22023';
  end if;

  -- Select AR account (4111)
  select id into v_ar_account_id from finance.accounts
  where tenant_id = v.tenant_id and (property_id is null or property_id = v_payment.property_id)
    and (code = '4111' or code like '411%') and status = 'active'
  order by (case when property_id = v_payment.property_id then 0 else 1 end), code limit 1;

  if v_ar_account_id is null then
    raise exception 'ar_gl_account_not_found' using errcode = '22023';
  end if;

  -- Pre-validate each allocation item before creating draft journal
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

    if v_payment.unit_id is not null and v_invoice.unit_id <> v_payment.unit_id then
      raise exception 'cross_unit_allocation_forbidden' using errcode = '22023';
    end if;

    if v_alloc_amount > v_receivable.outstanding_amount then
      raise exception 'receivable_overallocated' using errcode = '22023';
    end if;
  end loop;

  -- Create Allocation Journal: Debit Clearing (419) for total allocating amount
  v_allocation_journal_id := gen_random_uuid();

  insert into finance.journals (
    id, tenant_id, property_id, occurred_on, currency, description, source_type, source_id, status
  ) values (
    v_allocation_journal_id, v.tenant_id, v_payment.property_id, current_date, v_payment.currency,
    'Payment allocation: Payment ' || v_payment.id::text,
    'payments.payment_allocation', v_allocation_journal_id, 'draft'
  ) returning journal_no into v_allocation_journal_no;

  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    v.tenant_id, v_allocation_journal_id, v_clearing_account_id, v_payment.unit_id, v_payment.payer_party_id,
    'debit', v_total_allocating, 'Clearing advance balance for bill allocation'
  );

  -- Process each allocation item
  for v_alloc_item in select * from jsonb_array_elements(p_allocations) loop
    v_rec_id := (v_alloc_item->>'receivable_id')::uuid;
    v_alloc_amount := (v_alloc_item->>'amount')::numeric(20,4);

    select * into v_receivable from billing.receivables
    where id = v_rec_id and tenant_id = v.tenant_id for update;

    select * into v_invoice from billing.invoices
    where id = v_receivable.invoice_id and tenant_id = v.tenant_id;

    -- Credit AR for this specific receivable
    insert into finance.journal_entries (
      tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
    ) values (
      v.tenant_id, v_allocation_journal_id, v_ar_account_id, v_invoice.unit_id, v_invoice.liable_party_id,
      'credit', v_alloc_amount, 'Invoice #' || v_invoice.invoice_no || ' receivable cleared'
    );

    -- Insert allocation record linked to journal
    insert into payments.payment_allocations (
      tenant_id, payment_id, receivable_id, amount, status, created_by, idempotency_key, journal_id
    ) values (
      v.tenant_id, p_payment_id, v_rec_id, v_alloc_amount, 'active', auth.uid(),
      case when p_idempotency_key is not null then p_idempotency_key || ':' || v_rec_id::text else null end,
      v_allocation_journal_id
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
        'new_invoice_status', v_new_status,
        'journal_id', v_allocation_journal_id
      ),
      statement_timestamp()
    );

    v_result_allocations := v_result_allocations || jsonb_build_object(
      'id', v_alloc_id,
      'receivable_id', v_rec_id,
      'invoice_id', v_receivable.invoice_id,
      'invoice_no', v_invoice.invoice_no,
      'amount', v_alloc_amount,
      'status', 'active',
      'journal_id', v_allocation_journal_id
    );
  end loop;

  -- Post allocation journal (enforces double-entry equality: Dr 419 = sum(Cr 4111))
  update finance.journals
  set status = 'posted',
      posted_at = statement_timestamp(),
      posted_by = auth.uid()
  where id = v_allocation_journal_id;

  return jsonb_build_object(
    'payment_id', p_payment_id,
    'total_allocated', v_allocated_so_far + v_total_allocating,
    'unallocated_balance', greatest(v_payment.amount - (v_allocated_so_far + v_total_allocating), 0),
    'allocations', v_result_allocations,
    'allocation_journal_id', v_allocation_journal_id,
    'allocation_journal_no', v_allocation_journal_no
  );
end $$;

-- =============================================================================
-- 5. Correct payments.unallocate_payment
-- Reverses allocation: Dr. Accounts Receivable (4111), Cr. Clearing (419)
-- Restores bill outstanding and maintains continuous parity.
-- =============================================================================

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
  v_payment payments.payments;
  v_receivable billing.receivables;
  v_new_paid numeric(20,4);
  v_new_status billing.invoice_status;
  v_clearing_account_id uuid;
  v_ar_account_id uuid;
  v_reversal_journal_id uuid;
  v_reversal_journal_no bigint;
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
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'payment_permission_denied' using errcode = '42501';
  end if;

  select * into v_alloc from payments.payment_allocations
  where id = p_allocation_id and tenant_id = v.tenant_id for update;

  if not found then raise exception 'allocation_not_found' using errcode = '22023'; end if;
  if v_alloc.status <> 'active' then raise exception 'allocation_already_reversed' using errcode = '22023'; end if;

  select * into v_payment from payments.payments
  where id = v_alloc.payment_id and tenant_id = v.tenant_id;

  -- Prohibit unallocation if payment is locked in a reconciled session
  if exists (
    select 1 from payments.reconciliation_matches rm
    join payments.bank_transactions bt on bt.id = rm.bank_transaction_id
    join payments.reconciliation_sessions rs on rs.bank_account_id = bt.bank_account_id and rs.status = 'reconciled'
    where rm.payment_id = v_alloc.payment_id and rm.status = 'confirmed'
      and bt.booked_on between rs.period_start and rs.period_end
  ) then
    raise exception 'reconciled_payment_unallocation_forbidden' using errcode = '42501';
  end if;

  -- Verify current date is not in a closed period
  perform finance.assert_scope_date_not_in_closed_period(v.tenant_id, v_payment.property_id, current_date);

  -- Select accounts
  if v_payment.clearing_account_id is not null then
    v_clearing_account_id := v_payment.clearing_account_id;
  else
    select id into v_clearing_account_id from finance.accounts
    where tenant_id = v.tenant_id and (property_id is null or property_id = v_payment.property_id)
      and (code = '419' or code like '419%' or code = '473' or code like '473%') and status = 'active'
    order by (case when code = '419' or code like '419%' then 0 else 1 end),
             (case when property_id = v_payment.property_id then 0 else 1 end), code limit 1;
  end if;

  select id into v_ar_account_id from finance.accounts
  where tenant_id = v.tenant_id and (property_id is null or property_id = v_payment.property_id)
    and (code = '4111' or code like '411%') and status = 'active'
  order by (case when property_id = v_payment.property_id then 0 else 1 end), code limit 1;

  -- Post Compensating Journal: Dr. AR (4111), Cr. Clearing (419)
  insert into finance.journals (
    tenant_id, property_id, occurred_on, currency, description, source_type, source_id, status
  ) values (
    v.tenant_id, v_payment.property_id, current_date, v_payment.currency,
    'Unallocation reversal: ' || trim(p_reason),
    'payments.allocation_reversal', p_allocation_id, 'draft'
  ) returning id, journal_no into v_reversal_journal_id, v_reversal_journal_no;

  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    v.tenant_id, v_reversal_journal_id, v_ar_account_id, v_payment.unit_id, v_payment.payer_party_id,
    'debit', v_alloc.amount, 'Reversal restoring accounts receivable'
  );

  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    v.tenant_id, v_reversal_journal_id, v_clearing_account_id, v_payment.unit_id, v_payment.payer_party_id,
    'credit', v_alloc.amount, 'Reversal restoring clearing advance balance'
  );

  update finance.journals
  set status = 'posted',
      posted_at = statement_timestamp(),
      posted_by = auth.uid()
  where id = v_reversal_journal_id;

  -- Mark allocation reversed
  update payments.payment_allocations
  set status = 'reversed',
      reversed_at = statement_timestamp(),
      reversed_by = auth.uid(),
      reversal_reason = trim(p_reason),
      reversal_journal_id = v_reversal_journal_id
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
      'reversal_journal_id', v_reversal_journal_id
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'allocation_id', p_allocation_id,
    'payment_id', v_alloc.payment_id,
    'status', 'reversed',
    'reversal_reason', trim(p_reason),
    'reversal_journal_id', v_reversal_journal_id,
    'reversal_journal_no', v_reversal_journal_no
  );
end $$;

-- =============================================================================
-- 6. Correct payments.reverse_payment
-- Split treatment:
-- - Allocated portion: Dr. 4111 (restoring AR)
-- - Unallocated portion: Dr. 419 (clearing remaining advance)
-- - Total Credit: Cr. 5121 (Bank outflow for total payment amount)
-- =============================================================================

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
  v_alloc record;
  v_receivable billing.receivables;
  v_new_paid numeric(20,4);
  v_new_status billing.invoice_status;
  v_bank_account_id uuid;
  v_ar_account_id uuid;
  v_clearing_account_id uuid;
  v_reversal_journal_id uuid;
  v_reversal_journal_no bigint;
  v_allocated_sum numeric(20,4) := 0;
  v_unallocated_sum numeric(20,4) := 0;
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
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

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
  if v_payment.status = 'refunded' or v_payment.reversed_at is not null then
    raise exception 'payment_already_reversed' using errcode = '22023';
  end if;

  -- Period validation
  perform finance.assert_scope_date_not_in_closed_period(v.tenant_id, v_payment.property_id, current_date);

  -- Select Bank account
  select id into v_bank_account_id from finance.accounts
  where tenant_id = v.tenant_id and (property_id is null or property_id = v_payment.property_id)
    and (code = '5121' or code like '512%' or code like '531%') and status = 'active'
  order by (case when property_id = v_payment.property_id then 0 else 1 end), code limit 1;

  if v_bank_account_id is null then raise exception 'bank_gl_account_not_found' using errcode = '22023'; end if;

  -- Select AR account
  select id into v_ar_account_id from finance.accounts
  where tenant_id = v.tenant_id and (property_id is null or property_id = v_payment.property_id)
    and (code = '4111' or code like '411%') and status = 'active'
  order by (case when property_id = v_payment.property_id then 0 else 1 end), code limit 1;

  -- Select Clearing account
  if v_payment.clearing_account_id is not null then
    v_clearing_account_id := v_payment.clearing_account_id;
  else
    select id into v_clearing_account_id from finance.accounts
    where tenant_id = v.tenant_id and (property_id is null or property_id = v_payment.property_id)
      and (code = '419' or code like '419%' or code = '473' or code like '473%') and status = 'active'
    order by (case when code = '419' or code like '419%' then 0 else 1 end),
             (case when property_id = v_payment.property_id then 0 else 1 end), code limit 1;
  end if;

  -- Calculate active allocations sum
  select coalesce(sum(amount), 0) into v_allocated_sum
  from payments.payment_allocations
  where payment_id = p_payment_id and status = 'active';

  v_unallocated_sum := greatest(v_payment.amount - v_allocated_sum, 0);

  -- Reverse active allocations on receivables
  for v_alloc in
    select * from payments.payment_allocations
    where payment_id = p_payment_id and status = 'active'
    for update
  loop
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

  -- Create Reversal Journal
  insert into finance.journals (
    tenant_id, property_id, occurred_on, currency, description, source_type, source_id, status
  ) values (
    v.tenant_id, v_payment.property_id, current_date, v_payment.currency,
    'Payment reversal: ' || trim(p_reason),
    'payments.payment_reversal', p_payment_id, 'draft'
  ) returning id, journal_no into v_reversal_journal_id, v_reversal_journal_no;

  -- Credit Bank for full payment amount
  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    v.tenant_id, v_reversal_journal_id, v_bank_account_id, v_payment.unit_id, v_payment.payer_party_id,
    'credit', v_payment.amount, 'Reversal deducting bank balance'
  );

  -- Debit AR for allocated portion (if any)
  if v_allocated_sum > 0 then
    if v_ar_account_id is null then raise exception 'ar_gl_account_not_found' using errcode = '22023'; end if;
    insert into finance.journal_entries (
      tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
    ) values (
      v.tenant_id, v_reversal_journal_id, v_ar_account_id, v_payment.unit_id, v_payment.payer_party_id,
      'debit', v_allocated_sum, 'Reversal restoring accounts receivable'
    );
  end if;

  -- Debit Clearing for unallocated portion (if any)
  if v_unallocated_sum > 0 then
    if v_clearing_account_id is null then raise exception 'clearing_gl_account_not_found' using errcode = '22023'; end if;
    insert into finance.journal_entries (
      tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
    ) values (
      v.tenant_id, v_reversal_journal_id, v_clearing_account_id, v_payment.unit_id, v_payment.payer_party_id,
      'debit', v_unallocated_sum, 'Reversal clearing unallocated advance'
    );
  end if;

  -- Post Reversal Journal
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
      'allocated_reversed', v_allocated_sum,
      'unallocated_reversed', v_unallocated_sum,
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
    'reversal_journal_no', v_reversal_journal_no,
    'allocated_reversed', v_allocated_sum,
    'unallocated_reversed', v_unallocated_sum
  );
end $$;

-- =============================================================================
-- 7. Continuous Parity Diagnostic Function
-- Internal diagnostic routine checking:
-- GL 4111 balance == active billing.receivables.outstanding_amount
-- GL 419 balance == sum(unallocated payment balances)
-- =============================================================================

create or replace function finance.get_ar_subledger_parity(
  p_tenant_id uuid,
  p_property_id uuid default null,
  p_currency text default 'RON'
) returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, finance, billing, payments, portfolio
as $$
declare
  v_currency text;
  v_gl_4111 numeric(20,4) := 0;
  v_subledger_outstanding numeric(20,4) := 0;
  v_ar_delta numeric(20,4) := 0;
  v_gl_419 numeric(20,4) := 0;
  v_unallocated_payments numeric(20,4) := 0;
  v_clearing_delta numeric(20,4) := 0;
begin
  v_currency := upper(trim(coalesce(p_currency, 'RON')));

  -- 1. GL 4111 net balance (Asset: Debit - Credit)
  select coalesce(sum(case when e.side = 'debit' then e.amount else -e.amount end), 0)
  into v_gl_4111
  from finance.journal_entries e
  join finance.journals j on j.id = e.journal_id
  join finance.accounts a on a.id = e.account_id
  where j.tenant_id = p_tenant_id
    and (p_property_id is null or j.property_id = p_property_id)
    and j.currency = v_currency
    and j.status = 'posted'
    and (a.code = '4111' or a.code like '411%');

  -- 2. Subledger outstanding from billing.receivables
  select coalesce(sum(r.outstanding_amount), 0)
  into v_subledger_outstanding
  from billing.receivables r
  join billing.invoices i on i.id = r.invoice_id
  where r.tenant_id = p_tenant_id
    and (p_property_id is null or i.property_id = p_property_id)
    and i.currency = v_currency
    and i.status in ('issued', 'partially_paid');

  v_ar_delta := v_gl_4111 - v_subledger_outstanding;

  -- 3. GL 419 net balance (Liability: Credit - Debit)
  select coalesce(sum(case when e.side = 'credit' then e.amount else -e.amount end), 0)
  into v_gl_419
  from finance.journal_entries e
  join finance.journals j on j.id = e.journal_id
  join finance.accounts a on a.id = e.account_id
  where j.tenant_id = p_tenant_id
    and (p_property_id is null or j.property_id = p_property_id)
    and j.currency = v_currency
    and j.status = 'posted'
    and (a.code = '419' or a.code like '419%');

  -- 4. Unallocated known-payer payments
  with payment_totals as (
    select
      p.id,
      p.amount,
      coalesce((select sum(pa.amount) from payments.payment_allocations pa where pa.payment_id = p.id and pa.status = 'active'), 0) as allocated
    from payments.payments p
    where p.tenant_id = p_tenant_id
      and (p_property_id is null or p.property_id = p_property_id)
      and p.currency = v_currency
      and p.status = 'settled'
  )
  select coalesce(sum(greatest(amount - allocated, 0)), 0)
  into v_unallocated_payments
  from payment_totals;

  v_clearing_delta := v_gl_419 - v_unallocated_payments;

  return jsonb_build_object(
    'tenant_id', p_tenant_id,
    'property_id', p_property_id,
    'currency', v_currency,
    'gl_4111_balance', v_gl_4111,
    'receivables_outstanding', v_subledger_outstanding,
    'ar_delta', v_ar_delta,
    'gl_419_balance', v_gl_419,
    'unallocated_payments_balance', v_unallocated_payments,
    'clearing_delta', v_clearing_delta,
    'is_ar_parity', (v_ar_delta = 0),
    'is_clearing_parity', (v_clearing_delta = 0),
    'is_continuous_parity', (v_ar_delta = 0 and v_clearing_delta = 0)
  );
end $$;

-- =============================================================================
-- 8. Customer API Gateway Wrappers
-- =============================================================================

create or replace function customer_api.get_parity_diagnostic_v1(
  p_context_id uuid,
  p_property_id uuid default null,
  p_currency text default 'RON'
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v record;
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

  if not found or lower(v.role_code) not in ('association_admin', 'property_manager', 'president', 'censor') then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  return finance.get_ar_subledger_parity(v.tenant_id, coalesce(p_property_id, v.property_id), p_currency);
end $$;

-- =============================================================================
-- 9. Privileges and Access Control
-- =============================================================================

revoke all on function finance.provision_clearing_account(uuid, uuid, text) from public;
revoke all on function finance.provision_clearing_account(uuid, uuid, text) from anon;
grant execute on function finance.provision_clearing_account(uuid, uuid, text) to authenticated;

revoke all on function finance.get_ar_subledger_parity(uuid, uuid, text) from public;
revoke all on function finance.get_ar_subledger_parity(uuid, uuid, text) from anon;
grant execute on function finance.get_ar_subledger_parity(uuid, uuid, text) to authenticated;

revoke all on function customer_api.get_parity_diagnostic_v1(uuid, uuid, text) from public;
revoke all on function customer_api.get_parity_diagnostic_v1(uuid, uuid, text) from anon;
grant execute on function customer_api.get_parity_diagnostic_v1(uuid, uuid, text) to authenticated;

commit;
