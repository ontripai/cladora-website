'use client';
import {boundOperationsAnswer,intentFromWire,receiptFor,operationsEnvelopeSchema,type OperationsEnvelope,type OperationsIntent,type OperationsReceipt} from './operations-command';
import {checklistV2Enabled,checklistCutoverMode,hasLegacyChecklistHold} from './operations-checklist-cutover';

type StoragePort=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Transport=(phase:'open'|'lookup'|'reserve'|'execute'|'ack',context:string,command:OperationsEnvelope|null)=>Promise<unknown>;
type Exclusive=<T>(name:string,work:()=>Promise<T>)=>Promise<T>;
export type OperationsRecoveryState={ready:boolean;busy:boolean;unresolved:boolean;failed:boolean;receipt:OperationsReceipt|null;recoveryContext:string|null};
const initial:OperationsRecoveryState={ready:false,busy:false,unresolved:false,failed:false,receipt:null,recoveryContext:null};
export function createOperationsCommandClient(context:string,storage:StoragePort,transport:Transport,exclusive:Exclusive,onState:(s:OperationsRecoveryState)=>void){
 let state={...initial},actor='',command:OperationsEnvelope|null=null,owner=false;
 const publish=(delta:Partial<OperationsRecoveryState>)=>{state={...state,...delta};onState(state);};
 const noLegacyHold=()=>{if(hasLegacyChecklistHold(storage))throw Error('legacy_checklist_safe_hold');if(checklistCutoverMode()==='hold')throw Error('checklist_cutover_incomplete');};
 const verifyEnvelope=async(env:OperationsEnvelope)=>{
  intentFromWire(env.wire);
  const actual=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(env.wire)))).map(v=>v.toString(16).padStart(2,'0')).join('');
  if(actual!==env.fingerprint)throw Error('operations_command_fingerprint');
 };
 const commandContext=(env:OperationsEnvelope)=>intentFromWire(env.wire).context_id;
 const storageKey=(original=context)=>`cladora.operations.command.v1:${actor}:${original}`;
 function remember(next:OperationsEnvelope){noLegacyHold();const key=storageKey(commandContext(next));storage.setItem(key,JSON.stringify(next));if(storage.getItem(key)!==JSON.stringify(next))throw Error('operations_storage_unavailable');command=next;if(intentFromWire(next.wire).version===2)publish({ready:false,unresolved:true,receipt:null,recoveryContext:commandContext(next)});}
 const answer=async(phase:Parameters<Transport>[0],env:OperationsEnvelope|null)=>{
  noLegacyHold();if(env)await verifyEnvelope(env);noLegacyHold();
  const requestedContext=env?commandContext(env):context;
  const value=boundOperationsAnswer(await transport(phase,requestedContext,env),phase,requestedContext,actor||undefined);
  if(value.command)await verifyEnvelope(value.command);noLegacyHold();
  if(!actor&&phase!=='open')throw Error('operations_answer_binding');
  if(value.command&&env&&JSON.stringify(value.command)!==JSON.stringify(env))throw Error('operations_command_conflict');
  return value;
 };
 async function reconcileInside(depth=0):Promise<void>{
  if(depth>=3)throw Error('operations_reconciliation_churn');
  const current=await answer('open',null);actor=current.actor_id;
  const local=storage.getItem(storageKey());
  const saved=local?operationsEnvelopeSchema.parse(JSON.parse(local)):null;
  if(saved&&commandContext(saved)!==context)throw Error('operations_storage_context');
  command=saved;
  if(current.command){
   if(saved&&JSON.stringify(saved)!==JSON.stringify(current.command)){
    // Another device may have opened a new command after our ACK committed but its response was lost.
    // Resolve the older exact key first; never discard it based on current domain state.
    const older=await answer('lookup',saved);
    if(older.state!=='committed'&&older.state!=='rejected'){publish({ready:false,unresolved:true,failed:false});return;}
    const receipt=receiptFor(saved,actor,older.receipt),ack=await answer('ack',saved);
    if(ack.state!=='acknowledged'||JSON.stringify(ack.receipt)!==JSON.stringify(receipt))throw Error('operations_ack_unconfirmed');
    storage.removeItem(storageKey(commandContext(saved)));
   }
   remember(current.command);
  }else command=saved;
  if(!command){if(current.state!=='clear')throw Error('operations_missing_command');publish({ready:true,unresolved:false,failed:false,receipt:null,recoveryContext:null});return;}
  intentFromWire(command.wire);
  const seen=await answer('lookup',command);
  if(seen.state==='committed'||seen.state==='rejected'){
   const receipt=receiptFor(command,actor,seen.receipt);
   const ack=await answer('ack',command);
   if(ack.state!=='acknowledged'||JSON.stringify(ack.receipt)!==JSON.stringify(receipt))throw Error('operations_ack_unconfirmed');
   const original=commandContext(command);
   storage.removeItem(storageKey(original));command=null;
   if(original!==context){await reconcileInside(depth+1);return;}
   publish({ready:true,unresolved:false,failed:false,receipt,recoveryContext:null});return;
  }
  if(!['pending','absent'].includes(seen.state)||seen.receipt!==null)throw Error('operations_reconciliation_invalid');
  publish({ready:false,unresolved:true,failed:false,receipt:null,recoveryContext:commandContext(command)});
 }
 async function locked<T>(work:()=>Promise<T>):Promise<T>{
  if(owner)throw Error('operations_busy');owner=true;publish({busy:true});
  try{return await exclusive(`cladora.operations:${context}`,work);}catch(e){publish({ready:false,unresolved:!!command,failed:true});throw e;}finally{owner=false;publish({busy:false});}
 }
 async function executeInside(env:OperationsEnvelope){
  const reserved=await answer('reserve',env);
  if(!['pending','committed','rejected'].includes(reserved.state))throw Error('operations_reservation_failed');
  const result=reserved.state==='pending'?await answer('execute',env):reserved;
  if(!['committed','rejected'].includes(result.state))throw Error('operations_unresolved');
  const receipt=receiptFor(env,actor,result.receipt);
  const ack=await answer('ack',env);
  if(ack.state!=='acknowledged'||JSON.stringify(ack.receipt)!==JSON.stringify(receipt))throw Error('operations_ack_unconfirmed');
  storage.removeItem(storageKey(commandContext(env)));command=null;publish({ready:true,unresolved:false,failed:false,receipt,recoveryContext:null});
  return receipt;
 }
 return {
  getState:()=>({...state}),
  reconcile:()=>locked(reconcileInside),
  execute:(intent:OperationsIntent)=>locked(async()=>{
   if(!state.ready||command)throw Error('operations_reconcile_first');
   noLegacyHold();if(intent.version===2&&!checklistV2Enabled())throw Error('checklist_cutover_inactive');
   if(intent.context_id!==context)throw Error('operations_original_context_required');
   const wire=JSON.stringify(intent);intentFromWire(wire);
   const fingerprint=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(wire)))).map(v=>v.toString(16).padStart(2,'0')).join('');
   const env={key:crypto.randomUUID(),wire,fingerprint};remember(env);
   return executeInside(env);
  }),
  retryExact:()=>locked(async()=>{if(!command||state.ready)throw Error('operations_no_unresolved');if(commandContext(command)!==context)throw Error('operations_return_to_original_context');return executeInside(command);}),
 };
}
export const operationsHttpTransport:Transport=async(phase,context_id,command)=>{
 if(checklistCutoverMode()==='hold')throw Error('checklist_cutover_incomplete');
 const version=checklistV2Enabled()?2:1;
 if(command&&intentFromWire(command.wire).version===2&&version!==2)throw Error('checklist_cutover_inactive');
 const response=await fetch('/api/customer/v1/operations/commands',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({version,phase,context_id,command}),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error(`operations_transport_${response.status}`);
 return response.json();
};
export const browserOperationsExclusive:Exclusive=(name,work)=>{
 if(!navigator.locks)throw Error('operations_exclusive_unavailable');
 return new Promise((resolve,reject)=>{void navigator.locks.request(name,{ifAvailable:true},async lock=>{
  if(!lock){reject(Error('operations_other_tab_busy'));return;}
  try{resolve(await work());}catch(error){reject(error);}
 }).catch(reject);});
};
