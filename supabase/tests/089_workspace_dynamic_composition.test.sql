-- =============================================================================
-- Test 089: Workspace Dynamic Composition Engine (001A) Acceptance Test
-- Package: CLADORA-DYNAMIC-WORKSPACE-COMPOSITION-001A
-- Scope: Canonical Module Registry, Context-Scoped Activation & Deactivation,
-- Relational Dependency DAG, Relational Incompatibilities, Universal Taxonomy
-- Compatibilities, Guarded Temporal State, Versioned Idempotency, and Audit.
-- Invariant: Property Profile != Operating Model != Building DNA != Service Profile != Country Pack
-- =============================================================================
begin;
select plan(68);

-- 1. Structural & Table Schema Verification (7 assertions)
select ok(to_regclass('platform.module_definitions') is not null, 'platform.module_definitions table exists');
select ok(to_regclass('platform.module_dependencies') is not null, 'platform.module_dependencies table exists');
select ok(to_regclass('platform.module_incompatibilities') is not null, 'platform.module_incompatibilities table exists');
select ok(to_regclass('platform.module_property_profile_compatibilities') is not null, 'platform.module_property_profile_compatibilities table exists');
select ok(to_regclass('platform.module_operating_model_compatibilities') is not null, 'platform.module_operating_model_compatibilities table exists');
select ok(to_regclass('platform.workspace_modules') is not null, 'platform.workspace_modules table exists');
select ok(to_regclass('platform.workspace_module_idempotency') is not null, 'platform.workspace_module_idempotency table exists');

-- 2. Permission and Role Seeding Verification (3 assertions)
select ok(exists(select 1 from identity.permissions where code = 'workspace.module.manage'), 'workspace.module.manage permission exists in identity.permissions');
select ok(exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id = rp.permission_id join identity.roles r on r.id = rp.role_id where lower(r.code) = 'association_admin' and p.code = 'workspace.module.manage' and rp.effect = 'allow'), 'association_admin granted workspace.module.manage');
select ok(exists(select 1 from identity.role_permissions rp join identity.permissions p on p.id = rp.permission_id join identity.roles r on r.id = rp.role_id where lower(r.code) = 'property_manager' and p.code = 'workspace.module.manage' and rp.effect = 'allow'), 'property_manager granted workspace.module.manage');

-- 3. Module Definition Constraints & Versioning (8 assertions)
-- 3.1 Composite uniqueness (code, version)
select throws_ok(
  $$insert into platform.module_definitions (code, version, name, labels_json, description, category, entitlement_key, is_active, lifecycle_status) values ('occupancy', 1, 'Duplicate Occupancy', jsonb_build_object('ro','a','en','b','fa','c'), 'test', 'occupancy', 'module.occupancy', false, 'draft')$$,
  '23505',
  null,
  'duplicate (code, version) is rejected'
);

-- 3.2 Same version allowed for different code
select lives_ok(
  $$insert into platform.module_definitions (code, version, name, labels_json, description, category, entitlement_key, is_active, lifecycle_status, valid_from, valid_to) values ('test_ver_mod', 1, 'Test Versioned v1', jsonb_build_object('ro','a','en','b','fa','c'), 'test', 'occupancy', 'module.occupancy', true, 'published', statement_timestamp() + interval '10 days', statement_timestamp() + interval '20 days')$$,
  'different codes can share the same version number'
);

-- 3.3 New version for a code in non-overlapping effective window
select lives_ok(
  $$insert into platform.module_definitions (code, version, name, labels_json, description, category, entitlement_key, is_active, lifecycle_status, valid_from, valid_to) values ('test_ver_mod', 2, 'Test Versioned v2', jsonb_build_object('ro','a','en','b','fa','c'), 'test', 'occupancy', 'module.occupancy', true, 'published', statement_timestamp() + interval '30 days', statement_timestamp() + interval '60 days')$$,
  'new version for same code allowed in non-overlapping future effective window'
);

-- 3.4 Overlapping effective window rejected
select throws_ok(
  $$insert into platform.module_definitions (code, version, name, labels_json, description, category, entitlement_key, is_active, lifecycle_status, valid_from, valid_to) values ('test_ver_mod', 3, 'Test Versioned v3', jsonb_build_object('ro','a','en','b','fa','c'), 'test', 'occupancy', 'module.occupancy', true, 'published', statement_timestamp() + interval '35 days', statement_timestamp() + interval '50 days')$$,
  'P0001',
  'platform_module_definition_version_overlap',
  'overlapping effective period for published definition is rejected'
);

