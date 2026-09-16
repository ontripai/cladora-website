-- =============================================================================
-- Test 087: Universal Workspace Taxonomy & Compatibility Matrix Acceptance R4
-- =============================================================================
begin;
select plan(55);

-- 1. Schema & Table Structural Verification (7 assertions)
select ok(to_regclass('platform.property_profiles') is not null, 'platform.property_profiles table exists');
select ok(to_regclass('platform.operating_models') is not null, 'platform.operating_models table exists');
select ok(to_regclass('platform.space_kinds') is not null, 'platform.space_kinds table exists');
select ok(to_regclass('platform.property_operating_model_compatibilities') is not null, 'platform.property_operating_model_compatibilities table exists');
select ok(to_regclass('platform.property_space_kind_compatibilities') is not null, 'platform.property_space_kind_compatibilities table exists');
select ok(to_regclass('platform.workspace_taxonomy_assignments') is not null, 'platform.workspace_taxonomy_assignments table exists');
select ok(to_regclass('platform.workspace_property_bindings') is not null, 'platform.workspace_property_bindings table exists');

-- 2. Seed Population Verification (6 assertions)
select ok((select count(*) = 16 from platform.property_profiles where is_active = true and lifecycle_status = 'active'), 'all 16 canonical property profiles are seeded');
select ok((select count(*) = 8 from platform.operating_models where is_active = true and lifecycle_status = 'active'), 'all 8 canonical operating models are seeded');
select ok((select count(*) = 21 from platform.space_kinds where is_active = true and lifecycle_status = 'active'), 'all 21 canonical space kinds are seeded');
select ok(exists(select 1 from platform.space_kinds where code = 'yard' and is_active = true), 'space kind yard exists');
select ok(exists(select 1 from platform.space_kinds where code = 'loading_zone' and is_active = true), 'space kind loading_zone exists');
select ok(exists(select 1 from platform.space_kinds where code = 'land_parcel' and is_active = true), 'space kind land_parcel exists');

-- 3. Validation Constraints Runtime Verifications (3 assertions)
-- 3a. Invalid code pattern rejected
select throws_ok(
  $$insert into platform.property_profiles(code, version, name, labels_json) values('INVALID-CODE!', 1, 'Invalid Code', '{"ro":"x","en":"y","fa":"z"}');$$,
  '23514',
  null,
  'invalid profile code pattern is rejected by check constraint'
);

-- 3b. Missing localized label key rejected
select throws_ok(
  $$insert into platform.property_profiles(code, version, name, labels_json) values('valid_code_missing_fa', 1, 'Missing FA', '{"ro":"x","en":"y"}');$$,
  '23514',
  null,
  'missing fa label key in labels_json is rejected by check constraint'
);

-- 3c. Duplicate (code, version) in property profiles is rejected
select throws_ok(
  $$insert into platform.property_profiles(code, version, name, labels_json, is_active) values('residential_condominium', 1, 'Duplicate Condo', '{"ro":"x","en":"y","fa":"z"}', false);$$,
  '23505',
  null,
  'duplicate (code, version) in property profiles is rejected'
);

-- 4. Version Effective-Period Overlap Prevention (5 assertions)
-- 4a. Overlapping active version of profile rejected
select throws_ok(
  $$insert into platform.property_profiles(code, version, name, labels_json, valid_from)
    values('residential_condominium', 2, 'Condo V2 Overlapping', '{"ro":"x","en":"y","fa":"z"}', statement_timestamp());$$,
  'P0001',
  'workspace_taxonomy_version_effective_period_overlap',
  'overlapping active version of profile is rejected'
);

-- 4b. Overlapping active version of operating model rejected
select throws_ok(
  $$insert into platform.operating_models(code, version, name, labels_json, valid_from)
    values('association_managed', 2, 'Association V2 Overlapping', '{"ro":"x","en":"y","fa":"z"}', statement_timestamp());$$,
  'P0001',
  'workspace_taxonomy_version_effective_period_overlap',
  'overlapping active version of operating model is rejected'
);

