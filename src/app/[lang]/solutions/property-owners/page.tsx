import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  TrendingUp, 
  Building, 
  Layers, 
  DollarSign, 
  Calendar, 
  ShieldCheck, 
  ArrowRight, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Boxes, 
  GitBranch, 
  Receipt, 
  KeyRound 
} from 'lucide-react';
import { AvailabilityGovernanceSection } from '@/components/solutions/AvailabilityGovernanceSection';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/solutions/property-owners', params.lang);
}

export default async function PropertyOwnersSolutionPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        solutions: 'Soluții',
        current: 'Proprietari & Portofolii',
      },
      hero: {
        badge: 'PLATFORMA DE OPERARE A ACTIVELOR',
        title: 'Vizibilitate Consolidată pe Active Fără Baze de Date Paralele',
        subtitle:
          'Monitorizează activele deținute, contractele de închiriere și cheltuielile deductibile dintr-o singură perspectivă securizată, ancorată direct în sursa unică de adevăr financiar din FIN01.',
        ctaPrimary: 'Discută Parteneriatul de Portofoliu',
        ctaSecondary: 'Arhitectura Platformei',
      },
      positioning: {
        badge: 'POZIȚIONARE ARHITECTURALĂ',
        title: 'Portofoliul ca Perspectivă, Nu ca Siloz Separat',
        p: 'În CLADORA, administrarea unui portofoliu de imobile nu implică un software dedicat sau o bază de date duplicată. Portofoliul reprezintă o grupare autorizată a relațiilor de proprietate deținute de o persoană sau companie în diferite workspace-uri rezidențiale sau comerciale.',
        points: [
          {
            title: 'Ancorare Directă în FIN01',
            desc: 'Fiecare încasare și cheltuială se raportează la registrul financiar oficial, fără tabele paralele de estimare.',
          },
          {
            title: 'Delimitare Riguroasă a Fondurilor',
            desc: 'Separare strictă între cotele de consum ale chiriașilor și fondurile de reparații ale proprietarului.',
          },
          {
            title: 'Continuitatea Contractelor în AIRPROP',
            desc: 'Urmărirea termenelor de închiriere, garanțiilor și mandatelor de administrare fără pierderea istoricului.',
          },
        ],
      },
      pillars: {
        badge: 'PILAONII DE CAPABILITĂȚI',
        title: 'Compoziția Arhitecturală pentru Proprietari',
        items: [
          {
            domain: 'FIN01',
            title: 'Transparență Financiară & Decontare',
            desc: 'Evidența clară a cotelor statutare, chiriilor decontate și cheltuielilor operaționale, fără promisiuni nerealiste de randament garantat.',
            icon: DollarSign,
          },
          {
            domain: 'AIRPROP',
            title: 'Gestiune Contracte & Ocupanți',
            desc: 'Centralizarea contractelor de închiriere, monitorizarea duratei de valabilitate și istoricul locatarilor asociați unităților.',
            icon: KeyRound,
          },
          {
            domain: 'DOCUMENTS',
            title: 'Arhivă Contractuală & Facturi Sursă',
            desc: 'Acces direct la documentele justificative, polițele de asigurare și contractele semnate, atașate fiecărui activ.',
            icon: FileText,
          },
          {
            domain: 'OPERATIONS',
            title: 'Intervenții Tehnice & Recepții',
            desc: 'Vizibilitate asupra cererilor de reparații ce revin în sarcina proprietarului, cu confirmare foto a execuției.',
            icon: Boxes,
          },
        ],
      },
      lifecycle: {
        badge: 'CICLUL DE VIAȚĂ AL ACTIVULUI',
        title: 'Etapele Relației Proprietarului cu Bunul Imobiliar',
        steps: [
          {
            num: '01',
            title: 'Achiziție & Înregistrare',
            desc: 'Înrolarea activului în CORE și stabilirea dreptului de proprietate.',
          },
          {
            num: '02',
            title: 'Comercializare & Închiriere',
            desc: 'Administrarea contractelor și mandatelor operaționale prin AIRPROP.',
          },
          {
            num: '03',
            title: 'Exploatare & Decontare',
            desc: 'Încasarea chiriilor și separarea fondurilor de reparații prin FIN01.',
          },
          {
            num: '04',
            title: 'Mentenanță & Întreținere',
            desc: 'Aprobarea intervențiilor majore de capital și urmărirea garanțiilor.',
          },
          {
            num: '05',
            title: 'Tranziție sau Înstrăinare',
            desc: 'Păstrarea dosarului istoric complet în vederea reînchirierii sau vânzării.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'Proprietari & Deținători de Portofolii',
      },
      cta: {
        title: 'Structurează administrarea activelor tale imobiliare',
        subtitle:
          'Stabilește o discuție cu specialiștii CLADORA pentru a evalua compoziția soluției pentru portofoliul tău rezidențial sau comercial.',
        primary: 'Inițiază Dialogul de Parteneriat',
        secondary: 'Vezi Arhitectura Platformei',
      },
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        solutions: 'Solutions',
        current: 'Property Owners & Portfolios',
      },
      hero: {
        badge: 'ASSET OPERATING PLATFORM',
        title: 'Consolidated Asset Visibility Without Parallel Databases',
        subtitle:
          'Monitor owned properties, tenant leases, and deductible operational expenses from a unified view, anchored directly to single-capability financial truth in FIN01.',
        ctaPrimary: 'Discuss Portfolio Partnership',
        ctaSecondary: 'Platform Architecture',
      },
      positioning: {
        badge: 'ARCHITECTURAL POSITIONING',
        title: 'Portfolio as a Perspective, Not a Data Silo',
        p: 'In CLADORA, managing a multi-unit property portfolio does not require disconnected software or a duplicate database. A portfolio is an authorized aggregation of ownership relationships held by a person or company across distinct residential or commercial workspaces.',
        points: [
          {
            title: 'Direct Anchoring in FIN01',
            desc: 'Every rent transaction and maintenance recovery links to the authoritative financial ledger, avoiding speculative parallel spreadsheets.',
          },
          {
            title: 'Strict Fund Segregation',
            desc: 'Systematic separation between monthly tenant consumption utilities and long-term owner capital repair funds.',
          },
          {
            title: 'Lease Continuity in AIRPROP',
            desc: 'Monitor lease milestones, security deposit accounts, and property management mandates with end-to-end historical provenance.',
          },
        ],
      },
      pillars: {
        badge: 'CAPABILITY PILLARS',
        title: 'Architectural Composition for Property Owners',
        items: [
          {
            domain: 'FIN01',
            title: 'Financial Clarity & Cost Recovery',
            desc: 'Accurate oversight of statutory charges, settled rent receipts, and deductible expenses, without unsubstantiated guaranteed yield claims.',
            icon: DollarSign,
          },
          {
            domain: 'AIRPROP',
            title: 'Lease Administration & Occupants',
            desc: 'Centralize lease agreements, track renewal timelines, and maintain auditable tenant relationship history.',
            icon: KeyRound,
          },
          {
            domain: 'DOCUMENTS',
            title: 'Contract Vault & Source Invoices',
            desc: 'Direct access to verified source invoices, insurance policies, and signed addenda attached to each specific unit.',
            icon: FileText,
          },
          {
            domain: 'OPERATIONS',
            title: 'Capital Repairs & Sign-Offs',
            desc: 'Complete visibility into owner-retained maintenance requests with photographic verification of completed work.',
            icon: Boxes,
          },
        ],
      },
      lifecycle: {
        badge: 'ASSET LIFECYCLE',
        title: 'Stages of Owner Engagement Across the Asset Lifecycle',
        steps: [
          {
            num: '01',
            title: 'Acquisition & Onboarding',
            desc: 'Establish asset identity in CORE and verify authenticated ownership standing.',
          },
          {
            num: '02',
            title: 'Lease Structuring',
            desc: 'Administer lease agreements and management mandates within AIRPROP.',
          },
          {
            num: '03',
            title: 'Active Operations',
            desc: 'Monitor rent collection and isolate capital contributions in FIN01.',
          },
          {
            num: '04',
            title: 'Asset Maintenance',
            desc: 'Review major repair requests and track equipment warranties.',
          },
          {
            num: '05',
            title: 'Succession & Exit',
            desc: 'Preserve unbroken provenance records for lease renewal or property sale.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'Property Owners & Portfolio Landlords',
      },
      cta: {
        title: 'Structure the management of your real estate assets',
        subtitle:
          'Consult with CLADORA enterprise advisors to assess how the platform composes for your specific residential or commercial portfolio.',
        primary: 'Initiate Portfolio Partnership',
        secondary: 'Explore Platform Architecture',
      },
    },
    fa: {
      breadcrumbs: {
        home: 'خانه',
        solutions: 'راهکارها',
        current: 'مالکان و سبد دارایی‌ها',
      },
      hero: {
        badge: 'پلتفرم عملیات دارایی‌های ملکی',
        title: 'پایش متمرکز بر املاک بدون ایجاد پایگاه‌های دادهٔ موازی',
        subtitle:
          'نظارت شفاف بر واحدهای تحت تملک، قراردادهای اجاره و هزینه‌های عملیاتی در بستری امن و متصل به متولی مرجع حقیقت مالی FIN01.',
        ctaPrimary: 'گفتگوی همکاری سبد املاک',
        ctaSecondary: 'معماری پلتفرم',
      },
      positioning: {
        badge: 'موضع‌گیری اصولی معماری',
        title: 'پورتفولیو به عنوان یک نما، نه یک جزیرهٔ داده‌ای',
        p: 'در پلتفرم کلادورا، مدیریت سبد املاک نیازمند نرم‌افزار مجزا یا پایگاه داده موازی نیست. پورتفولیو نمای ترکیبی و مجاز از روابط مالکیتی یک شخص یا سازمان در ورک‌اسپیس‌های مستقل مجتمع‌های مختلف است.',
        points: [
          {
            title: 'اتصال مستقیم به مرجع FIN01',
            desc: 'کلیه تراکنش‌های اجاره و هزینه‌های شارژ مستقیماً به سند مالی مرجع متصل هستند و از محاسبات حدسی جداگانه اجتناب می‌شود.',
          },
          {
            title: 'تفکیک ساخت‌یافته منابع مالی',
            desc: 'جداسازی شفاف هزینه‌های جاری مصرفی مستأجر از صندوق‌های تعمیرات اساسی و سرمایه‌ای متعلق به مالک.',
          },
          {
            title: 'پیوستگی قراردادها در AIRPROP',
            desc: 'پیگیری سررسید قراردادهای اجاره، ودیعه‌ها و وکالت‌های مدیریت با حفظ کامل سوابق تاریخی.',
          },
        ],
      },
      pillars: {
        badge: 'ستون‌های قابلیتی پلتفرم',
        title: 'ترکیب معماری برای مالکان و سرمایه‌گذاران',
        items: [
          {
            domain: 'FIN01',
            title: 'شفافیت مالی و تسهیم واقعی هزینه‌ها',
            desc: 'ثبت مستند سهم شارژ قانونی، اجاره‌های دریافتی و هزینه‌های استهلاک، بدون ادعاهای غیرواقعی درباره بازده تضمینی.',
            icon: DollarSign,
          },
          {
            domain: 'AIRPROP',
            title: 'مدیریت قراردادهای اجاره و مستأجران',
            desc: 'ثبت متمرکز قراردادهای اجاره، آگاهی از موعد تمدید و نگهداری تاریخچه سکونت مستأجران.',
            icon: KeyRound,
          },
          {
            domain: 'DOCUMENTS',
            title: 'بایگانی اسناد مالکیت و فاکتورها',
            desc: 'دسترسی سریع به فاکتورهای مرجع، بیمه‌نامه‌ها و الحاقیه‌های قرارداد متصل به هر واحد.',
            icon: FileText,
          },
          {
            domain: 'OPERATIONS',
            title: 'پیگیری تعمیرات اساسی و بازسازی',
            desc: 'مشاهده تیکت‌های تعمیرات مرتبط با سهم مالک با تایید تصویری انجام کار پیش از پرداخت.',
            icon: Boxes,
          },
        ],
      },
      lifecycle: {
        badge: 'چرخهٔ عمر دارایی ملکی',
        title: 'مراحل تعامل مالک با ملک در طول زمان',
        steps: [
          {
            num: '۰۱',
            title: 'تملک و ثبت در سامانه',
            desc: 'تعریف واحد در CORE و احراز رسمی موقعیت مالکیت.',
          },
          {
            num: '۰۲',
            title: 'قرارداد اجاره و بهره‌برداری',
            desc: 'تنظیم قراردادهای اجاره و شرایط مالی در AIRPROP.',
          },
          {
            num: '۰۳',
            title: 'بهره‌برداری و دریافت وجوه',
            desc: 'پایش پرداخت‌ها و تفکیک صندوق اندوخته در FIN01.',
          },
          {
            num: '۰۴',
            title: 'حفظ و نگهداری فنی',
            desc: 'بررسی هزینه‌های تعمیری عمده و پایش استهلاک.',
          },
          {
            num: '۰۵',
            title: 'تمدید، واگذاری یا فروش',
            desc: 'حفظ شناسنامه کامل سوابق برای تمدید اجاره یا عرضه مجدد ملک.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'مالکان و دارندگان سبد املاک',
      },
      cta: {
        title: 'مدیریت دارایی‌های ملکی خود را ساختاریافته کنید',
        subtitle:
          'برای ارزیابی نحوه انطباق معماری کلادورا با سبد واحدهای مسکونی یا تجاری خود با کارشناسان ما مشورت نمایید.',
        primary: 'درخواست همکاری سبد املاک',
        secondary: 'بررسی معماری پلتفرم',
      },
    },
  }[lang];

  return (
    <main className="min-h-screen pt-28 pb-20 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        
        {/* BREADCRUMBS & HERO */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-[#52667A] font-medium">
            <Link href={`/${lang}`} className="hover:text-[#102A43] transition-colors">
              {content.breadcrumbs.home}
            </Link>
            <span>/</span>
            <Link href={`/${lang}/solutions`} className="hover:text-[#102A43] transition-colors">
              {content.breadcrumbs.solutions}
            </Link>
            <span>/</span>
            <span className="text-[#102A43] font-bold">
              {content.breadcrumbs.current}
            </span>
          </div>

          <div className="card-proptech p-8 sm:p-12 bg-white border-[#D3DCE6] space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAF8F5] text-xs font-bold text-[#0A6E62] border border-[#B2E5DF]">
              <TrendingUp className="w-4 h-4 text-[#0E9F8E]" />
              <span>{content.hero.badge}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight max-w-4xl">
              {content.hero.title}
            </h1>

            <p className="text-base sm:text-lg text-[#52667A] max-w-3xl leading-relaxed">
              {content.hero.subtitle}
            </p>

            <div className="pt-2 flex flex-wrap gap-4">
              <Link
                href={`/${lang}/contact`}
                className="px-6 py-3.5 rounded-xl bg-[#0E9F8E] hover:bg-[#0C8778] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
              >
                <span>{content.hero.ctaPrimary}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>
              <Link
                href={`/${lang}/platform/architecture`}
                className="px-6 py-3.5 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#102A43] text-xs font-bold transition-all flex items-center gap-2"
              >
                <GitBranch className="w-4 h-4" />
                <span>{content.hero.ctaSecondary}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* POSITIONING */}
        <section className="card-proptech p-8 sm:p-10 bg-white border-[#E2E8F0] space-y-8">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F0F4F8] text-xs font-bold text-[#334E68]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0E9F8E]" />
              <span>{content.positioning.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43] tracking-tight">
              {content.positioning.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.positioning.p}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {content.positioning.points.map((pt, i) => (
              <div key={i} className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0E9F8E]" />
                  <h3 className="text-xs font-bold text-[#102A43]">{pt.title}</h3>
                </div>
                <p className="text-xs text-[#52667A] leading-relaxed">{pt.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* PILLARS */}
        <section className="space-y-8">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF8F5] text-xs font-bold text-[#0A6E62]">
              <Boxes className="w-3.5 h-3.5 text-[#0E9F8E]" />
              <span>{content.pillars.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43] tracking-tight">
              {content.pillars.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {content.pillars.items.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className="card-proptech p-6 bg-white border-[#E2E8F0] space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-[#F0F4F8] flex items-center justify-center text-[#102A43]">
                      <Icon className="w-5 h-5 text-[#0E9F8E]" />
                    </div>
                    <span className="px-2 py-0.5 rounded bg-[#102A43] text-white font-mono text-[10px] font-bold">
                      <bdi dir="ltr">{item.domain}</bdi>
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-[#102A43]">{item.title}</h3>
                  <p className="text-xs text-[#52667A] leading-relaxed">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* LIFECYCLE */}
        <section className="card-proptech p-8 sm:p-10 bg-white border-[#E2E8F0] space-y-8">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F0F4F8] text-xs font-bold text-[#334E68]">
              <Clock className="w-3.5 h-3.5 text-[#0E9F8E]" />
              <span>{content.lifecycle.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43] tracking-tight">
              {content.lifecycle.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {content.lifecycle.steps.map((st, i) => (
              <div key={i} className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <span className="text-xs font-mono font-bold text-[#0E9F8E]">{st.num}</span>
                <h3 className="text-xs font-bold text-[#102A43]">{st.title}</h3>
                <p className="text-[11px] text-[#52667A] leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* AVAILABILITY GOVERNANCE */}
        <AvailabilityGovernanceSection
          lang={lang}
          solutionName={content.governanceNotice.solutionName}
        />

        {/* FINAL CTA */}
        <section className="card-proptech p-8 sm:p-12 bg-white border-[#D3DCE6] text-center space-y-6">
          <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-[#102A43]">
            {content.cta.title}
          </h2>
          <p className="text-xs sm:text-sm text-[#52667A] max-w-2xl mx-auto leading-relaxed">
            {content.cta.subtitle}
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <Link
              href={`/${lang}/contact`}
              className="px-6 py-3.5 rounded-xl bg-[#0E9F8E] hover:bg-[#0C8778] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <span>{content.cta.primary}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
            <Link
              href={`/${lang}/platform/architecture`}
              className="px-6 py-3.5 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#102A43] text-xs font-bold transition-all"
            >
              {content.cta.secondary}
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
