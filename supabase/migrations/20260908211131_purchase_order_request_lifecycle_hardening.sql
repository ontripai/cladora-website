-- Migration 75: CLADORA-P2-MAINT-003 Purchase Order Request & Approval Lifecycle Hardening
-- Enforces forward-only lifecycle: draft -> requested -> approved -> ordered -> received
-- Strict dual control: Creator and Requester cannot approve their own purchase order.

begin;

-- 1. Schema Extensions on maintenance.purchase_orders
alter table maintenance.purchase_orders
  add column if not exists requested_at timestamptz,
  add column if not exists requested_by uuid references auth.users(id);

-- Constraint ensuring status and requested metadata integrity while retaining backward compatibility
alter table maintenance.purchase_orders
  drop constraint if exists purchase_orders_requested_metadata_check;

alter table maintenance.purchase_orders
  add constraint purchase_orders_requested_metadata_check
  check (status <> 'requested' or (requested_at is not null and requested_by is not null));

create index if not exists purchase_orders_requested_by_idx
  on maintenance.purchase_orders (requested_by);

create index if not exists purchase_orders_tenant_status_idx
  on maintenance.purchase_orders (tenant_id, status);

-- 2. Protect Purchase Order Trigger Function Hardening
create or replace function maintenance.protect_purchase_order()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, maintenance
as $$
begin
  if tg_op = 'DELETE' and old.status in ('requested', 'approved', 'ordered', 'received') then
    raise exception 'approved_purchase_order_is_immutable';
  end if;

  if tg_op = 'UPDATE' and old.status = 'received' and (
    new.status <> 'received' or
    (new.tenant_id, new.work_order_id, new.vendor_id, new.quote_id, new.subtotal, new.tax_total, new.currency, new.snapshot_json)
      is distinct from (old.tenant_id, old.work_order_id, old.vendor_id, old.quote_id, old.subtotal, old.tax_total, old.currency, old.snapshot_json) or
    (old.ledger_journal_id is not null and new.ledger_journal_id is distinct from old.ledger_journal_id)
  ) then
    raise exception 'approved_purchase_order_is_immutable';
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved' and (
    new.status not in ('approved', 'ordered') or
    (new.tenant_id, new.work_order_id, new.vendor_id, new.quote_id, new.subtotal, new.tax_total, new.currency, new.snapshot_json)
      is distinct from (old.tenant_id, old.work_order_id, old.vendor_id, old.quote_id, old.subtotal, old.tax_total, old.currency, old.snapshot_json)
  ) then
    raise exception 'approved_purchase_order_is_immutable';
  end if;

  if tg_op = 'UPDATE' and old.status = 'ordered' and (
    new.status not in ('ordered', 'received') or
    (new.tenant_id, new.work_order_id, new.vendor_id, new.quote_id, new.subtotal, new.tax_total, new.currency, new.snapshot_json)
      is distinct from (old.tenant_id, old.work_order_id, old.vendor_id, old.quote_id, old.subtotal, old.tax_total, old.currency, old.snapshot_json)
  ) then
    raise exception 'approved_purchase_order_is_immutable';
  end if;

  -- Timestamp tracking
  if tg_op = 'UPDATE' and new.status = 'requested' and old.status <> 'requested' then
    new.requested_at = coalesce(new.requested_at, statement_timestamp());
  end if;

  if tg_op = 'UPDATE' and old.status not in ('approved', 'ordered', 'received') and new.status in ('approved', 'ordered', 'received') then
    new.approved_at = coalesce(new.approved_at, statement_timestamp());
  end if;

  if tg_op = 'UPDATE' and new.status = 'ordered' and old.status <> 'ordered' then
    new.ordered_at = coalesce(new.ordered_at, statement_timestamp());
  end if;

  if tg_op = 'UPDATE' and new.status = 'received' and old.status <> 'received' then
    new.received_at = coalesce(new.received_at, statement_timestamp());
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

-- 3. Request Purchase Order (draft -> requested)
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

-- 4. Approve Purchase Order (Hardened: requested -> approved with Dual Control)
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

-- 5. Receive Purchase Order (ordered -> received)
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

-- 6. Customer API Gateway Functions
create or replace function customer_api.request_purchase_order_v1(
  p_context_id uuid,
  p_purchase_order_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.request_purchase_order(p_context_id, p_purchase_order_id, p_notes);
end;
$$;

create or replace function customer_api.approve_purchase_order_v1(
  p_context_id uuid,
  p_purchase_order_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.approve_purchase_order(p_context_id, p_purchase_order_id, p_reason);
end;
$$;

create or replace function customer_api.receive_purchase_order_v1(
  p_context_id uuid,
  p_purchase_order_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.receive_purchase_order(p_context_id, p_purchase_order_id);
end;
$$;

-- 7. Explicit Permissions, Revokes and Grants
revoke all on function maintenance.request_purchase_order(uuid, uuid, text) from public, anon;
grant execute on function maintenance.request_purchase_order(uuid, uuid, text) to authenticated, service_role;

revoke all on function maintenance.approve_purchase_order(uuid, uuid, text) from public, anon;
grant execute on function maintenance.approve_purchase_order(uuid, uuid, text) to authenticated, service_role;

revoke all on function maintenance.receive_purchase_order(uuid, uuid) from public, anon;
grant execute on function maintenance.receive_purchase_order(uuid, uuid) to authenticated, service_role;

revoke all on function customer_api.request_purchase_order_v1(uuid, uuid, text) from public, anon, service_role;
grant execute on function customer_api.request_purchase_order_v1(uuid, uuid, text) to authenticated;

revoke all on function customer_api.approve_purchase_order_v1(uuid, uuid, text) from public, anon;
grant execute on function customer_api.approve_purchase_order_v1(uuid, uuid, text) to authenticated, service_role;

revoke all on function customer_api.receive_purchase_order_v1(uuid, uuid) from public, anon;
grant execute on function customer_api.receive_purchase_order_v1(uuid, uuid) to authenticated, service_role;

commit;
