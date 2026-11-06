'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { z } from 'zod';
import type { Language } from '@/types';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { createServiceRequestSchema, type CreateServiceRequest } from '@/lib/customer/service-request-schema';
import { serviceRequestReadSchema, serviceRequestResultSchema } from '@/lib/customer/service-request-read-schema';
import {
  SERVICE_OFFERING_REQUEST_FLOW_CONTRACT,
  serviceOfferingRequestPreflightResultV1Schema,
  serviceOfferingRequestPublicInputV1Schema,
  type ServiceOfferingRequestPreflightResultV1,
  type ServiceOfferingRequestPublicInputV1,
} from '@/lib/customer/service-offering-request-flow-contract';
import { SERVICE_REQUEST_CUSTODY_HEADER, sameServiceRequestCustodyScope, type ServiceRequestCustodyRecord, type ServiceRequestCustodyScope } from '@/lib/customer/service-request-custody';
import type { ServiceRequestCustody } from '@/lib/customer/use-service-request-custody';
import { ServicePilotSelfPerson } from './ServicePilotSelfPerson';
import { ServiceResourcePicker } from './ServiceResourcePicker';
const copy = {
  en: { serviceError:'Choose a service.', personError:'Choose who this request is for.', resourceError:'Choose a named resource.', descriptionError:'Enter a description between 5 and 5,000 characters.', title:'Service requests', offering:'Service', beneficiary:'Request for', choose:'Choose', description:'Describe the request', submit:'Send request', retry:'Retry the same request', loading:'Loading requests…', unavailable:'Service requests are unavailable for this account.', sourceLoading:'Checking the current provider and source…', sourceNotReady:'This request is not ready because its official provider source is unavailable.', sourceDenied:'The selected source is no longer available to this account.', sourceChanged:'The offering or selected source changed. Refresh the catalogue.', noParty:'No verified person is linked to this membership. Contact the workspace manager.', disclaimer:'Sending a request does not accept a price, create an order or authorize payment.', error:'The result is unknown. Retry the same request to check it.', conflict:'The offering or request changed. Refresh the catalogue before sending another request.', refresh:'Refresh catalogue', success:'Request received; no payment obligation was created.', invalid:'Choose a service, source and person and enter at least five characters.', empty:'No requests yet.', submitted:'Received' },
  ro: { serviceError:'Alege un serviciu.', personError:'Alege pentru cine este cererea.', resourceError:'Alege o resursă denumită.', descriptionError:'Introdu o descriere între 5 și 5.000 de caractere.', title:'Cereri de servicii', offering:'Serviciu', beneficiary:'Cerere pentru', choose:'Alege', description:'Descrie cererea', submit:'Trimite cererea', retry:'Reîncearcă aceeași cerere', loading:'Se încarcă cererile…', unavailable:'Cererile de servicii nu sunt disponibile pentru acest cont.', sourceLoading:'Se verifică furnizorul și sursa curentă…', sourceNotReady:'Cererea nu este disponibilă deoarece sursa oficială a furnizorului lipsește.', sourceDenied:'Sursa selectată nu mai este disponibilă acestui cont.', sourceChanged:'Oferta sau sursa selectată s-a schimbat. Actualizează catalogul.', noParty:'Nicio persoană verificată nu este asociată acestei calități de membru. Contactează administratorul.', disclaimer:'Trimiterea cererii nu acceptă un preț, nu creează o comandă și nu autorizează plata.', error:'Rezultatul este necunoscut. Reîncearcă aceeași cerere pentru verificare.', conflict:'Oferta sau cererea s-a schimbat. Actualizează catalogul înainte de o nouă cerere.', refresh:'Actualizează catalogul', success:'Cerere primită; nu s-a creat o obligație de plată.', invalid:'Alege serviciul, sursa și persoana și introdu minimum cinci caractere.', empty:'Nu există încă cereri.', submitted:'Primită' },
  fa: { serviceError:'یک خدمت انتخاب کنید.', personError:'شخصی را که درخواست برای اوست انتخاب کنید.', resourceError:'یک منبع نام‌دار انتخاب کنید.', descriptionError:'شرحی بین ۵ تا ۵۰۰۰ نویسه وارد کنید.', title:'درخواست خدمات', offering:'خدمت', beneficiary:'درخواست برای', choose:'انتخاب کنید', description:'شرح درخواست', submit:'ارسال درخواست', retry:'تکرار همان درخواست', loading:'در حال دریافت درخواست‌ها…', unavailable:'ثبت درخواست خدمت برای این حساب فعال نیست.', sourceLoading:'ارائه‌دهنده و منبع جاری در حال بررسی است…', sourceNotReady:'این درخواست به‌دلیل نبود منبع رسمی ارائه‌دهنده آماده نیست.', sourceDenied:'منبع انتخاب‌شده دیگر برای این حساب در دسترس نیست.', sourceChanged:'عرضه یا منبع انتخاب‌شده تغییر کرده است؛ کاتالوگ را به‌روز کنید.', noParty:'شخص تأییدشده‌ای به این عضویت متصل نیست؛ با مدیر فضای کاری تماس بگیرید.', disclaimer:'ارسال درخواست به معنی قبول قیمت، ایجاد سفارش یا اجازهٔ پرداخت نیست.', error:'نتیجه مشخص نیست؛ همان درخواست را برای بررسی نتیجه تکرار کنید.', conflict:'عرضه یا درخواست تغییر کرده است؛ پیش از درخواست جدید کاتالوگ را به‌روز کنید.', refresh:'به‌روزرسانی کاتالوگ', success:'درخواست دریافت شد؛ تعهد پرداختی ایجاد نشد.', invalid:'خدمت، منبع و شخص را انتخاب و شرحی با حداقل پنج نویسه وارد کنید.', empty:'هنوز درخواستی ثبت نشده است.', submitted:'دریافت‌شده' },
};
type Read = z.infer<typeof serviceRequestReadSchema>;
type Offering = { offering_id:string; revision_id:string; labels:Record<Language,string>; acquisition_mode:string;
  request_flow_contract?: typeof SERVICE_OFFERING_REQUEST_FLOW_CONTRACT };
