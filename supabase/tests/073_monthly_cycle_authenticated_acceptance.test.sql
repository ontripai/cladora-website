-- Test 073: Authenticated canonical monthly-cycle acceptance
-- All synthetic identities and domain writes are transaction-bound and rolled back.
begin;
select plan(19);

do $$
declare
  v_read uuid := (select id from identity.permissions where code='finance.monthly.read');
  v_manage uuid := (select id from identity.permissions where code='finance.monthly.manage');
  v_review uuid := (select id from identity.permissions where code='finance.monthly.review');
  v_close uuid := (select id from identity.permissions where code='finance.periods.close');
begin
  insert into auth.users(id,email) values
    ('73000000-0000-0000-0000-000000000001','monthly-admin@cladora.test'),
    ('73000000-0000-0000-0000-000000000002','monthly-president@cladora.test'),
    ('73000000-0000-0000-0000-000000000003','monthly-censor@cladora.test');
  insert into platform.tenants(id,legal_name,registration_number,status)
  values('73100000-0000-0000-0000-000000000001','Synthetic Monthly Acceptance','RO-MONTHLY-073','active');
  insert into platform.customer_workspaces(id,tenant_id,workspace_type,lifecycle_status,commercial_owner,environment,version)
  values('73200000-0000-0000-0000-000000000001','73100000-0000-0000-0000-000000000001','ASSOCIATION','ACTIVE','Test 073','PILOT',1);
  insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value)
  values('73200000-0000-0000-0000-000000000001','module.accounting','boolean',true);
  insert into portfolio.properties(id,tenant_id,type,name,base_currency,status)
  values('73300000-0000-0000-0000-000000000001','73100000-0000-0000-0000-000000000001','condominium','Synthetic Monthly Property','RON','active');
  insert into finance.accounting_periods(id,tenant_id,property_id,starts_on,ends_on,status)
  values('73300000-0000-0000-0000-000000000002','73100000-0000-0000-0000-000000000001','73300000-0000-0000-0000-000000000001','2026-08-01','2026-08-31','open');
  insert into finance.allocation_runs(id,tenant_id,property_id,period_start,period_end,currency,status)
  values('73300000-0000-0000-0000-000000000003','73100000-0000-0000-0000-000000000001','73300000-0000-0000-0000-000000000001','2026-08-01','2026-09-01','RON','draft');
  update finance.allocation_runs set status='approved',approved_at=statement_timestamp(),approved_by='73000000-0000-0000-0000-000000000001' where id='73300000-0000-0000-0000-000000000003';

  insert into identity.roles(id,tenant_id,code,name) values
    ('73400000-0000-0000-0000-000000000001','73100000-0000-0000-0000-000000000001','association_admin','Monthly Administrator'),
    ('73400000-0000-0000-0000-000000000002','73100000-0000-0000-0000-000000000001','president','Monthly President'),
    ('73400000-0000-0000-0000-000000000003','73100000-0000-0000-0000-000000000001','censor','Monthly Censor');
  insert into identity.role_permissions(role_id,permission_id,effect) values
    ('73400000-0000-0000-0000-000000000001',v_read,'allow'),
    ('73400000-0000-0000-0000-000000000001',v_manage,'allow'),
    ('73400000-0000-0000-0000-000000000001',v_review,'allow'),
    ('73400000-0000-0000-0000-000000000001',v_close,'allow'),
    ('73400000-0000-0000-0000-000000000002',v_read,'allow'),
    ('73400000-0000-0000-0000-000000000002',v_review,'allow'),
    ('73400000-0000-0000-0000-000000000003',v_read,'allow'),
    ('73400000-0000-0000-0000-000000000003',v_review,'allow');
  insert into identity.memberships(id,tenant_id,user_id,role_id,status) values
    ('73500000-0000-0000-0000-000000000001','73100000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000001','73400000-0000-0000-0000-000000000001','active'),
    ('73500000-0000-0000-0000-000000000002','73100000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000002','73400000-0000-0000-0000-000000000002','active'),
    ('73500000-0000-0000-0000-000000000003','73100000-0000-0000-0000-000000000001','73000000-0000-0000-0000-000000000003','73400000-0000-0000-0000-000000000003','active');
  insert into identity.context_grants(id,membership_id,tenant_id,scope_type) values
    ('73600000-0000-0000-0000-000000000001','73500000-0000-0000-0000-000000000001','73100000-0000-0000-0000-000000000001','tenant'),
    ('73600000-0000-0000-0000-000000000002','73500000-0000-0000-0000-000000000002','73100000-0000-0000-0000-000000000001','tenant'),
    ('73600000-0000-0000-0000-000000000003','73500000-0000-0000-0000-000000000003','73100000-0000-0000-0000-000000000001','tenant');
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"73000000-0000-0000-0000-000000000001","aal":"aal1","active_tenant_id":"73100000-0000-0000-0000-000000000001"}',true);
select throws_ok($$select customer_api.create_monthly_cycle_v1('73600000-0000-0000-0000-000000000001','73300000-0000-0000-0000-000000000001','73300000-0000-0000-0000-000000000002','RON')$$,'42501','mfa_required','AAL1 cannot create cycle');

