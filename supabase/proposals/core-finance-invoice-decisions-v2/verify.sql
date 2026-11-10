-- Source-only exact poststate; no reader/Auth/data execution.
BEGIN READ ONLY;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $verify$ DECLARE role_oid oid; f record; p pg_proc; BEGIN
 SELECT oid INTO STRICT role_oid FROM pg_roles WHERE rolname=nullif(current_setting('cladora.finance.invoice_decisions_runtime_role',true),'');
 FOR f IN SELECT * FROM (VALUES
 ('app_private.finance_invoice_origin_scope_v2(uuid,uuid)','e02748281ef2a59d1f1537040be2e6dc01ba0659a864850a98ce7a0de8559142'),
 ('app_private.finance_invoice_decision_scope_v2(uuid,uuid,text,text,jsonb)','596227506f5b244168e66e5373345eb3ccea323cb5dda3ecb80bc9f0a6d2c8b7'),
 ('app_private.lock_finance_invoice_decisions_v2(uuid,uuid,text,text,uuid,uuid)','1ab4160f37d53d3f8b8f6f7056645cc2ed8ce0aed3e4a03b477fbd723e1c01e1')) x(signature,body_hash) LOOP
 SELECT * INTO STRICT p FROM pg_proc WHERE oid=to_regprocedure(f.signature);
 IF p.prosecdef OR p.provolatile<>'v' OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']
  OR encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')<>f.body_hash
  OR p.proowner=role_oid OR pg_has_role(role_oid,p.proowner,'USAGE')
  OR (f.signature LIKE 'app_private.lock_finance_invoice_decisions_v2%' AND (NOT p.proretset OR p.prorettype<>'utilities.review_decisions'::regtype))
  OR (f.signature NOT LIKE 'app_private.lock_finance_invoice_decisions_v2%' AND (p.proretset OR p.prorettype<>'boolean'::regtype))
  OR NOT has_function_privilege(role_oid,p.oid,'EXECUTE')
  OR EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE (a.grantee NOT IN (p.proowner,role_oid) OR (a.grantee=role_oid AND (a.privilege_type<>'EXECUTE' OR a.is_grantable))))
 THEN RAISE EXCEPTION 'finance_reader_poststate_mismatch' USING ERRCODE='55000'; END IF;
 END LOOP;
END $verify$;
DO $policies$ DECLARE who pg_roles; rel record; policy record; expected record; BEGIN
 SELECT * INTO STRICT who FROM pg_roles WHERE rolname=nullif(current_setting('cladora.finance.invoice_decisions_runtime_role',true),'');
 IF who.rolsuper OR who.rolbypassrls OR who.rolcreaterole OR who.rolcreatedb OR who.rolreplication OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=who.oid) THEN RAISE EXCEPTION 'finance_private_principal_mismatch' USING ERRCODE='55000'; END IF;
 FOR rel IN SELECT x.oid,x.relkind,x.relispartition,x.relrowsecurity FROM pg_class x
  WHERE x.oid IN ('utilities.review_tasks'::regclass,'utilities.review_decisions'::regclass)
 LOOP
  IF rel.relkind<>'r' OR rel.relispartition OR NOT rel.relrowsecurity OR pg_has_role(who.oid,(SELECT relowner FROM pg_class WHERE oid=rel.oid),'USAGE')
   OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhparent=rel.oid OR inhrelid=rel.oid)
   OR NOT has_table_privilege(who.oid,rel.oid,'SELECT')
   OR NOT has_column_privilege(who.oid,rel.oid,'id','UPDATE')
   OR has_table_privilege(who.oid,rel.oid,'INSERT,DELETE,TRUNCATE')
  THEN RAISE EXCEPTION 'finance_invoice_visibility_not_ready' USING ERRCODE='55000'; END IF;
  -- No broad UPDATE; id-only privilege is for row locks, not mutation.
  IF EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=rel.oid AND a.attnum>0 AND NOT a.attisdropped
   AND a.attname<>'id' AND has_column_privilege(who.oid,rel.oid,a.attnum,'UPDATE'))
  THEN RAISE EXCEPTION 'finance_invoice_visibility_not_ready' USING ERRCODE='55000'; END IF;
  FOR expected IN SELECT * FROM (VALUES
   ('select','r'::"char",true),('lock','w'::"char",true),('no_write','w'::"char",false)) x(suffix,command,permissive)
  LOOP
   SELECT * INTO policy FROM pg_policy WHERE polrelid=rel.oid AND polname=
    (CASE WHEN rel.oid='utilities.review_tasks'::regclass THEN 'core_finance_invoice_tasks_v2_' ELSE 'core_finance_invoice_decisions_v2_' END)||expected.suffix;
   IF NOT FOUND OR policy.polcmd<>expected.command OR policy.polpermissive<>expected.permissive
    OR policy.polroles IS DISTINCT FROM ARRAY[who.oid]::oid[]
    OR pg_get_expr(policy.polqual,rel.oid) IS DISTINCT FROM (CASE
     WHEN expected.suffix='no_write' THEN 'true'
     WHEN rel.oid='utilities.review_tasks'::regclass THEN 'app_private.finance_invoice_origin_scope_v2(tenant_id, invoice_id)'
     ELSE 'app_private.finance_invoice_decision_scope_v2(tenant_id, task_id, decision, reason, after_snapshot)' END)
    OR (expected.command='w' AND pg_get_expr(policy.polwithcheck,rel.oid) IS DISTINCT FROM 'false')
    OR (expected.command='r' AND policy.polwithcheck IS NOT NULL)
   THEN RAISE EXCEPTION 'finance_invoice_visibility_not_ready' USING ERRCODE='55000'; END IF;
  END LOOP;
  -- A known complete permissive policy ORs with actor-only policies. ANY other
  -- applicable restrictive SELECT/UPDATE/ALL predicate can hide rows: STOP.
  IF EXISTS(SELECT 1 FROM pg_policy p WHERE p.polrelid=rel.oid AND NOT p.polpermissive
   AND p.polcmd IN ('r','w','*') AND (0=ANY(p.polroles) OR EXISTS(
    SELECT 1 FROM unnest(p.polroles) role_oid WHERE role_oid<>0 AND pg_has_role(who.oid,role_oid,'USAGE')))
   AND NOT (p.polcmd='w' AND p.polroles=ARRAY[who.oid]::oid[] AND p.polname=
    (CASE WHEN rel.oid='utilities.review_tasks'::regclass THEN 'core_finance_invoice_tasks_v2_no_write' ELSE 'core_finance_invoice_decisions_v2_no_write' END)))
  THEN RAISE EXCEPTION 'finance_invoice_visibility_not_ready' USING ERRCODE='55000'; END IF;
 END LOOP;
END $policies$;
-- Exact six policy/role/USING/WITH CHECK definitions must also match the RLS
-- contract and actual caller's reader self-check. Catalog output is private.
SELECT polrelid::regclass,polname,polcmd,polpermissive,polroles,
 pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)
FROM pg_policy WHERE polrelid IN ('utilities.review_tasks'::regclass,'utilities.review_decisions'::regclass)
ORDER BY 1,2;
ROLLBACK;
