-- Existing C01/session providers only; selectors/active_* are NOT authority.
CREATE FUNCTION app_private.core_service_quote_runtime_scope_v1(p_tenant uuid,p_workspace uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $scope$
DECLARE c uuid;w uuid;t uuid;
BEGIN
 IF auth.uid() IS NULL OR auth.jwt()->>'role' IS DISTINCT FROM 'authenticated'
  OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2' THEN
  RAISE EXCEPTION 'service_quote_scope_denied' USING ERRCODE='42501'; END IF;
 c:=nullif(auth.jwt()->>'active_context_id','')::uuid;
 w:=nullif(auth.jwt()->>'active_workspace_id','')::uuid;
 IF c IS NULL OR w IS NULL OR w IS DISTINCT FROM p_workspace THEN RETURN false; END IF;
 PERFORM app_private.require_request_session_current_at_v1(clock_timestamp());
 IF app_private.check_workspace_native_permission_v2(c,w,'services.quotes.manage','services_orders') IS NOT true THEN RETURN false; END IF;
 SELECT r.tenant_id INTO STRICT t FROM app_private.resolve_workspace_native_context_v2(c,w) r;
 RETURN t=p_tenant AND w=p_workspace;
END $scope$;
REVOKE ALL ON FUNCTION app_private.core_service_quote_runtime_scope_v1(uuid,uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.core_service_quote_runtime_scope_v1(uuid,uuid) TO cladora_core_runtime;
GRANT SELECT(id,tenant_id,workspace_id,offering_id,published_revision_id,beneficiary_party_id,membership_id,status,version,created_at,description),UPDATE(id) ON service_catalog.requests TO cladora_core_runtime;
CREATE POLICY core_quote_runtime_request_read_v1 ON service_catalog.requests FOR SELECT TO cladora_core_runtime
 USING(app_private.core_service_quote_runtime_scope_v1(tenant_id,workspace_id));
CREATE POLICY core_quote_runtime_request_lock_v1 ON service_catalog.requests FOR UPDATE TO cladora_core_runtime
 USING(app_private.core_service_quote_runtime_scope_v1(tenant_id,workspace_id)) WITH CHECK(false);
GRANT SELECT(membership_id,tenant_id,party_id,valid_from,valid_until) ON identity.membership_parties TO cladora_core_runtime;
CREATE POLICY core_quote_runtime_member_party_v1 ON identity.membership_parties FOR SELECT TO cladora_core_runtime
 USING(tenant_id=app_private.active_tenant_id()
 AND EXISTS(SELECT 1 FROM service_catalog.requests r WHERE r.tenant_id=membership_parties.tenant_id
  AND r.membership_id=membership_parties.membership_id AND r.beneficiary_party_id=membership_parties.party_id
  AND app_private.core_service_quote_runtime_scope_v1(r.tenant_id,r.workspace_id)));
-- Exact source-query dependencies, not generic Party discovery or Request authority.
GRANT SELECT(id,tenant_id,workspace_id,provider_party_id) ON service_catalog.offerings TO cladora_core_runtime;
GRANT SELECT(id,tenant_id,workspace_id,offering_id,provider_agreement_id,provider_agreement_version) ON service_catalog.revisions TO cladora_core_runtime;
GRANT SELECT(id,tenant_id,archived_at) ON portfolio.parties TO cladora_core_runtime;
CREATE POLICY core_quote_runtime_offering_read_v1 ON service_catalog.offerings FOR SELECT TO cladora_core_runtime
 USING(app_private.core_service_quote_runtime_scope_v1(tenant_id,workspace_id));
CREATE POLICY core_quote_runtime_revision_read_v1 ON service_catalog.revisions FOR SELECT TO cladora_core_runtime
 USING(app_private.core_service_quote_runtime_scope_v1(tenant_id,workspace_id));
CREATE POLICY core_quote_runtime_party_read_v1 ON portfolio.parties FOR SELECT TO cladora_core_runtime
 USING(tenant_id=app_private.active_tenant_id() AND EXISTS(
  SELECT 1 FROM service_catalog.requests r JOIN service_catalog.offerings o
   ON o.id=r.offering_id AND o.tenant_id=r.tenant_id AND o.workspace_id=r.workspace_id
  WHERE r.tenant_id=parties.tenant_id AND(parties.id=r.beneficiary_party_id OR parties.id=o.provider_party_id)
   AND app_private.core_service_quote_runtime_scope_v1(r.tenant_id,r.workspace_id)));
SET LOCAL ROLE cladora_service_quote_store_owner;
GRANT SELECT(request_version) ON service_catalog.quote_command_reservations TO cladora_core_runtime;
ALTER POLICY service_quote_reservation_runtime_read ON service_catalog.quote_command_reservations
 USING(tenant_id=app_private.active_tenant_id() AND workspace_id=(auth.jwt()->>'active_workspace_id')::uuid AND actor_id=auth.uid()
 AND app_private.core_service_quote_runtime_scope_v1(tenant_id,workspace_id));
SET LOCAL ROLE cladora_core_installer;
GRANT SELECT(id,tenant_id,workspace_id,request_id,request_version,published_revision_id,beneficiary_party_id,version,status,scope,total_minor,currency,valid_until,created_by,membership_id,created_at),
 INSERT(id,tenant_id,workspace_id,request_id,request_version,published_revision_id,beneficiary_party_id,version,scope,total_minor,currency,valid_until,created_by,membership_id)
 ON service_catalog.quote_drafts TO cladora_core_runtime;
CREATE POLICY core_quote_runtime_quote_read_v1 ON service_catalog.quote_drafts FOR SELECT TO cladora_core_runtime
 USING(app_private.core_service_quote_runtime_scope_v1(tenant_id,workspace_id));
CREATE POLICY core_quote_runtime_quote_insert_v1 ON service_catalog.quote_drafts FOR INSERT TO cladora_core_runtime
 WITH CHECK(app_private.core_service_quote_runtime_scope_v1(tenant_id,workspace_id)
 AND created_by=auth.uid() AND request_version IS NOT NULL
 AND EXISTS(SELECT 1 FROM service_catalog.requests r WHERE r.id=quote_drafts.request_id AND r.tenant_id=quote_drafts.tenant_id
  AND r.workspace_id=quote_drafts.workspace_id AND r.membership_id=quote_drafts.membership_id AND r.version=quote_drafts.request_version
  AND r.published_revision_id=quote_drafts.published_revision_id AND r.beneficiary_party_id=quote_drafts.beneficiary_party_id)
 AND EXISTS(SELECT 1 FROM service_catalog.quote_command_reservations z WHERE z.tenant_id=quote_drafts.tenant_id AND z.workspace_id=quote_drafts.workspace_id
  AND z.actor_id=auth.uid() AND z.quote_id=quote_drafts.id AND z.request_id=quote_drafts.request_id
  AND z.quote_version=quote_drafts.version AND z.request_version=quote_drafts.request_version));
-- No audit/outbox/ledger grant widening. Existing C03 owns the atomic effect.
