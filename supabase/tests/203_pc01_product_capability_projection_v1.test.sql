begin;
select plan(40);

select has_function(
  'customer_api',
  'get_product_capability_decision_v1',
  array['uuid', 'uuid', 'text'],
  'PC01 projection has the bounded three-argument signature'
);
select is(
  (select count(*)::integer
   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'customer_api'
     and p.proname = 'get_product_capability_decision_v1'),
  1,
  'PC01 projection has no overload'
);
select ok(
  (select p.prosecdef from pg_proc p
   where p.oid = 'customer_api.get_product_capability_decision_v1(uuid,uuid,text)'::regprocedure),
  'PC01 projection is SECURITY DEFINER'
);
select ok(
  (select p.provolatile = 's' from pg_proc p
   where p.oid = 'customer_api.get_product_capability_decision_v1(uuid,uuid,text)'::regprocedure),
  'PC01 projection is STABLE and read-only by contract'
);
select ok(
  not has_function_privilege('anon',
    'customer_api.get_product_capability_decision_v1(uuid,uuid,text)', 'EXECUTE'),
  'anon cannot execute PC01 projection'
);
select ok(
  has_function_privilege('authenticated',
    'customer_api.get_product_capability_decision_v1(uuid,uuid,text)', 'EXECUTE'),
  'authenticated may execute PC01 projection'
);
select ok(
  not has_function_privilege('service_role',
    'customer_api.get_product_capability_decision_v1(uuid,uuid,text)', 'EXECUTE'),
  'service_role cannot directly execute PC01 projection'
);
select ok(
  not has_function_privilege('public',
    'customer_api.get_product_capability_decision_v1(uuid,uuid,text)', 'EXECUTE'),
  'PUBLIC cannot execute PC01 projection'
);
select alike(
  pg_get_functiondef('customer_api.get_product_capability_decision_v1(uuid,uuid,text)'::regprocedure),
  '%resolve_workspace_native_context_v2%',
  'PC01 disclosure is connected to the canonical AUTH01 Workspace resolver'
);
select ok(
  pg_get_functiondef('customer_api.get_product_capability_decision_v1(uuid,uuid,text)'::regprocedure)
    !~ 'check_workspace_native_permission_v2',
  'PC01 does not conflate product availability with action authorization'
);
select ok(
  pg_get_functiondef('customer_api.get_product_capability_decision_v1(uuid,uuid,text)'::regprocedure)
    !~* '\m(insert into|update|delete from)\M',
  'PC01 function contains no product-state mutation'
);
select is(
  obj_description('customer_api.get_product_capability_decision_v1(uuid,uuid,text)'::regprocedure, 'pg_proc'),
  'PC-01 read-only services_catalog capability projection. AUTH-01 bounds disclosure; product availability, activation and action authorization remain separate.',
  'PC01 database contract states its narrow non-authoritative boundary'
);

insert into auth.users(id, email) values
  ('c1010000-0000-4000-8000-000000000001', 'pc01-user@cladora.test');
insert into platform.tenants(id, legal_name, registration_number, status) values
  ('c1010000-0000-4000-8000-000000000002', 'PC01 tenant', 'PC01-LOCAL', 'active');
insert into platform.customer_workspaces(
  id, tenant_id, workspace_type, commercial_owner, lifecycle_status
) values (
  'c1010000-0000-4000-8000-000000000003',
  'c1010000-0000-4000-8000-000000000002',
  'ASSOCIATION', 'PC01 local operator', 'ACTIVE'
);
insert into identity.memberships(id, tenant_id, user_id, role_id, status, starts_at)
select
  'c1010000-0000-4000-8000-000000000004',
  'c1010000-0000-4000-8000-000000000002',
  'c1010000-0000-4000-8000-000000000001',
  r.id,
  'active',
  statement_timestamp() - interval '1 day'
from identity.roles r
where r.code = 'association_admin'
  and r.tenant_id is null
  and r.is_system;
