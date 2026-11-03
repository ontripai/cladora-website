import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
const require=createRequire(import.meta.url),dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test'}),saved=new Map();
for(const [key,value] of Object.entries({window:dom.window,self:dom.window,Event:dom.window.Event,HTMLElement:dom.window.HTMLElement,document:dom.window.document,navigator:dom.window.navigator,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const A='80000000-0000-0000-0000-000000000001',B='80000000-0000-0000-0000-000000000002';
let context={context_id:A,context_label:'Building A'},requests=[];const originalFetch=globalThis.fetch;
const sourceRoot=fileURLToPath(new URL('../',import.meta.url)),cache=new Map();
function load(path,mocks={}){const filename=resolve(sourceRoot,path);if(cache.has(filename))return cache.get(filename).exports;const mod=new Module(filename);cache.set(filename,mod);mod.require=id=>{
 if(Object.hasOwn(mocks,id))return mocks[id];
 if(id==='server-only')return {};
 if(id.startsWith('@/')||id.startsWith('.')){const base=id.startsWith('@/')?resolve(sourceRoot,'src',id.slice(2)):resolve(dirname(filename),id);const found=[base,base+'.ts',base+'.tsx'].find(p=>existsSync(p));if(found)return load(found,mocks);}
 return require(id);
};mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return mod.exports;}
const parser=load('src/components/customer/WorkOrderLifecyclePanel.tsx');
const {CustomerMaintenanceDashboard}=load('src/components/customer/CustomerMaintenanceDashboard.tsx',{'./CustomerContextProvider':{useCustomerContext:()=>({active:context,dashboard:{contextId:context.context_id},loading:false,error:null})},'./OperationsCommandGate':{OperationsCommandGate:({children})=>children,useOperationsCommands:()=>({ready:true,receipt:null})},'./WorkOrderLifecyclePanel':{WorkOrderLifecyclePanel:()=>null,parseMaintenanceRead:parser.parseMaintenanceRead},'./PreventiveMaintenancePanel':{PreventiveMaintenancePanel:()=>null},'@/lib/customer/maintenance-defaults':{localizedMaintenanceText:v=>v}});
globalThis.fetch=(url,options)=>new Promise((resolve,reject)=>requests.push({url,options,resolve,reject}));
const root=createRoot(document.getElementById('root')),render=()=>act(async()=>root.render(React.createElement(CustomerMaintenanceDashboard,{lang:'en',initialView:'assets'}))),wait=()=>act(async()=>new Promise(resolve=>setTimeout(resolve,230)));
const payload=(count,rows=[])=>({context:{id:context.context_id},view:'assets',read_only:true,detail:null,limit:20,offset:0,total:rows.length,rows,summary:{assets:count,open_work_orders:0,overdue:0,cost_total:{}},generated_at:'2026-10-05T12:00:00Z'});
try{
 await render();await wait();assert.equal(requests.length,1);assert.match(requests[0].url,new RegExp('context_id='+A));
 await act(async()=>requests[0].resolve({ok:true,json:async()=>payload(71,[{id:'80000000-0000-0000-0000-000000000009',name:'Asset A'}])}));assert.match(document.body.textContent,/71/);
 context={context_id:B,context_label:'Building B'};await render();assert.doesNotMatch(document.body.textContent,/71|Asset A|Building A/,'old context must disappear on the same render');await wait();assert.match(requests[1].url,new RegExp('context_id='+B));
 await act(async()=>requests[1].resolve({ok:false}));assert.match(document.body.textContent,/could not be loaded/);assert.doesNotMatch(document.body.textContent,/71|Building A/,'failure cannot reveal old totals');
 context={context_id:A,context_label:'Building A'};await render();assert.doesNotMatch(document.body.textContent,/71/,'returning to a context requires a new response');await wait();await act(async()=>requests[2].resolve({ok:true,json:async()=>payload(0)}));assert.match(document.body.textContent,/No records match/);assert.match(document.body.textContent,/Report for: Building A/);assert.match(document.body.textContent,/Updated:/);assert.match(document.body.textContent,/0/);
 await act(async()=>document.querySelector('[aria-label="Refresh"]').click());assert.doesNotMatch(document.body.textContent,/Report for: Building A/,'refresh hides the old report immediately');
 console.log('PASS maintenance dashboard context switch, failure, empty/zero, report scope and refresh');
}finally{await act(async()=>root.unmount());globalThis.fetch=originalFetch;for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key]}dom.window.close()}
