'use client';

import { useState } from 'react';

export function PilotWorkspaceCreator({ lang }: { lang: string }) {
  const fa = lang === 'fa';
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/platform/v1/pilot-workspaces', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget).entries())),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.code ?? 'CREATE_FAILED');
      window.location.reload();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'CREATE_FAILED'); }
    finally { setBusy(false); }
  }
  return <div dir={fa ? 'rtl' : 'ltr'}>
    <button type="button" onClick={() => setOpen(!open)} className="rounded bg-emerald-500 px-4 py-2 text-sm font-bold text-[#081320]">{fa ? 'ایجاد انجمن آزمایشی' : lang === 'ro' ? 'Creează asociație pilot' : 'Create pilot association'}</button>
    {open && <form onSubmit={submit} className="mt-4 grid gap-3 rounded-xl border border-[#1E3A5A] bg-[#0F2236] p-5 text-sm text-white md:grid-cols-2">
      <label>{fa ? 'نام انجمن / مشتری' : 'Association name'}<input required minLength={3} maxLength={200} name="legal_name" className="mt-1 w-full rounded bg-[#081320] p-3" /></label>
      <label>{fa ? 'مسئول تجاری' : 'Commercial owner'}<input required minLength={3} maxLength={200} name="commercial_owner" className="mt-1 w-full rounded bg-[#081320] p-3" /></label>
      <label>{fa ? 'شماره ثبت (اختیاری)' : 'Registration number (optional)'}<input maxLength={100} name="registration_number" className="mt-1 w-full rounded bg-[#081320] p-3" /></label>
      <label>{fa ? 'زبان پیش‌فرض' : 'Default language'}<select name="default_locale" defaultValue="ro" className="mt-1 w-full rounded bg-[#081320] p-3"><option value="ro">Română</option><option value="en">English</option><option value="fa">فارسی</option></select></label>
      <p className="md:col-span-2 text-xs text-amber-200">{fa ? 'فقط ویژهٔ انجمن مالکان: مشتری پیش‌نویس و ورک‌اسپیس ASSOCIATION در وضعیت LEAD ایجاد می‌شوند. برای ساختمان دوم همان مشتری یا کاربری غیرانجمنی از این فرم استفاده نکنید؛ دعوتی ارسال نمی‌شود.' : lang === 'ro' ? 'Numai pentru asociații de proprietari: creează un client nou și un spațiu ASSOCIATION în starea LEAD. Nu folosiți formularul pentru a doua clădire a aceluiași client sau un spațiu neasociativ. Nu se trimite invitație.' : 'Owners associations only: creates a new customer and an ASSOCIATION workspace in LEAD. Do not use this form for another building of the same customer or a non-association space. No invitation is sent.'}</p>
      {error && <p role="alert" className="md:col-span-2 text-rose-300">{error}</p>}
      <div className="flex gap-2 md:col-span-2"><button disabled={busy} className="rounded bg-emerald-500 px-4 py-2 font-bold text-[#081320] disabled:opacity-50">{fa ? 'ایجاد' : 'Create'}</button><button type="button" onClick={() => setOpen(false)} className="rounded border border-[#1E3A5A] px-4 py-2">{fa ? 'انصراف' : 'Cancel'}</button></div>
    </form>}
  </div>;
}