insert into identity.context_grants(id, tenant_id, membership_id, scope_type, starts_at)
values (
  'c1010000-0000-4000-8000-000000000005',
  'c1010000-0000-4000-8000-000000000002',
  'c1010000-0000-4000-8000-000000000004',
  'tenant',
  statement_timestamp() - interval '1 day'
);
insert into platform.workspace_roles(
  id, tenant_id, customer_workspace_id, code, name, scope_ceiling,
  lifecycle_status, created_by, valid_from
) values (
  'c1010000-0000-4000-8000-000000000006',
  'c1010000-0000-4000-8000-000000000002',
  'c1010000-0000-4000-8000-000000000003',
  'pc01_reader', 'PC01 reader', 'workspace', 'published',
  'c1010000-0000-4000-8000-000000000001',
  statement_timestamp() - interval '1 day'
);
insert into platform.workspace_member_roles(
  tenant_id, customer_workspace_id, membership_id, workspace_role_id,
  scope_type, assigned_by_user_id, assigned_by_membership_id, reason, valid_from
) values (
  'c1010000-0000-4000-8000-000000000002',
  'c1010000-0000-4000-8000-000000000003',
  'c1010000-0000-4000-8000-000000000004',
  'c1010000-0000-4000-8000-000000000006',
  'workspace',
  'c1010000-0000-4000-8000-000000000001',
  'c1010000-0000-4000-8000-000000000004',
  'PC01 local assignment',
  statement_timestamp() - interval '1 hour'
);
insert into platform.workspace_modules(
  id, tenant_id, customer_workspace_id, module_definition_id, module_code,
  status, valid_from, activated_at, activated_by, reason
)
select
  'c1010000-0000-4000-8000-000000000007',
  'c1010000-0000-4000-8000-000000000002',
  'c1010000-0000-4000-8000-000000000003',
  m.id,
  m.code,
  'active',
  statement_timestamp() - interval '1 day',
  statement_timestamp() - interval '1 day',
  'c1010000-0000-4000-8000-000000000001',
  'PC01 local active fixture'
from platform.module_definitions m
where m.code = 'services_catalog' and m.version = 1;
insert into platform.workspace_entitlements(
  id, customer_workspace_id, entitlement_key, value_type, boolean_value,
  valid_from, updated_at
) values (
  'c1010000-0000-4000-8000-000000000008',
  'c1010000-0000-4000-8000-000000000003',
  'module.services_catalog',
  'boolean',
  true,
  statement_timestamp() - interval '1 day',
  '2026-01-01T00:00:00Z'
);

select throws_ok(
  $$select customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005',
    'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog'
  )$$,
  '42501',
  'pc01_product_capability_access_denied',
  'unauthenticated PC01 caller is denied'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"c1010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select throws_ok(
  $$select customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005',
    'c1010000-0000-4000-8000-000000000003',
    'module.some_future_capability'
  )$$,
  '22023',
  'pc01_product_capability_input_invalid',
  'PC01 rejects capabilities outside the accepted vertical slice'
);

select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'contract_version',
  'product-capability-decision.v1',
  'PC01 emits the pinned decision contract'
);
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'product_availability',
  'available',
  'current boolean true right is available'
);
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->'right'->>'evaluation_result',
  'effective',
  'boolean true right is effective'
);
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->'right'->'provenance'->>'kind',
  'legacy_unprovenanced',
  'null contract_id remains explicitly legacy-unprovenanced'
);
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->'activation'->>'status',
  'active',
  'current Service Catalog installation is projected separately as active'
);
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'action_authorization',
  'not_evaluated',
  'PC01 never turns product state into action authority'
);
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'capability_key',
  'module.services_catalog',
  'PC01 returns the exact accepted capability key'
);

update platform.workspace_entitlements
set boolean_value = false
where id = 'c1010000-0000-4000-8000-000000000008';
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'product_availability',
  'unavailable',
  'boolean false right is unavailable'
);

update platform.workspace_entitlements
set value_type = 'numeric', boolean_value = null, numeric_value = 3
where id = 'c1010000-0000-4000-8000-000000000008';
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'product_availability',
  'available',
  'positive numeric right is available without consuming quota'
);
update platform.workspace_entitlements
set numeric_value = 0
where id = 'c1010000-0000-4000-8000-000000000008';
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'product_availability',
  'unavailable',
  'zero numeric right is unavailable'
);

