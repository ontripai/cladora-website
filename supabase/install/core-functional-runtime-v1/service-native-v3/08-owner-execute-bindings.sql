-- Fixed owner-side grants for TWO private canonical helpers; no GRANT OPTION.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='15s';
DO $pre$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>current_user
  OR current_setting('server_version_num')::integer<>170011
  OR (SELECT proowner FROM pg_proc WHERE oid='app_private.require_request_session_current_at_v1(timestamptz)'::regprocedure)<>'supabase_auth_admin'::regrole
  OR (SELECT proowner FROM pg_proc WHERE oid='app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure)<>'cladora_rpc_owner'::regrole
  OR has_function_privilege('cladora_core_runtime','app_private.require_request_session_current_at_v1(timestamptz)','EXECUTE')
  OR has_function_privilege('cladora_core_runtime','app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)','EXECUTE')
 THEN RAISE EXCEPTION 'core15_owner_execute_bindings_prestate' USING ERRCODE='55000';END IF;
 CREATE TEMP TABLE core15_owner_members ON COMMIT DROP AS TABLE pg_auth_members;
 CREATE TEMP TABLE core15_owner_defaults ON COMMIT DROP AS TABLE pg_default_acl;
END $pre$;
GRANT EXECUTE ON FUNCTION app_private.require_request_session_current_at_v1(timestamptz),
 app_private.check_workspace_native_permission_v2(uuid,uuid,text,text) TO cladora_core_runtime;
DO $post$ BEGIN
 IF EXISTS((TABLE pg_auth_members EXCEPT TABLE core15_owner_members) UNION ALL (TABLE core15_owner_members EXCEPT TABLE pg_auth_members))
  OR EXISTS((TABLE pg_default_acl EXCEPT TABLE core15_owner_defaults) UNION ALL (TABLE core15_owner_defaults EXCEPT TABLE pg_default_acl))
  OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid IN ('app_private.require_request_session_current_at_v1(timestamptz)'::regprocedure,
      'app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure)
     AND a.grantee='cladora_core_runtime'::regrole AND a.is_grantable)
 THEN RAISE EXCEPTION 'core15_owner_execute_bindings_poststate' USING ERRCODE='55000';END IF;
END $post$;
COMMIT;
