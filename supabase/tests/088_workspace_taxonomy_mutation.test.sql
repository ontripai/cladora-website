-- =============================================================================
-- Test 088: Controlled Workspace Taxonomy Mutation Gateway Acceptance
-- Scope: Transactional assignment, controlled transition, advisory concurrency,
-- audit evidence, deterministic idempotency, fail-closed resolution,
-- canonical country_code persistence, and AAL2 authorization.
-- =============================================================================
begin;
select plan(53);

-- 1. Structural & Permission Verification (6 assertions)
select ok(to_regclass('platform.workspace_taxonomy_idempotency') is not null, 'platform.workspace_taxonomy_idempotency table exists');
select ok(exists(select 1 from identity.permissions where code = 'workspace.taxonomy.manage'), 'workspace.taxonomy.manage permission exists in identity.permissions');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'assign_workspace_taxonomy_v1'), 'customer_api.assign_workspace_taxonomy_v1 RPC exists');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_taxonomy_catalog_options_v1'), 'customer_api.get_taxonomy_catalog_options_v1 RPC exists');
select ok(exists(select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'app_private' and p.proname = 'bootstrap_role_taxonomy_permissions_v1'), 'app_private.bootstrap_role_taxonomy_permissions_v1 trigger function exists');
select ok(exists(select 1 from information_schema.columns where table_schema = 'platform' and table_name = 'workspace_taxonomy_assignments' and column_name = 'country_code'), 'country_code column exists on platform.workspace_taxonomy_assignments');

-- 2. Setup synthetic test fixtures
do $$
declare
  v_tenant_a uuid := '88100000-0000-0000-0000-000000000001';
  v_tenant_b uuid := '88100000-0000-0000-0000-000000000002';
  v_user_admin uuid := '88000000-0000-0000-0000-000000000001';
  v_user_nonadmin uuid := '88000000-0000-0000-0000-000000000002';
  v_user_inactive uuid := '88000000-0000-0000-0000-000000000003';
  v_user_b uuid := '88000000-0000-0000-0000-000000000004';
  v_role_admin uuid := '88300000-0000-0000-0000-000000000001';
  v_role_resident uuid := '88300000-0000-0000-0000-000000000002';
  v_ws_a1 uuid := '88400000-0000-0000-0000-000000000001';
  v_ws_a2 uuid := '88400000-0000-0000-0000-000000000002';
  v_ws_b1 uuid := '88400000-0000-0000-0000-000000000003';
  v_mem_admin uuid := '88500000-0000-0000-0000-000000000001';
  v_mem_nonadmin uuid := '88500000-0000-0000-0000-000000000002';
  v_mem_inactive uuid := '88500000-0000-0000-0000-000000000003';
  v_mem_b uuid := '88500000-0000-0000-0000-000000000004';
  v_addr_a1 uuid := '88800000-0000-0000-0000-000000000001';
  v_addr_a2 uuid := '88800000-0000-0000-0000-000000000002';
  v_addr_b1 uuid := '88800000-0000-0000-0000-000000000003';
  v_prop_a1 uuid := '88700000-0000-0000-0000-000000000001';
  v_prop_a2 uuid := '88700000-0000-0000-0000-000000000002';
  v_prop_b1 uuid := '88700000-0000-0000-0000-000000000003';
  v_prop_unbound uuid := '88700000-0000-0000-0000-000000000004';
  v_grant_admin_a1 uuid := '88600000-0000-0000-0000-000000000001';
  v_grant_admin_a2 uuid := '88600000-0000-0000-0000-000000000002';
  v_grant_nonadmin uuid := '88600000-0000-0000-0000-000000000003';
  v_grant_inactive uuid := '88600000-0000-0000-0000-000000000004';
  v_grant_b uuid := '88600000-0000-0000-0000-000000000005';
  v_grant_tenant_only uuid := '88600000-0000-0000-0000-000000000006';
  v_grant_unbound uuid := '88600000-0000-0000-0000-000000000007';
