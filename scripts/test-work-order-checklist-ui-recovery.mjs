/** Offline mounted consumers only; fake fetch, no server/DB/Auth/browser connection. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
export const ID='80000000-0000-0000-0000-000000000074',OTHER='80000000-0000-0000-0000-000000000075',CTX='80000000-0000-0000-0000-000000000004',CTX2='80000000-0000-0000-0000-000000000005',ITEM='80000000-0000-0000-0000-000000000006',VENDOR='80000000-0000-0000-0000-000000000007',TIME='2026-10-26T10:00:00Z';
export const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
export const response=(value,status=200)=>({ok:status>=200&&status<300,status,json:async()=>structuredClone(value)});
export function workOrder(status='draft',id=ID){return {id,title:`Synthetic order ${id.slice(-2)}`,work_order_no:id===ID?74:75,status,vendor_name:'Recorded contractor',started_at:['in_progress','completed','verified'].includes(status)?TIME:null,completed_at:['completed','verified'].includes(status)?TIME:null,verified_at:status==='verified'?TIME:null,completion_summary:['completed','verified'].includes(status)?'Recorded service':null,cost_totals:{},created_at:TIME,priority:'normal'};}
export async function createHarness({sourceRoot=new URL('../',import.meta.url)}={}){
 const require=createRequire(import.meta.url),dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test'}),saved=new Map(),originalFetch=globalThis.fetch;
 for(const[key,value]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,FormData:dom.window.FormData,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
 const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
 function load(path,mocks={}){const filename=fileURLToPath(new URL(path,sourceRoot)),loaded=new Module(filename);loaded.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);loaded._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return loaded.exports;}
 const schema=load('src/lib/customer/maintenance-schema.ts'),defaults=load('src/lib/customer/maintenance-defaults.ts');
 const checklist=load('src/components/customer/WorkOrderChecklistPanel.tsx',{'@/lib/customer/maintenance-schema':schema,'@/lib/customer/maintenance-defaults':defaults});
 const lifecycle=load('src/components/customer/WorkOrderLifecyclePanel.tsx',{'./WorkOrderChecklistPanel':checklist,'@/lib/customer/maintenance-schema':schema});
 const h={React,act,dom,calls:[],changes:[],readiness:[],handlers:{},rows:new Map(),items:[],checks:0,context:null,root:null};
 const dashboard=load('src/components/customer/CustomerMaintenanceDashboard.tsx',{'./WorkOrderLifecyclePanel':lifecycle,'./PreventiveMaintenancePanel':{PreventiveMaintenancePanel:()=>null},'@/lib/customer/maintenance-defaults':defaults,'./CustomerContextProvider':{useCustomerContext:()=>h.context}});
 Object.assign(h,{...lifecycle,...checklist,...dashboard});
 h.changed=status=>h.changes.push(status);h.onReady=value=>h.readiness.push(value);
 h.eq=(a,b,message)=>{h.checks++;assert.deepEqual(a,b,message);};h.ok=(v,message)=>{h.checks++;assert.ok(v,message);};
 h.reset=async(status='in_progress')=>{
  if(h.root)await act(async()=>h.root.unmount());h.root=createRoot(document.getElementById('root'));
  h.calls=[];h.changes=[];h.readiness=[];h.handlers={};h.rows=new Map([[ID,workOrder(status)],[OTHER,workOrder('assigned',OTHER)]]);h.items=[{id:ITEM,label:'CLADORA_PM_HVAC_FILTER',required:true,completed:false,completed_at:null,notes:null}];
  h.context={active:{context_id:CTX,membership_id:VENDOR,role_code:'operator',scope_type:'property',context_label:'Synthetic context'},loading:false,error:null};
 };
 h.payload=(url)=>{const u=new URL(url,'https://cladora.test'),p=u.searchParams,id=p.get('id'),view=p.get('view')??'work_orders';let rows=[...h.rows.values()];if(id)rows=rows.filter(r=>r.id===id);if(p.get('status'))rows=rows.filter(r=>r.status===p.get('status'));return {context:{id:p.get('context_id')},view,rows,detail:id?(rows[0]??null):null,total:rows.length,summary:{assets:0,open_work_orders:rows.filter(r=>!['completed','verified'].includes(r.status)).length,overdue:0,cost_total:{}},read_only:true,generated_at:TIME,limit:Number(p.get('limit')??20),offset:Number(p.get('offset')??0)};};
 h.checklistValue=(id=ID)=>({work_order_id:id,status:h.rows.get(id)?.status??'in_progress',items:structuredClone(h.items)});
 h.model=async c=>{
  if(c.kind==='read')return response(h.payload(c.url));
  if(c.kind==='checklistGet')return response(h.checklistValue(c.id));
  if(c.kind==='checklistPost'){assert.equal(c.body.item_id,ITEM);assert.ok(c.body.notes.length>=10);h.items[0]={...h.items[0],completed:true,completed_at:TIME,notes:c.body.notes};return response(h.checklistValue(c.id));}
  assert.equal(c.kind,'mutation');const row=h.rows.get(c.id);assert.ok(row);
  const next={issue:'assigned',start:'in_progress',complete:'completed',verify:'verified'}[c.action];assert.ok(next,'no financial or unknown mutation path');
  if(c.action==='complete')assert.ok(h.items.every(i=>!i.required||i.completed));
  h.rows.set(c.id,{...row,status:next,...(c.action==='start'?{started_at:TIME}:{}),...(c.action==='complete'?{completed_at:TIME,completion_summary:c.body.completion_notes}:{}),...(c.action==='verify'?{verified_at:TIME}:{})});
  return response({id:c.id,status:next,...(c.action==='issue'?{vendor_id:VENDOR}:{[c.action==='start'?'started_at':c.action==='complete'?'completed_at':'verified_at']:TIME})});
 };
 globalThis.fetch=async(url,options={})=>{
  const u=new URL(url,'https://cladora.test'),parts=u.pathname.split('/'),id=parts[6],action=parts[7];
  // /api/customer/v1/work-orders/:id/:action has id at index5.
  const match=/^\/api\/customer\/v1\/work-orders\/([^/]+)\/([^/]+)$/.exec(u.pathname);
  const kind=u.pathname==='/api/customer/v1/maintenance'?'read':match?.[2]==='checklist'?(options.method==='POST'?'checklistPost':'checklistGet'):'mutation';
  assert.ok(kind==='read'||match,`unrecognized test transport ${u.pathname}`);
  const c={url:String(url),options,id:match?.[1]??id,action:match?.[2]??action,kind,body:options.body?JSON.parse(options.body):null};h.calls.push(c);
  return h.handlers[kind]?h.handlers[kind](c,()=>h.model(c)):h.model(c);
 };
 h.flush=async(ms=0)=>act(async()=>{if(ms)await new Promise(resolve=>setTimeout(resolve,ms));else await Promise.resolve();});
 h.render=async(element)=>act(async()=>h.root.render(element));
 h.renderLifecycle=async(props={},key='same')=>h.render(React.createElement(h.WorkOrderLifecyclePanel,{key,contextId:CTX,workOrderId:ID,status:h.rows.get(ID).status,lang:'en',onChanged:h.changed,...props}));
 h.renderChecklist=async(props={},key='same')=>h.render(React.createElement(h.WorkOrderChecklistPanel,{key,contextId:CTX,workOrderId:ID,lang:'en',onReady:h.onReady,...props}));
 h.renderDashboard=async(props={},key='same')=>{await h.render(React.createElement(h.CustomerMaintenanceDashboard,{key,lang:'en',initialView:'work_orders',...props}));await h.flush(230);};
 h.button=text=>[...document.querySelectorAll('button')].find(x=>x.textContent===text||x.getAttribute('aria-label')===text);
 h.click=async button=>{assert.ok(button,'button exists');await act(async()=>button.click());};
 h.submit=async form=>{assert.ok(form,'form exists');await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));};
 h.change=async(node,value)=>{assert.ok(node);await act(async()=>{Object.getOwnPropertyDescriptor(node.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype,'value').set.call(node,value);node.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});};
 h.writes=()=>h.calls.filter(c=>c.options.method==='POST');
 h.close=async()=>{if(h.root)await act(async()=>h.root.unmount());globalThis.fetch=originalFetch;for(const[key,d]of saved){if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];}dom.window.close();};
 await h.reset();return h;
}
// React keeps the already-mounted event handlers until the async act callback
// returns. Drain the controlled transport's promise chain inside that callback,
// then invoke its REAL mounted edit/submit handlers before a React commit. No
// product hook, phase, ref or admission function is replaced or exposed.
export async function runAdmissionRegression(kind){
 const arg=process.argv.find(v=>v.startsWith('--source-root='));
 const h=await createHarness(arg?{sourceRoot:pathToFileURL(arg.slice('--source-root='.length).replace(/\/$/,'')+'/')}:{});
 const mountedProps=node=>{const key=Object.keys(node).find(k=>k.startsWith('__reactProps$'));assert.ok(key,'actual ReactDOM mounted props');return node[key];};
 const drain=async()=>{for(let i=0;i<32;i++)await Promise.resolve();};
 const outcomes=['lost',503,401,403,'malformed','readback','deadline',400,409,'success'];
 const actions=kind==='lifecycle'?['issue','start','complete','verify']:['checklist'];
 const traces=[],failures=[];
 try{
  for(const action of actions)for(const outcome of outcomes){
   console.log('ADMISSION_CASE '+JSON.stringify({kind,action,outcome}));
   const startStatus={issue:'draft',start:'assigned',complete:'in_progress',verify:'completed',checklist:'in_progress'}[action];
   await h.reset(startStatus);
   if(action==='complete')h.items[0]={...h.items[0],completed:true,completed_at:TIME,notes:'Previously recorded checklist'};
   if(kind==='lifecycle')await h.renderLifecycle();else await h.renderChecklist();
   const form=document.querySelector('form'),inputs=[...form.querySelectorAll('textarea,input')];
   for(const input of inputs)await h.change(input,input.tagName==='INPUT'?'0':'Frozen original evidence');
   const eventProps=mountedProps(form),edits=inputs.map(node=>({node,props:mountedProps(node)})),beforeMarkup=form.outerHTML;
   const first=defer(),second=defer(),trace=[];void second.promise.catch(()=>{});let result,dispatches=0;
   const originalTimeout=AbortSignal.timeout,deadline=new AbortController();
   if(outcome==='deadline')AbortSignal.timeout=()=>deadline.signal;
   h.handlers[kind==='lifecycle'?'mutation':'checklistPost']=async(c,next)=>{
    if(++dispatches>1)return second.promise; // do not let a replacement settle and conceal the violation
    result=outcome==='success'||outcome==='readback'?await next():null;
    return first.promise;
   };
   const baselineReady=h.readiness.filter(Boolean).length;
   try{
    // The first send's render is deliberately NOT committed: admission must be
    // safe using the original mounted blocked=false handler after finally too.
    await h.act(async()=>{
     eventProps.onSubmit({preventDefault(){}});
     await drain();h.eq(h.writes().length,1);trace.push('first-post-pending');
     const body=structuredClone(h.writes()[0].body),wire=h.writes()[0].options.body;
     h.eq(body.context_id,CTX);if(inputs.some(n=>n.tagName==='TEXTAREA'))h.eq(body.notes??body.completion_notes??body.verification_notes,'Frozen original evidence');if(action==='complete')h.eq(body.actual_cost,0);
     if(outcome==='readback')h.handlers[kind==='lifecycle'?'read':'checklistGet']=async()=>response({},403);
     if(outcome==='lost')first.reject(Error('controlled lost response'));
     else if(outcome==='deadline'){deadline.abort(Error('controlled deadline'));first.resolve(response({}));}
     else if(outcome==='success'||outcome==='readback')first.resolve(result);
     else if(outcome==='malformed')first.resolve(response({}));
     else first.resolve(response({},outcome));
     // Every product path after these bounded transport awaits has synchronous
     // mark/catch/finally. Predecessor POST#2 proves the slot was actually freed
     // under this exact schedule, rather than merely testing sending twice.
     await drain();trace.push('settled-and-microtasks-drained');
     h.ok(Object.is(mountedProps(form),eventProps),'no React render/commit replaced the handler');
     h.eq(form.outerHTML,beforeMarkup,'DOM still has the original enabled admission');
     h.eq(form.isConnected,true,'same mounted form, not a detached handler');
     const writesAtGap=h.writes().length,readyAtGap=h.readiness.filter(Boolean).length,changesAtGap=h.changes.length;
     if(outcome!=='success'){
      for(const {node,props}of edits)props.onChange({target:{value:node.tagName==='INPUT'?'9':'Replacement intent forbidden'}});
      eventProps.onSubmit({preventDefault(){}});
     }
     trace.push(outcome==='success'?'successful-settlement-before-commit':'edit-and-submit-before-commit');
     h.eq(h.writes()[0].body,body,'first frozen body unchanged');h.eq(h.writes()[0].options.body,wire,'first wire unchanged');
     h.eq(h.readiness.filter(Boolean).length,readyAtGap,'gap event cannot publish readiness');h.eq(h.changes.length,changesAtGap,'gap event cannot advance lifecycle');
     const shouldBlock=outcome!==400&&outcome!==409&&outcome!=='success';
     // Collect all independently reproduced outcomes before failing this run.
     if(shouldBlock&&h.writes().length!==writesAtGap)failures.push({kind,action,outcome,posts:h.writes().length,secondBody:h.writes()[1]?.body});
     if(shouldBlock)h.eq(readyAtGap,baselineReady,'no fresh positive readiness on uncertainty/denial');
     else{const expected=outcome==='success'||action==='complete'?1:2;h.eq(h.writes().length,expected,'rejected phase releases ownership; complete still requires fresh checklist readiness');if(expected===2&&inputs.some(n=>n.tagName==='TEXTAREA')){const last=h.writes()[1].body;h.eq(last.notes??last.completion_notes??last.verification_notes,'Replacement intent forbidden');}}
    });
    const shouldBlock=outcome!==400&&outcome!==409&&outcome!=='success';
    if(shouldBlock){
     // Restore only the controlled GET/deadline fault for a fresh observation;
     // the original UNKNOWN/denied attempt remains product-owned and fenced.
     AbortSignal.timeout=originalTimeout;h.handlers[kind==='lifecycle'?'read':'checklistGet']=undefined;
     h.eq(h.changes.length,0);h.eq(h.readiness.filter(Boolean).length,baselineReady);
     if(kind==='lifecycle')await h.click(h.button('Observe current work order'));else await h.click(h.button('Observe current checklist'));
     if(inputs.some(n=>n.tagName==='TEXTAREA')){
      const value=document.querySelector('textarea')?.value;
      if(value!=='Frozen original evidence'&&!(kind==='checklist'&&outcome==='readback'&&document.body.textContent.includes('Frozen original evidence')))failures.push({kind,action,outcome,retainedNotes:value});
     }
     // A recorded completion readback exposes the verify form, not actual_cost.
     // Its original wire=0 was asserted above; other complete cases retain the input.
     if(action==='complete'&&outcome!=='readback'&&document.querySelector('input[name="cost"]')?.value!=='0')failures.push({kind,action,outcome,retainedCost:document.querySelector('input[name="cost"]')?.value});
     if(h.writes().length!==1&&!failures.some(f=>f.kind===kind&&f.action===action&&f.outcome===outcome&&f.posts))failures.push({kind,action,outcome,posts:h.writes().length});
     h.eq(h.changes.length,0,'observation is not success or next action');h.eq(h.readiness.filter(Boolean).length,baselineReady,'observation cannot clear UNKNOWN/denied readiness');
    }else if((outcome===400||outcome===409)&&action==='complete'){
     await h.click(h.button('Observe current work order'));h.eq(document.querySelector('textarea').value,'Replacement intent forbidden');h.eq(document.querySelector('input[name="cost"]').value,'9');await h.submit([...document.querySelectorAll('form')].find(f=>f.querySelector('input[name="cost"]')));h.eq(h.writes().length,2,'complete can retry after authorized observation and required checklist readiness');h.eq(h.writes()[1].body.actual_cost,9);
    }else if(outcome==='success'){
     if(kind==='lifecycle')h.eq(h.changes,[{issue:'assigned',start:'in_progress',complete:'completed',verify:'verified'}[action]]);else h.eq(h.readiness.includes(true),true);
    }
    traces.push({kind,action,outcome,trace,posts:h.writes().length});
   }finally{AbortSignal.timeout=originalTimeout;second.reject(Error('controlled replacement cleanup'));await h.flush();}
  }
  // Binding-matched phase fences must not become global locks on another WO.
  await h.reset(kind==='lifecycle'?'completed':'in_progress');
  if(kind==='lifecycle')await h.renderLifecycle();else await h.renderChecklist();
  await h.change(document.querySelector('textarea'),'Old binding retained input');
  h.handlers[kind==='lifecycle'?'mutation':'checklistPost']=async()=>response({},403);
  await h.submit(document.querySelector('form'));h.eq(h.writes().length,1);
  h.rows.set(OTHER,workOrder(kind==='lifecycle'?'completed':'in_progress',OTHER));
  if(kind==='lifecycle')await h.renderLifecycle({workOrderId:OTHER});else await h.renderChecklist({workOrderId:OTHER});
  h.handlers[kind==='lifecycle'?'mutation':'checklistPost']=async()=>response({},400);
  await h.change(document.querySelector('textarea'),'New binding permitted input');await h.submit(document.querySelector('form'));
  h.eq(h.writes().length,2);h.eq(h.writes()[1].id,OTHER);h.eq(h.writes()[1].body.notes??h.writes()[1].body.verification_notes,'New binding permitted input');
  console.log('SETTLEMENT_GAP_TRACES '+JSON.stringify(traces));
  console.log('ADMISSION_FAILURES '+JSON.stringify(failures));
  assert.deepEqual(failures,[],`${kind}: post-settlement admission/snapshot invariant`);
  console.log(JSON.stringify({suite:`${kind}-settlement-admission`,cases:traces.length,assertions:h.checks,result:'PASS',boundary:'actual mounted handlers, async act batches commits; controlled fake fetch only',SQL_Auth_HTTP_runtime:'NOT_RUN'}));
 }finally{await h.close();}
}
async function runChecklist(){
 const h=await createHarness();try{
  for(const lang of ['en','ro','fa']){
   await h.reset();await h.renderChecklist({lang});h.eq(h.readiness.at(-1),false);h.ok(!document.body.textContent.includes('CLADORA_PM_HVAC_FILTER'),'canonical code localized without changing stored code');
   await h.change(document.querySelector('textarea'),'Synthetic checklist evidence');await h.submit(document.querySelector('form'));h.eq(h.writes().length,1);h.eq(h.writes()[0].body,{context_id:CTX,item_id:ITEM,notes:'Synthetic checklist evidence'});h.eq(h.readiness.at(-1),true);h.eq(h.calls.at(-1).kind,'checklistGet','POST alone is not readiness');
  }
  for(const value of [null,{}, {items:[]},{work_order_id:OTHER,status:'in_progress',items:[]},{work_order_id:ID,status:'completed',items:[]},{work_order_id:ID,status:'in_progress',items:[{id:ITEM,label:'X',required:'true',completed:false,completed_at:null,notes:null}]},{work_order_id:ID,status:'in_progress',items:[{id:ITEM,label:'X',required:true,completed:'true',completed_at:null,notes:null}]}]){
   await h.reset();h.handlers.checklistGet=async()=>response(value);await h.renderChecklist();h.eq(h.readiness.at(-1),false);h.eq(document.querySelector('form'),null);
  }
  for(const incomplete of [{completed_at:null,notes:'Otherwise valid recorded notes'},{completed_at:TIME,notes:null},{completed_at:TIME,notes:'short'}]){
   await h.reset();h.items[0]={...h.items[0],completed:true,...incomplete};await h.renderChecklist();h.eq(h.readiness.at(-1),false,'a completed flag without the RPC recording metadata cannot enable completion');h.eq(document.querySelector('form'),null);
  }
  await h.reset();h.items=[];await h.renderChecklist();h.eq(h.readiness.at(-1),true,'canonical empty checklist has no outstanding required item');
  for(const status of [400,401,403,408,409,429,500,503]){
   await h.reset();await h.renderChecklist();h.handlers.checklistPost=async()=>response({},status);await h.change(document.querySelector('textarea'),'Retained request evidence');await h.submit(document.querySelector('form'));h.eq(h.readiness.at(-1),false);h.eq(h.writes().length,1);
   await h.click(h.button('Observe current checklist'));h.eq(h.writes().length,1,'refresh never POSTs');if(status>=500||status===401||status===403||status===408||status===429)h.eq(h.readiness.at(-1),false);
   h.eq(document.querySelector('textarea')?.value,'Retained request evidence');
  }
  for(const fault of ['lost','malformed','wrong-id','wrong-item','readback-denied','readback-mismatch','json-error']){
   await h.reset();await h.renderChecklist();
   h.handlers.checklistPost=async(c,next)=>{
    if(fault==='lost')throw Error('synthetic timeout');if(fault==='malformed')return response({items:[]});if(fault==='json-error')return {ok:true,status:200,json:async()=>{throw Error('partial JSON');}};
    const r=await next(),v=await r.json();if(fault==='wrong-id')v.work_order_id=OTHER;if(fault==='wrong-item')v.items[0].id=OTHER;
    if(fault==='readback-denied')h.handlers.checklistGet=async()=>response({},403);if(fault==='readback-mismatch')h.handlers.checklistGet=async()=>response({...h.checklistValue(),items:[{...h.items[0],completed:false}]});return response(v);
   };
   await h.change(document.querySelector('textarea'),'Unknown retained evidence');await h.submit(document.querySelector('form'));h.eq(h.readiness.at(-1),false);h.ok(document.body.textContent.includes('unknown'));h.eq(h.writes().length,1);
  }
  // One synchronous write slot, even if two submit events occur before React commits.
  await h.reset();await h.renderChecklist();await h.change(document.querySelector('textarea'),'Frozen original evidence');const wait=defer();h.handlers.checklistPost=async()=>wait.promise;
  await h.act(async()=>{const f=document.querySelector('form');f.dispatchEvent(new h.dom.window.Event('submit',{bubbles:true,cancelable:true}));f.dispatchEvent(new h.dom.window.Event('submit',{bubbles:true,cancelable:true}));});h.eq(h.writes().length,1);h.eq(h.readiness.at(-1),false);
  await h.change(document.querySelector('textarea'),'Different intent ignored');h.eq(h.writes()[0].body.notes,'Frozen original evidence');await h.act(async()=>wait.reject(Error('lost')));
  // A late valid response after the deadline is still UNKNOWN, even if the
  // fake server recorded it; no readback or readiness is launched by that reply.
  await h.reset();await h.renderChecklist();await h.change(document.querySelector('textarea'),'Timed original evidence');
  {
   const deadline=new AbortController(),originalTimeout=AbortSignal.timeout,late=defer();let result;
   try{AbortSignal.timeout=()=>deadline.signal;h.handlers.checklistPost=async(c,next)=>{result=await next();return late.promise;};await h.submit(document.querySelector('form'));const reads=h.calls.filter(c=>c.kind==='checklistGet').length;deadline.abort(Error('test deadline'));await h.act(async()=>late.resolve(result));h.eq(h.readiness.at(-1),false);h.eq(h.calls.filter(c=>c.kind==='checklistGet').length,reads);h.ok(document.body.textContent.includes('unknown'));}
   finally{AbortSignal.timeout=originalTimeout;}
  }
  // Scope/locale/loading revoke readiness before a late read or write can publish.
  for(const phase of ['read','write'])for(const loss of ['context','work-order','loading','locale','callback','unmount']){
   await h.reset();const old=defer();if(phase==='read')h.handlers.checklistGet=async()=>old.promise;
   await h.renderChecklist();if(phase==='write'){h.handlers.checklistPost=async()=>old.promise;await h.change(document.querySelector('textarea'),'Old scope evidence');await h.submit(document.querySelector('form'));}
   const events=[];h.handlers.checklistGet=async()=>response(h.checklistValue());const props=loss==='context'?{contextId:CTX2}:loss==='work-order'?{workOrderId:OTHER}:loss==='loading'?{ready:false}:loss==='locale'?{lang:'ro'}:{onReady:v=>events.push(v)};
   if(loss==='unmount')await h.render(h.React.createElement('div'));else await h.renderChecklist(props);const before=h.readiness.length;await h.act(async()=>old.resolve(response({work_order_id:ID,status:'in_progress',items:[{...h.items[0],completed:true,completed_at:TIME,notes:'Old scope evidence'}]})));
   h.eq(h.readiness.length,before,'late continuation cannot publish to old owner');if(loss==='loading')h.eq(document.querySelector('form'),null);if(loss==='callback')h.ok(!events.includes(true),'old callback cannot grant readiness');
  }
  // Old finally cannot release the new operation's lock on another work order.
  await h.reset();await h.renderChecklist();await h.change(document.querySelector('textarea'),'First order evidence');const first=defer(),second=defer();let n=0;h.handlers.checklistPost=async()=>++n===1?first.promise:second.promise;
  await h.submit(document.querySelector('form'));h.rows.set(OTHER,workOrder('in_progress',OTHER));await h.renderChecklist({workOrderId:OTHER});await h.change(document.querySelector('textarea'),'Second order evidence');await h.submit(document.querySelector('form'));h.eq(h.writes().length,2);
  await h.act(async()=>first.reject(Error('late first')));await h.submit(document.querySelector('form'));h.eq(h.writes().length,2,'old finally did not unlock new write');await h.act(async()=>second.reject(Error('unknown second')));
  console.log(JSON.stringify({suite:'work-order-checklist-recovery',assertions:h.checks,result:'PASS',boundary:'mounted real component, fake fetch only',SQL_Auth_HTTP_runtime:'NOT_RUN'}));
 }finally{await h.close();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){if(process.argv.includes('--admission-only'))await runAdmissionRegression('checklist');else{await runChecklist();await runAdmissionRegression('checklist');}}
