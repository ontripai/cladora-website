import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import { getSiteUrl } from '@/config/site';
import {
  BookOpen,
  ArrowRight,
  Compass,
  Shield,
  HelpCircle,
  BookA,
  Building2,
  Layers,
  Cpu,
  Users,
  Info,
  CheckCircle2,
  FileText,
} from 'lucide-react';

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

export default async function ResourcesHubPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        current: 'Centru de Resurse & Cunoaștere',
      },
      hero: {
        badge: 'Arhitectura de Cunoaștere & Documentație',
        title: 'Centrul Oficial de Cunoaștere, Bune Practici & Încredere',
        subtitle:
          'Explorare aprofundată a platformelor de operare a proprietăților, metodologiei de migrare a patrimoniului, securității datelor și glosarului canonic de termeni.',
      },
      categories: {
        title: 'Categorii Principale de Cunoaștere',
        items: [
          {
            title: 'Ghiduri & Bune Practici',
            desc: 'Analize aprofundate privind decuplarea identității, continuitatea ciclului de viață și adevărul canonic.',
            href: `/${lang}/resources/guides`,
            icon: BookOpen,
            action: 'Deschide Biblioteca de Ghiduri',
          },
          {
            title: 'Hub de Migrare',
            desc: 'Metodologie controlată de import, principiul Zero-Write, inventarierea surselor și rularea de validare paralelă.',
            href: `/${lang}/resources/migration-hub`,
            icon: Compass,
            action: 'Explorează Metodologia de Migrare',
          },
          {
            title: 'Securitate & Încredere',
            desc: 'Granițe delimitate la nivel de workspace, guvernanță aliniată GDPR, jurnalizare aditivă și supraveghere AI.',
            href: `/${lang}/resources/security`,
            icon: Shield,
            action: 'Vezi Arhitectura de Securitate',
          },
          {
            title: 'Întrebări Frecvente (FAQ)',
            desc: 'Răspunsuri fundamentate tehnic structurate pe 10 domenii: platformă, autoritate, capabilități și industrie.',
            href: `/${lang}/faq`,
            icon: HelpCircle,
            action: 'Consultă Întrebările Frecvente',
          },
          {
            title: 'Glosar Canonic de Termeni',
            desc: 'Definițiile oficiale ale celor 30 de concepte cheie din ecosistemul CLADORA (CORE, FIN01, DOCUMENTS, etc.).',
            href: `/${lang}/resources/glossary`,
            icon: BookA,
            action: 'Accesează Glosarul Canonic',
          },
        ],
      },
      startPlatform: {
        badge: 'Fundația Tehnologică',
        title: 'Începe cu Conceptele Fundamentale ale Platformei',
        desc: 'Pentru a înțelege cum funcționează CLADORA, este esențial să parcurgi cele trei dimensiuni fundamentale ale arhitecturii:',
        links: [
          {
            title: 'Arhitectura Platformei',
            desc: 'Cum separăm identitatea fizică a proprietății de spațiile de lucru și permisiuni.',
            href: `/${lang}/platform/architecture`,
          },
          {
            title: 'Ciclul de Viață al Activului',
            desc: 'Tranziția continuă a datelor de la dezvoltare (AIRPROP) până la operare zilnică.',
            href: `/${lang}/platform/lifecycle`,
          },
          {
            title: 'Centrul de Încredere & Guvernanță',
            desc: 'Cum guvernează furnizorii canonici integritatea registrelor și a documentelor.',
            href: `/${lang}/platform/trust`,
          },
        ],
      },
      audienceExplore: {
        title: 'Explorează Resursele pe Contexte de Actori',
        desc: 'Documentație adaptată modului în care rolul tău interacționează cu proprietatea:',
        items: [
          { name: 'Dezvoltatori & Constructori', href: `/${lang}/solutions/developers` },
          { name: 'Proprietari & Portofolii', href: `/${lang}/solutions/property-owners` },
          { name: 'Asociații de Proprietari', href: `/${lang}/solutions/associations` },
          { name: 'Companii de Administrare', href: `/${lang}/solutions/property-managers` },
          { name: 'Rezidenți & Ocupanți', href: `/${lang}/solutions/residents` },
          { name: 'Furnizori de Servicii', href: `/${lang}/solutions/service-providers` },
        ],
      },
      industryExplore: {
        title: 'Compoziția pe Industriile Construite',
        desc: 'Descoperă cum se aplică arhitectura compozabilă în funcție de arhetipul clădirii:',
        items: [
          { name: 'Rezidențial', href: `/${lang}/industries#residential` },
          { name: 'Birouri & Workplace', href: `/${lang}/industries#office` },
          { name: 'Retail & Mall-uri', href: `/${lang}/industries#retail` },
          { name: 'Ospitalitate & Hoteluri', href: `/${lang}/industries#hospitality` },
          { name: 'Industrial & Producție', href: `/${lang}/industries#industrial` },
          { name: 'Logistică & Depozitare', href: `/${lang}/industries#logistics` },
          { name: 'Auto & Showroom-uri', href: `/${lang}/industries#automotive` },
          { name: 'Ansambluri Mixte', href: `/${lang}/industries#mixed-use` },
        ],
      },
      capabilityExplore: {
        title: 'Cadrul Canonic al Capabilităților',
        desc: 'Cele 14 familii de capabilități structurate în jurul furnizorilor de adevăr:',
        items: [
          { name: 'Fundația CORE & Workspace-uri', href: `/${lang}/capabilities` },
          { name: 'Adevăr Financiar în FIN01', href: `/${lang}/capabilities` },
          { name: 'Evidență Documentară în DOCUMENTS', href: `/${lang}/capabilities` },
          { name: 'Operațiuni în Teren (SERVICE & OPERATIONS)', href: `/${lang}/service` },
          { name: 'Ciclul Comercial (AIRPROP)', href: `/${lang}/airprop` },
          { name: 'Experiență & Comunitate (C&E)', href: `/${lang}/community-experience` },
          { name: 'Inteligență Guvernată (CLADORA AI)', href: `/${lang}/ai` },
        ],
      },
      availabilityNotice: {
        title: 'Notă de Guvernanță a Disponibilității & Probelor',
        text: 'Materialele din acest Centru de Resurse descriu arhitectura, conceptele de modelare și bunele practici ale platformei CLADORA. Prezentarea unei capabilități reflectă încadrarea sa canonică în sistem și nu constituie o garanție de activare automată în toate instanțele operaționale. Disponibilitatea runtime, drepturile de acces și domeniul de implementare se stabilesc conform acordurilor contractuale specifice.',
      },
      cta: {
        title: 'Inițiază o discuție tehnică cu echipa de arhitectură',
        subtitle:
          'Specialiștii noștri pot evalua portofoliul tău imobiliar și structura un plan de configurare adaptat nevoilor tale de administrare.',
        buttonPrimary: 'Solicită Parteneriat',
        buttonSecondary: 'Consultă Întrebările Frecvente',
      },
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        current: 'Resources & Knowledge Center',
      },
      hero: {
        badge: 'Knowledge Architecture & Documentation',
        title: 'Official Knowledge Center, Best Practices & Trust Foundation',
        subtitle:
          'Deep architectural insights into property operating platforms, controlled migration methodologies, data security, and our canonical glossary of terms.',
      },
      categories: {
        title: 'Core Knowledge Categories',
        items: [
          {
            title: 'Guides & Best Practices',
            desc: 'Deep architectural essays on identity decoupling, lifecycle continuity, and canonical truth.',
            href: `/${lang}/resources/guides`,
            icon: BookOpen,
            action: 'Open Guides Library',
          },
          {
            title: 'Migration Hub',
            desc: 'A controlled transition methodology, the Zero-Write principle, source inventories, and shadow validation runs.',
            href: `/${lang}/resources/migration-hub`,
            icon: Compass,
            action: 'Explore Migration Methodology',
          },
          {
            title: 'Security & Trust',
            desc: 'Workspace-scoped boundaries, GDPR-aligned data governance, append-only audit logging, and AI oversight.',
            href: `/${lang}/resources/security`,
            icon: Shield,
            action: 'View Security Architecture',
          },
          {
            title: 'Frequently Asked Questions (FAQ)',
            desc: 'Grounded, technical answers organized across 10 critical domains including platform, authority, and capabilities.',
            href: `/${lang}/faq`,
            icon: HelpCircle,
            action: 'View Canonical FAQ',
          },
          {
            title: 'Canonical Glossary of Terms',
            desc: 'Authoritative definitions of 30 core entities, canonical truth providers (CORE, FIN01, DOCUMENTS), and composable dimensions.',
            href: `/${lang}/resources/glossary`,
            icon: BookA,
            action: 'Access Canonical Glossary',
          },
        ],
      },
      startPlatform: {
        badge: 'Platform Foundation',
        title: 'Start With Foundational Architectural Concepts',
        desc: 'To understand the mechanics of CLADORA, explore our core platform architecture dimensions:',
        links: [
          {
            title: 'Platform Architecture',
            desc: 'How we separate physical property identity from organizational workspaces and roles.',
            href: `/${lang}/platform/architecture`,
          },
          {
            title: 'Asset Lifecycle Continuity',
            desc: 'Seamless data flow from development (AIRPROP) to active day-to-day operations.',
            href: `/${lang}/platform/lifecycle`,
          },
          {
            title: 'Trust & Governance Foundation',
            desc: 'How canonical truth providers govern ledger and document records to reduce ambiguity.',
            href: `/${lang}/platform/trust`,
          },
        ],
      },
      audienceExplore: {
        title: 'Explore Resources by Participant Context',
        desc: 'Documentation aligned with how your role interacts with the property:',
        items: [
          { name: 'Developers & Builders', href: `/${lang}/solutions/developers` },
          { name: 'Property Owners & Portfolios', href: `/${lang}/solutions/property-owners` },
          { name: 'Homeowner Associations', href: `/${lang}/solutions/associations` },
          { name: 'Property Management Firms', href: `/${lang}/solutions/property-managers` },
          { name: 'Residents & Occupants', href: `/${lang}/solutions/residents` },
          { name: 'Service Providers', href: `/${lang}/solutions/service-providers` },
        ],
      },
      industryExplore: {
        title: 'Composable Framework across Built Industries',
        desc: 'Explore how the unified architecture composes across physical property typologies:',
        items: [
          { name: 'Residential', href: `/${lang}/industries#residential` },
          { name: 'Office & Workplace', href: `/${lang}/industries#office` },
          { name: 'Retail & Shopping Malls', href: `/${lang}/industries#retail` },
          { name: 'Hospitality & Hotels', href: `/${lang}/industries#hospitality` },
          { name: 'Industrial & Manufacturing', href: `/${lang}/industries#industrial` },
          { name: 'Logistics & Warehousing', href: `/${lang}/industries#logistics` },
          { name: 'Automotive Facilities', href: `/${lang}/industries#automotive` },
          { name: 'Mixed-Use Developments', href: `/${lang}/industries#mixed-use` },
        ],
      },
      capabilityExplore: {
        title: 'Canonical Capabilities Architecture',
        desc: 'The 14 capability families anchored to authoritative truth providers:',
        items: [
          { name: 'CORE Foundation & Workspaces', href: `/${lang}/capabilities` },
          { name: 'Financial Truth in FIN01', href: `/${lang}/capabilities` },
          { name: 'Document Provenance in DOCUMENTS', href: `/${lang}/capabilities` },
          { name: 'Field Maintenance (SERVICE & OPERATIONS)', href: `/${lang}/service` },
          { name: 'Commercial Lifecycle (AIRPROP)', href: `/${lang}/airprop` },
          { name: 'Experience Composition (C&E)', href: `/${lang}/community-experience` },
          { name: 'Governed AI (CLADORA Intelligence)', href: `/${lang}/ai` },
        ],
      },
      availabilityNotice: {
        title: 'Availability Governance & Evidence Notice',
        text: 'The documentation presented in this Knowledge Center illustrates the architectural model, data schemas, and best practices of the CLADORA platform. Presenting an architectural capability indicates its structural domain ownership; it does not constitute an unconditional guarantee of universal runtime release across every deployment. Runtime availability and entitlement are governed by contractual implementation scopes.',
      },
      cta: {
        title: 'Initiate an architectural consultation with our team',
        subtitle:
          'Our enterprise specialists can evaluate your operational profile and design a tailored workspace configuration roadmap.',
        buttonPrimary: 'Start Partnership',
        buttonSecondary: 'View FAQ',
      },
    },
    fa: {
      breadcrumbs: {
        home: 'صفحه اصلی',
        current: 'مرکز دانش و منابع رسمی',
      },
      hero: {
        badge: 'معماری دانش و مستندات رسمی',
        title: 'مرکز رسمی دانش، متدولوژی‌های عملیاتی و مبانی اعتماد',
        subtitle:
          'تبیین عمیق پلتفرم‌های عملیات املاک، روش‌شناسی کنترل‌شده مهاجرت سوابق، امنیت داده‌ها و واژه‌نامه مرجع اصطلاحات.',
      },
      categories: {
        title: 'محورهای اصلی پایگاه دانش',
        items: [
          {
            title: 'راهنماها و بستر معماری',
            desc: 'مقالات تحلیلی عمیق درباره تفکیک هویت، پیوستگی چرخه عمر دارایی و مراجع حقیقت داده‌ها.',
            href: `/${lang}/resources/guides`,
            icon: BookOpen,
            action: 'مشاهده کتابخانه راهنماها',
          },
          {
            title: 'پایگاه مهاجرت اطلاعات',
            desc: 'متدولوژی کنترل‌شده انتقال اطلاعات، اصل Zero-Write، شناسایی منابع و اعتبارسنجی موازی.',
            href: `/${lang}/resources/migration-hub`,
            icon: Compass,
            action: 'بررسی متدولوژی مهاجرت',
          },
          {
            title: 'امنیت و اعتماد',
            desc: 'مرزهای تفکیک‌شده فضاهای کاری، حاکمیت منطبق بر GDPR، لاگ‌های ممیزی ترتیبی و نظارت بر AI.',
            href: `/${lang}/resources/security`,
            icon: Shield,
            action: 'مشاهده معماری امنیت',
          },
          {
            title: 'پرسش‌های متداول (FAQ)',
            desc: 'پاسخ‌های فنی و مستند به پرسش‌های رایج در ۱۰ حوزه اصلی از جمله پلتفرم، اختیارات و قابلیت‌ها.',
            href: `/${lang}/faq`,
            icon: HelpCircle,
            action: 'مشاهده پرسش‌های متداول',
          },
          {
            title: 'واژه‌نامه مرجع اصطلاحات',
            desc: 'تعاریف رسمی از ۳۰ مفهوم کلیدی اکوسیستم کلادورا (CORE, FIN01, DOCUMENTS و غیره).',
            href: `/${lang}/resources/glossary`,
            icon: BookA,
            action: 'مشاهده واژه‌نامه رسمی',
          },
        ],
      },
      startPlatform: {
        badge: 'زیرساخت پلتفرم',
        title: 'آغاز با مفاهیم بنیادین معماری کلادورا',
        desc: 'برای درک سازوکار عملکرد کلادورا، پیشنهاد می‌شود ابتدا با سه بعد اصلی معماری آشنا شوید:',
        links: [
          {
            title: 'معماری پلتفرم',
            desc: 'چگونگی تفکیک هویت فیزیکی ملک از فضاهای کاری و دسترسی‌های کاربران.',
            href: `/${lang}/platform/architecture`,
          },
          {
            title: 'پیوستگی چرخه عمر دارایی',
            desc: 'انتقال پیوسته داده‌ها از فاز توسعه (AIRPROP) تا بهره‌برداری روزمره.',
            href: `/${lang}/platform/lifecycle`,
          },
          {
            title: 'مرکز اعتماد و حاکمیت داده‌ها',
            desc: 'چگونگی مدیریت اصالت دفاتر مالی و اسناد توسط متولیان مرجع جهت کاهش ابهام داده‌ها.',
            href: `/${lang}/platform/trust`,
          },
        ],
      },
      audienceExplore: {
        title: 'بررسی منابع بر اساس جایگاه مخاطبان',
        desc: 'مستنداتی متناسب با نحوه تعامل نقش و تخصص شما با ملک:',
        items: [
          { name: 'سازندگان و توسعه‌دهندگان', href: `/${lang}/solutions/developers` },
          { name: 'مالکان و صاحبان سبد املاک', href: `/${lang}/solutions/property-owners` },
          { name: 'انجمن‌های مالکان و هیئت‌مدیره', href: `/${lang}/solutions/associations` },
          { name: 'شرکت‌های مدیریت املاک', href: `/${lang}/solutions/property-managers` },
          { name: 'ساکنان و بهره‌برداران', href: `/${lang}/solutions/residents` },
          { name: 'پیمانکاران و ارائه‌دهندگان خدمات', href: `/${lang}/solutions/service-providers` },
        ],
      },
      industryExplore: {
        title: 'ترکیب‌پذیری در صنایع ساختمانی گوناگون',
        desc: 'نحوه انطباق معماری یکپارچه بر اساس ویژگی‌های کالبدی و فنی هر ساختمان:',
        items: [
          { name: 'املاک مسکونی', href: `/${lang}/industries#residential` },
          { name: 'اداری و دفاتر کار', href: `/${lang}/industries#office` },
          { name: 'تجاری و مراکز خرید', href: `/${lang}/industries#retail` },
          { name: 'اقامتی و هتلداری', href: `/${lang}/industries#hospitality` },
          { name: 'صنعتی و کارخانجات', href: `/${lang}/industries#industrial` },
          { name: 'لجستیک و انبارداری', href: `/${lang}/industries#logistics` },
          { name: 'املاک خودرویی', href: `/${lang}/industries#automotive` },
          { name: 'مجتمع‌های چندمنظوره', href: `/${lang}/industries#mixed-use` },
        ],
      },
      capabilityExplore: {
        title: 'چارچوب متولیان مرجع قابلیت‌ها',
        desc: '۱۴ خانواده قابلیتی متکی بر مراجع رسمی ثبت داده‌ها:',
        items: [
          { name: 'زیرساخت CORE و فضاهای کاری', href: `/${lang}/capabilities` },
          { name: 'حقیقت مالی در FIN01', href: `/${lang}/capabilities` },
          { name: 'اصالت مدارک در DOCUMENTS', href: `/${lang}/capabilities` },
          { name: 'عملیات فنی و نگهداری (SERVICE & OPERATIONS)', href: `/${lang}/service` },
          { name: 'چرخه تجاری معاملات (AIRPROP)', href: `/${lang}/airprop` },
          { name: 'تجربه و جامعه کاربری (C&E)', href: `/${lang}/community-experience` },
          { name: 'هوش عملیاتی مقید (CLADORA AI)', href: `/${lang}/ai` },
        ],
      },
      availabilityNotice: {
        title: 'یادداشت حاکمیت بر دسترسی‌پذیری و شواهد فنی',
        text: 'مطالب ارائه‌شده در این مرکز دانش، تبیین‌کننده مدل معماری، ساختار داده‌ها و الگوهای فنی پلتفرم کلادورا هستند. معرفی یک قابلیت بیانگر جایگاه ساختاری آن در معماری است و به معنای تضمین فعال بودن بی‌قیدوشرط در همه پیاده‌سازی‌ها نیست. دسترسی‌پذیری زمان اجرا و سطح دسترسی‌ها بر اساس توافقات قراردادی هر پروژه تعیین می‌گردد.',
      },
      cta: {
        title: 'گفت‌وگوی فنی با تیم معماری و پشتیبانی',
        subtitle:
          'کارشناسان ما آماده بررسی ویژگی‌های سبد املاک و تدوین برنامه راه‌اندازی متناسب با ساختار سازمانی شما هستند.',
        buttonPrimary: 'درخواست شروع همکاری',
        buttonSecondary: 'مشاهده پرسش‌های متداول',
      },
    },
  }[lang];

  const baseUrl = getSiteUrl();

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: content.breadcrumbs.home,
        item: `${baseUrl}/${lang}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: content.breadcrumbs.current,
        item: `${baseUrl}/${lang}/resources`,
      },
    ],
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* 01: BREADCRUMBS & HERO */}
        <div className="space-y-4">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#52667A]">
            <Link href={`/${lang}`} className="hover:text-[#102A43] transition-colors">
              {content.breadcrumbs.home}
            </Link>
            <span className="text-[#9FB3C8]">/</span>
            <span className="text-[#102A43] font-bold" aria-current="page">
              {content.breadcrumbs.current}
            </span>
          </nav>

          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-[#0E9F8E] text-xs font-semibold">
              <BookOpen className="w-3.5 h-3.5" />
              <span>{content.hero.badge}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#102A43] tracking-tight">
              {content.hero.title}
            </h1>
            <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
              {content.hero.subtitle}
            </p>
          </div>
        </div>

        {/* 02: KNOWLEDGE CATEGORIES (CARDS) */}
        <section className="space-y-6">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43]">
            {content.categories.title}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.categories.items.map((cat, idx) => {
              const Icon = cat.icon;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-7 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="w-11 h-11 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-xl font-bold text-[#102A43]">{cat.title}</h3>
                    <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">{cat.desc}</p>
                  </div>
                  <div className="pt-3 border-t border-slate-100">
                    <Link
                      href={cat.href}
                      className="text-xs sm:text-sm font-semibold text-[#0E9F8E] hover:underline inline-flex items-center gap-1.5 group"
                    >
                      <span>{cat.action}</span>
                      <ArrowRight className="w-4 h-4 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 03: START WITH THE PLATFORM */}
        <section className="bg-white rounded-3xl p-8 sm:p-10 border border-[#E2E8F0] shadow-sm space-y-6">
          <div className="max-w-2xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3 py-1 rounded-full border border-[#B2E5DF]">
              {content.startPlatform.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43]">
              {content.startPlatform.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.startPlatform.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {content.startPlatform.links.map((linkItem, idx) => (
              <Link
                key={idx}
                href={linkItem.href}
                className="p-5 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] hover:border-[#0E9F8E] transition-all group flex flex-col justify-between space-y-3"
              >
                <div>
                  <h3 className="text-base font-bold text-[#102A43] group-hover:text-[#0E9F8E] transition-colors">
                    {linkItem.title}
                  </h3>
                  <p className="text-xs text-[#52667A] leading-relaxed mt-1">{linkItem.desc}</p>
                </div>
                <div className="text-xs font-semibold text-[#0E9F8E] inline-flex items-center gap-1">
                  <span>{lang === 'ro' ? 'Descoperă' : lang === 'fa' ? 'بررسی بیشتر' : 'Explore'}</span>
                  <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 09, 10, 11: EXPLORE BY AUDIENCE / INDUSTRY / CAPABILITY */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Audience */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#0E9F8E]">
              <Users className="w-5 h-5" />
              <h3 className="text-base font-bold text-[#102A43]">{content.audienceExplore.title}</h3>
            </div>
            <p className="text-xs text-[#52667A]">{content.audienceExplore.desc}</p>
            <ul className="space-y-2 text-xs font-medium">
              {content.audienceExplore.items.map((item, idx) => (
                <li key={idx}>
                  <Link
                    href={item.href}
                    className="text-[#52667A] hover:text-[#0E9F8E] flex items-center justify-between group py-1"
                  >
                    <span>{item.name}</span>
                    <ArrowRight className="w-3 h-3 rtl:rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Industry */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#0E9F8E]">
              <Layers className="w-5 h-5" />
              <h3 className="text-base font-bold text-[#102A43]">{content.industryExplore.title}</h3>
            </div>
            <p className="text-xs text-[#52667A]">{content.industryExplore.desc}</p>
            <ul className="space-y-2 text-xs font-medium">
              {content.industryExplore.items.map((item, idx) => (
                <li key={idx}>
                  <Link
                    href={item.href}
                    className="text-[#52667A] hover:text-[#0E9F8E] flex items-center justify-between group py-1"
                  >
                    <span>{item.name}</span>
                    <ArrowRight className="w-3 h-3 rtl:rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Capability */}
          <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-[#0E9F8E]">
              <Cpu className="w-5 h-5" />
              <h3 className="text-base font-bold text-[#102A43]">{content.capabilityExplore.title}</h3>
            </div>
            <p className="text-xs text-[#52667A]">{content.capabilityExplore.desc}</p>
            <ul className="space-y-2 text-xs font-medium">
              {content.capabilityExplore.items.map((item, idx) => (
                <li key={idx}>
                  <Link
                    href={item.href}
                    className="text-[#52667A] hover:text-[#0E9F8E] flex items-center justify-between group py-1"
                  >
                    <span>{item.name}</span>
                    <ArrowRight className="w-3 h-3 rtl:rotate-180 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 12: AVAILABILITY & EVIDENCE NOTE */}
        <section className="bg-white rounded-2xl p-6 sm:p-7 border border-[#D3DCE6] shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="font-bold text-[#102A43]">{content.availabilityNotice.title}</div>
            <div className="text-[#52667A] leading-relaxed">{content.availabilityNotice.text}</div>
          </div>
        </section>

        {/* 13: PARTNERSHIP CTA */}
        <section className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 shadow-elevated text-center max-w-4xl mx-auto space-y-6">
          <h2 className="text-2xl sm:text-3xl font-bold">{content.cta.title}</h2>
          <p className="text-slate-300 text-sm sm:text-base max-w-2xl mx-auto leading-relaxed">
            {content.cta.subtitle}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
            <Link
              href={`/${lang}/contact`}
              className="px-6 py-3.5 rounded-xl bg-[#0E9F8E] text-white text-xs sm:text-sm font-semibold hover:bg-[#0C8778] transition shadow-card"
            >
              {content.cta.buttonPrimary}
            </Link>
            <Link
              href={`/${lang}/faq`}
              className="px-6 py-3.5 rounded-xl bg-white/10 text-white text-xs sm:text-sm font-semibold hover:bg-white/20 transition border border-white/15"
            >
              {content.cta.buttonSecondary}
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