-- 4c. Overlapping active version of space kind rejected
select throws_ok(
  $$insert into platform.space_kinds(code, version, name, labels_json, valid_from)
    values('residential_unit', 2, 'Residential Unit V2 Overlapping', '{"ro":"x","en":"y","fa":"z"}', statement_timestamp());$$,
  'P0001',
  'workspace_taxonomy_version_effective_period_overlap',
  'overlapping active version of space kind is rejected'
);

-- 4d. Expired historical non-overlapping version can be inserted
select lives_ok(
  $$insert into platform.property_profiles(code, version, name, labels_json, valid_from, valid_to)
    values('versioned_sample_profile', 1, 'Sample V1 Expired', '{"ro":"x","en":"y","fa":"z"}', '2000-01-01 00:00:00+00', '2005-01-01 00:00:00+00');$$,
  'expired non-overlapping version of property profile is permitted'
);

-- 4e. Future non-overlapping version can be inserted
select lives_ok(
  $$insert into platform.property_profiles(code, version, name, labels_json, valid_from)
    values('versioned_sample_profile', 2, 'Sample V2 Future', '{"ro":"x","en":"y","fa":"z"}', '2099-01-01 00:00:00+00');$$,
  'future non-overlapping version of property profile is permitted'
);

-- 5. Set up synthetic test fixtures inside transaction
do $$
declare
  v_tenant_a uuid := '87100000-0000-0000-0000-000000000001';
  v_tenant_b uuid := '87100000-0000-0000-0000-000000000002';
  v_user_a uuid := '87000000-0000-0000-0000-000000000001';
  v_user_b uuid := '87000000-0000-0000-0000-000000000002';
  v_role_a uuid := '87300000-0000-0000-0000-000000000001';
  v_role_b uuid := '87300000-0000-0000-0000-000000000002';
  v_ws_a1 uuid := '87400000-0000-0000-0000-000000000001';
  v_ws_a2 uuid := '87400000-0000-0000-0000-000000000002';
  v_ws_b1 uuid := '87400000-0000-0000-0000-000000000003';
  v_mem_a uuid := '87500000-0000-0000-0000-000000000001';
  v_mem_b uuid := '87500000-0000-0000-0000-000000000002';
  v_prop_a1 uuid := '87700000-0000-0000-0000-000000000001';
  v_prop_a2 uuid := '87700000-0000-0000-0000-000000000002';
  v_prop_a3 uuid := '87700000-0000-0000-0000-000000000003';
  v_prop_b1 uuid := '87700000-0000-0000-0000-000000000004';
  v_addr_a1 uuid := '87800000-0000-0000-0000-000000000001';
  v_addr_a2 uuid := '87800000-0000-0000-0000-000000000002';
  v_addr_a3 uuid := '87800000-0000-0000-0000-000000000003';
  v_addr_b1 uuid := '87800000-0000-0000-0000-000000000004';
  v_grant_a1 uuid := '87600000-0000-0000-0000-000000000001';
  v_grant_a2 uuid := '87600000-0000-0000-0000-000000000002';
  v_grant_a3 uuid := '87600000-0000-0000-0000-000000000003';
  v_grant_a_ambig uuid := '87600000-0000-0000-0000-000000000004';
  v_grant_b1 uuid := '87600000-0000-0000-0000-000000000005';
