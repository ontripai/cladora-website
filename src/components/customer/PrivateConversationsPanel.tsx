"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCustomerContext } from "./CustomerContextProvider";
import type { Language } from "@/types";

type Unit = { id: string; property_name: string; building_name: string; unit_code: string };
type Recipient = { membership_id: string; display_name?: string; name?: string; role_code?: string };
type Message = { id: string; sender_id: string; body: string; sent_at: string };
type Thread = { id: string; unit_id: string; participants: Recipient[]; messages: Message[] };
type Attachment = { id: string; message_id: string; title: string };
type Attachable = { id: string; version_id: string; title: string };
type Unread = { conversation_id: string; unread_count: number };

const words = {
  ro: { title: "Conversații private", back: "Înapoi la comunicări", new: "Conversație nouă", unit: "Unitate", recipient: "Destinatar", body: "Mesaj", send: "Trimite", reply: "Răspunde", empty: "Nu există conversații în acest context.", unavailable: "Conversațiile nu sunt disponibile în acest context.", loading: "Se încarcă…", select: "Selectați", more: "Mai multe unități", history: "Istoric mesaje", busy: "Se trimite…", unread: "necitite", document: "Document din seif", attach: "Atașează la ultimul mesaj trimis", download: "Descarcă documentul", read: "Marchează ca citit", vault: "Adăugați permisiuni pentru ambii participanți în seiful de documente." },
  en: { title: "Private conversations", back: "Back to communications", new: "New conversation", unit: "Unit", recipient: "Recipient", body: "Message", send: "Send", reply: "Reply", empty: "No conversations in this context.", unavailable: "Conversations are unavailable in this context.", loading: "Loading…", select: "Select", more: "More units", history: "Message history", busy: "Sending…", unread: "unread", document: "Vault document", attach: "Attach to your last message", download: "Download document", read: "Mark as read", vault: "Grant both participants access to the document in the vault first." },
  fa: { title: "گفت‌وگوهای خصوصی", back: "بازگشت به ارتباطات", new: "گفت‌وگوی جدید", unit: "واحد", recipient: "گیرنده", body: "پیام", send: "ارسال", reply: "پاسخ", empty: "در این فضای کاری گفت‌وگویی وجود ندارد.", unavailable: "گفت‌وگوها در این فضای کاری در دسترس نیستند.", loading: "در حال بارگذاری…", select: "انتخاب کنید", more: "واحدهای بیشتر", history: "سابقهٔ پیام‌ها", busy: "در حال ارسال…", unread: "خوانده‌نشده", document: "سند از خزانه", attach: "پیوست به آخرین پیام ارسالی", download: "دریافت سند", read: "علامت‌گذاری به‌عنوان خوانده‌شده", vault: "ابتدا دسترسی هر دو طرف را در خزانهٔ اسناد ثبت کنید." },
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
  return <PrivateConversationsContent key={active?.context_id ?? "no-context"} lang={lang} contextId={active?.context_id} />;
}

