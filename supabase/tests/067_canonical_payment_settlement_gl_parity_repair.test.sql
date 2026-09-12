-- Test 067: Canonical Payment Settlement, Dual-Control Association Configuration & Continuous GL Parity Repair
-- Scope: CLADORA-P2-PAY-003-R3
-- Coverage:
--   1. Schema & Routine contracts (dual-control RPCs, canonical webhook ingestion, IBAN validator)
--   2. Privileges lockdown (service_role only for webhook, authenticated for customer_api, anon denied)
--   3. IBAN normalization, masking, fingerprinting, and mod-97 validation
--   4. Beneficiary account dual control lifecycle:
--      draft -> pending_approval -> approved (active) -> superseded / revoked
--      Strict creator <> approver separation of duty
--      Single active beneficiary invariant per tenant/property/currency
--   5. Allocation policy versioning & immutability
--   6. Immutable payment intent snapshots
--   7. Webhook trust boundary & untrusted tenant isolation
--   8. Canonical double-entry compound settlement journal:
--      Dr 5121 = S, Cr 4111 = A, Cr 419 = U (where S = A + U)
--      Zero direct out-of-band receivables update
--      Binding payment_id and journal_id in settlements chain
--   9. Continuous GL / subledger parity maintenance (ar_delta = 0, clearing_delta = 0)
--  10. Concurrency, replay protection, and zero partial writes
--  11. Reversal boundary fail-closed under DEFERRED-PAYMENT-REVERSAL-PROVIDER

begin;
select plan(49);

-- =============================================================================
-- 1. Routine Existence & Signature Verification
-- =============================================================================

select ok(to_regprocedure('customer_api.create_beneficiary_account_draft_v1(uuid,uuid,uuid,text,text,text,text)') is not null, 'customer_api.create_beneficiary_account_draft_v1 exists');
select ok(to_regprocedure('customer_api.submit_beneficiary_account_for_approval_v1(uuid,uuid)') is not null, 'customer_api.submit_beneficiary_account_for_approval_v1 exists');
select ok(to_regprocedure('customer_api.approve_beneficiary_account_v1(uuid,uuid)') is not null, 'customer_api.approve_beneficiary_account_v1 exists');
select ok(to_regprocedure('customer_api.reject_beneficiary_account_v1(uuid,uuid,text)') is not null, 'customer_api.reject_beneficiary_account_v1 exists');
select ok(to_regprocedure('customer_api.revoke_beneficiary_account_v1(uuid,uuid,text)') is not null, 'customer_api.revoke_beneficiary_account_v1 exists');
select ok(to_regprocedure('customer_api.configure_payment_allocation_policy_v1(uuid,payments.payment_allocation_strategy,payments.penalties_priority,numeric,text,text,text)') is not null, 'customer_api.configure_payment_allocation_policy_v1 exists');
select ok(to_regprocedure('customer_api.list_payment_configuration_v1(uuid,uuid)') is not null, 'customer_api.list_payment_configuration_v1 exists');
select ok(to_regprocedure('payments.process_webhook_event_v1(uuid,text,text,text,text,jsonb)') is not null, 'payments.process_webhook_event_v1 exists');
select ok(to_regprocedure('payments.validate_and_mask_iban(text)') is not null, 'payments.validate_and_mask_iban exists');

-- =============================================================================
-- 2. Privilege Lockdown
-- =============================================================================

select ok(has_function_privilege('service_role', 'payments.process_webhook_event_v1(uuid,text,text,text,text,jsonb)', 'EXECUTE'), 'service_role can execute process_webhook_event_v1');
select ok(not has_function_privilege('anon', 'payments.process_webhook_event_v1(uuid,text,text,text,text,jsonb)', 'EXECUTE'), 'anon denied process_webhook_event_v1');
select ok(not has_function_privilege('authenticated', 'payments.process_webhook_event_v1(uuid,text,text,text,text,jsonb)', 'EXECUTE'), 'authenticated denied process_webhook_event_v1');
select ok(has_function_privilege('authenticated', 'customer_api.create_beneficiary_account_draft_v1(uuid,uuid,uuid,text,text,text,text)', 'EXECUTE'), 'authenticated can execute create_beneficiary_account_draft_v1');
select ok(not has_function_privilege('anon', 'customer_api.create_beneficiary_account_draft_v1(uuid,uuid,uuid,text,text,text,text)', 'EXECUTE'), 'anon denied create_beneficiary_account_draft_v1');

