"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  FileText,
  Megaphone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCustomerContext } from "./CustomerContextProvider";

export type View =
  | "channels"
  | "announcements"
  | "posts"
  | "comments"
  | "polls"
  | "options"
  | "results"
  | "notifications"
  | "links"
  | "official_notices";

type Payload = {
  total: number;
  rows: Record<string, unknown>[];
  summary?: {
    channels: number;
    published_posts: number;
    open_polls: number;
    unread_notifications: number;
  };
};

interface NoticeDetailData {
  notice: {
    id: string;
    notice_number: number;
    title_ro: string;
    body_ro: string;
    title_en: string | null;
    body_en: string | null;
    title_fa: string | null;
    body_fa: string | null;
    communication_type: string;
    legal_classification: string;
    status: string;
    source_module: string;
    requires_statutory_evidence: boolean;
    published_at: string | null;
    created_at: string;
    recipient_count?: number;
    ack_count?: number;
  };
  my_acknowledgement: {
    id: string;
    acknowledged_at: string;
    ip_address_hash?: string;
  } | null;
  statutory_evidence: Array<{
    id: string;
    evidence_type: string;
    evidence_reference: string;
    occurred_at: string;
    verification_status: "pending_verification" | "verified" | "rejected";
    verified_at: string | null;
    notes: string | null;
  }>;
}

const views: View[] = [
  "official_notices",
  "channels",
  "announcements",
  "posts",
  "comments",
  "polls",
  "options",
  "results",
  "notifications",
  "links",
];

const hidden = new Set([
  "membership_id",
  "author_membership_id",
  "payload",
  "action_url",
  "party_id",
  "object_path",
  "attachment_path",
  "recipient_id",
  "respondent_id",
  "user_id",
  "email",
  "phone",
  "before_snapshot",
  "after_snapshot",
]);

