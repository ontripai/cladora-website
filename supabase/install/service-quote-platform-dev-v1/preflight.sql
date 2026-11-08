-- Shared read-only prestate fragment; generator adds transaction/deadlines/admission.
DO $prestate$
DECLARE b jsonb; item record; actual text;owner_name text;acl_hash text;
BEGIN
 b:=nullif(current_setting('cladora.quote.install_binding',true),'')::jsonb;
 IF b IS NULL OR b->>'contract' IS DISTINCT FROM 'core-service-quote-target.v1'
  OR b->>'database_oid' IS DISTINCT FROM(SELECT oid::text FROM pg_database WHERE datname=current_database())
  OR b->>'target_marker' IS DISTINCT FROM(SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='core_runtime')
  OR coalesce((b->>'target_marker')~'^core15-dev:[a-f0-9]{32}$',false) IS NOT true
  OR current_setting('server_version_num')::integer<>170011
  OR current_user<>session_user
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper)
  OR nullif(b->>'execution_receipt','') IS NULL OR coalesce((b->>'packet_sha256')~'^[a-f0-9]{64}$',false) IS NOT true
 THEN RAISE EXCEPTION 'core_quote_target_or_custodian_unbound' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_core_installer'
  AND rolcanlogin AND rolcreaterole AND NOT(rolsuper OR rolbypassrls OR rolinherit OR rolreplication))
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_core_runtime'
  AND rolcanlogin AND NOT(rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit OR rolreplication))
  OR NOT has_schema_privilege('authenticated','platform_dev','USAGE')
  OR NOT has_schema_privilege('cladora_core_installer','auth','USAGE')
  OR NOT has_column_privilege('cladora_core_installer','auth.users','id','REFERENCES')
 THEN RAISE EXCEPTION 'core_quote_existing_role_or_auth_dependency' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_service_quote_store_owner')
  OR to_regclass('service_catalog.quote_drafts') IS NOT NULL
  OR to_regclass('service_catalog.quote_command_reservations') IS NOT NULL
  OR EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='service_catalog.requests'::regclass AND conname='service_request_quote_target_uq')
  OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE
    (n.nspname IN('customer_api','platform_dev') AND p.proname IN('reserve_service_quote_command_v1','read_service_quote_history_v1'))
    OR(n.nspname='app_private' AND p.proname IN('service_quote_reservation_immutable_v1','service_quote_store_scope_v1','service_quote_immutable_v1','core_service_quote_runtime_scope_v1')))
 THEN RAISE EXCEPTION 'core_quote_source_prestate_drift' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='service_catalog' AND c.relname IN('service_quote_creator_idx','service_quote_member_idx','service_request_coordinator_idx'))
  OR EXISTS(SELECT 1 FROM pg_policy WHERE polname IN('core_quote_runtime_request_read_v1','core_quote_runtime_request_lock_v1','core_quote_runtime_member_party_v1','core_quote_runtime_quote_read_v1','core_quote_runtime_quote_insert_v1','core_quote_runtime_offering_read_v1','core_quote_runtime_revision_read_v1','core_quote_runtime_party_read_v1',
   'service_quote_store_request_read','service_quote_store_request_lock','service_quote_store_authority_revision_read','service_quote_store_revision_read','service_quote_store_offering_read','service_quote_store_party_read','service_quote_store_quote_read'))
  OR EXISTS(SELECT 1 FROM pg_class WHERE oid IN('service_catalog.requests'::regclass,'identity.membership_parties'::regclass,'app_private.canonical_authority_revision_v1'::regclass,'service_catalog.revisions'::regclass,'service_catalog.offerings'::regclass,'portfolio.parties'::regclass)
   AND(relowner<>'cladora_core_installer'::regrole OR NOT relrowsecurity))
 THEN RAISE EXCEPTION 'core_quote_dependency_owner_policy_or_name_collision' USING ERRCODE='55000'; END IF;
 -- Known observed missing-object plan only. No replay-all/repair-as-applied branch.
 FOR item IN SELECT unnest(ARRAY['app_private','customer_api','service_catalog','platform_dev']) AS n LOOP
  IF to_regnamespace(item.n) IS NULL OR EXISTS(SELECT 1 FROM pg_namespace n,
   LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
   WHERE n.nspname=item.n AND a.grantee=0 AND a.privilege_type='CREATE') THEN
   RAISE EXCEPTION 'core_quote_schema_owner_boundary' USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR item IN SELECT unnest(ARRAY[
  'auth.uid()','auth.jwt()',
  'app_private.require_request_session_current_at_v1(timestamp with time zone)',
  'app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)',
  'app_private.resolve_workspace_native_context_v2(uuid,uuid)',
  'app_private.service_request_authorize_v1(uuid,uuid,text)']) AS signature LOOP
  SELECT encode(sha256(convert_to(pg_get_functiondef(to_regprocedure(item.signature)),'UTF8')),'hex') INTO actual;
  SELECT pg_get_userbyid(proowner),encode(sha256(convert_to(coalesce(proacl::text,'<DEFAULT>'),'UTF8')),'hex') INTO owner_name,acl_hash
   FROM pg_proc WHERE oid=to_regprocedure(item.signature);
  IF actual IS NULL OR actual IS DISTINCT FROM b->'helpers'->>item.signature
   OR owner_name IS DISTINCT FROM b->'helper_owners'->>item.signature
   OR acl_hash IS DISTINCT FROM b->'helper_acl_sha256'->>item.signature THEN
   RAISE EXCEPTION 'core_quote_canonical_helper_identity' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM platform.module_definitions WHERE code='services_orders' AND version=1)
  OR EXISTS(SELECT 1 FROM(VALUES ('platform.idempotency_keys','SELECT'),('platform.idempotency_keys','INSERT'),('platform.idempotency_keys','UPDATE'),('audit.events','INSERT'),('platform.outbox_events','INSERT')) v(path,privilege)
    WHERE has_table_privilege('cladora_core_runtime',v.path,v.privilege) IS NOT true)
 THEN RAISE EXCEPTION 'core_quote_existing_c03_required' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM(VALUES('auth.uid()'),('auth.jwt()'),('app_private.active_tenant_id()'),
  ('app_private.require_request_session_current_at_v1(timestamp with time zone)'),
  ('app_private.check_workspace_native_permission_v2(uuid,uuid,text,text)'),
  ('app_private.resolve_workspace_native_context_v2(uuid,uuid)')) v(signature)
  WHERE has_function_privilege('cladora_core_runtime',to_regprocedure(v.signature),'EXECUTE') IS NOT true)
  OR NOT has_schema_privilege('cladora_core_runtime','auth','USAGE')
  OR NOT has_schema_privilege('cladora_core_runtime','identity','USAGE')
 THEN RAISE EXCEPTION 'core_quote_runtime_existing_provider_dependency' USING ERRCODE='55000'; END IF;
 -- READ ONLY observation is not business/fixture/current-user/session proof.
END $prestate$;
