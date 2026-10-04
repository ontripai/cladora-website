begin;

create or replace function maintenance.create_maintenance_payable(
  p_context_id uuid,
  p_work_order_id uuid,
  p_purchase_order_id uuid default null,
  p_invoice_ref text default null,
  p_invoice_date date default null,
  p_due_date date default null,
  p_subtotal numeric default null,
  p_tax_amount numeric default 0,
  p_currency text default 'RON',
  p_expense_account_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, portfolio, finance, audit
as $$
declare
  v record;
  w record;
  po record;
  v_vendor_id uuid;
  v_payable_id uuid;
  v_payable_no bigint;
  v_total numeric(20,4);
  v_ap_account_id uuid;
  v_exp_account_id uuid;
  v_tax_account_id uuid;
  v_journal_id uuid;
  v_journal_no bigint;
  v_existing record;
  v_tax_rate numeric(8,4);
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'finance.payables.create', false);
  -- Preserve specific financial permission and additionally require scoped installed-module procurement authority.
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.procurement.manage');

  -- Idempotency check: if key matches, return existing record safely
  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    select vp.id, vp.work_order_id, vp.payable_no, vp.status, vp.journal_id, vp.total_amount
    into v_existing
    from maintenance.vendor_payables vp
    where vp.tenant_id = v.tenant_id and vp.idempotency_key = p_idempotency_key;

    if found then
      perform maintenance.assert_work_order_authority_v1(p_context_id,v_existing.work_order_id,'maintenance.procurement.manage');
      if v_existing.work_order_id is distinct from p_work_order_id then
        raise exception 'payable_idempotency_work_order_mismatch' using errcode='22023';
      end if;
      return jsonb_build_object(
        'id', v_existing.id,
        'payable_no', v_existing.payable_no,
        'status', v_existing.status,
        'journal_id', v_existing.journal_id,
        'total_amount', v_existing.total_amount,
        'idempotent_replay', true
      );
    end if;
  end if;

  if trim(coalesce(p_invoice_ref, '')) = '' then
    raise exception 'invoice_ref_required' using errcode = '22023';
  end if;
  if p_invoice_date is null then
    raise exception 'invoice_date_required' using errcode = '22023';
  end if;

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;
  -- Recheck after acquiring the resource lock, before financial writes.
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.procurement.manage');

  -- 1. Work order MUST be verified before payable creation
  if w.status <> 'verified' then
    raise exception 'work_order_must_be_verified_for_payable' using errcode = '22023';
  end if;

  -- 2. Prevent duplicate payable for same work order
  if exists (select 1 from maintenance.vendor_payables where tenant_id = v.tenant_id and work_order_id = p_work_order_id) then
    raise exception 'payable_already_exists_for_work_order' using errcode = '22023';
  end if;

  v_vendor_id := w.vendor_id;

  -- 3. Purchase Order verification if linked
  if p_purchase_order_id is not null then
    select * into po from maintenance.purchase_orders
    where id = p_purchase_order_id and tenant_id = v.tenant_id and work_order_id = p_work_order_id for update;
    if not found then raise exception 'purchase_order_not_found_for_work_order' using errcode = 'P0002'; end if;
    if po.status not in ('approved', 'ordered', 'received') then
      raise exception 'purchase_order_must_be_approved_or_ordered' using errcode = '22023';
    end if;
    v_vendor_id := coalesce(v_vendor_id, po.vendor_id);
    if p_subtotal is null then p_subtotal := po.subtotal; end if;
    if p_tax_amount is null or p_tax_amount = 0 then p_tax_amount := po.tax_total; end if;
  end if;

  if v_vendor_id is null then
    raise exception 'vendor_not_specified_for_payable' using errcode = '22023';
  end if;

  -- 4. Check duplicate invoice reference for this vendor
  if exists (
    select 1 from maintenance.vendor_payables
    where tenant_id = v.tenant_id and vendor_id = v_vendor_id and invoice_ref = p_invoice_ref
  ) then
    raise exception 'duplicate_vendor_invoice_reference' using errcode = '22023';
  end if;

  if p_subtotal is null or p_subtotal <= 0 then
    raise exception 'subtotal_must_be_positive' using errcode = '22023';
  end if;
  if p_tax_amount < 0 then
    raise exception 'tax_amount_must_be_non_negative' using errcode = '22023';
  end if;

  v_total := round((p_subtotal + p_tax_amount)::numeric, 4);
  v_tax_rate := case when p_subtotal > 0 then round((p_tax_amount / p_subtotal)::numeric, 4) else 0 end;

  -- 5. Closed period assertion (hard stop if period is closed, e.g. August 2026)
  perform finance.assert_scope_date_not_in_closed_period(v.tenant_id, w.property_id, p_invoice_date);

  -- 6. Resolve Accounts:
  -- A. Accounts Payable Credit Account (401)
  select id into v_ap_account_id
  from finance.accounts
  where tenant_id = v.tenant_id and type = 'liability' and status = 'active'
    and (property_id is null or property_id = w.property_id)
    and (code = '401' or code like '40%')
  order by case when property_id = w.property_id then 0 else 1 end,
           case when code = '401' then 0 else 1 end, code
  limit 1;

  if v_ap_account_id is null then
    raise exception 'accounts_payable_account_not_found' using errcode = 'P0002';
  end if;

  -- B. Expense Debit Account (611 / specified expense / asset)
  if p_expense_account_id is not null then
    select id into v_exp_account_id
    from finance.accounts
    where id = p_expense_account_id and tenant_id = v.tenant_id and status = 'active'
      and (property_id is null or property_id = w.property_id)
      and type in ('expense', 'asset');
    if not found then raise exception 'specified_expense_account_invalid' using errcode = '22023'; end if;
  else
    select id into v_exp_account_id
    from finance.accounts
    where tenant_id = v.tenant_id and type = 'expense' and status = 'active'
      and (property_id is null or property_id = w.property_id)
      and (code = '611' or code = '605' or code like '6%')
    order by case when property_id = w.property_id then 0 else 1 end,
             case when code = '611' then 0 when code = '605' then 1 else 2 end, code
    limit 1;
  end if;

  if v_exp_account_id is null then
    raise exception 'expense_account_not_found' using errcode = 'P0002';
  end if;

  -- C. Tax Account (4426 - Recoverable VAT)
  if p_tax_amount > 0 then
    select id into v_tax_account_id
    from finance.accounts
    where tenant_id = v.tenant_id and status = 'active' and code = '4426'
      and (property_id is null or property_id = w.property_id)
    order by case when property_id = w.property_id then 0 else 1 end limit 1;

    if v_tax_account_id is null then
      raise exception 'tax_account_4426_missing_for_tenant' using errcode = 'P0002';
    end if;
  end if;

  -- 7. Create Draft Journal in finance.journals
  insert into finance.journals (
    tenant_id, property_id, occurred_on, currency, description,
    source_type, source_id, status
  ) values (
    v.tenant_id, w.property_id, p_invoice_date, p_currency,
    'Maintenance Payable: ' || p_invoice_ref || ' (WO #' || w.work_order_no || ')',
    'maintenance.payable', p_work_order_id, 'draft'
  ) returning id, journal_no into v_journal_id, v_journal_no;

  -- 8. Insert Balanced Journal Entries
  -- Debit Expense (subtotal)
  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    v.tenant_id, v_journal_id, v_exp_account_id, w.unit_id, null,
    'debit', p_subtotal, 'WO #' || w.work_order_no || ' maintenance expense'
  );

  -- Debit 4426 Recoverable VAT (if tax > 0)
  if p_tax_amount > 0 and v_tax_account_id is not null then
    insert into finance.journal_entries (
      tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
    ) values (
      v.tenant_id, v_journal_id, v_tax_account_id, w.unit_id, null,
      'debit', p_tax_amount, 'WO #' || w.work_order_no || ' input VAT'
    );
  end if;

  -- Credit Accounts Payable (401) for total
  insert into finance.journal_entries (
    tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
  ) values (
    v.tenant_id, v_journal_id, v_ap_account_id, w.unit_id, null,
    'credit', v_total, 'WO #' || w.work_order_no || ' payable (' || p_invoice_ref || ')'
  );

  -- 9. Post Journal (Finance triggers automatically verify balanced double-entry)
  update finance.journals
  set status = 'posted',
      posted_at = statement_timestamp(),
      posted_by = v.user_id
  where id = v_journal_id;

  -- 10. Insert into Canonical maintenance.vendor_payables
  insert into maintenance.vendor_payables (
    tenant_id, work_order_id, purchase_order_id, vendor_id,
    invoice_ref, invoice_date, due_date, subtotal, tax_amount, total_amount,
    currency, tax_rate, status, journal_id, idempotency_key, created_by,
    posted_at, snapshot_json
  ) values (
    v.tenant_id, p_work_order_id, p_purchase_order_id, v_vendor_id,
    p_invoice_ref, p_invoice_date, p_due_date, p_subtotal, p_tax_amount, v_total,
    p_currency, v_tax_rate, 'posted', v_journal_id, p_idempotency_key, v.user_id,
    statement_timestamp(),
    jsonb_build_object(
      'work_order_no', w.work_order_no,
      'invoice_ref', p_invoice_ref,
      'invoice_date', p_invoice_date,
      'subtotal', p_subtotal,
      'tax_amount', p_tax_amount,
      'total_amount', v_total,
      'journal_no', v_journal_no
    )
  ) returning id, payable_no into v_payable_id, v_payable_no;

  -- 11. Synchronously update existing schema columns in purchase_orders & work_order_costs
  if p_purchase_order_id is not null then
    update maintenance.purchase_orders
    set ledger_journal_id = v_journal_id,
        received_at = coalesce(received_at, statement_timestamp()),
        status = 'received'
    where id = p_purchase_order_id;
  end if;

  insert into maintenance.work_order_costs (
    tenant_id, work_order_id, purchase_order_id, category_code,
    description, amount, currency, journal_id, incurred_on, snapshot_json
  ) values (
    v.tenant_id, p_work_order_id, p_purchase_order_id, 'VENDOR_PAYABLE',
    'Vendor invoice: ' || p_invoice_ref, v_total, p_currency,
    v_journal_id, p_invoice_date,
    jsonb_build_object('payable_id', v_payable_id, 'payable_no', v_payable_no, 'invoice_ref', p_invoice_ref)
  );

  -- 12. Emit Audit Events
  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'PAYABLE_CREATED', 'maintenance.vendor_payable', v_payable_id,
    'Maintenance payable created',
    jsonb_build_object('payable_no', v_payable_no, 'total_amount', v_total, 'journal_id', v_journal_id)
  ), (
    v.tenant_id, v.user_id, v.role_code, 'MAINTENANCE_COST_POSTED', 'finance.journal', v_journal_id,
    'Maintenance cost posted to GL',
    jsonb_build_object('journal_no', v_journal_no, 'work_order_id', p_work_order_id, 'amount', v_total)
  );

  return jsonb_build_object(
    'id', v_payable_id,
    'payable_no', v_payable_no,
    'status', 'posted',
    'journal_id', v_journal_id,
    'journal_no', v_journal_no,
    'total_amount', v_total
  );
end $$;

commit;
