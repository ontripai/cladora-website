-- Return to actual original grantor, NEVER assume installer can remove its grant.
RESET ROLE;
DO $settle$
DECLARE r record;helper record;new_owner oid;
BEGIN
 IF current_user<>session_user OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolsuper) THEN
  RAISE EXCEPTION 'core_quote_custodian_settlement_required' USING ERRCODE='55000'; END IF;
 SELECT oid INTO STRICT new_owner FROM pg_roles WHERE rolname='cladora_service_quote_store_owner';
 FOR r IN SELECT * FROM core_quote_schema_before LOOP
  EXECUTE format('REVOKE CREATE ON SCHEMA %I FROM cladora_service_quote_store_owner',r.nspname);
  IF NOT r.installer_create THEN EXECUTE format('REVOKE CREATE ON SCHEMA %I FROM cladora_core_installer',r.nspname); END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE oid=r.oid AND nspowner=r.nspowner) THEN
   RAISE EXCEPTION 'core_quote_schema_owner_changed' USING ERRCODE='55000'; END IF;
  IF EXISTS((SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable FROM pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.oid=r.oid AND a.grantee<>new_owner
   EXCEPT SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable FROM aclexplode(coalesce(r.nspacl,acldefault('n',r.nspowner))) a WHERE a.grantee<>new_owner)
   UNION ALL(SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable FROM aclexplode(coalesce(r.nspacl,acldefault('n',r.nspowner))) a WHERE a.grantee<>new_owner
   EXCEPT SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable FROM pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.oid=r.oid AND a.grantee<>new_owner)) THEN
   RAISE EXCEPTION 'core_quote_other_schema_acl_changed' USING ERRCODE='55000'; END IF;
 END LOOP;
 REVOKE cladora_service_quote_store_owner FROM cladora_core_installer GRANTED BY CURRENT_USER;
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE roleid=new_owner OR member=new_owner)
  OR EXISTS(SELECT 1 FROM core_quote_schema_before r WHERE has_schema_privilege('cladora_service_quote_store_owner',r.oid,'CREATE')
    OR has_schema_privilege('cladora_core_installer',r.oid,'CREATE') IS DISTINCT FROM r.installer_create)
  OR EXISTS((TABLE pg_default_acl EXCEPT TABLE core_quote_defaults) UNION ALL(TABLE core_quote_defaults EXCEPT TABLE pg_default_acl))
 THEN RAISE EXCEPTION 'core_quote_temporary_authority_not_restored' USING ERRCODE='55000'; END IF;
 FOR helper IN SELECT * FROM core_quote_protected_helpers LOOP
  IF NOT EXISTS(SELECT 1 FROM pg_proc p WHERE p.oid=helper.oid AND p.proowner=helper.proowner
   AND p.prosrc=helper.prosrc AND p.proconfig IS NOT DISTINCT FROM helper.proconfig AND p.prosecdef=helper.prosecdef) THEN
   RAISE EXCEPTION 'core_quote_provider_helper_changed' USING ERRCODE='55000'; END IF;
  IF EXISTS((SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=helper.oid AND a.grantee<>new_owner
    EXCEPT SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable FROM aclexplode(coalesce(helper.proacl,acldefault('f',helper.proowner))) a WHERE a.grantee<>new_owner)
   UNION ALL(SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable FROM aclexplode(coalesce(helper.proacl,acldefault('f',helper.proowner))) a WHERE a.grantee<>new_owner
    EXCEPT SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable FROM pg_proc p,LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE p.oid=helper.oid AND a.grantee<>new_owner)) THEN
   RAISE EXCEPTION 'core_quote_other_consumer_auth_acl_changed' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF EXISTS((SELECT oid,relowner,relacl,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='auth.users'::regclass EXCEPT TABLE core_quote_auth_table_before)
  UNION ALL(TABLE core_quote_auth_table_before EXCEPT SELECT oid,relowner,relacl,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='auth.users'::regclass))
  OR EXISTS((SELECT attnum,attacl FROM pg_attribute WHERE attrelid='auth.users'::regclass EXCEPT TABLE core_quote_auth_columns_before)
  UNION ALL(TABLE core_quote_auth_columns_before EXCEPT SELECT attnum,attacl FROM pg_attribute WHERE attrelid='auth.users'::regclass))
 THEN RAISE EXCEPTION 'core_quote_managed_auth_table_changed' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM core_quote_auth_schema_before b JOIN pg_namespace n USING(oid) WHERE n.nspowner<>b.nspowner)
  OR EXISTS((SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable FROM pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='auth' AND a.grantee<>new_owner
    EXCEPT SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable FROM core_quote_auth_schema_before b,LATERAL aclexplode(coalesce(b.nspacl,acldefault('n',b.nspowner))) a WHERE a.grantee<>new_owner)
   UNION ALL(SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable FROM core_quote_auth_schema_before b,LATERAL aclexplode(coalesce(b.nspacl,acldefault('n',b.nspowner))) a WHERE a.grantee<>new_owner
    EXCEPT SELECT a.grantor,a.grantee,a.privilege_type,a.is_grantable FROM pg_namespace n,LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a WHERE n.nspname='auth' AND a.grantee<>new_owner))
 THEN RAISE EXCEPTION 'core_quote_other_auth_schema_acl_changed' USING ERRCODE='55000'; END IF;
 IF has_schema_privilege('cladora_service_quote_store_owner','auth','CREATE') THEN
  RAISE EXCEPTION 'core_quote_auth_create_forbidden' USING ERRCODE='55000'; END IF;
END $settle$;
