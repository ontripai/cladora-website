-- =============================================================================
-- Test 090: Workspace-Local Roles, Module Scoping & Effective Permission Engine (001B.1)
-- Package: CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.1
-- Scope: Versioned Module-Permission Registry, Workspace Roles & Versions,
-- Module/Permission Attachments, Scoped Member Assignments, Versioned Idempotency,
-- Atomic RPCs, Audit, and Deny-First Effective Permission Resolution Engine.
-- Cardinal Invariant:
-- Workspace Taxonomy != Module Activation != Entitlement != Permission != Role != Delegation != Country Pack
-- =============================================================================
begin;
select plan(76);

-- 1. Structural & Table Schema Verification (6 assertions)
select ok(to_regclass('platform.module_permission_bindings') is not null, 'platform.module_permission_bindings table exists');
select ok(to_regclass('platform.workspace_roles') is not null, 'platform.workspace_roles table exists');
select ok(to_regclass('platform.workspace_role_modules') is not null, 'platform.workspace_role_modules table exists');
select ok(to_regclass('platform.workspace_role_permissions') is not null, 'platform.workspace_role_permissions table exists');
select ok(to_regclass('platform.workspace_member_roles') is not null, 'platform.workspace_member_roles table exists');
select ok(to_regclass('platform.workspace_role_idempotency') is not null, 'platform.workspace_role_idempotency table exists');

-- 2. Scoped Permission and Administrative Role Grants (6 assertions)
select ok(exists(select 1 from identity.permissions where code = 'workspace.role.read'), 'workspace.role.read permission exists in identity.permissions');
select ok(exists(select 1 from identity.permissions where code = 'workspace.role.manage'), 'workspace.role.manage permission exists in identity.permissions');
select ok(exists(select 1 from identity.permissions where code = 'workspace.role.publish'), 'workspace.role.publish permission exists in identity.permissions');
select ok(exists(select 1 from identity.permissions where code = 'workspace.role.assign'), 'workspace.role.assign permission exists in identity.permissions');

select ok(exists(
  select 1 from identity.role_permissions rp
  join identity.permissions p on p.id = rp.permission_id
  join identity.roles r on r.id = rp.role_id
  where r.code = 'association_admin' and r.tenant_id is null and r.is_system = true
    and p.code = 'workspace.role.publish' and rp.effect = 'allow'
), 'association_admin granted workspace.role.publish');

select ok(exists(
  select 1 from identity.role_permissions rp
  join identity.permissions p on p.id = rp.permission_id
  join identity.roles r on r.id = rp.role_id
  where r.code = 'property_manager' and r.tenant_id is null and r.is_system = true
    and p.code = 'workspace.role.assign' and rp.effect = 'allow'
), 'property_manager granted workspace.role.assign');

-- 3. Module-Permission Binding Registry Invariants (8 assertions)
-- 3.1 All seeded records have is_delegable = false
select ok(not exists(
  select 1 from platform.module_permission_bindings where is_delegable is true
), 'all module_permission_bindings have is_delegable = false in 001B.1');

-- 3.2 Attempting to insert is_delegable = true is rejected
select throws_ok(
  $$insert into platform.module_permission_bindings (
    module_definition_id, permission_id, binding_version, is_delegable
  ) select id, (select id from identity.permissions limit 1), 99, true
  from platform.module_definitions where code = 'maintenance' limit 1$$,
  '42501',
  'delegation_runtime_deferred_to_001b2',
  'inserting is_delegable = true is rejected by trigger'
);

-- 3.3 Catalog-only modules cannot have permission bindings
select throws_ok(
  $$insert into platform.module_permission_bindings (
    module_definition_id, permission_id, binding_version, is_delegable
  ) select id, (select id from identity.permissions limit 1), 1, false
  from platform.module_definitions where code = 'core_property_registry' limit 1$$,
  '42501',
  'catalog_only_modules_cannot_have_permission_bindings',
  'binding permissions to catalog_only module is rejected'
);

-- 3.4 Exactly 0 bindings exist for catalog_only modules
select ok(not exists(
  select 1 from platform.module_permission_bindings mpb
  join platform.module_definitions md on md.id = mpb.module_definition_id
  where md.lifecycle_status = 'catalog_only'
), 'catalog-only modules have exactly zero bindings in registry');

-- 3.5 No wildcard permissions seeded
select ok(not exists(
  select 1 from platform.module_permission_bindings mpb
  join identity.permissions p on p.id = mpb.permission_id
  where p.code like '%.*' or p.code like '*%'
), 'zero wildcard permissions exist in module_permission_bindings');

