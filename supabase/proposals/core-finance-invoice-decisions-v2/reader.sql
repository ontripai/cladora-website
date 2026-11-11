-- Inactive Core capability. No role/GRANT/RLS installation or public facade here.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DO $prestate$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p WHERE p.pronamespace='app_private'::regnamespace AND p.proname IN
  ('finance_invoice_origin_scope_v2','finance_invoice_decision_scope_v2','lock_finance_invoice_decisions_v2'))
 THEN RAISE EXCEPTION 'finance_reader_prestate_mismatch' USING ERRCODE='55000'; END IF;
END $prestate$;

-- RLS projection only. Selectors are not authority: managed session and the
-- existing canonical at-time evaluators independently authorize the property.
CREATE FUNCTION app_private.finance_invoice_origin_scope_v2(p_tenant uuid,p_invoice uuid)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $origin_scope$
DECLARE ctx uuid; ws uuid; cycle uuid; invoice uuid; permission text; module text;
 t timestamptz; n record; w record; cy finance.monthly_cycles; property uuid;
BEGIN
 invoice:=nullif(current_setting('request.cladora.finance_invoice_v2',true),'')::uuid;
 -- No selector is no read scope, not evidence that an origin is absent.
 IF p_invoice IS NULL OR invoice IS NULL OR p_invoice<>invoice THEN RETURN false; END IF;
 ctx:=nullif(current_setting('request.cladora.context_id',true),'')::uuid;
 ws:=nullif(current_setting('request.cladora.workspace_id',true),'')::uuid;
 cycle:=nullif(current_setting('request.cladora.finance_cycle_v2',true),'')::uuid;
 permission:=nullif(current_setting('request.cladora.finance_permission_v2',true),'');
 module:=nullif(current_setting('request.cladora.finance_module_v2',true),'');
 IF ctx IS NULL OR ws IS NULL OR cycle IS NULL OR permission IS NULL OR module IS NULL
  OR (permission,module) NOT IN (('finance.monthly.manage','accounting'),
   ('finance.allocations.calculate','accounting'),('finance.allocations.approve','accounting'),('billing.manage','billing'))
  OR current_setting('transaction_isolation')<>'serializable'
 THEN RAISE EXCEPTION 'finance_invoice_visibility_not_ready' USING ERRCODE='55000'; END IF;
 -- A selector/GUC cannot authorize this call. Reuse the actual canonical
 -- Finance/C01/session family for precisely this action and cycle.
 PERFORM finance.require_invoice_source_scope_v2(ctx,ws,permission,module,cycle);
 SELECT * INTO STRICT cy FROM finance.monthly_cycles WHERE id=cycle;
 IF p_tenant IS DISTINCT FROM cy.tenant_id THEN RETURN false; END IF;
 SELECT c.property_id INTO property FROM utilities.provider_invoices i
 JOIN utilities.supply_contracts c ON c.id=i.contract_id AND c.tenant_id=i.tenant_id
 JOIN finance.accounting_periods ap ON ap.id=cy.accounting_period_id AND ap.tenant_id=cy.tenant_id
 WHERE i.id=p_invoice AND i.tenant_id=cy.tenant_id AND c.property_id=cy.property_id
  AND ap.property_id=cy.property_id AND cy.status='collecting' AND ap.status='open'
  AND i.status IN ('approved','posted') AND i.currency=cy.currency
  AND i.period_start>=ap.starts_on AND i.period_end<=ap.ends_on;
 IF NOT FOUND THEN RAISE EXCEPTION 'finance_invoice_visibility_not_ready' USING ERRCODE='55000'; END IF;
 t:=clock_timestamp();
 PERFORM app_private.require_request_session_current_at_v1(t);
 SELECT * INTO STRICT n FROM app_private.resolve_workspace_native_context_v2_at_v1(ctx,ws,t);
 SELECT * INTO STRICT w FROM app_private.resolve_workspace_from_customer_context_v1_at_v1(ctx,false,t);
 IF auth.uid() IS NULL OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'
  OR n.tenant_id IS DISTINCT FROM cy.tenant_id OR w.tenant_id IS DISTINCT FROM cy.tenant_id OR w.workspace_id IS DISTINCT FROM ws
  OR app_private.check_workspace_native_permission_v2_at_v1(ctx,ws,permission,module,t) IS NOT TRUE
  OR app_private.check_effective_permission_v2_at_v1(ctx,permission,module,'property',property,null,t) IS NOT TRUE
  OR (permission='billing.manage' AND (
   app_private.check_workspace_native_permission_v2_at_v1(ctx,ws,'billing.issue','billing',t) IS NOT TRUE
   OR app_private.check_effective_permission_v2_at_v1(ctx,'billing.issue','billing','property',property,null,t) IS NOT TRUE))
 THEN RAISE EXCEPTION 'finance_invoice_reader_denied' USING ERRCODE='42501'; END IF;
 RETURN true;
