'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Language } from '@/types';
import type { EventInterestCommands } from './CustomerEventInterest';
import { sameEventUuid, type EventReadItem } from '@/lib/community/event-interest-client';
import { attendanceReadUrl, parseAttendanceReadResponse, type AttendanceReadResponse } from '@/lib/community/event-attendance-client';

type CorrectionInput = Parameters<NonNullable<EventInterestCommands['correctAttendance']>>[0];
export type ProjectedAttendanceCorrection = {
  correction: { id: string; version: number; timezone: string; displayName: string };
  run: (input: CorrectionInput, dispatch: (input: CorrectionInput) => Promise<void>) => Promise<void>;
};
const copy = {
  en: { title: 'Previously recorded attendance', choose: 'Choose a recorded participant', empty: 'No named attendance targets are available in this scope.', loading: 'Loading attendance targets…', not_ready: 'The attendance read connection is not available yet.', denied: 'Attendance access is unavailable. Earlier details are hidden.', stale: 'The attendance or event version changed. Refresh current events before choosing again.', retry: 'Attendance targets could not be loaded.', refresh: 'Refresh attendance targets', next: 'Next attendance page', reason: 'Enter a correction reason of at least 5 characters.', cancel_reason: 'After cancellation, enter a correction reason of at least 12 characters.', snapshot: 'Recorded local time', present: 'Attended', absent: 'Did not attend' },
  ro: { title: 'Prezență înregistrată anterior', choose: 'Alege un participant înregistrat', empty: 'Nu există ținte de prezență cu nume disponibile în acest context.', loading: 'Se încarcă țintele de prezență…', not_ready: 'Conexiunea de citire a prezenței nu este încă disponibilă.', denied: 'Accesul la prezență nu este disponibil. Detaliile anterioare sunt ascunse.', stale: 'Versiunea prezenței sau a evenimentului s-a schimbat. Reîncarcă evenimentele înainte de o nouă alegere.', retry: 'Țintele de prezență nu au putut fi încărcate.', refresh: 'Reîncarcă țintele de prezență', next: 'Pagina următoare de prezență', reason: 'Introdu un motiv de corectare de cel puțin 5 caractere.', cancel_reason: 'După anulare, introdu un motiv de corectare de cel puțin 12 caractere.', snapshot: 'Ora locală înregistrată', present: 'Prezent', absent: 'Absent' },
  fa: { title: 'حضورهای ثبت‌شدهٔ قبلی', choose: 'انتخاب شرکت‌کنندهٔ ثبت‌شده', empty: 'هدف حضور نام‌داری در این زمینه در دسترس نیست.', loading: 'در حال دریافت هدف‌های حضور…', not_ready: 'اتصال خواندن حضور هنوز در دسترس نیست.', denied: 'دسترسی به حضور برقرار نیست. جزئیات قبلی پنهان شده‌اند.', stale: 'نسخهٔ حضور یا رویداد تغییر کرده است. پیش از انتخاب دوباره، رویدادها را بازخوانی کنید.', retry: 'دریافت هدف‌های حضور ممکن نشد.', refresh: 'بازخوانی هدف‌های حضور', next: 'صفحهٔ بعدی حضور', reason: 'دلیل اصلاح باید دست‌کم ۵ نویسه داشته باشد.', cancel_reason: 'پس از لغو، دلیل اصلاح باید دست‌کم ۱۲ نویسه داشته باشد.', snapshot: 'زمان محلی ثبت‌شده', present: 'حاضر', absent: 'غایب' },
} as const;

