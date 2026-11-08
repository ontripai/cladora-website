/** Connected Guide product source over a controlled transport; never native proof. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
const url=new URL('test-ce-guide-create14.mjs',import.meta.url),old=readFileSync(url,'utf8');
let prefix=old.slice(0,old.indexOf("await check('create0"));
const mountSource=old.slice(old.indexOf('async function mount('),old.indexOf("await check('mounted actual"));
prefix+="const {CustomerExperienceGuidePage:Page}=load('src/components/customer/CustomerExperienceGuidePage.tsx');\n"+mountSource;
// Reuse the accepted transport setup ONLY; none of its prior12 groups execute.
prefix=prefix.replaceAll('import.meta.url',JSON.stringify(url.href)).replace('const require=createRequire','const realmRequire=createRequire').replaceAll('require(','realmRequire(');
prefix=prefix.replace('version:1});f.writes.push',"version:1,status:'draft',content_version:1});f.writes.push");
prefix=prefix.replace("{...g,status:'draft',can_edit:manage,steps:","{...g,status:g.status,can_edit:manage&&g.status==='draft',steps:")
 .replace("filter(s=>s.guide_id===g.guide_id).map", "filter(s=>s.guide_id===g.guide_id&&s.version===g.content_version).map")
 .replace('({tenant_id,created_by,...g})','({tenant_id,created_by,content_version,...g})').replace('void created_by;','void created_by;void content_version;');
const extra=`
  if(q===core.CORE_SERVER_REPLAY_EXPIRY_SQL_V1)return {rows:f.ledgers.has(v[1])?[{unexpired:f.expiry>f.now}]:[],rowCount:f.ledgers.has(v[1])?1:0};
  if(q.includes('as authority_version')&&q.includes('from experience.guides g')){const g=f.created.get(v[0]);return {rows:g?[{content_version:String(g.content_version),authority_version:'1',actor_bound:v[3]===ids.actor,aal2:true}]:[],rowCount:g?1:0};}
  if(q.trim().startsWith('select r.')&&q.includes('from experience.guide_references r'))return {rows:[],rowCount:0};
  if(q.includes('as isolation')&&q.includes('as actor_bound')){const tx=await query('select txid_current()::text as transaction_id, auth.uid()');return {rows:[{transaction_id:tx.rows[0].transaction_id,isolation:'serializable',actor_bound:true,aal2:true}],rowCount:1};}
  if(q.includes('select g.version::text,g.content_version::text,g.status')||q.includes('select g.status,g.version::text,g.content_version::text')){const g=f.created.get(v[0]);if(!g)return {rows:[],rowCount:0};if(q.includes('select g.status')&&f.expireDuringReplay)f.now=f.expiry;const tx=await query('select txid_current()::text as id, clock_timestamp()::text as now');return {rows:[{version:String(g.version),content_version:String(g.content_version),status:g.status,actor_bound:true,aal2:true,transaction_id:tx.rows[0].id,now:f.now}],rowCount:1};}
  if(q.startsWith('select version,status::text from experience.guides')){const g=f.created.get(v[2]);return {rows:g?[{version:g.version,status:g.status}]:[],rowCount:g?1:0};}
  if(q.trim().startsWith('update experience.guides set title=')){const g=f.created.get(v[2]);if(!g||g.version!==v[5]||g.status!=='draft')return {rows:[],rowCount:0};g.title=v[3];g.version=v[4];g.content_version=v[4];f.version=v[4];f.writes.push('guide');return {rows:[{id:g.guide_id}],rowCount:1};}
  if(q.trim().startsWith('update experience.guides')&&q.includes('set status')){const g=f.created.get(v[0]);if(!g||g.version!==v[3]-1||g.status==='cancelled')return {rows:[],rowCount:0};g.status=q.includes("set status='cancelled'")?'cancelled':v[4];g.version=v[3];f.version=v[3];f.writes.push('lifecycle');return {rows:[{id:g.guide_id}],rowCount:1};}
  if(q.startsWith('insert into experience.guide_steps')&&q!==create.CE012_CREATE_STEP_SQL){f.stepRows.set(v[0],{id:v[0],guide_id:v[3],version:v[4],title:v[5],body:v[6]});}
`;
prefix=prefix.replace("if(q===api.CE012_FUNCTIONAL_AUTH_SQL)",extra+"\n  if(q===api.CE012_FUNCTIONAL_AUTH_SQL)");
prefix+='\nexport {setup,ids,client,core,api,load,React,act,NextRequest,mount,input};\nexport const setTransport=v=>{transport=v;};\n';
const loaded={exports:{}};new Function('require','module','exports',ts.transpileModule(prefix,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText)(require,loaded,loaded.exports);
const {setup,ids,client,core,api,load,React,act,NextRequest,mount,input,setTransport}=loaded.exports;
const actions=load('src/lib/community/experience-guide-actions-client.ts');
async function created(){const h=setup(),owner={},s=client.createCe012GuideCreatorV1({fetch:h.fetch,context_id:ids.context,workspace_id:ids.workspace,owner:()=>owner,denied:()=>{}});const guide=await s.create(input);return {h,guide,owner};}
function holder(x,version=1,owner=()=>x.owner){return actions.createCe012GuideActionsV1({fetch:(...a)=>x.h.fetch(...a),context_id:ids.context,workspace_id:ids.workspace,guide_id:x.guide,version,owner,denied:()=>{}});}
const only=process.argv.find(a=>a.startsWith('--case='))?.slice(7);let count=0;async function check(name,fn){if(only&&only!==name)return;await fn();console.log(`ok ${++count} - ${name}`);}
await check('actual create -> edit -> publish -> cancel -> versioned read through mounted Page EN/RO/FA',async()=>{for(const lang of ['en','ro','fa']){const h=setup(),ui=await mount(h,lang);window.confirm=()=>true;await ui.fill();
 const submit=async form=>act(async()=>{form.dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,45));});await submit(document.querySelector('form'));const current=()=>[...h.f.created.values()][0];assert.equal(current().version,1);
 await act(async()=>{const e=document.querySelector('form input');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(e,'Edited guide');e.dispatchEvent(new window.Event('input',{bubbles:true}));});await submit(document.querySelector('form'));assert.equal(current().version,2);assert.equal(current().title,'Edited guide');
 const actionBody=()=>[...document.querySelectorAll('button')].filter(b=>!b.closest('form'));
 await act(async()=>{actionBody()[0].click();await new Promise(r=>setTimeout(r,55));});assert.equal(current().version,3);assert.equal(current().status,'published');
 await act(async()=>{const e=document.querySelector('input[name="guide-cancel-reason"]');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(e,'Synthetic cancellation');e.dispatchEvent(new window.Event('input',{bubbles:true}));});
 await act(async()=>{actionBody()[0].click();await new Promise(r=>setTimeout(r,55));});assert.equal(current().version,4);assert.equal(current().status,'cancelled');assert.equal(actionBody().length,0);assert.ok(document.body.textContent.includes('Edited guide'));assert.equal(h.f.commits,4);await ui.close();}
});
await check('cancel draft directly; cancelled Guide cannot publish or cancel again',async()=>{const x=await created();await holder(x).run('cancel','Synthetic cancellation');const g=x.h.f.created.get(x.guide);assert.equal(g.status,'cancelled');assert.equal(g.version,2);for(const action of ['publish','cancel']){await assert.rejects(holder(x,2).run(action,'Synthetic cancellation'));assert.equal(g.version,2);}});
await check('lost reply and exact same-wire explicit replay preserve one lifecycle effect',async()=>{const x=await created(),original=x.h.fetch;let lost=true;x.h.fetch=async(...a)=>{const r=await original(...a);if(JSON.parse(a[1]?.body??'{}').op==='execute_lifecycle'&&lost){lost=false;throw Error('controlled lost reply');}return r;};const s=holder(x);const p=s.run('publish');assert.equal(s.run('publish'),p);await assert.rejects(p,e=>e.code==='UNKNOWN');const wire=x.h.wires.at(-1);await s.run('publish');assert.equal(x.h.wires.at(-1),wire);assert.equal(x.h.f.commits,2);assert.equal(x.h.f.created.get(x.guide).version,2);});
await check('stale version, revoke, malformed result and late owner cannot grant success',async()=>{for(const mode of ['stale','revoke','malformed','owner']){const x=await created(),original=x.h.fetch;let release,arrived;const at=new Promise(r=>{arrived=r;});let owner=x.owner;
 if(mode==='revoke')x.h.f.expireAtReservation=true;
 if(mode==='malformed')x.h.fetch=async(...a)=>{const r=await original(...a);return JSON.parse(a[1]?.body??'{}').op==='execute_lifecycle'?Response.json({outcome:'committed'}):r;};
 if(mode==='owner')x.h.fetch=async(...a)=>{const r=await original(...a);if(JSON.parse(a[1]?.body??'{}').op==='execute_lifecycle')await new Promise(resolve=>{release=resolve;arrived();});return r;};
 const s=holder(x,mode==='stale'?9:1,()=>owner),p=s.run('publish');if(mode==='owner'){await at;owner={};release();}await assert.rejects(p);assert.ok(s.isUncertain());if(mode==='stale'||mode==='revoke')assert.equal(x.h.f.commits,1);await assert.rejects(s.run('cancel'),e=>e.code==='UNKNOWN');}
});
await check('dirty editor blocks lifecycle; UNKNOWN locks editor and survives locale readback',async()=>{const h=setup(),ui=await mount(h);window.confirm=()=>true;await ui.fill();await act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,40));});
 await act(async()=>{const e=document.querySelector('form input');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(e,'Unsaved draft');e.dispatchEvent(new window.Event('input',{bubbles:true}));});const old=h.wires.length;
 const buttons=()=>[...document.querySelectorAll('button')].filter(b=>!b.closest('form'));await act(async()=>buttons()[0].click());assert.equal(h.wires.length,old);assert.ok(document.querySelector('[role="alert"]'));await ui.close();
 const h2=setup(),u2=await mount(h2);window.confirm=()=>true;await u2.fill();await act(async()=>{document.querySelector('form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,40));});
 const original=h2.fetch;let lost=true;h2.fetch=async(...a)=>{const r=await original(...a);if(JSON.parse(a[1]?.body??'{}').op==='execute_lifecycle'&&lost){lost=false;throw Error('lost');}return r;};;
 setTransport((...a)=>h2.fetch(...a));await u2.render('ro');
 await act(async()=>{buttons()[0].click();await new Promise(r=>setTimeout(r,45));});assert.ok(document.querySelector('[role="alert"]'));assert.equal(h2.f.commits,2);const wire=h2.wires.at(-1);
 await u2.render('fa');assert.equal(buttons().length,1);assert.ok(document.querySelector('form')); // creator only; published editor stays closed.
 await act(async()=>{buttons()[0].click();await new Promise(r=>setTimeout(r,45));});assert.equal(h2.wires.at(-1),wire);assert.equal(h2.f.commits,2);await u2.close();
});
await check('cancel requires the existing domain reason; publish does not acquire a new reason field',async()=>{const x=await created(),before=x.h.f.commits;for(const request of [
 {context_id:ids.context,workspace_id:ids.workspace,guide_id:x.guide,expected_version:1,operation:'cancel',idempotency_key:'ce-negative-reason-01'},
 {context_id:ids.context,workspace_id:ids.workspace,guide_id:x.guide,expected_version:1,operation:'publish',idempotency_key:'ce-negative-reason-02',reason:'Unexpected publisher reason'}]){
 const r=await x.h.fetch('/api/customer/v1/experience/guides/draft',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({op:'prepare_lifecycle',request})});assert.equal(r.status,400);}
 assert.equal(x.h.f.commits,before);await holder(x).run('cancel','  Synthetic cancellation  ');assert.equal(JSON.parse(x.h.wires.at(-1)).request.reason,'Synthetic cancellation');
});
await check('Core database expiry is rechecked after the lifecycle replay wait; UNKNOWN survives',async()=>{const x=await created(),original=x.h.fetch;let lost=true;
 x.h.fetch=async(...args)=>{const r=await original(...args);if(JSON.parse(args[1]?.body??'{}').op==='execute_lifecycle'&&lost){lost=false;throw Error('lost reply');}return r;};
 const s=holder(x);await assert.rejects(s.run('publish'),e=>e.code==='UNKNOWN');const wire=x.h.wires.at(-1),before=structuredClone(x.h.f.writes);x.h.f.expireDuringReplay=true;
 await assert.rejects(s.run('publish'),e=>e.code==='UNKNOWN');assert.ok(s.isUncertain());assert.equal(x.h.wires.at(-1),wire);assert.deepEqual(x.h.f.writes,before);assert.equal(x.h.f.commits,2);
});
console.log(JSON.stringify({task:'CE-GUIDE-NATIVE-01',groups:count,result:'PASS_CONTROLLED_PRODUCT_PATH',native_auth_pg_browser_restart:'NOT_RUN_NOT_PASS',old_suites:'NOT_RERUN'}));
