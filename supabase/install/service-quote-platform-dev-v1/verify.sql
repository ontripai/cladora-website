DO $verify$
DECLARE owner_id oid;f record;role_name text;
BEGIN
 SELECT oid INTO STRICT owner_id FROM pg_roles WHERE rolname='cladora_service_quote_store_owner'
  AND NOT(rolcanlogin OR rolinherit OR rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolreplication) AND rolconfig IS NULL;
 IF NOT EXISTS(SELECT 1 FROM identity.permissions p JOIN platform.module_permission_bindings b ON b.permission_id=p.id
  JOIN platform.module_definitions m ON m.id=b.module_definition_id
  WHERE p.code='services.quotes.manage' AND p.resource='services.quotes' AND p.action='manage'
  AND m.code='services_orders' AND m.version=1 AND b.permission_mode='manage' AND NOT b.is_delegable AND b.requires_aal2)
 THEN RAISE EXCEPTION 'core_quote_permission_registry_mismatch' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid=owner_id OR member=owner_id) THEN
  RAISE EXCEPTION 'core_quote_owner_membership_remaining' USING ERRCODE='55000'; END IF;
 FOR f IN SELECT unnest(ARRAY['app_private','auth','customer_api','service_catalog','platform_dev']) AS n LOOP
  IF has_schema_privilege(owner_id,f.n,'CREATE') THEN RAISE EXCEPTION 'core_quote_owner_create_remaining' USING ERRCODE='55000'; END IF;
 END LOOP;
 FOR f IN SELECT * FROM pg_proc WHERE oid IN('platform_dev.reserve_service_quote_command_v1(jsonb)'::regprocedure,'platform_dev.read_service_quote_history_v1(uuid,uuid)'::regprocedure) LOOP
  IF f.proowner<>owner_id OR NOT f.prosecdef OR f.prorettype<>'jsonb'::regtype OR f.provolatile<>'v' OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
   OR NOT has_function_privilege('authenticated',f.oid,'EXECUTE')
   OR EXISTS(SELECT 1 FROM aclexplode(coalesce(f.proacl,acldefault('f',f.proowner))) a
    WHERE a.grantee NOT IN(owner_id,'authenticated'::regrole) OR(a.grantee='authenticated'::regrole AND a.is_grantable)) THEN
   RAISE EXCEPTION 'core_quote_facade_acl_or_owner' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid IN('customer_api.reserve_service_quote_command_v1(jsonb)'::regprocedure,'customer_api.read_service_quote_history_v1(uuid,uuid)'::regprocedure,
  'app_private.service_quote_store_scope_v1()'::regprocedure,'app_private.service_quote_reservation_immutable_v1()'::regprocedure)
  AND(a.grantee<>owner_id OR p.proowner<>owner_id OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[])) THEN
  RAISE EXCEPTION 'core_quote_private_canonical_exposure' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_proc WHERE oid='app_private.core_service_quote_runtime_scope_v1(uuid,uuid)'::regprocedure
  AND proowner='cladora_core_installer'::regrole AND NOT prosecdef AND provolatile='v'
  AND proconfig=ARRAY['search_path=pg_catalog']::text[])
 OR EXISTS(SELECT 1 FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
  WHERE p.oid='app_private.core_service_quote_runtime_scope_v1(uuid,uuid)'::regprocedure
  AND a.grantee NOT IN(p.proowner,'cladora_core_runtime'::regrole))
 THEN RAISE EXCEPTION 'core_quote_current_scope_helper_boundary' USING ERRCODE='55000'; END IF;
 FOR f IN SELECT * FROM(VALUES
  ('service_catalog.requests','core_quote_runtime_request_read_v1'),('service_catalog.requests','core_quote_runtime_request_lock_v1'),
  ('identity.membership_parties','core_quote_runtime_member_party_v1'),('service_catalog.offerings','core_quote_runtime_offering_read_v1'),
  ('service_catalog.revisions','core_quote_runtime_revision_read_v1'),('portfolio.parties','core_quote_runtime_party_read_v1'),
  ('service_catalog.quote_drafts','core_quote_runtime_quote_read_v1'),('service_catalog.quote_drafts','core_quote_runtime_quote_insert_v1')) v(path,policy_name) LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_policy WHERE polrelid=f.path::regclass AND polname=f.policy_name
   AND polroles=ARRAY['cladora_core_runtime'::regrole::oid]) THEN
   RAISE EXCEPTION 'core_quote_runtime_policy_missing_or_wrong_role' USING ERRCODE='55000'; END IF;
 END LOOP;
 -- CORE_QUOTE_CANONICAL_BODY_PINS
 IF EXISTS(SELECT 1 FROM pg_class WHERE oid IN('service_catalog.quote_command_reservations'::regclass,'service_catalog.quote_drafts'::regclass)
  AND(NOT relrowsecurity OR NOT relforcerowsecurity))
  OR (SELECT relowner FROM pg_class WHERE oid='service_catalog.quote_command_reservations'::regclass)<>owner_id
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='service_catalog.quote_command_reservations'::regclass AND contype='f'
   AND confrelid='service_catalog.requests'::regclass AND cardinality(conkey)=5 AND convalidated)
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='service_catalog.requests'::regclass AND conname='service_request_quote_target_uq' AND contype='u' AND convalidated)
 THEN RAISE EXCEPTION 'core_quote_store_rls_fk_or_owner' USING ERRCODE='55000'; END IF;
 FOREACH role_name IN ARRAY ARRAY['anon','authenticated','service_role'] LOOP
  IF has_table_privilege(role_name,'service_catalog.quote_command_reservations','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_any_column_privilege(role_name,'service_catalog.quote_command_reservations','SELECT,INSERT,UPDATE')
   OR has_table_privilege(role_name,'service_catalog.quote_drafts','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
   OR has_any_column_privilege(role_name,'service_catalog.quote_drafts','SELECT,INSERT,UPDATE') THEN
   RAISE EXCEPTION 'core_quote_unexpected_direct_table_access' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF has_table_privilege('cladora_core_runtime','service_catalog.quote_drafts','UPDATE,DELETE,TRUNCATE')
  OR has_any_column_privilege('cladora_core_runtime','service_catalog.quote_drafts','UPDATE')
  OR has_table_privilege('cladora_core_runtime','service_catalog.quote_command_reservations','INSERT,UPDATE,DELETE,TRUNCATE')
  OR has_any_column_privilege('cladora_core_runtime','service_catalog.quote_command_reservations','INSERT,UPDATE') THEN
  RAISE EXCEPTION 'core_quote_c03_acl_ceiling' USING ERRCODE='55000'; END IF;
END $verify$;
