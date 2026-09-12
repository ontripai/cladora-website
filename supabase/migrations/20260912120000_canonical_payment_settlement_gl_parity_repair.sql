begin;

-- =============================================================================
-- Migration 83: Canonical Settlement Posting, Association Payment Configuration
--               & Continuous GL Parity Repair
-- Task: CLADORA-P2-PAY-003-R3
--
-- Strictly forward-only, zero fixture DML, continuous GL parity repair:
-- 1. Dual-control lifecycle for association beneficiary accounts
--    (draft -> pending_approval -> active -> superseded / revoked)
-- 2. Immutable payment intent snapshots
-- 3. Webhook trust boundary & canonical settlement journal posting
--    (Dr 5121 = S, Cr 4111 = A, Cr 419 = U; where S = A + U)
-- 4. Binding payment_id and journal_id in settlements chain
-- =============================================================================

-- 1. Schema Enhancements
-- -----------------------------------------------------------------------------

-- 1.1 Widen beneficiary account status constraint
do $$
begin
  alter table payments.beneficiary_accounts 
    drop constraint if exists beneficiary_accounts_status_check;
  alter table payments.beneficiary_accounts 
    drop constraint if exists ck_beneficiary_accounts_status;
  alter table payments.beneficiary_accounts 
    add constraint ck_beneficiary_accounts_status 
    check (status in ('draft', 'pending_approval', 'active', 'superseded', 'revoked', 'rejected', 'suspended', 'decommissioned'));
exception when others then
  null;
end $$;

alter table payments.beneficiary_accounts
  alter column status set default 'draft';

-- 1.2 Add versioning and lifecycle columns to beneficiary accounts
alter table payments.beneficiary_accounts
  add column if not exists version integer not null default 1,
  add column if not exists iban_fingerprint text,
  add column if not exists submitted_at timestamptz,
  add column if not exists submitted_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_by uuid references auth.users(id),
  add column if not exists rejection_reason text,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references auth.users(id),
  add column if not exists revocation_reason text;

-- 1.3 Add dual-control approval check constraint
do $$
begin
  alter table payments.beneficiary_accounts
    drop constraint if exists ck_beneficiary_dual_control_approval;
  alter table payments.beneficiary_accounts
    add constraint ck_beneficiary_dual_control_approval
    check (approved_by is null or created_by is null or approved_by <> created_by);
exception when others then
  null;
end $$;

-- 1.4 Unique partial index: strictly at most one active beneficiary account per tenant/property/currency
create unique index if not exists uq_active_beneficiary_account
  on payments.beneficiary_accounts (
    tenant_id,
    coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid),
    currency
  )
  where status = 'active';

-- 1.5 Add configuration snapshot & version to payment intents
alter table payments.payment_intents
  add column if not exists configuration_snapshot jsonb,
  add column if not exists configuration_version integer not null default 1;

-- 1.6 Add webhook secret reference to provider accounts
alter table payments.provider_accounts
  add column if not exists webhook_secret_ref text;

-- 1.7 Add payment_id and journal_id to settlements chain
alter table payments.settlements
  add column if not exists payment_id uuid references payments.payments(id),
  add column if not exists journal_id uuid references finance.journals(id);

create index if not exists idx_settlements_payment_id on payments.settlements(payment_id);
create index if not exists idx_settlements_journal_id on payments.settlements(journal_id);

-- 1.8 Widen webhook receipts processing status check constraint
do $$
begin
  alter table payments.webhook_receipts
    drop constraint if exists webhook_receipts_processing_status_check;
  alter table payments.webhook_receipts
    add constraint webhook_receipts_processing_status_check
    check (processing_status in ('received', 'processed', 'ignored', 'failed', 'deferred'));
exception when others then
  null;
end $$;

-- 2. Domain Helper: IBAN Validation & Fingerprinting
-- -----------------------------------------------------------------------------

create or replace function payments.validate_and_mask_iban(
  p_iban text,
  out o_normalized text,
  out o_masked text,
  out o_fingerprint text
)
language plpgsql
immutable
as $$
declare
  v_clean text;
  v_num text;
  v_char text;
  v_code integer;
  v_mod integer := 0;
  i integer;
begin
  v_clean := upper(regexp_replace(coalesce(p_iban, ''), '[^A-Za-z0-9]', '', 'g'));
  
  if length(v_clean) < 15 or length(v_clean) > 34 then
    raise exception 'invalid_iban_length' using errcode = '22023';
  end if;

  -- Romanian IBAN specific validation if starting with RO
  if left(v_clean, 2) = 'RO' and length(v_clean) <> 24 then
    raise exception 'invalid_romanian_iban_length' using errcode = '22023';
  end if;

  -- MOD-97 check
  v_num := substr(v_clean, 5) || substr(v_clean, 1, 4);
  v_mod := 0;
  for i in 1..length(v_num) loop
    v_char := substr(v_num, i, 1);
    if v_char ~ '^[0-9]$' then
      v_mod := (v_mod * 10 + v_char::integer) % 97;
    else
      v_code := ascii(v_char) - 55;
      v_mod := (v_mod * 100 + v_code) % 97;
    end if;
  end loop;

  if v_mod <> 1 then
    raise exception 'invalid_iban_checksum' using errcode = '22023';
  end if;

  o_normalized := v_clean;
  o_masked := left(v_clean, 4) || '****' || right(v_clean, 4);
  o_fingerprint := encode(extensions.digest(v_clean, 'sha256'), 'hex');
end;
$$;

-- 3. Dual-Control Beneficiary Account RPCs
-- -----------------------------------------------------------------------------

