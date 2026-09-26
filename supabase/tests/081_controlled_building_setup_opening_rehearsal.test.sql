-- Test 081: CLADORA-P2-SETUP-001
begin;
select plan(28);

insert into auth.users(id,email) values
 ('81100000-0000-0000-0000-000000000001','setup-author-081@cladora.test'),
 ('81100000-0000-0000-0000-000000000002','setup-reviewer-081@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status)
values('81200000-0000-0000-0000-000000000001','Setup 081 Association','SETUP-081','active');
insert into identity.memberships(id,tenant_id,user_id,role_id,status)
select x.id,'81200000-0000-0000-0000-000000000001',x.user_id,r.id,'active'
from (values
 ('81300000-0000-0000-0000-000000000001'::uuid,'81100000-0000-0000-0000-000000000001'::uuid),
 ('81300000-0000-0000-0000-000000000002'::uuid,'81100000-0000-0000-0000-000000000002'::uuid)
) x(id,user_id) cross join identity.roles r where r.tenant_id is null and r.code='association_admin';
insert into platform.customer_workspaces(id,tenant_id,workspace_type,lifecycle_status,commercial_owner,environment,version)
values('81400000-0000-0000-0000-000000000001','81200000-0000-0000-0000-000000000001','ASSOCIATION','ACTIVE','Test 081','PILOT',1);
insert into identity.context_grants(id,membership_id,tenant_id,scope_type) values
 ('81500000-0000-0000-0000-000000000001','81300000-0000-0000-0000-000000000001','81200000-0000-0000-0000-000000000001','tenant'),
 ('81500000-0000-0000-0000-000000000002','81300000-0000-0000-0000-000000000002','81200000-0000-0000-0000-000000000001','tenant');

select has_table('platform','building_setup_runs','setup run table exists');
select has_function('customer_api','create_building_setup_v1',array['uuid','text','jsonb'],'create RPC exists');
select has_function('customer_api','rehearse_building_setup_v1',array['uuid','uuid'],'rehearsal RPC exists');
select has_function('customer_api','approve_building_setup_v1',array['uuid','uuid'],'approval RPC exists');
select has_function('customer_api','provision_building_setup_v1',array['uuid','uuid'],'provision RPC exists');
select ok(not has_function_privilege('anon','customer_api.create_building_setup_v1(uuid,text,jsonb)','execute'),'anon denied');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"81100000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"81200000-0000-0000-0000-000000000001","active_context_id":"81500000-0000-0000-0000-000000000001"}',true);
select lives_ok($$
 select customer_api.create_building_setup_v1(
  '81500000-0000-0000-0000-000000000001','SETUP-081-KEY',
  '{"association":{"name":"Synthetic Setup 081"},"building":{"name":"Main","code":"A","floors":2},"currency":"RON","period_start":"2026-01-01","period_end":"2026-01-31","units":[{"code":"1","floor":0,"area_m2":50},{"code":"2","floor":1,"area_m2":60}],"opening_balances":[{"side":"debit","amount":100},{"side":"credit","amount":100}]}'::jsonb)
$$,'author creates a synthetic draft');
select ok((select count(*) from platform.building_setup_runs)=1,'idempotent draft persisted once');
select lives_ok($$select customer_api.create_building_setup_v1('81500000-0000-0000-0000-000000000001','SETUP-081-KEY','{"association":{"name":"Synthetic Setup 081"},"building":{"name":"Main"},"currency":"RON","period_start":"2026-01-01","period_end":"2026-01-31","units":[{"code":"1"}]}'::jsonb)$$,'idempotent retry lives');
select ok((select count(*) from platform.building_setup_runs)=1,'retry creates no duplicate');
select lives_ok($$select customer_api.rehearse_building_setup_v1('81500000-0000-0000-0000-000000000001',(select id from platform.building_setup_runs limit 1))$$,'balanced opening rehearsal passes');
select ok((select count(*) from portfolio.properties where tenant_id='81200000-0000-0000-0000-000000000001')=0,'rehearsal performs zero property writes');
select lives_ok($$select customer_api.submit_building_setup_v1('81500000-0000-0000-0000-000000000001',(select id from platform.building_setup_runs limit 1))$$,'author submits');
select throws_ok($$select customer_api.approve_building_setup_v1('81500000-0000-0000-0000-000000000001',(select id from platform.building_setup_runs limit 1))$$,'42501','setup_dual_control_violation','author cannot self-approve');

select set_config('request.jwt.claims','{"sub":"81100000-0000-0000-0000-000000000002","aal":"aal2","active_tenant_id":"81200000-0000-0000-0000-000000000001","active_context_id":"81500000-0000-0000-0000-000000000002"}',true);
select lives_ok($$select customer_api.approve_building_setup_v1('81500000-0000-0000-0000-000000000002',(select id from platform.building_setup_runs limit 1))$$,'independent reviewer approves');
select lives_ok($$select customer_api.provision_building_setup_v1('81500000-0000-0000-0000-000000000002',(select id from platform.building_setup_runs limit 1))$$,'approved setup provisions atomically');
select ok((select count(*) from portfolio.properties where tenant_id='81200000-0000-0000-0000-000000000001')=1,'one property provisioned');
select ok((select count(*) from portfolio.buildings where tenant_id='81200000-0000-0000-0000-000000000001')=1,'one building provisioned');
select ok((select count(*) from portfolio.units where tenant_id='81200000-0000-0000-0000-000000000001')=2,'two units provisioned');
select ok((select count(*) from finance.accounting_periods where tenant_id='81200000-0000-0000-0000-000000000001' and status='open')=1,'one open period provisioned');
select ok((select count(*) from platform.workspace_property_bindings where customer_workspace_id='81400000-0000-0000-0000-000000000001' and status='active')=1,'provision binds property to workspace');
select ok((select count(*) from identity.context_grants where membership_id='81300000-0000-0000-0000-000000000001' and scope_type='property')=1,'original operator gains property context');
select ok((select count(*) from identity.context_grants where membership_id='81300000-0000-0000-0000-000000000002' and scope_type='property')=0,'reviewer gains no property context');
select lives_ok($$select customer_api.provision_building_setup_v1('81500000-0000-0000-0000-000000000002',(select id from platform.building_setup_runs limit 1))$$,'provision retry is deterministic');
select ok((select count(*) from platform.workspace_property_bindings where customer_workspace_id='81400000-0000-0000-0000-000000000001' and status='active')=1,'retry creates no duplicate binding');
select ok((select count(*) from finance.journals where tenant_id='81200000-0000-0000-0000-000000000001')=0,'setup and rehearsal emit no journal');

select set_config('request.jwt.claims','{"sub":"81100000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"81200000-0000-0000-0000-000000000001","active_context_id":"81500000-0000-0000-0000-000000000001"}',true);
select lives_ok($$select customer_api.create_building_setup_v1('81500000-0000-0000-0000-000000000001','SETUP-081-UNBALANCED','{"association":{"name":"Synthetic Unbalanced"},"building":{"name":"Other","code":"B","floors":1},"currency":"RON","period_start":"2026-02-01","period_end":"2026-02-28","units":[{"code":"1"}],"opening_balances":[{"side":"debit","amount":10}]}'::jsonb)$$,'unbalanced synthetic draft can be previewed');
select throws_ok($$select customer_api.rehearse_building_setup_v1('81500000-0000-0000-0000-000000000001',(select id from platform.building_setup_runs where idempotency_key='SETUP-081-UNBALANCED'))$$,'22023','opening_balance_rehearsal_not_zero','non-zero opening rehearsal fails closed');

select * from finish();
rollback;