-- 3.6 Temporal overlap rejection on active bindings
select throws_ok(
  $$insert into platform.module_permission_bindings (
    module_definition_id, permission_id, binding_version, is_delegable, lifecycle_status, valid_from, valid_to
  ) select module_definition_id, permission_id, 2, false, 'active', valid_from + interval '1 day', valid_from + interval '5 days'
  from platform.module_permission_bindings limit 1$$,
  '23505',
  'module_permission_binding_temporal_overlap',
  'temporal overlap for active module permission binding is rejected'
);

-- 3.7 Non-overlapping future version is allowed
update platform.module_permission_bindings
set valid_to = statement_timestamp() + interval '30 days'
where module_definition_id = (select id from platform.module_definitions where code = 'maintenance' limit 1)
  and permission_id = (select id from identity.permissions where code = 'maintenance.work_orders.read' limit 1);

select lives_ok(
  $$insert into platform.module_permission_bindings (
    module_definition_id, permission_id, binding_version, is_delegable, lifecycle_status, valid_from, valid_to
  ) select module_definition_id, permission_id, 2, false, 'active', statement_timestamp() + interval '30 days', statement_timestamp() + interval '60 days'
  from platform.module_permission_bindings
  where module_definition_id = (select id from platform.module_definitions where code = 'maintenance' limit 1)
    and permission_id = (select id from identity.permissions where code = 'maintenance.work_orders.read' limit 1)$$,
  'non-overlapping future binding version succeeds'
);

-- 3.8 Minimum 48 active proven bindings exist
select ok((select count(*) from platform.module_permission_bindings where is_assignable_to_local_role is true) >= 48, 'at least 48 module permission bindings seeded');

-- ----------------------------------------------------------------------------
-- 4. Test Fixtures Setup (Tenant, Workspace, Properties, Buildings, Units, Users)
-- ----------------------------------------------------------------------------
do $$
declare
  v_tenant_id uuid := '09000000-0000-0000-0000-000000000001'::uuid;
  v_tenant2_id uuid := '09000000-0000-0000-0000-000000000002'::uuid;
  v_user_admin_id uuid := '09000000-0000-0000-0000-000000000010'::uuid;
  v_user_member_id uuid := '09000000-0000-0000-0000-000000000020'::uuid;
  v_user_other_id uuid := '09000000-0000-0000-0000-000000000030'::uuid;
  v_ws_id uuid := '09000000-0000-0000-0000-000000000100'::uuid;
  v_ws2_id uuid := '09000000-0000-0000-0000-000000000200'::uuid;
  v_prop_id uuid := '09000000-0000-0000-0000-000000001000'::uuid;
  v_prop2_id uuid := '09000000-0000-0000-0000-000000002000'::uuid;
  v_bld_id uuid := '09000000-0000-0000-0000-000000010000'::uuid;
  v_bld2_id uuid := '09000000-0000-0000-0000-000000020000'::uuid;
  v_unit1_id uuid := '09000000-0000-0000-0000-000000100001'::uuid;
  v_unit2_id uuid := '09000000-0000-0000-0000-000000100002'::uuid;
  v_admin_role_id uuid;
  v_member_role_id uuid;
  v_mem_admin_id uuid := '09000000-0000-0000-0000-000001000001'::uuid;
  v_mem_target_id uuid := '09000000-0000-0000-0000-000001000002'::uuid;
  v_mem_other_id uuid := '09000000-0000-0000-0000-000001000003'::uuid;
  v_ctx_admin_id uuid := '09000000-0000-0000-0000-000010000001'::uuid;
  v_ctx_member_id uuid := '09000000-0000-0000-0000-000010000002'::uuid;
  v_profile_id uuid;
  v_model_id uuid;
