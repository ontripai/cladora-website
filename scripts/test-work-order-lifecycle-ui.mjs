import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
const require=createRequire(import.meta.url),dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test'}),saved=new Map();
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,FormData:dom.window.FormData,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');const originalFetch=globalThis.fetch;
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url)),mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return mod.exports;}
const checklist=load('src/components/customer/WorkOrderChecklistPanel.tsx',{'@/lib/customer/maintenance-defaults':load('src/lib/customer/maintenance-defaults.ts')});
const {WorkOrderLifecyclePanel}=load('src/components/customer/WorkOrderLifecyclePanel.tsx',{'./WorkOrderChecklistPanel':checklist});
const id='80000000-0000-0000-0000-000000000074',ctx='80000000-0000-0000-0000-000000000004';let calls=[],changes=[],mode='success',recorded=false;
globalThis.fetch=async(url,options={})=>{calls.push({url,options});if(url.includes('/checklist')){if(options.method)recorded=true;return {ok:true,json:async()=>({items:[{id:ctx,label:'CLADORA_PM_HVAC_FILTER',required:true,completed:recorded,notes:null}]})}}if(mode==='lost')throw Error();if(mode==='denied')return{ok:false,status:403};const action=url.split('/').at(-1);return{ok:true,json:async()=>({id,status:{issue:'assigned',start:'in_progress',complete:'completed',verify:'verified'}[action]})}};
const root=createRoot(document.getElementById('root'));const render=async(key,status,lang='en')=>act(async()=>root.render(React.createElement(WorkOrderLifecyclePanel,{key,contextId:ctx,workOrderId:id,status,lang,onChanged:s=>changes.push(s)})));
const submit=async(form)=>act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
try{
 await render('draft','draft');await submit(document.querySelector('form'));assert.equal(calls.at(-1).url,`/api/customer/v1/work-orders/${id}/issue`);assert.deepEqual(JSON.parse(calls.at(-1).options.body),{context_id:ctx});assert.equal(changes.pop(),'assigned');
 await render('assigned','assigned');await submit(document.querySelector('form'));assert.equal(changes.pop(),'in_progress');
 await render('progress','in_progress','fa');const forms=document.querySelectorAll('form');assert.equal(forms[1].querySelector('button').disabled,true,'required checklist blocks completion');forms[0].querySelector('textarea').value='Synthetic checklist evidence';await submit(forms[0]);assert.equal(document.querySelectorAll('form').length,1);const complete=document.querySelector('form');assert.equal(complete.querySelector('button').disabled,false);complete.querySelector('textarea').value='Synthetic completion only';complete.querySelector('input').value='0';await submit(complete);assert.equal(JSON.parse(calls.at(-1).options.body).actual_cost,0);assert.equal(changes.pop(),'completed');
 await render('completed','completed','ro');document.querySelector('textarea').value='Synthetic verification only';await submit(document.querySelector('form'));assert.equal(changes.pop(),'verified');
 await render('verified','verified');assert.equal(document.querySelector('form'),null,'terminal state has no mutations');
 await render('denied','draft');mode='denied';await submit(document.querySelector('form'));assert.equal(changes.length,0,'denial never advances status');
 await render('lost','draft');mode='lost';await submit(document.querySelector('form'));assert.equal(document.querySelector('button').disabled,true,'unknown outcome requires refresh');const request=calls.at(-1);await render('new-context','draft');assert.equal(request.options.signal.aborted,true,'unmount cancels old-context requests');
 console.log('PASS work-order UI: RO/EN/FA, exact actions, required checklist gate, zero cost, verified terminal state, denial, lost response and abort');
}finally{await act(async()=>root.unmount());globalThis.fetch=originalFetch;for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}dom.window.close()}