const copy = {
  en: {
    title: "Communications, Notices & Delivery Evidence",
    sub: "Authorized notices, statutory delivery evidence, channel communications and notifications.",
    official_notices: "Official Notices",
    channels: "Channels",
    announcements: "Announcements",
    posts: "Posts",
    comments: "Comments",
    polls: "Polls",
    options: "Options",
    results: "Results",
    notifications: "Notifications",
    links: "Related records",
    search: "Search communications",
    all: "All",
    status: "Status",
    from: "From",
    to: "To",
    refresh: "Refresh",
    loading: "Loading communications…",
    empty: "No communications are visible in this context.",
    error: "Communications could not be loaded.",
    readonly: "Read-only · confidential responses aggregated",
    details: "Details",
    close: "Close",
    published: "Published posts",
    openPolls: "Open polls",
    unread: "Unread notifications",
    date: "Date",
    subject: "Subject",
    channel: "Channel / scope",
    result: "Result",
    state: "Status",
    newNotice: "Create Official Notice",
    statutoryBannerTitle: "Romanian Law 196/2018 (Arts. 47–50) Statutory Compliance Notice",
    statutoryBannerBody:
      "Electronic receipt acknowledgement provides operational proof of viewing only. It does NOT constitute statutory proof of convening or physical noticeboard display. Statutory proof requires physical noticeboard display records, nominal convening table signatures, or postal registered delivery with confirmation of receipt.",
    titleRo: "Title (Romanian - Required)",
    bodyRo: "Body Content (Romanian - Required)",
    titleEn: "Title (English - Optional)",
    bodyEn: "Body Content (English - Optional)",
    titleFa: "Title (Persian - Optional)",
    bodyFa: "Body Content (Persian - Optional)",
    commType: "Communication Type",
    legalClass: "Legal Classification",
    sourceModule: "Source Module",
    createDraft: "Save Notice Draft",
    creatingDraft: "Saving Draft…",
    noticeNo: "Notice #",
    recipients: "Recipients",
    acknowledged: "Acknowledged",
    verifiedEvidence: "Verified Evidence",
    approveNotice: "Approve Notice",
    publishNotice: "Publish & Freeze Recipients",
    cancelNotice: "Cancel Notice",
    ackReceipt: "Acknowledge Receipt",
    receiptAcknowledged: "Receipt Acknowledged",
    statutoryEvidenceTitle: "Statutory Delivery Evidence (Dual-Control)",
    recordEvidence: "Record Physical Evidence",
    evidenceType: "Evidence Type",
    evidenceRef: "Tracking / Registry Ref",
    occurredAt: "Date & Time",
    notes: "Notes",
    submitEvidence: "Record Evidence",
    verifyEvidence: "Verify Evidence",
    rejectEvidence: "Reject Evidence",
    viewDeliveries: "View Delivery Outbox",
    deliveriesTitle: "Delivery Outbox Attempts",
    deliveredAt: "Delivered At",
    attempt: "Attempt",
    successAction: "Action completed successfully.",
    failAction: "Action failed. Please review requirements.",
  },
  ro: {
    title: "Comunicări, avizier & dovezi de comunicare",
    sub: "Înștiințări oficiale, dovezi de comunicare legală, canale de discuții și notificări.",
    official_notices: "Avizier & Înștiințări",
    channels: "Canale",
    announcements: "Anunțuri",
    posts: "Postări",
    comments: "Comentarii",
    polls: "Sondaje",
    options: "Opțiuni",
    results: "Rezultate",
    notifications: "Notificări",
    links: "Înregistrări asociate",
    search: "Caută în comunicări",
    all: "Toate",
    status: "Stare",
    from: "De la",
    to: "Până la",
    refresh: "Reîncarcă",
    loading: "Se încarcă comunicările…",
    empty: "Nu există comunicări vizibile în acest context.",
    error: "Comunicările nu au putut fi încărcate.",
    readonly: "Doar citire · răspunsurile confidențiale sunt agregate",
    details: "Detalii",
    close: "Închide",
    published: "Postări publicate",
    openPolls: "Sondaje deschise",
    unread: "Notificări necitite",
    date: "Dată",
    subject: "Subiect",
    channel: "Canal / domeniu",
    result: "Rezultat",
    state: "Stare",
    newNotice: "Creează înștiințare oficială",
    statutoryBannerTitle: "Avertisment de conformitate legală: Legea 196/2018 (art. 47–50)",
    statutoryBannerBody:
      "Confirmarea electronică de primire oferă doar evidență operațională a vizualizării. Aceasta NU constituie dovadă legală de convocare a adunării generale sau de afișare la avizier. Dovada legală necesită proces-verbal de afișare fizică, tabel convocator olograf sau scrisoare recomandată cu confirmare de primire (AR).",
    titleRo: "Titlu (Română - Obligatoriu)",
    bodyRo: "Conținut (Română - Obligatoriu)",
    titleEn: "Titlu (Engleză - Opțional)",
    bodyEn: "Conținut (Engleză - Opțional)",
    titleFa: "Titlu (Persană - Opțional)",
    bodyFa: "Conținut (Persană - Opțional)",
    commType: "Tip comunicare",
    legalClass: "Clasificare legală",
    sourceModule: "Modul sursă",
    createDraft: "Salvează ciornă",
    creatingDraft: "Se salvează…",
    noticeNo: "Nr. înștiințare",
    recipients: "Destinatari",
    acknowledged: "Confirmări",
    verifiedEvidence: "Dovezi verificate",
    approveNotice: "Aprobă înștiințarea",
    publishNotice: "Publică și blochează destinatarii",
    cancelNotice: "Anulează înștiințarea",
    ackReceipt: "Confirmă primirea",
    receiptAcknowledged: "Primire confirmată",
    statutoryEvidenceTitle: "Dovezi legale de comunicare (Control dublu)",
    recordEvidence: "Înregistrează dovadă fizică",
    evidenceType: "Tip dovadă",
    evidenceRef: "Nr. referință / AWB / Registru",
    occurredAt: "Data și ora efectuării",
    notes: "Mențiuni",
    submitEvidence: "Înregistrează dovadă",
    verifyEvidence: "Validează dovadă",
    rejectEvidence: "Respinge dovadă",
    viewDeliveries: "Jurnal trimiteri",
    deliveriesTitle: "Încercări de trimitere către destinatari",
    deliveredAt: "Livrat la",
    attempt: "Încercare",
    successAction: "Operațiunea a fost finalizată cu succes.",
    failAction: "Operațiunea a eșuat. Verificați permisiunile și cerințele.",
  },
  fa: {
    title: "ارتباطات، ابلاغیه‌ها و شواهد قانونی تحویل",
    sub: "ابلاغیه‌های معتبر، شواهد قانونی تسلیم، محتوای کانال‌ها و اعلان‌ها.",
    official_notices: "ابلاغیه‌های رسمی",
    channels: "کانال‌ها",
    announcements: "اطلاعیه‌ها",
    posts: "پست‌ها",
    comments: "نظرها",
    polls: "نظرسنجی‌ها",
    options: "گزینه‌ها",
    results: "نتایج",
    notifications: "اعلان‌ها",
    links: "سوابق مرتبط",
    search: "جستجوی ارتباطات",
    all: "همه",
    status: "وضعیت",
    from: "از",
    to: "تا",
    refresh: "بازخوانی",
    loading: "در حال دریافت ارتباطات…",
    empty: "در این زمینه ارتباطی قابل مشاهده نیست.",
    error: "دریافت ارتباطات ناموفق بود.",
    readonly: "فقط خواندنی · پاسخ‌های محرمانه تجمیع شده‌اند",
    details: "جزئیات",
    close: "بستن",
    published: "پست‌های منتشرشده",
    openPolls: "نظرسنجی‌های باز",
    unread: "اعلان‌های خوانده‌نشده",
    date: "تاریخ",
    subject: "موضوع",
    channel: "کانال / دامنه",
    result: "نتیجه",
    state: "وضعیت",
    newNotice: "ثبت ابلاغیه رسمی جدید",
    statutoryBannerTitle: "تذکر انطباق قانونی: قانون ۱۹۶/۲۰۱۸ رومانی (مواد ۴۷ تا ۵۰)",
    statutoryBannerBody:
      "تأیید الکترونیکی دریافت تنها مدرک مشاهده سیستمی است و به منزله اثبات قانونی دعوت مجمع عمومی یا الصاق بر تابلوی اعلانات تلقی نمی‌شود. اثبات قانونی نیازمند صورتجلسه الصاق فیزیکی بر تابلوی اعلانات، امضای دفتر دست‌نویس دعوت، یا ارسال با پست سفارشی همراه با تأییدیه دریافت است.",
    titleRo: "عنوان (رومانیایی - الزامی)",
    bodyRo: "متن ابلاغیه (رومانیایی - الزامی)",
    titleEn: "عنوان (انگلیسی - اختیاری)",
    bodyEn: "متن ابلاغیه (انگلیسی - اختیاری)",
    titleFa: "عنوان (فارسی - اختیاری)",
    bodyFa: "متن ابلاغیه (فارسی - اختیاری)",
    commType: "نوع ارتباط",
    legalClass: "طبقه‌بندی حقوقی",
    sourceModule: "ماژول مرجع",
    createDraft: "ذخیره پیش‌نویس ابلاغیه",
    creatingDraft: "در حال ذخیره پیش‌نویس…",
    noticeNo: "شماره ابلاغیه",
    recipients: "گیرندگان",
    acknowledged: "تأییدشده‌ها",
    verifiedEvidence: "شواهد تأییدشده قانونی",
    approveNotice: "تصویب رسمی ابلاغیه",
    publishNotice: "انتشار و تثبیت فهرست گیرندگان",
    cancelNotice: "لغو ابلاغیه",
    ackReceipt: "اعلام وصول و تأیید دریافت",
    receiptAcknowledged: "وصول تأیید شد",
    statutoryEvidenceTitle: "شواهد قانونی تحویل و الصاق (کنترل دوطرفه)",
    recordEvidence: "ثبت مدرک فیزیکی / پستی",
    evidenceType: "نوع مدرک",
    evidenceRef: "شماره پیگیری / مرجع ثبتی",
    occurredAt: "تاریخ و زمان وقوع",
    notes: "توضیحات",
    submitEvidence: "ثبت شواهد",
    verifyEvidence: "تأیید رسمی شواهد",
    rejectEvidence: "رد شواهد",
    viewDeliveries: "کارتابل ارسال‌ها",
    deliveriesTitle: "تلاش‌های ارسال به گیرندگان",
    deliveredAt: "تحویل‌شده در",
    attempt: "تلاش",
    successAction: "عملیات با موفقیت انجام شد.",
    failAction: "عملیات ناموفق بود. لطفاً دسترسی‌ها و شرایط را بازبینی کنید.",
  },
} as const;

