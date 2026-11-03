/** Only read-cutover regressions. Actual Page/routes; controlled Auth/RPC/SQL, not native proof. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const BASE='3102fc6861c7c3ce971a95007206c5e08cf732e7';
const before=process.argv.includes('--before');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const arg=process.argv.find(x=>x.startsWith('--toolchain='));
const require=createRequire(arg?path.join(path.resolve(arg.slice(12)),'package.json'):new URL('../package.json',import.meta.url));
const ts=require('typescript');
const source=readFileSync(path.join(root,'scripts/test-ce-functional-guide13-flow.mjs'),'utf8');
let prefix=source.slice(0,source.indexOf('const browser=load('));
// Reuse setup only; none of the earlier successful groups execute.
prefix=prefix.replaceAll('import.meta.url',JSON.stringify(new URL('test-ce-functional-guide13-flow.mjs',import.meta.url).href))
 .replace('const require=createRequire','const realmRequire=createRequire').replaceAll('require(','realmRequire(')
 .replace('let contextFixture,transport;','let contextFixture,transport,supabaseFixture;')
 .replace("{createClient:()=>{throw Error('NO_REAL_AUTH_CONFIGURED');}}",'{createClient:async()=>supabaseFixture}')
 .replace("ts.transpileModule(readFileSync(path.join(root,p),'utf8'),", "ts.transpileModule(__before&&p==='src/components/customer/CustomerExperienceGuidePage.tsx'?__basePage:readFileSync(path.join(root,p),'utf8'),")
 .replace(/const handler=api\.createCe012FunctionalHandlersV1\((\{role_bound_pool:role,authenticate:[^\n]+)\);/,'const dependencies=$1;const handler=api.createCe012FunctionalHandlersV1(dependencies);')
 .replace('return {f,handler,fetch,wires,','return {f,handler,fetch,wires,dependencies,');
assert.ok(prefix.includes('dependencies,')&&prefix.includes('supabaseFixture'));
prefix+='\nexport {setup,api,projection,ids,React,act,JSDOM,createRoot,load,NextRequest};\nexport const setView=(c,t)=>{contextFixture=c;transport=t;};\nexport const setBackend=x=>{supabaseFixture=x;};';
const compiled=ts.transpileModule(prefix,{fileName:'fixture.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const m={exports:{}};new Function('require','module','exports','__before','__basePage',compiled)(require,m,m.exports,before,execFileSync('git',['show',`${BASE}:src/components/customer/CustomerExperienceGuidePage.tsx`],{cwd:root,encoding:'utf8'}));
const {setup,api,projection,ids,React,act,JSDOM,createRoot,load,NextRequest,setView,setBackend}=m.exports;
const {CustomerExperienceGuidePage:Page}=load('src/components/customer/CustomerExperienceGuidePage.tsx');
let legacyCalls=0,legacyAuth=true,legacyError=null,currentProjection=()=>projection(1);
setBackend({auth:{getClaims:async()=>({data:legacyAuth?{claims:{sub:ids.actor}}:null,error:null}),getUser:async()=>({data:{user:{id:ids.actor}},error:null}),getSession:async()=>({data:{session:{user:{id:ids.actor},expires_at:4070908800}},error:null}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:'aal2'},error:null})}},schema:()=>({rpc:async()=>{legacyCalls++;return {data:currentProjection(),error:legacyError};}})});
const legacy=load('src/app/api/customer/v1/experience/guides/route.ts').GET;
const unconfigured=load('src/app/api/customer/v1/experience/guides/draft/route.ts').GET;
const url=`http://ce.test/api/customer/v1/experience/guides?context_id=${ids.context}&workspace_id=${ids.workspace}`;
function view(){return {active:{context_id:ids.context,membership_id:ids.member},dashboard:{workspace_id:ids.workspace,contextId:ids.context},loading:false};}
async function mount(fetch,lang='en'){const dom=new JSDOM('<div id="root"></div>',{url:'http://ce.test'});Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,Event:dom.window.Event,IS_REACT_ACT_ENVIRONMENT:true});const root=createRoot(document.getElementById('root')),context=view();setView(context,fetch);
 const render=async language=>act(async()=>{root.render(React.createElement(Page,{lang:language}));await new Promise(r=>setTimeout(r,30));});await render(lang);
 return {render,close:async()=>{await act(async()=>root.unmount());dom.window.close();}};}
let count=0;const rows=[];async function check(name,fn){const result=await fn();rows.push({name,...result});console.log(`ok ${++count} - ${name}`);}
await check('accepted legacy200 + unconfigured writer503: Guide remains visible, editor absent',async()=>{
 legacyAuth=true;legacyError=null;currentProjection=()=>projection(1);
 assert.equal((await legacy(new NextRequest(url))).status,200);
 assert.equal((await unconfigured(new NextRequest(url.replace('/guides?','/guides/draft?')))).status,503);
 const requests=[];const fetch=async(path,init={})=>{requests.push(path);const req=new NextRequest('http://ce.test'+path,init);return path.includes('/guides/draft')?unconfigured(req):legacy(req);};
 for(const lang of (before?['en']:['en','ro','fa'])){const h=await mount(fetch,lang);assert.equal(document.body.textContent.includes('Synthetic guide'),!before);assert.equal(document.querySelector('form'),null);await h.close();}
 assert.ok(requests.every(p=>p.includes(before?'/guides/draft?':'/guides?')));return {visible:!before,mode:before?'BEFORE_COUNTEREXAMPLE_NOT_PASS':'READ_PRESERVED'};
});
if(!before){
await check('configured official server composition: actual routed read enables actual writer only',async()=>{
 const h=setup(),reader=api.createCe012GuideReadCutoverV1(legacy,h.dependencies),old=legacyCalls;const requests=[];
 const fetch=async(p,i={})=>{requests.push({path:p,method:i.method??'GET'});return i.method==='POST'?h.fetch(p,i):reader(new NextRequest('http://ce.test'+p,i));};
 const mounted=await mount(fetch);assert.ok(document.querySelector('form'));
 await act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));});
 assert.equal(h.f.commits,1);assert.equal(legacyCalls,old);assert.ok(requests.filter(r=>r.method==='POST').every(r=>r.path.endsWith('/guides/draft')));await mounted.close();return {legacy_fallback_calls:0};
});
await check('configured reader401/403/503 never retries accepted-but-weaker legacy reader',async()=>{
 for(const status of [401,403,503]){const h=setup();if(status===401)h.deny();else{const connect=h.dependencies.role_bound_pool.connect.bind(h.dependencies.role_bound_pool);h.dependencies.role_bound_pool.connect=async()=>{const c=await connect(),query=c.query.bind(c);c.query=async(q,v)=>{if(q===api.CE012_FUNCTIONAL_AUTH_SQL){if(status===503)throw Object.assign(Error(),{code:'55000'});return {rows:[{tenant_id:ids.tenant,membership_id:ids.member,revision:1,can_manage:false,can_read:false,session_guard:null}],rowCount:1};}return query(q,v);};return c;};}
 const reader=api.createCe012GuideReadCutoverV1(legacy,h.dependencies),old=legacyCalls,requests=[];
 const mounted=await mount(async(p,i)=>{requests.push(p);const r=await reader(new NextRequest('http://ce.test'+p,i));assert.equal(r.status,status);return r;});
 assert.equal(document.querySelector('form'),null);assert.equal(document.body.textContent.includes('Synthetic guide'),false);assert.equal(legacyCalls,old);assert.equal(requests.length,1);await mounted.close();}
 return {statuses:[401,403,503],legacy_fallback_calls:0};
});
await check('legacy401/403 remain denial; new writer is not tried as a second reader',async()=>{
 for(const status of [401,403]){legacyAuth=status!==401;legacyError=status===403?{code:'42501'}:null;const calls=[];
 const mounted=await mount(async(p,i)=>{calls.push(p);assert.ok(!p.includes('/draft'));const r=await legacy(new NextRequest('http://ce.test'+p,i));assert.equal(r.status,status);return r;});
 assert.equal(document.body.textContent.includes('Synthetic guide'),false);assert.equal(calls.length,1);await mounted.close();}
 legacyAuth=true;legacyError=null;return {statuses:[401,403]};
});
await check('revocation after configured read: write denial removes admission without legacy read/write',async()=>{
 const h=setup(),reader=api.createCe012GuideReadCutoverV1(legacy,h.dependencies),old=legacyCalls,requests=[];
 const mounted=await mount(async(p,i={})=>{requests.push({p,method:i.method??'GET'});return i.method==='POST'?h.fetch(p,i):reader(new NextRequest('http://ce.test'+p,i));});
 assert.ok(document.querySelector('form'));h.deny();await act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));});
 assert.equal(document.querySelector('form'),null);assert.equal(document.body.textContent.includes('Synthetic guide'),false);assert.equal(legacyCalls,old);assert.equal(h.f.commits,0);assert.ok(requests.filter(x=>x.method==='POST').every(x=>x.p.endsWith('/draft')));await mounted.close();return {legacy_fallback_calls:0};
});
await check('explicit configuration changes preserve UNKNOWN/exact wire; legacy GET cannot resolve it',async()=>{
 const h=setup();h.lose();const configured=api.createCe012GuideReadCutoverV1(legacy,h.dependencies);let reader=configured;currentProjection=()=>projection(h.f.version);
 const fetch=async(p,i={})=>i.method==='POST'?h.fetch(p,i):reader(new NextRequest('http://ce.test'+p,i));const mounted=await mount(fetch);
 await act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));});assert.equal(document.querySelector('fieldset').disabled,true);assert.equal(h.f.commits,1);
 reader=legacy;await mounted.render('ro');assert.equal(document.querySelector('form'),null);assert.ok(document.body.textContent.includes('Synthetic guide'));assert.equal(h.wires.length,2);
 reader=configured;await mounted.render('fa');assert.equal(document.querySelector('fieldset').disabled,true);
 await act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,30));});assert.equal(h.wires.length,3);assert.equal(h.wires[1],h.wires[2]);assert.equal(h.f.commits,1);await mounted.close();return {same_wire:true,commits:1};
});
}
console.log(JSON.stringify({task:'CE-FUNCTIONAL-GUIDE-13/CE13-READ-CUTOVER-01',mode:before?'BEFORE_COUNTEREXAMPLE_NOT_PASS':'PASS_TARGETED_READ_CUTOVER',groups:count,rows,toolchain:{next:require('next/package.json').version,zod:require('zod/package.json').version},native_auth_db:'NOT_RUN_NOT_PASS'}));
