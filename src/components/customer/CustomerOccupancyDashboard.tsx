"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
  UsersRound,
  X,
  Plus,
  AlertTriangle,
  Clock,
  Home,
  Briefcase,
  KeyRound,
  UserCheck,
  CheckCircle2,
  Calendar,
  ArrowRightLeft,
} from "lucide-react";
import type { Language } from "@/types";
import { useCustomerContext } from "./CustomerContextProvider";

export type AuthorizedRegistryView = "parties" | "residents" | "ownerships" | "leases" | "occupancies" | "mappings" | "links" | "history";

export type OccupancyView = "units" | AuthorizedRegistryView;

type Row = Record<string, unknown> & { id?: string };

interface RegistrySummary {
  units?: number;
  occupied?: number;
  vacant?: number;
  owner_occupied?: number;
  rented?: number;
  company_occupied?: number;
  short_term?: number;
  active_owners?: number;
  active_tenants?: number;
  active_residents?: number;
  expiring_leases?: number;
  incomplete_records?: number;
  active_leases?: number;
}

interface UnitDetailData {
  unit: {
    id: string;
    code: string;
    floor?: number;
    area_m2?: number;
    bedrooms?: number;
    status: string;
  };
  building: { id: string; name: string };
  property: { id: string; name: string };
  occupancy_status: string;
  lifecycle_status: string;
  active_occupancy?: {
    id: string;
    kind: string;
    status: string;
    starts_at: string;
    ends_at?: string;
  } | null;
  owners: Array<{
    party_id: string;
    share: number;
    valid_from: string;
    valid_to?: string;
    display_name: string;
    party_type: string;
  }>;
  active_lease?: {
    id: string;
    starts_on: string;
    ends_on?: string;
    currency: string;
    status: string;
    landlord_label: string;
    tenant_label: string;
  } | null;
  occupants: Array<{
    party_id: string;
    role: string;
    resident_weight: number;
    display_name: string;
  }>;
  history: Array<{
    id: string;
    event_type: string;
    status_from?: string;
    status_to?: string;
    reason?: string;
    occurred_at: string;
  }>;
  read_only: boolean;
  pii_redacted: boolean;
}

interface RegistryResponse {
  rows: Row[];
  total: number;
  summary?: RegistrySummary;
  detail?: Row | null;
  read_only: boolean;
  pii_redacted: boolean;
}

