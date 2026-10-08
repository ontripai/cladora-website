-- CLADORA DW-01A workspace capability read contract, v1.2.
-- Prepared for review and disposable-database verification; not applied remotely.

-- These are the existing, explicit disclosure permissions. Binding them to the
-- existing runtime modules lets the canonical effective-authority evaluator
-- account for current local roles, delegated authority, deny precedence and
-- revocation. No module activation or entitlement is created here.
insert into platform.module_permission_bindings(
  module_definition_id, permission_id, binding_version, permission_mode,
  is_assignable_to_local_role, is_delegable, requires_aal2, lifecycle_status
)
select d.id, p.id, 1,
  case when p.code='workspace.role.manage' then 'manage' else 'read' end,
  true, false, false, 'active'
from platform.module_definitions d
cross join identity.permissions p
where d.is_active = true
  and d.lifecycle_status in ('active','published')
  and p.code in ('workspace.role.read','workspace.role.manage')
on conflict (module_definition_id, permission_id, binding_version) do nothing;

-- The two bindings above are cross-cutting disclosure gates, not additions to
-- either domain's permission manifest. Keep the existing fail-closed manifest
-- validators exact while excluding only these explicitly named Core gates.
create or replace function app_private.validate_module_permission_bindings_v2_seeding_v1()
returns void language plpgsql security definer
set search_path = pg_catalog, platform, identity
as $$
declare
  v_total_count integer;
  v_active_count integer;
  v_delegable_active_count integer;
  v_non_delegable_active_count integer;
  v_v2_non_delegable_count integer;
begin
  select count(*) into v_total_count
  from platform.module_permission_bindings b
  join platform.module_definitions m on m.id=b.module_definition_id
  join identity.permissions p on p.id=b.permission_id
  where m.code in ('occupancy','billing','payments','accounting','maintenance','utilities','governance','communications','documents','security')
    and p.code not in ('workspace.role.read','workspace.role.manage');
  if v_total_count<>90 then raise exception 'module_permission_bindings_total_count_mismatch: expected 90, got %',v_total_count using errcode='P0002'; end if;

  select count(*) into v_active_count
  from platform.module_permission_bindings b
  join platform.module_definitions m on m.id=b.module_definition_id
  join identity.permissions p on p.id=b.permission_id
  where m.code in ('occupancy','billing','payments','accounting','maintenance','utilities','governance','communications','documents','security')
    and p.code not in ('workspace.role.read','workspace.role.manage') and b.lifecycle_status='active';
  if v_active_count<>48 then raise exception 'module_permission_bindings_active_count_mismatch: expected 48, got %',v_active_count using errcode='P0002'; end if;

  select count(*) into v_delegable_active_count
  from platform.module_permission_bindings b
  join platform.module_definitions m on m.id=b.module_definition_id
  join identity.permissions p on p.id=b.permission_id
  where m.code in ('occupancy','billing','payments','accounting','maintenance','utilities','governance','communications','documents','security')
    and p.code not in ('workspace.role.read','workspace.role.manage')
    and b.lifecycle_status='active' and b.is_delegable=true;
  if v_delegable_active_count<>42 then raise exception 'delegable_active_count_mismatch: expected 42, got %',v_delegable_active_count using errcode='P0002'; end if;

  select count(*) into v_non_delegable_active_count
  from platform.module_permission_bindings b
  join platform.module_definitions m on m.id=b.module_definition_id
  join identity.permissions p on p.id=b.permission_id
  where m.code in ('occupancy','billing','payments','accounting','maintenance','utilities','governance','communications','documents','security')
    and p.code not in ('workspace.role.read','workspace.role.manage')
    and b.lifecycle_status='active' and b.is_delegable=false;
  if v_non_delegable_active_count<>6 then raise exception 'non_delegable_active_count_mismatch: expected 6, got %',v_non_delegable_active_count using errcode='P0002'; end if;

  select count(*) into v_v2_non_delegable_count
  from platform.module_permission_bindings b
  join identity.permissions p on p.id=b.permission_id
  where p.code in ('billing.cancel','payments.reverse','payments.reconcile','utilities.tariffs.manage','governance.votes.administer','governance.minutes.finalize')
    and b.binding_version=2;
  if v_v2_non_delegable_count<>0 then raise exception 'non_delegable_permissions_must_not_have_v2_records' using errcode='P0002'; end if;
