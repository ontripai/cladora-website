import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import React, { act } from 'react';
const dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test'});
globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url);const cache=new Map();
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const context=uuid(4),workspace=uuid(5);
globalThis.FormData=window.FormData;
let writes=[],reads=0,lose=false,deferred=null,deferredRead=null,nextReadStatus=null,deny=false,historyFail=false,historyStatus=200,conflict=false,canPublish=true,quoteState='draft',readStatus=200,writeStatus=200,offline=false,plannedReads=[];
const readPayload=()=>({can_publish:canPublish,quotes:[{quote_id:uuid(6),version:1,description:'Synthetic request',scope:'Synthetic scope',total_minor:'9007199254740993',currency:'RON',valid_until:'2099-01-01T00:00:00Z',published_at:null,provider_label:'Provider',beneficiary_label:'Person',state:writes.length&&!lose?'presented':quoteState,financial_proposal:null}]});
const fetch=async(url,options)=>{
 if(options?.method==='POST'){writes.push(JSON.parse(options.body));if(deferred)return deferred.promise;if(lose){lose=false;throw new Error('Lost reply');}return Response.json({quote_id:uuid(6),version:1,status:'presented'},{status:conflict?409:writeStatus});}
 reads++;
 if(plannedReads.length)return await plannedReads.shift()();
 if(deferredRead){const current=deferredRead;deferredRead=null;return current.promise;}
 if(offline)throw new Error('Offline');
 if(historyFail&&writes.length)throw new Error('History unavailable');
 const status=nextReadStatus??(writes.length?historyStatus:deny?403:readStatus);nextReadStatus=null;
 return Response.json(readPayload(),{status});
};
function load(file) {
  if (!existsSync(file) && file.pathname.endsWith('.ts')) file = new URL(file.href.replace(/\.ts$/, '.tsx'));
  if (cache.has(file.href)) return cache.get(file.href);
  const filename = fileURLToPath(file); const mod = new Module(filename);
  mod.require = name => name.endsWith('DashboardTransport') ? { useDashboardFetch: () => dashboardFetch }
    : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url))
    : name.startsWith('.') ? load(new URL(/\.[cm]?[jt]sx?$/.test(name) ? name : `${name}.ts`, file)) : require(name);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  cache.set(file.href, mod.exports); return mod.exports;
}
let dashboardFetch=fetch;

