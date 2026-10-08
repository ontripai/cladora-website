'use client';

import { useState } from 'react';
import type { Language } from '@/types';

export interface CommunityAnnouncementView { id: string; title: string; body: string; status: 'draft' | 'published' | 'cancelled'; version: number; can_report: boolean }
export interface CommunityReportView { id: string; target_title: string; report_reason: string; status: 'open' | 'dismissed' | 'action_required'; version: number }
export interface CommunityBaseView { community_id: string; workspace_id: string; name: string; audience_label: string; can_create_announcement: boolean; can_decide_reports: boolean; announcements: CommunityAnnouncementView[]; reports: CommunityReportView[] }
export interface CommunityBaseCommands {
  createAnnouncement(input: { community_id: string; body: string }): Promise<void>;
  reportContent(input: { community_id: string; announcement_id: string; reason: string }): Promise<void>;
  decideReport(input: { community_id: string; report_id: string; expected_version: number; decision: 'dismissed' | 'action_required'; reason: string }): Promise<void>;
}

const copy = {
  ro: { heading: 'Comunitate', audience: 'Public', announcement: 'Anunț nou', body: 'Textul anunțului', save: 'Salvează ciorna', report: 'Raportează conținut', choose: 'Alege anunțul', reason: 'Motivul raportării', send: 'Trimite raportul', moderation: 'Soluționează raportarea', chooseReport: 'Alege raportarea', dismiss: 'Respinge raportarea', action: 'Necesită acțiune', decide: 'Înregistrează decizia', retry: 'Acțiunea nu a reușit. Datele introduse au fost păstrate.', empty: 'Nu există anunțuri publicate.', pending: 'Comunitatea nu este disponibilă momentan.' },
  en: { heading: 'Community', audience: 'Audience', announcement: 'New announcement', body: 'Announcement text', save: 'Save draft', report: 'Report content', choose: 'Choose announcement', reason: 'Reason for report', send: 'Send report', moderation: 'Resolve report', chooseReport: 'Choose report', dismiss: 'Dismiss report', action: 'Action required', decide: 'Record decision', retry: 'The action failed. Your input has been preserved.', empty: 'There are no published announcements.', pending: 'Community is currently unavailable.' },
  fa: { heading: 'جامعه', audience: 'مخاطب', announcement: 'اعلان جدید', body: 'متن اعلان', save: 'ذخیرهٔ پیش‌نویس', report: 'گزارش محتوا', choose: 'انتخاب اعلان', reason: 'دلیل گزارش', send: 'ارسال گزارش', moderation: 'رسیدگی به گزارش', chooseReport: 'انتخاب گزارش', dismiss: 'رد گزارش', action: 'نیازمند اقدام', decide: 'ثبت تصمیم', retry: 'عملیات انجام نشد. ورودی شما حفظ شده است.', empty: 'اعلان منتشرشده‌ای وجود ندارد.', pending: 'جامعه در حال حاضر در دسترس نیست.' },
} as const;

function AnnouncementForm({ lang, communityId, commands, onChanged }: { lang: Language; communityId: string; commands: CommunityBaseCommands; onChanged?: () => void }) {
  const t = copy[lang]; const [body, setBody] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit() { setBusy(true); setError(''); try { await commands.createAnnouncement({ community_id: communityId, body }); setBody(''); onChanged?.(); } catch { setError(t.retry); } finally { setBusy(false); } }
  return <form className="space-y-3 rounded-xl border p-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <h2 className="font-bold">{t.announcement}</h2>{error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    <label className="block space-y-1 text-sm"><span>{t.body}</span><textarea required maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} className="min-h-28 w-full rounded-lg border px-3 py-2" /></label>
    <button disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t.save}</button>
  </form>;
}

