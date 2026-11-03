/** Existing committed key only: real Next route/private binding + independent DB. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import pg from 'pg';
const p='/workspace/private/cladora-functional-dev-v1',read=x=>JSON.parse(readFileSync(p+'/'+x));
const continued=process.argv[2]==='--after-refresh-binding';assert.equal(process.argv.length,continued?3:2);
if(continued){const old=read('core15/service-next-existing-proof.json');assert.equal(old.state,'FAILED_OR_UNKNOWN_STOP');assert.equal(old.preflight.status,503);assert.equal(old.replay,undefined);}
const path=p+'/core15/service-next-existing-proof'+(continued?'-refresh-binding':'')+'.json';
assert.equal(existsSync(path),false,'existing dispatch: inspect, never repeat');
const fixture=read('core15/service-fixture-private.json'),mfa=read(continued?'core15/service-mfa-renewed-private.json':'core15/service-mfa-private.json'),secret=read('core15/service-native-v2/installer-secret.json');
const primary=read('core15/service-first-native-proof.json');
const prior=primary.state==='PASS_INITIAL_REAL_SERVICE_API_DB_CUT'?primary:read('core15/service-first-native-proof-committed-continuation.json');assert.equal(prior.state,'PASS_INITIAL_REAL_SERVICE_API_DB_CUT');
const pool=new pg.Pool({host:'127.0.0.1',port:55422,database:'postgres',user:'cladora_core_installer',password:secret.password,max:1,connectionTimeoutMillis:5000,query_timeout:10000});
const input={context_id:fixture.contexts[0],workspace_id:fixture.workspaces[0],offering_id:fixture.offering,published_revision_id:fixture.revision};
const body={...input,beneficiary_party_id:fixture.beneficiaries[0],resource:null,description:'Synthetic Core15 non-binding service request',idempotency_key:'core15_first_native_exact_key_v1'};
const base='http://localhost:3007/api/customer/v1/services/offering-request-flow',checks={};
const evidence={contract:'core15-next-existing-commit-proof.v1',state:'DISPATCHED_NO_RETRY',checks};
const save=()=>writeFileSync(path,JSON.stringify(evidence,null,2)+'\n',{mode:0o600});save();
async function observe(){return (await pool.query("select (select count(*)::int from service_catalog.requests) requests,(select count(*)::int from platform.idempotency_keys where key like 'core-tx.v1:%') c03, (select response_ref from platform.idempotency_keys where tenant_id=$1 and key=$2) receipt",[fixture.tenants[0],'core-tx.v1:'+fixture.workspaces[0]+':'+body.idempotency_key])).rows[0];}
async function call(method,data,cookie){const response=await fetch(base+(method==='GET'?'?'+new URLSearchParams(data):''),{method,signal:AbortSignal.timeout(90000),headers:{...(cookie?{cookie}:{}),...(method==='POST'?{'content-type':'application/json',origin:'http://localhost:3007'}:{})},...(method==='POST'?{body:JSON.stringify(data)}:{})});const text=await response.text();let value;try{value=JSON.parse(text);}catch{throw Error('NEXT_NON_JSON_'+response.status);}return{status:response.status,value};}
try{
 const before=await observe();assert.equal(before.requests,1);assert.equal(before.c03,1);assert.deepEqual(before.receipt,prior.hostResults[0].receipt);
 evidence.preflight=await call('GET',input,mfa.users[0].cookie);save();assert.equal(evidence.preflight.status,200);assert.equal(evidence.preflight.value.status,'ready');checks.actual_next_get_ready=true;
 evidence.replay=await call('POST',body,mfa.users[0].cookie);save();assert.equal(evidence.replay.status,200);assert.deepEqual(evidence.replay.value,prior.first.value);checks.actual_next_same_original_receipt_result=true;
 evidence.anonymous=await call('GET',input);save();assert.notEqual(evidence.anonymous.status,200);checks.anonymous_denied=true;
 assert.deepEqual(await observe(),before);checks.independent_exact_receipt_no_new_effect=true;
 evidence.state='PASS_ACTUAL_NEXT_CONFIGURED_ROUTE';save();console.log(JSON.stringify({state:evidence.state,checks,bytes:readFileSync(path).length,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
}catch(e){evidence.state='FAILED_OR_UNKNOWN_STOP';evidence.error={name:e.name,code:e.code??null,message:e.message};save();console.error(JSON.stringify({state:evidence.state,error_code:e.code??e.name,private_diagnostic:true}));process.exitCode=1;}
finally{await pool.end();}
