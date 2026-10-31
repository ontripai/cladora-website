begin;
select plan(37);

select has_function(
  'customer_api',
  'resolve_canonical_resource_reference_v1',
  array['uuid', 'uuid', 'text', 'uuid', 'integer', 'text', 'text'],
  'DW02 canonical reference reader has the bounded seven-argument signature'
);
select is(
  (select count(*)::integer
   from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'customer_api'
     and p.proname = 'resolve_canonical_resource_reference_v1'),
  1,
  'DW02 reader has no overload'
);
select ok(
  (select p.prosecdef
   from pg_proc p
   where p.oid = 'customer_api.resolve_canonical_resource_reference_v1(uuid,uuid,text,uuid,integer,text,text)'::regprocedure),
  'DW02 reader is SECURITY DEFINER'
);
select ok(
  (select p.provolatile = 's'
   from pg_proc p
   where p.oid = 'customer_api.resolve_canonical_resource_reference_v1(uuid,uuid,text,uuid,integer,text,text)'::regprocedure),
  'DW02 reader is STABLE'
);
select ok(
  not has_function_privilege('anon',
    'customer_api.resolve_canonical_resource_reference_v1(uuid,uuid,text,uuid,integer,text,text)', 'EXECUTE'),
  'anon cannot execute DW02 reader'
);
select ok(
  has_function_privilege('authenticated',
    'customer_api.resolve_canonical_resource_reference_v1(uuid,uuid,text,uuid,integer,text,text)', 'EXECUTE'),
  'authenticated may execute DW02 reader'
);
select ok(
  not has_function_privilege('service_role',
    'customer_api.resolve_canonical_resource_reference_v1(uuid,uuid,text,uuid,integer,text,text)', 'EXECUTE'),
  'service_role cannot directly execute DW02 reader'
);
select ok(
  not has_function_privilege('public',
    'customer_api.resolve_canonical_resource_reference_v1(uuid,uuid,text,uuid,integer,text,text)', 'EXECUTE'),
  'PUBLIC cannot execute DW02 reader'
);
select alike(
  pg_get_functiondef('customer_api.resolve_canonical_resource_reference_v1(uuid,uuid,text,uuid,integer,text,text)'::regprocedure),
  '%resolve_workspace_native_context_v2%',
  'DW02 uses the canonical AUTH01 Workspace resolver'
);
select alike(
  pg_get_functiondef('customer_api.resolve_canonical_resource_reference_v1(uuid,uuid,text,uuid,integer,text,text)'::regprocedure),
  '%check_workspace_native_permission_v2%',
  'DW02 uses the canonical AUTH01 permission evaluator'
);
select alike(
  pg_get_functiondef('customer_api.resolve_canonical_resource_reference_v1(uuid,uuid,text,uuid,integer,text,text)'::regprocedure),
  '%current_workspace_property_mandate_v1%',
  'DW02 preserves the existing property mandate prerequisite'
);

insert into auth.users(id, email) values
  ('d1020000-0000-4000-8000-000000000001', 'dw02-allowed@cladora.test'),
  ('d1020000-0000-4000-8000-000000000002', 'dw02-denied@cladora.test');
insert into platform.tenants(id, legal_name, registration_number, status) values
  ('d1020000-0000-4000-8000-000000000003', 'DW02 tenant', 'DW02-A', 'active'),
  ('d1030000-0000-4000-8000-000000000003', 'DW02 other tenant', 'DW02-B', 'active');
insert into portfolio.properties(id, tenant_id, type, name, status) values
  ('d1020000-0000-4000-8000-000000000004', 'd1020000-0000-4000-8000-000000000003',
   'condominium', 'DW02 property', 'active'),
  ('d1030000-0000-4000-8000-000000000004', 'd1030000-0000-4000-8000-000000000003',
   'condominium', 'Other property', 'active');
insert into portfolio.buildings(id, tenant_id, property_id, code, name) values
  ('d1020000-0000-4000-8000-000000000005', 'd1020000-0000-4000-8000-000000000003',
   'd1020000-0000-4000-8000-000000000004', 'A', 'DW02 building'),
  ('d1030000-0000-4000-8000-000000000005', 'd1030000-0000-4000-8000-000000000003',
   'd1030000-0000-4000-8000-000000000004', 'B', 'Other building');
insert into portfolio.units(id, tenant_id, building_id, code) values
  ('d1020000-0000-4000-8000-000000000006', 'd1020000-0000-4000-8000-000000000003',
   'd1020000-0000-4000-8000-000000000005', 'A-01'),
  ('d1030000-0000-4000-8000-000000000006', 'd1030000-0000-4000-8000-000000000003',
   'd1030000-0000-4000-8000-000000000005', 'B-01');
