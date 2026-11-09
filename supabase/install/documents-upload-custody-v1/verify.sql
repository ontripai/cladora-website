DO $verify$
DECLARE own oid;f record;
BEGIN
 SELECT oid INTO STRICT own FROM pg_roles WHERE rolname='cladora_document_custody_owner'
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication);
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid=own OR member=own)
  OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN('platform','platform_dev','app_private','auth') AND has_schema_privilege(own,oid,'CREATE'))
  OR NOT EXISTS(SELECT 1 FROM pg_class WHERE oid='platform.document_upload_custody_v1'::regclass AND relowner=own AND relrowsecurity AND relforcerowsecurity)
  OR NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='platform.document_upload_custody_v1'::regclass AND tgname='document_upload_custody_immutable_v1' AND tgenabled IN('O','A') AND NOT tgisinternal)
 THEN RAISE EXCEPTION 'documents_custody_poststate_invalid' USING ERRCODE='55000'; END IF;
 FOR f IN SELECT * FROM pg_proc WHERE oid IN('platform_dev.document_upload_custody_v1(text,jsonb)'::regprocedure,'app_private.document_upload_custody_immutable_v1()'::regprocedure) LOOP
  IF f.proowner<>own OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a
     WHERE a.grantee NOT IN(own,'authenticated'::regrole) OR a.is_grantable AND a.grantee<>own)
  THEN RAISE EXCEPTION 'documents_custody_function_boundary' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF NOT has_function_privilege('authenticated','platform_dev.document_upload_custody_v1(text,jsonb)','EXECUTE')
  OR EXISTS(SELECT 1 FROM unnest(ARRAY['anon','authenticated','service_role']) r
   WHERE has_table_privilege(r,'platform.document_upload_custody_v1','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
    OR has_any_column_privilege(r,'platform.document_upload_custody_v1','SELECT,INSERT,UPDATE'))
  OR has_table_privilege('cladora_document_custody_owner','platform.idempotency_keys','INSERT,DELETE,TRUNCATE')
  OR EXISTS(SELECT 1 FROM pg_class c,LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='platform.document_upload_custody_v1'::regclass AND a.grantee NOT IN(own,'cladora_core_runtime'::regrole))
  OR has_table_privilege('cladora_core_runtime','platform.document_upload_custody_v1','INSERT,DELETE,TRUNCATE')
 THEN RAISE EXCEPTION 'documents_custody_acl_ceiling' USING ERRCODE='55000'; END IF;
-- CORE_DOCUMENTS_BODY_PINS
END $verify$;
