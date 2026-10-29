// Offline boundary tests: no database, Auth login, external provider or real writes.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import React,{act} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
const root=process.cwd(),require=createRequire(path.join(root,'package.json'));
let checks=0,pathname='/en',providers=0,discard;
const check=(v,m)=>{assert.ok(v,m);checks++;};
const equal=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
const context={active:{context_id:'80000000-0000-0000-0000-000000000001',membership_id:'80000000-0000-0000-0000-000000000002'},dashboard:{contextId:'80000000-0000-0000-0000-000000000001',workspace_id:'80000000-0000-0000-0000-000000000003'},loading:false,error:null,registerUnsavedGuard:(_key,_dirty,fn)=>{discard=fn;return()=>{};}};
const link={__esModule:true,default:({href,children,...props})=>React.createElement('a',{href,...props},children)};
const mocks={
 'server-only':{},'next/link':link,
 'next/navigation':{usePathname:()=>pathname,notFound:()=>{throw Error('NOT_FOUND');}},
 '@/components/layout/Header':{Header:()=>React.createElement('header',{'data-marketing-header':true})},'@/components/layout/Footer':{Footer:()=>React.createElement('footer',{'data-marketing-footer':true})},
 '@/data/demoStore':{DemoProvider:({children})=>{providers++;return React.createElement('div',{'data-demo-provider':true},children);}},
 '@/components/demo/DemoDashboardPage':{__esModule:true,default:()=>React.createElement('p',null,'isolated dashboard')},
 '@/components/demo/DemoAccountingPage':{__esModule:true,default:()=>React.createElement('p',null,'isolated accounting')},
 './CustomerContextProvider':{useCustomerContext:()=>context},
 './CustomerOnboardingTemplates':{CustomerOnboardingTemplates:()=>null},
 './CustomerBuildingSetupProgress':{CustomerBuildingSetupProgress:()=>null},
};
const cache=new Map();
function load(relative){
 const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;
 const mod=new Module(file);cache.set(file,mod);mod.require=id=>{
  if(Object.hasOwn(mocks,id))return mocks[id];
  if(id.startsWith('.')||id.startsWith('@/')){
   const base=id.startsWith('@/')?path.join(root,'src',id.slice(2)):path.resolve(path.dirname(file),id);
   const found=[base,base+'.ts',base+'.tsx'].find(p=>existsSync(p));if(found)return load(found);
  }
  return require(id);
 };
 mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,file);
 return mod.exports;
}
const keys=['NODE_ENV','VERCEL','VERCEL_ENV','ALLOW_DEV_FALLBACK_SECRET','SUPABASE_SECRET_KEY','TURNSTILE_REQUIRED','TURNSTILE_SECRET_KEY','NEXT_PUBLIC_TURNSTILE_SITE_KEY'];
const savedEnv=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
function env(values){for(const k of keys)delete process.env[k];Object.assign(process.env,values);}
try{
 const secrets=load('src/lib/supabase/server-env.ts'),recovery=load('src/lib/auth/recovery-cookie.ts');
 const token=()=>recovery.createRecoverySessionToken('80000000-0000-0000-0000-000000000001');
 for(const values of [{NODE_ENV:'test'},{NODE_ENV:'development',ALLOW_DEV_FALLBACK_SECRET:'true'}]){
  env(values);check(secrets.getServerSupabaseSecret().startsWith('sb_secret_test_'),'explicit local fixture secret');check(token().length>20,'local test signer');
 }
 for(const values of [
  {NODE_ENV:'production',ALLOW_DEV_FALLBACK_SECRET:'true'},
  {NODE_ENV:'production',VERCEL_ENV:'preview',ALLOW_DEV_FALLBACK_SECRET:'true'},
  {NODE_ENV:'test',VERCEL_ENV:'production',ALLOW_DEV_FALLBACK_SECRET:'true'},
  {NODE_ENV:'test',VERCEL_ENV:'preview'},
  {NODE_ENV:'test',VERCEL:'1'},
  {NODE_ENV:'development'},
 ]){
  env(values);assert.throws(()=>secrets.getServerSupabaseSecret(),/missing or invalid/);assert.throws(token,/missing or invalid/);checks+=2;
 }
 env({NODE_ENV:'production',VERCEL_ENV:'production',SUPABASE_SECRET_KEY:'sb_secret_'+ 'synthetic_unit_test_only'.repeat(3)});
 check(secrets.getServerSupabaseSecret().startsWith('sb_secret_synthetic'),'configured server signer unchanged');check(token().length>20,'configured recovery signer remains usable');
 const captcha=load('src/lib/security/turnstile-server.ts');
 for(const values of [{NODE_ENV:'production'},{NODE_ENV:'production',VERCEL_ENV:'preview',TURNSTILE_REQUIRED:'true'},{NODE_ENV:'development',TURNSTILE_REQUIRED:'true'}]){
  env(values);equal((await captcha.verifyTurnstileToken(null)).success,false,'required CAPTCHA never bypasses missing key');
 }
 env({NODE_ENV:'development'});equal(await captcha.verifyTurnstileToken(null),{success:true,bypassed:true},'explicit local policy preserved');
 env({NODE_ENV:'production',VERCEL_ENV:'preview',NEXT_PUBLIC_TURNSTILE_SITE_KEY:'synthetic-public-site-key'});equal((await captcha.verifyTurnstileToken(null)).errorCode,'CAPTCHA_MISCONFIGURED');
}finally{for(const k of keys){if(savedEnv[k]===undefined)delete process.env[k];else process.env[k]=savedEnv[k];}}