begin
  insert into auth.users(id, email) values
    (v_user_a, 'admin-tenant-a@cladora.test'),
    (v_user_b, 'admin-tenant-b@cladora.test');

  insert into platform.tenants(id, legal_name, registration_number, status) values
    (v_tenant_a, 'Tenant Alpha Multi-Workspace', 'RO-TAX-87A', 'active'),
    (v_tenant_b, 'Tenant Beta Single', 'RO-TAX-87B', 'active');

  insert into platform.customer_workspaces(id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment) values
    (v_ws_a1, v_tenant_a, 'ASSOCIATION', 'ACTIVE', 'Alpha Condominium 1', 'PILOT'),
    (v_ws_a2, v_tenant_a, 'PROPERTY_MANAGER', 'ACTIVE', 'Alpha Retail Complex 2', 'PILOT'),
    (v_ws_b1, v_tenant_b, 'ASSOCIATION', 'ACTIVE', 'Beta Standalone', 'PILOT');

  insert into identity.roles(id, tenant_id, code, name) values
    (v_role_a, v_tenant_a, 'association_admin', 'Association Administrator A'),
    (v_role_b, v_tenant_b, 'property_manager', 'Property Manager B');

  insert into identity.memberships(id, tenant_id, user_id, role_id, status) values
    (v_mem_a, v_tenant_a, v_user_a, v_role_a, 'active'),
    (v_mem_b, v_tenant_b, v_user_b, v_role_b, 'active');

  insert into portfolio.addresses(id, tenant_id, city, street, building_no) values
    (v_addr_a1, v_tenant_a, 'Bucharest', 'Strada A1', '1'),
    (v_addr_a2, v_tenant_a, 'Bucharest', 'Strada A2', '2'),
    (v_addr_a3, v_tenant_a, 'Bucharest', 'Strada A3', '3'),
    (v_addr_b1, v_tenant_b, 'Bucharest', 'Strada B1', '4');

  insert into portfolio.properties(id, tenant_id, type, name, address_id, status) values
    (v_prop_a1, v_tenant_a, 'condominium', 'Condo Property Alpha 1', v_addr_a1, 'active'),
    (v_prop_a2, v_tenant_a, 'residential_complex', 'Retail Property Alpha 2', v_addr_a2, 'active'),
    (v_prop_a3, v_tenant_a, 'condominium', 'Unbound Property Alpha 3', v_addr_a3, 'active'),
    (v_prop_b1, v_tenant_b, 'condominium', 'Condo Property Beta 1', v_addr_b1, 'active');

  -- Historical import runs: purposely create misleading import runs to prove resolver does NOT use import_runs!
  insert into platform.import_runs(id, customer_workspace_id, tenant_id, property_id, status, idempotency_key, created_by) values
    ('87910000-0000-0000-0000-000000000001', v_ws_a2, v_tenant_a, v_prop_a1, 'activated', 'OLD-MISLEADING-IMP', v_user_a),
    ('87910000-0000-0000-0000-000000000002', v_ws_a1, v_tenant_a, v_prop_a2, 'activated', 'ANOTHER-MISLEADING-IMP', v_user_a);

  -- Canonical Workspace Property Bindings
  insert into platform.workspace_property_bindings(id, tenant_id, customer_workspace_id, property_id, status, binding_source, created_by) values
    ('87b10000-0000-0000-0000-000000000001', v_tenant_a, v_ws_a1, v_prop_a1, 'active', 'building_setup', v_user_a),
    ('87b10000-0000-0000-0000-000000000002', v_tenant_a, v_ws_a2, v_prop_a2, 'active', 'onboarding_activation', v_user_a),
    ('87b10000-0000-0000-0000-000000000003', v_tenant_b, v_ws_b1, v_prop_b1, 'active', 'migration_verified', v_user_b);

  insert into identity.context_grants(id, membership_id, tenant_id, scope_type, property_id) values
    (v_grant_a1, v_mem_a, v_tenant_a, 'property', v_prop_a1),
    (v_grant_a2, v_mem_a, v_tenant_a, 'property', v_prop_a2),
    (v_grant_a3, v_mem_a, v_tenant_a, 'property', v_prop_a3),
    (v_grant_b1, v_mem_b, v_tenant_b, 'property', v_prop_b1);

  -- Ambiguous purely tenant-scoped context grant for Tenant A (which holds 2 distinct customer workspaces)
  insert into identity.context_grants(id, membership_id, tenant_id, scope_type) values
    (v_grant_a_ambig, v_mem_a, v_tenant_a, 'tenant');
end $$;

