import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import ts from 'typescript';

const require=createRequire(import.meta.url),dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test'}),saved=new Map();
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,sessionStorage:dom.window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
const {createRoot}=await import('react-dom/client');
const originalFetch=globalThis.fetch;
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url)),mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return mod.exports;}

const contextA='11111111-1111-4111-8111-111111111111',contextB='11111111-1111-4111-8111-111111111112';
const workspaceA='22222222-2222-4222-8222-222222222222',workspaceB='22222222-2222-4222-8222-222222222223';
let active={context_id:contextA},targetsMode='targets',postMode='success',calls=[];
const guards=new Map();
function registerUnsavedGuard(key,dirty,discard){
 if(dirty)guards.set(key,discard);else if(!guards.has(key)||guards.get(key)===discard)guards.delete(key);
 return()=>{if(guards.get(key)===discard)guards.delete(key);};
}
globalThis.fetch=async(url,options={})=>{
 calls.push({url,options});
 if(url.includes('/workspace/targets'))return{ok:true,json:async()=>({workspaces:targetsMode==='empty'?[]:[{workspace_id:workspaceA,environment:'PILOT'},{workspace_id:workspaceB,environment:'PILOT'}]})};
 if(options.method==='POST'){
  if(postMode==='uncertain')throw new Error('connection lost');
  const request=JSON.parse(options.body);
  return{ok:true,json:async()=>({version:2,workspace_id:request.workspace_id,opportunity_id:contextA,idempotent:true})};
 }
 return{ok:true,json:async()=>({opportunities:[]})};
};
const {CustomerAirpropWorkspace}=load('src/components/customer/CustomerAirpropWorkspace.tsx',{
 './CustomerAirpropDiligence':{CustomerAirpropDiligence:()=>null},
 './CustomerContextProvider':{useCustomerContext:()=>({active,registerUnsavedGuard})},
 './CustomerAirpropUnderwriting':{CustomerAirpropUnderwriting:()=>null},
 './CustomerAirpropB2':{CustomerAirpropB2Workspace:()=>null},
 '@/lib/airprop/opportunity-contract-v2':load('src/lib/airprop/opportunity-contract-v2.ts'),
});
const root=createRoot(document.getElementById('root'));
const render=async(key,lang='en')=>act(async()=>{root.render(React.createElement(CustomerAirpropWorkspace,{key,lang}));});
const workspaceSelect=()=>document.querySelector('label select');
const choose=async(workspace)=>act(async()=>{const select=workspaceSelect();select.value=workspace;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
const setInput=(field,value)=>{const input=document.querySelector(`[name="${field}"]`);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
const setCurrency=value=>{const select=document.querySelector('form select');Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype,'value').set.call(select,value);select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));};
const click=async(button)=>act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true,cancelable:true})));
const mutationCount=()=>calls.filter(({options})=>options.method&&options.method!=='GET').length;

