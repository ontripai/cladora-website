/** Real Auth/PG/Service/Core; injected post-COMMIT ACK loss is explicitly a
 * controlled transport fault, not a native network outage. No automatic resend.
 */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import pg from 'pg';
import {createCore15NativeLoader} from './lib/core15-native-ts-loader.mjs';
const root=fileURLToPath(new URL('../',import.meta.url)),p='/workspace/private/cladora-functional-dev-v1',read=x=>JSON.parse(readFileSync(p+'/'+x));
execFileSync('python3',['-I','-B','-c',"import importlib.util;from pathlib import Path;p=Path('/workspace/work/platform12-core15-input-794f5a1/scripts/functional-dev-stack-v1/stack.py');s=importlib.util.spec_from_file_location('p12',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.state();m.cid('pg');m.gateway_process()"],{stdio:'pipe'});
const budgetFixed=process.argv[2]==='--after-pool-budget',continued=process.argv[2]==='--after-pre-dispatch'||budgetFixed;assert.equal(process.argv.length,continued?3:2);
if(budgetFixed){const old=read('core15/service-native-settlement-proof-pre-dispatch-diagnostic.json');assert.equal(old.hostResults.length,0);assert.equal(old.wire.length,0);assert.ok(old.errors.every(x=>x.code==='POOL_BUDGET_REQUIRED'));}
if(continued){const old=read('core15/service-native-settlement-proof.json');assert.equal(old.phase,'concurrent_same_key_body');assert.equal(old.hostResults.length,0);assert.equal(old.wire.length,0);}
const path=p+'/core15/service-native-settlement-proof'+(budgetFixed?'-pool-budget':continued?'-pre-dispatch-diagnostic':'')+'.json';assert.equal(existsSync(path),false,'existing dispatch STOP');
const fixture=read('core15/service-fixture-private.json'),mfa=read(existsSync(p+'/core15/service-mfa-renewed-private.json')?'core15/service-mfa-renewed-private.json':'core15/service-mfa-private.json'),secret=read('core15/runtime-secret.json'),owner=read('core15/service-native-v2/installer-secret.json');
const nextOriginal=read('core15/service-next-existing-proof.json');assert.equal((nextOriginal.state==='PASS_ACTUAL_NEXT_CONFIGURED_ROUTE'?nextOriginal:read('core15/service-next-existing-proof-refresh-binding.json')).state,'PASS_ACTUAL_NEXT_CONFIGURED_ROUTE');
process.env.NODE_ENV='test';process.env.NEXT_PUBLIC_CLADORA_EPHEMERAL_LOCAL_SUPABASE='1';process.env.NEXT_PUBLIC_SUPABASE_URL='http://127.0.0.1:55421';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=read('secrets.json').anon_key;
const loader=createCore15NativeLoader(root),core=loader.load('src/lib/core/service-functional-binding-v1.ts'),http=loader.load('src/lib/customer/service-v14-execution/http.ts'),{NextRequest}=createRequire(import.meta.url)('next/server');
const config={host:'127.0.0.1',port:55422,database:'postgres',connectionTimeoutMillis:5000,query_timeout:15000};
const pool=new pg.Pool({...config,user:'cladora_core_runtime',password:secret.password,max:4}),observer=new pg.Pool({...config,user:'cladora_core_installer',password:owner.password,max:2});
const wire=[],errors=[],hostResults=[],checks={};let injectCommitAck=false,faultDelivered=false;
const evidence={contract:'core15-native-settlement-proof.v1',state:'DISPATCHED_NO_RETRY',phase:'init',checks,wire,errors,hostResults,fault_model:'throw once AFTER real node-pg COMMIT resolves; real server tag/RFQ independently recorded'};
const save=()=>writeFileSync(path,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});save();
pool.on('connect',client=>{client.connection.on('commandComplete',x=>wire.push({pid:client.processID,tag:x.text}));client.connection.on('readyForQuery',x=>wire.push({pid:client.processID,status:x.status}));
 const raw=client.query.bind(client);client.query=(...args)=>{const text=typeof args[0]==='string'?args[0]:args[0]?.text;
 const output=raw(...args);if(!output?.then)return output;
 return output.then(value=>{if(text?.trim().toLowerCase()==='commit'&&injectCommitAck){injectCommitAck=false;faultDelivered=true;const e=Error('CONTROLLED_POST_COMMIT_ACK_LOSS');e.code='TEST_TRANSPORT_ACK_LOSS';throw e;}return value;}).catch(e=>{errors.push({code:e.code??e.name,query_sha256:createHash('sha256').update(text??'').digest('hex'),message:e.message});save();throw e;});
 };});