-- =============================================================================
-- 3. Isolated Test Fixtures Setup
-- =============================================================================

do $$
declare
  v_perm_manage uuid;
  v_perm_intent uuid;
  v_perm_alloc uuid;
  v_bank_gl uuid;
  v_ar_gl uuid;
  v_clearing_gl uuid;
begin
  -- Synthetic Test Users
  insert into auth.users (id, email) values
    ('60000000-0000-0000-0000-000000000001', 'mgr1-creator@cladora.test'),
    ('60000000-0000-0000-0000-000000000002', 'mgr2-approver@cladora.test'),
    ('60000000-0000-0000-0000-000000000003', 'resident-payer@cladora.test');

  -- Synthetic Tenant & Customer Workspace
  insert into platform.tenants (id, legal_name, registration_number, status) values
    ('60100000-0000-0000-0000-000000000001', 'P2-PAY Test Tenant', 'RO-TEST-PAY-003', 'active');

  insert into platform.customer_workspaces (id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment, version) values
    ('60800000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001', 'ASSOCIATION', 'ACTIVE', 'Test Owner', 'PILOT', 1);

  insert into platform.workspace_entitlements (customer_workspace_id, entitlement_key, value_type, boolean_value) values
    ('60800000-0000-0000-0000-000000000001', 'module.payments', 'boolean', true),
    ('60800000-0000-0000-0000-000000000001', 'module.accounting', 'boolean', true),
    ('60800000-0000-0000-0000-000000000001', 'module.billing', 'boolean', true);

  -- Roles
  insert into identity.roles (id, tenant_id, code, name) values
    ('60200000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001', 'property_manager', 'Property Manager'),
    ('60200000-0000-0000-0000-000000000002', '60100000-0000-0000-0000-000000000001', 'owner', 'Owner / Resident');

  select id into v_perm_manage from identity.permissions where code = 'payments.manage';
  select id into v_perm_intent from identity.permissions where code = 'payments.intents.create';
  select id into v_perm_alloc from identity.permissions where code = 'payments.allocate';

  insert into identity.role_permissions (role_id, permission_id, effect) values
    ('60200000-0000-0000-0000-000000000001', v_perm_manage, 'allow'),
    ('60200000-0000-0000-0000-000000000001', v_perm_intent, 'allow'),
    ('60200000-0000-0000-0000-000000000001', v_perm_alloc, 'allow'),
    ('60200000-0000-0000-0000-000000000002', v_perm_intent, 'allow')
  on conflict do nothing;

  -- Memberships & Context Grants
  insert into identity.memberships (id, tenant_id, user_id, role_id, status) values
    ('60300000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', '60200000-0000-0000-0000-000000000001', 'active'),
    ('60300000-0000-0000-0000-000000000002', '60100000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', '60200000-0000-0000-0000-000000000001', 'active'),
    ('60300000-0000-0000-0000-000000000003', '60100000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000003', '60200000-0000-0000-0000-000000000002', 'active');

  insert into identity.context_grants (id, tenant_id, membership_id, scope_type) values
    ('60400000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001', '60300000-0000-0000-0000-000000000001', 'tenant'),
    ('60400000-0000-0000-0000-000000000002', '60100000-0000-0000-0000-000000000001', '60300000-0000-0000-0000-000000000002', 'tenant'),
    ('60400000-0000-0000-0000-000000000003', '60100000-0000-0000-0000-000000000001', '60300000-0000-0000-0000-000000000003', 'tenant');

  -- Portfolio Property, Building, Unit & Parties
  insert into portfolio.properties (id, tenant_id, type, name, status) values
    ('60500000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001', 'condominium', 'Test Residence Bloc A', 'active');

  insert into portfolio.buildings (id, tenant_id, property_id, code, name) values
    ('60510000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001', '60500000-0000-0000-0000-000000000001', 'B1', 'Building 1');

  insert into portfolio.units (id, tenant_id, building_id, code, status) values
    ('60520000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001', '60510000-0000-0000-0000-000000000001', 'U-101', 'active');

  insert into portfolio.parties (id, tenant_id, type, legal_name) values
    ('60530000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001', 'person', 'Popescu Ion');

  insert into portfolio.ownerships (tenant_id, unit_id, party_id, share, valid_from) values
    ('60100000-0000-0000-0000-000000000001', '60520000-0000-0000-0000-000000000001', '60530000-0000-0000-0000-000000000001', 1.0, current_date);

  insert into identity.membership_parties (membership_id, party_id, tenant_id) values
    ('60300000-0000-0000-0000-000000000003', '60530000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001');

  -- GL Chart of Accounts (5121 Bank, 4111 Receivables, 419 Clearing Advances)
  insert into finance.accounts (id, tenant_id, property_id, code, name, type, currency) values
    ('60600000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001', '60500000-0000-0000-0000-000000000001', '5121', 'Conturi la banci in lei', 'asset', 'RON'),
    ('60600000-0000-0000-0000-000000000002', '60100000-0000-0000-0000-000000000001', '60500000-0000-0000-0000-000000000001', '4111', 'Clienti / Proprietari cote intretinere', 'asset', 'RON'),
    ('60600000-0000-0000-0000-000000000003', '60100000-0000-0000-0000-000000000001', '60500000-0000-0000-0000-000000000001', '419', 'Clienti - creditori (Avansuri incasate)', 'liability', 'RON'),
    ('60600000-0000-0000-0000-000000000004', '60100000-0000-0000-0000-000000000001', '60500000-0000-0000-0000-000000000001', '704', 'Venituri din servicii prestate', 'income', 'RON');

  -- Association Bank Account Record
  insert into payments.bank_accounts (id, tenant_id, property_id, bank_name, iban_encrypted, iban_fingerprint, currency, status) values
    ('60700000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001', '60500000-0000-0000-0000-000000000001', 'Banca Transilvania', 'enc_RO37BTRL0000000000000001', 'fp_RO37BTRL0000000000000001', 'RON', 'active');

  -- Invoice & Receivable fixture: Total due = 200.00 RON
  insert into billing.invoices (id, tenant_id, property_id, unit_id, liable_party_id, period_start, period_end, issued_on, due_on, subtotal, tax_total, status) values
    ('60900000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001', '60500000-0000-0000-0000-000000000001', '60520000-0000-0000-0000-000000000001', '60530000-0000-0000-0000-000000000001', current_date - 30, current_date, current_date, current_date + 15, 200.00, 0.00, 'issued');

  insert into billing.receivables (id, tenant_id, invoice_id, original_amount, paid_amount, credited_amount) values
    ('60910000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001', '60900000-0000-0000-0000-000000000001', 200.00, 0.00, 0.00);

  -- Initial posted Invoice Journal: Dr 4111 = 200, Cr 704 = 200
  insert into finance.journals (id, tenant_id, property_id, occurred_on, currency, description, source_type, source_id, status) values
    ('60920000-0000-0000-0000-000000000001', '60100000-0000-0000-0000-000000000001', '60500000-0000-0000-0000-000000000001', current_date, 'RON', 'Initial bill', 'billing.invoice', '60900000-0000-0000-0000-000000000001', 'draft');

  insert into finance.journal_entries (tenant_id, journal_id, account_id, unit_id, party_id, side, amount, memo) values
    ('60100000-0000-0000-0000-000000000001', '60920000-0000-0000-0000-000000000001', '60600000-0000-0000-0000-000000000002', '60520000-0000-0000-0000-000000000001', '60530000-0000-0000-0000-000000000001', 'debit', 200.00, 'Initial AR bill entry'),
    ('60100000-0000-0000-0000-000000000001', '60920000-0000-0000-0000-000000000001', '60600000-0000-0000-0000-000000000004', '60520000-0000-0000-0000-000000000001', '60530000-0000-0000-0000-000000000001', 'credit', 200.00, 'Initial revenue entry');

  update finance.journals
  set status = 'posted',
      posted_at = statement_timestamp(),
      posted_by = '60000000-0000-0000-0000-000000000001'
  where id = '60920000-0000-0000-0000-000000000001';
