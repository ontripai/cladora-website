-- Catalog-only proposal. No claims, review records or Auth fixtures are read.
BEGIN READ ONLY;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT current_database(),(SELECT oid FROM pg_database WHERE datname=current_database()) AS database_oid,
 current_user,session_user,pg_backend_pid(),current_setting('server_version_num');
-- Selector for an actual Platform observer, not a GUC-based authorization proof.
DO $binding$ BEGIN
 IF current_setting('server_version_num')::integer<170000 OR current_setting('server_version_num')::integer>=180000
 THEN RAISE EXCEPTION 'finance_private_pg17_required' USING ERRCODE='55000'; END IF;
 IF nullif(current_setting('cladora.finance.invoice_decisions_runtime_role',true),'') IS NULL
 THEN RAISE EXCEPTION 'finance_private_principal_unbound' USING ERRCODE='55000'; END IF;
END $binding$;
SELECT r.oid,r.rolname,r.rolsuper,r.rolbypassrls,r.rolinherit,r.rolcanlogin,
 m.roleid,m.member,m.grantor,m.admin_option,m.inherit_option,m.set_option
FROM pg_roles r LEFT JOIN pg_auth_members m ON m.member=r.oid OR m.roleid=r.oid
WHERE r.rolname=current_setting('cladora.finance.invoice_decisions_runtime_role');
SELECT c.oid::regclass,c.relkind,c.relowner::regrole,c.relrowsecurity,c.relforcerowsecurity,c.relacl,
 has_table_privilege(current_setting('cladora.finance.invoice_decisions_runtime_role'),c.oid,'SELECT') AS can_select,
 has_column_privilege(current_setting('cladora.finance.invoice_decisions_runtime_role'),c.oid,'id','UPDATE') AS can_row_lock,
 EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped
  AND a.attname<>'id' AND has_column_privilege(current_setting('cladora.finance.invoice_decisions_runtime_role'),c.oid,a.attnum,'UPDATE')) AS other_update,
 has_table_privilege(current_setting('cladora.finance.invoice_decisions_runtime_role'),c.oid,'INSERT,DELETE,TRUNCATE') AS forbidden_write,
 EXISTS(SELECT 1 FROM pg_inherits WHERE inhrelid=c.oid OR inhparent=c.oid) AS inheritance
FROM pg_class c WHERE c.oid IN ('utilities.review_tasks'::regclass,'utilities.review_decisions'::regclass);
SELECT p.polrelid::regclass,p.polname,p.polcmd,p.polpermissive,p.polroles,
 pg_get_expr(p.polqual,p.polrelid) AS using_expression,pg_get_expr(p.polwithcheck,p.polrelid) AS check_expression
FROM pg_policy p WHERE p.polrelid IN ('utilities.review_tasks'::regclass,'utilities.review_decisions'::regclass) ORDER BY 1,2;
SELECT p.oid::regprocedure,p.proowner::regrole,p.prosecdef,p.provolatile,p.proconfig,p.proacl,p.proretset,p.prorettype::regtype,
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') AS body_sha256,
 has_function_privilege(current_setting('cladora.finance.invoice_decisions_runtime_role'),p.oid,'EXECUTE') AS effective_execute
FROM pg_proc p WHERE p.oid IN (
 to_regprocedure('app_private.finance_invoice_origin_scope_v2(uuid,uuid)'),
 to_regprocedure('app_private.finance_invoice_decision_scope_v2(uuid,uuid,text,text,jsonb)'),
 to_regprocedure('app_private.lock_finance_invoice_decisions_v2(uuid,uuid,text,text,uuid,uuid)'),
 to_regprocedure('app_private.core_finance_monthly_checkpoint_v1(uuid,uuid,text,text,bigint,text,text,jsonb)'),
 to_regprocedure('app_private.core_functional_checkpoint_v1(uuid,uuid,text,text,bigint)'),
 to_regprocedure('app_private.require_request_session_current_at_v1(timestamptz)'),
 to_regprocedure('finance.require_invoice_source_scope_v2(uuid,uuid,text,text,uuid)'),
 to_regprocedure('finance.monthly_invoice_snapshot_v2(uuid,uuid,text,text,uuid,uuid)'),
 to_regprocedure('app_private.capture_monthly_cycle_source_internal_v1(uuid,uuid,text,uuid)'));
-- Include normalized inherited/default ACL/grantor and recursive Core30 fresh
-- helper observations in the same private Platform receipt; grant option is
-- recorded independently from effective EXECUTE/SELECT/row-lock access.
SELECT d.defaclrole::regrole,d.defaclnamespace::regnamespace,d.defaclobjtype,d.defaclacl
FROM pg_default_acl d WHERE d.defaclnamespace IN ('app_private'::regnamespace,'utilities'::regnamespace,'finance'::regnamespace);
ROLLBACK;
