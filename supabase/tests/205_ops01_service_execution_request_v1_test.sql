begin;
select plan(35);

select has_table('maintenance', 'execution_request_receipts',
  'OPS01 has one additive source-to-Work-Order receipt table');
select ok((select relrowsecurity from pg_class
  where oid = 'maintenance.execution_request_receipts'::regclass),
  'OPS01 receipt table has RLS enabled');
select ok(not has_table_privilege('authenticated',
  'maintenance.execution_request_receipts', 'SELECT'),
  'SERVICE consumer has no direct receipt-table access');
select has_function('customer_api', 'request_service_execution_v1', array['jsonb'],
  'OPS01 exposes one bounded request RPC');
select ok((select prosecdef from pg_proc
  where oid = 'customer_api.request_service_execution_v1(jsonb)'::regprocedure),
  'OPS01 RPC is SECURITY DEFINER');
select ok(not has_function_privilege('anon',
  'customer_api.request_service_execution_v1(jsonb)', 'EXECUTE'),
  'anon cannot execute OPS01');
select ok(has_function_privilege('authenticated',
  'customer_api.request_service_execution_v1(jsonb)', 'EXECUTE'),
  'authenticated may execute OPS01');
select ok(not has_function_privilege('service_role',
  'customer_api.request_service_execution_v1(jsonb)', 'EXECUTE'),
  'service_role cannot bypass the actor-bound OPS01 gateway');
select alike(pg_get_functiondef('customer_api.request_service_execution_v1(jsonb)'::regprocedure),
  '%service_request_subject_context_v1%',
  'OPS01 consumes the existing locked SERVICE request/version context');
select alike(pg_get_functiondef('customer_api.request_service_execution_v1(jsonb)'::regprocedure),
  '%resolve_canonical_resource_reference_v1%',
  'OPS01 consumes the DW02 canonical Unit resolver');
select alike(pg_get_functiondef('customer_api.request_service_execution_v1(jsonb)'::regprocedure),
  '%check_workspace_native_permission_v2%',
  'OPS01 consumes the current AUTH01 Workspace permission evaluator');
select alike(pg_get_functiondef('customer_api.request_service_execution_v1(jsonb)'::regprocedure),
  '%maintenance.create_work_order%',
  'OPS01 reuses the existing canonical Work Order engine');

insert into auth.users(id, email, email_confirmed_at) values
  ('0f010000-0000-4000-8000-000000000001', 'ops01-user@cladora.test', statement_timestamp());
insert into platform.tenants(id, legal_name, registration_number, status) values
  ('0f010000-0000-4000-8000-000000000002', 'OPS01 tenant', 'OPS01-A', 'active'),
  ('0f010000-0000-4000-8000-000000000102', 'OPS01 foreign tenant', 'OPS01-B', 'active');
insert into portfolio.properties(id, tenant_id, type, name, status) values
  ('0f010000-0000-4000-8000-000000000003', '0f010000-0000-4000-8000-000000000002',
   'condominium', 'OPS01 property', 'active'),
  ('0f010000-0000-4000-8000-000000000103', '0f010000-0000-4000-8000-000000000102',
   'condominium', 'Foreign property', 'active');
insert into portfolio.buildings(id, tenant_id, property_id, code, name) values
  ('0f010000-0000-4000-8000-000000000004', '0f010000-0000-4000-8000-000000000002',
   '0f010000-0000-4000-8000-000000000003', 'A', 'OPS01 building'),
  ('0f010000-0000-4000-8000-000000000104', '0f010000-0000-4000-8000-000000000102',
   '0f010000-0000-4000-8000-000000000103', 'B', 'Foreign building');
insert into portfolio.units(id, tenant_id, building_id, code) values
  ('0f010000-0000-4000-8000-000000000005', '0f010000-0000-4000-8000-000000000002',
   '0f010000-0000-4000-8000-000000000004', 'A-01'),
  ('0f010000-0000-4000-8000-000000000105', '0f010000-0000-4000-8000-000000000102',
   '0f010000-0000-4000-8000-000000000104', 'B-01');
insert into portfolio.parties(id, tenant_id, type, legal_name) values
  ('0f010000-0000-4000-8000-000000000006', '0f010000-0000-4000-8000-000000000002',
   'person', 'OPS01 beneficiary');
