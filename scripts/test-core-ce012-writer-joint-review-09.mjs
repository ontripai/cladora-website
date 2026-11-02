/** New cross-owner coupling only. No SQL parser, database, Auth or trigger runs. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const CE='d767e84a6d8489ee731f64eb5c8b38f29d35a7fe',DOCS='c0caf3e70d97c3d09b16cbff91188367804cba6b';
const selected=process.argv.includes('--case')?process.argv[process.argv.indexOf('--case')+1]:null;
const docsDeltaOnly=process.argv.includes('--docs-delta-only');
const require=createRequire(import.meta.url),cache=new Map();
function load(file){const path=resolve(root,extname(file)?file:`${file}.ts`);if(cache.has(path))return cache.get(path).exports;
 const rel=path.slice(root.length+1),ref=rel.startsWith('src/lib/community/')?CE:rel.startsWith('src/lib/customer/documents-')?DOCS:null;
 const source=ref?execFileSync('git',['show',`${ref}:${rel}`],{cwd:root,encoding:'utf8'}):readFileSync(path,'utf8');
 const loaded={exports:{}};cache.set(path,loaded);const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','module','exports',js)(name=>name.startsWith('.')?load(resolve(dirname(path),name)):require(name),loaded,loaded.exports);return loaded.exports;}
globalThis.fetch=async()=>{throw Error('OUTBOUND_FORBIDDEN');};
const writer=load('src/lib/community/experience-guide-save-writer-v1.ts');
const docs=load('src/lib/customer/documents-ce012-reference-provider-v1.ts');
const core=load('src/lib/core/postgres-transaction-host-v1.ts');
const ce=load('src/lib/community/experience-guide-command-contract.ts');
const {readCoreCe012CombinedRelationV1:combined,readCoreCe012CombinedDisclosureV2:disclosure,CORE_CE012_SAVE_RELATION_SQL:ceSql}=load('src/lib/core/ce012-combined-stored-relation-v1.ts');
const {CORE_CE012_STORED_RELATION_SQL:coreSql,CORE_CE012_STORED_EXPIRY_SQL:expirySql}=load('src/lib/core/ce012-stored-relation-v1.ts');
const {coreTransactionReplayReceiptHashV1:receiptHash}=load('src/lib/core/transaction-replay-provider-hook-v1.ts');
const id=n=>`20000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const ids={actor:id(1),tenant:id(2),workspace:id(3),context:id(4),guide:id(5),member:id(6),step:id(7),doc:id(8),docVersion:id(9)};
const normalize=q=>q.replace(/\s+/g,' ').trim();
function command(version=1,suffix=0){const guide={contract:'ce012-guide-command.v1',version:1,command_id:id(10+suffix),action:'save_draft',context_id:ids.context,workspace_id:ids.workspace,guide_id:ids.guide,expected_guide_version:version,payload:{title:'Synthetic arrival',step_id:ids.step,step_title:'Read',instructions:'Synthetic instructions',document_target:{document_id:ids.doc,document_version_id:ids.docVersion,document_version:3,label:'Caller label'}},payload_fingerprint:'',idempotency_key:`joint-review-${suffix}-0001`};guide.payload_fingerprint=ce.fingerprintCe012GuideSavePayload(guide);
 const cmd=core.coreTransactionCommandV2Schema.parse({contract_version:'core-transaction-command.v2',transaction_id:id(20+suffix),command_id:guide.command_id,context_id:ids.context,workspace_id:ids.workspace,actor_id:ids.actor,authority_version:1,permission_code:'experience.guide.manage',module_code:'experience_guides',evaluation_purpose:'experience.guide.command',aggregate_type:'experience_guide',aggregate_id:ids.guide,aggregate_version:version+1,provider_source_ids:[ids.guide,ids.doc,ids.docVersion],idempotency_key:guide.idempotency_key,input_fingerprint:guide.payload_fingerprint,subject_reference:{kind:'experience.guide',id:ids.guide,version,relation:'save_draft',request_version:1}});return{guide,cmd};}
function fixture(){
 const f={now:'2026-11-02T17:00:00.000000Z',expiry:'2999-01-01T00:00:00.000000Z',version:1,ledgers:new Map(),ces:new Map(),steps:new Set(),writes:[],trace:[],attempts:0,commits:0,rollbacks:0,expired:false,visibilityCount:0,documentVersion:3};
 const data=()=>structuredClone({version:f.version,ledgers:f.ledgers,ces:f.ces,steps:f.steps,writes:f.writes});
 const result=rows=>({rows,rowCount:rows.length});
 f.pool={async connect(){let saved,xid,settled=false;return{release(){},async query(text,v=[]){const q=normalize(text);f.trace.push({text,q,v:structuredClone(v)});
  if(q.startsWith('begin ')){f.attempts++;xid=String(100+f.attempts);saved=data();return result([]);}
  if(q==='rollback'){f.rollbacks++;if(saved&&!settled)Object.assign(f,saved);return result([]);}
  if(q==='commit'){if(f.deferredFailure)throw Object.assign(Error('modeled deferred abort'),{code:'23514'});settled=true;f.commits++;if(f.lostCommit){f.lostCommit=false;throw Error('modeled lost COMMIT ack');}return result([]);}
  if(q.startsWith('set ')||q.startsWith('select pg_advisory'))return result([]);
  if(f.faultSql===text)throw f.driver;
  if(text===coreSql){const row=f.ledgers.get(v[1]);return result(row?[{tenant_id:ids.tenant,actor_id:row.actor_id,key:v[1],request_hash:row.request_hash,response_ref:row.response_ref,expires_at:f.expiry,database_transaction_id:xid,observed_actor_id:ids.actor,isolation:'serializable'}]:[]);}
  if(text===expirySql)return result([{unexpired:v[0]>f.now,database_transaction_id:xid,observed_actor_id:ids.actor,isolation:'serializable'}]);
  if(text===ceSql){if(f.onCeWait)await f.onCeWait();const row=f.ces.get(v[2]);return result(row?[structuredClone(row)]:[]);}
  if(q===normalize(writer.CE012_SAVE_STORED_SQL)){const row=f.ces.get(v[2]);if(!row)return result([]);const projected={...structuredClone(row)};delete projected.tenant_id;delete projected.workspace_id;return result([projected]);}
  if(q===normalize(writer.CE012_SAVE_LEDGER_SQL)){const row=f.ledgers.get(v[1]);return result(row?[{response_ref:row.response_ref,request_hash:row.request_hash,actor_id:row.actor_id}]:[]);}
  if(q.includes('from platform.customer_workspaces'))return result([{tenant_id:ids.tenant}]);
  if(q.startsWith('select txid_current()::text as id,'))return result([{id:xid,now:f.now}]);
  if(q.startsWith('select txid_current()::text as transaction_id, auth.uid()'))return result([{transaction_id:xid,actor_id:ids.actor,isolation:'serializable',evaluated_at:f.now}]);
  if(q==='select auth.uid()::text as actor_id')return result([{actor_id:ids.actor}]);
  if(q.includes('canonical_authority_revision_v1'))return result([{revision:'1'}]);
  if(q.includes('m.user_id::text as actor_id'))return result([{tenant_id:ids.tenant,actor_id:ids.actor,status:'active',current:!f.expired}]);
  if(q.includes('from platform.module_definitions'))return result([{allowed:!f.expired,evaluated_at:f.now,module_definition_id:id(40),entitlement_key:v[3]==='documents'?'module.documents':'module.experience_guides'}]);
  if(q.startsWith('select auth.uid()=$1'))return result([{actor_bound:true,allowed:!f.expired}]);
  if(q.includes('select m.id::text'))return result([{id:ids.member}]);
  if(q.startsWith('select version,status::text from experience.guides'))return result([{version:f.version,status:'draft'}]);
  if(q.includes('from platform.idempotency_keys')&&q.includes('for update')){const row=f.ledgers.get(v[1]);return result(row?[{...row,expires_at:new Date(f.expiry)}]:[]);}
  if(q.includes("auth.jwt()->>'aal'"))return result([{transaction_id:xid,isolation:'serializable',actor_bound:true,aal2:true}]);
  if(q.includes('from documents.documents d where d.id=')){if(f.onDocumentWait)await f.onDocumentWait();return result([{current_version:f.documentVersion,active:true}]);}
  if(q.includes('select v.version,v.scanning_status'))return result([{version:3,scanning_status:'clean',checksum_status:'verified'}]);
  if(q.includes('select p.id from documents.document_permissions'))return result([]);
  if(q.includes('as allowed')&&q.includes('from documents.documents')){f.visibilityCount++;return result([{allowed:!f.docsDenied}]);}
  if(q.includes('as clean'))return result([{clean:true}]);
  if(q==='select clock_timestamp()::text as now'){
   if(f.expireAfterDocs&&f.visibilityCount>=2&&!f.expired){f.docsRequested?.();if(f.docsBarrier)await f.docsBarrier;f.expired=true;f.now='2026-11-02T17:00:01.000000Z';f.trace.push({q:'MODEL_MEMBERSHIP_EXPIRED_AFTER_DOCS_WAIT'});}
   return result([{now:f.now}]);
  }
  if(q.startsWith('insert into platform.idempotency_keys')){f.ledgers.set(v[2],{actor_id:v[1],request_hash:v[3],response_ref:null});f.writes.push('c03');return result([]);}
  if(q.startsWith('update experience.guides')){if(f.version!==v[5])return result([]);f.version=v[4];f.writes.push('guide');return result([{id:ids.guide}]);}
  if(q.startsWith('insert into experience.guide_steps')){if(f.steps.has(v[0]))throw Object.assign(Error('modeled PK collision'),{code:'23505'});f.steps.add(v[0]);f.writes.push('step');return result([]);}
  if(q.startsWith('insert into experience.guide_references')){f.writes.push('target');return result([]);}
  if(q.startsWith('insert into experience.guide_save_receipts_v1')){const row={tenant_id:v[0],workspace_id:v[1],actor_id:v[2],membership_id:v[3],canonical_key:v[4],command_hash:v[5],command_json:JSON.parse(v[6]),guide_command:JSON.parse(v[7]),ce_receipt:JSON.parse(v[8]),mutation_id:v[9],database_transaction_id:v[10]};f.ces.set(v[4],row);f.writes.push('ce');return result([{ce_receipt:row.ce_receipt}]);}
  if(q.startsWith('insert into audit.events')){f.writes.push('audit');return result([{id:'1'}]);}
  if(q.startsWith('insert into platform.outbox_events')){f.writes.push('outbox');return result([{id:id(41)}]);}
  if(q.startsWith('update platform.idempotency_keys')){f.ledgers.get(v[1]).response_ref=JSON.parse(v[2]);return result([]);}
  throw Error('UNMODELED_SOURCE_QUERY');
 }};}};
 f.host=core.createCorePostgresTransactionHostV1(f.pool);return f;
}
async function saved(){const f=fixture(),{guide,cmd}=command();const outcome=await f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs));assert.equal(outcome.status,'committed');const receipt=outcome.receipt,key=`core-tx.v1:${cmd.workspace_id}:${cmd.idempotency_key}`;return{f,guide,cmd,receipt,key};}
const request=x=>({contract:'core-ce012-stored-relation.v1',command:x.cmd,guide_command:x.guide,expected:{core_receipt_id:x.receipt.receipt_id,core_receipt_hash:receiptHash(x.receipt),ce_save_receipt_id:x.f.ces.get(x.key).ce_receipt.receipt_id,receipt_hash_contract:'core-transaction-replay-provider-receipt.v1'}});
async function insideReplay(x,value=request(x),before){let result,scoped;const start=x.f.trace.length,writes=structuredClone(x.f.writes);const p=writer.createCe012SaveWriterProviderV1(x.guide,docs);
 const outcome=await x.f.host.execute(x.cmd,{...p,async validateReplay(scope,c,a,r){scoped=scope;if(before)await before(scope,r,a);result=await combined(scope,value);return p.validateReplay(scope,c,a,r);}});
 assert.deepEqual(x.f.writes,writes);return{outcome,result,scoped,trace:x.f.trace.slice(start)};}
const findings=new Set(),docsFindings=new Set();let n=0;async function check(name,fn){if(selected&&name!==selected)return;if(docsDeltaOnly&&!name.startsWith('D06:'))return;await fn();const d=/^D06: (C0[1-4])/.exec(name);if(d)docsFindings.add('D06-'+d[1]);if(name.startsWith('COUNTEREXAMPLE membership'))findings.add('CE-WR09-F01');if(name.startsWith('COUNTEREXAMPLE second'))findings.add('CE-WR09-F02');console.log(`PASS ${++n} ${name}`);}
function closed(r){assert.equal(r.status,'not_ready');assert.equal(r.stored_ce_relation,null);assert.equal(r.action_authorization,'not_evaluated');assert.equal(r.current_disclosure,'not_evaluated');assert.equal(r.custody,'not_proven');}
await check('new actual CE/Docs/Core replay-scope coupling and canonical read order',async()=>{const x=await saved();assert.equal(new Set([x.receipt.receipt_id,x.receipt.mutation_id,x.f.ces.get(x.key).ce_receipt.receipt_id]).size,3);const r=await insideReplay(x,request(x),async(scope,receipt)=>{const relation=await writer.readCe012SaveWriterRelationV1(scope,x.cmd,x.guide,receipt);assert.equal(relation.core_receipt_hash,receiptHash(x.receipt));});closed(r.result);assert.equal(r.result.integrity,'matched_candidate');assert.equal(r.outcome.status,'exact_replay');const start=r.trace.findIndex(c=>c.text===coreSql);assert.deepEqual(r.trace.slice(start,start+4).map(c=>c.text),[coreSql,ceSql,coreSql,expirySql]);assert.notEqual(x.f.ces.get(x.key).database_transaction_id,r.scoped.database_transaction_id);});
for(const [label,mutate] of [
 ['full stored payload',row=>row.guide_command.payload.instructions+=' changed'],['stored command body',row=>row.command_json.authority_version++],
 ['immutable target version',row=>row.ce_receipt.document_target.document_version++],['CE receipt ID',row=>row.ce_receipt.receipt_id=id(80)],
 ['mutation link',row=>row.mutation_id=id(80)],['Core decision link',row=>row.ce_receipt.core_decision_id=id(80)],
 ['row tenant',row=>row.tenant_id=id(80)],['row Workspace',row=>row.workspace_id=id(80)],['original transaction malformed',row=>row.database_transaction_id='bad'],
])await check(`combined integrity rejects ${label}`,async()=>{const x=await saved(),value=request(x);mutate(x.f.ces.get(x.key));const r=await insideReplay(x,value);closed(r.result);assert.notEqual(r.result.integrity,'matched_candidate');});
await check('expected CE ID is checked independently of Core and mutation IDs',async()=>{const x=await saved(),value=request(x);value.expected.ce_save_receipt_id=x.receipt.mutation_id;const r=await insideReplay(x,value);closed(r.result);assert.equal(r.result.integrity,'mismatch');});
await check('CE-row wait crosses C03 expiry; official Core fresh check is last',async()=>{const x=await saved();x.f.now='2998-12-31T23:59:59.999999Z';x.f.onCeWait=async()=>{await Promise.resolve();x.f.now='2999-01-01T00:00:00.000001Z';};const r=await insideReplay(x);closed(r.result);assert.equal(r.result.integrity,'expired');});
await check('lookup absent CE row cannot be replaced by matching Core JSON',async()=>{const x=await saved(),value=request(x);x.f.ces.delete(x.key);const r=await insideReplay(x,value);closed(r.result);assert.equal(r.result.integrity,'unavailable');});
await check('combined original40001 reaches actual trusted host without own retry',async()=>{const x=await saved();const error=Object.assign(Error('synthetic serialization'),{code:'40001'});x.f.faultSql=expirySql;x.f.driver=error;let same=0;const p=writer.createCe012SaveWriterProviderV1(x.guide,docs),value=request(x),writes=structuredClone(x.f.writes),attempts=x.f.attempts;const r=await x.f.host.execute(x.cmd,{...p,async validateReplay(scope){try{await combined(scope,value);}catch(e){assert.equal(e,error);same++;throw e;}throw Error('fault expected');}});assert.equal(same,3);assert.equal(x.f.attempts-attempts,3);assert.equal(r.status,'denied');assert.deepEqual(x.f.writes,writes);});
await check('UNKNOWN COMMIT retains exact candidate writer command and recovers through actual replay',async()=>{const f=fixture(),{guide,cmd}=command();f.lostCommit=true;const executor=writer.createCe012SaveWriterExecutorV1(f.host,cmd,docs);await assert.rejects(executor.execute(guide),e=>e.code==='CE012_SAVE_UNKNOWN');const writes=structuredClone(f.writes);assert.equal((await executor.execute(guide)).replayed,true);assert.deepEqual(f.writes,writes);assert.equal(f.commits,1);});
await check('deferred failure is only a model; no acceptance or partial receipt',async()=>{const f=fixture(),{guide,cmd}=command();f.deferredFailure=true;const executor=writer.createCe012SaveWriterExecutorV1(f.host,cmd,docs);await assert.rejects(executor.execute(guide),e=>e.code==='CE012_SAVE_UNKNOWN');assert.equal(f.version,1);assert.equal(f.ces.size,0);assert.equal(f.ledgers.size,0);assert.deepEqual(f.writes,[]);});
await check('COUNTEREXAMPLE membership expiry after last Docs wait still commits candidate save',async()=>{const f=fixture(),{guide,cmd}=command();f.expireAfterDocs=true;let reached,release;const arrived=new Promise(r=>{reached=r;});f.docsRequested=reached;f.docsBarrier=new Promise(r=>{release=r;});const pending=f.host.execute(cmd,writer.createCe012SaveWriterProviderV1(guide,docs));await arrived;f.expired=true;f.now='2026-11-02T17:00:01.000000Z';release();const result=await pending;assert.equal(f.expired,true);assert.equal(result.status,'committed');const at=f.trace.findIndex(c=>c.q==='MODEL_MEMBERSHIP_EXPIRED_AFTER_DOCS_WAIT');assert.ok(at>=0);assert.ok(f.trace.slice(at).some(c=>c.q.startsWith('update experience.guides')));assert.equal(f.trace.slice(at).some(c=>c.q.includes('m.user_id::text as actor_id')),false);});
await check('COUNTEREXAMPLE second valid save reusing step ID conflicts with pinned storage PK',async()=>{const x=await saved(),next=command(2,1),before=structuredClone(x.f.writes);const result=await x.f.host.execute(next.cmd,writer.createCe012SaveWriterProviderV1(next.guide,docs));assert.equal(result.status,'denied');assert.equal(x.f.version,2);assert.deepEqual(x.f.writes,before);assert.equal(x.f.ces.size,1);});
await check('integrity match cannot override actual current Documents denial',async()=>{const x=await saved();x.f.docsDenied=true;const r=await insideReplay(x);closed(r.result);assert.equal(r.result.integrity,'matched_candidate');assert.equal(r.outcome.status,'denied');});
await check('current authority denial blocks host before exposing historical relation',async()=>{const x=await saved();x.f.expired=true;let called=false;const writes=structuredClone(x.f.writes);const p=writer.createCe012SaveWriterProviderV1(x.guide,docs);const r=await x.f.host.execute(x.cmd,{...p,async validateReplay(){called=true;throw Error('must not reach historical read');}});assert.equal(r.status,'denied');assert.equal(called,false);assert.deepEqual(x.f.writes,writes);});
await check('C03 cleanup with CE projection retained is unavailable, never perpetual proof',async()=>{const x=await saved(),value=request(x);x.f.ledgers.delete(x.key);const writes=structuredClone(x.f.writes);let found;const p=writer.createCe012SaveWriterProviderV1(x.guide,docs);await x.f.host.execute(x.cmd,{...p,async validateProviders(scope,c,a){found=await combined(scope,value);return p.validateProviders(scope,c,a);}});closed(found);assert.equal(found.integrity,'unavailable');assert.equal(x.f.ces.size,1);assert.deepEqual(x.f.writes,writes);});
await check('caller callbacks/committed flag are rejected, never admitted as proof',async()=>{const x=await saved();const value={...request(x),verifier:()=>true,committed:true};const r=await insideReplay(x,value);closed(r.result);assert.equal(r.result.integrity,'mismatch');assert.equal(r.trace.some(c=>c.text===ceSql),false);});
await check('caller payload mutation during CE wait cannot rebind parsed command',async()=>{const x=await saved(),value=request(x);x.f.onCeWait=async()=>{value.guide_command.payload.instructions='changed by caller';};const r=await insideReplay(x,value);closed(r.result);assert.equal(r.result.integrity,'matched_candidate');});
function fenced(r){closed(r);assert.equal(r.contract,'core-ce012-combined-stored-relation.v2');assert.equal(r.documents_disclosure_projection,null);assert.equal(r.disclosure_status,'not_ready');assert.equal(r.terminal_authority_checkpoint,'not_ready');assert.equal(r.reader_policy,'original_actor_only');}
const docRequest=x=>({contract:'docs-ce012-reference-request.v1',version:1,context_id:x.cmd.context_id,workspace_id:x.cmd.workspace_id,guide_id:x.guide.guide_id,target:{document_id:x.guide.payload.document_target.document_id,document_version_id:x.guide.payload.document_target.document_version_id,document_version:x.guide.payload.document_target.document_version},evaluation_mode:'replay'});
await check('D06: C01 expected CE ID rejects even when both private readers match',async()=>{
 const x=await saved(),value=request(x);value.expected.ce_save_receipt_id=id(88);let v2;
 await insideReplay(x,request(x),async(scope,receipt)=>{assert.equal((await load('src/lib/core/ce012-stored-relation-v1.ts').readCoreCe012StoredRelationV1(scope,value)).core_status,'matched');const own=await writer.readCe012SaveWriterRelationV1(scope,x.cmd,x.guide,receipt);assert.notEqual(own.ce_receipt.receipt_id,value.expected.ce_save_receipt_id);v2=await disclosure(scope,value);});fenced(v2);assert.equal(v2.integrity,'mismatch');
});
await check('D06: C01 matched independent IDs/full body never imply disclosure',async()=>{const x=await saved();let v2;await insideReplay(x,request(x),async scope=>{v2=await disclosure(scope,request(x));});fenced(v2);assert.equal(v2.integrity,'matched_candidate');assert.equal(new Set([x.receipt.receipt_id,x.receipt.mutation_id,x.f.ces.get(x.key).ce_receipt.receipt_id]).size,3);});
await check('D06: C02 later official Docs wait invalidates earlier Core expiry observation',async()=>{
 const x=await saved();x.f.now='2998-12-31T23:59:59.999999Z';let before,after,projection;
 await insideReplay(x,request(x),async(scope,receipt,authority)=>{before=await disclosure(scope,request(x));assert.equal(before.integrity,'matched_candidate');x.f.onDocumentWait=async()=>{await Promise.resolve();x.f.now='2999-01-01T00:00:00.000001Z';};projection=await docs.createDocumentsCe012ReferenceProviderV1(scope,x.cmd,authority,x.guide,'replay').select(docRequest(x));after=await disclosure(scope,request(x));});
 assert.equal(projection.decision,'historical_authorized');fenced(before);fenced(after);assert.equal(after.integrity,'expired');assert.equal(before.checkpoint_scope,'stored_integrity_and_receipt_expiry_only');
});
await check('D06: C02 caller terminal allow/checkpoint cannot unlock the v2 gate',async()=>{const x=await saved();let v2;await insideReplay(x,request(x),async scope=>{v2=await disclosure(scope,{...request(x),terminal_authority:{allowed:true},verify:()=>true,documents_projection:{safe_label:'caller'}});});fenced(v2);assert.equal(v2.integrity,'mismatch');});
await check('D06: C03 private label never escapes; official current projection remains separate',async()=>{
 const x=await saved(),original=request(x),fingerprint=x.guide.payload_fingerprint,hash=receiptHash(x.receipt);x.f.ces.get(x.key).ce_receipt.document_target.label='UNTRUSTED-STORED-LABEL';let v2,privateValue,projection;
 await insideReplay(x,original,async(scope,receipt,authority)=>{privateValue=await writer.readCe012SaveWriterRelationV1(scope,x.cmd,x.guide,receipt);v2=await disclosure(scope,original);projection=await docs.createDocumentsCe012ReferenceProviderV1(scope,x.cmd,authority,x.guide,'replay').select(docRequest(x));});
 assert.equal(privateValue.ce_receipt.document_target.label,'UNTRUSTED-STORED-LABEL');assert.equal(projection.safe_label,'Document reference');fenced(v2);assert.doesNotMatch(JSON.stringify(v2),/UNTRUSTED-STORED-LABEL|Document reference/);assert.equal(x.guide.payload_fingerprint,fingerprint);assert.equal(receiptHash(x.receipt),hash);assert.equal(x.f.ces.get(x.key).ce_receipt.document_target.label,'UNTRUSTED-STORED-LABEL');
});
await check('D06: C03 Documents deny releases neither private label nor raw receipt',async()=>{const x=await saved();x.f.docsDenied=true;let v2,projection;await insideReplay(x,request(x),async(scope,receipt,authority)=>{v2=await disclosure(scope,request(x));projection=await docs.createDocumentsCe012ReferenceProviderV1(scope,x.cmd,authority,x.guide,'replay').select(docRequest(x));});fenced(v2);assert.equal(projection.decision,'denied');assert.equal(projection.safe_label,null);assert.equal(Object.hasOwn(v2,'ce_receipt'),false);});
await check('D06: C04 different actor and rewritten original actor both fail',async()=>{const x=await saved();let original,rewritten;await insideReplay(x,request(x),async scope=>{const foreign={...scope,actor_id:id(88),query:scope.query.bind(scope)};const start=x.f.trace.length;original=await disclosure(foreign,request(x));assert.equal(x.f.trace.length,start);const value=request(x);value.command.actor_id=id(88);rewritten=await disclosure(foreign,value);});fenced(original);fenced(rewritten);assert.equal(original.integrity,'mismatch');assert.equal(rewritten.integrity,'mismatch');});
console.log(JSON.stringify({task:'CORE-CE012-WRITER-RELATION-JOINT-REVIEW-09',checks:n,result:'PASS_NEW_CONTROLLED_COUPLING',docs_review:docsDeltaOnly?'f92d142558b19469e37c0e5b9d6f6f92fc9eb619':null,findings:Array.from(findings),docs_findings_covered:Array.from(docsFindings),runtime_binding:null,historical_slots:'BLOCKED',native_sql_trigger_auth:'NOT_RUN'}));
