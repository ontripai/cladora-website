"use client";

import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, ChevronLeft, ChevronRight, DoorOpen, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import type { Language } from "@/types";
import { useCustomerContext } from "./CustomerContextProvider";
import { PropertyManagerInvitationsPanel } from "./PropertyManagerInvitationsPanel";

export type SecurityView = "access_points" | "credentials" | "visitors" | "access_logs" | "credential_history" | "visitor_history" | "links";
type Row = Record<string, unknown> & { id?: string };
type Payload = { rows: Row[]; total: number; summary?: Record<string, number>; read_only: boolean; credential_data_masked: boolean; physical_control: boolean };

const copy = {
  en: { eyebrow: "CLADORA · Security access", title: "Security access registry", sub: "Authorized access points, masked credentials, visitor passes and immutable access history.", search: "Search authorized access records", status: "Status or decision", allStatuses: "All statuses", kind: "Access or credential type", allTypes: "All types", from: "From date", to: "To date", refresh: "Refresh", loading: "Loading authorized security records…", empty: "No security access records are visible in this context.", error: "The security access registry could not be loaded.", readonly: "Read-only · credentials masked · no door control", details: "Details", close: "Close", access_points: "Access points", credentials: "Credentials", visitors: "Visitors", access_logs: "Access logs", credential_history: "Credential lifecycle", visitor_history: "Visitor history", links: "Related records", points: "Access points", active_credentials: "Active credentials", valid_visitors: "Valid visitor passes", recent_denied: "Denied · 24h", previous: "Previous", next: "Next", page: "Visible records", yes: "Yes", no: "No", unknown: "Not specified" },
  ro: { eyebrow: "CLADORA · Acces de securitate", title: "Registru de acces de securitate", sub: "Puncte de acces autorizate, credențiale mascate, permise pentru vizitatori și istoric imuabil.", search: "Caută înregistrări de acces autorizate", status: "Stare sau decizie", allStatuses: "Toate stările", kind: "Tip de acces sau credențială", allTypes: "Toate tipurile", from: "Data de început", to: "Data de sfârșit", refresh: "Reîncarcă", loading: "Se încarcă înregistrările autorizate…", empty: "Nu există înregistrări de acces vizibile în acest context.", error: "Registrul de acces nu a putut fi încărcat.", readonly: "Doar citire · credențiale mascate · fără controlul ușilor", details: "Detalii", close: "Închide", access_points: "Puncte de acces", credentials: "Credențiale", visitors: "Vizitatori", access_logs: "Jurnale de acces", credential_history: "Ciclul credențialelor", visitor_history: "Istoricul vizitatorilor", links: "Înregistrări asociate", points: "Puncte de acces", active_credentials: "Credențiale active", valid_visitors: "Permise valabile", recent_denied: "Respins · 24h", previous: "Anterior", next: "Următor", page: "Înregistrări vizibile", yes: "Da", no: "Nu", unknown: "Nespecificat" },
  fa: { eyebrow: "کلادورا · دسترسی امنیتی", title: "دفتر دسترسی امنیتی", sub: "نقاط دسترسی مجاز، شناسه‌های پوشانده‌شده، مجوزهای بازدید و تاریخچه تغییرناپذیر ورود.", search: "جستجو در سوابق مجاز دسترسی", status: "وضعیت یا نتیجه", allStatuses: "همه وضعیت‌ها", kind: "نوع دسترسی یا شناسه", allTypes: "همه انواع", from: "از تاریخ", to: "تا تاریخ", refresh: "بازخوانی", loading: "در حال دریافت سوابق امنیتی مجاز…", empty: "در این زمینه رکورد دسترسی قابل مشاهده‌ای نیست.", error: "دریافت دفتر دسترسی امنیتی ناموفق بود.", readonly: "فقط خواندنی · شناسه‌ها پوشانده‌شده · بدون کنترل درها", details: "جزئیات", close: "بستن", access_points: "نقاط دسترسی", credentials: "شناسه‌ها و کلیدها", visitors: "بازدیدکنندگان", access_logs: "گزارش‌های ورود", credential_history: "چرخه عمر شناسه", visitor_history: "تاریخچه بازدید", links: "سوابق مرتبط", points: "نقاط دسترسی", active_credentials: "شناسه‌های فعال", valid_visitors: "مجوزهای معتبر", recent_denied: "ردشده · ۲۴ ساعت", previous: "قبلی", next: "بعدی", page: "رکوردهای قابل مشاهده", yes: "بله", no: "خیر", unknown: "مشخص نشده" },
} as const;

