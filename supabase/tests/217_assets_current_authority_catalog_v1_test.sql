begin;
set local search_path=public,extensions,pg_catalog;
select plan(11);
select is((select p.prorettype::regtype::text from pg_proc p where p.oid='assets.check_asset_caller_v1(uuid,text,boolean)'::regprocedure),
 'record','existing record return contract retained');
select ok((select p.prosecdef and p.provolatile='s' from pg_proc p where p.oid='assets.check_asset_caller_v1(uuid,text,boolean)'::regprocedure),
 'existing stable definer attributes retained, no new privileged API');
select is((select p.proconfig::text from pg_proc p where p.oid='assets.check_asset_caller_v1(uuid,text,boolean)'::regprocedure),
 '{"search_path=pg_catalog, identity, platform"}','existing fixed search path retained');
select is((select pg_get_userbyid(p.proowner)::text from pg_proc p where p.oid='assets.check_asset_caller_v1(uuid,text,boolean)'::regprocedure),
 'postgres','existing owner retained');
select ok((select p.proacl is null from pg_proc p where p.oid='assets.check_asset_caller_v1(uuid,text,boolean)'::regprocedure),
 'existing shared-helper ACL unchanged, not a new grant or hardening claim');
select ok(position('g.starts_at <= statement_timestamp()' in pg_get_functiondef('assets.check_asset_caller_v1(uuid,text,boolean)'::regprocedure))>0,
 'Context start is inclusive');
select ok(position('g.ends_at > statement_timestamp()' in pg_get_functiondef('assets.check_asset_caller_v1(uuid,text,boolean)'::regprocedure))>0,
 'Context end is exclusive');
select ok(position('m.starts_at <= statement_timestamp()' in pg_get_functiondef('assets.check_asset_caller_v1(uuid,text,boolean)'::regprocedure))>0,
 'membership start is inclusive');
select ok(position('m.ends_at > statement_timestamp()' in pg_get_functiondef('assets.check_asset_caller_v1(uuid,text,boolean)'::regprocedure))>0,
 'membership end is exclusive');
select ok(not has_function_privilege('authenticated','assets.registration_context_v1(uuid)','EXECUTE'),
 'private registration helper remains inaccessible to authenticated');
select ok(not exists(select 1 from pg_extension where extname='plpgsql_check'),
 'fresh disposable catalog has no checker left by rollback-only test 216');
select * from finish();
rollback;
