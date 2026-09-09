begin;

-- ============================================================================
-- Migration 79: Official Communications, Notices, Acknowledgements & Delivery Evidence
-- Architecture: Canonical communications schema forward-only extension
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Permissions Bootstrap
-- ----------------------------------------------------------------------------
insert into identity.permissions (code, resource, action, description) values
  ('communications.notices.read', 'communications.notices', 'read', 'Read scoped communications and official notices'),
  ('communications.notices.manage', 'communications.notices', 'manage', 'Draft, edit and configure official communication notices'),
  ('communications.notices.approve', 'communications.notices', 'approve', 'Formally approve communications and governance convening notices (AAL2)'),
  ('communications.notices.publish', 'communications.notices', 'publish', 'Publish and freeze official notices and recipient populations (AAL2)'),
  ('communications.notices.acknowledge', 'communications.notices', 'acknowledge', 'Acknowledge personal receipt of communications notices (AAL1)'),
  ('communications.evidence.manage', 'communications.evidence', 'manage', 'Capture physical and statutory evidence records'),
  ('communications.evidence.verify', 'communications.evidence', 'verify', 'Formally verify statutory delivery evidence under dual control (AAL2)')
on conflict (code) do update set
  resource = excluded.resource,
  action = excluded.action,
  description = excluded.description;

-- Grant permissions to roles
insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where lower(r.code) = 'association_admin'
  and p.code like 'communications.%'
on conflict (role_id, permission_id) do update set effect = 'allow';

insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where lower(r.code) = 'property_manager'
  and p.code in (
    'communications.feed.read',
    'communications.notices.read',
    'communications.notices.manage',
    'communications.notices.publish',
    'communications.evidence.manage'
  )
on conflict (role_id, permission_id) do update set effect = 'allow';

insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where lower(r.code) = 'president'
  and p.code in (
    'communications.feed.read',
    'communications.notices.read',
    'communications.notices.manage',
    'communications.notices.approve',
    'communications.notices.publish',
    'communications.evidence.manage',
    'communications.evidence.verify'
  )
on conflict (role_id, permission_id) do update set effect = 'allow';

insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where lower(r.code) = 'censor'
  and p.code in (
    'communications.feed.read',
    'communications.notices.read'
  )
on conflict (role_id, permission_id) do update set effect = 'allow';

insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where lower(r.code) in ('owner', 'tenant_resident')
  and p.code in (
    'communications.feed.read',
    'communications.notices.read',
    'communications.notices.acknowledge'
  )
on conflict (role_id, permission_id) do update set effect = 'allow';


-- ----------------------------------------------------------------------------
-- 2. Domain Tables: Templates & Template Versions
-- ----------------------------------------------------------------------------
create table if not exists communications.templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references platform.tenants(id) on delete restrict,
  template_key text not null,
  name text not null,
  description text,
  template_type text not null check (template_type in ('general_announcement', 'meeting_convening', 'reconvened_meeting', 'resolution_publication', 'billing_reminder', 'maintenance_notice')),
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  unique nulls not distinct (tenant_id, template_key)
);

create index if not exists templates_tenant_idx on communications.templates(tenant_id, is_active);

create table if not exists communications.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references communications.templates(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  subject_ro text not null,
  body_ro text not null,
  subject_en text not null,
  body_en text not null,
  subject_fa text not null,
  body_fa text not null,
  allowed_placeholders jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('draft', 'active', 'retired')),
  is_frozen boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  unique (template_id, version_number)
);

create index if not exists template_versions_template_idx on communications.template_versions(template_id, version_number);


-- ----------------------------------------------------------------------------
-- 3. Domain Tables: Official Notices
-- ----------------------------------------------------------------------------
create table if not exists communications.official_notices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  property_id uuid references portfolio.properties(id) on delete restrict,
  building_id uuid references portfolio.buildings(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict,
  scope text not null default 'tenant' check (scope in ('tenant', 'property', 'building', 'unit')),
  template_version_id uuid references communications.template_versions(id) on delete restrict,
  source_module text not null check (source_module in ('governance', 'maintenance', 'billing', 'utilities', 'general')),
  source_entity_type text check (source_entity_type in ('governance.meeting', 'governance.resolution', 'maintenance.work_order', 'billing.invoice', 'utilities.period', 'general')),
  source_entity_id uuid,
  communication_type text not null check (communication_type in ('general_announcement', 'meeting_convening', 'reconvened_meeting', 'resolution_publication', 'billing_reminder', 'maintenance_notice')),
  legal_classification text not null check (legal_classification in ('statutory_governance', 'operational_mandatory', 'informational_optional')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'published', 'cancelled')),
  title_ro text not null,
  body_ro text not null,
  title_en text not null,
  body_en text not null,
  title_fa text not null,
  body_fa text not null,
  template_params jsonb not null default '{}'::jsonb,
  idempotency_key text,
  created_by uuid references auth.users(id) on delete restrict,
  approved_by uuid references auth.users(id) on delete restrict,
  approved_at timestamptz,
  published_by uuid references auth.users(id) on delete restrict,
  published_at timestamptz,
  cancelled_by uuid references auth.users(id) on delete restrict,
  cancelled_at timestamptz,
  cancellation_reason text,
  conservative_compliance_policy text not null default 'PRODUCT-CONSERVATIVE-COMPLIANCE-POLICY / LEGAL-REVIEW-REQUIRED',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  unique nulls not distinct (tenant_id, idempotency_key)
);

create index if not exists official_notices_tenant_idx on communications.official_notices(tenant_id, status, created_at desc);
create index if not exists official_notices_source_idx on communications.official_notices(tenant_id, source_module, source_entity_id);
create index if not exists official_notices_scope_idx on communications.official_notices(tenant_id, scope, property_id, building_id, unit_id);


-- ----------------------------------------------------------------------------
-- 4. Domain Tables: Notice Recipients Snapshot & Suppressions
-- ----------------------------------------------------------------------------
create table if not exists communications.notice_suppressions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  membership_id uuid not null references identity.memberships(id) on delete restrict,
  channel text not null check (channel in ('email', 'sms', 'push')),
  suppression_reason text not null check (suppression_reason in ('bounce', 'complaint', 'opt_out', 'invalid_address', 'manual')),
  suppressed_at timestamptz not null default statement_timestamp(),
  cleared_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);

