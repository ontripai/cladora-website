-- Test 080: CLADORA-WORKSPACE-ONBOARDING-001
-- All synthetic rows are transaction-only and roll back.
begin;
select plan(12);

insert into auth.users (id, email)
values
  ('80100000-0000-0000-0000-000000000001', 'workspace-owner-080@cladora.test'),
  ('80100000-0000-0000-0000-000000000002', 'workspace-outsider-080@cladora.test');

insert into platform.tenants (id, legal_name, registration_number, status)
values ('80200000-0000-0000-0000-000000000001', 'Synthetic Workspace 080', 'WORKSPACE-080', 'active');

insert into identity.memberships (id, tenant_id, user_id, role_id, status)
select
  '80300000-0000-0000-0000-000000000001',
  '80200000-0000-0000-0000-000000000001',
  '80100000-0000-0000-0000-000000000001',
  id,
  'active'
from identity.roles
where tenant_id is null and lower(code) = 'association_admin';

insert into platform.customer_workspaces (
  id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version,
  activated_at, primary_admin_user_id, primary_admin_membership_id, primary_admin_accepted_at,
  onboarding_completed_at, onboarding_completed_by
) values (
  '80400000-0000-0000-0000-000000000001',
  '80200000-0000-0000-0000-000000000001',
  'ASSOCIATION', 'ACTIVE', 'Synthetic Test 080', 'PILOT', 1, statement_timestamp(),
  '80100000-0000-0000-0000-000000000001',
  '80300000-0000-0000-0000-000000000001',
  statement_timestamp(), statement_timestamp(),
  '80100000-0000-0000-0000-000000000001'
);

insert into identity.context_grants (id, membership_id, tenant_id, scope_type)
values (
  '80500000-0000-0000-0000-000000000001',
  '80300000-0000-0000-0000-000000000001',
  '80200000-0000-0000-0000-000000000001',
  'tenant'
);

insert into portfolio.properties (id, tenant_id, type, name, status)
values ('80600000-0000-0000-0000-000000000001', '80200000-0000-0000-0000-000000000001', 'condominium', 'Synthetic Property 080', 'active');
insert into portfolio.buildings (id, tenant_id, property_id, code, name, status)
values ('80700000-0000-0000-0000-000000000001', '80200000-0000-0000-0000-000000000001', '80600000-0000-0000-0000-000000000001', 'B080', 'Synthetic Building 080', 'active');
insert into portfolio.units (id, tenant_id, building_id, code, status)
values ('80800000-0000-0000-0000-000000000001', '80200000-0000-0000-0000-000000000001', '80700000-0000-0000-0000-000000000001', 'U080', 'active');

insert into platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value)
select '80400000-0000-0000-0000-000000000001', x, 'boolean', true
from unnest(array[
  'module.accounting', 'module.billing', 'module.payments', 'module.utilities',
  'module.maintenance', 'module.governance', 'module.communications',
  'module.documents', 'module.occupancy', 'module.security'
]) x;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"80100000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"80200000-0000-0000-0000-000000000001","active_context_id":"80500000-0000-0000-0000-000000000001"}',
  true
);

select ok((select count(*) from customer_api.list_contexts_v1()) = 1, 'one active context is visible');
select ok((select role_code from customer_api.list_contexts_v1()) = 'association_admin', 'association_admin role is authoritative');
select ok((select scope_type from customer_api.list_contexts_v1()) = 'tenant', 'context is tenant-scoped');
select ok(customer_api.get_dashboard_v1('80500000-0000-0000-0000-000000000001')->>'persona' = 'association_admin', 'dashboard persona matches role');
select ok(customer_api.get_dashboard_v1('80500000-0000-0000-0000-000000000001')->>'workspace_id' = '80400000-0000-0000-0000-000000000001', 'active pilot workspace resolves');
select ok((customer_api.get_dashboard_v1('80500000-0000-0000-0000-000000000001')->'kpis'->>'properties')::integer = 1, 'synthetic property is counted');
select ok((customer_api.get_dashboard_v1('80500000-0000-0000-0000-000000000001')->'kpis'->>'buildings')::integer = 1, 'synthetic building is counted');
select ok((customer_api.get_dashboard_v1('80500000-0000-0000-0000-000000000001')->'kpis'->>'units')::integer = 1, 'synthetic unit is counted');
select ok(customer_api.get_dashboard_v1('80500000-0000-0000-0000-000000000001')->'modules' ? 'dashboard', 'dashboard module is always present');
select ok(customer_api.get_dashboard_v1('80500000-0000-0000-0000-000000000001')->'modules' ? 'accounting', 'enabled accounting module is exposed');

select set_config(
  'request.jwt.claims',
  '{"sub":"80100000-0000-0000-0000-000000000002","aal":"aal2","active_tenant_id":"80200000-0000-0000-0000-000000000001"}',
  true
);
select ok((select count(*) from customer_api.list_contexts_v1()) = 0, 'outsider sees no context');
select throws_ok(
  $$select customer_api.get_dashboard_v1('80500000-0000-0000-0000-000000000001')$$,
  '42501',
  'customer_context_access_denied',
  'outsider cannot load the dashboard'
);

select * from finish();
rollback;