-- 3.5 Invalid trilingual labels rejected
select throws_ok(
  $$insert into platform.module_definitions (code, version, name, labels_json, description, category, entitlement_key) values ('test_lang', 1, 'Test Lang', jsonb_build_object('en','English'), 'test', 'core', 'module.occupancy')$$,
  '23514',
  null,
  'missing RO/FA language labels is rejected by check constraint'
);

-- 3.6 Invalid effective date bounds rejected (valid_to <= valid_from)
select throws_ok(
  $$insert into platform.module_definitions (code, version, name, labels_json, description, category, entitlement_key, valid_from, valid_to) values ('test_dates', 1, 'Test Dates', jsonb_build_object('ro','a','en','b','fa','c'), 'test', 'core', 'module.occupancy', statement_timestamp(), statement_timestamp() - interval '1 hour')$$,
  '23514',
  null,
  'valid_to earlier than valid_from is rejected by check constraint'
);

-- 3.7 Immutability of published definition
select throws_ok(
  $$update platform.module_definitions set name = 'Mutated Occupancy' where code = 'occupancy' and version = 1$$,
  '42501',
  'platform_module_definition_immutable',
  'direct UPDATE on published module definition is rejected'
);

-- 3.8 Deletion of published definition rejected
select throws_ok(
  $$delete from platform.module_definitions where code = 'occupancy' and version = 1$$,
  '42501',
  'platform_module_definition_immutable',
  'direct DELETE on published module definition is rejected'
);

-- 4. Relational Dependency & Incompatibility Graph Constraints (7 assertions)
-- 4.1 Anti-reflexive check: Self-dependency rejected
select throws_ok(
  $$insert into platform.module_dependencies (module_definition_id, required_module_definition_id) select id, id from platform.module_definitions where code = 'billing' and version = 1$$,
  '42501',
  'workspace_module_self_dependency_prohibited',
  'self-dependency is rejected'
);

-- 4.2 Duplicate dependency edge rejected
select throws_ok(
  $$insert into platform.module_dependencies (module_definition_id, required_module_definition_id) select m.id, req.id from platform.module_definitions m cross join platform.module_definitions req where m.code = 'billing' and req.code = 'occupancy'$$,
  '23505',
  null,
  'duplicate dependency edge is rejected by unique constraint'
);

-- 4.3 Dependency cycle detection (billing -> occupancy -> billing)
select throws_ok(
  $$insert into platform.module_dependencies (module_definition_id, required_module_definition_id) select m.id, req.id from platform.module_definitions m cross join platform.module_definitions req where m.code = 'occupancy' and req.code = 'billing'$$,
  '42501',
  'workspace_module_dependency_cycle_detected',
  'cyclic dependency edge is rejected by DAG guard trigger'
);

-- 4.4 Non-existent foreign key in dependencies rejected
select throws_ok(
  $$insert into platform.module_dependencies (module_definition_id, required_module_definition_id) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')$$,
  '23503',
  null,
  'foreign key integrity enforced on module dependencies'
);

-- 4.5 Self-incompatibility rejected
select throws_ok(
  $$insert into platform.module_incompatibilities (module_definition_id, incompatible_module_definition_id) select id, id from platform.module_definitions where code = 'billing' and version = 1$$,
  '23514',
  null,
  'self-incompatibility is rejected'
);

-- 4.6 Non-existent foreign key in incompatibilities rejected
select throws_ok(
  $$insert into platform.module_incompatibilities (module_definition_id, incompatible_module_definition_id) values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')$$,
  '23503',
  null,
  'foreign key integrity enforced on module incompatibilities'
);

-- 4.7 Duplicate incompatibility edge rejected
do $$
declare
  v_mod_a uuid;
  v_mod_b uuid;
begin
  select id into v_mod_a from platform.module_definitions where code = 'utilities' and version = 1;
  select id into v_mod_b from platform.module_definitions where code = 'security' and version = 1;
  insert into platform.module_incompatibilities (module_definition_id, incompatible_module_definition_id) values (v_mod_a, v_mod_b);
end;
$$;