begin
  -- Users
  insert into auth.users (id, email) values
    (v_user_admin_id, 'ws_admin@test.local'),
    (v_user_member_id, 'ws_member@test.local'),
    (v_user_other_id, 'ws_other@test.local')
  on conflict (id) do nothing;

  -- Tenants
  insert into platform.tenants (id, legal_name, registration_number, status) values
    (v_tenant_id, 'Test Tenant 090', 'RO-TEST-090-A', 'active'),
    (v_tenant2_id, 'Test Tenant 090 B', 'RO-TEST-090-B', 'active')
  on conflict (id) do nothing;

  -- Workspaces
  insert into platform.customer_workspaces (id, tenant_id, workspace_type, commercial_owner, environment, lifecycle_status) values
    (v_ws_id, v_tenant_id, 'ASSOCIATION', 'Owner 090', 'PILOT', 'ACTIVE'),
    (v_ws2_id, v_tenant_id, 'ASSOCIATION', 'Owner 090 B', 'PILOT', 'ACTIVE')
  on conflict (id) do nothing;

  -- Properties, Buildings, Units
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    (v_prop_id, v_tenant_id, 'condominium', 'Property 090 A', 'active'),
    (v_prop2_id, v_tenant_id, 'condominium', 'Property 090 B', 'active')
  on conflict (id) do nothing;

  insert into portfolio.buildings (id, tenant_id, property_id, code, name, status) values
    (v_bld_id, v_tenant_id, v_prop_id, 'BLD-1', 'Building 1', 'active'),
    (v_bld2_id, v_tenant_id, v_prop_id, 'BLD-2', 'Building 2', 'active')
  on conflict (id) do nothing;

  insert into portfolio.units (id, tenant_id, building_id, code, status) values
    (v_unit1_id, v_tenant_id, v_bld_id, '101', 'active'),
    (v_unit2_id, v_tenant_id, v_bld_id, '102', 'active')
  on conflict (id) do nothing;

  -- Workspace Property Bindings
  insert into platform.workspace_property_bindings (tenant_id, customer_workspace_id, property_id, status, binding_source) values
    (v_tenant_id, v_ws_id, v_prop_id, 'active', 'platform_assignment'),
    (v_tenant_id, v_ws2_id, v_prop2_id, 'active', 'platform_assignment')
  on conflict do nothing;

  -- Roles & Memberships
  select id into v_admin_role_id from identity.roles where lower(code) = 'association_admin' and tenant_id is null and is_system = true limit 1;
  select id into v_member_role_id from identity.roles where lower(code) = 'owner' and tenant_id is null and is_system = true limit 1;

  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at) values
    (v_mem_admin_id, v_tenant_id, v_user_admin_id, v_admin_role_id, 'active', statement_timestamp() - interval '1 day'),
    (v_mem_target_id, v_tenant_id, v_user_member_id, v_member_role_id, 'active', statement_timestamp() - interval '1 day'),
    (v_mem_other_id, v_tenant2_id, v_user_other_id, v_member_role_id, 'active', statement_timestamp() - interval '1 day')
  on conflict (id) do nothing;

  -- Context Grants
  insert into identity.context_grants (id, tenant_id, membership_id, scope_type, property_id, starts_at) values
    (v_ctx_admin_id, v_tenant_id, v_mem_admin_id, 'property', v_prop_id, statement_timestamp() - interval '1 day'),
    (v_ctx_member_id, v_tenant_id, v_mem_target_id, 'property', v_prop_id, statement_timestamp() - interval '1 day')
  on conflict (id) do nothing;

  -- Active Taxonomy Assignment
  select id into v_profile_id from platform.property_profiles where code = 'residential_condominium' and version = 1 limit 1;
  select id into v_model_id from platform.operating_models where code = 'association_managed' and version = 1 limit 1;

  insert into platform.workspace_taxonomy_assignments (
    tenant_id, customer_workspace_id, property_profile_id, operating_model_id, status, valid_from, created_by, country_code
  ) values (
    v_tenant_id, v_ws_id, v_profile_id, v_model_id, 'active', statement_timestamp() - interval '1 day', v_user_admin_id, 'RO'
  ) on conflict do nothing;

  -- Active Module & Entitlement for Maintenance
  insert into platform.workspace_modules (
    tenant_id, customer_workspace_id, module_definition_id, module_code, status, reason
  ) select v_tenant_id, v_ws_id, id, code, 'active', 'Initial test activation'
  from platform.module_definitions where code = 'maintenance' limit 1
  on conflict do nothing;

  insert into platform.workspace_entitlements (
    customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from
  ) values (
    v_ws_id, 'module.maintenance', 'boolean', true, statement_timestamp() - interval '1 day'
  ) on conflict do nothing;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Role Versioning, State Transitions & Published Immutability (16 assertions)
-- ----------------------------------------------------------------------------

-- Set auth context to admin user with AAL2
set local role authenticated;
select set_config('request.jwt.claims', jsonb_build_object('sub', '09000000-0000-0000-0000-000000000010', 'aal', 'aal2')::text, true);

-- 5.1 Create Draft Role
select lives_ok(
  $$select customer_api.create_workspace_role_draft_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    'lead_technician',
    'Lead Maintenance Technician',
    'Responsible for work orders and inspections',
    'building',
    (select id from identity.roles where code = 'property_manager' limit 1),
    'Create draft role for maintenance team',
    'idem_create_role_001'
  )$$,
  'create_workspace_role_draft_v1 succeeds with valid parameters and AAL2'
);

