import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
const wizardOnly=process.env.BUILDING_SETUP_WIZARD_ONLY==='1';
const reviewOnly=process.env.BUILDING_SETUP_REVIEW_ONLY==='1';
const require=createRequire(import.meta.url),dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test'}),saved=new Map();
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,FormData:dom.window.FormData,sessionStorage:dom.window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const originalFetch=globalThis.fetch;
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url)),mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;}
const schema=load('src/lib/customer/building-setup-schema.ts');
const helper=load('src/lib/customer/building-workspace-onboarding.ts',{'./building-setup-schema':schema});
const workspace='90000000-0000-0000-0000-000000000001',otherWorkspace='90000000-0000-0000-0000-000000000002';
const ctx='80000000-0000-0000-0000-000000000004',other='80000000-0000-0000-0000-000000000006',run='80000000-0000-0000-0000-000000000005',membership='80000000-0000-0000-0000-000000000007';
let revision=1,lastReceipt=null,creationKey='',creations=0,postDeferred=null;const completed=new Map();
let active={context_id:ctx,membership_id:membership},mode='success',stage='draft',calls=[],payload,readOverride=null,deferred=null;
const guards=new Map(),registerUnsavedGuard=(key,dirty,discard)=>{if(dirty)guards.set(key,discard);else guards.delete(key);return()=>{if(guards.get(key)===discard)guards.delete(key);};};
const record=()=>({version:2,workspace_id:workspace,revision,payload_hash:'a'.repeat(64),creation_request_hash:'b'.repeat(64),creation_receipt:{version:2,run_id:run,workspace_id:workspace,revision:1,status:'draft',creation_request_hash:'b'.repeat(64)},submitted_revision:stage==='submitted'?revision:null,submitted_payload_hash:stage==='submitted'?'a'.repeat(64):null,last_command_key:lastReceipt?.command_key??null,last_command_receipt:lastReceipt,run_id:run,status:stage,payload:structuredClone(payload),property_id:stage==='provisioned'?other:null,effective_units:null});
const mutations=()=>calls.filter(c=>c.options.method);
globalThis.fetch=async(url,options={})=>{
 calls.push({url,options});
 if(!options.method){if(mode==='deny-read'||mode==='deny-read-401')return {ok:false,status:mode==='deny-read'?403:401,json:async()=>({error:{code:'FORBIDDEN'}})};if(deferred)return deferred;if(mode==='lookup-transient'&&new URL(url,'https://cladora.test').pathname.endsWith('/building-setup'))return {ok:false,status:503,json:async()=>({})};if(new URL(url,'https://cladora.test').pathname.endsWith('/building-setup'))return {ok:true,json:async()=>({attempt:payload&&creationKey===new URL(url,'https://cladora.test').searchParams.get('idempotency_key')?(readOverride??record()):null})};return {ok:true,json:async()=>readOverride??record()};}
 const body=JSON.parse(options.body);
 if(mode==='lost-before')throw Error('Synthetic transport before commit');
 if(mode==='fail-write')return{ok:false,status:503,json:async()=>({})};
 if(mode==='deny-write'||mode==='deny-write-401')return{ok:false,status:mode==='deny-write'?403:401,json:async()=>({error:{code:'FORBIDDEN'}})};
 if(completed.has(body.command_key??body.idempotency_key))return {ok:true,json:async()=>completed.get(body.command_key??body.idempotency_key)};
 if(!url.endsWith(run)&&!url.endsWith('/rehearse')&&!url.endsWith('/submit')&&!url.endsWith('/provision')){payload=body.payload;creationKey=body.idempotency_key;creations++;}
 if(options.method==='PATCH')payload.units=body.units;
 if(url.endsWith('/rehearse'))stage='rehearsed';
 if(url.endsWith('/submit'))stage='submitted';
 if(url.endsWith('/provision'))stage='provisioned';
 if(body.command_key){revision++;lastReceipt={version:2,workspace_id:workspace,run_id:run,status:stage,revision,command_key:body.command_key,expected_revision:body.expected_revision,operation:options.method==='PATCH'?'update':url.split('/').at(-1)};}
 const receipt=body.command_key?lastReceipt:{version:2,workspace_id:workspace,run_id:run,status:stage,revision,creation_request_hash:'b'.repeat(64)};completed.set(body.command_key??body.idempotency_key,receipt);
 if(postDeferred)return postDeferred;
 if(mode==='lost')throw Error('Synthetic lost response');
 if(mode==='invalid-json')return{ok:true,json:async()=>{throw SyntaxError('Invalid JSON');}};
 return{ok:true,json:async()=>receipt};
};
const {CustomerBuildingSetupWizard:Wizard}=load('src/components/customer/CustomerBuildingSetupWizard.tsx',{
 './CustomerContextProvider':{useCustomerContext:()=>({active,dashboard:{workspace_id:active.context_id===ctx?workspace:otherWorkspace},registerUnsavedGuard})},
 '@/lib/customer/building-setup-schema':schema,'@/lib/customer/building-workspace-onboarding':helper,
 'next/link':({href,children,...props})=>React.createElement('a',{href,...props},children),
});
const root=createRoot(document.getElementById('root'));
const labels={en:['Create draft','Run rehearsal','Submit for approval','Provision structure','Refresh saved status','Check status and retry saved attempt'],ro:['Creează proiect','Rulează simularea','Trimite spre aprobare','Creează structura','Actualizează starea salvată','Verifică starea și reîncearcă operațiunea salvată'],fa:['ایجاد پیش‌نویس','اجرای آزمایشی','ارسال برای تأیید','ایجاد ساختار','دریافت وضعیت ثبت‌شده','بررسی وضعیت و تکرار همان تلاش']};
const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent===text);
const render=async(key,lang='en')=>act(async()=>root.render(React.createElement(Wizard,{key,lang})));
const click=async text=>act(async()=>button(text).click());
const input=async(selector,value)=>act(async()=>{const e=document.querySelector(selector);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});
let checks=0;function eq(a,b,msg){checks++;assert.deepEqual(a,b,msg);}
async function reset(){sessionStorage.clear();calls=[];mode='success';stage='draft';readOverride=null;revision=1;lastReceipt=null;creationKey='';creations=0;payload=null;completed.clear();postDeferred=null;active={context_id:ctx,membership_id:membership};}
try{
 if(!reviewOnly){
 for(const lang of ['en','ro','fa']){
  await reset();await render(`flow-${lang}`,lang);eq(document.querySelector('section').dir,lang==='fa'?'rtl':'ltr');
  await click(labels[lang][0]);eq(mutations().length,1);const first=JSON.parse(mutations()[0].options.body);eq(first.payload.currency,'RON');
  await click(labels[lang][1]);eq(stage,'rehearsed');await click(labels[lang][2]);eq(stage,'submitted');
  eq(document.querySelector('a').getAttribute('href'),`/${lang}/pilot-reviewer`,'existing independent-review consumer reused');eq(button(labels[lang][3]).disabled,true,'no client self-approval');
  stage='approved';const before=mutations().length;await click(labels[lang][4]);eq(mutations().length,before,'status refresh is read-only');
  await click(labels[lang][3]);eq(stage,'provisioned');const count=mutations().length;await render(`provisioned-${lang}`,lang);eq(button(labels[lang][0]).disabled,true);eq(mutations().length,count,'remount does not create/provision again');
 }
 await reset();await render('lost-create');mode='lost';await click(labels.en[0]);const key=helper.setupStorageKey(ctx,membership,workspace),savedCommand=JSON.parse(sessionStorage.getItem(key)).pending.command;
 eq(savedCommand.payload.association.name,'CLADORA Synthetic Association');eq(button(labels.en[0]).disabled,true);eq(document.querySelector('fieldset').disabled,true);
 mode='lookup-transient';await render('lost-create-remount');eq(JSON.parse(sessionStorage.getItem(key)).pending.command,savedCommand);eq(mutations().length,1,'restoring a pending attempt performs reads only');
 mode='success';active={context_id:other,membership_id:other};await render('other-context');eq(document.querySelector('fieldset input').value,'CLADORA Synthetic Association');eq(button(labels.en[0]).disabled,false,'independent Context unaffected');
 active={context_id:ctx,membership_id:membership};await render('back-to-uncertain');eq(button(labels.en[0]).disabled,true);eq(mutations().length,1);
 mode='success';await click('Check saved access and status');eq(mutations().length,1,'authorized exact-key creation receipt recovers without another POST');eq(JSON.parse(sessionStorage.getItem(key)).pending,null);eq(creations,1);
 await reset();await render('ambiguous-action');await click(labels.en[0]);mode='lost';await click(labels.en[1]);eq(stage,'rehearsed');const beforeRead=mutations().length;mode='success';await click(labels.en[5]);eq(mutations().length,beforeRead,'committed lost response is reconciled without replay');eq(button(labels.en[2]).disabled,false);
 // An exact known-run retry after an uncommitted failure reads first and preserves body.
 mode='fail-write';await click(labels.en[2]);const attempted=mutations().at(-1).options.body;stage='rehearsed';mode='success';await click(labels.en[5]);eq(mutations().at(-1).options.body,attempted);eq(stage,'submitted');
 await reset();await render('denied-read');await click(labels.en[0]);mode='deny-read';const beforeDenied=mutations().length;await click(labels.en[1]);eq(mutations().length,beforeDenied,'read denial must prevent mutation');
 await reset();await render('changed-record');await click(labels.en[0]);payload.building.name='Changed by another operator';const beforeStale=mutations().length;await click(labels.en[1]);eq(mutations().length,beforeStale,'stale record is not written');eq(document.querySelectorAll('fieldset input')[1].value,'Changed by another operator');
 await reset();sessionStorage.setItem(key,'broken json');await render('corrupt');eq(button(labels.en[0]).disabled,true,'corrupt storage fails closed, not new draft');eq(mutations().length,0);
 await reset();await render('invalid');await input('input[aria-label="Area m² 1"]','0');await click(labels.en[0]);eq(mutations().length,0,'invalid area blocked before dispatch');
 await reset();await render('invalid-json');mode='invalid-json';await click(labels.en[0]);eq(button(labels.en[0]).disabled,true);eq(JSON.parse(sessionStorage.getItem(key)).pending.action,'create');
 // Synchronous double activation uses ref lock before React disabled state renders.
 await reset();await render('double');await act(async()=>{button(labels.en[0]).click();button(labels.en[0]).click();});eq(mutations().length,1);
 // Saved unit attempts survive a remount and retry exactly after authoritative read.
 await reset();await render('save-retry');await click(labels.en[0]);await input('input[aria-label="Area m² 1"]','70');mode='fail-write';await click('Save units');const saveBody=mutations().at(-1).options.body;
 await render('save-retry-remount');eq(document.querySelector('input[aria-label="Area m² 1"]').value,'70');mode='success';await click(labels.en[5]);eq(mutations().at(-1).options.body,saveBody);eq(payload.units[0].area_m2,70);
 // Unavailable browser storage prevents dispatch instead of losing recovery identity.
 await reset();await render('storage-unavailable');const nativeSet=dom.window.Storage.prototype.setItem;dom.window.Storage.prototype.setItem=()=>{throw Error('Synthetic storage quota');};
 try{await click(labels.en[0]);eq(mutations().length,0);}finally{dom.window.Storage.prototype.setItem=nativeSet;}
 // An old Context response cannot alter the new Context or erase its pending state.
 await reset();await render('stale-source');await click(labels.en[0]);let release;deferred=new Promise(resolve=>{release=resolve;});
 await act(async()=>{button(labels.en[4]).click();});active={context_id:other,membership_id:other};await render('stale-target');
 const oldRecord=record();oldRecord.payload.building.name='OLD CONTEXT RESPONSE';await act(async()=>{release({ok:true,json:async()=>oldRecord});});deferred=null;
 eq(document.querySelectorAll('fieldset input')[1].value,'Synthetic Building A');eq(mutations().length,1);

 await reset();await render('legacy-before');await click(labels.en[0]);readOverride={...record(),creation_request_hash:null,creation_receipt:null};await click(labels.en[4]);eq(button(labels.en[1]).disabled,true,'legacy snapshot cannot advance');assert.match(document.querySelector('[role="alert"]').textContent,/legacy record/);readOverride=null;

 const statusLabels={en:'Check saved access and status',ro:'Verifică accesul și starea salvate',fa:'بررسی دسترسی و وضعیت ذخیره‌شده'};
 const noSensitive=()=>{eq(document.querySelectorAll('input,fieldset').length,0,'denial removes every data field');eq(document.body.textContent.includes('Synthetic Building A'),false);eq(document.body.textContent.includes('CLADORA Synthetic Association'),false);eq(document.body.textContent.includes(run),false,'no prior run/status detail');};
 for(const lang of ['en','ro','fa']){
  for(const denied of ['deny-read','deny-read-401']){
   await reset();await render(`clear-${lang}-${denied}`,lang);await click(labels[lang][0]);const snapshot=sessionStorage.getItem(key),writes=mutations().length;mode=denied;await click(labels[lang][4]);noSensitive();eq(sessionStorage.getItem(key),snapshot,'deny never deletes stored evidence');
   mode='success';await click(statusLabels[lang]);eq(mutations().length,writes,'fresh authorized return is read-only');eq(document.querySelector('input').value,'CLADORA Synthetic Association');
  }
  for(const writeDeny of ['deny-write','deny-write-401']){
  await reset();await render(`mutation-deny-${lang}-${writeDeny}`,lang);await click(labels[lang][0]);mode=writeDeny;await click(labels[lang][1]);const deniedAttempt=sessionStorage.getItem(key),originalBody=mutations().at(-1).options.body;noSensitive();mode='success';const deniedWrites=mutations().length;await click(statusLabels[lang]);eq(mutations().length,deniedWrites);eq(sessionStorage.getItem(key),deniedAttempt);await click(labels[lang][5]);eq(mutations().at(-1).options.body,originalBody,'same command retained after denial');
  }
  await reset();await render(`form-locale-${lang}`,'en');await input('fieldset input','Synthetic unsaved association');await render(`form-locale-${lang}`,lang);eq(document.querySelector('input').value,'Synthetic unsaved association','locale preserves unsaved form');eq(mutations().length,0);eq(guards.size>0,true);
  // Same mounted identity, unsaved draft values and guard survive EN/RO/FA copy changes.
  await reset();await render(`dirty-${lang}`,'en');await click(labels.en[0]);await input('input[aria-label="Area m² 1"]','77');const count=mutations().length;await render(`dirty-${lang}`,lang);eq(document.querySelector('input[step="0.01"]').value,'77');eq(mutations().length,count);eq(guards.size>0,true,'dirty guard retained');eq(document.querySelector('section').dir,lang==='fa'?'rtl':'ltr');
  // Delayed pre-action read after a newer current denial must not dispatch or restore data.
  await reset();await render(`delayed-read-${lang}`,lang);await click(labels[lang][0]);const old=record();let releaseRead;deferred=new Promise(resolve=>{releaseRead=resolve;});await act(async()=>button(labels[lang][1]).click());deferred=null;mode='deny-read';await click(statusLabels[lang]);noSensitive();await act(async()=>releaseRead({ok:true,json:async()=>old}));noSensitive();eq(mutations().length,1);
  await reset();await render(`delayed-post-${lang}`,lang);await click(labels[lang][0]);let releasePost;postDeferred=new Promise(resolve=>{releasePost=resolve;});await act(async()=>button(labels[lang][1]).click());postDeferred=null;const pendingBefore=sessionStorage.getItem(key),postCount=mutations().length;mode='deny-read';await click(statusLabels[lang]);noSensitive();await act(async()=>releasePost({ok:true,json:async()=>lastReceipt}));noSensitive();eq(sessionStorage.getItem(key),pendingBefore,'late mutation never erases denied intent');eq(mutations().length,postCount);
  // A transient lookup restores only through an explicit same-key READ, then user retry.
  await reset();await render(`absent-${lang}`,lang);mode='lost-before';await click(labels[lang][0]);const command=JSON.parse(sessionStorage.getItem(key)).pending.command;mode='lookup-transient';await render(`absent-remount-${lang}`,lang);eq(mutations().length,1);mode='success';await click(statusLabels[lang]);eq(mutations().length,1,'absence check performs zero POST');eq(JSON.parse(sessionStorage.getItem(key)).pending.command,command);await click(labels[lang][5]);eq(JSON.parse(mutations().at(-1).options.body),command);eq(creations,1);
  // A key-bound immutable creation receipt can recover an already committed result, read-only.
  await reset();await render(`found-${lang}`,lang);mode='lost';await click(labels[lang][0]);const foundBody=mutations()[0].options.body;mode='lookup-transient';await render(`found-remount-${lang}`,lang);mode='success';await click(statusLabels[lang]);eq(mutations().length,1);eq(JSON.parse(sessionStorage.getItem(key)).pending,null);eq(payload,JSON.parse(foundBody).payload);
  await reset();await render(`proof-mismatch-${lang}`,lang);mode='lost';await click(labels[lang][0]);const originalProofAttempt=sessionStorage.getItem(key);readOverride={...record(),creation_receipt:{...record().creation_receipt,creation_request_hash:'c'.repeat(64)}};mode='success';await click(statusLabels[lang]);eq(sessionStorage.getItem(key),originalProofAttempt,'mismatched immutable receipt never clears original attempt');eq(mutations().length,1);readOverride=null;await click(statusLabels[lang]);eq(mutations().length,1);eq(JSON.parse(sessionStorage.getItem(key)).pending,null);
  await reset();await render(`create-denied-${lang}`,lang);mode='lost-before';await click(labels[lang][0]);const saved=sessionStorage.getItem(key);mode='deny-read';await render(`create-denied-remount-${lang}`,lang);noSensitive();eq(sessionStorage.getItem(key),saved);mode='success';await click(statusLabels[lang]);eq(mutations().length,1,'authorized return does not retry write');eq(sessionStorage.getItem(key),saved);
  const foreign=JSON.parse(saved);foreign.context_id=other;sessionStorage.setItem(key,JSON.stringify(foreign));await render(`foreign-${lang}`,lang);eq(button(labels[lang][0]).disabled,true);const foreignCount=mutations().length;await click(statusLabels[lang]);eq(mutations().length,foreignCount);eq(sessionStorage.getItem(key),JSON.stringify(foreign));
 }
 }
 if(!wizardOnly){
 // Reuse the existing reviewer consumer; activation below is mocked only.
 const {PilotReviewerPanel}=load('src/components/customer/PilotReviewerPanel.tsx',{'@/lib/customer/building-setup-schema':schema,'@/lib/customer/building-workspace-onboarding':helper,'next/link':({href,children})=>React.createElement('a',{href},children)});
 const reviewPayload={association:{name:'Synthetic review'},building:{name:'Synthetic block',code:'B1',floors:1},currency:'RON',period_start:'2026-01-01',period_end:'2026-01-31',units:[{code:'U1',floor:0,area_m2:50}],opening_balances:[]};
 const reviewLabels={en:['Approve setup','Check and retry the same approval','Refresh review access'],ro:['Aprobă dosarul','Verifică și reîncearcă aceeași aprobare','Actualizează accesul la verificare'],fa:['تأیید پرونده','بررسی و تکرار همان تأیید','بررسی دسترسی بازبینی']};
 for(const lang of ['en','ro','fa']){
  const [approveLabel,retryLabel,refreshLabel]=reviewLabels[lang],approvalKey=`cladora.setup-approval.v2:${ctx}:${workspace}`;
  let review,posts,accessStatus,access,readMode,postMode,holdRead,holdReviewer,holdPost,holdActivation,activationPosts;
  const fresh=()=>{sessionStorage.clear();posts=[];accessStatus=200;access={status:'active',context_id:ctx,workspace_id:workspace};readMode='ok';postMode='lost-committed';holdRead=null;holdReviewer=null;holdPost=null;holdActivation=null;activationPosts=[];review={version:2,workspace_id:workspace,revision:3,run_id:run,status:'submitted',payload:reviewPayload,payload_hash:'a'.repeat(64),creation_request_hash:'b'.repeat(64),creation_receipt:{run_id:run},submitted_revision:3,submitted_payload_hash:'a'.repeat(64),last_command_key:null,last_command_receipt:null};};
  const response=(status,body)=>({ok:status===200,status,json:async()=>structuredClone(body)});
  const reviewerBody=()=>({reviewer:{...access,runs:access.status&&review.status==='submitted'?[{id:run,workspace_id:access.workspace_id,status:'submitted',building:'Synthetic sensitive',revision:3,payload_hash:'a'.repeat(64),submitted_revision:3,submitted_payload_hash:'a'.repeat(64)}]:[]}});
  globalThis.fetch=async(url,options={})=>{
   if(url==='/api/customer/v1/pilot-reviewer'){
    if(options.method){activationPosts.push(options.body);if(holdActivation){const wait=holdActivation;holdActivation=null;return wait;}return response(200,{reviewer:access});}
    if(holdReviewer){const wait=holdReviewer;holdReviewer=null;return wait;}
    return response(accessStatus,accessStatus===200?reviewerBody():{error:{code:'FORBIDDEN'}});
   }
   if(!options.method){
    if(holdRead){const wait=holdRead;holdRead=null;return wait;}
    if(readMode==='network')throw Error('Synthetic network unavailable');
    if(typeof readMode==='number')return response(readMode,{error:{code:'FORBIDDEN'}});
    return response(200,review);
   }
   posts.push(options.body);
   if(typeof postMode==='number')return response(postMode,{error:{code:'FORBIDDEN'}});
   if(postMode==='lost-uncommitted')throw Error('Synthetic uncommitted lost response');
   const body=JSON.parse(options.body);
   const receipt={version:2,run_id:run,workspace_id:workspace,status:'approved',revision:4,operation:'approve',expected_revision:3,command_key:body.command_key};
   review={...review,status:'approved',revision:4,last_command_key:body.command_key,last_command_receipt:receipt};
   if(holdPost){const wait=holdPost;holdPost=null;return wait;}
   if(postMode==='lost-committed')throw Error('Synthetic committed lost response');
   return response(200,receipt);
  };
  let serial=0,currentKey;const mount=()=>{currentKey=`review-${lang}-${++serial}`;return act(async()=>root.render(React.createElement(PilotReviewerPanel,{key:currentKey,lang})));};
  const rerender=locale=>act(async()=>root.render(React.createElement(PilotReviewerPanel,{key:currentKey,lang:locale})));
  const focus=()=>act(async()=>window.dispatchEvent(new dom.window.Event('focus')));
  const stored=()=>JSON.parse(sessionStorage.getItem(approvalKey));
  const unknown={en:/unknown/,ro:/necunoscut/,fa:/نامشخص/};
  // Clear stale denial on authorized return, preserving unresolved approval warnings.
  fresh();accessStatus=403;await mount();accessStatus=200;await click(refreshLabel);eq(document.querySelector('[role="status"]')===null,true,'CR-02: stale denial cleared after valid access read');
  fresh();postMode='lost-uncommitted';await mount();await click(approveLabel);const deniedPending=stored();accessStatus=403;await focus();accessStatus=200;await click(refreshLabel);assert.match(document.querySelector('[role="status"]').textContent,unknown[lang],'authorized access does not resolve pending approval');eq(stored(),deniedPending);eq(posts.length,1);
  // An ordinary refresh must preserve unknown-outcome feedback too.
  await click(refreshLabel);assert.match(document.querySelector('[role="status"]').textContent,unknown[lang]);
  // Same mounted identity across locale changes; a current access read must not strand busy.
  for(const target of (lang==='en'?['ro','fa']:[lang==='ro'?'fa':'en'])){
   fresh();postMode='lost-uncommitted';await mount();let releaseLocale;holdRead=new Promise(resolve=>{releaseLocale=resolve;});await act(async()=>button(approveLabel).click());const original=stored();await rerender(target);await focus();
   const targetRetry=reviewLabels[target][1];eq(button(targetRetry).disabled,true,'pending old read retains exclusive operation ownership');
   await act(async()=>releaseLocale(response(200,review)));eq(button(targetRetry).disabled,false,'CR-01: locale change must not strand busy after stale read settles');eq(stored(),original);eq(posts.length,0,'locale/access refresh never auto-approves');
   let releaseNew;holdPost=new Promise(resolve=>{releaseNew=resolve;});postMode='ok';await click(targetRetry);eq(posts.length,1);eq(JSON.parse(posts[0]),original.command);await focus();eq(button(targetRetry).disabled,true,'current operation remains locked after newer refresh');await act(async()=>button(targetRetry).click());eq(posts.length,1);
   await act(async()=>releaseNew(response(200,review.last_command_receipt)));eq(button(targetRetry).disabled,false,'only owning operation settlement releases busy');eq(stored(),original);await click(targetRetry);eq(posts.length,1,'exact recorded receipt recovered without another write');eq(stored(),null);
   // Approval POST held across same-instance locale change and current read.
   fresh();await mount();let releaseLocalePost;holdPost=new Promise(resolve=>{releaseLocalePost=resolve;});await click(approveLabel);const pendingPost=stored();await rerender(target);await focus();eq(button(targetRetry).disabled,true);await act(async()=>releaseLocalePost(response(200,review.last_command_receipt)));eq(button(targetRetry).disabled,false);eq(stored(),pendingPost);eq(posts.length,1);await click(targetRetry);eq(stored(),null);eq(posts.length,1);
   // Existing activation endpoint is only a MOCK transport; no real access activated.
   fresh();access.status='prepared';await mount();await input('input','Synthetic reviewer');let releaseActivation;holdActivation=new Promise(resolve=>{releaseActivation=resolve;});const activation={en:'Activate temporary access',ro:'Activează accesul temporar',fa:'فعال‌سازی دسترسی موقت'};await click(activation[lang]);await rerender(target);await focus();eq(button(activation[target]).disabled,true);await act(async()=>releaseActivation(response(200,{reviewer:access})));eq(button(activation[target]).disabled,false,'activation busy released after locale change');eq(activationPosts.length,1);
  }
  const noRuns=()=>{eq(document.body.textContent.includes('Synthetic sensitive'),false,'confirmed authority loss clears displayed runs');eq(button(approveLabel),undefined,'no approval action after access loss');eq(button(retryLabel),undefined,'pending metadata never grants authority');};
  // Existing positive regression: lost committed approval, remount, exact receipt, no second POST.
  fresh();await mount();eq(document.querySelector('section').dir,lang==='fa'?'rtl':'ltr');
  await act(async()=>{button(approveLabel).click();button(approveLabel).click();});eq(posts.length,1,'synchronous duplicate prevented');
  const original=stored();eq(original.command.expected_revision,3);eq(original.command.expected_payload_hash,'a'.repeat(64));
  await mount();await click(retryLabel);eq(posts.length,1,'committed receipt recovers with no second POST');eq(stored(),null);
  // Unknown noncommitted result retains the original body/key through remount and a genuine retry.
  fresh();postMode='lost-uncommitted';await mount();await click(approveLabel);const exactBody=posts[0];await mount();postMode='ok';await click(retryLabel);eq(posts.length,2);eq(posts[1],exactBody,'retry uses exact original key/body');eq(stored(),null);
  for(const status of [401,403]){
   fresh();postMode='lost-uncommitted';await mount();await click(approveLabel);const saved=stored();readMode=status;await click(retryLabel);noRuns();eq(stored(),saved,'expired/revoked reader preserves same pending attempt');eq(posts.length,1);
   // Only a fresh current authorized read may restore the consumer, never stored metadata alone.
   readMode='ok';await click(refreshLabel);eq(stored(),saved);eq(button(retryLabel).disabled,false);
   accessStatus=status;await click(refreshLabel);noRuns();eq(stored(),saved);eq(posts.length,1);
   fresh();postMode=status;await mount();await click(approveLabel);noRuns();eq(posts.length,1);eq(!!stored(),true,'write denial retains original attempt');
  }
  // Explicit empty reviewer state is access loss, not a successful approval.
  fresh();await mount();access={};await click(refreshLabel);noRuns();eq(posts.length,0);
  // Unknown network read is not a confirmed denial/success and must retain the same key.
  fresh();readMode='network';await mount();await click(approveLabel);const networkAttempt=stored();eq(posts.length,0);eq(!!networkAttempt,true);assert.match(document.querySelector('[role="status"]').textContent,lang==='en'?/unknown/:lang==='ro'?/necunoscut/:/نامشخص/);
  readMode='ok';postMode='ok';await click(retryLabel);eq(JSON.parse(posts[0]),networkAttempt.command);eq(stored(),null);
  // Corrupt/foreign saved attempts never send a mutation or become actionable.
  for(const field of ['context_id','workspace_id']){
   fresh();const foreign={run_id:run,command:{context_id:ctx,workspace_id:workspace,expected_revision:3,expected_payload_hash:'a'.repeat(64),command_key:`setup-${run}-r3-original`}};foreign.command[field]=other;
   sessionStorage.setItem(approvalKey,JSON.stringify(foreign));await mount();eq(button(approveLabel).disabled,true);eq(button(retryLabel),undefined);eq(posts.length,0);eq(stored(),foreign);
  }
  for(const mismatch of ['revision','hash','workspace','run','receipt']){
   fresh();postMode='lost-uncommitted';await mount();await click(approveLabel);const saved=stored();
   if(mismatch==='revision')review.revision=4;
   if(mismatch==='hash')review.submitted_payload_hash='c'.repeat(64);
   if(mismatch==='workspace')review.workspace_id=otherWorkspace;
   if(mismatch==='run')review.run_id=other;
   if(mismatch==='receipt')review={...review,status:'approved',revision:4,last_command_key:saved.command.command_key,last_command_receipt:{operation:'approve',command_key:saved.command.command_key,expected_revision:3}};
   await click(retryLabel);eq(posts.length,1,`${mismatch} mismatch must not approve`);eq(stored(),saved,'mismatch retains original unresolved key');
  }
  // A changed Context/Workspace cannot reuse an old pending approval.
  fresh();postMode='lost-uncommitted';await mount();await click(approveLabel);const oldAttempt=stored();access={status:'active',context_id:other,workspace_id:otherWorkspace};await click(refreshLabel);eq(button(retryLabel),undefined);eq(stored(),oldAttempt);eq(posts.length,1);
  // Deferred old reviewer success cannot restore data after a newer CURRENT denial.
  fresh();await mount();let releaseReviewer;holdReviewer=new Promise(resolve=>{releaseReviewer=resolve;});const delayed=reviewerBody();await focus();accessStatus=403;await focus();noRuns();await act(async()=>releaseReviewer(response(200,delayed)));noRuns();eq(posts.length,0);
  // A deferred approval read cannot dispatch a mutation or erase pending state after denial.
  fresh();await mount();let releaseRead;holdRead=new Promise(resolve=>{releaseRead=resolve;});await act(async()=>button(approveLabel).click());const retained=stored();accessStatus=403;await focus();noRuns();await act(async()=>releaseRead(response(200,review)));noRuns();eq(posts.length,0);eq(stored(),retained);
  // A delayed committed POST response cannot clear the attempt after current denial.
  fresh();await mount();let releasePost;holdPost=new Promise(resolve=>{releasePost=resolve;});await act(async()=>button(approveLabel).click());const postAttempt=stored();eq(posts.length,1);accessStatus=403;await focus();noRuns();await act(async()=>releasePost(response(200,review.last_command_receipt)));noRuns();eq(stored(),postAttempt,'late write success never erases denied pending attempt');eq(posts.length,1);
  // Old instance reads must not change the new instance after unmount/remount.
  fresh();await mount();let releaseUnmount;holdRead=new Promise(resolve=>{releaseUnmount=resolve;});await act(async()=>button(approveLabel).click());const retainedUnmount=stored();await mount();await act(async()=>releaseUnmount(response(200,review)));eq(posts.length,0);eq(stored(),retainedUnmount);eq(button(retryLabel).disabled,false);
 }
 if(!reviewOnly){
 // Only the reserved creation-attempt hunk of the existing CaseConversation is exercised.
 const caseSchemas=load('src/lib/customer/building-workspace-onboarding-case.ts',{'./building-setup-schema':schema});
 const {CaseConversation}=load('src/components/cases/CasePortal.tsx',{'@/lib/customer/building-workspace-onboarding-case':caseSchemas,'next/link':({href,children})=>React.createElement('a',{href},children),'next/navigation':{useRouter:()=>({})},'@/components/platform/WorkspaceAccessBasisDialog':{WorkspaceAccessBasisDialog:()=>null}});
 for(const lang of ['en','ro','fa']){
  sessionStorage.clear();let posts=[],created=0,receipt=null,lost=true;
  globalThis.fetch=async(url,options={})=>{
   if(!options.method){if(new URL(url,'https://cladora.test').searchParams.has('idempotency_key'))return{ok:true,json:async()=>({attempt:receipt})};return{ok:true,json:async()=>({options:[{profile:'residential',model:'association_managed',profile_label:{en:'Residential'},model_label:{en:'Association'}}],prepared:[]})};}
   posts.push(options.body);if(!receipt){created++;receipt={workspace_id:workspace,tenant_id:other,status:'LEAD'};}if(lost)throw Error('Synthetic lost case response');return{ok:true,json:async()=>({workspace:receipt})};
  };
  const props={lang,detail:{id:ctx,status:'open',workspace_id:workspace,contract_id:null,staff_view:true,messages:[],unread_count:0},documents:[],userId:membership,manager:true,approver:false,reviewer:false,staffOptions:[]};
  const mount=key=>act(async()=>root.render(React.createElement(CaseConversation,{...props,key})));
  await mount(`case-${lang}`);let form=document.querySelector('select[name="taxonomy"]').closest('form');form.querySelector('[name="taxonomy"]').value='0';form.querySelector('[name="commercial_owner"]').value='Synthetic manager';form.querySelector('[name="reason"]').value='Synthetic preparation reason';
  await act(async()=>{form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));});eq(posts.length,1);eq(created,1);
  const original=posts[0];await mount(`case-remount-${lang}`);form=document.querySelector('select[name="taxonomy"]').closest('form');eq(form.querySelector('fieldset').disabled,true,'uncertain case fields locked after remount');lost=false;
  await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));eq(posts.at(-1),original,'case retry uses original key and body');eq(created,1,'case recovery does not create another Workspace');eq(sessionStorage.getItem(`cladora.case-workspace-attempt.v2:${membership}:${ctx}`),null);
 }
 }
 }
 console.log(`PASS mounted building setup: ${checks} assertions, EN/RO/FA + RTL, exact persistence, synchronous double-submit, stale Context, denial, reconciliation; mocked transport/JSDOM, NOT real browser/Auth/DB.`);
}finally{await act(async()=>root.unmount());globalThis.fetch=originalFetch;for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}dom.window.close();}