type PendingCommand = (
  | { protocol:'service-request-command.v1'; endpoint:'/api/customer/v1/services/requests'; body:CreateServiceRequest }
  | { protocol:typeof SERVICE_OFFERING_REQUEST_FLOW_CONTRACT; endpoint:'/api/customer/v1/services/offering-request-flow'; body:ServiceOfferingRequestPublicInputV1 }) & { wire?: string; custodyRecord?: ServiceRequestCustodyRecord };
type ReadyPreflight = Extract<ServiceOfferingRequestPreflightResultV1, { status:'ready' }>;
type FlowStatus = 'idle'|'loading'|'ready'|'denied'|'conflict'|'not_ready'|'retry';
type FlowState = { key:string; status:FlowStatus; preflight:ReadyPreflight|null };
type CustomerServiceRequestsProps = {custody?:ServiceRequestCustody;custodyScope?:ServiceRequestCustodyScope;contextId:string;workspaceId:string;lang:Language;offerings:Offering[];onRefreshCatalog?:()=>Promise<Offering[]>;onCommandCustodyChange?:(held:boolean)=>void};
const commandFailureSchema=z.strictObject({error:z.strictObject({code:z.string().min(1)})});
const definitiveNotReadyCodes=new Set(['SERVICE_S01_NOT_READY','SERVICE_S02_NOT_READY','SERVICE_S03_NOT_READY','ELIGIBILITY_SOURCE_NOT_READY','RUNTIME_BINDING_INACTIVE']);
// Scope identity owns all form and pending-command state even when a caller
// rerenders this component without supplying its own React key.
export function CustomerServiceRequests(props:CustomerServiceRequestsProps) {
  return <CustomerServiceRequestsScope key={`${props.contextId}:${props.workspaceId}:${props.custody?.owner ?? 'ordinary'}`} {...props}/>;
}
function CustomerServiceRequestsScope({contextId,workspaceId,lang,offerings,onRefreshCatalog,onCommandCustodyChange,custody,custodyScope}:CustomerServiceRequestsProps) {
  const fetch = useDashboardFetch(); const t=copy[lang];
  const recovered: PendingCommand|null = custody?.record && custodyScope && sameServiceRequestCustodyScope(custody.record.scope,custodyScope)
    ? {protocol:SERVICE_OFFERING_REQUEST_FLOW_CONTRACT,endpoint:custody.record.endpoint,body:serviceOfferingRequestPublicInputV1Schema.parse(JSON.parse(custody.record.wire)),wire:custody.record.wire,custodyRecord:custody.record}:null;
  const commandHeld=useRef(Boolean(recovered));
  const fieldId=useId();
  const [fieldErrors,setFieldErrors]=useState({offering:false,party:false,resource:false,description:false});
  const offeringRef=useRef<HTMLSelectElement>(null); const partyRef=useRef<HTMLSelectElement>(null); const descriptionRef=useRef<HTMLTextAreaElement>(null);
  const [data,setData]=useState<Read|null>(null); const [notice,setNotice]=useState('');
  const [offering,setOffering]=useState(recovered?.body.offering_id??''); const [party,setParty]=useState(recovered?.body.beneficiary_party_id??''); const [description,setDescription]=useState(recovered?.body.description??'');
  const [pending,setPending]=useState<PendingCommand|null>(recovered); const [busy,setBusy]=useState(false); const [conflict,setConflict]=useState(false);
  const [pendingUnknown,setPendingUnknown]=useState(Boolean(recovered));
  const [resource,setResource]=useState<ServiceOfferingRequestPublicInputV1['resource']>(recovered?.protocol===SERVICE_OFFERING_REQUEST_FLOW_CONTRACT?recovered.body.resource:null);
  const [flowState,setFlowState]=useState<FlowState>({key:'',status:'idle',preflight:null}); const [flowAttempt,setFlowAttempt]=useState(0);
  const [readStatus,setReadStatus]=useState<'loading'|'ready'|'denied'|'session'|'retry'>('loading'); const [readAttempt,setReadAttempt]=useState(0);
  const alive=useRef(true); const writeAbort=useRef<AbortController|null>(null); const submitting=useRef(false);
  const query=new URLSearchParams({context_id:contextId,workspace_id:workspaceId}).toString();
  const selectedOffering=offerings.find(item=>item.offering_id===offering);
  // Every non-reservation Offering uses the V14 server flow. The legacy write
  // endpoint is retained for old clients, but this application never bypasses
  // missing S01/S02/S03 providers through that endpoint.
  const usesV14Flow=Boolean(selectedOffering&&selectedOffering.acquisition_mode!=='reservation');
  const selectedOfferingId=selectedOffering?.offering_id??'';
  const selectedRevisionId=selectedOffering?.revision_id??'';
  const flowKey=usesV14Flow&&selectedOffering
    ? `${contextId}:${workspaceId}:${selectedOfferingId}:${selectedRevisionId}` : '';
  const flowStatus:FlowStatus=flowKey===''?'idle':flowState.key===flowKey?flowState.status:'loading';
  const flowPreflight=flowState.key===flowKey?flowState.preflight:null;
  useEffect(()=>{alive.current=true;const controller=new AbortController();
    void fetch(`/api/customer/v1/services/requests?${query}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error(response.status===401?'session':response.status===403||response.status===404?'denied':'retry');return serviceRequestReadSchema.parse(await response.json());})
      .then(value=>{if(!controller.signal.aborted){setData(value);setReadStatus('ready');}})
      .catch(reason=>{if(!controller.signal.aborted)setReadStatus(reason instanceof Error&&['session','denied'].includes(reason.message)?reason.message as 'session'|'denied':'retry');});
    return ()=>{alive.current=false;controller.abort();writeAbort.current?.abort();};
  },[fetch,query,readAttempt]);
  useEffect(()=>{
    if(!usesV14Flow||!selectedOfferingId||!selectedRevisionId)return;
    const controller=new AbortController();
    const params=new URLSearchParams({context_id:contextId,workspace_id:workspaceId,offering_id:selectedOfferingId,published_revision_id:selectedRevisionId});
    void fetch(`/api/customer/v1/services/offering-request-flow?${params}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal})
      .then(async response=>{if(!response.ok){if(response.status===403)throw new Error('denied');if(response.status===409)throw new Error('conflict');if(response.status===503)throw new Error('not_ready');throw new Error('retry');}return serviceOfferingRequestPreflightResultV1Schema.parse(await response.json());})
      .then(value=>{if(!controller.signal.aborted&&value.status==='ready'){if(!commandHeld.current)setResource(null);setFlowState({key:flowKey,status:'ready',preflight:value});}})
      .catch(reason=>{if(!controller.signal.aborted)setFlowState({key:flowKey,status:reason instanceof Error&&['denied','conflict','not_ready'].includes(reason.message)?reason.message as 'denied'|'conflict'|'not_ready':'retry',preflight:null});});
    return()=>controller.abort();
  },[contextId,workspaceId,selectedOfferingId,selectedRevisionId,usesV14Flow,flowKey,flowAttempt,fetch]);
  async function refreshConflict(){
    if(busy||!onRefreshCatalog)return;
    setBusy(true);
    try {
      const updatedOfferings=await onRefreshCatalog();
      const response=await fetch(`/api/customer/v1/services/requests?${query}`,{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)throw new Error(response.status===401?'session':response.status===403||response.status===404?'denied':'retry');
      const updated=serviceRequestReadSchema.parse(await response.json());
      if(!alive.current)return;
      const preserveUnknown=Boolean(pending&&pendingUnknown);
      setData(updated);setConflict(false);setNotice('');setFlowState({key:'',status:'idle',preflight:null});setFlowAttempt(value=>value+1);
      if(!preserveUnknown){
        if(custody&&pending?.custodyRecord)await custody.release(pending.custodyRecord);
        if(!alive.current)return;commandHeld.current=false;setPending(null);setPendingUnknown(false);onCommandCustodyChange?.(false);
      }
      if(!preserveUnknown&&!updatedOfferings.some(item=>item.offering_id===offering&&item.acquisition_mode!=='reservation'))setOffering('');
      if(!preserveUnknown&&!updated.beneficiaries.some(item=>item.party_id===party))setParty('');
    }catch(reason){if(alive.current){
      if(reason instanceof Error&&(reason.message==='denied'||reason.message==='session')){
        setData(null);setReadStatus(reason.message);
      }
      setNotice(reason instanceof Error&&reason.message==='denied'?t.unavailable:reason instanceof Error&&reason.message==='session'?lang==='fa'?'نشست شما نیاز به بررسی دوباره دارد؛ دوباره وارد شوید.':lang==='ro'?'Sesiunea necesită verificare; autentifică-te din nou.':'Your session needs verification; sign in again.':lang==='fa'?'به‌روزرسانی انجام نشد؛ اتصال را بررسی و دوباره تلاش کنید.':lang==='ro'?'Actualizarea a eșuat; verifică conexiunea și reîncearcă.':'Refresh failed; check your connection and try again.');}}
    finally{if(alive.current)setBusy(false);}
  }
  async function submit(){
    if(submitting.current||conflict)return;
    const selected=offerings.find(item=>item.offering_id===offering);
    let command=pending;
    if(!command){if(usesV14Flow&&flowStatus!=='ready'){setNotice(flowStatus==='denied'?t.sourceDenied:flowStatus==='conflict'?t.sourceChanged:t.sourceNotReady);return;}
      const value={context_id:contextId,workspace_id:workspaceId,offering_id:offering,published_revision_id:selected?.revision_id,
        beneficiary_party_id:party,...(usesV14Flow?{resource}:{}),description,idempotency_key:crypto.randomUUID()};
      const parsed=usesV14Flow?serviceOfferingRequestPublicInputV1Schema.safeParse(value):createServiceRequestSchema.safeParse(value);
      if(!parsed.success){
        const needsResource=usesV14Flow&&flowPreflight?.source_kind==='resources'&&resource===null;
        const fields={offering:parsed.error.issues.some(i=>i.path[0]==='offering_id'||i.path[0]==='published_revision_id'),party:parsed.error.issues.some(i=>i.path[0]==='beneficiary_party_id'),resource:needsResource||parsed.error.issues.some(i=>i.path[0]==='resource'),description:parsed.error.issues.some(i=>i.path[0]==='description')};
        setFieldErrors(fields);setNotice(t.invalid);
        (fields.offering?offeringRef:fields.party?partyRef:descriptionRef).current?.focus();return;
      }
      if(usesV14Flow&&flowPreflight?.source_kind==='resources'&&resource===null){setFieldErrors(old=>({...old,resource:true}));setNotice(t.invalid);return;}
      setFieldErrors({offering:false,party:false,resource:false,description:false});
      command=usesV14Flow
        ? {protocol:SERVICE_OFFERING_REQUEST_FLOW_CONTRACT,endpoint:'/api/customer/v1/services/offering-request-flow',body:serviceOfferingRequestPublicInputV1Schema.parse(parsed.data)}
        : {protocol:'service-request-command.v1',endpoint:'/api/customer/v1/services/requests',body:createServiceRequestSchema.parse(parsed.data)};
      commandHeld.current=true;setPending(command);setPendingUnknown(false);onCommandCustodyChange?.(true);}
    submitting.current=true;setBusy(true);setNotice('');const controller=new AbortController();writeAbort.current=controller;
    try {
      if(custody){
        if(!custodyScope||command.protocol!==SERVICE_OFFERING_REQUEST_FLOW_CONTRACT)throw new Error('SERVICE_CUSTODY_SCOPE');
        const record=command.custodyRecord??await custody.capture(custodyScope,command.wire??JSON.stringify(command.body));
        command={...command,wire:record.wire,custodyRecord:record};
        if(!alive.current||controller.signal.aborted)return;setPending(command);
        await custody.beforeDispatch(record);
      }
      if(!alive.current||controller.signal.aborted)return;
      const response=await fetch(command.endpoint,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(command.custodyRecord?{[SERVICE_REQUEST_CUSTODY_HEADER]:command.custodyRecord.owner}:{})},body:command.wire??JSON.stringify(command.body),signal:controller.signal});
      if(!response.ok){const failureCode=response.status===503?await response.json().then(value=>commandFailureSchema.parse(value).error.code).catch(()=>null):null;if(alive.current&&!controller.signal.aborted){
        if(response.status===401||response.status===403){setData(null);setReadStatus(response.status===401?'session':'denied');setNotice('');}
        else if(response.status===503){const definitive=failureCode!==null&&definitiveNotReadyCodes.has(failureCode);if(!definitive)setPendingUnknown(true);setNotice(definitive?t.sourceNotReady:t.error);}
        else{const definitive=response.status===409;if(!definitive)setPendingUnknown(true);setConflict(definitive);setNotice(definitive?t.conflict:t.error);}
      }return;}
      serviceRequestResultSchema.parse(await response.json());
      if(!alive.current||controller.signal.aborted)return;
      if(custody&&command.custodyRecord)await custody.release(command.custodyRecord);
      if(!alive.current||controller.signal.aborted)return;commandHeld.current=false;setPending(null);setPendingUnknown(false);onCommandCustodyChange?.(false);setDescription('');setNotice(t.success);
      // Confirmed writes remain confirmed even when refreshing history fails.
      try {const read=await fetch(`/api/customer/v1/services/requests?${query}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
        if(read.ok){const updated=serviceRequestReadSchema.parse(await read.json());if(alive.current&&!controller.signal.aborted)setData(updated);}
        else if(alive.current&&!controller.signal.aborted&&(read.status===401||read.status===403)){setData(null);setReadStatus(read.status===401?'session':'denied');}
      }catch{/* Keep the confirmed result. */}
    }catch{if(alive.current&&!controller.signal.aborted){setPendingUnknown(true);setNotice(t.error);}}finally{submitting.current=false;if(alive.current)setBusy(false);}
  }
  return <section dir={lang==='fa'?'rtl':'ltr'} className="min-w-0 space-y-4 rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">{t.title}</h2>
    {notice?<p role="status">{notice}</p>:null}{conflict?<button type="button" disabled={busy} onClick={()=>void refreshConflict()} className="min-h-11 rounded-xl border px-4 py-2">{t.refresh}</button>:null}
    {!data?<div role="status"><p>{readStatus==='loading'?t.loading:readStatus==='denied'?t.unavailable:readStatus==='session'?lang==='fa'?'نشست شما نیاز به بررسی دوباره دارد؛ دوباره وارد شوید.':lang==='ro'?'Sesiunea necesită verificare; autentifică-te din nou.':'Your session needs verification; sign in again.':lang==='fa'?'دریافت درخواست‌ها ناموفق بود؛ اتصال را بررسی کنید.':lang==='ro'?'Cererile nu au putut fi încărcate; verifică conexiunea.':'Requests could not be loaded; check your connection.'}</p>{readStatus==='retry'?<button type="button" onClick={()=>{setReadStatus('loading');setReadAttempt(n=>n+1);}} className="min-h-11 rounded-xl border px-4 py-2">{lang==='fa'?'تلاش دوباره':lang==='ro'?'Încearcă din nou':'Try again'}</button>:null}</div>:<>
    {data.can_request&&data.beneficiaries.length?<div className="space-y-3">
      <p className="text-sm">{t.disclaimer}</p>
      <label className="block">{t.offering}<select ref={offeringRef} aria-invalid={fieldErrors.offering} aria-describedby={fieldErrors.offering?`${fieldId}-offering-error`:undefined} value={offering} disabled={busy||!!pending} onChange={e=>{setOffering(e.target.value);setResource(null);setFlowState({key:'',status:'idle',preflight:null});setFieldErrors(old=>({...old,offering:false,resource:false}));}} className="block w-full rounded-xl border p-3"><option value="">{t.choose}</option>{offerings.filter(item=>item.acquisition_mode!=='reservation').map(item=><option key={item.offering_id} value={item.offering_id}>{item.labels[lang]}</option>)}</select></label>
      {fieldErrors.offering?<p id={`${fieldId}-offering-error`} className="text-sm text-red-700">{t.serviceError}</p>:null}
      {usesV14Flow&&flowStatus==='loading'?<p role="status">{t.sourceLoading}</p>:null}
      {usesV14Flow&&flowStatus==='not_ready'?<p role="status">{t.sourceNotReady}</p>:null}
      {usesV14Flow&&flowStatus==='denied'?<p role="status">{t.sourceDenied}</p>:null}
      {usesV14Flow&&flowStatus==='conflict'?<p role="status">{t.sourceChanged}</p>:null}
      {usesV14Flow&&flowStatus==='retry'?<button type="button" onClick={()=>{setFlowState({key:flowKey,status:'loading',preflight:null});setFlowAttempt(value=>value+1);}} className="min-h-11 rounded-xl border px-4 py-2">{lang==='fa'?'تلاش دوباره':lang==='ro'?'Încearcă din nou':'Try again'}</button>:null}
      {usesV14Flow&&flowPreflight?.source_kind==='resources'?<ServiceResourcePicker lang={lang} resources={flowPreflight.resources} value={resource} onChange={value=>{setResource(value);setFieldErrors(old=>({...old,resource:false}));}} error={fieldErrors.resource?t.resourceError:null} disabled={busy||!!pending}/>:null}
      <label className="block">{t.beneficiary}<select ref={partyRef} aria-invalid={fieldErrors.party} aria-describedby={fieldErrors.party?`${fieldId}-party-error`:undefined} value={party} disabled={busy||!!pending} onChange={e=>{setParty(e.target.value);setFieldErrors(old=>({...old,party:false}));}} className="block w-full rounded-xl border p-3"><option value="">{t.choose}</option>{data.beneficiaries.map(item=><option key={item.party_id} value={item.party_id}>{item.label}</option>)}</select></label>
      {fieldErrors.party?<p id={`${fieldId}-party-error`} className="text-sm text-red-700">{t.personError}</p>:null}
      <label className="block">{t.description}<textarea ref={descriptionRef} aria-invalid={fieldErrors.description} aria-describedby={fieldErrors.description?`${fieldId}-description-error`:undefined} value={description} maxLength={5000} disabled={busy||!!pending} onChange={e=>{setDescription(e.target.value);setFieldErrors(old=>({...old,description:false}));}} className="block w-full rounded-xl border p-3"/></label>
      {fieldErrors.description?<p id={`${fieldId}-description-error`} className="text-sm text-red-700">{t.descriptionError}</p>:null}
      <button type="button" disabled={busy||conflict||(usesV14Flow&&!pending&&flowStatus!=='ready')} onClick={()=>void submit()} className="min-h-11 rounded-xl bg-[#087A6E] px-4 py-2 font-semibold text-white disabled:opacity-50">{pending?t.retry:t.submit}</button>
    </div>:<div><p>{data.can_request?t.noParty:t.unavailable}</p>{data.can_request?<ServicePilotSelfPerson key={`${contextId}:${workspaceId}`} contextId={contextId} workspaceId={workspaceId} lang={lang}/>:null}</div>}
    {data.requests.length?<ul className="min-w-0 space-y-3">{data.requests.map(item=><li key={item.request_id} className="min-w-0 rounded-xl border p-3"><strong>{t.submitted}</strong><p className="break-words whitespace-pre-line">{item.description}</p><bdi className="text-xs">{item.request_id}</bdi></li>)}</ul>:<p>{t.empty}</p>}
    </>}
  </section>;
}
