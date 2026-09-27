"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useCustomerContext } from "./CustomerContextProvider";
import type { Language } from "@/types";

type Unit = { id: string; property_name: string; building_name: string; unit_code: string };
type Recipient = { membership_id: string; display_name: string; role_code: string };
type Message = { id: string; sender_id: string; body: string; sent_at: string };
type Thread = { id: string; unit_id: string; participants: Recipient[]; messages: Message[] };

const words = {
  ro: { title: "Conversații private", back: "Înapoi la comunicări", new: "Conversație nouă", unit: "Unitate", recipient: "Destinatar", body: "Mesaj", send: "Trimite", reply: "Răspunde", empty: "Nu există conversații în acest context.", unavailable: "Conversațiile nu sunt disponibile în acest context.", loading: "Se încarcă…", select: "Selectați", more: "Mai multe unități", history: "Istoric mesaje", busy: "Se trimite…" },
  en: { title: "Private conversations", back: "Back to communications", new: "New conversation", unit: "Unit", recipient: "Recipient", body: "Message", send: "Send", reply: "Reply", empty: "No conversations in this context.", unavailable: "Conversations are unavailable in this context.", loading: "Loading…", select: "Select", more: "More units", history: "Message history", busy: "Sending…" },
  fa: { title: "گفت‌وگوهای خصوصی", back: "بازگشت به ارتباطات", new: "گفت‌وگوی جدید", unit: "واحد", recipient: "گیرنده", body: "پیام", send: "ارسال", reply: "پاسخ", empty: "در این فضای کاری گفت‌وگویی وجود ندارد.", unavailable: "گفت‌وگوها در این فضای کاری در دسترس نیستند.", loading: "در حال بارگذاری…", select: "انتخاب کنید", more: "واحدهای بیشتر", history: "سابقهٔ پیام‌ها", busy: "در حال ارسال…" },
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

  const reload = useCallback(async () => {
    if (!contextId) return;
    const q = encodeURIComponent(contextId);
    const [newThreads, newUnits] = await Promise.all([
      readArray<Thread>(`/api/customer/v1/private-conversations?context_id=${q}`),
      readArray<Unit>(`/api/customer/v1/private-conversations/recipients?context_id=${q}`),
    ]);
    setThreads(newThreads);
    setUnits(newUnits);
    setSelectedId((current) => newThreads.some((row) => row.id === current) ? current : newThreads[0]?.id ?? "");
  }, [contextId]);

  useEffect(() => {
    let cancelled = false;
    if (!contextId) return;
    void Promise.all([
      readArray<Thread>(`/api/customer/v1/private-conversations?context_id=${encodeURIComponent(contextId)}`),
      readArray<Unit>(`/api/customer/v1/private-conversations/recipients?context_id=${encodeURIComponent(contextId)}`),
    ]).then(([a, b]) => { if (!cancelled) { setThreads(a); setUnits(b); setHasMore(b.length === 25); setSelectedId(a[0]?.id ?? ""); } })
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

  async function submit(url: string, body: Record<string, string>) {
    setBusy(true); setError(false);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(String(response.status));
      const result = await response.json() as { conversation_id?: string };
      await reload();
      if (result.conversation_id) setSelectedId(result.conversation_id);
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
          <span className="font-medium">{thread.participants?.map((p) => p.display_name).join(", ")}</span>
          <span className="block text-xs text-slate-600">{thread.messages?.at(-1)?.body}</span>
        </button>)}
      </aside>
      <div className="space-y-5 lg:col-span-2">
        {selected && <section className="rounded-xl border border-slate-300 p-4">
          <h2 className="mb-4 font-semibold">{selected.participants?.map((p) => p.display_name).join(", ")}</h2>
          <ol className="space-y-3">{selected.messages?.map((item) => <li key={item.id} className="rounded-lg bg-slate-50 p-3">
            <p className="whitespace-pre-wrap break-words">{item.body}</p>
            <time className="text-xs text-slate-600" dateTime={item.sent_at}>{new Date(item.sent_at).toLocaleString(lang === "fa" ? "fa-IR" : lang === "ro" ? "ro-RO" : "en-GB")}</time>
          </li>)}</ol>
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
