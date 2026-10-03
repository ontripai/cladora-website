import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
const require=createRequire(import.meta.url),dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test'}),saved=new Map();
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,navigator:dom.window.navigator,sessionStorage:dom.window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');
const originalFetch=globalThis.fetch;
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url)),mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return mod.exports;}
const context='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222',member='33333333-3333-4333-8333-333333333333',role='44444444-4444-4444-8444-444444444444';
let mode='lost',calls=[],mfa=0,changes=0;
const building='55555555-5555-4555-8555-555555555555',property='66666666-6666-4666-8666-666666666666',buildingRole='77777777-7777-4777-8777-777777777777';
const roles=[{id:buildingRole,name:'Maintenance manager',scope_ceiling:'building',lifecycle_status:'published',role_version:1,valid_from:'2020-01-01'},{id:role,name:'AIRPROP reader writer',scope_ceiling:'workspace',lifecycle_status:'published',role_version:1,valid_from:'2020-01-01'}, {id:context,name:'Draft',scope_ceiling:'workspace',lifecycle_status:'draft',valid_from:'2020-01-01'}, {id:member,name:'Narrow role',scope_ceiling:'unit',lifecycle_status:'published',valid_from:'2020-01-01'}];
globalThis.fetch=async(url,options={})=>{calls.push({url,options});if(!options.method)return {ok:true,json:async()=>({workspace_id:mode==='foreign'?context:workspace,members:[{membership_id:member,member_name:'Authorized test member',role_code:'owner',workspace_eligible:true,building_ids:[building]}],buildings:[{building_id:building,property_id:property,name:'Synthetic building'}]})};const command=JSON.parse(options.body);if(mode==='lost')throw Error('Lost response');if(mode==='mfa')return{ok:false,status:403,json:async()=>({error:{code:'MFA_REQUIRED'}})};return{ok:true,json:async()=>({action:'assign_role',id:context,membership_id:command.target_membership_id,workspace_role_id:command.workspace_role_id,scope_type:command.scope_type,property_id:command.property_id,building_id:mode==='wrong-building'?context:command.building_id,unit_id:null})};};
const {WorkspaceRoleAssignmentEditor}=load('src/components/customer/WorkspaceRoleAssignmentEditor.tsx',{'@/lib/customer/workspace-roles-schema':load('src/lib/customer/workspace-roles-schema.ts')});
const root=createRoot(document.getElementById('root')),props={contextId:context,workspaceId:workspace,roles,onChanged:()=>changes++,onMfaRequired:()=>mfa++};
const render=async(key,lang='en')=>act(async()=>root.render(React.createElement(WorkspaceRoleAssignmentEditor,{...props,key,lang})));
const change=async(selector,value)=>act(async()=>{const element=document.querySelector(selector);if(element.tagName==='SELECT'){element.value=value;element.dispatchEvent(new dom.window.Event('change',{bubbles:true}));}else{Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new dom.window.Event('input',{bubbles:true}));}});
const submit=async()=>act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
try{
 await render('initial');assert.equal(document.querySelectorAll('select')[1].value,'');assert.equal(document.querySelectorAll('select')[2].options.length,2,'only published workspace role offered');assert.equal(document.querySelector('button').disabled,true);
 await change('label:nth-of-type(2) select',member);const select=document.querySelectorAll('select')[2];await act(async()=>{select.value=role;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});await change('input[type="text"],input:not([type])','Synthetic role assignment');
 assert.equal(document.querySelector('button').disabled,false);await submit();const posted=JSON.parse(calls.find(c=>c.options.method).options.body);assert.equal(posted.scope_type,'workspace');assert.equal(posted.target_membership_id,member);assert.equal(posted.workspace_role_id,role);assert.equal(posted.property_id,undefined);
 const storageKey=`cladora.roles.assignment.v1:${context}:${workspace}`;assert.deepEqual(JSON.parse(sessionStorage.getItem(storageKey)),posted);assert.equal(document.querySelector('fieldset').disabled,true);
 await render('recover');await submit();assert.deepEqual(JSON.parse(calls.filter(c=>c.options.method).at(-1).options.body),posted,'lost response retries exact command after remount');
 mode='mfa';await submit();assert.equal(mfa,1);assert.deepEqual(JSON.parse(sessionStorage.getItem(storageKey)),posted,'MFA rejection does not discard uncertain command');
 mode='success';await submit();assert.equal(changes,1);assert.equal(sessionStorage.getItem(storageKey),null);assert.match(document.body.textContent,/Role assigned/);
 mode='foreign';await render('foreign');assert.equal(document.querySelectorAll('select')[1].options.length,1,'foreign workspace member response is rejected');assert.equal(document.querySelector('button').disabled,true);
 mode='success';for(const lang of ['ro','fa']){await render(lang,lang);assert.equal(document.querySelectorAll('label').length,5);assert.equal(document.querySelectorAll('select')[1].options.length,2);}
 mode='success';await render('building');await change('label:nth-of-type(1) select','building');
 assert.equal(document.querySelectorAll('select')[2].options.length,1,'building members require explicit building choice');
 assert.equal(document.querySelectorAll('select')[3].options.length,3,'building accepts workspace and building ceilings, excludes unit/draft');
 await change('label:nth-of-type(2) select',building);await change('label:nth-of-type(3) select',member);await change('label:nth-of-type(4) select',buildingRole);
 await change('input[type="text"],input:not([type])','Synthetic building assignment');
 mode='lost';await submit();const physical=JSON.parse(calls.filter(c=>c.options.method).at(-1).options.body);
 assert.equal(physical.scope_type,'building');assert.equal(physical.property_id,property);assert.equal(physical.building_id,building);
 await render('physical-recover');mode='wrong-building';await submit();assert.ok(sessionStorage.getItem(storageKey),'wrong ancestry cannot confirm request');
 mode='success';await submit();assert.deepEqual(JSON.parse(calls.filter(c=>c.options.method).at(-1).options.body),physical,'physical retry preserves ancestry and key');assert.equal(sessionStorage.getItem(storageKey),null);
 await change('label:nth-of-type(1) select','workspace');assert.equal(document.querySelectorAll('select')[2].value,'','changing scope clears role');
 sessionStorage.setItem(storageKey,'bad json');await render('corrupt');assert.equal(document.querySelector('button').disabled,true,'corrupt pending state fails closed');
 console.log('PASS rendered assignment form: explicit choices, published workspace ceiling, lost response recovery, exact retries, MFA, success, foreign workspace, RO/FA and corrupt state');
}finally{await act(async()=>root.unmount());globalThis.fetch=originalFetch;for(const[key,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}dom.window.close();}
