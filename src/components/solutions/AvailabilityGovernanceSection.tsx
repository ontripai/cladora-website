import React from 'react';
import { Language } from '@/types';
import { ShieldCheck, Layers, GitBranch, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface AvailabilityGovernanceSectionProps {
  lang: Language;
  solutionName?: string;
}

export const AvailabilityGovernanceSection: React.FC<AvailabilityGovernanceSectionProps> = ({
  lang,
  solutionName,
}) => {
  const content = {
    ro: {
      badge: 'GUVERNANȚA DISPONIBILITĂȚII CAPABILITĂȚILOR',
      title: 'Compoziție de Platformă vs. Disponibilitate Operațională',
      p1: `Această pagină descrie modul în care arhitectura unificată CLADORA și familiile sale de capabilități pot fi compuse pentru contextul specific ${
        solutionName ? `al actorului «${solutionName}»` : 'fiecărui participant autorizat'
      }.`,
      p2: 'O soluție nu reprezintă un produs software separat și nu este etichetată global ca «disponibilă integral» în mod arbitrar. Disponibilitatea fiecărei capabilități individuale depinde strict de stadiul de lansare validat, de pachetul regional de reglementare (Country Pack), de politicile de configurare și de anvergura contractuală a implementării (scope).',
      rulesTitle: 'Reguli de Guvernanță Arhitecturală',
      rules: [
        {
          title: 'Separarea dintre Compoziție și Disponibilitate',
          desc: 'Prezentarea unui flux de lucru pe pagina de soluție indică fezabilitatea arhitecturală a modelului de date, nu garanția activării imediate fără configurare prealabilă.',
        },
        {
          title: 'Fără Baze de Date Paralele sau Silozuri',
          desc: 'Nicio soluție nu deține un registru financiar propriu, o bază de date de identitate paralelă sau un istoric izolat. Toate operațiunile se ancorează în furnizorii canonici (CORE, FIN01, DOCUMENTS, etc.).',
        },
        {
          title: 'Activare Controlată pe Bază de Mandat',
          desc: 'Funcționalitățile de producție sunt activate exclusiv în interiorul workspace-ului autorizat, respectând rolurile legale și cerințele statutare locale aplicabile.',
        },
      ],
      exploreCapabilities: 'Explorează Cadrul de Capabilități',
      explorePlatform: 'Vezi Arhitectura Platformei',
    },
    en: {
      badge: 'CAPABILITY AVAILABILITY GOVERNANCE',
      title: 'Platform Composition vs. Operational Availability',
      p1: `This page describes how CLADORA's unified platform architecture and capability families compose for the specific context of ${
        solutionName ? `"${solutionName}"` : 'each authorized participant'
      }.`,
      p2: 'A Solution is not a standalone software product and is never broadly labeled as uniformly "live" or "ready." The production availability of any specific capability depends strictly on its validated release maturity, active regional regulatory compliance (Country Pack), workspace configuration policies, and contracted implementation scope.',
      rulesTitle: 'Architectural Governance Rules',
      rules: [
        {
          title: 'Separation of Composition from Runtime Status',
          desc: 'Illustrating an end-to-end operational flow reflects architectural data-model compatibility, not an unconditional guarantee of out-of-the-box runtime activation.',
        },
        {
          title: 'No Parallel Databases or Truth Silos',
          desc: 'No Solution owns an independent financial ledger, tenant database, or parallel audit store. All actions route strictly to single-capability canonical providers (CORE, FIN01, DOCUMENTS, etc.).',
        },
        {
          title: 'Controlled Mandate-Based Activation',
          desc: 'Production capabilities are activated strictly within designated operational workspaces following statutory requirements and verified organizational roles.',
        },
      ],
      exploreCapabilities: 'Explore Capabilities Architecture',
      explorePlatform: 'Explore Platform Architecture',
    },
    fa: {
      badge: 'حاکمیت در دسترس بودن قابلیت‌ها',
      title: 'ترکیب معماری پلتفرم در مقایسه با وضعیت استقرار عملیاتی',
      p1: `این صفحه تشریح می‌کند که معماری یکپارچه کلادورا و خانواده‌های قابلیتی آن چگونه برای بستر و جایگاه ${
        solutionName ? `«${solutionName}»` : 'هر یک از مشارکت‌کنندگان مجاز'
      } ترکیب می‌شوند.`,
      p2: 'یک راهکار نرم‌افزاری، محصولی مجزا و جداگانه نیست و به صورت یکپارچه برچسب «فعال در تمام بخش‌ها» دریافت نمی‌کند. در دسترس بودن هر قابلیت در محیط عملیاتی، منحصراً تابع سطح بلوغ نرم‌افزاری ارزیابی‌شده، انطباق‌های قانونی منطقه‌ای (Country Pack)، سیاست‌های تنظیمات ورک‌اسپیس و دامنه توافق‌شده اجرایی است.',
      rulesTitle: 'قواعد حاکمیت معماری داده‌ها',
      rules: [
        {
          title: 'تفکیک مدل معماری از وضعیت استقرار',
          desc: 'ترسیم جریان‌های عملیاتی در صفحات راهکارها، سازگاری ساختار داده‌ها را نشان می‌دهد و به معنای در دسترس بودن بی‌قیدوشرط بدون پیکربندی قبلی نیست.',
        },
        {
          title: 'عدم ایجاد پایگاه‌های داده موازی یا جزیره‌ای',
          desc: 'هیچ راهکاری مالک دفتر مالی مجزا، پایگاه داده مستقل کاربران یا آرشیو اسناد موازی نیست. تمام فعالیت‌ها از طریق متولیان مرجع داده‌ها (CORE، FIN01، اسناد و غیره) پردازش می‌شوند.',
        },
        {
          title: 'فعال‌سازی مبتنی بر مجوز و مصوبه رسمی',
          desc: 'قابلیت‌های محیط واقعی تنها درون ورک‌اسپیس‌های مجاز و با رعایت دقیق الزامات قانونی و نقش‌های سازمانی معتبر فعال می‌شوند.',
        },
      ],
      exploreCapabilities: 'مشاهده معماری قابلیت‌ها',
      explorePlatform: 'بررسی معماری پلتفرم',
    },
  }[lang];

  return (
    <section className="py-16 bg-[#F8FAFC] border-y border-[#E2E8F0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        
        {/* Header */}
        <div className="max-w-3xl space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF8F5] text-xs font-bold text-[#0A6E62] border border-[#B2E5DF]">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0E9F8E]" />
            <span>{content.badge}</span>
          </div>
          <h2 className="text-xl sm:text-3xl font-display font-extrabold text-[#102A43] tracking-tight">
            {content.title}
          </h2>
          <div className="text-xs sm:text-sm text-[#52667A] space-y-2 leading-relaxed">
            <p>{content.p1}</p>
            <p>{content.p2}</p>
          </div>
        </div>

        {/* 3 Governance Pillars */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {content.rules.map((rule, idx) => (
            <div key={idx} className="card-proptech p-5 bg-white border-[#E2E8F0] space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#0E9F8E]" />
                <h3 className="text-xs font-bold text-[#102A43]">{rule.title}</h3>
              </div>
              <p className="text-xs text-[#52667A] leading-relaxed">
                {rule.desc}
              </p>
            </div>
          ))}
        </div>

        {/* Links to Capabilities and Platform */}
        <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-bold">
          <Link
            href={`/${lang}/capabilities`}
            className="inline-flex items-center gap-1.5 text-[#0E9F8E] hover:text-[#0C8778] transition-colors"
          >
            <Layers className="w-4 h-4" />
            <span>{content.exploreCapabilities}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </Link>
          <span className="text-[#CBD5E1]">|</span>
          <Link
            href={`/${lang}/platform/architecture`}
            className="inline-flex items-center gap-1.5 text-[#52667A] hover:text-[#102A43] transition-colors"
          >
            <GitBranch className="w-4 h-4" />
            <span>{content.explorePlatform}</span>
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </Link>
        </div>

      </div>
    </section>
  );
};
