begin;

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
create or replace function documents.enforce_customer_document_integrity()
returns trigger language plpgsql security definer
set search_path = pg_catalog, documents, platform, portfolio, finance, billing, payments, maintenance, governance, communications, utilities, assets, audit
as $$
declare
  d documents.documents;
  target_tenant uuid;
begin
  if tg_table_name = 'document_retention_assignments' then
    if tg_op = 'DELETE' then
      raise exception 'retention_assignment_is_immutable' using errcode = '22000';
    end if;
    if tg_op = 'UPDATE' and (old.policy_snapshot is distinct from new.policy_snapshot or old.policy_version is distinct from new.policy_version or old.document_id is distinct from new.document_id) then
      raise exception 'historical_retention_snapshot_immutable' using errcode = '22000';
    end if;
    return new;

  elsif tg_table_name = 'document_audit_links' then
    if tg_op <> 'INSERT' then
      raise exception 'document_audit_link_is_immutable' using errcode = '22000';
    end if;
    select * into d from documents.documents where id = new.document_id and tenant_id = new.tenant_id;
    select tenant_id into target_tenant from audit.events where id = new.audit_event_id;
    if d.id is null or target_tenant is null or target_tenant <> new.tenant_id then
      raise exception 'document_link_cross_tenant_or_missing' using errcode = '22000';
    end if;
    return new;

  elsif tg_table_name = 'document_links' then
    if tg_op <> 'INSERT' then
      raise exception 'document_link_is_immutable' using errcode = '22000';
    end if;
    select * into d from documents.documents where id = new.document_id and tenant_id = new.tenant_id;
    if d.id is null then
      raise exception 'document_link_document_invalid' using errcode = '22000';
    end if;

    -- Canonical Cross-Module Resolver & Existence Check
    if new.entity_type = 'platform.tenant' then
      select id into target_tenant from platform.tenants where id = new.entity_id;
    elsif new.entity_type = 'portfolio.property' then
      select tenant_id into target_tenant from portfolio.properties where id = new.entity_id;
    elsif new.entity_type = 'portfolio.building' then
      select tenant_id into target_tenant from portfolio.buildings where id = new.entity_id;
    elsif new.entity_type = 'portfolio.unit' then
      select tenant_id into target_tenant from portfolio.units where id = new.entity_id;
    elsif new.entity_type = 'platform.contract' then
      select w.tenant_id into target_tenant
      from platform.workspace_contracts c
      join platform.customer_workspaces w on w.id = c.customer_workspace_id
      where c.id = new.entity_id;
    elsif new.entity_type = 'billing.invoice' then
      select tenant_id into target_tenant from billing.invoices where id = new.entity_id;
    elsif new.entity_type = 'payments.payment' then
      select tenant_id into target_tenant from payments.payments where id = new.entity_id;
    elsif new.entity_type = 'finance.journal' then
      select tenant_id into target_tenant from finance.journals where id = new.entity_id;
    elsif new.entity_type = 'maintenance.work_order' then
      select tenant_id into target_tenant from maintenance.work_orders where id = new.entity_id;
    elsif new.entity_type = 'maintenance.purchase_order' then
      select tenant_id into target_tenant from maintenance.purchase_orders where id = new.entity_id;
    elsif new.entity_type = 'maintenance.rfq' then
      select tenant_id into target_tenant from maintenance.rfqs where id = new.entity_id;
    elsif new.entity_type = 'maintenance.vendor_quote' then
      select tenant_id into target_tenant from maintenance.vendor_quotes where id = new.entity_id;
    elsif new.entity_type = 'maintenance.ticket' then
      select tenant_id into target_tenant from maintenance.tickets where id = new.entity_id;
    elsif new.entity_type = 'governance.meeting' then
      select tenant_id into target_tenant from governance.meetings where id = new.entity_id;
    elsif new.entity_type = 'governance.resolution' then
      select tenant_id into target_tenant from governance.resolutions where id = new.entity_id;
    elsif new.entity_type = 'governance.minute' then
      select tenant_id into target_tenant from governance.minutes where id = new.entity_id;
    elsif new.entity_type = 'communications.post' then
      select tenant_id into target_tenant from communications.posts where id = new.entity_id;
    elsif new.entity_type = 'communications.official_notice' then
      select tenant_id into target_tenant from communications.official_notices where id = new.entity_id;
    elsif new.entity_type = 'communications.statutory_evidence' then
      select tenant_id into target_tenant from communications.statutory_evidence where id = new.entity_id;
    elsif new.entity_type = 'utilities.meter' then
      select tenant_id into target_tenant from utilities.meters where id = new.entity_id;
    elsif new.entity_type = 'utilities.meter_reading' then
      select tenant_id into target_tenant from utilities.meter_readings where id = new.entity_id;
    elsif new.entity_type = 'utilities.ocr_candidate' then
      select tenant_id into target_tenant from utilities.ocr_field_candidates where id = new.entity_id;
    elsif new.entity_type = 'utilities.consumption_period' then
      select tenant_id into target_tenant from utilities.consumption_periods where id = new.entity_id;
    elsif new.entity_type = 'assets.asset' then
      select tenant_id into target_tenant from assets.assets where id = new.entity_id;
    elsif new.entity_type = 'assets.inspection' then
      select tenant_id into target_tenant from assets.asset_inspections where id = new.entity_id;
    elsif new.entity_type = 'assets.warranty' then
      select tenant_id into target_tenant from assets.asset_warranties where id = new.entity_id;
    else
      raise exception 'document_link_type_invalid' using errcode = '22000';
    end if;

    if target_tenant is null or target_tenant <> new.tenant_id then
      raise exception 'document_link_cross_tenant_or_missing' using errcode = '22000';
    end if;
    return new;

  elsif tg_table_name = 'documents' then
    if tg_op = 'DELETE' then
      if old.legal_hold or exists(select 1 from documents.legal_holds h where h.document_id = old.id and h.status = 'active') then
        raise exception 'document_under_legal_hold' using errcode = '22000';
      end if;
      if old.is_evidence and old.evidence_status = 'verified' then
        raise exception 'verified_evidence_cannot_be_deleted' using errcode = '22000';
      end if;
    end if;

    if tg_op = 'UPDATE' then
      if old.legal_hold and (new.title, new.document_type, new.category, new.deleted_at) is distinct from (old.title, old.document_type, old.category, old.deleted_at) then
        raise exception 'document_under_legal_hold' using errcode = '22000';
      end if;
      if old.evidence_status = 'verified' and (new.is_evidence, new.evidence_status, new.evidence_type, new.verified_by, new.verified_at) is distinct from (old.is_evidence, old.evidence_status, old.evidence_type, old.verified_by, old.verified_at) then
        raise exception 'verified_evidence_is_immutable' using errcode = '22000';
      end if;
      if old.published_at is not null and (new.current_version, new.title, new.document_type, new.effective_on, new.retention_snapshot) is distinct from (old.current_version, old.title, old.document_type, old.effective_on, old.retention_snapshot) then
        raise exception 'published_document_is_immutable' using errcode = '22000';
      end if;
      if new.classification < old.classification then
        raise exception 'classification_downgrade_forbidden' using errcode = '22000';
      end if;
    end if;
    return case when tg_op = 'DELETE' then old else new end;

  elsif tg_table_name = 'legal_holds' then
    if tg_op = 'DELETE' then
      raise exception 'legal_hold_history_is_append_only' using errcode = '22000';
    end if;
    if tg_op = 'UPDATE' and old.status = 'released' and new is distinct from old then
      raise exception 'released_legal_hold_is_immutable' using errcode = '22000';
    end if;
    return new;

  elsif tg_table_name = 'retention_records' then
    if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.finalized_at is not null and new is distinct from old) then
      raise exception 'final_retention_record_is_immutable' using errcode = '22000';
    end if;
    return case when tg_op = 'DELETE' then old else new end;

  elsif tg_table_name = 'lifecycle_events' then
    if tg_op <> 'INSERT' then
      raise exception 'document_lifecycle_is_append_only' using errcode = '22000';
    end if;
    return new;
  end if;

  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Domain Integrity Trigger & Hard Delete Prevention
-- ----------------------------------------------------------------------------
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

commit;
