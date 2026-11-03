begin;
select plan(30);

select has_function(
  'customer_api', 'list_my_owner_portfolio_projections_v1', array['jsonb'],
  'PF01 exposes one bounded projection RPC'
);
select ok(
  (select p.prosecdef from pg_proc p
   where p.oid = 'customer_api.list_my_owner_portfolio_projections_v1(jsonb)'::regprocedure),
  'PF01 is SECURITY DEFINER'
);
select ok(
  (select p.provolatile = 's' from pg_proc p
   where p.oid = 'customer_api.list_my_owner_portfolio_projections_v1(jsonb)'::regprocedure),
  'PF01 is STABLE'
);
select ok(not has_function_privilege('anon',
  'customer_api.list_my_owner_portfolio_projections_v1(jsonb)', 'EXECUTE'),
  'anon cannot execute PF01');
select ok(has_function_privilege('authenticated',
  'customer_api.list_my_owner_portfolio_projections_v1(jsonb)', 'EXECUTE'),
  'authenticated may execute PF01');
select ok(not has_function_privilege('service_role',
  'customer_api.list_my_owner_portfolio_projections_v1(jsonb)', 'EXECUTE'),
  'service_role cannot directly execute PF01');
select ok(
  pg_get_functiondef('customer_api.list_my_owner_portfolio_projections_v1(jsonb)'::regprocedure)
    !~* '\m(insert|update|delete|merge)\M',
  'PF01 function contains no DML'
);
select alike(
  pg_get_functiondef('customer_api.list_my_owner_portfolio_projections_v1(jsonb)'::regprocedure),
  '%resolve_canonical_resource_reference_v1%',
  'PF01 consumes the accepted DW02 resolver'
);
select alike(
  pg_get_functiondef('customer_api.list_my_owner_portfolio_projections_v1(jsonb)'::regprocedure),
  '%native_workspace_scope_for_membership_v2%',
  'PF01 is connected to current AUTH01 scope'
);
select alike(
  pg_get_functiondef('customer_api.list_my_owner_portfolio_projections_v1(jsonb)'::regprocedure),
  '%get_product_capability_decision_v1%',
  'PF01 consumes PC01 for its only action candidate'
);

insert into auth.users(id, email, email_confirmed_at) values
  ('f1010000-0000-4000-8000-000000000001', 'pf01-owner@cladora.test', statement_timestamp()),
  ('f1010000-0000-4000-8000-000000000002', 'pf01-other@cladora.test', statement_timestamp());

insert into platform.tenants(id, legal_name, registration_number, status) values
  ('f1010000-0000-4000-8000-000000000010', 'PF01 personal', 'PF01-PERSONAL', 'active'),
  ('f1010000-0000-4000-8000-000000000020', 'PF01 official', 'PF01-OFFICIAL', 'active'),
  ('f1010000-0000-4000-8000-000000000030', 'PF01 foreign', 'PF01-FOREIGN', 'active');

insert into portfolio.properties(id, tenant_id, type, name, status) values
  ('f1010000-0000-4000-8000-000000000031', 'f1010000-0000-4000-8000-000000000020', 'condominium', 'Property One', 'active'),
  ('f1010000-0000-4000-8000-000000000032', 'f1010000-0000-4000-8000-000000000020', 'condominium', 'Property Two', 'active'),
  ('f1010000-0000-4000-8000-000000000033', 'f1010000-0000-4000-8000-000000000020', 'condominium', 'Expired Property', 'active'),
  ('f1010000-0000-4000-8000-000000000034', 'f1010000-0000-4000-8000-000000000030', 'condominium', 'Foreign Property', 'active');
