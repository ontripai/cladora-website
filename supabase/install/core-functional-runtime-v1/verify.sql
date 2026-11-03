-- Read-only verification SOURCE. Execute only after verified owned-target admission.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $verify$
DECLARE name text; f regprocedure;
BEGIN
 IF current_database()!~'^cladora_dev_[a-z0-9_]+$'
  OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
 THEN RAISE EXCEPTION 'core15_owned_development_target_required' USING ERRCODE='55000'; END IF;
 FOREACH name IN ARRAY ARRAY['platform.provider_agreement_heads_v1','platform.provider_agreement_versions_v1'] LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_class WHERE oid=to_regclass(name) AND relrowsecurity AND relforcerowsecurity)
   THEN RAISE EXCEPTION 'core15_store_rls_mismatch' USING ERRCODE='55000'; END IF;
  IF has_table_privilege('cladora_core_runtime',name,'INSERT') OR has_table_privilege('cladora_core_runtime',name,'DELETE')
   THEN RAISE EXCEPTION 'core15_store_runtime_write_acl' USING ERRCODE='55000'; END IF;
 END LOOP;
 FOREACH name IN ARRAY ARRAY['app_private.lock_core_request_session_v1()',
  'app_private.core_functional_checkpoint_v1(uuid,uuid,text,text,bigint)',
  'app_private.apply_service_v14_execution_v1(text,jsonb)',
  'app_private.resolve_service_v14_execution_source_v1(uuid,uuid,uuid,bigint,bigint)'] LOOP
  f:=to_regprocedure(name);
  IF f IS NULL OR NOT has_function_privilege('cladora_core_runtime',f,'EXECUTE')
   OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
    WHERE p.oid=f AND a.grantee=0 AND a.privilege_type='EXECUTE')
   THEN RAISE EXCEPTION 'core15_function_acl_mismatch' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF has_table_privilege('cladora_core_runtime','auth.sessions','SELECT')
  OR has_table_privilege('cladora_core_runtime','auth.sessions','UPDATE')
  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_core_runtime' AND
   (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication))
 THEN RAISE EXCEPTION 'core15_privileged_runtime_mismatch' USING ERRCODE='55000'; END IF;
END
$verify$;
-- Catalog metadata only: not actual session/row-lock/currentness/persistence proof.
SELECT jsonb_build_object('database',current_database(),'database_oid',(SELECT oid FROM pg_database WHERE datname=current_database()),
 'backend_pid',pg_backend_pid(),'version',current_setting('server_version_num'),
 'store_constraints',(SELECT count(*) FROM pg_constraint WHERE conrelid IN
 ('platform.provider_agreement_heads_v1'::regclass,'platform.provider_agreement_versions_v1'::regclass))) AS verification;
ROLLBACK;