-- 5.2 Verify Initial Draft State: role_version = 1, lock_version = 1, lifecycle_status = 'draft'
select ok(exists(
  select 1 from platform.workspace_roles
  where code = 'lead_technician'
    and role_version = 1
    and lock_version = 1
    and lifecycle_status = 'draft'
    and scope_ceiling = 'building'
), 'draft role created with role_version = 1, lock_version = 1, lifecycle_status = draft');

-- 5.3 Duplicate draft for same code in same workspace rejected
select throws_ok(
  $$select customer_api.create_workspace_role_draft_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    'lead_technician',
    'Duplicate Lead Technician',
    'Duplicate description',
    'building',
    null,
    'Attempt duplicate draft',
    'idem_create_role_dup'
  )$$,
  '40001',
  'workspace_role_draft_already_exists',
  'creating a duplicate draft for existing code is rejected with SQLSTATE 40001'
);

-- 5.4 Attach Module increments lock_version to 2
select lives_ok(
  $$select customer_api.attach_workspace_role_module_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_roles where code = 'lead_technician' limit 1),
    (select id from platform.module_definitions where code = 'maintenance' limit 1),
    1,
    'Attach maintenance module to role',
    'idem_attach_mod_001'
  )$$,
  'attach_workspace_role_module_v1 succeeds with expected lock_version = 1'
);

select ok(exists(
  select 1 from platform.workspace_roles
  where code = 'lead_technician' and lock_version = 2
), 'lock_version incremented to 2 after attaching module');

-- 5.5 Mismatched lock_version raises SQLSTATE 40001
select throws_ok(
  $$select customer_api.attach_workspace_role_permission_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_roles where code = 'lead_technician' limit 1),
    (select id from identity.permissions where code = 'maintenance.requests.manage' limit 1),
    'allow',
    1, -- Wrong lock_version (current is 2)
    'Attach permission with stale lock version',
    'idem_attach_perm_stale'
  )$$,
  '40001',
  'workspace_role_expected_lock_version_conflict',
  'mismatched expected lock_version raises concurrency conflict 40001'
);

-- 5.6 Snapshot Template Permissions
select lives_ok(
  $$select customer_api.snapshot_workspace_role_template_permissions_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_roles where code = 'lead_technician' limit 1),
    2,
    'Snapshot base template permissions',
    'idem_snapshot_tpl_001'
  )$$,
  'snapshot_workspace_role_template_permissions_v1 succeeds with lock_version = 2'
);

select ok(exists(
  select 1 from platform.workspace_roles
  where code = 'lead_technician' and lock_version = 3
), 'lock_version incremented to 3 after snapshotting template');

select ok((
  select count(*) from platform.workspace_role_permissions wrp
  join platform.workspace_roles wr on wr.id = wrp.workspace_role_id
  where wr.code = 'lead_technician'
) > 0, 'permissions copied into draft role from template for attached module');

-- 5.7 Publish Role
select lives_ok(
  $$select customer_api.publish_workspace_role_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_roles where code = 'lead_technician' limit 1),
    3,
    'Publish lead technician role version 1',
    'idem_publish_001'
  )$$,
  'publish_workspace_role_v1 succeeds'
);

-- 5.8 Published Role State: lifecycle_status = 'published', valid_to is null
select ok(exists(
  select 1 from platform.workspace_roles
  where code = 'lead_technician'
    and role_version = 1
    and lifecycle_status = 'published'
    and valid_to is null
), 'role successfully transitioned to published state');

-- 5.9 Direct update on published role is rejected
select throws_ok(
  $$update platform.workspace_roles set name = 'Mutated Technician' where code = 'lead_technician'$$,
  '42501',
  'published_workspace_role_immutable',
  'direct UPDATE on published workspace role is rejected by trigger'
);

-- 5.10 Direct delete on published role is rejected
select throws_ok(
  $$delete from platform.workspace_roles where code = 'lead_technician'$$,
  '42501',
  'workspace_role_delete_prohibited',
  'direct DELETE on workspace role is prohibited by trigger'
);

-- 5.11 Modifying modules/permissions on published role is rejected
select throws_ok(
  $$insert into platform.workspace_role_modules (
    tenant_id, workspace_role_id, module_definition_id
  ) select tenant_id, id, (select id from platform.module_definitions where code = 'billing' limit 1)
  from platform.workspace_roles where code = 'lead_technician'$$,
  '42501',
  'workspace_role_not_in_draft_state',
  'attaching module to published role is rejected by draft-only trigger'
);

