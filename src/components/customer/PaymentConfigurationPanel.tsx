'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldCheck } from 'lucide-react';
import type { Language } from '@/types';

type Beneficiary = {
  id: string;
  status: string;
  association_legal_name: string;
  bank_name: string;
  masked_iban: string;
  currency: string;
  version: number;
  property_id?: string | null;
};
type Configuration = {
  payment_allocation_policy: { strategy: string; min_partial_amount: number; version: number } | null;
  beneficiary_accounts: Beneficiary[];
};

const words = {
  ro: {
    title: 'Configurarea plăților', policy: 'Regula de alocare', account: 'Contul beneficiar',
    missing: 'Neconfigurat', ready: 'Activ', draft: 'Ciornă', pending_approval: 'În așteptarea aprobării',
    active: 'Activ', revoked: 'Revocat', superseded: 'Înlocuit', rejected: 'Respins',
    policyHelp: 'Plățile se alocă mai întâi facturilor cele mai vechi. Nu se acceptă supraplăți.',
    policyButton: 'Configurează regula', name: 'Numele legal al asociației', bank: 'Banca',
    iban: 'IBAN complet', newAccount: 'Adaugă cont pentru verificare', submit: 'Trimite la aprobare',
    approve: 'Aprobă', reject: 'Respinge', refresh: 'Actualizează',
    secondPerson: 'Aprobarea necesită un alt administrator cu autentificare în doi pași.',
    testWarning: 'Un cont de test sau fără IBAN complet verificat nu poate fi folosit pentru transfer.',
    noAccount: 'Nu există un cont beneficiar activ. Instrucțiunile de transfer nu sunt disponibile.',
    error: 'Configurarea nu a putut fi încărcată.', saving: 'Se salvează…',
  },
  en: {
    title: 'Payment setup', policy: 'Allocation rule', account: 'Beneficiary account',
    missing: 'Not configured', ready: 'Active', draft: 'Draft', pending_approval: 'Awaiting approval',
    active: 'Active', revoked: 'Revoked', superseded: 'Replaced', rejected: 'Rejected',
    policyHelp: 'Apply payments to oldest invoices first. Reject overpayments.',
    policyButton: 'Set allocation rule', name: 'Association legal name', bank: 'Bank name',
    iban: 'Full IBAN', newAccount: 'Add account for review', submit: 'Send for approval',
    approve: 'Approve', reject: 'Reject', refresh: 'Refresh',
    secondPerson: 'A different administrator with two factor authentication must approve.',
    testWarning: 'A test account or one without a verified full IBAN cannot be used for transfer.',
    noAccount: 'No active beneficiary account. Bank transfer instructions are unavailable.',
    error: 'Payment setup could not be loaded.', saving: 'Saving…',
  },
  fa: {
    title: 'تنظیمات پرداخت', policy: 'قاعدهٔ تخصیص پرداخت', account: 'حساب مقصد',
    missing: 'تنظیم نشده', ready: 'فعال', draft: 'پیش‌نویس', pending_approval: 'در انتظار تأیید',
    active: 'فعال', revoked: 'لغوشده', superseded: 'جایگزین‌شده', rejected: 'ردشده',
    policyHelp: 'پرداخت ابتدا به قدیمی‌ترین صورتحساب تخصیص می‌یابد و اضافه‌پرداخت رد می‌شود.',
    policyButton: 'ثبت قاعدهٔ تخصیص', name: 'نام قانونی انجمن', bank: 'نام بانک',
    iban: 'شماره شبای کامل', newAccount: 'ثبت حساب برای بررسی', submit: 'ارسال برای تأیید',
    approve: 'تأیید', reject: 'رد', refresh: 'به‌روزرسانی',
    secondPerson: 'تأیید باید توسط مدیر دیگری با احراز هویت دومرحله‌ای انجام شود.',
    testWarning: 'حساب آزمایشی یا بدون شبای کامل تأییدشده برای انتقال وجه قابل استفاده نیست.',
    noAccount: 'حساب مقصد فعالی وجود ندارد؛ دستور انتقال بانکی در دسترس نیست.',
    error: 'تنظیمات پرداخت بارگذاری نشد.', saving: 'در حال ذخیره…',
  },
} as const;

