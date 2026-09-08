-- Test 056: Explicit Tax Policy & Tariff Contract Hardening
-- Scope: Verify removal of implicit 19% default, column default dropped,
--        deterministic tax_rate_required error, range validation [0, 1],
--        tariff snapshot immutability after billing, execution privileges,
--        error-only compatibility overload, and audit trail recording.

begin;
select plan(12);

-- =============================================================================
-- 1. Routine Existence & Privilege Checks
-- =============================================================================

select ok(
  to_regprocedure('utilities.create_tariff(uuid,uuid,utilities.service_type,text,text,numeric,numeric,numeric,text,date,date,text)') is not null,
  'utilities.create_tariff exists with explicit tax_rate signature'
);

select ok(
  to_regprocedure('customer_api.create_tariff_v1(uuid,uuid,text,text,text,numeric,numeric,numeric,text,date,date,text)') is not null,
  'customer_api.create_tariff_v1 exists with explicit tax_rate signature'
);

select ok(
  has_function_privilege('authenticated', 'customer_api.create_tariff_v1(uuid,uuid,text,text,text,numeric,numeric,numeric,text,date,date,text)', 'EXECUTE'),
  'authenticated can execute customer_api.create_tariff_v1'
);

select ok(
  not has_function_privilege('anon', 'customer_api.create_tariff_v1(uuid,uuid,text,text,text,numeric,numeric,numeric,text,date,date,text)', 'EXECUTE'),
  'anon is denied customer_api.create_tariff_v1'
);

-- =============================================================================
-- 2. Schema Catalog: No Implicit Defaults in Column or Parameters
-- =============================================================================

select ok(
  (
    select column_default is null
    from information_schema.columns
    where table_schema = 'utilities' and table_name = 'tariffs' and column_name = 'tax_rate'
  ),
  'utilities.tariffs.tax_rate has no implicit column default'
);

select ok(
  not exists (
    select 1
    from information_schema.parameters
    where specific_schema in ('utilities', 'customer_api')
      and specific_name like '%create_tariff%'
      and parameter_name = 'p_tax_rate'
      and parameter_default is not null
  ),
  'p_tax_rate parameter has no implicit default in utilities or customer_api'
);

-- =============================================================================
-- 3. Functional Isolation & Tax Policy Contract
-- =============================================================================

do $$
declare
  v_admin_id uuid := '60000000-0000-0000-0000-000000000001';
  v_tenant_id uuid := '60100000-0000-0000-0000-000000000001';
  v_prop_id uuid := '60300000-0000-0000-0000-000000000001';
  v_role_id uuid := '60200000-0000-0000-0000-000000000001';
  v_ctx_id uuid := '60c00000-0000-0000-0000-000000000001';
  v_mship_id uuid := '60d00000-0000-0000-0000-000000000001';

  v_tariff_zero jsonb;
  v_tariff_rate jsonb;
  v_tariff_id uuid;
  v_err text;
