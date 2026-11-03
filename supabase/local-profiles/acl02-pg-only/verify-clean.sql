-- Read-only residue check, same admitted disposable database only.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '10s';
SET LOCAL search_path = pg_catalog;
SELECT jsonb_build_object(
 'stage','ACL02_RESIDUE', 'database',current_database(), 'backend_pid',pg_backend_pid(),
 'server_version_num',current_setting('server_version_num')::integer,
 'roles_remaining',(SELECT count(*) FROM pg_roles WHERE rolname IN ('ops_acl02_owner','ops_acl02_caller')),
 'schemas_remaining',(SELECT count(*) FROM pg_namespace WHERE nspname IN ('ops_acl02_api','ops_acl02_private')));
ROLLBACK;
