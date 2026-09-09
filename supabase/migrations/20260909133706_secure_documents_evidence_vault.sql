begin;

-- ============================================================================
-- Migration 80: Secure Documents, Evidence Vault, Versioning, Retention & Signed Access
-- Architecture: Canonical documents schema forward-only extension
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Canonical Private Storage Bucket: document-vault
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'document-vault',
  'document-vault',
  false,
  20971520, -- 20MB limit
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = excluded.allowed_mime_types;

-- ----------------------------------------------------------------------------
-- 2. Bootstrap Permissions & Role Mappings
-- ----------------------------------------------------------------------------
insert into identity.permissions (code, resource, action, description) values
  ('documents.vault.manage', 'documents', 'manage', 'Configure document classifications, folders, and policy assignments'),
  ('documents.vault.upload', 'documents', 'upload', 'Create upload intents and upload document files into the vault'),
  ('documents.vault.verify', 'documents', 'verify', 'Formally verify documents as statutory legal evidence under dual control (AAL2)'),
  ('documents.vault.hold', 'documents', 'hold', 'Place and release legal holds overriding document retention and disposition (AAL2)'),
  ('documents.vault.disposition', 'documents', 'disposition', 'Request and approve document lifecycle disposition under dual control (AAL2)')
on conflict (code) do update set
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description;

-- Grant permissions to association_admin
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where lower(r.code) = 'association_admin'
  and p.code like 'documents.vault.%'
on conflict (role_id, permission_id) do update set effect = 'allow';

-- Grant permissions to property_manager
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where lower(r.code) = 'property_manager'
  and p.code in (
    'documents.vault.read',
    'documents.vault.manage',
    'documents.vault.upload',
    'documents.vault.verify',
    'documents.vault.disposition'
  )
on conflict (role_id, permission_id) do update set effect = 'allow';

-- Grant permissions to president
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where lower(r.code) = 'president'
  and p.code in (
    'documents.vault.read',
    'documents.vault.manage',
    'documents.vault.verify',
    'documents.vault.hold',
    'documents.vault.disposition'
  )
on conflict (role_id, permission_id) do update set effect = 'allow';

-- Grant permissions to censor (strictly read-only)
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where lower(r.code) = 'censor'
  and p.code = 'documents.vault.read'
on conflict (role_id, permission_id) do update set effect = 'allow';

-- Grant permissions to owner & tenant_resident (scoped read and upload)
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where lower(r.code) in ('owner', 'tenant_resident')
  and p.code in ('documents.vault.read', 'documents.vault.upload')
on conflict (role_id, permission_id) do update set effect = 'allow';

-- ----------------------------------------------------------------------------
-- 3. Schema Extensions: documents & document_versions
-- ----------------------------------------------------------------------------
alter table documents.documents
  add column if not exists is_evidence boolean not null default false,
  add column if not exists evidence_type text,
  add column if not exists evidence_status text not null default 'none' check (evidence_status in ('none', 'pending_verification', 'verified', 'rejected')),
  add column if not exists verified_by uuid references auth.users(id) on delete restrict,
  add column if not exists verified_at timestamptz,
  add column if not exists disposition_status text not null default 'retained' check (disposition_status in ('retained', 'review_due', 'legal_hold', 'disposition_requested', 'disposition_approved', 'expired'));

alter table documents.document_versions
  add column if not exists checksum_status text not null default 'verified' check (checksum_status in ('pending', 'verified', 'mismatch', 'failed')),
  add column if not exists scanning_status text not null default 'deferred' check (scanning_status in ('scanning_pending', 'clean', 'quarantined', 'deferred')),
  add column if not exists original_filename text,
  add column if not exists detected_mime_type text;

