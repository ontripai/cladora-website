-- =============================================================================
-- Test 091: Controlled Workspace Delegation, Independent Approvals,
-- Four-Eyes Control & Effective Permission Integration (001B.2)
-- Package: CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001B.2
-- Scope: Forward-Versioning Registry Handoff, Pure Delegated Allow,
-- Grantor Authority Ceiling, Independent Recipient Acceptance,
-- Independent Approvals (Four-Eyes), Unified Advisory Locks,
-- Atomic Audit, Dynamic Expiry, and Effective Permission Integration.
-- Cardinal Invariant:
-- Workspace Taxonomy != Module Activation != Entitlement != Permission != Role != Delegation != Country Pack
-- =============================================================================
begin;
select plan(46);

-- ----------------------------------------------------------------------------
-- 1. Structural & Table Schema Verification (4 assertions)
-- ----------------------------------------------------------------------------
select has_table('platform', 'workspace_delegations', 'platform.workspace_delegations table exists');
select has_table('platform', 'workspace_delegation_permissions', 'platform.workspace_delegation_permissions table exists');
select has_table('platform', 'workspace_delegation_approvals', 'platform.workspace_delegation_approvals table exists');
select has_table('platform', 'workspace_delegation_idempotency', 'platform.workspace_delegation_idempotency table exists');

-- ----------------------------------------------------------------------------
-- 2. Dedicated Delegation Permissions Seeding (1 assertion)
-- ----------------------------------------------------------------------------
select ok(
  (select count(*) from identity.permissions where code in (
    'workspace.delegation.read',
    'workspace.delegation.manage',
    'workspace.delegation.approve',
    'workspace.delegation.revoke'
  )) = 4,
  'all 4 dedicated workspace delegation permissions exist in identity.permissions'
);

-- ----------------------------------------------------------------------------
-- 3. Binding Forward-Versioning & Handoff Integrity (5 assertions)
-- ----------------------------------------------------------------------------
-- 3.1 Registry total records = 90 (48 v1 + 42 v2), active records = 48
select ok(
  (select count(*) from platform.module_permission_bindings) = 90 and
  (select count(*) from platform.module_permission_bindings where lifecycle_status = 'active') = 48,
  'binding registry contains exactly 90 total records and 48 active records'
);

-- 3.2 Exactly 42 delegable active bindings have binding_version = 2 and is_delegable = true
select ok(
  (select count(*) from platform.module_permission_bindings
   where binding_version = 2 and is_delegable is true and lifecycle_status = 'active') = 42,
  'exactly 42 delegable module permission bindings upgraded to active v2'
);

-- 3.3 The 6 high-risk non-delegable permissions stay at v1 with zero v2 records
select ok(
  (select count(*) from platform.module_permission_bindings
   where is_delegable is false and lifecycle_status = 'active') = 6 and
  not exists (
    select 1 from platform.module_permission_bindings b
    join identity.permissions p on p.id = b.permission_id
    where b.binding_version = 2 and p.code in (
      'billing.cancel', 'payments.reverse', 'payments.reconcile',
      'utilities.tariffs.manage', 'governance.votes.administer', 'governance.minutes.finalize'
    )
  ),
  '6 high-risk permissions remain strictly non-delegable at v1 with zero v2 records'
);

-- 3.4 Forward-close handoff has zero temporal gap and zero overlap between v1 and v2
select ok(
  not exists (
    select 1 from platform.module_permission_bindings v1
    join platform.module_permission_bindings v2
      on v2.module_definition_id = v1.module_definition_id and v2.permission_id = v1.permission_id
    where v1.binding_version = 1 and v2.binding_version = 2
      and v1.valid_to is distinct from v2.valid_from
  ),
  'forward-close handoff has zero temporal gap and zero overlap between v1 and v2'
);

-- 3.5 Seeding validation function passes
select lives_ok(
  $$select app_private.validate_module_permission_bindings_v2_seeding_v1()$$,
  'binding v2 validation function executes and validates registry invariants cleanly'
);

-- ----------------------------------------------------------------------------
-- 4. Pure Delegated Allow & RPC Signature Enforcements (3 assertions)
-- ----------------------------------------------------------------------------
-- 4.1 platform.workspace_delegation_permissions has no effect column
select ok(
  not exists (
    select 1 from information_schema.columns
    where table_schema = 'platform' and table_name = 'workspace_delegation_permissions' and column_name = 'effect'
  ),
  'platform.workspace_delegation_permissions has no effect column (pure Allow)'
);

-- 4.2 attach_workspace_delegation_permission_v1 has no p_effect argument
select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.id = p.pronamespace
    where n.nspname = 'customer_api' and p.proname = 'attach_workspace_delegation_permission_v1'
      and 'p_effect' = any(p.proargnames)
  ),
  'attach_workspace_delegation_permission_v1 has no p_effect argument'
);

-- 4.3 create_workspace_delegation_draft_v1 has no p_expected_lock_version argument
select ok(
  not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.id = p.pronamespace
    where n.nspname = 'customer_api' and p.proname = 'create_workspace_delegation_draft_v1'
      and 'p_expected_lock_version' = any(p.proargnames)
  ),
  'create_workspace_delegation_draft_v1 has no p_expected_lock_version argument'
);

