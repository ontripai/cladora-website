import React from 'react';
import type { WorkspaceTaxonomyResponse } from '@/lib/customer/workspace-taxonomy-schema';

export interface WorkspaceTaxonomyCardProps {
  taxonomy: WorkspaceTaxonomyResponse | null;
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
  },
};

export function WorkspaceTaxonomyCard({ taxonomy, lang, className = '' }: WorkspaceTaxonomyCardProps) {
  const dict = DICTIONARY[lang] || DICTIONARY.ro;
  const isRtl = lang === 'fa';

  if (!taxonomy || !taxonomy.has_assignment || !taxonomy.profile || !taxonomy.operating_model) {
    return (
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{dict.title}</h3>
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            {dict.unclassified}
          </span>
        </div>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
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
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-4 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{dict.title}</h3>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {dict.effectivePeriod}: {dict.from} {taxonomy.valid_from ? new Date(taxonomy.valid_from).toLocaleDateString(lang === 'fa' ? 'fa-IR' : lang === 'ro' ? 'ro-RO' : 'en-US') : '—'}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          {dict.activeStatus}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Property Profile */}
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {dict.propertyProfile}
            </span>
            <span className="text-xs font-mono text-slate-400">
              v{taxonomy.profile.version}
            </span>
          </div>
          <div className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">
            {profileLabel}
          </div>
          <code className="mt-1 block text-xs font-mono text-cyan-600 dark:text-cyan-400">
            {taxonomy.profile.code}
          </code>
          {taxonomy.profile.description && (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              {taxonomy.profile.description}
            </p>
          )}
        </div>

        {/* Operating Model */}
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {dict.operatingModel}
            </span>
            <span className="text-xs font-mono text-slate-400">
              v{taxonomy.operating_model.version}
            </span>
          </div>
          <div className="mt-2 text-base font-bold text-slate-900 dark:text-slate-100">
            {modelLabel}
          </div>
          <code className="mt-1 block text-xs font-mono text-indigo-600 dark:text-indigo-400">
            {taxonomy.operating_model.code}
          </code>
          {taxonomy.operating_model.description && (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
              {taxonomy.operating_model.description}
            </p>
          )}
        </div>
      </div>

      {/* Allowed Space Kinds */}
      <div className="mt-6">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {dict.allowedSpaceKinds}
        </h4>
        <div className="mt-3 flex flex-wrap gap-2">
          {taxonomy.allowed_space_kinds && taxonomy.allowed_space_kinds.length > 0 ? (
            taxonomy.allowed_space_kinds.map((space) => {
              const label = space.labels?.[lang] || space.name;
              return (
                <span
                  key={space.id || space.code}
                  className="inline-flex items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 rtl:ml-1.5 rtl:mr-0" />
                  {label}
                </span>
              );
            })
          ) : (
            <span className="text-xs text-slate-400">{dict.noSpaceKinds}</span>
          )}
        </div>
      </div>
    </div>
  );
}
