'use client';

import { useState } from 'react';
import type { Language } from '@/types';

export type ClaimableUnitInvitation = { id: string; unit: string; building: string; role: string; expires_at: string };
const copy = {
  ro: { title: 'Invitație pentru unitate', name: 'Nume afișat', accept: 'Acceptă invitația', error: 'Invitația nu a putut fi acceptată. Verificați autentificarea în doi pași și relația cu unitatea.', success: 'Invitația a fost acceptată. Deschideți spațiul de lucru.' },
  en: { title: 'Unit invitation', name: 'Display name', accept: 'Accept invitation', error: 'Invitation could not be accepted. Check two-factor authentication and the unit relationship.', success: 'Invitation accepted. Open your workspace.' },
  fa: { title: 'دعوت به واحد', name: 'نام نمایشی', accept: 'پذیرش دعوت', error: 'پذیرش ممکن نشد. احراز هویت دومرحله‌ای و رابطه با واحد را بررسی کنید.', success: 'دعوت پذیرفته شد. فضای کاری را باز کنید.' },
};
export function UnitInvitationContinuation({ lang, invitations }: { lang: Language; invitations: ClaimableUnitInvitation[] }) {
  const t = copy[lang];
  const [name, setName] = useState('');
  const [result, setResult] = useState('');
  const [busy, setBusy] = useState(false);
  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="space-y-4 rounded-xl border bg-white p-6">
    <h2 className="text-lg font-bold">{t.title}</h2>
    <label className="block">{t.name}<input required minLength={2} maxLength={120} value={name} onChange={event => setName(event.target.value)} className="block w-full rounded border p-2" /></label>
    {invitations.map(invite => <button key={invite.id} type="button" disabled={busy || name.trim().length < 2}
      onClick={() => { setBusy(true); setResult(''); void fetch('/api/auth/unit-invitations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invitation_id: invite.id, display_name: name.trim() }),
      }).then(response => { if (!response.ok) throw new Error(); setResult(t.success); })
        .catch(() => setResult(t.error)).finally(() => setBusy(false)); }}
      className="block w-full rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">
      {t.accept}: {invite.building} · {invite.unit} · {invite.role}
    </button>)}
    {result && <p role="status">{result}</p>}
  </section>;
}
