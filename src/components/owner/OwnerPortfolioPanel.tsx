'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { Language } from '@/types';

type Unit = { id: string; building_label: string; unit_label: string; address_text: string; usage_kind: string };
type Lease = { id: string; tenant_label: string; starts_on: string; ends_on: string | null; monthly_rent: number; currency: string; status: string };
type Entry = { id: string; lease_id: string | null; kind: string; direction: string; amount: number; currency: string; due_on: string | null; paid_on: string | null; memo: string | null; source: string };
type View = { units: Unit[]; count: number; leases: Lease[]; entries: Entry[] };
type LoadedView = { unitId: string | null; offset: number; data: View };
type UnitLink = { id: string; private_unit_id: string; workspace_id: string; canonical_unit_id: string; status: string; requested_at: string };
type OfficialCharge = { id: string; invoice_no: number; due_on: string | null; total: number; outstanding_amount: number | null; currency: string; status: string; workspace_id: string };
type AnnualGroup = { unit_id: string; currency: string; kind: string; direction: string; entry_count: number; amount: number };
const endpoint = '/api/owner-portfolio/v1';

const copy = {
  fa: { title: 'کارتابل مالک چندواحدی', private: 'اطلاعات خصوصی شما؛ ساختمان‌های عضو کلادورا تا تأیید مالکیت به این پرونده متصل نمی‌شوند.', building: 'نام ساختمان', unit: 'شناسه واحد', address: 'آدرس', usage: 'نوع واحد', add: 'ثبت واحد', leases: 'قراردادهای اجاره', tenant: 'نام مستأجر', start: 'شروع قرارداد', end: 'پایان قرارداد (اختیاری)', monthly: 'اجاره ماهانه', recordLease: 'ثبت قرارداد پیش‌نویس', cash: 'جریان مالی شخصی', kind: 'دسته', amount: 'مبلغ', due: 'سررسید', paid: 'تاریخ پرداخت', memo: 'یادداشت', recordCash: 'ثبت مورد مالی', next: 'صفحه بعد', previous: 'صفحه قبل', none: 'هنوز واحدی ثبت نشده است.', failed: 'دریافت یا ثبت اطلاعات ناموفق بود.', sourced: 'ثبت شخصی', return: 'پرونده‌ها' },
  en: { title: 'Multi-unit owner portfolio', private: 'Private records. Units in CLADORA buildings require verified ownership before connection.', building: 'Building', unit: 'Unit label', address: 'Address', usage: 'Unit use', add: 'Add unit', leases: 'Lease terms', tenant: 'Tenant name', start: 'Starts', end: 'Ends (optional)', monthly: 'Monthly rent', recordLease: 'Save draft lease', cash: 'Private cash flow', kind: 'Category', amount: 'Amount', due: 'Due date', paid: 'Paid date', memo: 'Note', recordCash: 'Add cash record', next: 'Next page', previous: 'Previous page', none: 'No units recorded yet.', failed: 'Unable to load or save records.', sourced: 'Self-reported', return: 'Cases' },
  ro: { title: 'Portofoliul proprietarului', private: 'Date private. Conectarea la o clădire CLADORA necesită verificarea proprietății.', building: 'Clădire', unit: 'Unitate', address: 'Adresă', usage: 'Tip unitate', add: 'Adaugă unitate', leases: 'Contracte de închiriere', tenant: 'Numele chiriașului', start: 'Început', end: 'Sfârșit (opțional)', monthly: 'Chirie lunară', recordLease: 'Salvează contractul ca proiect', cash: 'Flux financiar privat', kind: 'Categorie', amount: 'Sumă', due: 'Scadență', paid: 'Data plății', memo: 'Notă', recordCash: 'Adaugă înregistrare', next: 'Pagina următoare', previous: 'Pagina anterioară', none: 'Nu există unități înregistrate.', failed: 'Înregistrările nu au putut fi încărcate sau salvate.', sourced: 'Declarat de proprietar', return: 'Dosare' },
};

