-- Migration 73: CLADORA-P2-MAINT-001 — Production Maintenance, Work Orders, Vendors & Procurement Integration
-- Authoritative slice: Requests, Triage, SLA, Vendors, Contracts, RFQs, Quotes, Work Orders, Purchase Orders, Payables, Balanced Journal Entries (401 Payables, 611/Expense, 4426 VAT).

begin;

-- =============================================================================
-- 1. Permissions & Role Mapping (Reconciled naming convention)
-- =============================================================================

insert into identity.permissions (code, resource, action, description)
values
  ('maintenance.requests.read', 'maintenance.requests', 'read', 'Read maintenance requests, tickets and SLAs'),
  ('maintenance.requests.create', 'maintenance.requests', 'create', 'Create maintenance requests'),
  ('maintenance.requests.manage', 'maintenance.requests', 'manage', 'Manage, triage, and schedule maintenance tickets'),
  ('maintenance.requests.assign', 'maintenance.requests', 'assign', 'Assign maintenance tickets to vendors or staff'),
  ('maintenance.work_orders.read', 'maintenance.work_orders', 'read', 'Read work orders and execution history'),
  ('maintenance.work_orders.manage', 'maintenance.work_orders', 'manage', 'Create, schedule, assign, and advance work orders'),
  ('maintenance.work_orders.verify', 'maintenance.work_orders', 'verify', 'Verify completed work orders and maintenance deliverables'),
  ('maintenance.procurement.read', 'maintenance.procurement', 'read', 'Read vendors, contracts, quotes, purchase orders and SLA terms'),
  ('maintenance.procurement.manage', 'maintenance.procurement', 'manage', 'Manage vendors, contracts, RFQs and quotes'),
  ('maintenance.procurement.approve', 'maintenance.procurement', 'approve', 'Approve quotes, budgets, and purchase orders'),
  ('maintenance.purchase_orders.issue', 'maintenance.purchase_orders', 'issue', 'Issue purchase orders to external vendors'),
  ('finance.payables.read', 'finance.payables', 'read', 'Read vendor payables and linked journal postings'),
  ('finance.payables.create', 'finance.payables', 'create', 'Create and post maintenance payables to general ledger')
on conflict (code) do update set
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description;

-- Grant permissions according to authoritative role matrix
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where
  -- association_admin: full access with AAL2
  (lower(r.code) = 'association_admin' and p.code in (
    'maintenance.requests.read', 'maintenance.requests.create', 'maintenance.requests.manage', 'maintenance.requests.assign',
    'maintenance.work_orders.read', 'maintenance.work_orders.manage', 'maintenance.work_orders.verify',
    'maintenance.procurement.read', 'maintenance.procurement.manage', 'maintenance.procurement.approve',
    'maintenance.purchase_orders.issue', 'finance.payables.read', 'finance.payables.create'
  ))
  -- property_manager: operational and procurement management with AAL2
  or (lower(r.code) = 'property_manager' and p.code in (
    'maintenance.requests.read', 'maintenance.requests.create', 'maintenance.requests.manage', 'maintenance.requests.assign',
    'maintenance.work_orders.read', 'maintenance.work_orders.manage', 'maintenance.work_orders.verify',
    'maintenance.procurement.read', 'maintenance.procurement.manage', 'maintenance.procurement.approve',
    'maintenance.purchase_orders.issue', 'finance.payables.read', 'finance.payables.create'
  ))
  -- president: read-only and explicit quote/PO approval with AAL2
  or (lower(r.code) = 'president' and p.code in (
    'maintenance.requests.read', 'maintenance.work_orders.read', 'maintenance.procurement.read', 'maintenance.procurement.approve', 'finance.payables.read'
  ))
  -- censor: audit and read-only with AAL2
  or (lower(r.code) = 'censor' and p.code in (
    'maintenance.requests.read', 'maintenance.work_orders.read', 'maintenance.procurement.read', 'finance.payables.read'
  ))
  -- owner: scoped requests creation and view with AAL1
  or (lower(r.code) = 'owner' and p.code in (
    'maintenance.requests.read', 'maintenance.requests.create'
  ))
  -- tenant_resident: active residence requests creation and view with AAL1
  or (lower(r.code) = 'tenant_resident' and p.code in (
    'maintenance.requests.read', 'maintenance.requests.create'
  ))
on conflict (role_id, permission_id) do update set effect = 'allow';


-- =============================================================================
-- 2. Schema Enhancements & Canonical Entities
-- =============================================================================

-- Ensure Chart of Accounts has standard 401 (Payables) and 611 (Maintenance expense) for all tenants/properties
insert into finance.accounts (tenant_id, property_id, code, name, type, status)
select p.tenant_id, p.id, '401', 'Furnizori / Payables', 'liability', 'active'
from portfolio.properties p
where not exists (
  select 1 from finance.accounts a where a.tenant_id = p.tenant_id and a.property_id = p.id and a.code = '401'
)
on conflict do nothing;

insert into finance.accounts (tenant_id, property_id, code, name, type, status)
select p.tenant_id, p.id, '611', 'Cheltuieli cu întreținerea și reparațiile', 'expense', 'active'
from portfolio.properties p
where not exists (
  select 1 from finance.accounts a where a.tenant_id = p.tenant_id and a.property_id = p.id and a.code = '611'
)
on conflict do nothing;

-- 2.1 Tickets enhancements
alter table maintenance.tickets
  add column if not exists category text,
  add column if not exists severity text not null default 'minor' check(severity in ('minor','moderate','major','critical')),
  add column if not exists safety_impact boolean not null default false,
  add column if not exists access_instructions text,
  add column if not exists preferred_window text,
  add column if not exists source text not null default 'portal' check(source in ('portal','mobile','call','email','sensor','inspection')),
  add column if not exists assigned_vendor_id uuid references maintenance.vendors(id) on delete set null,
  add column if not exists sla_target_at timestamptz,
  add column if not exists reported_by_membership_id uuid references identity.memberships(id) on delete set null,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 2.2 Status history
create table if not exists maintenance.ticket_status_history (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  ticket_id uuid not null references maintenance.tickets(id) on delete restrict,
  from_status text,
  to_status text not null,
  actor_id uuid references auth.users(id) on delete restrict,
  actor_role text not null,
  reason text,
  occurred_at timestamptz not null default statement_timestamp()
);

-- 2.3 RFQs (Requests for Quote)
create table if not exists maintenance.rfqs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  work_order_id uuid references maintenance.work_orders(id) on delete restrict,
  ticket_id uuid references maintenance.tickets(id) on delete restrict,
  title text not null,
  scope_description text not null,
  due_date date not null,
  status text not null default 'open' check(status in ('open','in_review','awarded','cancelled')),
  invited_vendor_ids uuid[] not null default '{}',
  selected_quote_id uuid,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

-- 2.4 Quotes enhancements (Captured as received from vendor)
alter table maintenance.vendor_quotes
  add column if not exists rfq_id uuid references maintenance.rfqs(id) on delete set null,
  add column if not exists is_selected boolean not null default false,
  add column if not exists selection_reason text,
  add column if not exists selected_at timestamptz,
  add column if not exists selected_by uuid references auth.users(id) on delete restrict,
  add column if not exists captured_by uuid references auth.users(id) on delete restrict,
  add column if not exists received_at timestamptz default statement_timestamp();

-- 2.5 Work Orders enhancements
alter table maintenance.work_orders
  add column if not exists vendor_id uuid references maintenance.vendors(id) on delete restrict,
  add column if not exists quote_id uuid references maintenance.vendor_quotes(id) on delete restrict,
  add column if not exists approved_budget numeric(20,4) check(approved_budget is null or approved_budget >= 0),
  add column if not exists estimated_cost numeric(20,4) check(estimated_cost is null or estimated_cost >= 0),
  add column if not exists actual_cost numeric(20,4) check(actual_cost is null or actual_cost >= 0),
  add column if not exists currency char(3) not null default 'RON',
  add column if not exists access_instructions text,
  add column if not exists tax_policy_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists verified_by uuid references auth.users(id) on delete restrict,
  add column if not exists verification_notes text,
  add column if not exists paused_at timestamptz,
  add column if not exists total_paused_duration interval not null default interval '0',
  add column if not exists metadata jsonb not null default '{}'::jsonb;

-- 2.6 Dual-Control Approval Records
create table if not exists maintenance.approval_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  entity_type text not null check (entity_type in ('work_order', 'purchase_order', 'quote', 'payable')),
  entity_id uuid not null,
  step integer not null default 1 check (step in (1, 2)),
  decision text not null check (decision in ('approved', 'rejected')),
  approver_id uuid not null references auth.users(id) on delete restrict,
  approver_role text not null,
  reason text,
  decided_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, entity_type, entity_id, step)
);

