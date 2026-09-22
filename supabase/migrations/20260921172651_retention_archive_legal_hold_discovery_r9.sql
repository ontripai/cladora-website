begin;

-- CLADORA R10 Phase 3A / Migration 109
-- Retention, archival, legal hold, disposal, storage evidence and KMS control plane.
-- Physical object deletion is intentionally outside PostgreSQL and must use the
-- Supabase Storage API. This migration stores intent/evidence only.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'cladora_rpc_owner') then
    create role cladora_rpc_owner nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'cladora_storage_worker') then
    create role cladora_storage_worker nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'cladora_kms_worker') then
    create role cladora_kms_worker nologin nosuperuser nocreatedb nocreaterole noinherit;
  end if;
end $$;

grant cladora_rpc_owner, cladora_storage_worker, cladora_kms_worker to postgres;
revoke cladora_rpc_owner, cladora_storage_worker, cladora_kms_worker from anon, authenticated, service_role;

grant usage on schema auth, app_private, platform, identity, portfolio, maintenance, documents, audit, extensions to cladora_rpc_owner;
grant execute on function auth.uid(), auth.jwt() to cladora_rpc_owner;
grant usage on schema app_private to authenticated, service_role, cladora_storage_worker, cladora_kms_worker;

alter table documents.documents
  add constraint documents_tenant_id_id_uq unique (tenant_id,id);
alter table documents.document_versions
  add constraint document_versions_tenant_id_id_uq unique (tenant_id,id);
alter table portfolio.properties
  add constraint properties_tenant_id_id_uq unique (tenant_id,id);
alter table maintenance.vendors
  add constraint vendors_tenant_id_id_uq unique (tenant_id,id);

-- 1-3: versioned retention policy model.
create table app_private.retention_policy_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  policy_code text not null,
  version_no integer not null check (version_no > 0),
  effective_range daterange not null,
  status text not null default 'draft' check (status in ('draft','active','superseded','withdrawn')),
  source_register_version text not null,
  ceccar_approved_by uuid,
  ceccar_approved_at timestamptz,
  legal_approved_by uuid,
  legal_approved_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default statement_timestamp(),
  lock_version integer not null default 0,
  unique (tenant_id,policy_code,version_no),
  unique (tenant_id,id),
  foreign key (tenant_id,policy_code,version_no) references documents.retention_policies(tenant_id,code,version) on delete restrict,
  check (not isempty(effective_range)),
  check ((ceccar_approved_by is null) = (ceccar_approved_at is null)),
  check ((legal_approved_by is null) = (legal_approved_at is null))
);

alter table app_private.retention_policy_versions
  add constraint retention_policy_versions_no_overlap
  exclude using gist (tenant_id with =, policy_code with =, effective_range with &&)
  where (status = 'active');

create table app_private.retention_policy_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  policy_version_id uuid not null,
  document_class text not null,
  qualification_status text not null check (qualification_status in ('statutory_confirmed','product_risk_policy','expert_pending','archival_permanent')),
  duration_years integer check (duration_years is null or duration_years > 0),
  start_basis text not null check (start_basis in ('document_date','fiscal_year_following_july_01','trigger_event','permanent','expert_pending')),
  trigger_event_type text,
  legal_authority text,
  legal_applicability_basis text not null,
  disposition_action text not null default 'review' check (disposition_action in ('review','destroy','transfer_archive','preserve')),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id,id),
  foreign key (tenant_id,policy_version_id) references app_private.retention_policy_versions(tenant_id,id) on delete restrict,
  check ((start_basis='trigger_event') = (trigger_event_type is not null)),
  check ((start_basis in ('permanent','expert_pending')) = (duration_years is null))
);

create table app_private.document_retention_requirements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  document_id uuid not null,
  policy_rule_id uuid not null,
  requirement_state text not null check (requirement_state in ('fixed_date','event_pending','event_triggered','permanent_archival','expert_pending')),
  classification_date date,
  trigger_event_type text,
  trigger_event_occurred_on date,
  retention_start_on date,
  retention_last_mandatory_day date,
  review_eligible_on date,
  calculated_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id,document_id,policy_rule_id),
  foreign key (tenant_id,document_id) references documents.documents(tenant_id,id) on delete restrict,
  foreign key (tenant_id,policy_rule_id) references app_private.retention_policy_rules(tenant_id,id) on delete restrict,
  check (
    (requirement_state='fixed_date' and trigger_event_type is null and trigger_event_occurred_on is null
      and retention_start_on is not null and retention_last_mandatory_day is not null
      and review_eligible_on > retention_last_mandatory_day
      and retention_last_mandatory_day >= retention_start_on)
    or
    (requirement_state='event_pending' and trigger_event_type is not null and trigger_event_occurred_on is null
      and retention_start_on is null and retention_last_mandatory_day is null and review_eligible_on is null)
    or
    (requirement_state='event_triggered' and trigger_event_type is not null and trigger_event_occurred_on is not null
      and retention_start_on is not null and retention_last_mandatory_day is not null
      and review_eligible_on > retention_last_mandatory_day)
    or
    (requirement_state in ('permanent_archival','expert_pending')
      and retention_start_on is null and retention_last_mandatory_day is null and review_eligible_on is null)
  )
);

-- 4-6: legal hold aggregate and scope epoch.
create table app_private.legal_holds (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hold_reference text not null,
  matter_reference text,
  reason text not null,
  status text not null default 'draft' check (status in ('draft','active','released','cancelled')),
  created_by uuid not null,
  created_at timestamptz not null default statement_timestamp(),
  activated_by uuid,
  activated_at timestamptz,
  released_by uuid,
  released_at timestamptz,
  release_reason text,
  cancelled_by uuid,
  cancelled_at timestamptz,
  lock_version integer not null default 0,
  unique (tenant_id,id),
  unique (tenant_id,hold_reference),
  foreign key (tenant_id) references platform.tenants(id) on delete restrict,
  check (
    (status='draft' and activated_at is null and released_at is null and cancelled_at is null)
    or (status='active' and activated_at is not null and activated_by is not null and released_at is null and cancelled_at is null)
    or (status='released' and activated_at is not null and released_at is not null and released_by is not null and nullif(btrim(release_reason),'') is not null and cancelled_at is null)
    or (status='cancelled' and activated_at is null and cancelled_at is not null and cancelled_by is not null and released_at is null)
  )
);
create unique index legal_holds_open_matter_uq
  on app_private.legal_holds(tenant_id,matter_reference)
  where matter_reference is not null and status in ('draft','active');

create table app_private.legal_hold_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  hold_id uuid not null,
  target_type text not null check (target_type in ('document','property','vendor','class_date_range')),
  document_id uuid,
  property_id uuid,
  vendor_id uuid,
  document_class text,
  document_date_range daterange,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id,id),
  foreign key (tenant_id,hold_id) references app_private.legal_holds(tenant_id,id) on delete cascade,
  foreign key (tenant_id,document_id) references documents.documents(tenant_id,id) on delete restrict,
  foreign key (tenant_id,property_id) references portfolio.properties(tenant_id,id) on delete restrict,
  foreign key (tenant_id,vendor_id) references maintenance.vendors(tenant_id,id) on delete restrict,
  check (
    (target_type='document' and document_id is not null and property_id is null and vendor_id is null and document_class is null and document_date_range is null)
    or (target_type='property' and property_id is not null and document_id is null and vendor_id is null and document_class is null and document_date_range is null)
    or (target_type='vendor' and vendor_id is not null and document_id is null and property_id is null and document_class is null and document_date_range is null)
    or (target_type='class_date_range' and document_class is not null and document_date_range is not null and document_id is null and property_id is null and vendor_id is null)
  )
);

create table app_private.legal_hold_scope_epochs (
  tenant_id uuid primary key references platform.tenants(id) on delete restrict,
  epoch bigint not null default 0 check (epoch >= 0),
  updated_at timestamptz not null default statement_timestamp()
);

-- 7-17: disposal, worker, Storage evidence and tombstones.
create table app_private.disposal_protocols (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  protocol_number text not null, status text not null default 'draft'
    check (status in ('draft','pending_approval','approved','sealed','scheduled','executing','completed','cancelled')),
  created_by uuid not null, created_at timestamptz not null default statement_timestamp(),
  submitted_at timestamptz, approved_at timestamptz, sealed_at timestamptz, scheduled_at timestamptz,
  manifest_sha256 text, hold_scope_epoch bigint not null default 0, lock_version integer not null default 0,
  unique (tenant_id,id), unique (tenant_id,protocol_number),
  foreign key (tenant_id) references platform.tenants(id) on delete restrict
);

create table app_private.disposal_protocol_documents (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, protocol_id uuid not null, document_id uuid not null,
  retention_snapshot jsonb not null, hold_epoch_snapshot bigint not null, added_at timestamptz not null default statement_timestamp(),
  unique (protocol_id,document_id),
  foreign key (tenant_id,protocol_id) references app_private.disposal_protocols(tenant_id,id) on delete cascade,
  foreign key (tenant_id,document_id) references documents.documents(tenant_id,id) on delete restrict
);

create table app_private.disposal_committee_members (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, protocol_id uuid not null,
  member_user_id uuid not null, committee_role text not null check (committee_role in ('committee_chair','committee_secretary','technical_expert','member')),
  member_name_snapshot text not null, credential_kind text, credential_reference text, credential_verified_at timestamptz,
  appointed_at timestamptz not null default statement_timestamp(),
  unique (protocol_id,member_user_id),
  foreign key (tenant_id,protocol_id) references app_private.disposal_protocols(tenant_id,id) on delete cascade
);
create unique index disposal_one_chair_uq on app_private.disposal_committee_members(protocol_id) where committee_role='committee_chair';
create unique index disposal_one_secretary_uq on app_private.disposal_committee_members(protocol_id) where committee_role='committee_secretary';

create table app_private.disposal_approval_votes (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, protocol_id uuid not null, committee_member_id uuid not null,
  decision text not null check (decision in ('approved','rejected')), comment text,
  voted_at timestamptz not null default statement_timestamp(), unique (protocol_id,committee_member_id),
  foreign key (tenant_id,protocol_id) references app_private.disposal_protocols(tenant_id,id) on delete cascade,
  foreign key (committee_member_id) references app_private.disposal_committee_members(id) on delete restrict
);

create table app_private.disposal_manifest_records (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, protocol_id uuid not null,
  schema_version text not null default 'v1', canonical_payload jsonb not null, canonical_utf8 bytea not null,
  domain_prefix text not null default 'CLADORA-DISPOSAL-MANIFEST-V1:', sha256 text not null,
  sealed_by uuid not null, sealed_at timestamptz not null default statement_timestamp(),
  unique (protocol_id), unique (tenant_id,sha256),
  foreign key (tenant_id,protocol_id) references app_private.disposal_protocols(tenant_id,id) on delete restrict
);

create table app_private.disposal_purge_jobs (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, protocol_id uuid not null, document_id uuid not null,
  document_version_id uuid, bucket_id text not null default 'document-vault', object_path text not null,
  expected_sha256 text not null, expected_size_bytes bigint, status text not null default 'purge_pending'
    check (status in ('purge_pending','claim_granted','delete_requested','outcome_unknown','absence_verified','retry_wait','manual_review','abandoned','tombstoned')),
  hold_scope_epoch bigint not null, claim_token uuid, claimed_by text, claimed_at timestamptz, lease_expires_at timestamptz,
  retry_count integer not null default 0 check (retry_count >= 0), max_retries integer not null default 5 check (max_retries between 1 and 20),
  next_attempt_at timestamptz, lock_version integer not null default 0,
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(),
  unique (tenant_id,id), unique (protocol_id,document_id),
  foreign key (tenant_id,protocol_id) references app_private.disposal_protocols(tenant_id,id) on delete restrict,
  foreign key (tenant_id,document_id) references documents.documents(tenant_id,id) on delete restrict,
  foreign key (tenant_id,document_version_id) references documents.document_versions(tenant_id,id) on delete set null (document_version_id),
  check (document_version_id is not null or status='tombstoned')
);

-- Access history survives disposition, while the disposed version identifier is detached.
alter table documents.access_events drop constraint if exists access_events_version_id_fkey;
alter table documents.access_events add constraint access_events_version_id_fkey
  foreign key (version_id) references documents.document_versions(id) on delete set null;

create table app_private.worker_principals (
  id uuid primary key default gen_random_uuid(), principal_name text not null unique,
  worker_kind text not null default 'storage' check (worker_kind in ('storage','kms')),
  token_subject text not null unique, status text not null default 'active' check (status in ('active','suspended','revoked')),
  allowed_tenant_ids uuid[] not null default '{}', max_batch_size integer not null default 10 check (max_batch_size between 1 and 100),
  max_lease_seconds integer not null default 300 check (max_lease_seconds between 30 and 900),
  created_at timestamptz not null default statement_timestamp(), revoked_at timestamptz
);

create table app_private.worker_assertion_journal (
  id uuid primary key default gen_random_uuid(), worker_principal_id uuid not null references app_private.worker_principals(id) on delete restrict,
  tenant_id uuid not null, assertion_id uuid not null unique, job_id uuid, allowed_operation text not null,
  claim_token uuid, nonce text not null unique, issued_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null, consumed_at timestamptz,
  foreign key (tenant_id,job_id) references app_private.disposal_purge_jobs(tenant_id,id) on delete restrict,
  check (expires_at > issued_at)
);

