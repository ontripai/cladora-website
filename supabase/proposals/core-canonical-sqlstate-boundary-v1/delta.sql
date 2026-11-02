-- CORE-CANONICAL-SQLSTATE-BOUNDARY-12: review-only independent delta, NOT an installer
-- Existing migrations/installers/guards immutable. Exact preimage required. No execution authority.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $hold$ BEGIN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_review_only_execution_hold'; END $hold$;

CREATE TEMP TABLE core12_targets(signature text PRIMARY KEY,before_bytes integer,before_sha text,after_sha text) ON COMMIT DROP;
INSERT INTO pg_temp.core12_targets VALUES
('app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)',11223,'8f00424daca0ede92c652b5137a498b19797db611cb0b20054413041869d57c9','e0ca913af05edc8320b7201343d10f3aa442a57586d3419cd68e4547b477f092'),
('app_private.check_effective_permission_v2_at_v1(uuid,text,text,text,uuid,uuid,timestamptz)',11131,'c24b1a4d049d3466d86d693f0d9a19ded0bdd85296384e17fc44fca0ff0b4d63','e82983f82b06ca498015ddf2821ab43fa40e2b0eb04dc36cbaa1057151227528'),
('app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)',1644,'f0928f38cb5d10127d103c95938c4ebfbbaf5b2ffe3a390afa4865b57cd23e10','9949d588f2ab98dbc4a95db587e427f82f00b2bd2e5f71f139c7af3511f2db18'),
('app_private.workspace_context_covers_role_scope_v1_at_v1(uuid,uuid,text,uuid,timestamptz)',1790,'5f60bb3c24d48a03c679bd7224696feb2c2f5040158b9d2e3333987954fe662e','c85ef4ec54a679dffd982f4252557a9b784fbb125cab37ef8050706f67ccbcf3'),
('app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])',5917,'8cdc0a8b98478147a11db0da64ecb6656feacf5a0c1cf7709433a36735f3257b','5b62320bd3c4fa799405f9dfccbb37aa612db79531588578b968f0f8b5a3769f'),
('app_private.workspace_member_role_authority_active_v1_at_v1(uuid,uuid,uuid,text,uuid,uuid[],timestamptz)',5975,'8b50fb008031e95bd99d5660777c5868b90fee7e5e69c445bded6c7328676c38','a69b967e373ffc99a8c2a5992ce73c0c15b6ae7cf5ee90107d4fb096cf370e9c'),
('app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)',3902,'58c63fb293ae7354f69bddb6f0dac572a0d2913281ca96634d093e2d84dd85e4','460ed1455bcb7f1cbfbe46cd52cb716d699aa56aa9175d646b0b5d16d7b87e78'),
('app_private.workspace_role_identity_source_current_v1_at_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,timestamptz)',3950,'01f6a216814ad9902a68e9c922574ccbb61c26b01db9a2e159d813cae035a886','5216f63f910d921463447dc72b85ac7763b5d29cd8f2996beefdfa0e26865045');
DO $pre$ DECLARE t record; p record; BEGIN
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999 THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_pg17_required'; END IF;
 FOR t IN SELECT * FROM pg_temp.core12_targets LOOP
  SELECT r.*,l.lanname INTO p FROM pg_proc r JOIN pg_language l ON l.oid=r.prolang WHERE r.oid=to_regprocedure(t.signature);
  IF NOT FOUND OR p.lanname<>'plpgsql' OR p.prokind<>'f' OR p.provolatile<>'s' OR NOT p.prosecdef OR p.proisstrict OR p.proretset OR p.prorettype<>'boolean'::regtype
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
   OR octet_length(convert_to(p.prosrc,'UTF8'))<>t.before_bytes
   OR encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>t.before_sha
  THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_preimage_mismatch'; END IF;
  IF NOT pg_has_role(current_user,p.proowner,'USAGE') OR NOT has_schema_privilege(current_user,p.pronamespace,'CREATE') THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_exact_owner_create_required'; END IF;
 END LOOP;
END $pre$;
CREATE TEMP TABLE core12_before ON COMMIT DROP AS SELECT p.oid,p.prosrc,to_jsonb(p)-'prosrc' AS attributes FROM pg_proc p;
CREATE TEMP TABLE core12_defaults ON COMMIT DROP AS SELECT to_jsonb(d) AS value FROM pg_default_acl d;
CREATE TEMP TABLE core12_dependencies ON COMMIT DROP AS SELECT to_jsonb(d) AS value FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid IN (SELECT to_regprocedure(signature) FROM pg_temp.core12_targets);

