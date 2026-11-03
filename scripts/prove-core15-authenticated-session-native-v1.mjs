/** One-shot real SDK/PG proof against the EXACT owned Platform12, synthetic users only. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import Module,{createRequire} from 'node:module';
import ts from 'typescript';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
const privateRoot='/workspace/private/cladora-functional-dev-v1',sourceRoot='/workspace/work/platform12-core15-input-794f5a1';
const digest=b=>createHash('sha256').update(b).digest('hex');
const readPrivate=p=>{const s=statSync(p);assert.equal(s.mode&0o077,0);assert.equal(s.isFile(),true);return JSON.parse(readFileSync(p,'utf8'));};
execFileSync('python3',['-I','-B','-c',`import importlib.util; from pathlib import Path
p=Path('${sourceRoot}'); s=importlib.util.spec_from_file_location('p12',p/'scripts/functional-dev-stack-v1/stack.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m);m.state();m.cid('pg');m.gateway_process()`],{stdio:'pipe'});
const receiptPath=privateRoot+'/core15/native-session-proof-auth-owner-v2.json';
assert.equal(existsSync(receiptPath),false,'one-shot receipt exists; read it, do not repeat execution');
const secret=readPrivate(privateRoot+'/secrets.json'),users=readPrivate(privateRoot+'/users.json'),runtimeSecret=readPrivate(privateRoot+'/core15/runtime-secret.json');
const installed=readPrivate(privateRoot+'/core15/session-bootstrap-receipt.json');
assert.equal(users.state,'CREATED_BY_REAL_AUTH');assert.equal(installed.state,'COMMIT_TAG_AND_INDEPENDENT_CATALOG_OBSERVED');
assert.equal(readPrivate(privateRoot+'/core15/session-owner-repair.json').state,'COMMIT_TAG_AND_INDEPENDENT_CATALOG_OBSERVED');
const raw=readFileSync(new URL('../src/lib/core/authenticated-session-runtime-v1.ts',import.meta.url));
const compiled=new Module(new URL('../src/lib/core/.session-native-proof.cjs',import.meta.url).pathname);
compiled.filename=new URL('../src/lib/core/.session-native-proof.cjs',import.meta.url).pathname;
compiled.paths=Module._nodeModulePaths(new URL('../src/lib/core',import.meta.url).pathname);
const realRequire=createRequire(compiled.filename);
// Same marker alias as Next's server compiler; Auth/PG/crypto are NOT replaced.
compiled.require=name=>realRequire(name==='server-only'?'next/dist/compiled/server-only/empty':name);
compiled._compile(ts.transpileModule(raw.toString(),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true}}).outputText,compiled.filename);
const events=[],checks={};
const runtimePool=new pg.Pool({host:'127.0.0.1',port:55422,database:'postgres',user:runtimeSecret.role,password:runtimeSecret.password,max:2,connectionTimeoutMillis:5000,query_timeout:15000});
runtimePool.on('connect',c=>{c.connection.on('commandComplete',m=>events.push({pid:c.processID,tag:m.text}));c.connection.on('readyForQuery',m=>events.push({pid:c.processID,status:m.status}));});
const admin=new pg.Pool({host:'127.0.0.1',port:55422,database:'postgres',user:'postgres',password:secret.database_password,max:3,connectionTimeoutMillis:5000,query_timeout:15000});
assert.match(String(installed.database_oid),/^[1-9][0-9]*$/);
const runtime=compiled.exports.createCoreAuthenticatedSessionRuntimeV1({pool:runtimePool,auth_origin:'http://127.0.0.1:55421',publishable_key:secret.anon_key,database_oid:Number(installed.database_oid)});
const result={contract:'core15-native-session-proof.v1',state:'DISPATCHED_NO_RETRY',platform:'794f5a12c3928ae0a3585ab679a3cbe60aab49a3',source_sha256:digest(raw),checks,not_proved:['Context authority','C03','S01','domain mutation','COMMIT unknown recovery']};
const save=()=>writeFileSync(receiptPath,JSON.stringify(result,null,2)+'\n',{mode:0o600});save();
const auths=[];
async function login(index){result.phase='real_login_'+index;save();const u=users.users[index],a=createClient('http://127.0.0.1:55421',secret.anon_key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});auths.push(a);
 const signed=await a.auth.signInWithPassword({email:u.email,password:secret[u.password_key]});assert.equal(signed.error,null);assert.ok(signed.data.session);
 const claimed=await a.auth.getClaims(signed.data.session.access_token);assert.equal(claimed.error,null);return{auth:a,token:signed.data.session.access_token,sid:claimed.data.claims.session_id,uid:u.id};}
async function blocked(){const deadline=Date.now()+2000;while(Date.now()<deadline){const q=await admin.query("select count(*)::int n from pg_stat_activity where usename='cladora_core_runtime' and wait_event_type='Lock' and query='select * from core_runtime.lock_request_session_v1()'");if(q.rows[0].n===1)return;await new Promise(r=>setTimeout(r,50));}throw Error('real_block_not_observed');}
let locker;
try{
 const session=await login(1);result.phase='positive_session';save();const positive=await runtime.check(session.token);assert.equal(positive.status,'current');assert.equal(positive.actor_id,session.uid);assert.equal(positive.action_authorization,'not_evaluated');checks.real_auth_current_session=true;
 const rollback=events.find(e=>e.tag==='ROLLBACK');assert.ok(rollback);assert.ok(events.some(e=>e.pid===rollback.pid&&e.status==='I'));checks.rollback_same_backend_readyforquery_I=true;
 await assert.rejects(runtimePool.query('select id from auth.sessions'),e=>e.code==='42501');
 await assert.rejects(runtimePool.query('select core_runtime.require_request_session_current_at_v1(clock_timestamp())'),e=>e.code==='42501');checks.runtime_no_auth_direct_or_raw_clock_guard=true;
 const bad=session.token.slice(0,-8)+'tampered';assert.equal((await runtime.check(bad)).status,'denied');checks.invalid_jwt_denied=true;
 const out=await session.auth.auth.signOut({scope:'local'});assert.equal(out.error,null);assert.equal((await runtime.check(session.token)).status,'denied');checks.real_auth_logout_denied=true;
 const expiry=await login(0);await admin.query("update auth.sessions set not_after=clock_timestamp()+interval '3 seconds' where id=$1 and user_id=$2",[expiry.sid,expiry.uid]);
 locker=await admin.connect();await locker.query('begin');await locker.query('select id from auth.sessions where id=$1 and user_id=$2 for update',[expiry.sid,expiry.uid]);
 const pending=runtime.check(expiry.token);pending.catch(()=>{});await blocked();checks.expiry_real_block_observed=true;
 await new Promise(r=>setTimeout(r,3200));await locker.query('commit');locker.release();locker=null;
 assert.equal((await pending).status,'denied');checks.expiry_after_wait_denied=true;
 const race=await login(0);locker=await admin.connect();await locker.query('begin');await locker.query('select id from auth.sessions where id=$1 and user_id=$2 for update',[race.sid,race.uid]);
 const racing=runtime.check(race.token);racing.catch(()=>{});await blocked();
 await locker.query('update auth.sessions set not_after=not_after where id=$1 and user_id=$2',[race.sid,race.uid]);await locker.query('commit');locker.release();locker=null;
 await assert.rejects(racing,e=>e.code==='40001'&&compiled.exports.coreAuthenticatedSessionFailureV1(e)?.settlement==='rolled_back');checks.real_40001_preserved_no_retry=true;
 const catalog=await admin.query("select (select count(*)::int from pg_class where relnamespace='core_runtime'::regnamespace) tables,(select count(*)::int from pg_auth_members where member='cladora_core_runtime'::regrole) memberships");
 assert.deepEqual(catalog.rows,[{tables:0,memberships:0}]);checks.no_core_session_ledger_or_memberships=true;
 result.state='PASS_REAL_AUTH_PG_SESSION_SLICE_ONLY';result.wire={rollback_tags:events.filter(e=>e.tag==='ROLLBACK').length,readyforquery_I:events.filter(e=>e.status==='I').length};save();
 console.log(JSON.stringify({state:result.state,checks,receipt_sha256:digest(readFileSync(receiptPath)),C01_Context_C03_S01:'NOT_READY'}));
}catch(e){result.state='FAILED_OR_UNKNOWN_NO_AUTOMATIC_RETRY';result.error_code=typeof e.code==='string'?e.code:'LOCAL_ASSERTION_OR_TRANSPORT';save();console.error(JSON.stringify({state:result.state,error_code:result.error_code,private_receipt:true}));process.exitCode=1;}
finally{if(locker){try{await locker.query('rollback');}finally{locker.release(true);}}for(const a of auths)await a.auth.signOut({scope:'local'}).catch(()=>{});await runtimePool.end();await admin.end();}
