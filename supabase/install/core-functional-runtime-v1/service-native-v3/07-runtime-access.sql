-- Core15 real Platform12 access successor: exact ordinary installer + existing Auth-owner guard.
-- core-functional-install.v1 / additive local development admission only.
-- Source reviewed/applied separately from the historical migration ledger.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SET LOCAL search_path=pg_catalog;
DO $prestate$
BEGIN
 IF current_database()<>'postgres' OR current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR current_user<>'cladora_core_installer' OR session_user<>current_user
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_core_runtime'
    AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication)
  OR EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname IN ('service_role','supabase_admin','supabase_auth_admin','cladora_rpc_owner')
    AND pg_has_role('cladora_core_runtime',r.oid,'MEMBER'))
  OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member='cladora_core_runtime'::regrole)
  OR NOT has_schema_privilege(current_user,'core_runtime','USAGE')
  OR NOT has_function_privilege(current_user,'core_runtime.lock_request_session_v1()','EXECUTE')
  OR NOT EXISTS(SELECT 1 FROM pg_proc p JOIN pg_class c ON c.oid='auth.sessions'::regclass
    WHERE p.oid='core_runtime.lock_request_session_v1()'::regprocedure AND p.proowner=c.relowner
     AND p.prosecdef AND p.proconfig=ARRAY['search_path=pg_catalog']::text[] AND c.relrowsecurity AND NOT c.relforcerowsecurity)
  OR NOT has_schema_privilege('cladora_core_runtime','auth','USAGE')
  OR NOT has_function_privilege('cladora_core_runtime','auth.uid()','EXECUTE')
  OR NOT has_function_privilege('cladora_core_runtime','auth.jwt()','EXECUTE')
 THEN RAISE EXCEPTION 'core_functional_install_prestate_unavailable' USING ERRCODE='55000'; END IF;
 IF to_regprocedure('app_private.lock_core_request_session_v1()') IS NOT NULL
  OR to_regprocedure('app_private.core_functional_checkpoint_v1(uuid,uuid,text,text,bigint)') IS NOT NULL
 THEN RAISE EXCEPTION 'core_functional_install_collision' USING ERRCODE='55000'; END IF;
 -- Fresh dedicated app role; Platform grants only CONNECT/Auth helper setup.
 -- Any pre-existing application ACL/policy is a different transition, not this install.
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace,
  LATERAL aclexplode(c.relacl) a WHERE n.nspname IN ('app_private','platform','identity','portfolio','audit','service_catalog','customer_api')
   AND a.grantee='cladora_core_runtime'::regrole)
 OR EXISTS(SELECT 1 FROM pg_attribute x JOIN pg_class c ON c.oid=x.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace,
  LATERAL aclexplode(x.attacl) a WHERE n.nspname IN ('app_private','platform','identity','portfolio','audit','service_catalog','customer_api')
   AND a.grantee='cladora_core_runtime'::regrole)
 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,
  LATERAL aclexplode(p.proacl) a WHERE n.nspname IN ('app_private','platform','identity','portfolio','audit','service_catalog','customer_api')
   AND a.grantee='cladora_core_runtime'::regrole
   AND p.oid NOT IN ('app_private.require_request_session_current_at_v1(timestamptz)'::regprocedure,
    'app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'::regprocedure))
 OR EXISTS(SELECT 1 FROM pg_policy p WHERE 'cladora_core_runtime'::regrole=ANY(p.polroles))
 THEN RAISE EXCEPTION 'core15_runtime_preexisting_application_rights' USING ERRCODE='55000'; END IF;
 CREATE TEMP TABLE core15_default_acl_before ON COMMIT DROP AS SELECT * FROM pg_default_acl;
END
$prestate$;
CREATE FUNCTION app_private.lock_core_request_session_v1() RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $session$
BEGIN
 -- Exact existing private Auth-owned session/lock guard. No row-policy bypass,
 -- caller-time parameter, parallel authority or direct runtime Auth SELECT.
 PERFORM core_runtime.lock_request_session_v1();
END
$session$;
REVOKE ALL ON FUNCTION app_private.lock_core_request_session_v1() FROM PUBLIC,anon,authenticated,service_role;
CREATE FUNCTION app_private.core_functional_checkpoint_v1(p_context uuid,p_workspace uuid,
 p_permission text,p_module text,p_revision bigint) RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $checkpoint$
