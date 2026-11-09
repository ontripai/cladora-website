-- Read-only bounded proposal. Platform supplies a fresh target/principal receipt.
BEGIN READ ONLY;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='20s';
SELECT current_database() AS database_name,current_user AS observer,
 current_setting('server_version_num') AS server_version_num,
 (SELECT oid FROM pg_database WHERE datname=current_database()) AS database_oid,
 (SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='core_runtime') AS backend_marker;
SELECT n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE (n.nspname,c.relname) IN (('platform','service_authoring_custody_v1'),('app_private','canonical_authority_revision_v1')) ORDER BY 1,2;
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS identity,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.proacl,
 encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS definition_sha256
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname,p.proname) IN (('platform_dev','prepare_service_offering_authoring_v1'),
 ('app_private','lock_core_request_session_v1'),('app_private','require_request_session_current_at_v1'),
 ('app_private','resolve_workspace_native_context_v2'),('app_private','check_workspace_native_permission_v2')) ORDER BY 1,2,3;
-- Compare exact definitions/overloads with the accepted source before adoption;
-- mere name presence is not readiness. Owner/role/default ACL/RLS observations are
-- supplied in the private Platform admission, never inferred from 'postgres'.
ROLLBACK;
