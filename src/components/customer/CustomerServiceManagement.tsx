'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { z } from 'zod';
import type { Language } from '@/types';
import { currencyConfig } from '@/config/currencies';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { serviceCatalogManagementSchema, updateServiceDefinitionSchema, type ServiceCatalogManagement } from '@/lib/customer/service-catalog-management-schema';
import { serviceManagementCopy, serviceDefinitionCopy } from '@/lib/customer/service-catalog-management-copy';
import { uuidSchema } from '@/lib/customer/workspace-composition-schema';
import { createServiceOfferingRequestSchema, reviseServiceOfferingRequestSchema, transitionServiceOfferingRequestSchema, serviceOfferingRevisionSchema } from '@/lib/customer/service-catalog-schema';

type Offering = ServiceCatalogManagement['offerings'][number];
type Revision = z.infer<typeof serviceOfferingRevisionSchema>;
type Command = { kind: 'create' | 'revise' | 'transition'; request: Record<string, unknown> };
const button = 'rounded-xl bg-[#087A6E] px-4 py-2 font-semibold text-white disabled:opacity-50';
const input = 'mt-1 w-full rounded-lg border p-2 text-[#102A43]';
const locales = ['ro', 'en', 'fa'] as const;
const names = { ro: 'Română', en: 'English', fa: 'فارسی' };
const mutationResult = z.object({ offering_id: uuidSchema, revision_id: uuidSchema, status: z.string(), lock_version: z.number().int() });