insert into platform.customer_workspaces(
  id, tenant_id, workspace_type, commercial_owner, lifecycle_status
) values (
  '0f010000-0000-4000-8000-000000000007',
  '0f010000-0000-4000-8000-000000000002',
  'ASSOCIATION', 'OPS01 operator', 'ACTIVE'
);
insert into identity.memberships(id, tenant_id, user_id, role_id, status, starts_at)
select
  '0f010000-0000-4000-8000-000000000008',
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000001',
  r.id,
  'active',
  statement_timestamp() - interval '1 day'
from identity.roles r
where r.code = 'association_admin' and r.tenant_id is null and r.is_system;
insert into identity.context_grants(
  id, tenant_id, membership_id, scope_type, starts_at
) values (
  '0f010000-0000-4000-8000-000000000009',
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000008',
  'tenant', statement_timestamp() - interval '1 day'
);
insert into identity.membership_parties(
  tenant_id, membership_id, party_id, valid_from
) values (
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000008',
  '0f010000-0000-4000-8000-000000000006',
  statement_timestamp() - interval '1 day'
);
insert into platform.workspace_taxonomy_assignments(
  tenant_id, customer_workspace_id, property_profile_id, operating_model_id,
  status, valid_from, created_by, country_code
)
select
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000007',
  p.id, m.id, 'active', statement_timestamp() - interval '1 day',
  '0f010000-0000-4000-8000-000000000001', 'RO'
from platform.property_profiles p
cross join platform.operating_models m
where p.code = 'residential_condominium' and p.version = 1
  and m.code = 'association_managed' and m.version = 1;
insert into platform.workspace_modules(
  tenant_id, customer_workspace_id, module_definition_id, module_code,
  status, valid_from, activated_at, activated_by, reason
)
select
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000007',
  m.id, m.code, 'active', statement_timestamp() - interval '1 day',
  statement_timestamp() - interval '1 day',
  '0f010000-0000-4000-8000-000000000001', 'OPS01 fixture'
from platform.module_definitions m
where m.code in ('core_unit_identity','services_catalog','services_orders','maintenance');
insert into platform.workspace_entitlements(
  customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from
) values
  ('0f010000-0000-4000-8000-000000000007', 'module.core_unit_identity', 'boolean', true, statement_timestamp() - interval '1 day'),
  ('0f010000-0000-4000-8000-000000000007', 'module.services_catalog', 'boolean', true, statement_timestamp() - interval '1 day'),
  ('0f010000-0000-4000-8000-000000000007', 'module.services_orders', 'boolean', true, statement_timestamp() - interval '1 day'),
  ('0f010000-0000-4000-8000-000000000007', 'module.maintenance', 'boolean', true, statement_timestamp() - interval '1 day');
insert into platform.workspace_roles(
  id, tenant_id, customer_workspace_id, code, name, scope_ceiling,
  created_by, valid_from
) values (
  '0f010000-0000-4000-8000-000000000010',
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000007',
  'ops01_executor', 'OPS01 executor', 'workspace',
  '0f010000-0000-4000-8000-000000000001',
  statement_timestamp() - interval '1 day'
);
insert into platform.workspace_role_modules(
  tenant_id, workspace_role_id, module_definition_id
)
select
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000010',
  m.id
from platform.module_definitions m
where m.code in ('core_unit_identity','services_catalog','services_orders','maintenance');
insert into platform.workspace_role_permissions(
  tenant_id, workspace_role_id, permission_id, effect
)
select
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000010',
  p.id,
  'allow'
