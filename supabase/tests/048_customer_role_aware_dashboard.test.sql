begin;
select plan(55);

select ok(to_regprocedure('platform.get_customer_dashboard(uuid)') is not null, 'platform.get_customer_dashboard RPC exists');
select ok(has_function_privilege('authenticated', 'platform.get_customer_dashboard(uuid)', 'EXECUTE'), 'authenticated may execute dashboard RPC');
select ok(not has_function_privilege('anon', 'platform.get_customer_dashboard(uuid)', 'EXECUTE'), 'anon is revoked from executing dashboard RPC');

do $$
declare
  perm_assets uuid;
  perm_procurement uuid;
  perm_billing uuid;
  perm_governance uuid;
  perm_accounting uuid;
  perm_utilities uuid;
  perm_audit uuid;
begin
  -- 1. Users
  insert into auth.users (id, email) values
    ('21000000-0000-0000-0000-000000000001', 'admin-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000002', 'manager-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000003', 'president-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000004', 'censor-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000005', 'owner1-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000006', 'owner2-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000007', 'tenant1-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000008', 'tenant2-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000009', 'contractor-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000010', 'inactive-mem-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000011', 'expired-mem-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000012', 'owner-expired-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000013', 'tenant-expired-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000014', 'owner-noparty-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000020', 'tenant-b-admin-048@cladora.test'),
    ('21000000-0000-0000-0000-000000000030', 'tenant-gamma-admin-048@cladora.test');

  -- 2. Tenants
  insert into platform.tenants (id, legal_name, registration_number, status) values
    ('21100000-0000-0000-0000-000000000001', 'Tenant Alpha', 'RO-ENG-048-A', 'active'),
    ('21100000-0000-0000-0000-000000000002', 'Tenant Beta', 'RO-ENG-048-B', 'active'),
    ('21100000-0000-0000-0000-000000000003', 'Tenant Gamma', 'RO-ENG-048-G', 'active');

  -- 3. Workspaces
  insert into platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version) values
    ('21800000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000001', 'ASSOCIATION', 'ACTIVE', 'Admin Alpha', 'PILOT', 1),
    ('21800000-0000-0000-0000-000000000002', '21100000-0000-0000-0000-000000000002', 'ASSOCIATION', 'ACTIVE', 'Admin Beta', 'PILOT', 1),
    ('21800000-0000-0000-0000-000000000003', '21100000-0000-0000-0000-000000000003', 'ASSOCIATION', 'SUSPENDED', 'Admin Gamma', 'PILOT', 1);

  -- 4. Entitlements with Override Scenarios
  insert into platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from, valid_until, override_value_json, override_expires_at) values
    ('21800000-0000-0000-0000-000000000001', 'module.maintenance', 'boolean', true, statement_timestamp() - interval '1 day', null, null, null),
    ('21800000-0000-0000-0000-000000000001', 'module.billing', 'boolean', true, statement_timestamp() - interval '1 day', null, null, null),
    ('21800000-0000-0000-0000-000000000001', 'module.governance', 'boolean', true, statement_timestamp() - interval '1 day', null, null, null),
    ('21800000-0000-0000-0000-000000000001', 'module.accounting', 'boolean', true, statement_timestamp() - interval '1 day', null, null, null),
    ('21800000-0000-0000-0000-000000000001', 'module.utilities', 'boolean', true, statement_timestamp() - interval '1 day', null, null, null),
    -- Disabled: boolean_value = false
    ('21800000-0000-0000-0000-000000000001', 'module.disabled_mod', 'boolean', false, statement_timestamp() - interval '1 day', null, null, null),
    -- Valid Override TRUE: boolean_value = false, override = true
    ('21800000-0000-0000-0000-000000000001', 'module.override_true', 'boolean', false, statement_timestamp() - interval '1 day', null, 'true'::jsonb, statement_timestamp() + interval '1 day'),
    -- Valid Override FALSE: boolean_value = true, override = false
    ('21800000-0000-0000-0000-000000000001', 'module.override_false', 'boolean', true, statement_timestamp() - interval '1 day', null, 'false'::jsonb, statement_timestamp() + interval '1 day'),
    -- Expired Override: boolean_value = true, override = false, but expired!
    ('21800000-0000-0000-0000-000000000001', 'module.override_expired', 'boolean', true, statement_timestamp() - interval '1 day', null, 'false'::jsonb, statement_timestamp() - interval '1 hour'),
    -- Expired Entitlement: valid_until in the past
    ('21800000-0000-0000-0000-000000000001', 'module.expired_ent', 'boolean', true, statement_timestamp() - interval '2 days', statement_timestamp() - interval '1 day', null, null),
    -- Other Workspace Entitlement: belongs to Tenant Beta
    ('21800000-0000-0000-0000-000000000002', 'module.other_workspace', 'boolean', true, statement_timestamp() - interval '1 day', null, null, null);

  -- 5. Roles
  insert into identity.roles (id, tenant_id, code, name) values
    ('21200000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000001', 'association_admin', 'Admin Alpha'),
    ('21200000-0000-0000-0000-000000000002', '21100000-0000-0000-0000-000000000001', 'property_manager', 'Manager Alpha'),
    ('21200000-0000-0000-0000-000000000003', '21100000-0000-0000-0000-000000000001', 'president', 'President Alpha'),
    ('21200000-0000-0000-0000-000000000004', '21100000-0000-0000-0000-000000000001', 'censor', 'Censor Alpha'),
    ('21200000-0000-0000-0000-000000000005', '21100000-0000-0000-0000-000000000001', 'owner', 'Owner Alpha'),
    ('21200000-0000-0000-0000-000000000006', '21100000-0000-0000-0000-000000000001', 'tenant_resident', 'Tenant Alpha'),
    ('21200000-0000-0000-0000-000000000007', '21100000-0000-0000-0000-000000000001', 'contractor', 'Contractor Unknown'),
    ('21200000-0000-0000-0000-000000000020', '21100000-0000-0000-0000-000000000002', 'association_admin', 'Admin Beta'),
    ('21200000-0000-0000-0000-000000000030', '21100000-0000-0000-0000-000000000003', 'association_admin', 'Admin Gamma');

  -- 6. Permissions and Role Assignments
  select id into perm_assets from identity.permissions where code = 'maintenance.assets.read';
  select id into perm_procurement from identity.permissions where code = 'maintenance.procurement.read';
  select id into perm_billing from identity.permissions where code = 'billing.receivables.read';
  select id into perm_governance from identity.permissions where code = 'governance.meetings.read';
  select id into perm_accounting from identity.permissions where code = 'finance.ledger.read';
  select id into perm_utilities from identity.permissions where code = 'utilities.metering.read';
  select id into perm_audit from identity.permissions where code = 'audit.events.read';

  -- Admin permissions
  insert into identity.role_permissions (role_id, permission_id, effect) values
    ('21200000-0000-0000-0000-000000000001', perm_assets, 'allow'),
    ('21200000-0000-0000-0000-000000000001', perm_billing, 'allow'),
    ('21200000-0000-0000-0000-000000000001', perm_audit, 'allow');

  -- Manager permissions (no audit permission)
  insert into identity.role_permissions (role_id, permission_id, effect) values
    ('21200000-0000-0000-0000-000000000002', perm_assets, 'allow'),
    ('21200000-0000-0000-0000-000000000002', perm_billing, 'allow');

  -- President permissions
  insert into identity.role_permissions (role_id, permission_id, effect) values
    ('21200000-0000-0000-0000-000000000003', perm_governance, 'allow'),
    ('21200000-0000-0000-0000-000000000003', perm_billing, 'allow');

  -- Censor permissions
  insert into identity.role_permissions (role_id, permission_id, effect) values
    ('21200000-0000-0000-0000-000000000004', perm_accounting, 'allow');

  -- Owner permissions
  insert into identity.role_permissions (role_id, permission_id, effect) values
    ('21200000-0000-0000-0000-000000000005', perm_billing, 'allow');

  -- Tenant permissions
  insert into identity.role_permissions (role_id, permission_id, effect) values
    ('21200000-0000-0000-0000-000000000006', perm_billing, 'allow'),
    ('21200000-0000-0000-0000-000000000006', perm_utilities, 'allow');

  -- Beta Admin permissions
  insert into identity.role_permissions (role_id, permission_id, effect) values
    ('21200000-0000-0000-0000-000000000020', perm_assets, 'allow'),
    ('21200000-0000-0000-0000-000000000020', perm_billing, 'allow');

  -- 7. Memberships
  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at, ends_at) values
    ('21300000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '21200000-0000-0000-0000-000000000001', 'active', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000002', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000002', '21200000-0000-0000-0000-000000000002', 'active', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000003', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000003', '21200000-0000-0000-0000-000000000003', 'active', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000004', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000004', '21200000-0000-0000-0000-000000000004', 'active', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000005', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000005', '21200000-0000-0000-0000-000000000005', 'active', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000006', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000006', '21200000-0000-0000-0000-000000000005', 'active', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000007', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000007', '21200000-0000-0000-0000-000000000006', 'active', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000008', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000008', '21200000-0000-0000-0000-000000000006', 'active', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000009', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000009', '21200000-0000-0000-0000-000000000007', 'active', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000010', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000010', '21200000-0000-0000-0000-000000000001', 'suspended', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000011', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000011', '21200000-0000-0000-0000-000000000001', 'active', statement_timestamp() - interval '10 days', statement_timestamp() - interval '1 day'),
    ('21300000-0000-0000-0000-000000000012', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000012', '21200000-0000-0000-0000-000000000005', 'active', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000013', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000013', '21200000-0000-0000-0000-000000000006', 'active', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000014', '21100000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000014', '21200000-0000-0000-0000-000000000005', 'active', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000020', '21100000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000020', '21200000-0000-0000-0000-000000000020', 'active', statement_timestamp() - interval '1 day', null),
    ('21300000-0000-0000-0000-000000000030', '21100000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000030', '21200000-0000-0000-0000-000000000030', 'active', statement_timestamp() - interval '1 day', null);

  -- 8. Portfolio Structure: 2 Properties, 2 Buildings, 3 Units
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    ('21500000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000001', 'condominium', 'Property Alpha', 'active'),
    ('21500000-0000-0000-0000-000000000002', '21100000-0000-0000-0000-000000000002', 'condominium', 'Property Beta', 'active');

  insert into portfolio.buildings (id, tenant_id, property_id, code, name, status) values
    ('21600000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000001', '21500000-0000-0000-0000-000000000001', 'BA1', 'Building Alpha 1', 'active'),
    ('21600000-0000-0000-0000-000000000002', '21100000-0000-0000-0000-000000000002', '21500000-0000-0000-0000-000000000002', 'BB1', 'Building Beta 1', 'active');

  insert into portfolio.units (id, tenant_id, building_id, code, status) values
    ('21700000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000001', '21600000-0000-0000-0000-000000000001', 'UA1', 'active'),
    ('21700000-0000-0000-0000-000000000002', '21100000-0000-0000-0000-000000000001', '21600000-0000-0000-0000-000000000001', 'UA2', 'active'),
    ('21700000-0000-0000-0000-000000000003', '21100000-0000-0000-0000-000000000002', '21600000-0000-0000-0000-000000000002', 'UB1', 'active'),
    ('21700000-0000-0000-0000-000000000004', '21100000-0000-0000-0000-000000000001', '21600000-0000-0000-0000-000000000001', 'UA3', 'active'),
    ('21700000-0000-0000-0000-000000000005', '21100000-0000-0000-0000-000000000001', '21600000-0000-0000-0000-000000000001', 'UA4', 'active');

  -- 9. Parties and Party Mappings
  insert into portfolio.parties (id, tenant_id, type, legal_name) values
    ('21900000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000001', 'person', 'Owner Alpha 1 Party'),
    ('21900000-0000-0000-0000-000000000002', '21100000-0000-0000-0000-000000000001', 'person', 'Owner Alpha 2 Party'),
    ('21900000-0000-0000-0000-000000000003', '21100000-0000-0000-0000-000000000001', 'person', 'Tenant Alpha 1 Party'),
    ('21900000-0000-0000-0000-000000000004', '21100000-0000-0000-0000-000000000001', 'person', 'Tenant Alpha 2 Party'),
    ('21900000-0000-0000-0000-000000000005', '21100000-0000-0000-0000-000000000001', 'person', 'Owner Expired Party'),
    ('21900000-0000-0000-0000-000000000006', '21100000-0000-0000-0000-000000000001', 'person', 'Tenant Expired Party');

  insert into identity.membership_parties (membership_id, tenant_id, party_id) values
    ('21300000-0000-0000-0000-000000000005', '21100000-0000-0000-0000-000000000001', '21900000-0000-0000-0000-000000000001'),
    ('21300000-0000-0000-0000-000000000006', '21100000-0000-0000-0000-000000000001', '21900000-0000-0000-0000-000000000002'),
    ('21300000-0000-0000-0000-000000000007', '21100000-0000-0000-0000-000000000001', '21900000-0000-0000-0000-000000000003'),
    ('21300000-0000-0000-0000-000000000008', '21100000-0000-0000-0000-000000000001', '21900000-0000-0000-0000-000000000004'),
    ('21300000-0000-0000-0000-000000000012', '21100000-0000-0000-0000-000000000001', '21900000-0000-0000-0000-000000000005'),
    ('21300000-0000-0000-0000-000000000013', '21100000-0000-0000-0000-000000000001', '21900000-0000-0000-0000-000000000006');

  -- 10. Ownerships
  insert into portfolio.ownerships (tenant_id, unit_id, party_id, share, valid_from, valid_to) values
    ('21100000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000001', '21900000-0000-0000-0000-000000000001', 1.0, current_date - 10, null),
    ('21100000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000002', '21900000-0000-0000-0000-000000000002', 1.0, current_date - 10, null),
    ('21100000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000004', '21900000-0000-0000-0000-000000000005', 1.0, current_date - 30, current_date - 5),
    ('21100000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000005', '21900000-0000-0000-0000-000000000001', 1.0, current_date - 40, null);

  -- 11. Leases
  insert into occupancy.leases (tenant_id, unit_id, landlord_party_id, tenant_party_id, starts_on, ends_on, status) values
    ('21100000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000001', '21900000-0000-0000-0000-000000000001', '21900000-0000-0000-0000-000000000003', current_date - 10, null, 'active'),
    ('21100000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000002', '21900000-0000-0000-0000-000000000002', '21900000-0000-0000-0000-000000000004', current_date - 10, null, 'active'),
    ('21100000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000005', '21900000-0000-0000-0000-000000000001', '21900000-0000-0000-0000-000000000006', current_date - 30, current_date - 5, 'active');

  -- 12. Invoices & Receivables
  insert into billing.invoices (id, tenant_id, property_id, unit_id, liable_party_id, period_start, period_end, due_on, currency, subtotal, tax_total, status) values
    ('21c00000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000001', '21500000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000001', '21900000-0000-0000-0000-000000000003', current_date - 30, current_date, current_date + 5, 'RON', 100, 0, 'issued'),
    ('21c00000-0000-0000-0000-000000000002', '21100000-0000-0000-0000-000000000001', '21500000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000002', '21900000-0000-0000-0000-000000000004', current_date - 30, current_date, current_date + 5, 'RON', 200, 0, 'issued'),
    ('21c00000-0000-0000-0000-000000000003', '21100000-0000-0000-0000-000000000002', '21500000-0000-0000-0000-000000000002', '21700000-0000-0000-0000-000000000003', null, current_date - 30, current_date, current_date + 5, 'RON', 500, 0, 'issued');

  insert into billing.receivables (tenant_id, invoice_id, original_amount, paid_amount) values
    ('21100000-0000-0000-0000-000000000001', '21c00000-0000-0000-0000-000000000001', 100, 25), -- 75 outstanding
    ('21100000-0000-0000-0000-000000000001', '21c00000-0000-0000-0000-000000000002', 200, 0),  -- 200 outstanding
    ('21100000-0000-0000-0000-000000000002', '21c00000-0000-0000-0000-000000000003', 500, 0);  -- 500 outstanding in Beta

  -- 13. Work Orders
  insert into maintenance.work_orders (id, tenant_id, property_id, building_id, unit_id, title, category, priority, status) values
    ('21d00000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000001', '21500000-0000-0000-0000-000000000001', '21600000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000001', 'Fix pipe in UA1', 'plumbing', 'high', 'in_progress'),
    ('21d00000-0000-0000-0000-000000000002', '21100000-0000-0000-0000-000000000001', '21500000-0000-0000-0000-000000000001', '21600000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000002', 'Fix door in UA2', 'general', 'medium', 'open'),
    ('21d00000-0000-0000-0000-000000000003', '21100000-0000-0000-0000-000000000002', '21500000-0000-0000-0000-000000000002', '21600000-0000-0000-0000-000000000002', '21700000-0000-0000-0000-000000000003', 'Beta work order', 'electrical', 'low', 'open');

  -- 14. Notifications
  insert into communications.notifications (id, tenant_id, membership_id, title, channel, priority) values
    ('21e00000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000001', '21300000-0000-0000-0000-000000000001', 'Admin Notice', 'in_app', 'normal'),
    ('21e00000-0000-0000-0000-000000000002', '21100000-0000-0000-0000-000000000001', '21300000-0000-0000-0000-000000000005', 'Owner Notice', 'in_app', 'normal');

  -- 15. Context Grants
  insert into identity.context_grants (id, membership_id, tenant_id, scope_type, property_id, building_id, unit_id, starts_at, ends_at) values
    -- association_admin: tenant scope
    ('21400000-0000-0000-0000-000000000001', '21300000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null),
    -- property_manager: tenant scope
    ('21400000-0000-0000-0000-000000000002', '21300000-0000-0000-0000-000000000002', '21100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null),
    -- president: tenant scope
    ('21400000-0000-0000-0000-000000000003', '21300000-0000-0000-0000-000000000003', '21100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null),
    -- censor: tenant scope
    ('21400000-0000-0000-0000-000000000004', '21300000-0000-0000-0000-000000000004', '21100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null),
    -- owner 1: unit scope (UA1)
    ('21400000-0000-0000-0000-000000000005', '21300000-0000-0000-0000-000000000005', '21100000-0000-0000-0000-000000000001', 'unit', '21500000-0000-0000-0000-000000000001', '21600000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day', null),
    -- owner 1 malformed: property scope (should be rejected)
    ('21400000-0000-0000-0000-000000000051', '21300000-0000-0000-0000-000000000005', '21100000-0000-0000-0000-000000000001', 'property', '21500000-0000-0000-0000-000000000001', null, null, statement_timestamp() - interval '1 day', null),
    -- owner 1 mismatched: unit scope with UA2 (which belongs to Owner 2)
    ('21400000-0000-0000-0000-000000000052', '21300000-0000-0000-0000-000000000005', '21100000-0000-0000-0000-000000000001', 'unit', '21500000-0000-0000-0000-000000000001', '21600000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000002', statement_timestamp() - interval '1 day', null),
    -- tenant 1: unit scope (UA1)
    ('21400000-0000-0000-0000-000000000007', '21300000-0000-0000-0000-000000000007', '21100000-0000-0000-0000-000000000001', 'unit', '21500000-0000-0000-0000-000000000001', '21600000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day', null),
    -- tenant 1 malformed: property scope (should be rejected)
    ('21400000-0000-0000-0000-000000000071', '21300000-0000-0000-0000-000000000007', '21100000-0000-0000-0000-000000000001', 'property', '21500000-0000-0000-0000-000000000001', null, null, statement_timestamp() - interval '1 day', null),
    -- tenant 1 mismatched: unit scope with UA2 (which belongs to Tenant 2)
    ('21400000-0000-0000-0000-000000000072', '21300000-0000-0000-0000-000000000007', '21100000-0000-0000-0000-000000000001', 'unit', '21500000-0000-0000-0000-000000000001', '21600000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000002', statement_timestamp() - interval '1 day', null),
    -- contractor: unknown role
    ('21400000-0000-0000-0000-000000000009', '21300000-0000-0000-0000-000000000009', '21100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null),
    -- inactive membership context
    ('21400000-0000-0000-0000-000000000010', '21300000-0000-0000-0000-000000000010', '21100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null),
    -- expired membership context
    ('21400000-0000-0000-0000-000000000011', '21300000-0000-0000-0000-000000000011', '21100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '10 days', null),
    -- expired context grant
    ('21400000-0000-0000-0000-000000000015', '21300000-0000-0000-0000-000000000001', '21100000-0000-0000-0000-000000000001', 'tenant', null, null, null, statement_timestamp() - interval '5 days', statement_timestamp() - interval '1 day'),
    -- owner expired ownership
    ('21400000-0000-0000-0000-000000000012', '21300000-0000-0000-0000-000000000012', '21100000-0000-0000-0000-000000000001', 'unit', '21500000-0000-0000-0000-000000000001', '21600000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000004', statement_timestamp() - interval '1 day', null),
    -- tenant expired lease
    ('21400000-0000-0000-0000-000000000013', '21300000-0000-0000-0000-000000000013', '21100000-0000-0000-0000-000000000001', 'unit', '21500000-0000-0000-0000-000000000001', '21600000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000005', statement_timestamp() - interval '1 day', null),
    -- owner without party mapping
    ('21400000-0000-0000-0000-000000000014', '21300000-0000-0000-0000-000000000014', '21100000-0000-0000-0000-000000000001', 'unit', '21500000-0000-0000-0000-000000000001', '21600000-0000-0000-0000-000000000001', '21700000-0000-0000-0000-000000000001', statement_timestamp() - interval '1 day', null),
    -- Beta Admin Context
    ('21400000-0000-0000-0000-000000000020', '21300000-0000-0000-0000-000000000020', '21100000-0000-0000-0000-000000000002', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null),
    -- Gamma Admin Context (Suspended Workspace)
    ('21400000-0000-0000-0000-000000000030', '21300000-0000-0000-0000-000000000030', '21100000-0000-0000-0000-000000000003', 'tenant', null, null, null, statement_timestamp() - interval '1 day', null);
end $$;

set local role authenticated;

-- 1. Unauthenticated invocation is denied
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')$$,
  '%authentication_required%',
  'unauthenticated call is denied'
);

-- Set JWT for association_admin
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

-- 2. Association Admin Functional Execution
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')->>'version')::int = 1,
  'association_admin returns version 1 payload'
);
select ok(
  platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')->>'persona' = 'association_admin',
  'association_admin persona is accurate'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')->'sections') ? 'operations',
  'association_admin has operations section'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')->'sections') ? 'financials',
  'association_admin has financials section'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')->'sections') ? 'audit',
  'association_admin has audit section when permission is present'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')->'capabilities') ? 'can_view_audit',
  'association_admin has can_view_audit capability'
);
select ok(
  not ((platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')->'capabilities') ? 'can_manage_work_orders'),
  'association_admin does not receive unbacked mutating capability can_manage_work_orders'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')#>>'{kpis,outstanding_amount}')::numeric = 275,
  'association_admin aggregates only Tenant Alpha receivables (75 + 200 = 275), not Beta'
);

-- Set JWT for property_manager (Independent functional test)
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000002","role":"authenticated","aal":"aal2"}', true);

-- 3. Property Manager Independent Functional Test
select ok(
  platform.get_customer_dashboard('21400000-0000-0000-0000-000000000002')->>'persona' = 'property_manager',
  'property_manager persona is accurate'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000002')->'sections') ? 'operations',
  'property_manager has operations section'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000002')->'sections') ? 'financials',
  'property_manager has financials section'
);
select ok(
  not ((platform.get_customer_dashboard('21400000-0000-0000-0000-000000000002')->'sections') ? 'audit'),
  'property_manager without audit permission does not receive audit section'
);
select ok(
  not ((platform.get_customer_dashboard('21400000-0000-0000-0000-000000000002')->'capabilities') ? 'can_manage_work_orders'),
  'property_manager does not receive unbacked mutating capability'
);

-- Set JWT for president
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000003","role":"authenticated","aal":"aal2"}', true);

-- 4. President Functional Execution
select ok(
  platform.get_customer_dashboard('21400000-0000-0000-0000-000000000003')->>'persona' = 'president',
  'president persona is accurate'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000003')->'sections') ? 'governance',
  'president receives governance section'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000003')->'sections') ? 'financial_summary',
  'president receives financial_summary section'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000003')->'capabilities') ? 'is_read_only',
  'president receives is_read_only capability'
);

-- Set JWT for censor
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000004","role":"authenticated","aal":"aal2"}', true);

-- 5. Censor Functional Execution (Strict Read-Only)
select ok(
  platform.get_customer_dashboard('21400000-0000-0000-0000-000000000004')->>'persona' = 'censor',
  'censor persona is accurate'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000004')->'sections') ? 'financial_controls',
  'censor receives financial_controls section'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000004')->'capabilities') ? 'is_read_only',
  'censor is strictly read-only'
);
select ok(
  not ((platform.get_customer_dashboard('21400000-0000-0000-0000-000000000004')->'capabilities') ? 'can_manage_work_orders'),
  'censor has no mutating work order capability'
);

-- Set JWT for Owner 1 (Unit UA1)
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000005","role":"authenticated","aal":"aal2"}', true);

-- 6. Owner Isolation & Unit Scoping
select ok(
  platform.get_customer_dashboard('21400000-0000-0000-0000-000000000005')->>'persona' = 'owner',
  'owner persona is accurate'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000005')#>>'{kpis,my_units_count}')::int = 1,
  'owner 1 sees only 1 owned unit (UA1)'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000005')#>>'{kpis,outstanding_amount}')::numeric = 75,
  'owner 1 sees strictly UA1 outstanding receivables (75 RON), not UA2 (200 RON)'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000005')#>>'{kpis,my_open_requests}')::int = 1,
  'owner 1 sees strictly UA1 open work orders (1), not UA2'
);
select ok(
  not ((platform.get_customer_dashboard('21400000-0000-0000-0000-000000000005')->'sections') ? 'audit'),
  'owner does not receive audit section'
);

-- Owner rejections
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000051')$$,
  '%unit_context_required%',
  'owner with property scope is denied'
);
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000052')$$,
  '%ownership_required%',
  'owner with unit context of another unit is denied'
);

-- Set JWT for Tenant 1 (Unit UA1)
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000007","role":"authenticated","aal":"aal2"}', true);

-- 7. Tenant Resident Isolation & Unit Scoping
select ok(
  platform.get_customer_dashboard('21400000-0000-0000-0000-000000000007')->>'persona' = 'tenant_resident',
  'tenant_resident persona is accurate'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000007')#>>'{kpis,outstanding_amount}')::numeric = 75,
  'tenant 1 sees strictly UA1 liable charges (75 RON), not UA2'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000007')#>>'{kpis,my_open_tickets}')::int = 1,
  'tenant 1 sees strictly UA1 tickets (1), not UA2'
);
select ok(
  not ((platform.get_customer_dashboard('21400000-0000-0000-0000-000000000007')->'sections') ? 'my_voting'),
  'tenant does not receive owner voting section'
);
select ok(
  not ((platform.get_customer_dashboard('21400000-0000-0000-0000-000000000007')->'sections') ? 'audit'),
  'tenant does not receive audit section'
);

-- Tenant rejections
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000071')$$,
  '%unit_context_required%',
  'tenant with property scope is denied'
);
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000072')$$,
  '%active_lease_required%',
  'tenant with unit context of another unit is denied'
);

-- 8. Entitlement Evaluation & Override Semantics (evaluated using admin call)
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

select ok(
  not ((platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')->'entitlements') ? 'module.disabled_mod'),
  'entitlement with boolean_value = false is not active'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')->'entitlements') ? 'module.override_true',
  'entitlement with valid override true is active'
);
select ok(
  not ((platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')->'entitlements') ? 'module.override_false'),
  'entitlement with valid override false is inactive'
);
select ok(
  (platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')->'entitlements') ? 'module.override_expired',
  'entitlement with expired override falls back to boolean_value true'
);
select ok(
  not ((platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')->'entitlements') ? 'module.expired_ent'),
  'expired entitlement is not active'
);
select ok(
  not ((platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')->'entitlements') ? 'module.other_workspace'),
  'entitlement from another workspace is not applied'
);

-- 9. Tenant Isolation & Cross-Tenant Rejection
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000020')$$,
  '%customer_context_access_denied%',
  'tenant Alpha user cannot access Tenant Beta context'
);

select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000020","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000001')$$,
  '%customer_context_access_denied%',
  'tenant Beta user cannot access Tenant Alpha context'
);

-- 10. Additional Fail-Closed Checks
-- Unknown role rejection
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000009","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000009')$$,
  '%unknown_role%',
  'unknown role contractor is denied fail-closed'
);

-- Inactive membership rejection
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000010","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000010')$$,
  '%customer_context_access_denied%',
  'inactive membership is denied'
);

-- Expired membership rejection
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000011","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000011')$$,
  '%customer_context_access_denied%',
  'expired membership is denied'
);

-- Expired context grant rejection
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000015')$$,
  '%customer_context_access_denied%',
  'expired context grant is denied'
);

-- Owner expired ownership rejection
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000012","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000012')$$,
  '%ownership_required%',
  'owner with expired ownership is denied'
);

-- Tenant expired lease rejection
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000013","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000013')$$,
  '%active_lease_required%',
  'tenant with expired lease is denied'
);

-- Owner missing party mapping rejection
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000014","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000014')$$,
  '%resident_party_mapping_required%',
  'owner without party mapping is denied'
);

-- Inactive workspace rejection
select set_config('request.jwt.claims', '{"sub":"21000000-0000-0000-0000-000000000030","role":"authenticated","aal":"aal2"}', true);
select throws_like(
  $$select platform.get_customer_dashboard('21400000-0000-0000-0000-000000000030')$$,
  '%workspace_inactive%',
  'inactive workspace is denied fail-closed'
);

commit;
