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

  -- Lifecycle transition validations
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status not in ('draft', 'requested', 'cancelled') then
    raise exception 'purchase_order_must_be_requested_to_approve';
  end if;

  if tg_op = 'UPDATE' and old.status = 'requested' and new.status not in ('requested', 'approved', 'cancelled') then
    raise exception 'invalid_purchase_order_transition';
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

-- 7. Update get_customer_procurement to expose requested and approval metadata
create or replace function maintenance.get_customer_procurement(
  p_context_id uuid,
  p_view text default 'vendors'::text,
  p_query text default null::text,
  p_status text default null::text,
  p_currency text default null::text,
  p_from date default null::date,
  p_to date default null::date,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null::uuid
)
returns jsonb
language plpgsql
stable security definer
set search_path = pg_catalog, maintenance, identity, platform, portfolio
as $$
declare
  v record;
  v_workspace uuid;
  v_total bigint;
  v_rows jsonb;
  v_summary jsonb;
  v_detail jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;
  if p_view not in ('vendors', 'contracts', 'quotes', 'purchase_orders', 'sla')
    or p_limit < 1 or p_limit > 100 or p_offset < 0
    or (p_currency is not null and p_currency !~ '^[A-Z]{3}$')
    or (p_from is not null and p_to is not null and p_from > p_to)
  then
    raise exception 'invalid_query' using errcode = '22023';
  end if;

  select g.*, m.role_id, r.code role_code, t.legal_name tenant_name,
    coalesce(g.property_id, b.property_id, ub.property_id) scope_property_id
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  join platform.tenants t on t.id = m.tenant_id
  left join portfolio.buildings b on b.id = g.building_id and b.tenant_id = g.tenant_id
  left join portfolio.units u on u.id = g.unit_id and u.tenant_id = g.tenant_id
  left join portfolio.buildings ub on ub.id = u.building_id and ub.tenant_id = g.tenant_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());
  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;
  if lower(v.role_code) not in ('association_admin', 'property_manager', 'president', 'censor') then
    raise exception 'procurement_role_denied' using errcode = '42501';
  end if;
  if not exists(
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code = 'maintenance.procurement.read'
  ) then
    raise exception 'procurement_permission_required' using errcode = '42501';
  end if;

  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;
  if v_workspace is null or not exists(
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key = 'module.maintenance'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
        then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'procurement_entitlement_required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'vendors', (
      select count(*) from maintenance.vendors mv
      where mv.tenant_id = v.tenant_id and (
        v.scope_type = 'tenant'
        or exists(select 1 from maintenance.vendor_contracts vc where vc.vendor_id = mv.id and vc.tenant_id = v.tenant_id and vc.property_id = v.scope_property_id)
        or exists(select 1 from maintenance.work_order_assignments wa join maintenance.work_orders w on w.id = wa.work_order_id where wa.vendor_id = mv.id and wa.tenant_id = v.tenant_id and maintenance.customer_maintenance_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, w.property_id, w.building_id, w.unit_id))
      )
    ),
    'active_contracts', (
      select count(*) from maintenance.vendor_contracts vc
      where vc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or vc.property_id = v.scope_property_id)
        and vc.status = 'active' and vc.starts_on <= current_date and (vc.ends_on is null or vc.ends_on >= current_date)
    ),
    'open_quotes', (
      select count(*) from maintenance.vendor_quotes q join maintenance.work_orders w on w.id = q.work_order_id
      where q.tenant_id = v.tenant_id and maintenance.customer_maintenance_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, w.property_id, w.building_id, w.unit_id)
        and q.status in ('draft', 'active') and (q.valid_until is null or q.valid_until >= current_date)
    ),
    'purchase_orders', (
      select count(*) from maintenance.purchase_orders po join maintenance.work_orders w on w.id = po.work_order_id
      where po.tenant_id = v.tenant_id and maintenance.customer_maintenance_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, w.property_id, w.building_id, w.unit_id)
        and po.status not in ('cancelled', 'received')
    )
  ) into v_summary;

  if p_view = 'vendors' then
    with q as (
      select mv.id, pp.legal_name vendor_name, mv.status::text, mv.service_categories, mv.rating, mv.insurance_valid_until,
        case when mv.insurance_valid_until is null then 'unrecorded' when mv.insurance_valid_until < current_date then 'expired' else 'valid' end insurance_status,
        (select count(*) from maintenance.vendor_contracts vc where vc.vendor_id = mv.id and vc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or vc.property_id = v.scope_property_id) and vc.status = 'active' and vc.starts_on <= current_date and (vc.ends_on is null or vc.ends_on >= current_date)) active_contracts,
        (select count(*) from maintenance.vendor_quotes vq join maintenance.work_orders wo on wo.id = vq.work_order_id where vq.vendor_id = mv.id and vq.tenant_id = v.tenant_id and maintenance.customer_maintenance_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, wo.property_id, wo.building_id, wo.unit_id) and vq.status in ('draft', 'active') and (vq.valid_until is null or vq.valid_until >= current_date)) open_quotes,
        count(*) over() total_count
      from maintenance.vendors mv join portfolio.parties pp on pp.id = mv.party_id
      where mv.tenant_id = v.tenant_id and (
        v.scope_type = 'tenant'
        or exists(select 1 from maintenance.vendor_contracts vc where vc.vendor_id = mv.id and vc.tenant_id = v.tenant_id and vc.property_id = v.scope_property_id)
        or exists(select 1 from maintenance.work_order_assignments wa join maintenance.work_orders wo on wo.id = wa.work_order_id where wa.vendor_id = mv.id and wa.tenant_id = v.tenant_id and maintenance.customer_maintenance_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, wo.property_id, wo.building_id, wo.unit_id))
      )
      and (p_id is null or mv.id = p_id)
      and (p_status is null or mv.status::text = p_status)
      and (p_query is null or trim(p_query) = '' or pp.legal_name ilike '%'||trim(p_query)||'%' or exists(select 1 from unnest(mv.service_categories) c where c ilike '%'||trim(p_query)||'%'))
      order by pp.legal_name, mv.id limit p_limit offset p_offset
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count' order by vendor_name, id), '[]') into v_total, v_rows from q;
  elsif p_view = 'contracts' then
    with q as (
      select vc.id, 'Contract · '||left(vc.id::text, 8) contract_label, pp.legal_name vendor_name, p.name property_name,
        vc.starts_on, vc.ends_on, vc.currency, vc.rate_card, vc.sla_json sla_terms, vc.status::text,
        (vc.status = 'active' and vc.starts_on <= current_date and (vc.ends_on is null or vc.ends_on >= current_date)) is_current,
        count(*) over() total_count
      from maintenance.vendor_contracts vc
      join maintenance.vendors mv on mv.id = vc.vendor_id and mv.tenant_id = vc.tenant_id
      join portfolio.parties pp on pp.id = mv.party_id
      join portfolio.properties p on p.id = vc.property_id and p.tenant_id = vc.tenant_id
      where vc.tenant_id = v.tenant_id and (v.scope_type = 'tenant' or vc.property_id = v.scope_property_id)
        and (p_id is null or vc.id = p_id) and (p_status is null or vc.status::text = p_status) and (p_currency is null or vc.currency = p_currency)
        and (p_from is null or coalesce(vc.ends_on, 'infinity'::date) >= p_from) and (p_to is null or vc.starts_on <= p_to)
        and (p_query is null or trim(p_query) = '' or pp.legal_name ilike '%'||trim(p_query)||'%' or p.name ilike '%'||trim(p_query)||'%')
      order by vc.starts_on desc, vc.id desc limit p_limit offset p_offset
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count' order by starts_on desc, id desc), '[]') into v_total, v_rows from q;
  elsif p_view = 'quotes' then
    with q as (
      select vq.id, vq.quote_ref, wo.work_order_no, wo.title work_order_title, pp.legal_name vendor_name,
        vq.subtotal, vq.tax_total, (vq.subtotal + vq.tax_total) total_amount, vq.currency, vq.valid_until,
        case when vq.valid_until < current_date and vq.status in ('draft', 'active') then 'expired' else vq.status::text end effective_status,
        vq.submitted_at, vq.created_at, count(*) over() total_count
      from maintenance.vendor_quotes vq
      join maintenance.work_orders wo on wo.id = vq.work_order_id and wo.tenant_id = vq.tenant_id
      join maintenance.vendors mv on mv.id = vq.vendor_id and mv.tenant_id = vq.tenant_id
      join portfolio.parties pp on pp.id = mv.party_id
      where vq.tenant_id = v.tenant_id and maintenance.customer_maintenance_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, wo.property_id, wo.building_id, wo.unit_id)
        and (p_id is null or vq.id = p_id)
        and (p_status is null or (case when vq.valid_until < current_date and vq.status in ('draft', 'active') then 'expired' else vq.status::text end) = p_status)
        and (p_currency is null or vq.currency = p_currency)
        and (p_from is null or vq.created_at::date >= p_from) and (p_to is null or vq.created_at::date <= p_to)
        and (p_query is null or trim(p_query) = '' or coalesce(vq.quote_ref, '') ilike '%'||trim(p_query)||'%' or wo.title ilike '%'||trim(p_query)||'%' or pp.legal_name ilike '%'||trim(p_query)||'%')
      order by vq.created_at desc, vq.id desc limit p_limit offset p_offset
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count' order by created_at desc, id desc), '[]') into v_total, v_rows from q;
  elsif p_view = 'purchase_orders' then
    with q as (
      select po.id, po.po_no, wo.work_order_no, wo.title work_order_title, pp.legal_name vendor_name, vq.quote_ref,
        po.subtotal, po.tax_total, (po.subtotal + po.tax_total) total_amount, po.currency, po.status::text,
        po.requested_at, po.requested_by, po.approved_by, po.approved_at, po.ordered_at, po.received_at,
        po.snapshot_json->>'created_by' as created_by,
        (po.ledger_journal_id is not null) ledger_linked, po.created_at,
        count(*) over() total_count
      from maintenance.purchase_orders po
      join maintenance.work_orders wo on wo.id = po.work_order_id and wo.tenant_id = po.tenant_id
      join maintenance.vendors mv on mv.id = po.vendor_id and mv.tenant_id = po.tenant_id
      join portfolio.parties pp on pp.id = mv.party_id
      left join maintenance.vendor_quotes vq on vq.id = po.quote_id and vq.tenant_id = po.tenant_id
      where po.tenant_id = v.tenant_id and maintenance.customer_maintenance_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, wo.property_id, wo.building_id, wo.unit_id)
        and (p_id is null or po.id = p_id) and (p_status is null or po.status::text = p_status) and (p_currency is null or po.currency = p_currency)
        and (p_from is null or po.created_at::date >= p_from) and (p_to is null or po.created_at::date <= p_to)
        and (p_query is null or trim(p_query) = '' or po.po_no::text ilike '%'||trim(p_query)||'%' or wo.title ilike '%'||trim(p_query)||'%' or pp.legal_name ilike '%'||trim(p_query)||'%')
      order by po.created_at desc, po.id desc limit p_limit offset p_offset
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count' order by created_at desc, id desc), '[]') into v_total, v_rows from q;
  else
    with q as (
      select sm.id, sm.metric_code, sm.target_value, sm.actual_value, sm.unit_code, sm.met, sm.measured_at,
        wo.work_order_no, wo.title work_order_title, pp.legal_name vendor_name,
        case when vc.id is null then null else 'Contract · '||left(vc.id::text, 8) end contract_label,
        count(*) over() total_count
      from maintenance.sla_measurements sm
      join maintenance.work_orders wo on wo.id = sm.work_order_id and wo.tenant_id = sm.tenant_id
      left join maintenance.vendor_contracts vc on vc.id = sm.contract_id and vc.tenant_id = sm.tenant_id
      left join maintenance.vendors mv on mv.id = vc.vendor_id and mv.tenant_id = sm.tenant_id
      left join portfolio.parties pp on pp.id = mv.party_id
      where sm.tenant_id = v.tenant_id and maintenance.customer_maintenance_scope_matches(v.scope_type::text, v.property_id, v.building_id, v.unit_id, wo.property_id, wo.building_id, wo.unit_id)
        and (p_id is null or sm.id = p_id) and (p_status is null or sm.met::text = p_status)
        and (p_from is null or sm.measured_at::date >= p_from) and (p_to is null or sm.measured_at::date <= p_to)
        and (p_query is null or trim(p_query) = '' or sm.metric_code ilike '%'||trim(p_query)||'%' or wo.title ilike '%'||trim(p_query)||'%' or coalesce(pp.legal_name, '') ilike '%'||trim(p_query)||'%')
      order by sm.measured_at desc, sm.id desc limit p_limit offset p_offset
    )
    select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count' order by measured_at desc, id desc), '[]') into v_total, v_rows from q;
  end if;

  v_detail := case when p_id is null then null else (select item from jsonb_array_elements(coalesce(v_rows, '[]')) item where item->>'id' = p_id::text limit 1) end;
  return jsonb_build_object(
    'context', jsonb_build_object('id', v.id, 'tenant_name', v.tenant_name, 'role', v.role_code, 'scope', v.scope_type),
    'view', p_view, 'total', coalesce(v_total, 0), 'rows', coalesce(v_rows, '[]'), 'summary', coalesce(v_summary, '{}'),
    'detail', v_detail, 'limit', p_limit, 'offset', p_offset, 'read_only', true, 'commercial_data_redacted', true, 'generated_at', statement_timestamp()
  );
end;
$$;

-- 8. Explicit Permissions, Revokes and Grants
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
