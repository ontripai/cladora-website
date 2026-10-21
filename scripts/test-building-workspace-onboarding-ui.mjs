import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
const require=createRequire(import.meta.url),dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test'}),saved=new Map();
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,sessionStorage:dom.window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const originalFetch=globalThis.fetch;
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url)),mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText,filename);return mod.exports;}
const schema=load('src/lib/customer/building-setup-schema.ts');
const helper=load('src/lib/customer/building-workspace-onboarding.ts',{'./building-setup-schema':schema});
const ctx='80000000-0000-0000-0000-000000000004',other='80000000-0000-0000-0000-000000000006',run='80000000-0000-0000-0000-000000000005',membership='80000000-0000-0000-0000-000000000007';
let active={context_id:ctx,membership_id:membership},mode='success',stage='draft',calls=[],payload,readOverride=null,deferred=null;
const guards=new Map(),registerUnsavedGuard=(key,dirty,discard)=>{if(dirty)guards.set(key,discard);else guards.delete(key);return()=>{if(guards.get(key)===discard)guards.delete(key);};};
const record=()=>({run_id:run,status:stage,payload:structuredClone(payload),property_id:stage==='provisioned'?other:null,effective_units:null});
const mutations=()=>calls.filter(c=>c.options.method);
globalThis.fetch=async(url,options={})=>{
 calls.push({url,options});
 if(!options.method){if(mode==='deny-read')return {ok:false,status:403,json:async()=>({error:{code:'FORBIDDEN'}})};if(deferred)return deferred;return {ok:true,json:async()=>readOverride??record()};}
 const body=JSON.parse(options.body);
 if(mode==='deny-write')return{ok:false,status:403,json:async()=>({error:{code:'FORBIDDEN'}})};
 if(!url.endsWith(run)&&!url.endsWith('/rehearse')&&!url.endsWith('/submit')&&!url.endsWith('/provision'))payload=body.payload;
 if(options.method==='PATCH')payload.units=body.units;
 if(url.endsWith('/rehearse'))stage='rehearsed';
 if(url.endsWith('/submit'))stage='submitted';
 if(url.endsWith('/provision'))stage='provisioned';
 if(mode==='lost')throw Error('Synthetic lost response');
 if(mode==='invalid-json')return{ok:true,json:async()=>{throw SyntaxError('Invalid JSON');}};
 return{ok:true,json:async()=>({run_id:run,status:stage})};
};
const {CustomerBuildingSetupWizard:Wizard}=load('src/components/customer/CustomerBuildingSetupWizard.tsx',{
 './CustomerContextProvider':{useCustomerContext:()=>({active,registerUnsavedGuard})},
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
async function reset(){sessionStorage.clear();calls=[];mode='success';stage='draft';readOverride=null;active={context_id:ctx,membership_id:membership};}
try{
 for(const lang of ['en','ro','fa']){
  await reset();await render(`flow-${lang}`,lang);eq(document.querySelector('section').dir,lang==='fa'?'rtl':'ltr');
  await click(labels[lang][0]);eq(mutations().length,1);const first=JSON.parse(mutations()[0].options.body);eq(first.payload.currency,'RON');
  await click(labels[lang][1]);eq(stage,'rehearsed');await click(labels[lang][2]);eq(stage,'submitted');
  eq(document.querySelector('a').getAttribute('href'),`/${lang}/pilot-reviewer`,'existing independent-review consumer reused');eq(button(labels[lang][3]).disabled,true,'no client self-approval');
  stage='approved';const before=mutations().length;await click(labels[lang][4]);eq(mutations().length,before,'status refresh is read-only');
  await click(labels[lang][3]);eq(stage,'provisioned');const count=mutations().length;await render(`provisioned-${lang}`,lang);eq(button(labels[lang][0]).disabled,true);eq(mutations().length,count,'remount does not create/provision again');
 }
 await reset();await render('lost-create');mode='lost';await click(labels.en[0]);const key=helper.setupStorageKey(ctx,membership),savedCommand=JSON.parse(sessionStorage.getItem(key)).pending.command;
 eq(savedCommand.payload.association.name,'CLADORA Synthetic Association');eq(button(labels.en[0]).disabled,true);eq(document.querySelector('fieldset').disabled,true);
 await render('lost-create-remount');eq(JSON.parse(sessionStorage.getItem(key)).pending.command,savedCommand);eq(mutations().length,1,'unknown create must never retry without authoritative key reader');
 mode='success';active={context_id:other,membership_id:other};await render('other-context');eq(document.querySelector('fieldset input').value,'CLADORA Synthetic Association');eq(button(labels.en[0]).disabled,false,'independent Context unaffected');
 active={context_id:ctx,membership_id:membership};await render('back-to-uncertain');eq(button(labels.en[0]).disabled,true);eq(mutations().length,1);
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
 console.log(`PASS mounted building setup: ${checks} assertions, EN/RO/FA + RTL, exact persistence, synchronous double-submit, stale Context, denial, reconciliation; mocked transport/JSDOM, NOT real browser/Auth/DB.`);
}finally{await act(async()=>root.unmount());globalThis.fetch=originalFetch;for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}dom.window.close();}