const show = (v: unknown) =>
  v == null || v === "" ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v);

const date = (v: unknown, l: string) =>
  v
    ? new Intl.DateTimeFormat(l === "fa" ? "fa-IR" : l === "ro" ? "ro-RO" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(String(v)))
    : "—";

export function CustomerCommunicationsDashboard({
  lang,
  initialView = "official_notices",
}: {
  lang: string;
  initialView?: View;
}) {
  const t = copy[lang === "fa" ? "fa" : lang === "ro" ? "ro" : "en"];
  const { active } = useCustomerContext();
  const [view, setView] = useState<View>(initialView);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [detailedNotice, setDetailedNotice] = useState<NoticeDetailData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (view === "official_notices") {
        const p = new URLSearchParams({
          context_id: active.context_id,
          limit: "20",
          offset: String(offset),
        });
        if (status) p.set("status", status);
        const r = await fetch(`/api/customer/v1/communications/notices?${p}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!r.ok) throw new Error();
        const json = await r.json();
        setData(json);
      } else {
        const p = new URLSearchParams({
          context_id: active.context_id,
          view,
          limit: "20",
          offset: String(offset),
        });
        if (query) p.set("query", query);
        if (status) p.set("status", status);
        if (from) p.set("from", from);
        if (to) p.set("to", to);
        const r = await fetch(`/api/customer/v1/communications?${p}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!r.ok) throw new Error();
        setData(await r.json());
      }
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

  const loadNoticeDetail = async (noticeId: string) => {
    if (!active) return;
    setLoadingDetail(true);
    setActionMessage(null);
    try {
      const res = await fetch(
        `/api/customer/v1/communications/notices/${noticeId}?context_id=${active.context_id}`,
        { cache: "no-store", credentials: "same-origin" }
      );
      if (res.ok) {
        const detail = await res.json();
        setDetailedNotice(detail);
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  return (
    <div className="space-y-5" dir={lang === "fa" ? "rtl" : "ltr"}>
      <header className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0E9F8E]">
              <Megaphone className="h-4 w-4" />
              C11 · Communications & Legal Notices
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-[#102A43]">{t.title}</h1>
            <p className="mt-1 text-sm text-[#52667A]">{t.sub}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-xl bg-[#0E9F8E] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#087A6E]"
            >
              <Plus className="h-4 w-4" />
              {t.newNotice}
            </button>
            <div className="h-fit rounded-xl border border-[#B2E5DF] bg-[#EAF8F5] px-3 py-2 text-xs font-bold text-[#0A6E62]">
              <ShieldCheck className="me-2 inline h-4 w-4" />
              {t.readonly}
            </div>
          </div>
        </div>
      </header>

      {/* Romanian Law 196/2018 Statutory Warning Banner */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div className="text-xs text-amber-900">
            <div className="font-bold text-amber-950">{t.statutoryBannerTitle}</div>
            <p className="mt-1 leading-relaxed">{t.statutoryBannerBody}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {views.map((v) => (
          <button
            type="button"
            key={v}
            onClick={() => {
              setView(v);
              setOffset(0);
              setStatus("");
              setSelected(null);
              setDetailedNotice(null);
            }}
            className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
              view === v
                ? "bg-[#0E9F8E] text-white shadow"
                : "border bg-white text-[#334E68] hover:bg-slate-50"
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
          className="rounded-xl border p-2 transition hover:bg-slate-50"
        >
          <RefreshCw className="mx-auto h-4 w-4 text-[#52667A]" />
        </button>
      </form>

      {data?.summary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label={t.channels} value={data.summary.channels} />
          <Metric label={t.published} value={data.summary.published_posts} />
          <Metric label={t.openPolls} value={data.summary.open_polls} />
          <Metric label={t.unread} value={data.summary.unread_notifications} />
        </div>
      ) : null}

      {loading ? (
        <Box value={t.loading} />
      ) : error ? (
        <Box value={error} />
      ) : !data?.rows?.length ? (
        <Box value={t.empty} />
      ) : view === "official_notices" ? (
        <>
          <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="bg-[#F6F9FC] text-[#52667A]">
                <tr>
                  <th className="p-3 text-start">{t.noticeNo}</th>
                  <th className="p-3 text-start">{t.subject}</th>
                  <th className="p-3 text-start">{t.commType}</th>
                  <th className="p-3 text-start">{t.legalClass}</th>
                  <th className="p-3 text-start">{t.state}</th>
                  <th className="p-3 text-start">{t.recipients}</th>
                  <th className="p-3 text-start">{t.acknowledged}</th>
                  <th className="p-3 text-start">{t.verifiedEvidence}</th>
                  <th className="p-3 text-start">{t.details}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((r) => {
                  const title =
                    lang === "ro"
                      ? r.title_ro
                      : lang === "fa"
                        ? r.title_fa || r.title_ro
                        : r.title_en || r.title_ro;
                  return (
                    <tr key={String(r.id)} className="hover:bg-slate-50/60">
                      <td className="p-3 font-mono font-bold text-[#102A43]">
                        #{show(r.notice_number)}
                      </td>
                      <td className="p-3 font-bold text-[#102A43]">{show(title)}</td>
                      <td className="p-3">
                        <span className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-700">
                          {show(r.communication_type)}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[11px] text-[#52667A]">
                        {show(r.legal_classification)}
                      </td>
                      <td className="p-3">
                        <StatusBadge status={String(r.status)} />
                      </td>
                      <td className="p-3 font-mono font-semibold text-[#102A43]">
                        {show(r.recipient_count ?? 0)}
                      </td>
                      <td className="p-3 font-mono font-semibold text-[#0E9F8E]">
                        {show(r.ack_count ?? 0)}
                      </td>
                      <td className="p-3 font-mono font-semibold text-[#2B6CB0]">
                        {show(r.verified_evidence_count ?? 0)}
                      </td>
                      <td className="p-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(r);
                            void loadNoticeDetail(String(r.id));
                          }}
                          className="font-bold text-[#087A6E] hover:underline"
                        >
                          {t.details}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination
            offset={offset}
            total={data.total}
            setOffset={setOffset}
          />
        </>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
            <table className="w-full min-w-[900px] text-xs">
              <thead className="bg-[#F6F9FC] text-[#52667A]">
                <tr>
                  <th className="p-3 text-start">{t.date}</th>
                  <th className="p-3 text-start">{t.subject}</th>
                  <th className="p-3 text-start">{t.channel}</th>
                  <th className="p-3 text-start">{t.result}</th>
                  <th className="p-3 text-start">{t.state}</th>
                  <th className="p-3 text-start">{t.details}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((r) => (
                  <tr key={String(r.id)} className="hover:bg-slate-50/60">
                    <Cells row={r} view={view} lang={lang} />
                    <td className="p-3">
                      <button
                        type="button"
                        onClick={() => setSelected(r)}
                        className="font-bold text-[#087A6E] hover:underline"
                      >
                        {t.details}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            offset={offset}
            total={data.total}
            setOffset={setOffset}
          />
        </>
      )}

      {/* Notice Detail & Action Dialog */}
      {selected && view === "official_notices" ? (
        <NoticeDetailModal
          lang={lang}
          noticeSummary={selected}
          detail={detailedNotice}
          loading={loadingDetail}
          actionMessage={actionMessage}
          setActionMessage={setActionMessage}
          onRefresh={() => {
            if (selected?.id) void loadNoticeDetail(String(selected.id));
            setNonce((n) => n + 1);
          }}
          close={() => {
            setSelected(null);
            setDetailedNotice(null);
            setActionMessage(null);
          }}
        />
      ) : selected ? (
        <Detail row={selected} close={() => setSelected(null)} label={t.close} />
      ) : null}

      {/* Create Draft Notice Modal */}
      {showCreateModal ? (
        <CreateNoticeModal
          lang={lang}
          close={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            setNonce((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  let bg = "bg-slate-100 text-slate-700";
  if (s === "published") bg = "bg-emerald-100 text-emerald-800";
  else if (s === "approved") bg = "bg-blue-100 text-blue-800";
  else if (s === "draft") bg = "bg-amber-100 text-amber-800";
  else if (s === "cancelled") bg = "bg-rose-100 text-rose-800";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${bg}`}>
      {status}
    </span>
  );
}

function Pagination({
  offset,
  total,
  setOffset,
}: {
  offset: number;
  total: number;
  setOffset: React.Dispatch<React.SetStateAction<number>>;
}) {
  return (
    <div className="flex justify-between text-xs text-[#52667A]">
      <span>
        {offset + 1}–{Math.min(offset + 20, total)} / {total}
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
          disabled={offset + 20 >= total}
          onClick={() => setOffset(offset + 20)}
          className="rounded-xl border bg-white p-2 disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="text-xs font-bold text-[#52667A]">
        <Bell className="me-1 inline h-4 w-4 text-[#0E9F8E]" />
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
  const when = r.published_at ?? r.opens_at ?? r.created_at ?? r.responded_at;
  const subject = r.title ?? r.question ?? r.name ?? r.label ?? r.post_title ?? r.type;
  const channel = r.channel_name ?? r.scope ?? r.entity_type ?? r.property_name;
  const value =
    view === "results" || view === "polls"
      ? r.option_totals
      : r.response_count ??
        r.comment_count ??
        r.reaction_count ??
        r.entity_label ??
        r.unread ??
        r.member;
  return (
    <>
      <td className="p-3">{date(when, lang)}</td>
      <td className="p-3 font-bold text-[#102A43]">{show(subject)}</td>
      <td className="p-3">{show(channel)}</td>
      <td className="p-3 font-mono">{show(value)}</td>
      <td className="p-3">{show(r.status ?? r.unread ?? r.relation_type)}</td>
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
        <div className="flex justify-end">
          <button type="button" onClick={close} aria-label={label} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          {Object.entries(row)
            .filter(([k]) => !hidden.has(k))
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

function NoticeDetailModal({
  lang,
  noticeSummary,
  detail,
  loading,
  actionMessage,
  setActionMessage,
  onRefresh,
  close,
}: {
  lang: string;
  noticeSummary: Record<string, unknown>;
  detail: NoticeDetailData | null;
  loading: boolean;
  actionMessage: string | null;
  setActionMessage: (msg: string | null) => void;
  onRefresh: () => void;
  close: () => void;
}) {
  const t = copy[lang === "fa" ? "fa" : lang === "ro" ? "ro" : "en"];
  const { active } = useCustomerContext();
  const [submitting, setSubmitting] = useState(false);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceType, setEvidenceType] = useState("noticeboard_posting");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [deliveries, setDeliveries] = useState<Record<string, unknown>[] | null>(null);
  const [loadingDeliveries, setLoadingDeliveries] = useState(false);

  const noticeId = String(noticeSummary.id);
  const noticeStatus = String(detail?.notice?.status ?? noticeSummary.status);

  const handleAction = async (endpoint: string, body: Record<string, unknown>) => {
    if (!active) return;
    setSubmitting(true);
    setActionMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context_id: active.context_id, ...body }),
      });
      if (res.ok) {
        setActionMessage(t.successAction);
        onRefresh();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setActionMessage(errJson?.error?.message || t.failAction);
      }
    } catch {
      setActionMessage(t.failAction);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecordEvidence = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setSubmitting(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/customer/v1/communications/notices/${noticeId}/evidence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_id: active.context_id,
          evidence_type: evidenceType,
          evidence_reference: evidenceRef,
          occurred_at: new Date(occurredAt).toISOString(),
          notes: evidenceNotes || null,
        }),
      });
      if (res.ok) {
        setShowEvidenceForm(false);
        setEvidenceRef("");
        setEvidenceNotes("");
        setActionMessage(t.successAction);
        onRefresh();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage(err?.error?.message || t.failAction);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyEvidence = async (evidenceId: string, decision: "verified" | "rejected") => {
    if (!active) return;
    setSubmitting(true);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/customer/v1/communications/evidence/${evidenceId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_id: active.context_id,
          decision,
        }),
      });
      if (res.ok) {
        setActionMessage(t.successAction);
        onRefresh();
      } else {
        const err = await res.json().catch(() => ({}));
        setActionMessage(err?.error?.message || t.failAction);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleLoadDeliveries = async () => {
    if (!active) return;
    setLoadingDeliveries(true);
    try {
      const res = await fetch(
        `/api/customer/v1/communications/notices/${noticeId}/deliveries?context_id=${active.context_id}&limit=50`,
        { cache: "no-store", credentials: "same-origin" }
      );
      if (res.ok) {
        const json = await res.json();
        setDeliveries(json.rows || []);
      }
    } finally {
      setLoadingDeliveries(false);
    }
  };

  const notice = detail?.notice;
  const title =
    lang === "ro"
      ? notice?.title_ro || noticeSummary.title_ro
      : lang === "fa"
        ? notice?.title_fa || noticeSummary.title_fa || notice?.title_ro || noticeSummary.title_ro
        : notice?.title_en || noticeSummary.title_en || notice?.title_ro || noticeSummary.title_ro;

  const body =
    lang === "ro"
      ? notice?.body_ro
      : lang === "fa"
        ? notice?.body_fa || notice?.body_ro
        : notice?.body_en || notice?.body_ro;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold text-slate-500">
              #{show(notice?.notice_number ?? noticeSummary.notice_number)}
            </span>
            <StatusBadge status={noticeStatus} />
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t.close}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {actionMessage ? (
          <div className="mt-4 rounded-xl border border-[#B2E5DF] bg-[#EAF8F5] p-3 text-xs font-bold text-[#0A6E62]">
            {actionMessage}
          </div>
        ) : null}

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">{t.loading}</div>
        ) : (
          <div className="mt-5 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-[#102A43]">{show(title)}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-[#52667A]">
                <span>
                  <strong>{t.commType}:</strong> {show(notice?.communication_type ?? noticeSummary.communication_type)}
                </span>
                <span>
                  <strong>{t.legalClass}:</strong> {show(notice?.legal_classification ?? noticeSummary.legal_classification)}
                </span>
                <span>
                  <strong>{t.date}:</strong> {date(notice?.created_at ?? noticeSummary.created_at, lang)}
                </span>
              </div>
            </div>

            {/* Notice Content Card */}
            <div className="rounded-2xl border bg-slate-50/50 p-5">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {lang === "ro" ? "Text Notificare" : lang === "fa" ? "متن ابلاغیه" : "Notice Body"}
              </div>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#102A43]">
                {show(body)}
              </div>
            </div>

            {/* Recipient Personal Acknowledgement Section */}
            {noticeStatus === "published" ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-emerald-950">
                      {detail?.my_acknowledgement ? t.receiptAcknowledged : t.ackReceipt}
                    </div>
                    <p className="mt-0.5 text-xs text-emerald-800">
                      {detail?.my_acknowledgement
                        ? `${t.acknowledged}: ${date(detail.my_acknowledgement.acknowledged_at, lang)}`
                        : "Confirming receipt logs your digital acknowledgement under AAL1."}
                    </p>
                  </div>
                  {!detail?.my_acknowledgement ? (
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() =>
                        void handleAction(`/api/customer/v1/communications/notices/${noticeId}/acknowledge`, {})
                      }
                      className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {t.ackReceipt}
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700 shadow-sm">
                      <CheckCircle2 className="h-4 w-4" />
                      {t.receiptAcknowledged}
                    </span>
                  )}
                </div>
              </div>
            ) : null}

            {/* Governance Action Workflow (Draft -> Approve -> Publish / Cancel) */}
            <div className="flex flex-wrap items-center gap-3 border-t pt-4">
              {noticeStatus === "draft" ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    void handleAction(`/api/customer/v1/communications/notices/${noticeId}/approve`, {
                      comments: "Approved via Customer Portal",
                    })
                  }
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
                >
                  <FileCheck className="h-4 w-4" />
                  {t.approveNotice}
                </button>
              ) : null}

              {noticeStatus === "approved" ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() =>
                    void handleAction(`/api/customer/v1/communications/notices/${noticeId}/publish`, {})
                  }
                  className="flex items-center gap-2 rounded-xl bg-[#0E9F8E] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#087A6E] disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                  {t.publishNotice}
                </button>
              ) : null}

              {noticeStatus === "draft" || noticeStatus === "approved" ? (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    const reason = prompt(lang === "fa" ? "دلیل لغو ابلاغیه را وارد کنید:" : "Reason for cancellation:");
                    if (reason) {
                      void handleAction(`/api/customer/v1/communications/notices/${noticeId}/cancel`, {
                        reason,
                      });
                    }
                  }}
                  className="flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  <AlertCircle className="h-4 w-4" />
                  {t.cancelNotice}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => void handleLoadDeliveries()}
                className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-xs font-bold text-[#334E68] transition hover:bg-slate-50"
              >
                <FileText className="h-4 w-4" />
                {t.viewDeliveries}
              </button>
            </div>

            {/* Delivery Outbox Drawer / Section */}
            {deliveries ? (
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#102A43]">{t.deliveriesTitle}</div>
                  <span className="font-mono text-xs text-slate-500">Total: {deliveries.length}</span>
                </div>
                {loadingDeliveries ? (
                  <div className="py-4 text-center text-xs text-slate-400">{t.loading}</div>
                ) : !deliveries.length ? (
                  <div className="py-4 text-center text-xs text-slate-500">No delivery attempts logged.</div>
                ) : (
                  <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border bg-white">
                    <table className="w-full text-[11px]">
                      <thead className="bg-[#F6F9FC] text-[#52667A]">
                        <tr>
                          <th className="p-2 text-start">Recipient</th>
                          <th className="p-2 text-start">Channel</th>
                          <th className="p-2 text-start">{t.attempt}</th>
                          <th className="p-2 text-start">{t.state}</th>
                          <th className="p-2 text-start">{t.deliveredAt}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y font-mono">
                        {deliveries.map((d, i) => (
                          <tr key={String(d.id || i)}>
                            <td className="p-2">{show(d.destination_masked)}</td>
                            <td className="p-2">{show(d.channel)}</td>
                            <td className="p-2">#{show(d.attempt_number)}</td>
                            <td className="p-2">
                              <StatusBadge status={String(d.status)} />
                            </td>
                            <td className="p-2">{date(d.delivered_at, lang)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}

            {/* Statutory Evidence Records & Dual-Control Verification */}
            <div className="border-t pt-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-sm font-bold text-[#102A43]">
                  {t.statutoryEvidenceTitle}
                </div>
                <button
                  type="button"
                  onClick={() => setShowEvidenceForm(!showEvidenceForm)}
                  className="flex items-center gap-1.5 rounded-xl border bg-white px-3 py-1.5 text-xs font-bold text-[#0E9F8E] transition hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t.recordEvidence}
                </button>
              </div>

              {/* Add Statutory Evidence Form */}
              {showEvidenceForm ? (
                <form
                  onSubmit={(e) => void handleRecordEvidence(e)}
                  className="mt-4 grid gap-3 rounded-2xl border bg-slate-50 p-4 sm:grid-cols-2"
                >
                  <label className="text-xs font-bold text-[#334E68]">
                    {t.evidenceType}
                    <select
                      value={evidenceType}
                      onChange={(e) => setEvidenceType(e.target.value)}
                      className="mt-1 w-full rounded-xl border bg-white p-2 text-xs font-normal"
                    >
                      <option value="noticeboard_posting">Noticeboard Posting (Afișare la avizier)</option>
                      <option value="nominal_convening_table">Nominal Convening Table (Tabel convocator)</option>
                      <option value="registered_postal_letter">Registered Postal Letter (Scrisoare recomandată AR)</option>
                      <option value="declared_content_postal_proof">Declared Content Postal Proof (Scrisoare cu conținut declarat)</option>
                      <option value="confirmation_of_receipt">Confirmation of Receipt (Confirmare de primire)</option>
                      <option value="dated_photocopy_display">Dated Photocopy Display (Fotocopie datată)</option>
                      <option value="signed_written_declaration">Signed Written Declaration (Declarație olografă)</option>
                      <option value="physical_evidence_reference">Physical Evidence Reference (Referință dovadă fizică)</option>
                    </select>
                  </label>

                  <label className="text-xs font-bold text-[#334E68]">
                    {t.evidenceRef}
                    <input
                      required
                      value={evidenceRef}
                      onChange={(e) => setEvidenceRef(e.target.value)}
                      placeholder="e.g. PV-2026/09, AWB RO12345678"
                      className="mt-1 w-full rounded-xl border bg-white p-2 text-xs font-normal"
                    />
                  </label>

                  <label className="text-xs font-bold text-[#334E68]">
                    {t.occurredAt}
                    <input
                      type="datetime-local"
                      required
                      value={occurredAt}
                      onChange={(e) => setOccurredAt(e.target.value)}
                      className="mt-1 w-full rounded-xl border bg-white p-2 text-xs font-normal"
                    />
                  </label>

                  <label className="text-xs font-bold text-[#334E68]">
                    {t.notes}
                    <input
                      value={evidenceNotes}
                      onChange={(e) => setEvidenceNotes(e.target.value)}
                      placeholder="Witness, location, photo record hash..."
                      className="mt-1 w-full rounded-xl border bg-white p-2 text-xs font-normal"
                    />
                  </label>

                  <div className="sm:col-span-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowEvidenceForm(false)}
                      className="rounded-xl border bg-white px-3 py-1.5 text-xs font-bold text-slate-600"
                    >
                      {t.close}
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rounded-xl bg-[#0E9F8E] px-4 py-1.5 text-xs font-bold text-white transition hover:bg-[#087A6E] disabled:opacity-50"
                    >
                      {t.submitEvidence}
                    </button>
                  </div>
                </form>
              ) : null}

              {/* Evidence List */}
              <div className="mt-3 space-y-2">
                {!detail?.statutory_evidence?.length ? (
                  <div className="rounded-xl border border-dashed bg-slate-50/50 p-4 text-center text-xs text-slate-500">
                    No statutory evidence records registered yet.
                  </div>
                ) : (
                  detail.statutory_evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3.5 shadow-sm"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#102A43]">
                            {ev.evidence_type}
                          </span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] text-slate-700">
                            Ref: {ev.evidence_reference}
                          </span>
                          <StatusBadge status={ev.verification_status} />
                        </div>
                        <div className="text-[11px] text-[#52667A]">
                          Occurred: {date(ev.occurred_at, lang)} {ev.notes ? `· ${ev.notes}` : ""}
                        </div>
                      </div>

                      {ev.verification_status === "pending_verification" ? (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void handleVerifyEvidence(ev.id, "verified")}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {t.verifyEvidence}
                          </button>
                          <button
                            type="button"
                            disabled={submitting}
                            onClick={() => void handleVerifyEvidence(ev.id, "rejected")}
                            className="rounded-lg border border-rose-200 bg-white px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            {t.rejectEvidence}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateNoticeModal({
  lang,
  close,
  onCreated,
}: {
  lang: string;
  close: () => void;
  onCreated: () => void;
}) {
  const t = copy[lang === "fa" ? "fa" : lang === "ro" ? "ro" : "en"];
  const { active } = useCustomerContext();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [titleRo, setTitleRo] = useState("");
  const [bodyRo, setBodyRo] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [bodyEn, setBodyEn] = useState("");
  const [titleFa, setTitleFa] = useState("");
  const [bodyFa, setBodyFa] = useState("");
  const [commType, setCommType] = useState("general_announcement");
  const [legalClass, setLegalClass] = useState("informational_optional");
  const [sourceModule, setSourceModule] = useState("general");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/v1/communications/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_id: active.context_id,
          title_ro: titleRo,
          body_ro: bodyRo,
          title_en: titleEn || null,
          body_en: bodyEn || null,
          title_fa: titleFa || null,
          body_fa: bodyFa || null,
          communication_type: commType,
          legal_classification: legalClass,
          source_module: sourceModule,
        }),
      });
      if (res.ok) {
        onCreated();
      } else {
        const errJson = await res.json().catch(() => ({}));
        setError(errJson?.error?.message || t.failAction);
      }
    } catch {
      setError(t.failAction);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4"
    >
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 className="text-lg font-extrabold text-[#102A43]">{t.newNotice}</h2>
          <button
            type="button"
            onClick={close}
            aria-label={t.close}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">
            {error}
          </div>
        ) : null}

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-[#334E68]">
              {t.commType}
              <select
                value={commType}
                onChange={(e) => setCommType(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-white p-2.5 text-xs font-normal"
              >
                <option value="general_announcement">General Announcement</option>
                <option value="general_meeting_convening">General Meeting Convening (Convocare AG)</option>
                <option value="noticeboard_mandatory">Noticeboard Mandatory (Afișare avizier)</option>
                <option value="executive_decision">Executive Committee Decision</option>
                <option value="urgent_safety">Urgent Safety / Emergency</option>
                <option value="debt_notice_reminder">Debt Notice / Reminder</option>
                <option value="maintenance_intervention">Maintenance Intervention</option>
                <option value="internal_governance_notice">Internal Governance Notice</option>
              </select>
            </label>

            <label className="text-xs font-bold text-[#334E68]">
              {t.legalClass}
              <select
                value={legalClass}
                onChange={(e) => setLegalClass(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-white p-2.5 text-xs font-normal"
              >
                <option value="informational_optional">Informational (Optional)</option>
                <option value="statutory_mandatory">Statutory Mandatory (Legea 196/2018)</option>
                <option value="contractual_mandatory">Contractual Mandatory</option>
                <option value="emergency_alert">Emergency Alert</option>
              </select>
            </label>

            <label className="text-xs font-bold text-[#334E68]">
              {t.sourceModule}
              <select
                value={sourceModule}
                onChange={(e) => setSourceModule(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-white p-2.5 text-xs font-normal"
              >
                <option value="general">General</option>
                <option value="governance">Governance</option>
                <option value="operations">Operations</option>
                <option value="billing">Billing</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </label>
          </div>

          <div className="space-y-3 rounded-2xl border bg-slate-50/50 p-4">
            <label className="block text-xs font-bold text-[#334E68]">
              {t.titleRo}
              <input
                required
                value={titleRo}
                onChange={(e) => setTitleRo(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm font-normal"
                placeholder="ex. Convocator Adunare Generală Ordinară 2026"
              />
            </label>
            <label className="block text-xs font-bold text-[#334E68]">
              {t.bodyRo}
              <textarea
                required
                rows={4}
                value={bodyRo}
                onChange={(e) => setBodyRo(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-white p-2.5 text-sm font-normal"
                placeholder="Conținutul oficial al înștiințării..."
              />
            </label>
          </div>

          {/* Trilingual English & Persian expansion */}
          <details className="rounded-2xl border bg-white p-3 text-xs">
            <summary className="cursor-pointer font-bold text-[#0E9F8E]">
              + English & Persian Translations (Optional)
            </summary>
            <div className="mt-3 space-y-3 border-t pt-3">
              <label className="block text-xs font-bold text-[#334E68]">
                {t.titleEn}
                <input
                  value={titleEn}
                  onChange={(e) => setTitleEn(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-white p-2 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-bold text-[#334E68]">
                {t.bodyEn}
                <textarea
                  rows={3}
                  value={bodyEn}
                  onChange={(e) => setBodyEn(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-white p-2 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-bold text-[#334E68]">
                {t.titleFa}
                <input
                  dir="rtl"
                  value={titleFa}
                  onChange={(e) => setTitleFa(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-white p-2 text-sm font-normal text-right"
                />
              </label>
              <label className="block text-xs font-bold text-[#334E68]">
                {t.bodyFa}
                <textarea
                  dir="rtl"
                  rows={3}
                  value={bodyFa}
                  onChange={(e) => setBodyFa(e.target.value)}
                  className="mt-1 w-full rounded-xl border bg-white p-2 text-sm font-normal text-right"
                />
              </label>
            </div>
          </details>

          <div className="flex justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={close}
              className="rounded-xl border bg-white px-4 py-2 text-xs font-bold text-[#334E68] transition hover:bg-slate-50"
            >
              {t.close}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[#0E9F8E] px-5 py-2 text-xs font-bold text-white transition hover:bg-[#087A6E] disabled:opacity-50"
            >
              {submitting ? t.creatingDraft : t.createDraft}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
