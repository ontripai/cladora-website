-- INACTIVE SOURCE. Custodian postgres on a fresh owned PG17-only fixture ONLY.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $guard$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR session_user<>'postgres'
 OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper)
 OR EXISTS(SELECT 1 FROM pg_database WHERE datname='core_sqlstate_boundary_proof')
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('core12_boundary_executor','core12_boundary_observer'))
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('auth','app_private','identity','platform'))
 THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_setup_not_fresh_owned_pg17'; END IF;
END $guard$;
CREATE ROLE core12_boundary_executor LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
CREATE ROLE core12_boundary_observer LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT;
COMMIT;
