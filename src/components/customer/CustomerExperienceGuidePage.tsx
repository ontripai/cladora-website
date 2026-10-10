'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Language } from '@/types';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { useCustomerContext } from './CustomerContextProvider';
import { CustomerExperienceGuide } from './CustomerExperienceGuide';
import { classifyGuideResponse, guideReadResponseSchema, toExperienceGuideView, type GuideLoadFailure, type GuideReadItem } from '@/lib/community/experience-guide-client';

const copy = {
  ro: { title: 'Ghiduri pentru experiență', subtitle: 'Consultă ghidurile publicate pentru spațiul tău de lucru și publicul curent.', choose: 'Alege ghidul', loading: 'Se încarcă ghidurile…', empty: 'Nu există ghiduri eligibile în acest spațiu de lucru.', noContext: 'Alege mai întâi un context activ.', session: 'Sesiunea necesită verificare. Autentifică-te din nou.', denied: 'Modulul de ghiduri sau permisiunea necesară nu este activă în acest spațiu de lucru.', notReady: 'Conexiunea operațională pentru ghiduri nu este încă activată.', retry: 'Ghidurile nu au putut fi încărcate.', again: 'Încearcă din nou', viewOnly: 'Editarea referințelor rămâne indisponibilă până când selectorul securizat de documente este activ.' },
  en: { title: 'Experience guides', subtitle: 'Read guides published for your workspace and current audience.', choose: 'Choose a guide', loading: 'Loading guides…', empty: 'No eligible guides are available in this workspace.', noContext: 'Choose an active context first.', session: 'Your session needs verification. Sign in again.', denied: 'The guides module or required permission is not active in this workspace.', notReady: 'The operational guides connection has not been activated yet.', retry: 'Guides could not be loaded.', again: 'Try again', viewOnly: 'Reference editing remains unavailable until the secure document selector is active.' },
  fa: { title: 'راهنماهای تجربه', subtitle: 'راهنماهای منتشرشده برای فضای کاری و مخاطب فعلی را ببینید.', choose: 'انتخاب راهنما', loading: 'در حال دریافت راهنماها…', empty: 'در این فضای کاری راهنمای واجد شرایطی وجود ندارد.', noContext: 'ابتدا یک زمینهٔ فعال انتخاب کنید.', session: 'نشست شما نیاز به بررسی دوباره دارد؛ دوباره وارد شوید.', denied: 'ماژول راهنما یا مجوز لازم در این فضای کاری فعال نیست.', notReady: 'اتصال عملیاتی راهنماها هنوز فعال نشده است.', retry: 'دریافت راهنماها ناموفق بود.', again: 'تلاش دوباره', viewOnly: 'ویرایش ارجاع‌ها تا فعال‌شدن انتخاب‌گر امن اسناد در دسترس نیست.' },
} as const;

export function CustomerExperienceGuidePage({ lang }: { lang: Language }) {
  const { active, dashboard, loading } = useCustomerContext(); const t = copy[lang];
  if (loading && (!active || !dashboard)) return <Notice lang={lang} text={t.loading} />;
  if (!active || !dashboard) return <Notice lang={lang} text={t.noContext} />;
  return <GuideWorkspace key={`${active.context_id}:${dashboard.workspace_id}`} lang={lang} contextId={active.context_id} workspaceId={dashboard.workspace_id} />;
}

function GuideWorkspace({ lang, contextId, workspaceId }: { lang: Language; contextId: string; workspaceId: string }) {
  const fetch = useDashboardFetch(); const t = copy[lang];
  const [guides, setGuides] = useState<GuideReadItem[] | null>(null); const [selectedId, setSelectedId] = useState('');
  const [failure, setFailure] = useState<GuideLoadFailure | null>(null); const [attempt, setAttempt] = useState(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/customer/v1/experience/guides?${new URLSearchParams({ context_id: contextId, workspace_id: workspaceId })}`, { cache: 'no-store', credentials: 'same-origin', signal });
    if (!response.ok) throw new Error(classifyGuideResponse(response.status));
    const parsed = guideReadResponseSchema.parse(await response.json());
    if (parsed.guides.some((guide) => guide.workspace_id !== workspaceId)) throw new Error('retry');
    if (!signal?.aborted) { setGuides(parsed.guides); setSelectedId((current) => parsed.guides.some((guide) => guide.guide_id === current) ? current : parsed.guides[0]?.guide_id ?? ''); setFailure(null); }
  }, [contextId, workspaceId, fetch]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void load(controller.signal).catch((reason) => {
      if (!controller.signal.aborted) { setFailure(reason instanceof Error && ['session', 'denied', 'not_ready'].includes(reason.message) ? reason.message as GuideLoadFailure : 'retry'); setGuides(null); }
    }));
    return () => controller.abort();
  }, [load, attempt]);
  if (failure) {
    const message = failure === 'session' ? t.session : failure === 'denied' ? t.denied : failure === 'not_ready' ? t.notReady : t.retry;
    return <Notice lang={lang} text={message} retry={failure === 'session' ? undefined : () => { setFailure(null); setAttempt((value) => value + 1); }} retryLabel={t.again} />;
  }
  if (guides === null) return <Notice lang={lang} text={t.loading} />;
  const selected = guides.find((guide) => guide.guide_id === selectedId) ?? null;
  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="space-y-5">
    <header className="rounded-2xl border bg-white p-6"><h1 className="text-2xl font-bold text-[#102A43]">{t.title}</h1><p className="mt-2 text-sm text-[#52667A]">{t.subtitle}</p></header>
    {!guides.length ? <Notice lang={lang} text={t.empty} /> : <>
      <label className="block rounded-2xl border bg-white p-4"><span className="mb-2 block text-sm font-semibold text-[#102A43]">{t.choose}</span><select aria-label={t.choose} value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="w-full rounded-xl border p-3">{guides.map((guide) => <option key={guide.guide_id} value={guide.guide_id}>{guide.title}</option>)}</select></label>
      {selected?.can_edit ? <p role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">{t.viewOnly}</p> : null}
      <CustomerExperienceGuide key={`${workspaceId}:${selectedId}`} lang={lang} guide={selected ? toExperienceGuideView(selected, lang) : null} commands={null} />
    </>}
  </section>;
}

function Notice({ lang, text, retry, retryLabel }: { lang: Language; text: string; retry?: () => void; retryLabel?: string }) {
  return <div dir={lang === 'fa' ? 'rtl' : 'ltr'} role="status" className="rounded-2xl border bg-white p-8 text-center text-sm text-[#52667A]">{text}{retry ? <button type="button" onClick={retry} className="ms-3 rounded-xl bg-[#087A6E] px-4 py-2 font-semibold text-white">{retryLabel}</button> : null}</div>;
}