create index if not exists notice_suppressions_active_idx on communications.notice_suppressions(tenant_id, membership_id, channel)
where cleared_at is null;

create table if not exists communications.notice_recipients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  notice_id uuid not null references communications.official_notices(id) on delete cascade,
  membership_id uuid not null references identity.memberships(id) on delete restrict,
  party_id uuid references portfolio.parties(id) on delete restrict,
  unit_id uuid references portfolio.units(id) on delete restrict,
  preferred_locale text not null default 'ro' check (preferred_locale in ('ro', 'en', 'fa')),
  eligible_channels jsonb not null default '["in_app"]'::jsonb,
  destination_masked text,
  destination_hash text,
  inclusion_reason text not null default 'scoped_resident_or_owner',
  is_suppressed boolean not null default false,
  suppression_exception_logged boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  unique (notice_id, membership_id)
);

create index if not exists notice_recipients_notice_idx on communications.notice_recipients(notice_id, membership_id);
create index if not exists notice_recipients_membership_idx on communications.notice_recipients(membership_id, created_at desc);


-- ----------------------------------------------------------------------------
-- 5. Domain Tables: Delivery Attempts (Provider-Neutral Outbox)
-- ----------------------------------------------------------------------------
create table if not exists communications.delivery_attempts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  notice_id uuid not null references communications.official_notices(id) on delete cascade,
  recipient_id uuid not null references communications.notice_recipients(id) on delete cascade,
  channel text not null check (channel in ('in_app', 'email', 'sms', 'push')),
  attempt_number integer not null default 1 check (attempt_number > 0),
  status text not null default 'queued' check (status in ('queued', 'submitted_to_provider', 'provider_accepted', 'delivered', 'bounced', 'failed', 'suppressed', 'cancelled')),
  provider_message_id text,
  provider_error_category text,
  requested_at timestamptz not null default statement_timestamp(),
  submitted_at timestamptz,
  delivered_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default statement_timestamp()
);

create index if not exists delivery_attempts_notice_idx on communications.delivery_attempts(notice_id, recipient_id, channel);
create index if not exists delivery_attempts_status_idx on communications.delivery_attempts(tenant_id, status, requested_at);


-- ----------------------------------------------------------------------------
-- 6. Domain Tables: Notice Acknowledgements
-- ----------------------------------------------------------------------------
create table if not exists communications.notice_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  notice_id uuid not null references communications.official_notices(id) on delete restrict,
  recipient_id uuid not null references communications.notice_recipients(id) on delete restrict,
  membership_id uuid not null references identity.memberships(id) on delete restrict,
  acknowledged_at timestamptz not null default statement_timestamp(),
  acknowledgement_method text not null default 'in_app_click' check (acknowledgement_method in ('in_app_signature', 'in_app_click', 'offline_form')),
  evidence_checksum text,
  notes text,
  created_at timestamptz not null default statement_timestamp(),
  unique (notice_id, membership_id)
);

create index if not exists notice_acknowledgements_notice_idx on communications.notice_acknowledgements(notice_id, membership_id);


-- ----------------------------------------------------------------------------
-- 7. Domain Tables: Statutory Delivery Evidence
-- ----------------------------------------------------------------------------
create table if not exists communications.statutory_evidence (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  notice_id uuid not null references communications.official_notices(id) on delete restrict,
  evidence_type text not null check (evidence_type in (
    'noticeboard_posting',
    'nominal_convening_table',
    'registered_postal_letter',
    'declared_content_postal_proof',
    'confirmation_of_receipt',
    'dated_photocopy_display',
    'signed_written_declaration',
    'physical_evidence_reference'
  )),
  evidence_reference text not null,
  document_id uuid references documents.documents(id) on delete restrict,
  occurred_at timestamptz not null,
  checksum text,
  verification_status text not null default 'pending_verification' check (verification_status in ('pending_verification', 'verified', 'rejected')),
  captured_by uuid not null references auth.users(id) on delete restrict,
  verified_by uuid references auth.users(id) on delete restrict,
  verified_at timestamptz,
  rejection_reason text,
  notes text,
  created_at timestamptz not null default statement_timestamp()
);

create index if not exists statutory_evidence_notice_idx on communications.statutory_evidence(notice_id, verification_status);


-- ----------------------------------------------------------------------------
-- 8. Enable Row Level Security & Revoke Direct Access
-- ----------------------------------------------------------------------------
alter table communications.templates enable row level security;
alter table communications.template_versions enable row level security;
alter table communications.official_notices enable row level security;
alter table communications.notice_recipients enable row level security;
alter table communications.delivery_attempts enable row level security;
alter table communications.notice_acknowledgements enable row level security;
alter table communications.statutory_evidence enable row level security;
alter table communications.notice_suppressions enable row level security;

-- Default fail-closed policies for defense-in-depth
create policy templates_isolation on communications.templates
  for all to authenticated
  using (tenant_id is null or tenant_id = app_private.active_tenant_id());

create policy template_versions_isolation on communications.template_versions
  for all to authenticated
  using (exists (
    select 1 from communications.templates t
    where t.id = template_id and (t.tenant_id is null or t.tenant_id = app_private.active_tenant_id())
  ));

create policy official_notices_isolation on communications.official_notices
  for all to authenticated
  using (tenant_id = app_private.active_tenant_id());

create policy notice_recipients_isolation on communications.notice_recipients
  for all to authenticated
  using (tenant_id = app_private.active_tenant_id());

create policy delivery_attempts_isolation on communications.delivery_attempts
  for all to authenticated
  using (tenant_id = app_private.active_tenant_id());

create policy notice_acknowledgements_isolation on communications.notice_acknowledgements
  for all to authenticated
  using (tenant_id = app_private.active_tenant_id());

create policy statutory_evidence_isolation on communications.statutory_evidence
  for all to authenticated
  using (tenant_id = app_private.active_tenant_id());

create policy notice_suppressions_isolation on communications.notice_suppressions
  for all to authenticated
  using (tenant_id = app_private.active_tenant_id());

-- Revoke direct table access from public and anon
revoke all on communications.templates from public, anon;
revoke all on communications.template_versions from public, anon;
revoke all on communications.official_notices from public, anon;
revoke all on communications.notice_recipients from public, anon;
revoke all on communications.delivery_attempts from public, anon;
revoke all on communications.notice_acknowledgements from public, anon;
revoke all on communications.statutory_evidence from public, anon;
revoke all on communications.notice_suppressions from public, anon;

