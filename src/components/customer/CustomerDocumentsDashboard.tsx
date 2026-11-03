"use client";

import { useCallback, useEffect, useState, useRef, useLayoutEffect } from "react";
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
import { createClient } from "@/lib/supabase/client";
import { documentsUploadIntentAckV1Schema, matchesDocumentsUploadFinalizationAckV1,
  type DocumentsUploadUiBindingV1 } from "@/lib/customer/documents-upload-ui-contract-v1";
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
    title: "Documents and evidence",
    sub: "View document details and review status. An uploaded or attached file does not confirm its contents, acceptance of work or payment. Download access is checked separately.",
    search: "Search by document title or type…",
    all: "All access levels",
    status: "Document status",
    from: "Created from",
    to: "Created to",
    refresh: "Refresh",
    uploadBtn: "Upload Document",
    uploadTitle: "Upload a document",
    fileLabel: "Choose a document file (up to 20 MB)",
    fileHint: "Choose PDF, Word, Excel, WebP, PNG, JPEG or plain text. Executable files, scripts, HTML and SVG are not allowed. Uploading does not approve the contents.",
    docTitle: "Document title",
    docType: "Document type",
    property: "Property (optional)",
    noProperty: "Not linked to a property",
    propertyLoading: "Loading available properties…",
    propertyError: "The property list could not be loaded. Refresh the page to check again.",
    classification: "Access level",
    uploading: "Uploading the document…",
    intentStep: "1. Checking permission to upload…",
    streamStep: "2. Sending the file for checks…",
    finalizeStep: "3. Waiting for document registration…",
    uploadSuccess: "File uploaded and registered. This does not confirm its contents, acceptance of work or payment.",
    uploadUnknown: "The result is unknown. Do not upload again or start a new attempt. Keep this page open and ask support to check this attempt.",
    uploadNotReady: "Upload is unavailable. No file was sent. Wait for the service to reopen; do not retry this attempt.",
    uploadScopeChanged: "Your account or workspace changed. This attempt is paused. Return to the original account and context and ask support to check it; do not upload again.",
    uploadIdentity: "Your session could not be checked. Check your sign-in before starting an upload.",
    uploadInvalid: "Check the file type, size, title and selected property before uploading.",
    cancel: "Cancel",
    confirmUpload: "Upload this file",
    loading: "Loading document details you can view…",
    empty: "No documents are shown with these filters. Try different filters or check your access.",
    error: "Document details could not be loaded. Refresh to check again; your access may have changed.",
    vaultActive: "Document details · Download permission is separate",
    details: "View details",
    close: "Close",
    download: "Request download",
    downloading: "Checking download permission…",
    scannerDeferred: "File scan: not yet confirmed",
    scannerClean: "File scan: clean",
    scannerQuarantined: "File scan: quarantined",
    scannerDeferredNotice: "The file scan is not confirmed. Do not treat the file as safe; normal download is blocked.",
    verifiedEvidence: "Evidence marked verified",
    legalHoldActive: "On legal hold · Disposal blocked",
    placeHold: "Place Legal Hold",
    releaseHold: "Release Legal Hold",
    holdReasonPrompt: "Enter statutory reason for legal hold (minimum 5 characters):",
    documents: "Documents",
    versions: "Versions",
    categories: "Categories",
    retention: "Retention periods",
    holds: "Legal Holds",
    evidence: "Evidence",
    links: "Links",
    history: "Document history",
    total: "Visible records",
    published: "Published",
    legal: "Under Hold",
    expiring: "Expiring",
    previous: "Previous",
    next: "Next",
  },
  ro: {
    title: "Documente și dovezi",
    sub: "Vezi detaliile documentelor și stadiul verificării. Un fișier încărcat sau atașat nu confirmă conținutul, acceptarea lucrării ori plata. Accesul la descărcare se verifică separat.",
    search: "Caută după titlu sau tip de document…",
    all: "Toate nivelurile de acces",
    status: "Starea documentului",
    from: "Create începând cu",
    to: "Create până la",
    refresh: "Reîncarcă",
    uploadBtn: "Încarcă un document",
    uploadTitle: "Încarcă un document",
    fileLabel: "Alege fișierul (cel mult 20 MB)",
    fileHint: "Alege PDF, Word, Excel, WebP, PNG, JPEG sau text simplu. Fișierele executabile, scripturile, HTML și SVG nu sunt permise. Încărcarea nu aprobă conținutul.",
    docTitle: "Titlul documentului",
    docType: "Tipul documentului",
    property: "Proprietate (opțional)",
    noProperty: "Fără legătură cu o proprietate",
    propertyLoading: "Se încarcă proprietățile disponibile…",
    propertyError: "Lista proprietăților nu a putut fi încărcată. Reîncarcă pagina pentru a verifica din nou.",
    classification: "Nivel de acces",
    uploading: "Se încarcă documentul…",
    intentStep: "1. Se verifică permisiunea de încărcare…",
    streamStep: "2. Se trimite fișierul pentru verificări…",
    finalizeStep: "3. Se așteaptă înregistrarea documentului…",
    uploadSuccess: "Fișier încărcat și înregistrat. Acest lucru nu confirmă conținutul, acceptarea lucrării ori plata.",
    uploadUnknown: "Rezultatul este necunoscut. Nu încărca din nou și nu începe altă încercare. Păstrează pagina deschisă și cere asistenței să verifice această încercare.",
    uploadNotReady: "Încărcarea nu este disponibilă. Niciun fișier nu a fost trimis. Așteaptă redeschiderea serviciului; nu repeta această încercare.",
    uploadScopeChanged: "Contul sau spațiul de lucru s-a schimbat. Încercarea este suspendată. Revino la contul și contextul inițial și cere verificarea; nu încărca din nou.",
    uploadIdentity: "Sesiunea nu a putut fi verificată. Verifică autentificarea înainte de încărcare.",
    uploadInvalid: "Verifică tipul, dimensiunea, titlul fișierului și proprietatea selectată înainte de încărcare.",
    cancel: "Anulează",
    confirmUpload: "Încarcă acest fișier",
    loading: "Se încarcă detaliile documentelor pe care le poți vedea…",
    empty: "Nu sunt afișate documente cu aceste filtre. Încearcă alte filtre sau verifică accesul.",
    error: "Detaliile documentelor nu au putut fi încărcate. Reîncarcă pentru a verifica din nou; este posibil ca accesul să se fi schimbat.",
    vaultActive: "Detalii documente · Permisiune separată pentru descărcare",
    details: "Vezi detaliile",
    close: "Închide",
    download: "Solicită descărcarea",
    downloading: "Se verifică permisiunea de descărcare…",
    scannerDeferred: "Scanare fișier: încă neconfirmată",
    scannerClean: "Scanare fișier: fără amenințări detectate",
    scannerQuarantined: "Scanare fișier: în carantină",
    scannerDeferredNotice: "Scanarea fișierului nu este confirmată. Nu considera fișierul sigur; descărcarea obișnuită este blocată.",
    verifiedEvidence: "Dovadă marcată ca verificată",
    legalHoldActive: "Păstrare obligatorie · Eliminare blocată",
    placeHold: "Aplică păstrarea obligatorie",
    releaseHold: "Ridică păstrarea obligatorie",
    holdReasonPrompt: "Introdu motivul păstrării obligatorii (cel puțin 5 caractere):",
    documents: "Documente",
    versions: "Versiuni",
    categories: "Categorii",
    retention: "Perioade de păstrare",
    holds: "Păstrare obligatorie",
    evidence: "Dovezi",
    links: "Legături",
    history: "Istoricul documentului",
    total: "Înregistrări afișate",
    published: "Publicate",
    legal: "Cu păstrare obligatorie",
    expiring: "Expiră",
    previous: "Anterior",
    next: "Următor",
  },
  fa: {
    title: "اسناد و مدارک",
    sub: "جزئیات سند و وضعیت بررسی را ببینید. بارگذاری یا پیوست فایل، تأیید محتوا، پذیرش کار یا پرداخت نیست. دسترسی دانلود جداگانه بررسی می‌شود.",
    search: "جستجو با عنوان یا نوع سند…",
    all: "همه سطح‌های دسترسی",
    status: "وضعیت سند",
    from: "تاریخ ایجاد از",
    to: "تاریخ ایجاد تا",
    refresh: "بازخوانی",
    uploadBtn: "بارگذاری سند جدید",
    uploadTitle: "بارگذاری سند",
    fileLabel: "فایل سند را انتخاب کنید (حداکثر ۲۰ مگابایت)",
    fileHint: "PDF، Word، Excel، WebP، PNG، JPEG یا متن ساده انتخاب کنید. فایل اجرایی، اسکریپت، HTML و SVG مجاز نیست. بارگذاری، تأیید محتوا نیست.",
    docTitle: "عنوان سند",
    docType: "نوع سند",
    property: "ملک (اختیاری)",
    noProperty: "بدون ارتباط با ملک",
    propertyLoading: "در حال دریافت املاک مجاز…",
    propertyError: "فهرست املاک دریافت نشد. برای بررسی دوباره صفحه را بازخوانی کنید.",
    classification: "سطح دسترسی",
    uploading: "در حال بارگذاری سند…",
    intentStep: "۱. بررسی مجوز بارگذاری…",
    streamStep: "۲. ارسال فایل برای بررسی…",
    finalizeStep: "۳. در انتظار ثبت سند…",
    uploadSuccess: "فایل بارگذاری و ثبت شد. این به معنی تأیید محتوا، پذیرش کار یا پرداخت نیست.",
    uploadUnknown: "نتیجه مشخص نیست. فایل را دوباره بارگذاری نکنید و تلاش تازه نسازید. صفحه را باز نگه دارید و از پشتیبانی بخواهید همین تلاش را بررسی کند.",
    uploadNotReady: "بارگذاری فعلاً آماده نیست. فایلی ارسال نشد. منتظر بازگشایی سرویس بمانید؛ این تلاش را تکرار نکنید.",
    uploadScopeChanged: "حساب یا فضای کاری تغییر کرد و این تلاش متوقف شد. به حساب و زمینهٔ قبلی برگردید و درخواست بررسی بدهید؛ دوباره بارگذاری نکنید.",
    uploadIdentity: "نشست بررسی نشد. پیش از شروع بارگذاری، ورود خود را بررسی کنید.",
    uploadInvalid: "نوع و اندازهٔ فایل، عنوان و ملک انتخابی را پیش از بارگذاری بررسی کنید.",
    cancel: "انصراف",
    confirmUpload: "بارگذاری این فایل",
    loading: "در حال دریافت جزئیات سندهایی که می‌توانید ببینید…",
    empty: "با این فیلترها سندی نمایش داده نمی‌شود. فیلترها یا دسترسی خود را بررسی کنید.",
    error: "جزئیات اسناد دریافت نشد. برای بررسی دوباره بازخوانی کنید؛ ممکن است دسترسی شما تغییر کرده باشد.",
    vaultActive: "جزئیات سند · دانلود نیاز به مجوز جداگانه دارد",
    details: "دیدن جزئیات",
    close: "بستن",
    download: "درخواست دانلود",
    downloading: "در حال بررسی مجوز دانلود…",
    scannerDeferred: "بررسی فایل: هنوز تأیید نشده",
    scannerClean: "بررسی فایل: تهدیدی شناسایی نشد",
    scannerQuarantined: "بررسی فایل: قرنطینه‌شده",
    scannerDeferredNotice: "بررسی فایل تأیید نشده است. فایل را امن فرض نکنید؛ دانلود عادی مسدود است.",
    verifiedEvidence: "مدرک با وضعیت تأییدشده",
    legalHoldActive: "توقف حقوقی · امحا مسدود است",
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
    history: "تاریخچه سند",
    total: "سوابق نمایش‌داده‌شده",
    published: "منتشرشده",
    legal: "توقف حقوقی",
    expiring: "در آستانه انقضا",
    previous: "قبلی",
    next: "بعدی",
  },
} as const;

