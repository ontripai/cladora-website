/** 236-1: real codec/client/Next handler/gate; Auth/C03 persistence are explicit OFFLINE FAKES. No SQL/DB/network. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import Module,{createRequire} from 'node:module';
import path from 'node:path';
import {createHash,webcrypto} from 'node:crypto';
import {JSDOM} from 'jsdom';
const root=process.cwd(),require=createRequire(path.join(root,'package.json')),ts=require('typescript');
const {NextRequest}=require('next/server');
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const A='80000000-0000-0000-0000-00000000000a',B='80000000-0000-0000-0000-00000000000b',ACTOR='80000000-0000-0000-0000-000000000001',WS='80000000-0000-0000-0000-000000000002',TARGET='80000000-0000-0000-0000-000000000074',MEMBER='80000000-0000-0000-0000-000000000007';
const intent={version:1,context_id:A,action:'issue',target_id:TARGET,expected_status:'draft',input:{context_id:A}};
let state,checks=0;const eq=(a,b,m)=>{checks++;assert.deepEqual(a,b,m);},ok=(v,m)=>{checks++;assert.ok(v,m);};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};};
const key=c=>`cladora.operations.command.v1:${ACTOR}:${c}`;
function reset(){state={rows:new Map(),allow:{[A]:true,[B]:true},trace:[],authority:[],counts:[0,0,0],loss:null,mislabeled:false};}
const denied=()=>({data:null,error:{code:'42501',message:'bounded_denial'}});
async function rpc(_name,p){
 assert.equal(_name,'operations_command_v1');state.trace.push(structuredClone(p));
 const auth=c=>{state.authority.push(c);return state.allow[c]===true;};
 if(!auth(p.p_context_id))return denied();
 const answer=(ctx,status,command=null,receipt=null)=>({data:{version:1,actor_id:ACTOR,context_id:ctx,state:status,command,receipt},error:null});
 if(p.p_phase==='open'){
  const pending=[...state.rows.values()].find(r=>!r.ack);
  if(!pending)return answer(p.p_context_id,'clear');
  const original=JSON.parse(pending.command.wire).context_id;if(!auth(original))return denied();
  return answer(state.mislabeled?p.p_context_id:original,pending.receipt?.outcome??'pending',pending.command,pending.receipt);
 }
 const command={key:p.p_key,wire:p.p_wire,fingerprint:p.p_fingerprint},parsed=JSON.parse(p.p_wire);assert.equal(parsed.context_id,p.p_context_id,'real route must never dispatch wireA with ContextB');
 assert.equal(command.fingerprint,createHash('sha256').update(command.wire).digest('hex'));
 let r=state.rows.get(command.key);
 if(r&&JSON.stringify(r.command)!==JSON.stringify(command))return {data:null,error:{code:'40001'}};
 if(p.p_phase==='lookup')return answer(p.p_context_id,r?r.receipt?.outcome??'pending':'absent',command,r?.receipt??null);
 if(p.p_phase==='reserve'){
  if([...state.rows.values()].some(x=>!x.ack&&x.command.key!==command.key))return {data:null,error:{code:'40001'}};
  if(!r){r={command,receipt:null,ack:false};state.rows.set(command.key,r);}
  if(state.loss==='reserve'){state.loss=null;return {data:null,error:{code:'08006'}};}
  return answer(p.p_context_id,r.receipt?.outcome??'pending',command,r.receipt);
 }
 assert.ok(r,'reserve required');
 if(p.p_phase==='ack'){assert.ok(r.receipt);r.ack=true;return answer(p.p_context_id,'acknowledged',command,r.receipt);}
 if(!r.receipt){
  state.counts=state.counts.map(x=>x+1);
  r.receipt={contract_version:'operations-command-receipt.v1',key:command.key,context_id:p.p_context_id,workspace_id:WS,actor_id:ACTOR,membership_id:MEMBER,authority_revision:1,request_hash:'a'.repeat(64),action:'issue',target_id:TARGET,fingerprint:command.fingerprint,outcome:'committed',result:{id:TARGET,status:'assigned',vendor_id:MEMBER},error_code:null,audit_event_id:'1',outbox_event_id:MEMBER,recorded_at:'2026-10-28T08:00:00Z'};
 }
 if(state.loss==='execute'){state.loss=null;return {data:null,error:{code:'08006'}};}
 return answer(p.p_context_id,'committed',command,r.receipt);
}
const client={auth:{getClaims:async()=>({data:{claims:{sub:ACTOR}},error:null})},schema:()=>({rpc})};
const cache=new Map();function load(relative){
 const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;
 const mod=new Module(file);cache.set(file,mod);mod.require=id=>{
  if(id==='server-only')return {};
  if(id==='@/lib/supabase/server')return {createClient:async()=>client};
  if(id.startsWith('.')||id.startsWith('@/')){const base=id.startsWith('@/')?path.join(root,'src',id.slice(2)):path.resolve(path.dirname(file),id);const found=[base,base+'.ts',base+'.tsx'].find(p=>existsSync(p)&&statSync(p).isFile());if(found)return load(found);}
  return require(id);
 };mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);return mod.exports;
}
const {operationsCommandPOST}=load('src/lib/customer/operations-command-server.ts');
const {createOperationsCommandClient}=load('src/lib/customer/operations-command-client.ts');
async function request(phase,context_id,command){
 return operationsCommandPOST(new NextRequest('https://cladora.test/api/customer/v1/operations/commands',{method:'POST',headers:{origin:'https://cladora.test','content-type':'application/json'},body:JSON.stringify({version:1,phase,context_id,command})}));
}
const transport=async(...args)=>{const r=await request(...args);if(!r.ok)throw Error('bounded_'+r.status);return r.json();};
const exclusive=async(_name,work)=>work();
const make=(context,s)=>createOperationsCommandClient(context,s,transport,exclusive,()=>{});
async function seed(loss){const s=storage(),a=make(A,s);await a.reconcile();state.loss=loss;await assert.rejects(()=>a.execute(intent),/bounded_503/);return {s,a,env:[...state.rows.values()][0].command};}
const scenarios=[];
reset();{
 const {env}=await seed('reserve'),device=storage(),b=make(B,device);await b.reconcile();
 eq(b.getState().recoveryContext,A);eq(b.getState().ready,false);eq(device.getItem(key(B)),null);eq(JSON.parse(device.getItem(key(A))),env);eq(state.counts,[0,0,0]);
 await assert.rejects(()=>b.retryExact(),/return_to_original_context/);await assert.rejects(()=>b.execute({...intent,context_id:B,input:{context_id:B}}),/reconcile_first/);eq(state.rows.size,1);
 const a=make(A,device);await a.reconcile();await a.retryExact();eq(state.counts,[1,1,1]);eq(state.rows.size,1);eq(device.map.size,0);await b.reconcile();eq(b.getState().ready,true);
 ok(state.trace.filter(x=>x.p_phase!=='open').every(x=>x.p_context_id===A));
 scenarios.push('pending-A-discovered-from-B-new-device-return-to-A-exact-retry');
}
reset();{
 const {env}=await seed('execute'),device=storage(),b=make(B,device);await b.reconcile();eq(b.getState().ready,true);eq(device.map.size,0);eq(state.counts,[1,1,1]);
 const actions=state.trace.filter(x=>x.p_phase!=='open');ok(actions.every(x=>x.p_context_id===A));ok(actions.some(x=>x.p_phase==='ack'));
 await transport('execute',A,env);eq(state.counts,[1,1,1]);eq(state.rows.size,1);
 scenarios.push('terminal-A-receipt-reconciled-with-A-then-fresh-OPEN-B-no-duplicate');
}
for(const loss of ['reserve','execute']){reset();const {env}=await seed(loss);state.allow[A]=false;const response=await request('open',B,null),text=await response.text();eq(response.status,403);ok(!text.includes(env.wire)&&!text.includes('fingerprint')&&!text.includes('receipt'));
 const s=storage(),b=make(B,s);await assert.rejects(()=>b.reconcile(),/bounded_403/);eq(s.map.size,0);eq(b.getState().ready,false);eq(state.counts,loss==='execute'?[1,1,1]:[0,0,0]);
 state.allow[A]=true;await b.reconcile();eq(state.rows.size,1);scenarios.push(loss+'-original-Context-revoked-bounded-no-wire-then-restored');}
reset();{
 const {env}=await seed('reserve');state.mislabeled=true;const response=await request('open',B,null);eq(response.status,503);ok(!(await response.text()).includes(env.wire));
 const s=storage(),b=make(B,s);await assert.rejects(()=>b.reconcile(),/bounded_503/);eq(s.map.size,0);eq(state.counts,[0,0,0]);
 const wrong=await request('lookup',B,env);eq(wrong.status,409);eq(state.rows.size,1);scenarios.push('mislabeled-answer-and-A-wire-under-B-route-rejected');
}
reset();{
 const {env}=await seed('reserve'),s=storage();s.setItem(key(B),JSON.stringify(env));const b=make(B,s);await assert.rejects(()=>b.reconcile(),/storage_context/);eq(s.getItem(key(B)),JSON.stringify(env));eq(state.counts,[0,0,0]);scenarios.push('predecessor-misbound-storage-held-without-repair-or-new-key');
}
// Actual mounted gate: a late CLEAR response from old A must not reopen B's pending gate.
reset();{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test/en/app/maintenance'}),saved=new Map();
 for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})){
  saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 }
 const previousFetch=globalThis.fetch;let release,held=false,block=true;const barrier=new Promise(r=>{release=r;});
 globalThis.fetch=async(_url,options)=>{const p=JSON.parse(options.body),r=await request(p.phase,p.context_id,p.command);if(block&&p.phase==='open'&&p.context_id===A){block=false;held=true;await barrier;}return r;};
 Object.defineProperty(dom.window.navigator,'locks',{value:{request:async(_name,_options,callback)=>callback({})},configurable:true});
 const React=require('react'),{act}=React,{createRoot}=require('react-dom/client'),{OperationsCommandGate,useOperationsCommands}=load('src/components/customer/OperationsCommandGate.tsx');let ready;
 function Consumer(){ready=useOperationsCommands().ready;return React.createElement('output',null,String(ready));}
 const root=createRoot(dom.window.document.getElementById('root'));
 const render=c=>React.createElement(OperationsCommandGate,{key:c,contextId:c,lang:'en'},React.createElement(Consumer));
 try{
  await act(async()=>{root.render(render(A));});ok(held);await seed('reserve');
  await act(async()=>{root.render(render(B));});await act(async()=>{await new Promise(r=>setTimeout(r,0));});eq(ready,false);
  let link=dom.window.document.querySelector('a');ok(link?.href.endsWith('?context='+A));eq(dom.window.localStorage.getItem(key(B)),null);
  await act(async()=>{release();await new Promise(r=>setTimeout(r,0));});eq(ready,false);link=dom.window.document.querySelector('a');ok(link?.href.endsWith('?context='+A));
  ok(![...dom.window.document.querySelectorAll('button')].some(b=>b.textContent.includes('Retry exact')));eq(state.counts,[0,0,0]);eq(state.rows.size,1);
  scenarios.push('mounted-Context-switch-late-A-CLEAR-cannot-open-B-or-relabel-storage');
 }finally{await act(async()=>root.unmount());globalThis.fetch=previousFetch;for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}dom.window.close();}
}
console.log(JSON.stringify({task:'236-1',result:'PASS',checks,scenarios,real_source:'codec/client/Next handler/React gate',Auth_C03_persistence:'FAKE_EXPLICIT_OFFLINE_ONLY',PG_SQL_provider_runtime:'NOT_RUN_NOT_PASS'},null,2));
