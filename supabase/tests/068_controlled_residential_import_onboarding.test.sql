-- Test 068: Controlled Residential Import & Onboarding contracts
begin;
select plan(71);

select has_table('platform','import_templates','import_templates exists');
select has_table('platform','import_template_versions','import_template_versions exists');
select has_table('platform','import_runs','import_runs exists');
select has_table('platform','import_sources','import_sources exists');
select has_table('platform','import_rows','import_rows exists');
select has_table('platform','import_row_issues','import_row_issues exists');
select has_table('platform','import_entity_mappings','import_entity_mappings exists');
select has_table('platform','import_reconciliation_results','import_reconciliation_results exists');
select has_table('platform','onboarding_checkpoints','onboarding_checkpoints exists');

select has_function('customer_api','list_import_templates_v1',array['uuid'],'list templates RPC exists');
select has_function('customer_api','create_import_run_v1',array['uuid','uuid','text'],'create run RPC exists');
select has_function('customer_api','add_import_source_v1',array['uuid','uuid','text','text','text','bigint','text','jsonb'],'add source RPC exists');
select has_function('customer_api','validate_import_v1',array['uuid','uuid'],'validate RPC exists');
select has_function('customer_api','dry_run_import_v1',array['uuid','uuid'],'dry-run RPC exists');
select has_function('customer_api','submit_import_v1',array['uuid','uuid'],'submit RPC exists');
select has_function('customer_api','approve_import_commit_v1',array['uuid','uuid'],'approve commit RPC exists');
select has_function('customer_api','get_import_preview_v1',array['uuid','uuid'],'preview RPC exists');
select has_function('customer_api','cancel_import_v1',array['uuid','uuid'],'cancel RPC exists');
select has_function('customer_api','activate_import_v1',array['uuid','uuid'],'activate RPC exists');

select ok((select relrowsecurity from pg_class where oid='platform.import_templates'::regclass),'templates RLS enabled');
select ok((select relrowsecurity from pg_class where oid='platform.import_template_versions'::regclass),'template versions RLS enabled');
select ok((select relrowsecurity from pg_class where oid='platform.import_runs'::regclass),'runs RLS enabled');
select ok((select relrowsecurity from pg_class where oid='platform.import_sources'::regclass),'sources RLS enabled');
select ok((select relrowsecurity from pg_class where oid='platform.import_rows'::regclass),'rows RLS enabled');
select ok((select relrowsecurity from pg_class where oid='platform.import_row_issues'::regclass),'issues RLS enabled');
select ok((select relrowsecurity from pg_class where oid='platform.import_entity_mappings'::regclass),'mappings RLS enabled');
select ok((select relrowsecurity from pg_class where oid='platform.import_reconciliation_results'::regclass),'reconciliation RLS enabled');
select ok((select relrowsecurity from pg_class where oid='platform.onboarding_checkpoints'::regclass),'checkpoints RLS enabled');

select ok(not has_table_privilege('anon','platform.import_runs','SELECT'),'anon cannot read runs');
select ok(not has_table_privilege('anon','platform.import_rows','SELECT'),'anon cannot read rows');
select ok(not has_table_privilege('authenticated','platform.import_runs','INSERT'),'authenticated cannot directly insert runs');
select ok(not has_table_privilege('authenticated','platform.import_rows','INSERT'),'authenticated cannot directly insert rows');
select ok(not has_table_privilege('authenticated','platform.import_rows','UPDATE'),'authenticated cannot directly update rows');
select ok(not has_table_privilege('authenticated','platform.import_rows','DELETE'),'authenticated cannot directly delete rows');
select ok(not has_function_privilege('anon','customer_api.create_import_run_v1(uuid,uuid,text)','EXECUTE'),'anon denied create run');
select ok(has_function_privilege('authenticated','customer_api.create_import_run_v1(uuid,uuid,text)','EXECUTE'),'authenticated may invoke guarded create run');
select ok(not has_function_privilege('anon','customer_api.approve_import_commit_v1(uuid,uuid)','EXECUTE'),'anon denied approval');
select ok(has_function_privilege('authenticated','customer_api.approve_import_commit_v1(uuid,uuid)','EXECUTE'),'authenticated may invoke guarded approval');

select ok(exists(select 1 from identity.permissions where code='onboarding.import.read'),'read permission exists');
select ok(exists(select 1 from identity.permissions where code='onboarding.import.manage'),'manage permission exists');
select ok(exists(select 1 from identity.permissions where code='onboarding.import.approve'),'approve permission exists');
select ok(exists(select 1 from pg_indexes where schemaname='platform' and indexname='import_runs_one_live_scope_idx'),'single live run index exists');
select ok(exists(select 1 from pg_indexes where schemaname='platform' and indexname='import_rows_run_classification_idx'),'row classification index exists');
select ok(exists(select 1 from pg_trigger where tgname='import_runs_transition_guard'),'run transition trigger exists');
select ok(exists(select 1 from pg_trigger where tgname='import_sources_immutable'),'source immutability trigger exists');
select ok(exists(select 1 from pg_trigger where tgname='import_rows_immutable'),'row immutability trigger exists');

