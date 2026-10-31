/** Operations234-1: mounted real UI -> real Next handlers -> explicitly fake RPC transport.
 * No database, issued Auth, network, SQL parser/compiler, or backend acceptance claim. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'package.json'));
const ACTOR='80000000-0000-0000-0000-000000000001',WORKSPACE='80000000-0000-0000-0000-000000000002';
const CTX='80000000-0000-0000-0000-000000000004',REVIEW_CTX='80000000-0000-0000-0000-000000000005';
const FOREIGN='80000000-0000-0000-0000-000000000099',ASSET='80000000-0000-0000-0000-000000000006';
const VENDOR='80000000-0000-0000-0000-000000000007',ORDER='80000000-0000-0000-0000-000000000074';
const ITEM='80000000-0000-0000-0000-000000000008',TIME='2026-10-26T10:00:00Z';
const dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test/en/app/maintenance'});
const saved=new Map(),originalFetch=globalThis.fetch;
for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,FormData:dom.window.FormData,IS_REACT_ACT_ENVIRONMENT:true})){
 saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
}
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client'),{NextRequest}=require('next/server');
let state,context,mounted,checks=0;
const trace=[],results=[];
const ok=(condition,message)=>{checks++;assert.ok(condition,message);};
const eq=(actual,expected,message)=>{checks++;assert.deepEqual(actual,expected,message);};
const denied=message=>({data:null,error:{code:'42501',message}});
const clone=v=>structuredClone(v);
async function rpc(name,p){
 trace.push({rpc:name,params:clone(p),actor:state.actor});
 if(![CTX,REVIEW_CTX].includes(p.p_context_id))return denied('scope_violation');
 if(state.aal==='aal1'&&!['get_maintenance_v1','list_calendar_plans_v1'].includes(name))return denied('mfa_required');
 if(state.delay?.name===name)await state.delay.promise;
 if(name==='operations_command_v1')return operationsRPC(p);
 if(name==='list_calendar_plans_v1')return {data:{plans:clone(state.plans),assets:[{id:ASSET,name:'Fixture elevator A',asset_code:'LIFT-A',category_code:'elevator'}],vendors:[{id:VENDOR,name:'Approved fixture contractor'}]},error:null};
 if(name==='save_calendar_plan_v1'){
  const existing=state.plans.find(x=>x.id===p.p_id);
  if(existing&&existing.revision!==p.p_revision)return {data:null,error:{code:'40001',message:'revision_conflict'}};
  const plan={id:p.p_id,revision:p.p_revision+1,name:p.p_name,asset_id:p.p_asset_id,asset_name:'Fixture elevator A',vendor_id:p.p_vendor_id,vendor_name:'Approved fixture contractor',calendar_anchor:p.p_anchor,calendar_unit:p.p_unit,calendar_every:p.p_every,calendar_enabled:p.p_enabled,next_due_on:p.p_anchor,checklist_template:p.p_checklist,history:existing?.history??[]};
  if(existing)Object.assign(existing,plan);else state.plans.push(plan);
  return {data:state.partialSave?{id:p.p_id}:{id:p.p_id,revision:plan.revision},error:null};
 }
 if(name==='generate_calendar_order_v1'){
  const plan=state.plans.find(x=>x.id===p.p_plan_id);assert.ok(plan);
  const existing=plan.history.find(x=>x.due_on===p.p_due_on);
  if(existing)return {data:{id:existing.work_order_id,replayed:true},error:null};
  state.order={id:ORDER,title:plan.name,work_order_no:74,status:'draft',vendor_name:plan.vendor_name,started_at:null,completed_at:null,verified_at:null,completion_summary:null,cost_totals:{},created_at:TIME,priority:'normal'};
  state.items=plan.checklist_template.map((label,i)=>({id:i?`80000000-0000-0000-0000-${String(i+8).padStart(12,'0')}`:ITEM,label,required:true,completed:false,completed_at:null,notes:null}));
  plan.history.push({due_on:p.p_due_on,work_order_id:ORDER,work_order_no:74,status:'draft'});plan.revision++;plan.next_due_on='2027-01-01';
  return {data:{id:ORDER,work_order_no:74,status:'draft',replayed:false},error:null};
 }
 if(name==='get_maintenance_v1'){
  // The new order is deliberately outside the bounded list page. Exact-ID reads remain authorized.
  const rows=p.p_id===ORDER&&state.order?[clone(state.order)]:[];
  const value={context:{id:p.p_context_id},view:p.p_view,rows,detail:p.p_id?rows[0]??null:null,total:rows.length,summary:{assets:1,open_work_orders:state.order?.status==='verified'?0:1,overdue:0,cost_total:{}},read_only:true,generated_at:TIME,limit:p.p_limit,offset:p.p_offset};
  if(state.readFault==='foreign')value.context.id=FOREIGN;
  if(state.readFault==='partial')return {data:{rows},error:null};
  return {data:value,error:null};
 }
 if(name==='work_order_checklist_v1'){
  if(p.p_item_id){const item=state.items.find(x=>x.id===p.p_item_id);assert.ok(item);Object.assign(item,{completed:true,completed_at:TIME,notes:p.p_notes});}
  return {data:{work_order_id:ORDER,status:state.order.status,items:clone(state.items)},error:null};
 }
 const action={issue_work_order_v1:'issue',start_work_order_v1:'start',complete_work_order_v1:'complete',verify_work_order_v1:'verify'}[name];
 assert.ok(action,`Unexpected RPC ${name}`);assert.equal(p.p_work_order_id,ORDER);
 if(action==='verify'&&state.actor!=='authorized-verifier')return denied('maintenance_permission_required');
 const next={issue:'assigned',start:'in_progress',complete:'completed',verify:'verified'}[action];
 if(action==='complete')assert.ok(state.items.every(i=>!i.required||i.completed));
 Object.assign(state.order,{status:next,...(action==='start'?{started_at:TIME}:{}),...(action==='complete'?{completed_at:TIME,completion_summary:p.p_completion_notes}:{}),...(action==='verify'?{verified_at:TIME}:{})});
 for(const plan of state.plans)for(const h of plan.history)h.status=next;
 return {data:{id:ORDER,status:next,...(action==='issue'?{vendor_id:VENDOR}:{[action==='start'?'started_at':action==='complete'?'completed_at':'verified_at']:TIME})},error:null};
}
const client={auth:{getClaims:async()=>{trace.push({auth:'getClaims'});return state.auth?{data:{claims:{sub:ACTOR,aal:state.aal}},error:null}:{data:null,error:{code:'UNAUTHORIZED'}};}},schema:name=>{assert.equal(name,'customer_api');return {rpc};}};

Object.defineProperty(dom.window.navigator,'locks',{value:{request:async(_name,_options,callback)=>callback({name:_name})},configurable:true});
async function operationsRPC(p){
 const answer=(stateName,command=null,receipt=null)=>({data:{version:1,actor_id:ACTOR,context_id:p.p_context_id,state:stateName,command,receipt},error:null});
 if(p.p_phase==='open'){const pending=[...state.commands.values()].find(x=>!x.ack);return pending?answer(pending.receipt?.outcome??'pending',pending.command,pending.receipt):answer('clear');}
 const command={key:p.p_key,wire:p.p_wire,fingerprint:p.p_fingerprint},intent=JSON.parse(p.p_wire),input=intent.input;if(intent.action==='verify'&&state.actor!=='authorized-verifier')return denied('maintenance_permission_required');let r=state.commands.get(p.p_key);
 if(r&&JSON.stringify(r.command)!==JSON.stringify(command))return {data:null,error:{code:'40001'}};
 if(p.p_phase==='lookup')return answer(r?r.receipt?.outcome??'pending':'absent',command,r?.receipt??null);
 if(p.p_phase==='reserve'){if(!r){r={command,receipt:null,ack:false};state.commands.set(p.p_key,r);}return answer(r.receipt?.outcome??'pending',command,r.receipt);}
 if(p.p_phase==='ack'){assert.ok(r.receipt);r.ack=true;return answer('acknowledged',command,r.receipt);}
 if(!r.receipt){
  const name=intent.action==='save'?'save_calendar_plan_v1':intent.action==='generate'?'generate_calendar_order_v1':intent.action+'_work_order_v1';
  const params=intent.action==='save'?{p_context_id:input.context_id,p_id:input.id,p_revision:input.revision,p_asset_id:input.asset_id,p_vendor_id:input.vendor_id,p_name:input.name,p_anchor:input.anchor,p_unit:input.unit,p_every:input.every,p_enabled:input.enabled,p_checklist:input.checklist}:intent.action==='generate'?{p_context_id:input.context_id,p_plan_id:input.plan_id,p_due_on:input.due_on}:{p_context_id:input.context_id,p_work_order_id:intent.target_id,p_notes:input.notes??null,p_completion_notes:input.completion_notes,p_actual_cost:input.actual_cost??null,p_verification_notes:input.verification_notes,p_vendor_id:input.vendor_id??null};
  const result=await rpc(name,params);
  r.receipt={contract_version:'operations-command-receipt.v1',key:p.p_key,context_id:p.p_context_id,workspace_id:WORKSPACE,actor_id:ACTOR,membership_id:VENDOR,authority_revision:1,request_hash:'a'.repeat(64),action:intent.action,target_id:intent.target_id,fingerprint:p.p_fingerprint,outcome:result.error?'rejected':'committed',result:result.error?null:result.data,error_code:result.error?'42501':null,audit_event_id:result.error?null:'1',outbox_event_id:result.error?null:ITEM,recorded_at:TIME};
 }
 return answer(r.receipt.outcome,command,r.receipt);
}

const cache=new Map();
function load(relative){
 const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;
 const mod=new Module(file);cache.set(file,mod);
 mod.require=id=>{
  if(id==='server-only')return {};
  if(id==='@/lib/supabase/server')return {createClient:async()=>client};
  if(id==='./CustomerContextProvider'||id==='@/components/customer/CustomerContextProvider')return {useCustomerContext:()=>context};
  if(id==='next/link')return {__esModule:true,default:({href,children,...props})=>React.createElement('a',{href,...props},children)};
  if(id==='next/navigation')return {notFound:()=>{throw Error('NOT_FOUND');}};
  if(id.startsWith('@/')||id.startsWith('.')){
   const base=id.startsWith('@/')?path.join(root,'src',id.slice(2)):path.resolve(path.dirname(file),id);
   const target=[base,base+'.ts',base+'.tsx',path.join(base,'index.ts')].find(p=>existsSync(p)&&statSync(p).isFile());
   if(target&&/\.[cm]?[jt]sx?$/.test(target))return load(path.relative(root,target));
  }
  return require(id);
 };
 mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,file);
 return mod.exports;
}
const dashboard=load('src/components/customer/CustomerMaintenanceDashboard.tsx').CustomerMaintenanceDashboard;
const page=load('src/app/[lang]/app/maintenance/page.tsx').default;
const api={commands:load('src/app/api/customer/v1/operations/commands/route.ts'),maintenance:load('src/app/api/customer/v1/maintenance/route.ts'),plans:load('src/app/api/customer/v1/maintenance-plans/route.ts')};
for(const action of ['issue','start','complete','verify','checklist'])api[action]=load(`src/app/api/customer/v1/work-orders/[id]/${action}/route.ts`);
async function dispatch(url,options={}){
 const u=new URL(url,'https://cladora.test');const headers=new Headers(options.headers);headers.set('Origin',options.origin??'https://cladora.test');
 const request=new NextRequest(u,{method:options.method??'GET',headers,...(options.body?{body:options.body}:{}),signal:options.signal});
 const match=/\/work-orders\/([^/]+)\/([^/]+)$/.exec(u.pathname);
 const route=u.pathname.endsWith('/operations/commands')?api.commands:u.pathname.endsWith('/maintenance-plans')?api.plans:u.pathname.endsWith('/maintenance')?api.maintenance:api[match?.[2]];
 assert.ok(route,`Unexpected real handler ${u.pathname}`);
 return route[options.method??'GET'](request,{params:Promise.resolve({id:match?.[1]})});
}
globalThis.fetch=async(url,options={})=>{
 trace.push({url:String(url),method:options.method??'GET',wire:options.body??null});
 const answer=await dispatch(url,options);
 if(state.lostAction&&String(url).endsWith('/operations/commands')&&options.method==='POST'){const b=JSON.parse(options.body);if(b.phase==='execute'&&JSON.parse(b.command.wire).action===state.lostAction)throw Error('controlled lost response after mocked backend effect');}
 return answer;
};
const flush=async(ms=0)=>act(async()=>{if(ms)await new Promise(resolve=>setTimeout(resolve,ms));else for(let i=0;i<12;i++)await Promise.resolve();});
const button=text=>[...document.querySelectorAll('button')].find(n=>!n.closest('[hidden]')&&(n.textContent===text||n.getAttribute('aria-label')===text));
const click=async text=>{const node=button(text);ok(node,`Visible button: ${text}`);await act(async()=>node.click());await flush();};
const change=async(node,value)=>{ok(node,'Form field exists');await act(async()=>{const proto=node.tagName==='SELECT'?dom.window.HTMLSelectElement.prototype:node.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(node,value);node.dispatchEvent(new dom.window.Event(node.tagName==='SELECT'?'change':'input',{bubbles:true}));});};
const submit=async(form)=>{ok(form,'Real mounted form exists');await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));await flush(40);};
const formFor=text=>button(text)?.closest('form');
function currentContext(id=CTX){return {active:{context_id:id,membership_id:VENDOR,role_code:'operator',scope_type:'building',context_label:'Fixture building A'},dashboard:{contextId:id},loading:false,error:null};}
async function reset(){
 if(mounted)await act(async()=>mounted.unmount());mounted=createRoot(document.getElementById('root'));
 state={auth:true,actor:'operator',aal:'aal2',plans:[],items:[],order:null,commands:new Map()};context=currentContext();dom.window.localStorage.clear();trace.length=0;
}
async function render(props={}){await act(async()=>mounted.render(React.createElement(dashboard,{lang:'en',initialView:'plans',...props})));await flush(240);}
async function savePlan(){
 await change(document.querySelector('select').value===undefined?null:[...document.querySelectorAll('select')].find(n=>n.required&&!n.name),ASSET);
 const preset=[...document.querySelectorAll('select')].find(n=>!n.name&&!n.required);if(preset)await change(preset,'');
 await change(document.querySelector('input[name="name"]'),'Fixture elevator inspection');
 await change(document.querySelector('select[name="vendor"]'),VENDOR);
 await change(document.querySelector('input[name="anchor"]'),'2026-01-01');
 await change(document.querySelector('textarea[name="checklist"]'),'Inspect safety equipment');
 await submit(formFor('Save plan'));
}
async function seededOrder(){
 state.plans=[{id:'80000000-0000-0000-0000-000000000010',revision:2,name:'Fixture elevator inspection',asset_id:ASSET,asset_name:'Fixture elevator A',vendor_id:VENDOR,vendor_name:'Approved fixture contractor',calendar_anchor:'2026-01-01',calendar_unit:'months',calendar_every:1,calendar_enabled:true,next_due_on:'2027-01-01',checklist_template:['Inspect safety equipment'],history:[{due_on:'2026-01-01',work_order_id:ORDER,work_order_no:74,status:'draft'}]}];
 state.order={id:ORDER,title:'Fixture elevator inspection',work_order_no:74,status:'draft',vendor_name:'Approved fixture contractor',started_at:null,completed_at:null,verified_at:null,completion_summary:null,cost_totals:{},created_at:TIME};state.items=[{id:ITEM,label:'Inspect safety equipment',required:true,completed:false,completed_at:null,notes:null}];
}
try{
 await reset();await render();
 for(const href of ['/en/app/assets','/en/app/vendors','/en/mfa'])ok(document.querySelector(`a[href="${href}"]`),'Real route navigation '+href);
 await savePlan();eq(state.plans.length,1,'Actual save handler dispatched canonical save RPC');
 let release;state.delay={name:'generate_calendar_order_v1',promise:new Promise(resolve=>{release=resolve;})};
 await act(async()=>{button('Issue due draft').click();button('Issue due draft').click();});await flush(40);
 eq(trace.filter(t=>t.rpc==='generate_calendar_order_v1').length,1,'Synchronous duplicate occurrence admission');
 await act(async()=>release());state.delay=null;await flush(40);
 await click('Open work order');await flush(240);
 ok(document.querySelector('[role="dialog"]'),'Plan history opens real work-order panel');
 eq(trace.filter(t=>t.rpc==='get_maintenance_v1'&&t.params.p_id===ORDER).length>0,true,'Exact-ID read reaches RPC even outside list page');
 await submit(formFor('Issue to recorded contractor'));await flush(240);eq(state.order.status,'assigned');
 await submit(formFor('Start work'));await flush(240);eq(state.order.status,'in_progress');
 eq(button('Record completion').disabled,true,'Required checklist prevents premature completion');
 const checklist=[...document.querySelectorAll('[role="dialog"] form')].find(f=>f!==formFor('Record completion'));
 await change(checklist.querySelector('textarea'),'Real UI fixture inspection evidence');await submit(checklist);
 await change(formFor('Record completion').querySelector('textarea'),'Completed fixture inspection');await submit(formFor('Record completion'));await flush(240);
 eq(state.order.status,'completed');await change(formFor('Verify completion').querySelector('textarea'),'Unauthorized operator attempt');await submit(formFor('Verify completion'));await flush(240);
 eq(state.order.status,'completed','Backend permission denial is not shown as verification');
 state.actor='authorized-verifier';context=currentContext(REVIEW_CTX);await render({initialWorkOrderId:ORDER});
 await change(formFor('Verify completion').querySelector('textarea'),'Authorized independent fixture review');await submit(formFor('Verify completion'));await flush(240);
 eq(state.order.status,'verified');ok(document.body.textContent.includes('Completed fixture inspection'),'Completion history read from current RPC');
 eq(document.querySelectorAll('[role="dialog"] time').length,3,'Current execution timestamps are visible');
 ok(document.querySelector(`a[href*="work_order=${ORDER}"]`),'Record can be revisited without relying on bounded listing');
 const element=await page({params:Promise.resolve({lang:'en'}),searchParams:Promise.resolve({work_order:ORDER})});eq(element.props.initialWorkOrderId,ORDER,'Real server route passes validated ID');
 await assert.rejects(()=>page({params:Promise.resolve({lang:'en'}),searchParams:Promise.resolve({work_order:'invalid'})}),/NOT_FOUND/);checks++;
 results.push('plan-save -> deduplicated-generation -> exact-ID -> issue -> start -> checklist -> complete -> unauthorized-deny -> authorized-verify -> revisit');
 await reset();state.partialSave=true;await render();await savePlan();await click('Work orders');await flush(240);await click('Plans');await flush();
 ok(!button('Save plan')||button('Save plan').disabled,'Malformed canonical receipt cannot be acknowledged or enable another command');eq(trace.filter(t=>t.rpc==='save_calendar_plan_v1').length,1);
 results.push('unknown-plan-preserved-across-view-change');
 await reset();await seededOrder();state.lostAction='issue';await render({initialView:'work_orders',initialWorkOrderId:ORDER});
 await submit(formFor('Issue to recorded contractor'));await flush();await click('Reconcile command');
 eq(trace.filter(t=>t.rpc==='issue_work_order_v1').length,1);ok(document.body.textContent.includes('Reopen')||document.body.textContent.includes('Work orders'),'Canonical receipt reconciled after lost response');
 eq(state.commands.size,1,'No replacement command on reconciliation');results.push('lost-response-cleared-only-by-canonical-receipt-reconciliation');
 await reset();await seededOrder();context=currentContext(FOREIGN);await render({initialView:'work_orders',initialWorkOrderId:ORDER});
 eq(document.querySelector('[role="dialog"] form'),null,'Foreign building Context has no mutation admission');ok(!document.body.textContent.includes('Fixture elevator inspection'),'Foreign private record hidden');results.push('foreign-context-no-private-data');
 await reset();await seededOrder();state.readFault='partial';await render({initialView:'work_orders',initialWorkOrderId:ORDER});eq(document.querySelector('[role="dialog"] form'),null);results.push('partial-read-no-action');
 await reset();context={...currentContext(),dashboard:{contextId:REVIEW_CTX}};await render();
 eq(trace.filter(t=>t.rpc&&t.rpc!=='operations_command_v1').length,0,'Context without matching dashboard does not admit domain reads');
 context=currentContext();await render();ok(button('Save plan'),'Fresh matching Context resumes canonical read');results.push('context-readiness-before-admission');
 await reset();await seededOrder();state.plans[0].name='OLD PRIVATE BUILDING A';let releaseRead;
 state.delay={name:'list_calendar_plans_v1',promise:new Promise(resolve=>{releaseRead=resolve;})};await render();
 context=currentContext(FOREIGN);await render();await act(async()=>releaseRead());state.delay=null;await flush();
 ok(!document.body.textContent.includes('OLD PRIVATE BUILDING A'),'Late previous-building response cannot disclose or reopen plan');
 eq(trace.filter(t=>t.rpc==='save_calendar_plan_v1').length,0);results.push('late-response-after-building-context-change');
 await reset();const before=trace.filter(t=>t.rpc).length;state.auth=false;
 let answer=await dispatch('/api/customer/v1/maintenance?context_id='+CTX);eq(answer.status,401);eq(trace.filter(t=>t.rpc).length,before,'Actual handler denies before RPC without validated claims');
 state.auth=true;state.aal='aal1';await seededOrder();
 const open=JSON.stringify({version:1,phase:'open',context_id:CTX,command:null});
 answer=await dispatch('/api/customer/v1/operations/commands',{method:'POST',headers:{'Content-Type':'application/json'},body:open});eq(answer.status,403);eq((await answer.json()).error.code,'FORBIDDEN');
 answer=await dispatch('/api/customer/v1/operations/commands',{method:'POST',origin:'https://foreign.invalid',headers:{'Content-Type':'application/json'},body:open});eq(answer.status,403);
 answer=await dispatch(`/api/customer/v1/work-orders/${ORDER}/issue`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({context_id:CTX})});eq(answer.status,428);eq((await answer.json()).error.code,'OPERATIONS_COMMAND_REQUIRED');
 results.push('real-command-handler-auth-origin-MFA-and-legacy-bypass-closure');
 console.log(JSON.stringify({task:'235-1',result:'PASS',checks,scenarios:results,real_UI_and_Next_handlers:true,RPC_transport:'FAKE_EXPLICIT_OFFLINE_ONLY',SQL_DB_issuedAuth_browser_runtime:'NOT_RUN_NOT_PASS'},null,2));
}finally{
 if(mounted)await act(async()=>mounted.unmount());globalThis.fetch=originalFetch;
 for(const [key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}dom.window.close();
}
