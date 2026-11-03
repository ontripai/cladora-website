// Regression for APP07-CONTEXT-DENIAL-02. Actual React modules; controlled HTTP, no native Auth proof.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
const dir=dirname(fileURLToPath(import.meta.url)),require=createRequire(import.meta.url);
const rootPath=resolve(dir,'..');
for (const denialStatus of [401,403]) {
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test/en/app/dashboard?context='+id(1)});
const saved=new Map();for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,sessionStorage:dom.window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true})){
 saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,writable:true,configurable:true});
}
let state,contexts=0,dashboards=0,release;
const pendingDashboard=new Promise(r=>{release=r;});
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body});
const fresh=()=>({contextId:id(1),context:{role_code:'property_manager'},marker:'PRIVATE_PREVIOUS_DASHBOARD'});
const fetch=async input=>String(input).endsWith('/contexts')
 ?++contexts===1?response({contexts:[{context_id:id(1),membership_id:id(3),role_code:'property_manager',role_name:'Manager',scope_type:'tenant',tenant_name:'Synthetic',context_label:'A'}]}):response({error:{code:'DENIED'}},denialStatus)
 :++dashboards===1?response(fresh()):pendingDashboard;
const modules=new Map();
function load(relative){const path=resolve(rootPath,relative);if(modules.has(path))return modules.get(path).exports;
 const mod=new Module(path);modules.set(path,mod);mod.require=name=>{
  if(name==='@/components/dashboard-lab/DashboardTransport')return{useDashboardFetch:()=>fetch,useDashboardPreview:()=>false};
  if(name==='next/navigation')return{usePathname:()=>'/en/app/dashboard'};
  if(name==='next/link')return {__esModule:true,default:({children,...props})=>React.createElement('a',props,children)};
  if(name.startsWith('@/'))return load('src/'+name.slice(2)+'.ts');
  if(name==='./CustomerContextProvider')return load('src/components/customer/CustomerContextProvider.tsx');
  if(name.startsWith('.'))return load(resolve(dirname(path),/\.[cm]?[jt]sx?$/.test(name)?name:name+'.ts'));
  return require(name);
 };
 mod._compile(ts.transpileModule(readFileSync(path,'utf8'),{fileName:path,compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,path);return mod.exports;
}
const {CustomerContextProvider,useCustomerContext}=load('src/components/customer/CustomerContextProvider.tsx');
const {CustomerRouteGuard}=load('src/components/customer/CustomerRouteGuard.tsx');
function Probe(){state=useCustomerContext();return React.createElement(CustomerRouteGuard,{lang:'en'},React.createElement('span',null,state.dashboard?.marker));}
const root=createRoot(document.getElementById('root')),tick=()=>new Promise(r=>setTimeout(r,0));
try{
 await act(async()=>{root.render(React.createElement(CustomerContextProvider,null,React.createElement(Probe)));await tick();});
 assert.match(document.body.textContent,/PRIVATE_PREVIOUS_DASHBOARD/);
 await act(async()=>{state.refresh();await tick();});
 const atDenial={error:state.error,active:state.active?.context_id??null,dashboard:state.dashboard?.contextId??null,private_visible:document.body.textContent.includes('PRIVATE_PREVIOUS_DASHBOARD')};
 await act(async()=>{release(response(fresh()));await tick();});
 const afterLate={error:state.error,active:state.active?.context_id??null,dashboard:state.dashboard?.contextId??null,private_visible:document.body.textContent.includes('PRIVATE_PREVIOUS_DASHBOARD')};

 for(const v of [atDenial,afterLate]) {
  assert.equal(v.error,denialStatus===401?'session_expired':'forbidden');assert.equal(v.active,null);assert.equal(v.dashboard,null);assert.equal(v.private_visible,false);
 }
 console.log('PASS actual Provider/RouteGuard denial '+denialStatus+' clears cached data and fences late dashboard response; controlled HTTP only');
}finally{
 await act(async()=>root.unmount());dom.window.close();
 for(const [key,d]of saved){if(d)Object.defineProperty(globalThis,key,d);else delete globalThis[key];}
}

}