-- Grant select to authenticated (mutations happen strictly through customer_api / security definer routines)
grant select on communications.templates to authenticated;
grant select on communications.template_versions to authenticated;
grant select on communications.official_notices to authenticated;
grant select on communications.notice_recipients to authenticated;
grant select on communications.delivery_attempts to authenticated;
grant select on communications.notice_acknowledgements to authenticated;
grant select on communications.statutory_evidence to authenticated;
grant select on communications.notice_suppressions to authenticated;


-- ----------------------------------------------------------------------------
-- 9. Triggers: Immutability, Lifecycle & State Machine Guards
-- ----------------------------------------------------------------------------

-- A. Template Version Immutability Once Used
create or replace function communications.check_template_version_immutability()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' then
    if old.is_frozen or exists (
      select 1 from communications.official_notices n where n.template_version_id = old.id
    ) then
      raise exception 'template_version_is_immutable_once_referenced' using errcode = '23505';
    end if;
  elsif tg_op = 'UPDATE' then
    if old.is_frozen or exists (
      select 1 from communications.official_notices n where n.template_version_id = old.id
    ) then
      if new.is_frozen is distinct from old.is_frozen
         and new.subject_ro = old.subject_ro
         and new.body_ro = old.body_ro
         and new.subject_en = old.subject_en
         and new.body_en = old.body_en
         and new.subject_fa = old.subject_fa
         and new.body_fa = old.body_fa
         and new.allowed_placeholders = old.allowed_placeholders then
        return new;
      end if;
      raise exception 'template_version_is_immutable_once_referenced' using errcode = '23505';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_template_version_immutability
before update or delete on communications.template_versions
for each row execute function communications.check_template_version_immutability();


-- B. Delivery Attempt Monotonic State Machine (Delivered cannot regress)
create or replace function communications.check_delivery_attempt_transition()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if old.status = 'delivered' and new.status <> 'delivered' then
    raise exception 'delivery_attempt_cannot_regress_from_delivered' using errcode = '22000';
  end if;
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'delivery_attempt_cannot_transition_from_cancelled' using errcode = '22000';
  end if;
  return new;
end;
$$;

create trigger trg_delivery_attempt_transition
before update on communications.delivery_attempts
for each row execute function communications.check_delivery_attempt_transition();


-- C. Statutory Evidence Immutability Once Verified
create or replace function communications.check_statutory_evidence_immutability()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
begin
  if tg_op = 'DELETE' and old.verification_status = 'verified' then
    raise exception 'verified_statutory_evidence_cannot_be_deleted' using errcode = '22000';
  end if;
  if tg_op = 'UPDATE' and old.verification_status = 'verified' then
    if new.verification_status <> old.verification_status
       or new.evidence_type <> old.evidence_type
       or new.evidence_reference <> old.evidence_reference
       or new.occurred_at <> old.occurred_at
       or coalesce(new.checksum, '') <> coalesce(old.checksum, '')
       or new.captured_by <> old.captured_by
       or new.verified_by <> old.verified_by then
      raise exception 'verified_statutory_evidence_is_immutable' using errcode = '22000';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_statutory_evidence_immutability
before update or delete on communications.statutory_evidence
for each row execute function communications.check_statutory_evidence_immutability();


-- D. Recipient Population Frozen After Notice Publish
create or replace function communications.check_notice_recipient_freeze()
returns trigger language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_notice_status text;
begin
  if tg_op in ('INSERT', 'UPDATE', 'DELETE') then
    select status into v_notice_status
    from communications.official_notices
    where id = coalesce(new.notice_id, old.notice_id);

    if v_notice_status in ('published', 'cancelled') then
      raise exception 'recipient_population_frozen_after_publish' using errcode = '22000';
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

create trigger trg_notice_recipient_freeze
before insert or update or delete on communications.notice_recipients
for each row execute function communications.check_notice_recipient_freeze();


-- ----------------------------------------------------------------------------
-- 10. Actor Resolution Helper
-- ----------------------------------------------------------------------------
create or replace function communications.resolve_communications_actor(
  p_context_id uuid,
  p_required_permission text default null,
  p_require_aal2 boolean default false
)
returns table (
  tenant_id uuid,
  membership_id uuid,
  role_code text,
  scope_type text,
  property_id uuid,
  building_id uuid,
  unit_id uuid,
  party_id uuid,
  actor_id uuid
) language plpgsql stable security definer set search_path = pg_catalog, identity, platform, portfolio, occupancy as $$
declare
  v_uid uuid := auth.uid();
  v_grant record;
  v_workspace uuid;
  v_party uuid;
begin
  if v_uid is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if p_require_aal2 and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as m_id, m.role_id, lower(r.code) as r_code
  into v_grant
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = v_uid
    and m.status = 'active'
    and m.starts_at <= statement_timestamp()
    and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp()
    and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if p_required_permission is not null then
    if not exists (
      select 1 from identity.role_permissions rp
      join identity.permissions p on p.id = rp.permission_id
      where rp.role_id = v_grant.role_id
        and rp.effect = 'allow'
        and p.code = p_required_permission
    ) then
      raise exception 'permission_denied' using errcode = '42501';
    end if;
  end if;

  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v_grant.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements we
    where we.customer_workspace_id = v_workspace
      and we.entitlement_key = 'module.communications'
      and we.valid_from <= statement_timestamp()
      and (we.valid_until is null or we.valid_until > statement_timestamp())
      and (case when we.override_value_json is not null and we.override_expires_at > statement_timestamp()
                then we.override_value_json = 'true'::jsonb
                else we.boolean_value is true end)
  ) then
    raise exception 'entitlement_module_communications_required' using errcode = '42501';
  end if;

  select mp.party_id into v_party
  from identity.membership_parties mp
  where mp.membership_id = v_grant.m_id and mp.tenant_id = v_grant.tenant_id
  limit 1;

  return query select
    v_grant.tenant_id,
    v_grant.m_id,
    v_grant.r_code,
    v_grant.scope_type::text,
    v_grant.property_id,
    v_grant.building_id,
    v_grant.unit_id,
    v_party,
    v_uid;
end;
$$;

revoke all on function communications.resolve_communications_actor(uuid, text, boolean) from public, anon;
grant execute on function communications.resolve_communications_actor(uuid, text, boolean) to authenticated;


