-- =============================================================================
-- Test 076: Stage 3 integrated collections and reconciliation closure
begin;
select plan(25);

select ok(exists(select 1 from pg_trigger where tgrelid='payments.reconciliation_sessions'::regclass and tgname='guard_bank_reconciliation_finalization' and not tgisinternal),'session finalization trigger exists');
select ok(position('BEFORE INSERT OR UPDATE' in pg_get_triggerdef((select oid from pg_trigger where tgrelid='payments.reconciliation_sessions'::regclass and tgname='guard_bank_reconciliation_finalization'))) > 0,'guard covers insert and update entry points');
select ok(to_regclass('payments.reconciliation_sessions_reconciled_period_uidx') is not null,'one reconciled session per account period enforced');
select ok(position('for update' in lower(pg_get_functiondef('app_private.guard_bank_reconciliation_finalization_v1()'::regprocedure))) > 0,'in-period bank rows are locked');
select ok(position('reconciliation_difference_must_be_zero' in pg_get_functiondef('app_private.guard_bank_reconciliation_finalization_v1()'::regprocedure)) > 0,'zero-difference error remains deterministic');
select ok(position('customer_mfa_required' in pg_get_functiondef('payments.finalize_bank_reconciliation(uuid,uuid,date,date,numeric,text)'::regprocedure)) > 0,'canonical AAL2 policy remains enforced');
select ok(position('payments.reconcile' in pg_get_functiondef('payments.finalize_bank_reconciliation(uuid,uuid,date,date,numeric,text)'::regprocedure)) > 0,'canonical payments permission remains enforced');
select ok(position('direct către contul bancar al asociației' in pg_get_functiondef('customer_api.generate_bank_instruction_v1(uuid,uuid)'::regprocedure)) > 0,'direct-to-association non-custodial boundary remains intact');
select ok(position('committed_statement_import_immutable' in pg_get_functiondef('app_private.protect_committed_bank_import_internal_v1()'::regprocedure)) > 0,'committed bank imports remain immutable');
select ok(to_regclass('payments.bank_transactions_bank_fingerprint_idx') is not null or exists(select 1 from pg_indexes where schemaname='payments' and tablename='bank_transactions' and indexdef ilike '%unique%fingerprint%'),'committed bank rows remain deduplicated');
select ok(position('dual_control_violation' in pg_get_functiondef('app_private.review_bank_match_suggestion_internal_v1(uuid,uuid,text,text)'::regprocedure)) > 0,'proposal authors cannot approve their own matches');
select ok(position('aal2' in pg_get_functiondef('app_private.bank_reconciliation_actor_v1(uuid,boolean)'::regprocedure)) > 0,'independent reviews retain AAL2 enforcement');