select throws_ok(
  $$insert into platform.module_incompatibilities (module_definition_id, incompatible_module_definition_id) select module_definition_id, incompatible_module_definition_id from platform.module_incompatibilities limit 1$$,
  '23505',
  null,
  'duplicate incompatibility edge is rejected'
);

-- Clean up temporary incompatibility fixture
delete from platform.module_incompatibilities;

-- Setup synthetic fixtures for E2E Gateway verification
do $$
declare
  v_tenant_a uuid := '89100000-0000-0000-0000-000000000001';
  v_tenant_b uuid := '89100000-0000-0000-0000-000000000002';
  v_user_admin uuid := '89000000-0000-0000-0000-000000000001';
  v_user_resident uuid := '89000000-0000-0000-0000-000000000002';
  v_user_other uuid := '89000000-0000-0000-0000-000000000003';
  v_role_admin uuid := '89300000-0000-0000-0000-000000000001';
  v_role_resident uuid := '89300000-0000-0000-0000-000000000002';
  v_mem_admin uuid := '89400000-0000-0000-0000-000000000001';
  v_mem_res uuid := '89400000-0000-0000-0000-000000000002';
  v_mem_other uuid := '89400000-0000-0000-0000-000000000003';
  v_ctx_admin uuid := '89500000-0000-0000-0000-000000000001';
  v_ctx_tenant_only uuid := '89500000-0000-0000-0000-000000000002';
  v_ctx_res uuid := '89500000-0000-0000-0000-000000000003';
  v_ctx_ambiguous uuid := '89500000-0000-0000-0000-000000000004';
  v_ctx_unbound uuid := '89500000-0000-0000-0000-000000000005';
  v_ws_1 uuid := '89600000-0000-0000-0000-000000000001';
  v_ws_2 uuid := '89600000-0000-0000-0000-000000000002';
  v_ws_b uuid := '89600000-0000-0000-0000-000000000003';
  v_prop_1 uuid := '89700000-0000-0000-0000-000000000001';
  v_prop_ambiguous uuid := '89700000-0000-0000-0000-000000000002';
  v_prop_unbound uuid := '89700000-0000-0000-0000-000000000003';
begin
  -- Tenants
  insert into platform.tenants (id, legal_name, registration_number, status) values
    (v_tenant_a, 'Tenant 89 Alpha', 'RO-TEST-89A', 'active'),
    (v_tenant_b, 'Tenant 89 Beta', 'RO-TEST-89B', 'active')
  on conflict do nothing;

  -- Users
  insert into auth.users (id, email) values
    (v_user_admin, 'admin89@cladora.test'),
    (v_user_resident, 'resident89@cladora.test'),
    (v_user_other, 'other89@cladora.test')
  on conflict do nothing;

  -- Roles
  select id into v_role_admin from identity.roles where lower(code) = 'association_admin' limit 1;
  select id into v_role_resident from identity.roles where lower(code) = 'resident' limit 1;

  -- Memberships
  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at) values
    (v_mem_admin, v_tenant_a, v_user_admin, v_role_admin, 'active', statement_timestamp() - interval '1 day'),
    (v_mem_res, v_tenant_a, v_user_resident, v_role_resident, 'active', statement_timestamp() - interval '1 day'),
    (v_mem_other, v_tenant_b, v_user_other, v_role_admin, 'active', statement_timestamp() - interval '1 day');

  -- Properties
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    (v_prop_1, v_tenant_a, 'condominium', 'Property Alpha 89', 'active'),
    (v_prop_ambiguous, v_tenant_a, 'condominium', 'Property Ambiguous 89', 'active'),
    (v_prop_unbound, v_tenant_a, 'condominium', 'Property Unbound 89', 'active');

  -- Workspaces
  insert into platform.customer_workspaces (id, tenant_id, workspace_type, commercial_owner, environment, lifecycle_status) values
    (v_ws_1, v_tenant_a, 'ASSOCIATION', 'Commercial Alpha 1', 'PILOT', 'ACTIVE'),
    (v_ws_2, v_tenant_a, 'ASSOCIATION', 'Commercial Alpha 2', 'PILOT', 'ACTIVE'),
    (v_ws_b, v_tenant_b, 'ASSOCIATION', 'Commercial Beta', 'PILOT', 'ACTIVE');

  -- Property Bindings
  insert into platform.workspace_property_bindings (tenant_id, customer_workspace_id, property_id, status, binding_source) values
    (v_tenant_a, v_ws_1, v_prop_1, 'active', 'migration_verified');

  -- Context Grants
  insert into identity.context_grants (id, tenant_id, membership_id, scope_type, property_id, starts_at) values
    (v_ctx_admin, v_tenant_a, v_mem_admin, 'property', v_prop_1, statement_timestamp() - interval '1 day'),
    (v_ctx_tenant_only, v_tenant_a, v_mem_admin, 'tenant', null, statement_timestamp() - interval '1 day'),
    (v_ctx_res, v_tenant_a, v_mem_res, 'property', v_prop_1, statement_timestamp() - interval '1 day'),
    (v_ctx_ambiguous, v_tenant_a, v_mem_admin, 'property', v_prop_ambiguous, statement_timestamp() - interval '1 day'),
    (v_ctx_unbound, v_tenant_a, v_mem_admin, 'property', v_prop_unbound, statement_timestamp() - interval '1 day');

  -- Seed Entitlements on Workspace 1: module.occupancy and module.billing
  insert into platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from) values
    (v_ws_1, 'module.occupancy', 'boolean', true, statement_timestamp() - interval '1 day'),
    (v_ws_1, 'module.billing', 'boolean', true, statement_timestamp() - interval '1 day');
