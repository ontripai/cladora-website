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

const {CORES,requirement,roleUse}=load('src/lib/module-registry/registry.ts');
const {PROPERTY_PROFILES,OPERATING_MODELS}=load('src/lib/module-registry/taxonomy.ts');
const {LAB_ROLES}=load('src/lib/dashboard-lab/catalog.ts');
assert.equal(CORES.length,17);assert.equal(new Set(CORES.map(c=>c.code)).size,17);
assert.equal(PROPERTY_PROFILES.length,16);assert.equal(OPERATING_MODELS.length,8);
for(const p of PROPERTY_PROFILES)for(const m of OPERATING_MODELS)for(const c of CORES){
 assert.ok(['recommended','optional','off'].includes(requirement(c.code,p.code,m.code)));
 for(const role of LAB_ROLES)assert.ok(['manage','review','own','internal','none'].includes(roleUse(c.code,role)));
}
assert.throws(()=>requirement('bad',PROPERTY_PROFILES[0].code,OPERATING_MODELS[0].code),/UNKNOWN_CORE/);
assert.throws(()=>requirement('C01','bad',OPERATING_MODELS[0].code),/UNKNOWN_TAXONOMY/);
assert.equal(requirement('C12','single_villa','single_owner_operated'),'off');
assert.equal(requirement('C12','residential_condominium','association_managed'),'recommended');
for(const c of CORES){for(const lang of ['ro','en','fa']){assert.ok(c.name[lang]?.trim());assert.ok(c.gap[lang]?.trim());}if(c.status==='planned')assert.equal(c.modules.length,0);}
const dom=new JSDOM('<div id="root"></div>');globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {ModuleRegistryPanel}=load('src/components/platform/ModuleRegistryPanel.tsx');
for(const lang of ['ro','en','fa']){
 const root=createRoot(document.getElementById('root'));
 await act(async()=>root.render(React.createElement(ModuleRegistryPanel,{lang})));
 assert.equal(document.querySelectorAll('tbody tr').length,17);assert.equal(document.querySelector('section').dir,lang==='fa'?'rtl':'ltr');
 const selects=document.querySelectorAll('select');assert.equal(selects[0].options.length,16);assert.equal(selects[1].options.length,8);assert.equal(selects[2].options.length,12);
 for(const role of LAB_ROLES){await act(async()=>{selects[2].value=role;selects[2].dispatchEvent(new dom.window.Event('change',{bubbles:true}));});assert.equal(document.querySelectorAll('tbody tr').length,17);assert.ok(!document.body.textContent.includes('undefined'));}
 await act(async()=>root.unmount());
}
let authorization={isAuthorized:true,assuranceLevel:'aal2',roles:['PLATFORM_SUPER_ADMIN']};
mocks['@/lib/platform/auth']={getPlatformAuthContext:async()=>authorization};
mocks['@/types']={isSupportedLocale:l=>['ro','en','fa'].includes(l)};
const Page=load('src/app/[lang]/platform/(control-plane)/module-registry/page.tsx').default;
for(const lang of ['ro','en','fa'])assert.equal((await Page({params:Promise.resolve({lang})})).props.lang,lang);
for(const rejected of [{isAuthorized:false,assuranceLevel:'aal2',roles:['PLATFORM_SUPER_ADMIN']},{isAuthorized:true,assuranceLevel:'aal1',roles:['PLATFORM_SUPER_ADMIN']},{isAuthorized:true,assuranceLevel:'aal2',roles:['PLATFORM_SUPPORT']}]){authorization=rejected;await assert.rejects(()=>Page({params:Promise.resolve({lang:'fa'})}),/NOT_FOUND/);}
console.log('PASS module registry: 17 cores × 16 profiles × 8 models × 12 personas; three-language rendering and superadmin gate');

const {NextRequest}=require('next/server');
let signedIn=true;let calls=[];
mocks['@/lib/supabase/server']={createClient:async()=>({auth:{getClaims:async()=>({data:{claims:signedIn?{sub:'test'}:null}})},schema:name=>{assert.equal(name,'customer_api');return {rpc:async(name,args)=>{calls.push({name,args});return {data:{ok:true},error:null}}}}})};
const route=load('src/app/api/customer/v1/maintenance-plans/route.ts');
const id='11700000-0000-4000-8000-000000000001';
const url='https://cladora.test/api/customer/v1/maintenance-plans';
const request=(body,origin='https://cladora.test')=>new NextRequest(url,{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
const body={action:'save',context_id:id,id,revision:0,asset_id:id,vendor_id:id,name:'Lift',anchor:'2026-01-31',unit:'months',every:1,enabled:true,checklist:['Check doors']};
assert.equal((await route.POST(request(body,'https://evil.test'))).status,403);
assert.equal((await route.POST(request({...body,every:0}))).status,400);
assert.equal((await route.POST(request({...body,anchor:'2026-02-31'}))).status,400);
assert.equal(calls.length,0);
signedIn=false;assert.equal((await route.POST(request(body))).status,401);assert.equal(calls.length,0);
signedIn=true;assert.equal((await route.POST(request(body))).status,200);assert.equal(calls[0].name,'save_calendar_plan_v1');assert.equal(calls[0].args.p_every,1);
assert.equal((await route.POST(request({action:'generate',context_id:id,plan_id:id,due_on:'2026-01-31'}))).status,200);assert.equal(calls[1].name,'generate_calendar_order_v1');
assert.equal((await route.GET(new NextRequest(url+'?context_id=invalid'))).status,400);
assert.equal((await route.GET(new NextRequest(url+'?context_id='+id))).status,200);
console.log('PASS calendar-plan API: origin, date/range validation, authentication, isolated RPCs and parameter mapping');
const {PreventiveMaintenancePanel}=load('src/components/customer/PreventiveMaintenancePanel.tsx');
for(const lang of ['ro','en','fa']){
 globalThis.fetch=async()=>new Response(JSON.stringify({plans:[],assets:[],vendors:[]}));
 const root=createRoot(document.getElementById('root'));
 await act(async()=>root.render(React.createElement(PreventiveMaintenancePanel,{lang,contextId:id})));
 await act(async()=>{await new Promise(r=>setTimeout(r,10));});
 assert.equal(document.querySelector('section').dir,lang==='fa'?'rtl':'ltr');
 assert.equal(document.querySelectorAll('form').length,0,'no mutation form without authorized assets');
 assert.ok(document.querySelector('h2').textContent.length>10);
 await act(async()=>root.unmount());
}
console.log('PASS maintenance plan panel: three-language empty/access-unavailable state');
