'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Layers, CheckCircle2, ShieldAlert, ArrowRight, Settings } from 'lucide-react';
import type { WorkspaceTaxonomyResponse } from '@/lib/customer/workspace-taxonomy-schema';

export interface WorkspaceTaxonomyCardProps {
  taxonomy?: WorkspaceTaxonomyResponse | null;
  contextId?: string;
  lang: 'ro' | 'en' | 'fa';
  canManage?: boolean;
  countryCode?: string;
  className?: string;
}

const PROFILES_LIST = [
  { code: 'residential_condominium', ro: 'Condominiu rezidențial', en: 'Residential Condominium', fa: 'مجتمع آپارتمانی مسکونی' },
  { code: 'residential_complex', ro: 'Complex rezidențial', en: 'Residential Complex', fa: 'شهرک یا مجتمع بزرگ مسکونی' },
  { code: 'gated_villa_community', ro: 'Ansamblu rezidențial de vile', en: 'Gated Villa Community', fa: 'شهرک ویلایی محصور' },
  { code: 'single_villa', ro: 'Vilă individuală', en: 'Single Villa', fa: 'ویلای مستقل' },
  { code: 'small_landlord_portfolio', ro: 'Portofoliu proprietar individual', en: 'Small Landlord Portfolio', fa: 'پورتفولیوی مالک خرد' },
  { code: 'mixed_use_estate', ro: 'Complex cu funcțiuni mixte', en: 'Mixed-Use Estate', fa: 'مجتمع چندمنظوره / تجاری مسکونی' },
  { code: 'retail_centre', ro: 'Centru comercial / Mall', en: 'Retail Centre', fa: 'مرکز تجاری و فروشگاهی' },
  { code: 'office_centre', ro: 'Centru de birouri', en: 'Office Centre', fa: 'مجتمع اداری' },
  { code: 'warehouse_logistics', ro: 'Centru logistic și depozite', en: 'Warehouse & Logistics Centre', fa: 'مرکز لجستیک و انبارداری' },
  { code: 'managed_township', ro: 'District administrat / Township', en: 'Managed Township', fa: 'شهرک شهری مدیریت‌شده' },
  { code: 'industrial_park', ro: 'Parc industrial', en: 'Industrial Park', fa: 'پارک / منطقه صنعتی' },
  { code: 'serviced_residence', ro: 'Reședință cu servicii incluse', en: 'Serviced Residence', fa: 'اقامتگاه مبله / هتلی' },
  { code: 'standalone_parking', ro: 'Parcare autonomă administrată', en: 'Standalone Parking Facility', fa: 'پارکینگ طبقاتی یا مستقل' },
  { code: 'shared_facility', ro: 'Facilitate comună administrată', en: 'Shared Facility', fa: 'مرکز خدمات و امکانات مشترک' },
  { code: 'developer_portfolio', ro: 'Portofoliu dezvoltator', en: 'Developer Portfolio', fa: 'پورتفولیوی توسعه‌دهنده' },
  { code: 'third_party_management_portfolio', ro: 'Portofoliu administrare terță', en: 'Third-Party Management Portfolio', fa: 'پورتفولیوی مدیریت قراردادهای ثالث' },
];

const MODELS_LIST = [
  { code: 'association_managed', ro: 'Administrare prin Asociație de Proprietari', en: 'Owners Association Managed', fa: 'مدیریت هیئت مدیره / انجمن مالکان' },
  { code: 'single_owner_operated', ro: 'Operat de proprietar unic', en: 'Single Owner Operated', fa: 'بهره‌برداری توسط تک مالک' },
  { code: 'developer_operated', ro: 'Operat de dezvoltator', en: 'Developer Operated', fa: 'بهره‌برداری مستقیم توسعه‌دهنده' },
  { code: 'third_party_managed', ro: 'Administrare prin companie de property management', en: 'Third-Party Contract Managed', fa: 'مدیریت پیمانکاری توسط شرکت مدیریت ملک' },
  { code: 'master_lease', ro: 'Închiriere generală și operare', en: 'Master Lease & Operated', fa: 'اجاره کل و بهره‌برداری تجاری' },
  { code: 'multi_owner_contractual', ro: 'Guvernanță contractuală între co-proprietari', en: 'Multi-Owner Contractual Governance', fa: 'مدیریت قراردادی میان چند مالک' },
  { code: 'institutional_owner', ro: 'Proprietar instituțional / Fond de investiții', en: 'Institutional / Fund Owner Operated', fa: 'مالکیت نهادی و صندوق سرمایه‌گذاری' },
  { code: 'mixed_authority', ro: 'Administrare cu autoritate mixtă', en: 'Mixed Authority Management', fa: 'مدیریت با ساختار اختیارات ترکیبی' },
];

