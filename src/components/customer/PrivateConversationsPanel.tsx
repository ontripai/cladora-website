"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useCustomerContext } from "./CustomerContextProvider";
import { UnitInvitationsPanel } from './UnitInvitationsPanel';
import type { Language } from "@/types";

type Unit = { id: string; property_name: string; building_name: string; unit_code: string };
type Recipient = { membership_id: string; display_name?: string; name?: string; role_code?: string };
type Message = { id: string; sender_id: string; body: string; sent_at: string };
type Thread = { id: string; unit_id: string; participants: Recipient[]; messages: Message[] };
type Attachment = { id: string; message_id: string; title: string };
type Attachable = { id: string; version_id: string; title: string };
type Unread = { conversation_id: string; unread_count: number };
type PendingFile = { conversationId: string; documentId: string; versionId: string; requestId: string; createdAt: number };

const fileMimes: Record<string, string> = {
  pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp",
  txt: "text/plain", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const pendingKey = (membershipId: string, contextId: string) => `cladora:private-files:${membershipId}:${contextId}`;
function readPendingFiles(key: string): PendingFile[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(stored)) return [];
    return stored.filter((item): item is PendingFile => item !== null && typeof item === "object"
      && ["conversationId", "documentId", "versionId", "requestId"].every((field) => typeof item[field] === "string")
      && typeof item.createdAt === "number" && Number.isFinite(item.createdAt));
  } catch { return []; }
}

async function post(url: string, body: Record<string, string>) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(String(response.status));
  return response.json() as Promise<{ download_url?: string }>;
}