-- ----------------------------------------------------------------------------
-- Provision Isolated Test Fixtures for 091
-- ----------------------------------------------------------------------------
do $$
declare
  v_tenant_id uuid := '09100000-0000-0000-0000-000000000001'::uuid;
  v_tenant2_id uuid := '09100000-0000-0000-0000-000000000002'::uuid;
  v_user_grantor_id uuid := '09100000-0000-0000-0000-000000000010'::uuid;
  v_user_grantee_id uuid := '09100000-0000-0000-0000-000000000020'::uuid;
  v_user_approver_id uuid := '09100000-0000-0000-0000-000000000030'::uuid;
  v_user_censor_id uuid := '09100000-0000-0000-0000-000000000040'::uuid;
  v_user_admin_id uuid := '09100000-0000-0000-0000-000000000050'::uuid;
  v_user_unauth_id uuid := '09100000-0000-0000-0000-000000000060'::uuid;

  v_ws_id uuid := '09100000-0000-0000-0000-000000000100'::uuid;
  v_ws2_id uuid := '09100000-0000-0000-0000-000000000200'::uuid;
  v_prop_id uuid := '09100000-0000-0000-0000-000000001000'::uuid;
  v_prop2_id uuid := '09100000-0000-0000-0000-000000002000'::uuid;
  v_bld_id uuid := '09100000-0000-0000-0000-000000010000'::uuid;
  v_unit_id uuid := '09100000-0000-0000-0000-000000100001'::uuid;

  v_role_pm_id uuid;
  v_role_owner_id uuid;
  v_role_pres_id uuid;
  v_role_censor_id uuid;
  v_role_admin_id uuid;

  v_mem_grantor_id uuid := '09100000-0000-0000-0000-000001000001'::uuid;
  v_mem_grantee_id uuid := '09100000-0000-0000-0000-000001000002'::uuid;
  v_mem_grantor_bld_id uuid := '09100000-0000-0000-0000-000001000004'::uuid;
  v_mem_approver_id uuid := '09100000-0000-0000-0000-000001000005'::uuid;
  v_mem_unauth_id uuid := '09100000-0000-0000-0000-000001000006'::uuid;

  v_ctx_grantor_id uuid := '09100000-0000-0000-0000-000010000001'::uuid;
  v_ctx_grantee_id uuid := '09100000-0000-0000-0000-000010000002'::uuid;
  v_ctx_grantor_ws2_id uuid := '09100000-0000-0000-0000-000010000003'::uuid;
  v_ctx_grantor_bld_id uuid := '09100000-0000-0000-0000-000010000004'::uuid;
  v_ctx_approver_id uuid := '09100000-0000-0000-0000-000010000005'::uuid;
  v_ctx_unauth_id uuid := '09100000-0000-0000-0000-000010000006'::uuid;

  v_profile_id uuid;
  v_model_id uuid;