insert into platform.customer_workspaces(
  id, tenant_id, workspace_type, commercial_owner, lifecycle_status
) values (
  'd1020000-0000-4000-8000-000000000007',
  'd1020000-0000-4000-8000-000000000003',
  'ASSOCIATION', 'DW02 operator', 'ACTIVE'
);
insert into identity.memberships(id, tenant_id, user_id, role_id, status, starts_at)
select
  x.membership_id,
  'd1020000-0000-4000-8000-000000000003',
  x.user_id,
  r.id,
  'active',
  statement_timestamp() - interval '1 day'
from (values
  ('d1020000-0000-4000-8000-000000000008'::uuid, 'd1020000-0000-4000-8000-000000000001'::uuid),
  ('d1020000-0000-4000-8000-000000000009'::uuid, 'd1020000-0000-4000-8000-000000000002'::uuid)
) x(membership_id, user_id)
cross join identity.roles r
where r.code = 'association_admin'
  and r.tenant_id is null
  and r.is_system;
insert into identity.context_grants(id, tenant_id, membership_id, scope_type, starts_at) values
  ('d1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000003',
   'd1020000-0000-4000-8000-000000000008', 'tenant', statement_timestamp() - interval '1 day'),
  ('d1020000-0000-4000-8000-000000000011', 'd1020000-0000-4000-8000-000000000003',
   'd1020000-0000-4000-8000-000000000009', 'tenant', statement_timestamp() - interval '1 day');
insert into platform.workspace_taxonomy_assignments(
  tenant_id, customer_workspace_id, property_profile_id, operating_model_id,
  status, valid_from, created_by, country_code
)
select
  'd1020000-0000-4000-8000-000000000003',
  'd1020000-0000-4000-8000-000000000007',
  p.id,
  m.id,
  'active',
  statement_timestamp() - interval '1 day',
  'd1020000-0000-4000-8000-000000000001',
  'RO'
from platform.property_profiles p
cross join platform.operating_models m
where p.code = 'residential_condominium'
  and p.version = 1
  and m.code = 'association_managed'
  and m.version = 1;
insert into platform.workspace_modules(
  tenant_id, customer_workspace_id, module_definition_id, module_code, status, reason
)
select
  'd1020000-0000-4000-8000-000000000003',
  'd1020000-0000-4000-8000-000000000007',
  id,
  code,
  'active',
  'DW02 local acceptance fixture'
from platform.module_definitions
where code = 'core_unit_identity';
insert into platform.workspace_entitlements(
  customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from
) values (
  'd1020000-0000-4000-8000-000000000007',
  'module.core_unit_identity',
  'boolean',
  true,
  statement_timestamp() - interval '1 day'
);
insert into platform.workspace_roles(
  id, tenant_id, customer_workspace_id, code, name, scope_ceiling, created_by, valid_from
) values
  ('d1020000-0000-4000-8000-000000000012', 'd1020000-0000-4000-8000-000000000003',
   'd1020000-0000-4000-8000-000000000007', 'dw02_allowed', 'DW02 allowed', 'workspace',
   'd1020000-0000-4000-8000-000000000001', statement_timestamp() - interval '1 day'),
  ('d1020000-0000-4000-8000-000000000013', 'd1020000-0000-4000-8000-000000000003',
   'd1020000-0000-4000-8000-000000000007', 'dw02_denied', 'DW02 denied', 'workspace',
   'd1020000-0000-4000-8000-000000000001', statement_timestamp() - interval '1 day');
insert into platform.workspace_role_modules(tenant_id, workspace_role_id, module_definition_id)
select
  'd1020000-0000-4000-8000-000000000003',
  r.id,
  m.id
from platform.workspace_roles r
cross join platform.module_definitions m
where r.id in (
  'd1020000-0000-4000-8000-000000000012',
  'd1020000-0000-4000-8000-000000000013'
)
  and m.code = 'core_unit_identity';
insert into platform.workspace_role_permissions(
  tenant_id, workspace_role_id, permission_id, effect
)
select
  'd1020000-0000-4000-8000-000000000003',
  r.id,
  p.id,
  case
    when r.id = 'd1020000-0000-4000-8000-000000000012'
      then 'allow'::platform.decision_effect
    else 'deny'::platform.decision_effect
  end
from platform.workspace_roles r
cross join identity.permissions p
where r.id in (
  'd1020000-0000-4000-8000-000000000012',
  'd1020000-0000-4000-8000-000000000013'
)
  and p.code = 'core.units.identity.read';
