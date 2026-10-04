'use client';

import { useEffect, useRef, useState } from 'react';
import type { CustomerWorkspace } from '@/types/platform';

type Locale = 'ro' | 'en' | 'fa';
type Access = {
  workspace: Pick<CustomerWorkspace, 'id' | 'environment' | 'lifecycle_status'>;
  entitlement: null | { value_type: string; boolean_value: boolean | null; override_value_json: unknown; override_expires_at: string | null; valid_from: string; valid_until: string | null };
};
const copy = {
  ro: { title: 'Acces pilot la catalogul de servicii', intro: 'Acordă temporar dreptul comercial pentru acest pilot. Activarea modulului și alocarea rolurilor sunt pași separați.', loading: 'Se verifică accesul…', failed: 'Accesul nu a putut fi verificat sau salvat.', blocked: 'Acest editor acceptă numai un pilot activ fără drept comercial permanent sau derogare activă.', duration: 'Durată (ore)', reason: 'Motivul deciziei', review: 'Pregătește decizia', save: 'Confirmă accesul temporar', close: 'Închide', success: 'Accesul temporar a fost înregistrat. Activează modulul în tabloul de bord și configurează rolurile.', expires: 'Expiră la', retry: 'Reîncearcă aceeași decizie', fresh: 'Verifică starea salvată', noAccess: 'Drept permanent: dezactivat', changed: 'Starea s-a schimbat. Închide și verifică din nou înainte de a pregăti altă decizie.' },
  en: { title: 'Service catalogue pilot access', intro: 'Temporarily grant the commercial entitlement for this pilot. Module activation and role assignment are separate steps.', loading: 'Checking access…', failed: 'Access could not be verified or saved.', blocked: 'This editor supports only an active pilot without a permanent commercial entitlement or an active override.', duration: 'Duration (hours)', reason: 'Decision reason', review: 'Prepare decision', save: 'Confirm temporary access', close: 'Close', success: 'Temporary access recorded. Activate the module in the dashboard and configure roles.', expires: 'Expires at', retry: 'Retry the same decision', fresh: 'Check saved state', noAccess: 'Permanent entitlement: disabled', changed: 'The state changed. Close and check again before preparing another decision.' },
  fa: { title: 'دسترسی پایلوت به کاتالوگ خدمات', intro: 'دسترسی اشتراک را برای این پایلوت موقتاً فعال کنید. فعال‌سازی ماژول و تخصیص نقش‌ها مراحل جداگانه‌اند.', loading: 'در حال بررسی دسترسی…', failed: 'بررسی یا ذخیرهٔ دسترسی انجام نشد.', blocked: 'این ویرایشگر فقط پایلوت فعال بدون اشتراک دائمی یا استثنای فعال را می‌پذیرد.', duration: 'مدت (ساعت)', reason: 'دلیل تصمیم', review: 'آماده‌سازی تصمیم', save: 'تأیید دسترسی موقت', close: 'بستن', success: 'دسترسی موقت ثبت شد. ماژول را در داشبورد فعال و نقش‌ها را تنظیم کنید.', expires: 'انقضا', retry: 'تکرار همان تصمیم', fresh: 'بررسی وضعیت ذخیره‌شده', noAccess: 'اشتراک دائمی: غیرفعال', changed: 'وضعیت تغییر کرده است؛ پنجره را ببندید و پیش از تصمیم تازه دوباره بررسی کنید.' },
};
type Decision = { value_type: 'boolean'; boolean_value: false; override_value_json: true; override_reason: string; override_expires_at: string };

function canPrepare(access: Access, now: number) {
  const item = access.entitlement;
  return access.workspace.environment === 'PILOT' && access.workspace.lifecycle_status === 'ACTIVE' &&
    (!item || (item.value_type === 'boolean' && item.boolean_value !== true &&
      (item.override_value_json === null || (!!item.override_expires_at && Date.parse(item.override_expires_at) <= now)) &&
      Date.parse(item.valid_from) <= now && (!item.valid_until || Date.parse(item.valid_until) > now)));
}

