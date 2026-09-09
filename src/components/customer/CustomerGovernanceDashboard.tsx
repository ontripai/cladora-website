'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
  Vote,
  X,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  FileText,
  Play,
  Check,
  Send,
  Lock,
} from 'lucide-react';
import { useCustomerContext } from './CustomerContextProvider';

type View =
  | 'meetings'
  | 'agenda'
  | 'invitations'
  | 'attendance'
  | 'quorum'
  | 'proxies'
  | 'votes'
  | 'resolutions'
  | 'minutes'
  | 'documents'
  | 'history';

type Payload = {
  total: number;
  rows: Record<string, unknown>[];
  summary: { meetings: number; scheduled: number; closed: number; open_votes: number };
  read_only: boolean;
  secret_ballots_redacted: boolean;
};

const copy = {
  en: {
    title: 'Governance, Meetings & Decisions',
    sub: 'Statutory general assemblies, secret ballot voting, quorum verification and immutable minutes under Romanian Law 196/2018.',
    meetings: 'Meetings',
    agenda: 'Agenda',
    invitations: 'Invitations',
    attendance: 'Attendance',
    quorum: 'Quorum',
    proxies: 'Proxies',
    votes: 'Votes & Ballots',
    resolutions: 'Resolutions',
    minutes: 'Minutes',
    documents: 'Documents',
    history: 'Audit History',
    search: 'Search authorized governance records',
    all: 'All',
    status: 'Status',
    from: 'From',
    to: 'To',
    refresh: 'Refresh',
    loading: 'Loading authorized governance evidence…',
    empty: 'No governance records found in this context.',
    error: 'Governance data could not be loaded.',
    readonly: 'Read-only · secret ballots redacted',
    details: 'Details',
    close: 'Close',
    scheduled: 'Announced / Active',
    closed: 'Completed meetings',
    openVotes: 'Open votes',
    date: 'Date / Period',
    subject: 'Title / Subject',
    basis: 'Type / Basis',
    result: 'Result / Quorum',
    newMeeting: 'Schedule Meeting',
    newPolicy: 'Configure Policy',
    publishMeeting: 'Publish Notice',
    openMeeting: 'Open Meeting',
    completeMeeting: 'Complete Meeting',
    openBallot: 'Open Ballot',
    closeBallot: 'Close Ballot',
    castVote: 'Cast Vote',
    voteFor: 'Vote FOR',
    voteAgainst: 'Vote AGAINST',
    voteAbstain: 'ABSTAIN',
    adoptResolution: 'Adopt Resolution',
    finalizeMinutes: 'Finalize Minutes',
    secretBallotNotice: 'Secret Ballot: Your individual vote option is cryptographically decoupled from your identity.',
    actionSuccess: 'Governance action executed successfully.',
    actionError: 'Governance action failed. Verify permissions or statutory criteria.',
    save: 'Confirm & Submit',
    cancel: 'Cancel',
  },
  ro: {
    title: 'Guvernanță, adunări generale și decizii',
    sub: 'Adunări generale legale, vot secret, cvorum verificat și procese-verbale conform Legii nr. 196/2018.',
    meetings: 'Ședințe',
    agenda: 'Ordine de zi',
    invitations: 'Convocatoare',
    attendance: 'Prezență',
    quorum: 'Cvorum',
    proxies: 'Procuri de reprezentare',
    votes: 'Voturi și buletine',
    resolutions: 'Hotărâri',
    minutes: 'Procese-verbale',
    documents: 'Documente',
    history: 'Jurnal de audit',
    search: 'Caută înregistrări de guvernanță',
    all: 'Toate',
    status: 'Stare',
    from: 'De la',
    to: 'Până la',
    refresh: 'Reîncarcă',
    loading: 'Se încarcă datele de guvernanță…',
    empty: 'Nu există înregistrări în acest context.',
    error: 'Datele de guvernanță nu au putut fi încărcate.',
    readonly: 'Doar citire · voturile secrete sunt protejate',
    details: 'Detalii',
    close: 'Închide',
    scheduled: 'Anunțate / În desfășurare',
    closed: 'Ședințe finalizate',
    openVotes: 'Voturi deschise',
    date: 'Dată / Perioadă',
    subject: 'Titlu / Subiect',
    basis: 'Tip / Bază',
    result: 'Rezultat / Cvorum',
    newMeeting: 'Convoacă ședință',
    newPolicy: 'Configurează regulament',
    publishMeeting: 'Publică convocator',
    openMeeting: 'Deschide ședința',
    completeMeeting: 'Finalizează ședința',
    openBallot: 'Deschide buletin de vot',
    closeBallot: 'Închide votul',
    castVote: 'Votează',
    voteFor: 'PENTRU',
    voteAgainst: 'ÎMPOTRIVĂ',
    voteAbstain: 'ABȚINERE',
    adoptResolution: 'Adoptă hotărâre',
    finalizeMinutes: 'Finalizează proces-verbal',
    secretBallotNotice: 'Vot secret: Opțiunea dumneavoastră individuală este separată de identitate în baza de date.',
    actionSuccess: 'Acțiunea de guvernanță a fost executată cu succes.',
    actionError: 'Eroare la executarea acțiunii. Verificați permisiunile sau cerințele legale.',
    save: 'Confirmă și transmite',
    cancel: 'Renunță',
  },
  fa: {
    title: 'حاکمیت، جلسات و تصمیمات مجمع',
    sub: 'مجامع عمومی قانونی، رأی‌گیری مخفی، احراز حد نصاب و صورت‌جلسه‌های قطعی طبق قانون ۱۹۶/۲۰۱۸ رومانی.',
    meetings: 'جلسات',
    agenda: 'دستور جلسه',
    invitations: 'فراخوان‌ها',
    attendance: 'حضور و غیاب',
    quorum: 'حد نصاب قانونی',
    proxies: 'وکالت‌نامه‌ها',
    votes: 'رأی‌ها و تعرفه‌ها',
    resolutions: 'مصوبات',
    minutes: 'صورت‌جلسه‌ها',
    documents: 'اسناد',
    history: 'تاریخچه نظارتی',
    search: 'جستجوی سوابق مجاز حاکمیتی',
    all: 'همه',
    status: 'وضعیت',
    from: 'از تاریخ',
    to: 'تا تاریخ',
    refresh: 'بازخوانی',
    loading: 'در حال بارگذاری شواهد حاکمیتی…',
    empty: 'هیچ رکوردی در این زمینه یافت نشد.',
    error: 'بارگذاری اطلاعات حاکمیتی با شکست مواجه شد.',
    readonly: 'فقط خواندنی · آرای مخفی محرمانه‌سازی شده',
    details: 'جزئیات',
    close: 'بستن',
    scheduled: 'فعال / اعلام‌شده',
    closed: 'جلسات خاتمه‌یافته',
    openVotes: 'رأی‌گیری‌های باز',
    date: 'تاریخ / بازه',
    subject: 'موضوع / عنوان',
    basis: 'نوع / مبنا',
    result: 'نتیجه / حد نصاب',
    newMeeting: 'ثبت جلسه جدید',
    newPolicy: 'تنظیم خط‌مشی حاکمیتی',
    publishMeeting: 'انتشار فراخوان قانونی',
    openMeeting: 'شروع جلسه',
    completeMeeting: 'خاتمه جلسه',
    openBallot: 'آغاز رأی‌گیری',
    closeBallot: 'پایان رأی‌گیری',
    castVote: 'ثبت رأی',
    voteFor: 'موافق',
    voteAgainst: 'مخالف',
    voteAbstain: 'ممتنع',
    adoptResolution: 'تصویب رسمی مصوبه',
    finalizeMinutes: 'نهایی‌سازی صورت‌جلسه',
    secretBallotNotice: 'رأی‌گیری مخفی: انتخاب شخصی شما در پایگاه داده بدون اتصال به هویت ذخیره می‌شود.',
    actionSuccess: 'عملیات حاکمیتی با موفقیت انجام شد.',
    actionError: 'عملیات با شکست مواجه شد. دسترسی‌ها یا شرایط قانونی را بررسی نمایید.',
    save: 'تأیید و ارسال',
    cancel: 'انصراف',
  },
} as const;

