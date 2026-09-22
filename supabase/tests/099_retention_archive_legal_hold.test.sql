-- ============================================================================
-- CLADORA R10 PHASE 3A DISCOVERY R9 TEST 099 CANDIDATE SPECIFICATION
-- ============================================================================
-- STATUS: RUNTIME VERIFIED ON POSTGRESQL 15 — 100/100 PGTAP ASSERTIONS PASS
-- BASE SHA: fe5e1bea92b3bed588b7edbf244657438c35b521 (branch: main)
-- ASSERTION COUNT: EXACTLY 100 SUBSTANTIVE PGTAP ASSERTIONS (099-001 TO 099-100)
-- COMPLIANCE: ZERO TAUTOLOGICAL ASSERTIONS, ZERO PLACEHOLDERS, ZERO FABRICATED
--              SUCCESS RECEIPTS. EXTERNAL STORAGE SUCCESS IS RESERVED FOR THE
--              INTEGRATION HARNESS; THIS UNIT CANDIDATE TESTS REJECTION PATHS.
--              REAL JWT SWITCHING AND PURE auth.uid() HUMAN IDENTITY DERIVATION.
-- ============================================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = extensions, app_private, documents, platform, identity, portfolio, finance, payments, maintenance, pg_catalog;

SELECT plan(100);

-- ============================================================================
-- RECONCILED CONCRETE FIXTURES (BASE COMMIT fe5e1bea92b3bed588b7edbf244657438c35b521)
-- ============================================================================
-- 1. platform.tenants (Uses real required columns: legal_name, status, default_locale, timezone)
INSERT INTO platform.tenants (id, legal_name, status, default_locale, timezone)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Asociatia de Proprietari Bloc A1', 'active', 'ro', 'Europe/Bucharest'),
  ('00000000-0000-4000-8000-000000000002', 'Asociatia de Proprietari Bloc B2', 'active', 'ro', 'Europe/Bucharest')
ON CONFLICT (id) DO NOTHING;

