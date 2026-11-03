-- Independent observer snapshot AFTER setup, BEFORE witness; repeat after rollback.
-- Complete metadata aggregates, no LIMIT/filter that could hide candidate residue.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
WITH protected AS (
 SELECT jsonb_build_object(
  'roles',(SELECT COALESCE(jsonb_agg(to_jsonb(r)-'rolpassword' ORDER BY r.oid),'[]'::jsonb) FROM pg_roles r),
  'memberships',(SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor),'[]'::jsonb) FROM pg_auth_members m),
  'namespaces',(SELECT COALESCE(jsonb_agg(to_jsonb(n) ORDER BY n.oid),'[]'::jsonb) FROM pg_namespace n),
  'functions',(SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.oid),'[]'::jsonb) FROM pg_proc p),
  'default_acl',(SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.oid),'[]'::jsonb) FROM pg_default_acl d),
  'relations',(SELECT COALESCE(jsonb_agg(jsonb_build_array(c.oid,c.relnamespace,c.relname,c.relowner,c.relacl,c.relkind,c.relpersistence) ORDER BY c.oid),'[]'::jsonb) FROM pg_class c),
  'columns',(SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.attrelid,a.attnum),'[]'::jsonb) FROM pg_attribute a),
  'languages',(SELECT COALESCE(jsonb_agg(to_jsonb(l) ORDER BY l.oid),'[]'::jsonb) FROM pg_language l),
  'database_acl',(SELECT jsonb_build_array(d.oid,d.datname,d.datdba,d.encoding,d.datacl,d.datallowconn,d.datistemplate) FROM pg_database d WHERE d.datname=current_database()),
  'types',(SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.oid),'[]'::jsonb) FROM pg_type t),
  'dependencies',(SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY d.classid,d.objid,d.objsubid,d.refclassid,d.refobjid,d.refobjsubid,d.deptype),'[]'::jsonb) FROM pg_depend d)
 ) AS value
)
SELECT json_build_object(
 'stage','CORE12_CATALOG_SNAPSHOT_V1','database',current_database(),
 'database_oid',(SELECT oid::text FROM pg_database WHERE datname=current_database()),
 'pid',pg_backend_pid(),'user',current_user,'session_user',session_user,
 'version',current_setting('server_version_num')::integer,
 'read_only',current_setting('transaction_read_only')::boolean,
 'protected_sha256',encode(sha256(convert_to(protected.value::text,'UTF8')),'hex'),
 'witness_functions_remaining',(SELECT count(*) FROM pg_proc WHERE proname ~ '^core12_(before|after)_[1-8]$'),
 'matrix_remaining',(SELECT count(*) FROM pg_class WHERE relname='core12_matrix'),
 'forbidden_schemas',(SELECT count(*) FROM pg_namespace WHERE nspname IN ('auth','app_private','identity','platform')),
 'snapshot_complete',true
) FROM protected;
ROLLBACK;
