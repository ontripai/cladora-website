'use client';

import { useEffect, useState } from 'react';
import { z } from 'zod';
import type { Language } from '@/types';
import { useCustomerContext } from './CustomerContextProvider';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { uuidSchema } from '@/lib/customer/workspace-composition-schema';
import { serviceOfferingRevisionSchema } from '@/lib/customer/service-catalog-schema';
import { CustomerServiceManagement } from './CustomerServiceManagement';
import { CustomerServiceRequests } from './CustomerServiceRequests';
import { CustomerServiceQuotes, serviceQuoteCopy } from './CustomerServiceQuotes';
import { serviceManagementCopy } from '@/lib/customer/service-catalog-management-copy';

const copy = {
  fa: { title: 'خدمات فضای کاری', subtitle: 'خدمات قابل استفاده و شرایط هر خدمت را در فضای کاری خود ببینید.', choose: 'فضای کاری را انتخاب کنید', workspace: 'فضای کاری', loading: 'در حال دریافت خدمات…', noContext: 'ابتدا زمینهٔ کاری خود را انتخاب کنید.', noTargets: 'فضای کاری قابل انتخابی در این زمینه وجود ندارد.', empty: 'در این فضای کاری هنوز خدمت منتشرشده‌ای وجود ندارد.', denied: 'دسترسی به خدمات این فضای کاری برای حساب شما فعال نیست.', error: 'دریافت خدمات ناموفق بود.', retry: 'تلاش دوباره', terms: 'شرایط لغو و پذیرش', cancellation: 'شرایط لغو', acceptance: 'معیار پذیرش', quote: 'قیمت پس از بررسی درخواست', included: 'مالیات در قیمت لحاظ شده', excluded: 'مالیات جدا محاسبه می‌شود', not_applicable: 'مالیات اعمال نمی‌شود', direct: 'قیمت مشخص', pre_quote: 'استعلام قیمت', on_site: 'بازدید در محل', project: 'پروژه', reservation: 'رزرو' },
  en: { title: 'Workspace services', subtitle: 'Explore available services and their terms in your workspace.', choose: 'Choose a workspace', workspace: 'Workspace', loading: 'Loading services…', noContext: 'Choose your working context first.', noTargets: 'No workspace can be selected in this context.', empty: 'No published services are available in this workspace yet.', denied: 'Service access is unavailable for your account in this workspace.', error: 'Services could not be loaded.', retry: 'Try again', terms: 'Cancellation and acceptance terms', cancellation: 'Cancellation terms', acceptance: 'Acceptance criteria', quote: 'Price after request review', included: 'Tax included', excluded: 'Tax calculated separately', not_applicable: 'Tax does not apply', direct: 'Stated price', pre_quote: 'Request a quote', on_site: 'On-site assessment', project: 'Project', reservation: 'Reservation' },
  ro: { title: 'Serviciile spațiului de lucru', subtitle: 'Descoperă serviciile disponibile și condițiile lor în spațiul tău de lucru.', choose: 'Alege un spațiu de lucru', workspace: 'Spațiu de lucru', loading: 'Se încarcă serviciile…', noContext: 'Alege mai întâi contextul de lucru.', noTargets: 'Nu există un spațiu de lucru selectabil în acest context.', empty: 'Nu există încă servicii publicate în acest spațiu de lucru.', denied: 'Accesul la servicii nu este disponibil pentru contul tău în acest spațiu.', error: 'Serviciile nu au putut fi încărcate.', retry: 'Încearcă din nou', terms: 'Condiții de anulare și acceptare', cancellation: 'Condiții de anulare', acceptance: 'Criterii de acceptare', quote: 'Preț după evaluarea cererii', included: 'Taxe incluse', excluded: 'Taxe calculate separat', not_applicable: 'Taxele nu se aplică', direct: 'Preț stabilit', pre_quote: 'Cerere de ofertă', on_site: 'Evaluare la fața locului', project: 'Proiect', reservation: 'Rezervare' },
};
const targetsSchema = z.strictObject({ workspaces: z.array(z.strictObject({ workspace_id: uuidSchema, workspace_type: z.string(), environment: z.string() })) });
const shape = serviceOfferingRevisionSchema.shape;
const offeringsSchema = z.strictObject({ offerings: z.array(z.strictObject({ offering_id: uuidSchema, revision_id: uuidSchema,
  labels: shape.labels, description: shape.description, acquisition_mode: shape.acquisition_mode, price: shape.price,
  valid_from: shape.valid_from, valid_until: shape.valid_until, cancellation_terms: shape.cancellation_terms, acceptance_criteria: shape.acceptance_criteria })) });
type Item = z.infer<typeof offeringsSchema>['offerings'][number];
type Target = z.infer<typeof targetsSchema>['workspaces'][number];

