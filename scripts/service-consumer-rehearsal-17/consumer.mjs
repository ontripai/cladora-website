/** Independent, permission-confined PG/Auth consumer. No product fixture/writer. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {createClient} from '@supabase/supabase-js';
const privateRoot='/workspace/private/platform-service-consumer-rehearsal-17';
const phase=process.argv[2];assert.equal(process.argv.length,3);assert.ok(['--before','--after'].includes(phase));
assert.equal(process.permission?.has('child'),false);assert.equal(process.permission?.has('addons'),false);
assert.ok(!process.env.NODE_OPTIONS&&!process.env.NODE_PATH&&!process.env.PGPASSWORD&&!process.env.DATABASE_URL);
function read(path){const s=lstatSync(path);assert.equal(s.isSymbolicLink(),false);assert.equal(realpathSync(path),path);assert.equal(s.mode&0o077,0);assert.equal(s.nlink,1);return JSON.parse(readFileSync(path));}
const binding=read(privateRoot+'/runtime-consumer.private.json');
assert.equal(binding.contract,'platform17-private-consumer.v1');assert.equal(binding.target.runtime_role,'cladora_core_runtime');
assert.equal(binding.target.host,'127.0.0.1');assert.equal(binding.target.port,55422);
assert.equal(binding.target.database_name,'postgres');assert.equal(binding.target.auth_origin,'http://127.0.0.1:55421');
assert.equal(binding.target.contract,'core-functional-development-target.v1');
const origin=binding.target.auth_origin;
const exactFetch=async(input,init)=>{
 const u=new URL(typeof input==='string'?input:input.url);
 assert.equal(u.origin,origin);assert.ok(u.pathname.startsWith('/auth/v1/')||u.pathname.startsWith('/rest/v1/'));
 return fetch(input,{...init,redirect:'error'});
};
const clients=binding.users.map(()=>createClient(origin,binding.anon_key,{global:{fetch:exactFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}));
const output=privateRoot+'/consumer-output';
const sessionsPath=output+'/consumer-sessions.private.json',receiptPath=output+(phase==='--before'?'/consumer-before.receipt.json':'/consumer-after.receipt.json');
const receipt={contract:'platform17-independent-consumer-receipt.v1',phase,state:'DISPATCHED',first_error:null,checks:{},cleanup:{},scope:'INFRASTRUCTURE_ONLY; canonical product membership/Offering/Request NOT_RUN'};
const save=()=>writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
writeFileSync(receiptPath,JSON.stringify(receipt,null,2)+'\n',{flag:'wx',mode:0o600}); // atomic one-attempt claim
const pool=new pg.Pool({host:binding.target.host,port:binding.target.port,database:'postgres',user:'cladora_core_runtime',password:binding.password,max:1,
 connectionTimeoutMillis:5000,query_timeout:10000,idleTimeoutMillis:5000,allowExitOnIdle:true,application_name:'platform17-independent-consumer'});
pool.on('error',()=>{receipt.first_error??='IDLE_POOL_ERROR';receipt.cleanup.idle_connection='UNKNOWN_QUARANTINED';save();});
const sessions=phase==='--after'?read(sessionsPath).sessions:[];
let leased=null,lastReady=null,streamKnown=true;const tags=[];let completed=false;
async function identity(c){
 const r=await c.query(`select current_user::text actor,session_user::text login,pg_backend_pid() pid,
 (select oid::int from pg_database where datname=current_database()) database_oid,
 current_setting('server_version_num')::int version,
 obj_description('core_runtime'::regnamespace::oid,'pg_namespace') marker,
 r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,
 exists(select 1 from pg_auth_members where member=r.oid) memberships,
 has_column_privilege(current_user,'auth.sessions','id','SELECT') auth_select,
 current_setting('request.jwt.claims',true) claims
 from pg_roles r where rolname=current_user`);
 assert.equal(r.rowCount,1);const x=r.rows[0];assert.equal(x.actor,'cladora_core_runtime');assert.equal(x.login,x.actor);
 assert.equal(x.database_oid,binding.target.database_oid);assert.equal(x.version,170011);assert.equal(x.marker,binding.target.backend_id);
 for(const k of ['rolsuper','rolbypassrls','rolcreaterole','rolcreatedb','rolreplication','memberships','auth_select'])assert.equal(x[k],false,k);
 assert.ok(x.claims===null||x.claims==='');return x;
}
try{
 for(const [i,client] of clients.entries()){
  if(phase==='--before'){
   const login=await client.auth.signInWithPassword({email:binding.users[i].email,password:binding.users[i].password});
   assert.equal(login.error,null);assert.equal(login.data.user.id,binding.users[i].id);
   sessions.push({access_token:login.data.session.access_token,refresh_token:login.data.session.refresh_token});
   writeFileSync(sessionsPath,JSON.stringify({sessions})+'\n',{mode:0o600});
  }
  const token=sessions[i].access_token;
  const user=await client.auth.getUser(token),verified=await client.auth.getClaims(token);
  assert.equal(user.error,null);assert.equal(verified.error,null);
  const claims=verified.data.claims;
  assert.equal(user.data.user.id,binding.users[i].id);assert.equal(claims.sub,user.data.user.id);
  assert.equal(claims.role,'authenticated');assert.equal(claims.aal,'aal1');assert.ok(claims.exp>Date.now()/1000);
  assert.match(claims.session_id,/^[a-f0-9-]{36}$/);
  // API client uses the same real bearer; no service key or fabricated claim.
  const bearer=createClient(origin,binding.anon_key,{global:{fetch:exactFetch,headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
  const notes=await bearer.schema('platform_dev').from('notes').select('*').order('id');assert.equal(notes.error,null);
  assert.deepEqual(notes.data,i===0?binding.expected.note:[]);
  leased=await pool.connect();lastReady=null;streamKnown=true;
  const ready=x=>{lastReady=x.status;},complete=x=>tags.push(x.text),lost=()=>{streamKnown=false;};
  leased.connection.on('readyForQuery',ready);leased.connection.on('commandComplete',complete);leased.once('error',lost);
  try{
   const before=await identity(leased);receipt.checks['principal_'+i]=before;
   await leased.query('begin isolation level serializable');assert.equal(lastReady,'T');
   await leased.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify(claims)]);
   const session=await leased.query('select * from core_runtime.lock_request_session_v1()');
   assert.equal(session.rowCount,1);assert.equal(session.rows[0].actor_id,claims.sub);assert.equal(session.rows[0].aal,claims.aal);
   const rb=await leased.query('rollback');assert.equal(rb.command,'ROLLBACK');assert.equal(lastReady,'I');
   const after=await identity(leased);assert.equal(after.pid,before.pid);
   receipt.checks['user_'+i]={real_auth_current:true,canonical_session_guard:true,aal:claims.aal,rollback_tag:'ROLLBACK',ready:'I',same_backend_pid:before.pid,
    existing_note_readback:i===0,foreign_note_empty:i===1};
  }finally{
   leased.connection.off('readyForQuery',ready);leased.connection.off('commandComplete',complete);leased.off('error',lost);
  }
  assert.equal(lastReady,'I');leased.release();leased=null;
 }
 const anonymous=createClient(origin,binding.anon_key,{global:{fetch:exactFetch},auth:{persistSession:false,autoRefreshToken:false}});
 const denied=await anonymous.schema('platform_dev').from('notes').select('*');assert.ok(denied.error&&[401,403].includes(denied.status));
 receipt.checks.anonymous_denied=denied.status;
 assert.equal(receipt.checks.principal_0.pid,receipt.checks.principal_1.pid,'actual pooled reuse witness');
 receipt.checks.claims_absent_before_and_after_each_checkout=true;
 receipt.checks.auth_persistence_after_restart=phase==='--after';
 receipt.checks.command_complete=tags;receipt.cleanup.pool='PENDING';completed=true;
}catch(error){receipt.first_error??=typeof error.code==='string'?error.code:error.name;receipt.error_location='private bounded consumer operation; no provider body published';
 if(leased){
  if(streamKnown&&['T','E'].includes(lastReady)){
   try{const r=await leased.query('rollback');receipt.cleanup.failure_rollback=r.command==='ROLLBACK'?'COMMAND_TAG_OBSERVED':'UNKNOWN';}
   catch{receipt.cleanup.failure_rollback='UNKNOWN';streamKnown=false;}
  }else receipt.cleanup.failure_rollback='SKIPPED_UNKNOWN_OR_NO_KNOWN_TRANSACTION';
  leased.release(true);leased=null;receipt.cleanup.connection='DESTROYED_NOT_REUSED';
 }
}finally{
 try{await pool.end();receipt.cleanup.pool='ACKNOWLEDGED';}catch{receipt.cleanup.pool='UNKNOWN';receipt.first_error??='POOL_CLOSE_UNKNOWN';}
 // Keep precisely these new sessions across PG restart; no logout of old users
 // or enrollment/rotation. After successful post-restart proof, only our refresh
 // tokens are locally signed out. Unknown/logout failure stays explicit.
 if(phase==='--after'&&completed&&!receipt.first_error){
  for(let i=0;i<clients.length;i++){
   try{const set=await clients[i].auth.setSession(sessions[i]);assert.equal(set.error,null);
    const out=await clients[i].auth.signOut({scope:'local'});assert.equal(out.error,null);receipt.cleanup['session_'+i]='LOCAL_SIGNOUT_ACKNOWLEDGED';}
   catch{receipt.cleanup['session_'+i]='UNKNOWN';receipt.first_error??='OWN_SESSION_CLEANUP_UNKNOWN';}
  }
 }else receipt.cleanup.sessions='OWNED_PERSISTENCE_WITNESS_RETAINED; no automatic retry';
 receipt.state=completed&&!receipt.first_error&&receipt.cleanup.pool==='ACKNOWLEDGED'?'PASS_INFRASTRUCTURE_ONLY':'FAILED_OR_UNKNOWN';save();
 console.log(JSON.stringify({state:receipt.state,phase,real_auth:completed,role:'cladora_core_runtime',product_e2e:'NOT_RUN',private_receipt_sha256:createHash('sha256').update(readFileSync(receiptPath)).digest('hex')}));
 if(receipt.state!=='PASS_INFRASTRUCTURE_ONLY')process.exitCode=2;
}
