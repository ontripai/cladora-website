-- CLADORA DW-01A proposed read RPC, v1.1
-- DESIGN ATTACHMENT ONLY. This is not a Supabase migration and must not be applied.
-- Owner: Core/Platform. Requires coordinated migration creation and review.

begin;

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

  -- Reuse the current workspace-role read/manage permissions. Context access by
  -- itself never grants aggregate or contract disclosure. Deny wins over allow.
  select
    exists (
      select 1 from identity.role_permissions rp
      join identity.permissions p on p.id=rp.permission_id
      where rp.role_id=v_context.role_id and rp.effect='allow'
        and p.code in ('workspace.role.read','workspace.role.manage')
    ) and not exists (
      select 1 from identity.role_permissions rp
      join identity.permissions p on p.id=rp.permission_id
      where rp.role_id=v_context.role_id and rp.effect='deny'
        and p.code in ('workspace.role.read','workspace.role.manage')
    ),
    exists (
      select 1 from identity.role_permissions rp
      join identity.permissions p on p.id=rp.permission_id
      where rp.role_id=v_context.role_id and rp.effect='allow'
        and p.code='workspace.role.manage'
    ) and not exists (
      select 1 from identity.role_permissions rp
      join identity.permissions p on p.id=rp.permission_id
      where rp.role_id=v_context.role_id and rp.effect='deny'
        and p.code='workspace.role.manage'
    )
  into v_can_read_aggregate,v_can_read_contract_status;

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

-- Proposal remains transaction-wrapped for review. Do not replace ROLLBACK with COMMIT here.
rollback;
