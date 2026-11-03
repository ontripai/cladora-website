-- Operations independent inactive install unit: maintenance-procurement, v1; SOURCE ONLY, NOT EXECUTED.
-- New lineage proposal; does not mark any historical migration applied.
-- Original proof55000/NULL/ROLLBACK files remain unchanged and are NOT installers.
begin;
set local search_path=pg_catalog;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtextextended('cladora.install.v14.operations',235));
do $unit_entry$
begin
 if current_user<>'postgres' or session_user<>current_user
  or exists(select 1 from pg_roles where rolname=current_user and rolsuper)
  or current_setting('server_version_num')::integer not between 170000 and 179999
  or current_setting('cladora.install.target',true) is distinct from 'ryygcqiunqqtfkpkflzf'
  or current_setting('cladora.install.unit',true) is distinct from 'maintenance-procurement' then
  raise exception 'operations_install_prestate_mismatch' using errcode='55000';end if;
 if not has_schema_privilege(current_user,'auth','USAGE')
  or not has_column_privilege(current_user,'auth.users','id','REFERENCES')
  or not has_column_privilege(current_user,'auth.users','id','SELECT')
  or not has_column_privilege(current_user,'auth.users','email','SELECT')
  or not has_column_privilege(current_user,'auth.users','email_confirmed_at','SELECT')
  or not has_column_privilege(current_user,'auth.sessions','id','SELECT')
  or not has_column_privilege(current_user,'auth.sessions','user_id','SELECT')
  or not has_column_privilege(current_user,'auth.sessions','not_after','SELECT') then
  raise exception 'operations_managed_auth_read_or_reference_prerequisite' using errcode='55000';end if;
 if 'maintenance-procurement'='foundation' and exists(select 1 from pg_namespace where nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications')) then
  raise exception 'operations_fresh_application_state_required' using errcode='55000';end if;
end; $unit_entry$;
select set_config('cladora.install.defaults',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]')::text from pg_default_acl d),true);
select set_config('cladora.install.managed',(select jsonb_build_object(
 'namespaces',(select jsonb_agg(to_jsonb(n) order by n.oid) from pg_namespace n where n.nspname in ('auth','extensions','public')),
 'relations',(select jsonb_agg(to_jsonb(c) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'routines',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'types',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('auth','extensions','public')))::text),true);
-- COMPLETE CATALOG OBSERVATION; never a source-only equivalence PASS.
select set_config('cladora.install.catalog_before',(with recursive
 namespaces as (select * from pg_namespace where nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications')),
 roots as (select c.* from pg_class c where c.relnamespace in (select oid from namespaces)),
 relids(oid) as (select oid from roots union select c.reltoastrelid from roots c where c.reltoastrelid<>0
  union select i.indexrelid from pg_index i where i.indrelid in (select reltoastrelid from roots where reltoastrelid<>0)),
 constraints as (select c.* from pg_constraint c where c.conrelid in (select oid from relids) or c.contypid in (select oid from pg_type where typnamespace in (select oid from namespaces))),
 triggers as (select t.* from pg_trigger t where t.tgrelid in (select oid from relids) or t.tgconstraint in (select oid from constraints)),
 types as (select t.* from pg_type t where t.typnamespace in (select oid from namespaces) or t.typrelid in (select oid from relids)),
 objects(classid,objid) as (
 select 'pg_namespace'::regclass,oid from namespaces union select 'pg_class'::regclass,oid from relids
 union select 'pg_type'::regclass,oid from types union select 'pg_constraint'::regclass,oid from constraints
 union select 'pg_trigger'::regclass,oid from triggers
 union select 'pg_proc'::regclass,oid from pg_proc where pronamespace in (select oid from namespaces)
 union select 'pg_policy'::regclass,oid from pg_policy where polrelid in (select oid from relids)
 union select 'pg_attrdef'::regclass,oid from pg_attrdef where adrelid in (select oid from relids)
 union select 'pg_rewrite'::regclass,oid from pg_rewrite where ev_class in (select oid from relids))
select jsonb_build_object(
 'format','operations-install-catalog-observation.v1',
 'classification','same-database raw catalog; OIDs retained; NOT cross-database normalization/equivalence',
 'namespaces',(select coalesce(jsonb_agg(to_jsonb(n) order by n.oid),'[]') from namespaces n),
 'relations',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]') from pg_class c where c.oid in (select oid from relids)),
 'columns',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'default_expression',pg_get_expr(d.adbin,d.adrelid)) order by a.attrelid,a.attnum),'[]') from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid in (select oid from relids) and a.attnum>0),
 'constraints',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('definition',pg_get_constraintdef(c.oid,true)) order by c.oid),'[]') from constraints c),
 'indexes',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('definition',pg_get_indexdef(i.indexrelid),'predicate',pg_get_expr(i.indpred,i.indrelid),'expressions',pg_get_expr(i.indexprs,i.indrelid)) order by i.indexrelid),'[]') from pg_index i where i.indexrelid in (select oid from relids)),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('using',pg_get_expr(p.polqual,p.polrelid),'with_check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.oid),'[]') from pg_policy p where p.polrelid in (select oid from relids)),
 'triggers_both_FK_sides',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('definition',pg_get_triggerdef(t.oid,true)) order by t.oid),'[]') from triggers t),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from types t),
 'enum_order',(select coalesce(jsonb_agg(to_jsonb(e) order by e.enumtypid,e.enumsortorder),'[]') from pg_enum e where e.enumtypid in (select oid from types)),
 'routines',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('identity',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid)) order by p.oid),'[]') from pg_proc p where p.pronamespace in (select oid from namespaces)),
 'sequences',(select coalesce(jsonb_agg(to_jsonb(s) order by s.seqrelid),'[]') from pg_sequence s where s.seqrelid in (select oid from relids)),
 'rewrite',(select coalesce(jsonb_agg(to_jsonb(r) order by r.oid),'[]') from pg_rewrite r where r.ev_class in (select oid from relids)),
 'dependencies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]') from pg_depend d where exists(select 1 from objects o where (o.classid=d.classid and o.objid=d.objid) or (o.classid=d.refclassid and o.objid=d.refobjid))),
 'shared_dependencies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.deptype),'[]') from pg_shdepend d where d.dbid=(select oid from pg_database where datname=current_database()) and exists(select 1 from objects o where o.classid=d.classid and o.objid=d.objid)),
 'role_graph',(select coalesce(jsonb_agg(to_jsonb(m) order by m.oid),'[]') from pg_auth_members m),
 'role_attributes',(select coalesce(jsonb_agg(to_jsonb(r)-'rolpassword' order by r.oid),'[]') from pg_roles r where r.rolname in ('postgres','cladora_rpc_owner','cladora_building_fixture_ops')),
 'default_acl',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d)) )::text,true);
select set_config('cladora.install.managed_complete',(select jsonb_build_object(
 'schemas',(select coalesce(jsonb_agg(to_jsonb(n) order by n.oid),'[]') from pg_namespace n where nspname in ('auth','extensions','public')),
 'relations',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'columns',(select coalesce(jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum),'[]') from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'routines',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('auth','extensions','public')),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'triggers',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')))
 )::text,true);
do $catalog_entry$
begin
 if current_setting('cladora.install.native_binding',true) is null or current_setting('cladora.install.native_binding',true)=''
 or current_setting('cladora.install.operator_binding',true) is null or current_setting('cladora.install.operator_binding',true)=''
 or current_setting('cladora.install.execution_binding',true) is null or current_setting('cladora.install.execution_binding',true)=''
 or current_setting('cladora.install.prestate_sha256',true) is distinct from encode(extensions.digest(convert_to(current_setting('cladora.install.catalog_before'),'UTF8'),'sha256'),'hex') then
 raise exception 'operations_install_external_binding_or_prestate_required' using errcode='55000';end if;
end; $catalog_entry$;
-- CANONICAL RANGE supabase/migrations/20260908180000_maintenance_work_orders_procurement_slice.sql:5-2468

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



-- CANONICAL RANGE supabase/migrations/20260926120040_preventive_maintenance_schedule_v1.sql:2-145

-- Calendar plans share the existing asset/work-order lifecycle. No approval or
-- payment is automated by this slice. Mutations require the installed module.
alter table maintenance.maintenance_plans
  add column vendor_id uuid references maintenance.vendors(id) on delete restrict,
  add column calendar_anchor date,
  add column calendar_unit text check (calendar_unit in ('days','weeks','months','years')),
  add column calendar_every integer check (calendar_every between 1 and 120),
  add column calendar_index integer not null default 0 check (calendar_index >= 0),
  add column calendar_enabled boolean not null default false,
  add column revision integer not null default 1;

create index maintenance_plans_vendor_idx on maintenance.maintenance_plans(vendor_id);

create table maintenance.plan_occurrences (
  plan_id uuid not null references maintenance.maintenance_plans(id) on delete restrict,
  due_on date not null,
  work_order_id uuid not null unique references maintenance.work_orders(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  primary key(plan_id,due_on)
);
alter table maintenance.plan_occurrences enable row level security;
revoke all on maintenance.plan_occurrences from public, anon, authenticated;
grant select on maintenance.plan_occurrences to service_role;

create function maintenance.calendar_due_v1(p_anchor date,p_unit text,p_every integer,p_index integer)
returns date language plpgsql immutable set search_path=pg_catalog as $$
begin
 if p_anchor is null or p_unit is null or p_unit not in ('days','weeks','months','years')
 or p_every is null or p_every not between 1 and 120 or p_index is null or p_index not between 0 and 100000 then
 raise exception 'invalid_calendar_rule' using errcode='22023'; end if;
 -- Calculate from the original anchor, never from a clamped February date.
 return case p_unit when 'days' then p_anchor + p_every*p_index
 when 'weeks' then p_anchor + 7*p_every*p_index
 when 'months' then (p_anchor + make_interval(months=>p_every*p_index))::date
 when 'years' then (p_anchor + make_interval(years=>p_every*p_index))::date end;
end $$;

create function maintenance.plan_asset_allowed_v1(p_context uuid,p_asset uuid,p_permission text)
returns boolean language sql stable security definer set search_path=pg_catalog as $$
 select exists(select 1 from assets.assets a join identity.context_grants g on g.id=p_context and g.tenant_id=a.tenant_id
 where a.id=p_asset
 and (g.scope_type='tenant' or (g.scope_type='property' and g.property_id=a.property_id) or (g.scope_type='building' and g.building_id=a.building_id) or (g.scope_type='unit' and g.unit_id=a.unit_id))
 and app_private.check_effective_permission_v1(p_context,p_permission,'maintenance',
 case when a.unit_id is not null then 'unit' when a.building_id is not null then 'building' else 'property' end,
 coalesce(a.unit_id,a.building_id,a.property_id)));
$$;

create function maintenance.list_calendar_plans_v1(p_context_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; v_plans jsonb; v_assets jsonb; v_vendors jsonb;
begin
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,'maintenance.work_orders.read',true);
 select coalesce(jsonb_agg(q),'[]') into v_plans from (
 select p.id,p.name,p.asset_id,a.name asset_name,p.vendor_id,pt.legal_name vendor_name,
 p.calendar_anchor,p.calendar_unit,p.calendar_every,p.calendar_enabled,p.revision,
 maintenance.calendar_due_v1(p.calendar_anchor,p.calendar_unit,p.calendar_every,p.calendar_index) next_due_on,
 p.checklist_template,
 (select coalesce(jsonb_agg(jsonb_build_object('due_on',o.due_on,'work_order_id',w.id,'work_order_no',w.work_order_no,'status',w.status) order by o.due_on desc),'[]')
 from maintenance.plan_occurrences o join maintenance.work_orders w on w.id=o.work_order_id where o.plan_id=p.id) history
 from maintenance.maintenance_plans p join assets.assets a on a.id=p.asset_id
 left join maintenance.vendors vd on vd.id=p.vendor_id left join portfolio.parties pt on pt.id=vd.party_id
 where p.tenant_id=v.tenant_id and p.calendar_anchor is not null
 and maintenance.plan_asset_allowed_v1(p_context_id,p.asset_id,'maintenance.work_orders.read')
 order by p.created_at desc limit 200) q;
 select coalesce(jsonb_agg(q),'[]') into v_assets from (
 select a.id,a.name,a.asset_code from assets.assets a where a.tenant_id=v.tenant_id and a.status='active'
 and maintenance.plan_asset_allowed_v1(p_context_id,a.id,'maintenance.work_orders.manage') order by a.name limit 500) q;
 select coalesce(jsonb_agg(q),'[]') into v_vendors from (
 select vd.id,pt.legal_name name from maintenance.vendors vd join portfolio.parties pt on pt.id=vd.party_id
 where vd.tenant_id=v.tenant_id and vd.status='approved' and jsonb_array_length(v_assets)>0 order by pt.legal_name limit 500) q;
 return jsonb_build_object('plans',v_plans,'assets',v_assets,'vendors',v_vendors);
end $$;

create function maintenance.save_calendar_plan_v1(p_context_id uuid,p_id uuid,p_revision integer,p_asset_id uuid,p_vendor_id uuid,p_name text,p_anchor date,p_unit text,p_every integer,p_enabled boolean,p_checklist jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; old_plan maintenance.maintenance_plans%rowtype; result maintenance.maintenance_plans%rowtype;
begin
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,'maintenance.work_orders.manage',false);
 if p_id is null or p_revision is null or p_enabled is null or p_name is null or length(trim(p_name)) not between 1 and 200
 or p_checklist is null or jsonb_typeof(p_checklist)<>'array' then raise exception 'invalid_plan' using errcode='22023'; end if;
 if jsonb_array_length(p_checklist)>50 or exists(select 1 from jsonb_array_elements(p_checklist) e where jsonb_typeof(e)<>'string' or length(trim(e#>>'{}')) not between 1 and 200) then raise exception 'invalid_checklist' using errcode='22023'; end if;
 perform maintenance.calendar_due_v1(p_anchor,p_unit,p_every,0);
 if not maintenance.plan_asset_allowed_v1(p_context_id,p_asset_id,'maintenance.work_orders.manage') then raise exception 'scope_violation' using errcode='42501'; end if;
 if not exists(select 1 from assets.assets where id=p_asset_id and tenant_id=v.tenant_id and status='active') then raise exception 'invalid_asset' using errcode='22023'; end if;
 if not exists(select 1 from maintenance.vendors where id=p_vendor_id and tenant_id=v.tenant_id and status='approved') then raise exception 'invalid_vendor' using errcode='22023'; end if;
 -- Serialize creation as well as edits using the caller-supplied stable UUID.
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,17));
 select * into old_plan from maintenance.maintenance_plans where id=p_id for update;
 if found then
  if old_plan.tenant_id<>v.tenant_id or not maintenance.plan_asset_allowed_v1(p_context_id,old_plan.asset_id,'maintenance.work_orders.manage') then raise exception 'scope_violation' using errcode='42501'; end if;
  if old_plan.calendar_anchor is null or old_plan.revision<>p_revision then raise exception 'plan_revision_conflict' using errcode='40001'; end if;
  -- Keep occurrence identity stable. Create a new plan for another asset/cadence.
  if old_plan.asset_id<>p_asset_id or old_plan.calendar_anchor<>p_anchor or old_plan.calendar_unit<>p_unit or old_plan.calendar_every<>p_every then raise exception 'plan_calendar_immutable' using errcode='22023'; end if;
  update maintenance.maintenance_plans set name=trim(p_name),vendor_id=p_vendor_id,calendar_enabled=p_enabled,checklist_template=p_checklist,revision=revision+1 where id=p_id returning * into result;
 else
  if p_revision<>0 then raise exception 'plan_revision_conflict' using errcode='40001'; end if;
  insert into maintenance.maintenance_plans(id,tenant_id,asset_id,name,trigger_type,recurrence_rule,checklist_template,vendor_id,calendar_anchor,calendar_unit,calendar_every,calendar_enabled,next_due_at)
  values(p_id,v.tenant_id,p_asset_id,trim(p_name),'calendar',jsonb_build_object('anchor',p_anchor,'unit',p_unit,'every',p_every),p_checklist,p_vendor_id,p_anchor,p_unit,p_every,p_enabled,p_anchor::timestamp at time zone 'Europe/Bucharest') returning * into result;
 end if;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,before_snapshot,after_snapshot)
 values(v.tenant_id,v.user_id,v.role_code,'MAINTENANCE_PLAN_SAVED','maintenance.plan',p_id,'Calendar plan configuration',to_jsonb(old_plan),to_jsonb(result));
 return jsonb_build_object('id',result.id,'revision',result.revision);
end $$;

create function maintenance.generate_calendar_order_v1(p_context_id uuid,p_plan_id uuid,p_due_on date)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; p maintenance.maintenance_plans%rowtype; a assets.assets%rowtype; existing uuid; result jsonb; due date; order_id uuid;
begin
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,'maintenance.work_orders.manage',false);
 select * into p from maintenance.maintenance_plans where id=p_plan_id for update;
 if not found then raise exception 'plan_not_found' using errcode='P0002'; end if;
 if p.tenant_id<>v.tenant_id or not maintenance.plan_asset_allowed_v1(p_context_id,p.asset_id,'maintenance.work_orders.manage') then raise exception 'scope_violation' using errcode='42501'; end if;
 select work_order_id into existing from maintenance.plan_occurrences where plan_id=p_plan_id and due_on=p_due_on;
 if found then return jsonb_build_object('id',existing,'replayed',true); end if;
 if not p.calendar_enabled or p.calendar_anchor is null then raise exception 'plan_disabled' using errcode='22023'; end if;
 due:=maintenance.calendar_due_v1(p.calendar_anchor,p.calendar_unit,p.calendar_every,p.calendar_index);
 if p_due_on is null or p_due_on<>due or due>(statement_timestamp() at time zone 'Europe/Bucharest')::date then raise exception 'invalid_due_date' using errcode='22023'; end if;
 select * into a from assets.assets where id=p.asset_id and tenant_id=v.tenant_id and status='active';
 if not found then raise exception 'invalid_asset' using errcode='22023'; end if;
 if not exists(select 1 from maintenance.vendors where id=p.vendor_id and tenant_id=v.tenant_id and status='approved') then raise exception 'invalid_vendor' using errcode='22023'; end if;
 result:=maintenance.create_work_order(p_context_id=>p_context_id,p_property_id=>a.property_id,p_building_id=>a.building_id,p_unit_id=>a.unit_id,p_asset_id=>a.id,p_title=>p.name,p_priority=>p.default_priority::text,p_scheduled_start=>due::timestamp at time zone 'Europe/Bucharest',p_vendor_id=>p.vendor_id);
 order_id:=(result->>'id')::uuid;
 update maintenance.work_orders set plan_id=p.id where id=order_id;
 insert into maintenance.work_order_checklist_items(tenant_id,work_order_id,sequence_no,label)
 select v.tenant_id,order_id,ordinality::integer,value from jsonb_array_elements_text(p.checklist_template) with ordinality;
 insert into maintenance.plan_occurrences(plan_id,due_on,work_order_id) values(p.id,due,order_id);
 update maintenance.maintenance_plans set calendar_index=calendar_index+1,revision=revision+1,last_generated_at=statement_timestamp(),
 next_due_at=maintenance.calendar_due_v1(calendar_anchor,calendar_unit,calendar_every,calendar_index+1)::timestamp at time zone 'Europe/Bucharest' where id=p.id;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
 values(v.tenant_id,v.user_id,v.role_code,'MAINTENANCE_PLAN_ORDER_GENERATED','maintenance.plan',p.id,'Due occurrence issued as draft',jsonb_build_object('due_on',due,'work_order_id',order_id));
 return result || jsonb_build_object('replayed',false);
