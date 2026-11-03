/** Read-only final verification, no provisioning or command dispatch. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import pg from 'pg';
const p='/workspace/private/cladora-functional-dev-v1',read=x=>JSON.parse(readFileSync(p+'/'+x)),authBinding=process.argv[2]==='--after-auth-binding',continued=process.argv[2]==='--after-idle-pool-handler'||authBinding,path=p+'/core15/service-final-verify'+(authBinding?'-auth-binding':continued?'-idle-handler':'')+'.json';
assert.equal(process.argv.length,continued?3:2);if(continued)assert.equal(read('core15/service-final-verify.json').state,'PASS_FINAL_SERVICE_CUT_VERIFY');assert.equal(existsSync(path),false,'existing final verify receipt');
const original=read('core15/service-currentness-proof.json');assert.equal((original.state==='PASS_NATIVE_EXPIRY_AFTER_WAIT_AND_REVOKE'?original:read('core15/service-currentness-proof-native-denial-continuation.json')).state,'PASS_NATIVE_EXPIRY_AFTER_WAIT_AND_REVOKE');
const f=read('core15/service-fixture-private.json'),m=read(existsSync(p+'/core15/service-mfa-renewed-private.json')?'core15/service-mfa-renewed-private.json':'core15/service-mfa-private.json'),secret=read('core15/service-native-v2/installer-secret.json');
const c=new pg.Client({host:'127.0.0.1',port:55422,database:'postgres',user:'cladora_core_installer',password:secret.password,connectionTimeoutMillis:5000,query_timeout:10000});
const runtimeSources=Object.fromEntries(['src/lib/core/functional-command-runtime-v1.ts','src/lib/core/functional-request-auth-v1.ts','src/lib/core/service-functional-binding-v1.ts','src/lib/core/private-service-development-binding-v1.ts','src/lib/core/scoped-server-clock-v1.ts','src/lib/customer/service-v14-execution/http.ts','src/lib/customer/service-v14-execution/provider-binding.ts','src/lib/customer/service-v14-execution/runtime-binding.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
const e={runtime_sources:runtimeSources,contract:'core15-service-final-verify.v1',state:'DISPATCHED_READ_ONLY',checks:{}};const save=()=>writeFileSync(path,JSON.stringify(e,null,2)+'\n',{mode:0o600});save();
try{
 await c.connect();const observed=(await c.query(`select
 (select count(*)::int from service_catalog.requests) requests,
 (select count(*)::int from platform.idempotency_keys where key like 'core-tx.v1:%') c03,
 not exists(select 1 from pg_roles where rolname='cladora_core_runtime' and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication)) ordinary_runtime,
 not exists(select 1 from pg_auth_members where member='cladora_core_runtime'::regrole) zero_runtime_memberships,
 not has_column_privilege('cladora_core_runtime','auth.sessions','id','SELECT') no_runtime_auth_table_read,
 not has_table_privilege('cladora_core_runtime','platform.provider_agreement_heads_v1','INSERT,UPDATE,DELETE') no_runtime_s01_write,
 not has_table_privilege('cladora_core_runtime','platform.idempotency_keys','DELETE') no_runtime_receipt_delete,
 (select count(*)=2 from pg_class where oid in ('platform.provider_agreement_heads_v1'::regclass,'platform.provider_agreement_versions_v1'::regclass) and relrowsecurity and relforcerowsecurity) s01_forced_rls,
 (select pg_get_userbyid(proowner)='supabase_auth_admin' and prosecdef from pg_proc where oid='core_runtime.lock_request_session_v1()'::regprocedure) actual_auth_owner_guard,
 (select obj_description(oid,'pg_namespace') from pg_namespace where nspname='core_runtime') backend_marker`)).rows[0];
 assert.equal(observed.requests,3);assert.equal(observed.c03,3);for(const [k,v]of Object.entries(observed))if(!['requests','c03','backend_marker'].includes(k))assert.equal(v,true,k);
 assert.equal(observed.backend_marker,read('core15/service-runtime-binding.json').target.backend_id);e.catalog=observed;e.checks.real_runtime_profile_closed_auth_s01=true;save();
 const input={context_id:f.contexts[0],workspace_id:f.workspaces[0],offering_id:f.offering,published_revision_id:f.revision};
 const response=await fetch('http://localhost:3007/api/customer/v1/services/offering-request-flow?'+new URLSearchParams(input),{headers:{cookie:m.users[0].cookie},signal:AbortSignal.timeout(90000)});e.next={status:response.status,value:await response.json()};save();assert.equal(response.status,200);assert.equal(e.next.value.status,'ready');e.checks.actual_next_read_after_pg_restart_and_currentness_test=true;
 const after=(await c.query('select count(*)::int n from service_catalog.requests')).rows[0].n;assert.equal(after,3);e.checks.final_get_no_new_request=true;e.state='PASS_FINAL_SERVICE_CUT_VERIFY';save();console.log(JSON.stringify({state:e.state,checks:e.checks,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
}catch(err){e.state='FAILED_OR_UNKNOWN_STOP';e.error={code:err.code??err.name,message:err.message};save();console.error(JSON.stringify({state:e.state,error_code:err.code??err.name,private_diagnostic:true}));process.exitCode=1;}finally{await c.end();}