const show = (v: unknown) =>
  v == null || v === '' ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);

const date = (v: unknown, l: string) =>
  v
    ? new Intl.DateTimeFormat(l === 'fa' ? 'fa-IR' : l === 'ro' ? 'ro-RO' : 'en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(String(v)))
    : '—';

export function CustomerGovernanceDashboard({
  lang,
  initialView,
}: {
  lang: string;
  initialView: View;
}) {
  const t = copy[lang === 'fa' ? 'fa' : lang === 'ro' ? 'ro' : 'en'];
  const { active, dashboard } = useCustomerContext();
  const [view, setView] = useState<View>(initialView);
  const [data, setData] = useState<Payload | null>(null);
  const defaultPropertyId =
    dashboard?.context?.property_id ??
    (data?.rows?.[0]?.property_id as string | undefined) ??
    '';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [nonce, setNonce] = useState(0);

  // Mutation & feedback state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Modals state
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showPolicyModal, setShowPolicyModal] = useState(false);
  const [showVoteModal, setShowVoteModal] = useState<{ ballotId: string; question: string } | null>(null);

  // Form states
  const [meetingForm, setMeetingForm] = useState({
    title: '',
    meeting_type: 'general_assembly',
    scheduled_at: '',
    location_text: '',
    property_id: '',
  });

  const [policyForm, setPolicyForm] = useState({
    name: 'Standard Legea 196/2018 Policy',
    voting_basis: 'ownership_share',
    notice_period_days: 10,
    quorum_threshold: 0.5000000001,
  });

  const [voteForm, setVoteForm] = useState<{ choice: 'for' | 'against' | 'abstain' }>({
    choice: 'for',
  });

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const p = new URLSearchParams({
        context_id: active.context_id,
        view,
        limit: '20',
        offset: String(offset),
      });
      if (query) p.set('query', query);
      if (status) p.set('status', status);
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      const r = await fetch(`/api/customer/v1/governance?${p}`, {
        cache:'no-store',
        credentials:'same-origin',
      });
      if (!r.ok) throw new Error();
      setData(await r.json());
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [active, view, offset, query, status, from, to, t.error]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 150);
    return () => clearTimeout(timer);
  }, [load, nonce]);

  // Actions
  const handlePublishMeeting = async (meetingId: string) => {
    if (!active) return;
    setActionLoading(meetingId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/customer/v1/governance/meetings/${meetingId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_id: active.context_id }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setActionMessage({ text: resData?.error?.message || t.actionError, type: 'error' });
      } else {
        setActionMessage({ text: t.actionSuccess, type: 'success' });
        setNonce((n) => n + 1);
      }
    } catch {
      setActionMessage({ text: t.actionError, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenMeeting = async (meetingId: string) => {
    if (!active) return;
    setActionLoading(meetingId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/customer/v1/governance/meetings/${meetingId}/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_id: active.context_id }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setActionMessage({ text: resData?.error?.message || t.actionError, type: 'error' });
      } else {
        setActionMessage({ text: t.actionSuccess, type: 'success' });
        setNonce((n) => n + 1);
      }
    } catch {
      setActionMessage({ text: t.actionError, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteMeeting = async (meetingId: string) => {
    if (!active) return;
    setActionLoading(meetingId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/customer/v1/governance/meetings/${meetingId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context_id: active.context_id }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setActionMessage({ text: resData?.error?.message || t.actionError, type: 'error' });
      } else {
        setActionMessage({ text: t.actionSuccess, type: 'success' });
        setNonce((n) => n + 1);
      }
    } catch {
      setActionMessage({ text: t.actionError, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetPropId = meetingForm.property_id.trim() || defaultPropertyId;
    if (!active || !targetPropId) {
      setActionMessage({ text: 'Valid property ID is required to schedule a meeting.', type: 'error' });
      return;
    }
    setActionLoading('create-meeting');
    setActionMessage(null);
    try {
      const res = await fetch('/api/customer/v1/governance/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          property_id: targetPropId,
          title: meetingForm.title,
          meeting_type: meetingForm.meeting_type,
          scheduled_at: new Date(meetingForm.scheduled_at).toISOString(),
          location_text: meetingForm.location_text || null,
        }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setActionMessage({ text: resData?.error?.message || t.actionError, type: 'error' });
      } else {
        setActionMessage({ text: t.actionSuccess, type: 'success' });
        setShowMeetingModal(false);
        setMeetingForm({ title: '', meeting_type: 'general_assembly', scheduled_at: '', location_text: '', property_id: '' });
        setNonce((n) => n + 1);
      }
    } catch {
      setActionMessage({ text: t.actionError, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setActionLoading('create-policy');
    setActionMessage(null);
    try {
      const res = await fetch('/api/customer/v1/governance/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          property_id: defaultPropertyId || null,
          name: policyForm.name,
          voting_basis: policyForm.voting_basis,
          notice_period_days: policyForm.notice_period_days,
          quorum_threshold: policyForm.quorum_threshold,
        }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setActionMessage({ text: resData?.error?.message || t.actionError, type: 'error' });
      } else {
        setActionMessage({ text: t.actionSuccess, type: 'success' });
        setShowPolicyModal(false);
        setNonce((n) => n + 1);
      }
    } catch {
      setActionMessage({ text: t.actionError, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCastVote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active || !showVoteModal) return;
    setActionLoading('cast-vote');
    setActionMessage(null);
    try {
      const res = await fetch(`/api/customer/v1/governance/ballots/${showVoteModal.ballotId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: active.context_id,
          eligibility_id: active.context_id, // Default to current context eligibility
          choice: voteForm.choice,
          idempotency_key: `ui-${Date.now()}`,
        }),
      });
      const resData = await res.json();
      if (!res.ok) {
        setActionMessage({ text: resData?.error?.message || t.actionError, type: 'error' });
      } else {
        setActionMessage({ text: t.actionSuccess, type: 'success' });
        setShowVoteModal(null);
        setNonce((n) => n + 1);
      }
    } catch {
      setActionMessage({ text: t.actionError, type: 'error' });
    } finally {
      setActionLoading(null);
    }
  };

  const tabs = (['meetings','agenda','invitations','attendance','quorum','proxies','votes','resolutions','minutes','documents','history'] as View[]);

  const roleCode = active?.role_code?.toLowerCase() ?? '';
  const canManage = ['customer_admin', 'association_admin', 'property_manager', 'board_president'].includes(roleCode);

  return (
    <div className="space-y-5" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <header className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0E9F8E]">
              <Vote className="h-4 w-4" />
              C12 · Legea nr. 196/2018 Governance
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-[#102A43]">{t.title}</h1>
            <p className="mt-1 max-w-3xl text-sm text-[#52667A]">{t.sub}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canManage ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowMeetingModal(true)}
                  className="flex items-center gap-1 rounded-xl bg-[#0E9F8E] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0A6E62]"
                >
                  <PlusCircle className="h-4 w-4" />
                  {t.newMeeting}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(true)}
                  className="flex items-center gap-1 rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-xs font-bold text-[#334E68] hover:bg-slate-50"
                >
                  <ShieldCheck className="h-4 w-4 text-[#0E9F8E]" />
                  {t.newPolicy}
                </button>
              </>
            ) : null}
            <div className="h-fit rounded-xl border border-[#B2E5DF] bg-[#EAF8F5] px-3 py-2 text-xs font-bold text-[#0A6E62]">
              <ShieldCheck className="me-2 inline h-4 w-4" />
              {t.readonly}
            </div>
          </div>
        </div>
      </header>

      {actionMessage ? (
        <div
          role="alert"
          className={`flex items-center justify-between rounded-xl p-3 text-xs font-bold ${
            actionMessage.type === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <AlertCircle className="h-4 w-4 text-rose-600" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button type="button" onClick={() => setActionMessage(null)} aria-label={t.close}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {tabs.map((v) => (
          <button
            type="button"
            key={v}
            onClick={() => {
              setView(v);
              setOffset(0);
              setStatus('');
              setSelected(null);
            }}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
              view === v
                ? 'bg-[#0E9F8E] text-white shadow-sm'
                : 'border bg-white text-[#334E68] hover:bg-slate-50'
            }`}
          >
            {t[v]}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setOffset(0);
          setQuery(draft.trim());
        }}
        className="grid gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-6"
      >
        <label className="relative md:col-span-2">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-[#7B8A9A]" />
          <span className="sr-only">{t.search}</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.search}
            className="w-full rounded-xl border py-2 pe-3 ps-9 text-sm"
          />
        </label>
        <input
          aria-label={t.status}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
          placeholder={`${t.all} · ${t.status}`}
          className="rounded-xl border px-3 py-2 text-sm"
        />
        <input
          type="date"
          aria-label={t.from}
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            setOffset(0);
          }}
          className="rounded-xl border px-3 py-2 text-sm"
        />
        <input
          type="date"
          aria-label={t.to}
          value={to}
          onChange={(e) => {
            setTo(e.target.value);
            setOffset(0);
          }}
          className="rounded-xl border px-3 py-2 text-sm"
        />
        <button
          type="button"
          aria-label={t.refresh}
          onClick={() => setNonce((n) => n + 1)}
          className="rounded-xl border p-2 hover:bg-slate-50"
        >
          <RefreshCw className={`mx-auto h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </form>

      {data?.summary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label={t.meetings} value={data.summary.meetings} />
          <Metric label={t.scheduled} value={data.summary.scheduled} />
          <Metric label={t.closed} value={data.summary.closed} />
          <Metric label={t.openVotes} value={data.summary.open_votes} />
        </div>
      ) : null}

      {loading ? (
        <Box value={t.loading} />
      ) : error ? (
        <Box value={error} />
      ) : !data?.rows.length ? (
        <Box value={t.empty} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
            <table className="w-full min-w-[950px] text-xs">
              <thead className="bg-[#F6F9FC] text-[#52667A]">
                <tr>
                  <th className="p-3 text-start">{t.date}</th>
                  <th className="p-3 text-start">{t.subject}</th>
                  <th className="p-3 text-start">{t.basis}</th>
                  <th className="p-3 text-start">{t.result}</th>
                  <th className="p-3 text-start">{t.status}</th>
                  <th className="p-3 text-start">{t.details}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((r) => {
                  const mId = String(r.id ?? '');
                  const mStatus = String(r.status ?? '');
                  return (
                    <tr key={String(r.id)} className="hover:bg-slate-50/60">
                      <Cells row={r} view={view} lang={lang} />
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {/* Contextual actions */}
                          {view === 'meetings' && mStatus === 'draft' && canManage ? (
                            <button
                              type="button"
                              disabled={actionLoading === mId}
                              onClick={() => void handlePublishMeeting(mId)}
                              className="rounded-lg bg-[#0E9F8E] px-2.5 py-1 text-[11px] font-bold text-white hover:bg-[#0A6E62] disabled:opacity-50"
                            >
                              <Send className="me-1 inline h-3 w-3" />
                              {t.publishMeeting}
                            </button>
                          ) : null}

                          {view === 'meetings' && mStatus === 'published' && canManage ? (
                            <button
                              type="button"
                              disabled={actionLoading === mId}
                              onClick={() => void handleOpenMeeting(mId)}
                              className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <Play className="me-1 inline h-3 w-3" />
                              {t.openMeeting}
                            </button>
                          ) : null}

                          {view === 'meetings' && mStatus === 'in_progress' && canManage ? (
                            <button
                              type="button"
                              disabled={actionLoading === mId}
                              onClick={() => void handleCompleteMeeting(mId)}
                              className="rounded-lg bg-slate-700 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-slate-800 disabled:opacity-50"
                            >
                              <Check className="me-1 inline h-3 w-3" />
                              {t.completeMeeting}
                            </button>
                          ) : null}

                          {view === 'votes' && mStatus === 'open' ? (
                            <button
                              type="button"
                              onClick={() =>
                                setShowVoteModal({
                                  ballotId: mId,
                                  question: String(r.question ?? 'Ballot Question'),
                                })
                              }
                              className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-indigo-700"
                            >
                              <Vote className="me-1 inline h-3 w-3" />
                              {t.castVote}
                            </button>
                          ) : null}

                          <button
                            type="button"
                            onClick={() => setSelected(r)}
                            className="font-bold text-[#087A6E] hover:underline"
                          >
                            {t.details}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-between text-xs text-[#52667A]">
            <span>
              {offset + 1}–{Math.min(offset + 20, data.total)} / {data.total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 20))}
                className="rounded-xl border bg-white p-2 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
              </button>
              <button
                type="button"
                disabled={offset + 20 >= data.total}
                onClick={() => setOffset(offset + 20)}
                className="rounded-xl border bg-white p-2 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </>
      )}

      {selected ? (
        <Detail row={selected} close={() => setSelected(null)} label={t.close} />
      ) : null}

      {/* Schedule Meeting Modal */}
      {showMeetingModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-[#102A43]">{t.newMeeting}</h3>
              <button type="button" onClick={() => setShowMeetingModal(false)} aria-label={t.close}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreateMeeting} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#334E68]">Title</label>
                <input
                  required
                  value={meetingForm.title}
                  onChange={(e) => setMeetingForm({ ...meetingForm, title: e.target.value })}
                  placeholder="e.g. Adunarea Generală Ordinară Anuală 2026"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#334E68]">Type</label>
                  <select
                    value={meetingForm.meeting_type}
                    onChange={(e) => setMeetingForm({ ...meetingForm, meeting_type: e.target.value })}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-xs"
                  >
                    <option value="general_assembly">General Assembly</option>
                    <option value="extraordinary_general_assembly">Extraordinary Assembly</option>
                    <option value="board_meeting">Board Meeting</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#334E68]">Date & Time</label>
                  <input
                    required
                    type="datetime-local"
                    value={meetingForm.scheduled_at}
                    onChange={(e) => setMeetingForm({ ...meetingForm, scheduled_at: e.target.value })}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#334E68]">Location / Venue</label>
                <input
                  value={meetingForm.location_text}
                  onChange={(e) => setMeetingForm({ ...meetingForm, location_text: e.target.value })}
                  placeholder="Sala festivă / Str. Principală 10"
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowMeetingModal(false)}
                  className="rounded-xl border px-4 py-2 text-xs font-bold text-[#334E68]"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-meeting'}
                  className="rounded-xl bg-[#0E9F8E] px-4 py-2 text-xs font-bold text-white hover:bg-[#0A6E62] disabled:opacity-50"
                >
                  {actionLoading === 'create-meeting' ? '…' : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Configure Policy Modal */}
      {showPolicyModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-[#102A43]">{t.newPolicy}</h3>
              <button type="button" onClick={() => setShowPolicyModal(false)} aria-label={t.close}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreatePolicy} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#334E68]">Policy Name</label>
                <input
                  required
                  value={policyForm.name}
                  onChange={(e) => setPolicyForm({ ...policyForm, name: e.target.value })}
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-xs"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#334E68]">Voting Basis</label>
                  <select
                    value={policyForm.voting_basis}
                    onChange={(e) => setPolicyForm({ ...policyForm, voting_basis: e.target.value })}
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-xs"
                  >
                    <option value="ownership_share">Ownership Share</option>
                    <option value="unit">Per Unit</option>
                    <option value="owner">Per Owner</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#334E68]">Notice Days</label>
                  <input
                    type="number"
                    min={3}
                    max={60}
                    value={policyForm.notice_period_days}
                    onChange={(e) =>
                      setPolicyForm({ ...policyForm, notice_period_days: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#334E68]">Quorum Threshold</label>
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    max={1}
                    value={policyForm.quorum_threshold}
                    onChange={(e) =>
                      setPolicyForm({ ...policyForm, quorum_threshold: Number(e.target.value) })
                    }
                    className="mt-1 w-full rounded-xl border px-3 py-2 text-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowPolicyModal(false)}
                  className="rounded-xl border px-4 py-2 text-xs font-bold text-[#334E68]"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'create-policy'}
                  className="rounded-xl bg-[#0E9F8E] px-4 py-2 text-xs font-bold text-white hover:bg-[#0A6E62] disabled:opacity-50"
                >
                  {actionLoading === 'create-policy' ? '…' : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Cast Vote Modal */}
      {showVoteModal ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold text-[#102A43]">{t.castVote}</h3>
              <button type="button" onClick={() => setShowVoteModal(null)} aria-label={t.close}>
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-bold text-[#334E68]">{showVoteModal.question}</p>
              <div className="mt-2 flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                <Lock className="h-3.5 w-3.5" />
                <span>{t.secretBallotNotice}</span>
              </div>
            </div>
            <form onSubmit={handleCastVote} className="mt-4 space-y-3">
              <div className="grid grid-cols-3 gap-2">
                {(['for', 'against', 'abstain'] as const).map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setVoteForm({ choice: opt })}
                    className={`rounded-xl border p-3 text-center text-xs font-bold transition-all ${
                      voteForm.choice === opt
                        ? opt === 'for'
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                          : opt === 'against'
                          ? 'border-rose-600 bg-rose-50 text-rose-800'
                          : 'border-amber-600 bg-amber-50 text-amber-800'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt === 'for' ? t.voteFor : opt === 'against' ? t.voteAgainst : t.voteAbstain}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowVoteModal(null)}
                  className="rounded-xl border px-4 py-2 text-xs font-bold text-[#334E68]"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'cast-vote'}
                  className="rounded-xl bg-[#0E9F8E] px-4 py-2 text-xs font-bold text-white hover:bg-[#0A6E62] disabled:opacity-50"
                >
                  {actionLoading === 'cast-vote' ? '…' : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-bold text-[#52667A]">
        <CalendarCheck className="me-1 inline h-4 w-4 text-[#0E9F8E]" />
        {label}
      </div>
      <div className="mt-2 text-xl font-extrabold text-[#102A43]">{show(value)}</div>
    </div>
  );
}

function Box({ value }: { value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-10 text-center text-sm text-[#52667A] shadow-sm">
      {value}
    </div>
  );
}

function Cells({
  row: r,
  view,
  lang,
}: {
  row: Record<string, unknown>;
  view: View;
  lang: string;
}) {
  const when =
    r.scheduled_at ??
    r.opens_at ??
    r.valid_from ??
    r.approved_at ??
    r.occurred_at ??
    r.created_at;
  const subject =
    r.meeting_title ??
    r.title ??
    r.question ??
    r.resolution_no ??
    r.event_type;
  const basis =
    r.property_name ??
    r.quorum_basis ??
    r.unit_code ??
    r.document_type ??
    r.voting_method ??
    r.meeting_type;
  const value =
    view === 'quorum'
      ? `${show(r.quorum_percent)}%`
      : r.option_totals ??
        r.result_state ??
        r.adopted ??
        r.currently_valid ??
        r.decision_required ??
        r.classification ??
        r.rule_version;

  return (
    <>
      <td className="p-3">{date(when, lang)}</td>
      <td className="p-3 font-bold text-[#102A43]">{show(subject)}</td>
      <td className="p-3">{show(basis)}</td>
      <td className="p-3 font-mono">{show(value)}</td>
      <td className="p-3">
        <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-700">
          {show(r.status ?? r.invitation_status ?? r.status_to)}
        </span>
      </td>
    </>
  );
}

function Detail({
  row,
  close,
  label,
}: {
  row: Record<string, unknown>;
  close: () => void;
  label: string;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4"
    >
      <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2 text-sm font-bold text-[#102A43]">
            <FileText className="h-4 w-4 text-[#0E9F8E]" />
            <span>Record Details</span>
          </div>
          <button type="button" onClick={close} aria-label={label}>
            <X className="h-5 w-5 text-slate-500 hover:text-slate-800" />
          </button>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-2">
          {Object.entries(row)
            .filter(
              ([k]) =>
                ![
                  'cast_by',
                  'eligibility_id',
                  'party_id',
                  'grantor_party_id',
                  'representative_party_id',
                  'proxy_evidence_path',
                  'object_path',
                  'attachments_json',
                  'snapshot_json',
                  'content_json',
                  'before_snapshot',
                  'after_snapshot',
                ].includes(k)
            )
            .map(([k, v]) => (
              <div key={k} className="rounded-xl bg-[#F6F9FC] p-3">
                <dt className="text-xs font-bold text-[#52667A]">{k}</dt>
                <dd className="mt-1 break-words text-xs text-[#102A43]">{show(v)}</dd>
              </div>
            ))}
        </dl>
      </div>
    </div>
  );
}