end $$;

create function customer_api.list_calendar_plans_v1(p_context_id uuid) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select maintenance.list_calendar_plans_v1(p_context_id) $$;
create function customer_api.save_calendar_plan_v1(p_context_id uuid,p_id uuid,p_revision integer,p_asset_id uuid,p_vendor_id uuid,p_name text,p_anchor date,p_unit text,p_every integer,p_enabled boolean,p_checklist jsonb) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select maintenance.save_calendar_plan_v1(p_context_id,p_id,p_revision,p_asset_id,p_vendor_id,p_name,p_anchor,p_unit,p_every,p_enabled,p_checklist) $$;
create function customer_api.generate_calendar_order_v1(p_context_id uuid,p_plan_id uuid,p_due_on date) returns jsonb language sql security invoker set search_path=pg_catalog as $$ select maintenance.generate_calendar_order_v1(p_context_id,p_plan_id,p_due_on) $$;

revoke all on function maintenance.calendar_due_v1(date,text,integer,integer),maintenance.plan_asset_allowed_v1(uuid,uuid,text) from public,anon,authenticated;
revoke all on function maintenance.list_calendar_plans_v1(uuid),maintenance.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb),maintenance.generate_calendar_order_v1(uuid,uuid,date) from public,anon;
revoke all on function customer_api.list_calendar_plans_v1(uuid),customer_api.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb),customer_api.generate_calendar_order_v1(uuid,uuid,date) from public,anon;
grant execute on function maintenance.list_calendar_plans_v1(uuid),maintenance.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb),maintenance.generate_calendar_order_v1(uuid,uuid,date) to authenticated;
grant execute on function customer_api.list_calendar_plans_v1(uuid),customer_api.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb),customer_api.generate_calendar_order_v1(uuid,uuid,date) to authenticated;



-- CANONICAL RANGE supabase/migrations/20260926201804_maintenance_plan_asset_categories.sql:2-31

-- Retain the existing scoped list and expose a stable category for suggestions.
create or replace function maintenance.list_calendar_plans_v1(p_context_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; v_plans jsonb; v_assets jsonb; v_vendors jsonb;
begin
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,'maintenance.work_orders.read',true);
 select coalesce(jsonb_agg(q),'[]') into v_plans from (
 select p.id,p.name,p.asset_id,a.name asset_name,p.vendor_id,pt.legal_name vendor_name,
 p.calendar_anchor,p.calendar_unit,p.calendar_every,p.calendar_enabled,p.revision,
 maintenance.calendar_due_v1(p.calendar_anchor,p.calendar_unit,p.calendar_every,p.calendar_index) next_due_on,
 p.checklist_template,
 (select coalesce(jsonb_agg(jsonb_build_object('due_on',o.due_on,'work_order_id',w.id,'work_order_no',w.work_order_no,'status',w.status) order by o.due_on desc),'[]')
 from maintenance.plan_occurrences o join maintenance.work_orders w on w.id=o.work_order_id where o.plan_id=p.id) history
 from maintenance.maintenance_plans p join assets.assets a on a.id=p.asset_id
 left join maintenance.vendors vd on vd.id=p.vendor_id left join portfolio.parties pt on pt.id=vd.party_id
 where p.tenant_id=v.tenant_id and p.calendar_anchor is not null
 and maintenance.plan_asset_allowed_v1(p_context_id,p.asset_id,'maintenance.work_orders.read')
 order by p.created_at desc limit 200) q;
 select coalesce(jsonb_agg(q),'[]') into v_assets from (
 select a.id,a.name,a.asset_code,c.code category_code from assets.assets a
 join assets.asset_categories c on c.id=a.category_id and c.tenant_id=a.tenant_id
 where a.tenant_id=v.tenant_id and a.status='active'
 and maintenance.plan_asset_allowed_v1(p_context_id,a.id,'maintenance.work_orders.manage') order by a.name limit 500) q;
 select coalesce(jsonb_agg(q),'[]') into v_vendors from (
 select vd.id,pt.legal_name name from maintenance.vendors vd join portfolio.parties pt on pt.id=vd.party_id
 where vd.tenant_id=v.tenant_id and vd.status='approved' and jsonb_array_length(v_assets)>0 order by pt.legal_name limit 500) q;
 return jsonb_build_object('plans',v_plans,'assets',v_assets,'vendors',v_vendors);
end $$;



-- CANONICAL RANGE supabase/migrations/20261004093017_audited_contractor_registration.sql:2-79

-- Vendor records belong to the association, not to an individual building.
-- No portal membership, user, contract or payment authority is created here.
create function maintenance.contractor_actor_v1(p_context_id uuid,p_permission text)
returns table(tenant_id uuid,user_id uuid,role_code text,workspace_id uuid)
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record; resolved record;
begin
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,p_permission,false);
 select * into resolved from app_private.resolve_workspace_from_customer_context_v1(p_context_id,false);
 if v.scope_type<>'tenant' or not app_private.check_effective_permission_v1(p_context_id,p_permission,'maintenance','workspace',resolved.workspace_id) then
  raise exception 'contractor_tenant_authority_required' using errcode='42501';
 end if;
 return query select v.tenant_id,v.user_id,v.role_code,resolved.workspace_id;
end $$;
revoke all on function maintenance.contractor_actor_v1(uuid,text) from public,anon,authenticated;

create function maintenance.list_contractors_v1(p_context_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record; rows jsonb;
begin
 select * into v from maintenance.contractor_actor_v1(p_context_id,'maintenance.procurement.manage');
 select coalesce(jsonb_agg(q),'[]'::jsonb) into rows from (
  select vd.id,pt.legal_name name,vd.status,vd.service_categories
  from maintenance.vendors vd join portfolio.parties pt on pt.id=vd.party_id and pt.tenant_id=vd.tenant_id
  where vd.tenant_id=v.tenant_id and pt.archived_at is null order by pt.legal_name,vd.id limit 200
 ) q;
 return jsonb_build_object('vendors',rows,'can_approve',app_private.check_effective_permission_v1(p_context_id,'maintenance.procurement.approve','maintenance','workspace',v.workspace_id));
end $$;

create function maintenance.register_contractor_v1(p_context_id uuid,p_id uuid,p_name text,p_category text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; existing record; party_id uuid;
begin
 select * into v from maintenance.contractor_actor_v1(p_context_id,'maintenance.procurement.manage');
 if p_id is null or p_name is null or length(trim(p_name)) not between 1 and 200 or p_category is null or p_category not in ('ventilation','pump','elevator','fire_safety','other') then
  raise exception 'invalid_contractor' using errcode='22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,144));
 select vd.*,pt.legal_name into existing from maintenance.vendors vd join portfolio.parties pt on pt.id=vd.party_id where vd.id=p_id;
 if found then
  if existing.tenant_id<>v.tenant_id then raise exception 'contractor_not_found' using errcode='P0002'; end if;
  if existing.legal_name<>trim(p_name) or existing.service_categories<>array[p_category] then raise exception 'contractor_replay_conflict' using errcode='40001'; end if;
  return jsonb_build_object('id',existing.id,'status',existing.status);
 end if;
 insert into portfolio.parties(tenant_id,type,legal_name) values(v.tenant_id,'company',trim(p_name)) returning id into party_id;
 insert into maintenance.vendors(id,tenant_id,party_id,status,service_categories) values(p_id,v.tenant_id,party_id,'candidate',array[p_category]);
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
 values(v.tenant_id,v.user_id,v.role_code,'CONTRACTOR_REGISTERED','maintenance.vendor',p_id,'Candidate contractor registered',jsonb_build_object('name',trim(p_name),'status','candidate','service_categories',array[p_category]));
 return jsonb_build_object('id',p_id,'status','candidate');
end $$;

create function maintenance.approve_contractor_v1(p_context_id uuid,p_vendor_id uuid,p_reason text)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; vendor maintenance.vendors%rowtype;
begin
 select * into v from maintenance.contractor_actor_v1(p_context_id,'maintenance.procurement.approve');
 if p_vendor_id is null or p_reason is null or length(trim(p_reason)) not between 10 and 500 then raise exception 'approval_reason_required' using errcode='22023'; end if;
 select * into vendor from maintenance.vendors where id=p_vendor_id and tenant_id=v.tenant_id for update;
 if not found then raise exception 'contractor_not_found' using errcode='P0002'; end if;
 if vendor.status='approved' then return jsonb_build_object('id',vendor.id,'status','approved'); end if;
 if vendor.status<>'candidate' then raise exception 'contractor_not_candidate' using errcode='40001'; end if;
 if not exists(select 1 from portfolio.parties where id=vendor.party_id and tenant_id=v.tenant_id and archived_at is null) then raise exception 'contractor_party_unavailable' using errcode='22023'; end if;
 update maintenance.vendors set status='approved' where id=vendor.id;
 insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,before_snapshot,after_snapshot)
 values(v.tenant_id,v.user_id,v.role_code,'CONTRACTOR_APPROVED','maintenance.vendor',vendor.id,trim(p_reason),jsonb_build_object('status','candidate'),jsonb_build_object('status','approved'));
 return jsonb_build_object('id',vendor.id,'status','approved');
end $$;

revoke all on function maintenance.list_contractors_v1(uuid),maintenance.register_contractor_v1(uuid,uuid,text,text),maintenance.approve_contractor_v1(uuid,uuid,text) from public,anon;
grant execute on function maintenance.list_contractors_v1(uuid),maintenance.register_contractor_v1(uuid,uuid,text,text),maintenance.approve_contractor_v1(uuid,uuid,text) to authenticated;

create function customer_api.list_contractors_v1(p_context_id uuid) returns jsonb language sql stable security invoker set search_path=pg_catalog as $$select maintenance.list_contractors_v1(p_context_id)$$;
create function customer_api.register_contractor_v1(p_context_id uuid,p_id uuid,p_name text,p_category text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select maintenance.register_contractor_v1(p_context_id,p_id,p_name,p_category)$$;
create function customer_api.approve_contractor_v1(p_context_id uuid,p_vendor_id uuid,p_reason text) returns jsonb language sql security invoker set search_path=pg_catalog as $$select maintenance.approve_contractor_v1(p_context_id,p_vendor_id,p_reason)$$;
revoke all on function customer_api.list_contractors_v1(uuid),customer_api.register_contractor_v1(uuid,uuid,text,text),customer_api.approve_contractor_v1(uuid,uuid,text) from public,anon;
grant execute on function customer_api.list_contractors_v1(uuid),customer_api.register_contractor_v1(uuid,uuid,text,text),customer_api.approve_contractor_v1(uuid,uuid,text) to authenticated;



-- CANONICAL RANGE supabase/migrations/20261004111339_audited_work_order_checklist.sql:2-34
-- Private authority path; no direct table mutation grants or role changes.
create function maintenance.work_order_checklist_v1(p_context_id uuid,p_work_order_id uuid,p_item_id uuid default null,p_notes text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; w record; i record;
begin
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,'maintenance.work_orders.manage',false);
 select * into w from maintenance.work_orders where id=p_work_order_id and tenant_id=v.tenant_id for update;
 if not found then raise exception 'work_order_not_found' using errcode='P0002';end if;
 if not maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id)
 or not app_private.check_effective_permission_v1(p_context_id,'maintenance.work_orders.manage','maintenance',
 case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id))
 then raise exception 'scope_violation' using errcode='42501';end if;
 if p_item_id is not null then
  if w.status<>'in_progress' then raise exception 'invalid_work_order_transition: checklist requires in_progress' using errcode='22023';end if;
  if length(trim(coalesce(p_notes,''))) not between 10 and 2000 then raise exception 'checklist_result_notes_required' using errcode='22023';end if;
  select * into i from maintenance.work_order_checklist_items where id=p_item_id and work_order_id=w.id and tenant_id=v.tenant_id for update;
  if not found then raise exception 'checklist_item_not_found' using errcode='P0002';end if;
  if i.completed then
   if i.result_json->>'notes' is distinct from trim(p_notes) then raise exception 'checklist_result_already_recorded' using errcode='40001';end if;
  else
   update maintenance.work_order_checklist_items set completed=true,completed_by=v.user_id,completed_at=statement_timestamp(),result_json=jsonb_build_object('notes',trim(p_notes)) where id=i.id;
   insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
   values(v.tenant_id,v.user_id,v.role_code,'WORK_ORDER_CHECKLIST_COMPLETED','maintenance.work_order_checklist_item',i.id,trim(p_notes),jsonb_build_object('work_order_id',w.id,'completed',true));
  end if;
 end if;
 return jsonb_build_object('work_order_id',w.id,'status',w.status,'items',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'label',c.label,'required',c.required,'completed',c.completed,'completed_at',c.completed_at,'notes',c.result_json->>'notes') order by c.sequence_no),'[]'::jsonb) from maintenance.work_order_checklist_items c where c.work_order_id=w.id and c.tenant_id=v.tenant_id));
end $$;
revoke all on function maintenance.work_order_checklist_v1(uuid,uuid,uuid,text) from public,anon;
grant execute on function maintenance.work_order_checklist_v1(uuid,uuid,uuid,text) to authenticated;
create function customer_api.work_order_checklist_v1(p_context_id uuid,p_work_order_id uuid,p_item_id uuid default null,p_notes text default null)
returns jsonb language sql security invoker set search_path=pg_catalog as $$ select maintenance.work_order_checklist_v1(p_context_id,p_work_order_id,p_item_id,p_notes) $$;
revoke all on function customer_api.work_order_checklist_v1(uuid,uuid,uuid,text) from public,anon;
grant execute on function customer_api.work_order_checklist_v1(uuid,uuid,uuid,text) to authenticated;


-- CANONICAL RANGE supabase/migrations/20261004114654_work_order_context_authority.sql:2-362
-- Scope and canonical authority supplement, never replace, existing MFA, role,
-- lifecycle, checklist and independent procurement-approval gates.
create function maintenance.assert_work_order_authority_v1(p_context_id uuid,p_work_order_id uuid,p_permission text)
returns void language plpgsql security definer set search_path=pg_catalog as $$
declare v record; w record;
begin
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,p_permission,false);
 select * into w from maintenance.work_orders where id=p_work_order_id and tenant_id=v.tenant_id;
 if not found then raise exception 'work_order_not_found' using errcode='P0002';end if;
 if not coalesce(maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id),false) then
  raise exception 'work_order_context_scope_violation' using errcode='42501';end if;
 if not coalesce(app_private.check_effective_permission_v1(p_context_id,p_permission,'maintenance',
 case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false) then
  raise exception 'work_order_effective_authority_required' using errcode='42501';end if;
end $$;
revoke all on function maintenance.assert_work_order_authority_v1(uuid,uuid,text) from public,anon,authenticated;

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
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.procurement.approve');

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
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.work_orders.manage');

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
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.work_orders.manage');

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
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.work_orders.manage');

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
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.work_orders.manage');

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
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.work_orders.verify');

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
  perform maintenance.assert_work_order_authority_v1(p_context_id,p_work_order_id,'maintenance.work_orders.manage');

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



-- CANONICAL RANGE supabase/migrations/20261004190314_maintenance_read_context_authority.sql:2-222
create function maintenance.can_read_context_target_v1(
 p_context_id uuid,p_permission text,p_tenant_id uuid,p_property_id uuid,p_building_id uuid,p_unit_id uuid
) returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record;
begin
 -- A bounded authorization predicate, never a privileged data reader.
 if p_permission is null or p_permission not in ('maintenance.requests.read','maintenance.work_orders.read') then return false; end if;
 select * into v from maintenance.verify_customer_maintenance_actor(
   p_context_id,p_permission,p_permission='maintenance.requests.read');
 if p_tenant_id is distinct from v.tenant_id then return false; end if;
 if not coalesce(maintenance.customer_maintenance_scope_matches(v.scope_type::text,
   v.property_id,v.building_id,v.unit_id,p_property_id,p_building_id,p_unit_id),false) then return false; end if;
 return coalesce(app_private.check_effective_permission_v1(p_context_id,p_permission,'maintenance',
   case when p_unit_id is not null then 'unit' when p_building_id is not null then 'building' else 'property' end,
   coalesce(p_unit_id,p_building_id,p_property_id)),false);
exception when insufficient_privilege then return false;
end $$;
revoke all on function maintenance.can_read_context_target_v1(uuid,text,uuid,uuid,uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function maintenance.can_read_context_target_v1(uuid,text,uuid,uuid,uuid,uuid) to authenticated,service_role,cladora_rpc_owner;
comment on function maintenance.can_read_context_target_v1(uuid,text,uuid,uuid,uuid,uuid) is
 'Boolean authorization only: verifies caller-owned live context, legacy read permission, exact physical scope and canonical installed-module authority. Cannot read domain rows or expose private permission metadata.';


-- Domain tables stay closed to authenticated. Reuse the existing non-login,
-- non-superuser, non-BYPASSRLS reader role and add only two missing SELECTs.
grant select on maintenance.tickets,maintenance.vendor_payables to cladora_rpc_owner;
grant execute on function maintenance.verify_customer_maintenance_actor(uuid,text,boolean) to cladora_rpc_owner;
create policy maintenance_reader_tickets on maintenance.tickets for select to cladora_rpc_owner
 using(maintenance.can_read_context_target_v1(
 nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,'maintenance.requests.read',tenant_id,property_id,building_id,unit_id));
create policy maintenance_reader_orders on maintenance.work_orders for select to cladora_rpc_owner
 using(maintenance.can_read_context_target_v1(nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,
 'maintenance.requests.read',tenant_id,property_id,building_id,unit_id)
 or maintenance.can_read_context_target_v1(nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,
 'maintenance.work_orders.read',tenant_id,property_id,building_id,unit_id));
create policy maintenance_reader_payables on maintenance.vendor_payables for select to cladora_rpc_owner
 using(exists(select 1 from maintenance.work_orders w
 where w.id=work_order_id and w.tenant_id=vendor_payables.tenant_id));
-- Metadata projections stay subject to the same verified context. A unit may
-- see its own parent building, never siblings or a different property.
create policy maintenance_reader_buildings on portfolio.buildings for select to cladora_rpc_owner
 using(case when nullif(current_setting('cladora.maintenance_read_context_id',true),'') is null then false else
 exists(select 1 from maintenance.verify_customer_maintenance_actor(
 nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,null,true) v
 where buildings.tenant_id=v.tenant_id and (
 maintenance.can_read_context_target_v1(nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,
 'maintenance.requests.read',buildings.tenant_id,buildings.property_id,buildings.id,
 case when v.scope_type='unit' and v.building_id=buildings.id then v.unit_id else null end)
 or maintenance.can_read_context_target_v1(nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,
 'maintenance.work_orders.read',buildings.tenant_id,buildings.property_id,buildings.id,
 case when v.scope_type='unit' and v.building_id=buildings.id then v.unit_id else null end))) end);
create policy maintenance_reader_units on portfolio.units for select to cladora_rpc_owner
 using(exists(select 1 from portfolio.buildings b where b.id=units.building_id and b.tenant_id=units.tenant_id and (
 maintenance.can_read_context_target_v1(nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,
 'maintenance.requests.read',units.tenant_id,b.property_id,b.id,units.id)
 or maintenance.can_read_context_target_v1(nullif(current_setting('cladora.maintenance_read_context_id',true),'')::uuid,
 'maintenance.work_orders.read',units.tenant_id,b.property_id,b.id,units.id))));

create function maintenance.read_scoped_maintenance_v1(
 p_context_id uuid,p_view text,p_status text default null,p_limit integer default 50,p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare v record; result jsonb; res jsonb; v_previous_context text;
begin
 v_previous_context:=current_setting('cladora.maintenance_read_context_id',true);
 if p_view not in ('requests','work_orders','summary') or p_view is null then raise exception 'invalid_query' using errcode='22023'; end if;
 select * into v from maintenance.verify_customer_maintenance_actor(p_context_id,
 case when p_view='work_orders' then 'maintenance.work_orders.read' else 'maintenance.requests.read' end,p_view<>'work_orders');
 -- This GUC carries a verified scope, never changes JWT identity/claims, and is
 -- restored on every normal/error path. Only the non-login reader role uses it.
 perform set_config('cladora.maintenance_read_context_id',p_context_id::text,true);
  if p_view='requests' then

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
    left join maintenance.vendors vnd on vnd.id = t.assigned_vendor_id and vnd.tenant_id = t.tenant_id
    where t.tenant_id = v.tenant_id
      and (p_status is null or t.status::text = p_status)
      and maintenance.can_read_context_target_v1(p_context_id,'maintenance.requests.read',t.tenant_id,t.property_id,t.building_id,t.unit_id)
    order by t.created_at desc
    limit coalesce(p_limit, 50) offset coalesce(p_offset, 0)
  ) r;

  result:=coalesce(result, '[]'::jsonb);
  elsif p_view='work_orders' then

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
    left join maintenance.vendors vnd on vnd.id = w.vendor_id and vnd.tenant_id = w.tenant_id
    left join maintenance.vendor_payables vp on vp.work_order_id = w.id and vp.tenant_id = w.tenant_id
    where w.tenant_id = v.tenant_id
      and (p_status is null or w.status::text = p_status)
      and maintenance.can_read_context_target_v1(p_context_id,'maintenance.work_orders.read',w.tenant_id,w.property_id,w.building_id,w.unit_id)
    order by w.created_at desc
    limit coalesce(p_limit, 50) offset coalesce(p_offset, 0)
  ) r;

  result:=coalesce(result, '[]'::jsonb);
  elsif p_view='summary' then

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
        and maintenance.can_read_context_target_v1(p_context_id,'maintenance.requests.read',w.tenant_id,w.property_id,w.building_id,w.unit_id)
    ),
    'total_payables_count', (
      select count(*) from maintenance.vendor_payables vp
      join maintenance.work_orders pw on pw.id=vp.work_order_id and pw.tenant_id=vp.tenant_id
      where vp.tenant_id = v.tenant_id
        and maintenance.can_read_context_target_v1(p_context_id,'maintenance.requests.read',pw.tenant_id,pw.property_id,pw.building_id,pw.unit_id)
    ),
    'total_payables_amount', (
      select coalesce(sum(vp.total_amount), 0) from maintenance.vendor_payables vp
      join maintenance.work_orders pw on pw.id=vp.work_order_id and pw.tenant_id=vp.tenant_id
      where vp.tenant_id = v.tenant_id
        and maintenance.can_read_context_target_v1(p_context_id,'maintenance.requests.read',pw.tenant_id,pw.property_id,pw.building_id,pw.unit_id)
    )
  )
  into res
  from maintenance.tickets t
  where t.tenant_id = v.tenant_id
    and maintenance.can_read_context_target_v1(p_context_id,'maintenance.requests.read',t.tenant_id,t.property_id,t.building_id,t.unit_id);

  result:=coalesce(res, '{}'::jsonb);
  else raise exception 'invalid_query' using errcode='22023'; end if;
 perform set_config('cladora.maintenance_read_context_id',coalesce(v_previous_context,''),true);
 return result;
