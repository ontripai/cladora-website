-- Test 082: CLADORA-P2-SETUP-HARDENING-001
begin;
select plan(30);

select ok(not prosecdef,'create gateway is security invoker') from pg_proc where oid='customer_api.create_building_setup_v1(uuid,text,jsonb)'::regprocedure;
select ok(not prosecdef,'rehearse gateway is security invoker') from pg_proc where oid='customer_api.rehearse_building_setup_v1(uuid,uuid)'::regprocedure;
select ok(not prosecdef,'submit gateway is security invoker') from pg_proc where oid='customer_api.submit_building_setup_v1(uuid,uuid)'::regprocedure;
select ok(not prosecdef,'approve gateway is security invoker') from pg_proc where oid='customer_api.approve_building_setup_v1(uuid,uuid)'::regprocedure;
select ok(not prosecdef,'provision gateway is security invoker') from pg_proc where oid='customer_api.provision_building_setup_v1(uuid,uuid)'::regprocedure;

select ok(prosecdef,'private create implementation retains guarded privilege') from pg_proc where oid='app_private.create_building_setup_v1(uuid,text,jsonb)'::regprocedure;
select ok(prosecdef,'private rehearse implementation retains guarded privilege') from pg_proc where oid='app_private.rehearse_building_setup_v1(uuid,uuid)'::regprocedure;
select ok(prosecdef,'private submit implementation retains guarded privilege') from pg_proc where oid='app_private.submit_building_setup_v1(uuid,uuid)'::regprocedure;
select ok(prosecdef,'private approve implementation retains guarded privilege') from pg_proc where oid='app_private.approve_building_setup_v1(uuid,uuid)'::regprocedure;
select ok(prosecdef,'private provision implementation retains guarded privilege') from pg_proc where oid='app_private.provision_building_setup_v1(uuid,uuid)'::regprocedure;

select ok(not has_function_privilege('anon','customer_api.create_building_setup_v1(uuid,text,jsonb)','execute'),'anon create denied');
select ok(not has_function_privilege('anon','customer_api.rehearse_building_setup_v1(uuid,uuid)','execute'),'anon rehearse denied');
select ok(not has_function_privilege('anon','customer_api.submit_building_setup_v1(uuid,uuid)','execute'),'anon submit denied');
select ok(not has_function_privilege('anon','customer_api.approve_building_setup_v1(uuid,uuid)','execute'),'anon approve denied');
select ok(not has_function_privilege('anon','customer_api.provision_building_setup_v1(uuid,uuid)','execute'),'anon provision denied');

select ok(has_function_privilege('authenticated','customer_api.create_building_setup_v1(uuid,text,jsonb)','execute'),'authenticated create contract preserved');
select ok(has_function_privilege('authenticated','customer_api.rehearse_building_setup_v1(uuid,uuid)','execute'),'authenticated rehearse contract preserved');
select ok(has_function_privilege('authenticated','customer_api.submit_building_setup_v1(uuid,uuid)','execute'),'authenticated submit contract preserved');
select ok(has_function_privilege('authenticated','customer_api.approve_building_setup_v1(uuid,uuid)','execute'),'authenticated approve contract preserved');
select ok(has_function_privilege('authenticated','customer_api.provision_building_setup_v1(uuid,uuid)','execute'),'authenticated provision contract preserved');
select ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='customer_api' and p.prosecdef and p.proname like '%building_setup%'),'exposed setup SECURITY DEFINER surface is zero');
select ok(not has_function_privilege('authenticated','app_private.require_setup_context(uuid,text)','execute'),'guard helper remains non-callable');

