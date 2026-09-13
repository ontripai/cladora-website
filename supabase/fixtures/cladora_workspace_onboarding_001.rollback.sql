-- CLADORA-WORKSPACE-ONBOARDING-001 controlled cleanup.
-- Deletes only the deterministic synthetic tenant; tenant cascades/references
-- remove the fixture-owned workspace rows. The Auth user is never deleted.

begin;

delete from identity.context_grants
where id = '80000000-0000-0000-0000-000000000004';

delete from platform.customer_workspaces
where id = '80000000-0000-0000-0000-000000000002'
  and tenant_id = '80000000-0000-0000-0000-000000000001';

delete from identity.memberships
where id = '80000000-0000-0000-0000-000000000003'
  and tenant_id = '80000000-0000-0000-0000-000000000001';

delete from portfolio.units
where id = '80000000-0000-0000-0000-000000000007'
  and tenant_id = '80000000-0000-0000-0000-000000000001';

delete from portfolio.buildings
where id = '80000000-0000-0000-0000-000000000006'
  and tenant_id = '80000000-0000-0000-0000-000000000001';

delete from portfolio.properties
where id = '80000000-0000-0000-0000-000000000005'
  and tenant_id = '80000000-0000-0000-0000-000000000001';

delete from platform.tenants
where id = '80000000-0000-0000-0000-000000000001'
  and registration_number = 'CLADORA-WORKSPACE-ONBOARDING-001-FIXTURE';

commit;