function evaluateCompatibility(profileCode: string, modelCode: string): 'compatible' | 'review_required' | 'incompatible' {
  if (profileCode === 'residential_condominium') {
    if (['association_managed', 'third_party_managed'].includes(modelCode)) return 'compatible';
    if (['developer_operated', 'multi_owner_contractual'].includes(modelCode)) return 'review_required';
    return 'incompatible';
  }
  if (profileCode === 'residential_complex') {
    if (['association_managed', 'third_party_managed', 'mixed_authority'].includes(modelCode)) return 'compatible';
    if (['developer_operated', 'multi_owner_contractual'].includes(modelCode)) return 'review_required';
    return 'incompatible';
  }
  if (profileCode === 'gated_villa_community') {
    if (['association_managed', 'third_party_managed', 'multi_owner_contractual'].includes(modelCode)) return 'compatible';
    if (modelCode === 'developer_operated') return 'review_required';
    return 'incompatible';
  }
  if (profileCode === 'single_villa' || profileCode === 'small_landlord_portfolio') {
    if (['single_owner_operated', 'third_party_managed', 'master_lease'].includes(modelCode)) return 'compatible';
    return 'incompatible';
  }
  if (profileCode === 'retail_centre' || profileCode === 'office_centre') {
    if (['single_owner_operated', 'third_party_managed', 'institutional_owner', 'master_lease'].includes(modelCode)) return 'compatible';
    if (modelCode === 'developer_operated') return 'review_required';
    return 'incompatible';
  }
  if (profileCode === 'mixed_use_estate') {
    if (['mixed_authority', 'third_party_managed', 'institutional_owner'].includes(modelCode)) return 'compatible';
    if (['association_managed', 'developer_operated', 'multi_owner_contractual'].includes(modelCode)) return 'review_required';
    return 'incompatible';
  }
  return 'compatible';
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
    compatReview: 'Necesită Aprobare & Justificare',
    compatIncompatible: 'Incompatibil (Blocat)',
    reasonLabel: 'Justificare Tranziție (Obligatorie)',
    reasonPlaceholder: 'Introduceți motivul modificării sau temeiul deciziei...',
    saving: 'Se aplică modificarea...',
    successMessage: 'Clasificarea workspace-ului a fost actualizată cu succes.',
    mfaRequiredMessage: 'Este necesară autentificarea cu doi factori (AAL2) pentru această operațiune.',
    conflictMessage: 'Clasificarea a fost modificată în paralel. Reîncărcați pagina.',
  },
  en: {
    title: 'Workspace Taxonomy & Classification',
    unclassified: 'Unclassified / Review Required',
    notConfigured: 'Workspace classification is not configured yet.',
    notConfiguredBadge: 'Not Configured',
    activeStatus: 'Active',
    propertyProfile: 'Property Profile',
    operatingModel: 'Operating Model',
    version: 'Version',
    allowedSpaceKinds: 'Compatible Space Kinds',
    effectivePeriod: 'Effective Period',
    from: 'From',
    indefinite: 'Indefinite',
    noSpaceKinds: 'No space kinds configured',
    noAssignmentDesc: 'This workspace does not currently have an active universal taxonomy assignment.',
    loading: 'Loading workspace taxonomy & classification…',
    error: 'Failed to load workspace taxonomy classification.',
    editButton: 'Change Classification',
    cancelButton: 'Cancel',
    confirmButton: 'Confirm Transition',
    selectProfile: 'Select Property Profile',
    selectModel: 'Select Operating Model',
    compatibilityLabel: 'Architectural Compatibility',
    compatCompatible: 'Compatible',
    compatReview: 'Review & Reason Required',
    compatIncompatible: 'Incompatible (Blocked)',
    reasonLabel: 'Change Justification / Reason (Mandatory)',
    reasonPlaceholder: 'Enter the rationale or governing resolution for this transition...',
    saving: 'Applying transition...',
    successMessage: 'Workspace taxonomy transition applied successfully.',
    mfaRequiredMessage: 'Two-factor authentication (AAL2) is required for this operation.',
    conflictMessage: 'Workspace assignment was updated concurrently. Please refresh and retry.',
  },
  fa: {
    title: 'طبقه‌بندی و توپولوژی فضای کاری',
    unclassified: 'طبقه‌بندی‌نشده / نیازمند بررسی',
    notConfigured: 'طبقه‌بندی فضای کاری هنوز تنظیم نشده است.',
    notConfiguredBadge: 'تنظیم‌نشده',
    activeStatus: 'فعال',
    propertyProfile: 'پروفایل محیطی ملک',
    operatingModel: 'مدل عملیاتی و اختیارات',
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
    conflictMessage: 'نسخه طبقه‌بندی همزمان توسط کاربر دیگری تغییر یافته است. لطفاً صفحه را تازه‌سازی کنید.',
  },
};

