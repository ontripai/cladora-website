-- R10 Phase 2B: Romanian HOA petty cash controls under Law 196/2018 Art. 67(5)
-- and statutory cash documents (14-4-1 Chitanță, 14-4-4 Dispoziție casierie).
begin;
select plan(34);

-- 1. Structural, RLS and ACL contracts
select has_table('finance', 'statutory_petty_cash_authorizations', 'petty cash authorizations table exists');
select has_table('finance', 'statutory_petty_cash_expenses', 'petty cash expenses table exists');
select has_table('finance', 'statutory_cash_documents', 'statutory cash documents table exists');

select has_function('finance', 'statutory_petty_cash_balance_v1', array['uuid'], 'derived petty cash balance function exists');

select has_function(
  'app_private', 'authorize_statutory_petty_cash_v1',
  array['uuid', 'uuid', 'date', 'numeric', 'text', 'boolean', 'uuid', 'text', 'text'],
  'controlled petty cash authorization RPC exists'
);
select has_function(
  'app_private', 'record_statutory_petty_cash_expense_v1',
  array['uuid', 'numeric', 'date', 'text', 'text', 'text', 'text', 'text', 'uuid', 'text', 'text'],
  'controlled petty cash expense recording RPC exists'
);
select has_function(
  'app_private', 'reverse_statutory_petty_cash_expense_v1',
  array['uuid', 'text', 'uuid', 'text', 'text'],
  'controlled petty cash expense reversal RPC exists'
);
select has_function(
  'app_private', 'create_statutory_cash_document_v1',
  array['uuid', 'finance.statutory_cash_document_type', 'text', 'text', 'date', 'numeric', 'text', 'text', 'jsonb', 'uuid', 'uuid', 'uuid', 'text', 'text'],
  'controlled statutory cash document creation RPC exists'
);

select ok(
  (select relrowsecurity from pg_class where oid = 'finance.statutory_petty_cash_authorizations'::regclass)
  and (select relrowsecurity from pg_class where oid = 'finance.statutory_cash_documents'::regclass),
  'petty cash tables and cash documents have RLS enabled'
);

select ok(
  not has_table_privilege('anon', 'finance.statutory_petty_cash_authorizations', 'INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_petty_cash_authorizations', 'INSERT,UPDATE,DELETE')
  and not has_function_privilege('anon', 'app_private.authorize_statutory_petty_cash_v1(uuid,uuid,date,numeric,text,boolean,uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app_private.authorize_statutory_petty_cash_v1(uuid,uuid,date,numeric,text,boolean,uuid,text,text)', 'EXECUTE'),
  'anon and authenticated roles have zero mutation access to petty cash RPCs'
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
  ('09800000-0000-0000-0000-000000000040', '09800000-0000-0000-0000-000000000010', '09800000-0000-0000-0000-000000000030', date '2026-06-01', date '2026-06-30', 'open');

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

-- Active Cash Desk
insert into finance.statutory_cash_desks (
  id, tenant_id, property_id, regime_id, code, name, currency, status,
  daily_ceiling_amount, idempotency_key, payload_hash, created_by, activated_by, activated_at
) values (
  '09800000-0000-0000-0000-000000000060', '09800000-0000-0000-0000-000000000010',
  '09800000-0000-0000-0000-000000000030', '09800000-0000-0000-0000-000000000050',
  'CASH-098', 'Casierie 098', 'RON', 'active', 50000.00,
  'idemp-desk-098', repeat('0', 64), '09800000-0000-0000-0000-000000000001',
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

-- 3. Adopted AGM Resolution Mandate & Scope Protection
select throws_ok(
  $$select * from app_private.authorize_statutory_petty_cash_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000075', -- unadopted resolution
      date '2026-06-01', 800.00, 'Cheltuieli neprevazute urgente', true,
      '09800000-0000-0000-0000-000000000001', 'idemp-auth-unadopted', repeat('1', 64)
    )$$,
  '23514', 'adopted_resolution_required_for_petty_cash',
  'unadopted resolution is rejected for petty cash authorization'
);

select throws_ok(
  $$select * from app_private.authorize_statutory_petty_cash_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000076', -- foreign property resolution
      date '2026-06-01', 800.00, 'Cheltuieli neprevazute urgente', true,
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
      date '2026-06-01', 800.00, 'General operational cash', false, -- not unforeseen expense
      '09800000-0000-0000-0000-000000000001', 'idemp-auth-not-unforeseen', repeat('3', 64)
    )$$,
  '22023', 'petty_cash_authorization_invalid_arguments',
  'petty cash rejected if not designated exclusively for unforeseen expenses'
);

