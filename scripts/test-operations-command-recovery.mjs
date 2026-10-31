/** Offline real-client/real-codec test. The C03 persistence and authority port below is FAKE, never PG proof. */
import assert from 'node:assert/strict';
import {readFileSync,existsSync,statSync} from 'node:fs';
import path from 'node:path';
import Module,{createRequire} from 'node:module';
import {createHash,webcrypto} from 'node:crypto';
const root=process.cwd(),require=createRequire(path.join(root,'package.json')),ts=require('typescript');
if(!globalThis.crypto)Object.defineProperty(globalThis,'crypto',{value:webcrypto});
const cache=new Map();
function load(file){
 file=path.resolve(root,file);if(cache.has(file))return cache.get(file).exports;
 const mod=new Module(file);cache.set(file,mod);mod.require=id=>{
  if(id.startsWith('.')||id.startsWith('@/')){
   const b=id.startsWith('@/')?path.join(root,'src',id.slice(2)):path.resolve(path.dirname(file),id);
   const p=[b,b+'.ts',b+'.tsx'].find(x=>existsSync(x)&&statSync(x).isFile());if(p)return load(p);
  }return require(id);
 };
 mod._compile(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);return mod.exports;
}
const {createOperationsCommandClient}=load('src/lib/customer/operations-command-client.ts');
const {intentFromWire,receiptFor}=load('src/lib/customer/operations-command.ts');
const CTX='80000000-0000-0000-0000-000000000004',ACTOR='80000000-0000-0000-0000-000000000001',WORKSPACE='80000000-0000-0000-0000-000000000002',TARGET='80000000-0000-0000-0000-000000000074';
const membership='80000000-0000-0000-0000-000000000007',outbox='80000000-0000-0000-0000-000000000008';
const intent={version:1,context_id:CTX,action:'issue',target_id:TARGET,expected_status:'draft',input:{context_id:CTX}};
let checks=0;const eq=(a,b,m)=>{checks++;assert.deepEqual(a,b,m);};const rejects=async(f,m)=>{checks++;await assert.rejects(f,m);};
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),map};};
function fixture(){
 const rows=new Map();let writes=0,audit=0,events=0,revoked=false,lose=null,rollback=false,lock=false,failAck=false,corrupt=false;
 const answer=(state,command=null,receipt=null)=>({version:1,actor_id:ACTOR,context_id:CTX,state,command,receipt});
 const exclusive=async(_name,work)=>{if(lock)throw Error('other_tab');lock=true;try{return await work();}finally{lock=false;}};
 async function transport(phase,context,env){
  if(revoked)throw Error('42501');assert.equal(context,CTX);
  if(phase==='open'){const r=[...rows.values()].find(r=>!r.ack);return r?answer(r.receipt?.outcome??'pending',r.env,r.receipt):answer('clear');}
  const p=intentFromWire(env.wire);assert.equal(p.context_id,CTX);assert.equal(env.fingerprint,createHash('sha256').update(env.wire).digest('hex'));let r=rows.get(env.key);
  if(r&&JSON.stringify(r.env)!==JSON.stringify(env))throw Error('40001');
  if(phase==='lookup')return answer(r?r.receipt?.outcome??'pending':'absent',env,r?.receipt??null);
  if(phase==='reserve'){
   if([...rows.values()].some(x=>!x.ack&&x.env.key!==env.key))throw Error('40001');
   if(!r){r={env:structuredClone(env),receipt:null,ack:false};rows.set(env.key,r);}
   if(lose==='reserve'){lose=null;throw Error('lost_reserve_ack');}
   return answer(r.receipt?.outcome??'pending',r.env,r.receipt);
  }
  assert.ok(r,'No execution without durable reservation');
  if(phase==='ack'){
   assert.ok(r.receipt);r.ack=true;if(failAck){failAck=false;throw Error('lost_ack_response');}return answer('acknowledged',r.env,r.receipt);
  }
  if(!r.receipt){
   if(lose==='before'){lose=null;throw Error('before_commit_loss');}
   // Simulated subtransaction rollback oracle; SQL is NOT being executed.
   if(!rollback){writes++;audit++;events++;}
   const at='2026-10-27T18:00:00Z',result=p.action==='save'?{id:p.target_id,revision:p.input.revision+1}:p.action==='generate'?{id:TARGET,status:'draft',work_order_no:74,replayed:false}:p.action==='issue'?{id:p.target_id,status:'assigned',vendor_id:membership}:p.action==='start'?{id:p.target_id,status:'in_progress',started_at:at}:p.action==='complete'?{id:p.target_id,status:'completed',completed_at:at}:{id:p.target_id,status:'verified',verified_at:at};
   r.receipt={contract_version:'operations-command-receipt.v1',key:env.key,context_id:CTX,workspace_id:WORKSPACE,actor_id:ACTOR,membership_id:membership,authority_revision:1,request_hash:'a'.repeat(64),action:p.action,target_id:p.target_id,fingerprint:env.fingerprint,outcome:rollback?'rejected':'committed',result:rollback?null:result,error_code:rollback?'40001':null,audit_event_id:rollback?null:'1',outbox_event_id:rollback?null:outbox,recorded_at:at};
  }
  if(corrupt&&r.receipt.outcome==='committed')r.receipt.result={};
  if(lose==='after'){lose=null;throw Error('after_commit_loss');}
  return answer(r.receipt.outcome,r.env,r.receipt);
 }
 const make=s=>createOperationsCommandClient(CTX,s,transport,exclusive,()=>{});
 return {rows,transport,make,counts:()=>[writes,audit,events],setLoss:v=>{lose=v;},revoke:v=>{revoked=v;},rollback:()=>{rollback=true;},loseAck:()=>{failAck=true;},corrupt:()=>{corrupt=true;}};
}
const scenarios=[];
const planInput={action:'save',context_id:CTX,id:TARGET,revision:0,asset_id:WORKSPACE,vendor_id:membership,name:'Inspection',anchor:'2026-10-27',unit:'months',every:1,enabled:true,checklist:['Inspect']};
for(const p of [
 {...intent,action:'save',expected_status:null,input:planInput},
 {...intent,action:'save',expected_status:null,input:{...planInput,revision:2}},
 {...intent,action:'generate',expected_status:null,input:{action:'generate',context_id:CTX,plan_id:TARGET,due_on:'2026-10-27'}},
 intent,
 {...intent,action:'start',expected_status:'assigned',input:{context_id:CTX}},
 {...intent,action:'complete',expected_status:'in_progress',input:{context_id:CTX,completion_notes:'Completed'}},
 {...intent,action:'verify',expected_status:'completed',input:{context_id:CTX,verification_notes:'Verified'}}
]){
 const f=fixture(),s=storage(),a=f.make(s);await a.reconcile();f.setLoss('after');await rejects(()=>a.execute(p));
 const env=[...f.rows.values()][0].env;eq(intentFromWire(env.wire),p);const b=f.make(storage());await b.reconcile();eq(b.getState().receipt.action,p.action);
 await f.transport('execute',CTX,env);eq(f.counts(),[1,1,1]);eq(f.rows.size,1);
}
scenarios.push('create-save-generate-issue-start-complete-verify-lost-commit-ack');
for(const loss of ['reserve','before','after']){
 const f=fixture(),s=storage(),first=f.make(s);await first.reconcile();f.setLoss(loss);
 await rejects(()=>first.execute(intent),/loss|lost/);eq(first.getState().ready,false);
 const r=f.make(s);await r.reconcile();
 if(loss==='after'){eq(r.getState().ready,true);eq(f.counts(),[1,1,1]);}
 else{eq(r.getState().unresolved,true);eq(f.counts(),[0,0,0]);await rejects(()=>r.execute({...intent,expected_status:'scheduled'}),/reconcile/);await r.retryExact();eq(f.counts(),[1,1,1]);}
 eq(f.rows.size,1);eq(s.map.size,0);scenarios.push('lost-'+loss+'-remount-exact-recovery');
}
{
 const f=fixture(),s=storage(),a=f.make(s);await a.reconcile();f.setLoss('after');await rejects(()=>a.execute(intent));
 const nextDevice=f.make(storage());await nextDevice.reconcile();eq(nextDevice.getState().ready,true);eq(f.counts(),[1,1,1]);scenarios.push('deleted-storage-and-new-device-server-receipt');
}
{
 const f=fixture(),a=f.make(storage()),b=f.make(storage());await a.reconcile();await b.reconcile();
 const runs=await Promise.allSettled([a.execute(intent),b.execute(intent)]);eq(runs.filter(x=>x.status==='fulfilled').length,1);eq(f.counts(),[1,1,1]);
 const stored=[...f.rows.values()][0].env;await f.transport('execute',CTX,stored);eq(f.counts(),[1,1,1],'Same command does not duplicate issue audit');
 const changed={...stored,wire:JSON.stringify({...intent,expected_status:'scheduled'})};changed.fingerprint=createHash('sha256').update(changed.wire).digest('hex');await rejects(()=>f.transport('reserve',CTX,changed),/40001/);eq(f.counts(),[1,1,1]);scenarios.push('two-tabs-duplicate-and-coherent-changed-body');
}
{
 const f=fixture(),a=f.make(storage());await a.reconcile();f.setLoss('after');await rejects(()=>a.execute(intent));f.revoke(true);const b=f.make(storage());await rejects(()=>b.reconcile(),/42501/);eq(b.getState().ready,false);eq(f.counts(),[1,1,1]);f.revoke(false);await b.reconcile();eq(b.getState().ready,true);scenarios.push('current-authority-before-lookup-replay-and-ack');
}
{
 const f=fixture(),a=f.make(storage());await a.reconcile();f.rollback();const r=await a.execute(intent);eq(r.outcome,'rejected');eq(f.counts(),[0,0,0]);eq(a.getState().ready,true);scenarios.push('simulated-rollback-domain-audit-outbox-oracle');
}
{
 const f=fixture(),s=storage(),a=f.make(s);await a.reconcile();f.loseAck();await rejects(()=>a.execute(intent));eq(a.getState().ready,false);const b=f.make(s);await b.reconcile();eq(b.getState().ready,true);eq(f.counts(),[1,1,1]);scenarios.push('ack-response-loss-does-not-create-another-command');
}
{
 const f=fixture(),oldStorage=storage(),a=f.make(oldStorage);await a.reconcile();f.loseAck();await rejects(()=>a.execute(intent));
 const newer=f.make(storage());await newer.reconcile();f.setLoss('reserve');await rejects(()=>newer.execute({...intent,target_id:WORKSPACE}),/lost_reserve/);
 const reloaded=f.make(oldStorage);await reloaded.reconcile();eq(reloaded.getState().unresolved,true);eq(f.rows.size,2);
 await reloaded.retryExact();eq(reloaded.getState().ready,true);eq(f.counts(),[2,2,2]);eq(oldStorage.map.size,0);
 scenarios.push('older-ack-lost-then-new-device-command-exact-key-recovery');
}
{
 const f=fixture(),a=f.make({getItem:()=>null,setItem:()=>{throw Error('storage_blocked');},removeItem:()=>{}});await a.reconcile();await rejects(()=>a.execute(intent),/storage/);eq(f.counts(),[0,0,0]);eq(f.rows.size,0);scenarios.push('storage-failure-before-dispatch');
}
{
 const f=fixture(),s=storage(),a=f.make(s);await a.reconcile();f.corrupt();await rejects(()=>a.execute(intent));
 eq([...f.rows.values()][0].ack,false,'Malformed domain result cannot be acknowledged');eq(a.getState().ready,false);eq(s.map.size,1);
 const b=f.make(s);await rejects(()=>b.reconcile());eq(b.getState().ready,false);eq(f.counts(),[1,1,1]);scenarios.push('partial-receipt-independent-of-intact-wire-hash');
}
{
 const f=fixture(),a=f.make(storage());await a.reconcile();const r=await a.execute(intent),env=[...f.rows.values()][0].env;
 for(const mutation of [{...r,actor_id:membership},{...r,key:outbox},{...r,fingerprint:'b'.repeat(64)},{...r,result:null},{...r,contract_version:'operations-command-receipt.v0'}]){checks++;assert.throws(()=>receiptFor(env,ACTOR,mutation));}
 checks++;assert.throws(()=>intentFromWire(JSON.stringify({...intent,input:{...intent.input,notes:'unconsumed'}})));
 checks++;assert.throws(()=>intentFromWire(JSON.stringify({...intent,action:'complete',expected_status:'in_progress',input:{context_id:CTX,completion_notes:'hidden\0data'}})));
 for(const input of [
  {...intent,context_id:'ABCDEF00-0000-0000-0000-000000000004',input:{context_id:'ABCDEF00-0000-0000-0000-000000000004'}},
  {...intent,action:'complete',expected_status:'in_progress',input:{context_id:CTX,completion_notes:'broken\ud800'}},
  {...intent,action:'complete',expected_status:'in_progress',input:{context_id:CTX,completion_notes:'Valid',actual_cost:9007199254740992}},
  {...intent,action:'save',expected_status:null,input:{...planInput,name:'CLADORA_PM_UNKNOWN'}},
  {...intent,action:'save',expected_status:null,input:{...planInput,name:'CLADORA_PM_ELEVATOR',checklist:['Forged']}},
  {...intent,action:'save',expected_status:null,input:{...planInput,name:' changed '}}
 ]){checks++;assert.throws(()=>intentFromWire(JSON.stringify(input)));}
 scenarios.push('receipt-and-input-negatives-independent-of-hash');
}
console.log(JSON.stringify({task:'235-1',result:'PASS',checks,scenarios,persistence_and_authority:'FAKE_EXPLICIT_OFFLINE_ONLY',PG_concurrency_Auth:'NOT_RUN_NOT_PASS'},null,2));
