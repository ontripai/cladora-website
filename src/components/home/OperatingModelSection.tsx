import React from 'react';
import { Language } from '@/types';
import { Building2, Layers, Users, Activity, ShieldCheck, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface OperatingModelSectionProps {
  lang: Language;
}

export const OperatingModelSection: React.FC<OperatingModelSectionProps> = ({ lang }) => {
  const content = {
    ro: {
      badge: 'MODELUL DE OPERARE CLADORA',
      title: 'Patru niveluri arhitecturale decuplate',
      subtitle:
        'Spre deosebire de aplicațiile monolitice tradiționale, CLADORA separă identitatea proprietății de organizațiile care o administrează și de persoanele care dețin autoritate.',
      summaryLead: 'Proprietatea rămâne subiectul.',
      summaryBody: 'Workspace-urile definesc granițele operaționale. Relațiile definesc autoritatea. Domeniile execută fluxurile de lucru.',
      levels: [
        {
          tag: 'NIVELUL 01',
          name: 'PROPRIETATE / ACTIV',
          sub: 'Subiectul fizic persistent',
          desc: 'Imobilul, clădirea, unitățile, spațiile comune și echipamentele tehnice. Identitatea și cartea tehnică dăinuie independent de schimbările de proprietari sau administratori.',
          icon: Building2,
        },
        {
          tag: 'NIVELUL 02',
          name: 'WORKSPACE',
          sub: 'Granița operațională securizată',
          desc: 'Organizațiile, echipele și comunitățile lucrează în contexte complet izolate logic, având propriile registre, setări de conformitate și jurnale de audit.',
          icon: Layers,
        },
        {
          tag: 'NIVELUL 03',
          name: 'OAMENI & RELAȚII',
          sub: 'Autoritate contextuală pe bază de mandat',
          desc: 'Autoritatea este strict legată de rolul validat (dezvoltator, proprietar, chiriaș, administrator, tehnician). Mandatele au termen și limite explicite.',
          icon: Users,
        },
        {
          tag: 'NIVELUL 04',
          name: 'DOMENII CONECTATE',
          sub: 'Execuția fluxurilor specializate',
          desc: 'AIRPROP (tranzacții), SERVICE (furnizori), Operațiuni (mentenanță) și Comunitate operează pe aceeași fundație fără a duplica evidențele de bază.',
          icon: Activity,
        },
      ],
      ctaText: 'Descoperă Arhitectura Platformei',
    },
    en: {
      badge: 'THE CLADORA OPERATING MODEL',
      title: 'Four decoupled architectural tiers',
      subtitle:
        'Unlike legacy monolithic property management software, CLADORA separates physical asset identity from operational organizations and designated individuals.',
      summaryLead: 'The property remains the subject.',
      summaryBody: 'Workspaces define operational boundaries. Relationships define authority. Connected domains perform the work.',
      levels: [
        {
          tag: 'TIER 01',
          name: 'PROPERTY / ASSET',
          sub: 'The persistent physical subject',
          desc: 'The land parcel, building, individual units, common infrastructure, and physical plant. Asset identity persists across decades regardless of ownership transfers.',
          icon: Building2,
        },
        {
          tag: 'TIER 02',
          name: 'WORKSPACE',
          sub: 'Isolated operational boundaries',
          desc: 'Companies, management firms, and communities operate within strictly segregated operational contexts with dedicated audit journals and compliance parameters.',
          icon: Layers,
        },
        {
          tag: 'TIER 03',
          name: 'PEOPLE & RELATIONSHIPS',
          sub: 'Contextual, mandate-bounded authority',
          desc: 'Authority is contextual and time-bounded (builder, owner, tenant, manager, service provider). Rights are delegated explicitly rather than tied to global accounts.',
          icon: Users,
        },
        {
          tag: 'TIER 04',
          name: 'CONNECTED DOMAINS',
          sub: 'Specialized workflow execution',
          desc: 'AIRPROP (sales & leasing), SERVICE (procurement), Operations (maintenance), and Community interact through the same shared truth without fragmented data silos.',
          icon: Activity,
        },
      ],
      ctaText: 'Explore Platform Architecture',
    },
    fa: {
      badge: 'مدل عملیاتی کلادورا',
      title: 'چهار لایهٔ تفکیک‌شده در معماری پلتفرم',
      subtitle:
        'بر خلاف نرم‌افزارهای سنتی و جزیره‌ای، کلادورا هویت پایدار فیزیکی ملک را از مرزهای سازمانی شرکت‌ها و اشخاص دارای مسئولیت تفکیک می‌کند.',
      summaryLead: 'ملک همواره موضوع اصلی باقی می‌ماند.',
      summaryBody: 'ورک‌اسپیس‌ها مرزهای امن عملیات را مشخص می‌کنند. روابط حدود اختیارات را تعیین می‌کنند. دامنه‌ها کار اجرایی را به انجام می‌رسانند.',
      levels: [
        {
          tag: 'لایهٔ ۰۱',
          name: 'ملک / دارایی فیزیکی',
          sub: 'موضوع پایدار و غیرقابل‌تغییر فیزیکی',
          desc: 'عرصه، اعیان، ساختمان، واحدها، مشاعات و تاسیسات فنی. شناسنامهٔ فنی و هویتی ملک با تغییر مالکان یا شرکت‌های مدیریت از بین نمی‌رود.',
          icon: Building2,
        },
        {
          tag: 'لایهٔ ۰۲',
          name: 'ورک‌اسپیس سازمانی',
          sub: 'مرز امن و ایزولهٔ عملیات',
          desc: 'سازمان‌ها، تیم‌های اجرایی و جوامع مالکان در محیط‌های کاملاً تفکیک‌شده و امن فعالیت می‌کنند و دفاتر مالی و لاگ‌های مستقل دارند.',
          icon: Layers,
        },
        {
          tag: 'لایهٔ ۰۳',
          name: 'افراد، نقش‌ها و روابط',
          sub: 'اختیارات بر مبنای مجوز و مدت‌دار',
          desc: 'سطح دسترسی منوط به نقش حقوقی معتبر است (سازنده، مالک، مستأجر، مدیر، تکنسین). اختیارات زمان‌دار بوده و امکان انتقال شفاف دارند.',
          icon: Users,
        },
        {
          tag: 'لایهٔ ۰۴',
          name: 'دامنه‌های متصل عملیاتی',
          sub: 'گردش‌کارهای تخصصی اجرایی',
          desc: 'ایرپراپ (معاملات)، سرویس (پیمانکاران)، عملیات (نگهداری تاسیسات) و تعاملات اجتماعی بر بستری یکپارچه و بدون ثبت چندبارهٔ داده‌ها عمل می‌کنند.',
          icon: Activity,
        },
      ],
      ctaText: 'آشنایی با معماری پلتفرم',
    },
  }[lang] || {
    badge: 'THE CLADORA OPERATING MODEL',
    title: 'Four decoupled architectural tiers',
    subtitle: 'CLADORA separates physical identity from operational boundaries.',
    summaryLead: 'The property remains the subject.',
    summaryBody: 'Workspaces define boundaries. Relationships define authority.',
    levels: [],
    ctaText: 'Explore Platform Architecture',
  };

  return (
    <section className="py-24 bg-white border-b border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E] mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0E9F8E]" />
            <span>{content.badge}</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-[#102A43] tracking-tight mb-4">
            {content.title}
          </h2>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {content.subtitle}
          </p>
        </div>

        {/* 4 Architectural Levels Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {content.levels.map((level, idx) => {
            const Icon = level.icon;
            return (
              <div
                key={level.name}
                className="bg-[#F6F9FC] rounded-2xl p-6 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-bold text-[#0E9F8E] tracking-wider uppercase bg-teal-50 px-2 py-0.5 rounded-md">
                      {level.tag}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-white border border-[#E2E8F0] text-[#102A43] flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <h3 className="text-base font-bold text-[#102A43] mb-1">{level.name}</h3>
                  <div className="text-xs font-semibold text-[#0E9F8E] mb-3">{level.sub}</div>
                  <p className="text-xs text-[#52667A] leading-relaxed">{level.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Architectural Summary Banner */}
        <div className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-10 shadow-elevated flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="text-lg font-bold text-teal-300 mb-2">{content.summaryLead}</div>
            <p className="text-sm text-slate-300 leading-relaxed">{content.summaryBody}</p>
          </div>
          <Link
            href={`/${lang}/platform`}
            className="px-6 py-3.5 rounded-xl bg-[#0E9F8E] text-white text-xs font-bold hover:bg-[#0C8778] transition shadow-card flex items-center gap-2 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
          >
            <span>{content.ctaText}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>

      </div>
    </section>
  );
};