-- supabase/install/v14-operations/foundation.sql:6110; app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)
-- before-prosrc 8f00424daca0ede92c652b5137a498b19797db611cb0b20054413041869d57c9; after-prosrc e0ca913af05edc8320b7201343d10f3aa442a57586d3419cd68e4547b477f092
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
set search_path =pg_catalog
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
  exception when sqlstate '40001' then raise; when others then
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
      and app_private.workspace_member_role_authority_active_v1(wmr.id,v_perm.id,v_mod.id,p_target_scope_type,p_target_scope_id)
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

-- supabase/install/v14-operations/building-provisioning.sql:1491; app_private.check_effective_permission_v2_at_v1(uuid,text,text,text,uuid,uuid,timestamptz)
-- before-prosrc c24b1a4d049d3466d86d693f0d9a19ded0bdd85296384e17fc44fca0ff0b4d63; after-prosrc e82983f82b06ca498015ddf2821ab43fa40e2b0eb04dc36cbaa1057151227528
create or replace function app_private.check_effective_permission_v2_at_v1(p_context_id uuid,p_permission_code text,p_module_code text,p_target_scope_type text,p_target_scope_id uuid,p_explicit_workspace_id uuid,p_checked_at timestamptz)
returns boolean
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
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
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;

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
      select * into v_res from app_private.resolve_workspace_from_customer_context_v1_at_v1(p_context_id,false,p_checked_at);
    else
      if p_target_scope_type is distinct from 'workspace'
        or p_target_scope_id is distinct from p_explicit_workspace_id then return false; end if;
      select * into v_res from app_private.resolve_workspace_native_context_v2_at_v1(p_context_id,p_explicit_workspace_id,p_checked_at);
    end if;
  exception when sqlstate '40001' then raise; when others then
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
    and valid_from <= p_checked_at
    and (valid_to is null or valid_to > p_checked_at);

  if coalesce(cardinality(v_mod_ids), 0) <> 1 then return false; end if;
  select * into v_mod from platform.module_definitions where id = v_mod_ids[1];

  select array_agg(id) into v_binding_ids
  from platform.module_permission_bindings
  where module_definition_id = v_mod.id
    and permission_id = v_perm.id
    and is_assignable_to_local_role = true
    and lifecycle_status = 'active'
    and valid_from <= p_checked_at
    and (valid_to is null or valid_to > p_checked_at);

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
      and valid_from <= p_checked_at
      and (valid_to is null or valid_to > p_checked_at)
  ) then
    return false;
  end if;

  if v_mod.entitlement_key is not null and not exists (
    select 1 from platform.workspace_entitlements e
    where e.customer_workspace_id = v_res.workspace_id
      and e.entitlement_key = v_mod.entitlement_key
      and e.valid_from <= p_checked_at and (e.valid_until is null or e.valid_until > p_checked_at)
      and (
        case
          when e.override_value_json is not null and e.override_expires_at > p_checked_at
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
    and wta.valid_from <= p_checked_at
    and (wta.valid_to is null or wta.valid_to > p_checked_at);

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
      and valid_from <= p_checked_at
      and (valid_to is null or valid_to > p_checked_at)
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
      and wmr.valid_from <= p_checked_at
      and (wmr.valid_to is null or wmr.valid_to > p_checked_at)
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= p_checked_at
      and (wr.valid_to is null or wr.valid_to > p_checked_at)
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
      and wmr.valid_from <= p_checked_at
      and (wmr.valid_to is null or wmr.valid_to > p_checked_at)
      and wr.lifecycle_status = 'published'
      and wr.valid_from <= p_checked_at
      and (wr.valid_to is null or wr.valid_to > p_checked_at)
      and wrm.module_definition_id = v_mod.id
      and wrp.permission_id = v_perm.id
      and wrp.effect = 'allow'
      and app_private.workspace_member_role_authority_active_v1_at_v1(wmr.id,v_perm.id,v_mod.id,p_target_scope_type,p_target_scope_id,'{}'::uuid[],p_checked_at)
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
        and mpb.valid_from<=p_checked_at and (mpb.valid_to is null or mpb.valid_to>p_checked_at)))
      and wd.lifecycle_status = 'active'
      and wd.valid_from <= p_checked_at
      and wd.valid_until > p_checked_at
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
          and gcg.starts_at <= p_checked_at
          and (gcg.ends_at is null or gcg.ends_at > p_checked_at)
          and app_private.check_direct_effective_permission_v2_at_v1(gcg.id,wd.grantor_membership_id,p_permission_code,p_module_code,wd.scope_type,coalesce(wd.unit_id, wd.building_id, wd.property_id, v_res.workspace_id),p_explicit_workspace_id,p_checked_at) = true
      )
  ) then
    v_has_allow := true;
  end if;

  return v_has_allow;
end;
$function$;

