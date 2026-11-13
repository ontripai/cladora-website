-- Core canonical preparation metadata, NOT a second command/receipt ledger.
-- Compose BEGIN/deadlines + preflight + this fragment + verify + COMMIT.
-- Actual admitted lifecycle custodian only; never infer capability from its name.
CREATE ROLE cladora_document_custody_owner NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOREPLICATION PASSWORD NULL;
GRANT USAGE ON SCHEMA platform,platform_dev,app_private,auth,identity TO cladora_document_custody_owner;
GRANT EXECUTE ON FUNCTION auth.uid(),auth.jwt(),app_private.lock_core_request_session_v1(),
 app_private.require_request_session_current_at_v1(timestamptz),
 app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamptz),
 app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamptz) TO cladora_document_custody_owner;
GRANT SELECT(tenant_id,actor_id,key,request_hash,response_ref,expires_at),UPDATE(key) ON platform.idempotency_keys TO cladora_document_custody_owner;
GRANT SELECT(revision,singleton),UPDATE(revision) ON app_private.canonical_authority_revision_v1 TO cladora_document_custody_owner;
-- Scoped policy is required even if the lifecycle custodian could bypass RLS.
CREATE POLICY documents_custody_c03_read_v1 ON platform.idempotency_keys FOR SELECT TO cladora_document_custody_owner
 USING(actor_id=auth.uid());
CREATE POLICY documents_custody_c03_lock_v1 ON platform.idempotency_keys FOR UPDATE TO cladora_document_custody_owner USING(actor_id=auth.uid()) WITH CHECK(false);
CREATE POLICY documents_custody_epoch_lock_v1 ON app_private.canonical_authority_revision_v1 FOR UPDATE TO cladora_document_custody_owner USING(singleton) WITH CHECK(false);
CREATE POLICY documents_custody_c03_no_write_v1 ON platform.idempotency_keys AS RESTRICTIVE FOR UPDATE TO cladora_document_custody_owner USING(actor_id=auth.uid()) WITH CHECK(false);
CREATE POLICY documents_custody_epoch_no_write_v1 ON app_private.canonical_authority_revision_v1 AS RESTRICTIVE FOR UPDATE TO cladora_document_custody_owner USING(singleton) WITH CHECK(false);
CREATE POLICY documents_custody_epoch_read_v1 ON app_private.canonical_authority_revision_v1 FOR SELECT TO cladora_document_custody_owner USING(singleton);
GRANT CREATE ON SCHEMA platform,platform_dev,app_private TO cladora_document_custody_owner;
CREATE TABLE platform.document_upload_custody_v1(
 tenant_id uuid NOT NULL,workspace_id uuid NOT NULL,context_id uuid NOT NULL,
 membership_id uuid NOT NULL,actor_id uuid NOT NULL,issue_key text NOT NULL,
 request_sha256 text NOT NULL CHECK(request_sha256~'^[a-f0-9]{64}$'),
 snapshot jsonb NOT NULL CHECK(jsonb_typeof(snapshot)='object'),
 intent_id uuid NOT NULL UNIQUE,document_id uuid NOT NULL UNIQUE,version_id uuid NOT NULL UNIQUE,
 issue_transaction_id uuid NOT NULL UNIQUE,issue_command_id uuid NOT NULL UNIQUE,
 final_transaction_id uuid NOT NULL UNIQUE,final_command_id uuid NOT NULL UNIQUE,
 authority_version bigint NOT NULL CHECK(authority_version BETWEEN 1 AND 9007199254740991),
 expires_at timestamptz NOT NULL,issue_input jsonb NOT NULL,
 command_wire text,command_sha256 text,receipt_id uuid,
 phase text NOT NULL DEFAULT 'prepared' CHECK(phase IN('prepared','sealed','retained','stream_admitted')),
 final_key text,final_command_wire text,final_command_sha256 text,dispatch_started boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_id,workspace_id,actor_id,issue_key),
 CHECK((command_wire IS NULL)=(command_sha256 IS NULL)),
 CHECK(command_sha256 IS NULL OR(command_sha256~'^[a-f0-9]{64}$' AND command_sha256=encode(sha256(convert_to(command_wire,'UTF8')),'hex'))),
 CHECK(phase='prepared' OR command_wire IS NOT NULL),
 CHECK(phase IN('prepared','sealed') OR receipt_id IS NOT NULL),
 CHECK(phase<>'stream_admitted' OR final_key IS NOT NULL),
 CHECK(phase IN('prepared','sealed') OR dispatch_started),
 CHECK((final_command_wire IS NULL)=(final_command_sha256 IS NULL)),
 CHECK(final_command_wire IS NULL OR(final_key IS NOT NULL AND final_command_sha256=encode(sha256(convert_to(final_command_wire,'UTF8')),'hex')))
);
ALTER TABLE platform.document_upload_custody_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.document_upload_custody_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON platform.document_upload_custody_v1 FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE platform.document_upload_custody_v1 OWNER TO cladora_document_custody_owner;
CREATE POLICY documents_custody_owner_v1 ON platform.document_upload_custody_v1 TO cladora_document_custody_owner USING(true) WITH CHECK(true);

