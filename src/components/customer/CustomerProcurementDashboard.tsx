"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSearch,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import type { Language } from "@/types";
import { useCustomerContext } from "./CustomerContextProvider";

export type ProcurementView = "vendors" | "contracts" | "quotes" | "purchase_orders" | "sla";
type Row = Record<string, unknown> & { id?: string };
type Payload = {
  total: number;
  rows: Row[];
  summary: { vendors?: number; active_contracts?: number; open_quotes?: number; purchase_orders?: number };
  read_only: boolean;
  commercial_data_redacted: boolean;
};

const views: ProcurementView[] = ["vendors", "contracts", "quotes", "purchase_orders", "sla"];
const locales: Record<Language, string> = { en: "en-GB", ro: "ro-RO", fa: "fa-IR" };
const dateKeys = new Set([
  "starts_on",
  "ends_on",
  "insurance_valid_until",
  "valid_until",
  "submitted_at",
  "created_at",
  "requested_at",
  "approved_at",
  "ordered_at",
  "received_at",
  "measured_at",
]);
const amountKeys = new Set(["subtotal", "tax_total", "total_amount"]);

const copy = {
  en: {
    eyebrow: "CLADORA · Procurement evidence",
    title: "Vendors, Contracts & Procurement",
    sub: "Authorized commercial records, quote comparison, purchase orders and SLA evidence for the active workspace context.",
    readonly: "Read-only · commercial fields redacted · server verified",
    vendors: "Vendors",
    contracts: "Service contracts",
    quotes: "Quotes",
    purchase_orders: "Purchase orders",
    sla: "SLA evidence",
    activeContracts: "Active contracts",
    openQuotes: "Open quotes",
    openOrders: "Open purchase orders",
    search: "Search authorized procurement records",
    status: "Status",
    allStatuses: "All statuses",
    currency: "Currency",
    allCurrencies: "All currencies",
    from: "From",
    to: "To",
    refresh: "Refresh",
    loading: "Loading authorized procurement evidence…",
    empty: "No procurement records are visible in this context.",
    error: "Procurement data could not be loaded.",
    retry: "Retry",
    details: "Details",
    close: "Close",
    previous: "Previous",
    next: "Next",
    visible: "Visible records",
    yes: "Yes",
    no: "No",
    unknown: "Not recorded",
    requestApproval: "Request Approval",
    awaitingApproval: "Awaiting Approval",
    approve: "Approve",
    issue: "Issue PO",
    markReceived: "Mark Received",
    receivedBadge: "Received",
    actionSuccess: "Action executed successfully.",
    actionError: "Action failed to execute.",
    dualControlNotice: "Dual control: Approver cannot be creator or requester.",
  },
  ro: {
    eyebrow: "CLADORA · Dovezi de achiziții",
    title: "Furnizori, contracte și achiziții",
    sub: "Înregistrări comerciale autorizate, comparația ofertelor, comenzi și dovezi SLA pentru contextul activ.",
    readonly: "Doar citire · câmpuri comerciale redactate · verificat de server",
    vendors: "Furnizori",
    contracts: "Contracte de servicii",
    quotes: "Oferte",
    purchase_orders: "Comenzi de achiziție",
    sla: "Dovezi SLA",
    activeContracts: "Contracte active",
    openQuotes: "Oferte deschise",
    openOrders: "Comenzi deschise",
    search: "Caută înregistrări autorizate de achiziții",
    status: "Stare",
    allStatuses: "Toate stările",
    currency: "Monedă",
    allCurrencies: "Toate monedele",
    from: "De la",
    to: "Până la",
    refresh: "Reîncarcă",
    loading: "Se încarcă dovezile autorizate de achiziții…",
    empty: "Nu există înregistrări de achiziții vizibile în acest context.",
    error: "Datele de achiziții nu au putut fi încărcate.",
    retry: "Reîncearcă",
    details: "Detalii",
    close: "Închide",
    previous: "Anterior",
    next: "Următor",
    visible: "Înregistrări vizibile",
    yes: "Da",
    no: "Nu",
    unknown: "Neînregistrat",
    requestApproval: "Solicită aprobare",
    awaitingApproval: "În așteptarea aprobării",
    approve: "Aprobă",
    issue: "Emite comanda",
    markReceived: "Marchează recepționat",
    receivedBadge: "Recepționat",
    actionSuccess: "Acțiune executată cu succes.",
    actionError: "Executarea acțiunii a eșuat.",
    dualControlNotice: "Control dublu: Aprobatorul nu poate fi creatorul sau solicitantul.",
  },
  fa: {
    eyebrow: "کلادورا · شواهد تدارکات",
    title: "فروشندگان، قراردادها و تدارکات",
    sub: "سوابق تجاری مجاز، مقایسه پیشنهادها، سفارش‌های خرید و شواهد SLA برای زمینه فعال محیط کاری.",
    readonly: "فقط خواندنی · داده‌های تجاری پالایش‌شده · تأییدشده توسط سرور",
    vendors: "فروشندگان",
    contracts: "قراردادهای خدمات",
    quotes: "پیشنهادهای قیمت",
    purchase_orders: "سفارش‌های خرید",
    sla: "شواهد SLA",
    activeContracts: "قراردادهای فعال",
    openQuotes: "پیشنهادهای باز",
    openOrders: "سفارش‌های باز",
    search: "جستجو در سوابق مجاز تدارکات",
    status: "وضعیت",
    allStatuses: "همه وضعیت‌ها",
    currency: "ارز",
    allCurrencies: "همه ارزها",
    from: "از",
    to: "تا",
    refresh: "بازخوانی",
    loading: "در حال دریافت شواهد مجاز تدارکات…",
    empty: "در این زمینه رکورد تدارکاتی قابل مشاهده‌ای نیست.",
    error: "دریافت اطلاعات تدارکات ناموفق بود.",
    retry: "تلاش دوباره",
    details: "جزئیات",
    close: "بستن",
    previous: "قبلی",
    next: "بعدی",
    visible: "رکوردهای قابل مشاهده",
    yes: "بله",
    no: "خیر",
    unknown: "ثبت نشده",
    requestApproval: "درخواست تأیید",
    awaitingApproval: "در انتظار تأیید",
    approve: "تأیید",
    issue: "صدور سفارش",
    markReceived: "ثبت دریافت",
    receivedBadge: "دریافت‌شده",
    actionSuccess: "عملیات با موفقیت انجام شد.",
    actionError: "انجام عملیات ناموفق بود.",
    dualControlNotice: "کنترل دوگانه: تأییدکننده نمی‌تواند ایجادکننده یا درخواست‌کننده باشد.",
  },
} as const;

