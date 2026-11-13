/** Actual adopted Core module, controlled Pool/GUC transport only. No SQL/Auth. */
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import{execFileSync}from'node:child_process';import{resolve}from'node:path';import ts from'typescript';
import{ROOT,PATH,BEFORE,sha,candidate}from'./prepare-core-guide-auth-alias-proposal-v1.mjs';
const base='9811a9074c802d77d677b1387f9a01f14090172a',original=execFileSync('git',['show',base+':'+PATH],{cwd:ROOT,encoding:'utf8'});
// Reuse fixture FUNCTIONS only; private metadata / successful old cases never run.
const old=readFileSync(resolve(ROOT,'scripts/test-core-guide-auth-scope-v1.mjs'),'utf8');
const setup=old.slice(old.indexOf('function load(source)'),old.indexOf('\nconst old=load(original)')).replace("const original=readFileSync(resolve(ROOT,PATH),'utf8');assert.equal(sha(original),BEFORE);",'').replace('async function lease(module,service=false){',"async function lease(module,service=false,model='direct'){").replace("connection_model:'direct'",'connection_model:model');
assert.ok(!setup.includes('await check('));
const{load,lease}=new Function('assert','readFileSync','execFileSync','resolve','ts','ROOT','PATH','BEFORE','sha',setup+'\nreturn{load,lease};')(assert,readFileSync,execFileSync,resolve,ts,ROOT,PATH,BEFORE,sha);
const actual=readFileSync(resolve(ROOT,PATH),'utf8');assert.equal(actual,candidate(original).replace('Guide-only proposal:','Guide-only:').replace('`;\n\n\n// Guide-only','`;\n\n// Guide-only'));
const current=load(actual),previous=load(original);let n=0;async function check(name,fn){await fn();console.log(`PASS ${++n} ${name}`);}
await check('actual adopted Guide checkout neutralizes aliases AFTER RESET ALL and before executor',async()=>{
 const f=await lease(current);for(const k of['request.jwt.claim','request.jwt.claim.email'])assert.equal(f.session[k],'');
 const reset=f.trace.indexOf('reset all'),clear=f.trace.findIndex(q=>q.includes("pg_catalog.set_config('request.jwt.claim','',false)")),role=f.trace.findIndex(q=>q.startsWith('set role '));assert.ok(reset<clear&&clear<role);f.lease.release(true);
});
await check('direct and session-pooler profiles apply local clearing before transaction safety lease',async()=>{
 for(const model of['direct','session_pooler'])for(const begin of['begin','begin isolation level serializable','begin isolation level serializable read only']){
  const f=await lease(current,false,model);f.session['request.jwt.claim']='SYNTHETIC_REINJECTED';f.session['request.jwt.claim.email']='SYNTHETIC_REINJECTED';const start=f.trace.length;await f.lease.query(begin);
  const t=f.trace.slice(start),clear=t.findIndex(q=>q.includes("pg_catalog.set_config('request.jwt.claim','',true)")),safety=t.findIndex(q=>q.includes('acquire_ce_guide_role_safety_lease_v1'));assert.ok(clear>0&&clear<safety);assert.equal(f.local['request.jwt.claim'],'');assert.equal(f.local['request.jwt.claim.email'],'');await f.lease.query('rollback');f.lease.release(true);
 }
});
await check('successful reusable cleanup neutralizes database/role defaults again',async()=>{const f=await lease(current);f.session['request.jwt.claim']='SYNTHETIC_LEGACY';f.lease.release();await new Promise(setImmediate);assert.equal(f.session['request.jwt.claim'],'');assert.equal(f.session['request.jwt.claim.email'],'');assert.equal(f.released.length,1);});
await check('SERVICE checkout/transaction/rollback/reuse SQL and state are exactly unchanged',async()=>{
 const a=await lease(previous,true),b=await lease(current,true);await a.lease.query('begin');await b.lease.query('begin');await a.lease.query('rollback');await b.lease.query('rollback');a.lease.release();b.lease.release();await new Promise(setImmediate);assert.deepEqual(a.trace,b.trace);assert.deepEqual(a.session,b.session);assert.deepEqual(a.released,b.released);
});
await check('checkout alias failure returns same40001 and destroys raw lease once',async()=>{
 // Actual query path fault injected only at the physical boundary.
 const f=await lease(current);f.lease.release(true);let released=[];const err=Object.assign(Error('SYNTHETIC_CHECKOUT'),{code:'40001'});
 const pool=current.createCorePlatformRoleBoundPoolV1({connection_model:'direct',runtime_pool:{async connect(){return{async query(q){if(q.includes("pg_catalog.set_config('request.jwt.claim','',false)"))throw err;return f.client.query(q);},release(x){released.push(x);}};}}});await assert.rejects(pool.connect(),e=>e===err);assert.deepEqual(released,[true]);
});
await check('BEGIN alias failure keeps same40001; no safety lease after failure and no retry',async()=>{const f=await lease(current),err=Object.assign(Error('SYNTHETIC_BEGIN'),{code:'40001'});f.fault={when:q=>q.includes("pg_catalog.set_config('request.jwt.claim','',true)"),error:err};const before=f.trace.length;await assert.rejects(f.lease.query('begin'),e=>e===err);assert.equal(f.trace.slice(before).some(q=>q.includes('acquire_ce_guide_role_safety_lease_v1')),false);f.lease.release();assert.deepEqual(f.released,[true]);});
await check('cleanup alias failure destroys connection instead of pooling it',async()=>{const f=await lease(current),err=Object.assign(Error('SYNTHETIC_CLEANUP'),{code:'40001'});f.fault={when:q=>q.includes("pg_catalog.set_config('request.jwt.claim','',false)"),error:err};f.lease.release();await new Promise(setImmediate);assert.deepEqual(f.released,[true]);});
await check('unknown/open and COMMIT-attempted leases still destroy instead of reuse',async()=>{for(const op of['open','commit']){const f=await lease(current);await f.lease.query('begin');if(op==='commit')await f.lease.query('commit');f.lease.release();assert.deepEqual(f.released,[true]);}});
console.log(JSON.stringify({task:'GUIDE_ALIAS_SOURCE_ADOPTION',new_groups:n,Core:'ACTUAL_WORKTREE_SOURCE',SQL_Auth_target_calls:0,native:'NOT_RUN_NOT_PASS'}));
