begin;
select plan(60);

select has_schema('airprop','AIRPROP schema exists');
select has_table('airprop','investment_opportunities','opportunity aggregate exists');
select has_table('airprop','underwriting_cases','underwriting case exists');
select has_table('airprop','underwriting_versions','immutable underwriting versions exist');
select has_table('airprop','property_interests','whole-property interests exist');
select has_table('airprop','property_operating_models','effective operating models exist');
select has_function('customer_api','create_airprop_opportunity_v1',array['uuid','text','jsonb'],'opportunity gateway exists');
select has_function('customer_api','add_airprop_underwriting_version_v1',array['uuid','uuid','jsonb'],'underwriting gateway exists');
select has_function('customer_api','configure_airprop_property_v1',array['uuid','uuid','uuid','airprop.interest_kind','numeric','airprop.operating_model_kind','date','text','text'],'property configuration gateway exists');
select ok(not has_function_privilege('anon','customer_api.create_airprop_opportunity_v1(uuid,text,jsonb)','execute'),'anonymous gateway access denied');
select ok(not(select prosecdef from pg_proc where oid='customer_api.create_airprop_opportunity_v1(uuid,text,jsonb)'::regprocedure),'public gateway is security invoker');
select ok(not has_table_privilege('authenticated','airprop.investment_opportunities','insert'),'authenticated direct opportunity writes denied');

insert into auth.users(id,email) values
 ('86100000-0000-0000-0000-000000000001','airprop-author-086@cladora.test'),
 ('86100000-0000-0000-0000-000000000002','airprop-other-086@cladora.test');
insert into platform.tenants(id,legal_name,registration_number,status) values
 ('86200000-0000-0000-0000-000000000001','AIRPROP Bucharest Synthetic','AIRPROP-086-A','active'),
 ('86200000-0000-0000-0000-000000000002','AIRPROP Isolation Synthetic','AIRPROP-086-B','active');
insert into identity.memberships(id,tenant_id,user_id,role_id,status)
select x.id,x.tenant_id,x.user_id,r.id,'active' from(values
 ('86300000-0000-0000-0000-000000000001'::uuid,'86200000-0000-0000-0000-000000000001'::uuid,'86100000-0000-0000-0000-000000000001'::uuid),
 ('86300000-0000-0000-0000-000000000002'::uuid,'86200000-0000-0000-0000-000000000002'::uuid,'86100000-0000-0000-0000-000000000002'::uuid)
)x(id,tenant_id,user_id) cross join identity.roles r where r.tenant_id is null and r.code='airprop_portfolio_director';
insert into portfolio.addresses(id,tenant_id,country_code,county,city,street,building_no) values
 ('86500000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','RO','București','București','Strada Pilot','86'),
 ('86500000-0000-0000-0000-000000000002','86200000-0000-0000-0000-000000000002','RO','București','București','Strada Control','86');
insert into portfolio.properties(id,tenant_id,type,name,address_id,base_currency,status) values
 ('86600000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','villa','AIRPROP Synthetic Bucharest Asset','86500000-0000-0000-0000-000000000001','RON','active'),
 ('86600000-0000-0000-0000-000000000002','86200000-0000-0000-0000-000000000002','villa','AIRPROP Isolation Asset','86500000-0000-0000-0000-000000000002','RON','active');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('86700000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','company','AIRPROP Synthetic Owner SRL'),
 ('86700000-0000-0000-0000-000000000002','86200000-0000-0000-0000-000000000002','company','AIRPROP Isolation Owner SRL');

insert into identity.context_grants(id,membership_id,tenant_id,scope_type,property_id) values
 ('86400000-0000-0000-0000-000000000001','86300000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','property','86600000-0000-0000-0000-000000000001'),
 ('86400000-0000-0000-0000-000000000002','86300000-0000-0000-0000-000000000002','86200000-0000-0000-0000-000000000002','property','86600000-0000-0000-0000-000000000002');


insert into platform.customer_workspaces(id,tenant_id,workspace_type,commercial_owner,environment,lifecycle_status) values
 ('86000000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','ASSOCIATION','AIRPROP Synthetic A','PILOT','ACTIVE'),
 ('86000000-0000-0000-0000-000000000002','86200000-0000-0000-0000-000000000002','ASSOCIATION','AIRPROP Synthetic B','PILOT','ACTIVE');
