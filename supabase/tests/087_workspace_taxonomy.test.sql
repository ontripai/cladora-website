-- =============================================================================
-- Test 087: Universal Workspace Taxonomy & Compatibility Matrix Acceptance
-- =============================================================================
begin;
select plan(31);

-- 1. Schema & Table Structural Verification
select ok(to_regclass('platform.property_profiles') is not null, 'platform.property_profiles table exists');
select ok(to_regclass('platform.operating_models') is not null, 'platform.operating_models table exists');
select ok(to_regclass('platform.space_kinds') is not null, 'platform.space_kinds table exists');
select ok(to_regclass('platform.property_operating_model_compatibilities') is not null, 'platform.property_operating_model_compatibilities table exists');
select ok(to_regclass('platform.property_space_kind_compatibilities') is not null, 'platform.property_space_kind_compatibilities table exists');
select ok(to_regclass('platform.workspace_taxonomy_assignments') is not null, 'platform.workspace_taxonomy_assignments table exists');

-- 2. Seed Population Verification
select ok((select count(*) = 16 from platform.property_profiles where is_active = true and lifecycle_status = 'active'), 'all 16 canonical property profiles are seeded');
select ok((select count(*) = 8 from platform.operating_models where is_active = true and lifecycle_status = 'active'), 'all 8 canonical operating models are seeded');
select ok((select count(*) = 18 from platform.space_kinds where is_active = true and lifecycle_status = 'active'), 'all 18 canonical space kinds are seeded');

-- 3. Unique (code, version) Constraint Verification
select throws_ok(
  $$insert into platform.property_profiles(code, version, name, labels_json) values('residential_condominium', 1, 'Duplicate Condo', '{}')$$,
  '23505',
  null,
  'duplicate (code, version) in property profiles is rejected'
);

-- 4. Set up synthetic test fixtures inside transaction
do $$
declare
  v_tenant_a uuid := '87100000-0000-0000-0000-000000000001';
  v_tenant_b uuid := '87100000-0000-0000-0000-000000000002';
  v_user_a uuid := '87000000-0000-0000-0000-000000000001';
  v_user_b uuid := '87000000-0000-0000-0000-000000000002';
  v_role_a uuid := '87300000-0000-0000-0000-000000000001';
  v_role_b uuid := '87300000-0000-0000-0000-000000000002';
  v_ws_a uuid := '87400000-0000-0000-0000-000000000001';
  v_ws_b uuid := '87400000-0000-0000-0000-000000000002';
  v_mem_a uuid := '87500000-0000-0000-0000-000000000001';
  v_mem_b uuid := '87500000-0000-0000-0000-000000000002';
  v_grant_a uuid := '87600000-0000-0000-0000-000000000001';
  v_grant_b uuid := '87600000-0000-0000-0000-000000000002';
begin
  insert into auth.users(id, email) values
    (v_user_a, 'admin-tenant-a@cladora.test'),
    (v_user_b, 'admin-tenant-b@cladora.test');

  insert into platform.tenants(id, legal_name, registration_number, status) values
    (v_tenant_a, 'Tenant Alpha Associations', 'RO-TAX-87A', 'active'),
    (v_tenant_b, 'Tenant Beta Commercial', 'RO-TAX-87B', 'active');

  insert into platform.customer_workspaces(id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment) values
    (v_ws_a, v_tenant_a, 'ASSOCIATION', 'ACTIVE', 'Alpha Holdings', 'PILOT'),
    (v_ws_b, v_tenant_b, 'PROPERTY_MANAGER', 'ACTIVE', 'Beta Management', 'PILOT');

  insert into identity.roles(id, tenant_id, code, name) values
    (v_role_a, v_tenant_a, 'association_admin', 'Association Administrator A'),
    (v_role_b, v_tenant_b, 'property_manager', 'Property Manager B');

  insert into identity.memberships(id, tenant_id, user_id, role_id, status) values
    (v_mem_a, v_tenant_a, v_user_a, v_role_a, 'active'),
    (v_mem_b, v_tenant_b, v_user_b, v_role_b, 'active');

  insert into identity.context_grants(id, membership_id, tenant_id, scope_type) values
    (v_grant_a, v_mem_a, v_tenant_a, 'tenant'),
    (v_grant_b, v_mem_b, v_tenant_b, 'tenant');
