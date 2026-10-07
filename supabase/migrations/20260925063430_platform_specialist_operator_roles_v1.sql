begin;

-- Keep the verified-account, AAL2 and Super Admin checks intact while allowing specialist roles.
create or replace function customer_api.create_platform_operator_v1(
  p_email text, p_employee_ref text, p_display_name text,
  p_role text, p_reason text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog as $$
declare v_auth_user uuid; v_operator platform.platform_users; v_assignment platform.platform_role_assignments;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if p_role not in ('PLATFORM_OPERATIONS','PLATFORM_FINANCE','PLATFORM_SUPPORT','PLATFORM_AUDITOR','PLATFORM_SALES','PLATFORM_CONTRACTS','PLATFORM_ONBOARDING')
    or length(trim(coalesce(p_employee_ref,''))) < 3 or length(p_employee_ref) > 80
    or length(trim(coalesce(p_display_name,''))) < 3 or length(p_display_name) > 150
    or length(trim(coalesce(p_reason,''))) < 8 or length(p_reason) > 500
    or length(trim(coalesce(p_email,''))) < 5 then
    raise exception 'invalid_operator' using errcode = '22023';
  end if;
  select id into v_auth_user from auth.users
  where lower(email) = lower(trim(p_email)) and email_confirmed_at is not null;
  if v_auth_user is null then
    raise exception 'verified_auth_user_required' using errcode = 'P0002';
  end if;
  insert into platform.platform_users (auth_user_id, employee_ref, display_name, status)
  values (v_auth_user, trim(p_employee_ref), trim(p_display_name), 'active') returning * into v_operator;
  insert into platform.platform_role_assignments (platform_user_id, role, granted_by, grant_reason)
  values (v_operator.id, p_role::platform.platform_role_type, auth.uid(), trim(p_reason)) returning * into v_assignment;
  insert into audit.events (actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (auth.uid(), 'PLATFORM_CONTROL_PLANE', 'PLATFORM_OPERATOR_CREATED', 'platform_user', v_operator.id,
    pg_catalog.jsonb_build_object('role', p_role, 'employee_ref', v_operator.employee_ref), trim(p_reason));
  return pg_catalog.jsonb_build_object('id', v_operator.id, 'role_assignment_id', v_assignment.id);
end $$;

create or replace function customer_api.grant_platform_operator_role_v1(
  p_platform_user_id uuid, p_role text, p_reason text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog as $$
declare v_assignment platform.platform_role_assignments;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if p_role not in ('PLATFORM_OPERATIONS','PLATFORM_FINANCE','PLATFORM_SUPPORT','PLATFORM_AUDITOR','PLATFORM_SALES','PLATFORM_CONTRACTS','PLATFORM_ONBOARDING')
    or length(trim(coalesce(p_reason,''))) < 8 or length(p_reason) > 500 then
    raise exception 'invalid_role_grant' using errcode = '22023';
  end if;
  if not exists (select 1 from platform.platform_users where id = p_platform_user_id and status='active' and deactivated_at is null) then
    raise exception 'operator_not_found' using errcode = 'P0002';
  end if;
  insert into platform.platform_role_assignments (platform_user_id, role, granted_by, grant_reason)
  values (p_platform_user_id, p_role::platform.platform_role_type, auth.uid(), trim(p_reason)) returning * into v_assignment;
  insert into audit.events (actor_id, actor_role, action, entity_type, entity_id, after_snapshot, reason)
  values (auth.uid(), 'PLATFORM_CONTROL_PLANE', 'PLATFORM_ROLE_GRANTED', 'platform_role_assignment', v_assignment.id,
    pg_catalog.jsonb_build_object('platform_user_id',p_platform_user_id,'role',p_role), trim(p_reason));
  return to_jsonb(v_assignment);
end $$;

create or replace function customer_api.revoke_platform_operator_role_v1(
  p_assignment_id uuid, p_reason text
) returns jsonb language plpgsql security definer
set search_path = pg_catalog as $$
declare v_assignment platform.platform_role_assignments;
begin
  perform app_private.assert_control_plane_gateway_access_v1();
  if not app_private.has_platform_role('PLATFORM_SUPER_ADMIN') then
    raise exception 'access_denied' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason,''))) < 8 or length(p_reason) > 500 then
    raise exception 'invalid_revocation_reason' using errcode = '22023';
  end if;
  select * into v_assignment from platform.platform_role_assignments where id=p_assignment_id and status='active' for update;
  if not found or v_assignment.role='PLATFORM_SUPER_ADMIN' then
    raise exception 'role_not_revocable' using errcode='22023';
  end if;
  update platform.platform_role_assignments set status='revoked', revoked_at=statement_timestamp(),
    revoked_by=auth.uid(), revoke_reason=trim(p_reason) where id=p_assignment_id returning * into v_assignment;
  insert into audit.events (actor_id, actor_role, action, entity_type, entity_id, before_snapshot, after_snapshot, reason)
  values (auth.uid(), 'PLATFORM_CONTROL_PLANE', 'PLATFORM_ROLE_REVOKED', 'platform_role_assignment', v_assignment.id,
    pg_catalog.jsonb_build_object('status','active'), pg_catalog.jsonb_build_object('status','revoked'), trim(p_reason));
  return to_jsonb(v_assignment);
end $$;

commit;