insert into platform.workspace_property_bindings(tenant_id,customer_workspace_id,property_id,status,binding_source) values
 ('86200000-0000-0000-0000-000000000001','86000000-0000-0000-0000-000000000001','86600000-0000-0000-0000-000000000001','active','platform_assignment'),
 ('86200000-0000-0000-0000-000000000002','86000000-0000-0000-0000-000000000002','86600000-0000-0000-0000-000000000002','active','platform_assignment');
insert into platform.workspace_taxonomy_assignments(tenant_id,customer_workspace_id,property_profile_id,operating_model_id,status,created_by,country_code)
select w.tenant_id,w.id,p.id,m.id,'active',x.actor_id,'RO'
from platform.customer_workspaces w
join(values('86000000-0000-0000-0000-000000000001'::uuid,'86100000-0000-0000-0000-000000000001'::uuid),
 ('86000000-0000-0000-0000-000000000002'::uuid,'86100000-0000-0000-0000-000000000002'::uuid))x(workspace_id,actor_id) on x.workspace_id=w.id
cross join platform.property_profiles p cross join platform.operating_models m
where p.code='residential_condominium' and p.version=1 and m.code='association_managed' and m.version=1;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select w.tenant_id,w.id,m.id,m.code,'active','Synthetic AIRPROP command fixture'
from platform.customer_workspaces w cross join platform.module_definitions m
where w.id in('86000000-0000-0000-0000-000000000001','86000000-0000-0000-0000-000000000002')
and m.code='airprop_commercial' and m.version=1;
insert into platform.workspace_entitlements(customer_workspace_id,entitlement_key,value_type,boolean_value)
values('86000000-0000-0000-0000-000000000001','module.airprop_commercial','boolean',true),
 ('86000000-0000-0000-0000-000000000002','module.airprop_commercial','boolean',true);

insert into portfolio.buildings(id,tenant_id,property_id,code,name) values
 ('86800000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','86600000-0000-0000-0000-000000000001','A086','AIRPROP Synthetic Building');
insert into portfolio.units(id,tenant_id,building_id,code) values
 ('86900000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','86800000-0000-0000-0000-000000000001','U086');
insert into identity.context_grants(id,membership_id,tenant_id,scope_type,building_id,unit_id) values
 ('86400000-0000-0000-0000-000000000004','86300000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','building','86800000-0000-0000-0000-000000000001',null),
 ('86400000-0000-0000-0000-000000000005','86300000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','unit',null,'86900000-0000-0000-0000-000000000001');

insert into identity.context_grants(id,membership_id,tenant_id,scope_type,property_id) values
 ('86400000-0000-0000-0000-000000000003','86300000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','property','86600000-0000-0000-0000-000000000001');

select ok(not has_function_privilege('anon','app_private.require_airprop_context_v1(uuid,text,uuid)','execute'),'anonymous cannot execute AIRPROP context helper');
select ok(not has_function_privilege('authenticated','app_private.require_airprop_context_v1(uuid,text,uuid)','execute'),'authenticated cannot execute AIRPROP context helper directly');
select ok(not has_function_privilege('service_role','app_private.require_airprop_context_v1(uuid,text,uuid)','execute'),'service role cannot execute AIRPROP context helper directly');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"86100000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"86200000-0000-0000-0000-000000000001","active_context_id":"86400000-0000-0000-0000-000000000001"}',true);
select lives_ok($$select customer_api.create_airprop_opportunity_v1('86400000-0000-0000-0000-000000000001','AIRPROP-086-OPP','{"name":"Synthetic Bucharest Acquisition","country_code":"RO","city":"București","asking_price":750000,"currency":"RON","property_id":"86600000-0000-0000-0000-000000000001","source_ref":"SYNTHETIC-086"}'::jsonb)$$,'AAL2 actor creates Romania opportunity');
select ok((select count(*) from airprop.investment_opportunities)=1,'one opportunity written');

