'use client';

import { useState } from 'react';

const roles = ['PLATFORM_OPERATIONS','PLATFORM_FINANCE','PLATFORM_SUPPORT','PLATFORM_AUDITOR','PLATFORM_SALES','PLATFORM_CONTRACTS','PLATFORM_ONBOARDING'] as const;

export function OperatorManagement({ lang }: { lang: string }) {
  const fa = lang === 'fa';
  const [mode, setMode] = useState<'create' | 'grant' | 'revoke' | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      const form = new FormData(event.currentTarget);
      const selectedRoles = form.getAll('roles').map(String);
      if (mode !== 'revoke' && !selectedRoles.length) throw new Error('SELECT_ROLE');
      const response = await fetch(mode === 'create' ? '/api/platform/v1/operators' : '/api/platform/v1/operators/roles', {
        method: mode === 'revoke' ? 'DELETE' : 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...Object.fromEntries(form.entries()), ...(mode === 'revoke' ? {} : { roles: selectedRoles }) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.code ?? 'SAVE_FAILED');
      window.location.reload();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : 'SAVE_FAILED'); }
    finally { setBusy(false); }
  }
  return <div dir={fa ? 'rtl' : 'ltr'} className="rounded-xl border border-[#1E3A5A] bg-[#0F2236] p-4 text-sm text-white">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => { setMode('create'); setMessage(''); }} className="rounded bg-emerald-500 px-4 py-2 font-bold text-[#081320]">{fa ? 'ثبت اپراتور' : 'Register operator'}</button>
      <button type="button" onClick={() => { setMode('grant'); setMessage(''); }} className="rounded border border-[#1E3A5A] px-4 py-2">{fa ? 'اعطای نقش' : 'Grant role'}</button>
      <button type="button" onClick={() => { setMode('revoke'); setMessage(''); }} className="rounded border border-[#1E3A5A] px-4 py-2">{fa ? 'لغو نقش' : 'Revoke role'}</button>
    </div>
    {mode && <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
      {mode === 'create' && <>
        <label>{fa ? 'ایمیل حساب موجود و تأییدشده' : 'Verified account email'}<input required type="email" maxLength={320} name="email" className="mt-1 w-full rounded bg-[#081320] p-3" /></label>
        <label>{fa ? 'شناسه کارمندی' : 'Employee reference'}<input required minLength={3} maxLength={80} name="employee_ref" className="mt-1 w-full rounded bg-[#081320] p-3" /></label>
        <label>{fa ? 'نام نمایشی' : 'Display name'}<input required minLength={3} maxLength={150} name="display_name" className="mt-1 w-full rounded bg-[#081320] p-3" /></label>
      </>}
      {mode === 'grant' && <label>{fa ? 'شناسه اپراتور از فهرست پایین' : 'Operator ID from the list below'}<input required name="platform_user_id" className="mt-1 w-full rounded bg-[#081320] p-3" /></label>}
      {mode === 'revoke' && <label>{fa ? 'شناسه اعطای نقش' : 'Role assignment ID'}<input required name="assignment_id" className="mt-1 w-full rounded bg-[#081320] p-3" /></label>}
      {mode !== 'revoke' && <fieldset className="md:col-span-2 rounded border border-[#1E3A5A] p-3"><legend className="px-1">{fa ? 'نقش‌های پلتفرم (چند مورد را تیک بزنید)' : 'Platform roles (select one or more)'}</legend><div className="grid gap-2 sm:grid-cols-2">{roles.map(role => <label key={role} className="flex cursor-pointer items-center gap-2 rounded bg-[#081320] px-3 py-2"><input type="checkbox" name="roles" value={role} className="h-4 w-4 accent-emerald-500" /><span>{role}</span></label>)}</div></fieldset>}
      <label className="md:col-span-2">{fa ? 'دلیل ثبت در حسابرسی (حداقل ۸ نویسه)' : 'Audit reason (at least 8 characters)'}<textarea name="reason" required minLength={8} maxLength={500} className="mt-1 w-full rounded bg-[#081320] p-3" /></label>
      <p className="md:col-span-2 text-xs text-amber-200">{fa ? 'هر نقش مستقل ثبت می‌شود. برای کارمند موجود از «اعطای نقش» استفاده کنید. ایمیلی ارسال نمی‌شود.' : 'Each role is recorded independently. Use Grant role for an existing employee. No email is sent.'}</p>
      {message && <p role="alert" className="md:col-span-2 text-rose-300">{message === 'SELECT_ROLE' ? (fa ? 'حداقل یک نقش را انتخاب کنید.' : 'Select at least one role.') : message === 'VERIFIED_ACCOUNT_REQUIRED' && fa ? 'این ایمیل هنوز حساب تأییدشده ندارد.' : message}</p>}
      <div className="flex gap-2 md:col-span-2"><button disabled={busy} className="rounded bg-emerald-500 px-4 py-2 font-bold text-[#081320] disabled:opacity-50">{fa ? 'ثبت' : 'Save'}</button><button type="button" onClick={() => setMode(null)} className="rounded border border-[#1E3A5A] px-4 py-2">{fa ? 'انصراف' : 'Cancel'}</button></div>
    </form>}
  </div>;
}