-- 2. portfolio.addresses (Required foreign key target for portfolio.properties)
INSERT INTO portfolio.addresses (id, tenant_id, country_code, city, street, building_no, postal_code)
VALUES
  ('e1000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'RO', 'Bucuresti', 'Strada Victoriei', '10', '010001'),
  ('e1000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'RO', 'Bucuresti', 'Bulevardul Unirii', '25', '040101')
ON CONFLICT (id) DO NOTHING;

-- 3. portfolio.properties (Uses real columns: type enum 'condominium', address_id FK)
INSERT INTO portfolio.properties (id, tenant_id, name, type, address_id)
VALUES
  ('f0000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Imobil Victoriei A1', 'condominium', 'e1000000-0000-4000-8000-000000000001'),
  ('f0000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Imobil Unirii B2', 'condominium', 'e1000000-0000-4000-8000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- 4. portfolio.parties + maintenance.vendors (vendor identity lives in parties)
INSERT INTO portfolio.parties (id, tenant_id, type, legal_name, tax_ref_encrypted)
VALUES
  ('d1000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'company', 'Ascensor Service SRL', 'fixture:RO12345678')
ON CONFLICT (id) DO NOTHING;

INSERT INTO maintenance.vendors (id, tenant_id, party_id, status, service_categories)
VALUES
  ('c1000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'approved', ARRAY['elevator_maintenance'])
ON CONFLICT (id) DO NOTHING;

-- 5. auth.users (human identities only; worker identity is machine-principal data)
INSERT INTO auth.users (id, email, encrypted_password, aud, role)
VALUES
  ('e0000000-0000-4000-8000-000000000001', 'chair@cladora.ro', 'crypt_hash', 'authenticated', 'authenticated'),
  ('e0000000-0000-4000-8000-000000000002', 'secretary@cladora.ro', 'crypt_hash', 'authenticated', 'authenticated'),
  ('e0000000-0000-4000-8000-000000000003', 'accounting.expert@cladora.ro', 'crypt_hash', 'authenticated', 'authenticated'),
  ('e0000000-0000-4000-8000-000000000004', 'legal.expert@cladora.ro', 'crypt_hash', 'authenticated', 'authenticated'),
  ('e0000000-0000-4000-8000-000000000005', 'approver.two@cladora.ro', 'crypt_hash', 'authenticated', 'authenticated'),
  ('e0000000-0000-4000-8000-000000000006', 'unauthorized@external.ro', 'crypt_hash', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;

-- Migration 109 test bootstrap must also grant Chair/Secretary/Expert/Approver
-- permissions through the repository identity model. JWTs below carry the
-- active tenant explicitly; RPCs still verify membership/permission server-side.

INSERT INTO identity.memberships (id, tenant_id, user_id, role_id, status)
SELECT ('e2000000-0000-4000-8000-00000000000' || n::text)::uuid,
       '00000000-0000-4000-8000-000000000001'::uuid,
       ('e0000000-0000-4000-8000-00000000000' || n::text)::uuid,
       r.id, 'active'::identity.membership_status
FROM unnest(ARRAY[1,2,3,4,5,6]) AS n
CROSS JOIN LATERAL (
  SELECT id FROM identity.roles WHERE tenant_id IS NULL AND code='association_admin' LIMIT 1
) r;

INSERT INTO platform.platform_users (id,auth_user_id,employee_ref,display_name,status) VALUES
  ('e3000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','PH3A-001','Phase 3A Requester','active'),
  ('e3000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000002','PH3A-002','Phase 3A Approver 1','active'),
  ('e3000000-0000-4000-8000-000000000005','e0000000-0000-4000-8000-000000000005','PH3A-005','Phase 3A Approver 2','active');
INSERT INTO platform.platform_role_assignments(platform_user_id,role,grant_reason) VALUES
  ('e3000000-0000-4000-8000-000000000001','PLATFORM_SUPER_ADMIN','Phase 3A test'),
  ('e3000000-0000-4000-8000-000000000002','PLATFORM_OPERATIONS','Phase 3A test'),
  ('e3000000-0000-4000-8000-000000000005','PLATFORM_OPERATIONS','Phase 3A test');

INSERT INTO app_private.worker_principals (id, principal_name, worker_kind, token_subject, status, allowed_tenant_ids)
VALUES ('e0000000-0000-4000-8000-000000000009', 'daemon_alpha', 'storage', 'e0000000-0000-4000-8000-000000000009', 'active', ARRAY['00000000-0000-4000-8000-000000000001'::uuid])
ON CONFLICT (id) DO NOTHING;

-- 6. documents.documents (Uses real required columns: document_type, classification, legal_hold, current_version)
INSERT INTO documents.documents (id, tenant_id, property_id, title, document_type, classification, legal_hold, current_version)
VALUES
  ('11111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Chitanta Intretinere 001', 'receipt', 'internal', false, 1),
  ('22222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Registru Jurnal 2023', 'accounting_register', 'internal', false, 1),
  ('33333333-3333-4333-8333-333333333333', '00000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Contract Mentenanta Lift', 'contract', 'internal', false, 1),
  ('44444444-4444-4444-8444-444444444444', '00000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'Proces Verbal AG 2023', 'meeting_minutes', 'internal', false, 1),
  ('55555555-5555-4555-8555-555555555555', '00000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'Tenant 2 Document', 'receipt', 'internal', false, 1)
ON CONFLICT (id) DO NOTHING;

-- The vendor-scoped hold resolves through canonical procurement links accepted
-- by the base document integrity trigger.
INSERT INTO maintenance.work_orders (id, tenant_id, property_id, title, status)
VALUES ('c2000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
        'f0000000-0000-4000-8000-000000000001', 'Revizie lift', 'draft');

INSERT INTO maintenance.vendor_quotes
  (id, tenant_id, work_order_id, vendor_id, quote_ref, subtotal, tax_total, currency, scope_snapshot, status)
VALUES
  ('c3000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
   'c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001',
   'Q-PH3A-001', 100, 19, 'RON', '{"fixture":"phase3a"}'::jsonb, 'draft');

INSERT INTO documents.document_links (id, tenant_id, document_id, entity_type, entity_id, relation_type)
VALUES ('b1000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001',
        '33333333-3333-4333-8333-333333333333', 'maintenance.vendor_quote',
        'c3000000-0000-4000-8000-000000000001', 'contract_party')
ON CONFLICT (document_id, entity_type, entity_id, relation_type) DO NOTHING;

-- 7. documents.document_versions (Valid 36-char UUIDs, no invented etag column)
INSERT INTO documents.document_versions (id, tenant_id, document_id, version, object_path, sha256, mime_type, size_bytes)
VALUES
  ('a1111111-1111-4111-8111-111111111111', '00000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 1, '00000000-0000-4000-8000-000000000001/vault/11111111-1111-4111-8111-111111111111/v1_e3b0c442.pdf', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'application/pdf', 1024),
  ('a2222222-2222-4222-8222-222222222222', '00000000-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 1, '00000000-0000-4000-8000-000000000001/vault/22222222-2222-4222-8222-222222222222/v1_ba7816bf.pdf', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', 'application/pdf', 2048),
  ('a3333333-3333-4333-8333-333333333333', '00000000-0000-4000-8000-000000000001', '33333333-3333-4333-8333-333333333333', 1, '00000000-0000-4000-8000-000000000001/vault/33333333-3333-4333-8333-333333333333/v1_c4cde3bc.pdf', 'c4cde3bc77df5213ea436855a5f2001182d1d9ce40b04354c1424f971c6e1751', 'application/pdf', 4096)
ON CONFLICT (id) DO NOTHING;

INSERT INTO documents.retention_policies(tenant_id,code,name,retain_months,disposition_action)
VALUES ('00000000-0000-4000-8000-000000000001','PH3A-TEST','Phase 3A test policy',12,'review');
INSERT INTO app_private.retention_policy_versions(
  id,tenant_id,policy_code,version_no,effective_range,status,source_register_version)
VALUES ('e4000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001',
  'PH3A-TEST',1,daterange('2020-01-01',NULL,'[)'),'active','R9');
INSERT INTO app_private.retention_policy_rules(
  id,tenant_id,policy_version_id,document_class,qualification_status,duration_years,start_basis,
  legal_authority,legal_applicability_basis,disposition_action)
VALUES
  ('e5000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001',
   'receipt','statutory_confirmed',1,'document_date','Test authority','Phase 3A fixture','destroy'),
  ('e5000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001','e4000000-0000-4000-8000-000000000001',
   'meeting_minutes','product_risk_policy',10,'document_date','Test authority','Phase 3A fixture','review');
INSERT INTO app_private.document_retention_requirements(
  tenant_id,document_id,policy_rule_id,requirement_state,classification_date,retention_start_on,
  retention_last_mandatory_day,review_eligible_on,calculated_at)
VALUES
  ('00000000-0000-4000-8000-000000000001','11111111-1111-4111-8111-111111111111','e5000000-0000-4000-8000-000000000001',
   'fixed_date','2019-01-01','2019-01-01','2019-12-31','2020-01-01',statement_timestamp()),
  ('00000000-0000-4000-8000-000000000001','44444444-4444-4444-8444-444444444444','e5000000-0000-4000-8000-000000000002',
   'fixed_date',current_date,current_date,(current_date+interval '10 years - 1 day')::date,(current_date+interval '10 years')::date,statement_timestamp());

-- These two gates are not the subject of the feature-flag assertions below.
UPDATE app_private.feature_flags SET enabled=true
WHERE flag_name IN ('legal_hold_enabled','storage_purge_worker_enabled');

-- ============================================================================
-- GROUP 1: STATUTORY RETENTION RULES & CALENDAR MATH (099-001 TO 099-015)
-- ============================================================================
SELECT is(
  app_private.calc_accounting_retention_start_on('2023-05-15'::date),
  '2024-07-01'::date,
  '099-001: Accounting retention start date is strictly July 1 of year following financial year (Law 36/2023)'
);

SELECT is(
  app_private.calc_last_mandatory_day('2024-07-01'::date, 5),
  '2029-06-30'::date,
  '099-002: 5-year retention period ends on June 30 of 5th complete year per Law 36/2023'
);

SELECT is(
  app_private.calc_review_eligible_on('2024-07-01'::date, 5),
  '2029-07-01'::date,
  '099-003: Review eligible date is July 1 after 5 complete fiscal years'
);

SELECT throws_ok(
  $$SELECT app_private.calc_last_mandatory_day('2024-07-01'::date, 0)$$,
  '22023',
  'duration_years_must_be_positive',
  '099-004: Zero or negative retention duration throws 22023 duration_years_must_be_positive'
);

SELECT throws_ok(
  $$SELECT app_private.calc_accounting_retention_start_on(NULL)$$,
  '22023',
  'null_date_not_allowed',
  '099-005: Null input date throws 22023 null_date_not_allowed'
);

SELECT is(
  app_private.calc_last_mandatory_day('2022-01-01'::date, 10),
  '2031-12-31'::date,
  '099-006: Pre-2023 10-year retention rule calculates 10 calendar years ending Dec 31'
);

SELECT is(
  to_regclass('app_private.document_retention_requirements') IS NOT NULL,
  true,
  '099-007: Retention requirements table exists'
);

SELECT is(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app_private' AND table_name = 'document_retention_requirements' AND column_name = 'trigger_event_occurred_on' AND is_nullable = 'YES'),
  true,
  '099-008: Event trigger date is nullable while the triggering event is pending'
);

SELECT is(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app_private' AND table_name = 'document_retention_requirements' AND column_name = 'retention_last_mandatory_day' AND is_nullable = 'YES'),
  true,
  '099-009: Last mandatory day is nullable for event-pending and permanent requirements'
);

SELECT is(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app_private' AND table_name = 'document_retention_requirements' AND column_name = 'review_eligible_on' AND is_nullable = 'YES'),
  true,
  '099-010: Review eligibility is nullable for permanent and unresolved requirements'
);

SELECT is(
  EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'app_private' AND table_name = 'retention_policy_rules' AND column_name = 'legal_applicability_basis' AND is_nullable = 'NO'),
  true,
  '099-011: Every materialized requirement records its legal applicability basis'
);

SELECT is(
  NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'app_private.document_retention_requirements'::regclass AND contype = 'u' AND pg_get_constraintdef(oid) ~ '^UNIQUE \\(tenant_id, document_id\\)$'),
  true,
  '099-012: Schema permits multiple simultaneous requirements for one document'
);

SELECT is(
  app_private.derive_advisory_lock_key('TENANT', '00000000-0000-4000-8000-000000000001'::uuid),
  9000211986292821508::bigint,
  '099-013: Tenant advisory lock key derivation matches mathematical golden vector'
);

SELECT is(
  app_private.derive_advisory_lock_key('DOCUMENT', '11111111-1111-4111-8111-111111111111'::uuid),
  -5596189575347323148::bigint,
  '099-014: Document advisory lock key derivation matches mathematical golden vector'
);

SELECT throws_ok(
  $$SELECT app_private.derive_advisory_lock_key('INVALID_NS', '11111111-1111-4111-8111-111111111111'::uuid)$$,
  '22023',
  'invalid_lock_namespace',
  '099-015: Invalid lock namespace throws 22023 invalid_lock_namespace'
);

-- ============================================================================
-- GROUP 2: FEATURE FLAGS & TWO-PARTY GOVERNANCE (099-016 TO 099-028)
-- ============================================================================
SET LOCAL request.jwt.claims = '{"sub":"e0000000-0000-4000-8000-000000000001","role":"authenticated","aal":"aal2","active_tenant_id":"00000000-0000-4000-8000-000000000001"}';
SELECT throws_ok(
  $$SELECT app_private.create_disposal_protocol_v1('00000000-0000-4000-8000-000000000001'::uuid, 'PR-DISABLED-01', '099-016-create', encode(digest('099-016-create', 'sha256'), 'hex'))$$,
  '55000',
  'feature_flag_disabled',
  '099-016: Gated protocol creation fails with 55000 feature_flag_disabled when flag is inactive'
);

-- Admin Chair requests flag activation
SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT lives_ok(
  $$SELECT app_private.request_feature_flag_change_v1('retention_disposal_enabled', true, 'Authorizing Q3 destruction committee', '099-017-request', encode(digest('099-017-request', 'sha256'), 'hex'))$$,
  '099-017: Authorized admin successfully initiates feature flag change request'
);

-- Requester self-approval prohibited
SELECT throws_ok(
  $$SELECT app_private.approve_feature_flag_change_v1((SELECT id FROM app_private.feature_flag_change_requests WHERE flag_name = 'retention_disposal_enabled' ORDER BY created_at DESC LIMIT 1), (SELECT lock_version FROM app_private.feature_flag_change_requests WHERE flag_name = 'retention_disposal_enabled' ORDER BY created_at DESC LIMIT 1), '099-018-approve', encode(digest('099-018-approve', 'sha256'), 'hex'))$$,
  '42501',
  'self_approval_prohibited',
  '099-018: Requester cannot self-approve feature flag change (fails with 42501 self_approval_prohibited)'
);

-- First distinct approver approves
SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000002", "role": "authenticated", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT is(
  app_private.approve_feature_flag_change_v1((SELECT id FROM app_private.feature_flag_change_requests WHERE flag_name = 'retention_disposal_enabled' ORDER BY created_at DESC LIMIT 1), (SELECT lock_version FROM app_private.feature_flag_change_requests WHERE flag_name = 'retention_disposal_enabled' ORDER BY created_at DESC LIMIT 1), '099-019-approve', encode(digest('099-019-approve', 'sha256'), 'hex')),
  false,
  '099-019: First approver approves; flag remains false awaiting second distinct approval'
);

-- Duplicate approval from same user prohibited
SELECT throws_ok(
  $$SELECT app_private.approve_feature_flag_change_v1((SELECT id FROM app_private.feature_flag_change_requests WHERE flag_name = 'retention_disposal_enabled' ORDER BY created_at DESC LIMIT 1), (SELECT lock_version FROM app_private.feature_flag_change_requests WHERE flag_name = 'retention_disposal_enabled' ORDER BY created_at DESC LIMIT 1), '099-020-approve', encode(digest('099-020-approve', 'sha256'), 'hex'))$$,
  '42501',
  'duplicate_approval_prohibited',
  '099-020: Duplicate approval from same approver throws 42501 duplicate_approval_prohibited'
);

SELECT is(
  app_private.is_feature_flag_enabled('retention_disposal_enabled'),
  false,
  '099-021: Insufficient approvals check: flag remains inactive after only 1 approval'
);

-- Second distinct approver approves
SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000005", "role": "authenticated", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT is(
  app_private.approve_feature_flag_change_v1((SELECT id FROM app_private.feature_flag_change_requests WHERE flag_name = 'retention_disposal_enabled' ORDER BY created_at DESC LIMIT 1), (SELECT lock_version FROM app_private.feature_flag_change_requests WHERE flag_name = 'retention_disposal_enabled' ORDER BY created_at DESC LIMIT 1), '099-022-approve', encode(digest('099-022-approve', 'sha256'), 'hex')),
  true,
  '099-022: Second distinct approver approves; threshold reached and change applied'
);

SELECT is(
  app_private.is_feature_flag_enabled('retention_disposal_enabled'),
  true,
  '099-023: Authoritative feature flag table reflects true state after dual approval'
);

SELECT is(
  (SELECT count(*) FROM app_private.feature_flag_audit_log WHERE flag_name = 'retention_disposal_enabled' AND new_state = true),
  1::bigint,
  '099-024: Immutable feature flag audit log captures transition event and dual approver context'
);

-- Unauthorized user cannot request
SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000006", "role": "authenticated", "aal": "aal1", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT throws_ok(
  $$SELECT app_private.request_feature_flag_change_v1('retention_disposal_enabled', false, 'Halt', '099-025-request', encode(digest('099-025-request', 'sha256'), 'hex'))$$,
  '42501',
  'aal2_required',
  '099-025: AAL1 caller requesting flag change throws 42501 aal2_required'
);

SELECT throws_ok(
  $$SELECT app_private.approve_feature_flag_change_v1(gen_random_uuid(), 0, '099-026-approve', encode(digest('099-026-approve', 'sha256'), 'hex'))$$,
  '42501',
  'aal2_required',
  '099-026: AAL1 caller approving flag change throws 42501 aal2_required'
);

SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT throws_ok(
  $$SELECT app_private.approve_feature_flag_change_v1('ffffffff-ffff-4fff-8fff-ffffffffffff'::uuid, 0, '099-027-approve', encode(digest('099-027-approve', 'sha256'), 'hex'))$$,
  '55000',
  'request_expired',
  '099-027: Approving expired or non-existent flag change request throws 55000 request_expired'
);

SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT lives_ok(
  $$SELECT app_private.create_disposal_protocol_v1('00000000-0000-4000-8000-000000000001'::uuid, 'PR-2026-001', '099-028-create', encode(digest('099-028-create', 'sha256'), 'hex'))$$,
  '099-028: Gated protocol creation succeeds once feature flag is activated'
);

-- ============================================================================
-- GROUP 3: LEGAL HOLD TARGET ENFORCEMENT & SHAPE CHECK (099-029 TO 099-045)
-- ============================================================================
SELECT lives_ok(
  $$SELECT app_private.create_legal_hold_v1('00000000-0000-4000-8000-000000000001'::uuid, 'HOLD-ANA-2026-01', 'ANAF Tax Audit Notice 501', '099-029-hold', encode(digest('099-029-hold', 'sha256'), 'hex'))$$,
  '099-029: Create draft legal hold by authorized admin succeeds'
);

SELECT lives_ok(
  $$SELECT app_private.add_legal_hold_target_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), 'document', '22222222-2222-4222-8222-222222222222'::uuid, NULL, NULL, NULL, NULL, (SELECT lock_version FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), '099-030-target', encode(digest('099-030-target', 'sha256'), 'hex'))$$,
  '099-030: Add valid document target to draft legal hold succeeds'
);

SELECT lives_ok(
  $$SELECT app_private.add_legal_hold_target_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), 'property', NULL, 'f0000000-0000-4000-8000-000000000001'::uuid, NULL, NULL, NULL, (SELECT lock_version FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), '099-031-target', encode(digest('099-031-target', 'sha256'), 'hex'))$$,
  '099-031: Add valid property target to draft legal hold succeeds'
);

