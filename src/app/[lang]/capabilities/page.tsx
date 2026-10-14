import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import { Cpu, DollarSign, Database, FileText, Wrench, Shield, ArrowRight, Sparkles, Building2, Users } from 'lucide-react';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/capabilities', params.lang);
}

export default async function CapabilitiesPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      badge: 'Capabilități & Domenii Funcționale',
      title: 'Capabilități integrate pentru întregul ciclu de viață al proprietății',
      subtitle: 'Structura funcțională CLADORA depășește fragmentarea modulelor convenționale, oferind o arhitectură coerentă de date, registre și procese operaționale.',
      ctaPrimary: 'Solicită Parteneriat',
      ctaSecondary: 'Explorează Platforma',
      categories: [
        {
          name: 'Fundația Platformei & Workspace Universal',
          icon: Building2,
          desc: 'Identitatea unică a activelor, structura ierarhică (proprietate → clădire → unitate → spațiu) și delegarea autorității cu termen de valabilitate.',
        },
        {
          name: 'Evidență Financiară & Registru Dublu',
          icon: DollarSign,
          desc: 'Contabilitate dublă analitică, reconciliere automată a extraselor de cont, cote statutare de întreținere și transparență financiară auditabilă.',
        },
        {
          name: 'Identitate de Activ & Documente',
          icon: FileText,
          desc: 'Cartea tehnică digitală a construcției, arhivă securizată cu hash-uri de integritate, contracte și procese-verbale semnate electronic.',
        },
        {
          name: 'AIRPROP — Vânzări, Închirieri & Tranzacții',
          icon: Sparkles,
          desc: 'Gestiunea portofoliului disponibil, oferte, rezervări și predarea continuă a evidențelor tehnice și financiare către cumpărători/chiriași.',
        },
        {
          name: 'SERVICE & Operațiuni în Teren',
          icon: Wrench,
          desc: 'Tichete de mentenanță, comenzi de lucru, planuri de revizii periodice, dispecerat și evaluarea performanței furnizorilor de servicii.',
        },
        {
          name: 'Securitate, Audit & Inteligență Ghidată',
          icon: Shield,
          desc: 'Jurnal de audit imuabil, control al accesului bazat pe roluri (RBAC), conformitate GDPR și asistență inteligentă supravegheată uman.',
        },
      ],
    },
    en: {
      badge: 'System Capabilities & Functional Domains',
      title: 'Integrated capabilities across the entire property lifecycle',
      subtitle: 'CLADORA transcends legacy module fragmentation, providing a coherent foundation of shared entities, immutable ledgers, and governed workflows.',
      ctaPrimary: 'Start Partnership',
      ctaSecondary: 'Explore Platform',
      categories: [
        {
          name: 'Platform Foundation & Universal Workspace',
          icon: Building2,
          desc: 'Persistent property and asset identity, recursive spatial hierarchies, and time-bounded authority delegations.',
        },
        {
          name: 'Financial Truth & Double-Entry Ledger',
          icon: DollarSign,
          desc: 'Analytical double-entry accounting, automated bank feed reconciliation, statutory cost-sharing formulas, and auditable financial statements.',
        },
        {
          name: 'Asset DNA & Evidence Management',
          icon: FileText,
          desc: 'Digital building passport, cryptographically hashed evidence archive, verified warranties, and statutory compliance files.',
        },
        {
          name: 'AIRPROP — Sales, Leasing & Transition',
          icon: Sparkles,
          desc: 'Inventory allocation, verified unit records, leasing cycles, and seamless handover of operational history to new owners/tenants.',
        },
        {
          name: 'SERVICE & Field Operations',
          icon: Wrench,
          desc: 'Work order dispatches, scheduled preventive maintenance, SLA tracking, vendor management, and verified service completion receipts.',
        },
        {
          name: 'Security, Audit & Governed Intelligence',
          icon: Shield,
          desc: 'Immutable audit trail, role-based access control (RBAC), EU-hosted infrastructure, and policy-bounded AI with mandatory human validation.',
        },
      ],
    },
    fa: {
      badge: 'قابلیت‌ها و دامنه‌های کارکردی سامانه',
      title: 'قابلیت‌های یکپارچه در سراسر چرخه عمر ملک و دارایی',
      subtitle: 'ساختار کلادورا فراتر از ماژول‌های پراکنده و جزیره‌ای عمل می‌کند و بستر پیوسته‌ای از داده‌ها، دفاتر حسابداری و گردش‌کارهای مستند ارائه می‌دهد.',
      ctaPrimary: 'درخواست شروع همکاری',
      ctaSecondary: 'آشنایی با پلتفرم',
      categories: [
        {
          name: 'زیرساخت پلتفرم و ورک‌اسپیس سراسری',
          icon: Building2,
          desc: 'شناسهٔ پایدار دارایی‌ها، ساختار سلسله‌مراتبی فضا و تفویض زمان‌دار مسئولیت‌ها به مدیران و کاربران.',
        },
        {
          name: 'دفاتر مالی دوبل و تسهیم شفاف هزینه‌ها',
          icon: DollarSign,
          desc: 'حسابداری دوبل تحلیلی، مغایرت‌گیری بانکی، فرمول‌های قانونی سهم شارژ و صورت‌های مالی شفاف و غیرقابل‌دستکاری.',
        },
        {
          name: 'شناسنامه دیجیتال و مدیریت مستندات',
          icon: FileText,
          desc: 'شناسنامهٔ فنی ملک، آرشیو دیجیتال مدارک با هش صحت، قراردادهای رسمی و صورت‌جلسات مجمع.',
        },
        {
          name: 'ایرپراپ — واگذاری، اجاره و انتقال سوابق',
          icon: Sparkles,
          desc: 'مدیریت واحدهای قابل‌واگذاری، فرایند قرارداد و تحویل بدون نقص سوابق به مالک یا مستأجر جدید.',
        },
        {
          name: 'سرویس و عملیات فنی میدانی',
          icon: Wrench,
          desc: 'سفارش‌های کار، برنامه‌ریزی بازدیدهای دوره‌ای و سرویس آسانسور و تاسیسات، و ارزیابی کیفیت عملکرد پیمانکاران.',
        },
        {
          name: 'امنیت، ممیزی و هوشمندی قانون‌مند',
          icon: Shield,
          desc: 'لاگ ممیزی تغییرناپذیر، کنترل دسترسی مبتنی بر نقش، و دستیار هوشمند مقید به سیاست‌های مصوب و تأیید انسانی.',
        },
      ],
    },
  }[lang] || {
    badge: 'System Capabilities & Functional Domains',
    title: 'Integrated capabilities across the property lifecycle',
    subtitle: 'CLADORA transcends legacy module fragmentation.',
    ctaPrimary: 'Start Partnership',
    ctaSecondary: 'Explore Platform',
    categories: [],
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-[#0E9F8E] text-xs font-semibold mb-6">
            <Cpu className="w-3.5 h-3.5" />
            <span>{content.badge}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#102A43] tracking-tight mb-6">
            {content.title}
          </h1>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {content.subtitle}
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
          {content.categories.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.name}
                className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-12 h-12 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#102A43] mb-3">{cat.name}</h3>
                  <p className="text-sm text-[#52667A] leading-relaxed mb-6">{cat.desc}</p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-[#0E9F8E] font-semibold">
                  <Link href={`/${lang}/contact`} className="hover:underline inline-flex items-center gap-1">
                    <span>{content.ctaPrimary}</span>
                    <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
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
