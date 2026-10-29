/** Offline mounted-component recovery tests. No HTTP server, credentials or database.
 * Run from the repository root: node scripts/test-preventive-maintenance-panel-recovery.mjs
 * Uses only the repository's existing React/ReactDOM/TypeScript/jsdom dependencies.
 * Network is a strict, manually settled FIFO; unexpected fetches fail the test.
 */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(pathToFileURL(resolve(root,'package.json')));
const ts=require('typescript');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://offline.invalid'});
for(const key of ['window','document','HTMLElement','HTMLInputElement','HTMLSelectElement','Event','MouseEvent','FormData','Node'])Object.defineProperty(globalThis,key,{configurable:true,value:dom.window[key]});
Object.defineProperty(globalThis,'navigator',{configurable:true,value:dom.window.navigator});
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
assert.equal(typeof globalThis.crypto.randomUUID,'function');
const React=await import(pathToFileURL(require.resolve('react')).href);
const {createRoot}=await import(pathToFileURL(require.resolve('react-dom/client')).href);
const {act}=React;
function moduleURL(path,aliases={}){
 const source=readFileSync(resolve(root,path),'utf8');
 const out=ts.transpileModule(source,{fileName:path,reportDiagnostics:true,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX}});
 const errors=out.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error)??[];
 assert.deepEqual(errors,[],`syntax: ${path}`);
 const code=out.outputText.replace(/from (["'])([^"']+)\1/g,(_,q,name)=>`from ${JSON.stringify(aliases[name]??pathToFileURL(require.resolve(name)).href)}`);
 return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
}
const defaults=moduleURL('src/lib/customer/maintenance-defaults.ts');
const {PreventiveMaintenancePanel}=await import(moduleURL('src/components/customer/PreventiveMaintenancePanel.tsx',{'@/lib/customer/maintenance-defaults':defaults}));
const {DEFAULT_MAINTENANCE_PLANS}=await import(defaults);
const C='10000000-0000-0000-0000-000000000001',D='10000000-0000-0000-0000-000000000002';
const A='20000000-0000-0000-0000-000000000001',V='30000000-0000-0000-0000-000000000001',P='40000000-0000-0000-0000-000000000001',W='50000000-0000-0000-0000-000000000001';
const due='2020-01-01';
const clone=v=>structuredClone(v);
const plan=(extra={})=>({id:P,revision:1,name:'Inspection',asset_id:A,asset_name:'Lift private',vendor_id:V,vendor_name:'Approved private',calendar_anchor:due,calendar_unit:'months',calendar_every:1,calendar_enabled:true,next_due_on:due,checklist_template:['Check condition'],history:[],...extra});
const listing=(plans=[],category='elevator')=>({plans,assets:[{id:A,name:'Lift private',asset_code:'L-1',category_code:category}],vendors:[{id:V,name:'Approved private'}]});
const saved=b=>plan({id:b.id,revision:b.revision+1,name:b.name,asset_id:b.asset_id,vendor_id:b.vendor_id,calendar_anchor:b.anchor,calendar_unit:b.unit,calendar_every:b.every,calendar_enabled:b.enabled,checklist_template:[...b.checklist]});
const occurrence=(id=W,extra={})=>({due_on:due,work_order_id:id,work_order_no:17,status:'draft',...extra});
let calls=[],waiting=[],unexpected=[],host,reactRoot;
const oldFetch=globalThis.fetch;
globalThis.fetch=(url,options={})=>new Promise((resolvePromise,reject)=>{
 const call={url:String(url),method:options.method??'GET',wire:options.body,body:options.body?JSON.parse(options.body):null,signal:options.signal,resolve:resolvePromise,reject};
 calls.push(call);waiting.push(call);
 // Never perform a real fetch, even for an unexpected URL.
 if(!String(url).startsWith('/api/customer/v1/maintenance-plans'))unexpected.push(url);
});
const posts=()=>calls.filter(c=>c.method==='POST');
const content=()=>host.textContent;
const buttons=()=>[...host.querySelectorAll('button')];
const button=label=>{const found=buttons().find(b=>b.textContent===label);assert.ok(found,`button ${label}: ${content()}`);return found};
const field=name=>{const found=host.querySelector(`[name="${name}"]`);assert.ok(found,`field ${name}`);return found};
async function click(element){await act(async()=>{element.dispatchEvent(new MouseEvent('click',{bubbles:true}))})}
async function change(element,value){await act(async()=>{const descriptor=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element),'value');descriptor.set.call(element,value);element.dispatchEvent(new Event(element.tagName==='SELECT'?'change':'input',{bubbles:true}))})}
async function submit(times=1){const form=host.querySelector('form');assert.ok(form);await act(async()=>{for(let i=0;i<times;i++)form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))})}
async function settle(call,payload,status=200){assert.ok(call,'missing network call');waiting=waiting.filter(c=>c!==call);await act(async()=>{call.resolve({ok:status>=200&&status<300,status,json:async()=>clone(payload)})})}
async function lose(call){waiting=waiting.filter(c=>c!==call);await act(async()=>call.reject(new TypeError('offline-lost-response')))}
const next=(method='GET')=>{const c=waiting.find(c=>c.method===method);assert.ok(c,`expected ${method}`);return c};
async function mount(lang='en',contextId=C,strict=false){
 calls=[];waiting=[];unexpected=[];host=document.createElement('div');document.body.append(host);reactRoot=createRoot(host);
 await act(async()=>{const component=React.createElement(PreventiveMaintenancePanel,{lang,contextId});reactRoot.render(strict?React.createElement(React.StrictMode,null,component):component)});
}
async function render(lang='en',contextId=C){await act(async()=>reactRoot.render(React.createElement(PreventiveMaintenancePanel,{lang,contextId})))}
async function unmount(){await act(async()=>reactRoot.unmount());host.remove();assert.deepEqual(unexpected,[])}
async function customForm(){
 await change(host.querySelectorAll('form select')[1],A);
 await change(host.querySelector('form select'),'');
 field('name').value='  Custom inspection  ';field('vendor').value=V;field('anchor').value=due;field('every').value='2';field('unit').value='weeks';field('checklist').value=' Inspect seal \n Record result ';
}
async function startSave(){await mount();await settle(next(),listing());await customForm();await submit();return next('POST')}
async function startGenerate(){await mount();await settle(next(),listing([plan()]));await click(button('Issue due draft'));return next('POST')}
const tests=[];
function test(name,run){tests.push({name,run})}
for(const lang of ['en','ro','fa'])test(`locale ${lang}: actual scoped choices, preset canonical codes, RTL and immutable snapshot`,async()=>{
 await mount(lang);await settle(next(),listing());assert.equal(host.querySelector('section').dir,lang==='fa'?'rtl':'ltr');
 assert.match(content(),/Lift private/);assert.match(content(),/Approved private/);
 await change(host.querySelectorAll('form select')[1],A);
 const template=DEFAULT_MAINTENANCE_PLANS[0];assert.match(content(),new RegExp(template.title[lang]));
 field('vendor').value=V;field('anchor').value=due;await submit(2);
 assert.equal(posts().length,1);const call=next('POST'),b=call.body;
 assert.equal(b.context_id,C);assert.equal(b.name,template.code);assert.deepEqual(b.checklist,template.steps.map(s=>s.code));assert.equal(b.revision,0);assert.match(b.id,/^[a-f0-9-]{36}$/);
 assert.equal(host.querySelector('form'),null);await settle(call,{id:b.id,revision:1});assert.doesNotMatch(content(),/Reply validated/);
 await settle(next(),listing([saved(b)]));assert.equal(posts().length,1);assert.match(content(),new RegExp(lang==='en'?'Reply validated':lang==='ro'?'Răspuns validat':'پاسخ معتبر'));
 await unmount();
});
for(const template of DEFAULT_MAINTENANCE_PLANS.slice(1))test(`category ${template.assetCategories[0]} binds the actual canonical program/checklist`,async()=>{
 await mount();await settle(next(),listing([],template.assetCategories[0]));await change(host.querySelectorAll('form select')[1],A);assert.match(content(),new RegExp(template.title.en));field('vendor').value=V;field('anchor').value=due;await submit();const call=next('POST');assert.equal(call.body.name,template.code);assert.deepEqual(call.body.checklist,template.steps.map(s=>s.code));assert.equal(call.body.every,template.suggestedEvery);assert.equal(call.body.unit,template.suggestedUnit);await unmount();await lose(call);
});
test('unknown category offers custom only; absent scoped choices never get a fabricated form',async()=>{
 await mount();await settle(next(),listing([],'unmapped_category'));await change(host.querySelectorAll('form select')[1],A);assert.equal(host.querySelector('form select').options.length,1);assert.ok(field('name'));await click(button('Refresh'));await settle(next(),{plans:[],assets:[],vendors:[]});assert.equal(host.querySelector('form'),null);assert.equal(posts().length,0);await unmount();
});
test('custom create, current-revision edit, disable and history preserved; calendar immutable',async()=>{
 const call=await startSave(),b=call.body;assert.equal(b.name,'Custom inspection');assert.deepEqual(b.checklist,['Inspect seal','Record result']);assert.equal(b.every,2);assert.equal(b.unit,'weeks');
 await settle(call,{id:b.id,revision:1});const current=saved(b);current.history=[occurrence()];await settle(next(),listing([current]));
 assert.match(content(),new RegExp(W));assert.match(content(),/Draft only/);assert.doesNotMatch(content(),/Verified/);
 await click(button('Edit'));assert.equal(field('anchor').disabled,true);assert.equal(field('every').disabled,true);assert.equal(field('unit').disabled,true);assert.equal(host.querySelectorAll('form select')[1].disabled,true);
 field('name').value='Disabled plan';field('enabled').checked=false;await submit(2);assert.equal(posts().length,2);
 const edit=next('POST');assert.equal(edit.body.id,b.id);assert.equal(edit.body.revision,1);assert.equal(edit.body.asset_id,A);assert.equal(edit.body.anchor,b.anchor);assert.equal(edit.body.enabled,false);
 await settle(edit,{id:b.id,revision:2});await settle(next(),listing([{...saved(edit.body),history:[occurrence()]}]));
 assert.match(content(),new RegExp(W));
 // A later authorized refresh carries the retained occurrence history.
 await click(button('Refresh'));await settle(next(),listing([plan({...saved(edit.body),history:[occurrence()]})]));
 assert.match(content(),/Disabled; history retained/);assert.match(content(),new RegExp(W));assert.equal(button('Issue due draft').disabled,true);await unmount();
});
test('generation binds exact plan/due and receipt/history WO; replay keeps current lifecycle',async()=>{
 const call=await startGenerate();assert.deepEqual(call.body,{action:'generate',context_id:C,plan_id:P,due_on:due});
 await settle(call,{id:W,replayed:false,status:'draft',work_order_no:17});await settle(next(),listing([plan({revision:2,next_due_on:'2020-02-01',history:[occurrence()]})]));
 assert.match(content(),/Reply validated/);assert.equal(host.querySelector('details').open,true);assert.match(content(),new RegExp(W));assert.match(content(),/2020-01-01/);assert.match(content(),/Draft only/);assert.equal(posts().length,1);await unmount();
});
test('generate lost reply: bounded absence remains HOLD; explicit retry preserves exact bytes/due; replay may now be verified',async()=>{
 const call=await startGenerate(),wire=call.wire;await lose(call);await settle(next(),listing());assert.match(content(),/Outcome unknown/);assert.equal(posts().length,1);assert.equal(button('Save plan').disabled,true);
 await click(button('Retry this exact occurrence'));assert.equal(posts().length,2);const retry=next('POST');assert.equal(retry.wire,wire);
 await settle(retry,{id:W,replayed:true});await settle(next(),listing([plan({revision:4,next_due_on:'2020-04-01',history:[occurrence(W,{status:'verified'})]})]));
 assert.match(content(),/Reply validated/);assert.match(content(),/Verified/);assert.doesNotMatch(content(),/Draft only/);await unmount();
});
test('save lost reply: empty bounded GET never releases ID or permits a new POST',async()=>{
 const call=await startSave();await lose(call);await settle(next(),listing());assert.match(content(),/Outcome unknown/);await submit(2);assert.equal(posts().length,1);assert.equal(button('Save plan').disabled,true);
 await click(button('Check current result'));await settle(next(),listing());await submit();assert.equal(posts().length,1);assert.ok(!buttons().some(b=>/Retry/.test(b.textContent)));await unmount();
});
test('save observed matching state is not own-command receipt; explicit acknowledgement edits that exact record',async()=>{
 const call=await startSave();await lose(call);await settle(next(),listing([saved(call.body)]));assert.match(content(),/not a receipt/);assert.doesNotMatch(content(),/Reply validated/);assert.equal(button('Save plan').disabled,true);
 await click(button('Continue with observed record'));assert.equal(posts().length,1);assert.equal(field('anchor').disabled,true);assert.equal(field('name').value,call.body.name);await unmount();
});
for(const [status,code] of [[400,'INVALID_REQUEST'],[401,'UNAUTHORIZED'],[403,'MFA_REQUIRED'],[404,'NOT_FOUND'],[409,'REVISION_CONFLICT'],[500,'INTERNAL_ERROR'],[503,'UNAVAILABLE']])test(`POST ${status}: rejected/denied/conflict/UNKNOWN, no old private content or automatic retry`,async()=>{
 const call=await startSave();await settle(call,{error:{code}},status);assert.equal(posts().length,1);assert.doesNotMatch(content(),/Reply validated/);
 if(status===401||status===403){assert.equal(waiting.length,0);assert.doesNotMatch(content(),/Lift private|Approved private/);assert.match(content(),/Access denied/);await click(button('Check current result'))}
 await settle(next(),listing());assert.equal(posts().length,1);assert.equal(button('Save plan').disabled,true);
 if(status<500){await click(button('Review rejected request'));assert.equal(button('Save plan').disabled,false)}else assert.match(content(),/Outcome unknown/);
 await unmount();
});
for(const [name,reply] of [['null',null],['wrong id',{id:W,revision:1}],['wrong revision',{id:P,revision:99}],['revision string',{id:P,revision:'1'}],['extra field',{id:P,revision:1,ok:true}],['empty',{}]])test(`save malformed 2xx ${name} never confirms`,async()=>{
 const call=await startSave();const value=reply&&name!=='wrong id'?{...reply,id:call.body.id}:reply;
 await settle(call,value);await settle(next(),listing([saved(call.body)]));assert.doesNotMatch(content(),/Reply validated/);assert.match(content(),/not a receipt/);assert.equal(button('Save plan').disabled,true);await unmount();
});
for(const [name,reply] of [['null',null],['missing replay',{id:W}],['string replay',{id:W,replayed:'false'}],['wrong id',{id:'bad',replayed:false}],['unknown status',{id:W,replayed:false,status:'completed'}],['extra',{id:W,replayed:false,ok:true}]])test(`generate malformed 2xx ${name} never confirms`,async()=>{
 const call=await startGenerate();await settle(call,reply);await settle(next(),listing([plan({history:[occurrence()]})]));assert.doesNotMatch(content(),/Reply validated/);assert.match(content(),/not a receipt/);await unmount();
});
// OPS-SR-01: branch-coherent wire shapes; matching state is never a substitute receipt.
const validFresh={id:W,replayed:false,work_order_no:17,status:'draft'};
const malformedGenerate=[
 ['truncated fresh same occurrence',{id:W,replayed:false}],
 ['fresh missing status',(({status,...rest})=>rest)(validFresh)],
 ['fresh missing work_order_no',(({work_order_no,...rest})=>rest)(validFresh)],
 ...[0,-1,1.5,Number.MAX_SAFE_INTEGER+1,'17',null,true].map(value=>[`fresh invalid work_order_no ${JSON.stringify(value)}`,{...validFresh,work_order_no:value}]),
 ...[null,17,false,'scheduled','completed','verified','Draft'].map(value=>[`fresh invalid status ${JSON.stringify(value)}`,{...validFresh,status:value}]),
 ['fresh extra field',{...validFresh,extra:true}],
 ['replay mixed fresh fields',{...validFresh,replayed:true}],
 ['replay work_order_no field',{id:W,replayed:true,work_order_no:17}],
 ['replay status field',{id:W,replayed:true,status:'draft'}],
 ['replay extra field',{id:W,replayed:true,extra:true}],
 ['fresh wrong id with otherwise exact keys',{...validFresh,id:'bad'}],
 ['fresh nonboolean replay',{...validFresh,replayed:0}],
];
for(const [name,reply] of malformedGenerate)test(`OPS-SR-01 ${name}: exact GET is observed only, no auto-clear`,async()=>{
 const call=await startGenerate();await settle(call,reply);await settle(next(),listing([plan({revision:2,next_due_on:'2020-02-01',history:[occurrence()]})]));
 assert.doesNotMatch(content(),/Reply validated/);assert.match(content(),/not a receipt/);assert.equal(button('Save plan').disabled,true);assert.equal(posts().length,1);assert.ok(button('Retry this exact occurrence'));assert.ok(button('Continue with observed record'));
 await click(button('Continue with observed record'));assert.equal(posts().length,1);assert.equal(button('Save plan').disabled,false);await unmount();
});
test('OPS-SR-01 truncated fresh with missing occurrence remains UNKNOWN-HOLD',async()=>{
 const call=await startGenerate();await settle(call,{id:W,replayed:false});await settle(next(),listing([plan({history:[]})]));assert.match(content(),/Outcome unknown/);assert.doesNotMatch(content(),/Reply validated/);assert.ok(!buttons().some(b=>b.textContent==='Continue with observed record'));assert.equal(button('Save plan').disabled,true);assert.equal(posts().length,1);await unmount();
});
for(const [name,reply,status] of [['fresh',validFresh,'draft'],['replay',{id:W,replayed:true},'verified']])test(`OPS-SR-01 exact ${name} receipt plus exact current history confirms`,async()=>{
 const call=await startGenerate();await settle(call,reply);assert.doesNotMatch(content(),/Reply validated/);await settle(next(),listing([plan({revision:2,next_due_on:'2020-02-01',history:[occurrence(W,{status})]})]));assert.match(content(),/Reply validated/);assert.equal(button('Save plan').disabled,false);assert.ok(!buttons().some(b=>b.textContent==='Continue with observed record'));assert.equal(posts().length,1);await unmount();
});
test('OPS-SR-01 malformed fresh can retry only exact saved wire and validate a real replay',async()=>{
 const call=await startGenerate(),wire=call.wire;await settle(call,{id:W,replayed:false});await settle(next(),listing([plan({revision:2,next_due_on:'2020-02-01',history:[occurrence()]})]));assert.equal(button('Save plan').disabled,true);await click(button('Retry this exact occurrence'));const retry=next('POST');assert.equal(retry.wire,wire);await settle(retry,{id:W,replayed:true});await settle(next(),listing([plan({revision:2,next_due_on:'2020-02-01',history:[occurrence()]})]));assert.match(content(),/Reply validated/);assert.equal(posts().length,2);await unmount();
});
test('OPS-SR-01 valid fresh receipt with incompatible immutable order number is conflict',async()=>{
 const call=await startGenerate();await settle(call,validFresh);await settle(next(),listing([plan({history:[occurrence(W,{work_order_no:18})]})]));assert.doesNotMatch(content(),/Reply validated/);assert.match(content(),/conflict/);assert.equal(button('Save plan').disabled,true);assert.ok(!buttons().some(b=>b.textContent==='Continue with observed record'));assert.equal(posts().length,1);await unmount();
});
test('valid generate receipt with wrong order in exact due history stays blocked',async()=>{
 const call=await startGenerate();await settle(call,{id:W,replayed:true});await settle(next(),listing([plan({history:[occurrence(randomUUID())]})]));assert.doesNotMatch(content(),/Reply validated/);assert.match(content(),/conflict/);assert.equal(button('Save plan').disabled,true);assert.ok(!buttons().some(b=>b.textContent==='Continue with observed record'));await unmount();
});
for(const defect of ['revision','name','vendor_id','calendar_enabled','calendar_anchor','calendar_unit','calendar_every','asset_id','checklist_template'])test(`save exact reconciliation rejects different ${defect}`,async()=>{
 const call=await startSave();await settle(call,{id:call.body.id,revision:1});const current=saved(call.body);
 current[defect]=({revision:2,name:'Other',vendor_id:randomUUID(),calendar_enabled:false,calendar_anchor:'2020-02-01',calendar_unit:'years',calendar_every:3,asset_id:randomUUID(),checklist_template:['Other']})[defect];
 await settle(next(),listing([current]));assert.doesNotMatch(content(),/Reply validated/);assert.equal(button('Save plan').disabled,true);await unmount();
});
for(const [name,mutate] of [
 ['missing history WO',d=>{d.plans[0].history=[{due_on:due,work_order_no:17,status:'draft'}]}],
 ['invalid history due',d=>{d.plans[0].history=[occurrence(W,{due_on:'2020-02-31'})]}],
 ['unknown history status',d=>{d.plans[0].history=[occurrence(W,{status:'invented'})]}],
 ['duplicate plans',d=>{d.plans.push(clone(d.plans[0]))}],
 ['duplicate occurrence',d=>{d.plans[0].history=[occurrence(),occurrence()]}],
 ['duplicate WO across plans',d=>{d.plans[0].history=[occurrence()];d.plans.push(plan({id:randomUUID(),history:[occurrence()]}))}],
 ['bad choice',d=>{d.assets[0].id='bad'}],['missing category',d=>{delete d.assets[0].category_code}],
 ['array unit',d=>{d.plans[0].calendar_unit=['months']}],['string revision',d=>{d.plans[0].revision='1'}],['over limit',d=>{d.plans=Array.from({length:201},()=>plan({id:randomUUID()}))}],
])test(`invalid GET ${name} hides all old/private data and actions`,async()=>{
 await mount();await settle(next(),listing([plan()]));await click(button('Refresh'));const d=listing([plan()]);mutate(d);await settle(next(),d);assert.doesNotMatch(content(),/Lift private|Approved private/);assert.equal(host.querySelector('form'),null);assert.match(content(),/could not be validated/);await unmount();
});
for(const status of [400,401,403,404,409,500])test(`readback ${status} after valid receipt hides prior state and retains recovery`,async()=>{
 const call=await startSave();await settle(call,{id:call.body.id,revision:1});await settle(next(),{error:{code:'DENIED'}},status);assert.doesNotMatch(content(),/Lift private|Reply validated/);assert.equal(posts().length,1);
 await click(button('Check current result'));await settle(next(),listing([saved(call.body)]));assert.match(content(),/Reply validated/);assert.equal(posts().length,1);await unmount();
});
test('scope switch before POST completes: old response/finally cannot populate or unlock another Context',async()=>{
 const call=await startSave();await render('en',D);assert.doesNotMatch(content(),/Lift private|Custom inspection/);const fresh=next();assert.match(fresh.url,new RegExp(D));
 await settle(call,{id:call.body.id,revision:1});assert.equal(host.querySelector('form'),null);assert.equal(button('Check current result').disabled,true);
 await settle(fresh,{plans:[],assets:[],vendors:[]});assert.match(content(),/another Context/);assert.equal(posts().length,1);
 await render('en',C);await settle(next(),listing([saved(call.body)]));assert.match(content(),/not a receipt/);assert.equal(posts().length,1);await unmount();
});
test('scope switch during POST JSON decode admits no stale receipt or readback',async()=>{
 const call=await startSave();waiting=waiting.filter(c=>c!==call);let decode;
 await act(async()=>{call.resolve({ok:true,status:200,json:()=>new Promise(resolve=>{decode=resolve})})});
 await render('en',D);const fresh=next();await act(async()=>decode({id:call.body.id,revision:1}));await settle(fresh,{plans:[],assets:[],vendors:[]});assert.match(content(),/another Context/);assert.doesNotMatch(content(),/Custom inspection|Reply validated/);assert.equal(waiting.length,0);await unmount();
});
test('unmount during network and decode never creates a readback or second dispatch',async()=>{
 const call=await startSave();await unmount();await settle(call,{id:call.body.id,revision:1});assert.equal(calls.length,2);
});
test('late old GET cannot overwrite a newer read or reconcile a command',async()=>{
 await mount();const old=next();await render('en',D);const fresh=waiting.filter(c=>c.method==='GET').at(-1);await settle(fresh,{plans:[],assets:[],vendors:[]});await settle(old,listing([plan()]));assert.doesNotMatch(content(),/Lift private/);assert.equal(posts().length,0);await unmount();
});
test('manual refresh pre-dispatch invalidates all prior reads; disabled/future due never dispatch',async()=>{
 await mount();await settle(next(),listing([plan({calendar_enabled:false}),plan({id:randomUUID(),next_due_on:'9999-01-01'})]));
 for(const b of buttons().filter(b=>b.textContent==='Issue due draft')){assert.equal(b.disabled,true);await click(b)}assert.equal(posts().length,0);
 await click(button('Refresh'));assert.equal(host.querySelector('form'),null);const old=next();await render('en',D);await settle(waiting.filter(c=>c.method==='GET').at(-1),{plans:[],assets:[],vendors:[]});await settle(old,listing([plan()]));assert.doesNotMatch(content(),/Lift private/);await unmount();
});
test('same-batch refresh then observed acknowledgement cannot release the pending attempt',async()=>{
 const call=await startSave();await lose(call);await settle(next(),listing([saved(call.body)]));
 const refresh=button('Check current result'),accept=button('Continue with observed record');
 await act(async()=>{refresh.dispatchEvent(new MouseEvent('click',{bubbles:true}));accept.dispatchEvent(new MouseEvent('click',{bubbles:true}))});
 await settle(next(),listing());assert.equal(posts().length,1);assert.equal(button('Save plan').disabled,true);assert.match(content(),/Outcome unknown/);await unmount();
});
test('retained DOM controls cannot mutate the dispatched snapshot or enqueue another intent',async()=>{
 await mount();await settle(next(),listing());await customForm();const form=host.querySelector('form'),name=field('name'),checklist=field('checklist');
 await act(async()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));name.value='Altered intent';checklist.value='Altered list';form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))});
 const call=next('POST');assert.equal(posts().length,1);assert.equal(call.body.name,'Custom inspection');assert.deepEqual(call.body.checklist,['Inspect seal','Record result']);
 await lose(call);await settle(next(),listing());assert.equal(posts().length,1);await unmount();
});
test('same-batch generate double click dispatches once before any await',async()=>{
 await mount();await settle(next(),listing([plan()]));const issue=button('Issue due draft');await act(async()=>{issue.dispatchEvent(new MouseEvent('click',{bubbles:true}));issue.dispatchEvent(new MouseEvent('click',{bubbles:true}))});
 assert.equal(posts().length,1);await lose(next('POST'));await settle(next(),listing());await unmount();
});
test('malformed JSON reply and invalid GET never clear UNKNOWN; a subsequent exact read may observe it',async()=>{
 const call=await startSave();waiting=waiting.filter(c=>c!==call);await act(async()=>call.resolve({ok:true,status:200,json:async()=>{throw new SyntaxError('broken JSON')}}));
 await settle(next(),null);assert.equal(host.querySelector('form'),null);assert.doesNotMatch(content(),/Reply validated/);await click(button('Check current result'));await settle(next(),listing([saved(call.body)]));assert.match(content(),/not a receipt/);await unmount();
});
test('generate readback cannot substitute another due occurrence even with the same WO identity',async()=>{
 const call=await startGenerate();await settle(call,{id:W,replayed:false,work_order_no:17,status:'draft'});await settle(next(),listing([plan({history:[occurrence(W,{due_on:'2020-02-01'})]})]));assert.doesNotMatch(content(),/Reply validated/);assert.ok(!buttons().some(b=>b.textContent==='Continue with observed record'));assert.equal(posts().length,1);await unmount();
});
test('revoke/denial on explicit check removes previously observed matching private state',async()=>{
 const call=await startSave();await lose(call);await settle(next(),listing([saved(call.body)]));assert.match(content(),/not a receipt/);await click(button('Check current result'));assert.doesNotMatch(content(),/Custom inspection|Lift private/);await settle(next(),{error:{code:'FORBIDDEN'}},403);assert.match(content(),/Access denied/);assert.ok(!buttons().some(b=>b.textContent==='Continue with observed record'));assert.equal(posts().length,1);await unmount();
});
test('unmount during POST decode prevents readback even if decoded receipt is valid',async()=>{
 const call=await startSave();waiting=waiting.filter(c=>c!==call);let decode;await act(async()=>call.resolve({ok:true,status:200,json:()=>new Promise(resolve=>{decode=resolve})}));await unmount();await act(async()=>decode({id:call.body.id,revision:1}));assert.equal(calls.length,2);
});
test('old Context GET decode cannot disclose content after new Context commits',async()=>{
 await mount();const call=next();waiting=waiting.filter(c=>c!==call);let decode;await act(async()=>call.resolve({ok:true,status:200,json:()=>new Promise(resolve=>{decode=resolve})}));await render('en',D);await settle(next(),{plans:[],assets:[],vendors:[]});await act(async()=>decode(listing([plan()])));assert.doesNotMatch(content(),/Lift private|Approved private/);await unmount();
});
test('unexpected 4xx envelope is UNKNOWN, never evidence authorizing a replacement UUID',async()=>{
 const call=await startSave();await settle(call,{message:'generic proxy response'},400);await settle(next(),listing());assert.match(content(),/Outcome unknown/);assert.ok(!buttons().some(b=>b.textContent==='Review rejected request'));assert.equal(button('Save plan').disabled,true);await unmount();
});
for(const [name,mutate] of [
 ['missing name',()=>{field('name').value='   '}],['long name',()=>{field('name').value='x'.repeat(201)}],
 ['too many checklist items',()=>{field('checklist').value=Array(51).fill('check').join('\n')}],
 ['long checklist item',()=>{field('checklist').value='x'.repeat(201)}],
 ['foreign vendor',()=>{field('vendor').add(new window.Option('foreign',W));field('vendor').value=W}],
 ['bad date',()=>{field('anchor').value=''}],['bad period',()=>{field('every').value='121'}],
 ['reserved name',()=>{field('name').value='CLADORA_PM_FAKE'}],['reserved checklist',()=>{field('checklist').value='CLADORA_PM_FAKE'}],
 ['oversized UTF8 request',()=>{field('checklist').value=Array(50).fill('ش'.repeat(200)).join('\n');field('name').value='ش'.repeat(200)}],
])test(`pre-dispatch request validation: ${name} sends no POST and retains correction path`,async()=>{
 await mount();await settle(next(),listing());await customForm();await act(async()=>mutate());await submit(2);assert.equal(posts().length,0);assert.match(content(),/Check the scoped/);assert.equal(button('Save plan').disabled,false);await unmount();
});
test('foreign asset with otherwise coherent valid fields is rejected before POST',async()=>{
 await mount();await settle(next(),listing());await customForm();const select=host.querySelectorAll('form select')[1];select.add(new window.Option('foreign',W));await change(select,W);
 // React remounts the form after asset selection: restore every other valid field.
 field('name').value='Custom inspection';field('vendor').value=V;field('anchor').value=due;field('every').value='2';field('unit').value='weeks';field('checklist').value='Inspect seal';
 await submit(2);assert.equal(posts().length,0);assert.match(content(),/Check the scoped/);await unmount();
});
test('StrictMode initial read remains scoped and creates no command',async()=>{
 await mount('en',C,true);for(const call of [...waiting])await settle(call,listing());assert.equal(posts().length,0);assert.ok(host.querySelector('form'));await unmount();
});
let passed=0;
try{
 const args=process.argv.slice(2);
 const group=args.length===0?'all':args.length===2&&args[0]==='--group'?args[1]:null;
 assert.ok(['all','ops-sr-01','ops-sr-01-counterexample'].includes(group),'usage: [--group ops-sr-01|ops-sr-01-counterexample]');
 const selected=group==='all'?tests:tests.filter(entry=>group==='ops-sr-01-counterexample'?entry.name.startsWith('OPS-SR-01 truncated fresh same occurrence:'):entry.name.startsWith('OPS-SR-01')||/^(generation binds|generate lost reply|generate malformed|valid generate receipt|generate readback)/.test(entry.name));
 assert.ok(selected.length>0,'empty test selection is not PASS');
 for(const entry of selected){try{await entry.run();passed++;console.log(`PASS ${entry.name}`)}catch(error){console.error(`FAIL ${entry.name}`);throw error}}
 console.log(JSON.stringify({suite:'preventive-maintenance-panel-recovery',passed,total:selected.length,available:tests.length,group,network:'fake-fetch-only',database:'NONE',browser:'jsdom-only'}));
}finally{globalThis.fetch=oldFetch;dom.window.close()}
