"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Wrench,
  Shield,
  ShieldAlert,
  AlertTriangle,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Search,
  ChevronRight,
  X,
  FileText,
  Activity,
  Award,
  Layers,
} from "lucide-react";
import type { Language } from "@/types";
import { useCustomerContext } from "./CustomerContextProvider";

interface Asset {
  id: string;
  asset_code: string;
  name: string;
  description?: string;
  category_id?: string;
  property_id?: string;
  building_id?: string;
  unit_id?: string;
  scope: string;
  manufacturer?: string;
  model?: string;
  serial_fingerprint?: string;
  manufacture_year?: number;
  installed_on?: string;
  commissioned_at?: string;
  location_description?: string;
  ownership_type: string;
  lifecycle_status: string;
  operational_status: string;
  condition: string;
  criticality_level: string;
  is_safety_critical: boolean;
  replacement_cost?: number;
  currency?: string;
  meter_id?: string;
  access_point_id?: string;
  vendor_id?: string;
  service_contract_id?: string;
  service_frequency_months?: number;
  last_service_date?: string;
  next_service_date?: string;
  warranty?: any;
  active_downtime?: any;
  is_in_downtime?: boolean;
}

interface Inspection {
  id: string;
  inspection_type: string;
  scheduled_date: string;
  performed_at?: string;
  result: string;
  inspector_name?: string;
  observations?: string;
  corrective_action_required?: string;
  next_due_date?: string;
  is_verified: boolean;
  verified_at?: string;
  document_id?: string;
}

interface WarrantyClaim {
  id: string;
  claim_reference: string;
  claim_date: string;
  description: string;
  resolution_status: string;
  resolution_notes?: string;
  document_id?: string;
}

