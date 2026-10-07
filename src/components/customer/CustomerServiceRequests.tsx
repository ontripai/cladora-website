'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { z } from 'zod';
import type { Language } from '@/types';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { createServiceRequestSchema, type CreateServiceRequest } from '@/lib/customer/service-request-schema';
import { serviceRequestReadSchema, serviceRequestResultSchema } from '@/lib/customer/service-request-read-schema';
import { ServicePilotSelfPerson } from './ServicePilotSelfPerson';
const copy = {
  en: { serviceError:'Choose a service.', personError:'Choose who this request is for.', descriptionError:'Enter a description between 5 and 5,000 characters.', title:'Service requests', offering:'Service', beneficiary:'Request for', choose:'Choose', description:'Describe the request', submit:'Send request', retry:'Retry the same request', loading:'Loading requests…', unavailable:'Service requests are unavailable for this account.', noParty:'No verified person is linked to this membership. Contact the workspace manager.', disclaimer:'Sending a request does not accept a price, create an order or authorize payment.', error:'The result is unknown. Retry the same request to check it.', conflict:'The offering or request changed. Refresh the catalogue before sending another request.', refresh:'Refresh catalogue', success:'Request received; no payment obligation was created.', invalid:'Choose a service and person and enter at least five characters.', empty:'No requests yet.', submitted:'Received' },
  ro: { serviceError:'Alege un serviciu.', personError:'Alege pentru cine este cererea.', descriptionError:'Introdu o descriere între 5 și 5.000 de caractere.', title:'Cereri de servicii', offering:'Serviciu', beneficiary:'Cerere pentru', choose:'Alege', description:'Descrie cererea', submit:'Trimite cererea', retry:'Reîncearcă aceeași cerere', loading:'Se încarcă cererile…', unavailable:'Cererile de servicii nu sunt disponibile pentru acest cont.', noParty:'Nicio persoană verificată nu este asociată acestei calități de membru. Contactează administratorul.', disclaimer:'Trimiterea cererii nu acceptă un preț, nu creează o comandă și nu autorizează plata.', error:'Rezultatul este necunoscut. Reîncearcă aceeași cerere pentru verificare.', conflict:'Oferta sau cererea s-a schimbat. Actualizează catalogul înainte de o nouă cerere.', refresh:'Actualizează catalogul', success:'Cerere primită; nu s-a creat o obligație de plată.', invalid:'Alege un serviciu și o persoană și introdu minimum cinci caractere.', empty:'Nu există încă cereri.', submitted:'Primită' },
  fa: { serviceError:'یک خدمت انتخاب کنید.', personError:'شخصی را که درخواست برای اوست انتخاب کنید.', descriptionError:'شرحی بین ۵ تا ۵۰۰۰ نویسه وارد کنید.', title:'درخواست خدمات', offering:'خدمت', beneficiary:'درخواست برای', choose:'انتخاب کنید', description:'شرح درخواست', submit:'ارسال درخواست', retry:'تکرار همان درخواست', loading:'در حال دریافت درخواست‌ها…', unavailable:'ثبت درخواست خدمت برای این حساب فعال نیست.', noParty:'شخص تأییدشده‌ای به این عضویت متصل نیست؛ با مدیر فضای کاری تماس بگیرید.', disclaimer:'ارسال درخواست به معنی قبول قیمت، ایجاد سفارش یا اجازهٔ پرداخت نیست.', error:'نتیجه مشخص نیست؛ همان درخواست را برای بررسی نتیجه تکرار کنید.', conflict:'عرضه یا درخواست تغییر کرده است؛ پیش از درخواست جدید کاتالوگ را به‌روز کنید.', refresh:'به‌روزرسانی کاتالوگ', success:'درخواست دریافت شد؛ تعهد پرداختی ایجاد نشد.', invalid:'خدمت و شخص را انتخاب و شرحی با حداقل پنج نویسه وارد کنید.', empty:'هنوز درخواستی ثبت نشده است.', submitted:'دریافت‌شده' },
};
type Read = z.infer<typeof serviceRequestReadSchema>;
type Offering = { offering_id:string; revision_id:string; labels:Record<Language,string>; acquisition_mode:string };
// The parent keys by context/workspace; pending commands cannot cross either scope.
export function CustomerServiceRequests({contextId,workspaceId,lang,offerings,onRefreshCatalog}:{contextId:string;workspaceId:string;lang:Language;offerings:Offering[];onRefreshCatalog?:()=>Promise<Offering[]>}) {
  const fetch = useDashboardFetch(); const t=copy[lang];
  const fieldId=useId();
  const [fieldErrors,setFieldErrors]=useState({offering:false,party:false,description:false});
  const offeringRef=useRef<HTMLSelectElement>(null); const partyRef=useRef<HTMLSelectElement>(null); const descriptionRef=useRef<HTMLTextAreaElement>(null);
  const [data,setData]=useState<Read|null>(null); const [notice,setNotice]=useState('');
  const [offering,setOffering]=useState(''); const [party,setParty]=useState(''); const [description,setDescription]=useState('');
  const [pending,setPending]=useState<CreateServiceRequest|null>(null); const [busy,setBusy]=useState(false); const [conflict,setConflict]=useState(false);
  const [readStatus,setReadStatus]=useState<'loading'|'ready'|'denied'|'session'|'retry'>('loading'); const [readAttempt,setReadAttempt]=useState(0);
  const alive=useRef(true); const writeAbort=useRef<AbortController|null>(null); const submitting=useRef(false);
  const query=new URLSearchParams({context_id:contextId,workspace_id:workspaceId}).toString();
  useEffect(()=>{alive.current=true;const controller=new AbortController();
    void fetch(`/api/customer/v1/services/requests?${query}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error(response.status===401?'session':response.status===403||response.status===404?'denied':'retry');return serviceRequestReadSchema.parse(await response.json());})
      .then(value=>{if(!controller.signal.aborted){setData(value);setReadStatus('ready');}})
      .catch(reason=>{if(!controller.signal.aborted)setReadStatus(reason instanceof Error&&['session','denied'].includes(reason.message)?reason.message as 'session'|'denied':'retry');});
    return ()=>{alive.current=false;controller.abort();writeAbort.current?.abort();};
  },[fetch,query,readAttempt]);
  async function refreshConflict(){
    if(busy||!onRefreshCatalog)return;
    setBusy(true);
    try {
      const updatedOfferings=await onRefreshCatalog();
      const response=await fetch(`/api/customer/v1/services/requests?${query}`,{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)throw new Error(response.status===401?'session':response.status===403||response.status===404?'denied':'retry');
      const updated=serviceRequestReadSchema.parse(await response.json());
      if(!alive.current)return;
      setData(updated);setPending(null);setConflict(false);setNotice('');
      if(!updatedOfferings.some(item=>item.offering_id===offering&&item.acquisition_mode!=='reservation'))setOffering('');
      if(!updated.beneficiaries.some(item=>item.party_id===party))setParty('');
    }catch(reason){if(alive.current)setNotice(reason instanceof Error&&reason.message==='denied'?t.unavailable:reason instanceof Error&&reason.message==='session'?lang==='fa'?'نشست شما نیاز به بررسی دوباره دارد؛ دوباره وارد شوید.':lang==='ro'?'Sesiunea necesită verificare; autentifică-te din nou.':'Your session needs verification; sign in again.':lang==='fa'?'به‌روزرسانی انجام نشد؛ اتصال را بررسی و دوباره تلاش کنید.':lang==='ro'?'Actualizarea a eșuat; verifică conexiunea și reîncearcă.':'Refresh failed; check your connection and try again.');}
    finally{if(alive.current)setBusy(false);}
  }
  async function submit(){
    if(submitting.current||conflict)return;
    const selected=offerings.find(item=>item.offering_id===offering);
    let command=pending;
    if(!command){const parsed=createServiceRequestSchema.safeParse({context_id:contextId,workspace_id:workspaceId,
      offering_id:offering,published_revision_id:selected?.revision_id,beneficiary_party_id:party,description,idempotency_key:crypto.randomUUID()});
      if(!parsed.success){
        const fields={offering:parsed.error.issues.some(i=>i.path[0]==='offering_id'||i.path[0]==='published_revision_id'),party:parsed.error.issues.some(i=>i.path[0]==='beneficiary_party_id'),description:parsed.error.issues.some(i=>i.path[0]==='description')};
        setFieldErrors(fields);setNotice(t.invalid);
        (fields.offering?offeringRef:fields.party?partyRef:descriptionRef).current?.focus();return;
      }setFieldErrors({offering:false,party:false,description:false});command=parsed.data;setPending(command);}
    submitting.current=true;setBusy(true);setNotice('');const controller=new AbortController();writeAbort.current=controller;
    try {const response=await fetch('/api/customer/v1/services/requests',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),signal:controller.signal});
      if(!response.ok){if(alive.current){setConflict(response.status===409);setNotice(response.status===409?t.conflict:response.status===403?t.unavailable:t.error);}return;}
      serviceRequestResultSchema.parse(await response.json());
      if(!alive.current||controller.signal.aborted)return;setPending(null);setDescription('');setNotice(t.success);
      // Confirmed writes remain confirmed even when refreshing history fails.
      try {const read=await fetch(`/api/customer/v1/services/requests?${query}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
        if(read.ok){const updated=serviceRequestReadSchema.parse(await read.json());if(alive.current&&!controller.signal.aborted)setData(updated);}
      }catch{/* Keep the confirmed result. */}
    }catch{if(alive.current&&!controller.signal.aborted)setNotice(t.error);}finally{submitting.current=false;if(alive.current)setBusy(false);}
  }
  return <section dir={lang==='fa'?'rtl':'ltr'} className="space-y-4 rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">{t.title}</h2>
    {notice?<p role="status">{notice}</p>:null}{conflict?<button type="button" disabled={busy} onClick={()=>void refreshConflict()} className="rounded-xl border px-4 py-2">{t.refresh}</button>:null}
    {!data?<div role="status"><p>{readStatus==='loading'?t.loading:readStatus==='denied'?t.unavailable:readStatus==='session'?lang==='fa'?'نشست شما نیاز به بررسی دوباره دارد؛ دوباره وارد شوید.':lang==='ro'?'Sesiunea necesită verificare; autentifică-te din nou.':'Your session needs verification; sign in again.':lang==='fa'?'دریافت درخواست‌ها ناموفق بود؛ اتصال را بررسی کنید.':lang==='ro'?'Cererile nu au putut fi încărcate; verifică conexiunea.':'Requests could not be loaded; check your connection.'}</p>{readStatus==='retry'?<button type="button" onClick={()=>{setReadStatus('loading');setReadAttempt(n=>n+1);}} className="rounded-xl border px-4 py-2">{lang==='fa'?'تلاش دوباره':lang==='ro'?'Încearcă din nou':'Try again'}</button>:null}</div>:<>
    {data.can_request&&data.beneficiaries.length?<div className="space-y-3">
      <p className="text-sm">{t.disclaimer}</p>
      <label className="block">{t.offering}<select ref={offeringRef} aria-invalid={fieldErrors.offering} aria-describedby={fieldErrors.offering?`${fieldId}-offering-error`:undefined} value={offering} disabled={busy||!!pending} onChange={e=>{setOffering(e.target.value);setFieldErrors(old=>({...old,offering:false}));}} className="block w-full rounded-xl border p-3"><option value="">{t.choose}</option>{offerings.filter(item=>item.acquisition_mode!=='reservation').map(item=><option key={item.offering_id} value={item.offering_id}>{item.labels[lang]}</option>)}</select></label>
      {fieldErrors.offering?<p id={`${fieldId}-offering-error`} className="text-sm text-red-700">{t.serviceError}</p>:null}
      <label className="block">{t.beneficiary}<select ref={partyRef} aria-invalid={fieldErrors.party} aria-describedby={fieldErrors.party?`${fieldId}-party-error`:undefined} value={party} disabled={busy||!!pending} onChange={e=>{setParty(e.target.value);setFieldErrors(old=>({...old,party:false}));}} className="block w-full rounded-xl border p-3"><option value="">{t.choose}</option>{data.beneficiaries.map(item=><option key={item.party_id} value={item.party_id}>{item.label}</option>)}</select></label>
      {fieldErrors.party?<p id={`${fieldId}-party-error`} className="text-sm text-red-700">{t.personError}</p>:null}
      <label className="block">{t.description}<textarea ref={descriptionRef} aria-invalid={fieldErrors.description} aria-describedby={fieldErrors.description?`${fieldId}-description-error`:undefined} value={description} maxLength={5000} disabled={busy||!!pending} onChange={e=>{setDescription(e.target.value);setFieldErrors(old=>({...old,description:false}));}} className="block w-full rounded-xl border p-3"/></label>
      {fieldErrors.description?<p id={`${fieldId}-description-error`} className="text-sm text-red-700">{t.descriptionError}</p>:null}
      <button type="button" disabled={busy||conflict} onClick={()=>void submit()} className="rounded-xl bg-[#087A6E] px-4 py-2 font-semibold text-white disabled:opacity-50">{pending?t.retry:t.submit}</button>
    </div>:<div><p>{data.can_request?t.noParty:t.unavailable}</p>{data.can_request?<ServicePilotSelfPerson key={`${contextId}:${workspaceId}`} contextId={contextId} workspaceId={workspaceId} lang={lang}/>:null}</div>}
    {data.requests.length?<ul className="space-y-3">{data.requests.map(item=><li key={item.request_id} className="rounded-xl border p-3"><strong>{t.submitted}</strong><p className="whitespace-pre-line">{item.description}</p><bdi className="text-xs">{item.request_id}</bdi></li>)}</ul>:<p>{t.empty}</p>}
    </>}
  </section>;
}
