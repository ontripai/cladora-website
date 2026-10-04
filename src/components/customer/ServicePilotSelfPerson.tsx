'use client';
import { useEffect, useRef, useState } from 'react';
import type { Language } from '@/types';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { serviceSelfPersonSchema, serviceSelfPersonResultSchema, type ServiceSelfPerson } from '@/lib/customer/service-self-person-schema';
const copy = {
  en: { title:'Register my pilot person', note:'Creates a new temporary test person linked only to your current membership. This does not verify legal identity or grant ownership, residency or another person’s records.', name:'My name', expiry:'Expires at (within 72 hours)', confirm:'This test person represents my own account.', save:'Register my test person', retry:'Retry the same registration', error:'Registration is not confirmed. Retry the same decision.', conflict:'An existing mapping or changed decision requires review. Refresh the page.', invalid:'Confirm your own account and choose a future expiry within 72 hours.', success:'Test person registered. Refresh to continue.', refresh:'Refresh' },
  ro: { title:'Înregistrează persoana mea de pilot', note:'Creează o persoană temporară de test asociată numai calității tale actuale de membru. Nu verifică identitatea juridică și nu acordă proprietate, rezidență sau datele altei persoane.', name:'Numele meu', expiry:'Expiră la (în 72 de ore)', confirm:'Această persoană de test reprezintă propriul meu cont.', save:'Înregistrează persoana mea de test', retry:'Reîncearcă aceeași înregistrare', error:'Înregistrarea nu este confirmată. Reîncearcă aceeași decizie.', conflict:'O asociere existentă sau o decizie modificată necesită verificare. Reîncarcă pagina.', invalid:'Confirmă propriul cont și alege o expirare viitoare în 72 de ore.', success:'Persoana de test a fost înregistrată. Reîncarcă pentru a continua.', refresh:'Reîncarcă' },
  fa: { title:'ثبت شخص آزمایشی خودم', note:'یک شخص آزمایشی موقت فقط برای عضویت فعلی شما ساخته می‌شود. این ثبت تأیید هویت قانونی، مالکیت، سکونت یا دسترسی به سوابق شخص دیگری نیست.', name:'نام خودم', expiry:'زمان انقضا (حداکثر تا ۷۲ ساعت دیگر)', confirm:'این شخص آزمایشی مربوط به حساب خود من است.', save:'ثبت شخص آزمایشی خودم', retry:'تکرار همان ثبت', error:'نتیجهٔ ثبت تأیید نشده است؛ همان تصمیم را دوباره ارسال کنید.', conflict:'اتصال موجود یا تصمیم تغییرکرده به بررسی نیاز دارد؛ صفحه را بازخوانی کنید.', invalid:'حساب خود را تأیید و زمانی در آینده تا حداکثر ۷۲ ساعت دیگر انتخاب کنید.', success:'شخص آزمایشی ثبت شد؛ برای ادامه صفحه را بازخوانی کنید.', refresh:'بازخوانی' },
};
export function ServicePilotSelfPerson({ contextId, workspaceId, lang }: { contextId:string; workspaceId:string; lang:Language }) {
  const fetch=useDashboardFetch(); const t=copy[lang];
  const [pending,setPending]=useState<ServiceSelfPerson|null>(null); const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState(''); const [saved,setSaved]=useState(false); const [conflict,setConflict]=useState(false);
  const active=useRef(true); const guard=useRef(false); const abort=useRef<AbortController|null>(null);
  useEffect(()=>{active.current=true;return()=>{active.current=false;abort.current?.abort();};},[]);
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();if(guard.current||saved||conflict)return;
    const form=new FormData(event.currentTarget);let command=pending;
    if(!command){const expiry=Date.parse(String(form.get('expiry')||''));
      if(!Number.isFinite(expiry)){setNotice(t.invalid);return;}
      const parsed=serviceSelfPersonSchema.safeParse({context_id:contextId,workspace_id:workspaceId,name:form.get('name'),
      valid_until:new Date(expiry).toISOString(),
      confirm_self:form.get('confirm')==='on',idempotency_key:crypto.randomUUID()});
      if(!parsed.success||Date.parse(parsed.data.valid_until)<=Date.now()||Date.parse(parsed.data.valid_until)>Date.now()+72*3600000){setNotice(t.invalid);return;}
      command=parsed.data;setPending(command);
    }
    guard.current=true;setBusy(true);setNotice('');const controller=new AbortController();abort.current=controller;
    try {const response=await fetch('/api/customer/v1/services/self-person',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(command),signal:controller.signal});
      if(!response.ok){if(active.current){setConflict(response.status===409);setNotice(response.status===409?t.conflict:t.error);}return;}
      const result=serviceSelfPersonResultSchema.parse(await response.json());
      if(Date.parse(result.valid_until)!==Date.parse(command.valid_until))throw new Error('unconfirmed expiry');
      if(active.current&&!controller.signal.aborted){setSaved(true);setNotice(t.success);}
    }catch{if(active.current&&!controller.signal.aborted)setNotice(t.error);}finally{guard.current=false;if(active.current)setBusy(false);}
  }
  return <form onSubmit={event=>void submit(event)} className="space-y-3 rounded-xl border p-4"><h3 className="font-bold">{t.title}</h3><p>{t.note}</p>
    <fieldset disabled={busy||!!pending||saved} className="space-y-3">
      <label className="block">{t.name}<input name="name" required minLength={2} maxLength={120} className="block w-full rounded-lg border p-3"/></label>
      <label className="block">{t.expiry}<input name="expiry" type="datetime-local" required className="block w-full rounded-lg border p-3"/></label>
      <label className="flex gap-2"><input name="confirm" type="checkbox" required/>{t.confirm}</label>
    </fieldset>
    {!saved?<button disabled={busy||conflict} className="rounded-lg bg-[#087A6E] px-4 py-2 font-semibold text-white disabled:opacity-50">{pending?t.retry:t.save}</button>:null}
    {notice?<p role="status">{notice}</p>:null}
    {saved||conflict?<button type="button" onClick={()=>window.location.reload()} className="rounded-lg border px-4 py-2">{t.refresh}</button>:null}
  </form>;
}