export function CustomerServiceManagement({ contextId, workspaceId, lang }: { contextId: string; workspaceId: string; lang: Language }) {
  const fetch = useDashboardFetch();
  const t = serviceManagementCopy[lang];
  const [data, setData] = useState<ServiceCatalogManagement | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [after, setAfter] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Offering | null>(null);
  const pending = useRef(false);
  const lifetime = useRef<AbortController | null>(null);
  const retry = useRef(new Map<string, string>());
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    return () => { controller.abort(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const query = new URLSearchParams({ context_id: contextId, workspace_id: workspaceId });
        if (after) query.set('after', after);
        const response = await fetch(`/api/customer/v1/services/catalog/management?${query}`, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 403 ? t.denied : t.error);
        const value = serviceCatalogManagementSchema.parse(await response.json());
        if (!controller.signal.aborted) setData(value);
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error && reason.message === t.denied ? t.denied : t.error); }
    })();
    return () => controller.abort();
  }, [contextId, workspaceId, after, attempt, fetch, t.denied, t.error]);
  function refresh(cursor = after) { setData(null); setError(''); setEditing(null); setAfter(cursor); setAttempt(n => n + 1); }
  async function send(path: string, payload: Record<string, unknown>, kind?: Command['kind']) {
    if (pending.current) return false;
    const controller = lifetime.current;
    if (!controller || controller.signal.aborted) return false;
    const identity = JSON.stringify({ path, kind, payload });
    const key = retry.current.get(identity) ?? crypto.randomUUID();
    retry.current.set(identity, key);
    const request = { ...payload, context_id: contextId, workspace_id: workspaceId, idempotency_key: key };
    if (kind) {
      const schema = kind === 'create' ? createServiceOfferingRequestSchema : kind === 'revise' ? reviseServiceOfferingRequestSchema : transitionServiceOfferingRequestSchema;
      if (!schema.safeParse(request).success) { setError(t.invalid); return false; }
    }
    if (path.endsWith('/management') && !updateServiceDefinitionSchema.safeParse(request).success) { setError(t.invalid); return false; }
    pending.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(path, { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(kind ? { kind, request } : request) });
      if (!response.ok) throw new Error(response.status === 403 ? t.denied : response.status === 409 ? t.conflict : response.status === 400 ? t.invalid : t.error);
      const result: unknown = await response.json();
      if (kind) mutationResult.parse(result); else z.object({ definition_id: uuidSchema }).parse(result);
      if (controller.signal.aborted) return false;
      retry.current.delete(identity); setNotice(t.success); refresh(null); return true;
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error && [t.denied, t.conflict, t.invalid].includes(reason.message) ? reason.message : t.error);
      return false;
    } finally { pending.current = false; if (!controller.signal.aborted) setBusy(false); }
  }
  return <section className="space-y-5" aria-busy={busy}>
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">{t.title}</h2><button type="button" className={button} disabled={busy} onClick={() => refresh()}>{t.refresh}</button></div>
    {error ? <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">{error}</p> : null}
    {notice ? <p role="status" className="rounded-xl bg-emerald-50 p-4">{notice}</p> : null}
    {!data ? <div role="status">{error ? <button type="button" className={button} onClick={() => refresh()}>{t.retry}</button> : t.loading}</div> : <>
      {data.can_manage ? <><DefinitionForm lang={lang} busy={busy} send={send} /><DefinitionEditor key={`definitions:${attempt}`} lang={lang} data={data} busy={busy} send={send} /><OfferingForm key={editing ? `${editing.offering_id}:${editing.lock_version}` : 'new'} lang={lang} data={data} editing={editing} busy={busy} send={send} cancel={() => setEditing(null)} /></> : null}
      {!data.offerings.length ? <p>{t.empty}</p> : data.offerings.map(offering => <article key={offering.offering_id} className="rounded-2xl border bg-white p-5">
        {offering.revisions.map(row => <RevisionCard key={row.revision_id} lang={lang} offering={offering} row={row} canManage={data.can_manage} busy={busy} send={send} edit={() => { setEditing(offering); setError(''); }} />)}
      </article>)}
      <div className="flex gap-3">{after ? <button type="button" disabled={busy} className={button} onClick={() => refresh(null)}>{t.first}</button> : null}{data.next_after ? <button type="button" disabled={busy} className={button} onClick={() => refresh(data.next_after)}>{t.next}</button> : null}</div>
    </>}
  </section>;
}
type Send = (path: string, payload: Record<string, unknown>, kind?: Command['kind']) => Promise<boolean>;
function localized(form: FormData, prefix: string) { return Object.fromEntries(locales.map(lang => [lang, String(form.get(`${prefix}.${lang}`) ?? '').trim()])); }
function Texts({ lang, field, value, title, max }: { lang: Language; field: string; value?: Record<Language, string>; title: string; max: number }) {
  return <fieldset className="rounded-xl border p-3"><legend className="px-1 font-semibold">{title}</legend><div className="grid gap-3 md:grid-cols-3">{locales.map(locale => <label key={locale} className="text-sm">{names[locale]}<textarea name={`${field}.${locale}`} required maxLength={max} defaultValue={value?.[locale] ?? ''} dir={locale === 'fa' ? 'rtl' : 'ltr'} lang={locale} className={input} aria-label={`${title} (${names[locale]})`} /></label>)}</div><span className="sr-only">{lang}</span></fieldset>;
}
function DefinitionForm({ lang, busy, send }: { lang: Language; busy: boolean; send: Send }) {
  const t = serviceManagementCopy[lang];
  return <details className="rounded-2xl border bg-white p-5"><summary className="cursor-pointer font-semibold">{t.newDefinition}</summary><form className="mt-4 space-y-4" onSubmit={async event => {
    event.preventDefault(); const form = event.currentTarget; const values = new FormData(form);
    if (await send('/api/customer/v1/services/catalog/definitions', { code: String(values.get('code')).trim(), labels: localized(values, 'labels') })) form.reset();
  }}><fieldset disabled={busy} className="space-y-4"><label className="block">{t.code}<input name="code" required pattern="[a-z][a-z0-9_]{1,63}" minLength={2} maxLength={64} className={input} /></label><Texts lang={lang} field="labels" title={t.label} max={200} /><button className={button}>{t.newDefinition}</button></fieldset></form></details>;
}
function DefinitionEditor({ lang, data, busy, send }: { lang: Language; data: ServiceCatalogManagement; busy: boolean; send: Send }) {
  const t = serviceManagementCopy[lang]; const d = serviceDefinitionCopy[lang];
  const [selected, setSelected] = useState('');
  const item = data.definitions.find(row => row.definition_id === selected);
  return <details className="rounded-2xl border bg-white p-5"><summary className="cursor-pointer font-semibold">{d.title}</summary><div className="mt-4 space-y-4"><label className="block">{t.definition}<select aria-label={d.title} value={selected} onChange={event => setSelected(event.target.value)} disabled={busy} className={input}><option value="">{t.choose}</option>{data.definitions.map(row => <option key={row.definition_id} value={row.definition_id}>{row.labels[lang]} · {row.active ? d.active : d.inactive}</option>)}</select></label>{item ? <form key={`${item.definition_id}:${item.lock_version}`} onSubmit={event => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    void send('/api/customer/v1/services/catalog/management', { definition_id: item.definition_id, expected_lock_version: item.lock_version, labels: localized(form, 'labels'), active: form.get('active') === 'on', reason: String(form.get('reason') ?? '').trim() });
  }}><fieldset disabled={busy} className="space-y-4"><Texts lang={lang} field="labels" value={item.labels} title={t.label} max={200} /><label className="flex gap-2"><input name="active" type="checkbox" defaultChecked={item.active} />{d.active}</label><p className="text-sm">{d.effect}</p><label className="block">{t.reason}<input name="reason" required minLength={5} maxLength={500} className={input} /></label><button className={button}>{d.save}</button></fieldset></form> : null}</div></details>;
}
function OfferingForm({ lang, data, editing, busy, send, cancel }: { lang: Language; data: ServiceCatalogManagement; editing: Offering | null; busy: boolean; send: Send; cancel: () => void }) {
  const t = serviceManagementCopy[lang];
  const source = editing?.revisions.find(row => row.revision_id === editing.current_revision_id)?.revision;
  const [priceKind, setPriceKind] = useState(source?.price.kind ?? 'fixed');
  const [formError, setFormError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setFormError(''); const form = event.currentTarget; const values = new FormData(form);
    const text = (key: string) => String(values.get(key) ?? '').trim();
    const start = new Date(text('valid_from')); const end = text('valid_until') ? new Date(text('valid_until')) : null;
    if (!Number.isFinite(start.getTime()) || (end && !Number.isFinite(end.getTime()))) { setFormError(t.invalid); return; }
    const revision = serviceOfferingRevisionSchema.safeParse({ labels: localized(values, 'labels'), description: localized(values, 'description'),
      cancellation_terms: localized(values, 'cancellation'), acceptance_criteria: localized(values, 'acceptance'), acquisition_mode: text('mode'),
      price: priceKind === 'quote_required' ? { kind: priceKind } : { kind: priceKind, amount: text('amount'), currency: text('currency'), tax_display: text('tax'), ...(priceKind === 'unit' ? { unit_code: text('unit') } : {}) },
      valid_from: start.toISOString(), valid_until: end?.toISOString() ?? null, document_version_ids: [] });
    if (!revision.success) { setFormError(t.invalid); return; }
    const payload = editing ? { offering_id: editing.offering_id, expected_lock_version: editing.lock_version, revision: revision.data }
      : { definition_id: text('definition'), provider_party_id: text('provider'), revision: revision.data };
    if (await send('/api/customer/v1/services/catalog', payload, editing ? 'revise' : 'create')) form.reset();
  }
  const price = source?.price;
  return <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-white p-5"><h3 className="font-bold">{editing ? t.revise : t.create}</h3>{formError ? <p role="alert">{formError}</p> : null}<fieldset disabled={busy} className="space-y-4">
    {!editing ? <div className="grid gap-3 md:grid-cols-2"><label>{t.definition}<select name="definition" required defaultValue="" className={input}><option value="">{t.choose}</option>{data.definitions.filter(d => d.active).map(d => <option key={d.definition_id} value={d.definition_id}>{d.labels[lang]}</option>)}</select></label><label>{t.provider}<select name="provider" required defaultValue="" className={input}><option value="">{t.choose}</option>{data.providers.map(p => <option key={p.provider_party_id} value={p.provider_party_id}>{p.label}</option>)}</select></label>{!data.providers.length ? <p>{t.noProviders}</p> : null}</div> : null}
    <Texts lang={lang} field="labels" value={source?.labels} title={t.label} max={200} /><Texts lang={lang} field="description" value={source?.description} title={t.description} max={5000} />
    <div className="grid gap-3 md:grid-cols-3"><label>{t.mode}<select name="mode" defaultValue={source?.acquisition_mode ?? 'direct'} className={input}>{(['direct', 'pre_quote', 'on_site', 'project', 'reservation'] as const).map(mode => <option key={mode} value={mode}>{t[mode]}</option>)}</select></label>
      <label>{t.price}<select name="price_kind" value={priceKind} onChange={event => setPriceKind(event.target.value as typeof priceKind)} className={input}>{(['fixed', 'unit', 'quote_required'] as const).map(kind => <option key={kind} value={kind}>{kind === 'unit' ? t.unitPrice : t[kind]}</option>)}</select></label>
      {priceKind !== 'quote_required' ? <><label>{t.amount}<input name="amount" inputMode="decimal" required defaultValue={price && price.kind !== 'quote_required' ? price.amount : ''} className={input} /></label><label>{t.currency}<select name="currency" defaultValue={price && price.kind !== 'quote_required' ? price.currency : 'RON'} className={input}>{Object.keys(currencyConfig).map(code => <option key={code}>{code}</option>)}</select></label><label>{t.tax}<select name="tax" defaultValue={price && price.kind !== 'quote_required' ? price.tax_display : 'included'} className={input}>{(['included', 'excluded', 'not_applicable'] as const).map(tax => <option key={tax} value={tax}>{t[tax]}</option>)}</select></label>{priceKind === 'unit' ? <label>{t.unit}<input name="unit" required maxLength={64} defaultValue={price?.kind === 'unit' ? price.unit_code : ''} className={input} /></label> : null}</> : null}
    </div><div className="grid gap-3 md:grid-cols-2"><label>{t.start}<input name="valid_from" type="datetime-local" required defaultValue={localDate(source?.valid_from)} className={input} /></label><label>{t.end}<input name="valid_until" type="datetime-local" defaultValue={localDate(source?.valid_until)} className={input} /></label></div>
    <Texts lang={lang} field="cancellation" value={source?.cancellation_terms} title={t.cancellation} max={3000} /><Texts lang={lang} field="acceptance" value={source?.acceptance_criteria} title={t.acceptance} max={3000} />
    <div className="flex gap-3"><button className={button} disabled={!editing && (!data.providers.length || !data.definitions.some(d => d.active))}>{editing ? t.revise : t.create}</button>{editing ? <button type="button" className={button} onClick={cancel}>{t.cancel}</button> : null}</div>
  </fieldset></form>;
}
function localDate(value?: string | null) { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function RevisionCard({ lang, offering, row, canManage, busy, send, edit }: { lang: Language; offering: Offering; row: Offering['revisions'][number]; canManage: boolean; busy: boolean; send: Send; edit: () => void }) {
  const t = serviceManagementCopy[lang];
  const current = row.revision_id === offering.current_revision_id;
  const [reason, setReason] = useState('');
  const actions: Array<'submit' | 'publish' | 'suspend' | 'archive'> = [];
  if (current && row.status === 'draft' && canManage) actions.push('submit');
  if (row.can_publish) actions.push('publish');
  if (row.status === 'published' && canManage) actions.push('suspend');
  if (['draft', 'submitted', 'suspended'].includes(row.status) && canManage) actions.push('archive');
  return <div className="space-y-3 border-b py-4 last:border-b-0"><h3 className="text-lg font-bold">{row.revision.labels[lang]}</h3><p>{t[row.status]} · {current ? t.current : row.revision_id === offering.published_revision_id ? t.publishedVersion : t.history}</p>
    <p className="whitespace-pre-line text-sm">{row.revision.description[lang]}</p><p>{t[row.revision.acquisition_mode]} · {row.revision.price.kind === 'quote_required' ? t.quote_required : <><bdi>{row.revision.price.amount} {row.revision.price.currency}{row.revision.price.kind === 'unit' ? ` / ${row.revision.price.unit_code}` : ''}</bdi> · {t[row.revision.price.tax_display]}</>}</p>
    <p className="text-sm">{t.start}: <time dateTime={row.revision.valid_from}>{new Date(row.revision.valid_from).toLocaleString(lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-GB')}</time>{row.revision.valid_until ? <> · {t.end}: <time dateTime={row.revision.valid_until}>{new Date(row.revision.valid_until).toLocaleString(lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-GB')}</time></> : null}</p>
    <details><summary className="cursor-pointer">{t.acceptance} / {t.cancellation}</summary><p>{row.revision.acceptance_criteria[lang]}</p><p>{row.revision.cancellation_terms[lang]}</p></details>
    {current && row.status !== 'archived' && canManage ? <button type="button" className={button} disabled={busy} onClick={edit}>{t.edit}</button> : null}
    {current && row.status === 'submitted' && !row.can_publish ? <p className="text-sm">{t.separate}</p> : null}
    {actions.length ? <div className="space-y-3"><label className="block">{t.reason}<input value={reason} onChange={event => setReason(event.target.value)} minLength={5} maxLength={500} disabled={busy} className={input} /></label><div className="flex flex-wrap gap-2">{actions.map(action => <button type="button" key={action} className={button} disabled={busy || reason.trim().length < 5} onClick={() => void send('/api/customer/v1/services/catalog', { offering_id: offering.offering_id, revision_id: row.revision_id, expected_lock_version: offering.lock_version, action, reason: reason.trim() }, 'transition')}>{t[action]}</button>)}</div></div> : null}
  </div>;
}
