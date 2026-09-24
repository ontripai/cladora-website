'use client';

import { useEffect, useState } from 'react';
import type { CustomerWorkspace } from '@/types/platform';

type Role = { id: string; code: string; name: string };
type Contract = { id: string; contract_ref: string; status: string; currency: string; signed_at: string | null };
type Basis = { id: string; email: string; mode: string; status: string; duration_hours: number | null; expires_at: string | null; paid_through: string | null };
type Lang = 'ro' | 'en' | 'fa';

const copy = {
  fa: { title: 'ثبت مبنای دسترسی مدیر', intro: 'ثبت این تصمیم ایمیل نمی‌فرستد و دسترسی ایجاد نمی‌کند. فقط حساب تأییدشدهٔ همان ایمیل پس از MFA می‌تواند آن را فعال کند.',
    pilot: 'معافیت آزمایشی', paid: 'قرارداد و پرداخت واقعی', email: 'ایمیل مدیر', role: 'نقش مدیر',
    reason: 'دلیل و مستند تصمیم (حداقل ۱۵ نویسه)', duration: 'مدت از زمان فعال‌سازی', contract: 'قرارداد فعال',
    paymentRef: 'شماره رسید یا مرجع بانکی پرداخت اشتراک CLADORA', amount: 'مبلغ پرداختی', paidOn: 'تاریخ پرداخت', paidThrough: 'پرداخت تا تاریخ',
    save: 'ثبت بدون ارسال ایمیل', close: 'بستن', revoke: 'لغو دسترسی', records: 'تصمیم‌های ثبت‌شده',
    failed: 'ثبت یا دریافت اطلاعات ناموفق بود. داده‌ها و وضعیت قرارداد را بررسی کنید.',
    success: 'تصمیم ثبت شد؛ هیچ ایمیلی ارسال نشد و دسترسی هنوز فعال نیست.',
    revoked: 'دسترسی لغو شد.', revokeReason: 'علت لغو دسترسی' },
  en: { title: 'Prepare manager access', intro: 'This records a decision without sending email or granting access. Only a verified account with the same email and MFA can activate it.',
    pilot: 'Timed pilot exception', paid: 'Real contract and payment', email: 'Manager email', role: 'Manager role',
    reason: 'Reason and evidence (at least 15 characters)', duration: 'Duration after activation', contract: 'Active contract',
    paymentRef: 'CLADORA subscription payment receipt or bank reference', amount: 'Paid amount', paidOn: 'Payment date', paidThrough: 'Paid through',
    save: 'Record without email', close: 'Close', revoke: 'Revoke access', records: 'Recorded decisions',
    failed: 'Unable to load or save. Check the evidence and contract status.',
    success: 'Recorded. No email was sent and access is not yet active.',
    revoked: 'Access revoked.', revokeReason: 'Revocation reason' },
  ro: { title: 'Pregătește accesul administratorului', intro: 'Decizia nu trimite e-mail și nu acordă acces. Numai contul verificat cu același e-mail și MFA o poate activa.',
    pilot: 'Excepție pilot temporară', paid: 'Contract și plată reală', email: 'E-mail administrator', role: 'Rol',
    reason: 'Motiv și dovadă (minimum 15 caractere)', duration: 'Durată de la activare', contract: 'Contract activ',
    paymentRef: 'Referința plății abonamentului CLADORA', amount: 'Sumă plătită', paidOn: 'Data plății', paidThrough: 'Plătit până la',
    save: 'Înregistrează fără e-mail', close: 'Închide', revoke: 'Revocă accesul', records: 'Decizii înregistrate',
    failed: 'Nu s-a putut încărca sau salva. Verifică dovada și contractul.',
    success: 'Înregistrat. Nu s-a trimis e-mail și accesul nu este încă activ.',
    revoked: 'Acces revocat.', revokeReason: 'Motivul revocării' },
};

