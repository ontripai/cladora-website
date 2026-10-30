// Release test adapter: real DOM constructors and bounded post-effect settlement; original assertions retained.
/** 260-3: real gate/client/codecs/Next routes; Auth and persistence are OFFLINE FAKES.
 * Never connects to a database or network. Checklist counterexamples are not PG evidence.
 */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {createHash,webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';

const root=process.cwd(),require=createRequire(path.join(root,'package.json')),ts=require('typescript');
const {NextRequest}=require('next/server');
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const A='80000000-0000-0000-0000-00000000000a',B='80000000-0000-0000-0000-00000000000b',C='80000000-0000-0000-0000-00000000000c';
const ACTOR='80000000-0000-0000-0000-000000000001',WS='80000000-0000-0000-0000-000000000002',WS2='80000000-0000-0000-0000-000000000003';
const TARGET='80000000-0000-0000-0000-000000000074',MEMBER='80000000-0000-0000-0000-000000000007',KEY='80000000-0000-0000-0000-000000000008',ITEM='80000000-0000-0000-0000-000000000009';
const DATE='2026-10-28T08:00:00Z',NOTES='Recorded inspection evidence';
let checks=0,state,latest;const scenarios=[],counterexamples=[];
const eq=(a,b,m)=>{checks++;assert.deepEqual(a,b,m);},ok=(v,m)=>{checks++;assert.ok(v,m);};
const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
function reset(){state={allow:{[A]:true,[B]:true,[C]:true},rows:[],trace:[],fault:null,wait:null,writes:0,audits:0,outbox:0,checklist:{completed:false,notes:null,at:null},checkCalls:[]};latest=null;}
function intent(action,context=A){
 const base={version:1,context_id:context,action,target_id:TARGET,expected_status:null,input:{context_id:context}};
 if(action==='save')base.input={action:'save',context_id:context,id:TARGET,revision:0,asset_id:MEMBER,vendor_id:MEMBER,name:'Inspection',anchor:'2026-10-28',unit:'months',every:1,enabled:true,checklist:['Inspect']};
 if(action==='generate')base.input={action:'generate',context_id:context,plan_id:TARGET,due_on:'2026-10-28'};
 if(action==='issue')base.expected_status='draft';
 if(action==='start')base.expected_status='assigned';
 if(action==='complete'){base.expected_status='in_progress';base.input.completion_notes=NOTES;}
 if(action==='verify'){base.expected_status='completed';base.input.verification_notes=NOTES;}
 return base;
}
function seed(action='issue',context=A,outcome='committed'){
 const p=intent(action,context),wire=JSON.stringify(p),env={key:KEY,wire,fingerprint:createHash('sha256').update(wire).digest('hex')};
 const result=action==='save'?{id:TARGET,revision:1}:action==='generate'?{id:TARGET,replayed:false,status:'draft',work_order_no:7}:action==='issue'?{id:TARGET,status:'assigned',vendor_id:MEMBER}:action==='start'?{id:TARGET,status:'in_progress',started_at:DATE}:action==='complete'?{id:TARGET,status:'completed',completed_at:DATE}:{id:TARGET,status:'verified',verified_at:DATE};
 const receipt=outcome==='pending'?null:{contract_version:'operations-command-receipt.v1',key:KEY,context_id:context,workspace_id:context===C?WS2:WS,actor_id:ACTOR,membership_id:MEMBER,authority_revision:1,request_hash:'a'.repeat(64),action,target_id:TARGET,fingerprint:env.fingerprint,outcome,result:outcome==='committed'?result:null,error_code:outcome==='rejected'?'42501':null,audit_event_id:outcome==='committed'?'1':null,outbox_event_id:outcome==='committed'?MEMBER:null,recorded_at:DATE};
 const row={env,receipt,ack:false};state.rows.push(row);if(outcome==='committed'){state.writes++;state.audits++;state.outbox++;}return row;
}
const denied=()=>({data:null,error:{code:'42501'}});
function checklistValue(){return {work_order_id:TARGET,status:'in_progress',items:[{id:ITEM,label:'Inspection',required:true,completed:state.checklist.completed,completed_at:state.checklist.at,notes:state.checklist.notes}]};}
async function rpc(name,p){
 if(name==='work_order_checklist_v1'){
  state.checkCalls.push(structuredClone(p));if(!state.allow[p.p_context_id])return denied();
  if(p.p_item_id!==null){
   if(state.checklist.completed&&state.checklist.notes!==p.p_notes)return {data:null,error:{code:'40001'}};
   if(!state.checklist.completed){state.checklist={completed:true,notes:p.p_notes,at:DATE};state.audits++;state.writes++;}
  }
  return {data:checklistValue(),error:null};
 }
 assert.equal(name,'operations_command_v1');state.trace.push(structuredClone(p));
 if(!state.allow[p.p_context_id])return denied();
 const answer=(context,status,command=null,receipt=null)=>({data:{version:1,actor_id:ACTOR,context_id:context,state:status,command,receipt},error:null});
 if(p.p_phase==='open'){
  const row=state.rows.find(r=>!r.ack);if(!row)return answer(p.p_context_id,'clear');
  const original=JSON.parse(row.env.wire).context_id;if(!state.allow[original])return denied();
  return answer(original,row.receipt?.outcome??'pending',row.env,row.receipt);
 }
 const env={key:p.p_key,wire:p.p_wire,fingerprint:p.p_fingerprint},original=JSON.parse(env.wire).context_id;
 assert.equal(p.p_context_id,original);assert.equal(env.fingerprint,createHash('sha256').update(env.wire).digest('hex'));
 const row=state.rows.find(r=>r.env.key===env.key);assert.ok(row,'Tests seed the real-shaped canonical command');assert.deepEqual(env,row.env);
 if(p.p_phase==='lookup'){
  const receipt=structuredClone(row.receipt);
  if(receipt&&state.fault==='receipt-actor')receipt.actor_id=MEMBER;
  if(receipt&&state.fault==='receipt-context')receipt.context_id=B;
  if(receipt&&state.fault==='receipt-result')receipt.result={id:TARGET,status:'verified'};
  return answer(original,receipt?.outcome??'pending',env,receipt);
 }
 if(p.p_phase==='ack'){
  assert.ok(row.receipt);row.ack=true;
  return answer(original,'acknowledged',env,state.fault==='ack-mismatch'?{...row.receipt,request_hash:'b'.repeat(64)}:row.receipt);
 }
 if(p.p_phase==='reserve')return answer(original,row.receipt?.outcome??'pending',env,row.receipt);
 assert.equal(p.p_phase,'execute');
 if(!row.receipt){const copy=seed(JSON.parse(env.wire).action,original);state.rows.pop();row.receipt=copy.receipt;}
 return answer(original,row.receipt.outcome,env,row.receipt);
}
const fakeClient={auth:{getClaims:async()=>({data:{claims:{sub:ACTOR}},error:null})},schema:()=>({rpc})};
function loader(sourceRoot){
 const cache=new Map();
 function load(relative){
  const file=path.resolve(sourceRoot,relative);if(cache.has(file))return cache.get(file).exports;
  const mod=new Module(file);cache.set(file,mod);mod.require=id=>{
   if(id==='server-only')return {};
   if(id==='@/lib/supabase/server')return {createClient:async()=>fakeClient};
   if(id.startsWith('.')||id.startsWith('@/')){
    const base=id.startsWith('@/')?path.join(sourceRoot,'src',id.slice(2)):path.resolve(path.dirname(file),id);
    const found=[base,base+'.ts',base+'.tsx'].find(p=>existsSync(p)&&statSync(p).isFile());if(found)return load(found);
   }
   return require(id);
  };
  mod._compile(ts.transpileModule(readFileSync(process.argv.includes('--probe-summary-preimage')&&relative==='src/components/customer/OperationsCommandGate.tsx'?path.resolve(root,'../procedure277-1-artifacts/preimages/src/components/customer/OperationsCommandGate.tsx'):file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
  return mod.exports;
 }
 return load;
}
const probe=process.argv.indexOf('--probe-preimage'),sourceRoot=probe>=0?path.resolve(process.argv[probe+1]):root,load=loader(sourceRoot);
const {operationsCommandPOST}=load('src/lib/customer/operations-command-server.ts');
const checklistRoute=load('src/app/api/customer/v1/work-orders/[id]/checklist/route.ts');
async function commandRequest(phase,context_id,command){
 return operationsCommandPOST(new NextRequest('https://cladora.test/api/customer/v1/operations/commands',{method:'POST',headers:{origin:'https://cladora.test','content-type':'application/json'},body:JSON.stringify({version:1,phase,context_id,command})}));
}
async function checklistRequest(method,body){
 const req=new NextRequest('https://cladora.test/api/customer/v1/work-orders/'+TARGET+'/checklist?context_id='+A,{method,...(method==='POST'?{headers:{origin:'https://cladora.test','content-type':'application/json'},body:JSON.stringify(body)}:{})});
 return checklistRoute[method](req,{params:Promise.resolve({id:TARGET})});
}
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
const {OperationsCommandGate,useOperationsCommands}=load('src/components/customer/OperationsCommandGate.tsx');
function Consumer(){latest=useOperationsCommands();return React.createElement('output',{'data-consumer':'receipt'},latest.receipt?.outcome??'none');}
// Enumerate the entire hook contract and the actual runtime payload, not its TS type.
function consumerValue(receipt){
 eq(Reflect.ownKeys(latest).sort(),['ready','receipt','send']);
 eq(typeof latest.ready,'boolean');eq(typeof latest.send,'function');
 const expected=receipt?{action:receipt.action,outcome:receipt.outcome,recorded_at:receipt.recorded_at}:null;
 eq(latest.receipt,expected);
 eq(JSON.parse(JSON.stringify(latest)),{ready:latest.ready,receipt:expected});
 if(expected){
  const value=latest.receipt;
  eq(Reflect.ownKeys(value).sort(),['action','outcome','recorded_at']);
  eq(Object.getPrototypeOf(value),Object.prototype);
  for(const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))){ok('value' in descriptor);eq(typeof descriptor.value,'string');}
  ok(value!==receipt,'Consumer gets a new object, never the canonical receipt');
 }
}
const tick=()=>new Promise(r=>setTimeout(r,0));
async function mounted(work,lang='en'){
 const dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test/'+lang+'/app/maintenance'}),old=new Map(),originalFetch=globalThis.fetch;
 for(const [k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,Event:dom.window.Event,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){old.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});}
 Object.defineProperty(dom.window.navigator,'locks',{value:{request:async(_n,_o,callback)=>callback({})},configurable:true});
 globalThis.fetch=async(url,options={})=>{
  if(url!=='/api/customer/v1/operations/commands')throw Error('Unexpected network attempt: '+url);
  const p=JSON.parse(options.body),r=await commandRequest(p.phase,p.context_id,p.command);
  const wait=state.wait;if(wait&&wait.phase===p.phase&&wait.context===p.context_id&&!wait.used){wait.used=true;await wait.promise;}
  return r;
 };
 const rr=createRoot(dom.window.document.getElementById('root'));
 const settle=async(predicate,message)=>{
  const deadline=performance.now()+2000;
  while(!predicate()&&performance.now()<deadline)await act(async()=>{await tick();});
  ok(predicate(),message);
 };
 const render=async(context,options={})=>{await act(async()=>{rr.render(React.createElement(OperationsCommandGate,{contextId:context,lang,...options},React.createElement(Consumer)));await tick();});for(let i=0;i<10;i++){if(state.wait?.used)break;await act(async()=>{await tick();});if(latest?.ready||!dom.window.document.querySelector('button[disabled]'))break;}};
 const storageEvent=async()=>act(async()=>{dom.window.dispatchEvent(new dom.window.StorageEvent('storage'));await tick();});
 try{await work({dom,render,storageEvent,rr,settle});}
 finally{await act(async()=>rr.unmount());globalThis.fetch=originalFetch;for(const [k,d]of old){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}dom.window.close();}
}

if(process.argv.includes('--probe-summary-preimage')){
 reset();seed();let keys;
 await mounted(async({render})=>{await render(A);ok(latest.ready);keys=Reflect.ownKeys(latest.receipt);ok(keys.includes('result')&&keys.includes('actor_id')&&keys.includes('fingerprint')&&keys.includes('audit_event_id'));});
 console.log(JSON.stringify({task:'277-1',result:'FULL_RECEIPT_DISCLOSURE_REPRODUCED',consumer_receipt_keys:keys,checks,transport:'FAKE_OFFLINE',runtime:'NOT_RUN_NOT_PASS'}));process.exit(0);
}

if(probe>=0){
 reset();const row=seed();let observed;
 await mounted(async({render})=>{await render(A);ok(latest.ready);observed=latest.receipt;});
 assert.equal(observed,undefined,'Predecessor probe must fail if the interface already exposes a receipt');
 console.log(JSON.stringify({task:'260-3',result:'COUNTEREXAMPLE_REPRODUCED',case:'Canonical receipt recovered and ACKed, ready=true, but consumer receipt is undefined',canonical_key:row.env.key,checks,provider:'FAKE_OFFLINE',runtime:'NOT_RUN_NOT_PASS'}));
 process.exit(0);
}

for(const action of ['save','generate','issue','start','complete','verify']){
 reset();const row=seed(action);
 await mounted(async({dom,render})=>{
  await render(A);ok(latest.ready);consumerValue(row.receipt);eq(state.writes,1);eq(state.audits,1);eq(state.outbox,1);
  ok(dom.window.document.querySelector('[aria-label="Command receipt history"]'));ok(dom.window.document.body.textContent.includes('historical command outcome'));
  eq(dom.window.localStorage.length,0);ok(state.trace.every(p=>!['reserve','execute'].includes(p.p_phase)));
 });scenarios.push('canonical-'+action+'-recovered-receipt-exposed-without-write');
}
reset();{
 const row=seed('issue',A,'rejected');
 await mounted(async({dom,render})=>{await render(A);consumerValue(row.receipt);eq(latest.receipt.outcome,'rejected');ok(!dom.window.document.querySelector('[aria-label="Command receipt history"]').textContent.includes('Committed'));eq(state.writes,0);});
 scenarios.push('canonical-rejection-is-historical-rejection-not-success');
}
reset();{
 seed();const hold=deferred();state.wait={phase:'ack',context:A,...hold};
 await mounted(async({render,dom,settle})=>{await render(A);ok(state.wait.used);eq(latest.ready,false);eq(latest.receipt,null);consumerValue(null);eq(dom.window.document.querySelector('[aria-label="Command receipt history"]'),null);await act(async()=>{hold.resolve();await tick();});await settle(()=>latest.ready,'exact ACK must settle the real client before admission');ok(latest.ready);ok(latest.receipt);consumerValue(state.rows[0].receipt);});
 scenarios.push('no-summary-before-exact-ACK');
}
for(const fault of ['receipt-actor','receipt-context','receipt-result','ack-mismatch']){
 reset();seed();state.fault=fault;
 await mounted(async({render,dom})=>{await render(A);eq(latest.ready,false);eq(latest.receipt,null);consumerValue(null);eq(dom.window.document.querySelector('[aria-label="Command receipt history"]'),null);eq(state.writes,1);ok(!state.trace.some(p=>p.p_phase==='execute'));});
 scenarios.push(fault+'-failclosed-no-local-success');
}
for(const phase of ['lookup','ack'])for(const next of [B,C]){
 reset();seed();const hold=deferred();state.wait={phase,context:A,...hold};
 await mounted(async({render,dom})=>{
  await render(A);ok(state.wait.used);state.rows[0].ack=true;
  await render(next);ok(latest.ready);eq(latest.receipt,null);consumerValue(null);
  await act(async()=>{hold.resolve();await tick();});eq(latest.receipt,null);consumerValue(null);ok(latest.ready);eq(dom.window.document.querySelector('[aria-label="Command receipt history"]'),null);
 });scenarios.push('unkeyed-Context-A-to-'+(next===B?'same-Workspace-B':'foreign-Workspace-C')+'-late-'+phase+'-A-isolated');
}
reset();{
 seed();await mounted(async({render,storageEvent,dom})=>{
  await render(A);ok(latest.receipt);consumerValue(state.rows[0].receipt);state.allow[A]=false;await storageEvent();eq(latest.ready,false);eq(latest.receipt,null);consumerValue(null);eq(dom.window.document.querySelector('[aria-label="Command receipt history"]'),null);eq(state.writes,1);
 });scenarios.push('current-denial-hides-historical-receipt-no-authority-inference');
}
reset();{
 seed();await mounted(async({render})=>{await render(B);ok(latest.ready);eq(latest.receipt,null);consumerValue(null);ok(state.trace.filter(p=>p.p_phase!=='open').every(p=>p.p_context_id===A));eq(state.writes,1);});
 scenarios.push('foreign-original-receipt-reconciles-under-A-without-B-summary');
}
reset();{
 seed('issue',A,'pending');await mounted(async({render})=>{await render(A);eq(latest.ready,false);eq(latest.receipt,null);consumerValue(null);eq(state.writes,0);ok(state.trace.every(p=>!['reserve','execute'].includes(p.p_phase)));});
 scenarios.push('UNKNOWN-pending-does-not-become-receipt-or-automatic-retry');
}
reset();{
 seed();await mounted(async({render})=>{await render(A);ok(latest.receipt);consumerValue(state.rows[0].receipt);});
 await mounted(async({render})=>{await render(A);ok(latest.ready);eq(latest.receipt,null);consumerValue(null);eq(state.writes,1);});
 scenarios.push('storage-empty-remount-cannot-synthesize-previously-ACKed-receipt');
}
for(const lang of ['ro','fa']){reset();seed();await mounted(async({render,dom})=>{await render(A);ok(latest.receipt);consumerValue(state.rows[0].receipt);ok(dom.window.document.querySelector('time[datetime="'+DATE+'"]'));});scenarios.push(lang+'-historical-summary');}

// Consumer mutation cannot affect the private canonical receipt or the next publication.
reset();{
 const row=seed();await mounted(async({render,dom})=>{
  await render(A);consumerValue(row.receipt);const before=latest.receipt,trace=state.trace.length;
  before.action='start';before.outcome='rejected';before.recorded_at='2099-01-01T00:00:00Z';
  await render(A,{lang:'ro'});consumerValue(row.receipt);ok(latest.receipt!==before,'Every projection is newly allocated');
  eq(state.trace.length,trace,'Rerender does not repeat lookup/ACK or current-state reads');
  ok(dom.window.document.body.textContent.includes(DATE));ok(!dom.window.document.body.textContent.includes('2099-01-01'));
 });scenarios.push('new-primitive-summary-isolated-from-private-receipt');
}
if(process.argv.includes('--receipt-only')){
 console.log(JSON.stringify({task:'277-1',result:'RECEIPT_SUMMARY_MOUNTED_PASS',checks,scenarios,consumer_keys:['ready','receipt','send'],summary_keys:['action','outcome','recorded_at'],transport:'FAKE_OFFLINE',runtime:'NOT_RUN_NOT_PASS'},null,2));process.exit(0);
}

// Actual Next route has item/body semantics, not a durable command identity.
reset();{
 const response=await checklistRequest('POST',{context_id:A,item_id:ITEM,notes:NOTES});eq(response.status,200);const committed=await response.json();
 eq(Object.keys(state.checkCalls[0]).sort(),['p_context_id','p_item_id','p_notes','p_work_order_id']);ok(!('receipt'in committed)&&!('key'in committed));
 const again=await checklistRequest('POST',{context_id:A,item_id:ITEM,notes:NOTES});eq(again.status,200);eq(state.writes,1);eq(state.audits,1);
 const changed=await checklistRequest('POST',{context_id:A,item_id:ITEM,notes:'Different inspection notes'});eq(changed.status,409);
 const invented=await checklistRequest('POST',{context_id:A,item_id:ITEM,notes:NOTES,key:KEY});eq(invented.status,400);
 scenarios.push('checklist-real-route-ABI-does-not-accept-invented-command-key');
}
reset();{
 // H1: this POST committed, response lost. H2: this POST never arrived, another actor
 // wrote the same notes. Existing GET omits completed_by/command identity in both.
 await checklistRequest('POST',{context_id:A,item_id:ITEM,notes:NOTES});const h1=await (await checklistRequest('GET')).json();
 reset();state.checklist={completed:true,notes:NOTES,at:DATE};const h2=await (await checklistRequest('GET')).json();eq(h1,h2);
 counterexamples.push({id:'CHK-GET-NONPROOF',witness:'Two histories with different outcomes for this POST produce byte-equivalent route JSON; current GET cannot prove the command',model:'Explicit offline persistence fake constrained by actual route and canonical SQL projection'});
}
{
 const {WorkOrderChecklistPanel}=load('src/components/customer/WorkOrderChecklistPanel.tsx');reset();
 const dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test/en/app/maintenance'}),old=new Map(),oldFetch=globalThis.fetch;
 for(const [k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,Event:dom.window.Event,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){old.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});}
 let ready=false;const onReady=v=>{ready=v;},rr=createRoot(dom.window.document.getElementById('root'));
 globalThis.fetch=async(_url,options={})=>{if(options.method==='POST'){await checklistRequest('POST',JSON.parse(options.body));throw Error('simulated_lost_ACK');}return checklistRequest('GET');};
 const panel=key=>React.createElement(WorkOrderChecklistPanel,{key,contextId:A,workOrderId:TARGET,lang:'en',onReady});
 try{
  await act(async()=>{rr.render(panel('first'));await tick();});
  await act(async()=>{const input=dom.window.document.querySelector('textarea');Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(input,NOTES);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
  // React's input adapter can vary when react-dom was imported before this document.
  // Use the real element's React onChange prop, preserving its actual event/body path.
  const input=dom.window.document.querySelector('textarea'),props=Object.keys(input).find(k=>k.startsWith('__reactProps$'));
  await act(async()=>{input[props].onChange({target:{value:NOTES}});});
  await act(async()=>{dom.window.document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await tick();});
  ok(dom.window.document.body.textContent.includes('outcome is unknown'));eq(ready,false);eq(state.writes,1);
  const observe=[...dom.window.document.querySelectorAll('button')].find(b=>b.textContent==='Observe current checklist');
  await act(async()=>{observe.click();await tick();});ok(dom.window.document.body.textContent.includes('outcome is unknown'));eq(ready,false);eq(state.writes,1);
  await act(async()=>{rr.render(panel('remount'));await tick();});ok(!dom.window.document.body.textContent.includes('outcome is unknown'));eq(ready,true);eq(state.writes,1);
  counterexamples.push({id:'CHK-REMOUNT-UNKNOWN',witness:'Actual unchanged checklist panel retains UNKNOWN across GET, but remount loses in-memory attempt and can report current checklist ready',status:'OPEN_DESIGN_DEPENDENCY_NOT_FIXED_NOT_APPROVED'});
 }finally{await act(async()=>rr.unmount());globalThis.fetch=oldFetch;for(const [k,d]of old){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}dom.window.close();}
}
console.log(JSON.stringify({task:'260-3',result:'SOURCE_DELTA_PASS_WITH_EXPLICIT_CHECKLIST_DESIGN_DEPENDENCY',checks,scenarios,counterexamples,real_source:'React gate/client/canonical validators/Next command and checklist routes/unchanged checklist panel',Auth_C03_persistence:'FAKE_EXPLICIT_OFFLINE_ONLY',SQL_PG_Auth_browser_staging:'NOT_RUN_NOT_PASS'},null,2));
