"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileText,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldAlert,
  Download,
  UploadCloud,
  Lock,
  Unlock,
  AlertTriangle,
  X,
  FileCode,
} from "lucide-react";
import type { Language } from "@/types";
import { useCustomerContext } from "./CustomerContextProvider";

type View = "documents" | "versions" | "categories" | "retention" | "holds" | "evidence" | "links" | "history";
type Row = Record<string, unknown> & { id?: string; title?: string; document_title?: string; category?: string; status?: string; classification?: string; legal_hold_status?: string; hash?: string; scanning_status?: string; is_evidence?: boolean; evidence_status?: string };
type Response = {
  rows: Row[];
  total: number;
  summary?: Record<string, number>;
  detail?: Row | null;
  read_only: boolean;
  storage_access: boolean;
  signed_urls: boolean;
};

const copy = {
  en: {
    title: "Secure Evidence & Document Vault",
    sub: "Enterprise evidence storage with server-side SHA-256 content hashes, tamper-evident versioning, retention locks, and dual-control disposition.",
    search: "Search documents by title or type…",
    all: "All classifications",
    status: "Status",
    from: "From",
    to: "To",
    refresh: "Refresh",
    uploadBtn: "Upload Document",
    uploadTitle: "Upload Secure Document",
    fileLabel: "Select Document File (max 20MB)",
    fileHint: "PDF, Word, Excel, WebP, PNG, JPEG, Plain text. Executables, scripts, HTML & SVG are strictly rejected.",
    docTitle: "Document Title",
    docType: "Document Type",
    classification: "Classification",
    uploading: "Processing bounded upload…",
    intentStep: "1. Authorizing upload handshake intent…",
    streamStep: "2. Streaming bytes & computing server SHA-256…",
    finalizeStep: "3. Finalizing immutable vault record…",
    uploadSuccess: "Document securely uploaded and registered!",
    uploadFailed: "Upload failed: ",
    cancel: "Cancel",
    confirmUpload: "Upload to Vault",
    loading: "Loading authorized document vault records…",
    empty: "No documents match the current filters.",
    error: "Document metadata could not be loaded.",
    vaultActive: "Vault Active · Private Storage RLS",
    details: "Details",
    close: "Close",
    download: "Download",
    downloading: "Authorizing signed download…",
    scannerDeferred: "Scanner: Deferred (Unscanned)",
    scannerDeferredNotice: "Caution: Malware scanning is deferred. Normal download is blocked. Only admin inspection is authorized.",
    verifiedEvidence: "Verified Statutory Evidence",
    legalHoldActive: "Active Legal Hold (Disposition Frozen)",
    placeHold: "Place Legal Hold",
    releaseHold: "Release Legal Hold",
    holdReasonPrompt: "Enter statutory reason for legal hold (minimum 5 characters):",
    documents: "Documents",
    versions: "Versions",
    categories: "Categories",
    retention: "Retention",
    holds: "Legal Holds",
    evidence: "Evidence",
    links: "Links",
    history: "Lifecycle",
    total: "Visible records",
    published: "Published",
    legal: "Under Hold",
    expiring: "Expiring",
    previous: "Previous",
    next: "Next",
  },
  ro: {
    title: "Seif Securizat de Documente și Dovezi",
    sub: "Stocare de dovezi de nivel enterprise cu hash-uri de conținut SHA-256 pe server, versionare imuabilă, blocaje de retenție și dispoziție cu dublu control.",
    search: "Caută documente după titlu sau tip…",
    all: "Toate clasificările",
    status: "Stare",
    from: "De la",
    to: "Până la",
    refresh: "Reîncarcă",
    uploadBtn: "Încarcă Document",
    uploadTitle: "Încărcare Document Securizat",
    fileLabel: "Selectează Fișierul (max 20MB)",
    fileHint: "PDF, Word, Excel, WebP, PNG, JPEG, Text simplu. Executabilele, scripturile, HTML și SVG sunt strict respinse.",
    docTitle: "Titlu Document",
    docType: "Tip Document",
    classification: "Clasificare",
    uploading: "Procesare flux încărcare…",
    intentStep: "1. Se autorizează intenția de încărcare…",
    streamStep: "2. Se transmite fluxul și se calculează SHA-256…",
    finalizeStep: "3. Se finalizează înregistrarea în seif…",
    uploadSuccess: "Document încărcat și înregistrat cu succes!",
    uploadFailed: "Încărcare eșuată: ",
    cancel: "Anulează",
    confirmUpload: "Încarcă în Seif",
    loading: "Se încarcă înregistrările din seif…",
    empty: "Nu există documente conform filtrelor curente.",
    error: "Metadatele documentelor nu au putut fi încărcate.",
    vaultActive: "Seif Activ · Stocare Privată RLS",
    details: "Detalii",
    close: "Închide",
    download: "Descarcă",
    downloading: "Se autorizează descărcarea semnată…",
    scannerDeferred: "Scanare: Amânată (Neinspectat)",
    scannerDeferredNotice: "Atenție: Scanarea malware este amânată. Descărcarea normală este blocată.",
    verifiedEvidence: "Dovadă Legală Verificată",
    legalHoldActive: "Blocare Juridică Activă",
    placeHold: "Aplică Blocare Juridică",
    releaseHold: "Eliberează Blocare",
    holdReasonPrompt: "Introduceți motivul legal (minim 5 caractere):",
    documents: "Documente",
    versions: "Versiuni",
    categories: "Categorii",
    retention: "Retenție",
    holds: "Blocări Juridice",
    evidence: "Dovezi",
    links: "Legături",
    history: "Ciclu de viață",
    total: "Înregistrări vizibile",
    published: "Publicate",
    legal: "Sub Blocare",
    expiring: "Expiră",
    previous: "Anterior",
    next: "Următor",
  },
  fa: {
    title: "مخزن اسناد و شواهد امن حقوقی",
    sub: "سامانه ذخیره‌سازی شواهد سازمانی با هش محتوای SHA-256 سمت سرور، نسخه‌بندی غیرقابل تغییر، قفل‌های نگهداری و امحای کنترل دوگانه.",
    search: "جستجوی اسناد بر اساس عنوان یا نوع…",
    all: "همه طبقه‌بندی‌ها",
    status: "وضعیت",
    from: "از",
    to: "تا",
    refresh: "بازخوانی",
    uploadBtn: "بارگذاری سند جدید",
    uploadTitle: "بارگذاری سند امن در مخزن",
    fileLabel: "انتخاب فایل سند (حداکثر ۲۰ مگابایت)",
    fileHint: "فرمت‌های مجاز: PDF، Word، Excel، WebP، PNG، JPEG، متن ساده. فایل‌های اجرایی، اسکریپت، HTML و SVG اکیداً رد می‌شوند.",
    docTitle: "عنوان سند",
    docType: "نوع سند",
    classification: "طبقه‌بندی محرمانگی",
    uploading: "در حال پردازش جریان بارگذاری امن…",
    intentStep: "۱. احراز هویت و صدور مجوز بارگذاری (Intent)…",
    streamStep: "۲. ارسال جریانی بایت‌ها و محاسبه SHA-256 سرور…",
    finalizeStep: "۳. نهایی‌سازی و ثبت غیرقابل تغییر نسخه در مخزن…",
    uploadSuccess: "سند با موفقیت در مخزن امن ثبت و نهایی شد!",
    uploadFailed: "خطا در بارگذاری: ",
    cancel: "انصراف",
    confirmUpload: "ارسال و ثبت در مخزن",
    loading: "در حال بارگذاری اطلاعات مخزن اسناد…",
    empty: "هیچ سندی با فیلترهای انتخابی یافت نشد.",
    error: "خطا در دریافت اطلاعات اسناد.",
    vaultActive: "مخزن فعال · دسترسی خصوصی RLS",
    details: "جزئیات",
    close: "بستن",
    download: "دانلود فایل",
    downloading: "در حال دریافت لینک امن امضاشده…",
    scannerDeferred: "وضعیت پویش: معوق (بررسی‌نشده)",
    scannerDeferredNotice: "هشدار: پویش امنیتی فایل معوق است. دانلود عادی مسدود می‌باشد و صرفاً بازرسی مدیر مجاز است.",
    verifiedEvidence: "مدرک معتبر قانونی (Verified Evidence)",
    legalHoldActive: "توقف حقوقی فعال (تغییر و امحا مسدود)",
    placeHold: "اعمال توقف حقوقی",
    releaseHold: "لغو توقف حقوقی",
    holdReasonPrompt: "علت حقوقی اعمال توقف را وارد کنید (حداقل ۵ کاراکتر):",
    documents: "اسناد",
    versions: "نسخه‌ها",
    categories: "دسته‌بندی‌ها",
    retention: "نگهداری",
    holds: "توقف حقوقی",
    evidence: "شواهد",
    links: "ارتباط‌ها",
    history: "چرخه عمر",
    total: "سوابق موجود",
    published: "منتشرشده",
    legal: "توقف حقوقی",
    expiring: "در آستانه انقضا",
    previous: "قبلی",
    next: "بعدی",
  },
} as const;

