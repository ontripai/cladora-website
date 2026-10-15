import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Home, 
  Receipt, 
  Camera, 
  Wrench, 
  Megaphone, 
  ShieldCheck, 
  ArrowRight, 
  Calendar, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Boxes, 
  GitBranch, 
  KeyRound, 
  Compass, 
  Users 
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
  return getRouteMetadata('/solutions/residents', params.lang);
}

export default async function ResidentsSolutionPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        solutions: 'Soluții',
        current: 'Rezidenți & Ocupanți',
      },
      hero: {
        badge: 'EXPERIENȚA DE LOCUIRE & OCUPARE',
        title: 'Transparență și Control în Spațiul Tău de Locuit',
        subtitle:
          'Contextele rezidențiale pot include acces la informații financiare autorizate, transmiterea indexurilor de contor, solicitări de mentenanță și comunicări verificate, în funcție de capabilitățile active și domeniul de implementare.',
        ctaPrimary: 'Descoperă Portalul Ocupantului',
        ctaSecondary: 'Arhitectura Platformei',
      },
      positioning: {
        badge: 'CONSOLIDARE CANONICĂ',
        title: 'Rezidenți & Ocupanți: Un Bilanț Comun, Roluri Distincte',
        p: 'Fie că ești proprietar rezident, chiriaș într-un apartament sau ocupant al unui spațiu privat dintr-un imobil mixt, CLADORA îți prezintă exact informațiile și drepturile financiare corespunzătoare statutului tău.',
        points: [
          {
            title: 'Separare Transparentă a Cotelor',
            desc: 'Chiriașii vizualizează doar consumurile operaționale curente (apă, salubrizare, încălzire), în timp ce fondurile de reparații și investiții sunt evidențiate pe contul proprietarului.',
          },
          {
            title: 'Transmitere Asistată a Indexurilor',
            desc: 'Fotografierea contoarelor cu recunoaștere asistată elimină discuțiile legate de transcrieri greșite sau erori de tipar.',
          },
          {
            title: 'Canal Oficial de Raportare',
            desc: 'Tichetele de reparații sunt trimise direct către administrație cu istoric de stare, eliminând bilețelele sau mesajele neoficiale.',
          },
        ],
      },
      pillars: {
        badge: 'PILAONII DE CAPABILITĂȚI',
        title: 'Compoziția Arhitecturală pentru Ocupanți',
        items: [
          {
            domain: 'FIN01',
            title: 'Informații Financiare Autorizate',
            desc: 'Descompunerea structurată a articolelor din lista de întreținere, cu acces la formulele explicabile de calcul aplicate.',
            icon: Receipt,
          },
          {
            domain: 'OPERATIONS',
            title: 'Tichete de Mentenanță & Reparații',
            desc: 'Raportarea rapidă a avariilor individuale sau din spațiile comune, cu actualizări de progres până la remedierea completă.',
            icon: Wrench,
          },
          {
            domain: 'COMMUNICATIONS',
            title: 'Avizier Digital & Anunțuri Oficiale',
            desc: 'Recepționarea notificărilor oficiale, a întreruperilor programate de utilități și a deciziilor importante ale comunității.',
            icon: Megaphone,
          },
          {
            domain: 'C&E',
            title: 'Ghiduri de Clădire & Facilități',
            desc: 'Acces facil la regulamentul intern, contacte utile de urgență și procedurile stabilite pentru buna conviețuire.',
            icon: Compass,
          },
        ],
      },
      journey: {
        badge: 'PARCURS ARHITECTURAL ILUSTRATIV',
        title: 'Etapele Experienței Rezidențiale în CLADORA',
        subtitle:
          'Notă de arhitectură: Un parcurs rezidențial ilustrativ poate conecta contexte precum cele de mai jos, în funcție de capabilitățile active și de configurarea specifică a asociației sau clădirii.',
        steps: [
          {
            num: '01',
            title: 'Înrolare în Spațiul Unității',
            desc: 'Conectare securizată pe baza invitației transmise de proprietar sau administrație.',
          },
          {
            num: '02',
            title: 'Context Preluare Index Contor',
            desc: 'Înregistrarea foto a consumului de apă caldă și rece înainte de închiderea perioadei.',
          },
          {
            num: '03',
            title: 'Consultare Notă de Plată',
            desc: 'Verificarea cotei de întreținere defalcate clar pe articole de consum și fonduri.',
          },
          {
            num: '04',
            title: 'Semnalare Cerere Mentenanță',
            desc: 'Deschiderea unui tichet cu fotografie când apare o defecțiune la instalații sau spații comune.',
          },
          {
            num: '05',
            title: 'Tranziție & Încheiere Contract',
            desc: 'Reconcilierea indexurilor finale de contor la încheierea contractului de închiriere.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'Rezidenți & Ocupanți Imobiliari',
      },
      cta: {
        title: 'Trăiește într-o comunitate rezidențială transparentă',
        subtitle:
          'Propunerea CLADORA transformă relația dintre locatari și administrație într-un parteneriat bazat pe încredere și claritate.',
        primary: 'Solicită Informații',
        secondary: 'Vezi Arhitectura Platformei',
      },
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        solutions: 'Solutions',
        current: 'Residents & Occupants',
      },
      hero: {
        badge: 'LIVING & OCCUPANT EXPERIENCE',
        title: 'Transparency and Control in Your Living Space',
        subtitle:
          'Resident contexts may include authorized meter-reading submission, provider-derived financial information, maintenance request contexts, and verified communications, depending on released capabilities and implementation scope.',
        ctaPrimary: 'Explore Occupant Portal',
        ctaSecondary: 'Platform Architecture',
      },
      positioning: {
        badge: 'CANONICAL CONSOLIDATION',
        title: 'Residents & Occupants: Shared Environment, Scoped Rights',
        p: 'Whether you are a resident property owner, a residential tenant, or an authorized occupant in a mixed-use estate, CLADORA presents the exact information and permissions relevant to your legal standing.',
        points: [
          {
            title: 'Structured Charge Segregation',
            desc: 'Tenants view only operational consumption costs (water, heating, sanitation), while capital improvement funds are isolated to the owner ledger.',
          },
          {
            title: 'Assisted Meter Submission',
            desc: 'Submitting water and energy indices with photo capture eliminates disputes over typographical errors or unrecorded door-to-door slips.',
          },
          {
            title: 'Direct Maintenance Requests',
            desc: 'Maintenance tickets submit directly to building management with status updates, eliminating sticky notes and missed verbal requests.',
          },
        ],
      },
      pillars: {
        badge: 'CAPABILITY PILLARS',
        title: 'Architectural Composition for Occupants',
        items: [
          {
            domain: 'FIN01',
            title: 'Authorized Financial Visibility',
            desc: 'Detailed breakdown of items on the monthly maintenance sheet, backed by explainable mathematical distribution formulas.',
            icon: Receipt,
          },
          {
            domain: 'OPERATIONS',
            title: 'Maintenance Request Context',
            desc: 'Report in-unit or common area maintenance issues, receive dispatcher notes, and track resolution through completion.',
            icon: Wrench,
          },
          {
            domain: 'COMMUNICATIONS',
            title: 'Digital Notice Distribution',
            desc: 'Receive official association bulletins, scheduled utility maintenance notices, and urgent building announcements.',
            icon: Megaphone,
          },
          {
            domain: 'C&E',
            title: 'Building Guides & Rules',
            desc: 'Access house rules, emergency technical contacts, waste sorting guidelines, and facility usage protocols.',
            icon: Compass,
          },
        ],
      },
      journey: {
        badge: 'ILLUSTRATIVE ARCHITECTURAL JOURNEY',
        title: 'Stages of the Residential Experience in CLADORA',
        subtitle:
          'Architectural Notice: An illustrative resident/occupant journey may connect contexts such as those below, depending on released capabilities and implementation scope.',
        steps: [
          {
            num: '01',
            title: 'Unit Onboarding Context',
            desc: 'Secure authenticated login based on an invite issued by the property owner or board.',
          },
          {
            num: '02',
            title: 'Meter Reading Ingestion Context',
            desc: 'Photo capture of water and heating meters prior to monthly cut-off dates.',
          },
          {
            num: '03',
            title: 'Statement Review Context',
            desc: 'Review clearly isolated operational utility charges and statutory dues.',
          },
          {
            num: '04',
            title: 'Maintenance Request Context',
            desc: 'Dispatch a photo-documented ticket when plumbing, lighting, or elevators require service.',
          },
          {
            num: '05',
            title: 'Lease Transition Context',
            desc: 'Reconcile final meter readings smoothly when ending a lease or transferring occupancy.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'Residents & Property Occupants',
      },
      cta: {
        title: 'Experience a transparent residential community',
        subtitle:
          'CLADORA replaces friction and opacity with verifiable data, explainable math, and auditable communication channels.',
        primary: 'Request Community Information',
        secondary: 'Explore Platform Architecture',
      },
    },
    fa: {
      breadcrumbs: {
        home: 'خانه',
        solutions: 'راهکارها',
        current: 'ساکنان و بهره‌برداران',
      },
      hero: {
        badge: 'تجربه سکونت و بهره‌برداری از ملک',
        title: 'شفافیت مالی و آرامش خاطر در محیط زندگی',
        subtitle:
          'زمینه‌های سکونت می‌توانند شامل دسترسی به اطلاعات مالی مجاز، ثبت خوانش کنتور، درخواست‌های نگهداری و ارتباطات تاییدشده باشند، بسته به دامنه قابلیت‌های فعال و سطح پیاده‌سازی.',
        ctaPrimary: 'آشنایی با پرتال ساکنان',
        ctaSecondary: 'معماری پلتفرم',
      },
      positioning: {
        badge: 'تجمیع کانونی و یکپارچه',
        title: 'ساکنان و بهره‌برداران: یک محیط مشترک، اختیارات متناسب',
        p: 'چه مالک مقیم در ساختمان باشید، چه مستأجر یک واحد مسکونی، و چه بهره‌بردار یک واحد خصوصی در مجتمعی چندمنظوره، کلادورا اطلاعات و دسترسی‌های مالی را دقیقاً متناسب با رابطه حقوقی شما نمایش می‌دهد.',
        points: [
          {
            title: 'تفکیک ساخت‌یافته هزینه‌های جاری و سرمایه‌ای',
            desc: 'مستأجران صرفاً هزینه‌های مصرفی جاری (آب، گاز، نظافت) را مشاهده می‌کنند و مبالغ مرتبط با صندوق‌های تعمیرات و اندوخته روی حساب مالک ثبت می‌گردد.',
          },
          {
            title: 'ثبت تصویری ارقام کنتورها',
            desc: 'امکان ارسال عکس کنتورهای آب و انرژی، هرگونه ابهام یا خطای انسانی در ثبت اعداد را برطرف می‌سازد.',
          },
          {
            title: 'ثبت مستقیم درخواست‌های تعمیرات',
            desc: 'تیکت‌های خرابی با امکان الصاق عکس برای مدیریت ساختمان ارسال شده و وضعیت پیگیری آن نمایش داده می‌شود.',
          },
        ],
      },
      pillars: {
        badge: 'ستون‌های قابلیتی پلتفرم',
        title: 'ترکیب معماری برای ساکنان و بهره‌برداران',
        items: [
          {
            domain: 'FIN01',
            title: 'دید مالی مجاز بر هزینه‌ها',
            desc: 'تفکیک ساختاریافته اقلام صورت‌حساب شارژ همراه با فرمول‌های قابل‌توضیح تسهیم هزینه‌های مشترک.',
            icon: Receipt,
          },
          {
            domain: 'OPERATIONS',
            title: 'بافت درخواست‌های نگهداری و تعمیرات',
            desc: 'اعلام عیوب تأسیساتی داخل واحد یا مشاعات ساختمان و اطلاع از روند رسیدگی تکنسین تا رفع کامل عیب.',
            icon: Wrench,
          },
          {
            domain: 'COMMUNICATIONS',
            title: 'انتشار اطلاعیه‌ها و پیام‌های رسمی',
            desc: 'دریافت پیام‌های اضطراری، زمان‌بندی قطع احتمالی آب یا برق و اطلاعیه‌های رسمی مدیریت ساختمان.',
            icon: Megaphone,
          },
          {
            domain: 'C&E',
            title: 'راهنمای ساختمان و قوانین سکونت',
            desc: 'دسترسی سریع به آیین‌نامه داخلی مجتمع، شماره‌های اضطراری و دستورالعمل‌های بهره‌برداری از مشاعات.',
            icon: Compass,
          },
        ],
      },
      journey: {
        badge: 'سیر معماری فرضی و مشارکتی',
        title: 'مراحل تعامل ساکنان با پلتفرم کلادورا',
        subtitle:
          'یادداشت معماری: یک سیر فرضی سکونت و بهره‌برداری می‌تواند زمینه‌هایی نظیر موارد زیر را بسته به دامنه قابلیت‌های فعال و تنظیمات هر مجتمع به یکدیگر متصل سازد.',
        steps: [
          {
            num: '۰۱',
            title: 'فعال‌سازی در سامانه واحد',
            desc: 'اتصال به سامانه با دعوت‌نامه رسمی ارسالی از سوی مالک یا مدیریت ساختمان.',
          },
          {
            num: '۰۲',
            title: 'ثبت ارقام و عکس کنتور',
            desc: 'ثبت عکس و ارقام کنتورهای اختصاصی آب و انرژی پیش از پایان دوره محاسباتی.',
          },
          {
            num: '۰۳',
            title: 'مشاهده اطلاعات فیش شارژ',
            desc: 'مشاهده اقلام تفکیک‌شده شارژ ماهانه و ثبت سوابق پرداخت.',
          },
          {
            num: '۰۴',
            title: 'ثبت درخواست نگهداری',
            desc: 'ارسال گزارش نقص فنی در آسانسور، موتورخانه یا تأسیسات واحد با عکس.',
          },
          {
            num: '۰۵',
            title: 'سوابق تسویه و تحویل واحد',
            desc: 'ثبت ارقام نهایی کنتورها و ثبت شفاف سوابق در زمان جابه‌جایی.',
          },
        ],
      },
      governanceNotice: {
        solutionName: 'ساکنان و بهره‌برداران املاک',
      },
      cta: {
        title: 'آرامش و شفافیت در مدیریت ساختمان را تجربه کنید',
        subtitle:
          'کلادورا ابهامات و اصطکاک‌های مرسوم در آپارتمان‌ها را با داده‌های مستند و محاسبات شفاف جایگزین می‌کند.',
        primary: 'درخواست اطلاعات برای مجتمع',
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
              <Home className="w-4 h-4 text-[#0E9F8E]" />
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
