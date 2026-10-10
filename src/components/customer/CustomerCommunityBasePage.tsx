'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Language } from '@/types';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { useCustomerContext } from './CustomerContextProvider';
import { CustomerCommunityBase, type CommunityBaseCommands, type CommunityBaseView } from './CustomerCommunityBase';
import { classifyCommunityResponse, communityReadResponseSchema, newCommunityCommandIdentity, toCommunityViews, type CommunityLoadFailure } from '@/lib/community/community-base-client';

const copy = {
  ro: { title: 'Comunitate', subtitle: 'Consultă anunțurile comunității și folosește numai acțiunile autorizate pentru contextul activ.', choose: 'Alege comunitatea', loading: 'Se încarcă comunitatea…', empty: 'Nu există comunități eligibile în acest spațiu de lucru.', noContext: 'Alege mai întâi un context activ.', session: 'Sesiunea necesită verificare. Autentifică-te din nou.', denied: 'Modulul Comunitate sau permisiunea necesară nu este activă în acest spațiu de lucru.', notReady: 'Conexiunea operațională pentru Comunitate nu este încă activată.', retry: 'Comunitatea nu a putut fi încărcată.', again: 'Încearcă din nou' },
  en: { title: 'Community', subtitle: 'Read community announcements and use only the actions authorized for the active context.', choose: 'Choose a community', loading: 'Loading community…', empty: 'No eligible communities are available in this workspace.', noContext: 'Choose an active context first.', session: 'Your session needs verification. Sign in again.', denied: 'The Community module or required permission is not active in this workspace.', notReady: 'The operational Community connection has not been activated yet.', retry: 'Community could not be loaded.', again: 'Try again' },
  fa: { title: 'جامعه', subtitle: 'اعلان‌های جامعه را ببینید و فقط اقدام‌های مجاز در زمینهٔ فعال را انجام دهید.', choose: 'انتخاب جامعه', loading: 'در حال دریافت جامعه…', empty: 'در این فضای کاری جامعهٔ واجد شرایطی وجود ندارد.', noContext: 'ابتدا یک زمینهٔ فعال انتخاب کنید.', session: 'نشست شما نیاز به بررسی دوباره دارد؛ دوباره وارد شوید.', denied: 'ماژول جامعه یا مجوز لازم در این فضای کاری فعال نیست.', notReady: 'اتصال عملیاتی جامعه هنوز فعال نشده است.', retry: 'دریافت جامعه ناموفق بود.', again: 'تلاش دوباره' },
} as const;

export function CustomerCommunityBasePage({ lang }: { lang: Language }) {
  const { active, dashboard, loading } = useCustomerContext(); const t = copy[lang];
  if (loading && (!active || !dashboard)) return <Notice lang={lang} text={t.loading} />;
  if (!active || !dashboard) return <Notice lang={lang} text={t.noContext} />;
  return <CommunityWorkspace key={`${active.context_id}:${dashboard.workspace_id}`} lang={lang} contextId={active.context_id} workspaceId={dashboard.workspace_id} />;
}

