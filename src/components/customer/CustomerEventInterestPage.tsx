'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '@/types';
import { useDashboardFetch } from '@/components/dashboard-lab/DashboardTransport';
import { useCustomerContext } from './CustomerContextProvider';
import { CustomerEventInterest, type EventInterestCommands } from './CustomerEventInterest';
import { CustomerEventAttendanceTargets } from './CustomerEventAttendanceTargets';
import {
  classifyEventResponse, eventReadResponseSchema, eventUuidKey, sameEventUuid, newEventCommandIdentity, toEventInterestView,
  createEventCommandSession, type EventExecutionState, type EventCommand, type EventReadItem,
} from '@/lib/community/event-interest-client';

const copy = {
  en: { title: 'Community events', subtitle: 'Registering interest is not a booking and does not guarantee admission.', choose: 'Choose an event', loading: 'Loading events…', empty: 'No eligible events.', noContext: 'Choose an active context first.', session: 'Sign in again before checking events.', denied: 'Event access is unavailable. Previously loaded details are hidden.', not_ready: 'The operational events connection has not been activated yet.', retry: 'Events could not be loaded.', again: 'Refresh current events', create: 'Create event draft', name: 'Event title', start: 'Start (UTC)', end: 'End (UTC)', zone: 'IANA timezone', reason: 'Reason', save: 'Save event draft', unknown: 'The request result is not yet known. Your exact request is retained for this page lifetime. Refresh is only a current read, not proof of this command. Reload or another device cannot recover this pending request.', replay: 'Explicitly resend the same request (may apply it if not recorded)', rejected: 'The request was rejected. Your input is preserved.', reset: 'Edit after rejection', sending: 'Sending…', done: 'Command result confirmed. Current event details are read separately.', invalid: 'Check the event values and end time.', lookup: 'Check the recorded result explicitly; an unresolved lookup proves no failure. Do not start a replacement command while the result is unknown.', correctionGap: 'Earlier attendance records cannot be selected with the current server projection. Only a record confirmed on this page can be corrected.' },
  ro: { title: 'Evenimente comunitare', subtitle: 'Exprimarea interesului nu reprezintă o rezervare și nu garantează accesul.', choose: 'Alege evenimentul', loading: 'Se încarcă evenimentele…', empty: 'Nu există evenimente eligibile.', noContext: 'Alege mai întâi un context activ.', session: 'Autentifică-te din nou înainte de verificare.', denied: 'Accesul la evenimente nu este disponibil. Detaliile anterioare sunt ascunse.', not_ready: 'Conexiunea operațională pentru evenimente nu este încă activată.', retry: 'Evenimentele nu au putut fi încărcate.', again: 'Reîncarcă starea curentă', create: 'Creează ciornă de eveniment', name: 'Titlul evenimentului', start: 'Început (UTC)', end: 'Sfârșit (UTC)', zone: 'Fus orar IANA', reason: 'Motiv', save: 'Salvează ciorna', unknown: 'Rezultatul cererii nu este încă cunoscut. Cererea identică este păstrată cât timp pagina rămâne deschisă. Reîncărcarea listei arată starea curentă, nu dovada acestei comenzi. Reîncărcarea paginii sau alt dispozitiv nu poate recupera cererea în așteptare.', replay: 'Retrimite explicit aceeași cerere (o poate aplica dacă nu a fost înregistrată)', rejected: 'Cererea a fost respinsă. Datele introduse au fost păstrate.', reset: 'Editează după respingere', sending: 'Se trimite…', done: 'Rezultatul comenzii este confirmat. Starea curentă se citește separat.', invalid: 'Verifică valorile și ora de sfârșit.', lookup: 'Verifică explicit rezultatul înregistrat; un rezultat nerezolvat nu dovedește eșecul. Nu începe o comandă nouă cât timp rezultatul este necunoscut.', correctionGap: 'Înregistrările de prezență anterioare nu pot fi selectate prin proiecția curentă. Poți corecta doar o înregistrare confirmată pe această pagină.' },
  fa: { title: 'رویدادهای جامعه', subtitle: 'ثبت علاقه به معنی رزرو یا تضمین ورود نیست.', choose: 'انتخاب رویداد', loading: 'در حال دریافت رویدادها…', empty: 'رویداد مجازی وجود ندارد.', noContext: 'ابتدا زمینهٔ فعال را انتخاب کنید.', session: 'پیش از بررسی دوباره وارد شوید.', denied: 'دسترسی به رویدادها برقرار نیست. جزئیات قبلی پنهان شده‌اند.', not_ready: 'اتصال عملیاتی رویدادها هنوز فعال نشده است.', retry: 'دریافت رویدادها ممکن نشد.', again: 'بازخوانی وضعیت فعلی', create: 'ایجاد پیش‌نویس رویداد', name: 'عنوان رویداد', start: 'شروع (UTC)', end: 'پایان (UTC)', zone: 'منطقهٔ زمانی IANA', reason: 'دلیل', save: 'ذخیرهٔ پیش‌نویس', unknown: 'نتیجه درخواست هنوز مشخص نیست. همان درخواست تا زمانی که این صفحه باز است حفظ می‌شود. بازخوانی فقط وضعیت فعلی را نشان می‌دهد، نه اثبات نتیجهٔ این فرمان. پس از بارگذاری مجدد صفحه یا در دستگاه دیگر، درخواست معلق قابل‌بازیابی نیست.', replay: 'ارسال صریح همان درخواست (اگر ثبت نشده باشد ممکن است اجرا شود)', rejected: 'درخواست رد شد. ورودی شما حفظ شده است.', reset: 'ویرایش پس از رد درخواست', sending: 'در حال ارسال…', done: 'نتیجهٔ فرمان تأیید شد. وضعیت فعلی رویداد جداگانه خوانده می‌شود.', invalid: 'مقادیر و زمان پایان را بررسی کنید.', lookup: 'نتیجهٔ ثبت‌شده را صریح بررسی کنید؛ نتیجهٔ نامشخص، شکست را ثابت نمی‌کند. تا نتیجه نامعلوم است فرمان جایگزین شروع نکنید.', correctionGap: 'با خروجی فعلی سرور نمی‌توان سوابق حضور قبلی را انتخاب کرد. فقط حضور تأییدشده در همین صفحه قابل‌اصلاح است.' },
} as const;

