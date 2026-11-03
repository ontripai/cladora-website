-- Catalog/source gates only. These do NOT prove positive commands or concurrent execution.
-- Actual accepted-authority/concurrency proof is separate and requires the Core dependency + lease.
begin;
select plan(14);
select has_column('platform','building_setup_runs','creation_request_hash','immutable original request fingerprint column');
select has_column('platform','building_setup_runs','creation_receipt','original receipt separated from mutable payload');
select has_function('customer_api','get_building_setup_attempt_v2',array['uuid','uuid','text'],'explicit Workspace key recovery');
select ok(not has_function_privilege('anon','customer_api.get_building_setup_attempt_v2(uuid,uuid,text)','EXECUTE'),'anonymous recovery denied');
select ok(not has_function_privilege('authenticated','customer_api.create_building_setup_v1(uuid,text,jsonb)','EXECUTE'),'legacy create gateway closed');
select ok(not has_function_privilege('authenticated','app_private.create_building_setup_v1(uuid,text,jsonb)','EXECUTE'),'legacy private create closed');
select ok(position('require_building_setup_authority_v2' in pg_get_functiondef('app_private.get_building_setup_attempt_v2(uuid,uuid,text)'::regprocedure))<position('if not found then return null' in lower(pg_get_functiondef('app_private.get_building_setup_attempt_v2(uuid,uuid,text)'::regprocedure))),'authority before authorized absence');
select ok(position('created_by=c.actor_id' in pg_get_functiondef('app_private.get_building_setup_attempt_v2(uuid,uuid,text)'::regprocedure))>0,'attempt recovery actor bound');
select ok(position('customer_workspace_id=c.workspace_id' in pg_get_functiondef('app_private.get_building_setup_attempt_v2(uuid,uuid,text)'::regprocedure))>0,'attempt recovery exact Workspace bound');
select ok(position('pg_advisory_xact_lock' in pg_get_functiondef('app_private.create_building_setup_v2(uuid,uuid,text,jsonb)'::regprocedure))>0,'creation transaction lock present, not proof of concurrency');
select ok(exists(select 1 from pg_trigger where tgname='protect_setup_creation_v2'),'creation fingerprint immutability trigger exists');
select ok(exists(select 1 from pg_indexes where indexname='case_workspace_preparations_attempt_v2'),'case/key uniqueness exists');
select ok(not has_function_privilege('authenticated','app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text)','EXECUTE'),'generic command dispatcher is private');
select ok(not (select prosecdef from pg_proc where oid='customer_api.create_building_setup_v2(uuid,uuid,text,jsonb)'::regprocedure),'create gateway invoker only');
select * from finish();
rollback;