from identity.permissions p
where p.code in (
  'core.units.identity.read',
  'services.catalog.read',
  'services.orders.read',
  'maintenance.work_orders.manage'
);
update platform.workspace_roles
set lifecycle_status = 'published', lock_version = 2
where id = '0f010000-0000-4000-8000-000000000010';
insert into platform.workspace_member_roles(
  tenant_id, customer_workspace_id, membership_id, workspace_role_id,
  scope_type, assigned_by_user_id, assigned_by_membership_id, reason, valid_from
) values (
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000007',
  '0f010000-0000-4000-8000-000000000008',
  '0f010000-0000-4000-8000-000000000010',
  'workspace',
  '0f010000-0000-4000-8000-000000000001',
  '0f010000-0000-4000-8000-000000000008',
  'OPS01 accepted fixture', statement_timestamp() - interval '1 hour'
);
insert into platform.workspace_property_authorities(
  id, tenant_id, property_id, customer_workspace_id, purpose,
  authority_source, evidence_reference, valid_from
) values (
  '0f010000-0000-4000-8000-000000000011',
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000003',
  '0f010000-0000-4000-8000-000000000007',
  'property_operations', 'fixture', 'test://ops01/mandate',
  statement_timestamp() - interval '1 day'
);
insert into portfolio.unit_specification_versions(
  tenant_id, unit_id, version, building_id, unit_code, source_reference,
  recorded_by, customer_workspace_id
) values
  ('0f010000-0000-4000-8000-000000000002', '0f010000-0000-4000-8000-000000000005', 1,
   '0f010000-0000-4000-8000-000000000004', 'A-01', 'test://ops01/unit/v1',
   '0f010000-0000-4000-8000-000000000001', '0f010000-0000-4000-8000-000000000007'),
  ('0f010000-0000-4000-8000-000000000002', '0f010000-0000-4000-8000-000000000005', 2,
   '0f010000-0000-4000-8000-000000000004', 'A-01', 'test://ops01/unit/v2',
   '0f010000-0000-4000-8000-000000000001', '0f010000-0000-4000-8000-000000000007');

insert into service_catalog.definitions(
  id, tenant_id, workspace_id, code, labels, active
) values (
  '0f010000-0000-4000-8000-000000000012',
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000007',
  'ops_repair', '{"ro":"Reparație","en":"Repair","fa":"تعمیر"}', true
);
insert into service_catalog.offerings(
  id, tenant_id, workspace_id, definition_id, provider_party_id,
  current_revision_id, published_revision_id, created_by
) values (
  '0f010000-0000-4000-8000-000000000013',
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000007',
  '0f010000-0000-4000-8000-000000000012',
  '0f010000-0000-4000-8000-000000000006',
  '0f010000-0000-4000-8000-000000000014',
  '0f010000-0000-4000-8000-000000000014',
  '0f010000-0000-4000-8000-000000000001'
);
insert into service_catalog.revisions(
  id, tenant_id, workspace_id, offering_id, commercial_terms,
  valid_from, valid_until, status, created_by, submitted_by, published_by
) values (
  '0f010000-0000-4000-8000-000000000014',
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000007',
  '0f010000-0000-4000-8000-000000000013',
  '{
    "labels":{"ro":"Reparație","en":"Repair","fa":"تعمیر"},
    "description":{"ro":"Reparație tehnică","en":"Technical repair","fa":"تعمیر فنی"},
    "acquisition_mode":"direct",
    "price":{"kind":"fixed","amount":"100.00","currency":"RON","tax_display":"included"},
    "valid_from":"2026-01-01T00:00:00Z",
    "valid_until":null,
    "cancellation_terms":{"ro":"Anulare","en":"Cancellation","fa":"لغو"},
    "acceptance_criteria":{"ro":"Acceptare","en":"Acceptance","fa":"پذیرش"},
    "document_version_ids":[]
  }',
  '2026-01-01T00:00:00Z', null, 'published',
  '0f010000-0000-4000-8000-000000000001',
  '0f010000-0000-4000-8000-000000000001', null
);
insert into service_catalog.requests(
  id, tenant_id, workspace_id, offering_id, published_revision_id,
  requester_id, membership_id, beneficiary_party_id, description
) values (
  '0f010000-0000-4000-8000-000000000015',
  '0f010000-0000-4000-8000-000000000002',
  '0f010000-0000-4000-8000-000000000007',
  '0f010000-0000-4000-8000-000000000013',
  '0f010000-0000-4000-8000-000000000014',
  '0f010000-0000-4000-8000-000000000001',
  '0f010000-0000-4000-8000-000000000008',
  '0f010000-0000-4000-8000-000000000006',
  'Repair the unit ventilation'
);

