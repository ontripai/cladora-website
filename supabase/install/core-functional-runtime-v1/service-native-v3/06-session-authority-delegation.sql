-- Owned Platform12 only; table owner encapsulates canonical Auth-session check.
-- Runtime/installer/provider principals remain distinct; no Auth RLS change.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='20s';
DO $pre$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>current_user
  OR current_setting('server_version_num')::integer<>170011
  OR (SELECT proowner FROM pg_proc WHERE oid='app_private.require_request_session_current_at_v1(timestamptz)'::regprocedure)<>'cladora_core_installer'::regrole
  OR (SELECT proowner FROM pg_proc WHERE oid='core_runtime.lock_request_session_v1()'::regprocedure)<>'supabase_auth_admin'::regrole
  OR (SELECT relowner FROM pg_class WHERE oid='auth.sessions'::regclass)<>'supabase_auth_admin'::regrole
  OR has_schema_privilege('supabase_auth_admin','app_private','CREATE')
  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('cladora_core_runtime','supabase_auth_admin') AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'core15_authority_delegation_prestate' USING ERRCODE='55000';END IF;
 CREATE TEMP TABLE core15_delegate_defaults ON COMMIT DROP AS TABLE pg_default_acl;
 CREATE TEMP TABLE core15_delegate_members ON COMMIT DROP AS TABLE pg_auth_members;
 CREATE TEMP TABLE core15_delegate_body ON COMMIT DROP AS SELECT oid,prosrc,proconfig,provolatile,prosecdef
  FROM pg_proc WHERE oid='app_private.require_request_session_current_at_v1(timestamptz)'::regprocedure;
 CREATE TEMP TABLE core15_delegate_auth ON COMMIT DROP AS SELECT oid,relowner,relrowsecurity,relforcerowsecurity,relacl
  FROM pg_class WHERE relnamespace='auth'::regnamespace;
END $pre$;
GRANT CREATE ON SCHEMA app_private TO supabase_auth_admin;
ALTER FUNCTION app_private.require_request_session_current_at_v1(timestamptz) OWNER TO supabase_auth_admin;
REVOKE CREATE ON SCHEMA app_private FROM supabase_auth_admin;
REVOKE ALL ON FUNCTION app_private.require_request_session_current_at_v1(timestamptz) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.require_request_session_current_at_v1(timestamptz) TO cladora_core_installer;
GRANT USAGE ON SCHEMA core_runtime TO cladora_core_installer;
GRANT EXECUTE ON FUNCTION core_runtime.lock_request_session_v1() TO cladora_core_installer;
-- Claim accessors, not Auth tables: only the named closed Core principals.
GRANT USAGE ON SCHEMA auth TO cladora_core_runtime,cladora_rpc_owner;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO cladora_core_runtime,cladora_rpc_owner;
DO $post$ BEGIN
 IF has_schema_privilege('supabase_auth_admin','app_private','CREATE')
  OR has_column_privilege('cladora_core_runtime','auth.sessions','id','SELECT')
  OR EXISTS((TABLE pg_default_acl EXCEPT TABLE core15_delegate_defaults) UNION ALL (TABLE core15_delegate_defaults EXCEPT TABLE pg_default_acl))
  OR EXISTS((TABLE pg_auth_members EXCEPT TABLE core15_delegate_members) UNION ALL (TABLE core15_delegate_members EXCEPT TABLE pg_auth_members))
  OR EXISTS((SELECT oid,prosrc,proconfig,provolatile,prosecdef FROM pg_proc WHERE oid='app_private.require_request_session_current_at_v1(timestamptz)'::regprocedure EXCEPT TABLE core15_delegate_body)
    UNION ALL (TABLE core15_delegate_body EXCEPT SELECT oid,prosrc,proconfig,provolatile,prosecdef FROM pg_proc WHERE oid='app_private.require_request_session_current_at_v1(timestamptz)'::regprocedure))
  OR EXISTS((SELECT oid,relowner,relrowsecurity,relforcerowsecurity,relacl FROM pg_class WHERE relnamespace='auth'::regnamespace EXCEPT TABLE core15_delegate_auth)
    UNION ALL (TABLE core15_delegate_auth EXCEPT SELECT oid,relowner,relrowsecurity,relforcerowsecurity,relacl FROM pg_class WHERE relnamespace='auth'::regnamespace))
 THEN RAISE EXCEPTION 'core15_authority_delegation_poststate' USING ERRCODE='55000';END IF;
END $post$;
COMMIT;
