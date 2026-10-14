import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { Sparkles, Briefcase, Wrench, Users, ArrowRight, CheckCircle2 } from 'lucide-react';

interface ConnectedDomainsSectionProps {
  lang: Language;
}

export const ConnectedDomainsSection: React.FC<ConnectedDomainsSectionProps> = ({ lang }) => {
  const content = {
    ro: {
      badge: 'DOMENII OPERAȚIONALE CONECTATE',
      title: 'Patru domenii specializate construite pe un adevăr comun',
      subtitle:
        'Fiecare domeniu gestionează o etapă critică din activitatea imobiliară fără a crea silozuri izolate de date sau sisteme paralele de contabilitate.',
      domains: [
        {
          id: 'airprop',
          name: 'AIRPROP',
          sub: 'Ciclul Comercial al Proprietății',
          desc: 'Conectează conceptele ciclului de viață comercial al proprietății din etapele de pre-vânzare și tranzacționare către faza de predare: gestiunea disponibilității, rezervări, antecontracte și mandate.',
          linkText: 'Descoperă AIRPROP',
          href: `/${lang}/airprop`,
          accent: 'text-amber-700 bg-amber-50 border-amber-200 group-hover:border-amber-400',
          badgeColor: 'text-amber-700 bg-amber-100/70',
          checkColor: 'text-amber-600',
          icon: Sparkles,
          points: [
            'Rezervări și contracte ancorate în registrul unităților',
            'Administrare leasing și separare debite chiriaș/proprietar',
            'Conexiune arhitecturală către administrarea operațională',
          ],
        },
        {
          id: 'service',
          name: 'SERVICE',
          sub: 'Coordonare & Cereri de Servicii',
          desc: 'Domeniul responsabil pentru formularea cererilor de servicii, colectarea ofertelor, agrearea termenilor de deviz și coordonarea recepției cu furnizorii de servicii.',
          linkText: 'Descoperă modulul SERVICE',
          href: `/${lang}/service`,
          accent: 'text-teal-700 bg-teal-50 border-teal-200 group-hover:border-teal-400',
          badgeColor: 'text-teal-700 bg-teal-100/70',
          checkColor: 'text-teal-600',
          icon: Briefcase,
          points: [
            'Catalog de servicii acreditate și cereri structurate',
            'Comparare transparentă de oferte fără costuri ascunse',
            'Atașarea facturilor și garanțiilor la fișa tehnică',
          ],
        },
        {
          id: 'operations',
          name: 'OPERAȚIUNI',
          sub: 'Mentenanță & Continuitate Tehnică',
          desc: 'Registrul echipamentelor tehnice din clădiri, planuri recurente de mentenanță preventivă, raportarea incidentelor, dispecerat comenzi de lucru și monitorizarea SLA-urilor.',
          linkText: 'Descoperă Operațiuni',
          href: `/${lang}/operations`,
          accent: 'text-blue-700 bg-blue-50 border-blue-200 group-hover:border-blue-400',
          badgeColor: 'text-blue-700 bg-blue-100/70',
          checkColor: 'text-blue-600',
          icon: Wrench,
          points: [
            'Cartea tehnică și istoricul complet pentru fiecare echipament',
            'Planificare automată a reviziilor preventive periodice',
            'Comenzi de lucru verificabile și recepție confirmată',
          ],
        },
        {
          id: 'community',
          name: 'COMUNITATE & EXPERIENȚĂ',
          sub: 'Interacțiune & Viață Comunitară',
          desc: 'Cadrul arhitectural pentru experiența zilnică a ocupanților: avizier digital, comunicări autorizate de consiliu, ghiduri de clădire, facilități și regulamente de conviețuire.',
          linkText: 'Explorează Arhitectura C&E',
          href: `/${lang}/community-experience`,
          accent: 'text-emerald-700 bg-emerald-50 border-emerald-200 group-hover:border-emerald-400',
          badgeColor: 'text-emerald-700 bg-emerald-100/70',
          checkColor: 'text-emerald-600',
          icon: Users,
          points: [
            'Avizier digital oficial și consultări statutare',
            'Acces securizat la ghiduri și reguli de conviețuire',
            'Separare strictă a drepturilor pe baza rolului locativ',
          ],
        },
      ],
    },
    en: {
      badge: 'CONNECTED OPERATIONAL DOMAINS',
      title: 'Four specialized domains anchored on a shared truth',
      subtitle:
        'Each domain handles a distinct operational lifecycle phase without generating isolated data silos or parallel accounting ledgers.',
      domains: [
        {
          id: 'airprop',
          name: 'AIRPROP',
          sub: 'Commercial Real Estate Lifecycle',
          desc: 'Connects commercial property lifecycle concepts from pre-sale and transaction contexts toward handover: inventory allocation, pipeline tracking, unit reservations, leasing administration, and representation mandates.',
          linkText: 'Explore AIRPROP',
          href: `/${lang}/airprop`,
          accent: 'text-amber-700 bg-amber-50 border-amber-200 group-hover:border-amber-400',
          badgeColor: 'text-amber-700 bg-amber-100/70',
          checkColor: 'text-amber-600',
          icon: Sparkles,
          points: [
            'Reservations and sales tied to canonical unit registry',
            'Leasing management and automated debtor segregation',
            'Architectural connection to operational property management',
          ],
        },
        {
          id: 'service',
          name: 'SERVICE',
          sub: 'Procurement & Service Coordination',
          desc: 'The domain responsible for structured service intent, request briefs, quote comparisons, agreed service order scopes, and delivery coordination.',
          linkText: 'Explore SERVICE',
          href: `/${lang}/service`,
          accent: 'text-teal-700 bg-teal-50 border-teal-200 group-hover:border-teal-400',
          badgeColor: 'text-teal-700 bg-teal-100/70',
          checkColor: 'text-teal-600',
          icon: Briefcase,
          points: [
            'Verified provider catalog and structured requests',
            'Transparent quote comparison and milestone agreements',
            'Service receipts and warranties committed to asset records',
          ],
        },
        {
          id: 'operations',
          name: 'OPERATIONS',
          sub: 'Facility Maintenance & Technical Continuity',
          desc: 'Equipment asset registers, scheduled preventative maintenance plans, breakdown ticketing, work order dispatch, and contractor SLA performance tracking.',
          linkText: 'Explore Operations',
          href: `/${lang}/operations`,
          accent: 'text-blue-700 bg-blue-50 border-blue-200 group-hover:border-blue-400',
          badgeColor: 'text-blue-700 bg-blue-100/70',
          checkColor: 'text-blue-600',
          icon: Wrench,
          points: [
            'Digital technical passport per physical plant asset',
            'Preventative recurring maintenance calendarization',
            'Auditable work orders and verified service sign-offs',
          ],
        },
        {
          id: 'community',
          name: 'COMMUNITY & EXPERIENCE',
          sub: 'Living Experience & Governance Interaction',
          desc: 'Architectural foundation for occupant day-to-day interactions: verified notice board, council communications, building guides, and authorized amenity interaction.',
          linkText: 'Explore C&E Architecture',
          href: `/${lang}/community-experience`,
          accent: 'text-emerald-700 bg-emerald-50 border-emerald-200 group-hover:border-emerald-400',
          badgeColor: 'text-emerald-700 bg-emerald-100/70',
          checkColor: 'text-emerald-600',
          icon: Users,
          points: [
            'Official digital notice board and formal consultations',
            'Secure access to building handbooks and house rules',
            'Role-bounded isolation ensuring privacy between neighbors',
          ],
        },
      ],
    },
    fa: {
      badge: 'دامنه‌های متصل عملیاتی',
      title: 'چهار حوزهٔ تخصصی متصل بر بستر یک حقیقت مشترک',
      subtitle:
        'هر دامنه یک بخش کلیدی از فرایند املاک را پوشش می‌دهد بدون آنکه داده‌های جزیره‌ای یا دفاتر حسابداری موازی و نامعتبر ایجاد کند.',
      domains: [
        {
          id: 'airprop',
          name: 'ایرپراپ (AIRPROP)',
          sub: 'چرخهٔ تجاری، واگذاری و اجاره',
          desc: 'اتصال مفاهیم چرخهٔ تجاری ملک از پیش‌فروش و معاملات به سوی مرحلهٔ تحویل: مدیریت واحدهای قابل‌واگذاری، پیگیری فرصت‌ها، رزرو، پیش‌فروش، قراردادهای اجاره و تفکیک مطالبات.',
          linkText: 'مشاهدهٔ جزئیات AIRPROP',
          href: `/${lang}/airprop`,
          accent: 'text-amber-700 bg-amber-50 border-amber-200 group-hover:border-amber-400',
          badgeColor: 'text-amber-700 bg-amber-100/70',
          checkColor: 'text-amber-600',
          icon: Sparkles,
          points: [
            'ثبت رزروها و قراردادها متصل به هویت یکتای واحد',
            'مدیریت اجاره و تفکیک اتوماتیک هزینه‌های مالک و مستأجر',
            'اتصال معماری به پرونده تحویل و مدیریت بهره‌برداری',
          ],
        },
        {
          id: 'service',
          name: 'سرویس (SERVICE)',
          sub: 'هماهنگی خدمات و ثبت نیازمندی‌ها',
          desc: 'حوزهٔ مسئول برای ثبت دقیق شرح نیاز فضا، دریافت استعلام‌ها، مقایسه پیشنهادها، توافق بر دامنهٔ سفارش کار و هماهنگی تحویل خدمت.',
          linkText: 'مشاهدهٔ جزئیات SERVICE',
          href: `/${lang}/service`,
          accent: 'text-teal-700 bg-teal-50 border-teal-200 group-hover:border-teal-400',
          badgeColor: 'text-teal-700 bg-teal-100/70',
          checkColor: 'text-teal-600',
          icon: Briefcase,
          points: [
            'کاتالوگ ارائه‌دهندگان معتبر و ثبت درخواست بر اساس فضا',
            'مقایسه شفاف قیمت‌ها و شرایط انجام کار بدون ابهام',
            'ثبت فاکتورها و ضمانت‌نامه‌ها در شناسنامه فنی دارایی',
          ],
        },
        {
          id: 'operations',
          name: 'عملیات و نگهداری (OPERATIONS)',
          sub: 'پایش تجهیزات و نگهداری پیشگیرانه',
          desc: 'شناسنامهٔ تجهیزات فنی، برنامه‌های سرویس دوره‌ای آسانسور و موتورخانه، ثبت خرابی، صدور دستورکار برای تکنسین‌ها و پایش کیفیت انجام تعهدات.',
          linkText: 'مشاهدهٔ جزئیات عملیات',
          href: `/${lang}/operations`,
          accent: 'text-blue-700 bg-blue-50 border-blue-200 group-hover:border-blue-400',
          badgeColor: 'text-blue-700 bg-blue-100/70',
          checkColor: 'text-blue-600',
          icon: Wrench,
          points: [
            'پرونده فنی و سوابق سرویس برای هر دستگاه ساختمانی',
            'برنامه‌ریزی اتوماتیک بازدیدهای دوره‌ای و پیشگیرانه',
            'دستورکارهای قابل ممیزی و تایید مستند انجام خدمات',
          ],
        },
        {
          id: 'community',
          name: 'تجربه و تعاملات (COMMUNITY)',
          sub: 'ارتباطات ساختمانی و سکونت',
          desc: 'بستر معماری برای تعاملات روزمره ساکنان: تابلوی اعلانات رسمی، اطلاعیه‌های هیئت‌مدیره، راهنمای امکانات ساختمان و تعاملات مجاز.',
          linkText: 'بررسی معماری C&E',
          href: `/${lang}/community-experience`,
          accent: 'text-emerald-700 bg-emerald-50 border-emerald-200 group-hover:border-emerald-400',
          badgeColor: 'text-emerald-700 bg-emerald-100/70',
          checkColor: 'text-emerald-600',
          icon: Users,
          points: [
            'تابلوی اعلانات دیجیتال و نظرسنجی‌های رسمی قانونی',
            'دسترسی امن به مقررات مجتمع و راهنمای ساختمان',
            'تفکیک نقش‌ها برای حفظ کامل محرمانگی اطلاعات میان همسایگان',
          ],
        },
      ],
    },
  }[lang] || {
    badge: 'CONNECTED OPERATIONAL DOMAINS',
    title: 'Four specialized domains anchored on a shared truth',
    subtitle: 'Each domain handles an operational phase.',
    domains: [],
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

        {/* 4 Connected Domains Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {content.domains.map((dom) => {
            const Icon = dom.icon;
            return (
              <div
                key={dom.id}
                className="bg-[#F6F9FC] rounded-3xl p-8 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-2xl bg-white border border-[#E2E8F0] text-[#102A43] flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className={`text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full ${dom.badgeColor}`}>
                      {dom.name}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-[#102A43] mb-1">{dom.name}</h3>
                  <div className="text-xs font-semibold text-[#0E9F8E] mb-4">{dom.sub}</div>
                  <p className="text-sm text-[#52667A] leading-relaxed mb-6">{dom.desc}</p>

                  <ul className="space-y-2.5 pt-4 border-t border-[#E2E8F0] mb-6">
                    {dom.points.map((pt, pIdx) => (
                      <li key={pIdx} className="flex items-start gap-2.5 text-xs text-[#334E68]">
                        <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${dom.checkColor}`} />
                        <span>{pt}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-4 border-t border-[#E2E8F0]">
                  <Link
                    href={dom.href}
                    className="inline-flex items-center justify-between w-full text-xs font-bold text-[#102A43] group-hover:text-[#0E9F8E] transition-colors"
                  >
                    <span>{dom.linkText}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
};
