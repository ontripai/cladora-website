begin;

-- CORE-MOBILE-PAYMENT-SERVER-PROOF-02 / Coordinator R2: one private reader
-- with narrow function EXECUTE; no table/schema grants or RLS changes.
-- Existing function owners/ACLs are preserved; exposed RPCs remain invoker.

create or replace function app_private.create_payment_intent_scoped_v1(
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
  v_lock_tenant uuid;
  v_request_identity jsonb;
  v_authority_at timestamptz;
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
  v_scope_ok boolean;
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- Serialize the tenant-wide UNIQUE key, including the absent-row case.
  -- Derive its tenant only through this actor's membership; hashes can collide
  -- harmlessly (extra serialization), never broaden tenant/actor authority.
  select g.tenant_id into v_lock_tenant
  from identity.context_grants g
  join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid();
  if not found then
    raise exception 'customer_context_access_denied' using errcode='42501';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 100 then
    raise exception 'invalid_idempotency_key' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    v_lock_tenant::text || ':' || p_idempotency_key, 0));
  v_authority_at := clock_timestamp();

  -- Authority is deliberately re-read AFTER waiting for the key. At the
  -- standard READ COMMITTED isolation a committed concurrent intent is visible.
  select g.*, m.id as membership_key, m.role_id, r.code as role_code
  into v
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= v_authority_at and (m.ends_at is null or m.ends_at > v_authority_at)
    and g.starts_at <= v_authority_at and (g.ends_at is null or g.ends_at > v_authority_at);

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  -- This function is privileged because the caller's JWT has no selected tenant
  -- claim. Bind the requested unit to the authenticated, unexpired context
  -- before reading any invoice or inserting an intent.
  select exists (
    select 1 from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id and b.tenant_id = u.tenant_id
    where u.id = p_unit_id and u.tenant_id = v.tenant_id
      and (v.scope_type = 'tenant'
        or (v.scope_type = 'property' and v.property_id = b.property_id)
        or (v.scope_type = 'building' and v.building_id = b.id)
        or (v.scope_type = 'unit' and v.unit_id = u.id))
  ) into v_scope_ok;
  if not v_scope_ok then
    raise exception 'payment_unit_access_denied' using errcode = '42501';
  end if;

  if p_invoices is null or jsonb_typeof(p_invoices) <> 'array' then
    raise exception 'payment_invoice_access_denied' using errcode='42501';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_invoices) selected
    where not exists (
      select 1 from billing.invoices inv
      where inv.id::text = selected->>'invoice_id'
        and inv.tenant_id = v.tenant_id and inv.unit_id = p_unit_id
        and inv.status <> 'void'
    )
  ) then
    raise exception 'payment_invoice_access_denied' using errcode = '42501';
  end if;

  -- 2. Entitlement check via security definer helper
  perform payments.assert_payments_module_entitled(v.tenant_id);

  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v.role_id and rp.effect = 'allow' and p.code = 'payments.intents.create'
  ) then
    raise exception 'payments_permission_required' using errcode = '42501';
  end if;

  -- Persist the request, not the all-outstanding invoice projection below.
  -- JSONB object key order/numeric spelling are immaterial. Sort selection as
  -- a multiset: order is immaterial, but duplicates, amounts and fields count.
  select jsonb_build_object(
    'context_id', p_context_id, 'actor_id', auth.uid(), 'unit_id', p_unit_id,
    'amount', p_amount, 'currency', coalesce(p_currency, 'RON'),
    'method', coalesce(p_payment_method, 'bank_transfer'),
    'invoices', coalesce(jsonb_agg(selected order by selected), '[]'::jsonb)
  ) into v_request_identity from jsonb_array_elements(p_invoices) selected;

  -- Legacy snapshots lack request evidence; never infer equality from them.
  select * into v_existing
  from payments.payment_intents
  where tenant_id = v.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.payer_user_id is distinct from auth.uid()
      or v_existing.unit_id is distinct from p_unit_id
      -- The column is numeric(12,2); raw request precision is preserved and
      -- compared separately in request_identity_v1, without rounding identity.
      or v_existing.amount is distinct from round(p_amount, 2)
      or v_existing.currency is distinct from coalesce(p_currency, 'RON')
      or v_existing.payment_method is distinct from coalesce(p_payment_method, 'bank_transfer')
      or v_existing.configuration_snapshot -> 'request_identity_v1' is distinct from v_request_identity then
      raise exception 'payment_idempotency_conflict' using errcode = '23505';
    end if;
    return jsonb_build_object(
      'payment_intent_id', v_existing.id,
      'status', v_existing.status,
      'amount', v_existing.amount,
      'currency', v_existing.currency,
      'client_reference', v_existing.client_reference,
      'is_idempotent_replay', true
    );
  end if;

  -- Unit existence & debtor resolution via security definer helper
  select r.property_id, r.debtor_party_id, r.payer_party_id
  into v_property_id, v_debtor_party_id, v_party
  from payments.resolve_unit_debtor_party_v1(v.tenant_id, p_unit_id, v.membership_key) r;

  if v_property_id is null or v_debtor_party_id is null then
    raise exception 'unit_debtor_unresolvable' using errcode = '22023';
  end if;

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
      'captured_at', statement_timestamp(),
      'request_identity_v1', v_request_identity
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