/** Read-only G1 connection. This owns no command, receipt, retry or recovery state. */
export function CustomerEventAttendanceTargets({ lang, contextId, event, enabled, locked, scopeOwner, current, fetch, denied, children }: {
  lang: Language; contextId: string; event: EventReadItem | null; enabled: boolean; locked: boolean;
  scopeOwner: object; current: () => boolean; fetch: typeof globalThis.fetch; denied: () => void;
  children: (projection: ProjectedAttendanceCorrection | null) => ReactNode;
}) {
  const t = copy[lang];
  const token = useMemo(() => ({ scopeOwner, contextId, event, enabled, lang, fetch }), [scopeOwner, contextId, event, enabled, lang, fetch]);
  const owner = useRef<object | null>(null), generation = useRef(0), admitted = useRef(false), selection = useRef('');
  const callbacks = useRef({ current, denied, locked });
  const [attempt, setAttempt] = useState(0);
  const [cursor, setCursor] = useState<{ token: object; after: string | null } | null>(null);
  const [view, setView] = useState<{ token: object; generation: number; response: AttendanceReadResponse | null; failure: string; selected: string } | null>(null);
  useLayoutEffect(() => { callbacks.current = { current, denied, locked }; });
  useLayoutEffect(() => {
    owner.current = token; admitted.current = false; selection.current = '';
    return () => { owner.current = null; admitted.current = false; generation.current += 1; };
  }, [token]);
  const after = cursor?.token === token ? cursor.after : null;
  const invalidate = () => { admitted.current = false; selection.current = ''; generation.current += 1; };
  useEffect(() => {
    const controller = new AbortController(), epoch = ++generation.current;
    admitted.current = false; selection.current = '';
    const valid = () => owner.current === token && generation.current === epoch && !controller.signal.aborted && callbacks.current.current();
    if (!enabled || !event || event.status === 'draft') return () => controller.abort();
    const request = { context_id: contextId, workspace_id: event.workspace_id, event_id: event.event_id,
      occurrence_id: event.occurrence_id, expected_event_version: event.version, limit: 25, after_attendance_id: after };
    queueMicrotask(async () => {
      if (!valid()) return;
      setView({ token, generation: epoch, response: null, failure: '', selected: '' });
      try {
        const response = await fetch(attendanceReadUrl(request), { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
        if (!valid()) return;
        if (!response.ok) throw new Error(response.status === 503 ? 'not_ready' : response.status === 409 ? 'stale'
          : [401, 403, 404].includes(response.status) ? 'denied' : 'retry');
        const data = parseAttendanceReadResponse(await response.json(), request, event);
        if (!valid()) return;
        admitted.current = true;
        setView(previous => valid() ? { token, generation: epoch, response: data, failure: '', selected: '' } : previous);
      } catch (error) {
        if (!valid()) return;
        admitted.current = false;
        const failure = error instanceof Error && ['not_ready', 'stale', 'denied'].includes(error.message) ? error.message : 'retry';
        setView(previous => valid() ? { token, generation: epoch, response: null, failure, selected: '' } : previous);
        if (failure === 'denied') callbacks.current.denied();
      }
    });
    return () => { controller.abort(); if (generation.current === epoch) invalidate(); };
  }, [contextId, event, enabled, token, fetch, after, attempt]);
  const visible = enabled && event && event.status !== 'draft' && view?.token === token ? view : null;
  const response = visible?.response;
  const target = response?.targets.find(row => sameEventUuid(row.attendance_id, visible?.selected));
  const isCurrent = () => owner.current === token && admitted.current && visible?.generation === generation.current
    && callbacks.current.current() && !callbacks.current.locked;
  const projection: ProjectedAttendanceCorrection | null = target && response && event ? {
    correction: { id: target.attendance_id, version: target.attendance_version, timezone: response.timezone, displayName: target.display_name },
    async run(input, dispatch) {
      if (!isCurrent() || !sameEventUuid(selection.current, target.attendance_id)
        || !sameEventUuid(input.attendance_id, target.attendance_id) || input.expected_attendance_version !== target.attendance_version
        || !sameEventUuid(input.event_id, response.event_id) || input.expected_version !== response.event_version
        || input.timezone !== response.timezone) return;
      // Consume the existing SQL length(reason) policy without changing the
      // command/lifecycle ABI. UTF-16 form minLength alone overcounts emoji.
      if (Array.from(input.reason.trim()).length < (response.event_status === 'cancelled' ? 12 : 5)) {
        setView(previous => previous?.token === token && sameEventUuid(previous.selected, target.attendance_id)
          ? { ...previous, failure: response.event_status === 'cancelled' ? 'cancel_reason' : 'reason' } : previous);
        return;
      }
      setView(previous => previous?.token === token ? { ...previous, failure: '' } : previous);
      await dispatch(input);
    },
  } : null;
  return <>
    {enabled && event && event.status !== 'draft' ? <section data-attendance-projection dir={lang === 'fa' ? 'rtl' : 'ltr'} aria-label={t.title}>
      <h3>{t.title}</h3>
      <p role="status" aria-live="polite" data-correction-not-ready={!response ? true : undefined}>{visible?.failure ? t[visible.failure as 'not_ready' | 'stale' | 'denied' | 'retry' | 'reason' | 'cancel_reason'] : !response ? t.loading : response.targets.length === 0 ? t.empty : ''}</p>
      <button data-attendance-refresh type="button" disabled={locked} onClick={() => {
        if (callbacks.current.locked || !callbacks.current.current()) return;
        invalidate(); setView(null); setCursor(null); setAttempt(n => n + 1);
      }}>{t.refresh}</button>
      {response ? <>
        <label>{t.choose}<select data-attendance-target disabled={locked} value={visible?.selected ?? ''} onChange={e => {
          if (!isCurrent()) return;
          const id = response.targets.find(row => sameEventUuid(row.attendance_id, e.target.value))?.attendance_id ?? '';
          selection.current = id; setView(previous => previous?.token === token && previous.generation === visible?.generation ? { ...previous, selected: id, failure: '' } : previous);
        }}><option value="">{t.choose}</option>{response.targets.map(row => <option key={row.attendance_id} value={row.attendance_id}>{row.display_name}</option>)}</select></label>
        {target ? <p data-attendance-snapshot>{target.display_name} · {target.attended ? t.present : t.absent} · {t.snapshot}: {target.observed_local} · {response.timezone}</p> : null}
        {response.next_cursor ? <button data-attendance-next type="button" disabled={locked} onClick={() => {
          if (!isCurrent()) return;
          invalidate(); setView(null); setCursor({ token, after: response.next_cursor });
        }}>{t.next}</button> : null}
      </> : null}
    </section> : null}
    <AttendanceContent projection={projection}>{children}</AttendanceContent>
  </>;
}

// Render composition stays a React component boundary; the projection contains
// data and an event-only dispatch capability, never a ref read during rendering.
function AttendanceContent({ projection, children }: { projection: ProjectedAttendanceCorrection | null; children: (projection: ProjectedAttendanceCorrection | null) => ReactNode }) {
  return children(projection);
}
