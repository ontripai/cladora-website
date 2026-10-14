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
      phasesTitle: 'Cele 10 Etape ale Ciclului de Viață Imobiliar',
      phases: [
        {
          num: '01',
          name: 'DEFINIRE / PROIECT',
          desc: 'Identitatea inițială a terenului și a corpurilor de clădire, structurarea unităților, stabilirea cotelor-părți și crearea seifului digital tehnic.',
        },
        {
          num: '02',
          name: 'PRE-VÂNZARE & REZERVĂRI',
          desc: 'Gestionarea oportunităților calificate, evidența antecontractelor, urmărirea avansurilor și rezervarea opțiunilor de finisaje.',
        },
        {
          num: '03',
          name: 'TRANZACȚIE / ACHIZIȚIE',
          desc: 'Finalizarea contractelor de vânzare-cumpărare, stabilirea deținătorului canonic de drepturi și activarea primelor mandate de proprietate.',
        },
        {
          num: '04',
          name: 'PREDARE-PRIMIRE (HANDOVER)',
          desc: 'Protocolul formal de predare (complet sau parțial/etapizat), înregistrarea listelor de remedieri (punch-list) și indexurile inițiale de contor.',
        },
        {
          num: '05',
          name: 'EXPLOATARE ZILNICĂ',
          desc: 'Calculul cotelor statutare de întreținere, reconciliere bancară, avizier digital, convocarea adunărilor generale și vot statutar.',
        },
        {
          num: '06',
          name: 'MENTENANȚĂ & PĂSTRARE ACTIV',
          desc: 'Registru de echipamente (ascensoare, centrale, pompe), planuri de revizii periodice, dispecerat de tichete și arhivarea devizelor pe fișa activului.',
        },
        {
          num: '07',
          name: 'ÎNCHIRIERE & LEASING',
          desc: 'Gestiunea contractelor de locațiune, separarea automată a cheltuielilor de consum ale chiriașului de obligațiile proprietarului și mandate de administrare.',
        },
        {
          num: '08',
          name: 'SERVICII & ACHIZIȚII',
          desc: 'Formularea cererilor structurate de intervenție, compararea ofertelor concurențiale, comenzi de lucru și recepția formală a lucrărilor.',
        },
        {
          num: '09',
          name: 'EXPERIENȚĂ & COMUNITATE',
          desc: 'Integrarea experienței de locuire, ghiduri de utilizare a spațiilor, rezervarea facilităților comune și comunicarea dintre vecini.',
        },
        {
          num: '10',
          name: 'TRANSFER & SUCCESIUNE',
          desc: 'Vânzarea imobilului, schimbarea administratorului sau retragerea unui echipament. Responsabilitățile se predau ordonat conform politicii de retenție.',
        },
      ],
      provenance: {
        badge: 'PROVENIENȚĂ & PREZERVARE',
        title: 'Prezervarea Provenienței Istorice între Tranziții',
        desc: 'Arhitectura CLADORA este proiectată pentru a păstra proveniența trasabilă atunci când evidențele autorizate trec dintr-un context în altul. Schimbarea administrației nu șterge semnăturile istorice, avizele sau datele tehnice inițiale.',
        points: [
          'Evidențele istorice rămân atribuite definitiv semnatarilor autorizați din perioada respectivă.',
          'Succesorii preiau registrele verificate fără pierderea dosarelor sau a calculelor anterioare.',
          'Istoricul contoarelor și al reviziilor este păstrat pe toată durata fizică a clădirii.',
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
      phasesTitle: 'Ten Non-Linear Lifecycle Phases',
      phases: [
        {
          num: '01',
          name: 'DEFINE / PROJECT',
          desc: 'Establishing cadastral plot identities, building shells, unit topologies, statutory quota distributions, and digital technical vault setup.',
        },
        {
          num: '02',
          name: 'PRE-SALE & RESERVATIONS',
          desc: 'Tracking qualified commercial leads, pre-sales contracts, down payments, and unit customization specifications.',
        },
        {
          num: '03',
          name: 'SALE / CONVEYANCING',
          desc: 'Finalizing ownership deeds, establishing verified titleholder records, and initializing statutory owner mandates.',
        },
        {
          num: '04',
          name: 'HANDOVER & DELIVERY',
          desc: 'Formal full or phased delivery protocols, punch-list defect resolution tracking, and baseline utility meter calibrations.',
        },
        {
          num: '05',
          name: 'ACTIVE OPERATIONS',
          desc: 'Statutory quota calculations, double-entry reconciliations, digital notice boards, formal general meetings, and voting ballots.',
        },
        {
          num: '06',
          name: 'MAINTENANCE & ASSET CARE',
          desc: 'Technical equipment registries (elevators, HVAC, pumps), preventative service schedules, fault ticketing, and service logbooks.',
        },
        {
          num: '07',
          name: 'LEASING & TENANCIES',
          desc: 'Tenancy agreement administration, automated isolation of tenant operational utility expenses from owner capital obligations.',
        },
        {
          num: '08',
          name: 'PROCUREMENT & SERVICES',
          desc: 'Structured request briefs, side-by-side contractor quote comparisons, work orders, and digital milestone sign-offs.',
        },
        {
          num: '09',
          name: 'COMMUNITY & EXPERIENCE',
          desc: 'Occupant living journeys, spatial orientation guides, shared amenity schedules, and daily community requests.',
        },
        {
          num: '10',
          name: 'TRANSFER & SUCCESSION',
          desc: 'Property divestment, management turnover, or asset decommissioning. Prior obligations close cleanly with traceable succession.',
        },
      ],
      provenance: {
        badge: 'TRACEABLE PROVENANCE',
        title: 'Preserving Traceable Provenance Across Transitions',
        desc: 'CLADORA’s architecture is designed to preserve traceable provenance when authorized records move between lifecycle contexts. Administrative turnovers never erase past signatories, statutory approvals, or foundational technical data.',
        points: [
          'Historical actions remain permanently credited to verified signatories from that operational period.',
          'Incoming managers receive audited records without lost archives or disputed accounting histories.',
          'Meter baselines and preventative maintenance histories persist across decades of asset ownership.',
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
      phasesTitle: 'ده مرحلهٔ غیرخطی در چرخهٔ عمر دارایی',
      phases: [
        {
          num: '۰۱',
          name: 'تعریف پروژه و اسناد اولیه',
          desc: 'ثبت پلاک ثبتی، مشخصات سازه، ساختار واحدها، متراژ مشاع و راه‌اندازی بایگانی دیجیتال فنی.',
        },
        {
          num: '۰۲',
          name: 'پیش‌فروش و رزرو واحدها',
          desc: 'مدیریت متقاضیان، پیش‌نویس تعهدات، پیگیری اقساط و ثبت مشخصات فنی انتخاب‌شده.',
        },
        {
          num: '۰۳',
          name: 'معاملات و انتقال قطعی',
          desc: 'نهایی‌سازی اسناد واگذاری، تعیین مالک معتبر در سیستم و فعال‌سازی مجوزهای رسمی.',
        },
        {
          num: '۰۴',
          name: 'تحویل رسمی و رفع نقایص',
          desc: 'صورت‌جلسه دیجیتال تحویل (کامل یا فازبندی‌شده)، پیگیری موارد باز (Punch-List) و ثبت ارقام اولیه کنتورها.',
        },
        {
          num: '۰۵',
          name: 'بهره‌برداری و سکونت',
          desc: 'محاسبه سهم شارژ، تطبیق تراکنش‌های بانکی، تابلوی اعلانات دیجیتال و برگزاری مجامع قانونی.',
        },
        {
          num: '۰۶',
          name: 'نگهداری فنی و حفظ ارزش',
          desc: 'شناسنامه آسانسورها، پمپ‌ها و تجهیزات، برنامه‌های نگهداری پیشگیرانه و ثبت سوابق سرویس روی دارایی.',
        },
        {
          num: '۰۷',
          name: 'اجاره و مدیریت موجر و مستأجر',
          desc: 'مدیریت قراردادهای اجاره، تفکیک خودکار هزینه‌های مصرفی مستأجر از تعهدات سرمایه‌ای مالک.',
        },
        {
          num: '۰۸',
          name: 'سفارش خدمات و پیمانکاران',
          desc: 'ثبت نیاز فنی، استعلام قیمت، مقایسه پیشنهادها، صدور دستورکار و تایید نهایی کار انجام‌شده.',
        },
        {
          num: '۰۹',
          name: 'تعاملات اجتماعی و تجربه زیست',
          desc: 'سامانه تعاملی ساکنان، راهنمای استفاده از فضاها، رزرو امکانات مشترک و ارتباطات همسایگی.',
        },
        {
          num: '۱۰',
          name: 'انتقال مسئولیت و جانشینی',
          desc: 'تغییر مالکیت، تغییر شرکت مدیریت یا خروج دارایی از خدمت با تحویل مستند کلیه تعهدات به جانشین.',
        },
      ],
      provenance: {
        badge: 'حفظ اصالت و سوابق تاریخی',
        title: 'پایداری سوابق در تمام تغییرات مدیریتی',
        desc: 'معماری کلادورا به‌گونه‌ای طراحی شده است که با انتقال مسئولیت‌ها، اصالت سوابق حفظ شود. تغییر مدیران گذشته اسناد امضاشده، مصوبات مجمع یا ارقام مصرف کنتورها را مخدوش نمی‌سازد.',
        points: [
          'اقدامات گذشته به نام امضاکنندگان قانونی همان دوره در تاریخچه ثبت می‌ماند.',
          'مدیران و هیئت‌مدیره جدید پرونده‌های شفاف و مستند را بدون اختلاف تحویل می‌گیرند.',
          'سوابق تعمیرات و کنتورها در طول عمر مفید ساختمان پایدار باقی می‌مانند.',
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
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
            {content.phasesTitle}
          </h2>

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
