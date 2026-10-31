'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {z} from 'zod';
import {useDashboardFetch} from '@/components/dashboard-lab/DashboardTransport';
import {configureImportTemplateSchema, importContextSchema} from '@/lib/customer/onboarding-import-schema';
import {useCustomerContext} from './CustomerContextProvider';

type Lang = 'en' | 'ro' | 'fa';
const copy = {
  en: {title: 'Import templates', body: 'Download an empty CSV template. This does not import data or complete building setup.', context: 'Select a working context to view templates.', loading: 'Loading templates…', empty: 'No templates are currently available.', error: 'Templates could not be verified. Try reading the list again.', denied: 'Template access is no longer available. Check current access by retrying the list.', retry: 'Reload templates', download: 'Download CSV', downloading: 'Preparing CSV…', downloaded: 'The CSV download was requested. No data was imported.', version: 'Version', rows: 'Maximum rows', columns: 'Columns'},
  ro: {title: 'Șabloane de import', body: 'Descarcă un șablon CSV gol. Aceasta nu importă date și nu finalizează configurarea clădirii.', context: 'Selectează un context de lucru pentru a vedea șabloanele.', loading: 'Se încarcă șabloanele…', empty: 'Nu există șabloane disponibile în acest moment.', error: 'Șabloanele nu au putut fi verificate. Citește din nou lista.', denied: 'Accesul la șabloane nu mai este disponibil. Verifică accesul curent reîncărcând lista.', retry: 'Reîncarcă șabloanele', download: 'Descarcă CSV', downloading: 'Se pregătește CSV…', downloaded: 'Descărcarea CSV a fost solicitată. Nu s-au importat date.', version: 'Versiune', rows: 'Număr maxim de rânduri', columns: 'Coloane'},
  fa: {title: 'قالب‌های ورود اطلاعات', body: 'قالب CSV خالی را دریافت کنید. دریافت قالب به معنی ورود اطلاعات یا تکمیل راه‌اندازی ساختمان نیست.', context: 'برای مشاهده قالب‌ها یک زمینه کاری انتخاب کنید.', loading: 'در حال دریافت قالب‌ها…', empty: 'در حال حاضر قالبی در دسترس نیست.', error: 'قالب‌ها تأیید نشدند. فهرست را دوباره دریافت کنید.', denied: 'دسترسی به قالب‌ها دیگر برقرار نیست. با دریافت دوباره فهرست، دسترسی فعلی را بررسی کنید.', retry: 'دریافت دوباره قالب‌ها', download: 'دریافت CSV', downloading: 'در حال آماده‌سازی CSV…', downloaded: 'درخواست دریافت CSV انجام شد. اطلاعاتی وارد نشد.', version: 'نسخه', rows: 'حداکثر ردیف', columns: 'ستون‌ها'},
};

// Reuse the canonical code allowlist and configuration schema. The GET returns
// an array, not an envelope or caller-supplied download URL.
const templateSchema = configureImportTemplateSchema.pick({code: true, name: true, schema: true, max_rows: true}).extend({
  description: z.string().max(500).nullable(),
  max_rows: z.number().int().min(1).max(100_000),
  version: z.number().int().positive(),
  format: z.enum(['csv', 'xlsx_template_only']),
}).strict().refine(item => new Set(item.schema.headers).size === item.schema.headers.length);
const templatesSchema = z.array(templateSchema).max(12).refine(items => new Set(items.map(item => item.code)).size === items.length);
type Template = z.infer<typeof templateSchema>;
type State = {status: 'loading' | 'ready' | 'error' | 'denied'; items: Template[]; downloading: boolean; downloaded: boolean};
const initial: State = {status: 'loading', items: [], downloading: false, downloaded: false};
const buttonClass = 'min-h-11 max-w-full rounded-lg border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50';

export function CustomerOnboardingTemplates({lang}: {lang: Lang}) {
  const {active, dashboard, loading, error} = useCustomerContext();
  if (loading || error || !active || !dashboard || dashboard.contextId !== active.context_id || !importContextSchema.safeParse({context_id: active.context_id}).success ||
      !z.uuid().safeParse(active.membership_id).success || !z.uuid().safeParse(dashboard.workspace_id).success) {
    return <p role="status">{copy[lang].context}</p>;
  }
  return <ScopedTemplates key={`${active.membership_id}:${active.context_id}:${dashboard.workspace_id}`} lang={lang} contextId={active.context_id}/>;
}