EXCEPTION WHEN invalid_text_representation THEN
 RAISE EXCEPTION 'finance_invoice_visibility_not_ready' USING ERRCODE='55000';
-- No denial-to-false or OTHERS catch: target-scope failure aborts the scan, so
-- a temporal denial followed by a later grant cannot leave a filtered subset.
END $origin_scope$;

CREATE FUNCTION app_private.finance_invoice_decision_scope_v2(p_tenant uuid,p_task uuid,p_decision text,p_reason text,p_after jsonb)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $decision_scope$
DECLARE invoice uuid;
BEGIN
 IF NOT coalesce((p_decision='submitted' AND p_reason='utilities.invoice.origin.v1')
  OR (p_decision='approved' AND p_after->>'contract_version'='utilities-invoice-review-decision.v2'),false)
 THEN RETURN false; END IF;
 SELECT t.invoice_id INTO invoice FROM utilities.review_tasks t WHERE t.id=p_task AND t.tenant_id=p_tenant;
 IF NOT FOUND OR invoice IS NULL THEN RETURN false; END IF;
 RETURN app_private.finance_invoice_origin_scope_v2(p_tenant,invoice);
END $decision_scope$;

CREATE FUNCTION app_private.lock_finance_invoice_decisions_v2(
 p_context uuid,p_workspace uuid,p_permission text,p_module text,p_cycle uuid,p_invoice uuid)
RETURNS SETOF utilities.review_decisions LANGUAGE plpgsql VOLATILE SECURITY INVOKER SET search_path=pg_catalog AS $reader$
DECLARE who pg_roles; rel record; policy record; expected record; dependency record;
 revision bigint; actor uuid:=auth.uid(); cy finance.monthly_cycles; ap finance.accounting_periods;
 i utilities.provider_invoices; c utilities.supply_contracts; native record; derived record; t timestamptz;
 task utilities.review_tasks; d utilities.review_decisions;
 records utilities.review_decisions[]:=ARRAY[]::utilities.review_decisions[];
 origins bigint:=0; approvals bigint:=0;
 old_invoice text:=current_setting('request.cladora.finance_invoice_v2',true);
 old_cycle text:=current_setting('request.cladora.finance_cycle_v2',true);
 old_permission text:=current_setting('request.cladora.finance_permission_v2',true);
 old_module text:=current_setting('request.cladora.finance_module_v2',true);