end;
$$;
revoke all on function app_private.validate_module_permission_bindings_v2_seeding_v1() from public,anon,authenticated,service_role;

create or replace function app_private.validate_airprop_module_bindings_v1()
returns void language plpgsql stable security definer set search_path=pg_catalog as $$
declare actual integer; matched integer;
begin
 select count(*) into actual from platform.module_permission_bindings b
 join platform.module_definitions m on m.id=b.module_definition_id
 join identity.permissions p on p.id=b.permission_id
 where m.code='airprop_commercial' and m.version=1
   and p.code not in ('workspace.role.read','workspace.role.manage');
 select count(*) into matched from platform.module_permission_bindings b
 join platform.module_definitions m on m.id=b.module_definition_id
 join identity.permissions p on p.id=b.permission_id
 join(values
  ('airprop.opportunity.read','read'),('airprop.opportunity.manage','manage'),
  ('airprop.underwriting.manage','manage'),('airprop.asset.read','read'),
  ('airprop.asset.manage','manage'),('airprop.diligence.manage','manage'),
  ('airprop.diligence.submit','manage'),('airprop.acquisition.propose','manage'),
  ('airprop.acquisition.approve','manage'),('airprop.presale.execute','manage')
 ) x(code,mode) on p.code=x.code and b.permission_mode=x.mode
 where m.code='airprop_commercial' and m.version=1 and b.binding_version=1
  and b.is_assignable_to_local_role and not b.is_delegable and b.requires_aal2
  and b.lifecycle_status='active' and b.valid_to is null;
 if actual<>10 or matched<>10 then raise exception 'airprop_module_binding_manifest_mismatch' using errcode='P0002'; end if;
end;$$;
revoke all on function app_private.validate_airprop_module_bindings_v1() from public,anon,authenticated,service_role;

select app_private.validate_module_permission_bindings_v2_seeding_v1();
select app_private.validate_airprop_module_bindings_v1();

