/** Fixed Platform17 HTTP test driver. No alternate domain/authority engine.
 * Two separate invocations deliberately model withheld client ACK then explicit
 * same-command retry. A network timeout never triggers automatic resend.
 */
import assert from 'node:assert/strict';
import {readFileSync,openSync,writeSync,fsyncSync,closeSync,constants,lstatSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {loadInstallerCredentialBindingV1,installerTargetV1,readOwnedInstallerFileV1} from '../lib/core-installer-credential-binding-v1.mjs';
const privateRoot='/workspace/private/cladora-functional-dev-v1';
const runRoot='/workspace/private/platform-service-consumer-rehearsal-17';
const origin='http://localhost:3008',base=origin+'/api/customer/v1/services/';
const key='platform17_controlled_ack_loss_v1';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=n=>JSON.parse(readOwnedInstallerFileV1(privateRoot+'/'+n,privateRoot));
const owned=n=>JSON.parse(readOwnedInstallerFileV1(runRoot+'/'+n,runRoot));
// pg returns timestamptz as Date. Private persisted evidence uses ISO strings;
// compare the same lossless JSON representation on BOTH sides, never omit time.
export const persistedRepresentation=value=>JSON.parse(JSON.stringify(value));
export function retryGate(plan,evidence){
 assert.equal(plan.contract,'platform17.fixed-withheld-ack.v1');
 assert.equal(plan.origin,origin);assert.equal(plan.key,key);
 assert.equal(sha(plan.raw_body),plan.raw_sha256);
 assert.equal(JSON.parse(plan.raw_body).idempotency_key,key);
 assert.equal(evidence.state,'PASS_WITHHELD_CLIENT_ACK_CANONICAL_RECEIPT_OBSERVED');
 assert.equal(evidence.client_outcome,'UNKNOWN_CONTROLLED_ACK_WITHHELD');
 assert.equal(evidence.plan_sha256,sha(JSON.stringify(plan)));
 assert.equal(evidence.post.snapshot.receipts.length,1);
 assert.equal(evidence.post.snapshot.receipts[0].response_ref.aggregate_id,evidence.response.value.request_id);
 return plan.raw_body;
}
function save(name,value){
 const directory=lstatSync(runRoot);assert.ok(directory.isDirectory()&&!directory.isSymbolicLink());
 assert.equal(directory.uid,process.getuid());assert.equal(directory.mode&0o077,0);
 const raw=Buffer.from(JSON.stringify(value,null,2)+'\n');
 const fd=openSync(runRoot+'/'+name,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
 try{assert.equal(writeSync(fd,raw),raw.length);fsyncSync(fd);}finally{closeSync(fd);}
 const dfd=openSync(runRoot,constants.O_RDONLY);try{fsyncSync(dfd);}finally{closeSync(dfd);}
 assert.equal(sha(readFileSync(runRoot+'/'+name)),sha(raw));
}
async function http(path,auth,raw){
 const r=await fetch(base+path,{method:raw?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(30000),
  headers:{cookie:auth.users[0].cookie,...(raw?{origin,'content-type':'application/json'}:{})},...(raw?{body:raw}:{})});
 return {status:r.status,cache:r.headers.get('cache-control'),value:await r.json()};
}
async function snapshot(target,credential,f,keys){
 // Observer is an explicit operator/read-only connection, NOT an additional
 // least-privilege product consumer or a claim that GET proves old COMMIT.
 const client=new pg.Client({host:target.host,port:target.port,database:target.database_name,
  user:credential.principal,password:credential.password,connectionTimeoutMillis:5000,query_timeout:10000});
 const wire=[];let primary,result;
 client.connection.on('commandComplete',m=>wire.push({type:'CommandComplete',tag:m.text}));
 client.connection.on('readyForQuery',m=>wire.push({type:'ReadyForQuery',status:m.status}));
 try{
  await client.connect();await client.query('BEGIN READ ONLY');
  const identity=(await client.query("select pg_backend_pid() pid,current_user::text principal,current_setting('transaction_read_only') read_only,(select oid::int from pg_database where datname=current_database()) oid,(select obj_description(oid,'pg_namespace') from pg_namespace where nspname='core_runtime') marker")).rows[0];
  assert.equal(identity.principal,credential.principal);assert.equal(identity.oid,target.database_oid);
  assert.equal(identity.marker,target.backend_id);assert.equal(identity.read_only,'on');
  const counts=(await client.query("select (select count(*)::int from service_catalog.requests where tenant_id=$1 and workspace_id=$2) requests,(select count(*)::int from platform.idempotency_keys where tenant_id=$1 and key like $3) receipts",[f.tenants[0],f.workspaces[0],'core-tx.v1:'+f.workspaces[0]+':%'])).rows[0];
  const entries=[];
  for(const commandKey of keys){
   const rows=(await client.query('select response_ref from platform.idempotency_keys where tenant_id=$1 and key=$2',[f.tenants[0],'core-tx.v1:'+f.workspaces[0]+':'+commandKey])).rows;
   assert.ok(rows.length<=1);
   if(rows.length){
    const receipt=rows[0].response_ref;
    const requests=(await client.query('select * from service_catalog.requests where tenant_id=$1 and workspace_id=$2 and id=$3',[f.tenants[0],f.workspaces[0],receipt.aggregate_id])).rows;
    assert.equal(requests.length,1);
    const audit=(await client.query('select count(*)::int n from audit.events where id=$1',[receipt.audit_event_id])).rows[0].n;
    const outbox=(await client.query('select count(*)::int n from platform.outbox_events where id=$1',[receipt.outbox_event_id])).rows[0].n;
    assert.equal(audit,1);assert.equal(outbox,1);
    entries.push({key:commandKey,response_ref:receipt,request:persistedRepresentation(requests[0]),audit,outbox});
   }
  }
  await client.query('ROLLBACK');
  assert.ok(wire.some(x=>x.type==='CommandComplete'&&x.tag==='ROLLBACK'));
  assert.deepEqual(wire.at(-1),{type:'ReadyForQuery',status:'I'});
  result={identity,wire,snapshot:{counts,receipts:entries}};
 }catch(error){primary=error;}
 finally{try{await client.end();}catch(error){primary??=error;}}
 if(primary)throw primary;return result;
}
export async function main(phase){
 assert.ok(['withheld','retry','retry-observer-format-fixed','before-restart','after-restart','after-backup'].includes(phase));
 if(phase==='after-backup')assert.equal(owned('post-install-backup.result.json').state,'PASS_BACKUP_INTEGRITY_TOC_ONLY');
 if(phase==='retry-observer-format-fixed'){
  const failed=owned('api-retry.result.json');
  assert.equal(failed.state,'FAILED_OR_UNKNOWN_STOP');
  assert.equal(failed.first_error.code,'ERR_ASSERTION');
  assert.equal(Object.hasOwn(failed,'response'),false);assert.equal(Object.hasOwn(failed,'explicit_retry'),false);
  assert.match(failed.first_error.message,/created_at/); // preserve this exact pre-send failure lineage
 }
 const target=read('core15/service-runtime-binding.json').target;
 const credential=loadInstallerCredentialBindingV1({privateRoot,generation:'v3',bindingPath:privateRoot+'/core15/service-native-v3/installer-binding.json',expectedTarget:installerTargetV1(target)});
 const f=read('core15/service-fixture-private.json'),auth=read('core17-auth-private.json'),proof=read('core17-proof-private.json');
 assert.equal(proof.state,'PASS_REAL_NEXT_BUILD_START_SERVICE_ASSEMBLY');
 const scope={context_id:f.contexts[0],workspace_id:f.workspaces[0]},query=new URLSearchParams(scope);
 const claim={contract:'platform17.api-continuation.v1',phase,state:'ONE_ATTEMPT_NO_AUTO_RETRY',source:'ee883b62cf4a318af3450c506931a969623b8987',at:new Date().toISOString()};
 save('api-'+phase+'.claim.json',claim);
 let e={...claim},primary;
 try{
  const bootstrap=await http('assembly-bootstrap',auth);assert.equal(bootstrap.status,200);
  assert.ok(bootstrap.value.selections.some(x=>x.context_id===scope.context_id&&x.workspace_id===scope.workspace_id));
  if(phase==='withheld'){
   const before=await snapshot(target,credential,f,[key]);assert.equal(before.snapshot.receipts.length,0);
   const body={...scope,offering_id:f.offering,published_revision_id:f.revision,beneficiary_party_id:f.beneficiaries[0],resource:null,
    description:'Platform17 controlled withheld acknowledgment synthetic Request',idempotency_key:key};
   const raw_body=JSON.stringify(body),plan={contract:'platform17.fixed-withheld-ack.v1',origin,key,raw_body,raw_sha256:sha(raw_body)};
   save('withheld-plan.private.json',plan);
   e.before=before;e.plan_sha256=sha(JSON.stringify(plan));e.client_outcome='UNKNOWN_DISPATCHED_NO_ACK';
   save('api-withheld-dispatch.private.json',e); // claim/body durable BEFORE POST
   const response=await http('offering-request-flow',auth,raw_body);
   e.response=response;assert.equal(response.status,200);assert.equal(response.value.status,'submitted');
   // Deliberately withhold this response from the simulated client. This is a
   // controlled boundary fault, not a claim of an actual network timeout.
   e.client_outcome='UNKNOWN_CONTROLLED_ACK_WITHHELD';
   e.post=await snapshot(target,credential,f,[key]);
   assert.equal(e.post.snapshot.counts.requests,before.snapshot.counts.requests+1);
   assert.equal(e.post.snapshot.counts.receipts,before.snapshot.counts.receipts+1);
   assert.equal(e.post.snapshot.receipts[0].response_ref.aggregate_id,response.value.request_id);
   e.state='PASS_WITHHELD_CLIENT_ACK_CANONICAL_RECEIPT_OBSERVED';
  }else if(phase==='retry'||phase==='retry-observer-format-fixed'){
   const plan=owned('withheld-plan.private.json'),old=owned('api-withheld.result.json');
   const raw=retryGate(plan,old),before=await snapshot(target,credential,f,[key]);
   assert.deepEqual(before.snapshot,old.post.snapshot);
   e.explicit_retry='same raw bytes/key; separately invoked by operator; not automatic';
   e.response=await http('offering-request-flow',auth,raw);
   assert.equal(e.response.status,200);assert.deepEqual(e.response.value,old.response.value);
   e.post=await snapshot(target,credential,f,[key]);assert.deepEqual(e.post.snapshot,before.snapshot);
   e.state='PASS_EXPLICIT_SAME_COMMAND_RETRY_ONE_EFFECT';
  }else{
   const old=owned('api-retry-observer-format-fixed.result.json');assert.equal(old.state,'PASS_EXPLICIT_SAME_COMMAND_RETRY_ONE_EFFECT');
   e.post=await snapshot(target,credential,f,[proof.body.idempotency_key,key]);
   assert.equal(e.post.snapshot.receipts.length,2);
   assert.deepEqual(e.post.snapshot.receipts[0].response_ref,proof.receipt);
   const again=await http('requests?'+query,auth);assert.equal(again.status,200);assert.match(again.cache,/no-store/);
   for(const entry of e.post.snapshot.receipts)assert.ok(again.value.requests.some(x=>x.request_id===entry.response_ref.aggregate_id&&x.description===entry.request.description));
   const catalog=await http('catalog?'+query,auth);assert.equal(catalog.status,200);
   assert.ok(catalog.value.offerings.some(x=>x.offering_id===f.offering&&x.revision_id===f.revision));
   e.reads={bootstrap:200,catalog:200,requests:200,same_request_ids:true,cache:'no-store'};
   if(phase==='after-restart'||phase==='after-backup')assert.deepEqual(e.post.snapshot,owned('api-before-restart.result.json').post.snapshot);
   e.state=phase==='after-backup'?'PASS_SAME_REQUESTS_RECEIPTS_AFTER_BACKUP_RESUME':phase==='after-restart'?'PASS_SAME_REQUESTS_RECEIPTS_AFTER_RESTART':'PASS_EXACT_PRE_RESTART_SNAPSHOT';
  }
 }catch(error){primary=error;e.state='FAILED_OR_UNKNOWN_STOP';e.first_error={code:error.code??error.name,message:error.message};}
 try{save('api-'+phase+'.result.json',e);}catch(error){primary??=error;}
 console.log(JSON.stringify({phase,state:e.state,private_receipt:true}));
 if(primary)throw new Error('PLATFORM17_CONTINUATION_STOP_PRIVATE_DIAGNOSTIC');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 assert.equal(process.argv.length,3);
 main(process.argv[2]).catch(()=>{console.error('PLATFORM17_CONTINUATION_STOP_PRIVATE_DIAGNOSTIC');process.exitCode=1;});
}
