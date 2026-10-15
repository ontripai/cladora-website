import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import { Language } from '@/types';
import { getDictionary } from '@/dictionaries';
import { PricingCalculator } from '@/components/interactive/PricingCalculator';
import { HelpCircle, ShieldCheck } from 'lucide-react';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/pricing', params.lang);
}

export default async function PricingPage(
  props: {
    params: Promise<{ lang: Language }>;
  }
) {
  const params = await props.params;
  const dict = getDictionary(params.lang);
  const lang = params.lang;
  const isRo = lang === 'ro';
  const isFa = lang === 'fa';

  const faqs = [
    {
      q: isRo 
        ? 'Cum se structurează cadrul comercial și parteneriatul CLADORA?' 
        : isFa
        ? 'ساختار همکاری و تعرفه‌گذاری در کلادورا چگونه تنظیم می‌شود؟'
        : 'How is the CLADORA commercial scope and partnership structured?',
      a: isRo
        ? 'Tarifarea se bazează pe anvergura operațională (scope): tipologia activelor, volumul de unități, domeniile de capabilități activate (FIN01, C&E, OPERATIONS, BK01, AI) și pachetul de reglementare teritorială. Stabilim condițiile comerciale în mod transparent, adaptate guvernanței fiecărei organizații.'
        : isFa
        ? 'تعرفه‌ها بر پایه دامنهٔ عملیاتی (Scope) تعیین می‌شوند: نوع کاربری دارایی، حجم واحدها، دامنه‌های عملکردی فعال (دفاتر مالی، پورتال جامعه، عملیات، رزروها، هوش مصنوعی) و بسته انطباق قانونی. شرایط قرارداد به‌صورت کاملاً شفاف و متناسب با نیاز هیئت‌مدیره تنظیم می‌گردد.'
        : 'Pricing is structured on operational scope: asset typology, unit volume, active capability domains (FIN01, C&E, OPERATIONS, BK01, AI), and territorial compliance packs. We partner directly with clients to establish transparent, governance-aligned commercial terms.',
    },
    {
      q: isRo 
        ? 'Ce opțiuni de migrare și implementare sunt disponibile?' 
        : isFa
        ? 'چه روش‌هایی برای استقرار اولیه و انتقال اطلاعات از سیستم‌های قبلی وجود دارد؟'
        : 'What onboarding and data migration options are available?',
      a: isRo
        ? 'Organizațiile pot alege între configurare ghidată de workspace, rulare paralelă asistată prin Shadow Ledger (pentru reconcilierea matematică a soldurilor pe 1-2 cicluri înainte de trecerea definitivă), sau servicii complete de migrare turnkey.'
        : isFa
        ? 'مجموعه‌ها می‌توانند از راه‌اندازی ساختاریافته ورک‌اسپیس، اجرای موازی با سیستم قبلی از طریق Shadow Ledger (برای تطبیق مانده‌های افتتاحیه در ۱ الی ۲ دوره قبل از مهاجرت قطعی)، یا خدمات کامل مهاجرت کلیددردست سازمانی بهره‌مند شوند.'
        : 'Organizations can select guided workspace setup, assisted Shadow Ledger parallel runs (mathematically reconciling opening balances over 1-2 billing cycles before cutover), or full turnkey enterprise data migration services.',
    },
    {
      q: isRo 
        ? 'Putem activa domenii noi de capabilități pe măsură ce nevoile noastre cresc?' 
        : isFa
        ? 'آیا امکان فعال‌سازی دامنه‌ها و قابلیت‌های جدید در طول زمان وجود دارد؟'
        : 'Can capability domains be added or adjusted as operational needs evolve?',
      a: isRo
        ? 'Da. Arhitectura modulară și decuplată a platformei permite pornirea cu nucleul financiar statutar și adăugarea treptată a portalului de comunitate, dispeceratului de mentenanță sau inteligenței operaționale pe măsură ce contextul o impune.'
        : isFa
        ? 'بله. معماری تفکیک‌شده و ماژولار کلادورا به شما این امکان را می‌دهد که با هسته دفاتر مالی قانونی آغاز کنید و به‌مرور پورتال تعاملی ساکنان، دیسپچ تعمیرات یا هوش عملیاتی را متناسب با نیاز سازمان فعال نمایید.'
        : 'Yes. CLADORA’s decoupled workspace model allows you to launch with statutory core ledger capabilities first and progressively activate occupant experience, maintenance dispatch, or governed intelligence as your operations expand.',
    },
    {
      q: isRo 
        ? 'Cum sunt gestionate portofoliile multi-proprietate sau mixte?' 
        : isFa
        ? 'مدیریت و گزارش‌گیری برای سبدهای چندگانه املاک یا مجموعه‌های با کاربری مختلط چگونه است؟'
        : 'How are multi-property or mixed-use portfolios governed?',
      a: isRo
        ? 'Proprietarii și firmele de administrare beneficiază de izolare strictă a spațiilor de date per proprietate, combinată cu vizibilitate consolidată, raportare agregată și condiții comerciale unificate la nivel de portofoliu.'
        : isFa
        ? 'مالکان و شرکت‌های مدیریت از تفکیک کامل مرزهای داده به ازای هر ملک در کنار گزارش‌های تلفیقی یکپارچه، داشبورد نظارتی متمرکز و شرایط قراردادی هماهنگ در سطح کل سبد املاک برخوردار می‌شوند.'
        : 'Multi-asset owners and management companies benefit from workspace-scoped data boundaries per asset, combined with consolidated reporting, aggregated oversight dashboards, and unified portfolio-level commercial terms.',
    },
  ];

  return (
    <div className="pt-28 pb-24 space-y-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      
      {/* Header Hero */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#E6F6F4] border border-[#B2E5DF] text-xs font-semibold text-[#087A6E]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>{dict.pricing.badge}</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight">
          {dict.pricing.title}
        </h1>
        <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
          {dict.pricing.description}
        </p>
      </div>

      {/* Interactive Scope & Partnership Estimator */}
      <PricingCalculator lang={lang} />

      {/* FAQs */}
      <div className="max-w-4xl mx-auto space-y-6 pt-12 border-t border-[#D3DCE6]">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-display font-bold text-[#102A43]">
            {isRo ? 'Întrebări Frecvente Despre Cadrul de Parteneriat' : isFa ? 'پرسش‌های متداول درباره چارچوب همکاری' : 'Frequently Asked Questions About Scope & Partnership'}
          </h2>
          <p className="text-xs sm:text-sm text-[#52667A]">
            {isRo 
              ? 'Răspunsuri clare privind guvernanța, migrarea datelor și extinderea capabilităților' 
              : isFa
              ? 'پاسخ‌های شفاف درباره حاکمیت داده‌ها، مهاجرت سوابق و توسعه امکانات'
              : 'Clear answers covering governance, data migration, and capability composition'}
          </p>
        </div>

        <div className="space-y-4 pt-4">
          {faqs.map((faq, idx) => (
            <div key={idx} className="p-6 rounded-2xl bg-white border border-[#D3DCE6] shadow-sm space-y-2">
              <h3 className="text-base font-bold text-[#102A43] flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#0E9F8E] shrink-0" />
                <span>{faq.q}</span>
              </h3>
              <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed ps-6">
                {faq.a}
              </p>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