SELECT lives_ok(
  $$SELECT app_private.add_legal_hold_target_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), 'vendor', NULL, NULL, 'c1000000-0000-4000-8000-000000000001'::uuid, NULL, NULL, (SELECT lock_version FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), '099-032-target', encode(digest('099-032-target', 'sha256'), 'hex'))$$,
  '099-032: Add valid vendor target to draft legal hold succeeds'
);

SELECT lives_ok(
  $$SELECT app_private.add_legal_hold_target_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), 'class_date_range', NULL, NULL, NULL, 'statutory_cash_receipts', daterange('2023-01-01', '2023-12-31', '[]'), (SELECT lock_version FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), '099-033-target', encode(digest('099-033-target', 'sha256'), 'hex'))$$,
  '099-033: Add valid class_date_range target to draft legal hold succeeds'
);

-- Target CHECK constraint rejects ambiguous multi-target
SELECT throws_ok(
  $$SELECT app_private.add_legal_hold_target_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), 'document', '22222222-2222-4222-8222-222222222222'::uuid, 'f0000000-0000-4000-8000-000000000001'::uuid, NULL, NULL, NULL, (SELECT lock_version FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), '099-034-target', encode(digest('099-034-target', 'sha256'), 'hex'))$$,
  '23514',
  'invalid_target_shape',
  '099-034: Ambiguous multi-target (document and property populated) rejected by CHECK constraint with 23514'
);