CREATE FUNCTION app_private.document_upload_custody_immutable_v1() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $immutable$
BEGIN
 IF (to_jsonb(NEW)-ARRAY['command_wire','command_sha256','receipt_id','phase','final_key','dispatch_started','final_command_wire','final_command_sha256']) IS DISTINCT FROM
    (to_jsonb(OLD)-ARRAY['command_wire','command_sha256','receipt_id','phase','final_key','dispatch_started','final_command_wire','final_command_sha256'])
  OR(OLD.command_wire IS NOT NULL AND (NEW.command_wire IS DISTINCT FROM OLD.command_wire OR NEW.command_sha256 IS DISTINCT FROM OLD.command_sha256))
  OR(OLD.receipt_id IS NOT NULL AND NEW.receipt_id IS DISTINCT FROM OLD.receipt_id)
  OR(OLD.final_key IS NOT NULL AND NEW.final_key IS DISTINCT FROM OLD.final_key)
  OR(OLD.final_command_wire IS NOT NULL AND(NEW.final_command_wire IS DISTINCT FROM OLD.final_command_wire OR NEW.final_command_sha256 IS DISTINCT FROM OLD.final_command_sha256))
  OR(OLD.dispatch_started AND NOT NEW.dispatch_started)
  OR NOT((OLD.phase='stream_admitted' AND NEW.phase='stream_admitted' AND OLD.final_command_wire IS NULL AND NEW.final_command_wire IS NOT NULL) OR(OLD.phase='sealed' AND NEW.phase='sealed' AND NOT OLD.dispatch_started AND NEW.dispatch_started) OR(OLD.phase='prepared' AND NEW.phase='sealed') OR(OLD.phase='sealed' AND NEW.phase='retained') OR(OLD.phase='retained' AND NEW.phase='stream_admitted'))
 THEN RAISE EXCEPTION 'documents_custody_immutable_binding' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $immutable$;
REVOKE ALL ON FUNCTION app_private.document_upload_custody_immutable_v1() FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION app_private.document_upload_custody_immutable_v1() OWNER TO cladora_document_custody_owner;
CREATE TRIGGER document_upload_custody_immutable_v1 BEFORE UPDATE ON platform.document_upload_custody_v1 FOR EACH ROW EXECUTE FUNCTION app_private.document_upload_custody_immutable_v1();
GRANT SELECT ON platform.document_upload_custody_v1 TO cladora_core_runtime;
GRANT UPDATE(issue_key) ON platform.document_upload_custody_v1 TO cladora_core_runtime;
CREATE POLICY documents_custody_runtime_read_v1 ON platform.document_upload_custody_v1 FOR SELECT TO cladora_core_runtime
 USING(actor_id=auth.uid() AND tenant_id=app_private.active_tenant_id()
  AND context_id=nullif(current_setting('request.cladora.context_id',true),'')::uuid
  AND workspace_id=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid
  AND app_private.check_workspace_native_permission_v2(context_id,workspace_id,'documents.vault.upload','documents'));
