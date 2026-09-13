-- CLADORA-WORKSPACE-ONBOARDING-001
-- Controlled, idempotent production-pilot fixture for an explicitly supplied Auth user.
-- This is operational DML, not a migration. It creates no real customer data.
-- Before execution, set the transaction/session setting `cladora.fixture_email`.

begin;

do $$
declare
  v_target_email text := nullif(trim(current_setting('cladora.fixture_email', true)), '');
  v_user_id uuid;
  v_role_id uuid;
  v_tenant_id constant uuid := '80000000-0000-0000-0000-000000000001';
  v_workspace_id constant uuid := '80000000-0000-0000-0000-000000000002';
  v_membership_id constant uuid := '80000000-0000-0000-0000-000000000003';
  v_context_id constant uuid := '80000000-0000-0000-0000-000000000004';
  v_property_id constant uuid := '80000000-0000-0000-0000-000000000005';
  v_building_id constant uuid := '80000000-0000-0000-0000-000000000006';
  v_unit_id constant uuid := '80000000-0000-0000-0000-000000000007';
  v_entitlement text;
begin
  if v_target_email is null then
    raise exception 'fixture_target_email_required' using errcode = '22023';
  end if;

  select id into strict v_user_id
  from auth.users
  where lower(email) = lower(v_target_email);

  select id into strict v_role_id
  from identity.roles
  where tenant_id is null and lower(code) = 'association_admin';

  insert into platform.tenants (
    id, legal_name, registration_number, status, default_locale, timezone
  ) values (
    v_tenant_id,
    'CLADORA Synthetic Pilot Association',
    'CLADORA-WORKSPACE-ONBOARDING-001-FIXTURE',
    'active',
    'ro',
    'Europe/Bucharest'
  )
  on conflict (id) do update set
    legal_name = excluded.legal_name,
    registration_number = excluded.registration_number,
    status = excluded.status,
    default_locale = excluded.default_locale,
    timezone = excluded.timezone,
    updated_at = statement_timestamp();

  insert into identity.memberships (
    id, tenant_id, user_id, role_id, status, starts_at, ends_at
  ) values (
    v_membership_id, v_tenant_id, v_user_id, v_role_id, 'active', statement_timestamp(), null
  )
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    user_id = excluded.user_id,
    role_id = excluded.role_id,
    status = excluded.status,
    starts_at = excluded.starts_at,
    ends_at = null,
    updated_at = statement_timestamp();

  insert into platform.customer_workspaces (
    id, tenant_id, workspace_type, lifecycle_status, commercial_owner,
    environment, version, activated_at,
    primary_admin_user_id, primary_admin_membership_id, primary_admin_accepted_at,
    onboarding_completed_at, onboarding_completed_by
  ) values (
    v_workspace_id, v_tenant_id, 'ASSOCIATION', 'ACTIVE',
    'CLADORA controlled synthetic fixture', 'PILOT', 1, statement_timestamp(),
    v_user_id, v_membership_id, statement_timestamp(),
    statement_timestamp(), v_user_id
  )
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    workspace_type = excluded.workspace_type,
    lifecycle_status = excluded.lifecycle_status,
    commercial_owner = excluded.commercial_owner,
    environment = excluded.environment,
    activated_at = coalesce(platform.customer_workspaces.activated_at, excluded.activated_at),
    primary_admin_user_id = excluded.primary_admin_user_id,
    primary_admin_membership_id = excluded.primary_admin_membership_id,
    primary_admin_accepted_at = coalesce(platform.customer_workspaces.primary_admin_accepted_at, excluded.primary_admin_accepted_at),
    onboarding_completed_at = coalesce(platform.customer_workspaces.onboarding_completed_at, excluded.onboarding_completed_at),
    onboarding_completed_by = excluded.onboarding_completed_by,
    updated_at = statement_timestamp();

  insert into identity.context_grants (
    id, membership_id, tenant_id, scope_type, starts_at, ends_at
  ) values (
    v_context_id, v_membership_id, v_tenant_id, 'tenant', statement_timestamp(), null
  )
  on conflict (id) do update set
    membership_id = excluded.membership_id,
    tenant_id = excluded.tenant_id,
    scope_type = excluded.scope_type,
    property_id = null,
    building_id = null,
    unit_id = null,
    starts_at = excluded.starts_at,
    ends_at = null;

  insert into portfolio.properties (id, tenant_id, type, name, base_currency, status)
  values (v_property_id, v_tenant_id, 'condominium', 'Synthetic Pilot Property', 'RON', 'active')
  on conflict (id) do update set name = excluded.name, status = excluded.status, updated_at = statement_timestamp();

  insert into portfolio.buildings (id, tenant_id, property_id, code, name, year_built, floors, status)
  values (v_building_id, v_tenant_id, v_property_id, 'SYN-001', 'Synthetic Pilot Building', 2026, 1, 'active')
  on conflict (id) do update set name = excluded.name, status = excluded.status, updated_at = statement_timestamp();

  insert into portfolio.units (id, tenant_id, building_id, code, floor, area_m2, bedrooms, status)
  values (v_unit_id, v_tenant_id, v_building_id, 'SYN-UNIT-001', 0, 50, 1, 'active')
  on conflict (id) do update set area_m2 = excluded.area_m2, status = excluded.status, updated_at = statement_timestamp();

  foreach v_entitlement in array array[
    'module.accounting', 'module.billing', 'module.payments', 'module.utilities',
    'module.maintenance', 'module.governance', 'module.communications',
    'module.documents', 'module.occupancy', 'module.security'
  ] loop
    insert into platform.workspace_entitlements (
      customer_workspace_id, entitlement_key, value_type, boolean_value, valid_from, valid_until
    ) values (
      v_workspace_id, v_entitlement, 'boolean', true, statement_timestamp(), null
    )
    on conflict (customer_workspace_id, entitlement_key) do update set
      value_type = 'boolean',
      boolean_value = true,
      valid_from = excluded.valid_from,
      valid_until = null,
      updated_at = statement_timestamp();
  end loop;
end $$;

commit;
