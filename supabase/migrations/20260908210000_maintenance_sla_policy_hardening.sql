-- Migration 74: CLADORA-P2-MAINT-002 — SLA Policy Hardening & Versioned Immutability
-- Eliminates global hardcoded SLA durations.
-- Enforces explicit tenant/property SLA policies with versioning, timezone, targets, and immutable snapshots.
-- Unconfigured requests explicitly record sla_status = 'unconfigured' and null sla_target_at.

begin;

-- =============================================================================
-- 1. Permissions for SLA Policies
-- =============================================================================

insert into identity.permissions (code, resource, action, description)
values
  ('maintenance.sla_policies.read', 'maintenance.sla_policies', 'read', 'Read SLA policies and target definitions'),
  ('maintenance.sla_policies.manage', 'maintenance.sla_policies', 'manage', 'Create, version, and archive SLA policies')
on conflict (code) do update set
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description;

insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where
  (lower(r.code) in ('association_admin', 'property_manager') and p.code in (
    'maintenance.sla_policies.read', 'maintenance.sla_policies.manage'
  ))
  or (lower(r.code) in ('president', 'censor') and p.code = 'maintenance.sla_policies.read')
on conflict (role_id, permission_id) do update set effect = 'allow';


-- =============================================================================
-- 2. Canonical SLA Policies Entity
-- =============================================================================

create table if not exists maintenance.sla_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  name text not null,
  category text, -- null denotes all categories
  priority maintenance.priority not null,
  response_target_hours numeric(8,2) not null check (response_target_hours > 0),
  attendance_target_hours numeric(8,2) not null check (attendance_target_hours > 0),
  resolution_target_hours numeric(8,2) not null check (resolution_target_hours > 0),
  timezone text not null default 'Europe/Bucharest',
  effective_from date not null,
  effective_to date,
  status text not null default 'active' check (status in ('draft', 'active', 'archived', 'deprecated')),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default statement_timestamp(),
  created_by uuid references auth.users(id) on delete restrict,
  constraint sla_policies_dates_check check (effective_to is null or effective_to >= effective_from)
);

-- Unique index for scoped policy versioning
create unique index if not exists sla_policies_tenant_scope_uq
  on maintenance.sla_policies(tenant_id, coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid), coalesce(category, '*'), priority, version);

-- Covering FK indexes for performance and 022 integrity
create index if not exists sla_policies_tenant_id_idx on maintenance.sla_policies(tenant_id);
create index if not exists sla_policies_property_id_idx on maintenance.sla_policies(property_id);
create index if not exists sla_policies_created_by_idx on maintenance.sla_policies(created_by);
create index if not exists sla_policies_lookup_idx on maintenance.sla_policies(tenant_id, property_id, priority, status);


-- =============================================================================
-- 3. Tickets & Work Orders SLA Snapshot Columns
-- =============================================================================

alter table maintenance.tickets
  add column if not exists sla_policy_id uuid references maintenance.sla_policies(id) on delete set null,
  add column if not exists sla_policy_snapshot jsonb,
  add column if not exists sla_status text not null default 'unconfigured' check (sla_status in ('unconfigured', 'within_target', 'at_risk', 'breached', 'met', 'paused'));

create index if not exists tickets_sla_policy_id_idx on maintenance.tickets(sla_policy_id);
create index if not exists tickets_sla_status_idx on maintenance.tickets(tenant_id, sla_status);

alter table maintenance.work_orders
  add column if not exists sla_policy_snapshot jsonb;


-- =============================================================================
-- 4. SLA Policy Immutability Protection Trigger
-- =============================================================================