function ScopedTemplates({lang, contextId}: {lang: Lang; contextId: string}) {
  const fetch = useDashboardFetch();
  const t = copy[lang];
  const [state, setState] = useState<State>(initial);
  const lifecycle = useRef<symbol | null>(null);
  const operation = useRef<symbol | null>(null);
  const controller = useRef<AbortController | null>(null);
  const urls = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const endpoint = `/api/customer/v1/onboarding/templates?context_id=${encodeURIComponent(contextId)}`;

  const load = useCallback(async () => {
    if (!lifecycle.current || operation.current) return;
    const life = lifecycle.current, owner = Symbol('template-list');
    operation.current = owner;
    const abort = new AbortController();
    controller.current = abort;
    const current = () => lifecycle.current === life && operation.current === owner && !abort.signal.aborted;
    setState(initial);
    try {
      const response = await fetch(endpoint, {method: 'GET', cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: abort.signal});
      if (!current()) return;
      if (response.status === 401 || response.status === 403) {
        setState({...initial, status: 'denied'});
        return;
      }
      if (!response.ok || response.redirected) throw Error('template_read');
      const parsed = templatesSchema.safeParse(await response.json());
      if (!current()) return;
      if (!parsed.success) throw Error('template_shape');
      setState({...initial, status: 'ready', items: parsed.data});
    } catch {
      if (current()) setState({...initial, status: 'error'});
    } finally {
      if (current()) { operation.current = null; controller.current = null; }
    }
  }, [fetch, endpoint]);

  useEffect(() => {
    const life = Symbol('template-scope');
    lifecycle.current = life;
    const resources = urls.current;
    void Promise.resolve().then(() => { if (lifecycle.current === life) void load(); });
    return () => {
      if (lifecycle.current === life) {
        lifecycle.current = null;
        operation.current = null;
        controller.current?.abort();
        controller.current = null;
      }
      resources.forEach((timer, url) => { clearTimeout(timer); URL.revokeObjectURL(url); });
      resources.clear();
    };
  }, [load]);

  async function download(template: Template) {
    if (!lifecycle.current || operation.current || state.status !== 'ready' || !state.items.includes(template)) return;
    const life = lifecycle.current, owner = Symbol('template-download');
    operation.current = owner;
    const abort = new AbortController();
    controller.current = abort;
    const current = () => lifecycle.current === life && operation.current === owner && !abort.signal.aborted;
    setState(previous => ({...previous, downloading: true, downloaded: false}));
    try {
      const response = await fetch(`/api/customer/v1/onboarding/templates/${encodeURIComponent(template.code)}/download?context_id=${encodeURIComponent(contextId)}`, {method: 'GET', cache: 'no-store', credentials: 'same-origin', redirect: 'error', signal: abort.signal});
      if (!current()) return;
      if (response.status === 401 || response.status === 403) {
        setState({...initial, status: 'denied'});
        return;
      }
      if (!response.ok || response.redirected || !/^text\/csv(?:;|$)/i.test(response.headers.get('content-type') ?? '')) throw Error('template_download');
      const blob = await response.blob();
      if (!current()) return;
      if (blob.size > 32768) throw Error('template_size');
      const text = await blob.text();
      if (!current()) return;
      // The canonical route emits ONLY the quoted header row. Reject changed
      // schemas, error documents and additional data rather than saving them.
      const expected = `${template.schema.headers.map(header => `"${header}"`).join(',')}\r\n`;
      if (text.replace(/^\uFEFF/, '') !== expected) throw Error('template_csv');
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      try {
        anchor.href = url;
        anchor.download = `cladora-${template.code}.csv`;
        document.body.append(anchor);
        anchor.click();
      } finally {
        anchor.remove();
        const timer = setTimeout(() => { URL.revokeObjectURL(url); urls.current.delete(url); }, 0);
        urls.current.set(url, timer);
      }
      setState(previous => ({...previous, downloading: false, downloaded: true}));
    } catch {
      if (current()) setState({...initial, status: 'error'});
    } finally {
      if (current()) { operation.current = null; controller.current = null; }
    }
  }

  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} aria-label={t.title} className="min-w-0 space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4" aria-busy={state.status === 'loading' || state.downloading}>
    <h2 className="text-lg font-semibold">{t.title}</h2>
    <p className="break-words text-sm text-slate-600">{t.body}</p>
    {state.status === 'loading' && <p role="status">{t.loading}</p>}
    {state.status === 'denied' && <p role="alert">{t.denied}</p>}
    {state.status === 'error' && <p role="alert">{t.error}</p>}
    {state.status === 'ready' && state.items.length === 0 && <p role="status">{t.empty}</p>}
    {state.status === 'ready' && <ul className="grid min-w-0 gap-3 sm:grid-cols-2">{state.items.map(template => <li key={template.code} className="min-w-0 space-y-2 break-words rounded-lg border p-3">
      <h3 className="font-semibold">{template.name}</h3>
      {template.description && <p className="text-sm">{template.description}</p>}
      <p className="text-sm">{t.version}: {template.version} · {t.rows}: {template.max_rows}</p>
      <p className="break-all text-sm">{t.columns}: <bdi dir="ltr">{template.schema.headers.join(', ')}</bdi></p>
      <button type="button" className={buttonClass} disabled={state.downloading} onClick={() => { void download(template); }}>{t.download} · <bdi>{template.name}</bdi></button>
    </li>)}</ul>}
    {state.downloading && <p role="status">{t.downloading}</p>}
    {state.downloaded && <p role="status">{t.downloaded}</p>}
    <button type="button" className={buttonClass} disabled={state.status === 'loading' || state.downloading} onClick={() => { void load(); }}>{t.retry}</button>
  </section>;
}
