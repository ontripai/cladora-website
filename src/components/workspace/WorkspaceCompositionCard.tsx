'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Loader2,
  AlertCircle,
  Boxes,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  Power,
  PowerOff,
  Clock,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import type { WorkspaceCompositionResponse, ModuleItem } from '@/lib/customer/workspace-composition-schema';

export interface WorkspaceCompositionCardProps {
  contextId?: string;
  lang: 'ro' | 'en' | 'fa';
  canManage?: boolean;
  className?: string;
}

const DICTIONARY = {
  ro: {
    title: 'Compoziție Dinamică și Module Workspace',
    subtitle: 'Gestiunea server-authoritative a modulelor active, dependențelor și abonamentelor',
    loading: 'Se încarcă configurația modulelor workspace-ului…',
    error: 'Nu s-au putut încărca datele compoziției workspace-ului.',
    bindingRequired: 'Workspace-ul nu este asociat unui imobil sau necesită configurare inițială.',
    installedModules: 'Module Instalate și Active',
    availableCatalog: 'Catalog Module Disponibile',
    activateButton: 'Activează Modul',
    deactivateButton: 'Dezactivează',
    activating: 'Se activează…',
    deactivating: 'Se dezactivează…',
    deactivateModalTitle: 'Confirmare Dezactivare Modul',
    deactivateReasonLabel: 'Motiv dezactivare (minim 5 caractere)',
    deactivateReasonPlaceholder: 'ex. Înlocuire flux operațional sau decizie administrativă...',
    confirmDeactivate: 'Confirmă Dezactivarea',
    cancel: 'Anulează',
    mfaNotice: 'Modul sensibil: Necesită Autentificare cu Doi Factori (AAL2)',
    mfaStepUp: 'Mergi la pagina MFA',
    statusActive: 'Activ',
    statusNotInstalled: 'Disponibil',
    statusSuspendedUnentitled: 'Suspendat (Abonament Expirat)',
    statusUnentitled: 'Fără Abonament',
    statusTaxonomyRequired: 'Necesită Asociere Taxonomie',
    statusRuleMissing: 'Regulă Compatibilitate Lipsă',
    statusReviewRequired: 'Necesită Revizuire Manuală',
    statusIncompatible: 'Incompatibil',
    statusCatalogOnly: 'În Curând',
    categoryFinancial: 'Financiar & Contabilitate',
    categoryOperations: 'Operațiuni & Mentenanță',
    categoryOccupancy: 'Ocupare & Rezidenți',
    categoryGovernance: 'Guvernanță & Statut',
    categorySecurity: 'Securitate & Acces',
    categoryCore: 'Infrastructură Core',
    categoryServices: 'Servicii',
    categoryInvestment: 'Investiții',
    versionBadge: (v: number) => `v${v}.0`,
    concurrencyConflict: 'Starea modulului a fost modificată de alt utilizator. Pagina a fost reîncărcată.',
  },
  en: {
    title: 'Dynamic Workspace Composition & Modules',
    subtitle: 'Server-authoritative activation, dependency DAG, and subscription enforcement',
    loading: 'Loading workspace modules composition…',
    error: 'Failed to load workspace composition data.',
    bindingRequired: 'Workspace is not bound to a property or requires taxonomy setup.',
    installedModules: 'Installed & Active Modules',
    availableCatalog: 'Available Modules Catalog',
    activateButton: 'Activate Module',
    deactivateButton: 'Deactivate',
    activating: 'Activating…',
    deactivating: 'Deactivating…',
    deactivateModalTitle: 'Confirm Module Deactivation',
    deactivateReasonLabel: 'Deactivation rationale (minimum 5 characters)',
    deactivateReasonPlaceholder: 'e.g. Operational workflow migration or board resolution...',
    confirmDeactivate: 'Confirm Deactivation',
    cancel: 'Cancel',
    mfaNotice: 'Sensitive module: Two-Factor Authentication (AAL2) required',
    mfaStepUp: 'Go to MFA Step-up',
    statusActive: 'Active',
    statusNotInstalled: 'Available',
    statusSuspendedUnentitled: 'Suspended (Subscription Expired)',
    statusUnentitled: 'Entitlement Required',
    statusTaxonomyRequired: 'Taxonomy Required',
    statusRuleMissing: 'Compatibility Rule Missing',
    statusReviewRequired: 'Manual Review Required',
    statusIncompatible: 'Incompatible',
    statusCatalogOnly: 'Coming Soon',
    categoryFinancial: 'Financial & Accounting',
    categoryOperations: 'Operations & Maintenance',
    categoryOccupancy: 'Occupancy & Residents',
    categoryGovernance: 'Governance & Statutory',
    categorySecurity: 'Security & Access',
    categoryCore: 'Core Foundation',
    categoryServices: 'Services',
    categoryInvestment: 'Investment',
    versionBadge: (v: number) => `v${v}.0`,
    concurrencyConflict: 'Module state changed concurrently. The view has been refreshed.',
  },
  fa: {
    title: 'ترکیب پویا و ماژول‌های فعال فضای کاری',
    subtitle: 'مدیریت قطعی و سرور-محور ماژول‌ها، گراف وابستگی‌ها و کنترل اشتراک‌ها',
    loading: 'در حال بارگذاری ماژول‌های فضای کاری…',
    error: 'بارگذاری اطلاعات ترکیب ماژول‌های فضای کاری ناموفق بود.',
    bindingRequired: 'فضای کاری به ملکی متصل نیست یا نیازمند پیکربندی اولیه است.',
    installedModules: 'ماژول‌های نصب‌شده و فعال',
    availableCatalog: 'کاتالوگ ماژول‌های در دسترس',
    activateButton: 'فعال‌سازی ماژول',
    deactivateButton: 'غیرفعال‌سازی',
    activating: 'در حال فعال‌سازی…',
    deactivating: 'در حال غیرفعال‌سازی…',
    deactivateModalTitle: 'تأیید غیرفعال‌سازی ماژول',
    deactivateReasonLabel: 'علت غیرفعال‌سازی (حداقل ۵ حرف)',
    deactivateReasonPlaceholder: 'مثال: تغییر فرایند اجرایی یا مصوبه مجمع...',
    confirmDeactivate: 'تأیید غیرفعال‌سازی',
    cancel: 'انصراف',
    mfaNotice: 'ماژول حساس: نیازمند احراز هویت دومرحله‌ای (AAL2)',
    mfaStepUp: 'ورود به صفحه MFA',
    statusActive: 'فعال',
    statusNotInstalled: 'قابل نصب',
    statusSuspendedUnentitled: 'معلق (اشتراک منقضی)',
    statusUnentitled: 'نیازمند اشتراک',
    statusTaxonomyRequired: 'نیازمند انتساب تاکسونومی',
    statusRuleMissing: 'نبود قانون سازگاری',
    statusReviewRequired: 'نیازمند بررسی دستی',
    statusIncompatible: 'ناسازگار با الگوی فعلی',
    statusCatalogOnly: 'به‌زودی',
    categoryFinancial: 'مالی و حسابداری',
    categoryOperations: 'عملیات و نگهداری',
    categoryOccupancy: 'سکونت و ساکنان',
    categoryGovernance: 'حاکمیت و مصوبات',
    categorySecurity: 'امنیت و دسترسی',
    categoryCore: 'زیرساخت پایه',
    categoryServices: 'خدمات',
    categoryInvestment: 'سرمایه‌گذاری',
    versionBadge: (v: number) => `نسخه ${v}`,
    concurrencyConflict: 'وضعیت ماژول توسط کاربر دیگری تغییر یافته است. صفحه به‌روزرسانی شد.',
  },
} as const;