create table app_private.storage_delete_outbox (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, job_id uuid not null, assertion_id uuid not null,
  gateway_operation_id uuid not null unique, bucket_id text not null, object_path text not null, expected_sha256 text not null,
  status text not null default 'pending' check (status in ('pending','claimed','delete_succeeded','outcome_unknown','absence_verified','failed','quarantined')),
  attempt_number integer not null default 1 check (attempt_number > 0), delete_result_code integer,
  last_error_code text, last_error_detail text, created_at timestamptz not null default statement_timestamp(),
  claimed_at timestamptz, completed_at timestamptz,
  foreign key (tenant_id,job_id) references app_private.disposal_purge_jobs(tenant_id,id) on delete restrict,
  foreign key (assertion_id) references app_private.worker_assertion_journal(assertion_id) on delete restrict,
  unique (job_id,attempt_number)
);

create table app_private.storage_deletion_evidence (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, job_id uuid not null, assertion_id uuid not null,
  gateway_operation_id uuid not null, provider_request_id text, bucket_id text not null, object_path text not null,
  expected_sha256 text not null, pre_delete_etag text, pre_delete_size_bytes bigint,
  delete_result_code integer, probe_result_code integer not null check (probe_result_code=404),
  status_code_classification text not null check (status_code_classification='VERIFIED_ABSENCE'),
  attempt_number integer not null check (attempt_number>0), receipt_nonce text not null unique,
  issued_at timestamptz not null, observed_at timestamptz not null, schema_version text not null,
  canonical_payload_hash text not null, mac_key_version integer not null check (mac_key_version>0), signature_mac text not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (job_id), unique (gateway_operation_id),
  foreign key (tenant_id,job_id) references app_private.disposal_purge_jobs(tenant_id,id) on delete restrict,
  foreign key (assertion_id) references app_private.worker_assertion_journal(assertion_id) on delete restrict,
  check (observed_at >= issued_at), check (pre_delete_size_bytes is null or pre_delete_size_bytes>=0)
);

create table app_private.document_tombstones (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, document_id uuid not null,
  protocol_id uuid not null, purge_job_id uuid not null, destruction_at timestamptz not null,
  linkage_hmac_sha256 text not null check (linkage_hmac_sha256 ~ '^[0-9a-f]{64}$'), hmac_key_version integer not null check (hmac_key_version>0),
  evidence_id uuid not null,
  retention_status text not null default 'expert_pending' check (retention_status='expert_pending'),
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id,document_id), unique (purge_job_id),
  foreign key (tenant_id,document_id) references documents.documents(tenant_id,id) on delete restrict,
  foreign key (tenant_id,protocol_id) references app_private.disposal_protocols(tenant_id,id) on delete restrict,
  foreign key (tenant_id,purge_job_id) references app_private.disposal_purge_jobs(tenant_id,id) on delete restrict,
  foreign key (evidence_id) references app_private.storage_deletion_evidence(id) on delete restrict
);

-- 18-21: dual-control feature flags.
create table app_private.feature_flags (
  flag_name text primary key, enabled boolean not null default false,
  lock_version integer not null default 0, updated_by uuid, updated_at timestamptz not null default statement_timestamp()
);
create table app_private.feature_flag_change_requests (
  id uuid primary key default gen_random_uuid(), flag_name text not null references app_private.feature_flags(flag_name) on delete restrict,
  requested_state boolean not null, reason text not null, requested_by uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','cancelled')),
  expires_at timestamptz not null, lock_version integer not null default 0,
  created_at timestamptz not null default statement_timestamp(), resolved_at timestamptz,
  check (expires_at > created_at)
);
create unique index feature_flag_one_pending_uq on app_private.feature_flag_change_requests(flag_name) where status='pending';
create table app_private.feature_flag_approvals (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references app_private.feature_flag_change_requests(id) on delete cascade,
  approver_id uuid not null, approved_at timestamptz not null default statement_timestamp(), unique (request_id,approver_id)
);
create table app_private.feature_flag_audit_log (
  id bigint generated always as identity primary key, flag_name text not null, request_id uuid,
  old_state boolean, new_state boolean not null, actor_id uuid not null,
  occurred_at timestamptz not null default statement_timestamp(), detail jsonb not null default '{}'::jsonb
);

-- 22-27: KMS request/dispatch/callback journal. No raw key material is stored.
create table app_private.kms_key_requests (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  purpose text not null, requested_by uuid not null, status text not null default 'pending_approval'
    check (status in ('pending_approval','approved','dispatch_pending','dispatched','active','failed','cancelled')),
  provider_key_reference text, expires_at timestamptz not null, lock_version integer not null default 0,
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp(),
  unique (tenant_id,id), check (expires_at > created_at)
);
create unique index kms_one_pending_purpose_uq on app_private.kms_key_requests(tenant_id,purpose)
  where status in ('pending_approval','approved','dispatch_pending','dispatched');
create table app_private.kms_key_approvals (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references app_private.kms_key_requests(id) on delete cascade,
  approver_id uuid not null, approved_at timestamptz not null default statement_timestamp(), unique(request_id,approver_id)
);
create table app_private.kms_dispatch_outbox (
  id uuid primary key default gen_random_uuid(), request_id uuid not null unique references app_private.kms_key_requests(id) on delete restrict,
  operation text not null default 'create_key', status text not null default 'pending' check(status in ('pending','claimed','sent','failed','completed')),
  claim_token uuid, claimed_by text, lease_expires_at timestamptz, attempt_count integer not null default 0,
  created_at timestamptz not null default statement_timestamp(), updated_at timestamptz not null default statement_timestamp()
);
create table app_private.kms_provider_callbacks (
  id uuid primary key default gen_random_uuid(), request_id uuid not null references app_private.kms_key_requests(id) on delete restrict,
  callback_nonce text not null unique, provider_event_id text not null unique, payload_hash text not null,
  signature_verified boolean not null, provider_key_reference text, received_at timestamptz not null default statement_timestamp()
);
create table app_private.kms_key_journal (
  id bigint generated always as identity primary key, tenant_id uuid not null, request_id uuid not null,
  key_version integer not null check(key_version>0), provider_key_reference text not null,
  state text not null check(state in ('active','rotating','retired','revoked')),
  activated_at timestamptz, retired_at timestamptz, created_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,key_version), unique(provider_key_reference),
  foreign key (tenant_id,request_id) references app_private.kms_key_requests(tenant_id,id) on delete restrict
);
create table app_private.kms_audit_evidence (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null, request_id uuid not null,
  event_type text not null, evidence_hash text not null, detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default statement_timestamp(),
  foreign key (tenant_id,request_id) references app_private.kms_key_requests(tenant_id,id) on delete restrict
);

-- 28-29: external archival clearance and append-only audit journal.
create table app_private.archival_clearance_certificates (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null references platform.tenants(id) on delete restrict,
  authority_name text not null, certificate_reference text not null, scope_json jsonb not null,
  issued_on date not null, valid_until date, evidence_document_id uuid,
  verified_by uuid not null, verified_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  unique(tenant_id,certificate_reference),
  foreign key (tenant_id,evidence_document_id) references documents.documents(tenant_id,id) on delete restrict,
  check(valid_until is null or valid_until>=issued_on)
);
create table app_private.audit_event_journal (
  id bigint generated always as identity primary key, tenant_id uuid,
  event_type text not null, aggregate_type text not null, aggregate_id uuid,
  actor_kind text not null check(actor_kind in ('human','storage_worker','kms_worker','system')),
  actor_id text not null, payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default statement_timestamp(), trace_id uuid not null default gen_random_uuid()
);

insert into app_private.feature_flags(flag_name,enabled) values
  ('retention_disposal_enabled',false),
  ('legal_hold_enabled',false),
  ('storage_purge_worker_enabled',false),
  ('kms_lifecycle_enabled',false);

insert into identity.permissions(code,resource,action,description) values
  ('records.retention.manage','records.retention','manage','Manage retention, legal holds and disposition'),
  ('security.kms.manage','security.kms','manage','Request and approve KMS key lifecycle operations'),
  ('platform.feature_flags.manage','platform.feature_flags','manage','Request and approve protected feature flags')
on conflict(code) do update set resource=excluded.resource,action=excluded.action,description=excluded.description;

with approved(role_code,permission_code) as (
  values
    ('association_admin','records.retention.manage'),
    ('property_manager','records.retention.manage'),
    ('president','records.retention.manage'),
    ('association_admin','security.kms.manage'),
    ('property_manager','security.kms.manage')
)
insert into identity.role_permissions(role_id,permission_id,effect)
select r.id,p.id,'allow'::platform.decision_effect
from approved a
join identity.roles r on r.tenant_id is null and lower(r.code)=a.role_code
join identity.permissions p on p.code=a.permission_code
on conflict(role_id,permission_id) do update set effect='allow';

-- Supporting indexes for every non-left-prefix FK and operational scan.
create index retention_versions_policy_fk_idx on app_private.retention_policy_versions(tenant_id,policy_code);
create index retention_rules_version_fk_idx on app_private.retention_policy_rules(tenant_id,policy_version_id);
create index retention_requirements_document_idx on app_private.document_retention_requirements(tenant_id,document_id);
create index retention_requirements_rule_idx on app_private.document_retention_requirements(tenant_id,policy_rule_id);
create index legal_hold_targets_hold_idx on app_private.legal_hold_targets(tenant_id,hold_id);
create index legal_hold_targets_document_idx on app_private.legal_hold_targets(tenant_id,document_id) where document_id is not null;
create index legal_hold_targets_property_idx on app_private.legal_hold_targets(tenant_id,property_id) where property_id is not null;
create index legal_hold_targets_vendor_idx on app_private.legal_hold_targets(tenant_id,vendor_id) where vendor_id is not null;
create index legal_holds_active_idx on app_private.legal_holds(tenant_id,id) where status='active';
create index protocol_documents_document_idx on app_private.disposal_protocol_documents(tenant_id,document_id);
create index committee_protocol_idx on app_private.disposal_committee_members(tenant_id,protocol_id);
create index votes_protocol_idx on app_private.disposal_approval_votes(tenant_id,protocol_id);
create index purge_jobs_claimable_idx on app_private.disposal_purge_jobs(tenant_id,next_attempt_at,created_at,id)
  where status in ('purge_pending','retry_wait');
create index purge_jobs_document_idx on app_private.disposal_purge_jobs(tenant_id,document_id);
create index worker_assertions_unexpired_idx on app_private.worker_assertion_journal(tenant_id,job_id,expires_at) where consumed_at is null;
create index storage_outbox_pending_idx on app_private.storage_delete_outbox(created_at,id) where status in ('pending','outcome_unknown');
create index storage_evidence_job_idx on app_private.storage_deletion_evidence(tenant_id,job_id);
create index tombstones_document_idx on app_private.document_tombstones(tenant_id,document_id);
create index feature_flag_request_idx on app_private.feature_flag_change_requests(flag_name,status,created_at);
create index kms_dispatch_pending_idx on app_private.kms_dispatch_outbox(created_at,id) where status in ('pending','failed');
create index kms_callbacks_request_idx on app_private.kms_provider_callbacks(request_id);
create index kms_audit_request_idx on app_private.kms_audit_evidence(tenant_id,request_id);
create index archival_clearance_doc_idx on app_private.archival_clearance_certificates(tenant_id,evidence_document_id) where evidence_document_id is not null;
create index phase3a_audit_tenant_time_idx on app_private.audit_event_journal(tenant_id,occurred_at desc,id desc);

-- Private schema: defense-in-depth RLS plus explicit denial of direct client/worker DML.
do $$
declare t text;
begin
  foreach t in array array[
    'retention_policy_versions','retention_policy_rules','document_retention_requirements',
    'legal_holds','legal_hold_targets','legal_hold_scope_epochs','disposal_protocols',
    'disposal_protocol_documents','disposal_committee_members','disposal_approval_votes',
    'disposal_manifest_records','disposal_purge_jobs','worker_principals','worker_assertion_journal',
    'storage_delete_outbox','storage_deletion_evidence','document_tombstones','feature_flags',
    'feature_flag_change_requests','feature_flag_approvals','feature_flag_audit_log','kms_key_requests',
    'kms_key_approvals','kms_dispatch_outbox','kms_provider_callbacks','kms_key_journal','kms_audit_evidence',
    'archival_clearance_certificates','audit_event_journal'
  ] loop
    execute format('alter table app_private.%I enable row level security',t);
    execute format('revoke all on table app_private.%I from public, anon, authenticated, cladora_storage_worker, cladora_kms_worker',t);
    execute format('grant select, insert, update, delete on table app_private.%I to cladora_rpc_owner',t);
    execute format('create policy %I on app_private.%I for all to cladora_rpc_owner using (true) with check (true)', 'phase3a_rpc_owner_'||t, t);
  end loop;
end $$;

grant select, insert, update on platform.idempotency_keys to cladora_rpc_owner;
grant select, insert on platform.outbox_events to cladora_rpc_owner;
grant select, update on documents.documents to cladora_rpc_owner;
grant select, delete on documents.document_versions to cladora_rpc_owner;
grant select, delete on documents.document_links to cladora_rpc_owner;
grant select on documents.retention_policies to cladora_rpc_owner;
grant select on portfolio.properties, maintenance.vendors, maintenance.vendor_quotes, maintenance.purchase_orders,
  identity.memberships, identity.roles, identity.role_permissions, identity.permissions to cladora_rpc_owner;
grant insert on audit.events to cladora_rpc_owner;
grant usage, select on sequence audit.events_id_seq to cladora_rpc_owner;
grant usage, select on all sequences in schema app_private to cladora_rpc_owner;