-- 2.7 Vendor Payables (Canonical Maintenance Accounts Payable)
create table if not exists maintenance.vendor_payables (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  work_order_id uuid not null references maintenance.work_orders(id) on delete restrict,
  purchase_order_id uuid references maintenance.purchase_orders(id) on delete restrict,
  vendor_id uuid not null references maintenance.vendors(id) on delete restrict,
  payable_no bigint generated always as identity,
  invoice_ref text not null,
  invoice_date date not null,
  due_date date,
  subtotal numeric(20,4) not null check(subtotal >= 0),
  tax_amount numeric(20,4) not null default 0 check(tax_amount >= 0),
  total_amount numeric(20,4) not null check(total_amount = subtotal + tax_amount),
  currency char(3) not null default 'RON',
  tax_rate numeric(8,4) not null default 0 check(tax_rate >= 0),
  status text not null default 'posted' check(status in ('draft','approved','posted','paid','cancelled')),
  journal_id uuid not null references finance.journals(id) on delete restrict,
  idempotency_key text,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  posted_at timestamptz,
  snapshot_json jsonb not null default '{}'::jsonb,
  unique(tenant_id, payable_no),
  unique(tenant_id, vendor_id, invoice_ref),
  unique(tenant_id, work_order_id)
);

-- Unique index for idempotency
create unique index if not exists vendor_payables_tenant_idemp_idx
  on maintenance.vendor_payables(tenant_id, idempotency_key)
  where idempotency_key is not null and trim(idempotency_key) <> '';

-- Indexes for fast scoped queries and zero leakage
create index if not exists tickets_tenant_status_idx on maintenance.tickets(tenant_id, status, priority);
create index if not exists tickets_tenant_property_idx on maintenance.tickets(tenant_id, property_id, unit_id);
create index if not exists tickets_assigned_vendor_id_idx on maintenance.tickets(assigned_vendor_id);
create index if not exists tickets_reported_by_membership_id_idx on maintenance.tickets(reported_by_membership_id);

create index if not exists ticket_status_history_tenant_id_idx on maintenance.ticket_status_history(tenant_id);
create index if not exists ticket_status_history_ticket_id_idx on maintenance.ticket_status_history(ticket_id);
create index if not exists ticket_status_history_actor_id_idx on maintenance.ticket_status_history(actor_id);

create index if not exists rfqs_tenant_idx on maintenance.rfqs(tenant_id, status);
create index if not exists rfqs_tenant_id_idx on maintenance.rfqs(tenant_id);
create index if not exists rfqs_work_order_id_idx on maintenance.rfqs(work_order_id);
create index if not exists rfqs_ticket_id_idx on maintenance.rfqs(ticket_id);
create index if not exists rfqs_created_by_idx on maintenance.rfqs(created_by);

create index if not exists vendor_quotes_rfq_id_idx on maintenance.vendor_quotes(rfq_id);
create index if not exists vendor_quotes_selected_by_idx on maintenance.vendor_quotes(selected_by);
create index if not exists vendor_quotes_captured_by_idx on maintenance.vendor_quotes(captured_by);

create index if not exists work_orders_tenant_status_idx on maintenance.work_orders(tenant_id, status, priority);
create index if not exists work_orders_vendor_idx on maintenance.work_orders(vendor_id) where vendor_id is not null;
create index if not exists work_orders_vendor_id_idx on maintenance.work_orders(vendor_id);
create index if not exists work_orders_quote_id_idx on maintenance.work_orders(quote_id);
create index if not exists work_orders_verified_by_idx on maintenance.work_orders(verified_by);

create index if not exists approval_records_entity_idx on maintenance.approval_records(tenant_id, entity_type, entity_id);
create index if not exists approval_records_approver_id_idx on maintenance.approval_records(approver_id);

create index if not exists vendor_payables_tenant_work_order_idx on maintenance.vendor_payables(tenant_id, work_order_id);
create index if not exists vendor_payables_tenant_id_idx on maintenance.vendor_payables(tenant_id);
create index if not exists vendor_payables_work_order_id_idx on maintenance.vendor_payables(work_order_id);
create index if not exists vendor_payables_purchase_order_id_idx on maintenance.vendor_payables(purchase_order_id);
create index if not exists vendor_payables_vendor_id_idx on maintenance.vendor_payables(vendor_id);
create index if not exists vendor_payables_journal_idx on maintenance.vendor_payables(journal_id);
create index if not exists vendor_payables_journal_id_idx on maintenance.vendor_payables(journal_id);
create index if not exists vendor_payables_created_by_idx on maintenance.vendor_payables(created_by);

-- Enable RLS on all tables
alter table maintenance.ticket_status_history enable row level security;
alter table maintenance.rfqs enable row level security;
alter table maintenance.vendor_payables enable row level security;
alter table maintenance.approval_records enable row level security;

-- Read policies for authenticated within active tenant context
drop policy if exists ticket_history_read on maintenance.ticket_status_history;
create policy ticket_history_read on maintenance.ticket_status_history
  for select to authenticated
  using (tenant_id = app_private.active_tenant_id() and exists (
    select 1 from maintenance.tickets t
    where t.id = ticket_id and app_private.can_access_asset_scope(t.property_id, t.building_id, t.unit_id)
  ));

drop policy if exists rfqs_read on maintenance.rfqs;
create policy rfqs_read on maintenance.rfqs
  for select to authenticated
  using (tenant_id = app_private.active_tenant_id());

drop policy if exists vendor_payables_read on maintenance.vendor_payables;
create policy vendor_payables_read on maintenance.vendor_payables
  for select to authenticated
  using (tenant_id = app_private.active_tenant_id() and exists (
    select 1 from maintenance.work_orders w
    where w.id = work_order_id and app_private.can_access_asset_scope(w.property_id, w.building_id, w.unit_id)
  ));

drop policy if exists approval_records_read on maintenance.approval_records;
create policy approval_records_read on maintenance.approval_records
  for select to authenticated
  using (tenant_id = app_private.active_tenant_id());

-- Grant select to service_role and authenticated
grant select on maintenance.ticket_status_history, maintenance.rfqs, maintenance.vendor_payables, maintenance.approval_records to authenticated, service_role;
grant all on maintenance.ticket_status_history, maintenance.rfqs, maintenance.vendor_payables, maintenance.approval_records to service_role;
grant usage, select on all sequences in schema maintenance to authenticated, service_role;

-- Revoke direct DML from authenticated and public
revoke insert, update, delete on maintenance.tickets, maintenance.work_orders, maintenance.vendor_quotes,
  maintenance.purchase_orders, maintenance.rfqs, maintenance.vendor_payables, maintenance.ticket_status_history, maintenance.approval_records
from authenticated, anon, public;


-- =============================================================================
-- 3. Scope & Transition Guard Triggers
-- =============================================================================

