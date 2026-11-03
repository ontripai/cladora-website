import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(import.meta.url),cache=new Map();
function load(path,mocks={}){
 const filename=resolve(root,path);if(cache.has(filename))return cache.get(filename).exports;
 const mod=new Module(filename);cache.set(filename,mod);
 mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:id.startsWith('.')||id.startsWith('@/')?load((id.startsWith('@/')?resolve(root,'src',id.slice(2)):resolve(dirname(filename),id))+(/\.tsx?$/.test(id)?'':'.ts')):require(id);
 mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return mod.exports;
}
const {handleValuationReadV1}=load('src/lib/airprop/valuation-read-v1.ts');
const route=load('src/app/api/customer/v2/airprop/valuation/route.ts');
const {valuationReadResponseV1Schema}=load('src/lib/airprop/valuation-read-response-v1.ts');
const fixture=JSON.parse(readFileSync(resolve(root,'scripts/fixtures/airprop-valuation-baseline-v1.json'),'utf8'));
const base=()=>structuredClone(fixture.base);
const selection={context_id:fixture.base.core_request.resource.context_id,workspace_id:fixture.base.resource.workspace_id,opportunity_id:'eeeeeeee-1111-4111-8111-111111111111',purpose:'sale_estimate'};
const req=(s=selection)=>new Request('https://offline.invalid/api/customer/v2/airprop/valuation?'+new URLSearchParams(s));
const wrap=i=>({contract:'valuation-baseline-prepared-input.v2',input:i});
function producer(i=base(),s=selection){return{
 // Fake trusted adapter evidence, deliberately not runtime/auth/PG proof.
 readPrepared:async()=>({selection:s,prepared:wrap(i)}),
 readCurrent:async()=>({selection:s,resource:i.resource,core_request:i.core_request,core_evidence:i.core_evidence,sources:i.sources,read_at:i.computed_at}),
};}
let count=0;const test=async(name,fn)=>{await fn();console.log(`PASS ${++count} ${name}`);};
const read=async(p,s=selection)=>{const response=await handleValuationReadV1(req(s),p);return{response,body:await response.json()};};
const nativeFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('REAL_NETWORK_FORBIDDEN');};
await test('unbound actual product GET is503 NOT_READY with no data access',async()=>{const response=await route.GET(req());assert.equal(response.status,503);assert.equal((await response.json()).state,'NOT_READY');assert.match(response.headers.get('cache-control'),/no-store, private/);assert.equal(response.headers.get('vary'),'Cookie');});
await test('GET-only; POST does not invoke producer or create receipt',async()=>{let calls=0;const response=await handleValuationReadV1(new Request(req().url,{method:'POST'}),{readPrepared:async()=>{calls++;}});assert.equal(response.status,405);assert.equal(calls,0);});
for(const [name,url] of [['duplicate',req().url+'&purpose=sale_estimate'],['client authority',req().url+'&allowed=true'],['private input',req().url+'&prepared={}'],['invalidUUID',req({...selection,workspace_id:'no'}).url]])await test('invalid query '+name,async()=>{let calls=0;const response=await handleValuationReadV1(new Request(url),{readPrepared:async()=>{calls++;}});assert.equal(response.status,400);assert.equal(calls,0);});
await test('actual sale engine oracle, public whitelist, no receipt/evidence/trace',async()=>{const {response,body}=await read(producer());assert.equal(response.status,200);assert.deepEqual(body.range,{low:'100000.00',central:'200000.00',high:'300000.00'});assert.equal(body.transaction_kind,'sale');assert.equal(body.rental_period,null);assert.deepEqual(Object.keys(body).sort(),['contract','state','transaction_kind','rental_period','currency','as_of','computed_at','outcome','range','basis','area_unit','factors'].sort());assert.doesNotMatch(JSON.stringify(body),/synthetic|receipt|evidence_ref|source_id|resource_id|commitment|run_version/);});
function rental(){const i=base();i.policy.transaction_kind='rent';i.policy.rental_period='month';i.request.purposes=['rental_recommendation'];i.observations.forEach((o,n)=>{o.transaction_kind='rent';o.attributes.rental_period='month';o.amount=String((n+1)*500);o.area='50';});return i;}
const rentSelection={...selection,purpose:'rental_recommendation'};
await test('actual independent monthly rent oracle',async()=>{const {body}=await read(producer(rental(),rentSelection),rentSelection);assert.equal(body.state,'RESULT');assert.equal(body.transaction_kind,'rent');assert.equal(body.rental_period,'month');assert.deepEqual(body.range,{low:'1000.00',central:'2000.00',high:'3000.00'});});
await test('actual insufficient data is result with null range; no fallback',async()=>{const i=base();i.observations=[];i.unit_links=[];i.sources=[];const {body}=await read(producer(i));assert.equal(body.state,'RESULT');assert.equal(body.outcome,'insufficient_data');assert.equal(body.range,null);});
await test('missing producer preparation is NOT_READY, never insufficient',async()=>{const {body}=await read({...producer(),readPrepared:async()=>null});assert.equal(body.state,'NOT_READY');});
await test('missing current authorization is NOT_READY, no historical result',async()=>{const {body}=await read({...producer(),readCurrent:async()=>null});assert.equal(body.state,'NOT_READY');});
for(const key of ['context_id','workspace_id','opportunity_id','purpose'])for(const phase of ['readPrepared','readCurrent'])await test('foreign '+key+' rejected at '+phase,async()=>{const p=producer(),original=p[phase];p[phase]=async()=>({...await original(),selection:{...selection,[key]:key==='purpose'?'rental_recommendation':'aaaaaaaa-1111-4111-8111-111111111111'}});const {response,body}=await read(p);assert.equal(response.status,403);assert.equal(body.state,'UNAVAILABLE');assert.equal(Object.keys(body).length,2);});
await test('policy/purpose mismatch denied before current read',async()=>{let calls=0;const p=producer();p.readCurrent=async()=>{calls++;return null;};const {response}=await read(p,rentSelection);assert.equal(response.status,403);assert.equal(calls,0);});
await test('current resource version drift denied by accepted projection',async()=>{const p=producer(),original=p.readCurrent;p.readCurrent=async()=>{const c=await original();c.resource={...c.resource,resource_version:99};return c;};const {response,body}=await read(p);assert.equal(response.status,403);assert.equal(body.state,'UNAVAILABLE');});
await test('current source rights revoked denies result',async()=>{const p=producer(),original=p.readCurrent;p.readCurrent=async()=>{const c=structuredClone(await original());c.sources[0].rights=null;return c;};const {body}=await read(p);assert.equal(body.state,'UNAVAILABLE');});
for(const reason of ['authority_revoke','relationship_expiry','missing_core'])await test('fresh Core '+reason+' blocks stale result',async()=>{
 const p=producer(),original=p.readCurrent;p.readCurrent=async()=>{const c=structuredClone(await original());if(reason==='authority_revoke')c.core_evidence.authority.decision='denied';if(reason==='relationship_expiry')c.core_evidence.relationship.valid_until='2025-01-01T00:00:00.000Z';if(reason==='missing_core')c.core_evidence={};return c;};
 const {body}=await read(p);assert.equal(body.state,'UNAVAILABLE');assert.equal(Object.keys(body).length,2);
});
await test('nonidentity time factor stays NOT_READY',async()=>{const i=base();i.policy.time_adjustments=i.observations.map(o=>({observation_id:o.observation_id,factor:'1.1',from:o.observed_at,to:i.as_of,published_at:i.as_of,index_version:'UNPROVEN',evidence_ref:'UNPROVEN',basis:'target_currency_property_index'}));assert.equal((await read(producer(i))).body.state,'NOT_READY');});
await test('unproven FX has no numeric result',async()=>{const i=base();i.quality_policy.target_currency='RON';i.quality_policy.fx_rates=[];const {body}=await read(producer(i));assert.equal(body.state,'NOT_READY');});
await test('a supplied FX rate is still NOT_READY without accepted producer binding',async()=>{const i=base();i.quality_policy.fx_rates=[{from_currency:'EUR',to_currency:'RON',rate:'5',effective_at:'2026-09-01T00:00:00Z',published_at:'2026-09-01T00:00:00Z',source_ref:'synthetic://unproven'}];assert.equal((await read(producer(i))).body.state,'NOT_READY');});
await test('provider private exception never crosses boundary',async()=>{const p=producer();p.readPrepared=async()=>{throw new Error('PRIVATE-PASSWORD-TOKEN');};const {body}=await read(p);assert.equal(body.state,'UNAVAILABLE');assert.doesNotMatch(JSON.stringify(body),/PRIVATE|PASSWORD|TOKEN/);});
await test('schema rejects range on insufficient, period swap, trace and inverted bounds',async()=>{const {body}=await read(producer());for(const bad of [{...body,outcome:'insufficient_data'},{...body,rental_period:'month'},{...body,trace:['private']},{...body,range:{low:'300000.00',central:'200000.00',high:'100000.00'}}])assert.equal(valuationReadResponseV1Schema.safeParse(bad).success,false);});
// Mounted real component, actual handler/engine behind fake in-process transport.
const dom=new JSDOM('<div id="root"></div>',{url:'https://offline.invalid'}),saved=new Map();
for(const [k,v] of Object.entries({window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(k,Object.getOwnPropertyDescriptor(globalThis,k));Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});}
const {createRoot}=await import('react-dom/client');
const {CustomerAirpropValuation}=load('src/components/customer/CustomerAirpropValuation.tsx');
const mounted=createRoot(document.getElementById('root'));let calls=[],responder=async request=>handleValuationReadV1(request);
globalThis.fetch=(url,options={})=>{assert.equal(options.method,'GET');assert.equal(options.cache,'no-store');assert.match(url,/^\/api\/customer\/v2\/airprop\/valuation\?/);calls.push({url,options});return responder(new Request('https://offline.invalid'+url));};
const render=(lang='en',s=selection)=>act(async()=>{mounted.render(React.createElement(CustomerAirpropValuation,{lang,contextId:s.context_id,workspaceId:s.workspace_id,opportunityId:s.opportunity_id}));});
const click=()=>act(async()=>document.querySelector('button').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
const change=value=>act(async()=>{const select=document.querySelector('select');select.value=value;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
try{
 for(const lang of ['ro','en','fa'])await test('mounted '+lang+' NOT_READY, sale, monthly rent, insufficient; GET-only',async()=>{
  await render(lang,{...selection,opportunity_id:lang==='ro'?'dddddddd-1111-4111-8111-111111111111':lang==='fa'?'cccccccc-1111-4111-8111-111111111111':selection.opportunity_id});
  assert.equal(document.querySelector('section').dir,lang==='fa'?'rtl':'ltr');
  responder=async request=>handleValuationReadV1(request);await click();assert.doesNotMatch(document.body.textContent,/200000|1000\.00/);
  responder=async request=>{const s=Object.fromEntries(new URL(request.url).searchParams);return handleValuationReadV1(request,producer(base(),s));};await click();assert.match(document.body.textContent,/200000\.00/);
  await change('rental_recommendation');assert.doesNotMatch(document.body.textContent,/200000\.00/);
  responder=async request=>{const s=Object.fromEntries(new URL(request.url).searchParams);return handleValuationReadV1(request,producer(rental(),s));};await click();assert.match(document.body.textContent,/2000\.00/);assert.match(document.body.textContent,lang==='ro'?/pe lună/:lang==='fa'?/در ماه/:/per month/);
  await change('sale_estimate');responder=async request=>{const s=Object.fromEntries(new URL(request.url).searchParams),i=base();i.observations=[];i.unit_links=[];i.sources=[];return handleValuationReadV1(request,producer(i,s));};await click();assert.doesNotMatch(document.body.textContent,/2000\.00|200000\.00/);assert.match(document.body.textContent,lang==='ro'?/Date insuficiente/:lang==='fa'?/داده ناکافی/:/Insufficient data/);
 });
 await test('mounted refresh invalidates older GET even if fake transport ignores abort',async()=>{
  await render('en');let resolveOld;responder=()=>new Promise(resolve=>{resolveOld=resolve;});await click();
  const old=(await read(producer())).body;responder=async()=>Response.json({contract:'airprop-valuation-read.v1',state:'NOT_READY',reason:'valuation_dependencies_unverified'},{status:503});await click();
  await act(async()=>resolveOld(Response.json(old)));assert.doesNotMatch(document.body.textContent,/200000\.00/);assert.match(document.body.textContent,/not ready/);
 });
 await test('mounted Context/opportunity changes fence delayed result and finally',async()=>{
  let resolveOld;responder=()=>new Promise(resolve=>{resolveOld=resolve;});await click();await render('fa',{...selection,context_id:'aaaaaaaa-1111-4111-8111-111111111111'});
  await act(async()=>resolveOld(Response.json((await read(producer())).body)));assert.doesNotMatch(document.body.textContent,/200000\.00/);assert.match(document.body.textContent,/آماده نیست/);
 });
 await test('mounted purpose change invalidates delayed sale result',async()=>{
  let resolveOld;responder=()=>new Promise(resolve=>{resolveOld=resolve;});await click();await change('rental_recommendation');await act(async()=>resolveOld(Response.json((await read(producer())).body)));assert.doesNotMatch(document.body.textContent,/200000\.00/);
 });
 await test('mounted malformed/private HTTP success is unavailable, no private rendering',async()=>{
  responder=async()=>Response.json({private_trace:'DO-NOT-RENDER',state:'RESULT'});await click();assert.doesNotMatch(document.body.textContent,/DO-NOT-RENDER/);
 });
 await test('UI/route composition has zero mutation, storage, key generation or demo imports',async()=>{
  assert.ok(calls.length>10);assert.ok(calls.every(c=>c.options.method==='GET'&&!c.options.body));
  for(const path of ['src/components/customer/CustomerAirpropValuation.tsx','src/app/api/customer/v2/airprop/valuation/route.ts'])assert.doesNotMatch(readFileSync(resolve(root,path),'utf8'),/sessionStorage|localStorage|randomUUID|demoAirprop|createClient|\.rpc\(/);
  assert.doesNotMatch(readFileSync(resolve(root,'src/lib/airprop/valuation-read-response-v1.ts'),'utf8'),/node:crypto|valuation-baseline-v1/);
 });
 await test('mounted existing Workspace selection reaches actual new GET transport and NOT_READY',async()=>{
  Object.defineProperty(globalThis,'sessionStorage',{value:dom.window.sessionStorage,configurable:true});
  const {CustomerAirpropWorkspace}=load('src/components/customer/CustomerAirpropWorkspace.tsx',{
   './CustomerAirpropValuation':{CustomerAirpropValuation},
   './CustomerAirpropDiligence':{CustomerAirpropDiligence:()=>null},
   './CustomerAirpropUnderwriting':{CustomerAirpropUnderwriting:()=>null},
   './CustomerAirpropB2':{CustomerAirpropB2Workspace:()=>null},
   './CustomerContextProvider':{useCustomerContext:()=>({active:{context_id:selection.context_id},registerUnsavedGuard:()=>()=>{}})},
  });
  let valuations=0;
  globalThis.fetch=async(url,options={})=>{
   assert.equal(options.method??'GET','GET');
   if(url.startsWith('/api/customer/v1/workspace/targets'))return Response.json({workspaces:[{workspace_id:selection.workspace_id,workspace_type:'company',environment:'PILOT'}]});
   if(url.startsWith('/api/customer/v2/airprop/opportunities'))return Response.json({opportunities:[{opportunity_id:selection.opportunity_id,name:'Synthetic integration property',city:'București',currency:'EUR',asking_price:'999999',status:'draft'}]});
   assert.match(url,/^\/api\/customer\/v2\/airprop\/valuation\?/);valuations++;
   const sent=Object.fromEntries(new URL(url,'https://offline.invalid').searchParams);assert.deepEqual(sent,selection);
   return route.GET(new Request('https://offline.invalid'+url));
  };
  await act(async()=>mounted.render(React.createElement(CustomerAirpropWorkspace,{lang:'en'})));
  await act(async()=>{const select=document.querySelector('label select');select.value=selection.workspace_id;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
  await act(async()=>document.querySelector('button[aria-pressed]').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  const section=document.querySelector('section[aria-label="Sale or rent estimate"]');assert.ok(section);
  await act(async()=>section.querySelector('button').dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  assert.equal(valuations,1);assert.match(section.textContent,/not ready/);assert.doesNotMatch(section.textContent,/999999/);
  delete globalThis.sessionStorage;
 });
}finally{await act(async()=>mounted.unmount());dom.window.close();for(const [k,d]of saved){if(d)Object.defineProperty(globalThis,k,d);else delete globalThis[k];}globalThis.fetch=nativeFetch;}
console.log(`${count}/${count} PASS; synthetic injected adapter/fake transport only; DB/Auth/provider/browser runtime NOT_RUN_NOT_PASS`);
