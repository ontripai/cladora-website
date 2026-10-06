"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Language } from "@/types";
import { useCustomerContext } from "./CustomerContextProvider";

type Subject = { id: string; code: string; building: string };
type Party = { id: string; name: string };
type Proposal = { id: string; unit_id: string; kind: string; source_party_id: string | null;
  target_party_id: string; effective_from: string; proposed_at: string; proposed_by: string;
  decision: string | null; review_id: string | null };
const copy = {
  fa: { title: "پیشنهاد و بررسی رابطهٔ واحد", note: "این مرحله فقط پروندهٔ بررسی می‌سازد؛ مالکیت، اجاره و دسترسی اشخاص تغییر نمی‌کند.",
    unavailable: "برای این ملک، مأموریت و ماژول هویت واحد و نقش مربوط باید فعال باشد.", property: "یک زمینهٔ ملک را انتخاب کنید.",
    unit: "واحد", kind: "نوع رابطه", source: "شخص فعلی", target: "شخص پیشنهادی", date: "تاریخ مؤثر پیشنهادی",
    end: "تاریخ پایان (اختیاری)", evidence: "ارجاع مدرک", reason: "دلیل", send: "ثبت برای بررسی", proposals: "پیشنهادها",
    approve: "تأیید بررسی مدرک", reject: "رد پیشنهاد", pending: "در انتظار بازبین مستقل", done: "ثبت شد. عنوان و حق دسترسی تغییر نکرد.",
    error: "عملیات انجام نشد؛ نقش، مأموریت ملک و اطلاعات را بررسی کنید.", empty: "پیشنهادی ثبت نشده است.",
    buyer: "خریدار قراردادی", transfer: "انتقال مالکیت", lease: "اجاره", select: "انتخاب کنید", self: "بازبین باید شخص دیگری باشد." },
  en: { title: "Unit relationship proposal and review", note: "This records review evidence only. It does not change title, lease or access.",
    unavailable: "The property mandate, unit identity module and role are required.", property: "Select a property context.",
    unit: "Unit", kind: "Relationship", source: "Current party", target: "Proposed party", date: "Proposed effective date",
    end: "End date (optional)", evidence: "Evidence reference", reason: "Reason", send: "Submit for review", proposals: "Proposals",
    approve: "Verify evidence", reject: "Reject", pending: "Awaiting independent review", done: "Recorded. Title and access did not change.",
    error: "Operation failed. Check the role, property mandate and details.", empty: "No proposals yet.",
    buyer: "Contractual buyer", transfer: "Ownership transfer", lease: "Lease", select: "Select", self: "A different person must review." },
  ro: { title: "Propunere și verificare relație unitate", note: "Se înregistrează doar verificarea. Titlul, închirierea și accesul nu se modifică.",
    unavailable: "Sunt necesare mandatul proprietății, modulul și rolul corespunzător.", property: "Selectați un context de proprietate.",
    unit: "Unitate", kind: "Relație", source: "Persoana actuală", target: "Persoana propusă", date: "Data propusă",
    end: "Data de sfârșit (opțional)", evidence: "Referința documentului", reason: "Motiv", send: "Trimite spre verificare", proposals: "Propuneri",
    approve: "Verifică documentul", reject: "Respinge", pending: "În așteptarea unui verificator independent", done: "Înregistrat. Titlul și accesul nu s-au schimbat.",
    error: "Operațiunea a eșuat. Verificați rolul, mandatul și datele.", empty: "Nu există propuneri.",
    buyer: "Cumpărător contractual", transfer: "Transfer proprietate", lease: "Închiriere", select: "Selectați", self: "Verificatorul trebuie să fie altă persoană." },
} as const;

