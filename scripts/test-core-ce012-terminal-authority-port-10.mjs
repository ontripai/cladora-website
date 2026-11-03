/** New Core10 couplings only. Reuse Core09 fixture definitions, NEVER its tests. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const original=new URL('./test-core-ce012-writer-joint-review-09.mjs',import.meta.url);
const text=readFileSync(original,'utf8');
const prefix=text.slice(text.indexOf('const root='),text.indexOf('const findings='))
 .replaceAll('fileURLToPath(import.meta.url)','providedFilename').replaceAll('createRequire(import.meta.url)','providedRequire');
assert.ok(prefix.includes('function fixture()')&&!prefix.includes("await check("));
const {load,fixture,command,request,id,ids}=new Function('resolve','dirname','extname','readFileSync','execFileSync','ts','assert','providedFilename','providedRequire',prefix+'\nreturn {load,fixture,command,request,id,ids};')
 (resolve,dirname,extname,readFileSync,execFileSync,ts,assert,fileURLToPath(original),createRequire(original));
const core=load('src/lib/core/postgres-transaction-host-v1.ts');
const writer=load('src/lib/community/experience-guide-save-writer-v1.ts');
const docs=load('src/lib/customer/documents-ce012-reference-provider-v1.ts');
const {coreTransactionReplayReceiptHashV1:receiptHash}=load('src/lib/core/transaction-replay-provider-hook-v1.ts');
const {createCoreCe012TerminalAuthorityPortV1:create,CORE_CE012_TERMINAL_SQL:SQL,CORE_CE012_TERMINAL_RUNTIME_BINDING}=load('src/lib/core/ce012-terminal-authority-port-v1.ts');
assert.equal(CORE_CE012_TERMINAL_RUNTIME_BINDING,null);
const norm=q=>q.replace(/\s+/g,' ').trim();
const result=rows=>({rows,rowCount:rows.length});
async function saved(unknown=false){
 const f=fixture(),{guide,cmd}=command();if(unknown)f.lostCommit=true;const outcome=await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs));
 assert.equal(outcome.status,unknown?'unknown_commit':'committed');const key=`core-tx.v1:${cmd.workspace_id}:${cmd.idempotency_key}`,x={f,guide,cmd,receipt:unknown?f.ledgers.get(key).response_ref:outcome.receipt,key,initialOutcome:outcome};
 f.sessionCurrent=true;f.ceAllowed=true;f.docsAllowed=true;f.aal='aal2';f.epoch='1';
 const connect=f.pool.connect.bind(f.pool);
 f.pool.connect=async()=>{const client=await connect(),query=client.query.bind(client);client.query=async(text,v=[])=>{
  if(f.fault===text)throw f.error;
  if(text===SQL.session){f.trace.push({text,q:norm(text),v:[]});if(f.initialSessionDenied)throw Object.assign(Error('PRIVATE_SESSION_DETAIL'),{code:'42501'});return result([{session_guard:''}]);}
  if(text===SQL.lock||text===SQL.clock||text===SQL.final){
   f.trace.push({text,q:norm(text),v:structuredClone(v)});
   if(text===SQL.lock){if(f.onLock)await f.onLock();return result([{context_id:ids.context,actor_id:ids.actor,tenant_id:ids.tenant,membership_id:ids.member,workspace_id:ids.workspace}]);}
   if(text===SQL.clock)return result([{database_transaction_id:String(100+f.attempts),actor_id:ids.actor,isolation:'serializable',backend_pid:80,evaluated_at:f.now}]);
   if(f.onFinal)await f.onFinal();
   if(!f.sessionCurrent)throw Object.assign(Error('PRIVATE_SESSION_DETAIL'),{code:'42501',detail:'PRIVATE_SESSION_ID'});
   const row={database_transaction_id:String(100+f.attempts),actor_id:ids.actor,isolation:'serializable',backend_pid:80,evaluated_at:f.now,
    tenant_id:ids.tenant,workspace_id:ids.workspace,membership_id:ids.member,authority_revision:f.epoch,
    ce_allowed:f.ceAllowed,docs_allowed:f.docsAllowed,aal:f.aal,session_guard:'',unexpired:f.expiry>f.now,
    ce_module_id:id(40),ce_entitlement_key:'module.experience_guides',docs_module_id:id(41),docs_entitlement_key:'module.documents'};
   if(f.changeFinal)f.changeFinal(row);return result([row]);
  }
  if(norm(text).includes('from platform.module_definitions')){
   if(f.faultModules)throw f.error;
   const isDocs=v[3]==='documents';return result([{allowed:!f.expired,evaluated_at:f.now,module_definition_id:id(isDocs?41:40),entitlement_key:isDocs?'module.documents':'module.experience_guides'}]);
  }
  return query(text,v);
 };return client;};
 f.host=core.createCorePostgresTransactionHostV1(f.pool);return x;
}
async function run(x,fn,value=request(x)){
 const before=structuredClone(x.f.writes),p=writer.createCe012SaveWriterProviderV1(x.guide,docs);let port,couplingError;
 const outcome=await x.f.host.execute(x.cmd,{...p,async validateReplay(scope,c,a,r){
  port=create(scope,value);try{try{await fn(port,scope,()=>p.validateReplay(port.scope,c,a,r));}catch(error){couplingError=error;throw error;}return await p.validateReplay(port.scope,c,a,r);}finally{port.close();}
 }});if(couplingError&&!['40001','42501','57014','08006'].includes(couplingError.code))throw couplingError;assert.deepEqual(x.f.writes,before);return{outcome,port};
}
function closed(r,status){assert.equal(r.status,'not_ready');assert.equal(r.core_status,status);assert.equal(r.documents_projection,null);assert.equal(r.action_authorization,'not_evaluated');if(status!=='observed')assert.equal(r.observation,null);assert.doesNotMatch(JSON.stringify(r),/PRIVATE_|safe_label|ce_receipt_id/);}
let n=0;async function check(name,fn){await fn();console.log(`PASS ${++n} ${name}`);}
await check('actual Core provider/binder + CE/Docs scope coupling yields only opaque non-disclosing observation',async()=>{
 const x=await saved();let token;
 const r=await run(x,async(port,scope)=>{const o=await port.checkpoint();closed(o,'observed');token=o.observation;const s=port.inspect(token);assert.equal(s.status,'core_observed_not_ready');assert.equal(s.binding.ce_receipt_id,x.f.ces.get(x.key).ce_receipt.receipt_id);assert.equal(s.binding.core_receipt_id,x.receipt.receipt_id);assert.equal(s.binding.mutation_id,x.receipt.mutation_id);assert.equal(new Set([s.binding.ce_receipt_id,s.binding.core_receipt_id,s.binding.mutation_id]).size,3);assert.equal(s.binding.command_hash,x.f.ces.get(x.key).command_hash);assert.equal(s.binding.core_receipt_hash,receiptHash(x.receipt));assert.deepEqual(s.binding.target,{document_id:ids.doc,document_version_id:ids.docVersion,document_version:3});assert.equal(s.binding.attempt,scope.attempt);assert.equal(s.binding.database_transaction_id,String(100+x.f.attempts));assert.equal(s.settlement,'not_observed');});
 assert.equal(r.outcome.status,'exact_replay',JSON.stringify(r.outcome));assert.equal(r.port.inspect(token).status,'invalidated');
});
await check('post-checkpoint actual Documents wait invalidates premise; explicit renewed checkpoint only observes Core subset',async()=>{
 const x=await saved();await run(x,async(port,scope,readDocs)=>{const o=await port.checkpoint();closed(o,'observed');let entered,release;x.f.onDocumentWait=async()=>{entered?.();await new Promise(r=>{release=r;});};const arrived=new Promise(r=>{entered=r;});const wait=readDocs();await arrived;assert.equal(port.inspect(o.observation).status,'invalidated');closed(await port.checkpoint(),'unavailable');release();await wait;x.f.onDocumentWait=null;closed(await port.checkpoint(),'observed');});
});
for(const [name,change,expected] of [
 ['session revoked during final wait',f=>{f.sessionCurrent=false;},'denied'],
 ['CE authority revoked during final wait',f=>{f.ceAllowed=false;},'denied'],
 ['Documents module/entitlement denial at final wait',f=>{f.docsAllowed=false;},'denied'],
 ['expiry crosses final wait at microsecond precision',f=>{f.now='2999-01-01T00:00:00.000001Z';},'expired'],
 ['expiry equality is excluded',f=>{f.now=f.expiry;},'expired'],
 ['before expiry by one microsecond',f=>{f.now='2998-12-31T23:59:59.999999Z';},'observed'],
])await check(name,async()=>{const x=await saved();x.f.onFinal=async()=>{await Promise.resolve();change(x.f);};await run(x,async port=>closed(await port.checkpoint(),expected));});
for(const [name,mutate] of [
 ['actor',r=>{r.actor_id=id(88);}],['tenant',r=>{r.tenant_id=id(88);}],['Workspace',r=>{r.workspace_id=id(88);}],
 ['membership',r=>{r.membership_id=id(88);}],['DB transaction',r=>{r.database_transaction_id='999';}],['backend',r=>{r.backend_pid=81;}],
 ['revision',r=>{r.authority_revision='2';}],['CE entitlement binding',r=>{r.ce_entitlement_key='wrong';}],['Docs module binding',r=>{r.docs_module_id=id(88);}],
])await check(`final ${name} drift cannot produce observation`,async()=>{const x=await saved();x.f.changeFinal=mutate;await run(x,async port=>closed(await port.checkpoint(),'mismatch'));});
for(const [name,mutate] of [['invalid AAL',r=>{r.aal='aal0';}],['ambiguous clock',r=>{r.evaluated_at='2026-11-02 17:00:00+00';}],['missing session sentinel',r=>{delete r.session_guard;}]])await check(name,async()=>{const x=await saved();x.f.changeFinal=mutate;await run(x,async port=>closed(await port.checkpoint(),'unavailable'));});
await check('caller allow/time/callback cannot enter strict request ABI',async()=>{const x=await saved(),v={...request(x),allowed:true,now:'2998-01-01T00:00:00.000000Z',verify:()=>true};await run(x,async port=>closed(await port.checkpoint(),'mismatch'),v);});
await check('wrong expected receipt and target/key/body mismatches cannot mint observation',async()=>{for(const change of [v=>{v.expected.ce_save_receipt_id=id(88);},v=>{v.command.idempotency_key+='x';},v=>{v.guide_command.payload.instructions+='x';},v=>{v.guide_command.payload.document_target.document_version++;}]){const x=await saved(),v=structuredClone(request(x));change(v);await run(x,async port=>{const r=await port.checkpoint();assert.notEqual(r.core_status,'observed');assert.equal(r.observation,null);},v);}});
await check('observation cannot be forged, moved to another port, mutated or used after close',async()=>{const x=await saved();await run(x,async(port,scope)=>{const o=await port.checkpoint();closed(o,'observed');assert.ok(Object.isFrozen(o.observation));assert.equal(port.inspect({...o.observation}).status,'invalidated');const other=create(scope,request(x));assert.equal(other.inspect(o.observation).status,'invalidated');const s=port.inspect(o.observation);assert.ok(Object.isFrozen(s.binding)&&Object.isFrozen(s.binding.target));port.close();assert.equal(port.inspect(o.observation).status,'invalidated');closed(await port.checkpoint(),'mismatch');});});
await check('source-scope attempt/actor drift is detected after awaited query',async()=>{const x=await saved();await run(x,async(port,scope)=>{for(const field of ['attempt','actor_id']){const mutable={...scope,query:scope.query.bind(scope)},p=create(mutable,request(x));x.f.onLock=async()=>{mutable[field]=field==='attempt'?mutable.attempt+1:id(88);};closed(await p.checkpoint(),'mismatch');p.close();}x.f.onLock=null;});});
await check('same original40001 reaches existing host, three rollback attempts, zero extra writes/commit',async()=>{const x=await saved(),e=Object.assign(Error('serialization'),{code:'40001'});x.f.fault=SQL.final;x.f.error=e;const before=x.f.commits,rollbacks=x.f.rollbacks;let seen=0;const r=await run(x,async port=>{try{await port.checkpoint();assert.fail();}catch(actual){assert.equal(actual,e);seen++;throw actual;}});assert.equal(seen,3);assert.equal(x.f.rollbacks-rollbacks,3);assert.equal(x.f.commits,before);assert.equal(r.outcome.status,'denied');});
await check('timeout/cancellation and unknown faults are never source success, original error retained',async()=>{for(const code of ['57014','08006']){const x=await saved(),e=Object.assign(Error('driver fault'),{code});x.f.fault=SQL.final;x.f.error=e;await run(x,async port=>{await assert.rejects(port.checkpoint(),actual=>actual===e);await assert.rejects(port.checkpoint(),actual=>actual===e);});}});
await check('lost COMMIT ACK never promotes source observation to settled/disclosed',async()=>{const x=await saved(true);assert.equal(x.initialOutcome.status,'unknown_commit');let token;const r=await run(x,async port=>{const o=await port.checkpoint();closed(o,'observed');token=o.observation;});assert.equal(r.outcome.status,'exact_replay');assert.equal(r.port.inspect(token).status,'invalidated');});
await check('initial session denial stops before private relation reads',async()=>{const x=await saved();x.f.initialSessionDenied=true;await run(x,async port=>{const before=x.f.trace.length;closed(await port.checkpoint(),'denied');assert.equal(x.f.trace.slice(before).some(q=>q.text.includes('from experience.guide_save_receipts_v1')||q.text.includes('from platform.idempotency_keys')),false);});});
await check('40001 and cancellation masked by old nested readers/providers are unmasked by the tracked scope',async()=>{for(const fault of [load('src/lib/core/ce012-stored-relation-v1.ts').CORE_CE012_STORED_RELATION_SQL,SQL.clock]){const x=await saved(),e=Object.assign(Error('cancel'),{code:'57014'});x.f.fault=fault;x.f.error=e;await run(x,async port=>{await assert.rejects(port.checkpoint(),actual=>actual===e);});}});
await check('real provider normalization cannot hide original40001 or cancellation from Core10',async()=>{for(const code of ['40001','57014']){const x=await saved(),e=Object.assign(Error('provider driver error'),{code});let seen=0;await run(x,async port=>{x.f.faultModules=true;x.f.error=e;try{await assert.rejects(port.checkpoint(),actual=>{assert.equal(actual,e);seen++;return true;});}finally{x.f.faultModules=false;}});assert.equal(seen,code==='40001'?3:1);}});
await check('SQL contract uses server microsecond UTC, native session/evaluator and strict receipt expiry, no writes',async()=>{
 assert.match(SQL.final,/sampled as materialized \(select clock_timestamp\(\) as at\)/);assert.match(SQL.final,/require_request_session_current_at_v1\(s.at\)/);assert.match(SQL.final,/check_workspace_native_permission_v2_at_v1/);assert.match(SQL.final,/\(\$3::timestamptz>c.at\)/);
 for(const q of Object.values(SQL)){assert.match(q,/^select /);assert.doesNotMatch(q,/\b(insert|update|delete|set_config|pg_advisory|commit|rollback)\b/i);assert.ok(!q.includes(';'));}
 const source=readFileSync(new URL('../src/lib/core/ce012-terminal-authority-port-v1.ts',import.meta.url),'utf8');assert.doesNotMatch(source,/Date\.parse|Date\.now|new Date|setTimeout|createCore.*Host/);
});
console.log(JSON.stringify({task:'CORE-CE012-TERMINAL-AUTHORITY-PORT-10',new_checks:n,result:'PASS_CONTROLLED_TRANSPORT_ONLY',previous_suites:'NOT_RERUN',runtime_binding:null,terminal_joint_gate:'NOT_READY',historical_slots:'BLOCKED',native_sql_pg_auth:'NOT_RUN'}));
