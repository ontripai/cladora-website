'use client';
import { useEffect, useRef, useState } from 'react';
import type { z } from 'zod';
import type { Language } from '@/types';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { publishServiceQuoteSchema, serviceQuotePublicationResultSchema, serviceQuotePublicationsSchema } from '@/lib/customer/service-quote-publication-schema';
import { serviceQuoteMinorToAmount } from '@/lib/customer/service-quote-read-schema';
export const quotePublicationCopy = {
  en: { loadError:'Proposals could not be loaded. Check your connection and try Refresh.', signIn:'Your session needs verification. Sign in again, then refresh this page.', readOnly:'You can review drafts. To present one, ask your workspace administrator for permission.', nextDraft:'Next: an authorized coordinator presents this version.', nextPresented:'Next: the requester reviews this version. Acceptance is not available yet.', nextExpired:'Next: ask the coordinator for a new proposal.', nextSuperseded:'A newer version exists. Ask the coordinator for the current proposal.', coordinator:'Present quotes', recipient:'My proposals', note:'For review only. Tax treatment and provider approval are still pending. This proposal cannot be accepted and creates no order or payment.', loading:'Loading proposals…', denied:'Proposals are unavailable for this account.', empty:'No proposals to display.', bounded:'Latest 50 versions shown.', publish:'Present this version to the requester', retry:'Retry the same presentation', success:'This version is available to the requester for review.', unknown:'Result unknown. Retry the same presentation.', conflict:'The proposal changed or is unavailable. Refresh before continuing.', refresh:'Refresh', version:'Version', expiry:'Valid until', provider:'Proposed provider', beneficiary:'Proposed payer', draft:'Draft', presented:'Presented for review', superseded:'Superseded', expired:'Expired' },
  ro: { loadError:'Propunerile nu au putut fi încărcate. Verifică conexiunea și apasă Actualizează.', signIn:'Sesiunea necesită verificare. Autentifică-te din nou, apoi actualizează pagina.', readOnly:'Poți consulta versiunile preliminare. Pentru a le prezenta, solicită permisiunea administratorului spațiului de lucru.', nextDraft:'Urmează: un coordonator autorizat prezintă această versiune.', nextPresented:'Urmează: solicitantul examinează această versiune. Acceptarea nu este încă disponibilă.', nextExpired:'Urmează: solicită coordonatorului o propunere nouă.', nextSuperseded:'Există o versiune mai nouă. Solicită coordonatorului propunerea curentă.', coordinator:'Prezintă ofertele', recipient:'Propunerile mele', note:'Doar pentru examinare. Tratamentul fiscal și aprobarea furnizorului sunt în așteptare. Propunerea nu poate fi acceptată și nu creează o comandă sau o plată.', loading:'Se încarcă propunerile…', denied:'Propunerile nu sunt disponibile pentru acest cont.', empty:'Nu există propuneri de afișat.', bounded:'Sunt afișate ultimele 50 de versiuni.', publish:'Prezintă această versiune solicitantului', retry:'Reîncearcă aceeași prezentare', success:'Versiunea este disponibilă solicitantului pentru examinare.', unknown:'Rezultat necunoscut. Reîncearcă aceeași prezentare.', conflict:'Propunerea s-a schimbat sau nu este disponibilă. Actualizează înainte de a continua.', refresh:'Actualizează', version:'Versiune', expiry:'Valabil până la', provider:'Furnizor propus', beneficiary:'Plătitor propus', draft:'Preliminară', presented:'Prezentată pentru examinare', superseded:'Înlocuită', expired:'Expirată' },
  fa: { loadError:'پیشنهادها دریافت نشد. اتصال را بررسی کنید و به‌روزرسانی را بزنید.', signIn:'نشست شما نیاز به تأیید دارد. دوباره وارد شوید و سپس این صفحه را به‌روز کنید.', readOnly:'می‌توانید پیش‌نویس‌ها را بررسی کنید. برای ارائه، از مدیر فضای کاری مجوز بخواهید.', nextDraft:'قدم بعد: هماهنگ‌کنندهٔ مجاز این نسخه را ارائه می‌کند.', nextPresented:'قدم بعد: صاحب درخواست این نسخه را بررسی می‌کند. پذیرش هنوز فعال نیست.', nextExpired:'قدم بعد: از هماهنگ‌کننده پیشنهاد جدید بخواهید.', nextSuperseded:'نسخهٔ جدیدتری وجود دارد. پیشنهاد جاری را از هماهنگ‌کننده بخواهید.', coordinator:'ارائهٔ پیشنهادها', recipient:'پیشنهادهای من', note:'فقط برای بررسی است. نحوهٔ مالیات و تأیید ارائه‌دهنده هنوز تکمیل نشده است. این پیشنهاد قابل پذیرش نیست و سفارش یا پرداختی ایجاد نمی‌کند.', loading:'در حال دریافت پیشنهادها…', denied:'پیشنهادها برای این حساب در دسترس نیست.', empty:'پیشنهادی برای نمایش وجود ندارد.', bounded:'۵۰ نسخهٔ اخیر نمایش داده می‌شود.', publish:'ارائهٔ این نسخه به صاحب درخواست', retry:'تکرار همان ارائه', success:'این نسخه برای بررسی در اختیار صاحب درخواست قرار گرفت.', unknown:'نتیجه مشخص نیست؛ همان ارائه را دوباره بررسی کنید.', conflict:'پیشنهاد تغییر کرده یا در دسترس نیست؛ ابتدا اطلاعات را به‌روز کنید.', refresh:'به‌روزرسانی', version:'نسخه', expiry:'معتبر تا', provider:'ارائه‌دهندهٔ پیشنهادی', beneficiary:'پرداخت‌کنندهٔ پیشنهادی', draft:'پیش‌نویس', presented:'ارائه‌شده برای بررسی', superseded:'جایگزین‌شده', expired:'منقضی' },
};
type Read = z.infer<typeof serviceQuotePublicationsSchema>;
type Command = z.infer<typeof publishServiceQuoteSchema>;
export function CustomerServiceQuotePublications(props:{contextId:string;workspaceId:string;lang:Language;mode:'coordinator'|'recipient'}) {
  // Remount on scope changes: an unresolved command never moves to another identity/workspace.
  return <PublicationPanel key={`${props.contextId}:${props.workspaceId}:${props.mode}`} {...props}/>;
}
function PublicationPanel({contextId,workspaceId,lang,mode}:{contextId:string;workspaceId:string;lang:Language;mode:'coordinator'|'recipient'}) {
  const fetch=useDashboardFetch();const t=quotePublicationCopy[lang];
  const [data,setData]=useState<Read|null>(null);const [notice,setNotice]=useState('');const [pending,setPending]=useState<Command|null>(null);
  const [busy,setBusy]=useState(false);const [blocked,setBlocked]=useState(false);const [attempt,setAttempt]=useState(0);
  const inFlight=useRef(false);const active=useRef(true);const write=useRef<AbortController|null>(null);
  const url=`/api/customer/v1/services/quotes/publications?${new URLSearchParams({context_id:contextId,workspace_id:workspaceId,mode})}`;
  useEffect(()=>{active.current=true;const controller=new AbortController();
    void fetch(url,{cache:'no-store',credentials:'same-origin',signal:controller.signal}).then(async response=>{
      if(!response.ok){if(!controller.signal.aborted)setNotice(response.status===401?t.signIn:[403,404].includes(response.status)?t.denied:t.loadError);return null;}return serviceQuotePublicationsSchema.parse(await response.json());
    }).then(value=>{if(!controller.signal.aborted)setData(value);}).catch(()=>{if(!controller.signal.aborted)setNotice(t.loadError);});
    return()=>{active.current=false;controller.abort();write.current?.abort();};
  },[fetch,url,attempt,t.denied,t.loadError,t.signIn]);
  async function publish(quote:Read['quotes'][number]) {
    if(inFlight.current||blocked)return;
    const command=pending??publishServiceQuoteSchema.parse({context_id:contextId,workspace_id:workspaceId,quote_id:quote.quote_id,expected_version:quote.version,idempotency_key:crypto.randomUUID()});
    setPending(command);inFlight.current=true;setBusy(true);setNotice('');const controller=new AbortController();write.current=controller;
    try{const response=await fetch('/api/customer/v1/services/quotes/publications',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),signal:controller.signal});
      if(!active.current||controller.signal.aborted)return;
      if(!response.ok){setBlocked([400,401,403,404,409].includes(response.status));setNotice([400,401,403,404,409].includes(response.status)?t.conflict:t.unknown);return;}
      const result=serviceQuotePublicationResultSchema.parse(await response.json());
      if(result.quote_id!==command.quote_id||result.version!==command.expected_version)throw new Error('unexpected result');
      if(!active.current||controller.signal.aborted)return;
      setPending(null);setNotice(t.success);
      // Disable an already confirmed presentation even if the following history read fails.
      setData(old=>old?{...old,quotes:old.quotes.map(q=>q.quote_id===result.quote_id?{...q,state:'presented'}:q)}:old);
      try{const response=await fetch(url,{cache:'no-store',credentials:'same-origin',signal:controller.signal});
        if(response.ok){const next=serviceQuotePublicationsSchema.parse(await response.json());if(active.current&&!controller.signal.aborted)setData(next);}
      }catch{/* A confirmed presentation stays confirmed. */}
    }catch{if(active.current&&!controller.signal.aborted)setNotice(t.unknown);}
    finally{inFlight.current=false;if(active.current&&!controller.signal.aborted)setBusy(false);}
  }
  function refresh(){setData(null);setNotice('');setBlocked(false);setPending(null);setAttempt(n=>n+1);}
  return <section dir={lang==='fa'?'rtl':'ltr'} className="space-y-4 rounded-2xl border bg-white p-6"><h2 className="text-xl font-bold">{t[mode]}</h2>
    <p className="rounded-xl bg-amber-50 p-3 text-sm">{t.note}</p>{notice?<p role="status">{notice}</p>:null}
    <button type="button" disabled={busy||!!pending&&!blocked} onClick={refresh} className="rounded-xl border px-4 py-2 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2">{t.refresh}</button>
    {!data?<p role="status">{notice?'':t.loading}</p>:<>{mode==='coordinator'&&!data.can_publish?<p>{t.readOnly}</p>:null}<p className="text-xs text-slate-600">{t.bounded}</p>{!data.quotes.length?<p>{t.empty}</p>:<ul className="space-y-4">{data.quotes.map(quote=><li key={quote.quote_id} className="space-y-2 rounded-xl border p-4">
      <strong>{t[quote.state]} · {t.version} {quote.version}</strong><p>{quote.description}</p><p className="whitespace-pre-line">{quote.scope}</p>
      <p>{t.provider}: {quote.provider_label}</p><p>{t.beneficiary}: {quote.beneficiary_label}</p>
      <p><bdi>{serviceQuoteMinorToAmount(quote.total_minor,quote.currency)} {quote.currency}</bdi></p><p>{t.expiry}: <bdi><time dateTime={quote.valid_until}>{new Intl.DateTimeFormat(lang==='fa'?'fa-IR':lang==='ro'?'ro-RO':'en-GB',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(quote.valid_until))} UTC</time></bdi></p>
      <p className="text-sm text-slate-600">{t[quote.state==='draft'?'nextDraft':quote.state==='presented'?'nextPresented':quote.state==='expired'?'nextExpired':'nextSuperseded']}</p>
      {mode==='coordinator'&&data.can_publish&&quote.state==='draft'?<button type="button" disabled={busy||blocked||!!pending&&pending.quote_id!==quote.quote_id} onClick={()=>void publish(quote)} className="rounded-xl bg-[#087A6E] px-4 py-2 font-semibold text-white disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2">{pending?.quote_id===quote.quote_id?t.retry:t.publish}</button>:null}
    </li>)}</ul>}</>}
  </section>;
}