const labels: Record<Language, Record<string, string>> = {
  en: {
    vendor_name: "Vendor",
    status: "Status",
    service_categories: "Service categories",
    rating: "Rating",
    insurance_valid_until: "Insurance valid until",
    insurance_status: "Insurance status",
    active_contracts: "Active contracts",
    open_quotes: "Open quotes",
    contract_label: "Contract",
    property_name: "Property",
    starts_on: "Starts",
    ends_on: "Ends",
    currency: "Currency",
    rate_card: "Rate card",
    sla_terms: "SLA terms",
    is_current: "Currently effective",
    quote_ref: "Quote",
    work_order_no: "Work order",
    work_order_title: "Work order title",
    subtotal: "Subtotal",
    tax_total: "Tax",
    total_amount: "Total",
    valid_until: "Valid until",
    effective_status: "Effective status",
    submitted_at: "Submitted",
    created_at: "Created",
    created_by: "Created by",
    requested_at: "Requested",
    requested_by: "Requested by",
    po_no: "Purchase order",
    approved_at: "Approved",
    approved_by: "Approved by",
    ordered_at: "Ordered",
    received_at: "Received",
    ledger_linked: "Ledger linked",
    metric_code: "Metric",
    target_value: "Target",
    actual_value: "Actual",
    unit_code: "Unit",
    met: "SLA met",
    measured_at: "Measured",
  },
  ro: {
    vendor_name: "Furnizor",
    status: "Stare",
    service_categories: "Categorii de servicii",
    rating: "Evaluare",
    insurance_valid_until: "Asigurare valabilă până la",
    insurance_status: "Starea asigurării",
    active_contracts: "Contracte active",
    open_quotes: "Oferte deschise",
    contract_label: "Contract",
    property_name: "Proprietate",
    starts_on: "Începe",
    ends_on: "Se termină",
    currency: "Monedă",
    rate_card: "Tarife",
    sla_terms: "Termeni SLA",
    is_current: "În vigoare",
    quote_ref: "Ofertă",
    work_order_no: "Ordin de lucru",
    work_order_title: "Titlu ordin",
    subtotal: "Subtotal",
    tax_total: "Taxă",
    total_amount: "Total",
    valid_until: "Valabil până la",
    effective_status: "Stare efectivă",
    submitted_at: "Depusă",
    created_at: "Creată",
    created_by: "Creată de",
    requested_at: "Solicitată la",
    requested_by: "Solicitată de",
    po_no: "Comandă",
    approved_at: "Aprobată",
    approved_by: "Aprobată de",
    ordered_at: "Comandată",
    received_at: "Recepționată",
    ledger_linked: "Legată de registru",
    metric_code: "Indicator",
    target_value: "Țintă",
    actual_value: "Realizat",
    unit_code: "Unitate",
    met: "SLA îndeplinit",
    measured_at: "Măsurat",
  },
  fa: {
    vendor_name: "فروشنده",
    status: "وضعیت",
    service_categories: "دسته‌های خدمات",
    rating: "امتیاز",
    insurance_valid_until: "اعتبار بیمه تا",
    insurance_status: "وضعیت بیمه",
    active_contracts: "قراردادهای فعال",
    open_quotes: "پیشنهادهای باز",
    contract_label: "قرارداد",
    property_name: "ملک",
    starts_on: "شروع",
    ends_on: "پایان",
    currency: "ارز",
    rate_card: "جدول نرخ",
    sla_terms: "شرایط SLA",
    is_current: "در حال اجرا",
    quote_ref: "پیشنهاد",
    work_order_no: "دستور کار",
    work_order_title: "عنوان دستور کار",
    subtotal: "جمع جزء",
    tax_total: "مالیات",
    total_amount: "مجموع",
    valid_until: "معتبر تا",
    effective_status: "وضعیت مؤثر",
    submitted_at: "ارسال‌شده",
    created_at: "ایجادشده",
    created_by: "ایجادشده توسط",
    requested_at: "درخواست‌شده در",
    requested_by: "درخواست‌کننده",
    po_no: "سفارش خرید",
    approved_at: "تأییدشده در",
    approved_by: "تأییدکننده",
    ordered_at: "سفارش‌شده در",
    received_at: "دریافت‌شده در",
    ledger_linked: "متصل به دفتر کل",
    metric_code: "شاخص",
    target_value: "هدف",
    actual_value: "مقدار واقعی",
    unit_code: "واحد",
    met: "تحقق SLA",
    measured_at: "اندازه‌گیری",
  },
};