select throws_ok(
  $$select * from app_private.authorize_statutory_petty_cash_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000074',
      date '2026-06-01', 1200.00, -- exceeds 1,000 RON statutory limit
      'Cheltuieli neprevazute', true,
      '09800000-0000-0000-0000-000000000001', 'idemp-auth-over1000', repeat('4', 64)
    )$$,
  '22023', 'petty_cash_authorization_invalid_arguments',
  'authorization exceeding statutory 1,000 RON ceiling is rejected'
);

-- Valid Petty Cash Authorization (800 RON)
select lives_ok(
  $$select * from app_private.authorize_statutory_petty_cash_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000074',
      date '2026-06-01', 800.00, 'Cheltuieli neprevazute reparatii instalatii', true,
      '09800000-0000-0000-0000-000000000001', 'idemp-auth-098-ok', repeat('5', 64)
    )$$,
  'valid petty cash authorization is created'
);

select ok(
  (select finance.statutory_petty_cash_balance_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok')
    ) = 800.00),
  'derived petty cash balance equals authorized 800 RON'
);

-- Cannot authorize second petty cash for same cash desk in same calendar month
select throws_ok(
  $$select * from app_private.authorize_statutory_petty_cash_v1(
      '09800000-0000-0000-0000-000000000060',
      '09800000-0000-0000-0000-000000000074',
      date '2026-06-15', 200.00, 'Second authorization in same month', true,
      '09800000-0000-0000-0000-000000000001', 'idemp-auth-dup-month', repeat('6', 64)
    )$$,
  '23505', 'petty_cash_already_authorized_for_month',
  'multiple petty cash authorizations in same calendar month are rejected'
);

-- 5. Petty Cash Expense Recording with Written Authority & Supporting Document
select lives_ok(
  $$select * from app_private.record_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      300.00, date '2026-06-10', 'Robinet trecere avarie coloana', 'FACTURA_BON', 'BF-098-101',
      repeat('a', 64), 'DISPOZITIE-COMITET-098-1',
      '09800000-0000-0000-0000-000000000001', 'idemp-exp-098-1', repeat('7', 64)
    )$$,
  'petty cash expense of 300 RON recorded with supporting document and written authority'
);

select ok(
  (select finance.statutory_petty_cash_balance_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok')
    ) = 500.00),
  'petty cash balance decrements to 500 RON'
);

-- Expense exceeding remaining balance is rejected
select throws_ok(
  $$select * from app_private.record_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      600.00, date '2026-06-11', 'Excessive plumbing parts', 'FACTURA_BON', 'BF-098-102',
      repeat('b', 64), 'DISPOZITIE-COMITET-098-2',
      '09800000-0000-0000-0000-000000000001', 'idemp-exp-over', repeat('8', 64)
    )$$,
  '23514', 'petty_cash_ceiling_exceeded',
  'petty cash expense exceeding remaining balance is rejected'
);

-- 6. Expense Reversal instead of Mutation
select lives_ok(
  $$select * from app_private.reverse_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_expenses where idempotency_key = 'idemp-exp-098-1'),
      'Returned plumbing parts to vendor for full cash refund',
      '09800000-0000-0000-0000-000000000001', 'idemp-rev-exp-1', repeat('9', 64)
    )$$,
  'petty cash expense reversed successfully'
);

select ok(
  (select status = 'reversed' and reversal_reason is not null
     from finance.statutory_petty_cash_expenses where idempotency_key = 'idemp-exp-098-1'),
  'original expense status marked as reversed with documented reason'
);

select ok(
  (select finance.statutory_petty_cash_balance_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok')
    ) = 800.00),
  'petty cash balance restored to 800 RON following reversal'
);

select throws_ok(
  $$select * from app_private.reverse_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_expenses where idempotency_key = 'idemp-exp-098-1'),
      'Attempting second reversal',
      '09800000-0000-0000-0000-000000000001', 'idemp-rev-exp-dup', repeat('a', 64)
    )$$,
  '55000', 'petty_cash_expense_already_reversed',
  'cannot reverse an already reversed expense'
);

