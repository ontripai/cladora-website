-- R10 Phase 2A: Law 196/2018 Art. 72(5) working-capital conveyances
begin;
select plan(35);

-- Structural and least-privilege contract.
select has_table(
  'finance', 'statutory_working_capital_conveyances',
  'working-capital conveyance register exists'
);
select has_function(
  'app_private', 'create_working_capital_conveyance_v1',
  array['uuid', 'uuid', 'uuid', 'uuid', 'date', 'finance.statutory_conveyance_disposition', 'text', 'jsonb', 'uuid', 'text', 'text'],
  'controlled conveyance creation function exists'
);
select has_function(
  'app_private', 'finalize_working_capital_conveyance_v1',
  array['uuid', 'integer', 'uuid', 'text', 'uuid', 'text'],
  'controlled conveyance finalization function exists'
);
select ok(
  (select relrowsecurity
     from pg_class
    where oid = 'finance.statutory_working_capital_conveyances'::regclass),
  'conveyance register has RLS enabled'
);
select ok(
  not has_table_privilege(
    'anon', 'finance.statutory_working_capital_conveyances',
    'SELECT,INSERT,UPDATE,DELETE'
  )
  and not has_table_privilege(
    'authenticated', 'finance.statutory_working_capital_conveyances',
    'SELECT,INSERT,UPDATE,DELETE'
  )
  and not has_function_privilege(
    'anon',
    'app_private.finalize_working_capital_conveyance_v1(uuid,integer,uuid,text,uuid,text)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'authenticated',
    'app_private.finalize_working_capital_conveyance_v1(uuid,integer,uuid,text,uuid,text)',
    'EXECUTE'
  ),
  'conveyance data and finalization expose no anon or authenticated access'
);

-- Isolated 096 fixture.
insert into auth.users (id, email) values
  ('09600000-0000-0000-0000-000000000001', 'r10-phase2a-conveyance@test.local');

insert into platform.tenants (id, legal_name, registration_number, status) values
  ('09600000-0000-0000-0000-000000000010', 'R10 Phase 2A Conveyance Tenant', 'RO-R10-096', 'active');

insert into platform.customer_workspaces (
  id, tenant_id, workspace_type, lifecycle_status, commercial_owner, environment
) values (
  '09600000-0000-0000-0000-000000000020',
  '09600000-0000-0000-0000-000000000010',
  'ASSOCIATION', 'ACTIVE', 'R10 Test', 'PILOT'
);

