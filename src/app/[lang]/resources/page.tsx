import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import { BookOpen, HelpCircle, Shield, FileText, ArrowRight, Compass, ShieldCheck } from 'lucide-react';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/resources', params.lang);
}

export default async function ResourcesPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      badge: 'Resurse & Documentație',
      title: 'Resurse oficiale, ghiduri și bune practici',
      subtitle: 'Accesează documentația operațională, răspunsuri la întrebări frecvente, metodologia de migrare și angajamentele de securitate ale CLADORA.',
      ctaPrimary: 'Solicită Parteneriat',
      ctaSecondary: 'Contactează Echipa',
      resources: [
        {
          title: 'Întrebări Frecvente (FAQ)',
          desc: 'Răspunsuri la cele mai comune întrebări despre migrare, securitate financiară, reconciliere bancară și suport.',
          href: `/${lang}/resources/faq`,
          icon: HelpCircle,
          actionText: 'Citește FAQ',
        },
        {
          title: 'Centru de Încredere & Securitate',
          desc: 'Conformitate GDPR, găzduire în Uniunea Europeană, jurnalizare de audit și protocoale de integritate.',
          href: `/${lang}/platform/trust`,
          icon: Shield,
          actionText: 'Vezi Securitate',
        },
        {
          title: 'Ghiduri de Migrare & Integrare',
          desc: 'Metodologie validată pentru importul asociațiilor, blocurilor și portofoliilor de la sisteme legacy fără întrerupere.',
          href: `/${lang}/capabilities`,
          icon: Compass,
          actionText: 'Vezi Ghidul de Migrare',
        },
        {
          title: 'Transparență & Conformitate Legală',
          desc: 'Termeni și condiții, politica de confidențialitate, gestionarea cookie-urilor și accesibilitate web conform standardelor europene.',
          href: `/${lang}/privacy`,
          icon: FileText,
          actionText: 'Politica de Confidențialitate',
        },
      ],
    },
    en: {
      badge: 'Resources & Knowledge Center',
      title: 'Official resources, playbooks, and best practices',
      subtitle: 'Access verified documentation, frequently asked questions, migration workflows, and CLADORA trust and security commitments.',
      ctaPrimary: 'Start Partnership',
      ctaSecondary: 'Contact Support',
      resources: [
        {
          title: 'Frequently Asked Questions (FAQ)',
          desc: 'Answers to essential questions covering onboarding, banking integration, statutory HOA accounting, and access roles.',
          href: `/${lang}/resources/faq`,
          icon: HelpCircle,
          actionText: 'Explore FAQ',
        },
        {
          title: 'Trust & Security Center',
          desc: 'GDPR compliance, EU-domiciled cloud infrastructure, cryptographically verifiable logs, and SOC-ready standards.',
          href: `/${lang}/platform/trust`,
          icon: Shield,
          actionText: 'Explore Trust & Security',
        },
        {
          title: 'Migration & Onboarding Playbooks',
          desc: 'Battle-tested migration runbooks for transitioning HOAs and large portfolios from legacy systems without operational downtime.',
          href: `/${lang}/capabilities`,
          icon: Compass,
          actionText: 'Explore Migration',
        },
        {
          title: 'Legal & Privacy Compliance',
          desc: 'Terms of service, statutory data protection policies, cookie governance, and accessibility commitments.',
          href: `/${lang}/privacy`,
          icon: FileText,
          actionText: 'Privacy Policy',
        },
      ],
    },
    fa: {
      badge: 'منابع و مرکز مستندات',
      title: 'مستندات رسمی، راهنماهای مهاجرت و پاسخ به پرسش‌ها',
      subtitle: 'دسترسی به پاسخ پرسش‌های پرتکرار، فرایند انتقال سوابق از سیستم‌های سنتی و تعهدات امنیتی و حفاظت از داده‌ها در کلادورا.',
      ctaPrimary: 'درخواست شروع همکاری',
      ctaSecondary: 'تماس با پشتیبانی',
      resources: [
        {
          title: 'پرسش‌های متداول (FAQ)',
          desc: 'پاسخ به سوالات پرتکرار دربارهٔ شیوه راه‌اندازی، اتصال حساب‌های بانکی، شارژ ماهانه و امنیت اطلاعات.',
          href: `/${lang}/resources/faq`,
          icon: HelpCircle,
          actionText: 'مشاهده پرسش‌های متداول',
        },
        {
          title: 'مرکز امنیت و اعتماد',
          desc: 'حفاظت از داده‌ها بر پایه استانداردهای GDPR، میزبانی امن در اتحادیه اروپا، و لاگ‌های ممیزی و ثبت وقایع استاندارد.',
          href: `/${lang}/platform/trust`,
          icon: Shield,
          actionText: 'مشاهده تعهدات امنیت',
        },
        {
          title: 'راهنمای مهاجرت و انتقال اطلاعات',
          desc: 'فرایند آزموده‌شده برای انتقال سوابق مالی و مشخصات مالکان از نرم‌افزارهای قدیمی بدون وقفه در کار.',
          href: `/${lang}/capabilities`,
          icon: Compass,
          actionText: 'مشاهده راهنمای مهاجرت',
        },
        {
          title: 'قوانین و حریم خصوصی',
          desc: 'شرایط استفاده، بیانیهٔ شفاف حریم خصوصی، خط‌مشی کوکی‌ها و دسترسی‌پذیری وب‌سایت.',
          href: `/${lang}/privacy`,
          icon: FileText,
          actionText: 'سیاست حفظ حریم خصوصی',
        },
      ],
    },
  }[lang] || {
    badge: 'Resources & Knowledge Center',
    title: 'Official resources, playbooks, and best practices',
    subtitle: 'Access verified documentation, FAQs, and migration workflows.',
    ctaPrimary: 'Start Partnership',
    ctaSecondary: 'Contact Support',
    resources: [],
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-[#0E9F8E] text-xs font-semibold mb-6">
            <BookOpen className="w-3.5 h-3.5" />
            <span>{content.badge}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#102A43] tracking-tight mb-6">
            {content.title}
          </h1>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {content.subtitle}
          </p>
        </div>

        {/* Resources Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          {content.resources.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="bg-white rounded-2xl p-8 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-[#102A43] mb-3">{item.title}</h3>
                  <p className="text-sm text-[#52667A] leading-relaxed mb-6">{item.desc}</p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-sm text-[#0E9F8E] font-semibold">
                  <Link href={item.href} className="hover:underline inline-flex items-center gap-1.5">
                    <span>{item.actionText}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA Box */}
        <div className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 shadow-elevated text-center max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">{content.ctaPrimary}</h2>
          <p className="text-slate-300 text-base max-w-2xl mx-auto mb-8">
            {content.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href={`/${lang}/contact`}
              className="px-6 py-3.5 rounded-xl bg-[#0E9F8E] text-white font-semibold hover:bg-[#0C8778] transition shadow-card"
            >
              {content.ctaPrimary}
            </Link>
            <Link
              href={`/${lang}/platform`}
              className="px-6 py-3.5 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition border border-white/15"
            >
              {content.ctaSecondary}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
