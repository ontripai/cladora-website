-- Additive owned-development application reads. Not a public RPC activation.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s';
DO $pre$ BEGIN
 IF current_user<>'cladora_core_installer' OR session_user<>current_user OR current_database()<>'postgres'
 OR current_setting('server_version_num')::int<>170011
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('cladora_core_installer','cladora_core_runtime') AND (rolsuper OR rolbypassrls))
 OR to_regprocedure('app_private.list_core_service_selections_v1()') IS NOT NULL
 OR NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='app_private.core_functional_checkpoint_v1(uuid,uuid,text,text,bigint)'::regprocedure AND prosecdef)
 THEN RAISE EXCEPTION 'core_service_assembly_prestate' USING ERRCODE='55000';END IF;
 CREATE TEMP TABLE assembly_defaults ON COMMIT DROP AS TABLE pg_default_acl;
 CREATE TEMP TABLE assembly_members ON COMMIT DROP AS TABLE pg_auth_members;
END $pre$;
CREATE FUNCTION app_private.list_core_service_selections_v1() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog AS $body$
DECLARE r record; item jsonb; selections jsonb:='[]'; epoch bigint; saved text:=current_setting('request.jwt.claims',true);
 saved_context text:=current_setting('request.cladora.context_id',true); saved_workspace text:=current_setting('request.cladora.workspace_id',true);
 permission text; module text;
BEGIN
 PERFORM app_private.lock_core_request_session_v1();
 SELECT revision INTO STRICT epoch FROM app_private.canonical_authority_revision_v1 WHERE singleton FOR SHARE;
 FOR r IN SELECT g.id context_id,m.id membership_id,m.tenant_id,w.id workspace_id,t.legal_name tenant_name,
  role.code role_code,role.name role_name,w.workspace_type::text workspace_type,w.environment::text environment
  FROM identity.context_grants g JOIN identity.memberships m ON m.id=g.membership_id AND m.tenant_id=g.tenant_id
  JOIN platform.tenants t ON t.id=m.tenant_id JOIN identity.roles role ON role.id=m.role_id
  JOIN platform.customer_workspaces w ON w.tenant_id=m.tenant_id
  WHERE m.user_id=auth.uid() AND m.status='active' AND w.archived_at IS NULL AND w.lifecycle_status='ACTIVE'
  ORDER BY g.id,w.id FOR SHARE OF g,m,w
 LOOP
  PERFORM set_config('request.jwt.claims',(saved::jsonb||jsonb_build_object('active_context_id',r.context_id,'active_tenant_id',r.tenant_id,'active_membership_id',r.membership_id,'active_workspace_id',r.workspace_id))::text,true);
  PERFORM set_config('request.cladora.context_id',r.context_id::text,true),set_config('request.cladora.workspace_id',r.workspace_id::text,true);
  -- Existing canonical resolver owns tenant/ancestry/scope. No guessed mapping.
  BEGIN PERFORM app_private.resolve_workspace_native_context_v2(r.context_id,r.workspace_id);
  EXCEPTION WHEN insufficient_privilege THEN CONTINUE;END;
  IF app_private.check_workspace_native_permission_v2(r.context_id,r.workspace_id,'services.catalog.read','services_catalog') THEN permission:='services.catalog.read';module:='services_catalog';
  ELSIF app_private.check_workspace_native_permission_v2(r.context_id,r.workspace_id,'services.orders.read','services_orders') THEN permission:='services.orders.read';module:='services_orders';
  ELSE CONTINUE;END IF;
  PERFORM app_private.core_functional_checkpoint_v1(r.context_id,r.workspace_id,permission,module,epoch);
  selections:=selections||jsonb_build_array(to_jsonb(r)||jsonb_build_object('permission',permission,'module',module));
 END LOOP;
 -- No earlier tuple is released after a later lock wait without fresh recheck.
 FOR item IN SELECT value FROM jsonb_array_elements(selections) LOOP
  PERFORM set_config('request.jwt.claims',(saved::jsonb||jsonb_build_object('active_context_id',item->>'context_id','active_tenant_id',item->>'tenant_id','active_membership_id',item->>'membership_id','active_workspace_id',item->>'workspace_id'))::text,true);
  PERFORM set_config('request.cladora.context_id',item->>'context_id',true),set_config('request.cladora.workspace_id',item->>'workspace_id',true);
  PERFORM app_private.core_functional_checkpoint_v1((item->>'context_id')::uuid,(item->>'workspace_id')::uuid,item->>'permission',item->>'module',epoch);
 END LOOP;
 PERFORM set_config('request.jwt.claims',saved,true),set_config('request.cladora.context_id',coalesce(saved_context,''),true),set_config('request.cladora.workspace_id',coalesce(saved_workspace,''),true);
 RETURN coalesce((SELECT jsonb_agg(value-'permission'-'module') FROM jsonb_array_elements(selections)),'[]');
END $body$;
REVOKE ALL ON FUNCTION app_private.list_core_service_selections_v1() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION app_private.list_core_service_selections_v1(),customer_api.list_service_catalog_v1(uuid,uuid),customer_api.read_service_requests_v1(uuid,uuid) TO cladora_core_runtime;
DO $post$ BEGIN
 IF EXISTS((TABLE pg_default_acl EXCEPT TABLE assembly_defaults) UNION ALL(TABLE assembly_defaults EXCEPT TABLE pg_default_acl))
 OR EXISTS((TABLE pg_auth_members EXCEPT TABLE assembly_members) UNION ALL(TABLE assembly_members EXCEPT TABLE pg_auth_members))
 OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid='app_private.list_core_service_selections_v1()'::regprocedure AND a.grantee<>p.proowner
   AND NOT(a.grantee='cladora_core_runtime'::regrole AND a.privilege_type='EXECUTE' AND NOT a.is_grantable))
 THEN RAISE EXCEPTION 'core_service_assembly_closure' USING ERRCODE='55000';END IF;
END $post$;
COMMIT;