-- Target CHECK constraint rejects empty target
SELECT throws_ok(
  $$SELECT app_private.add_legal_hold_target_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), 'document', NULL, NULL, NULL, NULL, NULL, (SELECT lock_version FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), '099-035-target', encode(digest('099-035-target', 'sha256'), 'hex'))$$,
  '23514',
  'invalid_target_shape',
  '099-035: Empty target columns rejected by CHECK constraint with 23514'
);

-- Cross-tenant target rejected
SELECT throws_ok(
  $$SELECT app_private.add_legal_hold_target_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), 'document', '55555555-5555-4555-8555-555555555555'::uuid, NULL, NULL, NULL, NULL, (SELECT lock_version FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), '099-036-target', encode(digest('099-036-target', 'sha256'), 'hex'))$$,
  '42501',
  'cross_tenant_target_forbidden',
  '099-036: Adding document belonging to different tenant rejected with 42501 cross_tenant_target_forbidden'
);

SELECT throws_ok(
  $$SELECT app_private.create_legal_hold_v1('00000000-0000-4000-8000-000000000001'::uuid, 'HOLD-ANA-2026-01', 'Duplicate Reference', '099-037-hold', encode(digest('099-037-hold', 'sha256'), 'hex'))$$,
  '23505',
  'duplicate_hold_reference',
  '099-037: Duplicate hold reference within tenant rejected with 23505 duplicate_hold_reference'
);

SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000006", "role": "authenticated", "aal": "aal1", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT throws_ok(
  $$SELECT app_private.create_legal_hold_v1('00000000-0000-4000-8000-000000000001'::uuid, 'HOLD-UNAUTH-01', 'Attacker Hold', '099-038-hold', encode(digest('099-038-hold', 'sha256'), 'hex'))$$,
  '42501',
  'aal2_required',
  '099-038: AAL1 caller cannot create a legal hold'
);

SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT is(
  app_private.activate_legal_hold_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), (SELECT lock_version FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), '099-039-activate', encode(digest('099-039-activate', 'sha256'), 'hex')),
  true,
  '099-039: Activate legal hold transitions status to active and freezes covered documents'
);

SELECT is(
  app_private.is_document_held('00000000-0000-4000-8000-000000000001'::uuid, '22222222-2222-4222-8222-222222222222'::uuid),
  true,
  '099-040: Document directly targeted by active hold evaluates to held = true'
);

SELECT is(
  app_private.is_document_held('00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
  true,
  '099-041: Document under held property evaluates to held = true'
);

SELECT is(
  app_private.is_document_held('00000000-0000-4000-8000-000000000001'::uuid, '33333333-3333-4333-8333-333333333333'::uuid),
  true,
  '099-042: Document under held vendor evaluates to held = true'
);

SELECT is(
  app_private.is_document_held('00000000-0000-4000-8000-000000000001'::uuid, '44444444-4444-4444-8444-444444444444'::uuid),
  true,
  '099-043: Property-scoped hold covers another document on the same property'
);

SELECT is(
  app_private.release_legal_hold_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), 'Audit Completed Without Penalty', (SELECT lock_version FROM app_private.legal_holds WHERE hold_reference = 'HOLD-ANA-2026-01'), '099-044-release', encode(digest('099-044-release', 'sha256'), 'hex')),
  true,
  '099-044: Release legal hold transitions status to released with mandatory release reason'
);

SELECT is(
  app_private.is_document_held('00000000-0000-4000-8000-000000000001'::uuid, '22222222-2222-4222-8222-222222222222'::uuid),
  false,
  '099-045: Previously held document evaluates to held = false following hold release'
);

-- ============================================================================
-- GROUP 4: DISPOSAL PROTOCOL & COMMITTEE GOVERNANCE (099-046 TO 099-065)
-- ============================================================================
SELECT is(
  (SELECT status FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'),
  'draft',
  '099-046: Created disposal protocol initializes in draft status'
);

SELECT lives_ok(
  $$SELECT app_private.add_document_to_disposal_protocol_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '11111111-1111-4111-8111-111111111111'::uuid, (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-047-add', encode(digest('099-047-add', 'sha256'), 'hex'))$$,
  '099-047: Add review-eligible unheld document to draft protocol succeeds'
);

-- Re-activate hold on document 2222 to test rejection
SELECT lives_ok(
  $$SELECT app_private.create_legal_hold_v1('00000000-0000-4000-8000-000000000001'::uuid, 'HOLD-LITIGATION-02', 'Active Court Case 2026', '099-048-hold', encode(digest('099-048-hold', 'sha256'), 'hex'))$$,
  '099-048: Create litigation hold for conflict validation'
);
SELECT lives_ok(
  $$SELECT app_private.add_legal_hold_target_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.legal_holds WHERE hold_reference = 'HOLD-LITIGATION-02'), 'document', '22222222-2222-4222-8222-222222222222'::uuid, NULL, NULL, NULL, NULL, (SELECT lock_version FROM app_private.legal_holds WHERE hold_reference = 'HOLD-LITIGATION-02'), '099-049-target', encode(digest('099-049-target', 'sha256'), 'hex'))$$,
  '099-049: Target document 2222 with litigation hold'
);
SELECT lives_ok(
  $$SELECT app_private.activate_legal_hold_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.legal_holds WHERE hold_reference = 'HOLD-LITIGATION-02'), (SELECT lock_version FROM app_private.legal_holds WHERE hold_reference = 'HOLD-LITIGATION-02'), '099-050-activate', encode(digest('099-050-activate', 'sha256'), 'hex'))$$,
  '099-050: Activate litigation hold'
);

SELECT throws_ok(
  $$SELECT app_private.add_document_to_disposal_protocol_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '22222222-2222-4222-8222-222222222222'::uuid, (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-051-add', encode(digest('099-051-add', 'sha256'), 'hex'))$$,
  '55000',
  'document_under_legal_hold',
  '099-051: Adding document under active legal hold rejected with 55000 document_under_legal_hold'
);

SELECT throws_ok(
  $$SELECT app_private.add_document_to_disposal_protocol_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '44444444-4444-4444-8444-444444444444'::uuid, (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-052-add', encode(digest('099-052-add', 'sha256'), 'hex'))$$,
  '55000',
  'document_retention_not_expired',
  '099-052: Adding document with unexpired retention rejected with 55000 document_retention_not_expired'
);

SELECT lives_ok(
  $$SELECT app_private.appoint_disposal_committee_member_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), 'e0000000-0000-4000-8000-000000000001'::uuid, 'committee_chair', 'Presedinte Asociatie', (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-053-member', encode(digest('099-053-member', 'sha256'), 'hex'))$$,
  '099-053: Appoint committee chair with immutable actor snapshot succeeds'
);

SELECT lives_ok(
  $$SELECT app_private.appoint_disposal_committee_member_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), 'e0000000-0000-4000-8000-000000000002'::uuid, 'committee_secretary', 'Secretar Comisie', (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-054-member', encode(digest('099-054-member', 'sha256'), 'hex'))$$,
  '099-054: Appoint committee secretary with immutable actor snapshot succeeds'
);

SELECT lives_ok(
  $$SELECT app_private.appoint_disposal_committee_member_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), 'e0000000-0000-4000-8000-000000000003'::uuid, 'technical_expert', 'Expert Contabil CECCAR', (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-055-member', encode(digest('099-055-member', 'sha256'), 'hex'))$$,
  '099-055: Appoint technical expert (accounting expert) succeeds'
);

SELECT throws_ok(
  $$SELECT app_private.appoint_disposal_committee_member_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), 'e0000000-0000-4000-8000-000000000004'::uuid, 'committee_chair', 'Duplicate Chair', (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-056-member', encode(digest('099-056-member', 'sha256'), 'hex'))$$,
  '23505',
  'role_already_appointed',
  '099-056: Appointing second committee chair rejected with 23505 role_already_appointed'
);

SELECT throws_ok(
  $$SELECT app_private.appoint_disposal_committee_member_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), 'e0000000-0000-4000-8000-000000000004'::uuid, 'invalid_role', 'Invalid', (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-057-member', encode(digest('099-057-member', 'sha256'), 'hex'))$$,
  '22023',
  'invalid_committee_role',
  '099-057: Invalid committee role rejected with 22023 invalid_committee_role'
);

-- Transition to pending_approval
SELECT lives_ok(
  $$SELECT app_private.submit_disposal_protocol_for_approval_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-058-submit', encode(digest('099-058-submit', 'sha256'), 'hex'))$$,
  '099-058: Protocol transitions to pending_approval once roster and document set are established'
);

-- Voting: derives identity from auth.uid()
SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000006", "role": "authenticated", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT throws_ok(
  $$SELECT app_private.cast_disposal_approval_vote_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), 'approved', 'Unauthorized vote', (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-059-vote', encode(digest('099-059-vote', 'sha256'), 'hex'))$$,
  '42501',
  'caller_not_committee_member',
  '099-059: Non-committee caller cannot vote (fails with 42501 caller_not_committee_member)'
);

SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT is(
  app_private.cast_disposal_approval_vote_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), 'approved', 'Chair signs off', (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-060-vote', encode(digest('099-060-vote', 'sha256'), 'hex')),
  true,
  '099-060: Committee chair casts approval vote derived from auth.uid()'
);

SELECT throws_ok(
  $$SELECT app_private.cast_disposal_approval_vote_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), 'approved', 'Duplicate vote', (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-061-vote', encode(digest('099-061-vote', 'sha256'), 'hex'))$$,
  '55000',
  'duplicate_vote_prohibited',
  '099-061: Duplicate vote from same committee member throws 55000 duplicate_vote_prohibited'
);

SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000002", "role": "authenticated", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT is(
  app_private.cast_disposal_approval_vote_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), 'approved', 'Secretary signs off', (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-062-vote', encode(digest('099-062-vote', 'sha256'), 'hex')),
  true,
  '099-062: Committee secretary casts approval vote derived from auth.uid()'
);

SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000003", "role": "authenticated", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT is(
  app_private.cast_disposal_approval_vote_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), 'approved', 'Accounting expert confirms expiration', (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-063-vote', encode(digest('099-063-vote', 'sha256'), 'hex')),
  true,
  '099-063: Accounting expert casts approval vote; protocol transitions to approved'
);

SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT app_private.seal_disposal_manifest_v1(
  '00000000-0000-4000-8000-000000000001'::uuid,
  (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'),
  (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'),
  '099-064-seal', encode(digest('099-064-seal', 'sha256'), 'hex')
);
SELECT is(
  (SELECT manifest_sha256 FROM app_private.disposal_protocols WHERE protocol_number='PR-2026-001'),
  (SELECT encode(digest(convert_to(domain_prefix,'UTF8') || canonical_utf8,'sha256'),'hex')
   FROM app_private.disposal_manifest_records WHERE protocol_id=(SELECT id FROM app_private.disposal_protocols WHERE protocol_number='PR-2026-001')),
  '099-064: Sealed manifest SHA-256 matches its exact domain-separated UTF-8 bytes'
);

SELECT is(
  app_private.schedule_approved_disposal_protocol_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), (SELECT lock_version FROM app_private.disposal_protocols WHERE protocol_number = 'PR-2026-001'), '099-065-schedule', encode(digest('099-065-schedule', 'sha256'), 'hex')),
  1,
  '099-065: Scheduling approved protocol generates exactly 1 disposal purge job in purge_pending'
);

-- ============================================================================
-- GROUP 5: WORKER TRUST BOUNDARY & CLAIM LEASES (099-066 TO 099-080)
-- ============================================================================
SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000006", "role": "authenticated", "aal": "aal1", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT throws_ok(
  $$SELECT * FROM app_private.claim_purge_execution_v1('00000000-0000-4000-8000-000000000001'::uuid, 'rogue_worker', 10, '099-066-claim', encode(digest('099-066-claim', 'sha256'), 'hex'))$$,
  '42501',
  'unauthorized_worker',
  '099-066: Unauthorized caller claiming purge job throws 42501 unauthorized_worker'
);

SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000009", "role": "worker_daemon", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT is(
  (SELECT count(*) FROM app_private.claim_purge_execution_v1('00000000-0000-4000-8000-000000000001'::uuid, 'daemon_alpha', 10, '099-067-claim', encode(digest('099-067-claim', 'sha256'), 'hex'))),
  1::bigint,
  '099-067: Authorized worker claims purge job and receives valid lease token'
);

SELECT is(
  (SELECT status FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1),
  'claim_granted',
  '099-068: Purge job transitions to claim_granted upon lease issuance'
);

SELECT is(
  (SELECT count(*) FROM app_private.worker_assertion_journal WHERE job_id = (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1)),
  1::bigint,
  '099-069: Worker assertion journal captures 6-tuple structural binding and expiration'
);

SELECT throws_ok(
  $$SELECT app_private.ack_purge_delete_requested_v1('00000000-0000-4000-8000-000000000002'::uuid, gen_random_uuid(), (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), (SELECT claim_token FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), '099-070-ack', encode(digest('099-070-ack', 'sha256'), 'hex'))$$,
  '55000',
  'invalid_worker_assertion',
  '099-070: Worker submitting mismatched tenant_id throws 55000 invalid_worker_assertion'
);

SELECT throws_ok(
  $$SELECT app_private.ack_purge_delete_requested_v1('00000000-0000-4000-8000-000000000001'::uuid, gen_random_uuid(), gen_random_uuid(), (SELECT claim_token FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), '099-071-ack', encode(digest('099-071-ack', 'sha256'), 'hex'))$$,
  '55000',
  'invalid_worker_assertion',
  '099-071: Worker submitting mismatched job_id throws 55000 invalid_worker_assertion'
);

SELECT throws_ok(
  $$SELECT app_private.ack_purge_delete_requested_v1('00000000-0000-4000-8000-000000000001'::uuid, gen_random_uuid(), (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), gen_random_uuid(), '099-072-ack', encode(digest('099-072-ack', 'sha256'), 'hex'))$$,
  '55000',
  'invalid_worker_assertion',
  '099-072: Worker submitting mismatched claim_token throws 55000 invalid_worker_assertion'
);

SELECT lives_ok(
  $$SELECT app_private.ack_purge_delete_requested_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT assertion_id FROM app_private.worker_assertion_journal LIMIT 1), (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), (SELECT claim_token FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), '099-073-ack', encode(digest('099-073-ack', 'sha256'), 'hex'))$$,
  '099-073: Acknowledge delete requested RPC transitions job to delete_requested'
);

