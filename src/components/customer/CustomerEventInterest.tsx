'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { Language } from '@/types';

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

// UI serialization only; every command still passes the server's live authority/version checks.
function useEventSubmission(lang: Language) {
  const id = useId();
  const pending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  async function run(action: () => Promise<void>, success: string) {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true); setError(''); setMessage('');
    try {
      await action();
      if (!mounted.current) return false;
      setMessage(success);
      return true;
    } catch {
      if (mounted.current) setError(copy[lang].retry);
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  return { id, busy, error, message, run };
}

function AttendanceForm({ lang, event, commands, members, submission, onChanged }: { lang: Language; event: EventInterestView; commands: EventInterestCommands; members: EligibleAttendanceMember[]; submission: ReturnType<typeof useEventSubmission>; onChanged?: () => void }) {
  const t = copy[lang];
  const titleId = useId();
  const [membershipId, setMembershipId] = useState('');
  const [observedAt, setObservedAt] = useState('');

  async function submit() {
    if (await submission.run(() => commands.recordAttendance({ event_id: event.event_id, expected_version: event.version, membership_id: membershipId, observed_local: observedAt, timezone: event.timezone }), feedback[lang].attendance)) {
      setMembershipId('');
      setObservedAt('');
      onChanged?.();
    }
  }

  return <form aria-labelledby={titleId} aria-describedby={submission.error ? `${submission.id}-error` : submission.id} className="space-y-3 rounded-xl border p-4" onSubmit={(submitEvent) => { submitEvent.preventDefault(); void submit(); }}>
    <h2 id={titleId} className="font-bold">{t.attendance}</h2>
    <fieldset aria-busy={submission.busy} disabled={submission.busy} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm"><span>{t.member}</span><select required value={membershipId} onChange={(change) => setMembershipId(change.target.value)} className="w-full rounded-lg border px-3 py-2"><option value="">{t.chooseMember}</option>{members.map((member) => <option key={member.membership_id} value={member.membership_id}>{member.display_name}</option>)}</select></label>
      <label className="space-y-1 text-sm"><span>{t.observed} · {event.timezone}</span><input required type="datetime-local" value={observedAt} onChange={(change) => setObservedAt(change.target.value)} className="w-full rounded-lg border px-3 py-2" /></label>
      <button disabled={submission.busy} type="submit" className="rounded-lg bg-[#102A43] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 sm:w-fit">{t.record}</button>
    </fieldset>
  </form>;
}

export function CustomerEventInterest({ lang, event, commands, eligibleAttendanceMembers = [], onChanged }: { lang: Language; event: EventInterestView | null; commands: EventInterestCommands | null; eligibleAttendanceMembers?: EligibleAttendanceMember[]; onChanged?: () => void }) {
  if (!event || !commands) return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="rounded-2xl border bg-white p-5"><p role="status" className="text-sm text-[#52667A]">{copy[lang].pending}</p></section>;
  return <EventInterest key={`${event.workspace_id}:${event.event_id}`} lang={lang} event={event} commands={commands} eligibleAttendanceMembers={eligibleAttendanceMembers} onChanged={onChanged} />;
}

function EventInterest({ lang, event, commands, eligibleAttendanceMembers, onChanged }: { lang: Language; event: EventInterestView; commands: EventInterestCommands; eligibleAttendanceMembers: EligibleAttendanceMember[]; onChanged?: () => void }) {
  const t = copy[lang];
  const titleId = useId();
  const submission = useEventSubmission(lang);
  async function run(action: () => Promise<void>, success: string) {
    if (await submission.run(action, success)) onChanged?.();
  }

  const locale = lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-GB';

  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="space-y-5 rounded-2xl border bg-white p-4 sm:p-6" aria-labelledby={titleId}>
    <header className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-wide text-teal-700">{t.title}</p>
      <h1 id={titleId} className="text-xl font-bold text-[#102A43]">{event.title}</h1>
      <p className="text-sm text-[#52667A]">{t.when}: <time dateTime={event.starts_at}>{new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: event.timezone }).format(new Date(event.starts_at))}</time> – <time dateTime={event.ends_at}>{new Intl.DateTimeFormat(locale, { timeStyle: 'short', timeZone: event.timezone }).format(new Date(event.ends_at))}</time> · {event.timezone}</p>
      <p className="text-sm text-[#52667A]">{t.audience}: {event.audience_label}</p>
      <p className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{t[event.status]}</p>
    </header>

    <div role="note" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">{t.notice}</div>
    <p id={submission.id} role="status" aria-live="polite" aria-atomic="true" className="text-sm text-teal-800">{submission.busy ? feedback[lang].sending : submission.message}</p>
    {submission.error ? <p id={`${submission.id}-error`} role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{submission.error}</p> : null}

    <div className="flex flex-wrap gap-2">
      {event.can_publish ? <button disabled={submission.busy} type="button" onClick={() => void run(() => commands.publish(event.event_id, event.version), feedback[lang].published)} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t.publish}</button> : null}
      {event.can_cancel ? <button disabled={submission.busy} type="button" onClick={() => void run(() => commands.cancel(event.event_id, event.version), feedback[lang].cancelled)} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">{t.cancel}</button> : null}
      {event.can_register_interest ? <button disabled={submission.busy} type="button" onClick={() => void run(() => commands.registerInterest(event.event_id, event.version, event.interest_version), feedback[lang].registered)} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t.interested}</button> : null}
      {event.can_withdraw_interest ? <button disabled={submission.busy} type="button" onClick={() => void run(() => commands.withdrawInterest(event.event_id, event.version, event.interest_version), feedback[lang].withdrawn)} className="rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50">{t.withdraw}</button> : null}
    </div>

    {event.can_record_attendance ? <AttendanceForm key={`${event.workspace_id}:${event.event_id}`} lang={lang} event={event} commands={commands} members={eligibleAttendanceMembers} submission={submission} onChanged={onChanged} /> : null}
  </section>;
}
