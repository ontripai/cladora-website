'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Language } from '@/types';

export type ClaimablePropertyManagerInvitation = { id: string; property: string; expires_at: string };
const copy = {
  fa: { title: 'دعوت مدیریت ملک', name: 'نام نمایشی', accept: 'پذیرش دعوت', error: 'دعوت پذیرفته نشد. ورود دومرحله‌ای و اعتبار دعوت را بررسی کنید.', success: 'دعوت پذیرفته شد؛ دسترسی فقط به همین ملک محدود است.' },
  en: { title: 'Property manager invitation', name: 'Display name', accept: 'Accept invitation', error: 'Invitation could not be accepted. Check two-factor authentication and invitation validity.', success: 'Invitation accepted; access is limited to this property.' },
  ro: { title: 'Invitație de administrator al proprietății', name: 'Nume afișat', accept: 'Acceptă invitația', error: 'Invitația nu a putut fi acceptată. Verificați autentificarea în doi pași și valabilitatea invitației.', success: 'Invitația a fost acceptată; accesul este limitat la această proprietate.' },
} as const;

export function PropertyManagerInvitationContinuation({ lang, invitations }: { lang: Language; invitations: ClaimablePropertyManagerInvitation[] }) {
  const t = copy[lang]; const router = useRouter();
  const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [result, setResult] = useState(''); const [claimed, setClaimed] = useState<string[]>([]);
  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="mt-5 space-y-4 rounded-xl border bg-white p-6">
    <h2 className="text-lg font-bold">{t.title}</h2>
    <label className="block">{t.name}<input required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} className="mt-1 block w-full rounded border p-2" /></label>
    {invitations.filter(invite => !claimed.includes(invite.id)).map(invite => <button key={invite.id} type="button" disabled={busy || name.trim().length < 2}
      onClick={() => { setBusy(true); setResult(''); void fetch('/api/auth/property-manager-invitations', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invite.id, display_name: name.trim() }) }).then(async response => {
        if (!response.ok) throw new Error(); const accepted = await response.json() as { context_id?: string | null };
        if (accepted.context_id) sessionStorage.setItem('cladora.customer-context.v1', accepted.context_id);
        setClaimed(items => [...items, invite.id]); setResult(t.success); router.replace(`/${lang}/app/dashboard`);
      }).catch(() => setResult(t.error)).finally(() => setBusy(false)); }}
      className="block w-full rounded bg-[#087A6E] px-4 py-3 text-white disabled:opacity-50">{t.accept}: {invite.property}</button>)}
    {result && <p role="status" className="rounded bg-slate-50 p-3">{result}</p>}
  </section>;
}