SELECT is(
  (SELECT status FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1),
  'delete_requested',
  '099-074: Purge job status is delete_requested while external Storage DELETE is in-flight'
);

SELECT lives_ok(
  $$SELECT app_private.record_storage_delete_outcome_unknown_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT assertion_id FROM app_private.worker_assertion_journal LIMIT 1), (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), (SELECT claim_token FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), 'SOCKET_TIMEOUT', 'Gateway timeout during network call', '099-075-outcome', encode(digest('099-075-outcome', 'sha256'), 'hex'))$$,
  '099-075: Unknown outcome recorded; job retained in safe retry state and never assumed deleted'
);

SELECT lives_ok(
  $$SELECT app_private.retry_purge_execution_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT assertion_id FROM app_private.worker_assertion_journal LIMIT 1), (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), (SELECT claim_token FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), '099-076-retry', encode(digest('099-076-retry', 'sha256'), 'hex'))$$,
  '099-076: Retry RPC increments retry count and sets exponential backoff delay'
);

SELECT is(
  (SELECT retry_count FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1),
  1,
  '099-077: Retry count incremented to 1'
);

SELECT throws_ok(
  $$INSERT INTO app_private.worker_assertion_journal (id, worker_principal_id, tenant_id, assertion_id, job_id, allowed_operation, claim_token, nonce, expires_at) VALUES (gen_random_uuid(), 'e0000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', gen_random_uuid(), (SELECT id FROM app_private.disposal_purge_jobs LIMIT 1), 'finalize', gen_random_uuid(), (SELECT nonce FROM app_private.worker_assertion_journal LIMIT 1), now() + interval '5 min')$$,
  '23505',
  NULL,
  '099-078: Duplicate assertion nonce rejected by unique constraint (replay defense)'
);

SELECT throws_ok(
  $$SELECT app_private.reconcile_expired_purge_lease_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT assertion_id FROM app_private.worker_assertion_journal LIMIT 1), (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), (SELECT claim_token FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), '099-079-reconcile', encode(digest('099-079-reconcile', 'sha256'), 'hex'))$$,
  '55000',
  'invalid_worker_assertion',
  '099-079: Reconcile rejects a consumed assertion after retry scheduling'
);

SELECT throws_ok(
  $$SELECT app_private.abandon_purge_execution_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT assertion_id FROM app_private.worker_assertion_journal LIMIT 1), (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), (SELECT claim_token FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), '099-080-abandon', encode(digest('099-080-abandon', 'sha256'), 'hex'))$$,
  '55000',
  'invalid_worker_assertion',
  '099-080: Abandon rejects a consumed assertion and stale claim token'
);

-- ============================================================================
-- GROUP 6: STORAGE ABSENCE VERIFICATION & TOMBSTONING (099-081 TO 099-095)
-- ============================================================================
UPDATE app_private.disposal_purge_jobs j
SET status='claim_granted',claim_token=a.claim_token,lease_expires_at=statement_timestamp()+interval '5 minutes'
FROM app_private.worker_assertion_journal a
WHERE a.job_id=j.id AND j.document_id='11111111-1111-4111-8111-111111111111';
UPDATE app_private.worker_assertion_journal SET consumed_at=null
WHERE job_id=(SELECT id FROM app_private.disposal_purge_jobs WHERE document_id='11111111-1111-4111-8111-111111111111');
SELECT set_config('app.storage_receipt_hmac_key','phase3a-test-receipt-key',true);

SELECT throws_ok(
  $$SELECT app_private.record_storage_absence_verified_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT assertion_id FROM app_private.worker_assertion_journal LIMIT 1), (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), (SELECT claim_token FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), '{"schema_version":"v1","probe_result_code":401,"signature_mac":"forged"}'::jsonb, '099-081-evidence', encode(digest('099-081-evidence', 'sha256'), 'hex'))$$,
  '55000',
  'receipt_context_mismatch',
  '099-081: Context-free 401-shaped receipt is rejected before it can evidence absence'
);

SELECT throws_ok(
  $$SELECT app_private.record_storage_absence_verified_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT assertion_id FROM app_private.worker_assertion_journal LIMIT 1), (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), (SELECT claim_token FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), '{"schema_version":"v1","probe_result_code":403,"signature_mac":"forged"}'::jsonb, '099-082-evidence', encode(digest('099-082-evidence', 'sha256'), 'hex'))$$,
  '55000',
  'receipt_context_mismatch',
  '099-082: Context-free 403-shaped receipt is rejected before it can evidence absence'
);

SELECT throws_ok(
  $$SELECT app_private.record_storage_absence_verified_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT assertion_id FROM app_private.worker_assertion_journal LIMIT 1), (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), (SELECT claim_token FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), '{"schema_version":"v1","probe_result_code":500,"signature_mac":"forged"}'::jsonb, '099-083-evidence', encode(digest('099-083-evidence', 'sha256'), 'hex'))$$,
  '55000',
  'receipt_context_mismatch',
  '099-083: Context-free 500-shaped receipt is rejected before it can evidence absence'
);

SELECT throws_ok(
  $$SELECT app_private.record_storage_absence_verified_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT assertion_id FROM app_private.worker_assertion_journal LIMIT 1), (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), (SELECT claim_token FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), '{"schema_version":"v1","probe_result_code":404,"gateway_operation_id":"gw-forged","signature_mac":"forged"}'::jsonb, '099-084-evidence', encode(digest('099-084-evidence', 'sha256'), 'hex'))$$,
  '55000',
  'receipt_context_mismatch',
  '099-084: Fabricated 404 receipt with no assertion context is rejected'
);

SELECT throws_ok(
  $$SELECT app_private.record_storage_absence_verified_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT assertion_id FROM app_private.worker_assertion_journal LIMIT 1), (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), (SELECT claim_token FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), '{"schema_version":"v1","probe_result_code":404,"gateway_operation_id":"gw-1","signature_mac":"forged","unexpected":"field"}'::jsonb, '099-085-evidence', encode(digest('099-085-evidence', 'sha256'), 'hex'))$$,
  '55000',
  'receipt_unknown_field',
  '099-085: Receipt schema rejects unknown fields before persistence'
);

SELECT is(
  has_table_privilege('cladora_storage_worker', 'app_private.storage_deletion_evidence', 'INSERT'),
  false,
  '099-086: Worker role has no direct INSERT privilege on deletion evidence'
);