insert into auth.users(id,email) values
 ('82100000-0000-0000-0000-000000000001','setup-hardening-author-082@cladora.test'),
 ('82100000-0000-0000-0000-000000000002','setup-hardening-reviewer-082@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status)
values('82200000-0000-0000-0000-000000000001','Setup Hardening 082','SETUP-H-082','active');
insert into identity.memberships(id,tenant_id,user_id,role_id,status)
select x.id,'82200000-0000-0000-0000-000000000001',x.user_id,r.id,'active'
from (values
 ('82300000-0000-0000-0000-000000000001'::uuid,'82100000-0000-0000-0000-000000000001'::uuid),
 ('82300000-0000-0000-0000-000000000002'::uuid,'82100000-0000-0000-0000-000000000002'::uuid)
) x(id,user_id) cross join identity.roles r where r.tenant_id is null and r.code='association_admin';
insert into platform.customer_workspaces(id,tenant_id,workspace_type,lifecycle_status,commercial_owner,environment,version)
values('82400000-0000-0000-0000-000000000001','82200000-0000-0000-0000-000000000001','ASSOCIATION','ACTIVE','Test 082','PILOT',1);
insert into identity.context_grants(id,membership_id,tenant_id,scope_type) values
 ('82500000-0000-0000-0000-000000000001','82300000-0000-0000-0000-000000000001','82200000-0000-0000-0000-000000000001','tenant'),
 ('82500000-0000-0000-0000-000000000002','82300000-0000-0000-0000-000000000002','82200000-0000-0000-0000-000000000001','tenant');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"82100000-0000-0000-0000-000000000001","aal":"aal1"}',true);
select throws_ok($$select customer_api.create_building_setup_v1('82500000-0000-0000-0000-000000000001','SETUP-H-082-AAL1','{}'::jsonb)$$,'42501','mfa_required','AAL1 fails closed through invoker gateway');

select set_config('request.jwt.claims','{"sub":"82100000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"82200000-0000-0000-0000-000000000001","active_context_id":"82500000-0000-0000-0000-000000000001"}',true);
select lives_ok($$select customer_api.create_building_setup_v1('82500000-0000-0000-0000-000000000001','SETUP-H-082-KEY','{"association":{"name":"Synthetic Hardening 082"},"building":{"name":"Main","code":"A","floors":2},"currency":"RON","period_start":"2026-01-01","period_end":"2026-12-31","units":[{"code":"1","floor":0,"area_m2":50}],"opening_balances":[]}'::jsonb)$$,'AAL2 author creates through invoker gateway');
select lives_ok($$select customer_api.rehearse_building_setup_v1('82500000-0000-0000-0000-000000000001',(select id from platform.building_setup_runs where idempotency_key='SETUP-H-082-KEY'))$$,'zero balance rehearsal passes');
select lives_ok($$select customer_api.submit_building_setup_v1('82500000-0000-0000-0000-000000000001',(select id from platform.building_setup_runs where idempotency_key='SETUP-H-082-KEY'))$$,'author submits through invoker gateway');
select throws_ok($$select customer_api.approve_building_setup_v1('82500000-0000-0000-0000-000000000001',(select id from platform.building_setup_runs where idempotency_key='SETUP-H-082-KEY'))$$,'42501','setup_dual_control_violation','self approval remains blocked');

select set_config('request.jwt.claims','{"sub":"82100000-0000-0000-0000-000000000002","aal":"aal2","active_tenant_id":"82200000-0000-0000-0000-000000000001","active_context_id":"82500000-0000-0000-0000-000000000002"}',true);
select lives_ok($$select customer_api.approve_building_setup_v1('82500000-0000-0000-0000-000000000002',(select id from platform.building_setup_runs where idempotency_key='SETUP-H-082-KEY'))$$,'independent reviewer approves');
select lives_ok($$select customer_api.provision_building_setup_v1('82500000-0000-0000-0000-000000000002',(select id from platform.building_setup_runs where idempotency_key='SETUP-H-082-KEY'))$$,'approved setup provisions');
select ok((select count(*) from finance.journals where tenant_id='82200000-0000-0000-0000-000000000001')=0,'hardening flow emits no journal');

select * from finish();
rollback;