const copy = {
  en: {
    title: "Building Assets & Equipment Registry",
    subtitle: "Enterprise equipment catalog, compliance scheduler, atomic downtime tracking, and dual-control lifecycle.",
    totalAssets: "Total Equipment",
    operational: "Operational",
    safetyCritical: "Safety Critical",
    inDowntime: "In Downtime",
    search: "Search by name, code, manufacturer...",
    allLifecycles: "All Lifecycles",
    allOperational: "All Operational States",
    allCriticality: "All Criticalities",
    safetyOnly: "Safety-Critical Only",
    addAsset: "Register Equipment",
    refresh: "Refresh",
    code: "Asset Code",
    name: "Equipment Name",
    operationalStatus: "Operational Status",
    lifecycle: "Lifecycle",
    criticality: "Criticality",
    location: "Location",
    actions: "Actions",
    viewDetails: "View Details",
    noAssets: "No equipment records matching the selected filters.",
    downtimeBanner: "EQUIPMENT CURRENTLY IN DOWNTIME",
    startDowntime: "Start Downtime",
    endDowntime: "End Downtime",
    recordInspection: "Record Inspection",
    verifyInspection: "Verify & Certify (AAL2)",
    warrantyTitle: "Commercial Warranty & Claims",
    fileClaim: "File Warranty Claim",
    decommissionTitle: "Equipment Decommissioning",
    requestDecommission: "Request Decommission",
    approveDecommission: "Approve Decommission (Dual-Control AAL2)",
    tabs: {
      overview: "Overview",
      downtime: "Downtime Log",
      inspections: "Inspections",
      warranty: "Warranty & Claims",
      decommission: "Decommission",
    },
    success: "Operation executed successfully",
    error: "Operation failed: ",
  },
  ro: {
    title: "Registru Echipamente & Active Clădire",
    subtitle: "Catalog tehnic de echipamente, planificare conformitate legală, monitorizare indisponibilitate și control dezafectare.",
    totalAssets: "Total Echipamente",
    operational: "Operațional",
    safetyCritical: "Siguranță Critică",
    inDowntime: "În Indisponibilitate",
    search: "Căutare după denumire, cod, producător...",
    allLifecycles: "Toate Ciclurile de Viață",
    allOperational: "Toate Stările Operaționale",
    allCriticality: "Toate Nivelurile de Criticitate",
    safetyOnly: "Doar Siguranță Critică",
    addAsset: "Înregistrează Echipament",
    refresh: "Actualizează",
    code: "Cod Activ",
    name: "Denumire Echipament",
    operationalStatus: "Stare Operațională",
    lifecycle: "Ciclu de Viață",
    criticality: "Criticitate",
    location: "Locație",
    actions: "Acțiuni",
    viewDetails: "Detalii",
    noAssets: "Niciun echipament găsit conform filtrelor selectate.",
    downtimeBanner: "ECHIPAMENT AFLAT ÎN INDISPONIBILITATE",
    startDowntime: "Pornește Indisponibilitate",
    endDowntime: "Încheie Indisponibilitate",
    recordInspection: "Înregistrează Inspecție",
    verifyInspection: "Verifică & Certifică (AAL2)",
    warrantyTitle: "Garanție Comercială & Reclamații",
    fileClaim: "Înregistrează Reclamație",
    decommissionTitle: "Dezafectare Echipament",
    requestDecommission: "Solicită Dezafectare",
    approveDecommission: "Aprobă Dezafectare (Control Dublu AAL2)",
    tabs: {
      overview: "Prezentare Generală",
      downtime: "Istoric Indisponibilitate",
      inspections: "Inspecții Tehnice",
      warranty: "Garanții & Reclamații",
      decommission: "Dezafectare",
    },
    success: "Operațiunea a fost executată cu succes",
    error: "Operațiune eșuată: ",
  },
  fa: {
    title: "سامانه دارایی‌ها و تجهیزات ساختمان",
    subtitle: "رجیستری تجهیزات فنی، مدیریت بازرسی دوره‌ای، ثبت توقف و ازکارافتادگی اتمیک و کنترل خروج از خدمت دوکاربره.",
    totalAssets: "کل تجهیزات",
    operational: "فعال و عملیاتی",
    safetyCritical: "ایمنی حیاتی",
    inDowntime: "دارای توقف فعال",
    search: "جستجو با نام، کد، سازنده...",
    allLifecycles: "تمام وضعیت‌های چرخه حیات",
    allOperational: "تمام وضعیت‌های عملیاتی",
    allCriticality: "تمام سطوح حساسیت",
    safetyOnly: "فقط تجهیزات ایمنی‌حیاتی",
    addAsset: "ثبت تجهیز جدید",
    refresh: "بروزرسانی",
    code: "کد دارایی",
    name: "نام تجهیز",
    operationalStatus: "وضعیت عملیاتی",
    lifecycle: "چرخه حیات",
    criticality: "سطح حساسیت",
    location: "محل استقرار",
    actions: "عملیات",
    viewDetails: "مشاهده جزئیات",
    noAssets: "هیچ تجهیزی مطابق با فیلترهای انتخابی یافت نشد.",
    downtimeBanner: "تجهیز در حال حاضر متوقف / خارج از سرویس است",
    startDowntime: "ثبت آغاز توقف",
    endDowntime: "ثبت پایان توقف",
    recordInspection: "ثبت بازرسی دوره‌ای",
    verifyInspection: "تأیید و صدور گواهی (AAL2)",
    warrantyTitle: "گارانتی بازرگانی و مطالبات",
    fileClaim: "ثبت مطالبه گارانتی",
    decommissionTitle: "خروج دائمی تجهیز از خدمت",
    requestDecommission: "درخواست خروج از خدمت",
    approveDecommission: "تأیید خروج از خدمت (نظارت دومرحله‌ای AAL2)",
    tabs: {
      overview: "مشخصات کلی",
      downtime: "گزارش توقف‌ها",
      inspections: "بازرسی‌ها",
      warranty: "گارانتی و مطالبات",
      decommission: "خروج از خدمت",
    },
    success: "عملیات با موفقیت انجام شد",
    error: "خطا در اجرای عملیات: ",
  },
};