const values: Record<Language, Record<string, string>> = {
  en: {
    candidate: "Candidate",
    approved: "Approved",
    suspended: "Suspended",
    blocked: "Blocked",
    active: "Active",
    inactive: "Inactive",
    archived: "Archived",
    draft: "Draft",
    expired: "Expired",
    requested: "Requested",
    ordered: "Ordered",
    received: "Received",
    cancelled: "Cancelled",
    valid: "Valid",
    unrecorded: "Not recorded",
    true: "Met",
    false: "Not met",
  },
  ro: {
    candidate: "Candidat",
    approved: "Aprobat",
    suspended: "Suspendat",
    blocked: "Blocat",
    active: "Activ",
    inactive: "Inactiv",
    archived: "Arhivat",
    draft: "Ciornă",
    expired: "Expirat",
    requested: "Solicitat",
    ordered: "Comandat",
    received: "Recepționat",
    cancelled: "Anulat",
    valid: "Valabil",
    unrecorded: "Neînregistrat",
    true: "Îndeplinit",
    false: "Neîndeplinit",
  },
  fa: {
    candidate: "نامزد",
    approved: "تأییدشده",
    suspended: "تعلیق‌شده",
    blocked: "مسدود",
    active: "فعال",
    inactive: "غیرفعال",
    archived: "بایگانی‌شده",
    draft: "پیش‌نویس",
    expired: "منقضی",
    requested: "درخواست‌شده",
    ordered: "سفارش‌شده",
    received: "دریافت‌شده",
    cancelled: "لغوشده",
    valid: "معتبر",
    unrecorded: "ثبت‌نشده",
    true: "محقق‌شده",
    false: "محقق‌نشده",
  },
};

