-- New Guide-only helpers, not replacements for existing shared evaluators.
CREATE FUNCTION app_private.core_platform_ce_guide_scope_allowed_v1(p_tenant uuid,p_workspace uuid,p_permission text,p_module text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $scope$
DECLARE c uuid; w uuid;
BEGIN
 IF session_user<>'cladora_ce_guide_runtime' OR p_module<>'experience_guides'
 OR p_permission NOT IN ('experience.guide.read','experience.guide.manage') OR coalesce(auth.jwt()->>'aal','aal1')<>'aal2' THEN RETURN false; END IF;
 c:=nullif(current_setting('request.cladora.context_id',true),'')::uuid;
 w:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
 IF c IS NULL OR w IS DISTINCT FROM p_workspace THEN RETURN false; END IF;
 PERFORM app_private.require_request_session_current_at_v1(clock_timestamp());
 RETURN EXISTS(SELECT 1 FROM app_private.resolve_workspace_native_context_v2_at_v1(c,w,clock_timestamp()) r WHERE r.tenant_id=p_tenant)
 AND app_private.check_workspace_native_permission_v2_at_v1(c,w,p_permission,p_module,clock_timestamp()) IS TRUE;
EXCEPTION WHEN SQLSTATE '40001' THEN RAISE;
 WHEN SQLSTATE '42501' THEN RETURN false;
END $scope$;

-- Same physical role graph and ownership constraints as the fixed-role pool.
-- Guide without documents has an explicit smaller helper inventory. Shared
-- helper owner/definition is pinned; historical guard/migrations are untouched.
CREATE FUNCTION app_private.core_guide_no_document_role_safety_v1() RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $safe$
WITH ids AS (SELECT
 (SELECT oid FROM pg_roles WHERE rolname='cladora_ce_guide_runtime') runtime,
 (SELECT oid FROM pg_roles WHERE rolname='cladora_ce_guide_executor') executor),
shared(sig,sha) AS (VALUES
 ('app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamp with time zone)'::text,'83a291859f57e65669c4c98be1427e7d8e6de2f55fef5773e8f186b26a6dcd02'::text),
 ('app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamp with time zone)','e4751af691e09ea2652d2a7bef1ecb2f490d0969bbfd1445b0c99717c0fe8fbc'))
SELECT current_user='cladora_ce_guide_executor' AND session_user='cladora_ce_guide_runtime'
 AND (SELECT count(*)=2 FROM pg_roles WHERE oid IN ((SELECT runtime FROM ids),(SELECT executor FROM ids))
 AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 AND (SELECT rolcanlogin FROM pg_roles WHERE oid=(SELECT runtime FROM ids))
 AND NOT (SELECT rolcanlogin FROM pg_roles WHERE oid=(SELECT executor FROM ids))
 AND (SELECT count(*)=1 FROM pg_auth_members m,ids i WHERE m.member IN(i.runtime,i.executor) OR m.roleid IN(i.runtime,i.executor))
 AND EXISTS(SELECT 1 FROM pg_auth_members m,ids i WHERE m.member=i.runtime AND m.roleid=i.executor
 AND NOT m.admin_option AND NOT m.inherit_option AND m.set_option)
 AND NOT EXISTS(SELECT 1 FROM pg_namespace n,ids i WHERE n.nspowner IN(i.runtime,i.executor))
 AND NOT EXISTS(SELECT 1 FROM pg_database d,ids i WHERE d.datdba IN(i.runtime,i.executor))
 AND NOT EXISTS(SELECT 1 FROM pg_class c,ids i WHERE c.relowner IN(i.runtime,i.executor))
 AND NOT EXISTS(SELECT 1 FROM pg_proc p,ids i WHERE p.proowner IN(i.runtime,i.executor))
 AND NOT EXISTS(SELECT 1 FROM shared s LEFT JOIN pg_proc p ON p.oid=to_regprocedure(s.sig)
 WHERE p.oid IS NULL OR NOT p.prosecdef OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
 OR p.proowner<>(SELECT proowner FROM pg_proc WHERE oid='app_private.core_guide_no_document_role_safety_v1()'::regprocedure)
 OR encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')<>s.sha
 OR NOT has_function_privilege(current_user,p.oid,'EXECUTE')
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE a.grantee NOT IN(p.proowner,(SELECT executor FROM ids)) OR (a.grantee<>p.proowner AND a.is_grantable)))
 AND NOT has_database_privilege(current_user,current_database(),'CREATE')
 AND NOT has_schema_privilege(current_user,'app_private','CREATE')
 AND NOT has_schema_privilege(current_user,'auth','CREATE')
 AND NOT has_schema_privilege(current_user,'experience','CREATE');
$safe$;
CREATE FUNCTION app_private.assert_ce_guide_role_safety_v1() RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $assert$
BEGIN IF app_private.core_guide_no_document_role_safety_v1() IS NOT TRUE THEN
 RAISE EXCEPTION 'core_platform_role_safety_invalid' USING ERRCODE='42501'; END IF; RETURN true; END $assert$;
CREATE FUNCTION app_private.acquire_ce_guide_role_safety_lease_v1() RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $lease$
BEGIN PERFORM pg_advisory_xact_lock_shared(hashtextextended('core-platform-role-bound-pool.v1',0));
 RETURN app_private.assert_ce_guide_role_safety_v1(); END $lease$;

-- Document-free installation cannot be used to read or insert a document reference.
ALTER TABLE experience.guide_references ADD CONSTRAINT core_guide_no_document_references_v1 CHECK(false);
ALTER TABLE experience.guides FORCE ROW LEVEL SECURITY;
ALTER TABLE experience.guide_steps FORCE ROW LEVEL SECURITY;
ALTER TABLE experience.guide_references FORCE ROW LEVEL SECURITY;
REVOKE ALL ON SCHEMA experience FROM PUBLIC,anon,authenticated,service_role,cladora_ce_guide_runtime;
GRANT USAGE ON SCHEMA experience,app_private,identity,platform,audit TO cladora_ce_guide_executor;
GRANT EXECUTE ON FUNCTION
 app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamp with time zone),
 app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamp with time zone),
 app_private.core_platform_ce_guide_scope_allowed_v1(uuid,uuid,text,text),
 app_private.ce_guide_audience_allows_v1(uuid,uuid,jsonb),
 app_private.core_guide_no_document_role_safety_v1(),app_private.assert_ce_guide_role_safety_v1(),
 app_private.acquire_ce_guide_role_safety_lease_v1() TO cladora_ce_guide_executor;