type Session = ReturnType<typeof createEventCommandSession>;
type KnownAttendance = { eventId: string; id: string; version: number; timezone: string; membershipId: string };
type Bridge = { owner: () => object | null; fetch: typeof globalThis.fetch; publish: (state: EventExecutionState) => void; accepted: (command: EventCommand) => void; denied: () => void };
type Slot = { session: Session; attendance: Map<string, KnownAttendance>; bridge: Bridge; drafts: Map<string, Record<string, string>> };

export function CustomerEventInterestPage({ lang }: { lang: Language }) {
  const context = useCustomerContext();
  const { active, dashboard, loading } = context;
  const fetch = useDashboardFetch();
  const [sessions] = useState(() => new Map<string, Slot>());
  // Layout lifetime, not passive cleanup: an old continuation cannot publish into
  // same-tuple loading, a permission update, locale replacement or a new Context.
  const owner = useRef<object | null>(null);
  const token = useMemo(() => ({ active, dashboard, loading, lang }), [active, dashboard, loading, lang]);
  useLayoutEffect(() => {
    owner.current = token;
    return () => { owner.current = null; sessions.forEach(slot => slot.session.invalidate()); };
  }, [token, sessions]);
  const current = useCallback(() => owner.current === token && !loading && Boolean(active && dashboard && sameEventUuid(dashboard.contextId, active.context_id) && eventUuidKey(active.membership_id) !== null && eventUuidKey(dashboard.workspace_id) !== null), [token, loading, active, dashboard]);
  const binding = active && dashboard ? JSON.stringify([eventUuidKey(active.context_id), eventUuidKey(active.membership_id), eventUuidKey(dashboard.workspace_id)]) : '';
  if (!active || !dashboard || !sameEventUuid(dashboard.contextId, active.context_id) || !eventUuidKey(active.membership_id) || !eventUuidKey(dashboard.workspace_id)) return <Notice lang={lang} text={loading ? copy[lang].loading : copy[lang].noContext} />;
  // Keep workspace/form state on same-tuple loading; hide it and revoke admission.
  return <EventWorkspace key={binding} lang={lang} contextId={active.context_id} workspaceId={dashboard.workspace_id}
    permissions={dashboard.permissions} suspended={loading} binding={binding} sessions={sessions} fetch={fetch} current={current} />;
}