-- Shared authorization, idempotency and audit helpers.
create or replace function app_private.phase3a_require_human_v1(
  p_tenant_id uuid, p_platform_only boolean default false, p_permission text default 'records.retention.manage')
returns uuid language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_actor uuid := auth.uid();
begin
  if v_actor is null or coalesce(auth.jwt()->>'aal','') <> 'aal2' then
    raise exception using errcode='42501', message='aal2_required';
  end if;
  if p_platform_only then
    if not (app_private.has_platform_role('PLATFORM_SUPER_ADMIN'::platform.platform_role_type)
      or app_private.has_platform_role('PLATFORM_OPERATIONS'::platform.platform_role_type)) then
      raise exception using errcode='42501', message='insufficient_privilege';
    end if;
  else
    if p_tenant_id is null or app_private.active_tenant_id() is distinct from p_tenant_id
      or not exists (
        select 1
        from identity.memberships m
        join identity.role_permissions rp on rp.role_id=m.role_id and rp.effect='allow'
        join identity.permissions p on p.id=rp.permission_id and p.code=p_permission
        where m.tenant_id=p_tenant_id and m.user_id=v_actor and m.status='active'
          and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
      ) then
      raise exception using errcode='42501', message='tenant_access_denied';
    end if;
  end if;
  return v_actor;
end $$;

create or replace function app_private.phase3a_idempotency_get_v1(p_tenant_id uuid,p_key text,p_hash text)
returns jsonb language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v platform.idempotency_keys%rowtype;
begin
  if nullif(btrim(p_key),'') is null or nullif(btrim(p_hash),'') is null then
    raise exception using errcode='22023',message='idempotency_key_and_payload_hash_required';
  end if;
  select * into v from platform.idempotency_keys where tenant_id=p_tenant_id and key=p_key for update;
  if found and v.request_hash<>p_hash then raise exception using errcode='22023',message='idempotency_payload_mismatch'; end if;
  return case when found then v.response_ref else null end;
end $$;

create or replace function app_private.phase3a_idempotency_begin_v1(p_tenant_id uuid,p_actor uuid,p_key text,p_hash text)
returns void language plpgsql volatile security definer set search_path=pg_catalog as $$
begin
  insert into platform.idempotency_keys(tenant_id,actor_id,key,request_hash,expires_at)
  values(p_tenant_id,p_actor,p_key,p_hash,statement_timestamp()+interval '30 days')
  on conflict (tenant_id,key) do nothing;
end $$;

create or replace function app_private.phase3a_idempotency_finish_v1(p_tenant_id uuid,p_key text,p_response jsonb)
returns void language sql volatile security definer set search_path=pg_catalog as $$
  update platform.idempotency_keys set response_ref=p_response,status_code=200
  where tenant_id=p_tenant_id and key=p_key;
$$;

create or replace function app_private.phase3a_audit_v1(
  p_tenant_id uuid,p_event_type text,p_aggregate_type text,p_aggregate_id uuid,
  p_actor_kind text,p_actor_id text,p_payload jsonb default '{}'::jsonb)
returns void language sql volatile security definer set search_path=pg_catalog as $$
  insert into app_private.audit_event_journal(tenant_id,event_type,aggregate_type,aggregate_id,actor_kind,actor_id,payload)
  values(p_tenant_id,p_event_type,p_aggregate_type,p_aggregate_id,p_actor_kind,p_actor_id,coalesce(p_payload,'{}'::jsonb));
$$;

create or replace function app_private.calc_accounting_retention_start_on(p_document_date date)
returns date language plpgsql immutable security invoker set search_path=pg_catalog as $$
begin
  if p_document_date is null then raise exception using errcode='22023',message='null_date_not_allowed'; end if;
  return make_date(extract(year from p_document_date)::int+1,7,1);
end $$;

create or replace function app_private.calc_last_mandatory_day(p_start_on date,p_duration_years integer)
returns date language plpgsql immutable security invoker set search_path=pg_catalog as $$
begin
  if p_start_on is null then raise exception using errcode='22023',message='null_date_not_allowed'; end if;
  if p_duration_years is null or p_duration_years<=0 then raise exception using errcode='22023',message='duration_years_must_be_positive'; end if;
  return (p_start_on + make_interval(years=>p_duration_years) - interval '1 day')::date;
end $$;

create or replace function app_private.calc_review_eligible_on(p_start_on date,p_duration_years integer)
returns date language sql immutable security invoker set search_path=pg_catalog as $$
  select app_private.calc_last_mandatory_day(p_start_on,p_duration_years)+1;
$$;

create or replace function app_private.derive_advisory_lock_key(p_namespace text,p_id uuid)
returns bigint language plpgsql immutable security invoker set search_path=pg_catalog as $$
begin
  if p_namespace not in ('TENANT','PROTOCOL','DOCUMENT','HOLD','JOB','FEATURE_FLAG','KMS') then
    raise exception using errcode='22023',message='invalid_lock_namespace';
  end if;
  return (('x'||substr(encode(extensions.digest(p_namespace||':'||p_id::text,'sha256'),'hex'),1,16))::bit(64)::bigint);
end $$;

create or replace function app_private.is_feature_flag_enabled(p_flag_name text)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_enabled boolean;
begin
  if nullif(btrim(p_flag_name),'') is null then raise exception using errcode='22023',message='flag_name_empty'; end if;
  select enabled into v_enabled from app_private.feature_flags where flag_name=p_flag_name;
  return coalesce(v_enabled,false);
end $$;

create or replace function app_private.is_document_held(p_tenant_id uuid,p_document_id uuid)
returns boolean language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_property uuid; v_worker_ok boolean;
begin
  select exists (
    select 1 from app_private.worker_principals w
    where w.status='active' and w.token_subject=auth.jwt()->>'sub' and p_tenant_id=any(w.allowed_tenant_ids)
  ) into v_worker_ok;
  if not app_private.is_service_role() and not coalesce(v_worker_ok,false)
    and (app_private.active_tenant_id() is distinct from p_tenant_id or not app_private.is_active_member(p_tenant_id)) then
    raise exception using errcode='42501',message='tenant_access_denied';
  end if;
  select property_id into v_property from documents.documents where tenant_id=p_tenant_id and id=p_document_id;
  if not found then raise exception using errcode='P0002',message='document_not_found'; end if;
  return exists (
    select 1 from app_private.legal_holds h join app_private.legal_hold_targets t on t.hold_id=h.id and t.tenant_id=h.tenant_id
    where h.tenant_id=p_tenant_id and h.status='active' and (
      (t.target_type='document' and t.document_id=p_document_id)
      or (t.target_type='property' and t.property_id=v_property)
      or (t.target_type='vendor' and exists(
        select 1
        from documents.document_links l
        left join maintenance.vendor_quotes q
          on l.entity_type='maintenance.vendor_quote' and q.id=l.entity_id and q.tenant_id=l.tenant_id
        left join maintenance.purchase_orders o
          on l.entity_type='maintenance.purchase_order' and o.id=l.entity_id and o.tenant_id=l.tenant_id
        where l.tenant_id=p_tenant_id and l.document_id=p_document_id
          and coalesce(q.vendor_id,o.vendor_id)=t.vendor_id
      ))
      or (t.target_type='class_date_range' and exists(
        select 1 from app_private.document_retention_requirements rr
        join app_private.retention_policy_rules pr on pr.tenant_id=rr.tenant_id and pr.id=rr.policy_rule_id
        where rr.tenant_id=p_tenant_id and rr.document_id=p_document_id and pr.document_class=t.document_class
          and rr.classification_date is not null and t.document_date_range @> rr.classification_date))
    )
  );
end $$;

create or replace function app_private.evaluate_document_retention_v1(
  p_tenant_id uuid,p_document_id uuid,p_expected_lock_version integer,p_idempotency_key text,p_payload_hash text)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_exists boolean; v_blocking bigint; v_latest date; v_held boolean;
begin
  if not app_private.is_service_role() and (app_private.active_tenant_id() is distinct from p_tenant_id or not app_private.is_active_member(p_tenant_id)) then
    raise exception using errcode='42501',message='tenant_access_denied';
  end if;
  select true into v_exists from documents.documents where tenant_id=p_tenant_id and id=p_document_id;
  if not found then raise exception using errcode='P0002',message='document_not_found'; end if;
  select count(*) filter(where requirement_state in ('event_pending','permanent_archival','expert_pending') or review_eligible_on>current_date),
         max(review_eligible_on)
    into v_blocking,v_latest from app_private.document_retention_requirements
    where tenant_id=p_tenant_id and document_id=p_document_id;
  v_held:=app_private.is_document_held(p_tenant_id,p_document_id);
  return jsonb_build_object('document_id',p_document_id,'blocking_requirement_count',v_blocking,'latest_review_eligible_on',v_latest,
    'held',v_held,'purge_eligible',(coalesce(v_blocking,0)=0 and not v_held));
end $$;

create or replace function app_private.request_feature_flag_change_v1(
  p_flag_name text,p_requested_state boolean,p_reason text,p_idempotency_key text,p_payload_hash text)
returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_tenant uuid; v_existing jsonb; v_id uuid;
begin
  v_actor:=app_private.phase3a_require_human_v1(null,true); v_tenant:=app_private.active_tenant_id();
  if v_tenant is null then select tenant_id into v_tenant from identity.memberships where user_id=v_actor and status='active' order by starts_at limit 1; end if;
  v_existing:=app_private.phase3a_idempotency_get_v1(v_tenant,p_idempotency_key,p_payload_hash);
  if v_existing is not null then return (v_existing->>'request_id')::uuid; end if;
  perform 1 from app_private.feature_flags where flag_name=p_flag_name for update;
  if not found then raise exception using errcode='22023',message='unknown_feature_flag'; end if;
  if exists(select 1 from app_private.feature_flag_change_requests where flag_name=p_flag_name and status='pending' and expires_at>statement_timestamp()) then
    raise exception using errcode='55000',message='change_already_pending';
  end if;
  perform app_private.phase3a_idempotency_begin_v1(v_tenant,v_actor,p_idempotency_key,p_payload_hash);
  insert into app_private.feature_flag_change_requests(flag_name,requested_state,reason,requested_by,expires_at)
  values(p_flag_name,p_requested_state,p_reason,v_actor,statement_timestamp()+interval '24 hours') returning id into v_id;
  perform app_private.phase3a_audit_v1(v_tenant,'feature_flag_change_requested','feature_flag_request',v_id,'human',v_actor::text,jsonb_build_object('flag_name',p_flag_name));
  perform app_private.phase3a_idempotency_finish_v1(v_tenant,p_idempotency_key,jsonb_build_object('request_id',v_id)); return v_id;
end $$;

create or replace function app_private.approve_feature_flag_change_v1(
  p_request_id uuid,p_expected_lock_version integer,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_req app_private.feature_flag_change_requests%rowtype; v_count integer; v_tenant uuid;
begin
  v_actor:=app_private.phase3a_require_human_v1(null,true);
  select * into v_req from app_private.feature_flag_change_requests where id=p_request_id for update;
  if not found or v_req.status<>'pending' or v_req.expires_at<=statement_timestamp() then raise exception using errcode='55000',message='request_expired'; end if;
  if v_req.lock_version<>p_expected_lock_version then raise exception using errcode='55000',message='stale_lock_version'; end if;
  if v_req.requested_by=v_actor then raise exception using errcode='42501',message='self_approval_prohibited'; end if;
  if exists(select 1 from app_private.feature_flag_approvals where request_id=p_request_id and approver_id=v_actor) then raise exception using errcode='42501',message='duplicate_approval_prohibited'; end if;
  select tenant_id into v_tenant from identity.memberships where user_id=v_actor and status='active' order by starts_at limit 1;
  perform app_private.phase3a_idempotency_get_v1(v_tenant,p_idempotency_key,p_payload_hash);
  perform app_private.phase3a_idempotency_begin_v1(v_tenant,v_actor,p_idempotency_key,p_payload_hash);
  insert into app_private.feature_flag_approvals(request_id,approver_id) values(p_request_id,v_actor);
  select count(*) into v_count from app_private.feature_flag_approvals where request_id=p_request_id;
  update app_private.feature_flag_change_requests set lock_version=lock_version+1 where id=p_request_id;
  if v_count>=2 then
    update app_private.feature_flags set enabled=v_req.requested_state,lock_version=lock_version+1,updated_by=v_actor,updated_at=statement_timestamp() where flag_name=v_req.flag_name;
    update app_private.feature_flag_change_requests set status='approved',resolved_at=statement_timestamp() where id=p_request_id;
    insert into app_private.feature_flag_audit_log(flag_name,request_id,new_state,actor_id,detail) values(v_req.flag_name,p_request_id,v_req.requested_state,v_actor,jsonb_build_object('approval_count',v_count));
  end if;
  perform app_private.phase3a_idempotency_finish_v1(v_tenant,p_idempotency_key,jsonb_build_object('applied',v_count>=2)); return v_count>=2;
end $$;

create or replace function app_private.create_legal_hold_v1(
  p_tenant_id uuid,p_hold_reference text,p_reason text,p_idempotency_key text,p_payload_hash text)
returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_existing jsonb; v_id uuid;
begin
  v_actor:=app_private.phase3a_require_human_v1(p_tenant_id,false);
  if not app_private.is_feature_flag_enabled('legal_hold_enabled') then
    raise exception using errcode='55000',message='feature_flag_disabled';
  end if;
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash);
  if v_existing is not null then return (v_existing->>'hold_id')::uuid; end if;
  perform pg_advisory_xact_lock(app_private.derive_advisory_lock_key('TENANT',p_tenant_id));
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_actor,p_idempotency_key,p_payload_hash);
  insert into app_private.legal_holds(tenant_id,hold_reference,reason,created_by)
  values(p_tenant_id,p_hold_reference,p_reason,v_actor) returning id into v_id;
  insert into app_private.legal_hold_scope_epochs(tenant_id) values(p_tenant_id) on conflict do nothing;
  perform app_private.phase3a_audit_v1(p_tenant_id,'legal_hold_created','legal_hold',v_id,'human',v_actor::text,'{}');
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,jsonb_build_object('hold_id',v_id)); return v_id;
exception when unique_violation then raise exception using errcode='23505',message='duplicate_hold_reference';
end $$;