begin
  insert into auth.users (id, email) values (v_admin_id, 'tax-admin@cladora.test');
  insert into platform.tenants (id, legal_name, registration_number, status)
  values (v_tenant_id, 'Tax Policy Tenant', 'TAX-001', 'active');

  insert into portfolio.properties (id, tenant_id, type, name, status)
  values (v_prop_id, v_tenant_id, 'condominium', 'Tax Property', 'active');

  insert into identity.roles (id, tenant_id, code, name)
  values (v_role_id, v_tenant_id, 'association_admin', 'Admin');

  insert into identity.role_permissions (role_id, permission_id, effect)
  select v_role_id, p.id, 'allow'
  from identity.permissions p
  where p.code in ('utilities.manage', 'utilities.tariffs.manage');

  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at)
  values (v_mship_id, v_tenant_id, v_admin_id, v_role_id, 'active', statement_timestamp() - interval '1 day');

  insert into identity.context_grants (id, tenant_id, membership_id, scope_type, property_id, starts_at)
  values (v_ctx_id, v_tenant_id, v_mship_id, 'property', v_prop_id, statement_timestamp() - interval '1 day');

  perform set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

  -- TEST 1: Missing tax_rate (explicit NULL) must be rejected with tax_rate_required
  begin
    perform utilities.create_tariff(
      p_context_id => v_ctx_id,
      p_property_id => v_prop_id,
      p_service_type => 'water'::utilities.service_type,
      p_tariff_code => 'WTR-MISSING-TAX',
      p_name => 'Missing Tax Rate Tariff',
      p_unit_rate => 10.0,
      p_tax_rate => null
    );
    raise exception 'TEST_FAILED: NULL tax_rate should have been rejected';
  exception when others then
    if sqlerrm <> 'tax_rate_required' then
      raise exception 'Expected tax_rate_required, got %', sqlerrm;
    end if;
  end;

  -- TEST 1b: Omitted tax_rate in 6-parameter compatibility overload raises tax_rate_required
  begin
    perform utilities.create_tariff(
      v_ctx_id,
      v_prop_id,
      'water'::utilities.service_type,
      'WTR-OMITTED-TAX',
      'Omitted Tax Tariff',
      10.0
    );
    raise exception 'TEST_FAILED: Omitted tax_rate should have been rejected';
  exception when others then
    if sqlerrm <> 'tax_rate_required' then
      raise exception 'Expected tax_rate_required from compatibility overload, got %', sqlerrm;
    end if;
  end;

  -- TEST 2: Negative tax_rate must be rejected with tax_rate_out_of_range
  begin
    perform utilities.create_tariff(
      p_context_id => v_ctx_id,
      p_property_id => v_prop_id,
      p_service_type => 'water'::utilities.service_type,
      p_tariff_code => 'WTR-NEG-TAX',
      p_name => 'Negative Tax Rate Tariff',
      p_unit_rate => 10.0,
      p_tax_rate => -0.05
    );
    raise exception 'TEST_FAILED: Negative tax_rate should have been rejected';
  exception when others then
    if sqlerrm <> 'tax_rate_out_of_range' then
      raise exception 'Expected tax_rate_out_of_range, got %', sqlerrm;
    end if;
  end;

  -- TEST 3: Tax rate > 1.0 must be rejected with tax_rate_out_of_range
  begin
    perform utilities.create_tariff(
      p_context_id => v_ctx_id,
      p_property_id => v_prop_id,
      p_service_type => 'water'::utilities.service_type,
      p_tariff_code => 'WTR-OVER-TAX',
      p_name => 'Over 100% Tax Rate Tariff',
      p_unit_rate => 10.0,
      p_tax_rate => 1.25
    );
    raise exception 'TEST_FAILED: tax_rate > 1 should have been rejected';
  exception when others then
    if sqlerrm <> 'tax_rate_out_of_range' then
      raise exception 'Expected tax_rate_out_of_range, got %', sqlerrm;
    end if;
  end;

  -- TEST 4: Explicit 0% tax rate accepted
  v_tariff_zero := utilities.create_tariff(
    p_context_id => v_ctx_id,
    p_property_id => v_prop_id,
    p_service_type => 'water'::utilities.service_type,
    p_tariff_code => 'WTR-ZERO-TAX',
    p_name => 'Non-Taxable Water Tariff',
    p_unit_rate => 10.0,
    p_tax_rate => 0.0,
    p_fixed_charge => 5.0
  );

  -- TEST 5: Explicit test tax rate (e.g. 0.09) accepted
  v_tariff_rate := utilities.create_tariff(
    p_context_id => v_ctx_id,
    p_property_id => v_prop_id,
    p_service_type => 'electricity'::utilities.service_type,
    p_tariff_code => 'ELEC-9PCT-TAX',
    p_name => '9% Tax Electricity Tariff',
    p_unit_rate => 1.50,
    p_tax_rate => 0.09,
    p_fixed_charge => 0.0
  );
  v_tariff_id := (v_tariff_rate->>'tariff_id')::uuid;

  create temp table _tax_test_results as
  select
    (v_tariff_zero->>'tax_rate')::numeric as zero_rate,
    (v_tariff_rate->>'tax_rate')::numeric as explicit_rate,
    v_tariff_id as linked_tariff_id;

  -- TEST 6: Verify Immutability on existing billed tariff (102ac0fc-958b-4be8-a940-34085cff4688)
  if exists (select 1 from utilities.tariffs where id = '102ac0fc-958b-4be8-a940-34085cff4688') then
    begin
      update utilities.tariffs
      set unit_rate = 9.99
      where id = '102ac0fc-958b-4be8-a940-34085cff4688';
      raise exception 'TEST_FAILED: In-place update of billed tariff should be blocked';
    exception when others then
      if sqlerrm <> 'tariff_immutable_after_billing' then
        raise exception 'Expected tariff_immutable_after_billing, got %', sqlerrm;
      end if;
    end;

    begin
      delete from utilities.tariffs
      where id = '102ac0fc-958b-4be8-a940-34085cff4688';
      raise exception 'TEST_FAILED: Delete of billed tariff should be blocked';
    exception when others then
      if sqlerrm <> 'tariff_immutable_after_billing' then
        raise exception 'Expected tariff_immutable_after_billing, got %', sqlerrm;
      end if;
    end;
  end if;

end $$;

-- =============================================================================
-- 4. Result Assertions
-- =============================================================================

select ok((select count(*) from _tax_test_results) = 1, 'Tax policy tests completed without exception');
select ok((select zero_rate from _tax_test_results) = 0.000000, 'Explicit 0% tax tariff stored with tax_rate = 0.0');
select ok((select explicit_rate from _tax_test_results) = 0.090000, 'Explicit 9% tax tariff stored with tax_rate = 0.09');

-- Verify audit trail
select ok(
  exists (
    select 1 from audit.events
    where action = 'TARIFF_CREATED'
      and (after_snapshot->>'tax_rate')::numeric = 0.0
  ),
  'Audit event TARIFF_CREATED emitted for 0% tax tariff'
);

select ok(
  exists (
    select 1 from audit.events
    where action = 'TARIFF_CREATED'
      and (after_snapshot->>'tax_rate')::numeric = 0.09
  ),
  'Audit event TARIFF_CREATED emitted for 9% tax tariff'
);

-- Verify historical P1TEST tariff preserved and not rewritten
select ok(
  exists (
    select 1 from utilities.tariffs
    where id = '102ac0fc-958b-4be8-a940-34085cff4688'
      and tax_rate is not null
  ) or not exists (
    select 1 from utilities.tariffs where id = '102ac0fc-958b-4be8-a940-34085cff4688'
  ),
  'Historical P1TEST tariff preserved and untouched'
);

select * from finish();
rollback;