export function RelationshipReviewPanel({ lang }: { lang: Language }) {
  const t = copy[lang];
  const { active, dashboard } = useCustomerContext();
  const contextId = active?.context_id;
  const workspaceId = dashboard?.workspace_id;
  const propertyId = dashboard?.context.property_id;
  const [units, setUnits] = useState<Subject[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loadedScope, setLoadedScope] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState("contractual_buyer");
  const pending = useRef<{ body: string; request_id: string; idempotency_key: string } | null>(null);
  const base = contextId && workspaceId && propertyId
    ? new URLSearchParams({ context_id: contextId, workspace_id: workspaceId, property_id: propertyId }) : null;
  const scope = `${contextId ?? ""}/${workspaceId ?? ""}/${propertyId ?? ""}`;
  const ready = loadedScope === scope;

  const reload = useCallback(async (signal?: AbortSignal) => {
    if (!base) return;
    try {
      const [subjects, ledger] = await Promise.all([
        fetch(`/api/customer/v1/core/relationships?${base}&view=subjects`, { cache: "no-store", signal }),
        fetch(`/api/customer/v1/core/relationships?${base}&view=proposals`, { cache: "no-store", signal }),
      ]);
      if (!subjects.ok || !ledger.ok) throw new Error();
      const choices = await subjects.json() as { units: Subject[]; parties: Party[] };
      const rows = await ledger.json() as { proposals: Proposal[] };
      if (!signal?.aborted) { setUnits(choices.units); setParties(choices.parties); setProposals(rows.proposals); setLoadedScope(scope); setMessage(""); }
    } catch { if (!signal?.aborted) { setLoadedScope(""); setMessage(t.unavailable); } }
  // The scalar identifiers, rather than a mutable URLSearchParams object, control reload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextId, workspaceId, propertyId, t.unavailable]);
  // reload updates state only after its network requests have settled.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const abort = new AbortController(); void reload(abort.signal); return () => abort.abort(); }, [reload]);

  async function post(payload: Record<string, unknown>) {
    const body = JSON.stringify(payload);
    if (pending.current?.body !== body) pending.current = { body, request_id: crypto.randomUUID(), idempotency_key: crypto.randomUUID() };
    const request = pending.current;
    const response = await fetch("/api/customer/v1/core/relationships", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, request_id: request.request_id, idempotency_key: request.idempotency_key }),
    });
    if (!response.ok) throw new Error();
    pending.current = null;
    await reload();
    setMessage(t.done);
  }
  async function propose(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!contextId || !workspaceId || !propertyId) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true); setMessage("");
    try {
      await post({ action: "propose", context_id: contextId, workspace_id: workspaceId, property_id: propertyId,
        unit_id: fields.get("unit"), kind, source_party_id: kind === "contractual_buyer" ? null : fields.get("source"),
        target_party_id: fields.get("target"), effective_from: fields.get("date"),
        effective_to: fields.get("end") || null, evidence_reference: fields.get("evidence"), reason: fields.get("reason") });
      form.reset(); setKind("contractual_buyer");
    } catch { setMessage(t.error); } finally { setBusy(false); }
  }
  async function review(form: HTMLFormElement, proposal: Proposal, decision: "verified" | "rejected") {
    if (!contextId || !workspaceId) return;
    const fields = new FormData(form);
    setBusy(true); setMessage("");
    try { await post({ action: "review", context_id: contextId, workspace_id: workspaceId,
      proposal_id: proposal.id, decision, evidence_reference: fields.get("evidence"), reason: fields.get("reason") }); }
    catch { setMessage(t.error); } finally { setBusy(false); }
  }
  const label = (id: string | null) => parties.find(p => p.id === id)?.name ?? (id ? id.slice(0, 8) : "—");
  return <section className="card-proptech space-y-5 bg-white p-5" dir={lang === "fa" ? "rtl" : "ltr"}>
    <div><h2 className="text-xl font-bold">{t.title}</h2><p className="mt-1 text-sm text-slate-600">{t.note}</p></div>
    {!propertyId ? <p role="status">{t.property}</p> : !ready ? <p role="status">{message || t.unavailable}</p> : <>
      <form onSubmit={propose} className="grid gap-3 rounded-xl border p-4 md:grid-cols-2">
        <label>{t.unit}<select name="unit" required className="block w-full rounded border p-2"><option value="">{t.select}</option>{units.map(u => <option key={u.id} value={u.id}>{u.building} · {u.code}</option>)}</select></label>
        <label>{t.kind}<select value={kind} onChange={e => setKind(e.target.value)} className="block w-full rounded border p-2"><option value="contractual_buyer">{t.buyer}</option><option value="ownership_transfer">{t.transfer}</option><option value="lease">{t.lease}</option></select></label>
        {kind !== "contractual_buyer" && <label>{t.source}<select name="source" required className="block w-full rounded border p-2"><option value="">{t.select}</option>{parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
        <label>{t.target}<select name="target" required className="block w-full rounded border p-2"><option value="">{t.select}</option>{parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
        <label>{t.date}<input name="date" type="date" required className="block w-full rounded border p-2" /></label>
        <label>{t.end}<input name="end" type="date" className="block w-full rounded border p-2" /></label>
        <label>{t.evidence}<input name="evidence" minLength={15} maxLength={500} required className="block w-full rounded border p-2" /></label>
        <label>{t.reason}<input name="reason" minLength={8} maxLength={500} required className="block w-full rounded border p-2" /></label>
        <button disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{t.send}</button>
      </form>
      <div><h3 className="font-bold">{t.proposals}</h3>{proposals.length === 0 && <p className="text-sm">{t.empty}</p>}
        <div className="space-y-3">{proposals.map(p => <article key={p.id} className="rounded-xl border p-3 text-sm">
          <p>{units.find(u => u.id === p.unit_id)?.code ?? p.unit_id.slice(0, 8)} · {p.kind} · {label(p.source_party_id)} → {label(p.target_party_id)} · {p.effective_from}</p>
          <p className="mt-1 text-slate-600">{p.decision ?? t.pending}</p>
          {!p.review_id && <form className="mt-3 flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); void review(e.currentTarget, p, "verified"); }}>
            <input name="evidence" aria-label={t.evidence} placeholder={t.evidence} minLength={15} maxLength={500} required className="rounded border p-2" />
            <input name="reason" aria-label={t.reason} placeholder={t.reason} minLength={8} maxLength={500} required className="rounded border p-2" />
            <button disabled={busy} className="rounded bg-teal-700 px-3 py-2 text-white">{t.approve}</button>
            <button disabled={busy} type="button" onClick={e => { const form = e.currentTarget.form; if (form?.reportValidity()) void review(form, p, "rejected"); }} className="rounded border px-3 py-2">{t.reject}</button>
          </form>}
        </article>)}</div>
      </div>
    </>}
    {message && ready && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
