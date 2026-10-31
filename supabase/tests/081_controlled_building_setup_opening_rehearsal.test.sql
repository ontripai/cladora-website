-- Original Setup flow migrated to real native v2 authority; domain assertions retained.
begin;
\ir fixtures/building_setup_authority_v2.inc
select plan(28);
select has_table('platform','building_setup_runs','setup run table exists');
select has_function('customer_api','create_building_setup_v2',array['uuid','uuid','text','jsonb'],'create RPC exists');
select has_function('customer_api','rehearse_building_setup_v2',array['uuid','uuid','uuid','integer','text'],'rehearsal RPC exists');
select has_function('customer_api','approve_building_setup_v2',array['uuid','uuid','uuid','integer','text','text'],'approval RPC exists');
select has_function('customer_api','provision_building_setup_v2',array['uuid','uuid','uuid','integer','text'],'provision RPC exists');
select ok(not has_function_privilege('anon','customer_api.create_building_setup_v2(uuid,uuid,text,jsonb)','execute'),'anon denied');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(1),'aal','aal2')::text,true);
select lives_ok($$select set_config('cladora.setup_fixture.creation',pg_temp.bs_create('SETUP-081-KEY')::text,true)$$,'author creates a synthetic draft');
select set_config('cladora.setup_fixture.run',current_setting('cladora.setup_fixture.creation')::jsonb->>'run_id',true);
select ok((select count(*) from platform.building_setup_runs)=1,'idempotent draft persisted once');
select is(pg_temp.bs_create('SETUP-081-KEY'),current_setting('cladora.setup_fixture.creation')::jsonb,'exact receipt replay');
select ok((select count(*) from platform.building_setup_runs)=1,'retry creates no duplicate');
select lives_ok($$select pg_temp.bs_command('rehearse',1)$$,'balanced opening rehearsal passes');
reset role;
select ok((select count(*) from portfolio.properties where tenant_id=pg_temp.bs_id(10))=1,'rehearsal performs zero property writes beyond fixture');
set local role authenticated;
select lives_ok($$select pg_temp.bs_command('submit',2)$$,'author submits');
-- Give the operator independently assigned approval capability for this negative
-- control, so the process dual-control check itself is exercised, not a missing grant.
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(2),'aal','aal2')::text,true);
select customer_api.assign_workspace_role_v2(pg_temp.bs_id(111),pg_temp.bs_id(101),pg_temp.bs_id(90),
 (select value from bs_state where name='reviewer_role'),'workspace',null,null,null,
 statement_timestamp()+interval '2 hours','Synthetic self approval negative control','bs081-dual-role');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(1),'aal','aal2')::text,true);
select throws_ok($$select pg_temp.bs_command('approve',3)$$,'42501','setup_dual_control_violation','author cannot self-approve');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(3),'aal','aal2')::text,true);
select lives_ok($$select pg_temp.bs_command('approve',3,current_setting('cladora.setup_fixture.reviewer_context')::uuid)$$,'independent reviewer approves');
select set_config('request.jwt.claims',jsonb_build_object('sub',pg_temp.bs_id(1),'aal','aal2')::text,true);
select lives_ok($$select set_config('cladora.setup_fixture.provision',pg_temp.bs_command('provision',4)::text,true)$$,'approved setup provisions atomically');
reset role;
select ok((select count(*) from portfolio.properties where id=(current_setting('cladora.setup_fixture.provision')::jsonb->>'property_id')::uuid)=1,'one property provisioned');
select ok((select count(*) from portfolio.buildings where property_id=(current_setting('cladora.setup_fixture.provision')::jsonb->>'property_id')::uuid)=1,'one building provisioned');
select ok((select count(*) from portfolio.units where tenant_id=pg_temp.bs_id(10))=2,'two units provisioned');
select ok((select count(*) from finance.accounting_periods where property_id=(current_setting('cladora.setup_fixture.provision')::jsonb->>'property_id')::uuid and status='open')=1,'one open period provisioned');
select ok((select count(*) from platform.workspace_property_bindings where property_id=(current_setting('cladora.setup_fixture.provision')::jsonb->>'property_id')::uuid and customer_workspace_id=pg_temp.bs_id(50) and status='active')=1,'provision binds property to workspace');
select ok((select count(*) from identity.context_grants where membership_id=pg_temp.bs_id(90) and property_id=(current_setting('cladora.setup_fixture.provision')::jsonb->>'property_id')::uuid)=1,'original operator gains property context');
select ok((select count(*) from identity.context_grants where membership_id=(select value from bs_state where name='reviewer_membership') and property_id=(current_setting('cladora.setup_fixture.provision')::jsonb->>'property_id')::uuid)=0,'reviewer gains no property context');
set local role authenticated;
select is(pg_temp.bs_command('provision',4),current_setting('cladora.setup_fixture.provision')::jsonb,'provision retry returns exact receipt');
reset role;
select ok((select count(*) from platform.workspace_property_bindings where property_id=(current_setting('cladora.setup_fixture.provision')::jsonb->>'property_id')::uuid and customer_workspace_id=pg_temp.bs_id(50) and status='active')=1,'retry creates no duplicate binding');
select ok((select count(*) from finance.journals where tenant_id=pg_temp.bs_id(10))=0,'setup and rehearsal emit no journal');
set local role authenticated;
select lives_ok($$select set_config('cladora.setup_fixture.unbalanced',pg_temp.bs_create('SETUP-081-UNBALANCED','[{"account_code":"OPEN","side":"debit","amount":10}]')::text,true)$$,'unbalanced synthetic draft can be previewed');
select set_config('cladora.setup_fixture.run',current_setting('cladora.setup_fixture.unbalanced')::jsonb->>'run_id',true);
select throws_ok($$select pg_temp.bs_command('rehearse',1)$$,'22023','opening_balance_rehearsal_not_zero','non-zero opening rehearsal fails closed');
reset role;
select * from finish();
rollback;