-- supabase/install/v14-operations/foundation.sql:5056; app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)
-- before-prosrc f0928f38cb5d10127d103c95938c4ebfbbaf5b2ffe3a390afa4865b57cd23e10; after-prosrc 9949d588f2ab98dbc4a95db587e427f82f00b2bd2e5f71f139c7af3511f2db18
create or replace function app_private.workspace_context_covers_role_scope_v1(
 p_context_id uuid,p_tenant_id uuid,p_scope_type text,p_scope_id uuid
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,identity,portfolio,app_private as $$
declare c record; v_property uuid; v_building uuid; v_unit uuid;
begin
 select * into c from identity.context_grants g
 where g.id=p_context_id and g.tenant_id=p_tenant_id
   and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp());
 if not found then return false; end if;
 if p_scope_type='workspace' then return c.scope_type='tenant'; end if;
 if p_scope_type='property' then v_property:=p_scope_id;
 elsif p_scope_type='building' then
   v_building:=p_scope_id;
   select b.property_id into v_property from portfolio.buildings b where b.id=p_scope_id and b.tenant_id=p_tenant_id;
 elsif p_scope_type='unit' then
   v_unit:=p_scope_id;
   select u.building_id,b.property_id into v_building,v_property
   from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
   where u.id=p_scope_id and u.tenant_id=p_tenant_id;
 else return false; end if;
 if v_property is null then return false; end if;
 if c.scope_type='tenant' then return true; end if;
 if c.scope_type='property' then
   return c.property_id=v_property;
 elsif c.scope_type='building' then
   if v_building is null and p_scope_type='property' then return false; end if;
   if v_building is null then
     select b.id into v_building from portfolio.buildings b where b.property_id=v_property and b.tenant_id=p_tenant_id;
     if not found then return false; end if;
   end if;
   return c.building_id=v_building;
 elsif c.scope_type='unit' then
   if p_scope_type<>'unit' then return false; end if;
   return c.unit_id=v_unit;
 end if;
 return false;
exception when sqlstate '40001' then raise; when others then return false;
end;
$$;

-- supabase/install/v14-operations/building-provisioning.sql:695; app_private.workspace_context_covers_role_scope_v1_at_v1(uuid,uuid,text,uuid,timestamptz)
-- before-prosrc 5f60bb3c24d48a03c679bd7224696feb2c2f5040158b9d2e3333987954fe662e; after-prosrc c85ef4ec54a679dffd982f4252557a9b784fbb125cab37ef8050706f67ccbcf3
create or replace function app_private.workspace_context_covers_role_scope_v1_at_v1(p_context_id uuid,p_tenant_id uuid,p_scope_type text,p_scope_id uuid,p_checked_at timestamptz)
returns boolean
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
declare c record; v_property uuid; v_building uuid; v_unit uuid;
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;

 select * into c from identity.context_grants g
 where g.id=p_context_id and g.tenant_id=p_tenant_id
   and g.starts_at<=p_checked_at and (g.ends_at is null or g.ends_at>p_checked_at);
 if not found then return false; end if;
 if p_scope_type='workspace' then return c.scope_type='tenant'; end if;
 if p_scope_type='property' then v_property:=p_scope_id;
 elsif p_scope_type='building' then
   v_building:=p_scope_id;
   select b.property_id into v_property from portfolio.buildings b where b.id=p_scope_id and b.tenant_id=p_tenant_id;
 elsif p_scope_type='unit' then
   v_unit:=p_scope_id;
   select u.building_id,b.property_id into v_building,v_property
   from portfolio.units u join portfolio.buildings b on b.id=u.building_id and b.tenant_id=u.tenant_id
   where u.id=p_scope_id and u.tenant_id=p_tenant_id;
 else return false; end if;
 if v_property is null then return false; end if;
 if c.scope_type='tenant' then return true; end if;
 if c.scope_type='property' then
   return c.property_id=v_property;
 elsif c.scope_type='building' then
   if v_building is null and p_scope_type='property' then return false; end if;
   if v_building is null then
     select b.id into v_building from portfolio.buildings b where b.property_id=v_property and b.tenant_id=p_tenant_id;
     if not found then return false; end if;
   end if;
   return c.building_id=v_building;
 elsif c.scope_type='unit' then
   if p_scope_type<>'unit' then return false; end if;
   return c.unit_id=v_unit;
 end if;
 return false;
exception when sqlstate '40001' then raise; when others then return false;
end;
$function$;