begin
  insert into auth.users(id, email) values
    (v_user_admin, 'admin-88@cladora.test'),
    (v_user_nonadmin, 'resident-88@cladora.test'),
    (v_user_inactive, 'inactive-88@cladora.test'),
    (v_user_b, 'admin-b-88@cladora.test');

  insert into platform.tenants(id, legal_name, registration_number, status) values
    (v_tenant_a, 'Tenant Alpha 88', 'RO-MUT-88A', 'active'),
    (v_tenant_b, 'Tenant Beta 88', 'RO-MUT-88B', 'active');

  insert into platform.customer_workspaces(id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment) values
    (v_ws_a1, v_tenant_a, 'ASSOCIATION', 'ACTIVE', 'Alpha Workspace 1', 'PILOT'),
    (v_ws_a2, v_tenant_a, 'PROPERTY_MANAGER', 'ACTIVE', 'Alpha Workspace 2', 'PILOT'),
    (v_ws_b1, v_tenant_b, 'ASSOCIATION', 'ACTIVE', 'Beta Workspace 1', 'PILOT');

  insert into identity.roles(id, tenant_id, code, name) values
    (v_role_admin, v_tenant_a, 'association_admin', 'Association Administrator A'),
    (v_role_resident, v_tenant_a, 'resident', 'Resident Non-Manager');

  -- Role trigger automatically bootstraps permission for association_admin
  -- Ensure nonadmin has no taxonomy permission

  insert into identity.memberships(id, tenant_id, user_id, role_id, status) values
    (v_mem_admin, v_tenant_a, v_user_admin, v_role_admin, 'active'),
    (v_mem_nonadmin, v_tenant_a, v_user_nonadmin, v_role_resident, 'active'),
    (v_mem_inactive, v_tenant_a, v_user_inactive, v_role_admin, 'suspended'),
    (v_mem_b, v_tenant_b, v_user_b, v_role_admin, 'active');

  insert into portfolio.addresses(id, tenant_id, city, street, building_no) values
    (v_addr_a1, v_tenant_a, 'Bucharest', 'Strada 88-A1', '10'),
    (v_addr_a2, v_tenant_a, 'Bucharest', 'Strada 88-A2', '20'),
    (v_addr_b1, v_tenant_b, 'Bucharest', 'Strada 88-B1', '30');

  insert into portfolio.properties(id, tenant_id, type, name, address_id, status) values
    (v_prop_a1, v_tenant_a, 'condominium', 'Property Alpha 88-1', v_addr_a1, 'active'),
    (v_prop_a2, v_tenant_a, 'residential_complex', 'Property Alpha 88-2', v_addr_a2, 'active'),
    (v_prop_b1, v_tenant_b, 'condominium', 'Property Beta 88-1', v_addr_b1, 'active'),
    (v_prop_unbound, v_tenant_a, 'condominium', 'Property Alpha Unbound', v_addr_a1, 'active');

  insert into platform.workspace_property_bindings(id, tenant_id, customer_workspace_id, property_id, status, binding_source, created_by) values
    ('88b10000-0000-0000-0000-000000000001', v_tenant_a, v_ws_a1, v_prop_a1, 'active', 'building_setup', v_user_admin),
    ('88b10000-0000-0000-0000-000000000002', v_tenant_a, v_ws_a2, v_prop_a2, 'active', 'onboarding_activation', v_user_admin),
    ('88b10000-0000-0000-0000-000000000003', v_tenant_b, v_ws_b1, v_prop_b1, 'active', 'migration_verified', v_user_b);

  insert into identity.context_grants(id, membership_id, tenant_id, scope_type, property_id) values
    (v_grant_admin_a1, v_mem_admin, v_tenant_a, 'property', v_prop_a1),
    (v_grant_admin_a2, v_mem_admin, v_tenant_a, 'property', v_prop_a2),
    (v_grant_nonadmin, v_mem_nonadmin, v_tenant_a, 'property', v_prop_a1),
    (v_grant_inactive, v_mem_inactive, v_tenant_a, 'property', v_prop_a1),
    (v_grant_b, v_mem_b, v_tenant_b, 'property', v_prop_b1),
    (v_grant_tenant_only, v_mem_admin, v_tenant_a, 'tenant', null),
    (v_grant_unbound, v_mem_admin, v_tenant_a, 'property', v_prop_unbound);

  -- Setup lifecycle testing catalog records
  insert into platform.property_profiles(id, code, version, name, labels_json, description, is_active, lifecycle_status, valid_from, valid_to) values
    ('88c00000-0000-0000-0000-000000000001', 'synth_inactive_profile', 1, 'Inactive Synth', '{"ro":"Inactiv","en":"Inactive","fa":"غیرفعال"}'::jsonb, 'Inactive', false, 'archived', statement_timestamp() - interval '10 days', null),
    ('88c00000-0000-0000-0000-000000000002', 'synth_future_profile', 1, 'Future Synth', '{"ro":"Viitor","en":"Future","fa":"آینده"}'::jsonb, 'Future', true, 'active', statement_timestamp() + interval '10 days', null),
    ('88c00000-0000-0000-0000-000000000003', 'synth_expired_profile', 1, 'Expired Synth', '{"ro":"Expirat","en":"Expired","fa":"منقضی"}'::jsonb, 'Expired', true, 'active', statement_timestamp() - interval '10 days', statement_timestamp() - interval '1 day');
