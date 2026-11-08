-- Same transaction, ACTUAL admitted lifecycle custodian; not an RPC/caller choice.
CREATE TEMP TABLE core_quote_protected_helpers ON COMMIT DROP AS
 SELECT p.oid,p.proowner,p.prosrc,p.proconfig,p.prosecdef,p.proacl FROM pg_proc p
 WHERE p.oid IN('auth.uid()'::regprocedure,'auth.jwt()'::regprocedure,
 'app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure,
 'app_private.resolve_workspace_native_context_v2(uuid,uuid)'::regprocedure,
 'app_private.require_request_session_current_at_v1(timestamptz)'::regprocedure,
 'app_private.service_request_authorize_v1(uuid,uuid,text)'::regprocedure);
CREATE TEMP TABLE core_quote_defaults ON COMMIT DROP AS TABLE pg_default_acl;
CREATE TEMP TABLE core_quote_schema_before ON COMMIT DROP AS
 SELECT n.oid,n.nspname,n.nspacl,n.nspowner,
 has_schema_privilege('cladora_core_installer',n.oid,'CREATE') AS installer_create
 FROM pg_namespace n WHERE n.nspname IN('app_private','customer_api','service_catalog','platform_dev');
CREATE TEMP TABLE core_quote_auth_schema_before ON COMMIT DROP AS SELECT oid,nspowner,nspacl FROM pg_namespace WHERE nspname='auth';
CREATE TEMP TABLE core_quote_auth_table_before ON COMMIT DROP AS SELECT oid,relowner,relacl,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='auth.users'::regclass;
CREATE TEMP TABLE core_quote_auth_columns_before ON COMMIT DROP AS SELECT attnum,attacl FROM pg_attribute WHERE attrelid='auth.users'::regclass;
CREATE ROLE cladora_service_quote_store_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD NULL;
GRANT cladora_service_quote_store_owner TO cladora_core_installer WITH ADMIN TRUE, INHERIT FALSE, SET TRUE;
GRANT USAGE ON SCHEMA app_private,auth,customer_api,platform,portfolio,service_catalog,platform_dev TO cladora_service_quote_store_owner;
GRANT EXECUTE ON FUNCTION auth.uid(),app_private.require_request_session_current_at_v1(timestamptz),app_private.service_request_authorize_v1(uuid,uuid,text) TO cladora_service_quote_store_owner;
-- USAGE(auth) also exposes existing PUBLIC EXECUTE auth.email(); no provider
-- PUBLIC ACL/owner/default changes. It is a GUC accessor, never JWT verification.
DO $create_boundary$
DECLARE r record;
BEGIN
 FOR r IN SELECT * FROM core_quote_schema_before LOOP
  EXECUTE format('GRANT CREATE ON SCHEMA %I TO cladora_service_quote_store_owner',r.nspname);
  IF NOT r.installer_create THEN
   EXECUTE format('GRANT CREATE ON SCHEMA %I TO cladora_core_installer',r.nspname);
  END IF;
 END LOOP;
END $create_boundary$;
SET LOCAL ROLE cladora_core_installer;
DO $ordinary$ BEGIN
 IF current_user<>'cladora_core_installer' OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND(rolsuper OR rolbypassrls)) THEN
  RAISE EXCEPTION 'core_quote_ordinary_installer_required' USING ERRCODE='55000'; END IF;
END $ordinary$;