update platform.workspace_entitlements
set value_type = 'string', numeric_value = null, text_value = 'domain-value'
where id = 'c1010000-0000-4000-8000-000000000008';
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'product_availability',
  'review_required',
  'string right requires a domain comparator'
);
update platform.workspace_entitlements
set value_type = 'array', text_value = null, json_value = '["a"]'::jsonb
where id = 'c1010000-0000-4000-8000-000000000008';
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'product_availability',
  'review_required',
  'array right requires a domain comparator'
);
update platform.workspace_entitlements
set value_type = 'json', json_value = '{"mode":"domain"}'::jsonb
where id = 'c1010000-0000-4000-8000-000000000008';
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'product_availability',
  'review_required',
  'JSON right requires a domain comparator'
);

update platform.workspace_entitlements
set value_type = 'boolean', boolean_value = null, json_value = null
where id = 'c1010000-0000-4000-8000-000000000008';
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->'right'->>'evaluation_result',
  'ineffective',
  'null typed value is ineffective'
);
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->'right'->'reason_codes'->>0,
  'right_value_null',
  'null typed value has an explicit reason'
);

update platform.workspace_entitlements
set boolean_value = false,
    override_value_json = 'true'::jsonb,
    override_expires_at = statement_timestamp() + interval '1 day'
where id = 'c1010000-0000-4000-8000-000000000008';
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'product_availability',
  'available',
  'active literal true override wins over boolean false'
);
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->'right'->'override'->>'status',
  'active',
  'active override is visible in the projection'
);
update platform.workspace_entitlements
set boolean_value = true, override_value_json = 'false'::jsonb
where id = 'c1010000-0000-4000-8000-000000000008';
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'product_availability',
  'unavailable',
  'active override other than literal true wins over stored true'
);

update platform.workspace_entitlements
set override_value_json = null, override_expires_at = null,
    valid_until = statement_timestamp() - interval '1 hour'
where id = 'c1010000-0000-4000-8000-000000000008';
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'product_availability',
  'unavailable',
  'expired right is unavailable'
);
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->'right'->'reason_codes'->>0,
  'right_not_current',
  'expired right has an explicit temporal reason'
);

insert into platform.workspace_contracts(
  id, customer_workspace_id, contract_ref, version, status, start_date
) values (
  'c1010000-0000-4000-8000-000000000009',
  'c1010000-0000-4000-8000-000000000003',
  'PC01-CONTRACT-LOCAL',
  7,
  'active',
  current_date - 1
);
update platform.workspace_entitlements
set contract_id = 'c1010000-0000-4000-8000-000000000009',
    valid_until = null,
    boolean_value = true,
    updated_at = '2026-01-01T00:00:00Z'
where id = 'c1010000-0000-4000-8000-000000000008';
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->'right'->'provenance'->>'kind',
  'contract',
  'contract-backed right has exact contract provenance'
);
select is(
  (customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->'right'->'provenance'->>'contract_version')::integer,
  7,
  'contract provenance retains the stored version'
);
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->'right'->'provenance'->>'source_reference',
  'PC01-CONTRACT-LOCAL',
  'contract provenance retains the stored source reference'
);

update platform.workspace_modules
set status = 'deactivated',
    valid_to = statement_timestamp(),
    deactivated_at = statement_timestamp(),
    deactivated_by = 'c1010000-0000-4000-8000-000000000001',
    reason = 'PC01 separate activation proof'
where id = 'c1010000-0000-4000-8000-000000000007';
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->'activation'->>'status',
  'deactivated',
  'module deactivation is projected independently'
);
select is(
  customer_api.get_product_capability_decision_v1(
    'c1010000-0000-4000-8000-000000000005', 'c1010000-0000-4000-8000-000000000003',
    'module.services_catalog')->>'product_availability',
  'available',
  'deactivated module does not erase an effective product right'
);
select is(
  (select updated_at::text from platform.workspace_entitlements
   where id = 'c1010000-0000-4000-8000-000000000008'),
  '2026-01-01 00:00:00+00',
  'reading PC01 leaves the entitlement row unchanged'
);

select * from finish();
rollback;
