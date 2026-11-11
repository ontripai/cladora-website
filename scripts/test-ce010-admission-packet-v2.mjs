/** V2 delta checks: immutable source binding, catalog-source shape and synthetic
 * recovery ONLY. No PostgreSQL parser, driver, roles, grants or old suites. */
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {buildCe010AdmissionV2,verifyCe010AdmissionPacketV2,classifyCe010AdmissionV2,recoverCe010AdmissionV2,requiredDomainInventoryV2,sha256V2,sourceRootsV2} from './lib/ce010-admission-packet-v2.mjs';
const read=(ref,p)=>execFileSync('git',['show',ref+':'+p],{stdio:['ignore','pipe','pipe']});
const packet=buildCe010AdmissionV2(read),inventory=JSON.parse(packet.files['inventory.json']);let n=0;
const only=process.argv.find(x=>x.startsWith('--case='))?.slice(7);
function check(name,fn){if(only&&!name.includes(only))return;fn();console.log('PASS '+(++n)+' '+name);}
check('fixed formal roots, corrected103 references, current31-query producer and preserved legacy unit',()=>{
 assert.equal(inventory.producer_status,'OFFICIAL_SOURCE_AVAILABLE_AND_COUPLED');assert.equal(inventory.current_closed_query_profile.queries.length,31);
 const profile=JSON.parse(read('103ee9ad61c033a0745b2558b052912f16381ee2','docs/core/domain-ports-01/ce010-producer-19/profile-contract.json'));
 assert.deepEqual(inventory.mapping,profile.mapping);assert.deepEqual(inventory.safety_requirements.semantics,profile.safety_semantics);
 assert.deepEqual(inventory.safety_requirements.required_primitives,profile.required_Platform_primitives_NOT_IMPLEMENTED_HERE);
 assert.equal(inventory.slot.value,null);assert.equal(inventory.safety_requirements.definition_owner_acl_pins,null);assert.equal(inventory.observed_roles,null);
 assert.equal(JSON.parse(packet.files['fresh-plan.json']).domain_unit.sha256,'91e97be48b473852b16d41fa1437bd6ec7e0f8343cdb1a1df7ba80ea194fa5dd');
 assert.equal(inventory.source_roots.find(x=>x.path.endsWith('/postgres-transaction-host-v1.ts')).sha256,'e269802f7b4b5b376eb3910d9f1b55f42eb8abc87d1cf75fd9d019a0ffd2297a');
});
check('deterministic bytes and all committed V2 artifacts',()=>{
 assert.deepEqual(buildCe010AdmissionV2(read),packet);
 for(const[name,s]of Object.entries(packet.files))assert.equal(readFileSync('supabase/install/ce010-announcement-v2/'+name,'utf8'),s);
 assert.deepEqual(JSON.parse(readFileSync('supabase/install/ce010-announcement-v2/packet.json')),packet.manifest);
 assert.equal(verifyCe010AdmissionPacketV2(packet,read).status,'SOURCE_BYTES_MATCH_ONLY');
});
check('preflight/verify/recovery inventory is review-guarded; no helper body or mutating SQL',()=>{
 for(const[name,s]of Object.entries(packet.files).filter(([p])=>p.endsWith('.sql'))){
  assert.ok(s.indexOf("RAISE EXCEPTION 'ce010_v2_review_only_no_admission'")<s.indexOf('WITH RECURSIVE'));
  for(const feature of ['pg_auth_members','pg_default_acl','pg_policy','polpermissive','pg_get_function_identity_arguments','pg_get_functiondef','a.attacl','c.relforcerowsecurity','pg_get_constraintdef','pg_get_triggerdef'])assert.ok(s.includes(feature),name+' '+feature);
  for(const sig of inventory.safety_requirements.required_primitives)assert.ok(s.includes(sig.signature));
  assert.ok(!/\b(?:CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION|GRANT|INSERT\s+INTO|UPDATE\s+community\.|DELETE\s+FROM|ALTER\s+ROLE)\b/i.test(s));
  assert.ok(s.includes('REPEATABLE READ READ ONLY'));assert.ok(s.endsWith('ROLLBACK;\n'));
 }
 assert.equal(JSON.parse(packet.files['adaptation-plan.json']).forward_delta,null);
});
check('changed producer/source dependency is rejected before candidate metadata',()=>{
 const chosen=sourceRootsV2.find(x=>x.path.endsWith('/profile-contract.json'));
 assert.throws(()=>buildCe010AdmissionV2((ref,p)=>p===chosen.path?Buffer.concat([read(ref,p),Buffer.from('\n')]):read(ref,p)),/SOURCE_BYTES_MISMATCH/);
});
for(const key of ['00-preflight.sql','inventory.json','adaptation-plan.json'])check('coherently resealed '+key+' rejected against immutable independent roots',()=>{
 const modified=structuredClone(packet);modified.files[key]+='\n';const f=modified.manifest.files.find(x=>x.path===key);f.bytes=Buffer.byteLength(modified.files[key]);f.sha256=sha256V2(modified.files[key]);
 assert.throws(()=>verifyCe010AdmissionPacketV2(modified,read),/SOURCE_PACKET_BYTES_MISMATCH/);
});
const target={database:'synthetic-only',database_oid:1701,server_version_num:'170011',backend_marker:'synthetic-only-not-target-proof'};
const before={target,relations:requiredDomainInventoryV2.filter(x=>!x.includes('(')).map(identity=>({identity,present:false})),routines:requiredDomainInventoryV2.filter(x=>x.includes('(')).map(identity=>({identity,present:false})),roles:[],role_edges:[],schemas:[],default_acl:[]};
const post=structuredClone(before);for(const x of [...post.relations,...post.routines])x.present=true;
const reference={target,postimage:post};
check('fresh versus existing/partial paths remain separate and incapable of admission',()=>{
 const f=classifyCe010AdmissionV2(before,target);assert.equal(f.path,'fresh');assert.equal(f.status,'BLOCKED_CAPABILITY');assert.equal(f.ack,false);assert.equal(f.mutation,false);assert.equal(f.runnable,false);
 const a=classifyCe010AdmissionV2(post,target);assert.equal(a.path,'adaptation');assert.equal(a.status,'BLOCKED_CAPABILITY');
 const partial=structuredClone(before);partial.relations[0].present=true;assert.equal(classifyCe010AdmissionV2(partial,target).path,'adaptation');
 // Caller flags cannot authenticate missing helper/lease/owner/ACL or activate.
 assert.equal(classifyCe010AdmissionV2({...post,safe:true,admitted:true,lease:true},target).admitted,false);
});
check('missing/duplicate inventory, missing target and wrong expected target never become fresh',()=>{
 assert.equal(classifyCe010AdmissionV2({...before,routines:[]},target).status,'UNKNOWN_INCOMPLETE_INVENTORY');
 const dup=structuredClone(before);dup.relations.push(dup.relations[0]);assert.equal(classifyCe010AdmissionV2(dup,target).status,'UNKNOWN_INCOMPLETE_INVENTORY');
 assert.equal(classifyCe010AdmissionV2(before,{}).status,'BLOCKED_TARGET_INPUT');
 assert.equal(classifyCe010AdmissionV2(before,{...target,database_oid:999}).status,'UNKNOWN_TARGET_MISMATCH');
});
check('recovery exact target is mandatory before empty-preimage/manual-review fallback',()=>{
 const r=recoverCe010AdmissionV2(before,before,{...reference,target:{...target,database_oid:999}});assert.equal(r.reason,'TARGET_MISMATCH');assert.equal(r.ack,false);assert.equal(r.automatic_retry,false);
 assert.equal(recoverCe010AdmissionV2(before,before,reference).status,'BEFORE_IMAGE_MATCH_MANUAL_REVIEW');
 assert.equal(recoverCe010AdmissionV2(before,before,{target}).status,'BLOCKED_REFERENCE_POSTIMAGE');
 assert.equal(recoverCe010AdmissionV2(before,post,reference).status,'POSTIMAGE_METADATA_MATCH_REVIEW_ONLY');
 assert.equal(recoverCe010AdmissionV2(before,post,{target,postimage:{...post,target:{...target,database_oid:999}}}).reason,'REFERENCE_TARGET_MISMATCH');
});
for(const key of ['roles','role_edges','schemas','default_acl','relations','routines'])check('recovery '+key+' postimage drift is UNKNOWN; no ACK, mutation or replay',()=>{
 const actual=structuredClone(post);actual[key].push({unexpected:true});const r=recoverCe010AdmissionV2(before,actual,reference);
 assert.equal(r.status,'UNKNOWN_STOP_NO_ACK_NO_MUTATION');assert.equal(r.ack,false);assert.equal(r.mutation,false);assert.equal(r.automatic_retry,false);
});
check('CLI output conflicts preserve WIP before any write; install flag rejected',()=>{
 const out=mkdtempSync(path.join(tmpdir(),'ce010-v2-source-'));writeFileSync(path.join(out,'packet.json'),'existing WIP');
 const r=spawnSync(process.execPath,['scripts/build-ce010-admission-packet-v2.mjs','--output='+out],{encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/PRESERVE_EXISTING_OUTPUT_CONFLICT/);assert.equal(readFileSync(path.join(out,'packet.json'),'utf8'),'existing WIP');
 const bad=spawnSync(process.execPath,['scripts/build-ce010-admission-packet-v2.mjs','--install','--output='+out],{encoding:'utf8'});assert.notEqual(bad.status,0);
});
console.log(JSON.stringify({checks:n,proof:'SOURCE_BINDING_AND_SYNTHETIC_METADATA_ONLY',native:'NOT_RUN_NOT_PASS',SQL_parser:'NOT_RUN',old_suites_repeated:false}));