-- 3.1 Create Beneficiary Account Draft
create or replace function customer_api.create_beneficiary_account_draft_v1(
  p_context_id uuid,
  p_property_id uuid,
  p_bank_account_id uuid,
  p_association_legal_name text,
  p_bank_name text,
  p_currency text,
  p_iban text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, platform, identity, portfolio, audit
as $$
declare
  v record;
  v_norm_iban text;
  v_masked_iban text;
  v_fingerprint text;
  v_version integer;
  v_draft payments.beneficiary_accounts;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if lower(v.role_code) not in ('association_admin', 'property_manager') then
    raise exception 'payment_permission_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  if p_property_id is not null and not exists (
    select 1 from portfolio.properties where id = p_property_id and tenant_id = v.tenant_id
  ) then
    raise exception 'property_not_found_or_access_denied' using errcode = '42501';
  end if;

  if p_bank_account_id is not null and not exists (
    select 1 from payments.bank_accounts where id = p_bank_account_id and tenant_id = v.tenant_id
  ) then
    raise exception 'bank_account_not_found' using errcode = '22023';
  end if;

  select o_normalized, o_masked, o_fingerprint
  into v_norm_iban, v_masked_iban, v_fingerprint
  from payments.validate_and_mask_iban(p_iban);

  select coalesce(max(version), 0) + 1 into v_version
  from payments.beneficiary_accounts
  where tenant_id = v.tenant_id
    and coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_property_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and currency = coalesce(p_currency, 'RON');

  insert into payments.beneficiary_accounts (
    tenant_id,
    property_id,
    association_legal_name,
    bank_account_id,
    bank_name,
    currency,
    masked_iban,
    iban_fingerprint,
    status,
    version,
    created_by
  ) values (
    v.tenant_id,
    p_property_id,
    trim(p_association_legal_name),
    p_bank_account_id,
    trim(p_bank_name),
    coalesce(p_currency, 'RON'),
    v_masked_iban,
    v_fingerprint,
    'draft',
    v_version,
    auth.uid()
  ) returning * into v_draft;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BENEFICIARY_DRAFT_CREATED', 'payments.beneficiary_account', v_draft.id,
    jsonb_build_object(
      'id', v_draft.id,
      'version', v_draft.version,
      'masked_iban', v_draft.masked_iban,
      'currency', v_draft.currency,
      'status', v_draft.status
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'beneficiary_account', jsonb_build_object(
      'id', v_draft.id,
      'version', v_draft.version,
      'association_legal_name', v_draft.association_legal_name,
      'bank_name', v_draft.bank_name,
      'masked_iban', v_draft.masked_iban,
      'currency', v_draft.currency,
      'status', v_draft.status,
      'created_at', v_draft.created_at
    )
  );
end;
$$;