create or replace function maintenance.enforce_customer_maintenance_integrity()
returns trigger language plpgsql security definer set search_path=pg_catalog,assets,maintenance,portfolio,billing,finance
as $$
declare a assets.assets; w maintenance.work_orders; p maintenance.maintenance_plans; v maintenance.vendors; c maintenance.vendor_contracts;
begin
  if tg_table_schema='assets' and tg_table_name='assets' then
    if tg_op='DELETE' then
      if old.condition='retired' or old.retired_at is not null then raise exception 'retired_asset_is_immutable'; end if;
      return old;
    end if;
    if new.building_id is not null and not exists(select 1 from portfolio.buildings b where b.id=new.building_id and b.tenant_id=new.tenant_id and b.property_id=new.property_id) then raise exception 'asset_building_scope_invalid'; end if;
    if new.unit_id is not null and not exists(select 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=new.unit_id and u.tenant_id=new.tenant_id and b.property_id=new.property_id and (new.building_id is null or b.id=new.building_id)) then raise exception 'asset_unit_scope_invalid'; end if;
    if tg_op='UPDATE' and (old.condition='retired' or old.retired_at is not null) and new is distinct from old then raise exception 'retired_asset_is_immutable'; end if;
    return new;
  elsif tg_table_schema='assets' and tg_table_name='asset_components' then
    if tg_op='DELETE' then return old; end if;
    select * into a from assets.assets where id=new.parent_asset_id and tenant_id=new.tenant_id;
    if not found or not exists(select 1 from assets.assets ca where ca.id=new.component_asset_id and ca.tenant_id=new.tenant_id and ca.property_id=a.property_id and (a.unit_id is null or ca.unit_id=a.unit_id)) then raise exception 'asset_component_scope_invalid'; end if;
    return new;
  elsif tg_table_schema='maintenance' and tg_table_name='maintenance_plans' then
    if tg_op='DELETE' then return old; end if;
    select * into a from assets.assets where id=new.asset_id and tenant_id=new.tenant_id;
    if not found then raise exception 'maintenance_plan_asset_scope_invalid'; end if;
    return new;
  elsif tg_table_schema='maintenance' and tg_table_name='work_orders' then
    if tg_op='DELETE' then if old.status in ('completed','verified') then raise exception 'final_work_order_is_immutable'; end if; return old; end if;
    if new.asset_id is not null then select * into a from assets.assets where id=new.asset_id and tenant_id=new.tenant_id; if not found or a.property_id<>new.property_id or a.building_id is distinct from new.building_id or a.unit_id is distinct from new.unit_id then raise exception 'work_order_asset_scope_invalid'; end if; end if;
    if new.plan_id is not null then select * into p from maintenance.maintenance_plans where id=new.plan_id and tenant_id=new.tenant_id; if not found or new.asset_id is null or p.asset_id<>new.asset_id then raise exception 'work_order_plan_scope_invalid'; end if; end if;
    if tg_op='UPDATE' and old.status in ('completed','verified') and new is distinct from old
      and (new.status=old.status or (to_jsonb(new)-'status'-'verified_at'-'completed_at'-'verified_by'-'verification_notes'-'updated_at') is distinct from (to_jsonb(old)-'status'-'verified_at'-'completed_at'-'verified_by'-'verification_notes'-'updated_at'))
    then raise exception 'final_work_order_is_immutable'; end if;
    return new;
  elsif tg_table_schema='maintenance' and tg_table_name in ('work_order_checklist_items','work_order_events') then
    if tg_table_name='work_order_events' and tg_op<>'INSERT' then raise exception 'work_order_events_are_append_only'; end if;
    select * into w from maintenance.work_orders where id=case when tg_op='DELETE' then old.work_order_id else new.work_order_id end and tenant_id=case when tg_op='DELETE' then old.tenant_id else new.tenant_id end;
    if not found then raise exception 'work_order_child_scope_invalid'; end if;
    if w.status in ('completed','verified') then raise exception 'final_work_order_is_immutable'; end if;
    return case when tg_op='DELETE' then old else new end;
  elsif tg_table_schema='maintenance' and tg_table_name='work_order_assignments' then
    select * into w from maintenance.work_orders where id=case when tg_op='DELETE' then old.work_order_id else new.work_order_id end and tenant_id=case when tg_op='DELETE' then old.tenant_id else new.tenant_id end;
    if tg_op='DELETE' then if w.status in ('completed','verified') then raise exception 'final_work_order_is_immutable'; end if; return old; end if;
    select * into v from maintenance.vendors where id=new.vendor_id and tenant_id=new.tenant_id;
    if w.id is null or v.id is null then raise exception 'assignment_scope_invalid'; end if;
    if new.contract_id is not null then select * into c from maintenance.vendor_contracts where id=new.contract_id and tenant_id=new.tenant_id and vendor_id=new.vendor_id and property_id=w.property_id and status='active' and starts_on<=current_date and (ends_on is null or ends_on>=current_date); if not found then raise exception 'assignment_contract_scope_invalid'; end if; end if;
    if w.status in ('completed','verified') then raise exception 'final_work_order_is_immutable'; end if;
    return new;
  elsif tg_table_schema='maintenance' and tg_table_name='ticket_work_orders' then
    if tg_op='DELETE' then
      select * into w from maintenance.work_orders where id=old.work_order_id and tenant_id=old.tenant_id;
      if w.status in ('completed','verified') then raise exception 'final_work_order_is_immutable'; end if;
      return old;
    end if;
    select * into w from maintenance.work_orders where id=new.work_order_id and tenant_id=new.tenant_id;
    if not found then raise exception 'ticket_work_order_scope_invalid'; end if;
    if not exists(select 1 from maintenance.tickets t where t.id=new.ticket_id and t.tenant_id=new.tenant_id and t.property_id=w.property_id and (w.building_id is null or t.building_id is null or t.building_id=w.building_id) and (w.unit_id is null or t.unit_id is null or t.unit_id=w.unit_id)) then
      raise exception 'ticket_work_order_scope_invalid';
    end if;
    return new;
  elsif tg_table_schema='maintenance' and tg_table_name='work_order_costs' then
    if tg_op='DELETE' then raise exception 'work_order_cost_snapshot_is_immutable'; end if;
    select * into w from maintenance.work_orders where id=new.work_order_id and tenant_id=new.tenant_id;
    if not found then raise exception 'work_order_cost_scope_invalid'; end if;
    if new.purchase_order_id is not null and not exists(select 1 from maintenance.purchase_orders po where po.id=new.purchase_order_id and po.tenant_id=new.tenant_id and po.work_order_id=new.work_order_id and po.currency=new.currency) then raise exception 'work_order_cost_purchase_order_invalid'; end if;
    if new.invoice_id is not null and not exists(select 1 from billing.invoices i where i.id=new.invoice_id and i.tenant_id=new.tenant_id and i.currency=new.currency) then raise exception 'work_order_cost_invoice_invalid'; end if;
    if new.journal_id is not null and not exists(select 1 from finance.journals j where j.id=new.journal_id and j.tenant_id=new.tenant_id) then raise exception 'work_order_cost_journal_invalid'; end if;
    if tg_op='UPDATE' and new is distinct from old
      and (old.journal_id is not null or (to_jsonb(new)-'journal_id') is distinct from (to_jsonb(old)-'journal_id'))
    then raise exception 'work_order_cost_snapshot_is_immutable'; end if;
    return new;
  elsif tg_table_schema='assets' and tg_table_name='asset_history' then
    if tg_op<>'INSERT' then raise exception 'asset_history_is_append_only'; end if;
    select * into a from assets.assets where id=new.asset_id and tenant_id=new.tenant_id;
    if not found then raise exception 'asset_history_scope_invalid'; end if;
    return new;
  end if;
  return case when tg_op='DELETE' then old else new end;
end;
$$;

create or replace function maintenance.enforce_work_order_transition_guards()
returns trigger
language plpgsql
as $$
begin
  -- Prevent hard delete of completed, verified or invoiced work orders
  if tg_op = 'DELETE' then
    if old.status in ('completed', 'verified') then
      raise exception 'final_work_order_is_immutable';
    end if;
    if exists (select 1 from maintenance.vendor_payables where work_order_id = old.id) then
      raise exception 'cannot_delete_work_order_with_payable';
    end if;
    return old;
  end if;

  -- Lifecycle checks
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    -- Allowed transitions from draft: scheduled, assigned, cancelled
    if old.status = 'draft' and new.status not in ('scheduled', 'assigned', 'cancelled') then
      raise exception 'invalid_work_order_transition: % -> %', old.status, new.status;
    end if;
    -- Allowed transitions from scheduled: assigned, in_progress, cancelled
    if old.status = 'scheduled' and new.status not in ('assigned', 'in_progress', 'cancelled') then
      raise exception 'invalid_work_order_transition: % -> %', old.status, new.status;
    end if;
    -- Allowed transitions from assigned: in_progress, scheduled, cancelled
    if old.status = 'assigned' and new.status not in ('in_progress', 'scheduled', 'cancelled') then
      raise exception 'invalid_work_order_transition: % -> %', old.status, new.status;
    end if;
    -- Allowed transitions from in_progress: blocked, completed, cancelled
    if old.status = 'in_progress' and new.status not in ('blocked', 'completed', 'cancelled') then
      raise exception 'invalid_work_order_transition: % -> %', old.status, new.status;
    end if;
    -- Allowed transitions from blocked (hold): in_progress, cancelled
    if old.status = 'blocked' and new.status not in ('in_progress', 'cancelled') then
      raise exception 'invalid_work_order_transition: % -> %', old.status, new.status;
    end if;
    -- Allowed transitions from completed: verified, in_progress (rework)
    if old.status = 'completed' and new.status not in ('verified', 'in_progress') then
      raise exception 'invalid_work_order_transition: % -> %', old.status, new.status;
    end if;
    -- Verified is terminal except for audit correction
    if old.status = 'verified' and new.status <> 'verified' then
      raise exception 'invalid_work_order_transition: verified_work_order_is_terminal';
    end if;
  end if;

  return new;
end $$;

drop trigger if exists trg_work_order_transition_guards on maintenance.work_orders;
create trigger trg_work_order_transition_guards
  before update or delete on maintenance.work_orders
  for each row execute function maintenance.enforce_work_order_transition_guards();


-- =============================================================================
-- 4. Context & Entitlement Verification Helper
-- =============================================================================

