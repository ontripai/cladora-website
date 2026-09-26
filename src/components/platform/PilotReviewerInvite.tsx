'use client';

import { useState } from 'react';
import type { Language } from '@/types';
import type { CustomerWorkspace } from '@/types/platform';

const copy = {
  fa: { title:'دعوت تأییدکنندهٔ مستقل پایلوت',workspace:'ورک‌اسپیس پایلوت',choose:'انتخاب ورک‌اسپیس',picker:'انتخاب ورک‌اسپیس فعال آزمایشی',empty:'ورک‌اسپیس فعال آزمایشی در این صفحه پیدا نشد.',load:'بارگذاری فهرست ممکن نشد.',more:'موارد بیشتر',loading:'در حال بارگذاری…',email:'ایمیل تأییدکننده',reason:'دلیل دسترسی',chooseReason:'انتخاب یا ویرایش دلیل',reasonTitle:'انتخاب دلیل دعوت',suggested:'دلیل پیشنهادی',defaultReason:'تأیید مستقل راه‌اندازی ساختمان آزمایشی',edit:'متن دلیل را در صورت نیاز ویرایش کنید؛ همین متن ثبت می‌شود.',save:'ثبت دلیل',close:'بستن',send:'ارسال دعوت محدود',sent:'دعوت ارسال شد. تأییدکننده باید ورود و MFA را تکمیل کند.',error:'دعوت انجام نشد؛ وضعیت پایلوت و حساب را بررسی کنید.' },
  ro: { title:'Invită revizorul independent al pilotului',workspace:'Spațiu pilot',choose:'Alege spațiul',picker:'Alege spațiul pilot activ',empty:'Nu există spații pilot active pe această pagină.',load:'Lista nu a putut fi încărcată.',more:'Mai multe rezultate',loading:'Se încarcă…',email:'E-mail revizor',reason:'Motivul accesului',chooseReason:'Alege sau editează motivul',reasonTitle:'Alege motivul invitației',suggested:'Motiv sugerat',defaultReason:'Aprobarea independentă a configurării clădirii pilot',edit:'Poți modifica motivul; exact acest text va fi păstrat.',save:'Salvează motivul',close:'Închide',send:'Trimite invitația limitată',sent:'Invitație trimisă. Revizorul trebuie să finalizeze autentificarea și MFA.',error:'Invitația a eșuat; verifică pilotul și contul.' },
  en: { title:'Invite independent pilot reviewer',workspace:'Pilot workspace',choose:'Choose workspace',picker:'Choose an active pilot workspace',empty:'No active pilot workspaces on this page.',load:'Workspaces could not be loaded.',more:'Load more',loading:'Loading…',email:'Reviewer email',reason:'Access reason',chooseReason:'Choose or edit reason',reasonTitle:'Choose invitation reason',suggested:'Suggested reason',defaultReason:'Independent approval of pilot building setup',edit:'Edit the reason if needed; this exact text is recorded.',save:'Save reason',close:'Close',send:'Send limited invitation',sent:'Invitation sent. Reviewer must complete sign-in and MFA.',error:'Invitation failed; verify pilot and account.' },
} as const;