create or replace function app_private.check_workspace_disclosure_permission_v1(
  p_context_id uuid,
  p_workspace_id uuid,
  p_permission_code text
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_context record;
  v_module record;
  v_has_deny boolean := false;
begin
  if p_permission_code not in ('workspace.role.read','workspace.role.manage') then
    return false;
  end if;

  select * into strict v_context
  from app_private.resolve_workspace_native_context_v2(p_context_id,p_workspace_id);

  -- A current deny is terminal, including a deny supplied by an active local
  -- Workspace role. This guard also protects the explicit legacy bridge below.
  select exists (
    select 1
    from identity.role_permissions rp
    join identity.permissions p on p.id=rp.permission_id
    where rp.role_id=v_context.role_id and p.code=p_permission_code and rp.effect='deny'
    union all
    select 1
    from platform.workspace_member_roles wmr
    join platform.workspace_roles wr on wr.id=wmr.workspace_role_id
    join platform.workspace_role_permissions wrp on wrp.workspace_role_id=wr.id
    join identity.permissions p on p.id=wrp.permission_id
    where wmr.tenant_id=v_context.tenant_id
      and wmr.customer_workspace_id=v_context.workspace_id
      and wmr.membership_id=v_context.membership_id
      and wmr.scope_type='workspace'
      and wmr.valid_from<=statement_timestamp()
      and (wmr.valid_to is null or wmr.valid_to>statement_timestamp())
      and wr.lifecycle_status='published'
      and wr.valid_from<=statement_timestamp()
      and (wr.valid_to is null or wr.valid_to>statement_timestamp())
      and p.code=p_permission_code and wrp.effect='deny'
  ) into v_has_deny;
  if v_has_deny then return false; end if;

  -- Canonical path: evaluate against every currently active module. The first
  -- effective allow is sufficient; the evaluator enforces scope, entitlement,
  -- taxonomy compatibility, local-role lineage, delegations and revocation.
  for v_module in
    select distinct wm.module_code
    from platform.workspace_modules wm
    where wm.tenant_id=v_context.tenant_id
      and wm.customer_workspace_id=v_context.workspace_id
      and wm.status='active'
      and wm.valid_from<=statement_timestamp()
      and (wm.valid_to is null or wm.valid_to>statement_timestamp())
  loop
    if app_private.check_effective_permission_v2(
      p_context_id,p_permission_code,v_module.module_code,
      'workspace',p_workspace_id,p_workspace_id
    ) then return true; end if;
  end loop;

  -- Compatibility bridge: absence of descriptive taxonomy/module composition
  -- must not revoke a valid pre-DW-01A system-role permission. This is exactly
  -- the pre-existing base-role rule, evaluated on every call; no inferred role,
  -- entitlement, contract, or historical assignment is created.
  return exists (
    select 1
    from identity.role_permissions rp
    join identity.permissions p on p.id=rp.permission_id
    where rp.role_id=v_context.role_id and p.code=p_permission_code and rp.effect='allow'
  );
exception when no_data_found or too_many_rows then
  return false;
end;
$$;

revoke all on function app_private.check_workspace_disclosure_permission_v1(uuid,uuid,text)
  from public,anon,authenticated,service_role;

create or replace function customer_api.get_workspace_capability_snapshot_v1(
  p_context_id uuid,
  p_workspace_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog
as $$
declare
  v_context record;
  v_workspace platform.customer_workspaces%rowtype;
  v_taxonomy record;
  v_resource_count integer := 0;
  v_capabilities jsonb := '[]'::jsonb;
  v_reference_visibility text := 'withheld';
  v_can_read_aggregate boolean := false;
  v_can_read_contract_status boolean := false;
begin
  -- Explicit Workspace selection is mandatory; no arbitrary LIMIT 1 resolution.
  select * into strict v_context
  from app_private.resolve_workspace_native_context_v2(p_context_id, p_workspace_id);

  select * into strict v_workspace
  from platform.customer_workspaces
  where id = v_context.workspace_id and tenant_id = v_context.tenant_id;

  -- Workspace access alone is insufficient. Counts require role.read or
  -- role.manage; contract status requires role.manage specifically.
  v_can_read_aggregate :=
    app_private.check_workspace_disclosure_permission_v1(
      p_context_id,p_workspace_id,'workspace.role.read')
    or app_private.check_workspace_disclosure_permission_v1(
      p_context_id,p_workspace_id,'workspace.role.manage');
  v_can_read_contract_status :=
    app_private.check_workspace_disclosure_permission_v1(
      p_context_id,p_workspace_id,'workspace.role.manage');

  if v_can_read_aggregate then
    v_reference_visibility := 'count_only';
    select count(*)::integer into v_resource_count
    from platform.workspace_property_bindings b
    where b.tenant_id = v_context.tenant_id
      and b.customer_workspace_id = v_context.workspace_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp()
      and (b.valid_to is null or b.valid_to > statement_timestamp());
  end if;

  select a.id as assignment_id, pp.code as profile_code, om.code as model_code
  into v_taxonomy
  from platform.workspace_taxonomy_assignments a
  join platform.property_profiles pp on pp.id = a.property_profile_id
  join platform.operating_models om on om.id = a.operating_model_id
  where a.tenant_id = v_context.tenant_id
    and a.customer_workspace_id = v_context.workspace_id
    and a.status = 'active'
    and a.valid_from <= statement_timestamp()
    and (a.valid_to is null or a.valid_to > statement_timestamp())
  order by a.valid_from desc, a.created_at desc
  limit 1;

  select coalesce(jsonb_agg(capability order by capability->>'capability_key'), '[]'::jsonb)
  into v_capabilities
  from (
    select jsonb_build_object(
      'capability_key', case when d.code = 'community_events' then 'ce.event.basic' else 'module.' || d.code end,
      'workspace_state', case
        when wm.id is not null and e.id is not null then 'available'
        when wm.id is not null then 'inactive'
        when e.id is not null then 'inactive'
        else 'unavailable'
      end,
      'state_reason_codes', case
        when wm.id is not null and e.id is not null then '[]'::jsonb
        when wm.id is null and e.id is not null then '["module_inactive"]'::jsonb
        when wm.id is not null and e.id is null then '["entitlement_not_effective"]'::jsonb
        else '["module_inactive","entitlement_not_effective"]'::jsonb
      end,
      'action_authorization', 'not_evaluated',
      'module', jsonb_build_object(
        'definition_id', null,
        'code', d.code,
        'version', d.version,
        'activation_id', null,
        'activation_status', coalesce(wm.status, 'not_installed')
      ),
      'entitlement', case when e.id is null then null else jsonb_build_object(
        'entitlement_id', null,
        'key', e.entitlement_key,
        'provenance', case when e.contract_id is null then 'legacy_unprovenanced' else 'contract' end,
        'contract', case when e.contract_id is null
          then jsonb_build_object('visibility','not_applicable','contract_id',null,'contract_ref',null,'contract_version',null,'status',null)
          when v_can_read_contract_status then jsonb_build_object('visibility','status_only','contract_id',null,'contract_ref',null,'contract_version',null,
            'status',(select c.status from platform.workspace_contracts c where c.id=e.contract_id))
          else jsonb_build_object('visibility','withheld','contract_id',null,'contract_ref',null,'contract_version',null,'status',null) end,
        'currently_effective', true,
        'valid_from', e.valid_from,
        'valid_until', e.valid_until,
        'override_active', (e.override_value_json is not null and e.override_expires_at > statement_timestamp())
      ) end,
      -- v1 returns no source/resource references inside restrictions.
      'restrictions', '[]'::jsonb
    ) as capability
    from platform.module_definitions d
    left join platform.workspace_modules wm
      on wm.customer_workspace_id = v_context.workspace_id
     and wm.module_code = d.code
     and wm.status = 'active'
     and wm.valid_from <= statement_timestamp()
     and (wm.valid_to is null or wm.valid_to > statement_timestamp())
    left join platform.workspace_entitlements e
      on e.customer_workspace_id = v_context.workspace_id
     and e.entitlement_key = d.entitlement_key
     and e.valid_from <= statement_timestamp()
     and (e.valid_until is null or e.valid_until > statement_timestamp())
     and case when e.override_value_json is not null and e.override_expires_at > statement_timestamp()
       then e.override_value_json = 'true'::jsonb
       else (e.boolean_value is true or e.numeric_value > 0) end
    where d.is_active = true
      and d.lifecycle_status in ('active','published')
      and d.valid_from <= statement_timestamp()
      and (d.valid_to is null or d.valid_to > statement_timestamp())
  ) q;

  return jsonb_build_object(
    'contract_version', 'workspace-capability-snapshot.v1',
    'evaluated_at', statement_timestamp(),
    'reference_visibility', v_reference_visibility,
    'workspace', jsonb_build_object(
      'tenant_id', v_context.tenant_id,
      'workspace_id', v_context.workspace_id,
      'lifecycle_status', v_workspace.lifecycle_status,
      'administrative_origin_type', v_workspace.workspace_type,
      'version', v_workspace.version
    ),
    'taxonomy', jsonb_build_object(
      'status', case when v_taxonomy.assignment_id is null then 'not_configured' else 'configured' end,
      -- count-only mode never exposes assignment/source IDs.
      'assignment_id', null,
      'property_profile_code', v_taxonomy.profile_code,
      'operating_model_code', v_taxonomy.model_code
    ),
    'resources', jsonb_build_object(
      'visibility', v_reference_visibility,
      'visible_count', case when v_can_read_aggregate then v_resource_count else null end,
      'total_count', case when v_can_read_aggregate then v_resource_count else null end,
      'resource_ids', '[]'::jsonb
    ),
    'capabilities', v_capabilities
  );
exception
  when no_data_found then
    raise exception 'workspace_capability_context_access_denied' using errcode = '42501';
  when too_many_rows then
    raise exception 'workspace_capability_context_ambiguous' using errcode = '21000';
end;
$$;

revoke all on function customer_api.get_workspace_capability_snapshot_v1(uuid,uuid)
  from public, anon, authenticated, service_role;
grant execute on function customer_api.get_workspace_capability_snapshot_v1(uuid,uuid)
  to authenticated;

comment on function customer_api.get_workspace_capability_snapshot_v1(uuid,uuid) is
  'DW-01A permission-bounded Workspace capability projection. Workspace access alone yields withheld; workspace.role.read/manage permits count_only. It grants no action authority.';
