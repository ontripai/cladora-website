begin;
-- Reuse the private exact-context guard; preserve grants, lifecycle and dual control.

create or replace function maintenance.create_purchase_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_vendor_id uuid,
  p_quote_id uuid default null,
  p_subtotal numeric default 0,
  p_tax_total numeric default 0,
  p_currency text default 'RON',
  p_payment_terms text default 'Net 30'
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
  vnd record;
  v_po_id uuid;
  v_po_no bigint;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.procurement.manage', false);

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.procurement.manage');

  select * into vnd from maintenance.vendors where id = p_vendor_id and tenant_id = v.tenant_id;
  if not found then raise exception 'vendor_not_found' using errcode = 'P0002'; end if;

  if p_subtotal < 0 or p_tax_total < 0 then
    raise exception 'amounts_must_be_non_negative' using errcode = '22023';
  end if;

  insert into maintenance.purchase_orders (
    tenant_id, work_order_id, vendor_id, quote_id,
    subtotal, tax_total, currency, status, snapshot_json
  ) values (
    v.tenant_id, p_work_order_id, p_vendor_id, p_quote_id,
    p_subtotal, p_tax_total, p_currency, 'draft',
    jsonb_build_object('payment_terms', p_payment_terms, 'created_by', v.user_id)
  ) returning id, po_no into v_po_id, v_po_no;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'PURCHASE_ORDER_CREATED', 'maintenance.purchase_order', v_po_id,
    'Purchase order created',
    jsonb_build_object('po_no', v_po_no, 'work_order_id', p_work_order_id, 'total', p_subtotal + p_tax_total)
  );

  return jsonb_build_object('id', v_po_id, 'po_no', v_po_no, 'status', 'draft');
end $$;

create or replace function maintenance.request_purchase_order(
  p_context_id uuid,
  p_purchase_order_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  po record;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.procurement.manage', false);

  select * into po from maintenance.purchase_orders where id = p_purchase_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'purchase_order_not_found' using errcode = 'P0002'; end if;
  perform maintenance.assert_work_order_authority_v1(p_context_id,po.work_order_id,'maintenance.procurement.manage');

  if po.status <> 'draft' then
    raise exception 'purchase_order_must_be_draft_to_request' using errcode = '22023';
  end if;

  update maintenance.purchase_orders
  set status = 'requested',
      requested_at = statement_timestamp(),
      requested_by = v.user_id,
      snapshot_json = snapshot_json || jsonb_build_object(
        'requested_notes', p_notes,
        'requested_by', v.user_id,
        'requested_at', statement_timestamp()
      )
  where id = p_purchase_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'PURCHASE_ORDER_REQUESTED', 'maintenance.purchase_order', p_purchase_order_id,
    coalesce(p_notes, 'PO requested for approval'),
    jsonb_build_object('po_no', po.po_no, 'status', 'requested', 'requested_by', v.user_id, 'requested_at', statement_timestamp())
  );

  return jsonb_build_object('id', p_purchase_order_id, 'status', 'requested', 'requested_at', statement_timestamp());
end;
$$;

create or replace function maintenance.approve_purchase_order(
  p_context_id uuid,
  p_purchase_order_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  po record;
  v_prior_approver uuid;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.procurement.approve', false);

  select * into po from maintenance.purchase_orders where id = p_purchase_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'purchase_order_not_found' using errcode = 'P0002'; end if;
  perform maintenance.assert_work_order_authority_v1(p_context_id,po.work_order_id,'maintenance.procurement.approve');

  if po.status <> 'requested' then
    raise exception 'purchase_order_must_be_requested_to_approve' using errcode = '22023';
  end if;

  -- Dual control check: Neither Creator NOR Requester can self-approve
  if (po.snapshot_json->>'created_by' is not null and po.snapshot_json->>'created_by' = v.user_id::text)
     or (po.requested_by is not null and po.requested_by = v.user_id) then
    raise exception 'creator_cannot_self_approve_dual_control' using errcode = '42501';
  end if;

  -- Check prior approval in chain
  select approver_id into v_prior_approver
  from maintenance.approval_records
  where tenant_id = v.tenant_id and entity_type = 'purchase_order' and entity_id = p_purchase_order_id and decision = 'approved'
  order by step desc limit 1;

  if v_prior_approver is not null and v_prior_approver = v.user_id then
    raise exception 'same_user_cannot_perform_dual_approval_step' using errcode = '42501';
  end if;

  insert into maintenance.approval_records (
    tenant_id, entity_type, entity_id, step, decision, approver_id, approver_role, reason
  ) values (
    v.tenant_id, 'purchase_order', p_purchase_order_id, case when v_prior_approver is null then 1 else 2 end,
    'approved', v.user_id, v.role_code, coalesce(p_reason, 'PO approved')
  );

  update maintenance.purchase_orders
  set status = 'approved',
      approved_by = v.user_id,
      approved_at = statement_timestamp(),
      snapshot_json = snapshot_json || jsonb_build_object(
        'approval_reason', p_reason,
        'approved_by', v.user_id,
        'approved_at', statement_timestamp()
      )
  where id = p_purchase_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'PURCHASE_ORDER_APPROVED', 'maintenance.purchase_order', p_purchase_order_id,
    coalesce(p_reason, 'PO approved'),
    jsonb_build_object('po_no', po.po_no, 'status', 'approved', 'approved_by', v.user_id, 'approved_at', statement_timestamp())
  );

  return jsonb_build_object('id', p_purchase_order_id, 'status', 'approved', 'approved_at', statement_timestamp());
end;
$$;

create or replace function maintenance.issue_purchase_order(
  p_context_id uuid,
  p_purchase_order_id uuid
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  po record;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.purchase_orders.issue', false);

  select * into po from maintenance.purchase_orders where id = p_purchase_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'purchase_order_not_found' using errcode = 'P0002'; end if;
  perform maintenance.assert_work_order_authority_v1(p_context_id,po.work_order_id,'maintenance.procurement.manage');

  if po.status <> 'approved' then
    raise exception 'purchase_order_must_be_approved_to_issue' using errcode = '22023';
  end if;

  update maintenance.purchase_orders
  set status = 'ordered',
      ordered_at = statement_timestamp()
  where id = p_purchase_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'PURCHASE_ORDER_ISSUED', 'maintenance.purchase_order', p_purchase_order_id,
    'PO issued to vendor',
    jsonb_build_object('po_no', po.po_no, 'status', 'ordered')
  );

  return jsonb_build_object('id', p_purchase_order_id, 'status', 'ordered', 'ordered_at', statement_timestamp());
end $$;

create or replace function maintenance.receive_purchase_order(
  p_context_id uuid,
  p_purchase_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  po record;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.procurement.manage', false);

  select * into po from maintenance.purchase_orders where id = p_purchase_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'purchase_order_not_found' using errcode = 'P0002'; end if;
  perform maintenance.assert_work_order_authority_v1(p_context_id,po.work_order_id,'maintenance.procurement.manage');

  if po.status <> 'ordered' then
    raise exception 'purchase_order_must_be_ordered_to_receive' using errcode = '22023';
  end if;

  update maintenance.purchase_orders
  set status = 'received',
      received_at = statement_timestamp()
  where id = p_purchase_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'PURCHASE_ORDER_RECEIVED', 'maintenance.purchase_order', p_purchase_order_id,
    'PO marked received',
    jsonb_build_object('po_no', po.po_no, 'status', 'received', 'received_at', statement_timestamp())
  );

  return jsonb_build_object('id', p_purchase_order_id, 'status', 'received', 'received_at', statement_timestamp());
end;
$$;

commit;