export function ServiceCatalogPilotAccessDialog({ workspace, lang, onClose }: { workspace: CustomerWorkspace; lang: Locale; onClose: () => void }) {
  const labels = copy[lang];
  const [access, setAccess] = useState<Access | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [uncertain, setUncertain] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);
  const [checkedAt, setCheckedAt] = useState(0);
  const active = useRef(true);
  const request = useRef<AbortController | null>(null);
  const dialog = useRef<HTMLDialogElement | null>(null);
  const readUrl = `/api/platform/v1/workspaces/${workspace.id}/service-access`;
  useEffect(() => {
    active.current = true;
    const modal = dialog.current;
    modal?.showModal();
    return () => { active.current = false; request.current?.abort(); modal?.close(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(readUrl, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => { if (!response.ok) throw new Error(); return await response.json() as Access; })
      .then(body => { if (!controller.signal.aborted) { setAccess(body); setCheckedAt(Date.now()); } })
      .catch(() => { if (!controller.signal.aborted) setError(labels.failed); });
    return () => controller.abort();
  }, [readUrl, reload, labels.failed]);

  async function save() {
    if (!decision || busy) return;
    if (Date.parse(decision.override_expires_at) <= Date.now()) { setDecision(null); setError(labels.changed); return; }
    setBusy(true); setError('');
    const controller = new AbortController(); request.current = controller;
    try {
      // Reconcile a lost response without extending the expiry or repeating a saved write.
      const check = await fetch(readUrl, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
      if (!check.ok) throw new Error();
      const current = await check.json() as Access;
      const item = current.entitlement;
      if (item?.value_type === 'boolean' && item.boolean_value === false && item.override_value_json === true &&
        item.override_expires_at && Date.parse(item.override_expires_at) === Date.parse(decision.override_expires_at)) {
        if (active.current) { setSaved(true); setUncertain(false); }
        return;
      }
      if (!canPrepare(current, Date.now())) { if (active.current) { setAccess(current); setCheckedAt(Date.now()); setDecision(null); setError(labels.changed); } return; }
      const response = await fetch(`/api/platform/v1/workspaces/${workspace.id}/entitlements/module.services_catalog`, {
        method: 'PUT', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(decision), signal: controller.signal,
      });
      if (!response.ok) throw new Error();
      if (active.current) { setSaved(true); setUncertain(false); }
    } catch { if (active.current) { setUncertain(true); setError(labels.failed); } }
    finally { if (active.current) setBusy(false); }
  }

  return <dialog ref={dialog} dir={lang === 'fa' ? 'rtl' : 'ltr'} onCancel={event => { event.preventDefault(); if (!busy) onClose(); }} aria-labelledby="service-pilot-title" className="m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-xl space-y-4 overflow-y-auto rounded-xl border border-[#1E3A5A] bg-[#0F2236] p-6 text-sm text-white backdrop:bg-black/75">
      <div className="flex items-start justify-between gap-4"><h2 id="service-pilot-title" className="text-lg font-bold">{labels.title}</h2><button type="button" disabled={busy} onClick={onClose} className="rounded border border-slate-500 px-3 py-2">{labels.close}</button></div>
      <p>{workspace.tenant_legal_name || workspace.commercial_owner} · {workspace.commercial_owner}</p>
      <p className="break-all font-mono text-xs text-slate-400">{workspace.id}</p>
      <p className="text-slate-300">{labels.intro}</p>
      {!access && !error && <p role="status">{labels.loading}</p>}
      {!access && error && <button type="button" onClick={() => { setError(''); setReload(value => value + 1); }} className="rounded border border-slate-500 px-3 py-2">{labels.fresh}</button>}
      {access && !canPrepare(access, checkedAt) && !saved && <p className="text-amber-200">{labels.blocked}{access.entitlement?.override_expires_at && <> · {labels.expires}: {new Date(access.entitlement.override_expires_at).toLocaleString(lang)}</>}</p>}
      {access && canPrepare(access, checkedAt) && !decision && !saved && <form className="space-y-4" onSubmit={event => {
        event.preventDefault(); const form = new FormData(event.currentTarget); const hours = Number(form.get('hours')); const reason = String(form.get('reason') || '').trim();
        if (![24, 48, 72].includes(hours) || reason.length < 15 || reason.length > 500) return;
        setError(''); setDecision({ value_type: 'boolean', boolean_value: false, override_value_json: true, override_reason: reason, override_expires_at: new Date(Date.now() + hours * 3600000).toISOString() });
      }}>
        <label className="block">{labels.duration}<select name="hours" defaultValue="24" className="mt-2 w-full rounded border border-slate-500 bg-[#081320] p-3">{[24,48,72].map(hours => <option key={hours} value={hours}>{hours}</option>)}</select></label>
        <label className="block">{labels.reason}<textarea name="reason" required minLength={15} maxLength={500} className="mt-2 w-full rounded border border-slate-500 bg-[#081320] p-3" /></label>
        <button className="rounded bg-emerald-500 px-4 py-2 font-bold text-[#081320]">{labels.review}</button>
      </form>}
      {decision && !saved && <div className="space-y-3 rounded border border-amber-500/40 p-4">
        <p>{labels.noAccess}</p><p>{labels.expires}: {new Date(decision.override_expires_at).toLocaleString(lang)}</p><p className="whitespace-pre-wrap">{decision.override_reason}</p>
        <button type="button" disabled={busy} onClick={save} className="rounded bg-emerald-500 px-4 py-2 font-bold text-[#081320] disabled:opacity-50">{busy ? '…' : uncertain ? labels.retry : labels.save}</button>
        {uncertain && <button type="button" disabled={busy} onClick={() => { setReload(value => value + 1); setError(''); }} className="mx-2 rounded border border-slate-500 px-3 py-2">{labels.fresh}</button>}
      </div>}
      {error && <p role="alert" className="text-rose-300">{error}</p>}
      {saved && <p role="status" className="text-emerald-300">{labels.success}</p>}
  </dialog>;
}