-- supabase/install/v14-operations/foundation.sql:5316; app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])
-- before-prosrc 8cdc0a8b98478147a11db0da64ecb6656feacf5a0c1cf7709433a36735f3257b; after-prosrc 5b62320bd3c4fa799405f9dfccbb37aa612db79531588578b968f0f8b5a3769f
create or replace function app_private.workspace_member_role_authority_active_v1(
 p_assignment_id uuid,p_permission_id uuid,p_module_id uuid,
 p_target_scope_type text,p_target_scope_id uuid,p_path uuid[] default '{}'::uuid[]
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private as $$
declare
 a record; s record; grantor_rec record; wr record; v_code text; v_module text;
 v_prop uuid; v_bld uuid; v_unit uuid; v_workspace_id uuid;
begin
 if p_assignment_id is null or p_assignment_id=any(coalesce(p_path,'{}'::uuid[]))
    or cardinality(coalesce(p_path,'{}'::uuid[]))>=5 then return false; end if;
 select wmr.* into a from platform.workspace_member_roles wmr
 join identity.memberships m on m.id=wmr.membership_id and m.tenant_id=wmr.tenant_id
 join platform.workspace_roles r on r.id=wmr.workspace_role_id and r.customer_workspace_id=wmr.customer_workspace_id
 where wmr.id=p_assignment_id and wmr.valid_from<=statement_timestamp()
   and (wmr.valid_to is null or wmr.valid_to>statement_timestamp())
   and m.status='active' and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp())
   and r.lifecycle_status='published' and r.valid_from<=statement_timestamp() and (r.valid_to is null or r.valid_to>statement_timestamp());
 if not found then return false; end if;
 if not app_private.workspace_role_scope_contains_v1(
   a.scope_type,a.property_id,a.building_id,a.unit_id,
   p_target_scope_type,
   case when p_target_scope_type='property' then p_target_scope_id when p_target_scope_type in ('building','unit') then
      (select b.property_id from portfolio.buildings b where b.id=case when p_target_scope_type='building' then p_target_scope_id else (select u.building_id from portfolio.units u where u.id=p_target_scope_id) end) end,
   case when p_target_scope_type='building' then p_target_scope_id when p_target_scope_type='unit' then (select u.building_id from portfolio.units u where u.id=p_target_scope_id) end,
   case when p_target_scope_type='unit' then p_target_scope_id end
 ) then return false; end if;
 if a.authority_policy_version=1 then return true; end if;
 if a.authority_policy_version<>2 then return false; end if;
 if not app_private.workspace_context_covers_role_scope_v1(
   a.assigned_by_context_grant_id,a.tenant_id,p_target_scope_type,p_target_scope_id) then return false; end if;

 select p.code into v_code from identity.permissions p where p.id=p_permission_id;
 select md.code into v_module from platform.module_definitions md where md.id=p_module_id
   and md.is_active and md.lifecycle_status in ('active','published')
   and md.valid_from<=statement_timestamp() and (md.valid_to is null or md.valid_to>statement_timestamp());
 if v_code is null or v_module is null
    or not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=p_module_id and b.permission_id=p_permission_id
        and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
        and b.valid_from<=statement_timestamp() and (b.valid_to is null or b.valid_to>statement_timestamp()))
 then return false; end if;
 if not exists(select 1 from platform.workspace_role_permissions rp
      join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
      where rp.workspace_role_id=a.workspace_role_id and rp.permission_id=p_permission_id
        and rm.module_definition_id=p_module_id and rp.effect='allow') then return false; end if;
 if exists(select 1 from platform.workspace_role_permissions rp
      join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
      where rp.workspace_role_id=a.workspace_role_id and rp.permission_id=p_permission_id
        and rm.module_definition_id=p_module_id and rp.effect='deny') then return false; end if;

 select * into s from platform.workspace_member_role_authority_sources x
 where x.assignment_id=a.id and x.permission_id=p_permission_id and x.module_definition_id=p_module_id;
 if not found then return false; end if;

 if s.source_kind='identity_role' then
   select grantor.* into grantor_rec from identity.memberships grantor
    where grantor.id=a.assigned_by_membership_id and grantor.tenant_id=a.tenant_id
      and grantor.status='active' and grantor.starts_at<=statement_timestamp()
      and (grantor.ends_at is null or grantor.ends_at>statement_timestamp());
   if not found or grantor_rec.role_id is distinct from s.source_identity_role_id
      or not exists(select 1 from identity.role_permissions rp
         where rp.role_id=grantor_rec.role_id and rp.permission_id=p_permission_id and rp.effect='allow')
      or exists(select 1 from identity.role_permissions rp
         where rp.role_id=grantor_rec.role_id and rp.permission_id=p_permission_id and rp.effect='deny') then return false; end if;
   return app_private.workspace_role_identity_source_current_v1(
      a.assigned_by_context_grant_id,a.assigned_by_membership_id,s.source_identity_role_id,
      a.tenant_id,a.customer_workspace_id,p_permission_id,p_module_id,
      p_target_scope_type,p_target_scope_id);
 elsif s.source_kind='workspace_role_assignment' then
   select parent.* into wr from platform.workspace_member_roles parent
   where parent.id=s.source_assignment_id
     and parent.customer_workspace_id=a.customer_workspace_id
     and parent.tenant_id=a.tenant_id
     and parent.membership_id=a.assigned_by_membership_id
     and parent.authority_policy_version=2
     and parent.valid_from<=statement_timestamp()
     and (parent.valid_to is null or parent.valid_to>statement_timestamp())
     and app_private.workspace_role_scope_contains_v1(
       parent.scope_type,parent.property_id,parent.building_id,parent.unit_id,
       a.scope_type,a.property_id,a.building_id,a.unit_id);
   if not found then return false; end if;
   if s.authority_depth>4 or s.authority_depth<>wr.authority_depth+1 then return false; end if;
   return app_private.workspace_member_role_authority_active_v1(
     wr.id,p_permission_id,p_module_id,p_target_scope_type,p_target_scope_id,
     array_append(coalesce(p_path,'{}'::uuid[]),a.id));
 end if;
 return false;