export function PaymentConfigurationPanel({ lang, contextId, canManage }: {
  lang: Language;
  contextId: string;
  canManage: boolean;
}) {
  const t = words[lang];
  const [configuration, setConfiguration] = useState<Configuration | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ association_legal_name: '', bank_name: '', iban: '' });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/customer/v1/payments/configuration?context_id=${encodeURIComponent(contextId)}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || t.error);
      setConfiguration(body as Configuration);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.error);
    } finally {
      setLoading(false);
    }
  }, [contextId, t.error]);

  useEffect(() => {
    let mounted = true;
    void Promise.resolve().then(() => { if (mounted) return refresh(); });
    return () => { mounted = false; };
  }, [refresh]);

  async function act(action: string, fields: Record<string, unknown> = {}) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/customer/v1/payments/configuration', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, context_id: contextId, ...fields }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || t.error);
      setNotice(action === 'create_draft' ? t.draft : action === 'submit_approval' ? t.pending_approval : t.ready);
      if (action === 'create_draft') setForm({ association_legal_name: '', bank_name: '', iban: '' });
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.error);
    } finally {
      setBusy(false);
    }
  }

  const accounts = configuration?.beneficiary_accounts ?? [];
  const activeAccount = accounts.find((account) => account.status === 'active');

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label={t.title}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900"><ShieldCheck className="h-5 w-5 text-teal-700" />{t.title}</h2>
      <button type="button" onClick={() => void refresh()} disabled={loading || busy} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 disabled:opacity-50"><RefreshCw className="me-1 inline h-4 w-4" />{t.refresh}</button>
    </div>
    {loading && !configuration ? <p className="mt-4 text-sm text-slate-500">{t.saving}</p> : null}
    {error ? <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
    {notice ? <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p> : null}
    {configuration && <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">{t.policy}</p>
          <p className="mt-1 font-semibold text-slate-900">{configuration.payment_allocation_policy ? `${t.ready} · v${configuration.payment_allocation_policy.version}` : t.missing}</p>
          {canManage && !configuration.payment_allocation_policy && <button type="button" disabled={busy} onClick={() => void act('configure_policy', { strategy: 'oldest_due_first', penalties_priority: 'principal_first', min_partial_amount: 1, overpayment_handling: 'reject', credit_balance_handling: 'hold' })} className="mt-3 rounded-lg bg-teal-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{t.policyButton}</button>}
          <p className="mt-2 text-xs text-slate-500">{t.policyHelp}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-slate-500">{t.account}</p>
          <p className="mt-1 font-semibold text-slate-900">{activeAccount ? <><CheckCircle2 className="me-1 inline h-4 w-4 text-emerald-600" />{activeAccount.association_legal_name} · {activeAccount.masked_iban}</> : t.missing}</p>
          {!activeAccount && <p className="mt-2 text-xs text-amber-800">{t.noAccount}</p>}
        </div>
      </div>
      {canManage && <>
        <p className="mt-5 text-sm text-slate-600">{t.secondPerson}</p>
        <p className="mt-1 text-xs text-amber-800">{t.testWarning}</p>
        {accounts.length > 0 && <ul className="mt-4 space-y-2">{accounts.map((account) => <li key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
          <div><span className="font-semibold">{account.association_legal_name}</span><span className="ms-2 text-slate-500">{account.bank_name} · {account.masked_iban} · {t[account.status as keyof typeof t] || account.status}</span></div>
          <div className="flex gap-2">
            {account.status === 'draft' && account.masked_iban !== 'TEST-NO-IBAN' && <button type="button" disabled={busy} onClick={() => void act('submit_approval', { beneficiary_id: account.id })} className="rounded-lg border border-teal-700 px-3 py-1.5 text-xs font-semibold text-teal-800 disabled:opacity-50">{t.submit}</button>}
            {account.status === 'pending_approval' && <><button type="button" disabled={busy} onClick={() => void act('approve', { beneficiary_id: account.id })} className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50">{t.approve}</button><button type="button" disabled={busy} onClick={() => void act('reject', { beneficiary_id: account.id })} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50">{t.reject}</button></>}
          </div>
        </li>)}</ul>}
        <form className="mt-5 grid gap-3 sm:grid-cols-4" onSubmit={(event) => { event.preventDefault(); void act('create_draft', { ...form, currency: 'RON' }); }}>
          <label className="text-xs font-medium text-slate-600">{t.name}<input required minLength={3} maxLength={150} value={form.association_legal_name} onChange={(event) => setForm({ ...form, association_legal_name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
          <label className="text-xs font-medium text-slate-600">{t.bank}<input required minLength={2} maxLength={100} value={form.bank_name} onChange={(event) => setForm({ ...form, bank_name: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-sm" /></label>
          <label className="text-xs font-medium text-slate-600">{t.iban}<input required minLength={15} maxLength={34} autoComplete="off" value={form.iban} onChange={(event) => setForm({ ...form, iban: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 p-2 font-mono text-sm" /></label>
          <button type="submit" disabled={busy} className="self-end rounded-lg bg-teal-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? t.saving : t.newAccount}</button>
        </form>
      </>}
    </>}
  </section>;
}
