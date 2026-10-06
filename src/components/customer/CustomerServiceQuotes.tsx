'use client';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { z } from 'zod';
import type { Language } from '@/types';
import { currencyConfig, type SupportedCurrency } from '@/config/currencies';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { createServiceQuoteDraftSchema, type CreateServiceQuoteDraft } from '@/lib/customer/service-quote-schema';
import { serviceQuoteReadSchema, serviceQuoteResultSchema, serviceQuoteAmountToMinor, serviceQuoteMinorToAmount } from '@/lib/customer/service-quote-read-schema';
export const serviceQuoteCopy = {
  en: { title:'Quote drafts', loading:'Loading requests…', denied:'Quote management is unavailable for this account.', empty:'No service requests yet.', request:'Service request', choose:'Choose', scope:'Proposed service scope', amount:'Total amount', currency:'Currency', expiry:'Valid until', beneficiary:'Proposed payer', provider:'Service provider', save:'Save new draft version', retry:'Retry the same draft', refresh:'Refresh', draft:'Draft', version:'Version', success:'Draft saved. No consent, order or payment was created.', error:'Result unknown. Retry the same draft to check it.', conflict:'The request changed. Refresh before continuing.', invalid:'Review the highlighted fields.', requestError:'Choose a service request.', scopeError:'Describe the proposed scope in 5 to 5000 characters.', amountError:'Enter a non-negative amount in the selected currency, with at most two decimal places.', expiryError:'Choose a future expiry date and time.', note:'Coordinator draft only. The proposed payer is the person on the request. Their acceptance is a separate step; this draft creates no obligation.', bounded:'Latest 50 requests; latest 10 draft versions per request.' },
  ro: { title:'Oferte preliminare', loading:'Se încarcă cererile…', denied:'Administrarea ofertelor nu este disponibilă pentru acest cont.', empty:'Nu există cereri de servicii.', request:'Cerere de serviciu', choose:'Alege', scope:'Serviciul propus', amount:'Suma totală', currency:'Monedă', expiry:'Valabil până la', beneficiary:'Plătitor propus', provider:'Furnizor', save:'Salvează o versiune nouă', retry:'Reîncearcă aceeași ofertă', refresh:'Actualizează', draft:'Preliminară', version:'Versiune', success:'Oferta preliminară a fost salvată. Nu s-a creat un acord, o comandă sau o plată.', error:'Rezultat necunoscut. Reîncearcă aceeași ofertă pentru verificare.', conflict:'Cererea s-a schimbat. Actualizează înainte de a continua.', invalid:'Verifică rubricile evidențiate.', requestError:'Alege o cerere de serviciu.', scopeError:'Descrie serviciul propus în 5–5000 de caractere.', amountError:'Introdu o sumă pozitivă sau zero, cu cel mult două zecimale pentru moneda aleasă.', expiryError:'Alege o dată și o oră viitoare.', note:'Ofertă preliminară a coordonatorului. Plătitorul propus este persoana din cerere. Acceptarea este un pas separat; oferta nu creează obligații.', bounded:'Ultimele 50 de cereri; ultimele 10 versiuni pentru fiecare cerere.' },
  fa: { title:'پیش‌نویس پیشنهادها', loading:'در حال دریافت درخواست‌ها…', denied:'مدیریت پیشنهاد برای این حساب فعال نیست.', empty:'درخواست خدمتی وجود ندارد.', request:'درخواست خدمت', choose:'انتخاب کنید', scope:'شرح خدمت پیشنهادی', amount:'مبلغ کل', currency:'ارز', expiry:'معتبر تا', beneficiary:'پرداخت‌کنندهٔ پیشنهادی', provider:'ارائه‌دهندهٔ خدمت', save:'ذخیرهٔ نسخهٔ جدید پیش‌نویس', retry:'تکرار همان پیش‌نویس', refresh:'به‌روزرسانی', draft:'پیش‌نویس', version:'نسخه', success:'پیش‌نویس ذخیره شد؛ تأیید طرف، سفارش یا پرداختی ایجاد نشد.', error:'نتیجه مشخص نیست؛ همان پیش‌نویس را برای بررسی تکرار کنید.', conflict:'درخواست تغییر کرده است؛ ابتدا اطلاعات را به‌روز کنید.', invalid:'فیلدهای مشخص‌شده را بررسی کنید.', requestError:'یک درخواست خدمت انتخاب کنید.', scopeError:'شرح پیشنهادی باید بین ۵ تا ۵۰۰۰ نویسه باشد.', amountError:'مبلغ صفر یا بیشتر را با حداکثر دو رقم اعشار در ارز انتخاب‌شده وارد کنید.', expiryError:'تاریخ و ساعت آینده را انتخاب کنید.', note:'این پیش‌نویس هماهنگ‌کننده است. پرداخت‌کنندهٔ پیشنهادی همان شخص درخواست است؛ پذیرش او مرحله‌ای جداگانه است و این ثبت تعهدی ایجاد نمی‌کند.', bounded:'۵۰ درخواست اخیر و ۱۰ نسخهٔ اخیر هر درخواست نمایش داده می‌شود.' },
};
type Read = z.infer<typeof serviceQuoteReadSchema>;
const readCopy={
  en:{session:'Your session needs verification. Sign in again.',load:'Requests could not be loaded. Check your connection and try again.',retry:'Try again'},
  ro:{session:'Sesiunea necesită verificare. Autentifică-te din nou.',load:'Cererile nu au putut fi încărcate. Verifică conexiunea și reîncearcă.',retry:'Încearcă din nou'},
  fa:{session:'نشست شما نیاز به بررسی دوباره دارد؛ دوباره وارد شوید.',load:'درخواست‌ها دریافت نشدند؛ اتصال را بررسی و دوباره تلاش کنید.',retry:'تلاش دوباره'},
};
export function CustomerServiceQuotes({contextId,workspaceId,lang}:{contextId:string;workspaceId:string;lang:Language}) {
  const fetch = useDashboardFetch(); const t=serviceQuoteCopy[lang];
  const fieldId=useId();
  const [fieldErrors,setFieldErrors]=useState({request:false,scope:false,amount:false,expiry:false});
  const requestRef=useRef<HTMLSelectElement>(null); const scopeRef=useRef<HTMLTextAreaElement>(null);
  const amountRef=useRef<HTMLInputElement>(null); const expiryRef=useRef<HTMLInputElement>(null);
  const [data,setData]=useState<Read|null>(null); const [notice,setNotice]=useState(''); const [selected,setSelected]=useState('');
  const [pending,setPending]=useState<CreateServiceQuoteDraft|null>(null); const [busy,setBusy]=useState(false); const [blocked,setBlocked]=useState(false);
  const [readStatus,setReadStatus]=useState<'loading'|'ready'|'denied'|'session'|'retry'>('loading'); const [readAttempt,setReadAttempt]=useState(0);
  const alive=useRef(true); const submitting=useRef(false); const writeAbort=useRef<AbortController|null>(null);
  const query=new URLSearchParams({context_id:contextId,workspace_id:workspaceId}).toString();
  useEffect(()=>{alive.current=true;const controller=new AbortController();
    void fetch(`/api/customer/v1/services/quotes?${query}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal})
      .then(async response=>{if(!response.ok)throw new Error(response.status===401?'session':response.status===403||response.status===404?'denied':'retry');return serviceQuoteReadSchema.parse(await response.json());})
      .then(value=>{if(!controller.signal.aborted){setData(value);setReadStatus('ready');}}).catch(reason=>{if(!controller.signal.aborted)setReadStatus(reason instanceof Error&&['session','denied'].includes(reason.message)?reason.message as 'session'|'denied':'retry');});
    return ()=>{alive.current=false;controller.abort();writeAbort.current?.abort();};
  },[fetch,query,readAttempt]);
  async function refreshBlocked(){
    if(busy||submitting.current)return;
    setBusy(true);
    try {
      const response=await fetch(`/api/customer/v1/services/quotes?${query}`,{cache:'no-store',credentials:'same-origin'});
      if(!response.ok)throw new Error(response.status===401?'session':response.status===403||response.status===404?'denied':'retry');
      const next=serviceQuoteReadSchema.parse(await response.json());
      if(!alive.current)return;
      setData(next);setPending(null);setBlocked(false);setNotice('');
    }catch(reason){if(alive.current)setNotice(reason instanceof Error&&reason.message==='denied'?t.denied:reason instanceof Error&&reason.message==='session'?readCopy[lang].session:readCopy[lang].load);}
    finally{if(alive.current)setBusy(false);}
  }
  const request=data?.requests.find(item=>item.request_id===selected);
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();if(submitting.current)return;
    let command=pending;
    if(!command){const form=new FormData(event.currentTarget);const code=String(form.get('currency')) as SupportedCurrency;
      const total=code in currencyConfig?serviceQuoteAmountToMinor(String(form.get('amount')),code):null;
      const until=new Date(String(form.get('expiry')));
      const scope=String(form.get('scope')??'');
      const errors={request:!request,scope:scope.trim().length<5||scope.trim().length>5000,amount:total===null,expiry:!Number.isFinite(until.getTime())||until.getTime()<=Date.now()};
      if(!request||total===null||errors.scope||errors.expiry){
        setFieldErrors(errors);setNotice(t.invalid);
        (errors.request?requestRef:errors.scope?scopeRef:errors.amount?amountRef:expiryRef).current?.focus();return;
      }
      const parsed=createServiceQuoteDraftSchema.safeParse({context_id:contextId,workspace_id:workspaceId,request_id:request.request_id,
        published_revision_id:request.published_revision_id,scope,total_minor:total,currency:code,
        payer_shares:[{party_id:request.beneficiary_party_id,amount_minor:total}],valid_until:until.toISOString(),idempotency_key:crypto.randomUUID()});
      if(!parsed.success){setNotice(t.invalid);return;}setFieldErrors({request:false,scope:false,amount:false,expiry:false});command=parsed.data;setPending(command);
    }
    submitting.current=true;setBusy(true);setNotice('');const controller=new AbortController();writeAbort.current=controller;
    try {const response=await fetch('/api/customer/v1/services/quotes',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),signal:controller.signal});
      if(!response.ok){if(alive.current&&!controller.signal.aborted){setBlocked([403,409].includes(response.status));setNotice(response.status===409?t.conflict:response.status===403?t.denied:t.error);}return;}
      serviceQuoteResultSchema.parse(await response.json());if(!alive.current||controller.signal.aborted)return;
      setPending(null);setNotice(t.success);
      try{const read=await fetch(`/api/customer/v1/services/quotes?${query}`,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
        if(read.ok){const next=serviceQuoteReadSchema.parse(await read.json());if(alive.current&&!controller.signal.aborted)setData(next);}
      }catch{/* Keep a confirmed save confirmed. */}
    }catch{if(alive.current&&!controller.signal.aborted)setNotice(t.error);}finally{submitting.current=false;if(alive.current)setBusy(false);}
  }
  return <section dir={lang==='fa'?'rtl':'ltr'} className="space-y-4 rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">{t.title}</h2>
    <p className="text-sm">{t.note}</p>{notice?<p role="status">{notice}</p>:null}
    {blocked?<button type="button" disabled={busy} onClick={()=>void refreshBlocked()} className="rounded-xl border px-4 py-2">{t.refresh}</button>:null}
    {!data?<div role="status"><p>{readStatus==='loading'?t.loading:readStatus==='denied'?t.denied:readStatus==='session'?readCopy[lang].session:readCopy[lang].load}</p>{readStatus==='retry'?<button type="button" onClick={()=>{setReadStatus('loading');setReadAttempt(n=>n+1);}} className="rounded-xl border px-4 py-2">{readCopy[lang].retry}</button>:null}</div>:<><p className="text-xs text-slate-600">{t.bounded}</p>
      {data.requests.length?<form noValidate onSubmit={event=>void submit(event)} className="space-y-3">
        <label className="block">{t.request}<select ref={requestRef} aria-invalid={fieldErrors.request} aria-describedby={fieldErrors.request?`${fieldId}-request-error`:undefined} value={selected} disabled={busy||!!pending} onChange={e=>{setSelected(e.target.value);setFieldErrors(old=>({...old,request:false}));}} className="block w-full rounded-xl border p-3"><option value="">{t.choose}</option>{data.requests.map(item=><option key={item.request_id} value={item.request_id}>{item.description.slice(0,120)}</option>)}</select></label>
        {fieldErrors.request?<p id={`${fieldId}-request-error`} className="text-sm text-red-700">{t.requestError}</p>:null}
        {request?<><p>{t.beneficiary}: {request.beneficiary_label}</p><p>{t.provider}: {request.provider_label}</p></>:null}
        <fieldset key={selected} disabled={busy||!!pending} className="space-y-3">
          <label className="block">{t.scope}<textarea ref={scopeRef} name="scope" aria-invalid={fieldErrors.scope} aria-describedby={fieldErrors.scope?`${fieldId}-scope-error`:undefined} onChange={()=>setFieldErrors(old=>({...old,scope:false}))} maxLength={5000} className="block w-full rounded-xl border p-3"/></label>
          {fieldErrors.scope?<p id={`${fieldId}-scope-error`} className="text-sm text-red-700">{t.scopeError}</p>:null}
          <label className="block">{t.amount}<input ref={amountRef} name="amount" aria-invalid={fieldErrors.amount} aria-describedby={fieldErrors.amount?`${fieldId}-amount-error`:undefined} onChange={()=>setFieldErrors(old=>({...old,amount:false}))} inputMode="decimal" placeholder="0.00" className="block w-full rounded-xl border p-3"/></label>
          {fieldErrors.amount?<p id={`${fieldId}-amount-error`} className="text-sm text-red-700">{t.amountError}</p>:null}
          <label className="block">{t.currency}<select name="currency" defaultValue="RON" className="block w-full rounded-xl border p-3">{Object.keys(currencyConfig).map(code=><option key={code}>{code}</option>)}</select></label>
          <label className="block">{t.expiry}<input ref={expiryRef} name="expiry" type="datetime-local" aria-invalid={fieldErrors.expiry} aria-describedby={fieldErrors.expiry?`${fieldId}-expiry-error`:undefined} onChange={()=>setFieldErrors(old=>({...old,expiry:false}))} className="block w-full rounded-xl border p-3"/></label>
          {fieldErrors.expiry?<p id={`${fieldId}-expiry-error`} className="text-sm text-red-700">{t.expiryError}</p>:null}
        </fieldset>
        <button type="submit" disabled={busy||blocked} className="rounded-xl bg-[#087A6E] px-4 py-2 font-semibold text-white disabled:opacity-50">{pending?t.retry:t.save}</button>
      </form>:<p>{t.empty}</p>}
      <ul className="space-y-3">{data.requests.flatMap(item=>item.quotes.map(quote=><li key={quote.quote_id} className="rounded-xl border p-3"><strong>{t.draft} · {t.version} {quote.version}</strong><p>{item.description}</p><p className="whitespace-pre-line">{quote.scope}</p><bdi>{serviceQuoteMinorToAmount(quote.total_minor,quote.currency)} {quote.currency}</bdi><p>{t.expiry}: <bdi>{quote.valid_until}</bdi></p></li>))}</ul>
    </>}
  </section>;
}
