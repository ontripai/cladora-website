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
const party=uuid(1),requestId=uuid(2),revision=uuid(3),context=uuid(4),workspace=uuid(5);
globalThis.FormData=window.FormData;
let writes=[],lose=false,deferred=null,deny=false,historyFail=false,conflict=false,offline=false,session=false;
const fetch=async(url,options)=>{
 if(options?.method==='POST'){writes.push(JSON.parse(options.body));if(deferred)return deferred.promise;if(lose){lose=false;throw new Error('Lost reply');}return Response.json({quote_id:uuid(6),version:1,status:'draft'},{status:conflict?409:200});}
 if(historyFail&&writes.length)throw new Error('History unavailable');
 if(offline)throw new Error('Offline');
 if(session)return Response.json({error:{code:'SESSION'}},{status:401});
 return Response.json({requests:[{request_id:requestId,published_revision_id:revision,beneficiary_party_id:party,beneficiary_label:'Verified person',provider_label:'Synthetic provider',description:'Synthetic request',quotes:[]}]},{status:deny?403:200});
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

const {CustomerServiceQuotes}=load(new URL('../src/components/customer/CustomerServiceQuotes.tsx',import.meta.url));
const {serviceQuoteAmountToMinor:minor,serviceQuoteMinorToAmount:major}=load(new URL('../src/lib/customer/service-quote-read-schema.ts',import.meta.url));
const root=createRoot(document.getElementById('root'));let key=0;
const render=async(lang='en')=>act(async()=>root.render(React.createElement(CustomerServiceQuotes,{key:++key,contextId:context,workspaceId:workspace,lang})));
const fill=async()=>act(async()=>{
 const select=document.querySelector('select');select.value=requestId;select.dispatchEvent(new window.Event('change',{bubbles:true}));
});
const fields=()=>{document.querySelector('textarea').value='Synthetic quote scope';document.querySelector('input[name="amount"]').value='120.50';document.querySelector('input[name="expiry"]').value='2099-01-01T12:00';};
const submit=async()=>act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
let cases=0;const check=async(name,fn)=>{await fn();cases++;console.log('PASS '+name);};
try{
 for(const lang of ['en','ro','fa'])await check(lang+' localized draft captures exact expiry and major amount',async()=>{writes=[];await render(lang);await fill();fields();await submit();assert.equal(writes.length,1);assert.equal(writes[0].payer_shares[0].party_id,party);assert.equal(writes[0].published_revision_id,revision);assert.equal(writes[0].total_minor,'12050');assert.equal(writes[0].scope,'Synthetic quote scope');assert.equal(writes[0].valid_until,new Date('2099-01-01T12:00').toISOString());});
 await check('Lost reply retries frozen command and blocks editing',async()=>{writes=[];lose=true;await render();await fill();fields();await submit();assert.match(document.body.textContent,/Result unknown/);assert.equal(document.querySelector('fieldset').disabled,true);await submit();assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);assert.match(document.body.textContent,/Draft saved/);});
 await check('Confirmed write survives failed history refresh',async()=>{writes=[];historyFail=true;await render();await fill();fields();await submit();assert.match(document.body.textContent,/Draft saved/);assert.doesNotMatch(document.body.textContent,/Result unknown/);historyFail=false;});
 await check('Double submission sends once and obsolete reply stays hidden',async()=>{writes=[];let resolve;deferred={promise:new Promise(done=>{resolve=done;})};await render();await fill();fields();await act(async()=>{const form=document.querySelector('form');form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));});assert.equal(writes.length,1);await render();await act(async()=>resolve(Response.json({quote_id:uuid(6),version:1,status:'draft'})));assert.doesNotMatch(document.body.textContent,/Draft saved/);deferred=null;});
 await check('Denied read hides form',async()=>{deny=true;await render();assert.equal(document.querySelector('form'),null);assert.match(document.body.textContent,/unavailable/);deny=false;});
 await check('Offline read offers retry without claiming denial',async()=>{offline=true;await render();assert.equal(document.querySelector('form'),null);assert.match(document.body.textContent,/Check your connection/);offline=false;await act(async()=>document.querySelector('button').click());assert.ok(document.querySelector('form'));});
 await check('Session read asks for sign-in',async()=>{session=true;await render();assert.equal(document.querySelector('form'),null);assert.match(document.body.textContent,/session needs verification/);session=false;});
 await check('Conflict refresh preserves uncontrolled draft fields and resets command key',async()=>{writes=[];conflict=true;await render();await fill();fields();await submit();assert.match(document.body.textContent,/request changed/);assert.equal(document.querySelector('button[type="submit"]').disabled,true);conflict=false;await act(async()=>document.querySelector('button[type="button"]').click());assert.equal(document.querySelector('textarea').value,'Synthetic quote scope');assert.equal(document.querySelector('input[name="amount"]').value,'120.50');assert.equal(document.querySelector('input[name="expiry"]').value,'2099-01-01T12:00');await submit();assert.equal(writes.length,2);assert.notEqual(writes[0].idempotency_key,writes[1].idempotency_key);});
 await check('Invalid amount and past expiry never send',async()=>{writes=[];await render();await fill();fields();document.querySelector('input[name="amount"]').value='1.234';await submit();assert.equal(writes.length,0);fields();document.querySelector('input[name="expiry"]').value='2000-01-01T12:00';await submit();assert.equal(writes.length,0);});
 for(const lang of ['en','ro','fa'])await check(lang+' identifies invalid fields and focuses the first',async()=>{
   writes=[];await render(lang);await submit();
   const request=document.querySelector('select'),scope=document.querySelector('textarea'),amount=document.querySelector('input[name="amount"]'),expiry=document.querySelector('input[name="expiry"]');
   assert.equal(document.activeElement,request);
   for(const control of [request,scope,amount,expiry]){
     assert.equal(control.getAttribute('aria-invalid'),'true');
     assert.equal(document.getElementById(control.getAttribute('aria-describedby')).textContent.length>0,true);
   }
   assert.equal(document.querySelector('section').dir,lang==='fa'?'rtl':'ltr');
   assert.equal(writes.length,0);
   await fill();const editedScope=document.querySelector('textarea'),editedAmount=document.querySelector('input[name="amount"]'),editedExpiry=document.querySelector('input[name="expiry"]');editedScope.value='   ';editedAmount.value='1.234';editedExpiry.value='2000-01-01T12:00';await submit();
   assert.ok(document.activeElement===editedScope);
   assert.equal(editedScope.value,'   ');
   assert.equal(editedAmount.value,'1.234');
   assert.equal(editedExpiry.value,'2000-01-01T12:00');
 });
 await check('Correcting each field clears its own error and zero amount is accepted',async()=>{
   writes=[];await render();await fill();fields();document.querySelector('input[name="amount"]').value='-1';await submit();
   const amount=document.querySelector('input[name="amount"]');assert.equal(document.activeElement,amount);
   assert.equal(amount.getAttribute('aria-invalid'),'true');
   Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(amount,'0');
   await act(async()=>amount.dispatchEvent(new window.Event('input',{bubbles:true})));
   assert.equal(amount.getAttribute('aria-invalid'),'false');await submit();assert.equal(writes.length,1);assert.equal(writes[0].total_minor,'0');
 });
 await check('Exact shared-currency decimal conversion and boundaries',async()=>{for(const code of ['RON','EUR','GBP','USD']){assert.equal(minor('0.1',code),'10');assert.equal(minor('0',code),'0');assert.equal(minor('90071992547409.93',code),'9007199254740993');assert.equal(major('9007199254740993',code),'90071992547409.93');assert.equal(major('0',code),'0.00');for(const bad of ['01','-1','1.234','1e2','10000000000000000','1,23'])assert.equal(minor(bad,code),null);}});
 console.log(`${cases} SERVICE quote UI scenarios passed`);
}finally{await act(async()=>root.unmount());dom.window.close();}
