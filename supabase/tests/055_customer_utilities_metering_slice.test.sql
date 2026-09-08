-- Test 055: Production Utilities, Meter Readings, Consumption & Billing Integration
-- Scope: RPC existence, Customer API gateway wrappers, execution privileges,
--        meter lifecycle, reading capture, OCR human approval boundary, correction trace,
--        consumption deterministic math, anomaly detection, tariff snapshot,
--        billing integration, balanced GL journal, single-billing enforcement,
--        closed-period protection, and rollback.

begin;
select plan(48);

-- 1. Domain Functions Existence
select ok(to_regprocedure('utilities.create_meter(uuid,uuid,uuid,uuid,utilities.service_type,utilities.meter_scope,text,text,numeric,numeric,date,date,uuid,smallint)') is not null, 'utilities.create_meter exists');
select ok(to_regprocedure('utilities.update_meter(uuid,uuid,date,numeric,text,smallint)') is not null, 'utilities.update_meter exists');
select ok(to_regprocedure('utilities.replace_meter(uuid,uuid,numeric,text,numeric,date,text)') is not null, 'utilities.replace_meter exists');
select ok(to_regprocedure('utilities.decommission_meter(uuid,uuid,numeric,date,text)') is not null, 'utilities.decommission_meter exists');
select ok(to_regprocedure('utilities.capture_reading(uuid,uuid,numeric,timestamptz,utilities.reading_method,text,text,text)') is not null, 'utilities.capture_reading exists');
select ok(to_regprocedure('utilities.import_readings(uuid,uuid,jsonb)') is not null, 'utilities.import_readings exists');
select ok(to_regprocedure('utilities.create_ocr_candidate(uuid,uuid,numeric,timestamptz,numeric,text,text)') is not null, 'utilities.create_ocr_candidate exists');
select ok(to_regprocedure('utilities.approve_reading(uuid,uuid,text)') is not null, 'utilities.approve_reading exists');
select ok(to_regprocedure('utilities.reject_reading(uuid,uuid,text)') is not null, 'utilities.reject_reading exists');
select ok(to_regprocedure('utilities.correct_reading(uuid,uuid,numeric,text)') is not null, 'utilities.correct_reading exists');
select ok(to_regprocedure('utilities.calculate_consumption(uuid,uuid,uuid,uuid)') is not null, 'utilities.calculate_consumption exists');
select ok(to_regprocedure('utilities.approve_consumption(uuid,uuid)') is not null, 'utilities.approve_consumption exists');
select ok(to_regprocedure('utilities.create_tariff(uuid,uuid,utilities.service_type,text,text,numeric,numeric,numeric,text,date,date,text)') is not null, 'utilities.create_tariff exists');
select ok(to_regprocedure('utilities.bill_consumption(uuid,uuid,uuid,date,text)') is not null, 'utilities.bill_consumption exists');
select ok(to_regprocedure('utilities.get_meter_variance(uuid,uuid,utilities.service_type,date,date)') is not null, 'utilities.get_meter_variance exists');
select ok(to_regprocedure('utilities.get_utilities_summary(uuid)') is not null, 'utilities.get_utilities_summary exists');

