/** Owned persistent PG restart only. Never init/bootstrap/users/provision. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import pg from 'pg';
const p='/workspace/private/cladora-functional-dev-v1',read=x=>JSON.parse(readFileSync(p+'/'+x));
const path=p+'/core15/service-restart-proof.json';assert.equal(existsSync(path),false,'prior restart dispatch STOP');
const original=read('core15/service-native-settlement-proof.json');assert.equal((original.state==='PASS_NATIVE_CONCURRENCY_UNKNOWN_ROLLBACK'?original:read('core15/service-native-settlement-proof-pool-budget.json')).state,'PASS_NATIVE_CONCURRENCY_UNKNOWN_ROLLBACK');
const secret=read('core15/service-native-v2/installer-secret.json');
const config={host:'127.0.0.1',port:55422,database:'postgres',user:'cladora_core_installer',password:secret.password,connectionTimeoutMillis:2000,query_timeout:10000};
const sql=`select jsonb_build_object('requests',(select jsonb_agg(to_jsonb(r) order by r.id) from service_catalog.requests r),
 'c03',(select jsonb_agg(to_jsonb(r) order by r.key) from platform.idempotency_keys r where r.key like 'core-tx.v1:%'),
 'audit',(select jsonb_agg(to_jsonb(r) order by r.id) from audit.events r),
 'outbox',(select jsonb_agg(to_jsonb(r) order by r.id) from platform.outbox_events r)) snapshot`;
async function observe(){const c=new pg.Client(config);try{await c.connect();const identity=await c.query('select current_user::text principal,pg_backend_pid() pid,pg_postmaster_start_time()::text started');assert.equal(identity.rows[0].principal,config.user);const value=(await c.query(sql)).rows[0].snapshot;return{identity:identity.rows[0],value};}finally{await c.end();}}
const e={contract:'core15-service-restart.v1',state:'BEFORE_RESTART',checks:{}};const save=()=>writeFileSync(path,JSON.stringify(e,null,2)+'\n',{mode:0o600});
try{
 e.before=await observe();assert.equal(e.before.value.requests.length,3);assert.equal(e.before.value.c03.length,3);save();
 e.state='RESTART_DISPATCHED_NO_RETRY';save();
 execFileSync('python3',['-I','-B','-c',"import importlib.util;from pathlib import Path;p=Path('/workspace/work/platform12-core15-input-794f5a1/scripts/functional-dev-stack-v1/stack.py');s=importlib.util.spec_from_file_location('p12',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.state();m.cid('pg');m.gateway_process();m.compose(['restart','pg']);m.cid('pg')"],{stdio:['ignore','pipe','pipe'],timeout:60000});
 let last;for(let i=0;i<20;i++){try{e.after=await observe();break;}catch(err){last=err;await new Promise(r=>setTimeout(r,500));}}if(!e.after)throw last;
 assert.notEqual(e.after.identity.started,e.before.identity.started);assert.deepEqual(e.after.value,e.before.value);e.checks.same_exact_request_receipt_audit_outbox_after_restart=true;e.checks.actual_postmaster_start_changed=true;
 e.state='PASS_REAL_PERSISTENCE_AFTER_RESTART';save();console.log(JSON.stringify({state:e.state,checks:e.checks,persisted_requests:e.after.value.requests.length,sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
}catch(err){e.state='FAILED_OR_UNKNOWN_STOP';e.error={code:err.code??err.name,message:err.message};save();console.error(JSON.stringify({state:e.state,error_code:err.code??err.name,private_diagnostic:true}));process.exitCode=1;}
