-- R10 Phase 2B: Romanian HOA petty cash controls under Law 196/2018 Art. 67(5)
-- and statutory cash documents (14-4-1 Chitanță, 14-4-4 Dispoziție casierie).
begin;
select plan(85);

-- 1. Structural, RLS and ACL contracts
select has_table('finance', 'statutory_petty_cash_authorizations', 'petty cash authorizations table exists');
select has_table('finance', 'statutory_petty_cash_expenses', 'petty cash expenses table exists');
select has_table('finance', 'statutory_petty_cash_expense_reversals', 'petty cash expense reversals table exists');
select has_table('finance', 'statutory_cash_receipt_petty_cash_retentions', 'petty cash receipt retentions table exists');
select has_table('finance', 'statutory_petty_cash_retention_consumptions', 'petty cash retention consumptions table exists');
select has_table('finance', 'statutory_petty_cash_retention_consumption_releases', 'petty cash retention consumption releases table exists');
select has_table('finance', 'statutory_petty_cash_activation_events', 'petty cash activation events table exists');
select has_table('finance', 'statutory_cash_documents', 'statutory cash documents table exists');
select has_table('finance', 'statutory_cash_document_verification_events', 'cash document verification events table exists');
select has_table('finance', 'statutory_cash_document_finalization_events', 'cash document finalization events table exists');

select ok(
  exists(select 1 from information_schema.columns where table_schema = 'finance' and table_name = 'statutory_petty_cash_authorizations' and column_name = 'custodian_name'),
  'custodian_name column exists on authorizations'
);

select has_function('finance', 'statutory_petty_cash_balance_v1', array['uuid', 'timestamp with time zone'], 'derived petty cash balance function exists');

select has_function(
  'app_private', 'authorize_statutory_petty_cash_v1',
  array['uuid', 'uuid', 'numeric', 'date', 'text', 'text', 'uuid', 'text', 'text'],
  'controlled petty cash authorization RPC exists with custodian_name parameter'
);
select has_function(
  'app_private', 'activate_statutory_petty_cash_v1',
  array['uuid', 'uuid', 'uuid', 'text', 'text'],
  'controlled petty cash activation RPC exists'
);
select has_function(
  'app_private', 'retain_petty_cash_from_receipt_v1',
  array['uuid', 'uuid', 'numeric', 'uuid', 'text', 'text'],
  'controlled petty cash receipt retention RPC exists'
);
select has_function(
  'app_private', 'record_statutory_petty_cash_expense_v1',
  array['uuid', 'uuid', 'text', 'text', 'uuid', 'text', 'text'],
  'controlled petty cash expense recording RPC exists with simple entry link'
);
select has_function(
  'app_private', 'reverse_statutory_petty_cash_expense_v1',
  array['uuid', 'uuid', 'text', 'uuid', 'text', 'text'],
  'controlled petty cash expense reversal RPC exists with refund entry link'
);
select has_function(
  'app_private', 'create_statutory_cash_document_v1',
  array['uuid', 'finance.statutory_cash_document_type', 'text', 'text', 'date', 'numeric', 'text', 'text', 'jsonb', 'uuid', 'uuid', 'uuid', 'text', 'text'],
  'controlled statutory cash document creation RPC exists'
);
select has_function(
  'app_private', 'verify_statutory_cash_document_semantic_schema_v1',
  array['uuid', 'integer', 'uuid', 'text', 'text', 'text'],
  'controlled statutory cash document semantic schema verification RPC exists'
);
select has_function(
  'app_private', 'finalize_statutory_cash_document_v1',
  array['uuid', 'integer', 'uuid', 'text', 'text', 'text'],
  'controlled statutory cash document finalization RPC exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'finance.statutory_petty_cash_authorizations'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_petty_cash_expenses'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_petty_cash_expense_reversals'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_receipt_petty_cash_retentions'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_petty_cash_retention_consumptions'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_petty_cash_retention_consumption_releases'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_petty_cash_activation_events'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_documents'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_document_verification_events'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_document_finalization_events'::regclass),
  'petty cash tables, events, and cash documents have RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'finance.statutory_petty_cash_authorizations', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_petty_cash_authorizations', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'finance.statutory_petty_cash_expense_reversals', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_petty_cash_expense_reversals', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'finance.statutory_petty_cash_retention_consumptions', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_petty_cash_retention_consumptions', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'finance.statutory_petty_cash_retention_consumption_releases', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_petty_cash_retention_consumption_releases', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_function_privilege('anon', 'app_private.authorize_statutory_petty_cash_v1(uuid,uuid,numeric,date,text,text,uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app_private.authorize_statutory_petty_cash_v1(uuid,uuid,numeric,date,text,text,uuid,text,text)', 'EXECUTE'),
  'anon and authenticated roles have zero mutation access to petty cash tables and RPCs'
);