select is((select workspace_id::text from airprop.investment_opportunities limit 1),'86000000-0000-0000-0000-000000000001','command persists the trusted workspace identity');
reset role;
select throws_ok($$update airprop.investment_opportunities set workspace_id='86000000-0000-0000-0000-000000000002' where tenant_id='86200000-0000-0000-0000-000000000001'$$,'55000','airprop_opportunity_scope_immutable','ordinary updates cannot move an opportunity to another workspace');
select throws_ok($$update airprop.investment_opportunities set property_id=null where tenant_id='86200000-0000-0000-0000-000000000001'$$,'55000','airprop_opportunity_scope_immutable','ordinary updates cannot remove persisted subject scope');
select throws_ok($$insert into airprop.investment_opportunities(tenant_id,workspace_id,idempotency_key,name,country_code,city,asking_price,currency,input_hash,created_by)
values('86200000-0000-0000-0000-000000000001','86000000-0000-0000-0000-000000000002','AIRPROP-086-BADWS','Wrong tenant workspace','RO','București',1000,'RON','hash','86100000-0000-0000-0000-000000000001')$$,'23503',null,'database rejects workspace and tenant mismatch');
select throws_ok($$insert into airprop.investment_opportunities(tenant_id,workspace_id,idempotency_key,name,country_code,city,asking_price,currency,input_hash,created_by)
values('86200000-0000-0000-0000-000000000001','86000000-0000-0000-0000-000000000099','AIRPROP-086-NOWS','Missing workspace','RO','București',1000,'RON','hash','86100000-0000-0000-0000-000000000001')$$,'23503',null,'database rejects nonexistent workspace');
set local role authenticated;

select lives_ok($$select customer_api.create_airprop_opportunity_v1('86400000-0000-0000-0000-000000000001','AIRPROP-086-OPP','{"name":"Synthetic Bucharest Acquisition","country_code":"RO","city":"București","asking_price":750000,"currency":"RON","property_id":"86600000-0000-0000-0000-000000000001","source_ref":"SYNTHETIC-086"}'::jsonb)$$,'opportunity retry is idempotent');
select ok((select count(*) from airprop.investment_opportunities)=1,'retry creates no duplicate');
select throws_ok($$select customer_api.create_airprop_opportunity_v1('86400000-0000-0000-0000-000000000001','AIRPROP-086-OPP','{"name":"Changed","country_code":"RO","city":"București","asking_price":760000,"currency":"RON","property_id":"86600000-0000-0000-0000-000000000001"}'::jsonb)$$,'22023','airprop_idempotency_payload_mismatch','changed retry rejected');
select lives_ok($$select customer_api.add_airprop_underwriting_version_v1('86400000-0000-0000-0000-000000000001',(select id from airprop.investment_opportunities limit 1),'{"acquisition_cost":750000,"annual_rent":72000,"annual_opex":18000,"currency":"RON"}'::jsonb)$$,'first deterministic underwriting version created');
select lives_ok($$select customer_api.add_airprop_underwriting_version_v1('86400000-0000-0000-0000-000000000001',(select id from airprop.investment_opportunities limit 1),'{"acquisition_cost":750000,"annual_rent":78000,"annual_opex":19000,"currency":"RON"}'::jsonb)$$,'second immutable underwriting version created');
select ok((select count(*) from airprop.underwriting_versions)=2,'two versions coexist');
select ok((select current_version from airprop.underwriting_cases)=2,'current version advances deterministically');
select ok((select(results->>'annual_noi')::numeric from airprop.underwriting_versions where version=1)=54000::numeric,'NOI calculated deterministically');
select lives_ok($$select customer_api.add_airprop_underwriting_version_v1('86400000-0000-0000-0000-000000000001',(select id from airprop.investment_opportunities limit 1),'{"acquisition_cost":750000,"annual_rent":78000,"annual_opex":19000,"currency":"RON"}'::jsonb)$$,'underwriting retry is idempotent');
select ok((select count(*) from airprop.underwriting_versions)=2,'underwriting retry creates no duplicate');
select lives_ok($$select customer_api.configure_airprop_property_v1('86400000-0000-0000-0000-000000000001','86600000-0000-0000-0000-000000000001','86700000-0000-0000-0000-000000000001','legal_owner',1,'own_asset','2026-01-01','AIRPROP-RO','1.0')$$,'Bucharest owned-asset configuration created');
select ok((select count(*) from airprop.property_interests)=1 and(select count(*) from airprop.property_operating_models)=1,'interest and operating model written atomically');
select lives_ok($$select customer_api.configure_airprop_property_v1('86400000-0000-0000-0000-000000000001','86600000-0000-0000-0000-000000000001','86700000-0000-0000-0000-000000000001','legal_owner',1,'own_asset','2026-01-01','AIRPROP-RO','1.0')$$,'property configuration retry is idempotent');
select throws_ok($$select customer_api.configure_airprop_property_v1('86400000-0000-0000-0000-000000000001','86600000-0000-0000-0000-000000000001','86700000-0000-0000-0000-000000000001','legal_owner',1,'lease_operate','2026-01-01','AIRPROP-RO','1.0')$$,'22023','airprop_property_configuration_conflict','conflicting retry rejected');
select throws_ok($$select customer_api.configure_airprop_property_v1('86400000-0000-0000-0000-000000000001','86600000-0000-0000-0000-000000000001','86700000-0000-0000-0000-000000000001','legal_owner',1,'own_asset','2027-01-01','AIRPROP-AE-DU','1.0')$$,'22023','airprop_country_pack_not_active','Dubai pack fails closed');

