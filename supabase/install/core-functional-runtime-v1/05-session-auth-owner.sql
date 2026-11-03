-- Owned Platform12 ONLY: provider's ordinary Auth table owner encapsulates the
-- existing canonical guard. No managed Auth object/ACL/RLS/role is changed.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='20s';
DO $admit$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>current_user
  OR current_setting('server_version_num')::integer<>170011
  OR current_setting('cladora.core15.owned_backend',true)!~'^core15-dev:[a-f0-9]{32}$'
  OR current_setting('cladora.core15.owned_backend',true) IS NULL
  OR (SELECT relowner FROM pg_class WHERE oid='auth.sessions'::regclass)<>'supabase_auth_admin'::regrole
  OR NOT(SELECT relrowsecurity AND NOT relforcerowsecurity FROM pg_class WHERE oid='auth.sessions'::regclass)
  OR EXISTS(SELECT 1 FROM pg_policy WHERE polrelid='auth.sessions'::regclass)
  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('supabase_auth_admin','cladora_core_runtime')
    AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
  OR has_schema_privilege('supabase_auth_admin','core_runtime','CREATE')
  OR EXISTS(SELECT 1 FROM pg_proc WHERE oid IN
    ('core_runtime.require_request_session_current_at_v1(timestamptz)'::regprocedure,'core_runtime.lock_request_session_v1()'::regprocedure)
    AND proowner<>'cladora_core_session_owner'::regrole)
 THEN RAISE EXCEPTION 'core15_session_auth_owner_prestate_mismatch' USING ERRCODE='55000'; END IF;
 CREATE TEMP TABLE core15_auth_before ON COMMIT DROP AS
  SELECT c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c WHERE c.relnamespace='auth'::regnamespace;
 CREATE TEMP TABLE core15_defaults_before ON COMMIT DROP AS TABLE pg_default_acl;
 CREATE TEMP TABLE core15_roles_before ON COMMIT DROP AS TABLE pg_auth_members;
 CREATE TEMP TABLE core15_bodies_before ON COMMIT DROP AS
  SELECT oid,prosrc,proconfig,provolatile,prosecdef FROM pg_proc WHERE pronamespace='core_runtime'::regnamespace;
END $admit$;
-- Only the exact private guard is executable by runtime. Auth owner gains no
-- role membership; temporary schema CREATE is closed before commit.
GRANT USAGE,CREATE ON SCHEMA core_runtime TO supabase_auth_admin;
ALTER FUNCTION core_runtime.require_request_session_current_at_v1(timestamptz) OWNER TO supabase_auth_admin;
ALTER FUNCTION core_runtime.lock_request_session_v1() OWNER TO supabase_auth_admin;
REVOKE CREATE ON SCHEMA core_runtime FROM supabase_auth_admin;
REVOKE ALL ON FUNCTION core_runtime.require_request_session_current_at_v1(timestamptz) FROM PUBLIC,anon,authenticated,service_role,cladora_core_runtime,cladora_core_session_owner;
REVOKE ALL ON FUNCTION core_runtime.lock_request_session_v1() FROM PUBLIC,anon,authenticated,service_role,cladora_core_session_owner;
GRANT EXECUTE ON FUNCTION core_runtime.lock_request_session_v1() TO cladora_core_runtime;
-- Remove the earlier ineffective ordinary-owner grants. Auth table ACL must
-- remain untouched, so these column grants are removed in a separately checked
-- pre/post column-ACL delta; no existing provider principal is altered.
REVOKE SELECT(id,user_id,not_after),UPDATE(id) ON auth.sessions FROM cladora_core_session_owner;
REVOKE EXECUTE ON FUNCTION auth.uid(),auth.jwt() FROM cladora_core_session_owner;
REVOKE USAGE ON SCHEMA auth FROM cladora_core_session_owner;
DO $close$ BEGIN
 IF has_schema_privilege('supabase_auth_admin','core_runtime','CREATE')
  OR has_column_privilege('cladora_core_runtime','auth.sessions','id','SELECT')
  OR has_column_privilege('cladora_core_session_owner','auth.sessions','id','SELECT')
  OR EXISTS((TABLE pg_default_acl EXCEPT TABLE core15_defaults_before) UNION ALL (TABLE core15_defaults_before EXCEPT TABLE pg_default_acl))
  OR EXISTS((TABLE pg_auth_members EXCEPT TABLE core15_roles_before) UNION ALL (TABLE core15_roles_before EXCEPT TABLE pg_auth_members))
  OR EXISTS((SELECT c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c WHERE c.relnamespace='auth'::regnamespace EXCEPT TABLE core15_auth_before)
     UNION ALL (TABLE core15_auth_before EXCEPT SELECT c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c WHERE c.relnamespace='auth'::regnamespace))
  OR EXISTS((SELECT oid,prosrc,proconfig,provolatile,prosecdef FROM pg_proc WHERE pronamespace='core_runtime'::regnamespace EXCEPT TABLE core15_bodies_before)
     UNION ALL (TABLE core15_bodies_before EXCEPT SELECT oid,prosrc,proconfig,provolatile,prosecdef FROM pg_proc WHERE pronamespace='core_runtime'::regnamespace))
  OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
   WHERE p.pronamespace='core_runtime'::regnamespace AND a.grantee<>p.proowner
    AND NOT(p.oid='core_runtime.lock_request_session_v1()'::regprocedure AND a.grantee='cladora_core_runtime'::regrole AND a.privilege_type='EXECUTE'))
 THEN RAISE EXCEPTION 'core15_session_auth_owner_closure_mismatch' USING ERRCODE='55000'; END IF;
END $close$;
COMMIT;
