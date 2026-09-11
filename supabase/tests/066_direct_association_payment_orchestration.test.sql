-- ============================================================
-- Test Suite 066: Direct Association Payment Orchestration & Unit Charge Breakdown
-- Authoritative slice: CLADORA-P2-PAY-003-R1
-- ============================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap;

SELECT plan(55);

-- ------------------------------------------------------------
-- 1. Schema & Table Existence Checks
-- ------------------------------------------------------------
select has_table('payments', 'payment_allocation_policies', 'payments.payment_allocation_policies table exists');
select has_table('payments', 'beneficiary_accounts', 'payments.beneficiary_accounts table exists');
select has_table('payments', 'provider_accounts', 'payments.provider_accounts table exists');
select has_table('payments', 'payment_intents', 'payments.payment_intents table exists');
select has_table('payments', 'webhook_receipts', 'payments.webhook_receipts table exists');
select has_table('payments', 'settlements', 'payments.settlements table exists');
select has_table('payments', 'refund_records', 'payments.refund_records table exists');
select ok(exists (select 1 from information_schema.columns where table_schema = 'payments' and table_name = 'payments' and column_name = 'payment_intent_id'), 'payments.payments has payment_intent_id FK');

-- ------------------------------------------------------------
-- 2. Absence of Parallel Accounting Engines
-- ------------------------------------------------------------
select ok(not exists (select 1 from information_schema.tables where table_schema = 'payments' and table_name = 'shadow_invoices'), 'No shadow invoice table in payments');
select ok(not exists (select 1 from information_schema.tables where table_schema = 'payments' and table_name = 'parallel_ledgers'), 'No parallel ledger table in payments');
select ok(not exists (select 1 from information_schema.tables where table_schema = 'payments' and table_name = 'shadow_receivables'), 'No shadow receivables table in payments');
select ok(not exists (select 1 from information_schema.tables where table_schema = 'customer_api' and table_name = 'invoices'), 'No parallel invoices in customer_api');
select ok(not exists (select 1 from information_schema.tables where table_schema = 'customer_api' and table_name = 'payments'), 'No parallel payments in customer_api');

-- ------------------------------------------------------------
-- 3. Enum Types Existence Checks
-- ------------------------------------------------------------
select ok(exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'payments' and t.typname = 'payment_allocation_strategy'), 'payments.payment_allocation_strategy enum exists');
select ok(exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'payments' and t.typname = 'penalties_priority'), 'payments.penalties_priority enum exists');
select ok(exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'payments' and t.typname = 'payment_intent_status'), 'payments.payment_intent_status enum exists');
select ok(exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace where n.nspname = 'payments' and t.typname = 'refund_status'), 'payments.refund_status enum exists');

-- ------------------------------------------------------------
-- 4. RPC & Function Existence Checks
-- ------------------------------------------------------------
select has_function('customer_api', 'get_unit_charge_breakdown_v1', ARRAY['uuid', 'uuid', 'date', 'date', 'text', 'integer', 'integer'], 'customer_api.get_unit_charge_breakdown_v1 exists');
select has_function('customer_api', 'get_unit_balances_v1', ARRAY['uuid', 'uuid', 'uuid'], 'customer_api.get_unit_balances_v1 exists');
select has_function('customer_api', 'create_payment_intent_v1', ARRAY['uuid', 'uuid', 'jsonb', 'numeric', 'text', 'text', 'text'], 'customer_api.create_payment_intent_v1 exists');
select has_function('customer_api', 'get_payment_intent_v1', ARRAY['uuid', 'uuid'], 'customer_api.get_payment_intent_v1 exists');
select has_function('customer_api', 'cancel_payment_intent_v1', ARRAY['uuid', 'uuid', 'text'], 'customer_api.cancel_payment_intent_v1 exists');
select has_function('customer_api', 'generate_bank_instruction_v1', ARRAY['uuid', 'uuid'], 'customer_api.generate_bank_instruction_v1 exists');
select has_function('payments', 'process_webhook_event_v1', ARRAY['uuid', 'text', 'text', 'text', 'text', 'jsonb'], 'payments.process_webhook_event_v1 exists');