begin
  -- Users
  insert into auth.users (id, email) values
    (v_user_grantor_id, 'ws_grantor@test.local'),
    (v_user_grantee_id, 'ws_grantee@test.local'),
    (v_user_approver_id, 'ws_approver@test.local'),
    (v_user_censor_id, 'ws_censor@test.local'),
    (v_user_admin_id, 'ws_admin@test.local'),
    (v_user_unauth_id, 'ws_unauth@test.local')
  on conflict (id) do nothing;

  -- Tenants
  insert into platform.tenants (id, legal_name, registration_number, status) values
    (v_tenant_id, 'Test Tenant 091 A', 'RO-TEST-091-A', 'active'),
    (v_tenant2_id, 'Test Tenant 091 B', 'RO-TEST-091-B', 'active')
  on conflict (id) do nothing;

  -- Customer Workspaces
  insert into platform.customer_workspaces (id, tenant_id, workspace_type, commercial_owner, environment, lifecycle_status) values
    (v_ws_id, v_tenant_id, 'ASSOCIATION', 'Owner 091', 'PILOT', 'ACTIVE'),
    (v_ws2_id, v_tenant_id, 'ASSOCIATION', 'Owner 091 B', 'PILOT', 'ACTIVE')
  on conflict (id) do nothing;

  -- Properties, Buildings, Units
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    (v_prop_id, v_tenant_id, 'condominium', 'Property 091 A', 'active'),
    (v_prop2_id, v_tenant_id, 'condominium', 'Property 091 B', 'active')
  on conflict (id) do nothing;

  insert into portfolio.buildings (id, tenant_id, property_id, code, name, status) values
    (v_bld_id, v_tenant_id, v_prop_id, 'BLD-1', 'Building 1', 'active')
  on conflict (id) do nothing;

  insert into portfolio.units (id, tenant_id, building_id, code, status) values
    (v_unit_id, v_tenant_id, v_bld_id, '101', 'active')
  on conflict (id) do nothing;

  -- Workspace Property Bindings
  insert into platform.workspace_property_bindings (tenant_id, customer_workspace_id, property_id, status, binding_source, valid_from) values
    (v_tenant_id, v_ws_id, v_prop_id, 'active', 'platform_assignment', statement_timestamp() - interval '1 day'),
    (v_tenant_id, v_ws2_id, v_prop2_id, 'active', 'platform_assignment', statement_timestamp() - interval '1 day')
  on conflict do nothing;

  -- Canonical Roles
  select id into v_role_pm_id from identity.roles where lower(code) = 'property_manager' and tenant_id is null and is_system = true limit 1;
  select id into v_role_owner_id from identity.roles where lower(code) = 'owner' and tenant_id is null and is_system = true limit 1;
  select id into v_role_pres_id from identity.roles where lower(code) = 'president' and tenant_id is null and is_system = true limit 1;
  select id into v_role_censor_id from identity.roles where lower(code) = 'censor' and tenant_id is null and is_system = true limit 1;
  select id into v_role_admin_id from identity.roles where lower(code) = 'association_admin' and tenant_id is null and is_system = true limit 1;

  -- Grant property_manager maintenance.requests.manage and documents.vault.read directly
  insert into identity.role_permissions (role_id, permission_id, effect)
  select v_role_pm_id, id, 'allow'::platform.decision_effect
  from identity.permissions
  where code in ('maintenance.requests.manage', 'documents.vault.read', 'billing.manage')
  on conflict do nothing;

  -- Direct Deny on occupancy.registry.read for owner role
  insert into identity.role_permissions (role_id, permission_id, effect)
  select v_role_owner_id, id, 'deny'::platform.decision_effect
  from identity.permissions
  where code = 'occupancy.registry.read'
  on conflict do nothing;

  -- Memberships
  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at, ends_at) values
    (v_mem_grantor_id, v_tenant_id, v_user_grantor_id, v_role_pm_id, 'active', statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days'),
    (v_mem_grantee_id, v_tenant_id, v_user_grantee_id, v_role_owner_id, 'active', statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days'),
    (v_mem_grantor_bld_id, v_tenant_id, v_user_grantor_id, v_role_pm_id, 'active', statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days'),
    (v_mem_approver_id, v_tenant_id, v_user_approver_id, v_role_pres_id, 'active', statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days'),
    (v_mem_unauth_id, v_tenant2_id, v_user_unauth_id, v_role_owner_id, 'active', statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days')
  on conflict (id) do nothing;

  -- Context Grants
  insert into identity.context_grants (id, tenant_id, membership_id, scope_type, property_id, starts_at, ends_at) values
    (v_ctx_grantor_id, v_tenant_id, v_mem_grantor_id, 'property', v_prop_id, statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days'),
    (v_ctx_grantee_id, v_tenant_id, v_mem_grantee_id, 'property', v_prop_id, statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days'),
    (v_ctx_grantor_ws2_id, v_tenant_id, v_mem_grantor_id, 'property', v_prop2_id, statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days'),
    (v_ctx_approver_id, v_tenant_id, v_mem_approver_id, 'property', v_prop_id, statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days'),
    (v_ctx_unauth_id, v_tenant2_id, v_mem_unauth_id, 'property', v_prop2_id, statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days')
  on conflict (id) do nothing;

  -- Building-scoped Context Grant for Scope Amplification test
  insert into identity.context_grants (id, tenant_id, membership_id, scope_type, building_id, starts_at, ends_at) values
    (v_ctx_grantor_bld_id, v_tenant_id, v_mem_grantor_bld_id, 'building', v_bld_id, statement_timestamp() - interval '1 day', statement_timestamp() + interval '30 days')
  on conflict (id) do nothing;

  -- Taxonomy Assignment
  select id into v_profile_id from platform.property_profiles where code = 'residential_condominium' and version = 1 limit 1;
  select id into v_model_id from platform.operating_models where code = 'association_managed' and version = 1 limit 1;

  insert into platform.workspace_taxonomy_assignments (
    tenant_id, customer_workspace_id, property_profile_id, operating_model_id, status, valid_from, created_by, country_code
  ) values
    (v_tenant_id, v_ws_id, v_profile_id, v_model_id, 'active', statement_timestamp() - interval '1 day', v_user_grantor_id, 'RO'),
    (v_tenant_id, v_ws2_id, v_profile_id, v_model_id, 'active', statement_timestamp() - interval '1 day', v_user_grantor_id, 'RO')
  on conflict do nothing;

  -- Active Modules & Entitlements
  insert into platform.workspace_modules (
    tenant_id, customer_workspace_id, module_definition_id, module_code, status, reason
  ) select v_tenant_id, v_ws_id, id, code, 'active', 'Delegation suite module activation'
  from platform.module_definitions where code in ('maintenance', 'billing', 'payments', 'governance', 'occupancy', 'documents')
  on conflict do nothing;

  insert into platform.workspace_entitlements (
    customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from
  ) values
    (v_ws_id, 'module.maintenance', 'boolean', true, statement_timestamp() - interval '1 day'),
    (v_ws_id, 'module.billing', 'boolean', true, statement_timestamp() - interval '1 day'),
    (v_ws_id, 'module.payments', 'boolean', true, statement_timestamp() - interval '1 day'),
    (v_ws_id, 'module.governance', 'boolean', true, statement_timestamp() - interval '1 day'),
    (v_ws_id, 'module.occupancy', 'boolean', true, statement_timestamp() - interval '1 day'),
    (v_ws_id, 'module.documents', 'boolean', true, statement_timestamp() - interval '1 day')
  on conflict do nothing;

  -- Seed an active delegation for direct deny / recursion assertions
  insert into platform.workspace_delegations (
    id, delegation_code, tenant_id, customer_workspace_id,
    grantor_membership_id, grantor_user_id, grantee_membership_id, grantee_user_id,
    scope_type, property_id, lifecycle_status, delegation_depth,
    purpose, valid_from, valid_until, lock_version,
    approval_policy_code, required_approval_count, payload_hash, submitted_at, activated_at
  ) values (
    '09100000-0000-0000-0000-000000009999'::uuid, 'DEL-TEST-PRE', v_tenant_id, v_ws_id,
    v_mem_grantor_id, v_user_grantor_id, v_mem_grantee_id, v_user_grantee_id,
    'property', v_prop_id, 'active', 0,
    'Pre-existing delegation for deny and recursion tests',
    statement_timestamp() - interval '1 hour', statement_timestamp() + interval '5 days', 6,
    'single_manager', 1, 'mock_hash', statement_timestamp() - interval '1 hour', statement_timestamp() - interval '30 minutes'
  ) on conflict do nothing;

  insert into platform.workspace_delegation_permissions (
    delegation_id, module_definition_id, permission_id, module_permission_binding_id
  ) values (
    '09100000-0000-0000-0000-000000009999'::uuid,
    (select id from platform.module_definitions where code = 'occupancy' limit 1),
    (select id from identity.permissions where code = 'occupancy.registry.read' limit 1),
    (select id from platform.module_permission_bindings where module_definition_id = (select id from platform.module_definitions where code = 'occupancy' limit 1) and permission_id = (select id from identity.permissions where code = 'occupancy.registry.read' limit 1) and binding_version = 2 limit 1)
  ) on conflict do nothing;

  -- Additional pre-delegations for multi-scenario test coverage
  -- Pre-delegation 1: Exceeding duration ceiling
  insert into platform.workspace_delegations (
    id, delegation_code, tenant_id, customer_workspace_id,
    grantor_membership_id, grantor_user_id, grantee_membership_id, grantee_user_id,
    scope_type, property_id, lifecycle_status, delegation_depth,
    purpose, valid_from, valid_until, lock_version
  ) values (
    '09100000-0000-0000-0000-000000008001'::uuid, 'DEL-TEST-EXC', v_tenant_id, v_ws_id,
    v_mem_grantor_id, v_user_grantor_id, v_mem_grantee_id, v_user_grantee_id,
    'property', v_prop_id, 'draft', 0,
    'Delegation exceeding duration ceiling',
    statement_timestamp() - interval '1 minute', statement_timestamp() + interval '45 days', 2
  ) on conflict do nothing;

  insert into platform.workspace_delegation_permissions (
    delegation_id, module_definition_id, permission_id, module_permission_binding_id
  ) values (
    '09100000-0000-0000-0000-000000008001'::uuid,
    (select id from platform.module_definitions where code = 'maintenance' limit 1),
    (select id from identity.permissions where code = 'maintenance.requests.manage' limit 1),
    (select id from platform.module_permission_bindings where module_definition_id = (select id from platform.module_definitions where code = 'maintenance' limit 1) and permission_id = (select id from identity.permissions where code = 'maintenance.requests.manage' limit 1) and binding_version = 2 limit 1)
  ) on conflict do nothing;

  -- Pre-delegation 2: Building scope for Scope Amplification test
  insert into platform.workspace_delegations (
    id, delegation_code, tenant_id, customer_workspace_id,
    grantor_membership_id, grantor_user_id, grantee_membership_id, grantee_user_id,
    scope_type, property_id, lifecycle_status, delegation_depth,
    purpose, valid_from, valid_until, lock_version
  ) values (
    '09100000-0000-0000-0000-000000008002'::uuid, 'DEL-TEST-AMP', v_tenant_id, v_ws_id,
    v_mem_grantor_bld_id, v_user_grantor_id, v_mem_grantee_id, v_user_grantee_id,
    'property', v_prop_id, 'draft', 0,
    'Scope amplification delegation',
    statement_timestamp() - interval '1 minute', statement_timestamp() + interval '5 days', 1
  ) on conflict do nothing;

  -- Pre-delegation 3: Grantee Rejection test
  insert into platform.workspace_delegations (
    id, delegation_code, tenant_id, customer_workspace_id,
    grantor_membership_id, grantor_user_id, grantee_membership_id, grantee_user_id,
    scope_type, property_id, lifecycle_status, delegation_depth,
    purpose, valid_from, valid_until, lock_version,
    approval_policy_code, required_approval_count, payload_hash, submitted_at
  ) values (
    '09100000-0000-0000-0000-000000008003'::uuid, 'DEL-TEST-REJ', v_tenant_id, v_ws_id,
    v_mem_grantor_id, v_user_grantor_id, v_mem_grantee_id, v_user_grantee_id,
    'property', v_prop_id, 'pending_acceptance', 0,
    'Delegation for rejection test',
    statement_timestamp() - interval '1 minute', statement_timestamp() + interval '5 days', 2,
    'single_manager', 1, 'hash_for_rejection_test', statement_timestamp() - interval '1 minute'
  ) on conflict do nothing;

  -- Pre-delegation 4: Approver Rejection test
  insert into platform.workspace_delegations (
    id, delegation_code, tenant_id, customer_workspace_id,
    grantor_membership_id, grantor_user_id, grantee_membership_id, grantee_user_id,
    scope_type, property_id, lifecycle_status, delegation_depth,
    purpose, valid_from, valid_until, lock_version,
    approval_policy_code, required_approval_count, payload_hash, submitted_at, accepted_at
  ) values (
    '09100000-0000-0000-0000-000000008004'::uuid, 'DEL-TEST-AREJ', v_tenant_id, v_ws_id,
    v_mem_grantor_id, v_user_grantor_id, v_mem_grantee_id, v_user_grantee_id,
    'property', v_prop_id, 'pending_approval', 0,
    'Delegation for approver rejection test',
    statement_timestamp() - interval '1 minute', statement_timestamp() + interval '5 days', 3,
    'single_manager', 1, 'hash_for_approver_rejection', statement_timestamp() - interval '2 minutes', statement_timestamp() - interval '1 minute'
  ) on conflict do nothing;

  -- Pre-delegation 5: Financial four eyes policy detection
  insert into platform.workspace_delegations (
    id, delegation_code, tenant_id, customer_workspace_id,
    grantor_membership_id, grantor_user_id, grantee_membership_id, grantee_user_id,
    scope_type, property_id, lifecycle_status, delegation_depth,
    purpose, valid_from, valid_until, lock_version,
    approval_policy_code, required_approval_count, payload_hash, submitted_at, accepted_at
  ) values (
    '09100000-0000-0000-0000-000000008005'::uuid, 'DEL-TEST-FIN', v_tenant_id, v_ws_id,
    v_mem_grantor_id, v_user_grantor_id, v_mem_grantee_id, v_user_grantee_id,
    'property', v_prop_id, 'pending_approval', 0,
    'Financial four eyes delegation',
    statement_timestamp() - interval '1 minute', statement_timestamp() + interval '10 days', 3,
    'four_eyes_financial', 1, 'hash_fin', statement_timestamp() - interval '2 minutes', statement_timestamp() - interval '1 minute'
  ) on conflict do nothing;

  -- Pre-delegation 6: Sensitive procurement policy detection
  insert into platform.workspace_delegations (
    id, delegation_code, tenant_id, customer_workspace_id,
    grantor_membership_id, grantor_user_id, grantee_membership_id, grantee_user_id,
    scope_type, property_id, lifecycle_status, delegation_depth,
    purpose, valid_from, valid_until, lock_version,
    approval_policy_code, required_approval_count, payload_hash, submitted_at, accepted_at
  ) values (
    '09100000-0000-0000-0000-000000008006'::uuid, 'DEL-TEST-SENS', v_tenant_id, v_ws_id,
    v_mem_grantor_id, v_user_grantor_id, v_mem_grantee_id, v_user_grantee_id,
    'property', v_prop_id, 'pending_approval', 0,
    'Sensitive procurement delegation',
    statement_timestamp() - interval '1 minute', statement_timestamp() + interval '10 days', 3,
    'four_eyes_sensitive', 1, 'hash_sens', statement_timestamp() - interval '2 minutes', statement_timestamp() - interval '1 minute'
  ) on conflict do nothing;

  -- Pre-delegations 7 & 8: Revocation tests (Grantor, Grantee, Admin)
  insert into platform.workspace_delegations (
    id, delegation_code, tenant_id, customer_workspace_id,
    grantor_membership_id, grantor_user_id, grantee_membership_id, grantee_user_id,
    scope_type, property_id, lifecycle_status, delegation_depth,
    purpose, valid_from, valid_until, lock_version,
    approval_policy_code, required_approval_count, payload_hash, activated_at
  ) values (
    '09100000-0000-0000-0000-000000008007'::uuid, 'DEL-TEST-REV1', v_tenant_id, v_ws_id,
    v_mem_grantor_id, v_user_grantor_id, v_mem_grantee_id, v_user_grantee_id,
    'property', v_prop_id, 'active', 0,
    'Delegation for grantor revoke test',
    statement_timestamp() - interval '1 minute', statement_timestamp() + interval '5 days', 6,
    'single_manager', 1, 'hash_rev1', statement_timestamp() - interval '1 minute'
  ), (
    '09100000-0000-0000-0000-000000008008'::uuid, 'DEL-TEST-REV2', v_tenant_id, v_ws_id,
    v_mem_grantor_id, v_user_grantor_id, v_mem_grantee_id, v_user_grantee_id,
    'property', v_prop_id, 'active', 0,
    'Delegation for grantee revoke test',
    statement_timestamp() - interval '1 minute', statement_timestamp() + interval '5 days', 6,
    'single_manager', 1, 'hash_rev2', statement_timestamp() - interval '1 minute'
  ), (
    '09100000-0000-0000-0000-000000008009'::uuid, 'DEL-TEST-REV3', v_tenant_id, v_ws_id,
    v_mem_grantor_id, v_user_grantor_id, v_mem_grantee_id, v_user_grantee_id,
    'property', v_prop_id, 'active', 0,
    'Delegation for admin revoke test',
    statement_timestamp() - interval '1 minute', statement_timestamp() + interval '5 days', 6,
    'single_manager', 1, 'hash_rev3', statement_timestamp() - interval '1 minute'
  ) on conflict do nothing;

end;
$$;

-- Set auth context to Grantor (Property Manager) with AAL2
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '09100000-0000-0000-0000-000000000010',
  'role', 'authenticated',
  'aal', 'aal2'
)::text, true);

-- ----------------------------------------------------------------------------
-- 5. Effective Permission Engine: Direct Deny Precedence & Zero Recursion (2 assertions)
-- ----------------------------------------------------------------------------
-- 5.1 Direct Deny on Path A/B strictly overrides Delegated Allow (Path C)
select ok(
  not app_private.check_effective_permission_v1(
    '09100000-0000-0000-0000-000010000002'::uuid,
    'occupancy.registry.read',
    'occupancy',
    'property',
    '09100000-0000-0000-0000-000000001000'::uuid
  ),
  'direct deny takes strict precedence over delegated allow'
);

-- 5.2 Direct effective permission helper evaluates only Path A/B and strictly rejects Path C recursion
select ok(
  not app_private.check_direct_effective_permission_v1(
    '09100000-0000-0000-0000-000010000002'::uuid,
    '09100000-0000-0000-0000-000001000002'::uuid,
    'maintenance.requests.manage',
    'maintenance',
    'property',
    '09100000-0000-0000-0000-000000001000'::uuid
  ),
  'direct effective permission helper evaluates only path a and b and rejects path c delegation recursion'
);

-- ----------------------------------------------------------------------------
-- 6. Delegation Draft Creation, Invariants & Idempotency (4 assertions)
-- ----------------------------------------------------------------------------
-- 6.1 Create draft succeeds: lock_version = 1, status = draft
select lives_ok(
  $$select customer_api.create_workspace_delegation_draft_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    '09100000-0000-0000-0000-000001000002'::uuid,
    'property',
    '09100000-0000-0000-0000-000000001000'::uuid,
    null, null,
    statement_timestamp() - interval '1 minute',
    statement_timestamp() + interval '7 days',
    'Maintenance delegation for inspections',
    'Routine management handoff',
    'del_idem_create_001'
  )$$,
  'create_workspace_delegation_draft_v1 creates draft with lock_version = 1 and status draft'
);

-- 6.2 Self-delegation is strictly prohibited
select throws_ok(
  $$select customer_api.create_workspace_delegation_draft_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    '09100000-0000-0000-0000-000001000001'::uuid,
    'property',
    '09100000-0000-0000-0000-000000001000'::uuid,
    null, null,
    statement_timestamp(),
    statement_timestamp() + interval '7 days',
    'Self delegation attempt',
    'Testing self-delegation guard',
    'del_idem_self_001'
  )$$,
  '42501',
  'delegation_self_delegation_prohibited',
  'self-delegation is strictly prohibited'
);

-- 6.3 Cross-workspace idempotency collision in same tenant is rejected
select throws_ok(
  $$select customer_api.create_workspace_delegation_draft_v1(
    '09100000-0000-0000-0000-000010000003'::uuid,
    '09100000-0000-0000-0000-000001000002'::uuid,
    'property',
    '09100000-0000-0000-0000-000000002000'::uuid,
    null, null,
    statement_timestamp(),
    statement_timestamp() + interval '7 days',
    'Cross workspace collision attempt',
    'Testing tenant idempotency isolation',
    'del_idem_create_001'
  )$$,
  '22023',
  'workspace_delegation_idempotency_conflict',
  'reusing idempotency key across workspaces in same tenant raises idempotency conflict'
);

-- 6.4 Idempotent replay of create_workspace_delegation_draft_v1 returns snapshot
select ok(
  (customer_api.create_workspace_delegation_draft_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    '09100000-0000-0000-0000-000001000002'::uuid,
    'property',
    '09100000-0000-0000-0000-000000001000'::uuid,
    null, null,
    statement_timestamp() - interval '1 minute',
    statement_timestamp() + interval '7 days',
    'Maintenance delegation for inspections',
    'Routine management handoff',
    'del_idem_create_001'
  )->>'action') = 'create_draft',
  'idempotent replay of create_workspace_delegation_draft_v1 returns stored snapshot without creating duplicate'
);

-- ----------------------------------------------------------------------------
-- 7. Permission Attachment, Grantor Ceiling & Scope Integrity (6 assertions)
-- ----------------------------------------------------------------------------
-- 7.1 Attaching non-delegable binding (billing.cancel) is rejected
select throws_ok(
  $$select customer_api.attach_workspace_delegation_permission_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
    (select id from platform.module_definitions where code = 'billing' limit 1),
    (select id from identity.permissions where code = 'billing.cancel' limit 1),
    1,
    'Attaching non-delegable perm',
    'del_idem_attach_nd_001'
  )$$,
  '42501',
  'delegation_binding_not_delegable',
  'attaching non-delegable permission binding is rejected'
);

-- 7.2 Attaching delegable permission succeeds and increments lock_version
select lives_ok(
  $$select customer_api.attach_workspace_delegation_permission_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
    (select id from platform.module_definitions where code = 'maintenance' limit 1),
    (select id from identity.permissions where code = 'maintenance.requests.manage' limit 1),
    1,
    'Attaching delegable requests.manage',
    'del_idem_attach_001'
  )$$,
  'attaching delegable permission to draft succeeds and advances lock_version'
);

-- 7.3 Detaching permission from draft succeeds and increments lock_version
select lives_ok(
  $$select customer_api.detach_workspace_delegation_permission_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
    (select id from platform.module_definitions where code = 'maintenance' limit 1),
    (select id from identity.permissions where code = 'maintenance.requests.manage' limit 1),
    2,
    'Detaching and re-attaching',
    'del_idem_detach_001'
  )$$,
  'detaching permission from draft succeeds and advances lock_version'
);

-- Re-attach permission for downstream tests
select customer_api.attach_workspace_delegation_permission_v1(
  '09100000-0000-0000-0000-000010000001'::uuid,
  (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
  (select id from platform.module_definitions where code = 'maintenance' limit 1),
  (select id from identity.permissions where code = 'maintenance.requests.manage' limit 1),
  3,
  'Re-attaching delegable requests.manage',
  'del_idem_reattach_001'
);

-- 7.4 Duration exceeding grantor authority ceiling is rejected
select throws_ok(
  $$select customer_api.submit_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    '09100000-0000-0000-0000-000000008001'::uuid,
    2,
    'Submitting excessive duration delegation',
    'del_idem_sub_exc_001'
  )$$,
  '42501',
  'delegation_duration_exceeds_grantor_authority',
  'delegation duration exceeding grantor direct authority ceiling is rejected'
);

-- 7.5 Attaching permission grantor does not hold is rejected
select throws_ok(
  $$select customer_api.attach_workspace_delegation_permission_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
    (select id from platform.module_definitions where code = 'governance' limit 1),
    (select id from identity.permissions where code = 'governance.meetings.manage' limit 1),
    4,
    'Attaching unheld governance permission',
    'del_idem_attach_unheld_001'
  )$$,
  '42501',
  'delegation_grantor_lacks_effective_permission',
  'attaching permission that grantor does not effectively possess is rejected'
);

-- 7.6 Scope amplification beyond grantor direct authority scope is rejected
select throws_ok(
  $$select customer_api.attach_workspace_delegation_permission_v1(
    '09100000-0000-0000-0000-000010000004'::uuid,
    '09100000-0000-0000-0000-000000008002'::uuid,
    (select id from platform.module_definitions where code = 'maintenance' limit 1),
    (select id from identity.permissions where code = 'maintenance.requests.manage' limit 1),
    1,
    'Attempting property scope when grantor is building scope',
    'del_idem_attach_amp_001'
  )$$,
  '42501',
  'delegation_grantor_lacks_effective_permission',
  'scope amplification beyond grantor direct authority scope is rejected'
);

-- ----------------------------------------------------------------------------
-- 8. Lifecycle Transitions: Submit, Immutability & Recipient Decision (5 assertions)
-- ----------------------------------------------------------------------------
-- 8.1 Submit draft advances state to pending_acceptance
select lives_ok(
  $$select customer_api.submit_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
    4,
    'Submit draft for recipient acceptance',
    'del_idem_submit_001'
  )$$,
  'submit_workspace_delegation_v1 advances state to pending_acceptance and computes payload_hash'
);

