-- Inactive proposal. Exact owner/ACL/helper pins and role mapping require Platform.
-- No role, GRANT, permission registration or runtime binding is created here.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE FUNCTION app_private.core_finance_monthly_checkpoint_v1(ctx uuid,ws uuid,permission text,module text,revision bigint,
 receipt_key text DEFAULT NULL,request_hash text DEFAULT NULL,expected_receipt jsonb DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $finance$
DECLARE t timestamptz; native record; derived record; stored platform.idempotency_keys;
BEGIN
 IF (permission,module) NOT IN (
  ('finance.allocations.calculate','accounting'),('finance.allocations.approve','accounting'),
  ('finance.allocations.read','accounting'),('finance.monthly.manage','accounting'),('billing.manage','billing'))
  OR permission IS NULL OR module IS NULL THEN
  RAISE EXCEPTION 'finance_scope_denied' USING ERRCODE='42501'; END IF;
 -- Existing session, authority epoch and scope barriers; never an allow from JSON.
 PERFORM app_private.core_functional_checkpoint_v1(ctx,ws,permission,module,revision);
 IF receipt_key IS NOT NULL THEN
  IF request_hash IS NULL OR expected_receipt IS NULL
   OR receipt_key NOT LIKE 'core-tx.v1:'||ws::text||':%'
  THEN RAISE EXCEPTION 'finance_receipt_binding_denied' USING ERRCODE='42501'; END IF;
  SELECT * INTO stored FROM platform.idempotency_keys k
  WHERE k.tenant_id=app_private.active_tenant_id() AND k.key=receipt_key FOR SHARE;
  IF NOT FOUND OR stored.actor_id IS DISTINCT FROM auth.uid() OR stored.request_hash IS DISTINCT FROM request_hash
   OR stored.response_ref IS DISTINCT FROM expected_receipt
  THEN RAISE EXCEPTION 'finance_receipt_binding_denied' USING ERRCODE='42501'; END IF;
 ELSIF request_hash IS NOT NULL OR expected_receipt IS NOT NULL THEN
  RAISE EXCEPTION 'finance_receipt_binding_denied' USING ERRCODE='42501';
 END IF;
 t:=clock_timestamp();
 PERFORM app_private.require_request_session_current_at_v1(t);
 SELECT * INTO STRICT native FROM app_private.resolve_workspace_native_context_v2_at_v1(ctx,ws,t);
 SELECT * INTO STRICT derived FROM app_private.resolve_workspace_from_customer_context_v1_at_v1(ctx,false,t);
 IF (receipt_key IS NOT NULL AND (stored.expires_at IS NULL OR stored.expires_at<=t))
  OR auth.uid() IS NULL OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'
  OR derived.workspace_id IS DISTINCT FROM ws OR derived.tenant_id IS DISTINCT FROM native.tenant_id
  OR app_private.check_workspace_native_permission_v2_at_v1(ctx,ws,permission,module,t) IS NOT TRUE
  OR (permission='billing.manage' AND app_private.check_workspace_native_permission_v2_at_v1(ctx,ws,'billing.issue','billing',t) IS NOT TRUE)
 THEN RAISE EXCEPTION 'finance_scope_denied' USING ERRCODE='42501'; END IF;
END $finance$;
REVOKE ALL ON FUNCTION app_private.core_finance_monthly_checkpoint_v1(uuid,uuid,text,text,bigint,text,text,jsonb) FROM PUBLIC;
-- ACL must be owner-only. Existing positive default privileges are a STOP.
DO $acl$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE p.oid='app_private.core_finance_monthly_checkpoint_v1(uuid,uuid,text,text,bigint,text,text,jsonb)'::regprocedure
 AND a.grantee<>p.proowner) THEN RAISE EXCEPTION 'unexpected_default_function_acl' USING ERRCODE='55000'; END IF;
END $acl$;
COMMIT;