export function CustomerAssetsDashboard({ lang }: { lang: Language }) {
  const t = copy[lang as keyof typeof copy] || copy.en;
  const isRtl = lang === "fa";
  const { active, loading: ctxLoading } = useCustomerContext();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("");
  const [operationalFilter, setOperationalFilter] = useState("");
  const [criticalityFilter, setCriticalityFilter] = useState("");
  const [safetyOnly, setSafetyOnly] = useState(false);

  // Active Selected Asset & Drawer
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "downtime" | "inspections" | "warranty" | "decommission">("overview");

  // Child Data
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [warrantyClaims, setWarrantyClaims] = useState<WarrantyClaim[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // Modals
  const [showDowntimeModal, setShowDowntimeModal] = useState(false);
  const [downtimeReason, setDowntimeReason] = useState("");
  const [downtimePlanned, setDowntimePlanned] = useState(false);

  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [inspType, setInspType] = useState("annual_safety");
  const [inspDate, setInspDate] = useState(new Date().toISOString().slice(0, 10));
  const [inspResult, setInspResult] = useState("passed");
  const [inspInspector, setInspInspector] = useState("");

  const [showDecomModal, setShowDecomModal] = useState(false);
  const [decomReason, setDecomReason] = useState("");

  const loadAssets = useCallback(async () => {
    if (!active?.context_id) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const params = new URLSearchParams({
        context_id: active.context_id,
        limit: "50",
      });
      if (search.trim()) params.set("search", search.trim());
      if (lifecycleFilter) params.set("lifecycle_status", lifecycleFilter);
      if (operationalFilter) params.set("operational_status", operationalFilter);
      if (criticalityFilter) params.set("criticality_level", criticalityFilter);
      if (safetyOnly) params.set("is_safety_critical", "true");

      const res = await fetch(`/api/customer/v1/assets?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to load assets");
      }
      setAssets(json.items || []);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to fetch equipment");
    } finally {
      setLoading(false);
    }
  }, [active, search, lifecycleFilter, operationalFilter, criticalityFilter, safetyOnly]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAssets();
    }, 100);
    return () => clearTimeout(timer);
  }, [loadAssets]);

  // Load Asset Detail
  const loadAssetDetail = useCallback(async (assetId: string) => {
    if (!active?.context_id) return;
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/customer/v1/assets/${assetId}?context_id=${active.context_id}`);
      const json = await res.json();
      if (res.ok) {
        setSelectedAsset(json);
      }
      // Fetch child inspections
      const inspRes = await fetch(`/api/customer/v1/assets/${assetId}/inspections?context_id=${active.context_id}`);
      const inspJson = await inspRes.json();
      if (inspRes.ok) {
        setInspections(inspJson.items || []);
      }
      // Fetch warranty claims
      const claimsRes = await fetch(`/api/customer/v1/assets/${assetId}/warranty/claims?context_id=${active.context_id}`);
      const claimsJson = await claimsRes.json();
      if (claimsRes.ok) {
        setWarrantyClaims(claimsJson.items || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  }, [active]);

  const handleSelectAsset = (asset: Asset) => {
    setSelectedAssetId(asset.id);
    setSelectedAsset(asset);
    setActiveTab("overview");
    loadAssetDetail(asset.id);
  };

  // Actions
  const handleStartDowntime = async () => {
    if (!active?.context_id || !selectedAsset) return;
    try {
      const res = await fetch(`/api/customer/v1/assets/${selectedAsset.id}/downtime/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_id: active.context_id,
          reason: downtimeReason || "Manual downtime event",
          is_planned: downtimePlanned,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to start downtime");
      setSuccessMsg(t.success);
      setShowDowntimeModal(false);
      loadAssetDetail(selectedAsset.id);
      loadAssets();
    } catch (err: any) {
      setErrorMsg(t.error + err.message);
    }
  };

  const handleEndDowntime = async () => {
    if (!active?.context_id || !selectedAsset?.active_downtime?.id) return;
    try {
      const res = await fetch(`/api/customer/v1/assets/${selectedAsset.active_downtime.id}/downtime/end`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_id: active.context_id,
          restored_operational_status: "operational",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to end downtime");
      setSuccessMsg(t.success);
      loadAssetDetail(selectedAsset.id);
      loadAssets();
    } catch (err: any) {
      setErrorMsg(t.error + err.message);
    }
  };

  const handleRecordInspection = async () => {
    if (!active?.context_id || !selectedAsset) return;
    try {
      const res = await fetch(`/api/customer/v1/assets/${selectedAsset.id}/inspections`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_id: active.context_id,
          inspection_type: inspType,
          scheduled_date: inspDate,
          performed_at: new Date().toISOString(),
          result: inspResult,
          inspector_name: inspInspector || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to record inspection");
      setSuccessMsg(t.success);
      setShowInspectionModal(false);
      loadAssetDetail(selectedAsset.id);
    } catch (err: any) {
      setErrorMsg(t.error + err.message);
    }
  };

  const handleVerifyInspection = async (inspId: string) => {
    if (!active?.context_id || !selectedAsset) return;
    try {
      const res = await fetch(`/api/customer/v1/assets/${selectedAsset.id}/inspections/${inspId}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context_id: active.context_id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to verify inspection");
      setSuccessMsg(t.success);
      loadAssetDetail(selectedAsset.id);
    } catch (err: any) {
      setErrorMsg(t.error + err.message);
    }
  };

  const handleRequestDecommission = async () => {
    if (!active?.context_id || !selectedAsset) return;
    try {
      const res = await fetch(`/api/customer/v1/assets/${selectedAsset.id}/decommission`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context_id: active.context_id,
          reason: decomReason || "End of lifecycle decommissioning",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || "Failed to request decommission");
      setSuccessMsg(t.success);
      setShowDecomModal(false);
      loadAssetDetail(selectedAsset.id);
      loadAssets();
    } catch (err: any) {
      setErrorMsg(t.error + err.message);
    }
  };

  const totalCount = assets.length;
  const operationalCount = assets.filter((a) => a.operational_status === "operational").length;
  const safetyCount = assets.filter((a) => a.is_safety_critical).length;
  const inDowntimeCount = assets.filter((a) => a.operational_status === "unavailable" || a.is_in_downtime).length;

  const getOperationalBadgeClass = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300";
      case "degraded":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300";
      case "unavailable":
        return "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300";
      case "isolated":
        return "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300";
    }
  };

  return (
    <div className={`w-full max-w-7xl mx-auto space-y-6 ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2.5">
            <Wrench className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
            {t.title}
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={loadAssets}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            {t.refresh}
          </button>
        </div>
      </div>

      {/* Notifications */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-rose-700 dark:text-rose-300 font-medium">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            {errorMsg}
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-emerald-700 dark:text-emerald-300 font-medium">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            {successMsg}
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t.totalAssets}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{totalCount}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t.operational}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{operationalCount}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t.safetyCritical}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{safetyCount}</p>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3.5">
          <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{t.inDowntime}</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{inDowntimeCount}</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder={t.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <select
            value={operationalFilter}
            onChange={(e) => setOperationalFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          >
            <option value="">{t.allOperational}</option>
            <option value="operational">Operational</option>
            <option value="degraded">Degraded</option>
            <option value="unavailable">Unavailable (Downtime)</option>
            <option value="isolated">Isolated</option>
          </select>
          <select
            value={lifecycleFilter}
            onChange={(e) => setLifecycleFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          >
            <option value="">{t.allLifecycles}</option>
            <option value="planned">Planned</option>
            <option value="installed">Installed</option>
            <option value="commissioned">Commissioned</option>
            <option value="active">Active</option>
            <option value="under_maintenance">Under Maintenance</option>
            <option value="decommission_pending">Decommission Pending</option>
            <option value="decommissioned">Decommissioned</option>
          </select>
          <select
            value={criticalityFilter}
            onChange={(e) => setCriticalityFilter(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          >
            <option value="">{t.allCriticality}</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={safetyOnly}
              onChange={(e) => setSafetyOnly(e.target.checked)}
              className="rounded text-indigo-600 focus:ring-indigo-500 w-4 h-4"
            />
            {t.safetyOnly}
          </label>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="px-5 py-3.5">{t.code}</th>
                <th className="px-5 py-3.5">{t.name}</th>
                <th className="px-5 py-3.5">{t.operationalStatus}</th>
                <th className="px-5 py-3.5">{t.lifecycle}</th>
                <th className="px-5 py-3.5">{t.criticality}</th>
                <th className="px-5 py-3.5 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {assets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                    {t.noAssets}
                  </td>
                </tr>
              ) : (
                assets.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => handleSelectAsset(a)}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition"
                  >
                    <td className="px-5 py-3.5 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                      {a.asset_code}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                      {a.name}
                      {a.is_safety_critical && (
                        <span title="Safety Critical Equipment">
                          <Shield className="w-4 h-4 text-amber-500 flex-shrink-0" />
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getOperationalBadgeClass(a.operational_status)}`}>
                        {a.operational_status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 capitalize">{a.lifecycle_status.replace(/_/g, " ")}</td>
                    <td className="px-5 py-3.5 uppercase text-xs font-semibold">{a.criticality_level}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAsset(a);
                        }}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 font-medium inline-flex items-center gap-1 text-xs"
                      >
                        {t.viewDetails}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Asset Details Drawer / Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex justify-end">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 h-full shadow-2xl p-6 overflow-y-auto space-y-6">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-indigo-600 dark:text-indigo-400 font-bold">
                    {selectedAsset.asset_code}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getOperationalBadgeClass(selectedAsset.operational_status)}`}>
                    {selectedAsset.operational_status}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">{selectedAsset.name}</h2>
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Downtime Alert Banner */}
            {(selectedAsset.operational_status === "unavailable" || selectedAsset.active_downtime) && (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-rose-600" />
                  <div>
                    <p className="text-xs font-bold text-rose-700 dark:text-rose-300">{t.downtimeBanner}</p>
                    <p className="text-xs text-rose-600 dark:text-rose-400">
                      Reason: {selectedAsset.active_downtime?.reason || "Operational downtime"}
                    </p>
                  </div>
                </div>
                {selectedAsset.active_downtime && (
                  <button
                    onClick={handleEndDowntime}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                  >
                    {t.endDowntime}
                  </button>
                )}
              </div>
            )}

            {/* Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-4 text-sm font-medium">
              {(["overview", "downtime", "inspections", "warranty", "decommission"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`pb-2 border-b-2 transition ${
                    activeTab === tab
                      ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {t.tabs[tab]}
                </button>
              ))}
            </div>

            {/* Tab: Overview */}
            {activeTab === "overview" && (
              <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                    <span className="text-xs text-slate-400">Manufacturer & Model</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      {selectedAsset.manufacturer || "N/A"} {selectedAsset.model || ""}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                    <span className="text-xs text-slate-400">Lifecycle Status</span>
                    <p className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                      {selectedAsset.lifecycle_status.replace(/_/g, " ")}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                    <span className="text-xs text-slate-400">Condition</span>
                    <p className="font-semibold capitalize text-slate-800 dark:text-slate-200">
                      {selectedAsset.condition}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                    <span className="text-xs text-slate-400">Safety Criticality</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      {selectedAsset.is_safety_critical ? (
                        <>
                          <ShieldAlert className="w-4 h-4 text-amber-500" /> Yes (Dual-Control Protected)
                        </>
                      ) : (
                        "Standard Asset"
                      )}
                    </p>
                  </div>
                </div>

                {selectedAsset.description && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg">
                    <span className="text-xs text-slate-400">Description</span>
                    <p className="text-slate-700 dark:text-slate-300 mt-0.5">{selectedAsset.description}</p>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="pt-4 flex gap-2">
                  {!selectedAsset.active_downtime && selectedAsset.operational_status !== "unavailable" && (
                    <button
                      onClick={() => setShowDowntimeModal(true)}
                      className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs shadow-sm"
                    >
                      {t.startDowntime}
                    </button>
                  )}
                  <button
                    onClick={() => setShowInspectionModal(true)}
                    className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-sm"
                  >
                    {t.recordInspection}
                  </button>
                </div>
              </div>
            )}

            {/* Tab: Downtime */}
            {activeTab === "downtime" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Downtime Sessions</h3>
                  {!selectedAsset.active_downtime && (
                    <button
                      onClick={() => setShowDowntimeModal(true)}
                      className="text-xs font-semibold text-rose-600 hover:underline"
                    >
                      + {t.startDowntime}
                    </button>
                  )}
                </div>
                {selectedAsset.active_downtime ? (
                  <div className="p-3 border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 rounded-lg text-sm">
                    <p className="font-bold text-rose-800 dark:text-rose-300">Active Downtime Session</p>
                    <p className="text-xs text-rose-600 mt-1">Started: {new Date(selectedAsset.active_downtime.started_at).toLocaleString()}</p>
                    <p className="text-xs text-rose-700 mt-1">Reason: {selectedAsset.active_downtime.reason}</p>
                    <button
                      onClick={handleEndDowntime}
                      className="mt-3 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs"
                    >
                      {t.endDowntime}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">Equipment is operational. No active downtime registered.</p>
                )}
              </div>
            )}

            {/* Tab: Inspections */}
            {activeTab === "inspections" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">Inspections & Statutory Proof</h3>
                  <button
                    onClick={() => setShowInspectionModal(true)}
                    className="text-xs font-semibold text-indigo-600 hover:underline"
                  >
                    + {t.recordInspection}
                  </button>
                </div>
                {inspections.length === 0 ? (
                  <p className="text-xs text-slate-400">No inspections recorded for this equipment.</p>
                ) : (
                  <div className="space-y-2">
                    {inspections.map((insp) => (
                      <div key={insp.id} className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs flex justify-between items-center">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100 uppercase">{insp.inspection_type.replace(/_/g, " ")}</p>
                          <p className="text-slate-500">Date: {insp.scheduled_date} | Result: <span className="font-semibold">{insp.result}</span></p>
                          {insp.is_verified ? (
                            <span className="text-emerald-600 font-bold flex items-center gap-1 mt-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Certified & Verified
                            </span>
                          ) : (
                            <span className="text-amber-600 font-semibold mt-1 block">Awaiting Verification</span>
                          )}
                        </div>
                        {!insp.is_verified && (
                          <button
                            onClick={() => handleVerifyInspection(insp.id)}
                            className="px-2.5 py-1.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 font-medium hover:bg-indigo-100"
                          >
                            {t.verifyInspection}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Warranty */}
            {activeTab === "warranty" && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">{t.warrantyTitle}</h3>
                {selectedAsset.warranty ? (
                  <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1">
                    <p className="font-bold text-slate-800 dark:text-slate-200">Status: {selectedAsset.warranty.status}</p>
                    <p className="text-slate-500">Period: {selectedAsset.warranty.starts_on} to {selectedAsset.warranty.ends_on}</p>
                    {selectedAsset.warranty.warranty_terms && (
                      <p className="text-slate-600 dark:text-slate-400 mt-2">Terms: {selectedAsset.warranty.warranty_terms}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No active commercial warranty registered for this equipment.</p>
                )}

                <div className="pt-2">
                  <h4 className="font-bold text-xs text-slate-700 dark:text-slate-300 mb-2">Warranty Claims History</h4>
                  {warrantyClaims.length === 0 ? (
                    <p className="text-xs text-slate-400">No warranty claims filed.</p>
                  ) : (
                    <div className="space-y-2">
                      {warrantyClaims.map((c) => (
                        <div key={c.id} className="p-2.5 rounded border border-slate-200 dark:border-slate-800 text-xs">
                          <span className="font-bold text-indigo-600">{c.claim_reference}</span> - {c.description}
                          <p className="text-slate-500 mt-1">Status: {c.resolution_status}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Decommission */}
            {activeTab === "decommission" && (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">{t.decommissionTitle}</h3>
                {selectedAsset.lifecycle_status === "decommissioned" ? (
                  <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 text-xs text-purple-700">
                    This equipment is permanently decommissioned and immutable.
                  </div>
                ) : selectedAsset.lifecycle_status === "decommission_pending" ? (
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-xs text-amber-800 space-y-2">
                    <p className="font-bold">Decommission Request Pending Independent Approval</p>
                    <p>Safety-critical equipment requires dual-control independent approval with AAL2 elevation.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">
                      Formal decommission retires equipment from active service. Requires dual-control signoff for safety-critical assets.
                    </p>
                    <button
                      onClick={() => setShowDecomModal(true)}
                      className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs"
                    >
                      {t.requestDecommission}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Start Downtime Modal */}
      {showDowntimeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.startDowntime}</h3>
            <textarea
              placeholder="Reason for downtime (e.g., motor trip, emergency inspection)..."
              value={downtimeReason}
              onChange={(e) => setDowntimeReason(e.target.value)}
              className="w-full p-3 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 h-24"
            />
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <input
                type="checkbox"
                checked={downtimePlanned}
                onChange={(e) => setDowntimePlanned(e.target.checked)}
                className="rounded"
              />
              Planned Maintenance Downtime
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDowntimeModal(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleStartDowntime}
                className="px-3 py-1.5 text-xs rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium"
              >
                Confirm Downtime
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Inspection Modal */}
      {showInspectionModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.recordInspection}</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 mb-1">Inspection Type</label>
                <input
                  type="text"
                  value={inspType}
                  onChange={(e) => setInspType(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Scheduled / Performed Date</label>
                <input
                  type="date"
                  value={inspDate}
                  onChange={(e) => setInspDate(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Result</label>
                <select
                  value={inspResult}
                  onChange={(e) => setInspResult(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                >
                  <option value="passed">Passed</option>
                  <option value="passed_with_observations">Passed with observations</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-500 mb-1">Inspector Name / Organization</label>
                <input
                  type="text"
                  value={inspInspector}
                  onChange={(e) => setInspInspector(e.target.value)}
                  className="w-full p-2 rounded border border-slate-300 dark:border-slate-700 bg-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowInspectionModal(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordInspection}
                className="px-3 py-1.5 text-xs rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
              >
                Save Inspection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Decommission Modal */}
      {showDecomModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl border border-slate-200 dark:border-slate-800">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{t.requestDecommission}</h3>
            <p className="text-xs text-slate-500">
              This will request formal decommissioning. For safety-critical assets, an independent approver with AAL2 elevation must certify the decommission.
            </p>
            <textarea
              placeholder="Detailed justification for decommissioning equipment..."
              value={decomReason}
              onChange={(e) => setDecomReason(e.target.value)}
              className="w-full p-3 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent text-slate-900 dark:text-slate-100 h-24"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDecomModal(false)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRequestDecommission}
                className="px-3 py-1.5 text-xs rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium"
              >
                Submit Decommission Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