pool.on('error',e=>{errors.push({code:e.code??'POOL_ERROR'});save();});
const target=read('core15/service-runtime-binding.json').target,binding=core.createCoreServiceFunctionalBindingV1({pool,target});
const handlers=http.createServiceOfferingRequestFlowHandlers(async req=>{let ports;try{ports=await binding.bind(req);}catch(e){errors.push({phase:'bind',code:e.code??e.name,message:e.message,stack:e.stack});save();throw e;}if(!ports)return null;return{...ports,host:{async execute(...args){const r=await ports.host.execute(...args);hostResults.push({key:args[0].idempotency_key,result:structuredClone(r)});save();return r;}}};});
const input={context_id:fixture.contexts[0],workspace_id:fixture.workspaces[0],offering_id:fixture.offering,published_revision_id:fixture.revision},base='http://localhost:3009/api/customer/v1/services/offering-request-flow';
const body=key=>({...input,beneficiary_party_id:fixture.beneficiaries[0],resource:null,description:'Synthetic Core15 native settlement request',idempotency_key:key});
async function call(b){const request=new NextRequest(base,{method:'POST',headers:{cookie:mfa.users[0].cookie,'content-type':'application/json',origin:'http://localhost:3009'},body:JSON.stringify(b)});const r=await handlers.POST(request);return{status:r.status,value:await r.json()};}
async function snapshot(){const x=await observer.query("select (select count(*)::int from service_catalog.requests) requests,(select count(*)::int from platform.idempotency_keys where key like 'core-tx.v1:%') c03,(select count(*)::int from audit.events) audit,(select count(*)::int from platform.outbox_events) outbox");return x.rows[0];}
async function exactStored(key){const r=await observer.query('select response_ref from platform.idempotency_keys where tenant_id=$1 and key=$2',[fixture.tenants[0],'core-tx.v1:'+fixture.workspaces[0]+':'+key]);assert.equal(r.rowCount,1);return r.rows[0].response_ref;}
let acl=null,reduced=false;
try{
 evidence.phase='concurrent_same_key_body';save();const before=await snapshot(),b=body('core15_concurrency_native_v1');
 const pair=await Promise.all([call(b),call(b)]);evidence.concurrent=pair;save();for(const r of pair){assert.equal(r.status,200);assert.equal(r.value.status,'submitted');}assert.equal(pair[0].value.request_id,pair[1].value.request_id);
 const after=await snapshot();for(const k of ['requests','c03','audit','outbox'])assert.equal(after[k],before[k]+1);await exactStored(b.idempotency_key);checks.concurrent_same_key_one_atomic_effect=true;
 evidence.phase='commit_ack_loss';save();const lost=body('core15_lost_ack_native_v1');injectCommitAck=true;const r=await call(lost);evidence.lost_ack=r;save();assert.equal(faultDelivered,true);assert.notEqual(r.status,200);assert.ok(hostResults.some(x=>x.result.status==='unknown_commit'));assert.ok(wire.some(x=>x.tag==='COMMIT'));assert.ok(wire.some(x=>x.status==='I'));
 const committed=await exactStored(lost.idempotency_key);assert.equal(committed.aggregate_id!==null,true);const lostState=await snapshot();for(const k of ['requests','c03','audit','outbox'])assert.equal(lostState[k],after[k]+1);checks.actual_commit_ack_fault_unknown_no_auto_resend=true;
 evidence.phase='explicit_exact_original_recovery';save();const recovered=await call(lost);evidence.recovered=recovered;save();assert.equal(recovered.status,200);assert.equal(recovered.value.request_id,committed.aggregate_id);assert.deepEqual(await exactStored(lost.idempotency_key),committed);assert.deepEqual(await snapshot(),lostState);assert.equal(hostResults.at(-1).result.status,'exact_replay');checks.explicit_same_key_body_recovers_exact_stored_receipt=true;
 evidence.phase='outbox_privilege_fault_rollback';save();const aclRow=await observer.query("select relacl::text acl,pg_get_userbyid(relowner) owner from pg_class where oid='platform.outbox_events'::regclass");assert.equal(aclRow.rows[0].owner,'cladora_core_installer');acl=aclRow.rows[0].acl;assert.equal((await observer.query("select has_table_privilege('cladora_core_runtime','platform.outbox_events','INSERT') ok")).rows[0].ok,true);
 await observer.query('REVOKE INSERT ON platform.outbox_events FROM cladora_core_runtime');reduced=true;
 const rb=body('core15_atomic_rollback_native_v1'),rbResult=await call(rb);evidence.rollback=rbResult;save();assert.notEqual(rbResult.status,200);assert.equal(hostResults.at(-1).result.status,'denied');assert.ok(errors.some(x=>x.code==='42501'&&x.message==='permission denied for table outbox_events'));assert.deepEqual(await snapshot(),lostState);assert.ok(wire.some(x=>x.tag==='ROLLBACK'));checks.domain_receipt_audit_outbox_native_rollback_zero_partial_effect=true;
 await observer.query('GRANT INSERT ON platform.outbox_events TO cladora_core_runtime');reduced=false;assert.equal((await observer.query("select relacl::text acl from pg_class where oid='platform.outbox_events'::regclass")).rows[0].acl,acl);checks.exact_outbox_acl_restored=true;
 evidence.final_counts=await snapshot();evidence.state='PASS_NATIVE_CONCURRENCY_UNKNOWN_ROLLBACK';save();console.log(JSON.stringify({state:evidence.state,checks,serialization_errors_observed:errors.filter(x=>x.code==='40001').length,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
}catch(e){evidence.state='FAILED_OR_UNKNOWN_STOP';evidence.error={code:e.code??e.name,message:e.message};save();console.error(JSON.stringify({state:evidence.state,phase:evidence.phase,error_code:e.code??e.name,private_diagnostic:true}));process.exitCode=1;}
finally{if(reduced){try{await observer.query('GRANT INSERT ON platform.outbox_events TO cladora_core_runtime');assert.equal((await observer.query("select relacl::text acl from pg_class where oid='platform.outbox_events'::regclass")).rows[0].acl,acl);evidence.acl_cleanup='EXACT_RESTORED';save();}catch{evidence.acl_cleanup='UNKNOWN_STOP';save();process.exitCode=1;}}await pool.end();await observer.end();}