select ok(
  not has_table_privilege('service_role', 'finance.statutory_petty_cash_retention_consumptions', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role', 'finance.statutory_petty_cash_retention_consumption_releases', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role', 'finance.statutory_petty_cash_expenses', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role', 'finance.statutory_petty_cash_expense_reversals', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role', 'finance.statutory_petty_cash_activation_events', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role', 'finance.statutory_cash_document_verification_events', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('service_role', 'finance.statutory_cash_document_finalization_events', 'INSERT,UPDATE,DELETE'),
  'service_role has zero direct insert/update/delete privilege on internal append-only ledgers and events'
);

-- 2. Fixture Setup (098 Isolated Space)
insert into auth.users (id, email) values
  ('09800000-0000-0000-0000-000000000001', 'r10-phase2b-petty@cladora.test');

insert into platform.tenants (id, legal_name, registration_number, status) values
  ('09800000-0000-0000-0000-000000000010', 'R10 Phase 2B Petty Cash Tenant', 'RO-R10-098', 'active');

insert into platform.customer_workspaces (
  id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment
) values (
  '09800000-0000-0000-0000-000000000020', '09800000-0000-0000-0000-000000000010',
  'ASSOCIATION', 'ACTIVE', 'R10 Test', 'PILOT'
);

insert into portfolio.properties (id, tenant_id, type, name, status) values
  ('09800000-0000-0000-0000-000000000030', '09800000-0000-0000-0000-000000000010', 'condominium', 'Property 098', 'active'),
  ('09800000-0000-0000-0000-000000000031', '09800000-0000-0000-0000-000000000010', 'condominium', 'Foreign Property 098', 'active');

insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on, status) values
  ('09800000-0000-0000-0000-000000000040', '09800000-0000-0000-0000-000000000010', '09800000-0000-0000-0000-000000000030',
   date '2026-01-01', (date_trunc('month', statement_timestamp() at time zone 'Europe/Bucharest') + interval '2 months')::date, 'open');

insert into finance.statutory_accounting_regimes (
  id, tenant_id, customer_workspace_id, property_id, status, statutory_operations_enabled,
  accounting_signoff_reference, accounting_signed_at, legal_signoff_reference, legal_signed_at,
  activated_at, valid_from
) values (
  '09800000-0000-0000-0000-000000000050', '09800000-0000-0000-0000-000000000010',
  '09800000-0000-0000-0000-000000000020', '09800000-0000-0000-0000-000000000030',
  'active', true, 'CECCAR-098', statement_timestamp(), 'LEGAL-098', statement_timestamp(),
  statement_timestamp(), date '2026-01-01'
);

insert into finance.statutory_monthly_cycles (
  id, regime_id, tenant_id, property_id, accounting_period_id, status
) values (
  '09800000-0000-0000-0000-000000000065', '09800000-0000-0000-0000-000000000050',
  '09800000-0000-0000-0000-000000000010', '09800000-0000-0000-0000-000000000030',
  '09800000-0000-0000-0000-000000000040', 'collecting'
);

-- Active Cash Desk 1
insert into finance.statutory_cash_desks (
  id, tenant_id, property_id, regime_id, code, name, currency, status,
  daily_ceiling_amount, idempotency_key, payload_hash, created_by, activated_by, activated_at
) values (
  '09800000-0000-0000-0000-000000000060', '09800000-0000-0000-0000-000000000010',
  '09800000-0000-0000-0000-000000000030', '09800000-0000-0000-0000-000000000050',
  'CASH-098-A', 'Casierie 098 A', 'RON', 'active', 50000.00,
  'idemp-desk-098-a', repeat('0', 64), '09800000-0000-0000-0000-000000000001',
  '09800000-0000-0000-0000-000000000001', statement_timestamp()
);

-- Active Cash Desk 2 (same property)
insert into finance.statutory_cash_desks (
  id, tenant_id, property_id, regime_id, code, name, currency, status,
  daily_ceiling_amount, idempotency_key, payload_hash, created_by, activated_by, activated_at
) values (
  '09800000-0000-0000-0000-000000000061', '09800000-0000-0000-0000-000000000010',
  '09800000-0000-0000-0000-000000000030', '09800000-0000-0000-0000-000000000050',
  'CASH-098-B', 'Casierie 098 B', 'RON', 'active', 50000.00,
  'idemp-desk-098-b', repeat('0', 64), '09800000-0000-0000-0000-000000000001',
  '09800000-0000-0000-0000-000000000001', statement_timestamp()
);

-- Governance meetings & resolutions
insert into governance.meetings (
  id, tenant_id, property_id, title, meeting_type, scheduled_at, status, quorum_rule, created_by
) values
  ('09800000-0000-0000-0000-000000000070', '09800000-0000-0000-0000-000000000010',
   '09800000-0000-0000-0000-000000000030', 'Adunare Generala 2026', 'general_assembly',
   statement_timestamp(), 'closed', '{"rule":"statutory"}'::jsonb, '09800000-0000-0000-0000-000000000001'),
  ('09800000-0000-0000-0000-000000000071', '09800000-0000-0000-0000-000000000010',
   '09800000-0000-0000-0000-000000000031', 'Adunare Generala Foreign Property', 'general_assembly',
   statement_timestamp(), 'closed', '{"rule":"statutory"}'::jsonb, '09800000-0000-0000-0000-000000000001');

