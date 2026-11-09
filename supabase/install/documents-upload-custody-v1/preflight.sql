-- Fragment within an admitted owned-dev ONE transaction; never a browser binding.
DO $preflight$
DECLARE b jsonb;f record;actual text;
BEGIN
 b:=nullif(current_setting('cladora.documents.custody_install_binding',true),'')::jsonb;
 IF b IS NULL OR b->>'database_oid' IS DISTINCT FROM(SELECT oid::text FROM pg_database WHERE datname=current_database())
  OR b->>'backend_marker' IS DISTINCT FROM(SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='core_runtime')
  OR nullif(b->>'backend_marker','') IS NULL THEN RAISE EXCEPTION 'documents_custody_target_unbound' USING ERRCODE='55000'; END IF;
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR nullif(current_setting('cladora.documents.custody_install_receipt',true),'') IS NULL
  OR current_user<>session_user OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper)
  OR to_regclass('platform.document_upload_custody_v1') IS NOT NULL
  OR to_regprocedure('platform_dev.document_upload_custody_v1(text,jsonb)') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_document_custody_owner')
  OR to_regprocedure('app_private.require_request_session_current_at_v1(timestamptz)') IS NULL
  OR to_regprocedure('app_private.lock_core_request_session_v1()') IS NULL
  OR to_regprocedure('app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)') IS NULL
  OR to_regclass('platform.idempotency_keys') IS NULL
  OR to_regclass('documents.upload_intents') IS NULL
 THEN RAISE EXCEPTION 'documents_custody_install_not_admitted' USING ERRCODE='55000'; END IF;
 FOR f IN SELECT unnest(ARRAY['auth.uid()','auth.jwt()','app_private.lock_core_request_session_v1()',
  'app_private.require_request_session_current_at_v1(timestamp with time zone)',
  'app_private.resolve_workspace_native_context_v2(uuid,uuid)','app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)']) AS signature LOOP
  SELECT encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(f.signature)),'UTF8')),'hex') INTO actual;
  IF actual IS NULL OR actual IS DISTINCT FROM b->'helper_sha256'->>f.signature THEN RAISE EXCEPTION 'documents_custody_helper_pin_mismatch' USING ERRCODE='55000'; END IF;
 END LOOP;
END $preflight$;
