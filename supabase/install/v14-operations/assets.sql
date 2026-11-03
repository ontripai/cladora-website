-- Operations independent inactive install unit: assets, v1; SOURCE ONLY, NOT EXECUTED.
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
  or current_setting('cladora.install.unit',true) is distinct from 'assets' then
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
 if 'assets'='foundation' and exists(select 1 from pg_namespace where nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications')) then
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
-- CANONICAL RANGE supabase/migrations/20260909152426_building_assets_equipment_registry.sql:2-223

-- ============================================================================
-- CLADORA-P2-ASSET-001: Building Assets, Equipment Registry, Warranty,
-- Compliance & Maintenance Linkage
-- Migration 81
-- ============================================================================

-- Ensure btree_gist extension is available for exclusion constraints
create extension if not exists btree_gist;

-- ----------------------------------------------------------------------------
-- 1. Standard Building Equipment Categories Catalog & Enum Extension
-- ----------------------------------------------------------------------------

-- Add new columns to assets.assets
alter table assets.assets
  add column if not exists description text,
  add column if not exists manufacture_year integer check (manufacture_year is null or (manufacture_year >= 1900 and manufacture_year <= 2100)),
  add column if not exists commissioned_at timestamptz,
  add column if not exists location_description text,
  add column if not exists ownership_type text not null default 'association' check (ownership_type in ('association','owner','municipal','utility','vendor','tenant')),
  add column if not exists lifecycle_status text not null default 'active' check (lifecycle_status in ('planned','ordered','installed','commissioned','active','under_maintenance','out_of_service','decommission_pending','decommissioned','disposed')),
  add column if not exists operational_status text not null default 'operational' check (operational_status in ('operational','degraded','unavailable','isolated','unknown')),
  add column if not exists is_safety_critical boolean not null default false,
  add column if not exists criticality_level text not null default 'medium' check (criticality_level in ('low','medium','high','critical')),
  add column if not exists meter_id uuid references utilities.meters(id) on delete restrict,
  add column if not exists access_point_id uuid references security_access.access_points(id) on delete restrict,
  add column if not exists vendor_id uuid references maintenance.vendors(id) on delete restrict,
  add column if not exists service_contract_id uuid references maintenance.vendor_contracts(id) on delete restrict,
  add column if not exists service_frequency_months integer check (service_frequency_months is null or service_frequency_months > 0),
  add column if not exists last_service_date date,
  add column if not exists next_service_date date,
  add column if not exists created_by uuid references auth.users(id) on delete restrict;

-- Covering foreign key indexes for assets.assets (Invariant 023)
create index if not exists assets_meter_id_idx on assets.assets(meter_id) where meter_id is not null;
create index if not exists assets_access_point_id_idx on assets.assets(access_point_id) where access_point_id is not null;
create index if not exists assets_vendor_id_idx on assets.assets(vendor_id) where vendor_id is not null;
create index if not exists assets_service_contract_id_idx on assets.assets(service_contract_id) where service_contract_id is not null;
create index if not exists assets_created_by_idx on assets.assets(created_by) where created_by is not null;
create index if not exists assets_tenant_lifecycle_idx on assets.assets(tenant_id, lifecycle_status);
create index if not exists assets_tenant_operational_idx on assets.assets(tenant_id, operational_status);
create index if not exists assets_tenant_safety_idx on assets.assets(tenant_id, is_safety_critical);

-- Extend assets.asset_warranties
alter table assets.asset_warranties
  add column if not exists vendor_id uuid references maintenance.vendors(id) on delete restrict,
  add column if not exists status text not null default 'active' check (status in ('active','expired','pending','claimed','void')),
  add column if not exists document_id uuid references documents.documents(id) on delete restrict,
  add column if not exists warranty_terms text,
  add column if not exists claim_history jsonb not null default '[]'::jsonb,
  add column if not exists updated_at timestamptz not null default statement_timestamp();

create index if not exists asset_warranties_vendor_id_idx on assets.asset_warranties(vendor_id) where vendor_id is not null;
create index if not exists asset_warranties_document_id_idx on assets.asset_warranties(document_id) where document_id is not null;

-- ----------------------------------------------------------------------------
-- 2. Compliance Policies Table & Versioning Non-Overlap Constraint
-- ----------------------------------------------------------------------------
create table if not exists assets.compliance_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  policy_code text not null,
  category_code text not null,
  property_id uuid references portfolio.properties(id) on delete restrict,
  jurisdiction text not null default 'RO',
  interval_months integer not null check (interval_months > 0),
  is_safety_mandatory boolean not null default false,
  legal_source_reference text not null,
  approval_status text not null default 'LEGAL-REVIEW-REQUIRED' check (approval_status in ('LEGAL-REVIEW-REQUIRED','APPROVED','SUPERSEDED')),
  effective_from date not null,
  effective_to date,
  version integer not null default 1 check (version > 0),
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  check (effective_to is null or effective_to >= effective_from)
);

-- Covering indexes
create index if not exists compliance_policies_tenant_cat_idx on assets.compliance_policies(tenant_id, category_code);
create index if not exists compliance_policies_property_id_idx on assets.compliance_policies(property_id) where property_id is not null;
create index if not exists compliance_policies_created_by_idx on assets.compliance_policies(created_by) where created_by is not null;

-- Fail-closed exclusion constraint preventing overlapping effective periods for identical policy_code within tenant & property scope
alter table assets.compliance_policies
  drop constraint if exists compliance_policies_no_overlap;

alter table assets.compliance_policies
  add constraint compliance_policies_no_overlap
  exclude using gist (
    tenant_id with =,
    category_code with =,
    policy_code with =,
    coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid) with =,
    daterange(effective_from, coalesce(effective_to, 'infinity'::date), '[]') with &&
  );

-- ----------------------------------------------------------------------------
-- 3. Asset Inspections Table
-- ----------------------------------------------------------------------------
create table if not exists assets.asset_inspections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  asset_id uuid not null references assets.assets(id) on delete restrict,
  policy_id uuid references assets.compliance_policies(id) on delete restrict,
  policy_version_snapshot jsonb,
  inspection_type text not null,
  scheduled_date date not null,
  performed_at timestamptz,
  inspector_name text,
  inspector_vendor_id uuid references maintenance.vendors(id) on delete restrict,
  result text not null default 'pending' check (result in ('pending','passed','passed_with_observations','failed','expired','cancelled')),
  observations text,
  corrective_action_required text,
  next_due_date date,
  document_id uuid references documents.documents(id) on delete restrict,
  evidence_metadata jsonb not null default '{}'::jsonb,
  is_verified boolean not null default false,
  verified_by uuid references auth.users(id) on delete restrict,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create index if not exists asset_inspections_tenant_idx on assets.asset_inspections(tenant_id);
create index if not exists asset_inspections_asset_idx on assets.asset_inspections(asset_id);
create index if not exists asset_inspections_policy_idx on assets.asset_inspections(policy_id) where policy_id is not null;
create index if not exists asset_inspections_vendor_idx on assets.asset_inspections(inspector_vendor_id) where inspector_vendor_id is not null;
create index if not exists asset_inspections_document_idx on assets.asset_inspections(document_id) where document_id is not null;
create index if not exists asset_inspections_verified_by_idx on assets.asset_inspections(verified_by) where verified_by is not null;
create index if not exists asset_inspections_created_by_idx on assets.asset_inspections(created_by) where created_by is not null;

-- ----------------------------------------------------------------------------
-- 4. Asset Downtimes Table with tstzrange Exclusion Constraint
-- ----------------------------------------------------------------------------
create table if not exists assets.asset_downtimes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  asset_id uuid not null references assets.assets(id) on delete restrict,
  started_at timestamptz not null,
  ended_at timestamptz,
  reason text not null,
  is_planned boolean not null default false,
  work_order_id uuid references maintenance.work_orders(id) on delete restrict,
  ticket_id uuid references maintenance.tickets(id) on delete restrict,
  duration_minutes integer check (duration_minutes is null or duration_minutes >= 0),
  recorded_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  check (ended_at is null or ended_at > started_at)
);

create index if not exists asset_downtimes_tenant_idx on assets.asset_downtimes(tenant_id);
create index if not exists asset_downtimes_asset_idx on assets.asset_downtimes(asset_id);
create index if not exists asset_downtimes_wo_idx on assets.asset_downtimes(work_order_id) where work_order_id is not null;
create index if not exists asset_downtimes_ticket_idx on assets.asset_downtimes(ticket_id) where ticket_id is not null;
create index if not exists asset_downtimes_recorded_by_idx on assets.asset_downtimes(recorded_by) where recorded_by is not null;

-- Strict exclusion constraint preventing overlapping downtime periods (both closed and open intervals)
alter table assets.asset_downtimes
  drop constraint if exists asset_downtimes_no_overlap;

alter table assets.asset_downtimes
  add constraint asset_downtimes_no_overlap
  exclude using gist (
    asset_id with =,
    tstzrange(started_at, coalesce(ended_at, 'infinity'::timestamptz), '[)') with &&
  );

-- ----------------------------------------------------------------------------
-- 5. Asset Decommission Requests Table
-- ----------------------------------------------------------------------------
create table if not exists assets.asset_decommission_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  asset_id uuid not null references assets.assets(id) on delete restrict,
  replacement_asset_id uuid references assets.assets(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','rejected','cancelled')),
  reason text not null,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default statement_timestamp(),
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default statement_timestamp()
);

create index if not exists asset_decom_tenant_idx on assets.asset_decommission_requests(tenant_id);
create index if not exists asset_decom_asset_idx on assets.asset_decommission_requests(asset_id);
create index if not exists asset_decom_replacement_idx on assets.asset_decommission_requests(replacement_asset_id) where replacement_asset_id is not null;
create index if not exists asset_decom_req_by_idx on assets.asset_decommission_requests(requested_by);
create index if not exists asset_decom_app_by_idx on assets.asset_decommission_requests(approved_by) where approved_by is not null;

-- ----------------------------------------------------------------------------
-- 6. Asset Warranty Claims Table
-- ----------------------------------------------------------------------------
create table if not exists assets.asset_warranty_claims (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  warranty_id uuid not null references assets.asset_warranties(id) on delete restrict,
  asset_id uuid not null references assets.assets(id) on delete restrict,
  claim_reference text not null,
  claim_date date not null default current_date,
  description text not null,
  resolution_status text not null default 'submitted' check (resolution_status in ('submitted','in_review','accepted','rejected','resolved')),
  resolution_notes text,
  warranty_snapshot jsonb not null default '{}'::jsonb,
  document_id uuid references documents.documents(id) on delete restrict,
  created_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

create index if not exists asset_warranty_claims_tenant_idx on assets.asset_warranty_claims(tenant_id);
create index if not exists asset_warranty_claims_warranty_idx on assets.asset_warranty_claims(warranty_id);
create index if not exists asset_warranty_claims_asset_idx on assets.asset_warranty_claims(asset_id);
create index if not exists asset_warranty_claims_doc_idx on assets.asset_warranty_claims(document_id) where document_id is not null;
create index if not exists asset_warranty_claims_created_by_idx on assets.asset_warranty_claims(created_by) where created_by is not null;

-- ----------------------------------------------------------------------------
-- 7. Document Links Validation Trigger Update: Support assets.asset & inspections
-- ----------------------------------------------------------------------------


-- CANONICAL RANGE supabase/migrations/20260909152426_building_assets_equipment_registry.sql:381-2270
create or replace function assets.enforce_asset_domain_integrity()
returns trigger language plpgsql security definer set search_path = pg_catalog
as $$
declare
  v_prop portfolio.properties;
  v_bldg portfolio.buildings;
  v_unit portfolio.units;
  v_meter utilities.meters;
  v_ap security_access.access_points;
  v_vendor maintenance.vendors;
  v_contract maintenance.vendor_contracts;
  v_doc documents.documents;
begin
  -- Block hard delete across all asset tables
  if tg_op = 'DELETE' then
    raise exception 'asset_hard_delete_prohibited: physical deletion is strictly forbidden';
  end if;

  if tg_table_name = 'assets' then
    -- Validate building scope
    if new.building_id is not null then
      select * into v_bldg from portfolio.buildings where id = new.building_id and tenant_id = new.tenant_id and property_id = new.property_id;
      if not found then raise exception 'asset_building_scope_invalid: building not found in property'; end if;
    end if;

    -- Validate unit scope
    if new.unit_id is not null then
      select * into v_unit from portfolio.units where id = new.unit_id and tenant_id = new.tenant_id;
      if not found then raise exception 'asset_unit_scope_invalid: unit not found in tenant'; end if;
      if new.building_id is not null and v_unit.building_id <> new.building_id then
        raise exception 'asset_unit_scope_invalid: unit does not belong to building';
      end if;
    end if;

    -- Validate meter_id
    if new.meter_id is not null then
      select * into v_meter from utilities.meters where id = new.meter_id and tenant_id = new.tenant_id and property_id = new.property_id;
      if not found then raise exception 'asset_meter_scope_invalid: meter not found in property'; end if;
    end if;

    -- Validate access_point_id
    if new.access_point_id is not null then
      select * into v_ap from security_access.access_points where id = new.access_point_id and tenant_id = new.tenant_id and property_id = new.property_id;
      if not found then raise exception 'asset_access_point_scope_invalid: access point not found in property'; end if;
    end if;

    -- Validate vendor_id
    if new.vendor_id is not null then
      select * into v_vendor from maintenance.vendors where id = new.vendor_id and tenant_id = new.tenant_id;
      if not found then raise exception 'asset_vendor_scope_invalid: vendor not found in tenant'; end if;
    end if;

    -- Validate service_contract_id
    if new.service_contract_id is not null then
      select * into v_contract from maintenance.vendor_contracts where id = new.service_contract_id and tenant_id = new.tenant_id and property_id = new.property_id;
      if not found then raise exception 'asset_contract_scope_invalid: service contract not found in property'; end if;
      if new.vendor_id is not null and v_contract.vendor_id <> new.vendor_id then
        raise exception 'asset_contract_scope_invalid: contract vendor mismatch';
      end if;
    end if;

    -- Prevent direct decommissioning transition from regular updates
    if tg_op = 'UPDATE' and new.lifecycle_status in ('decommissioned','decommission_pending') and old.lifecycle_status not in ('decommissioned','decommission_pending') then
      if coalesce(current_setting('cladora.decommission_authorized', true), '') <> 'true' then
        raise exception 'direct_decommission_forbidden: asset decommissioning requires formal request and approval';
      end if;
    end if;

    -- Immutability of decommissioned/disposed assets
    if tg_op = 'UPDATE' and old.lifecycle_status in ('decommissioned','disposed') and (new.lifecycle_status = old.lifecycle_status or new.status = old.status) and new is distinct from old then
      if coalesce(current_setting('cladora.decommission_authorized', true), '') <> 'true' then
        raise exception 'decommissioned_asset_is_immutable: decommissioned assets cannot be modified';
      end if;
    end if;

    return new;
  end if;

  if tg_table_name = 'asset_inspections' then
    -- Immutability of verified inspections
    if tg_op = 'UPDATE' and old.is_verified = true and new is distinct from old then
      raise exception 'verified_inspection_is_immutable: verified inspections cannot be modified; record a new inspection event';
    end if;

    -- Validate document evidence if attached
    if new.document_id is not null then
      select * into v_doc from documents.documents where id = new.document_id and tenant_id = new.tenant_id;
      if not found then raise exception 'document_not_found'; end if;
      if not exists (
        select 1 from documents.document_versions dv
        where dv.document_id = v_doc.id and dv.version = coalesce(v_doc.current_version, 1) and dv.scanning_status = 'clean'
      ) or v_doc.status <> 'active' or v_doc.disposition_status in ('disposition_pending_execution', 'disposition_approved', 'disposed') then
        raise exception 'document_not_authoritative_evidence: unscanned, quarantined or deferred documents cannot be used as inspection evidence';
      end if;
    end if;

    return new;
  end if;

  if tg_table_name = 'asset_warranty_claims' then
    -- Immutability of resolved claims
    if tg_op = 'UPDATE' and old.resolution_status in ('accepted','rejected','resolved') and new is distinct from old then
      raise exception 'resolved_claim_is_immutable: finalized warranty claims cannot be modified';
    end if;

    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_asset_domain_integrity on assets.assets;
create trigger trg_asset_domain_integrity
  before insert or update or delete on assets.assets
  for each row execute function assets.enforce_asset_domain_integrity();

drop trigger if exists trg_inspection_domain_integrity on assets.asset_inspections;
create trigger trg_inspection_domain_integrity
  before insert or update or delete on assets.asset_inspections
  for each row execute function assets.enforce_asset_domain_integrity();

drop trigger if exists trg_warranty_claim_domain_integrity on assets.asset_warranty_claims;
create trigger trg_warranty_claim_domain_integrity
  before insert or update or delete on assets.asset_warranty_claims
  for each row execute function assets.enforce_asset_domain_integrity();

drop trigger if exists trg_asset_downtime_hard_delete on assets.asset_downtimes;
create trigger trg_asset_downtime_hard_delete
  before delete on assets.asset_downtimes
  for each row execute function assets.enforce_asset_domain_integrity();

drop trigger if exists trg_decom_hard_delete on assets.asset_decommission_requests;
create trigger trg_decom_hard_delete
  before delete on assets.asset_decommission_requests
  for each row execute function assets.enforce_asset_domain_integrity();

-- ----------------------------------------------------------------------------
-- 9. Row Level Security & Grants
-- ----------------------------------------------------------------------------
alter table assets.compliance_policies enable row level security;
alter table assets.asset_inspections enable row level security;
alter table assets.asset_downtimes enable row level security;
alter table assets.asset_decommission_requests enable row level security;
alter table assets.asset_warranty_claims enable row level security;

-- Policies for authenticated reads scoped by tenant
create policy compliance_policies_tenant_read on assets.compliance_policies
  for select to authenticated using (tenant_id = app_private.active_tenant_id());

create policy asset_inspections_tenant_read on assets.asset_inspections
  for select to authenticated using (
    tenant_id = app_private.active_tenant_id() and
    exists (select 1 from assets.assets a where a.id = asset_id and app_private.can_access_asset_scope(a.property_id, a.building_id, a.unit_id))
  );

create policy asset_downtimes_tenant_read on assets.asset_downtimes
  for select to authenticated using (
    tenant_id = app_private.active_tenant_id() and
    exists (select 1 from assets.assets a where a.id = asset_id and app_private.can_access_asset_scope(a.property_id, a.building_id, a.unit_id))
  );

create policy asset_decom_tenant_read on assets.asset_decommission_requests
  for select to authenticated using (
    tenant_id = app_private.active_tenant_id() and
    exists (select 1 from assets.assets a where a.id = asset_id and app_private.can_access_asset_scope(a.property_id, a.building_id, a.unit_id))
  );

create policy asset_claims_tenant_read on assets.asset_warranty_claims
  for select to authenticated using (
    tenant_id = app_private.active_tenant_id() and
    exists (select 1 from assets.assets a where a.id = asset_id and app_private.can_access_asset_scope(a.property_id, a.building_id, a.unit_id))
  );

grant all on all tables in schema assets to service_role;
revoke all on all tables in schema assets from public, anon, authenticated;
grant execute on all functions in schema assets to authenticated, service_role;
revoke all on all functions in schema assets from public, anon;

-- ----------------------------------------------------------------------------
-- 10. Permission Bootstrap
-- ----------------------------------------------------------------------------
insert into identity.permissions(code, resource, action, description)
values
  ('assets.read', 'assets', 'read', 'Read authorized building assets and equipment'),
  ('assets.manage', 'assets', 'manage', 'Create and update asset metadata and operational status'),
  ('assets.critical.manage', 'assets', 'critical_manage', 'Privileged management of safety-critical assets (AAL2)'),
  ('assets.inspections.verify', 'assets', 'verify_inspection', 'Verify and certify compliance inspections (AAL2)'),
  ('assets.decommission', 'assets', 'decommission', 'Approve decommissioning of building equipment (AAL2)')
on conflict (code) do update set
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description;

-- Grant permissions to roles
insert into identity.role_permissions(role_id, permission_id, effect)
select r.id, p.id, 'allow' from identity.roles r cross join identity.permissions p
where lower(r.code) in ('association_admin','property_manager','president','censor','owner','tenant_resident')
  and p.code = 'assets.read'
on conflict (role_id, permission_id) do update set effect = 'allow';

insert into identity.role_permissions(role_id, permission_id, effect)
select r.id, p.id, 'allow' from identity.roles r cross join identity.permissions p
where lower(r.code) in ('association_admin','property_manager')
  and p.code in ('assets.manage', 'assets.critical.manage', 'assets.inspections.verify')
on conflict (role_id, permission_id) do update set effect = 'allow';

insert into identity.role_permissions(role_id, permission_id, effect)
select r.id, p.id, 'allow' from identity.roles r cross join identity.permissions p
where lower(r.code) in ('association_admin','president')
  and p.code in ('assets.critical.manage', 'assets.decommission')
on conflict (role_id, permission_id) do update set effect = 'allow';

-- ----------------------------------------------------------------------------
-- 11. Internal Domain Engine Functions
-- ----------------------------------------------------------------------------

-- Helper to check caller context & permission using identity.context_grants and identity.memberships
create or replace function assets.check_asset_caller_v1(
  p_context_id uuid,
  p_required_permission text,
  p_require_aal2 boolean default false
) returns record language plpgsql stable security definer set search_path = pg_catalog, identity, platform
as $$
declare
  v_rec record;
  v_uid uuid := auth.uid();
  v_aal text;
begin
  if v_uid is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;

  select coalesce(auth.jwt()->>'aal', 'aal1') into v_aal;
  if p_require_aal2 and v_aal <> 'aal2' then
    raise exception 'MFA_REQUIRED: Elevated AAL2 authentication required' using errcode = '42501';
  end if;

  select
    g.tenant_id,
    g.membership_id,
    m.user_id,
    r.code as role_code,
    g.scope_type::text as scope_type,
    g.property_id,
    g.building_id,
    g.unit_id,
    m.role_id
  into v_rec
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = v_uid
    and m.status = 'active';

  if not found then
    raise exception 'ACCESS_DENIED: User context invalid or inactive' using errcode = '42501';
  end if;

  -- Check explicit permission
  if p_required_permission is not null then
    if not exists (
      select 1 from identity.role_permissions rp
      join identity.permissions p on p.id = rp.permission_id
      where rp.role_id = v_rec.role_id and p.code = p_required_permission and rp.effect = 'allow'
    ) then
      raise exception 'INSUFFICIENT_PERMISSIONS: Required permission %', p_required_permission using errcode = '42501';
    end if;
  end if;

  return v_rec;
end;
$$;

-- ----------------------------------------------------------------------------
-- 12. Versioned Customer API RPC Wrappers
-- ----------------------------------------------------------------------------

-- 12.1 List Assets with filters, sorting, and pagination
-- Internal Definier: assets.list_assets_internal_v1
create or replace function assets.list_assets_internal_v1(
  p_context_id uuid,
  p_property_id uuid default null,
  p_building_id uuid default null,
  p_category_id uuid default null,
  p_lifecycle_status text default null,
  p_operational_status text default null,
  p_condition text default null,
  p_criticality_level text default null,
  p_is_safety_critical boolean default null,
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_is_restricted boolean := false;
  v_total bigint;
  v_items jsonb;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);
  if v_caller.role_code in ('owner', 'tenant_resident') then
    v_is_restricted := true;
  end if;

  select count(*) into v_total
  from assets.assets a
  where a.tenant_id = v_caller.tenant_id
    and (p_property_id is null or a.property_id = p_property_id)
    and (p_building_id is null or a.building_id = p_building_id)
    and (p_category_id is null or a.category_id = p_category_id)
    and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
    and (p_operational_status is null or a.operational_status = p_operational_status)
    and (p_condition is null or a.condition::text = p_condition)
    and (p_criticality_level is null or a.criticality_level = p_criticality_level)
    and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
    and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%');

  if v_is_restricted then
    -- Projected allowlist for owner / resident (excludes confidential commercial, serial, cost, vendor data)
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'asset_code', a.asset_code,
        'name', a.name,
        'category_id', a.category_id,
        'property_id', a.property_id,
        'building_id', a.building_id,
        'unit_id', a.unit_id,
        'scope', a.scope,
        'location_description', a.location_description,
        'lifecycle_status', a.lifecycle_status,
        'operational_status', a.operational_status,
        'condition', a.condition,
        'criticality_level', a.criticality_level,
        'is_safety_critical', a.is_safety_critical,
        'installed_on', a.installed_on,
        'commissioned_at', a.commissioned_at,
        'created_at', a.created_at
      ) order by a.created_at desc
    ), '[]'::jsonb) into v_items
    from (
      select * from assets.assets a
      where a.tenant_id = v_caller.tenant_id
        and (p_property_id is null or a.property_id = p_property_id)
        and (p_building_id is null or a.building_id = p_building_id)
        and (p_category_id is null or a.category_id = p_category_id)
        and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
        and (p_operational_status is null or a.operational_status = p_operational_status)
        and (p_condition is null or a.condition::text = p_condition)
        and (p_criticality_level is null or a.criticality_level = p_criticality_level)
        and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
        and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%')
      order by a.created_at desc
      limit coalesce(p_limit, 25) offset coalesce(p_offset, 0)
    ) a;
  else
    -- Full administrative projection
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'asset_code', a.asset_code,
        'name', a.name,
        'description', a.description,
        'category_id', a.category_id,
        'property_id', a.property_id,
        'building_id', a.building_id,
        'unit_id', a.unit_id,
        'scope', a.scope,
        'manufacturer', a.manufacturer,
        'model', a.model,
        'serial_fingerprint', a.serial_fingerprint,
        'manufacture_year', a.manufacture_year,
        'installed_on', a.installed_on,
        'commissioned_at', a.commissioned_at,
        'location_description', a.location_description,
        'ownership_type', a.ownership_type,
        'lifecycle_status', a.lifecycle_status,
        'operational_status', a.operational_status,
        'condition', a.condition,
        'criticality_level', a.criticality_level,
        'criticality', a.criticality,
        'is_safety_critical', a.is_safety_critical,
        'replacement_cost', a.replacement_cost,
        'currency', a.currency,
        'meter_id', a.meter_id,
        'access_point_id', a.access_point_id,
        'vendor_id', a.vendor_id,
        'service_contract_id', a.service_contract_id,
        'service_frequency_months', a.service_frequency_months,
        'last_service_date', a.last_service_date,
        'next_service_date', a.next_service_date,
        'created_at', a.created_at,
        'updated_at', a.updated_at
      ) order by a.created_at desc
    ), '[]'::jsonb) into v_items
    from (
      select * from assets.assets a
      where a.tenant_id = v_caller.tenant_id
        and (p_property_id is null or a.property_id = p_property_id)
        and (p_building_id is null or a.building_id = p_building_id)
        and (p_category_id is null or a.category_id = p_category_id)
        and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
        and (p_operational_status is null or a.operational_status = p_operational_status)
        and (p_condition is null or a.condition::text = p_condition)
        and (p_criticality_level is null or a.criticality_level = p_criticality_level)
        and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
        and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%')
      order by a.created_at desc
      limit coalesce(p_limit, 25) offset coalesce(p_offset, 0)
    ) a;
  end if;

  return jsonb_build_object(
    'total', v_total,
    'limit', coalesce(p_limit, 25),
    'offset', coalesce(p_offset, 0),
    'items', v_items
  );