create or replace function maintenance.protect_sla_policy_immutability()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from maintenance.tickets where sla_policy_id = old.id) then
      raise exception 'cannot_delete_referenced_sla_policy' using errcode = '23503';
    end if;
    return old;
  end if;

  if tg_op = 'UPDATE' then
    -- If policy is active and already referenced, disallow mutating temporal/economic parameters
    if exists (select 1 from maintenance.tickets where sla_policy_id = old.id) then
      if (old.response_target_hours is distinct from new.response_target_hours or
          old.attendance_target_hours is distinct from new.attendance_target_hours or
          old.resolution_target_hours is distinct from new.resolution_target_hours or
          old.timezone is distinct from new.timezone or
          old.priority is distinct from new.priority or
          old.category is distinct from new.category or
          old.tenant_id is distinct from new.tenant_id or
          old.property_id is distinct from new.property_id or
          old.version is distinct from new.version) then
        raise exception 'referenced_sla_policy_is_immutable' using errcode = '22023';
      end if;
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_protect_sla_policy_immutability on maintenance.sla_policies;
create trigger trg_protect_sla_policy_immutability
  before update or delete on maintenance.sla_policies
  for each row execute function maintenance.protect_sla_policy_immutability();


-- =============================================================================
-- 5. Row Level Security on SLA Policies
-- =============================================================================

alter table maintenance.sla_policies enable row level security;

drop policy if exists sla_policies_read on maintenance.sla_policies;
create policy sla_policies_read on maintenance.sla_policies
  for select to authenticated
  using (tenant_id = app_private.active_tenant_id());

grant select on maintenance.sla_policies to authenticated;
revoke insert, update, delete on maintenance.sla_policies from authenticated, anon;


-- =============================================================================
-- 6. Hardened create_maintenance_request (Policy-Driven, Zero Hardcoded Hours)
-- =============================================================================

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
  v_clean_priority maintenance.priority;
  v_sla_policy record;
  v_sla_target timestamptz := null;
  v_sla_status text := 'unconfigured';
  v_sla_snapshot jsonb;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.requests.create', true);

  if p_property_id is null then
    raise exception 'property_id_required' using errcode = '22023';
  end if;

  if trim(coalesce(p_title, '')) = '' then
    raise exception 'title_required' using errcode = '22023';
  end if;

  if v.scope_type = 'property' and v.property_id is distinct from p_property_id then
    raise exception 'scope_violation_property_mismatch' using errcode = '42501';
  end if;

  if v.scope_type = 'building' then
    if v.property_id is distinct from p_property_id then
      raise exception 'scope_violation_property_mismatch' using errcode = '42501';
    end if;
    if p_building_id is not null and v.building_id is distinct from p_building_id then
      raise exception 'scope_violation_building_mismatch' using errcode = '42501';
    end if;
  end if;

  if v.scope_type = 'unit' then
    if v.unit_id is distinct from p_unit_id then
      raise exception 'scope_violation_unit_mismatch' using errcode = '42501';
    end if;
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

  -- Policy Resolution:
  -- 1. Look for property-scoped active policy
  select * into v_sla_policy
  from maintenance.sla_policies
  where tenant_id = v.tenant_id
    and property_id = p_property_id
    and (category is null or lower(category) = lower(p_category))
    and priority = v_clean_priority
    and status = 'active'
    and effective_from <= current_date
    and (effective_to is null or effective_to >= current_date)
  order by case when lower(category) = lower(p_category) then 0 else 1 end, version desc
  limit 1;

  -- 2. Fall back to tenant-wide active policy
  if v_sla_policy.id is null then
    select * into v_sla_policy
    from maintenance.sla_policies
    where tenant_id = v.tenant_id
      and property_id is null
      and (category is null or lower(category) = lower(p_category))
      and priority = v_clean_priority
      and status = 'active'
      and effective_from <= current_date
      and (effective_to is null or effective_to >= current_date)
    order by case when lower(category) = lower(p_category) then 0 else 1 end, version desc
    limit 1;
  end if;

  -- Compute deterministic target ONLY if explicit policy exists
  if v_sla_policy.id is not null then
    v_sla_target := statement_timestamp() + (v_sla_policy.resolution_target_hours || ' hours')::interval;
    v_sla_status := 'within_target';
    v_sla_snapshot := jsonb_build_object(
      'policy_id', v_sla_policy.id,
      'policy_name', v_sla_policy.name,
      'version', v_sla_policy.version,
      'priority', v_clean_priority::text,
      'category', v_sla_policy.category,
      'response_target_hours', v_sla_policy.response_target_hours,
      'attendance_target_hours', v_sla_policy.attendance_target_hours,
      'resolution_target_hours', v_sla_policy.resolution_target_hours,
      'timezone', v_sla_policy.timezone,
      'effective_from', v_sla_policy.effective_from,
      'snapshot_at', statement_timestamp()
    );
  else
    v_sla_target := null;
    v_sla_status := 'unconfigured';
    v_sla_snapshot := jsonb_build_object(
      'status', 'unconfigured',
      'reason', 'no_active_sla_policy_for_scope',
      'priority', v_clean_priority::text,
      'category', p_category,
      'checked_at', statement_timestamp()
    );
  end if;

  insert into maintenance.tickets (
    tenant_id, property_id, building_id, unit_id,
    title, description, category_code, category, priority, status,
    severity, safety_impact, access_instructions, preferred_window,
    source, sla_target_at, sla_policy_id, sla_policy_snapshot, sla_status,
    reported_by, reported_by_membership_id, reported_at
  ) values (
    v.tenant_id, p_property_id, p_building_id, p_unit_id,
    p_title, p_description, p_category, p_category, v_clean_priority, 'open',
    p_severity, coalesce(p_safety_impact, false), p_access_instructions, p_preferred_window,
    coalesce(p_source, 'portal'), v_sla_target, v_sla_policy.id, v_sla_snapshot, v_sla_status,
    v.user_id, v.membership_id, statement_timestamp()
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
      'sla_policy_id', v_sla_policy.id,
      'sla_status', v_sla_status,
      'sla_target_at', v_sla_target
    )
  );

  return jsonb_build_object(
    'id', v_ticket_id,
    'ticket_no', v_ticket_no,
    'status', 'open',
    'sla_target_at', v_sla_target,
    'sla_status', v_sla_status,
    'sla_policy_id', v_sla_policy.id
  );