end $$;

-- =============================================================================
-- 4. IBAN Validation & Masking Contract
-- =============================================================================

select lives_ok(
  $$ select * from payments.validate_and_mask_iban('RO37BTRL0000000000000001') $$,
  'valid Romanian IBAN passes checksum validation'
);

select throws_ok(
  $$ select * from payments.validate_and_mask_iban('RO37BTRL0000000000000009') $$,
  '22023',
  'invalid_iban_checksum',
  'invalid checksum throws 22023'
);

select throws_ok(
  $$ select * from payments.validate_and_mask_iban('RO123') $$,
  '22023',
  'invalid_iban_length',
  'short IBAN throws 22023'
);

-- =============================================================================
-- 5. Beneficiary Account Dual-Control Lifecycle
-- =============================================================================

-- 5.1 Manager 1 creates Draft (status = 'draft')
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"60100000-0000-0000-0000-000000000001"}', true);

select ok(
  (customer_api.create_beneficiary_account_draft_v1(
    '60400000-0000-0000-0000-000000000001'::uuid,
    '60500000-0000-0000-0000-000000000001'::uuid,
    '60700000-0000-0000-0000-000000000001'::uuid,
    'Asociatia de Proprietari Bloc A',
    'Banca Transilvania',
    'RON',
    'RO37BTRL0000000000000001'
  )->'beneficiary_account'->>'status') = 'draft',
  'Manager 1 can create beneficiary account draft'
);

