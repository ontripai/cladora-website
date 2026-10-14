import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { Building, Building2, Store, Warehouse, Hotel, Car, Layers, ArrowRight } from 'lucide-react';

interface IndustryPreviewSectionProps {
  lang: Language;
}

export const IndustryPreviewSection: React.FC<IndustryPreviewSectionProps> = ({ lang }) => {
  const content = {
    ro: {
      badge: 'APLICABILITATE ARHITECTURALĂ',
      title: 'Preseturi de industrie pe o arhitectură unică',
      subtitle:
        'Aceeași arhitectură decuplată (Proprietate → Workspace → Relații → Domenii) se configurează în funcție de tipul și destinația spațiilor fizice.',
      learnMore: 'Vezi toate industriile',
      industries: [
        {
          name: 'Rezidențial & Asociații',
          desc: 'Ansambluri rezidențiale, asociații de proprietari, condominii și comunități private.',
          icon: Building,
        },
        {
          name: 'Birouri & Workplace',
          desc: 'Clădiri de birouri, parcuri de afaceri, chiriași multipli și spații de lucru flexibile.',
          icon: Building2,
        },
        {
          name: 'Retail & Centre Comerciale',
          desc: 'Galerii comerciale, parcuri de retail și spații comerciale stradale.',
          icon: Store,
        },
        {
          name: 'Industrial & Logistică',
          desc: 'Depozite, hale industriale, parcuri logistice și infrastructură tehnică.',
          icon: Warehouse,
        },
        {
          name: 'Mixte (Mixed-Use)',
          desc: 'Dezvoltări complexe cu componente rezidențiale, birouri și galerii comerciale la parter.',
          icon: Layers,
        },
        {
          name: 'Ospitalitate',
          desc: 'Hoteluri, aparthoteluri și servicii de cazare (în foaie de parcurs arhitecturală).',
          icon: Hotel,
        },
        {
          name: 'Auto & Flote',
          desc: 'Facilități auto, parcări supraetajate și stații de încărcare (cercetare de domeniu).',
          icon: Car,
        },
      ],
    },
    en: {
      badge: 'ARCHITECTURAL APPLICABILITY',
      title: 'Industry presets on a single operating platform',
      subtitle:
        'The same decoupled architecture (Property → Workspace → Relationships → Domains) adapts to different built asset categories and operating realities.',
      learnMore: 'Explore all industries',
      industries: [
        {
          name: 'Residential & HOAs',
          desc: 'Multi-family residential towers, homeowners associations, and gated communities.',
          icon: Building,
        },
        {
          name: 'Office & Workplace',
          desc: 'Commercial office buildings, corporate business parks, and multi-tenant assets.',
          icon: Building2,
        },
        {
          name: 'Retail & Shopping Centers',
          desc: 'Shopping galleries, strip malls, retail podiums, and multi-brand properties.',
          icon: Store,
        },
        {
          name: 'Industrial & Logistics',
          desc: 'Distribution centers, light manufacturing hubs, storage warehouses, and parks.',
          icon: Warehouse,
        },
        {
          name: 'Mixed-Use Developments',
          desc: 'Complex assets blending residential apartments, commercial retail, and workspace floors.',
          icon: Layers,
        },
        {
          name: 'Hospitality',
          desc: 'Aparthotels, serviced apartments, and accommodation facilities (architectural roadmap).',
          icon: Hotel,
        },
        {
          name: 'Automotive & Fleet',
          desc: 'Multi-level parking structures, maintenance bays, and fleet charging hubs (research).',
          icon: Car,
        },
      ],
    },
    fa: {
      badge: 'کاربردپذیری معماری در انواع املاک',
      title: 'پیکربندی‌های تخصصی هر صنعت بر پایه‌ای یکتا',
      subtitle:
        'همان معماری تفکیک‌شده (ملک ← ورک‌اسپیس ← روابط ← دامنه‌ها) متناسب با نوع کاربری و ویژگی‌های فیزیکی هر دسته از املاک تنظیم می‌گردد.',
      learnMore: 'مشاهدهٔ تمام بخش‌ها',
      industries: [
        {
          name: 'مسکونی و مجتمع‌ها',
          desc: 'برج‌های مسکونی، مجتمع‌های ساختمانی، شهرک‌ها و تعاونی‌های مالکان.',
          icon: Building,
        },
        {
          name: 'اداری و فضاهای کاری',
          desc: 'برج‌های اداری، مراکز تجاری، و فضاهای کاری چندمستأجره و اشتراکی.',
          icon: Building2,
        },
        {
          name: 'تجاری و مراکز خرید',
          desc: 'مراکز تجاری، فروشگاه‌های زنجیره‌ای و راسته بازارهای شهری.',
          icon: Store,
        },
        {
          name: 'صنعتی و لجستیک',
          desc: 'انبارها، سوله‌های صنعتی، مراکز توزیع و شهرک‌های لجستیک.',
          icon: Warehouse,
        },
        {
          name: 'چندمنظوره (Mixed-Use)',
          desc: 'پروژه‌های ترکیبی شامل طبقات تجاری، دفاتر اداری و واحدهای مسکونی.',
          icon: Layers,
        },
        {
          name: 'هتل‌داری و اقامتی',
          desc: 'هتل‌آپارتمان‌ها و مراکز اقامتی (در دست طراحی معماری).',
          icon: Hotel,
        },
        {
          name: 'خودرو و پارکینگ',
          desc: 'پارکینگ‌های طبقاتی، تعمیرگاه‌ها و ایستگاه‌های شارژ خودرو (مرحله پژوهش).',
          icon: Car,
        },
      ],
    },
  }[lang] || {
    badge: 'ARCHITECTURAL APPLICABILITY',
    title: 'Industry presets on a single operating platform',
    subtitle: 'The same decoupled architecture adapts across asset categories.',
    learnMore: 'Explore all industries',
    industries: [],
  };

  return (
    <section className="py-24 bg-[#F6F9FC] border-b border-[#E2E8F0]">
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

        {/* 7 Industry Cards Grid (No maturity badges) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {content.industries.map((ind) => {
            const Icon = ind.icon;
            return (
              <div
                key={ind.name}
                className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-[#102A43] mb-1.5">{ind.name}</h3>
                  <p className="text-xs text-[#52667A] leading-relaxed mb-4">{ind.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Deep Link to Industries Hub */}
        <div className="text-center">
          <Link
            href={`/${lang}/industries`}
            className="inline-flex items-center gap-2 text-xs font-bold text-[#0E9F8E] hover:underline"
          >
            <span>{content.learnMore}</span>
            <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </div>

      </div>
    </section>
  );
};
