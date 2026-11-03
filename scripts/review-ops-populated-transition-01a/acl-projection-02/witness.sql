-- Synthetic PG17 semantics witness. SOURCE ONLY; coordinator admission required.
-- Never staging/Production. No native authority, receipt, Auth or business data.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '20s';
SET LOCAL idle_in_transaction_session_timeout = '30s';
SET LOCAL search_path = pg_catalog;
DO $preflight$
BEGIN
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
    OR current_database() <> 'postgres' OR current_user <> session_user
    OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper)
 THEN RAISE EXCEPTION 'ACL02_WRONG_LAB_PRINCIPAL_OR_VERSION' USING ERRCODE='55000'; END IF;
 IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname IN
    ('app_private','customer_api','platform','identity','maintenance','auth',
     'ops_acl02_api','ops_acl02_private'))
    OR EXISTS (SELECT 1 FROM pg_roles WHERE rolname IN ('ops_acl02_owner','ops_acl02_caller'))
 THEN RAISE EXCEPTION 'ACL02_NONEMPTY_OR_COLLIDING_LAB' USING ERRCODE='55000'; END IF;
END
$preflight$;
CREATE ROLE ops_acl02_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE ROLE ops_acl02_caller NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
CREATE SCHEMA ops_acl02_api AUTHORIZATION ops_acl02_owner;
CREATE SCHEMA ops_acl02_private AUTHORIZATION ops_acl02_owner;
SET LOCAL ROLE ops_acl02_owner;
REVOKE ALL ON SCHEMA ops_acl02_api, ops_acl02_private FROM PUBLIC, ops_acl02_caller;
CREATE FUNCTION ops_acl02_private.command_v1(p_value text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $private$
BEGIN
 IF p_value IS DISTINCT FROM 'allow' THEN
  RAISE EXCEPTION 'ACL02_TOY_GUARD_DENIED' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object('model','synthetic_only','executor',current_user,'value',p_value);
END
$private$;
REVOKE ALL ON FUNCTION ops_acl02_private.command_v1(text) FROM PUBLIC, ops_acl02_caller;
CREATE FUNCTION ops_acl02_private.other_v1() RETURNS integer
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog AS $other$ SELECT 17 $other$;
REVOKE ALL ON FUNCTION ops_acl02_private.other_v1() FROM PUBLIC, ops_acl02_caller;
CREATE FUNCTION ops_acl02_api.facade_v1(p_value text) RETURNS jsonb
LANGUAGE sql SECURITY INVOKER SET search_path=pg_catalog AS $facade$
 SELECT ops_acl02_private.command_v1(p_value)
$facade$;
REVOKE ALL ON FUNCTION ops_acl02_api.facade_v1(text) FROM PUBLIC, ops_acl02_caller;
RESET ROLE;
DO $attributes$
BEGIN
 IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('ops_acl02_owner','ops_acl02_caller')
       AND NOT rolcanlogin AND NOT rolsuper AND NOT rolcreatedb AND NOT rolcreaterole
       AND NOT rolinherit AND NOT rolreplication AND NOT rolbypassrls) <> 2
    OR EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r
      ON r.oid=m.roleid OR r.oid=m.member
      WHERE r.rolname IN ('ops_acl02_owner','ops_acl02_caller'))
    OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname IN ('ops_acl02_api','ops_acl02_private')
        AND (p.proowner <> 'ops_acl02_owner'::regrole
             OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]))
 THEN RAISE EXCEPTION 'ACL02_PRIVILEGED_OR_INHERITED_FIXTURE' USING ERRCODE='55000'; END IF;
 IF (SELECT prosecdef FROM pg_proc WHERE oid='ops_acl02_api.facade_v1(text)'::regprocedure)
    OR NOT (SELECT prosecdef FROM pg_proc WHERE oid='ops_acl02_private.command_v1(text)'::regprocedure)
    OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
       CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
       WHERE n.nspname IN ('ops_acl02_api','ops_acl02_private') AND a.grantee=0)
 THEN RAISE EXCEPTION 'ACL02_SECURITY_OR_PUBLIC_ACL_DRIFT' USING ERRCODE='55000'; END IF;
END
$attributes$;

