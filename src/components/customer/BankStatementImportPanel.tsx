'use client';

import { useState } from 'react';
import { FileUp, ShieldCheck } from 'lucide-react';
import type { Language } from '@/types';
import { parseBankStatementFile } from '@/lib/payments/bank-statement-parser';
import { useCustomerContext } from './CustomerContextProvider';

const labels = {
  ro: { open: 'Importă extras', title: 'Import controlat extras bancar', hint: 'CSV sau JSON, maximum 5 MB și 5.000 rânduri. IBAN-urile contrapărților trebuie mascate.', start: 'Validează importul', commit: 'Confirmă tranzacțiile valide', cancel: 'Închide', ready: 'Import validat', done: 'Import confirmat', error: 'Importul nu a putut fi procesat în siguranță.' },
  en: { open: 'Import statement', title: 'Controlled bank statement import', hint: 'CSV or JSON, up to 5 MB and 5,000 rows. Counterparty IBANs must be masked.', start: 'Validate import', commit: 'Commit valid transactions', cancel: 'Close', ready: 'Import validated', done: 'Import committed', error: 'The statement could not be processed safely.' },
  fa: { open: 'ورود صورت‌حساب بانکی', title: 'ورود کنترل‌شده صورت‌حساب بانکی', hint: 'CSV یا JSON، حداکثر ۵ مگابایت و ۵۰۰۰ ردیف. IBAN طرف مقابل باید ماسک‌شده باشد.', start: 'اعتبارسنجی فایل', commit: 'ثبت تراکنش‌های معتبر', cancel: 'بستن', ready: 'فایل اعتبارسنجی شد', done: 'تراکنش‌ها ثبت شدند', error: 'پردازش امن صورت‌حساب ممکن نشد.' },
};

export function BankStatementImportPanel({ lang, bankAccountId, onCommitted }: { lang: Language; bankAccountId?: string; onCommitted: () => void }) {
  const { active } = useCustomerContext();
  const t = labels[lang];
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID());
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function validateImport(event: React.FormEvent) {
    event.preventDefault();
    if (!active || !bankAccountId || !file) return;
    setBusy(true); setError(null);
    try {
      const parsed = await parseBankStatementFile(file);
      const response = await fetch('/api/customer/v1/payments/bank-statements/imports', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_id: active.context_id, bank_account_id: bankAccountId, source: 'customer_portal', file_name: file.name, statement_format: parsed.format, period_start: periodStart, period_end: periodEnd, idempotency_key: idempotencyKey, rows: parsed.rows }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.code ?? 'IMPORT_FAILED');
      setBatchId(body.id); setStatus(body.status);
    } catch (reason) { setError(reason instanceof Error ? reason.message : t.error); }
    finally { setBusy(false); }
  }

  async function commitImport() {
    if (!active || !batchId) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/api/customer/v1/payments/bank-statements/imports/${batchId}/commit`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ context_id: active.context_id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.code ?? 'COMMIT_FAILED');
      setStatus(body.status); onCommitted();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t.error); }
    finally { setBusy(false); }
  }

  return <>
    <button type="button" disabled={!bankAccountId} onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#0E9F8E] bg-white px-4 py-2 text-sm font-bold text-[#0E9F8E] disabled:opacity-50"><FileUp className="h-4 w-4" />{t.open}</button>
    {open ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <form onSubmit={validateImport} role="dialog" aria-modal="true" className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <h2 className="text-lg font-black text-[#0F172A]">{t.title}</h2>
        <p className="mt-2 flex gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800"><ShieldCheck className="h-4 w-4 shrink-0" />{t.hint}</p>
        <div className="mt-4 space-y-3">
          <input aria-label={t.open} required type="file" accept=".csv,.json,text/csv,application/json" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setIdempotencyKey(crypto.randomUUID()); setBatchId(null); setStatus(null); }} className="w-full rounded-xl border p-2 text-sm" />
          <div className="grid grid-cols-2 gap-2"><input aria-label="period start" required type="date" value={periodStart} onChange={(event) => setPeriodStart(event.target.value)} className="rounded-xl border px-3 py-2 text-sm" /><input aria-label="period end" required type="date" value={periodEnd} onChange={(event) => setPeriodEnd(event.target.value)} className="rounded-xl border px-3 py-2 text-sm" /></div>
          {error ? <p role="alert" className="text-sm text-rose-700">{t.error} ({error})</p> : null}
          {status ? <p role="status" className="text-sm font-bold text-emerald-700">{status === 'committed' ? t.done : t.ready}</p> : null}
        </div>
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2 text-sm font-bold">{t.cancel}</button>{status === 'validated' ? <button type="button" disabled={busy} onClick={commitImport} className="rounded-xl bg-[#0E9F8E] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{t.commit}</button> : <button type="submit" disabled={busy || !bankAccountId} className="rounded-xl bg-[#0E9F8E] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{t.start}</button>}</div>
      </form>
    </div> : null}
  </>;
}
