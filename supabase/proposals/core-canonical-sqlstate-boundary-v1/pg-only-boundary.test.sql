-- PG-ONLY FUTURE BOUNDARY-SEMANTICS WITNESS; NOT full canonical evaluator/native SSI proof
-- No Auth/provider/schema installation. No execution currently authorized.
BEGIN ISOLATION LEVEL SERIALIZABLE;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='2s';
SET LOCAL statement_timeout='10s';
DO $guard$ BEGIN
 IF current_setting('core12.reviewed_pg_only_capsule',true) IS DISTINCT FROM 'core12-boundary-v1'
  OR current_database()<>'core_sqlstate_boundary_proof'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('auth','app_private','identity','platform'))
  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
  OR EXISTS(SELECT 1 FROM pg_default_acl WHERE defaclrole=(SELECT oid FROM pg_roles WHERE rolname=current_user) AND defaclobjtype='f')
 THEN RAISE EXCEPTION USING ERRCODE='55000',MESSAGE='core12_pg_only_execution_hold'; END IF;
END $guard$;
-- The GUC is only an accidental-execution guard, NEVER approval/authority.
-- External target/executor/authorization bindings remain NULL in caseplan.
-- EXACT extracted before handler, not a parallel evaluator: app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)
CREATE FUNCTION pg_temp.core12_before_1(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when others then
    return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_before_1(text,boolean) FROM PUBLIC;

-- EXACT extracted after handler, not a parallel evaluator: app_private.check_effective_permission_v2(uuid,text,text,text,uuid,uuid)
CREATE FUNCTION pg_temp.core12_after_1(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when sqlstate '40001' then raise; when others then
    return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_after_1(text,boolean) FROM PUBLIC;

-- EXACT extracted before handler, not a parallel evaluator: app_private.check_effective_permission_v2_at_v1(uuid,text,text,text,uuid,uuid,timestamptz)
CREATE FUNCTION pg_temp.core12_before_2(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when others then
    return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_before_2(text,boolean) FROM PUBLIC;

-- EXACT extracted after handler, not a parallel evaluator: app_private.check_effective_permission_v2_at_v1(uuid,text,text,text,uuid,uuid,timestamptz)
CREATE FUNCTION pg_temp.core12_after_2(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when sqlstate '40001' then raise; when others then
    return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_after_2(text,boolean) FROM PUBLIC;

-- EXACT extracted before handler, not a parallel evaluator: app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)
CREATE FUNCTION pg_temp.core12_before_3(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when others then return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_before_3(text,boolean) FROM PUBLIC;

-- EXACT extracted after handler, not a parallel evaluator: app_private.workspace_context_covers_role_scope_v1(uuid,uuid,text,uuid)
CREATE FUNCTION pg_temp.core12_after_3(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when sqlstate '40001' then raise; when others then return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_after_3(text,boolean) FROM PUBLIC;

-- EXACT extracted before handler, not a parallel evaluator: app_private.workspace_context_covers_role_scope_v1_at_v1(uuid,uuid,text,uuid,timestamptz)
CREATE FUNCTION pg_temp.core12_before_4(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when others then return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_before_4(text,boolean) FROM PUBLIC;

-- EXACT extracted after handler, not a parallel evaluator: app_private.workspace_context_covers_role_scope_v1_at_v1(uuid,uuid,text,uuid,timestamptz)
CREATE FUNCTION pg_temp.core12_after_4(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when sqlstate '40001' then raise; when others then return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_after_4(text,boolean) FROM PUBLIC;

-- EXACT extracted before handler, not a parallel evaluator: app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])
CREATE FUNCTION pg_temp.core12_before_5(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when others then return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_before_5(text,boolean) FROM PUBLIC;

-- EXACT extracted after handler, not a parallel evaluator: app_private.workspace_member_role_authority_active_v1(uuid,uuid,uuid,text,uuid,uuid[])
CREATE FUNCTION pg_temp.core12_after_5(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when sqlstate '40001' then raise; when others then return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_after_5(text,boolean) FROM PUBLIC;

-- EXACT extracted before handler, not a parallel evaluator: app_private.workspace_member_role_authority_active_v1_at_v1(uuid,uuid,uuid,text,uuid,uuid[],timestamptz)
CREATE FUNCTION pg_temp.core12_before_6(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when others then return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_before_6(text,boolean) FROM PUBLIC;

-- EXACT extracted after handler, not a parallel evaluator: app_private.workspace_member_role_authority_active_v1_at_v1(uuid,uuid,uuid,text,uuid,uuid[],timestamptz)
CREATE FUNCTION pg_temp.core12_after_6(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when sqlstate '40001' then raise; when others then return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_after_6(text,boolean) FROM PUBLIC;

-- EXACT extracted before handler, not a parallel evaluator: app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)
CREATE FUNCTION pg_temp.core12_before_7(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when others then return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_before_7(text,boolean) FROM PUBLIC;

-- EXACT extracted after handler, not a parallel evaluator: app_private.workspace_role_identity_source_current_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid)
CREATE FUNCTION pg_temp.core12_after_7(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when sqlstate '40001' then raise; when others then return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_after_7(text,boolean) FROM PUBLIC;

-- EXACT extracted before handler, not a parallel evaluator: app_private.workspace_role_identity_source_current_v1_at_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,timestamptz)
CREATE FUNCTION pg_temp.core12_before_8(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when others then return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_before_8(text,boolean) FROM PUBLIC;

-- EXACT extracted after handler, not a parallel evaluator: app_private.workspace_role_identity_source_current_v1_at_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,timestamptz)
CREATE FUNCTION pg_temp.core12_after_8(p_code text,p_control boolean) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $case$
BEGIN
 BEGIN
  IF p_code IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE=p_code,MESSAGE='synthetic_boundary_fault',DETAIL='synthetic_detail',HINT='synthetic_hint'; END IF;
  RETURN p_control;
  exception when sqlstate '40001' then raise; when others then return false;
 END;
END $case$;
REVOKE ALL ON FUNCTION pg_temp.core12_after_8(text,boolean) FROM PUBLIC;
CREATE TEMP TABLE core12_matrix(function_name text,code text,control boolean,expected_state text,expected_result boolean) ON COMMIT DROP;
INSERT INTO pg_temp.core12_matrix VALUES
('core12_before_1',NULL,true,NULL,true),
('core12_after_1',NULL,true,NULL,true),
('core12_before_1',NULL,false,NULL,false),
('core12_after_1',NULL,false,NULL,false),
('core12_before_1','40001',false,NULL,false),
('core12_after_1','40001',false,'40001',false),
('core12_before_1','57014',false,'57014',false),
('core12_after_1','57014',false,'57014',false),
('core12_before_1','42501',false,NULL,false),
('core12_after_1','42501',false,NULL,false),
('core12_before_1','22023',false,NULL,false),
('core12_after_1','22023',false,NULL,false),
('core12_before_1','42P01',false,NULL,false),
('core12_after_1','42P01',false,NULL,false),
('core12_before_1','40P01',false,NULL,false),
('core12_after_1','40P01',false,NULL,false),
('core12_before_1','XX000',false,NULL,false),
('core12_after_1','XX000',false,NULL,false),
('core12_before_1','P0001',false,NULL,false),
('core12_after_1','P0001',false,NULL,false),
('core12_before_1','P0004',false,'P0004',false),
('core12_after_1','P0004',false,'P0004',false),
('core12_before_2',NULL,true,NULL,true),
('core12_after_2',NULL,true,NULL,true),
('core12_before_2',NULL,false,NULL,false),
('core12_after_2',NULL,false,NULL,false),
('core12_before_2','40001',false,NULL,false),
('core12_after_2','40001',false,'40001',false),
('core12_before_2','57014',false,'57014',false),
('core12_after_2','57014',false,'57014',false),
('core12_before_2','42501',false,NULL,false),
('core12_after_2','42501',false,NULL,false),
('core12_before_2','22023',false,NULL,false),
('core12_after_2','22023',false,NULL,false),
('core12_before_2','42P01',false,NULL,false),
('core12_after_2','42P01',false,NULL,false),
('core12_before_2','40P01',false,NULL,false),
('core12_after_2','40P01',false,NULL,false),
('core12_before_2','XX000',false,NULL,false),
('core12_after_2','XX000',false,NULL,false),
('core12_before_2','P0001',false,NULL,false),
('core12_after_2','P0001',false,NULL,false),
('core12_before_2','P0004',false,'P0004',false),
('core12_after_2','P0004',false,'P0004',false),
('core12_before_3',NULL,true,NULL,true),
('core12_after_3',NULL,true,NULL,true),
('core12_before_3',NULL,false,NULL,false),
('core12_after_3',NULL,false,NULL,false),
('core12_before_3','40001',false,NULL,false),
('core12_after_3','40001',false,'40001',false),
('core12_before_3','57014',false,'57014',false),
('core12_after_3','57014',false,'57014',false),
('core12_before_3','42501',false,NULL,false),
('core12_after_3','42501',false,NULL,false),
('core12_before_3','22023',false,NULL,false),
('core12_after_3','22023',false,NULL,false),
('core12_before_3','42P01',false,NULL,false),
('core12_after_3','42P01',false,NULL,false),
('core12_before_3','40P01',false,NULL,false),
('core12_after_3','40P01',false,NULL,false),
('core12_before_3','XX000',false,NULL,false),
('core12_after_3','XX000',false,NULL,false),
('core12_before_3','P0001',false,NULL,false),
('core12_after_3','P0001',false,NULL,false),
('core12_before_3','P0004',false,'P0004',false),
('core12_after_3','P0004',false,'P0004',false),
('core12_before_4',NULL,true,NULL,true),
('core12_after_4',NULL,true,NULL,true),
('core12_before_4',NULL,false,NULL,false),
('core12_after_4',NULL,false,NULL,false),
('core12_before_4','40001',false,NULL,false),
('core12_after_4','40001',false,'40001',false),
('core12_before_4','57014',false,'57014',false),
('core12_after_4','57014',false,'57014',false),
('core12_before_4','42501',false,NULL,false),
('core12_after_4','42501',false,NULL,false),
('core12_before_4','22023',false,NULL,false),
('core12_after_4','22023',false,NULL,false),
('core12_before_4','42P01',false,NULL,false),
('core12_after_4','42P01',false,NULL,false),
('core12_before_4','40P01',false,NULL,false),
('core12_after_4','40P01',false,NULL,false),
('core12_before_4','XX000',false,NULL,false),
('core12_after_4','XX000',false,NULL,false),
('core12_before_4','P0001',false,NULL,false),
('core12_after_4','P0001',false,NULL,false),
('core12_before_4','P0004',false,'P0004',false),
('core12_after_4','P0004',false,'P0004',false),
('core12_before_5',NULL,true,NULL,true),
('core12_after_5',NULL,true,NULL,true),
('core12_before_5',NULL,false,NULL,false),
('core12_after_5',NULL,false,NULL,false),
('core12_before_5','40001',false,NULL,false),
('core12_after_5','40001',false,'40001',false),
('core12_before_5','57014',false,'57014',false),
('core12_after_5','57014',false,'57014',false),
('core12_before_5','42501',false,NULL,false),
('core12_after_5','42501',false,NULL,false),
('core12_before_5','22023',false,NULL,false),
('core12_after_5','22023',false,NULL,false),
('core12_before_5','42P01',false,NULL,false),
('core12_after_5','42P01',false,NULL,false),
('core12_before_5','40P01',false,NULL,false),
('core12_after_5','40P01',false,NULL,false),
('core12_before_5','XX000',false,NULL,false),
('core12_after_5','XX000',false,NULL,false),
('core12_before_5','P0001',false,NULL,false),
('core12_after_5','P0001',false,NULL,false),
('core12_before_5','P0004',false,'P0004',false),
('core12_after_5','P0004',false,'P0004',false),
('core12_before_6',NULL,true,NULL,true),
('core12_after_6',NULL,true,NULL,true),
('core12_before_6',NULL,false,NULL,false),
('core12_after_6',NULL,false,NULL,false),
('core12_before_6','40001',false,NULL,false),
('core12_after_6','40001',false,'40001',false),
('core12_before_6','57014',false,'57014',false),
('core12_after_6','57014',false,'57014',false),
('core12_before_6','42501',false,NULL,false),
('core12_after_6','42501',false,NULL,false),
('core12_before_6','22023',false,NULL,false),
('core12_after_6','22023',false,NULL,false),
('core12_before_6','42P01',false,NULL,false),
('core12_after_6','42P01',false,NULL,false),
('core12_before_6','40P01',false,NULL,false),
('core12_after_6','40P01',false,NULL,false),
('core12_before_6','XX000',false,NULL,false),
('core12_after_6','XX000',false,NULL,false),
('core12_before_6','P0001',false,NULL,false),
('core12_after_6','P0001',false,NULL,false),
('core12_before_6','P0004',false,'P0004',false),
('core12_after_6','P0004',false,'P0004',false),
('core12_before_7',NULL,true,NULL,true),
('core12_after_7',NULL,true,NULL,true),
('core12_before_7',NULL,false,NULL,false),
('core12_after_7',NULL,false,NULL,false),
('core12_before_7','40001',false,NULL,false),
('core12_after_7','40001',false,'40001',false),
('core12_before_7','57014',false,'57014',false),
('core12_after_7','57014',false,'57014',false),
('core12_before_7','42501',false,NULL,false),
('core12_after_7','42501',false,NULL,false),
('core12_before_7','22023',false,NULL,false),
('core12_after_7','22023',false,NULL,false),
('core12_before_7','42P01',false,NULL,false),
('core12_after_7','42P01',false,NULL,false),
('core12_before_7','40P01',false,NULL,false),
('core12_after_7','40P01',false,NULL,false),
('core12_before_7','XX000',false,NULL,false),
('core12_after_7','XX000',false,NULL,false),
('core12_before_7','P0001',false,NULL,false),
('core12_after_7','P0001',false,NULL,false),
('core12_before_7','P0004',false,'P0004',false),
('core12_after_7','P0004',false,'P0004',false),
('core12_before_8',NULL,true,NULL,true),
('core12_after_8',NULL,true,NULL,true),
('core12_before_8',NULL,false,NULL,false),
('core12_after_8',NULL,false,NULL,false),
('core12_before_8','40001',false,NULL,false),
('core12_after_8','40001',false,'40001',false),
('core12_before_8','57014',false,'57014',false),
('core12_after_8','57014',false,'57014',false),
('core12_before_8','42501',false,NULL,false),
('core12_after_8','42501',false,NULL,false),
('core12_before_8','22023',false,NULL,false),
('core12_after_8','22023',false,NULL,false),
('core12_before_8','42P01',false,NULL,false),
('core12_after_8','42P01',false,NULL,false),
('core12_before_8','40P01',false,NULL,false),
('core12_after_8','40P01',false,NULL,false),
('core12_before_8','XX000',false,NULL,false),
('core12_after_8','XX000',false,NULL,false),
('core12_before_8','P0001',false,NULL,false),
('core12_after_8','P0001',false,NULL,false),
('core12_before_8','P0004',false,'P0004',false),
('core12_after_8','P0004',false,'P0004',false);
DO $verify$ DECLARE t record; got text; msg text; detail text; hint text; value boolean; BEGIN
 FOR t IN SELECT * FROM pg_temp.core12_matrix LOOP
  got:=NULL; msg:=NULL; detail:=NULL; hint:=NULL; value:=NULL;
  BEGIN
   EXECUTE format('SELECT pg_temp.%I($1,$2)',t.function_name) INTO value USING t.code,t.control;
  EXCEPTION WHEN OTHERS OR query_canceled OR assert_failure THEN
   GET STACKED DIAGNOSTICS got=RETURNED_SQLSTATE,msg=MESSAGE_TEXT,detail=PG_EXCEPTION_DETAIL,hint=PG_EXCEPTION_HINT;
  END;
  IF got IS DISTINCT FROM t.expected_state OR (got IS NULL AND value IS DISTINCT FROM t.expected_result) THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='core12_boundary_oracle_failed'; END IF;
  IF got IS NOT NULL AND (msg<>'synthetic_boundary_fault' OR detail<>'synthetic_detail' OR hint<>'synthetic_hint') THEN RAISE EXCEPTION USING ERRCODE='P0001',MESSAGE='core12_bare_raise_diagnostics_changed'; END IF;
 END LOOP;
END $verify$;
ROLLBACK;
