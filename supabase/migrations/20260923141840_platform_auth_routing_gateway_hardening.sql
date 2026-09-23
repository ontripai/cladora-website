begin;

create or replace function app_private.has_platform_access_for_routing()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, platform
as $$
  select auth.uid() is not null
    and exists (
      select 1
      from platform.platform_users pu
      join platform.platform_role_assignments pra
        on pra.platform_user_id = pu.id
      where pu.auth_user_id = auth.uid()
        and pu.status = 'active'
        and pu.deactivated_at is null
        and pra.status = 'active'
        and pra.valid_from <= statement_timestamp()
        and (pra.valid_until is null or pra.valid_until > statement_timestamp())
    );
$$;

revoke all on function app_private.has_platform_access_for_routing() from public, anon, service_role;
grant execute on function app_private.has_platform_access_for_routing() to authenticated;

create or replace function customer_api.has_platform_access_v1()
returns boolean
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  return app_private.has_platform_access_for_routing();
end;
$$;

revoke all on function customer_api.has_platform_access_v1() from public, anon, service_role;
grant execute on function customer_api.has_platform_access_v1() to authenticated;

comment on function app_private.has_platform_access_for_routing() is
  'Internal caller-scoped Platform routing predicate. It deliberately omits AAL2 so Platform users can be routed to mandatory MFA; it does not authorize Platform data.';

comment on function customer_api.has_platform_access_v1() is
  'SECURITY INVOKER gateway returning only whether the authenticated caller has active Platform access. Platform reads and actions remain protected by AAL2 and role policies.';

commit;
