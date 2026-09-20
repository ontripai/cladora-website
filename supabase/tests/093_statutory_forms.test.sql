-- R10 Phase 1B: OMFP 3103/2017 statutory form semantics and sealing gates
begin;
select plan(31);

-- Structural, seed, RLS, and ACL contract
select has_table('finance', 'statutory_form_definitions', 'statutory form definitions table exists');
select has_table('finance', 'statutory_form_instances', 'statutory form instances table exists');
select has_function(
  'app_private', 'seal_statutory_form_instance_v1',
  array['uuid', 'integer', 'uuid'],
  'controlled statutory form sealing function exists'
);
select has_trigger(
  'finance', 'statutory_form_instances', 'statutory_form_instances_scope_guard',
  'form instances have a scope guard'
);
select has_trigger(
  'finance', 'statutory_form_instances', 'statutory_form_instances_immutable',
  'form instances have a final-record immutability guard'
);

select ok(
  (select array_agg(form_code order by form_code)::text
     from finance.statutory_form_definitions where version = 1)
    = array['14-1-1/A', '14-1-2', '14-6-28', '14-6-30/d']::text[]::text,
  'the four required OMFP form definitions are seeded exactly once'
);
select ok(
  not exists (
    select 1 from finance.statutory_form_definitions
    where btrim(canonical_name_ro) = '' or btrim(legal_source) = ''
      or legal_source <> 'OMFP 3103/2017, Anexa 2'
  ),
  'every form has a Romanian canonical name and authoritative legal source'
);
select ok(
  not exists (
    select 1 from finance.statutory_form_definitions
    where jsonb_typeof(semantic_schema) <> 'object'
      or jsonb_typeof(semantic_schema -> 'required') <> 'array'
      or jsonb_array_length(semantic_schema -> 'required') = 0
  ),
  'every form has a non-empty machine-readable semantic schema'
);
select ok(
  (select count(*) = 2 from finance.statutory_form_definitions
    where form_code in ('14-1-1/A', '14-1-2')
      and renderer_status = 'semantic_schema_verified'),
  'journal and inventory semantic schemas are verified'
);
select ok(
  (select count(*) = 2 from finance.statutory_form_definitions
    where form_code in ('14-6-28', '14-6-30/d')
      and renderer_status = 'legal_review_required'
      and semantic_schema ->> 'layout' = 'official_image_transcription_pending'),
  'payment-list and balances renderers remain explicitly legal-review gated'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'finance.statutory_form_definitions'::regclass),
  'form definitions RLS is enabled'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'finance.statutory_form_instances'::regclass),
  'form instances RLS is enabled'
);
select ok(
  not has_table_privilege('anon', 'finance.statutory_form_definitions', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_form_definitions', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'finance.statutory_form_instances', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_form_instances', 'SELECT,INSERT,UPDATE,DELETE'),
  'form tables expose no direct anon or authenticated DML'
);
select ok(
  not has_function_privilege('anon', 'app_private.seal_statutory_form_instance_v1(uuid,integer,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app_private.seal_statutory_form_instance_v1(uuid,integer,uuid)', 'EXECUTE'),
  'form sealing is not callable by anon or authenticated'
);
select ok(
  has_function_privilege('service_role', 'app_private.seal_statutory_form_instance_v1(uuid,integer,uuid)', 'EXECUTE'),
  'form sealing is callable by service_role'
);

-- Isolated tenant, workspace, property, regime, period, cycle, and actor fixtures
insert into auth.users (id, email) values
  ('09300000-0000-0000-0000-000000000001', 'r10-phase1b-forms@test.local')
on conflict (id) do nothing;

insert into platform.tenants (id, legal_name, registration_number, status) values
  ('09300000-0000-0000-0000-000000000010', 'R10 Forms Tenant A', 'RO-R10-093-A', 'active'),
  ('09300000-0000-0000-0000-000000000020', 'R10 Forms Tenant B', 'RO-R10-093-B', 'active')
on conflict (id) do nothing;

insert into platform.customer_workspaces (
  id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment
) values (
  '09300000-0000-0000-0000-000000000100',
  '09300000-0000-0000-0000-000000000010',
  'ASSOCIATION', 'ACTIVE', 'R10 Forms Test', 'PILOT'
);

