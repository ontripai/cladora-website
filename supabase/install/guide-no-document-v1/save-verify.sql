-- Post-unit20 structural assertions only. No command/receipt/fixture is created.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $verify$
DECLARE tab record; tr record;
BEGIN
 SELECT * INTO STRICT tab FROM pg_class WHERE oid='experience.guide_save_receipts_v1'::regclass;
 IF NOT tab.relrowsecurity OR NOT tab.relforcerowsecurity
  OR obj_description(tab.oid,'pg_class') NOT LIKE 'core-guide-save-adoption.v1;%'
 THEN RAISE EXCEPTION 'guide_save_verify_rls_or_lineage' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT tr FROM pg_trigger WHERE tgrelid=tab.oid AND tgname='ce012_save_core_binding_v1';
 IF NOT tr.tgdeferrable OR NOT tr.tginitdeferred OR tr.tgenabled<>'O'
 THEN RAISE EXCEPTION 'guide_save_verify_deferred_binding' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid=tab.oid AND conname='ce012_save_document_free_v1' AND convalidated)
  OR NOT EXISTS(SELECT 1 FROM pg_index WHERE indrelid=tab.oid AND indisprimary AND indisvalid AND indisready)
  OR NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_index i ON i.indexrelid=c.oid
    WHERE i.indrelid=tab.oid AND c.relname='ce012_save_receipt_id_v1' AND i.indisunique AND i.indisvalid)
 THEN RAISE EXCEPTION 'guide_save_verify_constraints' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid IN
   ('app_private.ce012_save_receipt_immutable_v1()'::regprocedure,'app_private.ce012_save_core_binding_v1()'::regprocedure)
   AND (p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]))
 THEN RAISE EXCEPTION 'guide_save_verify_function_boundary' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM aclexplode(tab.relacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
  WHERE a.grantee<>tab.relowner AND (r.rolname IS DISTINCT FROM 'cladora_ce_guide_executor' OR a.is_grantable OR a.privilege_type NOT IN ('SELECT','INSERT')))
 THEN RAISE EXCEPTION 'guide_save_verify_acl' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=tab.oid AND polname='core_guide_save_lock_v1'
    AND polcmd='w' AND pg_get_expr(polwithcheck,polrelid)='false')
 THEN RAISE EXCEPTION 'guide_save_verify_lock_ceiling' USING ERRCODE='55000'; END IF;
END $verify$;
-- Preserve actual definitions/ACL/constraint/policy fingerprints with the private
-- preflight and native functional oracle. These assertions alone are not full acceptance.
SELECT 'core-guide-save-verify.v1' AS contract,pg_backend_pid() AS backend_pid,
 to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS observed_at;
ROLLBACK;