update platform.workspace_roles
set lifecycle_status = 'published', lock_version = 2
where id in (
  'd1020000-0000-4000-8000-000000000012',
  'd1020000-0000-4000-8000-000000000013'
);
insert into platform.workspace_member_roles(
  tenant_id, customer_workspace_id, membership_id, workspace_role_id, scope_type,
  assigned_by_user_id, assigned_by_membership_id, reason, valid_from
) values
  ('d1020000-0000-4000-8000-000000000003', 'd1020000-0000-4000-8000-000000000007',
   'd1020000-0000-4000-8000-000000000008', 'd1020000-0000-4000-8000-000000000012',
   'workspace', 'd1020000-0000-4000-8000-000000000001', 'd1020000-0000-4000-8000-000000000008',
   'DW02 allowed assignment', statement_timestamp() - interval '1 hour'),
  ('d1020000-0000-4000-8000-000000000003', 'd1020000-0000-4000-8000-000000000007',
   'd1020000-0000-4000-8000-000000000009', 'd1020000-0000-4000-8000-000000000013',
   'workspace', 'd1020000-0000-4000-8000-000000000001', 'd1020000-0000-4000-8000-000000000008',
   'DW02 denied assignment', statement_timestamp() - interval '1 hour');
insert into platform.workspace_property_authorities(
  id, tenant_id, property_id, customer_workspace_id, purpose,
  authority_source, evidence_reference, valid_from
) values (
  'd1020000-0000-4000-8000-000000000014',
  'd1020000-0000-4000-8000-000000000003',
  'd1020000-0000-4000-8000-000000000004',
  'd1020000-0000-4000-8000-000000000007',
  'property_operations',
  'synthetic',
  'test://dw02/mandate',
  statement_timestamp() - interval '1 day'
);
insert into portfolio.unit_specification_versions(
  tenant_id, unit_id, version, building_id, unit_code, source_reference,
  recorded_by, customer_workspace_id
) values
  ('d1020000-0000-4000-8000-000000000003', 'd1020000-0000-4000-8000-000000000006', 1,
   'd1020000-0000-4000-8000-000000000005', 'A-01', 'test://dw02/unit/v1',
   'd1020000-0000-4000-8000-000000000001', 'd1020000-0000-4000-8000-000000000007'),
  ('d1020000-0000-4000-8000-000000000003', 'd1020000-0000-4000-8000-000000000006', 2,
   'd1020000-0000-4000-8000-000000000005', 'A-01', 'test://dw02/unit/v2',
   'd1020000-0000-4000-8000-000000000001', 'd1020000-0000-4000-8000-000000000007');

select throws_ok(
  $$select customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010',
    'd1020000-0000-4000-8000-000000000007',
    'unit',
    'd1020000-0000-4000-8000-000000000006',
    2,
    'core.units.identity.read',
    'core.unit_identity.history'
  )$$,
  '42501',
  'canonical_resource_reference_access_denied',
  'unauthenticated caller is denied'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1020000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);

select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 2,
    'core.units.identity.read', 'core.unit_identity.history'
  )->>'reference_status',
  'verified',
  'current Unit version is verified'
);
select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 2,
    'core.units.identity.read', 'core.unit_identity.history'
  )->>'tenant_id',
  'd1020000-0000-4000-8000-000000000003',
  'verified reference is tenant-bound'
);
select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 2,
    'core.units.identity.read', 'core.unit_identity.history'
  )->>'workspace_id',
  'd1020000-0000-4000-8000-000000000007',
  'verified reference is Workspace-bound'
);
select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 2,
    'core.units.identity.read', 'core.unit_identity.history'
  )->>'resource_type',
  'unit',
  'verified reference retains canonical Unit type'
);
select is(
  (customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 2,
    'core.units.identity.read', 'core.unit_identity.history'
  )->>'resource_version')::integer,
  2,
  'verified reference returns the current canonical version'
);
select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 2,
    'core.units.identity.read', 'core.unit_identity.history'
  )->>'display_name',
  'A-01',
  'verified reference returns bounded Unit display data'
);
select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 2,
    'core.units.identity.read', 'core.unit_identity.history'
  )->>'lifecycle_status',
  'active',
  'verified reference returns bounded lifecycle status'
);
select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 2,
    'core.units.identity.read', 'core.unit_identity.history'
  )->>'action_authorization',
  'not_evaluated',
  'verified identity never becomes command authority'
);
select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 1,
    'core.units.identity.read', 'core.unit_identity.history'
  )->>'reference_status',
  'stale',
  'older pinned Unit version is stale'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1020000-0000-4000-8000-000000000002","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000011', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 2,
    'core.units.identity.read', 'core.unit_identity.history'
  )->>'reference_status',
  'withheld',
  'AUTH01 deny becomes a withheld reference'
);
select ok(
  (select r->'tenant_id' = 'null'::jsonb
      and r->'workspace_id' = 'null'::jsonb
      and r->'resource_type' = 'null'::jsonb
      and r->'resource_id' = 'null'::jsonb
      and r->'resource_version' = 'null'::jsonb
   from (select customer_api.resolve_canonical_resource_reference_v1(
     'd1020000-0000-4000-8000-000000000011', 'd1020000-0000-4000-8000-000000000007',
     'unit', 'd1020000-0000-4000-8000-000000000006', 2,
     'core.units.identity.read', 'core.unit_identity.history'
   ) r) x),
  'withheld response exposes no tenant, Workspace or resource identity'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"d1020000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}',
  true
);
select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1030000-0000-4000-8000-000000000006', 1,
    'core.units.identity.read', 'core.unit_identity.history'
  )->>'reference_status',
  'withheld',
  'cross-tenant Unit is withheld'
);
select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000099', 1,
    'core.units.identity.read', 'core.unit_identity.history'
  )->>'reference_status',
  'not_found',
  'unknown Unit is not found only after valid Workspace authority'
);
select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 2,
    'workspace.role.read', 'core.unit_identity.history'
  )->>'reference_status',
  'withheld',
  'caller-selected alternate permission cannot widen disclosure'
);
select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 2,
    'core.units.identity.read', 'different.purpose'
  )->>'reference_status',
  'withheld',
  'caller-selected alternate purpose cannot widen disclosure'
);
select is(
  customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'party', 'd1020000-0000-4000-8000-000000000006', 2,
    'core.units.identity.read', 'core.unit_identity.history'
  )->>'reference_status',
  'withheld',
  'unaccepted resource mappings remain withheld'
);
select throws_ok(
  $$select customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 0,
    'core.units.identity.read', 'core.unit_identity.history'
  )$$,
  '22023',
  'canonical_resource_reference_input_invalid',
  'invalid resource version is rejected'
);