insert into governance.agenda_items (id, tenant_id, meeting_id, sequence_no, title, decision_required) values
  ('09800000-0000-0000-0000-000000000072', '09800000-0000-0000-0000-000000000010',
   '09800000-0000-0000-0000-000000000070', 1, 'Aprobare avans cheltuieli neprevazute', true),
  ('09800000-0000-0000-0000-000000000073', '09800000-0000-0000-0000-000000000010',
   '09800000-0000-0000-0000-000000000071', 1, 'Foreign resolution', true);

insert into governance.resolutions (
  id, tenant_id, meeting_id, agenda_item_id, resolution_no, title, text_body, adopted, result_snapshot, effective_on
) values
  ('09800000-0000-0000-0000-000000000074', '09800000-0000-0000-0000-000000000010',
   '09800000-0000-0000-0000-000000000070', '09800000-0000-0000-0000-000000000072',
   'HOT-098-1', 'Aprobare avans cheltuieli neprevazute', 'Aprobat fond 1000 RON', true,
   '{"adopted":true}'::jsonb, date '2026-01-01'),
  ('09800000-0000-0000-0000-000000000075', '09800000-0000-0000-0000-000000000010',
   '09800000-0000-0000-0000-000000000070', '09800000-0000-0000-0000-000000000072',
   'HOT-098-2', 'Hotarare respinsa', 'Respins', false,
   '{"adopted":false}'::jsonb, date '2026-01-01'),
  ('09800000-0000-0000-0000-000000000076', '09800000-0000-0000-0000-000000000010',
   '09800000-0000-0000-0000-000000000071', '09800000-0000-0000-0000-000000000073',
   'HOT-098-FOREIGN', 'Foreign adopted', 'Aprobat', true,
   '{"adopted":true}'::jsonb, date '2026-01-01');

-- Simple Entries for Petty Cash
insert into finance.statutory_simple_entries (
  id, cycle_id, tenant_id, property_id, entry_date, direction, payment_medium,
  document_type, document_number, amount, description, created_by
) values
  ('09800000-0000-0000-0000-000000000080', '09800000-0000-0000-0000-000000000065',
   '09800000-0000-0000-0000-000000000010', '09800000-0000-0000-0000-000000000030',
   (statement_timestamp() at time zone 'Europe/Bucharest')::date, 'receipt', 'cash', 'CHITANTA', 'CH-098-FUND1', 1000.00, 'Cash funding 1',
   '09800000-0000-0000-0000-000000000001'),
  ('09800000-0000-0000-0000-000000000084', '09800000-0000-0000-0000-000000000065',
   '09800000-0000-0000-0000-000000000010', '09800000-0000-0000-0000-000000000030',
   (statement_timestamp() at time zone 'Europe/Bucharest')::date, 'receipt', 'cash', 'CHITANTA', 'CH-098-FUND2', 1000.00, 'Cash funding 2',
   '09800000-0000-0000-0000-000000000001'),
  ('09800000-0000-0000-0000-000000000081', '09800000-0000-0000-0000-000000000065',
   '09800000-0000-0000-0000-000000000010', '09800000-0000-0000-0000-000000000030',
   (statement_timestamp() at time zone 'Europe/Bucharest')::date, 'payment', 'cash', 'DISPOZITIE', 'DP-098-1', 500.00, 'Robinet trecere avarie',
   '09800000-0000-0000-0000-000000000001'),
  ('09800000-0000-0000-0000-000000000082', '09800000-0000-0000-0000-000000000065',
   '09800000-0000-0000-0000-000000000010', '09800000-0000-0000-0000-000000000030',
   (statement_timestamp() at time zone 'Europe/Bucharest')::date, 'payment', 'cash', 'DISPOZITIE', 'DP-098-2', 200.00, 'Materiale etansare subsol',
   '09800000-0000-0000-0000-000000000001'),
  ('09800000-0000-0000-0000-000000000087', '09800000-0000-0000-0000-000000000065',
   '09800000-0000-0000-0000-000000000010', '09800000-0000-0000-0000-000000000030',
   (statement_timestamp() at time zone 'Europe/Bucharest')::date, 'payment', 'cash', 'DISPOZITIE', 'DP-098-OVER', 900.00, 'Over capacity expense attempt',
   '09800000-0000-0000-0000-000000000001');