export function CustomerServiceCatalog({ lang }: { lang: Language }) {
  const { active } = useCustomerContext();
  const t = copy[lang];
  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="space-y-6">
    <header className="rounded-2xl border bg-white p-6"><h1 className="text-2xl font-bold text-[#102A43]">{t.title}</h1><p className="mt-2 text-sm text-[#52667A]">{t.subtitle}</p></header>
    {active ? <WorkspaceChoice key={active.context_id} contextId={active.context_id} lang={lang} /> : <Notice text={t.noContext} />}
  </section>;
}
function WorkspaceChoice({ contextId, lang }: { contextId: string; lang: Language }) {
  const fetch = useDashboardFetch();
  const t = copy[lang];
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [selected, setSelected] = useState('');
  const [manage, setManage] = useState(false);
  const [quotes, setQuotes] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/customer/v1/workspace/targets?${new URLSearchParams({ context_id: contextId })}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 403 ? t.denied : t.error);
        const data = targetsSchema.parse(await response.json());
        if (!controller.signal.aborted) setTargets(data.workspaces);
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error && reason.message === t.denied ? t.denied : t.error); }
    })();
    return () => controller.abort();
  }, [contextId, attempt, t.denied, t.error, fetch]);
  if (error) return <Notice text={error} retry={() => { setError(''); setTargets(null); setSelected(''); setAttempt(n => n + 1); }} retryLabel={t.retry} />;
  if (targets === null) return <Notice text={t.loading} />;
  if (!targets.length) return <Notice text={t.noTargets} />;
  return <div className="space-y-5"><label className="block rounded-2xl border bg-white p-4"><span className="mb-2 block text-sm font-semibold">{t.choose}</span>
    <select aria-label={t.choose} value={selected} onChange={event => { setSelected(event.target.value); setManage(false); setQuotes(false); }} className="w-full rounded-xl border p-3">
      <option value="">{t.choose}</option>{targets.map((target, index) => <option key={target.workspace_id} value={target.workspace_id}>{t.workspace} {index + 1}</option>)}
    </select></label>{selected ? <><div className="flex flex-wrap gap-3"><button type="button" aria-pressed={!manage && !quotes} onClick={() => { setManage(false); setQuotes(false); }} className="rounded-xl border bg-white px-4 py-2 font-semibold">{t.title}</button><button type="button" aria-pressed={manage} onClick={() => { setManage(true); setQuotes(false); }} className="rounded-xl bg-[#087A6E] px-4 py-2 font-semibold text-white">{serviceManagementCopy[lang].title}</button><button type="button" aria-pressed={quotes} onClick={() => { setQuotes(true); setManage(false); }} className="rounded-xl border bg-white px-4 py-2 font-semibold">{serviceQuoteCopy[lang].title}</button></div>{quotes ? <CustomerServiceQuotes key={`${contextId}:${selected}`} contextId={contextId} workspaceId={selected} lang={lang} /> : manage ? <CustomerServiceManagement key={`${contextId}:${selected}`} contextId={contextId} workspaceId={selected} lang={lang} /> : <Offerings key={`${contextId}:${selected}`} contextId={contextId} workspaceId={selected} lang={lang} />}</> : null}</div>;
}
function Offerings({ contextId, workspaceId, lang }: { contextId: string; workspaceId: string; lang: Language }) {
  const fetch = useDashboardFetch();
  const t = copy[lang];
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch(`/api/customer/v1/services/catalog?${new URLSearchParams({ context_id: contextId, workspace_id: workspaceId })}`, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error(response.status === 403 ? t.denied : t.error);
        const data = offeringsSchema.parse(await response.json());
        if (!controller.signal.aborted) setItems(data.offerings);
      } catch (reason) { if (!controller.signal.aborted) setError(reason instanceof Error && reason.message === t.denied ? t.denied : t.error); }
    })();
    return () => controller.abort();
  }, [contextId, workspaceId, attempt, t.denied, t.error, fetch]);
  if (error) return <Notice text={error} retry={() => { setError(''); setItems(null); setAttempt(n => n + 1); }} retryLabel={t.retry} />;
  if (items === null) return <Notice text={t.loading} />;
  if (!items.length) return <><Notice text={t.empty} /><CustomerServiceRequests contextId={contextId} workspaceId={workspaceId} lang={lang} offerings={items}/></>;
  return <><div className="grid gap-5 md:grid-cols-2">{items.map(item => <article key={item.revision_id} className="rounded-2xl border bg-white p-6">
    <span className="rounded-full bg-[#EAF8F5] px-3 py-1 text-xs font-semibold text-[#087A6E]">{t[item.acquisition_mode]}</span>
    <h2 className="mt-4 text-xl font-bold text-[#102A43]">{item.labels[lang]}</h2><p className="mt-2 whitespace-pre-line text-sm text-[#52667A]">{item.description[lang]}</p>
    <div className="my-5 rounded-xl bg-[#F6F9FC] p-4">{item.price.kind === 'quote_required' ? <p>{t.quote}</p> : <>
      <p className="font-bold"><bdi>{item.price.amount} {item.price.currency}{item.price.kind === 'unit' ? ` / ${item.price.unit_code}` : ''}</bdi></p><p className="mt-1 text-xs text-[#52667A]">{t[item.price.tax_display]}</p>
    </>}</div><details className="border-t pt-4"><summary className="cursor-pointer text-sm font-semibold text-[#087A6E]">{t.terms}</summary>
      <h3 className="mt-4 text-sm font-bold">{t.cancellation}</h3><p className="mt-1 whitespace-pre-line text-sm">{item.cancellation_terms[lang]}</p>
      <h3 className="mt-4 text-sm font-bold">{t.acceptance}</h3><p className="mt-1 whitespace-pre-line text-sm">{item.acceptance_criteria[lang]}</p>
    </details></article>)}</div><CustomerServiceRequests contextId={contextId} workspaceId={workspaceId} lang={lang} offerings={items}/></>;
}
function Notice({ text, retry, retryLabel }: { text: string; retry?: () => void; retryLabel?: string }) {
  return <div role="status" className="rounded-2xl border bg-white p-8 text-center text-sm text-[#52667A]">{text}{retry ? <button type="button" onClick={retry} className="ms-3 rounded-xl bg-[#0E9F8E] px-4 py-2 font-semibold text-white">{retryLabel}</button> : null}</div>;
}