select ok(
  (select status from payments.beneficiary_accounts where tenant_id = '60100000-0000-0000-0000-000000000001' and version = 1) = 'draft',
  'beneficiary account initial status is draft'
);

-- 5.2 Manager 1 submits draft for approval (status = 'pending_approval')
select ok(
  (customer_api.submit_beneficiary_account_for_approval_v1(
    '60400000-0000-0000-0000-000000000001'::uuid,
    (select id from payments.beneficiary_accounts where tenant_id = '60100000-0000-0000-0000-000000000001' and version = 1)
  )->'beneficiary_account'->>'status') = 'pending_approval',
  'Manager 1 can submit draft for approval'
);

select ok(
  (select status from payments.beneficiary_accounts where tenant_id = '60100000-0000-0000-0000-000000000001' and version = 1) = 'pending_approval',
  'beneficiary account transitioned to pending_approval'
);

-- 5.3 Creator cannot approve own draft (dual control separation of duty)
select throws_ok(
  $$
  set local role authenticated;
  set local "request.jwt.claims" to '{"sub":"60000000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"60100000-0000-0000-0000-000000000001"}';
  select customer_api.approve_beneficiary_account_v1(
    '60400000-0000-0000-0000-000000000001'::uuid,
    (select id from payments.beneficiary_accounts where tenant_id = '60100000-0000-0000-0000-000000000001' and version = 1)
  );
  $$,
  '42501',
  'dual_control_violation_creator_cannot_approve',
  'creator is strictly prohibited from approving own beneficiary draft'
);

-- 5.4 Independent Manager 2 approves draft (status = 'active')
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000002","aal":"aal2","active_tenant_id":"60100000-0000-0000-0000-000000000001"}', true);

select ok(
  (customer_api.approve_beneficiary_account_v1(
    '60400000-0000-0000-0000-000000000002'::uuid,
    (select id from payments.beneficiary_accounts where tenant_id = '60100000-0000-0000-0000-000000000001' and version = 1)
  )->'beneficiary_account'->>'status') = 'active',
  'Independent Manager 2 can approve and activate beneficiary account'
);

select ok(
  (select status from payments.beneficiary_accounts where tenant_id = '60100000-0000-0000-0000-000000000001' and version = 1) = 'active',
  'beneficiary account status is now active'
);

-- 5.5 Create version 2 and approve: Version 1 must become 'superseded'
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"60100000-0000-0000-0000-000000000001"}', true);
select customer_api.create_beneficiary_account_draft_v1(
  '60400000-0000-0000-0000-000000000001'::uuid,
  '60500000-0000-0000-0000-000000000001'::uuid,
  '60700000-0000-0000-0000-000000000001'::uuid,
  'Asociatia de Proprietari Bloc A - Nou',
  'Banca Transilvania',
  'RON',
  'RO37BTRL0000000000000001'
);
select customer_api.submit_beneficiary_account_for_approval_v1(
  '60400000-0000-0000-0000-000000000001'::uuid,
  (select id from payments.beneficiary_accounts where tenant_id = '60100000-0000-0000-0000-000000000001' and version = 2)
);
select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000002","aal":"aal2","active_tenant_id":"60100000-0000-0000-0000-000000000001"}', true);