-- 3.2 Submit Beneficiary Account Draft for Approval
create or replace function customer_api.submit_beneficiary_account_for_approval_v1(
  p_context_id uuid,
  p_beneficiary_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, platform, identity, audit
as $$
declare
  v record;
  v_draft payments.beneficiary_accounts;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select * into v_draft
  from payments.beneficiary_accounts
  where id = p_beneficiary_id and tenant_id = v.tenant_id
  for update;

  if not found then
    raise exception 'beneficiary_account_not_found' using errcode = '22023';
  end if;

  if v_draft.status <> 'draft' then
    raise exception 'beneficiary_not_in_draft_status' using errcode = '22023';
  end if;

  update payments.beneficiary_accounts
  set status = 'pending_approval',
      submitted_at = statement_timestamp(),
      submitted_by = auth.uid()
  where id = v_draft.id
  returning * into v_draft;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BENEFICIARY_SUBMITTED_FOR_APPROVAL', 'payments.beneficiary_account', v_draft.id,
    jsonb_build_object(
      'id', v_draft.id,
      'version', v_draft.version,
      'status', v_draft.status,
      'submitted_at', v_draft.submitted_at
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'beneficiary_account', jsonb_build_object(
      'id', v_draft.id,
      'version', v_draft.version,
      'status', v_draft.status,
      'submitted_at', v_draft.submitted_at
    )
  );
end;
$$;

-- 3.3 Approve Beneficiary Account (Strict Dual-Control Enforcement)
create or replace function customer_api.approve_beneficiary_account_v1(
  p_context_id uuid,
  p_beneficiary_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, platform, identity, audit
as $$
declare
  v record;
  v_draft payments.beneficiary_accounts;
  v_active payments.beneficiary_accounts;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select * into v_draft
  from payments.beneficiary_accounts
  where id = p_beneficiary_id and tenant_id = v.tenant_id
  for update;

  if not found then
    raise exception 'beneficiary_account_not_found' using errcode = '22023';
  end if;

  if v_draft.status <> 'pending_approval' then
    raise exception 'beneficiary_not_pending_approval' using errcode = '22023';
  end if;

  -- Dual control separation of duty: Creator cannot approve own version
  if v_draft.created_by = auth.uid() then
    raise exception 'dual_control_violation_creator_cannot_approve' using errcode = '42501';
  end if;

  -- Submitter cannot approve
  if v_draft.submitted_by is not null and v_draft.submitted_by = auth.uid() then
    raise exception 'dual_control_violation_submitter_cannot_approve' using errcode = '42501';
  end if;

  -- Lock and supersede currently active beneficiary account for this property/currency
  for v_active in
    select * from payments.beneficiary_accounts
    where tenant_id = v.tenant_id
      and coalesce(property_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(v_draft.property_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and currency = v_draft.currency
      and status = 'active'
    for update
  loop
    update payments.beneficiary_accounts
    set status = 'superseded',
        revoked_at = statement_timestamp(),
        revoked_by = auth.uid(),
        revocation_reason = 'Superseded by approved version ' || v_draft.version::text
    where id = v_active.id;

    insert into audit.events (
      tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
    ) values (
      v.tenant_id, auth.uid(), v.role_code, 'BENEFICIARY_SUPERSEDED', 'payments.beneficiary_account', v_active.id,
      jsonb_build_object('id', v_active.id, 'superseded_by', v_draft.id, 'version', v_active.version),
      statement_timestamp()
    );
  end loop;

  -- Activate the newly approved account
  update payments.beneficiary_accounts
  set status = 'active',
      approved_at = statement_timestamp(),
      approved_by = auth.uid(),
      verified_at = statement_timestamp(),
      verified_by = auth.uid()
  where id = v_draft.id
  returning * into v_draft;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BENEFICIARY_APPROVED_ACTIVATED', 'payments.beneficiary_account', v_draft.id,
    jsonb_build_object(
      'id', v_draft.id,
      'version', v_draft.version,
      'status', v_draft.status,
      'approved_at', v_draft.approved_at,
      'approved_by', v_draft.approved_by
    ),
    statement_timestamp()
  );

  return jsonb_build_object(
    'beneficiary_account', jsonb_build_object(
      'id', v_draft.id,
      'version', v_draft.version,
      'status', v_draft.status,
      'approved_at', v_draft.approved_at,
      'masked_iban', v_draft.masked_iban,
      'currency', v_draft.currency
    )
  );
end;
$$;

-- 3.4 Reject Beneficiary Account
create or replace function customer_api.reject_beneficiary_account_v1(
  p_context_id uuid,
  p_beneficiary_id uuid,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, platform, identity, audit
as $$
declare
  v record;
  v_draft payments.beneficiary_accounts;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select * into v_draft
  from payments.beneficiary_accounts
  where id = p_beneficiary_id and tenant_id = v.tenant_id
  for update;

  if not found then
    raise exception 'beneficiary_account_not_found' using errcode = '22023';
  end if;

  if v_draft.status <> 'pending_approval' then
    raise exception 'beneficiary_not_pending_approval' using errcode = '22023';
  end if;

  if v_draft.created_by = auth.uid() then
    raise exception 'dual_control_violation_creator_cannot_reject' using errcode = '42501';
  end if;

  update payments.beneficiary_accounts
  set status = 'rejected',
      rejected_at = statement_timestamp(),
      rejected_by = auth.uid(),
      rejection_reason = coalesce(p_rejection_reason, 'Rejected by authorized manager')
  where id = v_draft.id
  returning * into v_draft;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BENEFICIARY_REJECTED', 'payments.beneficiary_account', v_draft.id,
    jsonb_build_object('id', v_draft.id, 'status', v_draft.status, 'rejection_reason', v_draft.rejection_reason),
    statement_timestamp()
  );

  return jsonb_build_object(
    'beneficiary_account', jsonb_build_object(
      'id', v_draft.id,
      'status', v_draft.status,
      'rejected_at', v_draft.rejected_at
    )
  );
end;
$$;

-- 3.5 Revoke Beneficiary Account
create or replace function customer_api.revoke_beneficiary_account_v1(
  p_context_id uuid,
  p_beneficiary_id uuid,
  p_revocation_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, platform, identity, audit
as $$
declare
  v record;
  v_acc payments.beneficiary_accounts;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  select * into v_acc
  from payments.beneficiary_accounts
  where id = p_beneficiary_id and tenant_id = v.tenant_id
  for update;

  if not found then
    raise exception 'beneficiary_account_not_found' using errcode = '22023';
  end if;

  if v_acc.status <> 'active' then
    raise exception 'beneficiary_not_active' using errcode = '22023';
  end if;

  update payments.beneficiary_accounts
  set status = 'revoked',
      revoked_at = statement_timestamp(),
      revoked_by = auth.uid(),
      revocation_reason = coalesce(p_revocation_reason, 'Revoked by authorized manager')
  where id = v_acc.id
  returning * into v_acc;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'BENEFICIARY_REVOKED', 'payments.beneficiary_account', v_acc.id,
    jsonb_build_object('id', v_acc.id, 'status', v_acc.status, 'revocation_reason', v_acc.revocation_reason),
    statement_timestamp()
  );

  return jsonb_build_object(
    'beneficiary_account', jsonb_build_object(
      'id', v_acc.id,
      'status', v_acc.status,
      'revoked_at', v_acc.revoked_at
    )
  );
end;
$$;

-- 3.6 Configure Payment Allocation Policy
create or replace function customer_api.configure_payment_allocation_policy_v1(
  p_context_id uuid,
  p_strategy payments.payment_allocation_strategy default 'oldest_due_first',
  p_penalties_priority payments.penalties_priority default 'principal_first',
  p_min_partial_amount numeric default 1.00,
  p_overpayment_handling text default 'credit_balance',
  p_credit_balance_handling text default 'apply_to_next',
  p_approval_reference text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, platform, identity, audit
as $$
declare
  v record;
  v_version integer;
  v_policy payments.payment_allocation_policies;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;
  if app_private.customer_mfa_required() and coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) then
    raise exception 'payment_permission_required' using errcode = '42501';
  end if;

  if p_min_partial_amount is null or p_min_partial_amount <= 0 then
    raise exception 'invalid_min_partial_amount' using errcode = '22023';
  end if;

  -- Close existing active policies
  update payments.payment_allocation_policies
  set effective_to = statement_timestamp()
  where tenant_id = v.tenant_id
    and (effective_to is null or effective_to > statement_timestamp());

  select coalesce(max(version), 0) + 1 into v_version
  from payments.payment_allocation_policies
  where tenant_id = v.tenant_id;

  insert into payments.payment_allocation_policies (
    tenant_id,
    version,
    strategy,
    penalties_priority,
    min_partial_amount,
    overpayment_handling,
    credit_balance_handling,
    effective_from,
    approved_by,
    approval_reference,
    legal_review_status
  ) values (
    v.tenant_id,
    v_version,
    p_strategy,
    p_penalties_priority,
    p_min_partial_amount,
    coalesce(p_overpayment_handling, 'credit_balance'),
    coalesce(p_credit_balance_handling, 'apply_to_next'),
    statement_timestamp(),
    auth.uid(),
    coalesce(p_approval_reference, 'AG-DECISION-' || to_char(current_date, 'YYYYMMDD')),
    'approved'
  ) returning * into v_policy;

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
  ) values (
    v.tenant_id, auth.uid(), v.role_code, 'POLICY_CONFIGURED', 'payments.payment_allocation_policy', v_policy.id,
    row_to_json(v_policy)::jsonb,
    statement_timestamp()
  );

  return jsonb_build_object(
    'payment_allocation_policy', row_to_json(v_policy)::jsonb
  );
end;
$$;

-- 3.7 List Payment Configuration (Projection Filtered for Residents vs Managers)
create or replace function customer_api.list_payment_configuration_v1(
  p_context_id uuid,
  p_property_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, platform, identity
as $$
declare
  v record;
  v_is_manager boolean;
  v_policy jsonb;
  v_beneficiaries jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active';

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  select exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code in ('payments.manage')
  ) into v_is_manager;

  -- Active policy
  select row_to_json(p)::jsonb into v_policy
  from payments.payment_allocation_policies p
  where p.tenant_id = v.tenant_id
    and p.effective_from <= statement_timestamp()
    and (p.effective_to is null or p.effective_to > statement_timestamp())
  order by p.version desc limit 1;

  -- Beneficiary accounts projection:
  -- Managers can see draft / pending / active / superseded / revoked
  -- Residents / owners ONLY see active accounts
  if v_is_manager then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id,
      'property_id', b.property_id,
      'version', b.version,
      'association_legal_name', b.association_legal_name,
      'bank_name', b.bank_name,
      'currency', b.currency,
      'masked_iban', b.masked_iban,
      'status', b.status,
      'created_at', b.created_at,
      'approved_at', b.approved_at,
      'rejection_reason', b.rejection_reason,
      'revocation_reason', b.revocation_reason
    ) order by b.version desc), '[]'::jsonb)
    into v_beneficiaries
    from payments.beneficiary_accounts b
    where b.tenant_id = v.tenant_id
      and (p_property_id is null or b.property_id is null or b.property_id = p_property_id);
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id,
      'property_id', b.property_id,
      'version', b.version,
      'association_legal_name', b.association_legal_name,
      'bank_name', b.bank_name,
      'currency', b.currency,
      'masked_iban', b.masked_iban,
      'status', b.status
    ) order by b.version desc), '[]'::jsonb)
    into v_beneficiaries
    from payments.beneficiary_accounts b
    where b.tenant_id = v.tenant_id
      and b.status = 'active'
      and (p_property_id is null or b.property_id is null or b.property_id = p_property_id);
  end if;

  return jsonb_build_object(
    'payment_allocation_policy', v_policy,
    'beneficiary_accounts', v_beneficiaries
  );
