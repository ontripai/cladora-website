begin;

create or replace function app_private.get_my_platform_auth_context_v1()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, platform
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_platform_user platform.platform_users%rowtype;
  v_roles jsonb := '[]'::jsonb;
  v_assignments jsonb := '[]'::jsonb;
  v_has_non_auditor_role boolean := false;
begin
  if v_auth_user_id is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  select pu.*
  into v_platform_user
  from platform.platform_users pu
  where pu.auth_user_id = v_auth_user_id
    and pu.status = 'active'
    and pu.deactivated_at is null
  limit 1;

  if not found then
    return jsonb_build_object(
      'platform_user', null,
      'roles', '[]'::jsonb,
      'assignments', '[]'::jsonb,
      'is_authorized', false
    );
  end if;

  select
    coalesce(jsonb_agg(to_jsonb(pra) order by pra.created_at, pra.id), '[]'::jsonb),
    coalesce(bool_or(pra.role <> 'PLATFORM_AUDITOR'::platform.platform_role_type), false)
  into v_roles, v_has_non_auditor_role
  from platform.platform_role_assignments pra
  where pra.platform_user_id = v_platform_user.id
    and pra.status = 'active'
    and pra.valid_from <= statement_timestamp()
    and (pra.valid_until is null or pra.valid_until > statement_timestamp());

  select coalesce(jsonb_agg(to_jsonb(pca) order by pca.created_at, pca.id), '[]'::jsonb)
  into v_assignments
  from platform.platform_customer_assignments pca
  where pca.platform_user_id = v_platform_user.id
    and pca.status = 'active'
    and pca.valid_from <= statement_timestamp()
    and (pca.valid_until is null or pca.valid_until > statement_timestamp())
    and (v_has_non_auditor_role or pca.scope_type in ('workspace', 'audit'));

  return jsonb_build_object(
    'platform_user', to_jsonb(v_platform_user),
    'roles', v_roles,
    'assignments', v_assignments,
    'is_authorized', jsonb_array_length(v_roles) > 0
  );
end;
$$;

revoke all on function app_private.get_my_platform_auth_context_v1() from public, anon, service_role;
grant execute on function app_private.get_my_platform_auth_context_v1() to authenticated;

create or replace function customer_api.get_my_platform_auth_context_v1()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select app_private.get_my_platform_auth_context_v1();
$$;

revoke all on function customer_api.get_my_platform_auth_context_v1() from public, anon, service_role;
grant execute on function customer_api.get_my_platform_auth_context_v1() to authenticated;

comment on function app_private.get_my_platform_auth_context_v1() is
  'Builds the signed-in caller own Platform authorization context after enforcing AAL2. Bypasses recursive Platform RLS only for this caller-scoped projection.';

comment on function customer_api.get_my_platform_auth_context_v1() is
  'SECURITY INVOKER gateway for the AAL2-only, caller-scoped Platform authorization context.';

commit;