exception when others then
 perform set_config('cladora.maintenance_read_context_id',coalesce(v_previous_context,''),true);
 raise;
end $$;
grant create on schema maintenance to cladora_rpc_owner;
alter function maintenance.read_scoped_maintenance_v1(uuid,text,text,integer,integer) owner to cladora_rpc_owner;
revoke create on schema maintenance from cladora_rpc_owner;
revoke all on function maintenance.read_scoped_maintenance_v1(uuid,text,text,integer,integer) from public,anon,authenticated,service_role;
grant execute on function maintenance.read_scoped_maintenance_v1(uuid,text,text,integer,integer) to authenticated,service_role;
comment on function maintenance.read_scoped_maintenance_v1(uuid,text,text,integer,integer) is
 'Bounded read model owned by non-login non-BYPASSRLS role. RLS and row predicates enforce verified explicit RPC context and canonical permission, without requiring custom JWT scope claims. No domain-table grants to authenticated.';
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
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  return maintenance.read_scoped_maintenance_v1(p_context_id,'requests',p_status,p_limit,p_offset);
end;
$$;

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
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  return maintenance.read_scoped_maintenance_v1(p_context_id,'work_orders',p_status,p_limit,p_offset);
end;
$$;

create or replace function customer_api.get_maintenance_summary_v1(
  p_context_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  return maintenance.read_scoped_maintenance_v1(p_context_id,'summary');
end;
$$;


-- CANONICAL RANGE supabase/migrations/20261005122509_maintenance_dashboard_context_authority.sql:2-133
-- Preserve the existing authenticated AAL2/assets-read contract; add canonical target authority.
create or replace function maintenance.get_customer_maintenance(
  p_context_id uuid,p_view text default 'assets',p_query text default null,p_status text default null,p_priority text default null,
  p_from date default null,p_to date default null,p_limit integer default 25,p_offset integer default 0,p_id uuid default null
) returns jsonb language plpgsql stable security definer
set search_path=pg_catalog
as $$
declare v record; v_workspace uuid; v_party uuid; v_resident boolean; v_tenant boolean; v_total bigint; v_rows jsonb; v_summary jsonb; v_detail jsonb;
begin
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501'; end if;
  if p_view is null or p_limit is null or p_offset is null or p_view not in ('assets','components','plans','work_orders','tasks','vendors','sla','costs','history') or p_limit<1 or p_limit>100 or p_offset<0 then raise exception 'invalid_query' using errcode='22023'; end if;
  if p_priority is not null and p_priority not in ('low','normal','high','urgent','emergency') then raise exception 'invalid_priority' using errcode='22023'; end if;
  select g.*,m.id membership_key,m.role_id,r.code role_code,r.name role_name,t.legal_name tenant_name into v
  from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  join identity.roles r on r.id=m.role_id join platform.tenants t on t.id=m.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp());
  if not found then raise exception 'customer_context_access_denied' using errcode='42501'; end if;
  if lower(v.role_code) not in ('association_admin','property_manager','president','censor','owner','tenant_resident') then raise exception 'maintenance_role_denied' using errcode='42501'; end if;
  if not exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id where rp.role_id=v.role_id and rp.effect='allow' and p.code='maintenance.assets.read') then raise exception 'maintenance_permission_required' using errcode='42501'; end if;
  select w.id into v_workspace from platform.customer_workspaces w where w.tenant_id=v.tenant_id and w.lifecycle_status='ACTIVE' order by w.id limit 1;
  if v_workspace is null or not exists(select 1 from platform.workspace_entitlements e where e.customer_workspace_id=v_workspace and e.entitlement_key='module.maintenance'
    and e.valid_from<=statement_timestamp() and (e.valid_until is null or e.valid_until>statement_timestamp())
    and (case when e.override_value_json is not null and e.override_expires_at>statement_timestamp() then e.override_value_json='true'::jsonb else e.boolean_value is true end))
    then raise exception 'maintenance_entitlement_required' using errcode='42501'; end if;
  v_resident:=lower(v.role_code) in ('owner','tenant_resident'); v_tenant:=lower(v.role_code)='tenant_resident';
  if v_resident then
    if v.scope_type<>'unit' then raise exception 'resident_unit_context_required' using errcode='42501'; end if;
    select mp.party_id into v_party from identity.membership_parties mp where mp.membership_id=v.membership_key and mp.tenant_id=v.tenant_id;
    if v_party is null then raise exception 'resident_party_mapping_required' using errcode='42501'; end if;
    if not v_tenant and not exists(select 1 from portfolio.ownerships o where o.tenant_id=v.tenant_id and o.unit_id=v.unit_id and o.party_id=v_party and o.valid_from<=current_date and (o.valid_to is null or o.valid_to>current_date)) then raise exception 'ownership_required' using errcode='42501'; end if;
    if v_tenant and not exists(select 1 from occupancy.leases l where l.tenant_id=v.tenant_id and l.unit_id=v.unit_id and l.tenant_party_id=v_party and l.status='active' and l.starts_on<=current_date and (l.ends_on is null or l.ends_on>current_date)) then raise exception 'active_lease_required' using errcode='42501'; end if;
  end if;

  if p_view='assets' then
    with filtered as (select a.id,a.asset_code,a.name,a.scope,a.condition,a.criticality,a.manufacturer,a.model,right(a.serial_fingerprint,8) serial_suffix,a.installed_on,a.expected_life_months,a.replacement_cost,a.currency,a.status,a.retired_at,
      c.code category_code,c.name category_name,p.name property_name,b.name building_name,u.code unit_code,(select count(*) from assets.asset_documents d where d.asset_id=a.id) document_count,
      (select min(mp.next_due_at) from maintenance.maintenance_plans mp where mp.asset_id=a.id and mp.status='active') next_service_at
      from assets.assets a join assets.asset_categories c on c.id=a.category_id left join portfolio.properties p on p.id=a.property_id left join portfolio.buildings b on b.id=a.building_id left join portfolio.units u on u.id=a.unit_id
      where a.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,a.property_id,a.building_id,a.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when a.unit_id is not null then 'unit' when a.building_id is not null then 'building' else 'property' end,coalesce(a.unit_id,a.building_id,a.property_id)),false)) and (not v_resident or a.unit_id=v.unit_id)
      and (p_id is null or a.id=p_id) and (p_status is null or a.status::text=p_status or a.condition::text=p_status) and (p_query is null or trim(p_query)='' or a.asset_code ilike '%'||trim(p_query)||'%' or a.name ilike '%'||trim(p_query)||'%' or coalesce(c.name,'') ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by criticality desc,name,id limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by criticality desc,name,id),'[]') into v_total,v_rows from page;
  elsif p_view='components' then
    with filtered as (select ac.id,ac.quantity,ac.installed_on,ac.removed_on,pa.id parent_asset_id,pa.asset_code parent_code,pa.name parent_name,ca.id component_asset_id,ca.asset_code component_code,ca.name component_name,ca.condition,ca.status
      from assets.asset_components ac join assets.assets pa on pa.id=ac.parent_asset_id join assets.assets ca on ca.id=ac.component_asset_id
      where ac.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,pa.property_id,pa.building_id,pa.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when pa.unit_id is not null then 'unit' when pa.building_id is not null then 'building' else 'property' end,coalesce(pa.unit_id,pa.building_id,pa.property_id)),false)) and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,ca.property_id,ca.building_id,ca.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when ca.unit_id is not null then 'unit' when ca.building_id is not null then 'building' else 'property' end,coalesce(ca.unit_id,ca.building_id,ca.property_id)),false)) and (not v_resident or pa.unit_id=v.unit_id)
      and (p_id is null or ac.id=p_id) and (p_status is null or ca.status::text=p_status or ca.condition::text=p_status) and (p_query is null or trim(p_query)='' or pa.name ilike '%'||trim(p_query)||'%' or ca.name ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by parent_name,component_name,id limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by parent_name,component_name,id),'[]') into v_total,v_rows from page;
  elsif p_view='plans' then
    with filtered as (select mp.id,mp.name,mp.trigger_type,mp.estimated_duration_minutes,mp.default_priority,mp.next_due_at,mp.last_generated_at,mp.status,a.id asset_id,a.asset_code,a.name asset_name,a.condition,
      (mp.next_due_at is not null and mp.next_due_at<statement_timestamp()) overdue
      from maintenance.maintenance_plans mp join assets.assets a on a.id=mp.asset_id
      where mp.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,a.property_id,a.building_id,a.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when a.unit_id is not null then 'unit' when a.building_id is not null then 'building' else 'property' end,coalesce(a.unit_id,a.building_id,a.property_id)),false)) and (not v_resident or a.unit_id=v.unit_id)
      and (p_id is null or mp.id=p_id) and (p_status is null or mp.status::text=p_status) and (p_priority is null or mp.default_priority::text=p_priority) and (p_from is null or mp.next_due_at::date>=p_from) and (p_to is null or mp.next_due_at::date<=p_to)
      and (p_query is null or trim(p_query)='' or mp.name ilike '%'||trim(p_query)||'%' or a.name ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by next_due_at nulls last,id limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by next_due_at nulls last,id),'[]') into v_total,v_rows from page;
  elsif p_view='work_orders' then
    with filtered as (select w.id,w.work_order_no,w.title,w.description,w.priority,w.status,w.scheduled_start,w.scheduled_end,w.started_at,w.completed_at,w.verified_at,w.completion_summary,w.created_at,
      a.asset_code,a.name asset_name,p.name property_name,b.name building_name,u.code unit_code,mp.name plan_name,
      va.vendor_name,coalesce(sc.cost_totals,'{}'::jsonb) cost_totals,sc.invoice_ids,sc.journal_ids,tw.ticket_no,
      case when w.status not in ('completed','verified','cancelled') and coalesce(w.scheduled_end,w.scheduled_start)<statement_timestamp() then true else false end overdue
      from maintenance.work_orders w left join assets.assets a on a.id=w.asset_id left join maintenance.maintenance_plans mp on mp.id=w.plan_id left join portfolio.properties p on p.id=w.property_id left join portfolio.buildings b on b.id=w.building_id left join portfolio.units u on u.id=w.unit_id
      left join lateral(select pp.legal_name vendor_name from maintenance.work_order_assignments wa join maintenance.vendors mv on mv.id=wa.vendor_id join portfolio.parties pp on pp.id=mv.party_id where wa.work_order_id=w.id order by wa.assigned_at desc limit 1) va on true
      left join lateral(select (select jsonb_object_agg(x.currency,x.total) from (select wc.currency,sum(wc.amount) total from maintenance.work_order_costs wc where wc.work_order_id=w.id group by wc.currency) x) cost_totals,
        (select jsonb_agg(distinct wc.invoice_id) filter(where wc.invoice_id is not null) from maintenance.work_order_costs wc where wc.work_order_id=w.id) invoice_ids,
        (select jsonb_agg(distinct wc.journal_id) filter(where wc.journal_id is not null) from maintenance.work_order_costs wc where wc.work_order_id=w.id) journal_ids) sc on true
      left join lateral(select t.ticket_no from maintenance.ticket_work_orders x join maintenance.tickets t on t.id=x.ticket_id where x.work_order_id=w.id order by t.reported_at desc limit 1) tw on true
      where w.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id)
      and (p_id is null or w.id=p_id) and (p_status is null or w.status::text=p_status) and (p_priority is null or w.priority::text=p_priority) and (p_from is null or w.created_at::date>=p_from) and (p_to is null or w.created_at::date<=p_to)
      and (p_query is null or trim(p_query)='' or w.title ilike '%'||trim(p_query)||'%' or w.work_order_no::text ilike '%'||trim(p_query)||'%' or coalesce(a.name,'') ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by created_at desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by created_at desc,id desc),'[]') into v_total,v_rows from page;
  elsif p_view='tasks' then
    with filtered as (select i.id,i.sequence_no,i.label,i.required,i.completed,i.completed_at,w.id work_order_id,w.work_order_no,w.title work_order_title,w.priority,w.status work_order_status,w.created_at
      from maintenance.work_order_checklist_items i join maintenance.work_orders w on w.id=i.work_order_id
      where i.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id)
      and (p_id is null or i.id=p_id) and (p_status is null or (case when i.completed then 'completed' else 'pending' end)=p_status) and (p_priority is null or w.priority::text=p_priority) and (p_query is null or trim(p_query)='' or i.label ilike '%'||trim(p_query)||'%' or w.title ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by created_at desc,sequence_no,id limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by created_at desc,sequence_no,id),'[]') into v_total,v_rows from page;
  elsif p_view='vendors' then
    with filtered as (select mv.id,mv.status,mv.service_categories,mv.rating,mv.insurance_valid_until,pp.legal_name vendor_name,
      count(distinct wa.work_order_id) filter(where w.id is not null) assigned_work_orders,count(distinct vc.id) active_contracts
      from maintenance.vendors mv join portfolio.parties pp on pp.id=mv.party_id
      left join maintenance.work_order_assignments wa on wa.vendor_id=mv.id and wa.tenant_id=mv.tenant_id left join maintenance.work_orders w on w.id=wa.work_order_id and w.tenant_id=mv.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false))
      left join maintenance.vendor_contracts vc on vc.vendor_id=mv.id and vc.tenant_id=mv.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,vc.property_id,null,null) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when null is not null then 'unit' when null is not null then 'building' else 'property' end,coalesce(null,null,vc.property_id)),false)) and vc.status='active' and vc.starts_on<=current_date and (vc.ends_on is null or vc.ends_on>=current_date)
      where mv.tenant_id=v.tenant_id and (exists(select 1 from maintenance.vendor_contracts x where x.vendor_id=mv.id and x.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,x.property_id,null,null) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when null is not null then 'unit' when null is not null then 'building' else 'property' end,coalesce(null,null,x.property_id)),false)))
        or exists(select 1 from maintenance.work_order_assignments xwa join maintenance.work_orders xw on xw.id=xwa.work_order_id where xwa.vendor_id=mv.id and xwa.tenant_id=mv.tenant_id and xw.tenant_id=mv.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,xw.property_id,xw.building_id,xw.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when xw.unit_id is not null then 'unit' when xw.building_id is not null then 'building' else 'property' end,coalesce(xw.unit_id,xw.building_id,xw.property_id)),false))))
      and (not v_resident or exists(select 1 from maintenance.work_order_assignments xwa join maintenance.work_orders xw on xw.id=xwa.work_order_id where xwa.vendor_id=mv.id and xwa.tenant_id=mv.tenant_id and xw.tenant_id=mv.tenant_id and xw.unit_id=v.unit_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,xw.property_id,xw.building_id,xw.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when xw.unit_id is not null then 'unit' when xw.building_id is not null then 'building' else 'property' end,coalesce(xw.unit_id,xw.building_id,xw.property_id)),false))))
      and (p_id is null or mv.id=p_id) and (p_status is null or mv.status::text=p_status) and (p_query is null or trim(p_query)='' or pp.legal_name ilike '%'||trim(p_query)||'%' or exists(select 1 from unnest(mv.service_categories) s where s ilike '%'||trim(p_query)||'%'))
      group by mv.id,pp.legal_name), page as (select *,count(*) over() total_count from filtered order by vendor_name,id limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by vendor_name,id),'[]') into v_total,v_rows from page;
  elsif p_view='sla' then
    with filtered as (select s.id,s.metric_code,s.target_value,s.actual_value,s.unit_code,s.met,s.measured_at,w.id work_order_id,w.work_order_no,w.title work_order_title,w.priority,w.status,
      case when s.met is false then true else false end breached
      from maintenance.sla_measurements s join maintenance.work_orders w on w.id=s.work_order_id
      where s.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id)
      and (p_id is null or s.id=p_id) and (p_status is null or (case when s.met then 'met' else 'breached' end)=p_status) and (p_priority is null or w.priority::text=p_priority) and (p_from is null or s.measured_at::date>=p_from) and (p_to is null or s.measured_at::date<=p_to)
      and (p_query is null or trim(p_query)='' or s.metric_code ilike '%'||trim(p_query)||'%' or w.title ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by measured_at desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by measured_at desc,id desc),'[]') into v_total,v_rows from page;
  elsif p_view='costs' then
    with filtered as (select wc.id,wc.category_code,wc.description,wc.amount,wc.currency,wc.incurred_on,wc.purchase_order_id,wc.invoice_id,wc.journal_id,wc.allocation_run_id,w.id work_order_id,w.work_order_no,w.title work_order_title
      from maintenance.work_order_costs wc join maintenance.work_orders w on w.id=wc.work_order_id
      where wc.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id)
      and (p_id is null or wc.id=p_id) and (p_status is null or wc.category_code=p_status) and (p_from is null or wc.incurred_on>=p_from) and (p_to is null or wc.incurred_on<=p_to)
      and (p_query is null or trim(p_query)='' or wc.description ilike '%'||trim(p_query)||'%' or w.title ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by incurred_on desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by incurred_on desc,id desc),'[]') into v_total,v_rows from page;
  else
    with filtered as (select h.id,h.event_type,h.reason,h.occurred_at,h.work_order_id,h.ticket_id,a.id asset_id,a.asset_code,a.name asset_name
      from assets.asset_history h join assets.assets a on a.id=h.asset_id
      where h.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,a.property_id,a.building_id,a.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when a.unit_id is not null then 'unit' when a.building_id is not null then 'building' else 'property' end,coalesce(a.unit_id,a.building_id,a.property_id)),false)) and (not v_resident or a.unit_id=v.unit_id)
      and (p_id is null or h.id=p_id) and (p_status is null or h.event_type=p_status) and (p_from is null or h.occurred_at::date>=p_from) and (p_to is null or h.occurred_at::date<=p_to)
      and (p_query is null or trim(p_query)='' or h.event_type ilike '%'||trim(p_query)||'%' or coalesce(h.reason,'') ilike '%'||trim(p_query)||'%' or a.name ilike '%'||trim(p_query)||'%')),
    page as (select *,count(*) over() total_count from filtered order by occurred_at desc,id desc limit p_limit offset p_offset)
    select coalesce(max(total_count),0),coalesce(jsonb_agg(to_jsonb(page)-'total_count' order by occurred_at desc,id desc),'[]') into v_total,v_rows from page;
  end if;

  select jsonb_build_object(
    'assets',(select count(*) from assets.assets a where a.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,a.property_id,a.building_id,a.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when a.unit_id is not null then 'unit' when a.building_id is not null then 'building' else 'property' end,coalesce(a.unit_id,a.building_id,a.property_id)),false)) and (not v_resident or a.unit_id=v.unit_id)),
    'open_work_orders',(select count(*) from maintenance.work_orders w where w.tenant_id=v.tenant_id and w.status in ('draft','scheduled','assigned','in_progress','blocked') and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id)),
    'overdue',(select count(*) from maintenance.work_orders w where w.tenant_id=v.tenant_id and w.status not in ('completed','verified','cancelled') and coalesce(w.scheduled_end,w.scheduled_start)<statement_timestamp() and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id)),
    'cost_total',(select coalesce(jsonb_object_agg(x.currency,x.total),'{}'::jsonb) from (select wc.currency,sum(wc.amount) total from maintenance.work_order_costs wc join maintenance.work_orders w on w.id=wc.work_order_id where wc.tenant_id=v.tenant_id and (maintenance.customer_maintenance_scope_matches(v.scope_type::text,v.property_id,v.building_id,v.unit_id,w.property_id,w.building_id,w.unit_id) and coalesce(app_private.check_effective_permission_v1(p_context_id,'maintenance.assets.read','maintenance',case when w.unit_id is not null then 'unit' when w.building_id is not null then 'building' else 'property' end,coalesce(w.unit_id,w.building_id,w.property_id)),false)) and (not v_resident or w.unit_id=v.unit_id) group by wc.currency) x)
  ) into v_summary;
  if p_id is not null then v_detail:=case when v_total=1 then v_rows->0 else null end; end if;
  return jsonb_build_object('context',jsonb_build_object('id',v.id,'tenant_name',v.tenant_name,'role_code',v.role_code,'scope_type',v.scope_type),'view',p_view,'total',v_total,'rows',v_rows,'summary',v_summary,'detail',v_detail,'limit',p_limit,'offset',p_offset,'read_only',true,'generated_at',statement_timestamp());