BEGIN
 IF actor IS NULL OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'
  OR p_context IS NULL OR p_workspace IS NULL OR p_cycle IS NULL OR p_invoice IS NULL
  OR p_context::text IS DISTINCT FROM lower(current_setting('request.cladora.context_id',true))
  OR p_workspace::text IS DISTINCT FROM lower(current_setting('request.cladora.workspace_id',true))
  OR p_permission IS NULL OR p_module IS NULL OR (p_permission,p_module) NOT IN (
   ('finance.monthly.manage','accounting'),('finance.allocations.calculate','accounting'),
   ('finance.allocations.approve','accounting'),('billing.manage','billing'))
 THEN RAISE EXCEPTION 'finance_invoice_reader_denied' USING ERRCODE='42501'; END IF;
 IF current_setting('transaction_isolation')<>'serializable'
  OR current_setting('transaction_read_only')<>'off'
  OR current_setting('lock_timeout')::interval<=interval '0'
  OR current_setting('lock_timeout')::interval>interval '5 seconds'
  OR current_setting('statement_timeout')::interval<=interval '0'
  OR current_setting('statement_timeout')::interval>interval '10 seconds'
 THEN RAISE EXCEPTION 'finance_invoice_reader_not_ready' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT who FROM pg_roles WHERE rolname=current_user;
 IF who.rolsuper OR who.rolbypassrls OR who.rolcreaterole OR who.rolcreatedb OR who.rolreplication
  OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=who.oid)
  OR current_user IN ('postgres','service_role','authenticated','anon','supabase_admin','supabase_auth_admin')
  OR pg_has_role(current_user,(SELECT proowner FROM pg_proc WHERE oid='app_private.lock_finance_invoice_decisions_v2(uuid,uuid,text,text,uuid,uuid)'::regprocedure),'USAGE')
  OR EXISTS(SELECT 1 FROM pg_class x WHERE x.oid IN (
   'utilities.review_tasks'::regclass,'utilities.review_decisions'::regclass,
   'utilities.provider_invoices'::regclass,'utilities.supply_contracts'::regclass,
   'finance.monthly_cycles'::regclass,'finance.accounting_periods'::regclass)
   AND pg_has_role(current_user,x.relowner,'USAGE'))
 THEN RAISE EXCEPTION 'finance_invoice_reader_not_ready' USING ERRCODE='55000'; END IF;
 -- HELPER_PINS_BEGIN (generated from the two exact Core policy projections)
 FOR dependency IN SELECT * FROM (VALUES
  ('finance.require_invoice_source_scope_v2(uuid,uuid,text,text,uuid)','c083fd996d8d563dc293170fdba73da5948ace6064fdb6d507297fef5da01417'),
  ('app_private.finance_invoice_origin_scope_v2(uuid,uuid)','e02748281ef2a59d1f1537040be2e6dc01ba0659a864850a98ce7a0de8559142'),
  ('app_private.finance_invoice_decision_scope_v2(uuid,uuid,text,text,jsonb)','596227506f5b244168e66e5373345eb3ccea323cb5dda3ecb80bc9f0a6d2c8b7')) x(signature,body_hash)
 LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=to_regprocedure(dependency.signature)
   AND NOT p.prosecdef AND p.provolatile='v' AND p.proconfig=ARRAY['search_path=pg_catalog']
   AND encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')=dependency.body_hash
   AND NOT pg_has_role(current_user,p.proowner,'USAGE'))
  THEN RAISE EXCEPTION 'finance_invoice_visibility_not_ready' USING ERRCODE='55000'; END IF;
 END LOOP;
 -- Existing canonical scope family; no utility-review permission is borrowed.
 PERFORM finance.require_invoice_source_scope_v2(p_context,p_workspace,p_permission,p_module,p_cycle);
 SELECT revision_v.revision INTO STRICT revision FROM app_private.canonical_authority_revision_v1 revision_v WHERE singleton FOR SHARE;
 SELECT * INTO STRICT cy FROM finance.monthly_cycles WHERE id=p_cycle FOR SHARE;
 SELECT * INTO STRICT ap FROM finance.accounting_periods WHERE id=cy.accounting_period_id AND tenant_id=cy.tenant_id FOR SHARE;
 SELECT * INTO i FROM utilities.provider_invoices WHERE id=p_invoice AND tenant_id=cy.tenant_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'finance_invoice_reader_not_ready' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT c FROM utilities.supply_contracts WHERE id=i.contract_id AND tenant_id=cy.tenant_id FOR SHARE;
 -- Reentrant with Finance75's invoice write-intent lock. Prevent new task FKs.
 SELECT * INTO STRICT i FROM utilities.provider_invoices WHERE id=p_invoice AND tenant_id=cy.tenant_id FOR UPDATE;
 IF i.contract_id IS DISTINCT FROM c.id OR c.property_id IS DISTINCT FROM cy.property_id
  OR ap.property_id IS DISTINCT FROM cy.property_id OR cy.status<>'collecting' OR ap.status<>'open'
  OR i.currency IS DISTINCT FROM cy.currency OR i.period_start<ap.starts_on OR i.period_end>ap.ends_on
 THEN RAISE EXCEPTION 'finance_invoice_reader_denied' USING ERRCODE='42501'; END IF;
 -- Scope selectors only. Every RLS invocation independently validates them
 -- against canonical actor/session/current permission/property/cycle data.
 PERFORM set_config('request.cladora.finance_invoice_v2',p_invoice::text,true),
  set_config('request.cladora.finance_cycle_v2',p_cycle::text,true),
  set_config('request.cladora.finance_permission_v2',p_permission,true),
  set_config('request.cladora.finance_module_v2',p_module,true);
 -- Take the SAME RowShareLock on each relation before policy proof, through
 -- row-locking SELECT admission (SELECT + UPDATE(id)), not LOCK TABLE admission
 -- (which needs table-level UPDATE/DELETE/TRUNCATE/MAINTAIN for ROW SHARE).
 -- WHERE false returns/locks no tuple, even for empty or RLS-hidden tables.
 -- PostgreSQL takes relation RowShareLock for FOR SHARE before planning/execution
 -- and holds it until transaction end; PG17 policy DDL requires AccessExclusiveLock.
 -- Keep deterministic tasks -> decisions order; do not remove these acquisitions.
 PERFORM rt.id FROM utilities.review_tasks rt WHERE false FOR SHARE OF rt;
 PERFORM rd.id FROM utilities.review_decisions rd WHERE false FOR SHARE OF rd;
 FOR rel IN SELECT x.oid,x.relkind,x.relispartition,x.relrowsecurity FROM pg_class x
  WHERE x.oid IN ('utilities.review_tasks'::regclass,'utilities.review_decisions'::regclass)
 LOOP
  IF rel.relkind<>'r' OR rel.relispartition OR NOT rel.relrowsecurity OR NOT row_security_active(rel.oid)
   OR EXISTS(SELECT 1 FROM pg_inherits WHERE inhparent=rel.oid OR inhrelid=rel.oid)
   OR NOT has_table_privilege(current_user,rel.oid,'SELECT')
   OR NOT has_column_privilege(current_user,rel.oid,'id','UPDATE')
   OR has_table_privilege(current_user,rel.oid,'INSERT,DELETE,TRUNCATE')
  THEN RAISE EXCEPTION 'finance_invoice_visibility_not_ready' USING ERRCODE='55000'; END IF;
  -- No broad UPDATE; id-only privilege is for row locks, not mutation.
  IF EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=rel.oid AND a.attnum>0 AND NOT a.attisdropped
   AND a.attname<>'id' AND has_column_privilege(current_user,rel.oid,a.attnum,'UPDATE'))
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
    SELECT 1 FROM unnest(p.polroles) role_oid WHERE role_oid<>0 AND pg_has_role(current_user,role_oid,'USAGE')))
   AND NOT (p.polcmd='w' AND p.polroles=ARRAY[who.oid]::oid[] AND p.polname=
    (CASE WHEN rel.oid='utilities.review_tasks'::regclass THEN 'core_finance_invoice_tasks_v2_no_write' ELSE 'core_finance_invoice_decisions_v2_no_write' END)))
  THEN RAISE EXCEPTION 'finance_invoice_visibility_not_ready' USING ERRCODE='55000'; END IF;
 END LOOP;
 -- Lock ALL invoice tasks, not only the selected approved task. Prevent new
 -- decision FKs after completeness observation; no status/actor/reason filter.
 FOR task IN SELECT * FROM utilities.review_tasks rt WHERE rt.tenant_id=cy.tenant_id AND rt.invoice_id=p_invoice ORDER BY rt.id FOR UPDATE
 LOOP NULL; END LOOP;
 FOR d IN SELECT rd.* FROM utilities.review_decisions rd JOIN utilities.review_tasks rt
  ON rt.id=rd.task_id AND rt.tenant_id=rd.tenant_id
  WHERE rd.tenant_id=cy.tenant_id AND rt.invoice_id=p_invoice
   AND ((rd.decision='submitted' AND rd.reason='utilities.invoice.origin.v1')
    OR (rd.decision='approved' AND rd.after_snapshot->>'contract_version'='utilities-invoice-review-decision.v2'))
  ORDER BY rd.id FOR SHARE OF rd
 LOOP
  records:=array_append(records,d);
  IF d.decision='submitted' THEN origins:=origins+1; ELSE approvals:=approvals+1; END IF;
 END LOOP;
 IF origins=0 OR approvals=0 THEN RAISE EXCEPTION 'finance_invoice_visibility_not_ready' USING ERRCODE='55000'; END IF;
 -- Restore before the final check, not after it. Failure rolls the SQL
 -- statement/transaction back; no new transaction or durable custody is made.
 PERFORM set_config('request.cladora.finance_invoice_v2',coalesce(old_invoice,''),true),
  set_config('request.cladora.finance_cycle_v2',coalesce(old_cycle,''),true),
  set_config('request.cladora.finance_permission_v2',coalesce(old_permission,''),true),
  set_config('request.cladora.finance_module_v2',coalesce(old_module,''),true);
 -- No row has escaped the function. Renew after ALL effective source/task/
 -- decision/RLS-policy waits, then project nothing except the real stored rows.
 PERFORM finance.require_invoice_source_scope_v2(p_context,p_workspace,p_permission,p_module,p_cycle);
 PERFORM app_private.core_finance_monthly_checkpoint_v1(p_context,p_workspace,p_permission,p_module,revision);
 t:=clock_timestamp();
 PERFORM app_private.require_request_session_current_at_v1(t);
 SELECT * INTO STRICT native FROM app_private.resolve_workspace_native_context_v2_at_v1(p_context,p_workspace,t);
 SELECT * INTO STRICT derived FROM app_private.resolve_workspace_from_customer_context_v1_at_v1(p_context,false,t);
 IF actor IS DISTINCT FROM auth.uid() OR auth.jwt()->>'aal' IS DISTINCT FROM 'aal2'
  OR native.tenant_id IS DISTINCT FROM cy.tenant_id OR derived.tenant_id IS DISTINCT FROM cy.tenant_id
  OR derived.workspace_id IS DISTINCT FROM p_workspace
  OR app_private.check_effective_permission_v2_at_v1(p_context,p_permission,p_module,'property',cy.property_id,null,t) IS NOT TRUE
  OR (p_permission='billing.manage' AND app_private.check_effective_permission_v2_at_v1(p_context,'billing.issue','billing','property',cy.property_id,null,t) IS NOT TRUE)
 THEN RAISE EXCEPTION 'finance_invoice_reader_denied' USING ERRCODE='42501'; END IF;
 FOREACH d IN ARRAY records LOOP RETURN NEXT d; END LOOP;
 RETURN;
END $reader$;

REVOKE ALL ON FUNCTION app_private.finance_invoice_origin_scope_v2(uuid,uuid),
 app_private.finance_invoice_decision_scope_v2(uuid,uuid,text,text,jsonb),
 app_private.lock_finance_invoice_decisions_v2(uuid,uuid,text,text,uuid,uuid) FROM PUBLIC;
DO $acl$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid IN ('app_private.finance_invoice_origin_scope_v2(uuid,uuid)'::regprocedure,
   'app_private.finance_invoice_decision_scope_v2(uuid,uuid,text,text,jsonb)'::regprocedure,
   'app_private.lock_finance_invoice_decisions_v2(uuid,uuid,text,text,uuid,uuid)'::regprocedure) AND a.grantee<>p.proowner)
 THEN RAISE EXCEPTION 'unexpected_default_function_acl' USING ERRCODE='55000'; END IF;
END $acl$;
COMMIT;
