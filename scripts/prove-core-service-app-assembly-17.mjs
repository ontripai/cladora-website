/** Real production Next + existing owned Auth/PG. No fake success/provider. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {loadInstallerCredentialBindingV1,installerTargetV1,readOwnedInstallerFileV1} from './lib/core-installer-credential-binding-v1.mjs';
const continued=process.argv[4]==='--after-canonical-compatibility';assert.equal(process.argv.length,continued?5:4);
const p='/workspace/private/cladora-functional-dev-v1',read=n=>JSON.parse(readFileSync(p+'/'+n)),file=p+(continued?'/core17-proof-after-compatibility-private.json':'/core17-proof-private.json');
if(continued){const old=read('core17-proof-private.json');assert.equal(old.phase,'catalog');assert.equal(old.catalog.status,403);assert.equal(old.created,undefined);assert.equal(read('core17-catalog-compatibility-receipt.json').state,'COMMIT_AND_READYFORQUERY_I');}assert.equal(existsSync(file),false,'existing dispatch STOP');
const f=read('core15/service-fixture-private.json'),auth=read('core17-auth-private.json'),secret=loadInstallerCredentialBindingV1({privateRoot:p,generation:process.argv[2],bindingPath:process.argv[3],expectedTarget:installerTargetV1(JSON.parse(readOwnedInstallerFileV1(p+'/core15/service-runtime-binding.json',p)).target)});
const config={host:'127.0.0.1',port:55422,database:'postgres',user:'cladora_core_installer',password:secret.password,connectionTimeoutMillis:5000,query_timeout:10000};
const observer=new pg.Client(config),blocker=new pg.Client(config),base='http://localhost:3008/api/customer/v1/services/',checks={};
const e={contract:'core-service-real-app-assembly-proof.v1',state:'DISPATCHED_NO_RETRY',phase:'bootstrap',checks,Auth:'existing real synthetic GoTrue AAL2 session, not a mock',Next:'actual build/start production; not NODE_ENV spoofed'};
const save=()=>writeFileSync(file,JSON.stringify(e,null,2)+'\n',{mode:0o600});save();
const scope={context_id:f.contexts[0],workspace_id:f.workspaces[0]};
async function call(path,{method='GET',data,cookie=auth.users[0].cookie}={}){const r=await fetch(base+path,{method,signal:AbortSignal.timeout(30000),headers:{...(cookie?{cookie}:{}),...(method==='POST'?{'content-type':'application/json',origin:'http://localhost:3008'}:{})},...(method==='POST'?{body:JSON.stringify(data)}:{})});return{status:r.status,headers:{cache:r.headers.get('cache-control')},value:await r.json()};}
async function counts(){return(await observer.query("select (select count(*)::int from service_catalog.requests) requests,(select count(*)::int from platform.idempotency_keys where key like 'core-tx.v1:%') c03")).rows[0];}
let locked=false,expired=false,revoked=false,pending;
try{
 await observer.connect();await blocker.connect();const before=await counts();e.before=before;
 e.bootstrap=await call('assembly-bootstrap');save();assert.equal(e.bootstrap.status,200);assert.equal(e.bootstrap.value.contract_version,'core-service-app-read.v1');assert.ok(e.bootstrap.value.selections.some(x=>x.context_id===scope.context_id&&x.workspace_id===scope.workspace_id&&x.tenant_id===f.tenants[0]));checks.real_session_to_current_selection=true;
 e.phase='catalog';save();e.catalog=await call('catalog?'+new URLSearchParams(scope));save();assert.equal(e.catalog.status,200);assert.ok(e.catalog.value.offerings.some(x=>x.offering_id===f.offering&&x.revision_id===f.revision));checks.actual_canonical_catalog=true;
 e.before_read=await call('requests?'+new URLSearchParams(scope));save();assert.equal(e.before_read.status,200);assert.ok(e.before_read.value.beneficiaries.some(x=>x.party_id===f.beneficiaries[0]));assert.deepEqual(await counts(),before);checks.actual_read_no_c03_or_domain_write=true;
 const body={...scope,offering_id:f.offering,published_revision_id:f.revision,beneficiary_party_id:f.beneficiaries[0],resource:null,description:'Core17 real production Next synthetic Request',idempotency_key:'core17_actual_next_start_request_v1'};e.body=body;e.phase='command';save();
 e.created=await call('offering-request-flow',{method:'POST',data:body});save();assert.equal(e.created.status,200);assert.equal(e.created.value.status,'submitted');
 const receipt=(await observer.query('select response_ref from platform.idempotency_keys where tenant_id=$1 and key=$2',[f.tenants[0],'core-tx.v1:'+f.workspaces[0]+':'+body.idempotency_key])).rows;assert.equal(receipt.length,1);assert.equal(receipt[0].response_ref.aggregate_id,e.created.value.request_id);e.receipt=receipt[0].response_ref;checks.real_c03_command_canonical_receipt=true;
 e.readback=await call('requests?'+new URLSearchParams(scope));save();assert.equal(e.readback.status,200);assert.ok(e.readback.value.requests.some(x=>x.request_id===e.created.value.request_id&&x.description===body.description&&x.offering_id===body.offering_id));checks.read_same_request_through_actual_application_route=true;
 e.replay=await call('offering-request-flow',{method:'POST',data:body});save();assert.equal(e.replay.status,200);assert.deepEqual(e.replay.value,e.created.value);assert.deepEqual(await counts(),{requests:before.requests+1,c03:before.c03+1});checks.same_key_body_one_effect=true;
 e.conflict=await call('offering-request-flow',{method:'POST',data:{...body,description:body.description+' changed'}});save();assert.equal(e.conflict.status,409);assert.deepEqual(await counts(),{requests:before.requests+1,c03:before.c03+1});checks.changed_body_conflict_no_write=true;
 for(const name of ['catalog','requests']){const foreign=await call(name+'?'+new URLSearchParams({...scope,workspace_id:f.workspaces[1]}));const actor=await call(name+'?'+new URLSearchParams(scope),{cookie:auth.users[1].cookie});assert.equal(foreign.status,403);assert.equal(actor.status,403);assert.equal(JSON.stringify(foreign.value).includes(f.offering),false);assert.equal(JSON.stringify(actor.value).includes(e.created.value.request_id),false);}checks.foreign_scope_actor_denied_no_leak=true;
 const anonymous=await call('assembly-bootstrap',{cookie:''});assert.equal(anonymous.status,401);checks.anonymous_denied=true;
 e.phase='expiry_after_actual_catalog_wait';save();assert.equal((await observer.query('select ends_at from identity.context_grants where id=$1',[f.contexts[0]])).rows[0].ends_at,null);
 await observer.query("update identity.context_grants set ends_at=clock_timestamp()+interval '4 seconds' where id=$1",[f.contexts[0]]);expired=true;
 await blocker.query('begin');await blocker.query('LOCK TABLE service_catalog.revisions IN ACCESS EXCLUSIVE MODE');locked=true;const pid=(await blocker.query('select pg_backend_pid() pid')).rows[0].pid;
 pending=call('catalog?'+new URLSearchParams(scope)).then(value=>({value}),error=>({error}));
 let blocked=false;for(let i=0;i<40;i++){blocked=(await observer.query("select exists(select 1 from pg_stat_activity where usename='cladora_core_runtime' and $1::int=any(pg_blocking_pids(pid))) v",[pid])).rows[0].v;if(blocked)break;await new Promise(r=>setTimeout(r,50));}assert.equal(blocked,true);checks.actual_catalog_lock_wait_observed=true;
 let ended=false;for(let i=0;i<90;i++){ended=(await observer.query('select clock_timestamp()>=ends_at v from identity.context_grants where id=$1',[f.contexts[0]])).rows[0].v;if(ended)break;await new Promise(r=>setTimeout(r,50));}assert.equal(ended,true);await blocker.query('commit');locked=false;
 const outcome=await pending;assert.ok(outcome.value);e.expired=outcome.value;save();assert.equal(outcome.value.status,403);assert.equal(JSON.stringify(outcome.value.value).includes(f.offering),false);checks.expired_after_wait_no_catalog_disclosure=true;
 await observer.query('update identity.context_grants set ends_at=null where id=$1',[f.contexts[0]]);expired=false;
 await observer.query("update identity.memberships set status='revoked' where id=$1 and status='active'",[f.members[0]]);revoked=true;
 const denied=await call('requests?'+new URLSearchParams(scope));assert.equal(denied.status,403);assert.equal(JSON.stringify(denied.value).includes(e.created.value.request_id),false);checks.revoked_request_read_denied=true;
 await observer.query("update identity.memberships set status='active' where id=$1",[f.members[0]]);revoked=false;
 assert.deepEqual(await counts(),{requests:before.requests+1,c03:before.c03+1});checks.no_extra_effects_from_reads_or_denials=true;
 e.state='PASS_REAL_NEXT_BUILD_START_SERVICE_ASSEMBLY';e.boundary='HTTP/API/Auth/PG actual; browser UI owned by consumers not executed here';save();console.log(JSON.stringify({state:e.state,checks,sha256:createHash('sha256').update(readFileSync(file)).digest('hex')}));
}catch(error){e.state='FAILED_OR_UNKNOWN_STOP';e.error={code:error.code??error.name,message:error.message};save();console.error(JSON.stringify({state:e.state,phase:e.phase,code:e.error.code,private_diagnostic:true}));process.exitCode=1;}
finally{if(locked)await blocker.query('rollback').catch(()=>{e.cleanup='UNKNOWN';});if(pending)await pending;
 try{if(expired)await observer.query('update identity.context_grants set ends_at=null where id=$1',[f.contexts[0]]);if(revoked)await observer.query("update identity.memberships set status='active' where id=$1",[f.members[0]]);}catch{e.cleanup='UNKNOWN';process.exitCode=1;}save();await blocker.end();await observer.end();}