-- Refund entry linked cleanly to original expense entry 81 via reversal_of_entry_id
insert into finance.statutory_simple_entries (
  id, cycle_id, tenant_id, property_id, entry_date, direction, payment_medium,
  document_type, document_number, amount, description, reversal_of_entry_id, created_by
) values
  ('09800000-0000-0000-0000-000000000083', '09800000-0000-0000-0000-000000000065',
   '09800000-0000-0000-0000-000000000010', '09800000-0000-0000-0000-000000000030',
   (statement_timestamp() at time zone 'Europe/Bucharest')::date, 'receipt', 'cash', 'CHITANTA', 'CH-098-REF', 500.00, 'Refund of plumbing parts',
   '09800000-0000-0000-0000-000000000081', '09800000-0000-0000-0000-000000000001'),
  ('09800000-0000-0000-0000-000000000085', '09800000-0000-0000-0000-000000000065',
   '09800000-0000-0000-0000-000000000010', '09800000-0000-0000-0000-000000000030',
   (statement_timestamp() at time zone 'Europe/Bucharest')::date, 'receipt', 'cash', 'CHITANTA', 'CH-098-BADREF', 500.00, 'Unlinked refund attempt',
   null, '09800000-0000-0000-0000-000000000001');

-- Assign the funding receipts to cash desk
select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000080',
      statement_timestamp(),
      '09800000-0000-0000-0000-000000000001', 'idemp-as-fund1', repeat('1', 64)
    )$$,
  'funding receipt 1 assigned to cash desk'
);

select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000084',
      statement_timestamp(),
      '09800000-0000-0000-0000-000000000001', 'idemp-as-fund2', repeat('2', 64)
    )$$,
  'funding receipt 2 assigned to cash desk'
);

-- 3. Adopted AGM Resolution Mandate & Scope Protection
select throws_ok(
  $$select * from app_private.authorize_statutory_petty_cash_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000075', -- unadopted resolution
      800.00, date_trunc('month', statement_timestamp() at time zone 'Europe/Bucharest')::date, 'Elena Ionescu', 'Cheltuieli neprevazute urgente',
      '09800000-0000-0000-0000-000000000001', 'idemp-auth-unadopted', repeat('1', 64)
    )$$,
  '23514', 'adopted_resolution_required_for_petty_cash',
  'unadopted resolution is rejected for petty cash authorization'
);

select throws_ok(
  $$select * from app_private.authorize_statutory_petty_cash_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000076', -- foreign property resolution
      800.00, date_trunc('month', statement_timestamp() at time zone 'Europe/Bucharest')::date, 'Elena Ionescu', 'Cheltuieli neprevazute urgente',
      '09800000-0000-0000-0000-000000000001', 'idemp-auth-foreign', repeat('2', 64)
    )$$,
  '23514', 'resolution_property_scope_mismatch',
  'cross-property resolution is rejected'
);

-- 4. Unforeseen-Expense Mandate & 1,000 RON Monthly Ceiling
select throws_ok(
  $$select * from app_private.authorize_statutory_petty_cash_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000074',
      1200.00, date_trunc('month', statement_timestamp() at time zone 'Europe/Bucharest')::date, 'Elena Ionescu', -- exceeds 1,000 RON statutory limit
      'Cheltuieli neprevazute',
      '09800000-0000-0000-0000-000000000001', 'idemp-auth-over1000', repeat('4', 64)
    )$$,
  '22023', 'petty_cash_authorization_invalid_arguments',
  'authorization exceeding statutory 1,000 RON ceiling is rejected'
);

-- Valid Petty Cash Authorization (800 RON) created in 'authorized' status
select lives_ok(
  $$select * from app_private.authorize_statutory_petty_cash_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000074',
      800.00, date_trunc('month', statement_timestamp() at time zone 'Europe/Bucharest')::date, 'Elena Ionescu', 'Cheltuieli neprevazute reparatii instalatii',
      '09800000-0000-0000-0000-000000000001', 'idemp-auth-098-ok', repeat('5', 64)
    )$$,
  'valid petty cash authorization is created in authorized status'
);

select ok(
  (select status = 'authorized' and custodian_name = 'Elena Ionescu' and authorized_amount = 800.00
     from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
  'petty cash authorization verified in authorized status with custodian_name'
);

-- Property-level 1,000 RON ceiling across cash desks
select throws_ok(
  $$select * from app_private.authorize_statutory_petty_cash_v1(
      '09800000-0000-0000-0000-000000000061', -- Desk B in same property
      '09800000-0000-0000-0000-000000000074',
      200.00, date_trunc('month', statement_timestamp() at time zone 'Europe/Bucharest')::date, 'Elena Ionescu', 'Second desk authorization in same property/month',
      '09800000-0000-0000-0000-000000000001', 'idemp-auth-dup-prop', repeat('6', 64)
    )$$,
  '23505', 'petty_cash_already_authorized_for_month',
  'second petty cash authorization for same property in same calendar month is rejected'
);

-- Cannot spend before activation
select throws_ok(
  $$select * from app_private.record_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      '09800000-0000-0000-0000-000000000081',
      'Instalator Vasile', 'BF-098-101',
      '09800000-0000-0000-0000-000000000001', 'idemp-exp-before-act', repeat('7', 64)
    )$$,
  '55000', 'petty_cash_authorization_not_active',
  'expense cannot be recorded on an unactivated authorization'
);

-- Blocker 6: Cannot activate before actual funding allocation (retention)
select throws_ok(
  $$select * from app_private.activate_statutory_petty_cash_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000001', 'idemp-act-pc-early', repeat('8', 64)
    )$$,
  '22023', 'petty_cash_activation_requires_funding_allocation',
  'activation without allocated retention funding is strictly rejected'
);