create or replace function app_private.add_legal_hold_target_v1(
  p_tenant_id uuid,p_hold_id uuid,p_target_type text,p_document_id uuid,p_property_id uuid,p_vendor_id uuid,
  p_document_class text,p_document_date_range daterange,p_expected_lock_version integer,p_idempotency_key text,p_payload_hash text)
returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_hold app_private.legal_holds%rowtype; v_id uuid; v_existing jsonb;
begin
  v_actor:=app_private.phase3a_require_human_v1(p_tenant_id,false);
  if not ((p_target_type='document' and p_document_id is not null and p_property_id is null and p_vendor_id is null and p_document_class is null and p_document_date_range is null)
    or (p_target_type='property' and p_property_id is not null and p_document_id is null and p_vendor_id is null and p_document_class is null and p_document_date_range is null)
    or (p_target_type='vendor' and p_vendor_id is not null and p_document_id is null and p_property_id is null and p_document_class is null and p_document_date_range is null)
    or (p_target_type='class_date_range' and p_document_class is not null and p_document_date_range is not null and p_document_id is null and p_property_id is null and p_vendor_id is null)) then
    raise exception using errcode='23514',message='invalid_target_shape';
  end if;
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash);
  if v_existing is not null then return (v_existing->>'target_id')::uuid; end if;
  perform pg_advisory_xact_lock(app_private.derive_advisory_lock_key('TENANT',p_tenant_id));
  select * into v_hold from app_private.legal_holds where tenant_id=p_tenant_id and id=p_hold_id for update;
  if not found then raise exception using errcode='42501',message='cross_tenant_target_forbidden'; end if;
  if v_hold.status<>'draft' then raise exception using errcode='55000',message='hold_must_be_draft'; end if;
  if v_hold.lock_version<>p_expected_lock_version then raise exception using errcode='55000',message='stale_lock_version'; end if;
  if (p_document_id is not null and not exists(select 1 from documents.documents where tenant_id=p_tenant_id and id=p_document_id))
    or (p_property_id is not null and not exists(select 1 from portfolio.properties where tenant_id=p_tenant_id and id=p_property_id))
    or (p_vendor_id is not null and not exists(select 1 from maintenance.vendors where tenant_id=p_tenant_id and id=p_vendor_id)) then
    raise exception using errcode='42501',message='cross_tenant_target_forbidden';
  end if;
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_actor,p_idempotency_key,p_payload_hash);
  insert into app_private.legal_hold_targets(tenant_id,hold_id,target_type,document_id,property_id,vendor_id,document_class,document_date_range)
  values(p_tenant_id,p_hold_id,p_target_type,p_document_id,p_property_id,p_vendor_id,p_document_class,p_document_date_range) returning id into v_id;
  update app_private.legal_holds set lock_version=lock_version+1 where id=p_hold_id;
  insert into app_private.legal_hold_scope_epochs(tenant_id,epoch) values(p_tenant_id,1)
    on conflict(tenant_id) do update set epoch=app_private.legal_hold_scope_epochs.epoch+1,updated_at=statement_timestamp();
  perform app_private.phase3a_audit_v1(p_tenant_id,'legal_hold_target_added','legal_hold',p_hold_id,'human',v_actor::text,jsonb_build_object('target_id',v_id,'target_type',p_target_type));
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,jsonb_build_object('target_id',v_id)); return v_id;
end $$;

create or replace function app_private.activate_legal_hold_v1(
  p_tenant_id uuid,p_hold_id uuid,p_expected_lock_version integer,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_hold app_private.legal_holds%rowtype; v_existing jsonb;
begin
  v_actor:=app_private.phase3a_require_human_v1(p_tenant_id,false);
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash);
  if v_existing is not null then return true; end if;
  perform pg_advisory_xact_lock(app_private.derive_advisory_lock_key('TENANT',p_tenant_id));
  select * into v_hold from app_private.legal_holds where tenant_id=p_tenant_id and id=p_hold_id for update;
  if not found then raise exception using errcode='42501',message='tenant_access_denied'; end if;
  if v_hold.status in ('released','cancelled') then raise exception using errcode='55000',message='hold_already_released'; end if;
  if v_hold.lock_version<>p_expected_lock_version then raise exception using errcode='55000',message='stale_lock_version'; end if;
  if exists (
    select 1 from app_private.disposal_purge_jobs j join documents.documents d on d.tenant_id=j.tenant_id and d.id=j.document_id
    where j.tenant_id=p_tenant_id and j.status in ('claim_granted','delete_requested','outcome_unknown','absence_verified','retry_wait','manual_review','abandoned','tombstoned') and exists(
      select 1 from app_private.legal_hold_targets t where t.hold_id=p_hold_id and (
        (t.target_type='document' and t.document_id=j.document_id) or
        (t.target_type='property' and t.property_id=d.property_id) or
        (t.target_type='vendor' and exists(
          select 1
          from documents.document_links l
          left join maintenance.vendor_quotes q
            on l.entity_type='maintenance.vendor_quote' and q.id=l.entity_id and q.tenant_id=l.tenant_id
          left join maintenance.purchase_orders o
            on l.entity_type='maintenance.purchase_order' and o.id=l.entity_id and o.tenant_id=l.tenant_id
          where l.tenant_id=p_tenant_id and l.document_id=j.document_id
            and coalesce(q.vendor_id,o.vendor_id)=t.vendor_id
        )) or
        (t.target_type='class_date_range' and exists(select 1 from app_private.document_retention_requirements rr join app_private.retention_policy_rules pr on pr.tenant_id=rr.tenant_id and pr.id=rr.policy_rule_id where rr.tenant_id=p_tenant_id and rr.document_id=j.document_id and pr.document_class=t.document_class and rr.classification_date is not null and t.document_date_range @> rr.classification_date))
      )
    )
  ) then raise exception using errcode='55000',message='disposition_execution_in_progress'; end if;
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_actor,p_idempotency_key,p_payload_hash);
  update app_private.legal_holds set status='active',activated_by=v_actor,activated_at=statement_timestamp(),lock_version=lock_version+1 where id=p_hold_id;
  insert into app_private.legal_hold_scope_epochs(tenant_id,epoch) values(p_tenant_id,1)
    on conflict(tenant_id) do update set epoch=app_private.legal_hold_scope_epochs.epoch+1,updated_at=statement_timestamp();
  perform app_private.phase3a_audit_v1(p_tenant_id,'legal_hold_activated','legal_hold',p_hold_id,'human',v_actor::text,'{}');
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,'{"activated":true}'); return true;
end $$;

create or replace function app_private.release_legal_hold_v1(
  p_tenant_id uuid,p_hold_id uuid,p_release_reason text,p_expected_lock_version integer,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_hold app_private.legal_holds%rowtype; v_existing jsonb;
begin
  if nullif(btrim(p_release_reason),'') is null then raise exception using errcode='22023',message='release_reason_required'; end if;
  v_actor:=app_private.phase3a_require_human_v1(p_tenant_id,false);
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return true; end if;
  perform pg_advisory_xact_lock(app_private.derive_advisory_lock_key('TENANT',p_tenant_id));
  select * into v_hold from app_private.legal_holds where tenant_id=p_tenant_id and id=p_hold_id for update;
  if not found then raise exception using errcode='42501',message='tenant_access_denied'; end if;
  if v_hold.status<>'active' then raise exception using errcode='55000',message='hold_not_active'; end if;
  if v_hold.lock_version<>p_expected_lock_version then raise exception using errcode='55000',message='stale_lock_version'; end if;
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_actor,p_idempotency_key,p_payload_hash);
  update app_private.legal_holds set status='released',released_by=v_actor,released_at=statement_timestamp(),release_reason=p_release_reason,lock_version=lock_version+1 where id=p_hold_id;
  update app_private.legal_hold_scope_epochs set epoch=epoch+1,updated_at=statement_timestamp() where tenant_id=p_tenant_id;
  perform app_private.phase3a_audit_v1(p_tenant_id,'legal_hold_released','legal_hold',p_hold_id,'human',v_actor::text,jsonb_build_object('reason',p_release_reason));
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,'{"released":true}'); return true;
end $$;

create or replace function app_private.create_disposal_protocol_v1(
  p_tenant_id uuid,p_protocol_number text,p_idempotency_key text,p_payload_hash text)
returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_id uuid; v_epoch bigint; v_existing jsonb;
begin
  v_actor:=app_private.phase3a_require_human_v1(p_tenant_id,false);
  if not app_private.is_feature_flag_enabled('retention_disposal_enabled') then raise exception using errcode='55000',message='feature_flag_disabled'; end if;
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return (v_existing->>'protocol_id')::uuid; end if;
  perform pg_advisory_xact_lock(app_private.derive_advisory_lock_key('TENANT',p_tenant_id));
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_actor,p_idempotency_key,p_payload_hash);
  select epoch into v_epoch from app_private.legal_hold_scope_epochs where tenant_id=p_tenant_id; v_epoch:=coalesce(v_epoch,0);
  insert into app_private.disposal_protocols(tenant_id,protocol_number,created_by,hold_scope_epoch) values(p_tenant_id,p_protocol_number,v_actor,v_epoch) returning id into v_id;
  perform app_private.phase3a_audit_v1(p_tenant_id,'disposal_protocol_created','disposal_protocol',v_id,'human',v_actor::text,'{}');
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,jsonb_build_object('protocol_id',v_id)); return v_id;
exception when unique_violation then raise exception using errcode='23505',message='duplicate_protocol_number';
end $$;

create or replace function app_private.add_document_to_disposal_protocol_v1(
  p_tenant_id uuid,p_protocol_id uuid,p_document_id uuid,p_expected_lock_version integer,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_protocol app_private.disposal_protocols%rowtype; v_eval jsonb; v_existing jsonb;
begin
  v_actor:=app_private.phase3a_require_human_v1(p_tenant_id,false);
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return true; end if;
  select * into v_protocol from app_private.disposal_protocols where tenant_id=p_tenant_id and id=p_protocol_id for update;
  if not found then raise exception using errcode='42501',message='tenant_access_denied'; end if;
  if v_protocol.status<>'draft' then raise exception using errcode='55000',message='protocol_must_be_draft'; end if;
  if v_protocol.lock_version<>p_expected_lock_version then raise exception using errcode='55000',message='stale_lock_version'; end if;
  if app_private.is_document_held(p_tenant_id,p_document_id) then raise exception using errcode='55000',message='document_under_legal_hold'; end if;
  if not exists(select 1 from app_private.document_retention_requirements where tenant_id=p_tenant_id and document_id=p_document_id)
    or exists(select 1 from app_private.document_retention_requirements where tenant_id=p_tenant_id and document_id=p_document_id and (requirement_state in ('event_pending','permanent_archival','expert_pending') or review_eligible_on>current_date)) then
    raise exception using errcode='55000',message='document_retention_not_expired';
  end if;
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_actor,p_idempotency_key,p_payload_hash);
  v_eval:=app_private.evaluate_document_retention_v1(p_tenant_id,p_document_id,0,p_idempotency_key,p_payload_hash);
  insert into app_private.disposal_protocol_documents(tenant_id,protocol_id,document_id,retention_snapshot,hold_epoch_snapshot)
  values(p_tenant_id,p_protocol_id,p_document_id,v_eval,v_protocol.hold_scope_epoch);
  update app_private.disposal_protocols set lock_version=lock_version+1 where id=p_protocol_id;
  perform app_private.phase3a_audit_v1(p_tenant_id,'disposal_document_added','disposal_protocol',p_protocol_id,'human',v_actor::text,jsonb_build_object('document_id',p_document_id));
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,'{"added":true}'); return true;
end $$;

create or replace function app_private.appoint_disposal_committee_member_v1(
  p_tenant_id uuid,p_protocol_id uuid,p_member_user_id uuid,p_committee_role text,p_member_name_snapshot text,
  p_expected_lock_version integer,p_idempotency_key text,p_payload_hash text)
returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_protocol app_private.disposal_protocols%rowtype; v_id uuid; v_existing jsonb;
begin
  if p_committee_role not in ('committee_chair','committee_secretary','technical_expert','member') then raise exception using errcode='22023',message='invalid_committee_role'; end if;
  v_actor:=app_private.phase3a_require_human_v1(p_tenant_id,false);
  if not exists(select 1 from identity.memberships where tenant_id=p_tenant_id and user_id=p_member_user_id and status='active') then raise exception using errcode='42501',message='member_not_active'; end if;
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return (v_existing->>'member_id')::uuid; end if;
  select * into v_protocol from app_private.disposal_protocols where tenant_id=p_tenant_id and id=p_protocol_id for update;
  if not found then raise exception using errcode='42501',message='tenant_access_denied'; end if;
  if v_protocol.status<>'draft' then raise exception using errcode='55000',message='protocol_must_be_draft'; end if;
  if v_protocol.lock_version<>p_expected_lock_version then raise exception using errcode='55000',message='stale_lock_version'; end if;
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_actor,p_idempotency_key,p_payload_hash);
  insert into app_private.disposal_committee_members(tenant_id,protocol_id,member_user_id,committee_role,member_name_snapshot)
  values(p_tenant_id,p_protocol_id,p_member_user_id,p_committee_role,p_member_name_snapshot) returning id into v_id;
  update app_private.disposal_protocols set lock_version=lock_version+1 where id=p_protocol_id;
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,jsonb_build_object('member_id',v_id)); return v_id;
exception when unique_violation then raise exception using errcode='23505',message='role_already_appointed';
end $$;