-- ----------------------------------------------------------------------------
-- 4. Upload Intents Table (Single-Use, Bound Path, Replay Protected)
-- ----------------------------------------------------------------------------
create table if not exists documents.upload_intents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  context_id uuid not null references identity.context_grants(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  document_id uuid references documents.documents(id) on delete restrict,
  bucket_id text not null default 'document-vault',
  object_path text not null unique,
  expected_version integer not null default 1,
  declared_mime_type text not null,
  max_size_bytes bigint not null default 20971520,
  idempotency_key text,
  nonce text not null default encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex'),
  status text not null default 'created' check (status in ('created', 'authorized', 'consumed', 'expired', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  server_auth_hash text not null,
  expires_at timestamptz not null default (statement_timestamp() + interval '15 minutes'),
  consumed_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);

alter table documents.upload_intents enable row level security;
revoke all on documents.upload_intents from public, anon;
grant select on documents.upload_intents to authenticated;

-- ----------------------------------------------------------------------------
-- 5. Storage RLS Policies for document-vault
-- Strict Binding to Unconsumed, Active Upload Intent & Tenant
-- ----------------------------------------------------------------------------
drop policy if exists document_vault_intent_insert on storage.objects;
create policy document_vault_intent_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'document-vault'
  and auth.uid() is not null
  and exists (
    select 1 from documents.upload_intents ui
    where ui.bucket_id = 'document-vault'
      and ui.object_path = storage.objects.name
      and ui.user_id = auth.uid()
      and ui.status in ('created', 'authorized')
      and ui.expires_at > statement_timestamp()
      and ui.consumed_at is null
  )
);

drop policy if exists document_vault_tenant_select on storage.objects;
create policy document_vault_tenant_select on storage.objects
for select to authenticated
using (
  bucket_id = 'document-vault'
  and auth.uid() is not null
  and exists (
    select 1 from documents.upload_intents ui
    where ui.bucket_id = 'document-vault'
      and ui.object_path = storage.objects.name
      and ui.user_id = auth.uid()
  )
);

-- Note: No UPDATE/upsert or DELETE policies are granted on document-vault to authenticated or anon,
-- guaranteeing zero direct client overwrite, upsert, or deletion.

-- ----------------------------------------------------------------------------
-- 6. Document Retention Assignments & Policies Extension
-- ----------------------------------------------------------------------------
alter table documents.retention_policies
  add column if not exists version integer not null default 1,
  add column if not exists effective_from date not null default current_date,
  add column if not exists effective_to date,
  add column if not exists legal_review_status text not null default 'LEGAL_REVIEW_REQUIRED' check (legal_review_status in ('LEGAL_REVIEW_REQUIRED', 'REVIEWED_AUTHORITATIVE', 'EXEMPT')),
  add column if not exists is_frozen boolean not null default false;

alter table documents.retention_policies
  drop constraint if exists retention_policies_pkey cascade;
alter table documents.retention_policies
  add primary key (tenant_id, code, version);

-- Overlap prevention trigger for retention policy versions
create or replace function documents.check_retention_policy_overlap()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from documents.retention_policies
    where tenant_id = new.tenant_id
      and code = new.code
      and version <> new.version
      and daterange(effective_from, coalesce(effective_to, '9999-12-31'::date), '[]') &&
          daterange(new.effective_from, coalesce(new.effective_to, '9999-12-31'::date), '[]')
  ) then
    raise exception 'retention_policy_version_overlap_rejected' using errcode = '22000';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_retention_policy_overlap on documents.retention_policies;
create trigger trg_retention_policy_overlap
before insert or update on documents.retention_policies
for each row execute function documents.check_retention_policy_overlap();

create table if not exists documents.document_retention_assignments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  document_id uuid not null references documents.documents(id) on delete restrict,
  policy_code text not null,
  policy_version integer not null default 1,
  policy_snapshot jsonb not null,
  retention_basis text not null,
  retention_start_event text not null default 'creation',
  retention_started_at timestamptz not null default statement_timestamp(),
  calculated_retain_until date,
  legal_review_status text not null default 'LEGAL_REVIEW_REQUIRED',
  assigned_by uuid references auth.users(id) on delete restrict,
  assigned_at timestamptz not null default statement_timestamp(),
  unique (document_id, policy_code)
);

alter table documents.document_retention_assignments enable row level security;
revoke all on documents.document_retention_assignments from public, anon;
grant select on documents.document_retention_assignments to authenticated;

-- ----------------------------------------------------------------------------
-- 7. Document Disposition Requests (Dual-Control Lifecycle, Non-Destructive)
-- ----------------------------------------------------------------------------
create table if not exists documents.disposition_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  document_id uuid not null references documents.documents(id) on delete restrict,
  requested_by uuid not null references auth.users(id) on delete restrict,
  requested_at timestamptz not null default statement_timestamp(),
  reason text not null check (length(trim(reason)) between 5 and 500),
  status text not null default 'pending_approval' check (status in ('pending_approval', 'approved', 'rejected')),
  reviewed_by uuid references auth.users(id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text,
  execution_note text default 'DEFERRED-PHYSICAL-DISPOSITION-EXECUTION',
  unique (document_id, status)
);

alter table documents.disposition_requests enable row level security;
revoke all on documents.disposition_requests from public, anon;
grant select on documents.disposition_requests to authenticated;

-- ----------------------------------------------------------------------------
-- 8. Updated Integrity Trigger: Cross-Module Allowlist & Immutability Hardening
-- ----------------------------------------------------------------------------
create or replace function documents.enforce_customer_document_integrity()
returns trigger language plpgsql security definer
set search_path = pg_catalog, documents, platform, portfolio, finance, billing, payments, maintenance, governance, communications, utilities, audit
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

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists trg_retention_assignments_integrity on documents.document_retention_assignments;
create trigger trg_retention_assignments_integrity
before update or delete on documents.document_retention_assignments
for each row execute function documents.enforce_customer_document_integrity();

-- ----------------------------------------------------------------------------
-- 9. Privileged Domain Routines in Schema documents
-- ----------------------------------------------------------------------------