end $$;


-- CANONICAL DECLARATION supabase/migrations/20260829004800_customer_assets_maintenance_dashboard.sql / maintenance.customer_maintenance_scope_matches
create or replace function maintenance.customer_maintenance_scope_matches(p_scope text,p_property uuid,p_building uuid,p_unit uuid,target_property uuid,target_building uuid,target_unit uuid)
returns boolean language sql immutable set search_path=pg_catalog
as $$ select case p_scope when 'tenant' then true when 'property' then target_property=p_property when 'building' then target_building=p_building when 'unit' then target_unit=p_unit else false end $$;

-- CANONICAL DECLARATION supabase/migrations/20260906190000_closed_period_ledger_seal.sql / finance.assert_scope_date_not_in_closed_period
create or replace function finance.assert_scope_date_not_in_closed_period(
  p_tenant_id uuid,
  p_property_id uuid,
  p_occurred_on date
)
returns void
language plpgsql
set search_path = finance, platform, extensions, public
as $$
declare
  v_total_matching int;
  v_closed_matching int;
begin
  -- Lock matching periods FOR SHARE until the end of the current transaction.
  -- This shared lock coordinates with close_accounting_period's FOR UPDATE lock:
  -- - If Journal runs first: holds SHARE lock -> Close blocks and waits -> Close unblocks and sees Journal.
  -- - If Close runs first: holds UPDATE lock -> Journal blocks and waits -> Journal unblocks and is rejected.
  with locked_periods as (
    select id, status
    from finance.accounting_periods
    where tenant_id = p_tenant_id
      and (
        (p_property_id is null and property_id is null)
        or
        (p_property_id is not null and (property_id = p_property_id or property_id is null))
      )
      and daterange(starts_on, ends_on, '[]') @> p_occurred_on
    for share
  )
  select count(*),
         count(*) filter (where status = 'closed')
  into v_total_matching, v_closed_matching
  from locked_periods;

  -- Fail-closed if multiple periods match: at most one period may match any journal date
  if v_total_matching > 1 then
    raise exception 'Ambiguous accounting period matching: multiple covering periods found for date %', p_occurred_on
      using errcode = '23P01';
  end if;

  -- Fail-closed if the matching period is closed
  if v_closed_matching > 0 then
    raise exception 'Cannot modify journal or entry in closed accounting period (date: %)', p_occurred_on
      using errcode = '25000';
  end if;
end;
$$;

revoke all on function customer_api.deactivate_workspace_module_v1(uuid, uuid, text, text) from public, anon;
grant execute on function customer_api.deactivate_workspace_module_v1(uuid, uuid, text, text) to authenticated, service_role;

-- 14. Seed Canonically Proven Module Definitions (10 Runtime + 2 Catalog-Only)
insert into platform.module_definitions (
  code, version, name, labels_json, description, category, is_active, lifecycle_status, sensitivity_level, requires_aal2, entitlement_key, published_at
) values
  ('maintenance', 1, 'Maintenance & Work Orders', jsonb_build_object('ro','Mentenanță și Lucrări','en','Maintenance & Work Orders','fa','تعمیرات و نگهداری'), 'Corrective work orders, asset management, and vendor jobs', 'operations', true, 'published', 'standard', false, 'module.maintenance', statement_timestamp());


insert into platform.module_permission_bindings (
  module_definition_id,
  permission_id,
  binding_version,
  permission_mode,
  is_assignable_to_local_role,
  is_delegable,
  requires_aal2,
  lifecycle_status
)
select
  m.id,
  p.id,
  1,
  v.permission_mode,
  true,
  false, -- Cardinal Rule: false in 001B.1
  v.requires_aal2,
  'active'
from (values
  ('maintenance', 'maintenance.requests.read', 'read', false),
  ('maintenance', 'maintenance.requests.create', 'execute', false),
  ('maintenance', 'maintenance.requests.manage', 'manage', false),
  ('maintenance', 'maintenance.requests.assign', 'manage', false),
  ('maintenance', 'maintenance.work_orders.read', 'read', false),
  ('maintenance', 'maintenance.work_orders.manage', 'manage', false),
  ('maintenance', 'maintenance.work_orders.verify', 'manage', false),
  ('maintenance', 'maintenance.procurement.read', 'read', false),
  ('maintenance', 'maintenance.procurement.manage', 'manage', false),
  ('maintenance', 'maintenance.procurement.approve', 'manage', true),
  ('maintenance', 'maintenance.assets.read', 'read', false)
) as v(module_code, permission_code, permission_mode, requires_aal2)
join platform.module_definitions m on m.code = v.module_code and m.lifecycle_status in ('active', 'published')
join identity.permissions p on p.code = v.permission_code
on conflict (module_definition_id, permission_id, binding_version) do nothing;

insert into platform.module_property_profile_compatibilities (module_definition_id, property_profile_id, compatibility_level, reason)
select m.id, p.id,
  case
    when m.code = 'governance' and p.code not in ('residential_condominium', 'residential_complex', 'gated_villa_community', 'mixed_use_estate') then 'review_required'
    else 'compatible'
  end,
  'Standard canonical profile module mapping v1.0'
from platform.module_definitions m
cross join platform.property_profiles p
where m.code='maintenance';


insert into platform.module_operating_model_compatibilities (module_definition_id, operating_model_id, compatibility_level, reason)
select m.id, o.id,
  case
    when m.code = 'governance' and o.code <> 'association_managed' then 'review_required'
    else 'compatible'
  end,
  'Standard canonical operating model module mapping v1.0'
from platform.module_definitions m
cross join platform.operating_models o
where m.code='maintenance';

-- 17. Security & Row Level Security Enforcement
alter table platform.module_definitions enable row level security;
alter table platform.module_dependencies enable row level security;


set local search_path=pg_catalog;
set local lock_timeout='5s';
set local statement_timeout='60s';
select pg_advisory_xact_lock(hashtextextended('cladora.install.v14.operations',235));
do $entry$
begin
 if current_setting('server_version_num')::integer not between 170000 and 179999
  or current_user<>session_user or current_user<>'postgres' or exists(select 1 from pg_roles where rolname=current_user and rolsuper)
  or not has_schema_privilege(current_user,'app_private','USAGE') or not has_schema_privilege(current_user,'app_private','CREATE') or not has_schema_privilege(current_user,'customer_api','USAGE') or not has_schema_privilege(current_user,'customer_api','CREATE')
  or current_setting('cladora.install.target',true) is distinct from 'ryygcqiunqqtfkpkflzf'
  or current_setting('cladora.install.unit',true) is distinct from 'maintenance-procurement'
  or to_regclass('platform.idempotency_keys') is null
  or to_regprocedure('app_private.require_request_session_current_at_v1(timestamp with time zone)') is null
  or to_regprocedure('app_private.resolve_workspace_from_customer_context_v1_at_v1(uuid,boolean,timestamp with time zone)') is null
  or to_regprocedure('app_private.check_effective_permission_v2_at_v1(uuid,text,text,text,uuid,uuid,timestamp with time zone)') is null then
  raise exception 'operations_install_prestate_mismatch' using errcode='55000';
 end if;
 if to_regprocedure('app_private.operations_command_v1(text,uuid,uuid,text,text)') is not null
  or to_regprocedure('customer_api.operations_command_v1(text,uuid,uuid,text,text)') is not null then
  raise exception 'operations_install_reconcile_existing_unit' using errcode='55000';
 end if;
end;
$entry$;
select set_config('cladora.ops.default_acl_before',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]')::text from pg_default_acl d),true);
select set_config('cladora.ops.proc_before',(select jsonb_agg(oid order by oid)::text from pg_proc),true);
select set_config('cladora.ops.roles_before',(select coalesce(jsonb_agg(to_jsonb(m) order by m.oid),'[]')::text from pg_auth_members m),true);
select set_config('cladora.ops.managed_before',(select jsonb_build_object(
 'schemas',(select jsonb_agg(to_jsonb(n) order by n.oid) from pg_namespace n where n.nspname in ('auth','extensions','public')),
 'routines',(select jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,p.prosrc,p.proconfig) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'relations',(select jsonb_agg(jsonb_build_array(r.oid,r.relowner,r.relacl,r.relrowsecurity,r.relforcerowsecurity) order by r.oid) from pg_class r join pg_namespace n on n.oid=r.relnamespace where n.nspname in ('auth','extensions','public')))::text),true);

