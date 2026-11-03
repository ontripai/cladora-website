-- INACTIVE SOURCE. Custodian postgres, now on the one fixed synthetic database.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $guard$ BEGIN
 IF current_database()<>'core_sqlstate_boundary_proof' OR current_user<>'postgres' OR session_user<>'postgres'
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('auth','app_private','identity','platform'))
 OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member IN
   (SELECT oid FROM pg_roles WHERE rolname IN ('core12_boundary_executor','core12_boundary_observer')))
 OR EXISTS(SELECT 1 FROM pg_default_acl WHERE defaclrole IN
   (SELECT oid FROM pg_roles WHERE rolname IN ('core12_boundary_executor','core12_boundary_observer')) AND defaclobjtype='f')
 THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_setup_identity_or_acl_hold'; END IF;
END $guard$;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON LANGUAGE plpgsql TO core12_boundary_executor;
COMMIT;