do $$ declare v_permission uuid := (select id from identity.permissions where code='payments.reconcile'); begin
  insert into auth.users(id,email) values('76000000-0000-0000-0000-000000000001','bank-close-admin@cladora.test');
  insert into platform.tenants(id,legal_name,registration_number,status) values('76100000-0000-0000-0000-000000000001','Synthetic Bank Closure','RO-BANK-076','active');
  insert into portfolio.properties(id,tenant_id,type,name,base_currency,status) values('76200000-0000-0000-0000-000000000001','76100000-0000-0000-0000-000000000001','condominium','Synthetic Closure Property','RON','active');
  insert into identity.roles(id,tenant_id,code,name) values('76300000-0000-0000-0000-000000000001','76100000-0000-0000-0000-000000000001','association_admin','Closure Administrator');
  insert into identity.role_permissions(role_id,permission_id,effect) values('76300000-0000-0000-0000-000000000001',v_permission,'allow');
  insert into identity.memberships(id,tenant_id,user_id,role_id,status) values('76400000-0000-0000-0000-000000000001','76100000-0000-0000-0000-000000000001','76000000-0000-0000-0000-000000000001','76300000-0000-0000-0000-000000000001','active');
  insert into identity.context_grants(id,membership_id,tenant_id,scope_type,property_id) values('76500000-0000-0000-0000-000000000001','76400000-0000-0000-0000-000000000001','76100000-0000-0000-0000-000000000001','property','76200000-0000-0000-0000-000000000001');
  insert into payments.bank_accounts(id,tenant_id,property_id,iban_encrypted,iban_fingerprint,bank_name,currency,status) values('76600000-0000-0000-0000-000000000001','76100000-0000-0000-0000-000000000001','76200000-0000-0000-0000-000000000001','ciphertext','fingerprint-076','Synthetic Bank','RON','active');
  insert into payments.import_batches(id,tenant_id,bank_account_id,source,source_hash,status,period_start,period_end,imported_by) values('76700000-0000-0000-0000-000000000001','76100000-0000-0000-0000-000000000001','76600000-0000-0000-0000-000000000001','manual','source-076','committed','2026-09-01','2026-09-30','76000000-0000-0000-0000-000000000001');
  insert into payments.bank_transactions(id,tenant_id,batch_id,bank_account_id,external_ref,booked_on,direction,amount,currency,remittance_text,fingerprint,raw_snapshot)
  values
    ('76800000-0000-0000-0000-000000000001','76100000-0000-0000-0000-000000000001','76700000-0000-0000-0000-000000000001','76600000-0000-0000-0000-000000000001','CREDIT-076','2026-09-10','credit',100,'RON','Split settlement','tx-fingerprint-076','{}'),
    ('76800000-0000-0000-0000-000000000002','76100000-0000-0000-0000-000000000001','76700000-0000-0000-0000-000000000001','76600000-0000-0000-0000-000000000001','OVERALLOC-076','2026-10-10','credit',50,'RON','Over-allocation probe','tx-fingerprint-076-over','{}');
  insert into payments.payments(id,tenant_id,property_id,amount,currency,paid_at,status,provider_ref)
  values
    ('76900000-0000-0000-0000-000000000001','76100000-0000-0000-0000-000000000001','76200000-0000-0000-0000-000000000001',40,'RON','2026-09-10 10:00+00','settled','PAY-076-A'),
    ('76900000-0000-0000-0000-000000000002','76100000-0000-0000-0000-000000000001','76200000-0000-0000-0000-000000000001',60,'RON','2026-09-10 10:01+00','settled','PAY-076-B'),
    ('76900000-0000-0000-0000-000000000003','76100000-0000-0000-0000-000000000001','76200000-0000-0000-0000-000000000001',30,'RON','2026-10-10 10:00+00','settled','PAY-076-C'),
    ('76900000-0000-0000-0000-000000000004','76100000-0000-0000-0000-000000000001','76200000-0000-0000-0000-000000000001',30,'RON','2026-10-10 10:01+00','settled','PAY-076-D');
end $$;

insert into payments.reconciliation_matches(id,tenant_id,bank_transaction_id,payment_id,matched_amount,confidence,status,rationale_json,proposed_by,proposal_key)
values
  ('76a00000-0000-0000-0000-000000000010','76100000-0000-0000-0000-000000000001','76800000-0000-0000-0000-000000000002','76900000-0000-0000-0000-000000000003',30,1,'suggested','{}','76000000-0000-0000-0000-000000000001','stage3-over-a'),
  ('76a00000-0000-0000-0000-000000000011','76100000-0000-0000-0000-000000000001','76800000-0000-0000-0000-000000000002','76900000-0000-0000-0000-000000000004',30,1,'suggested','{}','76000000-0000-0000-0000-000000000001','stage3-over-b');
update payments.reconciliation_matches set status='confirmed',confirmed_by='76000000-0000-0000-0000-000000000001',confirmed_at=statement_timestamp() where id='76a00000-0000-0000-0000-000000000010';
select throws_ok($$update payments.reconciliation_matches set status='confirmed',confirmed_by='76000000-0000-0000-0000-000000000001',confirmed_at=statement_timestamp() where id='76a00000-0000-0000-0000-000000000011'$$,'P0001','bank_transaction_overallocated','split over-allocation is rejected');
select ok((select count(*)=1 and sum(matched_amount)=30 from payments.reconciliation_matches where bank_transaction_id='76800000-0000-0000-0000-000000000002' and status='confirmed'),'over-allocation rejection leaves zero partial writes');

select throws_ok($$insert into payments.reconciliation_sessions(tenant_id,bank_account_id,statement_date,period_start,period_end,closing_balance,status) values('76100000-0000-0000-0000-000000000001','76600000-0000-0000-0000-000000000001','2026-09-30','2026-09-01','2026-09-30',100,'reconciled')$$,'55000','reconciliation_unmatched_credit_remaining','unmatched credit blocks finalization');