select set_config('request.jwt.claims','{"sub":"86100000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"86200000-0000-0000-0000-000000000001","active_context_id":"86400000-0000-0000-0000-000000000004"}',true);
select throws_ok($$select customer_api.configure_airprop_property_v1('86400000-0000-0000-0000-000000000004','86600000-0000-0000-0000-000000000001','86700000-0000-0000-0000-000000000001','legal_owner',1,'own_asset','2026-01-01','AIRPROP-RO','1.0')$$,'42501','airprop_workspace_access_denied','building context cannot configure the parent target');
select set_config('request.jwt.claims','{"sub":"86100000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"86200000-0000-0000-0000-000000000001","active_context_id":"86400000-0000-0000-0000-000000000005"}',true);
select throws_ok($$select customer_api.configure_airprop_property_v1('86400000-0000-0000-0000-000000000005','86600000-0000-0000-0000-000000000001','86700000-0000-0000-0000-000000000001','legal_owner',1,'own_asset','2026-01-01','AIRPROP-RO','1.0')$$,'42501','airprop_workspace_access_denied','unit context cannot configure the parent target');

-- Exercise the public security-invoker gateway with a matching property grant.
select set_config('request.jwt.claims','{"sub":"86100000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"86200000-0000-0000-0000-000000000001","active_context_id":"86400000-0000-0000-0000-000000000003"}',true);
select lives_ok($$select customer_api.configure_airprop_property_v1('86400000-0000-0000-0000-000000000003','86600000-0000-0000-0000-000000000001','86700000-0000-0000-0000-000000000001','legal_owner',1,'own_asset','2026-01-01','AIRPROP-RO','1.0')$$,'matching property context can retry configuration');
select throws_ok($$select customer_api.configure_airprop_property_v1('86400000-0000-0000-0000-000000000003','86600000-0000-0000-0000-000000000002','86700000-0000-0000-0000-000000000001','legal_owner',1,'own_asset','2026-01-01','AIRPROP-RO','1.0')$$,'42501','airprop_workspace_access_denied','property context cannot configure another target');
select throws_ok($$select customer_api.configure_airprop_property_v1('86400000-0000-0000-0000-000000000003',null,'86700000-0000-0000-0000-000000000001','legal_owner',1,'own_asset','2026-01-01','AIRPROP-RO','1.0')$$,'42501','airprop_workspace_access_denied','property configuration requires an explicit target');
select set_config('request.jwt.claims','{"sub":"86100000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"86200000-0000-0000-0000-000000000001","active_context_id":"86400000-0000-0000-0000-000000000003"}',true);
select ok((select count(*) from airprop.property_interests)=1 and(select count(*) from airprop.property_operating_models)=1,'denied configuration and allowed retry create no additional records');
select set_config('request.jwt.claims','{"sub":"86100000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"86200000-0000-0000-0000-000000000001","active_context_id":"86400000-0000-0000-0000-000000000001"}',true);