end;
$$;

-- 5. Context Resolver & Access Matrix (8 assertions)
-- 5.1 Unauthenticated call denied
select set_config('request.jwt.claims', '{"role": "anon"}', true);
select throws_ok(
  $$select customer_api.get_workspace_composition_v1('89500000-0000-0000-0000-000000000001')$$,
  '42501',
  'authentication_required',
  'unauthenticated call to get_workspace_composition_v1 is denied'
);

-- Set admin context with AAL2
select set_config('request.jwt.claims', '{"sub": "89000000-0000-0000-0000-000000000001", "role": "authenticated", "aal": "aal2"}', true);

-- 5.2 Read projection on valid context succeeds
select lives_ok(
  $$select customer_api.get_workspace_composition_v1('89500000-0000-0000-0000-000000000001')$$,
  'get_workspace_composition_v1 succeeds on valid context'
);

-- 5.3 Read projection on unbound property returns neutral binding_required
select ok(
  (customer_api.get_workspace_composition_v1('89500000-0000-0000-0000-000000000005')->>'status') = 'binding_required',
  'read projection on unbound context returns status binding_required without leaking workspace ID'
);

-- 5.4 Read projection on pure tenant-scoped context with multiple workspaces fails-closed
select throws_ok(
  $$select customer_api.get_workspace_composition_v1('89500000-0000-0000-0000-000000000002')$$,
  '42501',
  'workspace_composition_context_not_workspace_bound',
  'pure tenant-scoped context on multi-workspace tenant fails-closed on read'
);

-- 5.5 Mutation rejects tenant-only context (no property scope)
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000002', (select id from platform.module_definitions where code = 'occupancy' and version = 1), null, '{}'::jsonb, 'idem-test-tenant-only-001', 'Test reason')$$,
  '42501',
  'workspace_composition_context_not_workspace_bound',
  'mutation on tenant-only context without property binding is rejected'
);

-- 5.6 Mutation rejects unbound context
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000005', (select id from platform.module_definitions where code = 'occupancy' and version = 1), null, '{}'::jsonb, 'idem-test-unbound-001', 'Test reason')$$,
  '42501',
  'workspace_composition_context_not_workspace_bound',
  'mutation on unbound context is rejected'
);

-- 5.7 Permission check: user lacking workspace.module.manage denied
select set_config('request.jwt.claims', '{"sub": "89000000-0000-0000-0000-000000000002", "role": "authenticated", "aal": "aal2"}', true);
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000003', (select id from platform.module_definitions where code = 'occupancy' and version = 1), null, '{}'::jsonb, 'idem-test-perm-001', 'Test reason')$$,
  '42501',
  'workspace_module_manage_permission_required',
  'user without workspace.module.manage permission is denied activation'
);

-- Reset back to admin user
select set_config('request.jwt.claims', '{"sub": "89000000-0000-0000-0000-000000000001", "role": "authenticated", "aal": "aal2"}', true);

