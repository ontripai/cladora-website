-- Test 075: Assisted bank matching, exception queue and independent approval
begin;
select plan(42);

select has_table('payments','reconciliation_match_runs','match run table exists');
select has_table('payments','reconciliation_exceptions','exception queue exists');
select ok((select relrowsecurity from pg_class where oid='payments.reconciliation_match_runs'::regclass),'match runs RLS enabled');
select ok((select relrowsecurity from pg_class where oid='payments.reconciliation_exceptions'::regclass),'exceptions RLS enabled');
select ok(to_regclass('payments.reconciliation_match_runs_queue_idx') is not null,'match run queue index exists');
select ok(to_regclass('payments.reconciliation_exceptions_queue_idx') is not null,'exception queue index exists');
select ok(to_regclass('payments.reconciliation_matches_proposal_key_uidx') is not null,'proposal idempotency index exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='reconciliation_matches' and column_name='match_run_id'),'match run provenance exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='reconciliation_matches' and column_name='proposed_by'),'proposer exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='reconciliation_matches' and column_name='reviewed_by'),'reviewer exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='reconciliation_matches' and column_name='reviewed_at'),'review timestamp exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='reconciliation_matches' and column_name='proposal_key'),'proposal key exists');
select has_function('customer_api','generate_bank_match_suggestions_v1','suggestion gateway exists');
select has_function('customer_api','get_bank_matching_work_queue_v1','queue gateway exists');
select has_function('customer_api','review_bank_match_suggestion_v1','review gateway exists');
select has_function('customer_api','propose_bank_exception_resolution_v1','exception resolution gateway exists');
select ok(not has_function_privilege('anon','customer_api.generate_bank_match_suggestions_v1(uuid,uuid,date,date,text)','execute'),'anon suggestion denied');
select ok(not has_function_privilege('anon','customer_api.get_bank_matching_work_queue_v1(uuid,uuid,text,integer,integer)','execute'),'anon queue denied');
select ok(not has_function_privilege('anon','customer_api.review_bank_match_suggestion_v1(uuid,uuid,text,text)','execute'),'anon review denied');
select ok(not has_function_privilege('anon','customer_api.propose_bank_exception_resolution_v1(uuid,uuid,uuid,uuid,numeric,text)','execute'),'anon exception proposal denied');
select ok(has_function_privilege('authenticated','customer_api.generate_bank_match_suggestions_v1(uuid,uuid,date,date,text)','execute'),'authenticated suggestion gateway granted');
select ok(has_function_privilege('authenticated','customer_api.get_bank_matching_work_queue_v1(uuid,uuid,text,integer,integer)','execute'),'authenticated queue gateway granted');
select ok(position('payments.reconcile' in pg_get_functiondef('app_private.bank_reconciliation_actor_v1(uuid,boolean)'::regprocedure))>0,'canonical permission enforced');
select ok(position('aal2' in pg_get_functiondef('app_private.bank_reconciliation_actor_v1(uuid,boolean)'::regprocedure))>0,'AAL2 contract enforced');
select ok(position('for update' in lower(pg_get_functiondef('app_private.generate_bank_match_suggestions_internal_v1(uuid,uuid,date,date,text)'::regprocedure)))>0,'suggestion generation serializes transaction rows');
select ok(position('idempotency_payload_mismatch' in pg_get_functiondef('app_private.generate_bank_match_suggestions_internal_v1(uuid,uuid,date,date,text)'::regprocedure))>0,'run idempotency mismatch fails closed');
select ok(position('dual_control_violation' in pg_get_functiondef('app_private.review_bank_match_suggestion_internal_v1(uuid,uuid,text,text)'::regprocedure))>0,'review dual control enforced');
select ok(position('for update' in lower(pg_get_functiondef('app_private.review_bank_match_suggestion_internal_v1(uuid,uuid,text,text)'::regprocedure)))>0,'review uses row lock');
select ok(position('exact_reference_amount_currency' in pg_get_functiondef('app_private.generate_bank_match_suggestions_internal_v1(uuid,uuid,date,date,text)'::regprocedure))>0,'conservative exact-match rule recorded');
select ok(position($q$status='suggested'$q$ in replace(pg_get_functiondef('app_private.get_bank_matching_work_queue_internal_v1(uuid,uuid,text,integer,integer)'::regprocedure),' ',''))>0,'queue returns suggestions only');
select ok(position($q$direction='credit'$q$ in replace(pg_get_functiondef('app_private.generate_bank_match_suggestions_internal_v1(uuid,uuid,date,date,text)'::regprocedure),' ',''))>0,'debit transactions excluded');
select ok(position($q$status='settled'$q$ in replace(pg_get_functiondef('app_private.generate_bank_match_suggestions_internal_v1(uuid,uuid,date,date,text)'::regprocedure),' ',''))>0,'only settled payments are candidates');
select ok(position($q$'status','suggested'$q$ in replace(pg_get_functiondef('payments.match_bank_transaction(uuid,uuid,uuid,uuid,numeric,text)'::regprocedure),' ',''))>0,'legacy manual match now creates a suggestion');
select ok(position('requires_independent_approval' in pg_get_functiondef('payments.match_bank_transaction(uuid,uuid,uuid,uuid,numeric,text)'::regprocedure))>0,'manual match cannot bypass independent approval');