REVOKE ALL ON FUNCTION app_private.ce_guide_audience_allows_v1(uuid,uuid,jsonb),
 app_private.core_platform_ce_guide_scope_allowed_v1(uuid,uuid,text,text),
 app_private.core_guide_no_document_role_safety_v1(),app_private.assert_ce_guide_role_safety_v1(),
 app_private.acquire_ce_guide_role_safety_lease_v1() FROM PUBLIC,anon,authenticated,service_role,cladora_ce_guide_runtime;

GRANT SELECT,INSERT ON experience.guides,experience.guide_steps TO cladora_ce_guide_executor;
GRANT UPDATE(title,audience,status,version,content_version,updated_at) ON experience.guides TO cladora_ce_guide_executor;
GRANT UPDATE(id) ON experience.guide_steps TO cladora_ce_guide_executor;
GRANT SELECT ON experience.guide_references TO cladora_ce_guide_executor;
GRANT UPDATE(id) ON experience.guide_references TO cladora_ce_guide_executor;
CREATE POLICY core_guide_read_v1 ON experience.guides FOR SELECT TO cladora_ce_guide_executor USING(
 app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides')
 OR (status='published' AND app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.read','experience_guides')
 AND app_private.ce_guide_audience_allows_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,workspace_id,audience)));
CREATE POLICY core_guide_read_lock_v1 ON experience.guides FOR UPDATE TO cladora_ce_guide_executor USING(
 status='published' AND app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.read','experience_guides')
 AND app_private.ce_guide_audience_allows_v1(nullif(current_setting('request.cladora.context_id',true),'')::uuid,workspace_id,audience)) WITH CHECK(false);