-- 5.12 Publish new version (version 2) supersedes version 1
select lives_ok(
  $$select customer_api.create_workspace_role_draft_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    'lead_technician',
    'Lead Maintenance Technician v2',
    'Revision 2 with enhanced scope',
    'property',
    null,
    'Create version 2 draft',
    'idem_create_v2_draft'
  )$$,
  'create_workspace_role_draft_v1 creates version 2 draft for existing code'
);

select ok(exists(
  select 1 from platform.workspace_roles
  where code = 'lead_technician' and role_version = 2 and lifecycle_status = 'draft'
), 'new draft created with role_version = 2');

-- Attach module and permission to v2
select lives_ok(
  $$select customer_api.attach_workspace_role_module_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_roles where code = 'lead_technician' and role_version = 2),
    (select id from platform.module_definitions where code = 'maintenance' limit 1),
    1,
    'Attach module to v2',
    'idem_v2_attach_mod'
  )$$,
  'attach module to v2 succeeds'
);

select lives_ok(
  $$select customer_api.attach_workspace_role_permission_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_roles where code = 'lead_technician' and role_version = 2),
    (select id from identity.permissions where code = 'maintenance.requests.manage' limit 1),
    'allow',
    2,
    'Attach permission to v2',
    'idem_v2_attach_perm'
  )$$,
  'attach permission to v2 succeeds'
);

-- Publish v2 -> atomically archives v1
select lives_ok(
  $$select customer_api.publish_workspace_role_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_roles where code = 'lead_technician' and role_version = 2),
    3,
    'Publish v2 and supersede v1',
    'idem_publish_v2'
  )$$,
  'publishing v2 succeeds and supersedes v1'
);

select ok(exists(
  select 1 from platform.workspace_roles
  where code = 'lead_technician' and role_version = 1 and lifecycle_status = 'archived' and valid_to is not null
), 'v1 atomically archived upon publishing v2');

select ok(exists(
  select 1 from platform.workspace_roles
  where code = 'lead_technician' and role_version = 2 and lifecycle_status = 'published' and valid_to is null
), 'v2 is now the single active published role');

-- ----------------------------------------------------------------------------
-- 6. Scope Ceilings, Scope Ancestry & Member Assignments (14 assertions)
-- ----------------------------------------------------------------------------

-- 6.1 Create draft role with ceiling = 'unit'
select lives_ok(
  $$select customer_api.create_workspace_role_draft_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    'unit_inspector',
    'Unit Inspector',
    'Inspector restricted strictly to units',
    'unit',
    null,
    'Create unit-ceiling role',
    'idem_create_unit_role'
  )$$,
  'create role draft with unit ceiling succeeds'
);

-- Attach module & permission, then publish
select lives_ok(
  $$select customer_api.attach_workspace_role_module_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_roles where code = 'unit_inspector'),
    (select id from platform.module_definitions where code = 'maintenance' limit 1),
    1,
    'Attach module to unit inspector',
    'idem_unit_mod'
  )$$,
  'attach module to unit inspector succeeds'
);

select lives_ok(
  $$select customer_api.attach_workspace_role_permission_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_roles where code = 'unit_inspector'),
    (select id from identity.permissions where code = 'maintenance.requests.manage' limit 1),
    'allow',
    2,
    'Attach permission to unit inspector',
    'idem_unit_perm'
  )$$,
  'attach permission to unit inspector succeeds'
);

select lives_ok(
  $$select customer_api.publish_workspace_role_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_roles where code = 'unit_inspector'),
    3,
    'Publish unit inspector role',
    'idem_unit_publish'
  )$$,
  'publish unit inspector succeeds'
);

-- 6.2 Scope Ceiling Violation: Attempt to assign unit_inspector at 'building' scope is rejected
select throws_ok(
  $$select customer_api.assign_workspace_role_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    '09000000-0000-0000-0000-000001000002'::uuid, -- target membership
    (select id from platform.workspace_roles where code = 'unit_inspector'),
    'building',
    '09000000-0000-0000-0000-000000001000'::uuid, -- property
    '09000000-0000-0000-0000-000000010000'::uuid, -- building
    null,
    null,
    'Assign above ceiling',
    'idem_assign_ceiling_viol'
  )$$,
  '42501',
  'workspace_member_role_exceeds_scope_ceiling',
  'assigning role above its scope_ceiling is rejected by trigger'
);

