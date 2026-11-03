/** Affected no-reference boundary only; real SQL/Auth/DB/restart remain separate. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=process.argv.find(x=>x.startsWith('--toolchain='));
const require=createRequire(arg?path.join(path.resolve(arg.slice(12)),'package.json'):new URL('../package.json',import.meta.url));
const next=require('next/package.json').version,zod=require('zod/package.json').version;
assert.equal(next,'16.4.1','EXACT_TOOLCHAIN_REQUIRED');assert.equal(zod,'4.6.6','EXACT_TOOLCHAIN_REQUIRED');
const ts=require('typescript');
const ref='ae8107ad170139b650e884863f83ccb0db63edf2',fixturePath='scripts/test-core-ce012-writer-joint-review-09.mjs';
const official=execFileSync('git',['show',`${ref}:${fixturePath}`],{cwd:root,encoding:'utf8'});
assert.equal(createHash('sha256').update(official).digest('hex'),'a4283de7b0c7f6e9503520898aeedb81af730222f6502755e5d5c2a47bd4aedc');
let prefix=official.slice(0,official.indexOf('async function saved()'));
prefix=prefix.replaceAll('import.meta.url',JSON.stringify(new URL(fixturePath,new URL('../',import.meta.url)).href))
 .replace("const CE='d767e84a6d8489ee731f64eb5c8b38f29d35a7fe'",'const CE=null')
 .replace('const require=createRequire(import.meta.url)','const fixtureRequire=require');
// createRequire must resolve the exact materialized lock toolchain, including all transitive modules.
prefix=prefix.replace(/const require=createRequire\([^;]+?\),cache=new Map\(\);/,'const fixtureRequire=require,cache=new Map();')
 .replaceAll('require(name)','fixtureRequire(name)');
const compiled=ts.transpileModule(prefix+'\nexport {fixture,command,writer,core,ce};',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const m={exports:{}};new Function('require','module','exports',compiled)(require,m,m.exports);
const {fixture,command,writer,ce}=m.exports;
function draft(version=1,suffix=0){const {guide:old,cmd}=command(version,suffix);
 const {payload_fingerprint,...input}=old;const {step_id,...payload}=input.payload;assert.ok(payload_fingerprint&&step_id);
 const guide=writer.buildCe012NewSaveCommandV1({...input,payload:{...payload,document_target:null}});
 cmd.input_fingerprint=guide.payload_fingerprint;cmd.provider_source_ids=[guide.guide_id];return {guide,cmd};}
let n=0;async function check(name,fn){await fn();console.log(`ok ${++n} - ${name}`);}
const zero=f=>{assert.equal(f.ces.size,0);assert.equal(f.ledgers.size,0);assert.deepEqual(f.writes,[]);};
await check('actual writer/Core14 host save without optional document and without Documents module',async()=>{
 const f=fixture(),{guide,cmd}=draft();const r=await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide));
 assert.equal(r.status,'committed');assert.equal(f.version,2);assert.equal(f.commits,1);
 assert.equal([...f.ces.values()][0].ce_receipt.document_target,null);
 assert.equal([...f.ces.values()][0].ce_receipt.document_decision_id,null);
 assert.equal(f.trace.some(x=>/from documents\./i.test(x.q)),false);assert.equal(f.writes.includes('target'),false);
});
await check('missing Documents cannot disable standalone guide; no Documents property/factory is accessed',async()=>{
 const f=fixture(),{guide,cmd}=draft();const forbidden=new Proxy({},{get(){throw Error('DOCUMENTS_MUST_NOT_BE_ACCESSED');}});
 const r=await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,forbidden));assert.equal(r.status,'committed');
});
await check('reference-dependent command still fails closed without official Documents factory',async()=>{
 const f=fixture(),{guide,cmd}=command();assert.equal((await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide))).status,'denied');zero(f);
});
await check('new executor instance replays retained no-reference wire with no second save (memory transport, not restart proof)',async()=>{
 const f=fixture(),{guide,cmd}=draft();f.lostCommit=true;const wire=JSON.stringify({guide,cmd});
 await assert.rejects(writer.createCe012SaveWriterExecutorV1(f.host,cmd).execute(guide),e=>e.code==='CE012_SAVE_UNKNOWN');
 const before=structuredClone(f.writes);const r=await writer.createCe012SaveWriterExecutorV1(f.host,cmd).execute(guide);
 assert.equal(r.result_code,'OK');assert.equal(r.replayed,true);assert.equal(f.commits,1);assert.deepEqual(f.writes,before);assert.equal(JSON.stringify({guide,cmd}),wire);
});
await check('concurrent version conflict preserves first no-reference save',async()=>{
 const f=fixture(),a=draft(),b=draft(1,1);assert.equal((await f.host.execute(a.cmd,writer.createCe012SaveWriterProviderV1(a.guide))).status,'committed');
 const before=structuredClone({writes:f.writes,ces:f.ces,ledgers:f.ledgers});
 assert.equal((await f.host.execute(b.cmd,writer.createCe012SaveWriterProviderV1(b.guide))).status,'denied');assert.equal(f.version,2);assert.deepEqual(f.writes,before.writes);assert.deepEqual(f.ces,before.ces);assert.deepEqual(f.ledgers,before.ledgers);
});
await check('no-reference command retains currentness check after canonical reservation wait',async()=>{
 const f=fixture(),{guide,cmd}=draft(),connect=f.pool.connect.bind(f.pool);
 f.pool.connect=async()=>{const c=await connect(),query=c.query.bind(c);c.query=async(q,v)=>{const r=await query(q,v);if(q.trim().startsWith('insert into platform.idempotency_keys')){await Promise.resolve();f.expired=true;}return r;};return c;};
 assert.equal((await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide))).status,'denied');zero(f);
});
assert.equal(ce.fingerprintCe012GuideSavePayload(draft().guide).startsWith('sha256:'),true);
console.log(JSON.stringify({task:'CE-FUNCTIONAL-GUIDE-13',checks:n,toolchain:{next,zod,typescript:ts.version},result:'PASS_AFFECTED_CONTROLLED_ONLY',core_in_shared_base:'3e9593af25433dcf32042f624731f514d09ec35b/Core14',core15:'NOT_DELIVERED',real_auth_db_restart:'NOT_RUN_NOT_PASS'}));
