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
const party=uuid(1),offering=uuid(2),revision=uuid(3),context=uuid(4),workspace=uuid(5);
let writes=[],lose=false,deferred=null,deny=false,noParty=false,historyFail=false;
const fetch=async(url,options)=>{
 if(options?.method==='POST'){writes.push(JSON.parse(options.body));if(deferred)return deferred.promise;if(lose){lose=false;throw new Error('Lost reply');}return Response.json({request_id:uuid(6),status:'submitted'});}
 if(historyFail&&writes.length)throw new Error('History unavailable');
 return Response.json({can_request:true,beneficiaries:noParty?[]:[{party_id:party,label:'Verified person'}],requests:[]},{status:deny?403:200});
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

const {CustomerServiceRequests}=load(new URL('../src/components/customer/CustomerServiceRequests.tsx',import.meta.url));
const root=createRoot(document.getElementById('root'));let key=0;
const render=async(lang='en')=>act(async()=>root.render(React.createElement(CustomerServiceRequests,{key:++key,contextId:context,workspaceId:workspace,lang,offerings:[{offering_id:offering,revision_id:revision,labels:{en:'Test service',ro:'Serviciu de test',fa:'خدمت آزمایشی'},acquisition_mode:'pre_quote'}]})));
const fill=async()=>act(async()=>{
 const selects=document.querySelectorAll('select');selects[0].value=offering;selects[0].dispatchEvent(new window.Event('change',{bubbles:true}));selects[1].value=party;selects[1].dispatchEvent(new window.Event('change',{bubbles:true}));
 const input=document.querySelector('textarea');Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set.call(input,'Synthetic service request');input.dispatchEvent(new window.Event('input',{bubbles:true}));
});
const submit=async()=>act(async()=>document.querySelector('button').click());
let cases=0;const check=async(name,fn)=>{await fn();cases++;console.log('PASS '+name);};
try{
 for(const lang of ['en','ro','fa'])await check(lang+' localized request',async()=>{writes=[];await render(lang);await fill();await submit();assert.equal(writes.length,1);assert.equal(writes[0].beneficiary_party_id,party);assert.equal(writes[0].published_revision_id,revision);assert.equal(writes[0].description,'Synthetic service request');assert.equal(document.querySelector('textarea').value,'');});
 await check('Lost reply retries same command and blocks editing',async()=>{writes=[];lose=true;await render();await fill();await submit();assert.match(document.body.textContent,/result is unknown/);assert.equal(document.querySelector('textarea').disabled,true);await submit();assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);assert.match(document.body.textContent,/Request received/);});
 await check('Confirmed write survives failed history refresh',async()=>{writes=[];historyFail=true;await render();await fill();await submit();assert.match(document.body.textContent,/Request received/);assert.doesNotMatch(document.body.textContent,/result is unknown/);historyFail=false;});
 await check('Double click sends once and obsolete reply stays hidden',async()=>{writes=[];let resolve;deferred={promise:new Promise(done=>{resolve=done;})};await render();await fill();await act(async()=>{document.querySelector('button').click();document.querySelector('button').click();});assert.equal(writes.length,1);await render();await act(async()=>resolve(Response.json({request_id:uuid(6),status:'submitted'})));assert.doesNotMatch(document.body.textContent,/Request received/);deferred=null;});
 await check('Denied read hides form',async()=>{deny=true;await render();assert.equal(document.querySelector('textarea'),null);assert.match(document.body.textContent,/unavailable/);deny=false;});
 await check('Unlinked membership hides form',async()=>{noParty=true;await render();assert.equal(document.querySelector('textarea'),null);assert.match(document.body.textContent,/No verified person/);noParty=false;});
 console.log(`${cases} SERVICE request UI scenarios passed`);
}finally{await act(async()=>root.unmount());dom.window.close();}
