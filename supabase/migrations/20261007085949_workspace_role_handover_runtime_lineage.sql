begin;

-- Recheck new handover lineage at each shared permission evaluation and
-- workspace discovery. Existing assignment rows have no lineage link.

create or replace function app_private.native_workspace_scope_for_membership_v2(
  p_context_id uuid, p_membership_id uuid, p_workspace_id uuid
) returns boolean language sql stable security definer
set search_path=pg_catalog
as $$
  select auth.uid() is not null and exists (
    select 1 from identity.context_grants g
    join identity.memberships m on m.id=g.membership_id and m.tenant_id=g.tenant_id
    join identity.roles r on r.id=m.role_id and (r.tenant_id is null or r.tenant_id=m.tenant_id)
    join platform.customer_workspaces w on w.id=p_workspace_id and w.tenant_id=g.tenant_id
    join platform.workspace_member_roles a on a.membership_id=m.id
      and a.tenant_id=w.tenant_id and a.customer_workspace_id=w.id
    join platform.workspace_roles wr on wr.id=a.workspace_role_id
      and wr.tenant_id=w.tenant_id and wr.customer_workspace_id=w.id
    where g.id=p_context_id and m.id=p_membership_id and g.scope_type='tenant'
      and g.property_id is null and g.building_id is null and g.unit_id is null
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp())
      and m.status='active' and m.starts_at<=statement_timestamp()
      and (m.ends_at is null or m.ends_at>statement_timestamp())
      and w.lifecycle_status='ACTIVE'
      and a.scope_type='workspace' and a.property_id is null and a.building_id is null and a.unit_id is null
      and a.valid_from<=statement_timestamp() and (a.valid_to is null or a.valid_to>statement_timestamp())
      and app_private.workspace_role_handover_lineage_valid_v1(a.id,null)
      and wr.scope_ceiling='workspace' and wr.lifecycle_status='published'
      and wr.valid_from<=statement_timestamp() and (wr.valid_to is null or wr.valid_to>statement_timestamp())
  );
$$;