create temporary table ops01_test_requests(name text primary key, payload jsonb) on commit drop;
insert into ops01_test_requests(name, payload) values (
  'accepted',
  jsonb_build_object(
    'contract_version', 'operations-execution-request-receipt.v1',
    'request_id', '0f010000-0000-4000-8000-000000000020',
    'idempotency_key', 'ops01-accepted-001',
    'context_id', '0f010000-0000-4000-8000-000000000009',
    'workspace_id', '0f010000-0000-4000-8000-000000000007',
    'source', jsonb_build_object(
      'source_domain', 'service',
      'source_entity_type', 'service_request',
      'source_entity_id', '0f010000-0000-4000-8000-000000000015',
      'source_version', 1,
      'source_reference', 'service_catalog.requests:0f010000-0000-4000-8000-000000000015:v1'
    ),
    'resource', jsonb_build_object(
      'contract_version', 'canonical-resource-reference.v1',
      'context_id', '0f010000-0000-4000-8000-000000000009',
      'workspace_id', '0f010000-0000-4000-8000-000000000007',
      'resource_type', 'unit',
      'resource_id', '0f010000-0000-4000-8000-000000000005',
      'resource_version', 2,
      'permission_code', 'core.units.identity.read',
      'purpose', 'core.unit_identity.history'
    ),
    'request_kind', 'repair',
    'title', 'Repair ventilation',
    'scope_reference', 'service-request-scope:v1',
    'priority', 'normal',
    'desired_start', null,
    'desired_end', null,
    'financial_proposal_id', null,
    'financial_proposal_version', null,
    'requested_at', '2026-10-19T19:50:00Z',
    'current_authority_recheck_required', true
  )
);
insert into ops01_test_requests(name, payload)
select 'stale-source',
  jsonb_set(
    jsonb_set(
      jsonb_set(payload, '{request_id}', '"0f010000-0000-4000-8000-000000000021"'),
      '{idempotency_key}', '"ops01-stale-source-001"'
    ),
    '{source}', (payload->'source') || jsonb_build_object(
      'source_version', 2,
      'source_reference', 'service_catalog.requests:0f010000-0000-4000-8000-000000000015:v2'
    )
  )
from ops01_test_requests where name = 'accepted';
insert into ops01_test_requests(name, payload)
select 'stale-resource',
  jsonb_set(
    jsonb_set(
      jsonb_set(payload, '{request_id}', '"0f010000-0000-4000-8000-000000000022"'),
      '{idempotency_key}', '"ops01-stale-resource-001"'
    ),
    '{resource,resource_version}', '1'
  )
from ops01_test_requests where name = 'accepted';
insert into ops01_test_requests(name, payload)
select 'finance',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(payload, '{request_id}', '"0f010000-0000-4000-8000-000000000023"'),
        '{idempotency_key}', '"ops01-finance-001"'
      ),
      '{financial_proposal_id}', '"0f010000-0000-4000-8000-000000000024"'
    ),
    '{financial_proposal_version}', '1'
  )
from ops01_test_requests where name = 'accepted';
insert into ops01_test_requests(name, payload)
select 'foreign-resource',
  jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(payload, '{request_id}', '"0f010000-0000-4000-8000-000000000025"'),
        '{idempotency_key}', '"ops01-foreign-resource-001"'
      ),
      '{resource,resource_id}', '"0f010000-0000-4000-8000-000000000105"'
    ),
    '{resource,resource_version}', '1'
  )
from ops01_test_requests where name = 'accepted';

select throws_ok(
  $$select customer_api.request_service_execution_v1(
    (select payload from ops01_test_requests where name = 'accepted')
  )$$,
  '42501', 'operations_execution_access_denied',
  'unauthenticated caller is denied'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"0f010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  customer_api.request_service_execution_v1(
    (select payload from ops01_test_requests where name = 'accepted')
  )->>'request_status',
  'accepted',
  'current SERVICE request and canonical Unit are accepted'
);
select is((select count(*) from maintenance.work_orders
  where tenant_id = '0f010000-0000-4000-8000-000000000002'), 1::bigint,
  'accepted request creates exactly one canonical Work Order');
select is((select status::text from maintenance.work_orders
  where tenant_id = '0f010000-0000-4000-8000-000000000002'), 'draft',
  'OPS01 acceptance only creates a draft and grants no lifecycle transition');
select is((select count(*) from maintenance.execution_request_receipts
  where request_status = 'accepted'), 1::bigint,
  'accepted linkage has exactly one immutable receipt');