// A single non-secret tab barrier survives a component remount. It is NOT a
// receipt, idempotency ledger or recovery authority; it can only block dispatch.
const unresolvedUploadKey = "cladora.documents-upload-unresolved.v1";
const views: View[] = ["documents", "versions", "categories", "retention", "holds", "evidence", "links", "history"];
const hidden = new Set(["id", "document_id", "entity_id", "scanning_status"]);

function display(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "✓" : "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value).replace(/^(\d{4}-\d{2}-\d{2})T(?=\d{2}:)/, "$1 ").replace(/\.\d{3}Z$/, " UTC");
}

export function CustomerDocumentsDashboard({ lang, initialDocumentId }: { lang: Language; initialDocumentId?: string }) {
  const { active, dashboard } = useCustomerContext();
  const permissions = dashboard?.contextId === active?.context_id ? dashboard?.permissions ?? [] : [];
  const canUpload = permissions.includes("documents.vault.upload");
  const canHold = permissions.includes("documents.vault.hold");
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

  // Download & Hold feedback
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Upload modal state
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadType, setUploadType] = useState("general");
  const [uploadClassification, setUploadClassification] = useState("internal");
  const [uploadPropertyId, setUploadPropertyId] = useState("");
  const [uploadProperties, setUploadProperties] = useState<{ id: string; name: string }[] | null>(null);
  const [uploadPropertiesContextId, setUploadPropertiesContextId] = useState("");
  const [uploadPropertiesError, setUploadPropertiesError] = useState(false);
  const availableUploadProperties = uploadPropertiesContextId === active?.context_id ? uploadProperties : null;
  type UploadPhase = "idle" | "intent" | "upload" | "finalization" | "UNKNOWN" | "NOT_READY" | "confirmed";
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>(() => {
    try { return typeof window !== "undefined" && window.sessionStorage.getItem(unresolvedUploadKey) ? "UNKNOWN" : "idle"; }
    catch { return "NOT_READY"; }
  });
  const [uploadError, setUploadError] = useState<"uploadUnknown" | "uploadNotReady" | "uploadScopeChanged" | "uploadIdentity" | "uploadInvalid" | "">(
    uploadPhase === "UNKNOWN" ? "uploadUnknown" : uploadPhase === "NOT_READY" ? "uploadNotReady" : "");
  const flight = useRef(false);
  const attempt = useRef<{ key: string; finalizationKey: string; scope: string;
    metadata: string; intent: DocumentsUploadUiBindingV1 | null } | null>(null);
  const scope = JSON.stringify([active?.context_id, active?.membership_id,
    dashboard?.contextId === active?.context_id ? dashboard?.workspace_id : null]);
  const currentScope = useRef(scope);
  const generation = useRef(0);
  const actor = useRef<string | null>(null);
  const [authEpoch, setAuthEpoch] = useState(0);
  const uploadLocked = uploadPhase !== "idle";
  const uploadStep = uploadPhase === "intent" ? t.intentStep : uploadPhase === "upload" ? t.streamStep
    : uploadPhase === "finalization" ? t.finalizeStep : null;
  useLayoutEffect(() => {
    if (currentScope.current === scope) return;
    currentScope.current = scope;
    generation.current += 1;
    setIsUploadOpen(false);
    setUploadFile(null);
    setUploadTitle("");
    setUploadPropertyId("");
    setUploadProperties(null);
    setUploadPropertiesContextId("");
    setSelected(null);
    setActionNotice(null);
    setActionError(null);
    setData(null);
    if (attempt.current || flight.current) {
      setUploadPhase("UNKNOWN");
      setUploadError("uploadScopeChanged");
    }
  }, [scope]);
  useEffect(() => {
    try {
      const { data } = createClient().auth.onAuthStateChange((event, session) => {
        const next = session?.user.id ?? null;
        const changed = actor.current !== next;
        actor.current = next;
        if (!changed && event !== "SIGNED_OUT") return;
        generation.current += 1;
        setAuthEpoch(n => n + 1);
        setIsUploadOpen(false);
        setUploadFile(null);
        setUploadTitle("");
        setUploadProperties(null);
        setSelected(null);
        setActionNotice(null);
        setActionError(null);
        setData(null);
        if (attempt.current || flight.current) {
          setUploadPhase("UNKNOWN");
          setUploadError("uploadScopeChanged");
        }
      });
      return () => data.subscription.unsubscribe();
    } catch { /* Every submit still requires getUser; failure never dispatches. */ }
  }, []);
  useEffect(() => () => { generation.current += 1; }, []);
  useEffect(() => {
    if (!uploadLocked || uploadPhase === "confirmed" || uploadPhase === "NOT_READY") return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [uploadLocked, uploadPhase]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isUploadOpen || !active || !canUpload) return;
    const controller = new AbortController();
    const started = generation.current;
    fetch(`/api/customer/v1/documents/upload-properties?context_id=${encodeURIComponent(active.context_id)}`,
      { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("property choices");
        return response.json() as Promise<{ properties: { id: string; name: string }[] }>;
      })
      .then((body) => {
        if (!controller.signal.aborted && generation.current === started) {
          setUploadProperties(body.properties);
          setUploadPropertiesContextId(active.context_id);
          if (!attempt.current) setUploadPropertyId(body.properties.length === 1 ? body.properties[0].id : "");
          setUploadPropertiesError(false);
        }
      })
      .catch(() => { if (!controller.signal.aborted && generation.current === started) {
        setUploadPropertiesContextId(active.context_id);
        setUploadPropertiesError(true);
      } });
    return () => controller.abort();
  }, [isUploadOpen, active, canUpload, authEpoch]);

  const load = useCallback(async () => {
    if (!active) {
      setLoading(false);
      setData(null);
      return;
    }
    const started = generation.current;
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
      if (generation.current !== started) return;
      setData(body);
      if (initialDocumentId && body.rows[0]) setSelected(body.rows[0]);
    } catch {
      if (generation.current === started) setError(t.error);
    } finally {
      if (generation.current === started) setLoading(false);
    }
  }, [active, view, offset, query, status, classification, from, to, initialDocumentId, t.error]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 150);
    return () => clearTimeout(timer);
  }, [load, authEpoch]);

  const setActiveView = (next: View) => {
    setView(next);
    setOffset(0);
    setSelected(null);
  };

  // Single in-memory attempt. No automatic retry, remount recovery, re-upload or
  // key rotation is offered: only a future authorized same-attempt readback can
  // resolve UNKNOWN. Files/secrets are never persisted to browser storage.
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (flight.current || attempt.current || uploadLocked) return;
    try {
      if (window.sessionStorage.getItem(unresolvedUploadKey)) {
        setUploadPhase("UNKNOWN"); setUploadError("uploadUnknown"); return;
      }
    } catch { setUploadPhase("NOT_READY"); setUploadError("uploadNotReady"); return; }
    if (!uploadFile || !active || !canUpload || !availableUploadProperties || uploadPropertiesError) return;
    if (uploadPropertyId && !availableUploadProperties.some(p => p.id === uploadPropertyId)) return;
    const workspace = dashboard?.contextId === active.context_id ? dashboard.workspace_id : null;
    if (!workspace) { setUploadError("uploadIdentity"); return; }
    flight.current = true; // BEFORE the first await or React render.
    const started = generation.current;
    const same = () => generation.current === started && currentScope.current === scope;
    const file = uploadFile;
    const metadata = JSON.stringify({ context_id: active.context_id, filename: file.name,
      declared_mime: file.type, size_bytes: file.size, title: uploadTitle || file.name,
      document_type: uploadType, classification: uploadClassification, property_id: uploadPropertyId || null });
    setUploadError("");
    setUploadPhase("intent");
    try {
      const { data, error: identityError } = await createClient().auth.getUser();
      if (!same()) return;
      if (identityError || !data.user || (actor.current && actor.current !== data.user.id)) {
        setUploadError("uploadIdentity"); setUploadPhase("idle"); return;
      }
      actor.current = data.user.id;
      // A MIME fallback would change the command and mislabel the selected file.
      const valid = /^(application\/(pdf|msword|vnd\.ms-excel|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet))|image\/(jpeg|png|webp)|text\/plain)$/.test(file.type)
        && file.size > 0 && file.size <= 20 * 1024 * 1024
        && !/\.(exe|sh|bat|cmd|js|mjs|ts|html?|svg|php|py|zip|tar|gz|rar)$/i.test(file.name);
      if (!valid) { setUploadError("uploadInvalid"); setUploadPhase("idle"); return; }
      const record = { key: crypto.randomUUID(), finalizationKey: crypto.randomUUID(), scope,
        metadata, intent: null as DocumentsUploadUiBindingV1 | null };
      attempt.current = record;
      // Only a literal barrier is persisted: never file bytes, metadata, keys,
      // identities, paths, raw receipts or credentials. It cannot enable retry.
      window.sessionStorage.setItem(unresolvedUploadKey, "pending");
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(metadata));
      if (!same()) return;
      const requestHash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
      const intentRes = await fetch("/api/customer/v1/documents/upload-intent", {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: AbortSignal.timeout(30_000),
        cache: "no-store", credentials: "same-origin",
        body: JSON.stringify({ ...JSON.parse(metadata), idempotency_key: record.key, request_sha256: requestHash }),
      });
      const intentBody: unknown = await intentRes.json();
      if (!same()) return;
      // The unchanged, known maintenance reply precedes every write/byte read.
      if (intentRes.status === 503 && (intentBody as { error?: { code?: string } })?.error?.code === "CANONICAL_DOCUMENT_WRITER_UNAVAILABLE") {
        window.sessionStorage.removeItem(unresolvedUploadKey);
        setUploadPhase("NOT_READY"); setUploadError("uploadNotReady"); return;
      }
      const parsed = documentsUploadIntentAckV1Schema.safeParse(intentBody);
      if (!intentRes.ok || !parsed.success) throw new Error("unconfirmed intent");
      const intent = parsed.data;
      if (intent.context_id !== active.context_id || intent.workspace_id !== workspace
        || intent.actor_id !== data.user.id || intent.idempotency_key !== record.key
        || intent.request_sha256 !== requestHash) throw new Error("intent binding");
      record.intent = intent;
      setUploadPhase("upload");
      const form = new FormData();
      for (const [key, value] of Object.entries(JSON.parse(metadata))) if (value !== null) form.append(key, String(value));
      form.append("intent_id", intent.intent_id);
      form.append("idempotency_key", record.finalizationKey);
      form.append("request_sha256", requestHash);
      form.append("file", file);
      const uploadRes = await fetch("/api/customer/v1/documents/upload", {
        method: "POST", cache: "no-store", credentials: "same-origin", body: form, signal: AbortSignal.timeout(30_000),
      });
      if (!same()) return;
      setUploadPhase("finalization");
      const ack: unknown = await uploadRes.json();
      if (!same()) return;
      if (!uploadRes.ok || !matchesDocumentsUploadFinalizationAckV1(ack, intent, record.finalizationKey)) throw new Error("unconfirmed finalization");
      window.sessionStorage.removeItem(unresolvedUploadKey);
      setUploadPhase("confirmed");
      setUploadFile(null);
      // Confirmation is registration only, never scan/content/download authority.
      void load();
    } catch {
      if (same()) { setUploadPhase("UNKNOWN"); setUploadError("uploadUnknown"); }
    } finally {
      flight.current = false; // attempt remains pinned even after denial or ACK loss.
    }
  };

  // Perform Authorized Download
  const handleDownload = async (docId: string, isAdminInspection: boolean = false) => {
    if (!active) return;
    const started = generation.current;
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
      if (generation.current !== started) return;
      if (!res.ok) {
        throw new Error(data?.error?.message || "Download authorization denied");
      }

      setActionNotice(null);
      if (data.download_url) {
        window.open(data.download_url, "_blank", "noopener,noreferrer");
      }
    } catch (err: any) {
      if (generation.current !== started) return;
      setActionNotice(null);
      setActionError(err?.message || "Download failed");
    }
  };

  // Place Legal Hold
  const handlePlaceLegalHold = async (docId: string) => {
    if (!active || !canHold) return;
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
    if (!active || !canHold) return;
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
              CLADORA · Documents
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-[#102A43]">{t.title}</h1>
            <p className="mt-1 max-w-3xl text-xs text-[#52667A]">{t.sub}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#B2E5DF] bg-[#EAF8F5] px-3 py-1 text-[11px] font-bold text-[#0A6E62]">
              {t.vaultActive}
            </span>
            {canUpload && <button
              type="button"
              onClick={() => {
                if (uploadPhase === "confirmed") {
                  attempt.current = null;
                  setUploadPhase("idle");
                  setUploadTitle("");
                  setUploadError("");
                }
                setUploadProperties(null);
                setUploadPropertiesContextId("");
                setUploadPropertiesError(false);
                setIsUploadOpen(true);
              }}
              className="flex items-center gap-2 rounded-xl bg-[#0E9F8E] px-4 py-2 text-xs font-bold text-white shadow hover:bg-[#0A6E62] transition-colors"
            >
              <UploadCloud className="h-4 w-4" />
              {t.uploadBtn}
            </button>}
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
                        {view === "documents" ? (
                          <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1 ${row.scanning_status === "clean" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : row.scanning_status === "quarantined" ? "border-red-300 bg-red-50 text-red-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
                            <ShieldAlert className="h-3 w-3" />
                            {row.scanning_status === "clean" ? t.scannerClean : row.scanning_status === "quarantined" ? t.scannerQuarantined : t.scannerDeferred}
                          </span>
                        ) : null}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102A43]/45 p-4" role="dialog" aria-modal="true" aria-label={t.uploadTitle}>
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
                }}
              >
                <X className="h-5 w-5 text-[#64748B]" />
              </button>
            </div>

            <form onSubmit={handleUploadSubmit} className="mt-4 space-y-4" data-upload-phase={uploadPhase}>
              <fieldset disabled={uploadLocked} className="space-y-4">
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
                  placeholder="e.g. Meeting minutes 2026"
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] p-2 text-xs focus:ring-2 focus:ring-[#0E9F8E] focus:outline-none"
                />
              </div>

              {/* Document Type & Classification */}
              <div>
                <label htmlFor="upload-property" className="block text-xs font-bold text-[#334155]">{t.property}</label>
                <select id="upload-property" value={uploadPropertyId}
                  disabled={!availableUploadProperties || uploadPropertiesError || uploadLocked}
                  onChange={(e) => setUploadPropertyId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[#CBD5E1] p-2 text-xs">
                  <option value="">{t.noProperty}</option>
                  {availableUploadProperties?.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
                </select>
                {!availableUploadProperties && !uploadPropertiesError && <p className="mt-1 text-xs text-[#64748B]">{t.propertyLoading}</p>}
                {uploadPropertiesError && <p role="alert" className="mt-1 text-xs text-red-700">{t.propertyError}</p>}
              </div>
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

              </fieldset>
              {/* Progress & Feedback */}
              {uploadStep && (
                <div className="rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-teal-800 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin text-[#0E9F8E]" />
                  {uploadStep}
                </div>
              )}
              {uploadError && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {t[uploadError]}
                </div>
              )}
              {uploadPhase === "confirmed" && (
                <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 font-bold">
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
                  disabled={uploadLocked || !uploadFile || !availableUploadProperties || uploadPropertiesError}
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
                  {canHold && (selected.legal_hold_status === "active" ? (
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
                  ))}
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