insert into portfolio.properties (id, tenant_id, type, name, status) values
  ('09300000-0000-0000-0000-000000001000', '09300000-0000-0000-0000-000000000010', 'condominium', 'R10 Forms Property A', 'active'),
  ('09300000-0000-0000-0000-000000002000', '09300000-0000-0000-0000-000000000020', 'condominium', 'R10 Forms Property B', 'active');

insert into finance.statutory_accounting_regimes (
  id, tenant_id, customer_workspace_id, property_id, status,
  statutory_operations_enabled, accounting_signoff_reference, accounting_signed_at,
  legal_signoff_reference, legal_signed_at, activated_at
) values (
  '09300000-0000-0000-0000-000000010000',
  '09300000-0000-0000-0000-000000000010',
  '09300000-0000-0000-0000-000000000100',
  '09300000-0000-0000-0000-000000001000',
  'active', true, 'CECCAR-R10-093', statement_timestamp(),
  'LEGAL-R10-093', statement_timestamp(), statement_timestamp()
);

insert into finance.accounting_periods (
  id, tenant_id, property_id, starts_on, ends_on
) values (
  '09300000-0000-0000-0000-000000020000',
  '09300000-0000-0000-0000-000000000010',
  '09300000-0000-0000-0000-000000001000',
  date '2026-09-01', date '2026-09-30'
);

insert into finance.statutory_monthly_cycles (
  id, regime_id, tenant_id, property_id, accounting_period_id,
  status, opening_balance, total_receipts, total_payments
) values (
  '09300000-0000-0000-0000-000000030000',
  '09300000-0000-0000-0000-000000010000',
  '09300000-0000-0000-0000-000000000010',
  '09300000-0000-0000-0000-000000001000',
  '09300000-0000-0000-0000-000000020000',
  'collecting', 100.00, 75.00, 20.00
);

insert into finance.statutory_simple_entries (
  id, cycle_id, tenant_id, property_id, entry_date, direction,
  payment_medium, document_type, document_number, amount, description, created_by
) values
  (
    '09300000-0000-0000-0000-000000040001',
    '09300000-0000-0000-0000-000000030000',
    '09300000-0000-0000-0000-000000000010',
    '09300000-0000-0000-0000-000000001000',
    date '2026-09-05', 'receipt', 'bank', 'EXTRAS_CONT', '093-R-001',
    75.00, 'Statutory receipt fixture', '09300000-0000-0000-0000-000000000001'
  ),
  (
    '09300000-0000-0000-0000-000000040002',
    '09300000-0000-0000-0000-000000030000',
    '09300000-0000-0000-0000-000000000010',
    '09300000-0000-0000-0000-000000001000',
    date '2026-09-06', 'payment', 'bank', 'ORDIN_PLATA', '093-P-001',
    20.00, 'Statutory payment fixture', '09300000-0000-0000-0000-000000000001'
  );

select throws_ok(
  $$insert into finance.statutory_form_instances (
      definition_id, cycle_id, tenant_id, property_id, payload, generated_by
    ) values (
      '10600000-0000-0000-0000-000000000001',
      '09300000-0000-0000-0000-000000030000',
      '09300000-0000-0000-0000-000000000020',
      '09300000-0000-0000-0000-000000002000',
      '{}'::jsonb, '09300000-0000-0000-0000-000000000001'
    )$$,
  '23514', 'statutory_form_scope_mismatch',
  'cross-tenant form scope is rejected'
);