export function WorkspaceTaxonomyCard({
  taxonomy: initialTaxonomy,
  contextId,
  lang,
  canManage = false,
  countryCode = 'RO',
  className = '',
}: WorkspaceTaxonomyCardProps) {
  const dict = DICTIONARY[lang] || DICTIONARY.ro;
  const isRtl = lang === 'fa';

  const [fetchedTaxonomy, setFetchedTaxonomy] = useState<WorkspaceTaxonomyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(!initialTaxonomy && !!contextId);
  const [error, setError] = useState<string | null>(null);

  // Management / Mutation states
  const [isEditing, setIsEditing] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [mutationLoading, setMutationLoading] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);
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

  const handleOpenEdit = () => {
    setSelectedProfile(taxonomy?.profile?.code || PROFILES_LIST[0].code);
    setSelectedModel(taxonomy?.operating_model?.code || MODELS_LIST[0].code);
    setReason('');
    setMutationError(null);
    setIsEditing(true);
  };

  const compatStatus = selectedProfile && selectedModel ? evaluateCompatibility(selectedProfile, selectedModel) : null;
  const isReviewRequired = compatStatus === 'review_required';
  const isIncompatible = compatStatus === 'incompatible';

  const handleMutation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contextId || !selectedProfile || !selectedModel || isIncompatible) return;
    if (isReviewRequired && !reason.trim()) {
      setMutationError(dict.reasonLabel);
      return;
    }

    setMutationLoading(true);
    setMutationError(null);
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
          country_code: countryCode.toUpperCase(),
          idempotency_key: idempotencyKey,
          expected_assignment_id: taxonomy?.assignment_id ?? null,
          reason: reason.trim() || null,
        }),
      });

      const body = await res.json();

      if (!res.ok) {
        if (body.error?.code === 'MFA_REQUIRED') {
          setMutationError(dict.mfaRequiredMessage);
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
          <div className="rounded-xl bg-[#EAF8F5] p-2 text-[#0E9F8E]">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#102A43]">{dict.title}</h3>
            {hasAssignment ? (
              <p className="mt-0.5 text-xs text-[#52667A]">
                {dict.effectivePeriod}: {dict.from}{' '}
                {taxonomy?.valid_from
                  ? new Date(taxonomy.valid_from).toLocaleDateString(
                      lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-US'
                    )
                  : '—'}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-[#52667A]">
                {isUnbound ? dict.notConfigured : dict.noAssignmentDesc}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasAssignment ? (
            <span className="inline-flex items-center rounded-full bg-[#EAF8F5] border border-[#B2E5DF] px-3 py-1 text-xs font-bold text-[#0A6E62]">
              {dict.activeStatus}
            </span>
          ) : (
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                isUnbound
                  ? 'bg-slate-50 text-slate-600 border-slate-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {isUnbound ? dict.notConfiguredBadge : dict.unclassified}
            </span>
          )}

          {canManage && !isUnbound && !isEditing && (
            <button
              type="button"
              onClick={handleOpenEdit}
              className="ms-2 inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] bg-white px-3 py-1 text-xs font-semibold text-[#1E3A8A] hover:bg-slate-50 transition"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>{dict.editButton}</span>
            </button>
          )}
        </div>
      </div>

      {mutationSuccess && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-emerald-800 text-xs font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>{dict.successMessage}</span>
        </div>
      )}

      {/* Mutation Form for Managing Users */}
      {isEditing ? (
        <form onSubmit={handleMutation} className="mt-6 space-y-4 rounded-xl border border-slate-200 bg-[#F8FAFC] p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Profile select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {dict.selectProfile}
              </label>
              <select
                value={selectedProfile}
                onChange={(e) => setSelectedProfile(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#0E9F8E] focus:outline-none"
              >
                {PROFILES_LIST.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p[lang] || p.ro}
                  </option>
                ))}
              </select>
            </div>

            {/* Model select */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {dict.selectModel}
              </label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:border-[#0E9F8E] focus:outline-none"
              >
                {MODELS_LIST.map((m) => (
                  <option key={m.code} value={m.code}>
                    {m[lang] || m.ro}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Live Compatibility Status */}
          {compatStatus && (
            <div className="rounded-lg border p-3 text-xs flex items-center justify-between">
              <span className="font-bold text-slate-700">{dict.compatibilityLabel}:</span>
              {compatStatus === 'compatible' && (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {dict.compatCompatible}
                </span>
              )}
              {compatStatus === 'review_required' && (
                <span className="inline-flex items-center gap-1 font-bold text-amber-700">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  {dict.compatReview}
                </span>
              )}
              {compatStatus === 'incompatible' && (
                <span className="inline-flex items-center gap-1 font-bold text-red-700">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  {dict.compatIncompatible}
                </span>
              )}
            </div>
          )}

          {/* Mandatory Reason for review_required */}
          {isReviewRequired && (
            <div>
              <label className="block text-xs font-bold text-amber-900 mb-1">
                {dict.reasonLabel} *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={dict.reasonPlaceholder}
                rows={2}
                required
                className="w-full rounded-lg border border-amber-300 bg-amber-50/30 p-2 text-xs text-slate-800 focus:border-amber-500 focus:outline-none"
              />
            </div>
          )}

          {mutationError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-2.5 text-xs text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{mutationError}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              disabled={mutationLoading}
              onClick={() => {
                setIsEditing(false);
                setMutationError(null);
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {dict.cancelButton}
            </button>
            <button
              type="submit"
              disabled={mutationLoading || isIncompatible || (isReviewRequired && !reason.trim())}
              className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold text-white transition ${
                isIncompatible || (isReviewRequired && !reason.trim()) || mutationLoading
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-[#0E9F8E] hover:bg-[#0A7B6E]'
              }`}
            >
              {mutationLoading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>{dict.saving}</span>
                </>
              ) : (
                <>
                  <span>{dict.confirmButton}</span>
                  <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                </>
              )}
            </button>
          </div>
        </form>
      ) : hasAssignment && profile && operatingModel ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Property Profile */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider">
                  {dict.propertyProfile}
                </span>
                <span className="text-[11px] font-mono text-[#52667A]">
                  {dict.version} {profile.version}
                </span>
              </div>
              <h4 className="mt-2 text-base font-bold text-[#102A43]">
                {profile.labels?.[lang] || profile.name}
              </h4>
              {profile.description && (
                <p className="mt-1 text-xs text-[#52667A] leading-relaxed">
                  {profile.description}
                </p>
              )}
              <div className="mt-3 inline-block rounded-md bg-white border border-[#E2E8F0] px-2 py-0.5 font-mono text-[10px] text-[#52667A]">
                {profile.code}
              </div>
            </div>

            {/* Operating Model */}
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider">
                  {dict.operatingModel}
                </span>
                <span className="text-[11px] font-mono text-[#52667A]">
                  {dict.version} {operatingModel.version}
                </span>
              </div>
              <h4 className="mt-2 text-base font-bold text-[#102A43]">
                {operatingModel.labels?.[lang] || operatingModel.name}
              </h4>
              {operatingModel.description && (
                <p className="mt-1 text-xs text-[#52667A] leading-relaxed">
                  {operatingModel.description}
                </p>
              )}
              <div className="mt-3 inline-block rounded-md bg-white border border-[#E2E8F0] px-2 py-0.5 font-mono text-[10px] text-[#52667A]">
                {operatingModel.code}
              </div>
            </div>
          </div>

          {/* Allowed Space Kinds */}
          <div className="mt-6 border-t border-[#F1F5F9] pt-4">
            <h5 className="text-xs font-bold text-[#52667A] uppercase tracking-wider mb-3">
              {dict.allowedSpaceKinds}
            </h5>
            {taxonomy.allowed_space_kinds && taxonomy.allowed_space_kinds.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {taxonomy.allowed_space_kinds.map((k) => {
                  const label = k.labels?.[lang] || k.name;
                  const isReview = k.compatibility_level === 'review_required';
                  return (
                    <span
                      key={k.code}
                      className={`inline-flex items-center rounded-lg border px-2.5 py-1 text-xs font-medium ${
                        isReview
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-[#E2E8F0] bg-[#F8FAFC] text-[#102A43]'
                      }`}
                    >
                      <span>{label}</span>
                      {isReview && (
                        <span className="ms-1.5 text-[10px] text-amber-600 font-bold">
                          *
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-[#52667A] italic">{dict.noSpaceKinds}</p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