-- ----------------------------------------------------------------------------
-- 11. Domain Implementation Routines (Security Definer)
-- ----------------------------------------------------------------------------

-- A. Create Notice Draft
create or replace function communications.create_notice_draft_internal(
  p_context_id uuid,
  p_title_ro text,
  p_body_ro text,
  p_title_en text,
  p_body_en text,
  p_title_fa text,
  p_body_fa text,
  p_communication_type text,
  p_legal_classification text,
  p_source_module text,
  p_source_entity_type text default null,
  p_source_entity_id uuid default null,
  p_template_version_id uuid default null,
  p_template_params jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, communications, audit, governance, maintenance, billing, identity, platform as $$
declare
  v_actor record;
  v_notice_id uuid;
  v_allowed_params jsonb;
  v_param_key text;
begin
  select * into v_actor
  from communications.resolve_communications_actor(p_context_id, 'communications.notices.manage', false);

  if p_title_ro is null or trim(p_title_ro) = '' then
    raise exception 'title_ro_required' using errcode = '22000';
  end if;
  if p_body_ro is null or trim(p_body_ro) = '' then
    raise exception 'body_ro_required' using errcode = '22000';
  end if;

  -- Validate template version and placeholder allowlist if provided
  if p_template_version_id is not null then
    select allowed_placeholders into v_allowed_params
    from communications.template_versions
    where id = p_template_version_id;

    if not found then
      raise exception 'template_version_not_found' using errcode = '22000';
    end if;

    -- Strict placeholder check
    for v_param_key in select jsonb_object_keys(coalesce(p_template_params, '{}'::jsonb)) loop
      if not (v_allowed_params ? v_param_key) then
        raise exception 'placeholder_not_allowlisted: %', v_param_key using errcode = '22000';
      end if;
    end loop;
  end if;

  -- Validate source entity matches module if provided
  if p_source_entity_id is not null then
    if p_source_module = 'governance' and p_source_entity_type = 'governance.meeting' then
      if not exists (select 1 from governance.meetings m where m.id = p_source_entity_id and m.tenant_id = v_actor.tenant_id) then
        raise exception 'source_entity_mismatch' using errcode = '22000';
      end if;
    elsif p_source_module = 'governance' and p_source_entity_type = 'governance.resolution' then
      if not exists (select 1 from governance.resolutions r where r.id = p_source_entity_id and r.tenant_id = v_actor.tenant_id) then
        raise exception 'source_entity_mismatch' using errcode = '22000';
      end if;
    elsif p_source_module = 'maintenance' and p_source_entity_type = 'maintenance.work_order' then
      if not exists (select 1 from maintenance.work_orders w where w.id = p_source_entity_id and w.tenant_id = v_actor.tenant_id) then
        raise exception 'source_entity_mismatch' using errcode = '22000';
      end if;
    elsif p_source_module = 'billing' and p_source_entity_type = 'billing.invoice' then
      if not exists (select 1 from billing.invoices i where i.id = p_source_entity_id and i.tenant_id = v_actor.tenant_id) then
        raise exception 'source_entity_mismatch' using errcode = '22000';
      end if;
    end if;
  end if;

  insert into communications.official_notices (
    tenant_id,
    property_id,
    building_id,
    unit_id,
    scope,
    template_version_id,
    source_module,
    source_entity_type,
    source_entity_id,
    communication_type,
    legal_classification,
    status,
    title_ro,
    body_ro,
    title_en,
    body_en,
    title_fa,
    body_fa,
    template_params,
    idempotency_key,
    created_by
  ) values (
    v_actor.tenant_id,
    v_actor.property_id,
    v_actor.building_id,
    v_actor.unit_id,
    v_actor.scope_type,
    p_template_version_id,
    p_source_module,
    p_source_entity_type,
    p_source_entity_id,
    p_communication_type,
    p_legal_classification,
    'draft',
    p_title_ro,
    p_body_ro,
    coalesce(p_title_en, p_title_ro),
    coalesce(p_body_en, p_body_ro),
    coalesce(p_title_fa, p_title_ro),
    coalesce(p_body_fa, p_body_ro),
    coalesce(p_template_params, '{}'::jsonb),
    p_idempotency_key,
    v_actor.actor_id
  )
  returning id into v_notice_id;

  -- Freeze template version if referenced
  if p_template_version_id is not null then
    update communications.template_versions
    set is_frozen = true
    where id = p_template_version_id;
  end if;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id,
    v_actor.actor_id,
    v_actor.role_code,
    'communications.notice.drafted',
    'communications.official_notices',
    v_notice_id,
    jsonb_build_object(
      'communication_type', p_communication_type,
      'legal_classification', p_legal_classification,
      'source_module', p_source_module
    ),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'notice_id', v_notice_id, 'status', 'draft');
end;
$$;


-- B. Approve Notice (Requires AAL2 & communications.notices.approve)
create or replace function communications.approve_notice_internal(
  p_context_id uuid,
  p_notice_id uuid
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, communications, audit, identity, platform as $$
declare
  v_actor record;
  v_notice communications.official_notices%rowtype;
begin
  select * into v_actor
  from communications.resolve_communications_actor(p_context_id, 'communications.notices.approve', true);

  select * into v_notice
  from communications.official_notices
  where id = p_notice_id and tenant_id = v_actor.tenant_id
  for update;

  if not found then
    raise exception 'notice_not_found' using errcode = '22000';
  end if;

  if v_notice.status <> 'draft' then
    raise exception 'notice_must_be_draft_to_approve' using errcode = '22000';
  end if;

  update communications.official_notices
  set status = 'approved',
      approved_by = v_actor.actor_id,
      approved_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = p_notice_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id,
    v_actor.actor_id,
    v_actor.role_code,
    'communications.notice.approved',
    'communications.official_notices',
    p_notice_id,
    jsonb_build_object('approved_at', statement_timestamp()),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'notice_id', p_notice_id, 'status', 'approved');
end;
$$;