DECLARE c record; l record; epoch bigint; at_time timestamptz;
BEGIN
 PERFORM app_private.lock_core_request_session_v1();
 SELECT revision INTO STRICT epoch FROM app_private.canonical_authority_revision_v1 WHERE singleton FOR SHARE;
 SELECT g.id,g.starts_at AS gs,g.ends_at AS ge,m.id AS membership_id,m.tenant_id,m.user_id,
  m.status,m.starts_at AS ms,m.ends_at AS me,w.id AS workspace_id,w.archived_at,w.lifecycle_status
 INTO STRICT l FROM identity.context_grants g JOIN identity.memberships m
  ON m.id=g.membership_id AND m.tenant_id=g.tenant_id
 JOIN platform.customer_workspaces w ON w.id=p_workspace AND w.tenant_id=m.tenant_id
 WHERE g.id=p_context FOR SHARE OF g,m,w;
 -- Clock sampled AFTER all explicit lock waits, not transaction-start time.
 at_time:=clock_timestamp();
 PERFORM app_private.require_request_session_current_at_v1(at_time);
 SELECT * INTO STRICT c FROM app_private.resolve_workspace_native_context_v2(p_context,p_workspace);
 IF epoch IS DISTINCT FROM p_revision OR l.user_id IS DISTINCT FROM auth.uid()
  OR l.tenant_id IS DISTINCT FROM app_private.active_tenant_id()
  OR l.membership_id IS DISTINCT FROM c.membership_id OR l.tenant_id IS DISTINCT FROM c.tenant_id
  OR l.workspace_id IS DISTINCT FROM c.workspace_id OR l.status<>'active'
  OR l.archived_at IS NOT NULL OR l.lifecycle_status<>'ACTIVE'
  OR l.gs>at_time OR l.ms>at_time OR (l.ge IS NOT NULL AND l.ge<=at_time) OR (l.me IS NOT NULL AND l.me<=at_time)
  OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'
  OR NOT coalesce(app_private.check_workspace_native_permission_v2_at_v1(p_context,p_workspace,p_permission,p_module,at_time),false)
 THEN RAISE EXCEPTION 'core_functional_checkpoint_denied' USING ERRCODE='42501'; END IF;
 -- Do not catch 40001, timeout or cancellation; propagate the original failure.
END
$checkpoint$;
REVOKE ALL ON FUNCTION app_private.core_functional_checkpoint_v1(uuid,uuid,text,text,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA app_private,identity,platform,portfolio,customer_api,service_catalog,audit TO cladora_core_runtime;
GRANT EXECUTE ON FUNCTION app_private.lock_core_request_session_v1(),
 app_private.core_functional_checkpoint_v1(uuid,uuid,text,text,bigint),
 app_private.active_tenant_id(),app_private.active_context_id(),app_private.active_membership_id(),app_private.jwt_uuid(text),
 app_private.resolve_workspace_native_context_v2(uuid,uuid),
 app_private.apply_service_v14_execution_v1(text,jsonb),
 app_private.resolve_service_v14_execution_source_v1(uuid,uuid,uuid,bigint,bigint)
 TO cladora_core_runtime;
-- No Auth table/function ACL or provider role is changed by this unit.
-- Every row-lock-only UPDATE privilege is paired with WITH CHECK(false).
DO $access$
DECLARE spec record; relation regclass;
BEGIN
 FOR spec IN SELECT * FROM (VALUES
 ('app_private.canonical_authority_revision_v1','singleton','true'),
 ('identity.memberships','id','user_id=auth.uid()'),
 ('identity.context_grants','id','tenant_id=app_private.active_tenant_id() AND id=app_private.active_context_id()'),
 ('platform.customer_workspaces','id','tenant_id=app_private.active_tenant_id() AND id=(auth.jwt()->>''active_workspace_id'')::uuid'),
 ('portfolio.parties','id','tenant_id=app_private.active_tenant_id()'),
 ('platform.provider_agreement_heads_v1','id','tenant_id=app_private.active_tenant_id() AND workspace_id=(auth.jwt()->>''active_workspace_id'')::uuid'),
 ('platform.provider_agreement_versions_v1','agreement_id','tenant_id=app_private.active_tenant_id() AND workspace_id=(auth.jwt()->>''active_workspace_id'')::uuid'),
 ('service_catalog.definitions','id','tenant_id=app_private.active_tenant_id() AND workspace_id=(auth.jwt()->>''active_workspace_id'')::uuid'),
 ('service_catalog.offerings','id','tenant_id=app_private.active_tenant_id() AND workspace_id=(auth.jwt()->>''active_workspace_id'')::uuid'),
 ('service_catalog.revisions','id','tenant_id=app_private.active_tenant_id() AND workspace_id=(auth.jwt()->>''active_workspace_id'')::uuid')
 ) AS t(path,lock_column,predicate)
 LOOP
  relation:=spec.path::regclass;
  IF EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=relation AND polname IN ('core15_runtime_select','core15_runtime_lock'))
   THEN RAISE EXCEPTION 'core_functional_policy_collision' USING ERRCODE='55000'; END IF;
  EXECUTE format('CREATE POLICY core15_runtime_select ON %s FOR SELECT TO cladora_core_runtime USING (%s)',relation,spec.predicate);
  EXECUTE format('CREATE POLICY core15_runtime_lock ON %s FOR UPDATE TO cladora_core_runtime USING (%s) WITH CHECK(false)',relation,spec.predicate);
  EXECUTE format('GRANT UPDATE (%I) ON %s TO cladora_core_runtime',spec.lock_column,relation);
 END LOOP;
