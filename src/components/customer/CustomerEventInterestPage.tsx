'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Language } from '@/types';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { useCustomerContext } from './CustomerContextProvider';
import { CustomerEventInterest, type EventInterestCommands } from './CustomerEventInterest';
import {
  classifyEventResponse,
  eventReadResponseSchema,
  newEventCommandIdentity,
  toEventInterestView,
  type EventLoadFailure,
  type EventReadItem,
} from '@/lib/community/event-interest-client';

const copy = {
  ro: { title: 'Evenimente comunitare', subtitle: 'Vezi evenimentele eligibile și exprimă-ți interesul fără a crea o rezervare.', choose: 'Alege evenimentul', loading: 'Se încarcă evenimentele…', empty: 'Nu există evenimente eligibile în acest spațiu de lucru.', noContext: 'Alege mai întâi un context activ.', session: 'Sesiunea necesită verificare. Autentifică-te din nou.', denied: 'Modulul de evenimente sau permisiunea necesară nu este activă în acest spațiu de lucru.', notReady: 'Conexiunea operațională pentru evenimente nu este încă activată.', retry: 'Evenimentele nu au putut fi încărcate.', again: 'Încearcă din nou' },
  en: { title: 'Community events', subtitle: 'View eligible events and register interest without creating a booking.', choose: 'Choose an event', loading: 'Loading events…', empty: 'No eligible events are available in this workspace.', noContext: 'Choose an active context first.', session: 'Your session needs verification. Sign in again.', denied: 'The events module or required permission is not active in this workspace.', notReady: 'The operational events connection has not been activated yet.', retry: 'Events could not be loaded.', again: 'Try again' },
  fa: { title: 'رویدادهای جامعه', subtitle: 'رویدادهای مجاز را ببینید و بدون ایجاد رزرو علاقه‌مندی خود را ثبت کنید.', choose: 'انتخاب رویداد', loading: 'در حال دریافت رویدادها…', empty: 'در این فضای کاری رویداد واجد شرایطی وجود ندارد.', noContext: 'ابتدا یک زمینهٔ فعال انتخاب کنید.', session: 'نشست شما نیاز به بررسی دوباره دارد؛ دوباره وارد شوید.', denied: 'ماژول رویداد یا مجوز لازم در این فضای کاری فعال نیست.', notReady: 'اتصال عملیاتی رویدادها هنوز فعال نشده است.', retry: 'دریافت رویدادها ناموفق بود.', again: 'تلاش دوباره' },
} as const;

export function CustomerEventInterestPage({ lang }: { lang: Language }) {
  const { active, dashboard, loading } = useCustomerContext();
  const t = copy[lang];
  if (loading && (!active || !dashboard)) return <Notice lang={lang} text={t.loading} />;
  if (!active || !dashboard) return <Notice lang={lang} text={t.noContext} />;
  return <EventWorkspace key={`${active.context_id}:${dashboard.workspace_id}`} lang={lang} contextId={active.context_id} workspaceId={dashboard.workspace_id} />;
}

