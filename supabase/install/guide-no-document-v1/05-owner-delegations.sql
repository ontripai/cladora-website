BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtextextended('core-platform-role-bound-pool.v1',0));
DO $delegation$
DECLARE marker text; f record;
BEGIN
 SELECT obj_description(oid,'pg_namespace') INTO marker FROM pg_namespace WHERE nspname='core_runtime';
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR marker IS NULL OR marker!~'^core15-dev:[a-f0-9]{32}$'
 OR marker IS DISTINCT FROM current_setting('cladora.guide.target_marker',true)
 OR (SELECT oid::text FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM current_setting('cladora.guide.target_oid',true)
 OR current_user IS DISTINCT FROM current_setting('cladora.guide.lifecycle_principal',true) OR current_user<>session_user
 OR current_setting('cladora.guide.plan_sha256',true) IS NULL
 OR current_setting('cladora.guide.plan_sha256',true)!~'^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'guide_target_plan_required' USING ERRCODE='55000'; END IF;

 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper)
 THEN RAISE EXCEPTION 'guide_actual_owner_admitter_required' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_ce_guide_executor' AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit OR rolreplication))
 THEN RAISE EXCEPTION 'guide_executor_prestate_invalid' USING ERRCODE='55000'; END IF;
 FOR f IN SELECT p.oid,p.prosrc,p.proowner,p.proconfig FROM pg_proc p
 WHERE p.oid IN ('auth.uid()'::regprocedure,'auth.jwt()'::regprocedure,
 'app_private.require_request_session_current_at_v1(timestamptz)'::regprocedure,
 'app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure,
 'app_private.resolve_workspace_native_context_v2(uuid,uuid)'::regprocedure) LOOP
 IF f.proowner IN(SELECT oid FROM pg_roles WHERE rolname IN('cladora_ce_guide_runtime','cladora_ce_guide_executor')) THEN RAISE EXCEPTION 'guide_helper_owner_invalid' USING ERRCODE='55000'; END IF;
 END LOOP;
 CREATE TEMP TABLE guide_delegate_protected ON COMMIT DROP AS SELECT oid,proowner,prosrc,proconfig,prosecdef FROM pg_proc;
 CREATE TEMP TABLE guide_delegate_defaults ON COMMIT DROP AS TABLE pg_default_acl;
 CREATE TEMP TABLE guide_delegate_members ON COMMIT DROP AS TABLE pg_auth_members;
END $delegation$;
-- Fixed owner-side boundary: no grant option, no Auth table ACL/RLS changes,
-- no managed role attributes, no helper owner/body change.
GRANT USAGE ON SCHEMA auth TO cladora_ce_guide_executor;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt(),
 app_private.require_request_session_current_at_v1(timestamptz),
 app_private.check_workspace_native_permission_v2(uuid,uuid,text,text),
 app_private.resolve_workspace_native_context_v2(uuid,uuid) TO cladora_ce_guide_executor;
DO $unchanged$
BEGIN
 IF EXISTS((SELECT oid,proowner,prosrc,proconfig,prosecdef FROM pg_proc EXCEPT TABLE guide_delegate_protected)
 UNION ALL(TABLE guide_delegate_protected EXCEPT SELECT oid,proowner,prosrc,proconfig,prosecdef FROM pg_proc))
 OR EXISTS((TABLE pg_default_acl EXCEPT TABLE guide_delegate_defaults) UNION ALL(TABLE guide_delegate_defaults EXCEPT TABLE pg_default_acl))
 OR EXISTS((TABLE pg_auth_members EXCEPT TABLE guide_delegate_members) UNION ALL(TABLE guide_delegate_members EXCEPT TABLE pg_auth_members))
 THEN RAISE EXCEPTION 'guide_delegation_non_acl_delta' USING ERRCODE='55000'; END IF;
END $unchanged$;
COMMIT;
