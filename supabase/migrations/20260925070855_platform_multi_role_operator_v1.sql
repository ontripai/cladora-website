begin;

-- The existing per-role mutations remain the authorization and audit boundary.
-- An exception in any step rolls the entire multi-role request back.
create function customer_api.create_platform_operator_multi_role_v1(
  p_email text, p_employee_ref text, p_display_name text, p_roles text[], p_reason text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_operator jsonb; v_grants jsonb := '[]'::jsonb; v_role text;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if p_roles is null or cardinality(p_roles) not between 1 and 7
    or exists (select 1 from unnest(p_roles) r where r is null)
    or (select count(distinct r) from unnest(p_roles) r) <> cardinality(p_roles) then
    raise exception 'invalid_roles' using errcode = '22023';
  end if;
  v_operator := customer_api.create_platform_operator_v1(
    p_email, p_employee_ref, p_display_name, p_roles[1], p_reason
  );
  v_grants := jsonb_build_array(v_operator->'role_assignment_id');
  if cardinality(p_roles) > 1 then
    foreach v_role in array p_roles[2:cardinality(p_roles)] loop
      v_grants := v_grants || jsonb_build_array(
        customer_api.grant_platform_operator_role_v1((v_operator->>'id')::uuid, v_role, p_reason)->'id'
      );
    end loop;
  end if;
  return jsonb_build_object('id', v_operator->'id', 'role_assignment_ids', v_grants);
end $$;

create function customer_api.grant_platform_operator_roles_v1(
  p_platform_user_id uuid, p_roles text[], p_reason text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_role text; v_grants jsonb := '[]'::jsonb;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if p_roles is null or cardinality(p_roles) not between 1 and 7
    or exists (select 1 from unnest(p_roles) r where r is null)
    or (select count(distinct r) from unnest(p_roles) r) <> cardinality(p_roles) then
    raise exception 'invalid_roles' using errcode = '22023';
  end if;
  if not exists (select 1 from platform.platform_users
    where id=p_platform_user_id and status='active' and deactivated_at is null) then
    raise exception 'operator_not_found' using errcode = 'P0002';
  end if;
  foreach v_role in array p_roles loop
    if v_role not in ('PLATFORM_OPERATIONS','PLATFORM_FINANCE','PLATFORM_SUPPORT',
      'PLATFORM_AUDITOR','PLATFORM_SALES','PLATFORM_CONTRACTS','PLATFORM_ONBOARDING') then
      raise exception 'invalid_role_grant' using errcode = '22023';
    end if;
    if not exists (select 1 from platform.platform_role_assignments
      where platform_user_id=p_platform_user_id and role=v_role::platform.platform_role_type
        and status='active') then
      v_grants := v_grants || jsonb_build_array(
        customer_api.grant_platform_operator_role_v1(p_platform_user_id,v_role,p_reason)->'id'
      );
    end if;
  end loop;
  return jsonb_build_object('platform_user_id',p_platform_user_id,'new_role_assignment_ids',v_grants);
end $$;

revoke all on function customer_api.create_platform_operator_multi_role_v1(text,text,text,text[],text),
  customer_api.grant_platform_operator_roles_v1(uuid,text[],text) from public,anon,service_role;
grant execute on function customer_api.create_platform_operator_multi_role_v1(text,text,text,text[],text),
  customer_api.grant_platform_operator_roles_v1(uuid,text[],text) to authenticated;

commit;