end;
$$;

-- 4. Payment Intent Creation with Full Immutable Snapshot
-- -----------------------------------------------------------------------------

create or replace function customer_api.create_payment_intent_v1(
  p_context_id uuid,
  p_unit_id uuid,
  p_invoices jsonb default '[]'::jsonb,
  p_amount numeric default null,
  p_currency text default 'RON',
  p_payment_method text default 'bank_transfer',
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, billing, portfolio, platform, identity
as $$
declare
  v record;
  v_workspace uuid;
  v_existing payments.payment_intents;
  v_property_id uuid;
  v_debtor_party_id uuid;
  v_party uuid;
  v_policy payments.payment_allocation_policies;
  v_beneficiary payments.beneficiary_accounts;
  v_total_outstanding numeric;
  v_client_ref text;
  v_intent_id uuid;
  v_invoices_snapshot jsonb;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  select w.id into v_workspace
  from platform.customer_workspaces w
  where w.tenant_id = v.tenant_id and w.lifecycle_status = 'ACTIVE'
  order by w.id limit 1;

  if v_workspace is null or not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_workspace and e.entitlement_key = 'module.payments'
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
                then e.override_value_json = 'true'::jsonb else e.boolean_value is true end)
  ) then
    raise exception 'payments_entitlement_required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code = 'payments.intents.create'
  ) then
    raise exception 'payments_permission_required' using errcode = '42501';
  end if;

  -- Idempotency check
  select * into v_existing
  from payments.payment_intents
  where tenant_id = v.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    return jsonb_build_object(
      'payment_intent_id', v_existing.id,
      'status', v_existing.status,
      'amount', v_existing.amount,
      'currency', v_existing.currency,
      'client_reference', v_existing.client_reference,
      'is_idempotent_replay', true
    );
  end if;

  -- Unit existence & debtor resolution
  select b.property_id, coalesce(
    (select o.party_id from portfolio.ownerships o where o.tenant_id = v.tenant_id and o.unit_id = u.id and o.valid_from <= current_date and (o.valid_to is null or o.valid_to > current_date) limit 1),
    (select inv.liable_party_id from billing.invoices inv where inv.tenant_id = v.tenant_id and inv.unit_id = u.id order by inv.period_end desc limit 1)
  ) into v_property_id, v_debtor_party_id
  from portfolio.units u
  join portfolio.buildings b on b.id = u.building_id
  where u.id = p_unit_id and u.tenant_id = v.tenant_id;

  if not found or v_property_id is null or v_debtor_party_id is null then
    raise exception 'unit_debtor_unresolvable' using errcode = '22023';
  end if;

  select mp.party_id into v_party
  from identity.membership_parties mp
  where mp.membership_id = v.membership_key and mp.tenant_id = v.tenant_id;

  -- Active policy check (fail-closed)
  select * into v_policy
  from payments.payment_allocation_policies
  where tenant_id = v.tenant_id
    and effective_from <= statement_timestamp()
    and (effective_to is null or effective_to > statement_timestamp())
  order by version desc limit 1;

  if not found then
    raise exception 'payment_allocation_policy_unconfigured' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'invalid_payment_amount' using errcode = '22023';
  end if;

  if p_amount < v_policy.min_partial_amount then
    raise exception 'amount_below_policy_minimum' using errcode = '22023';
  end if;

  -- Active Beneficiary check (fail-closed if no ACTIVE beneficiary)
  select * into v_beneficiary
  from payments.beneficiary_accounts
  where tenant_id = v.tenant_id
    and (property_id = v_property_id or property_id is null)
    and currency = coalesce(p_currency, 'RON')
    and status = 'active'
  order by property_id nulls last limit 1;

  if not found then
    raise exception 'beneficiary_account_unconfigured' using errcode = '42501';
  end if;

  -- Outstanding invoices snapshot
  select coalesce(sum(r.outstanding_amount), 0)
  into v_total_outstanding
  from billing.invoices inv
  join billing.receivables r on r.invoice_id = inv.id
  where inv.tenant_id = v.tenant_id and inv.unit_id = p_unit_id and inv.status <> 'void';

  if p_amount > v_total_outstanding and v_policy.overpayment_handling = 'reject' then
    raise exception 'overpayment_rejected_by_policy' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'invoice_id', inv.id,
    'invoice_no', inv.invoice_no,
    'receivable_id', r.id,
    'original_amount', r.original_amount,
    'outstanding_amount', r.outstanding_amount,
    'due_on', inv.due_on
  )), '[]'::jsonb)
  into v_invoices_snapshot
  from billing.invoices inv
  join billing.receivables r on r.invoice_id = inv.id
  where inv.tenant_id = v.tenant_id and inv.unit_id = p_unit_id and r.outstanding_amount > 0;

  v_client_ref := 'PAY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  insert into payments.payment_intents (
    tenant_id,
    property_id,
    unit_id,
    payer_user_id,
    payer_party_id,
    debtor_party_id,
    amount,
    currency,
    provider_code,
    payment_method,
    idempotency_key,
    client_reference,
    beneficiary_snapshot,
    allocation_policy_snapshot,
    selected_invoices_snapshot,
    configuration_snapshot,
    configuration_version,
    status
  ) values (
    v.tenant_id,
    v_property_id,
    p_unit_id,
    auth.uid(),
    v_party,
    v_debtor_party_id,
    p_amount,
    coalesce(p_currency, 'RON'),
    'unconfigured',
    coalesce(p_payment_method, 'bank_transfer'),
    p_idempotency_key,
    v_client_ref,
    jsonb_build_object(
      'beneficiary_id', v_beneficiary.id,
      'association_legal_name', v_beneficiary.association_legal_name,
      'bank_name', v_beneficiary.bank_name,
      'masked_iban', v_beneficiary.masked_iban,
      'iban_fingerprint', v_beneficiary.iban_fingerprint,
      'currency', v_beneficiary.currency,
      'version', v_beneficiary.version
    ),
    row_to_json(v_policy)::jsonb,
    v_invoices_snapshot,
    jsonb_build_object(
      'beneficiary_account_id', v_beneficiary.id,
      'beneficiary_version', v_beneficiary.version,
      'policy_id', v_policy.id,
      'policy_version', v_policy.version,
      'captured_at', statement_timestamp()
    ),
    v_beneficiary.version,
    'created'
  )
  returning id into v_intent_id;

  return jsonb_build_object(
    'payment_intent_id', v_intent_id,
    'status', 'created',
    'amount', p_amount,
    'currency', coalesce(p_currency, 'RON'),
    'client_reference', v_client_ref,
    'is_idempotent_replay', false
  );