const views: SecurityView[] = ["access_points", "credentials", "visitors", "access_logs", "credential_history", "visitor_history", "links"];
const kindValues = ["entrance", "door", "gate", "key", "fob", "access_card", "visitor", "contractor", "delivery", "vehicle"] as const;
const hidden = new Set(["id", "party_id", "unit_id", "credential_id", "visitor_pass_id", "identifier_hash"]);
const dateKeys = new Set(["valid_from", "valid_until", "last_used_at", "returned_at", "used_at", "occurred_at"]);
const locales: Record<Language, string> = { en: "en-GB", ro: "ro-RO", fa: "fa-IR" };

const labels: Record<Language, Record<string, string>> = {
  en: { point_type: "Point type", code: "Code", name: "Name", status: "Status", property_name: "Property", building_name: "Building", entrance_name: "Entrance", unit_code: "Unit", kind: "Credential type", masked_identifier: "Masked identifier", effective_status: "Effective status", assigned_party: "Assigned party", valid_from: "Valid from", valid_until: "Valid until", last_used_at: "Last used", returned_at: "Returned at", access_period_eligible: "Within access period", context_eligible: "Context eligible", access_type: "Access type", visitor_label: "Masked visitor", vehicle_masked: "Masked vehicle", access_point: "Access point", used_at: "Used at", work_order_linked: "Work order linked", document_linked: "Document linked", decision: "Decision", reason_code: "Reason code", occurred_at: "Occurred at", credential_or_pass: "Credential or pass", access_eligible: "Access eligible", status_from: "Previous status", status_to: "New status", visitor_pass: "Visitor pass", credential_count: "Credentials", visitor_pass_count: "Visitor passes", access_event_count: "Access events", work_order_count: "Work orders", document_count: "Documents", audit_event_count: "Audit events" },
  ro: { point_type: "Tip punct", code: "Cod", name: "Denumire", status: "Stare", property_name: "Proprietate", building_name: "Clădire", entrance_name: "Intrare", unit_code: "Unitate", kind: "Tip credențială", masked_identifier: "Identificator mascat", effective_status: "Stare efectivă", assigned_party: "Persoană alocată", valid_from: "Valabil de la", valid_until: "Valabil până la", last_used_at: "Ultima utilizare", returned_at: "Returnat la", access_period_eligible: "În perioada de acces", context_eligible: "Context eligibil", access_type: "Tip acces", visitor_label: "Vizitator mascat", vehicle_masked: "Vehicul mascat", access_point: "Punct de acces", used_at: "Utilizat la", work_order_linked: "Ordin de lucru asociat", document_linked: "Document asociat", decision: "Decizie", reason_code: "Cod motiv", occurred_at: "Momentul evenimentului", credential_or_pass: "Credențială sau permis", access_eligible: "Acces eligibil", status_from: "Stare anterioară", status_to: "Stare nouă", visitor_pass: "Permis vizitator", credential_count: "Credențiale", visitor_pass_count: "Permise vizitator", access_event_count: "Evenimente de acces", work_order_count: "Ordine de lucru", document_count: "Documente", audit_event_count: "Evenimente de audit" },
  fa: { point_type: "نوع نقطه", code: "کد", name: "نام", status: "وضعیت", property_name: "ملک", building_name: "ساختمان", entrance_name: "ورودی", unit_code: "واحد", kind: "نوع شناسه", masked_identifier: "شناسه پوشانده‌شده", effective_status: "وضعیت مؤثر", assigned_party: "شخص دریافت‌کننده", valid_from: "معتبر از", valid_until: "معتبر تا", last_used_at: "آخرین استفاده", returned_at: "زمان بازگشت", access_period_eligible: "در محدوده زمانی مجاز", context_eligible: "زمینه مجاز", access_type: "نوع دسترسی", visitor_label: "بازدیدکننده پوشانده‌شده", vehicle_masked: "خودروی پوشانده‌شده", access_point: "نقطه دسترسی", used_at: "زمان استفاده", work_order_linked: "مرتبط با دستور کار", document_linked: "مرتبط با سند", decision: "نتیجه", reason_code: "کد دلیل", occurred_at: "زمان رخداد", credential_or_pass: "شناسه یا مجوز", access_eligible: "دسترسی مجاز", status_from: "وضعیت قبلی", status_to: "وضعیت جدید", visitor_pass: "مجوز بازدید", credential_count: "تعداد شناسه‌ها", visitor_pass_count: "تعداد مجوزهای بازدید", access_event_count: "تعداد رخدادهای ورود", work_order_count: "تعداد دستورهای کار", document_count: "تعداد اسناد", audit_event_count: "تعداد رخدادهای ممیزی" },
};

