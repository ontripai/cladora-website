-- R10 Phase 2A: statutory funds and append-only subledgers
begin;
select plan(42);

-- Structural, RLS, ACL, and exact signature contract.
select has_table('finance', 'statutory_funds', 'statutory funds table exists');
select has_table('finance', 'statutory_fund_plans', 'statutory fund plans table exists');
select has_table('finance', 'statutory_fund_assessment_links', 'fund assessment evidence table exists');
select has_table('finance', 'statutory_fund_movements', 'append-only fund movement table exists');
select has_table('finance', 'statutory_working_capital_conveyances', 'working-capital conveyance table exists');
select has_function(
  'app_private', 'create_statutory_fund_v1',
  array['uuid','finance.statutory_fund_kind','text','text','uuid','jsonb','jsonb','date','uuid','text','text'],
  'controlled fund creation RPC exists'
);
select has_function(
  'app_private', 'activate_statutory_fund_v1', array['uuid','integer','uuid','text'],
  'controlled fund activation RPC exists'
);
select has_function(
  'app_private', 'create_statutory_fund_plan_v1',
  array['uuid','uuid','uuid','uuid','numeric','jsonb','text','date','jsonb','uuid','text','text'],
  'controlled statutory fund plan creation RPC exists'
);
select has_function(
  'app_private', 'approve_statutory_fund_plan_v1', array['uuid','integer','uuid','text'],
  'controlled statutory fund plan approval RPC exists'
);
select has_function(
  'app_private', 'link_statutory_fund_assessment_v1', array['uuid','uuid','uuid'],
  'controlled link to finalized allocation evidence exists'
);
select has_function(
  'app_private', 'record_statutory_fund_movement_v1',
  array['uuid','uuid','uuid','uuid','uuid','uuid','finance.statutory_fund_delta','finance.statutory_fund_movement_kind','finance.statutory_fund_purpose','numeric','uuid','uuid','text','text','text','text','jsonb','uuid','text','text'],
  'controlled cash classification RPC exists'
);
select has_function(
  'app_private', 'reverse_statutory_fund_movement_v1',
  array['uuid','uuid','uuid','text','jsonb','uuid','text','text'],
  'controlled cash reversal RPC exists'
);
select has_function(
  'finance', 'statutory_fund_balance_v1', array['uuid'],
  'derived statutory fund balance function exists'
);
select ok(
  (select bool_and(relrowsecurity)
     from pg_class
    where oid in (
      'finance.statutory_funds'::regclass,
      'finance.statutory_fund_plans'::regclass,
      'finance.statutory_fund_assessment_links'::regclass,
      'finance.statutory_fund_movements'::regclass,
      'finance.statutory_working_capital_conveyances'::regclass
    )),
  'RLS is enabled on every Phase 2A table'
);
select ok(
  not has_table_privilege('anon', 'finance.statutory_funds', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_funds', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'finance.statutory_fund_movements', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_fund_movements', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'finance.statutory_working_capital_conveyances', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_working_capital_conveyances', 'SELECT,INSERT,UPDATE,DELETE'),
  'Phase 2A tables expose no direct anon or authenticated DML'
);
select ok(
  not has_function_privilege('anon', 'app_private.create_statutory_fund_v1(uuid,finance.statutory_fund_kind,text,text,uuid,jsonb,jsonb,date,uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app_private.create_statutory_fund_v1(uuid,finance.statutory_fund_kind,text,text,uuid,jsonb,jsonb,date,uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('anon', 'app_private.record_statutory_fund_movement_v1(uuid,uuid,uuid,uuid,uuid,uuid,finance.statutory_fund_delta,finance.statutory_fund_movement_kind,finance.statutory_fund_purpose,numeric,uuid,uuid,text,text,text,text,jsonb,uuid,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app_private.record_statutory_fund_movement_v1(uuid,uuid,uuid,uuid,uuid,uuid,finance.statutory_fund_delta,finance.statutory_fund_movement_kind,finance.statutory_fund_purpose,numeric,uuid,uuid,text,text,text,text,jsonb,uuid,text,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'app_private.create_statutory_fund_v1(uuid,finance.statutory_fund_kind,text,text,uuid,jsonb,jsonb,date,uuid,text,text)', 'EXECUTE')
  and has_function_privilege('service_role', 'app_private.record_statutory_fund_movement_v1(uuid,uuid,uuid,uuid,uuid,uuid,finance.statutory_fund_delta,finance.statutory_fund_movement_kind,finance.statutory_fund_purpose,numeric,uuid,uuid,text,text,text,text,jsonb,uuid,text,text)', 'EXECUTE'),
  'fund mutation RPCs are service-role-only'
);
select ok(
  (select array_agg(e.enumlabel order by e.enumsortorder)::text
     from pg_enum e
     join pg_type t on t.oid = e.enumtypid
     join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'finance' and t.typname = 'statutory_fund_kind')
    = '{repair,working_capital,special,penalty}',
  'fund kinds are exactly repair, working capital, special, and penalty'
);
select ok(
  (select array_agg(e.enumlabel order by e.enumsortorder)::text
     from pg_enum e
     join pg_type t on t.oid = e.enumtypid
     join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'finance' and t.typname = 'statutory_fund_purpose')
    = '{third_party_penalties,common_property_repairs,thermal_rehabilitation,condominium_consolidation,architectural_environmental_quality,current_expenses,special_approved_purpose}',
  'fund purposes contain only the approved statutory destinations'
);
select ok(
  (select array_agg(e.enumlabel order by e.enumsortorder)::text
     from pg_enum e
     join pg_type t on t.oid = e.enumtypid
     join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'finance' and t.typname = 'statutory_penalty_fund_destination')
    = '{third_party_penalties,common_property_repairs,thermal_rehabilitation,condominium_consolidation}',
  'penalty fund has exactly the four Law 196/2018 Article 77(3) destinations'
);

-- Isolated 095 fixtures.
insert into auth.users (id, email) values
  ('09500000-0000-0000-0000-000000000001', 'r10-phase2a-funds@test.local')
on conflict (id) do nothing;

insert into platform.tenants (id, legal_name, registration_number, status) values
  ('09500000-0000-0000-0000-000000000010', 'R10 Phase2A Fund Tenant', 'RO-R10-095', 'active');

insert into platform.customer_workspaces (
  id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment
) values (
  '09500000-0000-0000-0000-000000000020',
  '09500000-0000-0000-0000-000000000010',
  'ASSOCIATION', 'ACTIVE', 'R10 Phase2A Test', 'PILOT'
);

insert into portfolio.properties (id, tenant_id, type, name, status) values (
  '09500000-0000-0000-0000-000000000030',
  '09500000-0000-0000-0000-000000000010',
  'condominium', 'R10 Phase2A Property', 'active'
);
insert into portfolio.buildings (id, tenant_id, property_id, code, name) values (
  '09500000-0000-0000-0000-000000000031',
  '09500000-0000-0000-0000-000000000010',
  '09500000-0000-0000-0000-000000000030', 'A', 'R10 Phase2A Building'
);
insert into portfolio.units (id, tenant_id, building_id, code) values (
  '09500000-0000-0000-0000-000000000032',
  '09500000-0000-0000-0000-000000000010',
  '09500000-0000-0000-0000-000000000031', 'A-01'
);
insert into portfolio.parties (id, tenant_id, type, legal_name) values (
  '09500000-0000-0000-0000-000000000033',
  '09500000-0000-0000-0000-000000000010', 'person', 'R10 Phase2A Owner'
);

insert into governance.meetings (
  id, tenant_id, property_id, title, meeting_type, scheduled_at, status, quorum_rule, created_by
) values (
  '09500000-0000-0000-0000-000000000040',
  '09500000-0000-0000-0000-000000000010',
  '09500000-0000-0000-0000-000000000030',
  'R10 Phase2A AGM', 'annual', statement_timestamp(), 'closed', '{"minimum_weight":0.5}',
  '09500000-0000-0000-0000-000000000001'
);
insert into governance.agenda_items (
  id, tenant_id, meeting_id, sequence_no, title, decision_required
) values (
  '09500000-0000-0000-0000-000000000041',
  '09500000-0000-0000-0000-000000000010',
  '09500000-0000-0000-0000-000000000040', 1, 'Approve repair fund', true
);
insert into governance.resolutions (
  id, tenant_id, meeting_id, agenda_item_id, resolution_no, title, text_body,
  adopted, result_snapshot, effective_on
) values (
  '09500000-0000-0000-0000-000000000042',
  '09500000-0000-0000-0000-000000000010',
  '09500000-0000-0000-0000-000000000040',
  '09500000-0000-0000-0000-000000000041', 'AGM-095-1',
  'Repair fund approval', 'Repair fund approved for statutory purposes', true,
  '{"approved":true}', date '2026-09-01'
);

insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on) values (
  '09500000-0000-0000-0000-000000000050',
  '09500000-0000-0000-0000-000000000010',
  '09500000-0000-0000-0000-000000000030', date '2026-09-01', date '2026-09-30'
);
insert into finance.statutory_accounting_regimes (
  id, tenant_id, customer_workspace_id, property_id, status, statutory_operations_enabled,
  accounting_signoff_reference, accounting_signed_at, legal_signoff_reference,
  legal_signed_at, activated_at
) values (
  '09500000-0000-0000-0000-000000000060',
  '09500000-0000-0000-0000-000000000010',
  '09500000-0000-0000-0000-000000000020',
  '09500000-0000-0000-0000-000000000030', 'active', true,
  'CECCAR-R10-095', statement_timestamp(), 'LEGAL-R10-095', statement_timestamp(), statement_timestamp()
);
insert into finance.statutory_monthly_cycles (
  id, regime_id, tenant_id, property_id, accounting_period_id, status
) values (
  '09500000-0000-0000-0000-000000000070',
  '09500000-0000-0000-0000-000000000060',
  '09500000-0000-0000-0000-000000000010',
  '09500000-0000-0000-0000-000000000030',
  '09500000-0000-0000-0000-000000000050', 'collecting'
);

insert into finance.statutory_simple_entries (
  id, cycle_id, tenant_id, property_id, entry_date, direction, payment_medium,
  document_type, document_number, amount, description, created_by
) values
  ('09500000-0000-0000-0000-000000000081', '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000010', '09500000-0000-0000-0000-000000000030', date '2026-09-10', 'receipt', 'bank', 'EXTRAS_CONT', '095-IN-100', 100.00, 'Common property income', '09500000-0000-0000-0000-000000000001'),
  ('09500000-0000-0000-0000-000000000082', '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000010', '09500000-0000-0000-0000-000000000030', date '2026-09-11', 'payment', 'bank', 'ORDIN_PLATA', '095-OUT-040', 40.00, 'Common property repair', '09500000-0000-0000-0000-000000000001'),
  ('09500000-0000-0000-0000-000000000083', '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000010', '09500000-0000-0000-0000-000000000030', date '2026-09-12', 'receipt', 'bank', 'EXTRAS_CONT', '095-REV-040', 40.00, 'Repair reversal receipt', '09500000-0000-0000-0000-000000000001'),
  ('09500000-0000-0000-0000-000000000084', '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000010', '09500000-0000-0000-0000-000000000030', date '2026-09-13', 'payment', 'bank', 'ORDIN_PLATA', '095-DIR-MISMATCH', 10.00, 'Direction mismatch fixture', '09500000-0000-0000-0000-000000000001'),
  ('09500000-0000-0000-0000-000000000085', '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000010', '09500000-0000-0000-0000-000000000030', date '2026-09-14', 'receipt', 'bank', 'CHITANTA', '095-OWNER-010', 10.00, 'Owner contribution fixture', '09500000-0000-0000-0000-000000000001');

select lives_ok(
  $$select app_private.create_statutory_fund_v1(
      '09500000-0000-0000-0000-000000000060', 'repair', 'REPAIR-095', 'Fond de reparații 095',
      '09500000-0000-0000-0000-000000000042', '{"law":"Legea 196/2018","article":"71"}',
      '{"allowed":["common_property_repairs","thermal_rehabilitation","condominium_consolidation","architectural_environmental_quality"]}',
      date '2026-09-01', '09500000-0000-0000-0000-000000000001',
      '095-create-repair', repeat('a',64)
    )$$,
  'an adopted resolution can create a draft repair fund'
);
select ok(
  (select kind = 'repair' and status = 'draft' and currency = 'RON' and lock_version = 1
     from finance.statutory_funds where idempotency_key = '095-create-repair'),
  'new repair fund starts as a version-one RON draft'
);
select ok(
  (select (app_private.create_statutory_fund_v1(
      '09500000-0000-0000-0000-000000000060', 'repair', 'IGNORED-ON-REPLAY', 'Ignored replay name',
      '09500000-0000-0000-0000-000000000042', '{}', '{}', date '2026-09-01',
      '09500000-0000-0000-0000-000000000001', '095-create-repair', repeat('a',64)
    )).id) = (select id from finance.statutory_funds where idempotency_key = '095-create-repair'),
  'same idempotency key and payload hash replay the original fund'
);
select throws_ok(
  $$select app_private.create_statutory_fund_v1(
      '09500000-0000-0000-0000-000000000060', 'repair', 'REPAIR-CONFLICT', 'Conflict',
      '09500000-0000-0000-0000-000000000042', '{}', '{}', date '2026-09-01',
      '09500000-0000-0000-0000-000000000001', '095-create-repair', repeat('b',64)
    )$$,
  '23505', 'statutory_fund_idempotency_conflict',
  'same idempotency key with a different payload fails closed'
);
select lives_ok(
  $$select app_private.activate_statutory_fund_v1(
      (select id from finance.statutory_funds where idempotency_key = '095-create-repair'),
      1, '09500000-0000-0000-0000-000000000001', 'AGM-authorized activation'
    )$$,
  'draft repair fund activates under an enabled signed regime'
);
select ok(
  (select status = 'active' and lock_version = 2 and activated_at is not null
     from finance.statutory_funds where idempotency_key = '095-create-repair')
  and exists (
    select 1 from audit.events
     where action = 'statutory.fund.activated'
       and entity_id = (select id from finance.statutory_funds where idempotency_key = '095-create-repair')
  ),
  'activation advances the lock and records its audit event atomically'
);
select throws_ok(
  $$select app_private.activate_statutory_fund_v1(
      (select id from finance.statutory_funds where idempotency_key = '095-create-repair'),
      1, '09500000-0000-0000-0000-000000000001', 'stale activation'
    )$$,
  '40001', 'statutory_fund_lock_version_conflict',
  'stale activation lock version is rejected'
);

select lives_ok(
  $$select app_private.record_statutory_fund_movement_v1(
      (select id from finance.statutory_funds where idempotency_key = '095-create-repair'),
      '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000081',
      null, null, null, 'increase', 'common_property_income', null, 100.00,
      null, null, null, null, 'Bank statement 095-IN-100', null,
      '{"source":"common-property-exploitation-income"}',
      '09500000-0000-0000-0000-000000000001', '095-movement-income', repeat('c',64)
    )$$,
  'common-property income is classified into the repair fund'
);
select ok(
  finance.statutory_fund_balance_v1(
    (select id from finance.statutory_funds where idempotency_key = '095-create-repair')
  ) = 100.00::numeric,
  'derived fund balance equals the classified receipt'
);
select ok(
  (select (app_private.record_statutory_fund_movement_v1(
      (select id from finance.statutory_funds where idempotency_key = '095-create-repair'),
      '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000081',
      null, null, null, 'increase', 'common_property_income', null, 100.00,
      null, null, null, null, 'ignored replay', null, '{}',
      '09500000-0000-0000-0000-000000000001', '095-movement-income', repeat('c',64)
    )).id) = (select id from finance.statutory_fund_movements where idempotency_key = '095-movement-income'),
  'movement replay returns the original classification without duplication'
);
select throws_ok(
  $$select app_private.record_statutory_fund_movement_v1(
      (select id from finance.statutory_funds where idempotency_key = '095-create-repair'),
      '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000081',
      null, null, null, 'increase', 'common_property_income', null, 1.00,
      null, null, null, null, 'conflict', null, '{}',
      '09500000-0000-0000-0000-000000000001', '095-movement-income', repeat('d',64)
    )$$,
  '23505', 'statutory_fund_movement_idempotency_conflict',
  'movement idempotency rejects a conflicting payload'
);
select throws_ok(
  $$select app_private.record_statutory_fund_movement_v1(
      (select id from finance.statutory_funds where idempotency_key = '095-create-repair'),
      '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000082',
      null, null, null, 'decrease', 'expenditure', 'current_expenses', 40.00,
      null, null, null, 'AUTH-095', 'Invalid repair purpose fixture', null, '{}',
      '09500000-0000-0000-0000-000000000001', '095-invalid-purpose', repeat('e',64)
    )$$,
  '23514', 'repair_fund_purpose_not_allowed',
  'repair fund rejects a non-statutory current-expense purpose'
);
select lives_ok(
  $$select app_private.record_statutory_fund_movement_v1(
      (select id from finance.statutory_funds where idempotency_key = '095-create-repair'),
      '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000082',
      null, null, null, 'decrease', 'expenditure', 'common_property_repairs', 40.00,
      null, null, null, 'AUTH-095', 'Invoice REPAIR-095', null,
      '{"invoice":"REPAIR-095","authority":"AUTH-095"}',
      '09500000-0000-0000-0000-000000000001', '095-movement-expenditure', repeat('f',64)
    )$$,
  'authorized common-property repair expenditure is classified'
);
select ok(
  finance.statutory_fund_balance_v1(
    (select id from finance.statutory_funds where idempotency_key = '095-create-repair')
  ) = 60.00::numeric,
  'derived balance subtracts the classified expenditure'
);
select throws_ok(
  $$select app_private.record_statutory_fund_movement_v1(
      (select id from finance.statutory_funds where idempotency_key = '095-create-repair'),
      '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000081',
      null, null, null, 'increase', 'common_property_income', null, 0.01,
      null, null, null, null, 'Overclassification', null, '{}',
      '09500000-0000-0000-0000-000000000001', '095-overclassify', repeat('1',64)
    )$$,
  '23514', 'statutory_simple_entry_overclassified',
  'a statutory cash entry cannot be classified beyond its amount'
);
select throws_ok(
  $$select app_private.record_statutory_fund_movement_v1(
      (select id from finance.statutory_funds where idempotency_key = '095-create-repair'),
      '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000084',
      null, null, null, 'increase', 'common_property_income', null, 10.00,
      null, null, null, null, 'Direction mismatch', null, '{}',
      '09500000-0000-0000-0000-000000000001', '095-direction-mismatch', repeat('2',64)
    )$$,
  '23514', 'statutory_fund_movement_scope_or_direction_mismatch',
  'fund delta must agree with the statutory cash-entry direction'
);
select throws_ok(
  $$select app_private.record_statutory_fund_movement_v1(
      (select id from finance.statutory_funds where idempotency_key = '095-create-repair'),
      '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000085',
      null, null, null, 'increase', 'owner_contribution', null, 10.00,
      '09500000-0000-0000-0000-000000000032', '09500000-0000-0000-0000-000000000033',
      null, null, 'Owner receipt missing reference', null, '{}',
      '09500000-0000-0000-0000-000000000001', '095-owner-no-receipt', repeat('3',64)
    )$$,
  '23514', null,
  'owner contribution requires a named receipt reference'
);
select throws_ok(
  $$update finance.statutory_fund_movements set amount = 39.00
    where idempotency_key = '095-movement-expenditure'$$,
  '55000', 'statutory_fund_record_is_append_only',
  'recorded fund movements cannot be updated'
);
select throws_ok(
  $$delete from finance.statutory_fund_movements
    where idempotency_key = '095-movement-expenditure'$$,
  '55000', 'statutory_fund_record_is_append_only',
  'recorded fund movements cannot be deleted'
);
select lives_ok(
  $$select app_private.reverse_statutory_fund_movement_v1(
      (select id from finance.statutory_fund_movements where idempotency_key = '095-movement-expenditure'),
      '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000083',
      'Credit note REPAIR-095', '{"credit_note":"CN-095"}',
      '09500000-0000-0000-0000-000000000001', '095-reverse-expenditure', repeat('4',64)
    )$$,
  'cash-backed reversal is appended rather than mutating history'
);
select ok(
  finance.statutory_fund_balance_v1(
    (select id from finance.statutory_funds where idempotency_key = '095-create-repair')
  ) = 100.00::numeric,
  'reversal restores the derived fund balance exactly'
);
select throws_ok(
  $$select app_private.reverse_statutory_fund_movement_v1(
      (select id from finance.statutory_fund_movements where idempotency_key = '095-movement-expenditure'),
      '09500000-0000-0000-0000-000000000070', '09500000-0000-0000-0000-000000000083',
      'Duplicate reversal', '{}', '09500000-0000-0000-0000-000000000001',
      '095-second-reversal', repeat('5',64)
    )$$,
  '23505', 'statutory_fund_movement_already_reversed',
  'the same movement cannot be reversed twice'
);
select ok(
  exists (
    select 1 from audit.events
     where action = 'statutory.fund.movement.recorded'
       and entity_id = (select id from finance.statutory_fund_movements where idempotency_key = '095-movement-income')
  ),
  'cash classification writes its audit event atomically'
);

select * from finish();
rollback;