-- Law 196/2018 Art. 67(5) Multi-Retention Funding:
-- Retain 300 RON from Entry 80 (first retention)
select lives_ok(
  $$select * from app_private.retain_petty_cash_from_receipt_v1(
      (select id from finance.statutory_cash_deposit_obligations where statutory_simple_entry_id = '09800000-0000-0000-0000-000000000080'),
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      300.00, '09800000-0000-0000-0000-000000000001', 'idemp-ret-1', repeat('9', 64)
    )$$,
  'first lawful petty cash retention of 300 RON allocated from receipt 80'
);

-- Retain 500 RON from Entry 84 (second retention, total = 800 RON)
select lives_ok(
  $$select * from app_private.retain_petty_cash_from_receipt_v1(
      (select id from finance.statutory_cash_deposit_obligations where statutory_simple_entry_id = '09800000-0000-0000-0000-000000000084'),
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      500.00, '09800000-0000-0000-0000-000000000001', 'idemp-ret-2', repeat('a', 64)
    )$$,
  'second lawful petty cash retention of 500 RON allocated from receipt 84'
);

-- Retention exceeding remaining obligation capacity is rejected fail-closed
select throws_ok(
  $$select * from app_private.retain_petty_cash_from_receipt_v1(
      (select id from finance.statutory_cash_deposit_obligations where statutory_simple_entry_id = '09800000-0000-0000-0000-000000000080'),
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      50.00, '09800000-0000-0000-0000-000000000001', 'idemp-ret-overcap', repeat('b', 64)
    )$$,
  '23514', 'cross_ledger_obligation_capacity_exceeded',
  'retention exceeding obligation remaining capacity is rejected with cross_ledger_obligation_capacity_exceeded'
);

-- Retention immutability
select throws_ok(
  $$delete from finance.statutory_cash_receipt_petty_cash_retentions where idempotency_key = 'idemp-ret-1'$$,
  '55000', 'statutory_pc_retention_is_immutable',
  'petty cash retention record is immutable and cannot be deleted'
);

-- Activate Petty Cash Authorization (now funded with 800 RON total)
select lives_ok(
  $$select * from app_private.activate_statutory_petty_cash_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000001', 'idemp-act-pc-1', repeat('8', 64)
    )$$,
  'petty cash authorization activated successfully once funded'
);

select ok(
  (select status = 'active' and activated_at is not null
     from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
  'petty cash authorization status transitioned to active'
);

select ok(
  exists(
    select 1 from finance.statutory_petty_cash_activation_events
     where authorization_id = (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok')
  ),
  'append-only petty cash activation event recorded'
);

-- Activation event immutability
select throws_ok(
  $$delete from finance.statutory_petty_cash_activation_events
     where authorization_id = (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok')$$,
  '55000', 'statutory_pc_activation_event_is_immutable',
  'petty cash activation event is immutable against direct SQL delete'
);

-- Assign entries 81, 87 to cash desk
select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000081',
      null,
      '09800000-0000-0000-0000-000000000001', 'idemp-as-pay-81', repeat('2', 64)
    )$$,
  'payment simple entry 81 assigned to cash desk'
);

select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000087',
      null,
      '09800000-0000-0000-0000-000000000001', 'idemp-as-pay-87', repeat('3', 64)
    )$$,
  'over budget payment simple entry 87 assigned to cash desk'
);

-- Expense exceeding available retained funding is rejected fail-closed
select throws_ok(
  $$select * from app_private.record_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      '09800000-0000-0000-0000-000000000087', -- 900 RON > 800 RON available
      'Furnizor Respins', 'BF-098-REJ',
      '09800000-0000-0000-0000-000000000001', 'idemp-exp-overbudget', repeat('7', 64)
    )$$,
  '23514', 'petty_cash_ceiling_exceeded',
  'expense exceeding available funding is rejected fail-closed'
);

-- Multi-Retention Split Allocation:
-- Record valid expense of 500 RON (should take 300 RON from Retention 1 + 200 RON from Retention 2)
select lives_ok(
  $$select * from app_private.record_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      '09800000-0000-0000-0000-000000000081',
      'Instalator Vasile', 'BF-098-101',
      '09800000-0000-0000-0000-000000000001', 'idemp-exp-098-1', repeat('7', 64)
    )$$,
  'petty cash expense of 500 RON recorded with linked simple entry'
);

-- Verify split consumptions across the two retentions
select ok(
  (select count(*) = 2 and sum(consumed_amount) = 500.00
     from finance.statutory_petty_cash_retention_consumptions
    where expense_id = (select id from finance.statutory_petty_cash_expenses where idempotency_key = 'idemp-exp-098-1')),
  'expense of 500 RON cleanly split across two retentions (300 RON + 200 RON)'
);

