import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire, Module } from 'node:module';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import ts from 'typescript';
import React, { act } from 'react';
const dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test'});
globalThis.FormData=dom.window.FormData;globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
const require=createRequire(import.meta.url);const cache=new Map();
const uuid=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const party=uuid(1),offering=uuid(2),revision=uuid(3),context=uuid(4),workspace=uuid(5);
let writes=[],lose=false,deferred=null,conflict=false;
const fetch=async(url,options)=>{assert.equal(url,'/api/customer/v1/services/self-person');assert.equal(options.method,'POST');const command=JSON.parse(options.body);writes.push(command);if(deferred)return deferred.promise;if(lose){lose=false;throw new Error('lost reply');}return conflict?Response.json({error:{}},{status:409}):Response.json({party_id:party,valid_until:command.valid_until});};
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

const {ServicePilotSelfPerson}=load(new URL('../src/components/customer/ServicePilotSelfPerson.tsx',import.meta.url));
const root=createRoot(document.getElementById('root'));let generation=0;
const render=async(lang='en')=>act(async()=>root.render(React.createElement(ServicePilotSelfPerson,{key:++generation,contextId:context,workspaceId:workspace,lang})));
const localInput=timestamp=>{const d=new Date(timestamp);return new Date(timestamp-d.getTimezoneOffset()*60000).toISOString().slice(0,16);};
const fill=(offset=3600000,confirmed=true)=>{document.querySelector('input[name=name]').value='Synthetic self person';document.querySelector('input[name=expiry]').value=localInput(Date.now()+offset);document.querySelector('input[name=confirm]').checked=confirmed;};
const submit=async()=>act(async()=>document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true})));
try{
for(const lang of ['en','ro','fa']){writes=[];await render(lang);fill();const expected=new Date(document.querySelector('input[name=expiry]').value).toISOString();await submit();assert.equal(writes.length,1);assert.equal(writes[0].valid_until,expected);assert.equal(writes[0].confirm_self,true);assert.equal(writes[0].context_id,context);assert.equal(writes[0].workspace_id,workspace);assert.equal(document.querySelector('fieldset').disabled,true);assert.ok(document.querySelector('[role=status]'));}
for(const [offset,confirmed] of [[-3600000,true],[73*3600000,true],[3600000,false]]){writes=[];await render();fill(offset,confirmed);await submit();assert.equal(writes.length,0);assert.match(document.body.textContent,/Confirm your own account/);}
writes=[];lose=true;await render();fill();await submit();assert.equal(document.querySelector('fieldset').disabled,true);await submit();assert.equal(writes.length,2);assert.deepEqual(writes[0],writes[1]);assert.match(document.body.textContent,/registered/);
writes=[];conflict=true;await render();fill();await submit();assert.match(document.body.textContent,/requires review/);conflict=false;
writes=[];let resolve;deferred={promise:new Promise(done=>{resolve=done;})};await render();fill();await act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));});assert.equal(writes.length,1);await render();await act(async()=>resolve(Response.json({party_id:party,valid_until:writes[0].valid_until})));assert.doesNotMatch(document.body.textContent,/registered/);deferred=null;
console.log('PASS self-person UI: RO/EN/FA, explicit own-account confirmation, exact expiry, invalid expiry, lost-response exact retry, conflicts, double click and obsolete replies');
}finally{await act(async()=>root.unmount());dom.window.close();}