CREATE POLICY documents_custody_runtime_lock_v1 ON platform.document_upload_custody_v1 FOR UPDATE TO cladora_core_runtime
 USING(actor_id=auth.uid() AND tenant_id=app_private.active_tenant_id()
  AND context_id=nullif(current_setting('request.cladora.context_id',true),'')::uuid
  AND workspace_id=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid) WITH CHECK(false);
CREATE FUNCTION platform_dev.document_upload_custody_v1(p_phase text,p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $custody$
DECLARE actor uuid;ctx uuid;ws uuid;tenant uuid;member uuid;rev bigint;r platform.document_upload_custody_v1%rowtype;
 snap jsonb;wire text;key text;fresh boolean:=false;fresh_dispatch boolean:=false;c jsonb;stored record;observed_at timestamptz;checked_at timestamptz;current_scope record;
BEGIN
 IF p_phase NOT IN('prepare','seal','dispatch','retain','seal_final','peek','claim','resume') OR p_phase IS NULL
  OR jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR octet_length(p_request::text)>32768
  OR p_request-array['context_id','workspace_id','idempotency_key','request_sha256','snapshot','snapshot_wire','intent_id','command_wire','intent_input_wire']<>'{}'
 THEN RAISE EXCEPTION 'documents_custody_invalid' USING ERRCODE='22023'; END IF;
 actor:=auth.uid();ctx:=(p_request->>'context_id')::uuid;ws:=(p_request->>'workspace_id')::uuid;key:=p_request->>'idempotency_key';
 IF actor IS NULL OR auth.jwt()->>'role' IS DISTINCT FROM 'authenticated' OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'
  OR ctx IS NULL OR ws IS NULL OR key IS NULL OR key!~'^[A-Za-z0-9._:-]{8,128}$'
 THEN RAISE EXCEPTION 'documents_custody_denied' USING ERRCODE='42501'; END IF;
 PERFORM app_private.lock_core_request_session_v1();
 SELECT revision INTO STRICT rev FROM app_private.canonical_authority_revision_v1 WHERE singleton FOR SHARE;
 SELECT v.tenant_id,v.membership_id INTO STRICT tenant,member FROM app_private.resolve_workspace_native_context_v2_at_v1(ctx,ws,clock_timestamp()) v;
 -- Preparation and stream admission lock the SAME row; read/recovery uses SHARE.
 IF p_phase IN('prepare','seal','dispatch','retain','claim','seal_final') THEN
  PERFORM pg_advisory_xact_lock(hashtextextended('documents-custody:'||tenant::text||':'||ws::text||':'||actor::text||':'||coalesce(p_request->>'intent_id',key),0));
 END IF;
 IF p_phase IN('prepare','seal','dispatch','retain') THEN
  SELECT * INTO r FROM platform.document_upload_custody_v1 WHERE tenant_id=tenant AND workspace_id=ws AND actor_id=actor AND issue_key=key FOR UPDATE;
 ELSE
  IF p_phase IN('claim','seal_final') THEN
   SELECT * INTO r FROM platform.document_upload_custody_v1 WHERE tenant_id=tenant AND workspace_id=ws AND actor_id=actor AND intent_id=(p_request->>'intent_id')::uuid FOR UPDATE;
  ELSE
   SELECT * INTO r FROM platform.document_upload_custody_v1 WHERE tenant_id=tenant AND workspace_id=ws AND actor_id=actor AND intent_id=(p_request->>'intent_id')::uuid FOR SHARE;
  END IF;
 END IF;
 -- Authority/session/clock are renewed AFTER all above lock waits, same backend.
 -- FRESH_CUSTODY_CHECKPOINT_DOCS_ROW_WAIT_BEGIN
 checked_at:=clock_timestamp();
 PERFORM app_private.require_request_session_current_at_v1(checked_at);
 SELECT v.tenant_id,v.membership_id INTO STRICT current_scope
  FROM app_private.resolve_workspace_native_context_v2_at_v1(ctx,ws,checked_at) v;
 IF current_scope.tenant_id IS DISTINCT FROM tenant OR current_scope.membership_id IS DISTINCT FROM member
  OR app_private.check_workspace_native_permission_v2_at_v1(ctx,ws,'documents.vault.upload','documents',checked_at) IS NOT true
 THEN RAISE EXCEPTION 'documents_custody_denied' USING ERRCODE='42501'; END IF;
 -- FRESH_CUSTODY_CHECKPOINT_DOCS_ROW_WAIT_END
 observed_at:=clock_timestamp();
 IF r.intent_id IS NULL AND p_phase<>'prepare' THEN RETURN NULL; END IF;
 IF r.intent_id IS NULL THEN
  snap:=p_request->'snapshot';wire:=p_request->>'snapshot_wire';
  IF jsonb_typeof(snap) IS DISTINCT FROM 'object' OR NOT(snap ?& ARRAY['context_id','workspace_id','filename','declared_mime','size_bytes','title','document_type','classification','property_id'])
   OR snap-array['context_id','workspace_id','filename','declared_mime','size_bytes','title','document_type','classification','property_id']<>'{}'
   OR EXISTS(SELECT 1 FROM jsonb_each(snap) x WHERE x.key<>'property_id' AND x.value='null'::jsonb)
   OR wire IS NULL OR octet_length(wire)>8192 OR wire::jsonb IS DISTINCT FROM snap
   OR encode(sha256(convert_to(wire,'UTF8')),'hex') IS DISTINCT FROM p_request->>'request_sha256'
   OR snap->>'context_id' IS DISTINCT FROM ctx::text OR snap->>'workspace_id' IS DISTINCT FROM ws::text
   OR snap->'property_id' IS DISTINCT FROM 'null'::jsonb
   OR (snap->>'size_bytes')::integer NOT BETWEEN 1 AND 20971520
   OR length(snap->>'filename') NOT BETWEEN 1 AND 255 OR length(snap->>'title') NOT BETWEEN 1 AND 500
   OR length(snap->>'document_type') NOT BETWEEN 1 AND 120
   OR snap->>'classification' NOT IN('public','internal','confidential','restricted')
   OR snap->>'declared_mime' NOT IN('application/pdf','image/jpeg','image/png','image/webp','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  THEN RAISE EXCEPTION 'documents_custody_invalid_snapshot' USING ERRCODE='22023'; END IF;
  r.intent_id:=gen_random_uuid();r.document_id:=gen_random_uuid();r.version_id:=gen_random_uuid();
  r.issue_transaction_id:=gen_random_uuid();r.issue_command_id:=gen_random_uuid();r.final_transaction_id:=gen_random_uuid();r.final_command_id:=gen_random_uuid();
  r.expires_at:=observed_at+interval '15 minutes';
  r.issue_input:=jsonb_build_object('contract_version','documents-new-document-intent.v1','context_id',ctx,'workspace_id',ws,
   'intent_id',r.intent_id,'prospective_document_id',r.document_id,'filename',snap->>'filename',
   'object_path',tenant::text||'/'||r.intent_id::text||'/v1.bin','declared_mime_type',snap->>'declared_mime','max_size_bytes',(snap->>'size_bytes')::integer,
   'expires_at',to_char(r.expires_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),'idempotency_key',key);
  INSERT INTO platform.document_upload_custody_v1(tenant_id,workspace_id,context_id,membership_id,actor_id,issue_key,request_sha256,snapshot,
   intent_id,document_id,version_id,issue_transaction_id,issue_command_id,final_transaction_id,final_command_id,authority_version,expires_at,issue_input)
  VALUES(tenant,ws,ctx,member,actor,key,p_request->>'request_sha256',snap,r.intent_id,r.document_id,r.version_id,r.issue_transaction_id,r.issue_command_id,r.final_transaction_id,r.final_command_id,rev,r.expires_at,r.issue_input) RETURNING * INTO r;
 END IF;
 IF r.context_id<>ctx OR r.membership_id<>member OR r.expires_at<=observed_at
  OR r.request_sha256 IS DISTINCT FROM p_request->>'request_sha256' THEN
  RAISE EXCEPTION 'documents_custody_binding_conflict' USING ERRCODE='23505'; END IF;
 IF p_phase='prepare' AND r.snapshot IS DISTINCT FROM p_request->'snapshot' THEN
  RAISE EXCEPTION 'documents_custody_snapshot_conflict' USING ERRCODE='23505'; END IF;
 IF p_phase='seal' THEN
  wire:=p_request->>'command_wire';c:=wire::jsonb;
  IF wire IS NULL OR octet_length(wire)>16384 OR (p_request->>'intent_input_wire')::jsonb IS DISTINCT FROM r.issue_input
   OR c->>'contract_version' IS DISTINCT FROM 'core-transaction-command.v1'
   OR c->>'transaction_id' IS DISTINCT FROM r.issue_transaction_id::text OR c->>'command_id' IS DISTINCT FROM r.issue_command_id::text
   OR c->>'context_id' IS DISTINCT FROM ctx::text OR c->>'workspace_id' IS DISTINCT FROM ws::text OR c->>'actor_id' IS DISTINCT FROM actor::text
   OR c->>'aggregate_id' IS DISTINCT FROM r.document_id::text OR c->>'aggregate_type' IS DISTINCT FROM 'documents.document'
   OR c->>'aggregate_version' IS DISTINCT FROM '1' OR c->>'authority_version' IS DISTINCT FROM r.authority_version::text
   OR c->>'permission_code' IS DISTINCT FROM 'documents.vault.upload' OR c->>'module_code' IS DISTINCT FROM 'documents'
   OR c->>'evaluation_purpose' IS DISTINCT FROM 'documents.workspace_upload.intent' OR c->>'idempotency_key' IS DISTINCT FROM r.issue_key
   OR c->'provider_source_ids' IS DISTINCT FROM jsonb_build_array(r.intent_id,r.document_id)
   OR c->>'input_fingerprint' IS DISTINCT FROM 'docwi1:'||encode(sha256(convert_to('{"input":'||(p_request->>'intent_input_wire')||',"actor_id":"'||actor::text||'"}','UTF8')),'hex')
  THEN RAISE EXCEPTION 'documents_custody_command_conflict' USING ERRCODE='23505'; END IF;
  IF r.command_wire IS NOT NULL AND r.command_wire<>wire THEN RAISE EXCEPTION 'documents_custody_seal_conflict' USING ERRCODE='23505'; END IF;
  IF r.command_wire IS NULL THEN UPDATE platform.document_upload_custody_v1 SET command_wire=wire,command_sha256=encode(sha256(convert_to(wire,'UTF8')),'hex'),phase='sealed' WHERE intent_id=r.intent_id RETURNING * INTO r; END IF;
 END IF;
 IF p_phase='seal_final' THEN
  wire:=p_request->>'command_wire';c:=wire::jsonb;
  IF wire IS NULL OR octet_length(wire)>16384 OR r.phase<>'stream_admitted' OR r.final_key IS DISTINCT FROM key
   OR c->>'contract_version' IS DISTINCT FROM 'core-transaction-command.v1'
   OR c->>'transaction_id' IS DISTINCT FROM r.final_transaction_id::text OR c->>'command_id' IS DISTINCT FROM r.final_command_id::text
   OR c->>'context_id' IS DISTINCT FROM ctx::text OR c->>'workspace_id' IS DISTINCT FROM ws::text OR c->>'actor_id' IS DISTINCT FROM actor::text
   OR c->>'aggregate_id' IS DISTINCT FROM r.document_id::text OR c->>'aggregate_type' IS DISTINCT FROM 'documents.document'
   OR c->>'aggregate_version' IS DISTINCT FROM '1' OR c->>'authority_version' IS DISTINCT FROM r.authority_version::text
   OR c->>'permission_code' IS DISTINCT FROM 'documents.vault.upload' OR c->>'module_code' IS DISTINCT FROM 'documents'
   OR c->>'evaluation_purpose' IS DISTINCT FROM 'documents.workspace_upload.finalize' OR c->>'idempotency_key' IS DISTINCT FROM r.final_key
   OR c->'provider_source_ids' IS DISTINCT FROM jsonb_build_array(r.intent_id,r.document_id,r.version_id)
   OR coalesce((c->>'input_fingerprint')~'^docwf1:[a-f0-9]{64}$',false) IS NOT true
  THEN RAISE EXCEPTION 'documents_custody_final_wire_conflict' USING ERRCODE='23505'; END IF;
  IF r.final_command_wire IS NOT NULL AND r.final_command_wire<>wire THEN RAISE EXCEPTION 'documents_custody_final_fingerprint_conflict' USING ERRCODE='23505'; END IF;
  IF r.final_command_wire IS NULL THEN UPDATE platform.document_upload_custody_v1 SET final_command_wire=wire,final_command_sha256=encode(sha256(convert_to(wire,'UTF8')),'hex') WHERE intent_id=r.intent_id RETURNING * INTO r; END IF;
 END IF;
 IF p_phase='dispatch' AND r.phase='sealed' AND NOT r.dispatch_started THEN
  UPDATE platform.document_upload_custody_v1 SET dispatch_started=true WHERE intent_id=r.intent_id AND NOT dispatch_started RETURNING * INTO r;fresh_dispatch:=FOUND;
 END IF;
 IF p_phase IN('retain','claim','resume') THEN
  SELECT k.actor_id,k.request_hash,k.response_ref,k.expires_at INTO stored FROM platform.idempotency_keys k
   WHERE k.tenant_id=tenant AND k.key='core-tx.v1:'||ws::text||':'||r.issue_key FOR SHARE;
  -- C03 is the ONLY receipt authority. A caller flag/JSON is never read here.
  IF NOT FOUND OR stored.actor_id<>actor OR stored.request_hash IS DISTINCT FROM r.command_sha256
   OR stored.response_ref->>'contract_version' IS DISTINCT FROM 'core-transaction-receipt.v1'
   OR stored.response_ref->>'transaction_id' IS DISTINCT FROM r.issue_transaction_id::text OR stored.response_ref->>'command_id' IS DISTINCT FROM r.issue_command_id::text
   OR stored.response_ref->>'workspace_id' IS DISTINCT FROM ws::text OR stored.response_ref->>'actor_id' IS DISTINCT FROM actor::text
   OR stored.response_ref->>'aggregate_id' IS DISTINCT FROM r.document_id::text OR stored.response_ref->>'mutation_id' IS DISTINCT FROM r.intent_id::text
   OR stored.response_ref->>'input_fingerprint' IS DISTINCT FROM (r.command_wire::jsonb)->>'input_fingerprint'
  THEN RAISE EXCEPTION 'documents_custody_receipt_unavailable' USING ERRCODE='55000'; END IF;
  -- ledger lock could wait; renew C01 and real expiry before touching custody.
 -- FRESH_CUSTODY_CHECKPOINT_DOCS_LEDGER_WAIT_BEGIN
 checked_at:=clock_timestamp();
 PERFORM app_private.require_request_session_current_at_v1(checked_at);
 SELECT v.tenant_id,v.membership_id INTO STRICT current_scope
  FROM app_private.resolve_workspace_native_context_v2_at_v1(ctx,ws,checked_at) v;
 IF current_scope.tenant_id IS DISTINCT FROM tenant OR current_scope.membership_id IS DISTINCT FROM member
  OR app_private.check_workspace_native_permission_v2_at_v1(ctx,ws,'documents.vault.upload','documents',checked_at) IS NOT true
 THEN RAISE EXCEPTION 'documents_custody_denied' USING ERRCODE='42501'; END IF;
 -- FRESH_CUSTODY_CHECKPOINT_DOCS_LEDGER_WAIT_END
  IF r.expires_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM platform.idempotency_keys k WHERE k.tenant_id=tenant AND k.key='core-tx.v1:'||ws::text||':'||r.issue_key AND k.expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'documents_custody_expired' USING ERRCODE='55000'; END IF;
  IF p_phase='retain' AND r.phase='sealed' THEN UPDATE platform.document_upload_custody_v1 SET receipt_id=(stored.response_ref->>'receipt_id')::uuid,phase='retained' WHERE intent_id=r.intent_id RETURNING * INTO r; END IF;
  IF p_phase='claim' THEN
   IF r.final_key IS NOT NULL AND r.final_key<>key THEN RAISE EXCEPTION 'documents_custody_final_key_conflict' USING ERRCODE='23505'; END IF;
   IF r.phase='retained' THEN UPDATE platform.document_upload_custody_v1 SET final_key=key,phase='stream_admitted' WHERE intent_id=r.intent_id AND phase='retained' RETURNING * INTO r;fresh:=FOUND; END IF;
  END IF;
 END IF;
 -- FRESH_CUSTODY_CHECKPOINT_DOCS_FINAL_EFFECT_WAIT_BEGIN
 checked_at:=clock_timestamp();
 PERFORM app_private.require_request_session_current_at_v1(checked_at);
 SELECT v.tenant_id,v.membership_id INTO STRICT current_scope
  FROM app_private.resolve_workspace_native_context_v2_at_v1(ctx,ws,checked_at) v;
 IF current_scope.tenant_id IS DISTINCT FROM tenant OR current_scope.membership_id IS DISTINCT FROM member
  OR app_private.check_workspace_native_permission_v2_at_v1(ctx,ws,'documents.vault.upload','documents',checked_at) IS NOT true
 THEN RAISE EXCEPTION 'documents_custody_denied' USING ERRCODE='42501'; END IF;
 -- FRESH_CUSTODY_CHECKPOINT_DOCS_FINAL_EFFECT_WAIT_END
 IF r.expires_at<=checked_at THEN RAISE EXCEPTION 'documents_custody_expired' USING ERRCODE='55000'; END IF;
 IF p_phase IN('retain','claim','resume') THEN
  IF stored.expires_at IS NULL OR stored.expires_at<=checked_at THEN RAISE EXCEPTION 'documents_custody_expired' USING ERRCODE='55000'; END IF;
 END IF;
 RETURN to_jsonb(r)||jsonb_build_object('fresh_stream',fresh,'fresh_dispatch',fresh_dispatch,'database_oid',(SELECT oid::integer FROM pg_database WHERE datname=current_database()),'database_name',current_database(),
  'backend_marker',(SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='core_runtime'));
END $custody$;
REVOKE ALL ON FUNCTION platform_dev.document_upload_custody_v1(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
ALTER FUNCTION platform_dev.document_upload_custody_v1(text,jsonb) OWNER TO cladora_document_custody_owner;
GRANT EXECUTE ON FUNCTION platform_dev.document_upload_custody_v1(text,jsonb) TO authenticated;
REVOKE CREATE ON SCHEMA platform,platform_dev,app_private FROM cladora_document_custody_owner;
-- Caller has no table/C03 privilege, no runtime activation or customer_api exposure.
