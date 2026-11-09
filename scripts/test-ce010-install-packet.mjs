/** Source bytes and synthetic catalog diagnostics ONLY. No SQL parser/driver/PG. */
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildCe010Packet,verifyCe010Packet,compareCe010Catalog,classifyCe010Recovery,sha256,policyPlan} from './lib/ce010-install-packet.mjs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url));
const packet=buildCe010Packet(read);let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
test('deterministic canonical source and committed packet bytes',()=>{
 assert.deepEqual(buildCe010Packet(read),packet);
 for(const[name,body]of Object.entries(packet.files))assert.equal(read('supabase/install/ce010-announcement-v1/'+name).toString(),body);
 assert.deepEqual(JSON.parse(read('supabase/install/ce010-announcement-v1/packet.json')),packet.plan);
 assert.equal(verifyCe010Packet(packet,read).status,'SOURCE_BYTES_MATCH_ONLY');
});
test('three canonical tables/five indexes/four routines with independent source spans',()=>{
 const source=read('supabase/proposals/ce_010_community_operational_v1.sql');
 assert.equal(packet.plan.declarations.filter(x=>x.kind==='table').length,3);
 assert.equal(packet.plan.declarations.filter(x=>x.kind==='index').length,5);
 assert.equal(packet.plan.declarations.filter(x=>x.kind==='function').length,4);
 for(const d of packet.plan.declarations){const bytes=source.subarray(d.offset,d.offset+d.bytes);assert.equal(sha256(bytes),d.sha256);assert.ok(packet.files['10-domain-candidate.sql'].includes(bytes.toString()));}
 assert.ok(!packet.files['10-domain-candidate.sql'].includes('community_command_receipts'));
 assert.ok(!packet.files['10-domain-candidate.sql'].includes('command_ce_community_v1('));
});
test('actual provider INSERT/UPDATE/lock and shared dynamic query census retained',()=>{
 for(const symbol of ['CE010_COMMUNITY_LOCK_SQL','CE010_ANNOUNCEMENT_LOCK_SQL','CE010_ANNOUNCEMENT_INSERT_SQL','CE010_ANNOUNCEMENT_UPDATE_SQL','CE010_NATIVE_AUTH_SQL','CE010_NATIVE_READ_SQL'])assert.ok(packet.plan.queries.some(x=>x.symbol===symbol));
 assert.ok(packet.plan.queries.some(x=>x.requires==='Core closed-admission expansion'));
 assert.ok(packet.plan.declarations.some(x=>x.name==='community.content_reports'));
 assert.deepEqual(packet.plan.columns['community.content_reports'].executor,{});
});
test('all SQL files fail before catalog/DDL; no live admission',()=>{
 for(const sql of Object.values(packet.files)){const gate=sql.indexOf("RAISE EXCEPTION 'ce010_review_only_no_target_admission'");assert.ok(gate>0);assert.ok(gate<sql.indexOf('SELECT jsonb_build_object')||sql.indexOf('SELECT jsonb_build_object')<0);assert.ok(gate<sql.indexOf('create table')||sql.indexOf('create table')<0);}
 assert.equal(packet.plan.activation,null);assert.equal(packet.plan.Core_admission.factory,null);assert.equal(packet.plan.target,null);
});
test('lock-only UPDATE column; no community mutation policy; scope is qualified',()=>{
 assert.deepEqual(packet.plan.columns['community.communities'].executor.UPDATE,['version']);
 const lock=policyPlan.find(x=>x.name==='ce010_executor_lock_only');assert.equal(lock.check,'false');
 for(const p of policyPlan){assert.ok(p.using===null||p.using.includes('c.tenant_id='+p.table+'.tenant_id'));assert.ok(!p.using?.includes('c.tenant_id=tenant_id'));}
 assert.ok(packet.files['10-domain-candidate.sql'].includes('FORCE ROW LEVEL SECURITY'));
});
for(const[name,change]of Object.entries({extra_ddl:s=>s+'\nCREATE TABLE community.bypass(id int);',grant:s=>s+'\nGRANT ALL ON community.announcements TO PUBLIC;',owner:s=>s+'\nALTER TABLE community.announcements OWNER TO authenticated;',policy:s=>s+'\nCREATE POLICY extra ON community.announcements USING(true);',unguarded:s=>s.replace("RAISE EXCEPTION 'ce010_review_only_no_target_admission' USING ERRCODE='55000';",'NULL;')}))test('coherently resealed '+name+' rejected before manifest',()=>{
 const altered=structuredClone(packet);altered.files['10-domain-candidate.sql']=change(altered.files['10-domain-candidate.sql']);
 const f=altered.plan.files.find(x=>x.path==='10-domain-candidate.sql');f.bytes=Buffer.byteLength(altered.files[f.path]);f.sha256=sha256(altered.files[f.path]);
 assert.throws(()=>verifyCe010Packet(altered,read),/EXECUTABLE_PACKET_MISMATCH/);
});
test('source drift cannot be authorized with a mutable candidate manifest',()=>{
 assert.throws(()=>buildCe010Packet(p=>p.endsWith('community-announcement-provider-v1.ts')?Buffer.concat([read(p),Buffer.from('\n')]):read(p)),/READONLY_DEPENDENCY_MISMATCH/);
});
const pre={target:'synthetic-only',roles:[{name:'owner',login:false}],role_edges:[],default_acl:[],objects:[]};
const post={...structuredClone(pre),objects:[{owner:'owner',acl:['executor:SELECT(id)'],rls:true,force:true,policies:['scoped'],constraints:['canonical']}]};
const expected={target:pre.target,reference:post.objects,core_seal:'synthetic-not-authentic'};
test('catalog diagnostic missing seals and target drift fail closed',()=>{
 assert.equal(compareCe010Catalog(pre,post,{}).status,'BLOCKED_CORE_SEALS');
 assert.equal(compareCe010Catalog(pre,{...post,target:'other'},expected).status,'TARGET_MISMATCH');
 assert.deepEqual(compareCe010Catalog(pre,post,expected),{status:'CATALOG_CONSISTENT_ONLY',native:false,authority:false});
});
for(const key of ['owner','acl','rls','force','policies','constraints'])test('catalog postimage '+key+' drift rejected',()=>{
 const changed=structuredClone(post);changed.objects[0][key]='changed';assert.equal(compareCe010Catalog(pre,changed,expected).status,'POSTIMAGE_MISMATCH');
});
for(const key of ['roles','role_edges','default_acl'])test('protected '+key+' drift rejected',()=>{
 const changed=structuredClone(post);changed[key]=['changed'];assert.equal(compareCe010Catalog(pre,changed,expected).status,'PROTECTED_CENSUS_CHANGED');
});
test('recovery exact before/after, partial and missing seal: no write/replay/ACK',()=>{
 assert.deepEqual(classifyCe010Recovery(pre,pre,expected),{status:'PREIMAGE_MATCH_REVIEWABLE_RETRY',automatic_retry:false});
 assert.equal(classifyCe010Recovery(pre,post,expected).status,'POSTIMAGE_MATCH_NO_REPLAY');
 assert.equal(classifyCe010Recovery(pre,{...post,objects:[{partial:true}]},expected).status,'UNKNOWN_NO_ACK_NO_MUTATION');
 assert.equal(classifyCe010Recovery(pre,post,{}).status,'UNKNOWN_NO_ACK_NO_MUTATION');
});
test('CLI preserves conflicting files before any overwrite; no install flag',()=>{
 const out=mkdtempSync(path.join(tmpdir(),'ce010-review-'));writeFileSync(path.join(out,'packet.json'),'existing WIP');
 const result=spawnSync(process.execPath,['scripts/build-ce010-install-packet.mjs','--output='+out],{encoding:'utf8'});
 assert.notEqual(result.status,0);assert.match(result.stderr,/PRESERVE_EXISTING_OUTPUT_CONFLICT/);assert.equal(readFileSync(path.join(out,'packet.json'),'utf8'),'existing WIP');
 const install=spawnSync(process.execPath,['scripts/build-ce010-install-packet.mjs','--install','--output='+out],{encoding:'utf8'});assert.notEqual(install.status,0);
});
console.log(JSON.stringify({checks,status:'PASS_OFFLINE_SOURCE_AND_SYNTHETIC_CATALOG_ONLY',SQL_parser:'NOT_RUN',PG_Auth_native:'NOT_RUN_NOT_PASS'}));