export function OwnerPortfolioPanel({ lang }: { lang: Language }) {
  const t = copy[lang];
  const [loadedView, setLoadedView] = useState<LoadedView | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<UnitLink[]>([]);
  const [loadedCharges, setLoadedCharges] = useState<{ unitId: string; links: UnitLink[]; data: OfficialCharge[] } | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loadedAnnual, setLoadedAnnual] = useState<{ year: number; data: AnnualGroup[] } | null>(null);
  // Only display detail records belonging to the current selection. A failed or
  // delayed request must never leave the previous unit's finances on screen.
  const detailsReady = loadedView?.unitId === selected && loadedView?.offset === offset;
  const view: View = {
    units: loadedView?.data.units ?? [], count: loadedView?.data.count ?? 0,
    leases: detailsReady ? loadedView.data.leases : [],
    entries: detailsReady ? loadedView.data.entries : [],
  };
  const charges = loadedCharges?.unitId === selected && loadedCharges.links === links ? loadedCharges.data : [];
  const annual = loadedAnnual?.year === year ? loadedAnnual.data : [];
  const loading = lang === 'fa' ? 'در حال دریافت اطلاعات واحد…' : lang === 'ro' ? 'Se încarcă datele unității…' : 'Loading unit records…';
  const refreshLinks = useCallback(async () => {
    const response = await fetch(`${endpoint}/links`, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('LINK_READ_FAILED');
    setLinks((await response.json() as { links: UnitLink[] }).links);
  }, []);

  const refresh = useCallback(async () => {
    const query = new URLSearchParams({ offset: String(offset) });
    if (selected) query.set('unit_id', selected);
    const response = await fetch(`${endpoint}?${query}`, { credentials: 'same-origin', cache: 'no-store' });
    if (!response.ok) throw new Error('READ_FAILED');
    setLoadedView({ unitId: selected, offset, data: await response.json() as View });
  }, [offset, selected]);
  useEffect(() => {
    let active = true;
    void fetch(`${endpoint}/links`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('READ_FAILED'); return await response.json() as { links: UnitLink[] }; })
      .then(data => { if (active) setLinks(data.links); })
      .catch(() => { if (active) setError(t.failed); });
    return () => { active = false; };
  }, [t.failed]);
  useEffect(() => {
    if (!selected) return;
    let active = true;
    void fetch(`${endpoint}/charges?private_unit_id=${encodeURIComponent(selected)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('CHARGES_READ_FAILED'); return await response.json() as { charges: OfficialCharge[] }; })
      .then(data => { if (active) setLoadedCharges({ unitId: selected, links, data: data.charges }); })
      .catch(() => { if (active) setError(t.failed); });
    return () => { active = false; };
  }, [selected, links, t.failed]);
  useEffect(() => {
    let active = true;
    void fetch(`${endpoint}/annual?year=${year}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => { if (!response.ok) throw new Error('ANNUAL_READ_FAILED'); return await response.json() as { groups: AnnualGroup[] }; })
      .then(data => { if (active) setLoadedAnnual({ year, data: data.groups }); })
      .catch(() => { if (active) setError(t.failed); });
    return () => { active = false; };
  }, [year, loadedView?.data.entries, t.failed]);
  useEffect(() => {
    let active = true;
    const query = new URLSearchParams({ offset: String(offset) });
    if (selected) query.set('unit_id', selected);
    void fetch(`${endpoint}?${query}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('READ_FAILED');
        return await response.json() as View;
      })
      .then(data => { if (active) setLoadedView({ unitId: selected, offset, data }); })
      .catch(() => { if (active) setError(t.failed); });
    return () => { active = false; };
  }, [offset, selected, t.failed]);

  async function submit(event: React.FormEvent<HTMLFormElement>, action: 'unit' | 'lease' | 'cash') {
    event.preventDefault(); setBusy(true); setError('');
    const form = event.currentTarget;
    const values = new FormData(form);
    const fields = Object.fromEntries(values.entries());
    const body = action === 'unit' ? { action, ...fields }
      : action === 'lease' ? { action, ...fields, unit_id: selected, ends_on: fields.ends_on || null, monthly_rent: Number(fields.monthly_rent) }
      : { action, ...fields, unit_id: selected, amount: Number(fields.amount), due_on: fields.due_on || null, paid_on: fields.paid_on || null, lease_id: fields.lease_id || null, memo: fields.memo || null };
    try {
      const response = await fetch(endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error('SAVE_FAILED');
      form.reset(); await refresh();
    } catch { setError(t.failed); } finally { setBusy(false); }
  }
  async function linkAction(body: object, form?: HTMLFormElement) {
    setBusy(true); setError('');
    try {
      const response = await fetch(`${endpoint}/links`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error('LINK_SAVE_FAILED');
      form?.reset(); await refreshLinks();
    } catch { setError(t.failed); } finally { setBusy(false); }
  }
  async function changeLease(leaseId: string, transition: 'activate' | 'end' | 'cancel') {
    setBusy(true); setError('');
    try {
      const response = await fetch(endpoint, { method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lease_id: leaseId, transition }) });
      if (!response.ok) throw new Error('LEASE_UPDATE_FAILED');
      await refresh();
    } catch { setError(t.failed); } finally { setBusy(false); }
  }

  return <main dir={lang === 'fa' ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl space-y-6 p-6 text-slate-900">
    <header><Link href={`/${lang}/cases`} className="text-sm text-teal-800">{t.return}</Link><h1 className="mt-3 text-2xl font-bold">{t.title}</h1><p className="mt-2 text-sm text-slate-600">{t.private}</p></header>
    {error && <p role="alert" className="rounded bg-rose-50 p-3 text-rose-800">{error}</p>}
    <form onSubmit={event => void submit(event,'unit')} className="grid gap-3 rounded-xl border bg-white p-5 sm:grid-cols-2">
      <label>{t.building}<input required name="building_label" minLength={2} maxLength={160} className="mt-1 w-full rounded border p-2" /></label>
      <label>{t.unit}<input required name="unit_label" maxLength={100} className="mt-1 w-full rounded border p-2" /></label>
      <label>{t.address}<input required name="address_text" minLength={5} maxLength={500} className="mt-1 w-full rounded border p-2" /></label>
      <label>{t.usage}<select name="usage_kind" className="mt-1 w-full rounded border p-2"><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="office">Office</option><option value="industrial">Industrial</option><option value="other">Other</option></select></label>
      <button disabled={busy} className="rounded bg-teal-700 p-2 text-white disabled:opacity-50">{t.add}</button>
    </form>
    <section className="rounded-xl border bg-white p-5"><h2 className="font-bold">{t.unit} · {view.count}</h2>
      {view.units.length === 0 && <p className="mt-3">{t.none}</p>}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">{view.units.map(unit => <li key={unit.id}><button type="button" disabled={busy} onClick={() => { setError(''); setSelected(unit.id); }} className={`w-full rounded border p-3 text-start ${selected === unit.id ? 'border-teal-700 bg-teal-50' : ''}`}><strong>{unit.building_label} · {unit.unit_label}</strong><span className="block text-sm text-slate-600">{unit.address_text} · {unit.usage_kind}</span></button></li>)}</ul>
      <div className="mt-4 flex gap-3"><button type="button" disabled={busy || offset===0} onClick={()=>setOffset(Math.max(0,offset-50))} className="rounded border p-2 disabled:opacity-50">{t.previous}</button><button type="button" disabled={busy || offset+50>=view.count} onClick={()=>setOffset(offset+50)} className="rounded border p-2 disabled:opacity-50">{t.next}</button></div>
    </section>
    <section className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="font-bold">{lang === 'fa' ? 'جمع‌بندی سالانه برای حسابداری' : lang === 'ro' ? 'Sinteză anuală pentru contabilitate' : 'Annual bookkeeping summary'}</h2>
      <p className="text-sm text-slate-600">{lang === 'fa' ? 'بر اساس تاریخ دریافت/پرداخت و داده‌های ثبت‌شده توسط شما؛ مبلغ مالیات یا هزینهٔ قابل‌کسر مالیاتی محاسبه نمی‌شود.' : 'Based on self-reported payment dates. This is not a tax liability or deduction calculation.'}</p>
      <label>{lang === 'fa' ? 'سال' : 'Year'} <input type="number" min={2000} max={2100} value={year} onChange={event => { const value = Number(event.target.value); if (value >= 2000 && value <= 2100) setYear(value); }} className="w-28 rounded border p-2" /></label>
      <ul className="space-y-2">{annual.map(group => <li key={`${group.unit_id}-${group.currency}-${group.kind}-${group.direction}`} className="rounded border p-2">{view.units.find(unit => unit.id === group.unit_id)?.unit_label ?? group.unit_id} · {group.kind} · {group.direction} · {group.entry_count} · {group.amount} {group.currency}</li>)}</ul>
    </section>
    {selected && <Fragment key={selected}><fieldset disabled={busy || !detailsReady} aria-busy={!detailsReady} className="space-y-6">
      {!detailsReady && !error && <p role="status">{loading}</p>}
      <section className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="font-bold">{lang === 'fa' ? 'اتصال تأییدشده به واحد ساختمان' : lang === 'ro' ? 'Conectare la unitatea clădirii' : 'Verified building unit connection'}</h2>
      <p className="text-sm text-slate-600">{lang === 'fa' ? 'شناسه ورک‌اسپیس و واحد رسمی را از مدیر ساختمان دریافت کنید. درخواست پس از بررسی مدیر و تأیید سوپرادمین فعال می‌شود؛ این اتصال دسترسی کلی به ساختمان نمی‌دهد.' : 'Obtain the workspace and official unit IDs from the building manager. The manager and platform administrator must verify the request.'}</p>
      <form className="grid gap-2 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); const form = event.currentTarget; const fields = Object.fromEntries(new FormData(form)); void linkAction({ action: 'request', private_unit_id: selected, workspace_id: fields.workspace_id, canonical_unit_id: fields.canonical_unit_id, evidence: fields.evidence }, form); }}>
        <label>Workspace ID<input name="workspace_id" required className="w-full rounded border p-2" /></label>
        <label>{lang === 'fa' ? 'شناسه واحد رسمی' : 'Official unit ID'}<input name="canonical_unit_id" required className="w-full rounded border p-2" /></label>
        <label className="sm:col-span-2">{lang === 'fa' ? 'مرجع مدرک مالکیت یا توضیح قابل بررسی' : 'Ownership evidence reference'}<textarea name="evidence" required minLength={15} maxLength={500} className="w-full rounded border p-2" /></label>
        <button disabled={busy} className="rounded bg-teal-700 p-2 text-white disabled:opacity-50">{lang === 'fa' ? 'درخواست اتصال' : 'Request connection'}</button>
      </form>
      <ul className="space-y-2">{links.filter(link => link.private_unit_id === selected).map(link => <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2"><span>{link.status} · {link.workspace_id} · {link.canonical_unit_id}</span>{['requested','manager_verified','linked'].includes(link.status) && <button type="button" disabled={busy} className="rounded border px-2 py-1" onClick={() => void linkAction({ action: 'withdraw', link_id: link.id })}>{lang === 'fa' ? 'لغو اتصال' : 'Withdraw'}</button>}</li>)}</ul>
    </section><section className="space-y-3 rounded-xl border bg-white p-5">
      <h2 className="font-bold">{lang === 'fa' ? 'شارژ رسمی ساختمان' : lang === 'ro' ? 'Facturi oficiale ale clădirii' : 'Official building charges'}</h2>
      <p className="text-sm text-slate-600">{lang === 'fa' ? 'فقط صورتحساب‌های صادرشده برای مالک تأییدشده نمایش داده می‌شود. این بخش جدا از ثبت‌های مالی شخصی شماست.' : 'Issued invoices owed by the verified owner are shown separately from self-reported cash records.'}</p>
      {charges.length === 0 && <p className="text-sm text-slate-500">{lang === 'fa' ? 'صورتحساب قابل نمایشی وجود ندارد.' : 'No visible official invoices.'}</p>}
      <ul className="space-y-2">{charges.map(charge => <li key={charge.id} className="rounded border p-2">#{charge.invoice_no} · {charge.total} {charge.currency} · {charge.status} · {lang === 'fa' ? 'باقی‌مانده' : 'Outstanding'}: {charge.outstanding_amount ?? '—'} · {charge.due_on ?? '—'}</li>)}</ul>
    </section><section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="font-bold">{t.leases}</h2>
      <form onSubmit={event=>void submit(event,'lease')} className="grid gap-2 sm:grid-cols-2">
        <label>{t.tenant}<input required name="tenant_label" minLength={2} maxLength={160} className="w-full rounded border p-2" /></label>
        <label>{t.monthly}<input required type="number" name="monthly_rent" min="0" step="0.01" className="w-full rounded border p-2" /></label>
        <label>{t.start}<input required type="date" name="starts_on" className="w-full rounded border p-2" /></label>
        <label>{t.end}<input type="date" name="ends_on" className="w-full rounded border p-2" /></label>
        <select name="currency" aria-label="Currency" className="rounded border p-2"><option>RON</option><option>EUR</option><option>USD</option></select>
        <button disabled={busy} className="rounded bg-teal-700 p-2 text-white disabled:opacity-50">{t.recordLease}</button>
      </form>
      <ul className="space-y-2">{view.leases.map(l => <li key={l.id} className="rounded border p-2">{l.tenant_label} · {l.starts_on} – {l.ends_on ?? '…'} · {l.monthly_rent} {l.currency} · {l.status}
        <div className="mt-2 flex gap-2">{l.status === 'draft' && <><button type="button" disabled={busy} onClick={() => void changeLease(l.id,'activate')} className="rounded border px-2 py-1">{lang === 'fa' ? 'فعال‌سازی' : 'Activate'}</button><button type="button" disabled={busy} onClick={() => void changeLease(l.id,'cancel')} className="rounded border px-2 py-1">{lang === 'fa' ? 'لغو پیش‌نویس' : 'Cancel draft'}</button></>}{l.status === 'active' && <button type="button" disabled={busy} onClick={() => void changeLease(l.id,'end')} className="rounded border px-2 py-1">{lang === 'fa' ? 'پایان قرارداد' : 'End lease'}</button>}</div>
      </li>)}</ul>
    </section><section className="space-y-3 rounded-xl border bg-white p-5"><h2 className="font-bold">{t.cash}</h2>
      <form onSubmit={event=>void submit(event,'cash')} className="grid gap-2 sm:grid-cols-2">
        <label>{t.kind}<select name="kind" className="w-full rounded border p-2"><option value="rent">Rent</option><option value="building_charge">Building charge</option><option value="owner_expense">Expense</option><option value="tax_reserve">Tax reserve</option><option value="other">Other</option></select></label>
        <select name="direction" aria-label="Direction" className="rounded border p-2"><option value="income">Income</option><option value="expense">Expense</option></select>
        <label>{t.amount}<input required type="number" name="amount" min="0.01" step="0.01" className="w-full rounded border p-2" /></label>
        <select name="currency" aria-label="Currency" className="rounded border p-2"><option>RON</option><option>EUR</option><option>USD</option></select>
        <label>{t.due}<input type="date" name="due_on" className="w-full rounded border p-2" /></label>
        <label>{t.paid}<input type="date" name="paid_on" className="w-full rounded border p-2" /></label>
        <label>{t.memo}<input name="memo" maxLength={500} className="w-full rounded border p-2" /></label>
        <label>{lang === 'fa' ? 'قرارداد مرتبط با اجاره دریافتی (اختیاری)' : 'Related rent lease (optional)'}<select name="lease_id" className="w-full rounded border p-2"><option value="">—</option>{view.leases.filter(l => l.status === 'active' || l.status === 'ended').map(l => <option key={l.id} value={l.id}>{l.tenant_label} · {l.starts_on}</option>)}</select></label>
        <button disabled={busy} className="rounded bg-teal-700 p-2 text-white disabled:opacity-50">{t.recordCash}</button>
      </form><p className="text-xs text-slate-500">{t.sourced} · {lang === 'fa' ? 'برای ثبت دریافت مرتبط با قرارداد، دستهٔ اجاره و جهت درآمد و هر دو تاریخ سررسید و دریافت را وارد کنید.' : 'For a lease payment, select Rent and Income and enter both due and received dates.'}</p>
      <ul className="space-y-2">{view.entries.map(e => <li key={e.id} className="rounded border p-2">{e.kind} · {e.direction} · {e.amount} {e.currency} · {e.due_on ?? '—'} · {e.paid_on ?? '—'}{e.lease_id && ` · ${lang === 'fa' ? 'قرارداد' : 'Lease'} ${e.lease_id}`}</li>)}</ul>
    </section></fieldset></Fragment>}
  </main>;
}
