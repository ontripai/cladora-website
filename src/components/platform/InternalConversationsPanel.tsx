"use client";

import { useEffect, useState } from "react";
import type { Language } from "@/types";

type Workspace = { id: string; name: string };
type Colleague = { id: string; name: string };
type Message = { id: string; body: string; sent_at: string; sender_id: string };
type Thread = { id: string; participants: Colleague[]; unread: number; messages: Message[] };
type Attachment = { id: string; message_id: string; title: string };
type Attachable = { id: string; version_id: string; title: string };

const labels = {
  ro: { title: "Mesaje interne CLADORA", workspace: "Spațiu de lucru", colleague: "Colega sau colegul", select: "Selectați", new: "Conversație nouă", send: "Trimite", reply: "Răspunde", unread: "necitite", mark: "Marchează ca citit", empty: "Nu există conversații în acest spațiu.", error: "Nu s-au putut încărca mesajele interne.", busy: "Se trimite…", document: "Document scanat încărcat de dvs. în spațiul clientului", note: "Documentul poate fi vizibil și altor membri autorizați ai spațiului clientului.", attach: "Atașează la ultimul mesaj propriu", download: "Descarcă documentul" },
  en: { title: "CLADORA internal messages", workspace: "Workspace", colleague: "Colleague", select: "Select", new: "New conversation", send: "Send", reply: "Reply", unread: "unread", mark: "Mark as read", empty: "No conversations for this workspace.", error: "Internal messages could not be loaded.", busy: "Sending…", document: "Scanned document you uploaded to the customer workspace", note: "Other authorized customer workspace members may also see this document.", attach: "Attach to my latest message", download: "Download document" },
  fa: { title: "پیام‌های داخلی CLADORA", workspace: "فضای کاری", colleague: "همکار", select: "انتخاب کنید", new: "گفت‌وگوی جدید", send: "ارسال", reply: "پاسخ", unread: "خوانده‌نشده", mark: "علامت‌گذاری به‌عنوان خوانده‌شده", empty: "برای این فضای کاری گفت‌وگویی وجود ندارد.", error: "بارگذاری پیام‌های داخلی ممکن نشد.", busy: "در حال ارسال…", document: "سند اسکن‌شده‌ای که در فضای مشتری بارگذاری کرده‌اید", note: "ممکن است سایر اعضای مجاز فضای مشتری نیز این سند را ببینند.", attach: "پیوست به آخرین پیام خودم", download: "دریافت سند" },
} satisfies Record<Language, Record<string, string>>;

const endpoint = "/api/platform/v1/internal-conversations";
async function read<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(String(response.status));
  const data: unknown = await response.json();
  if (!Array.isArray(data)) throw new Error("Invalid response");
  return data as T[];
}