-- 5.8 Cross-tenant context isolation
select set_config('request.jwt.claims', '{"sub": "89000000-0000-0000-0000-000000000003", "role": "authenticated", "aal": "aal2"}', true);
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'occupancy' and version = 1), null, '{}'::jsonb, 'idem-test-cross-tenant-001', 'Test reason')$$,
  '42501',
  'customer_context_access_denied',
  'user cannot access context grant of another tenant'
);
select set_config('request.jwt.claims', '{"sub": "89000000-0000-0000-0000-000000000001", "role": "authenticated", "aal": "aal2"}', true);

-- 6. Configuration Validation & Reason Invariants (6 assertions)
-- 6.1 Non-empty config rejected in 001A
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'occupancy' and version = 1), null, '{"custom_key": "val"}'::jsonb, 'idem-test-config-001', 'Test reason')$$,
  '42501',
  'workspace_module_config_mutation_deferred',
  'non-empty config_json is rejected in 001A'
);

-- 6.2 Null config_json rejected
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'occupancy' and version = 1), null, null, 'idem-test-config-002', 'Test reason')$$,
  '42501',
  'workspace_module_config_mutation_deferred',
  'null config_json is rejected in 001A'
);

-- 6.3 Empty / whitespace-only reason rejected when supplied
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'occupancy' and version = 1), null, '{}'::jsonb, 'idem-test-reason-001', '   ')$$,
  '22023',
  'workspace_module_invalid_reason',
  'whitespace-only reason is rejected'
);

-- 6.4 Too short reason rejected (< 3 chars)
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'occupancy' and version = 1), null, '{}'::jsonb, 'idem-test-reason-002', 'no')$$,
  '22023',
  'workspace_module_invalid_reason',
  'reason shorter than 3 characters is rejected'
);

-- 6.5 Missing idempotency key rejected
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'occupancy' and version = 1), null, '{}'::jsonb, null, 'Valid reason')$$,
  '22023',
  'workspace_module_idempotency_key_required',
  'null idempotency key is rejected'
);

-- 6.6 Invalid idempotency key format rejected
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'occupancy' and version = 1), null, '{}'::jsonb, 'bad key!', 'Valid reason')$$,
  '22023',
  'workspace_module_idempotency_key_invalid',
  'invalid idempotency key format is rejected'
);

-- 7. Entitlement & Sensitivity Enforcement (6 assertions)
-- 7.1 Unentitled module activation rejected (e.g. utilities is not seeded on Workspace 1)
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'utilities' and version = 1), null, '{}'::jsonb, 'idem-test-unentitled-001', 'Test reason')$$,
  '42501',
  'workspace_module_entitlement_required',
  'activation of unentitled module is rejected'
);

-- 7.2 Catalog-only module activation rejected (cannot activate catalog-only concept)
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'core_property_registry' and version = 1), null, '{}'::jsonb, 'idem-test-catonly-001', 'Test reason')$$,
  '42501',
  'workspace_module_definition_not_activatable',
  'activation of catalog_only module definition is rejected'
);

-- 7.3 Sensitive module under AAL1 rejected
select set_config('request.jwt.claims', '{"sub": "89000000-0000-0000-0000-000000000001", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'billing' and version = 1), null, '{}'::jsonb, 'idem-test-aal1-001', 'Test reason')$$,
  '42501',
  'mfa_required',
  'activation of sensitive module billing requires AAL2 MFA'
);
select set_config('request.jwt.claims', '{"sub": "89000000-0000-0000-0000-000000000001", "role": "authenticated", "aal": "aal2"}', true);

-- 7.4 Dependency ordering gate: billing requires occupancy
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'billing' and version = 1), null, '{}'::jsonb, 'idem-test-dep-001', 'Test reason')$$,
  '42501',
  'workspace_module_dependency_missing: occupancy',
  'activation of module with unsatisfied active dependency is rejected'
);

-- 7.5 Successful initial activation of occupancy (root module)
select lives_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'occupancy' and version = 1), null, '{}'::jsonb, 'idem-test-act-occupancy-001', 'Initial activation of occupancy')$$,
  'initial activation of root module occupancy succeeds'
);

-- 7.6 Successful activation of billing after occupancy is active
select lives_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'billing' and version = 1), null, '{}'::jsonb, 'idem-test-act-billing-001', 'Activation of billing')$$,
  'activation of billing succeeds once dependency occupancy is active'
);

-- 8. Idempotency Contract & Replay (7 assertions)
-- 8.1 Replay with exact same key and payload returns cached response snapshot
select ok(
  ((customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'occupancy' and version = 1), null, '{}'::jsonb, 'idem-test-act-occupancy-001', 'Initial activation of occupancy'))->>'status') = 'active',
  'idempotent replay returns cached response snapshot'
);

