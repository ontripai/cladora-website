begin;
select plan(22);

select has_function('public','claim_export_artifact_scan_job_worker_v1',array['text','text','integer'],'claim worker gateway exists');
select has_function('public','fail_export_artifact_scan_job_worker_v1',array['uuid','uuid','text','integer'],'failure worker gateway exists');
select has_function('public','complete_export_artifact_scan_job_worker_v1',array['uuid','uuid','text','text','text','text','text','timestamp with time zone'],'completion worker gateway exists');

select ok(has_function_privilege('service_role','public.claim_export_artifact_scan_job_worker_v1(text,text,integer)','EXECUTE'),'service role may claim');
select ok(has_function_privilege('service_role','public.fail_export_artifact_scan_job_worker_v1(uuid,uuid,text,integer)','EXECUTE'),'service role may fail');
select ok(has_function_privilege('service_role','public.complete_export_artifact_scan_job_worker_v1(uuid,uuid,text,text,text,text,text,timestamptz)','EXECUTE'),'service role may complete');
select ok(not has_function_privilege('authenticated','public.claim_export_artifact_scan_job_worker_v1(text,text,integer)','EXECUTE'),'authenticated cannot claim');
select ok(not has_function_privilege('authenticated','public.fail_export_artifact_scan_job_worker_v1(uuid,uuid,text,integer)','EXECUTE'),'authenticated cannot fail');
select ok(not has_function_privilege('authenticated','public.complete_export_artifact_scan_job_worker_v1(uuid,uuid,text,text,text,text,text,timestamptz)','EXECUTE'),'authenticated cannot complete');
select ok(not has_function_privilege('anon','public.claim_export_artifact_scan_job_worker_v1(text,text,integer)','EXECUTE'),'anonymous cannot claim');
select ok(not has_function_privilege('anon','public.fail_export_artifact_scan_job_worker_v1(uuid,uuid,text,integer)','EXECUTE'),'anonymous cannot fail');
select ok(not has_function_privilege('anon','public.complete_export_artifact_scan_job_worker_v1(uuid,uuid,text,text,text,text,text,timestamptz)','EXECUTE'),'anonymous cannot complete');

select ok(not (select prosecdef from pg_proc where oid='public.claim_export_artifact_scan_job_worker_v1(text,text,integer)'::regprocedure),'claim wrapper is security invoker');
select ok(not (select prosecdef from pg_proc where oid='public.fail_export_artifact_scan_job_worker_v1(uuid,uuid,text,integer)'::regprocedure),'failure wrapper is security invoker');
select ok(not (select prosecdef from pg_proc where oid='public.complete_export_artifact_scan_job_worker_v1(uuid,uuid,text,text,text,text,text,timestamptz)'::regprocedure),'completion wrapper is security invoker');
select ok((select proconfig @> array['search_path=pg_catalog'] from pg_proc where oid='public.claim_export_artifact_scan_job_worker_v1(text,text,integer)'::regprocedure),'claim search path is fixed');
select ok((select proconfig @> array['search_path=pg_catalog'] from pg_proc where oid='public.fail_export_artifact_scan_job_worker_v1(uuid,uuid,text,integer)'::regprocedure),'failure search path is fixed');
select ok((select proconfig @> array['search_path=pg_catalog'] from pg_proc where oid='public.complete_export_artifact_scan_job_worker_v1(uuid,uuid,text,text,text,text,text,timestamptz)'::regprocedure),'completion search path is fixed');

select ok(position('app_private.claim_export_artifact_scan_job_v1' in pg_get_functiondef('public.claim_export_artifact_scan_job_worker_v1(text,text,integer)'::regprocedure))>0,'claim delegates to Migration 96');
select ok(position('app_private.fail_export_artifact_scan_job_v1' in pg_get_functiondef('public.fail_export_artifact_scan_job_worker_v1(uuid,uuid,text,integer)'::regprocedure))>0,'failure delegates to Migration 96');
select ok(position('app_private.complete_export_artifact_scan_job_v1' in pg_get_functiondef('public.complete_export_artifact_scan_job_worker_v1(uuid,uuid,text,text,text,text,text,timestamptz)'::regprocedure))>0,'completion delegates to Migration 96');
select ok(not ('app_private'=any(current_schemas(false))),'app_private is not in the caller search path');

select * from finish();
rollback;
