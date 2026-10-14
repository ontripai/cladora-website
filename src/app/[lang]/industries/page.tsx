import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import { Building, Building2, Store, Warehouse, Hotel, Car, Layers, ArrowRight, ShieldCheck } from 'lucide-react';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/industries', params.lang);
}

export default async function IndustriesPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      badge: 'Soluții pe Tipuri de Proprietăți',
      title: 'Preseturi de industrie adaptate cerințelor operaționale',
      subtitle: 'Mediul unificat CLADORA configurează regulile contabile, ciclurile de revizie și interfețele în funcție de tipul de proprietate și mixul de utilizare.',
      cautionTitle: 'Transparență privind disponibilitatea',
      cautionDesc: 'Rezidențialul și Birourile sunt disponibile în producție și programul pilot. Verticalele specializate (precum Ospitalitate și Auto) sunt în stadiul de proiectare/țintă și nu sunt oferite ca soluții comerciale active.',
      ctaPrimary: 'Solicită Parteneriat',
      ctaSecondary: 'Explorează Soluțiile',
      industries: [
        { name: 'Rezidențial & Asociații', status: 'LIVE', icon: Building, desc: 'Ansambluri rezidențiale, asociații de proprietari, condominii și comunități private.' },
        { name: 'Birouri & Workplace', status: 'LIVE', icon: Building2, desc: 'Clădiri de birouri, parcuri de afaceri, chiriași multipli și spații de lucru flexibile.' },
        { name: 'Retail & Centre Comerciale', status: 'PILOT', icon: Store, desc: 'Galerii comerciale, parcuri de retail și spații comerciale stradale.' },
        { name: 'Industrial & Logistică', status: 'PILOT', icon: Warehouse, desc: 'Depozite, hale industriale, parcuri logistice și infrastructură tehnică.' },
        { name: 'Mixte (Mixed-Use)', status: 'LIVE', icon: Layers, desc: 'Dezvoltări complexe cu componente rezidențiale, birouri și galerii la parter.' },
        { name: 'Ospitalitate', status: 'TARGET', icon: Hotel, desc: 'Hoteluri, aparthoteluri și servicii de cazare (în foaie de parcurs).' },
        { name: 'Auto & Flote', status: 'TARGET', icon: Car, desc: 'Facilități auto, parcări supraetajate și stații de încărcare (în cercetare).' },
      ],
    },
    en: {
      badge: 'Property Type Solutions',
      title: 'Industry presets adapted to operational realities',
      subtitle: 'The CLADORA unified environment adapts statutory accounting, inspection cycles, and user interfaces to match exact real estate asset categories.',
      cautionTitle: 'Availability & Governance Transparency',
      cautionDesc: 'Residential, Office, and Mixed-use presets are in production and active pilot deployments. Target verticals such as Hospitality and Automotive are in roadmap definition and not offered as active commercial solutions.',
      ctaPrimary: 'Start Partnership',
      ctaSecondary: 'Explore Solutions',
      industries: [
        { name: 'Residential & HOAs', status: 'LIVE', icon: Building, desc: 'Multi-family buildings, homeowners associations, residential towers, and gated communities.' },
        { name: 'Office & Workplace', status: 'LIVE', icon: Building2, desc: 'Commercial office towers, corporate campuses, multi-tenant properties, and flex offices.' },
        { name: 'Retail & Shopping Centers', status: 'PILOT', icon: Store, desc: 'Strip malls, shopping centers, urban retail podiums, and multi-brand facilities.' },
        { name: 'Industrial & Logistics', status: 'PILOT', icon: Warehouse, desc: 'Distribution hubs, light industrial warehouses, storage facilities, and business parks.' },
        { name: 'Mixed-Use Developments', status: 'LIVE', icon: Layers, desc: 'Complex assets blending residential units, commercial retail podiums, and workspace floors.' },
        { name: 'Hospitality', status: 'TARGET', icon: Hotel, desc: 'Aparthotels, serviced apartments, and hospitality lodging (roadmap exploration).' },
        { name: 'Automotive & Fleet', status: 'TARGET', icon: Car, desc: 'Structured parkings, service bays, and fleet support facilities (research phase).' },
      ],
    },
    fa: {
      badge: 'راهکارهای تفکیک‌شده بر اساس نوع ملک',
      title: 'پیکربندی‌های تخصصی متناسب با واقعیت‌های عملیاتی هر صنعت',
      subtitle: 'محیط یکپارچهٔ کلادورا دفاتر مالی، چرخه‌های بازدید فنی و سطوح دسترسی را بر اساس ماهیت واقعی هر نوع ملک تنظیم می‌کند.',
      cautionTitle: 'شفافیت در سطح آمادگی سامانه‌ها',
      cautionDesc: 'راهکارهای املاک مسکونی و اداری عملیاتی بوده و در پایلوت فعال هستند. بخش‌هایی مانند هتل‌داری و خودرو در مرحلهٔ طراحی بوده و به عنوان محصول نهایی ارائه نمی‌شوند.',
      ctaPrimary: 'درخواست شروع همکاری',
      ctaSecondary: 'مشاهدهٔ راهکارها',
      industries: [
        { name: 'مسکونی و مجتمع‌ها', status: 'LIVE', icon: Building, desc: 'برج‌های مسکونی، مجتمع‌های ساختمانی، شهرک‌ها و تعاونی‌ها.' },
        { name: 'اداری و دفاتر کار', status: 'LIVE', icon: Building2, desc: 'ساختمان‌های اداری، مراکز تجاری، و فضاهای کاری چندمستأجره.' },
        { name: 'تجاری و مراکز خرید', status: 'PILOT', icon: Store, desc: 'مراکز خرید، فروشگاه‌های زنجیره‌ای و راسته بازارهای شهری.' },
        { name: 'صنعتی و لجستیک', status: 'PILOT', icon: Warehouse, desc: 'انبارها، سوله‌های صنعتی، مراکز توزیع و شهرک‌های صنعتی.' },
        { name: 'چندمنظوره (Mixed-Use)', status: 'LIVE', icon: Layers, desc: 'پروژه‌های ترکیبی شامل طبقات تجاری، اداری و مسکونی.' },
        { name: 'اقامتی و هتلداری', status: 'TARGET', icon: Hotel, desc: 'هتل‌آپارتمان‌ها و مراکز اقامتی (در دست توسعه).' },
        { name: 'تاسیسات خودرویی', status: 'TARGET', icon: Car, desc: 'پارکینگ‌های طبقاتی و ایستگاه‌های شارژ (مرحله پژوهش).' },
      ],
    },
  }[lang] || {
    badge: 'Property Type Solutions',
    title: 'Industry presets adapted to operational realities',
    subtitle: 'The CLADORA unified environment adapts to property categories.',
    cautionTitle: 'Availability Transparency',
    cautionDesc: 'Production availability is strictly controlled.',
    ctaPrimary: 'Start Partnership',
    ctaSecondary: 'Explore Solutions',
    industries: [],
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LIVE':
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">LIVE</span>;
      case 'PILOT':
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">PILOT</span>;
      case 'TARGET':
        return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">TARGET</span>;
      default:
        return null;
    }
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-[#0E9F8E] text-xs font-semibold mb-6">
            <Layers className="w-3.5 h-3.5" />
            <span>{content.badge}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#102A43] tracking-tight mb-6">
            {content.title}
          </h1>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {content.subtitle}
          </p>
        </div>

        {/* Governance banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-12 flex items-start gap-4">
          <ShieldCheck className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-amber-900 mb-1">{content.cautionTitle}</h3>
            <p className="text-xs sm:text-sm text-amber-800 leading-relaxed">{content.cautionDesc}</p>
          </div>
        </div>

        {/* Industry Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {content.industries.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.name}
                className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center">
                      <Icon className="w-5 h-5" />
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                  <h3 className="text-lg font-bold text-[#102A43] mb-2">{item.name}</h3>
                  <p className="text-sm text-[#52667A] leading-relaxed mb-4">{item.desc}</p>
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

        {/* Global CTA Strip */}
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
              href={`/${lang}/solutions`}
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