create or replace function app_private.submit_disposal_protocol_for_approval_v1(
  p_tenant_id uuid,p_protocol_id uuid,p_expected_lock_version integer,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_protocol app_private.disposal_protocols%rowtype; v_count integer; v_existing jsonb;
begin
  v_actor:=app_private.phase3a_require_human_v1(p_tenant_id,false);
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return true; end if;
  select * into v_protocol from app_private.disposal_protocols where tenant_id=p_tenant_id and id=p_protocol_id for update;
  if not found then raise exception using errcode='42501',message='tenant_access_denied'; end if;
  if v_protocol.lock_version<>p_expected_lock_version then raise exception using errcode='55000',message='stale_lock_version'; end if;
  if not exists(select 1 from app_private.disposal_protocol_documents where protocol_id=p_protocol_id) then raise exception using errcode='55000',message='protocol_document_set_empty'; end if;
  select count(*) into v_count from app_private.disposal_committee_members where protocol_id=p_protocol_id;
  if v_count<3 or mod(v_count,2)=0 then raise exception using errcode='55000',message='invalid_committee_size'; end if;
  if not exists(select 1 from app_private.disposal_committee_members where protocol_id=p_protocol_id and committee_role='committee_chair')
    or not exists(select 1 from app_private.disposal_committee_members where protocol_id=p_protocol_id and committee_role='committee_secretary') then raise exception using errcode='55000',message='incomplete_committee'; end if;
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_actor,p_idempotency_key,p_payload_hash);
  update app_private.disposal_protocols set status='pending_approval',submitted_at=statement_timestamp(),lock_version=lock_version+1 where id=p_protocol_id;
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,'{"submitted":true}'); return true;
end $$;

create or replace function app_private.cast_disposal_approval_vote_v1(
  p_tenant_id uuid,p_protocol_id uuid,p_decision text,p_comment text,p_expected_lock_version integer,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_protocol app_private.disposal_protocols%rowtype; v_member uuid; v_total integer; v_approved integer; v_existing jsonb;
begin
  if p_decision not in ('approved','rejected') then raise exception using errcode='22023',message='invalid_vote'; end if;
  v_actor:=app_private.phase3a_require_human_v1(p_tenant_id,false);
  select * into v_protocol from app_private.disposal_protocols where tenant_id=p_tenant_id and id=p_protocol_id for update;
  if v_protocol.status<>'pending_approval' then raise exception using errcode='55000',message='protocol_not_pending_approval'; end if;
  if v_protocol.lock_version<>p_expected_lock_version then raise exception using errcode='55000',message='stale_lock_version'; end if;
  select id into v_member from app_private.disposal_committee_members where protocol_id=p_protocol_id and member_user_id=v_actor;
  if not found then raise exception using errcode='42501',message='caller_not_committee_member'; end if;
  if exists(select 1 from app_private.disposal_approval_votes where protocol_id=p_protocol_id and committee_member_id=v_member) then raise exception using errcode='55000',message='duplicate_vote_prohibited'; end if;
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return true; end if;
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_actor,p_idempotency_key,p_payload_hash);
  insert into app_private.disposal_approval_votes(tenant_id,protocol_id,committee_member_id,decision,comment) values(p_tenant_id,p_protocol_id,v_member,p_decision,p_comment);
  select count(*) into v_total from app_private.disposal_committee_members where protocol_id=p_protocol_id;
  select count(*) into v_approved from app_private.disposal_approval_votes where protocol_id=p_protocol_id and decision='approved';
  if p_decision='rejected' then update app_private.disposal_protocols set status='cancelled',lock_version=lock_version+1 where id=p_protocol_id;
  elsif v_approved=v_total then update app_private.disposal_protocols set status='approved',approved_at=statement_timestamp(),lock_version=lock_version+1 where id=p_protocol_id;
  else update app_private.disposal_protocols set lock_version=lock_version+1 where id=p_protocol_id; end if;
  perform app_private.phase3a_audit_v1(p_tenant_id,'disposal_vote_cast','disposal_protocol',p_protocol_id,'human',v_actor::text,jsonb_build_object('decision',p_decision));
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,'{"voted":true}'); return true;
end $$;

create or replace function app_private.seal_disposal_manifest_v1(
  p_tenant_id uuid,p_protocol_id uuid,p_expected_lock_version integer,p_idempotency_key text,p_payload_hash text)
returns text language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_protocol app_private.disposal_protocols%rowtype; v_payload jsonb; v_canonical text; v_sha text; v_existing jsonb; v_epoch bigint;
begin
  v_actor:=app_private.phase3a_require_human_v1(p_tenant_id,false);
  perform pg_advisory_xact_lock(app_private.derive_advisory_lock_key('TENANT',p_tenant_id));
  select * into v_protocol from app_private.disposal_protocols where tenant_id=p_tenant_id and id=p_protocol_id for update;
  if v_protocol.status<>'approved' then raise exception using errcode='55000',message='protocol_not_approved'; end if;
  if v_protocol.lock_version<>p_expected_lock_version then raise exception using errcode='55000',message='stale_lock_version'; end if;
  if not exists(select 1 from app_private.disposal_committee_members where protocol_id=p_protocol_id and member_user_id=v_actor and committee_role='committee_chair') then raise exception using errcode='42501',message='caller_must_be_chair'; end if;
  if exists (
    select 1 from app_private.disposal_protocol_documents pd
    where pd.protocol_id=p_protocol_id and (
      app_private.is_document_held(p_tenant_id,pd.document_id)
      or exists (
        select 1 from app_private.document_retention_requirements rr
        where rr.tenant_id=p_tenant_id and rr.document_id=pd.document_id
          and (rr.requirement_state in ('event_pending','permanent_archival','expert_pending') or rr.review_eligible_on>current_date)
      )
    )
  ) then raise exception using errcode='55000',message='protocol_document_no_longer_eligible'; end if;
  select epoch into v_epoch from app_private.legal_hold_scope_epochs where tenant_id=p_tenant_id;
  v_epoch:=coalesce(v_epoch,0);
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return v_existing->>'sha256'; end if;
  select '['||string_agg(
    '{"document_class":'||to_json(pr.document_class)::text||
    ',"document_id":'||to_json(d.id::text)::text||
    ',"file_content_digest":'||to_json(v.sha256)::text||
    ',"retention_last_mandatory_day":'||to_json(rr.retention_last_mandatory_day::text)::text||'}',
    ',' order by d.id)||']'
  into v_canonical from app_private.disposal_protocol_documents pd join documents.documents d on d.id=pd.document_id
  join documents.document_versions v on v.document_id=d.id and v.version=d.current_version
  join lateral (select r.* from app_private.document_retention_requirements r where r.tenant_id=d.tenant_id and r.document_id=d.id order by r.review_eligible_on desc nulls first limit 1) rr on true
  join app_private.retention_policy_rules pr on pr.id=rr.policy_rule_id;
  if v_canonical is null then raise exception using errcode='55000',message='protocol_document_set_empty'; end if;
  v_payload:=v_canonical::jsonb;
  v_sha:=encode(extensions.digest(convert_to('CLADORA-DISPOSAL-MANIFEST-V1:'||v_canonical,'UTF8'),'sha256'),'hex');
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_actor,p_idempotency_key,p_payload_hash);
  insert into app_private.disposal_manifest_records(tenant_id,protocol_id,canonical_payload,canonical_utf8,sha256,sealed_by)
  values(p_tenant_id,p_protocol_id,v_payload,convert_to(v_canonical,'UTF8'),v_sha,v_actor);
  update app_private.disposal_protocols set status='sealed',manifest_sha256=v_sha,sealed_at=statement_timestamp(),
    hold_scope_epoch=v_epoch,lock_version=lock_version+1 where id=p_protocol_id;
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,jsonb_build_object('sha256',v_sha)); return v_sha;
end $$;

create or replace function app_private.schedule_approved_disposal_protocol_v1(
  p_tenant_id uuid,p_protocol_id uuid,p_expected_lock_version integer,p_idempotency_key text,p_payload_hash text)
returns integer language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_protocol app_private.disposal_protocols%rowtype; v_count integer; v_existing jsonb; v_epoch bigint;
begin
  v_actor:=app_private.phase3a_require_human_v1(p_tenant_id,false);
  perform pg_advisory_xact_lock(app_private.derive_advisory_lock_key('TENANT',p_tenant_id));
  select * into v_protocol from app_private.disposal_protocols where tenant_id=p_tenant_id and id=p_protocol_id for update;
  if v_protocol.status='scheduled' then raise exception using errcode='55000',message='protocol_already_scheduled'; end if;
  if v_protocol.status<>'sealed' then raise exception using errcode='55000',message='protocol_not_sealed'; end if;
  if v_protocol.lock_version<>p_expected_lock_version then raise exception using errcode='55000',message='stale_lock_version'; end if;
  select epoch into v_epoch from app_private.legal_hold_scope_epochs where tenant_id=p_tenant_id;
  if coalesce(v_epoch,0)<>v_protocol.hold_scope_epoch then raise exception using errcode='55000',message='hold_scope_epoch_changed'; end if;
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return (v_existing->>'job_count')::integer; end if;
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_actor,p_idempotency_key,p_payload_hash);
  insert into app_private.disposal_purge_jobs(tenant_id,protocol_id,document_id,document_version_id,bucket_id,object_path,expected_sha256,expected_size_bytes,hold_scope_epoch)
  select p_tenant_id,p_protocol_id,d.id,v.id,'document-vault',v.object_path,v.sha256,v.size_bytes,v_protocol.hold_scope_epoch
  from app_private.disposal_protocol_documents pd join documents.documents d on d.id=pd.document_id and d.tenant_id=pd.tenant_id
  join documents.document_versions v on v.document_id=d.id and v.version=d.current_version and v.tenant_id=d.tenant_id
  where pd.protocol_id=p_protocol_id;
  get diagnostics v_count=row_count;
  update app_private.disposal_protocols set status='scheduled',scheduled_at=statement_timestamp(),lock_version=lock_version+1 where id=p_protocol_id;
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,jsonb_build_object('job_count',v_count)); return v_count;
end $$;

create type app_private.purge_claim as (
  tenant_id uuid, assertion_id uuid, job_id uuid, claim_token uuid,
  bucket_id text, object_path text, expected_sha256 text, expected_size_bytes bigint, lease_expires_at timestamptz
);
create type app_private.expired_lease as (tenant_id uuid,assertion_id uuid,job_id uuid,claim_token uuid,lease_expires_at timestamptz);
create type app_private.kms_dispatch_claim as (dispatch_id uuid,request_id uuid,claim_token uuid,lease_expires_at timestamptz,purpose text);

create or replace function app_private.phase3a_worker_principal_v1(p_worker_kind text,p_principal_name text default null)
returns app_private.worker_principals language plpgsql stable security definer set search_path=pg_catalog as $$
declare v app_private.worker_principals%rowtype;
begin
  select * into v from app_private.worker_principals
  where worker_kind=p_worker_kind and status='active' and token_subject=coalesce(auth.jwt()->>'sub','')
    and (p_principal_name is null or principal_name=p_principal_name);
  if not found then raise exception using errcode='42501',message='unauthorized_worker'; end if;
  return v;
end $$;

create or replace function app_private.phase3a_validate_worker_assertion_v1(
  p_tenant_id uuid,p_assertion_id uuid,p_job_id uuid,p_claim_token uuid,p_worker_kind text)
returns app_private.worker_assertion_journal language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_principal app_private.worker_principals%rowtype; v_assertion app_private.worker_assertion_journal%rowtype;
begin
  v_principal:=app_private.phase3a_worker_principal_v1(p_worker_kind,null);
  select * into v_assertion from app_private.worker_assertion_journal
  where tenant_id=p_tenant_id and assertion_id=p_assertion_id and job_id=p_job_id and claim_token=p_claim_token
    and worker_principal_id=v_principal.id and consumed_at is null for update;
  if not found or v_assertion.expires_at<=statement_timestamp() then raise exception using errcode='55000',message='invalid_worker_assertion'; end if;
  if not exists(select 1 from app_private.disposal_purge_jobs where tenant_id=p_tenant_id and id=p_job_id and claim_token=p_claim_token and lease_expires_at>statement_timestamp()) then
    raise exception using errcode='55000',message='claim_token_expired';
  end if;
  return v_assertion;
end $$;

create or replace function app_private.claim_purge_execution_v1(
  p_tenant_id uuid,p_worker_name text,p_batch_size integer,p_idempotency_key text,p_payload_hash text)
returns setof app_private.purge_claim language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_principal app_private.worker_principals%rowtype; v_job app_private.disposal_purge_jobs%rowtype;
  v_assertion uuid; v_token uuid; v_lease timestamptz; v_batch integer;
