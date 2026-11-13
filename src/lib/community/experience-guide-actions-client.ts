/** Frozen lifecycle transport; Core owns receipt/retry settlement. */
import {Ce012GuideTransportError} from './experience-guide-functional-client';
type Action='publish'|'cancel';
const object=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export function createCe012GuideActionsV1(options:{fetch:typeof fetch;context_id:string;workspace_id:string;guide_id:string;version:number;owner:()=>object|null;denied:()=>void;timeoutMs?:number}){
 let pending:{operation:Action;wire:string;command:Record<string,unknown>}|null=null,flight:Promise<void>|null=null,active:Action|null=null,cancel:(()=>void)|null=null;
 async function send(operation:Action,reason?:string){const owner=options.owner();if(!owner)throw new Ce012GuideTransportError('STALE');
  if(pending&&pending.operation!==operation)throw new Ce012GuideTransportError('UNKNOWN');
  const controller=new AbortController();let reject!:(e:Error)=>void;const cancelled=new Promise<never>((_,r)=>{reject=r;});
  cancel=()=>{controller.abort();reject(new Ce012GuideTransportError(pending?'UNKNOWN':'STALE'));};const timer=setTimeout(()=>cancel?.(),options.timeoutMs??15000);
  const current=()=>options.owner()===owner&&!controller.signal.aborted;
  async function request(wire:string){const r=await Promise.race([options.fetch('/api/customer/v1/experience/guides/draft',{method:'POST',cache:'no-store',credentials:'same-origin',headers:{'content-type':'application/json'},body:wire,signal:controller.signal}),cancelled]);
   if(!current())throw new Ce012GuideTransportError('STALE');if(!r.ok){if(r.status===401||r.status===403)options.denied();throw new Ce012GuideTransportError(r.status===503?'NOT_READY':r.status===401||r.status===403?'DENIED':'CONFLICT');}
   const value=await Promise.race([r.json(),cancelled]);if(!current())throw new Ce012GuideTransportError('STALE');return {response:r,value:object(value)};}
  try{if(!pending){const body={context_id:options.context_id,workspace_id:options.workspace_id,guide_id:options.guide_id,expected_version:options.version,operation,idempotency_key:`ce012.lifecycle.${crypto.randomUUID()}`,...(operation==='cancel'?{reason:reason?.trim()}: {})};
    const prepared=await request(JSON.stringify({op:'prepare_lifecycle',request:body})),p=prepared.value,c=object(p?.core_command),subject=object(c?.subject_reference);
    if(p?.contract!=='ce012-prepared-lifecycle.v1'||!c||JSON.stringify(p.request)!==JSON.stringify(body)||!uuid(c.command_id)||!uuid(c.transaction_id)||!uuid(c.actor_id)
     ||c.contract_version!=='core-transaction-command.v2'||c.context_id!==body.context_id||c.workspace_id!==body.workspace_id||c.aggregate_id!==body.guide_id
     ||c.aggregate_type!=='experience_guide'||c.aggregate_version!==body.expected_version+1||c.idempotency_key!==body.idempotency_key
     ||c.permission_code!=='experience.guide.manage'||c.module_code!=='experience_guides'||c.evaluation_purpose!==(operation==='publish'?'experience.guide.publish':'experience.guide.command')
     ||typeof c.input_fingerprint!=='string'||!/^ceg1:[a-f0-9]{64}$/.test(c.input_fingerprint)||!Number.isSafeInteger(c.authority_version)||Number(c.authority_version)<=0
     ||JSON.stringify(c.provider_source_ids)!==JSON.stringify([body.guide_id])||subject?.kind!=='experience.guide'||subject.id!==body.guide_id||subject.version!==body.expected_version||subject.relation!==operation||subject.request_version!==1)throw new Ce012GuideTransportError('NOT_READY');
    pending={operation,command:JSON.parse(JSON.stringify(c)),wire:JSON.stringify({op:'execute_lifecycle',request:body,core_command:c})};
   }
   const {response,value:r}=await request(pending.wire),c=pending.command;
   if(response.status!==200||!r||!['committed','exact_replay'].includes(String(r.outcome))||r.command_id!==c.command_id||r.guide_id!==options.guide_id||r.operation!==pending.operation
    ||r.previous_version!==options.version||r.guide_version!==options.version+1||!uuid(r.receipt_id)||r.idempotency_key!==c.idempotency_key||r.payload_fingerprint!==c.input_fingerprint)throw new Ce012GuideTransportError('UNKNOWN');
   pending=null;
  }catch(e){if(pending)throw new Ce012GuideTransportError('UNKNOWN');throw e instanceof Ce012GuideTransportError?e:new Ce012GuideTransportError('NOT_READY');}
  finally{clearTimeout(timer);cancel=null;}
 }
 return {isBusy:()=>flight!==null,isUncertain:()=>pending!==null,pendingOperation:()=>pending?.operation??null,
  run(operation:Action,reason?:string){if(flight)return active===operation?flight:Promise.reject(new Ce012GuideTransportError('CONFLICT'));active=operation;const task=send(operation,reason);flight=task;void task.finally(()=>{if(flight===task){flight=null;active=null;}}).catch(()=>{});return task;},
  invalidate(){cancel?.();}};
}
export type GuideActionsV1=ReturnType<typeof createCe012GuideActionsV1>;
