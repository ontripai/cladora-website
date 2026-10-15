import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Building, 
  Layers, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Cpu, 
  Boxes, 
  Clock, 
  FileCheck2, 
  GitBranch, 
  KeyRound, 
  FolderLock 
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
  return getRouteMetadata('/solutions/developers', params.lang);
}

export default async function DevelopersSolutionPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        solutions: 'Soluții',
        current: 'Dezvoltatori & Predare Imobile',
      },
      hero: {
        badge: 'ARHITECTURA DE DEZVOLTARE & PREDARE',
        title: 'Identitatea Digitală a Clădirii Încă din Faza de Proiect',
        subtitle:
          'Pregătire comercială în AIRPROP, evidența documentară a clădirii în DOCUMENTS și un cadru de protocol formal de predare către asociație sau compania de administrare.',
        ctaPrimary: 'Discută Parteneriatul de Proiect',
        ctaSecondary: 'Arhitectura Platformei',
      },
      challenge: {
        badge: 'SFIDAREA TRANZIȚIEI OPERAȚIONALE',
        title: 'De la Șantier la Exploatare: Punctul Critic de Fricțiune',
        p: 'Finalizarea construcției și vânzarea unităților este urmată adesea de tensiuni: dosare tehnice pierdute pe suport de hârtie, tabele Excel de pre-vânzare necorelate și un proces de predare-primire anevoios către comitetul de proprietari nou înființat.',
        cards: [
          {
            title: 'Evidențe Comerciale Neunificate',
            desc: 'Antecontractele și listele de opțiuni se pierd adesea între agenția de vânzări și echipa tehnică de șantier.',
          },
          {
            title: 'Cartea Tehnică Dispersată',
            desc: 'Avizele, garanțiile echipamentelor și schemele tehnice se transmit incomplet la momentul constituirii asociației.',
          },
          {
            title: 'Predare Conflictuală',
            desc: 'Lipsa unui protocol digital cu probe verificabile prelungește recepția și afectează reputația dezvoltatorului.',
          },
        ],
      },
      pillars: {
        badge: 'PILAONII ARHITECTURALI',
        title: 'Cum Răspunde Arhitectura CLADORA',
        items: [
          {
            domain: 'CORE',
            title: 'Identitate Persistentă & Structură Unitară',
            desc: 'Definirea din stadiul incipient a unităților locative, cotelor indivize, spațiilor comune și a relațiilor juridice inițiale.',
            icon: Building,
          },
          {
            domain: 'AIRPROP',
            title: 'Pregătire Comercială & Antecontracte',
            desc: 'Înregistrarea angajamentelor comerciale, alocarea cumpărătorilor la unități și transferul cursiv către statutul de proprietar.',
            icon: KeyRound,
          },
          {
            domain: 'DOCUMENTS',
            title: 'Evidență Documentară & Carte Tehnică',
            desc: 'Gestiunea structurată a documentației tehnice de execuție, schemelor de instalații și certificatelor de garanție conform politicilor stabilite.',
            icon: FolderLock,
          },
          {
            domain: 'TRANSITION',
            title: 'Continuitate către Operare Post-Predare',
            desc: 'Workspace-ul de dezvoltator predă ordonat evidențele către workspace-ul asociației sau companiei de administrare.',
            icon: GitBranch,
          },
        ],
      },
      lifecycle: {
        badge: 'PARCURS ARHITECTURAL ILUSTRATIV',
        title: 'Etapele de Implicare a Dezvoltatorului',
        subtitle:
          'Notă de arhitectură: Etapele de mai jos reprezintă un parcurs arhitectural ilustrativ de participare în ciclul de viață al proiectului, fără a implica un flux operațional complet activat sau automatizat în producție.',
        steps: [
          {
            num: '01',
            title: 'Definire Proiect',
            desc: 'Înregistrarea ansamblului, topologiei clădirilor și structurii cadastrale în CORE.',
          },
          {
            num: '02',
            title: 'Pregătire Comercială',
            desc: 'Gestiunea antecontractelor și atribuirea viitorilor proprietari în AIRPROP.',
          },
          {
            num: '03',
            title: 'Structurare Documentară',
            desc: 'Structurarea documentației tehnice și a cărții construcției în furnizorul canonic DOCUMENTS.',
          },
          {
            num: '04',
            title: 'Protocol de Predare',
            desc: 'Cadrul de consemnare pentru procesele-verbale de predare-primire a unităților.',
          },
          {
            num: '05',
            title: 'Tranziție Operațională',
            desc: 'Tranziție formală și transmiterea evidențelor către asociația de proprietari sau operator.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'Dezvoltatori & Constructori Imobiliari',
      },
      cta: {
        title: 'Structurează predarea viitorului tău proiect rezidențial',
        subtitle:
          'Echipa CLADORA colaborează cu dezvoltatorii pentru a stabili din timp arhitectura de date a ansamblurilor în dezvoltare.',
        primary: 'Contactează Echipa de Parteneriate',
        secondary: 'Vezi Arhitectura Platformei',
      },
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        solutions: 'Solutions',
        current: 'Developers & Asset Handover',
      },
      hero: {
        badge: 'DEVELOPMENT & HANDOVER ARCHITECTURE',
        title: 'Establish Digital Property Identity Early in the Project',
        subtitle:
          'Commercial preparation in AIRPROP, technical documentation evidence in DOCUMENTS, and a structured handover protocol framework bridging to association or operator workspaces.',
        ctaPrimary: 'Discuss Project Partnership',
        ctaSecondary: 'Platform Architecture',
      },
      challenge: {
        badge: 'THE OPERATIONAL TRANSITION CHALLENGE',
        title: 'From Construction to Living: The Critical Friction Point',
        p: 'Project completion is often fraught with administrative friction: physical paper vaults get misplaced, pre-sale spreadsheets lack operational linkage, and initial handover to newly formed homeowner boards turns contentious.',
        cards: [
          {
            title: 'Fragmented Pre-Sale Records',
            desc: 'Buyer commitments, options, and reservation files remain disconnected from future property records.',
          },
          {
            title: 'Scattered Technical Vaults',
            desc: 'As-built plans, equipment warranties, and permits fail to transfer cleanly at association inception.',
          },
          {
            title: 'Contentious Handover Protocols',
            desc: 'Without verifiable digital sign-offs, unit and common-area handovers cause disputes and brand friction.',
          },
        ],
      },
      pillars: {
        badge: 'ARCHITECTURAL PILLARS',
        title: 'How CLADORA Architecture Bridges the Gap',
        items: [
          {
            domain: 'CORE',
            title: 'Persistent Identity & Unit Hierarchy',
            desc: 'Early definition of physical assets, unit boundaries, undivided share quotas, and initial legal relationships.',
            icon: Building,
          },
          {
            domain: 'AIRPROP',
            title: 'Commercial Preparation & Pre-Sales',
            desc: 'Structured pre-sale agreements, buyer-to-unit mapping, and smooth transition to authenticated ownership.',
            icon: KeyRound,
          },
          {
            domain: 'DOCUMENTS',
            title: 'Technical Documentation & Blueprint Records',
            desc: 'Structured storage of as-built architectural plans, technical permits, utility agreements, and equipment warranties.',
            icon: FolderLock,
          },
          {
            domain: 'TRANSITION',
            title: 'Continuity Toward Post-Handover Management',
            desc: 'The developer workspace formally transitions operational records into the incoming association or manager workspace.',
            icon: GitBranch,
          },
        ],
      },
      lifecycle: {
        badge: 'ILLUSTRATIVE ARCHITECTURAL JOURNEY',
        title: 'Stages of Developer Platform Participation',
        subtitle:
          'Architectural Notice: The stages below represent an illustrative architectural participation journey across project lifecycle phases, without implying an active end-to-end automated production workflow.',
        steps: [
          {
            num: '01',
            title: 'Project Definition',
            desc: 'Establish asset identity, building topology, and unit breakdown in CORE.',
          },
          {
            num: '02',
            title: 'Commercial Preparation',
            desc: 'Track pre-sales commitments and buyer assignments within AIRPROP.',
          },
          {
            num: '03',
            title: 'Technical Documentation',
            desc: 'Deposit permits, warranties, and as-built architectural plans into DOCUMENTS.',
          },
          {
            num: '04',
            title: 'Unit Handover Protocol Framework',
            desc: 'Structured records for unit delivery sign-offs and punch-list evidence.',
          },
          {
            num: '05',
            title: 'Operational Handshake Context',
            desc: 'Structured transition of common areas to the homeowner board or management company.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'Real Estate Developers & Builders',
      },
      cta: {
        title: 'Structure the handover of your next development',
        subtitle:
          'Connect with CLADORA enterprise specialists to implement persistent digital asset identity before commissioning.',
        primary: 'Initiate Developer Partnership',
        secondary: 'Explore Platform Architecture',
      },
    },
    fa: {
      breadcrumbs: {
        home: 'خانه',
        solutions: 'راهکارها',
        current: 'سازندگان و تحویل املاک',
      },
      hero: {
        badge: 'معماری توسعه و تحویل املاک',
        title: 'ثبت هویت دیجیتال ملک از فاز اولیهٔ پروژه',
        subtitle:
          'تمهیدات تجاری و پیش‌فروش در AIRPROP، مدیریت اسناد فنی در DOCUMENTS و انتقال منظم مدارک به هیئت‌مدیره یا شرکت مدیریت بدون انقطاع سوابق.',
        ctaPrimary: 'گفتگوی همکاری برای پروژه',
        ctaSecondary: 'معماری پلتفرم',
      },
      challenge: {
        badge: 'چالش انتقال از ساخت به بهره‌برداری',
        title: 'گذار از کارگاه به سکونت: نقطهٔ اصطکاک بحرانی',
        p: 'تکمیل پروژه ساختمانی معمولاً با چالش‌های اداری مواجه است: پراکندگی نقشه‌ها و اسناد کاغذی، فایل‌های اکسل پیش‌فروش که به سوابق آتی وصل نیستند، و تحویل پردردسر مشاعات به هیئت‌مدیره نوپا.',
        cards: [
          {
            title: 'فایل‌های پراکندهٔ پیش‌فروش',
            desc: 'تعهدات خریداران، مفاد قراردادها و انتخاب‌های داخلی واحدها بدون پیوند به هویت قطعی آینده باقی می‌ماند.',
          },
          {
            title: 'پراکندگی شناسنامه فنی ساختمان',
            desc: 'نقشه‌های چون‌ساخت، گارانتی تجهیزات آسانسور و موتورخانه هنگام تشکیل هیئت‌مدیره به درستی تحویل داده نمی‌شوند.',
          },
          {
            title: 'صورت‌جلسات سنتی تحویل',
            desc: 'فقدان ثبت دیجیتال و مستند ایرادات، به اختلافات طولانی‌مدت میان سازنده و خریداران دامن می‌زند.',
          },
        ],
      },
      pillars: {
        badge: 'ستون‌های معماری کلادورا',
        title: 'پاسخ معماری کلادورا به نیاز سازندگان',
        items: [
          {
            domain: 'CORE',
            title: 'هویت پایدار دارایی و ساختار واحدها',
            desc: 'تعریف دقیق عرصه و اعیان، متراژ اختصاصی و سهم‌العرصه مشاعات و روابط حقوقی خریداران از فاز طراحی.',
            icon: Building,
          },
          {
            domain: 'AIRPROP',
            title: 'تمهیدات تجاری و قراردادهای پیش‌فروش',
            desc: 'ثبت منظم قراردادهای اولیه، تخصیص قطعی متقاضیان به واحدها و هدایت منظم آن‌ها به پنل مالکان.',
            icon: KeyRound,
          },
          {
            domain: 'DOCUMENTS',
            title: 'مدیریت اسناد فنی و شناسنامه ساختمان',
            desc: 'نگهداری اسناد چون‌ساخت، نقشه‌های تأسیساتی، تاییدیه‌های ایمنی و ضمانت‌نامه‌ها با ثبت اصالت.',
            icon: FolderLock,
          },
          {
            domain: 'TRANSITION',
            title: 'پیوستگی سوابق به دوره بهره‌برداری',
            desc: 'انتقال ساختاریافته اطلاعات از ورک‌اسپیس سازنده به ورک‌اسپیس هیئت‌مدیره یا شرکت نگهداری ساختمان.',
            icon: GitBranch,
          },
        ],
      },
      lifecycle: {
        badge: 'سیر معماری فرضی و مشارکتی',
        title: 'فازهای حضور سازنده در پلتفرم کلادورا',
        subtitle:
          'یادداشت معماری: مراحل زیر بیانگر یک سیر معماری فرضی و مشارکتی در مراحل گوناگون پروژه است و دلالتی بر جریان کاری خودکار یا فعال کامل در محیط عملیاتی ندارد.',
        steps: [
          {
            num: '۰۱',
            title: 'تعریف پروژه',
            desc: 'ثبت هویت دارایی، دسته‌بندی بلوک‌ها و مشخصات واحدها در هسته CORE.',
          },
          {
            num: '۰۲',
            title: 'آماده‌سازی تجاری',
            desc: 'پیگیری تعهدات پیش‌فروش و تخصیص قطعی واحد به خریدار در AIRPROP.',
          },
          {
            num: '۰۳',
            title: 'اسناد فنی و مدارک',
            desc: 'ثبت و دسته‌بندی نقشه‌های اجرایی، پروانه‌ها و گارانتی تأسیسات در DOCUMENTS.',
          },
          {
            num: '۰۴',
            title: 'چارچوب صورت‌جلسه تحویل',
            desc: 'ثبت دیجیتال مستندات تحویل واحد به خریدار همراه با شواهد.',
          },
          {
            num: '۰۵',
            title: 'واگذاری به بهره‌برداری',
            desc: 'تحویل ساختاریافته فضاهای عمومی به انجمن مالکان یا شرکت مدیر ساختمان.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'سازندگان و توسعه‌دهندگان املاک',
      },
      cta: {
        title: 'فرایند تحویل پروژه ساختمانی خود را سامان دهید',
        subtitle:
          'برای استقرار هویت دیجیتال و ایجاد بایگانی دائمی مدارک فنی پروژه‌های آتی خود با کارشناسان کلادورا تماس بگیرید.',
        primary: 'درخواست همکاری سازندگان',
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
              <Building className="w-4 h-4 text-[#0E9F8E]" />
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
