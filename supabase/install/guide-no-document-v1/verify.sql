-- Source only. Use the admitted installer/target after BOTH independent units.
-- A successful catalog result does not prove Auth/currentness/concurrency/DBtx.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $verify$
DECLARE obj record; name text; f record;
BEGIN
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR current_setting('cladora.guide.target_oid',true) IS DISTINCT FROM (SELECT oid::text FROM pg_database WHERE datname=current_database())
 OR current_setting('cladora.guide.target_marker',true) IS DISTINCT FROM (SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='core_runtime')
 THEN RAISE EXCEPTION 'guide_verify_target_mismatch' USING ERRCODE='55000'; END IF;
 FOREACH name IN ARRAY ARRAY['guides','guide_steps','guide_references','guide_save_receipts_v1'] LOOP
 SELECT c.*,r.rolname owner_name INTO obj FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE c.oid=to_regclass('experience.'||name);
 IF NOT FOUND OR obj.owner_name<>current_user OR NOT obj.relrowsecurity OR NOT obj.relforcerowsecurity
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(obj.relacl,acldefault('r',obj.relowner))) a
  WHERE a.grantee<>obj.relowner AND (a.grantee IS DISTINCT FROM (SELECT oid FROM pg_roles WHERE rolname='cladora_ce_guide_executor') OR a.is_grantable OR a.privilege_type NOT IN('SELECT','INSERT')))
 THEN RAISE EXCEPTION 'guide_verify_table_owner_rls_acl' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='experience.guide_references'::regclass AND conname='core_guide_no_document_references_v1' AND convalidated)
 OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='experience.guide_save_receipts_v1'::regclass AND tgname='ce012_save_core_binding_v1' AND tgdeferrable AND tginitdeferred AND tgenabled='O')
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='experience.guide_save_receipts_v1'::regclass AND conname='ce012_save_document_free_v1' AND convalidated)
 THEN RAISE EXCEPTION 'guide_verify_constraints_trigger' USING ERRCODE='55000'; END IF;
 FOR f IN SELECT * FROM (VALUES
 ('app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamp with time zone)','83a291859f57e65669c4c98be1427e7d8e6de2f55fef5773e8f186b26a6dcd02'),
 ('app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamp with time zone)','e4751af691e09ea2652d2a7bef1ecb2f490d0969bbfd1445b0c99717c0fe8fbc')) AS e(sig,sha) LOOP
 IF (SELECT encode(sha256(convert_to(pg_get_functiondef(oid),'UTF8')),'hex') FROM pg_proc WHERE oid=to_regprocedure(f.sig)) IS DISTINCT FROM f.sha
 OR NOT has_function_privilege('cladora_ce_guide_executor',f.sig,'EXECUTE')
 THEN RAISE EXCEPTION 'guide_verify_shared_helper_mismatch' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM pg_auth_members m WHERE m.member IN(SELECT oid FROM pg_roles WHERE rolname IN('cladora_ce_guide_runtime','cladora_ce_guide_executor')) OR m.roleid IN(SELECT oid FROM pg_roles WHERE rolname IN('cladora_ce_guide_runtime','cladora_ce_guide_executor')))<>1
 OR NOT EXISTS(SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.roleid JOIN pg_roles u ON u.oid=m.member WHERE r.rolname='cladora_ce_guide_executor' AND u.rolname='cladora_ce_guide_runtime' AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option)
 THEN RAISE EXCEPTION 'guide_verify_role_graph' USING ERRCODE='55000'; END IF;
 FOREACH name IN ARRAY ARRAY['identity.context_grants','identity.memberships','platform.customer_workspaces','app_private.canonical_authority_revision_v1'] LOOP
 IF NOT has_column_privilege('cladora_ce_guide_executor',name,CASE WHEN name LIKE '%revision%' THEN 'singleton' ELSE 'id' END,'UPDATE') THEN RAISE EXCEPTION 'guide_verify_for_share_privilege' USING ERRCODE='55000'; END IF;
 END LOOP;
END $verify$;
SELECT jsonb_build_object('contract','core-guide-install-verify.v1','catalog_checks','passed',
 'backend_pid',pg_backend_pid(),'database_oid',(SELECT oid FROM pg_database WHERE datname=current_database()),
 'runtime',NULL,'activation',NULL,'native_flow','NOT_RUN_NOT_PASS');
ROLLBACK;