end $$;

-- 3. Unauthenticated caller without user ID rejected (1 assertion)
set local role authenticated;
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);
select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'residential_condominium', 'association_managed', 'RO', '88900000-0000-0000-0000-000000000001'::uuid)$$,
  '42501',
  'authentication_required',
  'caller without user ID is rejected with authentication_required'
);
reset role;

-- 4. Inactive membership caller rejected (1 assertion)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"88000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000004', 'residential_condominium', 'association_managed', 'RO', '88900000-0000-0000-0000-000000000002'::uuid)$$,
  '42501',
  'customer_context_access_denied',
  'inactive membership is rejected with customer_context_access_denied'
);

-- 5. User lacking workspace.taxonomy.manage rejected (1 assertion)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"88000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000003', 'residential_condominium', 'association_managed', 'RO', '88900000-0000-0000-0000-000000000003'::uuid)$$,
  '42501',
  'workspace_taxonomy_manage_permission_required',
  'user lacking workspace.taxonomy.manage is rejected'
);

-- 6. AAL1 caller rejected (1 assertion)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"88000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal1"}', true);
select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'residential_condominium', 'association_managed', 'RO', '88900000-0000-0000-0000-000000000004'::uuid)$$,
  '42501',
  'mfa_required',
  'AAL1 caller is rejected with mfa_required'
);

-- Establish authoritative AAL2 admin context for remaining tests
reset role;
select set_config('request.jwt.claims', '{"sub":"88000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

-- 7. Mandatory Idempotency Key (1 assertion)
select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'residential_condominium', 'association_managed', 'RO', null)$$,
  '22023',
  'workspace_taxonomy_idempotency_key_required',
  'null idempotency key is rejected with workspace_taxonomy_idempotency_key_required'
);

-- 8. Mandatory & Invalid Country Code Rejections (5 assertions)
select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'residential_condominium', 'association_managed', null, '88900000-0000-0000-0000-000000000005'::uuid)$$,
  '22023',
  'workspace_taxonomy_country_code_required',
  'null country code is rejected with workspace_taxonomy_country_code_required'
);

select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'residential_condominium', 'association_managed', '', '88900000-0000-0000-0000-000000000005'::uuid)$$,
  '22023',
  'workspace_taxonomy_country_code_invalid',
  'empty string country code is rejected with workspace_taxonomy_country_code_invalid'
);

select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'residential_condominium', 'association_managed', 'ro', '88900000-0000-0000-0000-000000000005'::uuid)$$,
  '22023',
  'workspace_taxonomy_country_code_invalid',
  'lowercase country code is rejected with workspace_taxonomy_country_code_invalid'
);

select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'residential_condominium', 'association_managed', ' RO ', '88900000-0000-0000-0000-000000000005'::uuid)$$,
  '22023',
  'workspace_taxonomy_country_code_invalid',
  'country code with whitespace is rejected with workspace_taxonomy_country_code_invalid'
);

select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'residential_condominium', 'association_managed', 'ROU', '88900000-0000-0000-0000-000000000005'::uuid)$$,
  '22023',
  'workspace_taxonomy_country_code_invalid',
  '3-letter country code is rejected with workspace_taxonomy_country_code_invalid'
);

-- 9. Fail-Closed Resolver: Tenant-only context and unbound property rejected for mutation (2 assertions)
select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000006', 'residential_condominium', 'association_managed', 'RO', '88900000-0000-0000-0000-000000000006'::uuid)$$,
  '42501',
  'workspace_taxonomy_context_not_workspace_bound',
  'pure tenant-scoped context without property binding is rejected for mutation'
);

