import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
const require=createRequire(import.meta.url),dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test'}),saved=new Map();
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,FormData:dom.window.FormData,sessionStorage:dom.window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const originalFetch=globalThis.fetch;
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url)),mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;}
const schema=load('src/lib/customer/building-setup-schema.ts');
const helper=load('src/lib/customer/building-workspace-onboarding.ts',{'./building-setup-schema':schema});
const workspace='90000000-0000-0000-0000-000000000001',otherWorkspace='90000000-0000-0000-0000-000000000002';
const ctx='80000000-0000-0000-0000-000000000004',other='80000000-0000-0000-0000-000000000006',run='80000000-0000-0000-0000-000000000005',membership='80000000-0000-0000-0000-000000000007';
let revision=1,lastReceipt=null,creationKey='',creations=0;const completed=new Map();
let active={context_id:ctx,membership_id:membership},mode='success',stage='draft',calls=[],payload,readOverride=null,deferred=null;
const guards=new Map(),registerUnsavedGuard=(key,dirty,discard)=>{if(dirty)guards.set(key,discard);else guards.delete(key);return()=>{if(guards.get(key)===discard)guards.delete(key);};};
const record=()=>({version:2,workspace_id:workspace,revision,payload_hash:'a'.repeat(64),creation_request_hash:'b'.repeat(64),creation_receipt:{run_id:run},submitted_revision:stage==='submitted'?revision:null,submitted_payload_hash:stage==='submitted'?'a'.repeat(64):null,last_command_key:lastReceipt?.command_key??null,last_command_receipt:lastReceipt,run_id:run,status:stage,payload:structuredClone(payload),property_id:stage==='provisioned'?other:null,effective_units:null});
const mutations=()=>calls.filter(c=>c.options.method);
globalThis.fetch=async(url,options={})=>{
 calls.push({url,options});
 if(!options.method){if(mode==='deny-read')return {ok:false,status:403,json:async()=>({error:{code:'FORBIDDEN'}})};if(deferred)return deferred;if(new URL(url,'https://cladora.test').pathname.endsWith('/building-setup'))return {ok:true,json:async()=>({attempt:payload&&creationKey===new URL(url,'https://cladora.test').searchParams.get('idempotency_key')?record():null})};return {ok:true,json:async()=>readOverride??record()};}
 const body=JSON.parse(options.body);
 if(mode==='deny-write')return{ok:false,status:403,json:async()=>({error:{code:'FORBIDDEN'}})};
 if(completed.has(body.command_key??body.idempotency_key))return {ok:true,json:async()=>completed.get(body.command_key??body.idempotency_key)};
 if(!url.endsWith(run)&&!url.endsWith('/rehearse')&&!url.endsWith('/submit')&&!url.endsWith('/provision')){payload=body.payload;creationKey=body.idempotency_key;creations++;}
 if(options.method==='PATCH')payload.units=body.units;
 if(url.endsWith('/rehearse'))stage='rehearsed';
 if(url.endsWith('/submit'))stage='submitted';
 if(url.endsWith('/provision'))stage='provisioned';
 if(body.command_key){revision++;lastReceipt={version:2,workspace_id:workspace,run_id:run,status:stage,revision,command_key:body.command_key,expected_revision:body.expected_revision,operation:options.method==='PATCH'?'update':url.split('/').at(-1)};}
 const receipt=body.command_key?lastReceipt:{version:2,workspace_id:workspace,run_id:run,status:stage,revision,creation_request_hash:'b'.repeat(64)};completed.set(body.command_key??body.idempotency_key,receipt);
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
async function reset(){sessionStorage.clear();calls=[];mode='success';stage='draft';readOverride=null;revision=1;lastReceipt=null;creationKey='';creations=0;payload=null;completed.clear();active={context_id:ctx,membership_id:membership};}
try{
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
 await render('lost-create-remount');eq(JSON.parse(sessionStorage.getItem(key)).pending.command,savedCommand);eq(mutations().length,1,'restoring a pending attempt performs reads only');
 mode='success';active={context_id:other,membership_id:other};await render('other-context');eq(document.querySelector('fieldset input').value,'CLADORA Synthetic Association');eq(button(labels.en[0]).disabled,false,'independent Context unaffected');
 active={context_id:ctx,membership_id:membership};await render('back-to-uncertain');eq(button(labels.en[0]).disabled,true);eq(mutations().length,1);
 mode='success';await click(labels.en[5]);eq(mutations().at(-1).options.body,JSON.stringify(savedCommand));eq(creations,1,'key-bound replay creates no second run');
 await reset();await render('ambiguous-action');await click(labels.en[0]);mode='lost';await click(labels.en[1]);eq(stage,'rehearsed');const beforeRead=mutations().length;mode='success';await click(labels.en[5]);eq(mutations().length,beforeRead,'committed lost response is reconciled without replay');eq(button(labels.en[2]).disabled,false);
 // An exact known-run retry after an uncommitted failure reads first and preserves body.
 mode='deny-write';await click(labels.en[2]);const attempted=mutations().at(-1).options.body;stage='rehearsed';mode='success';await click(labels.en[5]);eq(mutations().at(-1).options.body,attempted);eq(stage,'submitted');
 await reset();await render('denied-read');await click(labels.en[0]);mode='deny-read';const beforeDenied=mutations().length;await click(labels.en[1]);eq(mutations().length,beforeDenied,'read denial must prevent mutation');
 await reset();await render('changed-record');await click(labels.en[0]);payload.building.name='Changed by another operator';const beforeStale=mutations().length;await click(labels.en[1]);eq(mutations().length,beforeStale,'stale record is not written');eq(document.querySelectorAll('fieldset input')[1].value,'Changed by another operator');
 await reset();sessionStorage.setItem(key,'broken json');await render('corrupt');eq(button(labels.en[0]).disabled,true,'corrupt storage fails closed, not new draft');eq(mutations().length,0);
 await reset();await render('invalid');await input('input[aria-label="Area m² 1"]','0');await click(labels.en[0]);eq(mutations().length,0,'invalid area blocked before dispatch');
 await reset();await render('invalid-json');mode='invalid-json';await click(labels.en[0]);eq(button(labels.en[0]).disabled,true);eq(JSON.parse(sessionStorage.getItem(key)).pending.action,'create');
 // Synchronous double activation uses ref lock before React disabled state renders.
 await reset();await render('double');await act(async()=>{button(labels.en[0]).click();button(labels.en[0]).click();});eq(mutations().length,1);
 // Saved unit attempts survive a remount and retry exactly after authoritative read.
 await reset();await render('save-retry');await click(labels.en[0]);await input('input[aria-label="Area m² 1"]','70');mode='deny-write';await click('Save units');const saveBody=mutations().at(-1).options.body;
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
 // Reuse the existing reviewer consumer; no activation endpoint is called.
 const {PilotReviewerPanel}=load('src/components/customer/PilotReviewerPanel.tsx',{'@/lib/customer/building-setup-schema':schema,'@/lib/customer/building-workspace-onboarding':helper,'next/link':({href,children})=>React.createElement('a',{href},children)});
 const reviewPayload=structuredClone(savedCommand.payload);
 const reviewLabels={en:['Approve setup','Check and retry the same approval','Refresh review access'],ro:['Aprobă dosarul','Verifică și reîncearcă aceeași aprobare','Actualizează accesul la verificare'],fa:['تأیید پرونده','بررسی و تکرار همان تأیید','بررسی دسترسی بازبینی']};
 for(const lang of ['en','ro','fa']){
  const [approveLabel,retryLabel,refreshLabel]=reviewLabels[lang],approvalKey=`cladora.setup-approval.v2:${ctx}:${workspace}`;
  let review,posts,accessStatus,access,readMode,postMode,holdRead,holdReviewer,holdPost;
  const fresh=()=>{sessionStorage.clear();posts=[];accessStatus=200;access={status:'active',context_id:ctx,workspace_id:workspace};readMode='ok';postMode='lost-committed';holdRead=null;holdReviewer=null;holdPost=null;review={version:2,workspace_id:workspace,revision:3,run_id:run,status:'submitted',payload:reviewPayload,payload_hash:'a'.repeat(64),creation_request_hash:'b'.repeat(64),creation_receipt:{run_id:run},submitted_revision:3,submitted_payload_hash:'a'.repeat(64),last_command_key:null,last_command_receipt:null};};
  const response=(status,body)=>({ok:status===200,status,json:async()=>structuredClone(body)});
  const reviewerBody=()=>({reviewer:{...access,runs:access.status&&review.status==='submitted'?[{id:run,workspace_id:access.workspace_id,status:'submitted',building:'Synthetic sensitive',revision:3,payload_hash:'a'.repeat(64),submitted_revision:3,submitted_payload_hash:'a'.repeat(64)}]:[]}});
  globalThis.fetch=async(url,options={})=>{
   if(url==='/api/customer/v1/pilot-reviewer'){
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
  let serial=0;const mount=()=>act(async()=>root.render(React.createElement(PilotReviewerPanel,{key:`review-${lang}-${++serial}`,lang})));
  const focus=()=>act(async()=>window.dispatchEvent(new dom.window.Event('focus')));
  const stored=()=>JSON.parse(sessionStorage.getItem(approvalKey));
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
 console.log(`PASS mounted building setup: ${checks} assertions, EN/RO/FA + RTL, exact persistence, synchronous double-submit, stale Context, denial, reconciliation; mocked transport/JSDOM, NOT real browser/Auth/DB.`);
}finally{await act(async()=>root.unmount());globalThis.fetch=originalFetch;for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}dom.window.close();}