begin
  if not app_private.is_feature_flag_enabled('storage_purge_worker_enabled') then raise exception using errcode='55000',message='feature_flag_disabled'; end if;
  v_principal:=app_private.phase3a_worker_principal_v1('storage',p_worker_name);
  if not p_tenant_id=any(v_principal.allowed_tenant_ids) then raise exception using errcode='42501',message='unauthorized_worker'; end if;
  v_batch:=least(greatest(coalesce(p_batch_size,1),1),v_principal.max_batch_size);
  perform pg_advisory_xact_lock_shared(app_private.derive_advisory_lock_key('TENANT',p_tenant_id));
  for v_job in select * from app_private.disposal_purge_jobs
    where tenant_id=p_tenant_id and status in ('purge_pending','retry_wait') and coalesce(next_attempt_at,'-infinity'::timestamptz)<=statement_timestamp()
    order by created_at,id for update skip locked limit v_batch
  loop
    if v_job.hold_scope_epoch<>coalesce((select epoch from app_private.legal_hold_scope_epochs where tenant_id=p_tenant_id),0) then
      update app_private.disposal_purge_jobs set status='manual_review',lock_version=lock_version+1,updated_at=statement_timestamp() where id=v_job.id;
      continue;
    end if;
    if app_private.is_document_held(p_tenant_id,v_job.document_id) then continue; end if;
    v_assertion:=gen_random_uuid(); v_token:=gen_random_uuid();
    v_lease:=statement_timestamp()+make_interval(secs=>v_principal.max_lease_seconds);
    update app_private.disposal_purge_jobs set status='claim_granted',claim_token=v_token,claimed_by=v_principal.principal_name,
      claimed_at=statement_timestamp(),lease_expires_at=v_lease,lock_version=lock_version+1,updated_at=statement_timestamp() where id=v_job.id;
    insert into app_private.worker_assertion_journal(worker_principal_id,tenant_id,assertion_id,job_id,allowed_operation,claim_token,nonce,expires_at)
      values(v_principal.id,p_tenant_id,v_assertion,v_job.id,'storage_purge',v_token,gen_random_uuid()::text,v_lease);
    perform app_private.phase3a_audit_v1(p_tenant_id,'purge_execution_claimed','purge_job',v_job.id,'storage_worker',v_principal.id::text,jsonb_build_object('assertion_id',v_assertion));
    return next (p_tenant_id,v_assertion,v_job.id,v_token,v_job.bucket_id,v_job.object_path,v_job.expected_sha256,v_job.expected_size_bytes,v_lease)::app_private.purge_claim;
  end loop;
end $$;

create or replace function app_private.ack_purge_delete_requested_v1(
  p_tenant_id uuid,p_assertion_id uuid,p_job_id uuid,p_claim_token uuid,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_assertion app_private.worker_assertion_journal%rowtype; v_job app_private.disposal_purge_jobs%rowtype; v_worker app_private.worker_principals%rowtype; v_existing jsonb;
begin
  v_assertion:=app_private.phase3a_validate_worker_assertion_v1(p_tenant_id,p_assertion_id,p_job_id,p_claim_token,'storage');
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return true; end if;
  select * into v_job from app_private.disposal_purge_jobs where tenant_id=p_tenant_id and id=p_job_id for update;
  select * into v_worker from app_private.worker_principals where id=v_assertion.worker_principal_id;
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_worker.id,p_idempotency_key,p_payload_hash);
  insert into app_private.storage_delete_outbox(tenant_id,job_id,assertion_id,gateway_operation_id,bucket_id,object_path,expected_sha256,attempt_number)
    values(p_tenant_id,p_job_id,p_assertion_id,gen_random_uuid(),v_job.bucket_id,v_job.object_path,v_job.expected_sha256,v_job.retry_count+1);
  update app_private.disposal_purge_jobs set status='delete_requested',lock_version=lock_version+1,updated_at=statement_timestamp() where id=p_job_id;
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,'{"acknowledged":true}'); return true;
end $$;

create or replace function app_private.record_storage_delete_outcome_unknown_v1(
  p_tenant_id uuid,p_assertion_id uuid,p_job_id uuid,p_claim_token uuid,p_error_code text,p_error_detail text,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_assertion app_private.worker_assertion_journal%rowtype; v_existing jsonb;
begin
  if nullif(btrim(p_error_code),'') is null then raise exception using errcode='22023',message='error_code_required'; end if;
  v_assertion:=app_private.phase3a_validate_worker_assertion_v1(p_tenant_id,p_assertion_id,p_job_id,p_claim_token,'storage');
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return true; end if;
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_assertion.worker_principal_id,p_idempotency_key,p_payload_hash);
  update app_private.storage_delete_outbox set status='outcome_unknown',last_error_code=p_error_code,last_error_detail=left(p_error_detail,1000)
  where job_id=p_job_id and assertion_id=p_assertion_id and status in ('pending','claimed');
  update app_private.disposal_purge_jobs set status='outcome_unknown',lock_version=lock_version+1,updated_at=statement_timestamp() where id=p_job_id;
  perform app_private.phase3a_audit_v1(p_tenant_id,'storage_delete_outcome_unknown','purge_job',p_job_id,'storage_worker',v_assertion.worker_principal_id::text,jsonb_build_object('error_code',p_error_code));
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,'{"recorded":true}'); return true;
end $$;

create or replace function app_private.record_storage_absence_verified_v1(
  p_tenant_id uuid,p_assertion_id uuid,p_job_id uuid,p_claim_token uuid,p_receipt jsonb,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_assertion app_private.worker_assertion_journal%rowtype; v_job app_private.disposal_purge_jobs%rowtype;
  v_outbox app_private.storage_delete_outbox%rowtype; v_existing jsonb; v_unknown text; v_secret text; v_expected_mac text; v_hash text;
begin
  v_assertion:=app_private.phase3a_validate_worker_assertion_v1(p_tenant_id,p_assertion_id,p_job_id,p_claim_token,'storage');
  select k into v_unknown from jsonb_object_keys(p_receipt) as x(k) where k not in (
    'schema_version','tenant_id','assertion_id','job_id','claim_token','gateway_operation_id','provider_request_id','bucket_id','object_path',
    'expected_sha256','pre_delete_etag','pre_delete_size_bytes','delete_result_code','probe_result_code','status_code_classification',
    'attempt_number','receipt_nonce','issued_at','observed_at','canonical_payload_hash','mac_key_version','signature_mac') limit 1;
  if v_unknown is not null then raise exception using errcode='55000',message='receipt_unknown_field'; end if;
  v_secret:=current_setting('app.storage_receipt_hmac_key',true);
  if nullif(v_secret,'') is null then raise exception using errcode='55000',message='receipt_verification_key_unavailable'; end if;
  if p_receipt->>'schema_version' is distinct from 'v1'
    or (p_receipt->>'tenant_id')::uuid is distinct from p_tenant_id
    or (p_receipt->>'assertion_id')::uuid is distinct from p_assertion_id
    or (p_receipt->>'job_id')::uuid is distinct from p_job_id
    or (p_receipt->>'claim_token')::uuid is distinct from p_claim_token then
    raise exception using errcode='55000',message='receipt_context_mismatch';
  end if;
  v_hash:=encode(extensions.digest(convert_to((p_receipt-array['canonical_payload_hash','signature_mac'])::text,'UTF8'),'sha256'),'hex');
  if p_receipt->>'canonical_payload_hash' is distinct from v_hash then
    raise exception using errcode='55000',message='receipt_payload_hash_mismatch';
  end if;
  v_expected_mac:=encode(extensions.hmac(v_hash,v_secret,'sha256'),'hex');
  if p_receipt->>'signature_mac' is distinct from v_expected_mac then raise exception using errcode='55000',message='invalid_receipt_mac'; end if;
  if coalesce((p_receipt->>'probe_result_code')::integer,0)<>404 then raise exception using errcode='55000',message='probe_code_must_be_404'; end if;
  select * into v_job from app_private.disposal_purge_jobs where tenant_id=p_tenant_id and id=p_job_id for update;
  select * into v_outbox from app_private.storage_delete_outbox where job_id=p_job_id and assertion_id=p_assertion_id for update;
  if not found or v_outbox.gateway_operation_id<>(p_receipt->>'gateway_operation_id')::uuid or v_outbox.bucket_id<>p_receipt->>'bucket_id'
    or v_outbox.object_path<>p_receipt->>'object_path' or v_outbox.expected_sha256<>p_receipt->>'expected_sha256' then
    raise exception using errcode='55000',message='invalid_worker_assertion';
  end if;
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return true; end if;
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_assertion.worker_principal_id,p_idempotency_key,p_payload_hash);
  insert into app_private.storage_deletion_evidence(tenant_id,job_id,assertion_id,gateway_operation_id,provider_request_id,bucket_id,object_path,
    expected_sha256,pre_delete_etag,pre_delete_size_bytes,delete_result_code,probe_result_code,status_code_classification,attempt_number,receipt_nonce,
    issued_at,observed_at,schema_version,canonical_payload_hash,mac_key_version,signature_mac)
  values(p_tenant_id,p_job_id,p_assertion_id,v_outbox.gateway_operation_id,p_receipt->>'provider_request_id',v_job.bucket_id,v_job.object_path,v_job.expected_sha256,
    p_receipt->>'pre_delete_etag',(p_receipt->>'pre_delete_size_bytes')::bigint,(p_receipt->>'delete_result_code')::integer,404,'VERIFIED_ABSENCE',
    (p_receipt->>'attempt_number')::integer,p_receipt->>'receipt_nonce',(p_receipt->>'issued_at')::timestamptz,(p_receipt->>'observed_at')::timestamptz,
    p_receipt->>'schema_version',v_hash,(p_receipt->>'mac_key_version')::integer,p_receipt->>'signature_mac');
  update app_private.storage_delete_outbox set status='absence_verified',completed_at=statement_timestamp() where id=v_outbox.id;
  update app_private.disposal_purge_jobs set status='absence_verified',lock_version=lock_version+1,updated_at=statement_timestamp() where id=p_job_id;
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,'{"verified":true}'); return true;
end $$;

create or replace function app_private.retry_purge_execution_v1(
  p_tenant_id uuid,p_assertion_id uuid,p_job_id uuid,p_claim_token uuid,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_assertion app_private.worker_assertion_journal%rowtype; v_job app_private.disposal_purge_jobs%rowtype;
begin
  v_assertion:=app_private.phase3a_validate_worker_assertion_v1(p_tenant_id,p_assertion_id,p_job_id,p_claim_token,'storage');
  select * into v_job from app_private.disposal_purge_jobs where tenant_id=p_tenant_id and id=p_job_id for update;
  if v_job.retry_count>=v_job.max_retries then raise exception using errcode='55000',message='retry_limit_exceeded'; end if;
  perform app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash);
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_assertion.worker_principal_id,p_idempotency_key,p_payload_hash);
  update app_private.disposal_purge_jobs set status='retry_wait',retry_count=retry_count+1,
    next_attempt_at=statement_timestamp()+make_interval(secs=>least(3600,30*power(2,retry_count)::integer)),claim_token=null,lease_expires_at=null,
    lock_version=lock_version+1,updated_at=statement_timestamp() where id=p_job_id;
  update app_private.worker_assertion_journal set consumed_at=statement_timestamp() where assertion_id=p_assertion_id;
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,'{"retry":true}'); return true;
end $$;

create or replace function app_private.abandon_purge_execution_v1(
  p_tenant_id uuid,p_assertion_id uuid,p_job_id uuid,p_claim_token uuid,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_assertion app_private.worker_assertion_journal%rowtype; v_job app_private.disposal_purge_jobs%rowtype;
begin
  v_assertion:=app_private.phase3a_validate_worker_assertion_v1(p_tenant_id,p_assertion_id,p_job_id,p_claim_token,'storage');
  select * into v_job from app_private.disposal_purge_jobs where tenant_id=p_tenant_id and id=p_job_id for update;
  if v_job.retry_count<v_job.max_retries then raise exception using errcode='55000',message='cannot_abandon_before_max_retries'; end if;
  perform app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash);
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_assertion.worker_principal_id,p_idempotency_key,p_payload_hash);
  update app_private.disposal_purge_jobs set status='abandoned',lock_version=lock_version+1,updated_at=statement_timestamp() where id=p_job_id;
  perform app_private.phase3a_audit_v1(p_tenant_id,'purge_job_abandoned','purge_job',p_job_id,'storage_worker',v_assertion.worker_principal_id::text,'{}');
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,'{"abandoned":true}'); return true;
end $$;

create or replace function app_private.list_expired_purge_leases_v1(p_tenant_id uuid,p_limit integer)
returns setof app_private.expired_lease language plpgsql stable security definer set search_path=pg_catalog as $$
declare v_principal app_private.worker_principals%rowtype;
begin
  v_principal:=app_private.phase3a_worker_principal_v1('storage',null);
  if not p_tenant_id=any(v_principal.allowed_tenant_ids) then raise exception using errcode='42501',message='unauthorized_worker'; end if;
  return query select j.tenant_id,a.assertion_id,j.id,j.claim_token,j.lease_expires_at
  from app_private.disposal_purge_jobs j join app_private.worker_assertion_journal a on a.job_id=j.id and a.claim_token=j.claim_token
  where j.tenant_id=p_tenant_id and j.status in ('claim_granted','delete_requested','outcome_unknown') and j.lease_expires_at<=statement_timestamp()
  order by j.lease_expires_at,j.id limit least(greatest(coalesce(p_limit,1),1),100);
end $$;