-- 6. Canonical Workspace Property Binding Invariant & Security Tests (4 assertions)
-- 6a. Cross-tenant binding is rejected
select throws_ok(
  $$insert into platform.workspace_property_bindings(tenant_id, customer_workspace_id, property_id, binding_source)
    values('87100000-0000-0000-0000-000000000001', '87400000-0000-0000-0000-000000000003', '87700000-0000-0000-0000-000000000001', 'building_setup')$$,
  '42501',
  'workspace_taxonomy_workspace_binding_tenant_mismatch',
  'cross-tenant workspace property binding is rejected'
);

-- 6b. Overlapping active binding for same property is rejected
select throws_ok(
  $$insert into platform.workspace_property_bindings(tenant_id, customer_workspace_id, property_id, binding_source)
    values('87100000-0000-0000-0000-000000000001', '87400000-0000-0000-0000-000000000002', '87700000-0000-0000-0000-000000000001', 'platform_assignment')$$,
  'P0001',
  'workspace_property_binding_overlap',
  'overlapping active workspace binding for the same property is rejected'
);

-- 6c. Binding history cannot be deleted
select throws_ok(
  $$delete from platform.workspace_property_bindings where id = '87b10000-0000-0000-0000-000000000001'$$,
  '42501',
  'workspace_property_binding_history_immutable',
  'physical deletion of workspace property binding is blocked'
);

-- 6d. Binding history identity cannot be updated
select throws_ok(
  $$update platform.workspace_property_bindings set customer_workspace_id = '87400000-0000-0000-0000-000000000002' where id = '87b10000-0000-0000-0000-000000000001'$$,
  '42501',
  'workspace_property_binding_history_immutable',
  'mutation of workspace property binding identity is blocked'
);

-- 7. Immutability Guard Verification (1 assertion)
select throws_ok(
  $$delete from platform.property_profiles where code='residential_condominium'$$,
  '42501',
  'workspace_taxonomy_immutable_record',
  'physical deletion of referenced property profile is blocked'
);

-- 8. Compatibility Rule Invariant Checks (3 assertions)
-- 8a. Incompatible Profile + Operating Model is rejected
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

-- 8b. Review-Required combination is blocked without independent approval
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

-- 8c. Fail-Closed default deny for missing compatibility rule
do $$
declare
  v_dummy_profile uuid := '87900000-0000-0000-0000-000000000099';
begin
  insert into platform.property_profiles(id, code, version, name, labels_json)
  values(v_dummy_profile, 'custom_unmapped_profile', 1, 'Custom Profile', '{"ro":"x","en":"y","fa":"z"}');
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

-- Clean up unmapped dummy profile so list_taxonomy_profiles_v1 returns the exact 16 canonical seeds
delete from platform.property_profiles where id = '87900000-0000-0000-0000-000000000099';

-- 8d. Restored Space Kinds Compatibility Verifications (3 assertions)
select ok(
  exists(
    select 1 from platform.property_space_kind_compatibilities c
    join platform.property_profiles p on p.id = c.property_profile_id
    join platform.space_kinds s on s.id = c.space_kind_id
    where p.code = 'warehouse_logistics' and s.code = 'yard' and c.compatibility_level = 'compatible'
  ),
  'yard is compatible with warehouse_logistics'
);

select ok(
  exists(
    select 1 from platform.property_space_kind_compatibilities c
    join platform.property_profiles p on p.id = c.property_profile_id
    join platform.space_kinds s on s.id = c.space_kind_id
    where p.code = 'retail_centre' and s.code = 'loading_zone' and c.compatibility_level = 'compatible'
  ),
  'loading_zone is compatible with retail_centre'
);

select ok(
  exists(
    select 1 from platform.property_space_kind_compatibilities c
    join platform.property_profiles p on p.id = c.property_profile_id
    join platform.space_kinds s on s.id = c.space_kind_id
    where p.code = 'single_villa' and s.code = 'land_parcel' and c.compatibility_level = 'compatible'
  ),
  'land_parcel is compatible with single_villa'
);

