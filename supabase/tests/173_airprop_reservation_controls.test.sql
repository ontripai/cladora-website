begin;
select plan(16);

select has_table('airprop','reservation_revisions','reservation revision ledger exists');
select has_function('customer_api','control_airprop_reservation_v1',array['uuid','uuid','uuid','text','integer','timestamp with time zone','text','text','text'],'bounded reservation control gateway exists');
select ok(exists(select 1 from information_schema.columns where table_schema='airprop' and table_name='exclusive_reservations' and column_name='version'),'reservation version exists');
select ok(exists(select 1 from information_schema.columns where table_schema='airprop' and table_name='exclusive_reservations' and column_name='conversion_kind'),'bounded conversion kind exists');
select ok(exists(select 1 from information_schema.columns where table_schema='airprop' and table_name='exclusive_reservations' and column_name='conversion_reference'),'conversion receipt reference exists');
select is((select relrowsecurity from pg_class where oid='airprop.reservation_revisions'::regclass),true,'revision ledger RLS is active');
select is((select count(*) from information_schema.role_routine_grants where routine_schema='customer_api' and routine_name='control_airprop_reservation_v1' and grantee='authenticated' and privilege_type='EXECUTE'),1::bigint,'authenticated receives explicit gateway execution');
select is((select count(*) from information_schema.role_table_grants where table_schema='airprop' and table_name='reservation_revisions' and grantee in('anon','authenticated','service_role')),0::bigint,'revision ledger has no direct API grants');
select ok(exists(select 1 from pg_constraint where conrelid='airprop.reservation_revisions'::regclass and contype='f' and confrelid='airprop.exclusive_reservations'::regclass),'revision reservation reference is enforced');
select ok(exists(select 1 from pg_constraint where conrelid='airprop.reservation_revisions'::regclass and contype='f' and confrelid='auth.users'::regclass),'revision actor reference is enforced');
select ok(exists(select 1 from pg_indexes where schemaname='airprop' and tablename='reservation_revisions' and indexname='airprop_reservation_revisions_reservation_idx'),'revision history index exists');
select is((select count(*) from pg_constraint where conrelid='airprop.reservation_revisions'::regclass and contype='u'),2::bigint,'replay and version uniqueness are enforced');
select ok(exists(select 1 from pg_constraint where conrelid='airprop.exclusive_reservations'::regclass and contype='x'),'single-winner exclusion remains enforced');
select ok(not has_function_privilege('anon','customer_api.control_airprop_reservation_v1(uuid,uuid,uuid,text,integer,timestamptz,text,text,text)','EXECUTE'),'anon cannot execute reservation controls');
select ok(not has_function_privilege('service_role','customer_api.control_airprop_reservation_v1(uuid,uuid,uuid,text,integer,timestamptz,text,text,text)','EXECUTE'),'service role cannot bypass reservation controls');
select ok(has_function_privilege('authenticated','customer_api.control_airprop_reservation_v1(uuid,uuid,uuid,text,integer,timestamptz,text,text,text)','EXECUTE'),'authenticated can execute through the gateway');

select * from finish();
rollback;
