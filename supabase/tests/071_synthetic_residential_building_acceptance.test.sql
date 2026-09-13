-- Test 071: Synthetic residential building acceptance
-- Full customer_api lifecycle; all fixtures and canonical writes roll back.
begin;
select plan(11);

do $$
declare
  v_manage uuid;
  v_approve uuid;
begin
  insert into auth.users(id,email) values
    ('71000000-0000-0000-0000-000000000001','pilot-manager@cladora.test'),
    ('71000000-0000-0000-0000-000000000002','pilot-approver@cladora.test');

  insert into platform.tenants(id,legal_name,registration_number,status)
  values('71100000-0000-0000-0000-000000000001','Synthetic Residential Pilot','RO-PILOT-071','active');
  insert into platform.customer_workspaces(id,tenant_id,workspace_type,lifecycle_status,commercial_owner,environment,version)
  values('71200000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000001','ASSOCIATION','PROVISIONING','Test 071','PILOT',1);
  insert into portfolio.properties(id,tenant_id,type,name,base_currency,status)
  values('71300000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000001','condominium','Synthetic Property','RON','draft');
  insert into finance.accounting_periods(tenant_id,property_id,starts_on,ends_on,status)
  values('71100000-0000-0000-0000-000000000001','71300000-0000-0000-0000-000000000001','2026-09-01','2026-09-30','open');

  insert into identity.roles(id,tenant_id,code,name) values
    ('71400000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000001','property_manager','Pilot Manager'),
    ('71400000-0000-0000-0000-000000000002','71100000-0000-0000-0000-000000000001','association_admin','Pilot Approver');
  select id into v_manage from identity.permissions where code='onboarding.import.manage';
  select id into v_approve from identity.permissions where code='onboarding.import.approve';
  insert into identity.role_permissions(role_id,permission_id,effect) values
    ('71400000-0000-0000-0000-000000000001',v_manage,'allow'),
    ('71400000-0000-0000-0000-000000000002',v_approve,'allow');
  insert into identity.memberships(id,tenant_id,user_id,role_id,status) values
    ('71500000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','71400000-0000-0000-0000-000000000001','active'),
    ('71500000-0000-0000-0000-000000000002','71100000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','71400000-0000-0000-0000-000000000002','active');
  insert into identity.context_grants(id,membership_id,tenant_id,scope_type) values
    ('71600000-0000-0000-0000-000000000001','71500000-0000-0000-0000-000000000001','71100000-0000-0000-0000-000000000001','tenant'),
    ('71600000-0000-0000-0000-000000000002','71500000-0000-0000-0000-000000000002','71100000-0000-0000-0000-000000000001','tenant');
end $$;

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000002","aal":"aal2","active_tenant_id":"71100000-0000-0000-0000-000000000001"}',true);

do $$
declare x record;
begin
  for x in select * from (values
    ('building','Buildings',10),('entrance','Entrances',20),('unit','Units',30),
    ('party','Parties',40),('ownership','Ownerships',50),('occupancy','Occupancies',60),
    ('account','Accounts',70),('meter','Meters',80),('meter_reading','Readings',90),
    ('opening_gl','Opening GL',100),('open_receivable','Receivables',110)
  ) v(code,name,dependency_order) loop
    perform customer_api.configure_import_template_v1(
      '71600000-0000-0000-0000-000000000002',x.code,x.name,'Pilot',x.dependency_order,'{}',100
    );
  end loop;
end $$;

select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"71100000-0000-0000-0000-000000000001"}',true);
select ok((customer_api.create_import_run_v1('71600000-0000-0000-0000-000000000001','71300000-0000-0000-0000-000000000001','PILOT-071-IDEMPOTENCY')->>'status')='draft','run created');

