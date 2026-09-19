import type { Metadata } from 'next';
import { Language } from '@/types';
import { buildPageMetadata } from '@/config/seo';

interface RouteContent {
  title: string;
  desc: string;
  noIndex?: boolean;
}

export const ROUTE_METADATA_DEFINITIONS: Record<string, Record<Language, RouteContent>> = {
  '/': {
    ro: {
      title: 'Sistemul de Operare pentru Active Rezidențiale & Contabilitate',
      desc: 'CLADORA unește registrele statutare în partidă simplă, Legea 196/2018, controlul analitic suplimentar în partidă dublă, drepturile proprietar-chiriaș și citirea contoarelor într-un singur sistem de operare.',
    },
    en: {
      title: 'Residential Asset Operating System & Statutory Accounting',
      desc: 'CLADORA unifies statutory simple-entry accounting, supplemental double-entry controls, 5D owner-tenant rights, and meter OCR on an auditable platform.',
    },
    fa: {
      title: 'سیستم‌عامل مدیریت دارایی‌های مسکونی و حسابداری قانونی',
      desc: 'کلادورا دفاتر قانونی حسابداری یک‌طرفه (قانون ۱۹۶/۲۰۱۸)، کنترل تحلیلی تکمیلی دوطرفه، تفکیک ۵ بعدی حقوق مالک و مستأجر و قرائت تصویری کنتورها را در یک پلتفرم ارائه می‌دهد.',
    },
  },
  '/pricing': {
    ro: {
      title: 'Tarife transparente & Calculator flexibil',
      desc: 'Tarife transparente de la 0.60 € / unitate / lună. Calculează investiția pentru asociația sau portofoliul tău.',
    },
    en: {
      title: 'Transparent Pricing & Cost Calculator',
      desc: 'Predictable pricing starting from 0.60 € / unit / month. Calculate investment for your HOA or portfolio.',
    },
    fa: {
      title: 'تعرفه‌ها و محاسبه‌گر شفاف هزینه‌ها',
      desc: 'تعرفه‌های شفاف از ۰.۶۰ یورو به ازای هر واحد در ماه. محاسبه دقیق هزینه‌ها متناسب با تعداد واحدها.',
    },
  },
  '/pilot': {
    ro: {
      title: 'Program Pilot București-Ilfov',
      desc: 'Înscrie-te în cohorta pilot CLADORA pentru primele 10 asociații și 2 companii de administrare din București-Ilfov.',
    },
    en: {
      title: 'Bucharest-Ilfov Pilot Cohort',
      desc: 'Join the CLADORA pilot cohort for the first 10 associations and 2 property management firms in Bucharest-Ilfov.',
    },
    fa: {
      title: 'برنامه پایلوت بخارست-ایلفوف',
      desc: 'ثبت‌نام در برنامه پایلوت کلادورا ویژه ۱۰ مجتمع مسکونی و ۲ شرکت مدیریت املاک در بخارست و ایلفوف.',
    },
  },
  '/platform': {
    ro: {
      title: 'Arhitectura Platformei & Tehnologie',
      desc: 'Explorează arhitectura modulară CLADORA: 17 nuclee logice, evidență conformă în partidă simplă, registru analitic suplimentar și reconciliere asistată.',
    },
    en: {
      title: 'Platform Architecture & Technology',
      desc: 'Explore the CLADORA modular architecture: 17 logical cores, statutory simple-entry truth, supplemental ledger controls, and assisted reconciliation.',
    },
    fa: {
      title: 'معماری فنی و ساختار یکپارچه پلتفرم',
      desc: 'بررسی معماری ماژولار کلادورا شامل ۱۷ هسته نرم‌افزاری تخصصی، دفاتر قانونی یک‌طرفه، کنترل‌های تحلیلی تکمیلی و تطبیق ساختاریافته.',
    },
  },
  '/modules': {
    ro: {
      title: 'Cele 17 Module Logice ale Platformei',
      desc: 'Prezentarea detaliată a celor 17 nuclee funcționale: de la contabilitate și contoare până la mentenanță și migrare.',
    },
    en: {
      title: 'The 17 Logical Platform Cores',
      desc: 'Detailed walkthrough of the 17 functional cores: from statutory accounting and supplemental ledger to meter OCR and shadow ledger migration.',
    },
    fa: {
      title: 'مشاهده ۱۷ هسته نرم‌افزاری تخصصی',
      desc: 'معرفی جامع ۱۷ ماژول کاربردی کلادورا: از دفاتر قانونی و کنترل‌های تکمیلی تا قرائت تصویری کنتورها و مدیریت تعمیرات.',
    },
  },
  '/building-dna': {
    ro: {
      title: '8 Arhetipuri de Clădiri & Inginerie Rezidențială',
      desc: 'Reguli specifice adaptate tipologiei constructive: blocuri clasice, clădiri reabilitate, complexe noi și vile.',
    },
    en: {
      title: '8 Residential Building Archetypes & Engineering',
      desc: 'Tailored rule engines for distinct structural typologies: pre-1990 blocks, insulated buildings, and new complexes.',
    },
    fa: {
      title: '۸ تیپولوژی ساختمانی و استانداردهای مهندسی',
      desc: 'قواعد محاسباتی و نگهداری منطبق با نوع سازه: بلوک‌های قبل از ۱۹۹۰، ساختمان‌های نوساز، ویلاها و مجتمع‌ها.',
    },
  },
  '/financial-truth': {
    ro: {
      title: 'Claritate Financiară & Evidență Statutară',
      desc: 'Evidență statutară în partidă simplă, control analitic suplimentar în partidă dublă, corecții exclusiv prin stornare documentată și acces direct la documentele sursă.',
    },
    en: {
      title: 'Financial Truth & Statutory Accounting Controls',
      desc: 'Statutory simple-entry registers, supplemental double-entry ledger controls, documented reversals, and direct source invoice links.',
    },
    fa: {
      title: 'شفافیت مالی و کنترل‌های دفاتر قانونی',
      desc: 'دفاتر قانونی یک‌طرفه، کنترل تراز تحلیلی تکمیلی دوطرفه، ثبت اصلاحات صرفاً از طریق سند اصلاحی و پیوند مستقیم به فاکتورهای مرجع.',
    },
  },
  '/meters': {
    ro: {
      title: 'Contorizare, Citire Asistată & Detecție Anomalii',
      desc: 'Colectare flexibilă a indexurilor: foto OCR asistat, QR code și senzori radio cu verificarea consumurilor neobișnuite.',
    },
    en: {
      title: 'Metering, Assisted Photo OCR & Anomaly Detection',
      desc: 'Multi-channel index collection: assisted photo OCR, QR codes, and radio telemetry with anomaly detection.',
    },
    fa: {
      title: 'قرائت هوشمند کنتورها و پایش شبکه مصرف',
      desc: 'ثبت ارقام کنتور با عکس، کدهای QR و رادیو M-Bus همراه با هشدار هوشمند مصرف غیرعادی و نشتی.',
    },
  },
  '/migration': {
    ro: {
      title: 'Migrare controlată din Xisoft, Aviziero, Excel (Shadow Ledger)',
      desc: 'Tranziție asistată fără riscul pierderilor de date din vechiul program. Rulare paralelă timp de 1-2 luni până la reconcilierea completă a soldurilor.',
    },
    en: {
      title: 'Controlled Legacy Migration with Shadow Ledger Protocol',
      desc: 'Structured data transition from legacy software. Run parallel Shadow Ledger billing for 1-2 months until every balance is mathematically matched.',
    },
    fa: {
      title: 'مهاجرت کنترل‌شده سوابق مالی با پروتکل Shadow Ledger',
      desc: 'انتقال ساختاریافته داده‌ها از نرم‌افزارهای قبلی و فایل‌های اکسل. اجرای موازی تا تطبیق کامل مانده‌حساب‌ها.',
    },
  },
  '/security': {
    ro: {
      title: 'Securitate, Permisiuni RBAC & Conformitate GDPR',
      desc: 'Arhitectură de securitate cu separarea drepturilor pe roluri, jurnale de audit și protecția datelor conform GDPR.',
    },
    en: {
      title: 'Enterprise Security, RBAC & GDPR Compliance',
      desc: 'Role-based access controls, comprehensive audit trail logging, and enterprise GDPR privacy standards.',
    },
    fa: {
      title: 'امنیت سازمانی، سطوح دسترسی RBAC و انطباق با GDPR',
      desc: 'معماری امنیت چندلایه با تفکیک نقش‌ها، ثبت تاریخچه حسابرسی و حفاظت کامل از اطلاعات هویتی و مالی.',
    },
  },
  '/trust': {
    ro: {
      title: 'Încredere, Transparență & Standarde de Audit',
      desc: 'Garanția transparenței operaționale și financiare pentru asociații de proprietari, chiriași și administratori.',
    },
    en: {
      title: 'Trust, Transparency & Audit Standards',
      desc: 'Operational and financial transparency principles for homeowner associations, tenants, and property managers.',
    },
    fa: {
      title: 'اعتماد، شفافیت و استانداردهای ممیزی',
      desc: 'اصول شفافیت مالی و انضباط ساختاری برای انجمن‌های مالکان، مستأجران و مدیران ساختمان.',
    },
  },
  '/association': {
    ro: {
      title: 'Cladora Association (Association OS)',
      desc: 'Sistem de operare dedicat asociațiilor de proprietari: liste de întreținere, Legea 196/2018 și contabilitate clară.',
    },
    en: {
      title: 'Cladora Association (Association OS)',
      desc: 'Dedicated operating system for homeowner associations: statutory allocation, billing, and clear general ledger.',
    },
    fa: {
      title: 'کلادورا انجمن (Association OS)',
      desc: 'سیستم‌عامل تخصصی انجمن‌های مالکان و مدیران ساختمان: تسهیم سهم شارژ، انطباق قانونی و بستن دوره‌ها.',
    },
  },
  '/portfolio': {
    ro: {
      title: 'Cladora Portfolio (Landlord & Portfolio OS)',
      desc: 'Sistem de operare pentru investitori și proprietari: monitorizarea chiriilor, randament net și reconciliere garanții.',
    },
    en: {
      title: 'Cladora Portfolio (Landlord & Portfolio OS)',
      desc: 'Operating system for rental property owners: rent collection tracking, net yields, and security deposits.',
    },
    fa: {
      title: 'کلادورا پورتفولیو (Portfolio OS)',
      desc: 'سیستم‌عامل اختصاصی مالکان چند واحد و سرمایه‌گذاران املاک: ردیابی اجاره‌ها، بازده خالص و حساب امانی ودیعه.',
    },
  },
  '/manager': {
    ro: {
      title: 'Cladora Manager (Management Company OS)',
      desc: 'Consolă centralizată pentru firme de administrare: închidere de lună în masă, dispecerat tichete și monitorizare SLA.',
    },
    en: {
      title: 'Cladora Manager (Management Company OS)',
      desc: 'Multi-association enterprise console: batch month-close, maintenance dispatch, and vendor SLA tracking.',
    },
    fa: {
      title: 'کلادورا منیجر (Manager OS)',
      desc: 'کنسول متمرکز شرکت‌های مدیریت املاک: بستن دوره‌های چند مجتمع، ارجاع تیکت‌های فنی و کنترل قراردادها.',
    },
  },
  '/solutions/associations': {
    ro: {
      title: 'Soluții pentru Asociații de Proprietari',
      desc: 'Administrare transparentă conform Legii 196/2018, împărțirea corectă a cheltuielilor și comunicare facilă cu locatarii.',
    },
    en: {
      title: 'Homeowner Association Solutions',
      desc: 'Transparent HOA management compliant with Law 196/2018, accurate expense allocation, and resident communications.',
    },
    fa: {
      title: 'راهکارهای انجمن‌های مالکان و مجتمع‌ها',
      desc: 'مدیریت شفاف مجتمع‌های مسکونی، تسهیم عادلانه هزینه‌های مشترک و ارتباط سازمان‌یافته با ساکنان.',
    },
  },
  '/solutions/property-managers': {
    ro: {
      title: 'Soluții pentru companii de administrare imobiliară (Manager OS)',
      desc: 'Scalează compania de administrare: închidere de lună în masă (batch), dispecerat tichete mentenanță și SLA furnizori.',
    },
    en: {
      title: 'Property Management Firm Solutions (Manager OS)',
      desc: 'Enterprise multi-association management: batch month-close, ticket SLAs, and workforce delegation.',
    },
    fa: {
      title: 'راهکارهای شرکت‌های مدیریت املاک و مجتمع‌ها (Manager OS)',
      desc: 'مقیاس‌پذیری شرکت‌های مدیریت املاک: بستن دسته‌ای دوره‌های ماهانه، مرکز تخصیص تیکت‌های فنی و کنترل SLA پیمانکاران.',
    },
  },
  '/solutions/property-owners': {
    ro: {
      title: 'Soluții pentru Proprietari de Imobile',
      desc: 'Evidența clară a chiriilor, contractelor și cheltuielilor deductibile pentru proprietari cu unul sau mai multe apartamente.',
    },
    en: {
      title: 'Residential Property Owner Solutions',
      desc: 'Clear visibility into rents, tenant leases, and owner-retained maintenance for single and multi-unit landlords.',
    },
    fa: {
      title: 'راهکارهای مالکان املاک استیجاری',
      desc: 'نظارت دقیق بر قراردادهای اجاره، تفکیک هزینه‌های مالک و مستأجر و مدیریت وصول مطالبات.',
    },
  },
  '/solutions/residents': {
    ro: {
      title: 'Soluții pentru Proprietari Locatari',
      desc: 'Vizibilitate completă asupra cotelor de întreținere, transmitere facilă a indexurilor și participare asistată la adunări.',
    },
    en: {
      title: 'Resident Owner Solutions',
      desc: 'Complete breakdown of monthly maintenance bills, effortless meter index submission, and assembly participation.',
    },
    fa: {
      title: 'راهکارهای ساکنان و مالکان مقیم',
      desc: 'مشاهده جزییات فاکتور شارژ ماهانه، ثبت سریع ارقام کنتور با عکس و شرکت در نظرسنجی‌ها و مجامع.',
    },
  },
  '/solutions/tenants': {
    ro: {
      title: 'Soluții pentru Chiriași Rezidențiali',
      desc: 'Separarea exactă între cheltuielile de consum și fondurile proprietarului, fără discuții la final de contract.',
    },
    en: {
      title: 'Residential Tenant Solutions',
      desc: 'Strict separation between monthly utility consumption and capital funds, ensuring smooth lease handovers.',
    },
    fa: {
      title: 'راهکارهای مستأجران واحدهای مسکونی',
      desc: 'تفکیک شفاف شارژ مصرفی جاری از صندوق‌های سرمایه‌ای و عمرانی با فاکتورهای رسمی و تفکیک‌شده.',
    },
  },
  '/resources/faq': {
    ro: {
      title: 'Întrebări Frecvente & Răspunsuri Tehnice',
      desc: 'Răspunsuri la cele mai comune întrebări despre registre statutare, Legea 196/2018, migrare și securitate.',
    },
    en: {
      title: 'Frequently Asked Questions & Technical Details',
      desc: 'Answers to key questions regarding statutory accounting, supplemental ledger controls, compliance, migration, and security.',
    },
    fa: {
      title: 'پرسش‌های متداول و راهنمای فنی',
      desc: 'پاسخ به سوالات متداول درباره نحوه تسهیم هزینه‌ها، دفاتر قانونی، کنترل‌های حسابداری تکمیلی، انتقال اطلاعات و امنیت سیستم.',
    },
  },
  '/about': {
    ro: {
      title: 'Despre Noi & Misiunea CLADORA',
      desc: 'Construim infrastructura digitală modernă pentru claritate financiară și încredere în comunitățile rezidențiale.',
    },
    en: {
      title: 'About Us & Platform Mission',
      desc: 'Building modern digital infrastructure for financial clarity, transparency, and trust in residential communities.',
    },
    fa: {
      title: 'درباره ما و مأموریت کلادورا',
      desc: 'توسعه زیرساخت دیجیتال مدرن برای شفافیت مالی، انضباط ساختاری و اعتماد در مدیریت املاک مسکونی.',
    },
  },
  '/contact': {
    ro: {
      title: 'Contact & Solicitare Informații',
      desc: 'Ia legătura cu echipa CLADORA pentru întrebări despre programul pilot, demonstrații live sau parteneriate.',
    },
    en: {
      title: 'Contact & Demo Request',
      desc: 'Get in touch with the CLADORA team for pilot cohort inquiries, live demos, or implementation partnerships.',
    },
    fa: {
      title: 'تماس با ما و درخواست دمو',
      desc: 'ارتباط مستقیم با تیم کلادورا جهت شرکت در پایلوت، دریافت مشاوره تخصصی و درخواست دموی زنده.',
    },
  },
  '/privacy': {
    ro: {
      title: 'Politica de Confidențialitate & GDPR',
      desc: 'Standardele noastre de protecție a datelor cu caracter personal în conformitate cu Regulamentul GDPR.',
    },
    en: {
      title: 'Privacy Policy & GDPR Compliance',
      desc: 'Our data protection standards and personal information practices compliant with the GDPR regulation.',
    },
    fa: {
      title: 'سیاست حفظ حریم خصوصی و GDPR',
      desc: 'تعهدات و استانداردهای کلادورا در زمینه حفاظت از داده‌های شخصی و حریم خصوصی بر اساس استانداردهای بین‌المللی.',
    },
  },
  '/terms': {
    ro: {
      title: 'Termeni și Condiții de Utilizare',
      desc: 'Condițiile generale de utilizare a platformei CLADORA pentru asociații, administratori și locatari.',
    },
    en: {
      title: 'Terms and Conditions of Service',
      desc: 'General terms and conditions governing the use of the CLADORA platform for associations and managers.',
    },
    fa: {
      title: 'شرایط و ضوابط استفاده از خدمات',
      desc: 'شرایط عمومی و ضوابط حقوقی استفاده از پلتفرم کلادورا برای مدیران، مالکان و شرکت‌های خدمات ساختمانی.',
    },
  },
  '/cookies': {
    ro: {
      title: 'Politica privind Modulele Cookie',
      desc: 'Informații despre modul în care utilizăm fișierele cookie pentru securitate și preferințele utilizatorilor.',
    },
    en: {
      title: 'Cookie Policy',
      desc: 'Information on how we utilize technical cookies for session security and user preferences.',
    },
    fa: {
      title: 'سیاست استفاده از کوکی‌ها',
      desc: 'اطلاعات شفاف درباره نحوه استفاده از کوکی‌های فنی برای امنیت نشست‌ها و تنظیمات زبان کاربر.',
    },
  },
  '/accessibility': {
    ro: {
      title: 'Declarație de Accesibilitate (WCAG 2.2)',
      desc: 'Angajamentul nostru pentru accesibilitate digitală completă și conformitate cu standardele WCAG 2.2 AA.',
    },
    en: {
      title: 'Accessibility Statement (WCAG 2.2)',
      desc: 'Our commitment to digital accessibility, screen reader support, and WCAG 2.2 AA design standards.',
    },
    fa: {
      title: 'بیانیه دسترسی‌پذیری و استانداردهای WCAG',
      desc: 'تعهد کلادورا به دسترسی‌پذیری کامل وب، پشتیبانی از صفحه‌خوان‌ها و انطباق با استاندارد WCAG 2.2 AA.',
    },
  },
  '/demo': {
    ro: {
      title: 'Sandbox Interactiv & Demonstrație',
      desc: 'Testează funcționalitățile CLADORA în timp real cu date demonstrative simulate.',
      noIndex: true,
    },
    en: {
      title: 'Interactive Sandbox & Demo',
      desc: 'Experience CLADORA workflows in real time with simulated test data.',
      noIndex: true,
    },
    fa: {
      title: 'دموی تعاملی و محیط آزمایشی',
      desc: 'بررسی زنده و تعاملی گردش‌کارهای کلادورا با داده‌های شبیه‌سازی‌شده آزمایشی.',
      noIndex: true,
    },
  },
  '/login': {
    ro: {
      title: 'Autentificare în Cont',
      desc: 'Conectează-te la contul tău CLADORA pentru acces la spațiul de lucru al clădirii sau portofoliului.',
      noIndex: true,
    },
    en: {
      title: 'Sign In to Account',
      desc: 'Sign in to your CLADORA account to access your association or portfolio workspace.',
      noIndex: true,
    },
    fa: {
      title: 'ورود به حساب کاربری',
      desc: 'ورود امن به پنل کاربری کلادورا جهت دسترسی به اطلاعات مالی، اسناد و تیکت‌های ساختمان.',
      noIndex: true,
    },
  },
  '/ui/manager/utility-bills': {
    ro: {
      title: 'Facturi Utilități & Procesare Inteligentă (M25)',
      desc: 'Procesarea inteligentă a facturilor de utilități, extracție date, reconciliere indexuri și aprobare umană.',
    },
    en: {
      title: 'Utility Bills & Invoice Intelligence (M25)',
      desc: 'Intelligent utility invoice processing, OCR extraction, meter matching, and authorized human approval.',
    },
    fa: {
      title: 'قبوض آب و برق و هوش پردازش صورت‌حساب‌ها (M25)',
      desc: 'پردازش هوشمند قبوض مصرفی و انرژی، استخراج داده‌ها، تطبیق با کنتور و تأیید نهایی انسانی.',
    },
  },
  '/information-architecture': {
    ro: {
      title: 'Arhitectura Informațională CLADORA',
      desc: 'Harta completă a modulelor și fluxurilor sistemului de operare CLADORA.',
    },
    en: {
      title: 'CLADORA Information Architecture',
      desc: 'Complete hierarchical blueprint and logical modules of the CLADORA operating system.',
    },
    fa: {
      title: 'معماری اطلاعات و ساختار ماژول‌های کلادورا',
      desc: 'نقشه جامع معماری اطلاعات، ماژول‌ها و پیوندهای سیستم‌عامل کلادورا.',
    },
  },
  '/wireframes/manager': {
    ro: {
      title: 'Wireframes & Specificații UI Manager',
      desc: 'Grile responsive și specificații vizuale pentru spațiile de lucru Manager OS.',
    },
    en: {
      title: 'Manager UI Wireframes & Specifications',
      desc: 'Responsive wireframes and layout specifications for Manager OS workspaces.',
    },
    fa: {
      title: 'وایرفریم‌ها و ساختار بصری پنل مدیریت',
      desc: 'طرح‌های سیمی واکنش‌گرا و مشخصات چیدمان فضاهای کاری مدیر.',
    },
  },
  '/ui/manager': {
    ro: {
      title: 'Consola Centralizată Manager OS',
      desc: 'Hub-ul operațional și financiar pentru companii de administrare imobiliară.',
    },
    en: {
      title: 'Manager OS Enterprise Console',
      desc: 'Operational and financial management hub for residential property management firms.',
    },
    fa: {
      title: 'کنسول مدیریت املاک و مجتمع‌ها',
      desc: 'مرکز کنترل عملیاتی و مالی شرکت‌های مدیریت املاک مسکونی.',
    },
  },
  '/prototype': {
    ro: {
      title: 'Parcursuri Prototip Interactive',
      desc: 'Simularea interactivă a fluxurilor cheie operaționale și financiare.',
    },
    en: {
      title: 'Interactive Prototype Journeys',
      desc: 'Interactive step-by-step simulations of critical operational and financial workflows.',
    },
    fa: {
      title: 'مسیرهای تعاملی پروتوتایپ',
      desc: 'شبیه‌سازی گام‌به‌گام و تعاملی گردش‌کارهای کلیدی عملیاتی و مالی.',
    },
  },
  '/user-testing': {
    ro: {
      title: 'Sarcini de Testare & Validare UX',
      desc: 'Scenarii de validare a experienței utilizator pentru rolurile operaționale.',
    },
    en: {
      title: 'User Testing & UX Validation Tasks',
      desc: 'User testing scenarios and validation metrics for key platform roles.',
    },
    fa: {
      title: 'وظایف آزمون کاربر و سنجش تجربه کاربری',
      desc: 'سناریوهای آزمون کاربر و معیارهای سنجش برای نقش‌های کاربری پلتفرم.',
    },
  },
};

/**
 * Returns complete, self-referencing, reciprocal metadata for any given route path and locale
 */
export function getRouteMetadata(routePath: string, lang: Language): Metadata {
  const norm = routePath.startsWith('/') ? routePath : `/${routePath}`;
  const def = ROUTE_METADATA_DEFINITIONS[norm] || ROUTE_METADATA_DEFINITIONS['/'];
  const localized = def[lang] || def.ro;

  return buildPageMetadata({
    lang,
    path: norm === '/' ? '' : norm,
    title: localized.title,
    description: localized.desc,
    noIndex: localized.noIndex || false,
  });
}