exception when sqlstate '40001' then raise; when others then return false;
end;
$$;

-- supabase/install/v14-operations/building-provisioning.sql:804; app_private.workspace_member_role_authority_active_v1_at_v1(uuid,uuid,uuid,text,uuid,uuid[],timestamptz)
-- before-prosrc 8b50fb008031e95bd99d5660777c5868b90fee7e5e69c445bded6c7328676c38; after-prosrc a69b967e373ffc99a8c2a5992ce73c0c15b6ae7cf5ee90107d4fb096cf370e9c
create or replace function app_private.workspace_member_role_authority_active_v1_at_v1(p_assignment_id uuid,p_permission_id uuid,p_module_id uuid,p_target_scope_type text,p_target_scope_id uuid,p_path uuid[],p_checked_at timestamptz)
returns boolean
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
declare
 a record; s record; grantor_rec record; wr record; v_code text; v_module text;
 v_prop uuid; v_bld uuid; v_unit uuid; v_workspace_id uuid;
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;

 if p_assignment_id is null or p_assignment_id=any(coalesce(p_path,'{}'::uuid[]))
    or cardinality(coalesce(p_path,'{}'::uuid[]))>=5 then return false; end if;
 select wmr.* into a from platform.workspace_member_roles wmr
 join identity.memberships m on m.id=wmr.membership_id and m.tenant_id=wmr.tenant_id
 join platform.workspace_roles r on r.id=wmr.workspace_role_id and r.customer_workspace_id=wmr.customer_workspace_id
 where wmr.id=p_assignment_id and wmr.valid_from<=p_checked_at
   and (wmr.valid_to is null or wmr.valid_to>p_checked_at)
   and m.status='active' and m.starts_at<=p_checked_at and (m.ends_at is null or m.ends_at>p_checked_at)
   and r.lifecycle_status='published' and r.valid_from<=p_checked_at and (r.valid_to is null or r.valid_to>p_checked_at);
 if not found then return false; end if;
 if not app_private.workspace_role_scope_contains_v1(
   a.scope_type,a.property_id,a.building_id,a.unit_id,
   p_target_scope_type,
   case when p_target_scope_type='property' then p_target_scope_id when p_target_scope_type in ('building','unit') then
      (select b.property_id from portfolio.buildings b where b.id=case when p_target_scope_type='building' then p_target_scope_id else (select u.building_id from portfolio.units u where u.id=p_target_scope_id) end) end,
   case when p_target_scope_type='building' then p_target_scope_id when p_target_scope_type='unit' then (select u.building_id from portfolio.units u where u.id=p_target_scope_id) end,
   case when p_target_scope_type='unit' then p_target_scope_id end
 ) then return false; end if;
 if a.authority_policy_version=1 then return true; end if;
 if a.authority_policy_version<>2 then return false; end if;
 if not app_private.workspace_context_covers_role_scope_v1_at_v1(a.assigned_by_context_grant_id,a.tenant_id,p_target_scope_type,p_target_scope_id,p_checked_at) then return false; end if;

 select p.code into v_code from identity.permissions p where p.id=p_permission_id;
 select md.code into v_module from platform.module_definitions md where md.id=p_module_id
   and md.is_active and md.lifecycle_status in ('active','published')
   and md.valid_from<=p_checked_at and (md.valid_to is null or md.valid_to>p_checked_at);
 if v_code is null or v_module is null
    or not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=p_module_id and b.permission_id=p_permission_id
        and b.is_assignable_to_local_role and b.is_delegable and b.lifecycle_status='active'
        and b.valid_from<=p_checked_at and (b.valid_to is null or b.valid_to>p_checked_at))
 then return false; end if;
 if not exists(select 1 from platform.workspace_role_permissions rp
      join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
      where rp.workspace_role_id=a.workspace_role_id and rp.permission_id=p_permission_id
        and rm.module_definition_id=p_module_id and rp.effect='allow') then return false; end if;
 if exists(select 1 from platform.workspace_role_permissions rp
      join platform.workspace_role_modules rm on rm.workspace_role_id=rp.workspace_role_id
      where rp.workspace_role_id=a.workspace_role_id and rp.permission_id=p_permission_id
        and rm.module_definition_id=p_module_id and rp.effect='deny') then return false; end if;

 select * into s from platform.workspace_member_role_authority_sources x
 where x.assignment_id=a.id and x.permission_id=p_permission_id and x.module_definition_id=p_module_id;
 if not found then return false; end if;

 if s.source_kind='identity_role' then
   select grantor.* into grantor_rec from identity.memberships grantor
    where grantor.id=a.assigned_by_membership_id and grantor.tenant_id=a.tenant_id
      and grantor.status='active' and grantor.starts_at<=p_checked_at
      and (grantor.ends_at is null or grantor.ends_at>p_checked_at);
   if not found or grantor_rec.role_id is distinct from s.source_identity_role_id
      or not exists(select 1 from identity.role_permissions rp
         where rp.role_id=grantor_rec.role_id and rp.permission_id=p_permission_id and rp.effect='allow')
      or exists(select 1 from identity.role_permissions rp
         where rp.role_id=grantor_rec.role_id and rp.permission_id=p_permission_id and rp.effect='deny') then return false; end if;
   return app_private.workspace_role_identity_source_current_v1_at_v1(a.assigned_by_context_grant_id,a.assigned_by_membership_id,s.source_identity_role_id,a.tenant_id,a.customer_workspace_id,p_permission_id,p_module_id,p_target_scope_type,p_target_scope_id,p_checked_at);
 elsif s.source_kind='workspace_role_assignment' then
   select parent.* into wr from platform.workspace_member_roles parent
   where parent.id=s.source_assignment_id
     and parent.customer_workspace_id=a.customer_workspace_id
     and parent.tenant_id=a.tenant_id
     and parent.membership_id=a.assigned_by_membership_id
     and parent.authority_policy_version=2
     and parent.valid_from<=p_checked_at
     and (parent.valid_to is null or parent.valid_to>p_checked_at)
     and app_private.workspace_role_scope_contains_v1(
       parent.scope_type,parent.property_id,parent.building_id,parent.unit_id,
       a.scope_type,a.property_id,a.building_id,a.unit_id);
   if not found then return false; end if;
   if s.authority_depth>4 or s.authority_depth<>wr.authority_depth+1 then return false; end if;
   return app_private.workspace_member_role_authority_active_v1_at_v1(wr.id,p_permission_id,p_module_id,p_target_scope_type,p_target_scope_id,array_append(coalesce(p_path,'{}'::uuid[]),a.id),p_checked_at);
 end if;
 return false;
