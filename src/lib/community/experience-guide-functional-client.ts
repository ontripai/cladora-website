/** Browser transport holder only. The server/Core own commands, authority and receipts. */
export class Ce012GuideTransportError extends Error {
 constructor(readonly code:'UNKNOWN'|'DENIED'|'NOT_READY'|'STALE'|'CONFLICT'){super(code);}
}
type Input={guide_id:string;title:string;step_title:string;step_body:string;target_id:string|null};
type Binding={context_id:string;workspace_id:string;guide_id:string;expected_guide_version:number};
const object=(x:unknown):Record<string,unknown>|null=>x!==null&&typeof x==='object'&&!Array.isArray(x)?x as Record<string,unknown>:null;
export function createCe012GuideHttpCommandsV1(options:{fetch:typeof fetch;binding:Binding;owner:()=>object|null;denied:()=>void;timeoutMs?:number}){
 let pending:{input:string;wire:string;guide:Record<string,unknown>}|null=null;
 let draft:Input|null=null;
 let activeInput:string|null=null;
 let flight:Promise<void>|null=null,cancel:(()=>void)|null=null;
 async function send(input:Input){const owner=options.owner();if(!owner)throw new Ce012GuideTransportError('STALE');
  if(input.guide_id!==options.binding.guide_id)throw new Ce012GuideTransportError('CONFLICT');
  const serialized=JSON.stringify(input);if(pending&&pending.input!==serialized)throw new Ce012GuideTransportError('UNKNOWN');
  if(input.target_id!==null)throw new Ce012GuideTransportError('NOT_READY');
  const controller=new AbortController();let reject!: (e:Error)=>void;
  const cancelled=new Promise<never>((_,r)=>{reject=r;});cancel=()=>{controller.abort();reject(new Ce012GuideTransportError(pending?'UNKNOWN':'STALE'));};
  const timer=setTimeout(()=>cancel?.(),options.timeoutMs??15000);
  const current=()=>options.owner()===owner&&!controller.signal.aborted;
  async function request(wire:string){const response=await Promise.race([options.fetch('/api/customer/v1/experience/guides/draft',{
   method:'POST',credentials:'same-origin',cache:'no-store',headers:{'content-type':'application/json'},body:wire,signal:controller.signal}),cancelled]);
   if(!current())throw new Ce012GuideTransportError('STALE');
   if(!response.ok){if(response.status===401||response.status===403){options.denied();throw new Ce012GuideTransportError(pending?'UNKNOWN':'DENIED');}
    throw new Ce012GuideTransportError(pending?'UNKNOWN':response.status===503?'NOT_READY':'CONFLICT');}
   const value=await Promise.race([response.json(),cancelled]);if(!current())throw new Ce012GuideTransportError('STALE');return {response,value:object(value)};
  }
  try{
   if(!pending){const commandId=crypto.randomUUID();const prepared=await request(JSON.stringify({op:'prepare',...options.binding,command_id:commandId,idempotency_key:`ce012.ui.${commandId}`,
    title:input.title,step_title:input.step_title,instructions:input.step_body}));
    const g=object(prepared.value?.guide_command),c=object(prepared.value?.core_command),payload=object(g?.payload);
    if(prepared.value?.contract!=='ce012-prepared-save.v1'||!g||!c||!payload||g.command_id!==commandId||g.guide_id!==options.binding.guide_id
     ||g.context_id!==options.binding.context_id||g.workspace_id!==options.binding.workspace_id||g.expected_guide_version!==options.binding.expected_guide_version
     ||g.contract!=='ce012-guide-command.v1'||g.version!==1||g.idempotency_key!==`ce012.ui.${commandId}`||g.action!=='save_draft'||payload.document_target!==null||payload.title!==input.title.trim()||payload.step_title!==input.step_title.trim()
     ||payload.instructions!==input.step_body.trim()||typeof payload.step_id!=='string'||!/^[0-9a-f-]{36}$/i.test(payload.step_id)||typeof g.payload_fingerprint!=='string'||!/^sha256:[a-f0-9]{64}$/.test(g.payload_fingerprint)
     ||c.contract_version!=='core-transaction-command.v2'||c.command_id!==g.command_id||c.context_id!==g.context_id||c.workspace_id!==g.workspace_id
     ||c.aggregate_id!==g.guide_id||c.aggregate_type!=='experience_guide'||c.aggregate_version!==options.binding.expected_guide_version+1
     ||c.idempotency_key!==g.idempotency_key||c.input_fingerprint!==g.payload_fingerprint
     ||c.permission_code!=='experience.guide.manage'||c.module_code!=='experience_guides'||c.evaluation_purpose!=='experience.guide.command')throw new Ce012GuideTransportError('NOT_READY');
    const snapshot=JSON.parse(JSON.stringify({op:'execute',guide_command:g,core_command:c}));
    pending={input:serialized,wire:JSON.stringify(snapshot),guide:snapshot.guide_command};
   }
   const result=await request(pending.wire),r=object(result.value?.receipt),g=pending.guide;
   if(result.response.status===202||result.value?.outcome!=='saved'||!r||r.contract!=='ce012-guide-command.v1'||r.version!==1
    ||r.command_id!==g.command_id||r.context_id!==g.context_id||r.workspace_id!==g.workspace_id||r.guide_id!==g.guide_id
    ||r.previous_guide_version!==g.expected_guide_version||r.resulting_guide_version!==Number(g.expected_guide_version)+1
    ||r.action!=='save_draft'||r.authority!=='verified'||r.entitlement!=='verified'||r.document_decision_id!==null
    ||r.idempotency_key!==g.idempotency_key||r.payload_fingerprint!==g.payload_fingerprint||r.document_target!==null)throw new Ce012GuideTransportError('UNKNOWN');
   pending=null;draft=null;
  }catch(e){if(pending)throw new Ce012GuideTransportError('UNKNOWN');throw e instanceof Ce012GuideTransportError?e:new Ce012GuideTransportError('NOT_READY');}
  finally{clearTimeout(timer);cancel=null;}
 }
 return {isUncertain:()=>pending!==null,rememberDraft:(input:Input)=>{if(!pending)draft={...input};},retainedDraft:()=>pending?JSON.parse(pending.input) as Input:draft?{...draft}:null, saveDraft(input:Input){if(flight)return activeInput===JSON.stringify(input)?flight:Promise.reject(new Ce012GuideTransportError('CONFLICT'));activeInput=JSON.stringify(input);const task=send({...input});flight=task;
  void task.finally(()=>{if(flight===task){flight=null;activeInput=null;}}).catch(()=>{});return task;},invalidate(){cancel?.();}};
}
