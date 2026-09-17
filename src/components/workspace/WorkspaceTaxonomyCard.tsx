'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Layers, CheckCircle2, ShieldAlert, ArrowRight, Settings, ShieldCheck, ExternalLink } from 'lucide-react';
import type { WorkspaceTaxonomyResponse, TaxonomyCatalogOptionsResponse } from '@/lib/customer/workspace-taxonomy-schema';

export interface WorkspaceTaxonomyCardProps {
  taxonomy?: WorkspaceTaxonomyResponse | null;
  contextId?: string;
  lang: 'ro' | 'en' | 'fa';
  canManage?: boolean;
  countryCode?: string;
  className?: string;
}

const DICTIONARY = {
  ro: {
    title: 'Clasificare și Topologie Workspace',
    unclassified: 'Neclasificat / În așteptare revizuire',
    notConfigured: 'Clasificarea workspace-ului nu este încă configurată.',
    notConfiguredBadge: 'Neconfigurat',
    activeStatus: 'Activ',
    propertyProfile: 'Profil Proprietate',
    operatingModel: 'Model Operațional',
    countryCodeLabel: 'Cod Țară (ISO 3166-1 alpha-2)',
    countryCodePlaceholder: 'ex. RO, DE, FR',
    countryCodeRequired: 'Codul de țară (2 litere majuscule) este obligatoriu.',
    version: 'Versiune',
    allowedSpaceKinds: 'Tipuri de Spații Compatibile',
    effectivePeriod: 'Perioadă de valabilitate',
    from: 'Din',
    indefinite: 'Nedeterminată',
    noSpaceKinds: 'Niciun spațiu configurat',
    noAssignmentDesc: 'Acest workspace nu are o clasificare universală activă asignată.',
    loading: 'Se încarcă datele de clasificare a workspace-ului…',
    error: 'Nu s-au putut încărca datele de topologie ale workspace-ului.',
    editButton: 'Modifică Clasificarea',
    cancelButton: 'Anulează',
    confirmButton: 'Confirmă Tranziția',
    selectProfile: 'Selectează Profilul',
    selectModel: 'Selectează Modelul Operațional',
    compatibilityLabel: 'Compatibilitate Arhitecturală',
    compatCompatible: 'Compatibil',
    compatReview: 'Necesită Revizuire și Justificare',
    compatIncompatible: 'Incompatibil (Blocat)',
    reasonLabel: 'Justificare Tranziție (Obligatorie)',
    reasonPlaceholder: 'Introduceți motivul tranziției sau referința deciziei de administrare...',
    saving: 'Se procesează tranziția…',
    successMessage: 'Tranziția taxonomiei workspace-ului a fost realizată cu succes.',
    mfaRequiredMessage: 'Este necesară autentificarea cu doi factori (AAL2) pentru această operațiune.',
    mfaButton: 'Autentificare cu doi factori (AAL2 / TOTP)',
    conflictMessage: 'Clasificarea workspace-ului a fost modificată concurent. Vă rugăm să reîncărcați pagina.',
    optionsLoading: 'Se încarcă opțiunile de catalog…',
  },
  en: {
    title: 'Workspace Taxonomy & Classification',
    unclassified: 'Unclassified / Pending Review',
    notConfigured: 'Workspace classification is not configured yet.',
    notConfiguredBadge: 'Unconfigured',
    activeStatus: 'Active',
    propertyProfile: 'Property Profile',
    operatingModel: 'Operating Model',
    countryCodeLabel: 'Country Code (ISO 3166-1 alpha-2)',
    countryCodePlaceholder: 'e.g. RO, DE, US',
    countryCodeRequired: 'Country code (2 uppercase letters) is required.',
    version: 'Version',
    allowedSpaceKinds: 'Compatible Space Kinds',
    effectivePeriod: 'Effective Period',
    from: 'From',
    indefinite: 'Indefinite',
    noSpaceKinds: 'No space kinds configured',
    noAssignmentDesc: 'This workspace does not currently have an active universal classification assigned.',
    loading: 'Loading workspace classification…',
    error: 'Failed to load workspace taxonomy classification.',
    editButton: 'Manage Classification',
    cancelButton: 'Cancel',
    confirmButton: 'Confirm Transition',
    selectProfile: 'Select Property Profile',
    selectModel: 'Select Operating Model',
    compatibilityLabel: 'Architectural Compatibility',
    compatCompatible: 'Compatible',
    compatReview: 'Review Required (Reason Mandatory)',
    compatIncompatible: 'Incompatible (Blocked)',
    reasonLabel: 'Transition Reason (Mandatory)',
    reasonPlaceholder: 'Enter the rationale for this change or association board approval reference...',
    saving: 'Executing transition…',
    successMessage: 'Workspace taxonomy transition applied successfully.',
    mfaRequiredMessage: 'Two-factor authentication (AAL2) is required for this operation.',
    mfaButton: 'Authenticate with Two-Factor (AAL2 / TOTP)',
    conflictMessage: 'Workspace taxonomy was modified concurrently. Please reload the page.',
    optionsLoading: 'Loading catalog options…',
  },
  fa: {
    title: 'طبقه‌بندی و توپولوژی فضای کاری',
    unclassified: 'طبقه‌بندی‌نشده / در انتظار بازبینی',
    notConfigured: 'طبقه‌بندی فضای کاری هنوز تنظیم نشده است.',
    notConfiguredBadge: 'تنظیم‌نشده',
    activeStatus: 'فعال',
    propertyProfile: 'پروفایل محیطی ملک',
    operatingModel: 'مدل عملیاتی و اختیارات',
    countryCodeLabel: 'کد کشور (ISO 3166-1 alpha-2)',
    countryCodePlaceholder: 'مثال: RO, DE, US',
    countryCodeRequired: 'کد کشور (۲ حرف بزرگ لاتین) الزامی است.',
    version: 'نسخه',
    allowedSpaceKinds: 'انواع فضاهای مجاز و سازگار',
    effectivePeriod: 'بازه زمانی مؤثر',
    from: 'از تاریخ',
    indefinite: 'نامحدود',
    noSpaceKinds: 'هیچ نوع فضایی پیکربندی نشده است',
    noAssignmentDesc: 'این فضای کاری در حال حاضر فاقد تخصیص طبقه‌بندی جامع فعال است.',
    loading: 'در حال بارگذاری طبقه‌بندی و توپولوژی فضای کاری…',
    error: 'بارگذاری اطلاعات طبقه‌بندی فضای کاری با خطا مواجه شد.',
    editButton: 'تغییر یا ارتقای طبقه‌بندی',
    cancelButton: 'انصراف',
    confirmButton: 'تأیید و اجرای انتقال',
    selectProfile: 'انتخاب پروفایل محیطی ملک',
    selectModel: 'انتخاب مدل عملیاتی و اختیارات',
    compatibilityLabel: 'سازگاری معماری',
    compatCompatible: 'سازگار و معتبر',
    compatReview: 'نیازمند بررسی و ثبت دلیل',
    compatIncompatible: 'ناسازگار (غیرقابل اعمال)',
    reasonLabel: 'دلیل و مبنای انتقال (الزامی)',
    reasonPlaceholder: 'علت انتقال نسخه یا مصوبه هیئت‌مدیره را وارد نمایید...',
    saving: 'در حال اعمال تغییرات...',
    successMessage: 'انتقال نسخه طبقه‌بندی فضای کاری با موفقیت انجام شد.',
    mfaRequiredMessage: 'برای انجام این عملیات احراز هویت دو مرحله‌ای (AAL2) الزامی است.',
    mfaButton: 'احراز هویت دو مرحله‌ای (AAL2 / TOTP)',
    conflictMessage: 'نسخه طبقه‌بندی همزمان توسط کاربر دیگری تغییر یافته است. لطفاً صفحه را تازه‌سازی کنید.',
    optionsLoading: 'در حال بارگذاری گزینه‌های کاتالوگ…',
  },
};

