begin;
select plan(13);

select has_table('airprop','market_listing_revisions','revision ledger exists');
select has_function('customer_api','control_airprop_listing_v1',array['uuid','uuid','uuid','text','integer','timestamp with time zone','timestamp with time zone','text','text'],'bounded listing control gateway exists');
select ok(exists(select 1 from information_schema.columns where table_schema='airprop' and table_name='market_listings' and column_name='version'),'listing version exists');
select ok(exists(select 1 from information_schema.columns where table_schema='airprop' and table_name='market_listings' and column_name='withdrawn_reason'),'withdrawal reason exists');
select is((select relrowsecurity from pg_class where oid='airprop.market_listing_revisions'::regclass),true,'revision ledger RLS is active');
select is((select count(*) from information_schema.role_routine_grants where routine_schema='customer_api' and routine_name='control_airprop_listing_v1' and grantee='authenticated' and privilege_type='EXECUTE'),1::bigint,'authenticated receives explicit gateway execution');
select is((select count(*) from information_schema.role_table_grants where table_schema='airprop' and table_name='market_listing_revisions' and grantee in('anon','authenticated','service_role')),0::bigint,'revision ledger has no direct API grants');
select ok(exists(select 1 from pg_constraint where conrelid='airprop.market_listing_revisions'::regclass and contype='f' and confrelid='airprop.market_listings'::regclass),'revision listing reference is enforced');
select ok(exists(select 1 from pg_constraint where conrelid='airprop.market_listing_revisions'::regclass and contype='f' and confrelid='auth.users'::regclass),'revision actor reference is enforced');
select ok(exists(select 1 from pg_indexes where schemaname='airprop' and tablename='market_listing_revisions' and indexname='airprop_market_listing_revisions_listing_idx'),'revision history index exists');
select is((select count(*) from pg_constraint where conrelid='airprop.market_listing_revisions'::regclass and contype='u'),2::bigint,'replay and version uniqueness are enforced');
select ok(not has_function_privilege('anon','customer_api.control_airprop_listing_v1(uuid,uuid,uuid,text,integer,timestamptz,timestamptz,text,text)','EXECUTE'),'anon cannot execute listing controls');
select ok(has_function_privilege('authenticated','customer_api.control_airprop_listing_v1(uuid,uuid,uuid,text,integer,timestamptz,timestamptz,text,text)','EXECUTE'),'authenticated can execute through the gateway');

select * from finish();
rollback;
