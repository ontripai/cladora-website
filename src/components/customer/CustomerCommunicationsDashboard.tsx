"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  FileText,
  Megaphone,
  MessageCircle,
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
    finishEvidenceDraft: "Save or close the evidence form before changing the list filters.",
    previous: "Previous page",
    next: "Next page",
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
    finishEvidenceDraft: "Salvați sau închideți formularul de dovezi înainte de a schimba filtrele listei.",
    previous: "Pagina anterioară",
    next: "Pagina următoare",
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
    finishEvidenceDraft: "پیش از تغییر فیلترهای فهرست، فرم شواهد را ذخیره کنید یا ببندید.",
    previous: "صفحه قبل",
    next: "صفحه بعد",
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

// A reader owns its debounce timer/controller and fences even transports which
// resolve after abort. Changing identity removes old content during render.
function useNoticeRead<T>(url: string | null, scope: string, failure: string, nonce = 0, delay = 0, expectedNoticeId?: string) {
  const identity = JSON.stringify([scope, url, nonce, failure]);
  const empty = { identity, data: null as T | null, loading: Boolean(url), error: "" };
  const [state, setState] = useState(empty);
  if (state.identity !== identity) setState(empty);
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    const timer = setTimeout(async () => {
      if (!url) return;
      try {
        const response = await fetch(url, { cache: "no-store", credentials: "same-origin", signal: controller.signal });
        if (!response.ok) throw new Error("notice_read_failed");
        const data = await response.json() as T;
        if (expectedNoticeId) {
          const detail = data as NoticeDetailData;
          if (detail?.notice?.id !== expectedNoticeId || typeof detail.notice.status !== "string") throw new Error("notice_identity_mismatch");
        }
        if (current && !controller.signal.aborted) setState({ identity, data, loading: false, error: "" });
      } catch {
        if (current && !controller.signal.aborted) setState({ identity, data: null, loading: false, error: failure });
      }
    }, delay);
    return () => { current = false; clearTimeout(timer); controller.abort(); };
  }, [url, identity, failure, delay, expectedNoticeId]);
  return state.identity === identity ? state : empty;
}

// Mutation responses may finish after navigation; never write feedback or
// trigger refresh in another mounted notice. Mutations themselves are unchanged.
function useNoticeLifetime() {
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  return useCallback(() => alive.current, []);
}

// All detail dialogs share local keyboard containment and restore their opener.
function useNoticeDialog(close: () => void) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const fallback = dialog.current?.parentElement?.querySelector<HTMLElement>("button[data-notice-refresh]");
    dialog.current?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
      else if (fallback?.isConnected) fallback.focus();
    };
  }, []);
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key !== "Tab") return;
    const nodes = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []);
    const first = nodes[0]; const last = nodes[nodes.length - 1];
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { event.preventDefault(); first.focus(); }
  };
  return { ref: dialog, tabIndex: -1, onKeyDown };
}

