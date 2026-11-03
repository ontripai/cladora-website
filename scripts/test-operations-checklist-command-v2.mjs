/** Affected offline integration. Actual codecs/client/React/Next handlers; FAKE
 * Auth/C03/native mutation/commit. SQL is inspected as text, never parsed/run. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {createHash,webcrypto} from 'node:crypto';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
const rootArg=process.argv.indexOf('--source-root');
const root=rootArg<0?fileURLToPath(new URL('../',import.meta.url)):path.resolve(process.argv[rootArg+1]),require=createRequire(import.meta.url),ts=require('typescript');
const probe289=process.argv.includes('--probe-289'),focused289=probe289||process.argv.includes('--review-289');
const {NextRequest}=require('next/server');
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const sha=v=>createHash('sha256').update(v).digest('hex');
const uuid=n=>`28200000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const A=uuid(1),B=uuid(2),C=uuid(3),ACTOR=uuid(4),WS=uuid(5),OTHER_WS=uuid(6),WO=uuid(7),ITEM=uuid(8),MEMBER=uuid(9),OUTBOX=uuid(10);
const at='2026-10-29T10:00:00.000Z',notes='Synthetic inspected checklist result';
const intent={version:2,action:'record_checklist',context_id:A,target_id:WO,expected_status:'in_progress',input:{context_id:A,item_id:ITEM,notes}};
const env=(p=intent,key=crypto.randomUUID())=>{const wire=JSON.stringify(p);return {key,wire,fingerprint:sha(wire)};};
let cases=0,checks=0;
const eq=(a,b,m)=>{checks++;assert.deepEqual(a,b,m);};const ok=(v,m)=>{checks++;assert.ok(v,m);};
const rejects=async(work,pattern)=>{checks++;await assert.rejects(work,pattern);};
const matchArg=process.argv.indexOf('--match'),caseMatch=matchArg<0?null:new RegExp(process.argv[matchArg+1]);
async function test(name,body){if((focused289&&!name.startsWith('289-'))||(caseMatch&&!caseMatch.test(name)))return;await body();cases++;console.log((probe289?'PROBE ':'PASS ')+name);}
const store=()=>{const map=new Map();return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),get length(){return map.size;},key:i=>[...map.keys()][i]??null};};
const tick=()=>new Promise(r=>setTimeout(r,0));
function model(){
 const s={rows:new Map(),denied:new Set(),revoked:false,auth:true,revision:1,role:'manager',calls:[],writes:0,domainAudit:0,commandAudit:0,outbox:0,
  item:{completed:false,completed_at:null,notes:null},fault:null,loss:null,hold:null,wrongAck:false,corrupt:null};
 const workspace=ctx=>ctx===C?OTHER_WS:WS;
 const allowed=ctx=>{if(![A,B,C].includes(ctx)||s.revoked||s.denied.has(ctx))throw Object.assign(Error('PRIVATE DENIAL'),{code:'42501'});};
 const observation=()=>({work_order_id:WO,status:'in_progress',items:[{id:ITEM,label:'Synthetic check',required:true,...structuredClone(s.item)}]});
 const binding=ctx=>({actor_id:ACTOR,context_id:ctx,workspace_id:workspace(ctx),membership_id:MEMBER,role:s.role});
 const answer=(version,ctx,state,command=null,receipt=null)=>({version,actor_id:ACTOR,context_id:ctx,state,command,receipt});
 const protect=(ctx,row)=>{allowed(ctx);if(JSON.stringify(row.binding)!==JSON.stringify(binding(ctx)))throw Object.assign(Error('original authority binding'),{code:'40001'});};
 const run=async(name,p)=>{
  s.calls.push({name,p:structuredClone(p)});allowed(p.p_context_id);
  if(s.missingRpc&&name==='operations_command_v2')throw Object.assign(Error('missing v2'),{code:'42883'});
  if(name==='get_work_order_checklist_v2'||name==='work_order_checklist_v1'){
   if(p.p_work_order_id!==WO||p.p_context_id===C)throw Object.assign(Error('private work-order scope'),{code:'42501'});
   if(p.p_item_id){if(p.p_item_id!==ITEM)throw Object.assign(Error('missing'),{code:'P0002'});if(s.item.completed&&s.item.notes!==p.p_notes)throw Object.assign(Error('conflict'),{code:'40001'});if(!s.item.completed){s.item={completed:true,completed_at:at,notes:p.p_notes};s.writes++;s.domainAudit++;}}
   return observation();
  }
  assert.ok(['operations_command_v1','operations_command_v2'].includes(name));
  const phase=p.p_phase,ctx=p.p_context_id,ws=workspace(ctx);
  const pending=[...s.rows.values()].filter(r=>r.binding.workspace_id===ws&&!r.ack);
  if(pending.length>1)throw Object.assign(Error('private invariant'),{code:'55000'});
  if(phase==='open'){
   const row=pending[0];if(!row)return answer(name==='operations_command_v2'?2:1,ctx,'clear');
   const parsed=JSON.parse(row.env.wire);protect(parsed.context_id,row);
   return answer(name==='operations_command_v2'?parsed.version:1,parsed.context_id,row.receipt?.outcome??'pending',structuredClone(row.env),structuredClone(row.receipt));
  }
  const command={key:p.p_key,wire:p.p_wire,fingerprint:p.p_fingerprint},i=JSON.parse(command.wire);
  assert.equal(sha(command.wire),command.fingerprint);assert.equal(i.context_id,ctx);
  if(i.target_id===WO&&ctx===C)throw Object.assign(Error('foreign Workspace resource'),{code:'42501'});
  if(name==='operations_command_v1'&&i.version!==1)throw Object.assign(Error('version'),{code:'22023'});
  let row=s.rows.get(command.key);
  if(row){protect(ctx,row);if(row.expired||JSON.stringify(row.env)!==JSON.stringify(command))throw Object.assign(Error('exact conflict'),{code:'40001'});}
  if(phase==='lookup')return answer(i.version,ctx,row?.receipt?.outcome??(row?'pending':'absent'),command,structuredClone(row?.receipt??null));
  if(phase==='reserve'){
   if(pending.some(r=>r.env.key!==command.key))throw Object.assign(Error('admission'),{code:'40001'});
   if(!row){row={env:structuredClone(command),binding:binding(ctx),receipt:null,ack:false,expired:false};s.rows.set(command.key,row);}
   return answer(i.version,ctx,row.receipt?.outcome??'pending',command,structuredClone(row.receipt));
  }
  if(!row)throw Object.assign(Error('reservation required'),{code:'40001'});
  if(phase==='ack'){
   assert.ok(row.receipt);row.ack=true;const receipt=structuredClone(row.receipt);if(s.wrongAck)receipt.fingerprint='f'.repeat(64);
   return answer(i.version,ctx,'acknowledged',command,receipt);
  }
  assert.equal(phase,'execute');
  if(!row.receipt){
   if(pending.some(r=>r.env.key!==command.key))throw Object.assign(Error('admission'),{code:'40001'});
   const before={item:structuredClone(s.item),writes:s.writes,domainAudit:s.domainAudit,commandAudit:s.commandAudit,outbox:s.outbox};
   const already=s.item.completed;let error=null,result;
   try{
    if(s.rejectCode)throw Object.assign(Error('synthetic native rejection'),{code:s.rejectCode});
    if(i.action==='record_checklist'){
     if(i.target_id!==WO||i.input.item_id!==ITEM||ctx===C)throw Object.assign(Error('scope'),{code:'42501'});
     if(already&&s.item.notes!==i.input.notes)throw Object.assign(Error('other notes'),{code:'40001'});
     if(!already){s.item={completed:true,completed_at:at,notes:i.input.notes};s.writes++;if(s.fault==='after-item')throw Error('fault');s.domainAudit++;}
     if(s.fault==='after-domain')throw Error('fault');
     result={work_order_id:WO,item_id:ITEM,completed:true,completed_at:s.item.completed_at,notes:i.input.notes,already_recorded:already};
    }else{result={id:i.target_id,status:'assigned',vendor_id:MEMBER};s.writes++;s.domainAudit++;}
    s.commandAudit++;if(s.fault==='after-command-audit')throw Error('fault');s.outbox++;if(s.fault==='after-outbox')throw Error('fault');
   }catch(e){Object.assign(s,before);error=e.code??'22023';result=null;}
   row.receipt={contract_version:`operations-command-receipt.v${i.version}`,key:command.key,context_id:ctx,workspace_id:ws,actor_id:ACTOR,membership_id:MEMBER,authority_revision:s.revision,request_hash:sha(JSON.stringify({version:i.version,binding:row.binding,wire:command.wire})),action:i.action,target_id:i.target_id,fingerprint:command.fingerprint,outcome:error?'rejected':'committed',result,error_code:error,audit_event_id:error?null:String(s.commandAudit),outbox_event_id:error?null:OUTBOX,recorded_at:at};
  }
  const receipt=structuredClone(row.receipt);s.corrupt?.(receipt);
  return answer(i.version,ctx,receipt.outcome,command,receipt);
 };
 const rpc=async(name,p)=>{try{return {data:await run(name,p),error:null};}catch(e){return {data:null,error:{code:e.code??'55000',message:'PRIVATE DETAIL'}};}};
 return {s,rpc,run,observation,counts:()=>[s.writes,s.domainAudit,s.commandAudit,s.outbox]};
}
function loader(m,active=false,sourceRoot=root){
 const cache=new Map();
 function load(relative){
  const file=path.resolve(sourceRoot,relative);if(cache.has(file))return cache.get(file).exports;
  const mod=new Module(file);cache.set(file,mod);mod.require=id=>{
   if(id==='server-only')return {};
   if(id==='@/lib/supabase/server')return {createClient:async()=>({auth:{getClaims:async()=>m.s.auth?{data:{claims:{sub:ACTOR}},error:null}:{data:null,error:{message:'fake'}}},schema:()=>({rpc:m.rpc})})};
   if(id.startsWith('.')||id.startsWith('@/')){
    const base=id.startsWith('@/')?path.join(sourceRoot,'src',id.slice(2)):path.resolve(path.dirname(file),id);
    const found=[base,base+'.ts',base+'.tsx'].find(p=>existsSync(p)&&statSync(p).isFile());if(found)return load(path.relative(sourceRoot,found));
   }return require(id);
  };
  mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
  if(active&&relative==='src/lib/customer/operations-checklist-cutover.ts'){
   // Deliberate test-only simulated activation. Product source remains inactive;
   // these SHA markers/booleans are not install/caller/runtime evidence.
   const seal='sha256:'+'a'.repeat(64);mod.exports.CHECKLIST_C03_CUTOVER={state:'active',protocol:2,scope:'technical_test_only',installed_source_seal:seal,caller_acl_seal:seal,legacy_inventory_seal:seal,execution_authorization:seal};
  }
  return mod.exports;
 }return load;
}
function harness(active=true){
 const m=model(),load=loader(m,active),codec=load('src/lib/customer/operations-command.ts'),cutover=load('src/lib/customer/operations-checklist-cutover.ts');
 const server=load('src/lib/customer/operations-command-server.ts'),route=load('src/app/api/customer/v1/work-orders/[id]/checklist/route.ts');
 const http=async(phase,ctx,command,version=active?2:1)=>server.operationsCommandPOST(new NextRequest('https://cladora.test/api/customer/v1/operations/commands',{method:'POST',headers:{origin:'https://cladora.test','content-type':'application/json'},body:JSON.stringify({version,phase,context_id:ctx,command})}));
 const transport=async(phase,ctx,command)=>{
  if(m.s.loss===phase+'-before'){m.s.loss=null;throw Error('synthetic lost before '+phase);}
  const r=await http(phase,ctx,command);
  if(m.s.loss===phase+'-after'){m.s.loss=null;throw Error('synthetic lost after '+phase);}
  if(!r.ok)throw Error('transport_'+r.status);return r.json();
 };
 const {createOperationsCommandClient}=load('src/lib/customer/operations-command-client.ts');
 let locked=false;const exclusive=async(_name,work)=>{if(locked)throw Error('other_tab');locked=true;try{return await work();}finally{locked=false;}};
 const client=(storage=store(),ctx=A)=>createOperationsCommandClient(ctx,storage,transport,exclusive,()=>{});
 const checklist=async(method,ctx=A,body=null)=>route[method](new NextRequest('https://cladora.test/api/customer/v1/work-orders/'+WO+'/checklist?context_id='+ctx,{method,...(method==='POST'?{headers:{origin:'https://cladora.test','content-type':'application/json'},body:JSON.stringify(body)}:{})}),{params:Promise.resolve({id:WO})});
 return {...m,load,codec,cutover,http,transport,client,checklist};
}
await test('source cutover is inactive; v2 rejected before Auth/RPC; legacy remains selected',async()=>{const h=harness(false);eq(h.cutover.checklistV2Enabled(),false);const r=await h.http('open',A,null,2);eq(r.status,503);eq(h.s.calls.length,0);const c=h.client();await c.reconcile();await rejects(()=>c.execute(intent),/inactive/);eq(h.s.rows.size,0);eq((await h.checklist('GET')).status,200);eq(h.s.calls.at(-1).name,'work_order_checklist_v1');});
for(const key of ['installed_source_seal','caller_acl_seal','legacy_inventory_seal','execution_authorization'])await test('partial cutover '+key+' holds BOTH protocols and never falls back to legacy writer',async()=>{const h=harness();h.cutover.CHECKLIST_C03_CUTOVER[key]=null;eq(h.cutover.checklistCutoverMode(),'hold');for(const v of [1,2])eq((await h.http('open',A,null,v)).status,503);eq((await h.checklist('GET')).status,503);eq((await h.checklist('POST',A,{context_id:A,item_id:ITEM,notes})).status,503);eq(h.s.calls.length,0);});
await test('inactive source with a stale non-NULL binding is hold, not legacy fallback',async()=>{const h=harness(false);h.cutover.CHECKLIST_C03_CUTOVER={...h.cutover.CHECKLIST_C03_CUTOVER,installed_source_seal:'sha256:'+'a'.repeat(64)};eq(h.cutover.checklistCutoverMode(),'hold');eq((await h.checklist('POST',A,{context_id:A,item_id:ITEM,notes})).status,503);eq(h.s.calls.length,0);});
await test('version2 exact wire and independent native-shaped result codec',()=>{const h=harness();eq(h.codec.intentFromWire(JSON.stringify(intent)),intent);for(const v of [{...intent,version:1},{...intent,action:'complete'},{...intent,expected_status:'completed'},{...intent,actor_id:ACTOR},{...intent,input:{...intent.input,context_id:B}},{...intent,input:{...intent.input,notes:' '+notes}}]){checks++;assert.throws(()=>h.codec.intentFromWire(JSON.stringify(v)));}for(const text of ['\0'+notes,'\ud800'+notes,'😀'.repeat(5)]){checks++;assert.throws(()=>h.codec.intentFromWire(JSON.stringify({...intent,input:{...intent.input,notes:text}})));}eq(h.codec.intentFromWire(JSON.stringify({...intent,input:{...intent.input,notes:'😀'.repeat(10)}})).input.notes,'😀'.repeat(10));});
await test('fresh command mutates model once; same key execute/lookup/ACK return exact canonical receipt',async()=>{const h=harness(),c=h.client();await c.reconcile();const receipt=await c.execute(intent);eq(receipt.result.already_recorded,false);eq(h.counts(),[1,1,1,1]);const row=[...h.s.rows.values()][0];for(const phase of ['lookup','execute','ack']){const seen=await h.transport(phase,A,row.env);eq(seen.receipt,receipt);}eq(h.counts(),[1,1,1,1]);});
await test('v2 pending closes admission before first reserve dispatch, including dependent v1 commands',async()=>{const h=harness(),storage=store();let release,arrived=false;const wait=new Promise(r=>{release=r;});const factory=h.load('src/lib/customer/operations-command-client.ts').createOperationsCommandClient;const c=factory(A,storage,async(phase,ctx,e)=>{if(phase==='reserve'){arrived=true;await wait;}return h.transport(phase,ctx,e);},async(_n,work)=>work(),()=>{});await c.reconcile();const pending=c.execute(intent);for(let i=0;i<100&&!arrived;i++)await tick();ok(arrived);eq(c.getState().ready,false);eq(c.getState().unresolved,true);eq(storage.map.size,1);eq(h.s.rows.size,0);await rejects(()=>c.execute({version:1,action:'complete',context_id:A,target_id:WO,expected_status:'in_progress',input:{context_id:A,completion_notes:'Synthetic completion'}}),/busy|reconcile/);release();await pending;eq(h.counts(),[1,1,1,1]);});
await test('valid historical receipt is insufficient when original current authority denies ACK',async()=>{const h=harness(),storage=store(),factory=h.load('src/lib/customer/operations-command-client.ts').createOperationsCommandClient;const c=factory(A,storage,async(phase,ctx,e)=>{if(phase==='ack')h.s.denied.add(A);return h.transport(phase,ctx,e);},async(_n,work)=>work(),()=>{});await c.reconcile();await rejects(()=>c.execute(intent),/403/);eq(c.getState().ready,false);eq(c.getState().receipt,null);eq(storage.map.size,1);eq([...h.s.rows.values()][0].ack,false);eq(h.counts(),[1,1,1,1]);});
await test('coherent changed-body same-key conflict; another command held until reconciliation',async()=>{const h=harness(),c=h.client();await c.reconcile();h.s.loss='execute-after';await rejects(()=>c.execute(intent),/lost/);const saved=[...h.s.rows.values()][0].env,changed=env({...intent,input:{...intent.input,notes:'Different synthetic checklist result'}},saved.key);eq((await h.http('reserve',A,changed)).status,409);await rejects(()=>c.execute({...intent,input:{...intent.input,item_id:uuid(99)}}),/reconcile/);eq(h.counts(),[1,1,1,1]);});
await test('v1 intent/receipt ABI stays exact and v1 cannot bypass pending v2 admission',async()=>{const h=harness(),v1={version:1,context_id:A,target_id:WO,action:'issue',expected_status:'draft',input:{context_id:A}},wire=JSON.stringify(v1);eq(h.codec.intentFromWire(wire),v1);eq(h.codec.operationsIntentV1Schema.safeParse(intent).success,false);const c=h.client();await c.reconcile();h.s.loss='execute-before';await rejects(()=>c.execute(intent));const newer=env(v1);eq((await h.http('reserve',A,newer,1)).status,409);eq(h.s.rows.size,1);const row=[...h.s.rows.values()][0];const oldOpen=await h.http('open',A,null,1);eq(oldOpen.status,503,'v1 answer cannot relabel v2 pending as v1');eq(row.env.fingerprint,sha(row.env.wire));const other=harness();const first=other.client();await first.reconcile();const r=await first.execute(v1);eq(r.contract_version,'operations-command-receipt.v1');eq([...other.s.rows.values()][0].env.wire,wire);eq(r.fingerprint,sha(wire));});
await test('foreign Workspace target is denied before C03 reservation; no result disclosure',async()=>{const h=harness(),foreign=env({...intent,context_id:C,input:{...intent.input,context_id:C}});const r=await h.http('reserve',C,foreign);eq(r.status,403);ok(!JSON.stringify(await r.json()).includes(WO));eq(h.s.rows.size,0);eq(h.counts(),[0,0,0,0]);});
for(const loss of ['reserve-before','reserve-after','execute-before','execute-after','ack-after'])await test('lost reply '+loss+' -> reload original exact key/wire, never observation success',async()=>{const h=harness(),storage=store(),c=h.client(storage);await c.reconcile();h.s.loss=loss;await rejects(()=>c.execute(intent),/lost/);ok(!c.getState().ready);const stored=[...storage.map.values()][0],after=h.client(storage);await after.reconcile();if(['reserve-before','reserve-after','execute-before'].includes(loss)){eq(after.getState().ready,false);eq(after.getState().receipt,null);eq(after.getState().unresolved,true);eq([...storage.map.values()][0],stored);await after.retryExact();}else eq(after.getState().receipt.result.already_recorded,false);eq(h.counts(),[1,1,1,1]);eq(h.s.rows.size,1);eq(storage.map.size,0);});
await test('lost committed reply with empty browser storage recovers existing server command on new device',async()=>{const h=harness(),c=h.client();await c.reconcile();h.s.loss='execute-after';await rejects(()=>c.execute(intent));const second=h.client(store());await second.reconcile();eq(second.getState().receipt.action,'record_checklist');eq(h.counts(),[1,1,1,1]);eq(h.s.rows.size,1);});
await test('original Context A under selected B; no B storage or B dispatch for A command',async()=>{const h=harness(),storage=store(),c=h.client(storage);await c.reconcile();h.s.loss='execute-before';await rejects(()=>c.execute(intent));const b=h.client(storage,B);await b.reconcile();eq(b.getState().recoveryContext,A);ok([...storage.map.keys()].every(k=>k.endsWith(':'+A)));await rejects(()=>b.retryExact(),/original_context/);ok(h.s.calls.filter(x=>x.p.p_phase!=='open').every(x=>x.p.p_context_id===A));const a=h.client(storage,A);await a.reconcile();await a.retryExact();eq(h.counts(),[1,1,1,1]);});
for(const kind of ['deny-original','session-revoke','role-change','lookup-missing','lookup-expired'])await test('recovery fail closed '+kind,async()=>{const h=harness(),storage=store(),c=h.client(storage);await c.reconcile();h.s.loss='execute-after';await rejects(()=>c.execute(intent));const before=[...storage.map.values()];if(kind==='deny-original')h.s.denied.add(A);if(kind==='session-revoke')h.s.revoked=true;if(kind==='role-change')h.s.role='other';if(kind==='lookup-missing')h.s.rows.clear();if(kind==='lookup-expired')[...h.s.rows.values()][0].expired=true;const next=h.client(storage,kind==='deny-original'?B:A);try{await next.reconcile();}catch{}eq(next.getState().ready,false);eq(next.getState().receipt,null);eq([...storage.map.values()],before);if(kind!=='lookup-missing')eq(h.counts(),[1,1,1,1]);});
await test('already_recorded only a new independently authorized command, not prior POST closure',async()=>{const h=harness();h.s.item={completed:true,completed_at:at,notes};const c=h.client();await c.reconcile();const r=await c.execute(intent);eq(r.result.already_recorded,true);eq(h.counts(),[0,0,1,1]);const another=h.client();h.s.denied.add(A);await rejects(()=>another.reconcile());eq(another.getState().ready,false);eq(h.s.rows.size,1);});
await test('already completed different notes -> rejected command receipt, no effect/audit/outbox',async()=>{const h=harness();h.s.item={completed:true,completed_at:at,notes:'Other completed checklist result'};const c=h.client();await c.reconcile();const r=await c.execute(intent);eq(r.outcome,'rejected');eq(r.result,null);eq(r.error_code,'40001');eq(h.counts(),[0,0,0,0]);});
for(const point of ['after-item','after-domain','after-command-audit','after-outbox'])await test('model rollback oracle '+point+' (NOT PostgreSQL proof)',async()=>{const h=harness(),c=h.client();await c.reconcile();h.s.fault=point;const r=await c.execute(intent);eq(r.outcome,'rejected');eq(r.audit_event_id,null);eq(r.outbox_event_id,null);eq(h.s.item.completed,false);eq(h.counts(),[0,0,0,0]);});
for(const field of ['item_id','work_order_id','notes','already_recorded','completed_at','extra'])await test('forged/incomplete result '+field+' never ACKs or releases hold',async()=>{const h=harness(),storage=store(),c=h.client(storage);await c.reconcile();h.s.corrupt=r=>{if(field==='extra')r.result.private_actor_id=ACTOR;else if(field==='already_recorded')delete r.result.already_recorded;else if(field==='completed_at')r.result.completed_at='2099-01-01T00:00:00Z';else r.result[field]=field==='notes'?'different note':uuid(99);};await rejects(()=>c.execute(intent));eq(c.getState().ready,false);eq(c.getState().receipt,null);ok(storage.map.size===1);ok(!h.s.calls.some(x=>x.p.p_phase==='ack'));});
await test('wrong ACK cannot clear storage/receipt even if server modeled ACK happened',async()=>{const h=harness(),storage=store(),c=h.client(storage);await c.reconcile();h.s.wrongAck=true;await rejects(()=>c.execute(intent));ok(storage.map.size===1);eq(c.getState().ready,false);eq(c.getState().receipt,null);h.s.wrongAck=false;const next=h.client(storage);await next.reconcile();eq(next.getState().ready,true);eq(h.counts(),[1,1,1,1]);});
await test('new two-tab admission and exact immutable snapshot around digest await',async()=>{const h=harness(),a=h.client(),b=h.client();await a.reconcile();await b.reconcile();const copy=structuredClone(intent);const pending=a.execute(copy);copy.input.notes='Changed after dispatch started';const both=await Promise.allSettled([pending,b.execute(intent)]);eq(both.filter(v=>v.status==='fulfilled').length,1);eq(h.counts(),[1,1,1,1]);eq(JSON.parse([...h.s.rows.values()][0].env.wire).input.notes,notes);});
await test('corrupt local wire/fingerprint and unavailable storage deny before further RPC',async()=>{const h=harness(),storage=store(),c=h.client(storage);await c.reconcile();h.s.loss='execute-before';await rejects(()=>c.execute(intent));const key=[...storage.map.keys()][0],saved=JSON.parse(storage.map.get(key));saved.fingerprint='0'.repeat(64);storage.map.set(key,JSON.stringify(saved));const n=h.s.calls.length,next=h.client(storage);await rejects(()=>next.reconcile());eq(next.getState().ready,false);ok(!h.s.calls.slice(n).some(x=>x.p.p_phase==='lookup'));const denied=h.client({getItem:()=>{throw Error('storage denied');},setItem:()=>{},removeItem:()=>{}});await rejects(()=>denied.reconcile());eq(denied.getState().ready,false);});
await test('legacy keyless journal has NO UNKNOWN-clear/migrate/resend or receipt API',async()=>{const h=harness(),storage=store();const owner=legacyCalls(h.cutover,storage,A,WO);owner.unknown();const before=[...storage.map];checks++;assert.throws(owner.known,/unknown_not_reconciled/);checks++;assert.throws(()=>h.cutover.beginLegacyChecklistAttempt(storage,B,WO));const c=h.client(storage,B);await rejects(()=>c.reconcile(),/safe_hold/);eq(c.getState().ready,false);eq(h.s.calls.length,0);eq([...storage.map],before);eq(h.counts(),[0,0,0,0]);});
await test('malformed legacy marker fail closed without purge; exact known inflight reply is distinct from UNKNOWN',()=>{const h=harness(),storage=store();storage.setItem(h.cutover.LEGACY_CHECKLIST_HOLD_KEY,'bad JSON');ok(h.cutover.hasLegacyChecklistHold(storage));eq(storage.map.size,1);const clean=store(),owner=legacyCalls(h.cutover,clean,A,WO);owner.known();eq(h.cutover.hasLegacyChecklistHold(clean),false);eq(clean.map.size,1);});
await test('GET v2 is a zero-write read facade; direct POST cutover closed with no fallback',async()=>{const h=harness(),before=h.counts();eq((await h.checklist('GET')).status,200);eq(h.counts(),before);eq(h.s.rows.size,0);const n=h.s.calls.length;eq((await h.checklist('POST',A,{context_id:A,item_id:ITEM,notes})).status,428);eq(h.s.calls.length,n);eq(h.s.calls.at(-1).name,'get_work_order_checklist_v2');});
await test('request version/wire/Context/hash validation precedes RPC; no fallback on absent v2 RPC',async()=>{const h=harness(),x=env();for(const [ctx,e,v] of [[B,x,2],[A,{...x,fingerprint:'0'.repeat(64)},2],[A,x,1]]){const n=h.s.calls.length;ok((await h.http('reserve',ctx,e,v)).status>=400);eq(h.s.calls.length,n);}const client=h.client();h.s.missingRpc=true;await rejects(()=>client.reconcile());eq(h.s.calls.at(-1).name,'operations_command_v2');eq(h.s.calls.length,1);});

const React=require('react'),{act}=React;
let latest;
async function mount(h,work,lang='en'){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test/'+lang+'/app/maintenance'}),old=new Map(),oldFetch=globalThis.fetch;
 for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true})){old.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});}
 const {createRoot}=require('react-dom/client');
 Object.defineProperty(dom.window.navigator,'locks',{value:{request:async(_n,_o,cb)=>cb({})},configurable:true});
 const {OperationsCommandGate,useOperationsCommands}=h.load('src/components/customer/OperationsCommandGate.tsx');
 const {WorkOrderChecklistPanel}=h.load('src/components/customer/WorkOrderChecklistPanel.tsx');
 function Consumer(){latest=useOperationsCommands();return null;}
 let ready=false;
 const onReady=v=>{ready=v;};
 const counts={POST:0,GET:0};let networkFailures=0,pendingNetwork=0;
 globalThis.fetch=async(url,options={})=>{
  pendingNetwork++;
  try{
  let r,phase=null,ctx=A;
  if(url==='/api/customer/v1/operations/commands'){const p=JSON.parse(options.body);phase=p.phase;ctx=p.context_id;if(h.s.loss===phase+'-before'){h.s.loss=null;throw Error('lost request');}r=await h.http(p.phase,p.context_id,p.command,p.version);}
  else if(String(url).includes('/checklist')){const method=options.method??'GET';counts[method]++;ctx=new URL(String(url),'https://cladora.test').searchParams.get('context_id')??JSON.parse(options.body).context_id;r=await h.checklist(method,ctx,method==='POST'?JSON.parse(options.body):null);phase=method==='POST'?'legacy':null;}
  else throw Error('Unexpected offline network target '+url);
  if(h.s.loss===phase+'-after'){h.s.loss=null;throw Error('lost reply');}
  if(h.s.hold&&h.s.hold.phase===phase&&!h.s.hold.used){h.s.hold.used=true;await h.s.hold.promise;}
  if(!r.ok)networkFailures++;return r;
  }catch(e){networkFailures++;throw e;}finally{pendingNetwork--;}
 };
 const rr=createRoot(dom.window.document.getElementById('root'));
 const flushUntil=async(predicate)=>{for(let i=0;i<100;i++){await act(async()=>{await tick();});if(predicate())break;}};
 const render=async(ctx=A,show=true)=>{await act(async()=>{rr.render(React.createElement(OperationsCommandGate,{contextId:ctx,lang},React.createElement(Consumer),show?React.createElement(WorkOrderChecklistPanel,{contextId:ctx,workOrderId:WO,lang,onReady,scopeKey:ctx}):null));await tick();});await flushUntil(()=>latest?.ready);};
 // Invoke the actual mounted React handler. JSDOM does not establish native
 // browser input-event support; no browser/UAT evidence is claimed here.
 const input=async text=>act(async()=>{const el=dom.window.document.querySelector('textarea');ok(el,'actual checklist textarea exists');const key=Object.keys(el).find(k=>k.startsWith('__reactProps$'));ok(key,'actual mounted handler');el[key].onChange({target:{value:text}});await tick();});
 const submit=async()=>{const before=networkFailures;await act(async()=>{dom.window.document.querySelector('form')?.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await tick();});await flushUntil(()=>ready||h.s.hold?.used||(networkFailures>before&&pendingNetwork===0&&!latest.ready));};
 try{await work({dom,render,input,submit,rr,counts,ready:()=>ready,onReady});}
 finally{await act(async()=>rr.unmount());globalThis.fetch=oldFetch;for(const [k,v] of old){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}dom.window.close();}
}
await test('mounted actual checklist -> gate -> client -> real Next handler -> fake C03; no direct POST',async()=>{const h=harness();await mount(h,async({render,input,submit,counts,ready})=>{await render();ok(latest.ready);eq(ready(),false);await input(notes);await submit();eq(h.counts(),[1,1,1,1]);eq(counts.POST,0);ok(counts.GET>=2);eq(ready(),true);eq(Reflect.ownKeys(latest).sort(),['ready','receipt','send']);eq(Reflect.ownKeys(latest.receipt).sort(),['action','outcome','recorded_at']);eq(latest.receipt.action,'record_checklist');ok(!JSON.stringify(latest.receipt).includes(notes));});});
for(const loss of ['execute-after','ack-after'])await test('mounted '+loss+' UNKNOWN cannot use GET or second submit; reload reconciles canonical receipt',async()=>{const h=harness();await mount(h,async({dom,render,input,submit,ready})=>{await render();await input(notes);h.s.loss=loss;await submit();eq(latest.ready,false);eq(ready(),false);eq(h.counts(),[1,1,1,1]);const row=[...h.s.rows.values()][0];const key=row.env.key;await submit();eq(h.s.rows.size,1);ok(dom.window.localStorage.length===1);await render(B);ok(latest.ready);eq(latest.receipt,null,'foreign original receipt not republished in B');eq(h.s.rows.get(key).receipt.result.already_recorded,false);eq(h.counts(),[1,1,1,1]);});});
await test('mounted Context switch with delayed execute reply cannot publish old summary or readiness',async()=>{const h=harness();let release;h.s.hold={phase:'execute',used:false,promise:new Promise(r=>{release=r;})};await mount(h,async({render,input,submit,ready})=>{await render();await input(notes);await submit();eq(ready(),false);h.s.denied.add(A);await render(B);eq(latest.ready,false);await act(async()=>{release();await tick();});eq(latest.ready,false);eq(latest.receipt,null);eq(ready(),false);eq(h.counts(),[1,1,1,1]);});});
await test('mounted legacy UNKNOWN persists across reload and valid GET; no new command can close it',async()=>{const h=harness(false);await mount(h,async({dom,render,input,submit,ready,counts})=>{await render();await input(notes);h.s.loss='legacy-after';await submit();ok(h.cutover.hasLegacyChecklistHold(dom.window.localStorage));eq(latest.ready,false);eq(ready(),false);const before=h.counts();await render(A,false);await render(A,true);eq(latest.ready,false);eq(ready(),false);eq(counts.POST,1);eq(h.counts(),before);eq(h.s.rows.size,0);});});
await test('mounted old in-flight known reply can finish; it creates no receipt and is not UNKNOWN recovery',async()=>{const h=harness(false);await mount(h,async({dom,render,input,submit,ready})=>{await render();await input(notes);await submit();eq(h.s.rows.size,0);eq(h.counts(),[1,1,0,0]);eq(h.cutover.hasLegacyChecklistHold(dom.window.localStorage),false);eq(latest.receipt,null);eq(ready(),true);});});


// Two bounded independent review regressions. Actual exported source and actual
// mounted Gate/client/codec/Next handlers; only Auth/C03/transport are modeled.
function legacyCalls(c,storage,context=A,order=WO){const handle=c.beginLegacyChecklistAttempt(storage,context,order);return {handle,unknown:()=>c.LEGACY_CHECKLIST_ATTEMPT_PREFIX?c.markLegacyChecklistUnknown(storage,handle):c.markLegacyChecklistUnknown(storage,context,order),known:()=>c.LEGACY_CHECKLIST_ATTEMPT_PREFIX?c.acknowledgeKnownLegacyReply(storage,handle):c.acknowledgeKnownLegacyReply(storage,context,order)};}
function racingLegacy(c,context=B,order=WO){
 const shared=store();let other=null,fired=false;
 // Pause after an empty root(v1)/unique-slot(v2) observation, before write. Another tab can run
 // while this tab has already observed absence; no delayed event is delivered.
 const pause=()=>{if(!fired){fired=true;other=legacyCalls(c,shared,A,WO);}};
 const b={getItem(k){const observed=shared.getItem(k);if(observed===null&&((!c.LEGACY_CHECKLIST_ATTEMPT_PREFIX&&k===c.LEGACY_CHECKLIST_HOLD_KEY)||(c.LEGACY_CHECKLIST_ATTEMPT_PREFIX&&k.startsWith(c.LEGACY_CHECKLIST_ATTEMPT_PREFIX))))pause();return observed;},setItem:(k,v)=>shared.setItem(k,v),removeItem:k=>shared.removeItem(k),key:i=>shared.key(i),get length(){return shared.length;}};
 const known=legacyCalls(c,b,context,order);ok(fired);ok(other);return {shared,b,other,known};
}
async function observeChecklist(dom){const b=[...dom.window.document.querySelectorAll('button')].find(x=>['Observe current checklist','Consultă lista curentă','مشاهدهٔ چک‌لیست فعلی'].includes(x.textContent));ok(b&&!b.disabled);await act(async()=>{b.click();await tick();});for(let i=0;i<12;i++)await act(async()=>{await tick();});}
await test('289-SR-01 canonical rejected receipt + exact ACK: before/after and explicit positive continuation',async()=>{
 const h=harness();h.s.rejectCode='40001';await mount(h,async({dom,render,input,submit,ready,counts})=>{
  await render();await input(notes);await submit();ok(latest.ready);eq(latest.receipt.outcome,'rejected');eq(Reflect.ownKeys(latest.receipt).sort(),['action','outcome','recorded_at']);eq(dom.window.localStorage.length,0);eq(ready(),false);eq(h.counts(),[0,0,0,0]);eq(h.s.rows.size,1);ok([...h.s.rows.values()][0].ack);const getBefore=counts.GET;
  if(probe289){ok(dom.window.document.body.textContent.includes('command outcome is unknown'));await observeChecklist(dom);ok(dom.window.document.body.textContent.includes('command outcome is unknown'));ok(dom.window.document.querySelector('form button').disabled);eq(h.s.rows.size,1);return;}
  ok(!dom.window.document.body.textContent.includes('command outcome is unknown'));ok(dom.window.document.body.textContent.includes('rejected'));eq(counts.GET,getBefore,'terminal rejection requires explicit observation, not an automatic retry/read');
  await observeChecklist(dom);ok(!dom.window.document.querySelector('form button').disabled);eq(h.s.rows.size,1);h.s.rejectCode=null;await submit();eq(h.counts(),[1,1,1,1]);eq(h.s.rows.size,2);eq(ready(),true);eq(latest.receipt.outcome,'committed');eq(Reflect.ownKeys(latest.receipt).sort(),['action','outcome','recorded_at']);
 });
});
await test('289-control SR01 actual committed reply and fresh observation remain positive',async()=>{const h=harness();await mount(h,async({render,input,submit,ready})=>{await render();await input(notes);await submit();eq(ready(),true);eq(latest.receipt.outcome,'committed');eq(Reflect.ownKeys(latest.receipt).sort(),['action','outcome','recorded_at']);eq(h.counts(),[1,1,1,1]);});});
await test('289-SR-02 bounded overlapping admission: known B cannot retire UNKNOWN A, positive sequential control',()=>{
 const c=harness(false).cutover,{shared,other,known}=racingLegacy(c,A,WO);known.known();let markFailed=false;try{other.unknown();}catch{markFailed=true;}
 if(probe289){ok(markFailed);eq(c.hasLegacyChecklistHold(shared),false,'predecessor loses other request hold');}else{ok(!markFailed);ok(c.hasLegacyChecklistHold(shared));checks++;assert.throws(other.known,/unknown/);ok(c.hasLegacyChecklistHold(shared));}
 const sequential=store(),first=legacyCalls(c,sequential);checks++;assert.throws(()=>legacyCalls(c,sequential,B,WO));first.known();eq(c.hasLegacyChecklistHold(sequential),false);
});
if(!probe289){
 for(const code of ['42501','22023','P0002'])await test('289-SR-01 exact ACK rejection '+code+' is known; failed current observation cannot admit',async()=>{const h=harness();h.s.rejectCode=code;await mount(h,async({dom,render,input,submit,ready})=>{await render();await input(notes);await submit();ok(latest.ready);eq(latest.receipt.outcome,'rejected');ok(!dom.window.document.body.textContent.includes('command outcome is unknown'));eq(ready(),false);h.s.denied.add(A);await observeChecklist(dom);eq(ready(),false);eq(dom.window.document.querySelectorAll('form').length,0);eq(h.counts(),[0,0,0,0]);eq(h.s.rows.size,1);});});
 for(const loss of ['execute-after','ack-after'])await test('289-SR-01 '+loss+' remains true UNKNOWN until exact-key recovery',async()=>{const h=harness();await mount(h,async({dom,render,input,submit,ready})=>{await render();await input(notes);h.s.loss=loss;await submit();eq(latest.ready,false);eq(ready(),false);eq(latest.receipt,null);ok(dom.window.document.body.textContent.includes('command outcome is unknown'));const row=[...h.s.rows.values()][0],envelope=structuredClone(row.env);await submit();eq(h.s.rows.size,1);eq(row.env,envelope);eq(h.counts(),[1,1,1,1]);const recover=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent==='Reconcile command');ok(recover&&!recover.disabled);await act(async()=>{recover.click();await tick();});for(let i=0;i<18;i++)await act(async()=>{await tick();});ok(latest.ready);eq(latest.receipt.outcome,'committed');eq(h.counts(),[1,1,1,1]);eq(row.env,envelope);});});
 await test('289-SR-01 delayed rejection ACK cannot publish across Context and deny',async()=>{const h=harness();h.s.rejectCode='40001';let release;h.s.hold={phase:'ack',used:false,promise:new Promise(r=>{release=r;})};await mount(h,async({render,input,submit,ready})=>{await render();await input(notes);await submit();ok(h.s.hold.used);h.s.denied.add(A);await render(B);const selectedReady=latest.ready;eq(latest.receipt,null);await act(async()=>{release();await tick();});eq(latest.ready,selectedReady);eq(latest.receipt,null);eq(ready(),false);eq(h.counts(),[0,0,0,0]);eq(h.s.rows.size,1);});});
 for(const [ctx,order] of [[A,WO],[B,WO],[A,uuid(91)],[B,uuid(91)]])for(const unknownFirst of [false,true])await test('289-SR-02 independent attempts '+ctx+order+unknownFirst,()=>{const c=harness(false).cutover,{shared,b,other,known}=racingLegacy(c,ctx,order);if(unknownFirst)other.unknown();known.known();if(!unknownFirst)other.unknown();ok(c.hasLegacyChecklistHold(shared));eq([...shared.map.values()].filter(v=>JSON.parse(v).state==='unknown').length,1);checks++;assert.throws(other.known,/unknown/);const remount=loader(model(),false)('src/lib/customer/operations-checklist-cutover.ts');ok(remount.hasLegacyChecklistHold(shared));checks++;assert.throws(()=>remount.acknowledgeKnownLegacyReply(shared,other.handle));checks++;assert.throws(()=>c.acknowledgeKnownLegacyReply(b,other.handle));ok(c.hasLegacyChecklistHold(shared));});
 await test('289-SR-02 both exact known replies retire only themselves; no deletion/receipt',()=>{const c=harness(false).cutover,{shared,other,known}=racingLegacy(c);known.known();ok(c.hasLegacyChecklistHold(shared));other.known();eq(c.hasLegacyChecklistHold(shared),false);eq(shared.length,2);for(const v of shared.map.values()){const j=JSON.parse(v);eq(j.state,'known');ok(!('key'in j)&&!('receipt'in j)&&!('notes'in j));}});
 await test('289-SR-02 old v1 marker never acquires an owner or clears on GET/remount',()=>{const c=harness(false).cutover,s=store(),v={version:1,kind:'legacy_keyless_checklist',context_id:A,work_order_id:WO,state:'unknown'};s.setItem(c.LEGACY_CHECKLIST_HOLD_KEY,JSON.stringify(v));const before=[...s.map];ok(c.hasLegacyChecklistHold(s));checks++;assert.throws(()=>legacyCalls(c,s));checks++;assert.throws(()=>c.acknowledgeKnownLegacyReply(s,{attempt_id:uuid(99),context_id:A,work_order_id:WO}));eq([...s.map],before);});
 await test('289-SR-02 lost own marker recreates UNKNOWN, malformed/enumeration/storage faults fail closed',()=>{const c=harness(false).cutover,s=store(),owner=legacyCalls(c,s);s.map.clear();owner.unknown();ok(c.hasLegacyChecklistHold(s));const malformed=store();malformed.setItem(c.LEGACY_CHECKLIST_ATTEMPT_PREFIX+uuid(99),'bad');ok(c.hasLegacyChecklistHold(malformed));const broken={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};ok(c.hasLegacyChecklistHold(broken));checks++;assert.throws(()=>legacyCalls(c,broken));const f=store(),own=legacyCalls(c,f),set=f.setItem;f.setItem=()=>{throw Error('storage unavailable');};checks++;assert.throws(own.unknown);f.setItem=set;ok(c.hasLegacyChecklistHold(f));});
 for(const op of ['getItem','setItem','key','length'])await test('289-SR-02 storage failure '+op+' keeps a hold without deletion',()=>{const c=harness(false).cutover,f=store();if(op==='length')Object.defineProperty(f,'length',{get(){throw Error('blocked');}});else f[op]=()=>{throw Error('blocked');};if(op==='setItem'){checks++;assert.throws(()=>legacyCalls(c,f));}else if(op==='key'){const good=store(),owner=legacyCalls(c,good);f.map.set(...[...good.map][0]);ok(owner.handle);}ok(c.hasLegacyChecklistHold(f));checks++;assert.throws(()=>legacyCalls(c,f));});
 await test('289-SR-02 an ownerless old inflight marker is held independently',()=>{const c=harness(false).cutover,f=store();const value=JSON.stringify({version:1,kind:'legacy_keyless_checklist',context_id:A,work_order_id:WO,state:'inflight'});f.setItem(c.LEGACY_CHECKLIST_HOLD_KEY,value);ok(c.hasLegacyChecklistHold(f));checks++;assert.throws(()=>legacyCalls(c,f));eq(f.getItem(c.LEGACY_CHECKLIST_HOLD_KEY),value);});
 await test('289-SR-02 actual legacy caller stores UNKNOWN across unmount and current GET',async()=>{const h=harness(false);await mount(h,async({dom,render,input,submit,ready,counts})=>{await render();await input(notes);h.s.loss='legacy-after';await submit();ok(h.cutover.hasLegacyChecklistHold(dom.window.localStorage));const before=[...Array(dom.window.localStorage.length)].map((_,i)=>dom.window.localStorage.getItem(dom.window.localStorage.key(i)));await render(A,false);await render(A,true);ok(h.cutover.hasLegacyChecklistHold(dom.window.localStorage));eq(ready(),false);eq(latest.ready,false);eq(counts.POST,1);eq(h.s.rows.size,0);eq(before,[...Array(dom.window.localStorage.length)].map((_,i)=>dom.window.localStorage.getItem(dom.window.localStorage.key(i))));});});
 await test('289-SR-02 actual legacy known original reply leaves no active hold and no receipt',async()=>{const h=harness(false);await mount(h,async({dom,render,input,submit,ready})=>{await render();await input(notes);await submit();eq(h.cutover.hasLegacyChecklistHold(dom.window.localStorage),false);eq(h.s.rows.size,0);eq(latest.receipt,null);eq(ready(),true);eq(h.counts(),[1,1,0,0]);});});
}
if(focused289){console.log(JSON.stringify({task:'282-1/289-corrections',result:probe289?(caseMatch?.source==='289-control'?'POSITIVE_CONTROL_PASS':'COUNTEREXAMPLES_REPRODUCED'):'PASS',cases,checks,evidence:'actual source/gate/client/Next handlers; modeled C03/Auth/storage interleaving, never native concurrency',SQL_DB_Auth_runtime:'NOT_RUN'}));process.exit(0);}

const sqlPath='supabase/operations-command/operations-command-v2.sql';
const sql=readFileSync(path.join(root,sqlPath),'utf8');
function sqlContract(source){
 const s=source.replace(/--[^\n]*/g,'');
 const body=s.split('as $command_v2$')[1]?.split('$command_v2$;')[0];assert.ok(body);
 assert.match(body,/begin\s+if current_setting\('transaction_isolation',true\) is distinct from 'read committed'/,'NULL-safe RC first guard');
 assert.match(body,/return app_private\.operations_command_v1\(p_phase,p_context_id,p_key,p_wire,p_fingerprint\)/,'actual existing v1 host delegation');
 assert.match(body,/v_open:=app_private\.operations_command_v1\('open',p_context_id,null,null,null\)/,'shared all-version discovery');
 for(const prefix of ['operations.actor.v1/','operations.resource.v1/','operations.command.v1/'])assert.ok(body.includes(prefix),'same namespace '+prefix);
 assert.match(body,/jsonb_build_object\('version',2,'authority_at_reservation',v_binding,'wire',p_wire\)/,'versioned exact C03 request hash');
 assert.match(body,/existing\.expires_at<=clock_timestamp\(\)/,'expiry stays a failure');
 assert.match(body,/v_binding-'authority_revision' is distinct from before_c-'authority_revision'/,'full original tuple');
 assert.match(body,/from maintenance\.work_order_checklist_items\s+where id=v_item and work_order_id=v_target and tenant_id=v_tenant for update/,'physical item/order/tenant lock');
 assert.match(body,/v_native:=maintenance\.work_order_checklist_v1\(p_context_id,v_target,v_item,d->>'notes'\)/,'real native mutation');
 assert.match(body,/'already_recorded',v_before\.completed/,'already flag from locked real row');
 const native=body.indexOf('v_native:='),audit=body.indexOf('insert into audit.events'),outbox=body.indexOf('insert into platform.outbox_events'),receipt=body.indexOf('v_receipt:=');
 assert.ok(native<audit&&audit<outbox&&outbox<receipt,'atomic effect order');
 for(const [a,b] of [[native,audit],[audit,outbox],[outbox,receipt]])assert.ok(body.slice(a,b).includes('app_private.operations_checkpoint_v1(p_context_id,e)'),'wait checkpoint before next effect');
 assert.match(body,/exception when sqlstate '22023' or sqlstate '40001' or sqlstate '42501' or sqlstate 'P0002'/,'bounded subtransaction rollback');
 assert.match(body,/v_error:=sqlstate;v_result:=null;v_audit:=null;v_outbox:=null/,'no failed success receipt');
 assert.match(body,/response_ref=jsonb_set\(response_ref-'running_xid','\{receipt\}',v_receipt\)/,'same private C03 frame/receipt');
 const read=s.split('as $read_only$')[1]?.split('$read_only$;')[0];assert.ok(read);assert.doesNotMatch(read,/\b(insert|update|delete|merge|execute)\b/i,'GET zero-write');
 assert.doesNotMatch(s,/\bcreate\s+table|alter\s+default\s+privileges|\bgrant\s+execute|\bwhen\s+others|\bcommit\s*;/i,'no store/ACL policy/catchall/activation');
 assert.match(s,/raise exception 'operations_checklist_v2_source_only' using errcode='55000'/,'source hold');
 assert.match(s,/pg_default_acl/);assert.match(s,/a\.grantee<>p\.proowner/);assert.match(s,/rollback;\s*$/i);
}
await test('bounded SQL text contracts, explicitly NOT compile or PG proof',()=>sqlContract(sql));
for(const [name,mutate] of [
 ['parallel namespace',s=>s.replaceAll('operations.command.v1/','operations.checklist.v2/')],
 ['missing original binding',s=>s.replace("v_binding-'authority_revision' is distinct from before_c-'authority_revision'",'false')],
 ['missing expiry',s=>s.replace('existing.expires_at<=clock_timestamp()','false')],
 ['cross-order item',s=>s.replace('where id=v_item and work_order_id=v_target and tenant_id=v_tenant for update','where id=v_item for update')],
 ['fake native provider',s=>s.replace('v_native:=maintenance.work_order_checklist_v1(p_context_id,v_target,v_item,d->>\'notes\')',"v_native:='{}'::jsonb")],
 ['forged already flag',s=>s.replace("'already_recorded',v_before.completed","'already_recorded',true")],
 ['missing post audit checkpoint',s=>{const a=s.indexOf('insert into audit.events'),b=s.indexOf('insert into platform.outbox_events');return s.slice(0,a)+s.slice(a,b).replace('app_private.operations_checkpoint_v1(p_context_id,e)','before_c')+s.slice(b);}],
 ['GET mutation',s=>s.replace("before_c:=app_private.operations_checkpoint_v1(p_context_id,e);\n select jsonb_build_object", "before_c:=app_private.operations_checkpoint_v1(p_context_id,e);\n update platform.idempotency_keys set status_code=200;\n select jsonb_build_object")],
 ['default mutation',s=>s.replace('rollback;','alter default privileges revoke execute on functions from public;\nrollback;')],
 ['active execute grant',s=>s.replace('rollback;','grant execute on function customer_api.operations_command_v2(text,uuid,uuid,text,text) to authenticated;\nrollback;')],
 ['unconditional success',s=>s.replace('v_error:=sqlstate;v_result:=null;v_audit:=null;v_outbox:=null','v_error:=null')],
 ['commit source',s=>s.replace('rollback;','commit;')]
])await test('coherently re-sealed SQL source mutant '+name,()=>{const changed=mutate(sql);ok(changed!==sql);const coherent={bytes:Buffer.byteLength(changed),sha256:sha(changed)};eq(coherent.sha256,sha(changed));checks++;assert.throws(()=>sqlContract(changed));});
await test('accepted277 exact summary projection remains private; no full receipt/context expansion',()=>{const gate=readFileSync(path.join(root,'src/components/customer/OperationsCommandGate.tsx'),'utf8');assert.match(gate,/const summary:OperationsReceiptSummary\|null=receipt\?\{action:receipt.action,outcome:receipt.outcome,recorded_at:receipt.recorded_at\}:null/);assert.match(gate,/receipt:summary/);checks+=2;});
await test('cutover proposal pauses four legacy entries and preserves private v1 implementation',()=>{const cut=readFileSync(path.join(root,'supabase/operations-command/checklist-cutover-proposal.sql'),'utf8').replace(/--[^\n]*/g,'');assert.match(cut,/raise exception 'checklist_cutover_requires_separate_execution_authorization_and_native_proof'/);for(const f of ['customer_api.work_order_checklist_v1','maintenance.work_order_checklist_v1','customer_api.operations_command_v1','app_private.operations_command_v1'])ok(cut.includes(f));eq((cut.match(/create or replace function/g)||[]).length,1);assert.match(cut,/create or replace function customer_api\.operations_command_v1/);assert.match(cut,/answer:=app_private.operations_command_v2\(p_phase,p_context_id,p_key,p_wire,p_fingerprint\)/);assert.match(cut,/operations_pending_version_requires_supported_client/);assert.doesNotMatch(cut,/\bgrant\s+execute|alter\s+default\s+privileges|\bcommit\s*;/i);assert.match(cut,/rollback;\s*$/i);checks+=5;});
await test('native proof source has actual C03 calls, privilege gates, injected audit fault and rollback cleanup (NOT_RUN)',()=>{const text=readFileSync(path.join(root,'supabase/tests/operations-checklist-command-v2.test.sql'),'utf8');for(const phase of ['reserve','execute','lookup','ack'])ok(text.includes(`app_private.operations_command_v2('${phase}'`));for(const s of ["has_table_privilege(current_user,'audit.events','TRIGGER')","has_schema_privilege(current_user,'app_private','CREATE')",'core282_proof_audit_fault_v1','a.grantee<>p.proowner','native_item_audit_outbox_not_atomic','rollback to checklist_success','rollback to checklist_audit_fault','checklist_proof_rollback_residue'])ok(text.includes(s));assert.match(text,/rollback;\s*$/i);checks++;});
await test('manifest identities, canonical dependency bodies and inactive bindings match final source',()=>{
 const packet=JSON.parse(readFileSync(path.join(root,'supabase/operations-command/checklist-v2.manifest.json'),'utf8'));
 for(const f of [...packet.source_identities_excluding_self,...packet.immutable_sources]){const bytes=readFileSync(path.join(root,f.path));eq(bytes.length,f.bytes);eq(sha(bytes),f.sha256);}
 for(const p of packet.canonical_helper_pins){const text=readFileSync(path.join(root,p.source),'utf8');const escaped=p.function.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const match=text.match(new RegExp('create\\s+(?:or\\s+replace\\s+)?function\\s+'+escaped+'\\([\\s\\S]*?\\bas\\s+(\\$[a-zA-Z0-9_]*\\$)([\\s\\S]*?)\\1','i'));ok(match,'pinned native helper body exists');eq(sha(match[2]),p.body_sha256);ok(sql.includes(p.body_sha256));}
 eq(packet.execution_authorized,false);eq(packet.runtime_bindings,{native:null,operator:null,fixture:null,activation:null});eq(packet.cutover.default_mode,'legacy');eq(packet.retention.technical_test_policy,'CLOSED_OWNER_POLICY_SCOPED_TEST_ONLY');eq(packet.retention.public_real_data,'OPEN');
});
console.log(JSON.stringify({task:'282-1',result:'PASS',cases,checks,evidence:'affected actual source/React/Next codecs + explicit fake Auth/C03/atomic model; SQL text only',SQL_parser_compile_execute:'NOT_RUN',DB_Auth_runtime:'NOT_RUN_NOT_PASS',cutover:'INACTIVE',retention:'TECHNICAL_TEST_ONLY_NO_AUTO_PURGE_CANCEL; PUBLIC_POLICY_OPEN'}));