-- Registrul-jurnal: payload completeness, exact control reconciliation, and sealing
insert into finance.statutory_form_instances (
  id, definition_id, cycle_id, tenant_id, property_id, instance_version, payload, generated_by
) values
  (
    '09300000-0000-0000-0000-000000050001',
    '10600000-0000-0000-0000-000000000001',
    '09300000-0000-0000-0000-000000030000',
    '09300000-0000-0000-0000-000000000010',
    '09300000-0000-0000-0000-000000001000', 1,
    '{"rows":[{"sequence":1,"operation_date":"2026-09-05","supporting_document":"093-R-001","operation_description":"Receipt","amount":75.00},{"sequence":2,"operation_date":"2026-09-06","supporting_document":"093-P-001","operation_description":"Payment","amount":20.00}],"control_totals":{"total_receipts":75.00,"total_payments":20.00}}',
    '09300000-0000-0000-0000-000000000001'
  ),
  (
    '09300000-0000-0000-0000-000000050002',
    '10600000-0000-0000-0000-000000000001',
    '09300000-0000-0000-0000-000000030000',
    '09300000-0000-0000-0000-000000000010',
    '09300000-0000-0000-0000-000000001000', 2,
    '{"rows":[{"sequence":1}],"control_totals":{"total_receipts":75.00,"total_payments":20.00}}',
    '09300000-0000-0000-0000-000000000001'
  ),
  (
    '09300000-0000-0000-0000-000000050003',
    '10600000-0000-0000-0000-000000000001',
    '09300000-0000-0000-0000-000000030000',
    '09300000-0000-0000-0000-000000000010',
    '09300000-0000-0000-0000-000000001000', 3,
    '{"rows":[{"sequence":1}],"control_totals":{"total_receipts":74.99,"total_payments":20.00}}',
    '09300000-0000-0000-0000-000000000001'
  ),
  (
    '09300000-0000-0000-0000-000000050004',
    '10600000-0000-0000-0000-000000000001',
    '09300000-0000-0000-0000-000000030000',
    '09300000-0000-0000-0000-000000000010',
    '09300000-0000-0000-0000-000000001000', 4,
    '{"control_totals":{"total_receipts":75.00,"total_payments":20.00}}',
    '09300000-0000-0000-0000-000000000001'
  );

select lives_ok(
  $$select app_private.seal_statutory_form_instance_v1(
      '09300000-0000-0000-0000-000000050001', 1,
      '09300000-0000-0000-0000-000000000001'
    )$$,
  'journal seals when its control totals match append-only simple entries'
);
select ok(
  (select state = 'finalized'
      and payload_hash ~ '^[0-9a-f]{64}$'
      and finalized_by = '09300000-0000-0000-0000-000000000001'
      and finalized_at is not null
     from finance.statutory_form_instances
    where id = '09300000-0000-0000-0000-000000050001'),
  'sealed journal records hash, actor, timestamp, and final state atomically'
);
select ok(
  exists (
    select 1 from audit.events
    where entity_id = '09300000-0000-0000-0000-000000050001'
      and action = 'statutory.form.finalized'
      and after_snapshot ->> 'form_code' = '14-1-1/A'
  ),
  'journal sealing writes its audit event atomically'
);
select throws_ok(
  $$update finance.statutory_form_instances
    set payload = payload || '{"tampered":true}'::jsonb
    where id = '09300000-0000-0000-0000-000000050001'$$,
  '55000', 'final_statutory_form_is_immutable',
  'finalized form payload cannot be changed'
);
select throws_ok(
  $$delete from finance.statutory_form_instances
    where id = '09300000-0000-0000-0000-000000050001'$$,
  '55000', 'final_statutory_form_is_immutable',
  'finalized form cannot be deleted'
);
select throws_ok(
  $$select app_private.seal_statutory_form_instance_v1(
      '09300000-0000-0000-0000-000000050002', 1,
      '09300000-0000-0000-0000-000000000001'
    )$$,
  '40001', 'statutory_form_instance_version_conflict',
  'stale form instance version is rejected before mutation'
);
select throws_ok(
  $$select app_private.seal_statutory_form_instance_v1(
      '09300000-0000-0000-0000-000000050003', 3,
      '09300000-0000-0000-0000-000000000001'
    )$$,
  '23514', 'statutory_journal_control_totals_mismatch',
  'journal totals must reconcile exactly to simple-entry evidence'
);
select throws_ok(
  $$select app_private.seal_statutory_form_instance_v1(
      '09300000-0000-0000-0000-000000050004', 4,
      '09300000-0000-0000-0000-000000000001'
    )$$,
  '23514', 'statutory_journal_payload_incomplete',
  'incomplete journal payload fails closed'
);

