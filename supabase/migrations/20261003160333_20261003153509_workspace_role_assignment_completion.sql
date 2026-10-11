begin;

-- Reuse canonical membership, context, assignment and retry stores.
-- This administrative bootstrap keeps the existing v1 context boundary.
create function app_private.require_workspace_role_assignment_context_v1(p_context_id uuid)
returns table(workspace_id uuid,tenant_id uuid,membership_id uuid,role_id uuid,role_code text,status text)
language plpgsql security definer set search_path=pg_catalog
as $$
declare a record;
begin
  select * into a from app_private.resolve_workspace_from_customer_context_v1(p_context_id,true);
  if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    raise exception 'mfa_required' using errcode='42501';
  end if;
  if not exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id
    where rp.role_id=a.role_id and p.code='workspace.role.assign' and rp.effect='allow')
  or exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id=rp.permission_id
    where rp.role_id=a.role_id and p.code='workspace.role.assign' and rp.effect='deny') then
    raise exception 'workspace_role_assign_permission_required' using errcode='42501';
  end if;
  return query select a.workspace_id,a.tenant_id,a.membership_id,a.role_id,a.role_code,a.status;
end;
$$;
revoke all on function app_private.require_workspace_role_assignment_context_v1(uuid) from public,anon,authenticated,service_role;

create function customer_api.list_workspace_role_assignment_candidates_v1(p_context_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog
as $$
declare a record; result jsonb;
begin
  select * into a from app_private.require_workspace_role_assignment_context_v1(p_context_id);
  select coalesce(jsonb_agg(jsonb_build_object('membership_id',m.id,
    'member_name',nullif(btrim(u.raw_user_meta_data->>'full_name'),''),'role_code',r.code)
    order by m.id),'[]'::jsonb) into result
  from identity.memberships m join identity.roles r on r.id=m.role_id
    and (r.tenant_id is null or r.tenant_id=m.tenant_id)
  join auth.users u on u.id=m.user_id
  where m.tenant_id=a.tenant_id and m.status='active'
    and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
    and exists(select 1 from identity.context_grants g where g.membership_id=m.id and g.tenant_id=m.tenant_id
      and g.scope_type='tenant' and g.starts_at<=statement_timestamp()
      and (g.ends_at is null or g.ends_at>statement_timestamp()));
  return jsonb_build_object('workspace_id',a.workspace_id,'members',result);
end;
$$;
revoke all on function customer_api.list_workspace_role_assignment_candidates_v1(uuid) from public,anon,service_role;
grant execute on function customer_api.list_workspace_role_assignment_candidates_v1(uuid) to authenticated;

create or replace function customer_api.assign_workspace_role_v1(
  p_context_id uuid,
  p_target_membership_id uuid,
  p_workspace_role_id uuid,
  p_scope_type text,
  p_property_id uuid,
  p_building_id uuid,
  p_unit_id uuid,
  p_valid_until timestamptz,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_role platform.workspace_roles%rowtype;
  v_mem identity.memberships%rowtype;
  v_normalized_reason text;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_idem platform.workspace_role_idempotency%rowtype;
  v_assignment platform.workspace_member_roles%rowtype;
  v_response jsonb;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_role_idempotency_key_invalid' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'workspace_role_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  select * into v_res from app_private.require_workspace_role_assignment_context_v1(p_context_id);

  v_canonical_payload := jsonb_build_object(
    'action', 'assign_role',
    'building_id', p_building_id,
    'membership_id', p_target_membership_id,
    'property_id', p_property_id,
    'reason', v_normalized_reason,
    'scope_type', p_scope_type,
    'unit_id', p_unit_id,
    'valid_until', p_valid_until,
    'workspace_role_id', p_workspace_role_id
  );
  v_request_hash := encode(extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'), 'hex');

  -- Serialize the tenant-wide retry key before lookup, including different actions.
  perform pg_advisory_xact_lock(hashtextextended('workspace_role_command:' || v_res.tenant_id::text || ':' || p_idempotency_key,0));
  -- Authority may have changed while the command waited.
  select * into v_res from app_private.require_workspace_role_assignment_context_v1(p_context_id);

  select * into v_idem from platform.workspace_role_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.actor_id = auth.uid()
       and v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'assign_role'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_role_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  if p_valid_until is not null and p_valid_until<=statement_timestamp() then
    raise exception 'workspace_member_role_expiry_invalid' using errcode='22023';
  end if;
  if p_scope_type='workspace' and not exists(select 1 from identity.context_grants g
    where g.membership_id=p_target_membership_id and g.tenant_id=v_res.tenant_id and g.scope_type='tenant'
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())) then
    raise exception 'workspace_member_role_tenant_context_required' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace_member_role:' || v_res.workspace_id::text || ':' || p_target_membership_id::text, 0));

  select * into v_role from platform.workspace_roles where id = p_workspace_role_id;
  if not found or v_role.customer_workspace_id <> v_res.workspace_id then
    raise exception 'workspace_role_not_found' using errcode = 'P0002';
  end if;

  if v_role.lifecycle_status <> 'published' or v_role.valid_from > statement_timestamp() or (v_role.valid_to is not null and v_role.valid_to <= statement_timestamp()) then
    raise exception 'workspace_role_not_published' using errcode = '42501';
  end if;

  select * into v_mem from identity.memberships where id = p_target_membership_id;
  if not found
     or v_mem.tenant_id <> v_res.tenant_id
     or v_mem.status <> 'active'
     or v_mem.starts_at > statement_timestamp()
     or (v_mem.ends_at is not null and v_mem.ends_at <= statement_timestamp()) then
    raise exception 'workspace_member_role_target_membership_invalid' using errcode = '42501';
  end if;

  insert into platform.workspace_member_roles (
    tenant_id,
    customer_workspace_id,
    membership_id,
    workspace_role_id,
    scope_type,
    property_id,
    building_id,
    unit_id,
    valid_from,
    valid_to,
    assigned_by_user_id,
    assigned_by_membership_id,
    lock_version,
    reason
  ) values (
    v_res.tenant_id,
    v_res.workspace_id,
    p_target_membership_id,
    v_role.id,
    p_scope_type,
    p_property_id,
    p_building_id,
    p_unit_id,
    statement_timestamp(),
    p_valid_until,
    auth.uid(),
    v_res.membership_id,
    1,
    v_normalized_reason
  ) returning * into v_assignment;

  v_response := jsonb_build_object(
    'action', 'assign_role',
    'id', v_assignment.id,
    'membership_id', v_assignment.membership_id,
    'workspace_role_id', v_assignment.workspace_role_id,
    'scope_type', v_assignment.scope_type,
    'valid_from', v_assignment.valid_from,
    'valid_to', v_assignment.valid_to,
    'lock_version', v_assignment.lock_version
  );

  insert into platform.workspace_role_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'assign_role',
    v_request_hash, 1, v_assignment.id, v_response, auth.uid()
  );

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    v_res.tenant_id, auth.uid(), v_res.role_code, 'WORKSPACE_ROLE_ASSIGNED', 'workspace_member_role',
    v_assignment.id, null, to_jsonb(v_assignment), v_normalized_reason, statement_timestamp()
  );

  insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
  values(v_res.tenant_id,'workspace_member_role',v_assignment.id,v_assignment.lock_version,'workspace.role.assigned.v1',jsonb_build_object('workspace_id',v_res.workspace_id,'assignment_id',v_assignment.id,'membership_id',v_assignment.membership_id,'workspace_role_id',v_assignment.workspace_role_id,'scope_type',v_assignment.scope_type));

  return v_response;
