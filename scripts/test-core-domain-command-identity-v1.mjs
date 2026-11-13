/** New actual-module coupling with controlled PG/Auth transports. No native claim. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve,dirname,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
// Reuse the accepted controlled transport SETUP ONLY, never its test cases.
const url=new URL('./test-core-functional-runtime-v1.mjs',import.meta.url);
const old=readFileSync(url,'utf8');
const prefix=old.slice(old.indexOf('const original='),old.indexOf('\nlet n=0;')).replace("new URL('./test-core-ce012-replay-joint-seal-13.mjs',import.meta.url)","new URL('./test-core-ce012-replay-joint-seal-13.mjs',setupUrl)");
const {fixture,runtimeModule,SQL,id,auth,target,env,provider,next}=new Function('assert','readFileSync','execFileSync','createRequire','resolve','dirname','extname','fileURLToPath','ts','setupUrl',prefix+'\nreturn{fixture,runtimeModule,SQL,id,auth,target,env,provider,next};')
 (assert,readFileSync,execFileSync,createRequire,resolve,dirname,extname,fileURLToPath,ts,url.href);
const selected={context_id:id(4),workspace_id:id(3),permission_code:'services.catalog.manage',module_code:'services_catalog'};
const adapter=env.load('src/lib/core/service-authoring-identity-port-v1.ts');
let n=0;
async function check(name,fn){await fn();console.log(`PASS ${++n} ${name}`);}
async function setup(){
 const x=await fixture();x.releases=0;x.resolutions=0;x.identities=[];
 const connect=x.f.pool.connect.bind(x.f.pool);
 x.f.pool.connect=async()=>{
  const c=await connect(),q=c.query.bind(c),release=c.release.bind(c);
  c.release=(destroy)=>{x.releases++;return release(destroy);};
  c.query=async(text,values=[])=>{
   if(text===SQL.resolve){x.resolutions++;if(x.resolutions===2&&x.drift)return{rows:[{workspace_id:id(3),tenant_id:x.drift==='tenant'?id(999):id(2),membership_id:x.drift==='membership'?id(999):id(6)}],rowCount:1};}
   if(text===SQL.checkpoint){x.identities.push(values);if(x.lastDeny&&x.identities.length>=5)throw x.lastDeny;}
   if(text.startsWith('select pg_backend_pid() as backend_pid,to_char(')){
    x.clockReads=(x.clockReads??0)+1;if(x.badClock&&x.clockReads===2)return{rows:[{backend_pid:999,at:x.f.now}],rowCount:1};
   }
   if(text==='rollback'&&x.badRollback)return{command:'COMMIT',rows:[],rowCount:0};
   return q(text,values);
  };return c;
 };
 return x;
}
function noEffects(x){assert.equal(x.calls.some(sql=>/^\s*(?:insert|update|delete|commit)\b/i.test(sql)),false);assert.equal(x.calls.some(sql=>/idempotency_keys|outbox_events|audit\.events|pg_advisory_xact_lock/i.test(sql)),false);}
await check('real runtime returns server actor/full tuple/revision, rollback only, frozen non-authority',async()=>{
 const x=await setup(),r=await x.runtime().resolveCommandIdentity(selected);
 assert.equal(r.actor_id,auth.user.id);assert.equal(r.tenant_id,id(2));assert.equal(r.membership_id,id(6));assert.equal(r.workspace_id,id(3));assert.equal(r.authority_version,1);
 assert.equal(r.action_authorization,'not_evaluated');assert.equal(r.reusable_as_authority,false);assert.ok(Object.isFrozen(r));
 assert.equal(x.calls.at(-1).startsWith('select pg_backend_pid()'),true);assert.equal(x.calls.filter(x=>x==='rollback').length,1);assert.equal(x.releases,1);noEffects(x);
});
await check('actual server adapter maps only domain-approved manage/publish operations',async()=>{
 for(const action of ['create_offering','submit','publish','suspend','archive']){const x=await setup();const p=adapter.createCoreServiceAuthoringIdentityPortV1({pool:x.f.pool,target,request:new Request('http://localhost')});
  const r=await p.resolve({context_id:selected.context_id,workspace_id:selected.workspace_id,action});assert.equal(r.permission_code,action==='publish'?'services.catalog.publish':'services.catalog.manage');assert.ok(x.identities.every(v=>v[2]===r.permission_code&&v[3]==='services_catalog'));noEffects(x);}
});
await check('caller actor/tenant/allow/unknown action never reaches checkout',async()=>{
 for(const extra of [{actor_id:id(99)},{tenant_id:id(99)},{allow:true},{permission_code:'services.orders.request'}]){const x=await setup();await assert.rejects(x.runtime().resolveCommandIdentity({...selected,...extra}));assert.equal(x.calls.length,0);}
 const x=await setup(),p=adapter.createCoreServiceAuthoringIdentityPortV1({pool:x.f.pool,target,request:new Request('http://localhost')});await assert.rejects(p.resolve({context_id:id(4),workspace_id:id(3),action:'quote'}));assert.equal(x.calls.length,0);
});
await check('AAL1 and invalid session cannot disclose identity or reserve command',async()=>{
 const x=await setup();auth.claims.aal='aal1';await assert.rejects(x.runtime().resolveCommandIdentity(selected));noEffects(x);
 const y=await setup();y.sessionDenied=true;await assert.rejects(y.runtime().resolveCommandIdentity(selected));assert.equal(y.calls.includes(SQL.resolve),false);noEffects(y);
});
await check('foreign Workspace is rejected by canonical resolver, zero effects',async()=>{
 const x=await setup();await assert.rejects(x.runtime().resolveCommandIdentity({...selected,workspace_id:id(99)}));noEffects(x);
});
await check('tenant/membership drift cannot relabel the authenticated lease',async()=>{
 for(const drift of ['tenant','membership']){const x=await setup();x.drift=drift;await assert.rejects(x.runtime().resolveCommandIdentity(selected),e=>e.code==='SCOPE_DENIED');noEffects(x);}
});
await check('final canonical denial after intervening reads returns no identity',async()=>{
 const x=await setup();x.lastDeny=Object.assign(new Error('synthetic final revoke'),{code:'42501'});await assert.rejects(x.runtime().resolveCommandIdentity(selected),e=>e===x.lastDeny);assert.equal(x.calls.includes('rollback'),true);noEffects(x);
});
await check('40001 original object is retained, no new retry engine',async()=>{
 const x=await setup();x.checkpointFault=Object.assign(new Error('synthetic serial conflict'),{code:'40001'});await assert.rejects(x.runtime().resolveCommandIdentity(selected),e=>e===x.checkpointFault);assert.equal(runtimeModule.coreFunctionalReadFailureV1(x.checkpointFault).settlement,'rolled_back');assert.equal(x.releases,1);noEffects(x);
});
await check('unknown rollback and mismatched completed clock never release identity',async()=>{
 for(const kind of ['badRollback','badClock']){const x=await setup();x[kind]=true;await assert.rejects(x.runtime().resolveCommandIdentity(selected));noEffects(x);}
});
await check('aborted request adapter does not checkout or reuse an older identity',async()=>{
 const x=await setup(),abort=new AbortController(),p=adapter.createCoreServiceAuthoringIdentityPortV1({pool:x.f.pool,target,request:new Request('http://localhost',{signal:abort.signal})});abort.abort();await assert.rejects(p.resolve({context_id:id(4),workspace_id:id(3),action:'publish'}));assert.equal(x.calls.length,0);
});
await check('affected original C03 host still commits/replays one controlled effect',async()=>{
 const x=await setup(),r=x.runtime(),fresh=next(x),p=provider(fresh.guide);assert.equal((await r.host.execute(fresh.cmd,p)).status,'committed');const before=structuredClone(x.f.writes);assert.equal((await r.host.execute(fresh.cmd,p)).status,'exact_replay');assert.deepEqual(x.f.writes,before);
});
await check('affected original Request read keeps rollback/no-write semantics',async()=>{
 const x=await setup(),before=structuredClone(x.f.writes),r=await x.runtime().withRequestScope({context_id:id(4),workspace_id:id(3),offering_id:id(70)},async()=>({controlled:'read'}));assert.deepEqual(r.value,{controlled:'read'});assert.deepEqual(x.f.writes,before);assert.equal(x.calls.includes('commit'),false);
});
console.log(JSON.stringify({task:'CORE-DOMAIN-PORTS-01/R0',groups:n,transport:'CONTROLLED',native:'NOT_RUN_NOT_PASS',Request_acceptance:'NOT_REPEATED'}));