do $$
declare r uuid := (select id from platform.import_runs where idempotency_key='PILOT-071-IDEMPOTENCY');
begin
  perform customer_api.add_import_source_v1('71600000-0000-0000-0000-000000000001',r,'building','building.csv','text/csv',100,repeat('1',64),'[{"source_key":"b1","code":"B1","name":"Bloc Pilot","year_built":"1980","floors":"4"}]');
  perform customer_api.add_import_source_v1('71600000-0000-0000-0000-000000000001',r,'entrance','entrance.csv','text/csv',100,repeat('2',64),'[{"source_key":"e1","dependency_key":"b1","building_key":"b1","code":"E1","name":"Scara A"}]');
  perform customer_api.add_import_source_v1('71600000-0000-0000-0000-000000000001',r,'unit','unit.csv','text/csv',100,repeat('3',64),'[{"source_key":"u101","dependency_key":"b1","building_key":"b1","entrance_key":"e1","code":"101","floor":"1","area_m2":"62.5","bedrooms":"2"}]');
  perform customer_api.add_import_source_v1('71600000-0000-0000-0000-000000000001',r,'party','party.csv','text/csv',100,repeat('4',64),'[{"source_key":"p1","legal_name":"Synthetic Owner","type":"person"}]');
  perform customer_api.add_import_source_v1('71600000-0000-0000-0000-000000000001',r,'ownership','ownership.csv','text/csv',100,repeat('5',64),'[{"source_key":"own1","dependency_key":"u101","unit_key":"u101","party_key":"p1","share":"1","valid_from":"2026-09-01"}]');
  perform customer_api.add_import_source_v1('71600000-0000-0000-0000-000000000001',r,'occupancy','occupancy.csv','text/csv',100,repeat('6',64),'[{"source_key":"occ1","dependency_key":"u101","unit_key":"u101","party_key":"p1","kind":"owner","starts_at":"2026-09-01T00:00:00Z","role":"owner"}]');
  perform customer_api.add_import_source_v1('71600000-0000-0000-0000-000000000001',r,'account','accounts.csv','text/csv',100,repeat('7',64),'[{"source_key":"4111","code":"4111","name":"Receivables","type":"asset","currency":"RON","is_control_account":"true"},{"source_key":"300","code":"300","name":"Opening equity","type":"equity","currency":"RON"}]');
  perform customer_api.add_import_source_v1('71600000-0000-0000-0000-000000000001',r,'meter','meter.csv','text/csv',100,repeat('8',64),'[{"source_key":"m1","dependency_key":"u101","unit_key":"u101","service_type":"water","scope":"unit","serial_fingerprint":"pilot-meter-071","unit_code":"m3","installed_on":"2026-09-01"}]');
  perform customer_api.add_import_source_v1('71600000-0000-0000-0000-000000000001',r,'meter_reading','reading.csv','text/csv',100,repeat('9',64),'[{"source_key":"mr1","dependency_key":"m1","meter_key":"m1","reading_at":"2026-09-01T08:00:00Z","reading_value":"12.5"}]');
  perform customer_api.add_import_source_v1('71600000-0000-0000-0000-000000000001',r,'opening_gl','opening.csv','text/csv',100,repeat('a',64),'[{"source_key":"gl1","dependency_key":"4111","account_key":"4111","unit_key":"u101","party_key":"p1","occurred_on":"2026-09-01","side":"debit","amount":"100","memo":"Opening AR"},{"source_key":"gl2","dependency_key":"300","account_key":"300","occurred_on":"2026-09-01","side":"credit","amount":"100","memo":"Opening equity"}]');
  perform customer_api.add_import_source_v1('71600000-0000-0000-0000-000000000001',r,'open_receivable','receivable.csv','text/csv',100,repeat('b',64),'[{"source_key":"ar1","dependency_key":"u101","unit_key":"u101","party_key":"p1","period_start":"2026-08-01","period_end":"2026-08-31","due_on":"2026-09-15","currency":"RON","amount":"100","description":"Opening charge"}]');
end $$;

select ok((customer_api.validate_import_v1('71600000-0000-0000-0000-000000000001',(select id from platform.import_runs where idempotency_key='PILOT-071-IDEMPOTENCY'))->>'status')='preview_ready','all staged rows validate');
select ok((customer_api.dry_run_import_v1('71600000-0000-0000-0000-000000000001',(select id from platform.import_runs where idempotency_key='PILOT-071-IDEMPOTENCY'))->>'canonical_writes')::integer=0,'dry-run writes no canonical rows');
select ok((customer_api.submit_import_v1('71600000-0000-0000-0000-000000000001',(select id from platform.import_runs where idempotency_key='PILOT-071-IDEMPOTENCY'))->>'status')='pending_approval','manager submits import');

select set_config('request.jwt.claims','{"sub":"71000000-0000-0000-0000-000000000002","aal":"aal2","active_tenant_id":"71100000-0000-0000-0000-000000000001"}',true);
select ok((customer_api.approve_import_commit_v1('71600000-0000-0000-0000-000000000002',(select id from platform.import_runs where idempotency_key='PILOT-071-IDEMPOTENCY'))->>'status')='reconciled','independent approver commits and reconciles');
select ok((select is_balanced from platform.import_reconciliation_results where run_id=(select id from platform.import_runs where idempotency_key='PILOT-071-IDEMPOTENCY')),'opening ledger and receivables reconcile');
select ok((select count(*) from platform.import_entity_mappings where run_id=(select id from platform.import_runs where idempotency_key='PILOT-071-IDEMPOTENCY'))=13,'all canonical writes retain trace mappings');
select ok((customer_api.activate_import_v1('71600000-0000-0000-0000-000000000002',(select id from platform.import_runs where idempotency_key='PILOT-071-IDEMPOTENCY'))->>'status')='activated','reconciled import activates');
select ok((select count(*) from platform.import_entity_mappings where run_id=(select id from platform.import_runs where idempotency_key='PILOT-071-IDEMPOTENCY') and entity_type='unit')=1,'one canonical unit mapping created');
select ok((select count(*) from platform.import_entity_mappings where run_id=(select id from platform.import_runs where idempotency_key='PILOT-071-IDEMPOTENCY') and entity_type='meter_reading')=1,'one canonical meter reading mapping created');
select ok((select (evidence_json->>'ar_delta')::numeric=0 and total_debits=100 and total_credits=100 from platform.import_reconciliation_results where run_id=(select id from platform.import_runs where idempotency_key='PILOT-071-IDEMPOTENCY')),'opening receivable parity preserved');

select * from finish();
rollback;
