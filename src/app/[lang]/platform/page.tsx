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
  Workflow
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
  return getRouteMetadata('/platform', params.lang);
}

export default async function PlatformPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumb: { home: 'Acasă', current: 'Platformă & Arhitectură' },
      hero: {
        badge: 'ARHITECTURA DE SISTEM CLADORA',
        titleLine1: 'O Singură Platformă.',
        titleLine2: 'Contexte Multiple de Operare.',
        subtitle:
          'CLADORA conectează identitatea persistentă a proprietății fizice cu spații de lucru operaționale delimitate, relații contextuale și domenii specializate, fără a fragmenta vreodată sursa unică de adevăr.',
        ctaPrimary: 'Explorează Arhitectura Detaliată',
        ctaSecondary: 'Solicită Parteneriat',
      },
      diagram: {
        badge: 'MODELUL PE 4 NIVELURI & FURNIZORII CANONICI',
        title: 'Cum este structurat sistemul CLADORA',
        subtitle: 'Decuplarea strictă între lumea fizică, granițele organizaționale, autoritatea pe bază de mandat și fluxurile de execuție.',
        levels: [
          {
            tier: 'NIVELUL 01',
            name: 'LUMEA FIZICĂ (PROPRIETATE / ACTIV)',
            desc: 'Teren, clădire, unitate, spațiu comun, contor sau echipament tehnic. Subiectul persistent care dăinuie zeci de ani.',
            badge: 'Subiect Persistent',
          },
          {
            tier: 'NIVELUL 02',
            name: 'STRATUL DE CONTEXT (WORKSPACE)',
            desc: 'Organizații, firme de administrare, asociații și echipe de proiect care operează în granițe logice delimitate.',
            badge: 'Graniță Operațională',
          },
          {
            tier: 'NIVELUL 03',
            name: 'STRATUL DE AUTORITATE (OAMENI & RELAȚII)',
            desc: 'Mandate legale cu termen definit, roluri de securitate și succesiune transparentă a responsabilităților.',
            badge: 'Mandat & Autoritate',
          },
          {
            tier: 'NIVELUL 04',
            name: 'DOMENII CONECTATE (DOMENII PEER)',
            desc: 'AIRPROP (comercial), SERVICE (furnizori), OPERAȚIUNI (mentenanță) și COMUNITATE & EXPERIENȚĂ (rezidenți și viață zilnică).',
            badge: 'Execuție de Flux',
          },
          {
            tier: 'BAZĂ CANONICĂ',
            name: 'FURNIZORI CANONICI DE SERVICII',
            desc: 'CORE (Identitate/Workspace) • DOCUMENTS/VAULT • FIN01 (Registru Financiar) • BK01 (Capacitate/Timp) • COMUNICAȚII • AUDIT.',
            badge: 'Adevăr Canonic Unic',
          },
        ],
      },
      assetSection: {
        badge: 'IDENTITATE PERSISTENTĂ',
        title: 'Proprietatea ca subiect central persistent',
        lead: 'Oamenii, administratorii și firmele de servicii se succed în timp. Proprietatea fizică rămâne.',
        desc: 'În arhitectura CLADORA, imobilul fizic este subiectul central al evidențelor. Schimbarea administrației, rotația locatarilor sau re-vânzarea nu șterg cartea tehnică, istoricul contoarelor sau jurnalul de mentenanță.',
        points: [
          'Identificatori unici ierarhici: parcelă, corp de clădire, unități, spații tehnice.',
          'Cartea tehnică a construcției și istoricul reviziilor rămân legate de activ.',
          'Consumurile și indexurile istorice nu sunt pierdute la schimbarea chiriașului.',
        ],
      },
      workspaceSection: {
        badge: 'DELIMITARE OPERAȚIONALĂ',
        title: 'Workspace: Contextul de lucru, nu doar un cont de utilizator',
        lead: 'O proprietate fizică poate participa în multiple contexte de lucru fără dublarea evidențelor.',
        desc: 'Workspace-ul reprezintă granița operațională și de conformitate: o asociație de proprietari, o companie de property management, un dezvoltator sau un fond de investiții. Fiecare workspace își gestionează propriile setări și jurnale de audit, fără acces neautorizat în alte contexte.',
        points: [
          'Delimitare logică strictă a datelor și conformitate GDPR per workspace.',
          'O proprietate poate fi gestionată de un administrator printr-un workspace dedicat.',
          'Zero amestec de tranzacții financiare între organizații diferite.',
        ],
      },
      peopleSection: {
        badge: 'AUTORITATE CONTEXTUALĂ',
        title: 'Oameni, roluri și mandate delimitate în timp',
        lead: 'Un rol singur nu conferă autoritate universală. Autoritatea derivă din mandat și context.',
        desc: 'Spre deosebire de sistemele vechi cu permisiuni globale opace, CLADORA leagă fiecare acțiune de un mandat validat legal, cu sferă de competență și termen definit (dezvoltator, proprietar, chiriaș, manager, tehnician, furnizor).',
        points: [
          'Mandate cu termen de valabilitate și atribuire explicită pe spații.',
          'Principiul Zero-Write Denial: nicio modificare fără autoritate demonstrabilă.',
          'Tranziție transparentă a atribuțiilor către noul mandatar la expirarea mandatului.',
        ],
      },
      domainsSection: {
        badge: 'PATRU DOMENII PEER',
        title: 'Domenii conectate pe o singură sursă de adevăr',
        subtitle: 'Cele patru domenii sunt egale în rang arhitectural. Niciun domeniu nu devine subordonat altuia.',
        domains: [
          {
            name: 'AIRPROP',
            role: 'Ciclul Comercial & Pre-vânzări',
            desc: 'Conectează conceptele ciclului de viață comercial din faza de proiect, oportunități calificate, antecontracte și gestiune a închirierilor către predare.',
            tag: 'Peer Domain',
          },
          {
            name: 'SERVICE',
            role: 'Intenție, Cereri & Coordonare Furnizori',
            desc: 'Guvernează cererile structurate de servicii, compararea devizelor concurențiale, comenzile de lucru și coordonarea recepției tehnice.',
            tag: 'Peer Domain',
          },
          {
            name: 'OPERAȚIUNI',
            role: 'Mentenanță & Comenzi de Lucru',
            desc: 'Registru digital de echipamente tehnice, planuri de revizie periodică, dispecerat de tichete și execuția comenzilor de intervenție.',
            tag: 'Peer Domain',
          },
          {
            name: 'COMUNITATE & EXPERIENȚĂ',
            role: 'Viață Zilnică, Ghiduri & Interacțiuni',
            desc: 'Compoziția experienței locatarilor, informări statutare, adunări generale, acces la facilități și asistență zilnică.',
            tag: 'Peer Domain',
          },
        ],
      },
      providersSection: {
        badge: 'DISCIPLINA ADEVĂRULUI CANONIC',
        title: 'O singură capabilitate. Un singur deținător canonic de adevăr.',
        subtitle:
          'Eliminarea conflictelor de date și a silozurilor paralele prin atribuirea fiecărei responsabilități unui singur subsistem canonic.',
        providers: [
          {
            name: 'CORE',
            scope: 'Workspace / Identitate / Relații / Autoritate',
            desc: 'Gestionează identitatea resurselor, membrii, rolurile, succesiunea mandatelor și guvernanța migrării. Nu deține registru financiar.',
          },
          {
            name: 'DOCUMENTS / VAULT',
            scope: 'Arhivă Tehnică & Evidențe de Conformitate',
            desc: 'Sursa unică de adevăr pentru fișiere, planuri tehnice, contracte, devize și verificarea integrității conținutului.',
          },
          {
            name: 'FIN01',
            scope: 'Registru Financiar Canonic & Plăți',
            desc: 'Subistemul canonic de contabilitate, registre analitice duble, alocări pe cote și reconciliere bancară. Separat de CORE și SERVICE.',
          },
          {
            name: 'BK01',
            scope: 'Motor Centralizat de Timp & Capacitate',
            desc: 'Sursa unică de adevăr pentru disponibilitatea spațiilor, programări tehnice și facilități comune. Separat de Comunitate.',
          },
          {
            name: 'OPERAȚIUNI',
            scope: 'Execuția Comenzilor de Lucru & Echipamente',
            desc: 'Furnizorul canonic pentru intervenții la fața locului, istoricul reparațiilor și catalogul de active tehnice.',
          },
          {
            name: 'COMUNICAȚII & AUDIT',
            scope: 'Mesagerie Oficială & Jurnal de Evenimente',
            desc: 'Canale securizate de mesagerie statutară, notificări oficiale și jurnal de evenimente aditiv cu timestamp.',
          },
        ],
      },
      lifecycleBanner: {
        title: 'Continuitate de la Pre-vânzare la Succesiune',
        desc: 'Proprietatea trece prin etape diferite fără pierderea provenienței. Documentele, indexurile și deciziile anterioare rămân legate de activ.',
        cta: 'Vezi Arhitectura Ciclului de Viață',
      },
      trustBanner: {
        title: 'Încredere, Securitate & Guvernanță',
        desc: 'Delimitare strictă la nivel de workspace, cerințe de securitate AAL2, principiul Zero-Write Denial și rezidență europeană a datelor.',
        cta: 'Consultă Arhitectura de Încredere',
      },
      aiSection: {
        badge: 'INTELIGENȚĂ GUVERNATĂ',
        title: 'CLADORA Intelligence: Subordonată autorității umane',
        desc: 'Modelul de asistență inteligentă operează în 6 etape (Context → Intent → Authority → Plan → Action → Receipt). Inteligența artificială nu modifică niciodată registrele canonice în mod autonom.',
      },
      finalCta: {
        title: 'Construit pentru standardele lumii fizice.',
        subtitle: 'Explorează documentația tehnică a arhitecturii sau contactează echipa CLADORA pentru un parteneriat pilot.',
        primary: 'Arhitectura de Sistem Detaliată',
        secondary: 'Solicită Parteneriat',
      },
    },
    en: {
      breadcrumb: { home: 'Home', current: 'Platform & Architecture' },
      hero: {
        badge: 'CLADORA SYSTEM ARCHITECTURE',
        titleLine1: 'One Platform.',
        titleLine2: 'Many Operational Contexts.',
        subtitle:
          'CLADORA connects persistent property identity with isolated operational workspaces, contextual relationships, and specialized domains without fragmenting the underlying source of truth.',
        ctaPrimary: 'Explore Deep Architecture',
        ctaSecondary: 'Start Partnership',
      },
      diagram: {
        badge: '4-TIER MODEL & CANONICAL PROVIDERS',
        title: 'How the CLADORA system is structured',
        subtitle: 'Strict decoupling between physical entities, operational workspace boundaries, mandate-based authority, and execution workflows.',
        levels: [
          {
            tier: 'TIER 01',
            name: 'PHYSICAL WORLD (PROPERTY / ASSET)',
            desc: 'Land parcel, building, individual unit, common space, utility meter, or physical plant. The persistent physical subject across decades.',
            badge: 'Persistent Subject',
          },
          {
            tier: 'TIER 02',
            name: 'CONTEXT LAYER (WORKSPACE)',
            desc: 'Companies, management firms, HOAs, and project teams operating within strictly segregated operational boundaries.',
            badge: 'Operational Boundary',
          },
          {
            tier: 'TIER 03',
            name: 'AUTHORITY LAYER (PEOPLE & RELATIONSHIPS)',
            desc: 'Time-bounded legal mandates, security roles, and transparent succession protocols.',
            badge: 'Mandate & Authority',
          },
          {
            tier: 'TIER 04',
            name: 'CONNECTED DOMAINS (PEER ENGINES)',
            desc: 'AIRPROP (commercial), SERVICE (procurement), OPERATIONS (facility maintenance), and COMMUNITY & EXPERIENCE (living & interactions).',
            badge: 'Workflow Execution',
          },
          {
            tier: 'CANONICAL BASE',
            name: 'CANONICAL SHARED PROVIDERS',
            desc: 'CORE (Identity/Workspace) • DOCUMENTS/VAULT • FIN01 (Financial Ledger) • BK01 (Capacity/Time) • COMMUNICATIONS • AUDIT.',
            badge: 'Single Canonical Truth',
          },
        ],
      },
      assetSection: {
        badge: 'PERSISTENT IDENTITY',
        title: 'The property as the central persistent subject',
        lead: 'Stakeholders, managers, and service providers change over time. Physical property endures.',
        desc: 'In CLADORA, the physical asset is the central anchor of all records. Administrative turnovers, tenant moves, or ownership transfers never erase the asset history, meter logs, or technical maintenance archives.',
        points: [
          'Hierarchical persistent identifiers: parcel, building structure, units, technical zones.',
          'Technical building logbook and equipment warranties remain tied to the asset ID.',
          'Historical utility readings and consumption baselines are preserved across tenancies.',
        ],
      },
      workspaceSection: {
        badge: 'OPERATIONAL BOUNDARIES',
        title: 'Workspace: Contextual boundaries, not just a user account',
        lead: 'One physical property can participate in multiple authorized workspaces without duplicating physical records.',
        desc: 'A Workspace represents an operational and compliance boundary: a homeowners association, a property management company, a developer project, or a real estate portfolio. Each workspace controls its own parameters and audit journals without cross-tenant exposure.',
        points: [
          'Strict workspace-scoped data boundaries and GDPR purpose minimization.',
          'A single physical building can be managed by an authorized operator within a dedicated workspace.',
          'Zero financial ledger blending across separate commercial entities.',
        ],
      },
      peopleSection: {
        badge: 'CONTEXTUAL AUTHORITY',
        title: 'People, roles, and time-bounded mandates',
        lead: 'A role alone does not confer universal authority. Authority depends on mandate, context, and time.',
        desc: 'Unlike legacy property tools with opaque global admin accounts, CLADORA binds every consequential action to an explicitly verified mandate with a defined scope and timeframe (builder, owner, tenant, manager, technician, service contractor).',
        points: [
          'Time-bounded mandates with explicit spatial and operational scope.',
          'Zero-Write Denial Principle: no state mutation without verifiable authority.',
          'Accountable succession protocol transitioning mandates cleanly upon term expiration.',
        ],
      },
      domainsSection: {
        badge: 'FOUR PEER DOMAINS',
        title: 'Connected operational domains on a shared truth',
        subtitle: 'All four domains are architectural peers. No domain is visually or logically subordinate to another.',
        domains: [
          {
            name: 'AIRPROP',
            role: 'Commercial Lifecycle & Pre-Sales',
            desc: 'Connects commercial property lifecycle concepts from pre-sale and transaction contexts toward handover, leads, and tenancy agreements.',
            tag: 'Peer Domain',
          },
          {
            name: 'SERVICE',
            role: 'Service Intent, Requests & Delivery',
            desc: 'Governs service intent, structured briefs, quote comparisons, agreed work scopes, and milestone delivery coordination.',
            tag: 'Peer Domain',
          },
          {
            name: 'OPERATIONS',
            role: 'Facility Maintenance & Work Orders',
            desc: 'Technical equipment registries, scheduled preventative maintenance plans, fault ticket triage, and on-site work order dispatch.',
            tag: 'Peer Domain',
          },
          {
            name: 'COMMUNITY & EXPERIENCE',
            role: 'Daily Living, Guides & Community',
            desc: 'Tenant and resident experience composition, statutory notice boards, general meeting ballots, and daily living requests.',
            tag: 'Peer Domain',
          },
        ],
      },
      providersSection: {
        badge: 'CANONICAL TRUTH DISCIPLINE',
        title: 'One capability. One canonical provider of truth.',
        subtitle:
          'Eliminating conflicting records and parallel silos by assigning every core capability to exactly one canonical subsystem.',
        providers: [
          {
            name: 'CORE',
            scope: 'Workspace / Identity / Relationships / Authority',
            desc: 'Governs tenant boundaries, membership, roles, and succession runbooks. Never maintains financial ledgers.',
          },
          {
            name: 'DOCUMENTS / VAULT',
            scope: 'Canonical Evidence & Document Vault',
            desc: 'The definitive repository for blueprints, contracts, warranties, and file integrity verification.',
          },
          {
            name: 'FIN01',
            scope: 'Canonical Financial Ledger & Transactions',
            desc: 'Analytical double-entry ledgers, banking feeds, billing cycles, and payment allocations. Strictly decoupled from CORE and SERVICE.',
          },
          {
            name: 'BK01',
            scope: 'Centralized Booking & Capacity Engine',
            desc: 'Governs spatial availability, technician scheduling, and amenity reservations. Strictly decoupled from Community.',
          },
          {
            name: 'OPERATIONS',
            scope: 'Canonical Work Order Execution',
            desc: 'Canonical provider for field technician dispatches, maintenance check-ins, and equipment service logs.',
          },
          {
            name: 'COMMUNICATIONS & AUDIT',
            scope: 'Formal Notices & Append-Only Logs',
            desc: 'Statutory notices, verified messaging channels, and append-only chronological audit event streams.',
          },
        ],
      },
      lifecycleBanner: {
        title: 'Lifecycle Continuity from Pre-Sale to Succession',
        desc: 'Properties transition across different phases without lost provenance. Architectural history, meter baselines, and past approvals persist with the asset.',
        cta: 'Explore Lifecycle Architecture',
      },
      trustBanner: {
        title: 'Trust, Security & Governance Architecture',
        desc: 'Workspace-scoped isolation, AAL2 authentication requirements, Zero-Write Denial enforcement, and European data residency.',
        cta: 'Review Trust Architecture',
      },
      aiSection: {
        badge: 'GOVERNED INTELLIGENCE',
        title: 'CLADORA Intelligence: Governed by human authority',
        desc: 'AI assistance operates strictly within a 6-stage lifecycle (Context → Intent → Authority → Plan → Action → Receipt). Artificial intelligence never executes autonomous mutations on canonical ledgers.',
      },
      finalCta: {
        title: 'Engineered for the physical world.',
        subtitle: 'Explore the technical architecture specifications or connect with the CLADORA team for an enterprise pilot partnership.',
        primary: 'Deep System Architecture',
        secondary: 'Start Partnership',
      },
    },
    fa: {
      breadcrumb: { home: 'صفحه اصلی', current: 'پلتفرم و معماری سیستم' },
      hero: {
        badge: 'معماری سیستم کلادورا',
        titleLine1: 'یک پلتفرم جامع.',
        titleLine2: 'بسترهای عملیاتی گوناگون.',
        subtitle:
          'کلادورا هویت پایدار ملک و دارایی‌های فیزیکی را به ورک‌اسپیس‌های عملیاتی تفکیک‌شده، روابط مبتنی بر مجوز و دامنه‌های تخصصی پیوند می‌دهد؛ بدون آنکه حقیقت واحد داده‌ها مخدوش گردد.',
        ctaPrimary: 'مشاهدهٔ جزئیات معماری',
        ctaSecondary: 'درخواست شروع همکاری',
      },
      diagram: {
        badge: 'مدل چهارلایه و متولیان اصلی داده‌ها',
        title: 'ساختار معماری پلتفرم کلادورا',
        subtitle: 'تفکیک دقیق میان دنیای فیزیکی، مرزهای سازمانی ورک‌اسپیس، اختیارات قانونی و گردش‌کارهای اجرایی.',
        levels: [
          {
            tier: 'لایهٔ ۰۱',
            name: 'دنیای فیزیکی (ملک / دارایی)',
            desc: 'زمین، ساختمان، واحد مستقل، مشاعات، کنتورها و تأسیسات فنی. موضوع پایدار سیستم در طول دهه‌ها بهره‌برداری.',
            badge: 'موضوع پایدار فیزیکی',
          },
          {
            tier: 'لایهٔ ۰۲',
            name: 'لایهٔ زمینه و بستر (ورک‌اسپیس)',
            desc: 'شرکت‌ها، مجتمع‌های ساختمانی، تیم‌های بهره‌برداری و پروژه‌ها در مرزهای امن و ایزوله فعالیت می‌کنند.',
            badge: 'مرز امن عملیات',
          },
          {
            tier: 'لایهٔ ۰۳',
            name: 'لایهٔ اختیارات (افراد و روابط حقوقی)',
            desc: 'مجوزهای زمان‌دار، نقش‌های امنیتی معتبر و تحویل شفاف مسئولیت‌ها به جانشین قانونی.',
            badge: 'مجوز و حدود اختیار',
          },
          {
            tier: 'لایهٔ ۰۴',
            name: 'دامنه‌های متصل عملیاتی (دامنه‌های هم‌تراز)',
            desc: 'ایرپراپ (معاملات)، سرویس (پیمانکاران)، عملیات (نگهداری تاسیسات) و تعاملات اجتماعی (ساکنان و بهره‌برداران).',
            badge: 'گردش‌کار اجرایی',
          },
          {
            tier: 'پایهٔ کانونی',
            name: 'ارائه‌دهندگان مرجع داده‌ها (Canonical Providers)',
            desc: 'CORE (هویت/ورک‌اسپیس) • بایگانی مدارک • FIN01 (دفتر مالی) • BK01 (تقویم و ظرفیت) • مکاتبات • ممیزی.',
            badge: 'حقیقت واحد داده‌ها',
          },
        ],
      },
      assetSection: {
        badge: 'هویت پایدار',
        title: 'ملک به عنوان موضوع اصلی و پایدار سیستم',
        lead: 'مالکان، مدیران و پیمانکاران در طول زمان جابه‌جا می‌شوند؛ ملک فیزیکی همواره پایدار است.',
        desc: 'در معماری کلادورا، ملک فیزیکی موضوع محوری اسناد است. تغییر هیئت‌مدیره، جابه‌جایی ساکنان یا فروش مجدد، شناسنامه فنی ساختمان، سوابق کنتورها و تاریخچه تعمیرات را هرگز مخدوش نمی‌کند.',
        points: [
          'شناسه‌های یکتای سلسله‌مراتبی: عرصه، بلوک ساختمانی، واحدها و فضاهای فنی.',
          'پرونده فنی ساختمان و ضمانت‌نامه‌ها همواره به شناسه دارایی متصل می‌مانند.',
          'سوابق مصرف کنتورها با تغییر مستأجر یا ساکن از بین نمی‌روند.',
        ],
      },
      workspaceSection: {
        badge: 'مرزهای تفکیک‌شده عملیات',
        title: 'ورک‌اسپیس: مرز داده و اختیار، فراتر از یک حساب کاربری ساده',
        lead: 'یک ملک فیزیکی می‌تواند بدون کپی‌شدن اطلاعات پایه، در چند ورک‌اسپیس مجاز مشارکت کند.',
        desc: 'ورک‌اسپیس مرز حقوقی، عملیاتی و امنیتی است: انجمن مالکان، شرکت مدیریت املاک، پروژه ساختمانی یا سبد سرمایه‌گذاری. هر ورک‌اسپیس دفاتر مالی و لاگ‌های مستقل خود را دارد و اطلاعات میان آن‌ها افشا نمی‌گردد.',
        points: [
          'تفکیک منطقی داده‌ها و انطباق کامل با موازین حریم خصوصی GDPR.',
          'مدیریت یک ساختمان توسط شرکت کارگزار در یک ورک‌اسپیس مستقل و امن.',
          'عدم تداخل اسناد مالی میان اشخاص حقوقی و نهادهای گوناگون.',
        ],
      },
      peopleSection: {
        badge: 'اختیارات بر مبنای مجوز',
        title: 'افراد، نقش‌ها و مجوزهای زمان‌دار',
        lead: 'یک عنوان به‌تنهایی اختیارات اجرایی ایجاد نمی‌کند؛ اختیار حاصل رابطه، مجوز و زمان مشخص است.',
        desc: 'بر خلاف سیستم‌های سنتی با حساب‌های مدیریت عمومی و نامشخص، کلادورا هر اقدام اثرگذار را به یک مجوز معتبر قانونی، با دامنه مشخص و تاریخ انقضا پیوند می‌دهد (سازنده، مالک، مستأجر، مدیر، تکنسین، پیمانکار).',
        points: [
          'مجوزهای زمان‌دار با حدود مشخص روی فضاها و واحدها.',
          'اصل عدم تغییر بدون مجوز (Zero-Write Denial): بدون اختیار معتبر، تغییری ثبت نمی‌شود.',
          'تحویل مستند و ساختاریافته مسئولیت‌ها به مدیر بعدی در پایان دوره.',
        ],
      },
      domainsSection: {
        badge: 'چهار دامنهٔ هم‌تراز عملیاتی',
        title: 'دامنه‌های متصل بر بستر حقیقت واحد داده‌ها',
        subtitle: 'هر چهار دامنه در معماری سامانه دارای جایگاه هم‌تراز (Peer) هستند و هیچ دامنه‌ای زیرمجموعه دیگری نیست.',
        domains: [
          {
            name: 'AIRPROP',
            role: 'چرخهٔ عمر تجاری و پیش‌فروش',
            desc: 'اتصال مفاهیم چرخه تجاری ملک از پیش‌فروش و تعریف پروژه تا قراردادهای اجاره و تحویل رسمی به مالکان.',
            tag: 'دامنه هم‌تراز',
          },
          {
            name: 'SERVICE',
            role: 'اعلام نیاز، سفارش و تحویل خدمات',
            desc: 'مدیریت نیازهای فنی، درخواست‌های ساختاریافته، مقایسه پیشنهادها، توافق بر شرح کار و هماهنگی تحویل.',
            tag: 'دامنه هم‌تراز',
          },
          {
            name: 'عملیات فنی',
            role: 'نگهداری تأسیسات و دستورکارها',
            desc: 'شناسنامه دیجیتال تجهیزات، برنامه‌های نگهداری دوره‌ای، ارجاع تیکت‌ها و اعزام تکنسین‌ها به محل.',
            tag: 'دامنه هم‌تراز',
          },
          {
            name: 'جامعه و تجربه',
            role: 'زندگی روزمره، اعلانات و تعاملات',
            desc: 'سامانه تعاملی ساکنان، تابلوی اعلانات رسمی، مجامع و رای‌گیری‌ها و درخواست‌های سکونتی.',
            tag: 'دامنه هم‌تراز',
          },
        ],
      },
      providersSection: {
        badge: 'انضباط حقیقت واحد داده‌ها',
        title: 'یک قابلیت، یک متولی مشخص و معتبر برای داده‌ها',
        subtitle: 'حذف مغایرت‌ها و دفاتر موازی با واگذاری هر مسئولیت صرفاً به یک زیرسیستم کانونی و مرجع.',
        providers: [
          {
            name: 'CORE',
            scope: 'ورک‌اسپیس / هویت / روابط / اختیارات',
            desc: 'مدیریت مرزهای سازمانی، اعضا، نقش‌ها و تحویل مسئولیت‌ها. دفاتر مالی را مدیریت نمی‌کند.',
          },
          {
            name: 'بایگانی و مدارک',
            scope: 'آرشیو دیجیتال مستندات و پرونده فنی',
            desc: 'مرجع رسمی نقشه‌ها، قراردادها، ضمانت‌نامه‌ها و اعتبارسنجی سلامت فایل‌ها.',
          },
          {
            name: 'FIN01',
            scope: 'دفاتر مالی و حسابداری کانونی',
            desc: 'حسابداری دوبل تحلیلی، صورت‌حساب بانکی، فاکتورها و تسویه‌حساب‌ها. کاملاً مستقل از CORE و SERVICE.',
          },
          {
            name: 'BK01',
            scope: 'موتور متمرکز تقویم، زمان و ظرفیت',
            desc: 'مرجع اصلی رزرو فضاها، زمان‌بندی تعمیرات و تخصیص امکانات مشترک. مستقل از بخش تعاملات اجتماعی.',
          },
          {
            name: 'عملیات فنی',
            scope: 'اجرای دستورکارهای فنی و سوابق تجهیزات',
            desc: 'مرجع تخصصی اعزام نیرو، بررسی‌های فنی در محل و شناسنامه تعمیرات دستگاه‌ها.',
          },
          {
            name: 'مکاتبات و ممیزی',
            scope: 'اعلانات رسمی و ثبت رویدادها',
            desc: 'ابلاغ‌های قانونی، پیام‌رسانی امن و لاگ‌های ترتیبی رویدادها با برچسب زمانی دقیق.',
          },
        ],
      },
      lifecycleBanner: {
        title: 'پیوستگی در چرخهٔ عمر از پیش‌فروش تا تحویل مسئولیت',
        desc: 'ملک در مراحل مختلف زندگی خود حرکت می‌کند بدون آنکه سوابق گم شوند. اسناد، ارقام کنتورها و مصوبات گذشته به دارایی متصل می‌مانند.',
        cta: 'مشاهدهٔ معماری چرخهٔ عمر',
      },
      trustBanner: {
        title: 'معماری امنیت، اعتماد و حاکمیت داده‌ها',
        desc: 'تفکیک دقیق ورک‌اسپیس‌ها، استانداردهای AAL2، اصل عدم تغییر بدون مجوز و میزبانی داده‌ها در حوزه قضایی اروپا.',
        cta: 'مشاهدهٔ معماری اعتماد',
      },
      aiSection: {
        badge: 'هوشمندی مقید به سیاست‌ها',
        title: 'هوش عملیاتی کلادورا: مقید به اختیارات و نظارت انسان',
        desc: 'دستیار هوشمند در قالب یک چرخهٔ شش‌مرحله‌ای منضبط (زمینه ← قصد ← اختیار ← طرح ← اقدام ← سند ممیزی) عمل می‌کند و هرگز تصمیم خودسرانه‌ای بر دفاتر مالی اعمال نمی‌نماید.',
      },
      finalCta: {
        title: 'مهندسی‌شده برای استانداردهای دنیای فیزیکی.',
        subtitle: 'جزئیات کامل معماری پلتفرم را بررسی نمایید یا جهت شروع همکاری پایلوت با تیم کلادورا در ارتباط باشید.',
        primary: 'بررسی معماری تفصیلی سیستم',
        secondary: 'درخواست شروع همکاری',
      },
    },
  }[lang] || {
    breadcrumb: { home: 'Home', current: 'Platform' },
    hero: {
      badge: 'CLADORA SYSTEM ARCHITECTURE',
      titleLine1: 'One Platform.',
      titleLine2: 'Many Operational Contexts.',
      subtitle: 'Decoupled architecture connecting persistent property identity with isolated operational workspaces.',
      ctaPrimary: 'Explore Deep Architecture',
      ctaSecondary: 'Start Partnership',
    },
    diagram: { badge: '', title: '', subtitle: '', levels: [] },
    assetSection: { badge: '', title: '', lead: '', desc: '', points: [] },
    workspaceSection: { badge: '', title: '', lead: '', desc: '', points: [] },
    peopleSection: { badge: '', title: '', lead: '', desc: '', points: [] },
    domainsSection: { badge: '', title: '', subtitle: '', domains: [] },
    providersSection: { badge: '', title: '', subtitle: '', providers: [] },
    lifecycleBanner: { title: '', desc: '', cta: '' },
    trustBanner: { title: '', desc: '', cta: '' },
    aiSection: { badge: '', title: '', desc: '' },
    finalCta: { title: '', subtitle: '', primary: '', secondary: '' },
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-24">
        
        {/* SECTION 01 — HERO */}
        <section className="space-y-6">
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#52667A] font-medium">
            <Link href={`/${lang}`} className="hover:text-[#102A43]">
              {content.breadcrumb.home}
            </Link>
            <span>/</span>
            <span className="text-[#102A43] font-bold">
              {content.breadcrumb.current}
            </span>
          </nav>

          <div className="max-w-4xl space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E]">
              <span className="w-2 h-2 rounded-full bg-[#0E9F8E]" />
              <span>{content.hero.badge}</span>
            </div>
            
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold text-[#102A43] tracking-tight leading-[1.12]">
              <span>{content.hero.titleLine1}</span>{' '}
              <span className="text-[#0E9F8E] block sm:inline">{content.hero.titleLine2}</span>
            </h1>

            <p className="text-base sm:text-xl text-[#52667A] leading-relaxed max-w-3xl">
              {content.hero.subtitle}
            </p>

            <div className="pt-4 flex flex-col sm:flex-row items-center gap-4">
              <Link
                href={`/${lang}/platform/architecture`}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-[#0E9F8E] text-white text-sm font-bold hover:bg-[#0C8778] transition shadow-card flex items-center justify-center gap-2"
              >
                <span>{content.hero.ctaPrimary}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>

              <Link
                href={`/${lang}/contact`}
                className="w-full sm:w-auto px-7 py-3.5 rounded-xl bg-white text-[#102A43] border border-[#D3DCE6] text-sm font-bold hover:bg-[#F0F4F8] transition shadow-card flex items-center justify-center gap-2"
              >
                <span>{content.hero.ctaSecondary}</span>
              </Link>
            </div>
          </div>
        </section>

        {/* SECTION 02 — ARCHITECTURE OVERVIEW DIAGRAM */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-elevated space-y-8">
          <div className="max-w-3xl">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.diagram.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight mt-1 mb-2">
              {content.diagram.title}
            </h2>
            <p className="text-sm sm:text-base text-[#52667A] leading-relaxed">
              {content.diagram.subtitle}
            </p>
          </div>

          <div className="space-y-4">
            {content.diagram.levels.map((lvl, idx) => (
              <div 
                key={lvl.tier}
                className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#B2E5DF] transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0E9F8E] tracking-wider uppercase bg-teal-50 px-2.5 py-0.5 rounded-md border border-teal-200">
                      {lvl.tier}
                    </span>
                    <h3 className="text-sm sm:text-base font-bold text-[#102A43]">{lvl.name}</h3>
                  </div>
                  <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">{lvl.desc}</p>
                </div>
                <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-white border border-[#E2E8F0] text-[#102A43] shrink-0 self-start md:self-auto">
                  {lvl.badge}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 03 — PROPERTY / ASSET */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E]">
              <Building2 className="w-3.5 h-3.5" />
              <span>{content.assetSection.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.assetSection.title}
            </h2>
            <p className="text-base font-semibold text-[#102A43]">
              {content.assetSection.lead}
            </p>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.assetSection.desc}
            </p>
            <ul className="space-y-2 pt-2 text-xs sm:text-sm text-[#334E68]">
              {content.assetSection.points.map((pt, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-[#D3DCE6] shadow-card space-y-4">
            <div className="text-xs font-bold text-[#7B8A9A] uppercase tracking-wider mb-2">
              Persistent Physical Topology
            </div>
            <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-1">
              <span className="text-xs font-bold text-[#102A43]">Site / Cadastral Plot</span>
              <p className="text-[11px] text-[#52667A]">Persistent geographic boundary and land coordinates</p>
            </div>
            <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-1 ms-4">
              <span className="text-xs font-bold text-[#102A43]">Building Structure & Plant</span>
              <p className="text-[11px] text-[#52667A]">Roof, elevators, boiler rooms, common electrical switchboards</p>
            </div>
            <div className="p-4 rounded-xl bg-white border-2 border-[#0E9F8E] shadow-sm space-y-1 ms-8">
              <span className="text-xs font-bold text-[#0E9F8E]">Individual Units & Demised Spaces</span>
              <p className="text-[11px] text-[#52667A]">Apartments, offices, retail bays with persistent meter baselines</p>
            </div>
          </div>
        </section>

        {/* SECTION 04 — WORKSPACE */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 bg-white rounded-3xl p-8 border border-[#D3DCE6] shadow-card space-y-4">
            <div className="text-xs font-bold text-[#7B8A9A] uppercase tracking-wider mb-2">
              Operational Workspace Contexts
            </div>
            <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0]">
              <div className="text-xs font-bold text-[#102A43]">Association / HOA Workspace</div>
              <p className="text-[11px] text-[#52667A] mt-1">Governs statutory quotas, utility allocations, and general meetings</p>
            </div>
            <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0]">
              <div className="text-xs font-bold text-[#102A43]">Property Management Firm Workspace</div>
              <p className="text-[11px] text-[#52667A] mt-1">Multi-building maintenance dispatch, contractor SLAs, and billing</p>
            </div>
            <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0]">
              <div className="text-xs font-bold text-[#102A43]">Owner Portfolio Workspace</div>
              <p className="text-[11px] text-[#52667A] mt-1">Rental collections, tenancy agreements, and asset yield tracking</p>
            </div>
          </div>

          <div className="order-1 lg:order-2 space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E]">
              <Layers className="w-3.5 h-3.5" />
              <span>{content.workspaceSection.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.workspaceSection.title}
            </h2>
            <p className="text-base font-semibold text-[#102A43]">
              {content.workspaceSection.lead}
            </p>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.workspaceSection.desc}
            </p>
            <ul className="space-y-2 pt-2 text-xs sm:text-sm text-[#334E68]">
              {content.workspaceSection.points.map((pt, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                  <span>{pt}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* SECTION 05 — PEOPLE / ROLES / RELATIONSHIPS */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E]">
              <Users className="w-3.5 h-3.5" />
              <span>{content.peopleSection.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.peopleSection.title}
            </h2>
            <p className="text-base font-semibold text-[#102A43]">
              {content.peopleSection.lead}
            </p>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.peopleSection.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
            {content.peopleSection.points.map((pt, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0]">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0E9F8E] flex items-center justify-center font-bold text-xs mb-3">
                  0{idx + 1}
                </div>
                <p className="text-xs sm:text-sm text-[#102A43] font-medium leading-relaxed">{pt}</p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 06 — CONNECTED DOMAINS (PEER DOMAINS) */}
        <section className="space-y-8">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E]">
              <Activity className="w-3.5 h-3.5" />
              <span>{content.domainsSection.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-[#102A43] tracking-tight">
              {content.domainsSection.title}
            </h2>
            <p className="text-sm sm:text-base text-[#52667A]">
              {content.domainsSection.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {content.domainsSection.domains.map((dom) => (
              <div 
                key={dom.name}
                className="bg-white rounded-3xl p-6 border border-[#E2E8F0] shadow-card hover:border-[#B2E5DF] transition-all flex flex-col justify-between"
              >
                <div>
                  <span className="text-[10px] font-bold text-[#0E9F8E] uppercase tracking-wider bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 mb-3 inline-block">
                    {dom.tag}
                  </span>
                  <h3 className="text-lg font-bold text-[#102A43] mb-1">{dom.name}</h3>
                  <div className="text-xs font-semibold text-[#0E9F8E] mb-3">{dom.role}</div>
                  <p className="text-xs text-[#52667A] leading-relaxed">{dom.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 07 — CANONICAL PROVIDERS */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-elevated space-y-8">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E]">
              <Database className="w-3.5 h-3.5" />
              <span>{content.providersSection.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.providersSection.title}
            </h2>
            <p className="text-sm sm:text-base text-[#52667A] leading-relaxed">
              {content.providersSection.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.providersSection.providers.map((prv) => (
              <div key={prv.name} className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
                <span className="text-xs font-mono font-bold text-[#0E9F8E] uppercase tracking-wider block">
                  {prv.name}
                </span>
                <h3 className="text-sm font-bold text-[#102A43]">{prv.scope}</h3>
                <p className="text-xs text-[#52667A] leading-relaxed">{prv.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-2xl bg-teal-50 border border-teal-200 text-xs text-[#0A6E62] leading-relaxed">
            <strong>Canonical Truth Principle:</strong> FIN01 is the sole owner of accounting and financial ledger truth. BK01 is the sole owner of reservation capacity truth. Neither SERVICE nor Community &amp; Experience maintain parallel ledger truths.
          </div>
        </section>

        {/* SECTION 08 & 09 — LIFECYCLE & TRUST BANNERS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[#102A43] text-white rounded-3xl p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <span className="text-xs font-bold text-teal-300 uppercase tracking-wider block">
                Non-Linear Continuity
              </span>
              <h3 className="text-xl font-bold">{content.lifecycleBanner.title}</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {content.lifecycleBanner.desc}
              </p>
            </div>
            <Link
              href={`/${lang}/platform/lifecycle`}
              className="inline-flex items-center gap-2 text-xs font-bold text-teal-300 hover:text-white transition"
            >
              <span>{content.lifecycleBanner.cta}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
          </div>

          <div className="bg-[#102A43] text-white rounded-3xl p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              <span className="text-xs font-bold text-teal-300 uppercase tracking-wider block">
                Governance &amp; Controls
              </span>
              <h3 className="text-xl font-bold">{content.trustBanner.title}</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {content.trustBanner.desc}
              </p>
            </div>
            <Link
              href={`/${lang}/platform/trust`}
              className="inline-flex items-center gap-2 text-xs font-bold text-teal-300 hover:text-white transition"
            >
              <span>{content.trustBanner.cta}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>

        {/* SECTION 10 — INTELLIGENCE PREVIEW */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E]">
            <Bot className="w-3.5 h-3.5" />
            <span>{content.aiSection.badge}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
            {content.aiSection.title}
          </h2>
          <p className="text-sm sm:text-base text-[#52667A] leading-relaxed max-w-3xl">
            {content.aiSection.desc}
          </p>
          <div className="pt-2">
            <Link
              href={`/${lang}/ai`}
              className="inline-flex items-center gap-2 text-xs font-bold text-[#0E9F8E] hover:underline"
            >
              <span>{lang === 'ro' ? 'Explorează CLADORA Intelligence' : lang === 'fa' ? 'آشنایی با مدل هوش عملیاتی' : 'Explore CLADORA Intelligence'}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
          </div>
        </section>

        {/* SECTION 11 — FINAL CTA */}
        <section className="bg-gradient-to-br from-[#102A43] via-[#102A43] to-[#173F5F] text-white rounded-3xl p-8 sm:p-14 text-center space-y-6">
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              {content.finalCta.title}
            </h2>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {content.finalCta.subtitle}
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href={`/${lang}/platform/architecture`}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-[#0E9F8E] text-white text-sm font-bold hover:bg-[#0C8778] transition shadow-card flex items-center justify-center gap-2"
            >
              <span>{content.finalCta.primary}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto px-8 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 text-sm font-bold transition flex items-center justify-center gap-2"
            >
              <span>{content.finalCta.secondary}</span>
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
