begin;

-- ============================================================================
-- Migration 101: Controlled Workspace Taxonomy Mutation Gateway
-- Scope: Transactional assignment, controlled transition, advisory concurrency,
-- audit evidence, deterministic idempotency, and AAL2 authorization.
-- Invariant: Workspace Profile != Operating Model != Building DNA != Service Profile != Country Pack
-- ============================================================================

-- 1. Dedicated Scoped Identity Permission
insert into identity.permissions (code, resource, action, description)
values ('workspace.taxonomy.manage', 'workspace.taxonomy', 'manage', 'Assign and transition workspace universal taxonomy profiles and operating models')
on conflict (code) do update set resource = excluded.resource, action = excluded.action, description = excluded.description;

insert into identity.role_permissions (role_id, permission_id, effect)
select r.id, p.id, 'allow'
from identity.roles r
cross join identity.permissions p
where lower(r.code) in ('association_admin', 'property_manager')
  and p.code = 'workspace.taxonomy.manage'
on conflict do nothing;

-- 2. Idempotency Registry Table
create table platform.workspace_taxonomy_idempotency (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references platform.tenants(id) on delete restrict,
  customer_workspace_id uuid not null references platform.customer_workspaces(id) on delete restrict,
  idempotency_key uuid not null,
  request_hash text not null,
  assignment_id uuid not null references platform.workspace_taxonomy_assignments(id) on delete restrict,
  previous_assignment_id uuid references platform.workspace_taxonomy_assignments(id) on delete restrict,
  property_profile_code text not null,
  operating_model_code text not null,
  country_code text not null,
  compatibility_status text not null,
  valid_from timestamptz not null,
  audit_event_id bigint not null,
  response_payload jsonb not null,
  created_at timestamptz not null default statement_timestamp(),
  unique (tenant_id, idempotency_key)
);

create index ws_taxonomy_idempotency_ws_idx
  on platform.workspace_taxonomy_idempotency (customer_workspace_id, created_at desc);

alter table platform.workspace_taxonomy_idempotency enable row level security;
revoke all on platform.workspace_taxonomy_idempotency from public, anon, authenticated;
grant select, insert on platform.workspace_taxonomy_idempotency to service_role;

-- 3. Forward Update to Guard Function: Allow review_required with mandatory reason/notes
create or replace function app_private.guard_workspace_taxonomy_assignment_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, platform, app_private
as $$
declare
  v_workspace_tenant uuid;
  v_compat_level text;
  v_profile_active boolean;
  v_model_active boolean;
begin
  -- 1. Tenant boundary check
  select tenant_id into v_workspace_tenant from platform.customer_workspaces where id = new.customer_workspace_id for update;
  if not found then
    raise exception 'workspace_taxonomy_not_found' using errcode = 'P0002';
  end if;
  if v_workspace_tenant <> new.tenant_id then
    raise exception 'workspace_taxonomy_tenant_mismatch' using errcode = '42501';
  end if;

  -- 2. Verify Profile and Operating Model active status
  select is_active into v_profile_active from platform.property_profiles
  where id = new.property_profile_id and lifecycle_status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp());
  if not coalesce(v_profile_active, false) then
    raise exception 'workspace_taxonomy_profile_inactive' using errcode = '22023';
  end if;

  select is_active into v_model_active from platform.operating_models
  where id = new.operating_model_id and lifecycle_status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp());
  if not coalesce(v_model_active, false) then
    raise exception 'workspace_taxonomy_operating_model_inactive' using errcode = '22023';
  end if;

  -- 3. Evaluate Compatibility Rule
  select compatibility_level into v_compat_level
  from platform.property_operating_model_compatibilities
  where property_profile_id = new.property_profile_id
    and operating_model_id = new.operating_model_id
  order by rule_version desc limit 1;

  if v_compat_level is null then
    raise exception 'workspace_taxonomy_compatibility_rule_missing' using errcode = 'P0001';
  end if;

  if v_compat_level = 'incompatible' then
    raise exception 'workspace_taxonomy_incompatible' using errcode = 'P0001';
  elsif v_compat_level = 'review_required' then
    if new.status = 'active' and (new.notes is null or length(trim(new.notes)) = 0) then
      raise exception 'workspace_taxonomy_review_reason_required' using errcode = 'P0001';
    end if;
  end if;

  -- 4. Check for overlapping active assignments for this workspace
  if new.status = 'active' then
    if exists (
      select 1 from platform.workspace_taxonomy_assignments a
      where a.customer_workspace_id = new.customer_workspace_id
        and a.status = 'active'
        and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and (
          (a.valid_to is null and (new.valid_to is null or new.valid_to > a.valid_from))
          or
          (a.valid_to is not null and new.valid_from < a.valid_to and (new.valid_to is null or new.valid_to > a.valid_from))
        )
    ) then
      raise exception 'workspace_taxonomy_assignment_overlap' using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