const {AppOrMarketingLayout}=load('src/components/layout/AppOrMarketingLayout.tsx');
for(const route of ['/en','/en/app/dashboard','/en/platform/dashboard-lab','/en/demonstration','/en/app/demo']){
 pathname=route;providers=0;renderToStaticMarkup(React.createElement(AppOrMarketingLayout,{lang:'en'},'real content'));equal(providers,0,'no demo store on '+route);
}
for(const route of ['/en/demo','/en/demo/app/dashboard','/en/demo/app/accounting']){
 pathname=route;providers=0;renderToStaticMarkup(React.createElement(AppOrMarketingLayout,{lang:'en'},'demo content'));equal(providers,1,'demo store scoped to '+route);
}
for(const [route,marketing] of [['/en',true],['/en/demo',true],['/en/demo/app/dashboard',false],['/en/demo/app/maintenance',false],['/en/app/dashboard',false]]){
 pathname=route;const output=renderToStaticMarkup(React.createElement(AppOrMarketingLayout,{lang:'en'},'content'));
 equal(output.includes('data-marketing-header'),marketing,'exact shell on '+route);
 equal(output.includes('data-marketing-footer'),marketing,'exact footer on '+route);
}
const demoSource=readFileSync(path.join(root,'src/app/[lang]/demo/app/[...slug]/page.tsx'),'utf8');
check(!/from\s+['"]@\/app\/.*\/app\//.test(demoSource),'demo route must not import authenticated app pages');
const DemoPage=load('src/app/[lang]/demo/app/[...slug]/page.tsx').default;
for(const lang of ['en','ro','fa'])for(const section of ['maintenance','documents','communications','accounting/month-close']){
 const output=renderToStaticMarkup(await DemoPage({params:Promise.resolve({lang,slug:section.split('/')})}));
 check(output.includes(`/${lang}/login`),'unsupported demo module leads to real login');
}

const dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test/en/app/onboarding'}),old=new Map(),oldFetch=globalThis.fetch;let requests=0,submittedPayload;
for(const[k,v]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,Event:dom.window.Event,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true})){
 old.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
}
globalThis.fetch=async(_url,init)=>{requests++;submittedPayload=init?.body?JSON.parse(init.body):null;throw Error('Synthetic lost response; no network');};
const {createRoot}=require('react-dom/client'),mounted=createRoot(dom.window.document.getElementById('root'));
try{
 const {CustomerBuildingSetupWizard}=load('src/components/customer/CustomerBuildingSetupWizard.tsx');
 await act(async()=>{mounted.render(React.createElement(CustomerBuildingSetupWizard,{lang:'en'}));});
 for(let i=0;i<4;i++)await act(async()=>{await new Promise(r=>setTimeout(r,0));});
 const inputs=[...document.querySelectorAll('input')];check(inputs.length>=11,'actual setup form mounted');
 for(const input of inputs.slice(0,9))equal(input.value,'','building identity, dates and Unit require explicit input');
 check(!document.body.textContent.includes('Synthetic Building'),'synthetic identity absent');
 const create=[...document.querySelectorAll('button')].find(b=>b.textContent==='Create draft');check(create&&!create.disabled,'fresh form still admits validation');
 await act(async()=>create.click());equal(requests,0,'empty form never creates a setup');
 check(document.body.textContent.includes('Check dates'),'invalid form explains required input');
 const first=inputs[0];await act(async()=>{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(first,'Explicit user input');first.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 check(typeof discard==='function','unsaved input guard preserved');await act(async()=>discard());equal(document.querySelector('fieldset input').value,'','discard returns to empty form');equal(requests,0,'discard causes no server write');
 const values=['Explicit association','Explicit building','EXPLICIT-A','2','2027-01-01','2027-12-31','EXPLICIT-UNIT','0','62'];
 for(const [i,value] of values.entries())await act(async()=>{const el=document.querySelectorAll('input')[i];Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
 await act(async()=>[...document.querySelectorAll('button')].find(b=>b.textContent==='Create draft').click());
 equal(requests,1,'only explicitly entered valid input reaches the fake transport');equal(submittedPayload.payload.association.name,'Explicit association');equal(submittedPayload.payload.building.code,'EXPLICIT-A');equal(submittedPayload.payload.units[0],{code:'EXPLICIT-UNIT',floor:0,area_m2:62});check(dom.window.sessionStorage.length>0,'lost response preserves original explicit request');
 const stored=Array.from({length:dom.window.sessionStorage.length},(_,i)=>{const k=dom.window.sessionStorage.key(i);return [k,dom.window.sessionStorage.getItem(k)];});let replayWrites=0;
 globalThis.fetch=async(_url,init={})=>{if(init.method==='POST'){replayWrites++;throw Error('Unexpected automatic retry');}return {ok:true,status:200,json:async()=>({attempt:null})};};
 await act(async()=>mounted.render(React.createElement(CustomerBuildingSetupWizard,{lang:'en',key:'after-lost-response'})));for(let i=0;i<4;i++)await act(async()=>{await new Promise(r=>setTimeout(r,0));});
 equal(document.querySelector('fieldset input').value,'Explicit association','remount restores the saved original input, not empty defaults');equal(replayWrites,0,'reconciliation does not auto-resend the original command');
 for(const [k,v] of stored)equal(dom.window.sessionStorage.getItem(k),v,'saved request bytes remain unchanged');
}finally{
 await act(async()=>mounted.unmount());globalThis.fetch=oldFetch;
 for(const[k,d]of old){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}dom.window.close();
}
console.log(JSON.stringify({result:'PASS',checks,scope:'demo isolation, local-only secret fallback, required CAPTCHA, real setup form defaults',runtime_database:'NOT_RUN_NOT_PASS'}));
