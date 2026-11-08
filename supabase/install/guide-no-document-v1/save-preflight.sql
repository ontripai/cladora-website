-- PRIVATE OUTPUT. Read-only source-closure observation, NOT target acceptance.
-- Do not run on shared target without Platform/Coordinator execution admission.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
WITH expected(signature) AS (VALUES
 ('auth.uid()'),('auth.jwt()'),
 ('app_private.resolve_workspace_native_context_v2(uuid,uuid)'),
 ('app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamp with time zone)'),
 ('app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'),
 ('app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamp with time zone)'),
 ('app_private.require_request_session_current_at_v1(timestamp with time zone)'),
 ('app_private.ce_guide_audience_allows_v1(uuid,uuid,jsonb)'),
 ('app_private.core_platform_ce_guide_scope_allowed_v1(uuid,uuid,text,text)'),
 ('app_private.core_platform_ce_guide_role_safety_valid_v1()'),
 ('app_private.assert_ce_guide_role_safety_v1()'),
 ('app_private.acquire_ce_guide_role_safety_lease_v1()'),
 ('app_private.ce012_save_receipt_immutable_v1()'),('app_private.ce012_save_core_binding_v1()')
), funcs AS (
 SELECT e.signature,p.oid,p.prokind,p.prosecdef,p.provolatile,p.proconfig,r.rolname owner,
  r.rolcanlogin owner_login,r.rolsuper owner_superuser,r.rolbypassrls owner_bypassrls,
  p.proacl::text acl,CASE WHEN p.oid IS NULL THEN NULL ELSE pg_get_functiondef(p.oid) END definition
 FROM expected e LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.signature) LEFT JOIN pg_roles r ON r.oid=p.proowner
), tables AS (
 SELECT n.nspname,c.relname,c.oid,r.rolname owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text acl
 FROM pg_namespace n JOIN pg_class c ON c.relnamespace=n.oid LEFT JOIN pg_roles r ON r.oid=c.relowner
 WHERE (n.nspname='experience' AND c.relname IN ('guides','guide_steps','guide_references','guide_save_receipts_v1'))
)
SELECT jsonb_build_object('contract','core-guide-save-preflight.v1',
 'database',current_database(),'database_oid',(SELECT oid FROM pg_database WHERE datname=current_database()),
 'principal',current_user,'session_user',session_user,'pg_version_num',current_setting('server_version_num'),
 'backend_pid',pg_backend_pid(),'backend_marker',(SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='core_runtime'),
 'functions',COALESCE((SELECT jsonb_agg(to_jsonb(f) ORDER BY signature) FROM funcs f),'[]'::jsonb),
 'tables',COALESCE((SELECT jsonb_agg(to_jsonb(t) ORDER BY relname) FROM tables t),'[]'::jsonb),
 'roles',COALESCE((SELECT jsonb_agg(jsonb_build_object('name',rolname,'oid',oid,'login',rolcanlogin,'inherit',rolinherit,
  'superuser',rolsuper,'bypassrls',rolbypassrls,'createrole',rolcreaterole,'createdb',rolcreatedb,'replication',rolreplication))
  FROM pg_roles WHERE rolname IN ('cladora_ce_guide_runtime','cladora_ce_guide_executor')),'[]'::jsonb),
 'constraints',COALESCE((SELECT jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,
  'validated',c.convalidated,'deferrable',c.condeferrable,'initially_deferred',c.condeferred,'definition',pg_get_constraintdef(c.oid)))
  FROM pg_constraint c WHERE c.conrelid IN (SELECT oid FROM tables)),'[]'::jsonb),
 'policies',COALESCE((SELECT jsonb_agg(jsonb_build_object('table',p.polrelid::regclass::text,'name',p.polname,'command',p.polcmd,
  'roles',p.polroles,'using',pg_get_expr(p.polqual,p.polrelid),'check',pg_get_expr(p.polwithcheck,p.polrelid)))
  FROM pg_policy p WHERE p.polrelid IN (SELECT oid FROM tables)),'[]'::jsonb),
 'proof','CATALOG_ONLY_NOT_SESSION_AUTHORITY_OR_INSTALL_RECEIPT');
ROLLBACK;