SET LOCAL ROLE ops_acl02_caller;
DO $case_D00$
BEGIN
 IF current_user <> 'ops_acl02_caller' OR (NOT has_schema_privilege(current_user,'ops_acl02_api','USAGE')) IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'ACL02_D00_PRECONDITION' USING ERRCODE='55000'; END IF;
 BEGIN
  PERFORM ops_acl02_api.facade_v1('allow');
  RAISE EXCEPTION 'ACL02_D00_EXPECTED_42501' USING ERRCODE='55000';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END
$case_D00$;
RESET ROLE;

SET LOCAL ROLE ops_acl02_owner;
GRANT USAGE ON SCHEMA ops_acl02_api TO ops_acl02_caller;
GRANT EXECUTE ON FUNCTION ops_acl02_api.facade_v1(text) TO ops_acl02_caller;
RESET ROLE;

SET LOCAL ROLE ops_acl02_caller;
DO $case_D01$
BEGIN
 IF current_user <> 'ops_acl02_caller' OR (NOT has_schema_privilege(current_user,'ops_acl02_private','USAGE') AND NOT has_function_privilege(current_user,(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ops_acl02_private' AND p.proname='command_v1'),'EXECUTE')) IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'ACL02_D01_PRECONDITION' USING ERRCODE='55000'; END IF;
 BEGIN
  PERFORM ops_acl02_api.facade_v1('allow');
  RAISE EXCEPTION 'ACL02_D01_EXPECTED_42501' USING ERRCODE='55000';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END
$case_D01$;
RESET ROLE;

SET LOCAL ROLE ops_acl02_owner;
GRANT EXECUTE ON FUNCTION ops_acl02_private.command_v1(text) TO ops_acl02_caller;
RESET ROLE;

SET LOCAL ROLE ops_acl02_caller;
DO $case_D02$
BEGIN
 IF current_user <> 'ops_acl02_caller' OR (NOT has_schema_privilege(current_user,'ops_acl02_private','USAGE') AND has_function_privilege(current_user,(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ops_acl02_private' AND p.proname='command_v1'),'EXECUTE')) IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'ACL02_D02_PRECONDITION' USING ERRCODE='55000'; END IF;
 BEGIN
  PERFORM ops_acl02_api.facade_v1('allow');
  RAISE EXCEPTION 'ACL02_D02_EXPECTED_42501' USING ERRCODE='55000';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END
$case_D02$;
RESET ROLE;

SET LOCAL ROLE ops_acl02_owner;
REVOKE EXECUTE ON FUNCTION ops_acl02_private.command_v1(text) FROM ops_acl02_caller;
GRANT USAGE ON SCHEMA ops_acl02_private TO ops_acl02_caller;
RESET ROLE;

SET LOCAL ROLE ops_acl02_caller;
DO $case_D03$
BEGIN
 IF current_user <> 'ops_acl02_caller' OR (has_schema_privilege(current_user,'ops_acl02_private','USAGE') AND NOT has_function_privilege(current_user,(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ops_acl02_private' AND p.proname='command_v1'),'EXECUTE')) IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'ACL02_D03_PRECONDITION' USING ERRCODE='55000'; END IF;
 BEGIN
  PERFORM ops_acl02_api.facade_v1('allow');
  RAISE EXCEPTION 'ACL02_D03_EXPECTED_42501' USING ERRCODE='55000';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END
$case_D03$;
RESET ROLE;

SET LOCAL ROLE ops_acl02_owner;
GRANT EXECUTE ON FUNCTION ops_acl02_private.command_v1(text) TO ops_acl02_caller;
RESET ROLE;

SET LOCAL ROLE ops_acl02_caller;
DO $case_P01$
DECLARE v jsonb;
BEGIN
 IF current_user <> 'ops_acl02_caller' THEN RAISE EXCEPTION 'ACL02_WRONG_TEST_ROLE'; END IF;
 v := ops_acl02_api.facade_v1('allow');
 IF v IS DISTINCT FROM jsonb_build_object('model','synthetic_only','executor','ops_acl02_owner','value','allow')
 THEN RAISE EXCEPTION 'ACL02_P01_WRONG_RESULT' USING ERRCODE='55000'; END IF;
END
$case_P01$;
RESET ROLE;

SET LOCAL ROLE ops_acl02_caller;
DO $case_P02$
DECLARE v jsonb;
BEGIN
 IF current_user <> 'ops_acl02_caller' THEN RAISE EXCEPTION 'ACL02_WRONG_TEST_ROLE'; END IF;
 v := ops_acl02_private.command_v1('allow');
 IF v IS DISTINCT FROM jsonb_build_object('model','synthetic_only','executor','ops_acl02_owner','value','allow')
 THEN RAISE EXCEPTION 'ACL02_P02_WRONG_RESULT' USING ERRCODE='55000'; END IF;
END
$case_P02$;
RESET ROLE;

SET LOCAL ROLE ops_acl02_caller;
DO $case_D04$
BEGIN
 IF current_user <> 'ops_acl02_caller' OR (has_schema_privilege(current_user,'ops_acl02_private','USAGE') AND has_function_privilege(current_user,(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ops_acl02_private' AND p.proname='command_v1'),'EXECUTE')) IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'ACL02_D04_PRECONDITION' USING ERRCODE='55000'; END IF;
 BEGIN
  PERFORM ops_acl02_api.facade_v1('deny');
  RAISE EXCEPTION 'ACL02_D04_EXPECTED_42501' USING ERRCODE='55000';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END
$case_D04$;
RESET ROLE;

SET LOCAL ROLE ops_acl02_caller;
DO $case_D05$
BEGIN
 IF current_user <> 'ops_acl02_caller' OR (has_schema_privilege(current_user,'ops_acl02_private','USAGE') AND has_function_privilege(current_user,(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ops_acl02_private' AND p.proname='command_v1'),'EXECUTE')) IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'ACL02_D05_PRECONDITION' USING ERRCODE='55000'; END IF;
 BEGIN
  PERFORM ops_acl02_private.command_v1('deny');
  RAISE EXCEPTION 'ACL02_D05_EXPECTED_42501' USING ERRCODE='55000';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END
$case_D05$;
RESET ROLE;

SET LOCAL ROLE ops_acl02_caller;
DO $case_D06$
BEGIN
 IF current_user <> 'ops_acl02_caller' OR (has_schema_privilege(current_user,'ops_acl02_private','USAGE')) IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'ACL02_D06_PRECONDITION' USING ERRCODE='55000'; END IF;
 BEGIN
  PERFORM ops_acl02_private.other_v1();
  RAISE EXCEPTION 'ACL02_D06_EXPECTED_42501' USING ERRCODE='55000';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END
$case_D06$;
RESET ROLE;

SET LOCAL ROLE ops_acl02_owner;
REVOKE EXECUTE ON FUNCTION ops_acl02_private.command_v1(text) FROM ops_acl02_caller;
RESET ROLE;

SET LOCAL ROLE ops_acl02_caller;
DO $case_D07$
BEGIN
 IF current_user <> 'ops_acl02_caller' OR (has_schema_privilege(current_user,'ops_acl02_private','USAGE') AND NOT has_function_privilege(current_user,(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ops_acl02_private' AND p.proname='command_v1'),'EXECUTE')) IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'ACL02_D07_PRECONDITION' USING ERRCODE='55000'; END IF;
 BEGIN
  PERFORM ops_acl02_api.facade_v1('allow');
  RAISE EXCEPTION 'ACL02_D07_EXPECTED_42501' USING ERRCODE='55000';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END
$case_D07$;
RESET ROLE;

SET LOCAL ROLE ops_acl02_caller;
DO $case_D08$
BEGIN
 IF current_user <> 'ops_acl02_caller' OR (has_schema_privilege(current_user,'ops_acl02_private','USAGE') AND NOT has_function_privilege(current_user,(SELECT p.oid FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='ops_acl02_private' AND p.proname='command_v1'),'EXECUTE')) IS DISTINCT FROM TRUE THEN
  RAISE EXCEPTION 'ACL02_D08_PRECONDITION' USING ERRCODE='55000'; END IF;
 BEGIN
  PERFORM ops_acl02_private.command_v1('allow');
  RAISE EXCEPTION 'ACL02_D08_EXPECTED_42501' USING ERRCODE='55000';
 EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
 END;
END
$case_D08$;
RESET ROLE;

-- Only a pre-rollback assertion marker. It is NOT a cleanup or native receipt.
SELECT jsonb_build_object('stage','ACL02_ASSERTIONS_REACHED','synthetic_only',true,
 'backend_pid',pg_backend_pid(),'case_ids',to_jsonb(ARRAY['D00','D01','D02','D03','P01','P02','D04','D05','D06','D07','D08']::text[]));
ROLLBACK;
