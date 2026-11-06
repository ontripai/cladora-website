import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SQL} from './queries.mjs';
import {terminal,noteCleanup} from './wire.mjs';
const one=r=>{assert.equal(r.rowCount,1);return r.rows[0];};
export const input=f=>({context_id:f.context,workspace_id:f.workspace,offering_id:f.offering,published_revision_id:f.revision});
export const body=(f,key=f.key)=>({...input(f),beneficiary_party_id:f.beneficiary,resource:null,description:'Core17 isolated native source proof',idempotency_key:key});
export const key=(f,k=f.key)=>'core-tx.v1:'+f.workspace+':'+k;
const pause=()=>new Promise(r=>setTimeout(r,20)); // scheduling only, never an authority/expiry clock
export async function snapshot(c,f,keys=[f.key]){return one(await c.query(SQL.scoped,[f.tenant,f.workspace,keys.map(k=>key(f,k))]));}
export function sameCounts(a,b,delta=0){for(const k of ['requests','c03','audit','outbox'])assert.equal(b[k],a[k]+delta,k);}
export async function receipt(c,f,k,command,actor){
 const row=one(await c.query(SQL.receipt,[f.tenant,key(f,k)])),r=row.response_ref;
 assert.ok(r&&typeof r==='object');assert.equal(r.workspace_id,f.workspace);assert.equal(r.idempotency_key,k);assert.match(row.request_hash,/^[a-f0-9]{64}$/);assert.equal(row.actor_id,actor??command?.actor_id,'RECEIPT_ACTOR_BINDING_REQUIRED');assert.equal(r.actor_id,row.actor_id);
 if(command){assert.equal(r.actor_id,command.actor_id);assert.equal(row.actor_id,command.actor_id);assert.equal(row.request_hash,command.request_hash,'ACTUAL_CURRENT_APP_C03_HASH_MUST_MATCH_OBSERVER');assert.equal(r.input_fingerprint,command.input_fingerprint);assert.equal(r.command_id,command.command_id);assert.equal(r.aggregate_id,command.aggregate_id);}
 one(await c.query(SQL.request,[f.tenant,f.workspace,r.aggregate_id]));one(await c.query(SQL.audit,[f.tenant,r.audit_event_id,r.command_id,r.aggregate_id]));one(await c.query(SQL.outbox,[f.tenant,r.outbox_event_id,r.command_id,r.aggregate_id]));return r;
}
export async function waitBlocked(c,trace,blockerPid,runtimeTraces,minimum=1){
 for(let i=0;i<100;i++){
  runtimeTraces.refresh?.();
  const ids=[...new Set(runtimeTraces.map(t=>t.pid).filter(Number.isInteger))];
  if(ids.length){const rows=(await c.query(SQL.waiters,[ids])).rows,map=new Map(rows.map(r=>[r.pid,r]));
   function reaches(pid,seen=new Set()){if(pid===blockerPid)return true;if(seen.has(pid))return false;seen.add(pid);return(map.get(pid)?.blockers??[]).some(p=>reaches(p,seen));}
   const blocked=rows.filter(r=>r.wait_event_type==='Lock'&&reaches(r.pid));
   if(blocked.length>=minimum)return{blocker_pid:blockerPid,blocked:blocked.map(r=>r.pid),graph:rows,dispatched_lock_labels:runtimeTraces.filter(t=>blocked.some(b=>b.pid===t.pid)).map(t=>({pid:t.pid,labels:t.locks,pending_query:t.pending_query}))};
  }await pause();
 }throw Error('REAL_BLOCKING_NOT_OBSERVED_NO_INFERRED_BARRIER');
}
function commandGroup(wait,expected){
 const observed=wait.dispatched_lock_labels;assert.equal(observed.length,2,'TWO_MAIN_COMMAND_LEASES_REQUIRED');
 assert.deepEqual(observed.map(x=>x.labels.at(-1)).sort(),[...expected].sort(),'EXACT_GROUP_KEY_CORRELATION_REQUIRED');
 for(const p of observed)assert.equal(p.pending_query,SQL.keyBarrier,'MAIN_COMMAND_TRANSACTION_BARRIER_REQUIRED');
}
async function beginBarrier(x,f,kind){
 await x.blocker.query('begin');await x.blocker.query("set local lock_timeout='5s'");await x.blocker.query("set local statement_timeout='10s'");
 if(kind==='key')await x.blocker.query(SQL.keyBarrier,['idempotency:'+key(f)]);
 else one(await x.blocker.query(SQL.rowBarrier,[f.agreement]));
 return one(await x.blocker.query('select pg_backend_pid() pid')).pid;
}
async function releaseBarrier(x){const r=await x.blocker.query('commit');assert.equal(r.command,'COMMIT');return terminal(x.blockerTrace,'COMMIT');}
function attach(p){return p.then(value=>({value}),error=>({error}));}
function expectReadDenial(outcome,traces,allowed=['42501','40001']){
 assert.ok(outcome.error,'DENIAL_MUST_NOT_DISCLOSE_A_VALUE');assert.ok(traces.some(t=>t.codes.some(c=>allowed.includes(c))),'REAL_DB_FAILURE_CODE_REQUIRED');
 for(const t of traces.filter(t=>t.queries.some(q=>q==='begin isolation level serializable')))terminal(t,'ROLLBACK');
}
export async function runCase(name,x,f){
 const before=await snapshot(x.owner,f),result={case:name,before};let originalReceipt=null;let pending,barrier=false,expiry=null,revoked=false,firstError;
 try{
  if(['revoke','expiry-wait','current-authority-wait'].includes(name)){const settled=await x.submit(body(f));assert.equal(settled.status,200,'COMMITTED_ORIGINAL_REQUIRED_BEFORE_AUTHORITY_REPLAY');originalReceipt=await receipt(x.owner,f,f.key,x.commands.find(c=>c.idempotency_key===f.key),x.actor);result.original_receipt_id=originalReceipt.receipt_id;assert.equal(originalReceipt.aggregate_id,settled.value.request_id);}
  if(name==='stale'){
   const r=one(await x.write(()=>x.owner.query(SQL.append,[f.agreement,f.tenant,f.workspace,f.provider])));assert.equal(r.value.version,2);
   const out=await attach(x.readAgreement(f));assert.ok(!out.error,'STALE_ORACLE_MUST_NOT_ACCEPT_AN_UNRELATED_FAILURE');assert.equal(out.value.value.agreement_status,'withheld');assert.equal(out.value.value.provider_agreement_id,null);result.stale_native_version=2;result.response=await x.submit(body(f));assert.notEqual(result.response.status,200);assert.ok([403,409].includes(result.response.status),'STALE_MUST_NOT_ACCEPT_AN_UNRELATED503');
  }else if(name==='revoke'){
   await x.write(async()=>one(await x.owner.query(SQL.revoke,[f.membership,x.actor,f.tenant])));revoked=true;
   expectReadDenial(await attach(x.readAgreement(f)),x.runtimeTraces);result.response=await x.submit(body(f));assert.equal(result.response.status,403);result.denied=true;
  }else if(name==='expiry-wait'){
   const initial=one(await x.owner.query(SQL.context,[f.context,f.membership,f.tenant]));assert.equal(initial.ends_at,null);
   expiry=one(await x.write(()=>x.owner.query(SQL.expire,[f.context,f.membership,f.tenant]))).ends_at;
   const pid=await beginBarrier(x,f,'row');barrier=true;pending=attach(x.readAgreement(f));result.wait=await waitBlocked(x.blocker,x.blockerTrace,pid,x.runtimeTraces);
   let expired=false;for(let i=0;i<240;i++){expired=one(await x.blocker.query(SQL.expired,[f.context,f.membership,f.tenant])).expired;if(expired)break;await pause();}assert.equal(expired,true,'DB_CLOCK_EXPIRY_NOT_OBSERVED');
   result.db_clock=one(await x.blocker.query(SQL.clock)).at;result.release=await releaseBarrier(x);barrier=false;expectReadDenial(await pending,x.runtimeTraces);result.response=await x.submit(body(f));assert.equal(result.response.status,403);result.denied=true;
  }else if(name==='current-authority-wait'){
   await x.blocker.query('begin');barrier=true;await x.blocker.query("set local lock_timeout='5s'");await x.blocker.query("set local statement_timeout='10s'");one(await x.blocker.query(SQL.revoke,[f.membership,x.actor,f.tenant]));
   const pid=one(await x.blocker.query('select pg_backend_pid() pid')).pid;pending=attach(x.readAgreement(f));result.wait=await waitBlocked(x.blocker,x.blockerTrace,pid,x.runtimeTraces);
   result.release=await releaseBarrier(x);barrier=false;revoked=true;expectReadDenial(await pending,x.runtimeTraces);result.response=await x.submit(body(f));assert.equal(result.response.status,403);result.denied=true;
  }else if(name==='core503'){
   const baseline=await x.preflight(f);assert.equal(baseline.status,200,'CORE503_BASELINE_MUST_BE_VALID');
   const response=await x.submit(body(f));assert.equal(response.status,503);assert.deepEqual(response.value,{error:{code:'READBACK_REQUIRED'}});
   x.runtimeTraces.refresh?.();const affected=x.runtimeTraces.filter(t=>t.fault_kind==='post-commit-ack');assert.equal(affected.length,1);
   result.terminal=terminal(affected[0],'COMMIT');result.fault='CONTROLLED_DRIVER_ACK_LOSS_AFTER_REAL_COMMIT_ON_CURRENT_APP_NOT_NATIVE_NETWORK_OUTAGE';
   const stored=await receipt(x.owner,f,f.key,x.commands.find(c=>c.idempotency_key===f.key),x.actor);result.canonical_receipt_id=stored.receipt_id;
   result.service=response;result.automatic_resend=false;result.client_state='UNKNOWN_HOLD_EXACT_WIRE_FOR_OWNER_AUTHORIZED_RECOVERY';
  }else if(name==='same-key'){
   const pid=await beginBarrier(x,f,'key');barrier=true;pending=Promise.all([attach(x.submit(body(f))),attach(x.submit(body(f)))]);
   result.wait=await waitBlocked(x.blocker,x.blockerTrace,pid,x.runtimeTraces,2);commandGroup(result.wait,['idempotency:'+key(f),'idempotency:'+key(f)]);result.release=await releaseBarrier(x);barrier=false;const pair=await pending;
   assert.ok(pair.every(o=>!o.error),'UNCAUGHT_HANDLER_FAILURE_STOP');result.responses=pair.map(o=>o.value);
   assert.ok(result.responses.some(r=>r.status===200));assert.equal(result.responses.some(r=>r.value?.error?.code==='READBACK_REQUIRED'),false,'UNKNOWN_STOP_NO_RETRY');
   const commands=x.commands.filter(c=>c.idempotency_key===f.key);assert.ok(commands.length>=1,'ACTUAL_CURRENT_APP_LEDGER_OBSERVATION_REQUIRED');for(const c of commands)assert.equal(c.request_hash,commands[0].request_hash);
   const stored=await receipt(x.owner,f,f.key,commands[0]);sameCounts(before,await snapshot(x.owner,f),1);
   for(const response of result.responses.filter(r=>r.status===200))assert.equal(response.value.request_id,stored.aggregate_id);
   result.state=result.responses.every(r=>r.status===200)?'ONE_EFFECT_BOTH_RESOLVED':'ONE_EFFECT_EXPLICIT_SAME_WIRE_RECOVERY_REQUIRED';result.automatic_resend=false;
  }else if(name==='different-key'){
   const pid=await beginBarrier(x,f,'key');barrier=true;await x.blocker.query(SQL.keyBarrier,['idempotency:'+key(f,f.key+'_second')]);
   pending=Promise.all([attach(x.submit(body(f))),attach(x.submit(body(f,f.key+'_second')))]);result.wait=await waitBlocked(x.blocker,x.blockerTrace,pid,x.runtimeTraces,2);commandGroup(result.wait,['idempotency:'+key(f),'idempotency:'+key(f,f.key+'_second')]);
   result.release=await releaseBarrier(x);barrier=false;const attempts=await pending;assert.ok(attempts.every(o=>!o.error));const pair=attempts.map(o=>o.value);assert.ok(pair.every(r=>r.status===200),'NO_SYNTHETIC_WINNER; unresolved failures need exact recovery');
   assert.notEqual(pair[0].value.request_id,pair[1].value.request_id);const cmds=x.commands;
   await receipt(x.owner,f,f.key,cmds.find(c=>c.idempotency_key===f.key));await receipt(x.owner,f,f.key+'_second',cmds.find(c=>c.idempotency_key===f.key+'_second'));
   sameCounts(before,await snapshot(x.owner,f,[f.key,f.key+'_second']),2);result.applicability='NO_RESERVATION_OR_EXCLUSIVE_CAPACITY_CONFLICT; two independent Requests';result.responses=pair;
  }else if(name==='precommit-atomicity'){
   const r=await x.submit(body(f));assert.equal(r.status,403);assert.deepEqual(r.value,{error:{code:'TRANSACTION_FAILED'}});
   const affected=x.runtimeTraces.filter(t=>t.fault_fired);assert.equal(affected.length,1);assert.ok(affected[0].codes.includes('22012'));
   assert.equal(affected[0].queries.includes('commit'),false);result.terminal=terminal(affected[0],'ROLLBACK');result.staged=[...affected[0].stages];result.SQLSTATE='22012';result.denied=r;
  }else if(name==='precommit-disconnect'){
   const response=await x.submit(body(f));assert.notEqual(response.status,200);x.runtimeTraces.refresh?.();
   const affected=x.runtimeTraces.filter(t=>t.fault_kind==='precommit-disconnect');assert.equal(affected.length,1);const t=affected[0];assert.ok(!t.queries.includes('commit'));assert.match(t.database_transaction_id,/^[1-9][0-9]*$/);
   let status;for(let i=0;i<100;i++){status=one(await x.owner.query(SQL.transactionStatus,[t.database_transaction_id])).state;if(status==='aborted')break;await pause();}assert.equal(status,'aborted','NATIVE_XID_ABORT_MUST_BE_CONFIRMED');
   result.terminal={pid:t.pid,database_transaction_id:t.database_transaction_id,pg_xact_status:'aborted',CommandComplete_ROLLBACK:'NOT_AVAILABLE_ON_DISCONNECTED_SOCKET'};result.response=response;
  }else if(name==='B-populated'){
   const ready=await x.preflight(f);assert.equal(ready.status,200);assert.equal(ready.value.status,'ready');assert.equal(ready.value.source_kind,'workspace');
   const own=await x.readRequests(f);assert.equal(own.value.can_request,true);assert.ok(own.value.beneficiaries.some(p=>p.party_id===f.beneficiary));
   assert.equal(x.commands.length,0,'A09_FIXTURE_MUST_NOT_DISPATCH_A_COMMAND');
   result.handoff={tuple:x.B_selection,offering_id:f.offering,published_revision_id:f.revision,beneficiary_party_id:f.beneficiary,resource:null,draft_text:'Core17 B draft '+f.key};
   result.business_POSTs=0;result.A09='READY_FOR_B_DRAFT_NO_DISPATCH_AND_REAL_A_RESPONSE_JSON_RELEASE; browser execution remains NOT_RUN';
  }else assert.fail('UNKNOWN_CASE');
  const after=await snapshot(x.owner,f,name==='different-key'?[f.key,f.key+'_second']:[f.key]);
  if(!['same-key','different-key'].includes(name))sameCounts(before,after,name==='core503'||originalReceipt!==null?1:0);
  if(originalReceipt)assert.deepEqual(await receipt(x.owner,f,f.key,x.commands.find(c=>c.idempotency_key===f.key),x.actor),originalReceipt,'OLD_RECEIPT_MUST_NOT_BE_REWRITTEN_BY_DENIED_RECOVERY');
  result.after=after;result.state??='PASS_CASE_NATIVE';return result;
 }catch(error){firstError=error;throw error;}finally{
  try{
  // A queued invalidator is NEVER committed by cleanup. Preserve first error;
  // failed cleanup is promoted to UNKNOWN by the outer operator.
  if(barrier&&['same-key','different-key'].includes(name))await x.haltGroup();
  if(barrier){await x.blocker.query('rollback');terminal(x.blockerTrace,'ROLLBACK');}
  if(pending){const outcome=await pending;x.notePending?.(outcome);}
  if(expiry!==null)await x.write(async()=>one(await x.owner.query(SQL.restoreExpiry,[f.context,f.membership,f.tenant,expiry])));
  if(revoked)await x.write(async()=>one(await x.owner.query(SQL.restoreMember,[f.membership,x.actor,f.tenant])));
  if(expiry!==null)assert.equal(one(await x.owner.query(SQL.context,[f.context,f.membership,f.tenant])).ends_at,null);
  if(revoked)assert.equal(one(await x.owner.query(SQL.member,[f.membership,x.actor,f.tenant])).status,'active');
  }catch(cleanup){if(firstError)noteCleanup(firstError,cleanup);else throw cleanup;}
 }
}