-- ------------------------------------------------------------
-- 5. Security Invoker & Definer Contracts
-- ------------------------------------------------------------
select ok((select prosecdef = false from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_unit_charge_breakdown_v1' limit 1), 'get_unit_charge_breakdown_v1 is SECURITY INVOKER');
select ok((select prosecdef = false from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_unit_balances_v1' limit 1), 'get_unit_balances_v1 is SECURITY INVOKER');
select ok((select prosecdef = false from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'create_payment_intent_v1' limit 1), 'create_payment_intent_v1 is SECURITY INVOKER');
select ok((select prosecdef = false from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'get_payment_intent_v1' limit 1), 'get_payment_intent_v1 is SECURITY INVOKER');
select ok((select prosecdef = false from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'cancel_payment_intent_v1' limit 1), 'cancel_payment_intent_v1 is SECURITY INVOKER');
select ok((select prosecdef = false from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'customer_api' and p.proname = 'generate_bank_instruction_v1' limit 1), 'generate_bank_instruction_v1 is SECURITY INVOKER');
select ok((select prosecdef = true from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'payments' and p.proname = 'process_webhook_event_v1' limit 1), 'process_webhook_event_v1 is SECURITY DEFINER');

-- ------------------------------------------------------------
-- 6. Privilege Lockdown (PUBLIC / anon denial)
-- ------------------------------------------------------------
select ok(NOT exists (select 1 from information_schema.routine_privileges where routine_schema = 'customer_api' and routine_name in ('create_payment_intent_v1', 'get_unit_charge_breakdown_v1', 'generate_bank_instruction_v1') and grantee in ('PUBLIC', 'anon')), 'customer_api payment functions revoked from PUBLIC and anon');
select ok(NOT exists (select 1 from information_schema.routine_privileges where routine_schema = 'payments' and routine_name = 'process_webhook_event_v1' and grantee in ('PUBLIC', 'anon', 'authenticated')), 'process_webhook_event_v1 revoked from PUBLIC, anon, and authenticated');

-- ------------------------------------------------------------
-- 7. Row Level Security (RLS) Active Checks
-- ------------------------------------------------------------
select ok((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'payments' AND c.relname = 'payment_allocation_policies'), 'RLS enabled on payments.payment_allocation_policies');
select ok((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'payments' AND c.relname = 'beneficiary_accounts'), 'RLS enabled on payments.beneficiary_accounts');
select ok((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'payments' AND c.relname = 'provider_accounts'), 'RLS enabled on payments.provider_accounts');
select ok((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'payments' AND c.relname = 'payment_intents'), 'RLS enabled on payments.payment_intents');
select ok((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'payments' AND c.relname = 'webhook_receipts'), 'RLS enabled on payments.webhook_receipts');
select ok((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'payments' AND c.relname = 'settlements'), 'RLS enabled on payments.settlements');
select ok((SELECT c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'payments' AND c.relname = 'refund_records'), 'RLS enabled on payments.refund_records');

-- ------------------------------------------------------------
-- 8. Zero PCI / PAN / Secret Storage Checks
-- ------------------------------------------------------------
select ok(NOT exists (select 1 from information_schema.columns where table_schema = 'payments' and table_name = 'payment_intents' and column_name in ('card_number', 'cvv', 'pan')), 'Zero card_number/cvv/pan in payment_intents');
select ok(NOT exists (select 1 from information_schema.columns where table_schema = 'payments' and table_name = 'provider_accounts' and column_name in ('api_key', 'webhook_secret')), 'Zero api_key/webhook_secret in provider_accounts');

-- ------------------------------------------------------------
-- 9. Functional Fixtures & Setup in Isolated Transaction
-- ------------------------------------------------------------
DO $$
DECLARE
  v_tenant_id uuid := '11111111-1111-4111-8111-111111111111';
  v_prop_id uuid := '22222222-2222-4222-8222-222222222222';
  v_unit_id uuid := '33333333-3333-4333-8333-333333333333';
  v_party_id uuid := '44444444-4444-4444-8444-444444444444';
  v_user_id uuid := '55555555-5555-4555-8555-555555555555';
  v_bank_acc uuid := '66666666-6666-4666-8666-666666666666';
  v_beneficiary_id uuid;
  v_policy_id uuid;
  v_intent_id uuid;
  v_invoice_id uuid;
  v_receivable_id uuid;
BEGIN
  -- Insert Tenant
  INSERT INTO platform.tenants (id, legal_name, registration_number, status)
  VALUES (v_tenant_id, 'Asociatia de Proprietari PAY-066', 'RO9999066', 'active')
  ON CONFLICT (id) DO NOTHING;

  -- Insert Auth User for payer
  INSERT INTO auth.users (id, email)
  VALUES (v_user_id, 'payer_test066@cladora.invalid')
  ON CONFLICT (id) DO NOTHING;

  -- Insert Property, Building & Unit
  INSERT INTO portfolio.properties (id, tenant_id, name, type)
  VALUES (v_prop_id, v_tenant_id, 'Bloc PAY-066', 'condominium')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO portfolio.buildings (id, tenant_id, property_id, code, name)
  VALUES ('77777777-7777-4777-8777-777777777777'::uuid, v_tenant_id, v_prop_id, 'B1', 'Building 1')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO portfolio.parties (id, tenant_id, legal_name, type)
  VALUES (v_party_id, v_tenant_id, 'Ion Popescu Test', 'person')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO portfolio.units (id, tenant_id, building_id, code, area_m2)
  VALUES (v_unit_id, v_tenant_id, '77777777-7777-4777-8777-777777777777'::uuid, 'AP-066', 65.50)
  ON CONFLICT (id) DO NOTHING;

  -- Ownership
  INSERT INTO portfolio.ownerships (tenant_id, unit_id, party_id, share, valid_from)
  VALUES (v_tenant_id, v_unit_id, v_party_id, 1.0, current_date)
  ON CONFLICT DO NOTHING;

  -- Bank Account
  INSERT INTO payments.bank_accounts (id, tenant_id, property_id, iban_encrypted, iban_fingerprint, bank_name, currency)
  VALUES (v_bank_acc, v_tenant_id, v_prop_id, 'enc_RO98BTRL000TESTPAY066', 'fp_066', 'Banca Transilvania Test', 'RON')
  ON CONFLICT (id) DO NOTHING;

  -- Beneficiary Account under Dual Control
  INSERT INTO payments.beneficiary_accounts (
    tenant_id, property_id, association_legal_name, bank_account_id, bank_name, currency, masked_iban, status
  ) VALUES (
    v_tenant_id, v_prop_id, 'Asociatia de Proprietari PAY-066', v_bank_acc, 'Banca Transilvania Test', 'RON', 'RO98****TEST', 'active'
  ) RETURNING id INTO v_beneficiary_id;

  -- Allocation Policy
  INSERT INTO payments.payment_allocation_policies (
    tenant_id, version, strategy, penalties_priority, allow_payer_selection, min_partial_amount
  ) VALUES (
    v_tenant_id, 1, 'oldest_due_first', 'principal_first', true, 10.00
  ) RETURNING id INTO v_policy_id;

  -- Canonical Invoice & Receivable
  INSERT INTO billing.invoices (
    id, tenant_id, property_id, unit_id, liable_party_id, period_start, period_end, issued_on, due_on, subtotal, tax_total, status
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_prop_id, v_unit_id, v_party_id, '2026-08-01', '2026-08-31', '2026-09-01', '2026-09-20', 350.00, 0, 'issued'
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO billing.receivables (
    tenant_id, invoice_id, original_amount, paid_amount, credited_amount
  ) VALUES (
    v_tenant_id, v_invoice_id, 350.00, 0, 0
  ) RETURNING id INTO v_receivable_id;

  -- Insert Payment Intent
  INSERT INTO payments.payment_intents (
    id, tenant_id, property_id, unit_id, payer_user_id, payer_party_id, debtor_party_id,
    amount, currency, provider_code, payment_method, idempotency_key, client_reference,
    beneficiary_snapshot, allocation_policy_snapshot, selected_invoices_snapshot, status
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_prop_id, v_unit_id, v_user_id, v_party_id, v_party_id,
    350.00, 'RON', 'test_provider', 'bank_transfer', 'IDEMP-TEST-066-A', 'PAY-TEST066A',
    jsonb_build_object('association_legal_name', 'Asociatia PAY-066', 'beneficiary_id', v_beneficiary_id),
    jsonb_build_object('version', 1, 'strategy', 'oldest_due_first'),
    jsonb_build_array(jsonb_build_object('invoice_id', v_invoice_id, 'amount', 350.00)),
    'created'
  ) RETURNING id INTO v_intent_id;

  -- Insert second Payment Intent for mismatch testing
  INSERT INTO payments.payment_intents (
    id, tenant_id, property_id, unit_id, payer_user_id, payer_party_id, debtor_party_id,
    amount, currency, provider_code, payment_method, idempotency_key, client_reference,
    beneficiary_snapshot, allocation_policy_snapshot, selected_invoices_snapshot, status
  ) VALUES (
    gen_random_uuid(), v_tenant_id, v_prop_id, v_unit_id, v_user_id, v_party_id, v_party_id,
    200.00, 'RON', 'test_provider', 'bank_transfer', 'IDEMP-TEST-066-B', 'PAY-TEST066B',
    jsonb_build_object('association_legal_name', 'Asociatia PAY-066', 'beneficiary_id', v_beneficiary_id),
    jsonb_build_object('version', 1, 'strategy', 'oldest_due_first'),
    '[]'::jsonb,
    'created'
  );

END $$;

-- ------------------------------------------------------------
-- 10. Idempotency & Unique Constraints Tests
-- ------------------------------------------------------------
PREPARE insert_dup_idemp AS
  INSERT INTO payments.payment_intents (
    tenant_id, property_id, unit_id, payer_user_id, debtor_party_id,
    amount, currency, idempotency_key, client_reference,
    beneficiary_snapshot, allocation_policy_snapshot, selected_invoices_snapshot
  ) VALUES (
    '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
    '55555555-5555-4555-8555-555555555555'::uuid, '44444444-4444-4444-8444-444444444444',
    100.00, 'RON', 'IDEMP-TEST-066-A', 'PAY-DUP01',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  );

select throws_ok(
  'insert_dup_idemp',
  '23505',
  NULL,
  'Duplicate idempotency_key within tenant is strictly rejected'
);

PREPARE insert_dup_policy_ver AS
  INSERT INTO payments.payment_allocation_policies (
    tenant_id, version, strategy
  ) VALUES (
    '11111111-1111-4111-8111-111111111111', 1, 'proportional'
  );

select throws_ok(
  'insert_dup_policy_ver',
  '23505',
  NULL,
  'Duplicate allocation policy version within tenant is strictly rejected'
);

PREPARE insert_neg_amount AS
  INSERT INTO payments.payment_intents (
    tenant_id, property_id, unit_id, payer_user_id, debtor_party_id,
    amount, currency, idempotency_key, client_reference,
    beneficiary_snapshot, allocation_policy_snapshot, selected_invoices_snapshot
  ) VALUES (
    '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333',
    '55555555-5555-4555-8555-555555555555'::uuid, '44444444-4444-4444-8444-444444444444',
    -50.00, 'RON', 'IDEMP-NEG-01', 'PAY-NEG01',
    '{}'::jsonb, '{}'::jsonb, '[]'::jsonb
  );

select throws_ok(
  'insert_neg_amount',
  '23514',
  NULL,
  'Negative payment intent amount strictly rejected by constraint'
);

-- ------------------------------------------------------------
-- 11. Webhook Processing & Exactly-Once Semantics Tests
-- ------------------------------------------------------------
DO $$
DECLARE
  v_tenant_id uuid := '11111111-1111-4111-8111-111111111111';
  v_intent RECORD;
  v_intent_b RECORD;
  v_res1 jsonb;
  v_res2 jsonb;
  v_res_mismatch jsonb;
BEGIN
  SELECT * INTO v_intent FROM payments.payment_intents WHERE idempotency_key = 'IDEMP-TEST-066-A';
  SELECT * INTO v_intent_b FROM payments.payment_intents WHERE idempotency_key = 'IDEMP-TEST-066-B';

  -- Process first webhook success event
  v_res1 := payments.process_webhook_event_v1(
    v_tenant_id,
    'test_provider',
    'EVT-066-001',
    'payment.succeeded',
    'hash_066_001',
    jsonb_build_object('payment_intent_id', v_intent.id, 'amount', 350.00, 'currency', 'RON')
  );

  -- Replay exact duplicate event
  v_res2 := payments.process_webhook_event_v1(
    v_tenant_id,
    'test_provider',
    'EVT-066-001',
    'payment.succeeded',
    'hash_066_001',
    jsonb_build_object('payment_intent_id', v_intent.id, 'amount', 350.00, 'currency', 'RON')
  );

  -- Process event with amount mismatch on intent B
  v_res_mismatch := payments.process_webhook_event_v1(
    v_tenant_id,
    'test_provider',
    'EVT-066-002',
    'payment.succeeded',
    'hash_066_002',
    jsonb_build_object('payment_intent_id', v_intent_b.id, 'amount', 123.45, 'currency', 'RON')
  );
END $$;

select ok((SELECT status = 'succeeded'::payments.payment_intent_status FROM payments.payment_intents WHERE idempotency_key = 'IDEMP-TEST-066-A'), 'Payment Intent successfully transitioned to succeeded');
select ok((SELECT status = 'requires_review'::payments.payment_intent_status FROM payments.payment_intents WHERE idempotency_key = 'IDEMP-TEST-066-B'), 'Payment Intent with mismatch transitioned to requires_review');
select ok((SELECT count(*)::integer = 1 FROM payments.payments WHERE idempotency_key = 'IDEMP-TEST-066-A'), 'Exactly one canonical payment recorded for succeeded intent');
select ok((SELECT count(*)::integer = 1 FROM payments.settlements WHERE settlement_reference = 'SETTLE-EVT-066-001'), 'Exactly one settlement record created for direct association payment');
select ok((SELECT count(*)::integer = 1 FROM payments.webhook_receipts WHERE provider_event_id = 'EVT-066-001'), 'Duplicate webhook acknowledged idempotently with exactly one receipt');
select ok((SELECT processing_status = 'failed' FROM payments.webhook_receipts WHERE provider_event_id = 'EVT-066-002'), 'Webhook with amount mismatch rejected and marked failed');
select ok((SELECT paid_amount = 350.00 FROM billing.receivables WHERE tenant_id = '11111111-1111-4111-8111-111111111111'), 'Receivable fully paid upon webhook success');
select ok((SELECT status = 'paid'::billing.invoice_status FROM billing.invoices WHERE tenant_id = '11111111-1111-4111-8111-111111111111'), 'Invoice status transitioned to paid upon webhook success');
select ok((SELECT count(*)::integer = 1 FROM payments.payment_allocations WHERE tenant_id = '11111111-1111-4111-8111-111111111111' AND status = 'active'), 'Canonical payment allocation recorded');

-- ------------------------------------------------------------
-- 12. Continuous 4111 / 419 Parity & Journal Balance Checks
-- ------------------------------------------------------------
select ok(NOT EXISTS (SELECT 1 FROM finance.journal_entries WHERE tenant_id = '11111111-1111-4111-8111-111111111111' GROUP BY journal_id HAVING sum(CASE WHEN side = 'debit' THEN amount ELSE -amount END) <> 0), 'Zero unbalanced journals in tenant ledger');

-- Finish pgTAP plan
SELECT * FROM finish();

ROLLBACK;
