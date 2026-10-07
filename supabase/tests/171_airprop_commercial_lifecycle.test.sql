begin;
select plan(32);

select has_table('airprop','market_listings','LC-A01 listing store exists');
select has_table('airprop','applicants','LC-A01 applicant store exists');
select has_table('airprop','exclusive_reservations','LC-A01 exclusive reservation store exists');
select has_table('airprop','purchase_obligation_schedules','LC-A02 obligation schedule exists');
select has_table('airprop','commercial_execution_links','LC-A03 bounded execution links exist');

select has_function('customer_api','publish_airprop_listing_v1',array['uuid','uuid','uuid','uuid','uuid','text','timestamp with time zone','timestamp with time zone','text']);
select has_function('customer_api','submit_airprop_applicant_v1',array['uuid','uuid','uuid','uuid','text']);
select has_function('customer_api','reserve_airprop_listing_v1',array['uuid','uuid','uuid','uuid','timestamp with time zone','text']);
select has_function('customer_api','record_airprop_obligation_schedule_v1',array['uuid','uuid','uuid','text','numeric','jsonb','text','text']);
select has_function('customer_api','link_airprop_commercial_execution_v1',array['uuid','uuid','uuid','uuid','text','uuid','jsonb','date','date','text']);

select ok(has_function_privilege('authenticated','customer_api.publish_airprop_listing_v1(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text)','EXECUTE'),'Authenticated may call listing command');
select ok(has_function_privilege('authenticated','customer_api.submit_airprop_applicant_v1(uuid,uuid,uuid,uuid,text)','EXECUTE'),'Authenticated may call applicant command');
select ok(has_function_privilege('authenticated','customer_api.reserve_airprop_listing_v1(uuid,uuid,uuid,uuid,timestamptz,text)','EXECUTE'),'Authenticated may call reservation command');
select ok(has_function_privilege('authenticated','customer_api.record_airprop_obligation_schedule_v1(uuid,uuid,uuid,text,numeric,jsonb,text,text)','EXECUTE'),'Authenticated may call obligation command');
select ok(has_function_privilege('authenticated','customer_api.link_airprop_commercial_execution_v1(uuid,uuid,uuid,uuid,text,uuid,jsonb,date,date,text)','EXECUTE'),'Authenticated may call bounded execution-link command');
select ok(not has_function_privilege('anon','customer_api.publish_airprop_listing_v1(uuid,uuid,uuid,uuid,uuid,text,timestamptz,timestamptz,text)','EXECUTE'),'Anonymous listing denied');
select ok(not has_function_privilege('service_role','customer_api.reserve_airprop_listing_v1(uuid,uuid,uuid,uuid,timestamptz,text)','EXECUTE'),'Service role reservation denied');
select ok(not has_function_privilege('authenticated','app_private.require_airprop_commercial_property_v1(uuid,uuid,uuid,text)','EXECUTE'),'Private AIRPROP authority helper remains private');

select is((select relrowsecurity from pg_class where oid='airprop.market_listings'::regclass),true,'Listings use RLS');
select is((select relrowsecurity from pg_class where oid='airprop.applicants'::regclass),true,'Applicants use RLS');
select is((select relrowsecurity from pg_class where oid='airprop.exclusive_reservations'::regclass),true,'Reservations use RLS');
select is((select relrowsecurity from pg_class where oid='airprop.purchase_obligation_schedules'::regclass),true,'Obligations use RLS');
select is((select relrowsecurity from pg_class where oid='airprop.commercial_execution_links'::regclass),true,'Execution links use RLS');
select is((select count(*) from information_schema.role_table_grants where table_schema='airprop' and table_name='market_listings' and grantee in('anon','authenticated','service_role')),0::bigint,'No direct listing table grants');
select is((select count(*) from information_schema.role_table_grants where table_schema='airprop' and table_name='exclusive_reservations' and grantee in('anon','authenticated','service_role')),0::bigint,'No direct reservation table grants');

select ok(exists(select 1 from pg_constraint where conrelid='airprop.exclusive_reservations'::regclass and contype='x'),'Reservation has database exclusion constraint');
select ok(exists(select 1 from pg_indexes where schemaname='airprop' and tablename='exclusive_reservations' and indexdef like '%unit_id%'),'Reservation subject is indexed');
select ok(exists(select 1 from pg_indexes where schemaname='airprop' and tablename='market_listings' and indexdef like '%property_id%'),'Listing property is indexed');
select ok(exists(select 1 from pg_indexes where schemaname='airprop' and tablename='purchase_obligation_schedules' and indexdef like '%workspace_id%'),'Obligation workspace is indexed');
select ok(exists(select 1 from pg_indexes where schemaname='airprop' and tablename='commercial_execution_links' and indexdef like '%property_id%'),'Execution-link property is indexed');
select ok(exists(select 1 from pg_constraint where conrelid='airprop.purchase_obligation_schedules'::regclass and contype='f' and confrelid='airprop.presale_contracts'::regclass),'Obligation reuses presale contract');
select ok(exists(select 1 from pg_constraint where conrelid='airprop.market_listings'::regclass and contype='f' and confrelid='airprop.investment_opportunities'::regclass),'Listing reuses opportunity');

select * from finish();
rollback;