const values: Record<Language, Record<string, string>> = {
  en: { entrance: "Entrance", door: "Door", gate: "Gate", key: "Key", fob: "Fob", access_card: "Access card", visitor: "Visitor", contractor: "Contractor", delivery: "Delivery", vehicle: "Vehicle", active: "Active", suspended: "Suspended", expired: "Expired", revoked: "Revoked", lost: "Lost", returned: "Returned", scheduled: "Scheduled", used: "Used", cancelled: "Cancelled", denied: "Denied", allowed: "Allowed", inactive: "Inactive", archived: "Archived" },
  ro: { entrance: "Intrare", door: "Ușă", gate: "Poartă", key: "Cheie", fob: "Breloc electronic", access_card: "Card de acces", visitor: "Vizitator", contractor: "Contractant", delivery: "Livrare", vehicle: "Vehicul", active: "Activ", suspended: "Suspendat", expired: "Expirat", revoked: "Revocat", lost: "Pierdut", returned: "Returnat", scheduled: "Programat", used: "Utilizat", cancelled: "Anulat", denied: "Respins", allowed: "Permis", inactive: "Inactiv", archived: "Arhivat" },
  fa: { entrance: "ورودی", door: "در", gate: "دروازه", key: "کلید", fob: "تگ الکترونیکی", access_card: "کارت دسترسی", visitor: "بازدیدکننده", contractor: "پیمانکار", delivery: "تحویل کالا", vehicle: "خودرو", active: "فعال", suspended: "تعلیق‌شده", expired: "منقضی", revoked: "لغوشده", lost: "مفقود", returned: "بازگردانده‌شده", scheduled: "زمان‌بندی‌شده", used: "استفاده‌شده", cancelled: "لغوشده", denied: "ردشده", allowed: "مجاز", inactive: "غیرفعال", archived: "بایگانی‌شده" },
};

function statusValues(view: SecurityView) {
  if (view === "credentials" || view === "credential_history") return ["active", "suspended", "expired", "revoked", "lost", "returned"];
  if (view === "visitors" || view === "visitor_history") return ["scheduled", "active", "used", "expired", "cancelled", "denied"];
  if (view === "access_logs") return ["allowed", "denied"];
  return ["active", "inactive", "archived"];
}