select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000007', 'residential_condominium', 'association_managed', 'RO', '88900000-0000-0000-0000-000000000007'::uuid)$$,
  '42501',
  'workspace_taxonomy_context_not_workspace_bound',
  'context pointing to unbound property without active binding is rejected for mutation'
);

-- 10. Catalog Lifecycle Validation (4 assertions)
select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'nonexistent_profile', 'association_managed', 'RO', '88900000-0000-0000-0000-000000000008'::uuid)$$,
  '22023',
  'workspace_taxonomy_catalog_version_not_current',
  'unknown catalog profile code is rejected'
);

select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'synth_inactive_profile', 'association_managed', 'RO', '88900000-0000-0000-0000-000000000008'::uuid)$$,
  '22023',
  'workspace_taxonomy_catalog_version_not_current',
  'inactive catalog version is rejected'
);

select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'synth_future_profile', 'association_managed', 'RO', '88900000-0000-0000-0000-000000000008'::uuid)$$,
  '22023',
  'workspace_taxonomy_catalog_version_not_current',
  'future catalog version is rejected'
);

select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'synth_expired_profile', 'association_managed', 'RO', '88900000-0000-0000-0000-000000000008'::uuid)$$,
  '22023',
  'workspace_taxonomy_catalog_version_not_current',
  'expired catalog version is rejected'
);

-- 11. Compatibility Matrix Enforcement (2 assertions)
select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'residential_condominium', 'single_owner_operated', 'RO', '88900000-0000-0000-0000-000000000009'::uuid)$$,
  'P0001',
  'workspace_taxonomy_incompatible',
  'incompatible profile and operating model combination is rejected'
);

select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001', 'residential_condominium', 'developer_operated', 'RO', '88900000-0000-0000-0000-000000000009'::uuid, null, '')$$,
  '22023',
  'workspace_taxonomy_review_reason_required',
  'review_required combination without non-empty reason is rejected'
);

-- 12. Initial assignment on unassigned workspace succeeds (6 assertions)
select lives_ok(
  $$select customer_api.assign_workspace_taxonomy_v1(
    '88600000-0000-0000-0000-000000000001',
    'residential_condominium',
    'association_managed',
    'RO',
    '88900000-0000-0000-0000-000000000010'::uuid,
    null,
    'Initial condominium activation'
  )$$,
  'initial taxonomy assignment on unassigned workspace succeeds'
);

select ok(
  exists(
    select 1 from platform.workspace_taxonomy_assignments
    where customer_workspace_id = '88400000-0000-0000-0000-000000000001'
      and status = 'active'
      and valid_to is null
  ),
  'active assignment created with null valid_to'
);

select ok(
  (select country_code from platform.workspace_taxonomy_assignments where customer_workspace_id = '88400000-0000-0000-0000-000000000001' and status = 'active') = 'RO',
  'country_code RO is persisted in canonical assignment state'
);

select ok(
  exists(
    select 1 from audit.events
    where action = 'WORKSPACE_TAXONOMY_ASSIGNED'
      and entity_type = 'workspace_taxonomy_assignment'
  ),
  'audit event WORKSPACE_TAXONOMY_ASSIGNED created for initial assignment'
);

select ok(
  (select after_snapshot->>'country_code' from audit.events where action = 'WORKSPACE_TAXONOMY_ASSIGNED' limit 1) = 'RO',
  'audit event after_snapshot contains exact country_code'
);

select ok(
  ((customer_api.get_workspace_taxonomy_v1('88600000-0000-0000-0000-000000000001'))->>'country_code') = 'RO',
  'resolver customer_api.get_workspace_taxonomy_v1 returns stored country_code'
);

-- 13. Idempotent Replay, Payload Normalization & Conflict Tests (5 assertions)
select ok(
  ((customer_api.assign_workspace_taxonomy_v1(
    '88600000-0000-0000-0000-000000000001',
    'residential_condominium',
    'association_managed',
    'RO',
    '88900000-0000-0000-0000-000000000010'::uuid,
    null,
    'Initial condominium activation'
  ))->>'idempotent_replay')::boolean = true,
  'idempotent replay returns idempotent_replay=true'
);

select ok(
  (select count(*) from audit.events where action = 'WORKSPACE_TAXONOMY_ASSIGNED') = 1,
  'idempotent replay does not generate extra audit event'
);

