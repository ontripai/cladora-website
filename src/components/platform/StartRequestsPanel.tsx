'use client';

import { useState } from 'react';

export type StartRequest = {
  id: string; reference_id: string; created_at: string; lead_type: string;
  full_name: string; email: string; phone: string | null; city: string | null;
  message: string | null; status: string; assigned_platform_user_id: string | null;
  assignee_name: string | null;
};
export type SalesOperator = { id: string; display_name: string };

export function StartRequestsPanel({ lang, requests, sales, manager }: {
  lang: string; requests: StartRequest[]; sales: SalesOperator[]; manager: boolean;
}) {
  const fa = lang === 'fa';
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  async function update(leadId: string, action: 'assign' | 'status', value: string, reason: string) {
    setBusy(leadId); setError('');
    try {
      const body = action === 'assign'
        ? { action, lead_id: leadId, assignee_id: value || null, reason }
        : { action, lead_id: leadId, status: value, reason };
      const response = await fetch('/api/platform/v1/start-requests', {
        method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.code ?? 'UPDATE_FAILED');
      window.location.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'UPDATE_FAILED'); }
    finally { setBusy(null); }
  }
  return <section dir={fa ? 'rtl' : 'ltr'} className="mx-auto max-w-7xl space-y-5 text-white">
    <div><h1 className="text-2xl font-bold">{fa ? 'درخواست‌های شروع' : 'Start requests'}</h1>
      <p className="mt-2 text-sm text-slate-300">{fa ? 'درخواست‌های تماس و پایلوت. درخواست‌های جدید به‌طور خودکار میان کارشناسان فعال فروش توزیع می‌شوند.' : 'Contact and pilot requests. New requests are assigned automatically to active sales staff.'}</p></div>
    {error && <p role="alert" className="rounded border border-rose-500 p-3 text-rose-200">{error}</p>}
    {requests.length === 0 && <p className="rounded border border-[#1E3A5A] p-5 text-slate-300">{fa ? 'درخواستی برای نمایش وجود ندارد.' : 'No requests to display.'}</p>}
    <div className="grid gap-4">{requests.map(item => <article key={item.id} className="rounded-xl border border-[#1E3A5A] bg-[#0F2236] p-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{item.full_name} · {item.reference_id}</h2>
        <span className="rounded bg-[#14324F] px-2 py-1">{item.lead_type} · {item.status}</span></div>
      <p className="mt-2 text-slate-300">{item.email}{item.phone ? ` · ${item.phone}` : ''}{item.city ? ` · ${item.city}` : ''}</p>
      <p className="mt-1 text-xs text-slate-400">{new Date(item.created_at).toLocaleString(lang === 'fa' ? 'fa-IR' : 'en-GB')} · {fa ? 'مسئول:' : 'Owner:'} {item.assignee_name ?? (fa ? 'صف مدیر؛ تخصیص داده نشده' : 'Manager queue; unassigned')}</p>
      {item.message && <p className="mt-3 whitespace-pre-wrap rounded bg-[#081320] p-3">{item.message}</p>}
      {['new','contacted','qualified'].includes(item.status) && <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {manager && <form onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget); void update(item.id,'assign',String(values.get('assignee_id') ?? ''),String(values.get('reason') ?? '')); }} className="grid gap-2 rounded border border-[#1E3A5A] p-3">
          <label>{fa ? 'تخصیص به فروش' : 'Assign to sales'}<select name="assignee_id" defaultValue={item.assigned_platform_user_id ?? ''} className="mt-1 w-full rounded bg-[#081320] p-2"><option value="">{fa ? 'صف مدیر' : 'Manager queue'}</option>{sales.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}</select></label>
          <label>{fa ? 'دلیل تغییر مسئول' : 'Assignment reason'}<input name="reason" required minLength={8} maxLength={500} className="mt-1 w-full rounded bg-[#081320] p-2" /></label>
          <button disabled={busy === item.id} className="rounded bg-emerald-500 p-2 font-bold text-[#081320] disabled:opacity-50">{fa ? 'ثبت مسئول' : 'Save owner'}</button>
        </form>}
        <form onSubmit={event => { event.preventDefault(); const values = new FormData(event.currentTarget); void update(item.id,'status',String(values.get('status') ?? ''),String(values.get('reason') ?? '')); }} className="grid gap-2 rounded border border-[#1E3A5A] p-3">
          <label>{fa ? 'نتیجه پیگیری' : 'Follow-up result'}<select name="status" defaultValue="contacted" className="mt-1 w-full rounded bg-[#081320] p-2"><option value="contacted">{fa ? 'تماس گرفته شد' : 'Contacted'}</option><option value="qualified">{fa ? 'واجد شرایط' : 'Qualified'}</option><option value="rejected">{fa ? 'رد شد' : 'Rejected'}</option><option value="spam">Spam</option></select></label>
          <label>{fa ? 'شرح پیگیری' : 'Follow-up note'}<input name="reason" required minLength={8} maxLength={500} className="mt-1 w-full rounded bg-[#081320] p-2" /></label>
          <button disabled={busy === item.id} className="rounded bg-emerald-500 p-2 font-bold text-[#081320] disabled:opacity-50">{fa ? 'ثبت نتیجه' : 'Save result'}</button>
        </form>
      </div>}
    </article>)}</div>
    {requests.length === 100 && <p className="text-xs text-amber-200">{fa ? '۱۰۰ درخواست اخیر نمایش داده شده است.' : 'Showing the latest 100 requests.'}</p>}
  </section>;
}