end;
$$;

create or replace function customer_api.revoke_workspace_role_assignment_v1(
  p_context_id uuid,
  p_assignment_id uuid,
  p_expected_lock_version integer,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, extensions, app_private
as $$
declare
  v_res record;
  v_assignment platform.workspace_member_roles%rowtype;
  v_assignment_after platform.workspace_member_roles%rowtype;
  v_before_snapshot jsonb;
  v_normalized_reason text;
  v_canonical_payload jsonb;
  v_request_hash text;
  v_idem platform.workspace_role_idempotency%rowtype;
  v_response jsonb;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$' then
    raise exception 'workspace_role_idempotency_key_invalid' using errcode = '22023';
  end if;

  if p_reason is null or length(trim(p_reason)) < 5 then
    raise exception 'workspace_role_reason_required' using errcode = '22023';
  end if;
  v_normalized_reason := trim(p_reason);

  select * into v_res from app_private.require_workspace_role_assignment_context_v1(p_context_id);

  v_canonical_payload := jsonb_build_object(
    'action', 'revoke_assignment',
    'assignment_id', p_assignment_id,
    'expected_lock_version', p_expected_lock_version,
    'reason', v_normalized_reason
  );
  v_request_hash := encode(extensions.digest(convert_to(v_canonical_payload::text, 'UTF8'), 'sha256'), 'hex');

  -- Serialize the tenant-wide retry key before lookup, including different actions.
  perform pg_advisory_xact_lock(hashtextextended('workspace_role_command:' || v_res.tenant_id::text || ':' || p_idempotency_key,0));
  -- Authority may have changed while the command waited.
  select * into v_res from app_private.require_workspace_role_assignment_context_v1(p_context_id);

  select * into v_idem from platform.workspace_role_idempotency
  where tenant_id = v_res.tenant_id and idempotency_key = p_idempotency_key;

  if found then
    if v_idem.actor_id = auth.uid()
       and v_idem.customer_workspace_id = v_res.workspace_id
       and v_idem.action = 'revoke_assignment'
       and v_idem.request_hash = v_request_hash then
      return v_idem.response_snapshot;
    else
      raise exception 'workspace_role_idempotency_conflict' using errcode = '22023';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('workspace_member_role_revoke:' || p_assignment_id::text, 0));

  select * into v_assignment
  from platform.workspace_member_roles
  where id = p_assignment_id
  for update;

  if not found or v_assignment.customer_workspace_id <> v_res.workspace_id then
    raise exception 'workspace_member_role_not_found' using errcode = 'P0002';
  end if;

  if v_assignment.valid_to is not null and v_assignment.valid_to <= statement_timestamp() then
    raise exception 'workspace_member_role_already_revoked' using errcode = '42501';
  end if;

  if p_expected_lock_version is null or v_assignment.lock_version <> p_expected_lock_version then
    raise exception 'workspace_member_role_expected_lock_version_conflict' using errcode = '40001';
  end if;

  v_before_snapshot := to_jsonb(v_assignment);

  update platform.workspace_member_roles
  set valid_to = statement_timestamp(),
      lock_version = lock_version + 1,
      reason = v_normalized_reason
  where id = v_assignment.id
  returning * into v_assignment_after;

  v_response := jsonb_build_object(
    'action', 'revoke_assignment',
    'id', v_assignment_after.id,
    'valid_to', v_assignment_after.valid_to,
    'lock_version', v_assignment_after.lock_version
  );

  insert into platform.workspace_role_idempotency (
    tenant_id, customer_workspace_id, idempotency_key, action,
    request_hash, request_hash_version, result_entity_id, response_snapshot, actor_id
  ) values (
    v_res.tenant_id, v_res.workspace_id, p_idempotency_key, 'revoke_assignment',
    v_request_hash, 1, v_assignment_after.id, v_response, auth.uid()
  );

  insert into audit.events (
    tenant_id, actor_id, actor_role, action, entity_type, entity_id,
    before_snapshot, after_snapshot, reason, occurred_at
  ) values (
    v_res.tenant_id, auth.uid(), v_res.role_code, 'WORKSPACE_ROLE_ASSIGNMENT_REVOKED', 'workspace_member_role',
    v_assignment_after.id, v_before_snapshot, to_jsonb(v_assignment_after), v_normalized_reason, statement_timestamp()
  );

  insert into platform.outbox_events(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload)
  values(v_res.tenant_id,'workspace_member_role',v_assignment_after.id,v_assignment_after.lock_version,'workspace.role.assignment.revoked.v1',jsonb_build_object('workspace_id',v_res.workspace_id,'assignment_id',v_assignment_after.id,'membership_id',v_assignment_after.membership_id,'valid_to',v_assignment_after.valid_to));

  return v_response;
