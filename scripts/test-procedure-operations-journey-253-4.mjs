/** PROCEDURE253-4: actual mounted UI, explicit fake transport/gate. No real Auth/DB/browser/server. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url),ts=require('typescript'),{JSDOM}=require('jsdom');
const before=process.argv.includes('--probe-preimage');
const preimages=path.resolve(process.argv.find(arg=>arg.startsWith('--preimages-dir='))?.slice('--preimages-dir='.length)??path.join(root,'../procedure253-4-artifacts/preimages'));
if(before)for(const file of ['CustomerMaintenanceDashboard','PreventiveMaintenancePanel','WorkOrderLifecyclePanel'])assert.ok(existsSync(path.join(preimages,`src/components/customer/${file}.tsx`)),'PREIMAGE_UNAVAILABLE: supply --preimages-dir');
const dom=new JSDOM('<button id="opener">Synthetic opener</button><div id="root"></div>',{url:'https://cladora.test/ro/app/maintenance'}),saved=new Map(),originalFetch=globalThis.fetch;
for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,HTMLElement:dom.window.HTMLElement,FormData:dom.window.FormData,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
let checks=0;const eq=(a,b,m)=>{checks++;assert.deepEqual(a,b,m);},ok=(a,m)=>{checks++;assert.ok(a,m);};
const C='80000000-0000-0000-0000-000000000004',D='80000000-0000-0000-0000-000000000005',W='80000000-0000-0000-0000-000000000074',M='80000000-0000-0000-0000-000000000007',TIME='2026-10-26T10:00:00Z';
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const response=(data,status=200)=>({ok:status<400,status,json:async()=>structuredClone(data)});
let current={active:{context_id:C,membership_id:M,role_code:'test',scope_type:'building'},dashboard:{contextId:C},loading:false,error:null};
let gateReady=false,send=async()=>{throw Error('No fake command configured')},calls=[],row;
const gate={OperationsCommandGate:({children})=>children,useOperationsCommands:()=>({ready:gateReady,send:intent=>send(intent)})};
function load(file,mocks={}){const filename=path.join(root,file),input=before&&existsSync(path.join(preimages,file))?path.join(preimages,file):filename,mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(input,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;}
const defaults=load('src/lib/customer/maintenance-defaults.ts'),schema=load('src/lib/customer/maintenance-schema.ts');
const intents=load('src/lib/customer/operations-command.ts',{'./maintenance-schema':schema,'./maintenance-defaults':defaults});
const lifecycle=load('src/components/customer/WorkOrderLifecyclePanel.tsx',{'./OperationsCommandGate':gate,'@/lib/customer/operations-command':intents,'@/lib/customer/maintenance-schema':schema,'./WorkOrderChecklistPanel':{WorkOrderChecklistPanel:()=>null}});
const plans=load('src/components/customer/PreventiveMaintenancePanel.tsx',{'./OperationsCommandGate':gate,'@/lib/customer/maintenance-defaults':defaults,'@/lib/customer/operations-command':intents});
const dashboard=load('src/components/customer/CustomerMaintenanceDashboard.tsx',{'./OperationsCommandGate':gate,'./CustomerContextProvider':{useCustomerContext:()=>current},'./WorkOrderLifecyclePanel':lifecycle,'./PreventiveMaintenancePanel':{PreventiveMaintenancePanel:()=>null},'@/lib/customer/maintenance-defaults':defaults,'next/link':({children,...props})=>React.createElement('a',props,children)});
const page=load('src/app/[lang]/app/maintenance/page.tsx',{'@/components/customer/CustomerMaintenanceDashboard':dashboard,'@/lib/customer/maintenance-schema':schema,'@/types':{isSupportedLocale:lang=>['ro','en','fa'].includes(lang)},'next/navigation':{notFound:()=>{throw Error('NOT_FOUND')}}}).default;
let mounted=createRoot(document.getElementById('root'));
const mount=element=>act(async()=>mounted.render(element)),unmount=async()=>{await act(async()=>mounted.unmount());mounted=createRoot(document.getElementById('root'));};
const wait=()=>act(async()=>new Promise(resolve=>setTimeout(resolve,230)));
function payload(url){const u=new URL(url,'https://cladora.test'),id=u.searchParams.get('id'),view=u.searchParams.get('view')??'work_orders';return{context:{id:u.searchParams.get('context_id')},view,total:1,rows:[structuredClone(row)],detail:id?structuredClone(row):null,summary:{assets:1,open_work_orders:1,overdue:0,cost_total:{}},read_only:true,generated_at:TIME,limit:Number(u.searchParams.get('limit')??20),offset:0};}
function resetRow(){row={id:W,title:'Canonical fake order',work_order_no:74,status:'draft',vendor_name:'Approved fake contractor',started_at:null,completed_at:null,verified_at:null,completion_summary:null,cost_totals:{}};}
const labels={en:{issue:'Issue to recorded contractor',pending:'Sending the command',unconfirmed:'Current work order status is not confirmed.',forbidden:'Access is unavailable.',conflict:'Work order state changed.',check:'Observe current work order',detail:'Details'},ro:{issue:'Emite către furnizorul înregistrat',pending:'Se trimite comanda',unconfirmed:'Starea curentă a ordinului nu este confirmată.',forbidden:'Accesul nu este disponibil.',conflict:'Starea ordinului s-a schimbat.',check:'Consultă ordinul curent',detail:'Detalii'},fa:{issue:'صدور به پیمانکار ثبت‌شده',pending:'در حال ارسال فرمان',unconfirmed:'وضعیت جاری دستورکار تأیید نشده است.',forbidden:'دسترسی برقرار نیست.',conflict:'وضعیت دستورکار تغییر کرده است',check:'مشاهدهٔ دستورکار فعلی',detail:'جزئیات'}};
const button=text=>[...document.querySelectorAll('button')].find(node=>node.textContent===text);
let read=async url=>response(payload(url));
globalThis.fetch=async(url,options={})=>{calls.push({url,options});ok(!options.method,'UI observation must not invent a direct mutation');return read(url);};
try{
 resetRow();
 const history=await page({params:Promise.resolve({lang:'en'}),searchParams:Promise.resolve({view:'history'})});
 if(before){eq(history.props.initialView,'work_orders','Reproduced ignored history route');}
 else{eq(history.props.initialView,'history');for(const view of ['assets','plans','work_orders','history'])eq((await page({params:Promise.resolve({lang:'ro'}),searchParams:Promise.resolve({view})})).props.initialView,view);eq((await page({params:Promise.resolve({lang:'en'}),searchParams:Promise.resolve({view:'history',work_order:W})})).props.initialView,'work_orders');await assert.rejects(()=>page({params:Promise.resolve({lang:'en'}),searchParams:Promise.resolve({work_order:'bad'})}),/NOT_FOUND/);checks++;}
 gateReady=false;await mount(React.createElement(dashboard.CustomerMaintenanceDashboard,{lang:'en',initialView:'work_orders'}));
 if(before){ok(document.body.textContent.includes('No records match this view'),'Reproduced unconfirmed scope presented as empty');console.log('REPRODUCED_PREIMAGE history view ignored; gate-unready shown as empty. Product behavior/transport not changed by probe.');}
 else{
  ok(document.body.textContent.includes('no current result is confirmed'));ok(!document.body.textContent.includes('No records match this view'));eq(calls.length,0);
  for(const lang of ['en','ro','fa']){
   await unmount();calls=[];gateReady=true;current={...current,active:{...current.active,context_id:C},dashboard:{contextId:C}};resetRow();read=async url=>response(payload(url));
   await mount(React.createElement(dashboard.CustomerMaintenanceDashboard,{lang,initialView:'work_orders'}));await wait();
   const opener=button(labels[lang].detail);ok(opener);await act(async()=>{opener.focus();opener.click();});
   const dialog=document.querySelector('[role="dialog"]');ok(dialog);eq(document.activeElement,dialog.querySelector('button'));ok(dialog.getAttribute('aria-label'));
   const last=[...dialog.querySelectorAll('button:not(:disabled),a[href]')].at(-1);await act(async()=>{last.focus();last.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true}));});eq(document.activeElement,dialog.querySelector('button'),'Tab remains inside dialog');
   await act(async()=>dialog.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));eq(document.querySelector('[role="dialog"]'),null);eq(document.activeElement,opener,'Escape restores trigger focus');
   send=async()=>{throw Object.assign(Error('Canonical fake denial'),{canonicalRejection:true,errorCode:'42501'});};await act(async()=>opener.click());await act(async()=>button(labels[lang].issue).closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));ok(document.body.textContent.includes(labels[lang].forbidden),'Denial survives parent invalidating the observation');ok(!document.body.textContent.includes('Canonical fake order'));await act(async()=>document.querySelector('[role="dialog"]').dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
   gateReady=false;await mount(React.createElement(dashboard.CustomerMaintenanceDashboard,{lang,initialView:'work_orders'}));ok(!document.body.textContent.includes('Canonical fake order'),'No stale row when canonical gate closes');ok(!document.body.textContent.includes('No records match this view'));
   await unmount();gateReady=true;resetRow();const sent=deferred();let intentsSent=[];send=intent=>{intentsSent.push(intent);return sent.promise;};
   const props={contextId:C,workOrderId:W,status:'draft',lang,ready:true,scopeKey:'A',onChanged:()=>{},onUnavailable:()=>{}};
   await mount(React.createElement(lifecycle.WorkOrderLifecyclePanel,props));
   const form=button(labels[lang].issue).closest('form');await act(async()=>{form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});eq(intentsSent.length,1);ok(document.body.textContent.includes(labels[lang].pending));
   await act(async()=>sent.reject(Error('explicit fake UNKNOWN')));ok(document.body.textContent.includes(labels[lang].unconfirmed));ok(!document.querySelector('form'),'Unknown is not success or next transition');
   await act(async()=>button(labels[lang].check).click());eq(button(labels[lang].issue).disabled,true,'Current read cannot resolve previous unknown command');eq(intentsSent.length,1);
   for(const [code,message]of [['42501',labels[lang].forbidden],['40001',labels[lang].conflict]]){
    await unmount();resetRow();send=async()=>{throw Object.assign(Error('Canonical fake rejection'),{canonicalRejection:true,errorCode:code});};await mount(React.createElement(lifecycle.WorkOrderLifecyclePanel,props));await act(async()=>button(labels[lang].issue).closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));ok(document.body.textContent.includes(message));ok(document.body.textContent.includes(labels[lang].unconfirmed));
   }
   await unmount();resetRow();let written=false;const freshRead=deferred();const changed=[];
   read=async url=>written?freshRead.promise:response(payload(url));
   send=async()=>{row={...row,status:'assigned'};written=true;return{id:W,status:'assigned',vendor_id:M};};
   await mount(React.createElement(lifecycle.WorkOrderLifecyclePanel,{...props,onChanged:status=>changed.push(status)}));
   await act(async()=>button(labels[lang].issue).closest('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
   eq(changed.length,0,'Canonical reply alone is not current record readback');
   const pendingReadback={en:'Canonical reply received',ro:'Răspuns canonic primit',fa:'پاسخ canonical دریافت شد'}[lang];ok(document.body.textContent.includes(pendingReadback));
   await act(async()=>freshRead.resolve(response(payload(`/api/customer/v1/maintenance?context_id=${C}&view=work_orders&id=${W}&limit=1`))));eq(changed,['assigned']);
   await unmount();let count=0;read=async()=>{count++;return response({plans:[],assets:[{id:W,name:'Private plan equipment',asset_code:'FAKE',category_code:'lift'}],vendors:[]});};
   await mount(React.createElement(plans.PreventiveMaintenancePanel,{lang,contextId:C,ready:true,scopeKey:'A'}));ok(document.body.textContent.includes('Private plan equipment'));
   await mount(React.createElement(plans.PreventiveMaintenancePanel,{lang,contextId:C,ready:false,scopeKey:'A'}));ok(!document.body.textContent.includes('Private plan equipment'));const reads=count;await mount(React.createElement(plans.PreventiveMaintenancePanel,{lang,contextId:C,ready:false,scopeKey:'A'}));eq(count,reads,'Not-ready plan does not read or mutate');
   gateReady=false;await mount(React.createElement(plans.PreventiveMaintenancePanel,{lang,contextId:C,ready:true,scopeKey:'A'}));ok(!document.body.textContent.includes('Private plan equipment'));eq(count,reads,'Closed shared gate does not read even before parent ready changes');gateReady=true;
  }
  console.log(JSON.stringify({task:'253-4',result:'PASS',checks,evidence:'actual mounted UI; explicit fake gate/transport',real_staging_Auth_DB_browser:'NOT_RUN_NOT_PASS'}));
 }
}finally{
 await act(async()=>mounted.unmount());globalThis.fetch=originalFetch;for(const[key,desc]of saved)if(desc)Object.defineProperty(globalThis,key,desc);else delete globalThis[key];dom.window.close();
}
