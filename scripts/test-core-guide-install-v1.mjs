/** Source assertions/controlled privilege model, NOT SQL/PG/native installation. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {prepareGuideCoreInstallV1,canonicalGuideDefinitionsV1,checkGuideCoreInstallV1,GUIDE_SHARED_HELPER_PINS_V1} from './prepare-core-guide-install-v1.mjs';
const path='supabase/install/guide-no-document-v1/10-guide-core.sql',s=readFileSync(path,'utf8'),roles=readFileSync('supabase/install/guide-no-document-v1/00-fixed-roles.sql','utf8'),delegations=readFileSync('supabase/install/guide-no-document-v1/05-owner-delegations.sql','utf8');
const source=execFileSync('git',['show','62ce7bcc5c52acb043b9e35e25803a3c99c71485:src/lib/community/experience-guide-discovery-v1.ts'],{encoding:'utf8'});
let n=0;const test=(name,fn)=>{fn();console.log(`PASS ${++n} ${name}`);};
function semantics(sql){
 for(const pin of GUIDE_SHARED_HELPER_PINS_V1)assert.ok(sql.includes(pin.sha256)&&sql.includes(pin.signature));
 assert.doesNotMatch(sql,/DECLARE p record;/);
 for(const relation of ['identity.context_grants','identity.memberships','platform.customer_workspaces'])assert.match(sql,new RegExp(`GRANT SELECT\\([^;]+\\),UPDATE\\(id\\) ON ${relation.replaceAll('.','\\.')} TO cladora_ce_guide_executor;`));
 assert.match(sql,/GRANT SELECT\(singleton,revision\),UPDATE\(singleton\)/);
 assert.match(sql,/core_guide_member_lock_v1[^;]+WITH CHECK\(false\)/);
 assert.match(sql,/core_guide_context_lock_v1[^;]+WITH CHECK\(false\)/);
 assert.match(sql,/core_guide_workspace_lock_v1[^;]+WITH CHECK\(false\)/);
 assert.match(sql,/core_guide_epoch_lock_v1[^;]+WITH CHECK\(false\)/);
 assert.match(roles,/WITH ADMIN FALSE, INHERIT FALSE, SET TRUE/);assert.match(roles,/guide_role_graph_not_final/);
 assert.doesNotMatch(sql,/GRANT ALL|WITH ADMIN TRUE|BYPASSRLS\s+(?:TO|;)|ALTER FUNCTION [^;]*(?:_at_v1)[^;]*OWNER|GRANT UPDATE ON|GRANT [^;]+ TO (?:PUBLIC|anon|authenticated|service_role)/i);
 assert.match(delegations,/guide_delegation_non_acl_delta/);
 assert.match(sql,/core_guide_owner_helper_read_v1[^;]+FOR SELECT/);
 assert.match(sql,/guide_shared_helper_mismatch/);
 assert.match(sql,/app_private\.require_request_session_current_at_v1\(clock_timestamp\(\)\)/);
 assert.match(sql,/EXCEPTION WHEN SQLSTATE '40001' THEN RAISE/);
 assert.match(sql,/CREATE POLICY core_guide_c03_insert_v1[^;]+ledger_allowed_v1/);
 assert.match(sql,/core\.experience\.guide\.command\.v1/);
 assert.match(sql,/CHECK\(false\)/);return true;
}
test('deterministic packet, exact canonical definitions/child lock upgrade and proposal retained',()=>{assert.equal(s,prepareGuideCoreInstallV1());checkGuideCoreInstallV1(s);assert.ok(s.includes(canonicalGuideDefinitionsV1()));assert.match(readFileSync('supabase/proposals/ce012_save_writer_relation_v1.sql','utf8'),/ce012_save_writer_review_only/);});
test('actual CE discovery source locks exactly the three relations receiving narrow id rights',()=>{assert.match(source,/for share of g,m,w/);semantics(s);assert.match(s,/SELECT\(id,legal_name\)/);assert.match(s,/SELECT\(id,tenant_id,code,name\)/);});
test('read discovery own-actor policies do not promote read to manage; write policies remain canonical',()=>{assert.match(s,/core_guide_member_read_v1[^;]+user_id=auth\.uid\(\)/);assert.match(s,/core_guide_context_read_v1[^;]+m\.user_id=auth\.uid\(\)/);assert.match(s,/core_guide_insert_v1[^;]+experience\.guide\.manage/);assert.match(s,/core_guide_read_v1[^;]+experience\.guide\.read/);});
test('deadline/collision/target/privilege mismatch are explicit stop boundaries before creation',()=>{for(const x of ['guide_target_plan_required','guide_shared_helper_mismatch','guide_install_collision_stop','guide_owner_delegation_missing'])assert.ok(s.indexOf(x)<s.indexOf('CREATE SCHEMA experience'));assert.match(s,/SET LOCAL lock_timeout='5s'/);assert.match(s,/SET LOCAL statement_timeout='30s'/);});
for(const[name,mutate]of[
 ['record/table alias collision',x=>x.replace('DECLARE installer_role record;','DECLARE p record;')],
 ['actual helper identity replaced',x=>x.replaceAll(GUIDE_SHARED_HELPER_PINS_V1[0].sha256,'0'.repeat(64))],
 ['FOR SHARE privilege removed',x=>x.replace('),UPDATE(id) ON identity.context_grants',') ON identity.context_grants')],
 ['row lock becomes DML',x=>x.replace(/(core_guide_member_lock_v1[^;]+)WITH CHECK\(false\)/,'$1WITH CHECK(true)')],
 ['blanket grant replaces narrow rights',x=>x+'\nGRANT ALL ON SCHEMA experience TO cladora_ce_guide_executor;'],
 ['shared ownership rewritten',x=>x+'\nALTER FUNCTION app_private.resolve_workspace_native_context_v2_at_v1(uuid,uuid,timestamptz) OWNER TO cladora_ce_guide_executor;'],
 ['40001 swallowed',x=>x.replace("WHEN SQLSTATE '40001' THEN RAISE", "WHEN SQLSTATE '40001' THEN RETURN false")],
 ['forced owner helper visibility omitted',x=>x.replaceAll('core_guide_owner_helper_read_v1','removed_owner_policy')],
 ['C03 scope check removed',x=>x.replace(/(core_guide_c03_insert_v1[^;]+)app_private\.core_guide_no_document_ledger_allowed_v1\(tenant_id,actor_id,key,null\)/,'$1true')],
])test('coherent resealed negative: '+name,()=>{const b=mutate(s);assert.notEqual(b,s);assert.equal(createHash('sha256').update(b).digest('hex').length,64);assert.throws(()=>semantics(b));});
console.log(JSON.stringify({task:'CORE-DOMAIN-PORTS-01/Guide-install-R3',source_groups:n,SQL_parser_compile_execute:'NOT_RUN',native:'NOT_RUN_NOT_PASS',activation:null}));