export function PilotReviewerInvite({lang}:{lang:Language}) {
  const t=copy[lang];
  const [popup,setPopup]=useState<'workspace'|'reason'|null>(null);
  const [workspace,setWorkspace]=useState<CustomerWorkspace|null>(null);
  const [items,setItems]=useState<CustomerWorkspace[]>([]);
  const [hasMore,setHasMore]=useState(false);
  const [loading,setLoading]=useState(false);
  const [loadError,setLoadError]=useState(false);
  const [email,setEmail]=useState('');
  const [reason,setReason]=useState('');
  const [draftReason,setDraftReason]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');

  async function loadPage(offset:number) {
    setLoading(true);setLoadError(false);
    try {
      const response=await fetch(`/api/platform/v1/workspaces?limit=50&offset=${offset}`,{cache:'no-store'});
      if(!response.ok)throw new Error('LOAD_FAILED');
      const body=await response.json() as {workspaces:CustomerWorkspace[];pagination:{hasMore:boolean}};
      setItems(current=>offset===0?body.workspaces:[...current,...body.workspaces]);
      setHasMore(body.pagination.hasMore);
    }catch{setLoadError(true)}finally{setLoading(false)}
  }
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault();if(!workspace||reason.trim().length<10)return;
    setBusy(true);setMessage('');
    try {
      const response=await fetch(`/api/platform/v1/workspaces/${workspace.id}/pilot-reviewer`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,reason,lang})});
      setMessage(response.ok?t.sent:`${t.error} (${(await response.json())?.error?.code??response.status})`);
    }catch{setMessage(t.error)}finally{setBusy(false)}
  }
  const active=items.filter(item=>item.environment==='PILOT'&&item.lifecycle_status==='ACTIVE');
  const direction=lang==='fa'?'rtl':'ltr';
  return <>
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-emerald-500/30 bg-[#102A43] p-5 text-white" dir={direction}>
      <h2 className="font-bold">{t.title}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><span className="block">{t.workspace}</span><button type="button" onClick={()=>{setPopup('workspace');void loadPage(0)}} className="w-full rounded bg-white p-2 text-start text-slate-900">{workspace?`${workspace.tenant_legal_name??workspace.commercial_owner} · ${workspace.id}`:t.choose}</button></div>
        <label>{t.email}<input required type="email" value={email} onChange={e=>setEmail(e.target.value)} className="block w-full rounded bg-white p-2 text-slate-900"/></label>
      </div>
      <div><span className="block">{t.reason}</span><button type="button" onClick={()=>{setDraftReason(reason||t.defaultReason);setPopup('reason')}} className="w-full rounded bg-white p-2 text-start text-slate-900">{reason||t.chooseReason}</button></div>
      <button disabled={busy||!workspace||reason.trim().length<10} className="rounded bg-emerald-500 px-4 py-2 font-bold text-slate-950 disabled:opacity-50">{t.send}</button>
      {message&&<p role="status">{message}</p>}
    </form>
    {popup==='workspace'&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="pilot-workspace-title" tabIndex={-1} ref={element=>element?.focus()} onKeyDown={event=>{if(event.key==='Escape')setPopup(null)}} className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 text-slate-900" dir={direction}>
        <div className="flex justify-between gap-4"><h3 id="pilot-workspace-title" className="font-bold">{t.picker}</h3><button type="button" onClick={()=>setPopup(null)}>{t.close}</button></div>
        {loadError&&<p role="alert">{t.load}</p>}
        {active.map(item=><button key={item.id} type="button" onClick={()=>{setWorkspace(item);setPopup(null)}} className="mt-2 block w-full rounded border p-3 text-start hover:bg-emerald-50"><span className="block font-semibold">{item.tenant_legal_name??item.commercial_owner}</span><span className="block text-xs text-slate-600">{item.workspace_type} · {item.id}</span></button>)}
        {!loading&&!loadError&&!active.length&&<p>{t.empty}</p>}
        {loading&&<p role="status">{t.loading}</p>}
        {hasMore&&<button type="button" disabled={loading} onClick={()=>void loadPage(items.length)} className="mt-3 rounded border px-3 py-2 disabled:opacity-50">{t.more}</button>}
        {loadError&&<button type="button" onClick={()=>void loadPage(0)} className="mt-3 rounded border px-3 py-2">{t.more}</button>}
      </div>
    </div>}
    {popup==='reason'&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="pilot-reason-title" tabIndex={-1} ref={element=>element?.focus()} onKeyDown={event=>{if(event.key==='Escape')setPopup(null)}} className="w-full max-w-xl space-y-3 rounded-xl bg-white p-5 text-slate-900" dir={direction}>
        <div className="flex justify-between gap-4"><h3 id="pilot-reason-title" className="font-bold">{t.reasonTitle}</h3><button type="button" onClick={()=>setPopup(null)}>{t.close}</button></div>
        <button type="button" onClick={()=>setDraftReason(t.defaultReason)} className="block w-full rounded border p-3 text-start"><span className="block text-xs text-slate-600">{t.suggested}</span>{t.defaultReason}</button>
        <label className="block">{t.edit}<textarea minLength={10} maxLength={500} value={draftReason} onChange={e=>setDraftReason(e.target.value)} className="mt-2 block min-h-24 w-full rounded border p-2"/></label>
        <button type="button" disabled={draftReason.trim().length<10} onClick={()=>{setReason(draftReason.trim());setPopup(null)}} className="rounded bg-emerald-600 px-4 py-2 font-bold text-white disabled:opacity-50">{t.save}</button>
      </div>
    </div>}
  </>;
}