export function CustomerCommunicationsDashboard({
  lang,
  initialView = "official_notices",
}: {
  lang: string;
  initialView?: View;
}) {
  const t = copy[lang === "fa" ? "fa" : lang === "ro" ? "ro" : "en"];
  const { active } = useCustomerContext();
  const canManageNotices = ["association_admin", "property_manager", "president"].includes(
    active?.role_code?.toLowerCase() ?? ""
  );
  const [view, setView] = useState<View>(initialView);
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [nonce, setNonce] = useState(0);
  const [ackDenial, setAckDenial] = useState({ scope: "", denied: false });
  const [hasEvidenceDraft, setHasEvidenceDraft] = useState(false);
  // Identity includes server-derived membership/role, not a guessed capability.
  const contextScope = JSON.stringify([active?.context_id, active?.membership_id, active?.role_code]);
  if (ackDenial.scope !== contextScope) setAckDenial({ scope: contextScope, denied: false });
  const ackAccessDenied = ackDenial.scope === contextScope && ackDenial.denied;
  const scope = JSON.stringify([contextScope, view, offset, query, status, from, to]);
  const [selection, setSelection] = useState<{ scope: string; row: Record<string, unknown> | null }>({ scope, row: null });
  // Adjust on render so previous content is absent even before effect cleanup.
  // Reset the tag too: A -> B -> A must not resurrect an old selection.
  if (selection.scope !== scope) setSelection({ scope, row: null });
  const selected = selection.scope === scope ? selection.row : null;
  const setSelected = (row: Record<string, unknown> | null) => setSelection({ scope, row });
  const [creation, setCreation] = useState({ scope: contextScope, open: false });
  if (creation.scope !== contextScope) setCreation({ scope: contextScope, open: false });
  const showCreateModal = creation.scope === contextScope && creation.open;
  const setShowCreateModal = (open: boolean) => setCreation({ scope: contextScope, open });

  const params = new URLSearchParams({ context_id: active?.context_id ?? "", limit: "20", offset: String(offset) });
  if (status) params.set("status", status);
  if (view !== "official_notices") {
    params.set("view", view);
    if (query) params.set("query", query);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
  }
  const listUrl = active && !ackAccessDenied ? `/api/customer/v1/communications${view === "official_notices" ? "/notices" : ""}?${params}` : null;
  const { data, loading, error: readError } = useNoticeRead<Payload>(listUrl, scope, t.error, nonce, 150);
  const error = ackAccessDenied ? t.error : readError;
  const detailUrl = active && selected && view === "official_notices" && !error
    ? `/api/customer/v1/communications/notices/${encodeURIComponent(String(selected.id))}?context_id=${encodeURIComponent(active.context_id)}` : null;
  const detailRead = useNoticeRead<NoticeDetailData>(detailUrl, scope, t.error, nonce, 0, selected ? String(selected.id) : undefined);

  return (
    <div className="min-w-0 max-w-full space-y-5 [overflow-wrap:anywhere] [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-2 [&_input]:min-h-11 [&_input]:min-w-0 [&_select]:min-h-11 [&_select]:min-w-0" dir={lang === "fa" ? "rtl" : "ltr"}>
      <header className="rounded-2xl border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0E9F8E]">
              <Megaphone className="h-4 w-4" />
              C11 · Communications & Legal Notices
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-[#102A43]">{t.title}</h1>
            <p className="mt-1 text-sm text-[#52667A]">{t.sub}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/${lang}/app/communications/private`}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#0E9F8E] bg-[#EAF8F5] px-4 py-2.5 text-sm font-bold text-[#0A6E62] shadow-sm transition hover:border-[#087A6E] hover:bg-[#D6F1EB] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#087A6E]"
            >
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
              {{ ro: "Conversații private", en: "Private conversations", fa: "گفت‌وگوهای خصوصی" }[lang === "fa" ? "fa" : lang === "ro" ? "ro" : "en"]}
            </Link>
            {canManageNotices ? <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-xl bg-[#0E9F8E] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#087A6E]"
            >
              <Plus className="h-4 w-4" />
              {t.newNotice}
            </button> : null}
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
            aria-pressed={view === v}
            disabled={hasEvidenceDraft}
            onClick={() => {
              if (hasEvidenceDraft) return;
              setView(v);
              setOffset(0);
              setStatus("");
              setSelected(null);
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

      {hasEvidenceDraft ? <p role="status" className="text-sm text-[#52667A]">{t.finishEvidenceDraft}</p> : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (hasEvidenceDraft) return;
          setOffset(0);
          setQuery(draft.trim());
        }}
        className="grid min-w-0 gap-3 rounded-2xl border bg-white p-4 shadow-sm md:grid-cols-6 [&>input]:w-full [&>input]:max-w-full"
      >
        <label className="relative md:col-span-2">
          <Search className="absolute start-3 top-2.5 h-4 w-4 text-[#7B8A9A]" />
          <span className="sr-only">{t.search}</span>
          <input
            value={draft}
            disabled={hasEvidenceDraft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.search}
            className="w-full rounded-xl border py-2 pe-3 ps-9 text-sm"
          />
        </label>
        <input
          disabled={hasEvidenceDraft}
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
          disabled={hasEvidenceDraft}
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
          disabled={hasEvidenceDraft}
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
          data-notice-refresh
          onClick={() => {
            // Explicit revalidation starts a new reader generation; it grants
            // no access and cannot reuse pre-denial list/detail state.
            if (ackAccessDenied) setAckDenial({ scope: contextScope, denied: false });
            setNonce((n) => n + 1);
          }}
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
        <Box value={error} alert />
      ) : !data?.rows?.length ? (
        <Box value={t.empty} />
      ) : view === "official_notices" ? (
        <>
          <div role="region" aria-label={t[view]} tabIndex={0} className="min-w-0 max-w-full overflow-x-auto rounded-2xl border bg-white shadow-sm">
            <table className="w-full min-w-[900px] table-fixed text-xs">
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
            setOffset={(next) => { if (!hasEvidenceDraft) setOffset(next); }}
            locked={hasEvidenceDraft}
            previousLabel={t.previous}
            nextLabel={t.next}
          />
        </>
      ) : (
        <>
          <div role="region" aria-label={t[view]} tabIndex={0} className="min-w-0 max-w-full overflow-x-auto rounded-2xl border bg-white shadow-sm">
            <table className="w-full min-w-[900px] table-fixed text-xs">
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
            setOffset={(next) => { if (!hasEvidenceDraft) setOffset(next); }}
            locked={hasEvidenceDraft}
            previousLabel={t.previous}
            nextLabel={t.next}
          />
        </>
      )}

      {/* Notice Detail & Action Dialog */}
      {selected && view === "official_notices" ? (
        <NoticeDetailModal
          key={`${scope}:${String(selected.id)}`}
          lang={lang}
          noticeSummary={selected}
          onAccessDenied={() => { setAckDenial({ scope: contextScope, denied: true }); setSelected(null); }}
          onDraftChange={setHasEvidenceDraft}
          detail={error ? null : detailRead.data}
          loading={detailRead.loading}
          error={error || detailRead.error}
          onRefresh={() => {
            setNonce((n) => n + 1);
          }}
          close={() => setSelected(null)}
        />
      ) : selected && !error ? (
        <Detail key={`${scope}:${String(selected.id)}`} row={selected} close={() => setSelected(null)} label={t.close} title={t.details} />
      ) : null}

      {/* Create Draft Notice Modal */}
      {showCreateModal && canManageNotices ? (
        <CreateNoticeModal
          key={contextScope}
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
  previousLabel,
  nextLabel,
  locked,
}: {
  locked: boolean;
  previousLabel: string;
  nextLabel: string;
  offset: number;
  total: number;
  setOffset: (offset: number) => void;
}) {
  return (
    <div className="flex justify-between text-xs text-[#52667A]">
      <span>
        {offset + 1}–{Math.min(offset + 20, total)} / {total}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          aria-label={previousLabel}
          disabled={locked || !offset}
          onClick={() => setOffset(Math.max(0, offset - 20))}
          className="rounded-xl border bg-white p-2 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </button>
        <button
          type="button"
          aria-label={nextLabel}
          disabled={locked || offset + 20 >= total}
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

function Box({ value, alert = false }: { value: string; alert?: boolean }) {
  return (
    <div role={alert ? "alert" : "status"} className="rounded-2xl border bg-white p-10 text-center text-sm text-[#52667A] shadow-sm">
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
      <td className="p-3 font-mono">{view === "notifications" ? "—" : show(value)}</td>
      <td className="p-3">{view === "notifications" ? (r.unread ? (lang === "fa" ? "خوانده‌نشده" : lang === "ro" ? "Necitită" : "Unread") : (lang === "fa" ? "خوانده‌شده" : lang === "ro" ? "Citită" : "Read")) : show(r.status ?? r.unread ?? r.relation_type)}</td>
    </>
  );
}

function Detail({
  row,
  close,
  label,
  title,
}: {
  title: string;
  row: Record<string, unknown>;
  close: () => void;
  label: string;
}) {
  const dialog = useNoticeDialog(close);
  return (
    <div
      {...dialog}
      role="dialog"
      aria-label={title}
      aria-modal="true"
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4"
    >
      <div className="max-h-[85dvh] min-w-0 w-full max-w-2xl overflow-auto rounded-2xl bg-white p-6 shadow-xl">
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
  onAccessDenied,
  onDraftChange,
  detail,
  loading,
  error,
  onRefresh,
  close,
}: {
  lang: string;
  noticeSummary: Record<string, unknown>;
  onAccessDenied: () => void;
  onDraftChange: (dirty: boolean) => void;
  detail: NoticeDetailData | null;
  loading: boolean;
  error: string;
  onRefresh: () => void;
  close: () => void;
}) {
  const t = copy[lang === "fa" ? "fa" : lang === "ro" ? "ro" : "en"];
  const { active } = useCustomerContext();
  const isCurrent = useNoticeLifetime();
  const dialog = useNoticeDialog(close);
  const titleId = useId();
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showEvidenceForm, setShowEvidenceForm] = useState(false);
  const [evidenceType, setEvidenceType] = useState("noticeboard_posting");
  const [evidenceRef, setEvidenceRef] = useState("");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [deliveriesRevision, setDeliveriesRevision] = useState(0);
  const deliveriesRequested = deliveriesRevision > 0;
  const deliveryRead = useNoticeRead<{ rows: Record<string, unknown>[] }>(
    active && deliveriesRequested ? `/api/customer/v1/communications/notices/${encodeURIComponent(String(noticeSummary.id))}/deliveries?context_id=${encodeURIComponent(active.context_id)}&limit=50` : null,
    JSON.stringify([active?.context_id, active?.membership_id, noticeSummary.id]), t.error, deliveriesRevision);
  const deliveries = deliveryRead.data?.rows ?? null;
  const { registerUnsavedGuard } = useCustomerContext();
  const guardId = useId();
  const [evidenceTouched, setEvidenceTouched] = useState(false);
  const evidenceDirty = showEvidenceForm && evidenceTouched;
  useEffect(() => {
    onDraftChange(evidenceDirty);
    return () => onDraftChange(false);
  }, [onDraftChange, evidenceDirty]);
  useEffect(() => registerUnsavedGuard(guardId, evidenceDirty, close), [registerUnsavedGuard, guardId, evidenceDirty, close]);

  const noticeId = String(noticeSummary.id);
  const noticeStatus = String(detail?.notice?.status ?? noticeSummary.status);
  // A receipt is display state, never authority. Only accept the canonical flat
  // object; malformed/legacy wrappers must not look like an acknowledgement.
  const rawAcknowledgement: unknown = detail?.my_acknowledgement;
  const detailAcknowledgement = rawAcknowledgement !== null
    && typeof rawAcknowledgement === "object"
    && !Array.isArray(rawAcknowledgement)
    && "id" in rawAcknowledgement
    && typeof rawAcknowledgement.id === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawAcknowledgement.id)
    && "acknowledged_at" in rawAcknowledgement
    && typeof rawAcknowledgement.acknowledged_at === "string"
    && /^\d{4}-\d{2}-\d{2}T/.test(rawAcknowledgement.acknowledged_at)
    && Number.isFinite(Date.parse(rawAcknowledgement.acknowledged_at))
      ? { id: rawAcknowledgement.id, acknowledged_at: rawAcknowledgement.acknowledged_at }
      : null;
  const acknowledgementKnown = rawAcknowledgement === null || detailAcknowledgement !== null;


  type AckIntent = { v: 1; context: string; membership: string; notice: string; phase: "unknown" | "conflict" };
  type Receipt = { id: string; acknowledged_at: string };
  type AckState = { phase: "loading" | "ready" | "sending" | "unknown" | "checking" | "retry" | "conflict" | "blocked" | "done";
    intent: AckIntent | null; receipt: Receipt | null };
  const ackCopy = {
    en: { unknown: "Receipt outcome is unknown. Check before retrying.", check: "Check receipt result", retry: "Retry same receipt", sending: "Recording receipt…", checking: "Checking receipt…", blocked: "Receipt is blocked. Check the result; do not resend.", storage: "Pending receipt cannot be safely restored or saved. Sending is blocked; an earlier result may still exist.", retryReady: "No receipt was found. You may explicitly retry the same request." },
    ro: { unknown: "Rezultatul confirmării este necunoscut. Verifică înainte de reîncercare.", check: "Verifică rezultatul confirmării", retry: "Reîncearcă aceeași confirmare", sending: "Se înregistrează confirmarea…", checking: "Se verifică confirmarea…", blocked: "Confirmarea este blocată. Verifică rezultatul; nu retrimite.", storage: "Confirmarea nu poate fi restaurată sau salvată sigur. Trimiterea este blocată; un rezultat anterior poate exista.", retryReady: "Nu s-a găsit confirmarea. Poți reîncerca explicit aceeași cerere." },
    fa: { unknown: "نتیجهٔ ثبت وصول نامشخص است. پیش از تلاش مجدد بررسی کنید.", check: "بررسی نتیجهٔ وصول", retry: "تلاش مجدد همان وصول", sending: "در حال ثبت وصول…", checking: "در حال بررسی وصول…", blocked: "وصول مسدود است. نتیجه را بررسی کنید؛ دوباره ارسال نکنید.", storage: "ذخیره یا بازیابی امن درخواست ممکن نیست. ارسال مسدود است؛ ممکن است نتیجهٔ قبلی وجود داشته باشد.", retryReady: "رسیدی یافت نشد. می‌توانید همان درخواست را صریحاً دوباره ارسال کنید." },
  }[lang === "fa" ? "fa" : lang === "ro" ? "ro" : "en"];
  const ackIdentity = JSON.stringify([active?.context_id, active?.membership_id, noticeId]);
  const ackStorageKey = `cladora:notice-ack:v1:${ackIdentity}`;
  const [ackState, setAckState] = useState<AckState>({ phase: "loading", intent: null, receipt: null });
  const ackStateRef = useRef(ackState);
  const ackIdentityRef = useRef(ackIdentity);
  const ackFlight = useRef(false);
  const ackSequence = useRef(0);
  const ackRequest = useRef<{ controller: AbortController; timer: ReturnType<typeof setTimeout>; cancel: () => void } | null>(null);
  const setAck = (next: AckState) => { ackStateRef.current = next; setAckState(next); };
  const validReceipt = (value: unknown): value is Receipt => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const r = value as Record<string, unknown>;
    return typeof r.id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(r.id)
      && typeof r.acknowledged_at === "string" && /^\d{4}-\d{2}-\d{2}T/.test(r.acknowledged_at)
      && Number.isFinite(Date.parse(r.acknowledged_at));
  };
  useEffect(() => {
    const sequence = ackSequence;
    const restore = (next: AckState) => { ackStateRef.current = next; setAckState(next); };
    try {
      const raw = window.sessionStorage.getItem(ackStorageKey);
      if (raw === null) restore({ phase: "ready", intent: null, receipt: null });
      else {
        if (raw.length > 4096) throw new Error("invalid_pending_size");
        const value = JSON.parse(raw);
        if (!value || typeof value !== "object" || Array.isArray(value)
          || Object.keys(value).sort().join() !== "context,membership,notice,phase,v"
          || value.v !== 1 || value.context !== active?.context_id || value.membership !== active?.membership_id
          || value.notice !== noticeId || !["unknown", "conflict"].includes(value.phase)) throw new Error("invalid_pending");
        restore({ phase: value.phase, intent: value, receipt: null });
      }
    } catch { restore({ phase: "blocked", intent: null, receipt: null }); }
    return () => {
      sequence.current++;
      ackRequest.current?.controller.abort();
      ackRequest.current?.cancel();
      if (ackRequest.current) clearTimeout(ackRequest.current.timer);
      ackRequest.current = null;
    };
  }, [ackStorageKey, active?.context_id, active?.membership_id, noticeId]);
  const myAcknowledgement = ackState.receipt ?? (ackState.intent ? null : detailAcknowledgement);
  const acknowledge = async (check: boolean) => {
    const before = ackStateRef.current;
    if (!active || !detail || loading || error || submitting || ackFlight.current || !isCurrent()) return;
    if (check ? !before.intent || !["unknown", "retry", "conflict"].includes(before.phase)
      : !(before.phase === "ready" && !before.intent && acknowledgementKnown && !detailAcknowledgement) && before.phase !== "retry") return;
    const intent: AckIntent = before.intent ?? { v: 1, context: active.context_id, membership: active.membership_id, notice: noticeId, phase: "unknown" };
    // Freeze the existing endpoint/body BEFORE dispatch, including explicit retries.
    const endpoint = `/api/customer/v1/communications/notices/${encodeURIComponent(intent.notice)}`;
    const body = JSON.stringify({ context_id: intent.context });
    const identity = ackIdentity;
    const sequence = ++ackSequence.current;
    const current = () => isCurrent() && ackIdentityRef.current === identity && ackSequence.current === sequence;
    ackFlight.current = true;
    if (!check) {
      try {
        const stored = JSON.stringify({ ...intent, phase: "unknown" });
        window.sessionStorage.setItem(ackStorageKey, stored);
        if (window.sessionStorage.getItem(ackStorageKey) !== stored) throw new Error("pending_not_saved");
      } catch {
        setAck({ phase: "blocked", intent: before.intent, receipt: null }); ackFlight.current = false; return;
      }
    }
    setAck({ phase: check ? "checking" : "sending", intent, receipt: null });
    setSubmitting(true);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let cancel = () => {};
    const deadline = new Promise<never>((_, reject) => { cancel = () => reject(new Error("ack_unmounted")); timer = setTimeout(() => { controller.abort(); reject(new Error("unknown_timeout")); }, 15000); });
    ackRequest.current = { controller, timer: timer!, cancel };
    try {
      const result = await Promise.race([(async () => {
        const response = await fetch(check ? `${endpoint}?context_id=${encodeURIComponent(intent.context)}` : `${endpoint}/acknowledge`,
          check ? { cache: "no-store", credentials: "same-origin", signal: controller.signal }
            : { method: "POST", headers: { "Content-Type": "application/json" }, body, signal: controller.signal });
        if (!current()) throw new Error("stale_ack");
        if ([401, 403, 409].includes(response.status) || !response.ok) return { response, data: null };
        const data: unknown = await response.json();
        if (!current()) throw new Error("stale_ack_body");
        return { response, data };
      })(), deadline]);
      if (!current()) return;
      const { response, data } = result;
      if (response.status === 401 || response.status === 403) { onAccessDenied(); return; }
      const conflict = () => {
        const blocked: AckIntent = { ...intent, phase: "conflict" };
        try { window.sessionStorage.setItem(ackStorageKey, JSON.stringify(blocked)); } catch { /* Pending remains; no dispatch follows. */ }
        setAck({ phase: "conflict", intent: blocked, receipt: null });
      };
      if (response.status === 409) { conflict(); return; }
      if (!response.ok) { setAck({ phase: before.phase === "conflict" ? "conflict" : "unknown", intent, receipt: null }); return; }
      let receipt: Receipt | null = null;
      if (check) {
        if (!data || typeof data !== "object" || Array.isArray(data)) { conflict(); return; }
        const d = data as Record<string, unknown>;
        const n = d.notice as Record<string, unknown> | undefined;
        if (!n || n.id !== intent.notice || n.status !== "published"
          || typeof n.tenant_id !== "string" || n.tenant_id !== (detail.notice as unknown as Record<string, unknown>).tenant_id) { conflict(); return; }
        const a = d.my_acknowledgement;
        if (a === null) { setAck({ phase: before.phase === "conflict" ? "conflict" : "retry", intent, receipt: null }); return; }
        if (!validReceipt(a)) { conflict(); return; }
        const evidence = a as Receipt & Record<string, unknown>;
        if (evidence.notice_id !== intent.notice || evidence.membership_id !== intent.membership
          || typeof n.tenant_id !== "string" || evidence.tenant_id !== n.tenant_id
          || evidence.acknowledgement_method !== "in_app_click" || evidence.evidence_checksum !== null || evidence.notes !== null) { conflict(); return; }
        receipt = a;
      } else if (data && typeof data === "object" && !Array.isArray(data)) {
        const d = data as Record<string, unknown>;
        const candidate = { id: d.acknowledgement_id, acknowledged_at: d.acknowledged_at };
        if (d.success === true && d.is_statutory_proof === false && validReceipt(candidate)) receipt = candidate;
      }
      if (!receipt) { setAck({ phase: "unknown", intent, receipt: null }); return; }
      try { window.sessionStorage.removeItem(ackStorageKey); } catch { /* Retained pending permits a future read, never automatic replay. */ }
      setAck({ phase: "done", intent: null, receipt });
    } catch {
      if (current()) setAck({ phase: before.phase === "conflict" ? "conflict" : "unknown", intent, receipt: null });
    } finally {
      clearTimeout(timer!);
      if (current()) { ackFlight.current = false; ackRequest.current = null; setSubmitting(false); }
    }
  };

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
      if (!isCurrent()) return;
      if (res.ok) {
        setActionMessage(t.successAction);
        onRefresh();
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (!isCurrent()) return;
        setActionMessage(errJson?.error?.message || t.failAction);
      }
    } catch {
      if (isCurrent()) setActionMessage(t.failAction);
    } finally {
      if (isCurrent()) setSubmitting(false);
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
      if (!isCurrent()) return;
      if (res.ok) {
        setShowEvidenceForm(false);
        setEvidenceRef("");
        setEvidenceNotes("");
        setActionMessage(t.successAction);
        onRefresh();
      } else {
        const err = await res.json().catch(() => ({}));
        if (!isCurrent()) return;
        setActionMessage(err?.error?.message || t.failAction);
      }
    } catch {
      if (isCurrent()) setActionMessage(t.failAction);
    } finally {
      if (isCurrent()) setSubmitting(false);
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
      if (!isCurrent()) return;
      if (res.ok) {
        setActionMessage(t.successAction);
        onRefresh();
      } else {
        const err = await res.json().catch(() => ({}));
        if (!isCurrent()) return;
        setActionMessage(err?.error?.message || t.failAction);
      }
    } catch {
      if (isCurrent()) setActionMessage(t.failAction);
    } finally {
      if (isCurrent()) setSubmitting(false);
    }
  };

  const notice = detail?.notice;
  // A newer detail response can redact a translation: never revive an older
  // summary translation in preference to the current server response.
  const title = lang === "ro" ? notice?.title_ro
    : lang === "fa" ? notice?.title_fa || notice?.title_ro
    : notice?.title_en || notice?.title_ro;

  const body =
    lang === "ro"
      ? notice?.body_ro
      : lang === "fa"
        ? notice?.body_fa || notice?.body_ro
        : notice?.body_en || notice?.body_ro;

  return (
    <div
      {...dialog}
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4"
    >
      <div className="max-h-[90dvh] min-w-0 w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-4 sm:p-6 shadow-2xl">
        <h2 id={titleId} className="sr-only">{t.details}</h2>
        <div className="flex items-center justify-between gap-3 border-b pb-4">
          <div className="flex flex-wrap items-center gap-3">
            {!error ? (
              <>
                <span className="font-mono text-sm font-bold text-slate-500">
                  #{show(notice?.notice_number ?? noticeSummary.notice_number)}
                </span>
                <StatusBadge status={noticeStatus} />
              </>
            ) : null}
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

        {actionMessage && !error ? (
          <div role="status" className="mt-4 rounded-xl border border-[#B2E5DF] bg-[#EAF8F5] p-3 text-xs font-bold text-[#0A6E62]">
            {actionMessage}
          </div>
        ) : null}

        {error ? <div role="alert" className="mt-4 rounded-xl border p-4">{error}</div> : loading ? (
          <div role="status" className="p-8 text-center text-xs text-slate-500">{t.loading}</div>
        ) : detail ? (
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
            {ackState.phase !== "ready" && ackState.phase !== "done" && ackState.phase !== "loading" ? (
              <div role="status" aria-live="polite" className="rounded-xl border p-3 text-sm">
                {ackState.phase === "sending" ? ackCopy.sending : ackState.phase === "checking" ? ackCopy.checking
                  : ackState.phase === "blocked" ? ackCopy.storage : ackState.phase === "conflict" ? ackCopy.blocked
                  : ackState.phase === "retry" ? ackCopy.retryReady : ackCopy.unknown}
                {ackState.intent && ["unknown", "retry", "conflict"].includes(ackState.phase) ? (
                  <button type="button" className="ms-3 rounded-lg border px-3 py-2" onClick={() => { void acknowledge(true); }}>{ackCopy.check}</button>
                ) : null}
              </div>
            ) : null}

            {noticeStatus === "published" ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-emerald-950">
                      {myAcknowledgement ? t.receiptAcknowledged : t.ackReceipt}
                    </div>
                    <p role={acknowledgementKnown ? undefined : "alert"} className="mt-0.5 text-xs text-emerald-800">
                      {myAcknowledgement
                        ? `${t.acknowledged}: ${date(myAcknowledgement.acknowledged_at, lang)}`
                        : acknowledgementKnown ? "Confirming receipt logs your digital acknowledgement under AAL1." : t.error}
                    </p>
                  </div>
                  {!myAcknowledgement ? (
                    <button
                      type="button"
                      disabled={submitting || !acknowledgementKnown || !["ready", "retry"].includes(ackState.phase)}
                      onClick={() =>
                        void acknowledge(false)
                      }
                      className="flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-800 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      {ackState.phase === "retry" ? ackCopy.retry : t.ackReceipt}
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
                onClick={() => setDeliveriesRevision((n) => n + 1)}
                className="flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-xs font-bold text-[#334E68] transition hover:bg-slate-50"
              >
                <FileText className="h-4 w-4" />
                {t.viewDeliveries}
              </button>
            </div>

            {/* Delivery Outbox Drawer / Section */}
            {deliveriesRequested ? (
              <div className="rounded-2xl border bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-[#102A43]">{t.deliveriesTitle}</div>
                  <span className="font-mono text-xs text-slate-500">Total: {deliveries?.length ?? 0}</span>
                </div>
                {deliveryRead.loading ? (
                  <div className="py-4 text-center text-xs text-slate-400">{t.loading}</div>
                ) : deliveryRead.error ? (<div role="alert">{deliveryRead.error}</div>) : !deliveries?.length ? (
                  <div className="py-4 text-center text-xs text-slate-500">No delivery attempts logged.</div>
                ) : (
                  <div role="region" aria-label={t.deliveriesTitle} tabIndex={0} className="mt-3 max-h-48 max-w-full overflow-auto rounded-xl border bg-white">
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
                      onChange={(e) => { setEvidenceType(e.target.value); setEvidenceTouched(true); }}
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
                      onChange={(e) => { setEvidenceRef(e.target.value); setEvidenceTouched(true); }}
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
                      onChange={(e) => { setOccurredAt(e.target.value); setEvidenceTouched(true); }}
                      className="mt-1 w-full rounded-xl border bg-white p-2 text-xs font-normal"
                    />
                  </label>

                  <label className="text-xs font-bold text-[#334E68]">
                    {t.notes}
                    <input
                      value={evidenceNotes}
                      onChange={(e) => { setEvidenceNotes(e.target.value); setEvidenceTouched(true); }}
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
                        <div className="flex flex-wrap items-center gap-2">
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
        ) : null}
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

  const isCurrent = useNoticeLifetime();
  const { registerUnsavedGuard } = useCustomerContext();
  const guardId = useId();
  const dirty = Boolean(titleRo || bodyRo || titleEn || bodyEn || titleFa || bodyFa || commType !== "general_announcement" || legalClass !== "informational_optional" || sourceModule !== "general");
  useEffect(() => registerUnsavedGuard(guardId, dirty, close), [registerUnsavedGuard, guardId, dirty, close]);
  const dialog = useNoticeDialog(close);
  const titleId = useId();

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
      if (!isCurrent()) return;
      if (res.ok) {
        onCreated();
      } else {
        const errJson = await res.json().catch(() => ({}));
        if (isCurrent()) setError(errJson?.error?.message || t.failAction);
      }
    } catch {
      if (isCurrent()) setError(t.failAction);
    } finally {
      if (isCurrent()) setSubmitting(false);
    }
  };

  return (
    <div
      {...dialog}
      role="dialog"
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 z-[80] grid place-items-center bg-black/60 p-4"
    >
      <div className="max-h-[90dvh] min-w-0 w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-4 sm:p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b pb-4">
          <h2 id={titleId} className="text-lg font-extrabold text-[#102A43]">{t.newNotice}</h2>
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