insert into portfolio.buildings(id, tenant_id, property_id, code, name) values
  ('f1010000-0000-4000-8000-000000000041', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000031', 'A', 'Building One'),
  ('f1010000-0000-4000-8000-000000000042', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000032', 'B', 'Building Two'),
  ('f1010000-0000-4000-8000-000000000043', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000033', 'C', 'Expired Building'),
  ('f1010000-0000-4000-8000-000000000044', 'f1010000-0000-4000-8000-000000000030', 'f1010000-0000-4000-8000-000000000034', 'D', 'Foreign Building');
insert into portfolio.units(id, tenant_id, building_id, code) values
  ('f1010000-0000-4000-8000-000000000051', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000041', 'A-01'),
  ('f1010000-0000-4000-8000-000000000052', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000042', 'B-02'),
  ('f1010000-0000-4000-8000-000000000053', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000043', 'C-03'),
  ('f1010000-0000-4000-8000-000000000054', 'f1010000-0000-4000-8000-000000000030', 'f1010000-0000-4000-8000-000000000044', 'D-04');
insert into portfolio.parties(id, tenant_id, type, legal_name) values
  ('f1010000-0000-4000-8000-000000000071', 'f1010000-0000-4000-8000-000000000020', 'person', 'PF01 owner party'),
  ('f1010000-0000-4000-8000-000000000072', 'f1010000-0000-4000-8000-000000000020', 'person', 'Other owner party'),
  ('f1010000-0000-4000-8000-000000000073', 'f1010000-0000-4000-8000-000000000030', 'person', 'Foreign party');
insert into portfolio.ownerships(id, tenant_id, unit_id, party_id, share, valid_from) values
  ('f1010000-0000-4000-8000-000000000081', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000051', 'f1010000-0000-4000-8000-000000000071', 1, current_date - 30),
  ('f1010000-0000-4000-8000-000000000082', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000052', 'f1010000-0000-4000-8000-000000000071', 1, current_date - 30),
  ('f1010000-0000-4000-8000-000000000083', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000053', 'f1010000-0000-4000-8000-000000000071', 1, current_date - 30),
  ('f1010000-0000-4000-8000-000000000084', 'f1010000-0000-4000-8000-000000000030', 'f1010000-0000-4000-8000-000000000054', 'f1010000-0000-4000-8000-000000000073', 1, current_date - 30);

insert into platform.customer_workspaces(id, tenant_id, workspace_type, commercial_owner, lifecycle_status) values
  ('f1010000-0000-4000-8000-000000000061', 'f1010000-0000-4000-8000-000000000020', 'ASSOCIATION', 'PF01 operator one', 'ACTIVE'),
  ('f1010000-0000-4000-8000-000000000062', 'f1010000-0000-4000-8000-000000000020', 'ASSOCIATION', 'PF01 operator two', 'ACTIVE'),
  ('f1010000-0000-4000-8000-000000000063', 'f1010000-0000-4000-8000-000000000020', 'ASSOCIATION', 'PF01 expired operator', 'ACTIVE');

insert into identity.memberships(id, tenant_id, user_id, role_id, status, starts_at)
select 'f1010000-0000-4000-8000-000000000093', 'f1010000-0000-4000-8000-000000000010',
  'f1010000-0000-4000-8000-000000000001', r.id, 'active', statement_timestamp() - interval '1 day'
from identity.roles r where r.tenant_id is null and r.code = 'multi_unit_owner';
insert into identity.memberships(id, tenant_id, user_id, role_id, status, starts_at)
select 'f1010000-0000-4000-8000-000000000091', 'f1010000-0000-4000-8000-000000000020',
  'f1010000-0000-4000-8000-000000000001', r.id, 'active', statement_timestamp() - interval '1 day'
from identity.roles r where r.tenant_id is null and r.code = 'association_admin';
insert into identity.context_grants(id, membership_id, tenant_id, scope_type, starts_at) values
  ('f1010000-0000-4000-8000-000000000092', 'f1010000-0000-4000-8000-000000000091', 'f1010000-0000-4000-8000-000000000020', 'tenant', statement_timestamp() - interval '1 day');

insert into public.owner_private_units(id, owner_user_id, building_label, unit_label, address_text) values
  ('f1010000-0000-4000-8000-0000000000b1', 'f1010000-0000-4000-8000-000000000001', 'Private One', 'Private-A', 'Private owner address one'),
  ('f1010000-0000-4000-8000-0000000000b2', 'f1010000-0000-4000-8000-000000000001', 'Private Two', 'Private-B', 'Private owner address two'),
  ('f1010000-0000-4000-8000-0000000000b3', 'f1010000-0000-4000-8000-000000000001', 'Private Three', 'Private-C', 'Private owner address three'),
  ('f1010000-0000-4000-8000-0000000000b4', 'f1010000-0000-4000-8000-000000000002', 'Secret Other', 'Other-X', 'Other owner secret address');

insert into communications.unit_invitations(
  id, tenant_id, workspace_id, unit_id, party_id, normalized_email, role_code,
  status, invited_by, inviter_context_id, accepted_by, accepted_at, owner_portfolio_requested
) values (
  'f1010000-0000-4000-8000-0000000000d1', 'f1010000-0000-4000-8000-000000000020',
  'f1010000-0000-4000-8000-000000000061', 'f1010000-0000-4000-8000-000000000051',
  'f1010000-0000-4000-8000-000000000071', 'pf01-owner@cladora.test', 'owner', 'accepted',
  'f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-000000000092',
  'f1010000-0000-4000-8000-000000000001', statement_timestamp(), true
);
insert into platform.invited_owner_portfolios(owner_user_id, tenant_id, membership_id) values
  ('f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-000000000010', 'f1010000-0000-4000-8000-000000000093');
insert into platform.invited_owner_units(invitation_id, owner_user_id, private_unit_id, canonical_unit_id, ownership_party_id) values
  ('f1010000-0000-4000-8000-0000000000d1', 'f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-0000000000b1', 'f1010000-0000-4000-8000-000000000051', 'f1010000-0000-4000-8000-000000000071');

insert into platform.workspace_taxonomy_assignments(
  tenant_id, customer_workspace_id, property_profile_id, operating_model_id,
  status, valid_from, created_by, country_code
)
select 'f1010000-0000-4000-8000-000000000020', w.id, p.id, m.id, 'active',
  statement_timestamp() - interval '1 day', 'f1010000-0000-4000-8000-000000000001', 'RO'
from platform.customer_workspaces w
cross join platform.property_profiles p
cross join platform.operating_models m
where w.id in ('f1010000-0000-4000-8000-000000000061', 'f1010000-0000-4000-8000-000000000062', 'f1010000-0000-4000-8000-000000000063')
  and p.code = 'residential_condominium' and p.version = 1
  and m.code = 'association_managed' and m.version = 1;
insert into platform.workspace_modules(tenant_id, customer_workspace_id, module_definition_id, module_code, status, reason)
select 'f1010000-0000-4000-8000-000000000020', w.id, m.id, m.code, 'active', 'PF01 core fixture'
from platform.customer_workspaces w cross join platform.module_definitions m
where w.id in ('f1010000-0000-4000-8000-000000000061', 'f1010000-0000-4000-8000-000000000062', 'f1010000-0000-4000-8000-000000000063')
  and m.code = 'core_unit_identity';
insert into platform.workspace_modules(tenant_id, customer_workspace_id, module_definition_id, module_code, status, reason)
select 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000061', m.id, m.code, 'active', 'PF01 service fixture'
from platform.module_definitions m where m.code = 'services_catalog';
insert into platform.workspace_entitlements(customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from)
select w.id, 'module.core_unit_identity', 'boolean', true, statement_timestamp() - interval '1 day'
from platform.customer_workspaces w where w.id in
  ('f1010000-0000-4000-8000-000000000061', 'f1010000-0000-4000-8000-000000000062', 'f1010000-0000-4000-8000-000000000063');
insert into platform.workspace_entitlements(customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from)
values ('f1010000-0000-4000-8000-000000000061', 'module.services_catalog', 'boolean', true, statement_timestamp() - interval '1 day');

insert into platform.workspace_roles(id, tenant_id, customer_workspace_id, code, name, scope_ceiling, created_by, valid_from) values
  ('f1010000-0000-4000-8000-0000000000a1', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000061', 'pf01_one', 'PF01 one', 'workspace', 'f1010000-0000-4000-8000-000000000001', statement_timestamp() - interval '1 day'),
  ('f1010000-0000-4000-8000-0000000000a2', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000062', 'pf01_two', 'PF01 two', 'workspace', 'f1010000-0000-4000-8000-000000000001', statement_timestamp() - interval '1 day'),
  ('f1010000-0000-4000-8000-0000000000a3', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000063', 'pf01_old', 'PF01 old', 'workspace', 'f1010000-0000-4000-8000-000000000001', statement_timestamp() - interval '1 day');
insert into platform.workspace_role_modules(tenant_id, workspace_role_id, module_definition_id)
select 'f1010000-0000-4000-8000-000000000020', r.id, m.id
from platform.workspace_roles r cross join platform.module_definitions m
where r.id in ('f1010000-0000-4000-8000-0000000000a1', 'f1010000-0000-4000-8000-0000000000a2', 'f1010000-0000-4000-8000-0000000000a3')
  and m.code = 'core_unit_identity';
insert into platform.workspace_role_modules(tenant_id, workspace_role_id, module_definition_id)
select 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-0000000000a1', m.id
from platform.module_definitions m where m.code = 'services_catalog';
insert into platform.workspace_role_permissions(tenant_id, workspace_role_id, permission_id, effect)
select 'f1010000-0000-4000-8000-000000000020', r.id, p.id, 'allow'
from platform.workspace_roles r cross join identity.permissions p
where r.id in ('f1010000-0000-4000-8000-0000000000a1', 'f1010000-0000-4000-8000-0000000000a2', 'f1010000-0000-4000-8000-0000000000a3')
  and p.code = 'core.units.identity.read';
insert into platform.workspace_role_permissions(tenant_id, workspace_role_id, permission_id, effect)
select 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-0000000000a1', p.id, 'allow'
from identity.permissions p where p.code = 'services.catalog.read';
update platform.workspace_roles set lifecycle_status = 'published', lock_version = 2
where id in ('f1010000-0000-4000-8000-0000000000a1', 'f1010000-0000-4000-8000-0000000000a2', 'f1010000-0000-4000-8000-0000000000a3');
insert into platform.workspace_member_roles(
  tenant_id, customer_workspace_id, membership_id, workspace_role_id, scope_type,
  assigned_by_user_id, assigned_by_membership_id, reason, valid_from
) values
  ('f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000061', 'f1010000-0000-4000-8000-000000000091', 'f1010000-0000-4000-8000-0000000000a1', 'workspace', 'f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-000000000091', 'PF01 workspace one', statement_timestamp() - interval '1 hour'),
  ('f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000062', 'f1010000-0000-4000-8000-000000000091', 'f1010000-0000-4000-8000-0000000000a2', 'workspace', 'f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-000000000091', 'PF01 workspace two', statement_timestamp() - interval '1 hour'),
  ('f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000063', 'f1010000-0000-4000-8000-000000000091', 'f1010000-0000-4000-8000-0000000000a3', 'workspace', 'f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-000000000091', 'PF01 expired workspace', statement_timestamp() - interval '1 hour');

insert into platform.workspace_property_authorities(
  id, tenant_id, property_id, customer_workspace_id, purpose, authority_source,
  evidence_reference, valid_from, valid_to
) values
  ('f1010000-0000-4000-8000-0000000000e1', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000031', 'f1010000-0000-4000-8000-000000000061', 'property_operations', 'fixture', 'test://pf01/mandate/one', statement_timestamp() - interval '2 days', null),
  ('f1010000-0000-4000-8000-0000000000e2', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000032', 'f1010000-0000-4000-8000-000000000062', 'property_operations', 'fixture', 'test://pf01/mandate/two', statement_timestamp() - interval '2 days', null),
  ('f1010000-0000-4000-8000-0000000000e3', 'f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000033', 'f1010000-0000-4000-8000-000000000063', 'property_operations', 'fixture', 'test://pf01/mandate/expired', statement_timestamp() - interval '2 days', statement_timestamp() - interval '1 day');

insert into portfolio.unit_specification_versions(
  tenant_id, unit_id, version, building_id, unit_code, source_reference, recorded_by, customer_workspace_id
) values
  ('f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000051', 1, 'f1010000-0000-4000-8000-000000000041', 'A-01', 'test://pf01/a/v1', 'f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-000000000061'),
  ('f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000051', 2, 'f1010000-0000-4000-8000-000000000041', 'A-01', 'test://pf01/a/v2', 'f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-000000000061'),
  ('f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000052', 1, 'f1010000-0000-4000-8000-000000000042', 'B-02', 'test://pf01/b/v1', 'f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-000000000062'),
  ('f1010000-0000-4000-8000-000000000020', 'f1010000-0000-4000-8000-000000000053', 1, 'f1010000-0000-4000-8000-000000000043', 'C-03', 'test://pf01/c/v1', 'f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-000000000063');

insert into platform.owner_unit_links(
  id, owner_user_id, private_unit_id, workspace_id, canonical_unit_id, ownership_party_id,
  evidence_reference, status, manager_verified_by, manager_verified_at, approved_by, approved_at, approval_reason
) values
  ('f1010000-0000-4000-8000-0000000000c1', 'f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-0000000000b1', 'f1010000-0000-4000-8000-000000000061', 'f1010000-0000-4000-8000-000000000051', 'f1010000-0000-4000-8000-000000000071', 'private evidence must not leak one', 'linked', 'f1010000-0000-4000-8000-000000000001', statement_timestamp(), 'f1010000-0000-4000-8000-000000000001', statement_timestamp(), 'PF01 approved fixture one'),
  ('f1010000-0000-4000-8000-0000000000c2', 'f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-0000000000b2', 'f1010000-0000-4000-8000-000000000062', 'f1010000-0000-4000-8000-000000000052', 'f1010000-0000-4000-8000-000000000071', 'private evidence must not leak two', 'linked', 'f1010000-0000-4000-8000-000000000001', statement_timestamp(), 'f1010000-0000-4000-8000-000000000001', statement_timestamp(), 'PF01 approved fixture two'),
  ('f1010000-0000-4000-8000-0000000000c3', 'f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-0000000000b3', 'f1010000-0000-4000-8000-000000000063', 'f1010000-0000-4000-8000-000000000053', 'f1010000-0000-4000-8000-000000000071', 'expired management evidence', 'linked', 'f1010000-0000-4000-8000-000000000001', statement_timestamp(), 'f1010000-0000-4000-8000-000000000001', statement_timestamp(), 'PF01 approved fixture expired'),
  ('f1010000-0000-4000-8000-0000000000c4', 'f1010000-0000-4000-8000-000000000002', 'f1010000-0000-4000-8000-0000000000b4', 'f1010000-0000-4000-8000-000000000061', 'f1010000-0000-4000-8000-000000000051', 'f1010000-0000-4000-8000-000000000071', 'other owner evidence secret', 'linked', 'f1010000-0000-4000-8000-000000000001', statement_timestamp(), 'f1010000-0000-4000-8000-000000000001', statement_timestamp(), 'PF01 other approved fixture'),
  ('f1010000-0000-4000-8000-0000000000c5', 'f1010000-0000-4000-8000-000000000001', 'f1010000-0000-4000-8000-0000000000b3', 'f1010000-0000-4000-8000-000000000061', 'f1010000-0000-4000-8000-000000000054', 'f1010000-0000-4000-8000-000000000073', 'cross tenant evidence secret', 'linked', 'f1010000-0000-4000-8000-000000000001', statement_timestamp(), 'f1010000-0000-4000-8000-000000000001', statement_timestamp(), 'PF01 cross approved fixture');

select throws_ok(
  $$select customer_api.list_my_owner_portfolio_projections_v1('{}')$$,
  '42501', 'pf01_owner_portfolio_access_denied',
  'unauthenticated PF01 caller is denied'
);
select set_config('request.jwt.claims',
  '{"sub":"f1010000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2"}', true);
select throws_ok(
  $$select customer_api.list_my_owner_portfolio_projections_v1('[]')$$,
  '22023', 'pf01_owner_portfolio_input_invalid',
  'PF01 rejects an invalid version map'
);

create temp table pf01_result as
select customer_api.list_my_owner_portfolio_projections_v1('{}') as value;
select is(jsonb_array_length(value), 2, 'one owner sees units in two current Workspaces') from pf01_result;
select is((select sum(jsonb_array_length(p->'items'))::integer from pf01_result, jsonb_array_elements(value) p), 2,
  'multi-Workspace projection contains exactly the two owned canonical Units');
select ok(not (value::text like '%f1010000-0000-4000-8000-000000000054%'),
  'cross-tenant Unit is not disclosed') from pf01_result;
select ok(not (value::text like '%Secret Other%' or value::text like '%other owner evidence secret%'),
  'another owner private data is not disclosed') from pf01_result;
select ok(not (value::text like '%Private-A%' or value::text like '%Private owner address%' or value::text like '%private evidence must not leak%'),
  'private book labels, addresses and evidence never mix into the official projection') from pf01_result;
select is(
  (select count(*)::integer from pf01_result, jsonb_array_elements(value) p,
    jsonb_array_elements(p->'items') i
   where i->'resource'->'source'->>'source_class' = 'official_workspace_record'),
  2, 'all visible resources declare the official Workspace source'
);
select is(
  (select i->'actions'->0->>'action_status' from pf01_result, jsonb_array_elements(value) p,
    jsonb_array_elements(p->'items') i
   where p->>'portfolio_workspace_id' = 'f1010000-0000-4000-8000-000000000061'),
  'allowed', 'accepted PC01 capability plus AUTH01 exposes navigation'
);
select is(
  (select i->'actions'->0->>'href' from pf01_result, jsonb_array_elements(value) p,
    jsonb_array_elements(p->'items') i
   where p->>'portfolio_workspace_id' = 'f1010000-0000-4000-8000-000000000061'),
  '/app/services', 'allowed action is a relative navigation link only'
);
select is(
  (select i->'actions'->0->>'action_status' from pf01_result, jsonb_array_elements(value) p,
    jsonb_array_elements(p->'items') i
   where p->>'portfolio_workspace_id' = 'f1010000-0000-4000-8000-000000000062'),
  'withheld', 'missing PC01 capability yields no guessed action'
);
select ok(not (select value::text like '%f1010000-0000-4000-8000-000000000063%' from pf01_result),
  'expired management mandate withholds its Workspace and Unit');
select is(
  (select i->'resource'->'canonical_reference'->>'reference_status'
   from jsonb_array_elements(customer_api.list_my_owner_portfolio_projections_v1(
     '{"f1010000-0000-4000-8000-000000000051":1}'::jsonb)) p,
     jsonb_array_elements(p->'items') i
   where i->'resource'->'canonical_reference'->>'resource_id' = 'f1010000-0000-4000-8000-000000000051'),
  'stale', 'invalid expected Unit version is explicitly stale'
);
select is(
  (select i->'actions'->0->>'action_status'
   from jsonb_array_elements(customer_api.list_my_owner_portfolio_projections_v1(
     '{"f1010000-0000-4000-8000-000000000051":1}'::jsonb)) p,
     jsonb_array_elements(p->'items') i
   where i->'resource'->'canonical_reference'->>'resource_id' = 'f1010000-0000-4000-8000-000000000051'),
  'withheld', 'stale canonical version cannot carry an action link'
);

create temp table pf01_counts as select
  (select count(*) from platform.owner_unit_links) links,
  (select count(*) from portfolio.ownerships) ownerships,
  (select count(*) from public.owner_private_units) private_units;
select customer_api.list_my_owner_portfolio_projections_v1('{}') from generate_series(1, 3);
select is(
  (select row(links, ownerships, private_units)::text from pf01_counts),
  (select row((select count(*) from platform.owner_unit_links),
              (select count(*) from portfolio.ownerships),
              (select count(*) from public.owner_private_units))::text),
  'projection is zero-write across repeated reads'
);

update platform.owner_unit_links
set status = 'revoked', revoked_by = 'f1010000-0000-4000-8000-000000000001',
  revoked_at = statement_timestamp(), revoke_reason = 'PF01 replay test'
where id = 'f1010000-0000-4000-8000-0000000000c2';
select is(jsonb_array_length(customer_api.list_my_owner_portfolio_projections_v1('{}')), 1,
  'link revocation removes its Workspace projection');
select is(jsonb_array_length(customer_api.list_my_owner_portfolio_projections_v1(
  '{"f1010000-0000-4000-8000-000000000052":1}'::jsonb)), 1,
  'replaying an old Unit version after revoke cannot restore access');

update platform.workspace_property_authorities
set status = 'revoked', revoked_at = statement_timestamp(), valid_to = statement_timestamp(),
  revocation_reason = 'PF01 management revoked'
where id = 'f1010000-0000-4000-8000-0000000000e1';
select is(jsonb_array_length(customer_api.list_my_owner_portfolio_projections_v1('{}')), 0,
  'management revocation removes the remaining official projection');
select is(
  (select count(*)::integer from portfolio.ownerships
   where party_id = 'f1010000-0000-4000-8000-000000000071'
     and valid_to is null),
  3, 'ownership remains independent after management revocation'
);
select is(
  (select count(*)::integer from public.owner_private_units
   where owner_user_id = 'f1010000-0000-4000-8000-000000000001'),
  3, 'private owner book remains independent after official authority revocation'
);

select * from finish();
rollback;