end;
$$;

-- Public Wrapper: customer_api.list_assets_v1
create or replace function customer_api.list_assets_v1(
  p_context_id uuid,
  p_property_id uuid default null,
  p_building_id uuid default null,
  p_category_id uuid default null,
  p_lifecycle_status text default null,
  p_operational_status text default null,
  p_condition text default null,
  p_criticality_level text default null,
  p_is_safety_critical boolean default null,
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.list_assets_internal_v1(p_context_id, p_property_id, p_building_id, p_category_id, p_lifecycle_status, p_operational_status, p_condition, p_criticality_level, p_is_safety_critical, p_search, p_limit, p_offset);
end;
$$;

-- 12.2 Get Asset Detail
-- Internal Definier: assets.get_asset_detail_internal_v1
create or replace function assets.get_asset_detail_internal_v1(
  p_context_id uuid,
  p_asset_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_is_restricted boolean := false;
  v_asset record;
  v_warranty record;
  v_active_downtime record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);
  if v_caller.role_code in ('owner', 'tenant_resident') then
    v_is_restricted := true;
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  select * into v_active_downtime from assets.asset_downtimes
  where asset_id = p_asset_id and ended_at is null
  order by started_at desc limit 1;

  if v_is_restricted then
    return jsonb_build_object(
      'id', v_asset.id,
      'asset_code', v_asset.asset_code,
      'name', v_asset.name,
      'category_id', v_asset.category_id,
      'property_id', v_asset.property_id,
      'building_id', v_asset.building_id,
      'unit_id', v_asset.unit_id,
      'scope', v_asset.scope,
      'location_description', v_asset.location_description,
      'lifecycle_status', v_asset.lifecycle_status,
      'operational_status', v_asset.operational_status,
      'condition', v_asset.condition,
      'criticality_level', v_asset.criticality_level,
      'is_safety_critical', v_asset.is_safety_critical,
      'installed_on', v_asset.installed_on,
      'commissioned_at', v_asset.commissioned_at,
      'is_in_downtime', (v_active_downtime.id is not null)
    );
  end if;

  select * into v_warranty from assets.asset_warranties
  where asset_id = p_asset_id order by ends_on desc limit 1;

  return jsonb_build_object(
    'id', v_asset.id,
    'asset_code', v_asset.asset_code,
    'name', v_asset.name,
    'description', v_asset.description,
    'category_id', v_asset.category_id,
    'property_id', v_asset.property_id,
    'building_id', v_asset.building_id,
    'unit_id', v_asset.unit_id,
    'scope', v_asset.scope,
    'manufacturer', v_asset.manufacturer,
    'model', v_asset.model,
    'serial_fingerprint', v_asset.serial_fingerprint,
    'manufacture_year', v_asset.manufacture_year,
    'installed_on', v_asset.installed_on,
    'commissioned_at', v_asset.commissioned_at,
    'location_description', v_asset.location_description,
    'ownership_type', v_asset.ownership_type,
    'lifecycle_status', v_asset.lifecycle_status,
    'operational_status', v_asset.operational_status,
    'condition', v_asset.condition,
    'criticality_level', v_asset.criticality_level,
    'criticality', v_asset.criticality,
    'is_safety_critical', v_asset.is_safety_critical,
    'replacement_cost', v_asset.replacement_cost,
    'currency', v_asset.currency,
    'meter_id', v_asset.meter_id,
    'access_point_id', v_asset.access_point_id,
    'vendor_id', v_asset.vendor_id,
    'service_contract_id', v_asset.service_contract_id,
    'service_frequency_months', v_asset.service_frequency_months,
    'last_service_date', v_asset.last_service_date,
    'next_service_date', v_asset.next_service_date,
    'warranty', case when v_warranty.id is not null then jsonb_build_object(
      'id', v_warranty.id,
      'status', v_warranty.status,
      'starts_on', v_warranty.starts_on,
      'ends_on', v_warranty.ends_on,
      'vendor_id', v_warranty.vendor_id,
      'coverage_json', v_warranty.coverage_json,
      'document_id', v_warranty.document_id
    ) else null end,
    'active_downtime', case when v_active_downtime.id is not null then jsonb_build_object(
      'id', v_active_downtime.id,
      'started_at', v_active_downtime.started_at,
      'reason', v_active_downtime.reason,
      'is_planned', v_active_downtime.is_planned
    ) else null end,
    'created_at', v_asset.created_at,
    'updated_at', v_asset.updated_at
  );
end;
$$;

-- Public Wrapper: customer_api.get_asset_detail_v1
create or replace function customer_api.get_asset_detail_v1(
  p_context_id uuid,
  p_asset_id uuid
)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.get_asset_detail_internal_v1(p_context_id, p_asset_id);
end;
$$;

-- 12.3 Create Asset
-- Internal Definier: assets.create_asset_internal_v1
create or replace function assets.create_asset_internal_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_category_id uuid,
  p_asset_code text,
  p_name text,
  p_scope text default 'property',
  p_building_id uuid default null,
  p_unit_id uuid default null,
  p_description text default null,
  p_manufacturer text default null,
  p_model text default null,
  p_serial_number text default null,
  p_manufacture_year integer default null,
  p_installed_on date default null,
  p_location_description text default null,
  p_ownership_type text default 'association',
  p_condition text default 'unknown',
  p_criticality_level text default 'medium',
  p_is_safety_critical boolean default false,
  p_replacement_cost numeric default null,
  p_currency text default 'RON',
  p_meter_id uuid default null,
  p_access_point_id uuid default null,
  p_vendor_id uuid default null,
  p_service_contract_id uuid default null,
  p_service_frequency_months integer default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_asset_id uuid;
  v_serial_fp text := null;
  v_crit_num smallint := 3;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  if p_is_safety_critical or p_criticality_level = 'critical' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  if p_serial_number is not null and trim(p_serial_number) <> '' then
    v_serial_fp := encode(digest(trim(p_serial_number), 'sha256'), 'hex');
  end if;

  case p_criticality_level
    when 'low' then v_crit_num := 1;
    when 'medium' then v_crit_num := 3;
    when 'high' then v_crit_num := 4;
    when 'critical' then v_crit_num := 5;
    else v_crit_num := 3;
  end case;

  insert into assets.assets (
    tenant_id, property_id, category_id, asset_code, name, scope,
    building_id, unit_id, description, manufacturer, model,
    serial_number_encrypted, serial_fingerprint, manufacture_year, installed_on,
    location_description, ownership_type, lifecycle_status, operational_status,
    condition, criticality_level, criticality, is_safety_critical, replacement_cost,
    currency, meter_id, access_point_id, vendor_id, service_contract_id,
    service_frequency_months, created_by
  ) values (
    v_caller.tenant_id, p_property_id, p_category_id, trim(p_asset_code), trim(p_name), p_scope::assets.asset_scope,
    p_building_id, p_unit_id, p_description, p_manufacturer, p_model,
    p_serial_number, v_serial_fp, p_manufacture_year, p_installed_on,
    p_location_description, p_ownership_type, 'planned', 'operational',
    p_condition::assets.asset_condition, p_criticality_level, v_crit_num, p_is_safety_critical, p_replacement_cost,
    p_currency, p_meter_id, p_access_point_id, p_vendor_id, p_service_contract_id,
    p_service_frequency_months, auth.uid()
  ) returning id into v_asset_id;

  -- Record audit event
  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason, occurred_at
  ) values (
    v_caller.tenant_id, v_asset_id, 'asset_created', auth.uid(), 'Initial creation in planned status', statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', v_asset_id);
end;
$$;

-- Public Wrapper: customer_api.create_asset_v1
create or replace function customer_api.create_asset_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_category_id uuid,
  p_asset_code text,
  p_name text,
  p_scope text default 'property',
  p_building_id uuid default null,
  p_unit_id uuid default null,
  p_description text default null,
  p_manufacturer text default null,
  p_model text default null,
  p_serial_number text default null,
  p_manufacture_year integer default null,
  p_installed_on date default null,
  p_location_description text default null,
  p_ownership_type text default 'association',
  p_condition text default 'unknown',
  p_criticality_level text default 'medium',
  p_is_safety_critical boolean default false,
  p_replacement_cost numeric default null,
  p_currency text default 'RON',
  p_meter_id uuid default null,
  p_access_point_id uuid default null,
  p_vendor_id uuid default null,
  p_service_contract_id uuid default null,
  p_service_frequency_months integer default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.create_asset_internal_v1(p_context_id, p_property_id, p_category_id, p_asset_code, p_name, p_scope, p_building_id, p_unit_id, p_description, p_manufacturer, p_model, p_serial_number, p_manufacture_year, p_installed_on, p_location_description, p_ownership_type, p_condition, p_criticality_level, p_is_safety_critical, p_replacement_cost, p_currency, p_meter_id, p_access_point_id, p_vendor_id, p_service_contract_id, p_service_frequency_months);
end;
$$;

-- 12.4 Update Asset Metadata
-- Internal Definier: assets.update_asset_internal_v1
create or replace function assets.update_asset_internal_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_name text default null,
  p_description text default null,
  p_location_description text default null,
  p_meter_id uuid default null,
  p_access_point_id uuid default null,
  p_vendor_id uuid default null,
  p_service_contract_id uuid default null,
  p_service_frequency_months integer default null,
  p_replacement_cost numeric default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_asset record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if v_asset.is_safety_critical or v_asset.criticality_level = 'critical' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    name = coalesce(trim(p_name), name),
    description = coalesce(p_description, description),
    location_description = coalesce(p_location_description, location_description),
    meter_id = coalesce(p_meter_id, meter_id),
    access_point_id = coalesce(p_access_point_id, access_point_id),
    vendor_id = coalesce(p_vendor_id, vendor_id),
    service_contract_id = coalesce(p_service_contract_id, service_contract_id),
    service_frequency_months = coalesce(p_service_frequency_months, service_frequency_months),
    replacement_cost = coalesce(p_replacement_cost, replacement_cost),
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'asset_id', p_asset_id);
end;
$$;

