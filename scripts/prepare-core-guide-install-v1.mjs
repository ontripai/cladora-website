/** Independent source-only Guide adoption; no database, network or execution. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const hash=s=>createHash('sha256').update(s).digest('hex');
export const GUIDE_SHARED_HELPER_PINS_V1=Object.freeze([
 {signature:'app_private.check_workspace_native_permission_v2_at_v1(uuid,uuid,text,text,timestamp with time zone)',sha256:'83a291859f57e65669c4c98be1427e7d8e6de2f55fef5773e8f186b26a6dcd02'},
 {signature:'app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamp with time zone)',sha256:'e4751af691e09ea2652d2a7bef1ecb2f490d0969bbfd1445b0c99717c0fe8fbc'},
]);
export const GUIDE_INSTALL_SOURCES_V1=Object.freeze({
 'supabase/migrations/20261014082947_experience_guide_storage_lifecycle_v1.sql':'5d951a6938d8737041c6c7272f2dc40d1abe289d005afc85a7c871330116a0e5',
 'supabase/migrations/20261014132000_experience_guide_child_publish_lock_v1.sql':'3ffa7e694eec72d6cf7e1bb5e813e21cb65ce6e4519ac4025931dbfdfe820ab6',
 'supabase/migrations/20261015100000_core_platform_role_bound_pool_v1.sql':'ff944f72f3a5396c57afeeaec0406ec480f859d00ef8736b00c64f14d905e641',
 'supabase/proposals/ce_012_experience_guide_operational_v1.sql':'76905c76195fa2f7fb9a9797b731e50e0785fdc32b12f972b2bf67c21ae2459e',
});
export function canonicalGuideDefinitionsV1(){
 for(const[p,h]of Object.entries(GUIDE_INSTALL_SOURCES_V1))assert.equal(hash(read(p)),h,p);
 let s=read(Object.keys(GUIDE_INSTALL_SOURCES_V1)[0]);s=s.slice(s.indexOf('create table experience.guides'),s.indexOf('\ncommit;'));
 const child=read(Object.keys(GUIDE_INSTALL_SOURCES_V1)[1]);const next=child.slice(child.indexOf('create or replace function'),child.indexOf('\ncommit;')).replace('create or replace function','create function').trim();
 const start=s.indexOf('create function app_private.ce_guide_child_guard_v1()'),end=s.indexOf('create trigger ce_guides_guard',start);
 s=s.slice(0,start)+next+'\n\n'+s.slice(end);
 const audience=read(Object.keys(GUIDE_INSTALL_SOURCES_V1)[3]);const a=audience.indexOf('create function app_private.ce_guide_audience_allows_v1('),b=audience.indexOf('create function app_private.ce_guide_steps_valid_v1(',a);
 return s+'\n'+audience.slice(a,b);
}
export function prepareGuideCoreInstallV1(){return read('supabase/install/guide-no-document-v1/10-guide-core.prefix.sql')+'\n-- BEGIN_EXACT_CANONICAL_GUIDE_DEFINITIONS\n'+canonicalGuideDefinitionsV1()+'\n-- END_EXACT_CANONICAL_GUIDE_DEFINITIONS\n'+read('supabase/install/guide-no-document-v1/10-guide-core.suffix.sql');}
export function checkGuideCoreInstallV1(s){
 assert.equal(s,prepareGuideCoreInstallV1(),'GUIDE_INSTALL_NOT_CANONICAL');
 for(const x of ["SET LOCAL lock_timeout='5s'","SET LOCAL statement_timeout='30s'",'guide_target_plan_required','guide_shared_helper_mismatch','guide_install_collision_stop','guide_owner_delegation_missing','WITH CHECK(false)','core_guide_no_document_role_safety_v1','FORCE ROW LEVEL SECURITY'])assert.ok(s.includes(x),x);
 for(const pin of GUIDE_SHARED_HELPER_PINS_V1){assert.ok(s.includes(pin.signature));assert.ok(s.includes(pin.sha256));}
 assert.doesNotMatch(s,/DECLARE p record;/);
 assert.doesNotMatch(s,/create schema if not exists|drop (?:table|trigger|function)|alter function.*(?:check_workspace_native_permission_v2_at_v1|resolve_workspace_native_context_v2_at_v1).*owner/ig);
 return true;
}
export function prepareGuideAudienceDependencyV1(){
 const source=read('supabase/migrations/20261007085940_workspace_role_handover_v1.sql');
 assert.equal(hash(source),'d7ab82e6d1338d2ebccecb3f8f45bc157fb0d0863fafe725416838e64443b936');
 const start=source.indexOf('create function app_private.workspace_role_handover_lineage_valid_v1('),end=source.indexOf('\nrevoke all on function',start);
 const definition=source.slice(start,end),body=definition.slice(definition.indexOf('as $$')+5,definition.lastIndexOf('$$;'));
 return `-- Exact canonical audience dependency only; no role assignments or writer activation.
BEGIN;
SET LOCAL search_path=pg_catalog;
SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtextextended('core-platform-role-bound-pool.v1',0));
DO $adopt$
DECLARE marker text; f record;
BEGIN
 SELECT obj_description(oid,'pg_namespace') INTO marker FROM pg_namespace WHERE nspname='core_runtime';
 IF marker IS NULL OR marker!~'^core15-dev:[a-f0-9]{32}$'
 OR marker IS DISTINCT FROM current_setting('cladora.guide.target_marker',true)
 OR current_setting('cladora.guide.target_oid',true) IS DISTINCT FROM (SELECT oid::text FROM pg_database WHERE datname=current_database())
 OR current_user IS DISTINCT FROM current_setting('cladora.guide.installer',true) OR current_user<>session_user
 OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND (rolsuper OR rolbypassrls))
 THEN RAISE EXCEPTION 'guide_audience_dependency_admission' USING ERRCODE='55000'; END IF;
 IF to_regclass('platform.workspace_role_handover_lineage') IS NULL
 THEN RAISE EXCEPTION 'guide_canonical_lineage_table_required' USING ERRCODE='55000'; END IF;
 IF to_regprocedure('app_private.workspace_role_handover_lineage_valid_v1(uuid,uuid,uuid[])') IS NULL THEN
  IF EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='app_private' AND p.proname='workspace_role_handover_lineage_valid_v1')
  THEN RAISE EXCEPTION 'guide_audience_overload_collision' USING ERRCODE='55000'; END IF;
  EXECUTE $canonical_definition$${definition}$canonical_definition$;
  REVOKE ALL ON FUNCTION app_private.workspace_role_handover_lineage_valid_v1(uuid,uuid,uuid[]) FROM PUBLIC,anon,authenticated,service_role;
 END IF;
 SELECT p.*,r.rolname owner_name INTO STRICT f FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid='app_private.workspace_role_handover_lineage_valid_v1(uuid,uuid,uuid[])'::regprocedure;
 IF f.prosrc IS DISTINCT FROM $canonical_body$${body}$canonical_body$
 OR NOT f.prosecdef OR f.provolatile<>'s' OR f.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog']::text[]
 OR NOT has_function_privilege(current_user,f.oid,'EXECUTE')
 THEN RAISE EXCEPTION 'guide_audience_canonical_mismatch' USING ERRCODE='55000'; END IF;
END $adopt$;
COMMIT;
`;
}
if(process.argv.includes('--write')){writeFileSync('supabase/install/guide-no-document-v1/10-guide-core.sql',prepareGuideCoreInstallV1());writeFileSync('supabase/install/guide-no-document-v1/08-audience-dependency.sql',prepareGuideAudienceDependencyV1());}
if(process.argv.includes('--check')){const s=read('supabase/install/guide-no-document-v1/10-guide-core.sql');checkGuideCoreInstallV1(s);assert.equal(read('supabase/install/guide-no-document-v1/08-audience-dependency.sql'),prepareGuideAudienceDependencyV1());console.log(JSON.stringify({contract:'core-guide-install.v1',bytes:Buffer.byteLength(s),sha256:hash(s),SQL:'NOT_RUN'}));}