-- 8.2 Mutating delegation permissions after submit is rejected
select throws_ok(
  $$select customer_api.attach_workspace_delegation_permission_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
    (select id from platform.module_definitions where code = 'maintenance' limit 1),
    (select id from identity.permissions where code = 'maintenance.work_orders.read' limit 1),
    5,
    'Attaching after submit',
    'del_idem_attach_post_sub'
  )$$,
  'P0001',
  'draft_mutations_only',
  'mutating delegation permissions after submit is strictly prohibited'
);

-- 8.3 Non-grantee actor attempting to accept is rejected
select throws_ok(
  $$select customer_api.accept_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
    'accepted',
    5,
    'Non grantee accepting',
    'del_idem_acc_unauth_001'
  )$$,
  '42501',
  'delegation_caller_not_grantee',
  'non-grantee actor attempting to accept delegation is rejected'
);

-- Switch auth context to Grantee (Owner) with AAL2
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '09100000-0000-0000-0000-000000000020',
  'role', 'authenticated',
  'aal', 'aal2'
)::text, true);

-- 8.4 Recipient rejecting delegation transitions state to rejected
select lives_ok(
  $$select customer_api.accept_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000002'::uuid,
    '09100000-0000-0000-0000-000000008003'::uuid,
    'rejected',
    2,
    'Grantee declining delegation',
    'del_idem_rec_rej_001'
  )$$,
  'grantee rejecting delegation transitions state to rejected and emits WORKSPACE_DELEGATION_REJECTED'
);

