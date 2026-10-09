import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire,Module} from 'node:module';
import {fileURLToPath} from 'node:url';
import React,{act} from 'react';
import {JSDOM} from 'jsdom';
import ts from 'typescript';
const require=createRequire(import.meta.url),dom=new JSDOM('<div id="root"></div>',{url:'https://cladora.test'}),saved=new Map();
for(const [key,value] of Object.entries({window:dom.window,document:dom.window.document,sessionStorage:dom.window.sessionStorage,IS_REACT_ACT_ENVIRONMENT:true})){saved.set(key,Object.getOwnPropertyDescriptor(globalThis,key));Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});}
const {createRoot}=await import('react-dom/client');
const originalFetch=globalThis.fetch;
function load(path,mocks={}){const filename=fileURLToPath(new URL(`../${path}`,import.meta.url)),mod=new Module(filename);mod.require=id=>Object.hasOwn(mocks,id)?mocks[id]:require(id);mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,filename);return mod.exports;}
const context='11111111-1111-4111-8111-111111111111',workspace='22222222-2222-4222-8222-222222222222';
const propertyOne='33333333-3333-4333-8333-333333333333',propertyTwo='44444444-4444-4444-8444-444444444444',unitOne='55555555-5555-4555-8555-555555555555',unitTwo='66666666-6666-4666-8666-666666666666';
const makePortfolio=()=>({version:1,idempotent:true,as_of:'2026-10-09T12:00:00Z',properties:[
 {mandate_request_id:'77777777-7777-4777-8777-777777777777',property:{id:propertyOne,label:'Old Town Residence'},owner:{party_id:'88888888-8888-4888-8888-888888888888',label:'Ionescu Family'},scope:{capabilities:['listing','maintenance_coordination','owner_reporting']},valid_from:'2026-10-10',valid_to:'2027-10-10',status:'accepted',action_links:[
  {action_link_id:'99999999-9999-4999-8999-999999999991',core_record_type:'maintenance.work_order',core_record_id:'99999999-9999-4999-8999-999999999992',unit_id:unitOne,source_status_snapshot:'assigned',linked_at:'2026-10-09T10:00:00Z'},
  {action_link_id:'99999999-9999-4999-8999-999999999993',core_record_type:'maintenance.work_order',core_record_id:'99999999-9999-4999-8999-999999999994',unit_id:unitTwo,source_status_snapshot:'in_progress',linked_at:'2026-10-09T11:00:00Z'}]},
 {mandate_request_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',property:{id:propertyTwo,label:'Danube Garden'},owner:{party_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',label:'Popescu Holdings'},scope:{capabilities:['lease_administration','owner_reporting']},valid_from:'2026-11-01',valid_to:'2027-11-01',status:'accepted',action_links:[{action_link_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',core_record_type:'maintenance.work_order',core_record_id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',unit_id:unitTwo,source_status_snapshot:'completed',linked_at:'2026-10-09T11:30:00Z'}]}
],operations:{detail_owner:'Operations',mode:'canonical_references_only'},finance:{detail_owner:'Finance',mode:'not_connected',reason:'canonical_receipt_contract_unavailable'}});
let active={context_id:context},mode='targets',calls=[],portfolio=makePortfolio();
globalThis.fetch=async(url,options={})=>{calls.push({url,options});if(url.includes('/workspace/targets'))return{ok:true,json:async()=>({workspaces:mode==='empty'?[]:[{workspace_id:workspace,workspace_type:'building',environment:'PILOT'}]})};if(url.includes('/commercial-lifecycle'))return{ok:true,json:async()=>portfolio};if(options.method==='POST'){if(mode==='uncertain')throw new Error('connection lost');return{ok:true,json:async()=>({version:2,workspace_id:workspace,opportunity_id:context,idempotent:true})};}return{ok:true,json:async()=>({opportunities:[]})};};
const {CustomerAirpropWorkspace}=load('src/components/customer/CustomerAirpropWorkspace.tsx',{'./CustomerAirpropDiligence':{CustomerAirpropDiligence:()=>null},'./CustomerContextProvider':{useCustomerContext:()=>({active})},'./CustomerAirpropUnderwriting':{CustomerAirpropUnderwriting:()=>null},'@/lib/airprop/opportunity-contract-v2':load('src/lib/airprop/opportunity-contract-v2.ts'),'@/lib/airprop/commercial-lifecycle-v1':load('src/lib/airprop/commercial-lifecycle-v1.ts')});
const root=createRoot(document.getElementById('root'));
const render=async(key,lang='en')=>act(async()=>{root.render(React.createElement(CustomerAirpropWorkspace,{key,lang}));});
const choose=async()=>act(async()=>{const select=document.querySelector('select');select.value=workspace;select.dispatchEvent(new dom.window.Event('change',{bubbles:true}));});
try{
 await render('explicit');assert.equal(document.querySelector('select').value,'');assert.equal(calls.some(x=>x.url.includes('/v2/airprop')),false,'no inferred first workspace');
 await choose();assert.equal(document.querySelector('form')!==null,true);assert.equal(calls.some(x=>x.url.includes(`workspace_id=${workspace}`)),true);
 assert.match(document.body.textContent,/Managed portfolio/);assert.match(document.body.textContent,/Old Town Residence/);assert.match(document.body.textContent,/Danube Garden/);
 assert.equal(document.body.textContent.includes(workspace),false,'workspace UUID is not rendered');
 for(const hiddenId of [propertyOne,propertyTwo,unitOne,unitTwo])assert.equal(document.body.textContent.includes(hiddenId),false,'resource UUID is not rendered');
 const propertyButton=[...document.querySelectorAll('button')].find(button=>button.textContent.includes('Danube Garden'));
 await act(async()=>propertyButton.click());
 const clickButton=async label=>act(async()=>[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===label).click());
 await clickButton('Continue');assert.match(document.body.textContent,/Popescu Holdings/);assert.match(document.body.textContent,/Lease administration/);
 await clickButton('Continue');assert.match(document.body.textContent,/Completed/);assert.match(document.body.textContent,/Live Work Order detail remains in Operations/);assert.match(document.body.textContent,/Finance detail is not connected/);
 portfolio={...makePortfolio(),properties:[]};
 await clickButton('Refresh access');assert.match(document.body.textContent,/No currently authorized managed property/);assert.equal(document.body.textContent.includes('Danube Garden'),false,'revoked property is removed on refresh');
 portfolio=makePortfolio();
 // Validation must identify the field, retain entered values and avoid a request.
 const beforeInvalid=calls.filter(x=>x.options.method==='POST').length;
 const setInput=(field,value)=>{const input=document.querySelector(`[name="${field}"]`);Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype,'value').set.call(input,value);input.dispatchEvent(new dom.window.Event('input',{bubbles:true}));};
 await act(async()=>{setInput('name',' ');setInput('city',' ');setInput('asking_price','0');});
 await act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(calls.filter(x=>x.options.method==='POST').length,beforeInvalid);
 assert.equal(document.querySelectorAll('[aria-invalid="true"]').length,3);
 assert.equal(document.activeElement.getAttribute('name'),'name');
 for(const field of document.querySelectorAll('[aria-invalid="true"]'))assert.ok(document.getElementById(field.getAttribute('aria-describedby'))?.textContent);
 mode='empty';await render('empty');assert.match(document.body.textContent,/No authorized workspace/);assert.equal(document.querySelector('form'),null);
 active=null;await render('missing');assert.match(document.body.textContent,/Select a context/);active={context_id:context};
 const pending={version:2,context_id:context,workspace_id:workspace,idempotency_key:'persisted-test-01',payload:{name:'Saved opportunity',city:'București',country_code:'RO',currency:'EUR',asking_price:'12.3000',property_id:null,source_ref:null}};
 const storageKey=`cladora.airprop.pending.v2:${context}:${workspace}`;sessionStorage.setItem(storageKey,JSON.stringify(pending));mode='uncertain';await render('recover');await choose();
 assert.equal(document.querySelector('input').value,pending.payload.name);assert.equal(document.querySelector('fieldset').disabled,true);
 await act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(sessionStorage.getItem(storageKey)!==null,true);const posted=calls.filter(x=>x.options.method==='POST');assert.deepEqual(JSON.parse(posted.at(-1).options.body),pending);
 mode='success';await act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
 assert.equal(sessionStorage.getItem(storageKey),null);assert.equal(document.querySelector('fieldset').disabled,false);assert.match(document.body.textContent,/Opportunity saved/);
 const otherContext='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';active={context_id:otherContext};portfolio={...makePortfolio(),properties:[makePortfolio().properties[1]]};
 await render('other-context');await choose();assert.match(document.body.textContent,/Danube Garden/);assert.equal(document.body.textContent.includes('Old Town Residence'),false,'property selection does not leak across contexts');assert.equal(calls.some(x=>x.url.includes(`context_id=${otherContext}`)),true);
 active={context_id:context};portfolio=makePortfolio();
 for(const lang of ['ro','fa']){await render(`locale-${lang}`,lang);await choose();assert.equal(document.querySelector('section').getAttribute('dir'),lang==='fa'?'rtl':'ltr');assert.equal(document.querySelectorAll('label').length,5);}
 const access=load('src/lib/customer/access-matrix.ts');
 const classifier=load('src/lib/customer/route-classifier.ts',{'./access-matrix.ts':access});
 let pathname='/en/app/airprop';
 const {CustomerRouteGuard}=load('src/components/customer/CustomerRouteGuard.tsx',{'./CustomerAirpropDiligence':{CustomerAirpropDiligence:()=>null},'./CustomerContextProvider':{useCustomerContext:()=>({active,loading:false,dashboard:null})},'next/navigation':{usePathname:()=>pathname},'next/link':{__esModule:true,default:({children,...props})=>React.createElement('a',props,children)},'@/lib/customer/access-matrix':access,'@/lib/customer/route-classifier':classifier});
 assert.equal(classifier.classifyCustomerRoute('/app/airprop').requirement.nativeWorkspaceDiscovery,true);
 assert.equal(classifier.classifyCustomerRoute('/app/airprop/unknown'),null);
 active={context_id:context,scope_type:'tenant'};
 await act(async()=>root.render(React.createElement(CustomerRouteGuard,{lang:'en'},React.createElement('p',null,'native-selector'))));assert.match(document.body.textContent,/native-selector/);
 active={context_id:context,scope_type:'property'};
 await act(async()=>root.render(React.createElement(CustomerRouteGuard,{lang:'en'},React.createElement('p',null,'native-selector'))));assert.equal(document.body.textContent.includes('native-selector'),false);
 active={context_id:context,scope_type:'tenant'};pathname='/en/app/airprop/unknown';
 await act(async()=>root.render(React.createElement(CustomerRouteGuard,{lang:'en'},React.createElement('p',null,'native-selector'))));assert.equal(document.body.textContent.includes('native-selector'),false);
 console.log('PASS actual rendered AIRPROP UI: explicit named-property wizard, hidden UUIDs, multi-unit owner data, live revocation, context isolation, pending recovery, exact retry, success and EN/RO/FA');
}finally{await act(async()=>root.unmount());globalThis.fetch=originalFetch;for(const [key,descriptor] of saved){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}dom.window.close();}
