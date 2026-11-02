/** Synthetic same-scope transport, NOT PostgreSQL/Auth or a CE save writer. */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const proveExpiry=process.argv.includes('--prove-expiry-predecessor');
const expiryOnly=proveExpiry||process.argv.includes('--expiry-only');
const require=createRequire(import.meta.url),cache=new Map();
function load(file){
 const path=resolve(root,extname(file)?file:`${file}.ts`);if(cache.has(path))return cache.get(path).exports;
 const loaded={exports:{}};cache.set(path,loaded);
 const sourceText=proveExpiry&&path===resolve(root,'src/lib/core/ce012-stored-relation-v1.ts')?execFileSync('git',['show','ddd96badd5eda0993ec19a609292b3bdbe3b1c02:src/lib/core/ce012-stored-relation-v1.ts'],{cwd:root,encoding:'utf8'}):readFileSync(path,'utf8');
 const source=ts.transpileModule(sourceText,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
 const local=name=>name.startsWith('.')?load(resolve(dirname(path),name)):name.startsWith('@/')?load(resolve(root,'src',name.slice(2))):require(name);
 new Function('require','module','exports',source)(local,loaded,loaded.exports);return loaded.exports;
}
globalThis.fetch=async()=>{throw Error('OUTBOUND_FORBIDDEN');};
const {readCoreCe012StoredRelationV1:read,CORE_CE012_STORED_RELATION_V1:contract,CORE_CE012_STORED_RELATION_SQL:sql,CORE_CE012_STORED_EXPIRY_SQL:expirySql,coreCe012StoredRelationRequestV1Schema:requestSchema,CORE_CE012_STORED_RELATION_RUNTIME_BINDING:runtime}=load('src/lib/core/ce012-stored-relation-v1.ts');
const {coreTransactionReceiptV2Schema}=load('src/lib/core/postgres-transaction-host-v1.ts');
const {fingerprintCe012GuideSavePayload:fingerprint}=load('src/lib/community/experience-guide-command-contract.ts');
const {coreTransactionReplayReceiptHashV1:receiptHash}=load('src/lib/core/transaction-replay-provider-hook-v1.ts');
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ids={actor:id(1),tenant:id(2),workspace:id(3),context:id(4),guide:id(5),tx:id(6),command:id(7),doc:id(8),version:id(9),receipt:id(10),ceReceipt:id(11),decision:id(12)};
function fixture(){
 const guide={contract:'ce012-guide-command.v1',version:1,command_id:ids.command,action:'save_draft',context_id:ids.context,workspace_id:ids.workspace,guide_id:ids.guide,expected_guide_version:2,payload:{title:'Synthetic Guide',step_id:id(13),step_title:'Synthetic step',instructions:'Controlled fixture only',document_target:{document_id:ids.doc,document_version_id:ids.version,document_version:3,label:'Synthetic target'}},payload_fingerprint:'',idempotency_key:'ce012-stored-relation-test-01'};guide.payload_fingerprint=fingerprint(guide);
 const command={contract_version:'core-transaction-command.v2',transaction_id:ids.tx,command_id:ids.command,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,authority_version:9,permission_code:'experience.guide.manage',module_code:'experience_guides',evaluation_purpose:'experience.guide.command',aggregate_type:'experience_guide',aggregate_id:ids.guide,aggregate_version:3,provider_source_ids:[ids.guide,ids.doc,ids.version],idempotency_key:guide.idempotency_key,input_fingerprint:guide.payload_fingerprint,subject_reference:{kind:'experience.guide',id:ids.guide,version:2,relation:'save_draft',request_version:1}};
 const authority={contract_version:'core-current-authority-decision-receipt.v1',receipt_version:1,decision_id:ids.decision,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,authority_version:9,permission_code:command.permission_code,module_code:command.module_code,evaluation_purpose:command.evaluation_purpose,transaction_context:{transaction_id:ids.tx,command_id:ids.command,attempt:1,isolation_level:'serializable',lock:{kind:'command_aggregate',workspace_id:ids.workspace,aggregate_type:'experience_guide',aggregate_id:ids.guide,acquired_at:'2026-11-02T12:00:00Z'}},evaluator:'app_private.check_workspace_native_permission_v2',source_disclosure:'status_only',source_reference:null,evaluated_at:'2026-11-02T12:00:01Z',rechecked_after_lock:true,transaction_bound:true,reusable_as_command_authority:false,current_authority_recheck_required_on_retry:true,decision:'allowed',denial_reason:null};
 const receipt=coreTransactionReceiptV2Schema.parse({contract_version:'core-transaction-receipt.v2',receipt_version:2,receipt_id:ids.receipt,transaction_id:ids.tx,command_id:ids.command,workspace_id:ids.workspace,actor_id:ids.actor,aggregate_type:'experience_guide',aggregate_id:ids.guide,aggregate_version:3,input_fingerprint:guide.payload_fingerprint,idempotency_key:guide.idempotency_key,authority,mutation_id:id(14),audit_event_id:'17',outbox_event_id:id(15),committed_at:'2026-11-02T12:00:03Z',subject_reference:command.subject_reference,provider_evidence:{contract_version:'core-transaction-provider-evidence.v1',evidence_id:id(16),provider_code:'ce012.synthetic.transport',transaction_id:ids.tx,command_id:ids.command,workspace_id:ids.workspace,actor_id:ids.actor,context_id:ids.context,authority_decision_id:ids.decision,authority_version:9,attempt:1,subject_reference:command.subject_reference,evaluated_at:'2026-11-02T12:00:02Z',source_disclosure:'status_only',source_reference:null,decision:'accepted',denial_reason:null,reference_state:'available',current_actor_can_read:true}});
 // Fixture schema represents only the existing Core row shape, not an installed
 // provider/writer. There is deliberately NO synthetic persisted CE relation.
 const value=requestSchema.parse({contract,command,guide_command:guide,expected:{core_receipt_id:ids.receipt,core_receipt_hash:receiptHash(receipt),ce_save_receipt_id:ids.ceReceipt,receipt_hash_contract:'core-transaction-replay-provider-receipt.v1'}});
 const row={tenant_id:ids.tenant,actor_id:ids.actor,key:`core-tx.v1:${ids.workspace}:${guide.idempotency_key}`,request_hash:createHash('sha256').update(JSON.stringify(value.command)).digest('hex'),response_ref:receipt,expires_at:'2026-11-02T12:00:05.000000Z',database_transaction_id:'77',observed_actor_id:ids.actor,isolation:'serializable'};
 const calls=[];const state={rows:[row],rowCount:1,serverNow:'2026-11-02T12:00:04.000000Z'};
 const scope={transaction_id:ids.tx,database_transaction_id:'77',tenant_id:ids.tenant,workspace_id:ids.workspace,actor_id:ids.actor,attempt:1,async query(text,params){calls.push({text,params});assert.match(text,/^select\b/i);assert.doesNotMatch(text,/\b(insert|update|delete|begin|commit|rollback)\b/i);
  if(text===sql){assert.deepEqual(params,[ids.tenant,`core-tx.v1:${ids.workspace}:${guide.idempotency_key}`]);return structuredClone({rows:state.rows,rowCount:state.rowCount});}
  assert.equal(text,expirySql);assert.deepEqual(params,[row.expires_at]);return{rows:[{unexpired:params[0]>state.serverNow,database_transaction_id:'77',observed_actor_id:ids.actor,isolation:'serializable'}],rowCount:1};}};
 return {value,row,scope,calls,state};
}
let n=0;async function check(name,fn){if(expiryOnly&&!name.startsWith('expiry:'))return;if(proveExpiry&&name!=='expiry: lock wait crosses expiry')return;await fn();n++;console.log(`PASS ${name}`);}
function stopped(result){assert.equal(result.status,'not_ready');assert.equal(result.stored_ce_relation,null);assert.equal(result.action_authorization,'not_evaluated');assert.equal(Object.hasOwn(result,'receipt'),false);}
await check('controlled canonical Core row matched; full CE relation stays NOT_READY',async()=>{const x=fixture();const result=await read(x.scope,x.value);stopped(result);assert.equal(result.core_status,'matched');assert.equal(result.code,'CE_SAVE_WRITER_BRIDGE_MISSING');assert.equal(x.calls.length,2);assert.equal(runtime,null);});
for(const [name,mutate] of [
 ['body coherent re-fingerprint',x=>{x.value.guide_command.payload.instructions+=' changed';const h=fingerprint(x.value.guide_command);x.value.guide_command.payload_fingerprint=h;x.value.command.input_fingerprint=h;}],
 ['key',x=>{x.row.key+='x';}],['request hash',x=>{x.row.request_hash='0'.repeat(64);}],
 ['row actor',x=>{x.row.actor_id=id(80);}],['session actor',x=>{x.row.observed_actor_id=id(80);}],
 ['row tenant',x=>{x.row.tenant_id=id(80);}],['row transaction',x=>{x.row.database_transaction_id='78';}],
 ['scope Workspace',x=>{x.scope.workspace_id=id(80);}],['scope actor',x=>{x.scope.actor_id=id(80);}],
 ['command Context',x=>{x.value.command.context_id=id(80);}],
 ['immutable target coherent re-fingerprint',x=>{x.value.guide_command.payload.document_target.document_version=4;const h=fingerprint(x.value.guide_command);x.value.guide_command.payload_fingerprint=h;x.value.command.input_fingerprint=h;}],
 ['immutable target outside lock set',x=>{x.value.guide_command.payload.document_target.document_version_id=id(80);const h=fingerprint(x.value.guide_command);x.value.guide_command.payload_fingerprint=h;x.value.command.input_fingerprint=h;}],
 ['expected receipt hash',x=>{x.value.expected.core_receipt_hash='0'.repeat(64);}],
 ['expected receipt ID',x=>{x.value.expected.core_receipt_id=id(80);}],
 ['subject',x=>{x.value.command.subject_reference.version=1;}],
 ['stored receipt command ID',x=>{x.row.response_ref.command_id=id(80);}],
 ['stored receipt Workspace',x=>{x.row.response_ref.workspace_id=id(80);}],
 ['malformed receipt',x=>{x.row.response_ref={committed:true};}],
 ['malformed source',x=>{x.row.expires_at=null;}],
 ['missing bridge attempted callback',x=>{x.value.canVerify=()=>true;}],
 ['committed flag',x=>{x.value.committed=true;}],
])await check(`reject ${name}`,async()=>{const x=fixture();mutate(x);const result=await read(x.scope,x.value);stopped(result);assert.notEqual(result.core_status,'matched');});
await check('expired ledger row is not a usable matched receipt',async()=>{const x=fixture();x.row.expires_at='2026-11-02T12:00:03.000000Z';const r=await read(x.scope,x.value);stopped(r);assert.equal(r.core_status,'expired');});
await check('missing row despite valid receipt JSON is not persistence',async()=>{const x=fixture();x.state.rows=[];x.state.rowCount=0;const r=await read(x.scope,x.value);stopped(r);assert.equal(r.core_status,'missing');});
await check('ambiguous rows fail closed',async()=>{const x=fixture();x.state.rows.push(structuredClone(x.row));x.state.rowCount=2;const r=await read(x.scope,x.value);stopped(r);assert.equal(r.core_status,'unavailable');});
await check('scope mutation after read is rejected',async()=>{const x=fixture();const query=x.scope.query.bind(x.scope);x.scope.query=async(...args)=>{const r=await query(...args);x.scope.tenant_id=id(80);return r;};const r=await read(x.scope,x.value);stopped(r);assert.equal(r.core_status,'mismatch');});
await check('same 40001 escapes unchanged without retry or DML',async()=>{const x=fixture();const driver=Object.assign(Error('controlled serialization'),{code:'40001'});let calls=0;x.scope.query=async text=>{assert.equal(text,sql);calls++;throw driver;};await assert.rejects(read(x.scope,x.value),error=>error===driver);assert.equal(calls,1);});
await check('ordinary source error redacts details',async()=>{const x=fixture();x.scope.query=async()=>{throw Object.assign(Error('PRIVATE_DIAGNOSTIC'),{code:'42501'});};const r=await read(x.scope,x.value);stopped(r);assert.equal(r.core_status,'unavailable');assert.doesNotMatch(JSON.stringify(r),/PRIVATE|42501/);});
await check('mutation_id equality cannot create a CE relation',async()=>{const x=fixture();x.value.expected.ce_save_receipt_id=x.row.response_ref.mutation_id;const r=await read(x.scope,x.value);stopped(r);assert.equal(r.core_status,'matched');assert.equal(r.code,'CE_SAVE_WRITER_BRIDGE_MISSING');});
await check('input key order uses existing parsed host command hash',async()=>{const x=fixture();x.value.command=Object.fromEntries(Object.entries(x.value.command).reverse());const r=await read(x.scope,x.value);stopped(r);assert.equal(r.core_status,'matched');});
function expiryFixture(){
 const x=fixture();x.row.expires_at='2026-11-02T12:00:05.000000Z';
 if(!proveExpiry)delete x.row.unexpired;
 x.state.expiryPatch={};x.state.expiryCount=1;
 x.scope.query=async(text,params)=>{
  x.calls.push({text,params});assert.match(text,/^select\b/i);assert.doesNotMatch(text,/\b(insert|update|delete|begin|commit|rollback)\b/i);
  if(text===sql){
   assert.deepEqual(params,[ids.tenant,`core-tx.v1:${ids.workspace}:${x.value.guide_command.idempotency_key}`]);
   // Model the projection before the lock can wait, as the original query allows.
   const projected=structuredClone({rows:x.state.rows,rowCount:x.state.rowCount});
   if(proveExpiry)for(const row of projected.rows){delete row.expires_at;row.unexpired=x.row.expires_at>x.state.serverNow;}
   x.state.lockRequested?.();if(x.state.lockBarrier)await x.state.lockBarrier;
   x.state.lockReturned=true;return projected;
  }
  assert.equal(text,expirySql);assert.equal(x.state.lockReturned,true,'fresh query cannot begin before lock result returns');
  assert.deepEqual(params,[x.row.expires_at]);
  // Exact UTC strings have identical precision in this synthetic server model.
  const r={unexpired:params[0]>x.state.serverNow,database_transaction_id:'77',observed_actor_id:ids.actor,isolation:'serializable',...x.state.expiryPatch};
  x.state.expiryReturned=true;return{rows:x.state.expiryCount===0?[]:Array.from({length:x.state.expiryCount},()=>r),rowCount:x.state.expiryCount};
 };
 return x;
}
await check('expiry: SQL source separates lock from fresh scalar clock',async()=>{
 assert.match(sql,/for share\s*$/i);assert.doesNotMatch(sql,/clock_timestamp|\bas unexpired\b/i);
 assert.match(sql,/to_char\(expires_at at time zone 'UTC'/);
 assert.match(expirySql,/with observed as materialized/);assert.match(expirySql,/\$1::timestamptz>clock_timestamp\(\)/);
 assert.doesNotMatch(expirySql,/from platform\.|for (share|update)/i);
 const source=readFileSync(resolve(root,'src/lib/core/ce012-stored-relation-v1.ts'),'utf8');
 const fresh=source.indexOf('const fresh=await scope.query(CORE_CE012_STORED_EXPIRY_SQL,[r.expires_at]);');assert.ok(fresh>0);
 assert.doesNotMatch(source.slice(fresh+'const fresh=await scope.query(CORE_CE012_STORED_EXPIRY_SQL,[r.expires_at]);'.length),/\bawait\b|scope\.query|Date\.now/);
});
await check('expiry: lock wait crosses expiry',async()=>{
 const x=expiryFixture();let acquired,release;
 const requested=new Promise(resolve=>{acquired=resolve;});x.state.lockRequested=acquired;
 x.state.lockBarrier=new Promise(resolve=>{release=resolve;});
 const pending=read(x.scope,x.value);await requested;
 assert.equal(x.calls.length,1);assert.equal(x.state.expiryReturned,undefined);
 x.state.serverNow='2026-11-02T12:00:06.000000Z';release();
 const result=await pending;stopped(result);
 if(proveExpiry){assert.equal(result.core_status,'matched');assert.equal(x.calls.length,1);console.log('COUNTEREXAMPLE exact Base: pre-lock true survives awaited expiry; stale matched');}
 else{assert.equal(result.core_status,'expired');assert.deepEqual(x.calls.map(c=>c.text),[sql,expirySql]);}
});
await check('expiry: positive post-lock observation',async()=>{const x=expiryFixture();const r=await read(x.scope,x.value);stopped(r);assert.equal(r.core_status,'matched');assert.deepEqual(x.calls.map(c=>c.text),[sql,expirySql]);});
await check('expiry: equality boundary rejects',async()=>{const x=expiryFixture();x.state.serverNow=x.row.expires_at;const r=await read(x.scope,x.value);stopped(r);assert.equal(r.core_status,'expired');});
await check('expiry: final microsecond before expiry remains matched',async()=>{const x=expiryFixture();x.state.serverNow='2026-11-02T12:00:04.999999Z';const r=await read(x.scope,x.value);stopped(r);assert.equal(r.core_status,'matched');});
for(const boundary of ['lock','fresh'])await check(`expiry: scope drift after ${boundary}`,async()=>{
 const x=expiryFixture();const query=x.scope.query.bind(x.scope);
 x.scope.query=async(...args)=>{const r=await query(...args);if(args[0]===(boundary==='lock'?sql:expirySql))x.scope.workspace_id=id(80);return r;};
 const r=await read(x.scope,x.value);stopped(r);assert.equal(r.core_status,'mismatch');assert.equal(x.calls.length,boundary==='lock'?1:2);
});
for(const change of [{database_transaction_id:'78'},{observed_actor_id:id(80)},{isolation:'read committed'}])await check(`expiry: fresh binding rejects ${Object.keys(change)[0]}`,async()=>{const x=expiryFixture();x.state.expiryPatch=change;const r=await read(x.scope,x.value);stopped(r);assert.notEqual(r.core_status,'matched');});
for(const boundary of ['lock','fresh'])await check(`expiry: original 40001 at ${boundary}`,async()=>{
 const x=expiryFixture();const query=x.scope.query.bind(x.scope);const driver=Object.assign(Error('synthetic serialization'),{code:'40001'});let faults=0;
 x.scope.query=async(...args)=>{if(args[0]===(boundary==='lock'?sql:expirySql)){faults++;throw driver;}return query(...args);};
 await assert.rejects(read(x.scope,x.value),error=>error===driver);assert.equal(faults,1);
});
for(const count of [0,2])await check(`expiry: fresh cardinality ${count} is unavailable`,async()=>{const x=expiryFixture();x.state.expiryCount=count;const r=await read(x.scope,x.value);stopped(r);assert.equal(r.core_status,'unavailable');});
await check('expiry: malformed fresh observation is unavailable',async()=>{const x=expiryFixture();x.state.expiryPatch={unexpired:null};const r=await read(x.scope,x.value);stopped(r);assert.equal(r.core_status,'unavailable');});
console.log(JSON.stringify({task:expiryOnly?'CORE-CE012-STORED-EXPIRY-06':'CORE-CE012-STORED-RELATION-05',result:'PASS',checks:n,transport:'synthetic memory; no database or writer',relation:'NOT_READY',runtime_binding:runtime,dml:0}));
