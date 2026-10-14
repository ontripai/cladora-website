import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { ArrowRight, Compass, ShieldCheck, Layers, Building, Users, Activity } from 'lucide-react';

interface UniversalHeroSectionProps {
  lang: Language;
}

export const UniversalHeroSection: React.FC<UniversalHeroSectionProps> = ({ lang }) => {
  const content = {
    ro: {
      eyebrow: 'PLATFORMA DE OPERARE PENTRU PROPRIETĂȚI & ACTIVE',
      titlePrimary: 'Platforma de Operare',
      titleSecondary: 'pentru Lumea Construită',
      subtitle:
        'O singură identitate a proprietății. Spații de lucru autorizate multiple. Fiecare relație, tranzacție, serviciu și eveniment operațional conectat pe întregul ciclu de viață al activului.',
      ctaPrimary: 'Solicită Parteneriat',
      ctaSecondary: 'Explorează Platforma',
      statSubject: 'Subiect Fizic Persistent',
      statSubjectDesc: 'Proprietate • Clădire • Unitate • Activ',
      statWorkspace: 'Granițe de Workspace',
      statWorkspaceDesc: 'Contexte operaționale izolate',
      statAuthority: 'Autoritate Contextuală',
      statAuthorityDesc: 'Roluri pe bază de mandat cu termen',
      statDomains: 'Domenii Operaționale',
      statDomainsDesc: 'AIRPROP • SERVICE • Operațiuni • Comunitate',
      diagramSubject: 'PROPRIETATE / ACTIV',
      diagramSubjectSub: 'Identitate fizică unică & neschimbată',
      diagramWorkspace: 'WORKSPACE-URI AUTORIZATE',
      diagramWorkspaceSub: 'Contexte de lucru izolate & auditate',
      diagramPeople: 'OAMENI / ROLURI / RELAȚII',
      diagramPeopleSub: 'Autoritate delegată în mod explicit',
      diagramDomains: 'DOMENII OPERAȚIONALE CONECTATE',
      diagramDomainsSub: 'AIRPROP • SERVICE • OPERAȚIUNI • EXPERIENȚĂ',
    },
    en: {
      eyebrow: 'CLADORA PROPERTY & ASSET OPERATING PLATFORM',
      titlePrimary: 'The Operating Platform',
      titleSecondary: 'for the Built World',
      subtitle:
        'One property identity. Multiple authorized workspaces. Every relationship, transaction, service, and operational event connected throughout the asset lifecycle.',
      ctaPrimary: 'Start Partnership',
      ctaSecondary: 'Explore Platform',
      statSubject: 'Persistent Physical Subject',
      statSubjectDesc: 'Property • Building • Unit • Asset',
      statWorkspace: 'Workspace Boundaries',
      statWorkspaceDesc: 'Isolated operational contexts',
      statAuthority: 'Contextual Authority',
      statAuthorityDesc: 'Time-bounded, mandate-based roles',
      statDomains: 'Operational Domains',
      statDomainsDesc: 'AIRPROP • SERVICE • Operations • Community',
      diagramSubject: 'PROPERTY / ASSET',
      diagramSubjectSub: 'Persistent physical identity',
      diagramWorkspace: 'AUTHORIZED WORKSPACES',
      diagramWorkspaceSub: 'Isolated operational boundaries',
      diagramPeople: 'PEOPLE / ROLES / RELATIONSHIPS',
      diagramPeopleSub: 'Contextual, mandate-bounded authority',
      diagramDomains: 'CONNECTED OPERATIONAL DOMAINS',
      diagramDomainsSub: 'AIRPROP • SERVICE • OPERATIONS • EXPERIENCE',
    },
    fa: {
      eyebrow: 'پلتفرم جامع عملیات و مدیریت ملک و دارایی‌های فیزیکی',
      titlePrimary: 'پلتفرم عملیات و مدیریت',
      titleSecondary: 'برای دنیای ساخته‌شده',
      subtitle:
        'یک هویت پایدار برای ملک. ورک‌اسپیس‌های مجاز سازمانی چندگانه. اتصال تمامی روابط، معاملات، خدمات و رخدادهای عملیاتی در سراسر چرخهٔ عمر دارایی.',
      ctaPrimary: 'درخواست شروع همکاری',
      ctaSecondary: 'آشنایی با پلتفرم',
      statSubject: 'موضوع فیزیکی پایدار',
      statSubjectDesc: 'ملک • ساختمان • واحد • تجهیزات',
      statWorkspace: 'مرزهای ورک‌اسپیس',
      statWorkspaceDesc: 'زمینه‌های عملیاتی کاملاً تفکیک‌شده',
      statAuthority: 'اختیارات بر مبنای نقش',
      statAuthorityDesc: 'مسئولیت‌های زمان‌دار و دارای مجوز',
      statDomains: 'دامنه‌های متصل عملیاتی',
      statDomainsDesc: 'ایرپراپ • سرویس • عملیات • تجربه و تعامل',
      diagramSubject: 'ملک / دارایی فیزیکی',
      diagramSubjectSub: 'هویت پایدار و غیرقابل‌تغییر فیزیکی',
      diagramWorkspace: 'ورک‌اسپیس‌های مجاز',
      diagramWorkspaceSub: 'مرزهای مجزا و امن عملیات سازمانی',
      diagramPeople: 'افراد / نقش‌ها / روابط',
      diagramPeopleSub: 'حدود اختیارات تفویض‌شده بر پایه مجوز',
      diagramDomains: 'دامنه‌های متصل عملیاتی',
      diagramDomainsSub: 'ایرپراپ • سرویس • عملیات • تجربه و تعامل',
    },
  }[lang] || {
    eyebrow: 'CLADORA PROPERTY & ASSET OPERATING PLATFORM',
    titlePrimary: 'The Operating Platform',
    titleSecondary: 'for the Built World',
    subtitle:
      'One property identity. Multiple authorized workspaces. Every relationship, transaction, service, and operational event connected throughout the asset lifecycle.',
    ctaPrimary: 'Start Partnership',
    ctaSecondary: 'Explore Platform',
    statSubject: 'Persistent Physical Subject',
    statSubjectDesc: 'Property • Building • Unit • Asset',
    statWorkspace: 'Workspace Boundaries',
    statWorkspaceDesc: 'Isolated operational contexts',
    statAuthority: 'Contextual Authority',
    statAuthorityDesc: 'Time-bounded, mandate-based roles',
    statDomains: 'Operational Domains',
    statDomainsDesc: 'AIRPROP • SERVICE • Operations • Community',
    diagramSubject: 'PROPERTY / ASSET',
    diagramSubjectSub: 'Persistent physical identity',
    diagramWorkspace: 'AUTHORIZED WORKSPACES',
    diagramWorkspaceSub: 'Isolated operational boundaries',
    diagramPeople: 'PEOPLE / ROLES / RELATIONSHIPS',
    diagramPeopleSub: 'Contextual authority',
    diagramDomains: 'CONNECTED OPERATIONAL DOMAINS',
    diagramDomainsSub: 'AIRPROP • SERVICE • OPERATIONS • EXPERIENCE',
  };

  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden bg-gradient-to-b from-[#F0F4F8] via-[#F6F9FC] to-white border-b border-[#E2E8F0]">
      {/* Subtle architectural background grid */}
      <div className="absolute inset-0 mesh-subtle pointer-events-none opacity-60" aria-hidden="true" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E] shadow-2xs">
            <span className="w-2 h-2 rounded-full bg-[#0E9F8E] animate-pulse" aria-hidden="true" />
            <span className="tracking-wide uppercase text-[11px]">{content.eyebrow}</span>
          </div>

          {/* Primary H1 Heading */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[#102A43] tracking-tight leading-[1.12]">
            <span>{content.titlePrimary}</span>{' '}
            <span className="text-[#0E9F8E] block sm:inline">{content.titleSecondary}</span>
          </h1>

          {/* Canonical Definition Subtitle */}
          <p className="text-base sm:text-lg lg:text-xl text-[#52667A] leading-relaxed max-w-3xl mx-auto font-normal">
            {content.subtitle}
          </p>

          {/* Primary CTA Hierarchy */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto px-8 py-4 text-sm font-bold text-white bg-[#0E9F8E] hover:bg-[#0C8778] rounded-xl shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <span>{content.ctaPrimary}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" aria-hidden="true" />
            </Link>

            <Link
              href={`/${lang}/platform`}
              className="w-full sm:w-auto px-8 py-4 text-sm font-bold text-[#102A43] bg-white hover:bg-[#F0F4F8] border border-[#D3DCE6] rounded-xl transition-all hover:border-[#102A43] flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <Compass className="w-4 h-4 text-[#0E9F8E]" aria-hidden="true" />
              <span>{content.ctaSecondary}</span>
            </Link>
          </div>

          {/* Section 01 System Architecture Visual (Replacing generic stock imagery) */}
          <div className="pt-10 max-w-3xl mx-auto">
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D3DCE6] shadow-elevated text-start">
              <div className="text-xs font-bold text-[#7B8A9A] uppercase tracking-wider mb-6 flex items-center justify-between">
                <span>System Architecture Flow</span>
                <span className="text-[#0E9F8E] font-semibold">Decoupled Operational Core</span>
              </div>

              {/* Vertical Responsive System Flow Diagram */}
              <div className="space-y-4">
                
                {/* 1. Property / Asset */}
                <div className="p-4 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] flex items-center gap-4 hover:border-[#B2E5DF] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center shrink-0">
                    <Building className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="flex-grow">
                    <div className="text-sm font-bold text-[#102A43]">{content.diagramSubject}</div>
                    <div className="text-xs text-[#52667A]">{content.diagramSubjectSub}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-white border border-[#E2E8F0] text-[#102A43]">
                    Persistent Subject
                  </span>
                </div>

                <div className="flex justify-center text-[#94A3B8]" aria-hidden="true">
                  <span className="text-xs font-mono">↓</span>
                </div>

                {/* 2. Workspace */}
                <div className="p-4 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] flex items-center gap-4 hover:border-[#B2E5DF] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="flex-grow">
                    <div className="text-sm font-bold text-[#102A43]">{content.diagramWorkspace}</div>
                    <div className="text-xs text-[#52667A]">{content.diagramWorkspaceSub}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-white border border-[#E2E8F0] text-[#102A43]">
                    Tenant Boundary
                  </span>
                </div>

                <div className="flex justify-center text-[#94A3B8]" aria-hidden="true">
                  <span className="text-xs font-mono">↓</span>
                </div>

                {/* 3. People / Roles */}
                <div className="p-4 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] flex items-center gap-4 hover:border-[#B2E5DF] transition-colors">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="flex-grow">
                    <div className="text-sm font-bold text-[#102A43]">{content.diagramPeople}</div>
                    <div className="text-xs text-[#52667A]">{content.diagramPeopleSub}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-white border border-[#E2E8F0] text-[#102A43]">
                    Mandate Bounds
                  </span>
                </div>

                <div className="flex justify-center text-[#94A3B8]" aria-hidden="true">
                  <span className="text-xs font-mono">↓</span>
                </div>

                {/* 4. Operational Domains */}
                <div className="p-4 rounded-2xl bg-[#102A43] text-white flex items-center gap-4 shadow-sm">
                  <div className="w-10 h-10 rounded-xl bg-white/10 text-[#0E9F8E] flex items-center justify-center shrink-0">
                    <Activity className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <div className="flex-grow">
                    <div className="text-sm font-bold">{content.diagramDomains}</div>
                    <div className="text-xs text-slate-300">{content.diagramDomainsSub}</div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-white/10 text-teal-300 border border-white/10">
                    Work Execution
                  </span>
                </div>

              </div>
            </div>
          </div>

          {/* Key Principles Strip */}
          <div className="pt-8 border-t border-[#E2E8F0] grid grid-cols-2 md:grid-cols-4 gap-4 text-start">
            <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-card">
              <span className="text-xs font-bold text-[#102A43] block">
                {content.statSubject}
              </span>
              <span className="text-[11px] text-[#52667A] leading-tight block mt-1">
                {content.statSubjectDesc}
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-card">
              <span className="text-xs font-bold text-[#102A43] block">
                {content.statWorkspace}
              </span>
              <span className="text-[11px] text-[#52667A] leading-tight block mt-1">
                {content.statWorkspaceDesc}
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-card">
              <span className="text-xs font-bold text-[#102A43] block">
                {content.statAuthority}
              </span>
              <span className="text-[11px] text-[#52667A] leading-tight block mt-1">
                {content.statAuthorityDesc}
              </span>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#E2E8F0] shadow-card">
              <span className="text-xs font-bold text-[#102A43] block">
                {content.statDomains}
              </span>
              <span className="text-[11px] text-[#52667A] leading-tight block mt-1">
                {content.statDomainsDesc}
              </span>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
