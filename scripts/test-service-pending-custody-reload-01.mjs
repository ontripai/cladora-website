/** Real SERVICE components/storage with controlled HTTP. No live Auth or DB. */
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import ts from 'typescript';
process.env.NEXT_PUBLIC_CLADORA_OWNED_SERVICE_ASSEMBLY='v1';
const here=dirname(fileURLToPath(import.meta.url));
const source=process.env.SERVICE_CUSTODY_TEST_SOURCE??resolve(here,'../src');
const require=createRequire(import.meta.url),cache=new Map();
const id=n=>`${String(n).padStart(8,'0')}-0000-4000-8000-${String(n).padStart(12,'0')}`;
const scope={context_id:id(1),workspace_id:id(2),membership_id:id(3),tenant_id:id(4)};
const selection={...scope,tenant_name:'Synthetic workspace',role_name:'Member',role_code:'resident',workspace_type:'building',environment:'PILOT'};
const labels={en:'Synthetic service',fa:'خدمت آزمایشی',ro:'Serviciu de test'};
const offering={offering_id:id(10),revision_id:id(11),labels,description:labels,acquisition_mode:'direct',price:{kind:'quote_required'},valid_from:'2026-11-01T00:00:00Z',valid_until:null,cancellation_terms:labels,acceptance_criteria:labels};
const ownerA='a'.repeat(64),ownerB='b'.repeat(64);
let owner=ownerA,ownerStatus=200,mode='lost',calls=[],effects=new Set(),history=[],ownerGate=null;
let storageBeforePost=false;
const K='cladora.service-request-custody.v1',M='cladora.service-request-custody-marker.v1';
const endpoint='/api/customer/v1/services/offering-request-flow';
const fetch=async(url,options={})=>{
 url=String(url);calls.push({url,options});
 if(url.endsWith('/command-custody')){
  if(ownerGate)return ownerGate.promise;
  return Response.json(ownerStatus===200?{contract:'service-request-custody-owner.v1',owner}:{error:{code:'UNAUTHORIZED'}},{status:ownerStatus});
 }
 if(url.endsWith('/assembly-bootstrap'))return Response.json({contract_version:'core-service-app-read.v1',selections:[selection]});
 if(url.includes('/catalog?'))return Response.json({offerings:[offering]});
 if(url.includes('/requests?'))return Response.json({can_request:true,beneficiaries:[{party_id:id(12),label:'Synthetic member'}],requests:history});
 if(url.includes('/offering-request-flow?'))return Response.json({status:'ready',contract:'service-offering-request-flow.v1',source_kind:'workspace',resources:[]});
 if(url===endpoint&&options.method==='POST'){
  const saved=window.sessionStorage.getItem(K),marker=window.sessionStorage.getItem(M);
  assert.ok(saved&&marker,'custody and its marker must be durable before POST');
  assert.equal(JSON.parse(saved).wire,options.body,'the exact saved wire is dispatched');
  assert.equal(options.headers['x-cladora-service-custody'],ownerA,'the verified continuity label is sent');
  storageBeforePost=true;
  if(mode==='first-conflict')return Response.json({error:{code:'CONFLICT'}},{status:409});
  const body=JSON.parse(options.body);effects.add(body.idempotency_key);
  history=[{request_id:id(20),offering_id:body.offering_id,revision_id:body.published_revision_id,description:body.description,status:'submitted',created_at:'2026-11-06T00:00:00Z'}];
  if(mode==='lost')throw Error('synthetic reply lost after modeled effect');
  if(mode==='unknown')return Response.json({error:{code:'READBACK_REQUIRED'}},{status:503});
  if(mode==='conflict')return Response.json({error:{code:'CONFLICT'}},{status:409});
  if(mode==='malformed')return Response.json({request_id:'bad',status:'submitted'});
  return Response.json({request_id:id(20),status:'submitted'});
 }
 throw Error('UNEXPECTED_CONTROLLED_HTTP '+url);
};
function load(file){
 if(!existsSync(file)&&file.endsWith('.ts'))file=file.replace(/\.ts$/,'.tsx');
 if(cache.has(file))return cache.get(file).exports;
 const mod=new Module(file);cache.set(file,mod);
 mod.require=name=>name.endsWith('CustomerContextProvider')?{useCustomerContext:()=>({active:null})}
  :name.endsWith('DashboardTransport')?{useDashboardFetch:()=>fetch}
  :name.startsWith('@/')?load(resolve(source,name.slice(2))+'.ts')
  :name.startsWith('.')?load(resolve(dirname(file),/\.[cm]?[jt]sx?$/.test(name)?name:name+'.ts')):require(name);
 mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
 return mod.exports;
}
const dom=new JSDOM('<div id="root"></div>',{url:'http://localhost:3008/en/app/services'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.FormData=dom.window.FormData;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
const {CustomerServiceCatalog}=load(resolve(source,'components/customer/CustomerServiceCatalog.tsx'));
let root=createRoot(document.getElementById('root')),generation=0,lang='en',checks=0;
const button=pattern=>[...document.querySelectorAll('button')].find(x=>pattern.test(x.textContent));
const commandButton=()=>button(/^(Send request|Retry the same request|ارسال درخواست|تکرار همان درخواست|Trimite cererea|Reîncearcă aceeași cerere)$/);
const posts=()=>calls.filter(x=>x.options.method==='POST');
const pair=()=>[window.sessionStorage.getItem(K),window.sessionStorage.getItem(M)];
async function settle(){await act(async()=>{await new Promise(done=>setTimeout(done,15));});}
async function wait(test){const end=Date.now()+3000;while(!test()){if(Date.now()>end)assert.fail('bounded DOM/transport settlement deadline');await settle();}}
async function render(language=lang){lang=language;await act(async()=>root.render(React.createElement(CustomerServiceCatalog,{lang,key:++generation})));await wait(()=>document.querySelector('select')||button(/Resume|ادامهٔ|Reia/)||/cannot be safely|بازیابی امن|nu poate fi recuperată|no longer available/.test(document.body.textContent));}
async function reload(){await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await render();}
async function select(element,value){await act(async()=>{element.value=value;element.dispatchEvent(new window.Event('change',{bubbles:true}));});await settle();}
async function fresh(){await act(async()=>root.unmount());window.sessionStorage.clear();owner=ownerA;ownerStatus=200;ownerGate=null;mode='lost';calls=[];effects.clear();history=[];root=createRoot(document.getElementById('root'));await render();}
async function fill(){await select(document.querySelector('select'),`${scope.context_id}:${scope.workspace_id}`);await wait(()=>document.querySelector('textarea'));
 await select(document.querySelectorAll('select')[1],offering.offering_id);
 await select(document.querySelectorAll('select')[2],id(12));
 await act(async()=>{const field=document.querySelector('textarea');Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(field,'Same intent România / فارسی 🙂 exact bytes');field.dispatchEvent(new window.Event('input',{bubbles:true}));});
 await wait(()=>commandButton()&&!commandButton().disabled);
}
async function clickCommand(){await act(async()=>commandButton().click());await wait(()=>!commandButton()||!commandButton().disabled||Boolean(button(/^Refresh catalogue$/)&&!button(/^Refresh catalogue$/).disabled));await settle();}
async function check(name,run){await run();checks++;console.log('PASS '+name);}
try{
 await check('persist exact wire plus marker before the first POST',async()=>{await render();await fill();await clickCommand();assert.equal(storageBeforePost,true);assert.equal(posts().length,1);assert.equal(effects.size,1);});
 const first=posts()[0],savedPair=pair();
 await check('full unmount/remount retains custody and sends no automatic POST',async()=>{await reload();assert.deepEqual(pair(),savedPair);assert.equal(posts().length,1);assert.ok(button(/^Resume the pending request$/));assert.equal(document.querySelector('select').disabled,true);assert.equal(document.querySelector('textarea'),null);});
 await check('explicit resume restores original fields and keeps selection locked',async()=>{await act(async()=>button(/^Resume the pending request$/).click());await wait(()=>commandButton());assert.equal(document.querySelector('textarea').value,JSON.parse(first.options.body).description);assert.equal(commandButton().textContent,'Retry the same request');assert.equal(document.querySelector('select').disabled,true);assert.equal(posts().length,1);});
 await check('409 then matching history GET is not confirmation of an UNKNOWN command',async()=>{mode='conflict';await clickCommand();await act(async()=>button(/^Refresh catalogue$/).click());await settle();assert.deepEqual(pair(),savedPair);assert.equal(posts().length,2);assert.equal(effects.size,1);assert.equal(commandButton().textContent,'Retry the same request');});
 await check('a second reload preserves the same wire; only exact retry success clears custody',async()=>{await reload();assert.equal(posts().length,2);await act(async()=>button(/^Resume the pending request$/).click());await wait(()=>commandButton());mode='success';await clickCommand();assert.equal(posts().length,3);for(const post of posts()){assert.equal(post.url,first.url);assert.equal(post.options.body,first.options.body);}assert.equal(effects.size,1);assert.deepEqual(pair(),[null,null]);assert.equal(document.querySelector('select').disabled,false);});
 await check('initial409 remains definitive and permits a fresh command after explicit refresh',async()=>{await fresh();await fill();mode='first-conflict';await clickCommand();assert.equal(effects.size,0);await act(async()=>button(/^Refresh catalogue$/).click());await settle();assert.deepEqual(pair(),[null,null]);assert.equal(commandButton().textContent,'Send request');mode='success';await clickCommand();assert.notEqual(posts()[0].options.body,posts()[1].options.body);assert.equal(effects.size,1);});
 await check('503 READBACK_REQUIRED and malformed receipt remain pending across reload',async()=>{for(const response of ['unknown','malformed']){await fresh();await fill();mode=response;await clickCommand();const saved=pair();assert.ok(saved[0]);await reload();assert.deepEqual(pair(),saved);assert.equal(posts().length,1);assert.ok(button(/^Resume/));}});
 await check('missing journal with surviving marker blocks rather than generating a new key',async()=>{window.sessionStorage.removeItem(K);const marker=window.sessionStorage.getItem(M);await reload();assert.equal(window.sessionStorage.getItem(M),marker);assert.equal(posts().length,1);assert.equal(commandButton(),undefined);assert.match(document.body.textContent,/cannot be safely restored/);});
 await check('checksum detects valid-JSON body corruption and preserves both artifacts',async()=>{await fresh();await fill();await clickCommand();const record=JSON.parse(pair()[0]);record.wire=record.wire.replace('Same intent','DIFFERENT intent');window.sessionStorage.setItem(K,JSON.stringify(record));const corrupted=pair();await reload();assert.deepEqual(pair(),corrupted);assert.equal(posts().length,1);assert.equal(commandButton(),undefined);});
 await check('another actor or session cannot see or replay the previous saved description',async()=>{await fresh();await fill();await clickCommand();const saved=pair();owner=ownerB;await reload();assert.deepEqual(pair(),saved);assert.equal(posts().length,1);assert.doesNotMatch(document.body.textContent,/Same intent/);assert.equal(commandButton(),undefined);});
 await check('owner change during explicit retry is checked before POST and preserves custody',async()=>{await fresh();await fill();await clickCommand();const saved=pair();owner=ownerB;await clickCommand();assert.equal(posts().length,1);assert.deepEqual(pair(),saved);assert.equal(commandButton(),undefined);});
 await check('storage quota failure produces zero POST and cannot overwrite recovery',async()=>{await fresh();await fill();const original=window.Storage.prototype.setItem;window.Storage.prototype.setItem=function(){throw Error('synthetic quota');};try{await clickCommand();assert.equal(posts().length,0);}finally{window.Storage.prototype.setItem=original;}});
 await check('partial write leaves the marker; reload is blocked with zero dispatch',async()=>{await fresh();await fill();const original=window.Storage.prototype.setItem;window.Storage.prototype.setItem=function(key,value){if(key===K)throw Error('synthetic journal write failure');return original.call(this,key,value);};try{await clickCommand();}finally{window.Storage.prototype.setItem=original;}assert.equal(posts().length,0);assert.ok(pair()[1]);assert.equal(pair()[0],null);await reload();assert.equal(commandButton(),undefined);});
 await check('FA/EN/RO recovery is explicit and performs no POST during hydration',async()=>{for(const language of ['fa','en','ro']){await fresh();await fill();await clickCommand();const before=posts().length;await act(async()=>root.unmount());root=createRoot(document.getElementById('root'));await render(language);assert.ok(button(/Resume|ادامهٔ|Reia/));assert.equal(posts().length,before);assert.equal(document.querySelector('section').dir,language==='fa'?'rtl':'ltr');}});
 await check('late identity response after unmount cannot populate another mounted scope',async()=>{await fresh();await fill();await clickCommand();let done;ownerGate={promise:new Promise(resolve=>{done=resolve;})};await act(async()=>window.dispatchEvent(new window.Event('focus')));await act(async()=>root.unmount());owner=ownerB;ownerGate=null;root=createRoot(document.getElementById('root'));await render('en');await act(async()=>done(Response.json({contract:'service-request-custody-owner.v1',owner:ownerA})));await settle();assert.equal(commandButton(),undefined);assert.doesNotMatch(document.body.textContent,/Same intent/);assert.equal(posts().length,1);});
 await check('a missing current membership blocks recovery without selecting an alternative',async()=>{await fresh();await fill();await clickCommand();const saved=pair();selection.membership_id=id(99);try{await reload();assert.match(document.body.textContent,/no longer available/);assert.equal(posts().length,1);assert.deepEqual(pair(),saved);}finally{selection.membership_id=scope.membership_id;}});
 await check('late401 from an earlier mount cannot block a new clean account view',async()=>{await fresh();let done;ownerGate={promise:new Promise(resolve=>{done=resolve;})};await act(async()=>window.dispatchEvent(new window.Event('focus')));await act(async()=>root.unmount());ownerGate=null;owner=ownerB;root=createRoot(document.getElementById('root'));await render('en');await act(async()=>done(Response.json({error:{code:'UNAUTHORIZED'}},{status:401})));await settle();assert.ok(document.querySelector('select'));assert.equal(document.querySelector('select').disabled,false);assert.equal(posts().length,0);});
 console.log(JSON.stringify({task:'SERVICE-PENDING-CUSTODY-RELOAD-01',checks,status:'PASS_CONTROLLED_MOUNTED_ONLY',native:'NOT_RUN_NOT_PASS'}));
}finally{await act(async()=>root.unmount());dom.window.close();}
