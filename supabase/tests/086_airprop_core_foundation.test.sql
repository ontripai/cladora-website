begin;
select plan(34);

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
insert into identity.context_grants(id,membership_id,tenant_id,scope_type) values
 ('86400000-0000-0000-0000-000000000001','86300000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','tenant'),
 ('86400000-0000-0000-0000-000000000002','86300000-0000-0000-0000-000000000002','86200000-0000-0000-0000-000000000002','tenant');
insert into portfolio.addresses(id,tenant_id,country_code,county,city,street,building_no) values
 ('86500000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','RO','București','București','Strada Pilot','86'),
 ('86500000-0000-0000-0000-000000000002','86200000-0000-0000-0000-000000000002','RO','București','București','Strada Control','86');
insert into portfolio.properties(id,tenant_id,type,name,address_id,base_currency,status) values
 ('86600000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','villa','AIRPROP Synthetic Bucharest Asset','86500000-0000-0000-0000-000000000001','RON','active'),
 ('86600000-0000-0000-0000-000000000002','86200000-0000-0000-0000-000000000002','villa','AIRPROP Isolation Asset','86500000-0000-0000-0000-000000000002','RON','active');
insert into portfolio.parties(id,tenant_id,type,legal_name) values
 ('86700000-0000-0000-0000-000000000001','86200000-0000-0000-0000-000000000001','company','AIRPROP Synthetic Owner SRL'),
 ('86700000-0000-0000-0000-000000000002','86200000-0000-0000-0000-000000000002','company','AIRPROP Isolation Owner SRL');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"86100000-0000-0000-0000-000000000001","aal":"aal2","active_tenant_id":"86200000-0000-0000-0000-000000000001","active_context_id":"86400000-0000-0000-0000-000000000001"}',true);
select lives_ok($$select customer_api.create_airprop_opportunity_v1('86400000-0000-0000-0000-000000000001','AIRPROP-086-OPP','{"name":"Synthetic Bucharest Acquisition","country_code":"RO","city":"București","asking_price":750000,"currency":"RON","property_id":"86600000-0000-0000-0000-000000000001","source_ref":"SYNTHETIC-086"}'::jsonb)$$,'AAL2 actor creates Romania opportunity');
select ok((select count(*) from airprop.investment_opportunities)=1,'one opportunity written');
select lives_ok($$select customer_api.create_airprop_opportunity_v1('86400000-0000-0000-0000-000000000001','AIRPROP-086-OPP','{"name":"Synthetic Bucharest Acquisition","country_code":"RO","city":"București","asking_price":750000,"currency":"RON","property_id":"86600000-0000-0000-0000-000000000001","source_ref":"SYNTHETIC-086"}'::jsonb)$$,'opportunity retry is idempotent');
select ok((select count(*) from airprop.investment_opportunities)=1,'retry creates no duplicate');
select throws_ok($$select customer_api.create_airprop_opportunity_v1('86400000-0000-0000-0000-000000000001','AIRPROP-086-OPP','{"name":"Changed","country_code":"RO","city":"București","asking_price":760000,"currency":"RON"}'::jsonb)$$,'22023','airprop_idempotency_payload_mismatch','changed retry rejected');
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
select ok((select count(*) from audit.events where tenant_id='86200000-0000-0000-0000-000000000001' and action like 'AIRPROP_%')=4,'opportunity, two versions and property configuration audited');
select ok((select count(*) from finance.journals where tenant_id='86200000-0000-0000-0000-000000000001')=0,'core discovery emits no journal');

select set_config('request.jwt.claims','{"sub":"86100000-0000-0000-0000-000000000002","aal":"aal2","active_tenant_id":"86200000-0000-0000-0000-000000000002","active_context_id":"86400000-0000-0000-0000-000000000002"}',true);
select throws_ok($$select customer_api.add_airprop_underwriting_version_v1('86400000-0000-0000-0000-000000000002',(select id from airprop.investment_opportunities limit 1),'{"acquisition_cost":750000,"annual_rent":72000,"annual_opex":18000}'::jsonb)$$,'P0002','airprop_opportunity_not_found','cross-tenant underwriting hidden');

reset role;
select throws_ok($$update airprop.underwriting_versions set results='{}'::jsonb where version=1$$,'55000','airprop_underwriting_version_immutable','underwriting history is immutable');
select throws_ok($$insert into airprop.property_operating_models(tenant_id,property_id,model,country_pack_code,country_pack_version,valid_from,created_by) values('86200000-0000-0000-0000-000000000001','86600000-0000-0000-0000-000000000001','lease_operate','AIRPROP-RO','1.0','2026-06-01','86100000-0000-0000-0000-000000000001')$$,'23514','airprop_operating_model_overlap','overlapping operating model rejected');

select * from finish();
rollback;
