begin;

create index beneficiary_iban_secrets_tenant_id_idx on payments.beneficiary_iban_secrets(tenant_id);

create or replace function app_private.create_beneficiary_account_draft_v1(
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
  if v.scope_type <> 'tenant' and (
    p_property_id is null or p_property_id is distinct from (case
      when v.scope_type = 'property' then v.property_id
      when v.scope_type = 'building' then (select b.property_id from portfolio.buildings b where b.id = v.building_id and b.tenant_id = v.tenant_id)
      else null end)
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

  insert into payments.beneficiary_iban_secrets (tenant_id, beneficiary_id, vault_secret_id)
  values (v.tenant_id, v_draft.id, vault.create_secret(v_norm_iban, 'cladora_beneficiary_' || v_draft.id::text, 'CLADORA approved beneficiary IBAN'));

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

create or replace function app_private.approve_beneficiary_account_v1(
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
  where g.id = p_context_id and m.user_id = auth.uid() and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

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
  if v.scope_type <> 'tenant' and v_draft.property_id is distinct from (case
    when v.scope_type = 'property' then v.property_id
    when v.scope_type = 'building' then (select b.property_id from portfolio.buildings b where b.id = v.building_id and b.tenant_id = v.tenant_id)
    else null end) then
    raise exception 'property_not_found_or_access_denied' using errcode = '42501';
  end if;

  -- Dual control separation of duty: Creator cannot approve own version
  if v_draft.created_by = auth.uid() then
    raise exception 'dual_control_violation_creator_cannot_approve' using errcode = '42501';
  end if;

  -- Submitter cannot approve
  if v_draft.submitted_by is not null and v_draft.submitted_by = auth.uid() then
    raise exception 'dual_control_violation_submitter_cannot_approve' using errcode = '42501';
  end if;

  if not exists (select 1 from payments.beneficiary_iban_secrets s where s.beneficiary_id = v_draft.id and s.tenant_id = v.tenant_id) then
    raise exception 'beneficiary_full_iban_unavailable' using errcode = '42501';
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

create or replace function app_private.list_payment_configuration_v1(
  p_context_id uuid,
  p_property_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, payments, platform, identity, portfolio
as $$
declare
  v record;
  v_is_manager boolean;
  v_policy jsonb;
  v_beneficiaries jsonb;
  v_property_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
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

  v_property_id := case
    when v.scope_type = 'property' then v.property_id
    when v.scope_type = 'building' then (select b.property_id from portfolio.buildings b where b.id = v.building_id and b.tenant_id = v.tenant_id)
    when v.scope_type = 'unit' then (select b.property_id from portfolio.units u join portfolio.buildings b on b.id = u.building_id where u.id = v.unit_id and u.tenant_id = v.tenant_id)
    else null end;
  if v.scope_type <> 'tenant' and (v_property_id is null or (p_property_id is not null and p_property_id <> v_property_id)) then
    raise exception 'property_not_found_or_access_denied' using errcode = '42501';
  end if;
  if p_property_id is not null and not exists (select 1 from portfolio.properties p where p.id = p_property_id and p.tenant_id = v.tenant_id) then
    raise exception 'property_not_found_or_access_denied' using errcode = '42501';
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
      and (b.property_id is null or (v.scope_type = 'tenant' and p_property_id is null) or b.property_id = coalesce(p_property_id, v_property_id));
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
      and (b.property_id is null or (v.scope_type = 'tenant' and p_property_id is null) or b.property_id = coalesce(p_property_id, v_property_id));
  end if;

  return jsonb_build_object(
    'payment_allocation_policy', v_policy,
    'beneficiary_accounts', v_beneficiaries
  );
end;
$$;

-- Preserve the security-invoker Data API boundary.
create or replace function customer_api.create_beneficiary_account_draft_v1(
  p_context_id uuid,p_property_id uuid,p_bank_account_id uuid,
  p_association_legal_name text,p_bank_name text,p_currency text,p_iban text)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.create_beneficiary_account_draft_v1(
  p_context_id,p_property_id,p_bank_account_id,p_association_legal_name,p_bank_name,p_currency,p_iban)$$;
create or replace function customer_api.approve_beneficiary_account_v1(p_context_id uuid,p_beneficiary_id uuid)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.approve_beneficiary_account_v1(p_context_id,p_beneficiary_id)$$;
create or replace function customer_api.list_payment_configuration_v1(p_context_id uuid,p_property_id uuid default null)
returns jsonb language sql volatile security invoker set search_path=pg_catalog
as $$select app_private.list_payment_configuration_v1(p_context_id,p_property_id)$$;
create or replace function customer_api.generate_bank_instruction_v1(p_context_id uuid,p_intent_id uuid)
returns jsonb language sql stable security invoker set search_path=pg_catalog as $$
  -- CLADORA nu este intermediar de plată. Fondurile se transferă direct către contul bancar al asociației.
  select payments.generate_scoped_bank_instruction_v1(p_context_id,p_intent_id);
$$;


commit;
