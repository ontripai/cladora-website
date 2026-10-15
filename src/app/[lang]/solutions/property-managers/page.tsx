import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import {
  Layers,
  Building2,
  Users,
  Wrench,
  ShieldCheck,
  ArrowRight,
  FileSpreadsheet,
  DollarSign,
  CheckCircle2,
  Clock,
  Boxes,
  GitBranch,
  Receipt,
  KeyRound,
  FileCheck2,
  Megaphone
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
  return getRouteMetadata('/solutions/property-managers', params.lang);
}

export default async function PropertyManagersSolutionPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        solutions: 'Soluții',
        current: 'Companii de Administrare',
      },
      hero: {
        badge: 'PROPERTY MANAGEMENT SOFTWARE ROMANIA',
        title: 'Property Management Software Romania — Platformă de Operare Multi-Imobil',
        subtitle:
          'Consolă de operare pentru companii de property management și administrare de proprietăți în România: coordonarea echipelor pe workspace-uri delimitate, managementul documentelor de proprietate, vizibilitate financiară și gestiunea tehnică a portofoliilor.',
        ctaPrimary: 'Discută Înrolarea Portofoliului',
        ctaSecondary: 'Arhitectura Platformei',
      },
      challenge: {
        badge: 'SFIDAREA MULTI-IMOBIL',
        title: 'Complexitatea Administrării a Zeci de Asociații Concomitente',
        p: 'O companie profesionistă de administrare gestionează zeci sau sute de clădiri diferite, fiecare având propriul cont bancar, comitet de proprietari și specific tehnic. Fragmentarea operațională duce adesea la supraîncărcarea echipei.',
        cards: [
          {
            title: 'Conturi Bancare & Cifre Dispersate',
            desc: 'Fiecare asociație are personalitate juridică distinctă. Amestecarea tranzacțiilor sau pierderea istoricului per bloc creează riscuri majore.',
          },
          {
            title: 'Triere & Dispecerat Neordonat',
            desc: 'Avariile transmise prin telefon, mesaje sau bilețele la avizier generează întârzieri și meșteri necoordonați.',
          },
          {
            title: 'Repartizare de Lună Sub Presiune',
            desc: 'Repartizarea manuală a sutelor de facturi de utilități la sfârșit de lună consumă timp și expune la erori de calcul.',
          },
        ],
      },
      pillars: {
        badge: 'PILAONII DE CAPABILITĂȚI',
        title: 'Compoziția Arhitecturală pentru Firme de Administrare',
        items: [
          {
            domain: 'CORE',
            title: 'Workspace-uri Delimitate & Roluri Delegate',
            desc: 'Delimitare la nivel de workspace proiectată să prevină expunerea datelor între asociații, cu drepturi acordate pe bază de mandat clar.',
            icon: Building2,
          },
          {
            domain: 'OPERATIONS',
            title: 'Triere Tichete & Comenzi de Lucru',
            desc: 'Centralizarea incidentelor tehnice, prioritizarea intervențiilor și atribuirea comenzilor de lucru cu confirmare foto a execuției.',
            icon: Wrench,
          },
          {
            domain: 'FIN01',
            title: 'Vizibilitate Financiară pe Asociație',
            desc: 'Registre statutare, balanțe de verificare și reconciliere bancară asistată pentru fiecare asociație în parte, fără tabele paralele.',
            icon: DollarSign,
          },
          {
            domain: 'SERVICE',
            title: 'Coordonare Prestatori & Devize',
            desc: 'Organizarea relației cu firmele de curățenie, ascensoare și mentenanță prin comenzi clare și procese-verbale de recepție.',
            icon: FileCheck2,
          },
        ],
      },
      lifecycle: {
        badge: 'PARCURS ARHITECTURAL ILUSTRATIV',
        title: 'Fluxurile de Lucru ale Companiei de Management',
        subtitle:
          'Notă de arhitectură: Etapele de mai jos reflectă fluxurile de lucru ilustrative ale companiei de management, fără a implica dispecerizare automată, închidere contabilă autonomă sau raportare financiară de producție nesupusă mandatului uman.',
        steps: [
          {
            num: '01',
            title: 'Înrolare Asociație',
            desc: 'Configurarea workspace-ului dedicat noului imobil și preluarea soldurilor inițiale.',
          },
          {
            num: '02',
            title: 'Delegare Echipă',
            desc: 'Atribuirea drepturilor operaționale către administratorul de imobil și contabil.',
          },
          {
            num: '03',
            title: 'Context Repartizare Lunară',
            desc: 'Procesarea facturilor de utilități, repartizarea cotelor și afișarea listelor.',
          },
          {
            num: '04',
            title: 'Coordonare Mentenanță',
            desc: 'Preluarea sesizărilor, coordonarea intervențiilor și recepția lucrărilor.',
          },
          {
            num: '05',
            title: 'Documentare Raportare Comitet',
            desc: 'Prezentarea situației financiare și a registrului de cheltuieli către președinte.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'Companii de Administrare & Operatori de Facilități',
      },
      cta: {
        title: 'Eficientizează operarea portofoliului tău de administrare',
        subtitle:
          'Consultă specialiștii CLADORA pentru a evalua arhitectura multi-workspace pentru echipa ta operațională.',
        primary: 'Solicită Parteneriat de Administrare',
        secondary: 'Vezi Arhitectura Platformei',
      },
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        solutions: 'Solutions',
        current: 'Property Management Firms',
      },
      hero: {
        badge: 'MULTI-PROPERTY OPERATING CONSOLE',
        title: 'Property Management Operating Platform Architecture',
        subtitle:
          'Work console for property portfolios: team delegation across workspace-scoped boundaries designed to maintain separation, ticket triage context, financial visibility, and orderly occupant relationship coordination, without automated dispatch claims.',
        ctaPrimary: 'Discuss Portfolio Onboarding',
        ctaSecondary: 'Platform Architecture',
      },
      challenge: {
        badge: 'THE MULTI-PROPERTY CHALLENGE',
        title: 'The Operational Friction of Managing Dozens of Independent HOAs',
        p: 'A professional property management firm operates across dozens or hundreds of distinct residential buildings, each holding its own bank accounts, homeowner boards, and unique physical assets.',
        cards: [
          {
            title: 'Workspace Boundaries & Banking Isolation',
            desc: 'Each managed property is an independent legal entity. Commingling funds or losing per-building audit provenance creates severe liability.',
          },
          {
            title: 'Uncoordinated Ticket Ingestion',
            desc: 'Emergency faults received via phone calls, chat apps, and paper notes cause service delays and unverified technician sign-offs.',
          },
          {
            title: 'End-of-Month Allocation Strain',
            desc: 'Manually computing utility shares and generating hundreds of payment sheets introduces risk and administrative burnout.',
          },
        ],
      },
      pillars: {
        badge: 'CAPABILITY PILLARS',
        title: 'Architectural Composition for Property Management Firms',
        items: [
          {
            domain: 'CORE',
            title: 'Workspace Boundaries & Delegated Mandates',
            desc: 'Workspace-scoped boundaries designed to prevent cross-context data exposure, with scoped permissions for accountants, site managers, and desk agents.',
            icon: Building2,
          },
          {
            domain: 'OPERATIONS',
            title: 'Ticket Triage & Work Order Coordination',
            desc: 'Centralize inbound maintenance tickets, prioritize technical faults, and coordinate work orders with photographic proof of completion.',
            icon: Wrench,
          },
          {
            domain: 'FIN01',
            title: 'Dedicated Financial Ledgers per Building',
            desc: 'Statutory simple-entry registers, balance sheets, and assisted bank reconciliation for each property workspace without parallel stores.',
            icon: DollarSign,
          },
          {
            domain: 'SERVICE',
            title: 'Vendor Scope & Quote Coordination',
            desc: 'Manage recurring vendor contracts (cleaning, elevator maintenance, security) with auditable work acceptance.',
            icon: FileCheck2,
          },
        ],
      },
      lifecycle: {
        badge: 'ILLUSTRATIVE ARCHITECTURAL JOURNEY',
        title: 'Key Operational Workflows for Managing Companies',
        subtitle:
          'Architectural Notice: The phases below reflect illustrative workflows for property management firms, without implying automated ticket dispatch, autonomous financial close, or unverified board reporting automation.',
        steps: [
          {
            num: '01',
            title: 'Property Onboarding Context',
            desc: 'Configure dedicated building workspace, staircases, and import reconciled initial balances.',
          },
          {
            num: '02',
            title: 'Team Delegation Context',
            desc: 'Assign scoped role permissions to site managers, accounting staff, and maintenance coordinators.',
          },
          {
            num: '03',
            title: 'Monthly Allocation Context',
            desc: 'Process utility bills, compute statutory charges, and publish verified digital payment sheets.',
          },
          {
            num: '04',
            title: 'Operational Maintenance Coordination',
            desc: 'Triage occupant tickets, coordinate contractor visits, and record photographic sign-offs.',
          },
          {
            num: '05',
            title: 'Board Reporting Documentation',
            desc: 'Submit transparent monthly ledgers and cash journals to the client association committee.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'Property Management Companies & Operators',
      },
      cta: {
        title: 'Streamline your property management operations',
        subtitle:
          'Schedule an architectural consultation with CLADORA enterprise teams to configure your multi-workspace operating environment.',
        primary: 'Initiate Management Partnership',
        secondary: 'Explore Platform Architecture',
      },
    },
    fa: {
      breadcrumbs: {
        home: 'خانه',
        solutions: 'راهکارها',
        current: 'شرکت‌های مدیریت املاک',
      },
      hero: {
        badge: 'کنسول عملیاتی مدیریت چندین مجتمع',
        title: 'معماری پلتفرم عملیاتی شرکت‌های مدیریت و نگهداری املاک',
        subtitle:
          'کنسول هماهنگی پورتفولیو: تفویض به تیم‌ها در ورک‌اسپیس‌های دارای مرزبندی تفکیک‌شده، بافت تریاژ تیکت‌ها، دید مالی و ارتباط با ساکنان بدون تضمین پاسخ یا ارجاع خودکار.',
        ctaPrimary: 'گفتگوی راه‌اندازی برای شرکت‌های مدیریت',
        ctaSecondary: 'معماری پلتفرم',
      },
      challenge: {
        badge: 'چالش مدیریت همزمان چندین مجتمع',
        title: 'اصطکاک عملیاتی در راهبری ده‌ها ساختمان و انجمن مستقل',
        p: 'یک شرکت حرفه‌ای مدیریت املاک، ده‌ها ساختمان مستقل با حساب‌های بانکی مجزا، هیئت‌مدیره‌های متفاوت و شرایط تأسیساتی گوناگون را اداره می‌کند و پراکندگی ارتباطات می‌تواند توان تیم را فرسایش دهد.',
        cards: [
          {
            title: 'مرزهای تفکیک‌شده بانکی و ورک‌اسپیس',
            desc: 'هر ساختمان شخصیت حقوقی و حساب بانکی مستقل دارد. ترکیب اسناد یا فقدان ردپای ممیزی ریسک‌های جدی به بار می‌آورد.',
          },
          {
            title: 'ارجاع پراکنده درخواست‌های تعمیرات',
            desc: 'دریافت خرابی‌ها از طریق تماس تلفنی، پیام‌رسان‌ها و کاغذ، سبب سردرگمی و عدم نظارت بر عملکرد پیمانکاران می‌شود.',
          },
          {
            title: 'فشار پایان ماه در تسهیم هزینه‌ها',
            desc: 'محاسبه دستی مبالغ شارژ و قبوض انرژی برای صدها واحد در پایان ماه، مستعد خطای انسانی و اتلاف وقت است.',
          },
        ],
      },
      pillars: {
        badge: 'ستون‌های قابلیتی پلتفرم',
        title: 'ترکیب معماری برای شرکت‌های مدیریت املاک',
        items: [
          {
            domain: 'CORE',
            title: 'ورک‌اسپیس‌های مجزا و تفویض نقش‌ها',
            desc: 'مرزبندی‌های مشخص ورک‌اسپیس برای جلوگیری از تداخل داده‌ها، با تعیین دقیق حدود اختیارات مدیران، حسابداران و تیم پذیرش.',
            icon: Building2,
          },
          {
            domain: 'OPERATIONS',
            title: 'بررسی تیکت‌ها و هماهنگی دستورکار',
            desc: 'تجمیع تیکت‌های فنی، اولویت‌بندی بر اساس شرایط و هماهنگی دستورکار با دریافت عکس تحویل کار.',
            icon: Wrench,
          },
          {
            domain: 'FIN01',
            title: 'دفاتر مالی تفکیک‌شده برای هر ساختمان',
            desc: 'ثبت اسناد قانونی، ترازهای آزمایشی و تطبیق حسابداری بانکی برای هر مجتمع بدون نیاز به اکسل‌های پراکنده.',
            icon: DollarSign,
          },
          {
            domain: 'SERVICE',
            title: 'مدیریت پیمانکاران و قراردادهای سرویس',
            desc: 'هماهنگی خدمات دوره‌ای (سرویس آسانسور، نظافت، باغبانی) بر مبنای شرح خدمات مدون و تاییدیه‌های رسمی.',
            icon: FileCheck2,
          },
        ],
      },
      lifecycle: {
        badge: 'سیر معماری فرضی و مشارکتی',
        title: 'مراحل گردش کار شرکت‌های مدیریت در پلتفرم',
        subtitle:
          'یادداشت معماری: مراحل زیر بیانگر گردش‌کارهای فرضی برای شرکت‌های مدیریت است و متضمن ارجاع خودکار تیکت‌ها، بستن خودکار حساب‌ها یا گزارش‌دهی مالی بدون نظارت انسان نیست.',
        steps: [
          {
            num: '۰۱',
            title: 'راه‌اندازی مجتمع جدید',
            desc: 'ایجاد ورک‌اسپیس مستقل برای ساختمان، تعریف واحدها و ثبت مانده‌های افتتاحیه.',
          },
          {
            num: '۰۲',
            title: 'تفویض اختیارات به تیم',
            desc: 'تعیین دسترسی‌های پرسنل (مدیر مقیم، حسابدار، متصدی پذیرش) در هر ورک‌اسپیس.',
          },
          {
            num: '۰۳',
            title: 'مراحل تسهیم هزینه‌های ماهانه',
            desc: 'ثبت قبوض مصرفی، تسهیم هزینه‌ها و انتشار صورت‌حساب شارژ ماهانه در سامانه.',
          },
          {
            num: '۰۴',
            title: 'هماهنگی عملیات نگهداری',
            desc: 'پیگیری تیکت‌های خرابی، هماهنگی با تکنسین‌های فنی و تایید مستند کیفیت کار.',
          },
          {
            num: '۰۵',
            title: 'مستندسازی گزارش‌های هیئت‌مدیره',
            desc: 'ارائه ترازهای شفاف مالی و گزارش اقدامات فنی به اعضای هیئت‌مدیره هر مجتمع.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'شرکت‌های مدیریت املاک و بهره‌برداری تأسیسات',
      },
      cta: {
        title: 'عملیات مدیریت املاک خود را ارتقا دهید',
        subtitle:
          'برای بررسی معماری چندورک‌اسپیسی کلادورا و نحوه استقرار آن در مجموعه مدیریتی خود، با ما در تماس باشید.',
        primary: 'درخواست همکاری شرکت‌های مدیریت',
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
              <Layers className="w-4 h-4 text-[#0E9F8E]" />
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
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.lifecycle.subtitle}
            </p>
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

        {/* Cluster C Practical Guide */}
        {lang === 'ro' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[#0A6E62]">
                  Resurse Tehnice & Bune Practici
                </span>
                <h2 className="text-2xl font-bold text-[#102A43]">
                  Ghiduri Practice pentru Property Management & Documente
                </h2>
                <p className="text-sm text-[#52667A]">
                  Articole de referință privind delimitarea stocării de fișiere de evidențele operaționale de audit și controlul accesului pe portofoliu.
                </p>
              </div>
              <Link
                href="/ro/resources/guides"
                className="text-xs font-bold text-[#0E9F8E] hover:text-[#0A6E62] flex items-center gap-1 shrink-0"
              >
                Toate ghidurile CLADORA
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link
                href="/ro/resources/guides/management-documente-proprietati"
                className="group p-6 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#0E9F8E] hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wide">
                    Documente & Proveniență
                  </div>
                  <h3 className="font-bold text-base text-[#102A43] group-hover:text-[#0E9F8E] transition-colors">
                    Managementul Documentelor în Administrarea Proprietăților: De la Stocare la Evidențe Operaționale Auditate
                  </h3>
                  <p className="text-xs text-[#52667A] leading-relaxed">
                    Diferența critică dintre simpla stocare în cloud (Drive/Dropbox) și evidențele operaționale cu versiuni imutabile, proveniență trasabilă și control de acces pe bază de rol.
                  </p>
                </div>
                <div className="text-xs font-bold text-[#0E9F8E] flex items-center gap-1 group-hover:gap-2 transition-all pt-2">
                  Citește ghidul complet
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>

              <Link
                href="/ro/resources/guides/property-management-software-vs-property-operating-platform"
                className="group p-6 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#0E9F8E] hover:shadow-md transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wide">
                    Arhitectură de Sistem
                  </div>
                  <h3 className="font-bold text-base text-[#102A43] group-hover:text-[#0E9F8E] transition-colors">
                    Property Management Software vs. Property Operating Platform
                  </h3>
                  <p className="text-xs text-[#52667A] leading-relaxed">
                    Comparație arhitecturală între software-ul tradițional de property management și o platformă de operare unificată pentru active imobiliare.
                  </p>
                </div>
                <div className="text-xs font-bold text-[#0E9F8E] flex items-center gap-1 group-hover:gap-2 transition-all pt-2">
                  Citește ghidul complet
                  <ArrowRight className="w-3.5 h-3.5" />
                </div>
              </Link>
            </div>
          </div>
        )}

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