create or replace function app_private.reconcile_expired_purge_lease_v1(
  p_tenant_id uuid,p_assertion_id uuid,p_job_id uuid,p_claim_token uuid,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_principal app_private.worker_principals%rowtype; v_job app_private.disposal_purge_jobs%rowtype; v_assertion app_private.worker_assertion_journal%rowtype;
begin
  v_principal:=app_private.phase3a_worker_principal_v1('storage',null);
  select * into v_assertion from app_private.worker_assertion_journal where tenant_id=p_tenant_id and assertion_id=p_assertion_id and job_id=p_job_id and claim_token=p_claim_token and worker_principal_id=v_principal.id for update;
  if not found then raise exception using errcode='55000',message='invalid_worker_assertion'; end if;
  select * into v_job from app_private.disposal_purge_jobs where tenant_id=p_tenant_id and id=p_job_id for update;
  if v_job.lease_expires_at>statement_timestamp() then raise exception using errcode='55000',message='lease_not_expired'; end if;
  perform app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash);
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_principal.id,p_idempotency_key,p_payload_hash);
  update app_private.disposal_purge_jobs set status=case when retry_count>=max_retries then 'manual_review' else 'retry_wait' end,
    retry_count=retry_count+1,claim_token=null,lease_expires_at=null,next_attempt_at=statement_timestamp()+interval '1 minute',lock_version=lock_version+1,updated_at=statement_timestamp() where id=p_job_id;
  update app_private.worker_assertion_journal set consumed_at=statement_timestamp() where assertion_id=p_assertion_id;
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,'{"reconciled":true}'); return true;
end $$;

create or replace function documents.protect_document_version()
returns trigger language plpgsql security definer set search_path=pg_catalog as $$
declare v_job uuid; v_tenant uuid; v_document uuid;
begin
  if tg_op='INSERT' then
    if exists (
      select 1 from app_private.document_tombstones t
      where t.tenant_id=new.tenant_id and t.document_id=new.document_id
    ) or exists (
      select 1 from app_private.disposal_purge_jobs j
      where j.tenant_id=new.tenant_id and j.document_id=new.document_id
        and j.status not in ('purge_pending')
    ) then
      raise exception using errcode='55000',message='document_purged_or_in_flight';
    end if;
    return new;
  end if;
  if tg_op='DELETE' and current_user='cladora_rpc_owner'
    and current_setting('app.allow_document_version_purge',true)='on' then
    begin
      v_job:=current_setting('app.purge_job_id',true)::uuid;
      v_tenant:=current_setting('app.purge_tenant_id',true)::uuid;
      v_document:=current_setting('app.purge_document_id',true)::uuid;
    exception when others then
      raise exception using errcode='55000',message='document_versions_are_immutable';
    end;
    if old.tenant_id=v_tenant and old.document_id=v_document and exists(
      select 1 from app_private.disposal_purge_jobs j join app_private.storage_deletion_evidence e on e.tenant_id=j.tenant_id and e.job_id=j.id
      where j.id=v_job and j.tenant_id=v_tenant and j.document_id=v_document and j.document_version_id=old.id
        and j.status in ('absence_verified','tombstoned')
    ) then return old; end if;
  end if;
  raise exception using errcode='55000',message='document_versions_are_immutable';
end $$;

drop trigger if exists document_versions_immutable on documents.document_versions;
create trigger document_versions_immutable before insert or update or delete on documents.document_versions
for each row execute function documents.protect_document_version();

create or replace function app_private.finalize_purge_execution_v1(
  p_tenant_id uuid,p_assertion_id uuid,p_job_id uuid,p_claim_token uuid,p_idempotency_key text,p_payload_hash text)
returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_assertion app_private.worker_assertion_journal%rowtype; v_job app_private.disposal_purge_jobs%rowtype;
  v_evidence app_private.storage_deletion_evidence%rowtype; v_existing jsonb; v_tombstone uuid; v_secret text; v_key_version integer; v_hmac text; v_epoch bigint;
begin
  v_assertion:=app_private.phase3a_validate_worker_assertion_v1(p_tenant_id,p_assertion_id,p_job_id,p_claim_token,'storage');
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash);
  if v_existing is not null then return (v_existing->>'tombstone_id')::uuid; end if;
  perform pg_advisory_xact_lock_shared(app_private.derive_advisory_lock_key('TENANT',p_tenant_id));
  select * into v_job from app_private.disposal_purge_jobs where tenant_id=p_tenant_id and id=p_job_id for update;
  select * into v_evidence from app_private.storage_deletion_evidence where tenant_id=p_tenant_id and job_id=p_job_id;
  if not found or v_job.status<>'absence_verified' then raise exception using errcode='55000',message='absence_not_verified'; end if;
  select epoch into v_epoch from app_private.legal_hold_scope_epochs where tenant_id=p_tenant_id;
  if coalesce(v_epoch,0)<>v_job.hold_scope_epoch then raise exception using errcode='55000',message='hold_scope_epoch_changed'; end if;
  if app_private.is_document_held(p_tenant_id,v_job.document_id) then raise exception using errcode='55000',message='document_under_legal_hold'; end if;
  v_secret:=current_setting('app.tombstone_hmac_key',true); v_key_version:=coalesce(nullif(current_setting('app.tombstone_hmac_key_version',true),''),'1')::integer;
  if nullif(v_secret,'') is null then raise exception using errcode='55000',message='tombstone_key_unavailable'; end if;
  v_hmac:=encode(extensions.hmac(p_tenant_id::text||':'||v_job.document_id::text||':'||v_job.expected_sha256,v_secret,'sha256'),'hex');
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_assertion.worker_principal_id,p_idempotency_key,p_payload_hash);
  perform set_config('app.allow_document_version_purge','on',true);
  perform set_config('app.purge_job_id',p_job_id::text,true);
  perform set_config('app.purge_tenant_id',p_tenant_id::text,true);
  perform set_config('app.purge_document_id',v_job.document_id::text,true);
  update app_private.disposal_purge_jobs set status='tombstoned',lock_version=lock_version+1,updated_at=statement_timestamp() where id=p_job_id;
  delete from documents.document_versions where tenant_id=p_tenant_id and id=v_job.document_version_id;
  delete from documents.document_links where tenant_id=p_tenant_id and document_id=v_job.document_id;
  update documents.documents set folder_id=null,property_id=null,title='[disposed]',document_type='disposed',classification='internal',
    retention_policy_code=null,legal_hold=false,status='archived',created_by=null,updated_at=statement_timestamp()
    where tenant_id=p_tenant_id and id=v_job.document_id;
  insert into app_private.document_tombstones(tenant_id,document_id,protocol_id,purge_job_id,destruction_at,
    linkage_hmac_sha256,hmac_key_version,evidence_id)
  values(p_tenant_id,v_job.document_id,v_job.protocol_id,p_job_id,statement_timestamp(),
    v_hmac,v_key_version,v_evidence.id) returning id into v_tombstone;
  update app_private.worker_assertion_journal set consumed_at=statement_timestamp() where assertion_id=p_assertion_id;
  perform app_private.phase3a_audit_v1(p_tenant_id,'document_tombstoned','document',v_job.document_id,'storage_worker',v_assertion.worker_principal_id::text,jsonb_build_object('tombstone_id',v_tombstone,'evidence_id',v_evidence.id));
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,jsonb_build_object('tombstone_id',v_tombstone)); return v_tombstone;
end $$;