const {CustomerServiceQuotePublications:Component,quotePublicationCopy:copy}=load(new URL('../src/components/customer/CustomerServiceQuotePublications.tsx',import.meta.url));
const root=createRoot(document.getElementById('root'));let key=0;
const render=async(lang='en',mode='coordinator',ws=workspace,newKey=true,strict=false)=>act(async()=>{
 const component=React.createElement(Component,{key:newKey?++key:key,contextId:context,workspaceId:ws,lang,mode});
 root.render(strict?React.createElement(React.StrictMode,null,component):component);
});
const publishButton=()=>Array.from(document.querySelectorAll('button')).find(b=>/Present this|Retry the same|Prezintă această|Reîncearcă aceeași|ارائهٔ این نسخه|تکرار همان/.test(b.textContent));
const click=async()=>act(async()=>publishButton().click());
let cases=0;const check=async(name,fn)=>{await fn();cases++;console.log('PASS '+name);};
try{
 for(const lang of ['en','ro','fa'])await check(lang+' publishes exact quote/version and renders full amount',async()=>{writes=[];await render(lang);assert.match(document.body.textContent,/90071992547409.93 RON/);assert.ok(document.body.textContent.includes(copy[lang].note));await click();assert.equal(writes.length,1);assert.equal(writes[0].quote_id,uuid(6));assert.equal(writes[0].expected_version,1);assert.ok(document.body.textContent.includes(copy[lang].success));});
 await check('Lost reply retries exact frozen command',async()=>{writes=[];lose=true;await render();await click();assert.match(document.body.textContent,/Result unknown/);assert.equal(document.querySelector('button').disabled,true);await click();assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);});
 await check('Confirmed presentation survives failed refresh',async()=>{writes=[];historyFail=true;await render();await click();assert.match(document.body.textContent,/available to the requester/);assert.equal(publishButton(),undefined);historyFail=false;});
 await check('Server failure after confirmed presentation is not treated as an authority denial',async()=>{writes=[];historyStatus=503;await render();await click();assert.equal(writes.length,1);assert.ok(document.body.textContent.includes(copy.en.success));assert.ok(!document.body.textContent.includes(copy.en.denied));assert.match(document.body.textContent,/Synthetic scope/);historyStatus=200;});
 await check('Recipient and missing publish permission never offer publication',async()=>{writes=[];await render('en','recipient');assert.equal(publishButton(),undefined);canPublish=false;await render();assert.equal(publishButton(),undefined);canPublish=true;});
 for(const state of ['expired','superseded','presented'])await check(state+' has no publish button',async()=>{writes=[];quoteState=state;await render();assert.equal(publishButton(),undefined);});
 quoteState='draft';
 await check('Denied read hides all quotes',async()=>{deny=true;await render();assert.doesNotMatch(document.body.textContent,/Synthetic scope/);assert.equal(publishButton(),undefined);deny=false;});
 await check('Confirmed refresh denial clears prior quote details and actions in every language',async()=>{
   const statuses=[401,403,404];
   for(const [index,lang] of ['en','ro','fa'].entries()){
     writes=[];conflict=true;historyStatus=200;await render(lang);assert.match(document.body.textContent,/Synthetic scope/);await click();
     conflict=false;historyStatus=statuses[index];await act(async()=>document.querySelector('button').click());
     assert.doesNotMatch(document.body.textContent,/Synthetic request|Synthetic scope|Provider|90071992547409/);
     assert.equal(publishButton(),undefined);
     assert.ok(document.body.textContent.includes(statuses[index]===401?copy[lang].signIn:copy[lang].denied));
   }
   historyStatus=200;
 });
 await check('Confirmed publish receipt survives denied history while details hide and explicit read recovers without POST',async()=>{
   for(const [index,lang] of ['en','ro','fa'].entries()){
     writes=[];historyStatus=[401,403,404][index];await render(lang);await click();
     assert.equal(writes.length,1);assert.ok(document.body.textContent.includes(copy[lang].success));
     assert.ok(document.body.textContent.includes(index===0?copy[lang].signIn:copy[lang].denied));
     assert.doesNotMatch(document.body.textContent,/Synthetic request|Synthetic scope|Provider|90071992547409/);assert.equal(publishButton(),undefined);
     historyStatus=200;await act(async()=>document.querySelector('button').click());
     assert.equal(writes.length,1);assert.match(document.body.textContent,/Synthetic scope/);assert.equal(publishButton(),undefined);
   }
 });
 await check('Conflict blocks duplicate action until refresh',async()=>{writes=[];conflict=true;await render();await click();assert.match(document.body.textContent,/proposal changed/);assert.equal(publishButton().disabled,true);conflict=false;});
 await check('Write denial and expired session have actionable messages in each language',async()=>{
   for(const lang of ['en','ro','fa'])for(const status of [401,403,404]){
     writes=[];writeStatus=status;await render(lang);await click();
     assert.ok(document.body.textContent.includes(status===401?copy[lang].signIn:copy[lang].writeDenied));
     assert.ok(!document.body.textContent.includes(copy[lang].conflict));
     assert.equal(publishButton().disabled,true);
   }
   writeStatus=200;
 });
 await check('Failed conflict refresh retains blocked command until a successful read',async()=>{
   writes=[];conflict=true;await render();await click();const command=writes[0];conflict=false;writes=[];
   offline=true;await act(async()=>document.querySelector('button').click());
   assert.ok(document.body.textContent.includes(copy.en.loadError));
   assert.equal(publishButton().disabled,true);
   offline=false;await act(async()=>document.querySelector('button').click());
   assert.equal(publishButton().disabled,false);
   await click();assert.equal(writes.length,1);assert.notEqual(writes[0].idempotency_key,command.idempotency_key);
 });
 await check('Double click sends once and same-instance scope switch discards late reply',async()=>{writes=[];let resolve;deferred={promise:new Promise(done=>{resolve=done;})};await render();await act(async()=>{const button=publishButton();button.click();button.click();});assert.equal(writes.length,1);await render('en','coordinator',uuid(99),false);await act(async()=>resolve(Response.json({quote_id:uuid(6),version:1,status:'presented'})));assert.doesNotMatch(document.body.textContent,/available to the requester for review/);deferred=null;});
 await check('Denied new scope rejects an aborted late read and locale change does not refetch it',async()=>{
   writes=[];reads=0;historyStatus=200;await render('en');conflict=true;await click();conflict=false;
   let resolve;deferredRead={promise:new Promise(done=>{resolve=done;})};await act(async()=>document.querySelector('button').click());
   nextReadStatus=403;await render('ro','coordinator',uuid(98),false);assert.ok(document.body.textContent.includes(copy.ro.denied));assert.doesNotMatch(document.body.textContent,/Synthetic scope/);
   await act(async()=>resolve(Response.json(readPayload())));assert.doesNotMatch(document.body.textContent,/Synthetic scope/);
   const completedReads=reads;await render('fa','coordinator',uuid(98),false);assert.equal(reads,completedReads);assert.ok(document.body.textContent.includes(copy.fa.denied));assert.equal(writes.length,1);
 });
 await check('Double blocked refresh reserves one synchronous read dispatch',async()=>{
   writes=[];dashboardFetch=fetch;conflict=true;await render();await click();conflict=false;
   let release;plannedReads.push(()=>new Promise(resolve=>{release=resolve;}));const before=reads;
   await act(async()=>{const refresh=document.querySelector('button');refresh.click();refresh.click();});
   assert.equal(reads,before+1);
   await act(async()=>release(Response.json(readPayload(),{status:403})));
   assert.ok(document.body.textContent.includes(copy.en.denied));assert.doesNotMatch(document.body.textContent,/Synthetic scope/);
 });
 await check('Newer same-scope denial owns state after delayed older headers or body',async()=>{
   for(const status of [401,403,404])for(const phase of ['headers','body']){
     writes=[];plannedReads=[];dashboardFetch=fetch;conflict=true;await render();await click();conflict=false;
     let release;let bodyStarted=false;
     if(phase==='headers')plannedReads.push(()=>new Promise(resolve=>{release=()=>resolve(Response.json(readPayload()));}));
     else plannedReads.push(()=>({ok:true,status:200,json:()=>{bodyStarted=true;return new Promise(resolve=>{release=()=>resolve(readPayload());});}}));
     dashboardFetch=(...args)=>fetch(...args);await render('en','coordinator',workspace,false);
     if(phase==='body')assert.equal(bodyStarted,true);
     plannedReads.push(()=>Response.json(readPayload(),{status}));
     await act(async()=>document.querySelector('button').click());
     assert.ok(document.body.textContent.includes(status===401?copy.en.signIn:copy.en.denied));
     await act(async()=>release());
     assert.doesNotMatch(document.body.textContent,/Synthetic request|Synthetic scope|Provider|90071992547409/);
     assert.equal(publishButton(),undefined);assert.equal(writes.length,1,`status ${status}, ${phase}`);
   }
   dashboardFetch=fetch;
 });
 await check('Post-publication stale read cannot override newer denial and explicit recovery does not repost',async()=>{
   writes=[];plannedReads=[];dashboardFetch=fetch;await render();
   let releaseBody;let bodyStarted=false;
   plannedReads.push(()=>({ok:true,status:200,json:()=>{bodyStarted=true;return new Promise(resolve=>{releaseBody=()=>resolve(readPayload());});}}));
   await click();assert.equal(bodyStarted,true);assert.equal(writes.length,1);
   plannedReads.push(()=>Response.json(readPayload(),{status:403}));dashboardFetch=(...args)=>fetch(...args);
   await render('en','coordinator',workspace,false);assert.ok(document.body.textContent.includes(copy.en.denied));
   await act(async()=>releaseBody());
   assert.ok(document.body.textContent.includes(copy.en.success));assert.doesNotMatch(document.body.textContent,/Synthetic scope/);assert.equal(writes.length,1);
   dashboardFetch=fetch;await act(async()=>document.querySelector('button').click());
   assert.match(document.body.textContent,/Synthetic scope/);assert.equal(writes.length,1);assert.equal(publishButton(),undefined);
 });
	 await check('StrictMode lifecycle permits current initial load, refresh and publish receipt',async()=>{
	   writes=[];plannedReads=[];dashboardFetch=fetch;historyStatus=200;readStatus=200;writeStatus=200;conflict=false;canPublish=true;quoteState='draft';
	   await render('en','coordinator',workspace,true,true);assert.match(document.body.textContent,/Synthetic scope/);
	   await act(async()=>document.querySelector('button').click());assert.match(document.body.textContent,/Synthetic scope/);assert.equal(writes.length,0);
	   await click();assert.equal(writes.length,1);assert.ok(document.body.textContent.includes(copy.en.success));assert.equal(publishButton(),undefined);
	 });
	 await check('StrictMode lifecycle rejects delayed headers and body from the previous read generation',async()=>{
	   for(const phase of ['headers','body']){
	     writes=[];plannedReads=[];dashboardFetch=fetch;historyStatus=200;quoteState='draft';
	     await render('en','coordinator',workspace,true,true);assert.match(document.body.textContent,/Synthetic scope/);
	     let release;let bodyStarted=false;
	     if(phase==='headers')plannedReads.push(()=>new Promise(resolve=>{release=()=>resolve(Response.json(readPayload()));}));
	     else plannedReads.push(()=>({ok:true,status:200,json:()=>{bodyStarted=true;return new Promise(resolve=>{release=()=>resolve(readPayload());});}}));
	     dashboardFetch=(...args)=>fetch(...args);await render('en','coordinator',workspace,false,true);
	     if(phase==='body')assert.equal(bodyStarted,true);
	     plannedReads.push(()=>Response.json(readPayload(),{status:403}));dashboardFetch=(...args)=>fetch(...args);
	     await render('en','coordinator',workspace,false,true);
	     assert.ok(document.body.textContent.includes(copy.en.denied));assert.doesNotMatch(document.body.textContent,/Synthetic scope/);
	     await act(async()=>release());
	     assert.ok(document.body.textContent.includes(copy.en.denied));assert.doesNotMatch(document.body.textContent,/Synthetic scope/);assert.equal(publishButton(),undefined);
	   }
	   dashboardFetch=fetch;
	 });
	 await check('StrictMode late response after real unmount cannot restore state or dispatch a write',async()=>{
	   writes=[];plannedReads=[];dashboardFetch=fetch;const holder=document.createElement('div');document.body.append(holder);const isolated=createRoot(holder);
	   let release;plannedReads.push(()=>Response.json(readPayload()));plannedReads.push(()=>new Promise(resolve=>{release=()=>resolve(Response.json(readPayload()));}));
	   await act(async()=>isolated.render(React.createElement(React.StrictMode,null,React.createElement(Component,{contextId:context,workspaceId:workspace,lang:'en',mode:'coordinator'}))));
	   assert.equal(typeof release,'function');const beforeWrites=writes.length;await act(async()=>isolated.unmount());await act(async()=>release());
	   assert.equal(holder.textContent,'');assert.equal(writes.length,beforeWrites);holder.remove();
	 });
 await check('Network and server failures offer refresh without alleging access denial',async()=>{writes=[];for(const status of [500,503]){readStatus=status;await render();assert.ok(document.body.textContent.includes(copy.en.loadError));assert.ok(!document.body.textContent.includes(copy.en.denied));}readStatus=200;offline=true;await render();assert.ok(document.body.textContent.includes(copy.en.loadError));offline=false;await act(async()=>document.querySelector('button').click());assert.match(document.body.textContent,/Synthetic scope/);});
 await check('Expired session has a specific recovery instruction',async()=>{readStatus=401;await render();assert.ok(document.body.textContent.includes(copy.en.signIn));assert.doesNotMatch(document.body.textContent,/Synthetic scope/);readStatus=200;});
 await check('Read-only coordinator sees permission recovery and requester sees no coordinator instruction',async()=>{canPublish=false;await render();assert.ok(document.body.textContent.includes(copy.en.readOnly));await render('en','recipient');assert.ok(!document.body.textContent.includes(copy.en.readOnly));canPublish=true;});
 await check('Localized dates preserve exact expiry and explicit timezone in all languages',async()=>{for(const lang of ['en','ro','fa']){await render(lang);const time=document.querySelector('time');assert.equal(time.dateTime,'2099-01-01T00:00:00Z');assert.match(time.textContent,/UTC$/);assert.doesNotMatch(time.textContent,/T00:00/);assert.equal(document.querySelector('section').dir,lang==='fa'?'rtl':'ltr');assert.ok(document.body.textContent.includes(copy[lang].nextDraft));}});
 console.log(`${cases} SERVICE publication UI scenarios passed`);
}finally{await act(async()=>root.unmount());dom.window.close();}