-- 9. Tenant Isolation in Assignment (1 assertion)
select throws_ok(
  $$insert into platform.workspace_taxonomy_assignments(tenant_id, customer_workspace_id, property_profile_id, operating_model_id)
    values(
      '87100000-0000-0000-0000-000000000001', -- Tenant A
      '87400000-0000-0000-0000-000000000003', -- Workspace belonging to Tenant B
      (select id from platform.property_profiles where code='residential_condominium' and version=1),
      (select id from platform.operating_models where code='association_managed' and version=1)
    )$$,
  '42501',
  'workspace_taxonomy_tenant_mismatch',
  'cross-tenant workspace assignment is strictly blocked'
);

-- 10. Valid Compatible Assignment Insertion for Workspace A1 and Workspace A2 (2 assertions)
select lives_ok(
  $$insert into platform.workspace_taxonomy_assignments(id, tenant_id, customer_workspace_id, property_profile_id, operating_model_id, status, valid_from, created_by)
    values(
      '87a00000-0000-0000-0000-000000000001',
      '87100000-0000-0000-0000-000000000001',
      '87400000-0000-0000-0000-000000000001',
      (select id from platform.property_profiles where code='residential_condominium' and version=1),
      (select id from platform.operating_models where code='association_managed' and version=1),
      'active',
      '2026-09-01 00:00:00+00',
      '87000000-0000-0000-0000-000000000001'
    )$$,
  'compatible assignment is successfully created for Workspace A1'
);

select lives_ok(
  $$insert into platform.workspace_taxonomy_assignments(id, tenant_id, customer_workspace_id, property_profile_id, operating_model_id, status, valid_from, created_by)
    values(
      '87a00000-0000-0000-0000-000000000002',
      '87100000-0000-0000-0000-000000000001',
      '87400000-0000-0000-0000-000000000002',
      (select id from platform.property_profiles where code='retail_centre' and version=1),
      (select id from platform.operating_models where code='single_owner_operated' and version=1),
      'active',
      '2026-09-01 00:00:00+00',
      '87000000-0000-0000-0000-000000000001'
    )$$,
  'compatible assignment is successfully created for Workspace A2'
);

-- 11. Historical Assignment Immutability Guard (3 assertions)
select throws_ok(
  $$delete from platform.workspace_taxonomy_assignments where id = '87a00000-0000-0000-0000-000000000001'$$,
  '42501',
  'workspace_taxonomy_assignment_history_immutable',
  'direct deletion of existing workspace assignment is blocked by history immutability trigger'
);

select throws_ok(
  $$update platform.workspace_taxonomy_assignments set property_profile_id = '87900000-0000-0000-0000-000000000099' where id = '87a00000-0000-0000-0000-000000000001'$$,
  '42501',
  'workspace_taxonomy_assignment_history_immutable',
  'direct mutation of existing workspace assignment profile is blocked'
);

select throws_ok(
  $$update platform.workspace_taxonomy_assignments set created_by = '87000000-0000-0000-0000-000000000002' where id = '87a00000-0000-0000-0000-000000000001'$$,
  '42501',
  'workspace_taxonomy_assignment_history_immutable',
  'direct mutation of assignment creator (created_by) is blocked'
);

-- 12. Temporal Overlap Check on Assignments (1 assertion)
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

-- 13. Direct Authenticated Client Access Denied by RLS/Permissions (4 assertions)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"87000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2","active_tenant_id":"87100000-0000-0000-0000-000000000001"}', true);

select throws_ok(
  $$insert into platform.property_profiles(code, version, name, labels_json) values('malicious_profile', 1, 'Hacked', '{"ro":"x","en":"y","fa":"z"}');$$,
  '42501',
  null,
  'direct client insert into platform registry is denied'
);

select throws_ok(
  $$select * from platform.property_profiles limit 1;$$,
  '42501',
  null,
  'direct client select from platform registry is denied'
);

select throws_ok(
  $$select * from platform.workspace_taxonomy_assignments limit 1;$$,
  '42501',
  null,
  'direct client select from workspace taxonomy assignments is denied'
);

select throws_ok(
  $$select * from platform.workspace_property_bindings limit 1;$$,
  '42501',
  null,
  'direct client select from workspace property bindings is denied'
);