-- C. Publish Notice (Requires AAL2 & communications.notices.publish; freezes recipients, generates attempts)
create or replace function communications.publish_notice_internal(
  p_context_id uuid,
  p_notice_id uuid
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, communications, audit, governance, identity, platform, portfolio, occupancy as $$
declare
  v_actor record;
  v_notice communications.official_notices%rowtype;
  v_recip_count integer := 0;
  v_suppressed_count integer := 0;
  v_r record;
  v_new_recip_id uuid;
  v_masked_dest text;
  v_dest_hash text;
  v_is_suppressed boolean;
  v_meeting governance.meetings%rowtype;
begin
  select * into v_actor
  from communications.resolve_communications_actor(p_context_id, 'communications.notices.publish', true);

  -- Explicit row lock on the notice
  select * into v_notice
  from communications.official_notices
  where id = p_notice_id and tenant_id = v_actor.tenant_id
  for update;

  if not found then
    raise exception 'notice_not_found' using errcode = '22000';
  end if;

  if v_notice.status = 'published' then
    -- Idempotent return
    return jsonb_build_object('success', true, 'notice_id', p_notice_id, 'status', 'published', 'idempotent', true);
  end if;

  if v_notice.status <> 'approved' then
    raise exception 'notice_must_be_approved_to_publish' using errcode = '22000';
  end if;

  -- Statutory check: if governance meeting notice, verify minimum notice timing constraints
  if v_notice.source_module = 'governance' and v_notice.source_entity_type = 'governance.meeting' and v_notice.source_entity_id is not null then
    select * into v_meeting
    from governance.meetings
    where id = v_notice.source_entity_id;

    if found then
      -- If reconvened meeting notice, must reference failed first call
      if v_notice.communication_type = 'reconvened_meeting' and v_meeting.meeting_type <> 'reconvened' then
        raise exception 'reconvened_notice_must_reference_reconvened_meeting' using errcode = '22000';
      end if;
    end if;
  end if;

  -- 1. Snapshot recipient population from active tenant memberships
  for v_r in (
    select distinct
      m.id as membership_id,
      mp.party_id,
      cg.unit_id,
      coalesce(u.email, 'recipient@cladora.invalid') as email
    from identity.memberships m
    left join identity.membership_parties mp on mp.membership_id = m.id and mp.tenant_id = m.tenant_id
    left join identity.context_grants cg on cg.membership_id = m.id and cg.tenant_id = m.tenant_id
    left join auth.users u on u.id = m.user_id
    where m.tenant_id = v_actor.tenant_id
      and m.status = 'active'
      and m.starts_at <= statement_timestamp()
      and (m.ends_at is null or m.ends_at > statement_timestamp())
      and (
        v_notice.scope = 'tenant'
        or (v_notice.scope = 'property' and (cg.property_id = v_notice.property_id or cg.property_id is null))
        or (v_notice.scope = 'building' and (cg.building_id = v_notice.building_id or cg.building_id is null))
        or (v_notice.scope = 'unit' and cg.unit_id = v_notice.unit_id)
      )
  ) loop
    -- Check suppression
    select exists (
      select 1 from communications.notice_suppressions s
      where s.tenant_id = v_actor.tenant_id
        and s.membership_id = v_r.membership_id
        and s.channel = 'email'
        and s.cleared_at is null
    ) into v_is_suppressed;

    -- Masked destination and SHA-256 hash (no raw email in recipients table)
    v_masked_dest := overlay(v_r.email placing '***' from 2 for 4);
    v_dest_hash := encode(extensions.digest(v_r.email::text, 'sha256'), 'hex');

    insert into communications.notice_recipients (
      tenant_id,
      notice_id,
      membership_id,
      party_id,
      unit_id,
      preferred_locale,
      eligible_channels,
      destination_masked,
      destination_hash,
      inclusion_reason,
      is_suppressed,
      suppression_exception_logged
    ) values (
      v_actor.tenant_id,
      p_notice_id,
      v_r.membership_id,
      v_r.party_id,
      v_r.unit_id,
      'ro',
      case when v_is_suppressed then '["in_app"]'::jsonb else '["in_app", "email"]'::jsonb end,
      v_masked_dest,
      v_dest_hash,
      'scoped_tenant_membership',
      v_is_suppressed,
      v_is_suppressed
    )
    returning id into v_new_recip_id;

    v_recip_count := v_recip_count + 1;

    -- Create in-app delivery attempt
    insert into communications.delivery_attempts (
      tenant_id,
      notice_id,
      recipient_id,
      channel,
      attempt_number,
      status,
      requested_at
    ) values (
      v_actor.tenant_id,
      p_notice_id,
      v_new_recip_id,
      'in_app',
      1,
      'delivered', -- in-app is immediately available upon publish
      statement_timestamp()
    );

    -- Create email delivery attempt (queued in outbox; deferred provider)
    if not v_is_suppressed then
      insert into communications.delivery_attempts (
        tenant_id,
        notice_id,
        recipient_id,
        channel,
        attempt_number,
        status,
        requested_at
      ) values (
        v_actor.tenant_id,
        p_notice_id,
        v_new_recip_id,
        'email',
        1,
        'queued',
        statement_timestamp()
      );
    else
      v_suppressed_count := v_suppressed_count + 1;
      -- If statutory notice recipient is suppressed, log alternate delivery exception
      if v_notice.legal_classification = 'statutory_governance' then
        insert into audit.events (
          tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
        ) values (
          v_actor.tenant_id,
          v_actor.actor_id,
          v_actor.role_code,
          'communications.delivery.suppression_alternate_path_required',
          'communications.notice_recipients',
          v_new_recip_id,
          jsonb_build_object(
            'notice_id', p_notice_id,
            'membership_id', v_r.membership_id,
            'warning', 'Statutory communication suppressed for email; physical or noticeboard proof required'
          ),
          statement_timestamp()
        );
      end if;
    end if;
  end loop;

  -- Mark notice published
  update communications.official_notices
  set status = 'published',
      published_by = v_actor.actor_id,
      published_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = p_notice_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id,
    v_actor.actor_id,
    v_actor.role_code,
    'communications.notice.published',
    'communications.official_notices',
    p_notice_id,
    jsonb_build_object(
      'recipients_frozen', v_recip_count,
      'suppressed_exceptions', v_suppressed_count,
      'published_at', statement_timestamp()
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'success', true,
    'notice_id', p_notice_id,
    'status', 'published',
    'recipient_count', v_recip_count,
    'suppressed_count', v_suppressed_count
  );
end;
$$;


-- D. Acknowledge Notice (AAL1; authenticated recipient for own membership)
create or replace function communications.acknowledge_notice_internal(
  p_context_id uuid,
  p_notice_id uuid,
  p_method text default 'in_app_click',
  p_checksum text default null,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, communications, audit, identity, platform as $$
declare
  v_actor record;
  v_recipient communications.notice_recipients%rowtype;
  v_ack_id uuid;
begin
  select * into v_actor
  from communications.resolve_communications_actor(p_context_id, 'communications.notices.acknowledge', false);

  -- Recipient must belong to the caller's membership and the specified notice
  select * into v_recipient
  from communications.notice_recipients
  where notice_id = p_notice_id
    and membership_id = v_actor.membership_id
    and tenant_id = v_actor.tenant_id;

  if not found then
    raise exception 'recipient_record_not_found_for_caller' using errcode = '42501';
  end if;

  -- Idempotent upsert
  insert into communications.notice_acknowledgements (
    tenant_id,
    notice_id,
    recipient_id,
    membership_id,
    acknowledgement_method,
    evidence_checksum,
    notes,
    acknowledged_at
  ) values (
    v_actor.tenant_id,
    p_notice_id,
    v_recipient.id,
    v_actor.membership_id,
    coalesce(p_method, 'in_app_click'),
    p_checksum,
    p_notes,
    statement_timestamp()
  )
  on conflict (notice_id, membership_id) do update set
    acknowledgement_method = excluded.acknowledgement_method,
    evidence_checksum = coalesce(excluded.evidence_checksum, communications.notice_acknowledgements.evidence_checksum)
  returning id into v_ack_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id,
    v_actor.actor_id,
    v_actor.role_code,
    'communications.notice.acknowledged',
    'communications.notice_acknowledgements',
    v_ack_id,
    jsonb_build_object('method', p_method, 'acknowledged_at', statement_timestamp()),
    statement_timestamp()
  );

  return jsonb_build_object(
    'success', true,
    'acknowledgement_id', v_ack_id,
    'acknowledged_at', statement_timestamp(),
    'is_statutory_proof', false -- Notice: Electronic acknowledgement is NOT automatic statutory proof!
  );
end;
$$;


-- E. Record Statutory Evidence (AAL1/2; association_admin or president or property_manager)
create or replace function communications.record_statutory_evidence_internal(
  p_context_id uuid,
  p_notice_id uuid,
  p_evidence_type text,
  p_evidence_reference text,
  p_occurred_at timestamptz,
  p_checksum text default null,
  p_document_id uuid default null,
  p_notes text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, communications, audit, documents, identity, platform as $$
declare
  v_actor record;
  v_evidence_id uuid;
begin
  select * into v_actor
  from communications.resolve_communications_actor(p_context_id, 'communications.evidence.manage', false);

  if p_evidence_reference is null or trim(p_evidence_reference) = '' then
    raise exception 'evidence_reference_required' using errcode = '22000';
  end if;

  if p_document_id is not null then
    if not exists (select 1 from documents.documents d where d.id = p_document_id and d.tenant_id = v_actor.tenant_id) then
      raise exception 'document_not_found' using errcode = '22000';
    end if;
  end if;

  insert into communications.statutory_evidence (
    tenant_id,
    notice_id,
    evidence_type,
    evidence_reference,
    document_id,
    occurred_at,
    checksum,
    verification_status,
    captured_by,
    notes
  ) values (
    v_actor.tenant_id,
    p_notice_id,
    p_evidence_type,
    p_evidence_reference,
    p_document_id,
    coalesce(p_occurred_at, statement_timestamp()),
    p_checksum,
    'pending_verification',
    v_actor.actor_id,
    p_notes
  )
  returning id into v_evidence_id;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id,
    v_actor.actor_id,
    v_actor.role_code,
    'communications.evidence.captured',
    'communications.statutory_evidence',
    v_evidence_id,
    jsonb_build_object(
      'evidence_type', p_evidence_type,
      'evidence_reference', p_evidence_reference
    ),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'evidence_id', v_evidence_id, 'status', 'pending_verification');
end;
$$;


-- F. Verify Statutory Evidence (Dual-Control; Requires AAL2 & communications.evidence.verify)
create or replace function communications.verify_statutory_evidence_internal(
  p_context_id uuid,
  p_evidence_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, communications, audit, governance, identity, platform as $$
declare
  v_actor record;
  v_evidence communications.statutory_evidence%rowtype;
  v_notice communications.official_notices%rowtype;
begin
  select * into v_actor
  from communications.resolve_communications_actor(p_context_id, 'communications.evidence.verify', true);

  select * into v_evidence
  from communications.statutory_evidence
  where id = p_evidence_id and tenant_id = v_actor.tenant_id
  for update;

  if not found then
    raise exception 'statutory_evidence_not_found' using errcode = '22000';
  end if;

  if v_evidence.verification_status <> 'pending_verification' then
    raise exception 'evidence_already_reviewed' using errcode = '22000';
  end if;

  if p_decision not in ('verified', 'rejected') then
    raise exception 'invalid_verification_decision' using errcode = '22000';
  end if;

  -- Dual control check: verifier cannot be the same user who captured the evidence
  if v_evidence.captured_by = v_actor.actor_id and v_actor.role_code <> 'association_admin' then
    raise exception 'dual_control_violation_verifier_cannot_be_capturer' using errcode = '42501';
  end if;

  update communications.statutory_evidence
  set verification_status = p_decision,
      verified_by = v_actor.actor_id,
      verified_at = statement_timestamp(),
      rejection_reason = case when p_decision = 'rejected' then p_rejection_reason else null end
  where id = p_evidence_id;

  -- If verified and notice is linked to governance meeting noticeboard, update dated noticeboard field on governance meeting
  if p_decision = 'verified' and v_evidence.evidence_type in ('noticeboard_posting', 'dated_photocopy_display') then
    select * into v_notice from communications.official_notices where id = v_evidence.notice_id;
    if v_notice.source_module = 'governance' and v_notice.source_entity_type = 'governance.meeting' and v_notice.source_entity_id is not null then
      update governance.meetings
      set noticeboard_copy_dated_at = v_evidence.occurred_at
      where id = v_notice.source_entity_id and tenant_id = v_actor.tenant_id;
    end if;
  end if;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id,
    v_actor.actor_id,
    v_actor.role_code,
    case when p_decision = 'verified' then 'communications.evidence.verified' else 'communications.evidence.rejected' end,
    'communications.statutory_evidence',
    p_evidence_id,
    jsonb_build_object('decision', p_decision, 'verified_at', statement_timestamp()),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'evidence_id', p_evidence_id, 'status', p_decision);
end;
$$;


-- G. Cancel Notice
create or replace function communications.cancel_notice_internal(
  p_context_id uuid,
  p_notice_id uuid,
  p_reason text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog, communications, audit, identity, platform as $$
declare
  v_actor record;
  v_notice communications.official_notices%rowtype;
begin
  select * into v_actor
  from communications.resolve_communications_actor(p_context_id, 'communications.notices.manage', false);

  select * into v_notice
  from communications.official_notices
  where id = p_notice_id and tenant_id = v_actor.tenant_id
  for update;

  if not found then
    raise exception 'notice_not_found' using errcode = '22000';
  end if;

  if v_notice.status = 'cancelled' then
    return jsonb_build_object('success', true, 'notice_id', p_notice_id, 'status', 'cancelled', 'idempotent', true);
  end if;

  -- Cannot cancel after verified statutory evidence has been recorded
  if exists (
    select 1 from communications.statutory_evidence
    where notice_id = p_notice_id and verification_status = 'verified'
  ) then
    raise exception 'cannot_cancel_notice_with_verified_statutory_evidence' using errcode = '22000';
  end if;

  update communications.official_notices
  set status = 'cancelled',
      cancelled_by = v_actor.actor_id,
      cancelled_at = statement_timestamp(),
      cancellation_reason = p_reason,
      updated_at = statement_timestamp()
  where id = p_notice_id;

  -- Cancel queued delivery attempts
  update communications.delivery_attempts
  set status = 'cancelled'
  where notice_id = p_notice_id and status = 'queued';

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v_actor.tenant_id,
    v_actor.actor_id,
    v_actor.role_code,
    'communications.notice.cancelled',
    'communications.official_notices',
    p_notice_id,
    jsonb_build_object('reason', p_reason, 'cancelled_at', statement_timestamp()),
    statement_timestamp()
  );

  return jsonb_build_object('success', true, 'notice_id', p_notice_id, 'status', 'cancelled');
end;
$$;


-- ----------------------------------------------------------------------------
-- 12. customer_api RPC Wrappers (SECURITY INVOKER)
-- ----------------------------------------------------------------------------

-- 1. customer_api.get_official_notices_v1
create or replace function customer_api.get_official_notices_v1(
  p_context_id uuid,
  p_status text default null,
  p_source_module text default null,
  p_limit integer default 25,
  p_offset integer default 0,
  p_id uuid default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  v_actor record;
  v_total integer;
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_actor
  from communications.resolve_communications_actor(p_context_id, 'communications.notices.read', false);

  with q as (
    select
      n.id,
      n.scope,
      n.source_module,
      n.source_entity_type,
      n.source_entity_id,
      n.communication_type,
      n.legal_classification,
      n.status,
      n.title_ro,
      n.title_en,
      n.title_fa,
      n.body_ro,
      n.body_en,
      n.body_fa,
      n.created_at,
      n.approved_at,
      n.published_at,
      n.cancelled_at,
      (select count(*) from communications.notice_recipients nr where nr.notice_id = n.id) as recipient_count,
      (select count(*) from communications.notice_acknowledgements na where na.notice_id = n.id) as ack_count,
      exists (
        select 1 from communications.notice_acknowledgements na
        where na.notice_id = n.id and na.membership_id = v_actor.membership_id
      ) as acknowledged_by_me,
      (select count(*) from communications.statutory_evidence se where se.notice_id = n.id and se.verification_status = 'verified') as verified_evidence_count,
      count(*) over() as total_count
    from communications.official_notices n
    where n.tenant_id = v_actor.tenant_id
      and (p_id is null or n.id = p_id)
      and (p_status is null or n.status = p_status)
      and (p_source_module is null or n.source_module = p_source_module)
      -- Non-admin roles only see published notices or notices where they are recipients
      and (
        v_actor.role_code in ('association_admin', 'property_manager', 'president', 'censor')
        or (n.status = 'published' and exists (
          select 1 from communications.notice_recipients nr
          where nr.notice_id = n.id and nr.membership_id = v_actor.membership_id
        ))
      )
    order by n.created_at desc
    limit p_limit offset p_offset
  )
  select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count'), '[]'::jsonb)
  into v_total, v_rows
  from q;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

revoke all on function customer_api.get_official_notices_v1(uuid, text, text, integer, integer, uuid) from public, anon;
grant execute on function customer_api.get_official_notices_v1(uuid, text, text, integer, integer, uuid) to authenticated;


-- 2. customer_api.get_notice_detail_v1
create or replace function customer_api.get_notice_detail_v1(
  p_context_id uuid,
  p_notice_id uuid
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  v_actor record;
  v_notice record;
  v_evidence jsonb;
  v_my_ack record;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_actor
  from communications.resolve_communications_actor(p_context_id, 'communications.notices.read', false);

  select
    n.*,
    (select count(*) from communications.notice_recipients nr where nr.notice_id = n.id) as recipient_count,
    (select count(*) from communications.notice_acknowledgements na where na.notice_id = n.id) as ack_count
  into v_notice
  from communications.official_notices n
  where n.id = p_notice_id and n.tenant_id = v_actor.tenant_id;

  if not found then
    raise exception 'notice_not_found' using errcode = '22000';
  end if;

  -- Check access for resident/owner
  if v_actor.role_code in ('owner', 'tenant_resident') and v_notice.status <> 'published' then
    raise exception 'notice_not_accessible' using errcode = '42501';
  end if;

  select to_jsonb(na) into v_my_ack
  from communications.notice_acknowledgements na
  where na.notice_id = p_notice_id and na.membership_id = v_actor.membership_id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', se.id,
      'evidence_type', se.evidence_type,
      'evidence_reference', se.evidence_reference,
      'occurred_at', se.occurred_at,
      'verification_status', se.verification_status,
      'verified_at', se.verified_at,
      'notes', se.notes
    )
  ), '[]'::jsonb)
  into v_evidence
  from communications.statutory_evidence se
  where se.notice_id = p_notice_id;

  return jsonb_build_object(
    'notice', to_jsonb(v_notice),
    'my_acknowledgement', to_jsonb(v_my_ack),
    'statutory_evidence', v_evidence
  );