const copy = {
  en: {
    title: "Resident & Occupancy Registry",
    sub: "Comprehensive tenant, owner, resident records and effective occupancy lifecycle.",
    search: "Search unit, building or party…",
    status: "Status",
    all_statuses: "All statuses",
    all_kinds: "All occupancy types",
    refresh: "Refresh",
    loading: "Loading authorized registry…",
    empty: "No registry records found in this context.",
    error: "The occupancy registry could not be loaded.",
    readonly: "Read-only · personal data redacted",
    details: "Details",
    close: "Close",
    units: "Units",
    occupancies: "Occupancies",
    residents: "Residents",
    ownerships: "Ownership",
    leases: "Leases",
    parties: "Parties",
    mappings: "Party mappings",
    links: "Related records",
    history: "Lifecycle",
    metric_total_units: "Total Units",
    metric_occupied: "Occupied",
    metric_vacant: "Vacant",
    metric_owner_occupied: "Owner Occupied",
    metric_rented: "Rented",
    metric_company: "Company",
    metric_short_term: "Short-term",
    metric_people: "Active People",
    metric_warnings: "Warnings / Expiring",
    owners: "Owners",
    tenants: "Tenants",
    warning_expiring: "expiring lease(s)",
    warning_incomplete: "incomplete record(s)",
    previous: "Previous",
    next: "Next",
    create_occupancy: "New Occupancy",
    end_occupancy: "End Occupancy",
    renew_occupancy: "Renew Occupancy",
    transfer_occupancy: "Transfer Unit",
    unit_code: "Unit Code",
    building: "Building",
    property: "Property",
    occupancy_kind: "Occupancy Type",
    dates: "Effective Dates",
    primary_owner: "Primary Owner",
    primary_tenant: "Primary Tenant",
    share: "Share",
    role: "Role",
    starts_at: "Starts At",
    ends_at: "Ends At",
    new_ends_at: "New End Date",
    target_unit_id: "Target Unit ID",
    reason: "Reason",
    submit: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    owner: "Owner",
    tenant: "Tenant",
    household_member: "Household Member",
    short_stay: "Short-term Stay",
    company: "Corporate",
    empty_kind: "Vacant",
    active: "Active",
    planned: "Planned",
    ended: "Ended",
    cancelled: "Cancelled",
    success_created: "Occupancy successfully created.",
    success_ended: "Occupancy successfully ended.",
    success_renewed: "Occupancy successfully renewed.",
    success_transferred: "Occupancy successfully transferred.",
    unit_details_title: "Unit Occupancy & Resident Details",
    active_lease_info: "Active Lease Agreement",
    occupants_list: "Authorized Residents & Occupants",
    history_trail: "Recent Lifecycle Events",
    no_active_occupancy: "Unit is currently vacant.",
    no_active_lease: "No active lease registered.",
    no_occupants: "No registered occupants.",
  },
  ro: {
    title: "Registru de Rezidenți și Ocupare",
    sub: "Evidența completă a locatarilor, proprietarilor, rezidenților și ciclul de viață al unităților.",
    search: "Caută unitate, clădire sau parte…",
    status: "Stare",
    all_statuses: "Toate stările",
    all_kinds: "Toate tipurile de ocupare",
    refresh: "Reîmprospătează",
    loading: "Se încarcă registrul autorizat…",
    empty: "Nu există înregistrări în acest context.",
    error: "Registrul de ocupare nu a putut fi încărcat.",
    readonly: "Doar citire · date personale protejate",
    details: "Detalii",
    close: "Închide",
    units: "Unități",
    occupancies: "Ocupare",
    residents: "Rezidenți",
    ownerships: "Proprietate",
    leases: "Contracte",
    parties: "Părți",
    mappings: "Asocieri părți",
    links: "Înregistrări asociate",
    history: "Ciclu de viață",
    metric_total_units: "Total Unități",
    metric_occupied: "Ocupate",
    metric_vacant: "Libere",
    metric_owner_occupied: "Proprietar",
    metric_rented: "Închiriate",
    metric_company: "Companie",
    metric_short_term: "Termen scurt",
    metric_people: "Persoane Active",
    metric_warnings: "Alerte / Expirări",
    owners: "Proprietari",
    tenants: "Chiriași",
    warning_expiring: "contract(e) expiră curând",
    warning_incomplete: "înregistrare(i) incomplete",
    previous: "Anterior",
    next: "Următor",
    create_occupancy: "Ocupare Nouă",
    end_occupancy: "Încheie Ocuparea",
    renew_occupancy: "Prelungește Ocuparea",
    transfer_occupancy: "Transferă Unitatea",
    unit_code: "Cod Unitate",
    building: "Clădire",
    property: "Proprietate",
    occupancy_kind: "Tip Ocupare",
    dates: "Perioadă Valabilitate",
    primary_owner: "Proprietar Principal",
    primary_tenant: "Chiriaș Principal",
    share: "Cotă",
    role: "Rol",
    starts_at: "Data Început",
    ends_at: "Data Sfârșit",
    new_ends_at: "Noua Dată de Sfârșit",
    target_unit_id: "ID Unitate Destinație",
    reason: "Motiv",
    submit: "Salvează",
    cancel: "Anulează",
    confirm: "Confirmă",
    owner: "Proprietar",
    tenant: "Chiriaș",
    household_member: "Membru Familie",
    short_stay: "Ședere Scurtă",
    company: "Companie",
    empty_kind: "Liberă",
    active: "Activ",
    planned: "Planificat",
    ended: "Încheiat",
    cancelled: "Anulat",
    success_created: "Ocuparea a fost creată cu succes.",
    success_ended: "Ocuparea a fost încheiată.",
    success_renewed: "Ocuparea a fost prelungită cu succes.",
    success_transferred: "Ocuparea a fost transferată cu succes.",
    unit_details_title: "Detalii Ocupare și Rezidenți Unitate",
    active_lease_info: "Contract de Închiriere Activ",
    occupants_list: "Rezidenți și Locatari Autorizați",
    history_trail: "Evenimente Recente din Ciclu de Viață",
    no_active_occupancy: "Unitatea este momentan liberă.",
    no_active_lease: "Niciun contract de închiriere activ.",
    no_occupants: "Niciun rezident înregistrat.",
  },
  fa: {
    title: "دفتر ثبت ساکنان و وضعیت سکونت واحدها",
    sub: "مدیریت جامع مالکان، مستأجران، ساکنان و چرخه عمر سکونت با تفکیک دقیق دسترسی.",
    search: "جستجوی واحد، ساختمان یا شخص…",
    status: "وضعیت",
    all_statuses: "همه وضعیت‌ها",
    all_kinds: "همه انواع سکونت",
    refresh: "بازخوانی",
    loading: "در حال دریافت دفتر مجاز…",
    empty: "در این زمینه رکوردی یافت نشد.",
    error: "دریافت اطلاعات دفتر سکونت با خطا مواجه شد.",
    readonly: "فقط خواندنی · داده‌های شخصی پوشانده شده",
    details: "جزئیات",
    close: "بستن",
    units: "واحدها",
    occupancies: "سکونت",
    residents: "ساکنان",
    ownerships: "مالکیت",
    leases: "قراردادها",
    parties: "اشخاص",
    mappings: "نگاشت‌ها",
    links: "سوابق مرتبط",
    history: "چرخه عمر",
    metric_total_units: "کل واحدها",
    metric_occupied: "اشغال‌شده",
    metric_vacant: "خالی",
    metric_owner_occupied: "مالک‌نشین",
    metric_rented: "اجاره‌ای",
    metric_company: "شرکتی",
    metric_short_term: "اقامت کوتاه‌مدت",
    metric_people: "افراد فعال",
    metric_warnings: "هشدارها / انقضا",
    owners: "مالک",
    tenants: "مستأجر",
    warning_expiring: "قرارداد در آستانه انقضا",
    warning_incomplete: "رکورد ناقص",
    previous: "قبلی",
    next: "بعدی",
    create_occupancy: "ثبت سکونت جدید",
    end_occupancy: "پایان سکونت",
    renew_occupancy: "تمدید سکونت",
    transfer_occupancy: "انتقال واحد",
    unit_code: "کد واحد",
    building: "ساختمان",
    property: "مجتمع",
    occupancy_kind: "نوع سکونت",
    dates: "تاریخ‌های معتبر",
    primary_owner: "مالک اصلی",
    primary_tenant: "مستأجر اصلی",
    share: "سهم",
    role: "نقش",
    starts_at: "تاریخ شروع",
    ends_at: "تاریخ پایان",
    new_ends_at: "تاریخ پایان جدید",
    target_unit_id: "شناسه واحد مقصد",
    reason: "علت / توضیح",
    submit: "ذخیره",
    cancel: "انصراف",
    confirm: "تأیید",
    owner: "مالک",
    tenant: "مستأجر",
    household_member: "عضو خانواده",
    short_stay: "کوتاه‌مدت",
    company: "شرکتی",
    empty_kind: "خالی",
    active: "فعال",
    planned: "برنامه‌ریزی‌شده",
    ended: "پایان‌یافته",
    cancelled: "لغوشده",
    success_created: "سکونت با موفقیت ثبت شد.",
    success_ended: "سکونت با موفقیت خاتمه یافت.",
    success_renewed: "سکونت با موفقیت تمدید شد.",
    success_transferred: "سکونت با موفقیت انتقال یافت.",
    unit_details_title: "جزئیات سکونت و ساکنان واحد",
    active_lease_info: "قرارداد اجاره فعال",
    occupants_list: "ساکنان و افراد مجاز",
    history_trail: "سوابق اخیر چرخه عمر",
    no_active_occupancy: "واحد در حال حاضر خالی است.",
    no_active_lease: "هیچ قرارداد اجاره فعالی ثبت نشده است.",
    no_occupants: "ساکنی ثبت نشده است.",
  },
} as const;

