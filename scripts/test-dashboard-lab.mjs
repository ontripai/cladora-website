import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import ts from 'typescript';
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url),rootPath=fileURLToPath(new URL('..',import.meta.url));
const cache=new Map();
const mocks={'next/link':{__esModule:true,default:({children,prefetch,...props})=>React.createElement('a',props,children)},'next/navigation':{usePathname:()=>'/en/platform/dashboard-lab',useRouter:()=>({}),notFound:()=>{throw Error('NOT_FOUND')}}};
function load(file){let filename=path.resolve(rootPath,file);if(!existsSync(filename))filename=['.ts','.tsx','/index.ts'].map(s=>filename+s).find(existsSync);assert.ok(filename,`Module ${file}`);if(cache.has(filename))return cache.get(filename).exports;const m=new Module(filename);cache.set(filename,m);m.require=id=>mocks[id]??(id.startsWith('@/')?load('src/'+id.slice(2)):id.startsWith('.')?load(path.resolve(path.dirname(filename),id)):require(id));m._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2020}}).outputText,filename);return m.exports;}
const {LAB_ROLES,labRoleName}=load('src/lib/dashboard-lab/catalog.ts');
const {createLabTransport}=load('src/lib/dashboard-lab/fixtures.ts');
let realCalls=0;globalThis.fetch=async()=>{realCalls++;throw Error('REAL_NETWORK_FORBIDDEN')};
for(const role of LAB_ROLES){const f=createLabTransport(role,'en');assert.equal((await f('https://cladora.ro/api/customer/v1/contexts')).status,403);assert.equal((await f('/api/platform/v1/operators',{method:'POST',body:'{}'})).status,403);}
const owner=createLabTransport('multi_unit_owner','fa');const endpoint='/api/owner-portfolio/v1';const call=(p,method,body)=>owner(endpoint+p,{method,body:JSON.stringify(body)});
let initial=await (await owner(endpoint)).json();assert.equal(initial.units.length,2);
await call('','POST',{action:'unit',building_label:'Test new',unit_label:'Z1',address_text:'Test address',usage_kind:'office'});assert.equal((await(await owner(endpoint)).json()).units.length,3);
const overview=await(await owner(endpoint+'/overview')).json();const entry=overview.overdue[0];assert.ok(entry);
assert.equal((await call('/cash','PATCH',{entry_id:entry.id,paid_on:overview.today})).status,200);assert.equal((await(await owner(endpoint+'/overview')).json()).overdue.length,0);assert.equal((await call('/cash','PATCH',{entry_id:entry.id,paid_on:overview.today})).status,409);
assert.equal((await(await createLabTransport('multi_unit_owner','fa')(endpoint)).json()).units.length,2,'reset restores fixtures');
const dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test'});globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.FormData=dom.window.FormData;globalThis.sessionStorage=dom.window.sessionStorage;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
sessionStorage.setItem('cladora.customer-context.v1','real-context-untouched');
const {DashboardLab}=load('src/components/dashboard-lab/DashboardLab.tsx');
for(const lang of ['ro','en','fa'])for(const role of LAB_ROLES){const root=createRoot(document.getElementById('root'));await act(async()=>{root.render(React.createElement(DashboardLab,{lang,initialRole:role}));});await act(async()=>{await new Promise(r=>setTimeout(r,30));});assert.ok(document.body.textContent.includes(labRoleName(role,lang)));assert.equal(document.querySelector('main').dir,lang==='fa'?'rtl':'ltr');assert.equal(document.querySelectorAll('a[href*="/app/"]').length,0,'no production customer links or prefetch');assert.equal(document.querySelectorAll('[role="alert"]').length,0,`${lang} ${role}: no fixture load error`);assert.equal(sessionStorage.getItem('cladora.customer-context.v1'),'real-context-untouched');const selects=document.querySelectorAll('select');
 for(const state of ['empty','error']){await act(async()=>{selects[1].value=state;selects[1].dispatchEvent(new dom.window.Event('change',{bubbles:true}));});await act(async()=>{await new Promise(r=>setTimeout(r,30));});if(state==='error')assert.ok(document.querySelector('[role="alert"]'),`${role} exposes loading failure`);}
 await act(async()=>root.unmount());}
assert.equal(realCalls,0,'all dashboard reads remain in memory');
console.log(`PASS dashboard lab: ${LAB_ROLES.length*3} role/locale renders, zero network, production-context isolation, reset, payment transition and blocked routes`);

let authorization={isAuthorized:true,assuranceLevel:'aal2',roles:['PLATFORM_SUPER_ADMIN']};
mocks['@/lib/platform/auth']={getPlatformAuthContext:async()=>authorization};mocks['@/types']={isSupportedLocale:l=>['ro','en','fa'].includes(l)};
const Page=load('src/app/[lang]/platform/(control-plane)/dashboard-lab/page.tsx').default;
for(const lang of ['ro','en','fa']){const props={params:Promise.resolve({lang}),searchParams:Promise.resolve({role:'multi_unit_owner'})};assert.equal((await Page(props)).props.initialRole,'multi_unit_owner');for(const rejected of [{isAuthorized:false,assuranceLevel:'aal2',roles:['PLATFORM_SUPER_ADMIN']},{isAuthorized:true,assuranceLevel:'aal1',roles:['PLATFORM_SUPER_ADMIN']},{isAuthorized:true,assuranceLevel:'aal2',roles:['PLATFORM_SUPPORT']}]){const prev=authorization;authorization=rejected;await assert.rejects(()=>Page(props),/NOT_FOUND/);authorization=prev;}}
console.log('PASS dashboard lab server gate: only authorized AAL2 superadmin, all three locales; sample/empty/error states rendered');