select set_config('test.airprop_opportunity_id',(select id::text from airprop.investment_opportunities limit 1),true);
-- The real commands must authorize retries against current module and role state.
reset role;
update platform.workspace_modules set status='deactivated',valid_to=statement_timestamp(),deactivated_at=statement_timestamp(),reason='Synthetic authorization regression'
where customer_workspace_id='86000000-0000-0000-0000-000000000001' and module_code='airprop_commercial';
set local role authenticated;
select throws_ok($$select customer_api.create_airprop_opportunity_v1('86400000-0000-0000-0000-000000000001','AIRPROP-086-OPP','{"name":"Synthetic Bucharest Acquisition","country_code":"RO","city":"București","asking_price":750000,"currency":"RON","property_id":"86600000-0000-0000-0000-000000000001","source_ref":"SYNTHETIC-086"}'::jsonb)$$,'42501','airprop_workspace_access_denied','inactive module denies opportunity retry');
select throws_ok($$select customer_api.add_airprop_underwriting_version_v1('86400000-0000-0000-0000-000000000001',current_setting('test.airprop_opportunity_id')::uuid,'{"acquisition_cost":750000,"annual_rent":78000,"annual_opex":19000,"currency":"RON"}'::jsonb)$$,'42501','airprop_workspace_access_denied','inactive module denies underwriting retry');
select throws_ok($$select customer_api.configure_airprop_property_v1('86400000-0000-0000-0000-000000000001','86600000-0000-0000-0000-000000000001','86700000-0000-0000-0000-000000000001','legal_owner',1,'own_asset','2026-01-01','AIRPROP-RO','1.0')$$,'42501','airprop_workspace_access_denied','inactive module denies configuration retry');
reset role;
insert into platform.workspace_modules(tenant_id,customer_workspace_id,module_definition_id,module_code,status,reason)
select tenant_id,customer_workspace_id,module_definition_id,module_code,'active','Synthetic authorization restoration'
from platform.workspace_modules where customer_workspace_id='86000000-0000-0000-0000-000000000001'
and module_code='airprop_commercial' and status='deactivated';
update platform.workspace_entitlements set boolean_value=false where customer_workspace_id='86000000-0000-0000-0000-000000000001' and entitlement_key='module.airprop_commercial';
set local role authenticated;
select throws_ok($$select customer_api.create_airprop_opportunity_v1('86400000-0000-0000-0000-000000000001','AIRPROP-086-OPP','{"name":"Synthetic Bucharest Acquisition","country_code":"RO","city":"București","asking_price":750000,"currency":"RON","property_id":"86600000-0000-0000-0000-000000000001","source_ref":"SYNTHETIC-086"}'::jsonb)$$,'42501','airprop_workspace_access_denied','disabled entitlement denies opportunity retry');
select throws_ok($$select customer_api.add_airprop_underwriting_version_v1('86400000-0000-0000-0000-000000000001',current_setting('test.airprop_opportunity_id')::uuid,'{"acquisition_cost":750000,"annual_rent":78000,"annual_opex":19000,"currency":"RON"}'::jsonb)$$,'42501','airprop_workspace_access_denied','disabled entitlement denies underwriting retry');
select throws_ok($$select customer_api.configure_airprop_property_v1('86400000-0000-0000-0000-000000000001','86600000-0000-0000-0000-000000000001','86700000-0000-0000-0000-000000000001','legal_owner',1,'own_asset','2026-01-01','AIRPROP-RO','1.0')$$,'42501','airprop_workspace_access_denied','disabled entitlement denies configuration retry');
reset role;
update platform.workspace_entitlements set boolean_value=true where customer_workspace_id='86000000-0000-0000-0000-000000000001' and entitlement_key='module.airprop_commercial';
update identity.role_permissions rp set effect='deny' from identity.roles r,identity.permissions p
where rp.role_id=r.id and rp.permission_id=p.id and r.code='airprop_portfolio_director' and r.tenant_id is null
and p.code in('airprop.opportunity.manage','airprop.underwriting.manage','airprop.asset.manage');
set local role authenticated;
select throws_ok($$select customer_api.create_airprop_opportunity_v1('86400000-0000-0000-0000-000000000001','AIRPROP-086-OPP','{"name":"Synthetic Bucharest Acquisition","country_code":"RO","city":"București","asking_price":750000,"currency":"RON","property_id":"86600000-0000-0000-0000-000000000001","source_ref":"SYNTHETIC-086"}'::jsonb)$$,'42501','airprop_workspace_access_denied','current role denial blocks opportunity retry');
select throws_ok($$select customer_api.add_airprop_underwriting_version_v1('86400000-0000-0000-0000-000000000001',current_setting('test.airprop_opportunity_id')::uuid,'{"acquisition_cost":750000,"annual_rent":78000,"annual_opex":19000,"currency":"RON"}'::jsonb)$$,'42501','airprop_workspace_access_denied','current role denial blocks underwriting retry');
select throws_ok($$select customer_api.configure_airprop_property_v1('86400000-0000-0000-0000-000000000001','86600000-0000-0000-0000-000000000001','86700000-0000-0000-0000-000000000001','legal_owner',1,'own_asset','2026-01-01','AIRPROP-RO','1.0')$$,'42501','airprop_workspace_access_denied','current role denial blocks configuration retry');
reset role;
update identity.role_permissions rp set effect='allow' from identity.roles r,identity.permissions p
where rp.role_id=r.id and rp.permission_id=p.id and r.code='airprop_portfolio_director' and r.tenant_id is null
and p.code in('airprop.opportunity.manage','airprop.underwriting.manage','airprop.asset.manage');
set local role authenticated;
select throws_ok($$select customer_api.create_airprop_opportunity_v1('86400000-0000-0000-0000-000000000001','AIRPROP-086-UNBOUND','{"name":"Unbound synthetic","country_code":"RO","city":"București","asking_price":750000,"currency":"RON"}'::jsonb)$$,'42501','airprop_workspace_access_denied','unbound opportunity cannot bypass workspace subject scope');
select lives_ok($$select customer_api.create_airprop_opportunity_v1('86400000-0000-0000-0000-000000000001','AIRPROP-086-OPP','{"name":"Synthetic Bucharest Acquisition","country_code":"RO","city":"București","asking_price":750000,"currency":"RON","property_id":"86600000-0000-0000-0000-000000000001","source_ref":"SYNTHETIC-086"}'::jsonb)$$,'restored access permits idempotent opportunity retry');
select ok((select count(*) from airprop.investment_opportunities)=1 and(select count(*) from airprop.underwriting_versions)=2 and(select count(*) from airprop.property_interests)=1,'denied commands and retries preserve all domain row counts');