create or replace function maintenance.verify_customer_maintenance_actor(
  p_context_id uuid,
  p_required_permission text,
  p_allow_aal1 boolean default false
)
returns table (
  tenant_id uuid,
  property_id uuid,
  building_id uuid,
  unit_id uuid,
  role_code text,
  user_id uuid,
  scope_type text,
  membership_id uuid
)
language plpgsql stable security definer
set search_path = pg_catalog, maintenance, identity, platform, portfolio
as $$
declare
  v record;
  v_workspace uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if not p_allow_aal1 and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.tenant_id, g.property_id, g.building_id, g.unit_id, g.scope_type,
         m.id as membership_id, m.role_id, r.code as role_code, m.user_id
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp()
    and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp()
    and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  -- Platform auditor denied
  if lower(v.role_code) in ('platform_auditor', 'auditor') then
    raise exception 'platform_auditor_denied' using errcode = '42501';
  end if;

  -- Check permission (support both reconciled and legacy permission codes)
  if p_required_permission is not null and not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id
      and rp.effect = 'allow'
      and (
        p.code = p_required_permission
        or (p_required_permission = 'maintenance.requests.read' and p.code in ('maintenance.requests.read', 'maintenance.read', 'maintenance.assets.read'))
        or (p_required_permission = 'maintenance.requests.create' and p.code in ('maintenance.requests.create', 'maintenance.create'))
        or (p_required_permission = 'maintenance.requests.manage' and p.code in ('maintenance.requests.manage', 'maintenance.manage'))
        or (p_required_permission = 'maintenance.requests.assign' and p.code in ('maintenance.requests.assign', 'maintenance.assign'))
        or (p_required_permission = 'maintenance.work_orders.read' and p.code in ('maintenance.work_orders.read', 'maintenance.read'))
        or (p_required_permission = 'maintenance.work_orders.manage' and p.code in ('maintenance.work_orders.manage', 'maintenance.manage'))
        or (p_required_permission = 'maintenance.work_orders.verify' and p.code in ('maintenance.work_orders.verify', 'maintenance.verify'))
        or (p_required_permission = 'maintenance.procurement.read' and p.code in ('maintenance.procurement.read', 'procurement.read'))
        or (p_required_permission = 'maintenance.procurement.manage' and p.code in ('maintenance.procurement.manage', 'procurement.manage'))
        or (p_required_permission = 'maintenance.procurement.approve' and p.code in ('maintenance.procurement.approve', 'procurement.approve'))
        or (p_required_permission = 'maintenance.purchase_orders.issue' and p.code in ('maintenance.purchase_orders.issue', 'purchase_orders.issue'))
        or (p_required_permission = 'finance.payables.create' and p.code in ('finance.payables.create', 'payables.create'))
        or (p_required_permission = 'finance.payables.read' and p.code in ('finance.payables.read', 'payables.read'))
      )
  ) then
    raise exception 'maintenance_permission_required: %', p_required_permission using errcode = '42501';
  end if;

  -- Check module entitlement
  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace
      and e.entitlement_key = 'module.maintenance'
      and e.valid_from <= statement_timestamp()
      and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
           then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'maintenance_entitlement_required' using errcode = '42501';
  end if;

  return query select v.tenant_id, v.property_id, v.building_id, v.unit_id, v.role_code, v.user_id, v.scope_type::text, v.membership_id;
end $$;

revoke all on function maintenance.verify_customer_maintenance_actor(uuid, text, boolean) from public, anon;
grant execute on function maintenance.verify_customer_maintenance_actor(uuid, text, boolean) to authenticated, service_role;


-- =============================================================================
-- 5. Domain Mutation Functions (`maintenance` schema)
-- =============================================================================

-- 5.1 Create Maintenance Request
create or replace function maintenance.create_maintenance_request(
  p_context_id uuid,
  p_property_id uuid,
  p_building_id uuid default null,
  p_unit_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_category text default 'General',
  p_priority text default 'normal',
  p_severity text default 'minor',
  p_safety_impact boolean default false,
  p_access_instructions text default null,
  p_preferred_window text default null,
  p_source text default 'portal'
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_ticket_id uuid;
  v_ticket_no bigint;
  v_sla_target timestamptz;
  v_sla_hours interval;
  v_clean_priority maintenance.priority;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.requests.create', true);

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'ticket_title_required' using errcode = '22023';
  end if;

  if v.scope_type = 'unit' then
    if v.unit_id is distinct from p_unit_id then
      raise exception 'scope_violation_unit_mismatch' using errcode = '42501';
    end if;
  elsif v.scope_type = 'property' then
    if v.property_id is distinct from p_property_id then
      raise exception 'scope_violation_property_mismatch' using errcode = '42501';
    end if;
  end if;

  v_clean_priority := case lower(coalesce(p_priority, 'normal'))
    when 'emergency' then 'emergency'::maintenance.priority
    when 'urgent' then 'urgent'::maintenance.priority
    when 'high' then 'high'::maintenance.priority
    when 'low' then 'low'::maintenance.priority
    else 'normal'::maintenance.priority
  end;

  -- Deterministic SLA target calculation
  v_sla_hours := case v_clean_priority
    when 'emergency' then interval '4 hours'
    when 'urgent' then interval '24 hours'
    when 'high' then interval '48 hours'
    when 'low' then interval '240 hours'
    else interval '120 hours'
  end;
  v_sla_target := statement_timestamp() + v_sla_hours;

  insert into maintenance.tickets (
    tenant_id, property_id, building_id, unit_id,
    title, description, category_code, category, priority, status,
    severity, safety_impact, access_instructions, preferred_window,
    source, sla_target_at, reported_by, reported_by_membership_id, reported_at
  ) values (
    v.tenant_id, p_property_id, p_building_id, p_unit_id,
    p_title, p_description, p_category, p_category, v_clean_priority, 'open',
    p_severity, coalesce(p_safety_impact, false), p_access_instructions, p_preferred_window,
    coalesce(p_source, 'portal'), v_sla_target, v.user_id, v.membership_id, statement_timestamp()
  ) returning id, ticket_no into v_ticket_id, v_ticket_no;

  insert into maintenance.ticket_status_history (
    tenant_id, ticket_id, from_status, to_status, actor_id, actor_role, reason
  ) values (
    v.tenant_id, v_ticket_id, null, 'open', v.user_id, v.role_code, 'Request created'
  );

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'MAINTENANCE_REQUEST_CREATED', 'maintenance.ticket', v_ticket_id,
    'Maintenance request created',
    jsonb_build_object(
      'ticket_no', v_ticket_no,
      'priority', v_clean_priority::text,
      'category', p_category,
      'sla_target_at', v_sla_target
    )
  );

  return jsonb_build_object(
    'id', v_ticket_id,
    'ticket_no', v_ticket_no,
    'status', 'open',
    'sla_target_at', v_sla_target
  );
end $$;

-- 5.2 Triage Request
create or replace function maintenance.triage_maintenance_request(
  p_context_id uuid,
  p_ticket_id uuid,
  p_priority text,
  p_category text,
  p_reason text default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  t record;
  v_new_prio maintenance.priority;
  v_old_status text;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.requests.manage', false);

  select * into t from maintenance.tickets where id = p_ticket_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'ticket_not_found' using errcode = 'P0002'; end if;

  v_old_status := t.status::text;
  v_new_prio := case lower(coalesce(p_priority, 'normal'))
    when 'emergency' then 'emergency'::maintenance.priority
    when 'urgent' then 'urgent'::maintenance.priority
    when 'high' then 'high'::maintenance.priority
    when 'low' then 'low'::maintenance.priority
    else 'normal'::maintenance.priority
  end;

  update maintenance.tickets
  set status = 'triaged',
      priority = v_new_prio,
      category_code = coalesce(p_category, category_code),
      category = coalesce(p_category, category),
      triaged_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = p_ticket_id;

  insert into maintenance.ticket_status_history (
    tenant_id, ticket_id, from_status, to_status, actor_id, actor_role, reason
  ) values (
    v.tenant_id, p_ticket_id, v_old_status, 'triaged', v.user_id, v.role_code, coalesce(p_reason, 'Triaged')
  );

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'MAINTENANCE_REQUEST_TRIAGED', 'maintenance.ticket', p_ticket_id,
    coalesce(p_reason, 'Ticket triaged'),
    jsonb_build_object('priority', v_new_prio::text, 'category', p_category)
  );

  return jsonb_build_object('id', p_ticket_id, 'status', 'triaged', 'priority', v_new_prio::text);
end $$;

-- 5.3 Assign Request
create or replace function maintenance.assign_maintenance_request(
  p_context_id uuid,
  p_ticket_id uuid,
  p_vendor_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  t record;
  vnd record;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.requests.assign', false);

  select * into t from maintenance.tickets where id = p_ticket_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'ticket_not_found' using errcode = 'P0002'; end if;

  select * into vnd from maintenance.vendors where id = p_vendor_id and tenant_id = v.tenant_id;
  if not found then raise exception 'vendor_not_found' using errcode = 'P0002'; end if;
  if vnd.status in ('suspended', 'blocked') then
    raise exception 'vendor_suspended_or_blocked' using errcode = '22023';
  end if;

  update maintenance.tickets
  set assigned_vendor_id = p_vendor_id,
      updated_at = statement_timestamp()
  where id = p_ticket_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'MAINTENANCE_REQUEST_ASSIGNED', 'maintenance.ticket', p_ticket_id,
    coalesce(p_reason, 'Assigned to vendor'),
    jsonb_build_object('assigned_vendor_id', p_vendor_id)
  );

  return jsonb_build_object('id', p_ticket_id, 'assigned_vendor_id', p_vendor_id);