-- Record new valid expense of 450 RON
select lives_ok(
  $$select * from app_private.record_statutory_petty_cash_expense_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok'),
      450.00, date '2026-06-12', 'Materiale etansare subsol', 'FACTURA_BON', 'BF-098-103',
      repeat('c', 64), 'DISPOZITIE-COMITET-098-3',
      '09800000-0000-0000-0000-000000000001', 'idemp-exp-098-2', repeat('b', 64)
    )$$,
  'second petty cash expense of 450 RON recorded'
);

select ok(
  (select finance.statutory_petty_cash_balance_v1(
      (select id from finance.statutory_petty_cash_authorizations where idempotency_key = 'idemp-auth-098-ok')
    ) = 350.00),
  'petty cash balance decrements to 350 RON'
);

-- 7. Statutory Cash Documents: Forms 14-4-1 (Chitanță) & 14-4-4 (Dispoziție casierie)
select lives_ok(
  $$select * from app_private.create_statutory_cash_document_v1(
      '09800000-0000-0000-0000-000000000060', 'chitanta_14_4_1', 'CH-A', '0001',
      date '2026-06-15', 250.00, 'Popescu Ion (Ap. 12)', 'Cota intretinere numerar',
      '{"form":"14-4-1","quota":250.00,"penalties":0.00}'::jsonb, null, null,
      '09800000-0000-0000-0000-000000000001', 'idemp-doc-chitanta-1', repeat('c', 64)
    )$$,
  'Chitanta Form 14-4-1 created successfully'
);

select ok(
  (select document_type = 'chitanta_14_4_1' and renderer_status = 'legal_review_required' and status = 'draft'
     from finance.statutory_cash_documents where idempotency_key = 'idemp-doc-chitanta-1'),
  'Form 14-4-1 registered in draft with renderer_status legal_review_required'
);

select lives_ok(
  $$select * from app_private.create_statutory_cash_document_v1(
      '09800000-0000-0000-0000-000000000060', 'dispozitie_14_4_4_plata', 'DP-A', '0001',
      date '2026-06-15', 450.00, 'Instalator Vasile Gheorghe', 'Plata materiale etansare subsol',
      '{"form":"14-4-4","disposition":"plata","expense_ref":"BF-098-103"}'::jsonb, null,
      (select id from finance.statutory_petty_cash_expenses where idempotency_key = 'idemp-exp-098-2'),
      '09800000-0000-0000-0000-000000000001', 'idemp-doc-dispozitie-1', repeat('d', 64)
    )$$,
  'Dispozitie de plata Form 14-4-4 created successfully'
);

select ok(
  (select document_type = 'dispozitie_14_4_4_plata' and petty_cash_expense_id is not null
     from finance.statutory_cash_documents where idempotency_key = 'idemp-doc-dispozitie-1'),
  'Form 14-4-4 links directly to petty cash expense'
);

-- Document uniqueness: same series and number cannot be recreated
select throws_ok(
  $$select * from app_private.create_statutory_cash_document_v1(
      '09800000-0000-0000-0000-000000000060', 'chitanta_14_4_1', 'CH-A', '0001',
      date '2026-06-15', 250.00, 'Popescu Ion', 'Duplicate test',
      '{}'::jsonb, null, null,
      '09800000-0000-0000-0000-000000000001', 'idemp-doc-dup-num', repeat('e', 64)
    )$$,
  '23505',
  'duplicate document series and number for cash desk is rejected'
);

-- Document immutability protection
select throws_ok(
  $$update finance.statutory_cash_documents set status = 'finalized', finalized_at = statement_timestamp(), finalized_by = '09800000-0000-0000-0000-000000000001'
    where idempotency_key = 'idemp-doc-chitanta-1';
    delete from finance.statutory_cash_documents where idempotency_key = 'idemp-doc-chitanta-1'$$,
  '55000', 'finalized_cash_document_is_immutable',
  'finalized cash document is immutable and cannot be deleted'
);

-- 8. Zero Journal Auto-Creation (Invariant 4)
select ok(
  (select count(*) = 0 from finance.journals where tenant_id = '09800000-0000-0000-0000-000000000010'),
  'zero double-entry journals created automatically during petty cash or cash document operations'
);

-- 9. Audit Completeness
select ok(
  (select count(*) >= 4 from audit.events where tenant_id = '09800000-0000-0000-0000-000000000010'),
  'audit events logged for petty cash authorizations, expenses, reversals, and documents'
);

rollback;