select ok((select count(*)=17 from information_schema.columns where table_schema='platform' and table_name='import_runs'),'run column contract stable');
select ok(exists(select 1 from information_schema.columns where table_schema='platform' and table_name='import_runs' and column_name='input_hash'),'input hash exists');
select ok(exists(select 1 from information_schema.columns where table_schema='platform' and table_name='import_runs' and column_name='result_hash'),'result hash exists');
select ok(exists(select 1 from information_schema.columns where table_schema='platform' and table_name='import_runs' and column_name='version'),'optimistic version exists');
select ok(exists(select 1 from information_schema.columns where table_schema='platform' and table_name='import_sources' and column_name='sha256'),'source SHA-256 exists');
select ok(exists(select 1 from information_schema.columns where table_schema='platform' and table_name='import_rows' and column_name='row_hash'),'row hash exists');
select ok(exists(select 1 from information_schema.columns where table_schema='platform' and table_name='import_reconciliation_results' and column_name='is_balanced'),'balanced certificate exists');

select ok(position('DEFERRED_XLSX_IMPORT_UNTIL_MALWARE_SCANNER' in pg_get_functiondef('customer_api.add_import_source_v1(uuid,uuid,text,text,text,bigint,text,jsonb)'::regprocedure))>0,'XLSX fail-closed boundary exists');
select ok(position('dual_control_violation' in pg_get_functiondef('customer_api.approve_import_commit_v1(uuid,uuid)'::regprocedure))>0,'dual control enforced');
select ok(position('opening_balance_unbalanced' in pg_get_functiondef('customer_api.approve_import_commit_v1(uuid,uuid)'::regprocedure))>0,'unbalanced opening data rejected');
select ok(position('post_commit_cancellation_forbidden' in pg_get_functiondef('customer_api.cancel_import_v1(uuid,uuid)'::regprocedure))>0,'post-commit cancellation rejected');
select ok(position('reconciliation_required' in pg_get_functiondef('customer_api.activate_import_v1(uuid,uuid)'::regprocedure))>0,'activation requires reconciliation');
select ok(position('for update' in lower(pg_get_functiondef('customer_api.approve_import_commit_v1(uuid,uuid)'::regprocedure)))>0,'approval uses row lock');
select ok(position('for update' in lower(pg_get_functiondef('customer_api.validate_import_v1(uuid,uuid)'::regprocedure)))>0,'validation uses row lock');
select ok(position('for update' in lower(pg_get_functiondef('customer_api.dry_run_import_v1(uuid,uuid)'::regprocedure)))>0,'dry run uses row lock');

select throws_ok($$insert into platform.import_sources(run_id,template_version_id,original_filename,media_type,byte_size,sha256,row_count,uploaded_by) values(gen_random_uuid(),gen_random_uuid(),'x.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',1,repeat('a',64),0,gen_random_uuid())$$,'23503',null,'orphan source rejected');
select throws_ok($$insert into platform.import_runs(customer_workspace_id,tenant_id,idempotency_key,created_by,input_hash) values(gen_random_uuid(),gen_random_uuid(),'valid-key',gen_random_uuid(),'bad')$$,'23503',null,'orphan run rejected before invalid hash');
select throws_ok($$insert into platform.import_template_versions(template_id,version,format,schema_json,max_rows) values(gen_random_uuid(),1,'csv','{}',0)$$,'23503',null,'orphan template version rejected');
select throws_ok($$insert into platform.import_rows(run_id,source_id,template_code,source_row_no,source_payload,row_hash) values(gen_random_uuid(),gen_random_uuid(),'unit',0,'{}',repeat('a',64))$$,'23503',null,'orphan row rejected');

select ok(obj_description('platform.import_rows'::regclass) like 'Untrusted staging rows%','staging boundary documented');
select ok(obj_description('customer_api.approve_import_commit_v1(uuid,uuid)'::regprocedure) like 'AAL2 dual-control%','commit contract documented');
select ok(obj_description('customer_api.add_import_source_v1(uuid,uuid,text,text,text,bigint,text,jsonb)'::regprocedure) like 'CSV-only%','file boundary documented');
select ok(not exists(select 1 from platform.import_runs),'migration has no import fixtures');
select ok(not exists(select 1 from platform.import_sources),'migration has no source fixtures');
select ok(not exists(select 1 from platform.import_rows),'migration has no row fixtures');

select * from finish();
rollback;