const views: View[] = ["documents", "versions", "categories", "retention", "holds", "evidence", "links", "history"];
const hidden = new Set(["id", "document_id", "entity_id"]);

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "✓" : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

export function CustomerDocumentsDashboard({ lang, initialDocumentId }: { lang: Language; initialDocumentId?: string }) {
  const { active } = useCustomerContext();
  const t = copy[lang];

  const [view, setView] = useState<View>("documents");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [classification, setClassification] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Response | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState("general");
  const [uploadClassification, setUploadClassification] = useState("internal");
  const [uploadStep, setUploadStep] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Download & Hold feedback
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const p = new URLSearchParams({
        context_id: active.context_id,
        view,
        limit: "20",
        offset: String(offset),
      });
      if (query) p.set("query", query);
      if (status) p.set("status", status);
      if (classification) p.set("classification", classification);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (initialDocumentId && view === "documents") p.set("id", initialDocumentId);

      const response = await fetch(`/api/customer/v1/documents?${p}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error();
      const body = (await response.json()) as Response;
      setData(body);
      if (initialDocumentId && body.rows[0]) setSelected(body.rows[0]);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [active, view, offset, query, status, classification, from, to, initialDocumentId, t.error]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 150);
    return () => clearTimeout(timer);
  }, [load]);

  const setActiveView = (next: View) => {
    setView(next);
    setOffset(0);
    setSelected(null);
  };

  // Perform Handshake Upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !active) return;

    setUploadError("");
    setUploadSuccess(false);

    try {
      // Step 1: Create Upload Intent
      setUploadStep(t.intentStep);
      const intentRes = await fetch("/api/customer/v1/documents/upload-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          context_id: active.context_id,
          filename: uploadFile.name,
          declared_mime: uploadFile.type || "application/pdf",
          size_bytes: uploadFile.size,
        }),
      });

      if (!intentRes.ok) {
        const errJson = await intentRes.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || "Failed to create upload intent");
      }

      const intentData = await intentRes.json();
      const intentId = intentData.intent_id;

      // Step 2 & 3: Bounded streaming upload & finalize
      setUploadStep(t.streamStep);
      const formData = new FormData();
      formData.append("context_id", active.context_id);
      formData.append("intent_id", intentId);
      formData.append("title", uploadTitle || uploadFile.name);
      formData.append("document_type", uploadType);
      formData.append("classification", uploadClassification);
      formData.append("declared_mime", uploadFile.type || "application/pdf");
      formData.append("file", uploadFile);

      setUploadStep(t.finalizeStep);
      const uploadRes = await fetch("/api/customer/v1/documents/upload", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      if (!uploadRes.ok) {
        const errJson = await uploadRes.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || "Server upload processing failed");
      }

      setUploadSuccess(true);
      setUploadStep(null);
      setTimeout(() => {
        setIsUploadOpen(false);
        setUploadFile(null);
        setUploadTitle("");
        void load();
      }, 1500);
    } catch (err: any) {
      setUploadError(err?.message || "Upload failed");
      setUploadStep(null);
    }
  };

  // Perform Authorized Download
  const handleDownload = async (docId: string, isAdminInspection: boolean = false) => {
    if (!active) return;
    setActionNotice(t.downloading);
    setActionError(null);

    try {
      const res = await fetch(`/api/customer/v1/documents/${docId}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          context_id: active.context_id,
          admin_inspection: isAdminInspection,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || "Download authorization denied");
      }

      setActionNotice(null);
      if (data.download_url) {
        window.open(data.download_url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      setActionNotice(null);
      setActionError(err?.message || "Download failed");
    }
  };

  // Place Legal Hold
  const handlePlaceLegalHold = async (docId: string) => {
    if (!active) return;
    const reason = window.prompt(t.holdReasonPrompt);
    if (!reason || reason.trim().length < 5) return;

    try {
      const res = await fetch(`/api/customer/v1/documents/${docId}/holds`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          context_id: active.context_id,
          reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || "Failed to place legal hold");
      }
      void load();
    } catch (err: any) {
      setActionError(err?.message || "Could not place legal hold");
    }
  };

  // Release Legal Hold
  const handleReleaseLegalHold = async (docId: string) => {
    if (!active) return;
    const reason = window.prompt(t.holdReasonPrompt);
    if (!reason || reason.trim().length < 5) return;

    try {
      const res = await fetch(`/api/customer/v1/documents/${docId}/holds/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          context_id: active.context_id,
          release_reason: reason.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || "Failed to release legal hold");
      }
      void load();
    } catch (err: any) {
      setActionError(err?.message || "Could not release legal hold");
    }
  };

  const summary = data?.summary ?? {};

  return (
    <div className="space-y-5" dir={lang === "fa" ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="card-proptech border border-[#D3DCE6] bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0E9F8E]">
              <ShieldCheck className="h-4 w-4" />
              CLADORA · Secure Evidence Vault
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-[#102A43]">{t.title}</h1>
            <p className="mt-1 max-w-3xl text-xs text-[#52667A]">{t.sub}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#B2E5DF] bg-[#EAF8F5] px-3 py-1 text-[11px] font-bold text-[#0A6E62]">
              {t.vaultActive}
            </span>
            <button
              type="button"
              onClick={() => setIsUploadOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-[#0E9F8E] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#0A6E62] transition-colors"
            >
              <UploadCloud className="h-4 w-4" />
              {t.uploadBtn}
            </button>
          </div>
        </div>

        {/* Action feedback banners */}
        {actionNotice && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            {actionNotice}
          </div>
        )}
        {actionError && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <span className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {actionError}
            </span>
            <button type="button" onClick={() => setActionError(null)}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
      </header>

      {/* Summary Cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [t.total, data?.total ?? 0],
          [t.published, summary.published ?? 0],
          [t.legal, summary.legal_hold ?? 0],
          [t.expiring, summary.expiring ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="card-proptech bg-white p-4 border border-[#E2E8F0] shadow-sm">
            <div className="text-[11px] font-semibold text-[#52667A]">{label}</div>
            <div className="mt-1 text-xl font-extrabold text-[#102A43]">{value}</div>
          </div>
        ))}
      </section>

      {/* Main Table Section */}
      <section className="card-proptech overflow-hidden bg-white border border-[#E2E8F0] shadow-sm">
        {/* Navigation Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b border-[#E2E8F0] p-2 bg-[#F8FAFC]">
          {views.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => setActiveView(item)}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
                view === item ? "bg-[#0E9F8E] text-white shadow-sm" : "text-[#52667A] hover:bg-[#EDF2F7]"
              }`}
            >
              {t[item]}
            </button>
          ))}
        </div>

        {/* Filter Controls */}
        <div className="grid gap-2 border-b border-[#E2E8F0] p-3 md:grid-cols-6">
          <label className="relative md:col-span-2">
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-[#7B8A9A]" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffset(0);
              }}
              placeholder={t.search}
              className="w-full rounded-lg border border-[#CBD5E1] py-2 pe-3 ps-9 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E9F8E]"
            />
          </label>
          <input
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
            placeholder={t.status}
            className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E9F8E]"
          />
          <select
            value={classification}
            onChange={(e) => {
              setClassification(e.target.value);
              setOffset(0);
            }}
            className="rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0E9F8E]"
          >
            <option value="">{t.all}</option>
            <option value="public">Public</option>
            <option value="internal">Internal</option>
            <option value="confidential">Confidential</option>
            <option value="restricted">Restricted</option>
          </select>
          <input
            aria-label={t.from}
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-[#CBD5E1] px-2 py-2 text-xs"
          />
          <div className="flex gap-2">
            <input
              aria-label={t.to}
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-[#CBD5E1] px-2 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() => void load()}
              aria-label={t.refresh}
              className="rounded-lg border border-[#CBD5E1] p-2 hover:bg-[#F8FAFC]"
            >
              <RefreshCw className={`h-4 w-4 text-[#52667A] ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Content List */}
        {loading ? (
          <div className="p-10 text-center text-xs text-[#52667A]">{t.loading}</div>
        ) : error ? (
          <div role="alert" className="p-10 text-center text-xs font-bold text-red-700">
            {error}
          </div>
        ) : !data?.rows.length ? (
          <div className="p-10 text-center text-xs text-[#52667A]">
            <Archive className="mx-auto mb-2 h-7 w-7 text-[#94A3B8]" />
            {t.empty}
          </div>
        ) : (
          <div className="divide-y divide-[#EDF2F7]">
            {data.rows.map((row, index) => {
              const docId = (row.id ?? row.document_id ?? "") as string;
              const isHold = row.legal_hold_status === "active" || row.status === "active_hold";
              const isEvidenceVerified = row.evidence_status === "verified";
              const entries = Object.entries(row).filter(([key]) => !hidden.has(key)).slice(0, 6);

              return (
                <article
                  key={docId || `${view}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-4 p-4 hover:bg-[#F8FAFC] transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="rounded-xl bg-[#EAF8F5] p-2.5 text-[#0E9F8E] shrink-0 mt-0.5">
                      {view === "evidence" ? <FileCheck2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-xs font-bold text-[#102A43]">
                          {display(row.title ?? row.document_title ?? row.category ?? row.event_type ?? `#${index + 1}`)}
                        </span>
                        {/* Security Badges */}
                        {isEvidenceVerified && (
                          <span className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            {t.verifiedEvidence}
                          </span>
                        )}
                        {isHold && (
                          <span className="rounded-md border border-red-300 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-800 flex items-center gap-1">
                            <Lock className="h-3 w-3" />
                            {t.legalHoldActive}
                          </span>
                        )}
                        {/* Fail-closed Deferred Scanner Badge (amber tone, never green) */}
                        <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 flex items-center gap-1">
                          <ShieldAlert className="h-3 w-3 text-amber-600" />
                          {t.scannerDeferred}
                        </span>
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#64748B]">
                        {entries.slice(1).map(([key, value]) => (
                          <span key={key}>
                            <b className="text-[#475569]">{key.replaceAll("_", " ")}:</b> {display(value)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {docId && (
                      <button
                        type="button"
                        onClick={() => handleDownload(docId, false)}
                        title={t.download}
                        className="rounded-lg border border-[#CBD5E1] p-2 text-[#52667A] hover:bg-white hover:text-[#0E9F8E] transition-colors"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-[11px] font-bold text-[#102A43] hover:bg-[#F8FAFC] transition-colors"
                    >
                      {t.details}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination Footer */}
        <div className="flex items-center justify-between border-t border-[#E2E8F0] p-3 text-xs bg-[#F8FAFC]">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 20))}
            className="flex items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 font-semibold text-[#102A43] disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            {t.previous}
          </button>
          <span className="text-[#64748B] font-medium">
            {offset + 1}–{Math.min(offset + 20, data?.total ?? 0)} / {data?.total ?? 0}
          </span>
          <button
            type="button"
            disabled={offset + 20 >= (data?.total ?? 0)}
            onClick={() => setOffset(offset + 20)}
            className="flex items-center gap-1 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 font-semibold text-[#102A43] disabled:opacity-40"
          >
            {t.next}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Upload Modal */}
      {isUploadOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102A43]/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-[#CBD5E1]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h2 className="text-base font-bold text-[#102A43] flex items-center gap-2">
                <UploadCloud className="h-5 w-5 text-[#0E9F8E]" />
                {t.uploadTitle}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setIsUploadOpen(false);
                  setUploadStep(null);
                  setUploadError("");
                }}
              >
                <X className="h-5 w-5 text-[#64748B]" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4">
              {/* File Input */}
              <div>
                <label className="block text-xs font-bold text-[#334155]">{t.fileLabel}</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    setUploadFile(file);
                    if (file && !uploadTitle) {
                      setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
                    }
                  }}
                  className="mt-1 w-full text-xs text-[#475569] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#EAF8F5] file:text-[#0E9F8E] hover:file:bg-[#D1F2EB]"
                />
                <p className="mt-1 text-[11px] text-[#64748B]">{t.fileHint}</p>
              </div>

              {/* Document Title */}
              <div>
                <label className="block text-xs font-bold text-[#334155]">{t.docTitle}</label>
                <input
                  type="text"
                  required
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g. Annual General Meeting Minutes 2026"
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] p-2 text-xs focus:ring-2 focus:ring-[#0E9F8E] focus:outline-none"
                />
              </div>

              {/* Document Type & Classification */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#334155]">{t.docType}</label>
                  <select
                    value={uploadType}
                    onChange={(e) => setUploadType(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] p-2 text-xs"
                  >
                    <option value="general">General</option>
                    <option value="legal_contract">Legal Contract</option>
                    <option value="financial_record">Financial Record</option>
                    <option value="governance_minutes">Governance Minutes</option>
                    <option value="statutory_proof">Statutory Proof</option>
                    <option value="maintenance_warranty">Maintenance Warranty</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#334155]">{t.classification}</label>
                  <select
                    value={uploadClassification}
                    onChange={(e) => setUploadClassification(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#CBD5E1] p-2 text-xs"
                  >
                    <option value="internal">Internal</option>
                    <option value="confidential">Confidential</option>
                    <option value="restricted">Restricted</option>
                    <option value="public">Public</option>
                  </select>
                </div>
              </div>

              {/* Progress & Feedback */}
              {uploadStep && (
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-teal-800 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#0E9F8E]" />
                  {uploadStep}
                </div>
              )}
              {uploadError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {t.uploadFailed} {uploadError}
                </div>
              )}
              {uploadSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-bold">
                  {t.uploadSuccess}
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex justify-end gap-2 border-t border-[#E2E8F0] pt-4">
                <button
                  type="button"
                  onClick={() => setIsUploadOpen(false)}
                  className="rounded-lg border border-[#CBD5E1] px-4 py-2 text-xs font-semibold text-[#52667A]"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={Boolean(uploadStep) || !uploadFile}
                  className="rounded-lg bg-[#0E9F8E] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#0A6E62] disabled:opacity-50"
                >
                  {t.confirmUpload}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Details Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-end bg-[#102A43]/35 p-4" role="dialog" aria-modal="true">
          <div className="max-h-[90vh] w-full max-w-xl overflow-auto rounded-2xl bg-white p-6 shadow-2xl border border-[#CBD5E1]">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-3">
              <h2 className="font-bold text-[#102A43] text-base flex items-center gap-2">
                <FileCode className="h-5 w-5 text-[#0E9F8E]" />
                {t.details}
              </h2>
              <button type="button" onClick={() => setSelected(null)} aria-label={t.close}>
                <X className="h-5 w-5 text-[#64748B]" />
              </button>
            </div>

            {/* Quick Actions inside detail */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {selected.id && (
                <>
                  <button
                    type="button"
                    onClick={() => handleDownload(selected.id as string, false)}
                    className="flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1.5 text-xs font-bold text-[#102A43] hover:bg-[#F8FAFC]"
                  >
                    <Download className="h-4 w-4 text-[#0E9F8E]" />
                    {t.download}
                  </button>
                  {selected.legal_hold_status === "active" ? (
                    <button
                      type="button"
                      onClick={() => handleReleaseLegalHold(selected.id as string)}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-800"
                    >
                      <Unlock className="h-4 w-4" />
                      {t.releaseHold}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handlePlaceLegalHold(selected.id as string)}
                      className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800"
                    >
                      <Lock className="h-4 w-4" />
                      {t.placeHold}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Details Key-Value List */}
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(selected)
                .filter(([key]) => !hidden.has(key))
                .map(([key, value]) => (
                  <div key={key} className="rounded-xl bg-[#F8FAFC] p-3 border border-[#EDF2F7]">
                    <dt className="text-[10px] font-bold uppercase text-[#64748B]">{key.replaceAll("_", " ")}</dt>
                    <dd className="mt-1 break-words text-xs text-[#102A43] font-medium">{display(value)}</dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
