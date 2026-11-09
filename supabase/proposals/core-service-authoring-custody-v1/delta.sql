-- Core executable producer source; Platform must supply reviewed owner/ACL/install binding.
-- NO target execution or automatic migration. Test-only unresolved custody has no automatic TTL.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $guard$ BEGIN RAISE EXCEPTION 'service_custody_platform_adoption_required' USING ERRCODE='55000'; END $guard$;
-- Dedicated NOLOGIN/non-superuser/non-BYPASSRLS owner and schema/column/function
-- grants are a Platform-owned prerequisite, NOT delegated from a caller argument.
CREATE TABLE platform.service_authoring_custody_v1(
 custody_owner text NOT NULL CHECK(custody_owner~'^[a-f0-9]{64}$'),
 tenant_id uuid NOT NULL,workspace_id uuid NOT NULL,context_id uuid NOT NULL,
 membership_id uuid NOT NULL,actor_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN('create','transition')),
 idempotency_key text NOT NULL CHECK(idempotency_key~'^[A-Za-z0-9._:-]{8,160}$'),
 command_sha256 text NOT NULL CHECK(command_sha256~'^[a-f0-9]{64}$'),
 public_wire text NOT NULL CHECK(octet_length(public_wire)<=65536),
 record_wire text NOT NULL CHECK(octet_length(record_wire)<=131072),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz, -- No automatic purge/cancel/abandonment policy is introduced.
 PRIMARY KEY(custody_owner,workspace_id,kind,idempotency_key),
 UNIQUE(workspace_id,idempotency_key), -- C03 key namespace: no replacement under another session owner/kind.
 CHECK(expires_at IS NULL OR expires_at>created_at)
);
ALTER TABLE platform.service_authoring_custody_v1 ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform.service_authoring_custody_v1 FORCE ROW LEVEL SECURITY;
REVOKE ALL ON platform.service_authoring_custody_v1 FROM PUBLIC;
-- No policy/grant/owner is guessed here. With FORCE RLS and no policy this stays closed.
-- Platform admission must give only its dedicated custodian SELECT/INSERT, no UPDATE/DELETE,
-- with exact actor/tenant/Context/Workspace checks. No public table exposure.
CREATE FUNCTION platform_dev.prepare_service_offering_authoring_v1(p_request jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $custody$
DECLARE actor uuid;ctx uuid;ws uuid;tenant uuid;member uuid;rev bigint;
 kind text;key text;owner_key text;c jsonb;selected jsonb;rec jsonb;pub jsonb;permission text;
 r platform.service_authoring_custody_v1%rowtype;
BEGIN
 IF jsonb_typeof(p_request) IS DISTINCT FROM 'object' OR octet_length(p_request::text)>262144
  OR NOT(p_request ?& ARRAY['context_id','workspace_id','kind','idempotency_key','custody_owner','command_sha256','public_wire','record_wire'])
  OR p_request-ARRAY['context_id','workspace_id','kind','idempotency_key','custody_owner','command_sha256','public_wire','record_wire']<>'{}'
 THEN RAISE EXCEPTION 'service_custody_invalid' USING ERRCODE='22023';END IF;
 actor:=auth.uid();ctx:=(p_request->>'context_id')::uuid;ws:=(p_request->>'workspace_id')::uuid;
 kind:=p_request->>'kind';key:=p_request->>'idempotency_key';owner_key:=p_request->>'custody_owner';
 IF actor IS NULL OR auth.jwt()->>'role' IS DISTINCT FROM 'authenticated' OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'
  OR ctx IS NULL OR ws IS NULL THEN RAISE EXCEPTION 'service_custody_denied' USING ERRCODE='42501';END IF;
 IF kind IS NULL OR kind NOT IN('create','transition') OR key IS NULL OR key!~'^[A-Za-z0-9._:-]{8,160}$'
  OR owner_key IS NULL OR owner_key!~'^[a-f0-9]{64}$' OR p_request->>'command_sha256' IS NULL
  OR p_request->>'command_sha256'!~'^[a-f0-9]{64}$' OR octet_length(p_request->>'public_wire')>65536
  OR octet_length(p_request->>'record_wire')>131072
 THEN RAISE EXCEPTION 'service_custody_invalid' USING ERRCODE='22023';END IF;
 rec:=(p_request->>'record_wire')::jsonb;pub:=(p_request->>'public_wire')::jsonb;c:=rec->'command';
 selected:=CASE WHEN kind='create' THEN c->'input' ELSE c END;
 IF rec->>'contract_version' IS DISTINCT FROM 'service-offering-authoring-custody-record.v1'
  OR rec-ARRAY['contract_version','kind','custody_owner','command_sha256','command']<>'{}'
  OR rec->>'kind' IS DISTINCT FROM kind OR rec->>'custody_owner' IS DISTINCT FROM owner_key
  OR rec->>'command_sha256' IS DISTINCT FROM p_request->>'command_sha256'
  OR jsonb_typeof(c) IS DISTINCT FROM 'object' OR jsonb_typeof(selected) IS DISTINCT FROM 'object'
  OR c->>'actor_id' IS DISTINCT FROM actor::text OR selected->>'context_id' IS DISTINCT FROM ctx::text
  OR selected->>'workspace_id' IS DISTINCT FROM ws::text OR selected->>'idempotency_key' IS DISTINCT FROM key
  OR pub IS DISTINCT FROM jsonb_build_object('kind',kind,'request',c-ARRAY['actor_id','authority_version'])
  OR encode(sha256(convert_to(p_request->>'public_wire','UTF8')),'hex') IS DISTINCT FROM p_request->>'command_sha256'
  OR c->>'authority_version' IS NULL OR c->>'authority_version'!~'^[1-9][0-9]*$'
  OR c->>'transaction_id' IS NULL OR c->>'command_id' IS NULL OR c->>'offering_id' IS NULL OR c->>'revision_id' IS NULL
 THEN RAISE EXCEPTION 'service_custody_invalid' USING ERRCODE='22023';END IF;
 -- Exact domain validation remains SERVICE's existing command schema/provider.
 PERFORM (c->>'transaction_id')::uuid,(c->>'command_id')::uuid,(c->>'offering_id')::uuid,(c->>'revision_id')::uuid;
 permission:=CASE WHEN kind='transition' AND c->>'action'='publish' THEN 'services.catalog.publish' ELSE 'services.catalog.manage' END;
 PERFORM app_private.lock_core_request_session_v1();
 SELECT revision INTO STRICT rev FROM app_private.canonical_authority_revision_v1 WHERE singleton FOR SHARE;
 SELECT v.tenant_id,v.membership_id INTO STRICT tenant,member FROM app_private.resolve_workspace_native_context_v2(ctx,ws) v;
 -- Serialize custody preparation, not a C03 command reservation. Same key never races to a replacement.
 PERFORM pg_advisory_xact_lock(hashtextextended('service-authoring-custody:'||owner_key||':'||ws::text||':'||kind||':'||key,0));
 SELECT * INTO r FROM platform.service_authoring_custody_v1 s WHERE s.custody_owner=owner_key AND s.workspace_id=ws AND s.kind=kind AND s.idempotency_key=key FOR SHARE;
 -- All lock waits above precede current authorization/clock. No stored historical allow is used.
 PERFORM app_private.require_request_session_current_at_v1(clock_timestamp());
 IF app_private.check_workspace_native_permission_v2(ctx,ws,permission,'services_catalog') IS NOT true
  OR (c->>'authority_version')::bigint<>rev
 THEN RAISE EXCEPTION 'service_custody_denied' USING ERRCODE='42501';END IF;
 IF r.custody_owner IS NULL THEN
  IF EXISTS(SELECT 1 FROM platform.idempotency_keys k WHERE k.tenant_id=tenant AND k.key='core-tx.v1:'||ws::text||':'||key) THEN
   RAISE EXCEPTION 'service_custody_original_missing' USING ERRCODE='55000';END IF;
  INSERT INTO platform.service_authoring_custody_v1(custody_owner,tenant_id,workspace_id,context_id,membership_id,actor_id,kind,idempotency_key,command_sha256,public_wire,record_wire)
  VALUES(owner_key,tenant,ws,ctx,member,actor,kind,key,p_request->>'command_sha256',p_request->>'public_wire',p_request->>'record_wire') RETURNING * INTO r;
 ELSIF r.tenant_id<>tenant OR r.actor_id<>actor OR r.context_id<>ctx OR r.membership_id<>member
  OR r.command_sha256 IS DISTINCT FROM p_request->>'command_sha256' OR r.public_wire IS DISTINCT FROM p_request->>'public_wire'
  OR ((r.record_wire::jsonb)->'command')-'authority_version' IS DISTINCT FROM c-'authority_version'
 THEN RAISE EXCEPTION 'service_custody_conflict' USING ERRCODE='23505';END IF;
 -- Retry returns exactly the original wire including its old authority revision.
 -- Missing policy, unavailable source, timeout/cancel/40001 all propagate, never create fallback.
 PERFORM app_private.require_request_session_current_at_v1(clock_timestamp());
 IF r.expires_at IS NOT NULL AND r.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'service_custody_expired' USING ERRCODE='55000';END IF;
 IF app_private.check_workspace_native_permission_v2(ctx,ws,permission,'services_catalog') IS NOT true
 THEN RAISE EXCEPTION 'service_custody_denied' USING ERRCODE='42501';END IF;
 RETURN jsonb_build_object('contract_version','core-service-authoring-custody-db.v1',
  'database_oid',(SELECT oid::integer FROM pg_database WHERE datname=current_database()),'database_name',current_database(),
  'backend_marker',(SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='core_runtime'),
  'tenant_id',tenant,'membership_id',member,'record_wire',r.record_wire,'record_sha256',encode(sha256(convert_to(r.record_wire,'UTF8')),'hex'));
END
$custody$;
REVOKE ALL ON FUNCTION platform_dev.prepare_service_offering_authoring_v1(jsonb) FROM PUBLIC;
-- Do not choose an installer or runtime role from a request. Platform adoption binds the fixed façade.
ROLLBACK;
