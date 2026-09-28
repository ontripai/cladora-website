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

const words = {
  ro: { title: "Conversații private", back: "Înapoi la comunicări", new: "Conversație nouă", unit: "Unitate", recipient: "Destinatar", body: "Mesaj", send: "Trimite", reply: "Răspunde", empty: "Nu există conversații în acest context.", unavailable: "Conversațiile nu sunt disponibile în acest context.", loading: "Se încarcă…", select: "Selectați", more: "Mai multe unități", history: "Istoric mesaje", busy: "Se trimite…", unread: "necitite", document: "Document din seif", attach: "Partajează și atașează", download: "Descarcă documentul", read: "Marchează ca citit", vault: "Selectați un document deja aprobat pentru ambele persoane.", upload: "Atașează fișier", scanning: "Fișierul a fost încărcat. Se verifică înainte de partajare…", uploadBusy: "Se încarcă…", refresh: "Actualizează lista documentelor", files: "Documente și fișiere", write: "Scrieți un mesaj…", you: "Dumneavoastră", chooseConversation: "Alegeți o conversație sau începeți una nouă.", attached: "Fișierul a fost verificat și atașat conversației.", pending: "Verificarea continuă. Deschideți Documente și fișiere mai târziu pentru a atașa fișierul aprobat.", uploadError: "Fișierul nu a putut fi atașat. Verificați dimensiunea (maxim 20 MB) și accesul, apoi încercați din nou.", firstMessage: "Trimiteți mai întâi un mesaj, apoi atașați fișierul." },
  en: { title: "Private conversations", back: "Back to communications", new: "New conversation", unit: "Unit", recipient: "Recipient", body: "Message", send: "Send", reply: "Reply", empty: "No conversations in this context.", unavailable: "Conversations are unavailable in this context.", loading: "Loading…", select: "Select", more: "More units", history: "Message history", busy: "Sending…", unread: "unread", document: "Vault document", attach: "Share and attach", download: "Download document", read: "Mark as read", vault: "Choose a document already approved for both participants.", upload: "Attach file", scanning: "File uploaded. Checking it before sharing…", uploadBusy: "Uploading…", refresh: "Refresh documents", files: "Documents and files", write: "Write a message…", you: "You", chooseConversation: "Choose a conversation or start a new one.", attached: "File checked and attached to the conversation.", pending: "The check is still running. Open Documents and files later to attach the approved file.", uploadError: "Could not attach the file. Check its size (20 MB maximum) and access, then try again.", firstMessage: "Send a message first, then attach your file." },
  fa: { title: "گفت‌وگوهای خصوصی", back: "بازگشت به ارتباطات", new: "گفت‌وگوی جدید", unit: "واحد", recipient: "گیرنده", body: "پیام", send: "ارسال", reply: "پاسخ", empty: "در این فضای کاری گفت‌وگویی وجود ندارد.", unavailable: "گفت‌وگوها در این فضای کاری در دسترس نیستند.", loading: "در حال بارگذاری…", select: "انتخاب کنید", more: "واحدهای بیشتر", history: "سابقهٔ پیام‌ها", busy: "در حال ارسال…", unread: "خوانده‌نشده", document: "سند از خزانه", attach: "اشتراک‌گذاری و پیوست", download: "دریافت سند", read: "علامت‌گذاری به‌عنوان خوانده‌شده", vault: "سندی را انتخاب کنید که برای هر دو طرف مجوز مشاهده دارد.", upload: "پیوست فایل", scanning: "فایل بارگذاری شد؛ پیش از اشتراک‌گذاری در حال بررسی است…", uploadBusy: "در حال بارگذاری…", refresh: "به‌روزرسانی فهرست اسناد", files: "اسناد و فایل‌ها", write: "پیام خود را بنویسید…", you: "شما", chooseConversation: "یک گفت‌وگو انتخاب کنید یا گفت‌وگوی جدیدی آغاز کنید.", attached: "فایل بررسی و به گفتگو پیوست شد.", pending: "بررسی فایل هنوز ادامه دارد. بعداً از بخش اسناد و فایل‌ها، فایل تأییدشده را پیوست کنید.", uploadError: "پیوست فایل انجام نشد. حجم آن (حداکثر ۲۰ مگابایت) و دسترسی را بررسی و دوباره تلاش کنید.", firstMessage: "ابتدا یک پیام بفرستید و سپس فایل را پیوست کنید." },
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
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  async function post(url: string, body: Record<string, string>) {
    const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(String(response.status));
    return response.json() as Promise<{ download_url?: string }>;
  }

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
    const messageId = threads.find((thread) => thread.id === conversationId)?.messages.filter((item) => item.sender_id === membershipId).at(-1)?.id;
    if (!contextId || !conversationId || !messageId) { setUploadStatus(t.firstMessage); return; }
    if (file.size > 20 * 1024 * 1024) { setUploadStatus(t.uploadError); return; }
    setUploadBusy(true); setUploadStatus(t.uploadBusy);
    try {
      const uploadContext = await fetch(`/api/customer/v1/private-conversations/${conversationId}/upload-context?context_id=${encodeURIComponent(contextId)}`, { cache: "no-store" });
      if (!uploadContext.ok) throw new Error(String(uploadContext.status));
      const { property_id: propertyId } = await uploadContext.json() as { property_id: string };
      const declaredMime = file.type || "application/pdf";
      const intentResponse = await fetch("/api/customer/v1/documents/upload-intent", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context_id: contextId, filename: file.name, declared_mime: declaredMime, size_bytes: file.size }),
      });
      if (!intentResponse.ok) throw new Error(String(intentResponse.status));
      const intent = await intentResponse.json() as { intent_id: string; object_path: string };
      if (!intent.intent_id || !intent.object_path) throw new Error("Missing upload intent path");
      const form = new FormData();
      form.append("context_id", contextId); form.append("intent_id", intent.intent_id);
      form.append("object_path", intent.object_path);
      form.append("title", file.name); form.append("document_type", "conversation_attachment");
      form.append("classification", "confidential"); form.append("declared_mime", declaredMime);
      form.append("property_id", propertyId); form.append("file", file);
      const uploadResponse = await fetch("/api/customer/v1/documents/upload", { method: "POST", body: form });
      if (!uploadResponse.ok) throw new Error(String(uploadResponse.status));
      const uploaded = await uploadResponse.json() as { document_id: string; version_id: string };
      setUploadStatus(t.scanning);
      const base = `/api/customer/v1/private-conversations/${conversationId}/attachments?context_id=${encodeURIComponent(contextId)}`;
      // Documents become shareable only after the existing server-side scanner marks the version clean.
      // The trusted scanner runs on a separate scheduled host. Keep following
      // the upload through at least one full cycle so the clean file attaches.
      for (let attempt = 0; attempt < 120; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const available = await readArray<Attachable>(`${base}&available=true`);
        const approved = available.find((item) => item.id === uploaded.document_id && item.version_id === uploaded.version_id);
        if (!approved) continue;
        await post(`/api/customer/v1/private-conversations/${conversationId}/attachments`, {
          context_id: contextId, message_id: messageId, document_id: approved.id, version_id: approved.version_id,
        });
        if (selectedId === conversationId) setAttachments(await readArray<Attachment>(base));
        setUploadStatus(t.attached);
        return;
      }
      setUploadStatus(t.pending);
    } catch { setUploadStatus(t.uploadError); } finally { setUploadBusy(false); }
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
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{item.body}</p>
                {attachments.filter((a) => a.message_id === item.id).map((a) => <button key={a.id} type="button" onClick={() => void download(a.id)} className="mt-2 block break-all text-sm text-teal-800 underline">📎 {a.title}</button>)}
                <time className="mt-1 block text-end text-xs text-slate-500" dateTime={item.sent_at}>{formatTime(item.sent_at)}</time>
              </div>
            </li>;
          })}<div ref={bottomRef} /></ol>
          <form className="border-t border-slate-200 bg-white p-4" onSubmit={(event) => { event.preventDefault(); if (contextId && reply.trim()) void submit(`/api/customer/v1/private-conversations/${selected.id}/messages`, { context_id: contextId, body: reply.trim(), request_id: crypto.randomUUID() }); }}>
            <label htmlFor="private-reply" className="sr-only">{t.reply}</label>
            <div className="flex items-end gap-2"><textarea id="private-reply" required rows={2} maxLength={5000} placeholder={t.write} value={reply} onChange={(event) => setReply(event.target.value)} className="min-h-12 flex-1 resize-y rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 outline-none focus:border-teal-600" />
              <button type="submit" disabled={busy || !reply.trim()} className="rounded-xl bg-teal-700 px-5 py-3 text-white hover:bg-teal-800 disabled:opacity-50">{busy ? t.busy : t.send}</button></div>
          </form>
          <div className="border-t border-slate-100 bg-white px-4 pb-4">
            <label htmlFor="private-upload" className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border border-teal-700 px-3 py-2 text-sm font-medium text-teal-800 hover:bg-teal-50 ${uploadBusy || !ownMessageId ? "pointer-events-none opacity-50" : ""}`}>📎 {uploadBusy ? t.uploadBusy : t.upload}</label>
            <input id="private-upload" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.doc,.docx,.xls,.xlsx" disabled={uploadBusy || !ownMessageId} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); event.target.value = ""; }} className="sr-only" />
            {!ownMessageId && <p className="mt-2 text-xs text-slate-600">{t.firstMessage}</p>}
            {uploadStatus && <p role="status" className="mt-2 text-sm text-teal-800">{uploadStatus}</p>}
          </div>
          <details className="border-t border-slate-200 px-4 py-4 sm:px-6"><summary className="cursor-pointer font-medium text-teal-800">📎 {t.files}</summary>
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
          <h2 className="text-lg font-semibold">{t.new}</h2>
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
