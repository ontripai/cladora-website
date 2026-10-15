import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import { getSiteUrl } from '@/config/site';
import {
  BookOpen,
  ArrowRight,
  Layers,
  ShieldCheck,
  Building2,
  Database,
  Users,
  Compass,
  FileText,
  SlidersHorizontal,
  Info,
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
  return getRouteMetadata('/resources/guides', params.lang);
}

export default async function GuidesPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        resources: 'Resurse',
        current: 'Ghiduri & Bune Practici',
      },
      hero: {
        badge: 'Biblioteca Canonică de Ghiduri',
        title: 'Ghiduri Arhitecturale & Bune Practici în Operarea Imobiliară',
        subtitle:
          'O colecție documentată de analize profunde, cadre metodologice și explicații arhitecturale privind platformele de operare a activelor, autoritatea guvernată și adevărul canonic.',
      },
      disclaimer: {
        title: 'Notă privind Guvernanța Disponibilității',
        text: 'Ghidurile prezintă modelul arhitectural, conceptele metodologice și dimensiunile de compoziție ale platformei CLADORA. Includerea unei teme arhitecturale ilustrează unde și cum se poziționează o capabilitate în sistem și nu constituie o garanție de lansare universală sau o promisiune comercială pentru toate implementările.',
      },
      guides: [
        {
          id: 'guide-01',
          category: 'Platform Architecture',
          title: 'Înțelegerea Platformelor de Operare a Activelor Imobiliare',
          summary:
            'De ce software-ul tradițional de administrare fragmentat eșuează în fața activelor moderne și cum o platformă unificată menține continuitatea pe întreg ciclul de viață.',
          topics: [
            'PMS tradițional vs. Platformă de Operare',
            'Fragmentarea datelor și costul integrărilor ad-hoc',
            'Modelul de date unificat centrat pe activul imobiliar',
          ],
          bridge: {
            text: 'Explorează Arhitectura Platformei',
            href: `/${lang}/platform/architecture`,
          },
          icon: Building2,
        },
        {
          id: 'guide-02',
          category: 'Identity & Authority',
          title: 'Proprietate → Workspace → Relație → Autoritate',
          summary:
            'Decuplarea identității umane de permisiunile temporare: cum autoritatea contextuală previne expunerea neautorizată a datelor și garantează izolarea operațională.',
          topics: [
            'Diferențierea dintre Persoană, Rol și Autoritate',
            'Workspace-ul ca graniță de securitate și colaborare',
            'Mandate cu dată de expirare și succesiune auditabilă',
          ],
          bridge: {
            text: 'Explorează Modelul de Încredere',
            href: `/${lang}/platform/trust`,
          },
          icon: ShieldCheck,
        },
        {
          id: 'guide-03',
          category: 'Lifecycle Continuity',
          title: 'Continuitatea Ciclului de Viață al Proprietății',
          summary:
            'Cum se transferă datele tehnice, contractuale și istorice de la faza de proiect și vânzare (AIRPROP), prin predare, până la operarea zilnică.',
          topics: [
            'Faza de proiectare și definire a activului digital',
            'Predarea tehnică și handshake-ul operațional',
            'Evitarea pierderii de date la schimbarea actorilor',
          ],
          bridge: {
            text: 'Explorează Ciclul de Viață',
            href: `/${lang}/platform/lifecycle`,
          },
          icon: Compass,
        },
        {
          id: 'guide-04',
          category: 'Data Governance',
          title: 'Adevărul Canonic în Operațiunile Imobiliare',
          summary:
            'De ce reconcilierea eșuează când mai multe sisteme pretind dreptul de scriere și cum furnizorii canonici (CORE, FIN01, DOCUMENTS, BK01) asigură integritatea.',
          topics: [
            'Principiul sursei unice de adevăr canonic',
            'Separarea evenimentelor financiare (FIN01) de comenzi de lucru (OPERATIONS)',
            'Gestiunea probatorie a documentelor (DOCUMENTS)',
          ],
          bridge: {
            text: 'Explorează Capabilitățile',
            href: `/${lang}/capabilities`,
          },
          icon: Database,
        },
        {
          id: 'guide-05',
          category: 'Architecture Transition',
          title: 'De la Silozuri Legacy la Arhitectura Compozabilă',
          summary:
            'Trecerea de la aplicații monolitice rigide la module activate la cerere în funcție de arhetipul clădirii, profilul serviciilor și cerințele jurisdicționale.',
          topics: [
            'Limitările soluțiilor monolitice tradiționale',
            'Compoziția dinamică pe baza ADN-ului Clădirii',
            'Activarea selectivă a capabilităților fără rescriere',
          ],
          bridge: {
            text: 'Explorează Industriile',
            href: `/${lang}/industries`,
          },
          icon: Layers,
        },
        {
          id: 'guide-06',
          category: 'Multi-Actor Collaboration',
          title: 'Operațiuni Imobiliare cu Actori Multipli',
          summary:
            'Cum interacționează dezvoltatorii, proprietarii, asociațiile, administratorii, chiriașii și echipele de intervenție în același imobil fără amestecarea autorității.',
          topics: [
            'Roluri concurente și delimitarea vizibilității',
            'Transparență financiară autorizată pentru rezidenți',
            'Fluxuri de lucru verificate pentru prestatorii de servicii',
          ],
          bridge: {
            text: 'Explorează Soluțiile pe Actori',
            href: `/${lang}/solutions`,
          },
          icon: Users,
        },
        {
          id: 'guide-07',
          category: 'Governance & Maturity',
          title: 'Înțelegerea Disponibilității Capabilităților',
          summary:
            'Ghid de evaluare: diferențierea clară între modelul arhitectural, maturitatea de lansare la runtime, domeniul de implementare și drepturile de acces.',
          topics: [
            'Cele 4 niveluri de evaluare a unei funcționalități',
            'Controlul riscului în proiectele de digitalizare',
            'Evitarea promisiunilor neacoperite de capabilități',
          ],
          bridge: {
            text: 'Consultă Glosarul Canonic',
            href: `/${lang}/resources/glossary`,
          },
          icon: SlidersHorizontal,
        },
        {
          id: 'guide-08',
          category: 'Jurisdiction & Localization',
          title: 'Pachete de Țară & Contextul Operațional Local',
          summary:
            'Cum răspunde platforma particularităților legislative locale (exemplu: Legea 196/2018 în România) fără a compromite modelul global de date.',
          topics: [
            'Pachetul de Țară ca strat de reguli și terminologie',
            'Alinierea fluxurilor de lucru la cerințele de repartizare a costurilor',
            'Suport operațional fără pretenții de consultanță juridică',
          ],
          bridge: {
            text: 'Vezi Soluția pentru Asociații',
            href: `/${lang}/solutions/associations`,
          },
          icon: FileText,
        },
      ],
      cta: {
        title: 'Pregătești o tranziție tehnologică în portofoliul tău?',
        subtitle:
          'Echipa noastră de arhitectură poate evalua profilul activelor tale și propune o strategie de migrare sigură.',
        buttonPrimary: 'Inițiază Parteneriatul',
        buttonSecondary: 'Explorează Hub-ul de Migrare',
      },
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        resources: 'Resources',
        current: 'Guides & Best Practices',
      },
      hero: {
        badge: 'Canonical Guides Library',
        title: 'Architectural Guides & Operational Best Practices',
        subtitle:
          'A curated collection of deep architectural essays, methodology frameworks, and operational playbooks explaining property operating platforms, governed authority, and canonical truth.',
      },
      disclaimer: {
        title: 'Capability Availability & Evidence Notice',
        text: 'These guides document the architectural foundation, methodology concepts, and composable dimensions of the CLADORA platform. The presentation of an architectural domain illustrates where and how capabilities belong structurally; it does not constitute a universal runtime release guarantee or an unqualified commercial promise for every deployment.',
      },
      guides: [
        {
          id: 'guide-01',
          category: 'Platform Architecture',
          title: 'Understanding Property Operating Platforms',
          summary:
            'Why conventional fragmented property management software fails modern portfolios, and how a unified operating platform sustains operational continuity across the asset lifecycle.',
          topics: [
            'Traditional PMS vs. Property Operating Platform',
            'Data silos and the hidden costs of ad-hoc integrations',
            'Unified asset-centric data modeling',
          ],
          bridge: {
            text: 'Explore Platform Architecture',
            href: `/${lang}/platform/architecture`,
          },
          icon: Building2,
        },
        {
          id: 'guide-02',
          category: 'Identity & Authority',
          title: 'Property → Workspace → Relationship → Authority',
          summary:
            'Decoupling human identity from temporary permissions: how contextual authority boundaries prevent unauthorized data exposure and preserve governance.',
          topics: [
            'Distinguishing Person, Role, and Scoped Authority',
            'The Workspace as a collaboration and security boundary',
            'Time-bound mandates and auditable succession',
          ],
          bridge: {
            text: 'Explore Trust Architecture',
            href: `/${lang}/platform/trust`,
          },
          icon: ShieldCheck,
        },
        {
          id: 'guide-03',
          category: 'Lifecycle Continuity',
          title: 'Property Lifecycle Continuity',
          summary:
            'How technical records, commercial data, and operational provenance carry forward from pre-sales and development (AIRPROP) to active management and long-term ownership.',
          topics: [
            'Early project definition and digital asset identity',
            'Technical handover and operational handshake',
            'Preserving institutional memory across actor transitions',
          ],
          bridge: {
            text: 'Explore Platform Lifecycle',
            href: `/${lang}/platform/lifecycle`,
          },
          icon: Compass,
        },
        {
          id: 'guide-04',
          category: 'Data Governance',
          title: 'Canonical Truth in Property Operations',
          summary:
            'Why reconciliation inevitably collapses when multiple systems claim write authority, and how designated canonical providers (CORE, FIN01, DOCUMENTS, BK01) maintain system integrity.',
          topics: [
            'The single source of canonical truth principle',
            'Separating financial ledger truth (FIN01) from field execution (OPERATIONS)',
            'Evidentiary document governance (DOCUMENTS)',
          ],
          bridge: {
            text: 'Explore Capabilities',
            href: `/${lang}/capabilities`,
          },
          icon: Database,
        },
        {
          id: 'guide-05',
          category: 'Architecture Transition',
          title: 'From Legacy Silos to Composable Architecture',
          summary:
            'Moving beyond rigid monolithic suites to modular capability composition governed by building archetype, service profile, and jurisdictional context.',
          topics: [
            'The limitations of legacy monolithic stacks',
            'Dynamic composition guided by Building DNA',
            'Selective domain enablement without brittle forks',
          ],
          bridge: {
            text: 'Explore Industries',
            href: `/${lang}/industries`,
          },
          icon: Layers,
        },
        {
          id: 'guide-06',
          category: 'Multi-Actor Collaboration',
          title: 'Multi-Actor Property Operations',
          summary:
            'How developers, owners, homeowner associations, management firms, occupants, and service contractors interact in shared property contexts without cross-bleeding authority.',
          topics: [
            'Concurrent multi-stakeholder roles and access scoping',
            'Authorized financial visibility for occupants',
            'Structured work order delivery for contractors',
          ],
          bridge: {
            text: 'Explore Solutions by Actor',
            href: `/${lang}/solutions`,
          },
          icon: Users,
        },
        {
          id: 'guide-07',
          category: 'Governance & Maturity',
          title: 'Understanding Capability Availability',
          summary:
            'A framework for rigorous evaluation: distinguishing architectural model, runtime release maturity, deployment implementation scope, and user entitlement.',
          topics: [
            'The four levels of capability evaluation',
            'De-risking property technology procurement',
            'Avoiding unqualified marketing overclaims',
          ],
          bridge: {
            text: 'Consult Canonical Glossary',
            href: `/${lang}/resources/glossary`,
          },
          icon: SlidersHorizontal,
        },
        {
          id: 'guide-08',
          category: 'Jurisdiction & Localization',
          title: 'Country Packs & Local Operating Context',
          summary:
            'How the platform respects local regulatory workflows (such as Romanian Law 196/2018) without compromising global foundational architecture.',
          topics: [
            'The Country Pack as a localized rule and terminology layer',
            'Workflow alignment for cost allocation contexts',
            'Operational compliance support vs. formal legal advice',
          ],
          bridge: {
            text: 'View Associations Solution',
            href: `/${lang}/solutions/associations`,
          },
          icon: FileText,
        },
      ],
      cta: {
        title: 'Planning a technology transition for your property portfolio?',
        subtitle:
          'Our architecture team can evaluate your operational profile and design a controlled, verified migration strategy.',
        buttonPrimary: 'Start Partnership',
        buttonSecondary: 'Explore Migration Hub',
      },
    },
    fa: {
      breadcrumbs: {
        home: 'صفحه اصلی',
        resources: 'منابع',
        current: 'راهنماها و بستر معماری',
      },
      hero: {
        badge: 'کتابخانه مرجع راهنماهای معماری',
        title: 'راهنماهای معماری و روش‌های عملیاتی در مدیریت املاک',
        subtitle:
          'مجموعه‌ای ساختاریافته از مقالات عمیق معماری، متدولوژی‌های استاندارد و راهنماهای اجرایی برای تبیین پلتفرم‌های عملیات املاک، حاکمیت اختیارات و مراجع حقیقت داده‌ها.',
      },
      disclaimer: {
        title: 'یادداشت حاکمیت و شواهد دسترسی‌پذیری',
        text: 'این راهنماها تشریح‌کننده مبانی معماری، مفاهیم متدولوژیک و ابعاد ترکیب‌پذیر پلتفرم کلادورا هستند. معرفی یک قلمرو معماری، جایگاه و ساختار یک قابلیت را در کل سیستم مشخص می‌کند و به معنای در دسترس بودن بی‌قیدوشرط یا تعهد تجاری در تمام پیاده‌سازی‌ها نیست.',
      },
      guides: [
        {
          id: 'guide-01',
          category: 'معماری پلتفرم',
          title: 'شناخت پلتفرم‌های عملیات و بهره‌برداری املاک',
          summary:
            'چرا نرم‌افزارهای سنتی و جزیره‌ای مدیریت املاک در پاسخ‌گویی به نیازهای سبد دارایی‌های امروزی ناتوان هستند و چگونه یک پلتفرم یکپارچه تداوم عملیاتی را در سراسر چرخه عمر حفظ می‌کند.',
          topics: [
            'نرم‌افزار سنتی مدیریت املاک (PMS) در مقایسه با پلتفرم عملیاتی',
            'سیلوهای اطلاعاتی و هزینه‌های پنهان اتصال‌های مقطعی',
            'مدل‌سازی یکپارچه داده‌ها بر محور دارایی و ملک فیزیکی',
          ],
          bridge: {
            text: 'بررسی معماری پلتفرم',
            href: `/${lang}/platform/architecture`,
          },
          icon: Building2,
        },
        {
          id: 'guide-02',
          category: 'هویت و حدود اختیارات',
          title: 'ملک و دارایی ← Workspace ← رابطه حقوقی ← حدود اختیارات',
          summary:
            'تفکیک هویت فردی از دسترسی‌های مقطعی: چگونه مرزبندی بافت‌محور اختیارات از نشت ناخواسته داده‌ها جلوگیری کرده و حاکمیت سیستم را تضمین می‌نماید.',
          topics: [
            'تفکیک دقیق مفهوم شخص، نقش و اختیارات بافت‌محور',
            'فضای کاری (Workspace) به عنوان مرز امنیت و همکاری',
            'تفویض‌های زمان‌دار و انتقال شفاف مسئولیت‌ها با قابلیت ممیزی',
          ],
          bridge: {
            text: 'بررسی معماری اعتماد و امنیت',
            href: `/${lang}/platform/trust`,
          },
          icon: ShieldCheck,
        },
        {
          id: 'guide-03',
          category: 'تداوم چرخه عمر دارایی',
          title: 'پیوستگی اطلاعات در چرخه عمر ملک',
          summary:
            'انتقال مستمر شناسنامه فنی، سوابق تجاری و پیشینه عملیاتی از مراحل ساخت و پیش‌فروش (AIRPROP) تا تحویل قطعی و بهره‌برداری روزمره.',
          topics: [
            'تعریف اولیه پروژه و ایجاد هویت دیجیتال پایدار ملک',
            'تحویل فنی و دست‌دهی عملیاتی میان عوامل پروژه',
            'جلوگیری از انقطاع و نابودی اطلاعات هنگام تغییر پیمانکاران و مدیران',
          ],
          bridge: {
            text: 'بررسی چرخه عمر پلتفرم',
            href: `/${lang}/platform/lifecycle`,
          },
          icon: Compass,
        },
        {
          id: 'guide-04',
          category: 'حاکمیت داده‌ها',
          title: 'حقیقت مرجع (Canonical Truth) در عملیات املاک',
          summary:
            'چرا مغایرت‌گیری هنگامی که چند سامانه ادعای ثبت نهایی اطلاعات دارند با شکست مواجه می‌شود، و چگونه متولیان مرجع (CORE, FIN01, DOCUMENTS, BK01) یکپارچگی سیستم را حفظ می‌کنند.',
          topics: [
            'اصل مرجعیت واحد برای ثبت قطعی حقایق داده‌ای',
            'تفکیک رخدادهای مالی (FIN01) از اجرای دستورکارهای فنی (OPERATIONS)',
            'حاکمیت و اصالت اسناد و شواهد در دامنه DOCUMENTS',
          ],
          bridge: {
            text: 'بررسی معماری قابلیت‌ها',
            href: `/${lang}/capabilities`,
          },
          icon: Database,
        },
        {
          id: 'guide-05',
          category: 'گذار از ساختارهای سنتی',
          title: 'گذار از ساختارهای بسته قدیمی به معماری ترکیب‌پذیر',
          summary:
            'حرکت فراتر از بسته‌های یکپارچه و انعطاف‌ناپذیر قدیمی به سوی ترکیبی مدولار از قابلیت‌ها که با توجه به ساختار فیزیکی، کاربری و الزامات قانونی فعال می‌گردند.',
          topics: [
            'محدودیت‌های ساختارهای بسته نرم‌افزارهای سنتی',
            'ترکیب پویا بر مبنای مشخصات ساختمانی (Building DNA)',
            'فعال‌سازی گزینشی قابلیت‌ها بدون نیاز به انشعاب کدهای اختصاصی',
          ],
          bridge: {
            text: 'بررسی معماری صنایع',
            href: `/${lang}/industries`,
          },
          icon: Layers,
        },
        {
          id: 'guide-06',
          category: 'همکاری چندجانبه',
          title: 'عملیات چندجانبه در بستر دارایی‌های مشترک',
          summary:
            'نحوه تعامل سازندگان، مالکان، هیئت‌مدیره، شرکت‌های مدیریت، مستأجران و پیمانکاران در یک فضای مشترک بدون تداخل در اختیارات و نقض محرمانگی.',
          topics: [
            'هم‌زمانی چند نقش و تعیین دقیق حدود رویت‌پذیری',
            'شفافیت مالی مجاز و کنترل‌شده برای بهره‌برداران',
            'گردش‌کارهای ساختاریافته برای مجریان و پیمانکاران فنی',
          ],
          bridge: {
            text: 'بررسی راهکارها بر اساس مخاطبان',
            href: `/${lang}/solutions`,
          },
          icon: Users,
        },
        {
          id: 'guide-07',
          category: 'حاکمیت و بلوغ سامانه',
          title: 'درک سطوح دسترسی‌پذیری و بلوغ قابلیت‌ها',
          summary:
            'چارچوبی برای ارزیابی واقع‌گرایانه: تفکیک دقیق مدل معماری، بلوغ اجرایی در زمان اجرا (Runtime)، دامنه پیاده‌سازی سازمانی و مجوزهای دسترسی کاربران.',
          topics: [
            'چهار لایه اساسی در ارزیابی واقعی یک قابلیت فنی',
            'کاهش ریسک در خرید و استقرار فناوری‌های مدیریت املاک',
            'پرهیز از ادعاهای تبلیغاتی و وعده‌های فنی اثبات‌نشده',
          ],
          bridge: {
            text: 'مشاهده واژه‌نامه مرجع اصطلاحات',
            href: `/${lang}/resources/glossary`,
          },
          icon: SlidersHorizontal,
        },
        {
          id: 'guide-08',
          category: 'بومی‌سازی و الزامات قانونی',
          title: 'بسته‌های کشوری و زمینه عملیاتی محلی',
          summary:
            'چگونگی انطباق پلتفرم با الزامات قانونی و اداری حوزه‌های قضایی گوناگون (مانند قانون 196/2018 رومانی) بدون مخدوش شدن ساختار بنیادین معماری سراسری.',
          topics: [
            'بسته کشوری (Country Pack) به عنوان لایه منطبق بر قوانین محلی',
            'سازگاری با الگوهای تسهیم هزینه و تسهیم شارژ در مجتمع‌ها',
            'پشتیبانی عملیاتی بدون ادعای ارائه خدمات مشاوره حقوقی',
          ],
          bridge: {
            text: 'مشاهده راهکار انجمن‌های مالکان',
            href: `/${lang}/solutions/associations`,
          },
          icon: FileText,
        },
      ],
      cta: {
        title: 'در حال برنامه‌ریزی برای نوسازی فناورانه سبد املاک خود هستید؟',
        subtitle:
          'تیم فنی و معماری ما آماده بررسی ساختار دارایی‌ها و ارائه استراتژی مطمئن برای مهاجرت ایمن اطلاعات است.',
        buttonPrimary: 'درخواست شروع همکاری',
        buttonSecondary: 'مشاهده پایگاه مهاجرت اطلاعات',
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
        name: content.breadcrumbs.resources,
        item: `${baseUrl}/${lang}/resources`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: content.breadcrumbs.current,
        item: `${baseUrl}/${lang}/resources/guides`,
      },
    ],
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#52667A]">
          <Link href={`/${lang}`} className="hover:text-[#102A43] transition-colors">
            {content.breadcrumbs.home}
          </Link>
          <span className="text-[#9FB3C8]">/</span>
          <Link href={`/${lang}/resources`} className="hover:text-[#102A43] transition-colors">
            {content.breadcrumbs.resources}
          </Link>
          <span className="text-[#9FB3C8]">/</span>
          <span className="text-[#102A43] font-bold" aria-current="page">
            {content.breadcrumbs.current}
          </span>
        </nav>

        {/* Hero Section */}
        <div className="max-w-3xl space-y-4">
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

        {/* Governance & Availability Disclaimer Box */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#D3DCE6] shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="font-bold text-[#102A43]">{content.disclaimer.title}</div>
            <div className="text-[#52667A] leading-relaxed">{content.disclaimer.text}</div>
          </div>
        </div>

        {/* Guides Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {content.guides.map((guide) => {
            const Icon = guide.icon;
            return (
              <article
                key={guide.id}
                className="bg-white rounded-2xl p-7 sm:p-8 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider bg-[#EAF8F5] px-3 py-1 rounded-full border border-[#B2E5DF]">
                      {guide.category}
                    </span>
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-[#102A43] leading-snug">
                    {guide.title}
                  </h2>

                  <p className="text-sm text-[#52667A] leading-relaxed">
                    {guide.summary}
                  </p>

                  <div className="pt-2 border-t border-slate-100">
                    <div className="text-xs font-bold text-[#102A43] uppercase tracking-wider mb-2">
                      {lang === 'ro' ? 'Teme Cheie Abordate' : lang === 'fa' ? 'محورهای کلیدی مورد بحث' : 'Core Focus Topics'}
                    </div>
                    <ul className="space-y-1.5 text-xs text-[#52667A]">
                      {guide.topics.map((topic, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-[#0E9F8E] font-bold">•</span>
                          <span>{topic}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between text-xs sm:text-sm font-semibold text-[#0E9F8E]">
                  <Link
                    href={guide.bridge.href}
                    className="hover:underline inline-flex items-center gap-1.5 group"
                  >
                    <span>{guide.bridge.text}</span>
                    <ArrowRight className="w-4 h-4 rtl:rotate-180 group-hover:translate-x-1 rtl:group-hover:-translate-x-1 transition-transform" />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        {/* Partnership & Migration Bridge Box */}
        <div className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 shadow-elevated text-center max-w-4xl mx-auto space-y-6">
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
              href={`/${lang}/resources/migration-hub`}
              className="px-6 py-3.5 rounded-xl bg-white/10 text-white text-xs sm:text-sm font-semibold hover:bg-white/20 transition border border-white/15"
            >
              {content.cta.buttonSecondary}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
