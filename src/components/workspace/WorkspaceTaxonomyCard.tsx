'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Layers } from 'lucide-react';
import type { WorkspaceTaxonomyResponse } from '@/lib/customer/workspace-taxonomy-schema';

export interface WorkspaceTaxonomyCardProps {
  taxonomy?: WorkspaceTaxonomyResponse | null;
  contextId?: string;
  lang: 'ro' | 'en' | 'fa';
  className?: string;
}

const DICTIONARY = {
  ro: {
    title: 'Clasificare și Topologie Workspace',
    unclassified: 'Neclasificat / În așteptare revizuire',
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
  },
  en: {
    title: 'Workspace Taxonomy & Classification',
    unclassified: 'Unclassified / Review Required',
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
  },
  fa: {
    title: 'طبقه‌بندی و توپولوژی فضای کاری',
    unclassified: 'طبقه‌بندی‌نشده / نیازمند بررسی',
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
  },
};

export function WorkspaceTaxonomyCard({
  taxonomy: initialTaxonomy,
  contextId,
  lang,
  className = '',
}: WorkspaceTaxonomyCardProps) {
  const dict = DICTIONARY[lang] || DICTIONARY.ro;
  const isRtl = lang === 'fa';

  const [fetchedTaxonomy, setFetchedTaxonomy] = useState<WorkspaceTaxonomyResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(!initialTaxonomy && !!contextId);
  const [error, setError] = useState<string | null>(null);

  const taxonomy = initialTaxonomy ?? fetchedTaxonomy;

  const load = React.useCallback(async () => {
    if (initialTaxonomy || !contextId) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/customer/v1/workspace/taxonomy?context_id=${encodeURIComponent(contextId)}`,
        { headers: { 'Cache-Control': 'no-cache' } }
      );
      if (!res.ok) throw new Error('Request failed');
      const data: WorkspaceTaxonomyResponse = await res.json();
      setFetchedTaxonomy(data);
    } catch {
      setError(dict.error);
    } finally {
      setLoading(false);
    }
  }, [contextId, initialTaxonomy, dict.error]);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);

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

  if (!taxonomy || !taxonomy.has_assignment || !taxonomy.profile || !taxonomy.operating_model) {
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className={`rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-[#EAF8F5] p-2 text-[#0E9F8E]">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="text-base font-bold text-[#102A43]">{dict.title}</h3>
          </div>
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
            {dict.unclassified}
          </span>
        </div>
        <p className="mt-3 text-xs text-[#52667A]">
          {dict.noAssignmentDesc}
        </p>
      </div>
    );
  }

  const profileLabel = taxonomy.profile.labels?.[lang] || taxonomy.profile.name;
  const modelLabel = taxonomy.operating_model.labels?.[lang] || taxonomy.operating_model.name;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#EAF8F5] p-2 text-[#0E9F8E]">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#102A43]">{dict.title}</h3>
            <p className="mt-0.5 text-xs text-[#52667A]">
              {dict.effectivePeriod}: {dict.from}{' '}
              {taxonomy.valid_from
                ? new Date(taxonomy.valid_from).toLocaleDateString(
                    lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-US'
                  )
                : '—'}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center rounded-full bg-[#EAF8F5] border border-[#B2E5DF] px-3 py-1 text-xs font-bold text-[#0A6E62]">
          {dict.activeStatus}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Property Profile */}
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider">
              {dict.propertyProfile}
            </span>
            <span className="text-[11px] font-mono text-[#52667A]">
              {dict.version} {taxonomy.profile.version}
            </span>
          </div>
          <h4 className="mt-2 text-base font-bold text-[#102A43]">{profileLabel}</h4>
          {taxonomy.profile.description && (
            <p className="mt-1 text-xs text-[#52667A] leading-relaxed">
              {taxonomy.profile.description}
            </p>
          )}
          <div className="mt-3 inline-block rounded-md bg-white border border-[#E2E8F0] px-2 py-0.5 font-mono text-[10px] text-[#52667A]">
            {taxonomy.profile.code}
          </div>
        </div>

        {/* Operating Model */}
        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#52667A] uppercase tracking-wider">
              {dict.operatingModel}
            </span>
            <span className="text-[11px] font-mono text-[#52667A]">
              {dict.version} {taxonomy.operating_model.version}
            </span>
          </div>
          <h4 className="mt-2 text-base font-bold text-[#102A43]">{modelLabel}</h4>
          {taxonomy.operating_model.description && (
            <p className="mt-1 text-xs text-[#52667A] leading-relaxed">
              {taxonomy.operating_model.description}
            </p>
          )}
          <div className="mt-3 inline-block rounded-md bg-white border border-[#E2E8F0] px-2 py-0.5 font-mono text-[10px] text-[#52667A]">
            {taxonomy.operating_model.code}
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
    </div>
  );
}
