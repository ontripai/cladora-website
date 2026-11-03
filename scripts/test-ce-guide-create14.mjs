/** Targeted Task14 product-path checks. Modeled Auth/SQL transport; NO native PG/session/persistence proof. */
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
const {JSDOM}=require('jsdom');const initialDom=new JSDOM('<div></div>');Object.assign(globalThis,{window:initialDom.window,document:initialDom.window.document});
const ts=require('typescript'),React=require('react'),{act}=React,{createRoot}=require('react-dom/client');
const {NextRequest}=require('next/server');
const cache=new Map();let contextFixture,transport,legacyBackend;
function load(p){p=path.posix.normalize(p);if(cache.has(p))return cache.get(p).exports;
 if(p==='src/lib/supabase/server.ts')return {createClient:async()=>{if(!legacyBackend)throw Error('NO_REAL_AUTH_CONFIGURED');return legacyBackend;}};
 if(p==='src/components/customer/CustomerContextProvider.tsx')return {useCustomerContext:()=>contextFixture};
 if(p==='src/components/dashboard-lab/DashboardTransport.tsx')return {useDashboardFetch:()=>transport};
 const m={exports:{}};cache.set(p,m);const js=ts.transpileModule(readFileSync(path.join(root,p),'utf8'),{fileName:p,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
 new Function('require','module','exports',js)(n=>{if(n==='server-only')return{};if(n.startsWith('@/'))return load(resolve('src/'+n.slice(2)));if(n.startsWith('.'))return load(resolve(path.posix.join(path.posix.dirname(p),n)));return require(n);},m,m.exports);return m.exports;}
function resolve(p){if(/\.[cm]?[jt]sx?$/.test(p))return p;for(const ext of ['.ts','.tsx']){try{readFileSync(path.join(root,p+ext));return p+ext;}catch{}}throw Error('SOURCE_MISSING '+p);}

// Fixture setup only from the exact accepted Core review. No prior case executes.
let source=execFileSync('git',['show','ae8107ad170139b650e884863f83ccb0db63edf2:scripts/test-core-ce012-writer-joint-review-09.mjs'],{cwd:root,encoding:'utf8'});
source=source.slice(source.indexOf('const id=n=>'),source.indexOf('async function saved()'));
source=source.replace('version:1,ledgers:', 'version:1,created:new Map(),stepRows:new Map(),ledgers:')
 .replace('version:f.version,ledgers:', 'version:f.version,created:f.created,stepRows:f.stepRows,ledgers:')
 .replace("if(f.faultSql===text)throw f.driver;",`if(f.faultSql===text)throw f.driver;
 if(text===create.CE012_CREATE_EXISTS_SQL){const row=f.created.get(v[2]);return result(row&&row.tenant_id===v[0]&&row.workspace_id===v[1]?[{id:v[2]}]:[]);}
 if(text===create.CE012_CREATE_HISTORY_SQL){const g=f.created.get(v[2]);if(!g||g.tenant_id!==v[0]||g.workspace_id!==v[1])return result([]);
 const step=[...f.stepRows.values()].find(s=>s.guide_id===g.guide_id&&s.version===1);return result(step?[{created_by:g.created_by,id:step.id,title:step.title,body:step.body}]:[]);}
 if(text===create.CE012_CREATE_GUIDE_SQL){if(f.created.has(v[0]))throw Object.assign(Error('modeled Guide PK collision'),{code:'23505'});
 f.created.set(v[0],{guide_id:v[0],tenant_id:v[1],workspace_id:v[2],title:v[3],audience:JSON.parse(v[4]),created_by:v[5],version:1});f.writes.push('guide');return result([{id:v[0]}]);}
 if(text===create.CE012_CREATE_STEP_SQL){if(f.steps.has(v[0]))throw Object.assign(Error('modeled step PK collision'),{code:'23505'});
 f.steps.add(v[0]);f.stepRows.set(v[0],{id:v[0],guide_id:v[3],version:1,title:v[4],body:v[5]});f.writes.push('step');return result([{id:v[0]}]);}
 `)
 .replace("f.writes.push('c03');return result([]);", "f.writes.push('c03');if(f.expireAtReservation)f.expired=true;return result([]);");
const core=load('src/lib/core/postgres-transaction-host-v1.ts'),writer=load('src/lib/community/experience-guide-save-writer-v1.ts'),ce=load('src/lib/community/experience-guide-command-contract.ts');
const create=load('src/lib/community/experience-guide-create-writer-v1.ts'),api=load('src/lib/community/experience-guide-functional-http-v1.ts');
const cs=load('src/lib/core/ce012-combined-stored-relation-v1.ts'),stored=load('src/lib/core/ce012-stored-relation-v1.ts');
const {fixture,ids}=new Function('core','writer','ce','create','ceSql','coreSql','expirySql',source+'\nreturn {fixture,ids};')(core,writer,ce,create,cs.CORE_CE012_SAVE_RELATION_SQL,stored.CORE_CE012_STORED_RELATION_SQL,stored.CORE_CE012_STORED_EXPIRY_SQL);
function setup(){const f=fixture(),connect=f.pool.connect.bind(f.pool);let auth=true,manage=true,lose=false,malform=false,delay=null;
 const projection=()=>({guides:[...f.created.values()].map(g=>({...g,status:'draft',can_edit:manage,steps:[...f.stepRows.values()].filter(s=>s.guide_id===g.guide_id).map(s=>({id:s.id,title:s.title,body:s.body,references:[]}))})).map(({tenant_id,created_by,...g})=>{void tenant_id;void created_by;return g;}),limit:50});
 const role={contract_version:'core-platform-role-bound-pool.v1',connection_model:'direct',async connect(){const client=await connect(),query=client.query.bind(client);client.query=async(q,v=[])=>{
  if(q.startsWith('select current_user::text'))return {rows:[{current_user:'cladora_ce_guide_executor',session_user:'cladora_ce_guide_runtime'}],rowCount:1};
  if(q.includes('set_config('))return {rows:[{}],rowCount:1};
  if(q===api.CE012_FUNCTIONAL_AUTH_SQL)return {rows:[{tenant_id:ids.tenant,membership_id:ids.member,can_manage:manage&&v[0]===ids.context&&v[1]===ids.workspace,can_read:v[0]===ids.context&&v[1]===ids.workspace,revision:1,session_guard:null}],rowCount:1};
  if(q.startsWith('select auth.uid()=$1'))return {rows:[{actor_bound:v[0]===ids.actor,allowed:!f.expired&&v[1]===ids.context&&v[2]===ids.workspace&&manage}],rowCount:1};
  if(q.includes('from platform.module_definitions'))return {rows:[{allowed:!f.expired&&manage&&v[0]===ids.context&&v[1]===ids.workspace,evaluated_at:f.now,module_definition_id:'20000000-0000-4000-8000-000000000040',entitlement_key:'module.experience_guides'}],rowCount:1};
  if(q===api.CE012_FUNCTIONAL_READ_SQL)return {rows:[{projection:projection()}],rowCount:1};
  return query(q,v);};return client;}};
 const dependencies={role_bound_pool:role,authenticate:async()=>auth?{source:'supabase_verified_session',actor_id:ids.actor,assurance_level:'aal2',expires_at:4070908800}:null};
 const handler=api.createCe012FunctionalHandlersV1(dependencies),wires=[],statuses=[];
 const reader=api.createCe012GuideReadCutoverV1(()=>{throw Error('NO_LEGACY_FALLBACK');},dependencies);
 const fetch=async(url,init={})=>{const request=new NextRequest('http://ce.test'+url,{...init,headers:{origin:'http://ce.test',...init.headers}});
  if(init.method!=='POST')return reader(request);
  wires.push(init.body);const response=await handler.POST(request);statuses.push(response.status);
  if(JSON.parse(init.body).op==='execute_create'){
   if(delay)await delay();if(lose){lose=false;throw Error('modeled lost reply');}if(malform)return Response.json({outcome:'created',guide_id:'wrong'});
  }return response;};
 return {f,handler,fetch,wires,statuses,dependencies,projection,deny(){auth=false;},noManage(){manage=false;},lose(){lose=true;},malform(){malform=true;},delay(fn){delay=fn;}};
}
const client=load('src/lib/community/experience-guide-create-client.ts'),input={title:'New independent guide',step_title:'First step',instructions:'Synthetic instructions',reason:'Synthetic guide setup'};
function creator(h,owner=()=>owner){return client.createCe012GuideCreatorV1({fetch:h.fetch,context_id:ids.context,workspace_id:ids.workspace,owner,denied:()=>{},timeoutMs:2000});}
const selected=process.argv.find(x=>x.startsWith('--case='))?.slice(7);let n=0;
async function check(name,fn){if(selected&&name!==selected)return;await fn();console.log(`ok ${++n} - ${name}`);}
async function prepared(h){const s=creator(h);await s.create(input);return JSON.parse(h.wires[1]);}
async function post(h,value){return h.fetch('/api/customer/v1/experience/guides/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(value)});}
await check('create0 is distinct from positive save; one step/no references only',async()=>{const h=setup(),wire=await prepared(h),g=wire.command;
 assert.equal(g.expected_version,0);assert.equal(wire.core_command.aggregate_version,1);assert.equal(wire.core_command.subject_reference.version,1);assert.equal(wire.core_command.subject_reference.relation,'create_guide');
 for(const command of [{...g,expected_version:1},{...g,steps:[...g.steps,...g.steps]},{...g,steps:[{...g.steps[0],references:[{target_type:'external_url',url:'https://example.test',label:'Test'}]}]}])assert.equal((await post(h,{op:'prepare_create',command})).status,400);
});
await check('actual client -> handler -> provider -> Core atomically creates Guide/step/C03/audit/outbox',async()=>{const h=setup(),s=creator(h),id=await s.create(input);assert.ok(h.f.created.has(id));assert.equal(h.f.commits,1);assert.equal(h.f.stepRows.size,1);assert.deepEqual(h.f.writes,['c03','guide','step','audit','outbox']);
 const wire=JSON.parse(h.wires[1]),row=[...h.f.ledgers.values()][0];assert.equal(row.response_ref.aggregate_id,id);assert.equal(row.response_ref.provider_evidence.provider_code,create.CE012_CREATE_PROVIDER_V1);assert.equal(row.response_ref.aggregate_version,1);
 assert.equal(wire.core_command.input_fingerprint,create.fingerprintCe012CreateV1(wire.command));assert.equal(s.retainedDraft(),null);
 assert.equal(h.f.trace.filter(t=>t.q.includes('from documents.')).length,0);
 const response=await h.fetch(`/api/customer/v1/experience/guides?context_id=${ids.context}&workspace_id=${ids.workspace}`);const read=await response.json();assert.equal(read.projection.guides[0].guide_id,id);assert.equal(read.projection.guides[0].version,1);
});
await check('double dispatch coalesces; exact duplicate and lost reply retain same wire/key with one commit',async()=>{const h=setup(),s=creator(h);h.lose();const p=s.create(input);assert.equal(s.create(input),p);await assert.rejects(p,e=>e.code==='UNKNOWN');const wire=h.wires[1];assert.ok(s.retainedDraft());await s.create(input);assert.equal(h.wires[2],wire);assert.equal(h.f.commits,1);assert.equal(h.f.created.size,1);assert.equal(h.f.stepRows.size,1);
 assert.equal((await post(h,JSON.parse(wire))).status,200);assert.equal(h.f.commits,1);
});
await check('same key changed payload and new key same Guide conflict; original rows unchanged',async()=>{const h=setup(),wire=await prepared(h),before=structuredClone(h.f.writes);
 const changed=structuredClone(wire);changed.command.title='Changed payload';changed.core_command.input_fingerprint=create.fingerprintCe012CreateV1(changed.command);assert.equal((await post(h,changed)).status,409);
 const next=structuredClone(wire);next.command.command_id=crypto.randomUUID();next.command.idempotency_key='different-create-key';next.core_command.command_id=next.command.command_id;next.core_command.transaction_id=crypto.randomUUID();next.core_command.idempotency_key=next.command.idempotency_key;next.core_command.input_fingerprint=create.fingerprintCe012CreateV1(next.command);assert.equal((await post(h,next)).status,409);assert.deepEqual(h.f.writes,before);assert.equal(h.f.created.size,1);
});
await check('step collision rolls back Guide/C03 with no receipt/audit/outbox',async()=>{const h=setup(),wire=await prepared(h),f=fixture();f.steps.add(wire.command.steps[0].id);
 // Existing Guide is absent in this independent modeled transaction; only the storage PK collides.
 const result=await f.host.execute(wire.core_command,create.createCe012CreateWriterProviderV1(wire.command));assert.equal(result.status,'denied');assert.equal(f.created.size,0);assert.equal(f.ledgers.size,0);assert.deepEqual(f.writes,[]);
});
await check('denial, cross scope and actor mismatch stop without writes',async()=>{for(const mode of ['session','permission','scope']){const h=setup();if(mode==='session')h.deny();if(mode==='permission')h.noManage();const s=creator(h);
 if(mode==='scope'){const wire=await prepared(h);wire.command.workspace_id=crypto.randomUUID();wire.core_command.workspace_id=wire.command.workspace_id;wire.core_command.input_fingerprint=create.fingerprintCe012CreateV1(wire.command);const before=structuredClone(h.f.writes);assert.notEqual((await post(h,wire)).status,200);assert.deepEqual(h.f.writes,before);}
 else{await assert.rejects(s.create(input));assert.equal(h.f.commits,0);assert.deepEqual(h.f.writes,[]);}}
 const h=setup(),wire=await prepared(h),before=structuredClone(h.f.writes);wire.core_command.actor_id=crypto.randomUUID();assert.equal((await post(h,wire)).status,403);assert.deepEqual(h.f.writes,before);
});
await check('expiry after C03 reservation denies at mutation checkpoint and rolls back; original40001 preserved',async()=>{const h=setup(),wire=await prepared(h);const f=fixture();f.expireAtReservation=true;const result=await f.host.execute(wire.core_command,create.createCe012CreateWriterProviderV1(wire.command));assert.equal(result.status,'denied');assert.equal(f.created.size,0);assert.deepEqual(f.writes,[]);
 const fault=fixture(),original=Object.assign(Error('modeled serialization'),{code:'40001'});fault.faultSql=create.CE012_CREATE_GUIDE_SQL;fault.driver=original;let same=0;const provider=create.createCe012CreateWriterProviderV1(wire.command),mutate=provider.mutate;
 provider.mutate=async(...args)=>{try{return await mutate(...args);}catch(e){assert.equal(e,original);same++;throw e;}};assert.equal((await fault.host.execute(wire.core_command,provider)).status,'denied');assert.equal(same,3);assert.deepEqual(fault.writes,[]);
});
await check('malformed success and denial after UNKNOWN cannot clear or rekey pending',async()=>{for(const mode of ['malformed','denied']){const h=setup(),s=creator(h);if(mode==='malformed')h.malform();else h.lose();await assert.rejects(s.create(input),e=>e.code==='UNKNOWN');const wire=h.wires[1];if(mode==='denied')h.deny();await assert.rejects(s.create(input),e=>e.code==='UNKNOWN');assert.equal(h.wires[2],wire);await assert.rejects(s.create({...input,title:'Other'}),e=>e.code==='UNKNOWN');assert.equal(h.wires.length,3);assert.ok(s.retainedDraft());}
});
await check('late response/JSON after owner change cannot settle a new scope',async()=>{for(const mode of ['response','json']){const h=setup();let epoch={},release,arrived;const at=new Promise(r=>{arrived=r;});const real=h.fetch;
 if(mode==='response')h.delay(()=>new Promise(r=>{release=r;arrived();}));
 else h.fetch=async(...args)=>{const response=await real(...args);if(JSON.parse(args[1]?.body??'{}').op!=='execute_create')return response;return {ok:true,status:200,json:()=>new Promise(r=>{release=async()=>r(await response.json());arrived();})};};
 const s=creator(h,()=>epoch),promise=s.create(input);await at;epoch={};await release();await assert.rejects(promise,e=>e.code==='UNKNOWN');assert.ok(s.retainedDraft());assert.equal(h.f.commits,1);}
});
const {CustomerExperienceGuidePage:Page}=load('src/components/customer/CustomerExperienceGuidePage.tsx');
async function mount(h,lang='en'){const dom=new JSDOM('<div id="root"></div>',{url:'http://ce.test'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true});
 contextFixture={active:{context_id:ids.context,membership_id:ids.member},dashboard:{workspace_id:ids.workspace,contextId:ids.context},loading:false};transport=h.fetch;const root=createRoot(document.getElementById('root'));
 const render=async lang=>act(async()=>{root.render(React.createElement(Page,{lang}));await new Promise(r=>setTimeout(r,35));});await render(lang);
 const fill=async()=>act(async()=>{const values=[input.title,input.step_title,input.instructions,input.reason];for(const [i,el]of [...document.querySelectorAll('input,textarea')].entries()){
  const prototype=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement.prototype:window.HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,values[i]);el.dispatchEvent(new window.Event('input',{bubbles:true}));el.dispatchEvent(new window.Event('change',{bubbles:true}));}});
 return {render,fill,close:async()=>{await act(async()=>root.unmount());dom.window.close();}};
}
await check('mounted actual Page EN/RO/FA creates document-free Guide and enters same Guide editor',async()=>{for(const lang of ['en','ro','fa']){const h=setup(),ui=await mount(h,lang);assert.equal(document.querySelectorAll('form').length,1);await ui.fill();
 await act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,50));});
 assert.equal(h.f.commits,1);const g=[...h.f.created.values()][0];assert.equal(document.querySelector('select').value,g.guide_id);assert.equal(document.querySelectorAll('form').length,2);assert.equal(document.querySelector('form input').value,input.title);assert.equal(document.querySelector('form').closest('section').dir,lang==='fa'?'rtl':'ltr');await ui.close();}
});
await check('mounted UNKNOWN survives locale/context suspension; explicit retry one creation',async()=>{const h=setup(),ui=await mount(h);await ui.fill();h.lose();
 const submit=async()=>act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,40));});await submit();assert.ok(document.querySelector('[role="alert"]'));assert.equal(document.querySelector('fieldset').disabled,true);
 contextFixture={...contextFixture,loading:true};await ui.render('ro');assert.equal(document.querySelector('form'),null);contextFixture={...contextFixture,loading:false};await ui.render('fa');
 // Readback does NOT resolve UNKNOWN. Existing editor is separate; creator remains locked.
 assert.equal(document.querySelectorAll('form').length,1); // UNKNOWN creation cannot grant edit admission from GET.
 const form=[...document.querySelectorAll('form')].at(-1);assert.equal(form.querySelector('fieldset').disabled,true);assert.equal(form.querySelector('input').value,input.title);
 await act(async()=>{form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,45));});assert.equal(h.wires[1],h.wires[2]);assert.equal(h.f.commits,1);await ui.close();
});
await check('accepted reader200 with unconfigured writer503 stays readable and never exposes create/editor',async()=>{
 const h=setup();await prepared(h);let denied=false;legacyBackend={auth:{getClaims:async()=>({data:denied?null:{claims:{sub:ids.actor}},error:null})},schema:()=>({rpc:async()=>({data:h.projection(),error:null})})};
 const reader=load('src/app/api/customer/v1/experience/guides/route.ts').GET,offline=api.createCe012FunctionalHandlersV1({...h.dependencies,role_bound_pool:null});
 assert.equal((await offline.POST(new NextRequest('http://ce.test/api/customer/v1/experience/guides/draft',{method:'POST',headers:{origin:'http://ce.test','content-type':'application/json'},body:JSON.stringify({op:'prepare_create',command:JSON.parse(h.wires[0]).command})}))).status,503);
 assert.equal((await offline.GET(new NextRequest(`http://ce.test/x?context_id=${ids.context}&workspace_id=${ids.workspace}`))).status,503);
 const actual=h.fetch,calls=[];h.fetch=async(url,init={})=>{calls.push(url);assert.notEqual(init.method,'POST');return reader(new NextRequest('http://ce.test'+url,init));};
 const ui=await mount(h);assert.ok(document.body.textContent.includes(input.title));assert.equal(document.querySelectorAll('form').length,0);assert.ok(calls.every(p=>!p.includes('/draft')));
 denied=true;await ui.render('fa');assert.equal(document.querySelectorAll('form').length,0);assert.equal(document.body.textContent.includes(input.title),false);await ui.close();h.fetch=actual;
});
console.log(JSON.stringify({task:'CE-GUIDE-CREATE-14',groups:n,result:'PASS_CONTROLLED_SOURCE',toolchain:{next:require('next/package.json').version,zod:require('zod/package.json').version,typescript:ts.version},native_auth_pg_restart:'NOT_RUN_NOT_PASS',prior_suites:'NOT_RERUN'}));