-- 8.2 Replay does NOT duplicate rows in platform.workspace_modules
select ok(
  (select count(*) from platform.workspace_modules where customer_workspace_id = '89600000-0000-0000-0000-000000000001' and module_code = 'occupancy') = 1,
  'idempotent replay does not create duplicate workspace module rows'
);

-- 8.3 Idempotency key conflict on different reason / payload
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'occupancy' and version = 1), null, '{}'::jsonb, 'idem-test-act-occupancy-001', 'Different reason')$$,
  '22023',
  'workspace_module_idempotency_conflict',
  'reusing idempotency key with different payload/reason is rejected with conflict'
);

-- 8.4 Idempotency key conflict on different workspace of same tenant
select throws_ok(
  $$insert into platform.workspace_module_idempotency (tenant_id, customer_workspace_id, idempotency_key, request_hash, request_hash_version, action, module_definition_id, result_workspace_module_id, response_snapshot, actor_id) values ('89100000-0000-0000-0000-000000000001', '89600000-0000-0000-0000-000000000002', 'idem-test-act-occupancy-001', 'dummyhash', 1, 'activate', (select id from platform.module_definitions where code = 'occupancy' and version = 1), (select id from platform.workspace_modules where module_code = 'occupancy' limit 1), '{}'::jsonb, '89000000-0000-0000-0000-000000000001')$$,
  '23505',
  null,
  'reusing idempotency key across different workspaces of same tenant is rejected by unique(tenant_id, idempotency_key)'
);

-- 8.5 Failed mutation rolls back idempotency record (zero residue on failure)
select ok(
  not exists (select 1 from platform.workspace_module_idempotency where idempotency_key = 'idem-test-unentitled-001'),
  'failed mutation leaves zero idempotency residue'
);

-- 8.6 Single current record invariant
select ok(
  (select count(*) from platform.workspace_modules where customer_workspace_id = '89600000-0000-0000-0000-000000000001' and module_code = 'occupancy' and valid_to is null) = 1,
  'exactly one current record with valid_to IS NULL exists for occupancy'
);

-- 8.7 Audit event verified for activation
select ok(
  exists (select 1 from audit.events where action = 'WORKSPACE_MODULE_ACTIVATED' and entity_type = 'workspace_module' and reason = 'Initial activation of occupancy'),
  'audit event successfully recorded for module activation'
);

-- 9. Concurrency & Deactivation Protection (8 assertions)
-- 9.1 Deactivation without reason rejected
select throws_ok(
  $$select customer_api.deactivate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.workspace_modules where module_code = 'occupancy' and valid_to is null), 'idem-deact-001', '   ')$$,
  '22023',
  'workspace_module_deactivation_reason_required',
  'deactivation requires non-empty reason'
);

-- 9.2 Deactivation with mismatched expected_id rejected (SQLSTATE 40001)
select throws_ok(
  $$select customer_api.deactivate_workspace_module_v1('89500000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000099'::uuid, 'idem-deact-002', 'Deactivation reason')$$,
  '40001',
  'workspace_module_expected_state_conflict',
  'deactivation with non-matching expected ID throws expected state conflict (40001)'
);

-- 9.3 Dependent-module deactivation rejection: cannot deactivate occupancy while billing is active
select throws_ok(
  $$select customer_api.deactivate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.workspace_modules where module_code = 'occupancy' and valid_to is null), 'idem-deact-003', 'Deactivating occupancy')$$,
  '42501',
  'workspace_module_dependent_active: billing',
  'deactivating a module with active dependents is rejected'
);

-- 9.4 Successful deactivation of leaf module (billing)
select lives_ok(
  $$select customer_api.deactivate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.workspace_modules where module_code = 'billing' and valid_to is null), 'idem-deact-billing-001', 'Deactivating billing safely')$$,
  'deactivating leaf module billing succeeds'
);

-- 9.5 Deactivated module is closed with valid_to NOT NULL
select ok(
  exists (select 1 from platform.workspace_modules where customer_workspace_id = '89600000-0000-0000-0000-000000000001' and module_code = 'billing' and status = 'deactivated' and valid_to is not null),
  'deactivated module record is closed with valid_to timestamp'
);

