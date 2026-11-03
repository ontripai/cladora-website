/** Actual SERVICE09 handler/Core producer/Auth/PG. Node HTTP adapter is a test
 * boundary, not proof of a deployed Next route/browser or product activation.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import pg from 'pg';
import {createCore15NativeLoader} from './lib/core15-native-ts-loader.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),p='/workspace/private/cladora-functional-dev-v1',read=x=>JSON.parse(readFileSync(p+'/'+x));
execFileSync('python3',['-I','-B','-c',"import importlib.util;from pathlib import Path;p=Path('/workspace/work/platform12-core15-input-794f5a1/scripts/functional-dev-stack-v1/stack.py');s=importlib.util.spec_from_file_location('p12',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.state();m.cid('pg');m.gateway_process()"],{stdio:'pipe'});
const secret=read('secrets.json'),runtimeSecret=read('core15/runtime-secret.json'),installerSecret=read('core15/service-native-v2/installer-secret.json'),descriptor=read('descriptor.json'),fixture=read('core15/service-fixture-private.json'),mfa=read('core15/service-mfa-private.json');
assert.equal(fixture.state,'ADMIN_FIXTURE_COMMIT_RFQ_I');assert.equal(mfa.state,'TWO_REAL_SYNTHETIC_AAL2_SESSIONS');
const afterOrigin=process.argv[2]==='--after-origin-rejection',diagnose=process.argv[2]==='--diagnose-known-rollback',afterVersion=process.argv[2]==='--after-version-prerequisite',continueCommitted=process.argv[2]==='--continue-committed';assert.equal(process.argv.length,afterOrigin||diagnose||afterVersion||continueCommitted?3:2);
if(afterOrigin){const old=read('core15/service-first-native-proof.json');assert.equal(old.state,'FAILED_OR_UNKNOWN_STOP');assert.equal(old.first.value.error.code,'INVALID_ORIGIN');assert.equal(old.hostCommands.length,0);assert.equal(old.hostResults.length,0);}
if(diagnose){const old=read('core15/service-first-native-proof-canonical-origin.json');assert.equal(old.hostResults.length,1);assert.equal(old.hostResults[0].status,'denied');assert.equal(old.hostResults[0].code,'TRANSACTION_FAILED');assert.ok(old.wire.some(x=>x.tag==='ROLLBACK'));assert.equal(old.wire.some(x=>x.tag==='COMMIT'),false);assert.equal(old.wire.at(-1).status,'I');}
if(afterVersion){const old=read('core15/service-first-native-proof-diagnostic-rollback.json');assert.equal(old.hostResults[0].status,'denied');assert.equal(old.wire.some(x=>x.tag==='COMMIT'),false);assert.equal(old.wire.at(-1).status,'I');assert.ok(old.errors.some(x=>x.code==='42703'&&x.message==='column "version" of relation "requests" does not exist'));assert.equal(read('core15/service-domain-v1/request-version-committed.json').state,'COMMIT_AND_RFQ_I');}
const committedParent=continueCommitted?read('core15/service-first-native-proof-version-prerequisite.json'):null;
if(committedParent){assert.equal(committedParent.first.status,200);assert.equal(committedParent.hostResults.length,1);assert.equal(committedParent.hostResults[0].status,'committed');assert.ok(committedParent.wire.some(x=>x.tag==='COMMIT'));}
const evidencePath=p+'/core15/service-first-native-proof'+(afterOrigin?'-canonical-origin':diagnose?'-diagnostic-rollback':afterVersion?'-version-prerequisite':continueCommitted?'-committed-continuation':'')+'.json';assert.equal(existsSync(evidencePath),false,'STOP existing proof dispatch; inspect, never blindly repeat');
process.env.NODE_ENV='test';process.env.NEXT_PUBLIC_CLADORA_EPHEMERAL_LOCAL_SUPABASE='1';process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:55421';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=secret.anon_key;
const consumer='4c3abd7c26d8ae393fdb6acb3f88330c7b887097',httpPath='src/lib/customer/service-v14-execution/http.ts';
const loader=createCore15NativeLoader(root,{[httpPath]:consumer});const core=loader.load('src/lib/core/service-functional-binding-v1.ts');
const http=loader.load(httpPath),{NextRequest}=createRequire(import.meta.url)('next/server');
const wire=[],hostResults=[],hostCommands=[],errors=[],checks={};
const pool=new pg.Pool({host:'127.0.0.1',port:55422,database:'postgres',user:'cladora_core_runtime',password:runtimeSecret.password,max:4,connectionTimeoutMillis:5000,query_timeout:15000});
pool.on('connect',c=>{c.connection.on('commandComplete',e=>wire.push({pid:c.processID,tag:e.text}));c.connection.on('readyForQuery',e=>wire.push({pid:c.processID,status:e.status}));
 const query=c.query.bind(c);c.query=(...args)=>{const pending=query(...args);return pending?.catch?pending.catch(e=>{noteError('driver:'+createHash('sha256').update(String(args[0])).digest('hex'),e);throw e;}):pending;};
});
pool.on('error',e=>errors.push({phase:'pool',code:e.code??'DRIVER_ERROR'}));
const observer=new pg.Pool({host:'127.0.0.1',port:55422,database:'postgres',user:'cladora_core_installer',password:installerSecret.password,max:2,connectionTimeoutMillis:5000,query_timeout:10000});
const target={contract:'core-functional-development-target.v1',backend_id:'core15-dev:'+descriptor.instance,purpose:'owned-isolated-persistent-development',host:'127.0.0.1',port:55422,database_name:'postgres',database_oid:Number(read('core15/session-bootstrap-receipt.json').database_oid),runtime_role:'cladora_core_runtime',auth_origin:'http://127.0.0.1:55421'};
const binding=core.createCoreServiceFunctionalBindingV1({pool,target});
const evidence={contract:'core15-service-first-native-proof.v1',state:'DISPATCHED_NO_RETRY',phase:'init',consumer,checks,hostResults,hostCommands,errors,wire};
if(committedParent){hostResults.push(committedParent.hostResults[0]);hostCommands.push(committedParent.hostCommands[0]);wire.push(...committedParent.wire);evidence.parent_receipt_sha256=createHash('sha256').update(readFileSync(p+'/core15/service-first-native-proof-version-prerequisite.json')).digest('hex');evidence.prior_commit='REQUIRES_DB_READBACK_BELOW; no fresh command issued';checks.real_http_preflight_zero_write=committedParent.checks.real_http_preflight_zero_write;}
const save=()=>writeFileSync(evidencePath,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});save();
function noteError(phase,e){errors.push({phase,code:e.code??e.name,message:e.message,stack:e.stack});save();}
const handlers=http.createServiceOfferingRequestFlowHandlers(async req=>{
 try{const ports=await binding.bind(req);if(!ports)return null;const watched={...ports};
  for(const name of ['loadOffering','resolvePrincipal','resolveProviderAgreement','resolveCanonicalResource'])watched[name]=async(...args)=>{try{return await ports[name](...args);}catch(e){noteError(name,e);throw e;}};
  watched.host={async execute(...args){hostCommands.push(structuredClone(args[0]));save();const original=args[1],instrumented={...original};
   for(const method of ['validateProviders','validateReplay','mutate'])if(typeof original[method]==='function')instrumented[method]=async(...values)=>{try{return await original[method](...values);}catch(e){noteError('provider:'+method,e);throw e;}};
   const r=await ports.host.execute(args[0],instrumented);hostResults.push(structuredClone(r));save();return r;}};
  return watched;
 }catch(e){noteError('bind',e);throw e;}
});
const server=createServer(async(req,res)=>{try{const chunks=[];let size=0;for await(const b of req){size+=b.length;if(size>32768)throw Error('HTTP_BODY_BOUND');chunks.push(b);}const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(v!==undefined)headers.set(k,Array.isArray(v)?v.join('; '):v);
 const r=new NextRequest('http://127.0.0.1:'+server.address().port+req.url,{method:req.method,headers,...(req.method==='POST'?{body:Buffer.concat(chunks)}:{})});
 const response=await handlers[req.method](r);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 }catch(e){noteError('HTTP',e);res.writeHead(500,{'content-type':'application/json','cache-control':'no-store'});res.end('{"error":{"code":"TRUSTED_FAILURE"}}');}});
await new Promise((yes,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',yes);});
// NextURL canonicalizes loopback hosts to localhost. Use its actual canonical
// origin in the client; do not weaken SERVICE's origin rejection.
const base='http://localhost:'+server.address().port+'/api/customer/v1/services/offering-request-flow';
const input={context_id:fixture.contexts[0],workspace_id:fixture.workspaces[0],offering_id:fixture.offering,published_revision_id:fixture.revision};
const body={...input,beneficiary_party_id:fixture.beneficiaries[0],resource:null,description:'Synthetic Core15 non-binding service request',idempotency_key:'core15_first_native_exact_key_v1'};
async function call(method,data,cookie=mfa.users[0].cookie){const response=await fetch(method==='GET'?base+'?'+new URLSearchParams(data):base,{method,headers:{cookie,...(method==='POST'?{'content-type':'application/json','origin':new URL(base).origin}:{})},...(method==='POST'?{body:JSON.stringify(data)}:{})});const value=await response.json();return{status:response.status,value};}
async function counts(){const x=await observer.query("select (select count(*)::int from service_catalog.requests) requests,(select count(*)::int from platform.idempotency_keys where key like 'core-tx.v1:%') c03");return x.rows[0];}
try{
 let first;
 if(committedParent){assert.deepEqual(await counts(),{requests:1,c03:1});first=committedParent.first;evidence.phase='existing_commit_readback';}
 else{
  assert.deepEqual(await counts(),{requests:0,c03:0});evidence.phase='real_http_preflight';save();
  const pre=await call('GET',input);evidence.preflight=pre;save();assert.equal(pre.status,200);assert.equal(pre.value.status,'ready');assert.deepEqual(await counts(),{requests:0,c03:0});checks.real_http_preflight_zero_write=true;
  evidence.phase='real_http_create_request';save();first=await call('POST',body);
 }
 evidence.first=first;save();assert.equal(first.status,200);assert.equal(first.value.status,'submitted');assert.deepEqual(Object.keys(first.value).sort(),['request_id','status']);
 assert.equal(hostResults.at(-1).status,'committed');const receipt=hostResults.at(-1).receipt;assert.equal(receipt.aggregate_id,first.value.request_id);assert.deepEqual(await counts(),{requests:1,c03:1});checks.actual_request_and_c03_committed=true;
 const ack=wire.find(x=>x.tag==='COMMIT');assert.ok(ack);assert.ok(wire.some(x=>x.pid===ack.pid&&x.status==='I'));checks.commit_same_backend_readyforquery_I=true;
 const stored=await observer.query('select actor_id::text,request_hash,response_ref from platform.idempotency_keys where tenant_id=$1 and key=$2',[fixture.tenants[0],'core-tx.v1:'+fixture.workspaces[0]+':'+body.idempotency_key]);assert.equal(stored.rowCount,1);assert.equal(stored.rows[0].actor_id,fixture.actors[0]);assert.deepEqual(stored.rows[0].response_ref,receipt);
 const domain=await observer.query('select requester_id::text,workspace_id::text,description from service_catalog.requests where id=$1',[receipt.aggregate_id]);assert.equal(domain.rowCount,1);assert.deepEqual(domain.rows[0],{requester_id:fixture.actors[0],workspace_id:fixture.workspaces[0],description:body.description});
 const audit=await observer.query('select count(*)::int n from audit.events where id=$1 and tenant_id=$2 and actor_id=$3',[receipt.audit_event_id,fixture.tenants[0],fixture.actors[0]]);assert.equal(audit.rows[0].n,1);
 const outbox=await observer.query('select count(*)::int n from platform.outbox_events where id=$1 and tenant_id=$2',[receipt.outbox_event_id,fixture.tenants[0]]);assert.equal(outbox.rows[0].n,1);checks.stored_canonical_receipt_audit_outbox_readback=true;
 evidence.phase='same_key_exact_replay';save();const replay=await call('POST',body);evidence.replay=replay;save();assert.equal(replay.status,200);assert.deepEqual(Object.keys(replay.value).sort(),['request_id','status']);assert.equal(replay.value.request_id,first.value.request_id);assert.equal(hostResults.at(-1).status,'exact_replay');assert.equal(hostResults.at(-1).receipt.receipt_id,receipt.receipt_id);assert.deepEqual(await counts(),{requests:1,c03:1});checks.exact_replay_one_effect=true;
 const conflict=await call('POST',{...body,description:body.description+' CHANGED'});evidence.conflict=conflict;assert.notEqual(conflict.status,200);assert.deepEqual(await counts(),{requests:1,c03:1});checks.changed_body_not_a_new_effect=true;
 for(const negative of [await call('GET',{...input,workspace_id:fixture.workspaces[1]}),await call('GET',input,mfa.users[1].cookie)])assert.notEqual(negative.status,200);
 assert.deepEqual(await counts(),{requests:1,c03:1});checks.foreign_scope_and_actor_no_effect=true;
 evidence.state='PASS_INITIAL_REAL_SERVICE_API_DB_CUT';evidence.phase='restart_concurrency_unknown_still_NOT_RUN';save();
 console.log(JSON.stringify({state:evidence.state,checks,receipt_sha256:createHash('sha256').update(readFileSync(evidencePath)).digest('hex'),restart_concurrency_unknown:'NOT_RUN_NOT_PASS',next_deployed_route_browser:'NOT_RUN_NOT_PASS'}));
}catch(e){noteError(evidence.phase,e);evidence.state='FAILED_OR_UNKNOWN_STOP';save();console.error(JSON.stringify({state:evidence.state,phase:evidence.phase,error_code:e.code??e.name,private_diagnostic:true}));process.exitCode=1;}
finally{await new Promise(r=>server.close(r));await pool.end();await observer.end();}