create function app_private.operations_checkpoint_v1(p_context_id uuid,p_intent jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $checkpoint$
declare c record; v_actor uuid; v_permission text; v_asset uuid; v_scope text; v_scope_id uuid;
 v_checked timestamptz:=clock_timestamp(); v_revision bigint;
begin
 perform app_private.require_request_session_current_at_v1(v_checked);
 if coalesce(auth.jwt()->>'aal','')<>'aal2' then raise exception 'operations_authority_denied' using errcode='42501';end if;
 select * into strict c from app_private.resolve_workspace_from_customer_context_v1_at_v1(p_context_id,true,v_checked);
 v_actor:=auth.uid();
 v_permission:=case when p_intent is null then 'maintenance.work_orders.read'
  when p_intent->>'action'='verify' then 'maintenance.work_orders.verify' else 'maintenance.work_orders.manage' end;
 if p_intent is not null then
  if p_intent->>'action'='save' then v_asset:=(p_intent#>>'{input,asset_id}')::uuid;
  elsif p_intent->>'action'='generate' then
   select asset_id into v_asset from maintenance.maintenance_plans where id=(p_intent->>'target_id')::uuid and tenant_id=c.tenant_id;
  else
   perform maintenance.assert_work_order_authority_v1(p_context_id,(p_intent->>'target_id')::uuid,v_permission);
   select coalesce(unit_id,building_id,property_id),case when unit_id is not null then 'unit' when building_id is not null then 'building' else 'property' end
    into v_scope_id,v_scope from maintenance.work_orders where id=(p_intent->>'target_id')::uuid and tenant_id=c.tenant_id;
  end if;
  if p_intent->>'action' in ('save','generate') then
   select coalesce(unit_id,building_id,property_id),case when unit_id is not null then 'unit' when building_id is not null then 'building' else 'property' end
    into v_scope_id,v_scope from assets.assets where id=v_asset and tenant_id=c.tenant_id and status='active';
  end if;
 else
  select scope_type::text,coalesce(unit_id,building_id,property_id) into v_scope,v_scope_id from identity.context_grants where id=p_context_id and tenant_id=c.tenant_id;
 end if;
 if v_scope_id is null or not coalesce(app_private.check_effective_permission_v2_at_v1(p_context_id,v_permission,'maintenance',v_scope,v_scope_id,c.workspace_id,v_checked),false) then
  raise exception 'operations_authority_denied' using errcode='42501';end if;
 select revision into strict v_revision from app_private.canonical_authority_revision_v1 where singleton;
 return jsonb_build_object('tenant_id',c.tenant_id,'workspace_id',c.workspace_id,'membership_id',c.membership_id,'actor_id',v_actor,'context_id',p_context_id,'role_id',c.role_id,'role_code',c.role_code,'permission',v_permission,'authority_revision',v_revision,'scope',v_scope,'resource_id',v_scope_id);
exception when no_data_found or too_many_rows then
 raise exception 'operations_authority_unavailable' using errcode='55000';
end;
$checkpoint$;
revoke all privileges on function app_private.operations_checkpoint_v1(uuid,jsonb) from public,anon,authenticated,service_role;

create function app_private.operations_command_v1(p_phase text,p_context_id uuid,p_key uuid,p_wire text,p_fingerprint text)
returns jsonb language plpgsql security definer set search_path=pg_catalog
as $command$
declare c jsonb; before_c jsonb; e jsonb; d jsonb; v_key text; existing platform.idempotency_keys%rowtype;
 pending platform.idempotency_keys%rowtype; v_state text; v_result jsonb; v_receipt jsonb;
 v_error text; v_audit bigint; v_outbox uuid; v_workspace uuid; v_actor uuid; v_tenant uuid; v_hash text;
 v_membership uuid; v_binding jsonb; v_action text; v_target uuid; v_status text; v_input_keys text[]; v_allowed text[]; v_result_keys text[]; v_date date;
begin
 if current_setting('transaction_isolation') is distinct from 'read committed' then raise exception 'operations_isolation_unavailable' using errcode='55000';end if;
 if p_phase is null or p_phase not in ('open','lookup','reserve','execute','ack') then raise exception 'invalid_operations_phase' using errcode='22023';end if;
 c:=app_private.operations_checkpoint_v1(p_context_id,null);
 v_actor:=(c->>'actor_id')::uuid;v_workspace:=(c->>'workspace_id')::uuid;v_tenant:=(c->>'tenant_id')::uuid;
 -- Every device/tab for this actor+Workspace shares one command admission lock.
 perform pg_advisory_xact_lock(hashtextextended('operations.actor.v1/'||v_workspace||'/'||v_actor,235));
 perform 1 from platform.customer_workspaces where id=v_workspace and tenant_id=v_tenant for update;
 if c is distinct from app_private.operations_checkpoint_v1(p_context_id,null) then raise exception 'operations_authority_changed' using errcode='40001';end if;
 if (select count(*) from platform.idempotency_keys k where k.tenant_id=v_tenant and k.actor_id=v_actor and starts_with(k.key,'operations.command.v1/'||v_workspace||'/') and k.response_ref->>'acknowledged_at' is null)>1 then
  raise exception 'operations_command_catalog_invariant' using errcode='55000';end if;
 select * into pending from platform.idempotency_keys k
  where k.tenant_id=v_tenant and k.actor_id=v_actor and starts_with(k.key,'operations.command.v1/'||v_workspace||'/')
  and k.response_ref->>'acknowledged_at' is null order by k.key limit 1 for update;
 if p_phase='open' then
  if found then
   -- Disclosure requires current authority for the original command, too.
   e:=(pending.response_ref#>>'{command,wire}')::jsonb;
   before_c:=app_private.operations_checkpoint_v1((e->>'context_id')::uuid,e);
   if before_c-'authority_revision' is distinct from (pending.response_ref->'authority_at_reservation')-'authority_revision' then
    raise exception 'operations_authority_binding_conflict' using errcode='40001';end if;
   -- Return only after current authority for the ORIGINAL tuple; never relabel Context-A as B.
   if before_c is distinct from app_private.operations_checkpoint_v1((e->>'context_id')::uuid,e) then
    raise exception 'operations_authority_changed' using errcode='40001';end if;
   return jsonb_build_object('version',1,'actor_id',v_actor,'context_id',(e->>'context_id')::uuid,'state',case when pending.status_code=102 then 'pending' when pending.status_code=200 then 'committed' else 'rejected' end,'command',pending.response_ref->'command','receipt',pending.response_ref->'receipt');
  end if;
  if c is distinct from app_private.operations_checkpoint_v1(p_context_id,null) then raise exception 'operations_authority_changed' using errcode='40001';end if;
  return jsonb_build_object('version',1,'actor_id',v_actor,'context_id',p_context_id,'state','clear','command',null,'receipt',null);
 end if;
 if p_key is null or p_wire is null or octet_length(p_wire)>24000 or p_fingerprint is null or p_fingerprint!~'^[0-9a-f]{64}$'
  or encode(extensions.digest(convert_to(p_wire,'UTF8'),'sha256'),'hex')<>p_fingerprint then raise exception 'invalid_operations_command' using errcode='22023';end if;
 e:=p_wire::jsonb;d:=e->'input';v_action:=e->>'action';v_target:=(e->>'target_id')::uuid;
 if jsonb_typeof(e) is distinct from 'object' or e->>'version' is distinct from '1'
  or (e->>'context_id')::uuid is distinct from p_context_id or v_target is null
  or v_action is null or v_action not in ('save','generate','issue','start','complete','verify')
  or jsonb_typeof(d) is distinct from 'object' or (d->>'context_id')::uuid is distinct from p_context_id
  or (select array_agg(x order by x) from jsonb_object_keys(e) x)<>array['action','context_id','expected_status','input','target_id','version'] then
  raise exception 'invalid_operations_command' using errcode='22023';end if;
 select array_agg(x order by x) into v_input_keys from jsonb_object_keys(d) x;
 v_allowed:=case v_action when 'save' then array['action','anchor','asset_id','checklist','context_id','enabled','every','id','name','revision','unit','vendor_id']
  when 'generate' then array['action','context_id','due_on','plan_id'] when 'issue' then array['context_id']
  when 'start' then array['context_id','notes'] when 'complete' then array['actual_cost','completion_notes','context_id'] else array['context_id','verification_notes'] end;
 if not v_input_keys<@v_allowed or not v_input_keys@>array['context_id']
  or (v_action='save' and (v_input_keys<>v_allowed or d->>'action'<>'save' or (d->>'id')::uuid is distinct from v_target or e->'expected_status'<>'null'::jsonb))
  or (v_action='generate' and (v_input_keys<>v_allowed or d->>'action'<>'generate' or (d->>'plan_id')::uuid is distinct from v_target or e->'expected_status'<>'null'::jsonb))
  or (v_action in ('issue','start','complete','verify') and (jsonb_typeof(e->'expected_status') is distinct from 'string'
   or (v_action='issue' and e->>'expected_status' not in ('draft','scheduled'))
   or (v_action='start' and e->>'expected_status' not in ('assigned','blocked'))
   or (v_action='complete' and e->>'expected_status'<>'in_progress')
   or (v_action='verify' and e->>'expected_status'<>'completed'))) then raise exception 'invalid_operations_input' using errcode='22023';end if;
 -- Match the real transport ABI independently of Next; direct RPC is never a validation bypass.
 if e->>'context_id' is distinct from p_context_id::text or d->>'context_id' is distinct from p_context_id::text
  or e->>'target_id' is distinct from v_target::text then raise exception 'invalid_operations_canonical_identity' using errcode='22023';end if;
 if v_action='save' then
  if jsonb_typeof(d->'revision') is distinct from 'number' or jsonb_typeof(d->'every') is distinct from 'number'
   or jsonb_typeof(d->'enabled') is distinct from 'boolean' or jsonb_typeof(d->'name') is distinct from 'string'
   or jsonb_typeof(d->'checklist') is distinct from 'array' or jsonb_typeof(d->'unit') is distinct from 'string'
   or jsonb_typeof(d->'asset_id') is distinct from 'string' or jsonb_typeof(d->'vendor_id') is distinct from 'string'
   or jsonb_typeof(d->'anchor') is distinct from 'string' or d->>'id' is distinct from v_target::text then
   raise exception 'invalid_operations_save_shape' using errcode='22023';end if;
  if (d->>'revision')::numeric not between 0 and 2147483646 or trunc((d->>'revision')::numeric)<>(d->>'revision')::numeric
   or (d->>'every')::numeric not between 1 and 120 or trunc((d->>'every')::numeric)<>(d->>'every')::numeric
   or length(d->>'name') not between 1 and 200 or trim(d->>'name') is distinct from d->>'name'
   or d->>'unit' not in ('days','weeks','months','years')
   or d->>'asset_id' !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or d->>'vendor_id' !~ '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$'
   or jsonb_array_length(d->'checklist')>50 or exists(select 1 from jsonb_array_elements(d->'checklist') x where jsonb_typeof(x)<>'string' or length(x#>>'{}') not between 1 and 200 or trim(x#>>'{}') is distinct from x#>>'{}') then
   raise exception 'invalid_operations_save_input' using errcode='22023';end if;
  if starts_with(d->>'name','CLADORA_PM_') then
   if ('{"CLADORA_PM_ELEVATOR":["CLADORA_PM_ELEVATOR_DOORS","CLADORA_PM_ELEVATOR_ALARM","CLADORA_PM_ELEVATOR_REPORT"],"CLADORA_PM_HVAC":["CLADORA_PM_HVAC_FILTER","CLADORA_PM_HVAC_OPERATION"],"CLADORA_PM_CCTV":["CLADORA_PM_CCTV_CAMERAS","CLADORA_PM_CCTV_RECORDING"],"CLADORA_PM_FIRE_SAFETY":["CLADORA_PM_FIRE_ACCESS","CLADORA_PM_FIRE_CONDITION"]}'::jsonb->(d->>'name')) is null or '{"CLADORA_PM_ELEVATOR":["CLADORA_PM_ELEVATOR_DOORS","CLADORA_PM_ELEVATOR_ALARM","CLADORA_PM_ELEVATOR_REPORT"],"CLADORA_PM_HVAC":["CLADORA_PM_HVAC_FILTER","CLADORA_PM_HVAC_OPERATION"],"CLADORA_PM_CCTV":["CLADORA_PM_CCTV_CAMERAS","CLADORA_PM_CCTV_RECORDING"],"CLADORA_PM_FIRE_SAFETY":["CLADORA_PM_FIRE_ACCESS","CLADORA_PM_FIRE_CONDITION"]}'::jsonb->(d->>'name') is distinct from d->'checklist' then
    raise exception 'invalid_operations_template' using errcode='22023';end if;
  elsif exists(select 1 from jsonb_array_elements_text(d->'checklist') x where starts_with(x,'CLADORA_PM_')) then
   raise exception 'invalid_operations_template' using errcode='22023';end if;
 elsif v_action='generate' then
  if jsonb_typeof(d->'due_on') is distinct from 'string' or d->>'plan_id' is distinct from v_target::text then raise exception 'invalid_operations_generate_shape' using errcode='22023';end if;
 elsif v_action='start' then
  if d?'notes' and d->'notes'<>'null'::jsonb and (jsonb_typeof(d->'notes') is distinct from 'string' or length(d->>'notes')>1000 or trim(d->>'notes') is distinct from d->>'notes') then raise exception 'invalid_operations_start_input' using errcode='22023';end if;
 elsif v_action='complete' then
  if jsonb_typeof(d->'completion_notes') is distinct from 'string' or length(d->>'completion_notes') not between 1 and 2000 or trim(d->>'completion_notes') is distinct from d->>'completion_notes' then raise exception 'invalid_operations_complete_input' using errcode='22023';end if;
  if d?'actual_cost' and d->'actual_cost'<>'null'::jsonb then
   if jsonb_typeof(d->'actual_cost') is distinct from 'number' then raise exception 'invalid_operations_complete_input' using errcode='22023';end if;
   if (d->>'actual_cost')::numeric<0 or (d->>'actual_cost')::numeric>9007199254740991 then raise exception 'invalid_operations_complete_input' using errcode='22023';end if;
  end if;
 elsif v_action='verify' then
  if jsonb_typeof(d->'verification_notes') is distinct from 'string' or length(d->>'verification_notes') not between 1 and 2000 or trim(d->>'verification_notes') is distinct from d->>'verification_notes' then raise exception 'invalid_operations_verify_input' using errcode='22023';end if;
 end if;
 if v_action in ('save','generate') then
  begin
   if (case when v_action='save' then d->>'anchor' else d->>'due_on' end)!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'invalid_operations_date' using errcode='22023';end if;
   v_date:=(case when v_action='save' then d->>'anchor' else d->>'due_on' end)::date;
  exception when invalid_datetime_format or datetime_field_overflow then raise exception 'invalid_operations_date' using errcode='22023';
  end;
 end if;
 before_c:=app_private.operations_checkpoint_v1(p_context_id,e);v_membership:=(before_c->>'membership_id')::uuid;
 v_key:='operations.command.v1/'||v_workspace||'/'||p_key;
 perform pg_advisory_xact_lock(hashtextextended('operations.resource.v1/'||v_workspace||'/'||v_target,235));
 if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then raise exception 'operations_authority_changed' using errcode='40001';end if;
 if p_phase in ('reserve','execute') and exists(select 1 from platform.idempotency_keys k where k.tenant_id=v_tenant
  and starts_with(k.key,'operations.command.v1/'||v_workspace||'/') and k.key<>v_key and k.response_ref->>'acknowledged_at' is null
  and (((k.response_ref#>>'{command,wire}')::jsonb->>'target_id')=v_target::text or k.response_ref#>>'{receipt,result,id}'=v_target::text)) then
  raise exception 'operations_resource_unresolved_command' using errcode='40001';end if;
 -- Actor/Workspace/Context/membership/version and exact wire all enter C03 hash.
 select * into existing from platform.idempotency_keys where tenant_id=v_tenant and key=v_key for update;
 v_binding:=case when found then existing.response_ref->'authority_at_reservation' else before_c end;
 if v_binding is null or v_binding-'authority_revision' is distinct from before_c-'authority_revision' then
  raise exception 'operations_authority_binding_conflict' using errcode='40001';end if;
 v_hash:=encode(extensions.digest(convert_to(jsonb_build_object('version',1,'authority_at_reservation',v_binding,'wire',p_wire)::text,'UTF8'),'sha256'),'hex');
 if found then
  if existing.actor_id is distinct from v_actor or existing.request_hash is distinct from v_hash
   or existing.expires_at<=clock_timestamp() or existing.response_ref->'command' is distinct from jsonb_build_object('key',p_key,'wire',p_wire,'fingerprint',p_fingerprint) then
   raise exception 'operations_command_conflict' using errcode='40001';end if;
 elsif p_phase='lookup' then
  if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then raise exception 'operations_authority_changed' using errcode='40001';end if;
  return jsonb_build_object('version',1,'actor_id',v_actor,'context_id',p_context_id,'state','absent','command',jsonb_build_object('key',p_key,'wire',p_wire,'fingerprint',p_fingerprint),'receipt',null);
 elsif p_phase='reserve' then
  if pending.key is not null then raise exception 'operations_unresolved_command' using errcode='40001';end if;
  -- Retention is deliberately no-auto-expiry in this source proposal. Owner policy gate remains explicit.
  insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,response_ref,status_code,expires_at)
  values(v_tenant,v_actor,v_key,v_hash,jsonb_build_object('command',jsonb_build_object('key',p_key,'wire',p_wire,'fingerprint',p_fingerprint),'authority_at_reservation',v_binding,'receipt',null,'acknowledged_at',null),102,'infinity');
  select * into strict existing from platform.idempotency_keys where tenant_id=v_tenant and key=v_key;
 else raise exception 'operations_reservation_required' using errcode='40001';
 end if;
 if p_phase in ('reserve','execute') and pending.key is not null and pending.key<>v_key then raise exception 'operations_unresolved_command' using errcode='40001';end if;
 if p_phase='ack' then
  if existing.status_code not in (200,409) or existing.response_ref->'receipt' is null or existing.response_ref->'receipt'='null'::jsonb then raise exception 'operations_receipt_required' using errcode='40001';end if;
  if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then raise exception 'operations_authority_changed' using errcode='40001';end if;
  update platform.idempotency_keys set response_ref=jsonb_set(response_ref,'{acknowledged_at}',to_jsonb(clock_timestamp())) where tenant_id=v_tenant and key=v_key and response_ref->>'acknowledged_at' is null;
  v_state:='acknowledged';
 elsif existing.status_code in (200,409) then v_state:=case when existing.status_code=200 then 'committed' else 'rejected' end;
 elsif p_phase<>'execute' then v_state:='pending';
 else
  -- A rejected business subtransaction is rolled back before a bounded rejection receipt is stored.
  begin
   -- Transaction-local execution frame inside the existing private C03 row.
   -- A caller cannot authorize this frame by setting a GUC or a JWT claim.
   update platform.idempotency_keys set response_ref=jsonb_set(response_ref,'{running_xid}',to_jsonb(pg_current_xact_id()::text)) where tenant_id=v_tenant and key=v_key;
   if v_action in ('issue','start','complete','verify') then
    select status::text into strict v_status from maintenance.work_orders where id=v_target and tenant_id=v_tenant for update;
    if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then raise exception 'operations_authority_changed' using errcode='40001';end if;
    if v_status is distinct from e->>'expected_status' then raise exception 'operations_prestate_conflict' using errcode='40001';end if;
   end if;
   if v_action='issue' then
    perform 1 from maintenance.vendors v join maintenance.work_orders w on w.vendor_id=v.id
     where w.id=v_target and w.tenant_id=v_tenant and v.tenant_id=v_tenant and v.status='approved' for share of v;
    if not found then raise exception 'operations_recorded_vendor_unavailable' using errcode='22023';end if;
   end if;
   if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then raise exception 'operations_authority_changed' using errcode='40001';end if;
   case v_action
    when 'save' then v_result:=maintenance.save_calendar_plan_v1(p_context_id,v_target,(d->>'revision')::integer,(d->>'asset_id')::uuid,(d->>'vendor_id')::uuid,d->>'name',(d->>'anchor')::date,d->>'unit',(d->>'every')::integer,(d->>'enabled')::boolean,d->'checklist');
    when 'generate' then v_result:=maintenance.generate_calendar_order_v1(p_context_id,v_target,(d->>'due_on')::date);
    when 'issue' then v_result:=customer_api.issue_work_order_v1(p_context_id,v_target,null);
    when 'start' then v_result:=customer_api.start_work_order_v1(p_context_id,v_target,d->>'notes');
    when 'complete' then v_result:=customer_api.complete_work_order_v1(p_context_id,v_target,d->>'completion_notes',(d->>'actual_cost')::numeric);
    when 'verify' then v_result:=customer_api.verify_work_order_v1(p_context_id,v_target,d->>'verification_notes');
   end case;
   if jsonb_typeof(v_result) is distinct from 'object' or jsonb_typeof(v_result->'id') is distinct from 'string' then
    raise exception 'operations_domain_receipt_invariant' using errcode='55000';end if;
   select array_agg(x order by x) into v_result_keys from jsonb_object_keys(v_result) x;
   if (v_action='save' and (v_result_keys is distinct from array['id','revision'] or (v_result->>'id')::uuid is distinct from v_target or jsonb_typeof(v_result->'revision') is distinct from 'number' or (v_result->>'revision')::integer is distinct from (d->>'revision')::integer+1))
    or (v_action='generate' and (jsonb_typeof(v_result->'replayed') is distinct from 'boolean' or not(
     (v_result->'replayed'='true'::jsonb and v_result_keys=array['id','replayed'])
     or (v_result->'replayed'='false'::jsonb and v_result_keys=array['id','replayed','status','work_order_no'] and v_result->>'status'='draft' and jsonb_typeof(v_result->'work_order_no')='number' and (v_result->>'work_order_no')::bigint>0))))
    or (v_action='issue' and (v_result_keys is distinct from array['id','status','vendor_id'] or v_result->>'status' is distinct from 'assigned' or jsonb_typeof(v_result->'vendor_id') is distinct from 'string'))
    or (v_action='start' and (v_result_keys is distinct from array['id','started_at','status'] or v_result->>'status' is distinct from 'in_progress' or jsonb_typeof(v_result->'started_at') is distinct from 'string'))
    or (v_action='complete' and (v_result_keys is distinct from array['completed_at','id','status'] or v_result->>'status' is distinct from 'completed' or jsonb_typeof(v_result->'completed_at') is distinct from 'string'))
    or (v_action='verify' and (v_result_keys is distinct from array['id','status','verified_at'] or v_result->>'status' is distinct from 'verified' or jsonb_typeof(v_result->'verified_at') is distinct from 'string'))
    or (v_action in ('issue','start','complete','verify') and (v_result->>'id')::uuid is distinct from v_target) then
    raise exception 'operations_domain_receipt_invariant' using errcode='55000';end if;
   if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then raise exception 'operations_authority_changed' using errcode='40001';end if;
   insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
    values(v_tenant,v_actor,before_c->>'role_code','OPERATIONS_COMMAND_COMMITTED','operations.command',p_key,'C03 Operations command v1',jsonb_build_object('context_id',p_context_id,'workspace_id',v_workspace,'action',v_action,'target_id',v_target,'fingerprint',p_fingerprint)) returning id into v_audit;
   if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then raise exception 'operations_authority_changed' using errcode='40001';end if;
   insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
    values(v_tenant,'operations.command',p_key,1,'operations.command.committed.v1',jsonb_build_object('key',p_key,'action',v_action,'target_id',v_target,'fingerprint',p_fingerprint)) returning id into v_outbox;
   if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then raise exception 'operations_authority_changed' using errcode='40001';end if;
  exception when sqlstate '22023' or sqlstate '40001' or sqlstate '42501' or sqlstate 'P0002' then
   v_error:=sqlstate;v_result:=null;v_audit:=null;v_outbox:=null;
  end;
  -- Current authority is mandatory for the response too. Denial here rolls back the entire execute attempt.
  if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then raise exception 'operations_authority_changed' using errcode='40001';end if;
  v_receipt:=jsonb_build_object('contract_version','operations-command-receipt.v1','key',p_key,'context_id',p_context_id,'workspace_id',v_workspace,'actor_id',v_actor,'membership_id',v_membership,'authority_revision',(v_binding->>'authority_revision')::bigint,'request_hash',v_hash,'action',v_action,'target_id',v_target,'fingerprint',p_fingerprint,'outcome',case when v_error is null then 'committed' else 'rejected' end,'result',v_result,'error_code',v_error,'audit_event_id',v_audit::text,'outbox_event_id',v_outbox,'recorded_at',clock_timestamp());
  update platform.idempotency_keys set status_code=case when v_error is null then 200 else 409 end,response_ref=jsonb_set(response_ref-'running_xid','{receipt}',v_receipt) where tenant_id=v_tenant and key=v_key;
  select * into strict existing from platform.idempotency_keys where tenant_id=v_tenant and key=v_key;
  v_state:=case when v_error is null then 'committed' else 'rejected' end;
 end if;
 if before_c is distinct from app_private.operations_checkpoint_v1(p_context_id,e) then raise exception 'operations_authority_changed' using errcode='40001';end if;
 return jsonb_build_object('version',1,'actor_id',v_actor,'context_id',p_context_id,'state',v_state,'command',existing.response_ref->'command','receipt',existing.response_ref->'receipt');
end;
$command$;
revoke all privileges on function app_private.operations_command_v1(text,uuid,uuid,text,text) from public,anon,authenticated,service_role;
create function customer_api.operations_command_v1(p_phase text,p_context_id uuid,p_key uuid,p_wire text,p_fingerprint text)
returns jsonb language sql security invoker set search_path=pg_catalog
as $facade$ select app_private.operations_command_v1(p_phase,p_context_id,p_key,p_wire,p_fingerprint) $facade$;
revoke all privileges on function customer_api.operations_command_v1(text,uuid,uuid,text,text) from public,anon,authenticated,service_role;
create function app_private.guard_operations_unresolved_v1()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $guard$
declare r jsonb; v_property uuid; v_tenant uuid; v_workspace uuid; v_actor uuid:=auth.uid(); v_resources text[]; k record;
begin
 if current_setting('transaction_isolation') is distinct from 'read committed' then raise exception 'operations_isolation_unavailable' using errcode='55000';end if;
 r:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 v_tenant:=(r->>'tenant_id')::uuid;
 v_resources:=array[r->>'id',r->>'plan_id',r->>'work_order_id'];
 if tg_table_name='work_orders' then v_property:=(r->>'property_id')::uuid;
 elsif tg_table_name='maintenance_plans' then select property_id into v_property from assets.assets where id=(r->>'asset_id')::uuid and tenant_id=v_tenant;
 else select property_id into v_property from maintenance.work_orders where id=(r->>'work_order_id')::uuid and tenant_id=v_tenant;
 end if;
 perform app_private.require_request_session_current_at_v1(clock_timestamp());
 for v_workspace in select customer_workspace_id from platform.workspace_property_bindings where tenant_id=v_tenant and property_id=v_property and status='active'
  and valid_from<=clock_timestamp() and (valid_to is null or valid_to>clock_timestamp()) loop
  -- Serialize even legacy checklist admission with reservation/ACK; MVCC scan alone is insufficient.
  perform 1 from platform.customer_workspaces where id=v_workspace and tenant_id=v_tenant for update;
  perform app_private.require_request_session_current_at_v1(clock_timestamp());
  for k in select response_ref,status_code from platform.idempotency_keys where tenant_id=v_tenant
   and starts_with(key,'operations.command.v1/'||v_workspace||'/') and response_ref->>'acknowledged_at' is null
   and (actor_id=v_actor or ((response_ref#>>'{command,wire}')::jsonb->>'target_id')=any(v_resources) or response_ref#>>'{receipt,result,id}'=any(v_resources)) loop
   if k.status_code is distinct from 102 or k.response_ref->>'running_xid' is distinct from pg_current_xact_id()::text then
    raise exception 'operations_unresolved_command' using errcode='40001';end if;
  end loop;
 end loop;
 if tg_op='DELETE' then return old;else return new;end if;
end;
$guard$;
revoke all privileges on function app_private.guard_operations_unresolved_v1() from public,anon,authenticated,service_role;
create trigger operations_unresolved_command before insert or update or delete on maintenance.work_orders for each row execute function app_private.guard_operations_unresolved_v1();
create trigger operations_unresolved_command before insert or update or delete on maintenance.maintenance_plans for each row execute function app_private.guard_operations_unresolved_v1();
create trigger operations_unresolved_command before insert or update or delete on maintenance.work_order_checklist_items for each row execute function app_private.guard_operations_unresolved_v1();
-- Legacy direct mutation EXECUTE must not bypass command admission after activation.
revoke all privileges on function customer_api.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb),customer_api.generate_calendar_order_v1(uuid,uuid,date),
 customer_api.issue_work_order_v1(uuid,uuid,uuid),customer_api.start_work_order_v1(uuid,uuid,text),customer_api.complete_work_order_v1(uuid,uuid,text,numeric),customer_api.verify_work_order_v1(uuid,uuid,text),
 maintenance.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb),maintenance.generate_calendar_order_v1(uuid,uuid,date),
 maintenance.issue_work_order(uuid,uuid,uuid),maintenance.start_work_order(uuid,uuid,text),maintenance.complete_work_order(uuid,uuid,text,numeric),maintenance.verify_work_order(uuid,uuid,text)
 from public,anon,authenticated,service_role;
-- No positive runtime grant: installation and activation are separate.
do $final$
begin
 if (select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d) is distinct from current_setting('cladora.ops.default_acl_before')::jsonb then
  raise exception 'operations_default_acl_changed' using errcode='55000';end if;
 if (select coalesce(jsonb_agg(to_jsonb(m) order by m.oid),'[]') from pg_auth_members m) is distinct from current_setting('cladora.ops.roles_before')::jsonb
  or (select count(*) from pg_proc p where not current_setting('cladora.ops.proc_before')::jsonb@>to_jsonb(p.oid))<>4
  or exists(select 1 from pg_proc p where not current_setting('cladora.ops.proc_before')::jsonb@>to_jsonb(p.oid)
   and (p.oid not in ('app_private.operations_checkpoint_v1(uuid,jsonb)'::regprocedure,'app_private.operations_command_v1(text,uuid,uuid,text,text)'::regprocedure,'customer_api.operations_command_v1(text,uuid,uuid,text,text)'::regprocedure,'app_private.guard_operations_unresolved_v1()'::regprocedure)
    or p.proowner<>'postgres'::regrole or p.proconfig is distinct from array['search_path=pg_catalog'])) then
  raise exception 'operations_created_set_or_owner_graph_mismatch' using errcode='55000';end if;
 if (select jsonb_build_object(
 'schemas',(select jsonb_agg(to_jsonb(n) order by n.oid) from pg_namespace n where n.nspname in ('auth','extensions','public')),
 'routines',(select jsonb_agg(jsonb_build_array(p.oid,p.proowner,p.proacl,p.prosrc,p.proconfig) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'relations',(select jsonb_agg(jsonb_build_array(r.oid,r.relowner,r.relacl,r.relrowsecurity,r.relforcerowsecurity) order by r.oid) from pg_class r join pg_namespace n on n.oid=r.relnamespace where n.nspname in ('auth','extensions','public')))) is distinct from current_setting('cladora.ops.managed_before')::jsonb then
 raise exception 'operations_managed_objects_changed' using errcode='55000';end if;
 if exists(select 1 from pg_proc p,lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where p.oid in ('app_private.operations_checkpoint_v1(uuid,jsonb)'::regprocedure,'app_private.operations_command_v1(text,uuid,uuid,text,text)'::regprocedure,'customer_api.operations_command_v1(text,uuid,uuid,text,text)'::regprocedure,'app_private.guard_operations_unresolved_v1()'::regprocedure) and a.grantee<>p.proowner) then
  raise exception 'operations_inactive_acl_not_closed' using errcode='55000';end if;
end;
$final$;

-- OC1: inactive schemas/tables/sequences/functions remain closed before COMMIT.
-- Only the approved F64/F80 nested owner edges survive. No runtime/fixture grant.
do $oc1$
declare r record; s text; begin
 for s in select nspname from pg_namespace where nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') loop
  execute format('revoke all privileges on schema %I from public,anon,authenticated,service_role',s);
  execute format('revoke all privileges on all tables in schema %I from public,anon,authenticated,service_role',s);
  execute format('revoke all privileges on all sequences in schema %I from public,anon,authenticated,service_role',s);
  execute format('revoke all privileges on all functions in schema %I from public,anon,authenticated,service_role',s);
 end loop;
 for r in select n.nspname,t.typname from pg_type t join pg_namespace n on n.oid=t.typnamespace where t.typtype in ('e','d') and n.nspname in ('platform','identity','portfolio','finance','assets','maintenance','utilities','security_access','documents','occupancy','billing','payments','governance','communications') loop
  execute format('revoke all privileges on type %I.%I from public,anon,authenticated,service_role',r.nspname,r.typname);
 end loop;
 for r in select n.nspname,c.relname,a.attname from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where a.attnum>0 and not a.attisdropped and a.attacl is not null and n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') loop
  execute format('revoke select (%I),insert (%I),update (%I),references (%I) on table %I.%I from public,anon,authenticated,service_role',r.attname,r.attname,r.attname,r.attname,r.nspname,r.relname);
 end loop;
 if (select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d) is distinct from current_setting('cladora.install.defaults')::jsonb then
  raise exception 'operations_default_acl_delta' using errcode='55000';end if;
 if (select jsonb_build_object(
 'namespaces',(select jsonb_agg(to_jsonb(n) order by n.oid) from pg_namespace n where n.nspname in ('auth','extensions','public')),
 'relations',(select jsonb_agg(to_jsonb(c) order by c.oid) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'routines',(select jsonb_agg(to_jsonb(p) order by p.oid) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'types',(select jsonb_agg(to_jsonb(t) order by t.oid) from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('auth','extensions','public')))) is distinct from current_setting('cladora.install.managed')::jsonb then
  raise exception 'operations_managed_catalog_delta' using errcode='55000';end if;
 -- Fail closed on unenumerated ACL rather than trusting role names or changing defaults.
 for r in select p.oid,p.proowner,a.grantee,n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace,
  lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>p.proowner loop
  if not(r.nspname='app_private' and ((r.oid='app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure and r.grantee='postgres'::regrole) or (r.oid='app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)'::regprocedure and r.grantee='cladora_rpc_owner'::regrole))) then
   raise exception 'operations_unexpected_routine_acl' using errcode='55000';end if;
 end loop;
 if exists(select 1 from pg_namespace n,lateral aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>n.nspowner and not(n.nspname='app_private' and a.grantee='cladora_rpc_owner'::regrole and a.privilege_type='USAGE' and not a.is_grantable)) then
  raise exception 'operations_unexpected_schema_acl' using errcode='55000';end if;
 if exists(select 1 from pg_attribute x join pg_class c on c.oid=x.attrelid join pg_namespace n on n.oid=c.relnamespace,lateral aclexplode(x.attacl) a where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>c.relowner) then
  raise exception 'operations_unexpected_column_acl' using errcode='55000';end if;
 if exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace,lateral aclexplode(coalesce(t.typacl,acldefault('T',t.typowner))) a where t.typtype in ('e','d') and n.nspname in ('platform','identity','portfolio','finance','assets','maintenance','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>t.typowner) then
  raise exception 'operations_unexpected_type_acl' using errcode='55000';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in ('r','p') and n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and not c.relrowsecurity) then
  raise exception 'operations_table_rls_not_enabled' using errcode='55000';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace,
  lateral aclexplode(coalesce(c.relacl,acldefault(case when c.relkind='S' then 'S'::"char" else 'r'::"char" end,c.relowner))) a
  where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and a.grantee<>c.relowner) then
  raise exception 'operations_unexpected_relation_acl' using errcode='55000';end if;
end; $oc1$;
-- SOURCE CATALOG ASSERTIONS: literal declaration/body identities, not a compiled equivalence claim.
-- Caller/operator/transport binding remains separate; source alone grants no execution permission.
do $source_catalog$
begin
 if exists(
 with source(signature,body_hash,owner_name,secdef,language_name,volatility,is_strict,config,ordinal) as (values
('maintenance.enforce_customer_maintenance_integrity()','14529054fc5fc1cfe4d63d46dfae0fbbe3f165680bd72797dda172cdabf669b4','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, maintenance, portfolio, billing, finance']::text[],0),
('maintenance.enforce_work_order_transition_guards()','bcd12b21b1f01ee80ea5a0aef81c00af14a97b835ac9e5d1e25b8855871a76f3','postgres',false,'plpgsql','v',false,null::text[],1),
('maintenance.verify_customer_maintenance_actor(uuid,text,boolean)','5efd93c88cc1ac24db5fea5b492dc9f85017fc2cc34067fa9e1ec246faae178d','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, maintenance, identity, platform, portfolio']::text[],2),
('maintenance.create_maintenance_request(uuid,uuid,uuid,uuid,text,text,text,text,text,boolean,text,text,text)','bcb736471c47306f58bea984adb0c3d3472ead34c1f6e10a611514280d652b9d','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, portfolio, audit']::text[],3),
('maintenance.triage_maintenance_request(uuid,uuid,text,text,text)','6a60ad644edf3f57d4e83c53ee0d1f5f98b23470f22ccddbae1f97b14df5c81b','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],4),
('maintenance.assign_maintenance_request(uuid,uuid,uuid,text)','71d8ecb8e1d6aa835c110e8ddf935ebd11a7c9e0ecbd78fcf0016b4895cb098d','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],5),
('maintenance.change_maintenance_status(uuid,uuid,text,text,text)','b7b8e59d8999761c8a420323de12b04a35101a1da2f2d9a6008169f168d6a3ff','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],6),
('maintenance.reopen_maintenance_request(uuid,uuid,text)','e5b3841bcdd4491eaa6db824fde46ddd78045c34e48e35137c70b6ac0ac7d44c','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],7),
('maintenance.create_rfq(uuid,uuid,uuid,text,text,date,uuid[])','9459b66fdd924797d8861f31f3b9e12a258f2129457a2411dff5061e8cd4a364','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],8),
('maintenance.submit_quote(uuid,uuid,uuid,text,numeric,numeric,text,date,jsonb,uuid)','b877b7aa266f5e841531bab8233815f30f5ecb4474cbb72f5b9f379727be26a0','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],9),
('maintenance.select_quote(uuid,uuid,text)','f94103feaf7e7550b6ffe1ae9f782c7d82f77f1c87a378c2427548578884f764','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],10),
('maintenance.create_work_order(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz,timestamptz,uuid,numeric,text,text)','546df8ed1474354a3d7950d91f4c8c848e64aa17fda1225fee306013fc8a4008','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, portfolio, audit']::text[],11),
('maintenance.approve_work_order(uuid,uuid,numeric,text)','b152870ee8fb33b73a80923d0c32fc8d33ef136dcc76eb48234e528610251812','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],12),
('maintenance.issue_work_order(uuid,uuid,uuid)','a13734e44b127e59871911c498457ebcb348468db329cee7e4097d358774e447','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],13),
('maintenance.start_work_order(uuid,uuid,text)','7778178b7be6863541c1cdda0efe5df259c6b9b4be7726a9d2eb03231d2f1e7a','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],14),
('maintenance.hold_work_order(uuid,uuid,text)','bc91105bd323c14cb97c27d8f48b58fa332552a2d6b9817d963bb13177239ed5','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],15),
('maintenance.complete_work_order(uuid,uuid,text,numeric)','012d3ae91fcf6e349fff987041a2e5b5d789b55cdd61152f6f21a5e7a746a89a','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],16),
('maintenance.verify_work_order(uuid,uuid,text)','d482a4e0404d957f50a46951cfe5dbab102e074f87ccb1094d99bec53052f3f3','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],17),
('maintenance.close_work_order(uuid,uuid,text)','1a66d344b6a80dcd194a6d84045465584493216816ae752b002d561e327cd81c','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],18),
('maintenance.create_purchase_order(uuid,uuid,uuid,uuid,numeric,numeric,text,text)','f2cbe0b35a99076dd1073e765bab49e352456989980a3e033999e122f7dee1f8','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],19),
('maintenance.approve_purchase_order(uuid,uuid,text)','93374944e35b76b389b0f8cfab580795c583d2729c5bdcc87a4709f47a6cce00','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],20),
('maintenance.issue_purchase_order(uuid,uuid)','2540b348f723d40d7b7fef7f03db67933d379fb6c50ee3ba8c6bdfea0c2dd5c6','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],21),
('maintenance.create_maintenance_payable(uuid,uuid,uuid,text,date,date,numeric,numeric,text,uuid,text)','64bbf0ca4c828d88631e44006d5a06ac8b9cd04401fb2d018b69f43b6ae3a9b0','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, portfolio, finance, audit']::text[],22),
('customer_api.create_maintenance_request_v1(uuid,uuid,uuid,uuid,text,text,text,text,text,boolean,text,text,text)','a4e18259d1e6483ce73efe72397d1f20626aeeebd7ca3db430e46771e6f87f12','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],23),
('customer_api.triage_maintenance_request_v1(uuid,uuid,text,text,text)','91a2d7384d5200e25fca019276a6e3a58807bc5e45389c5cb91424f943223622','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],24),
('customer_api.assign_maintenance_request_v1(uuid,uuid,uuid,text)','abc5c2b2e7647a0ada130a3c06f1ddff67a7462b57038b16ea8e2d8d633c4009','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],25),
('customer_api.change_maintenance_status_v1(uuid,uuid,text,text,text)','79ee798601b72e962f2db8dff55d58459e8f0cf3fe2f36f5c111a2e3f6ecf168','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],26),
('customer_api.reopen_maintenance_request_v1(uuid,uuid,text)','2c652d6b2f018c2c6773c4bb4419fbe1853b939085161fc9df743ef57efc792d','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],27),
('customer_api.create_rfq_v1(uuid,uuid,uuid,text,text,date,uuid[])','9fcabf994b0870cbb1fa093434ce93f55971235c940d20dc4198bbf72ebc7ed7','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],28),
('customer_api.submit_quote_v1(uuid,uuid,uuid,text,numeric,numeric,text,date,jsonb,uuid)','f6706eab1e76ed9f9bc2658aaac9744177de70def295cd23cb31f5e0605a1429','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],29),
('customer_api.select_quote_v1(uuid,uuid,text)','4425df07c9acffea416a71c0867d969e30963362372ca845fac03fb38fde4359','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],30),
('customer_api.create_work_order_v1(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz,timestamptz,uuid,numeric,text,text)','5ca9c368c1733c20e65f056ce773dc37ac3372d3d7695ddea652e4bbf70670c1','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],31),
('customer_api.approve_work_order_v1(uuid,uuid,numeric,text)','4e6239db3c020989cc998962ec6662a1428aa375bdc87a12551530cded8d528f','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],32),
('customer_api.issue_work_order_v1(uuid,uuid,uuid)','c37d82018c4e2be6b562a3607130a6db8aa7f72904682a03e6d084a1d2054eb7','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],33),
('customer_api.start_work_order_v1(uuid,uuid,text)','fdbd8f80a1d4c99e8832307003d0021188ab22342acc43debec560d8c6ed001f','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],34),
('customer_api.hold_work_order_v1(uuid,uuid,text)','4e5c69e9ea5906bc8543d9f2525f613f47e1145f9624c227e758d8e7dad77d7b','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],35),
('customer_api.complete_work_order_v1(uuid,uuid,text,numeric)','4b1596f120c82ed07bf0da09371477fcf1fffc65478f3bd40afe65d5a78e30b3','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],36),
('customer_api.verify_work_order_v1(uuid,uuid,text)','032baed1dd9c16c8103ef9f3a1f3b75dfc46edde9e282608433ae440d4639369','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],37),
('customer_api.close_work_order_v1(uuid,uuid,text)','d60f3e36bafbb2e4eca1aefeeb4963de027ae7d8afbf1962b9df8fbdb4a273b1','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],38),
('customer_api.create_purchase_order_v1(uuid,uuid,uuid,uuid,numeric,numeric,text,text)','57136314847db000e16bebe379bcbc20cd8178ee786f2aca36c2fb65dda3247b','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],39),
('customer_api.approve_purchase_order_v1(uuid,uuid,text)','4abd66154fd78fb299e59a7189a82a19fc45da5b34a09413c2a2d187306be902','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],40),
('customer_api.issue_purchase_order_v1(uuid,uuid)','eb3930564861eaa51d35b9ff138beff3c6ae1fd3c6deec295e4dabe9150d4c68','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],41),
('customer_api.create_maintenance_payable_v1(uuid,uuid,uuid,text,date,date,numeric,numeric,text,uuid,text)','6e3baf51aff38c3e9560bd841667ffce5701962821fdf00055e6943d7bc27a9a','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],42),
('customer_api.list_maintenance_requests_v1(uuid,text,int,int)','06878aa82db95cdd9c06ff147ea8d63a4d9c4933507d93f95aca8c10e7620fba','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],43),
('customer_api.list_work_orders_v1(uuid,text,int,int)','1884a7e925be90ea72d4b4fb3aa0119f98997a34ec385e88c614d9b645c9fdde','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],44),
('customer_api.get_maintenance_summary_v1(uuid)','40ee3f750ca171243d91b19950250f38412381a74067ce2ebe441cb56c14ec73','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],45),
('maintenance.calendar_due_v1(date,text,integer,integer)','90fb1f961d3d5bf31e3c49731df1dbfd4f29bae59d8195cee1d400d01ee5336c','postgres',false,'plpgsql','i',false,array['search_path=pg_catalog']::text[],46),
('maintenance.plan_asset_allowed_v1(uuid,uuid,text)','da62993fce4035e5364c2c2ebf5a64fcf9a62159511bd3f46fe4296c1e36d008','postgres',true,'sql','s',false,array['search_path=pg_catalog']::text[],47),
('maintenance.list_calendar_plans_v1(uuid)','76ccc3a26b062d995241fe41fa3bf98c77b52ae2111b2856dd5d784640959351','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],48),
('maintenance.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb)','d27b9db7bd435db2dc5e56d20c8bf90185a7d608800f97f5b45303079d858aee','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],49),
('maintenance.generate_calendar_order_v1(uuid,uuid,date)','a747d93ed58b7747341a10be303908d197bfd1ff5f4282039f2422fb1f3092e8','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],50),
('customer_api.list_calendar_plans_v1(uuid)','9a15a8ab1736df6add9b488e5cb1c138e83228a580d7c6d6e6f2325d3e1992e9','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],51),
('customer_api.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb)','2c63e0b8b7a42c64b221d698901b607e7a0bb1d7d02b7b0850bc8def65816d09','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],52),
('customer_api.generate_calendar_order_v1(uuid,uuid,date)','bf28bcd70e0564cca17ae498d8415dcbed6592f97e1badb6d7a741b19cf8d271','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],53),
('maintenance.list_calendar_plans_v1(uuid)','0702cbaf2bbecf0823252045a93f38a2e8c507deefa1e8604e6716a3299b4220','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],54),
('maintenance.contractor_actor_v1(uuid,text)','040e066a1499657240d3e1b6c25ceda287c3cadb3104e65ec1326d4f0a5f9161','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],55),
('maintenance.list_contractors_v1(uuid)','b49787807af768bb57c6218f242bc0156cf96f5deaaf505a5cc588fe4408dd0e','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],56),
('maintenance.register_contractor_v1(uuid,uuid,text,text)','33159166ecb28bb65adbaf292a08973fa5d6d32a7cb70b38c535d98fced3b6c4','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],57),
('maintenance.approve_contractor_v1(uuid,uuid,text)','00336012044cad8fc7920afe6216f66a91329b9711b3e6e42724a58237628a19','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],58),
('customer_api.list_contractors_v1(uuid)','ca9bfd85382d83cb9ea24ec738da8817255a5d1dab3a4eed74bc3f6384a1d9bf','postgres',false,'sql','s',false,array['search_path=pg_catalog']::text[],59),
('customer_api.register_contractor_v1(uuid,uuid,text,text)','b7286c8832fb362b896c9fcfcdc5df061ccdb433113a75dfff5af3f70d7be55f','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],60),
('customer_api.approve_contractor_v1(uuid,uuid,text)','c086b5f7e5165c9aeb594aef3d0d8c7851acacaac431ecaf652f4582991fb1f1','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],61),
('maintenance.work_order_checklist_v1(uuid,uuid,uuid,text)','f95999f78c7173ed54c346e018e9729b1de30f2da35caf1496775b5c181b8ab3','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],62),
('customer_api.work_order_checklist_v1(uuid,uuid,uuid,text)','932a4c212063f63f7a05dde5c0f0ea95c22c1235910989a1b3af92579875562c','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],63),
('maintenance.assert_work_order_authority_v1(uuid,uuid,text)','7172222d58500b1f2257a230d36c93bfec997c4adfdec0bedebda380f8884d22','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],64),
('maintenance.approve_work_order(uuid,uuid,numeric,text)','7fd0d8ba8c7b562b0b24d8ed5f255f08ca8b221666b5e6400b685221fb9b2e0e','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],65),
('maintenance.issue_work_order(uuid,uuid,uuid)','2f34461e86ec493ad29db55b5ae05a9df0a4c7ecf7f7b94b91067c94a67f9552','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],66),
('maintenance.start_work_order(uuid,uuid,text)','6d6ac9726fb9c39cbe85a6aae4044b54c4a32f7c33c08c274cec4a5ddb7f060c','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],67),
('maintenance.hold_work_order(uuid,uuid,text)','851697ef93d0c210abcd91d3a988a76bdf8cab9d42f7405608e220dadce35bf5','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],68),
('maintenance.complete_work_order(uuid,uuid,text,numeric)','7452528d6cd6a1eebc9bccc8490efb82aa65a952479c0425c2e3d8d0eb9fb82a','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],69),
('maintenance.verify_work_order(uuid,uuid,text)','bd1ac78ce71f277e8aa2d9850f59874333df43f128b5284199d97c9ec3fe3011','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],70),
('maintenance.close_work_order(uuid,uuid,text)','593946ae32a35f2b431d6e8df96bdc244d818786d48d62134ae57a90e2d2532b','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, maintenance, identity, platform, audit']::text[],71),
('maintenance.can_read_context_target_v1(uuid,text,uuid,uuid,uuid,uuid)','0073dc3638095b93539388608fceef1d8140383efecfaedfd4b0a4db3f4492dd','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],72),
('maintenance.read_scoped_maintenance_v1(uuid,text,text,integer,integer)','9129e7a0a0c8c73cca4b34eacef76641492dc90387040a784a41140567af3b2c','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],73),
('customer_api.list_maintenance_requests_v1(uuid,text,int,int)','5745a5e32dfd21576332534157d0582e51ab90356002d3a737a063d07348e650','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],74),
('customer_api.list_work_orders_v1(uuid,text,int,int)','7e88b299ab6c9f788ae7f4c755d23fac54c594bf3387f5ec483148506677bd97','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],75),
('customer_api.get_maintenance_summary_v1(uuid)','c70e5a73380936d29d1800a9bd80dfc84dd56aa75ac0829a485772280bdb37a7','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],76),
('maintenance.get_customer_maintenance(uuid,text,text,text,text,date,date,integer,integer,uuid)','4e946543b937e5b4b18df968eeb09dfc44f4f635200b73e9799dbe656671040a','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],77),
('maintenance.customer_maintenance_scope_matches(text,uuid,uuid,uuid,uuid,uuid,uuid)','1e1c566669721c3733c768ea9de4a7ddb7aaeeccc3f1c0c238cdf0b02a02058c','postgres',false,'sql','i',false,array['search_path=pg_catalog']::text[],78),
('finance.assert_scope_date_not_in_closed_period(uuid,uuid,date)','4c79baef1f8f2eac9fe6db20acd789308601a5a1e94a53ed9fe88d9b695f81ee','postgres',false,'plpgsql','v',false,array['search_path=finance, platform, extensions, public']::text[],79),
('app_private.operations_checkpoint_v1(uuid,jsonb)','4dfcdcae09c7545a3f7fd181fcde131cef9dff220fa6b341e1ba7050e525c706','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],80),
('app_private.operations_command_v1(text,uuid,uuid,text,text)','396f758089ec9cea4503b1797bdc2a38dc6b59c2d30bdcaa5ec82550fcd9071d','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],81),
('customer_api.operations_command_v1(text,uuid,uuid,text,text)','7f59066e0b4b4e14bbf2b21166afec7910b1d16c34220c8913dcfa691b90728d','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],82),
('app_private.guard_operations_unresolved_v1()','857e75c373e2a2cf34ef350dcea4bc70c0099153860b0c44c2cdf26615337c82','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],83)), expected as (
 select distinct on(to_regprocedure(signature)) * from source order by to_regprocedure(signature),ordinal desc
 ) select 1 from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature) left join pg_language l on l.oid=p.prolang
 where p.oid is null or p.prokind<>'f' or p.proowner<>to_regrole(e.owner_name) or p.prosecdef is distinct from e.secdef
 or p.provolatile::text is distinct from e.volatility or p.proisstrict is distinct from e.is_strict
 or l.lanname is distinct from e.language_name or p.proconfig is distinct from e.config
 or encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex') is distinct from e.body_hash) then
 raise exception 'operations_routine_catalog_identity_mismatch' using errcode='55000';end if;
 if to_regclass('maintenance.approval_records') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.plan_occurrences') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.rfqs') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.ticket_status_history') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('maintenance.vendor_payables') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and p.oid not in (select to_regprocedure(x) from unnest(array['app_private.require_building_session_current_v1()','app_private.set_updated_at()','finance.protect_accounting_period()','finance.assert_accounting_period_no_overlap()','finance.assert_accounting_period_property_tenant()','app_private.guard_taxonomy_version_effective_period_v1()','app_private.guard_taxonomy_record_immutability_v1()','app_private.guard_workspace_taxonomy_assignment_history_v1()','app_private.guard_workspace_property_binding_history_v1()','app_private.guard_workspace_property_binding_v1()','app_private.guard_workspace_taxonomy_assignment_v1()','app_private.bootstrap_role_taxonomy_permissions_v1()','app_private.bootstrap_role_module_permissions_v1()','app_private.guard_module_definition_immutability_v1()','app_private.guard_module_definition_effective_period_v1()','app_private.guard_workspace_module_code_sync_v1()','app_private.guard_workspace_module_immutability_v1()','app_private.bootstrap_role_workspace_role_permissions_v1()','app_private.guard_module_permission_binding_invariants_v1()','app_private.guard_workspace_role_immutability_v1()','app_private.guard_workspace_role_module_draft_only_v1()','app_private.guard_workspace_role_permission_bindings_v1()','app_private.guard_workspace_member_role_invariants_v1()','app_private.bootstrap_role_workspace_delegation_permissions_v1()','platform.cap_customer_membership_to_access_basis()','platform.cap_customer_context_to_membership()','platform.require_workspace_access_basis_for_provisioning()','app_private.guard_undefined_primary_role_v1()','app_private.guard_workspace_role_authority_source_immutable_v1()','app_private.guard_authority_revision_v1()','app_private.bump_canonical_authority_revision_v1()','app_private.guard_jurisdiction_bound_property_address_v1()','app_private.resolve_workspace_from_customer_context_v1(uuid,boolean)','platform.assert_workspace_activation_ready(uuid)','app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)','app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)','app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)','app_private.customer_mfa_required()','platform.enforce_workspace_activation_gate()','app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)','app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])','app_private.guard_workspace_member_role_authority_v2()','app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid)','app_private.resolve_workspace_native_context_v2(uuid,uuid)','app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid)','app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)','app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)','app_private.jwt_uuid(text)','app_private.active_tenant_id()','app_private.active_context_id()','app_private.is_service_role()','app_private.is_active_member(uuid)','app_private.active_membership_id()','app_private.can_access_property(uuid)','app_private.can_access_building(uuid)','app_private.can_access_unit(uuid)','app_private.can_access_utility_scope(uuid,uuid,uuid)','utilities.protect_validated_reading()','app_private.can_access_asset_scope(uuid,uuid,uuid)','maintenance.enforce_work_order_transition()','maintenance.protect_purchase_order()','documents.protect_document_version()','app_private.check_direct_effective_permission_v1(uuid,uuid,text,text,text,uuid)','app_private.check_effective_permission_v1(uuid,text,text,text,uuid)','finance.assert_allocation_balanced(uuid)','finance.protect_allocation_run()','billing.protect_issued_invoice()','governance.protect_closed_vote()','governance.protect_vote_option()','app_private.current_platform_user_id()','app_private.has_platform_role(platform.platform_role_type)','app_private.is_platform_user()','app_private.has_platform_access_for_routing()','customer_api.has_platform_access_v1()','platform.my_customer_mfa_requirement()','platform.list_my_customer_contexts()','platform.get_customer_dashboard(uuid)','customer_api.get_dashboard_v1(uuid)','customer_api.list_contexts_v1()','customer_api.my_mfa_requirement_v1()','app_private.can_access_channel(uuid)','communications.enforce_poll_response()','customer_api.list_my_unit_invitations_v1()','app_private.has_multi_unit_owner_role_v1()','customer_api.my_multi_unit_owner_access_v1()','assets.enforce_asset_domain_integrity()','assets.check_asset_caller_v1(uuid,text,boolean)','assets.list_assets_internal_v1(uuid,uuid,uuid,uuid,text,text,text,text,boolean,text,integer,integer)','customer_api.list_assets_v1(uuid,uuid,uuid,uuid,text,text,text,text,boolean,text,integer,integer)','assets.get_asset_detail_internal_v1(uuid,uuid)','customer_api.get_asset_detail_v1(uuid,uuid)','assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','customer_api.create_asset_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','assets.update_asset_internal_v1(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,integer,numeric)','customer_api.update_asset_v1(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,integer,numeric)','assets.transition_asset_lifecycle_internal_v1(uuid,uuid,text,text)','customer_api.transition_asset_lifecycle_v1(uuid,uuid,text,text)','assets.update_asset_operational_status_internal_v1(uuid,uuid,text,text,text)','customer_api.update_asset_operational_status_v1(uuid,uuid,text,text,text)','assets.start_asset_downtime_internal_v1(uuid,uuid,text,boolean,uuid,uuid,timestamptz)','customer_api.start_asset_downtime_v1(uuid,uuid,text,boolean,uuid,uuid,timestamptz)','assets.end_asset_downtime_internal_v1(uuid,uuid,timestamptz,text)','customer_api.end_asset_downtime_v1(uuid,uuid,timestamptz,text)','assets.list_asset_inspections_internal_v1(uuid,uuid)','customer_api.list_asset_inspections_v1(uuid,uuid)','assets.record_asset_inspection_internal_v1(uuid,uuid,text,date,timestamptz,text,text,uuid,text,text,uuid,uuid)','customer_api.record_asset_inspection_v1(uuid,uuid,text,date,timestamptz,text,text,uuid,text,text,uuid,uuid)','assets.verify_asset_inspection_internal_v1(uuid,uuid)','customer_api.verify_asset_inspection_v1(uuid,uuid)','assets.get_asset_warranty_internal_v1(uuid,uuid)','customer_api.get_asset_warranty_v1(uuid,uuid)','assets.upsert_asset_warranty_internal_v1(uuid,uuid,date,date,uuid,jsonb,text,uuid)','customer_api.upsert_asset_warranty_v1(uuid,uuid,date,date,uuid,jsonb,text,uuid)','assets.list_warranty_claims_internal_v1(uuid,uuid)','customer_api.list_warranty_claims_v1(uuid,uuid)','assets.create_warranty_claim_internal_v1(uuid,uuid,text,text,date,uuid)','customer_api.create_warranty_claim_v1(uuid,uuid,text,text,date,uuid)','assets.resolve_warranty_claim_internal_v1(uuid,uuid,text,text)','customer_api.resolve_warranty_claim_v1(uuid,uuid,text,text)','assets.list_compliance_policies_internal_v1(uuid,text)','customer_api.list_compliance_policies_v1(uuid,text)','assets.configure_compliance_policy_internal_v1(uuid,text,text,integer,text,date,date,uuid,boolean,text)','customer_api.configure_compliance_policy_v1(uuid,text,text,integer,text,date,date,uuid,boolean,text)','assets.request_asset_decommission_internal_v1(uuid,uuid,text,uuid)','customer_api.request_asset_decommission_v1(uuid,uuid,text,uuid)','assets.approve_asset_decommission_internal_v1(uuid,uuid,boolean,text)','customer_api.approve_asset_decommission_v1(uuid,uuid,boolean,text)','assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','assets.registration_context_v1(uuid)','assets.registration_choices_v1(uuid)','customer_api.get_asset_registration_choices_v1(uuid)','assets.register_equipment_v1(uuid,uuid,uuid,text,text,text)','customer_api.register_equipment_v1(uuid,uuid,uuid,text,text,text)','assets.check_asset_caller_v1(uuid,text,boolean)','assets.list_assets_internal_v1(uuid,uuid,uuid,uuid,text,text,text,text,boolean,text,integer,integer)','assets.get_asset_detail_internal_v1(uuid,uuid)','assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','assets.update_asset_internal_v1(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,integer,numeric)','assets.transition_asset_lifecycle_internal_v1(uuid,uuid,text,text)','assets.update_asset_operational_status_internal_v1(uuid,uuid,text,text,text)','assets.start_asset_downtime_internal_v1(uuid,uuid,text,boolean,uuid,uuid,timestamp with time zone)','assets.end_asset_downtime_internal_v1(uuid,uuid,timestamp with time zone,text)','assets.list_asset_inspections_internal_v1(uuid,uuid)','assets.record_asset_inspection_internal_v1(uuid,uuid,text,date,timestamp with time zone,text,text,uuid,text,text,uuid,uuid)','assets.verify_asset_inspection_internal_v1(uuid,uuid)','assets.get_asset_warranty_internal_v1(uuid,uuid)','assets.upsert_asset_warranty_internal_v1(uuid,uuid,date,date,uuid,jsonb,text,uuid)','assets.list_warranty_claims_internal_v1(uuid,uuid)','assets.create_warranty_claim_internal_v1(uuid,uuid,text,text,date,uuid)','assets.resolve_warranty_claim_internal_v1(uuid,uuid,text,text)','assets.list_compliance_policies_internal_v1(uuid,text)','assets.configure_compliance_policy_internal_v1(uuid,text,text,integer,text,date,date,uuid,boolean,text)','assets.request_asset_decommission_internal_v1(uuid,uuid,text,uuid)','assets.approve_asset_decommission_internal_v1(uuid,uuid,boolean,text)','assets.registration_context_v1(uuid)','assets.registration_choices_v1(uuid)','assets.register_equipment_v1(uuid,uuid,uuid,text,text,text)','assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','maintenance.enforce_customer_maintenance_integrity()','maintenance.enforce_work_order_transition_guards()','maintenance.verify_customer_maintenance_actor(uuid,text,boolean)','maintenance.create_maintenance_request(uuid,uuid,uuid,uuid,text,text,text,text,text,boolean,text,text,text)','maintenance.triage_maintenance_request(uuid,uuid,text,text,text)','maintenance.assign_maintenance_request(uuid,uuid,uuid,text)','maintenance.change_maintenance_status(uuid,uuid,text,text,text)','maintenance.reopen_maintenance_request(uuid,uuid,text)','maintenance.create_rfq(uuid,uuid,uuid,text,text,date,uuid[])','maintenance.submit_quote(uuid,uuid,uuid,text,numeric,numeric,text,date,jsonb,uuid)','maintenance.select_quote(uuid,uuid,text)','maintenance.create_work_order(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz,timestamptz,uuid,numeric,text,text)','maintenance.approve_work_order(uuid,uuid,numeric,text)','maintenance.issue_work_order(uuid,uuid,uuid)','maintenance.start_work_order(uuid,uuid,text)','maintenance.hold_work_order(uuid,uuid,text)','maintenance.complete_work_order(uuid,uuid,text,numeric)','maintenance.verify_work_order(uuid,uuid,text)','maintenance.close_work_order(uuid,uuid,text)','maintenance.create_purchase_order(uuid,uuid,uuid,uuid,numeric,numeric,text,text)','maintenance.approve_purchase_order(uuid,uuid,text)','maintenance.issue_purchase_order(uuid,uuid)','maintenance.create_maintenance_payable(uuid,uuid,uuid,text,date,date,numeric,numeric,text,uuid,text)','customer_api.create_maintenance_request_v1(uuid,uuid,uuid,uuid,text,text,text,text,text,boolean,text,text,text)','customer_api.triage_maintenance_request_v1(uuid,uuid,text,text,text)','customer_api.assign_maintenance_request_v1(uuid,uuid,uuid,text)','customer_api.change_maintenance_status_v1(uuid,uuid,text,text,text)','customer_api.reopen_maintenance_request_v1(uuid,uuid,text)','customer_api.create_rfq_v1(uuid,uuid,uuid,text,text,date,uuid[])','customer_api.submit_quote_v1(uuid,uuid,uuid,text,numeric,numeric,text,date,jsonb,uuid)','customer_api.select_quote_v1(uuid,uuid,text)','customer_api.create_work_order_v1(uuid,uuid,uuid,uuid,uuid,uuid,text,text,text,timestamptz,timestamptz,uuid,numeric,text,text)','customer_api.approve_work_order_v1(uuid,uuid,numeric,text)','customer_api.issue_work_order_v1(uuid,uuid,uuid)','customer_api.start_work_order_v1(uuid,uuid,text)','customer_api.hold_work_order_v1(uuid,uuid,text)','customer_api.complete_work_order_v1(uuid,uuid,text,numeric)','customer_api.verify_work_order_v1(uuid,uuid,text)','customer_api.close_work_order_v1(uuid,uuid,text)','customer_api.create_purchase_order_v1(uuid,uuid,uuid,uuid,numeric,numeric,text,text)','customer_api.approve_purchase_order_v1(uuid,uuid,text)','customer_api.issue_purchase_order_v1(uuid,uuid)','customer_api.create_maintenance_payable_v1(uuid,uuid,uuid,text,date,date,numeric,numeric,text,uuid,text)','customer_api.list_maintenance_requests_v1(uuid,text,int,int)','customer_api.list_work_orders_v1(uuid,text,int,int)','customer_api.get_maintenance_summary_v1(uuid)','maintenance.calendar_due_v1(date,text,integer,integer)','maintenance.plan_asset_allowed_v1(uuid,uuid,text)','maintenance.list_calendar_plans_v1(uuid)','maintenance.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb)','maintenance.generate_calendar_order_v1(uuid,uuid,date)','customer_api.list_calendar_plans_v1(uuid)','customer_api.save_calendar_plan_v1(uuid,uuid,integer,uuid,uuid,text,date,text,integer,boolean,jsonb)','customer_api.generate_calendar_order_v1(uuid,uuid,date)','maintenance.list_calendar_plans_v1(uuid)','maintenance.contractor_actor_v1(uuid,text)','maintenance.list_contractors_v1(uuid)','maintenance.register_contractor_v1(uuid,uuid,text,text)','maintenance.approve_contractor_v1(uuid,uuid,text)','customer_api.list_contractors_v1(uuid)','customer_api.register_contractor_v1(uuid,uuid,text,text)','customer_api.approve_contractor_v1(uuid,uuid,text)','maintenance.work_order_checklist_v1(uuid,uuid,uuid,text)','customer_api.work_order_checklist_v1(uuid,uuid,uuid,text)','maintenance.assert_work_order_authority_v1(uuid,uuid,text)','maintenance.approve_work_order(uuid,uuid,numeric,text)','maintenance.issue_work_order(uuid,uuid,uuid)','maintenance.start_work_order(uuid,uuid,text)','maintenance.hold_work_order(uuid,uuid,text)','maintenance.complete_work_order(uuid,uuid,text,numeric)','maintenance.verify_work_order(uuid,uuid,text)','maintenance.close_work_order(uuid,uuid,text)','maintenance.can_read_context_target_v1(uuid,text,uuid,uuid,uuid,uuid)','maintenance.read_scoped_maintenance_v1(uuid,text,text,integer,integer)','customer_api.list_maintenance_requests_v1(uuid,text,int,int)','customer_api.list_work_orders_v1(uuid,text,int,int)','customer_api.get_maintenance_summary_v1(uuid)','maintenance.get_customer_maintenance(uuid,text,text,text,text,date,date,integer,integer,uuid)','maintenance.customer_maintenance_scope_matches(text,uuid,uuid,uuid,uuid,uuid,uuid)','finance.assert_scope_date_not_in_closed_period(uuid,uuid,date)','app_private.operations_checkpoint_v1(uuid,jsonb)','app_private.operations_command_v1(text,uuid,uuid,text,text)','customer_api.operations_command_v1(text,uuid,uuid,text,text)','app_private.guard_operations_unresolved_v1()']) x where to_regprocedure(x) is not null)) then raise exception 'operations_unexpected_routine_effect' using errcode='55000';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and c.relkind in ('r','p') and c.oid not in (select to_regclass(x) from unnest(array['app_private.canonical_authority_revision_v1','assets.asset_categories','assets.asset_components','assets.asset_decommission_requests','assets.asset_documents','assets.asset_downtimes','assets.asset_history','assets.asset_inspections','assets.asset_warranties','assets.asset_warranty_claims','assets.assets','assets.compliance_policies','audit.events','billing.invoice_lines','billing.invoices','billing.receivables','communications.channel_members','communications.channels','communications.comments','communications.notification_preferences','communications.notifications','communications.poll_options','communications.poll_responses','communications.polls','communications.posts','communications.reactions','communications.unit_invitations','documents.access_events','documents.document_links','documents.document_versions','documents.documents','documents.folders','documents.legal_records','documents.retention_policies','finance.accounting_periods','finance.accounts','finance.allocation_inputs','finance.allocation_items','finance.allocation_rules','finance.allocation_runs','finance.charge_categories','finance.journal_entries','finance.journals','governance.agenda_items','governance.attendance','governance.ballots','governance.eligibility_snapshots','governance.meetings','governance.minutes','governance.resolutions','governance.vote_options','governance.votes','identity.context_grants','identity.membership_parties','identity.memberships','identity.permissions','identity.profiles','identity.role_permissions','identity.roles','maintenance.approval_records','maintenance.attachments','maintenance.maintenance_plans','maintenance.plan_occurrences','maintenance.purchase_orders','maintenance.rfqs','maintenance.sla_measurements','maintenance.ticket_status_history','maintenance.ticket_work_orders','maintenance.tickets','maintenance.vendor_contracts','maintenance.vendor_payables','maintenance.vendor_quotes','maintenance.vendors','maintenance.work_order_assignments','maintenance.work_order_checklist_items','maintenance.work_order_costs','maintenance.work_order_events','maintenance.work_orders','occupancy.leases','payments.bank_accounts','payments.bank_transactions','payments.import_batches','payments.payments','payments.reconciliation_matches','platform.customer_workspaces','platform.idempotency_keys','platform.jurisdiction_profiles','platform.module_definitions','platform.module_operating_model_compatibilities','platform.module_permission_bindings','platform.module_property_profile_compatibilities','platform.operating_models','platform.outbox_events','platform.platform_role_assignments','platform.platform_users','platform.property_jurisdiction_assignments','platform.property_operating_model_compatibilities','platform.property_profiles','platform.property_space_kind_compatibilities','platform.space_kinds','platform.subscription_plans','platform.tenants','platform.workspace_access_bases','platform.workspace_contracts','platform.workspace_delegation_permissions','platform.workspace_delegations','platform.workspace_entitlements','platform.workspace_member_role_authority_sources','platform.workspace_member_roles','platform.workspace_modules','platform.workspace_role_handover_lineage','platform.workspace_role_idempotency','platform.workspace_role_modules','platform.workspace_role_permissions','platform.workspace_roles','platform.workspace_taxonomy_assignments','portfolio.addresses','portfolio.buildings','portfolio.entrances','portfolio.ownerships','portfolio.parties','portfolio.properties','portfolio.units','security_access.access_points','utilities.consumption_periods','utilities.meter_readings','utilities.meters']) x where to_regclass(x) is not null)) then raise exception 'operations_unexpected_table_effect' using errcode='55000';end if;
 if exists(select 1 from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and t.typtype='e' and t.oid not in (select to_regtype(x) from unnest(array['assets.asset_condition','assets.asset_scope','billing.invoice_status','communications.channel_scope','communications.post_status','documents.classification','finance.account_type','finance.accounting_period_status','finance.allocation_method','finance.entry_side','finance.journal_status','finance.run_status','governance.meeting_status','governance.vote_status','identity.membership_status','identity.scope_type','maintenance.plan_trigger','maintenance.priority','maintenance.procurement_status','maintenance.ticket_status','maintenance.vendor_status','maintenance.work_order_status','payments.match_status','payments.payment_status','payments.transaction_direction','platform.decision_effect','platform.jurisdiction_profile_status','platform.platform_role_type','platform.property_jurisdiction_assignment_status','platform.record_status','platform.workspace_environment','platform.workspace_lifecycle_status','platform.workspace_type','portfolio.party_type','portfolio.property_type','portfolio.unit_status','security_access.access_point_type','utilities.meter_scope','utilities.reading_method','utilities.reading_status','utilities.service_type']) x where to_regtype(x) is not null)) then raise exception 'operations_unexpected_enum_effect' using errcode='55000';end if;
end; $source_catalog$;

-- Full poststate receipt is observable before commit, but does not by itself prove COMMIT.
select set_config('cladora.install.catalog_after',(with recursive
 namespaces as (select * from pg_namespace where nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications')),
 roots as (select c.* from pg_class c where c.relnamespace in (select oid from namespaces)),
 relids(oid) as (select oid from roots union select c.reltoastrelid from roots c where c.reltoastrelid<>0
  union select i.indexrelid from pg_index i where i.indrelid in (select reltoastrelid from roots where reltoastrelid<>0)),
 constraints as (select c.* from pg_constraint c where c.conrelid in (select oid from relids) or c.contypid in (select oid from pg_type where typnamespace in (select oid from namespaces))),
 triggers as (select t.* from pg_trigger t where t.tgrelid in (select oid from relids) or t.tgconstraint in (select oid from constraints)),
 types as (select t.* from pg_type t where t.typnamespace in (select oid from namespaces) or t.typrelid in (select oid from relids)),
 objects(classid,objid) as (
 select 'pg_namespace'::regclass,oid from namespaces union select 'pg_class'::regclass,oid from relids
 union select 'pg_type'::regclass,oid from types union select 'pg_constraint'::regclass,oid from constraints
 union select 'pg_trigger'::regclass,oid from triggers
 union select 'pg_proc'::regclass,oid from pg_proc where pronamespace in (select oid from namespaces)
 union select 'pg_policy'::regclass,oid from pg_policy where polrelid in (select oid from relids)
 union select 'pg_attrdef'::regclass,oid from pg_attrdef where adrelid in (select oid from relids)
 union select 'pg_rewrite'::regclass,oid from pg_rewrite where ev_class in (select oid from relids))
select jsonb_build_object(
 'format','operations-install-catalog-observation.v1',
 'classification','same-database raw catalog; OIDs retained; NOT cross-database normalization/equivalence',
 'namespaces',(select coalesce(jsonb_agg(to_jsonb(n) order by n.oid),'[]') from namespaces n),
 'relations',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]') from pg_class c where c.oid in (select oid from relids)),
 'columns',(select coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('type',format_type(a.atttypid,a.atttypmod),'default_expression',pg_get_expr(d.adbin,d.adrelid)) order by a.attrelid,a.attnum),'[]') from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid in (select oid from relids) and a.attnum>0),
 'constraints',(select coalesce(jsonb_agg(to_jsonb(c)||jsonb_build_object('definition',pg_get_constraintdef(c.oid,true)) order by c.oid),'[]') from constraints c),
 'indexes',(select coalesce(jsonb_agg(to_jsonb(i)||jsonb_build_object('definition',pg_get_indexdef(i.indexrelid),'predicate',pg_get_expr(i.indpred,i.indrelid),'expressions',pg_get_expr(i.indexprs,i.indrelid)) order by i.indexrelid),'[]') from pg_index i where i.indexrelid in (select oid from relids)),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('using',pg_get_expr(p.polqual,p.polrelid),'with_check',pg_get_expr(p.polwithcheck,p.polrelid)) order by p.oid),'[]') from pg_policy p where p.polrelid in (select oid from relids)),
 'triggers_both_FK_sides',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('definition',pg_get_triggerdef(t.oid,true)) order by t.oid),'[]') from triggers t),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from types t),
 'enum_order',(select coalesce(jsonb_agg(to_jsonb(e) order by e.enumtypid,e.enumsortorder),'[]') from pg_enum e where e.enumtypid in (select oid from types)),
 'routines',(select coalesce(jsonb_agg(to_jsonb(p)||jsonb_build_object('identity',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid)) order by p.oid),'[]') from pg_proc p where p.pronamespace in (select oid from namespaces)),
 'sequences',(select coalesce(jsonb_agg(to_jsonb(s) order by s.seqrelid),'[]') from pg_sequence s where s.seqrelid in (select oid from relids)),
 'rewrite',(select coalesce(jsonb_agg(to_jsonb(r) order by r.oid),'[]') from pg_rewrite r where r.ev_class in (select oid from relids)),
 'dependencies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]') from pg_depend d where exists(select 1 from objects o where (o.classid=d.classid and o.objid=d.objid) or (o.classid=d.refclassid and o.objid=d.refobjid))),
 'shared_dependencies',(select coalesce(jsonb_agg(to_jsonb(d) order by d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.deptype),'[]') from pg_shdepend d where d.dbid=(select oid from pg_database where datname=current_database()) and exists(select 1 from objects o where o.classid=d.classid and o.objid=d.objid)),
 'role_graph',(select coalesce(jsonb_agg(to_jsonb(m) order by m.oid),'[]') from pg_auth_members m),
 'role_attributes',(select coalesce(jsonb_agg(to_jsonb(r)-'rolpassword' order by r.oid),'[]') from pg_roles r where r.rolname in ('postgres','cladora_rpc_owner','cladora_building_fixture_ops')),
 'default_acl',(select coalesce(jsonb_agg(to_jsonb(d) order by d.oid),'[]') from pg_default_acl d)) )::text,true);
do $managed_complete$
declare before_catalog jsonb:=current_setting('cladora.install.managed_complete')::jsonb; after_catalog jsonb; tr jsonb;
begin
 after_catalog:=(select jsonb_build_object(
 'schemas',(select coalesce(jsonb_agg(to_jsonb(n) order by n.oid),'[]') from pg_namespace n where nspname in ('auth','extensions','public')),
 'relations',(select coalesce(jsonb_agg(to_jsonb(c) order by c.oid),'[]') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'columns',(select coalesce(jsonb_agg(to_jsonb(a) order by a.attrelid,a.attnum),'[]') from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'routines',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('auth','extensions','public')),
 'types',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname in ('auth','extensions','public')),
 'policies',(select coalesce(jsonb_agg(to_jsonb(p) order by p.oid),'[]') from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')),
 'triggers',(select coalesce(jsonb_agg(to_jsonb(t) order by t.oid),'[]') from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('auth','extensions','public')))
);
 if before_catalog-'triggers' is distinct from after_catalog-'triggers' then raise exception 'operations_managed_complete_delta' using errcode='55000';end if;
 for tr in select value from jsonb_array_elements(before_catalog->'triggers') loop
  if not (after_catalog->'triggers') @> jsonb_build_array(tr) then raise exception 'operations_managed_trigger_changed' using errcode='55000';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(after_catalog->'triggers') t where not (before_catalog->'triggers') @> jsonb_build_array(t.value)
 and not exists(select 1 from pg_trigger x join pg_constraint f on f.oid=x.tgconstraint join pg_class r on r.oid=f.conrelid join pg_namespace n on n.oid=r.relnamespace
 where x.oid=(t.value->>'oid')::oid and x.tgisinternal and x.tgrelid='auth.users'::regclass and f.contype='f' and f.confrelid='auth.users'::regclass
 and f.confkey=array[(select attnum from pg_attribute where attrelid='auth.users'::regclass and attname='id')]::smallint[] and n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications'))) then
 raise exception 'operations_unmapped_managed_trigger' using errcode='55000';end if;
end; $managed_complete$;
select jsonb_build_object('unit',current_setting('cladora.install.unit'),'transaction_id',pg_current_xact_id()::text,
 'source_contract','operations-inactive-install.v1','prestate_sha256',current_setting('cladora.install.prestate_sha256'),
 'poststate_sha256',encode(extensions.digest(convert_to(current_setting('cladora.install.catalog_after'),'UTF8'),'sha256'),'hex'),
 'poststate',current_setting('cladora.install.catalog_after')::jsonb,'commit_acknowledged',false,'runtime_active',false) as operations_install_precommit_receipt;

commit;
-- A successful response is an acknowledgement of this unit only, never product acceptance.