select ok(
  (select (select sum(retained_amount) from finance.statutory_cash_receipt_petty_cash_retentions where authorization_id = (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok')) = 800.00),
  'original retentions remain completely immutable at 800 RON total'
);

select ok(
  (select finance.statutory_petty_cash_balance_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      statement_timestamp()
    ) = 300.00),
  'derived petty cash balance correctly decrements to 300 RON'
);

-- Double use of same simple entry is rejected
select throws_ok(
  $$select * from app_private.record_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      '09800000-0000-0000-0000-000000000081', -- Same simple entry reused
      'Instalator Vasile', 'BF-098-101',
      '09800000-0000-0000-0000-000000000001', 'idemp-exp-dup-entry', repeat('8', 64)
    )$$,
  '23505', null,
  'simple entry cannot be reused across multiple petty cash expenses'
);

-- Direct update/delete on expense is blocked
select throws_ok(
  $$update finance.statutory_petty_cash_expenses set recipient_name = 'Modified' where idempotency_key = 'idemp-exp-098-1'$$,
  '55000', 'statutory_petty_cash_expense_is_immutable',
  'petty cash expense is immutable against direct SQL update'
);

select throws_ok(
  $$delete from finance.statutory_petty_cash_retention_consumptions
     where authorization_id = (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok')$$,
  '55000', 'statutory_pc_consumption_is_immutable',
  'retention consumption is immutable against direct SQL delete'
);

-- 6. Append-Only Expense Reversal with Dedicated Release Ledger
-- Assign refund receipt entries to cash desk
select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000083',
      statement_timestamp(),
      '09800000-0000-0000-0000-000000000001', 'idemp-as-ref-83', repeat('3', 64)
    )$$,
  'refund receipt simple entry 83 assigned to cash desk'
);

select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000085',
      statement_timestamp(),
      '09800000-0000-0000-0000-000000000001', 'idemp-as-ref-85', repeat('4', 64)
    )$$,
  'unlinked refund receipt simple entry 85 assigned to cash desk'
);

-- Reversal with unlinked refund entry is rejected
select throws_ok(
  $$select * from app_private.reverse_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_expenses where idempotency_key = 'idemp-exp-098-1'),
      '09800000-0000-0000-0000-000000000085', -- Not linked via reversal_of_entry_id
      'Unlinked refund attempt',
      '09800000-0000-0000-0000-000000000001', 'idemp-rev-badlink', repeat('9', 64)
    )$$,
  '23514', 'reversal_simple_entry_mismatch',
  'reversal requires simple entry linked to original expense'
);

-- Valid Reversal via RPC inserting release rows
select lives_ok(
  $$select * from app_private.reverse_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_expenses where idempotency_key = 'idemp-exp-098-1'),
      '09800000-0000-0000-0000-000000000083', -- Linked refund receipt entry
      'Returned plumbing parts to vendor for full cash refund',
      '09800000-0000-0000-0000-000000000001', 'idemp-rev-exp-1', repeat('9', 64)
    )$$,
  'petty cash expense reversed successfully via append-only table'
);

select ok(
  (select count(*) = 1 from finance.statutory_petty_cash_expense_reversals where idempotency_key = 'idemp-rev-exp-1'),
  'reversal record created in append-only reversals table'
);

select ok(
  (select count(*) = 2 and sum(released_amount) = 500.00
     from finance.statutory_petty_cash_retention_consumption_releases
    where reversal_id = (select id from finance.statutory_petty_cash_expense_reversals where idempotency_key = 'idemp-rev-exp-1')),
  'dedicated release ledger records 2 release rows restoring 500 RON total'
);

select ok(
  (select status = 'recorded' from finance.statutory_petty_cash_expenses where idempotency_key = 'idemp-exp-098-1'),
  'original expense remains completely unmodified in recorded status'
);

select ok(
  (select finance.statutory_petty_cash_balance_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      statement_timestamp()
    ) = 800.00),
  'petty cash balance restored to 800 RON following reversal'
);

-- Reversal replay is idempotent
select ok(
  (select id from app_private.reverse_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_expenses where idempotency_key = 'idemp-exp-098-1'),
      '09800000-0000-0000-0000-000000000083',
      'Returned plumbing parts to vendor for full cash refund',
      '09800000-0000-0000-0000-000000000001', 'idemp-rev-exp-1', repeat('9', 64)
    )) = (select id from finance.statutory_petty_cash_expense_reversals where idempotency_key = 'idemp-rev-exp-1'),
  'reversal replay with identical key returns existing reversal row'
);

-- Second reversal with different key is rejected
select throws_ok(
  $$select * from app_private.reverse_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_expenses where idempotency_key = 'idemp-exp-098-1'),
      '09800000-0000-0000-0000-000000000083',
      'Attempting second reversal',
      '09800000-0000-0000-0000-000000000001', 'idemp-rev-exp-dup', repeat('a', 64)
    )$$,
  '55000', 'petty_cash_expense_already_reversed',
  'cannot reverse an already reversed expense'
);