function displayValue(lang: Language, key: string, value: unknown) {
  const t = copy[lang];
  if (value === null || value === undefined || value === "") return t.unknown;
  if (typeof value === "boolean") return value ? t.yes : t.no;
  if (typeof value === "number") return new Intl.NumberFormat(locales[lang]).format(value);
  if (dateKeys.has(key) && typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(locales[lang], { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(date);
  }
  if (typeof value === "string") {
    if (values[lang][value]) return values[lang][value];
    if (value.startsWith("Visitor pass · ")) return `${labels[lang].visitor_pass} · ${value.slice(15)}`;
    if (value.startsWith("Party · ")) return `${labels[lang].assigned_party} · ${value.slice(8)}`;
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function CustomerSecurityAccessDashboard({ lang, initialView = "access_points" }: { lang: Language; initialView?: SecurityView }) {
  const { active } = useCustomerContext();
  const t = copy[lang];
  const [view, setView] = useState<SecurityView>(initialView);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!active) { setLoading(false); setData(null); return; }
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ context_id: active.context_id, view, limit: "20", offset: String(offset) });
      if (query) params.set("query", query);
      if (status) params.set("status", status);
      if (kind) params.set("kind", kind);
      if (from) params.set("from", `${from}T00:00:00Z`);
      if (to) params.set("to", `${to}T23:59:59Z`);
      const response = await fetch(`/api/customer/v1/security-access?${params}`, { cache: "no-store", credentials: "same-origin" });
      if (!response.ok) throw new Error();
      setData((await response.json()) as Payload);
    } catch { setError(t.error); } finally { setLoading(false); }
  }, [active, view, offset, query, status, kind, from, to, t.error]);

  useEffect(() => { const timer = setTimeout(() => void load(), 150); return () => clearTimeout(timer); }, [load]);
  const summary = data?.summary ?? {};
  const pageStart = data?.total ? offset + 1 : 0;
  const number = (value: number) => new Intl.NumberFormat(locales[lang]).format(value);

  return <div className="space-y-5" dir={lang === "fa" ? "rtl" : "ltr"}>
    <PropertyManagerInvitationsPanel key={active?.context_id ?? "no-context"} lang={lang} />
    <header className="card-proptech border border-[#D3DCE6] bg-white p-6"><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0E9F8E]"><ShieldCheck className="h-4 w-4" />{t.eyebrow}</div><h1 className="mt-1 text-2xl font-extrabold text-[#102A43]">{t.title}</h1><p className="mt-1 max-w-3xl text-xs text-[#52667A]">{t.sub}</p></div><span className="rounded-full border border-[#B2E5DF] bg-[#EAF8F5] px-3 py-1 text-[11px] font-bold text-[#0A6E62]">{t.readonly}</span></div></header>
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[[t.points, summary.access_points ?? 0], [t.active_credentials, summary.active_credentials ?? 0], [t.valid_visitors, summary.valid_visitors ?? 0], [t.recent_denied, summary.recent_denied ?? 0]].map(([label, value]) => <div key={String(label)} className="card-proptech bg-white p-4"><div className="text-[11px] text-[#52667A]">{label}</div><div className="mt-1 text-xl font-extrabold">{number(Number(value))}</div></div>)}</section>
    <section className="card-proptech overflow-hidden bg-white">
      <div className="flex gap-1 overflow-x-auto border-b p-2">{views.map((item) => <button type="button" key={item} onClick={() => { setView(item); setOffset(0); setSelected(null); setKind(""); setStatus(""); }} className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${view === item ? "bg-[#0E9F8E] text-white" : "text-[#52667A] hover:bg-[#F6F9FC]"}`}>{t[item]}</button>)}</div>
      <div className="grid gap-2 border-b p-3 md:grid-cols-6">
        <label className="relative md:col-span-2"><span className="sr-only">{t.search}</span><Search className="absolute start-3 top-2.5 h-4 w-4 text-[#7B8A9A]" /><input value={query} onChange={(event) => { setQuery(event.target.value); setOffset(0); }} placeholder={t.search} className="w-full rounded-lg border py-2 pe-3 ps-9 text-xs" /></label>
        <select aria-label={t.status} value={status} onChange={(event) => { setStatus(event.target.value); setOffset(0); }} className="rounded-lg border px-3 py-2 text-xs"><option value="">{t.allStatuses}</option>{statusValues(view).map((item) => <option value={item} key={item}>{values[lang][item]}</option>)}</select>
        <select aria-label={t.kind} value={kind} onChange={(event) => { setKind(event.target.value); setOffset(0); }} className="rounded-lg border px-3 py-2 text-xs"><option value="">{t.allTypes}</option>{kindValues.map((item) => <option value={item} key={item}>{values[lang][item]}</option>)}</select>
        <input aria-label={t.from} type="date" value={from} onChange={(event) => { setFrom(event.target.value); setOffset(0); }} className="rounded-lg border px-2 py-2 text-xs" />
        <div className="flex gap-2"><input aria-label={t.to} type="date" value={to} onChange={(event) => { setTo(event.target.value); setOffset(0); }} className="min-w-0 flex-1 rounded-lg border px-2 py-2 text-xs" /><button type="button" onClick={() => void load()} aria-label={t.refresh} className="rounded-lg border p-2"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></div>
      </div>
      {loading ? <div className="p-10 text-center text-xs text-[#52667A]">{t.loading}</div> : error ? <div role="alert" className="p-10 text-center text-xs font-bold text-red-700">{error}</div> : !data?.rows.length ? <div className="p-10 text-center text-xs text-[#52667A]"><DoorOpen className="mx-auto mb-2 h-7 w-7" />{t.empty}</div> : <div className="divide-y">{data.rows.map((row, index) => { const entries = Object.entries(row).filter(([key]) => !hidden.has(key)).slice(0, 7); const title = row.name ?? row.masked_identifier ?? row.visitor_label ?? row.access_point ?? row.visitor_pass ?? `#${index + 1}`; return <article key={row.id ?? `${view}-${index}`} className="flex items-center gap-3 p-4"><div className="rounded-xl bg-[#EAF8F5] p-2 text-[#0E9F8E]"><BadgeCheck className="h-5 w-5" /></div><div className="min-w-0 flex-1"><div className="truncate text-xs font-bold">{displayValue(lang, entries[0]?.[0] ?? "name", title)}</div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#64748B]">{entries.slice(1).map(([key, value]) => <span key={key}><b>{labels[lang][key] ?? key}:</b> {displayValue(lang, key, value)}</span>)}</div></div><button type="button" onClick={() => setSelected(row)} className="rounded-lg border px-3 py-2 text-[11px] font-bold">{t.details}</button></article>; })}</div>}
      <div className="flex items-center justify-between border-t p-3 text-xs"><button type="button" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 20))} className="flex items-center gap-1 rounded-lg border px-3 py-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" />{t.previous}</button><span aria-label={t.page}>{number(pageStart)}–{number(Math.min(offset + 20, data?.total ?? 0))} / {number(data?.total ?? 0)}</span><button type="button" disabled={offset + 20 >= (data?.total ?? 0)} onClick={() => setOffset(offset + 20)} className="flex items-center gap-1 rounded-lg border px-3 py-2 disabled:opacity-40">{t.next}<ChevronRight className="h-4 w-4" /></button></div>
    </section>
    {selected ? <div className="fixed inset-0 z-50 flex items-end justify-end bg-[#102A43]/35 p-4" role="dialog" aria-modal="true" aria-label={t.details}><div className="max-h-[85vh] w-full max-w-xl overflow-auto rounded-2xl bg-white p-5 shadow-xl"><div className="flex items-center justify-between"><h2 className="font-bold">{t.details}</h2><button type="button" onClick={() => setSelected(null)} aria-label={t.close}><X className="h-5 w-5" /></button></div><dl className="mt-4 grid gap-3 sm:grid-cols-2">{Object.entries(selected).filter(([key]) => !hidden.has(key)).map(([key, value]) => <div key={key} className="rounded-xl bg-[#F6F9FC] p-3"><dt className="text-[10px] font-bold uppercase text-[#64748B]">{labels[lang][key] ?? key}</dt><dd className="mt-1 break-words text-xs">{displayValue(lang, key, value)}</dd></div>)}</dl></div></div> : null}
  </div>;
}