export function WorkspaceAccessBasisDialog({ workspace, lang, onClose }: { workspace: CustomerWorkspace; lang: Lang; onClose: () => void }) {
  const l = copy[lang];
  const [mode, setMode] = useState<'PILOT' | 'PAID'>(workspace.environment === 'PILOT' ? 'PILOT' : 'PAID');
  const [roles, setRoles] = useState<Role[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [bases, setBases] = useState<Basis[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const preferred = workspace.workspace_type === 'PROPERTY_MANAGER' ? 'property_manager' : 'association_admin';
  const baseUrl = `/api/platform/v1/workspaces/${workspace.id}/access-bases`;

  async function load() {
    const [basisResponse, rolesResponse] = await Promise.all([
      fetch(baseUrl, { cache: 'no-store', credentials: 'same-origin' }),
      fetch('/api/platform/v1/workspaces/invitation-roles', { cache: 'no-store', credentials: 'same-origin' }),
    ]);
    if (!basisResponse.ok || !rolesResponse.ok) throw new Error('LOAD_FAILED');
    const basisData = await basisResponse.json() as { bases: Basis[]; contracts: Contract[] };
    const roleData = await rolesResponse.json() as { roles: Role[] };
    setBases(basisData.bases);
    setContracts(basisData.contracts);
    setRoles(roleData.roles);
  }

  useEffect(() => {
    let active = true;
    void Promise.all([
      fetch(baseUrl, { cache: 'no-store', credentials: 'same-origin' }),
      fetch('/api/platform/v1/workspaces/invitation-roles', { cache: 'no-store', credentials: 'same-origin' }),
    ]).then(async ([basisResponse, rolesResponse]) => {
      if (!basisResponse.ok || !rolesResponse.ok) throw new Error('LOAD_FAILED');
      const basisData = await basisResponse.json() as { bases: Basis[]; contracts: Contract[] };
      const roleData = await rolesResponse.json() as { roles: Role[] };
      if (active) { setBases(basisData.bases); setContracts(basisData.contracts); setRoles(roleData.roles); }
    }).catch(() => { if (active) setError(l.failed); });
    return () => { active = false; };
  }, [baseUrl, l.failed]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    const values = new FormData(event.currentTarget);
    const payload = {
      mode, email: values.get('email'), role_id: values.get('role_id'),
      evidence_note: values.get('evidence_note'),
      ...(mode === 'PILOT' ? { duration_hours: Number(values.get('duration_hours')) } : {
        contract_id: values.get('contract_id'), payment_reference: values.get('payment_reference'),
        payment_amount: Number(values.get('payment_amount')), payment_currency: values.get('payment_currency'),
        paid_on: values.get('paid_on'), paid_through: values.get('paid_through'),
      }),
    };
    try {
      const response = await fetch(baseUrl, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error('SAVE_FAILED');
      setNotice(l.success);
      await load();
    } catch { setError(l.failed); }
    finally { setBusy(false); }
  }

  async function revoke(basis: Basis) {
    const reason = window.prompt(l.revokeReason);
    if (!reason || reason.trim().length < 3) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`${baseUrl}/${basis.id}/revoke`, { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
      if (!response.ok) throw new Error('REVOKE_FAILED');
      setNotice(l.revoked); await load();
    } catch { setError(l.failed); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 p-4" role="presentation">
    <section role="dialog" aria-modal="true" aria-labelledby="access-basis-title" className="mx-auto my-8 max-w-xl space-y-4 rounded-xl border border-[#29445F] bg-[#0F2236] p-6 text-white">
      <div className="flex items-start justify-between gap-3"><h2 id="access-basis-title" className="text-lg font-bold">{l.title}</h2>
        <button type="button" onClick={onClose} className="rounded border border-slate-500 px-3 py-1">{l.close}</button></div>
      <p className="rounded-lg border border-amber-400/40 p-3 text-sm text-amber-200">{l.intro}</p>
      <p className="font-mono text-xs text-slate-400">{workspace.tenant_legal_name ?? workspace.commercial_owner} · {workspace.lifecycle_status}</p>
      <form onSubmit={submit} className="space-y-3">
        <div className="flex gap-4">
          {workspace.environment === 'PILOT' && <label><input type="radio" checked={mode === 'PILOT'} onChange={() => setMode('PILOT')} /> {l.pilot}</label>}
          <label><input type="radio" checked={mode === 'PAID'} onChange={() => setMode('PAID')} /> {l.paid}</label>
        </div>
        <label className="block space-y-1">{l.email}<input required type="email" name="email" maxLength={320} className="w-full rounded bg-[#081320] p-2" /></label>
        <label className="block space-y-1">{l.role}<select required name="role_id" className="w-full rounded bg-[#081320] p-2">
          <option value="">—</option>{roles.filter(r => r.code === preferred).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select></label>
        {mode === 'PILOT' ? <label className="block space-y-1">{l.duration}<select name="duration_hours" defaultValue="24" className="w-full rounded bg-[#081320] p-2">
          {[24,48,72].map(hours => <option key={hours} value={hours}>{hours} h</option>)}
        </select></label> : <>
          <label className="block space-y-1">{l.contract}<select required name="contract_id" className="w-full rounded bg-[#081320] p-2">
            <option value="">—</option>{contracts.filter(c => c.signed_at).map(c => <option key={c.id} value={c.id}>{c.contract_ref} · {c.currency}</option>)}
          </select></label>
          <label className="block space-y-1">{l.paymentRef}<input required name="payment_reference" minLength={3} className="w-full rounded bg-[#081320] p-2" /></label>
          <div className="grid grid-cols-2 gap-2">
            <label>{l.amount}<input required name="payment_amount" type="number" min="0.01" step="0.01" className="w-full rounded bg-[#081320] p-2" /></label>
            <label>Currency<select required name="payment_currency" className="w-full rounded bg-[#081320] p-2">
              {['RON','EUR','USD'].map(c => <option key={c}>{c}</option>)}</select></label>
            <label>{l.paidOn}<input required name="paid_on" type="date" className="w-full rounded bg-[#081320] p-2" /></label>
            <label>{l.paidThrough}<input required name="paid_through" type="date" className="w-full rounded bg-[#081320] p-2" /></label>
          </div>
        </>}
        <label className="block space-y-1">{l.reason}<textarea required name="evidence_note" minLength={15} maxLength={500} className="min-h-20 w-full rounded bg-[#081320] p-2" /></label>
        {error && <p role="alert" className="text-rose-300">{error}</p>}
        {notice && <p role="status" className="text-emerald-300">{notice}</p>}
        <button disabled={busy || roles.length === 0 || (mode === 'PAID' && !contracts.some(c => c.signed_at))}
          className="rounded bg-emerald-500 px-4 py-2 font-bold text-[#081320] disabled:opacity-50">{l.save}</button>
      </form>
      <h3 className="font-bold">{l.records}</h3>
      <ul className="space-y-2 text-sm">{bases.map(b => <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#29445F] p-2">
        <span>{b.email} · {b.mode} · {b.status}{b.expires_at ? ` · ${new Date(b.expires_at).toLocaleString(lang)}` : ''}</span>
        {b.status === 'prepared' || b.status === 'active' || b.status === 'expired' ? <button type="button" disabled={busy} onClick={() => void revoke(b)}
          className="rounded border border-rose-500 px-2 py-1 text-rose-300">{l.revoke}</button> : null}
      </li>)}</ul>
    </section>
  </div>;
}