export function InternalConversationsPanel({ lang }: { lang: Language }) {
  const t = labels[lang];
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState("");
  const [colleagues, setColleagues] = useState<Colleague[]>([]);
  const [recipientId, setRecipientId] = useState("");
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadId, setThreadId] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [myId, setMyId] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachable, setAttachable] = useState<Attachable[]>([]);
  const [documentId, setDocumentId] = useState("");

  useEffect(() => {
    let cancelled = false;
    void read<Workspace>(endpoint).then((data) => {
      if (!cancelled) { setWorkspaces(data); setWorkspaceId(data[0]?.id ?? ""); }
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!workspaceId) return;
    const url = `${endpoint}?workspace_id=${encodeURIComponent(workspaceId)}`;
    void Promise.all([read<Colleague>(`${url}&recipients=true`), read<Thread>(url)]).then(([people, history]) => {
      if (!cancelled) { setColleagues(people); setThreads(history); setThreadId(history[0]?.id ?? ""); setRecipientId(""); }
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [workspaceId]);

  useEffect(() => {
    let cancelled = false;
    if (!threadId) return;
    const path = `${endpoint}/${encodeURIComponent(threadId)}/attachments`;
    void Promise.all([read<Attachment>(path), read<Attachable>(`${path}?available=true`)]).then(([linked, available]) => {
      if (!cancelled) { setAttachments(linked); setAttachable(available); }
    }).catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, [threadId, threads]);

  useEffect(() => {
    let cancelled = false;
    void fetch(`${endpoint}?identity=true`, { cache: "no-store" }).then(async (response) => {
      if (!response.ok) throw new Error(String(response.status));
      return response.json() as Promise<{ id?: string }>;
    }).then((profile) => { if (!cancelled) setMyId(profile.id ?? ""); }).catch(() => { /* An attachment requires a known sender. */ });
    return () => { cancelled = true; };
  }, []);

  async function attach() {
    const selected = threads.find((thread) => thread.id === threadId);
    const messageId = selected?.messages.filter((message) => message.sender_id === myId).at(-1)?.id;
    const document = attachable.find((item) => item.id === documentId);
    if (!messageId || !document) return;
    setBusy(true); setError(false);
    try {
      const path = `${endpoint}/${encodeURIComponent(threadId)}/attachments`;
      const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, document_id: document.id, version_id: document.version_id }) });
      if (!response.ok) throw new Error(String(response.status));
      setAttachments(await read<Attachment>(path)); setDocumentId("");
    } catch { setError(true); } finally { setBusy(false); }
  }

  async function download(id: string) {
    try {
      const response = await fetch(`${endpoint}/attachments/${encodeURIComponent(id)}/download`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
      });
      if (!response.ok) throw new Error(String(response.status));
      const result = await response.json() as { download_url?: string };
      if (!result.download_url) throw new Error("Missing signed URL");
      window.location.assign(result.download_url);
    } catch { setError(true); }
  }

  async function submit(payload: Record<string, string>) {
    setBusy(true); setError(false);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(String(response.status));
      const result = await response.json() as { thread_id?: string };
      if (workspaceId) setThreads(await read<Thread>(`${endpoint}?workspace_id=${encodeURIComponent(workspaceId)}`));
      if (result.thread_id) setThreadId(result.thread_id);
      setBody(""); setReply("");
    } catch { setError(true); } finally { setBusy(false); }
  }

  const selected = threads.find((thread) => thread.id === threadId);
  return <main dir={lang === "fa" ? "rtl" : "ltr"} className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">
    <h1 className="text-2xl font-semibold">{t.title}</h1>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-red-800">{t.error}</p>}
    <label htmlFor="internal-workspace" className="block font-medium">{t.workspace}</label>
    <select id="internal-workspace" value={workspaceId} onChange={(event) => { setWorkspaceId(event.target.value); setThreadId(""); setAttachments([]); setAttachable([]); }} className="w-full rounded border p-2"><option value="">{t.select}</option>{workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
    {!!workspaceId && <div className="grid gap-6 lg:grid-cols-3">
      <aside className="space-y-2">
        {!threads.length && <p className="text-sm text-slate-600">{t.empty}</p>}
        {threads.map((thread) => <button key={thread.id} type="button" onClick={() => { setThreadId(thread.id); setAttachments([]); setAttachable([]); }} aria-pressed={thread.id === threadId} className={`block w-full rounded border p-3 text-start ${thread.id === threadId ? "border-blue-700 bg-blue-50" : "border-slate-300"}`}>
          <span>{thread.participants.map((p) => p.name).join(", ")}</span>
          {!!thread.unread && <span className="ms-2 rounded-full bg-blue-700 px-2 py-0.5 text-xs text-white">{thread.unread} {t.unread}</span>}
          <span className="block text-xs text-slate-600">{thread.messages.at(-1)?.body}</span>
        </button>)}
      </aside>
      <div className="space-y-6 lg:col-span-2">
        {selected && <section className="space-y-4 rounded border p-4">
          <h2 className="font-semibold">{selected.participants.map((p) => p.name).join(", ")}</h2>
          {!!selected.unread && <button type="button" className="text-sm text-blue-700 underline" onClick={() => void submit({ action: "read", thread_id: selected.id })}>{t.mark}</button>}
          <ol className="space-y-2">{selected.messages.map((m) => <li key={m.id} className="rounded bg-slate-50 p-3"><p className="whitespace-pre-wrap break-words">{m.body}</p><time className="text-xs text-slate-600" dateTime={m.sent_at}>{new Date(m.sent_at).toLocaleString(lang === "fa" ? "fa-IR" : lang === "ro" ? "ro-RO" : "en-GB")}</time>{attachments.filter((item) => item.message_id === m.id).map((item) => <button key={item.id} type="button" onClick={() => void download(item.id)} className="block text-sm text-blue-700 underline">{t.download}: {item.title}</button>)}</li>)}</ol>
          {!!attachable.length && <div className="space-y-2"><label htmlFor="internal-document" className="block">{t.document}</label><p className="text-sm text-slate-600">{t.note}</p><select id="internal-document" className="w-full rounded border p-2" value={documentId} onChange={(event) => setDocumentId(event.target.value)}><option value="">{t.select}</option>{attachable.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select><button type="button" onClick={() => void attach()} disabled={busy || !documentId || !myId || !selected.messages.some((item) => item.sender_id === myId)} className="rounded border border-blue-700 px-3 py-2 text-blue-700 disabled:opacity-50">{t.attach}</button></div>}
          <form className="space-y-2" onSubmit={(event) => { event.preventDefault(); if (reply.trim()) void submit({ action: "reply", thread_id: selected.id, body: reply.trim(), request_id: crypto.randomUUID() }); }}>
            <label htmlFor="internal-reply" className="block">{t.reply}</label>
            <textarea id="internal-reply" required maxLength={5000} value={reply} onChange={(event) => setReply(event.target.value)} className="w-full rounded border p-2" />
            <button type="submit" disabled={busy || !reply.trim()} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{busy ? t.busy : t.reply}</button>
          </form>
        </section>}
        <form className="space-y-3 rounded border p-4" onSubmit={(event) => { event.preventDefault(); if (recipientId && body.trim()) void submit({ action: "create", workspace_id: workspaceId, recipient_id: recipientId, body: body.trim(), request_id: crypto.randomUUID() }); }}>
          <h2 className="font-semibold">{t.new}</h2>
          <label htmlFor="internal-recipient" className="block">{t.colleague}</label>
          <select id="internal-recipient" required value={recipientId} onChange={(event) => setRecipientId(event.target.value)} className="w-full rounded border p-2"><option value="">{t.select}</option>{colleagues.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <label htmlFor="internal-message" className="block">{t.new}</label>
          <textarea id="internal-message" required maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} className="w-full rounded border p-2" />
          <button type="submit" disabled={busy || !recipientId || !body.trim()} className="rounded bg-blue-700 px-4 py-2 text-white disabled:opacity-50">{busy ? t.busy : t.send}</button>
        </form>
      </div>
    </div>}
  </main>;
}