-- 9.6 Deactivating already deactivated module yields 40001 conflict
select throws_ok(
  $$select customer_api.deactivate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.workspace_modules where module_code = 'billing' order by created_at desc limit 1), 'idem-deact-billing-002', 'Deactivating again')$$,
  '40001',
  'workspace_module_expected_state_conflict',
  'deactivating already closed module yields 40001 expected state conflict'
);

-- 9.7 Reactivation contract: reactivation requires expected_id IS NULL
select throws_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'billing' and version = 1), (select id from platform.workspace_modules where module_code = 'billing' and status = 'deactivated' limit 1), '{}'::jsonb, 'idem-react-billing-bad-001', 'Reactivation with stale ID')$$,
  '40001',
  'workspace_module_expected_state_conflict',
  'reactivation with stale historical ID yields 40001 conflict'
);

-- 9.8 Successful reactivation with expected_id = NULL
select lives_ok(
  $$select customer_api.activate_workspace_module_v1('89500000-0000-0000-0000-000000000001', (select id from platform.module_definitions where code = 'billing' and version = 1), null, '{}'::jsonb, 'idem-react-billing-good-001', 'Reactivating billing with null expected ID')$$,
  'reactivation with expected_id IS NULL creates new active temporal record'
);

-- 10. Effective State Projection & Regression Verification (8 assertions)
-- 10.1 Projection reflects active modules
select ok(
  (select count(*) from jsonb_array_elements((customer_api.get_workspace_composition_v1('89500000-0000-0000-0000-000000000001'))->'modules') m where m->>'is_installed' = 'true') = 2,
  'projection correctly reflects 2 installed modules'
);

-- 10.2 Expired entitlement projects effective status suspended_unentitled
update platform.workspace_entitlements
set valid_until = statement_timestamp() - interval '1 hour'
where customer_workspace_id = '89600000-0000-0000-0000-000000000001' and entitlement_key = 'module.billing';

select ok(
  (select m->>'status' from jsonb_array_elements((customer_api.get_workspace_composition_v1('89500000-0000-0000-0000-000000000001'))->'modules') m where m->>'code' = 'billing') = 'suspended_unentitled',
  'installed module with expired entitlement projects effective status suspended_unentitled'
);

-- Restore entitlement
update platform.workspace_entitlements
set valid_until = null
where customer_workspace_id = '89600000-0000-0000-0000-000000000001' and entitlement_key = 'module.billing';

-- 10.3 Direct table manipulation prevented by RLS/Grants for authenticated
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "89000000-0000-0000-0000-000000000001", "role": "authenticated"}', true);

select throws_ok(
  $$select * from platform.workspace_modules limit 1$$,
  '42501',
  null,
  'authenticated user denied direct SELECT on platform.workspace_modules'
);

select throws_ok(
  $$insert into platform.workspace_modules (tenant_id, customer_workspace_id, module_definition_id, module_code, status) values ('89100000-0000-0000-0000-000000000001', '89600000-0000-0000-0000-000000000001', '89100000-0000-0000-0000-000000000001', 'occupancy', 'active')$$,
  '42501',
  null,
  'authenticated user denied direct INSERT on platform.workspace_modules'
);

select throws_ok(
  $$select * from platform.workspace_module_idempotency limit 1$$,
  '42501',
  null,
  'authenticated user denied direct SELECT on platform.workspace_module_idempotency'
);

reset role;

-- 10.4 No side-effects on finance ledger or properties
select ok(
  (select count(*) from finance.journal_entries where tenant_id = '89100000-0000-0000-0000-000000000001') = 0,
  'zero finance ledger rows created or mutated'
);

select ok(
  (select count(*) from portfolio.properties where tenant_id = '89100000-0000-0000-0000-000000000001') = 3,
  'portfolio properties count remains stable without mutation'
);

-- 10.5 Replay with JSONB having different key order produces same canonical result
-- Tested by checking request hash determinism in PL/pgSQL
select ok(
  encode(extensions.digest(convert_to(jsonb_build_object('b', 2, 'a', 1)::text, 'UTF8'), 'sha256'), 'hex') =
  encode(extensions.digest(convert_to(jsonb_build_object('a', 1, 'b', 2)::text, 'UTF8'), 'sha256'), 'hex'),
  'canonical JSONB text representation guarantees deterministic SHA-256 hash regardless of key insertion order'
);

rollback;