select ok(
  (customer_api.approve_beneficiary_account_v1(
    '60400000-0000-0000-0000-000000000002'::uuid,
    (select id from payments.beneficiary_accounts where tenant_id = '60100000-0000-0000-0000-000000000001' and version = 2)
  )->'beneficiary_account'->>'status') = 'active',
  'Version 2 created, submitted and approved'
);

select ok(
  (select status from payments.beneficiary_accounts where tenant_id = '60100000-0000-0000-0000-000000000001' and version = 1) = 'superseded',
  'previous version 1 is atomically superseded'
);

select ok(
  (select count(*) from payments.beneficiary_accounts where tenant_id = '60100000-0000-0000-0000-000000000001' and status = 'active') = 1,
  'strictly exactly 1 active beneficiary account exists'
);

-- =============================================================================
-- 6. Payment Allocation Policy Configuration
-- =============================================================================

select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"60100000-0000-0000-0000-000000000001"}', true);
select ok(
  (customer_api.configure_payment_allocation_policy_v1(
    '60400000-0000-0000-0000-000000000001'::uuid,
    'oldest_due_first',
    'principal_first',
    1.00,
    'credit_balance',
    'apply_to_next',
    'AG-TEST-DECISION-01'
  )->'payment_allocation_policy'->>'strategy') = 'oldest_due_first',
  'Manager can configure payment allocation policy'
);

select ok(
  (select count(*) from payments.payment_allocation_policies where tenant_id = '60100000-0000-0000-0000-000000000001' and effective_to is null) = 1,
  'exactly 1 active payment allocation policy exists'
);

-- =============================================================================
-- 7. Payment Intent Creation with Frozen Immutable Snapshot
-- =============================================================================

select set_config('request.jwt.claims', '{"sub":"60000000-0000-0000-0000-000000000003","aal":"aal1","active_tenant_id":"60100000-0000-0000-0000-000000000001"}', true);
select ok(
  (customer_api.create_payment_intent_v1(
    '60400000-0000-0000-0000-000000000003'::uuid,
    '60520000-0000-0000-0000-000000000001'::uuid,
    '[]'::jsonb,
    200.00,
    'RON',
    'bank_transfer',
    'IDEM-TEST-INTENT-001'
  )->>'status') = 'created',
  'Resident can create payment intent for 200 RON'
);