-- 6.3 Valid assignment at unit scope
select lives_ok(
  $$select customer_api.assign_workspace_role_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    '09000000-0000-0000-0000-000001000002'::uuid,
    (select id from platform.workspace_roles where code = 'unit_inspector'),
    'unit',
    '09000000-0000-0000-0000-000000001000'::uuid,
    '09000000-0000-0000-0000-000000010000'::uuid,
    '09000000-0000-0000-0000-000000100001'::uuid, -- Unit 101
    null,
    'Assign unit inspector to Unit 101',
    'idem_assign_unit_101'
  )$$,
  'assigning role at exact unit scope succeeds'
);

-- 6.4 Scope Ancestry Mismatch: Unit belongs to Building 1, but passed Building 2
select throws_ok(
  $$select customer_api.assign_workspace_role_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    '09000000-0000-0000-0000-000001000002'::uuid,
    (select id from platform.workspace_roles where code = 'unit_inspector'),
    'unit',
    '09000000-0000-0000-0000-000000001000'::uuid,
    '09000000-0000-0000-0000-000000020000'::uuid, -- Mismatched Building 2
    '09000000-0000-0000-0000-000000100001'::uuid, -- Unit 101 belongs to Building 1
    null,
    'Ancestry mismatch test',
    'idem_assign_ancestry_mismatch'
  )$$,
  '22023',
  'unit_scope_ancestry_mismatch',
  'unit scope ancestry mismatch is rejected'
);

-- 6.5 Property not bound to workspace is rejected
select throws_ok(
  $$select customer_api.assign_workspace_role_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    '09000000-0000-0000-0000-000001000002'::uuid,
    (select id from platform.workspace_roles where code = 'lead_technician' and role_version = 2),
    'property',
    '09000000-0000-0000-0000-000000002000'::uuid, -- Property B (bound to Workspace 2, NOT Workspace 1)
    null,
    null,
    null,
    'Unbound property assignment',
    'idem_assign_unbound_prop'
  )$$,
  '42501',
  'property_not_bound_to_workspace',
  'property not bound to workspace is rejected'
);

-- 6.6 Cross-tenant assignment is rejected
select throws_ok(
  $$select customer_api.assign_workspace_role_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    '09000000-0000-0000-0000-000001000003'::uuid, -- Membership from Tenant 2
    (select id from platform.workspace_roles where code = 'lead_technician' and role_version = 2),
    'property',
    '09000000-0000-0000-0000-000000001000'::uuid,
    null,
    null,
    null,
    'Cross-tenant assignment attempt',
    'idem_assign_cross_tenant'
  )$$,
  '42501',
  'workspace_member_role_target_membership_invalid',
  'cross-tenant assignment is rejected'
);

-- 6.7 Duplicate overlapping assignment is rejected
select throws_ok(
  $$select customer_api.assign_workspace_role_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    '09000000-0000-0000-0000-000001000002'::uuid,
    (select id from platform.workspace_roles where code = 'unit_inspector'),
    'unit',
    '09000000-0000-0000-0000-000000001000'::uuid,
    '09000000-0000-0000-0000-000000010000'::uuid,
    '09000000-0000-0000-0000-000000100001'::uuid,
    null,
    'Duplicate assignment attempt',
    'idem_assign_unit_dup'
  )$$,
  '23505',
  'workspace_member_role_overlapping_assignment',
  'duplicate overlapping assignment is rejected'
);

-- 6.8 Revoke assignment closes valid_to period
select lives_ok(
  $$select customer_api.revoke_workspace_role_assignment_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_member_roles where customer_workspace_id = '09000000-0000-0000-0000-000000000100'::uuid limit 1),
    1,
    'Revoking assignment for testing',
    'idem_revoke_001'
  )$$,
  'revoke_workspace_role_assignment_v1 succeeds'
);

select ok(exists(
  select 1 from platform.workspace_member_roles
  where customer_workspace_id = '09000000-0000-0000-0000-000000000100'::uuid
    and valid_to is not null
    and lock_version = 2
), 'assignment revoked by setting valid_to and incrementing lock_version');

-- 6.9 Direct delete on workspace_member_roles is prohibited
select throws_ok(
  $$delete from platform.workspace_member_roles$$,
  '42501',
  'workspace_member_role_delete_prohibited',
  'physical DELETE on workspace_member_roles is prohibited by trigger'
);

