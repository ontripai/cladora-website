'use client';

import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Language } from '@/types';
import { eventUuidKey, sameEventUuid, type EventExecutionState } from '@/lib/community/event-interest-client';

export interface EventInterestView {
  event_id: string;
  workspace_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: 'draft' | 'published' | 'cancelled';
  audience_label: string;
  version: number;
  interest_status: 'interested' | 'withdrawn' | null;
  interest_version: number;
  can_publish: boolean;
  can_cancel: boolean;
  can_register_interest: boolean;
  can_withdraw_interest: boolean;
  can_record_attendance: boolean;
}

export interface EligibleAttendanceMember {
  membership_id: string;
  display_name: string;
}

export interface EventInterestCommands {
  publish(eventId: string, expectedVersion: number): Promise<void>;
  cancel(eventId: string, expectedVersion: number): Promise<void>;
  registerInterest(eventId: string, expectedVersion: number, expectedInterestVersion: number): Promise<void>;
  withdrawInterest(eventId: string, expectedVersion: number, expectedInterestVersion: number): Promise<void>;
  correctAttendance?(input: { event_id: string; expected_version: number; attendance_id: string; expected_attendance_version: number; attended: boolean; observed_local: string; timezone: string; reason: string }): Promise<void>;
  recordAttendance(input: { event_id: string; expected_version: number; membership_id: string; observed_local: string; timezone: string }): Promise<void>;
}

const copy = {
  ro: { title: 'Eveniment', when: 'Data și ora', audience: 'Public', draft: 'Ciornă', published: 'Publicat', cancelled: 'Anulat', publish: 'Publică', cancel: 'Anulează evenimentul', interested: 'Sunt interesat(ă)', withdraw: 'Retrage interesul', notice: 'Exprimarea interesului nu reprezintă o rezervare și nu garantează accesul.', attendance: 'Înregistrare manuală a prezenței', member: 'Alege participantul', observed: 'Ora locală a evenimentului', record: 'Înregistrează prezența', retry: 'Operațiunea nu a reușit. Datele introduse au fost păstrate.', pending: 'Evenimentele nu sunt disponibile momentan.', chooseMember: 'Alege un participant eligibil' },
  en: { title: 'Event', when: 'Date and time', audience: 'Audience', draft: 'Draft', published: 'Published', cancelled: 'Cancelled', publish: 'Publish', cancel: 'Cancel event', interested: 'Register interest', withdraw: 'Withdraw interest', notice: 'Registering interest is not a booking and does not guarantee admission.', attendance: 'Manual attendance record', member: 'Choose participant', observed: 'Event local time', record: 'Record attendance', retry: 'The action failed. Your input has been preserved.', pending: 'Events are currently unavailable.', chooseMember: 'Choose an eligible participant' },
  fa: { title: 'رویداد', when: 'تاریخ و زمان', audience: 'مخاطب', draft: 'پیش‌نویس', published: 'منتشرشده', cancelled: 'لغوشده', publish: 'انتشار', cancel: 'لغو رویداد', interested: 'ثبت علاقه', withdraw: 'لغو علاقه', notice: 'ثبت علاقه به معنی رزرو یا تضمین ورود نیست.', attendance: 'ثبت دستی حضور', member: 'انتخاب شرکت‌کننده', observed: 'زمان محلی رویداد', record: 'ثبت حضور', retry: 'عملیات انجام نشد. ورودی شما حفظ شده است.', pending: 'رویدادها در حال حاضر در دسترس نیستند.', chooseMember: 'یک شرکت‌کنندهٔ مجاز انتخاب کنید' },
} as const;

const feedback = {
  ro: { sending: 'Se trimite…', attendance: 'Prezența a fost înregistrată.', published: 'Evenimentul a fost publicat.', cancelled: 'Evenimentul a fost anulat.', registered: 'Interesul a fost înregistrat.', withdrawn: 'Interesul a fost retras.' },
  en: { sending: 'Sending…', attendance: 'Attendance recorded.', published: 'Event published.', cancelled: 'Event cancelled.', registered: 'Interest registered.', withdrawn: 'Interest withdrawn.' },
  fa: { sending: 'در حال ارسال…', attendance: 'حضور ثبت شد.', published: 'رویداد منتشر شد.', cancelled: 'رویداد لغو شد.', registered: 'علاقه ثبت شد.', withdrawn: 'علاقه لغو شد.' },
} as const;


