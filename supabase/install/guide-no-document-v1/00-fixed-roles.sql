-- Separate explicit lifecycle unit; name is NOT proof of superuser capability.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtextextended('core-platform-role-bound-pool.v1',0));
DO $roles$
DECLARE marker text; r record;
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
 THEN RAISE EXCEPTION 'guide_actual_lifecycle_custodian_required' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('cladora_ce_guide_runtime','cladora_ce_guide_executor'))
 THEN RAISE EXCEPTION 'guide_role_collision_stop' USING ERRCODE='55000'; END IF;
END $roles$;
CREATE ROLE cladora_ce_guide_runtime LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD NULL;
CREATE ROLE cladora_ce_guide_executor NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT cladora_ce_guide_executor TO cladora_ce_guide_runtime WITH ADMIN FALSE, INHERIT FALSE, SET TRUE;
DO $closed$
BEGIN
 IF (SELECT count(*) FROM pg_auth_members m WHERE m.member IN(SELECT oid FROM pg_roles WHERE rolname IN('cladora_ce_guide_runtime','cladora_ce_guide_executor')) OR m.roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('cladora_ce_guide_runtime','cladora_ce_guide_executor')))<>1
 THEN RAISE EXCEPTION 'guide_role_graph_not_final' USING ERRCODE='55000'; END IF;
END $closed$;
COMMIT;
