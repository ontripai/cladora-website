/** Real handler/client/React/Core executor, modeled role/SQL/Auth transport. NO native proof. */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=process.argv.find(x=>x.startsWith('--toolchain='));
const require=createRequire(arg?path.join(path.resolve(arg.slice(12)),'package.json'):new URL('../package.json',import.meta.url));
assert.equal(require('next/package.json').version,'16.4.1');assert.equal(require('zod/package.json').version,'4.6.6');
const ts=require('typescript'),React=require('react'),{act}=React,{createRoot}=require('react-dom/client'),{JSDOM}=require('jsdom');
const {NextRequest}=require('next/server');
const cache=new Map();let contextFixture,transport;
function load(p){p=path.posix.normalize(p);if(cache.has(p))return cache.get(p).exports;
 if(p==='src/lib/supabase/server.ts')return {createClient:()=>{throw Error('NO_REAL_AUTH_CONFIGURED');}};
 if(p==='src/components/customer/CustomerContextProvider.tsx')return {useCustomerContext:()=>contextFixture};
 if(p==='src/components/dashboard-lab/DashboardTransport.tsx')return {useDashboardFetch:()=>transport};
 const m={exports:{}};cache.set(p,m);const js=ts.transpileModule(readFileSync(path.join(root,p),'utf8'),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',js)(n=>{if(n==='server-only')return{};if(n.startsWith('@/'))return load(resolve('src/'+n.slice(2)));if(n.startsWith('.'))return load(resolve(path.posix.join(path.posix.dirname(p),n)));return require(n);},m,m.exports);return m.exports;}
function resolve(p){if(/\.[cm]?[jt]sx?$/.test(p))return p;for(const ext of ['.ts','.tsx']){try{readFileSync(path.join(root,p+ext));return p+ext;}catch{}}throw Error('SOURCE_MISSING '+p);}
// Reuse ONLY the official constraint-aware transport setup. Its tests never execute.
const ref='ae8107ad170139b650e884863f83ccb0db63edf2',fp='scripts/test-core-ce012-writer-joint-review-09.mjs';
let prefix=execFileSync('git',['show',`${ref}:${fp}`],{cwd:root,encoding:'utf8'});prefix=prefix.slice(prefix.indexOf('const id=n=>'),prefix.indexOf('async function saved()'));
// Fixture closes over actual current Core/CE writer and SQL constants.
const core=load('src/lib/core/postgres-transaction-host-v1.ts'),writer=load('src/lib/community/experience-guide-save-writer-v1.ts'),ce=load('src/lib/community/experience-guide-command-contract.ts');
const cs=load('src/lib/core/ce012-combined-stored-relation-v1.ts'),stored=load('src/lib/core/ce012-stored-relation-v1.ts');
const fixture=new Function('core','writer','ce','ceSql','coreSql','expirySql',prefix+'\nreturn {fixture,ids};')(core,writer,ce,cs.CORE_CE012_SAVE_RELATION_SQL,stored.CORE_CE012_STORED_RELATION_SQL,stored.CORE_CE012_STORED_EXPIRY_SQL);
const {ids}=fixture,api=load('src/lib/community/experience-guide-functional-http-v1.ts');
const projection=version=>({guides:[{guide_id:ids.guide,workspace_id:ids.workspace,title:'Synthetic guide',audience:{kind:'workspace'},status:'draft',version,can_edit:true,steps:[{id:ids.step,title:'Step',body:'Body',references:[]}]}],limit:50});
function setup(){const f=fixture.fixture(),connect=f.pool.connect.bind(f.pool);let reads=0,auth=true;
 const role={contract_version:'core-platform-role-bound-pool.v1',connection_model:'direct',async connect(){const c=await connect(),q=c.query.bind(c);
 c.query=async(text,v=[])=>{const s=text.replace(/\s+/g,' ').trim();
 if(s.startsWith('select current_user::text'))return {rows:[{current_user:'cladora_ce_guide_executor',session_user:'cladora_ce_guide_runtime'}],rowCount:1};
 if(s.includes("set_config("))return {rows:[{}],rowCount:1};
 if(text===api.CE012_FUNCTIONAL_AUTH_SQL)return {rows:[{tenant_id:ids.tenant,membership_id:ids.member,can_manage:true,can_read:true,revision:1,session_guard:null}],rowCount:1};
 if(text===api.CE012_FUNCTIONAL_READ_SQL){reads++;return {rows:[{projection:projection(f.version)}],rowCount:1};}
 return q(text,v);};return c;}};
 const handler=api.createCe012FunctionalHandlersV1({role_bound_pool:role,authenticate:async()=>auth?{source:'supabase_verified_session',actor_id:ids.actor,assurance_level:'aal2',expires_at:4070908800}:null});
 const wires=[];let lost=false;
 const fetch=async(url,init={})=>{const absolute='http://ce.test'+url;const headers={'origin':'http://ce.test',...init.headers};
 const req=new NextRequest(absolute,{...init,headers});if(init.method==='POST'){wires.push(init.body);const response=await handler.POST(req);if(lost&&JSON.parse(init.body).op==='execute'){lost=false;throw Error('modeled lost HTTP response');}return response;}return handler.GET(req);};
 return {f,handler,fetch,wires,get reads(){return reads;},lose(){lost=true;},deny(){auth=false;}};
}
const browser=load('src/lib/community/experience-guide-functional-client.ts');
const input={guide_id:ids.guide,title:'Changed guide',step_title:'Changed step',step_body:'Changed body',target_id:null};
function commands(h,owner=()=>owner){return browser.createCe012GuideHttpCommandsV1({fetch:h.fetch,binding:{context_id:ids.context,workspace_id:ids.workspace,guide_id:ids.guide,expected_guide_version:1},owner,denied:()=>{},timeoutMs:1000});}
const selected=process.argv.includes('--case')?process.argv[process.argv.indexOf('--case')+1]:null;
let count=0;async function check(name,fn){if(selected&&name!==selected)return;await fn();console.log(`ok ${++count} - ${name}`);}
await check('actual client prepare -> actual HTTP handler -> existing Core/writer executor; no document dependency',async()=>{const h=setup(),s=commands(h);await s.saveDraft(input);assert.equal(h.f.commits,1);assert.equal(h.f.version,2);assert.equal(h.wires.length,2);assert.equal(JSON.parse(h.wires[0]).op,'prepare');assert.equal(JSON.parse(h.wires[1]).op,'execute');
 const read=await h.handler.GET(new NextRequest(`http://ce.test/api/customer/v1/experience/guides/draft?context_id=${ids.context}&workspace_id=${ids.workspace}`));assert.equal(read.status,200);assert.equal((await read.json()).projection.guides[0].version,2);});
await check('lost HTTP reply -> UNKNOWN -> explicit identical execution wire, one save and no second preparation',async()=>{const h=setup(),s=commands(h);h.lose();await assert.rejects(s.saveDraft(input),e=>e.code==='UNKNOWN');assert.ok(s.retainedDraft());await s.saveDraft(input);assert.equal(h.f.commits,1);assert.equal(h.wires.length,3);assert.equal(h.wires[1],h.wires[2]);assert.equal(s.retainedDraft(),null);});
await check('owner replacement during decoded matched reply never resolves pending or publishes success',async()=>{const h=setup();let owner={},release;const original=h.fetch;h.fetch=async(...args)=>{const r=await original(...args);if(JSON.parse(args[1].body).op==='execute')return {ok:true,status:200,json:()=>new Promise(resolve=>{release=async()=>resolve(await r.json());})};return r;};const s=commands(h,()=>owner),p=s.saveDraft(input);for(let i=0;i<30&&!release;i++)await new Promise(r=>setTimeout(r,0));assert.ok(release);owner={};await release();await assert.rejects(p,e=>e.code==='UNKNOWN');assert.ok(s.retainedDraft());});
await check('unconfigured application remains NOT_READY; no fake create or service-role fallback',async()=>{const handler=api.createCe012FunctionalHandlersV1({role_bound_pool:null,authenticate:async()=>({source:'supabase_verified_session',actor_id:ids.actor,assurance_level:'aal2',expires_at:4070908800})});const r=await handler.GET(new NextRequest(`http://ce.test/x?context_id=${ids.context}&workspace_id=${ids.workspace}`));assert.equal(r.status,503);});
const {CustomerExperienceGuide}=load('src/components/customer/CustomerExperienceGuide.tsx');
await check('mounted existing Guide editor EN/RO/FA submits actual handler, retains UNKNOWN and explicit same-wire retry',async()=>{
 for(const lang of ['en','ro','fa']){const dom=new JSDOM('<div id="root"></div>',{url:'http://ce.test'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true});
 const h=setup(),s=commands(h);h.lose();const root=createRoot(document.getElementById('root'));let changed=0;
 const guide={...projection(1).guides[0],audience_label:'Workspace'};
 await act(async()=>root.render(React.createElement(CustomerExperienceGuide,{lang,guide,commands:s,onChanged:()=>changed++})));
 const form=document.querySelector('form');assert.ok(form);await act(async()=>{form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));});
 assert.equal(changed,0);assert.equal(document.querySelector('fieldset').disabled,true);assert.ok(document.querySelector('[role="alert"]'));
 await act(async()=>{form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));});assert.equal(changed,1);assert.equal(h.f.commits,1);assert.equal(h.wires[1],h.wires[2]);assert.equal(document.querySelector('section').dir,lang==='fa'?'rtl':'ltr');await act(async()=>root.unmount());dom.window.close();}
});
const {CustomerExperienceGuidePage}=load('src/components/customer/CustomerExperienceGuidePage.tsx');
await check('mounted actual page reads versioned route and submits through actual editor/handler/executor',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://ce.test'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true});
 const h=setup();contextFixture={active:{context_id:ids.context,membership_id:ids.member},dashboard:{workspace_id:ids.workspace,contextId:ids.context},loading:false};transport=h.fetch;
 const root=createRoot(document.getElementById('root'));await act(async()=>{root.render(React.createElement(CustomerExperienceGuidePage,{lang:'en'}));await new Promise(r=>setTimeout(r,30));});
 assert.ok(document.querySelector('form'));await act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,35));});
 assert.equal(h.f.commits,1);assert.ok(h.reads>=2);assert.equal(h.f.version,2);assert.ok(document.querySelector('form'));
 const oldReads=h.reads;contextFixture={...contextFixture,loading:true};await act(async()=>root.render(React.createElement(CustomerExperienceGuidePage,{lang:'fa'})));assert.equal(document.querySelector('form'),null);assert.equal(h.reads,oldReads);
 await act(async()=>root.unmount());dom.window.close();
});
await check('page scope suspension and higher-version read cannot clear UNKNOWN; exact pending survives and retries',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'http://ce.test'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true});
 const h=setup();h.lose();const active={context_id:ids.context,membership_id:ids.member},dashboard={workspace_id:ids.workspace,contextId:ids.context};
 contextFixture={active,dashboard,loading:false};transport=h.fetch;const root=createRoot(document.getElementById('root'));
 await act(async()=>{root.render(React.createElement(CustomerExperienceGuidePage,{lang:'en'}));await new Promise(r=>setTimeout(r,30));});
 await act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));});
 assert.equal(document.querySelector('fieldset').disabled,true);assert.equal(h.f.commits,1);
 contextFixture={active,dashboard,loading:true};await act(async()=>root.render(React.createElement(CustomerExperienceGuidePage,{lang:'ro'})));assert.equal(document.querySelector('form'),null);
 contextFixture={active,dashboard,loading:false};await act(async()=>{root.render(React.createElement(CustomerExperienceGuidePage,{lang:'ro'}));await new Promise(r=>setTimeout(r,30));});
 assert.equal(document.querySelector('fieldset').disabled,true);assert.equal(h.wires.length,2); // GET version2 did not resolve UNKNOWN
 await act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));});
 assert.equal(h.wires.length,3);assert.equal(h.wires[1],h.wires[2]);assert.equal(h.f.commits,1);
 await act(async()=>root.unmount());dom.window.close();
});
await check('malformed preparation cannot dispatch a command or lock a different identity',async()=>{
 const h=setup(),original=h.fetch;h.fetch=async(...args)=>{const r=await original(...args);if(JSON.parse(args[1].body).op==='prepare'){const value=await r.json();value.guide_command.idempotency_key='different-key';return Response.json(value);}return r;};
 const s=commands(h);await assert.rejects(s.saveDraft(input),e=>e.code==='NOT_READY');assert.equal(h.wires.length,1);assert.equal(s.isUncertain(),false);assert.equal(h.f.commits,0);
});
await check('different concurrent draft cannot inherit first command success or replace retained input',async()=>{
 const h=setup(),s=commands(h),first=s.saveDraft(input);
 await assert.rejects(s.saveDraft({...input,title:'Different'}),e=>e.code==='CONFLICT');await first;
 assert.equal(h.f.commits,1);assert.equal(h.wires.length,2);assert.equal(JSON.parse(h.wires[0]).title,input.title);
});
await check('server rejects altered descriptor/source lock set before host dispatch',async()=>{
 const h=setup();const prepare={op:'prepare',context_id:ids.context,workspace_id:ids.workspace,guide_id:ids.guide,expected_guide_version:1,command_id:'20000000-0000-4000-8000-000000000071',idempotency_key:'ce-test-descriptor-0001',title:'Title',step_title:'Step',instructions:'Body'};
 const r=await h.fetch('/api/customer/v1/experience/guides/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(prepare)});const pair=await r.json();pair.core_command.provider_source_ids.push('20000000-0000-4000-8000-000000000099');
 const result=await h.fetch('/api/customer/v1/experience/guides/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'execute',guide_command:pair.guide_command,core_command:pair.core_command})});
 assert.equal(result.status,400);assert.equal(h.f.commits,0);assert.deepEqual(h.f.writes,[]);
});
console.log(JSON.stringify({task:'CE-FUNCTIONAL-GUIDE-13',groups:count,result:'PASS_CONNECTED_SOURCE_WITH_MODELED_TRANSPORT',next:require('next/package.json').version,zod:require('zod/package.json').version,native_auth_db_restart:'NOT_RUN_NOT_PASS'}));