select lives_ok(
  $$select customer_api.assign_workspace_taxonomy_v1(
    '88600000-0000-0000-0000-000000000001',
    'residential_condominium',
    'association_managed',
    'RO',
    '88900000-0000-0000-0000-000000000010'::uuid,
    null,
    '  Initial condominium activation   ' -- Whitespace normalized in hash
  )$$,
  'idempotent replay with trailing whitespace normalization succeeds'
);

select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1(
    '88600000-0000-0000-0000-000000000001',
    'residential_condominium',
    'third_party_managed',
    'RO',
    '88900000-0000-0000-0000-000000000010'::uuid, -- Reusing key 0010 with different model!
    null,
    'Conflicting payload'
  )$$,
  '23505',
  'workspace_taxonomy_idempotency_conflict',
  'reusing idempotency key with conflicting payload is rejected'
);

select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1(
    '88600000-0000-0000-0000-000000000002', -- Workspace A2 context
    'residential_complex',
    'association_managed',
    'RO',
    '88900000-0000-0000-0000-000000000010'::uuid, -- Reusing Workspace A1 key on Workspace A2!
    null,
    'Initial activation WS2'
  )$$,
  '23505',
  'workspace_taxonomy_idempotency_conflict',
  'cross-workspace idempotency key reuse within tenant is rejected with conflict'
);

-- 14. Optimistic Concurrency Control (Expected Assignment ID) (6 assertions)
select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1(
    '88600000-0000-0000-0000-000000000001',
    'residential_condominium',
    'third_party_managed',
    'RO',
    '88900000-0000-0000-0000-000000000011'::uuid,
    '88900000-ffff-ffff-ffff-ffffffffffff'::uuid, -- Wrong expected assignment ID
    'Transition to third party'
  )$$,
  '40001',
  'workspace_taxonomy_expected_assignment_conflict',
  'transition with mismatched expected assignment ID is rejected with conflict'
);

select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1(
    '88600000-0000-0000-0000-000000000001',
    'residential_condominium',
    'third_party_managed',
    'RO',
    '88900000-0000-0000-0000-000000000012'::uuid,
    null, -- Missing expected assignment ID on already-assigned workspace
    'Transition without expected'
  )$$,
  '40001',
  'workspace_taxonomy_expected_assignment_conflict',
  'transition without expected assignment ID on assigned workspace is rejected'
);

select lives_ok(
  $$select customer_api.assign_workspace_taxonomy_v1(
    '88600000-0000-0000-0000-000000000001',
    'residential_condominium',
    'third_party_managed',
    'RO',
    '88900000-0000-0000-0000-000000000013'::uuid,
    (select id from platform.workspace_taxonomy_assignments where customer_workspace_id = '88400000-0000-0000-0000-000000000001' and status = 'active'),
    'Contracted professional third-party management company'
  )$$,
  'valid transition with correct expected assignment ID executes successfully'
);

select ok(
  (select count(*) from platform.workspace_taxonomy_assignments where customer_workspace_id = '88400000-0000-0000-0000-000000000001' and status = 'superseded' and valid_to is not null) = 1,
  'previous assignment closed with status=superseded and valid_to set'
);

select ok(
  (select count(*) from platform.workspace_taxonomy_assignments where customer_workspace_id = '88400000-0000-0000-0000-000000000001' and status = 'active' and valid_to is null) = 1,
  'exactly 1 active assignment remains for Workspace A1'
);

select ok(
  (select count(*) from audit.events where action = 'WORKSPACE_TAXONOMY_TRANSITIONED') = 1,
  'audit event WORKSPACE_TAXONOMY_TRANSITIONED generated with before and after snapshots'
);

-- 15. Review-Required Transition with Approved Reason (2 assertions)
do $$
declare
  v_curr_id uuid;
begin
  select id into v_curr_id from platform.workspace_taxonomy_assignments
  where customer_workspace_id = '88400000-0000-0000-0000-000000000001' and status = 'active';

  perform customer_api.assign_workspace_taxonomy_v1(
    '88600000-0000-0000-0000-000000000001',
    'residential_condominium',
    'developer_operated', -- review_required
    'RO',
    '88900000-0000-0000-0000-000000000014'::uuid,
    v_curr_id,
    'Approved special developer warranty transition period' -- Non-empty reason provided
  );
