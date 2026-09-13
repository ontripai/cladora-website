-- Test 074: Controlled bank statement import and reconciliation contract
begin;
select plan(42);
select has_table('payments','bank_transaction_staging','staging table exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='import_batches' and column_name='idempotency_key'),'idempotency key exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='import_batches' and column_name='statement_format'),'statement format exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='import_batches' and column_name='status'),'import lifecycle exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='import_batches' and column_name='opening_balance'),'opening balance exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='import_batches' and column_name='closing_balance'),'closing balance exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='import_batches' and column_name='validation_errors'),'validation evidence exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='bank_transaction_staging' and column_name='fingerprint'),'row fingerprint exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='bank_transaction_staging' and column_name='raw_snapshot'),'raw snapshot exists');
select ok(exists(select 1 from information_schema.columns where table_schema='payments' and table_name='bank_transaction_staging' and column_name='validation_status'),'row status exists');
select ok((select relrowsecurity from pg_class where oid='payments.bank_transaction_staging'::regclass),'staging RLS enabled');
select ok(to_regclass('payments.bank_transaction_staging_tenant_idx') is not null,'tenant FK index exists');
select ok(to_regclass('payments.bank_transaction_staging_batch_idx') is not null,'batch FK index exists');
select has_function('customer_api','create_bank_statement_import_v1','create gateway exists');
select has_function('customer_api','stage_bank_statement_rows_v1','stage gateway exists');
select has_function('customer_api','validate_bank_statement_import_v1','validate gateway exists');
select has_function('customer_api','commit_bank_statement_import_v1','commit gateway exists');
select has_function('customer_api','get_bank_statement_import_v1','read gateway exists');
select ok(not has_function_privilege('anon','customer_api.create_bank_statement_import_v1(uuid,uuid,text,text,text,text,date,date,numeric,numeric,text)','execute'),'anon create denied');
select ok(not has_function_privilege('anon','customer_api.stage_bank_statement_rows_v1(uuid,uuid,jsonb)','execute'),'anon stage denied');
select ok(not has_function_privilege('anon','customer_api.validate_bank_statement_import_v1(uuid,uuid)','execute'),'anon validate denied');
select ok(not has_function_privilege('anon','customer_api.commit_bank_statement_import_v1(uuid,uuid)','execute'),'anon commit denied');
select ok(not has_function_privilege('anon','customer_api.get_bank_statement_import_v1(uuid,uuid,integer,integer)','execute'),'anon read denied');
select ok(position('payments.reconcile' in pg_get_functiondef('app_private.create_bank_statement_import_internal_v1(uuid,uuid,text,text,text,text,date,date,numeric,numeric,text)'::regprocedure))>0,'explicit reconcile permission');
select ok(position('true' in pg_get_functiondef('app_private.create_bank_statement_import_internal_v1(uuid,uuid,text,text,text,text,date,date,numeric,numeric,text)'::regprocedure))>0,'AAL2 required');
select ok(position('on conflict' in lower(pg_get_functiondef('app_private.commit_bank_statement_import_internal_v1(uuid,uuid)'::regprocedure)))>0,'commit deduplicates');
select ok(position('for update' in lower(pg_get_functiondef('app_private.commit_bank_statement_import_internal_v1(uuid,uuid)'::regprocedure)))>0,'commit serializes');
select ok(exists(select 1 from pg_trigger where tgrelid='payments.import_batches'::regclass and tgname='protect_committed_bank_import' and not tgisinternal),'committed import immutable trigger exists');
select ok(position('unmasked_counterparty_iban_rejected' in pg_get_functiondef('app_private.stage_bank_statement_rows_internal_v1(uuid,uuid,jsonb)'::regprocedure))>0,'unmasked counterparty IBAN rejected');
select ok(position('jsonb_strip_nulls' in pg_get_functiondef('app_private.stage_bank_statement_rows_internal_v1(uuid,uuid,jsonb)'::regprocedure))>0,'raw snapshot is allowlisted and minimized');