const words = {
  ro: { title: "Conversații private", back: "Înapoi la comunicări", new: "Conversație nouă", unit: "Unitate", recipient: "Destinatar", body: "Mesaj", send: "Trimite", reply: "Răspunde", empty: "Nu există conversații în acest context.", unavailable: "Conversațiile nu sunt disponibile în acest context.", loading: "Se încarcă…", select: "Selectați", more: "Mai multe unități", history: "Istoric mesaje", busy: "Se trimite…", unread: "necitite", document: "Document din seif", attach: "Partajează documentul", download: "Descarcă documentul", read: "Marchează ca citit", vault: "Selectați un document deja aprobat pentru ambele persoane.", upload: "Trimite fișier", scanning: "Fișierul a fost încărcat. Se verifică înainte de partajare; puteți reveni mai târziu…", uploadBusy: "Se încarcă…", refresh: "Actualizează lista documentelor", files: "Folosește un document din seif", write: "Scrieți un mesaj…", you: "Dumneavoastră", chooseConversation: "Alegeți o conversație sau începeți una nouă.", attached: "Fișierul a fost verificat și atașat conversației.", pending: "Verificarea continuă. Deschideți documentele din seif mai târziu pentru a atașa fișierul aprobat.", uploadError: "Fișierul nu a putut fi atașat. Verificați dimensiunea (maxim 200 KB) și accesul, apoi încercați din nou.", fileLimit: "Maximum 200 KB per fișier · mesajul nu este necesar", rejected: "Fișierul a fost respins la verificare. Alegeți alt fișier.", shareDenied: "Fișierul este verificat, dar nu poate fi partajat în această conversație.", invalidFile: "Fișierul nu este acceptat sau este deteriorat. Alegeți PDF, imagine, text, Word sau Excel.", tooLarge: "Fișierul depășește limita de 200 KB.", cancel: "Anulează", firstMessage: "Trimiteți mai întâi un mesaj, apoi atașați fișierul." },
  en: { title: "Private conversations", back: "Back to communications", new: "New conversation", unit: "Unit", recipient: "Recipient", body: "Message", send: "Send", reply: "Reply", empty: "No conversations in this context.", unavailable: "Conversations are unavailable in this context.", loading: "Loading…", select: "Select", more: "More units", history: "Message history", busy: "Sending…", unread: "unread", document: "Vault document", attach: "Share document", download: "Download document", read: "Mark as read", vault: "Choose a document already approved for both participants.", upload: "Send file", scanning: "File uploaded. Checking it before sharing; you can come back later…", uploadBusy: "Uploading…", refresh: "Refresh documents", files: "Use a vault document", write: "Write a message…", you: "You", chooseConversation: "Choose a conversation or start a new one.", attached: "File checked and attached to the conversation.", pending: "The check is still running. Open vault documents later to attach the approved file.", uploadError: "Could not attach the file. Check its size (200 KB maximum) and access, then try again.", fileLimit: "200 KB per file · no message required", rejected: "The file did not pass the safety check. Choose another file.", shareDenied: "The file passed its check, but cannot be shared in this conversation.", invalidFile: "This file is unsupported or damaged. Choose a PDF, image, text, Word or Excel file.", tooLarge: "This file exceeds 200 KB.", cancel: "Cancel", firstMessage: "Send a message first, then attach your file." },
  fa: { title: "گفت‌وگوهای خصوصی", back: "بازگشت به ارتباطات", new: "گفت‌وگوی جدید", unit: "واحد", recipient: "گیرنده", body: "پیام", send: "ارسال", reply: "پاسخ", empty: "در این فضای کاری گفت‌وگویی وجود ندارد.", unavailable: "گفت‌وگوها در این فضای کاری در دسترس نیستند.", loading: "در حال بارگذاری…", select: "انتخاب کنید", more: "واحدهای بیشتر", history: "سابقهٔ پیام‌ها", busy: "در حال ارسال…", unread: "خوانده‌نشده", document: "سند از خزانه", attach: "اشتراک‌گذاری سند", download: "دریافت سند", read: "علامت‌گذاری به‌عنوان خوانده‌شده", vault: "سندی را انتخاب کنید که برای هر دو طرف مجوز مشاهده دارد.", upload: "ارسال فایل", scanning: "فایل بارگذاری شد؛ در حال بررسی است؛ می‌توانید بعداً به گفت‌وگو برگردید…", uploadBusy: "در حال بارگذاری…", refresh: "به‌روزرسانی فهرست اسناد", files: "استفاده از سند خزانه", write: "پیام خود را بنویسید…", you: "شما", chooseConversation: "یک گفت‌وگو انتخاب کنید یا گفت‌وگوی جدیدی آغاز کنید.", attached: "فایل بررسی و به گفتگو پیوست شد.", pending: "بررسی فایل هنوز ادامه دارد. بعداً از بخش اسناد خزانه، فایل تأییدشده را پیوست کنید.", uploadError: "پیوست فایل انجام نشد. حجم آن (حداکثر ۲۰۰ کیلوبایت) و دسترسی را بررسی و دوباره تلاش کنید.", fileLimit: "هر فایل حداکثر ۲۰۰ کیلوبایت؛ نوشتن پیام لازم نیست", rejected: "فایل در بررسی ایمنی رد شد. فایل دیگری انتخاب کنید.", shareDenied: "فایل بررسی شد، اما در این گفت‌وگو قابل اشتراک‌گذاری نیست.", invalidFile: "نوع فایل پشتیبانی نمی‌شود یا فایل آسیب دیده است. PDF، تصویر، متن، Word یا Excel انتخاب کنید.", tooLarge: "حجم فایل بیش از ۲۰۰ کیلوبایت است.", cancel: "انصراف", firstMessage: "ابتدا یک پیام بفرستید و سپس فایل را پیوست کنید." },
} satisfies Record<Language, Record<string, string>>;

async function readArray<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Invalid response");
  return data as T[];
}

export function PrivateConversationsPanel({ lang }: { lang: Language }) {
  const { active } = useCustomerContext();
  return <><PrivateConversationsContent key={active?.context_id ?? "no-context"} lang={lang}
    contextId={active?.context_id} membershipId={active?.membership_id}
    canOpenVault={!['company_staff', 'vendor_contact'].includes(active?.role_code?.toLowerCase() ?? '')} />
    {active?.context_id && ['association_admin', 'property_manager'].includes(active.role_code?.toLowerCase() ?? '')
      && <div className="mx-auto max-w-5xl px-4 pb-8"><UnitInvitationsPanel key={active.context_id} lang={lang} contextId={active.context_id} /></div>}
  </>;
}

