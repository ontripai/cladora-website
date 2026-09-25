'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export type CaseInvitation = { id: string; case_id: string; reference_id: string; expires_at: string };
export type CaseListing = { id: string; reference_id: string; status: string; created_at: string; workspace_id: string | null; unread_count: number };
export type CaseMessage = { id: string; author_id: string; visibility: 'shared' | 'internal'; body: string; created_at: string };
export type CaseDetail = { id: string; status: string; workspace_id: string | null; contract_id: string | null; staff_view: boolean; messages: CaseMessage[]; unread_count: number };
export type CaseDocument = { id: string; document_id: string; title: string; version: number; scan_status: 'pending'|'clean'|'quarantined'; visibility: 'shared'|'internal'; created_at: string; uploaded_by: string };
export type CaseStaffOption = { id: string; name: string; role: string };

export function CasePortal({ lang, invitations, cases }: { lang: string; invitations: CaseInvitation[]; cases: CaseListing[] }) {
  const fa = lang === 'fa';
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function claim(id: string) {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/cases/invitations', { method:'POST', credentials:'same-origin', headers:{ 'Content-Type':'application/json' }, body:JSON.stringify({ invitation_id:id }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.code ?? 'INVITATION_UNAVAILABLE');
      router.push(`/${lang}/cases/${result.case.case_id}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'INVITATION_UNAVAILABLE'); }
    finally { setBusy(false); }
  }
  return <main dir={fa?'rtl':'ltr'} className="mx-auto min-h-screen max-w-4xl space-y-5 bg-[#F6F9FC] px-5 pb-20 pt-28 text-[#102A43]">
    <h1 className="text-2xl font-black">{fa?'کارتابل مشترک مشتری':'Customer case portal'}</h1>
    <p className="text-sm">{fa?'پرونده‌ها، پیام‌ها و پاسخ‌های کلادورا را در همین سامانه دنبال کنید.':'Follow your cases and replies within CLADORA.'}</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {invitations.length>0 && <section className="rounded-xl border bg-white p-4"><h2 className="font-bold">{fa?'دعوت‌های منتظر پذیرش':'Pending invitations'}</h2>
      {invitations.map(inv=><div key={inv.id} className="mt-3 flex items-center justify-between gap-3 border-t pt-3"><span>{inv.reference_id}</span>
        <button type="button" disabled={busy} onClick={()=>void claim(inv.id)} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">{fa?'پذیرش پرونده':'Accept case'}</button></div>)}
    </section>}
    <section className="rounded-xl border bg-white p-4"><h2 className="font-bold">{fa?'پرونده‌های من':'My cases'}</h2>
      {cases.length===0 && <p className="mt-3 text-slate-500">{fa?'هنوز پرونده‌ای به حساب شما متصل نشده است.':'No cases are linked to your account.'}</p>}
      {cases.map(item=><Link key={item.id} href={`/${lang}/cases/${item.id}`} className="mt-3 flex justify-between border-t pt-3 text-emerald-800 hover:underline"><span>{item.reference_id}{item.unread_count>0?` · ${item.unread_count} ${fa?'خوانده‌نشده':'unread'}`:''}</span><span>{item.status}</span></Link>)}
    </section>
  </main>;
}

export function CaseConversation({ lang, detail, documents, userId, manager, reviewer, staffOptions }: { lang: string; detail: CaseDetail; documents: CaseDocument[]; userId: string; manager: boolean; reviewer: boolean; staffOptions: CaseStaffOption[] }) {
  const fa=lang==='fa'; const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);setError('');
    try {
      const form=new FormData(event.currentTarget);
      const response=await fetch('/api/cases/messages',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({case_id:detail.id,body:String(form.get('body')??''),visibility:detail.staff_view?String(form.get('visibility')??'shared'):'shared'})});
      const result=await response.json();if(!response.ok)throw new Error(result.error?.code??'MESSAGE_FAILED');
      window.location.reload();
    }catch(cause){setError(cause instanceof Error?cause.message:'MESSAGE_FAILED');}finally{setBusy(false);}
  }
  async function link(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');
    try{const form=new FormData(event.currentTarget);
      const response=await fetch('/api/platform/v1/cases/link',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({case_id:detail.id,workspace_id:form.get('workspace_id'),contract_id:form.get('contract_id')||null,reason:form.get('reason')})});
      const result=await response.json();if(!response.ok)throw new Error(result.error?.code??'LINK_FAILED');window.location.reload();
    }catch(cause){setError(cause instanceof Error?cause.message:'LINK_FAILED');}finally{setBusy(false);}
  }
  async function markRead(){
    setBusy(true);setError('');try{const response=await fetch('/api/cases/read',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({case_id:detail.id})});
      if(!response.ok)throw new Error('READ_FAILED');window.location.reload();
    }catch(cause){setError(cause instanceof Error?cause.message:'READ_FAILED');}finally{setBusy(false);}
  }
  async function upload(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');
    try{const form=new FormData(event.currentTarget);form.set('case_id',detail.id);
      if(!detail.staff_view)form.set('visibility','shared');
      const response=await fetch('/api/cases/documents',{method:'POST',credentials:'same-origin',body:form});
      const result=await response.json();if(!response.ok)throw new Error(result.error?.code??'UPLOAD_FAILED');window.location.reload();
    }catch(cause){setError(cause instanceof Error?cause.message:'UPLOAD_FAILED');}finally{setBusy(false);}
  }
  async function review(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');
    try{const form=new FormData(event.currentTarget);
      const response=await fetch('/api/platform/v1/cases/documents/review',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({version_id:form.get('version_id'),verdict:form.get('verdict'),evidence:form.get('evidence')})});
      const result=await response.json();if(!response.ok)throw new Error(result.error?.code??'REVIEW_FAILED');window.location.reload();
    }catch(cause){setError(cause instanceof Error?cause.message:'REVIEW_FAILED');}finally{setBusy(false);}
  }
  async function assignStaff(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setError('');
    try{const form=new FormData(event.currentTarget);
      const response=await fetch('/api/platform/v1/cases/staff',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({case_id:detail.id,platform_user_id:form.get('platform_user_id'),duty:form.get('duty'),status:form.get('status'),reason:form.get('reason')})});
      const result=await response.json();if(!response.ok)throw new Error(result.error?.code??'ASSIGNMENT_FAILED');window.location.reload();
    }catch(cause){setError(cause instanceof Error?cause.message:'ASSIGNMENT_FAILED');}finally{setBusy(false);}
  }
  return <main dir={fa?'rtl':'ltr'} className="mx-auto min-h-screen max-w-4xl space-y-5 bg-[#F6F9FC] px-5 pb-20 pt-28 text-[#102A43]">
    <Link href={detail.staff_view?`/${lang}/platform/start-requests`:`/${lang}/cases`} className="text-emerald-800 hover:underline">{fa?'بازگشت':'Back'}</Link>
    <h1 className="text-2xl font-black">{fa?'پروندهٔ مشتری':'Customer case'}</h1>
    <p className="text-xs text-slate-500">{fa?'شناسهٔ پرونده':'Case ID'}: {detail.id}</p>
    {detail.unread_count>0&&<button type="button" disabled={busy} onClick={()=>void markRead()} className="rounded border border-emerald-700 px-3 py-2 text-emerald-900">{fa?`علامت‌گذاری ${detail.unread_count} اعلان به‌عنوان خوانده‌شده`:`Mark ${detail.unread_count} notification(s) read`}</button>}
    <section aria-label={fa?'پیام‌های پرونده':'Case messages'} className="space-y-3">
      {detail.messages.length===0&&<p className="rounded border bg-white p-4">{fa?'هنوز پیامی ثبت نشده است.':'No messages yet.'}</p>}
      {detail.messages.map(message=><article key={message.id} className="rounded-xl border bg-white p-4">
        <div className="flex justify-between text-xs text-slate-500"><span>{message.author_id===userId?(fa?'شما':'You'):(fa?'طرف مقابل':'Other participant')} · {message.visibility==='internal'?(fa?'فقط داخلی':'Internal'):(fa?'مشترک':'Shared')}</span><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(fa?'fa-IR':'en-GB')}</time></div>
        <p className="mt-2 whitespace-pre-wrap">{message.body}</p></article>)}
    </section>
    {manager&&<form onSubmit={assignStaff} className="grid gap-2 rounded-xl border bg-white p-4"><h2 className="font-bold">{fa?'تخصیص کارشناس به این پرونده':'Assign case specialist'}</h2>
      <label>{fa?'کارشناس دارای نقش فعال':'Active specialist'}<select name="platform_user_id" required className="mt-1 w-full rounded border p-2"><option value="">{fa?'انتخاب کنید':'Select'}</option>{staffOptions.filter(option=>option.role!=='PLATFORM_SUPER_ADMIN').map(option=><option key={`${option.id}-${option.role}`} value={option.id}>{option.name} · {option.role}</option>)}</select></label>
      <label>{fa?'مسئولیت':'Duty'}<select name="duty" className="mt-1 w-full rounded border p-2">{['sales','contracts','finance','onboarding','support','audit'].map(duty=><option key={duty} value={duty}>{duty}</option>)}</select></label>
      <label>{fa?'وضعیت':'Status'}<select name="status" className="mt-1 w-full rounded border p-2"><option value="active">{fa?'فعال':'Active'}</option><option value="revoked">{fa?'لغو':'Revoke'}</option></select></label>
      <label>{fa?'دلیل':'Reason'}<input name="reason" minLength={8} maxLength={500} required className="mt-1 w-full rounded border p-2" /></label>
      <button disabled={busy} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">{fa?'ثبت مسئولیت':'Save duty'}</button>
    </form>}
    <section className="space-y-3 rounded-xl border bg-white p-4"><h2 className="font-bold">{fa?'مدارک و نسخه‌ها':'Documents and versions'}</h2>
      <p className="text-xs text-amber-800">{fa?'فایل تازه تا ثبت نتیجهٔ بررسی امنیتی مستقل قابل دریافت نیست.':'New files remain unavailable until an independent security review records a verdict.'}</p>
      {documents.length===0&&<p className="text-sm text-slate-500">{fa?'مدرکی ثبت نشده است.':'No documents yet.'}</p>}
      {documents.map(doc=><div key={doc.id} className="border-t pt-3 text-sm"><p className="font-semibold">{doc.title} · v{doc.version} · {doc.visibility==='internal'?(fa?'داخلی':'Internal'):(fa?'مشترک':'Shared')} · {doc.scan_status}</p>
        {doc.scan_status==='clean'&&<a href={`/api/cases/documents/${doc.id}`} className="text-emerald-800 underline">{fa?'دریافت نسخه':'Download version'}</a>}
        {reviewer&&doc.scan_status==='pending'&&doc.uploaded_by!==userId&&<div className="mt-2 space-y-2">
          <a href={`/api/platform/v1/cases/documents/inspection/${doc.id}`} className="text-amber-800 underline">{fa?'دریافت برای بررسی مستقل':'Download for independent inspection'}</a>
          <form onSubmit={review} className="grid gap-2"><input name="version_id" type="hidden" value={doc.id} />
            <select name="verdict" className="rounded border p-2"><option value="quarantined">{fa?'قرنطینه':'Quarantine'}</option><option value="clean">{fa?'پاک، پس از اسکن مستقل':'Clean after independent scan'}</option></select>
            <input name="evidence" required minLength={15} maxLength={1000} placeholder={fa?'شناسه و نتیجهٔ اسکن مستقل':'Independent scan evidence and reference'} className="rounded border p-2" />
            <button disabled={busy} className="rounded bg-amber-700 px-3 py-2 text-white disabled:opacity-50">{fa?'ثبت نتیجهٔ بررسی':'Record review verdict'}</button></form>
        </div>}</div>)}
      {detail.status==='open'&&<form onSubmit={upload} className="grid gap-2 border-t pt-3"><label>{fa?'عنوان مدرک':'Document title'}<input name="title" required maxLength={200} className="mt-1 w-full rounded border p-2" /></label>
        <label>{fa?'نسخهٔ جدید سند قبلی (اختیاری)':'New version of an existing document (optional)'}<select name="document_id" className="mt-1 w-full rounded border p-2"><option value="">{fa?'سند جدید':'New document'}</option>{Array.from(new Map(documents.map(doc=>[doc.document_id,doc])).values()).filter(doc=>detail.staff_view||doc.visibility==='shared').map(doc=><option key={doc.document_id} value={doc.document_id}>{doc.title}</option>)}</select></label>
        {detail.staff_view&&<label>{fa?'سطح نمایش':'Visibility'}<select name="visibility" className="mt-1 w-full rounded border p-2"><option value="shared">{fa?'مشترک با مشتری':'Shared with customer'}</option><option value="internal">{fa?'فقط داخلی':'Internal only'}</option></select></label>}
        <label>{fa?'فایل PDF، PNG یا JPEG (حداکثر ۱۰ مگابایت)':'PDF, PNG or JPEG (up to 10 MB)'}<input name="file" required type="file" accept=".pdf,.png,.jpg,.jpeg" className="mt-1 block w-full" /></label>
        <button disabled={busy} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">{fa?'ثبت نسخه در قرنطینه':'Upload to quarantine'}</button></form>}
    </section>
    {detail.status==='open' && <form onSubmit={send} className="space-y-3 rounded-xl border bg-white p-4">
      <label className="block">{fa?'پیام جدید':'New message'}<textarea name="body" required maxLength={5000} rows={5} className="mt-1 w-full rounded border p-3" /></label>
      {detail.staff_view && <label className="block">{fa?'نمایش پیام':'Message visibility'}<select name="visibility" className="mt-1 w-full rounded border p-2"><option value="shared">{fa?'مشترک با مشتری':'Shared with customer'}</option><option value="internal">{fa?'فقط داخلی':'Internal only'}</option></select></label>}
      {error&&<p role="alert" className="text-red-700">{error}</p>}
      <button disabled={busy} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">{fa?'ارسال در پرونده':'Post to case'}</button>
    </form>}
    {manager&&!detail.workspace_id&&<form onSubmit={link} className="space-y-3 rounded-xl border bg-white p-4"><h2 className="font-bold">{fa?'اتصال به ورک‌اسپیس با مجوز تجاری ثبت‌شده':'Link approved workspace'}</h2>
      <label className="block">Workspace ID<input name="workspace_id" required className="mt-1 w-full rounded border p-2" /></label>
      <label className="block">{fa?'شناسه قرارداد فعال (برای دوره آزمایشی خالی بماند)':'Active contract ID (leave empty for pilot)'}<input name="contract_id" className="mt-1 w-full rounded border p-2" /></label>
      <label className="block">{fa?'دلیل اتصال':'Reason'}<input name="reason" required minLength={8} maxLength={500} className="mt-1 w-full rounded border p-2" /></label>
      {error&&<p role="alert" className="text-red-700">{error}</p>}
      <button disabled={busy} className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50">{fa?'ثبت اتصال':'Link workspace'}</button>
    </form>}
  </main>;
}