end $$;

-- 5.4 Change Request Status
create or replace function maintenance.change_maintenance_status(
  p_context_id uuid,
  p_ticket_id uuid,
  p_new_status text,
  p_reason text default null,
  p_resolution_summary text default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  t record;
  v_old_status text;
  v_enum_status maintenance.ticket_status;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.requests.manage', false);

  select * into t from maintenance.tickets where id = p_ticket_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'ticket_not_found' using errcode = 'P0002'; end if;

  v_old_status := t.status::text;

  if p_new_status in ('cancelled', 'reopened') and trim(coalesce(p_reason, '')) = '' then
    raise exception 'status_change_reason_required' using errcode = '22023';
  end if;

  v_enum_status := p_new_status::maintenance.ticket_status;

  update maintenance.tickets
  set status = v_enum_status,
      resolution_summary = coalesce(p_resolution_summary, resolution_summary),
      updated_at = statement_timestamp()
  where id = p_ticket_id;

  insert into maintenance.ticket_status_history (
    tenant_id, ticket_id, from_status, to_status, actor_id, actor_role, reason
  ) values (
    v.tenant_id, p_ticket_id, v_old_status, p_new_status, v.user_id, v.role_code, p_reason
  );

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'MAINTENANCE_STATUS_CHANGED', 'maintenance.ticket', p_ticket_id,
    coalesce(p_reason, 'Status changed'),
    jsonb_build_object('from_status', v_old_status, 'to_status', p_new_status)
  );

  return jsonb_build_object('id', p_ticket_id, 'status', p_new_status);
end $$;

-- 5.5 Reopen Request
create or replace function maintenance.reopen_maintenance_request(
  p_context_id uuid,
  p_ticket_id uuid,
  p_reason text
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  t record;
  v_old_status text;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.requests.manage', false);

  if trim(coalesce(p_reason, '')) = '' then
    raise exception 'reopen_reason_required' using errcode = '22023';
  end if;

  select * into t from maintenance.tickets where id = p_ticket_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'ticket_not_found' using errcode = 'P0002'; end if;

  if t.status not in ('closed', 'resolved') then
    raise exception 'only_closed_or_resolved_can_be_reopened' using errcode = '22023';
  end if;

  v_old_status := t.status::text;

  update maintenance.tickets
  set status = 'reopened',
      updated_at = statement_timestamp()
  where id = p_ticket_id;

  insert into maintenance.ticket_status_history (
    tenant_id, ticket_id, from_status, to_status, actor_id, actor_role, reason
  ) values (
    v.tenant_id, p_ticket_id, v_old_status, 'reopened', v.user_id, v.role_code, p_reason
  );

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'MAINTENANCE_STATUS_CHANGED', 'maintenance.ticket', p_ticket_id,
    p_reason,
    jsonb_build_object('from_status', v_old_status, 'to_status', 'reopened')
  );

  return jsonb_build_object('id', p_ticket_id, 'status', 'reopened');
end $$;

-- 5.6 Create RFQ
create or replace function maintenance.create_rfq(
  p_context_id uuid,
  p_work_order_id uuid default null,
  p_ticket_id uuid default null,
  p_title text default null,
  p_scope_description text default null,
  p_due_date date default null,
  p_invited_vendor_ids uuid[] default '{}'
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  v_rfq_id uuid;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.procurement.manage', false);

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'rfq_title_required' using errcode = '22023';
  end if;
  if p_due_date is null then
    raise exception 'rfq_due_date_required' using errcode = '22023';
  end if;

  insert into maintenance.rfqs (
    tenant_id, work_order_id, ticket_id, title, scope_description,
    due_date, status, invited_vendor_ids, created_by
  ) values (
    v.tenant_id, p_work_order_id, p_ticket_id, p_title, coalesce(p_scope_description, ''),
    p_due_date, 'open', coalesce(p_invited_vendor_ids, '{}'), v.user_id
  ) returning id into v_rfq_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'RFQ_CREATED', 'maintenance.rfq', v_rfq_id,
    'RFQ created',
    jsonb_build_object('title', p_title, 'due_date', p_due_date)
  );

  return jsonb_build_object('id', v_rfq_id, 'status', 'open');
end $$;

-- 5.7 Submit Quote (Captured by Manager as received from Vendor - DEFERRED-VENDOR-PORTAL)
create or replace function maintenance.submit_quote(
  p_context_id uuid,
  p_work_order_id uuid,
  p_vendor_id uuid,
  p_quote_ref text,
  p_subtotal numeric,
  p_tax_total numeric default 0,
  p_currency text default 'RON',
  p_valid_until date default null,
  p_scope_snapshot jsonb default '{}'::jsonb,
  p_rfq_id uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
  vnd record;
  v_quote_id uuid;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.procurement.manage', false);

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;

  select * into vnd from maintenance.vendors where id = p_vendor_id and tenant_id = v.tenant_id;
  if not found then raise exception 'vendor_not_found' using errcode = 'P0002'; end if;
  if vnd.status in ('suspended', 'blocked') then
    raise exception 'vendor_suspended_or_blocked' using errcode = '22023';
  end if;

  if p_subtotal < 0 or p_tax_total < 0 then
    raise exception 'quote_amounts_must_be_non_negative' using errcode = '22023';
  end if;

  insert into maintenance.vendor_quotes (
    tenant_id, work_order_id, vendor_id, quote_ref, subtotal, tax_total,
    currency, valid_until, scope_snapshot, status, submitted_at, rfq_id,
    captured_by, received_at
  ) values (
    v.tenant_id, p_work_order_id, p_vendor_id, p_quote_ref, p_subtotal, p_tax_total,
    p_currency, p_valid_until, coalesce(p_scope_snapshot, '{}'::jsonb), 'active', statement_timestamp(), p_rfq_id,
    v.user_id, statement_timestamp()
  ) returning id into v_quote_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'QUOTE_RECEIVED', 'maintenance.vendor_quote', v_quote_id,
    'Quote received and recorded',
    jsonb_build_object(
      'work_order_id', p_work_order_id,
      'vendor_id', p_vendor_id,
      'subtotal', p_subtotal,
      'tax_total', p_tax_total,
      'currency', p_currency
    )
  );

  return jsonb_build_object('id', v_quote_id, 'subtotal', p_subtotal, 'tax_total', p_tax_total, 'currency', p_currency);
end $$;

-- 5.8 Select Quote
create or replace function maintenance.select_quote(
  p_context_id uuid,
  p_quote_id uuid,
  p_selection_reason text
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  q record;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.procurement.approve', false);

  select * into q from maintenance.vendor_quotes where id = p_quote_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'quote_not_found' using errcode = 'P0002'; end if;

  if q.valid_until is not null and q.valid_until < current_date then
    raise exception 'quote_has_expired' using errcode = '22023';
  end if;

  update maintenance.vendor_quotes
  set is_selected = (id = p_quote_id),
      selected_at = case when id = p_quote_id then statement_timestamp() else null end,
      selected_by = case when id = p_quote_id then v.user_id else null end,
      selection_reason = case when id = p_quote_id then p_selection_reason else null end
  where work_order_id = q.work_order_id and tenant_id = v.tenant_id;

  update maintenance.work_orders
  set vendor_id = q.vendor_id,
      quote_id = q.id,
      approved_budget = q.subtotal + q.tax_total,
      estimated_cost = q.subtotal,
      currency = q.currency,
      tax_policy_snapshot = jsonb_build_object('tax_amount', q.tax_total, 'subtotal', q.subtotal)
  where id = q.work_order_id and tenant_id = v.tenant_id;

  if q.rfq_id is not null then
    update maintenance.rfqs
    set selected_quote_id = p_quote_id, status = 'awarded', updated_at = statement_timestamp()
    where id = q.rfq_id;
  end if;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'QUOTE_SELECTED', 'maintenance.vendor_quote', p_quote_id,
    coalesce(p_selection_reason, 'Quote selected'),
    jsonb_build_object('vendor_id', q.vendor_id, 'total_amount', q.subtotal + q.tax_total)
  );

  return jsonb_build_object('id', p_quote_id, 'is_selected', true, 'work_order_id', q.work_order_id);
end $$;