function statuses(view: ProcurementView) {
  if (view === "vendors") return ["candidate", "approved", "suspended", "blocked"];
  if (view === "contracts") return ["draft", "active", "inactive", "archived"];
  if (view === "quotes") return ["draft", "active", "inactive", "archived", "expired"];
  if (view === "purchase_orders") return ["draft", "requested", "approved", "ordered", "received", "cancelled"];
  return ["true", "false"];
}

function display(lang: Language, key: string, value: unknown, currency?: unknown) {
  const t = copy[lang];
  if (value === null || value === undefined || value === "") return t.unknown;
  if (typeof value === "boolean") return value ? t.yes : t.no;
  if (amountKeys.has(key) && typeof value === "number" && typeof currency === "string") {
    return new Intl.NumberFormat(locales[lang], { style: "currency", currency }).format(value);
  }
  if (typeof value === "number") return new Intl.NumberFormat(locales[lang], { maximumFractionDigits: 4 }).format(value);
  if (dateKeys.has(key) && typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return new Intl.DateTimeFormat(locales[lang], { dateStyle: "medium", timeZone: "UTC" }).format(date);
  }
  if (typeof value === "string" && values[lang][value]) return values[lang][value];
  if (Array.isArray(value)) return value.join(" · ") || t.unknown;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function titleFor(view: ProcurementView, row: Row) {
  if (view === "vendors") return row.vendor_name;
  if (view === "contracts") return row.contract_label;
  if (view === "quotes") return row.quote_ref ?? row.work_order_title;
  if (view === "purchase_orders") return row.po_no ? `PO · ${row.po_no}` : row.work_order_title;
  return row.metric_code;
}

export function CustomerProcurementDashboard({ lang, initialView = "vendors" }: { lang: Language; initialView?: ProcurementView }) {
  const { active } = useCustomerContext();
  const t = copy[lang];
  const [view, setView] = useState<ProcurementView>(initialView);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [currency, setCurrency] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (!active) {
      setLoading(false);
      setData(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ context_id: active.context_id, view, limit: "20", offset: String(offset) });
      if (query) params.set("query", query);
      if (status) params.set("status", status);
      if (currency && view !== "vendors" && view !== "sla") params.set("currency", currency);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const response = await fetch(`/api/customer/v1/procurement?${params}`, { cache: "no-store", credentials: "same-origin", signal });
      if (!response.ok) throw new Error();
      setData((await response.json()) as Payload);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === "AbortError") return;
      setError(t.error);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [active, view, offset, query, status, currency, from, to, t.error]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => void load(controller.signal), 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [load]);

  const handlePoAction = async (poId: string, action: "request" | "approve" | "issue" | "receive") => {
    if (!active) return;
    setActionLoading(poId);
    setActionMessage(null);
    try {
      const res = await fetch(`/api/customer/v1/procurement/purchase-orders/${poId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_id: active.context_id,
          ...(action === "request" ? { notes: "Requested via customer portal" } : {}),
          ...(action === "approve" ? { reason: "Approved via customer portal" } : {}),
        }),
      });
      const resData = await res.json();
      if (!res.ok) {
        const errorMsg = resData?.error?.message || t.actionError;
        setActionMessage({ text: errorMsg, type: "error" });
      } else {
        setActionMessage({ text: t.actionSuccess, type: "success" });
        await load();
      }
    } catch {
      setActionMessage({ text: t.actionError, type: "error" });
    } finally {
      setActionLoading(null);
    }
  };

  const number = (value: number) => new Intl.NumberFormat(locales[lang]).format(value);
  const pageStart = data?.total ? offset + 1 : 0;
  const summary = data?.summary ?? {};
  const roleCode = active?.role_code?.toLowerCase() ?? "";
  const canManageProcurement = ["association_admin", "property_manager"].includes(roleCode);
  const canApproveProcurement = ["association_admin", "property_manager", "president"].includes(roleCode);

  return (
    <div className="space-y-5" dir={lang === "fa" ? "rtl" : "ltr"}>
      <header className="card-proptech border border-[#D3DCE6] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0E9F8E]">
              <BriefcaseBusiness className="h-4 w-4" />
              {t.eyebrow}
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-[#102A43]">{t.title}</h1>
            <p className="mt-1 max-w-3xl text-xs text-[#52667A]">{t.sub}</p>
          </div>
          <span className="rounded-full border border-[#B2E5DF] bg-[#EAF8F5] px-3 py-1 text-[11px] font-bold text-[#0A6E62]">
            <ShieldCheck className="me-1 inline h-4 w-4" />
            {t.readonly}
          </span>
        </div>
      </header>

      {actionMessage ? (
        <div
          role="alert"
          className={`flex items-center justify-between rounded-xl p-3 text-xs font-bold ${
            actionMessage.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            ) : (
              <ShieldAlert className="h-4 w-4 text-rose-600" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button type="button" onClick={() => setActionMessage(null)} aria-label={t.close}>
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          [t.vendors, summary.vendors ?? 0],
          [t.activeContracts, summary.active_contracts ?? 0],
          [t.openQuotes, summary.open_quotes ?? 0],
          [t.openOrders, summary.purchase_orders ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="card-proptech bg-white p-4">
            <div className="text-[11px] text-[#52667A]">{label}</div>
            <div className="mt-1 text-xl font-extrabold">{number(Number(value))}</div>
          </div>
        ))}
      </section>

      <section className="card-proptech overflow-hidden bg-white">
        <div className="flex gap-1 overflow-x-auto border-b p-2">
          {views.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => {
                setView(item);
                setOffset(0);
                setStatus("");
                setCurrency("");
                setSelected(null);
                setActionMessage(null);
              }}
              className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold ${
                view === item ? "bg-[#0E9F8E] text-white" : "text-[#52667A] hover:bg-[#F6F9FC]"
              }`}
            >
              {t[item]}
            </button>
          ))}
        </div>
        <div className="grid gap-2 border-b p-3 md:grid-cols-6">
          <label className="relative md:col-span-2">
            <span className="sr-only">{t.search}</span>
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-[#7B8A9A]" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setOffset(0);
              }}
              placeholder={t.search}
              className="w-full rounded-lg border py-2 pe-3 ps-9 text-xs"
            />
          </label>
          <select
            aria-label={t.status}
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setOffset(0);
            }}
            className="rounded-lg border px-3 py-2 text-xs"
          >
            <option value="">{t.allStatuses}</option>
            {statuses(view).map((item) => (
              <option value={item} key={item}>
                {values[lang][item]}
              </option>
            ))}
          </select>
          <select
            aria-label={t.currency}
            value={currency}
            disabled={view === "vendors" || view === "sla"}
            onChange={(event) => {
              setCurrency(event.target.value);
              setOffset(0);
            }}
            className="rounded-lg border px-3 py-2 text-xs disabled:bg-slate-100"
          >
            <option value="">{t.allCurrencies}</option>
            {["RON", "EUR", "USD", "GBP"].map((item) => (
              <option value={item} key={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            aria-label={t.from}
            type="date"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setOffset(0);
            }}
            className="rounded-lg border px-2 py-2 text-xs"
          />
          <div className="flex gap-2">
            <input
              aria-label={t.to}
              type="date"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setOffset(0);
              }}
              className="min-w-0 flex-1 rounded-lg border px-2 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() => void load()}
              aria-label={t.refresh}
              className="rounded-lg border p-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {loading ? (
          <div role="status" className="p-10 text-center text-xs text-[#52667A]">
            {t.loading}
          </div>
        ) : error ? (
          <div role="alert" className="p-10 text-center text-xs font-bold text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-3 rounded-lg border px-3 py-2 text-[#102A43]"
            >
              {t.retry}
            </button>
          </div>
        ) : !data?.rows.length ? (
          <div className="p-10 text-center text-xs text-[#52667A]">
            <FileSearch className="mx-auto mb-2 h-7 w-7" />
            {t.empty}
          </div>
        ) : (
          <div className="divide-y">
            {data.rows.map((row, index) => {
              const entries = Object.entries(row)
                .filter(([key]) => key !== "id")
                .slice(0, 8);
              const poId = String(row.id ?? "");
              const isPo = view === "purchase_orders";
              const poStatus = String(row.status ?? "");

              return (
                <article
                  key={row.id ?? `${view}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="rounded-xl bg-[#EAF8F5] p-2 text-[#0E9F8E]">
                      <BadgeCheck className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-xs font-bold">
                          {display(lang, "title", titleFor(view, row), row.currency)}
                        </span>
                        {isPo && poStatus === "requested" ? (
                          <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                            {t.awaitingApproval}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#64748B]">
                        {entries.slice(1).map(([key, value]) => (
                          <span key={key}>
                            <b>{labels[lang][key] ?? key}:</b> {display(lang, key, value, row.currency)}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isPo && poStatus === "draft" && canManageProcurement ? (
                      <button
                        type="button"
                        disabled={actionLoading === poId}
                        onClick={() => void handlePoAction(poId, "request")}
                        className="rounded-lg bg-[#0E9F8E] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#0A6E62] disabled:opacity-50"
                      >
                        {actionLoading === poId ? "…" : t.requestApproval}
                      </button>
                    ) : null}

                    {isPo && poStatus === "requested" && canApproveProcurement ? (
                      <button
                        type="button"
                        disabled={actionLoading === poId}
                        onClick={() => void handlePoAction(poId, "approve")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {actionLoading === poId ? "…" : t.approve}
                      </button>
                    ) : null}

                    {isPo && poStatus === "approved" && canManageProcurement ? (
                      <button
                        type="button"
                        disabled={actionLoading === poId}
                        onClick={() => void handlePoAction(poId, "issue")}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                      >
                        {actionLoading === poId ? "…" : t.issue}
                      </button>
                    ) : null}

                    {isPo && poStatus === "ordered" && canManageProcurement ? (
                      <button
                        type="button"
                        disabled={actionLoading === poId}
                        onClick={() => void handlePoAction(poId, "receive")}
                        className="rounded-lg bg-purple-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        {actionLoading === poId ? "…" : t.markReceived}
                      </button>
                    ) : null}

                    {isPo && poStatus === "received" ? (
                      <span className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
                        {t.receivedBadge}
                      </span>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => setSelected(row)}
                      className="rounded-lg border px-3 py-1.5 text-[11px] font-bold text-[#102A43] hover:bg-slate-50"
                    >
                      {t.details}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between border-t p-3 text-xs">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 20))}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
            {t.previous}
          </button>
          <span aria-label={t.visible}>
            {number(pageStart)}–{number(Math.min(offset + 20, data?.total ?? 0))} / {number(data?.total ?? 0)}
          </span>
          <button
            type="button"
            disabled={offset + 20 >= (data?.total ?? 0)}
            onClick={() => setOffset(offset + 20)}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            {t.next}
            <ChevronRight className="h-4 w-4 rtl:rotate-180" />
          </button>
        </div>
      </section>

      {selected ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-end bg-[#102A43]/35 p-4"
          role="dialog"
          aria-modal="true"
          aria-label={t.details}
        >
          <div className="max-h-[85vh] w-full max-w-2xl overflow-auto rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="font-bold">{t.details}</h2>
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label={t.close}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(selected)
                .filter(([key]) => key !== "id")
                .map(([key, value]) => (
                  <div key={key} className="rounded-xl bg-[#F6F9FC] p-3">
                    <dt className="text-[10px] font-bold uppercase text-[#64748B]">
                      {labels[lang][key] ?? key}
                    </dt>
                    <dd className="mt-1 break-words text-xs">
                      {display(lang, key, value, selected.currency)}
                    </dd>
                  </div>
                ))}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
