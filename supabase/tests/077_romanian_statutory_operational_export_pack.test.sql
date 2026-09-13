begin;

select plan(31);

select has_table('finance','export_packs','sealed export-pack registry exists');
select has_table('finance','export_artifacts','export-artifact registry exists');
select ok(exists(select 1 from information_schema.columns where table_schema='finance' and table_name='export_packs' and column_name='source_snapshot'),'canonical source snapshot exists');
select ok(exists(select 1 from information_schema.columns where table_schema='finance' and table_name='export_packs' and column_name='source_sha256'),'source SHA-256 exists');
select ok(exists(select 1 from information_schema.columns where table_schema='finance' and table_name='export_packs' and column_name='manifest_json'),'manifest exists');
select ok(exists(select 1 from information_schema.columns where table_schema='finance' and table_name='export_packs' and column_name='manifest_sha256'),'manifest SHA-256 exists');
select ok(exists(select 1 from information_schema.columns where table_schema='finance' and table_name='export_artifacts' and column_name='content_sha256'),'artifact SHA-256 slot exists');
select ok(exists(select 1 from information_schema.columns where table_schema='finance' and table_name='export_artifacts' and column_name='byte_size'),'bounded artifact size evidence exists');
select has_function('customer_api','create_export_pack_v1',array['uuid','uuid','text'],'create gateway exists');
select has_function('customer_api','get_export_pack_v1',array['uuid','uuid'],'read gateway exists');
select has_function('app_private','export_pack_actor_v1',array['uuid','text'],'central export actor gate exists');
select has_function('app_private','create_export_pack_internal_v1',array['uuid','uuid','text'],'internal sealer exists');
select has_function('app_private','build_export_reports_v1',array['uuid','uuid','date','date'],'canonical row-set builder exists');
select has_function('customer_api','record_export_artifact_v1',array['uuid','uuid','text','text','text','bigint'],'artifact evidence gateway exists');
select ok((select prorettype='jsonb'::regtype from pg_proc where oid='customer_api.create_export_pack_v1(uuid,uuid,text)'::regprocedure),'create returns jsonb');
select ok((select prorettype='jsonb'::regtype from pg_proc where oid='customer_api.get_export_pack_v1(uuid,uuid)'::regprocedure),'read returns jsonb');
select ok((select relrowsecurity from pg_class where oid='finance.export_packs'::regclass),'export packs use RLS defense in depth');
select ok((select relrowsecurity from pg_class where oid='finance.export_artifacts'::regclass),'export artifacts use RLS defense in depth');
select ok(not has_table_privilege('authenticated','finance.export_packs','SELECT'),'raw packs are not directly readable');
select ok(not has_table_privilege('authenticated','finance.export_artifacts','SELECT'),'raw artifacts are not directly readable');
select ok(has_function_privilege('authenticated','customer_api.create_export_pack_v1(uuid,uuid,text)','EXECUTE'),'authenticated may invoke guarded create gateway');
select ok(not has_function_privilege('anon','customer_api.create_export_pack_v1(uuid,uuid,text)','EXECUTE'),'anon cannot create exports');
select ok(position('export_requires_closed_accounting_period' in pg_get_functiondef('app_private.create_export_pack_internal_v1(uuid,uuid,text)'::regprocedure))>0,'open periods fail closed');
select ok(position('idempotency_payload_mismatch' in pg_get_functiondef('app_private.create_export_pack_internal_v1(uuid,uuid,text)'::regprocedure))>0,'idempotency payload mismatch is deterministic');
select ok(position('extensions.digest' in pg_get_functiondef('app_private.create_export_pack_internal_v1(uuid,uuid,text)'::regprocedure))>0,'source and manifest use SHA-256');
select ok(position('build_export_reports_v1' in pg_get_functiondef('app_private.create_export_pack_internal_v1(uuid,uuid,text)'::regprocedure))>0,'sealed source embeds canonical report datasets');
select ok(position('export_report_row_limit_exceeded' in pg_get_functiondef('app_private.build_export_reports_v1(uuid,uuid,date,date)'::regprocedure))>0,'canonical report datasets fail closed above row limit');
select ok(position('ROMANIAN_EXPORT_PACK_SEALED' in pg_get_functiondef('app_private.create_export_pack_internal_v1(uuid,uuid,text)'::regprocedure))>0,'sealing emits audit evidence');
select ok(position('sealed_export_pack_is_immutable' in pg_get_functiondef('finance.protect_export_pack_v1()'::regprocedure))>0,'sealed packs are immutable');
select ok(position('export_artifact_size_out_of_bounds' in pg_get_functiondef('app_private.record_export_artifact_internal_v1(uuid,uuid,text,text,text,bigint)'::regprocedure))>0,'artifact bytes are bounded');
select ok(position('export_artifact_materialization_mismatch' in pg_get_functiondef('app_private.record_export_artifact_internal_v1(uuid,uuid,text,text,text,bigint)'::regprocedure))>0,'artifact retries fail closed on mismatched content');

select * from finish();
rollback;
