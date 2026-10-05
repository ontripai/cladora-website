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
let writes=[],lose=false,deferred=null,deny=false,historyFail=false,conflict=false,canPublish=true,quoteState='draft',readStatus=200,offline=false;
const fetch=async(url,options)=>{
 if(options?.method==='POST'){writes.push(JSON.parse(options.body));if(deferred)return deferred.promise;if(lose){lose=false;throw new Error('Lost reply');}return Response.json({quote_id:uuid(6),version:1,status:'presented'},{status:conflict?409:200});}
 if(offline)throw new Error('Offline');
 if(historyFail&&writes.length)throw new Error('History unavailable');
 return Response.json({can_publish:canPublish,quotes:[{quote_id:uuid(6),version:1,description:'Synthetic request',scope:'Synthetic scope',total_minor:'9007199254740993',currency:'RON',valid_until:'2099-01-01T00:00:00Z',published_at:null,provider_label:'Provider',beneficiary_label:'Person',state:writes.length&&!lose?'presented':quoteState}]},{status:deny?403:readStatus});
};
function load(file) {
  if (!existsSync(file) && file.pathname.endsWith('.ts')) file = new URL(file.href.replace(/\.ts$/, '.tsx'));
  if (cache.has(file.href)) return cache.get(file.href);
  const filename = fileURLToPath(file); const mod = new Module(filename);
  mod.require = name => name.endsWith('DashboardTransport') ? { useDashboardFetch: () => fetch }
    : name.startsWith('@/') ? load(new URL(`../src/${name.slice(2)}.ts`, import.meta.url))
    : name.startsWith('.') ? load(new URL(`${name}.ts`, file)) : require(name);
  mod._compile(ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, filename);
  cache.set(file.href, mod.exports); return mod.exports;
}

const {CustomerServiceQuotePublications:Component,quotePublicationCopy:copy}=load(new URL('../src/components/customer/CustomerServiceQuotePublications.tsx',import.meta.url));
const root=createRoot(document.getElementById('root'));let key=0;
const render=async(lang='en',mode='coordinator',ws=workspace,newKey=true)=>act(async()=>root.render(React.createElement(Component,{key:newKey?++key:key,contextId:context,workspaceId:ws,lang,mode})));
const publishButton=()=>Array.from(document.querySelectorAll('button')).find(b=>/Present this|Retry the same|Prezintă această|ارائهٔ این نسخه|تکرار همان/.test(b.textContent));
const click=async()=>act(async()=>publishButton().click());
let cases=0;const check=async(name,fn)=>{await fn();cases++;console.log('PASS '+name);};
try{
 for(const lang of ['en','ro','fa'])await check(lang+' publishes exact quote/version and renders full amount',async()=>{writes=[];await render(lang);assert.match(document.body.textContent,/90071992547409.93 RON/);assert.ok(document.body.textContent.includes(copy[lang].note));await click();assert.equal(writes.length,1);assert.equal(writes[0].quote_id,uuid(6));assert.equal(writes[0].expected_version,1);assert.ok(document.body.textContent.includes(copy[lang].success));});
 await check('Lost reply retries exact frozen command',async()=>{writes=[];lose=true;await render();await click();assert.match(document.body.textContent,/Result unknown/);assert.equal(document.querySelector('button').disabled,true);await click();assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);});
 await check('Confirmed presentation survives failed refresh',async()=>{writes=[];historyFail=true;await render();await click();assert.match(document.body.textContent,/available to the requester/);assert.equal(publishButton(),undefined);historyFail=false;});
 await check('Recipient and missing publish permission never offer publication',async()=>{writes=[];await render('en','recipient');assert.equal(publishButton(),undefined);canPublish=false;await render();assert.equal(publishButton(),undefined);canPublish=true;});
 for(const state of ['expired','superseded','presented'])await check(state+' has no publish button',async()=>{writes=[];quoteState=state;await render();assert.equal(publishButton(),undefined);});
 quoteState='draft';
 await check('Denied read hides all quotes',async()=>{deny=true;await render();assert.doesNotMatch(document.body.textContent,/Synthetic scope/);assert.equal(publishButton(),undefined);deny=false;});
 await check('Conflict blocks duplicate action until refresh',async()=>{writes=[];conflict=true;await render();await click();assert.match(document.body.textContent,/proposal changed/);assert.equal(publishButton().disabled,true);conflict=false;});
 await check('Double click sends once and same-instance scope switch discards late reply',async()=>{writes=[];let resolve;deferred={promise:new Promise(done=>{resolve=done;})};await render();await act(async()=>{const button=publishButton();button.click();button.click();});assert.equal(writes.length,1);await render('en','coordinator',uuid(99),false);await act(async()=>resolve(Response.json({quote_id:uuid(6),version:1,status:'presented'})));assert.doesNotMatch(document.body.textContent,/available to the requester for review/);deferred=null;});
 await check('Network and server failures offer refresh without alleging access denial',async()=>{writes=[];for(const status of [500,503]){readStatus=status;await render();assert.ok(document.body.textContent.includes(copy.en.loadError));assert.ok(!document.body.textContent.includes(copy.en.denied));}readStatus=200;offline=true;await render();assert.ok(document.body.textContent.includes(copy.en.loadError));offline=false;await act(async()=>document.querySelector('button').click());assert.match(document.body.textContent,/Synthetic scope/);});
 await check('Expired session has a specific recovery instruction',async()=>{readStatus=401;await render();assert.ok(document.body.textContent.includes(copy.en.signIn));assert.doesNotMatch(document.body.textContent,/Synthetic scope/);readStatus=200;});
 await check('Read-only coordinator sees permission recovery and requester sees no coordinator instruction',async()=>{canPublish=false;await render();assert.ok(document.body.textContent.includes(copy.en.readOnly));await render('en','recipient');assert.ok(!document.body.textContent.includes(copy.en.readOnly));canPublish=true;});
 await check('Localized dates preserve exact expiry and explicit timezone in all languages',async()=>{for(const lang of ['en','ro','fa']){await render(lang);const time=document.querySelector('time');assert.equal(time.dateTime,'2099-01-01T00:00:00Z');assert.match(time.textContent,/UTC$/);assert.doesNotMatch(time.textContent,/T00:00/);assert.equal(document.querySelector('section').dir,lang==='fa'?'rtl':'ltr');assert.ok(document.body.textContent.includes(copy[lang].nextDraft));}});
 console.log(`${cases} SERVICE publication UI scenarios passed`);
}finally{await act(async()=>root.unmount());dom.window.close();}
