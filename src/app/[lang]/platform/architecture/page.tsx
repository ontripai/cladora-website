import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Building2, 
  Layers, 
  Users, 
  Activity, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2,
  Database,
  Calendar,
  FileText,
  DollarSign,
  MessageSquare,
  Bot,
  Compass,
  KeyRound,
  Lock,
  Workflow,
  Globe,
  GitBranch,
  Split
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
  return getRouteMetadata('/platform/architecture', params.lang);
}

export default async function PlatformArchitecturePage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumb: { home: 'Acasă', platform: 'Platformă', current: 'Arhitectură de Sistem' },
      hero: {
        badge: 'ARHITECTURĂ TEHNICĂ DEEP-DIVE',
        title: 'Arhitectura Decuplată a Platformei CLADORA',
        subtitle:
          'O analiză riguroasă a modelului pe 4 niveluri: entități fizice persistente, granițe de workspace, autoritate pe bază de mandat și furnizori canonici cu responsabilitate unică.',
      },
      physicalModel: {
        badge: 'NIVELUL 01 — MODELUL FIZIC',
        title: 'Topologia Ierarhică a Proprietății',
        desc: 'Arhitectura separă identitatea persistentă a proprietății de schimbările de proprietate, administrare și relații operaționale. Subiectul fizic persistent este structurat pe niveluri ierarhice clare.',
        items: [
          { name: 'Parcelă Cadastrală / Teren', desc: 'Coordonate spațiale, identificator cadastral și graniță juridică persistentă.' },
          { name: 'Corp de Clădire / Structură', desc: 'Fundație, anvelopă termică, acoperiș și spații tehnice comune.' },
          { name: 'Zone & Niveluri Funcționale', desc: 'Etaje, subsoluri tehnice, parcări subterane și galerii de acces.' },
          { name: 'Unități Demarcate', desc: 'Apartamente, birouri, spații comerciale sau hale cu cote-părți statutare.' },
          { name: 'Echipamente & Instalații', desc: 'Ascensoare, pompe, tablouri electrice și contoare cu istoric de revizie.' },
        ],
      },
      workspaceModel: {
        badge: 'NIVELUL 02 — MODELUL DE WORKSPACE',
        title: 'Granițe de Context & Model de Izolare',
        desc: 'Un workspace nu este un simplu cont de utilizator, ci o graniță juridică, operațională și de conformitate. Arhitectura este proiectată pentru a asigura izolarea datelor la nivel de workspace, permițând unei proprietăți fizice să participe în contexte autorizate fără amestec de date.',
        features: [
          { title: 'Model de Izolare la Nivel de Workspace', desc: 'Arhitectură proiectată pentru a delimita datele, configurările și evidențele unui workspace de cele ale altor organizații.' },
          { title: 'Contexte Concomitente', desc: 'O clădire poate fi operată de o asociație pentru cotele comune și de o firmă de management pentru mentenanță fără suprapunere.' },
          { title: 'Separarea Registrelor', desc: 'Nicio tranzacție sau înregistrare contabilă nu este partajată sau amestecată între workspace-uri diferite.' },
        ],
      },
      authorityModel: {
        badge: 'NIVELUL 03 — AUTORITATE & MANDAT',
        title: 'Autoritate Contextuală & Principiul Zero-Write Denial',
        desc: 'Autoritatea este întotdeauna contextuală, derivată din mandat legal, delimitată în spațiu și cu termen de expirare. Când autoritatea nu poate fi stabilită, arhitectura impune refuzul mutației de stare.',
        points: [
          'Un rol fără mandat verificabil nu conferă drepturi de mutație.',
          'Principiul Zero-Write Denial: atunci când autoritatea nu poate fi stabilită, arhitectura impune refuzul oricărei modificări de stare.',
          'La expirarea mandatului, drepturile se transferă controlat către succesor, consemnând predarea în jurnalul de audit.',
        ],
      },
      domainsModel: {
        badge: 'NIVELUL 04 — DOMENII PEER',
        title: 'Compoziția Domeniilor Conectate',
        desc: 'AIRPROP, SERVICE, OPERAȚIUNI și COMUNITATE & EXPERIENȚĂ funcționează ca motoare specializate de flux, având rang arhitectural egal.',
        domains: [
          { name: 'AIRPROP', role: 'Ciclu comercial, pipeline de pre-vânzări, antecontracte și gestiune portofoliu chirii.' },
          { name: 'SERVICE', role: 'Formularea intenției de service, cereri structurate, comparare de oferte și recepție.' },
          { name: 'OPERAȚIUNI', role: 'Management tehnic de facilități, tichete de incident, revizii preventive și comenzi de lucru.' },
          { name: 'COMUNITATE & EXPERIENȚĂ', role: 'Experiența locatarilor, adunări statutare, avizier digital și interacțiuni zilnice.' },
        ],
      },
      canonicalMap: {
        badge: 'BAZĂ CANONICĂ — HARTA FURNIZORILOR',
        title: 'Unicitatea Adevărului Canonic',
        desc: 'Fiecare capabilitate critică este deținută de un singur subsistem specializat. Domeniile de la Nivelul 04 citesc și solicită acțiuni prin interfețe guvernate.',
        providers: [
          { code: 'CORE', name: 'Identitate & Workspace', desc: 'Identitate resurse, roluri, mandate și succesiune.' },
          { code: 'DOCUMENTS', name: 'Arhivă & Seif Tehnic', desc: 'Verificarea integrității documentelor și contractelor.' },
          { code: 'FIN01', name: 'Registru Financiar', desc: 'Partidă dublă, jurnale analitice, reconciliere bancară.' },
          { code: 'BK01', name: 'Capacitate & Timp', desc: 'Disponibilitate spații, programări și rezervări.' },
          { code: 'OPS', name: 'Execuție Mentenanță', desc: 'Comenzi de intervenție și jurnale de echipamente.' },
          { code: 'COMMS', name: 'Comunicații Statutare', desc: 'Canale securizate de notificare și procese-verbale.' },
          { code: 'AUDIT', name: 'Pistă de Audit Aditivă', desc: 'Jurnal cronologic aditiv pentru toate subsistemele.' },
        ],
      },
      dataFlow: {
        badge: 'FLUX DE DATE & EVENIMENTE',
        title: 'Ciclul Tranzacțional Guvernat',
        desc: 'Mutațiile de stare urmează o disciplină strictă: validare de autoritate, execuție idempotentă pe furnizorul canonic, consemnare în jurnalul de audit și propagare asincronă prin Outbox către domeniile interesate.',
      },
      compositionForks: {
        badge: 'COMPOZIȚIE FĂRĂ FORK-URI DE COD',
        title: 'Configurabilitate prin Dimensiuni Compozabile',
        desc: 'CLADORA nu utilizează versiuni separate de cod pentru fiecare industrie. Platforma se adaptează prin parametri compozabili:',
        dimensions: [
          { name: 'Profil de Proprietate', desc: 'Rezidențial, birouri, retail, logistică, mixt, ospitalitate.' },
          { name: 'Model de Operare', desc: 'Autoadministrare, firmă de property management, investitor instituțional.' },
          { name: 'Building DNA', desc: 'Bloc clasic, clădire reabilitată, ansamblu rezidențial, clădire turn.' },
          { name: 'Profil de Servicii', desc: 'Mentenanță tehnică, curățenie, securitate, concierge, administrare.' },
          { name: 'Country Pack', desc: 'Localizare normativă și șabloane documentare specifice pieței locale.' },
        ],
      },
      countryPack: {
        badge: 'ARHITECTURĂ DE LOCALIZARE',
        title: 'Country Pack: România ca Bază de Referință',
        desc: 'România reprezintă primul Country Pack definit pentru platformă, încadrând cerințele normative locale fără a altera nucleul universal: terminologie specifică, structura cotelor statutare, șabloane de procese-verbale și cerințe de arhivare conform legislației aplicabile.',
      },
      aiBoundary: {
        badge: 'GUVERNANȚĂ AI',
        title: 'Delimitarea Asistenței Inteligente',
        desc: 'CLADORA Intelligence este proiectată să opereze strict în limitele autorității și ale furnizorilor canonici. Asistența AI nu poate crea drepturi în mod independent și nu poate ocoli adevărul canonic. Pentru mutații de stare cu impact, modelul de acțiune guvernată impune autoritate validată și aprobare umană explicită în cadrul ciclului în 6 etape (Context → Intent → Authority → Plan → Action → Receipt).',
      },
      principles: {
        badge: 'PRINCIPII STRUCTURALE',
        title: 'Cinci Reguli Inviolabile de Arhitectură',
        list: [
          '1. Unicitatea sursei de adevăr: O capabilitate are un singur deținător canonic.',
          '2. Izolare la nivel de workspace: Arhitectură proiectată pentru delimitarea strictă a datelor între contexte organizaționale.',
          '3. Autoritate derivată din mandat: Rolul fără mandat legal demonstrabil este nul.',
          '4. Persistența activului fizic: Arhitectura separă identitatea persistentă a proprietății de schimbările de proprietate și administrare.',
          '5. Disciplina jurnalului aditiv: Istoricul operațional este consemnat cronologic și verificabil.',
        ],
      },
      cta: {
        title: 'Explorează Ecosistemul de Arhitectură',
        desc: 'Aprofundează continuitatea ciclului de viață sau arhitectura de securitate și încredere.',
        lifecycleLink: 'Ciclul de Viață al Proprietății',
        trustLink: 'Arhitectura de Încredere & Audit',
      },
    },
    en: {
      breadcrumb: { home: 'Home', platform: 'Platform', current: 'System Architecture' },
      hero: {
        badge: 'TECHNICAL ARCHITECTURE DEEP-DIVE',
        title: 'The Decoupled Architecture of CLADORA',
        subtitle:
          'A rigorous examination of the 4-tier operating model: persistent physical entities, workspace boundaries, mandate-based authority, and single-capability canonical providers.',
      },
      physicalModel: {
        badge: 'TIER 01 — PHYSICAL MODEL',
        title: 'Hierarchical Spatial & Asset Topology',
        desc: 'The architecture separates persistent property identity from changes in ownership, management, and operational relationships. The persistent physical subject is organized across clear structural tiers.',
        items: [
          { name: 'Cadastral Plot / Land Parcel', desc: 'Geographic boundary, cadastral identifiers, and persistent legal plot perimeter.' },
          { name: 'Building Shell & Structure', desc: 'Foundations, thermal envelopes, roof structures, and primary physical plant.' },
          { name: 'Functional Zones & Levels', desc: 'Floors, technical basements, underground parking decks, and access galleries.' },
          { name: 'Demised Units & Spaces', desc: 'Apartments, corporate offices, retail bays with statutory ownership quotas.' },
          { name: 'Equipment & Physical Assets', desc: 'Elevators, pumps, HVAC plants, switchboards, and meters with service logs.' },
        ],
      },
      workspaceModel: {
        badge: 'TIER 02 — WORKSPACE MODEL',
        title: 'Contextual Boundaries & Workspace Isolation Model',
        desc: 'A workspace is an operational, legal, and compliance boundary, not merely a software tenant account. The architecture is designed to enforce workspace-scoped data boundaries, enabling a single physical asset to participate in multiple authorized contexts without uncontrolled duplication.',
        features: [
          { title: 'Workspace-Scoped Isolation Model', desc: 'Architecture designed to enforce data boundaries, operational rules, and event trails between distinct organizations.' },
          { title: 'Concurrent Workspaces', desc: 'A building can be managed by an HOA for statutory costs and by a commercial manager for maintenance without operational overlap.' },
          { title: 'Ledger Segregation', desc: 'No financial transaction or accounting ledger is ever blended across separate corporate workspace entities.' },
        ],
      },
      authorityModel: {
        badge: 'TIER 03 — AUTHORITY & MANDATES',
        title: 'Contextual Authority & Zero-Write Denial',
        desc: 'Authority is contextual, derived from verifiable legal mandates, bounded to specific physical spaces, and time-restricted. When authority cannot be established, the architecture requires mutation to be denied.',
        points: [
          'A user role without an active, verified mandate conveys zero state mutation rights.',
          'Zero-Write Denial Principle: when authority cannot be established, the architecture requires mutation to be denied by default.',
          'When a mandate expires, responsibilities transfer cleanly to successors, recorded in the audit journal.',
        ],
      },
      domainsModel: {
        badge: 'TIER 04 — PEER DOMAINS',
        title: 'Connected Operational Domain Composition',
        desc: 'AIRPROP, SERVICE, OPERATIONS, and COMMUNITY & EXPERIENCE operate as specialized workflow engines of equal architectural rank.',
        domains: [
          { name: 'AIRPROP', role: 'Commercial lifecycle, pre-sales pipeline, unit reservations, and lease administration.' },
          { name: 'SERVICE', role: 'Service intent intake, structured scopes of work, competitive quote reviews, and delivery sign-offs.' },
          { name: 'OPERATIONS', role: 'Technical facility management, equipment registries, preventative plans, and work order dispatch.' },
          { name: 'COMMUNITY & EXPERIENCE', role: 'Occupant journeys, statutory general meetings, digital notice boards, and daily living requests.' },
        ],
      },
      canonicalMap: {
        badge: 'CANONICAL BASE — PROVIDER MAP',
        title: 'Single Source of Canonical Truth',
        desc: 'Every critical capability has exactly one authoritative subsystem owner. Tier 04 domains interact with canonical providers through strictly governed contracts.',
        providers: [
          { code: 'CORE', name: 'Identity & Workspaces', desc: 'Resource identifiers, membership, roles, mandates, and succession governance.' },
          { code: 'DOCUMENTS', name: 'Technical Vault & Evidence', desc: 'Authoritative archive for blueprints, contracts, and file integrity verification.' },
          { code: 'FIN01', name: 'Canonical Financial Ledger', desc: 'Analytical double-entry ledgers, banking feeds, and statutory charge allocations.' },
          { code: 'BK01', name: 'Capacity & Scheduling', desc: 'Centralized availability engine for spatial facilities and technician visits.' },
          { code: 'OPS', name: 'Work Order Execution', desc: 'Canonical provider for maintenance dispatches, equipment logs, and SLAs.' },
          { code: 'COMMS', name: 'Statutory Communications', desc: 'Authorized messaging channels, formal notices, and verified ballots.' },
          { code: 'AUDIT', name: 'Append-Only Event Trail', desc: 'Chronological append-only event streams across all operational subsystems.' },
        ],
      },
      dataFlow: {
        badge: 'DATA & EVENT FLOW',
        title: 'Governed Transactional Flow',
        desc: 'State changes execute through an ordered lifecycle: authority verification, idempotent execution on the canonical provider, audit event recording, and asynchronous Outbox event propagation to subscribing domains.',
      },
      compositionForks: {
        badge: 'COMPOSITION WITHOUT CODE FORKS',
        title: 'Configurability Through Composable Dimensions',
        desc: 'CLADORA avoids brittle codebase forks across industry verticals. The platform configures through orthogonal dimensions:',
        dimensions: [
          { name: 'Property Profile', desc: 'Residential, commercial office, retail, logistics, mixed-use, hospitality.' },
          { name: 'Operating Model', desc: 'Self-managed HOA, third-party facility manager, institutional owner-operator.' },
          { name: 'Building DNA', desc: 'Historic masonry block, insulated panel building, high-rise tower, villa compound.' },
          { name: 'Service Profile', desc: 'Technical facilities, security, janitorial, concierge, landscaping.' },
          { name: 'Country Pack', desc: 'Jurisdiction-specific compliance rules, statutory schemas, and tax guidelines.' },
        ],
      },
      countryPack: {
        badge: 'LOCALIZATION ARCHITECTURE',
        title: 'Country Pack: Romania Baseline',
        desc: 'Romania is the first Country Pack defined for the platform, encapsulating national statutory requirements without touching core platform logic: statutory allocation rules, general meeting ballot templates, and retention mandates tailored to Romanian real estate law.',
      },
      aiBoundary: {
        badge: 'GOVERNED AI BOUNDARIES',
        title: 'Governed AI Operational Boundaries',
        desc: 'CLADORA Intelligence is designed to operate within authority and canonical-provider boundaries. AI must not independently create rights or bypass provider truth. For consequential mutations, the governed action model requires validated authority and appropriate human approval across the 6-stage lifecycle (Context → Intent → Authority → Plan → Action → Receipt).',
      },
      principles: {
        badge: 'CORE PRINCIPLES',
        title: 'Five Non-Negotiable System Principles',
        list: [
          '1. Canonical source of truth: exactly one authoritative owner per platform capability.',
          '2. Workspace-scoped isolation: architecture designed to enforce data boundaries between distinct organizational contexts.',
          '3. Mandate-bounded authority: no state mutation rights without verifiable temporal mandates.',
          '4. Persistent physical subject: the architecture separates persistent property identity from ownership and management changes.',
          '5. Append-only event trail: operational history is recorded chronologically and traceably.',
        ],
      },
      cta: {
        title: 'Continue Exploring Platform Architecture',
        desc: 'Review the non-linear property lifecycle model or inspect our trust and governance architecture.',
        lifecycleLink: 'Property Lifecycle Hub',
        trustLink: 'Trust & Governance Architecture',
      },
    },
    fa: {
      breadcrumb: { home: 'صفحه اصلی', platform: 'پلتفرم', current: 'معماری سیستم' },
      hero: {
        badge: 'بررسی تخصصی معماری سیستم',
        title: 'معماری تفکیک‌شدهٔ پلتفرم کلادورا',
        subtitle:
          'تحلیل ساختار چهارلایه پلتفرم: دارایی‌های فیزیکی پایدار، مرزهای مستقل ورک‌اسپیس، اختیارات بر مبنای مجوز قانونی و متولیان اصلی داده‌ها.',
      },
      physicalModel: {
        badge: 'لایهٔ ۰۱ — مدل فیزیکی دارایی',
        title: 'توپولوژی سلسله‌مراتبی فضاها و تجهیزات',
        desc: 'معماری کلادورا هویت پایدار ملک را از تغییرات در مالکیت، مدیریت و روابط عملیاتی تفکیک می‌نماید. موضوع فیزیکی در سطوح مشخص و پایدار ساختاریافته است.',
        items: [
          { name: 'عرصه و پلاک ثبتی ملک', desc: 'محدوده جغرافیایی، پلاک ثبتی و مرز حقوقی پایدار زمین.' },
          { name: 'سازه و اسکلت ساختمان', desc: 'فونداسیون، نما، بام، موتورخانه و تاسیسات مادر ساختمان.' },
          { name: 'طبقات و زون‌های عملکردی', desc: 'طبقات، زیرزمین‌های فنی، پارکینگ‌ها و راهروهای دسترسی.' },
          { name: 'واحدها و فضاهای مستقل', desc: 'واحدهای مسکونی، دفاتر اداری یا مغازه‌ها با سهم مشاع مشخص.' },
          { name: 'دستگاه‌ها و انشعابات', desc: 'آسانسورها، پمپ‌ها، تابلوهای برق و کنتورها با شناسنامه فنی.' },
        ],
      },
      workspaceModel: {
        badge: 'لایهٔ ۰۲ — مدل ورک‌اسپیس',
        title: 'مرزهای زمینه و الگوی تفکیک ورک‌اسپیس',
        desc: 'ورک‌اسپیس یک مرز حقوقی، عملیاتی و امنیتی است؛ نه صرفاً یک حساب کاربری. این معماری برای اعمال مرزهای داده‌ای در سطح هر ورک‌اسپیس طراحی شده و امکان مشارکت ملک فیزیکی در بسترهای مجاز را بدون تداخل داده‌ها فراهم می‌سازد.',
        features: [
          { title: 'الگوی جداسازی در سطح ورک‌اسپیس', desc: 'معماری طراحی‌شده برای اعمال و حفظ مرزهای داده‌ای، قواعد عملیاتی و لاگ‌های رویداد میان سازمان‌های گوناگون.' },
          { title: 'مشارکت هم‌زمان', desc: 'یک مجتمع می‌تواند برای مشاعات در ورک‌اسپیس انجمن و برای نگهداری در ورک‌اسپیس شرکت مدیر حضور یابد.' },
          { title: 'تفکیک دفاتر مالی', desc: 'هیچ تراکنش یا سند حسابی میان اشخاص حقوقی در ورک‌اسپیس‌های گوناگون تداخل پیدا نمی‌کند.' },
        ],
      },
      authorityModel: {
        badge: 'لایهٔ ۰۳ — اختیارات و مجوزها',
        title: 'اختیارات بر مبنای مجوز و اصل Zero-Write Denial',
        desc: 'اختیار اجرایی همواره مبتنی بر مجوز قانونی معتبر، دارای محدوده مشخص مکانی و مقید به بازه زمانی است. هنگامی که اختیار قابل احراز نباشد، معماری سامانه الزام می‌کند که هرگونه درخواست تغییر رد شود.',
        points: [
          'یک نقش بدون مجوز معتبر و زمان‌دار، هیچ‌گونه حق تغییری بر داده‌های سامانه ایجاد نمی‌کند.',
          'اصل عدم تغییر بدون مجوز (Zero-Write Denial): هنگامی که اختیار قانونی احراز نشود، معماری سامانه رد خودکار هرگونه تغییر را الزام می‌نماید.',
          'با پایان دورهٔ مسئولیت، اختیارات به صورت شفاف و مستند به جانشین بعدی منتقل می‌گردد.',
        ],
      },
      domainsModel: {
        badge: 'لایهٔ ۰۴ — دامنه‌های هم‌تراز',
        title: 'ترکیب دامنه‌های متصل عملیاتی',
        desc: 'ایرپراپ، سرویس، عملیات فنی و تعاملات اجتماعی به عنوان موتورهای تخصصی گردش‌کار و در جایگاه هم‌تراز معماری عمل می‌کنند.',
        domains: [
          { name: 'AIRPROP', role: 'معاملات، پیش‌فروش، اجاره و واگذاری مدیریت املاک.' },
          { name: 'SERVICE', role: 'ثبت نیاز خدمات، استعلام قیمت، مقایسه پیشنهادها و تحویل کار.' },
          { name: 'عملیات فنی', role: 'نگهداری تأسیسات، برنامه‌های سرویس دوره‌ای، اعلام خرابی و صدور دستورکار.' },
          { name: 'جامعه و تجربه', role: 'ارتباطات ساکنان، جلسات مجمع عمومی، تابلوی اعلانات و خدمات سکونتی.' },
        ],
      },
      canonicalMap: {
        badge: 'پایهٔ کانونی — ارائه‌دهندگان مرجع داده‌ها',
        title: 'حقیقت واحد و متولیان اصلی داده‌ها',
        desc: 'هر قابلیت اصلی سامانه دارای یک متولی معتبر و منحصربه‌فرد است. دامنه‌های لایهٔ ۴ از طریق رابط‌های استاندارد با این متولیان ارتباط برقرار می‌کنند.',
        providers: [
          { code: 'CORE', name: 'هویت و ورک‌اسپیس', desc: 'شناسه منابع، عضویت، نقش‌ها، مجوزها و تحویل مسئولیت.' },
          { code: 'DOCUMENTS', name: 'بایگانی و مدارک', desc: 'مرجع رسمی نقشه‌ها، قراردادها و اعتبارسنجی فایل‌ها.' },
          { code: 'FIN01', name: 'دفتر مالی و حسابداری', desc: 'حسابداری دوبل، صورت‌حساب بانکی و تسویه‌ها.' },
          { code: 'BK01', name: 'زمان و ظرفیت', desc: 'مدیریت تقویم، نوبت‌دهی و رزرو مشاعات.' },
          { code: 'OPS', name: 'اجرای دستورکارها', desc: 'ارجاع فنی، نظارت بر کار تعمیرکاران و سوابق سرویس.' },
          { code: 'COMMS', name: 'مکاتبات رسمی', desc: 'پیام‌رسانی امن، اعلانات قانونی و صورت‌جلسات.' },
          { code: 'AUDIT', name: 'ثبت رخدادهای ممیزی', desc: 'لاگ ترتیبی و افزایشی کلیه رویدادهای سامانه.' },
        ],
      },
      dataFlow: {
        badge: 'جریان داده و رویدادها',
        title: 'چرخهٔ تراکنش‌های منضبط',
        desc: 'تغییرات سیستمی طبق فرایندی مشخص اعمال می‌شوند: اعتبارسنجی اختیار، اجرای امن در متولی اصلی، ثبت در لاگ ممیزی و اطلاع‌رسانی از طریق الگوی Outbox به دامنه‌های مربوطه.',
      },
      compositionForks: {
        badge: 'پیکربندی بدون انشعاب کد',
        title: 'انعطاف‌پذیری بر پایه ابعاد ترکیب‌پذیر',
        desc: 'کلادورا برای صنایع گوناگون کدهای جداگانه ایجاد نمی‌کند؛ بلکه پلتفرم از طریق ابعاد مستقل تنظیم می‌شود:',
        dimensions: [
          { name: 'نوع کاربری ملک', desc: 'مسکونی، اداری، تجاری، لجستیک، مختلط، اقامتی.' },
          { name: 'مدل بهره‌برداری', desc: 'اداره توسط مالکان، شرکت مدیریت پیمانکاری، مالک سرمایه‌گذار.' },
          { name: 'تیپولوژی سازه (DNA)', desc: 'بلوک‌های شهری، ساختمان‌های نوساز، برج‌های بلندمرتبه، شهرک‌ها.' },
          { name: 'نوع خدمات مورد نیاز', desc: 'تاسیسات فنی، نظافت، حراست، تشریفات، باغبانی.' },
          { name: 'پک کشوری (Country Pack)', desc: 'قوانین ملی، شابلون‌های مصوبات و ضوابط محلی حقوقی.' },
        ],
      },
      countryPack: {
        badge: 'معماری بومی‌سازی',
        title: 'پک کشوری: مدل پایهٔ رومانی',
        desc: 'رومانی نخستین پک کشوری (Country Pack) تعریف‌شده برای پلتفرم است که الزامات قانونی را بدون دستکاری هستهٔ نرم‌افزار پیاده‌سازی می‌کند: فرمول‌های تقسیم سهم شارژ قانونی، شابلون‌های صورت‌جلسات مجمع و الزامات بایگانی مطابق قوانین املاک رومانی.',
      },
      aiBoundary: {
        badge: 'مرزهای عملکردی هوش مصنوعی',
        title: 'مرزهای عملکردی هوش مصنوعی',
        desc: 'هوش مصنوعی کلادورا به‌گونه‌ای طراحی شده است که تنها درون مرزهای اختیارات و متولیان اصلی داده‌ها فعالیت نماید. هوش مصنوعی نمی‌تواند به‌طور مستقل حقی ایجاد کند یا حقیقت داده‌های مرجع را دور بزند. برای هرگونه تغییر بااهمیت، الگوی اقدام تحت‌نظارت مستلزم احراز اختیار و تایید صریح کاربر مجاز در چرخهٔ شش‌مرحله‌ای (زمینه ← قصد ← اختیار ← طرح ← اقدام ← سند ممیزی) است.',
      },
      principles: {
        badge: 'اصول بنیادین',
        title: 'پنج اصل غیرقابل‌تغییر در معماری کلادورا',
        list: [
          '۱. حقیقت واحد داده‌ها: هر بخش اطلاعات تنها یک متولی کانونی در پلتفرم دارد.',
          '۲. جداسازی در سطح ورک‌اسپیس: معماری طراحی‌شده برای اعمال مرزهای داده‌ای میان بسترهای سازمانی.',
          '۳. اختیارات بر مبنای مجوز: نقش فاقد مجوز معتبر هیچ اختیاری ایجاد نمی‌کند.',
          '۴. پایداری هویت ملک: تفکیک هویت پایدار دارایی فیزیکی از جابه‌جایی در مالکیت و مدیریت.',
          '۵. ثبت ترتیبی رویدادها: تاریخچه کلیه عملیات با زمان دقیق ثبت و ممیزی می‌گردد.',
        ],
      },
      cta: {
        title: 'ادامهٔ آشنایی با ارکان پلتفرم',
        desc: 'مدل پیوستگی چرخهٔ عمر دارایی یا اصول امنیت و حاکمیت داده‌ها را مطالعه نمایید.',
        lifecycleLink: 'پیوستگی چرخهٔ عمر ملک',
        trustLink: 'معماری اعتماد و امنیت',
      },
    },
  }[lang] || {
    breadcrumb: { home: 'Home', platform: 'Platform', current: 'Architecture' },
    hero: { badge: '', title: '', subtitle: '' },
    physicalModel: { badge: '', title: '', desc: '', items: [] },
    workspaceModel: { badge: '', title: '', desc: '', features: [] },
    authorityModel: { badge: '', title: '', desc: '', points: [] },
    domainsModel: { badge: '', title: '', desc: '', domains: [] },
    canonicalMap: { badge: '', title: '', desc: '', providers: [] },
    dataFlow: { badge: '', title: '', desc: '' },
    compositionForks: { badge: '', title: '', desc: '', dimensions: [] },
    countryPack: { badge: '', title: '', desc: '' },
    aiBoundary: { badge: '', title: '', desc: '' },
    principles: { badge: '', title: '', list: [] },
    cta: { title: '', desc: '', lifecycleLink: '', trustLink: '' },
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        
        {/* 01 HERO */}
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

        {/* 02 PHYSICAL SUBJECT MODEL */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.physicalModel.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.physicalModel.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.physicalModel.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {content.physicalModel.items.map((it, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0E9F8E] flex items-center justify-center font-bold text-xs">
                  0{idx + 1}
                </div>
                <h3 className="text-sm font-bold text-[#102A43]">{it.name}</h3>
                <p className="text-xs text-[#52667A] leading-relaxed">{it.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 03 WORKSPACE MODEL */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.workspaceModel.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.workspaceModel.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.workspaceModel.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {content.workspaceModel.features.map((feat, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
                <Layers className="w-5 h-5 text-[#0E9F8E]" />
                <h3 className="text-sm font-bold text-[#102A43]">{feat.title}</h3>
                <p className="text-xs text-[#52667A] leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 04 RELATIONSHIP & AUTHORITY MODEL */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.authorityModel.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.authorityModel.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.authorityModel.desc}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {content.authorityModel.points.map((pt, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-[#102A43] leading-relaxed">{pt}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 05 DOMAIN COMPOSITION */}
        <section className="space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.domainsModel.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.domainsModel.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.domainsModel.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {content.domainsModel.domains.map((dom) => (
              <div key={dom.name} className="p-6 bg-white rounded-2xl border border-[#E2E8F0] shadow-card space-y-2">
                <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider block">
                  Peer Domain
                </span>
                <h3 className="text-base font-bold text-[#102A43]">{dom.name}</h3>
                <p className="text-xs text-[#52667A] leading-relaxed">{dom.role}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 06 CANONICAL PROVIDER MAP */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-elevated space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.canonicalMap.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.canonicalMap.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.canonicalMap.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {content.canonicalMap.providers.map((prv) => (
              <div key={prv.code} className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#0E9F8E] px-2 py-0.5 rounded bg-teal-50 border border-teal-200">
                    {prv.code}
                  </span>
                </div>
                <h3 className="text-sm font-bold text-[#102A43]">{prv.name}</h3>
                <p className="text-xs text-[#52667A] leading-relaxed">{prv.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-xs text-[#0A6E62]">
            <strong>Architectural Rule:</strong> FIN01 is NOT inside CORE. BK01 is NOT inside Community &amp; Experience. SERVICE does NOT maintain a parallel financial ledger.
          </div>
        </section>

        {/* 07 DATA & EVENT FLOW */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-4">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
            {content.dataFlow.badge}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
            {content.dataFlow.title}
          </h2>
          <p className="text-sm text-[#52667A] leading-relaxed max-w-3xl">
            {content.dataFlow.desc}
          </p>

          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0]">
              <span className="text-xs font-bold text-[#0E9F8E] block mb-1">01. Request</span>
              <span className="text-xs text-[#102A43]">Authority &amp; Mandate Validation</span>
            </div>
            <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0]">
              <span className="text-xs font-bold text-[#0E9F8E] block mb-1">02. Execution</span>
              <span className="text-xs text-[#102A43]">Single Canonical Provider Mutation</span>
            </div>
            <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0]">
              <span className="text-xs font-bold text-[#0E9F8E] block mb-1">03. Journal</span>
              <span className="text-xs text-[#102A43]">Append-Only Audit Recording</span>
            </div>
            <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0]">
              <span className="text-xs font-bold text-[#0E9F8E] block mb-1">04. Outbox</span>
              <span className="text-xs text-[#102A43]">Governed Event Propagation</span>
            </div>
          </div>
        </section>

        {/* 08 COMPOSITION WITHOUT FORKS */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.compositionForks.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.compositionForks.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.compositionForks.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            {content.compositionForks.dimensions.map((dim, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-1.5">
                <Split className="w-4 h-4 text-[#0E9F8E]" />
                <h3 className="text-sm font-bold text-[#102A43]">{dim.name}</h3>
                <p className="text-xs text-[#52667A] leading-relaxed">{dim.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 09 & 10 COUNTRY PACK & AI BOUNDARY */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl p-8 border border-[#D3DCE6] shadow-card space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E]">
              <Globe className="w-3.5 h-3.5" />
              <span>{content.countryPack.badge}</span>
            </div>
            <h3 className="text-xl font-bold text-[#102A43]">{content.countryPack.title}</h3>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.countryPack.desc}
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-[#D3DCE6] shadow-card space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E]">
              <Bot className="w-3.5 h-3.5" />
              <span>{content.aiBoundary.badge}</span>
            </div>
            <h3 className="text-xl font-bold text-[#102A43]">{content.aiBoundary.title}</h3>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.aiBoundary.desc}
            </p>
          </div>
        </div>

        {/* 11 ARCHITECTURE PRINCIPLES */}
        <section className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 shadow-elevated space-y-6">
          <div className="space-y-2">
            <span className="text-xs font-bold text-teal-300 uppercase tracking-wider">
              {content.principles.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {content.principles.title}
            </h2>
          </div>

          <div className="space-y-3">
            {content.principles.list.map((principle, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs sm:text-sm text-slate-200">
                {principle}
              </div>
            ))}
          </div>
        </section>

        {/* 12 FINAL CTA */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h2 className="text-xl sm:text-2xl font-bold text-[#102A43]">{content.cta.title}</h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">{content.cta.desc}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <Link
              href={`/${lang}/platform/lifecycle`}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#0E9F8E] text-white text-xs font-bold hover:bg-[#0C8778] transition shadow-card flex items-center justify-center gap-2"
            >
              <span>{content.cta.lifecycleLink}</span>
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
