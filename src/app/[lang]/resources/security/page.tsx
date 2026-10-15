import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import {
  Shield,
  ArrowRight,
  Lock,
  FileCheck2,
  Users,
  Server,
  Bot,
  AlertTriangle,
  History,
  CheckCircle,
  HelpCircle,
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
  return getRouteMetadata('/resources/security', params.lang);
}

export default async function SecurityPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        resources: 'Resurse',
        current: 'Securitate & Încredere',
      },
      hero: {
        badge: 'Arhitectura de Securitate & Încredere',
        title: 'Securitate, Guvernanța Datelor & Integritatea Sistemului',
        subtitle:
          'Descoperă modelul de securitate CLADORA: delimitarea spațiilor de lucru, autentificarea contextuală, păstrarea probatorie a documentelor și supravegherea acțiunilor asistate de inteligență artificială.',
      },
      disclaimer: {
        title: 'Notă privind Limitele de Certificare & Garanții Absolute',
        text: 'Această pagină documentează principiile de arhitectură, modelul de date și mecanismele tehnice de protecție ale platformei CLADORA. Prezentarea nu constituie o certificare formală externă (precum certificări ISO sau sigilii oficiale GDPR) și nu pretinde securitate absolută, rezolvare infailibilă a riscurilor cibernetice sau imutabilitate matematică a bazelor de date. Securitatea este o responsabilitate împărtășită între furnizorul de platformă și practicile de administrare ale fiecărui client.',
      },
      pillars: [
        {
          title: 'Granițe Delimitate la Nivel de Workspace',
          desc: 'Structură multi-tenant bazată pe limite delimitate la nivel de workspace, concepute pentru a menține separarea operațională și a reduce expunerea neautorizată a datelor între asociații, chiriași și echipe de administrare.',
          icon: Lock,
        },
        {
          title: 'Niveluri de Asigurare a Autentificării',
          desc: 'Identificarea unică a persoanelor fizice decuplată de permisiunile temporare. Niveluri graduale de asigurare a autentificării și validare riguroasă a autorității înainte de permiterea acțiunilor sensibile.',
          icon: Users,
        },
        {
          title: 'Arhitectură Aliniată Principiilor GDPR',
          desc: 'Concepută în jurul principiilor europene de minimizare a datelor, delimitare a scopului de prelucrare și drepturi ale persoanelor vizate, sprijinită de guvernanță orientată către infrastructura europeană de date.',
          icon: Server,
        },
        {
          title: 'Jurnalizare Aditivă a Evenimentelor de Audit',
          desc: 'Arhitectură bazată pe fluxuri de evenimente aditive și înregistrări ordonate ale acțiunilor operaționale, permițând reconstituirea deciziilor administrative, a transferurilor de drepturi și a aprobărilor financiare.',
          icon: History,
        },
        {
          title: 'Integritatea Probatorie a Documentelor (DOCUMENTS)',
          desc: 'Domeniul DOCUMENTS deține versiunile canonice, metadatele de proveniență și dovezile foto ale recepțiilor tehnice. Nu constituie semnătură electronică calificată sau arhivare notarială legală fără integrare cu servicii acreditate.',
          icon: FileCheck2,
        },
        {
          title: 'Guvernanța Inteligenței Artificiale (WP-09A)',
          desc: 'CLADORA Intelligence operează strict ca un nivel asistent subordonat. Modelele AI nu dețin adevărul canonic, nu modifică direct soldurile financiare și supun acțiunile cu impact autorizării umane corespunzătoare.',
          icon: Bot,
        },
      ],
      responsibilities: {
        title: 'Modelul de Încredere & Responsabilitate Împărtășită',
        desc: 'Securitatea operațională presupune colaborarea între controalele platformei și guvernanța internă a organizației.',
        cladora: {
          title: 'Responsabilitatea Platformei CLADORA',
          items: [
            'Menținerea barierelor de autoritate la nivel de Workspace și API',
            'Înregistrarea aditivă a jurnalelor de evenimente administrative',
            'Criptarea datelor în tranzit și în repaus conform standardelor industriale',
            'Separarea rolurilor tehnice de acces la infrastructura operațională',
          ],
        },
        customer: {
          title: 'Responsabilitatea Organizației Client',
          items: [
            'Atribuirea și revocarea la timp a mandatelor și rolurilor în Workspace',
            'Verificarea temeiului legal pentru datele încărcate ale proprietarilor',
            'Revizuirea umană a aprobărilor financiare și a comenzilor de lucru',
            'Securizarea acreditărilor și a dispozitivelor utilizatorilor finali',
          ],
        },
      },
      reporting: {
        title: 'Semnalarea Problemelor de Securitate',
        desc: 'Tratăm cu maximă seriozitate integritatea platformei. Dacă identifici o vulnerabilitate sau o comportare neconformă de acces la date, te rugăm să transmiți o semnalare responsabilă prin intermediul canalelor oficiale de contact ale companiei.',
        buttonText: 'Contactează Echipa Tehnică',
      },
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        resources: 'Resources',
        current: 'Security & Trust',
      },
      hero: {
        badge: 'Security & Trust Architecture',
        title: 'Security, Data Governance & Platform Integrity',
        subtitle:
          'Explore the CLADORA security model: workspace-scoped boundaries, contextual authentication assurance, evidentiary document tracking, and governed artificial intelligence.',
      },
      disclaimer: {
        title: 'Certification Boundaries & Absolute Guarantees Notice',
        text: 'This page documents the architectural principles, data isolation boundaries, and technical controls of the CLADORA platform. This content does not constitute external formal certifications (such as ISO certificates or official statutory GDPR compliance seals) and does not promise mathematical infallibility, zero-trust certifications, or immunity from cyber threats. Security is a shared discipline between the platform architecture and customer administrative practices.',
      },
      pillars: [
        {
          title: 'Workspace-Scoped Boundaries',
          desc: 'Multi-tenant architecture engineered around workspace-scoped boundaries designed to maintain operational separation and reduce cross-context data exposure across associations, occupants, and management firms.',
          icon: Lock,
        },
        {
          title: 'Authentication Assurance Tiers',
          desc: 'Individual human identities are decoupled from temporary workspace entitlements. Graduated authentication assurance and rigorous authority checks guard sensitive operations.',
          icon: Users,
        },
        {
          title: 'GDPR-Aware Data Governance',
          desc: 'Engineered around European privacy principles: data minimization, purpose limitation, and subject access mechanisms, supported by EU-oriented data infrastructure governance.',
          icon: Server,
        },
        {
          title: 'Append-Oriented Event Audit History',
          desc: 'An append-oriented event architecture records administrative actions, role handovers, and financial approvals sequentially, facilitating institutional auditability.',
          icon: History,
        },
        {
          title: 'Document & Evidence Integrity (DOCUMENTS)',
          desc: 'The DOCUMENTS provider maintains canonical document versions, provenance logs, and photographic work order receipts. Does not constitute a qualified electronic signature or statutory legal archive without external trust providers.',
          icon: FileCheck2,
        },
        {
          title: 'AI Governance Model (WP-09A)',
          desc: 'CLADORA Intelligence operates strictly as a subordinate assistive layer. AI models never own canonical truth, cannot unilaterally alter financial balances, and remain subject to policy gates and human sign-off.',
          icon: Bot,
        },
      ],
      responsibilities: {
        title: 'The Shared Responsibility & Trust Model',
        desc: 'Operational trust relies on the clear partition between platform technical controls and organizational operational governance.',
        cladora: {
          title: 'CLADORA Platform Responsibilities',
          items: [
            'Enforcing workspace and API-level authority boundaries',
            'Sequential append logging of administrative event streams',
            'Encryption of data in transit and at rest using standard protocols',
            'Separation of engineering access from production database records',
          ],
        },
        customer: {
          title: 'Customer Organization Responsibilities',
          items: [
            'Timely provisioning and revocation of workspace member roles',
            'Establishing lawful bases for occupant personal data intake',
            'Mandatory human review for financial disbursements and close cycles',
            'Protecting user endpoint devices and login credentials',
          ],
        },
      },
      reporting: {
        title: 'Vulnerability Disclosure & Security Contact',
        desc: 'We take platform integrity seriously. If you discover a potential vulnerability or unexpected data boundary behavior, please submit a responsible disclosure through our verified contact channels.',
        buttonText: 'Contact Technical Team',
      },
    },
    fa: {
      breadcrumbs: {
        home: 'صفحه اصلی',
        resources: 'منابع',
        current: 'امنیت و اعتماد',
      },
      hero: {
        badge: 'معماری امنیت و حاکمیت داده‌ها',
        title: 'امنیت، حاکمیت اطلاعات و حفظ یکپارچگی سامانه',
        subtitle:
          'آشنایی با مبانی امنیت در کلادورا: مرزهای تفکیک‌شده فضاهای کاری، احراز هویت بافت‌محور، ثبت مستندات با حفظ اصالت و هوش مصنوعی مقید به نظارت انسانی.',
      },
      disclaimer: {
        title: 'شفافیت حدود گواهی‌نامه‌ها و عدم ادعای امنیت مطلق',
        text: 'این مستند تشریح‌کننده الگوهای معماری، مرزهای دسترسی و سازوکارهای فنی حفاظت از داده‌ها در کلادورا است. این مطالب به منزله صدور گواهی‌نامه‌های رسمی نهادهای بیرونی (نظیر گواهی رسمی ISO یا تاییدیه انحصاری GDPR) نبوده و متضمن ادعای نفوذناپذیری مطلق، حل قطعی تمام تهدیدات یا تضمین ایمنی ریاضی نیست. امنیت یک مسئولیت مشترک میان زیرساخت پلتفرم و انضباط اداری هر سازمان است.',
      },
      pillars: [
        {
          title: 'مرزهای تفکیک‌شده در سطح فضای کاری (Workspace)',
          desc: 'معماری چندمستأجره با مرزهای تعریف‌شده در سطح فضای کاری، جهت حفظ استقلال عملیاتی و کاهش احتمال دسترسی‌های ناخواسته میان مجتمع‌ها، مستأجران و شرکت‌های مدیریت.',
          icon: Lock,
        },
        {
          title: 'سطوح اطمینان در احراز هویت',
          desc: 'تفکیک هویت فردی کاربران از مجوزهای موقت فضاهای کاری؛ الزام به احراز هویت قوی‌تر و اعتبارسنجی سلسله‌مراتب اختیارات پیش از انجام عملیات حساس.',
          icon: Users,
        },
        {
          title: 'حاکمیت داده‌ها منطبق بر استانداردهای GDPR',
          desc: 'طراحی مبتنی بر اصول اروپایی بهینه‌سازی حجم داده‌ها، تفکیک دقیق اهداف پردازش و حفظ حقوق افراد، متکی بر انضباط حاکم بر مراکز داده منطقه‌ای.',
          icon: Server,
        },
        {
          title: 'ثبت ترتیبی و افزایشی رخدادهای ممیزی (Audit Log)',
          desc: 'معماری مبتنی بر ثبت ترتیبی رویدادها، امکان بازخوانی و ممیزی تاریخی اقدامات مدیران، انتقال مسئولیت‌ها و تایید تراکنش‌های مالی را فراهم می‌آورد.',
          icon: History,
        },
        {
          title: 'حفظ اصالت اسناد و مدارک در دامنه DOCUMENTS',
          desc: 'متولی مرجع نسخه‌های اصلی مدارک، سوابق تحویل کار و تصاویر صورت‌جلسات؛ بدون ادعای ارائه امضای الکترونیک رسمی قضایی یا جایگزینی دفاتر اسناد رسمی بدون اتصال به سامانه‌های مجاز.',
          icon: FileCheck2,
        },
        {
          title: 'حاکمیت بر هوش مصنوعی بر اساس WP-09A',
          desc: 'هوش عملیاتی کلادورا منحصراً به عنوان دستیار تسهیل‌کننده و در جایگاه زیردست عمل می‌کند. مدل‌های هوش مصنوعی مرجع حقایق سامانه نبوده و اقدامات دارای اثر حقوقی نیازمند تایید مستقیم انسان هستند.',
          icon: Bot,
        },
      ],
      responsibilities: {
        title: 'مدل اعتماد و مسئولیت مشترک در امنیت',
        desc: 'حفظ امنیت عملیاتی مستلزم هماهنگی و هم‌افزایی میان کنترل‌های فنی سامانه و شیوه مدیریت داده‌ها در سازمان مشتری است.',
        cladora: {
          title: 'تعهدات و مسئولیت‌های پلتفرم کلادورا',
          items: [
            'اعمال سخت‌گیرانه مرزهای دسترسی در سطح فضاهای کاری و رابط‌های نرم‌افزاری (API)',
            'ثبت متوالی و تغییرناپذیر زنجیره رویدادهای سیستمی و مدیریتی',
            'رمزنگاری اطلاعات در مسیر تبادل و در وضعیت ذخیره‌سازی طبق استانداردهای رایج',
            'تفکیک دسترسی‌های فنی مهندسی از پایگاه داده‌های اطلاعات مشتریان',
          ],
        },
        customer: {
          title: 'مسئولیت‌های سازمان و مدیران استفاده‌کننده',
          items: [
            'تعریف دقیق و ابطال به‌موقع نقش‌ها و دسترسی‌های کاربران در فضاهای کاری',
            'احراز مبنای قانونی برای بارگذاری و پردازش اطلاعات شخصی ساکنان',
            'نظارت مستقیم و بررسی انسانی پیش از تایید هزینه‌های مالی و بستن دوره‌ها',
            'حفاظت از کلمات عبور، دستگاه‌های ورود و دسترسی‌های فیزیکی کارکنان',
          ],
        },
      },
      reporting: {
        title: 'گزارش موارد امنیتی و کانال‌های ارتباطی',
        desc: 'ما به ارتقای مستمر امنیت پلتفرم متعهدیم. در صورت مشاهده هرگونه نقص احتمالی یا رفتار غیرمنتظره در مرزهای دسترسی، لطفاً مراتب را از طریق کانال‌های ارتباطی رسمی به اطلاع تیم فنی برسانید.',
        buttonText: 'ارتباط با تیم فنی و پشتیبانی',
      },
    },
  }[lang];

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
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
            <Shield className="w-3.5 h-3.5" />
            <span>{content.hero.badge}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#102A43] tracking-tight">
            {content.hero.title}
          </h1>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {content.hero.subtitle}
          </p>
        </div>

        {/* Governance & Disclaimer Notice Box */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#D3DCE6] shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="font-bold text-[#102A43]">{content.disclaimer.title}</div>
            <div className="text-[#52667A] leading-relaxed">{content.disclaimer.text}</div>
          </div>
        </div>

        {/* Security Pillars Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {content.pillars.map((pillar, idx) => {
            const Icon = pillar.icon;
            return (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-sm hover:border-[#B2E5DF] transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-[#102A43] leading-snug">
                    {pillar.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                    {pillar.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Shared Responsibility Section */}
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43]">
              {content.responsibilities.title}
            </h2>
            <p className="text-sm text-[#52667A] mt-1">{content.responsibilities.desc}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Platform Responsibilities */}
            <div className="bg-white rounded-2xl p-7 border border-[#E2E8F0] shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 text-sm font-bold text-[#0E9F8E]">
                <CheckCircle className="w-5 h-5" />
                <span>{content.responsibilities.cladora.title}</span>
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm text-[#52667A]">
                {content.responsibilities.cladora.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="text-[#0E9F8E] font-bold mt-0.5">•</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Customer Responsibilities */}
            <div className="bg-white rounded-2xl p-7 border border-[#E2E8F0] shadow-sm space-y-4">
              <div className="flex items-center gap-2.5 text-sm font-bold text-[#102A43]">
                <Users className="w-5 h-5 text-[#627D98]" />
                <span>{content.responsibilities.customer.title}</span>
              </div>
              <ul className="space-y-2.5 text-xs sm:text-sm text-[#52667A]">
                {content.responsibilities.customer.items.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="text-[#627D98] font-bold mt-0.5">•</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Reporting & Disclosure Box */}
        <div className="bg-white rounded-2xl p-8 border border-[#D3DCE6] shadow-sm max-w-4xl mx-auto text-center space-y-4">
          <h3 className="text-xl font-bold text-[#102A43]">
            {content.reporting.title}
          </h3>
          <p className="text-xs sm:text-sm text-[#52667A] max-w-2xl mx-auto leading-relaxed">
            {content.reporting.desc}
          </p>
          <div className="pt-2">
            <Link
              href={`/${lang}/contact`}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#0E9F8E] hover:bg-[#0A7E71] rounded-xl transition-colors shadow-sm"
            >
              <span>{content.reporting.buttonText}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