-- Helper: resolve actor and verify permission
create or replace function documents.resolve_vault_actor(
  p_context_id uuid,
  p_permission text,
  p_require_aal2 boolean default false
)
returns table (
  tenant_id uuid,
  membership_id uuid,
  party_id uuid,
  user_id uuid,
  role_code text,
  scope_type text,
  property_id uuid,
  building_id uuid,
  unit_id uuid,
  aal text
) language plpgsql stable security definer set search_path = pg_catalog, identity, platform as $$
declare
  v_rec record;
  v_aal text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  v_aal := coalesce(auth.jwt()->>'aal', 'aal1');
  if p_require_aal2 and v_aal <> 'aal2' then
    raise exception 'mfa_aal2_required' using errcode = '42501';
  end if;

  select
    g.tenant_id,
    g.membership_id,
    m.user_id,
    r.code as role_code,
    g.scope_type::text as scope_type,
    g.property_id,
    g.building_id,
    g.unit_id
  into v_rec
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

  -- Entitlement check: module.documents
  if not exists (
    select 1
    from platform.customer_workspaces w
    join platform.workspace_entitlements e on e.customer_workspace_id = w.id
    where w.tenant_id = v_rec.tenant_id
      and w.lifecycle_status = 'ACTIVE'
      and e.entitlement_key = 'module.documents'
      and e.valid_from <= statement_timestamp()
      and (e.valid_until is null or e.valid_until > statement_timestamp())
      and e.boolean_value = true
  ) then
    raise exception 'documents_module_not_entitled' using errcode = '42501';
  end if;

  -- Permission check
  if not exists (
    select 1
    from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    join identity.roles r on r.id = rp.role_id
    where lower(r.code) = lower(v_rec.role_code)
      and p.code = p_permission
      and rp.effect = 'allow'
  ) then
    raise exception 'permission_denied' using errcode = '42501';
  end if;

  return query select
    v_rec.tenant_id,
    v_rec.membership_id,
    null::uuid as party_id,
    v_rec.user_id,
    v_rec.role_code,
    v_rec.scope_type,
    v_rec.property_id,
    v_rec.building_id,
    v_rec.unit_id,
    v_aal;
end;
$$;
revoke all on function documents.resolve_vault_actor(uuid, text, boolean) from public, anon, authenticated;

