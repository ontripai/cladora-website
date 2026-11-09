-- Read-only bounded proposal. Platform supplies a fresh target/principal receipt.
BEGIN READ ONLY;
SET LOCAL lock_timeout='5s';SET LOCAL statement_timeout='20s';
SELECT current_database() AS database_name,current_user AS observer,
 current_setting('server_version_num') AS server_version_num,
 (SELECT oid FROM pg_database WHERE datname=current_database()) AS database_oid,
 (SELECT obj_description(oid,'pg_namespace') FROM pg_namespace WHERE nspname='core_runtime') AS backend_marker;
SELECT n.nspname,c.relname,c.relkind,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity,c.relacl
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE (n.nspname,c.relname) IN (('platform','service_authoring_custody_v1'),('app_private','canonical_authority_revision_v1')) ORDER BY 1,2;
SELECT n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) AS identity,
 pg_get_userbyid(p.proowner) AS owner,p.prosecdef,p.proconfig,p.proacl,
 encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex') AS definition_sha256
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname,p.proname) IN (('platform_dev','prepare_service_offering_authoring_v1'),
 ('app_private','lock_core_request_session_v1'),('app_private','require_request_session_current_at_v1'),
 ('app_private','resolve_workspace_native_context_v2_at_v1'),('app_private','check_workspace_native_permission_v2_at_v1')) ORDER BY 1,2,3;
-- Compare exact definitions/overloads with the accepted source before adoption;
-- mere name presence is not readiness. Owner/role/default ACL/RLS observations are
-- supplied in the private Platform admission, never inferred from 'postgres'.
DO $fresh$
DECLARE b jsonb;f record;actual text;actual_owner text;actual_acl text;actual_definer boolean;actual_volatility text;actual_config text[];
BEGIN
 b:=nullif(current_setting('cladora.service.authoring_custody_binding',true),'')::jsonb;
 IF b IS NULL THEN RAISE EXCEPTION 'service_custody_adoption_unbound' USING ERRCODE='55000'; END IF;
-- FRESH_CUSTODY_HELPER_PINS_BEGIN
 FOR f IN SELECT * FROM (VALUES
 ('app_private.check_direct_effective_permission_v2_at_v1(uuid,uuid,text,text,text,uuid,uuid,timestamptz)','9e7df1887c7ce41f4e7de1b9b701a6e4b56ffff949a22b3c726ea274fa74489b',true,'s'),
 ('app_private.check_effective_permission_v2_at_v1(uuid,text,text,text,uuid,uuid,timestamptz)','c24b1a4d049d3466d86d693f0d9a19ded0bdd85296384e17fc44fca0ff0b4d63',true,'s'),
 ('app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamptz)','18bed745a9685ed0c9389f6c657df6f711eef525efce87b29808efc26c1d11d7',true,'s'),
 ('app_private.customer_mfa_required_at_v1(timestamptz)','3e364543c4860bd9b55abd2e2df99d6351c552a1ccad0e65dfcafedda96c41db',true,'s'),
 ('app_private.native_workspace_scope_for_membership_v2_at_v1(uuid,uuid,uuid,timestamptz)','d7ecb5d5a38af056d65d015d8d9f570d49794acff36a964227bb938b3abd9b3f',true,'s'),
 ('app_private.require_request_session_current_at_v1(timestamptz)','12d502678ce3eb760a064c4d8af3a01f1330580a3944048a7d87733f1a7aaa7c',true,'s'),
 ('app_private.resolve_workspace_from_customer_context_v1_at_v1(uuid,boolean,timestamptz)','8489a85003cbb2e814c5eb749cc9ec13c31fea67a012d0239248792fe245a14c',true,'s'),
 ('app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamptz)','ce7c3391383b32e7a30c464edfc34962020bd47cdf704e8ef534144ad6b5511f',true,'s'),
 ('app_private.workspace_context_covers_role_scope_v1_at_v1(uuid,uuid,text,uuid,timestamptz)','5f60bb3c24d48a03c679bd7224696feb2c2f5040158b9d2e3333987954fe662e',true,'s'),
 ('app_private.workspace_member_role_authority_active_v1_at_v1(uuid,uuid,uuid,text,uuid,uuid[],timestamptz)','8b50fb008031e95bd99d5660777c5868b90fee7e5e69c445bded6c7328676c38',true,'s'),
 ('app_private.workspace_role_identity_source_current_v1_at_v1(uuid,uuid,uuid,uuid,uuid,uuid,uuid,text,uuid,timestamptz)','01f6a216814ad9902a68e9c922574ccbb61c26b01db9a2e159d813cae035a886',true,'s'),
 ('app_private.workspace_role_scope_contains_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)','ebd3ac9d0052b960b6e0257ea4f423c3461441bd2f29671fd0df61f09e0eb125',false,'i'),
 ('app_private.workspace_role_scope_overlaps_v1(text,uuid,uuid,uuid,text,uuid,uuid,uuid)','1a92d34a89f3885dcbf7e48f1101807efbb679441ef378b2067b94fc3b7a83ca',false,'i')
 ) pin(signature,body_sha,security_definer,volatility) LOOP
  SELECT encode(sha256(convert_to(p.prosrc,'UTF8')),'hex'),p.proowner::text,
   encode(sha256(convert_to((SELECT coalesce(jsonb_agg(jsonb_build_array(a.grantor,a.grantee,a.privilege_type,a.is_grantable)
    ORDER BY a.grantor,a.grantee,a.privilege_type,a.is_grantable),'[]'::jsonb)::text
    FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a WHERE true),'UTF8')),'hex'),
   p.prosecdef,p.provolatile::text,p.proconfig
  INTO actual,actual_owner,actual_acl,actual_definer,actual_volatility,actual_config
  FROM pg_proc p WHERE p.oid=to_regprocedure(f.signature);
  IF actual IS DISTINCT FROM f.body_sha OR actual_owner IS DISTINCT FROM b->'fresh_helper_owner_oid'->>f.signature
   OR actual_acl IS DISTINCT FROM b->'fresh_helper_acl_sha256'->>f.signature OR actual_definer IS DISTINCT FROM f.security_definer
   OR actual_volatility IS DISTINCT FROM f.volatility OR actual_config IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
  THEN RAISE EXCEPTION 'custody_fresh_helper_pin_mismatch' USING ERRCODE='55000'; END IF;
 END LOOP;
 -- FRESH_CUSTODY_HELPER_PINS_END
END $fresh$;
ROLLBACK;