end;
$$;

create or replace function app_private.guard_workspace_member_role_invariants_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, portfolio, identity
as $$
declare
  v_role record;
  v_mem record;
  v_bld record;
  v_unit record;
  v_ceiling_rank integer;
  v_scope_rank integer;
begin
  if tg_op = 'DELETE' then
    raise exception 'workspace_member_role_delete_prohibited' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    -- Reopening prohibited: once revoked, no updates are allowed
    if old.valid_to is not null and old.valid_to <= statement_timestamp() then
      raise exception 'workspace_member_role_already_revoked' using errcode = '42501';
    end if;

    -- All identity, scope, role, membership, timestamps, and creator provenance fields are strictly immutable
    if new.id <> old.id
       or new.customer_workspace_id <> old.customer_workspace_id
       or new.tenant_id <> old.tenant_id
       or new.membership_id <> old.membership_id
       or new.workspace_role_id <> old.workspace_role_id
       or new.scope_type <> old.scope_type
       or new.property_id is distinct from old.property_id
       or new.building_id is distinct from old.building_id
       or new.unit_id is distinct from old.unit_id
       or new.valid_from <> old.valid_from
       or new.created_at <> old.created_at
       or new.assigned_by_user_id <> old.assigned_by_user_id
       or new.assigned_by_membership_id <> old.assigned_by_membership_id then
      raise exception 'workspace_member_role_fields_immutable' using errcode = '42501';
    end if;

    -- Revocation transition only: valid_to must transition from NULL to a valid timestamp
    if new.valid_to is null or new.valid_to < old.valid_from
       or new.valid_to > statement_timestamp()
       or (old.valid_to is not null and new.valid_to >= old.valid_to) then
      raise exception 'workspace_member_role_update_must_be_revocation' using errcode = '42501';
    end if;

    -- lock_version must increment by exactly 1
    if new.lock_version <> old.lock_version + 1 then
      raise exception 'workspace_member_role_expected_lock_version_conflict' using errcode = '40001';
    end if;

    -- Reason must be valid
    if new.reason is null or length(trim(new.reason)) < 5 then
      raise exception 'workspace_member_role_reason_invalid' using errcode = '22023';
    end if;

    return new;
  end if;

  -- INSERT Validations:
  -- 1. Tenant & Membership consistency and active validity
  select * into v_mem
  from identity.memberships
  where id = new.membership_id;

  if not found or v_mem.tenant_id <> new.tenant_id or v_mem.status <> 'active'
     or v_mem.starts_at > statement_timestamp()
     or (v_mem.ends_at is not null and v_mem.ends_at <= statement_timestamp()) then
    raise exception 'workspace_member_role_target_membership_invalid' using errcode = '42501';
  end if;

  -- 2. Role Status & Tenant/Workspace consistency
  select * into v_role
  from platform.workspace_roles
  where id = new.workspace_role_id;

  if not found or v_role.tenant_id <> new.tenant_id or v_role.customer_workspace_id <> new.customer_workspace_id then
    raise exception 'workspace_member_role_cross_workspace_prohibited' using errcode = '42501';
  end if;

  if v_role.lifecycle_status <> 'published' or (v_role.valid_to is not null and v_role.valid_to <= statement_timestamp()) then
    raise exception 'workspace_role_not_published' using errcode = '42501';
  end if;

  -- 3. Scope Ceiling Enforcement: workspace(0) > property(1) > building(2) > unit(3)
  v_ceiling_rank := case v_role.scope_ceiling
    when 'workspace' then 0
    when 'property' then 1
    when 'building' then 2
    when 'unit' then 3
    else 99
  end;

  v_scope_rank := case new.scope_type
    when 'workspace' then 0
    when 'property' then 1
    when 'building' then 2
    when 'unit' then 3
    else 99
  end;

  if v_scope_rank < v_ceiling_rank then
    raise exception 'workspace_member_role_exceeds_scope_ceiling' using errcode = '42501';
  end if;

  -- 4. Scope Ancestry & Workspace Property Binding
  if new.property_id is not null then
    if not exists (
      select 1 from platform.workspace_property_bindings
      where customer_workspace_id = new.customer_workspace_id
        and property_id = new.property_id
        and status = 'active'
        and valid_from <= statement_timestamp()
        and (valid_to is null or valid_to > statement_timestamp())
    ) then
      raise exception 'property_not_bound_to_workspace' using errcode = '42501';
    end if;
  end if;

  if new.building_id is not null then
    select * into v_bld from portfolio.buildings where id = new.building_id;
    if not found or v_bld.property_id <> new.property_id or v_bld.tenant_id <> new.tenant_id then
      raise exception 'building_scope_ancestry_mismatch' using errcode = '22023';
    end if;
  end if;

  if new.unit_id is not null then
    select * into v_unit from portfolio.units where id = new.unit_id;
    if not found or v_unit.building_id <> new.building_id or v_unit.tenant_id <> new.tenant_id then
      raise exception 'unit_scope_ancestry_mismatch' using errcode = '22023';
    end if;
  end if;

  -- 5. Temporal Non-Overlap for identical assignment target
  if exists (
    select 1 from platform.workspace_member_roles r
    where r.customer_workspace_id = new.customer_workspace_id
      and r.membership_id = new.membership_id
      and r.workspace_role_id = new.workspace_role_id
      and r.scope_type = new.scope_type
      and r.property_id is not distinct from new.property_id
      and r.building_id is not distinct from new.building_id
      and r.unit_id is not distinct from new.unit_id
      and (r.valid_to is null or r.valid_to > new.valid_from)
  ) then
    raise exception 'workspace_member_role_overlapping_assignment' using errcode = '23505';
  end if;

  return new;
end;
$$;

commit;
