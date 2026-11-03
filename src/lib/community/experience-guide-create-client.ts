/** Browser transport only. Core remains the only command/receipt settlement engine. */
import {ce012CommandSchema} from './experience-guide-schema';
import {Ce012GuideTransportError} from './experience-guide-functional-client';
export type GuideCreateInput={title:string;step_title:string;instructions:string;reason:string};
const obj=(v:unknown):Record<string,unknown>|null=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null;
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export function createCe012GuideCreatorV1(options:{fetch:typeof fetch;context_id:string;workspace_id:string;owner:()=>object|null;denied:()=>void;timeoutMs?:number}){
 let draft:GuideCreateInput|null=null,retained:{input:string;command:ReturnType<typeof ce012CommandSchema.parse>;wire:string|null;fingerprint:string|null}|null=null;
 let uncertain=false,flight:Promise<string>|null=null,active:string|null=null,cancel:(()=>void)|null=null;
 async function send(input:GuideCreateInput){const epoch=options.owner();if(!epoch)throw new Ce012GuideTransportError('STALE');
  const serialized=JSON.stringify(input);if(retained&&retained.input!==serialized){if(uncertain)throw new Ce012GuideTransportError('UNKNOWN');retained=null;}
  if(!retained){const command_id=crypto.randomUUID(),guide_id=crypto.randomUUID(),step_id=crypto.randomUUID();
   const command=ce012CommandSchema.parse({type:'create_guide',command_id,idempotency_key:`ce012.create.${command_id}`,
    context_id:options.context_id,workspace_id:options.workspace_id,expected_version:0,reason:input.reason,
    guide_id,title:input.title,audience:{kind:'workspace'},steps:[{id:step_id,title:input.step_title,body:input.instructions,references:[]}]});
   retained={input:serialized,command,wire:null,fingerprint:null};}
  const snapshot=retained,controller=new AbortController();let reject!:(error:Error)=>void;
  const cancelled=new Promise<never>((_,r)=>{reject=r;});cancel=()=>{controller.abort();reject(new Ce012GuideTransportError(uncertain?'UNKNOWN':'STALE'));};
  const timer=setTimeout(()=>cancel?.(),options.timeoutMs??15000),current=()=>options.owner()===epoch&&!controller.signal.aborted;
  async function request(wire:string){const r=await Promise.race([options.fetch('/api/customer/v1/experience/guides/draft',{
   method:'POST',cache:'no-store',credentials:'same-origin',headers:{'content-type':'application/json'},body:wire,signal:controller.signal}),cancelled]);
   if(!current())throw new Ce012GuideTransportError('STALE');
   if(!r.ok){if(r.status===401||r.status===403)options.denied();throw new Ce012GuideTransportError(r.status===401||r.status===403?'DENIED':r.status===503?'NOT_READY':'CONFLICT');}
   const body=await Promise.race([r.json(),cancelled]);if(!current())throw new Ce012GuideTransportError('STALE');return {response:r,value:obj(body)};
  }
  try{
   if(!snapshot.wire){const p=await request(JSON.stringify({op:'prepare_create',command:snapshot.command}));
    const c=obj(p.value?.core_command),g=ce012CommandSchema.safeParse(p.value?.command),expected=snapshot.command;
    if(p.value?.contract!=='ce012-prepared-create.v1'||!g.success||JSON.stringify(g.data)!==JSON.stringify(expected)||!c
     ||expected.type!=='create_guide'||!uuid(c.transaction_id)||!uuid(c.actor_id)||!Number.isSafeInteger(c.authority_version)||Number(c.authority_version)<=0
     ||c.contract_version!=='core-transaction-command.v2'||c.command_id!==expected.command_id||c.context_id!==options.context_id
     ||c.workspace_id!==options.workspace_id||c.aggregate_type!=='experience_guide'||c.aggregate_id!==expected.guide_id||c.aggregate_version!==1
     ||c.idempotency_key!==expected.idempotency_key||typeof c.input_fingerprint!=='string'||!/^sha256:[a-f0-9]{64}$/.test(c.input_fingerprint)
     ||c.permission_code!=='experience.guide.manage'||c.module_code!=='experience_guides'||c.evaluation_purpose!=='experience.guide.command'
     ||JSON.stringify(c.provider_source_ids)!==JSON.stringify([expected.guide_id,expected.steps[0].id])
     ||JSON.stringify(c.subject_reference)!==JSON.stringify({kind:'experience.guide',id:expected.guide_id,version:1,relation:'create_guide',request_version:1}))throw new Ce012GuideTransportError('NOT_READY');
    snapshot.fingerprint=c.input_fingerprint;snapshot.wire=JSON.stringify({op:'execute_create',command:g.data,core_command:c});
   }
   // From the first execution dispatch, every unresolved response retains this exact wire/key.
   uncertain=true;
   const result=await request(snapshot.wire),r=result.value,g=snapshot.command;
   if(g.type!=='create_guide'||result.response.status!==200||r?.outcome!=='created'||r.command_id!==g.command_id||r.guide_id!==g.guide_id
    ||r.version!==1||!uuid(r.receipt_id)||r.idempotency_key!==g.idempotency_key||r.payload_fingerprint!==snapshot.fingerprint||typeof r.replayed!=='boolean')throw new Ce012GuideTransportError('UNKNOWN');
   uncertain=false;retained=null;draft=null;return g.guide_id;
  }catch(e){if(uncertain)throw new Ce012GuideTransportError('UNKNOWN');throw e instanceof Ce012GuideTransportError?e:new Ce012GuideTransportError('NOT_READY');}
  finally{clearTimeout(timer);cancel=null;}
 }
 return {pendingGuideId:()=>uncertain&&retained?.command.type==='create_guide'?retained.command.guide_id:null,isUncertain:()=>uncertain,retainedDraft:()=>retained?JSON.parse(retained.input) as GuideCreateInput:draft?{...draft}:null,
  rememberDraft:(v:GuideCreateInput)=>{if(!retained)draft={...v};},
  create(input:GuideCreateInput){const serialized=JSON.stringify(input);if(flight)return active===serialized?flight:Promise.reject(new Ce012GuideTransportError('CONFLICT'));
   active=serialized;const task=send({...input});flight=task;void task.finally(()=>{if(flight===task){flight=null;active=null;}}).catch(()=>{});return task;},
  invalidate(){cancel?.();}};
}
export type GuideCreatorV1=ReturnType<typeof createCe012GuideCreatorV1>;