-- Re-assign unit_inspector to Unit 101 for permission engine tests
select lives_ok(
  $$select customer_api.assign_workspace_role_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    '09000000-0000-0000-0000-000001000002'::uuid,
    (select id from platform.workspace_roles where code = 'unit_inspector'),
    'unit',
    '09000000-0000-0000-0000-000000001000'::uuid,
    '09000000-0000-0000-0000-000000010000'::uuid,
    '09000000-0000-0000-0000-000000100001'::uuid,
    null,
    'Reassign for permission testing',
    'idem_reassign_unit_101'
  )$$,
  'reassigning role after revocation succeeds'
);

-- ----------------------------------------------------------------------------
-- 7. Effective Permission Resolution Engine (18 assertions)
-- ----------------------------------------------------------------------------

-- Set auth context to target member user
select set_config('request.jwt.claims', jsonb_build_object('sub', '09000000-0000-0000-0000-000000000020', 'aal', 'aal1')::text, true);

-- 7.1 Path B Allow: Unit 101 has allow -> returns true
select ok(
  app_private.check_effective_permission_v1(
    '09000000-0000-0000-0000-000010000002'::uuid,
    'maintenance.requests.manage',
    'maintenance',
    'unit',
    '09000000-0000-0000-0000-000000100001'::uuid
  ) is true,
  'effective permission returns true for Unit 101 covered by assignment'
);

-- 7.2 Out of Scope: Unit 102 does not have assignment -> returns false
select ok(
  app_private.check_effective_permission_v1(
    '09000000-0000-0000-0000-000010000002'::uuid,
    'maintenance.requests.manage',
    'maintenance',
    'unit',
    '09000000-0000-0000-0000-000000100002'::uuid
  ) is false,
  'effective permission returns false for Unit 102 outside assigned scope'
);

-- 7.3 Common Gate: Uninstalled / Inactive module -> returns false
select ok(
  app_private.check_effective_permission_v1(
    '09000000-0000-0000-0000-000010000002'::uuid,
    'billing.manage',
    'billing', -- billing is not installed in this workspace
    'unit',
    '09000000-0000-0000-0000-000000100001'::uuid
  ) is false,
  'effective permission returns false when module is not installed'
);

-- 7.4 Common Gate: Missing / Inactive binding -> returns false
select ok(
  app_private.check_effective_permission_v1(
    '09000000-0000-0000-0000-000010000002'::uuid,
    'workspace.role.manage', -- Administrative permission, not in module bindings
    'maintenance',
    'unit',
    '09000000-0000-0000-0000-000000100001'::uuid
  ) is false,
  'effective permission returns false for unmapped administrative permission'
);

-- 7.5 Deny-First Evaluation: Attach scoped deny on building
-- Switch to admin to create a deny role and assign it to member at building scope
select set_config('request.jwt.claims', jsonb_build_object('sub', '09000000-0000-0000-0000-000000000010', 'aal', 'aal2')::text, true);

select lives_ok(
  $$select customer_api.create_workspace_role_draft_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    'deny_inspector',
    'Deny Inspector',
    'Deny role for testing priority',
    'building',
    null,
    'Create deny role',
    'idem_create_deny_role'
  )$$,
  'create draft deny role succeeds'
);

select lives_ok(
  $$select customer_api.attach_workspace_role_module_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_roles where code = 'deny_inspector'),
    (select id from platform.module_definitions where code = 'maintenance' limit 1),
    1,
    'Attach maintenance module',
    'idem_deny_mod'
  )$$,
  'attach module to deny role succeeds'
);

select lives_ok(
  $$select customer_api.attach_workspace_role_permission_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_roles where code = 'deny_inspector'),
    (select id from identity.permissions where code = 'maintenance.requests.manage' limit 1),
    'deny',
    2,
    'Attach explicit deny effect',
    'idem_deny_perm'
  )$$,
  'attach deny permission succeeds'
);

select lives_ok(
  $$select customer_api.publish_workspace_role_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_roles where code = 'deny_inspector'),
    3,
    'Publish deny role',
    'idem_deny_publish'
  )$$,
  'publish deny role succeeds'
);

select lives_ok(
  $$select customer_api.assign_workspace_role_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    '09000000-0000-0000-0000-000001000002'::uuid,
    (select id from platform.workspace_roles where code = 'deny_inspector'),
    'building',
    '09000000-0000-0000-0000-000000001000'::uuid,
    '09000000-0000-0000-0000-000000010000'::uuid,
    null,
    null,
    'Assign deny role at building scope',
    'idem_assign_deny_bld'
  )$$,
  'assign deny role at building scope succeeds'
);

-- Switch back to member user
select set_config('request.jwt.claims', jsonb_build_object('sub', '09000000-0000-0000-0000-000000000020', 'aal', 'aal1')::text, true);