function EventWorkspace({ lang, contextId, workspaceId, permissions, suspended, binding, sessions, fetch, current }: {
  lang: Language; contextId: string; workspaceId: string; permissions: string[]; suspended: boolean;
  binding: string; sessions: Map<string, Slot>; fetch: typeof globalThis.fetch; current: () => boolean;
}) {
  const t = copy[lang];
  const [events, setEvents] = useState<EventReadItem[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [failure, setFailure] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [, render] = useState(0);
  const [execution, setExecution] = useState<EventExecutionState>({ phase: 'ready', pending: null, receipt: null, uncertain: false });
  const callbacks = useRef({ current, fetch, accepted: (_command: EventCommand) => {}, denied: () => {} });
  const viewOwner = useRef<object | null>(null);
  const viewToken = useMemo(() => ({ current, lang, permissions, suspended }), [current, lang, permissions, suspended]);
  const readGeneration = useRef(0);
  const readAdmission = useRef(false);
  // Invalidate before scheduling ANY restart, not only in passive setup/abort.
  // Old response/decode/queued state updaters must belong to this exact epoch.
  function invalidateRead() {
    readAdmission.current = false;
    return ++readGeneration.current;
  }
  function bridge(): Bridge { return ({
    owner: () => readAdmission.current && callbacks.current.current() && viewOwner.current ? viewOwner.current : null,
    fetch: (...args) => callbacks.current.fetch(...args),
    publish: state => { setExecution(state); render(n => n + 1); },
    accepted: command => callbacks.current.accepted(command), denied: () => callbacks.current.denied(),
  }); }
  // Commit-time publication fence is updated before promise continuations run.
  useLayoutEffect(() => {
    invalidateRead();
    callbacks.current = { current, fetch, accepted(command) {
      invalidateRead();
      if (command.type === 'create_event') setSelectedId(command.event_id);
      setAttempt(n => n + 1);
    }, denied() { invalidateRead(); setEvents(null); setFailure('denied'); } };
    viewOwner.current = viewToken;
    const existing = sessions.get(binding);
    if (existing) Object.assign(existing.bridge, bridge());
    return () => { invalidateRead(); viewOwner.current = null; sessions.get(binding)?.session.invalidate(); };
  }, [binding, sessions, viewToken, current, fetch]);
  const getSlot = () => {
    let slot = sessions.get(binding);
    if (!slot) {
      const attendance = new Map<string, KnownAttendance>(), relay = bridge();
      const session = createEventCommandSession({ contextId, workspaceId,
        fetch: (...args) => relay.fetch(...args),
        owner: () => relay.owner(),
        onState: state => relay.publish(state),
        denied: () => relay.denied(),
        accepted(command, result) {
          const prior = attendance.get(eventUuidKey(command.event_id)!);
          if (command.type === 'record_attendance' || (command.type === 'correct_attendance' && prior && sameEventUuid(prior.id, result.entity_id))) {
            // A G1 target may predate this page. It is read again from the projection;
            // do not invent a same-page membership binding from a correction receipt.
            attendance.set(eventUuidKey(command.event_id)!, { eventId: command.event_id, id: result.entity_id, version: result.version, timezone: command.timezone, membershipId: command.type === 'record_attendance' ? command.target_membership_id : prior!.membershipId });
          }
          relay.accepted(command);
        },
      });
      slot = { session, attendance, bridge: relay, drafts: new Map() }; sessions.set(binding, slot);
    }
    return slot;
  };

  useEffect(() => {
    const controller = new AbortController(), generation = invalidateRead();
    const view = viewOwner.current;
    const valid = () => !controller.signal.aborted && readGeneration.current === generation && viewOwner.current === view && callbacks.current.current();
    if (suspended) return () => controller.abort();
    readAdmission.current = false;
    queueMicrotask(async () => {
      if (!valid()) return;
      setEvents(null);
      try {
        const response = await fetch(`/api/customer/v1/community/events?${new URLSearchParams({ context_id: contextId, workspace_id: workspaceId })}`, { cache: 'no-store', credentials: 'same-origin', signal: controller.signal });
        if (!valid()) return;
        if (!response.ok) throw new Error(classifyEventResponse(response.status));
        const parsed = eventReadResponseSchema.parse(await response.json());
        if (!sameEventUuid(parsed.workspace_id, workspaceId)) throw new Error('retry');
        if (!valid()) return;
        readAdmission.current = true;
        setEvents(previous => valid() ? parsed.events : previous); setFailure(previous => valid() ? '' : previous);
        setSelectedId(id => valid() ? parsed.events.find(item => sameEventUuid(item.event_id, id))?.event_id ?? parsed.events[0]?.event_id ?? '' : id);
        const slot = sessions.get(binding); if (slot) setExecution(slot.session.getState());
      } catch (error) {
        if (!valid()) return;
        setEvents(previous => valid() ? null : previous); setFailure(previous => !valid() ? previous : error instanceof Error && ['session', 'denied', 'not_ready'].includes(error.message) ? error.message : 'retry');
      }
    });
    return () => { if (valid()) invalidateRead(); controller.abort(); };
  }, [contextId, workspaceId, fetch, attempt, suspended, lang, permissions, sessions, binding]);

  const slot = sessions.get(binding);
  const state = slot?.session.getState() ?? execution;
  const locked = suspended || events === null || Boolean(state.pending);
  const selected = events?.find(item => sameEventUuid(item.event_id, selectedId)) ?? null;
  async function send(type: EventCommand['type'], fields: Record<string, unknown>) {
    if (locked || !readAdmission.current || !current() || !viewOwner.current || getSlot().session.getState().pending) return;
    const accepted = await getSlot().session.send({ ...newEventCommandIdentity(), context_id: contextId, workspace_id: workspaceId, reason: 'Customer event workspace command', ...fields, type });
    if (!accepted) return;
  }
  const commands: EventInterestCommands = {
    publish: (event_id, expected_version) => send('publish_event', { event_id, expected_version }),
    cancel: (event_id, expected_version) => send('cancel_event', { event_id, expected_version }),
    registerInterest: (event_id, expected_version, expected_interest_version) => send('register_interest', { event_id, expected_version, expected_interest_version }),
    withdrawInterest: (event_id, expected_version, expected_interest_version) => send('withdraw_interest', { event_id, expected_version, expected_interest_version }),
    recordAttendance: input => send('record_attendance', { event_id: input.event_id, expected_version: input.expected_version, target_membership_id: input.membership_id, observed_local: input.observed_local, timezone: input.timezone }),
    correctAttendance: input => send('correct_attendance', input),
  };
  const knownAttendance = selected ? slot?.attendance.get(eventUuidKey(selected.event_id)!) : undefined;
  const correctionMember = selected?.eligible_attendance_members.find(member => sameEventUuid(member.membership_id, knownAttendance?.membershipId));
  const correction = knownAttendance && correctionMember && permissions.includes('events.attendance.correct') ? { ...knownAttendance, displayName: correctionMember.display_name } : undefined;
  const message = state.phase === 'sending' ? t.sending : state.phase === 'unknown' || state.phase === 'blocked' ? t.unknown
    : state.phase === 'rejected' ? t.rejected : state.phase === 'done' ? t.done : '';
  const canReplay = events !== null && !suspended && state.phase === 'unknown';
  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="space-y-5">
    <header><h1>{t.title}</h1><p>{t.subtitle}</p></header>
    <p role="status" aria-live="polite" data-command-status>{message}</p>
    {state.pending ? <p>{t.lookup}</p> : null}
    {canReplay ? <button data-command-lookup type="button" onClick={() => void slot?.session.lookup()}>{lang === 'fa' ? 'بررسی نتیجهٔ ثبت‌شده (بدون ارسال دوباره)' : lang === 'ro' ? 'Verifică rezultatul înregistrat (fără retrimitere)' : 'Check recorded result (without resending)'}</button> : null}
    {state.pending && state.failure === 'not_ready' ? <p role="status">{t.not_ready}</p> : null}
    {canReplay ? <button data-command-replay type="button" onClick={() => void slot?.session.replay()}>{t.replay}</button> : null}
    {state.phase === 'rejected' && events !== null ? <button data-command-reset type="button" onClick={() => slot?.session.resetRejected()}>{t.reset}</button> : null}
    <button data-event-refresh type="button" disabled={suspended || state.phase === 'sending'} onClick={() => { invalidateRead(); setEvents(null); setAttempt(n => n + 1); }}>{t.again}</button>
    {suspended ? <Notice lang={lang} text={t.loading} /> : failure ? <Notice lang={lang} text={failure === 'session' ? t.session : failure === 'denied' ? t.denied : failure === 'not_ready' ? t.not_ready : t.retry} /> : events === null ? <Notice lang={lang} text={t.loading} /> : null}
    <div hidden={suspended || Boolean(failure) || events === null}>
      {permissions.includes('events.event.publish') ? <CreateEventForm lang={lang} draft={slot?.drafts.get('create')} onDraft={draft => getSlot().drafts.set('create', draft)} locked={locked} canEdit={() => !getSlot().session.getState().pending && readAdmission.current && current()} submit={fields => send('create_event', fields)} /> : null}
      {events?.length === 0 ? <p>{t.empty}</p> : null}
      <label>{t.choose}<select data-event-select disabled={Boolean(state.pending)} value={selectedId} onChange={e => { if (!getSlot().session.getState().pending && readAdmission.current && current()) setSelectedId(e.target.value); }}>{events?.map(item => <option key={item.event_id} value={item.event_id}>{item.title}</option>)}</select></label>
      <CustomerEventAttendanceTargets lang={lang} contextId={contextId} event={selected} scopeOwner={viewToken}
        enabled={permissions.includes('events.event.read') && permissions.includes('events.attendance.correct')}
        locked={locked} fetch={fetch} current={() => readAdmission.current && current() && !suspended}
        denied={() => callbacks.current.denied()}>
        {projection => {
          const draftKey = projection ? `correction:${eventUuidKey(projection.correction.id)}` : eventUuidKey(selectedId) ?? selectedId;
          return <CustomerEventInterest key={draftKey} lang={lang} event={selected ? toEventInterestView(selected, lang) : null}
            commands={projection ? { ...commands, correctAttendance: input => projection.run(input, commands.correctAttendance!) } : commands}
            eligibleAttendanceMembers={selected?.eligible_attendance_members ?? []} draft={sessions.get(binding)?.drafts.get(draftKey)}
            onDraft={draft => getSlot().drafts.set(draftKey, draft)} execution={state}
            canEdit={() => !getSlot().session.getState().pending && readAdmission.current && current()}
            correction={projection?.correction ?? correction} />;
        }}
      </CustomerEventAttendanceTargets>
    </div>
  </section>;
}

function CreateEventForm({ lang, locked, canEdit, submit, draft, onDraft }: { lang: Language; locked: boolean; canEdit: () => boolean; submit: (fields: Record<string, unknown>) => Promise<void>; draft?: Record<string, string>; onDraft: (fields: Record<string, string>) => void }) {
  const t = copy[lang];
  const [fields, setFields] = useState(draft ?? { title: '', starts_at: '', ends_at: '', timezone: 'Europe/Bucharest', reason: '' });
  const [invalid, setInvalid] = useState(false);
  return <form data-create-event aria-label={t.create} onSubmit={e => { e.preventDefault(); if (!canEdit() || locked) return;
    try {
      const starts_at = new Date(fields.starts_at + ':00Z').toISOString(), ends_at = new Date(fields.ends_at + ':00Z').toISOString();
      if (Date.parse(ends_at) <= Date.parse(starts_at) || fields.title.trim().length < 2 || fields.reason.trim().length < 5) throw new Error('invalid');
      setInvalid(false);
      void submit({ ...fields, starts_at, ends_at, expected_version: 0, event_id: crypto.randomUUID(), occurrence_id: crypto.randomUUID(), community_ref: null, audience: { kind: 'workspace' } }).catch(() => { if (canEdit()) setInvalid(true); });
    } catch { setInvalid(true); }
  }}><h2>{t.create}</h2>{invalid ? <p role="alert">{t.invalid}</p> : null}<fieldset disabled={locked}>
    {(['title', 'starts_at', 'ends_at', 'timezone', 'reason'] as const).map(name => <label key={name}>{name === 'title' ? t.name : name === 'starts_at' ? t.start : name === 'ends_at' ? t.end : name === 'timezone' ? t.zone : t.reason}<input data-create-field={name} type={name.endsWith('_at') ? 'datetime-local' : 'text'} required value={fields[name]} onChange={e => { if (canEdit()) setFields(f => { const next = { ...f, [name]: e.target.value }; onDraft(next); return next; }); }} /></label>)}
    <button type="submit">{t.save}</button>
  </fieldset></form>;
}
function Notice({ lang, text }: { lang: Language; text: string }) {
  return <div dir={lang === 'fa' ? 'rtl' : 'ltr'} role="status">{text}</div>;
}
