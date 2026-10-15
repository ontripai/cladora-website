import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import { getSiteUrl } from '@/config/site';
import {
  Compass,
  ArrowRight,
  ShieldAlert,
  Database,
  GitBranch,
  CheckCircle2,
  FileCheck,
  RotateCcw,
  Layers,
  Sliders,
  AlertCircle,
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
  return getRouteMetadata('/resources/migration-hub', params.lang);
}

export default async function MigrationHubPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        resources: 'Resurse',
        current: 'Hub-ul de Migrare & Tranziție',
      },
      hero: {
        badge: 'Metodologie Controlată de Migrare',
        title: 'Hub-ul de Migrare Tehnologică & Tranziție a Portofoliilor',
        subtitle:
          'Un cadru arhitectural riguros pentru transferul datelor de patrimoniu, istoricului de consum și soldurilor din sisteme imobiliare legacy către arhitectura CLADORA.',
      },
      disclaimer: {
        title: 'Guvernanță & Limitare de Responsabilitate Metodologică',
        text: 'Migrarea descrie o metodologie arhitecturală controlată și principii de validare în etape. Platforma nu pretinde reconciliere automată universală, zero erori implicite, tranziție fără timpi de procesare sau echivalență financiară automată fără revizuire umană autorizată. Fiecare pas necesită verificare și acceptanță explicită.',
      },
      principles: {
        title: 'Principiile Fundamentale de Migrare',
        subtitle: 'Proiectate pentru a proteja integritatea patrimoniului și a preveni coruperea datelor financiare.',
        items: [
          {
            title: 'Principiul Refuzului la Scriere (Zero-Write)',
            desc: 'Arhitectura de migrare este concepută pentru a refuza mutațiile atunci când autoritatea necesară, validarea, maparea sau starea de migrare nu pot fi stabilite neechivoc.',
            icon: ShieldAlert,
          },
          {
            title: 'Proveniența Documentară a Înregistrărilor',
            desc: 'Modelul de migrare este conceput pentru a păstra elementele de proveniență, precum sistemul sursă, înregistrarea originală, decizia de mapare, lotul de import și starea de validare.',
            icon: FileCheck,
          },
          {
            title: 'Etape Reversibile & Plan de Rollback',
            desc: 'Cadrul metodologic stabilește puncte de control și proceduri de revenire concepute pentru loturile nefinalizate, permițând întreruperea tranziției fără compromiterea spațiilor de lucru active.',
            icon: RotateCcw,
          },
          {
            title: 'Validare Asistată & Control Uman',
            desc: 'Stările financiare de migrare cu impact sunt concepute pentru a rămâne supuse unor controale adecvate de validare și acceptanță, inclusiv revizuirii umane acolo unde este necesar.',
            icon: Sliders,
          },
        ],
      },
      stages: {
        title: 'Etapele Ciclului de Migrare',
        subtitle: 'O succesiune structurată de la inventariere până la verificarea post-cutover.',
        steps: [
          {
            num: '01',
            title: 'Inventarierea Surselor & Clasificarea Datelor',
            desc: 'Cartografierea fișierelor existente (baze de date relationale, registre tabulare, arhive scanate) și clasificarea informațiilor în: date de patrimoniu, evidențe de identitate, jurnale de consum și solduri contabile.',
          },
          {
            num: '02',
            title: 'Maparea Identității Imobiliare & a Unităților',
            desc: 'Stabilirea structurii ierarhice în CORE: proprietate, clădire, scară, unități individuale, cote-părți indivize și echipamente comune, eliminând duplicările și codificările inconsistente.',
          },
          {
            num: '03',
            title: 'Cartografierea Relațiilor & Mandatelor',
            desc: 'Maparea persoanelor către unități pe baza relațiilor juridice valide (proprietar, chiriaș, membru comitet, administrator), configurând spațiile de lucru cu autoritate delimitată.',
          },
          {
            num: '04',
            title: 'Rularea de Validare Paralelă (Shadow Run)',
            desc: 'Metodologie comparativă: o abordare de validare paralelă poate compara rezultate selectate dintr-o sursă legacy și o stare țintă pregătită pentru a identifica diferențele înainte de comutare.',
          },
          {
            num: '05',
            title: 'Reconcilierea Soldurilor de Deschidere în FIN01',
            desc: 'Importul și verificarea soldurilor inițiale, fondurilor de rulment și de reparații. Înregistrarea se face sub formă de sold de deschidere aprobat, cu păstrarea referinței la sursa inițială.',
          },
          {
            num: '06',
            title: 'Comutarea Operațională (Cutover) & Verificare',
            desc: 'Tranziția operațională etapizată către CLADORA ca mediu de înregistrare, însoțită de proceduri metodologice de verificare și audit în primele cicluri operaționale.',
          },
        ],
      },
      provenanceMatrix: {
        title: 'Elementele Provenienței de Migrare',
        desc: 'Cum păstrăm firul probatoriu pentru fiecare înregistrare migrată în DOCUMENTS și FIN01:',
        headers: ['Dimensiune Proveniență', 'Rol Arhitectural', 'Exemplu / Conținut'],
        rows: [
          ['Sistem Sursă', 'Identifică aplicația legacy sau mediul de proveniență', 'Ex: Export ERP v4.2 / Registru Excel HOA-2024'],
          ['Înregistrare Sursă', 'Cheia primară sau referința unică inițială', 'ID: UNIT-882-FL4 / DOC-SCAN-1092'],
          ['Decizie de Mapare', 'Regula aplicată pentru conversia în modelul CLADORA', 'Conversie cotă-parte fracționară în cotă zecimală ponderată'],
          ['Lot de Import (Batch ID)', 'Grupează entitățile procesate în aceeași sesiune', 'BATCH-MIG-2026-10-RO-0041'],
          ['Rezultat Validare', 'Statutul verificărilor automate pre-angajare', 'Consistență verificată / Fără conflict de relație'],
          ['Semnătură de Acceptanță', 'Identificatorul persoanei autorizate care a validat importul', 'Validat de Administrator Autorizat la data comutării'],
        ],
      },
      cta: {
        title: 'Evaluează portofoliul pentru o tranziție controlată',
        subtitle:
          'Consultă specialiștii noștri pentru o analiză de compatibilitate a datelor și stabilirea unui calendar de migrare asistată.',
        buttonPrimary: 'Solicită Consultanță de Migrare',
        buttonSecondary: 'Citește Întrebările Frecvente',
      },
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        resources: 'Resources',
        current: 'Migration & Transition Hub',
      },
      hero: {
        badge: 'Controlled Migration Methodology',
        title: 'Property Technology Migration & Portfolio Transition Hub',
        subtitle:
          'A disciplined architectural framework for migrating property registries, meter histories, and financial opening balances from legacy software into the CLADORA platform.',
      },
      disclaimer: {
        title: 'Methodology Governance & Claim Disclaimer',
        text: 'This hub outlines a controlled migration methodology and staged validation principles. The platform does not claim universal automated reconciliation, guaranteed zero errors, zero-downtime execution, or automatic financial equivalence without authorized human review. Every milestone requires explicit human verification and acceptance.',
      },
      principles: {
        title: 'Foundational Migration Principles',
        subtitle: 'Engineered to safeguard property records and prevent ledger corruption.',
        items: [
          {
            title: 'Zero-Write Mutation Denial Principle',
            desc: 'The migration architecture is designed to deny mutations when required authority, validation, mapping, or migration state cannot be established.',
            icon: ShieldAlert,
          },
          {
            title: 'Complete Record Provenance',
            desc: 'The migration model is designed to preserve provenance such as source system, source record, mapping decision, import batch, and validation state.',
            icon: FileCheck,
          },
          {
            title: 'Reversible Milestones & Rollback Planning',
            desc: 'The methodological framework establishes checkpoint gates and rollback procedures designed for uncommitted staging batches, allowing transition pauses without compromising active workspaces.',
            icon: RotateCcw,
          },
          {
            title: 'Assisted Validation & Human Oversight',
            desc: 'Consequential financial migration states are designed to remain subject to appropriate validation and acceptance controls, including human review where required.',
            icon: Sliders,
          },
        ],
      },
      stages: {
        title: 'The Migration Lifecycle Stages',
        subtitle: 'A systematic sequence from source intake to post-cutover verification.',
        steps: [
          {
            num: '01',
            title: 'Source Inventory & Data Classification',
            desc: 'Cataloging existing records (relational databases, spreadsheets, document scans) and classifying into: physical assets, identity records, consumption logs, and financial balances.',
          },
          {
            num: '02',
            title: 'Property & Unit Registry Mapping',
            desc: 'Establishing the CORE hierarchy: property, building structures, individual units, common ownership shares, and shared equipment, resolving legacy duplicate records.',
          },
          {
            num: '03',
            title: 'Relationship & Authority Structuring',
            desc: 'Connecting persons to units based on valid legal relationships (owner, tenant, board member, manager), configuring workspaces with scoped operational authority.',
          },
          {
            num: '04',
            title: 'Shadow / Parallel Validation Run',
            desc: 'A comparative reference pattern: a parallel-validation approach can compare selected outputs from a legacy source and a staged target state to identify differences before cutover.',
          },
          {
            num: '05',
            title: 'Opening Balance Reconciliation in FIN01',
            desc: 'Importing and verifying opening balances, maintenance reserves, and working capital funds. Entries are posted as verified opening positions tied to source evidence.',
          },
          {
            num: '06',
            title: 'Operational Cutover & Post-Verification',
            desc: 'Staged operational transition toward CLADORA as the active record provider, supported by methodological verification and audit checklists during initial cycles.',
          },
        ],
      },
      provenanceMatrix: {
        title: 'Migration Provenance Architecture',
        desc: 'How evidentiary traceability is maintained across DOCUMENTS and FIN01 for every migrated item:',
        headers: ['Provenance Dimension', 'Architectural Role', 'Example / Payload'],
        rows: [
          ['Source System', 'Identifies the originating legacy application or dataset', 'e.g., Legacy ERP v4.2 / Spreadsheet export HOA-2024'],
          ['Source Record ID', 'Primary key or unique reference in original system', 'ID: UNIT-882-FL4 / DOC-SCAN-1092'],
          ['Mapping Decision', 'Documented rule applied for CLADORA model conversion', 'Fractional ownership share converted to weighted basis'],
          ['Import Batch ID', 'Groups entities processed during the same import execution', 'BATCH-MIG-2026-10-EU-0041'],
          ['Validation Status', 'Outcome of pre-commit validation checks', 'Schema verified / No relationship overlap detected'],
          ['Acceptance Signature', 'Attribution of the authorized manager approving the import', 'Signed off by Certified Administrator at cutover date'],
        ],
      },
      cta: {
        title: 'Evaluate your portfolio for a controlled migration',
        subtitle:
          'Consult with our migration specialists for a data readiness assessment and a tailored transition roadmap.',
        buttonPrimary: 'Request Migration Assessment',
        buttonSecondary: 'View FAQ',
      },
    },
    fa: {
      breadcrumbs: {
        home: 'صفحه اصلی',
        resources: 'منابع',
        current: 'پایگاه مهاجرت و انتقال اطلاعات',
      },
      hero: {
        badge: 'متدولوژی کنترل‌شده مهاجرت',
        title: 'پایگاه مهاجرت فناورانه و انتقال ساختارمند سبد املاک',
        subtitle:
          'چارچوب معماری منسجم برای انتقال شناسنامه‌های ملکی، سوابق کنتورها و مانده‌های مالی از نرم‌افزارهای سنتی به بستر یکپارچه کلادورا.',
      },
      disclaimer: {
        title: 'حاکمیت متدولوژی و شفافیت حدود مسئولیت',
        text: 'این پایگاه تشریح‌کننده روش‌شناسی کنترل‌شده و اصول اعتبارسنجی مرحله‌ای مهاجرت است. پلتفرم ادعای مغایرت‌گیری خودکار بدون دخالت، عدم وجود هرگونه خطا بدون بررسی، یا انتقال بدون وقفه عملیاتی را ندارد. هر مرحله نیازمند بازبینی و تأیید صریح مسئولان مجاز است.',
      },
      principles: {
        title: 'اصول بنیادین در مهاجرت اطلاعات',
        subtitle: 'طراحی‌شده برای صیانت از اسناد ملکی و جلوگیری از بروز خطاهای تراز مالی.',
        items: [
          {
            title: 'اصل امتناع از ثبت بدون قطعیت (Zero-Write)',
            desc: 'معماری مهاجرت به گونه‌ای طراحی شده است که در صورت عدم احراز اختیارات لازم، عدم انطباق اعتبارسنجی یا نقص در تطبیق وضعیت، از اعمال تغییرات در داده‌ها ممانعت به عمل آورد.',
            icon: ShieldAlert,
          },
          {
            title: 'حفظ اصالت و منشأ داده‌ها (Provenance)',
            desc: 'مدل معماری مهاجرت به گونه‌ای طراحی شده است که ارکان اصالت داده‌ها نظیر سیستم مبدا، شناسه رکورد اولیه، قاعده تبدیل، شناسه دسته واردسازی و وضعیت اعتبارسنجی را حفظ نماید.',
            icon: FileCheck,
          },
          {
            title: 'مراحل بازگشت‌پذیر و برنامه‌ریزی Rollback',
            desc: 'چارچوب متدولوژی مشتمل بر نقاط کنترلی و فرآیندهای بازگشت (Rollback) برای بسته‌های نهایی‌نشده است تا امکان توقف فرآیند بدون آسیب به فضاهای کاری فعال میسر باشد.',
            icon: RotateCcw,
          },
          {
            title: 'اعتبارسنجی کمکی توأم با نظارت انسانی',
            desc: 'وضعیت‌های مالی حساس در مهاجرت اطلاعات به گونه‌ای طراحی شده‌اند که مقید به کنترل‌های اعتبارسنجی و پذیرش مناسب، از جمله بازبینی انسانی در موارد لازم، باقی بمانند.',
            icon: Sliders,
          },
        ],
      },
      stages: {
        title: 'مراحل چرخه حیات مهاجرت سیستم',
        subtitle: 'مسیری گام‌به‌گام از ارزیابی اولیه تا نظارت پس از آغاز به کار.',
        steps: [
          {
            num: '01',
            title: 'شناسایی منابع و طبقه‌بندی اطلاعات',
            desc: 'فهرست‌برداری از فایل‌های موجود (پایگاه‌های داده، جداول اکسل، اسناد اسکن‌شده) و دسته‌بندی به: مشخصات فیزیکی، هویت مالکان، کارکرد انشعابات و ترازهای مالی.',
          },
          {
            num: '02',
            title: 'تطبیق ساختار ملک و واحدهای فرعی در CORE',
            desc: 'ترسیم ساختار درختی در هسته مرکزی: کل مجموعه، بلوک‌ها، واحدهای مستقل، قدرالسهم‌های مشاعی و تجهیزات مشترک، توأم با پاکسازی شناسه‌های تکراری.',
          },
          {
            num: '03',
            title: 'تنظیم روابط حقوقی و تفویض اختیارات',
            desc: 'اتصال اشخاص به واحدها بر مبنای مستندات معتبر (مالک، مستأجر، عضو هیئت‌مدیره، مدیر) و راه‌اندازی فضاهای کاری با اختیارات دقیق و زمان‌دار.',
          },
          {
            num: '04',
            title: 'اجرای موازی و اعتبارسنجی تطبیقی (Shadow Run)',
            desc: 'یک الگوی مرجع مقایسه‌ای: رویکرد اعتبارسنجی موازی می‌تواند خروجی‌های منتخب از منبع قدیمی و وضعیت آماده‌شده در سامانه مقصد را جهت شناسایی مغایرت‌ها پیش از انتقال نهایی مقایسه نماید.',
          },
          {
            num: '05',
            title: 'مغایرت‌گیری و ثبت مانده‌های افتتاحیه در FIN01',
            desc: 'ورود و کنترل مانده‌های بدهکاری و بستانکاری، صندوق‌های ذخیره و تنخواه‌گردان به عنوان سند افتتاحیه با انتساب مستقیم به شواهد سیستم قبلی.',
          },
          {
            num: '06',
            title: 'شروع عملیات قطعی (Cutover) و بازبینی',
            desc: 'گذار عملیاتی مرحله‌ای به کلادورا به عنوان سامانه ثبت رخدادها، توأم با چک‌لیست‌های روش‌مند بازبینی و ممیزی در دوره‌های آغازین.',
          },
        ],
      },
      provenanceMatrix: {
        title: 'معماری حفظ اصالت داده‌های مهاجرت',
        desc: 'چگونگی نگهداری شواهد و زنجیره قابلیت پیگیری در دامنه‌های DOCUMENTS و FIN01:',
        headers: ['بعد اصالت داده', 'نقش معماری در پلتفرم', 'نمونه داده / محتوا'],
        rows: [
          ['سیستم مبدا', 'مشخص‌کننده نرم‌افزار قدیمی یا منبع داده اولیه', 'مثال: خروجی نرم‌افزار قدیمی نسخه ۴.۲ / فایل اکسل مجتمع'],
          ['شناسه رکورد مبدا', 'کلید اصلی یا شناسه اختصاصی در سیستم پیشین', 'ID: UNIT-882-FL4 / DOC-SCAN-1092'],
          ['قاعده تطبیق', 'منطق مستند اعمال‌شده جهت تبدیل به مدل استاندارد کلادورا', 'تبدیل سهم درصدی به ضریب وزنی استاندارد متراژ'],
          ['شناسه دسته (Batch ID)', 'گروه‌بندی رکوردهای پردازش‌شده در یک نشست مشترک', 'BATCH-MIG-2026-10-FA-0041'],
          ['وضعیت اعتبارسنجی', 'نتیجه بررسی‌های خودکار پیش از ذخیره قطعی', 'ساختار تایید شد / بدون تداخل در روابط مالکیتی'],
          ['امضای تایید نهایی', 'شناسه کاربر مجاز تأییدکننده واردسازی داده‌ها', 'تأییدشده توسط مدیر دارای اختیارات رسمی در تاریخ تحویل'],
        ],
      },
      cta: {
        title: 'ارزیابی سبد املاک برای مهاجرت کنترل‌شده',
        subtitle:
          'جهت بررسی آمادگی داده‌ها و تدوین برنامه زمان‌بندی مرحله‌ای با کارشناسان مهاجرت کلادورا تماس بگیرید.',
        buttonPrimary: 'درخواست ارزیابی مهاجرت',
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
        name: content.breadcrumbs.resources,
        item: `${baseUrl}/${lang}/resources`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: content.breadcrumbs.current,
        item: `${baseUrl}/${lang}/resources/migration-hub`,
      },
    ],
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
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
            <Compass className="w-3.5 h-3.5" />
            <span>{content.hero.badge}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#102A43] tracking-tight">
            {content.hero.title}
          </h1>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {content.hero.subtitle}
          </p>
        </div>

        {/* Governance Disclaimer Box */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#D3DCE6] shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="font-bold text-[#102A43]">{content.disclaimer.title}</div>
            <div className="text-[#52667A] leading-relaxed">{content.disclaimer.text}</div>
          </div>
        </div>

        {/* Section 1: Principles */}
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43]">
              {content.principles.title}
            </h2>
            <p className="text-sm text-[#52667A] mt-1">{content.principles.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.principles.items.map((principle, idx) => {
              const Icon = principle.icon;
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-sm hover:border-[#B2E5DF] transition-all space-y-3"
                >
                  <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-[#102A43]">{principle.title}</h3>
                  <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
                    {principle.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 2: Stages */}
        <div className="space-y-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43]">
              {content.stages.title}
            </h2>
            <p className="text-sm text-[#52667A] mt-1">{content.stages.subtitle}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.stages.steps.map((step) => (
              <div
                key={step.num}
                className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="text-2xl font-black text-[#0E9F8E]/40 font-mono">
                    {step.num}
                  </div>
                  <h3 className="text-base font-bold text-[#102A43]">{step.title}</h3>
                  <p className="text-xs text-[#52667A] leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Provenance Table */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43]">
              {content.provenanceMatrix.title}
            </h2>
            <p className="text-sm text-[#52667A] mt-1">{content.provenanceMatrix.desc}</p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm text-start">
                <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#102A43] font-bold">
                  <tr>
                    {content.provenanceMatrix.headers.map((header, idx) => (
                      <th key={idx} className="p-4 text-start font-bold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F4F8]">
                  {content.provenanceMatrix.rows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-[#FAFCFE] transition-colors">
                      <td className="p-4 font-bold text-[#102A43] whitespace-nowrap">
                        {row[0]}
                      </td>
                      <td className="p-4 text-[#52667A]">{row[1]}</td>
                      <td className="p-4 font-mono text-xs text-[#0E9F8E]">{row[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Partnership & FAQ Bridge Box */}
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
              href={`/${lang}/faq`}
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