-- Public Wrapper: customer_api.update_asset_v1
create or replace function customer_api.update_asset_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_name text default null,
  p_description text default null,
  p_location_description text default null,
  p_meter_id uuid default null,
  p_access_point_id uuid default null,
  p_vendor_id uuid default null,
  p_service_contract_id uuid default null,
  p_service_frequency_months integer default null,
  p_replacement_cost numeric default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.update_asset_internal_v1(p_context_id, p_asset_id, p_name, p_description, p_location_description, p_meter_id, p_access_point_id, p_vendor_id, p_service_contract_id, p_service_frequency_months, p_replacement_cost);
end;
$$;

-- 12.5 Transition Asset Lifecycle (Commissioning / Maintenance / Active)
-- Internal Definier: assets.transition_asset_lifecycle_internal_v1
create or replace function assets.transition_asset_lifecycle_internal_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_target_status text,
  p_reason text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_asset record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  if p_target_status in ('decommissioned', 'decommission_pending') then
    raise exception 'direct_decommission_forbidden: asset decommissioning requires formal request and approval';
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  -- Commissioning requires AAL2 and verification
  if p_target_status = 'commissioned' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.manage', true);
  end if;

  if v_asset.is_safety_critical and p_target_status in ('commissioned','out_of_service') then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    lifecycle_status = p_target_status,
    commissioned_at = case when p_target_status = 'commissioned' and commissioned_at is null then statement_timestamp() else commissioned_at end,
    updated_at = statement_timestamp()
  where id = p_asset_id;

  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason,
    before_snapshot, after_snapshot, occurred_at
  ) values (
    v_caller.tenant_id, p_asset_id, 'lifecycle_transition', auth.uid(), p_reason,
    jsonb_build_object('lifecycle_status', v_asset.lifecycle_status),
    jsonb_build_object('lifecycle_status', p_target_status),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', p_asset_id, 'lifecycle_status', p_target_status);
end;
$$;

-- Public Wrapper: customer_api.transition_asset_lifecycle_v1
create or replace function customer_api.transition_asset_lifecycle_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_target_status text,
  p_reason text default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.transition_asset_lifecycle_internal_v1(p_context_id, p_asset_id, p_target_status, p_reason);
end;
$$;

-- 12.6 Update Operational Status & Condition
-- Internal Definier: assets.update_asset_operational_status_internal_v1
create or replace function assets.update_asset_operational_status_internal_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_operational_status text,
  p_condition text default null,
  p_reason text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_asset record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if v_asset.is_safety_critical and p_operational_status in ('unavailable', 'isolated') then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    operational_status = p_operational_status,
    condition = coalesce(p_condition::assets.asset_condition, condition),
    updated_at = statement_timestamp()
  where id = p_asset_id;

  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason,
    before_snapshot, after_snapshot, occurred_at
  ) values (
    v_caller.tenant_id, p_asset_id, 'operational_status_change', auth.uid(), p_reason,
    jsonb_build_object('operational_status', v_asset.operational_status, 'condition', v_asset.condition),
    jsonb_build_object('operational_status', p_operational_status, 'condition', coalesce(p_condition, v_asset.condition::text)),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', p_asset_id, 'operational_status', p_operational_status);
end;
$$;

-- Public Wrapper: customer_api.update_asset_operational_status_v1
create or replace function customer_api.update_asset_operational_status_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_operational_status text,
  p_condition text default null,
  p_reason text default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.update_asset_operational_status_internal_v1(p_context_id, p_asset_id, p_operational_status, p_condition, p_reason);
end;
$$;

-- 12.7 Start Asset Downtime
-- Internal Definier: assets.start_asset_downtime_internal_v1
create or replace function assets.start_asset_downtime_internal_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_reason text,
  p_is_planned boolean default false,
  p_work_order_id uuid default null,
  p_ticket_id uuid default null,
  p_started_at timestamptz default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_downtime_id uuid;
  v_start timestamptz := coalesce(p_started_at, statement_timestamp());
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  -- Row lock asset
  perform 1 from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  insert into assets.asset_downtimes (
    tenant_id, asset_id, started_at, reason, is_planned,
    work_order_id, ticket_id, recorded_by
  ) values (
    v_caller.tenant_id, p_asset_id, v_start, p_reason, p_is_planned,
    p_work_order_id, p_ticket_id, auth.uid()
  ) returning id into v_downtime_id;

  -- Automatically update operational status to unavailable
  update assets.assets set
    operational_status = 'unavailable',
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'downtime_id', v_downtime_id, 'asset_id', p_asset_id);
end;
$$;

-- Public Wrapper: customer_api.start_asset_downtime_v1
create or replace function customer_api.start_asset_downtime_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_reason text,
  p_is_planned boolean default false,
  p_work_order_id uuid default null,
  p_ticket_id uuid default null,
  p_started_at timestamptz default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.start_asset_downtime_internal_v1(p_context_id, p_asset_id, p_reason, p_is_planned, p_work_order_id, p_ticket_id, p_started_at);
end;
$$;

-- 12.8 End Asset Downtime (Atomic Single-Winner)
-- Internal Definier: assets.end_asset_downtime_internal_v1
create or replace function assets.end_asset_downtime_internal_v1(
  p_context_id uuid,
  p_downtime_id uuid,
  p_ended_at timestamptz default null,
  p_restored_operational_status text default 'operational'
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_dt record;
  v_end timestamptz := coalesce(p_ended_at, statement_timestamp());
  v_duration integer;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  -- Atomic select for update ensuring exactly one winner
  select * into v_dt from assets.asset_downtimes
  where id = p_downtime_id and tenant_id = v_caller.tenant_id and ended_at is null
  for update;

  if not found then
    raise exception 'DOWNTIME_NOT_ACTIVE: Active downtime session % not found', p_downtime_id;
  end if;

  if v_end <= v_dt.started_at then
    raise exception 'INVALID_END_TIME: Downtime end time must be strictly after started_at';
  end if;

  v_duration := greatest(0, floor(extract(epoch from (v_end - v_dt.started_at)) / 60)::integer);

  update assets.asset_downtimes set
    ended_at = v_end,
    duration_minutes = v_duration
  where id = p_downtime_id;

  -- Restore operational status
  update assets.assets set
    operational_status = p_restored_operational_status,
    updated_at = statement_timestamp()
  where id = v_dt.asset_id;

  return jsonb_build_object('success', true, 'downtime_id', p_downtime_id, 'duration_minutes', v_duration);
end;
$$;

-- Public Wrapper: customer_api.end_asset_downtime_v1
create or replace function customer_api.end_asset_downtime_v1(
  p_context_id uuid,
  p_downtime_id uuid,
  p_ended_at timestamptz default null,
  p_restored_operational_status text default 'operational'
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.end_asset_downtime_internal_v1(p_context_id, p_downtime_id, p_ended_at, p_restored_operational_status);
end;
$$;

-- 12.9 List Asset Inspections
-- Internal Definier: assets.list_asset_inspections_internal_v1
create or replace function assets.list_asset_inspections_internal_v1(
  p_context_id uuid,
  p_asset_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_items jsonb;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'inspection_type', i.inspection_type,
      'scheduled_date', i.scheduled_date,
      'performed_at', i.performed_at,
      'result', i.result,
      'inspector_name', i.inspector_name,
      'observations', i.observations,
      'corrective_action_required', i.corrective_action_required,
      'next_due_date', i.next_due_date,
      'is_verified', i.is_verified,
      'verified_at', i.verified_at,
      'document_id', i.document_id,
      'policy_id', i.policy_id
    ) order by i.scheduled_date desc
  ), '[]'::jsonb) into v_items
  from assets.asset_inspections i
  where i.asset_id = p_asset_id and i.tenant_id = v_caller.tenant_id;

  return jsonb_build_object('items', v_items);
end;
$$;

-- Public Wrapper: customer_api.list_asset_inspections_v1
create or replace function customer_api.list_asset_inspections_v1(
  p_context_id uuid,
  p_asset_id uuid
)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.list_asset_inspections_internal_v1(p_context_id, p_asset_id);
end;
$$;

-- 12.10 Record Asset Inspection
-- Internal Definier: assets.record_asset_inspection_internal_v1
create or replace function assets.record_asset_inspection_internal_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_inspection_type text,
  p_scheduled_date date,
  p_performed_at timestamptz default null,
  p_result text default 'pending',
  p_inspector_name text default null,
  p_inspector_vendor_id uuid default null,
  p_observations text default null,
  p_corrective_action_required text default null,
  p_document_id uuid default null,
  p_policy_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_asset record;
  v_policy record;
  v_snapshot jsonb := null;
  v_next_due date := null;
  v_insp_id uuid;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if p_policy_id is not null then
    select * into v_policy from assets.compliance_policies
    where id = p_policy_id and tenant_id = v_caller.tenant_id;
    if not found then
      raise exception 'compliance_policy_unconfigured: Compliance policy % not found or inactive', p_policy_id;
    end if;

    v_snapshot := jsonb_build_object(
      'policy_code', v_policy.policy_code,
      'version', v_policy.version,
      'interval_months', v_policy.interval_months,
      'legal_source_reference', v_policy.legal_source_reference
    );

    if p_result in ('passed', 'passed_with_observations') and p_performed_at is not null then
      v_next_due := (p_performed_at::date + (v_policy.interval_months || ' months')::interval)::date;
    end if;
  elsif p_inspection_type in ('statutory_compliance', 'statutory', 'mandatory_safety', 'annual_safety') then
    select cp.* into v_policy from assets.compliance_policies cp
    join assets.asset_categories ac on ac.id = v_asset.category_id
    where cp.tenant_id = v_caller.tenant_id
      and cp.category_code = ac.code
      and cp.approval_status = 'APPROVED'
      and (cp.property_id is null or cp.property_id = v_asset.property_id)
      and (cp.effective_to is null or cp.effective_to >= current_date)
      and cp.effective_from <= current_date
    order by (cp.property_id is not null) desc, cp.version desc
    limit 1;

    if not found then
      raise exception 'compliance_policy_unconfigured: No active statutory compliance policy configured for asset category';
    end if;

    p_policy_id := v_policy.id;
    v_snapshot := jsonb_build_object(
      'policy_code', v_policy.policy_code,
      'version', v_policy.version,
      'interval_months', v_policy.interval_months,
      'legal_source_reference', v_policy.legal_source_reference
    );

    if p_result in ('passed', 'passed_with_observations') and p_performed_at is not null then
      v_next_due := (p_performed_at::date + (v_policy.interval_months || ' months')::interval)::date;
    end if;
  end if;

  insert into assets.asset_inspections (
    tenant_id, asset_id, policy_id, policy_version_snapshot, inspection_type,
    scheduled_date, performed_at, result, inspector_name, inspector_vendor_id,
    observations, corrective_action_required, next_due_date, document_id, created_by
  ) values (
    v_caller.tenant_id, p_asset_id, p_policy_id, v_snapshot, p_inspection_type,
    p_scheduled_date, p_performed_at, p_result, p_inspector_name, p_inspector_vendor_id,
    p_observations, p_corrective_action_required, v_next_due, p_document_id, auth.uid()
  ) returning id into v_insp_id;

  -- If inspection failed and asset is safety critical, degrade operational status
  if p_result = 'failed' and v_asset.is_safety_critical then
    update assets.assets set
      operational_status = 'degraded',
      updated_at = statement_timestamp()
    where id = p_asset_id;
  end if;

  return jsonb_build_object('success', true, 'inspection_id', v_insp_id, 'next_due_date', v_next_due);
end;
$$;

-- Public Wrapper: customer_api.record_asset_inspection_v1
create or replace function customer_api.record_asset_inspection_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_inspection_type text,
  p_scheduled_date date,
  p_performed_at timestamptz default null,
  p_result text default 'pending',
  p_inspector_name text default null,
  p_inspector_vendor_id uuid default null,
  p_observations text default null,
  p_corrective_action_required text default null,
  p_document_id uuid default null,
  p_policy_id uuid default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.record_asset_inspection_internal_v1(p_context_id, p_asset_id, p_inspection_type, p_scheduled_date, p_performed_at, p_result, p_inspector_name, p_inspector_vendor_id, p_observations, p_corrective_action_required, p_document_id, p_policy_id);
end;
$$;

-- 12.11 Verify Asset Inspection (AAL2 Required)
-- Internal Definier: assets.verify_asset_inspection_internal_v1
create or replace function assets.verify_asset_inspection_internal_v1(
  p_context_id uuid,
  p_inspection_id uuid
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_insp record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.inspections.verify', true);

  select * into v_insp from assets.asset_inspections
  where id = p_inspection_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'INSPECTION_NOT_FOUND: Inspection % not found', p_inspection_id;
  end if;

  if v_insp.is_verified then
    raise exception 'ALREADY_VERIFIED: Inspection has already been certified';
  end if;

  update assets.asset_inspections set
    is_verified = true,
    verified_by = auth.uid(),
    verified_at = statement_timestamp(),
    updated_at = statement_timestamp()
  where id = p_inspection_id;

  return jsonb_build_object('success', true, 'inspection_id', p_inspection_id, 'verified_at', statement_timestamp());
end;
$$;

-- Public Wrapper: customer_api.verify_asset_inspection_v1
create or replace function customer_api.verify_asset_inspection_v1(
  p_context_id uuid,
  p_inspection_id uuid
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.verify_asset_inspection_internal_v1(p_context_id, p_inspection_id);
end;
$$;

-- 12.12 Get Asset Warranty
-- Internal Definier: assets.get_asset_warranty_internal_v1
create or replace function assets.get_asset_warranty_internal_v1(
  p_context_id uuid,
  p_asset_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_w record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);

  if v_caller.role_code in ('owner', 'tenant_resident') then
    raise exception 'ACCESS_DENIED: Commercial warranty terms restricted';
  end if;

  select * into v_w from assets.asset_warranties
  where asset_id = p_asset_id and tenant_id = v_caller.tenant_id
  order by ends_on desc limit 1;

  if not found then
    return jsonb_build_object('warranty', null);
  end if;

  return jsonb_build_object(
    'warranty', jsonb_build_object(
      'id', v_w.id,
      'status', case when v_w.ends_on < current_date and v_w.status = 'active' then 'expired' else v_w.status end,
      'starts_on', v_w.starts_on,
      'ends_on', v_w.ends_on,
      'vendor_id', v_w.vendor_id,
      'coverage_json', v_w.coverage_json,
      'warranty_terms', v_w.warranty_terms,
      'document_id', v_w.document_id,
      'created_at', v_w.created_at
    )
  );
end;
$$;

-- Public Wrapper: customer_api.get_asset_warranty_v1
create or replace function customer_api.get_asset_warranty_v1(
  p_context_id uuid,
  p_asset_id uuid
)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.get_asset_warranty_internal_v1(p_context_id, p_asset_id);
end;
$$;

-- 12.13 Upsert Asset Warranty
-- Internal Definier: assets.upsert_asset_warranty_internal_v1
create or replace function assets.upsert_asset_warranty_internal_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_vendor_id uuid default null,
  p_coverage_json jsonb default '{}'::jsonb,
  p_warranty_terms text default null,
  p_document_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_asset record;
  v_w_id uuid;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  if p_ends_on < p_starts_on then
    raise exception 'INVALID_WARRANTY_DATES: Warranty ends_on must be on or after starts_on';
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  insert into assets.asset_warranties (
    tenant_id, asset_id, starts_on, ends_on, vendor_id,
    coverage_json, warranty_terms, document_id
  ) values (
    v_caller.tenant_id, p_asset_id, p_starts_on, p_ends_on, p_vendor_id,
    coalesce(p_coverage_json, '{}'::jsonb), p_warranty_terms, p_document_id
  ) returning id into v_w_id;

  return jsonb_build_object('success', true, 'warranty_id', v_w_id);
end;
$$;

-- Public Wrapper: customer_api.upsert_asset_warranty_v1
create or replace function customer_api.upsert_asset_warranty_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_starts_on date,
  p_ends_on date,
  p_vendor_id uuid default null,
  p_coverage_json jsonb default '{}'::jsonb,
  p_warranty_terms text default null,
  p_document_id uuid default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.upsert_asset_warranty_internal_v1(p_context_id, p_asset_id, p_starts_on, p_ends_on, p_vendor_id, p_coverage_json, p_warranty_terms, p_document_id);
end;
$$;

-- 12.14 List Warranty Claims
-- Internal Definier: assets.list_warranty_claims_internal_v1
create or replace function assets.list_warranty_claims_internal_v1(
  p_context_id uuid,
  p_asset_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_items jsonb;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);

  if v_caller.role_code in ('owner', 'tenant_resident') then
    raise exception 'ACCESS_DENIED: Commercial warranty claims restricted';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'claim_reference', c.claim_reference,
      'claim_date', c.claim_date,
      'description', c.description,
      'resolution_status', c.resolution_status,
      'resolution_notes', c.resolution_notes,
      'document_id', c.document_id,
      'created_at', c.created_at
    ) order by c.claim_date desc
  ), '[]'::jsonb) into v_items
  from assets.asset_warranty_claims c
  where c.asset_id = p_asset_id and c.tenant_id = v_caller.tenant_id;

  return jsonb_build_object('items', v_items);
end;
$$;

-- Public Wrapper: customer_api.list_warranty_claims_v1
create or replace function customer_api.list_warranty_claims_v1(
  p_context_id uuid,
  p_asset_id uuid
)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.list_warranty_claims_internal_v1(p_context_id, p_asset_id);
end;
$$;