-- FORCE RLS also applies to the ordinary installer-owned SECURITY DEFINER
-- ledger helper. Give that owner only scoped SELECT, not a bypass or DML policy.
DO $owner_read$
BEGIN EXECUTE format('CREATE POLICY core_guide_owner_helper_read_v1 ON experience.guides FOR SELECT TO %I USING (app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,''experience.guide.manage'',''experience_guides''))',current_user); END $owner_read$;
CREATE POLICY core_guide_insert_v1 ON experience.guides FOR INSERT TO cladora_ce_guide_executor WITH CHECK(
 created_by=auth.uid() AND status='draft' AND version=1 AND content_version=1
 AND app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides'));
CREATE POLICY core_guide_update_v1 ON experience.guides FOR UPDATE TO cladora_ce_guide_executor USING(
 app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides'))
 WITH CHECK(app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides'));
CREATE POLICY core_guide_steps_read_v1 ON experience.guide_steps FOR SELECT TO cladora_ce_guide_executor USING(
 EXISTS(SELECT 1 FROM experience.guides g WHERE g.id=guide_id AND g.tenant_id=guide_steps.tenant_id AND g.workspace_id=guide_steps.workspace_id));
CREATE POLICY core_guide_steps_insert_v1 ON experience.guide_steps FOR INSERT TO cladora_ce_guide_executor WITH CHECK(
 app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides'));
CREATE POLICY core_guide_steps_lock_v1 ON experience.guide_steps FOR UPDATE TO cladora_ce_guide_executor USING(
 app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides')) WITH CHECK(false);
CREATE POLICY core_guide_references_read_v1 ON experience.guide_references FOR SELECT TO cladora_ce_guide_executor USING(false);
CREATE POLICY core_guide_references_lock_v1 ON experience.guide_references FOR UPDATE TO cladora_ce_guide_executor USING(false) WITH CHECK(false);

-- Discovery is structural own-actor data. It does not require manage and the
-- actual CE reader filters/rechecks each tuple using canonical read authority.
GRANT SELECT(id,membership_id,tenant_id,scope_type,property_id,building_id,unit_id,starts_at,ends_at),UPDATE(id) ON identity.context_grants TO cladora_ce_guide_executor;
GRANT SELECT(id,tenant_id,role_id,user_id,status,starts_at,ends_at),UPDATE(id) ON identity.memberships TO cladora_ce_guide_executor;
GRANT SELECT(id,tenant_id,archived_at,lifecycle_status),UPDATE(id) ON platform.customer_workspaces TO cladora_ce_guide_executor;
GRANT SELECT(id,legal_name) ON platform.tenants TO cladora_ce_guide_executor;
GRANT SELECT(id,tenant_id,code,name) ON identity.roles TO cladora_ce_guide_executor;
GRANT SELECT(singleton,revision),UPDATE(singleton) ON app_private.canonical_authority_revision_v1 TO cladora_ce_guide_executor;
GRANT SELECT(id,code,version,entitlement_key,is_active,lifecycle_status,valid_from,valid_to) ON platform.module_definitions TO cladora_ce_guide_executor;
CREATE POLICY core_guide_member_read_v1 ON identity.memberships FOR SELECT TO cladora_ce_guide_executor USING(user_id=auth.uid());
CREATE POLICY core_guide_member_lock_v1 ON identity.memberships FOR UPDATE TO cladora_ce_guide_executor USING(user_id=auth.uid()) WITH CHECK(false);
CREATE POLICY core_guide_context_read_v1 ON identity.context_grants FOR SELECT TO cladora_ce_guide_executor USING(EXISTS(SELECT 1 FROM identity.memberships m WHERE m.id=membership_id AND m.tenant_id=context_grants.tenant_id AND m.user_id=auth.uid()));
CREATE POLICY core_guide_context_lock_v1 ON identity.context_grants FOR UPDATE TO cladora_ce_guide_executor USING(EXISTS(SELECT 1 FROM identity.memberships m WHERE m.id=membership_id AND m.tenant_id=context_grants.tenant_id AND m.user_id=auth.uid())) WITH CHECK(false);
CREATE POLICY core_guide_workspace_read_v1 ON platform.customer_workspaces FOR SELECT TO cladora_ce_guide_executor USING(EXISTS(SELECT 1 FROM identity.memberships m WHERE m.tenant_id=customer_workspaces.tenant_id AND m.user_id=auth.uid()));
CREATE POLICY core_guide_workspace_lock_v1 ON platform.customer_workspaces FOR UPDATE TO cladora_ce_guide_executor USING(EXISTS(SELECT 1 FROM identity.memberships m WHERE m.tenant_id=customer_workspaces.tenant_id AND m.user_id=auth.uid())) WITH CHECK(false);
CREATE POLICY core_guide_tenant_read_v1 ON platform.tenants FOR SELECT TO cladora_ce_guide_executor USING(EXISTS(SELECT 1 FROM identity.memberships m WHERE m.tenant_id=tenants.id AND m.user_id=auth.uid()));
CREATE POLICY core_guide_role_read_v1 ON identity.roles FOR SELECT TO cladora_ce_guide_executor USING(EXISTS(SELECT 1 FROM identity.memberships m WHERE m.role_id=roles.id AND m.user_id=auth.uid()));
CREATE POLICY core_guide_epoch_read_v1 ON app_private.canonical_authority_revision_v1 FOR SELECT TO cladora_ce_guide_executor USING(singleton);
CREATE POLICY core_guide_epoch_lock_v1 ON app_private.canonical_authority_revision_v1 FOR UPDATE TO cladora_ce_guide_executor USING(singleton) WITH CHECK(false);
CREATE POLICY core_guide_module_read_v1 ON platform.module_definitions FOR SELECT TO cladora_ce_guide_executor USING(code='experience_guides');

-- Existing C03 is the sole key/receipt/audit/outbox engine.
GRANT SELECT(tenant_id,actor_id,key,request_hash,response_ref,expires_at),INSERT(tenant_id,actor_id,key,request_hash,expires_at),UPDATE(response_ref,status_code) ON platform.idempotency_keys TO cladora_ce_guide_executor;
GRANT SELECT(id),INSERT(tenant_id,actor_id,action,entity_type,entity_id,request_id,after_snapshot) ON audit.events TO cladora_ce_guide_executor;
GRANT USAGE,SELECT ON SEQUENCE audit.events_id_seq TO cladora_ce_guide_executor;
GRANT SELECT(id),INSERT(tenant_id,aggregate_type,aggregate_id,aggregate_version,event_type,payload,trace_id) ON platform.outbox_events TO cladora_ce_guide_executor;
CREATE FUNCTION app_private.core_guide_no_document_ledger_allowed_v1(t uuid,a uuid,k text,g uuid) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $ledger$
DECLARE w uuid;
BEGIN w:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
 RETURN a=auth.uid() AND app_private.core_platform_ce_guide_scope_allowed_v1(t,w,'experience.guide.manage','experience_guides')
 AND (k IS NULL OR k LIKE 'core-tx.v1:'||w::text||':%')
 AND (g IS NULL OR EXISTS(SELECT 1 FROM experience.guides x WHERE x.id=g AND x.tenant_id=t AND x.workspace_id=w));
END $ledger$;
REVOKE ALL ON FUNCTION app_private.core_guide_no_document_ledger_allowed_v1(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated,service_role,cladora_ce_guide_runtime;
GRANT EXECUTE ON FUNCTION app_private.core_guide_no_document_ledger_allowed_v1(uuid,uuid,text,uuid) TO cladora_ce_guide_executor;
CREATE POLICY core_guide_c03_read_v1 ON platform.idempotency_keys FOR SELECT TO cladora_ce_guide_executor USING(app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,actor_id,key,null));
CREATE POLICY core_guide_c03_insert_v1 ON platform.idempotency_keys FOR INSERT TO cladora_ce_guide_executor WITH CHECK(app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,actor_id,key,null));
CREATE POLICY core_guide_c03_update_v1 ON platform.idempotency_keys FOR UPDATE TO cladora_ce_guide_executor USING(app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,actor_id,key,null)) WITH CHECK(app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,actor_id,key,null));
CREATE POLICY core_guide_audit_read_v1 ON audit.events FOR SELECT TO cladora_ce_guide_executor USING(entity_type='experience_guide' AND action IN ('core.experience.guide.command','core.experience.guide.publish','core.experience.guide.unpublish') AND app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,actor_id,null,entity_id));
CREATE POLICY core_guide_audit_insert_v1 ON audit.events FOR INSERT TO cladora_ce_guide_executor WITH CHECK(entity_type='experience_guide' AND action IN ('core.experience.guide.command','core.experience.guide.publish','core.experience.guide.unpublish') AND app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,actor_id,null,entity_id));
CREATE POLICY core_guide_outbox_read_v1 ON platform.outbox_events FOR SELECT TO cladora_ce_guide_executor USING(aggregate_type='experience_guide' AND event_type IN ('core.experience.guide.command.v1','core.experience.guide.publish.v1','core.experience.guide.unpublish.v1') AND app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,auth.uid(),null,aggregate_id));
CREATE POLICY core_guide_outbox_insert_v1 ON platform.outbox_events FOR INSERT TO cladora_ce_guide_executor WITH CHECK(aggregate_type='experience_guide' AND event_type IN ('core.experience.guide.command.v1','core.experience.guide.publish.v1','core.experience.guide.unpublish.v1') AND app_private.core_guide_no_document_ledger_allowed_v1(tenant_id,auth.uid(),null,aggregate_id));