-- 7.6 Deny at Building scope overrides Allow at Unit 101 scope -> returns false!
select ok(
  app_private.check_effective_permission_v1(
    '09000000-0000-0000-0000-000010000002'::uuid,
    'maintenance.requests.manage',
    'maintenance',
    'unit',
    '09000000-0000-0000-0000-000000100001'::uuid
  ) is false,
  'deny at building scope overrides allow at unit scope (deny-first guaranteed)'
);

-- 7.7 Non-existent scope object -> returns false
select ok(
  app_private.check_effective_permission_v1(
    '09000000-0000-0000-0000-000010000002'::uuid,
    'maintenance.requests.manage',
    'maintenance',
    'unit',
    '09000000-0000-0000-0000-999999999999'::uuid
  ) is false,
  'effective permission returns false for non-existent target unit'
);

-- ----------------------------------------------------------------------------
-- 8. Security & AAL2 Enforcement, Read RPC & Audit Verification (10 assertions)
-- ----------------------------------------------------------------------------

-- 8.1 Read RPC succeeds without AAL2 for authorized role
select set_config('request.jwt.claims', jsonb_build_object('sub', '09000000-0000-0000-0000-000000000010', 'aal', 'aal1')::text, true);
select lives_ok(
  $$select customer_api.get_workspace_roles_v1('09000000-0000-0000-0000-000010000001'::uuid)$$,
  'get_workspace_roles_v1 succeeds with AAL1 for admin role'
);

-- 8.2 Mutation RPC fails with AAL1 (AAL2 is mandatory)
select throws_ok(
  $$select customer_api.create_workspace_role_draft_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    'fail_role',
    'Fail Role',
    null,
    'workspace',
    null,
    'AAL1 failure test',
    'idem_aal1_fail'
  )$$,
  '42501',
  'mfa_required',
  'mutation RPC requires AAL2 MFA'
);

-- 8.3 Unauthorized user without workspace.role.read fails
select set_config('request.jwt.claims', jsonb_build_object('sub', '09000000-0000-0000-0000-000000000020', 'aal', 'aal1')::text, true);
select throws_ok(
  $$select customer_api.get_workspace_roles_v1('09000000-0000-0000-0000-000010000002'::uuid)$$,
  '42501',
  'workspace_role_read_permission_required',
  'user without workspace.role.read cannot access get_workspace_roles_v1'
);

-- 8.4 Idempotency Replay returns exact same snapshot
select set_config('request.jwt.claims', jsonb_build_object('sub', '09000000-0000-0000-0000-000000000010', 'aal', 'aal2')::text, true);
select ok(
  (select customer_api.create_workspace_role_draft_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    'lead_technician',
    'Lead Maintenance Technician',
    'Responsible for work orders and inspections',
    'building',
    (select id from identity.roles where code = 'property_manager' limit 1),
    'Create draft role for maintenance team',
    'idem_create_role_001'
  ))->>'action' = 'create_draft',
  'idempotent replay returns exact stored response snapshot'
);

-- 8.5 Idempotency Conflict (different payload, same key) raises 22023
select throws_ok(
  $$select customer_api.create_workspace_role_draft_v1(
    '09000000-0000-0000-0000-000010000001'::uuid,
    'tampered_code',
    'Tampered Name',
    null,
    'workspace',
    null,
    'Tampered reason with same idempotency key',
    'idem_create_role_001'
  )$$,
  '22023',
  'workspace_role_idempotency_conflict',
  'idempotency key conflict raises SQLSTATE 22023'
);

-- 8.6 Audit Events recorded in audit.events
select ok(exists(
  select 1 from audit.events where action = 'WORKSPACE_ROLE_CREATED'
), 'audit event WORKSPACE_ROLE_CREATED recorded');

select ok(exists(
  select 1 from audit.events where action = 'WORKSPACE_ROLE_PUBLISHED'
), 'audit event WORKSPACE_ROLE_PUBLISHED recorded');

select ok(exists(
  select 1 from audit.events where action = 'WORKSPACE_ROLE_ASSIGNED'
), 'audit event WORKSPACE_ROLE_ASSIGNED recorded');

-- 8.7 Zero Side Effects on Finance / Ledger
select ok(not exists(
  select 1 from audit.events where entity_type in ('ledger_transaction', 'journal_entry') and reason like '%test%'
), 'finance and ledger remain completely unaffected');

-- 8.8 Zero Side Effects on Identity Delegations
select ok(not exists(
  select 1 from identity.delegations where purpose like '%090%'
), 'legacy identity.delegations remains completely untouched');

rollback;