function PrivateConversationsContent({ lang, contextId }: { lang: Language; contextId?: string }) {
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
  const [lastSent, setLastSent] = useState<{ conversation: string; message: string } | null>(null);

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

  async function markRead() {
    if (!contextId || !selectedId) return;
    try {
      await post(`/api/customer/v1/private-conversations/${selectedId}/read`, { context_id: contextId });
      setUnread((current) => current.map((row) => row.conversation_id === selectedId ? { ...row, unread_count: 0 } : row));
    } catch { setError(true); }
  }

  async function attach() {
    const document = attachable.find((item) => item.id === documentId);
    if (!contextId || !selectedId || !lastSent || lastSent.conversation !== selectedId || !document) return;
    setBusy(true);
    try {
      await post(`/api/customer/v1/private-conversations/${selectedId}/attachments`, { context_id: contextId, message_id: lastSent.message, document_id: document.id, version_id: document.version_id });
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

  async function submit(url: string, body: Record<string, string>) {
    setBusy(true); setError(false);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(String(response.status));
      const result = await response.json() as { conversation_id?: string; message_id?: string };
      await reload();
      if (result.conversation_id) setSelectedId(result.conversation_id);
      if (result.message_id) setLastSent({ conversation: result.conversation_id ?? selectedId, message: result.message_id });
      setMessage(""); setReply("");
    } catch { setError(true); } finally { setBusy(false); }
  }

  const selected = threads.find((item) => item.id === selectedId);
  return <section dir={lang === "fa" ? "rtl" : "ltr"} className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
    <Link href={`/${lang}/app/communications`} className="text-sm text-blue-700 underline">{t.back}</Link>
    <h1 className="text-2xl font-semibold">{t.title}</h1>
    {loading && <p role="status">{t.loading}</p>}
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-800">{t.unavailable}</p>}
    {!loading && !!contextId && <div className="grid gap-6 lg:grid-cols-3">
      <aside className="space-y-3 lg:col-span-1">
        <h2 className="text-lg font-medium">{t.history}</h2>
        {threads.length === 0 && <p className="text-sm text-slate-600">{t.empty}</p>}
        {threads.map((thread) => <button key={thread.id} type="button" onClick={() => setSelectedId(thread.id)}
          aria-pressed={selectedId === thread.id}
          className={`block w-full rounded-lg border p-3 text-start ${selectedId === thread.id ? "border-blue-700 bg-blue-50" : "border-slate-300"}`}>
          <span className="font-medium">{thread.participants?.map((p) => p.display_name ?? p.name).join(", ")}</span>
          <span className="block text-xs text-slate-600">{thread.messages?.at(-1)?.body}</span>
          {!!unread.find((row) => row.conversation_id === thread.id)?.unread_count && <span className="rounded-full bg-blue-700 px-2 py-0.5 text-xs text-white">{unread.find((row) => row.conversation_id === thread.id)?.unread_count} {t.unread}</span>}
        </button>)}
      </aside>
      <div className="space-y-5 lg:col-span-2">
        {selected && <section className="rounded-xl border border-slate-300 p-4">
          <h2 className="mb-4 font-semibold">{selected.participants?.map((p) => p.display_name ?? p.name).join(", ")}</h2>
          {!!unread.find((row) => row.conversation_id === selected.id)?.unread_count && <button type="button" onClick={() => void markRead()} className="mb-3 rounded border border-blue-700 px-3 py-1 text-blue-700">{t.read}</button>}
          <ol className="space-y-3">{selected.messages?.map((item) => <li key={item.id} className="rounded-lg bg-slate-50 p-3">
            <p className="whitespace-pre-wrap break-words">{item.body}</p>
            <time className="text-xs text-slate-600" dateTime={item.sent_at}>{new Date(item.sent_at).toLocaleString(lang === "fa" ? "fa-IR" : lang === "ro" ? "ro-RO" : "en-GB")}</time>
            {attachments.filter((a) => a.message_id === item.id).map((a) => <button key={a.id} type="button" onClick={() => void download(a.id)} className="block text-sm text-blue-700 underline">{t.download}: {a.title}</button>)}
          </li>)}</ol>
          <div className="mt-4 space-y-2">
            <label htmlFor="private-document" className="block">{t.document}</label>
            <select id="private-document" value={documentId} onChange={(event) => setDocumentId(event.target.value)} className="w-full rounded-lg border border-slate-400 p-2"><option value="">{t.select}</option>{attachable.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select>
            {!attachable.length && <p className="text-xs text-slate-600">{t.vault}</p>}
            <button type="button" disabled={!documentId || busy || lastSent?.conversation !== selectedId} onClick={() => void attach()} className="rounded-lg border border-blue-700 px-3 py-2 text-blue-700 disabled:opacity-50">{t.attach}</button>
          </div>
          <form className="mt-5 space-y-2" onSubmit={(event) => { event.preventDefault(); if (contextId && reply.trim()) void submit(`/api/customer/v1/private-conversations/${selected.id}/messages`, { context_id: contextId, body: reply.trim(), request_id: crypto.randomUUID() }); }}>
            <label className="block" htmlFor="private-reply">{t.reply}</label>
            <textarea id="private-reply" required maxLength={5000} value={reply} onChange={(event) => setReply(event.target.value)} className="w-full rounded-lg border border-slate-400 p-2" />
            <button type="submit" disabled={busy || !reply.trim()} className="rounded-lg bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{busy ? t.busy : t.reply}</button>
          </form>
        </section>}
        <section className="space-y-3 rounded-xl border border-slate-300 p-4">
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
        </section>
      </div>
    </div>}
  </section>;
}