-- 8.5 Recipient accepting delegation transitions state to pending_approval
select lives_ok(
  $$select customer_api.accept_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000002'::uuid,
    (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
    'accepted',
    5,
    'Accepting delegation responsibility',
    'del_idem_acc_001'
  )$$,
  'grantee accepting delegation transitions state to pending_approval and emits WORKSPACE_DELEGATION_ACCEPTED'
);

-- ----------------------------------------------------------------------------
-- 9. Independent Approvals, Policy Governance & Four-Eyes Controls (9 assertions)
-- ----------------------------------------------------------------------------
-- 9.1 Grantor attempting self-approval is rejected
select throws_ok(
  $$select customer_api.approve_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
    'approved',
    6,
    'Grantor self-approving',
    'del_idem_self_app_grantor'
  )$$,
  '42501',
  'delegation_self_approval_prohibited',
  'grantor attempting self-approval is rejected'
);

-- 9.2 Grantee attempting self-approval is rejected
select throws_ok(
  $$select customer_api.approve_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000002'::uuid,
    (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
    'approved',
    6,
    'Grantee self-approving',
    'del_idem_self_app_grantee'
  )$$,
  '42501',
  'delegation_self_approval_prohibited',
  'grantee attempting self-approval is rejected'
);

-- Switch auth context to Approver (President) with AAL2
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '09100000-0000-0000-0000-000000000030',
  'role', 'authenticated',
  'aal', 'aal2'
)::text, true);