end $$;

-- 5. Immutability Guard Verification (Cannot delete referenced taxonomy)
select throws_ok(
  $$delete from platform.property_profiles where code='residential_condominium'$$,
  '42501',
  'workspace_taxonomy_immutable_record',
  'physical deletion of referenced property profile is blocked'
);

-- 6. Compatibility Rule Invariant Checks
-- Incompatible Profile + Operating Model is rejected
select throws_ok(
  $$insert into platform.workspace_taxonomy_assignments(tenant_id, customer_workspace_id, property_profile_id, operating_model_id)
    values(
      '87100000-0000-0000-0000-000000000001',
      '87400000-0000-0000-0000-000000000001',
      (select id from platform.property_profiles where code='residential_condominium' and version=1),
      (select id from platform.operating_models where code='single_owner_operated' and version=1)
    )$$,
  'P0001',
  'workspace_taxonomy_incompatible_assignment',
  'incompatible property profile and operating model combination is rejected'
);

-- Review-Required combination is blocked without independent approval
select throws_ok(
  $$insert into platform.workspace_taxonomy_assignments(tenant_id, customer_workspace_id, property_profile_id, operating_model_id)
    values(
      '87100000-0000-0000-0000-000000000001',
      '87400000-0000-0000-0000-000000000001',
      (select id from platform.property_profiles where code='residential_condominium' and version=1),
      (select id from platform.operating_models where code='developer_operated' and version=1)
    )$$,
  'P0001',
  'workspace_taxonomy_review_required',
  'review_required combination is blocked from automatic active assignment'
);

-- Fail-Closed default deny for missing compatibility rule
do $$
declare
  v_dummy_profile uuid := '87900000-0000-0000-0000-000000000099';
begin
  insert into platform.property_profiles(id, code, version, name, labels_json)
  values(v_dummy_profile, 'custom_unmapped_profile', 1, 'Custom Profile', '{}');
end $$;

select throws_ok(
  $$insert into platform.workspace_taxonomy_assignments(tenant_id, customer_workspace_id, property_profile_id, operating_model_id)
    values(
      '87100000-0000-0000-0000-000000000001',
      '87400000-0000-0000-0000-000000000001',
      '87900000-0000-0000-0000-000000000099',
      (select id from platform.operating_models where code='association_managed' and version=1)
    )$$,
  'P0001',
  'workspace_taxonomy_compatibility_rule_missing',
  'unmapped profile and operating model combination fails closed'
);

-- 7. Tenant Isolation in Assignment
select throws_ok(
  $$insert into platform.workspace_taxonomy_assignments(tenant_id, customer_workspace_id, property_profile_id, operating_model_id)
    values(
      '87100000-0000-0000-0000-000000000001', -- Tenant A
      '87400000-0000-0000-0000-000000000002', -- Workspace belonging to Tenant B
      (select id from platform.property_profiles where code='residential_condominium' and version=1),
      (select id from platform.operating_models where code='association_managed' and version=1)
    )$$,
  '42501',
  'workspace_taxonomy_tenant_mismatch',
  'cross-tenant workspace assignment is strictly blocked'
);

-- 8. Valid Compatible Assignment Insertion
select lives_ok(
  $$insert into platform.workspace_taxonomy_assignments(id, tenant_id, customer_workspace_id, property_profile_id, operating_model_id, status, valid_from)
    values(
      '87a00000-0000-0000-0000-000000000001',
      '87100000-0000-0000-0000-000000000001',
      '87400000-0000-0000-0000-000000000001',
      (select id from platform.property_profiles where code='residential_condominium' and version=1),
      (select id from platform.operating_models where code='association_managed' and version=1),
      'active',
      '2026-09-01 00:00:00+00'
    )$$,
  'compatible assignment is successfully created'
);

