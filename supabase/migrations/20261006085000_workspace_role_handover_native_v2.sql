begin;

-- Workspace scope needs both a property-bound mutation context and an active
-- tenant context belonging to the same manager for native authority checks.
create function customer_api.handover_workspace_role_v2(
  p_context_id uuid,
  p_authority_context_id uuid,
  p_assignment_id uuid,
  p_expected_lock_version integer,
  p_successor_membership_id uuid,
  p_valid_until timestamptz,
  p_reason text,
  p_idempotency_key text
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,platform,identity,audit,extensions,app_private
as $$
declare
  actor record;
  previous platform.workspace_member_roles%rowtype;
  retry platform.workspace_role_idempotency%rowtype;
  payload_hash text;
  new_assignment jsonb;
  revoked jsonb;
  result jsonb;
  derived_key text;
  actor_membership_end timestamptz;
  actor_context_end timestamptz;
  successor_membership_end timestamptz;
  role_end timestamptz;
  parent_id uuid;
  authority_context_end timestamptz;
begin
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$'
    or p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception 'workspace_handover_request_invalid' using errcode='22023';
  end if;
  select * into actor from app_private.require_workspace_role_assignment_context_v1(p_context_id);
  payload_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'authority_context_id',p_authority_context_id,'assignment_id',p_assignment_id,'expected_lock_version',p_expected_lock_version,
    'successor_membership_id',p_successor_membership_id,'valid_until',p_valid_until,
    'reason',btrim(p_reason))::text,'UTF8'),'sha256'),'hex');

  perform pg_advisory_xact_lock(hashtextextended(
    'workspace_role_command:'||actor.tenant_id::text||':'||p_idempotency_key,0));
  select * into actor from app_private.require_workspace_role_assignment_context_v1(p_context_id);
  select * into retry from platform.workspace_role_idempotency
   where tenant_id=actor.tenant_id and idempotency_key=p_idempotency_key;
  if found then
    if retry.actor_id=auth.uid() and retry.customer_workspace_id=actor.workspace_id
      and retry.action='handover_role' and retry.request_hash=payload_hash then
      return retry.response_snapshot;
    end if;
    raise exception 'workspace_role_idempotency_conflict' using errcode='22023';
  end if;

  if p_authority_context_id is not null and not exists (
    select 1 from identity.context_grants g join identity.memberships m
      on m.id=g.membership_id and m.tenant_id=g.tenant_id
    where g.id=p_authority_context_id and g.membership_id=actor.membership_id
      and m.user_id=auth.uid() and g.tenant_id=actor.tenant_id
      and g.scope_type='tenant' and g.starts_at<=statement_timestamp()
      and (g.ends_at is null or g.ends_at>statement_timestamp())
  ) then raise exception 'workspace_handover_authority_context_denied' using errcode='42501'; end if;
  select * into previous from platform.workspace_member_roles where id=p_assignment_id for update;
  if not found or previous.tenant_id<>actor.tenant_id
    or previous.customer_workspace_id<>actor.workspace_id then
    raise exception 'workspace_member_role_not_found' using errcode='P0002';
  end if;
  if previous.scope_type='workspace' and p_authority_context_id is null then
    raise exception 'workspace_handover_authority_context_required' using errcode='42501';
  end if;
  if previous.membership_id=actor.membership_id
    or previous.membership_id=p_successor_membership_id
    or actor.membership_id=p_successor_membership_id then
    raise exception 'workspace_handover_same_member' using errcode='22023';
  end if;
  if previous.valid_to is not null and previous.valid_to<=statement_timestamp() then
    raise exception 'workspace_member_role_already_revoked' using errcode='42501';
  end if;
  if p_expected_lock_version is null or previous.lock_version<>p_expected_lock_version then
    raise exception 'workspace_member_role_expected_lock_version_conflict' using errcode='40001';
  end if;
  -- A handover cannot increase the previous assignment's expiry. A separate
  -- bounded renewal contract is needed for a longer successor mandate.
  if (p_valid_until is not null and not isfinite(p_valid_until))
     or (previous.valid_to is not null and (p_valid_until is null or p_valid_until>previous.valid_to))
     or (p_valid_until is not null and p_valid_until<=statement_timestamp()) then
    raise exception 'workspace_handover_expiry_exceeds_previous' using errcode='42501';
  end if;
  select m.ends_at,g.ends_at into actor_membership_end,actor_context_end
    from identity.memberships m join identity.context_grants g on g.membership_id=m.id
    where m.id=actor.membership_id and g.id=p_context_id;
  select ends_at into authority_context_end from identity.context_grants where id=p_authority_context_id;
  select ends_at into successor_membership_end from identity.memberships
    where id=p_successor_membership_id and tenant_id=actor.tenant_id;
  if successor_membership_end is null and not found then
    raise exception 'workspace_handover_successor_invalid' using errcode='42501';
  end if;
  if (actor_membership_end is not null and (p_valid_until is null or p_valid_until>actor_membership_end))
    or (actor_context_end is not null and (p_valid_until is null or p_valid_until>actor_context_end))
    or (authority_context_end is not null and (p_valid_until is null or p_valid_until>authority_context_end))
    or (successor_membership_end is not null and (p_valid_until is null or p_valid_until>successor_membership_end)) then
    raise exception 'workspace_handover_expiry_exceeds_membership' using errcode='42501';
  end if;
  select valid_to into role_end from platform.workspace_roles where id=previous.workspace_role_id;
  if role_end is not null and (p_valid_until is null or p_valid_until>role_end) then
    raise exception 'workspace_handover_expiry_exceeds_role' using errcode='42501';
  end if;
  if not (case when previous.scope_type='workspace' then
      app_private.native_workspace_scope_for_membership_v2(
        p_authority_context_id,actor.membership_id,actor.workspace_id)
    else app_private.context_covers_workspace_target_v1(p_context_id,previous.scope_type,
      case previous.scope_type when 'property' then previous.property_id
        when 'building' then previous.building_id else previous.unit_id end) end) then
    raise exception 'workspace_handover_scope_denied' using errcode='42501';
  end if;
  if not exists(select 1 from identity.context_grants g
    where g.membership_id=p_successor_membership_id and g.tenant_id=actor.tenant_id
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and (g.ends_at is null or (p_valid_until is not null and g.ends_at>=p_valid_until))
      and (g.scope_type='tenant'
        or (previous.scope_type<>'workspace' and g.scope_type='property'
          and g.property_id=previous.property_id)
        or (previous.scope_type in ('building','unit') and g.scope_type='building'
          and g.building_id=previous.building_id)
        or (previous.scope_type='unit' and g.scope_type='unit'
          and g.unit_id=previous.unit_id))) then
    raise exception 'workspace_handover_successor_context_required' using errcode='42501';
  end if;
  -- Every permission in the role must already be effective for this manager
  -- at the exact handover scope. A generic assignment permission is insufficient.
  if exists(select 1
    from platform.workspace_role_permissions rp
    join identity.permissions permission on permission.id=rp.permission_id
    join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
    join platform.module_definitions module on module.id=rm.module_definition_id
    join platform.module_permission_bindings binding
      on binding.module_definition_id=module.id and binding.permission_id=permission.id
    where rp.workspace_role_id=previous.workspace_role_id and rp.effect='allow'
      and binding.lifecycle_status='active'
      and not (case when previous.scope_type='workspace' then
        app_private.check_workspace_native_permission_v2(
          p_authority_context_id,actor.workspace_id,permission.code,module.code)
      else app_private.check_scoped_effective_permission_v1(
        p_context_id,permission.code,module.code,previous.scope_type,
        case previous.scope_type when 'property' then previous.property_id
          when 'building' then previous.building_id else previous.unit_id end) end)) then
    raise exception 'workspace_handover_authority_subset_required' using errcode='42501';
  end if;

  select a.id into parent_id from platform.workspace_member_roles a
    where a.tenant_id=actor.tenant_id and a.customer_workspace_id=actor.workspace_id
      and a.membership_id=actor.membership_id and a.workspace_role_id=previous.workspace_role_id
      and a.scope_type=previous.scope_type
      and a.property_id is not distinct from previous.property_id
      and a.building_id is not distinct from previous.building_id
      and a.unit_id is not distinct from previous.unit_id
      and a.valid_from<=statement_timestamp()
      and (a.valid_to is null or (p_valid_until is not null and a.valid_to>=p_valid_until))
      and app_private.workspace_role_handover_lineage_valid_v1(a.id,null)
    order by a.valid_to desc nulls first,a.id limit 1;
  if parent_id is null and not app_private.workspace_role_manager_has_sources_v1(
    actor.membership_id,actor.workspace_id,previous.workspace_role_id,previous.scope_type,
    previous.property_id,previous.building_id,previous.unit_id,p_valid_until) then
    raise exception 'workspace_handover_authority_provenance_required' using errcode='42501';
  end if;

  derived_key := 'handover:'||substr(payload_hash,1,48);
  new_assignment := customer_api.assign_workspace_role_v2(
    p_context_id,p_authority_context_id,p_successor_membership_id,previous.workspace_role_id,
    previous.scope_type,previous.property_id,previous.building_id,previous.unit_id,
    p_valid_until,p_reason,derived_key||':assign');
  insert into platform.workspace_role_handover_lineage(
    successor_assignment_id,manager_membership_id,manager_context_id,parent_assignment_id)
  values((new_assignment->>'id')::uuid,actor.membership_id,
    coalesce(p_authority_context_id,p_context_id),parent_id);
  revoked := customer_api.revoke_workspace_role_assignment_v1(
    p_context_id,previous.id,p_expected_lock_version,p_reason,derived_key||':revoke');
  result := jsonb_build_object('action','handover_role','previous',revoked,
    'successor',new_assignment,'effective_at',statement_timestamp());
  insert into platform.workspace_role_idempotency(tenant_id,customer_workspace_id,idempotency_key,
    action,request_hash,result_entity_id,response_snapshot,actor_id)
  values(actor.tenant_id,actor.workspace_id,p_idempotency_key,'handover_role',payload_hash,
    (new_assignment->>'id')::uuid,result,auth.uid());
  insert into audit.events(tenant_id,actor_id,actor_role,action,entity_type,entity_id,
    before_snapshot,after_snapshot,reason,occurred_at)
  values(actor.tenant_id,auth.uid(),actor.role_code,'WORKSPACE_ROLE_HANDED_OVER',
    'workspace_member_role',(new_assignment->>'id')::uuid,
    jsonb_build_object('previous_assignment_id',previous.id,'previous_membership_id',previous.membership_id),
    jsonb_build_object('successor_assignment_id',(new_assignment->>'id')::uuid,
      'successor_membership_id',p_successor_membership_id),btrim(p_reason),statement_timestamp());
  return result;
end;
$$;
revoke all on function customer_api.handover_workspace_role_v2(uuid,uuid,uuid,integer,uuid,timestamptz,text,text)
 from public,anon,service_role;
grant execute on function customer_api.handover_workspace_role_v2(uuid,uuid,uuid,integer,uuid,timestamptz,text,text)
 to authenticated;
-- The dual-context v2 command is the only customer handover entry point.
-- Keeping v1 executable would bypass the explicit workspace authority context.
revoke execute on function customer_api.handover_workspace_role_v1(
  uuid,uuid,integer,uuid,timestamptz,text,text) from authenticated;
notify pgrst,'reload schema';
commit;
