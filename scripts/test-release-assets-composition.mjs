// Release test adapter: browser HTMLElement/Event constructors; original assertions retained.
// Offline mounted UI with explicit fake transport. No server authority or persistence proof.
import assert from 'node:assert/strict';
import {createRequire, Module} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const base=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(resolve(base,'package.json'));
const {JSDOM}=require('jsdom'),ts=require('typescript');
const dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test/en/app/assets'}),saved=new Map(),oldFetch=globalThis.fetch;
for(const [key,value]of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,FormData:dom.window.FormData,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
const React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
const scope=(id,member=`member-${id}`)=>({context_id:id,membership_id:member,role_code:'manager',scope_type:'workspace',context_label:`Building ${id}`});
let active=scope('A'),loading=false,error=null,dashboard={contextId:'A'},lang='en',root,requests=[],checks=0;
const ok=(value,label)=>{assert.ok(value,label);checks++;};
const same=(a,b,label)=>{assert.equal(a,b,label);checks++;};
let holdPassiveCleanup=false;const heldCleanups=[];
// Test adapter forwards the component dependency list unchanged; only cleanup is delayed.
// eslint-disable-next-line react-hooks/exhaustive-deps
const instrumentedReact={...React,useEffect:(effect,deps)=>React.useEffect(()=>{const cleanup=effect();return()=>{if(holdPassiveCleanup&&cleanup)heldCleanups.push(cleanup);else cleanup?.();};},deps)};
const cache=new Map();
function load(name){if(cache.has(name))return cache.get(name);const filename=resolve(base,'src/components/customer',name),m=new Module(filename);m.require=id=>id==='react'?instrumentedReact:id==='./CustomerContextProvider'?{useCustomerContext:()=>({active,loading,error,dashboard})}:id==='./EquipmentRegistrationPanel'?load('EquipmentRegistrationPanel.tsx'):require(id);const input=process.argv.includes('--classification-preimage')&&name==='CustomerAssetsDashboard.tsx'?resolve(base,'../procedure260-1-artifacts/preimages/src/components/customer/CustomerAssetsDashboard.tsx'):process.argv.includes('--probe-registration-denial')?resolve(base,`../procedure256-1-artifacts/${name}.before-extension`):process.argv.includes('--probe-preimage')&&name==='CustomerAssetsDashboard.tsx'?resolve(process.argv.find(arg=>arg.startsWith('--preimage='))?.slice('--preimage='.length)??resolve(base,'../procedure256-1-artifacts/CustomerAssetsDashboard.preimage.tsx')):filename;m._compile(ts.transpileModule(readFileSync(input,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,filename);cache.set(name,m.exports);return m.exports;}
const View=load('CustomerAssetsDashboard.tsx').CustomerAssetsDashboard;
globalThis.fetch=(url,init={})=>new Promise((resolve,reject)=>requests.push({url:String(url),init,resolve,reject,done:false}));
const text=()=>document.body.textContent;
const render=()=>act(async()=>root.render(React.createElement(View,{lang})));
const wait=()=>act(async()=>new Promise(resolve=>setTimeout(resolve,120)));
const asset=(id)=>({id,asset_code:id,name:id,scope:'building',ownership_type:'owned',lifecycle_status:'active',operational_status:'operational',condition:'good',criticality_level:'normal',is_safety_critical:false,currency:'RON'});
async function reply(r,body,status=200){ok(!!r&&!r.done,'one explicit response');r.done=true;await act(async()=>r.resolve(new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}})));}
const pending=(needle)=>requests.find(r=>!r.done&&r.url.includes(needle));
async function click(label){const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===label);assert.ok(b,`button ${label}`);await act(async()=>b.click());}
async function select(id){const row=[...document.querySelectorAll('tbody tr')].find(e=>e.textContent.includes(id));assert.ok(row,`row ${id}`);await act(async()=>row.click());}
async function fresh(id='A'){if(root)await act(async()=>root.unmount());document.getElementById('root').replaceChildren();root=createRoot(document.getElementById('root'));requests=[];active=scope(id);loading=false;error=null;dashboard={contextId:id};await render();await wait();}
async function switchTo(id,member){active=scope(id,member);dashboard={contextId:id};await render();}
async function list(items){await reply(requests.findLast(r=>!r.done&&r.url.includes('/assets?')),{items:items.map(asset)});}
async function details(id){await reply(pending(`/assets/${id}?`),asset(id));await reply(pending(`/assets/${id}/inspections?`),{items:[]});await reply(pending(`/assets/${id}/warranty/claims?`),{items:[]});}
const locations={properties:[{id:'property',name:'PRIVATE_CURRENT_LOCATION'}],buildings:[],building_required:false};
async function registrationReady(){await fresh();await list(['PRIVATE_CURRENT_ASSET']);await click('Register equipment');await reply(pending('/assets/registration?'),locations);}
async function submitRegistration(){const form=document.querySelector('form');assert.ok(form,'registration form');form.querySelector('[name="code"]').value='SYNTHETIC';form.querySelector('[name="name"]').value='Synthetic equipment';await act(async()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));return requests.findLast(r=>!r.done&&r.init.method==='POST');}
async function registrationCoverage(){
 // Both canonical denial classes propagate from the actual child to its parent.
 for(const phase of ['GET','POST'])for(const status of [401,403]){
  await fresh();await list(['PRIVATE_CURRENT_ASSET']);await select('PRIVATE_CURRENT_ASSET');const oldDetail=pending('/assets/PRIVATE_CURRENT_ASSET?');await click('Register equipment');let request=pending('/assets/registration?');if(phase==='POST'){await reply(request,locations);request=await submitRegistration();}
  await reply(request,{error:{code:status===401?'UNAUTHORIZED':'FORBIDDEN'}},status);ok(!text().includes('PRIVATE_CURRENT_ASSET')&&!text().includes('PRIVATE_CURRENT_LOCATION'),`${phase}${status} removes parent and child private state`);ok(!document.querySelector('form'),'denied form removed');const count=requests.length;await reply(oldDetail,asset('LEAK_AFTER_DENIAL'));same(requests.length,count,'old parent detail continuation invalidated');ok(!text().includes('LEAK_AFTER_DENIAL'),'denial prevents parent restoration');await click('Retry');await wait();await list(['REAUTHORIZED']);ok(text().includes('REAUTHORIZED'),'explicit retry requires fresh current result');ok(!text().includes('PRIVATE_CURRENT_LOCATION'),'retry does not restore choices');
 }
 // Existing operational errors are not converted to a denial of the binding.
 for(const failure of ['transport','validation','conflict','server','mfa','origin','malformed']){
  await registrationReady();const request=await submitRegistration();
  if(failure==='transport'){request.done=true;await act(async()=>request.reject(new Error('synthetic network error')));}
  else if(failure==='malformed'){request.done=true;await act(async()=>request.resolve({ok:false,status:500,json:async()=>{throw new Error('invalid JSON');}}));}
  else {const status={validation:400,conflict:409,server:500,mfa:403,origin:403}[failure],code={validation:'INVALID_REQUEST',conflict:'DUPLICATE_RECORD',server:'INTERNAL_SERVER_ERROR',mfa:'MFA_REQUIRED',origin:'BAD_ORIGIN'}[failure];await reply(request,{error:{code}},status);}
  ok(text().includes('PRIVATE_CURRENT_ASSET')&&text().includes('PRIVATE_CURRENT_LOCATION'),`${failure} does not invalidate current binding`);ok(!!document.querySelector('form'),`${failure} form stays available`);ok(!text().includes('Equipment registered.'),`${failure} is not success`);ok(![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Register').disabled,`${failure} clears own busy`);if(failure==='mfa')ok(text().includes('Critical equipment requires MFA'),'existing MFA copy preserved');
 }
 for(const failure of ['transport','validation','server']){await fresh();await list(['READ_SAFE']);await click('Register equipment');const r=pending('/assets/registration?');if(failure==='transport'){r.done=true;await act(async()=>r.reject(new Error('network')));}else await reply(r,{error:{code:failure==='validation'?'INVALID_REQUEST':'INTERNAL_SERVER_ERROR'}},failure==='validation'?400:500);ok(text().includes('READ_SAFE'),`GET ${failure} leaves parent binding`);ok(!document.querySelector('form'),'failed choices read does not create form');}
 // Success is still the existing response followed by a current list reload.
 await registrationReady();const command=await submitRegistration();same(JSON.parse(command.init.body).context_id,'A','existing wire context unchanged');const n=requests.filter(r=>r.init.method==='POST').length;const form=document.querySelector('form');await act(async()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));same(requests.filter(r=>r.init.method==='POST').length,n,'synchronous duplicate submit blocked');await reply(command,{id:'registered'});ok(text().includes('Equipment registered.'),'canonical response retains success copy');ok(!!pending('/assets?'),'success refreshes parent');await list(['CANONICAL_REGISTERED']);ok(text().includes('CANONICAL_REGISTERED'),'parent displays fresh read');
 // Binding changes and unmount must win before passive cleanup; test stale denial and success.
 for(const phase of ['GET','POST'])for(const result of ['denial','success','transport']){
  await fresh();await list(['OLD_A']);await click('Register equipment');let held=pending('/assets/registration?');if(phase==='POST'){await reply(held,locations);held=await submitRegistration();}
  holdPassiveCleanup=true;await switchTo('B');ok(heldCleanups.length>0,'passive cleanup explicitly held');await wait();await list(['CURRENT_B']);const count=requests.length;
  if(result==='transport'){held.done=true;await act(async()=>held.reject(new Error('PRIVATE_OLD_ERROR')));}else await reply(held,result==='denial'?{error:{code:'FORBIDDEN'}}:phase==='GET'?locations:{id:'old'},result==='denial'?403:200);
  same(requests.length,count,`${phase} stale ${result} no follow-up`);ok(text().includes('CURRENT_B')&&!text().includes('PRIVATE_CURRENT_LOCATION')&&!text().includes('Equipment registered.')&&!text().includes('PRIVATE_OLD_ERROR'),`${phase} stale ${result} cannot invalidate or reveal in B`);holdPassiveCleanup=false;await act(async()=>{for(const cleanup of heldCleanups.splice(0))cleanup();});ok(text().includes('CURRENT_B'),'old passive cleanup cannot clear B');
 }
 // Same-context membership change, readiness close/reopen and unmount are new lifetimes too.
 for(const change of ['membership','readiness','unmount']){await registrationReady();const r=await submitRegistration();holdPassiveCleanup=true;if(change==='membership'){active=scope('A','replacement');await render();await wait();await list(['NEW_MEMBER']);}if(change==='readiness'){loading=true;await render();loading=false;await render();await wait();await list(['NEW_MEMBER']);}if(change==='unmount'){await act(async()=>root.unmount());root=null;}const count=requests.length;await reply(r,{error:{code:'FORBIDDEN'}},403);same(requests.length,count,`${change} old denial no read`);ok(!text().includes('PRIVATE_CURRENT_LOCATION'),`${change} private form absent`);if(change!=='unmount')ok(text().includes('NEW_MEMBER'),`${change} new parent survives denial`);holdPassiveCleanup=false;await act(async()=>{for(const cleanup of heldCleanups.splice(0))cleanup();});}
 // Open/close read owners: late old403 cannot invalidate a reopened form.
 await fresh();await list(['CURRENT']);await click('Register equipment');const oldChoices=pending('/assets/registration?');await click('Close');await click('Register equipment');await reply(requests.findLast(r=>!r.done&&r.url.includes('/registration?')),locations);await reply(oldChoices,{error:{code:'FORBIDDEN'}},403);ok(text().includes('CURRENT')&&!!document.querySelector('form'),'old open-generation denial ignored');
 // JSON decode itself can be suspended across binding commit.
 for(const phase of ['GET','POST']){await fresh();await list(['JSON_A']);await click('Register equipment');let r=pending('/assets/registration?');if(phase==='POST'){await reply(r,locations);r=await submitRegistration();}let release;r.done=true;await act(async()=>r.resolve({ok:false,status:403,json:()=>new Promise(resolve=>{release=resolve;})}));await switchTo('B');await wait();await list(['JSON_B']);await act(async()=>release({error:{code:'FORBIDDEN'}}));ok(text().includes('JSON_B'),`${phase} JSON late denial ignored`);}
 // Registration-specific UI and denial path in all supported languages.
 for(const locale of ['ro','en','fa']){lang=locale;await fresh();await list(['LOCALE']);await click({ro:'Înregistrează echipament',en:'Register equipment',fa:'ثبت تجهیز جدید'}[locale]);same(document.querySelector('section').dir,locale==='fa'?'rtl':'ltr','registration direction');await reply(pending('/assets/registration?'),{error:{code:'FORBIDDEN'}},403);ok(!text().includes('LOCALE'),`${locale} registration denial removes parent`);same(document.querySelector('[role="alert"]').dir,locale==='fa'?'rtl':'ltr','denial direction');}
 console.log(`PASS_REGISTRATION ${checks} checks; actual parent+child; fake provider/transport; runtime NOT_RUN_NOT_PASS`);
}
async function startAction(action){
 await fresh();await list(['CLASSIFIED_ASSET']);await select('CLASSIFIED_ASSET');await reply(pending('/assets/CLASSIFIED_ASSET?'),{...asset('CLASSIFIED_ASSET'),...(action==='end'?{active_downtime:{id:'down',started_at:'2026-10-28',reason:'synthetic'}}:{})});await reply(pending('/inspections?'),{items:action==='verify'?[{id:'i',inspection_type:'annual',scheduled_date:'2026-10-28',result:'passed',is_verified:false}]:[]});await reply(pending('/warranty/claims?'),{items:[]});
 if(action==='start'){await click('Downtime Log');await click('+ Start Downtime');await click('Confirm Downtime');}
 if(action==='end'){await click('Downtime Log');await click('End Downtime');}
 if(action==='record'){await click('Inspections');await click('+ Record Inspection');await click('Save Inspection');}
 if(action==='verify'){await click('Inspections');await click('Verify & Certify (AAL2)');}
 if(action==='decommission'){await click('Decommission');await click('Request Decommission');await click('Submit Decommission Request');}
 return requests.findLast(r=>!r.done&&r.init.method==='POST');
}
async function familyRequest(family){
 if(['start','end','record','verify','decommission'].includes(family))return startAction(family);
 await fresh();await list(['CLASSIFIED_ASSET']);
 if(family==='list'){await click('Refresh');return pending('/assets?');}
 await select('CLASSIFIED_ASSET');if(family==='detail')return pending('/assets/CLASSIFIED_ASSET?');
 await reply(pending('/assets/CLASSIFIED_ASSET?'),asset('CLASSIFIED_ASSET'));if(family==='inspection')return pending('/inspections?');await reply(pending('/inspections?'),{items:[]});return pending('/warranty/claims?');
}
async function classificationCoverage(preimage=false){
 if(preimage){for(const [family,code]of [['list','MFA_REQUIRED'],['start','BAD_ORIGIN']]){const r=await familyRequest(family);await reply(r,{error:{code,message:'Operation-specific failure'}},403);ok(!text().includes('CLASSIFIED_ASSET')&&![...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Register equipment'),`${family} wrongly invalidates whole binding`);}console.log(`CLASSIFICATION_COUNTEREXAMPLE_REPRODUCED ${checks} checks; exact256-1 successor; fake transport only`);return;}
 const families=['list','detail','inspection','warranty','start','end','record','verify','decommission'];
 const cases=[{name:'auth',status:401,code:'UNAUTHORIZED',deny:true},{name:'permission',status:403,code:'FORBIDDEN',deny:true},...['MFA_REQUIRED','BAD_ORIGIN','DUAL_CONTROL_VIOLATION','UNKNOWN_CODE'].map(code=>({name:code,status:403,code})),{name:'wrong401',status:401,code:'FORBIDDEN'},{name:'wrong403',status:403,code:'UNAUTHORIZED'},{name:'validation',status:400,code:'INVALID_REQUEST'},{name:'conflict',status:409,code:'IMMUTABLE_RECORD'},{name:'server',status:500,code:'FORBIDDEN'},{name:'missing-code',status:403,raw:'{"error":{"message":"no code"}}'},{name:'null',status:403,raw:'null'},{name:'array',status:403,raw:'[]'},{name:'malformed',status:403,raw:'<html>not JSON</html>'},{name:'oversize',status:403,raw:JSON.stringify({error:{code:'FORBIDDEN',message:'x'.repeat(20000)}})},{name:'invalid-message',status:403,raw:JSON.stringify({error:{code:'FORBIDDEN',message:[]}})},{name:'long-message',status:401,raw:JSON.stringify({error:{code:'UNAUTHORIZED',message:'x'.repeat(513)}})},{name:'invalid-code',status:403,raw:'{"error":{"code":42}}'},{name:'long-code',status:403,raw:JSON.stringify({error:{code:'x'.repeat(65)}})},{name:'transport'}];
 for(const family of families){
  for(const failure of cases){const r=await familyRequest(family),count=requests.length;
   if(failure.name==='transport'){r.done=true;await act(async()=>r.reject(new Error('synthetic transport failure')));}
   else if(failure.raw!==undefined){r.done=true;await act(async()=>r.resolve(new Response(failure.raw,{status:failure.status})));}
   else await reply(r,{error:{code:failure.code,message:'Operation-specific failure'}},failure.status);
   const hasRegistration=[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Register equipment');
   same(hasRegistration,!failure.deny,`${family}/${failure.name}: only exact pair invalidates binding`);
   ok(!text().includes('Operation executed successfully'),`${family}/${failure.name} cannot become success`);
   same(requests.length,count,`${family}/${failure.name} cannot trigger follow-up reads`);
   if(failure.deny)ok(!text().includes('CLASSIFIED_ASSET'),`${family} canonical denial clears private data`);
   else if(family!=='list')ok(text().includes('CLASSIFIED_ASSET'),`${family} operation failure retains current admitted list`);
  }
  // Every family: denial, operation failure, malformed and streamed error decoding after Context change.
  for(const failure of [{status:403,body:{error:{code:'FORBIDDEN'}}},{status:401,body:{error:{code:'UNAUTHORIZED'}}},{status:403,body:{error:{code:'MFA_REQUIRED'}}},{status:403,raw:'invalid JSON'}]){const r=await familyRequest(family);holdPassiveCleanup=true;await switchTo('B');await wait();await list(['CURRENT_CLASSIFIED_B']);const count=requests.length;r.done=true;await act(async()=>r.resolve(new Response(failure.raw??JSON.stringify(failure.body),{status:failure.status})));same(requests.length,count,`${family} late response starts no chain`);ok(text().includes('CURRENT_CLASSIFIED_B')&&!text().includes('CLASSIFIED_ASSET'),`${family} late response cannot invalidate B`);holdPassiveCleanup=false;await act(async()=>{for(const cleanup of heldCleanups.splice(0))cleanup();});}
  const r=await familyRequest(family);let stream;const response=new Response(new ReadableStream({start(controller){stream=controller;}}),{status:403});r.done=true;await act(async()=>r.resolve(response));await switchTo('B');await wait();await list(['CURRENT_STREAM_B']);await act(async()=>{stream.enqueue(new TextEncoder().encode('{"error":{"code":"FORBIDDEN"}}'));stream.close();});ok(text().includes('CURRENT_STREAM_B'),`${family} guard after bounded body decode`);
  // A closed readiness never grants a view, even if late operation failure is non-authoritative.
  const hidden=await familyRequest(family);loading=true;await render();await reply(hidden,{error:{code:'MFA_REQUIRED'}},403);ok(!text().includes('CLASSIFIED_ASSET'),`${family} operation-specific error cannot reopen readiness`);
 }
 console.log(`PASS_CLASSIFICATION ${checks} checks;9 parent families; fake transport/provider; real runtime NOT_RUN_NOT_PASS`);
}
try{
 if(process.argv.includes('--classification-preimage')){await classificationCoverage(true);}
 else if(process.argv.includes('--classification-only')){await classificationCoverage();}
 else if(process.argv.includes('--registration-only')){await registrationCoverage();}
 else{
 await fresh();const a=pending('/assets?');await switchTo('B');await wait();const b=pending('context_id=B');await reply(b,{items:[asset('PRIVATE_B')]});ok(text().includes('PRIVATE_B'),'current B admitted');await reply(a,{items:[asset('PRIVATE_A')]});
 if(process.argv.includes('--probe-preimage')){ok(text().includes('PRIVATE_A')&&!text().includes('PRIVATE_B'),'exact late A replaces B counterexample');same(active.context_id,'B');console.log(`PREIMAGE_COUNTEREXAMPLE_REPRODUCED ${checks} checks; mounted/fake only`);}
 else if(process.argv.includes('--probe-registration-denial')){
 await fresh();await list(['PRIVATE_CURRENT_ASSET']);await click('Register equipment');await reply(pending('/assets/registration?'),{properties:[{id:'property',name:'PRIVATE_CURRENT_LOCATION'}],buildings:[],building_required:false});const form=document.querySelector('form');form.querySelector('[name="code"]').value='TEST';form.querySelector('[name="name"]').value='TEST';await act(async()=>form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));await reply(requests.find(r=>r.init.method==='POST'),{error:{code:'FORBIDDEN'}},403);ok(text().includes('PRIVATE_CURRENT_LOCATION')&&text().includes('PRIVATE_CURRENT_ASSET'),'registration denial is not propagated by read-only child');console.log('KNOWN_OUT_OF_SCOPE_REGISTRATION_DENIAL_REPRODUCED: actual child retains current choices and does not notify parent. Not an acceptance PASS.');
 }
 else{
 ok(!text().includes('PRIVATE_A')&&text().includes('PRIVATE_B'),'late A cannot replace B');
 // Positive forward order and immediate disappearance before the new response.
 await fresh();await list(['CURRENT_A']);await switchTo('B');ok(!text().includes('CURRENT_A'),'A hidden at binding commit');await wait();await list(['CURRENT_B']);ok(text().includes('CURRENT_B'),'fresh B visible');
 // ABA and a response whose JSON is still pending must retain the original owner.
 await fresh();const ancientA=pending('/assets?');await switchTo('B');await wait();await list(['B']);await switchTo('A');await wait();await reply(requests.at(-1),{items:[asset('NEW_A')]});await reply(ancientA,{items:[asset('ANCIENT_A')]});ok(text().includes('NEW_A')&&!text().includes('ANCIENT_A'),'A→B→A does not reuse old generation');
 await fresh();const jsonRequest=pending('/assets?');let releaseJson;jsonRequest.done=true;await act(async()=>jsonRequest.resolve({ok:true,status:200,json:()=>new Promise(resolve=>{releaseJson=resolve;})}));await switchTo('B');await wait();await list(['JSON_B']);await act(async()=>releaseJson({items:[asset('PRIVATE_JSON_A')]}));ok(text().includes('JSON_B')&&!text().includes('PRIVATE_JSON_A'),'JSON continuation checks owner after await');
 // Explicit cleanup-gap stress: defer passive cleanup only; layout cleanup remains real.
 await fresh();await list(['GAP_A']);await select('GAP_A');const gap=pending('/assets/GAP_A?');holdPassiveCleanup=true;await switchTo('B');ok(heldCleanups.length>0,'passive cleanup intentionally still pending');ok(!text().includes('GAP_A'),'private drawer removed before passive cleanup');await wait();await list(['GAP_B']);const gapCount=requests.length;await reply(gap,asset('GAP_LATE_A'));same(requests.length,gapCount,'old continuation cannot chain before passive cleanup');ok(text().includes('GAP_B')&&!text().includes('GAP_LATE_A'),'layout owner guards cleanup gap');holdPassiveCleanup=false;await act(async()=>{for(const cleanup of heldCleanups.splice(0))cleanup();});ok(text().includes('GAP_B'),'old cleanup cannot clear new owner');
 // Same context membership, role, scope and closed provider readiness all remount.
 for(const change of ['membership','role','scope','loading','error','dashboard','none']){
  await fresh();await list(['PRIVATE_OLD']);const before=requests.length;
  if(change==='membership')active=scope('A','member-replaced');if(change==='role')active={...active,role_code:'viewer'};if(change==='scope')active={...active,scope_type:'building'};
  if(change==='loading')loading=true;if(change==='error')error='denied';if(change==='dashboard')dashboard={contextId:'B'};if(change==='none')active=null;
  await render();ok(!text().includes('PRIVATE_OLD'),`${change} hides old data immediately`);await wait();
  if(['loading','error','dashboard','none'].includes(change)){same(requests.length,before,`${change} starts no read`);active=scope('A');loading=false;error=null;dashboard={contextId:'A'};await render();ok(!text().includes('PRIVATE_OLD'),'reopening does not resurrect');await wait();}
  await list(['FRESH']);ok(text().includes('FRESH'),`${change} fresh read`);
 }
 // Last request wins within a binding; stale finally must not unlock newer busy read.
 await fresh();const first=pending('/assets?');await act(async()=>{const filter=document.querySelector('select');filter.value='operational';filter.dispatchEvent(new window.Event('change',{bubbles:true}));});await wait();const second=requests.at(-1);assert.notEqual(first,second);await reply(first,{items:[asset('OLD_READ')]});ok(!text().includes('OLD_READ'),'same-binding stale result ignored');ok([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Refresh').disabled,'stale finally preserves newer busy');await reply(second,{items:[asset('NEW_READ')]});ok(text().includes('NEW_READ'),'latest read accepted');
 // Denial blocks the whole subtree, including registration; old continuations stay inert after retry.
 for(const status of [401,403]){await fresh();await list(['SECRET']);await select('SECRET');const oldDetail=pending('/assets/SECRET?');await click('Refresh');await reply(pending('/assets?'),{error:{code:status===401?'UNAUTHORIZED':'FORBIDDEN',message:'deny'}},status);ok(!text().includes('SECRET'),'denial removes all previous data');ok(!text().includes('Register equipment'),'denial removes registration');await click('Retry');await wait();await list(['AFTER_RETRY']);await reply(oldDetail,asset('LEAK'));ok(!text().includes('LEAK'),'retry never revives old owner');ok(text().includes('AFTER_RETRY'),'new owner survives');}
 // Detail, inspection and warranty suspension points across A→B.
 for(const stage of ['detail','inspection','warranty']){await fresh();await list(['EQUIPMENT_A']);await select('EQUIPMENT_A');let held=pending('/assets/EQUIPMENT_A?');if(stage!=='detail'){await reply(held,asset('EQUIPMENT_A'));held=pending('/inspections?');}if(stage==='warranty'){await reply(held,{items:[]});held=pending('/warranty/claims?');}await switchTo('B');ok(!text().includes('EQUIPMENT_A'),'drawer hidden on commit');await wait();await list(['EQUIPMENT_B']);const count=requests.length;await reply(held,stage==='detail'?asset('PRIVATE_LATE_DETAIL'):{items:[]});same(requests.length,count,`${stage} cannot chain old reads`);ok(text().includes('EQUIPMENT_B')&&!text().includes('PRIVATE_LATE_DETAIL'),`${stage} late owner inert`);}
 // Different selections in the same binding: private child records must not cross drawers.
 await fresh();await list(['ONE','TWO']);await select('ONE');await reply(pending('/assets/ONE?'),asset('ONE'));const inspection=pending('/inspections?');await select('TWO');await details('TWO');await reply(inspection,{items:[{id:'i',inspection_type:'PRIVATE_INSPECTION',scheduled_date:'2026-10-28',result:'passed'}]});await click('Inspections');ok(!text().includes('PRIVATE_INSPECTION'),'inspection does not cross selection');
 await fresh();await list(['ONE','TWO']);await select('ONE');await reply(pending('/assets/ONE?'),asset('ONE'));await reply(pending('/inspections?'),{items:[]});const warranty=pending('/warranty/claims?');await select('TWO');await details('TWO');await reply(warranty,{items:[{id:'c',claim_reference:'PRIVATE_CLAIM',description:'PRIVATE_CLAIM',resolution_status:'open'}]});await click('Warranty & Claims');ok(!text().includes('PRIVATE_CLAIM'),'warranty does not cross selection');
 // Current denial at each detail stage blocks the registry, not only a child table.
 for(const stage of ['detail','inspection','warranty']){await fresh();await list(['SECRET']);await select('SECRET');if(stage!=='detail')await reply(pending('/assets/SECRET?'),asset('SECRET'));if(stage==='warranty')await reply(pending('/inspections?'),{items:[]});await reply(requests.find(r=>!r.done),{error:{code:'FORBIDDEN'}},403);ok(!text().includes('SECRET')&&!text().includes('Register equipment'),`${stage} deny closes registry`);}
 // In-flight POST may already have reached the server; its UI continuation cannot refresh another binding.
 await fresh();await list(['POST_A']);await select('POST_A');await details('POST_A');await click('Downtime Log');await click('+ Start Downtime');await click('Confirm Downtime');const post=requests.find(r=>r.init.method==='POST');ok(!!post,'real action sends existing POST');await switchTo('B');await wait();await list(['POST_B']);const count=requests.length;await reply(post,{});same(requests.length,count,'old POST cannot trigger read in B');ok(text().includes('POST_B')&&!text().includes('Operation executed successfully'),'no stale POST success');
 // Positive child reads remain functional; all existing action families reject stale continuations.
 await fresh();await list(['CHILD']);await select('CHILD');await reply(pending('/assets/CHILD?'),asset('CHILD'));await reply(pending('/inspections?'),{items:[{id:'i',inspection_type:'CURRENT_INSPECTION',scheduled_date:'2026-10-28',result:'passed',is_verified:false}]});await reply(pending('/warranty/claims?'),{items:[{id:'c',claim_reference:'CURRENT_CLAIM',description:'claim',resolution_status:'open'}]});await click('Inspections');ok(text().includes('CURRENT INSPECTION'),'current inspection admitted');await click('Warranty & Claims');ok(text().includes('CURRENT_CLAIM'),'current warranty admitted');
 for(const action of ['end','record','verify','decommission']){
  await fresh();await list(['ACTION']);await select('ACTION');await reply(pending('/assets/ACTION?'),{...asset('ACTION'),...(action==='end'?{active_downtime:{id:'down',started_at:'2026-10-28',reason:'reason'}}:{})});await reply(pending('/inspections?'),{items:action==='verify'?[{id:'i',inspection_type:'annual',scheduled_date:'2026-10-28',result:'passed',is_verified:false}]:[]});await reply(pending('/warranty/claims?'),{items:[]});
  if(action==='end'){await click('Downtime Log');await click('End Downtime');}
  if(action==='record'){await click('Inspections');await click('+ Record Inspection');await click('Save Inspection');}
  if(action==='verify'){await click('Inspections');await click('Verify & Certify (AAL2)');}
  if(action==='decommission'){await click('Decommission');await click('Request Decommission');await click('Submit Decommission Request');}
  const command=requests.find(r=>r.init.method==='POST');ok(!!command,`${action} existing request emitted`);same(JSON.parse(command.init.body).context_id,'A','original Context sent');await switchTo('B');await wait();await list(['CURRENT_B']);const count=requests.length;await reply(command,{});same(requests.length,count,`${action} cannot chain across binding`);ok(text().includes('CURRENT_B')&&!text().includes('Operation executed successfully'),`${action} old success hidden`);
 }
 // Current canonical action response still refreshes its own current observation.
 await fresh();await list(['VALID']);await select('VALID');await details('VALID');await click('Downtime Log');await click('+ Start Downtime');await click('Confirm Downtime');await reply(requests.find(r=>r.init.method==='POST'),{});ok(text().includes('Operation executed successfully'),'current response preserves existing success');ok(!!pending('/assets/VALID?')&&!!pending('/assets?'),'current response triggers only current reads');
 // Denial from the current POST removes the complete private subtree.
 await fresh();await list(['DENIED_POST']);await select('DENIED_POST');await details('DENIED_POST');await click('Downtime Log');await click('+ Start Downtime');await click('Confirm Downtime');await reply(requests.find(r=>r.init.method==='POST'),{error:{code:'FORBIDDEN'}},403);ok(!text().includes('DENIED_POST')&&!text().includes('Register equipment'),'POST denial closes registry');
 // Parent protects actual registration child and its callbacks across the full binding.
 await fresh();await list(['REG_A']);await click('Register equipment');const registration=pending('/assets/registration?');await switchTo('B');await wait();await list(['REG_B']);await reply(registration,{properties:[{id:'private',name:'PRIVATE_LOCATION'}],buildings:[],building_required:false});ok(!text().includes('PRIVATE_LOCATION'),'registration child unmounted with binding');
 // Stale rejection cannot leak an error or clear B's loading flag.
 await fresh();const rejected=pending('/assets?');await switchTo('B');await wait();rejected.done=true;await act(async()=>rejected.reject(new Error('PRIVATE_ERROR_A')));ok(!text().includes('PRIVATE_ERROR_A'),'stale catch ignored');ok([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Refresh').disabled,'stale error finally preserves B busy');await list(['VALID_B']);ok(text().includes('VALID_B'),'B settles independently');
 // Unmount invalidates detail and POST continuations before they can start follow-up reads.
 for(const stage of ['detail','post']){await fresh();await list(['UNMOUNT']);await select('UNMOUNT');let held=pending('/assets/UNMOUNT?');if(stage==='post'){await details('UNMOUNT');await click('Downtime Log');await click('+ Start Downtime');await click('Confirm Downtime');held=requests.find(r=>r.init.method==='POST');}await act(async()=>root.unmount());root=null;const count=requests.length;await reply(held,stage==='detail'?asset('PRIVATE_UNMOUNT'):{});same(requests.length,count,`${stage} unmount prevents chaining`);ok(!text().includes('PRIVATE_UNMOUNT'),'unmounted private data absent');}
 // Old response after readiness closes, same-context reopen, and unmount: no resurrection/chain.
 await fresh();await list(['SAFE']);await select('SAFE');const old=pending('/assets/SAFE?');loading=true;await render();ok(!text().includes('SAFE'),'readiness closes drawer');loading=false;await render();await wait();await list(['NEW_SAFE']);const before=requests.length;await reply(old,asset('REAPPEARED'));same(requests.length,before,'old owner cannot chain after same-context reopen');ok(!text().includes('REAPPEARED'),'old detail cannot resurrect');
 await fresh();const outstanding=pending('/assets?');await act(async()=>root.unmount());root=null;const n=requests.length;await reply(outstanding,{items:[asset('UNMOUNTED')]});same(requests.length,n,'unmounted read inert');ok(!text().includes('UNMOUNTED'),'no unmounted UI');
 for(const locale of ['ro','en','fa']){lang=locale;await fresh();await list(['CURRENT_LOCALE']);ok(text().includes('CURRENT_LOCALE'),`${locale} positive read`);loading=true;await render();ok(!text().includes('CURRENT_LOCALE'),`${locale} readiness privacy`);same(document.querySelector('[role="status"]').dir,locale==='fa'?'rtl':'ltr',`${locale} direction`);}
 console.log(`PASS ${checks} checks; actual React/JSDOM components, fake transport/provider; real HTTP/DB/Auth/browser/staging NOT_RUN_NOT_PASS`);
 }
}
}finally{holdPassiveCleanup=false;for(const cleanup of heldCleanups.splice(0))cleanup();if(root)await act(async()=>root.unmount());globalThis.fetch=oldFetch;for(const[key,desc]of saved)if(desc)Object.defineProperty(globalThis,key,desc);else delete globalThis[key];dom.window.close();}