insert into portfolio.properties (id, tenant_id, type, name, status) values (
  '09600000-0000-0000-0000-000000000030',
  '09600000-0000-0000-0000-000000000010',
  'condominium', 'R10 Art 72 Property', 'active'
);
insert into portfolio.buildings (id, tenant_id, property_id, code, name, status) values (
  '09600000-0000-0000-0000-000000000040',
  '09600000-0000-0000-0000-000000000010',
  '09600000-0000-0000-0000-000000000030',
  'B096', 'R10 Art 72 Building', 'active'
);
insert into portfolio.units (id, tenant_id, building_id, code, status) values
  ('09600000-0000-0000-0000-000000000041', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000040', 'U-REFUND', 'active'),
  ('09600000-0000-0000-0000-000000000042', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000040', 'U-DEED', 'active'),
  ('09600000-0000-0000-0000-000000000043', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000040', 'U-REVIEW', 'active');

insert into portfolio.parties (id, tenant_id, type, legal_name) values
  ('09600000-0000-0000-0000-000000000051', '09600000-0000-0000-0000-000000000010', 'person', 'Refund Transferor'),
  ('09600000-0000-0000-0000-000000000052', '09600000-0000-0000-0000-000000000010', 'person', 'Refund Acquirer'),
  ('09600000-0000-0000-0000-000000000053', '09600000-0000-0000-0000-000000000010', 'person', 'Deed Transferor'),
  ('09600000-0000-0000-0000-000000000054', '09600000-0000-0000-0000-000000000010', 'person', 'Deed Acquirer'),
  ('09600000-0000-0000-0000-000000000055', '09600000-0000-0000-0000-000000000010', 'person', 'Review Transferor'),
  ('09600000-0000-0000-0000-000000000056', '09600000-0000-0000-0000-000000000010', 'person', 'Review Acquirer');

-- Both records cover the legal transfer date, which is the precise hand-off
-- instant evaluated by the conveyance RPC. The RPC never mutates ownership.
insert into portfolio.ownerships (
  id, tenant_id, unit_id, party_id, share, valid_from, valid_to
) values
  ('09600000-0000-0000-0000-000000000061', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000041', '09600000-0000-0000-0000-000000000051', 1, date '2026-01-01', date '2026-09-20'),
  ('09600000-0000-0000-0000-000000000062', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000041', '09600000-0000-0000-0000-000000000052', 1, date '2026-09-20', null),
  ('09600000-0000-0000-0000-000000000063', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000042', '09600000-0000-0000-0000-000000000053', 1, date '2026-01-01', date '2026-09-20'),
  ('09600000-0000-0000-0000-000000000064', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000042', '09600000-0000-0000-0000-000000000054', 1, date '2026-09-20', null),
  ('09600000-0000-0000-0000-000000000065', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000043', '09600000-0000-0000-0000-000000000055', 1, date '2026-01-01', date '2026-09-20'),
  ('09600000-0000-0000-0000-000000000066', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000043', '09600000-0000-0000-0000-000000000056', 1, date '2026-09-20', null);

insert into governance.meetings (
  id, tenant_id, property_id, title, meeting_type, scheduled_at, status,
  quorum_rule, created_by
) values (
  '09600000-0000-0000-0000-000000000070',
  '09600000-0000-0000-0000-000000000010',
  '09600000-0000-0000-0000-000000000030',
  'R10 Art 72 AGM', 'annual', statement_timestamp(), 'closed',
  '{"minimum_weight":0.5}', '09600000-0000-0000-0000-000000000001'
);
insert into governance.agenda_items (
  id, tenant_id, meeting_id, sequence_no, title, decision_required
) values (
  '09600000-0000-0000-0000-000000000071',
  '09600000-0000-0000-0000-000000000010',
  '09600000-0000-0000-0000-000000000070',
  1, 'Approve working-capital fund', true
);
insert into governance.resolutions (
  id, tenant_id, meeting_id, agenda_item_id, resolution_no, title,
  text_body, adopted, result_snapshot, effective_on
) values (
  '09600000-0000-0000-0000-000000000072',
  '09600000-0000-0000-0000-000000000010',
  '09600000-0000-0000-0000-000000000070',
  '09600000-0000-0000-0000-000000000071',
  '096/2026', 'Working-capital fund', 'Approved under Law 196/2018 Art. 72',
  true, '{"approved":true}', date '2026-01-01'
);

insert into finance.statutory_accounting_regimes (
  id, tenant_id, customer_workspace_id, property_id, status,
  statutory_operations_enabled, accounting_signoff_reference,
  accounting_signed_at, legal_signoff_reference, legal_signed_at, activated_at
) values (
  '09600000-0000-0000-0000-000000000080',
  '09600000-0000-0000-0000-000000000010',
  '09600000-0000-0000-0000-000000000020',
  '09600000-0000-0000-0000-000000000030',
  'active', true, 'CECCAR-096', statement_timestamp(),
  'LEGAL-096', statement_timestamp(), statement_timestamp()
);
insert into finance.accounting_periods (
  id, tenant_id, property_id, starts_on, ends_on
) values (
  '09600000-0000-0000-0000-000000000081',
  '09600000-0000-0000-0000-000000000010',
  '09600000-0000-0000-0000-000000000030',
  date '2026-09-01', date '2026-09-30'
);
insert into finance.statutory_monthly_cycles (
  id, regime_id, tenant_id, property_id, accounting_period_id, status
) values (
  '09600000-0000-0000-0000-000000000082',
  '09600000-0000-0000-0000-000000000080',
  '09600000-0000-0000-0000-000000000010',
  '09600000-0000-0000-0000-000000000030',
  '09600000-0000-0000-0000-000000000081', 'collecting'
);

insert into finance.statutory_funds (
  id, regime_id, tenant_id, property_id, kind, code, name_ro,
  adopted_resolution_id, statutory_basis, purpose_policy, policy_hash,
  status, valid_from, lock_version, idempotency_key, payload_hash,
  created_by, activated_by, activated_at
) values (
  '09600000-0000-0000-0000-000000000090',
  '09600000-0000-0000-0000-000000000080',
  '09600000-0000-0000-0000-000000000010',
  '09600000-0000-0000-0000-000000000030',
  'working_capital', 'WORKING-096', 'Fond de rulment 096',
  '09600000-0000-0000-0000-000000000072',
  '{"law":"Legea 196/2018","article":"72(5)"}',
  '{"default":"refund_transferor","deed_exception":true}', repeat('a', 64),
  'active', date '2026-01-01', 2, 'fund-096', repeat('b', 64),
  '09600000-0000-0000-0000-000000000001',
  '09600000-0000-0000-0000-000000000001', statement_timestamp()
);

insert into finance.statutory_simple_entries (
  id, cycle_id, tenant_id, property_id, entry_date, direction,
  payment_medium, document_type, document_number, amount, description, created_by
) values
  ('09600000-0000-0000-0000-000000000101', '09600000-0000-0000-0000-000000000082', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000030', date '2026-09-01', 'receipt', 'bank', 'EXTRAS_CONT', '096-IN-100', 100.00, 'Working-capital contribution for refund unit', '09600000-0000-0000-0000-000000000001'),
  ('09600000-0000-0000-0000-000000000102', '09600000-0000-0000-0000-000000000082', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000030', date '2026-09-01', 'receipt', 'bank', 'EXTRAS_CONT', '096-IN-080', 80.00, 'Working-capital contribution for deed unit', '09600000-0000-0000-0000-000000000001'),
  ('09600000-0000-0000-0000-000000000103', '09600000-0000-0000-0000-000000000082', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000030', date '2026-09-20', 'payment', 'bank', 'DISPOZITIE_PLATA', '096-OUT-100', 100.00, 'Art. 72(5) refund to transferor', '09600000-0000-0000-0000-000000000001');

insert into finance.statutory_fund_movements (
  id, fund_id, cycle_id, tenant_id, property_id, statutory_simple_entry_id,
  delta, cash_effect, movement_kind, amount, unit_id, party_id,
  named_receipt_reference, supporting_document_reference, source_snapshot,
  source_hash, idempotency_key, payload_hash, created_by
) values
  ('09600000-0000-0000-0000-000000000111', '09600000-0000-0000-0000-000000000090', '09600000-0000-0000-0000-000000000082', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000030', '09600000-0000-0000-0000-000000000101', 'increase', 'receipt', 'owner_contribution', 100.00, '09600000-0000-0000-0000-000000000041', '09600000-0000-0000-0000-000000000051', 'CHITANTA-096-100', 'Initial working-capital receipt', '{"fixture":"096-refund"}', repeat('c', 64), 'movement-096-100', repeat('d', 64), '09600000-0000-0000-0000-000000000001'),
  ('09600000-0000-0000-0000-000000000112', '09600000-0000-0000-0000-000000000090', '09600000-0000-0000-0000-000000000082', '09600000-0000-0000-0000-000000000010', '09600000-0000-0000-0000-000000000030', '09600000-0000-0000-0000-000000000102', 'increase', 'receipt', 'owner_contribution', 80.00, '09600000-0000-0000-0000-000000000042', '09600000-0000-0000-0000-000000000053', 'CHITANTA-096-080', 'Initial working-capital receipt', '{"fixture":"096-deed"}', repeat('e', 64), 'movement-096-080', repeat('f', 64), '09600000-0000-0000-0000-000000000001');

select ok(
  finance.statutory_owner_fund_position_v1(
    '09600000-0000-0000-0000-000000000090',
    '09600000-0000-0000-0000-000000000041',
    '09600000-0000-0000-0000-000000000051'
  ) = 100.00::numeric,
  'refund transferor begins with the evidenced 100 RON position'
);
select ok(
  finance.statutory_fund_balance_v1('09600000-0000-0000-0000-000000000090') = 180.00::numeric,
  'working-capital balance is derived from append-only movements'
);

-- Ambiguous deed evidence must remain fail-closed for legal review.
select lives_ok(
  $$select app_private.create_working_capital_conveyance_v1(
      '09600000-0000-0000-0000-000000000090',
      '09600000-0000-0000-0000-000000000043',
      '09600000-0000-0000-0000-000000000065',
      '09600000-0000-0000-0000-000000000066',
      date '2026-09-20', 'legal_review_required', null,
      '{"classification":"ambiguous","document":"deed-096-review"}',
      '09600000-0000-0000-0000-000000000001',
      'conveyance-096-review', repeat('1', 64)
    )$$,
  'ambiguous deed evidence is quarantined as legal-review-required'
);
select ok(
  (select disposition = 'legal_review_required'
          and frozen_owner_balance = 0.00
     from finance.statutory_working_capital_conveyances
    where idempotency_key = 'conveyance-096-review'),
  'legal-review conveyance freezes the decision and owner position'
);
select throws_ok(
  $$select app_private.finalize_working_capital_conveyance_v1(
      (select id from finance.statutory_working_capital_conveyances
        where idempotency_key = 'conveyance-096-review'),
      1, null, 'LEGAL-096-REVIEW',
      '09600000-0000-0000-0000-000000000001', 'attempt ambiguous finalization'
    )$$,
  '42501', 'working_capital_conveyance_legal_review_required',
  'legal-review-required conveyance cannot be finalized'
);
select ok(
  (select status = 'draft' and lock_version = 1
     from finance.statutory_working_capital_conveyances
    where idempotency_key = 'conveyance-096-review'),
  'failed legal-review finalization leaves the conveyance unchanged'
);

-- Default Art. 72(5) result: cash refund to the transferor.
select lives_ok(
  $$select app_private.create_working_capital_conveyance_v1(
      '09600000-0000-0000-0000-000000000090',
      '09600000-0000-0000-0000-000000000041',
      '09600000-0000-0000-0000-000000000061',
      '09600000-0000-0000-0000-000000000062',
      date '2026-09-20', 'refund_transferor', null,
      '{"classification":"default_refund","document":"deed-096-refund"}',
      '09600000-0000-0000-0000-000000000001',
      'conveyance-096-refund', repeat('2', 64)
    )$$,
  'default transferor-refund conveyance is created'
);
select ok(
  (select id from app_private.create_working_capital_conveyance_v1(
    '09600000-0000-0000-0000-000000000090',
    '09600000-0000-0000-0000-000000000041',
    '09600000-0000-0000-0000-000000000061',
    '09600000-0000-0000-0000-000000000062',
    date '2026-09-20', 'refund_transferor', null,
    '{"classification":"default_refund","document":"deed-096-refund"}',
    '09600000-0000-0000-0000-000000000001',
    'conveyance-096-refund', repeat('2', 64)
  )) = (select id from finance.statutory_working_capital_conveyances
    where idempotency_key = 'conveyance-096-refund'),
  'exact idempotency replay returns the original conveyance'
);
select throws_ok(
  $$select app_private.create_working_capital_conveyance_v1(
      '09600000-0000-0000-0000-000000000090',
      '09600000-0000-0000-0000-000000000041',
      '09600000-0000-0000-0000-000000000061',
      '09600000-0000-0000-0000-000000000062',
      date '2026-09-20', 'refund_transferor', null,
      '{"classification":"changed"}',
      '09600000-0000-0000-0000-000000000001',
      'conveyance-096-refund', repeat('3', 64)
    )$$,
  '23505', 'working_capital_conveyance_idempotency_conflict',
  'idempotency-key reuse with a different payload hash is rejected'
);
select throws_ok(
  $$select app_private.finalize_working_capital_conveyance_v1(
      (select id from finance.statutory_working_capital_conveyances
        where idempotency_key = 'conveyance-096-refund'),
      1, null, 'LEGAL-096-REFUND',
      '09600000-0000-0000-0000-000000000001', 'refund without payment entry'
    )$$,
  '23514', 'working_capital_refund_entry_required',
  'cash refund cannot finalize without its statutory payment entry'
);
select lives_ok(
  $$select app_private.finalize_working_capital_conveyance_v1(
      (select id from finance.statutory_working_capital_conveyances
        where idempotency_key = 'conveyance-096-refund'),
      1, '09600000-0000-0000-0000-000000000103', 'LEGAL-096-REFUND',
      '09600000-0000-0000-0000-000000000001', 'Art. 72(5) transferor refund'
    )$$,
  'transferor refund finalizes against the exact statutory payment entry'
);
select ok(
  (select status = 'finalized' and lock_version = 2
          and refund_simple_entry_id = '09600000-0000-0000-0000-000000000103'
          and legal_review_reference = 'LEGAL-096-REFUND'
     from finance.statutory_working_capital_conveyances
    where idempotency_key = 'conveyance-096-refund'),
  'refund finalization persists sign-off, payment evidence, and lock advance'
);
select ok(
  exists(
    select 1 from finance.statutory_fund_movements m
    join finance.statutory_working_capital_conveyances c
      on c.idempotency_key = 'conveyance-096-refund'
    where m.fund_id = c.fund_id
      and m.movement_kind = 'refund' and m.delta = 'decrease'
      and m.cash_effect = 'payment' and m.amount = c.frozen_owner_balance
      and m.statutory_simple_entry_id = '09600000-0000-0000-0000-000000000103'
      and m.unit_id = c.unit_id and m.party_id = c.outgoing_party_id
  ),
  'refund creates one evidenced cash-decrease movement for the transferor'
);
select ok(
  finance.statutory_owner_fund_position_v1(
    '09600000-0000-0000-0000-000000000090',
    '09600000-0000-0000-0000-000000000041',
    '09600000-0000-0000-0000-000000000051'
  ) = 0.00::numeric,
  'refund clears the transferor working-capital position'
);
select ok(
  finance.statutory_fund_balance_v1('09600000-0000-0000-0000-000000000090') = 80.00::numeric,
  'cash refund decreases the derived working-capital balance by 100 RON'
);
select ok(
  exists(
    select 1 from audit.events e
    join finance.statutory_working_capital_conveyances c on c.id = e.entity_id
    where c.idempotency_key = 'conveyance-096-refund'
      and e.action = 'statutory.working_capital.conveyance.finalized'
      and e.after_snapshot @> '{"disposition":"refund_transferor","amount":100.00}'::jsonb
  ),
  'refund finalization emits its immutable audit evidence'
);
select throws_ok(
  $$select app_private.finalize_working_capital_conveyance_v1(
      (select id from finance.statutory_working_capital_conveyances
        where idempotency_key = 'conveyance-096-refund'),
      1, '09600000-0000-0000-0000-000000000103', 'LEGAL-096-REFUND',
      '09600000-0000-0000-0000-000000000001', 'stale finalization'
    )$$,
  '40001', 'working_capital_conveyance_lock_version_conflict',
  'stale conveyance finalization is rejected'
);

-- Express deed exception: retain and transfer the position without cash.
select lives_ok(
  $$select app_private.create_working_capital_conveyance_v1(
      '09600000-0000-0000-0000-000000000090',
      '09600000-0000-0000-0000-000000000042',
      '09600000-0000-0000-0000-000000000063',
      '09600000-0000-0000-0000-000000000064',
      date '2026-09-20', 'transfer_to_acquirer_by_deed', 'DEED-096-RETENTION',
      '{"clause":"working-capital retained by acquirer","document":"deed-096-retention"}',
      '09600000-0000-0000-0000-000000000001',
      'conveyance-096-deed', repeat('4', 64)
    )$$,
  'express deed-retention exception is created with documentary reference'
);
select ok(
  (select frozen_owner_balance
     from finance.statutory_working_capital_conveyances
    where idempotency_key = 'conveyance-096-deed') = 80.00::numeric,
  'deed-retention conveyance freezes the evidenced transferor position'
);
select lives_ok(
  $$select app_private.finalize_working_capital_conveyance_v1(
      (select id from finance.statutory_working_capital_conveyances
        where idempotency_key = 'conveyance-096-deed'),
      1, null, 'LEGAL-096-DEED',
      '09600000-0000-0000-0000-000000000001', 'express deed retention'
    )$$,
  'legally signed deed retention finalizes without a cash entry'
);
select ok(
  (select count(*)
     from finance.statutory_fund_movements m
     join finance.statutory_working_capital_conveyances c on c.id = m.conveyance_id
    where c.idempotency_key = 'conveyance-096-deed') = 2,
  'deed retention creates exactly two append-only transfer legs'
);
select ok(
  exists(
    select 1
      from finance.statutory_fund_movements out_leg
      join finance.statutory_fund_movements in_leg
        on in_leg.conveyance_id = out_leg.conveyance_id
       and in_leg.movement_kind = 'ownership_transfer_in'
     where out_leg.conveyance_id = (
       select id from finance.statutory_working_capital_conveyances
        where idempotency_key = 'conveyance-096-deed'
     )
       and out_leg.movement_kind = 'ownership_transfer_out'
       and out_leg.delta = 'decrease' and in_leg.delta = 'increase'
       and out_leg.amount = 80.00 and in_leg.amount = 80.00
  ),
  'deed retention records equal decrease and increase legs'
);
select ok(
  not exists(
    select 1 from finance.statutory_fund_movements m
    join finance.statutory_working_capital_conveyances c on c.id = m.conveyance_id
    where c.idempotency_key = 'conveyance-096-deed'
      and (m.cash_effect <> 'none' or m.statutory_simple_entry_id is not null)
  ),
  'deed-retention legs are non-cash and do not fabricate simple entries'
);
select ok(
  finance.statutory_fund_balance_v1('09600000-0000-0000-0000-000000000090') = 80.00::numeric,
  'paired deed-retention legs are net-zero for the fund balance'
);
select ok(
  finance.statutory_owner_fund_position_v1(
    '09600000-0000-0000-0000-000000000090',
    '09600000-0000-0000-0000-000000000042',
    '09600000-0000-0000-0000-000000000053'
  ) = 0.00
  and finance.statutory_owner_fund_position_v1(
    '09600000-0000-0000-0000-000000000090',
    '09600000-0000-0000-0000-000000000042',
    '09600000-0000-0000-0000-000000000054'
  ) = 80.00,
  'deed retention transfers the position from seller to acquirer exactly once'
);
select ok(
  (select valid_from = date '2026-01-01' and valid_to = date '2026-09-20'
     from portfolio.ownerships where id = '09600000-0000-0000-0000-000000000063')
  and
  (select valid_from = date '2026-09-20' and valid_to is null
     from portfolio.ownerships where id = '09600000-0000-0000-0000-000000000064'),
  'conveyance processing does not mutate authoritative ownership records'
);

-- Financial evidence and finalized decisions are immutable.
select throws_ok(
  $$update finance.statutory_fund_movements
       set amount = 81.00
     where conveyance_id = (
       select id from finance.statutory_working_capital_conveyances
        where idempotency_key = 'conveyance-096-deed'
     )$$,
  '55000', 'statutory_fund_record_is_append_only',
  'conveyance movement evidence cannot be updated'
);
select throws_ok(
  $$delete from finance.statutory_fund_movements
     where conveyance_id = (
       select id from finance.statutory_working_capital_conveyances
        where idempotency_key = 'conveyance-096-deed'
     )$$,
  '55000', 'statutory_fund_record_is_append_only',
  'conveyance movement evidence cannot be deleted'
);
select throws_ok(
  $$update finance.statutory_working_capital_conveyances
       set legal_review_reference = 'ALTERED'
     where idempotency_key = 'conveyance-096-deed'$$,
  '55000', null,
  'a finalized conveyance cannot be updated directly'
);
select throws_ok(
  $$delete from finance.statutory_working_capital_conveyances
     where idempotency_key = 'conveyance-096-deed'$$,
  '55000', null,
  'a finalized conveyance cannot be deleted directly'
);

select * from finish();
rollback;
