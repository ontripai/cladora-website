-- Synthetic reference data only. User rows are intentionally excluded because auth.users is environment-owned.
insert into platform.tenants(id,legal_name,registration_number,status)
values ('00000000-0000-7000-8000-000000000001','CLADORA Synthetic Tenant A','SYNTH-A','active'),
       ('00000000-0000-7000-8000-000000000002','CLADORA Synthetic Tenant B','SYNTH-B','active')
on conflict do nothing;

insert into identity.roles(id,tenant_id,code,name,is_system) values
('10000000-0000-7000-8000-000000000001',null,'resident','Resident',true),
('10000000-0000-7000-8000-000000000002',null,'owner','Owner',true),
('10000000-0000-7000-8000-000000000003',null,'manager','Manager',true),
('10000000-0000-7000-8000-000000000004',null,'auditor','Auditor',true),
('10000000-0000-7000-8000-000000000005',null,'support','Support',true)
on conflict do nothing;

insert into portfolio.addresses(id,tenant_id,country_code,city,street,building_no) values
('20000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','RO','București','Strada Sintetică','1'),
('20000000-0000-7000-8000-000000000002','00000000-0000-7000-8000-000000000002','RO','Cluj-Napoca','Strada Sintetică','2') on conflict do nothing;
insert into portfolio.properties(id,tenant_id,type,name,address_id,status) values
('30000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','condominium','Synthetic Property A','20000000-0000-7000-8000-000000000001','active'),
('30000000-0000-7000-8000-000000000002','00000000-0000-7000-8000-000000000002','condominium','Synthetic Property B','20000000-0000-7000-8000-000000000002','active') on conflict do nothing;
insert into portfolio.buildings(id,tenant_id,property_id,code,name,status) values
('40000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','30000000-0000-7000-8000-000000000001','A','Building A','active'),
('40000000-0000-7000-8000-000000000002','00000000-0000-7000-8000-000000000002','30000000-0000-7000-8000-000000000002','B','Building B','active') on conflict do nothing;
insert into portfolio.units(id,tenant_id,building_id,code,floor,area_m2) values
('50000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','40000000-0000-7000-8000-000000000001','A-01',1,75),
('50000000-0000-7000-8000-000000000002','00000000-0000-7000-8000-000000000002','40000000-0000-7000-8000-000000000002','B-01',1,80) on conflict do nothing;

insert into finance.accounts(id,tenant_id,property_id,code,name,type,currency) values
('60000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','30000000-0000-7000-8000-000000000001','4110','Resident receivables','asset','RON'),
('60000000-0000-7000-8000-000000000002','00000000-0000-7000-8000-000000000001','30000000-0000-7000-8000-000000000001','5120','Bank','asset','RON'),
('60000000-0000-7000-8000-000000000003','00000000-0000-7000-8000-000000000001','30000000-0000-7000-8000-000000000001','6050','Utilities expense','expense','RON'),
('60000000-0000-7000-8000-000000000004','00000000-0000-7000-8000-000000000001','30000000-0000-7000-8000-000000000001','7040','Recoverable charges','income','RON')
on conflict do nothing;

insert into finance.charge_categories(id,tenant_id,code,name,default_expense_account_id) values
('70000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','WATER','Water','60000000-0000-7000-8000-000000000003'),
('70000000-0000-7000-8000-000000000002','00000000-0000-7000-8000-000000000001','ELECTRICITY','Electricity','60000000-0000-7000-8000-000000000003'),
('70000000-0000-7000-8000-000000000003','00000000-0000-7000-8000-000000000001','GAS','Gas','60000000-0000-7000-8000-000000000003')
on conflict do nothing;

insert into utilities.providers(id,tenant_id,legal_name,tax_number,service_types) values
('80000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','Synthetic Utility Provider','SYNTH-UTILITY',array['water','electricity','gas']::utilities.service_type[])
on conflict do nothing;
insert into utilities.supply_contracts(id,tenant_id,property_id,building_id,provider_id,service_type,starts_on) values
('81000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','30000000-0000-7000-8000-000000000001','40000000-0000-7000-8000-000000000001','80000000-0000-7000-8000-000000000001','water',current_date-365)
on conflict do nothing;
insert into utilities.meters(id,tenant_id,property_id,building_id,service_type,scope,serial_number_encrypted,serial_fingerprint,unit_code) values
('82000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','30000000-0000-7000-8000-000000000001','40000000-0000-7000-8000-000000000001','water','building','synthetic-serial','synth-meter-water','m3')
on conflict do nothing;

insert into assets.asset_categories(id,tenant_id,code,name) values
('83000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','LIFT','Lift'),
('83000000-0000-7000-8000-000000000002','00000000-0000-7000-8000-000000000001','BOILER','Boiler')
on conflict do nothing;
insert into assets.assets(id,tenant_id,category_id,property_id,building_id,scope,asset_code,name,criticality) values
('84000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','83000000-0000-7000-8000-000000000001','30000000-0000-7000-8000-000000000001','40000000-0000-7000-8000-000000000001','building','LIFT-A-01','Synthetic Lift A',5)
on conflict do nothing;
insert into maintenance.maintenance_plans(id,tenant_id,asset_id,name,trigger_type,recurrence_rule,checklist_template,next_due_at) values
('85000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','84000000-0000-7000-8000-000000000001','Monthly lift inspection','calendar','{"frequency":"monthly","interval":1}'::jsonb,'[{"label":"Emergency brake","required":true},{"label":"Door sensor","required":true}]'::jsonb,date_trunc('month',statement_timestamp())+interval '1 month')
on conflict do nothing;

insert into governance.meetings(id,tenant_id,property_id,title,meeting_type,scheduled_at,quorum_rule,status) values
('86000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','30000000-0000-7000-8000-000000000001','Synthetic Annual General Meeting','annual',statement_timestamp()+interval '30 days','{"basis":"ownership_weight","minimum":0.5}'::jsonb,'draft')
on conflict do nothing;
insert into communications.channels(id,tenant_id,property_id,scope,name) values
('87000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','30000000-0000-7000-8000-000000000001','property','Synthetic Property Feed')
on conflict do nothing;
insert into documents.folders(id,tenant_id,property_id,name,classification) values
('88000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','30000000-0000-7000-8000-000000000001','Governance','confidential')
on conflict do nothing;
insert into migration_hub.projects(id,tenant_id,property_id,name,source_system,status) values
('89000000-0000-7000-8000-000000000001','00000000-0000-7000-8000-000000000001','30000000-0000-7000-8000-000000000001','Synthetic Legacy Migration','synthetic_legacy','draft')
on conflict do nothing;