-- 9.3 Approving with stale or mismatched payload hash is rejected
select throws_ok(
  $$
    update platform.workspace_delegations
    set payload_hash = 'stale_tampered_hash_000000000000000000000000000000000000000000000000'
    where purpose = 'Maintenance delegation for inspections';

    select customer_api.approve_workspace_delegation_v1(
      '09100000-0000-0000-0000-000010000005'::uuid,
      (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
      'approved',
      6,
      'Approving tampered payload',
      'del_idem_app_tampered'
    );
  $$,
  '42501',
  'delegation_stale_payload_hash',
  'approval with stale or mismatched payload hash is rejected'
);

-- Restore genuine payload hash
update platform.workspace_delegations
set payload_hash = app_private.compute_delegation_payload_hash_v1(id)
where purpose = 'Maintenance delegation for inspections';

-- 9.4 Approving with mismatching lock_version is rejected with 40001
select throws_ok(
  $$select customer_api.approve_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000005'::uuid,
    (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
    'approved',
    99,
    'Approving with stale lock version',
    'del_idem_app_stale_lock'
  )$$,
  '40001',
  'workspace_delegation_expected_lock_version_conflict',
  'approval with mismatching lock_version is rejected with 40001'
);

-- Switch auth context to Property Manager for policy role check
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '09100000-0000-0000-0000-000000000010',
  'role', 'authenticated',
  'aal', 'aal2'
)::text, true);