exception when sqlstate '40001' then raise; when others then return false;
end;
$function$;

-- supabase/install/v14-operations/foundation.sql:5239; app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)
-- before-prosrc 58c63fb293ae7354f69bddb6f0dac572a0d2913281ca96634d093e2d84dd85e4; after-prosrc 460ed1455bcb7f1cbfbe46cd52cb716d699aa56aa9175d646b0b5d16d7b87e78
create or replace function app_private.workspace_role_identity_source_current_v1(
 p_context_id uuid,p_grantor_membership_id uuid,p_identity_role_id uuid,
 p_tenant_id uuid,p_workspace_id uuid,p_permission_id uuid,p_module_id uuid,
 p_scope_type text,p_scope_id uuid
) returns boolean language plpgsql stable security definer
set search_path=pg_catalog,platform,identity,portfolio,app_private as $$
declare v_member record; v_module record;
begin
 select m.* into v_member from identity.memberships m
 where m.id=p_grantor_membership_id and m.tenant_id=p_tenant_id
   and m.role_id=p_identity_role_id and m.status='active'
   and m.starts_at<=statement_timestamp() and (m.ends_at is null or m.ends_at>statement_timestamp());
 if not found or not exists(select 1 from identity.context_grants g
    where g.id=p_context_id and g.membership_id=p_grantor_membership_id and g.tenant_id=p_tenant_id
      and g.starts_at<=statement_timestamp() and (g.ends_at is null or g.ends_at>statement_timestamp()))
    or not app_private.workspace_context_covers_role_scope_v1(p_context_id,p_tenant_id,p_scope_type,p_scope_id)
    or not exists(select 1 from identity.role_permissions rp
      where rp.role_id=p_identity_role_id and rp.permission_id=p_permission_id and rp.effect='allow')
    or exists(select 1 from identity.role_permissions rp
      where rp.role_id=p_identity_role_id and rp.permission_id=p_permission_id and rp.effect='deny')
    or not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=p_module_id and b.permission_id=p_permission_id
        and b.is_assignable_to_local_role and b.is_delegable
        and b.lifecycle_status='active' and b.valid_from<=statement_timestamp()
        and (b.valid_to is null or b.valid_to>statement_timestamp()))
    or not exists(select 1 from platform.workspace_modules wm
      where wm.customer_workspace_id=p_workspace_id
        and wm.module_definition_id=p_module_id and wm.status='active'
        and wm.valid_from<=statement_timestamp() and (wm.valid_to is null or wm.valid_to>statement_timestamp()))
    or exists(select 1 from platform.module_definitions md
      where md.id=p_module_id and md.entitlement_key is not null
        and not exists(select 1 from platform.workspace_entitlements e
          where e.customer_workspace_id=p_workspace_id and e.entitlement_key=md.entitlement_key
            and e.valid_from<=statement_timestamp() and (e.valid_until is null or e.valid_until>statement_timestamp())
            and case when e.override_value_json is not null and e.override_expires_at>statement_timestamp()
              then e.override_value_json='true'::jsonb else (e.boolean_value is true or e.numeric_value>0) end))
 then return false; end if;

 -- A deny on the grantor wins even when the underlying identity role allows.
 if exists(
   select 1 from platform.workspace_member_roles a
   join platform.workspace_roles r on r.id=a.workspace_role_id
   join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id
   join platform.workspace_role_modules rm on rm.workspace_role_id=r.id
   where a.customer_workspace_id=p_workspace_id and a.membership_id=p_grantor_membership_id
     and a.valid_from<=statement_timestamp() and (a.valid_to is null or a.valid_to>statement_timestamp())
     and r.lifecycle_status='published' and r.valid_from<=statement_timestamp()
     and (r.valid_to is null or r.valid_to>statement_timestamp())
     and rp.permission_id=p_permission_id and rp.effect='deny' and rm.module_definition_id=p_module_id
     and app_private.workspace_role_scope_overlaps_v1(
       a.scope_type,a.property_id,a.building_id,a.unit_id,
       p_scope_type,
       case when p_scope_type='property' then p_scope_id when p_scope_type in ('building','unit') then
         (select b.property_id from portfolio.buildings b where b.id=case when p_scope_type='building' then p_scope_id else (select u.building_id from portfolio.units u where u.id=p_scope_id) end) end,
       case when p_scope_type='building' then p_scope_id when p_scope_type='unit' then (select u.building_id from portfolio.units u where u.id=p_scope_id) end,
       case when p_scope_type='unit' then p_scope_id end)
 ) then return false; end if;
 return true;