end $$;


-- =============================================================================
-- 7. Propagate SLA Snapshot in create_work_order
-- =============================================================================

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
set search_path = pg_catalog, maintenance, identity, platform, portfolio, assets, audit
as $$
declare
  v record;
  t record;
  v_wo_id uuid;
  v_wo_no bigint;
  v_clean_priority maintenance.priority;
  v_ticket_sla_snapshot jsonb := null;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.work_orders.manage', false);

  if p_property_id is null then raise exception 'property_id_required' using errcode = '22023'; end if;
  if trim(coalesce(p_title, '')) = '' then raise exception 'title_required' using errcode = '22023'; end if;

  if p_ticket_id is not null then
    select * into t from maintenance.tickets where id = p_ticket_id and tenant_id = v.tenant_id;
    if not found then raise exception 'ticket_not_found' using errcode = 'P0002'; end if;
    if t.property_id is distinct from p_property_id then
      raise exception 'ticket_property_mismatch' using errcode = '22023';
    end if;
    v_ticket_sla_snapshot := t.sla_policy_snapshot;
  end if;

  if p_vendor_id is not null then
    if not exists (select 1 from maintenance.vendors where id = p_vendor_id and tenant_id = v.tenant_id and status = 'approved') then
      raise exception 'vendor_not_approved_or_missing' using errcode = '22023';
    end if;
  end if;

  v_clean_priority := case lower(coalesce(p_priority, 'normal'))
    when 'emergency' then 'emergency'::maintenance.priority
    when 'urgent' then 'urgent'::maintenance.priority
    when 'high' then 'high'::maintenance.priority
    when 'low' then 'low'::maintenance.priority
    else 'normal'::maintenance.priority
  end;

  insert into maintenance.work_orders (
    tenant_id, property_id, building_id, unit_id, asset_id,
    title, description, priority, status, scheduled_start, scheduled_end,
    vendor_id, estimated_cost, currency, access_instructions,
    created_by, sla_policy_snapshot
  ) values (
    v.tenant_id, p_property_id, p_building_id, p_unit_id, p_asset_id,
    p_title, p_description, v_clean_priority, 'draft', p_scheduled_start, p_scheduled_end,
    p_vendor_id, p_estimated_cost, coalesce(p_currency, 'RON'), p_access_instructions,
    v.user_id, v_ticket_sla_snapshot
  ) returning id, work_order_no into v_wo_id, v_wo_no;

  if p_ticket_id is not null then
    insert into maintenance.ticket_work_orders (tenant_id, ticket_id, work_order_id)
    values (v.tenant_id, p_ticket_id, v_wo_id)
    on conflict do nothing;
  end if;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, reason, after_snapshot
  ) values (
    v.tenant_id, v.user_id, v.role_code, 'WORK_ORDER_CREATED', 'maintenance.work_order', v_wo_id,
    'Work order created',
    jsonb_build_object('work_order_no', v_wo_no, 'status', 'draft', 'priority', v_clean_priority::text)
  );

  return jsonb_build_object(
    'id', v_wo_id,
    'work_order_no', v_wo_no,
    'status', 'draft'
  );