-- Registrul-inventar and Phase 2 dependent forms
insert into finance.statutory_form_instances (
  id, definition_id, cycle_id, tenant_id, property_id, instance_version, payload, generated_by
) values
  (
    '09300000-0000-0000-0000-000000060001',
    '10600000-0000-0000-0000-000000000002',
    '09300000-0000-0000-0000-000000030000',
    '09300000-0000-0000-0000-000000000010',
    '09300000-0000-0000-0000-000000001000', 1,
    '{"inventory_rows":[{"sequence":1,"item_nature":"cash","book_value":155.00,"inventory_value":155.00,"difference":0,"difference_cause":"none"}],"inventory_signoff_reference":"INV-COMMITTEE-093"}',
    '09300000-0000-0000-0000-000000000001'
  ),
  (
    '09300000-0000-0000-0000-000000060002',
    '10600000-0000-0000-0000-000000000002',
    '09300000-0000-0000-0000-000000030000',
    '09300000-0000-0000-0000-000000000010',
    '09300000-0000-0000-0000-000000001000', 2,
    '{"inventory_rows":[],"inventory_signoff_reference":""}',
    '09300000-0000-0000-0000-000000000001'
  ),
  (
    '09300000-0000-0000-0000-000000060003',
    '10600000-0000-0000-0000-000000000003',
    '09300000-0000-0000-0000-000000030000',
    '09300000-0000-0000-0000-000000000010',
    '09300000-0000-0000-0000-000000001000', 1,
    '{"period":"2026-09","owners":[],"expense_categories":[],"contribution_quotas":[],"fund_replenishment":[]}',
    '09300000-0000-0000-0000-000000000001'
  ),
  (
    '09300000-0000-0000-0000-000000060004',
    '10600000-0000-0000-0000-000000000004',
    '09300000-0000-0000-0000-000000030000',
    '09300000-0000-0000-0000-000000000010',
    '09300000-0000-0000-0000-000000001000', 1,
    '{"period":"2026-09","asset_balances":[],"liability_balances":[],"control_totals":{}}',
    '09300000-0000-0000-0000-000000000001'
  );

select lives_ok(
  $$select app_private.seal_statutory_form_instance_v1(
      '09300000-0000-0000-0000-000000060001', 1,
      '09300000-0000-0000-0000-000000000001'
    )$$,
  'inventory register seals with rows and committee sign-off reference'
);
select ok(
  (select state = 'finalized' and payload_hash ~ '^[0-9a-f]{64}$'
     from finance.statutory_form_instances
    where id = '09300000-0000-0000-0000-000000060001'),
  'sealed inventory register receives a deterministic payload hash'
);
select throws_ok(
  $$select app_private.seal_statutory_form_instance_v1(
      '09300000-0000-0000-0000-000000060002', 2,
      '09300000-0000-0000-0000-000000000001'
    )$$,
  '23514', 'statutory_inventory_payload_incomplete',
  'inventory register without rows and sign-off fails closed'
);
select throws_ok(
  $$select app_private.seal_statutory_form_instance_v1(
      '09300000-0000-0000-0000-000000060003', 1,
      '09300000-0000-0000-0000-000000000001'
    )$$,
  '55000', 'statutory_form_phase2_dependencies_not_ready: 14-6-28',
  '14-6-28 cannot be sealed before Phase 2 fund and penalty dependencies exist'
);
select ok(
  (select state = 'draft' and payload_hash is null
     from finance.statutory_form_instances
    where id = '09300000-0000-0000-0000-000000060003'),
  'failed 14-6-28 sealing leaves the draft unchanged'
);
select throws_ok(
  $$select app_private.seal_statutory_form_instance_v1(
      '09300000-0000-0000-0000-000000060004', 1,
      '09300000-0000-0000-0000-000000000001'
    )$$,
  '55000', 'statutory_form_phase2_dependencies_not_ready: 14-6-30/d',
  '14-6-30/d cannot be sealed before Phase 2 balance dependencies exist'
);
select ok(
  (select state = 'draft' and payload_hash is null
     from finance.statutory_form_instances
    where id = '09300000-0000-0000-0000-000000060004'),
  'failed 14-6-30/d sealing leaves the draft unchanged'
);

rollback;