select ok(
  (select configuration_snapshot is not null from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001'),
  'payment intent has immutable configuration snapshot'
);

select ok(
  (select beneficiary_snapshot->>'masked_iban' from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001') = 'RO37****0001',
  'payment intent beneficiary snapshot contains correct masked IBAN'
);

-- =============================================================================
-- 8. Webhook Trust Boundary & Header Tenant Isolation
-- =============================================================================

select throws_ok(
  $$
  set local role service_role;
  select payments.process_webhook_event_v1(
    '11111111-2222-3333-4444-555555555555'::uuid, -- untrusted forged tenant
    'provider_sandbox',
    'EVT-TEST-001',
    'payment.succeeded',
    'hash123',
    jsonb_build_object(
      'payment_intent_id', (select id from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001'),
      'amount', 200.00,
      'currency', 'RON'
    )
  );
  $$,
  '42501',
  'untrusted_tenant_boundary_violation',
  'untrusted header tenant mismatch is rejected fail-closed'
);
reset role;

-- =============================================================================
-- 9. Canonical Compound Settlement & GL Parity Verification
-- =============================================================================

set local role service_role;
select ok(
  (payments.process_webhook_event_v1(
    null,
    'provider_sandbox',
    'EVT-TEST-001',
    'payment.succeeded',
    'hash123',
    jsonb_build_object(
      'payment_intent_id', (select id from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001'),
      'amount', 200.00,
      'currency', 'RON'
    )
  )->>'status') = 'succeeded',
  'process_webhook_event_v1 successfully processes valid settlement event'
);
reset role;

select ok(
  (select status from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001') = 'succeeded',
  'payment intent transitioned to succeeded'
);

select ok(
  (select count(*) from payments.payments where payment_intent_id = (select id from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001')) = 1,
  'exactly 1 payment record created'
);

select ok(
  (select count(*) from payments.settlements where payment_intent_id = (select id from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001')) = 1,
  'exactly 1 settlement record created'
);

select ok(
  (select payment_id is not null and journal_id is not null from payments.settlements where payment_intent_id = (select id from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001')),
  'settlement chain binds payment_id and journal_id'
);

select ok(
  (select status from billing.invoices where id = '60900000-0000-0000-0000-000000000001') = 'paid',
  'invoice is marked paid via canonical allocation'
);

select ok(
  (select outstanding_amount from billing.receivables where id = '60910000-0000-0000-0000-000000000001') = 0.00,
  'receivable outstanding amount is now 0.00'
);

-- Verify balanced journal posting: Dr 5121 = 200, Cr 4111 = 200
select ok(
  (select count(*) from finance.journal_entries je
   join finance.journals j on j.id = je.journal_id
   where j.source_id = (select id from payments.settlements where payment_intent_id = (select id from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001'))
     and je.side = 'debit' and je.amount = 200.00) = 1,
  'journal contains exactly 1 debit of 200 to bank'
);

select ok(
  (select count(*) from finance.journal_entries je
   join finance.journals j on j.id = je.journal_id
   where j.source_id = (select id from payments.settlements where payment_intent_id = (select id from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001'))
     and je.side = 'credit' and je.amount = 200.00) = 1,
  'journal contains exactly 1 credit of 200 to receivables'
);

-- =============================================================================
-- 10. Continuous GL / Subledger Parity Assertion
-- =============================================================================

select ok(
  (select (finance.get_ar_subledger_parity(
    '60100000-0000-0000-0000-000000000001'::uuid,
    '60500000-0000-0000-0000-000000000001'::uuid,
    'RON'
  ))->>'is_continuous_parity') = 'true',
  'continuous GL parity is true after direct settlement'
);

select ok(
  (select ((finance.get_ar_subledger_parity(
    '60100000-0000-0000-0000-000000000001'::uuid,
    '60500000-0000-0000-0000-000000000001'::uuid,
    'RON'
  ))->>'ar_delta')::numeric) = 0.00,
  'AR delta is exactly 0.00'
);

select ok(
  (select ((finance.get_ar_subledger_parity(
    '60100000-0000-0000-0000-000000000001'::uuid,
    '60500000-0000-0000-0000-000000000001'::uuid,
    'RON'
  ))->>'clearing_delta')::numeric) = 0.00,
  'Clearing delta is exactly 0.00'
);

-- =============================================================================
-- 11. Concurrency, Replay Protection & Reversal Boundary
-- =============================================================================

-- Duplicate replay returns ignored duplicate
select ok(
  (select (payments.process_webhook_event_v1(
    null,
    'provider_sandbox',
    'EVT-TEST-001',
    'payment.succeeded',
    'hash123',
    jsonb_build_object(
      'payment_intent_id', (select id from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001'),
      'amount', 200.00,
      'currency', 'RON'
    )
  ))->>'status') = 'ignored',
  'duplicate webhook event replay returns status ignored'
);

-- Loser delivery for terminal intent returns ignored
select ok(
  (select (payments.process_webhook_event_v1(
    null,
    'provider_sandbox',
    'EVT-TEST-002',
    'payment.succeeded',
    'hash123-alt',
    jsonb_build_object(
      'payment_intent_id', (select id from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001'),
      'amount', 200.00,
      'currency', 'RON'
    )
  ))->>'status') = 'ignored',
  'competing webhook event for already terminal intent returns status ignored'
);

-- Zero partial writes: verify still exactly 1 payment and 1 settlement
select ok(
  (select count(*) from payments.payments where payment_intent_id = (select id from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001')) = 1,
  'concurrency losers produce zero partial payments'
);

-- Reversal event fail-closed under DEFERRED-PAYMENT-REVERSAL-PROVIDER
select ok(
  (select (payments.process_webhook_event_v1(
    null,
    'provider_sandbox',
    'EVT-TEST-REV-001',
    'payment.refunded',
    'hashrev',
    jsonb_build_object(
      'payment_intent_id', (select id from payments.payment_intents where idempotency_key = 'IDEM-TEST-INTENT-001'),
      'amount', 200.00,
      'currency', 'RON'
    )
  ))->>'reason') = 'DEFERRED-PAYMENT-REVERSAL-PROVIDER',
  'refund webhook event is fail-closed under DEFERRED-PAYMENT-REVERSAL-PROVIDER'
);

rollback;
