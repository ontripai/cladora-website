/** NEW CE-WR09-F01/F02 temporal/caller coupling. No SQL/PG/Auth runtime. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const BASE='d767e84a6d8489ee731f64eb5c8b38f29d35a7fe';
const REVIEW='ae8107ad170139b650e884863f83ccb0db63edf2';
const before=process.argv.includes('--before');
const selected=process.argv.includes('--case')?process.argv[process.argv.indexOf('--case')+1]:null;
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const fixturePath='scripts/test-core-ce012-writer-joint-review-09.mjs';
const official=execFileSync('git',['show',`${REVIEW}:${fixturePath}`],{cwd:root,encoding:'utf8'});
// Reuse only the pinned review's loader/constraint-aware SQL transport setup.
// None of its23 successful review cases are replayed. Core/Docs source stays in Git.
let prefix=official.slice(0,official.indexOf('async function saved()'));
assert.ok(prefix.includes('function fixture()'));
prefix=prefix.replaceAll('import.meta.url',JSON.stringify(new URL(fixturePath, new URL('../',import.meta.url)).href))
 .replace(`const CE='${BASE}'`,before?`const CE='${BASE}'`:'const CE=null')
 .replace('const require=createRequire','const realmRequire=createRequire').replaceAll('require(name)','realmRequire(name)')
 .replace("ref=rel.startsWith('src/lib/community/')?CE:",`ref=rel.startsWith('src/lib/core/')?'${REVIEW}':rel.startsWith('src/lib/community/')?CE:`);
const compiled=ts.transpileModule(prefix+'\nexport {fixture,command,writer,core,docs,ce,ids,load};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const m={exports:{}};
new Function('require','module','exports',compiled)(createRequire(import.meta.url),m,m.exports);
const {fixture,command,writer,docs,ce,ids}=m.exports;
const norm=q=>q.replace(/\s+/g,' ').trim();
function transport(f, hook){const connect=f.pool.connect.bind(f.pool);f.pool.connect=async()=>{
 const c=await connect(),query=c.query.bind(c);c.query=async(q,v=[])=>hook?hook(q,v,()=>query(q,v)):query(q,v);return c;};return f;}
function prepared(version=1,suffix=0){let {guide,cmd}=command(version,suffix);
 if(!before){const {payload_fingerprint:ignored,...input}=guide;const {step_id:oldId,...payload}=input.payload;
  assert.ok(ignored&&oldId);guide=writer.buildCe012NewSaveCommandV1({...input,payload});cmd.input_fingerprint=guide.payload_fingerprint;}
 return {guide,cmd};}
const evidence=[];let n=0;
async function check(name,fn){if(selected&&name!==selected)return;const value=await fn();evidence.push({name,...value});console.log(`ok ${++n} - ${name}`);}
const zero=f=>{assert.equal(f.version,1);assert.equal(f.ces.size,0);assert.equal(f.ledgers.size,0);assert.deepEqual(f.writes,[]);};
await check('F01 exact review barrier: membership expires after final Docs visibility wait',async()=>{
 const f=fixture(),{guide,cmd}=prepared();f.expireAfterDocs=true;let release,arrived;
 const reached=new Promise(r=>{arrived=r;});f.docsRequested=arrived;f.docsBarrier=new Promise(r=>{release=r;});
 const pending=f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs));await reached;
 f.expired=true;f.now='2026-11-02T17:00:01.000000Z';release();const result=await pending;
 assert.equal(result.status,before?'committed':'denied');
 if(!before){zero(f);assert.equal(f.trace.some(x=>x.q.startsWith('update experience.guides')),false);}
 return {status:result.status,commits:f.commits,scope:'controlled temporal barrier, NOT PG'};
});
await check('F01 mutation boundary: expiry while canonical C03 reservation awaits',async()=>{
 const f=fixture(),{guide,cmd}=prepared();transport(f,async(q,v,next)=>{const r=await next();if(norm(q).startsWith('insert into platform.idempotency_keys')){await Promise.resolve();f.expired=true;}return r;});
 const result=await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs));assert.equal(result.status,before?'committed':'denied');
 if(!before){zero(f);assert.equal(f.trace.some(x=>x.q.startsWith('update experience.guides')),false);}
 return {status:result.status,commits:f.commits};
});
await check('F02 two content-version saves: new storage row before hash, previous receipt retained',async()=>{
 const f=fixture(),first=prepared();const a=await f.host.execute(first.cmd,writer.createCe012SaveWriterProviderV1(first.guide,docs));assert.equal(a.status,'committed');
 const old=structuredClone({writes:f.writes,ces:f.ces,ledgers:f.ledgers});const second=prepared(2,1);
 assert.equal(second.guide.payload_fingerprint,ce.fingerprintCe012GuideSavePayload(second.guide));
 const b=await f.host.execute(second.cmd,writer.createCe012SaveWriterProviderV1(second.guide,docs));
 assert.equal(b.status,before?'denied':'committed');
 if(before){assert.equal(f.version,2);assert.deepEqual(f.writes,old.writes);}
 else{assert.notEqual(first.guide.payload.step_id,second.guide.payload.step_id);assert.equal(f.version,3);assert.equal(f.ces.size,2);assert.equal(f.steps.size,2);
  for(const [k,r]of old.ces)assert.deepEqual(f.ces.get(k),r);for(const [k,r]of old.ledgers)assert.deepEqual(f.ledgers.get(k),r);}
 return {second_status:b.status,version:f.version,step_ids:[first.guide.payload.step_id,second.guide.payload.step_id]};
});
if(!before){
await check('checkpoint binds scope after await; altered actor/session/transaction rejected',async()=>{
 for(const scenario of ['actor','transaction','isolation']){const f=fixture(),{guide,cmd}=prepared();let afterDocs=false;
 transport(f,async(q,v,next)=>{const r=await next();if(norm(q)==='select clock_timestamp()::text as now'&&f.visibilityCount>=2)afterDocs=true;
 if(afterDocs&&norm(q).startsWith('select txid_current()::text as transaction_id, auth.uid()')){
  if(scenario==='actor')r.rows[0].actor_id='20000000-0000-4000-8000-000000000099';
  if(scenario==='transaction')r.rows[0].transaction_id='999';if(scenario==='isolation')r.rows[0].isolation='read committed';}return r;});
 assert.equal((await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs))).status,'denied');zero(f);}
 return {negatives:3};
});
await check('effect wait expiry rolls back staged domain and receipt in the same host',async()=>{
 const f=fixture(),{guide,cmd}=prepared();transport(f,async(q,v,next)=>{const r=await next();if(norm(q).startsWith('insert into experience.guide_save_receipts_v1')){await Promise.resolve();f.expired=true;}return r;});
 assert.equal((await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs))).status,'denied');zero(f);assert.equal(f.rollbacks,1);return {rollback:true};
});
await check('fresh plan/evidence path still commits and replay rechecks current authority',async()=>{
 const f=fixture(),{guide,cmd}=prepared(),p=writer.createCe012SaveWriterProviderV1(guide,docs);let evidence;
 const a=await f.host.execute(cmd,{...p,async validateProviders(...args){evidence=await p.validateProviders(...args);return evidence;}});
 assert.equal(a.status,'committed');assert.equal(a.receipt.authority.decision_id,evidence.authority_decision_id);
 assert.equal(f.trace.filter(x=>x.q.includes('m.user_id::text as actor_id')).length,6); // host, bridge, Docs, post-Docs, pre-effect, post-effect
 const writes=structuredClone(f.writes);assert.equal((await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs))).status,'exact_replay');assert.deepEqual(f.writes,writes);
 f.expired=true;assert.equal((await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs))).status,'denied');assert.deepEqual(f.writes,writes);
 return {commits:f.commits,replay_zero_writes:true};
});
await check('same original40001 object at post-Docs and mutation checkpoints; only Core retries',async()=>{
 for(const phase of ['post-docs','pre-effect','post-effect']){const f=fixture(),{guide,cmd}=prepared();const original=Object.assign(Error('synthetic 40001'),{code:'40001'});let sent=false,seen=0,hasDocs=false,hasLedger=false,hasCe=false;
 transport(f,async(q,v,next)=>{const normalized=norm(q);
 if(normalized.startsWith('select txid_current()::text as transaction_id, auth.uid()')&&!sent
 &&(phase==='post-docs'?hasDocs:phase==='pre-effect'?hasLedger:hasCe)){sent=true;throw original;}
 const r=await next();if(normalized==='select clock_timestamp()::text as now'&&f.visibilityCount>=2)hasDocs=true;
 if(normalized.startsWith('insert into platform.idempotency_keys'))hasLedger=true;if(normalized.startsWith('insert into experience.guide_save_receipts_v1'))hasCe=true;return r;});
 const p=writer.createCe012SaveWriterProviderV1(guide,docs),wrap=fn=>async(...args)=>{try{return await fn(...args);}catch(e){assert.equal(e,original);seen++;throw e;}};
 const r=await f.host.execute(cmd,{...p,validateProviders:wrap(p.validateProviders),mutate:wrap(p.mutate)});
 assert.equal(r.status,'committed');assert.equal(seen,1);assert.equal(f.attempts,2);assert.equal(f.commits,1);}
 return {phases:3,same_error:true};
});
await check('collision remains a negative: no rekey or PK/history rewrite',async()=>{
 const f=fixture(),a=prepared();await f.host.execute(a.cmd,writer.createCe012SaveWriterProviderV1(a.guide,docs));
 const old=structuredClone({writes:f.writes,steps:f.steps,ces:f.ces,ledgers:f.ledgers}),b=prepared(2,1);
 b.guide.payload.step_id=a.guide.payload.step_id;b.guide.payload_fingerprint=ce.fingerprintCe012GuideSavePayload(b.guide);b.cmd.input_fingerprint=b.guide.payload_fingerprint;
 const wire=JSON.stringify(b);assert.equal((await f.host.execute(b.cmd,writer.createCe012SaveWriterProviderV1(b.guide,docs))).status,'denied');
 assert.equal(JSON.stringify(b),wire);assert.equal(f.version,2);assert.deepEqual(f.writes,old.writes);assert.deepEqual(f.steps,old.steps);assert.deepEqual(f.ces,old.ces);assert.deepEqual(f.ledgers,old.ledgers);return {history_preserved:true};
});
await check('new command builder rejects caller step ID/fingerprint; assigns version storage identity before hash',async()=>{
 const {guide}=command();const {payload_fingerprint,...input}=guide,{step_id,...payload}=guide.payload;
 assert.throws(()=>writer.buildCe012NewSaveCommandV1({...input,payload:guide.payload}));assert.throws(()=>writer.buildCe012NewSaveCommandV1({...input,payload,payload_fingerprint}));
 const a=writer.buildCe012NewSaveCommandV1({...input,payload}),b=writer.buildCe012NewSaveCommandV1({...input,payload});assert.notEqual(a.payload.step_id,b.payload.step_id);
 assert.notEqual(a.payload.step_id,step_id);assert.equal(a.payload_fingerprint,ce.fingerprintCe012GuideSavePayload(a));return {strict_builder:true};
});
await check('UNKNOWN and explicit replay keep allocated step/body/key/fingerprint; builder is not rerun',async()=>{
 const f=fixture(),template=command();f.lostCommit=true;let builds=0,guide,cmd,executor;
 const {payload_fingerprint:oldFingerprint,...inputCommand}=template.guide;
 const {step_id:oldStep,...payload}=inputCommand.payload;assert.ok(oldFingerprint&&oldStep);
 const editor=m.exports.load('src/lib/community/experience-guide-editor-adapter.ts');
 const adapter=editor.createCe012GuideEditorAdapter({
  executor:{execute(value){if(!executor){cmd={...template.cmd,input_fingerprint:value.payload_fingerprint};executor=writer.createCe012SaveWriterExecutorV1(f.host,cmd,docs);}return executor.execute(value);}},
  buildCommand(){builds++;guide=writer.buildCe012NewSaveCommandV1({...inputCommand,payload});return guide;},
  getActiveIdentity(){return {context_id:template.guide.context_id,workspace_id:template.guide.workspace_id,guide_id:template.guide.guide_id};}
 });
 const input={guide_id:template.guide.guide_id,title:payload.title,step_title:payload.step_title,step_body:payload.instructions,target_id:'synthetic'};
 await assert.rejects(adapter.saveDraft(input),e=>e.code==='CE012_SAVE_UNKNOWN');
 const wire=JSON.stringify({guide,cmd}),writes=structuredClone(f.writes);
 f.expired=true;await assert.rejects(adapter.saveDraft(input),e=>e.code==='CE012_SAVE_UNKNOWN');assert.equal(builds,1);assert.equal(JSON.stringify({guide,cmd}),wire);assert.deepEqual(f.writes,writes);
 f.expired=false;await adapter.saveDraft(input);assert.equal(builds,1);assert.equal(JSON.stringify({guide,cmd}),wire);assert.deepEqual(f.writes,writes);assert.equal(f.commits,1);
 return {same_wire:true,allocated_once_in_actual_editor:true,denial_preserves_unknown:true,step_id:guide.payload.step_id};
});
}
console.log(JSON.stringify({task:'CE012-SAVE-WRITER-BRIDGE-07/R1',mode:before?'BEFORE_COUNTEREXAMPLES_NOT_PASS':'PASS_NEW_CONTROLLED_CHECKS',groups:n,evidence,
 fixture_dependency:{head:REVIEW,path:fixturePath,sha256:createHash('sha256').update(official).digest('hex')},runtime_binding:null,historical_slots:'BLOCKED',sql_pg_auth:'NOT_RUN_NOT_PASS'}));
