-- Read-only proposal. Never executed by Core; no target assumption.
BEGIN READ ONLY;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT current_database(),current_user,session_user,current_setting('server_version_num');
-- Owner/ACL/RLS/function definitions are private Platform evidence, not public logs.
SELECT p.oid::regprocedure,p.proowner::regrole,p.prosecdef,p.provolatile,p.proconfig,p.proacl,
 encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') AS body_sha256
FROM pg_proc p WHERE p.oid IN (
 to_regprocedure('app_private.core_functional_checkpoint_v1(uuid,uuid,text,text,bigint)'),
 to_regprocedure('app_private.require_request_session_current_at_v1(timestamptz)'),
 to_regprocedure('app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamptz)'),
 to_regprocedure('app_private.resolve_workspace_from_customer_context_v1_at_v1(uuid,boolean,timestamptz)'),
 to_regprocedure('app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamptz)'));
-- Compare all five rows to exact approved effective helper pins; absence/mismatch STOP.
-- Separate actual role/membership mapping and cross-actor origin RLS evidence required.
DO $fresh$
DECLARE b jsonb;f record;actual text;actual_owner text;actual_acl text;actual_definer boolean;actual_volatility text;actual_config text[];
BEGIN
 b:=nullif(current_setting('cladora.finance.monthly_binding',true),'')::jsonb;
 IF b IS NULL THEN RAISE EXCEPTION 'finance_adoption_unbound' USING ERRCODE='55000'; END IF;
-- FRESH_FINANCE_HELPER_PINS_BEGIN
 FOR f IN SELECT * FROM (VALUES
 ('app_private.core_functional_checkpoint_v1(uuid,uuid,text,text,bigint)','b1336a17781650def0bb0b890cf3ec225adc3fb93a7345960c63ab7b2396567c',true,'v'),
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
  THEN RAISE EXCEPTION 'finance_fresh_helper_pin_mismatch' USING ERRCODE='55000'; END IF;
 END LOOP;
 -- FRESH_FINANCE_HELPER_PINS_END
END $fresh$;
ROLLBACK;
