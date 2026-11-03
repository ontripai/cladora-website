-- Exact owned Platform12 development only; existing provider roles unchanged.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $admit$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>current_user
  OR current_setting('server_version_num')::integer<>170011
  OR current_setting('cladora.install.target',true) IS NULL
  OR current_setting('cladora.install.target',true)!~'^core15-dev:[a-f0-9]{32}$'
  OR current_setting('cladora.install.target_oid',true) IS DISTINCT FROM (SELECT oid::text FROM pg_database WHERE datname=current_database())
  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_core_installer')
  OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('app_private','platform','identity','portfolio','audit','finance','customer_api'))
  OR NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pgcrypto' AND extversion='1.3' AND extnamespace='extensions'::regnamespace)
 THEN RAISE EXCEPTION 'core15_native_installer_prerequisite_mismatch' USING ERRCODE='55000';END IF;
 CREATE TEMP TABLE core15_provider_roles_before ON COMMIT DROP AS SELECT * FROM pg_roles;
 CREATE TEMP TABLE core15_defaults_before ON COMMIT DROP AS SELECT * FROM pg_default_acl;
 IF EXISTS(SELECT 1 FROM pg_extension WHERE extname='btree_gist') THEN
  IF NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='btree_gist' AND extversion='1.7' AND extnamespace='extensions'::regnamespace)
   THEN RAISE EXCEPTION 'core15_btree_gist_mismatch' USING ERRCODE='55000';END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM pg_available_extension_versions WHERE name='btree_gist' AND version='1.7')
   THEN RAISE EXCEPTION 'core15_btree_gist_unavailable' USING ERRCODE='55000';END IF;
  CREATE EXTENSION btree_gist WITH SCHEMA extensions VERSION '1.7';
 END IF;
END $admit$;
CREATE ROLE cladora_core_installer LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB CREATEROLE NOREPLICATION;
-- Private password bound only by the fixed owned-target runner; never source.
-- CORE15_PRIVATE_INSTALLER_PASSWORD
GRANT CREATE ON DATABASE postgres TO cladora_core_installer;
GRANT USAGE ON SCHEMA auth,extensions TO cladora_core_installer;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt() TO cladora_core_installer;
GRANT REFERENCES(id),SELECT(id,email,email_confirmed_at) ON auth.users TO cladora_core_installer;
GRANT SELECT(id,user_id,not_after),UPDATE(id) ON auth.sessions TO cladora_core_installer;
-- These ACLs do NOT bypass Auth RLS. The already proved closed Auth-owner guard
-- remains the session primitive; no SELECT policy or provider role change here.
DO $close$ BEGIN
 IF EXISTS((SELECT * FROM pg_roles WHERE rolname<>'cladora_core_installer' EXCEPT TABLE core15_provider_roles_before)
   UNION ALL (TABLE core15_provider_roles_before EXCEPT SELECT * FROM pg_roles WHERE rolname<>'cladora_core_installer'))
  OR EXISTS((TABLE pg_default_acl EXCEPT TABLE core15_defaults_before) UNION ALL (TABLE core15_defaults_before EXCEPT TABLE pg_default_acl))
  OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member='cladora_core_installer'::regrole)
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_core_installer' AND rolcanlogin AND rolcreaterole
    AND NOT(rolsuper OR rolbypassrls OR rolinherit OR rolcreatedb OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM pg_extension WHERE extname='btree_gist' AND extversion='1.7' AND extnamespace='extensions'::regnamespace)
 THEN RAISE EXCEPTION 'core15_native_installer_prerequisite_closure' USING ERRCODE='55000'; END IF;
END $close$;
COMMIT;