export function WorkspaceTaxonomyCard({
  taxonomy: initialTaxonomy,
  contextId,
  lang,
  canManage = false,
  countryCode = '',
  className = '',
}: WorkspaceTaxonomyCardProps) {
  const dict = DICTIONARY[lang] || DICTIONARY.ro;
  const isRtl = lang === 'fa';

  const [fetchedTaxonomy, setFetchedTaxonomy] = useState<WorkspaceTaxonomyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(!initialTaxonomy && !!contextId);
  const [error, setError] = useState<string | null>(null);

  // Management / Mutation states
  const [isEditing, setIsEditing] = useState(false);
  const [catalogOptions, setCatalogOptions] = useState<TaxonomyCatalogOptionsResponse | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [selectedCountry, setSelectedCountry] = useState<string>(countryCode || '');
  const [reason, setReason] = useState<string>('');
  const [mutationLoading, setMutationLoading] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
  const [mfaRedirectRequired, setMfaRedirectRequired] = useState(false);
  const [mutationSuccess, setMutationSuccess] = useState(false);

  const taxonomy = fetchedTaxonomy ?? initialTaxonomy;

  const load = React.useCallback(async () => {
    if (!contextId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/customer/v1/workspace/taxonomy?context_id=${encodeURIComponent(contextId)}`,
        { headers: { 'Cache-Control': 'no-cache' } }
      );
      if (res.status === 409) {
        setFetchedTaxonomy({
          has_assignment: false,
          status: 'binding_required',
          workspace_id: null,
        });
        return;
      }
      if (!res.ok) throw new Error('Request failed');
      const body = await res.json();
      setFetchedTaxonomy(body.data ?? body);
    } catch {
      setError(dict.error);
    } finally {
      setLoading(false);
    }
  }, [contextId, dict.error]);

  useEffect(() => {
    if (!initialTaxonomy && contextId) {
      const timer = setTimeout(() => void load(), 0);
      return () => clearTimeout(timer);
    }
  }, [contextId, initialTaxonomy, load]);

  const loadCatalogOptions = async () => {
    if (!contextId) return;
    setLoadingOptions(true);
    try {
      const res = await fetch(
        `/api/customer/v1/workspace/taxonomy/options?context_id=${encodeURIComponent(contextId)}`,
        { headers: { 'Cache-Control': 'no-cache' } }
      );
      if (!res.ok) throw new Error('Failed to load options');
      const json = await res.json();
      setCatalogOptions(json.data);
      if (json.data?.profiles?.length > 0 && !selectedProfile) {
        setSelectedProfile(taxonomy?.profile?.code || json.data.profiles[0].code);
      }
      if (json.data?.operating_models?.length > 0 && !selectedModel) {
        setSelectedModel(taxonomy?.operating_model?.code || json.data.operating_models[0].code);
      }
      if (taxonomy?.country_code && !selectedCountry) {
        setSelectedCountry(taxonomy.country_code);
      }
    } catch {
      setMutationError(dict.error);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleOpenEdit = () => {
    setIsEditing(true);
    setMutationError(null);
    setMfaRedirectRequired(false);
    void loadCatalogOptions();
  };

  // Server-authoritative compatibility: zero fallback to compatible!
  const compatMatch = catalogOptions?.compatibilities.find(
    (c) => c.profile_code === selectedProfile && c.operating_model_code === selectedModel
  );
  const compatStatus: 'compatible' | 'review_required' | 'incompatible' | null =
    selectedProfile && selectedModel
      ? compatMatch ? compatMatch.compatibility_level : 'incompatible'
      : null;

  const isReviewRequired = compatStatus === 'review_required';
  const isIncompatible = compatStatus === 'incompatible';

  const handleMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCountry = selectedCountry.trim().toUpperCase();
    if (!contextId || !selectedProfile || !selectedModel || isIncompatible) return;

    if (!cleanCountry || !/^[A-Z]{2}$/.test(cleanCountry)) {
      setMutationError(dict.countryCodeRequired);
      return;
    }

    if (isReviewRequired && !reason.trim()) {
      setMutationError(dict.reasonLabel);
      return;
    }

    setMutationLoading(true);
    setMutationError(null);
    setMfaRedirectRequired(false);
    setMutationSuccess(false);

    try {
      const idempotencyKey = crypto.randomUUID();
      const res = await fetch('/api/customer/v1/workspace/taxonomy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          context_id: contextId,
          property_profile_code: selectedProfile,
          operating_model_code: selectedModel,
          country_code: cleanCountry,
          idempotency_key: idempotencyKey,
          expected_assignment_id: taxonomy?.assignment_id ?? null,
          reason: reason.trim() || null,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        if (body.error?.code === 'MFA_REQUIRED') {
          setMutationError(dict.mfaRequiredMessage);
          setMfaRedirectRequired(true);
        } else if (body.error?.code === 'EXPECTED_ASSIGNMENT_CONFLICT') {
          setMutationError(dict.conflictMessage);
        } else {
          setMutationError(body.error?.message || dict.error);
        }
        return;
      }

      setMutationSuccess(true);
      setIsEditing(false);
      await load();
    } catch {
      setMutationError(dict.error);
    } finally {
      setMutationLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        role="status"
        aria-live="polite"
        className={`rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm ${className}`}
      >
        <div className="flex items-center gap-3 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-[#0E9F8E]" />
          <span className="text-sm">{dict.loading}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        role="alert"
        className={`rounded-2xl border border-red-200 bg-red-50/50 p-6 text-red-700 shadow-sm ${className}`}
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      </div>
    );
  }

  const profile = taxonomy?.profile;
  const operatingModel = taxonomy?.operating_model;
  const hasAssignment = Boolean(taxonomy?.has_assignment && profile && operatingModel);
  const isUnbound = taxonomy?.status === 'binding_required' || !taxonomy?.workspace_id;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#EAF8F5] p-2.5 text-[#0E9F8E]">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#102A43]">{dict.title}</h2>
            <p className="text-xs text-[#52667A]">
              {hasAssignment
                ? `${profile?.name} · ${operatingModel?.name}`
                : isUnbound
                ? dict.notConfigured
                : dict.unclassified}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasAssignment ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {dict.activeStatus}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              <ShieldAlert className="h-3.5 w-3.5" />
              {dict.notConfiguredBadge}
            </span>
          )}

          {/* Management Trigger Button (Authoritative canManage) */}
          {canManage && !isEditing && (
            <button
              type="button"
              onClick={handleOpenEdit}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#0E9F8E] bg-[#EAF8F5] px-3 py-1.5 text-xs font-bold text-[#0E9F8E] transition-colors hover:bg-[#0E9F8E] hover:text-white"
            >
              <Settings className="h-3.5 w-3.5" />
              {dict.editButton}
            </button>
          )}
        </div>
      </div>

      {/* Mutation Success Notification */}
      {mutationSuccess && (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{dict.successMessage}</span>
        </div>
      )}

      {/* Edit Form Mode */}
      {isEditing ? (
        <form onSubmit={handleMutation} className="mt-6 space-y-4">
          {loadingOptions ? (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-4">
              <Loader2 className="h-4 w-4 animate-spin text-[#0E9F8E]" />
              <span>{dict.optionsLoading}</span>
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                {/* Property Profile Selector */}
                <div>
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    {dict.selectProfile}
                  </label>
                  <select
                    value={selectedProfile}
                    onChange={(e) => setSelectedProfile(e.target.value)}
                    disabled={mutationLoading}
                    className="w-full rounded-xl border border-[#CBD2D9] bg-white p-2.5 text-xs text-[#102A43] focus:border-[#0E9F8E] focus:outline-none"
                  >
                    {catalogOptions?.profiles.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.labels?.[lang] || p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Operating Model Selector */}
                <div>
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    {dict.selectModel}
                  </label>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={mutationLoading}
                    className="w-full rounded-xl border border-[#CBD2D9] bg-white p-2.5 text-xs text-[#102A43] focus:border-[#0E9F8E] focus:outline-none"
                  >
                    {catalogOptions?.operating_models.map((m) => (
                      <option key={m.code} value={m.code}>
                        {m.labels?.[lang] || m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Country Code Input (No default RO, requires valid 2-letter uppercase) */}
              <div>
                <label className="block text-xs font-bold text-[#102A43] mb-1">
                  {dict.countryCodeLabel}
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value.toUpperCase())}
                  placeholder={dict.countryCodePlaceholder}
                  disabled={mutationLoading}
                  className="w-full max-w-xs rounded-xl border border-[#CBD2D9] bg-white p-2.5 text-xs uppercase tracking-wider font-mono text-[#102A43] focus:border-[#0E9F8E] focus:outline-none"
                />
              </div>

              {/* Live Architectural Compatibility Banner */}
              {compatStatus && (
                <div
                  className={`rounded-xl border p-3 text-xs flex items-center justify-between ${
                    compatStatus === 'compatible'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : compatStatus === 'review_required'
                      ? 'border-amber-200 bg-amber-50 text-amber-800'
                      : 'border-red-200 bg-red-50 text-red-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {compatStatus === 'compatible' ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 shrink-0" />
                    )}
                    <span className="font-bold">
                      {compatStatus === 'compatible'
                        ? dict.compatCompatible
                        : compatStatus === 'review_required'
                        ? dict.compatReview
                        : dict.compatIncompatible}
                    </span>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold opacity-80">
                    {dict.compatibilityLabel}
                  </span>
                </div>
              )}

              {/* Transition Reason (Mandatory when review_required) */}
              {isReviewRequired && (
                <div>
                  <label className="block text-xs font-bold text-[#102A43] mb-1">
                    {dict.reasonLabel}
                  </label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={dict.reasonPlaceholder}
                    disabled={mutationLoading}
                    className="w-full rounded-xl border border-[#CBD2D9] bg-white p-2.5 text-xs text-[#102A43] focus:border-[#0E9F8E] focus:outline-none"
                  />
                </div>
              )}

              {/* Mutation Error / MFA Elevation */}
              {mutationError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span className="font-medium">{mutationError}</span>
                  </div>
                  {mfaRedirectRequired && (
                    <div className="mt-2.5 pt-2.5 border-t border-red-200/60 flex items-center justify-between">
                      <span className="text-[11px] text-red-800 font-medium">
                        {dict.mfaRequiredMessage}
                      </span>
                      <a
                        href={`/${lang}/mfa?redirect=${encodeURIComponent(
                          typeof window !== 'undefined' ? window.location.href : ''
                        )}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#0E9F8E] px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#0B7F72] transition-colors"
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {dict.mfaButton}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              )}

              {/* Form Action Controls */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  disabled={mutationLoading}
                  className="rounded-xl border border-[#CBD2D9] px-4 py-2 text-xs font-bold text-[#52667A] hover:bg-[#F1F5F9] transition-colors"
                >
                  {dict.cancelButton}
                </button>
                <button
                  type="submit"
                  disabled={mutationLoading || isIncompatible || (isReviewRequired && !reason.trim())}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#0E9F8E] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#0B7F72] disabled:opacity-50 transition-colors"
                >
                  {mutationLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {dict.saving}
                    </>
                  ) : (
                    dict.confirmButton
                  )}
                </button>
              </div>
            </>
          )}
        </form>
      ) : (
        /* Read-Only View Mode */
        <div className="mt-6 space-y-4">
          {hasAssignment ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#52667A]">
                    {dict.propertyProfile}
                  </span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-sm font-bold text-[#102A43]">{profile?.name}</span>
                    <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                      v{profile?.version}
                    </span>
                  </div>
                  {profile?.description && (
                    <p className="mt-1 text-xs text-[#52667A] line-clamp-2">{profile.description}</p>
                  )}
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#52667A]">
                    {dict.operatingModel}
                  </span>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-sm font-bold text-[#102A43]">{operatingModel?.name}</span>
                    <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                      v{operatingModel?.version}
                    </span>
                  </div>
                  {operatingModel?.description && (
                    <p className="mt-1 text-xs text-[#52667A] line-clamp-2">{operatingModel.description}</p>
                  )}
                </div>
              </div>

              {/* Country Code & Effective Period */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#F1F5F9] pt-3 text-xs text-[#52667A]">
                <div>
                  <span className="font-medium">{dict.effectivePeriod}: </span>
                  <span className="font-bold text-[#102A43]">
                    {taxonomy?.valid_from ? new Date(taxonomy.valid_from).toLocaleDateString() : dict.from}
                  </span>
                  {' → '}
                  <span className="font-bold text-[#102A43]">
                    {taxonomy?.valid_to ? new Date(taxonomy.valid_to).toLocaleDateString() : dict.indefinite}
                  </span>
                </div>
                {taxonomy?.country_code && (
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
                      {dict.countryCodeLabel}:
                    </span>
                    <span className="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-[#102A43]">
                      {taxonomy.country_code}
                    </span>
                  </div>
                )}
              </div>

              {/* Space Kinds */}
              {taxonomy?.allowed_space_kinds && taxonomy.allowed_space_kinds.length > 0 && (
                <div className="border-t border-[#F1F5F9] pt-3">
                  <span className="text-[11px] font-bold text-[#102A43]">{dict.allowedSpaceKinds}</span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {taxonomy.allowed_space_kinds.map((sk) => (
                      <span
                        key={sk.id}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-2.5 py-1 text-[11px] font-medium text-[#102A43]"
                      >
                        <ArrowRight className="h-2.5 w-2.5 text-[#0E9F8E]" />
                        {sk.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-[#CBD2D9] p-4 text-center text-xs text-[#52667A]">
              <p>{dict.noAssignmentDesc}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