function EventWorkspace({ lang, contextId, workspaceId }: { lang: Language; contextId: string; workspaceId: string }) {
  const fetch = useDashboardFetch();
  const t = copy[lang];
  const [events, setEvents] = useState<EventReadItem[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [failure, setFailure] = useState<EventLoadFailure | null>(null);
  const [attempt, setAttempt] = useState(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`/api/customer/v1/community/events?${new URLSearchParams({ context_id: contextId, workspace_id: workspaceId })}`, {
      cache: 'no-store', credentials: 'same-origin', signal,
    });
    if (!response.ok) throw new Error(classifyEventResponse(response.status));
    const parsed = eventReadResponseSchema.parse(await response.json());
    if (parsed.workspace_id !== workspaceId) throw new Error('retry');
    if (!signal?.aborted) {
      setEvents(parsed.events);
      setSelectedId((current) => parsed.events.some((item) => item.event_id === current) ? current : parsed.events[0]?.event_id ?? '');
      setFailure(null);
    }
  }, [contextId, workspaceId, fetch]);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void load(controller.signal).catch((reason) => {
      if (!controller.signal.aborted) {
        const code = reason instanceof Error && ['session', 'denied', 'not_ready'].includes(reason.message) ? reason.message as EventLoadFailure : 'retry';
        setFailure(code);
        setEvents(null);
      }
    }));
    return () => controller.abort();
  }, [load, attempt]);

  const selected = events?.find((item) => item.event_id === selectedId) ?? null;
  const send = useCallback(async (payload: Record<string, unknown>) => {
    const response = await fetch('/api/customer/v1/community/events', {
      method: 'POST', credentials: 'same-origin', cache: 'no-store',
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!response.ok) {
      if (response.status === 409) await load();
      throw new Error(classifyEventResponse(response.status));
    }
  }, [fetch, load]);

  const commands = useMemo<EventInterestCommands | null>(() => selected ? {
    publish: (eventId, expectedVersion) => send({ ...newEventCommandIdentity(), type: 'publish_event', context_id: contextId, workspace_id: workspaceId, event_id: eventId, expected_version: expectedVersion, reason: 'Publish community event from customer workspace' }),
    cancel: (eventId, expectedVersion) => send({ ...newEventCommandIdentity(), type: 'cancel_event', context_id: contextId, workspace_id: workspaceId, event_id: eventId, expected_version: expectedVersion, reason: 'Cancel community event from customer workspace' }),
    registerInterest: (eventId, expectedVersion, expectedInterestVersion) => send({ ...newEventCommandIdentity(), type: 'register_interest', context_id: contextId, workspace_id: workspaceId, event_id: eventId, expected_version: expectedVersion, expected_interest_version: expectedInterestVersion, reason: 'Register own interest in community event' }),
    withdrawInterest: (eventId, expectedVersion, expectedInterestVersion) => send({ ...newEventCommandIdentity(), type: 'withdraw_interest', context_id: contextId, workspace_id: workspaceId, event_id: eventId, expected_version: expectedVersion, expected_interest_version: expectedInterestVersion, reason: 'Withdraw own interest from community event' }),
    recordAttendance: (input) => send({ ...newEventCommandIdentity(), type: 'record_attendance', context_id: contextId, workspace_id: workspaceId, event_id: input.event_id, expected_version: input.expected_version, target_membership_id: input.membership_id, observed_local: input.observed_local, timezone: input.timezone, reason: 'Record observed community event attendance' }),
  } : null, [selected, contextId, workspaceId, send]);

  if (failure) {
    const message = failure === 'session' ? t.session : failure === 'denied' ? t.denied : failure === 'not_ready' ? t.notReady : t.retry;
    return <Notice lang={lang} text={message} retry={failure === 'session' ? undefined : () => { setFailure(null); setAttempt((value) => value + 1); }} retryLabel={t.again} />;
  }
  if (events === null) return <Notice lang={lang} text={t.loading} />;

  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="space-y-5">
    <header className="rounded-2xl border bg-white p-6"><h1 className="text-2xl font-bold text-[#102A43]">{t.title}</h1><p className="mt-2 text-sm text-[#52667A]">{t.subtitle}</p></header>
    {!events.length ? <Notice lang={lang} text={t.empty} /> : <>
      <label className="block rounded-2xl border bg-white p-4"><span className="mb-2 block text-sm font-semibold text-[#102A43]">{t.choose}</span><select aria-label={t.choose} value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="w-full rounded-xl border p-3">{events.map((item) => <option key={item.event_id} value={item.event_id}>{item.title} · {new Intl.DateTimeFormat(lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: item.timezone }).format(new Date(item.starts_at))}</option>)}</select></label>
      <CustomerEventInterest key={`${workspaceId}:${selectedId}`} lang={lang} event={selected ? toEventInterestView(selected, lang) : null} commands={commands} eligibleAttendanceMembers={selected?.eligible_attendance_members ?? []} onChanged={() => { void load().catch(() => setFailure('retry')); }} />
    </>}
  </section>;
}

function Notice({ lang, text, retry, retryLabel }: { lang: Language; text: string; retry?: () => void; retryLabel?: string }) {
  return <div dir={lang === 'fa' ? 'rtl' : 'ltr'} role="status" className="rounded-2xl border bg-white p-8 text-center text-sm text-[#52667A]">{text}{retry ? <button type="button" onClick={retry} className="ms-3 rounded-xl bg-[#087A6E] px-4 py-2 font-semibold text-white">{retryLabel}</button> : null}</div>;
}