function CommunityWorkspace({ lang, contextId, workspaceId }: { lang: Language; contextId: string; workspaceId: string }) {
  const fetch = useDashboardFetch(); const t = copy[lang];
  const [communities, setCommunities] = useState<CommunityBaseView[] | null>(null); const [selectedId, setSelectedId] = useState('');
  const [failure, setFailure] = useState<CommunityLoadFailure | null>(null); const [attempt, setAttempt] = useState(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/customer/v1/community/base?${new URLSearchParams({ context_id: contextId, workspace_id: workspaceId })}`, { cache: 'no-store', credentials: 'same-origin', signal });
    if (!response.ok) throw new Error(classifyCommunityResponse(response.status));
    const parsed = communityReadResponseSchema.parse(await response.json());
    if (parsed.workspace_id !== workspaceId || parsed.communities.some((community) => community.workspace_id !== workspaceId)) throw new Error('retry');
    const next = toCommunityViews(parsed, lang);
    if (!signal?.aborted) { setCommunities(next); setSelectedId((current) => next.some((community) => community.community_id === current) ? current : next[0]?.community_id ?? ''); setFailure(null); }
  }, [contextId, workspaceId, fetch, lang]);
  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void load(controller.signal).catch((reason) => {
      if (!controller.signal.aborted) { setFailure(reason instanceof Error && ['session', 'denied', 'not_ready'].includes(reason.message) ? reason.message as CommunityLoadFailure : 'retry'); setCommunities(null); }
    }));
    return () => controller.abort();
  }, [load, attempt]);
  const selected = communities?.find((community) => community.community_id === selectedId) ?? null;
  const send = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/customer/v1/community/base', { method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!response.ok) { if (response.status === 409) await load(); throw new Error(classifyCommunityResponse(response.status)); }
  }, [fetch, load]);
  const commands = useMemo<CommunityBaseCommands | null>(() => selected ? {
    createAnnouncement: ({ community_id, body }) => send({ ...newCommunityCommandIdentity(), type: 'create_announcement', context_id: contextId, workspace_id: workspaceId, community_id, announcement_id: crypto.randomUUID(), expected_version: selected.version, body, audience: { kind: 'workspace' }, reason: 'Create Community announcement draft from customer workspace' }),
    publishAnnouncement: ({ community_id, announcement_id, expected_version }) => send({ ...newCommunityCommandIdentity(), type: 'publish_announcement', context_id: contextId, workspace_id: workspaceId, community_id, announcement_id, expected_version, reason: 'Publish Community announcement from customer workspace' }),
    cancelAnnouncement: ({ community_id, announcement_id, expected_version }) => send({ ...newCommunityCommandIdentity(), type: 'cancel_announcement', context_id: contextId, workspace_id: workspaceId, community_id, announcement_id, expected_version, reason: 'Cancel Community announcement from customer workspace' }),
    reportContent: ({ community_id, announcement_id, reason }) => send({ ...newCommunityCommandIdentity(), type: 'report_content', context_id: contextId, workspace_id: workspaceId, community_id, report_id: crypto.randomUUID(), target_type: 'announcement', target_id: announcement_id, expected_version: 0, report_reason: reason, reason: 'Report Community announcement from customer workspace' }),
    decideReport: ({ community_id, report_id, expected_version, decision, reason }) => send({ ...newCommunityCommandIdentity(), type: 'decide_content_report', context_id: contextId, workspace_id: workspaceId, community_id, report_id, expected_version, decision, decision_reason: reason, reason: 'Decide Community content report from customer workspace' }),
  } : null, [selected, contextId, workspaceId, send]);
  if (failure) { const message = failure === 'session' ? t.session : failure === 'denied' ? t.denied : failure === 'not_ready' ? t.notReady : t.retry; return <Notice lang={lang} text={message} retry={failure === 'session' ? undefined : () => { setFailure(null); setAttempt((value) => value + 1); }} retryLabel={t.again} />; }
  if (communities === null) return <Notice lang={lang} text={t.loading} />;
  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="space-y-5"><header className="rounded-2xl border bg-white p-6"><h1 className="text-2xl font-bold text-[#102A43]">{t.title}</h1><p className="mt-2 text-sm text-[#52667A]">{t.subtitle}</p></header>{!communities.length ? <Notice lang={lang} text={t.empty} /> : <><label className="block rounded-2xl border bg-white p-4"><span className="mb-2 block text-sm font-semibold text-[#102A43]">{t.choose}</span><select aria-label={t.choose} value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="w-full rounded-xl border p-3">{communities.map((community) => <option key={community.community_id} value={community.community_id}>{community.name}</option>)}</select></label><CustomerCommunityBase key={`${workspaceId}:${selectedId}`} lang={lang} view={selected} commands={commands} onChanged={() => { void load().catch(() => setFailure('retry')); }} /></>}</section>;
}

function Notice({ lang, text, retry, retryLabel }: { lang: Language; text: string; retry?: () => void; retryLabel?: string }) {
  return <div dir={lang === 'fa' ? 'rtl' : 'ltr'} role="status" className="rounded-2xl border bg-white p-8 text-center text-sm text-[#52667A]">{text}{retry ? <button type="button" onClick={retry} className="ms-3 rounded-xl bg-[#087A6E] px-4 py-2 font-semibold text-white">{retryLabel}</button> : null}</div>;
}