-- 5.9 Create Work Order
create or replace function maintenance.create_work_order(
  p_context_id uuid,
  p_property_id uuid,
  p_building_id uuid default null,
  p_unit_id uuid default null,
  p_asset_id uuid default null,
  p_ticket_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_priority text default 'normal',
  p_scheduled_start timestamptz default null,
  p_scheduled_end timestamptz default null,
  p_vendor_id uuid default null,
  p_estimated_cost numeric default null,
  p_currency text default 'RON',
  p_access_instructions text default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, portfolio, audit
as $$
declare
  v record;
  v_wo_id uuid;
  v_wo_no bigint;
  v_clean_prio maintenance.priority;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.manage', false);

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'work_order_title_required' using errcode = '22023';
  end if;

  v_clean_prio := case lower(coalesce(p_priority, 'normal'))
    when 'emergency' then 'emergency'::maintenance.priority
    when 'urgent' then 'urgent'::maintenance.priority
    when 'high' then 'high'::maintenance.priority
    when 'low' then 'low'::maintenance.priority
    else 'normal'::maintenance.priority
  end;

  insert into maintenance.work_orders (
    tenant_id, property_id, building_id, unit_id, asset_id,
    title, description, priority, status,
    scheduled_start, scheduled_end, vendor_id, estimated_cost,
    currency, access_instructions, created_by
  ) values (
    v.tenant_id, p_property_id, p_building_id, p_unit_id, p_asset_id,
    p_title, p_description, v_clean_prio, 'draft',
    p_scheduled_start, p_scheduled_end, p_vendor_id, p_estimated_cost,
    coalesce(p_currency, 'RON'), p_access_instructions, v.user_id
  ) returning id, work_order_no into v_wo_id, v_wo_no;

  if p_ticket_id is not null then
    insert into maintenance.ticket_work_orders (ticket_id, work_order_id, tenant_id)
    values (p_ticket_id, v_wo_id, v.tenant_id)
    on conflict do nothing;
  end if;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_CREATED', 'maintenance.work_order', v_wo_id,
    'Work order created',
    jsonb_build_object('work_order_no', v_wo_no, 'priority', v_clean_prio::text)
  );

  return jsonb_build_object('id', v_wo_id, 'work_order_no', v_wo_no, 'status', 'draft');
end $$;

-- 5.10 Approve Work Order (Real Dual-Control: Initiator cannot self-approve)
create or replace function maintenance.approve_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_approved_budget numeric default null,
  p_reason text default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
  v_prior_approver uuid;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.procurement.approve', false);

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;

  if w.status not in ('draft', 'scheduled') then
    raise exception 'invalid_work_order_transition: % -> scheduled', w.status using errcode = '22023';
  end if;

  -- Dual control check: Creator CANNOT self-approve
  if w.created_by = v.user_id then
    raise exception 'creator_cannot_self_approve_dual_control' using errcode = '42501';
  end if;

  -- Check prior approval in chain
  select approver_id into v_prior_approver
  from maintenance.approval_records
  where tenant_id = v.tenant_id and entity_type = 'work_order' and entity_id = p_work_order_id and decision = 'approved'
  order by step desc limit 1;

  if v_prior_approver is not null and v_prior_approver = v.user_id then
    raise exception 'same_user_cannot_perform_dual_approval_step' using errcode = '42501';
  end if;

  -- Record approval record
  insert into maintenance.approval_records (
    tenant_id, entity_type, entity_id, step, decision, approver_id, approver_role, reason
  ) values (
    v.tenant_id, 'work_order', p_work_order_id, case when v_prior_approver is null then 1 else 2 end,
    'approved', v.user_id, v.role_code, coalesce(p_reason, 'Work order approved')
  );

  update maintenance.work_orders
  set status = 'scheduled',
      approved_budget = coalesce(p_approved_budget, approved_budget),
      metadata = metadata || jsonb_build_object('approval_reason', p_reason, 'approved_by', v.user_id, 'approved_at', statement_timestamp())
  where id = p_work_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_APPROVED', 'maintenance.work_order', p_work_order_id,
    coalesce(p_reason, 'Work order approved'),
    jsonb_build_object('work_order_no', w.work_order_no, 'approved_budget', coalesce(p_approved_budget, w.approved_budget))
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'scheduled', 'approved_budget', coalesce(p_approved_budget, w.approved_budget));
end $$;

-- 5.11 Issue Work Order (Assign Vendor)
create or replace function maintenance.issue_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_vendor_id uuid default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
  v_assigned_vendor uuid;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.manage', false);

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;

  v_assigned_vendor := coalesce(p_vendor_id, w.vendor_id);
  if v_assigned_vendor is null then
    raise exception 'vendor_required_to_issue_work_order' using errcode = '22023';
  end if;

  update maintenance.work_orders
  set status = 'assigned',
      vendor_id = v_assigned_vendor,
      updated_at = statement_timestamp()
  where id = p_work_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_ISSUED', 'maintenance.work_order', p_work_order_id,
    'Work order issued to vendor',
    jsonb_build_object('work_order_no', w.work_order_no, 'vendor_id', v_assigned_vendor)
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'assigned', 'vendor_id', v_assigned_vendor);
end $$;

-- 5.12 Start Work Order (or Resume from Hold)
create or replace function maintenance.start_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
  v_pause_diff interval;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.manage', false);

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;

  if w.status not in ('assigned', 'scheduled', 'blocked', 'draft') then
    raise exception 'invalid_work_order_transition: % -> in_progress', w.status using errcode = '22023';
  end if;

  -- Resume logic if coming from blocked (hold)
  v_pause_diff := interval '0';
  if w.status = 'blocked' and w.paused_at is not null then
    v_pause_diff := statement_timestamp() - w.paused_at;
  end if;

  update maintenance.work_orders
  set status = 'in_progress',
      started_at = coalesce(started_at, statement_timestamp()),
      paused_at = null,
      total_paused_duration = total_paused_duration + v_pause_diff,
      updated_at = statement_timestamp()
  where id = p_work_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_STARTED', 'maintenance.work_order', p_work_order_id,
    coalesce(p_notes, 'Work order started/resumed'),
    jsonb_build_object('work_order_no', w.work_order_no, 'status', 'in_progress')
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'in_progress', 'started_at', coalesce(w.started_at, statement_timestamp()));
end $$;

-- 5.13 Hold Work Order (Mandatory Reason Required)
create or replace function maintenance.hold_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_hold_reason text
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.manage', false);

  if trim(coalesce(p_hold_reason, '')) = '' then
    raise exception 'hold_reason_required' using errcode = '22023';
  end if;

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;

  if w.status <> 'in_progress' then
    raise exception 'only_in_progress_can_be_held' using errcode = '22023';
  end if;

  update maintenance.work_orders
  set status = 'blocked',
      paused_at = statement_timestamp(),
      metadata = metadata || jsonb_build_object('hold_reason', p_hold_reason),
      updated_at = statement_timestamp()
  where id = p_work_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_HELD', 'maintenance.work_order', p_work_order_id,
    p_hold_reason,
    jsonb_build_object('work_order_no', w.work_order_no, 'status', 'blocked')
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'blocked', 'hold_reason', p_hold_reason);
end $$;

-- 5.14 Complete Work Order
create or replace function maintenance.complete_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_completion_notes text,
  p_actual_cost numeric default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.manage', false);

  if trim(coalesce(p_completion_notes, '')) = '' then
    raise exception 'completion_notes_required' using errcode = '22023';
  end if;

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;

  if w.status <> 'in_progress' then
    raise exception 'invalid_work_order_transition: % -> completed', w.status using errcode = '22023';
  end if;

  update maintenance.work_orders
  set status = 'completed',
      completion_summary = p_completion_notes,
      actual_cost = coalesce(p_actual_cost, approved_budget, estimated_cost),
      completed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = p_work_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_COMPLETED', 'maintenance.work_order', p_work_order_id,
    'Work order completed',
    jsonb_build_object('work_order_no', w.work_order_no, 'actual_cost', coalesce(p_actual_cost, w.approved_budget))
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'completed', 'completed_at', statement_timestamp());
end $$;

-- 5.15 Verify Work Order (Requires Role Permission: maintenance.work_orders.verify)
create or replace function maintenance.verify_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_verification_notes text
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.verify', false);

  if trim(coalesce(p_verification_notes, '')) = '' then
    raise exception 'verification_notes_required' using errcode = '22023';
  end if;

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;

  if w.status <> 'completed' then
    raise exception 'work_order_must_be_completed_to_verify' using errcode = '22023';
  end if;

  update maintenance.work_orders
  set status = 'verified',
      verified_at = statement_timestamp(),
      verified_by = v.user_id,
      verification_notes = p_verification_notes,
      updated_at = statement_timestamp()
  where id = p_work_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_VERIFIED', 'maintenance.work_order', p_work_order_id,
    p_verification_notes,
    jsonb_build_object('work_order_no', w.work_order_no, 'verified_at', statement_timestamp())
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'verified', 'verified_at', statement_timestamp());
end $$;