select set_config('request.jwt.claims','{"sub":"73000000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"73100000-0000-0000-0000-000000000001"}',true);
select ok((select set_config('test.monthly_cycle_id',j->>'id',true) is not null and j->>'status'='collecting' from (select customer_api.create_monthly_cycle_v1('73600000-0000-0000-0000-000000000001','73300000-0000-0000-0000-000000000001','73300000-0000-0000-0000-000000000002','RON') j)s),'administrator creates collecting cycle');
select ok(jsonb_array_length(customer_api.list_monthly_cycles_v1('73600000-0000-0000-0000-000000000001','73300000-0000-0000-0000-000000000001')->'cycles')=1,'scoped list returns cycle');
select ok((customer_api.capture_monthly_cycle_source_v1('73600000-0000-0000-0000-000000000001',current_setting('test.monthly_cycle_id')::uuid,'allocation_run','73300000-0000-0000-0000-000000000003')->>'source_hash')~'^[0-9a-f]{64}$','approved allocation snapshot captured');
select ok((customer_api.submit_monthly_cycle_v1('73600000-0000-0000-0000-000000000001',current_setting('test.monthly_cycle_id')::uuid,'73300000-0000-0000-0000-000000000003')->>'status')='pending_review','cycle submitted for review');
select throws_ok($$select customer_api.close_accounting_period_v1('73600000-0000-0000-0000-000000000001','73300000-0000-0000-0000-000000000002','bypass')$$,'42501',null,'legacy direct-close gateway denied');
select throws_ok(format($$select customer_api.publish_monthly_cycle_v1('73600000-0000-0000-0000-000000000001','%s')$$,current_setting('test.monthly_cycle_id')),'42501','president_and_censor_approval_required','publication denied before reviews');

select set_config('request.jwt.claims','{"sub":"73000000-0000-0000-0000-000000000002","aal":"aal2","active_tenant_id":"73100000-0000-0000-0000-000000000001"}',true);
select ok((customer_api.review_monthly_cycle_v1('73600000-0000-0000-0000-000000000002',current_setting('test.monthly_cycle_id')::uuid,'approved','President review')->>'reviewer_role')='president','president independently approves');

select set_config('request.jwt.claims','{"sub":"73000000-0000-0000-0000-000000000003","aal":"aal2","active_tenant_id":"73100000-0000-0000-0000-000000000001"}',true);
select ok((customer_api.review_monthly_cycle_v1('73600000-0000-0000-0000-000000000003',current_setting('test.monthly_cycle_id')::uuid,'approved','Censor review')->>'reviewer_role')='censor','censor independently approves');
select ok(((customer_api.list_monthly_cycles_v1('73600000-0000-0000-0000-000000000003','73300000-0000-0000-0000-000000000001')->'cycles'->0->>'approved_reviews')::int)=2,'exactly two independent reviews recorded');

select set_config('request.jwt.claims','{"sub":"73000000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"73100000-0000-0000-0000-000000000001"}',true);
select ok((customer_api.publish_monthly_cycle_v1('73600000-0000-0000-0000-000000000001',current_setting('test.monthly_cycle_id')::uuid)->>'status')='close_ready','approved cycle publishes');
select ok((customer_api.list_monthly_cycles_v1('73600000-0000-0000-0000-000000000001','73300000-0000-0000-0000-000000000001')->'cycles'->0->>'snapshot_hash')~'^[0-9a-f]{64}$','publication has SHA-256 evidence');
select throws_ok($$update finance.monthly_cycle_publications set snapshot_json='{}' where tenant_id='73100000-0000-0000-0000-000000000001'$$,'42501',null,'authenticated cannot mutate publication directly');
select ok((finance.get_ar_subledger_parity('73100000-0000-0000-0000-000000000001','73300000-0000-0000-0000-000000000001','RON')->>'is_continuous_parity')::boolean,'zero-value GL/subledger parity remains exact');
select ok((customer_api.close_monthly_cycle_v1('73600000-0000-0000-0000-000000000001',current_setting('test.monthly_cycle_id')::uuid,'Synthetic Test 073 close')->>'monthly_cycle_status')='closed','canonical cycle closes accounting period');
reset role;
select ok((select status::text from finance.accounting_periods where id='73300000-0000-0000-0000-000000000002')='closed','accounting period is authoritatively closed');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"73000000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"73100000-0000-0000-0000-000000000001"}',true);
select ok((customer_api.list_monthly_cycles_v1('73600000-0000-0000-0000-000000000001','73300000-0000-0000-0000-000000000001')->'cycles'->0->>'status')='closed','monthly cycle is closed');
reset role;
select ok((select count(*) from finance.monthly_cycle_publications where tenant_id='73100000-0000-0000-0000-000000000001')=1,'exactly one immutable publication exists');
select ok((select count(*) from auth.users where email like 'monthly-%@cladora.test')=3,'only three transaction-bound synthetic actors exist before rollback');

select * from finish();
rollback;