const views: OccupancyView[] = [
  "units",
  "occupancies",
  "residents",
  "ownerships",
  "leases",
  "parties",
  "history",
];

const hiddenFields = new Set([
  "id",
  "entity_id",
  "party_id",
  "membership_id",
  "unit_id",
  "active_occupancy_id",
]);

function display(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "✓" : "—";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v).replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

export function CustomerOccupancyDashboard({
  lang,
  initialView = "units",
  initialId,
}: {
  lang: Language;
  initialView?: OccupancyView;
  initialId?: string;
}) {
  const { active } = useCustomerContext();
  const t = copy[lang];

  const [view, setView] = useState<OccupancyView>(initialView);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<RegistryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  // Detailed view drawer
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(initialId || null);
  const [unitDetail, setUnitDetail] = useState<UnitDetailData | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Mutation modal state
  const [modalType, setModalType] = useState<"create" | "end" | "renew" | "transfer" | null>(null);
  const [modalUnitId, setModalUnitId] = useState("");
  const [modalOccId, setModalOccId] = useState("");
  const [modalKind, setModalKind] = useState("tenant");
  const [modalStartsAt, setModalStartsAt] = useState("");
  const [modalEndsAt, setModalEndsAt] = useState("");
  const [modalReason, setModalReason] = useState("");
  const [modalTargetUnitId, setModalTargetUnitId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState("");

  const isStaffRole =
    active?.role_code === "association_admin" || active?.role_code === "property_manager";

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
      if (kind) p.set("kind", kind);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      if (initialId && view === initialView) p.set("id", initialId);

      const response = await fetch(`/api/customer/v1/occupancy?${p}`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error();
      const body = (await response.json()) as RegistryResponse;
      setData(body);
    } catch {
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [active, view, offset, query, status, kind, from, to, initialId, initialView, t.error]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 150);
    return () => clearTimeout(timer);
  }, [load]);

  const [detailVersion, setDetailVersion] = useState(0);

  useEffect(() => {
    if (!selectedUnitId || !active) return;
    let isCancelled = false;

    const timer = setTimeout(async () => {
      setDetailLoading(true);
      try {
        const p = new URLSearchParams({
          context_id: active.context_id,
          unit_id: selectedUnitId,
        });
        const res = await fetch(`/api/customer/v1/occupancy/unit-detail?${p}`, {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as UnitDetailData;
        if (!isCancelled) setUnitDetail(json);
      } catch {
        if (!isCancelled) setUnitDetail(null);
      } finally {
        if (!isCancelled) setDetailLoading(false);
      }
    }, 0);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [selectedUnitId, active, detailVersion]);

  const summary = data?.summary ?? {};

  // Form submit handler
  async function handleMutationSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!active) return;
    setSubmitting(true);
    setModalError("");
    try {
      let endpoint = "/api/customer/v1/occupancy";
      let payload: Record<string, unknown> = {};

      if (modalType === "create") {
        payload = {
          context_id: active.context_id,
          unit_id: modalUnitId,
          kind: modalKind,
          starts_at: modalStartsAt,
          ends_at: modalEndsAt || null,
          reason: modalReason || null,
        };
      } else if (modalType === "end") {
        endpoint = "/api/customer/v1/occupancy/end";
        payload = {
          context_id: active.context_id,
          occupancy_id: modalOccId,
          ended_at: modalEndsAt || null,
          reason: modalReason || null,
        };
      } else if (modalType === "renew") {
        endpoint = "/api/customer/v1/occupancy/renew";
        payload = {
          context_id: active.context_id,
          occupancy_id: modalOccId,
          new_ends_at: modalEndsAt,
          reason: modalReason || null,
        };
      } else if (modalType === "transfer") {
        endpoint = "/api/customer/v1/occupancy/transfer";
        payload = {
          context_id: active.context_id,
          occupancy_id: modalOccId,
          to_unit_id: modalTargetUnitId,
          effective_at: modalStartsAt || null,
          reason: modalReason || null,
        };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson?.error?.message || "Action failed");
      }

      setModalType(null);
      setActionSuccess(
        modalType === "create"
          ? t.success_created
          : modalType === "end"
          ? t.success_ended
          : modalType === "renew"
          ? t.success_renewed
          : t.success_transferred
      );
      void load();
      setDetailVersion((v) => v + 1);
    } catch (err: any) {
      setModalError(err.message || "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6" dir={lang === "fa" ? "rtl" : "ltr"}>
      {/* Header */}
      <header className="card-proptech border border-[#D3DCE6] bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0E9F8E]">
              <ShieldCheck className="h-4 w-4" />
              CLADORA · {t.title}
            </div>
            <h1 className="mt-1 text-2xl font-extrabold text-[#102A43]">{t.title}</h1>
            <p className="mt-1 max-w-3xl text-xs text-[#52667A]">{t.sub}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-[#B2E5DF] bg-[#EAF8F5] px-3 py-1 text-[11px] font-bold text-[#0A6E62]">
              {data?.read_only ? t.readonly : active?.role_code?.toUpperCase()}
            </span>
            {isStaffRole && (
              <button
                type="button"
                onClick={() => {
                  setModalType("create");
                  setModalUnitId("");
                  setModalStartsAt(new Date().toISOString().slice(0, 10));
                  setModalEndsAt("");
                  setModalReason("");
                  setModalError("");
                }}
                className="flex items-center gap-1.5 rounded-lg bg-[#0E9F8E] px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0A6E62]"
              >
                <Plus className="h-4 w-4" />
                {t.create_occupancy}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Action Notification */}
      {actionSuccess && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-800">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {actionSuccess}
          </div>
          <button type="button" onClick={() => setActionSuccess("")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Scope 1: 9 Core Metrics Summary Cards */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="card-proptech bg-white p-4">
          <div className="flex items-center justify-between text-[11px] text-[#52667A]">
            <span>{t.metric_total_units}</span>
            <Building2 className="h-4 w-4 text-[#7B8A9A]" />
          </div>
          <div className="mt-1 text-2xl font-extrabold text-[#102A43]">{summary.units ?? 0}</div>
          <div className="mt-1 flex gap-2 text-[10px] text-[#64748B]">
            <span className="font-semibold text-emerald-600">
              {summary.occupied ?? 0} {t.metric_occupied}
            </span>
            <span>·</span>
            <span className="font-semibold text-amber-600">
              {summary.vacant ?? 0} {t.metric_vacant}
            </span>
          </div>
        </div>

        <div className="card-proptech bg-white p-4">
          <div className="flex items-center justify-between text-[11px] text-[#52667A]">
            <span>{t.metric_owner_occupied}</span>
            <Home className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-1 text-2xl font-extrabold text-[#102A43]">
            {summary.owner_occupied ?? 0}
          </div>
          <div className="mt-1 text-[10px] text-[#64748B]">
            {summary.active_owners ?? 0} {t.owners}
          </div>
        </div>

        <div className="card-proptech bg-white p-4">
          <div className="flex items-center justify-between text-[11px] text-[#52667A]">
            <span>{t.metric_rented}</span>
            <KeyRound className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="mt-1 text-2xl font-extrabold text-[#102A43]">{summary.rented ?? 0}</div>
          <div className="mt-1 text-[10px] text-[#64748B]">
            {summary.active_tenants ?? 0} {t.tenants}
          </div>
        </div>

        <div className="card-proptech bg-white p-4">
          <div className="flex items-center justify-between text-[11px] text-[#52667A]">
            <span>
              {t.metric_company} / {t.metric_short_term}
            </span>
            <Briefcase className="h-4 w-4 text-purple-500" />
          </div>
          <div className="mt-1 text-2xl font-extrabold text-[#102A43]">
            {(summary.company_occupied ?? 0) + (summary.short_term ?? 0)}
          </div>
          <div className="mt-1 text-[10px] text-[#64748B]">
            {summary.company_occupied ?? 0} corp · {summary.short_term ?? 0} short
          </div>
        </div>

        <div className="card-proptech bg-white p-4">
          <div className="flex items-center justify-between text-[11px] text-[#52667A]">
            <span>{t.metric_warnings}</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-1 text-2xl font-extrabold text-amber-700">
            {(summary.expiring_leases ?? 0) + (summary.incomplete_records ?? 0)}
          </div>
          <div className="mt-1 text-[10px] text-amber-600">
            {summary.expiring_leases ?? 0} {t.warning_expiring}
          </div>
        </div>
      </section>

      {/* Main Registry Card */}
      <section className="card-proptech overflow-hidden bg-white">
        {/* View Switcher Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b p-2">
          {views.map((item) => (
            <button
              type="button"
              key={item}
              onClick={() => {
                setView(item);
                setOffset(0);
              }}
              className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
                view === item
                  ? "bg-[#0E9F8E] text-white"
                  : "text-[#52667A] hover:bg-[#F6F9FC] hover:text-[#102A43]"
              }`}
            >
              {t[item]}
            </button>
          ))}
        </div>

        {/* Filters and Search Bar */}
        <div className="grid gap-2 border-b p-3 sm:grid-cols-2 md:grid-cols-6">
          <label className="relative sm:col-span-2">
            <Search className="absolute start-3 top-2.5 h-4 w-4 text-[#7B8A9A]" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffset(0);
              }}
              placeholder={t.search}
              className="w-full rounded-lg border py-2 pe-3 ps-9 text-xs focus:border-[#0E9F8E] focus:outline-none"
            />
          </label>

          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setOffset(0);
            }}
            className="rounded-lg border px-3 py-2 text-xs focus:border-[#0E9F8E] focus:outline-none"
          >
            <option value="">{t.all_statuses}</option>
            <option value="active">{t.active}</option>
            <option value="vacant">{t.empty_kind}</option>
            <option value="upcoming">{t.planned}</option>
            <option value="ended">{t.ended}</option>
          </select>

          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value);
              setOffset(0);
            }}
            className="rounded-lg border px-3 py-2 text-xs focus:border-[#0E9F8E] focus:outline-none"
          >
            <option value="">{t.all_kinds}</option>
            {["owner", "tenant", "household_member", "short_stay", "company", "empty"].map((x) => (
              <option value={x} key={x}>
                {t[x as keyof typeof t] || x}
              </option>
            ))}
          </select>

          <input
            aria-label="From Date"
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setOffset(0);
            }}
            className="rounded-lg border px-2 py-2 text-xs focus:border-[#0E9F8E] focus:outline-none"
          />

          <div className="flex gap-2">
            <input
              aria-label="To Date"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setOffset(0);
              }}
              className="min-w-0 flex-1 rounded-lg border px-2 py-2 text-xs focus:border-[#0E9F8E] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void load()}
              aria-label={t.refresh}
              className="rounded-lg border p-2 hover:bg-[#F6F9FC]"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="p-12 text-center text-xs text-[#52667A]">
            <RefreshCw className="mx-auto mb-3 h-6 w-6 animate-spin text-[#0E9F8E]" />
            {t.loading}
          </div>
        ) : error ? (
          <div role="alert" className="p-12 text-center text-xs font-bold text-red-700">
            {error}
          </div>
        ) : !data?.rows.length ? (
          <div className="p-12 text-center text-xs text-[#52667A]">
            <UsersRound className="mx-auto mb-3 h-8 w-8 text-[#7B8A9A]" />
            {t.empty}
          </div>
        ) : view === "units" ? (
          /* Scope 2: Unit Occupancy Registry Table */
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="border-b bg-[#F8FAFC] text-[11px] font-bold text-[#64748B]">
                <tr>
                  <th className="p-3 text-start">{t.unit_code}</th>
                  <th className="p-3 text-start">{t.building}</th>
                  <th className="p-3 text-start">{t.occupancy_kind}</th>
                  <th className="p-3 text-start">{t.status}</th>
                  <th className="p-3 text-start">{t.primary_owner}</th>
                  <th className="p-3 text-start">{t.primary_tenant}</th>
                  <th className="p-3 text-end">{t.details}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((row, index) => {
                  const unitId = String(row.id || "");
                  const isVacant = String(row.occupancy_kind || "") === "vacant";
                  return (
                    <tr key={unitId || index} className="hover:bg-[#F8FAFC]">
                      <td className="p-3 font-extrabold text-[#102A43]">
                        {display(row.unit_code)}
                      </td>
                      <td className="p-3 text-[#52667A]">{display(row.building_name)}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            isVacant
                              ? "bg-amber-100 text-amber-800"
                              : "bg-[#EAF8F5] text-[#0A6E62]"
                          }`}
                        >
                          {display(row.occupancy_kind)}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-[11px] font-semibold text-[#64748B]">
                          {display(row.occupancy_lifecycle)}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-[#102A43]">
                        {display(row.primary_owner)}
                      </td>
                      <td className="p-3 font-medium text-[#52667A]">
                        {display(row.primary_tenant)}
                      </td>
                      <td className="p-3 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedUnitId(unitId)}
                            className="rounded-lg border border-[#D3DCE6] px-2.5 py-1 text-[11px] font-bold hover:bg-[#F6F9FC]"
                          >
                            {t.details}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* General View Cards */
          <div className="divide-y">
            {data.rows.map((row, index) => {
              const entries = Object.entries(row)
                .filter(([key]) => !hiddenFields.has(key))
                .slice(0, 8);
              const cardId = String(row.id || `${view}-${index}`);
              return (
                <article key={cardId} className="flex items-center gap-3 p-4">
                  <div className="rounded-xl bg-[#EAF8F5] p-2 text-[#0E9F8E]">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-bold text-[#102A43]">
                      {display(
                        row.unit_code ??
                          row.display_name ??
                          row.resident_label ??
                          row.party_label ??
                          row.event_type ??
                          `#${index + 1}`
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#64748B]">
                      {entries.slice(1).map(([key, value]) => (
                        <span key={key}>
                          <b>{key.replaceAll("_", " ")}:</b> {display(value)}
                        </span>
                      ))}
                    </div>
                  </div>
                  {row.unit_id ? (
                    <button
                      type="button"
                      onClick={() => setSelectedUnitId(String(row.unit_id))}
                      className="rounded-lg border px-3 py-1.5 text-[11px] font-bold hover:bg-[#F6F9FC]"
                    >
                      {t.details}
                    </button>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between border-t p-3 text-xs">
          <button
            type="button"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 20))}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            {t.previous}
          </button>
          <span className="font-semibold text-[#52667A]">
            {data?.total ? offset + 1 : 0}–{Math.min(offset + 20, data?.total ?? 0)} /{" "}
            {data?.total ?? 0}
          </span>
          <button
            type="button"
            disabled={offset + 20 >= (data?.total ?? 0)}
            onClick={() => setOffset(offset + 20)}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 disabled:opacity-40"
          >
            {t.next}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </section>

      {/* Unit Detail Drawer / Modal */}
      {selectedUnitId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#102A43]/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#0E9F8E]" />
                <h2 className="text-base font-extrabold text-[#102A43]">
                  {t.unit_details_title} · {unitDetail?.unit.code || selectedUnitId.slice(0, 8)}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUnitId(null)}
                aria-label={t.close}
                className="rounded-lg p-1 hover:bg-[#F6F9FC]"
              >
                <X className="h-5 w-5 text-[#7B8A9A]" />
              </button>
            </div>

            {detailLoading ? (
              <div className="p-12 text-center text-xs text-[#52667A]">
                <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-[#0E9F8E]" />
                {t.loading}
              </div>
            ) : unitDetail ? (
              <div className="mt-4 space-y-5 text-xs">
                {/* Unit Overview */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl bg-[#F6F9FC] p-3">
                    <div className="text-[10px] font-bold uppercase text-[#64748B]">
                      {t.building}
                    </div>
                    <div className="mt-1 font-extrabold text-[#102A43]">
                      {unitDetail.building.name}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F6F9FC] p-3">
                    <div className="text-[10px] font-bold uppercase text-[#64748B]">
                      {t.occupancy_kind}
                    </div>
                    <div className="mt-1 font-extrabold text-[#0E9F8E]">
                      {unitDetail.occupancy_status}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F6F9FC] p-3">
                    <div className="text-[10px] font-bold uppercase text-[#64748B]">{t.status}</div>
                    <div className="mt-1 font-extrabold text-[#102A43]">
                      {unitDetail.lifecycle_status}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F6F9FC] p-3">
                    <div className="text-[10px] font-bold uppercase text-[#64748B]">
                      Area / Floor
                    </div>
                    <div className="mt-1 font-extrabold text-[#102A43]">
                      {unitDetail.unit.area_m2 ?? "—"} m² (fl {unitDetail.unit.floor ?? "—"})
                    </div>
                  </div>
                </div>

                {/* Staff Lifecycle Mutation Action Buttons */}
                {isStaffRole && !unitDetail.read_only && (
                  <div className="flex flex-wrap gap-2 border-y py-3">
                    {unitDetail.active_occupancy ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setModalType("end");
                            setModalOccId(unitDetail.active_occupancy!.id);
                            setModalEndsAt(new Date().toISOString().slice(0, 10));
                            setModalReason("");
                            setModalError("");
                          }}
                          className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100"
                        >
                          {t.end_occupancy}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModalType("renew");
                            setModalOccId(unitDetail.active_occupancy!.id);
                            setModalEndsAt("");
                            setModalReason("");
                            setModalError("");
                          }}
                          className="rounded-lg border border-[#B2E5DF] bg-[#EAF8F5] px-3 py-1.5 text-[11px] font-bold text-[#0A6E62] hover:bg-[#D5F2ED]"
                        >
                          {t.renew_occupancy}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModalType("transfer");
                            setModalOccId(unitDetail.active_occupancy!.id);
                            setModalStartsAt(new Date().toISOString().slice(0, 10));
                            setModalTargetUnitId("");
                            setModalReason("");
                            setModalError("");
                          }}
                          className="flex items-center gap-1 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-[11px] font-bold text-purple-700 hover:bg-purple-100"
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5" />
                          {t.transfer_occupancy}
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setModalType("create");
                          setModalUnitId(unitDetail.unit.id);
                          setModalStartsAt(new Date().toISOString().slice(0, 10));
                          setModalEndsAt("");
                          setModalReason("");
                          setModalError("");
                        }}
                        className="flex items-center gap-1 rounded-lg bg-[#0E9F8E] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#0A6E62]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t.create_occupancy}
                      </button>
                    )}
                  </div>
                )}

                {/* Active Lease Section */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    {t.active_lease_info}
                  </h3>
                  {unitDetail.active_lease ? (
                    <div className="mt-2 rounded-xl border border-[#E2E8F0] p-3.5">
                      <div className="flex justify-between font-bold text-[#102A43]">
                        <span>{unitDetail.active_lease.tenant_label}</span>
                        <span className="text-[10px] text-[#64748B]">
                          {unitDetail.active_lease.starts_on} →{" "}
                          {unitDetail.active_lease.ends_on || "Indefinite"}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-[#52667A]">
                        Landlord: {unitDetail.active_lease.landlord_label}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 rounded-xl border border-dashed p-3 text-center text-[#7B8A9A]">
                      {t.no_active_lease}
                    </div>
                  )}
                </div>

                {/* Registered Owners */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    {t.owners}
                  </h3>
                  {unitDetail.owners.length ? (
                    <div className="mt-2 divide-y rounded-xl border border-[#E2E8F0]">
                      {unitDetail.owners.map((owner, idx) => (
                        <div key={owner.party_id || idx} className="flex justify-between p-3">
                          <div>
                            <span className="font-bold text-[#102A43]">{owner.display_name}</span>
                            <span className="ms-2 text-[10px] text-[#64748B]">
                              ({owner.party_type})
                            </span>
                          </div>
                          <span className="font-mono font-bold text-[#0E9F8E]">
                            {(owner.share * 100).toFixed(2)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-xl border border-dashed p-3 text-center text-[#7B8A9A]">
                      No owners registered
                    </div>
                  )}
                </div>

                {/* Occupants List */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    {t.occupants_list}
                  </h3>
                  {unitDetail.occupants.length ? (
                    <div className="mt-2 divide-y rounded-xl border border-[#E2E8F0]">
                      {unitDetail.occupants.map((occ, idx) => (
                        <div key={occ.party_id || idx} className="flex justify-between p-3">
                          <span className="font-bold text-[#102A43]">{occ.display_name}</span>
                          <span className="rounded-md bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-semibold text-[#475569]">
                            {occ.role}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-xl border border-dashed p-3 text-center text-[#7B8A9A]">
                      {t.no_occupants}
                    </div>
                  )}
                </div>

                {/* Recent History Trail */}
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#64748B]">
                    {t.history_trail}
                  </h3>
                  {unitDetail.history.length ? (
                    <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-[#E2E8F0] p-3">
                      {unitDetail.history.map((ev, idx) => (
                        <div
                          key={ev.id || idx}
                          className="flex items-center justify-between text-[11px]"
                        >
                          <span className="font-bold text-[#102A43]">{ev.event_type}</span>
                          <span className="text-[#64748B]">{ev.reason || "—"}</span>
                          <span className="text-[10px] text-[#94A3B8]">
                            {ev.occurred_at?.slice(0, 10)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 rounded-xl border border-dashed p-3 text-center text-[#7B8A9A]">
                      No recent events
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Mutation Form Dialog (Create, End, Renew, Transfer) */}
      {modalType && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#102A43]/40 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-sm font-extrabold text-[#102A43]">
                {modalType === "create" && t.create_occupancy}
                {modalType === "end" && t.end_occupancy}
                {modalType === "renew" && t.renew_occupancy}
                {modalType === "transfer" && t.transfer_occupancy}
              </h2>
              <button
                type="button"
                onClick={() => setModalType(null)}
                aria-label={t.close}
                className="rounded-lg p-1 hover:bg-[#F6F9FC]"
              >
                <X className="h-5 w-5 text-[#7B8A9A]" />
              </button>
            </div>

            {modalError && (
              <div className="mt-3 rounded-lg bg-red-50 p-3 text-xs font-semibold text-red-700">
                {modalError}
              </div>
            )}

            <form onSubmit={handleMutationSubmit} className="mt-4 space-y-3.5 text-xs">
              {modalType === "create" && (
                <>
                  <div>
                    <label className="block font-bold text-[#52667A]">{t.unit_code} / ID</label>
                    <input
                      required
                      value={modalUnitId}
                      onChange={(e) => setModalUnitId(e.target.value)}
                      className="mt-1 w-full rounded-lg border p-2 text-xs focus:border-[#0E9F8E] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#52667A]">{t.occupancy_kind}</label>
                    <select
                      value={modalKind}
                      onChange={(e) => setModalKind(e.target.value)}
                      className="mt-1 w-full rounded-lg border p-2 text-xs focus:border-[#0E9F8E] focus:outline-none"
                    >
                      <option value="owner">{t.owner}</option>
                      <option value="tenant">{t.tenant}</option>
                      <option value="company">{t.company}</option>
                      <option value="short_stay">{t.short_stay}</option>
                      <option value="household_member">{t.household_member}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#52667A]">{t.starts_at}</label>
                    <input
                      type="date"
                      required
                      value={modalStartsAt}
                      onChange={(e) => setModalStartsAt(e.target.value)}
                      className="mt-1 w-full rounded-lg border p-2 text-xs focus:border-[#0E9F8E] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#52667A]">
                      {t.ends_at} (Optional)
                    </label>
                    <input
                      type="date"
                      value={modalEndsAt}
                      onChange={(e) => setModalEndsAt(e.target.value)}
                      className="mt-1 w-full rounded-lg border p-2 text-xs focus:border-[#0E9F8E] focus:outline-none"
                    />
                  </div>
                </>
              )}

              {modalType === "end" && (
                <div>
                  <label className="block font-bold text-[#52667A]">{t.ends_at}</label>
                  <input
                    type="date"
                    required
                    value={modalEndsAt}
                    onChange={(e) => setModalEndsAt(e.target.value)}
                    className="mt-1 w-full rounded-lg border p-2 text-xs focus:border-[#0E9F8E] focus:outline-none"
                  />
                </div>
              )}

              {modalType === "renew" && (
                <div>
                  <label className="block font-bold text-[#52667A]">{t.new_ends_at}</label>
                  <input
                    type="date"
                    required
                    value={modalEndsAt}
                    onChange={(e) => setModalEndsAt(e.target.value)}
                    className="mt-1 w-full rounded-lg border p-2 text-xs focus:border-[#0E9F8E] focus:outline-none"
                  />
                </div>
              )}

              {modalType === "transfer" && (
                <>
                  <div>
                    <label className="block font-bold text-[#52667A]">{t.target_unit_id}</label>
                    <input
                      required
                      value={modalTargetUnitId}
                      onChange={(e) => setModalTargetUnitId(e.target.value)}
                      className="mt-1 w-full rounded-lg border p-2 text-xs focus:border-[#0E9F8E] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#52667A]">
                      Effective Transfer Date
                    </label>
                    <input
                      type="date"
                      required
                      value={modalStartsAt}
                      onChange={(e) => setModalStartsAt(e.target.value)}
                      className="mt-1 w-full rounded-lg border p-2 text-xs focus:border-[#0E9F8E] focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-bold text-[#52667A]">{t.reason}</label>
                <input
                  value={modalReason}
                  onChange={(e) => setModalReason(e.target.value)}
                  placeholder="Reason for change…"
                  className="mt-1 w-full rounded-lg border p-2 text-xs focus:border-[#0E9F8E] focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="rounded-lg border px-4 py-2 font-bold text-[#52667A] hover:bg-[#F6F9FC]"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#0E9F8E] px-4 py-2 font-bold text-white hover:bg-[#0A6E62] disabled:opacity-50"
                >
                  {submitting ? "…" : t.submit}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