create or replace function app_private.verify_document_tombstone_v1(p_tenant_id uuid,p_document_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog as $$
declare v app_private.document_tombstones%rowtype; v_job app_private.disposal_purge_jobs%rowtype; v_secret text; v_expected text;
begin
  if not app_private.is_service_role() then raise exception using errcode='42501',message='tenant_access_denied'; end if;
  select * into v from app_private.document_tombstones where tenant_id=p_tenant_id and document_id=p_document_id;
  if not found then raise exception using errcode='P0002',message='tombstone_not_found'; end if;
  select * into v_job from app_private.disposal_purge_jobs where id=v.purge_job_id;
  v_secret:=current_setting('app.tombstone_hmac_key',true);
  if nullif(v_secret,'') is null then raise exception using errcode='55000',message='tombstone_key_unavailable'; end if;
  v_expected:=encode(extensions.hmac(p_tenant_id::text||':'||p_document_id::text||':'||v_job.expected_sha256,v_secret,'sha256'),'hex');
  return jsonb_build_object('tombstone_id',v.id,'is_valid',v.linkage_hmac_sha256=v_expected,'hmac_key_version',v.hmac_key_version,'destruction_at',v.destruction_at);
end $$;

create or replace function app_private.request_kms_key_v1(
  p_tenant_id uuid,p_purpose text,p_reason text,p_idempotency_key text,p_payload_hash text)
returns uuid language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_actor uuid; v_id uuid; v_existing jsonb;
begin
  v_actor:=app_private.phase3a_require_human_v1(p_tenant_id,false,'security.kms.manage');
  if not app_private.is_feature_flag_enabled('kms_lifecycle_enabled') then raise exception using errcode='55000',message='feature_flag_disabled'; end if;
  v_existing:=app_private.phase3a_idempotency_get_v1(p_tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return (v_existing->>'request_id')::uuid; end if;
  if exists(select 1 from app_private.kms_key_requests where tenant_id=p_tenant_id and purpose=p_purpose and status in ('pending_approval','approved','dispatch_pending','dispatched')) then raise exception using errcode='55000',message='kms_request_pending'; end if;
  perform app_private.phase3a_idempotency_begin_v1(p_tenant_id,v_actor,p_idempotency_key,p_payload_hash);
  insert into app_private.kms_key_requests(tenant_id,purpose,requested_by,expires_at) values(p_tenant_id,p_purpose,v_actor,statement_timestamp()+interval '7 days') returning id into v_id;
  insert into app_private.kms_audit_evidence(tenant_id,request_id,event_type,evidence_hash,detail)
    values(p_tenant_id,v_id,'requested',p_payload_hash,jsonb_build_object('reason',p_reason));
  perform app_private.phase3a_idempotency_finish_v1(p_tenant_id,p_idempotency_key,jsonb_build_object('request_id',v_id)); return v_id;
end $$;

create or replace function app_private.approve_kms_key_request_v1(
  p_request_id uuid,p_expected_lock_version integer,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_req app_private.kms_key_requests%rowtype; v_actor uuid; v_count integer; v_existing jsonb;
begin
  select * into v_req from app_private.kms_key_requests where id=p_request_id for update;
  if not found or v_req.expires_at<=statement_timestamp() then raise exception using errcode='55000',message='request_expired'; end if;
  v_actor:=app_private.phase3a_require_human_v1(v_req.tenant_id,false,'security.kms.manage');
  if v_req.lock_version<>p_expected_lock_version then raise exception using errcode='55000',message='stale_lock_version'; end if;
  if v_req.requested_by=v_actor then raise exception using errcode='42501',message='self_approval_prohibited'; end if;
  if exists(select 1 from app_private.kms_key_approvals where request_id=p_request_id and approver_id=v_actor) then raise exception using errcode='42501',message='duplicate_approval_prohibited'; end if;
  v_existing:=app_private.phase3a_idempotency_get_v1(v_req.tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return (v_existing->>'approved')::boolean; end if;
  perform app_private.phase3a_idempotency_begin_v1(v_req.tenant_id,v_actor,p_idempotency_key,p_payload_hash);
  insert into app_private.kms_key_approvals(request_id,approver_id) values(p_request_id,v_actor);
  select count(*) into v_count from app_private.kms_key_approvals where request_id=p_request_id;
  update app_private.kms_key_requests set lock_version=lock_version+1,status=case when v_count>=2 then 'dispatch_pending' else status end,updated_at=statement_timestamp() where id=p_request_id;
  if v_count>=2 then insert into app_private.kms_dispatch_outbox(request_id) values(p_request_id); end if;
  perform app_private.phase3a_idempotency_finish_v1(v_req.tenant_id,p_idempotency_key,jsonb_build_object('approved',v_count>=2)); return v_count>=2;
end $$;

create or replace function app_private.claim_kms_dispatch_v1(p_batch_size integer,p_idempotency_key text,p_payload_hash text)
returns setof app_private.kms_dispatch_claim language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_principal app_private.worker_principals%rowtype; v_row record; v_token uuid; v_lease timestamptz;
begin
  v_principal:=app_private.phase3a_worker_principal_v1('kms',null);
  for v_row in select o.id,o.request_id,r.purpose from app_private.kms_dispatch_outbox o join app_private.kms_key_requests r on r.id=o.request_id
    where o.status in ('pending','failed') order by o.created_at,o.id for update of o skip locked limit least(greatest(coalesce(p_batch_size,1),1),v_principal.max_batch_size)
  loop
    v_token:=gen_random_uuid(); v_lease:=statement_timestamp()+make_interval(secs=>v_principal.max_lease_seconds);
    update app_private.kms_dispatch_outbox set status='claimed',claim_token=v_token,claimed_by=v_principal.principal_name,lease_expires_at=v_lease,attempt_count=attempt_count+1,updated_at=statement_timestamp() where id=v_row.id;
    return next (v_row.id,v_row.request_id,v_token,v_lease,v_row.purpose)::app_private.kms_dispatch_claim;
  end loop;
end $$;

create or replace function app_private.record_kms_provider_callback_v1(
  p_request_id uuid,p_callback jsonb,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_principal app_private.worker_principals%rowtype; v_req app_private.kms_key_requests%rowtype; v_secret text; v_expected text; v_nonce text; v_provider_ref text; v_existing jsonb; v_version integer;
begin
  v_principal:=app_private.phase3a_worker_principal_v1('kms',null);
  select * into v_req from app_private.kms_key_requests where id=p_request_id for update;
  if not found then raise exception using errcode='P0002',message='kms_request_not_found'; end if;
  v_secret:=current_setting('app.kms_callback_hmac_key',true); v_expected:=encode(extensions.hmac(p_callback->>'payload_hash',v_secret,'sha256'),'hex');
  if nullif(v_secret,'') is null or p_callback->>'signature_mac' is distinct from v_expected then raise exception using errcode='55000',message='invalid_provider_signature'; end if;
  v_nonce:=p_callback->>'callback_nonce'; v_provider_ref:=p_callback->>'provider_key_reference';
  if exists(select 1 from app_private.kms_provider_callbacks where callback_nonce=v_nonce) then raise exception using errcode='55000',message='callback_replay'; end if;
  v_existing:=app_private.phase3a_idempotency_get_v1(v_req.tenant_id,p_idempotency_key,p_payload_hash); if v_existing is not null then return true; end if;
  perform app_private.phase3a_idempotency_begin_v1(v_req.tenant_id,v_principal.id,p_idempotency_key,p_payload_hash);
  insert into app_private.kms_provider_callbacks(request_id,callback_nonce,provider_event_id,payload_hash,signature_verified,provider_key_reference)
  values(p_request_id,v_nonce,p_callback->>'provider_event_id',p_callback->>'payload_hash',true,v_provider_ref);
  select coalesce(max(key_version),0)+1 into v_version from app_private.kms_key_journal where tenant_id=v_req.tenant_id;
  insert into app_private.kms_key_journal(tenant_id,request_id,key_version,provider_key_reference,state,activated_at)
  values(v_req.tenant_id,p_request_id,v_version,v_provider_ref,'active',statement_timestamp());
  update app_private.kms_key_requests set status='active',provider_key_reference=v_provider_ref,lock_version=lock_version+1,updated_at=statement_timestamp() where id=p_request_id;
  update app_private.kms_dispatch_outbox set status='completed',updated_at=statement_timestamp() where request_id=p_request_id;
  perform app_private.phase3a_idempotency_finish_v1(v_req.tenant_id,p_idempotency_key,'{"recorded":true}'); return true;
end $$;

create or replace function app_private.reconcile_kms_request_v1(
  p_request_id uuid,p_expected_lock_version integer,p_idempotency_key text,p_payload_hash text)
returns boolean language plpgsql volatile security definer set search_path=pg_catalog as $$
declare v_principal app_private.worker_principals%rowtype; v_req app_private.kms_key_requests%rowtype;
begin
  v_principal:=app_private.phase3a_worker_principal_v1('kms',null);
  select * into v_req from app_private.kms_key_requests where id=p_request_id for update;
  if not found then raise exception using errcode='P0002',message='kms_request_not_found'; end if;
  if v_req.status in ('active','failed','cancelled') then raise exception using errcode='55000',message='kms_request_terminal'; end if;
  if v_req.lock_version<>p_expected_lock_version then raise exception using errcode='55000',message='stale_lock_version'; end if;
  perform app_private.phase3a_idempotency_get_v1(v_req.tenant_id,p_idempotency_key,p_payload_hash);
  perform app_private.phase3a_idempotency_begin_v1(v_req.tenant_id,v_principal.id,p_idempotency_key,p_payload_hash);
  update app_private.kms_dispatch_outbox set status='pending',claim_token=null,claimed_by=null,lease_expires_at=null,updated_at=statement_timestamp()
    where request_id=p_request_id and status in ('claimed','failed');
  update app_private.kms_key_requests set status='dispatch_pending',lock_version=lock_version+1,updated_at=statement_timestamp() where id=p_request_id;
  perform app_private.phase3a_idempotency_finish_v1(v_req.tenant_id,p_idempotency_key,'{"reconciled":true}'); return true;
end $$;

-- Base-table RLS access is granted only to the dedicated RPC owner.
create policy phase3a_rpc_owner_idempotency on platform.idempotency_keys for all to cladora_rpc_owner using(true) with check(true);
create policy phase3a_rpc_owner_outbox on platform.outbox_events for all to cladora_rpc_owner using(true) with check(true);
create policy phase3a_rpc_owner_documents on documents.documents for all to cladora_rpc_owner using(true) with check(true);
create policy phase3a_rpc_owner_document_versions on documents.document_versions for all to cladora_rpc_owner using(true) with check(true);
create policy phase3a_rpc_owner_document_links on documents.document_links for select to cladora_rpc_owner using(true);
create policy phase3a_rpc_owner_document_links_delete on documents.document_links for delete to cladora_rpc_owner using(true);
create policy phase3a_rpc_owner_retention_policies on documents.retention_policies for select to cladora_rpc_owner using(true);
create policy phase3a_rpc_owner_properties on portfolio.properties for select to cladora_rpc_owner using(true);
create policy phase3a_rpc_owner_vendors on maintenance.vendors for select to cladora_rpc_owner using(true);
create policy phase3a_rpc_owner_vendor_quotes on maintenance.vendor_quotes for select to cladora_rpc_owner using(true);
create policy phase3a_rpc_owner_purchase_orders on maintenance.purchase_orders for select to cladora_rpc_owner using(true);
create policy phase3a_rpc_owner_memberships on identity.memberships for select to cladora_rpc_owner using(true);
create policy phase3a_rpc_owner_roles on identity.roles for select to cladora_rpc_owner using(true);
create policy phase3a_rpc_owner_role_permissions on identity.role_permissions for select to cladora_rpc_owner using(true);
create policy phase3a_rpc_owner_permissions on identity.permissions for select to cladora_rpc_owner using(true);

grant execute on function app_private.jwt_uuid(text),app_private.active_tenant_id(),app_private.is_active_member(uuid),app_private.is_service_role(),
  app_private.has_platform_role(platform.platform_role_type) to cladora_rpc_owner;

-- Ownership includes private helpers; callable API grants remain exact and narrow below.
-- PostgreSQL requires the destination owner to have CREATE on each containing
-- schema during ALTER FUNCTION OWNER. The grant is scoped to this ownership
-- transfer and revoked immediately afterwards.
grant create on schema app_private, documents to cladora_rpc_owner;

do $$
declare r record;
begin
  for r in
    select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) args
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='app_private' and (p.proname like 'phase3a_%' or p.proname in (
      'calc_accounting_retention_start_on','calc_last_mandatory_day','calc_review_eligible_on','derive_advisory_lock_key',
      'is_feature_flag_enabled','evaluate_document_retention_v1','request_feature_flag_change_v1','approve_feature_flag_change_v1',
      'create_legal_hold_v1','add_legal_hold_target_v1','activate_legal_hold_v1','release_legal_hold_v1','is_document_held',
      'create_disposal_protocol_v1','add_document_to_disposal_protocol_v1','appoint_disposal_committee_member_v1',
      'submit_disposal_protocol_for_approval_v1','cast_disposal_approval_vote_v1','seal_disposal_manifest_v1',
      'schedule_approved_disposal_protocol_v1','claim_purge_execution_v1','ack_purge_delete_requested_v1',
      'record_storage_delete_outcome_unknown_v1','record_storage_absence_verified_v1','retry_purge_execution_v1',
      'abandon_purge_execution_v1','list_expired_purge_leases_v1','reconcile_expired_purge_lease_v1',
      'finalize_purge_execution_v1','verify_document_tombstone_v1','request_kms_key_v1','approve_kms_key_request_v1',
      'claim_kms_dispatch_v1','record_kms_provider_callback_v1','reconcile_kms_request_v1'
    ))) or (n.nspname='documents' and p.proname='protect_document_version')
  loop execute format('alter function %I.%I(%s) owner to cladora_rpc_owner',r.nspname,r.proname,r.args); end loop;
end $$;

revoke create on schema app_private, documents from cladora_rpc_owner;

revoke all on function app_private.calc_accounting_retention_start_on(date) from public,anon,authenticated,service_role;
revoke all on function app_private.calc_last_mandatory_day(date,integer) from public,anon,authenticated,service_role;
revoke all on function app_private.calc_review_eligible_on(date,integer) from public,anon,authenticated,service_role;
revoke all on function app_private.derive_advisory_lock_key(text,uuid) from public,anon,authenticated,service_role;
revoke all on function app_private.is_feature_flag_enabled(text) from public,anon,authenticated,service_role;
revoke all on function app_private.evaluate_document_retention_v1(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.request_feature_flag_change_v1(text,boolean,text,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.approve_feature_flag_change_v1(uuid,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.create_legal_hold_v1(uuid,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.add_legal_hold_target_v1(uuid,uuid,text,uuid,uuid,uuid,text,daterange,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.activate_legal_hold_v1(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.release_legal_hold_v1(uuid,uuid,text,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.is_document_held(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function app_private.create_disposal_protocol_v1(uuid,text,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.add_document_to_disposal_protocol_v1(uuid,uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.appoint_disposal_committee_member_v1(uuid,uuid,uuid,text,text,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.submit_disposal_protocol_for_approval_v1(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.cast_disposal_approval_vote_v1(uuid,uuid,text,text,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.seal_disposal_manifest_v1(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.schedule_approved_disposal_protocol_v1(uuid,uuid,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.claim_purge_execution_v1(uuid,text,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.ack_purge_delete_requested_v1(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.record_storage_delete_outcome_unknown_v1(uuid,uuid,uuid,uuid,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.record_storage_absence_verified_v1(uuid,uuid,uuid,uuid,jsonb,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.retry_purge_execution_v1(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.abandon_purge_execution_v1(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.list_expired_purge_leases_v1(uuid,integer) from public,anon,authenticated,service_role;
revoke all on function app_private.reconcile_expired_purge_lease_v1(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.finalize_purge_execution_v1(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.verify_document_tombstone_v1(uuid,uuid) from public,anon,authenticated,service_role;
revoke all on function app_private.request_kms_key_v1(uuid,text,text,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.approve_kms_key_request_v1(uuid,integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.claim_kms_dispatch_v1(integer,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.record_kms_provider_callback_v1(uuid,jsonb,text,text) from public,anon,authenticated,service_role;
revoke all on function app_private.reconcile_kms_request_v1(uuid,integer,text,text) from public,anon,authenticated,service_role;

grant execute on function app_private.calc_accounting_retention_start_on(date),app_private.calc_last_mandatory_day(date,integer),
  app_private.calc_review_eligible_on(date,integer),app_private.derive_advisory_lock_key(text,uuid),
  app_private.is_feature_flag_enabled(text),app_private.evaluate_document_retention_v1(uuid,uuid,integer,text,text),
  app_private.is_document_held(uuid,uuid) to authenticated,service_role;

grant execute on function app_private.request_feature_flag_change_v1(text,boolean,text,text,text),
  app_private.approve_feature_flag_change_v1(uuid,integer,text,text),app_private.create_legal_hold_v1(uuid,text,text,text,text),
  app_private.add_legal_hold_target_v1(uuid,uuid,text,uuid,uuid,uuid,text,daterange,integer,text,text),
  app_private.activate_legal_hold_v1(uuid,uuid,integer,text,text),app_private.release_legal_hold_v1(uuid,uuid,text,integer,text,text),
  app_private.create_disposal_protocol_v1(uuid,text,text,text),app_private.add_document_to_disposal_protocol_v1(uuid,uuid,uuid,integer,text,text),
  app_private.appoint_disposal_committee_member_v1(uuid,uuid,uuid,text,text,integer,text,text),
  app_private.submit_disposal_protocol_for_approval_v1(uuid,uuid,integer,text,text),
  app_private.cast_disposal_approval_vote_v1(uuid,uuid,text,text,integer,text,text),
  app_private.seal_disposal_manifest_v1(uuid,uuid,integer,text,text),
  app_private.schedule_approved_disposal_protocol_v1(uuid,uuid,integer,text,text),
  app_private.request_kms_key_v1(uuid,text,text,text,text),app_private.approve_kms_key_request_v1(uuid,integer,text,text)
  to authenticated;

grant execute on function app_private.claim_purge_execution_v1(uuid,text,integer,text,text),
  app_private.ack_purge_delete_requested_v1(uuid,uuid,uuid,uuid,text,text),
  app_private.record_storage_delete_outcome_unknown_v1(uuid,uuid,uuid,uuid,text,text,text,text),
  app_private.record_storage_absence_verified_v1(uuid,uuid,uuid,uuid,jsonb,text,text),
  app_private.retry_purge_execution_v1(uuid,uuid,uuid,uuid,text,text),
  app_private.abandon_purge_execution_v1(uuid,uuid,uuid,uuid,text,text),
  app_private.list_expired_purge_leases_v1(uuid,integer),
  app_private.reconcile_expired_purge_lease_v1(uuid,uuid,uuid,uuid,text,text),
  app_private.finalize_purge_execution_v1(uuid,uuid,uuid,uuid,text,text)
  to cladora_storage_worker;

grant execute on function app_private.claim_kms_dispatch_v1(integer,text,text),
  app_private.record_kms_provider_callback_v1(uuid,jsonb,text,text),app_private.reconcile_kms_request_v1(uuid,integer,text,text)
  to cladora_kms_worker;
grant execute on function app_private.verify_document_tombstone_v1(uuid,uuid) to service_role;

revoke all on function documents.protect_document_version() from public,anon,authenticated,service_role,cladora_storage_worker,cladora_kms_worker;
revoke execute on all functions in schema app_private from public,anon;
revoke create on schema app_private from public,anon,authenticated,service_role,cladora_rpc_owner,cladora_storage_worker,cladora_kms_worker;

commit;