-- 5.16 Close Work Order (Terminal State)
create or replace function maintenance.close_work_order(
  p_context_id uuid,
  p_work_order_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, audit
as $$
declare
  v record;
  w record;
  two record;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.manage', false);

  select * into w from maintenance.work_orders where id = p_work_order_id and tenant_id = v.tenant_id for update;
  if not found then raise exception 'work_order_not_found' using errcode = 'P0002'; end if;

  if w.status <> 'verified' then
    raise exception 'work_order_must_be_verified_before_close' using errcode = '22023';
  end if;

  -- Close all linked tickets
  for two in select ticket_id from maintenance.ticket_work_orders where work_order_id = p_work_order_id and tenant_id = v.tenant_id loop
    update maintenance.tickets
    set status = 'closed',
        resolution_summary = coalesce(resolution_summary, w.completion_summary),
        updated_at = statement_timestamp()
    where id = two.ticket_id and status <> 'closed';

    insert into maintenance.ticket_status_history (
      tenant_id, ticket_id, from_status, to_status, actor_id, actor_role, reason
    ) values (
      v.tenant_id, two.ticket_id, 'in_progress', 'closed', v.user_id, v.role_code, 'Closed via work order verification'
    );
  end loop;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_CLOSED', 'maintenance.work_order', p_work_order_id,
    coalesce(p_notes, 'Work order closed'),
    jsonb_build_object('work_order_no', w.work_order_no)
  );

  return jsonb_build_object('id', p_work_order_id, 'status', 'verified', 'closed', true);
end $$;

-- 5.17 Create Purchase Order
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

-- 5.18 Approve Purchase Order (Real Dual-Control: Initiator cannot self-approve)
create or replace function maintenance.approve_purchase_order(
  p_context_id uuid,
  p_purchase_order_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql security definer
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

  if po.status <> 'draft' then
    raise exception 'purchase_order_must_be_draft_to_approve' using errcode = '22023';
  end if;

  -- Dual control check: Creator CANNOT self-approve
  if po.snapshot_json->>'created_by' = v.user_id::text then
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
      snapshot_json = snapshot_json || jsonb_build_object('approval_reason', p_reason)
  where id = p_purchase_order_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'PURCHASE_ORDER_APPROVED', 'maintenance.purchase_order', p_purchase_order_id,
    coalesce(p_reason, 'PO approved'),
    jsonb_build_object('po_no', po.po_no, 'status', 'approved')
  );

  return jsonb_build_object('id', p_purchase_order_id, 'status', 'approved', 'approved_at', statement_timestamp());
end $$;

-- 5.19 Issue Purchase Order
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

-- 5.20 Create Maintenance Payable & Balanced General Ledger Journal
-- 3-Way Match: Work Order verified, PO approved/issued, Invoice details unique and balanced
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

  -- Idempotency check: if key matches, return existing record safely
  if p_idempotency_key is not null and trim(p_idempotency_key) <> '' then
    select vp.id, vp.payable_no, vp.status, vp.journal_id, vp.total_amount
    into v_existing
    from maintenance.vendor_payables vp
    where vp.tenant_id = v.tenant_id and vp.idempotency_key = p_idempotency_key;

    if found then
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


-- =============================================================================
-- 6. Customer API Wrappers (SECURITY INVOKER, Versioned, pg_catalog)
-- =============================================================================

-- 6.1 Create Request
create or replace function customer_api.create_maintenance_request_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_building_id uuid default null,
  p_unit_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_category text default 'General',
  p_priority text default 'normal',
  p_severity text default 'minor',
  p_safety_impact boolean default false,
  p_access_instructions text default null,
  p_preferred_window text default null,
  p_source text default 'portal'
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.create_maintenance_request(
    p_context_id, p_property_id, p_building_id, p_unit_id,
    p_title, p_description, p_category, p_priority, p_severity,
    p_safety_impact, p_access_instructions, p_preferred_window, p_source
  );
end;
$$;

