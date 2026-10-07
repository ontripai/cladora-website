'use client';

import { useEffect, useState } from 'react';
import type { Language } from '@/types';

type Prepared = { id: string; workspace_id: string; mode: 'PILOT' | 'PAID'; role_code: string; duration_hours: number | null; preparation_expires_at: string };
const copy = {
  fa: { title: 'فعال‌سازی دسترسی فضای کاری', loading: 'در حال دریافت دسترسی‌های آماده…',
    empty: 'هیچ دسترسی آماده‌ای برای ایمیل تأییدشدهٔ این حساب یافت نشد. ثبت تصمیم توسط مدیر پلتفرم و احراز هویت دومرحله‌ای لازم است.',
    name: 'نام نمایشی', activate: 'فعال‌سازی دسترسی', error: 'فعال‌سازی انجام نشد؛ وضعیت حساب، مهلت یا فضای کاری را بررسی کنید.',
    expiry: 'مهلت فعال‌سازی', pilot: 'آزمایشی', paid: 'قراردادی' },
  en: { title: 'Activate workspace access', loading: 'Loading prepared access…',
    empty: 'No prepared access exists for this verified email. A platform decision and MFA are required.',
    name: 'Display name', activate: 'Activate access', error: 'Activation failed. Check identity, expiry and workspace state.',
    expiry: 'Activation deadline', pilot: 'Pilot', paid: 'Contract' },
  ro: { title: 'Activează accesul la spațiul de lucru', loading: 'Se încarcă accesul pregătit…',
    empty: 'Nu există acces pregătit pentru acest e-mail verificat. Este necesară o decizie a platformei și MFA.',
    name: 'Nume afișat', activate: 'Activează accesul', error: 'Activarea a eșuat. Verifică identitatea, termenul și starea spațiului de lucru.',
    expiry: 'Termen activare', pilot: 'Pilot', paid: 'Contract' },
};
export function WorkspaceAccessActivation({ lang }: { lang: Language }) {
  const l = copy[lang];
  const [bases, setBases] = useState<Prepared[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void fetch('/api/auth/workspace-access', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return response.json() as Promise<{ bases: Prepared[] }> })
      .then(body => setBases(body.bases))
      .catch(requestError => { if (requestError instanceof DOMException && requestError.name === 'AbortError') return; setError(l.error); setBases([]); });
    return () => controller.abort();
  }, [l.error]);

  async function activate(id: string, workspaceId: string) {
    setError(''); setBusy(true);
    try {
      const response = await fetch('/api/auth/workspace-access', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ basis_id: id, display_name: name, locale: lang }) });
      if (!response.ok) throw new Error();
      window.location.replace(`/${lang}/app/onboarding?workspace=${workspaceId}`);
    } catch { setError(l.error); setBusy(false); }
  }

  return <section className="space-y-5 rounded-xl border border-slate-300 bg-white p-6 text-[#102A43]">
    <h1 className="text-2xl font-bold">{l.title}</h1>
    {bases === null && !error ? <p>{l.loading}</p> : null}
    {error ? <p role="alert" className="text-rose-700">{error}</p> : null}
    {bases?.length === 0 ? <p>{l.empty}</p> : null}
    {bases && bases.length > 0 ? <>
      <label className="block space-y-2">{l.name}<input required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)}
        className="block w-full rounded border border-slate-300 p-3" /></label>
      <ul className="space-y-3">{bases.map(b => <li key={b.id} className="rounded border border-slate-300 p-4">
        <p className="font-bold">{b.mode === 'PILOT' ? l.pilot : l.paid} · {b.role_code}</p>
        <p className="text-xs">{l.expiry}: {new Date(b.preparation_expires_at).toLocaleString(lang)}</p>
        <button type="button" disabled={busy || name.trim().length < 2} onClick={() => void activate(b.id, b.workspace_id)}
          className="mt-3 rounded bg-[#087A6E] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{l.activate}</button>
      </li>)}</ul>
    </> : null}
  </section>;
}
