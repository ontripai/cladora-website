/** Deterministic independent adoption unit. Never executes SQL or edits the proposal. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),sourcePath='supabase/proposals/ce012_save_writer_relation_v1.sql';
export const GUIDE_SAVE_SOURCE_SHA256='b5edb0d313d28d9cea3e6e188ad98f97002f93de914bf18f8ba9dcb2e0d12909';
export const guideSaveCanonicalBodyV1=()=>{
 const s=readFileSync(new URL(sourcePath,root),'utf8');assert.equal(createHash('sha256').update(s).digest('hex'),GUIDE_SAVE_SOURCE_SHA256,'CANONICAL_SOURCE_CHANGED');
 const start=s.indexOf('create table experience.guide_save_receipts_v1 (');const end=s.indexOf('-- No policy/grant/owner selected:');
 assert.ok(start>0&&end>start);assert.ok(s.includes("MESSAGE")||s.includes("raise exception 'ce012_save_writer_review_only'"));return s.slice(start,end);
};
const admission=`BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtextextended('core-guide-no-document-install.v1',0));
DO $admission$
DECLARE marker text; p record; sig text;
BEGIN
 SELECT obj_description(oid,'pg_namespace') INTO marker FROM pg_namespace WHERE nspname='core_runtime';
 IF current_setting('server_version_num')::integer NOT BETWEEN 170000 AND 179999
  OR marker IS NULL OR marker!~'^core15-dev:[a-f0-9]{32}$'
  OR marker IS DISTINCT FROM current_setting('cladora.guide.target_marker',true)
  OR current_setting('cladora.guide.target_oid',true) IS DISTINCT FROM (SELECT oid::text FROM pg_database WHERE datname=current_database())
  OR current_setting('cladora.guide.plan_sha256',true) IS NULL
  OR current_setting('cladora.guide.plan_sha256',true)!~'^[a-f0-9]{64}$'
  OR current_user IS DISTINCT FROM current_setting('cladora.guide.installer',true)
  OR session_user<>current_user THEN RAISE EXCEPTION 'guide_install_private_target_plan_required' USING ERRCODE='55000'; END IF;
 SELECT * INTO STRICT p FROM pg_roles WHERE rolname=current_user;
 IF p.rolsuper OR p.rolbypassrls OR current_user IN ('cladora_ce_guide_runtime','cladora_ce_guide_executor','anon','authenticated','service_role')
 THEN RAISE EXCEPTION 'guide_install_ordinary_installer_required' USING ERRCODE='55000'; END IF;
 FOR sig IN SELECT unnest(ARRAY['experience.guides','experience.guide_steps','experience.guide_references','platform.idempotency_keys','identity.context_grants','identity.memberships']) LOOP
  IF to_regclass(sig) IS NULL THEN RAISE EXCEPTION 'guide_install_preceding_unit_missing' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF to_regclass('experience.guide_save_receipts_v1') IS NOT NULL
  OR to_regprocedure('app_private.ce012_save_receipt_immutable_v1()') IS NOT NULL
  OR to_regprocedure('app_private.ce012_save_core_binding_v1()') IS NOT NULL
 THEN RAISE EXCEPTION 'guide_save_adoption_collision_stop' USING ERRCODE='55000'; END IF;
 FOR sig IN SELECT unnest(ARRAY['cladora_ce_guide_runtime','cladora_ce_guide_executor']) LOOP
  SELECT * INTO p FROM pg_roles WHERE rolname=sig;
  IF NOT FOUND OR p.rolsuper OR p.rolbypassrls OR p.rolcreatedb OR p.rolcreaterole OR p.rolreplication OR p.rolinherit
  THEN RAISE EXCEPTION 'guide_install_fixed_role_required' USING ERRCODE='55000'; END IF;
 END LOOP;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_ce_guide_runtime' AND rolcanlogin)
  OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='cladora_ce_guide_executor' AND NOT rolcanlogin)
  OR to_regprocedure('app_private.core_platform_ce_guide_scope_allowed_v1(uuid,uuid,text,text)') IS NULL
 THEN RAISE EXCEPTION 'guide_install_role_scope_prerequisite' USING ERRCODE='55000'; END IF;
END $admission$;
`;
const boundary=`
-- END_CANONICAL_GUIDE_SAVE_BODY (exact proposal body retained above)
-- Explicit document-free adoption; this unit never enables document references.
ALTER TABLE experience.guide_save_receipts_v1 ADD CONSTRAINT ce012_save_document_free_v1
 CHECK ((guide_command->'payload'->'document_target') IS NOT DISTINCT FROM 'null'::jsonb
  AND (ce_receipt->'document_target') IS NOT DISTINCT FROM 'null'::jsonb);
CREATE POLICY core_guide_save_read_v1 ON experience.guide_save_receipts_v1
 FOR SELECT TO cladora_ce_guide_executor USING (
 actor_id=auth.uid() AND command_json->>'context_id'=current_setting('request.cladora.context_id',true)
 AND app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides'));
CREATE POLICY core_guide_save_insert_v1 ON experience.guide_save_receipts_v1
 FOR INSERT TO cladora_ce_guide_executor WITH CHECK (
 actor_id=auth.uid() AND command_json->>'context_id'=current_setting('request.cladora.context_id',true)
 AND app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides')
 AND EXISTS(SELECT 1 FROM identity.context_grants g JOIN identity.memberships m ON m.id=g.membership_id AND m.tenant_id=g.tenant_id
  WHERE g.id=(command_json->>'context_id')::uuid AND g.tenant_id=guide_save_receipts_v1.tenant_id
   AND g.membership_id=guide_save_receipts_v1.membership_id AND m.user_id=guide_save_receipts_v1.actor_id));
-- SELECT FOR SHARE needs UPDATE privilege; immutable trigger and WITH CHECK(false)
-- forbid changing the historical relation. No UPDATE of receipt/payload granted.
CREATE POLICY core_guide_save_lock_v1 ON experience.guide_save_receipts_v1
 FOR UPDATE TO cladora_ce_guide_executor USING (
 actor_id=auth.uid() AND command_json->>'context_id'=current_setting('request.cladora.context_id',true)
 AND app_private.core_platform_ce_guide_scope_allowed_v1(tenant_id,workspace_id,'experience.guide.manage','experience_guides')) WITH CHECK(false);
REVOKE ALL ON experience.guide_save_receipts_v1 FROM PUBLIC,anon,authenticated,service_role,cladora_ce_guide_runtime;
GRANT SELECT,INSERT ON experience.guide_save_receipts_v1 TO cladora_ce_guide_executor;
GRANT UPDATE(canonical_key) ON experience.guide_save_receipts_v1 TO cladora_ce_guide_executor;
COMMENT ON TABLE experience.guide_save_receipts_v1 IS 'core-guide-save-adoption.v1; source-sha256:${GUIDE_SAVE_SOURCE_SHA256}; document-free; not a C03 receipt';
DO $post$
DECLARE obj record;
BEGIN
 SELECT * INTO STRICT obj FROM pg_class WHERE oid='experience.guide_save_receipts_v1'::regclass;
 IF NOT obj.relrowsecurity OR NOT obj.relforcerowsecurity OR obj.relowner IN
   (SELECT oid FROM pg_roles WHERE rolname IN ('cladora_ce_guide_runtime','cladora_ce_guide_executor'))
 THEN RAISE EXCEPTION 'guide_save_adoption_rls_owner_invalid' USING ERRCODE='55000'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=obj.oid AND tgname='ce012_save_core_binding_v1' AND tgdeferrable AND tginitdeferred AND tgenabled='O')
 THEN RAISE EXCEPTION 'guide_save_adoption_deferred_binding_missing' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM aclexplode(obj.relacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
  WHERE a.grantee<>obj.relowner AND (r.rolname IS DISTINCT FROM 'cladora_ce_guide_executor' OR a.privilege_type NOT IN ('SELECT','INSERT') OR a.is_grantable))
 THEN RAISE EXCEPTION 'guide_save_adoption_unexpected_acl' USING ERRCODE='55000'; END IF;
 IF EXISTS(SELECT 1 FROM pg_attribute c CROSS JOIN LATERAL aclexplode(c.attacl) a LEFT JOIN pg_roles r ON r.oid=a.grantee
  WHERE c.attrelid=obj.oid AND a.grantee<>obj.relowner AND
   (r.rolname IS DISTINCT FROM 'cladora_ce_guide_executor' OR c.attname<>'canonical_key' OR a.privilege_type<>'UPDATE' OR a.is_grantable))
 THEN RAISE EXCEPTION 'guide_save_adoption_unexpected_column_acl' USING ERRCODE='55000'; END IF;
END $post$;
COMMIT;
`;
export function guideSaveAdoptionSqlV1(){return '-- Independent executable adoption UNIT20; not complete target-specific Guide installer.\n'
 +'-- Original review-only source is unchanged; no historical migration receipt.\n'+admission+'-- BEGIN_CANONICAL_GUIDE_SAVE_BODY\n'+guideSaveCanonicalBodyV1()+boundary;}
export function checkGuideSaveAdoptionSqlV1(sql){
 const a=sql.indexOf('-- BEGIN_CANONICAL_GUIDE_SAVE_BODY\n'),b=sql.indexOf('\n-- END_CANONICAL_GUIDE_SAVE_BODY');assert.ok(a>0&&b>a);
 assert.equal(sql.slice(a+'-- BEGIN_CANONICAL_GUIDE_SAVE_BODY\n'.length,b),guideSaveCanonicalBodyV1(),'CANONICAL_BODY_CHANGED');
 assert.match(sql,/SET LOCAL lock_timeout='5s'/);assert.match(sql,/SET LOCAL statement_timeout='30s'/);assert.match(sql,/guide_save_adoption_collision_stop/);
 assert.ok(sql.indexOf('guide_install_private_target_plan_required')<sql.indexOf('create table experience.guide_save_receipts_v1'));
 assert.doesNotMatch(sql,/GRANT\s+[^;]*\bTO\s+(?:PUBLIC|anon|authenticated|service_role)\b/i);
 assert.doesNotMatch(sql,/GRANT\s+ALL\b/i);
 assert.match(sql,/FOR UPDATE TO cladora_ce_guide_executor USING \([\s\S]*?\) WITH CHECK\(false\);/);assert.match(sql,/guide_save_receipts_v1 force row level security/i);assert.match(sql,/ce012_save_document_free_v1/);assert.equal((sql.match(/IS NOT DISTINCT FROM 'null'::jsonb/g)??[]).length,2);
 assert.match(sql,/\nCOMMIT;\n$/);assert.doesNotMatch(sql,/ALTER\s+FUNCTION\s+(?:auth\.|communications\.)/i);
 return true;
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const p=new URL('supabase/install/guide-no-document-v1/20-save-relation.sql',root),sql=guideSaveAdoptionSqlV1();checkGuideSaveAdoptionSqlV1(sql);
 if(process.argv.includes('--check'))assert.equal(readFileSync(p,'utf8'),sql);else{mkdirSync(new URL('supabase/install/guide-no-document-v1/',root),{recursive:true});writeFileSync(p,sql);}
 console.log(JSON.stringify({path:fileURLToPath(p),bytes:Buffer.byteLength(sql),sha256:createHash('sha256').update(sql).digest('hex'),native:'NOT_RUN_NOT_PASS',full_target_installer:'SOURCE_PACKET_NATIVE_NOT_RUN'}));
}