exception when sqlstate '40001' then raise; when others then return false;
end;
$$;

-- supabase/install/v14-operations/building-provisioning.sql:740; app_private.workspace_role_identity_source_current_v1_at_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,timestamptz)
-- before-prosrc 01f6a216814ad9902a68e9c922574ccbb61c26b01db9a2e159d813cae035a886; after-prosrc 5216f63f910d921463447dc72b85ac7763b5d29cd8f2996beefdfa0e26865045
create or replace function app_private.workspace_role_identity_source_current_v1_at_v1(p_context_id uuid,p_grantor_membership_id uuid,p_identity_role_id uuid,p_tenant_id uuid,p_workspace_id uuid,p_permission_id uuid,p_module_id uuid,p_scope_type text,p_scope_id uuid,p_checked_at timestamptz)
returns boolean
language plpgsql stable security definer called on null input set search_path=pg_catalog
as $function$
declare v_member record; v_module record;
begin
 if p_checked_at is null or not pg_catalog.isfinite(p_checked_at) then
  raise exception using errcode='42501',message='request_checkpoint_time_invalid';
 end if;

 select m.* into v_member from identity.memberships m
 where m.id=p_grantor_membership_id and m.tenant_id=p_tenant_id
   and m.role_id=p_identity_role_id and m.status='active'
   and m.starts_at<=p_checked_at and (m.ends_at is null or m.ends_at>p_checked_at);
 if not found or not exists(select 1 from identity.context_grants g
    where g.id=p_context_id and g.membership_id=p_grantor_membership_id and g.tenant_id=p_tenant_id
      and g.starts_at<=p_checked_at and (g.ends_at is null or g.ends_at>p_checked_at))
    or not app_private.workspace_context_covers_role_scope_v1_at_v1(p_context_id,p_tenant_id,p_scope_type,p_scope_id,p_checked_at)
    or not exists(select 1 from identity.role_permissions rp
      where rp.role_id=p_identity_role_id and rp.permission_id=p_permission_id and rp.effect='allow')
    or exists(select 1 from identity.role_permissions rp
      where rp.role_id=p_identity_role_id and rp.permission_id=p_permission_id and rp.effect='deny')
    or not exists(select 1 from platform.module_permission_bindings b
      where b.module_definition_id=p_module_id and b.permission_id=p_permission_id
        and b.is_assignable_to_local_role and b.is_delegable
        and b.lifecycle_status='active' and b.valid_from<=p_checked_at
        and (b.valid_to is null or b.valid_to>p_checked_at))
    or not exists(select 1 from platform.workspace_modules wm
      where wm.customer_workspace_id=p_workspace_id
        and wm.module_definition_id=p_module_id and wm.status='active'
        and wm.valid_from<=p_checked_at and (wm.valid_to is null or wm.valid_to>p_checked_at))
    or exists(select 1 from platform.module_definitions md
      where md.id=p_module_id and md.entitlement_key is not null
        and not exists(select 1 from platform.workspace_entitlements e
          where e.customer_workspace_id=p_workspace_id and e.entitlement_key=md.entitlement_key
            and e.valid_from<=p_checked_at and (e.valid_until is null or e.valid_until>p_checked_at)
            and case when e.override_value_json is not null and e.override_expires_at>p_checked_at
              then e.override_value_json='true'::jsonb else (e.boolean_value is true or e.numeric_value>0) end))
 then return false; end if;

 -- A deny on the grantor wins even when the underlying identity role allows.
 if exists(
   select 1 from platform.workspace_member_roles a
   join platform.workspace_roles r on r.id=a.workspace_role_id
   join platform.workspace_role_permissions rp on rp.workspace_role_id=r.id
   join platform.workspace_role_modules rm on rm.workspace_role_id=r.id
   where a.customer_workspace_id=p_workspace_id and a.membership_id=p_grantor_membership_id
     and a.valid_from<=p_checked_at and (a.valid_to is null or a.valid_to>p_checked_at)
     and r.lifecycle_status='published' and r.valid_from<=p_checked_at
     and (r.valid_to is null or r.valid_to>p_checked_at)
     and rp.permission_id=p_permission_id and rp.effect='deny' and rm.module_definition_id=p_module_id
     and app_private.workspace_role_scope_overlaps_v1(
       a.scope_type,a.property_id,a.building_id,a.unit_id,
       p_scope_type,
       case when p_scope_type='property' then p_scope_id when p_scope_type in ('building','unit') then
         (select b.property_id from portfolio.buildings b where b.id=case when p_scope_type='building' then p_scope_id else (select u.building_id from portfolio.units u where u.id=p_scope_id) end) end,
       case when p_scope_type='building' then p_scope_id when p_scope_type='unit' then (select u.building_id from portfolio.units u where u.id=p_scope_id) end,
       case when p_scope_type='unit' then p_scope_id end)
 ) then return false; end if;
 return true;
