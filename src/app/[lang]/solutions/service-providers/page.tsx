import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  FileCheck2, 
  Wrench, 
  Boxes, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Clock, 
  DollarSign, 
  GitBranch, 
  Camera, 
  FileText, 
  Layers, 
  Compass 
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
  return getRouteMetadata('/solutions/service-providers', params.lang);
}

export default async function ServiceProvidersSolutionPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        solutions: 'Soluții',
        current: 'Furnizori de Servicii',
      },
      hero: {
        badge: 'COORDONAREA FURNIZORILOR & LUCRĂRILOR',
        title: 'Platformă de Coordonare pentru Furnizori de Servicii',
        subtitle:
          'Coordonarea participării la lucrări: comenzi de lucru prin OPERATIONS, clarificarea devizelor în SERVICE, probe foto la recepție în DOCUMENTS și evidențe ordonate de decontare în FIN01.',
        ctaPrimary: 'Discută Înrolarea ca Furnizor',
        ctaSecondary: 'Arhitectura Platformei',
      },
      challenge: {
        badge: 'SFIDAREA COORDONĂRII TEHNICE',
        title: 'Fricțiunea Dintre Echipele Tehnice și Administrație',
        p: 'Prestatorii de servicii (mentenanță ascensoare, instalații, curățenie, securitate) se confruntă frecvent cu specificații neclare ale lucrărilor, dispute privind recepția intervențiilor și decontări întârziate.',
        cards: [
          {
            title: 'Specificații Imprecise de Lucru',
            desc: 'Cererile transmise telefonic fără descrierea pieselor sau a istoricului echipamentului duc la deplasări inutile.',
          },
          {
            title: 'Dispute la Recepție',
            desc: 'Lipsa dovezilor fotografice și a consemnării clare a stării lucrării generează contestații la plată.',
          },
          {
            title: 'Fragmentarea Comenzilor',
            desc: 'Păstrarea evidenței comenzilor în carnete sau tabele paralele creează discrepanțe față de contabilitatea imobilului.',
          },
        ],
      },
      pillars: {
        badge: 'PILAONII DE CAPABILITĂȚI',
        title: 'Compoziția Arhitecturală pentru Furnizori',
        items: [
          {
            domain: 'OPERATIONS',
            title: 'Comenzi de Lucru & Execuție',
            desc: 'Primirea ordinelor de intervenție cu perimetru tehnic clar, echipamentul vizat și istoricul reparațiilor anterioare.',
            icon: Wrench,
          },
          {
            domain: 'SERVICE',
            title: 'Devize Structurate & Caiete de Sarcini',
            desc: 'Transmiterea ofertelor și devizelor de cost/timp direct în contextul cererii de service aprobate de client.',
            icon: FileCheck2,
          },
          {
            domain: 'DOCUMENTS',
            title: 'Probe Fotografice & Proces-Verbal',
            desc: 'Încărcarea fotografiilor de la fața locului înainte și după intervenție, cu probe de acceptare a lucrării.',
            icon: Camera,
          },
          {
            domain: 'FIN01',
            title: 'Decontare Ordonată & Trasabilitate',
            desc: 'Facturile emise se leagă direct de comanda de lucru recepționată, asigurând plata fără întârzieri sau contestații.',
            icon: DollarSign,
          },
        ],
      },
      journey: {
        badge: 'PARCURS ARHITECTURAL ILUSTRATIV',
        title: 'Etapele de Coordonare a Lucrării',
        subtitle:
          'Notă de arhitectură: Etapele de mai jos reprezintă un model ilustrativ de participare arhitecturală a furnizorului, fără a implica un flux de producție cap-la-cap activ sau semnătură electronică calificată automată.',
        steps: [
          {
            num: '01',
            title: 'Înrolare & Mandat',
            desc: 'Înregistrarea companiei și a tehnicienilor autorizați în workspace-ul imobilului.',
          },
          {
            num: '02',
            title: 'Delimitare Cerere Serviciu',
            desc: 'Analiza specificațiilor tehnice și transmiterea devizului estimativ în SERVICE.',
          },
          {
            num: '03',
            title: 'Intervenție la Fața Locului',
            desc: 'Execuția lucrării conform normelor și înregistrarea probelor foto în aplicație.',
          },
          {
            num: '04',
            title: 'Recepție & Consemnare Probe',
            desc: 'Consemnarea recepției și a probelor de finalizare în DOCUMENTS.',
          },
          {
            num: '05',
            title: 'Decontare & Închidere',
            desc: 'Emiterea facturii ancorate în comanda executată pentru plata din FIN01.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'Furnizori de Servicii & Echipe Tehnice',
      },
      cta: {
        title: 'Optimizează colaborarea tehnică cu imobilele administrate',
        subtitle:
          'Află cum poate CLADORA să elimine disputele și întârzierile din fluxul comenzilor de lucru ale companiei tale.',
        primary: 'Înrolează Compania de Servicii',
        secondary: 'Vezi Arhitectura Platformei',
      },
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        solutions: 'Solutions',
        current: 'Service Providers & Contractors',
      },
      hero: {
        badge: 'VENDOR & WORK ORDER COORDINATION',
        title: 'Property Service Provider Coordination Platform',
        subtitle:
          'Coordinated maintenance participation: work orders via OPERATIONS, quote scopes in SERVICE, photographic completion evidence in DOCUMENTS, and auditable settlement context in FIN01.',
        ctaPrimary: 'Discuss Vendor Onboarding',
        ctaSecondary: 'Platform Architecture',
      },
      challenge: {
        badge: 'THE TECHNICAL COORDINATION CHALLENGE',
        title: 'The Operational Friction Between Contractors and Property Teams',
        p: 'Contractors and specialized service vendors (HVAC, elevator service, plumbing, landscaping, cleaning) frequently face vague work requests, disputed completion sign-offs, and unpredictable payment delays.',
        cards: [
          {
            title: 'Vague Technical Scopes',
            desc: 'Inbound requests communicated verbally without equipment models, past logbooks, or clear defect symptoms cause wasted truck rolls.',
          },
          {
            title: 'Disputed Work Acceptance',
            desc: 'Without on-site photographic evidence and clear work acceptance records, completed work often gets questioned during invoice auditing.',
          },
          {
            title: 'Disconnected Order Tracking',
            desc: 'Maintaining orders across personal notebooks or third-party spreadsheets leads to discrepancies against building financial accounts.',
          },
        ],
      },
      pillars: {
        badge: 'CAPABILITY PILLARS',
        title: 'Architectural Composition for Service Providers',
        items: [
          {
            domain: 'OPERATIONS',
            title: 'Work Orders & Technical Execution',
            desc: 'Receive verified work orders specifying physical equipment history, site access details, and explicit defect parameters.',
            icon: Wrench,
          },
          {
            domain: 'SERVICE',
            title: 'Structured Quotes & Scope Agreement',
            desc: 'Submit competitive or contracted cost and time estimates directly anchored to client-approved service requests.',
            icon: FileCheck2,
          },
          {
            domain: 'DOCUMENTS',
            title: 'Photographic Evidence & Work Acceptance',
            desc: 'Capture before-and-after photographs on-site and record completion evidence deposited into DOCUMENTS.',
            icon: Camera,
          },
          {
            domain: 'FIN01',
            title: 'Direct Settlement & Ledger Traceability',
            desc: 'Invoices directly reference verified work order completion records, enabling orderly payment without audit delays.',
            icon: DollarSign,
          },
        ],
      },
      journey: {
        badge: 'ILLUSTRATIVE ARCHITECTURAL JOURNEY',
        title: 'Stages of Service Delivery in CLADORA',
        subtitle:
          'Architectural Notice: The sequence below represents an illustrative architectural participation journey for service providers, without implying an active end-to-end released vendor workflow or qualified digital signature automation.',
        steps: [
          {
            num: '01',
            title: 'Onboarding & Standing Context',
            desc: 'Establish verified company credentials and accredited technician roles within CORE.',
          },
          {
            num: '02',
            title: 'Service Scope Intake Context',
            desc: 'Review structured incident tickets and submit formal cost estimates in SERVICE.',
          },
          {
            num: '03',
            title: 'On-Site Execution Context',
            desc: 'Perform technical maintenance, register part replacements, and record photos.',
          },
          {
            num: '04',
            title: 'Work Acceptance Evidence Context',
            desc: 'Obtain authorized on-site customer or manager completion acceptance in DOCUMENTS.',
          },
          {
            num: '05',
            title: 'Settlement & Accounting Context',
            desc: 'Submit invoice matching the authorized work order for settlement via FIN01.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'Property Service Providers & Contractors',
      },
      cta: {
        title: 'Streamline technical maintenance across managed properties',
        subtitle:
          'Connect with CLADORA enterprise teams to configure structured work order coordination for your contracting business.',
        primary: 'Apply for Provider Onboarding',
        secondary: 'Explore Platform Architecture',
      },
    },
    fa: {
      breadcrumbs: {
        home: 'خانه',
        solutions: 'راهکارها',
        current: 'ارائه‌دهندگان خدمات و پیمانکاران',
      },
      hero: {
        badge: 'هماهنگی پیمانکاران و دستورکارهای فنی',
        title: 'پلتفرم هماهنگی ارائه‌دهندگان خدمات و تیم‌های فنی',
        subtitle:
          'هماهنگی خدمات فنی: سفارش‌های کار از طریق OPERATIONS، تعیین حدود برآورد در SERVICE، ثبت شواهد انجام کار در DOCUMENTS و سوابق تسویه‌حساب در FIN01.',
        ctaPrimary: 'گفتگوی عضویت پیمانکاران',
        ctaSecondary: 'معماری پلتفرم',
      },
      challenge: {
        badge: 'چالش هماهنگی فنی پیمانکاران',
        title: 'اصطکاک عملیاتی میان پیمانکاران و تیم‌های مدیریت ساختمان',
        p: 'شرکت‌های خدمات و نگهداری (سرویس آسانسور، تأسیسات سرمایش و گرمایش، نظافت و باغبانی) غالباً با شرح کار مبهم، مناقشات هنگام تحویل کار و تأخیر در تسویه‌حساب مواجه هستند.',
        cards: [
          {
            title: 'شرح کار نامشخص و ناقص',
            desc: 'اعلام تلفنی نقص فنی بدون مشخصات قطعات یا سوابق تعمیر قبلی، به مراجعات مکرر و اتلاف وقت منجر می‌شود.',
          },
          {
            title: 'اختلاف در تحویل و تایید کار',
            desc: 'عدم ثبت عکس‌های قبل و بعد از تعمیر و فقدان شواهد مستند تحویل کار، موجب تردید در پرداخت فاکتور می‌گردد.',
          },
          {
            title: 'ردگیری پراکنده سفارش‌ها',
            desc: 'نگهداری سوابق در سررسیدها یا فایل‌های جداگانه، مغایرت با حسابداری و دفاتر مالی ساختمان ایجاد می‌کند.',
          },
        ],
      },
      pillars: {
        badge: 'ستون‌های قابلیتی پلتفرم',
        title: 'ترکیب معماری برای پیمانکاران و ارائه‌دهندگان خدمات',
        items: [
          {
            domain: 'OPERATIONS',
            title: 'دستورکارهای مدون و ارجاع فنی',
            desc: 'دریافت مشخصات دقیق محل خرابی، شناسنامه دستگاه، ابعاد عیب و سابقه تعمیرات گذشته پیش از اعزام.',
            icon: Wrench,
          },
          {
            domain: 'SERVICE',
            title: 'برآورد ساختاریافته هزینه و زمان',
            desc: 'ارائه پیش‌فاکتور شفاف و زمان‌بندی انجام کار متصل به درخواست رسمی تاییدشده توسط کارفرما.',
            icon: FileCheck2,
          },
          {
            domain: 'DOCUMENTS',
            title: 'مستندات تصویری و شواهد تحویل کار',
            desc: 'ثبت تصاویر قطعات تعویض‌شده، عکس وضعیت نهایی و ثبت شواهد اتمام کار در سامانه.',
            icon: Camera,
          },
          {
            domain: 'FIN01',
            title: 'تسویه‌حساب شفاف بر پایه مستندات',
            desc: 'اتصال مستقیم فاکتور نهایی به دستورکار تاییدشده، مانع از تعویق پرداخت یا اختلافات مالی می‌شود.',
            icon: DollarSign,
          },
        ],
      },
      journey: {
        badge: 'سیر معماری فرضی و مشارکتی',
        title: 'مراحل اجرای خدمات فنی در کلادورا',
        subtitle:
          'یادداشت معماری: مراحل زیر بیانگر یک مدل فرضی و مشارکتی برای پیمانکاران است و متضمن گردش کار یکپارچهٔ فعال یا امضای دیجیتال دارای اعتبار قضایی خودکار نیست.',
        steps: [
          {
            num: '۰۱',
            title: 'ثبت اطلاعات و صلاحیت فنی',
            desc: 'ثبت شرکت یا تکنسین در CORE و تعیین محدوده جغرافیایی و تخصصی فعالیت.',
          },
          {
            num: '۰۲',
            title: 'بررسی محدوده و برآورد در SERVICE',
            desc: 'بررسی مشخصات فنی تیکت و ثبت پیش‌فاکتور هزینه در ماژول SERVICE.',
          },
          {
            num: '۰۳',
            title: 'اجرای عملیات در محل',
            desc: 'انجام تعمیرات یا سرویس و ثبت تصاویر مراحل کار در سامانه.',
          },
          {
            num: '۰۴',
            title: 'ثبت شواهد اتمام کار',
            desc: 'اخذ تاییدیه و ثبت مستندات تحویل کار از ناظر در DOCUMENTS.',
          },
          {
            num: '۰۵',
            title: 'ثبت نهایی و تسویه‌حساب',
            desc: 'ارجاع فاکتور تأییدشده به حسابداری FIN01 جهت واریز وجه.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'ارائه‌دهندگان خدمات و پیمانکاران فنی',
      },
      cta: {
        title: 'ارائه خدمات فنی به املاک را سازمان‌یافته کنید',
        subtitle:
          'برای حذف ابهامات کاری و ارتقای همکاری مستمر با مجتمع‌های تحت مدیریت کلادورا، به شبکه پیمانکاران ما بپیوندید.',
        primary: 'درخواست عضویت پیمانکاران',
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
              <FileCheck2 className="w-4 h-4 text-[#0E9F8E]" />
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

        {/* CHALLENGE */}
        <section className="card-proptech p-8 sm:p-10 bg-white border-[#E2E8F0] space-y-8">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F0F4F8] text-xs font-bold text-[#334E68]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#0E9F8E]" />
              <span>{content.challenge.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43] tracking-tight">
              {content.challenge.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.challenge.p}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {content.challenge.cards.map((card, i) => (
              <div key={i} className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <h3 className="text-xs font-bold text-[#102A43]">{card.title}</h3>
                <p className="text-xs text-[#52667A] leading-relaxed">{card.desc}</p>
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

        {/* JOURNEY */}
        <section className="card-proptech p-8 sm:p-10 bg-white border-[#E2E8F0] space-y-8">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F0F4F8] text-xs font-bold text-[#334E68]">
              <Clock className="w-3.5 h-3.5 text-[#0E9F8E]" />
              <span>{content.journey.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43] tracking-tight">
              {content.journey.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.journey.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {content.journey.steps.map((st, i) => (
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
