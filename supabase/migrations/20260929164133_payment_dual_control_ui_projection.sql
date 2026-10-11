begin;

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
      'can_approve', b.status = 'pending_approval' and b.created_by is distinct from auth.uid() and b.submitted_by is distinct from auth.uid(),
      'can_reject', b.status = 'pending_approval' and b.created_by is distinct from auth.uid(),
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

commit;