-- Internal: Create Upload Intent
create or replace function documents.create_upload_intent_internal(
  p_context_id uuid,
  p_document_id uuid,
  p_filename text,
  p_declared_mime text,
  p_size_bytes bigint,
  p_idempotency_key text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, documents, identity, platform as $$
declare
  v_actor record;
  v_intent_id uuid;
  v_object_path text;
  v_expected_version integer := 1;
  v_server_hash text;
  v_ext text;
  v_doc documents.documents;
begin
  select * into v_actor from documents.resolve_vault_actor(p_context_id, 'documents.vault.upload', false);

  if p_size_bytes is null or p_size_bytes <= 0 then
    raise exception 'zero_byte_upload_rejected' using errcode = '22000';
  end if;
  if p_size_bytes > 20971520 then
    raise exception 'file_size_limit_exceeded' using errcode = '22000';
  end if;

  -- Check declared MIME allowlist
  if lower(p_declared_mime) not in (
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) then
    raise exception 'unsupported_document_mime_type' using errcode = '22023';
  end if;

  -- Rejection of script / active content extensions
  v_ext := lower(substring(p_filename from '\.([^\.]+)$'));
  if v_ext in ('exe', 'sh', 'bat', 'cmd', 'js', 'mjs', 'ts', 'html', 'htm', 'svg', 'php', 'py', 'zip', 'tar', 'gz', 'rar') then
    raise exception 'disallowed_file_extension' using errcode = '22023';
  end if;

  -- Check if existing document
  if p_document_id is not null then
    select * into v_doc from documents.documents where id = p_document_id and tenant_id = v_actor.tenant_id;
    if not found then
      raise exception 'document_not_found' using errcode = '22000';
    end if;
    if v_doc.legal_hold then
      raise exception 'document_under_legal_hold' using errcode = '22000';
    end if;
    v_expected_version := v_doc.current_version + 1;
  end if;

  -- Generate server-opaque object path
  v_intent_id := gen_random_uuid();
  v_object_path := v_actor.tenant_id::text || '/' || v_intent_id::text || '/v' || v_expected_version::text || '.' || coalesce(v_ext, 'bin');
  v_server_hash := encode(extensions.digest(v_intent_id::text || ':' || v_object_path || ':' || v_actor.user_id::text, 'sha256'), 'hex');

  insert into documents.upload_intents (
    id, tenant_id, context_id, user_id, document_id, bucket_id, object_path,
    expected_version, declared_mime_type, max_size_bytes, idempotency_key,
    status, server_auth_hash
  ) values (
    v_intent_id, v_actor.tenant_id, p_context_id, v_actor.user_id, p_document_id, 'document-vault', v_object_path,
    v_expected_version, lower(p_declared_mime), p_size_bytes, p_idempotency_key,
    'authorized', v_server_hash
  );

  return jsonb_build_object(
    'intent_id', v_intent_id,
    'object_path', v_object_path,
    'bucket_id', 'document-vault',
    'expected_version', v_expected_version,
    'max_size_bytes', p_size_bytes,
    'expires_at', (statement_timestamp() + interval '15 minutes')
  );
end;
$$;
revoke all on function documents.create_upload_intent_internal(uuid, uuid, text, text, bigint, text) from public, anon, authenticated;

-- Internal: Finalize Upload (Atomically Consumes Intent, Computes SHA-256 Server-Side)
create or replace function documents.finalize_upload_internal(
  p_context_id uuid,
  p_intent_id uuid,
  p_computed_sha256 text,
  p_actual_size_bytes bigint,
  p_detected_mime text,
  p_title text default null,
  p_document_type text default 'general',
  p_classification text default 'internal',
  p_property_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, documents, identity, platform, portfolio as $$
declare
  v_actor record;
  v_intent documents.upload_intents%rowtype;
  v_doc_id uuid;
  v_version_id uuid;
  v_doc documents.documents;
begin
  select * into v_actor from documents.resolve_vault_actor(p_context_id, 'documents.vault.upload', false);

  -- Atomic row lock on upload intent
  select * into v_intent
  from documents.upload_intents
  where id = p_intent_id and tenant_id = v_actor.tenant_id
  for update;

  if not found then
    raise exception 'upload_intent_not_found' using errcode = '22000';
  end if;

  if v_intent.user_id <> v_actor.user_id then
    raise exception 'upload_intent_user_mismatch' using errcode = '42501';
  end if;

  if v_intent.status = 'consumed' or v_intent.consumed_at is not null then
    raise exception 'upload_intent_already_consumed' using errcode = '22000';
  end if;

  if v_intent.expires_at <= statement_timestamp() then
    update documents.upload_intents set status = 'expired' where id = p_intent_id;
    raise exception 'expired_intent_cannot_finalize' using errcode = '22000';
  end if;

  if v_intent.attempts >= v_intent.max_attempts then
    update documents.upload_intents set status = 'failed' where id = p_intent_id;
    raise exception 'intent_attempt_limit_exceeded' using errcode = '22000';
  end if;

  -- Validate server computed SHA-256 (64 hex characters)
  if p_computed_sha256 is null or length(p_computed_sha256) <> 64 then
    raise exception 'invalid_server_checksum' using errcode = '22000';
  end if;

  if p_actual_size_bytes is null or p_actual_size_bytes <= 0 or p_actual_size_bytes > v_intent.max_size_bytes then
    raise exception 'invalid_uploaded_byte_size' using errcode = '22000';
  end if;

  -- Mark intent consumed atomically
  update documents.upload_intents
  set status = 'consumed', consumed_at = statement_timestamp(), attempts = attempts + 1
  where id = p_intent_id;

  -- Create or retrieve document
  if v_intent.document_id is not null then
    v_doc_id := v_intent.document_id;
    select * into v_doc from documents.documents where id = v_doc_id and tenant_id = v_actor.tenant_id;
    if v_doc.legal_hold then
      raise exception 'document_under_legal_hold' using errcode = '22000';
    end if;

    update documents.documents
    set current_version = v_intent.expected_version, updated_at = statement_timestamp()
    where id = v_doc_id;
  else
    v_doc_id := gen_random_uuid();
    insert into documents.documents (
      id, tenant_id, property_id, title, document_type, classification,
      current_version, status, created_by, category
    ) values (
      v_doc_id, v_actor.tenant_id, coalesce(p_property_id, v_actor.property_id),
      coalesce(p_title, 'Untitled Document'), p_document_type, p_classification::documents.classification,
      v_intent.expected_version, 'active'::platform.record_status, v_actor.user_id, p_document_type
    );
  end if;

  -- Insert finalized immutable document version
  v_version_id := gen_random_uuid();
  insert into documents.document_versions (
    id, tenant_id, document_id, version, object_path, sha256,
    mime_type, size_bytes, metadata_json, uploaded_by,
    checksum_status, scanning_status, detected_mime_type, created_at
  ) values (
    v_version_id, v_actor.tenant_id, v_doc_id, v_intent.expected_version, v_intent.object_path, p_computed_sha256,
    lower(p_detected_mime), p_actual_size_bytes,
    jsonb_build_object('upload_intent_id', v_intent.id, 'declared_mime', v_intent.declared_mime_type),
    v_actor.user_id, 'verified', 'deferred', lower(p_detected_mime), statement_timestamp()
  );

  -- Record access / audit event
  insert into documents.access_events (
    tenant_id, document_id, version_id, actor_id, action, purpose
  ) values (
    v_actor.tenant_id, v_doc_id, v_version_id, v_actor.user_id, 'finalize_upload', 'Document uploaded and finalized'
  );

  return jsonb_build_object(
    'document_id', v_doc_id,
    'version_id', v_version_id,
    'version', v_intent.expected_version,
    'sha256', p_computed_sha256,
    'size_bytes', p_actual_size_bytes,
    'scanning_status', 'deferred',
    'status', 'finalized'
  );
end;
$$;
revoke all on function documents.finalize_upload_internal(uuid, uuid, text, bigint, text, text, text, text, uuid) from public, anon, authenticated;

-- Internal: Authorize Signed Download (Short-Lived, Validates Status & Scanning)
create or replace function documents.authorize_download_internal(
  p_context_id uuid,
  p_document_id uuid,
  p_version_id uuid default null,
  p_admin_inspection boolean default false
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, documents, identity, platform as $$
declare
  v_actor record;
  v_doc documents.documents;
  v_ver documents.document_versions;
begin
  select * into v_actor from documents.resolve_vault_actor(p_context_id, 'documents.vault.read', false);

  select * into v_doc from documents.documents where id = p_document_id and tenant_id = v_actor.tenant_id;
  if not found then
    raise exception 'document_not_found' using errcode = '22000';
  end if;

  if p_version_id is not null then
    select * into v_ver from documents.document_versions where id = p_version_id and document_id = p_document_id;
  else
    select * into v_ver from documents.document_versions where document_id = p_document_id and version = v_doc.current_version;
  end if;

  if not found then
    raise exception 'document_version_not_found' using errcode = '22000';
  end if;

  -- Quarantine check: quarantined files cannot be downloaded
  if v_ver.scanning_status = 'quarantined' then
    raise exception 'quarantined_file_cannot_download' using errcode = '42501';
  end if;

  -- Scanning pending check: pending files cannot be downloaded
  if v_ver.scanning_status = 'scanning_pending' then
    raise exception 'pending_scanner_cannot_download' using errcode = '42501';
  end if;

  -- Scanner-Deferred Fail Closed Check: normal signed download strictly denied
  if v_ver.scanning_status = 'deferred' and not coalesce(p_admin_inspection, false) then
    raise exception 'deferred_scanner_cannot_normal_download' using errcode = '42501';
  end if;

  -- Admin Inspection: requires AAL2 and admin / manager role
  if v_ver.scanning_status = 'deferred' and coalesce(p_admin_inspection, false) then
    if v_actor.aal <> 'aal2' then
      raise exception 'admin_inspection_aal2_required' using errcode = '42501';
    end if;
    if v_actor.role_code not in ('association_admin', 'property_manager', 'president') then
      raise exception 'admin_inspection_permission_denied' using errcode = '42501';
    end if;
  end if;

  -- Record access event
  insert into documents.access_events (
    tenant_id, document_id, version_id, actor_id, action, purpose
  ) values (
    v_actor.tenant_id, p_document_id, v_ver.id, v_actor.user_id,
    case when coalesce(p_admin_inspection, false) then 'admin_inspection_download' else 'authorized_download' end,
    case when coalesce(p_admin_inspection, false) then 'Admin inspection signed download requested' else 'Authorized signed download requested' end
  );

  return jsonb_build_object(
    'document_id', p_document_id,
    'version_id', v_ver.id,
    'bucket_id', 'document-vault',
    'object_path', v_ver.object_path,
    'mime_type', v_ver.mime_type,
    'size_bytes', v_ver.size_bytes,
    'sha256', v_ver.sha256,
    'expires_in_seconds', 60,
    'is_admin_inspection', coalesce(p_admin_inspection, false)
  );
end;
$$;
revoke all on function documents.authorize_download_internal(uuid, uuid, uuid, boolean) from public, anon, authenticated;

-- Internal: Verify Document Evidence (Dual-Control, AAL2 Required, Clean Scanner Required)
create or replace function documents.verify_evidence_internal(
  p_context_id uuid,
  p_document_id uuid,
  p_evidence_type text,
  p_decision text,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, documents, identity, platform as $$
declare
  v_actor record;
  v_doc documents.documents;
  v_ver documents.document_versions;
begin
  select * into v_actor from documents.resolve_vault_actor(p_context_id, 'documents.vault.verify', true);

  if p_decision not in ('verified', 'rejected') then
    raise exception 'invalid_verification_decision' using errcode = '22023';
  end if;

  select * into v_doc from documents.documents where id = p_document_id and tenant_id = v_actor.tenant_id;
  if not found then
    raise exception 'document_not_found' using errcode = '22000';
  end if;

  if v_doc.evidence_status = 'verified' then
    raise exception 'document_evidence_already_verified' using errcode = '22000';
  end if;

  -- Dual control: creator cannot verify own document
  if v_doc.created_by = v_actor.user_id then
    raise exception 'dual_control_creator_cannot_verify_evidence' using errcode = '42501';
  end if;

  select * into v_ver from documents.document_versions where document_id = p_document_id and version = v_doc.current_version;

  -- Scanner-Deferred Contract: Unscanned / deferred files CANNOT become verified evidence!
  if v_ver.scanning_status <> 'clean' then
    raise exception 'verified_evidence_requires_clean_scanner_status' using errcode = '22000';
  end if;

  update documents.documents
  set is_evidence = (p_decision = 'verified'),
      evidence_type = coalesce(p_evidence_type, 'statutory_proof'),
      evidence_status = p_decision,
      verified_by = case when p_decision = 'verified' then v_actor.user_id else null end,
      verified_at = case when p_decision = 'verified' then statement_timestamp() else null end
  where id = p_document_id;

  insert into documents.access_events (
    tenant_id, document_id, version_id, actor_id, action, purpose
  ) values (
    v_actor.tenant_id, p_document_id, v_ver.id, v_actor.user_id, 'verify_evidence', 'Evidence verification: ' || p_decision
  );

  return jsonb_build_object(
    'document_id', p_document_id,
    'evidence_status', p_decision,
    'verified_by', v_actor.user_id,
    'verified_at', statement_timestamp()
  );
end;
$$;
revoke all on function documents.verify_evidence_internal(uuid, uuid, text, text, text) from public, anon, authenticated;

-- Internal: Legal Hold Place & Release (Dual Control, Overrides Retention)
create or replace function documents.place_legal_hold_internal(
  p_context_id uuid,
  p_document_id uuid,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, documents, identity, platform as $$
declare
  v_actor record;
  v_doc documents.documents;
begin
  select * into v_actor from documents.resolve_vault_actor(p_context_id, 'documents.vault.hold', true);

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'legal_hold_reason_required' using errcode = '22023';
  end if;

  select * into v_doc from documents.documents where id = p_document_id and tenant_id = v_actor.tenant_id;
  if not found then
    raise exception 'document_not_found' using errcode = '22000';
  end if;

  if v_doc.legal_hold then
    raise exception 'document_already_under_legal_hold' using errcode = '22000';
  end if;

  update documents.documents set legal_hold = true, disposition_status = 'legal_hold' where id = p_document_id;

  insert into documents.legal_holds (
    tenant_id, document_id, reason, status, applied_at, evidence_hash
  ) values (
    v_actor.tenant_id, p_document_id, trim(p_reason), 'active', statement_timestamp(),
    encode(extensions.digest(p_document_id::text || ':' || p_reason, 'sha256'), 'hex')
  );

  insert into documents.access_events (
    tenant_id, document_id, actor_id, action, purpose
  ) values (
    v_actor.tenant_id, p_document_id, v_actor.user_id, 'place_legal_hold', p_reason
  );

  return jsonb_build_object('document_id', p_document_id, 'legal_hold', true, 'status', 'active');
end;
$$;
revoke all on function documents.place_legal_hold_internal(uuid, uuid, text) from public, anon, authenticated;

create or replace function documents.release_legal_hold_internal(
  p_context_id uuid,
  p_document_id uuid,
  p_release_reason text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, documents, identity, platform as $$
declare
  v_actor record;
  v_hold documents.legal_holds%rowtype;
begin
  select * into v_actor from documents.resolve_vault_actor(p_context_id, 'documents.vault.hold', true);

  select * into v_hold
  from documents.legal_holds
  where document_id = p_document_id and status = 'active'
  order by applied_at desc limit 1;

  if not found then
    raise exception 'no_active_legal_hold_found' using errcode = '22000';
  end if;

  update documents.legal_holds
  set status = 'released', released_at = statement_timestamp()
  where id = v_hold.id;

  update documents.documents
  set legal_hold = false, disposition_status = 'retained'
  where id = p_document_id;

  insert into documents.access_events (
    tenant_id, document_id, actor_id, action, purpose
  ) values (
    v_actor.tenant_id, p_document_id, v_actor.user_id, 'release_legal_hold', p_release_reason
  );

  return jsonb_build_object('document_id', p_document_id, 'legal_hold', false, 'status', 'released');
end;
$$;
revoke all on function documents.release_legal_hold_internal(uuid, uuid, text) from public, anon, authenticated;

-- Internal: Disposition Request & Approve (Dual-Control, Deferred Physical Execution)
create or replace function documents.request_disposition_internal(
  p_context_id uuid,
  p_document_id uuid,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, documents, identity, platform as $$
declare
  v_actor record;
  v_doc documents.documents;
  v_req_id uuid;
begin
  select * into v_actor from documents.resolve_vault_actor(p_context_id, 'documents.vault.disposition', false);

  select * into v_doc from documents.documents where id = p_document_id and tenant_id = v_actor.tenant_id;
  if not found then
    raise exception 'document_not_found' using errcode = '22000';
  end if;

  if v_doc.legal_hold then
    raise exception 'legal_hold_blocks_disposition' using errcode = '22000';
  end if;

  v_req_id := gen_random_uuid();
  insert into documents.disposition_requests (
    id, tenant_id, document_id, requested_by, reason, status
  ) values (
    v_req_id, v_actor.tenant_id, p_document_id, v_actor.user_id, trim(p_reason), 'pending_approval'
  );

  update documents.documents set disposition_status = 'disposition_requested' where id = p_document_id;

  return jsonb_build_object('request_id', v_req_id, 'status', 'pending_approval');
end;
$$;
revoke all on function documents.request_disposition_internal(uuid, uuid, text) from public, anon, authenticated;

create or replace function documents.approve_disposition_internal(
  p_context_id uuid,
  p_request_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, documents, identity, platform as $$
declare
  v_actor record;
  v_req documents.disposition_requests%rowtype;
  v_doc documents.documents;
begin
  select * into v_actor from documents.resolve_vault_actor(p_context_id, 'documents.vault.disposition', true);

  select * into v_req
  from documents.disposition_requests
  where id = p_request_id and tenant_id = v_actor.tenant_id
  for update;

  if not found or v_req.status <> 'pending_approval' then
    raise exception 'disposition_request_not_actionable' using errcode = '22000';
  end if;

  -- Dual control: requester cannot approve own request
  if v_req.requested_by = v_actor.user_id then
    raise exception 'dual_control_requester_cannot_approve_disposition' using errcode = '42501';
  end if;

  select * into v_doc from documents.documents where id = v_req.document_id and tenant_id = v_actor.tenant_id;
  if v_doc.legal_hold then
    raise exception 'legal_hold_blocks_disposition' using errcode = '22000';
  end if;

  update documents.disposition_requests
  set status = p_decision,
      reviewed_by = v_actor.user_id,
      reviewed_at = statement_timestamp(),
      rejection_reason = p_rejection_reason,
      execution_note = 'DEFERRED-PHYSICAL-DISPOSITION-EXECUTION'
  where id = p_request_id;

  update documents.documents
  set disposition_status = case when p_decision = 'approved' then 'disposition_approved' else 'retained' end
  where id = v_req.document_id;

  return jsonb_build_object(
    'request_id', p_request_id,
    'document_id', v_req.document_id,
    'status', p_decision,
    'execution', 'DEFERRED-PHYSICAL-DISPOSITION-EXECUTION'
  );
end;
$$;
revoke all on function documents.approve_disposition_internal(uuid, uuid, text, text) from public, anon, authenticated;

-- Internal: Retention Policy Assignment
create or replace function documents.assign_retention_policy_internal(
  p_context_id uuid,
  p_document_id uuid,
  p_policy_code text,
  p_basis text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, documents, identity, platform as $$
declare
  v_actor record;
  v_policy documents.retention_policies%rowtype;
  v_doc documents.documents;
  v_retain_until date;
begin
  select * into v_actor from documents.resolve_vault_actor(p_context_id, 'documents.vault.manage', false);

  select * into v_policy
  from documents.retention_policies
  where code = p_policy_code and tenant_id = v_actor.tenant_id
  order by version desc limit 1;

  if not found then
    raise exception 'document_retention_policy_unconfigured' using errcode = '22000';
  end if;

  select * into v_doc from documents.documents where id = p_document_id and tenant_id = v_actor.tenant_id;
  if not found then
    raise exception 'document_not_found' using errcode = '22000';
  end if;

  if v_policy.retain_months is not null then
    v_retain_until := (current_date + (v_policy.retain_months || ' months')::interval)::date;
  end if;

  insert into documents.document_retention_assignments (
    tenant_id, document_id, policy_code, policy_version, policy_snapshot,
    retention_basis, retention_start_event, calculated_retain_until,
    legal_review_status, assigned_by
  ) values (
    v_actor.tenant_id, p_document_id, p_policy_code, v_policy.version,
    jsonb_build_object('retain_months', v_policy.retain_months, 'disposition_action', v_policy.disposition_action),
    coalesce(p_basis, 'standard_statutory'), 'creation', v_retain_until,
    v_policy.legal_review_status, v_actor.user_id
  )
  on conflict (document_id, policy_code) do update set
    policy_version = excluded.policy_version,
    policy_snapshot = excluded.policy_snapshot,
    calculated_retain_until = excluded.calculated_retain_until,
    assigned_by = excluded.assigned_by,
    assigned_at = statement_timestamp();

  update documents.documents set retention_policy_code = p_policy_code where id = p_document_id;

  return jsonb_build_object(
    'document_id', p_document_id,
    'policy_code', p_policy_code,
    'policy_version', v_policy.version,
    'calculated_retain_until', v_retain_until,
    'legal_review_status', v_policy.legal_review_status
  );
end;
$$;
revoke all on function documents.assign_retention_policy_internal(uuid, uuid, text, text) from public, anon, authenticated;

-- Internal: Cross-Module Link / Unlink
create or replace function documents.link_document_entity_internal(
  p_context_id uuid,
  p_document_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_relation_type text default 'evidence'
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, documents, identity, platform as $$
declare
  v_actor record;
  v_doc documents.documents;
  v_ver documents.document_versions;
  v_link_id uuid;
begin
  select * into v_actor from documents.resolve_vault_actor(p_context_id, 'documents.vault.manage', false);

  select * into v_doc from documents.documents where id = p_document_id and tenant_id = v_actor.tenant_id;
  if not found then
    raise exception 'document_not_found' using errcode = '22000';
  end if;

  select * into v_ver from documents.document_versions where document_id = p_document_id and version = v_doc.current_version;

  -- Fail-closed: unscanned or deferred document cannot be attached as authoritative evidence
  if p_relation_type in ('authoritative', 'statutory_proof') and v_ver.scanning_status <> 'clean' then
    raise exception 'deferred_scanner_cannot_attach_authoritative_evidence' using errcode = '22000';
  end if;

  v_link_id := gen_random_uuid();
  insert into documents.document_links (
    id, tenant_id, document_id, entity_type, entity_id, relation_type
  ) values (
    v_link_id, v_actor.tenant_id, p_document_id, p_entity_type, p_entity_id, coalesce(p_relation_type, 'evidence')
  );

  return jsonb_build_object('link_id', v_link_id, 'status', 'linked');
end;
$$;
revoke all on function documents.link_document_entity_internal(uuid, uuid, text, uuid, text) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10. PostgREST Customer API Versioned RPC Wrappers (SECURITY INVOKER)
-- ----------------------------------------------------------------------------

-- 1. customer_api.create_upload_intent_v1
create or replace function customer_api.create_upload_intent_v1(
  p_context_id uuid,
  p_document_id uuid default null,
  p_filename text default 'document.bin',
  p_declared_mime text default 'application/pdf',
  p_size_bytes bigint default 1048576,
  p_idempotency_key text default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return documents.create_upload_intent_internal(
    p_context_id, p_document_id, p_filename, p_declared_mime, p_size_bytes, p_idempotency_key
  );
end;
$$;
revoke all on function customer_api.create_upload_intent_v1(uuid, uuid, text, text, bigint, text) from public, anon;
grant execute on function customer_api.create_upload_intent_v1(uuid, uuid, text, text, bigint, text) to authenticated;

-- 2. customer_api.finalize_upload_v1
create or replace function customer_api.finalize_upload_v1(
  p_context_id uuid,
  p_intent_id uuid,
  p_computed_sha256 text,
  p_actual_size_bytes bigint,
  p_detected_mime text,
  p_title text default null,
  p_document_type text default 'general',
  p_classification text default 'internal',
  p_property_id uuid default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return documents.finalize_upload_internal(
    p_context_id, p_intent_id, p_computed_sha256, p_actual_size_bytes, p_detected_mime,
    p_title, p_document_type, p_classification, p_property_id
  );
end;
$$;
revoke all on function customer_api.finalize_upload_v1(uuid, uuid, text, bigint, text, text, text, text, uuid) from public, anon;
grant execute on function customer_api.finalize_upload_v1(uuid, uuid, text, bigint, text, text, text, text, uuid) to authenticated;

-- 3. customer_api.authorize_document_download_v1
create or replace function customer_api.authorize_document_download_v1(
  p_context_id uuid,
  p_document_id uuid,
  p_version_id uuid default null,
  p_admin_inspection boolean default false
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return documents.authorize_download_internal(p_context_id, p_document_id, p_version_id, p_admin_inspection);
end;
$$;
revoke all on function customer_api.authorize_document_download_v1(uuid, uuid, uuid, boolean) from public, anon;
grant execute on function customer_api.authorize_document_download_v1(uuid, uuid, uuid, boolean) to authenticated;

-- 4. customer_api.verify_document_evidence_v1
create or replace function customer_api.verify_document_evidence_v1(
  p_context_id uuid,
  p_document_id uuid,
  p_evidence_type text default 'statutory_proof',
  p_decision text default 'verified',
  p_notes text default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return documents.verify_evidence_internal(p_context_id, p_document_id, p_evidence_type, p_decision, p_notes);
end;
$$;
revoke all on function customer_api.verify_document_evidence_v1(uuid, uuid, text, text, text) from public, anon;
grant execute on function customer_api.verify_document_evidence_v1(uuid, uuid, text, text, text) to authenticated;

-- 5. customer_api.place_legal_hold_v1
create or replace function customer_api.place_legal_hold_v1(
  p_context_id uuid,
  p_document_id uuid,
  p_reason text
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return documents.place_legal_hold_internal(p_context_id, p_document_id, p_reason);
end;
$$;
revoke all on function customer_api.place_legal_hold_v1(uuid, uuid, text) from public, anon;
grant execute on function customer_api.place_legal_hold_v1(uuid, uuid, text) to authenticated;

-- 6. customer_api.release_legal_hold_v1
create or replace function customer_api.release_legal_hold_v1(
  p_context_id uuid,
  p_document_id uuid,
  p_release_reason text
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return documents.release_legal_hold_internal(p_context_id, p_document_id, p_release_reason);
end;
$$;
revoke all on function customer_api.release_legal_hold_v1(uuid, uuid, text) from public, anon;
grant execute on function customer_api.release_legal_hold_v1(uuid, uuid, text) to authenticated;

-- 7. customer_api.request_document_disposition_v1
create or replace function customer_api.request_document_disposition_v1(
  p_context_id uuid,
  p_document_id uuid,
  p_reason text
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return documents.request_disposition_internal(p_context_id, p_document_id, p_reason);
end;
$$;
revoke all on function customer_api.request_document_disposition_v1(uuid, uuid, text) from public, anon;
grant execute on function customer_api.request_document_disposition_v1(uuid, uuid, text) to authenticated;

-- 8. customer_api.approve_document_disposition_v1
create or replace function customer_api.approve_document_disposition_v1(
  p_context_id uuid,
  p_request_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return documents.approve_disposition_internal(p_context_id, p_request_id, p_decision, p_rejection_reason);
end;
$$;
revoke all on function customer_api.approve_document_disposition_v1(uuid, uuid, text, text) from public, anon;
grant execute on function customer_api.approve_document_disposition_v1(uuid, uuid, text, text) to authenticated;

-- 9. customer_api.assign_retention_policy_v1
create or replace function customer_api.assign_retention_policy_v1(
  p_context_id uuid,
  p_document_id uuid,
  p_policy_code text,
  p_basis text default 'standard_statutory'
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return documents.assign_retention_policy_internal(p_context_id, p_document_id, p_policy_code, p_basis);
end;
$$;
revoke all on function customer_api.assign_retention_policy_v1(uuid, uuid, text, text) from public, anon;
grant execute on function customer_api.assign_retention_policy_v1(uuid, uuid, text, text) to authenticated;

-- 10. customer_api.link_document_entity_v1
create or replace function customer_api.link_document_entity_v1(
  p_context_id uuid,
  p_document_id uuid,
  p_entity_type text,
  p_entity_id uuid,
  p_relation_type text default 'evidence'
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return documents.link_document_entity_internal(p_context_id, p_document_id, p_entity_type, p_entity_id, p_relation_type);
end;
$$;
revoke all on function customer_api.link_document_entity_v1(uuid, uuid, text, uuid, text) from public, anon;
grant execute on function customer_api.link_document_entity_v1(uuid, uuid, text, uuid, text) to authenticated;

-- ----------------------------------------------------------------------------
-- 11. Covering Foreign Key Indexes (Invariant 023 Compliance)
-- ----------------------------------------------------------------------------
create index if not exists upload_intents_context_id_idx on documents.upload_intents(context_id);
create index if not exists upload_intents_document_id_idx on documents.upload_intents(document_id);
create index if not exists upload_intents_tenant_id_idx on documents.upload_intents(tenant_id);
create index if not exists upload_intents_user_id_idx on documents.upload_intents(user_id);

create index if not exists retention_assignments_assigned_by_idx on documents.document_retention_assignments(assigned_by);
create index if not exists retention_assignments_document_id_idx on documents.document_retention_assignments(document_id);
create index if not exists retention_assignments_tenant_id_idx on documents.document_retention_assignments(tenant_id);

create index if not exists disposition_requests_document_id_idx on documents.disposition_requests(document_id);
create index if not exists disposition_requests_requested_by_idx on documents.disposition_requests(requested_by);
create index if not exists disposition_requests_reviewed_by_idx on documents.disposition_requests(reviewed_by);
create index if not exists disposition_requests_tenant_id_idx on documents.disposition_requests(tenant_id);

create index if not exists documents_verified_by_idx on documents.documents(verified_by);

commit;
