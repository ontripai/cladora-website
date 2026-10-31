begin;

-- Preserve the existing shared authority contract and ACL. This adds current
-- Context/member validity only; no parallel identity or permission engine.
CREATE OR REPLACE FUNCTION assets.check_asset_caller_v1(p_context_id uuid, p_required_permission text, p_require_aal2 boolean DEFAULT false)
 RETURNS record
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'identity', 'platform'
AS $function$
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

  -- BEGIN current-authority guard: start inclusive, end exclusive.
  if not exists (
    select 1
    from identity.context_grants g
    join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
    where g.id = p_context_id and m.user_id = v_uid and m.status = 'active'
      and g.starts_at <= statement_timestamp()
      and (g.ends_at is null or g.ends_at > statement_timestamp())
      and m.starts_at <= statement_timestamp()
      and (m.ends_at is null or m.ends_at > statement_timestamp())
  ) then
    -- Preserve the established creation/registration temporal-denial message.
    -- This affects error formatting only, never whether permission is granted.
    if p_required_permission = 'assets.manage' then
      raise exception 'asset_context_access_denied' using errcode = '42501';
    end if;
    raise exception 'ACCESS_DENIED: User context invalid or inactive' using errcode = '42501';
  end if;
  -- END current-authority guard.

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
$function$;

commit;
