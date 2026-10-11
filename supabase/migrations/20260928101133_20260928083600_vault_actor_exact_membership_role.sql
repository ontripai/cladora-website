begin;

-- Authorize only the exact role assigned to this membership. Role codes can
-- recur across tenants with different permission grants.
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
    m.role_id,
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

  if lower(v_rec.role_code) in ('company_staff','vendor_contact') and not exists (
    select 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id
    where u.tenant_id=v_rec.tenant_id and u.status='active'
      and ((v_rec.scope_type='property' and b.property_id=v_rec.property_id)
        or (v_rec.scope_type='building' and b.id=v_rec.building_id)
        or (v_rec.scope_type='unit' and u.id=v_rec.unit_id))
      and communications.member_covers_unit(v_rec.membership_id,v_rec.tenant_id,u.id)
  ) then raise exception 'relationship_expired' using errcode='42501'; end if;

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
    where rp.role_id = v_rec.role_id
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

revoke all on function documents.resolve_vault_actor(uuid,text,boolean) from public,anon,authenticated;

commit;
