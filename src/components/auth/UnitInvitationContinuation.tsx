'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { Language } from '@/types';

export type ClaimableUnitInvitation = { id: string; unit: string; building: string; role: string; expires_at: string };
const copy = {
  ro: { title: 'Invitație pentru spațiul de lucru', name: 'Nume afișat', accept: 'Acceptă invitația', error: 'Invitația nu a putut fi acceptată. Verificați autentificarea în doi pași și relația înregistrată.', success: 'Invitația a fost acceptată.', open: 'Deschideți spațiul de lucru' },
  en: { title: 'Workspace invitation', name: 'Display name', accept: 'Accept invitation', error: 'Invitation could not be accepted. Check two-factor authentication and the registered relationship.', success: 'Invitation accepted.', open: 'Open workspace' },
  fa: { title: 'دعوت به فضای کاری', name: 'نام نمایشی', accept: 'پذیرش دعوت', error: 'پذیرش ممکن نشد. احراز هویت دومرحله‌ای و رابطهٔ ثبت‌شده را بررسی کنید.', success: 'دعوت پذیرفته شد.', open: 'بازکردن فضای کاری' },
};
export function UnitInvitationContinuation({ lang, invitations }: { lang: Language; invitations: ClaimableUnitInvitation[] }) {
  const t = copy[lang];
  const [name, setName] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  const [claimed, setClaimed] = useState<string[]>([]);
  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="space-y-4 rounded-xl border bg-white p-6">
    <h2 className="text-lg font-bold">{t.title}</h2>
    <label className="block">{t.name}<input required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} className="block w-full rounded border p-2" /></label>
    {invitations.filter(invite => !claimed.includes(invite.id)).map(invite => <button key={invite.id} type="button" disabled={busy || name.trim().length < 2}
      onClick={() => { setBusy(true); setResult(''); void fetch('/api/auth/unit-invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invite.id, display_name: name.trim() }),
      }).then(response => { if (!response.ok) throw new Error(); setClaimed(items => [...items, invite.id]); setResult(t.success); })
        .catch(() => setResult(t.error)).finally(() => setBusy(false)); }}
      className="block w-full rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
      {t.accept}: {invite.building} · {invite.unit} · {invite.role}
    </button>)}
    {result && <p role="status">{result}</p>}
    {claimed.length > 0 && <Link href={`/${lang}/app/communications/private`} className="inline-block rounded bg-blue-700 px-4 py-2 text-white">{t.open}</Link>}
    <Link href={`/${lang}/account?choose=1`} className="block text-teal-800 underline">{lang === 'fa' ? 'بازگشت به نقش‌ها و محیط‌های فعلی' : lang === 'ro' ? 'Înapoi la rolurile și spațiile existente' : 'Back to existing roles and workspaces'}</Link>
  </section>;
}
