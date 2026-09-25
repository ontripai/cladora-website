'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Language } from '@/types';

type LinkRequest = { id: string; workspace_id?: string; canonical_unit_id: string; owner_user_id: string; evidence_reference: string; manager_evidence?: string; ownership_party_id?: string; status?: string };

export function OwnerLinkReviewPanel({ lang, platform }: { lang: Language; platform: boolean }) {
  const [workspace, setWorkspace] = useState('');
  const [links, setLinks] = useState<LinkRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const endpoint = platform ? '/api/platform/v1/owner-unit-links' : '/api/customer/v1/owner-unit-links';
  async function load() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`${endpoint}${platform ? '' : `?workspace_id=${encodeURIComponent(workspace)}`}`, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) throw new Error('READ_FAILED');
      setLinks((await response.json() as { links: LinkRequest[] }).links);
    } catch { setMessage(lang === 'fa' ? 'دریافت درخواست‌ها ناموفق بود.' : 'Could not load requests.'); }
    finally { setBusy(false); }
  }
  async function submit(event: React.FormEvent<HTMLFormElement>, link: LinkRequest) {
    event.preventDefault(); setBusy(true); setMessage('');
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    const body = platform ? { link_id: link.id, reason: values.reason } : { link_id: link.id, ownership_party_id: values.ownership_party_id, evidence: values.evidence };
    try {
      const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error('SAVE_FAILED');
      await load();
    } catch { setMessage(lang === 'fa' ? 'بررسی یا تأیید درخواست ناموفق بود؛ دسترسی و مدارک را بررسی کنید.' : 'Review failed. Check access and evidence.'); }
    finally { setBusy(false); }
  }
  return <main dir={lang === 'fa' ? 'rtl' : 'ltr'} className="mx-auto max-w-4xl space-y-5 p-6">
    <Link href={`/${lang}/${platform ? 'platform' : 'app'}`} className="text-teal-700">{lang === 'fa' ? 'بازگشت' : 'Back'}</Link>
    <h1 className="text-2xl font-bold">{lang === 'fa' ? platform ? 'تأیید نهایی اتصال مالک چندواحدی' : 'بررسی درخواست اتصال مالک چندواحدی' : platform ? 'Final owner unit approvals' : 'Review owner unit requests'}</h1>
    {!platform && <label className="block">Workspace ID<input value={workspace} onChange={event => setWorkspace(event.target.value)} className="mt-1 w-full rounded border p-2" /></label>}
    <button type="button" disabled={busy || (!platform && !workspace)} onClick={() => void load()} className="rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-50">{lang === 'fa' ? 'دریافت درخواست‌ها' : 'Load requests'}</button>
    {message && <p role="alert">{message}</p>}
    {links.map(link => <article key={link.id} className="space-y-2 rounded border bg-white p-4">
      <p>{lang === 'fa' ? 'واحد رسمی' : 'Official unit'}: {link.canonical_unit_id} · {lang === 'fa' ? 'مالک متقاضی' : 'Applicant'}: {link.owner_user_id}</p>
      {link.workspace_id && <p>Workspace: {link.workspace_id}</p>}
      <p className="break-words">{lang === 'fa' ? 'مرجع ارائه‌شده' : 'Submitted evidence'}: {link.evidence_reference}</p>
      {link.manager_evidence && <p className="break-words">{lang === 'fa' ? 'بررسی مدیر' : 'Manager review'}: {link.manager_evidence} · {link.ownership_party_id}</p>}
      {link.status === 'manager_verified' && !platform ? <p>{lang === 'fa' ? 'در انتظار تأیید نهایی سوپرادمین' : 'Awaiting platform approval'}</p> :
        <form onSubmit={event => void submit(event, link)} className="space-y-2">
          {platform ? <label className="block">{lang === 'fa' ? 'دلیل تأیید مستقل' : 'Independent approval reason'}<textarea name="reason" minLength={15} maxLength={500} required className="mt-1 w-full rounded border p-2" /></label> : <>
            <label className="block">{lang === 'fa' ? 'شناسه شخص مالک در ساختمان' : 'Recorded owner party ID'}<input name="ownership_party_id" required className="mt-1 w-full rounded border p-2" /></label>
            <label className="block">{lang === 'fa' ? 'مرجع تطبیق مالکیت' : 'Ownership verification evidence'}<textarea name="evidence" minLength={15} maxLength={500} required className="mt-1 w-full rounded border p-2" /></label>
          </>}
          <button disabled={busy} className="rounded bg-teal-700 px-4 py-2 text-white disabled:opacity-50">{lang === 'fa' ? 'ثبت بررسی' : 'Submit review'}</button>
        </form>}
    </article>)}
  </main>;
}
