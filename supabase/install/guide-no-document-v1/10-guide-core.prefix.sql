-- Source only. Platform must bind reviewed plan and obtain execution admission.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtextextended('core-platform-role-bound-pool.v1',0));
SELECT pg_advisory_xact_lock(hashtextextended('core-guide-no-document-install.v1',0));
DO $entry$
DECLARE installer_role record; item text; marker text; expected record; actual record;
BEGIN
 SELECT obj_description(oid,'pg_namespace') INTO marker FROM pg_namespace WHERE nspname='core_runtime';
 IF current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR marker IS NULL OR marker!~'^core15-dev:[a-f0-9]{32}$'
 OR marker IS DISTINCT FROM current_setting('cladora.guide.target_marker',true)
 OR (SELECT oid::text FROM pg_database WHERE datname=current_database()) IS DISTINCT FROM current_setting('cladora.guide.target_oid',true)
 OR current_user IS DISTINCT FROM current_setting('cladora.guide.installer',true) OR current_user<>session_user
 OR current_setting('cladora.guide.plan_sha256',true) IS NULL
 OR current_setting('cladora.guide.plan_sha256',true)!~'^[a-f0-9]{64}$'
 THEN RAISE EXCEPTION 'guide_target_plan_required' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT installer_role FROM pg_roles WHERE rolname=current_user;
 IF installer_role.rolsuper OR installer_role.rolbypassrls OR NOT installer_role.rolcreaterole OR NOT has_database_privilege(current_user,current_database(),'CREATE')
 THEN RAISE EXCEPTION 'guide_ordinary_installer_required' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='experience')

 OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app_private'
 AND (p.proname LIKE 'ce_guide_%' OR p.proname LIKE 'ce012_save_%' OR p.proname LIKE 'core_guide_no_document_%'
 OR p.proname IN ('assert_ce_guide_role_safety_v1','acquire_ce_guide_role_safety_lease_v1','core_platform_ce_guide_scope_allowed_v1')))
 THEN RAISE EXCEPTION 'guide_install_collision_stop' USING ERRCODE='55000'; END IF;
 IF NOT has_schema_privilege(current_user,'app_private','CREATE') THEN RAISE EXCEPTION 'guide_install_create_denied' USING ERRCODE='55000'; END IF;
 FOR item IN SELECT unnest(ARRAY['platform.tenants','platform.customer_workspaces','identity.memberships','identity.context_grants','identity.roles','platform.module_definitions','platform.idempotency_keys','platform.outbox_events','audit.events','documents.documents','documents.document_versions','platform.workspace_roles','platform.workspace_member_roles','app_private.canonical_authority_revision_v1']) LOOP
 IF to_regclass(item) IS NULL THEN RAISE EXCEPTION 'guide_install_dependency_missing' USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR expected IN SELECT * FROM (VALUES
 ('app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamp with time zone)','83a291859f57e65669c4c98be1427e7d8e6de2f55fef5773e8f186b26a6dcd02'),
 ('app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamp with time zone)','e4751af691e09ea2652d2a7bef1ecb2f490d0969bbfd1445b0c99717c0fe8fbc')) AS e(sig,sha) LOOP
 SELECT p.*,r.rolname owner_name INTO actual FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=to_regprocedure(expected.sig);
 IF NOT FOUND OR actual.owner_name<>current_user OR NOT actual.prosecdef
 OR actual.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
 OR encode(sha256(convert_to(pg_get_functiondef(actual.oid),'UTF8')),'hex')<>expected.sha
 OR EXISTS(SELECT 1 FROM aclexplode(coalesce(actual.proacl,acldefault('f',actual.proowner))) a WHERE a.grantee<>actual.proowner)
 THEN RAISE EXCEPTION 'guide_shared_helper_mismatch' USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR item IN SELECT unnest(ARRAY['auth.uid()','auth.jwt()','app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)','app_private.resolve_workspace_native_context_v2(uuid,uuid)','app_private.require_request_session_current_at_v1(timestamp with time zone)']) LOOP
 IF to_regprocedure(item) IS NULL OR NOT has_function_privilege('cladora_ce_guide_executor',item,'EXECUTE')
 THEN RAISE EXCEPTION 'guide_owner_delegation_missing' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_ce_guide_runtime' AND rolcanlogin AND NOT(rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit OR rolreplication))
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_ce_guide_executor' AND NOT(rolcanlogin OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit OR rolreplication))
 THEN RAISE EXCEPTION 'guide_roles_not_admitted' USING ERRCODE='55000'; END IF;
 IF to_regprocedure('app_private.workspace_role_handover_lineage_valid_v1(uuid,uuid,uuid[])') IS NULL
 OR NOT has_function_privilege(current_user,'app_private.workspace_role_handover_lineage_valid_v1(uuid,uuid,uuid[])','EXECUTE') THEN RAISE EXCEPTION 'guide_audience_dependency_missing' USING ERRCODE='55000'; END IF;
 -- FK permission and authority to issue precise column grants are distinct.
 IF NOT has_column_privilege(current_user,'auth.users','id','REFERENCES') THEN RAISE EXCEPTION 'guide_auth_references_required' USING ERRCODE='55000'; END IF;
END $entry$;
CREATE SCHEMA experience;