CREATE OR REPLACE FUNCTION app_private.read_payment_intent_scoped_v1(
  p_context_id pg_catalog.uuid,
  p_intent_id pg_catalog.uuid
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v RECORD;
  v_intent RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required' USING errcode = '42501';
  END IF;

  -- Reuse the existing customer MFA policy, not caller-selected authority.
  IF app_private.customer_mfa_required() AND coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'mfa_required' USING errcode = '42501';
  END IF;

  SELECT g.tenant_id, g.scope_type, g.property_id, g.building_id, g.unit_id,
         m.role_id, r.code AS role_code
  INTO v
  FROM identity.context_grants g
  JOIN identity.memberships m ON m.id = g.membership_id AND m.tenant_id = g.tenant_id
  JOIN identity.roles r ON r.id = m.role_id
  WHERE g.id = p_context_id
    AND m.user_id = auth.uid()
    AND (r.tenant_id IS NULL OR r.tenant_id=m.tenant_id)
    AND m.status = 'active'
    AND m.starts_at <= pg_catalog.statement_timestamp() AND (m.ends_at IS NULL OR m.ends_at > pg_catalog.statement_timestamp())
    AND g.starts_at <= pg_catalog.statement_timestamp() AND (g.ends_at IS NULL OR g.ends_at > pg_catalog.statement_timestamp());

  IF NOT FOUND THEN
    RAISE EXCEPTION 'customer_context_access_denied' USING errcode = '42501';
  END IF;

  -- Current read authority, independent of historic intent possession.
  -- Legacy first-active-Workspace entitlement lookup is retained. This is
  -- NOT evidence of exact-Workspace authority. No new Workspace is inferred.
  PERFORM payments.assert_payments_module_entitled(v.tenant_id);
  IF NOT EXISTS (
    SELECT 1 FROM identity.role_permissions rp
    JOIN identity.permissions p ON p.id=rp.permission_id
    WHERE rp.role_id=v.role_id AND rp.effect='allow' AND p.code='payments.intents.read'
  ) THEN
    RAISE EXCEPTION 'payments_permission_required' USING errcode='42501';
  END IF;

  SELECT id, tenant_id, property_id, unit_id, payer_user_id, amount, currency,
         status, payment_method, client_reference, beneficiary_snapshot,
         allocation_policy_snapshot, selected_invoices_snapshot, expires_at,
         created_at, settled_at INTO v_intent
  FROM payments.payment_intents
  WHERE id = p_intent_id AND tenant_id = v.tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment_intent_not_found' USING errcode = '22023';
  END IF;

  -- Resident / Owner must match payer or unit
  IF pg_catalog.lower(v.role_code) IN ('owner', 'tenant_resident') AND v_intent.payer_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'payment_intent_access_denied' USING errcode = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM portfolio.units u
    JOIN portfolio.buildings b ON b.id=u.building_id AND b.tenant_id=u.tenant_id
    JOIN portfolio.properties property ON property.id=b.property_id AND property.tenant_id=b.tenant_id
    WHERE u.id=v_intent.unit_id AND u.tenant_id=v.tenant_id
      AND v_intent.property_id=property.id
      AND (v.property_id IS NULL OR v.property_id=property.id)
      AND (v.building_id IS NULL OR v.building_id=b.id)
      AND (v.unit_id IS NULL OR v.unit_id=u.id)
      AND (v.scope_type='tenant'
        OR (v.scope_type='property' AND v.property_id=b.property_id)
        OR (v.scope_type='building' AND v.building_id=b.id)
        OR (v.scope_type='unit' AND v.unit_id=u.id))
  ) THEN
    RAISE EXCEPTION 'payment_unit_access_denied' USING errcode='42501';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'payment_intent_id', v_intent.id,
    'tenant_id', v_intent.tenant_id,
    'property_id', v_intent.property_id,
    'unit_id', v_intent.unit_id,
    'amount', v_intent.amount,
    'currency', v_intent.currency,
    'status', v_intent.status,
    'payment_method', v_intent.payment_method,
    'client_reference', v_intent.client_reference,
    'beneficiary', v_intent.beneficiary_snapshot,
    'allocation_policy', v_intent.allocation_policy_snapshot,
    'selected_invoices', v_intent.selected_invoices_snapshot,
    'expires_at', v_intent.expires_at,
    'created_at', v_intent.created_at,
    'settled_at', v_intent.settled_at
  );
END;
$function$;