create or replace function app_private.check_direct_effective_permission_v2(
  p_context_id uuid,
  p_membership_id uuid,
  p_permission_code text,
  p_module_code text,
  p_target_scope_type text,
  p_target_scope_id uuid,
  p_explicit_workspace_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
declare
  v_res record;
  v_member record;
  v_perm identity.permissions%rowtype;
  v_mod_ids uuid[];
  v_mod platform.module_definitions%rowtype;
  v_binding_ids uuid[];
  v_binding platform.module_permission_bindings%rowtype;
  v_tax_ids uuid[];
  v_profile record;
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_ctx_grant record;
  v_workspace_id uuid;
  v_ctx_property_id uuid;
  v_ctx_scope_covered boolean := false;
  v_has_allow boolean := false;
begin
  if p_context_id is null or p_membership_id is null or p_permission_code is null or p_module_code is null or p_target_scope_type is null then
    return false;
  end if;

  if p_target_scope_type not in ('workspace', 'property', 'building', 'unit') then
    return false;
  end if;

  if p_target_scope_type <> 'workspace' and p_target_scope_id is null then
    return false;
  end if;

  -- 1. Validate Context Grant independently (deterministic single-row, fail-closed)
  select cg.id, cg.tenant_id, cg.membership_id, cg.scope_type, cg.property_id, cg.building_id, cg.unit_id
  into v_ctx_grant
  from identity.context_grants cg
  where cg.id = p_context_id
    and cg.membership_id = p_membership_id
    and cg.starts_at <= statement_timestamp()
    and (cg.ends_at is null or cg.ends_at > statement_timestamp());

  if not found then return false; end if;

  if p_explicit_workspace_id is not null then
    -- The direct helper also evaluates grantors for delegated permission.
    -- This internal check deliberately validates the supplied membership,
    -- while the top-level native resolver verifies the current caller owns it.
    if p_target_scope_type is distinct from 'workspace'
      or p_target_scope_id is distinct from p_explicit_workspace_id
      or not app_private.native_workspace_scope_for_membership_v2(
        p_context_id,p_membership_id,p_explicit_workspace_id) then return false; end if;
    v_workspace_id := p_explicit_workspace_id;
  else
  -- 2. Resolve property from context grant
  if v_ctx_grant.property_id is not null then
    v_ctx_property_id := v_ctx_grant.property_id;
  elsif v_ctx_grant.building_id is not null then
    select b.property_id into v_ctx_property_id
    from portfolio.buildings b
    where b.id = v_ctx_grant.building_id and b.tenant_id = v_ctx_grant.tenant_id;
  elsif v_ctx_grant.unit_id is not null then
    select b.property_id into v_ctx_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = v_ctx_grant.unit_id and u.tenant_id = v_ctx_grant.tenant_id;
  end if;

  if v_ctx_property_id is not null then
    select b.customer_workspace_id into v_workspace_id
    from platform.workspace_property_bindings b
    join platform.customer_workspaces cw on cw.id = b.customer_workspace_id
    where b.property_id = v_ctx_property_id
      and b.tenant_id = v_ctx_grant.tenant_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp()
      and (b.valid_to is null or b.valid_to > statement_timestamp())
      and cw.tenant_id = v_ctx_grant.tenant_id
      and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE')
    limit 1;
  else
    select cw.id into v_workspace_id
    from platform.customer_workspaces cw
    where cw.tenant_id = v_ctx_grant.tenant_id
      and cw.lifecycle_status in ('PROVISIONING', 'ACTIVE')
    limit 1;
  end if;

  end if;

  if v_workspace_id is null then return false; end if;

  select v_workspace_id as workspace_id, v_ctx_grant.tenant_id as tenant_id into v_res;

  -- 3. Verify target member exists, active and belongs to same tenant
  select m.id, m.tenant_id, m.user_id, m.role_id, r.code as role_code
  into v_member
  from identity.memberships m
  left join identity.roles r on r.id = m.role_id
  where m.id = p_membership_id
    and m.tenant_id = v_res.tenant_id
    and m.status = 'active'
    and m.starts_at <= statement_timestamp()
    and (m.ends_at is null or m.ends_at > statement_timestamp());

  if not found then return false; end if;

  -- Permission & Module Verification
  select * into v_perm from identity.permissions where code = p_permission_code;
  if not found then return false; end if;

  select array_agg(id) into v_mod_ids
  from platform.module_definitions
  where code = p_module_code
    and is_active = true
    and lifecycle_status in ('active', 'published')
    and lifecycle_status <> 'catalog_only'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  -- Active Module Permission Binding Gate
  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_binding_ids), 0) <> 1 then return false; end if;
  select * into v_binding from platform.module_permission_bindings where id = v_binding_ids[1];

  if p_explicit_workspace_id is not null
    and (v_mod.requires_aal2 or v_binding.requires_aal2)
    and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then return false; end if;

  -- Workspace Module Activation Gate
  if not exists (
    select 1 from platform.workspace_modules
    where customer_workspace_id = v_res.workspace_id
      and module_code = p_module_code
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Entitlement Gate
  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
            then e.override_value_json = 'true'::jsonb
          else (e.boolean_value is true or e.numeric_value > 0)
        end
      )
  ) then
    return false;
  end if;

  -- Taxonomy Gate
  select array_agg(wta.id) into v_tax_ids
  from platform.workspace_taxonomy_assignments wta
  where wta.customer_workspace_id = v_res.workspace_id
    and wta.status = 'active'
    and wta.valid_from <= statement_timestamp()
    and (wta.valid_to is null or wta.valid_to > statement_timestamp());

  if coalesce(cardinality(v_tax_ids), 0) <> 1 then return false; end if;

  select pp.id as profile_id, om.id as model_id into v_profile
  from platform.workspace_taxonomy_assignments wta
  join platform.property_profiles pp on pp.id = wta.property_profile_id
  join platform.operating_models om on om.id = wta.operating_model_id
  where wta.id = v_tax_ids[1];

  if not exists (
    select 1
    from platform.module_property_profile_compatibilities ppc
    join platform.module_operating_model_compatibilities omc
      on omc.module_definition_id = ppc.module_definition_id
    where ppc.module_definition_id = v_mod.id
      and ppc.property_profile_id = v_profile.profile_id
      and ppc.compatibility_level = 'compatible'
      and omc.operating_model_id = v_profile.model_id
      and omc.compatibility_level = 'compatible'
  ) then
    return false;
  end if;

  -- Target Scope Ancestry
  if p_target_scope_type = 'property' then
    v_target_property_id := p_target_scope_id;
  elsif p_target_scope_type = 'building' then
    select property_id into v_target_property_id from portfolio.buildings where id = p_target_scope_id;
    v_target_building_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  elsif p_target_scope_type = 'unit' then
    select u.building_id, b.property_id
    into v_target_building_id, v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_target_scope_id;
    v_target_unit_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  end if;

  if v_target_property_id is not null and not exists (
    select 1 from platform.workspace_property_bindings
    where customer_workspace_id = v_res.workspace_id
      and property_id = v_target_property_id
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Context Grant scope containment check against Target Scope
  if v_ctx_grant.scope_type::text in ('workspace', 'tenant') then
      v_ctx_scope_covered := true;
    elsif v_ctx_grant.scope_type::text = 'property' then
      if p_target_scope_type in ('property', 'building', 'unit')
         and v_ctx_grant.property_id = v_target_property_id then
        v_ctx_scope_covered := true;
      end if;
    elsif v_ctx_grant.scope_type::text = 'building' then
      if p_target_scope_type in ('building', 'unit')
         and v_ctx_grant.building_id = v_target_building_id then
        v_ctx_scope_covered := true;
      end if;
    elsif v_ctx_grant.scope_type::text = 'unit' then
      if p_target_scope_type = 'unit'
         and v_ctx_grant.unit_id = v_target_unit_id then
        v_ctx_scope_covered := true;
      end if;
    end if;

  -- Deny Path A
  if v_member.role_id is not null and exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_member.role_id and rp.permission_id = v_perm.id and rp.effect = 'deny'
  ) then
    return false;
  end if;

  -- Deny Path B
  if exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = p_membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'deny'
      and (
        (wmr.scope_type = 'workspace')
        or (wmr.scope_type = 'property' and p_target_scope_type in ('property', 'building', 'unit') and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and p_target_scope_type in ('building', 'unit') and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and p_target_scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    return false;
  end if;

  -- Allow Path A (Strict: requires valid context grant that covers target scope)
  if v_ctx_scope_covered and v_member.role_id is not null and exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_member.role_id and rp.permission_id = v_perm.id and rp.effect = 'allow'
  ) then
    v_has_allow := true;
  end if;

  -- Allow Path B (Strict: requires local role assignment that covers target scope)
  if not v_has_allow and exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = p_membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and app_private.workspace_role_handover_lineage_valid_v1(wmr.id,v_perm.id)
      and (
        (wmr.scope_type = 'workspace')
        or (wmr.scope_type = 'property' and p_target_scope_type in ('property', 'building', 'unit') and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and p_target_scope_type in ('building', 'unit') and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and p_target_scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$$;

create or replace function app_private.check_effective_permission_v2(
  p_context_id uuid,
  p_permission_code text,
  p_module_code text,
  p_target_scope_type text,
  p_target_scope_id uuid,
  p_explicit_workspace_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, platform, identity, portfolio, app_private
as $$
declare
  v_res record;
  v_perm identity.permissions%rowtype;
  v_mod_ids uuid[];
  v_mod platform.module_definitions%rowtype;
  v_binding_ids uuid[];
  v_binding platform.module_permission_bindings%rowtype;
  v_tax_ids uuid[];
  v_profile record;
  v_target_property_id uuid;
  v_target_building_id uuid;
  v_target_unit_id uuid;
  v_has_allow boolean := false;
begin
  if p_context_id is null or p_permission_code is null or p_module_code is null or p_target_scope_type is null then
    return false;
  end if;

  if p_target_scope_type not in ('workspace', 'property', 'building', 'unit') then
    return false;
  end if;

  if p_target_scope_type <> 'workspace' and p_target_scope_id is null then
    return false;
  end if;

  begin
    if p_explicit_workspace_id is null then
      select * into v_res from app_private.resolve_workspace_from_customer_context_v1(p_context_id,false);
    else
      if p_target_scope_type is distinct from 'workspace'
        or p_target_scope_id is distinct from p_explicit_workspace_id then return false; end if;
      select * into v_res from app_private.resolve_workspace_native_context_v2(p_context_id,p_explicit_workspace_id);
    end if;
  exception when others then
    return false;
  end;

  if v_res.workspace_id is null or v_res.membership_id is null then
    return false;
  end if;

  select * into v_perm from identity.permissions where code = p_permission_code;
  if not found then return false; end if;

  select array_agg(id) into v_mod_ids
  from platform.module_definitions
  where code = p_module_code
    and is_active = true
    and lifecycle_status in ('active', 'published')
    and lifecycle_status <> 'catalog_only'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= statement_timestamp()
    and (valid_to is null or valid_to > statement_timestamp());

  if coalesce(cardinality(v_binding_ids), 0) <> 1 then return false; end if;
  select * into v_binding from platform.module_permission_bindings where id = v_binding_ids[1];

  if p_explicit_workspace_id is not null
    and (v_mod.requires_aal2 or v_binding.requires_aal2)
    and coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then return false; end if;

  if not exists (
    select 1 from platform.workspace_modules
    where customer_workspace_id = v_res.workspace_id
      and module_code = p_module_code
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= statement_timestamp() and (e.valid_until is null or e.valid_until > statement_timestamp())
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
            then e.override_value_json = 'true'::jsonb
          else (e.boolean_value is true or e.numeric_value > 0)
        end
      )
  ) then
    return false;
  end if;

  select array_agg(wta.id) into v_tax_ids
  from platform.workspace_taxonomy_assignments wta
  where wta.customer_workspace_id = v_res.workspace_id
    and wta.status = 'active'
    and wta.valid_from <= statement_timestamp()
    and (wta.valid_to is null or wta.valid_to > statement_timestamp());

  if coalesce(cardinality(v_tax_ids), 0) <> 1 then return false; end if;

  select pp.id as profile_id, om.id as model_id into v_profile
  from platform.workspace_taxonomy_assignments wta
  join platform.property_profiles pp on pp.id = wta.property_profile_id
  join platform.operating_models om on om.id = wta.operating_model_id
  where wta.id = v_tax_ids[1];

  if not exists (
    select 1
    from platform.module_property_profile_compatibilities ppc
    join platform.module_operating_model_compatibilities omc
      on omc.module_definition_id = ppc.module_definition_id
    where ppc.module_definition_id = v_mod.id
      and ppc.property_profile_id = v_profile.profile_id
      and ppc.compatibility_level = 'compatible'
      and omc.operating_model_id = v_profile.model_id
      and omc.compatibility_level = 'compatible'
  ) then
    return false;
  end if;

  if p_target_scope_type = 'property' then
    v_target_property_id := p_target_scope_id;
  elsif p_target_scope_type = 'building' then
    select property_id into v_target_property_id from portfolio.buildings where id = p_target_scope_id;
    v_target_building_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  elsif p_target_scope_type = 'unit' then
    select u.building_id, b.property_id
    into v_target_building_id, v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = p_target_scope_id;
    v_target_unit_id := p_target_scope_id;
    if v_target_property_id is null then return false; end if;
  end if;

  if v_target_property_id is not null and not exists (
    select 1 from platform.workspace_property_bindings
    where customer_workspace_id = v_res.workspace_id
      and property_id = v_target_property_id
      and status = 'active'
      and valid_from <= statement_timestamp()
      and (valid_to is null or valid_to > statement_timestamp())
  ) then
    return false;
  end if;

  -- Deny Path A
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id and rp.permission_id = v_perm.id and rp.effect = 'deny'
  ) then
    return false;
  end if;

  -- Deny Path B
  if exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = v_res.membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'deny'
      and (
        wmr.scope_type = 'workspace'
        or (wmr.scope_type = 'property' and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    return false;
  end if;

  -- Allow Path A
  if exists (
    select 1 from identity.role_permissions rp
    where rp.role_id = v_res.role_id and rp.permission_id = v_perm.id and rp.effect = 'allow'
  ) then
    v_has_allow := true;
  end if;

  -- Allow Path B
  if not v_has_allow and exists (
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id = wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id = wr.id
    join platform.workspace_role_modules wrm on wrm.workspace_role_id = wr.id
    where wmr.customer_workspace_id = v_res.workspace_id
      and wmr.membership_id = v_res.membership_id
      and (p_explicit_workspace_id is null or (wmr.tenant_id=v_res.tenant_id and wr.tenant_id=v_res.tenant_id and wr.customer_workspace_id=v_res.workspace_id))
      and wmr.valid_from <= statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to > statement_timestamp())
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= statement_timestamp()
      and (wr.valid_to is null or wr.valid_to > statement_timestamp())
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and app_private.workspace_role_handover_lineage_valid_v1(wmr.id,v_perm.id)
      and (
        wmr.scope_type = 'workspace'
        or (wmr.scope_type = 'property' and wmr.property_id = v_target_property_id)
        or (wmr.scope_type = 'building' and wmr.building_id = v_target_building_id)
        or (wmr.scope_type = 'unit' and wmr.unit_id = v_target_unit_id)
      )
  ) then
    v_has_allow := true;
  end if;

  -- Path C: Valid Delegated Allow (Zero recursion: checks grantor via direct helper only)
  if not v_has_allow and exists (
    select 1
    from platform.workspace_delegations wd
    join platform.workspace_delegation_permissions wdp on wdp.delegation_id = wd.id
    join platform.module_permission_bindings mpb on mpb.id = wdp.module_permission_binding_id
    where wd.customer_workspace_id = v_res.workspace_id
      and wd.grantee_membership_id = v_res.membership_id
      and (p_explicit_workspace_id is null or (wd.tenant_id=v_res.tenant_id
        and mpb.module_definition_id=v_mod.id and mpb.permission_id=v_perm.id
        and mpb.valid_from<=statement_timestamp() and (mpb.valid_to is null or mpb.valid_to>statement_timestamp())))
      and wd.lifecycle_status = 'active'
      and wd.valid_from <= statement_timestamp()
      and wd.valid_until > statement_timestamp()
      and wdp.module_definition_id = v_mod.id
      and wdp.permission_id = v_perm.id
      and mpb.is_delegable = true
      and mpb.lifecycle_status = 'active'
      and (
        wd.scope_type = 'workspace'
        or (wd.scope_type = 'property' and wd.property_id = v_target_property_id)
        or (wd.scope_type = 'building' and wd.building_id = v_target_building_id)
        or (wd.scope_type = 'unit' and wd.unit_id = v_target_unit_id)
      )
      -- Dynamic Fail-Closed Grantor Check:
      and exists (
        select 1 from identity.context_grants gcg
        where gcg.membership_id = wd.grantor_membership_id
          and gcg.tenant_id = v_res.tenant_id
          and gcg.starts_at <= statement_timestamp()
          and (gcg.ends_at is null or gcg.ends_at > statement_timestamp())
          and app_private.check_direct_effective_permission_v2(
            gcg.id,
            wd.grantor_membership_id,
            p_permission_code,
            p_module_code,
            wd.scope_type,
            coalesce(wd.unit_id, wd.building_id, wd.property_id, v_res.workspace_id),
            p_explicit_workspace_id
          ) = true
      )
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$$;

commit;