function PrivateConversationsContent({ lang, contextId, membershipId, canOpenVault }: { lang: Language; contextId?: string; membershipId?: string; canOpenVault: boolean }) {
  const t = words[lang];
  const [threads, setThreads] = useState<Thread[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [unitId, setUnitId] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [unread, setUnread] = useState<Unread[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachable, setAttachable] = useState<Attachable[]>([]);
  const [documentId, setDocumentId] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadBusy, setUploadBusy] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pendingStorageKey = contextId && membershipId ? pendingKey(membershipId, contextId) : "";

  useEffect(() => {
    if (!pendingStorageKey) return;
    const restore = () => setPendingFiles(readPendingFiles(pendingStorageKey));
    const timer = window.setTimeout(restore, 0);
    const onStorage = (event: StorageEvent) => { if (event.key === pendingStorageKey) restore(); };
    window.addEventListener("storage", onStorage);
    return () => { window.clearTimeout(timer); window.removeEventListener("storage", onStorage); };
  }, [pendingStorageKey]);

  const updatePendingFiles = useCallback((change: (current: PendingFile[]) => PendingFile[]) => {
    if (!pendingStorageKey) return;
    const next = change(readPendingFiles(pendingStorageKey));
    localStorage.setItem(pendingStorageKey, JSON.stringify(next));
    setPendingFiles(next);
  }, [pendingStorageKey]);

  const reload = useCallback(async () => {
    if (!contextId) return;
    const q = encodeURIComponent(contextId);
    const [newThreads, newUnits, newUnread] = await Promise.all([
      readArray<Thread>(`/api/customer/v1/private-conversations?context_id=${q}`),
      readArray<Unit>(`/api/customer/v1/private-conversations/recipients?context_id=${q}`),
      readArray<Unread>(`/api/customer/v1/private-conversations/unread?context_id=${q}`),
    ]);
    setThreads(newThreads);
    setUnits(newUnits);
    setUnread(newUnread);
    setSelectedId((current) => newThreads.some((row) => row.id === current) ? current : newThreads[0]?.id ?? "");
  }, [contextId]);

  // The file is sent as soon as the scanner approves it. Keep this work separate
  // from the composer so leaving and reopening the page does not lose the file.
  useEffect(() => {
    if (!contextId || !pendingStorageKey || pendingFiles.length === 0) return;
    let cancelled = false;
    let checking = false;
    async function checkPending() {
      if (checking || cancelled) return;
      checking = true;
      try {
        for (const file of pendingFiles) {
          if (cancelled) break;
          if (Date.now() - file.createdAt >= 7 * 24 * 60 * 60 * 1000) {
            updatePendingFiles((current) => current.filter((item) => item.requestId !== file.requestId));
            setUploadStatus(t.pending);
            continue;
          }
          try {
            const statusUrl = `/api/customer/v1/private-conversations/${file.conversationId}/files/status?context_id=${encodeURIComponent(contextId!)}&document_id=${encodeURIComponent(file.documentId)}&version_id=${encodeURIComponent(file.versionId)}`;
            const statusResponse = await fetch(statusUrl, { cache: "no-store" });
            if (statusResponse.status === 403) {
              updatePendingFiles((current) => current.filter((item) => item.requestId !== file.requestId));
              if (selectedId === file.conversationId) setUploadStatus(t.shareDenied);
              continue;
            }
            if (!statusResponse.ok) throw new Error("Scan status unavailable");
            const result = await statusResponse.json() as { status: "checking" | "ready" | "rejected" };
            if (result.status === "checking" || cancelled) continue;
            if (result.status === "rejected") {
              updatePendingFiles((current) => current.filter((item) => item.requestId !== file.requestId));
              if (selectedId === file.conversationId) setUploadStatus(t.rejected);
              continue;
            }
            if (result.status !== "ready") throw new Error("Unknown scan status");
            const base = `/api/customer/v1/private-conversations/${file.conversationId}/attachments?context_id=${encodeURIComponent(contextId!)}`;
            const available = await readArray<Attachable>(`${base}&available=true`);
            if (!available.some((item) => item.id === file.documentId && item.version_id === file.versionId)) {
              updatePendingFiles((current) => current.filter((item) => item.requestId !== file.requestId));
              if (selectedId === file.conversationId) setUploadStatus(t.shareDenied);
              continue;
            }
            if (cancelled) continue;
            await post(`/api/customer/v1/private-conversations/${file.conversationId}/files`, {
              context_id: contextId!, document_id: file.documentId, version_id: file.versionId, request_id: file.requestId,
            });
            updatePendingFiles((current) => current.filter((item) => item.requestId !== file.requestId));
            if (selectedId === file.conversationId) setUploadStatus(t.attached);
            await reload();
            if (selectedId === file.conversationId) setAttachments(await readArray<Attachment>(base));
          } catch { /* A temporary network or scanner delay is retried on the next check. */ }
        }
      } finally { checking = false; }
    }
    void checkPending();
    const timer = window.setInterval(() => void checkPending(), 30000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [contextId, pendingStorageKey, pendingFiles, reload, selectedId, t, updatePendingFiles]);

  useEffect(() => {
    let cancelled = false;
    if (!contextId) return;
    void Promise.all([
      readArray<Thread>(`/api/customer/v1/private-conversations?context_id=${encodeURIComponent(contextId)}`),
      readArray<Unit>(`/api/customer/v1/private-conversations/recipients?context_id=${encodeURIComponent(contextId)}`),
      readArray<Unread>(`/api/customer/v1/private-conversations/unread?context_id=${encodeURIComponent(contextId)}`),
    ]).then(([a, b, c]) => { if (!cancelled) { setThreads(a); setUnits(b); setUnread(c); setHasMore(b.length === 25); setSelectedId(a[0]?.id ?? ""); } })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [contextId]);

  useEffect(() => {
    let cancelled = false;
    if (!contextId || !unitId) return;
    void readArray<Recipient>(`/api/customer/v1/private-conversations/recipients?context_id=${encodeURIComponent(contextId)}&unit_id=${encodeURIComponent(unitId)}`)
      .then((data) => { if (!cancelled) setRecipients(data); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [contextId, unitId]);

  useEffect(() => {
    let cancelled = false;
    if (!contextId || !selectedId) return;
    const base = `/api/customer/v1/private-conversations/${selectedId}/attachments?context_id=${encodeURIComponent(contextId)}`;
    void Promise.all([readArray<Attachment>(base), readArray<Attachable>(`${base}&available=true`)]).then(([a, b]) => {
      if (!cancelled) { setAttachments(a); setAttachable(b); }
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [contextId, selectedId, threads]);

  async function refreshDocuments() {
    if (!contextId || !selectedId) return;
    try {
      const base = `/api/customer/v1/private-conversations/${selectedId}/attachments?context_id=${encodeURIComponent(contextId)}`;
      const [available, linked] = await Promise.all([readArray<Attachable>(`${base}&available=true`), readArray<Attachment>(base)]);
      setAttachable(available); setAttachments(linked);
    } catch { setError(true); }
  }

  async function markRead() {
    if (!contextId || !selectedId) return;
    try {
      await post(`/api/customer/v1/private-conversations/${selectedId}/read`, { context_id: contextId });
      setUnread((current) => current.map((row) => row.conversation_id === selectedId ? { ...row, unread_count: 0 } : row));
    } catch { setError(true); }
  }

  async function attach() {
    const document = attachable.find((item) => item.id === documentId);
    const ownMessageId = threads.find((thread) => thread.id === selectedId)?.messages.filter((item) => item.sender_id === membershipId).at(-1)?.id;
    if (!contextId || !selectedId || !ownMessageId || !document) return;
    setBusy(true);
    try {
      await post(`/api/customer/v1/private-conversations/${selectedId}/attachments`, { context_id: contextId, message_id: ownMessageId, document_id: document.id, version_id: document.version_id });
      setAttachments(await readArray<Attachment>(`/api/customer/v1/private-conversations/${selectedId}/attachments?context_id=${encodeURIComponent(contextId)}`));
      setDocumentId("");
    } catch { setError(true); } finally { setBusy(false); }
  }

  async function download(id: string) {
    if (!contextId) return;
    try {
      const result = await post(`/api/customer/v1/private-conversations/attachments/${id}/download`, { context_id: contextId });
      if (!result.download_url) throw new Error("Missing signed URL");
      window.location.assign(result.download_url);
    } catch { setError(true); }
  }

  async function upload(file: File) {
    const conversationId = selectedId;
    if (!contextId || !conversationId) { setUploadStatus(t.uploadError); return; }
    if (file.size > 200 * 1024) { setUploadStatus(t.tooLarge); return; }
    const declaredMime = fileMimes[file.name.split(".").at(-1)?.toLowerCase() ?? ""];
    if (!declaredMime) { setUploadStatus(t.invalidFile); return; }
    setUploadBusy(true); setUploadStatus(t.uploadBusy);
    try {
      const uploadContext = await fetch(`/api/customer/v1/private-conversations/${conversationId}/upload-context?context_id=${encodeURIComponent(contextId)}`, { cache: "no-store" });
      if (!uploadContext.ok) throw new Error(String(uploadContext.status));
      const { property_id: propertyId } = await uploadContext.json() as { property_id: string };
      const intentResponse = await fetch("/api/customer/v1/documents/upload-intent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context_id: contextId, filename: file.name, declared_mime: declaredMime, size_bytes: file.size }),
      });
      if (!intentResponse.ok) throw new Error(intentResponse.status === 400 ? "INVALID_FILE" : String(intentResponse.status));
      const intent = await intentResponse.json() as { intent_id: string; object_path: string };
      if (!intent.intent_id || !intent.object_path) throw new Error("Missing upload intent path");
      const form = new FormData();
      form.append("context_id", contextId); form.append("intent_id", intent.intent_id);
      form.append("object_path", intent.object_path);
      form.append("title", file.name); form.append("document_type", "conversation_attachment");
      form.append("classification", "confidential"); form.append("declared_mime", declaredMime);
      form.append("property_id", propertyId); form.append("file", file);
      const uploadResponse = await fetch("/api/customer/v1/documents/upload", { method: "POST", body: form });
      if (!uploadResponse.ok) throw new Error(uploadResponse.status === 400 ? "INVALID_FILE" : String(uploadResponse.status));
      const uploaded = await uploadResponse.json() as { document_id: string; version_id: string };
      if (!uploaded.document_id || !uploaded.version_id) throw new Error("Missing document version");
      updatePendingFiles((current) => [...current, {
        conversationId, documentId: uploaded.document_id, versionId: uploaded.version_id,
        requestId: crypto.randomUUID(), createdAt: Date.now(),
      }]);
      setUploadStatus(t.scanning);
    } catch (error) { setUploadStatus(error instanceof Error && error.message === "INVALID_FILE" ? t.invalidFile : t.uploadError); } finally { setUploadBusy(false); }
  }

  async function submit(url: string, body: Record<string, string>) {
    setBusy(true); setError(false);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(String(response.status));
      const result = await response.json() as { conversation_id?: string };
      await reload();
      if (result.conversation_id) setSelectedId(result.conversation_id);
      setCreating(false);
      setMessage(""); setReply("");
    } catch { setError(true); } finally { setBusy(false); }
  }

  const selected = threads.find((item) => item.id === selectedId);
  const ownMessageId = selected?.messages.filter((item) => item.sender_id === membershipId).at(-1)?.id;
  const peerName = (thread: Thread) => thread.participants?.filter((person) => person.membership_id !== membershipId).map((person) => person.display_name ?? person.name).filter(Boolean).join(", ") || thread.participants?.map((person) => person.display_name ?? person.name).filter(Boolean).join(", ") || t.recipient;
  const formatTime = (value: string) => new Date(value).toLocaleString(lang === "fa" ? "fa-IR" : lang === "ro" ? "ro-RO" : "en-GB", { dateStyle: "short", timeStyle: "short" });
  const showComposer = creating || threads.length === 0;
  useEffect(() => { if (!showComposer && selected) bottomRef.current?.scrollIntoView({ block: "nearest" }); }, [selected, showComposer]);
  return <section dir={lang === "fa" ? "rtl" : "ltr"} className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
    <Link href={`/${lang}/app/communications`} className="text-sm text-teal-700 underline">{t.back}</Link>
    <h1 className="text-2xl font-semibold text-slate-900">{t.title}</h1>
    {loading && <p role="status">{t.loading}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{t.unavailable}</p>}
    {!loading && !!contextId && <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:min-h-[650px] lg:grid-cols-[minmax(240px,320px)_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-slate-50/70 lg:border-b-0 lg:border-e">
        <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-4">
          <h2 className="font-semibold text-slate-900">{t.history}</h2>
          <button type="button" onClick={() => setCreating(true)} className="rounded-full bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-800">+ {t.new}</button>
        </div>
        {threads.length === 0 && <p className="p-4 text-sm text-slate-600">{t.empty}</p>}
        <div className="max-h-72 overflow-y-auto lg:max-h-[650px]">{threads.map((thread) => <button key={thread.id} type="button" onClick={() => { setCreating(false); setSelectedId(thread.id); }}
          aria-pressed={!creating && selectedId === thread.id}
          className={`flex w-full items-center gap-3 border-b border-slate-100 px-4 py-4 text-start hover:bg-teal-50 ${!creating && selectedId === thread.id ? "bg-teal-50" : ""}`}>
          <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-teal-100 font-semibold text-teal-800">{peerName(thread).slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-900">{peerName(thread)}</span>
            <span className="block truncate text-sm text-slate-500">{thread.messages?.at(-1)?.body}</span></span>
          {!!unread.find((row) => row.conversation_id === thread.id)?.unread_count && <span className="rounded-full bg-teal-700 px-2 py-0.5 text-xs text-white">{unread.find((row) => row.conversation_id === thread.id)?.unread_count}</span>}
        </button>)}</div>
      </aside>
      <div className="min-w-0">
        {!showComposer && selected && <section className="flex min-h-[560px] flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
            <h2 className="font-semibold text-slate-900">{peerName(selected)}</h2>
            {!!unread.find((row) => row.conversation_id === selected.id)?.unread_count && <button type="button" onClick={() => void markRead()} className="rounded-lg border border-teal-700 px-3 py-1.5 text-sm text-teal-700">{t.read}</button>}
          </div>
          <ol aria-label={t.history} className="flex min-h-[320px] max-h-[60vh] flex-1 flex-col gap-3 overflow-y-auto bg-slate-50 px-4 py-6 sm:px-6">{selected.messages?.map((item) => {
            const mine = item.sender_id === membershipId;
            const sender = selected.participants?.find((person) => person.membership_id === item.sender_id);
            return <li key={item.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 shadow-sm sm:max-w-[75%] ${mine ? "rounded-es-sm bg-teal-100 text-slate-900" : "rounded-ee-sm bg-white text-slate-900"}`}>
                <span className="block text-xs font-semibold text-teal-800">{mine ? t.you : sender?.display_name ?? sender?.name ?? peerName(selected)}</span>
                {!attachments.some((a) => a.message_id === item.id && item.body === `📎 ${a.title}`) && <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.body}</p>}
                {attachments.filter((a) => a.message_id === item.id).map((a) => <button key={a.id} type="button" onClick={() => void download(a.id)} className="mt-2 block break-all text-sm text-teal-800 underline">📎 {a.title}</button>)}
                <time className="mt-1 block text-end text-xs text-slate-500" dateTime={item.sent_at}>{formatTime(item.sent_at)}</time>
              </div>
            </li>;
          })}<div ref={bottomRef} /></ol>
          <form className="border-t border-slate-200 bg-white p-4" onSubmit={(event) => { event.preventDefault(); if (contextId && reply.trim() && !busy) void submit(`/api/customer/v1/private-conversations/${selected.id}/messages`, { context_id: contextId, body: reply.trim(), request_id: crypto.randomUUID() }); }}>
            <label htmlFor="private-reply" className="sr-only">{t.reply}</label>
            <div className="flex items-end gap-2">
              <label htmlFor="private-upload" aria-label={t.upload} title={uploadBusy ? t.uploadBusy : t.upload} className={`flex min-h-12 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-slate-300 px-3 text-lg text-teal-800 hover:bg-teal-50 ${uploadBusy ? "pointer-events-none opacity-50" : ""}`}>📎<span className="sr-only">{t.upload}</span></label>
              <input id="private-upload" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx,.xls,.xlsx" disabled={uploadBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} className="sr-only" />
              <textarea id="private-reply" required rows={1} maxLength={5000} placeholder={t.write} value={reply} onChange={(event) => setReply(event.target.value)} className="min-h-12 flex-1 resize-y rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-teal-600" />
              <button type="submit" disabled={busy || !reply.trim()} className="min-h-12 rounded-xl bg-teal-700 px-4 text-white hover:bg-teal-800 disabled:opacity-50">{busy ? t.busy : t.send}</button>
            </div>
            <p className="mt-2 text-xs text-slate-500">{t.fileLimit}</p>
            {(pendingFiles.some((item) => item.conversationId === selectedId) || uploadStatus) && <p role="status" className="mt-2 text-sm text-teal-800">{pendingFiles.some((item) => item.conversationId === selectedId) ? t.scanning : uploadStatus}</p>}
          </form>
          <details className="border-t border-slate-100 px-4 py-3 sm:px-6"><summary className="cursor-pointer text-sm font-medium text-teal-800">{t.files}</summary>
          <div className="mt-4 space-y-2">
            <label htmlFor="private-document" className="block">{t.document}</label>
            <select id="private-document" value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="w-full rounded-lg border border-slate-400 p-2"><option value="">{t.select}</option>{attachable.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select>
            {!attachable.length && <p className="text-xs text-slate-600">{t.vault} {canOpenVault && <Link href={`/${lang}/app/documents`} className="text-blue-700 underline">{t.document}</Link>}</p>}
            <button type="button" onClick={() => void refreshDocuments()} className="block text-sm text-blue-700 underline">{t.refresh}</button>
            <button type="button" disabled={!documentId || busy || !ownMessageId} onClick={() => void attach()} className="rounded-lg border border-blue-700 px-3 py-2 text-blue-700 disabled:opacity-50">{t.attach}</button>
          </div>
          </details>
        </section>}
        {showComposer && <section className="space-y-3 p-4 sm:p-6">
          <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">{t.new}</h2>{threads.length > 0 && <button type="button" onClick={() => setCreating(false)} className="rounded-lg px-3 py-2 text-sm text-teal-800 hover:bg-teal-50">{t.cancel}</button>}</div>
          <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); if (contextId && unitId && recipientId && message.trim()) void submit("/api/customer/v1/private-conversations", { context_id: contextId, unit_id: unitId, recipient_membership_id: recipientId, body: message.trim(), request_id: crypto.randomUUID() }); }}>
            <label className="block" htmlFor="private-unit">{t.unit}</label>
            <select id="private-unit" required value={unitId} onChange={(event) => { setUnitId(event.target.value); setRecipients([]); setRecipientId(""); }} className="w-full rounded-lg border border-slate-400 p-2"><option value="">{t.select}</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.property_name} · {unit.building_name} · {unit.unit_code}</option>)}</select>
            {hasMore && <button type="button" className="text-sm text-blue-700 underline" onClick={() => { if (!contextId) return; const next = offset + 25; void readArray<Unit>(`/api/customer/v1/private-conversations/recipients?context_id=${encodeURIComponent(contextId)}&offset=${next}`).then((newUnits) => { setUnits((old) => [...old, ...newUnits]); setOffset(next); setHasMore(newUnits.length === 25); }).catch(() => setError(true)); }}>{t.more}</button>}
            <label className="block" htmlFor="private-recipient">{t.recipient}</label>
            <select id="private-recipient" required value={recipientId} onChange={(event) => setRecipientId(event.target.value)} className="w-full rounded-lg border border-slate-400 p-2"><option value="">{t.select}</option>{recipients.map((recipient) => <option key={recipient.membership_id} value={recipient.membership_id}>{recipient.display_name}</option>)}</select>
            <label className="block" htmlFor="private-message">{t.body}</label>
            <textarea id="private-message" required maxLength={5000} value={message} onChange={(event) => setMessage(event.target.value)} className="w-full rounded-lg border border-slate-400 p-2" />
            <button type="submit" disabled={busy || !unitId || !recipientId || !message.trim()} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{busy ? t.busy : t.send}</button>
          </form>
        </section>}
        {!showComposer && !selected && <p className="p-8 text-slate-600">{t.chooseConversation}</p>}
      </div>
    </div>}
  </section>;
}