select is((select source_entity_id from maintenance.execution_request_receipts
  where request_status = 'accepted'), '0f010000-0000-4000-8000-000000000015'::uuid,
  'receipt pins the real SERVICE request consumer');
select is((select count(*) from audit.events
  where action = 'operations.execution_request.accepted'
    and entity_type = 'maintenance.execution_request_receipt'), 1::bigint,
  'accepted linkage records audit evidence');
select is((select count(*) from platform.outbox_events
  where event_type = 'operations.execution_request.accepted'), 1::bigint,
  'accepted linkage records an outbox event');
select is(
  customer_api.request_service_execution_v1(
    (select payload from ops01_test_requests where name = 'accepted')
  )->>'receipt_id',
  (select id::text from maintenance.execution_request_receipts
   where request_status = 'accepted'),
  'exact retry replays the same receipt'
);
select is((select count(*) from maintenance.work_orders
  where tenant_id = '0f010000-0000-4000-8000-000000000002'), 1::bigint,
  'exact replay creates no second Work Order');
select throws_ok(
  $$select customer_api.request_service_execution_v1(
    jsonb_set(
      (select payload from ops01_test_requests where name = 'accepted'),
      '{title}', '"Different retry payload"'
    )
  )$$,
  '23505', 'operations_execution_idempotency_conflict',
  'same idempotency key with a different fingerprint fails closed'
);
select is(
  customer_api.request_service_execution_v1(
    (select payload from ops01_test_requests where name = 'stale-source')
  )->>'request_status',
  'rejected',
  'stale SERVICE request version is rejected without a Work Order'
);
select is((select reason_codes->>0 from maintenance.execution_request_receipts
  where request_id = '0f010000-0000-4000-8000-000000000021'),
  'source_version_stale',
  'stale source rejection records only a bounded reason');
select is(
  customer_api.request_service_execution_v1(
    (select payload from ops01_test_requests where name = 'stale-resource')
  )->>'request_status',
  'rejected',
  'stale DW02 Unit version is rejected'
);
select is(
  customer_api.request_service_execution_v1(
    (select payload from ops01_test_requests where name = 'finance')
  )->>'request_status',
  'rejected',
  'FIN01 reference is rejected until the Finance adapter is connected'
);
select ok((select work_order_id is null and financial_proposal_id is not null
  from maintenance.execution_request_receipts
  where request_id = '0f010000-0000-4000-8000-000000000023'),
  'FIN01-gated rejection creates no Work Order while retaining internal input evidence');
select is(
  customer_api.request_service_execution_v1(
    (select payload from ops01_test_requests where name = 'foreign-resource')
  )->>'request_status',
  'rejected',
  'cross-tenant Unit is rejected through DW02 withholding'
);
select ok((select work_order_id is null
  from maintenance.execution_request_receipts
  where request_id = '0f010000-0000-4000-8000-000000000025'),
  'cross-tenant rejection exposes no Work Order identifier');
select is((select version from service_catalog.requests
  where id = '0f010000-0000-4000-8000-000000000015'), 1::bigint,
  'OPS01 does not mutate its SERVICE consumer source');
select throws_ok(
  $$update maintenance.execution_request_receipts
    set title = title where request_status = 'accepted'$$,
  '42501', 'operations_execution_receipt_immutable',
  'receipt update is blocked'
);
select throws_ok(
  $$delete from maintenance.execution_request_receipts
    where request_status = 'accepted'$$,
  '42501', 'operations_execution_receipt_immutable',
  'receipt deletion is blocked'
);

update identity.context_grants
set ends_at = statement_timestamp() - interval '1 second'
where id = '0f010000-0000-4000-8000-000000000009';
select throws_ok(
  $$select customer_api.request_service_execution_v1(
    (select payload from ops01_test_requests where name = 'accepted')
  )$$,
  '42501',
  'service_request_access_denied',
  'accepted receipt cannot replay after current AUTH01 authority expires'
);

select is((select count(*) from maintenance.work_orders
  where tenant_id = '0f010000-0000-4000-8000-000000000002'), 1::bigint,
  'all rejected and revoked paths leave canonical Work Orders unchanged');

select * from finish();
rollback;