select is(
  customer_api.get_core_unit_identity_history_v1(
    'd1020000-0000-4000-8000-000000000010',
    'd1020000-0000-4000-8000-000000000007',
    'd1020000-0000-4000-8000-000000000006'
  )#>>'{resource_reference,reference_status}',
  'verified',
  'existing Core Unit identity consumer returns its DW02 reference'
);
select is(
  jsonb_array_length(customer_api.get_core_unit_identity_history_v1(
    'd1020000-0000-4000-8000-000000000010',
    'd1020000-0000-4000-8000-000000000007',
    'd1020000-0000-4000-8000-000000000006'
  )->'snapshots'),
  2,
  'existing consumer keeps its bounded history result'
);

create temporary table dw02_before_read as
select
  (select count(*) from portfolio.unit_specification_versions) as specifications_n,
  (select count(*) from platform.workspace_property_authorities) as mandates_n,
  (select count(*) from audit.events) as audit_n,
  (select count(*) from platform.outbox_events) as outbox_n;
do $$
begin
  perform customer_api.resolve_canonical_resource_reference_v1(
    'd1020000-0000-4000-8000-000000000010', 'd1020000-0000-4000-8000-000000000007',
    'unit', 'd1020000-0000-4000-8000-000000000006', 2,
    'core.units.identity.read', 'core.unit_identity.history'
  );
  perform customer_api.get_core_unit_identity_history_v1(
    'd1020000-0000-4000-8000-000000000010',
    'd1020000-0000-4000-8000-000000000007',
    'd1020000-0000-4000-8000-000000000006'
  );
end;
$$;
select is(
  (select row(specifications_n, mandates_n, audit_n, outbox_n)::text from dw02_before_read),
  row(
    (select count(*) from portfolio.unit_specification_versions),
    (select count(*) from platform.workspace_property_authorities),
    (select count(*) from audit.events),
    (select count(*) from platform.outbox_events)
  )::text,
  'DW02 resolver and consumer perform zero writes'
);
select unalike(
  pg_get_functiondef('customer_api.resolve_canonical_resource_reference_v1(uuid,uuid,text,uuid,integer,text,text)'::regprocedure),
  '%insert into%',
  'DW02 reader contains no INSERT'
);
select unalike(
  pg_get_functiondef('customer_api.resolve_canonical_resource_reference_v1(uuid,uuid,text,uuid,integer,text,text)'::regprocedure),
  '%update %',
  'DW02 reader contains no UPDATE'
);
select unalike(
  pg_get_functiondef('customer_api.resolve_canonical_resource_reference_v1(uuid,uuid,text,uuid,integer,text,text)'::regprocedure),
  '%delete from%',
  'DW02 reader contains no DELETE'
);
select alike(
  pg_get_functiondef('customer_api.get_core_unit_identity_history_v1(uuid,uuid,uuid)'::regprocedure),
  '%resolve_canonical_resource_reference_v1%',
  'existing Core Unit identity reader is a real DW02 consumer'
);
select unalike(
  pg_get_functiondef('customer_api.get_core_unit_identity_history_v1(uuid,uuid,uuid)'::regprocedure),
  '%check_workspace_native_permission_v2%',
  'consumer no longer carries a parallel AUTH01 evaluator call'
);

select * from finish();
rollback;