do $$ declare v_permission uuid := (select id from identity.permissions where code='payments.reconcile'); begin
  insert into auth.users(id,email) values('75000000-0000-0000-0000-000000000001','bank-match-admin@cladora.test');
  insert into platform.tenants(id,legal_name,registration_number,status) values('75100000-0000-0000-0000-000000000001','Synthetic Assisted Match','RO-BANK-075','active');
  insert into portfolio.properties(id,tenant_id,type,name,base_currency,status) values('75200000-0000-0000-0000-000000000001','75100000-0000-0000-0000-000000000001','condominium','Synthetic Match Property','RON','active');
  insert into identity.roles(id,tenant_id,code,name) values('75300000-0000-0000-0000-000000000001','75100000-0000-0000-0000-000000000001','association_admin','Match Administrator');
  insert into identity.role_permissions(role_id,permission_id,effect) values('75300000-0000-0000-0000-000000000001',v_permission,'allow');
  insert into identity.memberships(id,tenant_id,user_id,role_id,status) values('75400000-0000-0000-0000-000000000001','75100000-0000-0000-0000-000000000001','75000000-0000-0000-0000-000000000001','75300000-0000-0000-0000-000000000001','active');
  insert into identity.context_grants(id,membership_id,tenant_id,scope_type,property_id) values('75500000-0000-0000-0000-000000000001','75400000-0000-0000-0000-000000000001','75100000-0000-0000-0000-000000000001','property','75200000-0000-0000-0000-000000000001');
  insert into payments.bank_accounts(id,tenant_id,property_id,iban_encrypted,iban_fingerprint,bank_name,currency,status) values('75600000-0000-0000-0000-000000000001','75100000-0000-0000-0000-000000000001','75200000-0000-0000-0000-000000000001','ciphertext','fingerprint-075','Synthetic Bank','RON','active');
  insert into payments.import_batches(id,tenant_id,bank_account_id,source,source_hash,status,period_start,period_end,imported_by) values('75700000-0000-0000-0000-000000000001','75100000-0000-0000-0000-000000000001','75600000-0000-0000-0000-000000000001','manual','source-075','committed','2026-09-01','2026-09-30','75000000-0000-0000-0000-000000000001');
  insert into payments.bank_transactions(id,tenant_id,batch_id,bank_account_id,external_ref,booked_on,direction,amount,currency,remittance_text,fingerprint,raw_snapshot)
  values('75800000-0000-0000-0000-000000000001','75100000-0000-0000-0000-000000000001','75700000-0000-0000-0000-000000000001','75600000-0000-0000-0000-000000000001','NO-MATCH-075','2026-09-10','credit',125,'RON','Unknown transfer','tx-fingerprint-075','{}');
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"75000000-0000-0000-0000-000000000001","aal":"aal1","active_tenant_id":"75100000-0000-0000-0000-000000000001"}',true);
select throws_ok($$select customer_api.generate_bank_match_suggestions_v1('75500000-0000-0000-0000-000000000001','75600000-0000-0000-0000-000000000001','2026-09-01','2026-09-30','match-run-075')$$,'42501','mfa_required','AAL1 suggestion run denied');
select set_config('request.jwt.claims','{"sub":"75000000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"75100000-0000-0000-0000-000000000001"}',true);
select ok((select set_config('test.match_run_id',j->>'run_id',true) is not null and (j->>'exception_count')::int=1 from (select customer_api.generate_bank_match_suggestions_v1('75500000-0000-0000-0000-000000000001','75600000-0000-0000-0000-000000000001','2026-09-01','2026-09-30','match-run-075') j)s),'unmatched credit creates one exception');
select ok((customer_api.generate_bank_match_suggestions_v1('75500000-0000-0000-0000-000000000001','75600000-0000-0000-0000-000000000001','2026-09-01','2026-09-30','match-run-075')->>'idempotent_replay')::boolean,'run retry is idempotent');
select throws_ok($$select customer_api.generate_bank_match_suggestions_v1('75500000-0000-0000-0000-000000000001','75600000-0000-0000-0000-000000000001','2026-09-02','2026-09-30','match-run-075')$$,'23505','idempotency_payload_mismatch','changed retry rejected');
select ok((customer_api.get_bank_matching_work_queue_v1('75500000-0000-0000-0000-000000000001','75600000-0000-0000-0000-000000000001',null,50,0)->>'total')::int=1,'queue returns exception');
reset role;
select ok((select exception_code='no_candidate' and status='open' from payments.reconciliation_exceptions where match_run_id=current_setting('test.match_run_id')::uuid),'no-candidate exception classified');
select ok((select count(*) from payments.reconciliation_matches where match_run_id=current_setting('test.match_run_id')::uuid)=0,'no false suggestion created');
select ok((select count(*) from finance.journals where tenant_id='75100000-0000-0000-0000-000000000001')=0,'assisted matching never posts ledger entries');

select * from finish();
rollback;
