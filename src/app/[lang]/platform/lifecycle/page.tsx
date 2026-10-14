import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Building2, 
  Sparkles, 
  KeyRound, 
  Home, 
  Wrench, 
  TrendingUp, 
  RefreshCw, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileCheck2,
  Users,
  Compass,
  FileText,
  Clock,
  Layers
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
  return getRouteMetadata('/platform/lifecycle', params.lang);
}

export default async function PlatformLifecyclePage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumb: { home: 'Acasă', platform: 'Platformă', current: 'Ciclul de Viață al Proprietății' },
      hero: {
        badge: 'CONTINUITATE NON-LINIARĂ PE TERMEN LUNG',
        title: 'Ciclul de Viață al Proprietății în CLADORA',
        subtitle:
          'Oamenii, administratorii și firmele de servicii se succed în timp. Contextele operaționale se schimbă. Proprietatea fizică rămâne subiectul persistent al evidențelor autorizate.',
      },
      paradigm: {
        badge: 'PARADIGMA NON-LINIARĂ',
        title: 'De ce ciclul de viață nu este o linie dreaptă rigidă',
        desc: 'În lumea reală, proprietățile nu urmează o bandă rulantă simplistă: o clădire poate fi concomitent locuită, parțial în renovare, cu spații de vânzare sau închiriere și cu schimbări de mandate de administrare. Arhitectura CLADORA permite intrarea în sistem la oricare dintre etape, păstrând firul roșu al provenienței.',
      },
      coverageNote:
        'Ciclul de viață ilustrează modul în care arhitectura CLADORA organizează contextele proprietății în timp. Fluxurile individuale și disponibilitatea depind de domeniile configurate, pachetele de țară și capabilitățile lansate.',
      phasesTitle: 'Cele 10 Etape ale Ciclului de Viață Imobiliar',
      phases: [
        {
          num: '01',
          name: 'DEFINIRE / PROIECT',
          desc: 'Contextul arhitectural acoperă identitatea inițială a terenului și a corpurilor de clădire, structurarea unităților, stabilirea cotelor-părți și inițializarea seifului tehnic digital.',
        },
        {
          num: '02',
          name: 'PRE-VÂNZARE & REZERVĂRI',
          desc: 'Poate cuprinde evidența oportunităților calificate, antecontractele, urmărirea avansurilor și opțiunile tehnice de finisaje.',
        },
        {
          num: '03',
          name: 'TRANZACȚIE / ACHIZIȚIE',
          desc: 'Acoperă formalizarea contractelor de vânzare-cumpărare, stabilirea deținătorului canonic de drepturi și activarea primelor mandate de proprietate.',
        },
        {
          num: '04',
          name: 'PREDARE-PRIMIRE (HANDOVER)',
          desc: 'Fluxurile de predare pot include protocoale de recepție (completă sau etapizată), liste de remedieri (punch-list) și indexurile inițiale de contor.',
        },
        {
          num: '05',
          name: 'EXPLOATARE ZILNICĂ',
          desc: 'Contextul operațional cuprinde repartizarea cotelor statutare de întreținere, reconcilierea bancară, avizierul digital și fluxurile de adunare generală sau vot.',
        },
        {
          num: '06',
          name: 'MENTENANȚĂ & PĂSTRARE ACTIV',
          desc: 'Poate include registrul de echipamente tehnice (ascensoare, centrale, pompe), planuri de revizii periodice, dispecerat de tichete și arhivarea devizelor pe fișa activului.',
        },
        {
          num: '07',
          name: 'ÎNCHIRIERE & LEASING',
          desc: 'Acoperă gestiunea contractelor de locațiune, mandatele de administrare și separarea arhitecturală a cheltuielilor de consum ale chiriașului de obligațiile proprietarului.',
        },
        {
          num: '08',
          name: 'SERVICII & ACHIZIȚII',
          desc: 'Poate cuprinde cereri structurate de intervenție, compararea ofertelor concurențiale de la furnizori, comenzi de lucru și recepția formală a lucrărilor.',
        },
        {
          num: '09',
          name: 'EXPERIENȚĂ & COMUNITATE',
          desc: 'Contextul poate include experiența de locuire, ghiduri de utilizare a spațiilor, programarea facilităților comune și informarea rezidenților.',
        },
        {
          num: '10',
          name: 'TRANSFER & SUCCESIUNE',
          desc: 'Acoperă transferul de proprietate, succesiunea administrației sau retragerea activului, responsabilitățile fiind predate ordonat conform guvernanței de retenție.',
        },
      ],
      provenance: {
        badge: 'PROVENIENȚĂ & PREZERVARE',
        title: 'Prezervarea Provenienței Istorice între Tranziții',
        desc: 'Arhitectura separă identitatea persistentă a proprietății de schimbările de proprietate, administrare și relații operaționale. Evidențele autorizate sunt proiectate să își mențină proveniența trasabilă la transferul între contexte.',
        points: [
          'Evidențele istorice rămân atribuite definitiv semnatarilor autorizați din perioada respectivă.',
          'Succesorii pot prelua registrele verificate fără pierderea dosarelor sau a contextelor contabile anterioare.',
          'Înregistrările de bază ale contoarelor și ale reviziilor sunt legate arhitectural de activul fizic, nu de contracte temporare de management.',
        ],
      },
      stakeholders: {
        badge: 'MATRICE DE PARTICIPARE',
        title: 'Continuitate pentru Toți Actorii din Ecosistem',
        roles: [
          { name: 'Dezvoltatori & Constructori', desc: 'Predare protocolară structurată fără dosare fizice rătăcite.' },
          { name: 'Proprietari & Investitori', desc: 'Randamente verificate și istoric complet al unităților deținute.' },
          { name: 'Asociații de Proprietari', desc: 'Calcul transparent, reconciliere bancară și avizier auditat.' },
          { name: 'Firme de Administrare', desc: 'Gestiune scalabilă multi-clădire și dispecerat tehnic ordonat.' },
          { name: 'Rezidenți & Chiriași', desc: 'Portal intuitiv pentru indexuri, plăți și cereri de mentenanță.' },
          { name: 'Furnizori de Servicii', desc: 'Comenzi clare, recepție digitală și decontare fără fricțiuni.' },
        ],
      },
      cta: {
        title: 'Aprofundează Arhitectura CLADORA',
        desc: 'Descoperă modelul decuplat pe 4 niveluri sau arhitectura de securitate și încredere.',
        archLink: 'Arhitectura de Sistem Detaliată',
        trustLink: 'Arhitectura de Încredere & Audit',
      },
    },
    en: {
      breadcrumb: { home: 'Home', platform: 'Platform', current: 'Property Lifecycle' },
      hero: {
        badge: 'NON-LINEAR LIFECYCLE CONTINUITY',
        title: 'The Property Lifecycle in CLADORA',
        subtitle:
          'Stakeholders, property managers, and service providers transition over time. Operational contexts evolve. The physical property remains the persistent subject of authorized records.',
      },
      paradigm: {
        badge: 'NON-LINEAR PARADIGM',
        title: 'Why the property lifecycle is not a rigid linear conveyor',
        desc: 'In the physical world, assets do not traverse a simplistic one-way track: a building can simultaneously house active residents, undergo partial renovations, conduct pre-sales for new phases, and transition management firms. CLADORA accommodates entry at any lifecycle stage while preserving unbroken historical provenance.',
      },
      coverageNote:
        'The lifecycle illustrates how CLADORA\'s architecture organizes property contexts over time. Individual workflows and availability depend on configured domains, country packs, and released capabilities.',
      phasesTitle: 'Ten Non-Linear Lifecycle Phases',
      phases: [
        {
          num: '01',
          name: 'DEFINE / PROJECT',
          desc: 'Architectural context covers establishing cadastral plot identities, building shells, unit topologies, statutory quota distributions, and digital technical vault setup.',
        },
        {
          num: '02',
          name: 'PRE-SALE & RESERVATIONS',
          desc: 'Lifecycle context can encompass tracking qualified commercial leads, pre-sales contracts, down payments, and unit customization specifications.',
        },
        {
          num: '03',
          name: 'SALE / CONVEYANCING',
          desc: 'Covers formalization of ownership deeds, establishing verified titleholder records, and initializing statutory owner mandates.',
        },
        {
          num: '04',
          name: 'HANDOVER & DELIVERY',
          desc: 'Workflows may include formal delivery protocols (full or phased), punch-list defect resolution tracking, and baseline utility meter calibrations.',
        },
        {
          num: '05',
          name: 'ACTIVE OPERATIONS',
          desc: 'Operational context encompasses statutory quota calculations, double-entry reconciliations, digital notice boards, and general meeting governance workflows.',
        },
        {
          num: '06',
          name: 'MAINTENANCE & ASSET CARE',
          desc: 'Domain context can include technical equipment registries (elevators, HVAC, pumps), preventative service schedules, fault ticketing, and service logbooks.',
        },
        {
          num: '07',
          name: 'LEASING & TENANCIES',
          desc: 'Covers tenancy agreement administration and the architectural isolation of tenant operational utility expenses from owner capital obligations.',
        },
        {
          num: '08',
          name: 'PROCUREMENT & SERVICES',
          desc: 'Can encompass structured request briefs, side-by-side contractor quote comparisons, work orders, and digital milestone sign-offs.',
        },
        {
          num: '09',
          name: 'COMMUNITY & EXPERIENCE',
          desc: 'Context may include occupant living journeys, spatial orientation guides, shared amenity schedules, and community notices.',
        },
        {
          num: '10',
          name: 'TRANSFER & SUCCESSION',
          desc: 'Covers property divestment, management turnover, or asset decommissioning, with responsibilities handed over according to retention governance.',
        },
      ],
      provenance: {
        badge: 'TRACEABLE PROVENANCE',
        title: 'Preserving Traceable Provenance Across Transitions',
        desc: 'The architecture separates persistent property identity from changes in ownership, management, and operational relationships. Authorized records are designed to maintain traceable provenance across lifecycle transitions.',
        points: [
          'Historical actions remain attributed to authorized signatories from that operational period.',
          'Incoming managers can receive structured records without loss of prior files or accounting contexts.',
          'Baseline meter records and maintenance logs are architecturally bound to the physical asset rather than transient management contracts.',
        ],
      },
      stakeholders: {
        badge: 'STAKEHOLDER MATRIX',
        title: 'Unbroken Continuity Across Ecosystem Roles',
        roles: [
          { name: 'Developers & Builders', desc: 'Protocol-driven digital handovers without scattered physical paper trails.' },
          { name: 'Property Owners & Portfolios', desc: 'Consolidated yield tracking and auditable multi-unit history.' },
          { name: 'Homeowners Associations', desc: 'Transparent statutory formulas, bank matching, and auditable notice boards.' },
          { name: 'Property Managers', desc: 'Scalable multi-building operations with integrated maintenance triage.' },
          { name: 'Residents & Tenants', desc: 'Self-service portal for meter readings, payments, and repair requests.' },
          { name: 'Service Contractors', desc: 'Clear work scopes, verified site check-ins, and orderly accounts settlement.' },
        ],
      },
      cta: {
        title: 'Deepen Your Platform Architecture Knowledge',
        desc: 'Explore the 4-tier decoupled system model or inspect the platform trust and governance framework.',
        archLink: 'Deep System Architecture',
        trustLink: 'Trust & Governance Architecture',
      },
    },
    fa: {
      breadcrumb: { home: 'صفحه اصلی', platform: 'پلتفرم', current: 'پیوستگی چرخهٔ عمر ملک' },
      hero: {
        badge: 'پیوستگی غیرخطی در درازمدت',
        title: 'چرخهٔ عمر ملک در معماری کلادورا',
        subtitle:
          'مالکان، مدیران و پیمانکاران در طول زمان جابه‌جا می‌شوند؛ بسترهای عملیاتی تغییر می‌کنند؛ اما ملک فیزیکی همواره موضوع پایدار اسناد و سوابق مجاز باقی می‌ماند.',
      },
      paradigm: {
        badge: 'پارادایم غیرخطی',
        title: 'چرا چرخهٔ عمر ملک یک خط مستقیم و ساده نیست',
        desc: 'در دنیای واقعی، املاک در یک مسیر تک‌بعدی حرکت نمی‌کنند: یک ساختمان می‌تواند به‌طور هم‌زمان دارای ساکنان فعال، واحدهای در حال پیش‌فروش، بخش‌های در حال بازسازی و تغییر هیئت‌مدیره باشد. معماری کلادورا امکان ورود در هر مرحله را فراهم ساخته و اصالت سوابق را در تمام مراحل حفظ می‌کند.',
      },
      coverageNote:
        'چرخهٔ عمر نشان‌دهندهٔ نحوهٔ سازمان‌دهی بسترهای گوناگون ملک در طول زمان توسط معماری کلادورا است. گردش‌کارهای تفصیلی و در دسترس بودن قابلیت‌ها به دامنه‌های پیکربندی‌شده، پک‌های کشوری و نسخه‌های منتشرشده بستگی دارد.',
      phasesTitle: 'ده مرحلهٔ غیرخطی در چرخهٔ عمر دارایی',
      phases: [
        {
          num: '۰۱',
          name: 'تعریف پروژه و اسناد اولیه',
          desc: 'بستر معماری شامل ثبت پلاک ثبتی، مشخصات سازه، ساختار واحدها، تسهیم متراژ مشاع و راه‌اندازی بایگانی دیجیتال فنی است.',
        },
        {
          num: '۰۲',
          name: 'پیش‌فروش و رزرو واحدها',
          desc: 'می‌تواند شامل پیگیری متقاضیان، پیش‌نویس تعهدات، اقساط و ثبت مشخصات فنی انتخاب‌شده باشد.',
        },
        {
          num: '۰۳',
          name: 'معاملات و انتقال قطعی',
          desc: 'شامل نهایی‌سازی اسناد واگذاری، ثبت مالک معتبر در سیستم و فعال‌سازی مجوزهای رسمی است.',
        },
        {
          num: '۰۴',
          name: 'تحویل رسمی و رفع نقایص',
          desc: 'گردش‌کارها می‌توانند شامل صورت‌جلسات رسمی تحویل (کامل یا فازبندی‌شده)، پیگیری نقایص (Punch-List) و ثبت ارقام اولیه کنتورها باشند.',
        },
        {
          num: '۰۵',
          name: 'بهره‌برداری و سکونت',
          desc: 'بستر عملیاتی شامل چارچوب محاسبات سهم شارژ، تطبیق تراکنش‌های بانکی، تابلوی اعلانات و فرآیندهای مجامع قانونی است.',
        },
        {
          num: '۰۶',
          name: 'نگهداری فنی و حفظ ارزش',
          desc: 'می‌تواند شامل شناسنامه تجهیزات (آسانسورها، تأسیسات، پمپ‌ها)، برنامه‌ریزی سرویس‌های پیشگیرانه و سوابق نگهداری باشد.',
        },
        {
          num: '۰۷',
          name: 'اجاره و مدیریت موجر و مستأجر',
          desc: 'پوشش‌دهنده مدیریت قراردادهای اجاره و تفکیک هزینه‌های مصرفی مستأجر از تعهدات سرمایه‌ای مالک در معماری است.',
        },
        {
          num: '۰۸',
          name: 'سفارش خدمات و پیمانکاران',
          desc: 'می‌تواند شامل ثبت نیازهای فنی، استعلام و مقایسه پیشنهادهای پیمانکاران، دستورکارها و تایید مراحل کار باشد.',
        },
        {
          num: '۰۹',
          name: 'تعاملات اجتماعی و تجربه زیست',
          desc: 'بستر تعاملی می‌تواند شامل راهنمای استفاده از فضاها، زمان‌بندی امکانات مشترک و ارتباطات همسایگی باشد.',
        },
        {
          num: '۱۰',
          name: 'انتقال مسئولیت و جانشینی',
          desc: 'شامل انتقال مالکیت، جانشینی مدیریت یا خروج دارایی از خدمت با تحویل ساختاریافته تعهدات بر اساس ضوابط نگهداری اسناد است.',
        },
      ],
      provenance: {
        badge: 'حفظ اصالت و سوابق تاریخی',
        title: 'پایداری سوابق در تمام تغییرات مدیریتی',
        desc: 'معماری کلادورا هویت پایدار ملک را از تغییرات در مالکیت، مدیریت و روابط عملیاتی تفکیک می‌نماید. سوابق مجاز به‌گونه‌ای طراحی شده‌اند که اصالت داده‌ها در انتقال میان بسترهای چرخهٔ عمر حفظ گردد.',
        points: [
          'اقدامات تاریخی به امضاکنندگان مجاز همان دورهٔ عملیاتی منتسب باقی می‌ماند.',
          'مدیران جانشین می‌توانند سوابق ساختاریافته را بدون مفقود شدن پرونده‌ها یا زمینه‌های پیشین تحویل بگیرند.',
          'سوابق پایه‌ای کنتورها و شناسنامه تعمیرات به‌صورت معماری به موجودیت فیزیکی ملک پیوند خورده و با تغییر قراردادهای مدیریت از بین نمی‌روند.',
        ],
      },
      stakeholders: {
        badge: 'ماتریس ذی‌نفعان',
        title: 'پیوستگی برای تمامی نقش‌های حاضر در اکوسیستم',
        roles: [
          { name: 'سازندگان و توسعه‌دهندگان', desc: 'تحویل مستند و سازمان‌یافته ساختمان بدون پرونده‌های فیزیکی مفقود.' },
          { name: 'مالکان و دارندگان سبد املاک', desc: 'دید جامع به بازدهی سرمایه‌گذاری و شناسنامه کامل واحدها.' },
          { name: 'انجمن‌های مالکان و مجتمع‌ها', desc: 'فرمول‌های قانونی تسهیم هزینه‌ها، مغایرت‌گیری بانکی و تابلوی اعلانات.' },
          { name: 'شرکت‌های مدیریت بهره‌برداری', desc: 'مدیریت مقیاس‌پذیر هم‌زمان چند پروژه با سیستم ارجاع فنی.' },
          { name: 'ساکنان و مستأجران', desc: 'پنل آسان کاربری برای اعلام ارقام کنتور، پرداخت شارژ و ثبت درخواست‌ها.' },
          { name: 'پیمانکاران و تیم‌های فنی', desc: 'شرح کار شفاف، تایید دیجیتال انجام کار و تسویه‌حساب بدون اختلاف.' },
        ],
      },
      cta: {
        title: 'آشنایی عمیق‌تر با معماری پلتفرم',
        desc: 'مدل تفکیک‌شده سیستم یا ارکان امنیت و حاکمیت داده‌ها را مطالعه نمایید.',
        archLink: 'معماری تفصیلی سیستم',
        trustLink: 'معماری اعتماد و امنیت',
      },
    },
  }[lang] || {
    breadcrumb: { home: 'Home', platform: 'Platform', current: 'Lifecycle' },
    hero: { badge: '', title: '', subtitle: '' },
    paradigm: { badge: '', title: '', desc: '' },
    coverageNote: '',
    phasesTitle: '',
    phases: [],
    provenance: { badge: '', title: '', desc: '', points: [] },
    stakeholders: { badge: '', title: '', roles: [] },
    cta: { title: '', desc: '', archLink: '', trustLink: '' },
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        
        {/* HERO */}
        <section className="space-y-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#52667A] font-medium">
            <Link href={`/${lang}`} className="hover:text-[#102A43]">
              {content.breadcrumb.home}
            </Link>
            <span>/</span>
            <Link href={`/${lang}/platform`} className="hover:text-[#102A43]">
              {content.breadcrumb.platform}
            </Link>
            <span>/</span>
            <span className="text-[#102A43] font-bold">
              {content.breadcrumb.current}
            </span>
          </nav>

          <div className="max-w-4xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E]">
              <span className="w-2 h-2 rounded-full bg-[#0E9F8E]" />
              <span>{content.hero.badge}</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-[#102A43] tracking-tight">
              {content.hero.title}
            </h1>
            <p className="text-base sm:text-lg text-[#52667A] leading-relaxed max-w-3xl">
              {content.hero.subtitle}
            </p>
          </div>
        </section>

        {/* PARADIGM */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-3">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
            {content.paradigm.badge}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
            {content.paradigm.title}
          </h2>
          <p className="text-sm sm:text-base text-[#52667A] leading-relaxed max-w-4xl">
            {content.paradigm.desc}
          </p>
        </section>

        {/* 10 PHASES */}
        <section className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.phasesTitle}
            </h2>
            <div className="p-4 sm:p-5 rounded-2xl bg-teal-50/70 border border-teal-100 flex items-start gap-3">
              <Compass className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
              <p className="text-xs sm:text-sm text-[#0F3B37] leading-relaxed">
                {content.coverageNote}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.phases.map((ph) => (
              <div 
                key={ph.num}
                className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex items-start gap-4"
              >
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                  {ph.num}
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-[#102A43]">{ph.name}</h3>
                  <p className="text-xs text-[#52667A] leading-relaxed">{ph.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* PROVENANCE */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.provenance.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.provenance.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.provenance.desc}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {content.provenance.points.map((pt, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#10B981] shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-[#102A43] leading-relaxed">{pt}</span>
              </div>
            ))}
          </div>
        </section>

        {/* STAKEHOLDERS */}
        <section className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 shadow-elevated space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">
              {content.stakeholders.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {content.stakeholders.title}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {content.stakeholders.roles.map((r, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                <h3 className="text-sm font-bold text-teal-300">{r.name}</h3>
                <p className="text-xs text-slate-300 leading-relaxed">{r.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h2 className="text-xl sm:text-2xl font-bold text-[#102A43]">{content.cta.title}</h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">{content.cta.desc}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <Link
              href={`/${lang}/platform/architecture`}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#0E9F8E] text-white text-xs font-bold hover:bg-[#0C8778] transition shadow-card flex items-center justify-center gap-2"
            >
              <span>{content.cta.archLink}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
            <Link
              href={`/${lang}/platform/trust`}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#F6F9FC] text-[#102A43] border border-[#D3DCE6] text-xs font-bold hover:bg-[#E2E8F0] transition flex items-center justify-center gap-2"
            >
              <span>{content.cta.trustLink}</span>
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