exception when sqlstate '40001' then raise; when others then return false;
end;
$function$;

DO $post$ DECLARE t record; BEGIN
 FOR t IN SELECT * FROM pg_temp.core12_targets LOOP
  IF (SELECT encode(sha256(convert_to(prosrc,'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure(t.signature)) IS DISTINCT FROM t.after_sha THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_postimage_mismatch'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_temp.core12_before b FULL JOIN (SELECT oid,prosrc,to_jsonb(p)-'prosrc' AS attributes FROM pg_proc p) a USING(oid) WHERE b.attributes IS DISTINCT FROM a.attributes OR (b.prosrc IS DISTINCT FROM a.prosrc AND a.oid NOT IN (SELECT to_regprocedure(signature) FROM pg_temp.core12_targets))) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_catalog_owner_acl_attribute_delta'; END IF;
 IF EXISTS((SELECT value FROM pg_temp.core12_defaults EXCEPT ALL SELECT to_jsonb(d) FROM pg_default_acl d) UNION ALL (SELECT to_jsonb(d) FROM pg_default_acl d EXCEPT ALL SELECT value FROM pg_temp.core12_defaults)) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_default_acl_delta'; END IF;
 IF EXISTS((SELECT value FROM pg_temp.core12_dependencies EXCEPT ALL SELECT to_jsonb(d) FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid IN (SELECT to_regprocedure(signature) FROM pg_temp.core12_targets)) UNION ALL (SELECT to_jsonb(d) FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid IN (SELECT to_regprocedure(signature) FROM pg_temp.core12_targets) EXCEPT ALL SELECT value FROM pg_temp.core12_dependencies)) THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_dependency_delta'; END IF;
END $post$;
ROLLBACK;