-- 14. Customer API Security & Resolution Tests (6 assertions)
-- 14a. Unauthenticated access is rejected
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok(
  $$select customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'unauthenticated call to taxonomy API is rejected'
);

-- Re-establish authenticated context for User A / Tenant A
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"87000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2","active_tenant_id":"87100000-0000-0000-0000-000000000001"}', true);

-- 14b. Cross-tenant context access is denied
select throws_ok(
  $$select customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000005')$$, -- Context B called by User A
  '42501',
  'customer_context_access_denied',
  'cross-tenant context grant access is denied'
);

-- 14c. Ambiguous purely tenant-scoped context in multi-workspace tenant fails closed
select throws_ok(
  $$select customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000004')$$, -- Context A_Ambiguous (no property scope)
  '42501',
  'workspace_taxonomy_context_not_workspace_bound',
  'ambiguous tenant-scoped context in multi-workspace tenant fails closed without guessing'
);

-- 14d. Property-scoped context without binding safely returns binding_required (Property A3 has no binding)
select ok(
  ((customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000003'))->>'has_assignment')::boolean = false
  and ((customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000003'))->>'status') = 'binding_required'
  and (customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000003'))->>'workspace_id' is null,
  'valid property-scoped context without binding safely returns binding_required without leaking workspace ID'
);

-- 14e. Two-workspace same-tenant isolation: Context A1 resolves ONLY Workspace A1 via canonical binding
select ok(
  ((customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000001'))->>'has_assignment')::boolean = true
  and ((customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000001'))->>'workspace_id') = '87400000-0000-0000-0000-000000000001'
  and ((customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000001'))->'profile'->>'code') = 'residential_condominium',
  'Context A1 deterministically resolves Workspace A1 taxonomy via canonical binding'
);

-- 14f. Two-workspace same-tenant isolation: Context A2 resolves ONLY Workspace A2 via canonical binding
select ok(
  ((customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000002'))->>'has_assignment')::boolean = true
  and ((customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000002'))->>'workspace_id') = '87400000-0000-0000-0000-000000000002'
  and ((customer_api.get_workspace_taxonomy_v1('87600000-0000-0000-0000-000000000002'))->'profile'->>'code') = 'retail_centre',
  'Context A2 deterministically resolves Workspace A2 taxonomy via canonical binding'
);

-- 15. List APIs return only currently effective active versions (3 assertions)
select ok(
  jsonb_array_length(customer_api.list_taxonomy_profiles_v1('87600000-0000-0000-0000-000000000001')) = 16,
  'list_taxonomy_profiles_v1 returns exactly 16 current active property profiles (excluding future and expired)'
);

select ok(
  jsonb_array_length(customer_api.list_taxonomy_operating_models_v1('87600000-0000-0000-0000-000000000001')) = 8,
  'list_taxonomy_operating_models_v1 returns exactly 8 current active operating models'
);

select ok(
  jsonb_array_length(customer_api.list_taxonomy_space_kinds_v1('87600000-0000-0000-0000-000000000001')) = 21,
  'list_taxonomy_space_kinds_v1 returns exactly 21 current active space kinds'
);

reset role;

-- 16. Privileged Functions Execution Revoke Verification (2 assertions)
select ok(
  not has_function_privilege('authenticated', 'app_private.guard_taxonomy_version_effective_period_v1()', 'EXECUTE'),
  'authenticated role cannot directly execute guard_taxonomy_version_effective_period_v1'
);

select ok(
  not has_function_privilege('authenticated', 'app_private.guard_workspace_property_binding_v1()', 'EXECUTE'),
  'authenticated role cannot directly execute guard_workspace_property_binding_v1'
);

-- 17. Non-Derivation & Zero Side-Effect Guarantees (1 assertion)
select ok(
  (select count(*) = 0 from finance.journals where tenant_id in ('87100000-0000-0000-0000-000000000001', '87100000-0000-0000-0000-000000000002')),
  'taxonomy classification emits zero financial journals'
);

select * from finish();
rollback;
