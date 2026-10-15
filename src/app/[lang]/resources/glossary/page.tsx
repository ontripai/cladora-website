import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import { BookA, Search, ArrowRight, Info } from 'lucide-react';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/resources/glossary', params.lang);
}

export default async function GlossaryPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        resources: 'Resurse',
        current: 'Glosar Canonic de Termeni',
      },
      hero: {
        badge: 'Glosarul Canonic al Platformei',
        title: 'Glosar Canonic: Concepte, Entități & Arhitectură',
        subtitle:
          'Definițiile oficiale ale entităților fundamentale, furnizorilor canonici de adevăr și dimensiunilor de compoziție din arhitectura CLADORA.',
      },
      disclaimer: {
        title: 'Notă privind Definițiile Arhitecturale',
        text: 'Termenii din acest glosar definesc responsabilitățile de domeniu și principiile de modelare a datelor. Atribuirea responsabilității canonice către un furnizor (de exemplu, BK01 pentru rezervări sau FIN01 pentru contabilitate) descrie unde aparțin datele în arhitectură și nu constituie o dovadă a disponibilității universale a funcționalităților în orice moment.',
      },
      categories: {
        all: 'Toate Conceptele',
        core: 'Entități & Autoritate CORE',
        providers: 'Furnizori Canonici de Adevăr',
        composition: 'Dimensiuni de Compoziție & Arhitectură',
        governance: 'Guvernanță & Migrare',
      },
      terms: [
        {
          term: 'Proprietate / Activ (Property / Asset)',
          category: 'core',
          definition:
            'Obiectul fizic persistent din lumea reală (teren, clădire, complex comercial, ansamblu rezidențial sau rețea de facilități) care își păstrează identitatea independent de schimbarea proprietarilor, a chiriașilor sau a firmelor de administrare.',
        },
        {
          term: 'Workspace (Spațiu de Lucru)',
          category: 'core',
          definition:
            'Granița logică, administrativă și de securitate a unei organizații (dezvoltator, asociație de proprietari, firmă de property management sau companie de servicii). Asigură separarea datelor operaționale și a accesului utilizatorilor.',
        },
        {
          term: 'Loc / Resursă (Place / Resource)',
          category: 'core',
          definition:
            'O subdiviziune spațială sau un element funcțional al unei proprietăți (apartament, birou, loc de parcare, boxă, sală de conferințe, ascensor sau contor) identificat unic în ierarhia activului.',
        },
        {
          term: 'Persoană (Person)',
          category: 'core',
          definition:
            'Identitatea digitală persistentă a unui utilizator uman în platformă. O persoană poate participa simultan în multiple Workspace-uri, exercitând roluri diferite pe baza relațiilor juridice distincte, fără amestecarea contextelor.',
        },
        {
          term: 'Organizație (Organization)',
          category: 'core',
          definition:
            'Persoana juridică sau entitatea colectivă (asociație de proprietari, dezvoltator, societate de administrare, furnizor tehnic) care deține sau operează unul sau mai multe Workspace-uri.',
        },
        {
          term: 'Rol (Role)',
          category: 'core',
          definition:
            'Un set definit de permisiuni operaționale aplicabil în cadrul unui Workspace specific (exemplu: Administrator, Cenzor, Membru Comitet, Locatar, Tehnician Intervenție).',
        },
        {
          term: 'Relație (Relationship)',
          category: 'core',
          definition:
            'Legătura formală și atestată între o Persoană (sau Organizație) și o Proprietate sau o Resursă (exemplu: Proprietar, Coproprietar, Chiriaș, Comodatar, Mandatar). Relația stă la baza atribuirii drepturilor de acces.',
        },
        {
          term: 'Autoritate (Authority)',
          category: 'core',
          definition:
            'Dreptul operațional legitim conferit unei Persoane de a efectua acțiuni cu impact în sistem (aprobare plăți, emitere comenzi de lucru, confirmare indexuri). Autoritatea este întotdeauna contextuală, delimitată la un Workspace și supusă politicilor de conformitate.',
        },
        {
          term: 'Mandat (Mandate)',
          category: 'core',
          definition:
            'Perioada determinată de timp și cadrul de împuternicire legală în care o persoană sau entitate exercită autoritate operațională (exemplu: mandatul comitetului executiv ales pentru un an conform Legii 196/2018).',
        },
        {
          term: 'Capabilitate (Capability)',
          category: 'composition',
          definition:
            'O unitate funcțională discretă și compozabilă a platformei (ex: gestiunea contoarelor, procesarea extraselor bancare, emiterea cotelor de întreținere) care poate fi activată în funcție de profilul clădirii.',
        },
        {
          term: 'Furnizor Canonic (Canonical Provider)',
          category: 'providers',
          definition:
            'Subunitatea arhitecturală desemnată ca singura autoritate de scriere și păstrare a adevărului pentru o anumită categorie de date (ex: FIN01 pentru tranzacții financiare, DOCUMENTS pentru versiuni probatorii).',
        },
        {
          term: 'Adevăr Canonic (Canonical Truth)',
          category: 'providers',
          definition:
            'Starea verificată și neechivocă a datelor dintr-un domeniu critic, garantată de furnizorul canonic desemnat, prevenind discrepanțele cauzate de baze de date paralele sau reconcilieri conflictuale.',
        },
        {
          term: 'CORE',
          category: 'providers',
          definition:
            'Furnizorul canonic de adevăr pentru identitatea imobilelor, spațiile de lucru (workspaces), persoanele fizice/juridice, relațiile atestate și frontierele de autoritate operațională.',
        },
        {
          term: 'DOCUMENTS',
          category: 'providers',
          definition:
            'Furnizorul canonic de adevăr pentru documentele oficiale, versiunile auditate, proveniența fișierelor și dovezile foto ale intervențiilor tehnice.',
        },
        {
          term: 'FIN01',
          category: 'providers',
          definition:
            'Furnizorul canonic de adevăr financiar: jurnale de tranzacții, reguli de repartizare a costurilor, cote statutare, balanțe de verificare și reconciliere bancară.',
        },
        {
          term: 'BK01',
          category: 'providers',
          definition:
            'Furnizorul canonic de adevăr pentru capacitate, calendare de disponibilitate și rezervarea spațiilor sau resurselor comune.',
        },
        {
          term: 'SERVICE',
          category: 'providers',
          definition:
            'Domeniul responsabil de semantica cererilor de asistență, solicitărilor de intervenție, formularea cererilor de ofertă și coordonarea furnizorilor de servicii.',
        },
        {
          term: 'OPERATIONS',
          category: 'providers',
          definition:
            'Domeniul responsabil de execuția operațională a comenzilor de lucru (work orders), mentenanța preventivă și corectivă a echipamentelor și jurnalele de șantier.',
        },
        {
          term: 'COMMUNICATIONS',
          category: 'providers',
          definition:
            'Furnizorul canonic pentru livrarea mesajelor, canalele oficiale de anunțuri, avizierele digitale și trasabilitatea notificărilor către ocupanți.',
        },
        {
          term: 'AIRPROP',
          category: 'providers',
          definition:
            'Domeniul care gestionează semantica ciclului comercial: oportunități, inventarul de vânzare/închiriere, pregătirea tranzacțiilor și continuitatea predării activelor.',
        },
        {
          term: 'Comunitate & Experiență (C&E)',
          category: 'providers',
          definition:
            'Domeniul responsabil de compoziția interacțiunilor utilizatorilor, ghidurile de spațiu, evenimentele comunitare și călătoriile contextuale pe proprietate.',
        },
        {
          term: 'CLADORA Intelligence',
          category: 'providers',
          definition:
            'Nivelul de asistență bazat pe inteligență artificială, strict subordonat autorității umane, ce operează în cadrul politicilor de conformitate fără a deține adevăr canonic autonom.',
        },
        {
          term: 'Pachet de Țară (Country Pack)',
          category: 'composition',
          definition:
            'Stratul de adaptare la specificul jurisdicțional care cuprinde terminologia locală, cerințele de repartizare legală (ex: Legea 196/2018 în România) și formularele statutare fără a fragmenta modelul global.',
        },
        {
          term: 'ADN-ul Clădirii (Building DNA)',
          category: 'composition',
          definition:
            'Arhetipul structural și tehnic al proprietății (turn rezidențial, comunitate de vile, clădire de birouri, parc logistic, centru comercial) care determină ce module sunt aplicabile.',
        },
        {
          term: 'Profilul Proprietății (Property Profile)',
          category: 'composition',
          definition:
            'Configurația unică a unui activ, rezultată din combinarea ADN-ului clădirii, a regimului de proprietate și a cerințelor operaționale.',
        },
        {
          term: 'Model Operațional (Operating Model)',
          category: 'composition',
          definition:
            'Modalitatea aleasă de administrare a proprietății: autoguvernată de proprietari (asociație), externalizată către un administrator profesionist sau gestionată corporativ.',
        },
        {
          term: 'Profil de Servicii (Service Profile)',
          category: 'composition',
          definition:
            'Nivelul și tipologia serviciilor contractate pentru o clădire (mentenanță ascensoare, curățenie, pază, servicii verzi, audit tehnic).',
        },
        {
          term: 'Proveniența de Migrare (Migration Provenance)',
          category: 'governance',
          definition:
            'Metadatele complete care însoțesc fiecare înregistrare importată (sistem sursă, cheie originală, regulă de transformare, lot de import, validare și semnătură de acceptanță).',
        },
        {
          term: 'Guvernanța Disponibilității (Availability Governance)',
          category: 'governance',
          definition:
            'Cadrul de disciplină publică ce distinge între modelul arhitectural, maturitatea de lansare la runtime, domeniul implementării contractuale și drepturile de acces.',
        },
        {
          term: 'Chitanță de Acțiune (Action Receipt)',
          category: 'governance',
          definition:
            'Înregistrarea structurată și auditabilă generată în urma unei operațiuni cu impact (aprobare de plată, transmitere index contor, închidere tichet tehnic), conținând autorul, marca temporală și dovada asociată.',
        },
      ],
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        resources: 'Resources',
        current: 'Canonical Glossary of Terms',
      },
      hero: {
        badge: 'Canonical Platform Glossary',
        title: 'Canonical Glossary: Entities, Providers & Architecture',
        subtitle:
          'Authoritative definitions of core entities, canonical truth providers, and composable dimensions within the CLADORA operating architecture.',
      },
      disclaimer: {
        title: 'Notice on Architectural Definitions',
        text: 'Glossary terms articulate domain boundaries, ownership scopes, and data modeling principles. Assigning canonical responsibility to a provider (such as BK01 for reservations or FIN01 for financial truth) reflects architectural boundaries, not universal production availability across all deployed instances.',
      },
      categories: {
        all: 'All Concepts',
        core: 'CORE Identity & Authority',
        providers: 'Canonical Truth Providers',
        composition: 'Composable Dimensions',
        governance: 'Governance & Migration',
      },
      terms: [
        {
          term: 'Property / Asset',
          category: 'core',
          definition:
            'The enduring, physical subject in the built world (land parcel, building, commercial complex, residential community, or infrastructure facility) that maintains persistent identity across changes in ownership, tenancy, or management agencies.',
        },
        {
          term: 'Workspace',
          category: 'core',
          definition:
            'The logical, administrative, and security boundary of an organization (developer, homeowner association, property management firm, or service vendor). Governs operational isolation, permission scoping, and data separation.',
        },
        {
          term: 'Place / Resource',
          category: 'core',
          definition:
            'A spatial subdivision or functional element within a property (apartment, office suite, parking stall, storage locker, conference room, elevator, or utility meter) uniquely referenced in the asset hierarchy.',
        },
        {
          term: 'Person',
          category: 'core',
          definition:
            'The persistent digital identity of a human actor. A single person may hold concurrent roles across distinct workspaces based on verified legal relationships, switching contexts without data cross-bleeding.',
        },
        {
          term: 'Organization',
          category: 'core',
          definition:
            'The legal entity or collective body (HOA, developer, asset management company, technical contractor) that owns, controls, or participates in one or more workspaces.',
        },
        {
          term: 'Role',
          category: 'core',
          definition:
            'A defined set of operational privileges applicable within a specific workspace boundary (e.g., Property Manager, Board President, Auditor, Resident, Service Contractor).',
        },
        {
          term: 'Relationship',
          category: 'core',
          definition:
            'The formal, verifiable legal link connecting a Person (or Organization) to a Property or Resource (e.g., Title Owner, Co-owner, Tenant, Authorized Representative). Governs the basis for permission assignment.',
        },
        {
          term: 'Authority',
          category: 'core',
          definition:
            'The legitimate operational entitlement conferred upon a Person to execute impactful actions within a workspace (authorizing invoices, approving maintenance orders, validating meter readings). Authority is always scoped, contextual, and auditable.',
        },
        {
          term: 'Mandate',
          category: 'core',
          definition:
            'The time-bound, legally sanctioned operational term during which an authorized party exercises governance duties (e.g., an elected HOA board term pursuant to statutory regulations).',
        },
        {
          term: 'Capability',
          category: 'composition',
          definition:
            'A discrete, composable functional block of the platform (e.g., utility meter tracking, bank transaction reconciliation, statutory cost allocation) enabled dynamically according to property requirements.',
        },
        {
          term: 'Canonical Provider',
          category: 'providers',
          definition:
            'The designated architectural domain that holds sole write authority and custodial responsibility for a specific class of operational truth (e.g., FIN01 for financial ledgers, DOCUMENTS for evidence provenance).',
        },
        {
          term: 'Canonical Truth',
          category: 'providers',
          definition:
            'The single, authoritative state of critical data maintained by its designated provider, eliminating synchronization errors caused by parallel ledgers or ad-hoc duplicate stores.',
        },
        {
          term: 'CORE',
          category: 'providers',
          definition:
            'The canonical truth provider for physical asset identities, organizational workspaces, natural/legal persons, verified relationships, and operational authority boundaries.',
        },
        {
          term: 'DOCUMENTS',
          category: 'providers',
          definition:
            'The canonical truth provider for official records, audited versions, file provenance, and photographic acceptance evidence.',
        },
        {
          term: 'FIN01',
          category: 'providers',
          definition:
            'The canonical provider for financial truth: transaction ledgers, posting rules, expense allocation calculations, trial balances, and banking reconciliation records.',
        },
        {
          term: 'BK01',
          category: 'providers',
          definition:
            'The canonical provider for booking truth, capacity constraints, availability schedules, and shared resource reservations.',
        },
        {
          term: 'SERVICE',
          category: 'providers',
          definition:
            'The domain governing service intent, maintenance inquiries, quote requests, and vendor coordination semantics.',
        },
        {
          term: 'OPERATIONS',
          category: 'providers',
          definition:
            'The domain governing field work-order execution, preventative maintenance routines, contractor dispatch, and equipment inspection logs.',
        },
        {
          term: 'COMMUNICATIONS',
          category: 'providers',
          definition:
            'The canonical provider for official message delivery, formal notices, digital community boards, and communication delivery auditability.',
        },
        {
          term: 'AIRPROP',
          category: 'providers',
          definition:
            'The domain governing commercial lifecycle semantics: pipeline tracking, sales/leasing availability, deal structuring, and pre-handover record continuity.',
        },
        {
          term: 'Community & Experience (C&E)',
          category: 'providers',
          definition:
            'The domain orchestrating user interactions, place guides, community events, and contextual occupant journeys across properties.',
        },
        {
          term: 'CLADORA Intelligence',
          category: 'providers',
          definition:
            'The assistive, context-aware artificial intelligence layer that operates subordinately within CORE authority boundaries and policy gates, without autonomous canonical ownership.',
        },
        {
          term: 'Country Pack',
          category: 'composition',
          definition:
            'The localized operational overlay encompassing jurisdictional terminology, statutory cost allocation schemes (e.g., Romanian Law 196/2018), and compliance reporting without branching core architecture.',
        },
        {
          term: 'Building DNA',
          category: 'composition',
          definition:
            'The architectural typology and physical profile of a property (e.g., high-rise tower, villa community, commercial office, logistics warehouse) determining its modular configuration.',
        },
        {
          term: 'Property Profile',
          category: 'composition',
          definition:
            'The specific operational blueprint of an asset resulting from the intersection of its Building DNA, ownership structure, and service complexity.',
        },
        {
          term: 'Operating Model',
          category: 'composition',
          definition:
            'The organizational governance framework applied to an asset: self-managed HOA, outsourced third-party manager, or corporate portfolio administration.',
        },
        {
          term: 'Service Profile',
          category: 'composition',
          definition:
            'The defined scope of physical operations contracted for an asset (e.g., elevator maintenance, security surveillance, landscaping, HVAC systems).',
        },
        {
          term: 'Migration Provenance',
          category: 'governance',
          definition:
            'The immutable metadata trail attached to every imported legacy record (source system, source key, mapping decision, batch identifier, validation state, and sign-off).',
        },
        {
          term: 'Availability Governance',
          category: 'governance',
          definition:
            'The public truth framework that rigorously differentiates architectural domain relevance, runtime release maturity, deployment scope, and user entitlement.',
        },
        {
          term: 'Action Receipt',
          category: 'governance',
          definition:
            'An immutable, auditable record emitted following a consequential operation (invoice approval, meter submission, ticket closure) logging actor attribution, timestamp, and supporting evidence.',
        },
      ],
    },
    fa: {
      breadcrumbs: {
        home: 'صفحه اصلی',
        resources: 'منابع',
        current: 'واژه‌نامه مرجع اصطلاحات',
      },
      hero: {
        badge: 'واژه‌نامه رسمی پلتفرم',
        title: 'واژه‌نامه مرجع: مفاهیم، متولیان داده و معماری',
        subtitle:
          'تعاریف رسمی و مستند از موجودیت‌های بنیادین، مراجع حقیقت داده‌ها و ابعاد ترکیب‌پذیر معماری کلادورا.',
      },
      disclaimer: {
        title: 'یادداشت پیرامون تعاریف معماری',
        text: 'اصطلاحات این واژه‌نامه حدود اختیارات دامنه‌ها و اصول حاکم بر داده‌ها را مشخص می‌نمایند. تعیین یک متولی مرجع (مانند BK01 برای رزروها یا FIN01 برای دفاتر مالی) مرزهای داده‌ای معماری را تبیین می‌کند و به منزله ادعای فعال بودن بی‌قیدوشرط تمام ویژگی‌ها در زمان حاضر نیست.',
      },
      categories: {
        all: 'تمام مفاهیم',
        core: 'هویت و حدود اختیارات CORE',
        providers: 'متولیان مرجع داده‌ها (Canonical Providers)',
        composition: 'ابعاد ترکیب‌پذیر معماری',
        governance: 'حاکمیت داده و مهاجرت',
      },
      terms: [
        {
          term: 'ملک و دارایی (Property / Asset)',
          category: 'core',
          definition:
            'بستر فیزیکی و پایدار در دنیای واقعی (زمین، مجتمع مسکونی، برج اداری، مرکز خرید یا انبار) که هویت دیجیتال آن مستقل از تغییر مالکان، مستأجران یا شرکت‌های مدیریت باقی می‌ماند.',
        },
        {
          term: 'فضای کاری (Workspace)',
          category: 'core',
          definition:
            'مرز منطقی، اداری و امنیتی یک سازمان (سازنده، هیئت‌مدیره مجتمع، شرکت مدیریت یا پیمانکار خدمات) که تفکیک اطلاعات و استقلال دسترسی‌ها را تضمین می‌کند.',
        },
        {
          term: 'مکان و منبع (Place / Resource)',
          category: 'core',
          definition:
            'بخش‌های فرعی و فضاهای عملکردی یک ملک (واحد آپارتمان، دفتر کار، پارکینگ، انباری، سالن اجتماعات، آسانسور یا کنتور) که دارای شناسنامه ساختاریافته هستند.',
        },
        {
          term: 'شخص (Person)',
          category: 'core',
          definition:
            'هویت دیجیتال پایدار فرد در پلتفرم. یک شخص می‌تواند با تکیه بر اسناد حقوقی مستقل، هم‌زمان در فضاهای کاری گوناگون حضور داشته باشد بدون آنکه اطلاعات آن محیط‌ها با یکدیگر تداخل یابند.',
        },
        {
          term: 'سازمان (Organization)',
          category: 'core',
          definition:
            'شخصیت حقوقی یا نهاد جمعی (انجمن مالکان، شرکت سازنده، شرکت مدیریت املاک) که مالک یا بهره‌بردار یک یا چند فضای کاری در پلتفرم است.',
        },
        {
          term: 'نقش (Role)',
          category: 'core',
          definition:
            'مجموعه مشخصی از دسترسی‌های عملیاتی در یک فضای کاری معین (مانند: مدیر مجتمع، بازرس، عضو هیئت‌مدیره، ساکن یا تکنسین فنی).',
        },
        {
          term: 'رابطه حقوقی (Relationship)',
          category: 'core',
          definition:
            'پیوند رسمی و قابل اثبات میان شخص و ملک یا واحد فرعی (مانند: مالک، مستأجر، وکیل رسمی). مبنای اصلی اعطای دسترسی‌های کاری در پلتفرم است.',
        },
        {
          term: 'حدود اختیارات (Authority)',
          category: 'core',
          definition:
            'اختیار رسمی و بافت‌محور تفویض‌شده به یک فرد جهت انجام اقدامات موثر در سیستم (تایید پرداخت‌ها، صدور دستور کار، تایید ارقام کنتور). همواره محدود به فضای کاری و مقید به ضوابط است.',
        },
        {
          term: 'دوره مسئولیت (Mandate)',
          category: 'core',
          definition:
            'بازه زمانی معین و قانونی که طی آن یک شخص یا گروه، مسئولیت اداره و اعمال اختیارات را بر عهده دارند (مانند دوره تصدی هیئت‌مدیره منتخب مجتمع).',
        },
        {
          term: 'قابلیت (Capability)',
          category: 'composition',
          definition:
            'واحد عملکردی تفکیک‌پذیر در پلتفرم (مانند قرائت کنتورها، مغایرت‌گیری بانکی، تسهیم شارژ قانونی) که متناسب با مشخصات ساختمان فعال می‌گردد.',
        },
        {
          term: 'متولی مرجع داده (Canonical Provider)',
          category: 'providers',
          definition:
            'زیرسیستم معماری که تنها مرجع رسمی ثبت و حفظ حقایق داده‌ای در یک حوزه مشخص محسوب می‌شود (مانند FIN01 برای رخدادهای مالی، DOCUMENTS برای اصالت اسناد).',
        },
        {
          term: 'حقیقت مرجع (Canonical Truth)',
          category: 'providers',
          definition:
            'وضعیت قطعی و بدون ابهام اطلاعات در یک حوزه حیاتی که مانع از ایجاد تضاد ناشی از پایگاه داده‌های موازی یا ثبت چندگانه می‌شود.',
        },
        {
          term: 'CORE',
          category: 'providers',
          definition:
            'متولی مرجع داده‌ها در زمینه هویت دارایی‌های ملکی، فضاهای کاری (Workspaces)، مشخصات افراد، روابط حقوقی تاییدشده و حدود اختیارات کاربران.',
        },
        {
          term: 'DOCUMENTS',
          category: 'providers',
          definition:
            'متولی مرجع داده‌ها برای نسخه‌های رسمی اسناد، تاریخچه تغییرات، شواهد تصویری و اصالت فایل‌های بارگذاری‌شده.',
        },
        {
          term: 'FIN01',
          category: 'providers',
          definition:
            'متولی مرجع حقیقت مالی: دفاتر تراکنش‌ها، فرمول‌های تسهیم هزینه، ترازها، ثبت فیش‌های شارژ و رکوردهای مغایرت‌گیری بانکی.',
        },
        {
          term: 'BK01',
          category: 'providers',
          definition:
            'متولی مرجع ظرفیت، تقویم‌های دسترسی و فرآیندهای رزرو فضاها و امکانات مشترک ملک.',
        },
        {
          term: 'SERVICE',
          category: 'providers',
          definition:
            'دامنه متولی مدیریت اعلام خرابی، درخواست‌های خدماتی، مقایسه استعلام قیمت‌ها و هماهنگی با ارائه‌دهندگان خدمات.',
        },
        {
          term: 'OPERATIONS',
          category: 'providers',
          definition:
            'دامنه متولی صدور و پیگیری دستورکارهای فنی (Work Orders)، سرویس‌های دوره‌ای تجهیزات و گزارش‌های فنی در محل.',
        },
        {
          term: 'COMMUNICATIONS',
          category: 'providers',
          definition:
            'متولی مرجع ارسال رسمی پیام‌ها، کانال‌های اطلاع‌رسانی، تابلو اعلانات دیجیتال و تاریخچه ابلاغیه‌ها به ساکنان.',
        },
        {
          term: 'AIRPROP',
          category: 'providers',
          definition:
            'دامنه متولی چرخه تجاری ملک: پیش‌فروش، اجاره، ثبت فرصت‌ها و پیوستگی اطلاعات تا مرحله تحویل قطعی واحدها.',
        },
        {
          term: 'جامعه و تجربه کاربری (C&E)',
          category: 'providers',
          definition:
            'دامنه سازمان‌دهنده تعاملات، راهنمای فضاهای مجتمع، رویدادهای عمومی و مسیرهای تجربه ساکنان در ساختمان.',
        },
        {
          term: 'هوش عملیاتی (CLADORA Intelligence)',
          category: 'providers',
          definition:
            'لایه هوش مصنوعی کمکی که مقید به حدود اختیارات CORE و سیاست‌های انسانی عمل می‌کند و فاقد اختیار تصمیم‌گیری خودمختار است.',
        },
        {
          term: 'بسته کشوری (Country Pack)',
          category: 'composition',
          definition:
            'لایه انطباق با قوانین محلی که شامل واژگان بومی، شیوه‌های محاسبه شارژ و گزارش‌های رسمی منطقه‌ای است.',
        },
        {
          term: 'ساختار ساختمانی (Building DNA)',
          category: 'composition',
          definition:
            'الگوی کالبدی و فنی ملک (برج بلندمرتبه، شهرک ویلایی، مجتمع اداری، انبار لجستیک) که تعیین‌کننده ماژول‌های فعال است.',
        },
        {
          term: 'پروفایل ملک (Property Profile)',
          category: 'composition',
          definition:
            'پیکربندی اختصاصی هر ساختمان که از تلفیق گونه ساختمانی، نوع مالکیت و پیچیدگی‌های بهره‌برداری حاصل می‌شود.',
        },
        {
          term: 'الگوی بهره‌برداری (Operating Model)',
          category: 'composition',
          definition:
            'شیوه حاکمیت بر اداره ملک: هیئت‌مدیره خودگردان، برون‌سپاری به شرکت‌های تخصصی مدیریت یا اداره متمرکز سبد املاک.',
        },
        {
          term: 'پروفایل خدمات (Service Profile)',
          category: 'composition',
          definition:
            'حجم و تنوع خدمات فنی و عمومی قراردادشده برای ساختمان (نظیر سرویس آسانسور، نظافت، حفاظت فیزیکی و تاسیسات).',
        },
        {
          term: 'اصالت داده‌های مهاجرت (Migration Provenance)',
          category: 'governance',
          definition:
            'متادیتاهای منشأ همراه با داده‌های واردشده (سامانه قبلی، کلید اصلی اولیه، قاعده تبدیل، شناسه دسته، وضعیت تایید).',
        },
        {
          term: 'حاکمیت بر دسترسی‌پذیری (Availability Governance)',
          category: 'governance',
          definition:
            'چارچوب انضباط عمومی پلتفرم که مدل مفهومی، بلوغ کد در اجرا، دامنه پیاده‌سازی و دسترسی‌های کاربران را متمایز می‌سازد.',
        },
        {
          term: 'رسید اقدام (Action Receipt)',
          category: 'governance',
          definition:
            'رکورد ممیزی ثبت‌شده در پی اقداماتی نظیر تایید پرداخت یا اعلام کارکرد کنتور توأم با نام اقدام‌کننده، زمان دقیق و شواهد.',
        },
      ],
    },
  }[lang];

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
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
            <BookA className="w-3.5 h-3.5" />
            <span>{content.hero.badge}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#102A43] tracking-tight">
            {content.hero.title}
          </h1>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {content.hero.subtitle}
          </p>
        </div>

        {/* Governance Disclaimer Notice Box */}
        <div className="bg-white rounded-2xl p-6 sm:p-7 border border-[#D3DCE6] shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="font-bold text-[#102A43]">{content.disclaimer.title}</div>
            <div className="text-[#52667A] leading-relaxed">{content.disclaimer.text}</div>
          </div>
        </div>

        {/* Glossary Terms List */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-4">
            <div className="text-sm font-bold text-[#102A43]">
              {lang === 'ro'
                ? `Total termeni canonici definiți: ${content.terms.length}`
                : lang === 'fa'
                ? `مجموع اصطلاحات رسمی تعریف‌شده: ${content.terms.length}`
                : `Total canonical terms defined: ${content.terms.length}`}
            </div>
          </div>

          <dl className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.terms.map((item, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E2E8F0] shadow-sm hover:border-[#B2E5DF] transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  <dt className="text-base sm:text-lg font-bold text-[#102A43] flex items-center justify-between gap-2">
                    <span className="dir-auto">{item.term}</span>
                  </dt>
                  <dd className="text-xs sm:text-sm text-[#52667A] leading-relaxed mt-2.5">
                    {item.definition}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        {/* Bottom Navigation Bridges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6">
          <Link
            href={`/${lang}/platform/architecture`}
            className="p-6 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#0E9F8E] transition-all group"
          >
            <div className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider mb-2">
              {lang === 'ro' ? 'Arhitectura' : lang === 'fa' ? 'معماری' : 'Architecture'}
            </div>
            <div className="text-sm font-bold text-[#102A43] group-hover:text-[#0E9F8E] transition-colors flex items-center justify-between">
              <span>{lang === 'ro' ? 'Platform Architecture' : lang === 'fa' ? 'معماری پلتفرم' : 'Platform Architecture'}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </div>
          </Link>

          <Link
            href={`/${lang}/capabilities`}
            className="p-6 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#0E9F8E] transition-all group"
          >
            <div className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider mb-2">
              {lang === 'ro' ? 'Capabilități' : lang === 'fa' ? 'قابلیت‌ها' : 'Capabilities'}
            </div>
            <div className="text-sm font-bold text-[#102A43] group-hover:text-[#0E9F8E] transition-colors flex items-center justify-between">
              <span>{lang === 'ro' ? 'Capabilities Framework' : lang === 'fa' ? 'چارچوب قابلیت‌ها' : 'Capabilities Framework'}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </div>
          </Link>

          <Link
            href={`/${lang}/solutions`}
            className="p-6 bg-white rounded-2xl border border-[#E2E8F0] hover:border-[#0E9F8E] transition-all group"
          >
            <div className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider mb-2">
              {lang === 'ro' ? 'Soluții' : lang === 'fa' ? 'راهکارها' : 'Solutions'}
            </div>
            <div className="text-sm font-bold text-[#102A43] group-hover:text-[#0E9F8E] transition-colors flex items-center justify-between">
              <span>{lang === 'ro' ? 'Actor Solutions' : lang === 'fa' ? 'راهکارهای مخاطبان' : 'Actor Solutions'}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </div>
          </Link>
        </div>
      </div>
    </main>
  );
}