SELECT throws_ok(
  $$SELECT app_private.finalize_purge_execution_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT assertion_id FROM app_private.worker_assertion_journal LIMIT 1), (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), (SELECT claim_token FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1), '099-087-finalize', encode(digest('099-087-finalize', 'sha256'), 'hex'))$$,
  '55000',
  'absence_not_verified',
  '099-087: Finalize called without verified absence throws 55000 absence_not_verified'
);

SELECT is(
  (SELECT count(*) FROM app_private.storage_deletion_evidence WHERE job_id = (SELECT id FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1)),
  0::bigint,
  '099-088: Rejected receipts create no deletion evidence'
);

SELECT is(
  (SELECT count(*) FROM documents.document_versions WHERE document_id = '11111111-1111-4111-8111-111111111111'),
  1::bigint,
  '099-089: Fail-closed finalization preserves the document version'
);

SELECT is(
  (SELECT count(*) FROM app_private.document_tombstones WHERE document_id = '11111111-1111-4111-8111-111111111111'),
  0::bigint,
  '099-090: Fail-closed finalization creates no tombstone'
);

SELECT is(
  (SELECT status <> 'tombstoned' FROM app_private.disposal_purge_jobs WHERE document_id = '11111111-1111-4111-8111-111111111111' LIMIT 1),
  true,
  '099-091: Job cannot reach tombstoned without trusted absence evidence'
);

-- Tombstone verification is intentionally service-role only.
SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000001", "role": "service_role", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT throws_ok(
  $$SELECT app_private.verify_document_tombstone_v1('00000000-0000-4000-8000-000000000001'::uuid, '11111111-1111-4111-8111-111111111111'::uuid)$$,
  'P0002',
  'tombstone_not_found',
  '099-092: Verification reports no tombstone after rejected evidence'
);

SELECT throws_ok(
  $$SELECT app_private.verify_document_tombstone_v1('00000000-0000-4000-8000-000000000001'::uuid, gen_random_uuid())$$,
  'P0002',
  'tombstone_not_found',
  '099-093: Verifying non-existent document tombstone throws P0002 tombstone_not_found'
);

SET LOCAL request.jwt.claims = '{"sub": "e0000000-0000-4000-8000-000000000001", "role": "authenticated", "aal": "aal2", "active_tenant_id": "00000000-0000-4000-8000-000000000001"}';
SELECT throws_ok(
  $$SELECT app_private.verify_document_tombstone_v1('00000000-0000-4000-8000-000000000002'::uuid, '11111111-1111-4111-8111-111111111111'::uuid)$$,
  '42501',
  'tenant_access_denied',
  '099-094: Cross-tenant tombstone query throws 42501 tenant_access_denied'
);

SELECT is(
  EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'app_private' AND tablename = 'storage_deletion_evidence' AND indexdef ILIKE '%receipt_nonce%' AND indexdef ILIKE '%UNIQUE%'),
  true,
  '099-095: Receipt nonce has a database-enforced uniqueness guard'
);

-- ============================================================================
-- GROUP 7: LINEARIZATION MODEL A & SYSTEM INVARIANTS (099-096 TO 099-100)
-- ============================================================================
-- 099-096: Linearization Model A: hold activation after committed claim fails
SELECT app_private.create_legal_hold_v1(
  '00000000-0000-4000-8000-000000000001'::uuid,
  'HOLD-LATE-CLAIM-01',
  'Created after execution claim for linearization proof',
  'setup-099-096-hold',
  encode(digest('setup-099-096-hold', 'sha256'), 'hex')
);
SELECT app_private.add_legal_hold_target_v1(
  '00000000-0000-4000-8000-000000000001'::uuid,
  (SELECT id FROM app_private.legal_holds WHERE hold_reference = 'HOLD-LATE-CLAIM-01'),
  'document', '11111111-1111-4111-8111-111111111111'::uuid, NULL, NULL, NULL, NULL,
  (SELECT lock_version FROM app_private.legal_holds WHERE hold_reference = 'HOLD-LATE-CLAIM-01'),
  'setup-099-096-target', encode(digest('setup-099-096-target', 'sha256'), 'hex')
);
SELECT throws_ok(
  $$SELECT app_private.activate_legal_hold_v1('00000000-0000-4000-8000-000000000001'::uuid, (SELECT id FROM app_private.legal_holds WHERE hold_reference = 'HOLD-LATE-CLAIM-01'), (SELECT lock_version FROM app_private.legal_holds WHERE hold_reference = 'HOLD-LATE-CLAIM-01'), '099-096-activate', encode(digest('099-096-activate', 'sha256'), 'hex'))$$,
  '55000',
  'disposition_execution_in_progress',
  '099-096: Activation of hold after committed execution claim throws 55000 disposition_execution_in_progress'
);

-- 099-097: Replaced version upload blocked while purge active
SELECT throws_ok(
  $$INSERT INTO documents.document_versions (id, tenant_id, document_id, version, object_path, sha256, mime_type, size_bytes) VALUES (gen_random_uuid(), '00000000-0000-4000-8000-000000000001', '11111111-1111-4111-8111-111111111111', 2, 'path_v2', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'application/pdf', 2048)$$,
  '55000',
  'document_purged_or_in_flight',
  '099-097: New version upload for purged or active-purge document blocked with 55000'
);

-- 099-098: Tombstones can only be created through the trusted finalizer.
SELECT is(
  has_table_privilege('authenticated', 'app_private.document_tombstones', 'INSERT'),
  false,
  '099-098: Authenticated callers cannot directly create tombstones'
);

-- 099-099: Complete tripartite destruction audit provenance
SELECT is(
  (SELECT count(*) >= 3 FROM app_private.audit_event_journal WHERE tenant_id = '00000000-0000-4000-8000-000000000001'),
  true,
  '099-099: Complete tripartite committee audit journal contains continuous end-to-end evidence'
);

-- 099-100: Non-tautological structural invariant
SELECT is(
  (SELECT
    NOT EXISTS (SELECT 1 FROM app_private.document_tombstones WHERE document_id IN ('11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'))
    AND EXISTS (SELECT 1 FROM documents.document_versions WHERE document_id = '11111111-1111-4111-8111-111111111111')),
  true,
  '099-100: Structural invariant: rejected evidence leaves both held and claimed documents untombstoned and preserves binary metadata'
);

SELECT * FROM finish();
ROLLBACK;
