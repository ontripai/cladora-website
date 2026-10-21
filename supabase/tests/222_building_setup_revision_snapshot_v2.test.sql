-- Catalog/source gates only. These do NOT prove positive commands or concurrent execution.
-- Actual accepted-authority/concurrency proof is separate and requires the Core dependency + lease.
begin;
select plan(17);
select has_column('platform','building_setup_runs','revision','row revision exists');
select has_column('platform','building_setup_runs','submitted_revision','submitted_revision snapshot metadata exists');
select has_column('platform','building_setup_runs','submitted_payload_hash','submitted_payload_hash snapshot metadata exists');
select has_column('platform','building_setup_runs','approved_revision','approved_revision snapshot metadata exists');
select has_column('platform','building_setup_runs','approved_submitted_revision','approved_submitted_revision snapshot metadata exists');
select has_column('platform','building_setup_runs','approved_payload_hash','approved_payload_hash snapshot metadata exists');
select has_column('platform','building_setup_runs','last_command_key','last_command_key snapshot metadata exists');
select has_column('platform','building_setup_runs','last_command_hash','last_command_hash snapshot metadata exists');
select has_column('platform','building_setup_runs','last_command_receipt','last_command_receipt snapshot metadata exists');
select ok(position('r.revision<>p_expected_revision' in pg_get_functiondef('app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text)'::regprocedure))>0,'stale revision guard');
select ok(position('r.submitted_revision is distinct from r.revision' in pg_get_functiondef('app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text)'::regprocedure))>0,'approval binds submitted revision');
select ok(position('p_expected_payload_hash is distinct from r.submitted_payload_hash' in pg_get_functiondef('app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text)'::regprocedure))>0,'approval pins submitted hash');
select ok(position('r.approved_revision is distinct from r.revision' in pg_get_functiondef('app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text)'::regprocedure))>0,'provision pins approved revision');
select ok(position('r.approved_submitted_revision is distinct from r.submitted_revision' in pg_get_functiondef('app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text)'::regprocedure))>0,'provision binds approval to submission');
select ok(position('setup_legacy_review_required' in pg_get_functiondef('app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text)'::regprocedure))>0,'legacy provenance fails closed');
select ok(position('r.last_command_actor<>c.actor_id or r.last_command_hash<>v_hash' in pg_get_functiondef('app_private.command_building_setup_v2(uuid,uuid,uuid,integer,text,text,jsonb,text)'::regprocedure))>0,'replay actor/request binding');
select ok(not has_function_privilege('authenticated','customer_api.approve_building_setup_v1(uuid,uuid)','EXECUTE'),'unversioned approval bypass closed');
select * from finish();
rollback;