reset role;
select ok((select count(*) from audit.events where tenant_id='86200000-0000-0000-0000-000000000001' and action like 'AIRPROP_%')=4,'opportunity, two versions and property configuration audited');
select ok((select count(*) from finance.journals where tenant_id='86200000-0000-0000-0000-000000000001')=0,'core discovery emits no journal');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"86100000-0000-0000-0000-000000000002","aal":"aal2","active_tenant_id":"86200000-0000-0000-0000-000000000002","active_context_id":"86400000-0000-0000-0000-000000000002"}',true);
select throws_ok($$select customer_api.add_airprop_underwriting_version_v1('86400000-0000-0000-0000-000000000002',current_setting('test.airprop_opportunity_id')::uuid,'{"acquisition_cost":750000,"annual_rent":72000,"annual_opex":18000}'::jsonb)$$,'P0002','airprop_opportunity_not_found','cross-tenant underwriting hidden');

reset role;
select throws_ok($$update airprop.underwriting_versions set results='{}'::jsonb where version=1$$,'55000','airprop_underwriting_version_immutable','underwriting history is immutable');
select throws_ok($$insert into airprop.property_operating_models(tenant_id,property_id,model,country_pack_code,country_pack_version,valid_from,created_by) values('86200000-0000-0000-0000-000000000001','86600000-0000-0000-0000-000000000001','lease_operate','AIRPROP-RO','1.0','2026-06-01','86100000-0000-0000-0000-000000000001')$$,'23514','airprop_operating_model_overlap','overlapping operating model rejected');

select * from finish();
rollback;
