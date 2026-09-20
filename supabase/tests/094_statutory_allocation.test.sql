-- R10 Phase 1B: deterministic statutory allocation engine
begin;
select plan(37);

-- Structural, enum, RLS, and privilege contract
select has_table('finance', 'statutory_allocation_batches', 'statutory allocation batches table exists');
select has_table('finance', 'statutory_allocation_bases', 'statutory allocation bases table exists');
select has_table('finance', 'statutory_allocation_results', 'statutory allocation results table exists');
select has_function(
  'finance', 'calculate_largest_remainder_v1', array['numeric', 'jsonb'],
  'cent-exact largest-remainder function exists'
);
select has_trigger(
  'finance', 'statutory_allocation_batches', 'statutory_allocation_batches_immutable',
  'calculated batches have an immutability guard'
);
select has_function(
  'app_private', 'calculate_statutory_allocation_batch_v1', array['uuid', 'integer', 'uuid'],
  'controlled statutory allocation RPC exists'
);
select ok(
  (select array_agg(e.enumlabel order by e.enumsortorder)::text
     from pg_enum e
     join pg_type t on t.oid = e.enumtypid
     join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'finance' and t.typname = 'statutory_expense_category')
    = '{persons,individual_consumption,undivided_share,beneficiaries,technical_consumers,other}',
  'statutory expense enum is exactly the six Law 196/2018 categories'
);
select ok((select relrowsecurity from pg_class where oid = 'finance.statutory_allocation_batches'::regclass), 'batches RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'finance.statutory_allocation_bases'::regclass), 'bases RLS enabled');
select ok((select relrowsecurity from pg_class where oid = 'finance.statutory_allocation_results'::regclass), 'results RLS enabled');
select ok(
  not has_table_privilege('anon', 'finance.statutory_allocation_batches', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_allocation_batches', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'finance.statutory_allocation_bases', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_allocation_bases', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('anon', 'finance.statutory_allocation_results', 'SELECT,INSERT,UPDATE,DELETE')
  and not has_table_privilege('authenticated', 'finance.statutory_allocation_results', 'SELECT,INSERT,UPDATE,DELETE'),
  'allocation evidence exposes no direct anon or authenticated DML'
);
select ok(
  not has_function_privilege('anon', 'finance.calculate_largest_remainder_v1(numeric,jsonb)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'finance.calculate_largest_remainder_v1(numeric,jsonb)', 'EXECUTE')
  and not has_function_privilege('anon', 'app_private.calculate_statutory_allocation_batch_v1(uuid,integer,uuid)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'app_private.calculate_statutory_allocation_batch_v1(uuid,integer,uuid)', 'EXECUTE')
  and has_function_privilege('service_role', 'finance.calculate_largest_remainder_v1(numeric,jsonb)', 'EXECUTE')
  and has_function_privilege('service_role', 'app_private.calculate_statutory_allocation_batch_v1(uuid,integer,uuid)', 'EXECUTE'),
  'only service_role can execute statutory allocation functions'
);

-- Pure largest-remainder mathematics: integer bani, conservation, and UUID tie-break.
select ok(
  (select count(*) = 3
          and bool_and(allocated_cents = case subject_id
            when '09400000-0000-0000-0000-000000000001'::uuid then 3334
            when '09400000-0000-0000-0000-000000000002'::uuid then 3333
            when '09400000-0000-0000-0000-000000000003'::uuid then 3333
            else -1 end)
     from finance.calculate_largest_remainder_v1(
       100.00,
       '[{"subject_id":"09400000-0000-0000-0000-000000000001","basis_value":1},
         {"subject_id":"09400000-0000-0000-0000-000000000002","basis_value":1},
         {"subject_id":"09400000-0000-0000-0000-000000000003","basis_value":1}]'::jsonb
     )),
  '100 RON divided by equal bases assigns the residual ban to the lowest UUID'
);
select ok(
  (select sum(allocated_cents)
     from finance.calculate_largest_remainder_v1(
       100.00,
       '[{"subject_id":"09400000-0000-0000-0000-000000000001","basis_value":1},
         {"subject_id":"09400000-0000-0000-0000-000000000002","basis_value":2}]'::jsonb
     )) = 10000,
  'pure allocation conserves every source cent'
);
select throws_ok(
  $$select * from finance.calculate_largest_remainder_v1(1.001, '[{"subject_id":"09400000-0000-0000-0000-000000000001","basis_value":1}]')$$,
  '22003', 'statutory_allocation_amount_invalid', 'amounts finer than one ban are rejected'
);
select throws_ok(
  $$select * from finance.calculate_largest_remainder_v1(1.00, '[]')$$,
  '22023', 'statutory_allocation_bases_invalid', 'empty bases are rejected'
);
select throws_ok(
  $$select * from finance.calculate_largest_remainder_v1(1.00,
    '[{"subject_id":"09400000-0000-0000-0000-000000000001","basis_value":1},
      {"subject_id":"09400000-0000-0000-0000-000000000001","basis_value":1}]')$$,
  '22023', 'statutory_allocation_bases_invalid', 'duplicate subjects are rejected'
);
select throws_ok(
  $$select * from finance.calculate_largest_remainder_v1(1.00,
    '[{"subject_id":"09400000-0000-0000-0000-000000000001","basis_value":-1}]')$$,
  '22023', 'statutory_allocation_bases_invalid', 'negative bases are rejected'
);
select throws_ok(
  $$select * from finance.calculate_largest_remainder_v1(1.00,
    '[{"subject_id":"09400000-0000-0000-0000-000000000001","basis_value":0}]')$$,
  '22023', 'statutory_allocation_bases_invalid', 'zero denominator is rejected'
);

-- Isolated tenant, property, unit, accounting, and legacy allocation fixtures.
insert into auth.users (id, email) values
  ('09400000-0000-0000-0000-000000000010', 'r10-phase1b-allocation@test.local')
on conflict (id) do nothing;

insert into platform.tenants (id, legal_name, registration_number, status) values
  ('09400000-0000-0000-0000-000000000020', 'R10 Allocation Tenant A', 'RO-R10-094-A', 'active'),
  ('09400000-0000-0000-0000-000000000021', 'R10 Allocation Tenant B', 'RO-R10-094-B', 'active');

insert into platform.customer_workspaces (
  id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment
) values (
  '09400000-0000-0000-0000-000000000030',
  '09400000-0000-0000-0000-000000000020',
  'ASSOCIATION', 'ACTIVE', 'R10 Allocation Test', 'PILOT'
);

insert into portfolio.properties (id, tenant_id, type, name, status) values
  ('09400000-0000-0000-0000-000000000040', '09400000-0000-0000-0000-000000000020', 'condominium', 'R10 Allocation Property A', 'active'),
  ('09400000-0000-0000-0000-000000000041', '09400000-0000-0000-0000-000000000021', 'condominium', 'R10 Allocation Property B', 'active');

insert into portfolio.buildings (id, tenant_id, property_id, code, name) values
  ('09400000-0000-0000-0000-000000000050', '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000040', 'A', 'Building A'),
  ('09400000-0000-0000-0000-000000000051', '09400000-0000-0000-0000-000000000021', '09400000-0000-0000-0000-000000000041', 'B', 'Building B');

insert into portfolio.units (id, tenant_id, building_id, code) values
  ('09400000-0000-0000-0000-000000000001', '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000050', 'A-1'),
  ('09400000-0000-0000-0000-000000000002', '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000050', 'A-2'),
  ('09400000-0000-0000-0000-000000000003', '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000050', 'A-3'),
  ('09400000-0000-0000-0000-000000000004', '09400000-0000-0000-0000-000000000021', '09400000-0000-0000-0000-000000000051', 'B-1');

insert into finance.accounting_periods (id, tenant_id, property_id, starts_on, ends_on) values (
  '09400000-0000-0000-0000-000000000060',
  '09400000-0000-0000-0000-000000000020',
  '09400000-0000-0000-0000-000000000040', date '2026-09-01', date '2026-09-30'
);

insert into finance.charge_categories (id, tenant_id, code, name) values (
  '09400000-0000-0000-0000-000000000070',
  '09400000-0000-0000-0000-000000000020', 'R10-STATUTORY', 'R10 statutory allocation'
);

insert into finance.allocation_runs (
  id, tenant_id, property_id, period_start, period_end, currency, status
) values (
  '09400000-0000-0000-0000-000000000080',
  '09400000-0000-0000-0000-000000000020',
  '09400000-0000-0000-0000-000000000040', date '2026-09-01', date '2026-10-01', 'RON', 'draft'
);

insert into finance.allocation_inputs (
  id, tenant_id, run_id, source_type, category_id, amount, snapshot_json
) values
  ('09400000-0000-0000-0000-000000000081', '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000080', 'statutory_test', '09400000-0000-0000-0000-000000000070', 100.0000, '{"document":"A-100"}'),
  ('09400000-0000-0000-0000-000000000082', '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000080', 'statutory_test', '09400000-0000-0000-0000-000000000070', 90.0000, '{"document":"A-090"}'),
  ('09400000-0000-0000-0000-000000000083', '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000080', 'statutory_test', '09400000-0000-0000-0000-000000000070', 30.0000, '{"document":"A-030"}'),
  ('09400000-0000-0000-0000-000000000084', '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000080', 'statutory_test', '09400000-0000-0000-0000-000000000070', 20.0000, '{"document":"A-020"}');

insert into finance.monthly_cycles (
  id, tenant_id, property_id, accounting_period_id, allocation_run_id, status, prepared_by
) values (
  '09400000-0000-0000-0000-000000000090',
  '09400000-0000-0000-0000-000000000020',
  '09400000-0000-0000-0000-000000000040',
  '09400000-0000-0000-0000-000000000060',
  '09400000-0000-0000-0000-000000000080', 'draft',
  '09400000-0000-0000-0000-000000000010'
);

insert into finance.statutory_accounting_regimes (
  id, tenant_id, customer_workspace_id, property_id, status,
  statutory_operations_enabled, accounting_signoff_reference, accounting_signed_at,
  legal_signoff_reference, legal_signed_at, activated_at
) values (
  '09400000-0000-0000-0000-000000000100',
  '09400000-0000-0000-0000-000000000020',
  '09400000-0000-0000-0000-000000000030',
  '09400000-0000-0000-0000-000000000040', 'active', true,
  'CECCAR-R10-094', statement_timestamp(), 'LEGAL-R10-094', statement_timestamp(), statement_timestamp()
);

insert into finance.statutory_monthly_cycles (
  id, regime_id, tenant_id, property_id, accounting_period_id,
  operational_monthly_cycle_id, status
) values (
  '09400000-0000-0000-0000-000000000110',
  '09400000-0000-0000-0000-000000000100',
  '09400000-0000-0000-0000-000000000020',
  '09400000-0000-0000-0000-000000000040',
  '09400000-0000-0000-0000-000000000060',
  '09400000-0000-0000-0000-000000000090', 'collecting'
);

-- Valid undivided-share batch: exact 1.0 share and cent-conserving result.
insert into finance.statutory_allocation_batches (
  id, cycle_id, allocation_run_id, allocation_input_id, tenant_id, property_id,
  category, legal_basis, source_document_type, source_document_number,
  source_amount, basis_policy_code, created_by
) values (
  '09400000-0000-0000-0000-000000000120',
  '09400000-0000-0000-0000-000000000110',
  '09400000-0000-0000-0000-000000000080',
  '09400000-0000-0000-0000-000000000081',
  '09400000-0000-0000-0000-000000000020',
  '09400000-0000-0000-0000-000000000040',
  'undivided_share', 'Legea 196/2018 art. 84-86', 'invoice', 'INV-100',
  100.00, 'undivided_share_snapshot', '09400000-0000-0000-0000-000000000010'
);

insert into finance.statutory_allocation_bases (
  id, batch_id, tenant_id, unit_id, basis_value, basis_unit, provenance, created_by
) values
  ('09400000-0000-0000-0000-000000000121', '09400000-0000-0000-0000-000000000120', '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000001', 0.33333334, 'share_fraction', '{"evidence":"title-A1"}', '09400000-0000-0000-0000-000000000010'),
  ('09400000-0000-0000-0000-000000000122', '09400000-0000-0000-0000-000000000120', '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000002', 0.33333333, 'share_fraction', '{"evidence":"title-A2"}', '09400000-0000-0000-0000-000000000010'),
  ('09400000-0000-0000-0000-000000000123', '09400000-0000-0000-0000-000000000120', '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000003', 0.33333333, 'share_fraction', '{"evidence":"title-A3"}', '09400000-0000-0000-0000-000000000010');

select lives_ok(
  $$select app_private.calculate_statutory_allocation_batch_v1(
      '09400000-0000-0000-0000-000000000120', 1,
      '09400000-0000-0000-0000-000000000010')$$,
  'exact undivided shares calculate successfully'
);
select ok(
  (select status = 'calculated' and lock_version = 2 and calculated_at is not null
          and calculated_by = '09400000-0000-0000-0000-000000000010'
          and input_hash ~ '^[0-9a-f]{64}$' and results_hash ~ '^[0-9a-f]{64}$'
          and source_snapshot = '{"document":"A-100"}'::jsonb
          and source_snapshot_hash ~ '^[0-9a-f]{64}$'
     from finance.statutory_allocation_batches
    where id = '09400000-0000-0000-0000-000000000120'),
  'calculation atomically seals status, actor, version, and evidence hashes'
);
select ok(
  (select source_snapshot_hash = encode(extensions.digest(convert_to(jsonb_build_object(
      'allocation_input_id', allocation_input_id,
      'amount', source_amount,
      'snapshot', source_snapshot
    )::text, 'UTF8'), 'sha256'), 'hex')
   from finance.statutory_allocation_batches
   where id = '09400000-0000-0000-0000-000000000120'),
  'legacy allocation input is captured as a self-verifying immutable snapshot'
);
select ok(
  (select sum(allocated_cents) from finance.statutory_allocation_results
    where batch_id = '09400000-0000-0000-0000-000000000120') = 10000,
  'persisted allocation conserves the source amount in bani'
);
select ok(
  (select count(*) from finance.statutory_allocation_results
    where batch_id = '09400000-0000-0000-0000-000000000120') = 3,
  'one immutable result is persisted per unit basis'
);
select ok(
  exists(select 1 from audit.events
    where entity_id = '09400000-0000-0000-0000-000000000120'
      and action = 'statutory.allocation.calculated'),
  'calculation writes an atomic audit event'
);
select throws_ok(
  $$select app_private.calculate_statutory_allocation_batch_v1(
      '09400000-0000-0000-0000-000000000120', 1,
      '09400000-0000-0000-0000-000000000010')$$,
  '40001', 'statutory_allocation_lock_version_conflict',
  'stale calculation replay is rejected before lifecycle mutation'
);
select throws_ok(
  $$update finance.statutory_allocation_bases set basis_value = 0.5
    where id = '09400000-0000-0000-0000-000000000121'$$,
  '55000', 'statutory_allocation_evidence_is_append_only', 'basis snapshots are immutable'
);
select throws_ok(
  $$delete from finance.statutory_allocation_results
    where batch_id = '09400000-0000-0000-0000-000000000120'$$,
  '55000', 'statutory_allocation_evidence_is_append_only', 'allocation results are immutable'
);
select throws_ok(
  $$update finance.statutory_allocation_batches set source_amount = 99.00
    where id = '09400000-0000-0000-0000-000000000120'$$,
  '55000', 'calculated_statutory_allocation_is_immutable',
  'calculated batch and captured source evidence cannot be changed'
);

-- Fail-closed category and scope semantics.
select throws_ok(
  $$insert into finance.statutory_allocation_batches (
      cycle_id, allocation_run_id, allocation_input_id, tenant_id, property_id,
      category, legal_basis, source_document_type, source_document_number,
      source_amount, basis_policy_code, created_by
    ) values (
      '09400000-0000-0000-0000-000000000110',
      '09400000-0000-0000-0000-000000000080',
      '09400000-0000-0000-0000-000000000082',
      '09400000-0000-0000-0000-000000000020',
      '09400000-0000-0000-0000-000000000040',
      'technical_consumers', 'Legea 196/2018 art. 90', 'invoice', 'TECH-NO-METHOD',
      90.00, 'technical_measurement', '09400000-0000-0000-0000-000000000010')$$,
  '23514', null, 'technical-consumer allocation requires an explicit methodology'
);
select throws_ok(
  $$insert into finance.statutory_allocation_batches (
      cycle_id, allocation_run_id, allocation_input_id, tenant_id, property_id,
      category, legal_basis, source_document_type, source_document_number,
      source_amount, basis_policy_code, policy_decision_reference, created_by
    ) values (
      '09400000-0000-0000-0000-000000000110',
      '09400000-0000-0000-0000-000000000080',
      '09400000-0000-0000-0000-000000000082',
      '09400000-0000-0000-0000-000000000020',
      '09400000-0000-0000-0000-000000000040',
      'other', 'Legea 196/2018 art. 91-93', 'invoice', 'OTHER-EQUAL',
      90.00, 'generic_equal_split', 'AGM-094', '09400000-0000-0000-0000-000000000010')$$,
  '23514', null, 'generic equal split is forbidden for statutory other expenses'
);
select throws_ok(
  $$insert into finance.statutory_allocation_batches (
      cycle_id, allocation_run_id, allocation_input_id, tenant_id, property_id,
      category, legal_basis, source_document_type, source_document_number,
      source_amount, basis_policy_code, created_by
    ) values (
      '09400000-0000-0000-0000-000000000110',
      '09400000-0000-0000-0000-000000000080',
      '09400000-0000-0000-0000-000000000082',
      '09400000-0000-0000-0000-000000000021',
      '09400000-0000-0000-0000-000000000041',
      'undivided_share', 'Legea 196/2018 art. 84-86', 'invoice', 'CROSS-SCOPE',
      90.00, 'share_snapshot', '09400000-0000-0000-0000-000000000010')$$,
  '23514', 'statutory_allocation_scope_mismatch', 'cross-tenant batch scope is rejected'
);
select throws_ok(
  $$insert into finance.statutory_allocation_batches (
      cycle_id, allocation_run_id, allocation_input_id, tenant_id, property_id,
      category, legal_basis, source_document_type, source_document_number,
      source_amount, basis_policy_code, created_by
    ) values (
      '09400000-0000-0000-0000-000000000110',
      '09400000-0000-0000-0000-000000000080',
      '09400000-0000-0000-0000-000000000082',
      '09400000-0000-0000-0000-000000000020',
      '09400000-0000-0000-0000-000000000040',
      'undivided_share', 'Legea 196/2018 art. 84-86', 'invoice', 'SOURCE-MISMATCH',
      91.00, 'share_snapshot', '09400000-0000-0000-0000-000000000010')$$,
  '23514', 'statutory_allocation_legacy_source_mismatch', 'source amount must match the immutable legacy input'
);

-- Wrong share total fails at calculation time.
insert into finance.statutory_allocation_batches (
  id, cycle_id, allocation_run_id, allocation_input_id, tenant_id, property_id,
  category, legal_basis, source_document_type, source_document_number,
  source_amount, basis_policy_code, created_by
) values (
  '09400000-0000-0000-0000-000000000130', '09400000-0000-0000-0000-000000000110',
  '09400000-0000-0000-0000-000000000080', '09400000-0000-0000-0000-000000000082',
  '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000040',
  'undivided_share', 'Legea 196/2018 art. 84-86', 'invoice', 'INV-090',
  90.00, 'undivided_share_snapshot', '09400000-0000-0000-0000-000000000010'
);
insert into finance.statutory_allocation_bases (
  batch_id, tenant_id, unit_id, basis_value, basis_unit, provenance, created_by
) values
  ('09400000-0000-0000-0000-000000000130', '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000001', 0.45, 'share_fraction', '{}', '09400000-0000-0000-0000-000000000010'),
  ('09400000-0000-0000-0000-000000000130', '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000002', 0.45, 'share_fraction', '{}', '09400000-0000-0000-0000-000000000010');
select throws_ok(
  $$select app_private.calculate_statutory_allocation_batch_v1(
      '09400000-0000-0000-0000-000000000130', 1,
      '09400000-0000-0000-0000-000000000010')$$,
  '23514', 'statutory_undivided_shares_must_total_one',
  'partial undivided shares cannot be normalized into full authority'
);

-- Consumption provenance and policy-governed categories fail closed.
insert into finance.statutory_allocation_batches (
  id, cycle_id, allocation_run_id, allocation_input_id, tenant_id, property_id,
  category, legal_basis, source_document_type, source_document_number,
  source_amount, basis_policy_code, created_by
) values (
  '09400000-0000-0000-0000-000000000140', '09400000-0000-0000-0000-000000000110',
  '09400000-0000-0000-0000-000000000080', '09400000-0000-0000-0000-000000000083',
  '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000040',
  'individual_consumption', 'Legea 196/2018 art. 83', 'invoice', 'INV-030',
  30.00, 'meter_snapshot', '09400000-0000-0000-0000-000000000010'
);
insert into finance.statutory_allocation_bases (
  batch_id, tenant_id, unit_id, basis_value, basis_unit, provenance, created_by
) values (
  '09400000-0000-0000-0000-000000000140', '09400000-0000-0000-0000-000000000020',
  '09400000-0000-0000-0000-000000000001', 10, 'meter_units', '{}',
  '09400000-0000-0000-0000-000000000010'
);
select throws_ok(
  $$select app_private.calculate_statutory_allocation_batch_v1(
      '09400000-0000-0000-0000-000000000140', 1,
      '09400000-0000-0000-0000-000000000010')$$,
  '23514', 'statutory_consumption_provenance_required',
  'individual consumption requires reading and methodology provenance'
);

insert into finance.statutory_allocation_batches (
  id, cycle_id, allocation_run_id, allocation_input_id, tenant_id, property_id,
  category, legal_basis, source_document_type, source_document_number,
  source_amount, basis_policy_code, created_by
) values (
  '09400000-0000-0000-0000-000000000150', '09400000-0000-0000-0000-000000000110',
  '09400000-0000-0000-0000-000000000080', '09400000-0000-0000-0000-000000000084',
  '09400000-0000-0000-0000-000000000020', '09400000-0000-0000-0000-000000000040',
  'persons', 'Legea 196/2018 art. 82', 'invoice', 'INV-020',
  20.00, 'person_days_snapshot', '09400000-0000-0000-0000-000000000010'
);
insert into finance.statutory_allocation_bases (
  batch_id, tenant_id, unit_id, basis_value, basis_unit, provenance, created_by
) values (
  '09400000-0000-0000-0000-000000000150', '09400000-0000-0000-0000-000000000020',
  '09400000-0000-0000-0000-000000000001', 2, 'person_days', '{"roster":"September"}',
  '09400000-0000-0000-0000-000000000010'
);
select throws_ok(
  $$select app_private.calculate_statutory_allocation_batch_v1(
      '09400000-0000-0000-0000-000000000150', 1,
      '09400000-0000-0000-0000-000000000010')$$,
  '23514', 'statutory_policy_decision_reference_required',
  'person-based allocation requires a recorded policy decision'
);

select throws_ok(
  $$insert into finance.statutory_allocation_bases (
      batch_id, tenant_id, unit_id, basis_value, basis_unit, provenance, created_by
    ) values (
      '09400000-0000-0000-0000-000000000130',
      '09400000-0000-0000-0000-000000000021',
      '09400000-0000-0000-0000-000000000004', 0.10, 'share_fraction', '{}',
      '09400000-0000-0000-0000-000000000010')$$,
  '23514', 'statutory_allocation_basis_scope_mismatch',
  'cross-property unit basis is rejected'
);

select * from finish();
rollback;
