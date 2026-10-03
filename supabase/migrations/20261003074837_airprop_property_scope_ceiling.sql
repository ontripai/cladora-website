begin;

-- Stage 1: whole-property configuration requires a whole-property scope.
-- Retains existing AAL2 and identity-role gates. Module/local-role alignment follows separately.
create or replace function app_private.require_airprop_context_v1(p_context_id uuid,p_permission text,p_property_id uuid default null)
returns table(tenant_id uuid,role_code text)
language plpgsql stable security definer set search_path=pg_catalog,identity,portfolio
as $$
begin
 if auth.uid() is null then raise exception 'authentication_required' using errcode='42501';end if;
 if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then raise exception 'mfa_required' using errcode='42501';end if;
 return query
 select g.tenant_id,r.code from identity.context_grants g
 join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
 join identity.roles r on r.id=m.role_id
 join identity.role_permissions rp on rp.role_id=m.role_id and rp.effect='allow'
 join identity.permissions p on p.id=rp.permission_id and p.code=p_permission
 where g.id=p_context_id and m.user_id=auth.uid() and m.status='active'
  and m.starts_at<=statement_timestamp() and(m.ends_at is null or m.ends_at>statement_timestamp())
  and g.starts_at<=statement_timestamp() and(g.ends_at is null or g.ends_at>statement_timestamp())
  and (p_permission <> 'airprop.asset.manage' or (p_property_id is not null and (g.scope_type='tenant' or (g.scope_type='property' and g.property_id=p_property_id))))
  and(p_property_id is null or g.scope_type='tenant' or g.property_id=p_property_id
    or(g.building_id is not null and exists(select 1 from portfolio.buildings b where b.id=g.building_id and b.property_id=p_property_id))
    or(g.unit_id is not null and exists(select 1 from portfolio.units u join portfolio.buildings b on b.id=u.building_id where u.id=g.unit_id and b.property_id=p_property_id)))
 limit 1;
 if not found then raise exception 'airprop_access_denied' using errcode='42501';end if;
end$$;
revoke all on function app_private.require_airprop_context_v1(uuid,text,uuid) from public,anon,authenticated,service_role;


commit;
