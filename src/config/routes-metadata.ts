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
      title: 'Platforma de Operare pentru Proprietăți & Active Imobiliare',
      desc: 'CLADORA este platforma unificată de operare pentru proprietăți, spații și active fizice. Conectează identitatea unică a activelor, spațiile de lucru autorizate, rolurile și domeniile operaționale pe întregul ciclu de viață.',
    },
    en: {
      title: 'The Operating Platform for the Built World',
      desc: 'CLADORA is the unified operating platform for properties, spaces, and physical assets. One property identity, multiple authorized workspaces, and connected operational domains across the asset lifecycle.',
    },
    fa: {
      title: 'پلتفرم جامع عملیات و مدیریت برای املاک، فضا و دارایی‌ها',
      desc: 'کلادورا پلتفرم یکپارچهٔ عملیات برای املاک و دارایی‌های فیزیکی است. یک هویت پایدار برای ملک، ورک‌اسپیس‌های مجاز سازمانی و دامنه‌های متصل عملیاتی در تمام چرخهٔ عمر دارایی.',
    },
  },
  '/pricing': {
    ro: {
      title: 'Cadru de Parteneriat & Dimensionare Scope | CLADORA',
      desc: 'Model transparent de parteneriat și dimensionare a anvergurii operaționale (scope). Fără costuri ascunse sau pachete rigide — adaptat contextului fiecărui portofoliu.',
    },
    en: {
      title: 'Scope & Partnership Pricing Framework | CLADORA',
      desc: 'Transparent scope-based and partnership engagement model. Tailored to asset typology, enabled capability domains, and regulatory requirements without rigid tiers.',
    },
    fa: {
      title: 'چارچوب همکاری و برآورد نیازمندی‌ها (Scope) | کلادورا',
      desc: 'مدل همکاری اختصاصی و شفاف بر مبنای دامنهٔ عملیاتی و نیازمندی‌های سازمانی، منطبق با نوع دارایی و دامنه‌های عملکردی بدون بسته‌های صلب تجاری.',
    },
  },
  '/pilot': {
    ro: {
      title: 'Program Pilot București-Ilfov',
      desc: 'Solicită evaluarea unui spațiu rezidențial, comercial, industrial, de birouri sau comun pentru programul pilot CLADORA.',
      noIndex: true,
    },
    en: {
      title: 'Bucharest-Ilfov Pilot Cohort',
      desc: 'Request an assessment of residential, commercial, industrial, office or shared spaces for the CLADORA pilot.',
      noIndex: true,
    },
    fa: {
      title: 'برنامه پایلوت بخارست-ایلفوف',
      desc: 'درخواست ارزیابی فضاهای مسکونی، تجاری، صنعتی، اداری یا مشترک برای پایلوت کلادورا.',
      noIndex: true,
    },
  },
  '/platform': {
    ro: {
      title: 'Platforma de Operare — Prezentare Generală & Contexte de Lucru',
      desc: 'Conectează identitatea persistentă a proprietății cu spații de lucru operaționale izolate, relații contextuale și domenii specializate fără fragmentarea sursei unice de adevăr.',
    },
    en: {
      title: 'Platform Overview — One Platform, Many Operational Contexts',
      desc: 'CLADORA connects persistent property identity with isolated operational workspaces, contextual relationships, and specialized domains without fragmenting the underlying source of truth.',
    },
    fa: {
      title: 'نمای کلی پلتفرم — یک پلتفرم جامع، بسترهای عملیاتی گوناگون',
      desc: 'اتصال هویت پایدار ملک با ورک‌اسپیس‌های عملیاتی مجزا، روابط مبتنی بر مجوز و دامنه‌های تخصصی بر بستر حقیقت واحد داده‌ها.',
    },
  },
  '/platform/architecture': {
    ro: {
      title: 'Arhitectura de Sistem — Modelul Decuplat & Furnizorii Canonici',
      desc: 'Modelul decuplat pe 4 niveluri: Proprietate, Workspace, Autoritate și Domenii Conectate, susținut de furnizori canonici de date (CORE, DOCUMENTS, FIN01, BK01, OPERATIONS, COMMUNICATIONS, AUDIT).',
    },
    en: {
      title: 'System Architecture — Decoupled Model & Canonical Providers',
      desc: 'Explore the 4-tier decoupled architecture: Physical Property, Workspace Boundaries, Scoped Authority, and Connected Domains backed by single-capability canonical providers.',
    },
    fa: {
      title: 'معماری سیستم — مدل تفکیک‌شده و متولیان اصلی داده‌ها',
      desc: 'بررسی مدل چهارلایه معماری: دارایی فیزیکی، مرزهای ورک‌اسپیس، اختیارات بر مبنای نقش و دامنه‌های متصل عملیاتی متکی بر ارائه‌دهندگان مرجع داده‌ها.',
    },
  },
  '/platform/lifecycle': {
    ro: {
      title: 'Ciclul de Viață al Proprietății — Continuitate & Proveniență',
      desc: 'Arhitectura CLADORA asigură continuitatea și proveniența trasabilă a evidențelor autorizate pe 10 etape: de la definire și pre-vânzare până la exploatare, mentenanță și succesiune.',
    },
    en: {
      title: 'Property Lifecycle — Continuity & Traceable Provenance',
      desc: 'CLADORA preserves traceable provenance across 10 non-linear lifecycle phases: from project definition and pre-sale through active living, facility maintenance, and accountable succession.',
    },
    fa: {
      title: 'چرخهٔ عمر ملک — پیوستگی و حفظ سوابق در تمام مراحل',
      desc: 'حفظ پیوستگی و اصالت سوابق مجاز در ۱۰ مرحله غیرخطی: از تعریف پروژه و پیش‌فروش تا بهره‌برداری، نگهداری فنی و انتقال مسئولیت به جانشین.',
    },
  },
  '/platform/trust': {
    ro: {
      title: 'Încredere, Securitate & Guvernanță de Sistem',
      desc: 'Arhitectura de încredere CLADORA: delimitare pe workspace, autoritate pe bază de mandat, cerințe AAL2, principiul Zero-Write Denial și jurnale de audit aditive.',
    },
    en: {
      title: 'Trust & Governance Architecture — Boundaries & Integrity',
      desc: 'Explore CLADORA trust architecture: workspace boundaries, mandate-based authority, AAL2-aligned controls, zero-write denial, and auditable event journals.',
    },
    fa: {
      title: 'معماری اعتماد و امنیت — مرزهای داده و یکپارچگی سیستم',
      desc: 'معماری امنیت و حاکمیت داده‌ها در کلادورا: تفکیک ورک‌اسپیس‌ها، اختیارات زمان‌دار، تدابیر هم‌راستا با AAL2، اصل عدم تغییر بدون مجوز و ثبت رویدادهای ممیزی.',
    },
  },
  '/airprop': {
    ro: {
      title: 'AIRPROP — Vânzări, Pre-vânzări, Închirieri & Mandate Imobiliare',
      desc: 'Prezentarea proprietății, gestionarea oportunităților calificate, antecontracte, gestiune chirii și transfer direct către exploatare pe nucleul comun CLADORA.',
    },
    en: {
      title: 'AIRPROP — Real Estate Marketing, Pre-Sales, Leasing & Mandates',
      desc: 'Property showcase, verified inquiries, pre-sales contracts, lease administration, and property management mandates bridging straight into living operations.',
    },
    fa: {
      title: 'AIRPROP — عرضه، پیش‌فروش، معاملات و اجاره ملک',
      desc: 'معرفی و عرضه ملک، متقاضیان و فرصت‌ها، پیش‌فروش، مدیریت روابط موجر و مستأجر، واگذاری مدیریت و اتصال مستقیم فرایند تجاری به تحویل و بهره‌برداری.',
    },
  },
  '/service': {
    ro: {
      title: 'SERVICE — Catalog de Servicii, Ofertare Concurențială & Recepție',
      desc: 'Lansarea cererilor de servicii, compararea devizelor de cost și timp, comenzi de lucru, recepție semnată și înregistrarea permanentă a istoricului pe activ.',
    },
    en: {
      title: 'SERVICE — Service Marketplace, Quote Comparison & Execution',
      desc: 'Structured service requests, side-by-side quote comparison, milestone work orders, verified digital sign-offs, and permanent asset service logs.',
    },
    fa: {
      title: 'SERVICE — کاتالوگ خدمات، استعلام قیمت، سفارش و نظارت',
      desc: 'انتخاب خدمات، ثبت نیاز، دریافت و مقایسه پیشنهادها، توافق بر دامنه و هزینه، پیگیری اجرا، پذیرش نتیجه و ثبت ماندگار در شناسنامه دارایی.',
    },
  },
  '/operations': {
    ro: {
      title: 'Operațiuni & Mentenanță — Echipamente, Revizii & Comenzi de Lucru',
      desc: 'Registru digital de echipamente tehnice, planuri preventive periodice, tichete de avarie, comenzi de lucru dispecerizate și rapoarte de disponibilitate.',
    },
    en: {
      title: 'Operations & Maintenance — Asset Registers, Preventative Plans & Work Orders',
      desc: 'Technical equipment registries, scheduled preventative maintenance plans, fault ticket triage, work order dispatch, and auditable maintenance logbooks.',
    },
    fa: {
      title: 'عملیات فنی و نگهداری دوره‌ای — شناسنامه تجهیزات و دستورکارها',
      desc: 'ثبت و پیگیری تجهیزات فنی، برنامه‌های نگهداری دوره‌ای، اعلام خرابی، صدور دستورکار با تخصیص مسئول و ثبت سوابق سرویس و هزینه‌ها.',
    },
  },
  '/lifecycle': {
    ro: {
      title: 'Ciclul de Viață al Proprietății — De la Pre-vânzare la Succesiune',
      desc: 'Urmărirea neîntreruptă a proprietății prin 6 etape: definire, predare-primire, exploatare activă, mentenanță tehnică, închiriere și predarea responsabilității către succesori.',
    },
    en: {
      title: 'Property Lifecycle — From Pre-Sales to Accountable Succession',
      desc: 'Unbroken operational continuity across 6 stages: project definition, handover, active living, technical maintenance, leasing, and subsequent transfers.',
    },
    fa: {
      title: 'چرخهٔ عمر ملک — از تعریف و پیش‌فروش تا تحویل مسئولیت',
      desc: 'پیوستگی سوابق و خدمات در تمام مراحل زندگی ملک: تعریف و پیش‌فروش، تحویل و راه‌اندازی، بهره‌برداری، نگهداری، اجاره و معاملات بعدی با حفظ امضاهای گذشته.',
    },
  },
  '/modules': {
    ro: {
      title: 'Cele 17 Module Logice ale Platformei',
      desc: 'Prezentarea detaliată a celor 17 nuclee funcționale: de la contabilitate și contoare până la mentenanță și migrare.',
      noIndex: true,
    },
    en: {
      title: 'The 17 Logical Platform Cores',
      desc: 'Detailed walkthrough of the 17 functional cores: from statutory accounting and supplemental ledger to meter OCR and shadow ledger migration.',
      noIndex: true,
    },
    fa: {
      title: 'مشاهده ۱۷ هسته نرم‌افزاری تخصصی',
      desc: 'معرفی جامع ۱۷ ماژول کاربردی کلادورا: از دفاتر قانونی و کنترل‌های تکمیلی تا قرائت تصویری کنتورها و مدیریت تعمیرات.',
      noIndex: true,
    },
  },
  '/building-dna': {
    ro: {
      title: '8 Arhetipuri de Clădiri & Inginerie Rezidențială',
      desc: 'Reguli specifice adaptate tipologiei constructive: blocuri clasice, clădiri reabilitate, complexe noi și vile.',
      noIndex: true,
    },
    en: {
      title: '8 Residential Building Archetypes & Engineering',
      desc: 'Tailored rule engines for distinct structural typologies: pre-1990 blocks, insulated buildings, and new complexes.',
      noIndex: true,
    },
    fa: {
      title: '۸ تیپولوژی ساختمانی و استانداردهای مهندسی',
      desc: 'قواعد محاسباتی و نگهداری منطبق با نوع سازه: بلوک‌های قبل از ۱۹۹۰، ساختمان‌های نوساز، ویلاها و مجتمع‌ها.',
      noIndex: true,
    },
  },
  '/financial-truth': {
    ro: {
      title: 'Claritate Financiară & Evidență Statutară',
      desc: 'Evidență statutară în partidă simplă, control analitic suplimentar în partidă dublă, corecții exclusiv prin stornare documentată și acces direct la documentele sursă.',
      noIndex: true,
    },
    en: {
      title: 'Financial Truth & Statutory Accounting Controls',
      desc: 'Statutory simple-entry registers, supplemental double-entry ledger controls, documented reversals, and direct source invoice links.',
      noIndex: true,
    },
    fa: {
      title: 'شفافیت مالی و کنترل‌های دفاتر قانونی',
      desc: 'دفاتر قانونی یک‌طرفه، کنترل تراز تحلیلی تکمیلی دوطرفه، ثبت اصلاحات صرفاً از طریق سند اصلاحی و پیوند مستقیم به فاکتورهای مرجع.',
      noIndex: true,
    },
  },
  '/meters': {
    ro: {
      title: 'Contorizare, Citire Asistată & Detecție Anomalii',
      desc: 'Colectare flexibilă a indexurilor: foto OCR asistat, QR code și senzori radio cu verificarea consumurilor neobișnuite.',
      noIndex: true,
    },
    en: {
      title: 'Metering, Assisted Photo OCR & Anomaly Detection',
      desc: 'Multi-channel index collection: assisted photo OCR, QR codes, and radio telemetry with anomaly detection.',
      noIndex: true,
    },
    fa: {
      title: 'قرائت هوشمند کنتورها و پایش شبکه مصرف',
      desc: 'ثبت ارقام کنتور با عکس، کدهای QR و رادیو M-Bus همراه با هشدار هوشمند مصرف غیرعادی و نشتی.',
      noIndex: true,
    },
  },
  '/migration': {
    ro: {
      title: 'Migrare controlată din Xisoft, Aviziero, Excel (Shadow Ledger)',
      desc: 'Tranziție asistată fără riscul pierderilor de date din vechiul program. Rulare paralelă timp de 1-2 luni până la reconcilierea completă a soldurilor.',
      noIndex: true,
    },
    en: {
      title: 'Controlled Legacy Migration with Shadow Ledger Protocol',
      desc: 'Structured data transition from legacy software. Run parallel Shadow Ledger billing for 1-2 months until every balance is mathematically matched.',
      noIndex: true,
    },
    fa: {
      title: 'مهاجرت کنترل‌شده سوابق مالی با پروتکل Shadow Ledger',
      desc: 'انتقال ساختاریافته داده‌ها از نرم‌افزارهای قبلی و فایل‌های اکسل. اجرای موازی تا تطبیق کامل مانده‌حساب‌ها.',
      noIndex: true,
    },
  },
  '/security': {
    ro: {
      title: 'Securitate, Permisiuni RBAC & Conformitate GDPR',
      desc: 'Arhitectură de securitate cu separarea drepturilor pe roluri, jurnale de audit și protecția datelor conform GDPR.',
      noIndex: true,
    },
    en: {
      title: 'Enterprise Security, RBAC & GDPR Compliance',
      desc: 'Role-based access controls, comprehensive audit trail logging, and enterprise GDPR privacy standards.',
      noIndex: true,
    },
    fa: {
      title: 'امنیت سازمانی، سطوح دسترسی RBAC و انطباق با GDPR',
      desc: 'معماری امنیت چندلایه با تفکیک نقش‌ها، ثبت تاریخچه حسابرسی و حفاظت کامل از اطلاعات هویتی و مالی.',
      noIndex: true,
    },
  },
  '/trust': {
    ro: {
      title: 'Încredere, Transparență & Standarde de Audit',
      desc: 'Garanția transparenței operaționale și financiare pentru asociații de proprietari, chiriași și administratori.',
      noIndex: true,
    },
    en: {
      title: 'Trust, Transparency & Audit Standards',
      desc: 'Operational and financial transparency principles for homeowner associations, tenants, and property managers.',
      noIndex: true,
    },
    fa: {
      title: 'اعتماد، شفافیت و استانداردهای ممیزی',
      desc: 'اصول شفافیت مالی و انضباط ساختاری برای انجمن‌های مالکان، مستأجران و مدیران ساختمان.',
      noIndex: true,
    },
  },
  '/association': {
    ro: {
      title: 'Cladora Association (Association OS)',
      desc: 'Sistem de operare dedicat asociațiilor de proprietari: liste de întreținere, Legea 196/2018 și contabilitate clară.',
      noIndex: true,
    },
    en: {
      title: 'Cladora Association (Association OS)',
      desc: 'Dedicated operating system for homeowner associations: statutory allocation, billing, and clear general ledger.',
      noIndex: true,
    },
    fa: {
      title: 'کلادورا انجمن (Association OS)',
      desc: 'سیستم‌عامل تخصصی انجمن‌های مالکان و مدیران ساختمان: تسهیم سهم شارژ، انطباق قانونی و بستن دوره‌ها.',
      noIndex: true,
    },
  },
  '/portfolio': {
    ro: {
      title: 'Cladora Portfolio (Landlord & Portfolio OS)',
      desc: 'Sistem de operare pentru investitori și proprietari: monitorizarea chiriilor, randament net și reconciliere garanții.',
      noIndex: true,
    },
    en: {
      title: 'Cladora Portfolio (Landlord & Portfolio OS)',
      desc: 'Operating system for rental property owners: rent collection tracking, net yields, and security deposits.',
      noIndex: true,
    },
    fa: {
      title: 'کلادورا پورتفولیو (Portfolio OS)',
      desc: 'سیستم‌عامل اختصاصی مالکان چند واحد و سرمایه‌گذاران املاک: ردیابی اجاره‌ها، بازده خالص و حساب امانی ودیعه.',
      noIndex: true,
    },
  },
  '/manager': {
    ro: {
      title: 'Cladora Manager (Management Company OS)',
      desc: 'Consolă centralizată pentru firme de administrare: închidere de lună în masă, dispecerat tichete și monitorizare SLA.',
      noIndex: true,
    },
    en: {
      title: 'Cladora Manager (Management Company OS)',
      desc: 'Multi-association enterprise console: batch month-close, maintenance dispatch, and vendor SLA tracking.',
      noIndex: true,
    },
    fa: {
      title: 'کلادورا منیجر (Manager OS)',
      desc: 'کنسول متمرکز شرکت‌های مدیریت املاک: بستن دوره‌های چند مجتمع، ارجاع تیکت‌های فنی و کنترل قراردادها.',
      noIndex: true,
    },
  },
  '/solutions': {
    ro: {
      title: 'Soluții pe Contexte de Actori & Relații Imobiliare | CLADORA',
      desc: 'O singură arhitectură de platformă pentru dezvoltatori, proprietari, asociații, administratori, rezidenți și prestatori de servicii, compusă pe baza relației și autorității.',
    },
    en: {
      title: 'Solutions by Participant Context & Property Relationship | CLADORA',
      desc: 'One platform architecture serving developers, property owners, associations, managers, residents, and service providers based on role, relationship, and scoped authority.',
    },
    fa: {
      title: 'راهکارهای پلتفرم بر اساس جایگاه مخاطب و رابطه با ملک | کلادورا',
      desc: 'یک معماری واحد برای سازندگان، مالکان، انجمن‌ها، مدیران، ساکنان و ارائه‌دهندگان خدمات بر بستر روابط حقوقی و اختیارات تفویض‌شده.',
    },
  },
  '/solutions/developers': {
    ro: {
      title: 'Dezvoltatori & Predare Imobile — Arhitectura de Platformă | CLADORA',
      desc: 'Structurarea identității imobilului din faza de proiect, pregătire comercială în AIRPROP, organizarea documentației în DOCUMENTS și sprijin pentru tranziția operațională post-predare.',
    },
    en: {
      title: 'Property Development & Handover Platform Architecture | CLADORA',
      desc: 'Establish digital asset identity early, support commercial preparation in AIRPROP, organize document records in DOCUMENTS, and support post-handover operational transition.',
    },
    fa: {
      title: 'معماری پلتفرم برای سازندگان و تحویل املاک | کلادورا',
      desc: 'ثبت هویت دیجیتال ملک از فاز اولیه، تمهیدات تجاری در AIRPROP، سازماندهی اسناد در DOCUMENTS و تسهیل انتقال به مرحله بهره‌برداری پس از تحویل.',
    },
  },
  '/solutions/property-owners': {
    ro: {
      title: 'Proprietari & Portofolii — Platforma de Operare a Activelor | CLADORA',
      desc: 'Vizibilitate consolidată asupra activelor, contractelor de închiriere și cheltuielilor operaționale, fără fragmentarea sursei unice de adevăr financiar din FIN01.',
    },
    en: {
      title: 'Property Owner & Portfolio Operating Platform | CLADORA',
      desc: 'Consolidated visibility across owned assets, leases, and operational expenses, anchored directly to single-capability financial truth in FIN01.',
    },
    fa: {
      title: 'پلتفرم عملیات برای مالکان و سبد دارایی‌های ملکی | کلادورا',
      desc: 'پایش متمرکز بر املاک ملکی، قراردادهای اجاره و هزینه‌های عملیاتی با اتکا به مرجع حقیقت مالی FIN01 بدون ایجاد پایگاه‌های داده موازی.',
    },
  },
  '/solutions/associations': {
    ro: {
      title: 'Asociații de Proprietari — Platforma de Guvernanță Rezidențială | CLADORA',
      desc: 'Concepută pentru a susține fluxurile asociațiilor de proprietari în cadrul Legii 196/2018: evidența cotelor, canale oficiale de comunicare și evidențe decizionale.',
    },
    en: {
      title: 'Residential Association & HOA Platform Architecture | CLADORA',
      desc: 'Designed to support residential association workflows within the framework of Romanian Law 196/2018: expense records, official communication channels, and governance records.',
    },
    fa: {
      title: 'معماری پلتفرم برای انجمن‌های مالکان و مجتمع‌های مسکونی | کلادورا',
      desc: 'طراحی‌شده برای تسهیل فرآیندهای مجتمع‌های مسکونی منطبق با چارچوب‌های قانونی: شفافیت هزینه‌ها، کانال‌های رسمی اطلاع‌رسانی و ثبت تصمیمات مجامع.',
    },
  },
  '/solutions/property-managers': {
    ro: {
      title: 'Companii de Administrare — Platforma Operațională Multi-Imobil | CLADORA',
      desc: 'Consolă de operare pentru portofolii multi-proprietate: coordonarea echipelor, evidența solicitărilor de mentenanță, vizibilitate financiară și relația cu ocupanții.',
    },
    en: {
      title: 'Property Management Operating Platform | CLADORA',
      desc: 'Operating console for multi-property portfolios: team delegation, maintenance request oversight, financial visibility, and occupant relationship coordination.',
    },
    fa: {
      title: 'پلتفرم عملیاتی شرکت‌های مدیریت و نگهداری املاک | کلادورا',
      desc: 'کنسول عملیاتی برای مدیریت چندین مجتمع: تفویض اختیارات به تیم، پیگیری درخواست‌های تعمیرات، شفافیت مالی و مدیریت تعاملات با بهره‌برداران.',
    },
  },
  '/solutions/residents': {
    ro: {
      title: 'Rezidenți & Ocupanți — Experiența Imobiliară Conectată | CLADORA',
      desc: 'Vizibilitate autorizată asupra cotelor de întreținere, transmiterea indexurilor, semnalarea cererilor de mentenanță și comunicare oficială cu administrația.',
    },
    en: {
      title: 'Resident & Occupant Property Experience Architecture | CLADORA',
      desc: 'Authorized visibility into maintenance charges, meter index submissions, maintenance requests, and official community communications.',
    },
    fa: {
      title: 'معماری تجربه سکونت برای ساکنان و بهره‌برداران املاک | کلادورا',
      desc: 'مشاهده مجاز فیش شارژ ماهانه، ثبت ارقام کنتورها، اعلام درخواست‌های تعمیرات و دریافت اطلاعیه‌های رسمی ساختمان.',
    },
  },
  '/solutions/service-providers': {
    ro: {
      title: 'Furnizori de Servicii & Echipe Tehnice — Coordonare Lucrări | CLADORA',
      desc: 'Coordonarea intervențiilor tehnice: comenzi de lucru autorizate prin OPERATIONS, estimări structurate în SERVICE, dovezi de recepție și evidență ordonată.',
    },
    en: {
      title: 'Property Service Provider Coordination Platform | CLADORA',
      desc: 'Coordinate maintenance delivery: verified work orders via OPERATIONS, structured scope in SERVICE, acceptance evidence in DOCUMENTS, and auditable records.',
    },
    fa: {
      title: 'پلتفرم هماهنگی ارائه‌دهندگان خدمات و تیم‌های فنی | کلادورا',
      desc: 'هماهنگی دستورکارهای فنی از طریق OPERATIONS، برآورد ساختاریافته در SERVICE، مستندات تحویل کار و ثبت منظم سوابق.',
    },
  },
  '/solutions/tenants': {
    ro: {
      title: 'Soluții pentru Chiriași Rezidențiali (Consolidat în Rezidenți)',
      desc: 'Fluxurile pentru chiriași sunt integrate canonic în Soluția pentru Rezidenți & Ocupanți.',
      noIndex: true,
    },
    en: {
      title: 'Residential Tenant Solutions (Consolidated into Residents)',
      desc: 'Tenant workflows are canonically consolidated into the Resident & Occupant Solution.',
      noIndex: true,
    },
    fa: {
      title: 'راهکارهای مستأجران واحدهای مسکونی (تجمیع در ساکنان)',
      desc: 'جریان‌های کاری مستأجران به صورت یکپارچه در راهکار ساکنان و بهره‌برداران تجمیع شده است.',
      noIndex: true,
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
  '/ai': {
    ro: {
      title: 'CLADORA Intelligence — Arhitectura de Inteligență Guvernată',
      desc: 'Descoperă CLADORA Intelligence: orchestrare asistivă ghidată de context, autoritate din CORE, control de politici și rutare către furnizorii canonici de adevăr.',
      noIndex: false,
    },
    en: {
      title: 'CLADORA Intelligence — Governed AI Architecture for Property Operations',
      desc: 'Explore CLADORA Intelligence: context-aware assistive orchestration grounded in CORE authority, policy controls, and routing to canonical platform providers.',
      noIndex: false,
    },
    fa: {
      title: 'هوش عملیاتی کلادورا — معماری هوشمندی مقید به حاکمیت برای املاک',
      desc: 'بررسی جامع CLADORA Intelligence: ارکستراسیون کمکی با درک بافت، اختیارات مبتنی بر CORE، انطباق با خط‌مشی‌ها و ارجاع به متولیان مرجع پلتفرم.',
      noIndex: false,
    },
  },
  '/industries': {
    ro: {
      title: 'Arhitectura Industriilor — O Singură Arhitectură, Contexte Multiple',
      desc: 'Descoperă modul în care CLADORA compune aceeași arhitectură de platformă pentru 8 contexte imobiliare: rezidențial, birouri, retail, ospitalitate, industrial, logistică, auto și mixte.',
    },
    en: {
      title: 'Industries Architecture — One Platform Architecture, Multiple Property Contexts',
      desc: 'Explore how CLADORA composes the same platform architecture across 8 built-world property contexts: residential, workplace, retail, hospitality, industrial, logistics, automotive, and mixed-use.',
    },
    fa: {
      title: 'معماری صنایع — یک معماری واحد، بسترهای گوناگون املاک',
      desc: 'بررسی چگونگی انطباق معماری یکپارچه کلادورا بر ۸ بستر ساختمانی: مسکونی، اداری، تجاری، اقامتی، صنعتی، لجستیک، خودرویی و چندمنظوره.',
    },
  },
  '/capabilities': {
    ro: {
      title: 'Arhitectura Capabilităților — Domenii Conectate & Adevăr Canonic',
      desc: 'Descoperă arhitectura de capabilități CLADORA: fundație CORE, identitate persistentă de activ, AIRPROP, SERVICE, Operațiuni, C&E și furnizori canonici (FIN01, DOCUMENTS, BK01).',
    },
    en: {
      title: 'Capabilities Architecture — Connected Domains & Canonical Truth',
      desc: 'Explore CLADORA\'s enterprise capability architecture: CORE foundation, persistent asset identity, AIRPROP, SERVICE, Operations, Community, and canonical providers (FIN01, DOCUMENTS, BK01).',
    },
    fa: {
      title: 'معماری قابلیت‌ها — دامنه‌های متصل و متولیان اصلی داده‌ها',
      desc: 'بررسی جامع معماری قابلیت‌های کلادورا: زیرساخت CORE، هویت پایدار ملک، ایرپراپ، سرویس، عملیات فنی، تعاملات اجتماعی و ارائه‌دهندگان مرجع داده‌ها (FIN01، اسناد و BK01).',
    },
  },
  '/community-experience': {
    ro: {
      title: 'Comunitate & Experiență — Arhitectura Experienței în Context Imobiliar',
      desc: 'Descoperă arhitectura domeniului Comunitate & Experiență (C&E): compoziția interacțiunilor, ghiduri de spațiu, evenimente și călătorii contextuale conectate la adevărul canonic.',
      noIndex: false,
    },
    en: {
      title: 'Community & Experience — Experience Connected to the Property Context',
      desc: 'Explore CLADORA’s Community & Experience (C&E) domain architecture: experience composition, place guides, community context, and journeys anchored in canonical operational truth.',
      noIndex: false,
    },
    fa: {
      title: 'جامعه و تجربه کاربری — معماری تجربه متصل به بستر ملک',
      desc: 'بررسی معماری دامنهٔ جامعه و تجربه کاربری (C&E): ترکیب تعاملات، راهنمای اماکن، بستر مشارکتی و جریان‌های تعاملی متکی بر ارائه‌دهندگان مرجع داده‌ها.',
      noIndex: false,
    },
  },
  '/resources': {
    ro: {
      title: 'Resurse, Ghiduri & Documentație',
      desc: 'Documentație, ghiduri de migrare, întrebări frecvente și resurse de securitate și conformitate.',
      noIndex: true,
    },
    en: {
      title: 'Resources, Guides & Documentation',
      desc: 'Documentation, migration playbooks, answers to common questions, and trust & compliance resources.',
      noIndex: true,
    },
    fa: {
      title: 'منابع، راهنماها و مستندات',
      desc: 'مستندات، راهنماهای مهاجرت، پرسش‌های متداول و منابع اعتماد، امنیت و انطباق قانونی.',
      noIndex: true,
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