-- Fail closed if the migration executor does not already own the scoped creation
-- boundary. Do not assume postgres, transfer ownership, or expand a role's rights.
DO $owner_check$
BEGIN
  IF (SELECT proowner FROM pg_catalog.pg_proc
      WHERE oid='app_private.read_payment_intent_scoped_v1(uuid,uuid)'::pg_catalog.regprocedure)
     IS DISTINCT FROM
     (SELECT proowner FROM pg_catalog.pg_proc
      WHERE oid='app_private.create_payment_intent_scoped_v1(uuid,uuid,jsonb,numeric,text,text,text)'::pg_catalog.regprocedure)
  THEN
    RAISE EXCEPTION 'payment_read_helper_owner_mismatch';
  END IF;
END;
$owner_check$;

REVOKE EXECUTE ON FUNCTION app_private.read_payment_intent_scoped_v1(uuid,uuid) FROM PUBLIC, anon, service_role, authenticated;
GRANT EXECUTE ON FUNCTION app_private.read_payment_intent_scoped_v1(uuid,uuid) TO authenticated;

-- Reject unexpected per-role default ACLs too, without rewriting shared defaults.
DO $acl_check$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_proc p,
      LATERAL pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) acl
    WHERE p.oid='app_private.read_payment_intent_scoped_v1(uuid,uuid)'::pg_catalog.regprocedure
      AND acl.grantee NOT IN (p.proowner, 'authenticated'::pg_catalog.regrole)
  ) OR pg_catalog.has_function_privilege('service_role',
    'app_private.read_payment_intent_scoped_v1(uuid,uuid)','EXECUTE')
    OR NOT pg_catalog.has_schema_privilege('authenticated','app_private','USAGE') THEN
    RAISE EXCEPTION 'payment_read_helper_acl_or_schema_usage_mismatch';
  END IF;
END;
$acl_check$;

CREATE OR REPLACE FUNCTION customer_api.get_payment_intent_v1(
  p_context_id uuid,
  p_intent_id uuid
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog
AS $function$
  SELECT app_private.read_payment_intent_scoped_v1(p_context_id, p_intent_id);
$function$;


create or replace function payments.generate_scoped_bank_instruction_v1(p_context_id uuid,p_intent_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = pg_catalog, payments, identity, portfolio, vault
as $$
declare
  v record;
  v_intent payments.payment_intents;
  v_beneficiary payments.beneficiary_accounts;
  v_iban text;
  v_unit_code text;
  v_debtor_name text;
begin
  -- Reuse current read permission/entitlement checks for the existing instruction
  -- helper too. Its definer/invoker boundary and Vault handling stay unchanged.
  perform customer_api.get_payment_intent_v1(p_context_id, p_intent_id);
  if auth.uid() is null then raise exception 'authentication_required' using errcode='42501'; end if;
  select g.*,m.id membership_key into v
  from identity.context_grants g join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
  where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp());
  if not found then raise exception 'customer_context_access_denied' using errcode='42501'; end if;
  select * into v_intent from payments.payment_intents where id=p_intent_id and tenant_id=v.tenant_id and payer_user_id=auth.uid();
  if not found then raise exception 'payment_intent_not_found' using errcode='22023'; end if;
  select u.code into v_unit_code from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
  where u.id=v_intent.unit_id and u.tenant_id=v.tenant_id and
    (v.scope_type='tenant' or (v.scope_type='property' and v.property_id=b.property_id)
     or (v.scope_type='building' and v.building_id=b.id) or (v.scope_type='unit' and v.unit_id=u.id));
  if not found then raise exception 'payment_unit_access_denied' using errcode='42501'; end if;
  select * into v_beneficiary from payments.beneficiary_accounts
  where id=(v_intent.beneficiary_snapshot->>'beneficiary_id')::uuid and tenant_id=v.tenant_id and status='active';
  if not found then raise exception 'beneficiary_account_unavailable' using errcode='42501'; end if;
  select ds.decrypted_secret into v_iban from payments.beneficiary_iban_secrets s
  join vault.decrypted_secrets ds on ds.id=s.vault_secret_id
  where s.beneficiary_id=v_beneficiary.id and s.tenant_id=v.tenant_id;
  if v_iban is null or encode(extensions.digest(v_iban,'sha256'),'hex') is distinct from v_beneficiary.iban_fingerprint then
    raise exception 'beneficiary_full_iban_unavailable' using errcode='42501';
  end if;
  select pty.legal_name into v_debtor_name from portfolio.parties pty where pty.id = v_intent.debtor_party_id and pty.tenant_id = v.tenant_id;
  return jsonb_build_object('payment_intent_id',v_intent.id,'client_reference',v_intent.client_reference,
    'amount',v_intent.amount,'currency',v_intent.currency,'beneficiary_name',v_beneficiary.association_legal_name,
    'bank_name',v_beneficiary.bank_name,'iban',v_iban,'unit_code',v_unit_code,'legal_debtor',v_debtor_name,
    'remittance_information',v_intent.client_reference || ' / Apt ' || coalesce(v_unit_code,''),
    'notice','CLADORA nu este intermediar de plată. Fondurile se transferă direct către contul bancar al asociației.',
    'expires_at',v_intent.expires_at);
end;
$$;


commit;
