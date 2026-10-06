begin;

-- Public assignment now records a live authority source. The v1 command is
-- retained for internal composition and existing migration history only.
create function customer_api.assign_workspace_role_v2(
  p_context_id uuid,p_authority_context_id uuid,p_target_membership_id uuid,
  p_workspace_role_id uuid,p_scope_type text,p_property_id uuid,p_building_id uuid,
  p_unit_id uuid,p_valid_until timestamptz,p_reason text,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private
as $$
declare
  actor record;
  role_row platform.workspace_roles%rowtype;
  target_id uuid;
  target_property uuid;
  target_building uuid;
  parent_id uuid;
  actor_membership_end timestamptz;
  actor_context_end timestamptz;
  authority_context_end timestamptz;
  successor_membership_end timestamptz;
  result jsonb;
  link platform.workspace_role_handover_lineage%rowtype;
  assignment platform.workspace_member_roles%rowtype;
begin
  select * into actor from app_private.require_workspace_role_assignment_context_v1(p_context_id);
  if p_scope_type not in ('workspace','property','building','unit')
    or p_target_membership_id=actor.membership_id then
    raise exception 'workspace_role_assignment_scope_invalid' using errcode='42501';
  end if;
  select * into role_row from platform.workspace_roles where id=p_workspace_role_id
    and tenant_id=actor.tenant_id and customer_workspace_id=actor.workspace_id;
  if not found then raise exception 'workspace_role_not_found' using errcode='P0002'; end if;
  if p_scope_type='workspace' then
    target_id:=actor.workspace_id;
  elsif p_scope_type='property' then
    target_id:=p_property_id; target_property:=p_property_id;
  elsif p_scope_type='building' then
    target_id:=p_building_id; target_building:=p_building_id;
    select b.property_id into target_property from portfolio.buildings b
      where b.id=p_building_id and b.tenant_id=actor.tenant_id;
  else
    target_id:=p_unit_id;
    select b.id,b.property_id into target_building,target_property
      from portfolio.units u join portfolio.buildings b on b.id=u.building_id
      where u.id=p_unit_id and u.tenant_id=actor.tenant_id and b.tenant_id=actor.tenant_id;
  end if;
  if target_id is null or (p_scope_type<>'workspace' and target_property is null)
    or (p_property_id is not null and p_property_id is distinct from target_property)
    or (p_building_id is not null and p_building_id is distinct from target_building)
    or (p_scope_type<>'unit' and p_unit_id is not null) then
    raise exception 'workspace_role_assignment_scope_invalid' using errcode='42501';
  end if;
  if p_scope_type='workspace' then
    if p_authority_context_id is null or not exists(select 1
      from identity.context_grants g join identity.memberships m on m.id=g.membership_id
      where g.id=p_authority_context_id and g.membership_id=actor.membership_id
        and g.tenant_id=actor.tenant_id and m.user_id=auth.uid()
        and g.scope_type='tenant' and g.starts_at<=statement_timestamp()
        and (g.ends_at is null or g.ends_at>statement_timestamp()))
      or not app_private.native_workspace_scope_for_membership_v2(
        p_authority_context_id,actor.membership_id,actor.workspace_id) then
      raise exception 'workspace_role_assignment_authority_context_required' using errcode='42501';
    end if;
  elsif not app_private.context_covers_workspace_target_v1(p_context_id,p_scope_type,target_id) then
    raise exception 'workspace_role_assignment_scope_denied' using errcode='42501';
  end if;
  select m.ends_at,g.ends_at into actor_membership_end,actor_context_end
    from identity.memberships m join identity.context_grants g on g.membership_id=m.id
    where m.id=actor.membership_id and g.id=p_context_id;
  select ends_at into authority_context_end from identity.context_grants
    where id=p_authority_context_id;
  select ends_at into successor_membership_end from identity.memberships
    where id=p_target_membership_id and tenant_id=actor.tenant_id and status='active';
  if not found then raise exception 'workspace_role_assignment_successor_invalid' using errcode='42501'; end if;
  if (p_valid_until is not null and not isfinite(p_valid_until))
    or (p_valid_until is not null and p_valid_until<=statement_timestamp())
    or (actor_membership_end is not null and (p_valid_until is null or p_valid_until>actor_membership_end))
    or (actor_context_end is not null and (p_valid_until is null or p_valid_until>actor_context_end))
    or (authority_context_end is not null and (p_valid_until is null or p_valid_until>authority_context_end))
    or (successor_membership_end is not null and (p_valid_until is null or p_valid_until>successor_membership_end))
    or (role_row.valid_to is not null and (p_valid_until is null or p_valid_until>role_row.valid_to)) then
    raise exception 'workspace_role_assignment_expiry_exceeds_authority' using errcode='42501';
  end if;
  if not exists(select 1 from identity.context_grants g
    where g.membership_id=p_target_membership_id and g.tenant_id=actor.tenant_id
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and (g.ends_at is null or (p_valid_until is not null and g.ends_at>=p_valid_until))
      and (g.scope_type='tenant'
        or (p_scope_type<>'workspace' and g.scope_type='property' and g.property_id=target_property)
        or (p_scope_type in ('building','unit') and g.scope_type='building' and g.building_id=target_building)
        or (p_scope_type='unit' and g.scope_type='unit' and g.unit_id=p_unit_id))) then
    raise exception 'workspace_role_assignment_successor_context_required' using errcode='42501';
  end if;
  if exists(select 1 from platform.workspace_role_permissions rp
    join identity.permissions p on p.id=rp.permission_id
    join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
    join platform.module_definitions module on module.id=rm.module_definition_id
    join platform.module_permission_bindings binding
      on binding.module_definition_id=module.id and binding.permission_id=p.id
    where rp.workspace_role_id=p_workspace_role_id and rp.effect='allow'
      and binding.lifecycle_status='active'
      and not (case when p_scope_type='workspace' then
        app_private.check_workspace_native_permission_v2(
          p_authority_context_id,actor.workspace_id,p.code,module.code)
      else app_private.check_scoped_effective_permission_v1(
        p_context_id,p.code,module.code,p_scope_type,target_id) end)) then
    raise exception 'workspace_role_assignment_authority_subset_required' using errcode='42501';
  end if;
  select a.id into parent_id from platform.workspace_member_roles a
    where a.membership_id=actor.membership_id and a.tenant_id=actor.tenant_id
      and a.customer_workspace_id=actor.workspace_id and a.workspace_role_id=p_workspace_role_id
      and a.scope_type=p_scope_type
      and a.property_id is not distinct from (case when p_scope_type='workspace' then null else target_property end)
      and a.building_id is not distinct from (case when p_scope_type in ('building','unit') then target_building else null end)
      and a.unit_id is not distinct from (case when p_scope_type='unit' then p_unit_id else null end)
      and a.valid_from<=statement_timestamp()
      and (a.valid_to is null or (p_valid_until is not null and a.valid_to>=p_valid_until))
      and app_private.workspace_role_handover_lineage_valid_v1(a.id,null)
    order by a.valid_to desc nulls first,a.id limit 1;
  if parent_id is null and exists(select 1 from platform.workspace_role_permissions rp
    where rp.workspace_role_id=p_workspace_role_id and rp.effect='allow'
      and (not exists(select 1 from identity.role_permissions base
        where base.role_id=actor.role_id and base.permission_id=rp.permission_id and base.effect='allow')
        or exists(select 1 from identity.role_permissions denied
          where denied.role_id=actor.role_id and denied.permission_id=rp.permission_id and denied.effect='deny'))) then
    raise exception 'workspace_role_assignment_authority_provenance_required' using errcode='42501';
  end if;
  result:=customer_api.assign_workspace_role_v1(p_context_id,p_target_membership_id,
    p_workspace_role_id,p_scope_type,
    case when p_scope_type='workspace' then null else target_property end,
    case when p_scope_type in ('building','unit') then target_building else null end,
    p_unit_id,p_valid_until,p_reason,p_idempotency_key);
  select * into link from platform.workspace_role_handover_lineage
    where successor_assignment_id=(result->>'id')::uuid;
  if found then
    if link.manager_membership_id<>actor.membership_id
      or link.manager_context_id is distinct from coalesce(p_authority_context_id,p_context_id)
      or link.parent_assignment_id is distinct from parent_id then
      raise exception 'workspace_role_assignment_authority_retry_conflict' using errcode='22023';
    end if;
  else
    select * into assignment from platform.workspace_member_roles where id=(result->>'id')::uuid;
    if assignment.assigned_by_membership_id<>actor.membership_id
      or assignment.valid_from<>statement_timestamp() then
      raise exception 'workspace_role_assignment_legacy_retry_conflict' using errcode='22023';
    end if;
    insert into platform.workspace_role_handover_lineage(
      successor_assignment_id,manager_membership_id,manager_context_id,parent_assignment_id)
    values(assignment.id,actor.membership_id,coalesce(p_authority_context_id,p_context_id),parent_id);
  end if;
  return result;
end;
$$;
revoke all on function customer_api.assign_workspace_role_v2(
  uuid,uuid,uuid,uuid,text,uuid,uuid,uuid,timestamptz,text,text) from public,anon,service_role;
grant execute on function customer_api.assign_workspace_role_v2(
  uuid,uuid,uuid,uuid,text,uuid,uuid,uuid,timestamptz,text,text) to authenticated;

create function customer_api.revoke_workspace_role_assignment_v2(
  p_context_id uuid,p_authority_context_id uuid,p_assignment_id uuid,
  p_expected_lock_version integer,p_reason text,p_idempotency_key text
) returns jsonb language plpgsql volatile security definer
set search_path=pg_catalog,platform,identity,app_private
as $$
declare
  actor record;
  old_assignment platform.workspace_member_roles%rowtype;
  target_id uuid;
begin
  select * into actor from app_private.require_workspace_role_assignment_context_v1(p_context_id);
  select * into old_assignment from platform.workspace_member_roles
    where id=p_assignment_id for update;
  if not found or old_assignment.tenant_id<>actor.tenant_id
    or old_assignment.customer_workspace_id<>actor.workspace_id
    or old_assignment.membership_id=actor.membership_id then
    raise exception 'workspace_role_revoke_subordinate_required' using errcode='42501';
  end if;
  target_id:=case old_assignment.scope_type when 'workspace' then actor.workspace_id
    when 'property' then old_assignment.property_id
    when 'building' then old_assignment.building_id else old_assignment.unit_id end;
  if old_assignment.scope_type='workspace' then
    if p_authority_context_id is null or not exists(select 1
      from identity.context_grants g join identity.memberships m on m.id=g.membership_id
      where g.id=p_authority_context_id and g.membership_id=actor.membership_id
        and g.tenant_id=actor.tenant_id and m.user_id=auth.uid()
        and g.scope_type='tenant' and g.starts_at<=statement_timestamp()
        and (g.ends_at is null or g.ends_at>statement_timestamp()))
      or not app_private.native_workspace_scope_for_membership_v2(
        p_authority_context_id,actor.membership_id,actor.workspace_id) then
      raise exception 'workspace_role_revoke_authority_context_required' using errcode='42501';
    end if;
  elsif not app_private.context_covers_workspace_target_v1(
    p_context_id,old_assignment.scope_type,target_id) then
    raise exception 'workspace_role_revoke_scope_denied' using errcode='42501';
  end if;
  if exists(select 1 from platform.workspace_role_permissions rp
    join identity.permissions p on p.id=rp.permission_id
    join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
    join platform.module_definitions module on module.id=rm.module_definition_id
    join platform.module_permission_bindings binding
      on binding.module_definition_id=module.id and binding.permission_id=p.id
    where rp.workspace_role_id=old_assignment.workspace_role_id and rp.effect='allow'
      and binding.lifecycle_status='active'
      and not (case when old_assignment.scope_type='workspace' then
        app_private.check_workspace_native_permission_v2(
          p_authority_context_id,actor.workspace_id,p.code,module.code)
      else app_private.check_scoped_effective_permission_v1(
        p_context_id,p.code,module.code,old_assignment.scope_type,target_id) end)) then
    raise exception 'workspace_role_revoke_authority_subset_required' using errcode='42501';
  end if;
  return customer_api.revoke_workspace_role_assignment_v1(
    p_context_id,p_assignment_id,p_expected_lock_version,p_reason,p_idempotency_key);
end;
$$;
revoke all on function customer_api.revoke_workspace_role_assignment_v2(
  uuid,uuid,uuid,integer,text,text) from public,anon,service_role;
grant execute on function customer_api.revoke_workspace_role_assignment_v2(
  uuid,uuid,uuid,integer,text,text) to authenticated;

-- Old Data API entry points must not bypass the authority subset check.
revoke execute on function customer_api.assign_workspace_role_v1(
  uuid,uuid,uuid,text,uuid,uuid,uuid,timestamptz,text,text) from authenticated;
revoke execute on function customer_api.assign_workspace_building_role_v1(
  uuid,uuid,uuid,text,uuid,uuid,uuid,timestamptz,text,text) from authenticated;
revoke execute on function customer_api.revoke_workspace_role_assignment_v1(
  uuid,uuid,integer,text,text) from authenticated;
notify pgrst,'reload schema';
commit;