insert into payments.reconciliation_matches(id,tenant_id,bank_transaction_id,payment_id,matched_amount,confidence,status,rationale_json,proposed_by,proposal_key)
values('76a00000-0000-0000-0000-000000000001','76100000-0000-0000-0000-000000000001','76800000-0000-0000-0000-000000000001','76900000-0000-0000-0000-000000000001',40,1,'suggested','{}','76000000-0000-0000-0000-000000000001','stage3-a');
select throws_ok($$insert into payments.reconciliation_sessions(tenant_id,bank_account_id,statement_date,period_start,period_end,closing_balance,status) values('76100000-0000-0000-0000-000000000001','76600000-0000-0000-0000-000000000001','2026-09-30','2026-09-01','2026-09-30',100,'reconciled')$$,'55000','reconciliation_match_approval_pending','pending suggestion blocks finalization');
update payments.reconciliation_matches set status='rejected' where id='76a00000-0000-0000-0000-000000000001';
delete from payments.reconciliation_matches where id='76a00000-0000-0000-0000-000000000001';

insert into payments.reconciliation_exceptions(id,tenant_id,bank_transaction_id,exception_code,status,candidate_snapshot)
values('76b00000-0000-0000-0000-000000000001','76100000-0000-0000-0000-000000000001','76800000-0000-0000-0000-000000000001','ambiguous_candidate','open','[]');
select throws_ok($$insert into payments.reconciliation_sessions(tenant_id,bank_account_id,statement_date,period_start,period_end,closing_balance,status) values('76100000-0000-0000-0000-000000000001','76600000-0000-0000-0000-000000000001','2026-09-30','2026-09-01','2026-09-30',100,'reconciled')$$,'55000','reconciliation_exception_unresolved','ambiguous credit remains in the exception queue');
update payments.reconciliation_exceptions set status='resolved' where id='76b00000-0000-0000-0000-000000000001';

insert into payments.reconciliation_matches(id,tenant_id,bank_transaction_id,payment_id,matched_amount,confidence,status,rationale_json,confirmed_by,confirmed_at,proposed_by,reviewed_by,reviewed_at,proposal_key)
values
 ('76a00000-0000-0000-0000-000000000002','76100000-0000-0000-0000-000000000001','76800000-0000-0000-0000-000000000001','76900000-0000-0000-0000-000000000001',40,1,'confirmed','{}','76000000-0000-0000-0000-000000000001',statement_timestamp(),null,'76000000-0000-0000-0000-000000000001',statement_timestamp(),'stage3-b'),
 ('76a00000-0000-0000-0000-000000000003','76100000-0000-0000-0000-000000000001','76800000-0000-0000-0000-000000000001','76900000-0000-0000-0000-000000000002',60,1,'confirmed','{}','76000000-0000-0000-0000-000000000001',statement_timestamp(),null,'76000000-0000-0000-0000-000000000001',statement_timestamp(),'stage3-c');
select ok((select sum(matched_amount)=100 from payments.reconciliation_matches where bank_transaction_id='76800000-0000-0000-0000-000000000001' and status='confirmed'),'independently confirmed split matches fully cover the credit');
select throws_ok($$insert into payments.reconciliation_sessions(tenant_id,bank_account_id,statement_date,period_start,period_end,closing_balance,status) values('76100000-0000-0000-0000-000000000001','76600000-0000-0000-0000-000000000001','2026-09-30','2026-09-01','2026-09-30',99,'reconciled')$$,'22023','reconciliation_difference_must_be_zero','closing balance mismatch remains blocked');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"76000000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"76100000-0000-0000-0000-000000000001"}',true);
select ok((payments.finalize_bank_reconciliation('76500000-0000-0000-0000-000000000001','76600000-0000-0000-0000-000000000001','2026-09-01','2026-09-30',100,'Stage 3 closure')->>'status')='reconciled','fully matched credits permit zero-difference finalization');
reset role;

select ok((select count(*)=1 and min(difference)=0 from payments.reconciliation_sessions where tenant_id='76100000-0000-0000-0000-000000000001'),'exactly one zero-difference session is persisted');
select throws_ok($$insert into payments.reconciliation_sessions(tenant_id,bank_account_id,statement_date,period_start,period_end,closing_balance,status) values('76100000-0000-0000-0000-000000000001','76600000-0000-0000-0000-000000000001','2026-09-30','2026-09-01','2026-09-30',100,'reconciled')$$,'23505',null,'retry cannot duplicate the reconciled session');
select ok((select count(*)=1 from audit.events where tenant_id='76100000-0000-0000-0000-000000000001' and action='BANK_STATEMENT_RECONCILED'),'finalization emits exactly one audit event');
select ok((select count(*)=0 from finance.journals where tenant_id='76100000-0000-0000-0000-000000000001'),'statement import and matching emit no journal');
select ok((select count(*)=0 from finance.journal_entries je join finance.journals j on j.id=je.journal_id where j.tenant_id='76100000-0000-0000-0000-000000000001'),'GL and subledger remain unchanged through reconciliation');

select * from finish();
rollback;