do $$ declare v_permission uuid := (select id from identity.permissions where code='payments.reconcile'); begin
  insert into auth.users(id,email) values('74000000-0000-0000-0000-000000000001','bank-import-admin@cladora.test');
  insert into platform.tenants(id,legal_name,registration_number,status)
  values('74100000-0000-0000-0000-000000000001','Synthetic Bank Import','RO-BANK-074','active');
  insert into portfolio.properties(id,tenant_id,type,name,base_currency,status)
  values('74200000-0000-0000-0000-000000000001','74100000-0000-0000-0000-000000000001','condominium','Synthetic Bank Property','RON','active');
  insert into identity.roles(id,tenant_id,code,name)
  values('74300000-0000-0000-0000-000000000001','74100000-0000-0000-0000-000000000001','association_admin','Bank Import Administrator');
  insert into identity.role_permissions(role_id,permission_id,effect) values('74300000-0000-0000-0000-000000000001',v_permission,'allow');
  insert into identity.memberships(id,tenant_id,user_id,role_id,status)
  values('74400000-0000-0000-0000-000000000001','74100000-0000-0000-0000-000000000001','74000000-0000-0000-0000-000000000001','74300000-0000-0000-0000-000000000001','active');
  insert into identity.context_grants(id,membership_id,tenant_id,scope_type,property_id)
  values('74500000-0000-0000-0000-000000000001','74400000-0000-0000-0000-000000000001','74100000-0000-0000-0000-000000000001','property','74200000-0000-0000-0000-000000000001');
  insert into payments.bank_accounts(id,tenant_id,property_id,iban_encrypted,iban_fingerprint,bank_name,currency,status)
  values('74600000-0000-0000-0000-000000000001','74100000-0000-0000-0000-000000000001','74200000-0000-0000-0000-000000000001','test-ciphertext','test-fingerprint-074','Synthetic Bank','RON','active');
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"74000000-0000-0000-0000-000000000001","aal":"aal1","active_tenant_id":"74100000-0000-0000-0000-000000000001"}',true);
select throws_ok($$select customer_api.create_bank_statement_import_v1('74500000-0000-0000-0000-000000000001','74600000-0000-0000-0000-000000000001','manual','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','statement.json','json','2026-09-01','2026-09-30',0,100,'bank-import-074')$$,'42501','mfa_required','AAL1 import creation denied');
select set_config('request.jwt.claims','{"sub":"74000000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"74100000-0000-0000-0000-000000000001"}',true);
select ok((select set_config('test.bank_batch_id',j->>'id',true) is not null and j->>'status'='draft' from (select customer_api.create_bank_statement_import_v1('74500000-0000-0000-0000-000000000001','74600000-0000-0000-0000-000000000001','manual','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','statement.json','json','2026-09-01','2026-09-30',0,100,'bank-import-074') j)s),'AAL2 creates draft import');
select ok((customer_api.create_bank_statement_import_v1('74500000-0000-0000-0000-000000000001','74600000-0000-0000-0000-000000000001','manual','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','statement.json','json','2026-09-01','2026-09-30',0,100,'bank-import-074')->>'idempotent')::boolean,'same request is idempotent');
select throws_ok($$select customer_api.create_bank_statement_import_v1('74500000-0000-0000-0000-000000000001','74600000-0000-0000-0000-000000000001','manual','bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','statement.json','json','2026-09-01','2026-09-30',0,100,'bank-import-074')$$,'23505','idempotency_payload_mismatch','idempotency mismatch rejected');
select throws_ok(format($q$select customer_api.stage_bank_statement_rows_v1('74500000-0000-0000-0000-000000000001','%s','[{"booked_on":"2026-09-10","direction":"credit","amount":"100","currency":"RON","counterparty_iban_masked":"RO49AAAA1B31007593840000"}]')$q$,current_setting('test.bank_batch_id')),'22023','unmasked_counterparty_iban_rejected','full counterparty IBAN rejected');
select ok((customer_api.stage_bank_statement_rows_v1('74500000-0000-0000-0000-000000000001',current_setting('test.bank_batch_id')::uuid,'[{"external_ref":"T-074","booked_on":"2026-09-10","direction":"credit","amount":"100","currency":"RON","counterparty_iban_masked":"RO49************0000","remittance_text":"Invoice 074"},{"external_ref":"T-074","booked_on":"2026-09-10","direction":"credit","amount":"100","currency":"RON","counterparty_iban_masked":"RO49************0000","remittance_text":"Invoice 074"}]')->>'row_count')::int=2,'two rows staged');
select ok((customer_api.validate_bank_statement_import_v1('74500000-0000-0000-0000-000000000001',current_setting('test.bank_batch_id')::uuid)->>'duplicate_rows')::int=1,'intra-statement duplicate classified');
reset role;
select ok((select count(*) from payments.bank_transaction_staging where batch_id=current_setting('test.bank_batch_id')::uuid and validation_status='valid')=1,'exactly one valid staged row');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"74000000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"74100000-0000-0000-0000-000000000001"}',true);
select ok((customer_api.commit_bank_statement_import_v1('74500000-0000-0000-0000-000000000001',current_setting('test.bank_batch_id')::uuid)->>'inserted_rows')::int=1,'commit inserts exactly one canonical transaction');
select ok((customer_api.commit_bank_statement_import_v1('74500000-0000-0000-0000-000000000001',current_setting('test.bank_batch_id')::uuid)->>'idempotent')::boolean,'commit retry is idempotent');
reset role;
select throws_ok(format($q$update payments.import_batches set file_name='mutated' where id='%s'$q$,current_setting('test.bank_batch_id')),'55000','committed_statement_import_immutable','committed batch cannot mutate');
select ok((select count(*) from finance.journals where tenant_id='74100000-0000-0000-0000-000000000001')=0,'import creates no ledger posting');
select * from finish();
rollback;