-- Registry identities only. No role assignment, entitlement allocation,
-- Workspace activation, credential or runtime binding is created.
INSERT INTO identity.permissions(code,resource,action,description)
VALUES('experience.guide.read','experience.guide','read','Read an authorized Experience Guide projection in the current Workspace'),
('experience.guide.manage','experience.guide','manage','Manage a versioned Experience Guide in the current Workspace')
ON CONFLICT(code) DO NOTHING;
INSERT INTO platform.module_definitions(code,version,name,labels_json,description,category,is_active,lifecycle_status,sensitivity_level,requires_aal2,entitlement_key,published_at)
VALUES('experience_guides',1,'Experience Guides','{"ro":"Ghiduri","en":"Guides","fa":"راهنماها"}'::jsonb,
'Versioned Experience Guide authority profile','services',true,'published','sensitive',true,'module.experience_guides',statement_timestamp())
ON CONFLICT(code,version) DO NOTHING;
INSERT INTO platform.module_permission_bindings(module_definition_id,permission_id,binding_version,permission_mode,is_assignable_to_local_role,is_delegable,requires_aal2,lifecycle_status)
SELECT d.id,p.id,1,p.action,true,false,true,'active' FROM platform.module_definitions d JOIN identity.permissions p ON p.code IN('experience.guide.read','experience.guide.manage')
WHERE d.code='experience_guides' AND d.version=1
ON CONFLICT(module_definition_id,permission_id,binding_version) DO NOTHING;
DO $registry$
BEGIN
 IF (SELECT count(*) FROM platform.module_definitions WHERE code='experience_guides' AND version=1
 AND is_active AND lifecycle_status='published' AND sensitivity_level='sensitive' AND requires_aal2
 AND entitlement_key='module.experience_guides' AND valid_from<=clock_timestamp() AND valid_to IS NULL)<>1
 OR (SELECT count(*) FROM identity.permissions WHERE resource='experience.guide'
 AND ((code='experience.guide.read' AND action='read') OR (code='experience.guide.manage' AND action='manage')))<>2
 OR (SELECT count(*) FROM platform.module_permission_bindings b JOIN platform.module_definitions d ON d.id=b.module_definition_id JOIN identity.permissions p ON p.id=b.permission_id
 WHERE d.code='experience_guides' AND d.version=1 AND p.code IN('experience.guide.read','experience.guide.manage')
 AND b.permission_mode=p.action AND b.binding_version=1 AND b.is_assignable_to_local_role AND NOT b.is_delegable
 AND b.requires_aal2 AND b.lifecycle_status='active' AND b.valid_from<=clock_timestamp() AND b.valid_to IS NULL)<>2
 THEN RAISE EXCEPTION 'guide_registry_collision_stop' USING ERRCODE='55000'; END IF;
END $registry$;

COMMENT ON SCHEMA experience IS 'core-guide-no-document-install.v1; inactive; no operational activation';
COMMIT;
