-- Catalog/source gates. The separate two-session harness proves the races.
begin;
select plan(26);

select has_column('service_catalog','quote_drafts','request_version','quote provenance records the locked Request version');
select col_is_null('service_catalog','quote_drafts','request_version','historical quote provenance remains nullable');
select is((select column_default from information_schema.columns where table_schema='service_catalog' and table_name='quote_drafts' and column_name='request_version'),null,'historical rows receive no fabricated default');
-- Exercise the installed constraint expression, independently of PostgreSQL's
-- pretty-printer casts/parentheses. No domain rows are inserted.
do $constraint_probe$
declare expression text;
begin
 select pg_get_expr(conbin,conrelid) into strict expression
 from pg_constraint where conname='service_quote_request_version_positive_safe'
 and conrelid='service_catalog.quote_drafts'::regclass and contype='c';
 execute format('create temporary table quote_request_version_probe(request_version bigint check (%s)) on commit drop',expression);
end $constraint_probe$;
select lives_ok('insert into quote_request_version_probe values (null)','historical NULL provenance remains permitted');
select lives_ok('insert into quote_request_version_probe values (1)','minimum positive version is permitted');
select lives_ok('insert into quote_request_version_probe values (9007199254740991)','maximum safe version is permitted');
select throws_ok('insert into quote_request_version_probe values (0)','23514',null,'zero version is rejected');
select throws_ok('insert into quote_request_version_probe values (-1)','23514',null,'negative version is rejected');
select throws_ok('insert into quote_request_version_probe values (9007199254740992)','23514',null,'unsafe positive version is rejected');

select has_function('customer_api','create_service_quote_draft_v2',array['jsonb'],'version-bound create entrypoint exists');
select has_function('customer_api','read_service_quote_drafts_v2',array['uuid','uuid'],'version-bearing read entrypoint exists');
select ok(has_function_privilege('authenticated','customer_api.create_service_quote_draft_v2(jsonb)','EXECUTE'),'authenticated caller can use the bounded V2 gateway');
select ok(not has_function_privilege('anon','customer_api.create_service_quote_draft_v2(jsonb)','EXECUTE'),'anonymous V2 create is closed');
select ok(not has_function_privilege('service_role','customer_api.create_service_quote_draft_v2(jsonb)','EXECUTE'),'service_role V2 create fallback is closed');
select ok((select prosecdef and proconfig=array['search_path=pg_catalog'] from pg_proc where oid='customer_api.create_service_quote_draft_v2(jsonb)'::regprocedure),'V2 create has a fixed definer search path');

select alike(pg_get_functiondef('customer_api.create_service_quote_draft_v2(jsonb)'::regprocedure),'%expected_request_version%','new commands require an explicit Request version');
select alike(pg_get_functiondef('customer_api.create_service_quote_draft_v2(jsonb)'::regprocedure),'%service_catalog.requests%for update%','the exact Request is locked before the write');
select ok((length(pg_get_functiondef('customer_api.create_service_quote_draft_v2(jsonb)'::regprocedure))-length(replace(pg_get_functiondef('customer_api.create_service_quote_draft_v2(jsonb)'::regprocedure),'service_request_authorize_v1','')))/length('service_request_authorize_v1')>=2,'authority is rechecked after lock acquisition');
select ok(position('return v_saved.response_ref' in pg_get_functiondef('customer_api.create_service_quote_draft_v2(jsonb)'::regprocedure))<position('if v_row.version<>v_expected_request_version' in pg_get_functiondef('customer_api.create_service_quote_draft_v2(jsonb)'::regprocedure)),'known committed replay is separated from new-write CAS');
select ok(position('if v_row.version<>v_expected_request_version' in pg_get_functiondef('customer_api.create_service_quote_draft_v2(jsonb)'::regprocedure))<position('insert into platform.idempotency_keys' in pg_get_functiondef('customer_api.create_service_quote_draft_v2(jsonb)'::regprocedure)),'stale new commands fail before an idempotency or domain write');
select alike(pg_get_functiondef('customer_api.create_service_quote_draft_v2(jsonb)'::regprocedure),'%request_id,request_version,published_revision_id%','new quote provenance stores the locked Request version');
select alike(pg_get_functiondef('customer_api.create_service_quote_draft_v2(jsonb)'::regprocedure),'%''request_version'',v_row.version%','receipt, audit and outbox evidence carry the locked Request version');
select alike(pg_get_functiondef('customer_api.read_service_quote_drafts_v2(uuid,uuid)'::regprocedure),'%''request_version'',r.version%','read V2 returns the current Request version');

select unalike(pg_get_functiondef('customer_api.create_service_quote_draft_v1(jsonb)'::regprocedure),'%insert into service_catalog.quote_drafts%','deprecated V1 cannot create a new quote');
select unalike(pg_get_functiondef('customer_api.create_service_quote_draft_v1(jsonb)'::regprocedure),'%insert into platform.idempotency_keys%','deprecated V1 cannot create a new idempotency claim');
select alike(pg_get_functiondef('customer_api.create_service_quote_draft_v1(jsonb)'::regprocedure),'%request_version_required%','deprecated V1 rejects an unknown unversioned command');

select * from finish();
rollback;
