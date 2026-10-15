import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Building2, 
  Scale, 
  FileSpreadsheet, 
  Users, 
  ShieldCheck, 
  ArrowRight, 
  Receipt, 
  FileCheck2, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Boxes, 
  GitBranch, 
  Megaphone, 
  Vote, 
  FileText 
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
  return getRouteMetadata('/solutions/associations', params.lang);
}

export default async function AssociationsSolutionPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        solutions: 'Soluții',
        current: 'Asociații de Proprietari',
      },
      hero: {
        badge: 'GUVERNANȚĂ REZIDENȚIALĂ & ASOCIAȚII',
        title: 'Platformă de Guvernanță Rezidențială în Cadrul Legii 196/2018',
        subtitle:
          'Concepută pentru a susține fluxurile asociațiilor de proprietari în cadrul Legii 196/2018: repartizarea explicabilă a cotelor, avizier digital transparent, evidență financiară statutară și gestiunea adunărilor generale.',
        ctaPrimary: 'Discută Înrolarea Asociației',
        ctaSecondary: 'Arhitectura Platformei',
      },
      legalStandard: {
        badge: 'CADRUL LEGAL & PACHETUL ROMÂNIA',
        title: 'Concepută pentru Cadrul Legii 196/2018',
        p: 'CLADORA structurează evidențele de administrare rezidențială pentru a răspunde cerințelor de transparență și repartizare prevăzute de legislația din România, fără a formula promisiuni neacoperite de automatizare legală absolută.',
        cards: [
          {
            title: 'Repartizare Matematică Explicabilă',
            desc: 'Calculul cotelor pe număr de persoane, cotă-parte indiviză sau consumuri indexate, cu formule verificabile pentru fiecare proprietar.',
          },
          {
            title: 'Avizier Digital & Notificări Oficiale',
            desc: 'Afișarea listelor lunare de plată și a deciziilor comitetului executiv, cu arhivarea istoricului de comunicare.',
          },
          {
            title: 'Pregătirea Adunărilor Generale',
            desc: 'Gestiunea convocatoarelor, înregistrarea prezenței și a voturilor membrilor în conformitate cu procedurile statutare interne.',
          },
        ],
      },
      pillars: {
        badge: 'PILAONII DE CAPABILITĂȚI',
        title: 'Compoziția Arhitecturală pentru Asociații',
        items: [
          {
            domain: 'FIN01',
            title: 'Evidență Statutară & Control Analitic',
            desc: 'Registre statutare în partidă simplă, susținute de control analitic suplimentar în partidă dublă și corecții exclusiv prin stornare documentată.',
            icon: DollarSign,
          },
          {
            domain: 'COMMUNICATIONS',
            title: 'Avizier Digital & Transparență',
            desc: 'Canal oficial de informare cu evidență auditată a publicării listelor de plată și a hotărârilor adunării generale.',
            icon: Megaphone,
          },
          {
            domain: 'DOCUMENTS',
            title: 'Registrul Proceselor-Verbale & Contracte',
            desc: 'Păstrarea în siguranță a deciziilor comitetului, contractelor cu furnizorii de utilități și a cărții tehnice a imobilului.',
            icon: FileText,
          },
          {
            domain: 'OPERATIONS',
            title: 'Tichete Tehnice & Intervenții Comune',
            desc: 'Semnalarea incidentelor la instalațiile comune (lift, hidrofor, terasă) și coordonarea lucrărilor cu meșteri acreditați.',
            icon: Boxes,
          },
        ],
      },
      lifecycle: {
        badge: 'CICLUL DE VIAȚĂ AL ASOCIAȚIEI',
        title: 'Etapele Operaționale Periodice',
        steps: [
          {
            num: '01',
            title: 'Constituire & Înrolare',
            desc: 'Înregistrarea asociației, configurarea scărilor și a tabelului de proprietari în CORE.',
          },
          {
            num: '02',
            title: 'Colectare Indexuri',
            desc: 'Preluarea citirilor de apă rece și caldă cu asistență foto pentru prevenirea erorilor.',
          },
          {
            num: '03',
            title: 'Generare Listă de Plată',
            desc: 'Repartizarea facturilor de utilități și a fondurilor de rulment/reparații în FIN01.',
          },
          {
            num: '04',
            title: 'Încasare & Reconciliere',
            desc: 'Înregistrarea plăților efectuate la casierie sau prin transfer bancar cu reconciliere.',
          },
          {
            num: '05',
            title: 'Adunare Generală Anuală',
            desc: 'Pregătirea raportului de gestiune, descărcarea de gestiune și arhivarea hotărârilor.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'Asociații de Proprietari Rezidențiale',
      },
      cta: {
        title: 'Adu transparență și rigoare în asociația ta de proprietari',
        subtitle:
          'Află cum poate CLADORA să sprijine comitetul executiv și proprietarii din blocul tău în cadrul cadrului legislativ actual.',
        primary: 'Înscrie Asociația în Pilot',
        secondary: 'Vezi Arhitectura Platformei',
      },
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        solutions: 'Solutions',
        current: 'Residential Associations & HOAs',
      },
      hero: {
        badge: 'RESIDENTIAL GOVERNANCE & HOA ARCHITECTURE',
        title: 'Residential Association Platform Framework',
        subtitle:
          'Designed to support residential association workflows within the framework of Romanian Law 196/2018: explainable expense allocation, transparent digital notice boards, statutory accounting, and assembly records.',
        ctaPrimary: 'Discuss Association Onboarding',
        ctaSecondary: 'Platform Architecture',
      },
      legalStandard: {
        badge: 'LEGAL FRAMEWORK & COUNTRY PACK',
        title: 'Designed for the Law 196/2018 Operational Framework',
        p: 'CLADORA structures residential management records to align with transparency and expense allocation principles outlined in Romanian statutory framework, without making unsupported claims of automatic legal immunity.',
        cards: [
          {
            title: 'Explainable Mathematical Allocation',
            desc: 'Quotas calculated by person count, undivided surface share, or metered consumption, providing full formula auditability for every owner.',
          },
          {
            title: 'Digital Notice Board & Official Notices',
            desc: 'Publication of monthly maintenance lists and executive board decisions with auditable communication timestamps.',
          },
          {
            title: 'General Meeting Preparation',
            desc: 'Assembly convocation notices, attendance verification, and owner vote recording adhering to internal statutory procedures.',
          },
        ],
      },
      pillars: {
        badge: 'CAPABILITY PILLARS',
        title: 'Architectural Composition for Associations',
        items: [
          {
            domain: 'FIN01',
            title: 'Statutory Registers & Supplemental Controls',
            desc: 'Statutory simple-entry registers backed by supplemental analytical double-entry ledger controls and documented correction reversals.',
            icon: DollarSign,
          },
          {
            domain: 'COMMUNICATIONS',
            title: 'Digital Notice Board & Transparency',
            desc: 'Authoritative broadcast channel providing verified publication timestamps for monthly payment lists and board resolutions.',
            icon: Megaphone,
          },
          {
            domain: 'DOCUMENTS',
            title: 'Meeting Minutes & Contract Vault',
            desc: 'Secure storage of board assembly minutes, utility provider contracts, and building technical records.',
            icon: FileText,
          },
          {
            domain: 'OPERATIONS',
            title: 'Common Area Faults & Work Orders',
            desc: 'Ticket triage for shared building infrastructure (elevators, booster pumps, roofing) and maintenance contractor coordination.',
            icon: Boxes,
          },
        ],
      },
      lifecycle: {
        badge: 'ASSOCIATION LIFECYCLE',
        title: 'Key Operational Recurring Phases',
        steps: [
          {
            num: '01',
            title: 'Setup & Inception',
            desc: 'Register association workspace, building staircases, and unit ownership roster in CORE.',
          },
          {
            num: '02',
            title: 'Meter Index Ingestion',
            desc: 'Collect individual water and heating readings with photo verification to prevent typos.',
          },
          {
            num: '03',
            title: 'Monthly Allocation Run',
            desc: 'Distribute utility invoices and capital/reserve contributions through FIN01 rules.',
          },
          {
            num: '04',
            title: 'Collections & Reconciliation',
            desc: 'Record cash desk receipts and bank transfers with assisted reconciliation.',
          },
          {
            num: '05',
            title: 'Annual General Meeting',
            desc: 'Compile annual financial reporting, table management discharges, and archive resolutions.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'Residential Associations & HOAs',
      },
      cta: {
        title: 'Bring transparency and rigor to your residential community',
        subtitle:
          'Discover how CLADORA empowers board members and owners with explainable math and auditable digital governance.',
        primary: 'Apply for Association Pilot',
        secondary: 'Explore Platform Architecture',
      },
    },
    fa: {
      breadcrumbs: {
        home: 'خانه',
        solutions: 'راهکارها',
        current: 'انجمن‌های مالکان و مجتمع‌ها',
      },
      hero: {
        badge: 'حاکمیت مجتمع‌های مسکونی و اداری',
        title: 'معماری پلتفرم برای انجمن‌های مالکان و مدیریت ساختمان',
        subtitle:
          'طراحی‌شده برای تسهیل فرآیندهای مجتمع‌های مسکونی منطبق با چارچوب‌های قانونی: تسهیم مستند هزینه‌ها، تابلو اعلانات دیجیتال، دفاتر مالی قانونی و ثبت سوابق مجامع عمومی.',
        ctaPrimary: 'درخواست راه‌اندازی برای مجتمع',
        ctaSecondary: 'معماری پلتفرم',
      },
      legalStandard: {
        badge: 'چارچوب قانونی و استانداردهای منطقه‌ای',
        title: 'طراحی منطبق با مقررات و قوانین تملک آپارتمان‌ها',
        p: 'کلادورا سوابق مدیریتی ساختمان را به گونه‌ای سازماندهی می‌کند که با اصول شفافیت و تسهیم عادلانه هزینه‌ها در چارچوب‌های قانونی هم‌راستا باشد، بدون ادعاهای اثبات‌نشده درباره انطباق خودکار قضایی.',
        cards: [
          {
            title: 'تسهیم فرمول‌محور و قابل‌توضیح',
            desc: 'محاسبه سهم هر واحد بر پایه متراژ اختصاصی، تعداد نفرات یا کنتورهای مجزا، با نمایش دقیق فرمول محاسباتی برای کلیه ساکنان.',
          },
          {
            title: 'تابلو اعلانات دیجیتال و ابلاغیه‌ها',
            desc: 'انتشار رسمی فیش‌های شارژ دوره، مصوبات هیئت‌مدیره و اعلان‌های اضطراری همراه با ثبت تاریخچه.',
          },
          {
            title: 'مدیریت و ثبت جلسات مجامع',
            desc: 'صدور دعوت‌نامه‌ها، ثبت حضور اعضا، مستندسازی آرای مالکان و آرشیو مصوبات در چارچوب اساسنامه مجتمع.',
          },
        ],
      },
      pillars: {
        badge: 'ستون‌های قابلیتی پلتفرم',
        title: 'ترکیب معماری برای انجمن‌های مالکان',
        items: [
          {
            domain: 'FIN01',
            title: 'دفاتر قانونی و کنترل‌های تحلیلی تکمیلی',
            desc: 'ثبت دفاتر قانونی مورد نیاز همراه با کنترل تراز تحلیلی تکمیلی دوطرفه و ثبت اصلاحات صرفاً از طریق سند اصلاحی و برگشت.',
            icon: DollarSign,
          },
          {
            domain: 'COMMUNICATIONS',
            title: 'تابلو اعلانات رسمی و شفافیت اداری',
            desc: 'کانال رسمی اطلاع‌رسانی با تاریخچهٔ ممیزی‌شده جهت ابلاغ فیش‌های هزینه‌ها و تصمیمات هیئت‌مدیره.',
            icon: Megaphone,
          },
          {
            domain: 'DOCUMENTS',
            title: 'بایگانی صورت‌جلسات و قراردادها',
            desc: 'ذخیره امن صورت‌جلسات هیئت‌مدیره، قراردادهای سرویس آسانسور، نظافت و نگهداری تأسیسات مشترک.',
            icon: FileText,
          },
          {
            domain: 'OPERATIONS',
            title: 'اعلام خرابی‌ها و دستورکارهای مشاعات',
            desc: 'ثبت تیکت‌های خرابی در مشاعات (پمپ آب، روشنایی، آسانسور) و ارجاع مستقیم به تعمیرکاران طرف قرارداد.',
            icon: Boxes,
          },
        ],
      },
      lifecycle: {
        badge: 'چرخهٔ فعالیت‌های دوره‌ای انجمن',
        title: 'مراحل عملیاتی تکرارشونده در مجتمع',
        steps: [
          {
            num: '۰۱',
            title: 'ثبت اولیه و تشکیل پرونده',
            desc: 'تعریف مشخصات مجتمع، بلوک‌ها، مشخصات واحدها و فهرست مالکان در CORE.',
          },
          {
            num: '۰۲',
            title: 'ثبت ارقام کنتورها',
            desc: 'دریافت ارقام کنتورهای فرعی آب و گاز با امکان ثبت عکس برای رفع شبهات.',
          },
          {
            num: '۰۳',
            title: 'صدور صورت‌حساب شارژ ماهانه',
            desc: 'تسهیم هزینه‌های جاری و قبوض عمومی و شارژ اندوخته تعمیرات در FIN01.',
          },
          {
            num: '۰۴',
            title: 'وصول مطالبات و تطبیق بانکی',
            desc: 'ثبت مبالغ واریزی مالکان و تطبیق حسابداری با صورت‌حساب بانکی ساختمان.',
          },
          {
            num: '۰۵',
            title: 'مجمع عمومی سالانه',
            desc: 'تنظیم بیلان مالی سالانه، گزارش عملکرد، انتخابات هیئت‌مدیره و آرشیو تصمیمات.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'انجمن‌های مالکان و مجتمع‌های مسکونی',
      },
      cta: {
        title: 'شفافیت و آرامش را به مجتمع مسکونی خود بیاورید',
        subtitle:
          'برای آشنایی با نحوه پیاده‌سازی کلادورا در هیئت‌مدیره مجتمع خود و رفع اختلافات ناشی از شارژ ساختمان، با ما تماس بگیرید.',
        primary: 'درخواست راه‌اندازی برای مجتمع',
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
              <Building2 className="w-4 h-4 text-[#0E9F8E]" />
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

        {/* LEGAL STANDARD & POSITIONING */}
        <section className="card-proptech p-8 sm:p-10 bg-white border-[#E2E8F0] space-y-8">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F0F4F8] text-xs font-bold text-[#334E68]">
              <Scale className="w-3.5 h-3.5 text-[#0E9F8E]" />
              <span>{content.legalStandard.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43] tracking-tight">
              {content.legalStandard.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.legalStandard.p}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {content.legalStandard.cards.map((card, i) => (
              <div key={i} className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0E9F8E]" />
                  <h3 className="text-xs font-bold text-[#102A43]">{card.title}</h3>
                </div>
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