-- Direct update/delete on reversal and releases is blocked
select throws_ok(
  $$delete from finance.statutory_petty_cash_expense_reversals where idempotency_key = 'idemp-rev-exp-1'$$,
  '55000', 'statutory_petty_cash_reversal_is_immutable',
  'reversal record is immutable against direct SQL delete'
);

select throws_ok(
  $$delete from finance.statutory_petty_cash_retention_consumption_releases
     where reversal_id = (select id from finance.statutory_petty_cash_expense_reversals where idempotency_key = 'idemp-rev-exp-1')$$,
  '55000', 'statutory_pc_consumption_release_is_immutable',
  'retention release record is immutable against direct SQL delete'
);

-- Assign payment entry 82 to cash desk
select lives_ok(
  $$select * from app_private.assign_cash_simple_entry_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000082',
      null,
      '09800000-0000-0000-0000-000000000001', 'idemp-as-pay-82', repeat('4', 64)
    )$$,
  'payment simple entry 82 assigned to cash desk'
);

-- Record new valid expense of 200 RON
select lives_ok(
  $$select * from app_private.record_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      '09800000-0000-0000-0000-000000000082',
      'Depozit Materiale SRL', 'BF-098-103',
      '09800000-0000-0000-0000-000000000001', 'idemp-exp-098-2', repeat('b', 64)
    )$$,
  'second petty cash expense of 200 RON recorded'
);

select ok(
  (select finance.statutory_petty_cash_balance_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      statement_timestamp()
    ) = 600.00),
  'petty cash balance decrements to 600 RON'
);

-- 7. Statutory Cash Documents: Canonical Simple Entry Resolution and Direction Validation
-- Dual-NULL source links are strictly rejected
select throws_ok(
  $$select * from app_private.create_statutory_cash_document_v1(
      '09800000-0000-0000-0000-000000000060', 'chitanta_14_4_1', 'CH-A', '0000',
      (statement_timestamp() at time zone 'Europe/Bucharest')::date, 100.00, 'Test', 'Dual NULL test',
      '{"form":"14-4-1"}'::jsonb, null, null,
      '09800000-0000-0000-0000-000000000001', 'idemp-doc-dualnull', repeat('c', 64)
    )$$,
  '22023', 'cash_document_requires_simple_entry_or_expense',
  'creating cash document with dual-NULL source links is strictly rejected'
);

-- Expense-only direction mismatch: Cannot create Chitanta 14-4-1 from expense
select throws_ok(
  $$select * from app_private.create_statutory_cash_document_v1(
      '09800000-0000-0000-0000-000000000060', 'chitanta_14_4_1', 'CH-A', '0000',
      (statement_timestamp() at time zone 'Europe/Bucharest')::date, 200.00, 'Test', 'Direction mismatch test',
      '{"form":"14-4-1"}'::jsonb, null,
      (select id from finance.statutory_petty_cash_expenses where idempotency_key = 'idemp-exp-098-2'),
      '09800000-0000-0000-0000-000000000001', 'idemp-doc-dirmismatch', repeat('c', 64)
    )$$,
  '22023', 'statutory_cash_document_direction_mismatch',
  'creating chitanta from petty cash expense is rejected due to direction mismatch'
);

-- Valid Chitanta Form 14-4-1 with simple entry link
select lives_ok(
  $$select * from app_private.create_statutory_cash_document_v1(
      '09800000-0000-0000-0000-000000000060', 'chitanta_14_4_1', 'CH-A', '0001',
      (statement_timestamp() at time zone 'Europe/Bucharest')::date, 1000.00, 'Popescu Ion (Ap. 12)', 'Cota intretinere numerar',
      '{"form":"14-4-1","quota":1000.00,"penalties":0.00}'::jsonb,
      '09800000-0000-0000-0000-000000000080', null,
      '09800000-0000-0000-0000-000000000001', 'idemp-doc-chitanta-1', repeat('c', 64)
    )$$,
  'Chitanta Form 14-4-1 created successfully in draft status'
);

-- Cross-property entry reference rejected
select throws_ok(
  $$select * from app_private.create_statutory_cash_document_v1(
      '09800000-0000-0000-0000-000000000060', 'chitanta_14_4_1', 'CH-A', '0002',
      (statement_timestamp() at time zone 'Europe/Bucharest')::date, 250.00, 'Foreign Payer', 'Cross-property test',
      '{"form":"14-4-1"}'::jsonb,
      '09700000-0000-0000-0000-000000000081', -- Foreign 097 entry
      null, '09800000-0000-0000-0000-000000000001', 'idemp-doc-cross-scope', repeat('c', 64)
    )$$,
  '23514', 'document_scope_mismatch',
  'cross-property simple entry reference is rejected'
);