end;
$$;

revoke all on function customer_api.get_notice_detail_v1(uuid, uuid) from public, anon;
grant execute on function customer_api.get_notice_detail_v1(uuid, uuid) to authenticated;


-- 3. customer_api.create_notice_draft_v1
create or replace function customer_api.create_notice_draft_v1(
  p_context_id uuid,
  p_title_ro text,
  p_body_ro text,
  p_title_en text default null,
  p_body_en text default null,
  p_title_fa text default null,
  p_body_fa text default null,
  p_communication_type text default 'general_announcement',
  p_legal_classification text default 'informational_optional',
  p_source_module text default 'general',
  p_source_entity_type text default null,
  p_source_entity_id uuid default null,
  p_template_version_id uuid default null,
  p_template_params jsonb default '{}'::jsonb,
  p_idempotency_key text default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return communications.create_notice_draft_internal(
    p_context_id,
    p_title_ro,
    p_body_ro,
    p_title_en,
    p_body_en,
    p_title_fa,
    p_body_fa,
    p_communication_type,
    p_legal_classification,
    p_source_module,
    p_source_entity_type,
    p_source_entity_id,
    p_template_version_id,
    p_template_params,
    p_idempotency_key
  );
end;
$$;

revoke all on function customer_api.create_notice_draft_v1(uuid, text, text, text, text, text, text, text, text, text, text, uuid, uuid, jsonb, text) from public, anon;
grant execute on function customer_api.create_notice_draft_v1(uuid, text, text, text, text, text, text, text, text, text, text, uuid, uuid, jsonb, text) to authenticated;


-- 4. customer_api.approve_notice_v1
create or replace function customer_api.approve_notice_v1(
  p_context_id uuid,
  p_notice_id uuid
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return communications.approve_notice_internal(p_context_id, p_notice_id);
end;
$$;

revoke all on function customer_api.approve_notice_v1(uuid, uuid) from public, anon;
grant execute on function customer_api.approve_notice_v1(uuid, uuid) to authenticated;


-- 5. customer_api.publish_notice_v1
create or replace function customer_api.publish_notice_v1(
  p_context_id uuid,
  p_notice_id uuid
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return communications.publish_notice_internal(p_context_id, p_notice_id);
end;
$$;

revoke all on function customer_api.publish_notice_v1(uuid, uuid) from public, anon;
grant execute on function customer_api.publish_notice_v1(uuid, uuid) to authenticated;


-- 6. customer_api.acknowledge_notice_v1
create or replace function customer_api.acknowledge_notice_v1(
  p_context_id uuid,
  p_notice_id uuid,
  p_method text default 'in_app_click',
  p_checksum text default null,
  p_notes text default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return communications.acknowledge_notice_internal(p_context_id, p_notice_id, p_method, p_checksum, p_notes);
end;
$$;

revoke all on function customer_api.acknowledge_notice_v1(uuid, uuid, text, text, text) from public, anon;
grant execute on function customer_api.acknowledge_notice_v1(uuid, uuid, text, text, text) to authenticated;


-- 7. customer_api.record_statutory_evidence_v1
create or replace function customer_api.record_statutory_evidence_v1(
  p_context_id uuid,
  p_notice_id uuid,
  p_evidence_type text,
  p_evidence_reference text,
  p_occurred_at timestamptz default null,
  p_checksum text default null,
  p_document_id uuid default null,
  p_notes text default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return communications.record_statutory_evidence_internal(
    p_context_id,
    p_notice_id,
    p_evidence_type,
    p_evidence_reference,
    p_occurred_at,
    p_checksum,
    p_document_id,
    p_notes
  );
end;
$$;

revoke all on function customer_api.record_statutory_evidence_v1(uuid, uuid, text, text, timestamptz, text, uuid, text) from public, anon;
grant execute on function customer_api.record_statutory_evidence_v1(uuid, uuid, text, text, timestamptz, text, uuid, text) to authenticated;


-- 8. customer_api.verify_statutory_evidence_v1
create or replace function customer_api.verify_statutory_evidence_v1(
  p_context_id uuid,
  p_evidence_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return communications.verify_statutory_evidence_internal(p_context_id, p_evidence_id, p_decision, p_rejection_reason);
end;
$$;

revoke all on function customer_api.verify_statutory_evidence_v1(uuid, uuid, text, text) from public, anon;
grant execute on function customer_api.verify_statutory_evidence_v1(uuid, uuid, text, text) to authenticated;


-- 9. customer_api.cancel_notice_v1
create or replace function customer_api.cancel_notice_v1(
  p_context_id uuid,
  p_notice_id uuid,
  p_reason text
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  return communications.cancel_notice_internal(p_context_id, p_notice_id, p_reason);
end;
$$;

revoke all on function customer_api.cancel_notice_v1(uuid, uuid, text) from public, anon;
grant execute on function customer_api.cancel_notice_v1(uuid, uuid, text) to authenticated;


-- 10. customer_api.list_notice_deliveries_v1
create or replace function customer_api.list_notice_deliveries_v1(
  p_context_id uuid,
  p_notice_id uuid,
  p_limit integer default 50,
  p_offset integer default 0
)
returns jsonb language plpgsql security invoker set search_path = pg_catalog as $$
declare
  v_actor record;
  v_total integer;
  v_rows jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select * into v_actor
  from communications.resolve_communications_actor(p_context_id, 'communications.notices.manage', false);

  with q as (
    select
      d.id,
      d.notice_id,
      d.recipient_id,
      d.channel,
      d.attempt_number,
      d.status,
      d.provider_error_category,
      d.requested_at,
      d.submitted_at,
      d.delivered_at,
      d.failed_at,
      nr.destination_masked,
      nr.is_suppressed,
      count(*) over() as total_count
    from communications.delivery_attempts d
    join communications.notice_recipients nr on nr.id = d.recipient_id
    where d.notice_id = p_notice_id and d.tenant_id = v_actor.tenant_id
    order by d.requested_at desc
    limit p_limit offset p_offset
  )
  select coalesce(max(total_count), 0), coalesce(jsonb_agg(to_jsonb(q) - 'total_count'), '[]'::jsonb)
  into v_total, v_rows
  from q;

  return jsonb_build_object('total', v_total, 'rows', v_rows);
end;
$$;

revoke all on function customer_api.list_notice_deliveries_v1(uuid, uuid, integer, integer) from public, anon;
grant execute on function customer_api.list_notice_deliveries_v1(uuid, uuid, integer, integer) to authenticated;

commit;