export function WorkspaceCompositionCard({
  contextId,
  lang,
  canManage = false,
  className = '',
}: WorkspaceCompositionCardProps) {
  const t = DICTIONARY[lang] ?? DICTIONARY.ro;
  const isRtl = lang === 'fa';

  const [data, setData] = useState<WorkspaceCompositionResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Mutation state
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Deactivate modal state
  const [deactivatingModule, setDeactivatingModule] = useState<ModuleItem | null>(null);
  const [deactivateReason, setDeactivateReason] = useState<string>('');

  const fetchComposition = useCallback(async () => {
    if (!contextId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/customer/v1/workspace/composition?context_id=${encodeURIComponent(contextId)}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || t.error);
      }

      const json = await res.json();
      setData(json.data);
    } catch (err: any) {
      setError(err?.message || t.error);
    } finally {
      setLoading(false);
    }
  }, [contextId, t.error]);

  useEffect(() => {
    if (contextId) {
      const timer = setTimeout(() => void fetchComposition(), 0);
      return () => clearTimeout(timer);
    }
  }, [contextId, fetchComposition]);

  const handleActivate = async (mod: ModuleItem) => {
    if (!contextId || !canManage) return;

    try {
      setActionLoadingId(mod.module_definition_id);
      setActionError(null);

      const res = await fetch('/api/customer/v1/workspace/modules/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: contextId,
          module_definition_id: mod.module_definition_id,
          expected_workspace_module_id: null,
          config_json: {},
          idempotency_key: `act-${crypto.randomUUID()}`,
          reason: `Activated via dashboard by customer admin`,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setActionError(t.concurrencyConflict);
          await fetchComposition();
          return;
        }
        throw new Error(errJson?.error?.message || 'Failed to activate module');
      }

      await fetchComposition();
    } catch (err: any) {
      setActionError(err?.message || 'Activation failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeactivate = async () => {
    if (!contextId || !canManage || !deactivatingModule?.workspace_module_id) return;
    if (deactivateReason.trim().length < 5) return;

    try {
      setActionLoadingId(deactivatingModule.module_definition_id);
      setActionError(null);

      const res = await fetch('/api/customer/v1/workspace/modules/deactivate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context_id: contextId,
          expected_workspace_module_id: deactivatingModule.workspace_module_id,
          idempotency_key: `deact-${crypto.randomUUID()}`,
          reason: deactivateReason.trim(),
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        if (res.status === 409) {
          setActionError(t.concurrencyConflict);
          await fetchComposition();
          setDeactivatingModule(null);
          return;
        }
        throw new Error(errJson?.error?.message || 'Failed to deactivate module');
      }

      setDeactivatingModule(null);
      setDeactivateReason('');
      await fetchComposition();
    } catch (err: any) {
      setActionError(err?.message || 'Deactivation failed');
    } finally {
      setActionLoadingId(null);
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'financial': return t.categoryFinancial;
      case 'operations': return t.categoryOperations;
      case 'occupancy': return t.categoryOccupancy;
      case 'governance': return t.categoryGovernance;
      case 'security': return t.categorySecurity;
      case 'core': return t.categoryCore;
      case 'services': return t.categoryServices;
      case 'investment': return t.categoryInvestment;
      default: return category;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {t.statusActive}
          </span>
        );
      case 'suspended_unentitled':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t.statusSuspendedUnentitled}
          </span>
        );
      case 'unentitled':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700 border border-orange-200">
            <AlertCircle className="h-3.5 w-3.5" />
            {t.statusUnentitled}
          </span>
        );
      case 'taxonomy_required':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t.statusTaxonomyRequired}
          </span>
        );
      case 'rule_missing':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
            <AlertCircle className="h-3.5 w-3.5" />
            {t.statusRuleMissing}
          </span>
        );
      case 'review_required':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-200">
            <AlertCircle className="h-3.5 w-3.5" />
            {t.statusReviewRequired}
          </span>
        );
      case 'incompatible':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-700 border border-red-200">
            <ShieldAlert className="h-3.5 w-3.5" />
            {t.statusIncompatible}
          </span>
        );
      case 'catalog_only':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
            <Sparkles className="h-3.5 w-3.5" />
            {t.statusCatalogOnly}
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-50 px-2.5 py-0.5 text-xs font-semibold text-slate-600 border border-slate-200">
            <Clock className="h-3.5 w-3.5" />
            {t.statusNotInstalled}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
        <div className="flex items-center justify-center gap-3 py-8 text-sm font-semibold text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#0E9F8E]" />
          <span>{t.loading}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-800 shadow-sm ${className}`}>
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (!data || data.status === 'binding_required') {
    return (
      <div className={`rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900 shadow-sm ${className}`}>
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <span>{t.bindingRequired}</span>
        </div>
      </div>
    );
  }

  const installedModules = data.modules.filter((m) => m.is_installed);
  const catalogModules = data.modules.filter((m) => !m.is_installed);

  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`} dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0E9F8E]/10 text-[#0E9F8E]">
            <Boxes className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">{t.title}</h2>
            <p className="text-xs text-slate-500">{t.subtitle}</p>
          </div>
        </div>

        {data.profile && (
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
              {data.profile.name}
            </span>
            {data.operating_model && (
              <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
                {data.operating_model.name}
              </span>
            )}
          </div>
        )}
      </div>

      {actionError && (
        <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Section 1: Active Installed Modules */}
      <div className="mb-8">
        <h3 className="mb-4 text-sm font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {t.installedModules} ({installedModules.length})
        </h3>

        {installedModules.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No modules currently installed.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {installedModules.map((mod) => (
              <div
                key={mod.module_definition_id}
                className="relative flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition-all hover:border-[#0E9F8E]/30 hover:shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                      {getCategoryLabel(mod.category)}
                    </span>
                    {getStatusBadge(mod.status)}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">
                    {mod.labels[lang] || mod.name}
                  </h4>
                  <p className="text-xs text-slate-500 mb-3 line-clamp-2">
                    {mod.code}
                  </p>
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-slate-200/60 pt-3">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {t.versionBadge(mod.version)}
                  </span>

                  {canManage && mod.can_deactivate && (
                    <button
                      type="button"
                      disabled={actionLoadingId === mod.module_definition_id}
                      onClick={() => setDeactivatingModule(mod)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600 shadow-sm transition hover:bg-red-50 disabled:opacity-50"
                    >
                      <PowerOff className="h-3 w-3" />
                      {t.deactivateButton}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Available Catalog */}
      <div>
        <h3 className="mb-4 text-sm font-bold tracking-tight text-slate-800 flex items-center gap-2">
          <Boxes className="h-4 w-4 text-slate-500" />
          {t.availableCatalog} ({catalogModules.length})
        </h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {catalogModules.map((mod) => {
            const isLoading = actionLoadingId === mod.module_definition_id;
            return (
              <div
                key={mod.module_definition_id}
                className="relative flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-[#0E9F8E]/40 hover:shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">
                      {getCategoryLabel(mod.category)}
                    </span>
                    {getStatusBadge(mod.status)}
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 mb-1">
                    {mod.labels[lang] || mod.name}
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">
                    {mod.code}
                  </p>

                  {mod.requires_aal2 && (
                    <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-amber-50/80 p-2 text-[11px] font-semibold text-amber-800">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                      <span>{t.mfaNotice}</span>
                    </div>
                  )}
                </div>

                <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[11px] font-semibold text-slate-400">
                    {t.versionBadge(mod.version)}
                  </span>

                  {canManage && mod.can_activate && mod.is_compatible && (
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => handleActivate(mod)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E9F8E] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0C8A7B] disabled:opacity-50"
                    >
                      {isLoading ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Power className="h-3 w-3" />
                      )}
                      {isLoading ? t.activating : t.activateButton}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deactivate Confirmation Modal */}
      {deactivatingModule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              {t.deactivateModalTitle}: {deactivatingModule.labels[lang] || deactivatingModule.name}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Module: <code className="text-[#0E9F8E] font-semibold">{deactivatingModule.code}</code>
            </p>

            <div className="mb-5">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t.deactivateReasonLabel}
              </label>
              <textarea
                rows={3}
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder={t.deactivateReasonPlaceholder}
                className="w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-[#0E9F8E] focus:outline-none focus:ring-1 focus:ring-[#0E9F8E]"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={actionLoadingId === deactivatingModule.module_definition_id}
                onClick={() => setDeactivatingModule(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                disabled={deactivateReason.trim().length < 5 || actionLoadingId === deactivatingModule.module_definition_id}
                onClick={handleDeactivate}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoadingId === deactivatingModule.module_definition_id && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                )}
                {t.confirmDeactivate}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