-- Valid Dispozitie de plata Form 14-4-4 created with expense-only link (resolves canonical simple entry)
select lives_ok(
  $$select * from app_private.create_statutory_cash_document_v1(
      '09800000-0000-0000-0000-000000000060', 'dispozitie_14_4_4_plata', 'DP-A', '0001',
      (statement_timestamp() at time zone 'Europe/Bucharest')::date, 200.00, 'Instalator Vasile Gheorghe', 'Plata materiale etansare subsol',
      '{"form":"14-4-4","disposition":"plata","expense_ref":"BF-098-103"}'::jsonb, null,
      (select id from finance.statutory_petty_cash_expenses where idempotency_key = 'idemp-exp-098-2'),
      '09800000-0000-0000-0000-000000000001', 'idemp-doc-dispozitie-1', repeat('d', 64)
    )$$,
  'Dispozitie de plata Form 14-4-4 created successfully with canonical simple entry resolution'
);

select ok(
  (select statutory_simple_entry_id = '09800000-0000-0000-0000-000000000082'
     from finance.statutory_cash_documents where idempotency_key = 'idemp-doc-dispozitie-1'),
  'canonical simple entry resolved automatically from expense link'
);

-- Direct SQL update to finalized is rejected by trigger
select throws_ok(
  $$update finance.statutory_cash_documents set status = 'finalized'
     where idempotency_key = 'idemp-doc-chitanta-1'$$,
  '55000', 'unmediated_document_mutation_forbidden',
  'unmediated direct SQL document finalization is forbidden by trigger'
);

-- Direct SQL update to semantic_schema_verified is rejected by trigger
select throws_ok(
  $$update finance.statutory_cash_documents
       set renderer_status = 'semantic_schema_verified'
     where idempotency_key = 'idemp-doc-chitanta-1'$$,
  '55000', 'unmediated_document_mutation_forbidden',
  'direct SQL update to semantic_schema_verified is forbidden'
);

-- Finalization without schema verification is rejected
select throws_ok(
  $$select * from app_private.finalize_statutory_cash_document_v1(
      (select id from finance.statutory_cash_documents where idempotency_key = 'idemp-doc-chitanta-1'),
      1, '09800000-0000-0000-0000-000000000001', 'Finalize test',
      'idemp-fin-unverified', repeat('e', 64)
    )$$,
  '23514', 'renderer_semantic_schema_verification_required',
  'finalization without semantic schema verification is rejected'
);

-- Controlled semantic schema verification via dedicated RPC
select lives_ok(
  $$select * from app_private.verify_statutory_cash_document_semantic_schema_v1(
      (select id from finance.statutory_cash_documents where idempotency_key = 'idemp-doc-chitanta-1'),
      1, '09800000-0000-0000-0000-000000000001', 'Legal schema verified',
      'idemp-verify-doc-1', repeat('e', 64)
    )$$,
  'controlled semantic schema verification succeeds'
);

select ok(
  (select renderer_status = 'semantic_schema_verified' and lock_version = 2
     from finance.statutory_cash_documents where idempotency_key = 'idemp-doc-chitanta-1'),
  'document renderer_status transitioned to semantic_schema_verified with lock_version advanced'
);

select ok(
  exists(
    select 1 from finance.statutory_cash_document_verification_events
     where document_id = (select id from finance.statutory_cash_documents where idempotency_key = 'idemp-doc-chitanta-1')
  ),
  'append-only document verification event recorded'
);

-- Formal finalization via RPC
select lives_ok(
  $$select * from app_private.finalize_statutory_cash_document_v1(
      (select id from finance.statutory_cash_documents where idempotency_key = 'idemp-doc-chitanta-1'),
      2, '09800000-0000-0000-0000-000000000001', 'Formal compliance signoff',
      'idemp-fin-doc-1', repeat('f', 64)
    )$$,
  'formal document finalization succeeds via controlled RPC'
);

select ok(
  (select status = 'finalized' and finalized_at is not null and lock_version = 3
     from finance.statutory_cash_documents where idempotency_key = 'idemp-doc-chitanta-1'),
  'document status is finalized with lock_version advanced'
);

select ok(
  exists(
    select 1 from finance.statutory_cash_document_finalization_events
     where document_id = (select id from finance.statutory_cash_documents where idempotency_key = 'idemp-doc-chitanta-1')
  ),
  'append-only document finalization event recorded'
);

-- Finalized document is strictly immutable against delete/update
select throws_ok(
  $$delete from finance.statutory_cash_documents where idempotency_key = 'idemp-doc-chitanta-1'$$,
  '55000', 'finalized_cash_document_is_immutable',
  'finalized cash document is immutable and cannot be deleted'
);

-- 8. Expired Retention Excluded in Projection
select ok(
  (select finance.statutory_petty_cash_balance_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      statement_timestamp() + interval '60 days'
    ) = 0.00),
  'expired retentions are excluded from active petty cash balance projection'
);

-- 9. Zero Journal Auto-Creation (Invariant 4)
select ok(
  (select count(*) = 0 from finance.journals where tenant_id = '09800000-0000-0000-0000-000000000010'),
  'zero double-entry journals created automatically during petty cash or cash document operations'
);

-- 10. Audit Completeness
select ok(
  (select count(*) >= 6 from audit.events where tenant_id = '09800000-0000-0000-0000-000000000010'),
  'audit events logged for petty cash authorizations, expenses, reversals, and documents'
);

rollback;