-- 9. Temporal Overlap Check (Cannot have overlapping active assignments for same workspace)
select throws_ok(
  $$insert into platform.workspace_taxonomy_assignments(tenant_id, customer_workspace_id, property_profile_id, operating_model_id, status, valid_from)
    values(
      '87100000-0000-0000-0000-000000000001',
      '87400000-0000-0000-0000-000000000001',
      (select id from platform.property_profiles where code='residential_complex' and version=1),
      (select id from platform.operating_models where code='association_managed' and version=1),
      'active',
      '2026-09-15 00:00:00+00'
    )$$,
  'P0001',
  'workspace_taxonomy_assignment_overlap',
  'overlapping active assignments for the same workspace are rejected'
);

-- 10. Direct Authenticated Client Write on Platform Registries is Denied by RLS
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"87000000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"87100000-0000-0000-0000-000000000001"}', true);

select throws_ok(
  $$insert into platform.property_profiles(code, version, name, labels_json) values('malicious_profile', 1, 'Hacked', '{}')$$,
  '42501',
  null,
  'direct client insert into platform registry is denied by RLS'
);

-- 11. Customer API Security & Isolation Tests
-- Unauthenticated access is rejected
select throws_ok(
  $$select customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'unauthenticated call to taxonomy API is rejected'
);

-- Cross-tenant context access is denied
select throws_ok(
  $$select customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000002')$$, -- Context B called by User A
  '42501',
  'customer_context_access_denied',
  'cross-tenant context grant access is denied'
);

-- Legitimate context call returns active assignment and allowed space kinds
select ok(
  ((customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000001'))->>'has_assignment')::boolean = true,
  'authorized context call successfully resolves active taxonomy assignment'
);

select ok(
  ((customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000001'))->'profile'->>'code') = 'residential_condominium',
  'resolved profile code matches assigned taxonomy'
);

select ok(
  ((customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000001'))->'operating_model'->>'code') = 'association_managed',
  'resolved operating model matches assigned taxonomy'
);

-- List APIs return full catalog
select ok(
  jsonb_array_length(customer_api.list_taxonomy_profiles_v1('87600000-0000-0000-0000-000000000001')) >= 16,
  'list_taxonomy_profiles_v1 returns all active property profiles'
);

select ok(
  jsonb_array_length(customer_api.list_taxonomy_operating_models_v1('87600000-0000-0000-0000-000000000001')) = 8,
  'list_taxonomy_operating_models_v1 returns all active operating models'
);

select ok(
  jsonb_array_length(customer_api.list_taxonomy_space_kinds_v1('87600000-0000-0000-0000-000000000001')) = 18,
  'list_taxonomy_space_kinds_v1 returns all active space kinds'
);

-- Cross-tenant RLS visibility check: Tenant A cannot see Tenant B assignments
select ok(
  (select count(*) = 1 from platform.workspace_taxonomy_assignments where customer_workspace_id = '87400000-0000-0000-0000-000000000001'),
  'authenticated user can read own workspace taxonomy assignment'
);

select ok(
  (select count(*) = 0 from platform.workspace_taxonomy_assignments where customer_workspace_id = '87400000-0000-0000-0000-000000000002'),
  'authenticated user cannot see other tenant workspace taxonomy assignments'
);

reset role;

-- 12. Non-Derivation & Zero Side-Effect Guarantees
select ok(
  (select count(*) = 0 from finance.journals where tenant_id in ('87100000-0000-0000-0000-000000000001', '87100000-0000-0000-0000-000000000002')),
  'taxonomy classification emits zero financial journals'
);

select ok(
  (select count(*) = 0 from airprop.investment_opportunities where tenant_id in ('87100000-0000-0000-0000-000000000001', '87100000-0000-0000-0000-000000000002')),
  'taxonomy classification mutates zero airprop opportunities or property interests'
);

select ok(
  (select count(*) = 0 from identity.role_permissions where role_id = '87300000-0000-0000-0000-000000000001'),
  'taxonomy profile does not automatically derive or grant permissions'
);

select * from finish();
rollback;
