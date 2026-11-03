-- Uses Core's accepted canonical synthetic fixture; no external GUC/bootstrap prerequisite.
-- SQL-session JWT fixture, not issued Auth/HTTP proof. No adapter stub or legacy assignment.
-- Concurrent sessions are exercised by the companion PostgreSQL runner, not this transaction.
begin;
\ir fixtures/building_setup_authority_v2.inc
select plan(12);
do $$begin
 if nullif(current_setting('cladora.setup_fixture.actor',true),'') is null
 or nullif(current_setting('cladora.setup_fixture.context',true),'') is null
 or nullif(current_setting('cladora.setup_fixture.workspace',true),'') is null
 then raise exception 'canonical Setup fixture initialization failed';end if;
end$$;
-- A native G2 profile must separately prepare a real matching session. This
-- adds its identifier only when supplied; it never creates an Auth session.
select set_config('request.jwt.claims',(jsonb_build_object('sub',current_setting('cladora.setup_fixture.actor'),'role','authenticated','aal','aal2')
 ||case when nullif(current_setting('cladora.setup_fixture.session_id',true),'') is null then '{}'::jsonb
 else jsonb_build_object('session_id',current_setting('cladora.setup_fixture.session_id')) end)::text,true);
set local role authenticated;
select ok(customer_api.get_building_setup_attempt_v2(current_setting('cladora.setup_fixture.context')::uuid,current_setting('cladora.setup_fixture.workspace')::uuid,'SETUP-223-ABSENT') is null,'authorized absence');
select set_config('cladora.setup_fixture.payload','{"association":{"name":"Synthetic 223"},"building":{"name":"Synthetic block","code":"B223","floors":2},"currency":"RON","period_start":"2026-01-01","period_end":"2026-01-31","units":[{"code":"U1","floor":0,"area_m2":50}],"opening_balances":[]}',true);
select set_config('cladora.setup_fixture.creation',customer_api.create_building_setup_v2(current_setting('cladora.setup_fixture.context')::uuid,current_setting('cladora.setup_fixture.workspace')::uuid,'SETUP-223-CREATE',current_setting('cladora.setup_fixture.payload')::jsonb)::text,true);
select set_config('cladora.setup_fixture.run',(current_setting('cladora.setup_fixture.creation')::jsonb->>'run_id'),true);
select is((current_setting('cladora.setup_fixture.creation')::jsonb->>'revision')::integer,1,'creation starts at row revision one');
select is(customer_api.create_building_setup_v2(current_setting('cladora.setup_fixture.context')::uuid,current_setting('cladora.setup_fixture.workspace')::uuid,'SETUP-223-CREATE',current_setting('cladora.setup_fixture.payload')::jsonb),current_setting('cladora.setup_fixture.creation')::jsonb,'exact creation receipt replay');
select set_config('cladora.setup_fixture.command','setup-'||current_setting('cladora.setup_fixture.run')||'-r1-update-223',true);
select set_config('cladora.setup_fixture.update',customer_api.update_building_setup_units_v2(current_setting('cladora.setup_fixture.context')::uuid,current_setting('cladora.setup_fixture.workspace')::uuid,current_setting('cladora.setup_fixture.run')::uuid,1,current_setting('cladora.setup_fixture.command'),'[{"code":"U1","floor":0,"area_m2":70}]'::jsonb)::text,true);
select is((current_setting('cladora.setup_fixture.update')::jsonb->>'revision')::integer,2,'update advances exactly once');
select throws_ok($$select customer_api.create_building_setup_v2(current_setting('cladora.setup_fixture.context')::uuid,current_setting('cladora.setup_fixture.workspace')::uuid,'SETUP-223-CREATE',jsonb_set(current_setting('cladora.setup_fixture.payload')::jsonb,'{building,name}','"Changed"'))$$,'23505','setup_attempt_conflict','changed-payload key collision denied');
select is(customer_api.create_building_setup_v2(current_setting('cladora.setup_fixture.context')::uuid,current_setting('cladora.setup_fixture.workspace')::uuid,'SETUP-223-CREATE',current_setting('cladora.setup_fixture.payload')::jsonb),current_setting('cladora.setup_fixture.creation')::jsonb,'mutable unit edit does not erase original creation receipt');
select is((customer_api.get_building_setup_attempt_v2(current_setting('cladora.setup_fixture.context')::uuid,current_setting('cladora.setup_fixture.workspace')::uuid,'SETUP-223-CREATE')->>'revision')::integer,2,'key recovery shows current revision');
select throws_ok($$select customer_api.update_building_setup_units_v2(current_setting('cladora.setup_fixture.context')::uuid,current_setting('cladora.setup_fixture.workspace')::uuid,current_setting('cladora.setup_fixture.run')::uuid,1,'setup-'||current_setting('cladora.setup_fixture.run')||'-r1-stale-223','[{"code":"U1","floor":0,"area_m2":80}]')$$,'40001','setup_revision_conflict','stale parallel-tab edit denied');
select is(customer_api.update_building_setup_units_v2(current_setting('cladora.setup_fixture.context')::uuid,current_setting('cladora.setup_fixture.workspace')::uuid,current_setting('cladora.setup_fixture.run')::uuid,1,current_setting('cladora.setup_fixture.command'),'[{"code":"U1","floor":0,"area_m2":70}]'),current_setting('cladora.setup_fixture.update')::jsonb,'exact last-command replay returns receipt without advancing');
select is((customer_api.rehearse_building_setup_v2(current_setting('cladora.setup_fixture.context')::uuid,current_setting('cladora.setup_fixture.workspace')::uuid,current_setting('cladora.setup_fixture.run')::uuid,2,'setup-'||current_setting('cladora.setup_fixture.run')||'-r2-rehearse-223')->>'revision')::integer,3,'rehearsal advances exactly once');
-- Opt-in only for the independently prepared G2/native-session profile. Default
-- remains the legacy bounded-slot oracle. No missing coverage is backfilled.
\if :{?g2_covered_command_proof}
reset role;
select set_config('cladora.setup_fixture.g2_coverage_verified',
 exists(select 1 from platform.building_setup_command_coverage c
  where c.run_id=current_setting('cladora.setup_fixture.run')::uuid
   and c.epoch_id='building-g2-pm169-v1' and c.from_expected_revision=1)::text,true);
set local role authenticated;
select ok(current_setting('cladora.setup_fixture.g2_coverage_verified')::boolean
 and customer_api.update_building_setup_units_v2(current_setting('cladora.setup_fixture.context')::uuid,current_setting('cladora.setup_fixture.workspace')::uuid,current_setting('cladora.setup_fixture.run')::uuid,1,current_setting('cladora.setup_fixture.command'),'[{"code":"U1","floor":0,"area_m2":70}]')=current_setting('cladora.setup_fixture.update')::jsonb,
 'genuinely covered superseded command returns the immutable original receipt');
\else
select throws_ok($$select customer_api.update_building_setup_units_v2(current_setting('cladora.setup_fixture.context')::uuid,current_setting('cladora.setup_fixture.workspace')::uuid,current_setting('cladora.setup_fixture.run')::uuid,1,current_setting('cladora.setup_fixture.command'),'[{"code":"U1","floor":0,"area_m2":70}]')$$,'40001','setup_revision_conflict','superseded bounded receipt fails unresolved');
\endif
select throws_ok($$select customer_api.rehearse_building_setup_v1(current_setting('cladora.setup_fixture.context')::uuid,current_setting('cladora.setup_fixture.run')::uuid)$$,'42501',null,'legacy mutation bypass closed');
reset role;
select * from finish();
rollback;