END
$access$;
GRANT SELECT(id,code,is_active,lifecycle_status,valid_from,valid_to,entitlement_key) ON platform.module_definitions TO cladora_core_runtime;
CREATE POLICY core15_runtime_module_read ON platform.module_definitions FOR SELECT TO cladora_core_runtime USING(is_active AND lifecycle_status IN ('active','published'));
GRANT SELECT ON app_private.canonical_authority_revision_v1 TO cladora_core_runtime;
GRANT SELECT(id,tenant_id,user_id,status,starts_at,ends_at) ON identity.memberships TO cladora_core_runtime;
GRANT SELECT(id,tenant_id,membership_id,starts_at,ends_at) ON identity.context_grants TO cladora_core_runtime;
GRANT SELECT(id,tenant_id,lifecycle_status,archived_at) ON platform.customer_workspaces TO cladora_core_runtime;
GRANT SELECT(id,tenant_id,archived_at) ON portfolio.parties TO cladora_core_runtime;
GRANT SELECT ON platform.provider_agreement_heads_v1,platform.provider_agreement_versions_v1,
 service_catalog.definitions,service_catalog.offerings,service_catalog.revisions TO cladora_core_runtime;
-- Installer-only administrative writer access; FORCE RLS still applies and
-- immutable-version/head triggers remain active. Runtime gets NO store writes.
CREATE POLICY core15_admin_store ON platform.provider_agreement_heads_v1 TO cladora_core_installer USING(true) WITH CHECK(true);
CREATE POLICY core15_admin_store ON platform.provider_agreement_versions_v1 TO cladora_core_installer USING(true) WITH CHECK(true);
-- Existing C03 tables only. No second ledger. No DELETE or retention policy.
GRANT SELECT,INSERT,UPDATE ON platform.idempotency_keys TO cladora_core_runtime;
CREATE POLICY core15_runtime_c03 ON platform.idempotency_keys TO cladora_core_runtime
 USING(tenant_id=app_private.active_tenant_id() AND actor_id=auth.uid()
  AND key LIKE 'core-tx.v1:'||(auth.jwt()->>'active_workspace_id')||':%')
 WITH CHECK(tenant_id=app_private.active_tenant_id() AND actor_id=auth.uid()
  AND key LIKE 'core-tx.v1:'||(auth.jwt()->>'active_workspace_id')||':%');
GRANT INSERT ON audit.events,platform.outbox_events TO cladora_core_runtime;
GRANT SELECT(id) ON audit.events,platform.outbox_events TO cladora_core_runtime;
GRANT USAGE ON SEQUENCE audit.events_id_seq TO cladora_core_runtime;
CREATE POLICY core15_runtime_audit_read ON audit.events FOR SELECT TO cladora_core_runtime USING(tenant_id=app_private.active_tenant_id() AND actor_id=auth.uid());
CREATE POLICY core15_runtime_audit_write ON audit.events FOR INSERT TO cladora_core_runtime WITH CHECK(tenant_id=app_private.active_tenant_id() AND actor_id=auth.uid());
CREATE POLICY core15_runtime_outbox_read ON platform.outbox_events FOR SELECT TO cladora_core_runtime USING(tenant_id=app_private.active_tenant_id());
CREATE POLICY core15_runtime_outbox_write ON platform.outbox_events FOR INSERT TO cladora_core_runtime
 WITH CHECK(tenant_id=app_private.active_tenant_id() AND payload->>'workspace_id'=auth.jwt()->>'active_workspace_id');
DO $assert$
BEGIN
 IF EXISTS((TABLE pg_default_acl EXCEPT TABLE core15_default_acl_before)
  UNION ALL (TABLE core15_default_acl_before EXCEPT TABLE pg_default_acl))
 THEN RAISE EXCEPTION 'core_functional_default_acl_delta' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid IN ('app_private.lock_core_request_session_v1()'::regprocedure,
   'app_private.core_functional_checkpoint_v1(uuid,uuid,text,text,bigint)'::regprocedure)
   AND a.grantee NOT IN (p.proowner,'cladora_core_runtime'::regrole))
 THEN RAISE EXCEPTION 'core_functional_extra_acl' USING ERRCODE='55000'; END IF;
END
$assert$;
COMMIT;
