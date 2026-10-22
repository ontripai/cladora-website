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
let active={context_id:contextA},targetsMode='targets',postMode='success',calls=[],postReply=null;
const guards=new Map();
function registerUnsavedGuard(key,dirty,discard){
 if(dirty)guards.set(key,discard);else if(!guards.has(key)||guards.get(key)===discard)guards.delete(key);
 return()=>{if(guards.get(key)===discard)guards.delete(key);};
}
globalThis.fetch=async(url,options={})=>{
 calls.push({url,options});
 if(url.includes('/workspace/targets'))return{ok:true,json:async()=>({workspaces:targetsMode==='empty'?[]:[{workspace_id:workspaceA,environment:'PILOT'},{workspace_id:workspaceB,environment:'PILOT'}]})};
 if(options.method==='POST'){
  if(postReply)return postReply();
  if(postMode==='uncertain')throw new Error('connection lost');
  const failures={unauthorized:[401,'UNAUTHORIZED'],conflict:[409,'IDEMPOTENCY_CONFLICT'],denied:[403,'AIRPROP_ACCESS_DENIED'],mfa:[403,'MFA_REQUIRED'],server:[500,'AIRPROP_REQUEST_FAILED']};
  if(failures[postMode]){const [status,code]=failures[postMode];return{ok:false,status,json:async()=>({error:{code}})};}
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

async function testRealContextProvider(){
 const nativeFetch=globalThis.fetch,contextStorageKey='cladora.customer-context.v1';
 const previousContext=sessionStorage.getItem(contextStorageKey),integrationCalls=[];
 sessionStorage.removeItem(contextStorageKey);
 const contexts=[contextA,contextB].map((context_id,index)=>({context_id,membership_id:context_id,tenant_name:`Test tenant ${index}`,role_code:'OWNER',role_name:'Owner',scope_type:'tenant',context_label:`Context ${index===0?'A':'B'}`}));
 globalThis.fetch=async(url,options={})=>{
  integrationCalls.push({url,options});
  assert.equal(options.method??'GET','GET','real-provider navigation must never dispatch a mutation');
  assert.ok(typeof url==='string'&&url.startsWith('/api/customer/'),'only mocked relative customer requests are allowed');
  const parsed=new URL(url,'https://cladora.test'),contextId=parsed.searchParams.get('context_id');
  let body;
  if(parsed.pathname==='/api/customer/v1/contexts')body={contexts};
  else if(parsed.pathname==='/api/customer/v1/dashboard'){
   assert.ok([contextA,contextB].includes(contextId));body={contextId};
  }else if(parsed.pathname==='/api/customer/v1/workspace/targets'){
   assert.ok([contextA,contextB].includes(contextId));body={workspaces:[{workspace_id:contextId===contextA?workspaceA:workspaceB,environment:'TEST'}]};
  }else if(parsed.pathname==='/api/customer/v2/airprop/opportunities'){
   assert.equal(parsed.searchParams.get('workspace_id'),contextId===contextA?workspaceA:workspaceB);body={opportunities:[]};
  }else assert.fail(`Unexpected mocked provider request: ${parsed.pathname}`);
  return{ok:true,json:async()=>body};
 };
 try{
  // Only transport and unrelated panels are mocked. Context state/guards are the real implementation.
  const provider=load('src/components/customer/CustomerContextProvider.tsx',{'@/components/dashboard-lab/DashboardTransport':{useDashboardFetch:()=>globalThis.fetch,useDashboardPreview:()=>false}});
  const {CustomerAirpropWorkspace:RealWorkspace}=load('src/components/customer/CustomerAirpropWorkspace.tsx',{
   './CustomerContextProvider':provider,
   './CustomerAirpropDiligence':{CustomerAirpropDiligence:()=>null},
   './CustomerAirpropUnderwriting':{CustomerAirpropUnderwriting:()=>null},
   './CustomerAirpropB2':{CustomerAirpropB2Workspace:()=>null},
   '@/lib/airprop/opportunity-contract-v2':load('src/lib/airprop/opportunity-contract-v2.ts'),
  });
  function ContextControls(){
   const state=provider.useCustomerContext();
   // Harness controls exercise the provider API, not the production shell's confirmation UI.
   return React.createElement(React.Fragment,null,
    React.createElement('output',{'data-context-state':'active'},state.active?.context_id??''),
    React.createElement('output',{'data-context-state':'pending'},state.pendingContextId??''),
    React.createElement('button',{type:'button','data-context-control':'a',onClick:()=>state.select(contextA)},'Select context A'),
    React.createElement('button',{type:'button','data-context-control':'b',onClick:()=>state.select(contextB)},'Select context B'),
    React.createElement('button',{type:'button','data-context-control':'cancel',onClick:state.cancelContextChange},'Cancel context change'),
    React.createElement('button',{type:'button','data-context-control':'confirm',onClick:state.confirmContextChange},'Confirm context change'),
    React.createElement(RealWorkspace,{lang:'en'}));
  }
  const contextState=name=>document.querySelector(`[data-context-state="${name}"]`).textContent;
  const control=name=>document.querySelector(`[data-context-control="${name}"]`);
  const values=()=>['name','city','asking_price'].map(name=>document.querySelector(`[name="${name}"]`).value).concat(document.querySelector('form select').value);
  const assertNoMutations=step=>assert.equal(integrationCalls.filter(({options})=>(options.method??'GET')!=='GET').length,0,`${step}: zero mutation requests`);
  await act(async()=>root.render(React.createElement(provider.CustomerContextProvider,null,React.createElement(ContextControls))));
  assert.equal(contextState('active'),contextA);assert.equal(contextState('pending'),'');
  await choose(workspaceA);assert.deepEqual(values(),['','','','EUR']);
  await click(control('b'));
  assert.equal(contextState('active'),contextB,'clean Context A switches through the real provider');
  assert.equal(contextState('pending'),'','clean switch needs no confirmation');
  assert.equal(workspaceSelect().value,'');assert.equal(document.querySelector('form'),null);
  assert.ok(integrationCalls.some(({url})=>url===`/api/customer/v1/dashboard?context_id=${contextB}`));
  assertNoMutations('clean context switch');

  await click(control('a'));await choose(workspaceA);
  await act(async()=>{setInput('name','Unsent context A draft');setInput('city','Cluj');setInput('asking_price','42.5000');setCurrency('RON');});
  const draftForm=document.querySelector('form'),draftValues=['Unsent context A draft','Cluj','42.5000','RON'];
  await click(control('b'));
  assert.equal(contextState('active'),contextA,'dirty context remains active');assert.equal(contextState('pending'),contextB,'real provider records the pending context');
  assert.equal(document.querySelector('form'),draftForm);assert.equal(workspaceSelect().value,workspaceA);assert.deepEqual(values(),draftValues);
  assertNoMutations('dirty context selection');
  await click(control('cancel'));
  assert.equal(contextState('active'),contextA);assert.equal(contextState('pending'),'');
  assert.equal(document.querySelector('form'),draftForm);assert.deepEqual(values(),draftValues,'real cancel retains every draft value');
  assertNoMutations('cancel context change');
  await click(control('b'));assert.equal(contextState('pending'),contextB);await click(control('confirm'));
  assert.equal(contextState('active'),contextB);assert.equal(contextState('pending'),'');
  assert.equal(draftForm.isConnected,false,'confirmed switch removes the old rendered draft');
  assert.equal(workspaceSelect().value,'');assert.equal(document.querySelector('form'),null);
  assertNoMutations('confirm context change');
  await choose(workspaceB);assert.deepEqual(values(),['','','','EUR'],'Context B does not inherit any Context A field');
  await click(control('a'));
  assert.equal(contextState('active'),contextA);assert.equal(contextState('pending'),'','discarded guard does not block clean navigation');
  await choose(workspaceA);assert.deepEqual(values(),['','','','EUR'],'returning to Context A does not restore the discarded draft');
  assertNoMutations('destination and return navigation');
 }finally{
  await act(async()=>root.render(null));
  globalThis.fetch=nativeFetch;
  if(previousContext===null)sessionStorage.removeItem(contextStorageKey);else sessionStorage.setItem(contextStorageKey,previousContext);
 }
}

async function testCommandErrors(){
 const storageKey=`cladora.airprop.pending.v2:${contextA}:${workspaceA}`;
 const pending={version:2,context_id:contextA,workspace_id:workspaceA,idempotency_key:'recovery-errors-01',payload:{name:'Retained intent',country_code:'RO',city:'Cluj',currency:'RON',asking_price:'42.5000',property_id:null,source_ref:null}};
 const serialized=JSON.stringify(pending);
 const submit=async()=>act(async()=>{document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});
 const status=()=>document.querySelector('form [role="status"]').textContent;
 const values=()=>['name','city','asking_price'].map(name=>document.querySelector(`[name="${name}"]`).value).concat(document.querySelector('form select').value);
 const expected={
  en:{session:/session.*unavailable/i,conflict:/blocked.*conflict/i,invalid:/Check the name/,denied:/unavailable with your current access/,mfa:/Verify your identity/,pending:/result is uncertain/,success:/Opportunity saved/},
  ro:{session:/Sesiunea nu este disponibilă/,conflict:/blocată.*conflict/,invalid:/Verifică numele/,denied:/nu este disponibilă cu accesul actual/,mfa:/Confirmă-ți identitatea/,pending:/Rezultatul este incert/,success:/Oportunitate salvată/},
  fa:{session:/نشست.*دسترس نیست/,conflict:/تعارض.*مسدود/,invalid:/نام، شهر و قیمت/,denied:/دسترسی فعلی.*مجاز نیست/,mfa:/هویت خود را تأیید/,pending:/نتیجهٔ درخواست مشخص نیست/,success:/فرصت ثبت شد/},
 };
 let groups=0;
 for(const [lang,text] of Object.entries(expected)){
  for(const restored of [false,true]){
   sessionStorage.removeItem(storageKey);if(restored)sessionStorage.setItem(storageKey,serialized);
   postMode='unauthorized';await render(`401-${lang}-${restored}`,lang);await choose(workspaceA);
   if(!restored)await act(async()=>{setInput('name',pending.payload.name);setInput('city',pending.payload.city);setInput('asking_price','42.5000');setCurrency('RON');});
   const draft=values(),before=mutationCount();await submit();
   assert.equal(mutationCount(),before+1);assert.match(status(),text.session,`${lang}: 401 must explain session failure`);assert.doesNotMatch(status(),text.invalid);
   assert.deepEqual(values(),draft,'401 does not erase the draft');assert.equal(document.querySelectorAll('form [aria-invalid="true"]').length,0);
   assert.equal(document.querySelector('fieldset').disabled,restored,'unknown restored intent stays immutable');
   if(restored){assert.equal(sessionStorage.getItem(storageKey),serialized);assert.deepEqual(JSON.parse(calls.at(-1).options.body),pending);}
   const beforeNavigation=mutationCount();await choose(workspaceB);assert.equal(workspaceSelect().value,workspaceA);await click(document.querySelector('[role="alertdialog"] button'));
   assert.deepEqual(values(),draft);assert.match(status(),text.session);assert.equal(mutationCount(),beforeNavigation,'401 Keep/navigation never posts');
   postMode='success';await submit();assert.match(status(),text.success);assert.equal(sessionStorage.getItem(storageKey),null);
   if(restored)assert.deepEqual(JSON.parse(calls.filter(c=>c.options.method==='POST').at(-1).options.body),pending,'session recovery uses the exact original command');
   groups++;
  }

  sessionStorage.setItem(storageKey,serialized);postMode='conflict';await render(`409-${lang}`,lang);await choose(workspaceA);await submit();
  const conflictPosts=mutationCount();assert.match(status(),text.conflict);assert.doesNotMatch(status(),text.invalid);assert.equal(sessionStorage.getItem(storageKey),serialized);
  assert.equal(document.querySelector('fieldset').disabled,true);assert.equal(document.querySelector('form button').disabled,true,'conflict retry is disabled');
  assert.deepEqual(JSON.parse(calls.filter(c=>c.options.method==='POST').at(-1).options.body),pending);
  await click(document.querySelector('form button'));await submit();assert.equal(mutationCount(),conflictPosts,'even a dispatched submit cannot repeat a blocked conflict');
  // Localized state must survive rerender/locale recovery without replaying or unlocking the command.
  const nextLang=lang==='en'?'ro':'en';await render(`409-${lang}`,nextLang);assert.match(status(),expected[nextLang].conflict);
  assert.equal(document.querySelector('form button').disabled,true);assert.equal(sessionStorage.getItem(storageKey),serialized);assert.equal(mutationCount(),conflictPosts);
  await render(`409-${lang}`,lang);await choose(workspaceB);assert.equal(workspaceSelect().value,workspaceA);await click(document.querySelector('[role="alertdialog"] button'));
  assert.match(status(),text.conflict);assert.equal(document.querySelector('form button').disabled,true);
  await choose(workspaceB);await click(document.querySelectorAll('[role="alertdialog"] button')[1]);
  assert.equal(workspaceSelect().value,workspaceB);assert.deepEqual(values(),['','','','EUR']);assert.equal(document.querySelector('form button').disabled,false,'new scope does not inherit the conflict');
  assert.equal(sessionStorage.getItem(storageKey),serialized);assert.equal(mutationCount(),conflictPosts,'discard/navigation preserves pending evidence without mutation');groups++;

  // Adjacent definitive denials and unknown outcomes retain the existing command semantics.
  for(const mode of ['denied','mfa','uncertain','server']){
   sessionStorage.setItem(storageKey,serialized);postMode=mode;await render(`${mode}-${lang}`,lang);await choose(workspaceA);await submit();
   assert.match(status(),mode==='denied'?text.denied:mode==='mfa'?text.mfa:text.pending);
   assert.equal(sessionStorage.getItem(storageKey),serialized);assert.equal(document.querySelector('fieldset').disabled,true);assert.equal(document.querySelector('form button').disabled,false);
   postMode='success';await submit();assert.deepEqual(JSON.parse(calls.filter(c=>c.options.method==='POST').at(-1).options.body),pending);assert.equal(sessionStorage.getItem(storageKey),null);assert.match(status(),text.success);groups++;
  }
 }
 // Resolve an OLD response body only after leaving and returning to the same scope.
 // It must not delete the restored command, alter the new instance or unblock a newer conflict.
 for(const kind of ['success','unauthorized','conflict'])for(const scope of ['workspace','context']){
  sessionStorage.setItem(storageKey,serialized);await render(`late-${kind}-${scope}`);await choose(workspaceA);
  let resolveBody;postReply=()=>({ok:kind==='success',status:kind==='success'?200:kind==='unauthorized'?401:409,json:()=>new Promise(resolve=>{resolveBody=resolve;})});
  await submit();assert.equal(typeof resolveBody,'function');postReply=null;const beforeNavigation=mutationCount();
  if(scope==='workspace'){
   await choose(workspaceB);await click(document.querySelectorAll('[role="alertdialog"] button')[1]);await choose(workspaceA);
  }else{
   // Model the already-confirmed Context change through the registered discard hook.
   // The real provider's confirmation/cancel implementation is exercised separately below.
   await act(async()=>{for(const discard of guards.values())discard();});
   active={context_id:contextB};await render(`late-${kind}-${scope}`);await choose(workspaceB);
   assert.equal(document.querySelector('[name="name"]').value,'');assert.equal(mutationCount(),beforeNavigation);
   active={context_id:contextA};await render(`late-${kind}-${scope}`);await choose(workspaceA);
  }
  postMode='conflict';await submit();const currentMessage=status(),currentPosts=mutationCount();assert.equal(currentPosts,beforeNavigation+1);assert.equal(document.querySelector('form button').disabled,true);
  await act(async()=>resolveBody(kind==='success'?{version:2,workspace_id:workspaceA,opportunity_id:contextA,idempotent:true}:{error:{code:kind==='unauthorized'?'UNAUTHORIZED':'IDEMPOTENCY_CONFLICT'}}));
  assert.equal(status(),currentMessage);assert.equal(sessionStorage.getItem(storageKey),serialized,'late body cannot erase the current recovery evidence');assert.equal(document.querySelector('form button').disabled,true);assert.equal(mutationCount(),currentPosts);groups++;
 }
 sessionStorage.removeItem(storageKey);postMode='success';postReply=null;
 console.log(`PASS ${groups} mounted command-error groups: EN/RO/FA initial/restored 401, blocked 409, locale/navigation, 403/MFA/network/500/exact replay and stale body fences`);
}

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
 const [keepButton,discardButton]=dialog.querySelectorAll('button');
 const pressKey=async(key,shiftKey=false)=>act(async()=>{const event=new dom.window.KeyboardEvent('keydown',{key,shiftKey,bubbles:true,cancelable:true});document.activeElement.dispatchEvent(event);assert.equal(event.defaultPrevented,true);});
 assert.equal(document.activeElement,keepButton,'opening focuses Keep editing');
 assert.ok(workspaceSelect().closest('[inert]'),'workspace selector is inert');
 assert.ok(document.querySelector('form').closest('[inert]'),'background form is inert');
 await pressKey('Tab');assert.equal(document.activeElement,discardButton);
 await pressKey('Tab');assert.equal(document.activeElement,keepButton,'Tab wraps inside dialog');
 await pressKey('Tab',true);assert.equal(document.activeElement,discardButton,'Shift+Tab wraps inside dialog');
 await pressKey('Tab',true);assert.equal(document.activeElement,keepButton);
 await act(async()=>workspaceSelect().focus());assert.equal(document.activeElement,keepButton,'outside focus is contained');
 const outsideButton=document.querySelector('form button');
 let outsideClicks=0;const recordOutsideClick=()=>outsideClicks++;
 outsideButton.addEventListener('click',recordOutsideClick);
 await click(outsideButton);assert.equal(outsideClicks,0,'background interaction is blocked');
 outsideButton.removeEventListener('click',recordOutsideClick);
 assert.equal(document.querySelector('[name="name"]').value,'Workspace A opportunity');
 assert.equal(document.querySelector('[name="city"]').value,'București');
 assert.equal(document.querySelector('[name="asking_price"]').value,'123.4500');
 assert.equal(document.querySelector('form select').value,'RON');
 assert.equal(mutationCount(),beforeDirtyNavigation,'requesting navigation has zero mutation');
 await click(dialog.querySelectorAll('button')[0]);
 assert.equal(workspaceSelect().value,workspaceA);
 assert.equal(document.querySelector('[role="alertdialog"]'),null);
 assert.equal(document.activeElement,workspaceSelect(),'Keep editing restores selector focus');
 assert.equal(workspaceSelect().closest('[inert]'),null,'background is restored');
 assert.equal(document.querySelector('[name="name"]').value,'Workspace A opportunity','keep editing retains all values');
 assert.equal(document.querySelector('[name="city"]').value,'București');
 assert.equal(document.querySelector('[name="asking_price"]').value,'123.4500');
 assert.equal(document.querySelector('form select').value,'RON');
 await choose(workspaceB);await pressKey('Escape');
 assert.equal(document.querySelector('[role="alertdialog"]'),null,'Escape closes confirmation');
 assert.equal(document.activeElement,workspaceSelect(),'Escape restores selector focus');
 assert.equal(workspaceSelect().value,workspaceA);
 assert.equal(document.querySelector('[name="name"]').value,'Workspace A opportunity');
 assert.equal(document.querySelector('[name="city"]').value,'București');
 assert.equal(document.querySelector('[name="asking_price"]').value,'123.4500');
 assert.equal(document.querySelector('form select').value,'RON');
 assert.equal(mutationCount(),beforeDirtyNavigation,'closing confirmation has zero mutation');
 await choose(workspaceB);dialog=document.querySelector('[role="alertdialog"]');
 await click(dialog.querySelectorAll('button')[1]);
 assert.equal(workspaceSelect().value,workspaceB,'discard switches to workspace B');
 assert.equal(document.activeElement,workspaceSelect(),'Discard focuses the destination workspace selector');
 assert.equal(document.querySelector('[inert]'),null,'Discard restores background interaction');
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

 await testCommandErrors();
 await testRealContextProvider();

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
 console.log('PASS actual rendered AIRPROP UI: real Context provider integration, draft guards, workspace/context navigation, EN/RO/FA, pending exact retry, zero-mutation navigation and existing regressions');
}finally{
 await act(async()=>root.unmount());globalThis.fetch=originalFetch;
 for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}
 dom.window.close();
}
