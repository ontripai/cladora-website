// Infrastructure-only native connection probe; not a Service/Core transaction host.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const privateRoot='/workspace/private/cladora-functional-dev-v1';
const cache='/workspace/private/platform-docs-ce012-materialization-capability-08/complete-01';
const inventory=JSON.parse(fs.readFileSync(cache+'/runtime-inputs.json','utf8'));
for(const entry of inventory.files){
 const path=cache+'/consumer-source/'+entry.path;
 assert.equal(fs.lstatSync(path).isSymbolicLink(),false);
 const b=fs.readFileSync(path);assert.equal(b.length,entry.bytes);assert.equal(crypto.createHash('sha256').update(b).digest('hex'),entry.sha256);
}
const require=createRequire(cache+'/consumer-source/package.json');
const {Client}=require('pg');assert.equal(require('pg/package.json').version,'8.23.0');
const secret=JSON.parse(fs.readFileSync(privateRoot+'/secrets.json','utf8'));
const users=JSON.parse(fs.readFileSync(privateRoot+'/users.json','utf8')).users;
const sessions=[0,1].map(i=>JSON.parse(fs.readFileSync(privateRoot+'/session-'+i+'.json','utf8')));
const receipt={contract:'platform12-ordinary-pg-infrastructure-proof.v1',canonical_authority:'NOT_PROVED',service_runtime:'NOT_BOUND',
 pg:'8.23.0',node:process.version,cache_files_verified:inventory.files.length,checks:{},settlements:[],unknown_outcome:'NOT_EXERCISED'};
function persist(){
 const fd=fs.openSync(privateRoot+'/ordinary-connection-proof.json','w',0o600);
 try{fs.writeFileSync(fd,JSON.stringify(receipt,null,2)+'\n');fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
}
function client(){
 const c=new Client({host:'127.0.0.1',port:55422,database:'postgres',user:'authenticator',password:secret.rest_password,ssl:false,connectionTimeoutMillis:10000,query_timeout:5000});
 c.on('error',()=>{});c.trace=[];
 c.on('connect',()=>{
  c.connection.on('commandComplete',m=>c.trace.push({kind:'C',text:m.text}));
  c.connection.on('readyForQuery',m=>c.trace.push({kind:'Z',status:m.status}));
 });return c;
}
async function identity(c){
 const r=(await c.query("SELECT current_user,session_user,pg_backend_pid() AS pid,current_setting('request.jwt.claims',true) AS claims,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolreplication FROM pg_roles WHERE rolname=current_user")).rows[0];
 assert.equal(r.current_user,'authenticator');assert.equal(r.session_user,'authenticator');
 for(const k of ['rolsuper','rolbypassrls','rolcreatedb','rolcreaterole','rolreplication'])assert.equal(r[k],false);
 assert.ok(r.claims===null||r.claims==='');return r;
}
async function claims(i){
 const token=sessions[i].access_token;
 const response=await fetch('http://127.0.0.1:55421/auth/v1/user',{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});
 assert.equal(response.status,200);assert.equal((await response.json()).id,users[i].id);
 const jwt=JSON.parse(Buffer.from(token.split('.')[1],'base64url'));
 assert.equal(jwt.sub,users[i].id);assert.equal(jwt.role,'authenticated');assert.equal(jwt.aal,'aal1');assert.ok(jwt.exp*1000>Date.now());
 assert.equal(jwt.iss,'http://127.0.0.1:55421/auth/v1');
 return {sub:jwt.sub,role:jwt.role,session_id:jwt.session_id};
}
async function begin(c,i){
 const value=await claims(i);await c.query('BEGIN');await c.query("SELECT set_config('request.jwt.claims',$1,true)",[JSON.stringify(value)]);await c.query('SET LOCAL ROLE authenticated');
 const r=(await c.query("SELECT current_user,session_user,pg_backend_pid() AS pid,current_setting('request.jwt.claims')::jsonb->>'sub' AS actor")).rows[0];
 assert.equal(r.current_user,'authenticated');assert.equal(r.session_user,'authenticator');assert.equal(r.actor,users[i].id);assert.equal(r.pid,c.processID);
 const spaces=(await c.query('SELECT id FROM platform_dev.workspaces')).rows;assert.equal(spaces.length,1);
 return r;
}
async function rollback(c){
 c.trace=[];const r=await c.query('ROLLBACK');assert.equal(r.command,'ROLLBACK');
 assert.ok(c.trace.some(x=>x.kind==='C'&&x.text==='ROLLBACK'));assert.equal(c.trace.at(-1)?.kind,'Z');assert.equal(c.trace.at(-1)?.status,'I');
 receipt.settlements.push({pid:c.processID,trace:c.trace.map(x=>({...x})),ready:'I',command:'ROLLBACK'});persist();
 await identity(c);
}
const c=client();await c.connect();
try{
 const first=await identity(c);receipt.physical_pid=first.pid;
 await begin(c,0);await rollback(c);receipt.checks.ordinary_login_success_settlement=true;
 await begin(c,1);
 await assert.rejects(c.query("INSERT INTO platform_dev.notes VALUES(gen_random_uuid(),'11111111-1111-4111-8111-111111111111','must be denied')"),e=>e.code==='42501');
 await rollback(c);receipt.checks.foreign_error_rollback_and_context_clear=true;
 await begin(c,0);await c.query("SET LOCAL statement_timeout='100ms'");
 await assert.rejects(c.query('SELECT pg_sleep(1)'),e=>e.code==='57014');await rollback(c);
 receipt.checks.server_statement_cancellation_rollback_and_context_clear=true;
 await begin(c,1);await rollback(c);receipt.checks.same_backend_reuse_no_actor_or_claim_leak=true;
 await begin(c,0);c.connection.stream.destroy();
 // A lost physical stream has NO rollback ACK; never return it to a pool/replay.
 receipt.unknown_outcome='UNKNOWN_NO_TERMINAL_ACK';receipt.checks.unknown_connection_destroyed_not_reused=true;
 persist();
 await assert.rejects(c.query('SELECT current_user'));
}finally{await c.end().catch(()=>{});}
const observer=client();await observer.connect();
try{
 await identity(observer);assert.notEqual(observer.processID,receipt.physical_pid);receipt.checks.fresh_observer_clean_identity=true;
 let remaining=1;
 for(let i=0;i<20&&remaining;i++){
  remaining=Number((await observer.query('SELECT count(*) AS n FROM pg_stat_activity WHERE pid=$1 AND usename=current_user',[receipt.physical_pid])).rows[0].n);
  if(remaining)await new Promise(resolve=>setTimeout(resolve,100));
 }
 assert.equal(remaining,0);receipt.checks.unknown_backend_absence_independently_observed=true;
}
finally{await observer.end();}
receipt.scope='real local synthetic PG/Auth/role/transaction context only; no Core authority, app domain or Service activation';
const path=privateRoot+'/ordinary-connection-proof.json';persist();
console.log(JSON.stringify({checks:receipt.checks,unknown:receipt.unknown_outcome,receipt_sha256:crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')}));