export function CustomerEventInterest({ lang, event, commands, eligibleAttendanceMembers = [], onChanged, execution, canEdit = () => true, correction, draft, onDraft }: {
  lang: Language; event: EventInterestView | null; commands: EventInterestCommands | null;
  eligibleAttendanceMembers?: EligibleAttendanceMember[]; onChanged?: () => void;
  execution?: EventExecutionState; canEdit?: () => boolean;
  correction?: { id: string; version: number; timezone: string; displayName: string };
  draft?: Record<string, string>; onDraft?: (draft: Record<string, string>) => void;
}) {
  if (!event || !commands) return <p role="status">{copy[lang].pending}</p>;
  return <EventForm key={`${eventUuidKey(event.workspace_id)}:${eventUuidKey(event.event_id)}`} {...{lang, event, commands, eligibleAttendanceMembers, onChanged, execution, canEdit, correction, draft, onDraft}} />;
}

function EventForm({ lang, event, commands, eligibleAttendanceMembers, onChanged, execution, canEdit, correction, draft, onDraft }: {
  lang: Language; event: EventInterestView; commands: EventInterestCommands; eligibleAttendanceMembers: EligibleAttendanceMember[];
  onChanged?: () => void; execution?: EventExecutionState; canEdit: () => boolean;
  correction?: { id: string; version: number; timezone: string; displayName: string }; draft?: Record<string, string>; onDraft?: (draft: Record<string, string>) => void;
}) {
  const t = copy[lang], titleId = useId(), statusId = useId();
  const [fields, setFields] = useState(draft ?? { member: '', observed: '', attended: 'true', reason: '' });
  const [local, setLocal] = useState({ busy: false, message: '', error: '' });
  const flight = useRef(false), owner = useRef<object | null>(null);
  const token = useMemo(() => ({ eventId: event.event_id, workspaceId: event.workspace_id, version: event.version, canPublish: event.can_publish, canCancel: event.can_cancel, canRecord: event.can_record_attendance, canRegister: event.can_register_interest, canWithdraw: event.can_withdraw_interest, lang }), [event.event_id, event.workspace_id, event.version, event.can_publish, event.can_cancel, event.can_record_attendance, event.can_register_interest, event.can_withdraw_interest, lang]);
  useLayoutEffect(() => { owner.current = token; return () => { owner.current = null; }; }, [token]);
  const busy = local.busy || Boolean(execution?.pending);
  const edit = (name: string, value: string) => {
    if (flight.current || busy || !canEdit()) return;
    setFields(before => { const next = { ...before, [name]: value }; onDraft?.(next); return next; });
  };
  async function run(action: () => Promise<void>, message: string) {
    if (flight.current || busy || !canEdit() || owner.current !== token) return;
    flight.current = true; setLocal({ busy: true, message: '', error: '' });
    try {
      await action();
      if (owner.current !== token) return;
      // Page execution owns actual result/UNKNOWN. A fulfilled Promise<void>
      // from its wrapper is never interpreted as a receipt by this component.
      if (!execution) { setLocal({ busy: false, message, error: '' }); onChanged?.(); }
    } catch {
      if (owner.current === token) setLocal({ busy: false, message: '', error: lang === 'ro' ? 'Rezultatul cererii nu este încă cunoscut. Verifică înainte de reîncercare.' : lang === 'fa' ? 'نتیجه درخواست هنوز مشخص نیست. پیش از تلاش دوباره بررسی کنید.' : 'The request result is not yet known. Check before retrying.' });
    } finally {
      flight.current = false;
      if (owner.current === token) setLocal(before => ({ ...before, busy: false }));
    }
  }
  const correct = { en: 'Correct confirmed attendance', ro: 'Corectează prezența confirmată', fa: 'اصلاح حضور تأییدشده' }[lang];
  const reason = { en: 'Correction reason', ro: 'Motivul corectării', fa: 'دلیل اصلاح' }[lang];
  const present = { en: 'Attended', ro: 'Prezent', fa: 'حاضر' }[lang];
  const absent = { en: 'Did not attend', ro: 'Absent', fa: 'غایب' }[lang];
  const locale = lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-GB';
  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} aria-labelledby={titleId} className="space-y-4 rounded-xl border p-4">
    <h2 id={titleId}>{event.title}</h2>
    <p>{t.when}: {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: event.timezone }).format(new Date(event.starts_at))} · {event.timezone}</p>
    <p>{t.audience}: {event.audience_label} · {t[event.status]}</p><p role="note">{t.notice}</p>
    {!execution ? <p id={statusId} role="status" aria-live="polite">{local.busy ? feedback[lang].sending : local.message}</p> : null}
    {local.error ? <p id={`${statusId}-error`} role="alert">{local.error}</p> : null}
    <div className="flex flex-wrap gap-2">
      {event.can_publish ? <button data-event-action="publish_event" disabled={busy} onClick={() => void run(() => commands.publish(event.event_id, event.version), feedback[lang].published)}>{t.publish}</button> : null}
      {event.can_cancel ? <button data-event-action="cancel_event" disabled={busy} onClick={() => void run(() => commands.cancel(event.event_id, event.version), feedback[lang].cancelled)}>{t.cancel}</button> : null}
      {event.can_register_interest ? <button data-event-action="register_interest" disabled={busy} onClick={() => void run(() => commands.registerInterest(event.event_id, event.version, event.interest_version), feedback[lang].registered)}>{t.interested}</button> : null}
      {event.can_withdraw_interest ? <button data-event-action="withdraw_interest" disabled={busy} onClick={() => void run(() => commands.withdrawInterest(event.event_id, event.version, event.interest_version), feedback[lang].withdrawn)}>{t.withdraw}</button> : null}
    </div>
    {event.can_record_attendance ? <form data-record-attendance aria-label={t.attendance} aria-describedby={!execution ? local.error ? `${statusId}-error` : statusId : undefined} onSubmit={e => { e.preventDefault();
      if (!eligibleAttendanceMembers.some(member => sameEventUuid(member.membership_id, fields.member)) || !fields.observed) return;
      void run(() => commands.recordAttendance({ event_id: event.event_id, expected_version: event.version, membership_id: fields.member, observed_local: fields.observed, timezone: event.timezone }), feedback[lang].attendance);
    }}><h3>{t.attendance}</h3><fieldset aria-busy={busy} disabled={busy}>
      <label>{t.member}<select required value={eligibleAttendanceMembers.find(member => sameEventUuid(member.membership_id, fields.member))?.membership_id ?? fields.member} onChange={e => edit('member', e.target.value)}><option value="">{t.chooseMember}</option>{eligibleAttendanceMembers.map(member => <option key={member.membership_id} value={member.membership_id}>{member.display_name}</option>)}</select></label>
      <label>{t.observed} · {event.timezone}<input type="datetime-local" required value={fields.observed} onChange={e => edit('observed', e.target.value)} /></label><button type="submit">{t.record}</button>
    </fieldset></form> : null}
    {correction && commands.correctAttendance ? <form data-correct-attendance aria-label={correct} onSubmit={e => { e.preventDefault(); if (fields.reason.trim().length < (event.status === 'cancelled' ? 12 : 5) || !fields.observed) return;
      void run(() => commands.correctAttendance!({ event_id: event.event_id, expected_version: event.version, attendance_id: correction.id, expected_attendance_version: correction.version, attended: fields.attended === 'true', observed_local: fields.observed, timezone: correction.timezone, reason: fields.reason }), correct);
    }}><h3>{correct}</h3><p>{correction.displayName}</p><fieldset disabled={busy}>
      <label>{present}<select value={fields.attended} onChange={e => edit('attended', e.target.value)}><option value="true">{present}</option><option value="false">{absent}</option></select></label>
      <label>{t.observed} · {correction.timezone}<input required type="datetime-local" value={fields.observed} onChange={e => edit('observed', e.target.value)} /></label>
      <label>{reason}<textarea required minLength={event.status === 'cancelled' ? 12 : 5} value={fields.reason} onChange={e => edit('reason', e.target.value)} /></label><button type="submit">{correct}</button>
    </fieldset></form> : null}
  </section>;
}
