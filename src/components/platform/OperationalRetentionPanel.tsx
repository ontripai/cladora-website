'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  DatabaseZap,
  FileLock2,
  KeyRound,
  PlayCircle,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import type {
  RetentionOperationsResponse,
  RetentionOperationsSection,
  RetentionWorkerDryRun,
} from '@/lib/platform/retention-operations';

const sections: Array<{ id: RetentionOperationsSection; icon: typeof Archive }> = [
  { id: 'summary', icon: Archive },
  { id: 'retention', icon: DatabaseZap },
  { id: 'holds', icon: FileLock2 },
  { id: 'disposal', icon: ShieldAlert },
  { id: 'storage', icon: Archive },
  { id: 'kms', icon: KeyRound },
];

const copy = {
  ro: {
    tabs: { summary: 'Sumar', retention: 'Politici', holds: 'Blocări juridice', disposal: 'Protocoale', storage: 'Storage', kms: 'KMS' },
    title: 'Operațiuni de retenție', readOnly: 'Doar citire', dryRun: 'Dry-run verificat', flagsLocked: 'Flag-uri dezactivate implicit',
    tenant: 'Filtru Tenant UUID', status: 'Filtru stare', apply: 'Aplică', clear: 'Șterge', refresh: 'Reîncarcă',
    loading: 'Se încarcă proiecția protejată…', error: 'Proiecția operațională nu a putut fi încărcată.', empty: 'Nu există înregistrări în domeniul autorizat.',
    policies: 'Versiuni politici', activeHolds: 'Blocări active', protocols: 'Protocoale deschise', storageAttention: 'Storage necesită atenție', kmsAttention: 'KMS necesită atenție',
    flags: 'Porți de producție', enabled: 'Activ', disabled: 'Dezactivat', details: 'Detalii sigure', total: 'înregistrări',
    run: 'Rulează previzualizarea Worker', running: 'Se verifică fără efecte…', dryRunError: 'Dry-run a fost respins în siguranță.',
    storageCandidates: 'Candidați Storage', kmsCandidates: 'Candidați KMS', wouldClaim: 'Ar fi revendicate', wouldDispatch: 'Ar fi expediate',
    invariant: 'Fără scrieri DB · Fără ștergere Storage · Fără apel KMS · Fără claim', generated: 'Generat',
    previous: 'Pagina precedentă', next: 'Pagina următoare',
  },
  en: {
    tabs: { summary: 'Summary', retention: 'Policies', holds: 'Legal holds', disposal: 'Protocols', storage: 'Storage', kms: 'KMS' },
    title: 'Retention operations', readOnly: 'Read-only', dryRun: 'Verified dry-run', flagsLocked: 'Flags disabled by default',
    tenant: 'Tenant UUID filter', status: 'Status filter', apply: 'Apply', clear: 'Clear', refresh: 'Refresh',
    loading: 'Loading protected projection…', error: 'The operational projection could not be loaded.', empty: 'No records exist in the authorized scope.',
    policies: 'Policy versions', activeHolds: 'Active holds', protocols: 'Open protocols', storageAttention: 'Storage attention', kmsAttention: 'KMS attention',
    flags: 'Production gates', enabled: 'Enabled', disabled: 'Disabled', details: 'Safe details', total: 'records',
    run: 'Run worker preview', running: 'Checking without side effects…', dryRunError: 'The dry-run was safely rejected.',
    storageCandidates: 'Storage candidates', kmsCandidates: 'KMS candidates', wouldClaim: 'Would claim', wouldDispatch: 'Would dispatch',
    invariant: 'No DB writes · No Storage deletion · No KMS call · No claim', generated: 'Generated',
    previous: 'Previous page', next: 'Next page',
  },
  fa: {
    tabs: { summary: 'خلاصه', retention: 'سیاست‌ها', holds: 'دستورهای نگهداشت', disposal: 'صورت‌جلسه‌ها', storage: 'استوریج', kms: 'KMS' },
    title: 'عملیات نگهداری و امحا', readOnly: 'فقط‌خواندنی', dryRun: 'Dry-run تأییدشده', flagsLocked: 'فلگ‌ها پیش‌فرض خاموش',
    tenant: 'فیلتر شناسه Tenant', status: 'فیلتر وضعیت', apply: 'اعمال', clear: 'پاک‌کردن', refresh: 'بازخوانی',
    loading: 'در حال بارگذاری نمای محافظت‌شده…', error: 'بارگذاری نمای عملیاتی ممکن نشد.', empty: 'در دامنه مجاز رکوردی وجود ندارد.',
    policies: 'نسخه‌های سیاست', activeHolds: 'نگهداشت فعال', protocols: 'صورت‌جلسه باز', storageAttention: 'نیازمند توجه Storage', kmsAttention: 'نیازمند توجه KMS',
    flags: 'دروازه‌های Production', enabled: 'فعال', disabled: 'غیرفعال', details: 'جزئیات امن', total: 'رکورد',
    run: 'اجرای پیش‌نمایش Worker', running: 'کنترل بدون اثر جانبی…', dryRunError: 'Dry-run به‌شکل امن رد شد.',
    storageCandidates: 'کاندیداهای Storage', kmsCandidates: 'کاندیداهای KMS', wouldClaim: 'قابل Claim', wouldDispatch: 'قابل Dispatch',
    invariant: 'بدون نوشتن DB · بدون حذف Storage · بدون تماس KMS · بدون Claim', generated: 'زمان تولید',
    previous: 'صفحه قبل', next: 'صفحه بعد',
  },
} as const;