-- 12.15 Create Warranty Claim
-- Internal Definier: assets.create_warranty_claim_internal_v1
create or replace function assets.create_warranty_claim_internal_v1(
  p_context_id uuid,
  p_warranty_id uuid,
  p_claim_reference text,
  p_description text,
  p_claim_date date default current_date,
  p_document_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_w record;
  v_a record;
  v_snapshot jsonb;
  v_claim_id uuid;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_w from assets.asset_warranties
  where id = p_warranty_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'WARRANTY_NOT_FOUND: Warranty % not found', p_warranty_id;
  end if;

  select * into v_a from assets.assets where id = v_w.asset_id;

  v_snapshot := jsonb_build_object(
    'warranty_id', v_w.id,
    'starts_on', v_w.starts_on,
    'ends_on', v_w.ends_on,
    'vendor_id', v_w.vendor_id,
    'asset_code', v_a.asset_code,
    'asset_name', v_a.name
  );

  insert into assets.asset_warranty_claims (
    tenant_id, warranty_id, asset_id, claim_reference, claim_date,
    description, warranty_snapshot, document_id, created_by
  ) values (
    v_caller.tenant_id, p_warranty_id, v_w.asset_id, trim(p_claim_reference), p_claim_date,
    p_description, v_snapshot, p_document_id, auth.uid()
  ) returning id into v_claim_id;

  return jsonb_build_object('success', true, 'claim_id', v_claim_id);
end;
$$;

-- Public Wrapper: customer_api.create_warranty_claim_v1
create or replace function customer_api.create_warranty_claim_v1(
  p_context_id uuid,
  p_warranty_id uuid,
  p_claim_reference text,
  p_description text,
  p_claim_date date default current_date,
  p_document_id uuid default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.create_warranty_claim_internal_v1(p_context_id, p_warranty_id, p_claim_reference, p_description, p_claim_date, p_document_id);
end;
$$;

-- 12.16 Resolve Warranty Claim
-- Internal Definier: assets.resolve_warranty_claim_internal_v1
create or replace function assets.resolve_warranty_claim_internal_v1(
  p_context_id uuid,
  p_claim_id uuid,
  p_resolution_status text,
  p_resolution_notes text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_claim record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  if p_resolution_status not in ('in_review','accepted','rejected','resolved') then
    raise exception 'INVALID_STATUS: Resolution status % not allowed', p_resolution_status;
  end if;

  select * into v_claim from assets.asset_warranty_claims
  where id = p_claim_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'CLAIM_NOT_FOUND: Claim % not found', p_claim_id;
  end if;

  update assets.asset_warranty_claims set
    resolution_status = p_resolution_status,
    resolution_notes = coalesce(p_resolution_notes, resolution_notes),
    updated_at = statement_timestamp()
  where id = p_claim_id;

  return jsonb_build_object('success', true, 'claim_id', p_claim_id, 'resolution_status', p_resolution_status);
end;
$$;

-- Public Wrapper: customer_api.resolve_warranty_claim_v1
create or replace function customer_api.resolve_warranty_claim_v1(
  p_context_id uuid,
  p_claim_id uuid,
  p_resolution_status text,
  p_resolution_notes text default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.resolve_warranty_claim_internal_v1(p_context_id, p_claim_id, p_resolution_status, p_resolution_notes);
end;
$$;

-- 12.17 List Compliance Policies
-- Internal Definier: assets.list_compliance_policies_internal_v1
create or replace function assets.list_compliance_policies_internal_v1(
  p_context_id uuid,
  p_category_code text default null
)
returns jsonb language plpgsql stable security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_items jsonb;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.read', false);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'policy_code', p.policy_code,
      'category_code', p.category_code,
      'property_id', p.property_id,
      'jurisdiction', p.jurisdiction,
      'interval_months', p.interval_months,
      'is_safety_mandatory', p.is_safety_mandatory,
      'legal_source_reference', p.legal_source_reference,
      'approval_status', p.approval_status,
      'effective_from', p.effective_from,
      'effective_to', p.effective_to,
      'version', p.version
    ) order by p.created_at desc
  ), '[]'::jsonb) into v_items
  from assets.compliance_policies p
  where p.tenant_id = v_caller.tenant_id
    and (p_category_code is null or p.category_code = p_category_code);

  return jsonb_build_object('items', v_items);
end;
$$;

-- Public Wrapper: customer_api.list_compliance_policies_v1
create or replace function customer_api.list_compliance_policies_v1(
  p_context_id uuid,
  p_category_code text default null
)
returns jsonb language plpgsql stable security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.list_compliance_policies_internal_v1(p_context_id, p_category_code);
end;
$$;

-- 12.18 Configure Compliance Policy
-- Internal Definier: assets.configure_compliance_policy_internal_v1
create or replace function assets.configure_compliance_policy_internal_v1(
  p_context_id uuid,
  p_policy_code text,
  p_category_code text,
  p_interval_months integer,
  p_legal_source_reference text,
  p_effective_from date,
  p_effective_to date default null,
  p_property_id uuid default null,
  p_is_safety_mandatory boolean default false,
  p_jurisdiction text default 'RO'
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_policy_id uuid;
  v_ver integer := 1;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', true);

  -- Determine version
  select coalesce(max(version), 0) + 1 into v_ver
  from assets.compliance_policies
  where tenant_id = v_caller.tenant_id and policy_code = trim(p_policy_code);

  insert into assets.compliance_policies (
    tenant_id, policy_code, category_code, property_id, jurisdiction,
    interval_months, is_safety_mandatory, legal_source_reference,
    approval_status, effective_from, effective_to, version, created_by
  ) values (
    v_caller.tenant_id, trim(p_policy_code), trim(p_category_code), p_property_id, p_jurisdiction,
    p_interval_months, p_is_safety_mandatory, trim(p_legal_source_reference),
    'APPROVED', p_effective_from, p_effective_to, v_ver, auth.uid()
  ) returning id into v_policy_id;

  return jsonb_build_object('success', true, 'policy_id', v_policy_id, 'version', v_ver);
end;
$$;

-- Public Wrapper: customer_api.configure_compliance_policy_v1
create or replace function customer_api.configure_compliance_policy_v1(
  p_context_id uuid,
  p_policy_code text,
  p_category_code text,
  p_interval_months integer,
  p_legal_source_reference text,
  p_effective_from date,
  p_effective_to date default null,
  p_property_id uuid default null,
  p_is_safety_mandatory boolean default false,
  p_jurisdiction text default 'RO'
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.configure_compliance_policy_internal_v1(p_context_id, p_policy_code, p_category_code, p_interval_months, p_legal_source_reference, p_effective_from, p_effective_to, p_property_id, p_is_safety_mandatory, p_jurisdiction);
end;
$$;

-- 12.19 Request Asset Decommission
-- Internal Definier: assets.request_asset_decommission_internal_v1
create or replace function assets.request_asset_decommission_internal_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_reason text,
  p_replacement_asset_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_asset record;
  v_req_id uuid;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % not found in tenant', p_asset_id;
  end if;

  if v_asset.lifecycle_status in ('decommissioned', 'disposed') then
    raise exception 'ASSET_ALREADY_DECOMMISSIONED: Cannot request decommission for already decommissioned asset';
  end if;

  if p_replacement_asset_id is not null then
    perform 1 from assets.assets
    where id = p_replacement_asset_id and tenant_id = v_caller.tenant_id;
    if not found then
      raise exception 'REPLACEMENT_ASSET_NOT_FOUND: Replacement asset not found in same tenant';
    end if;
  end if;

  insert into assets.asset_decommission_requests (
    tenant_id, asset_id, replacement_asset_id, status, reason, requested_by
  ) values (
    v_caller.tenant_id, p_asset_id, p_replacement_asset_id, 'pending', p_reason, auth.uid()
  ) returning id into v_req_id;

  -- Set session authorization flag for decommission transition
  perform set_config('cladora.decommission_authorized', 'true', true);

  update assets.assets set
    lifecycle_status = 'decommission_pending',
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'request_id', v_req_id);
end;
$$;

-- Public Wrapper: customer_api.request_asset_decommission_v1
create or replace function customer_api.request_asset_decommission_v1(
  p_context_id uuid,
  p_asset_id uuid,
  p_reason text,
  p_replacement_asset_id uuid default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.request_asset_decommission_internal_v1(p_context_id, p_asset_id, p_reason, p_replacement_asset_id);
end;
$$;

-- 12.20 Approve Asset Decommission (Dual-Control for Critical Assets + AAL2)
-- Internal Definier: assets.approve_asset_decommission_internal_v1
create or replace function assets.approve_asset_decommission_internal_v1(
  p_context_id uuid,
  p_request_id uuid,
  p_approved boolean,
  p_rejection_reason text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_req record;
  v_asset record;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.decommission', true);

  select * into v_req from assets.asset_decommission_requests
  where id = p_request_id and tenant_id = v_caller.tenant_id for update;

  if not found or v_req.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING: Decommission request % is not pending', p_request_id;
  end if;

  select * into v_asset from assets.assets
  where id = v_req.asset_id and tenant_id = v_caller.tenant_id for update;

  -- Dual-control: If safety-critical, approver cannot be the same as requester
  if (v_asset.is_safety_critical or v_asset.criticality_level = 'critical') and v_req.requested_by = auth.uid() then
    raise exception 'dual_control_required_for_critical_asset: independent approver required for critical asset decommission';
  end if;

  if p_approved then
    update assets.asset_decommission_requests set
      status = 'approved',
      approved_by = auth.uid(),
      approved_at = statement_timestamp()
    where id = p_request_id;

    -- Set session authorization flag
    perform set_config('cladora.decommission_authorized', 'true', true);

    update assets.assets set
      lifecycle_status = 'decommissioned',
      operational_status = 'isolated',
      retired_at = statement_timestamp(),
      updated_at = statement_timestamp()
    where id = v_asset.id;

    insert into assets.asset_history (
      tenant_id, asset_id, event_type, actor_id, reason, occurred_at
    ) values (
      v_caller.tenant_id, v_asset.id, 'asset_decommissioned', auth.uid(), v_req.reason, statement_timestamp()
    );
  else
    update assets.asset_decommission_requests set
      status = 'rejected',
      approved_by = auth.uid(),
      approved_at = statement_timestamp(),
      rejection_reason = p_rejection_reason
    where id = p_request_id;

    perform set_config('cladora.decommission_authorized', 'true', true);

    update assets.assets set
      lifecycle_status = 'active',
      updated_at = statement_timestamp()
    where id = v_asset.id;
  end if;

  return jsonb_build_object('success', true, 'request_id', p_request_id, 'approved', p_approved);
end;
$$;

-- Public Wrapper: customer_api.approve_asset_decommission_v1
create or replace function customer_api.approve_asset_decommission_v1(
  p_context_id uuid,
  p_request_id uuid,
  p_approved boolean,
  p_rejection_reason text default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;
  return assets.approve_asset_decommission_internal_v1(p_context_id, p_request_id, p_approved, p_rejection_reason);
end;
$$;

-- ----------------------------------------------------------------------------
-- 13. Revoke from public, anon; Grant to authenticated
-- ----------------------------------------------------------------------------
do $$
declare
  r text;
  funcs text[] := array[
    'list_assets_v1',
    'get_asset_detail_v1',
    'create_asset_v1',
    'update_asset_v1',
    'transition_asset_lifecycle_v1',
    'update_asset_operational_status_v1',
    'start_asset_downtime_v1',
    'end_asset_downtime_v1',
    'list_asset_inspections_v1',
    'record_asset_inspection_v1',
    'verify_asset_inspection_v1',
    'get_asset_warranty_v1',
    'upsert_asset_warranty_v1',
    'list_warranty_claims_v1',
    'create_warranty_claim_v1',
    'resolve_warranty_claim_v1',
    'list_compliance_policies_v1',
    'configure_compliance_policy_v1',
    'request_asset_decommission_v1',
    'approve_asset_decommission_v1'
  ];
begin
  foreach r in array funcs loop
    execute format('revoke all on function customer_api.%I from public, anon', r);
    execute format('grant execute on function customer_api.%I to authenticated', r);
  end loop;
end;
$$;



-- CANONICAL RANGE supabase/migrations/20261004083417_asset_registration_scope_guard.sql:2-106

-- Tighten existing asset creation; no role or EXECUTE grants change.
create or replace function assets.create_asset_internal_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_category_id uuid,
  p_asset_code text,
  p_name text,
  p_scope text default 'property',
  p_building_id uuid default null,
  p_unit_id uuid default null,
  p_description text default null,
  p_manufacturer text default null,
  p_model text default null,
  p_serial_number text default null,
  p_manufacture_year integer default null,
  p_installed_on date default null,
  p_location_description text default null,
  p_ownership_type text default 'association',
  p_condition text default 'unknown',
  p_criticality_level text default 'medium',
  p_is_safety_critical boolean default false,
  p_replacement_cost numeric default null,
  p_currency text default 'RON',
  p_meter_id uuid default null,
  p_access_point_id uuid default null,
  p_vendor_id uuid default null,
  p_service_contract_id uuid default null,
  p_service_frequency_months integer default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_asset_id uuid;
  v_serial_fp text := null;
  v_crit_num smallint := 3;
begin
  v_caller := assets.check_asset_caller_v1(p_context_id, 'assets.manage', false);

  -- Authorization ceiling is independent of entity relationship integrity triggers.
  if not exists (
    select 1 from identity.context_grants g join identity.memberships m
      on m.id=g.membership_id and m.tenant_id=g.tenant_id
    where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
  ) then raise exception 'asset_context_access_denied' using errcode='42501'; end if;

  if not exists (select 1 from portfolio.properties p where p.id=p_property_id and p.tenant_id=v_caller.tenant_id)
    or not exists (select 1 from assets.asset_categories c where c.id=p_category_id and c.tenant_id=v_caller.tenant_id and c.status='active')
  then raise exception 'asset_entity_scope_invalid' using errcode='22023'; end if;

  if v_caller.scope_type not in ('tenant','property','building','unit')
    or (v_caller.scope_type='property' and p_property_id is distinct from v_caller.property_id)
    or (v_caller.scope_type='building' and (p_building_id is distinct from v_caller.building_id or p_scope not in ('building','common_area','unit')))
    or (v_caller.scope_type='unit' and (p_unit_id is distinct from v_caller.unit_id or p_scope<>'unit'))
  then raise exception 'asset_context_scope_violation' using errcode='42501'; end if;


  if p_is_safety_critical or p_criticality_level = 'critical' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  if p_serial_number is not null and trim(p_serial_number) <> '' then
    v_serial_fp := encode(digest(trim(p_serial_number), 'sha256'), 'hex');
  end if;

  case p_criticality_level
    when 'low' then v_crit_num := 1;
    when 'medium' then v_crit_num := 3;
    when 'high' then v_crit_num := 4;
    when 'critical' then v_crit_num := 5;
    else v_crit_num := 3;
  end case;

  insert into assets.assets (
    tenant_id, property_id, category_id, asset_code, name, scope,
    building_id, unit_id, description, manufacturer, model,
    serial_number_encrypted, serial_fingerprint, manufacture_year, installed_on,
    location_description, ownership_type, lifecycle_status, operational_status,
    condition, criticality_level, criticality, is_safety_critical, replacement_cost,
    currency, meter_id, access_point_id, vendor_id, service_contract_id,
    service_frequency_months, created_by
  ) values (
    v_caller.tenant_id, p_property_id, p_category_id, trim(p_asset_code), trim(p_name), p_scope::assets.asset_scope,
    p_building_id, p_unit_id, p_description, p_manufacturer, p_model,
    p_serial_number, v_serial_fp, p_manufacture_year, p_installed_on,
    p_location_description, p_ownership_type, 'planned', 'operational',
    p_condition::assets.asset_condition, p_criticality_level, v_crit_num, p_is_safety_critical, p_replacement_cost,
    p_currency, p_meter_id, p_access_point_id, p_vendor_id, p_service_contract_id,
    p_service_frequency_months, auth.uid()
  ) returning id into v_asset_id;

  -- Record audit event
  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason, occurred_at
  ) values (
    v_caller.tenant_id, v_asset_id, 'asset_created', auth.uid(), 'Initial creation in planned status', statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', v_asset_id);
end;
$$;



-- CANONICAL RANGE supabase/migrations/20261004084822_asset_equipment_registration_gateway.sql:2-73
create function assets.registration_context_v1(p_context_id uuid) returns record
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record;
begin
 v:=assets.check_asset_caller_v1(p_context_id,'assets.manage',false);
 if v.scope_type not in ('tenant','property','building') or not exists(
  select 1 from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
   and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
 ) then raise exception 'asset_context_access_denied' using errcode='42501'; end if;
 return v;
end $$;
revoke all on function assets.registration_context_v1(uuid) from public,anon,authenticated;

create function assets.registration_choices_v1(p_context_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record; properties jsonb; buildings jsonb;
begin
 v:=assets.registration_context_v1(p_context_id);
 select coalesce(jsonb_agg(q),'[]'::jsonb) into properties from (
  select p.id,p.name from portfolio.properties p where p.tenant_id=v.tenant_id and p.status='active'
   and (v.scope_type='tenant' or (v.scope_type='property' and p.id=v.property_id)
    or (v.scope_type='building' and exists(select 1 from portfolio.buildings b where b.id=v.building_id and b.tenant_id=v.tenant_id and b.property_id=p.id)))
  order by p.name,p.id limit 200
 ) q;
 select coalesce(jsonb_agg(q),'[]'::jsonb) into buildings from (
  select b.id,b.name,b.property_id from portfolio.buildings b where b.tenant_id=v.tenant_id and b.status='active'
   and exists(select 1 from jsonb_array_elements(properties) p where p->>'id'=b.property_id::text)
   and (v.scope_type<>'building' or b.id=v.building_id)
  order by b.name,b.id limit 500
 ) q;
 return jsonb_build_object('properties',properties,'buildings',buildings,'building_required',v.scope_type='building');
end $$;
revoke all on function assets.registration_choices_v1(uuid) from public,anon;
grant execute on function assets.registration_choices_v1(uuid) to authenticated;
create function customer_api.get_asset_registration_choices_v1(p_context_id uuid) returns jsonb
language sql stable security invoker set search_path=pg_catalog as $$ select assets.registration_choices_v1(p_context_id) $$;
revoke all on function customer_api.get_asset_registration_choices_v1(uuid) from public,anon;
grant execute on function customer_api.get_asset_registration_choices_v1(uuid) to authenticated;

create function assets.register_equipment_v1(p_context_id uuid,p_property_id uuid,p_building_id uuid,p_category_code text,p_asset_code text,p_name text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v record; category_id uuid; category_name text; result jsonb;
begin
 v:=assets.registration_context_v1(p_context_id);
 if p_category_code not in ('ventilation','pump','elevator','fire_safety','other') or p_category_code is null
  or p_asset_code is null or length(trim(p_asset_code)) not between 1 and 64
  or p_name is null or length(trim(p_name)) not between 1 and 255
 then raise exception 'asset_registration_invalid' using errcode='22023'; end if;
 category_name:=case p_category_code when 'ventilation' then 'Ventilation' when 'pump' then 'Pump' when 'elevator' then 'Elevator' when 'fire_safety' then 'Fire safety' else 'Other equipment' end;
 -- The transaction rolls category creation back if guarded registration fails.
 insert into assets.asset_categories(tenant_id,code,name,status) values(v.tenant_id,p_category_code,category_name,'active')
 on conflict(tenant_id,code) do nothing returning id into category_id;
 if category_id is not null then
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
  values(v.tenant_id,auth.uid(),v.role_code,'ASSET_CATEGORY_CREATED','assets.category',category_id,'Equipment registration category',jsonb_build_object('code',p_category_code,'name',category_name));
 end if;
 select c.id into category_id from assets.asset_categories c where c.tenant_id=v.tenant_id and c.code=p_category_code and c.status='active';
 if category_id is null then raise exception 'asset_category_inactive' using errcode='22023'; end if;
 result:=assets.create_asset_internal_v1(p_context_id=>p_context_id,p_property_id=>p_property_id,p_category_id=>category_id,
  p_asset_code=>p_asset_code,p_name=>p_name,p_scope=>case when p_building_id is null then 'property' else 'building' end,
  p_building_id=>p_building_id,p_is_safety_critical=>p_category_code in ('elevator','fire_safety'),
  p_criticality_level=>case when p_category_code in ('elevator','fire_safety') then 'critical' else 'medium' end);
 return result;
end $$;
revoke all on function assets.register_equipment_v1(uuid,uuid,uuid,text,text,text) from public,anon;
grant execute on function assets.register_equipment_v1(uuid,uuid,uuid,text,text,text) to authenticated;
create function customer_api.register_equipment_v1(p_context_id uuid,p_property_id uuid,p_building_id uuid,p_category_code text,p_asset_code text,p_name text) returns jsonb
language sql security invoker set search_path=pg_catalog as $$ select assets.register_equipment_v1(p_context_id,p_property_id,p_building_id,p_category_code,p_asset_code,p_name) $$;
revoke all on function customer_api.register_equipment_v1(uuid,uuid,uuid,text,text,text) from public,anon;
grant execute on function customer_api.register_equipment_v1(uuid,uuid,uuid,text,text,text) to authenticated;


-- CANONICAL RANGE supabase/migrations/20261021085559_assets_current_authority_v1.sql:2-81

-- Preserve the existing shared authority contract and ACL. This adds current
-- Context/member validity only; no parallel identity or permission engine.
CREATE OR REPLACE FUNCTION assets.check_asset_caller_v1(p_context_id uuid, p_required_permission text, p_require_aal2 boolean DEFAULT false)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'identity', 'platform'
AS $function$
declare
  v_rec record;
  v_uid uuid := auth.uid();
  v_aal text;
begin
  if v_uid is null then
    raise exception 'AUTHENTICATION_REQUIRED: Valid user session required' using errcode = '42501';
  end if;

  select coalesce(auth.jwt()->>'aal', 'aal1') into v_aal;
  if p_require_aal2 and v_aal <> 'aal2' then
    raise exception 'MFA_REQUIRED: Elevated AAL2 authentication required' using errcode = '42501';
  end if;

  select
    g.tenant_id,
    g.membership_id,
    m.user_id,
    r.code as role_code,
    g.scope_type::text as scope_type,
    g.property_id,
    g.building_id,
    g.unit_id,
    m.role_id
  into v_rec
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = v_uid
    and m.status = 'active';

  if not found then
    raise exception 'ACCESS_DENIED: User context invalid or inactive' using errcode = '42501';
  end if;

  -- BEGIN current-authority guard: start inclusive, end exclusive.
  if not exists (
    select 1
    from identity.context_grants g
    join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
    where g.id = p_context_id and m.user_id = v_uid and m.status = 'active'
      and g.starts_at <= statement_timestamp()
      and (g.ends_at is null or g.ends_at > statement_timestamp())
      and m.starts_at <= statement_timestamp()
      and (m.ends_at is null or m.ends_at > statement_timestamp())
  ) then
    -- Preserve the established creation/registration temporal-denial message.
    -- This affects error formatting only, never whether permission is granted.
    if p_required_permission = 'assets.manage' then
      raise exception 'asset_context_access_denied' using errcode = '42501';
    end if;
    raise exception 'ACCESS_DENIED: User context invalid or inactive' using errcode = '42501';
  end if;
  -- END current-authority guard.

  -- Check explicit permission
  if p_required_permission is not null then
    if not exists (
      select 1 from identity.role_permissions rp
      join identity.permissions p on p.id = rp.permission_id
      where rp.role_id = v_rec.role_id and p.code = p_required_permission and rp.effect = 'allow'
    ) then
      raise exception 'INSUFFICIENT_PERMISSIONS: Required permission %', p_required_permission using errcode = '42501';
    end if;
  end if;

  return v_rec;
end;
$function$;



-- CANONICAL RANGE supabase/migrations/20261021093426_assets_explicit_caller_descriptor_v1.sql:2-1211

-- Bind the existing anonymous caller record explicitly at each consumer.
-- Only record assignment syntax changes; domain logic, signatures and ACL stay.
CREATE OR REPLACE FUNCTION assets.list_assets_internal_v1(p_context_id uuid, p_property_id uuid DEFAULT NULL::uuid, p_building_id uuid DEFAULT NULL::uuid, p_category_id uuid DEFAULT NULL::uuid, p_lifecycle_status text DEFAULT NULL::text, p_operational_status text DEFAULT NULL::text, p_condition text DEFAULT NULL::text, p_criticality_level text DEFAULT NULL::text, p_is_safety_critical boolean DEFAULT NULL::boolean, p_search text DEFAULT NULL::text, p_limit integer DEFAULT 25, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_is_restricted boolean := false;
  v_total bigint;
  v_items jsonb;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.read', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);
  if v_caller.role_code in ('owner', 'tenant_resident') then
    v_is_restricted := true;
  end if;

  select count(*) into v_total
  from assets.assets a
  where a.tenant_id = v_caller.tenant_id
    and (p_property_id is null or a.property_id = p_property_id)
    and (p_building_id is null or a.building_id = p_building_id)
    and (p_category_id is null or a.category_id = p_category_id)
    and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
    and (p_operational_status is null or a.operational_status = p_operational_status)
    and (p_condition is null or a.condition::text = p_condition)
    and (p_criticality_level is null or a.criticality_level = p_criticality_level)
    and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
    and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%');

  if v_is_restricted then
    -- Projected allowlist for owner / resident (excludes confidential commercial, serial, cost, vendor data)
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'asset_code', a.asset_code,
        'name', a.name,
        'category_id', a.category_id,
        'property_id', a.property_id,
        'building_id', a.building_id,
        'unit_id', a.unit_id,
        'scope', a.scope,
        'location_description', a.location_description,
        'lifecycle_status', a.lifecycle_status,
        'operational_status', a.operational_status,
        'condition', a.condition,
        'criticality_level', a.criticality_level,
        'is_safety_critical', a.is_safety_critical,
        'installed_on', a.installed_on,
        'commissioned_at', a.commissioned_at,
        'created_at', a.created_at
      ) order by a.created_at desc
    ), '[]'::jsonb) into v_items
    from (
      select * from assets.assets a
      where a.tenant_id = v_caller.tenant_id
        and (p_property_id is null or a.property_id = p_property_id)
        and (p_building_id is null or a.building_id = p_building_id)
        and (p_category_id is null or a.category_id = p_category_id)
        and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
        and (p_operational_status is null or a.operational_status = p_operational_status)
        and (p_condition is null or a.condition::text = p_condition)
        and (p_criticality_level is null or a.criticality_level = p_criticality_level)
        and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
        and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%')
      order by a.created_at desc
      limit coalesce(p_limit, 25) offset coalesce(p_offset, 0)
    ) a;
  else
    -- Full administrative projection
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'asset_code', a.asset_code,
        'name', a.name,
        'description', a.description,
        'category_id', a.category_id,
        'property_id', a.property_id,
        'building_id', a.building_id,
        'unit_id', a.unit_id,
        'scope', a.scope,
        'manufacturer', a.manufacturer,
        'model', a.model,
        'serial_fingerprint', a.serial_fingerprint,
        'manufacture_year', a.manufacture_year,
        'installed_on', a.installed_on,
        'commissioned_at', a.commissioned_at,
        'location_description', a.location_description,
        'ownership_type', a.ownership_type,
        'lifecycle_status', a.lifecycle_status,
        'operational_status', a.operational_status,
        'condition', a.condition,
        'criticality_level', a.criticality_level,
        'criticality', a.criticality,
        'is_safety_critical', a.is_safety_critical,
        'replacement_cost', a.replacement_cost,
        'currency', a.currency,
        'meter_id', a.meter_id,
        'access_point_id', a.access_point_id,
        'vendor_id', a.vendor_id,
        'service_contract_id', a.service_contract_id,
        'service_frequency_months', a.service_frequency_months,
        'last_service_date', a.last_service_date,
        'next_service_date', a.next_service_date,
        'created_at', a.created_at,
        'updated_at', a.updated_at
      ) order by a.created_at desc
    ), '[]'::jsonb) into v_items
    from (
      select * from assets.assets a
      where a.tenant_id = v_caller.tenant_id
        and (p_property_id is null or a.property_id = p_property_id)
        and (p_building_id is null or a.building_id = p_building_id)
        and (p_category_id is null or a.category_id = p_category_id)
        and (p_lifecycle_status is null or a.lifecycle_status = p_lifecycle_status)
        and (p_operational_status is null or a.operational_status = p_operational_status)
        and (p_condition is null or a.condition::text = p_condition)
        and (p_criticality_level is null or a.criticality_level = p_criticality_level)
        and (p_is_safety_critical is null or a.is_safety_critical = p_is_safety_critical)
        and (p_search is null or a.name ilike '%' || p_search || '%' or a.asset_code ilike '%' || p_search || '%' or a.manufacturer ilike '%' || p_search || '%' or a.model ilike '%' || p_search || '%')
      order by a.created_at desc
      limit coalesce(p_limit, 25) offset coalesce(p_offset, 0)
    ) a;
  end if;

  return jsonb_build_object(
    'total', v_total,
    'limit', coalesce(p_limit, 25),
    'offset', coalesce(p_offset, 0),
    'items', v_items
  );
end;
$function$;

CREATE OR REPLACE FUNCTION assets.get_asset_detail_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_is_restricted boolean := false;
  v_asset record;
  v_warranty record;
  v_active_downtime record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.read', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);
  if v_caller.role_code in ('owner', 'tenant_resident') then
    v_is_restricted := true;
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  select * into v_active_downtime from assets.asset_downtimes
  where asset_id = p_asset_id and ended_at is null
  order by started_at desc limit 1;

  if v_is_restricted then
    return jsonb_build_object(
      'id', v_asset.id,
      'asset_code', v_asset.asset_code,
      'name', v_asset.name,
      'category_id', v_asset.category_id,
      'property_id', v_asset.property_id,
      'building_id', v_asset.building_id,
      'unit_id', v_asset.unit_id,
      'scope', v_asset.scope,
      'location_description', v_asset.location_description,
      'lifecycle_status', v_asset.lifecycle_status,
      'operational_status', v_asset.operational_status,
      'condition', v_asset.condition,
      'criticality_level', v_asset.criticality_level,
      'is_safety_critical', v_asset.is_safety_critical,
      'installed_on', v_asset.installed_on,
      'commissioned_at', v_asset.commissioned_at,
      'is_in_downtime', (v_active_downtime.id is not null)
    );
  end if;

  select * into v_warranty from assets.asset_warranties
  where asset_id = p_asset_id order by ends_on desc limit 1;

  return jsonb_build_object(
    'id', v_asset.id,
    'asset_code', v_asset.asset_code,
    'name', v_asset.name,
    'description', v_asset.description,
    'category_id', v_asset.category_id,
    'property_id', v_asset.property_id,
    'building_id', v_asset.building_id,
    'unit_id', v_asset.unit_id,
    'scope', v_asset.scope,
    'manufacturer', v_asset.manufacturer,
    'model', v_asset.model,
    'serial_fingerprint', v_asset.serial_fingerprint,
    'manufacture_year', v_asset.manufacture_year,
    'installed_on', v_asset.installed_on,
    'commissioned_at', v_asset.commissioned_at,
    'location_description', v_asset.location_description,
    'ownership_type', v_asset.ownership_type,
    'lifecycle_status', v_asset.lifecycle_status,
    'operational_status', v_asset.operational_status,
    'condition', v_asset.condition,
    'criticality_level', v_asset.criticality_level,
    'criticality', v_asset.criticality,
    'is_safety_critical', v_asset.is_safety_critical,
    'replacement_cost', v_asset.replacement_cost,
    'currency', v_asset.currency,
    'meter_id', v_asset.meter_id,
    'access_point_id', v_asset.access_point_id,
    'vendor_id', v_asset.vendor_id,
    'service_contract_id', v_asset.service_contract_id,
    'service_frequency_months', v_asset.service_frequency_months,
    'last_service_date', v_asset.last_service_date,
    'next_service_date', v_asset.next_service_date,
    'warranty', case when v_warranty.id is not null then jsonb_build_object(
      'id', v_warranty.id,
      'status', v_warranty.status,
      'starts_on', v_warranty.starts_on,
      'ends_on', v_warranty.ends_on,
      'vendor_id', v_warranty.vendor_id,
      'coverage_json', v_warranty.coverage_json,
      'document_id', v_warranty.document_id
    ) else null end,
    'active_downtime', case when v_active_downtime.id is not null then jsonb_build_object(
      'id', v_active_downtime.id,
      'started_at', v_active_downtime.started_at,
      'reason', v_active_downtime.reason,
      'is_planned', v_active_downtime.is_planned
    ) else null end,
    'created_at', v_asset.created_at,
    'updated_at', v_asset.updated_at
  );
end;
$function$;

create or replace function assets.create_asset_internal_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_category_id uuid,
  p_asset_code text,
  p_name text,
  p_scope text default 'property',
  p_building_id uuid default null,
  p_unit_id uuid default null,
  p_description text default null,
  p_manufacturer text default null,
  p_model text default null,
  p_serial_number text default null,
  p_manufacture_year integer default null,
  p_installed_on date default null,
  p_location_description text default null,
  p_ownership_type text default 'association',
  p_condition text default 'unknown',
  p_criticality_level text default 'medium',
  p_is_safety_critical boolean default false,
  p_replacement_cost numeric default null,
  p_currency text default 'RON',
  p_meter_id uuid default null,
  p_access_point_id uuid default null,
  p_vendor_id uuid default null,
  p_service_contract_id uuid default null,
  p_service_frequency_months integer default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_asset_id uuid;
  v_serial_fp text := null;
  v_crit_num smallint := 3;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  -- Authorization ceiling is independent of entity relationship integrity triggers.
  if not exists (
    select 1 from identity.context_grants g join identity.memberships m
      on m.id=g.membership_id and m.tenant_id=g.tenant_id
    where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
  ) then raise exception 'asset_context_access_denied' using errcode='42501'; end if;

  if not exists (select 1 from portfolio.properties p where p.id=p_property_id and p.tenant_id=v_caller.tenant_id)
    or not exists (select 1 from assets.asset_categories c where c.id=p_category_id and c.tenant_id=v_caller.tenant_id and c.status='active')
  then raise exception 'asset_entity_scope_invalid' using errcode='22023'; end if;

  if v_caller.scope_type not in ('tenant','property','building','unit')
    or (v_caller.scope_type='property' and p_property_id is distinct from v_caller.property_id)
    or (v_caller.scope_type='building' and (p_building_id is distinct from v_caller.building_id or p_scope not in ('building','common_area','unit')))
    or (v_caller.scope_type='unit' and (p_unit_id is distinct from v_caller.unit_id or p_scope<>'unit'))
  then raise exception 'asset_context_scope_violation' using errcode='42501'; end if;


  if p_is_safety_critical or p_criticality_level = 'critical' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  if p_serial_number is not null and trim(p_serial_number) <> '' then
    v_serial_fp := encode(digest(trim(p_serial_number), 'sha256'), 'hex');
  end if;

  case p_criticality_level
    when 'low' then v_crit_num := 1;
    when 'medium' then v_crit_num := 3;
    when 'high' then v_crit_num := 4;
    when 'critical' then v_crit_num := 5;
    else v_crit_num := 3;
  end case;

  insert into assets.assets (
    tenant_id, property_id, category_id, asset_code, name, scope,
    building_id, unit_id, description, manufacturer, model,
    serial_number_encrypted, serial_fingerprint, manufacture_year, installed_on,
    location_description, ownership_type, lifecycle_status, operational_status,
    condition, criticality_level, criticality, is_safety_critical, replacement_cost,
    currency, meter_id, access_point_id, vendor_id, service_contract_id,
    service_frequency_months, created_by
  ) values (
    v_caller.tenant_id, p_property_id, p_category_id, trim(p_asset_code), trim(p_name), p_scope::assets.asset_scope,
    p_building_id, p_unit_id, p_description, p_manufacturer, p_model,
    p_serial_number, v_serial_fp, p_manufacture_year, p_installed_on,
    p_location_description, p_ownership_type, 'planned', 'operational',
    p_condition::assets.asset_condition, p_criticality_level, v_crit_num, p_is_safety_critical, p_replacement_cost,
    p_currency, p_meter_id, p_access_point_id, p_vendor_id, p_service_contract_id,
    p_service_frequency_months, auth.uid()
  ) returning id into v_asset_id;

  -- Record audit event
  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason, occurred_at
  ) values (
    v_caller.tenant_id, v_asset_id, 'asset_created', auth.uid(), 'Initial creation in planned status', statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', v_asset_id);
end;
$$;

CREATE OR REPLACE FUNCTION assets.update_asset_internal_v1(p_context_id uuid, p_asset_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_location_description text DEFAULT NULL::text, p_meter_id uuid DEFAULT NULL::uuid, p_access_point_id uuid DEFAULT NULL::uuid, p_vendor_id uuid DEFAULT NULL::uuid, p_service_contract_id uuid DEFAULT NULL::uuid, p_service_frequency_months integer DEFAULT NULL::integer, p_replacement_cost numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if v_asset.is_safety_critical or v_asset.criticality_level = 'critical' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    name = coalesce(trim(p_name), name),
    description = coalesce(p_description, description),
    location_description = coalesce(p_location_description, location_description),
    meter_id = coalesce(p_meter_id, meter_id),
    access_point_id = coalesce(p_access_point_id, access_point_id),
    vendor_id = coalesce(p_vendor_id, vendor_id),
    service_contract_id = coalesce(p_service_contract_id, service_contract_id),
    service_frequency_months = coalesce(p_service_frequency_months, service_frequency_months),
    replacement_cost = coalesce(p_replacement_cost, replacement_cost),
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'asset_id', p_asset_id);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.transition_asset_lifecycle_internal_v1(p_context_id uuid, p_asset_id uuid, p_target_status text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  if p_target_status in ('decommissioned', 'decommission_pending') then
    raise exception 'direct_decommission_forbidden: asset decommissioning requires formal request and approval';
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  -- Commissioning requires AAL2 and verification
  if p_target_status = 'commissioned' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.manage', true);
  end if;

  if v_asset.is_safety_critical and p_target_status in ('commissioned','out_of_service') then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    lifecycle_status = p_target_status,
    commissioned_at = case when p_target_status = 'commissioned' and commissioned_at is null then statement_timestamp() else commissioned_at end,
    updated_at = statement_timestamp()
  where id = p_asset_id;

  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason,
    before_snapshot, after_snapshot, occurred_at
  ) values (
    v_caller.tenant_id, p_asset_id, 'lifecycle_transition', auth.uid(), p_reason,
    jsonb_build_object('lifecycle_status', v_asset.lifecycle_status),
    jsonb_build_object('lifecycle_status', p_target_status),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', p_asset_id, 'lifecycle_status', p_target_status);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.update_asset_operational_status_internal_v1(p_context_id uuid, p_asset_id uuid, p_operational_status text, p_condition text DEFAULT NULL::text, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if v_asset.is_safety_critical and p_operational_status in ('unavailable', 'isolated') then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  update assets.assets set
    operational_status = p_operational_status,
    condition = coalesce(p_condition::assets.asset_condition, condition),
    updated_at = statement_timestamp()
  where id = p_asset_id;

  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason,
    before_snapshot, after_snapshot, occurred_at
  ) values (
    v_caller.tenant_id, p_asset_id, 'operational_status_change', auth.uid(), p_reason,
    jsonb_build_object('operational_status', v_asset.operational_status, 'condition', v_asset.condition),
    jsonb_build_object('operational_status', p_operational_status, 'condition', coalesce(p_condition, v_asset.condition::text)),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', p_asset_id, 'operational_status', p_operational_status);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.start_asset_downtime_internal_v1(p_context_id uuid, p_asset_id uuid, p_reason text, p_is_planned boolean DEFAULT false, p_work_order_id uuid DEFAULT NULL::uuid, p_ticket_id uuid DEFAULT NULL::uuid, p_started_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_downtime_id uuid;
  v_start timestamptz := coalesce(p_started_at, statement_timestamp());
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  -- Row lock asset
  perform 1 from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  insert into assets.asset_downtimes (
    tenant_id, asset_id, started_at, reason, is_planned,
    work_order_id, ticket_id, recorded_by
  ) values (
    v_caller.tenant_id, p_asset_id, v_start, p_reason, p_is_planned,
    p_work_order_id, p_ticket_id, auth.uid()
  ) returning id into v_downtime_id;

  -- Automatically update operational status to unavailable
  update assets.assets set
    operational_status = 'unavailable',
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'downtime_id', v_downtime_id, 'asset_id', p_asset_id);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.end_asset_downtime_internal_v1(p_context_id uuid, p_downtime_id uuid, p_ended_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_restored_operational_status text DEFAULT 'operational'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_dt record;
  v_end timestamptz := coalesce(p_ended_at, statement_timestamp());
  v_duration integer;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  -- Atomic select for update ensuring exactly one winner
  select * into v_dt from assets.asset_downtimes
  where id = p_downtime_id and tenant_id = v_caller.tenant_id and ended_at is null
  for update;

  if not found then
    raise exception 'DOWNTIME_NOT_ACTIVE: Active downtime session % not found', p_downtime_id;
  end if;

  if v_end <= v_dt.started_at then
    raise exception 'INVALID_END_TIME: Downtime end time must be strictly after started_at';
  end if;

  v_duration := greatest(0, floor(extract(epoch from (v_end - v_dt.started_at)) / 60)::integer);

  update assets.asset_downtimes set
    ended_at = v_end,
    duration_minutes = v_duration
  where id = p_downtime_id;

  -- Restore operational status
  update assets.assets set
    operational_status = p_restored_operational_status,
    updated_at = statement_timestamp()
  where id = v_dt.asset_id;

  return jsonb_build_object('success', true, 'downtime_id', p_downtime_id, 'duration_minutes', v_duration);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.list_asset_inspections_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_items jsonb;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.read', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', i.id,
      'inspection_type', i.inspection_type,
      'scheduled_date', i.scheduled_date,
      'performed_at', i.performed_at,
      'result', i.result,
      'inspector_name', i.inspector_name,
      'observations', i.observations,
      'corrective_action_required', i.corrective_action_required,
      'next_due_date', i.next_due_date,
      'is_verified', i.is_verified,
      'verified_at', i.verified_at,
      'document_id', i.document_id,
      'policy_id', i.policy_id
    ) order by i.scheduled_date desc
  ), '[]'::jsonb) into v_items
  from assets.asset_inspections i
  where i.asset_id = p_asset_id and i.tenant_id = v_caller.tenant_id;

  return jsonb_build_object('items', v_items);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.record_asset_inspection_internal_v1(p_context_id uuid, p_asset_id uuid, p_inspection_type text, p_scheduled_date date, p_performed_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_result text DEFAULT 'pending'::text, p_inspector_name text DEFAULT NULL::text, p_inspector_vendor_id uuid DEFAULT NULL::uuid, p_observations text DEFAULT NULL::text, p_corrective_action_required text DEFAULT NULL::text, p_document_id uuid DEFAULT NULL::uuid, p_policy_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
  v_policy record;
  v_snapshot jsonb := null;
  v_next_due date := null;
  v_insp_id uuid;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  if p_policy_id is not null then
    select * into v_policy from assets.compliance_policies
    where id = p_policy_id and tenant_id = v_caller.tenant_id;
    if not found then
      raise exception 'compliance_policy_unconfigured: Compliance policy % not found or inactive', p_policy_id;
    end if;

    v_snapshot := jsonb_build_object(
      'policy_code', v_policy.policy_code,
      'version', v_policy.version,
      'interval_months', v_policy.interval_months,
      'legal_source_reference', v_policy.legal_source_reference
    );

    if p_result in ('passed', 'passed_with_observations') and p_performed_at is not null then
      v_next_due := (p_performed_at::date + (v_policy.interval_months || ' months')::interval)::date;
    end if;
  elsif p_inspection_type in ('statutory_compliance', 'statutory', 'mandatory_safety', 'annual_safety') then
    select cp.* into v_policy from assets.compliance_policies cp
    join assets.asset_categories ac on ac.id = v_asset.category_id
    where cp.tenant_id = v_caller.tenant_id
      and cp.category_code = ac.code
      and cp.approval_status = 'APPROVED'
      and (cp.property_id is null or cp.property_id = v_asset.property_id)
      and (cp.effective_to is null or cp.effective_to >= current_date)
      and cp.effective_from <= current_date
    order by (cp.property_id is not null) desc, cp.version desc
    limit 1;

    if not found then
      raise exception 'compliance_policy_unconfigured: No active statutory compliance policy configured for asset category';
    end if;

    p_policy_id := v_policy.id;
    v_snapshot := jsonb_build_object(
      'policy_code', v_policy.policy_code,
      'version', v_policy.version,
      'interval_months', v_policy.interval_months,
      'legal_source_reference', v_policy.legal_source_reference
    );

    if p_result in ('passed', 'passed_with_observations') and p_performed_at is not null then
      v_next_due := (p_performed_at::date + (v_policy.interval_months || ' months')::interval)::date;
    end if;
  end if;

  insert into assets.asset_inspections (
    tenant_id, asset_id, policy_id, policy_version_snapshot, inspection_type,
    scheduled_date, performed_at, result, inspector_name, inspector_vendor_id,
    observations, corrective_action_required, next_due_date, document_id, created_by
  ) values (
    v_caller.tenant_id, p_asset_id, p_policy_id, v_snapshot, p_inspection_type,
    p_scheduled_date, p_performed_at, p_result, p_inspector_name, p_inspector_vendor_id,
    p_observations, p_corrective_action_required, v_next_due, p_document_id, auth.uid()
  ) returning id into v_insp_id;

  -- If inspection failed and asset is safety critical, degrade operational status
  if p_result = 'failed' and v_asset.is_safety_critical then
    update assets.assets set
      operational_status = 'degraded',
      updated_at = statement_timestamp()
    where id = p_asset_id;
  end if;

  return jsonb_build_object('success', true, 'inspection_id', v_insp_id, 'next_due_date', v_next_due);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.verify_asset_inspection_internal_v1(p_context_id uuid, p_inspection_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_insp record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.inspections.verify', true)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_insp from assets.asset_inspections
  where id = p_inspection_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'INSPECTION_NOT_FOUND: Inspection % not found', p_inspection_id;
  end if;

  if v_insp.is_verified then
    raise exception 'ALREADY_VERIFIED: Inspection has already been certified';
  end if;

  update assets.asset_inspections set
    is_verified = true,
    verified_by = auth.uid(),
    verified_at = statement_timestamp(),
    updated_at = statement_timestamp()
  where id = p_inspection_id;

  return jsonb_build_object('success', true, 'inspection_id', p_inspection_id, 'verified_at', statement_timestamp());
end;
$function$;

CREATE OR REPLACE FUNCTION assets.get_asset_warranty_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_w record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.read', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  if v_caller.role_code in ('owner', 'tenant_resident') then
    raise exception 'ACCESS_DENIED: Commercial warranty terms restricted';
  end if;

  select * into v_w from assets.asset_warranties
  where asset_id = p_asset_id and tenant_id = v_caller.tenant_id
  order by ends_on desc limit 1;

  if not found then
    return jsonb_build_object('warranty', null);
  end if;

  return jsonb_build_object(
    'warranty', jsonb_build_object(
      'id', v_w.id,
      'status', case when v_w.ends_on < current_date and v_w.status = 'active' then 'expired' else v_w.status end,
      'starts_on', v_w.starts_on,
      'ends_on', v_w.ends_on,
      'vendor_id', v_w.vendor_id,
      'coverage_json', v_w.coverage_json,
      'warranty_terms', v_w.warranty_terms,
      'document_id', v_w.document_id,
      'created_at', v_w.created_at
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION assets.upsert_asset_warranty_internal_v1(p_context_id uuid, p_asset_id uuid, p_starts_on date, p_ends_on date, p_vendor_id uuid DEFAULT NULL::uuid, p_coverage_json jsonb DEFAULT '{}'::jsonb, p_warranty_terms text DEFAULT NULL::text, p_document_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
  v_w_id uuid;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  if p_ends_on < p_starts_on then
    raise exception 'INVALID_WARRANTY_DATES: Warranty ends_on must be on or after starts_on';
  end if;

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % does not exist in this tenant', p_asset_id;
  end if;

  insert into assets.asset_warranties (
    tenant_id, asset_id, starts_on, ends_on, vendor_id,
    coverage_json, warranty_terms, document_id
  ) values (
    v_caller.tenant_id, p_asset_id, p_starts_on, p_ends_on, p_vendor_id,
    coalesce(p_coverage_json, '{}'::jsonb), p_warranty_terms, p_document_id
  ) returning id into v_w_id;

  return jsonb_build_object('success', true, 'warranty_id', v_w_id);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.list_warranty_claims_internal_v1(p_context_id uuid, p_asset_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_items jsonb;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.read', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  if v_caller.role_code in ('owner', 'tenant_resident') then
    raise exception 'ACCESS_DENIED: Commercial warranty claims restricted';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.id,
      'claim_reference', c.claim_reference,
      'claim_date', c.claim_date,
      'description', c.description,
      'resolution_status', c.resolution_status,
      'resolution_notes', c.resolution_notes,
      'document_id', c.document_id,
      'created_at', c.created_at
    ) order by c.claim_date desc
  ), '[]'::jsonb) into v_items
  from assets.asset_warranty_claims c
  where c.asset_id = p_asset_id and c.tenant_id = v_caller.tenant_id;

  return jsonb_build_object('items', v_items);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.create_warranty_claim_internal_v1(p_context_id uuid, p_warranty_id uuid, p_claim_reference text, p_description text, p_claim_date date DEFAULT CURRENT_DATE, p_document_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_w record;
  v_a record;
  v_snapshot jsonb;
  v_claim_id uuid;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_w from assets.asset_warranties
  where id = p_warranty_id and tenant_id = v_caller.tenant_id;

  if not found then
    raise exception 'WARRANTY_NOT_FOUND: Warranty % not found', p_warranty_id;
  end if;

  select * into v_a from assets.assets where id = v_w.asset_id;

  v_snapshot := jsonb_build_object(
    'warranty_id', v_w.id,
    'starts_on', v_w.starts_on,
    'ends_on', v_w.ends_on,
    'vendor_id', v_w.vendor_id,
    'asset_code', v_a.asset_code,
    'asset_name', v_a.name
  );

  insert into assets.asset_warranty_claims (
    tenant_id, warranty_id, asset_id, claim_reference, claim_date,
    description, warranty_snapshot, document_id, created_by
  ) values (
    v_caller.tenant_id, p_warranty_id, v_w.asset_id, trim(p_claim_reference), p_claim_date,
    p_description, v_snapshot, p_document_id, auth.uid()
  ) returning id into v_claim_id;

  return jsonb_build_object('success', true, 'claim_id', v_claim_id);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.resolve_warranty_claim_internal_v1(p_context_id uuid, p_claim_id uuid, p_resolution_status text, p_resolution_notes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_claim record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  if p_resolution_status not in ('in_review','accepted','rejected','resolved') then
    raise exception 'INVALID_STATUS: Resolution status % not allowed', p_resolution_status;
  end if;

  select * into v_claim from assets.asset_warranty_claims
  where id = p_claim_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'CLAIM_NOT_FOUND: Claim % not found', p_claim_id;
  end if;

  update assets.asset_warranty_claims set
    resolution_status = p_resolution_status,
    resolution_notes = coalesce(p_resolution_notes, resolution_notes),
    updated_at = statement_timestamp()
  where id = p_claim_id;

  return jsonb_build_object('success', true, 'claim_id', p_claim_id, 'resolution_status', p_resolution_status);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.list_compliance_policies_internal_v1(p_context_id uuid, p_category_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_items jsonb;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.read', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'policy_code', p.policy_code,
      'category_code', p.category_code,
      'property_id', p.property_id,
      'jurisdiction', p.jurisdiction,
      'interval_months', p.interval_months,
      'is_safety_mandatory', p.is_safety_mandatory,
      'legal_source_reference', p.legal_source_reference,
      'approval_status', p.approval_status,
      'effective_from', p.effective_from,
      'effective_to', p.effective_to,
      'version', p.version
    ) order by p.created_at desc
  ), '[]'::jsonb) into v_items
  from assets.compliance_policies p
  where p.tenant_id = v_caller.tenant_id
    and (p_category_code is null or p.category_code = p_category_code);

  return jsonb_build_object('items', v_items);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.configure_compliance_policy_internal_v1(p_context_id uuid, p_policy_code text, p_category_code text, p_interval_months integer, p_legal_source_reference text, p_effective_from date, p_effective_to date DEFAULT NULL::date, p_property_id uuid DEFAULT NULL::uuid, p_is_safety_mandatory boolean DEFAULT false, p_jurisdiction text DEFAULT 'RO'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_policy_id uuid;
  v_ver integer := 1;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', true)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  -- Determine version
  select coalesce(max(version), 0) + 1 into v_ver
  from assets.compliance_policies
  where tenant_id = v_caller.tenant_id and policy_code = trim(p_policy_code);

  insert into assets.compliance_policies (
    tenant_id, policy_code, category_code, property_id, jurisdiction,
    interval_months, is_safety_mandatory, legal_source_reference,
    approval_status, effective_from, effective_to, version, created_by
  ) values (
    v_caller.tenant_id, trim(p_policy_code), trim(p_category_code), p_property_id, p_jurisdiction,
    p_interval_months, p_is_safety_mandatory, trim(p_legal_source_reference),
    'APPROVED', p_effective_from, p_effective_to, v_ver, auth.uid()
  ) returning id into v_policy_id;

  return jsonb_build_object('success', true, 'policy_id', v_policy_id, 'version', v_ver);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.request_asset_decommission_internal_v1(p_context_id uuid, p_asset_id uuid, p_reason text, p_replacement_asset_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_asset record;
  v_req_id uuid;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_asset from assets.assets
  where id = p_asset_id and tenant_id = v_caller.tenant_id for update;

  if not found then
    raise exception 'ASSET_NOT_FOUND: Asset % not found in tenant', p_asset_id;
  end if;

  if v_asset.lifecycle_status in ('decommissioned', 'disposed') then
    raise exception 'ASSET_ALREADY_DECOMMISSIONED: Cannot request decommission for already decommissioned asset';
  end if;

  if p_replacement_asset_id is not null then
    perform 1 from assets.assets
    where id = p_replacement_asset_id and tenant_id = v_caller.tenant_id;
    if not found then
      raise exception 'REPLACEMENT_ASSET_NOT_FOUND: Replacement asset not found in same tenant';
    end if;
  end if;

  insert into assets.asset_decommission_requests (
    tenant_id, asset_id, replacement_asset_id, status, reason, requested_by
  ) values (
    v_caller.tenant_id, p_asset_id, p_replacement_asset_id, 'pending', p_reason, auth.uid()
  ) returning id into v_req_id;

  -- Set session authorization flag for decommission transition
  perform set_config('cladora.decommission_authorized', 'true', true);

  update assets.assets set
    lifecycle_status = 'decommission_pending',
    updated_at = statement_timestamp()
  where id = p_asset_id;

  return jsonb_build_object('success', true, 'request_id', v_req_id);
end;
$function$;

CREATE OR REPLACE FUNCTION assets.approve_asset_decommission_internal_v1(p_context_id uuid, p_request_id uuid, p_approved boolean, p_rejection_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'assets', 'platform', 'identity', 'portfolio', 'utilities', 'maintenance', 'documents'
AS $function$
declare
  v_caller record;
  v_req record;
  v_asset record;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.decommission', true)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  select * into v_req from assets.asset_decommission_requests
  where id = p_request_id and tenant_id = v_caller.tenant_id for update;

  if not found or v_req.status <> 'pending' then
    raise exception 'REQUEST_NOT_PENDING: Decommission request % is not pending', p_request_id;
  end if;

  select * into v_asset from assets.assets
  where id = v_req.asset_id and tenant_id = v_caller.tenant_id for update;

  -- Dual-control: If safety-critical, approver cannot be the same as requester
  if (v_asset.is_safety_critical or v_asset.criticality_level = 'critical') and v_req.requested_by = auth.uid() then
    raise exception 'dual_control_required_for_critical_asset: independent approver required for critical asset decommission';
  end if;

  if p_approved then
    update assets.asset_decommission_requests set
      status = 'approved',
      approved_by = auth.uid(),
      approved_at = statement_timestamp()
    where id = p_request_id;

    -- Set session authorization flag
    perform set_config('cladora.decommission_authorized', 'true', true);

    update assets.assets set
      lifecycle_status = 'decommissioned',
      operational_status = 'isolated',
      retired_at = statement_timestamp(),
      updated_at = statement_timestamp()
    where id = v_asset.id;

    insert into assets.asset_history (
      tenant_id, asset_id, event_type, actor_id, reason, occurred_at
    ) values (
      v_caller.tenant_id, v_asset.id, 'asset_decommissioned', auth.uid(), v_req.reason, statement_timestamp()
    );
  else
    update assets.asset_decommission_requests set
      status = 'rejected',
      approved_by = auth.uid(),
      approved_at = statement_timestamp(),
      rejection_reason = p_rejection_reason
    where id = p_request_id;

    perform set_config('cladora.decommission_authorized', 'true', true);

    update assets.assets set
      lifecycle_status = 'active',
      updated_at = statement_timestamp()
    where id = v_asset.id;
  end if;

  return jsonb_build_object('success', true, 'request_id', p_request_id, 'approved', p_approved);
end;
$function$;

create or replace function assets.registration_context_v1(p_context_id uuid) returns record
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record;
begin
 select typed_caller.* into v
  from assets.check_asset_caller_v1(p_context_id,'assets.manage',false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);
 if v.scope_type not in ('tenant','property','building') or not exists(
  select 1 from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
   and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
 ) then raise exception 'asset_context_access_denied' using errcode='42501'; end if;
 return v;
end $$;

create or replace function assets.registration_choices_v1(p_context_id uuid) returns jsonb
language plpgsql stable security definer set search_path=pg_catalog as $$
declare v record; properties jsonb; buildings jsonb;
begin
 select typed_caller.* into v
  from assets.registration_context_v1(p_context_id)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);
 select coalesce(jsonb_agg(q),'[]'::jsonb) into properties from (
  select p.id,p.name from portfolio.properties p where p.tenant_id=v.tenant_id and p.status='active'
   and (v.scope_type='tenant' or (v.scope_type='property' and p.id=v.property_id)
    or (v.scope_type='building' and exists(select 1 from portfolio.buildings b where b.id=v.building_id and b.tenant_id=v.tenant_id and b.property_id=p.id)))
  order by p.name,p.id limit 200
 ) q;
 select coalesce(jsonb_agg(q),'[]'::jsonb) into buildings from (
  select b.id,b.name,b.property_id from portfolio.buildings b where b.tenant_id=v.tenant_id and b.status='active'
   and exists(select 1 from jsonb_array_elements(properties) p where p->>'id'=b.property_id::text)
   and (v.scope_type<>'building' or b.id=v.building_id)
  order by b.name,b.id limit 500
 ) q;
 return jsonb_build_object('properties',properties,'buildings',buildings,'building_required',v.scope_type='building');
end $$;

create or replace function assets.register_equipment_v1(p_context_id uuid,p_property_id uuid,p_building_id uuid,p_category_code text,p_asset_code text,p_name text) returns jsonb
language plpgsql security definer set search_path=pg_catalog as $$
declare v record; category_id uuid; category_name text; result jsonb;
begin
 select typed_caller.* into v
  from assets.registration_context_v1(p_context_id)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);
 if p_category_code not in ('ventilation','pump','elevator','fire_safety','other') or p_category_code is null
  or p_asset_code is null or length(trim(p_asset_code)) not between 1 and 64
  or p_name is null or length(trim(p_name)) not between 1 and 255
 then raise exception 'asset_registration_invalid' using errcode='22023'; end if;
 category_name:=case p_category_code when 'ventilation' then 'Ventilation' when 'pump' then 'Pump' when 'elevator' then 'Elevator' when 'fire_safety' then 'Fire safety' else 'Other equipment' end;
 -- The transaction rolls category creation back if guarded registration fails.
 insert into assets.asset_categories(tenant_id,code,name,status) values(v.tenant_id,p_category_code,category_name,'active')
 on conflict(tenant_id,code) do nothing returning id into category_id;
 if category_id is not null then
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,reason,after_snapshot)
  values(v.tenant_id,auth.uid(),v.role_code,'ASSET_CATEGORY_CREATED','assets.category',category_id,'Equipment registration category',jsonb_build_object('code',p_category_code,'name',category_name));
 end if;
 select c.id into category_id from assets.asset_categories c where c.tenant_id=v.tenant_id and c.code=p_category_code and c.status='active';
 if category_id is null then raise exception 'asset_category_inactive' using errcode='22023'; end if;
 result:=assets.create_asset_internal_v1(p_context_id=>p_context_id,p_property_id=>p_property_id,p_category_id=>category_id,
  p_asset_code=>p_asset_code,p_name=>p_name,p_scope=>case when p_building_id is null then 'property' else 'building' end,
  p_building_id=>p_building_id,p_is_safety_critical=>p_category_code in ('elevator','fire_safety'),
  p_criticality_level=>case when p_category_code in ('elevator','fire_safety') then 'critical' else 'medium' end);
 return result;
end $$;



-- CANONICAL RANGE supabase/migrations/20261021095634_assets_serial_digest_namespace_v1.sql:2-108

-- Preserve the narrow SECURITY DEFINER path; bind the existing pgcrypto function.
create or replace function assets.create_asset_internal_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_category_id uuid,
  p_asset_code text,
  p_name text,
  p_scope text default 'property',
  p_building_id uuid default null,
  p_unit_id uuid default null,
  p_description text default null,
  p_manufacturer text default null,
  p_model text default null,
  p_serial_number text default null,
  p_manufacture_year integer default null,
  p_installed_on date default null,
  p_location_description text default null,
  p_ownership_type text default 'association',
  p_condition text default 'unknown',
  p_criticality_level text default 'medium',
  p_is_safety_critical boolean default false,
  p_replacement_cost numeric default null,
  p_currency text default 'RON',
  p_meter_id uuid default null,
  p_access_point_id uuid default null,
  p_vendor_id uuid default null,
  p_service_contract_id uuid default null,
  p_service_frequency_months integer default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents
as $$
declare
  v_caller record;
  v_asset_id uuid;
  v_serial_fp text := null;
  v_crit_num smallint := 3;
begin
  select typed_caller.* into v_caller
  from assets.check_asset_caller_v1(p_context_id, 'assets.manage', false)
    as typed_caller(tenant_id uuid, membership_id uuid, user_id uuid, role_code text, scope_type text, property_id uuid, building_id uuid, unit_id uuid, role_id uuid);

  -- Authorization ceiling is independent of entity relationship integrity triggers.
  if not exists (
    select 1 from identity.context_grants g join identity.memberships m
      on m.id=g.membership_id and m.tenant_id=g.tenant_id
    where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
  ) then raise exception 'asset_context_access_denied' using errcode='42501'; end if;

  if not exists (select 1 from portfolio.properties p where p.id=p_property_id and p.tenant_id=v_caller.tenant_id)
    or not exists (select 1 from assets.asset_categories c where c.id=p_category_id and c.tenant_id=v_caller.tenant_id and c.status='active')
  then raise exception 'asset_entity_scope_invalid' using errcode='22023'; end if;

  if v_caller.scope_type not in ('tenant','property','building','unit')
    or (v_caller.scope_type='property' and p_property_id is distinct from v_caller.property_id)
    or (v_caller.scope_type='building' and (p_building_id is distinct from v_caller.building_id or p_scope not in ('building','common_area','unit')))
    or (v_caller.scope_type='unit' and (p_unit_id is distinct from v_caller.unit_id or p_scope<>'unit'))
  then raise exception 'asset_context_scope_violation' using errcode='42501'; end if;


  if p_is_safety_critical or p_criticality_level = 'critical' then
    perform assets.check_asset_caller_v1(p_context_id, 'assets.critical.manage', true);
  end if;

  if p_serial_number is not null and trim(p_serial_number) <> '' then
    v_serial_fp := encode(extensions.digest(trim(p_serial_number), 'sha256'), 'hex');
  end if;

  case p_criticality_level
    when 'low' then v_crit_num := 1;
    when 'medium' then v_crit_num := 3;
    when 'high' then v_crit_num := 4;
    when 'critical' then v_crit_num := 5;
    else v_crit_num := 3;
  end case;

  insert into assets.assets (
    tenant_id, property_id, category_id, asset_code, name, scope,
    building_id, unit_id, description, manufacturer, model,
    serial_number_encrypted, serial_fingerprint, manufacture_year, installed_on,
    location_description, ownership_type, lifecycle_status, operational_status,
    condition, criticality_level, criticality, is_safety_critical, replacement_cost,
    currency, meter_id, access_point_id, vendor_id, service_contract_id,
    service_frequency_months, created_by
  ) values (
    v_caller.tenant_id, p_property_id, p_category_id, trim(p_asset_code), trim(p_name), p_scope::assets.asset_scope,
    p_building_id, p_unit_id, p_description, p_manufacturer, p_model,
    p_serial_number, v_serial_fp, p_manufacture_year, p_installed_on,
    p_location_description, p_ownership_type, 'planned', 'operational',
    p_condition::assets.asset_condition, p_criticality_level, v_crit_num, p_is_safety_critical, p_replacement_cost,
    p_currency, p_meter_id, p_access_point_id, p_vendor_id, p_service_contract_id,
    p_service_frequency_months, auth.uid()
  ) returning id into v_asset_id;

  -- Record audit event
  insert into assets.asset_history (
    tenant_id, asset_id, event_type, actor_id, reason, occurred_at
  ) values (
    v_caller.tenant_id, v_asset_id, 'asset_created', auth.uid(), 'Initial creation in planned status', statement_timestamp()
  );

  return jsonb_build_object('success', true, 'asset_id', v_asset_id);
end;
$$;


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
('assets.enforce_asset_domain_integrity()','f96b8795afe736f8c6cc83f2683f308474a9f8e368c63b642d3e7bf81ca669dc','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],0),
('assets.check_asset_caller_v1(uuid,text,boolean)','3023d8f159c013b45e8fe0e42133f5f2e72892ccf3aefd4ad47fd1bae520adab','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, identity, platform']::text[],1),
('assets.list_assets_internal_v1(uuid,uuid,uuid,uuid,text,text,text,text,boolean,text,integer,integer)','aea18a8a90ca3532807bea6e7bfdb14915609f029d78f2b75312101d262c99ad','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],2),
('customer_api.list_assets_v1(uuid,uuid,uuid,uuid,text,text,text,text,boolean,text,integer,integer)','2a8af816340f3d4b7435701a6903280e2eb9b2aae4916ff027ca2e3d596edd85','postgres',false,'plpgsql','s',false,array['search_path=pg_catalog']::text[],3),
('assets.get_asset_detail_internal_v1(uuid,uuid)','fb56655a6e0a68f1db0e7f8e4f363fa7c1862ea50ff2dea0a7942d21af8e9458','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],4),
('customer_api.get_asset_detail_v1(uuid,uuid)','e106354f8253fb2692c55633ba1ddd678f6fcaa4a2361dcc0cd273076a52f8b9','postgres',false,'plpgsql','s',false,array['search_path=pg_catalog']::text[],5),
('assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','c587115d8140e8d8e12c53a4735a8851f5e9e210312ce8823bfcc28f61e0b3ec','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],6),
('customer_api.create_asset_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','d950dfd2532b0980e4c2ad511670799c409ea5df08fafb3c5a77a738b60126ee','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],7),
('assets.update_asset_internal_v1(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,integer,numeric)','e47db67cdcc62a0d48e10d7a7c8a8f4aa15eac6f144aec6b9448093a2403666f','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],8),
('customer_api.update_asset_v1(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,integer,numeric)','7107b700bf145445ced5d5fb3e0211a0086e3c7596c45425789b9223fbfc7471','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],9),
('assets.transition_asset_lifecycle_internal_v1(uuid,uuid,text,text)','e9338b0add2f296553a86a7c5766b0b9c5304ec8edec4b40d3b2a5a790516c91','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],10),
('customer_api.transition_asset_lifecycle_v1(uuid,uuid,text,text)','781333f5cff0c46530dc5db73e5597dc1721522fa76df6069082889f10f78cec','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],11),
('assets.update_asset_operational_status_internal_v1(uuid,uuid,text,text,text)','c62b0c72680b7b7036e5b45a5ea936657d283d975fa8e1cf1bd9a5dc5bb48138','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],12),
('customer_api.update_asset_operational_status_v1(uuid,uuid,text,text,text)','fefdd26c01b04afde101d7be3ccffd9a1ef9ff50fa3cc4215fde4fefd138a9c7','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],13),
('assets.start_asset_downtime_internal_v1(uuid,uuid,text,boolean,uuid,uuid,timestamptz)','99116fbd803d16d202f9cf78569689bc8bd4bf53f331c5f13a2b01e5fc708e70','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],14),
('customer_api.start_asset_downtime_v1(uuid,uuid,text,boolean,uuid,uuid,timestamptz)','73cb8659645a8aecc443d093c6b6f49dc26e6373202337210fefef3939450872','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],15),
('assets.end_asset_downtime_internal_v1(uuid,uuid,timestamptz,text)','fb5ef15afeac8b0956d9507aa85134b700e6c9305e79d48ea260473c80fdbaf8','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],16),
('customer_api.end_asset_downtime_v1(uuid,uuid,timestamptz,text)','a63d4d7183e7d53ba3b3ecbdcfda2f8f948161e77663e8ab515fbd3dac236f12','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],17),
('assets.list_asset_inspections_internal_v1(uuid,uuid)','f7666713b78e126faed5049d5c09e069bed39a771bdf094acb4648d12619ae73','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],18),
('customer_api.list_asset_inspections_v1(uuid,uuid)','133205225cd75cca457d9122f5f989c833e23279ec8be27752fc66e47c335758','postgres',false,'plpgsql','s',false,array['search_path=pg_catalog']::text[],19),
('assets.record_asset_inspection_internal_v1(uuid,uuid,text,date,timestamptz,text,text,uuid,text,text,uuid,uuid)','db2cc663f5dec7422a5a21d3b1da151dc010f1319b4db53efc2542c7297c1b57','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],20),
('customer_api.record_asset_inspection_v1(uuid,uuid,text,date,timestamptz,text,text,uuid,text,text,uuid,uuid)','82e659b75dcbf1110e14b56bbc4cf8028aa138c231ba13aba8a68dd04f77d399','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],21),
('assets.verify_asset_inspection_internal_v1(uuid,uuid)','80283682b77bddc23795ac50c844f816c383dcb08ef5137cef8ba927488ab32a','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],22),
('customer_api.verify_asset_inspection_v1(uuid,uuid)','cc65bfb6f9933c668737675ce2976233d3fc2629d58b4848d9d4fee4582d82cb','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],23),
('assets.get_asset_warranty_internal_v1(uuid,uuid)','4513e778455df00d99eebb8cca5bfae52c8d040cfc5e0b85f713f47f7131a721','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],24),
('customer_api.get_asset_warranty_v1(uuid,uuid)','823a5a2739685cb2e0da1d084e82963e67252af5cb1f8830c2b598831ac770f4','postgres',false,'plpgsql','s',false,array['search_path=pg_catalog']::text[],25),
('assets.upsert_asset_warranty_internal_v1(uuid,uuid,date,date,uuid,jsonb,text,uuid)','6675964e2e823584d5cf60ede8b79f24515a6c033d86a73e6c2c242e36fec759','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],26),
('customer_api.upsert_asset_warranty_v1(uuid,uuid,date,date,uuid,jsonb,text,uuid)','d07858fcccf91c31cfb3f6f9cdb6787c24f5e4e3427a480e9e88c090a5b757cc','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],27),
('assets.list_warranty_claims_internal_v1(uuid,uuid)','b42f592f9ea0d07a95b9bff0e5eb9264b3f7d42bd3adb50b8efc12350d50eb13','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],28),
('customer_api.list_warranty_claims_v1(uuid,uuid)','3b5d5701d3f02b162c33560feb20f8432a58b9ada26f687d83ea9a568c99d594','postgres',false,'plpgsql','s',false,array['search_path=pg_catalog']::text[],29),
('assets.create_warranty_claim_internal_v1(uuid,uuid,text,text,date,uuid)','fdd21432c4e5c01c784604e6454c76af7aff4591efe854be393792a074d52432','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],30),
('customer_api.create_warranty_claim_v1(uuid,uuid,text,text,date,uuid)','d97acfcfe9d7eda4d1cc57414b01e1184c05b59385c5c41ce2246c851b4a2f23','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],31),
('assets.resolve_warranty_claim_internal_v1(uuid,uuid,text,text)','fd11398c6548b2f2688186a75f4743ee24de5b79ab07d63e3036c810aa7bfd47','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],32),
('customer_api.resolve_warranty_claim_v1(uuid,uuid,text,text)','f155a9af317df06b5dd987b111d30c1c6e9267462c4a9072ca83fb50502aef94','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],33),
('assets.list_compliance_policies_internal_v1(uuid,text)','908bf771d74f4c6a36be34fca510a35e0d96b90ffdc482332d187dd84f0dfab5','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],34),
('customer_api.list_compliance_policies_v1(uuid,text)','1a88c20546f78c50073a2ec580c6aa461bdf7d49dedfe19837be3cc7005d3eeb','postgres',false,'plpgsql','s',false,array['search_path=pg_catalog']::text[],35),
('assets.configure_compliance_policy_internal_v1(uuid,text,text,integer,text,date,date,uuid,boolean,text)','73465261e7f8055b588a7c75b85b501936ee884700b805e1ba97ac6938c6133f','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],36),
('customer_api.configure_compliance_policy_v1(uuid,text,text,integer,text,date,date,uuid,boolean,text)','f0d2cc855e4de1cc5affb1b7153bfda12a075f1b7d8a118783f7dd8daf7b5b79','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],37),
('assets.request_asset_decommission_internal_v1(uuid,uuid,text,uuid)','fdb9adf789d165503d7f6d72ea147dd6445ee8086eb05a5738249e9e17230b2e','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],38),
('customer_api.request_asset_decommission_v1(uuid,uuid,text,uuid)','64518a5e7dc0307fd7f7e1d929f0e6e5c19a66d7f8235ac0f46cf33170d366d8','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],39),
('assets.approve_asset_decommission_internal_v1(uuid,uuid,boolean,text)','21f965f31496fb0e195abb8902af1329c5c4a39fda8e800be89e0a57bfc21c82','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],40),
('customer_api.approve_asset_decommission_v1(uuid,uuid,boolean,text)','1707124423b969ef6b63aa692f02b5cf44a2ca740118c51f2a779ceb0e1d2a6a','postgres',false,'plpgsql','v',false,array['search_path=pg_catalog']::text[],41),
('assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','356436d80f295519135e43d5ebe72dca4af63af1cf6877bf81c8e1223d1ba232','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],42),
('assets.registration_context_v1(uuid)','3571c80acc7c2740af81a2d80632b96f941b684438d985bb4a495bdef53ce4c8','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],43),
('assets.registration_choices_v1(uuid)','15e66b910a12eb18afd74120ef3581f1cdf65ce1fc6b3d23b879f7df85fb8362','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],44),
('customer_api.get_asset_registration_choices_v1(uuid)','5af3591d83cd86a3713826f920ea8cd9c9d4679dd4c528ee16a1962db9949cc5','postgres',false,'sql','s',false,array['search_path=pg_catalog']::text[],45),
('assets.register_equipment_v1(uuid,uuid,uuid,text,text,text)','390e8c34483294b18972f0832ca62da1002f0162da12afa564938af105ef4337','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],46),
('customer_api.register_equipment_v1(uuid,uuid,uuid,text,text,text)','820f25bdd524631bd4b970c56a6e8b2112457a16050d5a4e4aba231eed6b4262','postgres',false,'sql','v',false,array['search_path=pg_catalog']::text[],47),
('assets.check_asset_caller_v1(uuid,text,boolean)','3eb2cc1856a59356166068a3b71976df522ea37136d82778477952339f4a5961','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, identity, platform']::text[],48),
('assets.list_assets_internal_v1(uuid,uuid,uuid,uuid,text,text,text,text,boolean,text,integer,integer)','a8fc37436434e207c2d6b47f3011a97c837a89d0d7443d256c99354f8c4f1fcf','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],49),
('assets.get_asset_detail_internal_v1(uuid,uuid)','4c9be29a71115dc9378329623baab9434b14c52b52b9750f71ef75612f041a68','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],50),
('assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','550002e83bdafe8cba446ae06e0536967350a25298a43476487478f78fd4ebc1','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],51),
('assets.update_asset_internal_v1(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,integer,numeric)','a7beacf0aa3a08728a2873ec79999f4d0231db71e96580c43702f761e4e78117','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],52),
('assets.transition_asset_lifecycle_internal_v1(uuid,uuid,text,text)','72d221b647865dfe406474446def2ea227f74755e2d37ad89b12577d2b4a95dd','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],53),
('assets.update_asset_operational_status_internal_v1(uuid,uuid,text,text,text)','a9631d804779b67e4e739257b49873ad7a703d6a097bb18dac7c5087a5a44b27','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],54),
('assets.start_asset_downtime_internal_v1(uuid,uuid,text,boolean,uuid,uuid,timestamp with time zone)','c9e35a20928d0da5502cae30a749c86b7dacaf816ae29eac4c2093aa6737bdb4','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],55),
('assets.end_asset_downtime_internal_v1(uuid,uuid,timestamp with time zone,text)','c2eb5398f0708db52b8be71243ca2d9f05ac1efc8ee733bf4b2f20c899521b97','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],56),
('assets.list_asset_inspections_internal_v1(uuid,uuid)','32394f4d62979114cb92fbc4424a5163ee22cf8215c34d09192332f6f50be138','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],57),
('assets.record_asset_inspection_internal_v1(uuid,uuid,text,date,timestamp with time zone,text,text,uuid,text,text,uuid,uuid)','f09628c4895b17fde6e7a5c32154998adf6fc93fcceca99012f1683c23800441','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],58),
('assets.verify_asset_inspection_internal_v1(uuid,uuid)','ebc5e82620820a6ba79d841e7b83cb3d38c3d53b31183cb5796a0842c5a1d87f','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],59),
('assets.get_asset_warranty_internal_v1(uuid,uuid)','59c64db29dec37f20ef84b0d7fbbc7bb6067c135cd47327548f91a4e2442474f','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],60),
('assets.upsert_asset_warranty_internal_v1(uuid,uuid,date,date,uuid,jsonb,text,uuid)','404b256be2dd1693d06165762a62151a904dcd96fd4f5d437433deb0c1ea0cd9','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],61),
('assets.list_warranty_claims_internal_v1(uuid,uuid)','3b5f286949130b382fa5e689d7cc5c224d32ec1d31e07f99ce3d391306b9430a','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],62),
('assets.create_warranty_claim_internal_v1(uuid,uuid,text,text,date,uuid)','21ccaa96122659e536422e858987d1811829772c05ea287e10134afd31fc1d2b','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],63),
('assets.resolve_warranty_claim_internal_v1(uuid,uuid,text,text)','d237cd6c2b59fb5cf5b250d12bb24fa897960d44e212ba0a440d4f63b7855e83','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],64),
('assets.list_compliance_policies_internal_v1(uuid,text)','e6214c867e67263d91d9400cc54444afad3aa0740f060867c90d2fe94ce5aa19','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],65),
('assets.configure_compliance_policy_internal_v1(uuid,text,text,integer,text,date,date,uuid,boolean,text)','297134d0fc3acf457b70942f2ff6683aa58832b411b2574ff516dbf156e345b5','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],66),
('assets.request_asset_decommission_internal_v1(uuid,uuid,text,uuid)','29891800f97f6519299f30b124505bc570e30caf4a19ea1176c18d27a73c8928','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],67),
('assets.approve_asset_decommission_internal_v1(uuid,uuid,boolean,text)','1e7987347b4c2a503eff5de318579c6a6082f58fb404721104a96eaba572f2c7','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],68),
('assets.registration_context_v1(uuid)','d89615c81e44d02d130386b504f4d492fffc00c52ca5fd3ad2e8bae67deb54a0','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],69),
('assets.registration_choices_v1(uuid)','3b20014ea5fcf6c33ebc76d8545f360e5cc0e38dd1511a818bc45fb8c3d16df1','postgres',true,'plpgsql','s',false,array['search_path=pg_catalog']::text[],70),
('assets.register_equipment_v1(uuid,uuid,uuid,text,text,text)','16dfe7b6a4adde5364ed3c88775df68d59bb9b85e47fe3a98a81fdc56c0b2501','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog']::text[],71),
('assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','1ec2a30a7a6353aac3db5cd78189f9d94dc52f07da964ae3de99800bd351255a','postgres',true,'plpgsql','v',false,array['search_path=pg_catalog, assets, platform, identity, portfolio, utilities, maintenance, documents']::text[],72)), expected as (
 select distinct on(to_regprocedure(signature)) * from source order by to_regprocedure(signature),ordinal desc
 ) select 1 from expected e left join pg_proc p on p.oid=to_regprocedure(e.signature) left join pg_language l on l.oid=p.prolang
 where p.oid is null or p.prokind<>'f' or p.proowner<>to_regrole(e.owner_name) or p.prosecdef is distinct from e.secdef
 or p.provolatile::text is distinct from e.volatility or p.proisstrict is distinct from e.is_strict
 or l.lanname is distinct from e.language_name or p.proconfig is distinct from e.config
 or encode(extensions.digest(convert_to(p.prosrc,'UTF8'),'sha256'),'hex') is distinct from e.body_hash) then
 raise exception 'operations_routine_catalog_identity_mismatch' using errcode='55000';end if;
 if to_regclass('assets.asset_decommission_requests') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('assets.asset_downtimes') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('assets.asset_inspections') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('assets.asset_warranty_claims') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if to_regclass('assets.compliance_policies') is null then raise exception 'operations_relation_missing' using errcode='55000';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and p.oid not in (select to_regprocedure(x) from unnest(array['app_private.require_building_session_current_v1()','app_private.set_updated_at()','finance.protect_accounting_period()','finance.assert_accounting_period_no_overlap()','finance.assert_accounting_period_property_tenant()','app_private.guard_taxonomy_version_effective_period_v1()','app_private.guard_taxonomy_record_immutability_v1()','app_private.guard_workspace_taxonomy_assignment_history_v1()','app_private.guard_workspace_property_binding_history_v1()','app_private.guard_workspace_property_binding_v1()','app_private.guard_workspace_taxonomy_assignment_v1()','app_private.bootstrap_role_taxonomy_permissions_v1()','app_private.bootstrap_role_module_permissions_v1()','app_private.guard_module_definition_immutability_v1()','app_private.guard_module_definition_effective_period_v1()','app_private.guard_workspace_module_code_sync_v1()','app_private.guard_workspace_module_immutability_v1()','app_private.bootstrap_role_workspace_role_permissions_v1()','app_private.guard_module_permission_binding_invariants_v1()','app_private.guard_workspace_role_immutability_v1()','app_private.guard_workspace_role_module_draft_only_v1()','app_private.guard_workspace_role_permission_bindings_v1()','app_private.guard_workspace_member_role_invariants_v1()','app_private.bootstrap_role_workspace_delegation_permissions_v1()','platform.cap_customer_membership_to_access_basis()','platform.cap_customer_context_to_membership()','platform.require_workspace_access_basis_for_provisioning()','app_private.guard_undefined_primary_role_v1()','app_private.guard_workspace_role_authority_source_immutable_v1()','app_private.guard_authority_revision_v1()','app_private.bump_canonical_authority_revision_v1()','app_private.guard_jurisdiction_bound_property_address_v1()','app_private.resolve_workspace_from_customer_context_v1(uuid,boolean)','platform.assert_workspace_activation_ready(uuid)','app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)','app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)','app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)','app_private.customer_mfa_required()','platform.enforce_workspace_activation_gate()','app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)','app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])','app_private.guard_workspace_member_role_authority_v2()','app_private.native_workspace_scope_for_membership_v2(uuid,uuid,uuid)','app_private.resolve_workspace_native_context_v2(uuid,uuid)','app_private.check_direct_effective_permission_v2(uuid,uuid,text,text,text,uuid,uuid)','app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)','app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)','app_private.jwt_uuid(text)','app_private.active_tenant_id()','app_private.active_context_id()','app_private.is_service_role()','app_private.is_active_member(uuid)','app_private.active_membership_id()','app_private.can_access_property(uuid)','app_private.can_access_building(uuid)','app_private.can_access_unit(uuid)','app_private.can_access_utility_scope(uuid,uuid,uuid)','utilities.protect_validated_reading()','app_private.can_access_asset_scope(uuid,uuid,uuid)','maintenance.enforce_work_order_transition()','maintenance.protect_purchase_order()','documents.protect_document_version()','app_private.check_direct_effective_permission_v1(uuid,uuid,text,text,text,uuid)','app_private.check_effective_permission_v1(uuid,text,text,text,uuid)','finance.assert_allocation_balanced(uuid)','finance.protect_allocation_run()','billing.protect_issued_invoice()','governance.protect_closed_vote()','governance.protect_vote_option()','app_private.current_platform_user_id()','app_private.has_platform_role(platform.platform_role_type)','app_private.is_platform_user()','app_private.has_platform_access_for_routing()','customer_api.has_platform_access_v1()','platform.my_customer_mfa_requirement()','platform.list_my_customer_contexts()','platform.get_customer_dashboard(uuid)','customer_api.get_dashboard_v1(uuid)','customer_api.list_contexts_v1()','customer_api.my_mfa_requirement_v1()','app_private.can_access_channel(uuid)','communications.enforce_poll_response()','customer_api.list_my_unit_invitations_v1()','app_private.has_multi_unit_owner_role_v1()','customer_api.my_multi_unit_owner_access_v1()','assets.enforce_asset_domain_integrity()','assets.check_asset_caller_v1(uuid,text,boolean)','assets.list_assets_internal_v1(uuid,uuid,uuid,uuid,text,text,text,text,boolean,text,integer,integer)','customer_api.list_assets_v1(uuid,uuid,uuid,uuid,text,text,text,text,boolean,text,integer,integer)','assets.get_asset_detail_internal_v1(uuid,uuid)','customer_api.get_asset_detail_v1(uuid,uuid)','assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','customer_api.create_asset_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','assets.update_asset_internal_v1(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,integer,numeric)','customer_api.update_asset_v1(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,integer,numeric)','assets.transition_asset_lifecycle_internal_v1(uuid,uuid,text,text)','customer_api.transition_asset_lifecycle_v1(uuid,uuid,text,text)','assets.update_asset_operational_status_internal_v1(uuid,uuid,text,text,text)','customer_api.update_asset_operational_status_v1(uuid,uuid,text,text,text)','assets.start_asset_downtime_internal_v1(uuid,uuid,text,boolean,uuid,uuid,timestamptz)','customer_api.start_asset_downtime_v1(uuid,uuid,text,boolean,uuid,uuid,timestamptz)','assets.end_asset_downtime_internal_v1(uuid,uuid,timestamptz,text)','customer_api.end_asset_downtime_v1(uuid,uuid,timestamptz,text)','assets.list_asset_inspections_internal_v1(uuid,uuid)','customer_api.list_asset_inspections_v1(uuid,uuid)','assets.record_asset_inspection_internal_v1(uuid,uuid,text,date,timestamptz,text,text,uuid,text,text,uuid,uuid)','customer_api.record_asset_inspection_v1(uuid,uuid,text,date,timestamptz,text,text,uuid,text,text,uuid,uuid)','assets.verify_asset_inspection_internal_v1(uuid,uuid)','customer_api.verify_asset_inspection_v1(uuid,uuid)','assets.get_asset_warranty_internal_v1(uuid,uuid)','customer_api.get_asset_warranty_v1(uuid,uuid)','assets.upsert_asset_warranty_internal_v1(uuid,uuid,date,date,uuid,jsonb,text,uuid)','customer_api.upsert_asset_warranty_v1(uuid,uuid,date,date,uuid,jsonb,text,uuid)','assets.list_warranty_claims_internal_v1(uuid,uuid)','customer_api.list_warranty_claims_v1(uuid,uuid)','assets.create_warranty_claim_internal_v1(uuid,uuid,text,text,date,uuid)','customer_api.create_warranty_claim_v1(uuid,uuid,text,text,date,uuid)','assets.resolve_warranty_claim_internal_v1(uuid,uuid,text,text)','customer_api.resolve_warranty_claim_v1(uuid,uuid,text,text)','assets.list_compliance_policies_internal_v1(uuid,text)','customer_api.list_compliance_policies_v1(uuid,text)','assets.configure_compliance_policy_internal_v1(uuid,text,text,integer,text,date,date,uuid,boolean,text)','customer_api.configure_compliance_policy_v1(uuid,text,text,integer,text,date,date,uuid,boolean,text)','assets.request_asset_decommission_internal_v1(uuid,uuid,text,uuid)','customer_api.request_asset_decommission_v1(uuid,uuid,text,uuid)','assets.approve_asset_decommission_internal_v1(uuid,uuid,boolean,text)','customer_api.approve_asset_decommission_v1(uuid,uuid,boolean,text)','assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','assets.registration_context_v1(uuid)','assets.registration_choices_v1(uuid)','customer_api.get_asset_registration_choices_v1(uuid)','assets.register_equipment_v1(uuid,uuid,uuid,text,text,text)','customer_api.register_equipment_v1(uuid,uuid,uuid,text,text,text)','assets.check_asset_caller_v1(uuid,text,boolean)','assets.list_assets_internal_v1(uuid,uuid,uuid,uuid,text,text,text,text,boolean,text,integer,integer)','assets.get_asset_detail_internal_v1(uuid,uuid)','assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)','assets.update_asset_internal_v1(uuid,uuid,text,text,text,uuid,uuid,uuid,uuid,integer,numeric)','assets.transition_asset_lifecycle_internal_v1(uuid,uuid,text,text)','assets.update_asset_operational_status_internal_v1(uuid,uuid,text,text,text)','assets.start_asset_downtime_internal_v1(uuid,uuid,text,boolean,uuid,uuid,timestamp with time zone)','assets.end_asset_downtime_internal_v1(uuid,uuid,timestamp with time zone,text)','assets.list_asset_inspections_internal_v1(uuid,uuid)','assets.record_asset_inspection_internal_v1(uuid,uuid,text,date,timestamp with time zone,text,text,uuid,text,text,uuid,uuid)','assets.verify_asset_inspection_internal_v1(uuid,uuid)','assets.get_asset_warranty_internal_v1(uuid,uuid)','assets.upsert_asset_warranty_internal_v1(uuid,uuid,date,date,uuid,jsonb,text,uuid)','assets.list_warranty_claims_internal_v1(uuid,uuid)','assets.create_warranty_claim_internal_v1(uuid,uuid,text,text,date,uuid)','assets.resolve_warranty_claim_internal_v1(uuid,uuid,text,text)','assets.list_compliance_policies_internal_v1(uuid,text)','assets.configure_compliance_policy_internal_v1(uuid,text,text,integer,text,date,date,uuid,boolean,text)','assets.request_asset_decommission_internal_v1(uuid,uuid,text,uuid)','assets.approve_asset_decommission_internal_v1(uuid,uuid,boolean,text)','assets.registration_context_v1(uuid)','assets.registration_choices_v1(uuid)','assets.register_equipment_v1(uuid,uuid,uuid,text,text,text)','assets.create_asset_internal_v1(uuid,uuid,uuid,text,text,text,uuid,uuid,text,text,text,text,integer,date,text,text,text,text,boolean,numeric,text,uuid,uuid,uuid,uuid,integer)']) x where to_regprocedure(x) is not null)) then raise exception 'operations_unexpected_routine_effect' using errcode='55000';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('app_private','platform','identity','portfolio','audit','finance','assets','maintenance','customer_api','utilities','security_access','documents','occupancy','billing','payments','governance','communications') and c.relkind in ('r','p') and c.oid not in (select to_regclass(x) from unnest(array['app_private.canonical_authority_revision_v1','assets.asset_categories','assets.asset_components','assets.asset_decommission_requests','assets.asset_documents','assets.asset_downtimes','assets.asset_history','assets.asset_inspections','assets.asset_warranties','assets.asset_warranty_claims','assets.assets','assets.compliance_policies','audit.events','billing.invoice_lines','billing.invoices','billing.receivables','communications.channel_members','communications.channels','communications.comments','communications.notification_preferences','communications.notifications','communications.poll_options','communications.poll_responses','communications.polls','communications.posts','communications.reactions','communications.unit_invitations','documents.access_events','documents.document_links','documents.document_versions','documents.documents','documents.folders','documents.legal_records','documents.retention_policies','finance.accounting_periods','finance.accounts','finance.allocation_inputs','finance.allocation_items','finance.allocation_rules','finance.allocation_runs','finance.charge_categories','finance.journal_entries','finance.journals','governance.agenda_items','governance.attendance','governance.ballots','governance.eligibility_snapshots','governance.meetings','governance.minutes','governance.resolutions','governance.vote_options','governance.votes','identity.context_grants','identity.membership_parties','identity.memberships','identity.permissions','identity.profiles','identity.role_permissions','identity.roles','maintenance.attachments','maintenance.maintenance_plans','maintenance.purchase_orders','maintenance.sla_measurements','maintenance.ticket_work_orders','maintenance.tickets','maintenance.vendor_contracts','maintenance.vendor_quotes','maintenance.vendors','maintenance.work_order_assignments','maintenance.work_order_checklist_items','maintenance.work_order_costs','maintenance.work_order_events','maintenance.work_orders','occupancy.leases','payments.bank_accounts','payments.bank_transactions','payments.import_batches','payments.payments','payments.reconciliation_matches','platform.customer_workspaces','platform.idempotency_keys','platform.jurisdiction_profiles','platform.module_definitions','platform.module_operating_model_compatibilities','platform.module_permission_bindings','platform.module_property_profile_compatibilities','platform.operating_models','platform.outbox_events','platform.platform_role_assignments','platform.platform_users','platform.property_jurisdiction_assignments','platform.property_operating_model_compatibilities','platform.property_profiles','platform.property_space_kind_compatibilities','platform.space_kinds','platform.subscription_plans','platform.tenants','platform.workspace_access_bases','platform.workspace_contracts','platform.workspace_delegation_permissions','platform.workspace_delegations','platform.workspace_entitlements','platform.workspace_member_role_authority_sources','platform.workspace_member_roles','platform.workspace_modules','platform.workspace_role_handover_lineage','platform.workspace_role_idempotency','platform.workspace_role_modules','platform.workspace_role_permissions','platform.workspace_roles','platform.workspace_taxonomy_assignments','portfolio.addresses','portfolio.buildings','portfolio.entrances','portfolio.ownerships','portfolio.parties','portfolio.properties','portfolio.units','security_access.access_points','utilities.consumption_periods','utilities.meter_readings','utilities.meters']) x where to_regclass(x) is not null)) then raise exception 'operations_unexpected_table_effect' using errcode='55000';end if;
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