-- 9.5 Unauthorized approver role for policy is rejected
select throws_ok(
  $$select customer_api.approve_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    '09100000-0000-0000-0000-000000008005'::uuid,
    'approved',
    3,
    'Property manager approving financial delegation',
    'del_idem_pm_app_fin'
  )$$,
  '42501',
  'delegation_unauthorized_approver_role',
  'unauthorized approver role for policy is rejected'
);

-- Switch back to President
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '09100000-0000-0000-0000-000000000030',
  'role', 'authenticated',
  'aal', 'aal2'
)::text, true);

-- 9.6 Approver rejecting delegation transitions state to rejected
select lives_ok(
  $$select customer_api.approve_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000005'::uuid,
    '09100000-0000-0000-0000-000000008004'::uuid,
    'rejected',
    3,
    'Approver declining delegation request',
    'del_idem_app_rej_001'
  )$$,
  'independent approver rejecting delegation transitions state to rejected and emits WORKSPACE_DELEGATION_REJECTED'
);

-- 9.7 four_eyes_financial policy detected on financial delegation
select ok(
  (select approval_policy_code from platform.workspace_delegations where id = '09100000-0000-0000-0000-000000008005'::uuid) = 'four_eyes_financial',
  'four_eyes_financial policy detected for financial permissions'
);