function display(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? '✓' : '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function itemTitle(section: RetentionOperationsSection, item: Record<string, unknown>) {
  if (section === 'retention') return `${display(item.policy_code)} · v${display(item.version_no)}`;
  if (section === 'holds') return display(item.hold_reference);
  if (section === 'disposal') return display(item.protocol_number);
  if (section === 'storage') return `Job ${display(item.id)}`;
  if (section === 'kms') return display(item.purpose);
  return display(item.id);
}

export function OperationalRetentionPanel({ lang }: { lang: string }) {
  const locale = lang === 'ro' || lang === 'fa' ? lang : 'en';
  const l = copy[locale];
  const [section, setSection] = useState<RetentionOperationsSection>('summary');
  const [data, setData] = useState<RetentionOperationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState({ tenantId: '', status: '' });
  const [filters, setFilters] = useState(draft);
  const [dryRun, setDryRun] = useState<RetentionWorkerDryRun | null>(null);
  const [dryRunLoading, setDryRunLoading] = useState(false);
  const [dryRunError, setDryRunError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ section, limit: '20', offset: String(offset) });
      if (filters.tenantId) params.set('tenant_id', filters.tenantId);
      if (filters.status) params.set('status', filters.status);
      const response = await fetch(`/api/platform/v1/retention-operations?${params}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('retention-operations');
      setData(await response.json());
    } catch {
      setError(l.error);
    } finally {
      setLoading(false);
    }
  }, [filters, l.error, offset, section]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const runDryRun = async () => {
    setDryRunLoading(true);
    setDryRunError('');
    try {
      const params = new URLSearchParams({ limit: '25' });
      if (filters.tenantId) params.set('tenant_id', filters.tenantId);
      const response = await fetch(`/api/platform/v1/retention-operations/dry-run?${params}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('dry-run');
      setDryRun(await response.json());
    } catch {
      setDryRun(null);
      setDryRunError(l.dryRunError);
    } finally {
      setDryRunLoading(false);
    }
  };

  const cards = useMemo(() => data ? [
    [l.policies, data.summary.policy_versions],
    [l.activeHolds, data.summary.active_holds],
    [l.protocols, data.summary.open_protocols],
    [l.storageAttention, data.summary.storage_attention],
    [l.kmsAttention, data.summary.kms_attention],
  ] : [], [data, l]);

  const apply = () => { setOffset(0); setFilters(draft); setDryRun(null); };
  const clear = () => { const empty = { tenantId: '', status: '' }; setDraft(empty); setFilters(empty); setOffset(0); setDryRun(null); };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-[#1E3A5A] bg-[#0F2236] p-4">
        <div className="flex flex-wrap items-center gap-2">
          {[l.readOnly, l.dryRun, l.flagsLocked].map((badge) => (
            <span key={badge} className="rounded-full border border-emerald-500/30 bg-emerald-950/60 px-3 py-1 text-[11px] font-semibold text-emerald-300">{badge}</span>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto_auto]">
          <input aria-label={l.tenant} placeholder={l.tenant} value={draft.tenantId} onChange={(event) => setDraft({ ...draft, tenantId: event.target.value.trim() })}
            className="rounded-lg border border-[#29445F] bg-[#081320] px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-emerald-400" />
          <input aria-label={l.status} placeholder={l.status} value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value.toLowerCase().replace(/[^a-z_]/g, '') })}
            className="rounded-lg border border-[#29445F] bg-[#081320] px-3 py-2.5 text-xs text-white outline-none focus:border-emerald-400" />
          <button type="button" onClick={apply} className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-bold text-[#081320] hover:bg-emerald-400">{l.apply}</button>
          <button type="button" onClick={clear} className="rounded-lg border border-[#29445F] px-4 py-2 text-xs font-bold text-slate-200 hover:bg-[#142A40]">{l.clear}</button>
          <button type="button" onClick={() => void load()} aria-label={l.refresh} className="rounded-lg border border-[#29445F] p-2.5 text-emerald-300 hover:bg-[#142A40]"><RefreshCw className="h-4 w-4" /></button>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map(([label, value]) => <div key={label} className="rounded-xl border border-[#1E3A5A] bg-[#0F2236] p-4"><div className="text-2xl font-black text-white">{value}</div><div className="mt-1 text-[11px] text-slate-400">{label}</div></div>)}
      </div>

      <section className="overflow-hidden rounded-xl border border-[#1E3A5A] bg-[#0F2236]">
        <div className="flex gap-1 overflow-x-auto border-b border-[#1E3A5A] bg-[#081320] p-2">
          {sections.map(({ id, icon: Icon }) => <button key={id} type="button" onClick={() => { setSection(id); setOffset(0); }}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold ${section === id ? 'bg-emerald-500 text-[#081320]' : 'text-slate-300 hover:bg-[#142A40]'}`}><Icon className="h-4 w-4" />{l.tabs[id]}</button>)}
        </div>

        {loading ? <div className="p-12 text-center text-sm text-slate-400">{l.loading}</div>
          : error ? <div className="p-12 text-center text-sm text-rose-300">{error}</div>
          : section === 'summary' ? <div className="p-5">
            <h3 className="text-sm font-bold text-white">{l.flags}</h3>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              {Object.entries(data?.feature_flags ?? {}).map(([name, flag]) => <div key={name} className="rounded-lg border border-[#29445F] bg-[#081320] p-3">
                <div className="break-all font-mono text-[11px] text-slate-300">{name}</div>
                <div className={`mt-2 text-xs font-bold ${flag.enabled ? 'text-amber-300' : 'text-emerald-300'}`}>{flag.enabled ? l.enabled : l.disabled}</div>
              </div>)}
            </div>
          </div>
          : !data?.items.length ? <div className="p-12 text-center text-sm text-slate-400">{l.empty}</div>
          : <div className="divide-y divide-[#1E3A5A]">
            {data.items.map((item, index) => <details key={String(item.id ?? index)} className="group p-4 open:bg-[#0B1C2D]">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <div><div className="text-sm font-bold text-white">{itemTitle(section, item)}</div><div className="mt-1 font-mono text-[10px] text-slate-500">{display(item.tenant_id)} · {display(item.status)}</div></div>
                <span className="rounded-full border border-[#29445F] px-2.5 py-1 text-[10px] text-slate-300">{l.details}</span>
              </summary>
              <dl className="mt-4 grid grid-cols-1 gap-3 border-t border-[#1E3A5A] pt-4 text-xs md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(item).filter(([key]) => !['tenant_id', 'status'].includes(key)).map(([key, value]) => <div key={key} className="min-w-0"><dt className="font-mono text-[10px] uppercase text-slate-500">{key}</dt><dd className="mt-1 break-all text-slate-200">{display(value)}</dd></div>)}
              </dl>
            </details>)}
          </div>}

        <div className="flex items-center justify-between border-t border-[#1E3A5A] p-3 text-xs text-slate-400">
          <span>{data?.pagination.total ?? 0} {l.total}</span>
          <div className="flex gap-2">
            <button type="button" aria-label={l.previous} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))} className="rounded-lg border border-[#29445F] p-2 disabled:opacity-30"><ChevronLeft className="h-4 w-4 rtl:rotate-180" /></button>
            <button type="button" aria-label={l.next} disabled={!data?.pagination.has_more} onClick={() => setOffset(offset + 20)} className="rounded-lg border border-[#29445F] p-2 disabled:opacity-30"><ChevronRight className="h-4 w-4 rtl:rotate-180" /></button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-5">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div><h3 className="flex items-center gap-2 text-sm font-black text-cyan-200"><PlayCircle className="h-5 w-5" />{l.run}</h3><p className="mt-1 text-xs text-cyan-100/70">{l.invariant}</p></div>
          <button type="button" disabled={dryRunLoading} onClick={() => void runDryRun()} className="rounded-lg bg-cyan-400 px-4 py-2.5 text-xs font-black text-[#06202A] disabled:opacity-50">{dryRunLoading ? l.running : l.run}</button>
        </div>
        {dryRunError ? <p className="mt-4 text-xs font-semibold text-rose-300">{dryRunError}</p> : null}
        {dryRun ? <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[[l.storageCandidates, dryRun.storage.candidate_count], [l.wouldClaim, dryRun.storage.would_claim_count], [l.kmsCandidates, dryRun.kms.candidate_count], [l.wouldDispatch, dryRun.kms.would_dispatch_count]].map(([label, value]) => <div key={label} className="rounded-lg border border-cyan-500/20 bg-[#081B28] p-3"><div className="text-xl font-black text-cyan-200">{value}</div><div className="mt-1 text-[11px] text-cyan-100/60">{label}</div></div>)}
          <p className="text-[10px] text-cyan-100/50 md:col-span-2 xl:col-span-4">{l.generated}: {new Date(dryRun.generated_at).toLocaleString(locale)}</p>
        </div> : null}
      </section>
    </div>
  );
}
