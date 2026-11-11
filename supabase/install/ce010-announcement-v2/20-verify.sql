-- CE010 verify: review-only catalog source. No target admission/SQL execution supplied.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='20s';
DO $review$ BEGIN RAISE EXCEPTION 'ce010_v2_review_only_no_admission' USING ERRCODE='55000'; END $review$;
-- Do not execute either safety function here. Metadata/role reachability is NOT
-- proof of a held lease, authenticated target, exclusivity or operational authority.
WITH RECURSIVE requested_relations(name) AS (VALUES ('app_private.canonical_authority_revision_v1'),('audit.events'),('auth.users'),('community.announcements'),('community.communities'),('community.content_reports'),('identity.context_grants'),('identity.memberships'),('identity.permissions'),('identity.roles'),('platform.customer_workspaces'),('platform.idempotency_keys'),('platform.module_definitions'),('platform.module_permission_bindings'),('platform.outbox_events'),('platform.tenants'),('platform.workspace_member_roles'),('platform.workspace_roles')),
requested_routines(signature) AS (VALUES ('app_private.ce_community_authorize_v1(uuid,uuid,text)'),('app_private.ce_community_audience_valid_v1(jsonb,uuid,uuid)'),('app_private.ce_community_audience_allows_v1(uuid,uuid,jsonb)'),('customer_api.read_ce_community_v1(uuid,uuid)'),('auth.uid()'),('auth.jwt()'),('app_private.resolve_workspace_native_context_v2(uuid,uuid)'),('app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'),('app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamp with time zone)'),('app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamp with time zone)'),('app_private.require_request_session_current_at_v1(timestamp with time zone)'),('app_private.workspace_role_handover_lineage_valid_v1(uuid,uuid,uuid[])'),('app_private.lock_core_request_session_v1()'),('app_private.assert_ce010_role_safety_v1()'),('app_private.acquire_ce010_role_safety_lease_v1()')),
seeds AS (SELECT oid FROM pg_roles WHERE rolname IN('cladora_ce010_runtime','cladora_ce010_executor',current_setting('cladora.ce010.owner',true))),
reach(roleid) AS (
 SELECT oid FROM seeds
 UNION SELECT m.roleid FROM reach r JOIN pg_auth_members m ON m.member=r.roleid
)
SELECT jsonb_build_object(
 'target',jsonb_build_object('database',current_database(),'database_oid',(SELECT oid FROM pg_database WHERE datname=current_database()),'server_version_num',current_setting('server_version_num'),'backend_marker',(SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='core_runtime')),
 'session_principal',session_user,'current_principal',current_user,
 'relations',(SELECT jsonb_agg(jsonb_build_object('identity',r.name,'present',c.oid IS NOT NULL,'oid',c.oid,'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'persistence',c.relpersistence,'rls',c.relrowsecurity,'force',c.relforcerowsecurity,'acl',c.relacl,
  'columns',(SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),'not_null',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'collation',a.attcollation,'acl',a.attacl,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum) FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
  'constraints',(SELECT jsonb_agg(jsonb_build_object('name',k.conname,'definition',pg_get_constraintdef(k.oid),'validated',k.convalidated) ORDER BY k.conname) FROM pg_constraint k WHERE k.conrelid=c.oid),
  'indexes',(SELECT jsonb_agg(pg_get_indexdef(i.indexrelid) ORDER BY i.indexrelid) FROM pg_index i WHERE i.indrelid=c.oid),
  'policies',(SELECT jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',p.polroles,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)) ORDER BY p.polname) FROM pg_policy p WHERE p.polrelid=c.oid),
  'triggers',(SELECT jsonb_agg(jsonb_build_object('name',t.tgname,'enabled',t.tgenabled,'definition',pg_get_triggerdef(t.oid)) ORDER BY t.tgname) FROM pg_trigger t WHERE t.tgrelid=c.oid AND NOT t.tgisinternal)
 ) ORDER BY r.name) FROM requested_relations r LEFT JOIN pg_class c ON c.oid=to_regclass(r.name)),
 'routines',(SELECT jsonb_agg(jsonb_build_object('identity',r.signature,'present',p.oid IS NOT NULL,'oid',p.oid,'owner',pg_get_userbyid(p.proowner),'identity_arguments',pg_get_function_identity_arguments(p.oid),'result',pg_get_function_result(p.oid),'definition_sha256',encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex'),'body_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),'language',l.lanname,'definer',p.prosecdef,'volatility',p.provolatile,'strict',p.proisstrict,'leakproof',p.proleakproof,'parallel',p.proparallel,'config',p.proconfig,'acl',p.proacl) ORDER BY r.signature) FROM requested_routines r LEFT JOIN pg_proc p ON p.oid=to_regprocedure(r.signature) LEFT JOIN pg_language l ON l.oid=p.prolang),
 'roles',(SELECT jsonb_agg(jsonb_build_object('name',rolname,'oid',oid,'login',rolcanlogin,'super',rolsuper,'bypassrls',rolbypassrls,'createrole',rolcreaterole,'createdb',rolcreatedb,'replication',rolreplication,'inherit',rolinherit) ORDER BY rolname) FROM pg_roles WHERE oid IN(SELECT roleid FROM reach)),
 'role_edges',(SELECT jsonb_agg(to_jsonb(m) ORDER BY m.roleid,m.member,m.grantor) FROM pg_auth_members m WHERE m.member IN(SELECT roleid FROM reach) OR m.roleid IN(SELECT roleid FROM reach)),
 'schemas',(SELECT jsonb_agg(jsonb_build_object('name',nspname,'oid',oid,'owner',pg_get_userbyid(nspowner),'acl',nspacl) ORDER BY nspname) FROM pg_namespace WHERE nspname IN('community','app_private','customer_api','identity','auth','platform','audit','core_runtime')),
 'default_acl',(SELECT jsonb_agg(to_jsonb(d) ORDER BY d.oid) FROM pg_default_acl d WHERE d.defaclnamespace=0 OR d.defaclnamespace IN(SELECT oid FROM pg_namespace WHERE nspname IN('community','app_private','customer_api','identity','auth','platform','audit','core_runtime')))
) AS ce010_admission_catalog_v2;
-- Preserve full before/after images privately. This catalog does not authenticate
-- target/lease. Missing/unknown role/helper/owner/ACL/binding is BLOCKED_CAPABILITY.
ROLLBACK;
