import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { ArrowRight, Compass, ShieldCheck } from 'lucide-react';

interface FinalPartnershipCtaSectionProps {
  lang: Language;
}

export const FinalPartnershipCtaSection: React.FC<FinalPartnershipCtaSectionProps> = ({ lang }) => {
  const content = {
    ro: {
      badge: 'PARTENERIAT & COLABORARE',
      title: 'Conectează-ți proprietatea pe platforma unificată CLADORA',
      subtitle:
        'Indiferent dacă dezvolți un ansamblu nou, administrezi un portofoliu comercial sau cauți transparență pentru asociația ta, structurăm parteneriatul în funcție de specificul activelor tale.',
      ctaPrimary: 'Solicită Parteneriat',
      ctaSecondary: 'Explorează Platforma',
      trustPillars: [
        'Model de parteneriat adaptat portofoliului',
        'Fără riscuri de blocare tehnologică sau date captive',
        'Găzduire securizată în Uniunea Europeană',
      ],
    },
    en: {
      badge: 'PARTNERSHIP & ONBOARDING',
      title: 'Unify your properties on the CLADORA operating platform',
      subtitle:
        'Whether you are developing a new project, managing an institutional real estate portfolio, or establishing governance for a community, we structure partnerships around your asset realities.',
      ctaPrimary: 'Start Partnership',
      ctaSecondary: 'Explore Platform',
      trustPillars: [
        'Partnership scope aligned with your asset portfolio',
        'Zero vendor lock-in with verified data export formats',
        'Strict European Union cloud residency and GDPR compliance',
      ],
    },
    fa: {
      badge: 'همکاری و استقرار سازمانی',
      title: 'مدیریت یکپارچهٔ دارایی‌های خود را با کلادورا آغاز کنید',
      subtitle:
        'خواه در حال توسعهٔ پروژه‌ای نو باشید، سبدی از املاک تجاری را مدیریت کنید یا در پی شفافیت مالی برای مجتمع خود باشید، مدل همکاری متناسب با نیازهای شما تعریف می‌گردد.',
      ctaPrimary: 'درخواست شروع همکاری',
      ctaSecondary: 'آشنایی با پلتفرم',
      trustPillars: [
        'تعریف مقیاس همکاری متناسب با تعداد و نوع املاک',
        'امکان خروجی کامل سوابق بدون وابستگی انحصاری',
        'میزبانی امن داده‌ها با رعایت استانداردهای GDPR اروپا',
      ],
    },
  }[lang] || {
    badge: 'PARTNERSHIP & ONBOARDING',
    title: 'Unify your properties on the CLADORA operating platform',
    subtitle: 'We structure partnerships around your asset realities.',
    ctaPrimary: 'Start Partnership',
    ctaSecondary: 'Explore Platform',
    trustPillars: [],
  };

  return (
    <section className="py-24 bg-gradient-to-b from-[#102A43] to-[#0B2239] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/10 text-teal-300 text-xs font-bold">
            <ShieldCheck className="w-3.5 h-3.5 text-[#0E9F8E]" />
            <span>{content.badge}</span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
            {content.title}
          </h2>

          {/* Subtitle */}
          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {content.subtitle}
          </p>

          {/* CTA Buttons */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto px-8 py-4 text-sm font-bold text-white bg-[#0E9F8E] hover:bg-[#0C8778] rounded-xl shadow-card transition-all hover:shadow-card-hover hover:-translate-y-0.5 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <span>{content.ctaPrimary}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>

            <Link
              href={`/${lang}/platform`}
              className="w-full sm:w-auto px-8 py-4 text-sm font-bold text-white bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E9F8E]"
            >
              <Compass className="w-4 h-4 text-teal-300" />
              <span>{content.ctaSecondary}</span>
            </Link>
          </div>

          {/* Trust Guarantees */}
          <div className="pt-10 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 sm:gap-10 text-xs text-slate-400">
            {content.trustPillars.map((tp, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0E9F8E]" />
                <span>{tp}</span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  );
};