end $$;


-- =============================================================================
-- 8. Customer API RPCs for SLA Policy Management
-- =============================================================================

create or replace function customer_api.create_sla_policy_v1(
  p_context_id uuid,
  p_name text,
  p_priority text,
  p_response_hours numeric,
  p_attendance_hours numeric,
  p_resolution_hours numeric,
  p_effective_from date,
  p_effective_to date default null,
  p_property_id uuid default null,
  p_category text default null,
  p_timezone text default 'Europe/Bucharest'
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, maintenance, identity, platform, portfolio
as $$
declare
  v record;
  v_policy_id uuid;
  v_version integer;
  v_clean_prio maintenance.priority;
begin
  select * into v from maintenance.verify_customer_maintenance_actor(p_context_id, 'maintenance.sla_policies.manage', false);

  if trim(coalesce(p_name, '')) = '' then raise exception 'policy_name_required' using errcode = '22023'; end if;
  if p_effective_from is null then raise exception 'effective_from_required' using errcode = '22023'; end if;
  if p_response_hours is null or p_response_hours <= 0 or
     p_attendance_hours is null or p_attendance_hours <= 0 or
     p_resolution_hours is null or p_resolution_hours <= 0 then
    raise exception 'target_hours_must_be_positive' using errcode = '22023';
  end if;

  v_clean_prio := case lower(coalesce(p_priority, 'normal'))
    when 'emergency' then 'emergency'::maintenance.priority
    when 'urgent' then 'urgent'::maintenance.priority
    when 'high' then 'high'::maintenance.priority
    when 'low' then 'low'::maintenance.priority
    else 'normal'::maintenance.priority
  end;

  -- Determine next version for this tenant/scope/category/priority
  select coalesce(max(version), 0) + 1 into v_version
  from maintenance.sla_policies
  where tenant_id = v.tenant_id
    and coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_property_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and coalesce(category, '*') = coalesce(p_category, '*')
    and priority = v_clean_prio;

  insert into maintenance.sla_policies (
    tenant_id, property_id, name, category, priority,
    response_target_hours, attendance_target_hours, resolution_target_hours,
    timezone, effective_from, effective_to, status, version, created_by
  ) values (
    v.tenant_id, p_property_id, p_name, p_category, v_clean_prio,
    p_response_hours, p_attendance_hours, p_resolution_hours,
    coalesce(p_timezone, 'Europe/Bucharest'), p_effective_from, p_effective_to,
    'active', v_version, v.user_id
  ) returning id into v_policy_id;

  return jsonb_build_object(
    'id', v_policy_id,
    'name', p_name,
    'version', v_version,
    'status', 'active',
    'resolution_target_hours', p_resolution_hours
  );
end $$;

grant execute on function customer_api.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text) to authenticated;
revoke execute on function customer_api.create_sla_policy_v1(uuid,text,text,numeric,numeric,numeric,date,date,uuid,text,text) from public, anon;

commit;
