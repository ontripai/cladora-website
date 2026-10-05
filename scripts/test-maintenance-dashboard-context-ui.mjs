import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
const require=createRequire(import.meta.url),dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test'}),saved=new Map();
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
let context={context_id:'a',context_label:'Building A'},requests=[];const originalFetch=globalThis.fetch;
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url)),mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return mod.exports;}
const {CustomerMaintenanceDashboard}=load('src/components/customer/CustomerMaintenanceDashboard.tsx',{'./CustomerContextProvider':{useCustomerContext:()=>({active:context})},'./WorkOrderLifecyclePanel':{WorkOrderLifecyclePanel:()=>null},'./PreventiveMaintenancePanel':{PreventiveMaintenancePanel:()=>null},'@/lib/customer/maintenance-defaults':{localizedMaintenanceText:v=>v}});
globalThis.fetch=(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}));
const root=createRoot(document.getElementById('root')),render=()=>act(async()=>root.render(React.createElement(CustomerMaintenanceDashboard,{lang:'en',initialView:'assets'}))),wait=()=>act(async()=>new Promise(resolve=>setTimeout(resolve,230)));
const payload=(count,rows=[])=>({total:rows.length,rows,summary:{assets:count,open_work_orders:0,overdue:0,cost_total:{}},generated_at:'2026-10-05T12:00:00Z'});
try{
 await render();await wait();assert.equal(requests.length,1);assert.match(requests[0].url,/context_id=a/);
 await act(async()=>requests[0].resolve({ok:true,json:async()=>payload(71,[{id:'asset-a',name:'Asset A'}])}));assert.match(document.body.textContent,/71/);
 context={context_id:'b',context_label:'Building B'};await render();assert.doesNotMatch(document.body.textContent,/71|Asset A|Building A/,'old context must disappear on the same render');await wait();assert.match(requests[1].url,/context_id=b/);
 await act(async()=>requests[1].resolve({ok:false}));assert.match(document.body.textContent,/could not be loaded/);assert.doesNotMatch(document.body.textContent,/71|Building A/,'failure cannot reveal old totals');
 context={context_id:'a',context_label:'Building A'};await render();assert.doesNotMatch(document.body.textContent,/71/,'returning to a context requires a new response');await wait();await act(async()=>requests[2].resolve({ok:true,json:async()=>payload(0)}));assert.match(document.body.textContent,/No records match/);assert.match(document.body.textContent,/Report for: Building A/);assert.match(document.body.textContent,/Updated:/);assert.match(document.body.textContent,/0/);
 await act(async()=>document.querySelector('[aria-label="Refresh"]').click());assert.doesNotMatch(document.body.textContent,/Report for: Building A/,'refresh hides the old report immediately');
 console.log('PASS maintenance dashboard context switch, failure, empty/zero, report scope and refresh');
}finally{await act(async()=>root.unmount());globalThis.fetch=originalFetch;for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}dom.window.close()}
