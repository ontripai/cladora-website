begin;

-- Bind payment creation to the selected, active membership and unit scope.
-- Caller JWT does not carry the selected multi-role tenant context.
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
  v_scope_ok boolean;
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

  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 100 then
    raise exception 'invalid_idempotency_key' using errcode = '22023';
  end if;
  if jsonb_typeof(p_invoices) <> 'array' or exists (
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

  -- Idempotency check
  select * into v_existing
  from payments.payment_intents
  where tenant_id = v.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.payer_user_id is distinct from auth.uid()
      or v_existing.unit_id is distinct from p_unit_id
      or v_existing.amount is distinct from p_amount
      or v_existing.currency is distinct from coalesce(p_currency, 'RON') then
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

revoke all on function customer_api.create_payment_intent_v1(uuid,uuid,jsonb,numeric,text,text,text) from public, anon;
grant execute on function customer_api.create_payment_intent_v1(uuid,uuid,jsonb,numeric,text,text,text) to authenticated, service_role;

commit;
