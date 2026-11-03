/** Core14 matcher-only tests using actual Core13 records and pinned Docs09 code.
 * Controlled transport only. No prior suite, SQL, PG, Auth or network execution.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const original=new URL('./test-core-ce012-replay-joint-seal-13.mjs',import.meta.url);
const source=readFileSync(original,'utf8');
// Extract DEFINITIONS only, not the 23 old test groups. Docs09 retains the exact
// Core13 owner factory bytes and adds its separate closed-result adopter.
const prefix=source.slice(source.indexOf('const original='),source.indexOf('\nlet n=0;'))
 .replace("new URL('./test-core-host-terminal-lifecycle-11.mjs',import.meta.url)","new URL('./test-core-host-terminal-lifecycle-11.mjs',providedUrl)")
 .replaceAll('6f69db12455b9c750eae0c2a24c7a7c7faa16d3d','f64fa2dacf895fdea698e46ffc178aa0d8270f0e');
const {setup,core,provider,id,env}=new Function('assert','readFileSync','execFileSync','createRequire','resolve','dirname','extname','fileURLToPath','ts','providedUrl',prefix+'\nreturn {setup,core,provider,id,env};')
 (assert,readFileSync,execFileSync,createRequire,resolve,dirname,extname,fileURLToPath,ts,original.href);
const matcher=core.matchCoreCe012ClosedBindingV1;
assert.equal(typeof matcher,'function');
const ownerPath='src/lib/customer/documents-ce012-target-disclosure-port-v1.ts';
assert.deepEqual(execFileSync('git',['show',`f64fa2dacf895fdea698e46ffc178aa0d8270f0e:${ownerPath}`]),
 execFileSync('git',['show',`6f69db12455b9c750eae0c2a24c7a7c7faa16d3d:${ownerPath}`]));
const docs=env.load('src/lib/customer/documents-ce012-core13-closed-replay-adopter-v1.ts');
const hashReceipt=env.load('src/lib/core/transaction-replay-provider-hook-v1.ts').coreTransactionReplayReceiptHashV1;
const x=await setup(),beforeWrites=structuredClone(x.f.writes),r=await x.f.host.executeReplayOnly(x.cmd,provider(x.guide));
assert.equal(r.status,'exact_replay');
const bytes=Buffer.from(JSON.stringify(r)),joint=core.coreHostJointReplaySealV1(r),row=x.f.ces.get(x.key);
const expected={contract:core.CORE_CE012_CLOSED_BINDING_MATCHER_V1,command:structuredClone(x.cmd),binding:{
 transaction_id:x.cmd.transaction_id,database_transaction_id:joint.database_transaction_id,
 attempt:joint.attempt,backend_pid:joint.backend_pid,actor_id:x.cmd.actor_id,tenant_id:id(2),
 context_id:x.cmd.context_id,workspace_id:x.cmd.workspace_id,membership_id:id(6),command_id:x.cmd.command_id,
 canonical_key:x.key,command_hash:createHash('sha256').update(JSON.stringify(x.cmd)).digest('hex'),
 authority_revision:x.cmd.authority_version,ce_save_receipt_id:row.ce_receipt.receipt_id,
 core_receipt_id:r.receipt.receipt_id,core_receipt_hash:hashReceipt(r.receipt),mutation_id:r.receipt.mutation_id,
 target:structuredClone(joint.target)}};
let n=0;async function check(name,fn){await fn();console.log(`PASS ${++n} ${name}`);}
function no(e,rr=r,bb=bytes){const a=matcher(rr,bb,e);assert.equal(a.match,'NO_MATCH');assert.equal(a.status,'not_ready');assert.equal(a.projection,null);assert.equal(a.current_authority,'not_evaluated');}
const trace=x.f.trace.length,attempts=x.f.attempts;
await check('actual Core13 private record and exact response positively match, historical only',()=>{
 const answer=matcher(r,bytes,expected);assert.equal(answer.match,'MATCH');assert.equal(answer.status,'not_ready');assert.equal(answer.projection,null);assert.equal(answer.current_authority,'not_evaluated');assert.ok(Object.isFrozen(answer));
 assert.deepEqual(Object.keys(answer).sort(),['contract','match','status','projection','current_authority'].sort());
});
await check('Docs09 known CE-ID counterexample reaches required gate; Core14 rejects changed CE with SAME result/bytes',()=>{
 const original={contract:'core-ce012-stored-relation.v1',command:x.cmd,guide_command:x.guide,
 expected:{core_receipt_id:r.receipt.receipt_id,core_receipt_hash:hashReceipt(r.receipt),ce_save_receipt_id:row.ce_receipt.receipt_id,receipt_hash_contract:'core-transaction-replay-provider-receipt.v1'}};
 const d={contract:docs.DOCUMENTS_CORE13_CLOSED_REPLAY_ADOPTER_V1,original,execution:{attempt:joint.attempt,backend_pid:joint.backend_pid,database_transaction_id:joint.database_transaction_id}};
 assert.equal(docs.readDocumentsCore13ClosedReplayV1(r,bytes,d).code,'OFFICIAL_CLOSED_BINDING_MATCHER_REQUIRED');
 const changed=structuredClone(d);changed.original.expected.ce_save_receipt_id=id(97);
 assert.equal(docs.readDocumentsCore13ClosedReplayV1(r,bytes,changed).code,'OFFICIAL_CLOSED_BINDING_MATCHER_REQUIRED');
 const e=structuredClone(expected);e.binding.ce_save_receipt_id=id(97);no(e);
});
for(const [field,value] of Object.entries(expected.binding)){
 if(field==='target')continue;
 await check(`independent binding mismatch: ${field}`,()=>{const e=structuredClone(expected);
 e.binding[field]=typeof value==='number'?value+1:field.endsWith('hash')?'a'.repeat(64):field==='database_transaction_id'?String(BigInt(value)+BigInt(1)):field==='canonical_key'?value+'-other':id(98);no(e);});
}
for(const field of Object.keys(expected.binding.target))await check(`independent target mismatch: ${field}`,()=>{
 const e=structuredClone(expected);e.binding.target[field]=field==='document_version'?4:id(98);no(e);
});
for(const field of Object.keys(expected.command))await check(`full command/body mismatch: ${field}`,()=>{
 const e=structuredClone(expected),v=e.command[field];
 e.command[field]=typeof v==='number'?v+1:typeof v==='string'?v+'x':Array.isArray(v)?[...v,id(98)]:{...v,version:99};
 // Recompute the supplied digest coherently; it is STILL not the private record.
 e.binding.command_hash=createHash('sha256').update(JSON.stringify(e.command)).digest('hex');no(e);
});
for(const section of ['root','command','binding','target']){
 const object=section==='root'?expected:section==='target'?expected.binding.target:expected[section];
 for(const field of Object.keys(object))await check(`missing strict field: ${section}.${field}`,()=>{
 const e=structuredClone(expected),obj=section==='root'?e:section==='target'?e.binding.target:e[section];delete obj[field];no(e);
 });
}
await check('extra verifier/candidate/allow and incomplete/manual hash expectations fail strict parsing',()=>{
 for(const extra of [{allow:true},{verifier:()=>true},{candidate:joint},{command_hash:expected.binding.command_hash}])no({...expected,...extra});
 no({hash:expected.binding.command_hash});no(JSON.stringify(expected));no(null);no({});
 for(const section of ['command','binding','target']){const e=structuredClone(expected),obj=section==='target'?e.binding.target:e[section];obj.allowed=true;no(e);}
 const e=structuredClone(expected);Object.defineProperty(e,'binding',{get(){throw Error('PRIVATE');}});no(e);
});
await check('copied/JSON/fake result, token, boolean, hash and another result cannot mint MATCH',()=>{
 for(const fake of [structuredClone(r),JSON.parse(bytes.toString()),{...r,joint_seal:joint},joint,{},true,null,bytes.toString(),expected.binding.command_hash])no(expected,fake);
});
await check('exact byte sequence required; forged hash/text/empty/extra byte all rejected',()=>{
 for(const bad of [Buffer.from(bytes.toString()+' '),Buffer.from('{}'),new Uint8Array(),Buffer.from(joint.response_sha256),bytes.toString(),null])no(expected,r,bad);
 const changed=Buffer.from(bytes);changed[0]^=1;no(expected,r,changed);
});
await check('strict scalar types: bool, float, null, strings never replace integer identity/version',()=>{
 for(const field of ['attempt','backend_pid','authority_revision'])for(const v of [true,1.5,null,'1',0,-1]){const e=structuredClone(expected);e.binding[field]=v;no(e);}
});
await check('matcher itself dispatches ZERO queries, attempts, writes, or record changes',()=>{
 assert.equal(x.f.trace.length,trace);assert.equal(x.f.attempts,attempts);assert.deepEqual(x.f.writes,beforeWrites);
 assert.equal(core.coreHostJointReplaySealV1(r),joint);assert.equal(matcher(r,bytes,expected).match,'MATCH');
});
await check('actual UNKNOWN settlement cannot match even with valid historical expectation',async()=>{
 const y=await setup();y.f.beforeQuery=async q=>{if(q==='rollback')throw Object.assign(Error('controlled ACK loss'),{code:'08006'});};
 const unknown=await y.f.host.executeReplayOnly(y.cmd,provider(y.guide));assert.equal(core.coreHostTerminalLifecycleV1(unknown).settlement,'unknown');
 no(expected,unknown,Buffer.from(JSON.stringify(unknown)));
});
await check('different actual host invocation cannot use the earlier attempt/DBtx expectation',async()=>{
 const again=await x.f.host.executeReplayOnly(x.cmd,provider(x.guide));assert.equal(again.status,'exact_replay');
 assert.notEqual(core.coreHostJointReplaySealV1(again).database_transaction_id,joint.database_transaction_id);
 no(expected,again,Buffer.from(JSON.stringify(again)));assert.deepEqual(x.f.writes,beforeWrites);
});
await check('Core13 full source recovered byte-for-byte by removing ONLY additive matcher; inventory seal matches',()=>{
 const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
 const path='src/lib/core/postgres-transaction-host-v1.ts',now=readFileSync(resolve(root,path),'utf8');
 const start=now.indexOf('\n/** Read-only, historical comparison against the actual closed Core13 record.');
 const end=now.indexOf('\nfunction entitlementBindingsMatch(',start);
 assert.ok(start>0&&end>start);assert.equal(now.slice(0,start)+now.slice(end),execFileSync('git',['show',`1971770a7ee92c2020387c5222b0c7da03a552d8:${path}`],{cwd:root,encoding:'utf8'}));
 const m=JSON.parse(readFileSync(resolve(root,'docs/contracts/core-ce012-closed-binding-matcher-v1/manifest.json'),'utf8'));
 const digest=b=>createHash('sha256').update(b).digest('hex');
 for(const item of m.inventory){const bytes=readFileSync(resolve(root,item.path));assert.equal(bytes.length,item.bytes);assert.equal(digest(bytes),item.sha256);}
 assert.equal(digest(JSON.stringify(m.inventory)),m.inventory_seal_sha256);
 for(const pin of m.pins){const bytes=execFileSync('git',['show',`${pin.commit}:${pin.path}`],{cwd:root});assert.equal(bytes.length,pin.bytes);assert.equal(digest(bytes),pin.sha256);assert.equal(execFileSync('git',['hash-object','--stdin'],{input:bytes,encoding:'utf8'}).trim(),pin.git_blob);}
});
console.log(JSON.stringify({task:'CORE-CE012-CLOSED-BINDING-MATCHER-14',controls:n,status:'PASS_CONTROLLED_TRANSPORT_ONLY',runtime:null,slots:'BLOCKED',native:'NOT_RUN'}));
