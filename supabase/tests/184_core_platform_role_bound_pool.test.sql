begin;
select plan(31);

select ok(exists(select 1 from pg_roles where rolname='cladora_ce_guide_runtime'),
  'runtime role exists');
select ok(exists(select 1 from pg_roles where rolname='cladora_ce_guide_executor'),
  'executor role exists');
select ok((select rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls
  and not rolcreatedb and not rolcreaterole and not rolreplication
  from pg_roles where rolname='cladora_ce_guide_runtime'),'runtime attributes are exact');
select ok((select not rolcanlogin and not rolinherit and not rolsuper and not rolbypassrls
  and not rolcreatedb and not rolcreaterole and not rolreplication
  from pg_roles where rolname='cladora_ce_guide_executor'),'executor attributes are exact');
select is((select count(*)::integer from pg_auth_members m
  join pg_roles member on member.oid=m.member
  where member.rolname like 'cladora_ce_guide_%'),1,
  'only one membership is reachable from the protected roles');
select ok((select not m.admin_option and not m.inherit_option and m.set_option
  from pg_auth_members m join pg_roles granted on granted.oid=m.roleid
  join pg_roles member on member.oid=m.member
  where granted.rolname='cladora_ce_guide_executor'
    and member.rolname='cladora_ce_guide_runtime'),'membership has SET only');
select is((select count(*)::integer from pg_database d join pg_roles r on r.oid=d.datdba
  where r.rolname like 'cladora_ce_guide_%'),0,'protected roles own no database');
select is((select count(*)::integer from pg_namespace n join pg_roles r on r.oid=n.nspowner
  where r.rolname like 'cladora_ce_guide_%'),0,'protected roles own no schema');
select is((select count(*)::integer from pg_class c join pg_roles r on r.oid=c.relowner
  where r.rolname like 'cladora_ce_guide_%' and c.relkind in ('r','p','S','v','m','f')),0,
  'protected roles own no relation');
select is((select count(*)::integer from pg_proc p join pg_roles r on r.oid=p.proowner
  where r.rolname like 'cladora_ce_guide_%'),0,'protected roles own no routine');
select is((select count(*)::integer from pg_proc p join pg_roles r on r.oid=p.proowner
  where p.oid=any(array[
    'app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure,
    'documents.customer_document_scope_matches(text,uuid,uuid,uuid,uuid)'::regprocedure,
    'communications.member_covers_unit(uuid,uuid,uuid)'::regprocedure,
    'communications.context_covers_unit(uuid,uuid)'::regprocedure])
    and r.rolname='cladora_rpc_owner' and not r.rolcanlogin and p.prosecdef
    and p.proconfig=array['search_path=pg_catalog']::text[]),4,
  'internal functions have the canonical NOLOGIN owner and search_path');
select is((select count(*)::integer from pg_proc p join pg_roles r on r.oid=p.proowner
  where p.oid=any(array['auth.uid()'::regprocedure,'auth.jwt()'::regprocedure])
    and r.rolname='supabase_auth_admin' and not p.prosecdef and p.provolatile='s'),2,
  'Supabase auth function ownership remains unchanged');
select ok(has_function_privilege('cladora_ce_guide_executor',
  'app_private.acquire_ce_guide_role_safety_lease_v1()','EXECUTE'),
  'executor can acquire the shared safety lease');
select ok(not has_function_privilege('cladora_ce_guide_runtime',
  'app_private.acquire_ce_guide_role_safety_lease_v1()','EXECUTE'),
  'runtime cannot call the lease without SET ROLE');
select ok(not has_function_privilege('cladora_ce_guide_executor',
  'app_private.acquire_core_platform_role_safety_mutation_lock_v1()','EXECUTE'),
  'executor cannot take the catalog mutation lock');
select ok(not has_function_privilege('cladora_ce_guide_runtime',
  'app_private.acquire_core_platform_role_safety_mutation_lock_v1()','EXECUTE'),
  'runtime cannot take the catalog mutation lock');
select ok(has_schema_privilege('cladora_ce_guide_executor','experience','USAGE'),
  'executor has experience USAGE');
select ok(not has_schema_privilege('cladora_ce_guide_executor','experience','CREATE'),
  'executor has no experience CREATE');
select ok(not has_schema_privilege('cladora_ce_guide_runtime','experience','USAGE'),
  'runtime has no direct product schema access');
select ok(has_column_privilege('cladora_ce_guide_executor','experience.guides','status','UPDATE'),
  'executor may update Guide status');
select ok(not has_table_privilege('cladora_ce_guide_executor','experience.guides','DELETE'),
  'executor has no Guide DELETE');
select ok(not has_table_privilege('cladora_ce_guide_executor','experience.guides','TRUNCATE'),
  'executor has no Guide TRUNCATE');
select ok(has_column_privilege('cladora_ce_guide_executor','platform.idempotency_keys','response_ref','UPDATE'),
  'executor may finalize the canonical receipt');
select ok(not has_table_privilege('cladora_ce_guide_executor','platform.idempotency_keys','DELETE'),
  'executor has no ledger DELETE');
select is((select count(*)::integer from pg_policies
  where roles @> array['cladora_ce_guide_executor']::name[]),32,
  'executor has the exact explicit RLS policy inventory');
select ok(not exists(select 1 from pg_policies where policyname like 'core_platform_ce_%_lock_v1'
  and with_check<>'false'),'lock-only UPDATE policies cannot authorize row changes');
select ok(exists(select 1 from pg_policies where policyname='core_platform_ce_guides_update_v1'
  and cmd='UPDATE' and qual is not null and with_check is not null),
  'Guide UPDATE has USING and WITH CHECK');
select ok(exists(select 1 from pg_policies where policyname='core_platform_ce_idempotency_insert_v1'
  and cmd='INSERT' and with_check is not null),'idempotency INSERT is scoped');
select ok(exists(select 1 from pg_policies where policyname='core_platform_ce_audit_insert_v1'
  and cmd='INSERT' and with_check is not null),'audit INSERT is scoped');
select ok(exists(select 1 from pg_policies where policyname='core_platform_ce_outbox_insert_v1'
  and cmd='INSERT' and with_check is not null),'outbox INSERT is scoped');
select ok(not has_table_privilege('cladora_ce_guide_runtime','audit.events','INSERT'),
  'runtime has no direct audit privilege');

select * from finish();
rollback;