-- 4. Transactional Mutation RPC: assign_workspace_taxonomy_v1
create or replace function customer_api.assign_workspace_taxonomy_v1(
  p_context_id uuid,
  p_property_profile_code text,
  p_operating_model_code text,
  p_country_code text,
  p_idempotency_key uuid,
  p_expected_assignment_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, platform, identity, portfolio, audit, app_private
as $$
declare
  v_grant record;
  v_target_property_id uuid;
  v_binding_count integer;
  v_binding record;
  v_workspace platform.customer_workspaces%rowtype;
  v_ws_count integer;
  v_request_hash text;
  v_idem record;
  v_profile record;
  v_model record;
  v_compat_level text;
  v_current_assignment record;
  v_now timestamptz;
  v_prev_profile_code text;
  v_prev_model_code text;
  v_before_snapshot jsonb;
  v_after_snapshot jsonb;
  v_action text;
  v_new_assignment_id uuid;
  v_audit_event_id bigint;
  v_response jsonb;
begin
  -- 1. Authentication check
  if auth.uid() is null then
    raise exception 'authentication_required' using errcode = '42501';
  end if;

  -- 2. Mandatory AAL2 verification
  if coalesce(auth.jwt()->>'aal', 'aal1') <> 'aal2' then
    raise exception 'mfa_required' using errcode = '42501';
  end if;

  -- 3. Mandatory Idempotency Key & Country Code verification
  if p_idempotency_key is null then
    raise exception 'workspace_taxonomy_idempotency_key_required' using errcode = '22023';
  end if;

  if p_country_code is null or length(trim(p_country_code)) < 2 then
    raise exception 'workspace_taxonomy_country_code_required' using errcode = '22023';
  end if;

  -- 4. Context grant & active membership validation
  select g.*, m.id as membership_key, m.tenant_id as membership_tenant, m.role_id, r.code as role_code
  into v_grant
  from identity.context_grants g
  join identity.memberships m on m.id = g.membership_id and m.tenant_id = g.tenant_id
  join identity.roles r on r.id = m.role_id
  where g.id = p_context_id
    and m.user_id = auth.uid()
    and m.status = 'active'
    and m.starts_at <= statement_timestamp() and (m.ends_at is null or m.ends_at > statement_timestamp())
    and g.starts_at <= statement_timestamp() and (g.ends_at is null or g.ends_at > statement_timestamp());

  if not found then
    raise exception 'customer_context_access_denied' using errcode = '42501';
  end if;

  -- 5. Permission check: workspace.taxonomy.manage required
  if not exists (
    select 1 from identity.role_permissions rp
    join identity.permissions p on p.id = rp.permission_id
    where rp.role_id = v_grant.role_id
      and rp.effect = 'allow'
      and p.code = 'workspace.taxonomy.manage'
  ) then
    raise exception 'workspace_taxonomy_manage_permission_required' using errcode = '42501';
  end if;

  -- 6. Canonical deterministic Context-to-Workspace resolution
  if v_grant.property_id is not null then
    v_target_property_id := v_grant.property_id;
  elsif v_grant.building_id is not null then
    select property_id into v_target_property_id
    from portfolio.buildings
    where id = v_grant.building_id and tenant_id = v_grant.membership_tenant;
  elsif v_grant.unit_id is not null then
    select b.property_id into v_target_property_id
    from portfolio.units u
    join portfolio.buildings b on b.id = u.building_id
    where u.id = v_grant.unit_id and u.tenant_id = v_grant.membership_tenant;
  end if;

  if v_target_property_id is not null then
    select count(*)
    into v_binding_count
    from platform.workspace_property_bindings b
    where b.property_id = v_target_property_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp());

    if v_binding_count = 0 then
      raise exception 'workspace_taxonomy_context_not_workspace_bound' using errcode = '42501';
    elsif v_binding_count > 1 then
      raise exception 'workspace_taxonomy_workspace_binding_ambiguous' using errcode = '42501';
    end if;

    select * into v_binding
    from platform.workspace_property_bindings b
    where b.property_id = v_target_property_id
      and b.status = 'active'
      and b.valid_from <= statement_timestamp() and (b.valid_to is null or b.valid_to > statement_timestamp())
    limit 1;

    if v_binding.tenant_id <> v_grant.membership_tenant then
      raise exception 'workspace_taxonomy_workspace_binding_tenant_mismatch' using errcode = '42501';
    end if;

    select * into v_workspace
    from platform.customer_workspaces
    where id = v_binding.customer_workspace_id
      and tenant_id = v_grant.membership_tenant
      and lifecycle_status in ('PROVISIONING', 'ACTIVE');

    if v_workspace.id is null then
      raise exception 'workspace_taxonomy_context_not_workspace_bound' using errcode = '42501';
    end if;
  else
    select count(*) into v_ws_count
    from platform.customer_workspaces
    where tenant_id = v_grant.membership_tenant and lifecycle_status in ('PROVISIONING', 'ACTIVE');

    if v_ws_count = 1 then
      select * into v_workspace
      from platform.customer_workspaces
      where tenant_id = v_grant.membership_tenant and lifecycle_status in ('PROVISIONING', 'ACTIVE');
    else
      raise exception 'workspace_taxonomy_context_not_workspace_bound' using errcode = '42501';
    end if;
  end if;

  -- 7. Deterministic transactional lock per target workspace to serialize concurrent mutations
  perform pg_advisory_xact_lock(hashtextextended('workspace_taxonomy_mutation:' || v_workspace.id::text, 0));

  -- 8. Compute Request Hash for strict idempotency payload matching
  v_request_hash := encode(digest(
    p_context_id::text || '|' ||
    p_property_profile_code || '|' ||
    p_operating_model_code || '|' ||
    upper(p_country_code) || '|' ||
    coalesce(trim(p_reason), '') || '|' ||
    coalesce(p_expected_assignment_id::text, ''),
    'sha256'
  ), 'hex');

  -- 9. Check existing idempotency record
  select * into v_idem
  from platform.workspace_taxonomy_idempotency
  where tenant_id = v_grant.membership_tenant
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_idem.request_hash <> v_request_hash then
      raise exception 'workspace_taxonomy_idempotency_conflict' using errcode = '23505';
    end if;
    return jsonb_set(v_idem.response_payload, '{idempotent_replay}', 'true'::jsonb);
  end if;

  -- 10. Lookup active Catalog records
  select * into v_profile
  from platform.property_profiles
  where code = p_property_profile_code
    and is_active = true and lifecycle_status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp())
  order by version desc limit 1;

  if not found then
    raise exception 'workspace_taxonomy_catalog_version_not_current' using errcode = '22023';
  end if;

  select * into v_model
  from platform.operating_models
  where code = p_operating_model_code
    and is_active = true and lifecycle_status = 'active'
    and valid_from <= statement_timestamp() and (valid_to is null or valid_to > statement_timestamp())
  order by version desc limit 1;

  if not found then
    raise exception 'workspace_taxonomy_catalog_version_not_current' using errcode = '22023';
  end if;

  -- 11. Evaluate Compatibility Matrix
  select compatibility_level into v_compat_level
  from platform.property_operating_model_compatibilities
  where property_profile_id = v_profile.id
    and operating_model_id = v_model.id
  order by rule_version desc limit 1;

  if v_compat_level is null or v_compat_level = 'incompatible' then
    raise exception 'workspace_taxonomy_incompatible' using errcode = 'P0001';
  elsif v_compat_level = 'review_required' then
    if p_reason is null or length(trim(p_reason)) = 0 then
      raise exception 'workspace_taxonomy_review_reason_required' using errcode = '22023';
    end if;
  end if;

  -- 12. Resolve current active assignment for the workspace
  select a.* into v_current_assignment
  from platform.workspace_taxonomy_assignments a
  where a.customer_workspace_id = v_workspace.id
    and a.status = 'active'
    and a.valid_from <= statement_timestamp() and (a.valid_to is null or a.valid_to > statement_timestamp())
  order by a.valid_from desc, a.created_at desc limit 1;

  -- 13. Validate Expected Assignment (Optimistic Concurrency Control)
  if v_current_assignment.id is not null then
    if p_expected_assignment_id is null or p_expected_assignment_id <> v_current_assignment.id then
      raise exception 'workspace_taxonomy_expected_assignment_conflict' using errcode = '40001';
    end if;
  else
    if p_expected_assignment_id is not null then
      raise exception 'workspace_taxonomy_expected_assignment_conflict' using errcode = '40001';
    end if;
  end if;

  -- 14. Timestamp and Transition / Creation Execution
  v_now := statement_timestamp();

  if v_current_assignment.id is not null then
    update platform.workspace_taxonomy_assignments
    set status = 'superseded',
        valid_to = v_now,
        updated_at = v_now
    where id = v_current_assignment.id;

    select code into v_prev_profile_code from platform.property_profiles where id = v_current_assignment.property_profile_id;
    select code into v_prev_model_code from platform.operating_models where id = v_current_assignment.operating_model_id;

    v_before_snapshot := jsonb_build_object(
      'assignment_id', v_current_assignment.id,
      'property_profile_id', v_current_assignment.property_profile_id,
      'property_profile_code', v_prev_profile_code,
      'operating_model_id', v_current_assignment.operating_model_id,
      'operating_model_code', v_prev_model_code,
      'valid_from', v_current_assignment.valid_from,
      'valid_to', v_now
    );
    v_action := 'WORKSPACE_TAXONOMY_TRANSITIONED';
  else
    v_before_snapshot := null;
    v_action := 'WORKSPACE_TAXONOMY_ASSIGNED';
  end if;

  -- 15. Insert new assignment
  insert into platform.workspace_taxonomy_assignments (
    tenant_id,
    customer_workspace_id,
    property_profile_id,
    operating_model_id,
    status,
    valid_from,
    valid_to,
    notes,
    created_by,
    created_at,
    updated_at
  ) values (
    v_grant.membership_tenant,
    v_workspace.id,
    v_profile.id,
    v_model.id,
    'active',
    v_now,
    null,
    p_reason,
    auth.uid(),
    v_now,
    v_now
  )
  returning id into v_new_assignment_id;

  -- 16. Insert Transactional Audit Evidence
  v_after_snapshot := jsonb_build_object(
    'assignment_id', v_new_assignment_id,
    'workspace_id', v_workspace.id,
    'property_profile_id', v_profile.id,
    'property_profile_code', v_profile.code,
    'operating_model_id', v_model.id,
    'operating_model_code', v_model.code,
    'country_code', upper(p_country_code),
    'compatibility_status', v_compat_level,
    'valid_from', v_now,
    'valid_to', null,
    'reason', p_reason,
    'idempotency_key', p_idempotency_key
  );

  insert into audit.events (
    tenant_id,
    actor_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    reason,
    before_snapshot,
    after_snapshot,
    occurred_at
  ) values (
    v_grant.membership_tenant,
    auth.uid(),
    v_grant.role_code,
    v_action,
    'workspace_taxonomy_assignment',
    v_new_assignment_id,
    p_reason,
    v_before_snapshot,
    v_after_snapshot,
    v_now
  )
  returning id into v_audit_event_id;

  -- 17. Build Response Payload
  v_response := jsonb_build_object(
    'workspace_id', v_workspace.id,
    'assignment_id', v_new_assignment_id,
    'previous_assignment_id', v_current_assignment.id,
    'property_profile_code', v_profile.code,
    'operating_model_code', v_model.code,
    'country_code', upper(p_country_code),
    'compatibility_status', v_compat_level,
    'valid_from', v_now,
    'idempotent_replay', false,
    'audit_event_id', v_audit_event_id
  );

  -- 18. Store in Idempotency Registry
  insert into platform.workspace_taxonomy_idempotency (
    tenant_id,
    customer_workspace_id,
    idempotency_key,
    request_hash,
    assignment_id,
    previous_assignment_id,
    property_profile_code,
    operating_model_code,
    country_code,
    compatibility_status,
    valid_from,
    audit_event_id,
    response_payload
  ) values (
    v_grant.membership_tenant,
    v_workspace.id,
    p_idempotency_key,
    v_request_hash,
    v_new_assignment_id,
    v_current_assignment.id,
    v_profile.code,
    v_model.code,
    upper(p_country_code),
    v_compat_level,
    v_now,
    v_audit_event_id,
    v_response
  );

  return v_response;
end;
$$;

-- 5. Revoke / Grant Permissions
revoke all on function customer_api.assign_workspace_taxonomy_v1(uuid, text, text, text, uuid, uuid, text) from public;
grant execute on function customer_api.assign_workspace_taxonomy_v1(uuid, text, text, text, uuid, uuid, text) to authenticated, service_role;

commit;