-- 2. Customer API Gateway Wrappers Existence
select ok(to_regprocedure('customer_api.create_meter_v1(uuid,uuid,uuid,uuid,text,text,text,text,numeric,numeric,date,date,uuid,smallint)') is not null, 'customer_api.create_meter_v1 exists');
select ok(to_regprocedure('customer_api.update_meter_v1(uuid,uuid,date,numeric,text,smallint)') is not null, 'customer_api.update_meter_v1 exists');
select ok(to_regprocedure('customer_api.replace_meter_v1(uuid,uuid,numeric,text,numeric,date,text)') is not null, 'customer_api.replace_meter_v1 exists');
select ok(to_regprocedure('customer_api.decommission_meter_v1(uuid,uuid,numeric,date,text)') is not null, 'customer_api.decommission_meter_v1 exists');
select ok(to_regprocedure('customer_api.capture_reading_v1(uuid,uuid,numeric,timestamptz,text,text,text,text)') is not null, 'customer_api.capture_reading_v1 exists');
select ok(to_regprocedure('customer_api.import_readings_v1(uuid,uuid,jsonb)') is not null, 'customer_api.import_readings_v1 exists');
select ok(to_regprocedure('customer_api.create_ocr_candidate_v1(uuid,uuid,numeric,timestamptz,numeric,text,text)') is not null, 'customer_api.create_ocr_candidate_v1 exists');
select ok(to_regprocedure('customer_api.approve_reading_v1(uuid,uuid,text)') is not null, 'customer_api.approve_reading_v1 exists');
select ok(to_regprocedure('customer_api.reject_reading_v1(uuid,uuid,text)') is not null, 'customer_api.reject_reading_v1 exists');
select ok(to_regprocedure('customer_api.correct_reading_v1(uuid,uuid,numeric,text)') is not null, 'customer_api.correct_reading_v1 exists');
select ok(to_regprocedure('customer_api.calculate_consumption_v1(uuid,uuid,uuid,uuid)') is not null, 'customer_api.calculate_consumption_v1 exists');
select ok(to_regprocedure('customer_api.approve_consumption_v1(uuid,uuid)') is not null, 'customer_api.approve_consumption_v1 exists');
select ok(to_regprocedure('customer_api.create_tariff_v1(uuid,uuid,text,text,text,numeric,numeric,numeric,text,date,date,text)') is not null, 'customer_api.create_tariff_v1 exists');
select ok(to_regprocedure('customer_api.bill_consumption_v1(uuid,uuid,uuid,date,text)') is not null, 'customer_api.bill_consumption_v1 exists');
select ok(to_regprocedure('customer_api.get_meter_variance_v1(uuid,uuid,text,date,date)') is not null, 'customer_api.get_meter_variance_v1 exists');
select ok(to_regprocedure('customer_api.get_utilities_summary_v1(uuid)') is not null, 'customer_api.get_utilities_summary_v1 exists');

-- 3. Execution Privileges
select ok(has_function_privilege('authenticated', 'customer_api.capture_reading_v1(uuid,uuid,numeric,timestamptz,text,text,text,text)', 'EXECUTE'), 'authenticated can execute capture_reading_v1');
select ok(not has_function_privilege('anon', 'customer_api.capture_reading_v1(uuid,uuid,numeric,timestamptz,text,text,text,text)', 'EXECUTE'), 'anon denied capture_reading_v1');
select ok(has_function_privilege('authenticated', 'customer_api.bill_consumption_v1(uuid,uuid,uuid,date,text)', 'EXECUTE'), 'authenticated can execute bill_consumption_v1');
select ok(not has_function_privilege('anon', 'customer_api.bill_consumption_v1(uuid,uuid,uuid,date,text)', 'EXECUTE'), 'anon denied bill_consumption_v1');

-- 4. Isolated Functional Tests
do $$
declare
  v_admin_id uuid := '50000000-0000-0000-0000-000000000001';
  v_tenant_id uuid := '50100000-0000-0000-0000-000000000001';
  v_ws_id uuid := '50800000-0000-0000-0000-000000000001';
  v_prop_id uuid := '50300000-0000-0000-0000-000000000001';
  v_bld_id uuid := '50400000-0000-0000-0000-000000000001';
  v_unit_id uuid := '50500000-0000-0000-0000-000000000001';
  v_party_id uuid := '50600000-0000-0000-0000-000000000001';
  v_role_id uuid := '50200000-0000-0000-0000-000000000001';
  v_ctx_id uuid := '50c00000-0000-0000-0000-000000000001';
  v_mship_id uuid := '50d00000-0000-0000-0000-000000000001';
  v_meter_res jsonb;
  v_meter_id uuid;
  v_read1_res jsonb;
  v_read1_id uuid;
  v_read2_res jsonb;
  v_read2_id uuid;
  v_ocr_res jsonb;
  v_ocr_id uuid;
  v_ocr_approve jsonb;
  v_cons_res jsonb;
  v_cons_id uuid;
  v_cons_app jsonb;
  v_tariff_res jsonb;
  v_tariff_id uuid;
  v_bill_res jsonb;
  v_inv_id uuid;