function ReportForm({ lang, view, commands, onChanged }: { lang: Language; view: CommunityBaseView; commands: CommunityBaseCommands; onChanged?: () => void }) {
  const t = copy[lang]; const options = view.announcements.filter((item) => item.status === 'published' && item.can_report); const [announcementId, setAnnouncementId] = useState(''); const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit() { setBusy(true); setError(''); try { await commands.reportContent({ community_id: view.community_id, announcement_id: announcementId, reason }); setAnnouncementId(''); setReason(''); onChanged?.(); } catch { setError(t.retry); } finally { setBusy(false); } }
  if (options.length === 0) return null;
  return <form className="space-y-3 rounded-xl border p-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
    <h2 className="font-bold">{t.report}</h2>{error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    <label className="block space-y-1 text-sm"><span>{t.choose}</span><select required value={announcementId} onChange={(event) => setAnnouncementId(event.target.value)} className="w-full rounded-lg border px-3 py-2"><option value="">{t.choose}</option>{options.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    <label className="block space-y-1 text-sm"><span>{t.reason}</span><textarea required minLength={5} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-24 w-full rounded-lg border px-3 py-2" /></label>
    <button disabled={busy} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-800 disabled:opacity-50">{t.send}</button>
  </form>;
}

function ModerationForm({ lang, view, commands, onChanged }: { lang: Language; view: CommunityBaseView; commands: CommunityBaseCommands; onChanged?: () => void }) {
  const t = copy[lang]; const reports = view.reports.filter((item) => item.status === 'open'); const [reportId, setReportId] = useState(''); const [decision, setDecision] = useState<'dismissed' | 'action_required'>('dismissed'); const [reason, setReason] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function submit() { const report = reports.find((item) => item.id === reportId); if (!report) return; setBusy(true); setError(''); try { await commands.decideReport({ community_id: view.community_id, report_id: report.id, expected_version: report.version, decision, reason }); setReportId(''); setReason(''); onChanged?.(); } catch { setError(t.retry); } finally { setBusy(false); } }
  if (!view.can_decide_reports || reports.length === 0) return null;
  return <form className="space-y-3 rounded-xl border p-4" onSubmit={(event) => { event.preventDefault(); void submit(); }}><h2 className="font-bold">{t.moderation}</h2>{error ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
    <label className="block space-y-1 text-sm"><span>{t.chooseReport}</span><select required value={reportId} onChange={(event) => setReportId(event.target.value)} className="w-full rounded-lg border px-3 py-2"><option value="">{t.chooseReport}</option>{reports.map((item) => <option key={item.id} value={item.id}>{item.target_title} — {item.report_reason}</option>)}</select></label>
    <label className="block space-y-1 text-sm"><span>{t.moderation}</span><select value={decision} onChange={(event) => setDecision(event.target.value as 'dismissed' | 'action_required')} className="w-full rounded-lg border px-3 py-2"><option value="dismissed">{t.dismiss}</option><option value="action_required">{t.action}</option></select></label>
    <label className="block space-y-1 text-sm"><span>{t.reason}</span><textarea required minLength={5} maxLength={1000} value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-24 w-full rounded-lg border px-3 py-2" /></label>
    <button disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{t.decide}</button>
  </form>;
}

export function CustomerCommunityBase({ lang, view, commands, onChanged }: { lang: Language; view: CommunityBaseView | null; commands: CommunityBaseCommands | null; onChanged?: () => void }) {
  const t = copy[lang];
  if (!view || !commands) return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="rounded-2xl border bg-white p-5"><p role="status">{t.pending}</p></section>;
  const published = view.announcements.filter((item) => item.status === 'published');
  return <section dir={lang === 'fa' ? 'rtl' : 'ltr'} className="space-y-5 rounded-2xl border bg-white p-4 sm:p-6" aria-labelledby="ce010-community-title">
    <header><p className="text-xs font-bold uppercase tracking-wide text-teal-700">{t.heading}</p><h1 id="ce010-community-title" className="text-xl font-bold text-[#102A43]">{view.name}</h1><p className="text-sm text-[#52667A]">{t.audience}: {view.audience_label}</p></header>
    <div className="space-y-3">{published.length ? published.map((item) => <article key={item.id} className="rounded-xl bg-slate-50 p-4"><h2 className="font-semibold">{item.title}</h2><p className="mt-1 whitespace-pre-wrap text-sm">{item.body}</p></article>) : <p role="status" className="text-sm text-[#52667A]">{t.empty}</p>}</div>
    {view.can_create_announcement ? <AnnouncementForm key={`announcement:${view.workspace_id}:${view.community_id}`} lang={lang} communityId={view.community_id} commands={commands} onChanged={onChanged} /> : null}
    <ReportForm key={`report:${view.workspace_id}:${view.community_id}`} lang={lang} view={view} commands={commands} onChanged={onChanged} />
    <ModerationForm key={`moderation:${view.workspace_id}:${view.community_id}`} lang={lang} view={view} commands={commands} onChanged={onChanged} />
  </section>;
}
