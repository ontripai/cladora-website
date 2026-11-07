/** Existing synthetic infrastructure only. No Core/Offering/membership writer. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,lstatSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
const base='/workspace/private/platform-service-consumer-rehearsal-17';
const mode=process.argv[2];assert.equal(process.argv.length,3);assert.ok(['before','after'].includes(mode));
assert.equal(process.permission?.has('child'),false);assert.equal(process.permission?.has('addons'),false);
for(const key of ['NODE_OPTIONS','NODE_PATH','DATABASE_URL','PGPASSWORD','SUPABASE_SERVICE_ROLE_KEY'])assert.ok(!process.env[key]);
function privateJSON(path){const s=lstatSync(path);assert.ok(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1);assert.equal(realpathSync(path),path);assert.equal(s.mode&0o077,0);return JSON.parse(readFileSync(path));}
const input=privateJSON(base+'/infra-input.private.json'),output=base+'/infra-output';
assert.equal(input.contract,'platform17-existing-infrastructure-probe.v1');
assert.equal(input.origin,'http://127.0.0.1:55421');
assert.equal(input.product_runtime,'NOT_ADMITTED');assert.equal(input.users.length,2);
assert.deepEqual(Object.keys(input).sort(),['contract','expected_note','origin','product_runtime','public_key','source_seal','users'].sort());
const path=output+'/'+mode+'.receipt.json',sessionsPath=output+'/sessions.private.json';
const record={mode,status:'DISPATCHED',first_error:null,scope:'INFRASTRUCTURE_ONLY_NOT_SERVICE',checks:{},actors:[],cleanup:{}};
writeFileSync(path,JSON.stringify(record)+'\n',{flag:'wx',mode:0o600});
const save=()=>writeFileSync(path,JSON.stringify(record,null,2)+'\n',{mode:0o600});
let httpCount=0;
const transport=async(url,options)=>{
 const target=new URL(typeof url==='string'?url:url.url);
 assert.equal(target.origin,input.origin);
 const method=options?.method??'GET';
 if(target.pathname==='/rest/v1/notes')assert.equal(method,'GET');
 else if(['/auth/v1/user','/auth/v1/.well-known/jwks.json'].includes(target.pathname))assert.equal(method,'GET');
 else if(target.pathname==='/auth/v1/token'){
  assert.equal(mode,'before');assert.equal(method,'POST');assert.equal(target.searchParams.get('grant_type'),'password');
 }else if(target.pathname==='/auth/v1/logout'){
  assert.equal(mode,'after');assert.equal(method,'POST');assert.equal(target.searchParams.get('scope'),'local');
 }else throw Error('UNAPPROVED_INFRA_ROUTE');
 assert.ok(++httpCount<=40,'finite probe request budget');
 return fetch(url,{...options,redirect:'error',signal:AbortSignal.timeout(15000)});
};
const make=(token)=>createClient(input.origin,input.public_key,{global:{fetch:transport,...(token?{headers:{Authorization:'Bearer '+token}}:{})},
 auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const clients=[];
const sessions=mode==='after'?privateJSON(sessionsPath).sessions:[];
try{
 for(let i=0;i<2;i++){
  const client=make();clients.push(client);
  if(mode==='before'){
   const result=await client.auth.signInWithPassword({email:input.users[i].email,password:input.users[i].password});assert.equal(result.error,null);
   assert.equal(result.data.user.id,input.users[i].id);
   sessions.push({access_token:result.data.session.access_token,refresh_token:result.data.session.refresh_token});
   writeFileSync(sessionsPath,JSON.stringify({sessions})+'\n',{mode:0o600});
  }
  const user=await client.auth.getUser(sessions[i].access_token),verified=await client.auth.getClaims(sessions[i].access_token);
  assert.equal(user.error,null);assert.equal(verified.error,null);
  const c=verified.data.claims;assert.equal(c.sub,input.users[i].id);assert.equal(user.data.user.id,c.sub);
  assert.equal(c.role,'authenticated');assert.equal(c.aal,'aal1');assert.ok(c.exp>Date.now()/1000);
  assert.match(c.session_id,/^[0-9a-f-]{36}$/);
  const notes=await make(sessions[i].access_token).schema('platform_dev').from('notes').select('*').order('id');assert.equal(notes.error,null);
  assert.deepEqual(notes.data,i===0?input.expected_note:[]);
  record.actors.push({actor:c.sub,session_id:c.session_id,aal:c.aal,role:c.role,issuer:c.iss});
  record.checks['actor_'+i]={real_getUser_getClaims:true,own_note_match:i===0,other_note_empty:i===1};
 }
 const denied=await make().schema('platform_dev').from('notes').select('*');
 assert.ok(denied.error&&[401,403].includes(denied.status));record.checks.anonymous_denied=denied.status;
 record.checks.readback=mode==='after'?'EXACT_EXISTING_NOTE_AND_SAME_ISSUED_SESSIONS':'EXACT_EXISTING_NOTE';
 record.checks.AAL2='NOT_RUN_NOT_PASS';record.checks.Core_role_and_PRODUCT='NOT_RUN_NOT_PASS';
 if(mode==='after'){
  const prior=privateJSON(output+'/before.receipt.json');assert.deepEqual(record.actors,prior.actors);
  for(let i=0;i<2;i++){
   const assigned=await clients[i].auth.setSession(sessions[i]);assert.equal(assigned.error,null);
   const logout=await clients[i].auth.signOut({scope:'local'});assert.equal(logout.error,null);
   record.cleanup['own_session_'+i]='LOCAL_SIGNOUT_ACKNOWLEDGED';
  }
 }else record.cleanup.sessions='TWO_NEW_OWN_SESSIONS_RETAINED_ONLY_FOR_RESTART_WITNESS';
 record.status='PASS_INFRASTRUCTURE_ONLY';
}catch(error){record.first_error=typeof error.code==='string'?error.code:error.name;record.status='FAILED_OR_UNKNOWN';record.cleanup.followup='Platform; no blind resend or existing-user deletion';}
finally{
 record.http_requests=httpCount;save();
 console.log(JSON.stringify({status:record.status,mode,auth:record.status==='PASS_INFRASTRUCTURE_ONLY'?'REAL_AUTH_AAL1':'UNKNOWN',Core_AAL2:'NOT_RUN_NOT_PASS',
  private_receipt_sha256:createHash('sha256').update(readFileSync(path)).digest('hex')}));
 if(record.status!=='PASS_INFRASTRUCTURE_ONLY')process.exitCode=2;
}