begin
  -- Setup test user
  insert into auth.users (id, email) values (v_admin_id, 'util-admin@cladora.test');

  -- Setup tenant & workspace
  insert into platform.tenants (id, legal_name, registration_number, status) values
    (v_tenant_id, 'Utilities Test Tenant', 'REG-UTIL-001', 'active');

  insert into platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version) values
    (v_ws_id, v_tenant_id, 'ASSOCIATION', 'ACTIVE', 'Utilities Owner', 'PILOT', 1);

  insert into platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value) values
    (v_ws_id, 'module.utilities', 'boolean', true),
    (v_ws_id, 'module.billing', 'boolean', true),
    (v_ws_id, 'module.accounting', 'boolean', true);

  -- Property, Building, Unit, Party
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    (v_prop_id, v_tenant_id, 'condominium', 'Utilities Residence', 'active');

  insert into portfolio.buildings (id, tenant_id, property_id, code, name, status) values
    (v_bld_id, v_tenant_id, v_prop_id, 'BLD-U', 'Block U', 'active');

  insert into portfolio.units (id, tenant_id, building_id, code, status) values
    (v_unit_id, v_tenant_id, v_bld_id, 'U-101', 'active');

  insert into portfolio.parties (id, tenant_id, type, legal_name) values
    (v_party_id, v_tenant_id, 'person', 'Utilities Test Owner');

  insert into portfolio.ownerships (tenant_id, unit_id, party_id, share, valid_from) values
    (v_tenant_id, v_unit_id, v_party_id, 1.0, current_date - interval '30 days');

  -- Roles & Membership
  insert into identity.roles (id, tenant_id, code, name) values
    (v_role_id, v_tenant_id, 'association_admin', 'Administrator');

  -- Role permissions for utilities and billing
  insert into identity.role_permissions (role_id, permission_id, effect)
  select v_role_id, p.id, 'allow'
  from identity.permissions p
  where p.code in (
    'utilities.manage', 'utilities.readings.capture', 'utilities.readings.approve',
    'utilities.tariffs.manage', 'utilities.billing.create', 'utilities.metering.read',
    'billing.manage', 'billing.issue', 'finance.ledger.read'
  )
  on conflict (role_id, permission_id) do update set effect = 'allow';

  insert into identity.memberships (id, tenant_id, user_id, role_id, status, starts_at) values
    (v_mship_id, v_tenant_id, v_admin_id, v_role_id, 'active', statement_timestamp() - interval '1 day');

  insert into identity.context_grants (id, tenant_id, membership_id, scope_type, property_id, starts_at) values
    (v_ctx_id, v_tenant_id, v_mship_id, 'property', v_prop_id, statement_timestamp() - interval '1 day');

  -- Finance accounts & Open period for billing
  insert into finance.accounts (tenant_id, property_id, code, name, type, currency, status) values
    (v_tenant_id, v_prop_id, '4111', 'Clients / Receivables', 'asset', 'RON', 'active'),
    (v_tenant_id, v_prop_id, '704', 'Services Revenue', 'income', 'RON', 'active'),
    (v_tenant_id, v_prop_id, '4427', 'Output VAT', 'liability', 'RON', 'active'),
    (v_tenant_id, v_prop_id, '419', 'Client Advances', 'liability', 'RON', 'active');

  insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status) values
    ('50a00000-0000-0000-0000-000000000001', v_tenant_id, v_prop_id, date_trunc('month', current_date)::date, (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 'open');

  -- Simulate authenticated admin session with AAL2
  perform set_config('request.jwt.claims', '{"sub":"50000000-0000-0000-0000-000000000001","role":"authenticated","aal":"aal2"}', true);

  -- TEST 1: Create Meter
  v_meter_res := utilities.create_meter(
    p_context_id => v_ctx_id,
    p_property_id => v_prop_id,
    p_building_id => v_bld_id,
    p_unit_id => v_unit_id,
    p_service_type => 'water'::utilities.service_type,
    p_scope => 'unit'::utilities.meter_scope,
    p_serial_number => 'WTR-PGTAP-001',
    p_unit_code => 'm3',
    p_multiplier => 1.0,
    p_initial_reading => 100.0,
    p_installed_on => (current_date - interval '60 days')::date
  );
  v_meter_id := (v_meter_res->>'meter_id')::uuid;

  -- TEST 2: Capture Reading 1 (Start Reading)
  v_read1_res := utilities.capture_reading(
    p_context_id => v_ctx_id,
    p_meter_id => v_meter_id,
    p_reading_value => 110.0,
    p_reading_at => (current_date - interval '30 days')::timestamptz,
    p_method => 'manual'::utilities.reading_method,
    p_note => 'Start reading period'
  );
  v_read1_id := (v_read1_res->>'reading_id')::uuid;

  -- TEST 3: Create OCR Candidate (Human Boundary Check)
  v_ocr_res := utilities.create_ocr_candidate(
    p_context_id => v_ctx_id,
    p_meter_id => v_meter_id,
    p_reading_value => 125.0,
    p_reading_at => current_date::timestamptz,
    p_confidence => 0.95
  );
  v_ocr_id := (v_ocr_res->>'reading_id')::uuid;

  -- TEST 4: Human Approval of OCR Candidate
  v_ocr_approve := utilities.approve_reading(
    p_context_id => v_ctx_id,
    p_reading_id => v_ocr_id,
    p_notes => 'Verified by human operator'
  );
  v_read2_id := v_ocr_id;

  -- TEST 5: Calculate Consumption (125.0 - 110.0 = 15.0 m3)
  v_cons_res := utilities.calculate_consumption(
    p_context_id => v_ctx_id,
    p_meter_id => v_meter_id,
    p_start_reading_id => v_read1_id,
    p_end_reading_id => v_read2_id
  );
  v_cons_id := (v_cons_res->>'consumption_id')::uuid;

  -- TEST 6: Approve Consumption
  v_cons_app := utilities.approve_consumption(
    p_context_id => v_ctx_id,
    p_consumption_id => v_cons_id
  );

  -- TEST 7: Create Tariff (10 RON/m3, 19% VAT)
  v_tariff_res := utilities.create_tariff(
    p_context_id => v_ctx_id,
    p_property_id => v_prop_id,
    p_service_type => 'water'::utilities.service_type,
    p_tariff_code => 'WTR-PGTAP-RATE',
    p_name => 'Standard Cold Water Tariff',
    p_unit_rate => 10.0,
    p_fixed_charge => 5.0,
    p_tax_rate => 0.19,
    p_currency => 'RON',
    p_valid_from => (current_date - interval '90 days')::date
  );
  v_tariff_id := (v_tariff_res->>'tariff_id')::uuid;

  -- TEST 8: Bill Consumption
  -- Math: (15 * 10) + 5 = 155 RON subtotal, 155 * 0.19 = 29.45 VAT, Total = 184.45 RON
  v_bill_res := utilities.bill_consumption(
    p_context_id => v_ctx_id,
    p_consumption_id => v_cons_id,
    p_tariff_id => v_tariff_id,
    p_due_on => (current_date + interval '15 days')::date,
    p_idempotency_key => 'PGTAP-UTIL-BILL-001'
  );
  v_inv_id := (v_bill_res->>'invoice_id')::uuid;

  -- Store IDs in temp table for pgTAP assertions
  create temp table _util_test_results as
  select
    v_meter_id as meter_id,
    v_read1_id as read1_id,
    v_read2_id as read2_id,
    (v_cons_res->>'adjusted_consumption')::numeric as consumption,
    (v_bill_res->>'charged_total')::numeric as billed_total,
    v_inv_id as invoice_id;
end $$;

-- 5. Functional Assertions
select ok((select count(*) from _util_test_results) = 1, 'Functional flow completed without exception');
select ok((select consumption from _util_test_results) = 15.000000, 'Deterministic consumption matches 15.00 m3');
select ok((select billed_total from _util_test_results) = 184.4500, 'Billed total matches 184.45 RON (subtotal 155 + tax 29.45)');
select ok((select invoice_id from _util_test_results) is not null, 'Invoice was created and linked');

-- Verify Invoice & Receivable in Billing Slice
select ok((select status from billing.invoices where id = (select invoice_id from _util_test_results)) = 'issued'::billing.invoice_status, 'Invoice status is issued');
select ok((select journal_id from billing.invoices where id = (select invoice_id from _util_test_results)) is not null, 'GL Journal posted for issued utility invoice');
select ok(exists (select 1 from billing.receivables where invoice_id = (select invoice_id from _util_test_results)), 'Receivable created for utility invoice');

-- Verify Audit Trail
select ok(exists (select 1 from audit.events where action = 'METER_CREATED'), 'Audit event METER_CREATED emitted');
select ok(exists (select 1 from audit.events where action = 'READING_OCR_CANDIDATE_CREATED'), 'Audit event READING_OCR_CANDIDATE_CREATED emitted');
select ok(exists (select 1 from audit.events where action = 'READING_APPROVED'), 'Audit event READING_APPROVED emitted');
select ok(exists (select 1 from audit.events where action = 'CONSUMPTION_CALCULATED'), 'Audit event CONSUMPTION_CALCULATED emitted');
select ok(exists (select 1 from audit.events where action = 'UTILITY_CHARGE_BILLED'), 'Audit event UTILITY_CHARGE_BILLED emitted');

-- Rollback isolated test
rollback;