-- 6.2 Triage Request
create or replace function customer_api.triage_maintenance_request_v1(
  p_context_id uuid,
  p_ticket_id uuid,
  p_priority text,
  p_category text,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.triage_maintenance_request(p_context_id, p_ticket_id, p_priority, p_category, p_reason);
end;
$$;

-- 6.3 Assign Request
create or replace function customer_api.assign_maintenance_request_v1(
  p_context_id uuid,
  p_ticket_id uuid,
  p_vendor_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.assign_maintenance_request(p_context_id, p_ticket_id, p_vendor_id, p_reason);
end;
$$;

-- 6.4 Change Status
create or replace function customer_api.change_maintenance_status_v1(
  p_context_id uuid,
  p_ticket_id uuid,
  p_new_status text,
  p_reason text default null,
  p_resolution_summary text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.change_maintenance_status(p_context_id, p_ticket_id, p_new_status, p_reason, p_resolution_summary);
end;
$$;

-- 6.5 Reopen Request
create or replace function customer_api.reopen_maintenance_request_v1(
  p_context_id uuid,
  p_ticket_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.reopen_maintenance_request(p_context_id, p_ticket_id, p_reason);
end;
$$;

-- 6.6 Create RFQ
create or replace function customer_api.create_rfq_v1(
  p_context_id uuid,
  p_work_order_id uuid default null,
  p_ticket_id uuid default null,
  p_title text default null,
  p_scope_description text default null,
  p_due_date date default null,
  p_invited_vendor_ids uuid[] default '{}'
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.create_rfq(p_context_id, p_work_order_id, p_ticket_id, p_title, p_scope_description, p_due_date, p_invited_vendor_ids);
end;
$$;

-- 6.7 Submit Quote
create or replace function customer_api.submit_quote_v1(
  p_context_id uuid,
  p_work_order_id uuid,
  p_vendor_id uuid,
  p_quote_ref text,
  p_subtotal numeric,
  p_tax_total numeric default 0,
  p_currency text default 'RON',
  p_valid_until date default null,
  p_scope_snapshot jsonb default '{}'::jsonb,
  p_rfq_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.submit_quote(
    p_context_id, p_work_order_id, p_vendor_id, p_quote_ref,
    p_subtotal, p_tax_total, p_currency, p_valid_until, p_scope_snapshot, p_rfq_id
  );
end;
$$;

-- 6.8 Select Quote
create or replace function customer_api.select_quote_v1(
  p_context_id uuid,
  p_quote_id uuid,
  p_selection_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.select_quote(p_context_id, p_quote_id, p_selection_reason);
end;
$$;

-- 6.9 Create Work Order
create or replace function customer_api.create_work_order_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_building_id uuid default null,
  p_unit_id uuid default null,
  p_asset_id uuid default null,
  p_ticket_id uuid default null,
  p_title text default null,
  p_description text default null,
  p_priority text default 'normal',
  p_scheduled_start timestamptz default null,
  p_scheduled_end timestamptz default null,
  p_vendor_id uuid default null,
  p_estimated_cost numeric default null,
  p_currency text default 'RON',
  p_access_instructions text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.create_work_order(
    p_context_id, p_property_id, p_building_id, p_unit_id, p_asset_id, p_ticket_id,
    p_title, p_description, p_priority, p_scheduled_start, p_scheduled_end,
    p_vendor_id, p_estimated_cost, p_currency, p_access_instructions
  );
end;
$$;

-- 6.10 Approve Work Order
create or replace function customer_api.approve_work_order_v1(
  p_context_id uuid,
  p_work_order_id uuid,
  p_approved_budget numeric default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.approve_work_order(p_context_id, p_work_order_id, p_approved_budget, p_reason);
end;
$$;

-- 6.11 Issue Work Order
create or replace function customer_api.issue_work_order_v1(
  p_context_id uuid,
  p_work_order_id uuid,
  p_vendor_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.issue_work_order(p_context_id, p_work_order_id, p_vendor_id);
end;
$$;

-- 6.12 Start Work Order
create or replace function customer_api.start_work_order_v1(
  p_context_id uuid,
  p_work_order_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.start_work_order(p_context_id, p_work_order_id, p_notes);
end;
$$;

-- 6.13 Hold Work Order
create or replace function customer_api.hold_work_order_v1(
  p_context_id uuid,
  p_work_order_id uuid,
  p_hold_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.hold_work_order(p_context_id, p_work_order_id, p_hold_reason);
end;
$$;

-- 6.14 Complete Work Order
create or replace function customer_api.complete_work_order_v1(
  p_context_id uuid,
  p_work_order_id uuid,
  p_completion_notes text,
  p_actual_cost numeric default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.complete_work_order(p_context_id, p_work_order_id, p_completion_notes, p_actual_cost);
end;
$$;

-- 6.15 Verify Work Order
create or replace function customer_api.verify_work_order_v1(
  p_context_id uuid,
  p_work_order_id uuid,
  p_verification_notes text
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.verify_work_order(p_context_id, p_work_order_id, p_verification_notes);
end;
$$;

-- 6.16 Close Work Order
create or replace function customer_api.close_work_order_v1(
  p_context_id uuid,
  p_work_order_id uuid,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.close_work_order(p_context_id, p_work_order_id, p_notes);
end;
$$;

-- 6.17 Create Purchase Order
create or replace function customer_api.create_purchase_order_v1(
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
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.create_purchase_order(p_context_id, p_work_order_id, p_vendor_id, p_quote_id, p_subtotal, p_tax_total, p_currency, p_payment_terms);
end;
$$;

-- 6.18 Approve Purchase Order
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

-- 6.19 Issue Purchase Order
create or replace function customer_api.issue_purchase_order_v1(
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
  return maintenance.issue_purchase_order(p_context_id, p_purchase_order_id);
end;
$$;

-- 6.20 Create Maintenance Payable
create or replace function customer_api.create_maintenance_payable_v1(
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
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  return maintenance.create_maintenance_payable(
    p_context_id, p_work_order_id, p_purchase_order_id,
    p_invoice_ref, p_invoice_date, p_due_date, p_subtotal,
    p_tax_amount, p_currency, p_expense_account_id, p_idempotency_key
  );
end;
$$;

-- 6.21 List Maintenance Requests
create or replace function customer_api.list_maintenance_requests_v1(
  p_context_id uuid,
  p_status text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v record;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.requests.read', true);

  select jsonb_agg(row_to_json(r)::jsonb)
  into result
  from (
    select
      t.id, t.ticket_no, t.title, t.description, t.category, t.priority, t.status,
      t.severity, t.safety_impact, t.sla_target_at, t.reported_at, t.created_at,
      t.assigned_vendor_id, vnd.party_id as vendor_party_id,
      p.name as property_name, b.name as building_name, u.code as unit_code,
      case
        when t.status in ('resolved', 'closed', 'cancelled') then 'achieved'
        when statement_timestamp() > t.sla_target_at then 'breached'
        when statement_timestamp() > (t.sla_target_at - interval '12 hours') then 'at_risk'
        else 'on_track'
      end as sla_status
    from maintenance.tickets t
    join portfolio.properties p on p.id = t.property_id
    left join portfolio.buildings b on b.id = t.building_id
    left join portfolio.units u on u.id = t.unit_id
    left join maintenance.vendors vnd on vnd.id = t.assigned_vendor_id
    where t.tenant_id = v.tenant_id
      and (p_status is null or t.status::text = p_status)
      and (v.property_id is null or t.property_id = v.property_id)
      and (v.unit_id is null or t.unit_id = v.unit_id)
    order by t.created_at desc
    limit coalesce(p_limit, 50) offset coalesce(p_offset, 0)
  ) r;

  return coalesce(result, '[]'::jsonb);
end;
$$;

-- 6.22 List Work Orders
create or replace function customer_api.list_work_orders_v1(
  p_context_id uuid,
  p_status text default null,
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v record;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.read', false);

  select jsonb_agg(row_to_json(r)::jsonb)
  into result
  from (
    select
      w.id, w.work_order_no, w.title, w.description, w.priority, w.status,
      w.scheduled_start, w.scheduled_end, w.started_at, w.completed_at, w.verified_at,
      w.approved_budget, w.estimated_cost, w.actual_cost, w.currency,
      w.vendor_id, vnd.party_id as vendor_party_id,
      vp.id as payable_id, vp.payable_no, vp.status as payable_status, vp.journal_id
    from maintenance.work_orders w
    left join maintenance.vendors vnd on vnd.id = w.vendor_id
    left join maintenance.vendor_payables vp on vp.work_order_id = w.id
    where w.tenant_id = v.tenant_id
      and (p_status is null or w.status::text = p_status)
      and (v.property_id is null or w.property_id = v.property_id)
      and (v.unit_id is null or w.unit_id = v.unit_id)
    order by w.created_at desc
    limit coalesce(p_limit, 50) offset coalesce(p_offset, 0)
  ) r;

  return coalesce(result, '[]'::jsonb);
end;
$$;

-- 6.23 Get Maintenance Summary (KPIs)
create or replace function customer_api.get_maintenance_summary_v1(
  p_context_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v record;
  res jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.requests.read', true);

  select jsonb_build_object(
    'total_requests', count(*),
    'open_requests', count(*) filter (where t.status = 'open'),
    'in_progress_requests', count(*) filter (where t.status = 'in_progress'),
    'emergency_requests', count(*) filter (where t.priority = 'emergency' and t.status not in ('closed', 'cancelled')),
    'sla_at_risk', count(*) filter (where t.status not in ('closed', 'cancelled', 'resolved') and statement_timestamp() > (t.sla_target_at - interval '12 hours') and statement_timestamp() <= t.sla_target_at),
    'sla_breached', count(*) filter (where t.status not in ('closed', 'cancelled', 'resolved') and statement_timestamp() > t.sla_target_at),
    'open_work_orders', (
      select count(*) from maintenance.work_orders w
      where w.tenant_id = v.tenant_id and w.status in ('draft', 'scheduled', 'assigned', 'in_progress', 'blocked')
        and (v.property_id is null or w.property_id = v.property_id)
    ),
    'total_payables_count', (
      select count(*) from maintenance.vendor_payables vp
      where vp.tenant_id = v.tenant_id
    ),
    'total_payables_amount', (
      select coalesce(sum(vp.total_amount), 0) from maintenance.vendor_payables vp
      where vp.tenant_id = v.tenant_id
    )
  )
  into res
  from maintenance.tickets t
  where t.tenant_id = v.tenant_id
    and (v.property_id is null or t.property_id = v.property_id)
    and (v.unit_id is null or t.unit_id = v.unit_id);

  return coalesce(res, '{}'::jsonb);
end;
$$;


-- =============================================================================
-- 7. Permissions & Grants on Customer API Functions
-- =============================================================================

-- Revoke all Customer API execution from public and anon
revoke all on function customer_api.create_maintenance_request_v1 from public, anon;
revoke all on function customer_api.triage_maintenance_request_v1 from public, anon;
revoke all on function customer_api.assign_maintenance_request_v1 from public, anon;
revoke all on function customer_api.change_maintenance_status_v1 from public, anon;
revoke all on function customer_api.reopen_maintenance_request_v1 from public, anon;
revoke all on function customer_api.create_rfq_v1 from public, anon;
revoke all on function customer_api.submit_quote_v1 from public, anon;
revoke all on function customer_api.select_quote_v1 from public, anon;
revoke all on function customer_api.create_work_order_v1 from public, anon;
revoke all on function customer_api.approve_work_order_v1 from public, anon;
revoke all on function customer_api.issue_work_order_v1 from public, anon;
revoke all on function customer_api.start_work_order_v1 from public, anon;
revoke all on function customer_api.hold_work_order_v1 from public, anon;
revoke all on function customer_api.complete_work_order_v1 from public, anon;
revoke all on function customer_api.verify_work_order_v1 from public, anon;
revoke all on function customer_api.close_work_order_v1 from public, anon;
revoke all on function customer_api.create_purchase_order_v1 from public, anon;
revoke all on function customer_api.approve_purchase_order_v1 from public, anon;
revoke all on function customer_api.issue_purchase_order_v1 from public, anon;
revoke all on function customer_api.create_maintenance_payable_v1 from public, anon;
revoke all on function customer_api.list_maintenance_requests_v1 from public, anon;
revoke all on function customer_api.list_work_orders_v1 from public, anon;
revoke all on function customer_api.get_maintenance_summary_v1 from public, anon;

-- Grant execution to authenticated and service_role
grant execute on function customer_api.create_maintenance_request_v1 to authenticated, service_role;
grant execute on function customer_api.triage_maintenance_request_v1 to authenticated, service_role;
grant execute on function customer_api.assign_maintenance_request_v1 to authenticated, service_role;
grant execute on function customer_api.change_maintenance_status_v1 to authenticated, service_role;
grant execute on function customer_api.reopen_maintenance_request_v1 to authenticated, service_role;
grant execute on function customer_api.create_rfq_v1 to authenticated, service_role;
grant execute on function customer_api.submit_quote_v1 to authenticated, service_role;
grant execute on function customer_api.select_quote_v1 to authenticated, service_role;
grant execute on function customer_api.create_work_order_v1 to authenticated, service_role;
grant execute on function customer_api.approve_work_order_v1 to authenticated, service_role;
grant execute on function customer_api.issue_work_order_v1 to authenticated, service_role;
grant execute on function customer_api.start_work_order_v1 to authenticated, service_role;
grant execute on function customer_api.hold_work_order_v1 to authenticated, service_role;
grant execute on function customer_api.complete_work_order_v1 to authenticated, service_role;
grant execute on function customer_api.verify_work_order_v1 to authenticated, service_role;
grant execute on function customer_api.close_work_order_v1 to authenticated, service_role;
grant execute on function customer_api.create_purchase_order_v1 to authenticated, service_role;
grant execute on function customer_api.approve_purchase_order_v1 to authenticated, service_role;
grant execute on function customer_api.issue_purchase_order_v1 to authenticated, service_role;
grant execute on function customer_api.create_maintenance_payable_v1 to authenticated, service_role;
grant execute on function customer_api.list_maintenance_requests_v1 to authenticated, service_role;
grant execute on function customer_api.list_work_orders_v1 to authenticated, service_role;
grant execute on function customer_api.get_maintenance_summary_v1 to authenticated, service_role;

commit;