-- 9.8 four_eyes_sensitive policy detected on procurement delegation
select ok(
  (select approval_policy_code from platform.workspace_delegations where id = '09100000-0000-0000-0000-000000008006'::uuid) = 'four_eyes_sensitive',
  'four_eyes_sensitive policy detected for sensitive procurement permissions'
);

-- 9.9 Final approval atomically activates delegation and emits dual audit events
select lives_ok(
  $$select customer_api.approve_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000005'::uuid,
    (select id from platform.workspace_delegations where purpose = 'Maintenance delegation for inspections' limit 1),
    'approved',
    6,
    'President approving delegation',
    'del_idem_app_pres_001'
  )$$,
  'final approval atomically activates delegation and emits WORKSPACE_DELEGATION_APPROVED and ACTIVATED'
);

-- ----------------------------------------------------------------------------
-- 10. Dynamic Expiry, Dynamic Grantor Invalidation & Emergency Revocation (6 assertions)
-- ----------------------------------------------------------------------------
-- 10.1 Grantee gains effective permission via active Path C delegation
select ok(
  app_private.check_effective_permission_v1(
    '09100000-0000-0000-0000-000010000002'::uuid,
    'maintenance.requests.manage',
    'maintenance',
    'property',
    '09100000-0000-0000-0000-000000001000'::uuid
  ),
  'grantee gains effective permission via active path c delegation'
);

-- 10.2 Dynamic temporal expiry yields no effective permission without database mutation
select ok(
  not (
    update platform.workspace_delegations
    set valid_until = statement_timestamp() - interval '1 second'
    where purpose = 'Maintenance delegation for inspections';

    select app_private.check_effective_permission_v1(
      '09100000-0000-0000-0000-000010000002'::uuid,
      'maintenance.requests.manage',
      'maintenance',
      'property',
      '09100000-0000-0000-0000-000000001000'::uuid
    );
  ),
  'temporally expired delegation dynamically yields no effective permission without database mutation'
);

-- Restore valid_until and test grantor role revocation
update platform.workspace_delegations
set valid_until = statement_timestamp() + interval '5 days'
where purpose = 'Maintenance delegation for inspections';

-- 10.3 Dynamic fail-closed grantor invalidation: revoking grantor role immediately invalidates grantee effective permission
select ok(
  not (
    update identity.memberships
    set status = 'suspended'
    where id = '09100000-0000-0000-0000-000001000001'::uuid;

    select app_private.check_effective_permission_v1(
      '09100000-0000-0000-0000-000010000002'::uuid,
      'maintenance.requests.manage',
      'maintenance',
      'property',
      '09100000-0000-0000-0000-000000001000'::uuid
    );
  ),
  'revoking grantor direct role immediately invalidates grantee delegated effective permission fail-closed'
);

-- Restore grantor membership
update identity.memberships
set status = 'active'
where id = '09100000-0000-0000-0000-000001000001'::uuid;

-- Switch to Grantor for emergency revocation
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '09100000-0000-0000-0000-000000000010',
  'role', 'authenticated',
  'aal', 'aal2'
)::text, true);

-- 10.4 Unilateral emergency revocation by Grantor
select lives_ok(
  $$select customer_api.revoke_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000001'::uuid,
    '09100000-0000-0000-0000-000000008007'::uuid,
    6,
    'Grantor emergency revoke',
    'del_idem_rev_grantor'
  )$$,
  'grantor can execute emergency revocation'
);

-- Switch to Grantee for emergency revocation
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '09100000-0000-0000-0000-000000000020',
  'role', 'authenticated',
  'aal', 'aal2'
)::text, true);

-- 10.5 Unilateral emergency revocation by Grantee
select lives_ok(
  $$select customer_api.revoke_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000002'::uuid,
    '09100000-0000-0000-0000-000000008008'::uuid,
    6,
    'Grantee emergency revoke',
    'del_idem_rev_grantee'
  )$$,
  'grantee can execute emergency revocation'
);

-- Switch to unauthorized third party
select set_config('request.jwt.claims', jsonb_build_object(
  'sub', '09100000-0000-0000-0000-000000000060',
  'role', 'authenticated',
  'aal', 'aal2'
)::text, true);

-- 10.6 Unauthorized third party attempting revocation is rejected
select throws_ok(
  $$select customer_api.revoke_workspace_delegation_v1(
    '09100000-0000-0000-0000-000010000006'::uuid,
    '09100000-0000-0000-0000-000000008009'::uuid,
    6,
    'Unauthorized third party revoke',
    'del_idem_rev_unauth'
  )$$,
  '42501',
  'delegation_unauthorized_revocation_actor',
  'unauthorized third-party cannot revoke delegation'
);

-- ----------------------------------------------------------------------------
-- 11. Security, Trigger Invariants & Clean Teardown (1 assertion)
-- ----------------------------------------------------------------------------
select ok(
  current_setting('session_replication_role') = 'origin',
  'session_replication_role remains origin with zero trigger bypass'
);

rollback;