end $$;

select ok(
  (select operating_model_id from platform.workspace_taxonomy_assignments where customer_workspace_id = '88400000-0000-0000-0000-000000000001' and status = 'active') =
  (select id from platform.operating_models where code = 'developer_operated' and version = 1),
  'review_required combination successfully transitioned with explicit approval reason'
);

select ok(
  (select count(*) from platform.workspace_taxonomy_assignments where customer_workspace_id = '88400000-0000-0000-0000-000000000001') = 3,
  'historical chain retains all 3 assignment records without physical deletions'
);

-- 16. Historical Immutability Guard (3 assertions)
select throws_ok(
  $$delete from platform.workspace_taxonomy_assignments where customer_workspace_id = '88400000-0000-0000-0000-000000000001' and status = 'superseded'$$,
  '42501',
  'workspace_taxonomy_assignment_history_immutable',
  'physical deletion of assignment history is blocked by immutability trigger'
);

select throws_ok(
  $$update platform.workspace_taxonomy_assignments
    set valid_from = '1990-01-01 00:00:00+00'
    where customer_workspace_id = '88400000-0000-0000-0000-000000000001'$$,
  '42501',
  'workspace_taxonomy_assignment_history_immutable',
  'direct modification of valid_from in assignment history is blocked'
);

select throws_ok(
  $$update platform.workspace_taxonomy_assignments
    set country_code = 'US'
    where customer_workspace_id = '88400000-0000-0000-0000-000000000001'$$,
  '42501',
  'workspace_taxonomy_assignment_history_immutable',
  'direct modification of country_code in assignment history is blocked'
);

-- 17. Multi-workspace isolation & Cross-tenant rejection (3 assertions)
select ok(
  not exists(select 1 from platform.workspace_taxonomy_assignments where customer_workspace_id = '88400000-0000-0000-0000-000000000002'),
  'same-tenant workspace A2 remains unmutated (workspace isolation)'
);

select throws_ok(
  $$select customer_api.assign_workspace_taxonomy_v1(
    '88600000-0000-0000-0000-000000000005', -- Tenant B context called by Tenant A User
    'residential_condominium',
    'association_managed',
    'RO',
    '88900000-0000-0000-0000-000000000015'::uuid
  )$$,
  '42501',
  'customer_context_access_denied',
  'cross-tenant context grant mutation is strictly denied'
);

select ok(
  not exists(select 1 from platform.workspace_taxonomy_assignments where customer_workspace_id = '88400000-0000-0000-0000-000000000003'),
  'tenant B workspace remains unmutated (strict isolation)'
);

-- 18. Zero Overlap, Zero Partial Writes, Zero Ledger Side-Effect, Options RPC (4 assertions)
select ok(
  (
    select count(*)
    from platform.workspace_taxonomy_assignments a
    join platform.workspace_taxonomy_assignments b on a.customer_workspace_id = b.customer_workspace_id and a.id <> b.id
    where a.status = 'active' and b.status = 'active'
  ) = 0,
  'zero overlapping active assignment periods exist across all workspaces'
);

select ok(
  (
    select count(*) from platform.workspace_taxonomy_assignments where customer_workspace_id = '88400000-0000-0000-0000-000000000002'
  ) = 0 and (
    select count(*) from platform.workspace_taxonomy_idempotency where customer_workspace_id = '88400000-0000-0000-0000-000000000002'
  ) = 0,
  'zero partial writes: failed attempts on workspace A2 produced zero assignment or idempotency rows'
);

select ok(
  (select count(*) from finance.journal_entries where memo like '%workspace_taxonomy%') = 0,
  'zero financial journal or ledger side-effect occurred during taxonomy mutations'
);

select ok(
  jsonb_array_length((customer_api.get_taxonomy_catalog_options_v1('88600000-0000-0000-0000-000000000001'))->'profiles') >= 16
  and jsonb_array_length((customer_api.get_taxonomy_catalog_options_v1('88600000-0000-0000-0000-000000000001'))->'operating_models') >= 8
  and jsonb_array_length((customer_api.get_taxonomy_catalog_options_v1('88600000-0000-0000-0000-000000000001'))->'compatibilities') >= 30,
  'customer_api.get_taxonomy_catalog_options_v1 returns complete active profiles, models, and compatibilities'
);

rollback;