try{
 await render('explicit');
 assert.equal(workspaceSelect().value,'');
 assert.equal(calls.some(x=>x.url.includes('/v2/airprop')),false,'no inferred first workspace');
 await choose(workspaceA);
 assert.equal(document.querySelector('form')!==null,true);
 assert.equal(calls.some(x=>x.url.includes(`workspace_id=${workspaceA}`)),true);

 // Existing validation behavior remains mounted and creates no request.
 const beforeInvalid=mutationCount();
 await act(async()=>{setInput('name',' ');setInput('city',' ');setInput('asking_price','0');});
 await act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(mutationCount(),beforeInvalid);
 assert.equal(document.querySelectorAll('[aria-invalid="true"]').length,3);
 assert.equal(document.activeElement.getAttribute('name'),'name');
 for(const field of document.querySelectorAll('[aria-invalid="true"]'))assert.ok(document.getElementById(field.getAttribute('aria-describedby'))?.textContent);

 targetsMode='empty';await render('empty');assert.match(document.body.textContent,/No authorized workspace/);assert.equal(document.querySelector('form'),null);
 active=null;await render('missing');assert.match(document.body.textContent,/Select a context/);active={context_id:contextA};targetsMode='targets';

 // A clean form switches immediately. Changing only currency does not make it dirty.
 await render('clean-switch');await choose(workspaceA);
 await act(async()=>setCurrency('RON'));
 assert.equal(guards.size,0,'currency alone is clean');
 const beforeCleanNavigation=mutationCount();
 await choose(workspaceB);
 assert.equal(workspaceSelect().value,workspaceB);
 assert.equal(document.querySelector('[role="alertdialog"]'),null);
 assert.equal(document.querySelector('[name="name"]').value,'');
 assert.equal(mutationCount(),beforeCleanNavigation,'clean navigation has zero mutation');

 // Dirty state registers the existing context guard and unregisters when clean.
 await render('guard-lifecycle');await choose(workspaceA);
 await act(async()=>setInput('name','temporary'));
 assert.equal(guards.size,1,'dirty draft registers one context guard');
 await act(async()=>setInput('name',''));
 assert.equal(guards.size,0,'clean draft unregisters its context guard');

 // Workspace navigation is blocked until the user explicitly keeps or discards.
 await act(async()=>{setInput('name','Workspace A opportunity');setInput('city','București');setInput('asking_price','123.4500');setCurrency('RON');});
 assert.equal(guards.size,1);
 const beforeDirtyNavigation=mutationCount();
 await choose(workspaceB);
 assert.equal(workspaceSelect().value,workspaceA,'dirty selection stays on workspace A');
 let dialog=document.querySelector('[role="alertdialog"]');
 assert.ok(dialog,'accessible discard confirmation is shown');
 assert.equal(document.querySelector('[name="name"]').value,'Workspace A opportunity');
 assert.equal(document.querySelector('[name="city"]').value,'București');
 assert.equal(document.querySelector('[name="asking_price"]').value,'123.4500');
 assert.equal(document.querySelector('form select').value,'RON');
 assert.equal(mutationCount(),beforeDirtyNavigation,'requesting navigation has zero mutation');
 await click(dialog.querySelectorAll('button')[0]);
 assert.equal(workspaceSelect().value,workspaceA);
 assert.equal(document.querySelector('[role="alertdialog"]'),null);
 assert.equal(document.querySelector('[name="name"]').value,'Workspace A opportunity','keep editing retains all values');
 await choose(workspaceB);dialog=document.querySelector('[role="alertdialog"]');
 await click(dialog.querySelectorAll('button')[1]);
 assert.equal(workspaceSelect().value,workspaceB,'discard switches to workspace B');
 assert.equal(document.querySelector('[name="name"]').value,'');
 assert.equal(document.querySelector('[name="city"]').value,'');
 assert.equal(document.querySelector('[name="asking_price"]').value,'');
 assert.equal(document.querySelector('form select').value,'EUR');
 assert.equal(document.body.textContent.includes('Workspace A opportunity'),false,'workspace A values are not transferred');
 assert.equal(guards.size,0);
 assert.equal(mutationCount(),beforeDirtyNavigation,'discard navigation has zero mutation');

 // The registered callback blocks a context change and discards only local form state when confirmed.
 await render('context-guard');await choose(workspaceA);
 await act(async()=>{setInput('name','Context A opportunity');setInput('city','Cluj');setInput('asking_price','10');});
 const beforeContextNavigation=mutationCount();
 const requestContext=next=>{if(guards.size)return false;active={context_id:next};return true;};
 assert.equal(requestContext(contextB),false,'existing guard blocks the context change');
 assert.equal(active.context_id,contextA);
 assert.equal(document.querySelector('[name="name"]').value,'Context A opportunity');
 await act(async()=>{for(const discard of [...guards.values()])discard();});
 assert.equal(document.querySelector('[name="name"]').value,'');
 assert.equal(guards.size,0);
 assert.equal(requestContext(contextB),true);
 await render('context-b');
 assert.equal(calls.some(x=>x.url.includes(`context_id=${contextB}`)),true);
 await choose(workspaceA);
 assert.equal(document.querySelector('[name="name"]').value,'','context A values are not transferred');
 assert.equal(mutationCount(),beforeContextNavigation,'context navigation has zero mutation');
 active={context_id:contextA};

 // The accessible warning and both actions are localized in every supported language.
 const localeWarnings={
  en:['Discard opportunity edits?','Keep editing','Discard edits'],
  ro:['Renunți la modificările oportunității?','Continuă editarea','Renunță la modificări'],
  fa:['ویرایش‌های فرصت نادیده گرفته شود؟','ادامهٔ ویرایش','نادیده گرفتن ویرایش‌ها'],
 };
 for(const [lang,[title,keep,discard]] of Object.entries(localeWarnings)){
  await render(`locale-${lang}`,lang);await choose(workspaceA);await act(async()=>setInput('name',`draft-${lang}`));
  const beforeLocalizedNavigation=mutationCount();await choose(workspaceB);dialog=document.querySelector('[role="alertdialog"]');
  assert.ok(dialog);assert.equal(dialog.querySelector('h2').textContent,title);
  assert.equal(dialog.querySelectorAll('button')[0].textContent,keep);assert.equal(dialog.querySelectorAll('button')[1].textContent,discard);
  assert.equal(document.querySelector('section').getAttribute('dir'),lang==='fa'?'rtl':'ltr');
  assert.equal(mutationCount(),beforeLocalizedNavigation);await click(dialog.querySelectorAll('button')[0]);
 }

 // Pending recovery keeps the same stored command and exact idempotent retry semantics.
 const pending={version:2,context_id:contextA,workspace_id:workspaceA,idempotency_key:'persisted-test-01',payload:{name:'Saved opportunity',city:'București',country_code:'RO',currency:'EUR',asking_price:'12.3000',property_id:null,source_ref:null}};
 const storageKey=`cladora.airprop.pending.v2:${contextA}:${workspaceA}`;sessionStorage.setItem(storageKey,JSON.stringify(pending));postMode='uncertain';await render('recover');await choose(workspaceA);
 assert.equal(document.querySelector('[name="name"]').value,pending.payload.name);assert.equal(document.querySelector('fieldset').disabled,true);assert.equal(guards.size,1);
 await act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(sessionStorage.getItem(storageKey)!==null,true);let posted=calls.filter(x=>x.options.method==='POST');assert.deepEqual(JSON.parse(posted.at(-1).options.body),pending);
 const beforePendingNavigation=mutationCount();await choose(workspaceB);assert.equal(workspaceSelect().value,workspaceA);assert.ok(document.querySelector('[role="alertdialog"]'));assert.equal(mutationCount(),beforePendingNavigation);await click(document.querySelectorAll('[role="alertdialog"] button')[1]);
 assert.equal(workspaceSelect().value,workspaceB);assert.equal(sessionStorage.getItem(storageKey)!==null,true,'discard does not delete pending recovery');assert.equal(mutationCount(),beforePendingNavigation);
 await choose(workspaceA);assert.equal(document.querySelector('[name="name"]').value,pending.payload.name);assert.equal(document.querySelector('fieldset').disabled,true);
 postMode='success';await act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
 posted=calls.filter(x=>x.options.method==='POST');assert.deepEqual(JSON.parse(posted.at(-1).options.body),pending,'retry sends the exact pending command');
 assert.equal(sessionStorage.getItem(storageKey),null);assert.equal(document.querySelector('fieldset').disabled,false);assert.match(document.body.textContent,/Opportunity saved/);assert.equal(document.querySelector('[name="name"]').value,'');assert.equal(guards.size,0,'success clears dirty guard');

 // Existing route and scope behavior remains intact.
 const access=load('src/lib/customer/access-matrix.ts');
 const classifier=load('src/lib/customer/route-classifier.ts',{'./access-matrix.ts':access});
 let pathname='/en/app/airprop';
 const {CustomerRouteGuard}=load('src/components/customer/CustomerRouteGuard.tsx',{'./CustomerAirpropDiligence':{CustomerAirpropDiligence:()=>null},'./CustomerContextProvider':{useCustomerContext:()=>({active,loading:false,dashboard:null})},'next/navigation':{usePathname:()=>pathname},'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},'@/lib/customer/access-matrix':access,'@/lib/customer/route-classifier':classifier});
 assert.equal(classifier.classifyCustomerRoute('/app/airprop').requirement.nativeWorkspaceDiscovery,true);
 assert.equal(classifier.classifyCustomerRoute('/app/airprop/unknown'),null);
 active={context_id:contextA,scope_type:'tenant'};
 await act(async()=>root.render(React.createElement(CustomerRouteGuard,{lang:'en'},React.createElement('p',null,'native-selector'))));assert.match(document.body.textContent,/native-selector/);
 active={context_id:contextA,scope_type:'property'};
 await act(async()=>root.render(React.createElement(CustomerRouteGuard,{lang:'en'},React.createElement('p',null,'native-selector'))));assert.equal(document.body.textContent.includes('native-selector'),false);
 active={context_id:contextA,scope_type:'tenant'};pathname='/en/app/airprop/unknown';
 await act(async()=>root.render(React.createElement(CustomerRouteGuard,{lang:'en'},React.createElement('p',null,'native-selector'))));assert.equal(document.body.textContent.includes('native-selector'),false);
 console.log('PASS actual rendered AIRPROP UI: draft guards, workspace/context navigation, EN/RO/FA, pending exact retry, zero-mutation navigation and existing regressions');
}finally{
 await act(async()=>root.unmount());globalThis.fetch=originalFetch;
 for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
 dom.window.close();
}