end;
$$;

-- 5. Canonical Webhook Ingestion & Atomic Double-Entry Settlement
-- -----------------------------------------------------------------------------

create or replace function payments.process_webhook_event_v1(
  p_provider_code text,
  p_provider_event_id text,
  p_event_type text,
  p_payload_hash text,
  p_payload jsonb,
  p_tenant_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, billing, finance, portfolio, audit
as $$
declare
  v_intent_id uuid;
  v_intent payments.payment_intents;
  v_tenant_id uuid;
  v_receipt payments.webhook_receipts;
  v_beneficiary payments.beneficiary_accounts;
  v_bank_gl_id uuid;
  v_ar_gl_id uuid;
  v_clearing_gl_id uuid;
  v_settled_at timestamptz;
  v_amount numeric(20,4);
  v_currency text;
  v_journal_id uuid;
  v_journal_no bigint;
  v_payment_id uuid;
  v_settlement_id uuid;
  v_inv record;
  v_remaining numeric(20,4);
  v_alloc_amount numeric(20,4);
  v_total_allocated numeric(20,4) := 0;
  v_unallocated numeric(20,4) := 0;
  v_alloc_id uuid;
begin
  -- 5.1 Resolve Intent directly from payload reference without trusting header tenant
  v_intent_id := (p_payload->>'payment_intent_id')::uuid;
  if v_intent_id is null and (p_payload->>'client_reference') is not null then
    select id into v_intent_id from payments.payment_intents
    where client_reference = trim(p_payload->>'client_reference');
  end if;

  if v_intent_id is null then
    return jsonb_build_object('status', 'ignored', 'reason', 'missing_payment_intent_id');
  end if;

  -- 5.2 Row lock target Payment Intent
  select * into v_intent
  from payments.payment_intents
  where id = v_intent_id
  for update;

  if not found then
    return jsonb_build_object('status', 'failed', 'reason', 'intent_not_found');
  end if;

  v_tenant_id := v_intent.tenant_id;

  -- Enforce untrusted tenant isolation
  if p_tenant_id is not null and p_tenant_id <> v_tenant_id then
    raise exception 'untrusted_tenant_boundary_violation' using errcode = '42501';
  end if;

  -- 5.3 Webhook Receipt Idempotency
  select * into v_receipt
  from payments.webhook_receipts
  where tenant_id = v_tenant_id
    and provider_code = p_provider_code
    and provider_event_id = p_provider_event_id;

  if found then
    return jsonb_build_object(
      'status', 'ignored',
      'reason', 'duplicate_event',
      'receipt_id', v_receipt.id
    );
  end if;

  insert into payments.webhook_receipts (
    tenant_id,
    provider_code,
    provider_event_id,
    event_type,
    payload_hash,
    raw_payload_sanitized,
    processing_status
  ) values (
    v_tenant_id,
    p_provider_code,
    p_provider_event_id,
    p_event_type,
    p_payload_hash,
    p_payload,
    'received'
  ) returning * into v_receipt;

  -- 5.4 Fail-closed Reversal & Chargeback boundary
  if p_event_type in ('payment.refunded', 'payment.chargeback', 'refund.created') then
    update payments.payment_intents
    set status = 'requires_review',
        failure_category = 'DEFERRED-PAYMENT-REVERSAL-PROVIDER',
        updated_at = statement_timestamp()
    where id = v_intent.id;

    update payments.webhook_receipts
    set processing_status = 'deferred', error_details = 'DEFERRED-PAYMENT-REVERSAL-PROVIDER'
    where id = v_receipt.id;

    return jsonb_build_object('status', 'deferred', 'reason', 'DEFERRED-PAYMENT-REVERSAL-PROVIDER');
  end if;

  -- 5.5 Terminal state immutability for settlement events
  if v_intent.status in ('succeeded', 'settled', 'cancelled', 'expired') then
    update payments.webhook_receipts
    set processing_status = 'ignored', error_details = 'intent_already_terminal'
    where id = v_receipt.id;

    return jsonb_build_object('status', 'ignored', 'reason', 'intent_already_terminal');
  end if;

  -- 5.6 Fail-closed check: verify associated beneficiary is NOT revoked
  select * into v_beneficiary
  from payments.beneficiary_accounts
  where id = (v_intent.beneficiary_snapshot->>'beneficiary_id')::uuid;

  if not found or v_beneficiary.status = 'revoked' then
    update payments.payment_intents
    set status = 'requires_review',
        failure_category = 'beneficiary_revoked',
        updated_at = statement_timestamp()
    where id = v_intent.id;

    update payments.webhook_receipts
    set processing_status = 'failed', error_details = 'beneficiary_revoked'
    where id = v_receipt.id;

    return jsonb_build_object('status', 'requires_review', 'reason', 'beneficiary_revoked');
  end if;

  -- 5.7 Amount & currency validation
  v_amount := (p_payload->>'amount')::numeric(20,4);
  v_currency := coalesce(p_payload->>'currency', 'RON');

  if v_amount is null or v_amount <> v_intent.amount or v_currency <> v_intent.currency then
    update payments.payment_intents
    set status = 'requires_review',
        failure_category = 'amount_or_currency_mismatch',
        updated_at = statement_timestamp()
    where id = v_intent.id;

    update payments.webhook_receipts
    set processing_status = 'failed', error_details = 'amount_or_currency_mismatch'
    where id = v_receipt.id;

    return jsonb_build_object('status', 'requires_review', 'reason', 'amount_or_currency_mismatch');
  end if;

  -- 5.8 Succeeded / Checkout Completed Event Handling
  if p_event_type in ('payment.succeeded', 'checkout.completed') then
    v_settled_at := statement_timestamp();

    -- Open accounting period assertion (reject closed period)
    perform finance.assert_scope_date_not_in_closed_period(v_tenant_id, v_intent.property_id, v_settled_at::date);

    -- Select Bank GL Account (5121)
    select id into v_bank_gl_id from finance.accounts
    where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
      and (code = '5121' or code like '512%' or code like '531%') and status = 'active'
    order by (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;

    if v_bank_gl_id is null then
      raise exception 'bank_gl_account_not_found' using errcode = '22023';
    end if;

    -- Select AR GL Account (4111)
    select id into v_ar_gl_id from finance.accounts
    where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
      and (code = '4111' or code like '411%') and status = 'active'
    order by (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;

    if v_ar_gl_id is null then
      raise exception 'ar_gl_account_not_found' using errcode = '22023';
    end if;

    -- Select Clearing GL Account (419 Customer Advances)
    select id into v_clearing_gl_id from finance.accounts
    where tenant_id = v_tenant_id and (property_id is null or property_id = v_intent.property_id)
      and (code = '419' or code like '419%' or code = '473' or code like '473%') and status = 'active'
    order by (case when code = '419' or code like '419%' then 0 else 1 end),
             (case when property_id = v_intent.property_id then 0 else 1 end), code limit 1;

    if v_clearing_gl_id is null then
      raise exception 'clearing_gl_account_not_found' using errcode = '22023';
    end if;

    -- Compute invoice allocations (S = A + U)
    v_remaining := v_amount;
    v_total_allocated := 0;

    for v_inv in
      select inv.id as invoice_id, inv.invoice_no, r.id as receivable_id, r.outstanding_amount
      from billing.invoices inv
      join billing.receivables r on r.invoice_id = inv.id
      where inv.tenant_id = v_tenant_id
        and inv.unit_id = v_intent.unit_id
        and r.outstanding_amount > 0
        and inv.status <> 'void'
      order by inv.due_on asc, inv.invoice_no asc
      for update of r
    loop
      if v_remaining <= 0 then exit; end if;
      v_alloc_amount := least(v_remaining, v_inv.outstanding_amount);
      if v_alloc_amount > 0 then
        v_total_allocated := v_total_allocated + v_alloc_amount;
        v_remaining := v_remaining - v_alloc_amount;
      end if;
    end loop;

    v_unallocated := v_amount - v_total_allocated;

    -- 5.8.1 Atomic compound journal posting:
    -- Dr 5121 (Bank) = S
    -- Cr 4111 (AR) = A
    -- Cr 419  (Advances) = U
    -- Total Dr = Total Cr = S
    v_settlement_id := gen_random_uuid();
    v_journal_id := gen_random_uuid();

    insert into finance.journals (
      id, tenant_id, property_id, occurred_on, currency, description, source_type, source_id, status
    ) values (
      v_journal_id, v_tenant_id, v_intent.property_id, v_settled_at::date, v_currency,
      'Direct association payment settlement: ' || v_intent.client_reference,
      'payments.settlement', v_settlement_id, 'draft'
    ) returning journal_no into v_journal_no;

    -- Dr 5121 Bank for total settlement S
    insert into finance.journal_entries (
      tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
    ) values (
      v_tenant_id, v_journal_id, v_bank_gl_id, v_intent.unit_id, v_intent.payer_party_id,
      'debit', v_amount, 'Direct settlement bank receipt: ' || v_intent.client_reference
    );

    -- Cr 4111 Receivables for allocated amount A
    if v_total_allocated > 0 then
      insert into finance.journal_entries (
        tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
      ) values (
        v_tenant_id, v_journal_id, v_ar_gl_id, v_intent.unit_id, v_intent.debtor_party_id,
        'credit', v_total_allocated, 'Bill receivables cleared: ' || v_intent.client_reference
      );
    end if;

    -- Cr 419 Customer Advances for unallocated excess U
    if v_unallocated > 0 then
      insert into finance.journal_entries (
        tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo
      ) values (
        v_tenant_id, v_journal_id, v_clearing_gl_id, v_intent.unit_id, v_intent.payer_party_id,
        'credit', v_unallocated, 'Unallocated advance clearing balance: ' || v_intent.client_reference
      );
    end if;

    -- Post the journal
    update finance.journals
    set status = 'posted',
        posted_at = statement_timestamp()
    where id = v_journal_id;

    -- 5.8.2 Insert canonical Payment record (status: settled)
    v_payment_id := gen_random_uuid();
    insert into payments.payments (
      id,
      tenant_id,
      property_id,
      unit_id,
      payer_party_id,
      amount,
      currency,
      paid_at,
      status,
      method,
      provider_ref,
      description,
      idempotency_key,
      journal_id,
      payment_intent_id,
      clearing_account_id
    ) values (
      v_payment_id,
      v_tenant_id,
      v_intent.property_id,
      v_intent.unit_id,
      v_intent.payer_party_id,
      v_amount,
      v_currency,
      v_settled_at,
      'settled',
      v_intent.payment_method,
      p_provider_event_id,
      'Settled Direct Checkout: ' || v_intent.client_reference,
      v_intent.idempotency_key,
      v_journal_id,
      v_intent.id,
      v_clearing_gl_id
    );

    -- 5.8.3 Insert Settlement Record (bound to payment_id and journal_id)
    insert into payments.settlements (
      id,
      tenant_id,
      payment_intent_id,
      beneficiary_account_id,
      settlement_reference,
      amount,
      currency,
      settled_at,
      payment_id,
      journal_id
    ) values (
      v_settlement_id,
      v_tenant_id,
      v_intent.id,
      v_beneficiary.id,
      'SETTLE-' || v_intent.client_reference,
      v_amount,
      v_currency,
      v_settled_at,
      v_payment_id,
      v_journal_id
    );

    -- 5.8.4 Execute allocations and update receivables via canonical path
    v_remaining := v_amount;
    for v_inv in
      select inv.id as invoice_id, inv.invoice_no, r.id as receivable_id, r.outstanding_amount, r.paid_amount, r.original_amount, r.credited_amount
      from billing.invoices inv
      join billing.receivables r on r.invoice_id = inv.id
      where inv.tenant_id = v_tenant_id
        and inv.unit_id = v_intent.unit_id
        and r.outstanding_amount > 0
        and inv.status <> 'void'
      order by inv.due_on asc, inv.invoice_no asc
      for update of r
    loop
      if v_remaining <= 0 then exit; end if;
      v_alloc_amount := least(v_remaining, v_inv.outstanding_amount);
      if v_alloc_amount > 0 then
        insert into payments.payment_allocations (
          tenant_id,
          payment_id,
          receivable_id,
          amount,
          status,
          idempotency_key,
          journal_id
        ) values (
          v_tenant_id,
          v_payment_id,
          v_inv.receivable_id,
          v_alloc_amount,
          'active',
          'ALLOC-' || v_intent.idempotency_key || '-' || v_inv.receivable_id::text,
          v_journal_id
        ) returning id into v_alloc_id;

        update billing.receivables
        set paid_amount = paid_amount + v_alloc_amount,
            last_payment_at = statement_timestamp(),
            updated_at = statement_timestamp()
        where id = v_inv.receivable_id;

        update billing.invoices
        set status = case
          when (v_inv.original_amount - (v_inv.paid_amount + v_alloc_amount) - v_inv.credited_amount) <= 0 then 'paid'::billing.invoice_status
          else 'partially_paid'::billing.invoice_status
        end,
        updated_at = statement_timestamp()
        where id = v_inv.invoice_id;

        v_remaining := v_remaining - v_alloc_amount;
      end if;
    end loop;

    -- 5.8.5 Mark intent succeeded
    update payments.payment_intents
    set status = 'succeeded',
        settled_at = v_settled_at,
        updated_at = statement_timestamp()
    where id = v_intent.id;

    -- 5.8.6 Mark webhook receipt processed
    update payments.webhook_receipts
    set processing_status = 'processed',
        processed_at = statement_timestamp()
    where id = v_receipt.id;

    insert into audit.events (
      tenant_id, actor_id, actor_role, action, entity_type, entity_id, after_snapshot, occurred_at
    ) values (
      v_tenant_id, null, 'webhook_service', 'SETTLEMENT_PROCESSED_CANONICAL', 'payments.settlement', v_settlement_id,
      jsonb_build_object(
        'payment_intent_id', v_intent.id,
        'payment_id', v_payment_id,
        'journal_id', v_journal_id,
        'journal_no', v_journal_no,
        'amount', v_amount,
        'allocated_amount', v_total_allocated,
        'unallocated_amount', v_unallocated
      ),
      statement_timestamp()
    );

    return jsonb_build_object(
      'status', 'succeeded',
      'payment_intent_id', v_intent.id,
      'payment_id', v_payment_id,
      'journal_id', v_journal_id,
      'journal_no', v_journal_no,
      'settlement_amount', v_amount,
      'allocated_amount', v_total_allocated,
      'unallocated_amount', v_unallocated
    );
  end if;

  return jsonb_build_object('status', 'ignored', 'reason', 'unhandled_event_type');
end;
$$;

-- 6. Permissions and Execution Grants Lockdown
-- -----------------------------------------------------------------------------

-- Drop obsolete Migration 82 signature overload
drop function if exists payments.process_webhook_event_v1(uuid, text, text, text, text, jsonb);

grant usage on schema payments to authenticated, service_role;
grant usage on schema customer_api to authenticated, service_role;

revoke all on function payments.validate_and_mask_iban(text) from public, anon;
grant execute on function payments.validate_and_mask_iban(text) to authenticated, service_role;

revoke all on function customer_api.create_beneficiary_account_draft_v1(uuid, uuid, uuid, text, text, text, text) from public, anon;
grant execute on function customer_api.create_beneficiary_account_draft_v1(uuid, uuid, uuid, text, text, text, text) to authenticated;

revoke all on function customer_api.submit_beneficiary_account_for_approval_v1(uuid, uuid) from public, anon;
grant execute on function customer_api.submit_beneficiary_account_for_approval_v1(uuid, uuid) to authenticated;

revoke all on function customer_api.approve_beneficiary_account_v1(uuid, uuid) from public, anon;
grant execute on function customer_api.approve_beneficiary_account_v1(uuid, uuid) to authenticated;

revoke all on function customer_api.reject_beneficiary_account_v1(uuid, uuid, text) from public, anon;
grant execute on function customer_api.reject_beneficiary_account_v1(uuid, uuid, text) to authenticated;

revoke all on function customer_api.revoke_beneficiary_account_v1(uuid, uuid, text) from public, anon;
grant execute on function customer_api.revoke_beneficiary_account_v1(uuid, uuid, text) to authenticated;

revoke all on function customer_api.configure_payment_allocation_policy_v1(uuid, payments.payment_allocation_strategy, payments.penalties_priority, numeric, text, text, text) from public, anon;
grant execute on function customer_api.configure_payment_allocation_policy_v1(uuid, payments.payment_allocation_strategy, payments.penalties_priority, numeric, text, text, text) to authenticated;

revoke all on function customer_api.list_payment_configuration_v1(uuid, uuid) from public, anon;
grant execute on function customer_api.list_payment_configuration_v1(uuid, uuid) to authenticated;

revoke all on function payments.process_webhook_event_v1(text, text, text, text, jsonb, uuid) from public, anon, authenticated;
grant execute on function payments.process_webhook_event_v1(text, text, text, text, jsonb, uuid) to service_role;

-- Table-level grants protected by RLS
grant select, insert, update on table payments.payment_allocation_policies to authenticated, service_role;
grant select, insert, update on table payments.beneficiary_accounts to authenticated, service_role;
grant select, insert, update on table payments.payment_intents to authenticated, service_role;
grant select, insert, update on table payments.settlements to authenticated, service_role;
grant select, insert, update on table payments.webhook_receipts to authenticated, service_role;
grant select, insert, update on table payments.payments to authenticated, service_role;
grant select, insert, update on table payments.payment_allocations to authenticated, service_role;

commit;
