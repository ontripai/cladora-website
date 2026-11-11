/** New v2 API candidate only. Actual TS handler/adapter/schema + existing domain
 * MODEL as an explicit SQL/RPC substitute. No PostgreSQL/Auth/native proof. */
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire,Module} from 'node:module';
import {resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
const require=createRequire(import.meta.url),root=resolve(new URL('..',import.meta.url).pathname);
assert.equal(require('next/package.json').version,'16.4.1');assert.equal(require('zod/package.json').version,'4.6.6');
globalThis.fetch=async()=>{throw Error('OUTBOUND_FORBIDDEN');};
const id=n=>`01100000-0000-4000-8000-${String(n).padStart(12,'0')}`;
function harness({configured=true}={}){
 const s={actor:id(1),sid:id(2),exp:4070908800,aal:'aal1',permissions:['events.event.publish','events.event.cancel','events.interest.manage_self','events.attendance.record','events.attendance.correct'],calls:[],authCalls:0,invalid:false,tamper:null,lost:false,bad:false,wait:null,requests:[],scope:null},cache=new Map();let model,state;
 const sdk={auth:{getUser:async()=>{s.authCalls++;return{data:{user:{id:s.actor}},error:s.invalid?Error('private'):null};},getSession:async()=>({data:{session:{user:{id:s.actor},expires_at:s.exp}},error:null}),getClaims:async()=>({data:{claims:{sub:s.actor,session_id:s.sid,exp:s.exp,aal:s.aal,role:'authenticated'}},error:null}),mfa:{getAuthenticatorAssuranceLevel:async()=>({data:{currentLevel:s.aal},error:null})}}};
 const rpc={async rpc(name,args){assert.equal(name,'command_ce_event_v2');assert.ok(Object.isFrozen(args.p_request));if('audience'in args.p_request)assert.ok(Object.isFrozen(args.p_request.audience));s.calls.push({name,args,wire:JSON.stringify(args.p_request)});
  await s.wait?.();if(s.forceError)return{data:null,error:s.forceError};const c=args.p_request,a={tenant_id:id(3),context_id:c.context_id,actor_user_id:s.actor,membership_id:id(4),represented_party_id:null,workspace_id:c.workspace_id,membership_active:true,capability_active:true,capability_code:'ce.event.basic',module_code:'community_events',audience_policy_id:id(5),audience_policy_version:1,audience_result:'eligible',assurance_level:s.aal,evaluated_at:'2026-11-11T00:00:00Z',role_codes:[],permissions:s.permissions};
  const target={membership_id:id(4),workspace_id:c.workspace_id,role_codes:[],membership_active:true};
  const before=state,r=model.applyEventCommand(state,c,a,'2026-11-11T00:00:00Z',target);
  if(!r.ok){assert.equal(r.state,before);return{data:null,error:{code:(r.code.includes('VERSION')||r.code==='INVALID_STATE')?'40001':r.code.includes('IDEMPOTENCY')||r.code==='DUPLICATE_INTEREST'?'23505':'42501',message:'PRIVATE'}};}
  state=r.state;
  if(s.lost){s.lost=false;throw Error('controlled lost reply after modeled commit');}
  const entity=['create_event','publish_event','cancel_event'].includes(c.type)?'event':['register_interest','withdraw_interest'].includes(c.type)?'event_interest':'event_attendance';
  const entityId=entity==='event'?c.event_id:entity==='event_interest'?id(70):c.type==='correct_attendance'?c.attendance_id:c.command_id;
  return{data:{entity_type:entity,entity_id:entityId,version:s.bad?999:r.version,command:c.type,replayed:r.replayed},error:null};
 }};
 const runtime={resolve:configured?async(request,scope)=>{s.requests.push(request);s.scope=scope;const b={contract:'ce011-request-rpc-binding.v2',request,actor_id:s.actor,session_id:s.sid,expires_at:s.exp,context_id:scope.context_id,workspace_id:scope.workspace_id,command_rpc:rpc};if(s.tamper)b[s.tamper]=s.tamper==='request'?new Request(request.url):id(99);return b;}:null};
 function load(p){p=resolve(root,p);if(cache.has(p))return cache.get(p).exports;
  if(p.endsWith('src/lib/supabase/server.ts'))return{createClient:async()=>sdk};
  if(p.endsWith('src/lib/community/event-command-runtime-v2.ts'))return{CE011_EVENT_RUNTIME_V2:runtime};
  const m=new Module(p);cache.set(p,m);m.require=n=>{if(n==='server-only')return{};if(n.startsWith('.')||n.startsWith('@/')){let q=n.startsWith('@/')?resolve(root,'src',n.slice(2)):resolve(dirname(p),n);if(!/\.(ts|json)$/.test(q))q+='.ts';return q.endsWith('.json')?JSON.parse(readFileSync(q,'utf8')):load(q);}return require(n);};
  m._compile(ts.transpileModule(readFileSync(p,'utf8'),{fileName:p,compilerOptions:{module:1,target:9,jsx:4,esModuleInterop:true}}).outputText,p);return m.exports;}
 model=load('src/lib/community/event-interest-domain.ts');state=model.emptyCe011State();
 const route=load('src/app/api/customer/v1/community/events/command/route.ts');
 const cmd=(type,n=1,extra={})=>({type,command_id:id(100+n),idempotency_key:'ce011.v2.original.'+n,context_id:id(6),workspace_id:id(7),event_id:id(8),expected_version:1,reason:'Synthetic explicit reason',...extra});
 const create=()=>cmd('create_event',1,{expected_version:0,occurrence_id:id(9),title:'Synthetic basic event',starts_at:'2027-01-01T10:00:00Z',ends_at:'2027-01-01T11:00:00Z',timezone:'Europe/Bucharest',audience:{kind:'workspace'}});
 const request=(body,options={})=>new (require('next/server').NextRequest)('https://ce.test/api/customer/v1/community/events/command',{method:'POST',headers:{origin:'https://ce.test','content-type':'application/json',...options.headers},body:typeof body==='string'?body:JSON.stringify(body),signal:options.signal});
 const post=c=>route.POST(request(c));return{s,load,route,cmd,create,post,request,get state(){return state;}};
}
const only=process.argv.find(x=>x.startsWith('--case='))?.slice(7);let n=0;async function check(name,fn){if(only&&!name.includes(only))return;await fn();console.log('PASS '+(++n)+' '+name);}
await check('actual v2 route/adapter seven-action lifecycle with separate correction after cancellation',async()=>{
 const h=harness();const commands=[h.create(),h.cmd('publish_event',2),h.cmd('register_interest',3,{expected_version:2,expected_interest_version:0}),h.cmd('withdraw_interest',4,{expected_version:2,expected_interest_version:1}),h.cmd('record_attendance',5,{expected_version:2,target_membership_id:id(4),observed_local:'2027-01-01T10:15',timezone:'Europe/Bucharest'}),h.cmd('cancel_event',6,{expected_version:2})];
 for(const c of commands){const request=h.request(c),r=await h.route.POST(request);assert.equal(r.status,200,JSON.stringify(await r.clone().json()));assert.equal(h.s.requests.at(-1),request);assert.equal(h.s.scope.module_code,'community_events');assert.match(r.headers.get('cache-control'),/no-store, private/);}
 const correction=h.cmd('correct_attendance',7,{expected_version:3,attendance_id:id(105),expected_attendance_version:1,attended:false,observed_local:'2027-01-01T10:20',timezone:'Europe/Bucharest'});
 h.s.permissions=['events.attendance.record'];assert.equal((await h.post(correction)).status,403);assert.equal(h.state.attendance[id(105)].version,1);
 h.s.permissions=['events.attendance.correct'];assert.equal((await h.post(correction)).status,200);assert.equal(h.s.scope.permission_code,'events.attendance.correct');assert.equal(h.state.attendance[id(105)].version,2);assert.equal(h.state.events[id(8)].status,'cancelled');assert.equal(h.state.audits.length,7);
});
await check('new API lost reply preserves existing session UNKNOWN and same-wire explicit replay one effect',async()=>{
 const h=harness();h.s.lost=true;const client=h.load('src/lib/community/event-interest-client.ts'),calls=[];const owner={};
 const session=client.createEventCommandSession({contextId:id(6),workspaceId:id(7),owner:()=>owner,onState(){},accepted(){},denied(){},fetch:async(_url,init)=>{calls.push(init.body);return h.route.POST(h.request(init.body));}});
 assert.equal(await session.send(h.create()),false);assert.equal(session.getState().phase,'unknown');assert.equal(h.state.audits.length,1);const pending=session.getState().pending;
 assert.equal(await session.send(h.cmd('publish_event',9)),false);assert.equal(calls.length,1);assert.equal(session.getState().pending,pending);
 assert.equal(await session.replay(),true);assert.equal(calls[1],calls[0]);assert.equal(h.state.audits.length,1);assert.equal(session.getState().receipt.replayed,true);
});
await check('version and same-key tamper denied without extra modeled effects',async()=>{
 const h=harness();assert.equal((await h.post(h.create())).status,200);const before=h.state;
 assert.equal((await h.post({...h.create(),title:'Changed same key'})).status,409);assert.equal(h.state,before);
 assert.equal((await h.post(h.cmd('publish_event',2,{expected_version:9}))).status,409);assert.equal(h.state,before);
 h.s.permissions=[];assert.equal((await h.post(h.cmd('publish_event',2))).status,403);assert.equal(h.state,before);
});
await check('missing binding and malformed binding tuple fail closed with zero command RPC',async()=>{
 const h=harness({configured:false});assert.equal((await h.post(h.create())).status,503);assert.equal(h.s.calls.length,0);
 for(const field of ['request','actor_id','session_id','context_id','workspace_id','expires_at']){const x=harness();x.s.tamper=field;assert.equal((await x.post(x.create())).status,403);assert.equal(x.s.calls.length,0);}
});
await check('strict command, origin and issuer guards precede dispatch',async()=>{
 const h=harness();for(const key of ['actor_id','tenant_id','permission_code','hash'])assert.equal((await h.post({...h.create(),[key]:'client proof'})).status,400);
 assert.equal((await h.route.POST(h.request(h.create(),{headers:{origin:'https://other.test'}}))).status,403);
 h.s.invalid=true;assert.equal((await h.post(h.create())).status,401);assert.equal(h.s.calls.length,0);
});
await check('malformed success and late abort are UNKNOWN, not definite failure or new command',async()=>{
 const h=harness();h.s.bad=true;assert.equal((await h.post(h.create())).status,202);assert.equal(h.state.audits.length,1);
 const x=harness(),abort=new AbortController();x.s.wait=()=>abort.abort();const r=await x.route.POST(x.request(x.create(),{signal:abort.signal}));assert.equal(r.status,202);assert.equal((await r.json()).outcome,'unknown');assert.equal(x.s.calls.length,1);
});
await check('adapter keeps original40001 object and never retries or exposes raw error',async()=>{
 const h=harness(),adapter=h.load('src/lib/community/event-command-persistence-v2.ts'),driver=Object.assign(Error('PRIVATE_DRIVER_TEXT'),{code:'40001'});let calls=0;
 await assert.rejects(adapter.executeCe011EventCommandV2({command_rpc:{rpc:async()=>{calls++;return{data:null,error:driver};}}},adapter.snapshotEventCommandV2(h.create())),e=>e===driver);assert.equal(calls,1);
 h.s.permissions=[];const r=await h.post(h.create());assert.equal(r.status,403);assert.doesNotMatch(JSON.stringify(await r.json()),/PRIVATE/);
});
await check('SQL source reuses exact canonical key/hash and atomic effects, adds fresh postwait/replay guards',async()=>{
 const old=readFileSync('supabase/proposals/ce_011_event_interest_operational_v1.sql','utf8'),sql=readFileSync('supabase/proposals/ce011-basic-event-command-v2/command.sql','utf8');
 for(const prefix of [' v_key:=',' v_hash:='])assert.equal(sql.split('\n').find(x=>x.startsWith(prefix)),old.split('\n').find(x=>x.startsWith(prefix)));
 assert.equal((sql.match(/insert into community\.event_command_receipts\(/g)||[]).length,1);assert.equal((sql.match(/insert into audit\.events\(/g)||[]).length,1);assert.equal((sql.match(/insert into platform\.outbox_events\(/g)||[]).length,1);
 assert.ok(sql.indexOf("RAISE EXCEPTION 'ce011_v2_source_only_no_admission'")<sql.indexOf('create function'));
 assert.ok(!/\bGRANT\b/.test(sql));assert.ok(!/statement_timestamp\(\)/.test(sql));assert.ok(sql.includes('check_workspace_native_permission_v2_at_v1'));
 const at=sql.indexOf('return v_response;'),last=sql.lastIndexOf('ce_event_current_authority_denied',at);assert.ok(last>sql.indexOf('update platform.idempotency_keys'));
 const replay=sql.indexOf('return v_receipt.response_json'),prior=sql.lastIndexOf('ce_event_current_authority_denied',replay);assert.ok(prior>sql.indexOf('if v_idem.response_ref is not null'));
 const output=resolve(mkdtempSync(resolve(tmpdir(),'ce011-v2-')),'command.sql');execFileSync(process.execPath,['scripts/build-ce011-basic-command-v2.mjs','--output='+output]);assert.equal(readFileSync(output,'utf8'),sql);
 assert.equal(createHash('sha256').update(old).digest('hex'),'5894363db4fa0fee49737371546e9cd1cbeddb2dcc44723a81cca396004feafc');
});
await check('state-machine gap: cancel draft is rejected exactly like existing SQL contract',async()=>{
 const h=harness();assert.equal((await h.post(h.create())).status,200);const before=h.state;
 assert.equal((await h.post(h.cmd('cancel_event',40))).status,409);assert.equal(h.state,before);assert.equal(h.state.events[id(8)].status,'draft');assert.equal(h.state.audits.length,1);
 const source=readFileSync('supabase/proposals/ce_011_event_interest_operational_v1.sql','utf8');assert.ok(source.includes("v_command='cancel_event' and v_event.status<>'published'"));
});
await check('canonical not-found rollback is bounded404, no replay/fallback or raw row',async()=>{
 const h=harness();h.s.forceError={code:'P0002',message:'PRIVATE_ROW'};const r=await h.post(h.cmd('publish_event',90));assert.equal(r.status,404);assert.deepEqual(await r.json(),{error:{code:'CE_EVENT_NOT_FOUND'}});assert.equal(h.s.calls.length,1);assert.equal(h.state.audits.length,0);
});
await check('binding with missing executable RPC port is NOT_READY before dispatch',async()=>{
 const h=harness();h.s.tamper='command_rpc';const r=await h.post(h.create());assert.equal(r.status,503);assert.equal(h.s.calls.length,0);assert.deepEqual(await r.json(),{error:{code:'CE_EVENT_CONNECTION_NOT_READY'}});
});
console.log(JSON.stringify({groups:n,proof:'ACTUAL_API_AND_ADAPTER_WITH_EXPLICIT_DOMAIN_MODEL_RPC_SUBSTITUTE_PLUS_SQL_SOURCE_CHECKS',SQL_compile:'NOT_RUN',PostgreSQL_Auth_native:'NOT_RUN_NOT_PASS',old_suites_run:false}));
