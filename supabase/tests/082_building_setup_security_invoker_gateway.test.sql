-- Original hardening assertions follow the v2 public/private cutover.
begin;
\ir fixtures/building_setup_authority_v2.inc
select plan(31);
select ok(not prosecdef,'create gateway is security invoker') from pg_proc where oid='customer_api.create_building_setup_v2(uuid,uuid,text,jsonb)'::regprocedure;
select ok(not prosecdef,'rehearse gateway is security invoker') from pg_proc where oid='customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure;
select ok(not prosecdef,'submit gateway is security invoker') from pg_proc where oid='customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure;
select ok(not prosecdef,'approve gateway is security invoker') from pg_proc where oid='customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)'::regprocedure;
select ok(not prosecdef,'provision gateway is security invoker') from pg_proc where oid='customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure;
select ok(prosecdef,'private create implementation retains guarded privilege') from pg_proc where oid='app_private.create_building_setup_v2(uuid,uuid,text,jsonb)'::regprocedure;
select ok(prosecdef,'private rehearse implementation retains guarded privilege') from pg_proc where oid='app_private.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure;
select ok(prosecdef,'private submit implementation retains guarded privilege') from pg_proc where oid='app_private.submit_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure;
select ok(prosecdef,'private approve implementation retains guarded privilege') from pg_proc where oid='app_private.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)'::regprocedure;
select ok(prosecdef,'private provision implementation retains guarded privilege') from pg_proc where oid='app_private.provision_building_setup_v2(uuid,uuid,uuid,integer,text)'::regprocedure;
select ok(not has_function_privilege('anon','customer_api.create_building_setup_v2(uuid,uuid,text,jsonb)','execute'),'anon create denied');
select ok(not has_function_privilege('anon','customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)','execute'),'anon rehearse denied');
select ok(not has_function_privilege('anon','customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text)','execute'),'anon submit denied');
select ok(not has_function_privilege('anon','customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)','execute'),'anon approve denied');
select ok(not has_function_privilege('anon','customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text)','execute'),'anon provision denied');
select ok(has_function_privilege('authenticated','customer_api.create_building_setup_v2(uuid,uuid,text,jsonb)','execute'),'authenticated create v2 contract preserved');
select ok(has_function_privilege('authenticated','customer_api.rehearse_building_setup_v2(uuid,uuid,uuid,integer,text)','execute'),'authenticated rehearse v2 contract preserved');
select ok(has_function_privilege('authenticated','customer_api.submit_building_setup_v2(uuid,uuid,uuid,integer,text)','execute'),'authenticated submit v2 contract preserved');
select ok(has_function_privilege('authenticated','customer_api.approve_building_setup_v2(uuid,uuid,uuid,integer,text,text)','execute'),'authenticated approve v2 contract preserved');
select ok(has_function_privilege('authenticated','customer_api.provision_building_setup_v2(uuid,uuid,uuid,integer,text)','execute'),'authenticated provision v2 contract preserved');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='customer_api' and p.prosecdef and p.proname like '%building_setup%'),'exposed setup SECURITY DEFINER surface is zero');
select ok(not has_function_privilege('authenticated','app_private.require_building_setup_authority_v2(uuid,uuid,text,text)','execute'),'guard helper remains non-callable');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(1),'aal','aal1')::text,true);
select throws_ok($$select pg_temp.bs_create('SETUP-H-082-AAL1')$$,'42501','mfa_required','AAL1 fails closed through invoker gateway');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(1),'aal','aal2')::text,true);
select lives_ok($$select set_config('cladora.setup_fixture.run',pg_temp.bs_create('SETUP-H-082-KEY')->>'run_id',true)$$,'AAL2 author creates through invoker gateway');
select lives_ok($$select pg_temp.bs_command('rehearse',1)$$,'zero balance rehearsal passes');
select lives_ok($$select pg_temp.bs_command('submit',2)$$,'author submits through invoker gateway');
-- Separately assign approve authority to test process-level self-approval denial.
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(2),'aal','aal2')::text,true);
select customer_api.assign_workspace_role_v2(pg_temp.bs_id(111),pg_temp.bs_id(101),pg_temp.bs_id(90),
 (select value from bs_state where name='reviewer_role'),'workspace',null,null,null,
 statement_timestamp()+interval '2 hours','Synthetic self approval negative control','bs082-dual-role');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(1),'aal','aal2')::text,true);
select throws_ok($$select pg_temp.bs_command('approve',3)$$,'42501','setup_dual_control_violation','self approval remains blocked');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select lives_ok($$select pg_temp.bs_command('approve',3,current_setting('cladora.setup_fixture.reviewer_context')::uuid)$$,'independent reviewer approves');
select throws_ok($$select pg_temp.bs_command('provision',4,current_setting('cladora.setup_fixture.reviewer_context')::uuid)$$,'42501','building_setup_reviewer_action_denied','reviewer cannot provision');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(1),'aal','aal2')::text,true);
select lives_ok($$select pg_temp.bs_command('provision',4)$$,'approved setup provisions through original operator');
reset role;
select ok((select count(*) from finance.journals where tenant_id=pg_temp.bs_id(10))=0,'hardening flow emits no journal');
select * from finish();
rollback;
