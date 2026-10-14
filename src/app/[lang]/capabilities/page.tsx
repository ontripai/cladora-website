import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import { 
  Building2, 
  Layers, 
  Users, 
  FileText, 
  DollarSign, 
  Sparkles, 
  Wrench, 
  MessageSquare, 
  Compass, 
  Calendar, 
  RefreshCw, 
  ShieldCheck, 
  Bot, 
  ArrowRight, 
  CheckCircle2, 
  Workflow, 
  Database, 
  Sliders,
  Cpu
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
  return getRouteMetadata('/capabilities', params.lang);
}

export default async function CapabilitiesPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumb: { home: 'Acasă', current: 'Arhitectura Capabilităților' },
      hero: {
        badge: 'ARHITECTURA DE CAPABILITĂȚI CLADORA',
        title: 'Capabilități Care Partajează Aceeași Sursă de Adevăr',
        subtitle:
          'Capabilitățile CLADORA sunt compuse în jurul identității persistente a proprietății, granițelor de workspace, autorității contextuale și furnizorilor canonici, înlocuind silozurile de aplicații deconectate.',
        ctaPrimary: 'Explorează Arhitectura Platformei',
        ctaSecondary: 'Solicită Parteneriat',
      },
      visualModel: {
        badge: 'MODEL CONCEPTUAL DE CAPABILITĂȚI',
        title: 'Harta Relațională a Capabilităților Platformei',
        subtitle:
          'Fiecare capabilitate are un deținător de adevăr bine definit. Niciun domeniu nu își inventează propriul registru financiar sau propria identitate de proprietate.',
        tiers: [
          {
            name: 'CONTEXTUL PROPRIETĂȚII & ACTIVELOR FIZICE',
            role: 'Subiectul Persistent',
            desc: 'Parcelă Cadastrală → Corp de Clădire → Zone & Niveluri → Unități Demarcate → Echipamente & Contoare.',
            badge: 'Lumea Fizică',
          },
          {
            name: 'FUNDAȚIA CORE & AUTORITATE CONTEXTUALĂ',
            role: 'Granițe de Workspace & Guvernanță',
            desc: 'CORE: Identitate Resurse, Workspace-uri, Membri, Roluri, Relații, Mandate Temporale și Guvernanța Migrării.',
            badge: 'Context & Mandat',
          },
          {
            name: 'DOMENII OPERAȚIONALE CONECTATE (PEER ENGINES)',
            role: 'Fluxuri de Lucru Specializate',
            desc: 'AIRPROP (Comercial) | SERVICE (Furnizori & Cereri) | OPERAȚIUNI (Mentenanță) | COMUNITATE & EXPERIENȚĂ (Locuire & Rezidenți).',
            badge: 'Rang Egal Arhitectural',
          },
          {
            name: 'FURNIZORI CANONICI DE SERVICII',
            role: 'Sursă Unică de Adevăr',
            desc: 'DOCUMENTS/VAULT (Arhivă & Seif Tehnic) • FIN01 (Registru Financiar & Plăți) • BK01 (Capacitate & Timp) • COMUNICAȚII • AUDIT.',
            badge: 'Adevăr Canonic Unic',
          },
          {
            name: 'STRATURI GUVERNATE TRANSVERSALE',
            role: 'Integritate & Inteligență',
            desc: 'Migrare & Continuitate Controlată • Securitate & Zero-Write Denial • CLADORA Intelligence (Orchestrare Guvernată).',
            badge: 'Integritate & Politici',
          },
        ],
        boundariesNote:
          'Regulă de graniță inviolabilă: FIN01 este furnizorul canonic financiar (decuplat de CORE și SERVICE). BK01 deține adevărul capacității de rezervare (consumat de C&E și SERVICE). AIRPROP consumă identitatea comună a proprietății fără a crea evidențe paralele.',
      },
      foundation: {
        badge: 'FAMILIA 01 — FUNDAȚIE & IDENTITATE',
        title: 'Fundația CORE: Workspace, Oameni & Mandate Contextuale',
        desc: 'Fundația sistemului structurează mediul operațional. Un workspace este o graniță juridică și operațională, nu doar un cont de utilizator. Autoritatea derivă strict dintr-un mandat validat, delimitat în spațiu și timp.',
        points: [
          { title: 'Delimitare la Nivel de Workspace', desc: 'Arhitectură concepută pentru a izola logic datele fiecărei organizații sau asociații.' },
          { title: 'Autoritate Contextuală (Rol != Autoritate)', desc: 'Un rol fără mandat legal verificabil nu conferă drepturi de mutație asupra datelor.' },
          { title: 'Identitate Unică Persistentă', desc: 'Proprietatea fizică rămâne ancora neschimbată a evidențelor, indiferent de rotația echipelor.' },
        ],
      },
      commercial: {
        badge: 'FAMILIA 02 — CICLUL COMERCIAL',
        title: 'AIRPROP: Semantica Ciclului de Viață Comercial',
        desc: 'AIRPROP este conceput pentru a structura semantica fluxurilor comerciale și de investiții fără a crea o identitate paralelă de activ: modelarea antecontractelor, inventar comercial, contracte de locațiune, mandate de reprezentare și puntea către predare.',
        items: [
          { title: 'Pre-vânzări & Oportunități', desc: 'Evidența cererilor calificate, urmărirea avansurilor și opțiunile de personalizare.' },
          { title: 'Gestiunea Inventarului Disponibil', desc: 'Corelarea unităților libere, rezervate sau închiriate pe baza topologiei din CORE.' },
          { title: 'Contracte de Închiriere & Mandate', desc: 'Administrarea termenelor de locațiune și a drepturilor comerciale de reprezentare.' },
          { title: 'Punte de Continuitate către Predare', desc: 'Transferul organizat al istoricului comercial direct în dosarul de exploatare al imobilului.' },
        ],
      },
      operations: {
        badge: 'FAMILIA 03 — OPERAȚIUNI & SERVICII',
        title: 'SERVICE & OPERAȚIUNI: De la Intenție la Execuție în Teren',
        desc: 'Domeniile SERVICE și OPERAȚIUNI sunt concepute să funcționeze sincronizat: SERVICE structurează formularea cererilor și coordonarea furnizorilor, iar OPERAȚIUNI este proprietarul canonic al execuției comenzilor de lucru și registrului de echipamente.',
        serviceSide: {
          title: 'SERVICE (Intenție & Coordonare)',
          desc: 'Formularea cererilor structurate, compararea ofertelor concurențiale de preț/timp, emiterea comenzilor și recepția formală. Evenimentele financiare sunt consemnate exclusiv în FIN01.',
          tags: ['Catalog de Servicii', 'Comparare Devize', 'Comenzi de Serviciu', 'Recepție Lucrări'],
        },
        opsSide: {
          title: 'OPERAȚIUNI (Mentenanță Tehnică)',
          desc: 'Registrul echipamentelor tehnice (centrale, ascensoare, pompe), planuri de revizii periodice, dispecerat de tichete de incident și jurnale de intervenție la fața locului.',
          tags: ['Registru Echipamente', 'Revizii Preventive', 'Tichete & Dispecerat', 'Jurnal Tehnic Activ'],
        },
      },
      communityGov: {
        badge: 'FAMILIA 04 — OAMENI, COMUNITATE & GUVERNANȚĂ',
        title: 'Comunitate, Experiență & Comunicații Operaționale',
        desc: 'Comunitate & Experiență (C&E) este un domeniu peer de prim rang, dedicat vieții de zi cu zi a locatarilor. Comunicațiile operaționale și consemnarea deciziilor asigură trasabilitatea organizării.',
        ceSide: {
          title: 'Comunitate & Experiență (C&E)',
          desc: 'Compoziția experienței de locuire, ghiduri de orientare spațială, avizier digital comunitar, solicitări curente și acces la facilități comune.',
        },
        commsSide: {
          title: 'Comunicații Operaționale & Decizii',
          desc: 'Canale securizate de notificare, avize operaționale, consemnarea deciziilor adunării și procese-verbale cu arhivare trasabilă.',
        },
      },
      canonicalProviders: {
        badge: 'FAMILIA 05 — FURNIZORI CANONICI',
        title: 'FIN01, DOCUMENTS / VAULT & BK01: Adevărul Canonic Decuplat',
        desc: 'Trei piloni canonic decuplați asigură rigoarea tranzacțională a întregului sistem, prevenind conflictele de date și logica duplicată.',
        providers: [
          {
            code: 'FIN01',
            name: 'Registru Financiar Canonic',
            desc: 'Partidă dublă analitică, reconciliere bancară, repartizare cheltuieli pe cote-părți și generarea notelor de plată. Decuplat strict de CORE și SERVICE.',
            icon: DollarSign,
          },
          {
            code: 'DOCUMENTS',
            name: 'Arhivă & Seif Tehnic',
            desc: 'Sursa unică de adevăr pentru documente tehnice, contracte, devize, cărți ale construcției și etichete sigure de integritate.',
            icon: FileText,
          },
          {
            code: 'BK01',
            name: 'Capacitate & Rezervare Timp',
            desc: 'Motorul centralizat de disponibilitate pentru spații comune, facilități și programări de intervenții tehnice. Consumat de C&E și SERVICE.',
            icon: Calendar,
          },
        ],
      },
      trustMigration: {
        badge: 'FAMILIA 06 — CONTINUITATE, SECURITATE & AUDIT',
        title: 'Migrare Controlată, Piste de Audit & Disciplina Zero-Write Denial',
        desc: 'Tranzițiile istorice și securitatea datelor sunt guvernate structural. Datele sunt protejate împotriva modificărilor neautorizate prin bariere arhitecturale stricte.',
        pillars: [
          {
            title: 'Migrare & Continuitate Tranzacțională',
            desc: 'Pipeline controlat de tranziție: Sursă → Mapare → Transformare → Validare → Ingestie → Reconciliere → Proveniență. Fără importuri brute neverificate.',
          },
          {
            title: 'Principiul Zero-Write Denial',
            desc: 'Atunci când autoritatea sau mandatul legal nu pot fi stabilite în mod verificabil, arhitectura impune refuzul oricărei mutații de stare.',
          },
          {
            title: 'Pistă de Audit Aditivă',
            desc: 'Jurnal cronologic aditiv pentru toate subsistemele. Mutațiile generează înregistrări ordonate pentru trasabilitate completă în timp.',
          },
          {
            title: 'Idempotență & Rollback',
            desc: 'Fluxurile de date sunt proiectate în jurul cerințelor de idempotență pentru a reduce riscul de tranziții duplicate sau inconsistente.',
          },
        ],
      },
      intelligence: {
        badge: 'FAMILIA 07 — INTELIGENȚĂ ORCHESTRATĂ',
        title: 'CLADORA Intelligence: Orchestrare Subordonată Autorității Umane',
        desc: 'Asistența AI nu creează drepturi juridice, nu reinterpretează adevărul canonic și nu deține permisiuni autonome de scriere în registrele financiare. Orice propunere operațională parcurge un flux strict în 6 etape.',
        steps: [
          { num: '01', name: 'Context', desc: 'Identifică entitățile, spațiile și workspace-ul relevant.' },
          { num: '02', name: 'Intent', desc: 'Clarifică obiectivul cererii formulate de utilizator.' },
          { num: '03', name: 'Authority', desc: 'Verifică dacă utilizatorul deține mandatul necesar.' },
          { num: '04', name: 'Plan', desc: 'Formulează propunerea de acțiune și impactul estimat.' },
          { num: '05', name: 'Action', desc: 'Execută mutația doar după aprobarea umană explicită.' },
          { num: '06', name: 'Receipt', desc: 'Consemnează recipisa acțiunii în jurnalul de audit.' },
        ],
      },
      composition: {
        badge: 'ARHITECTURĂ COMPOZABILĂ',
        title: 'Compoziția Capabilităților: Fără Fork-uri de Cod',
        desc: 'Organizațiile nu au nevoie de aplicații software diferite pentru fiecare tip de proprietate. CLADORA se adaptează prin dimensiuni compozabile ortogonale:',
        dimensions: [
          { title: 'Profil de Proprietate', desc: 'Rezidențial, birouri, retail, industrial/logistic, mixt, ospitalitate.' },
          { title: 'Model de Operare', desc: 'Autoadministrare HOA, companie de property management, portofoliu investitor.' },
          { title: 'Building DNA', desc: 'Bloc urban clasic, ansamblu rezidențial, clădire turn, parc de afaceri.' },
          { title: 'Profil de Servicii', desc: 'Mentenanță tehnică, salubritate, pază, recepție, spații verzi.' },
          { title: 'Country Pack', desc: 'Reguli statutare locale, formule de calcul, șabloane de procese-verbale.' },
          { title: 'Domenii Conectate', desc: 'Activarea selectivă a AIRPROP, SERVICE, OPERAȚIUNI sau C&E conform necesarului.' },
          { title: 'Roluri Autorizate', desc: 'Mandate contextuale configurate strict pe perimetrul de responsabilitate.' },
        ],
      },
      availability: {
        badge: 'GUVERNANȚA DISPONIBILITĂȚII',
        title: 'Cadrul de Disponibilitate al Capabilităților',
        desc: 'Arhitectura CLADORA este proiectată la o scară mai largă decât o implementare individuală. Disponibilitatea specifică a fluxurilor depinde de domeniile activate, profilul imobiliar, pachetul de țară configurat, stadiul de lansare și perimetrul contractual agreat.',
        note: 'Pentru a asigura o funcționare stabilă și verificabilă, capabilitățile sunt puse la dispoziție gradual în baza validării cerințelor operaționale locale.',
      },
      cta: {
        title: 'Explorează în Profunzime Arhitectura CLADORA',
        desc: 'Descoperă modelul decuplat pe 4 niveluri, continuitatea ciclului de viață sau arhitectura de securitate și încredere.',
        archLink: 'Arhitectura de Sistem Detaliată',
        trustLink: 'Arhitectura de Încredere & Audit',
        partnerLink: 'Solicită Parteneriat',
      },
    },
    en: {
      breadcrumb: { home: 'Home', current: 'Capabilities Architecture' },
      hero: {
        badge: 'CLADORA CAPABILITIES ARCHITECTURE',
        title: 'Capabilities That Share the Same Truth',
        subtitle:
          'CLADORA capabilities are composed around persistent property identity, workspace boundaries, contextual authority, and canonical providers instead of disconnected application silos.',
        ctaPrimary: 'Explore Platform Architecture',
        ctaSecondary: 'Start Partnership',
      },
      visualModel: {
        badge: 'CONCEPTUAL CAPABILITY MODEL',
        title: 'Relational Map of Platform Capabilities',
        subtitle:
          'Every capability has a well-defined authoritative owner. No operational domain invents its own financial ledger or property identity.',
        tiers: [
          {
            name: 'PHYSICAL PROPERTY & ASSET CONTEXT',
            role: 'Persistent Physical Subject',
            desc: 'Cadastral Plot → Building Shell → Functional Zones → Demised Units → Technical Assets & Utility Meters.',
            badge: 'Physical World',
          },
          {
            name: 'CORE FOUNDATION & CONTEXTUAL AUTHORITY',
            role: 'Workspace Boundaries & Governance',
            desc: 'CORE: Resource Identifiers, Workspaces, Memberships, Roles, Relationships, Temporal Mandates, and Migration Governance.',
            badge: 'Context & Mandate',
          },
          {
            name: 'CONNECTED OPERATIONAL DOMAINS (PEER ENGINES)',
            role: 'Specialized Workflow Execution',
            desc: 'AIRPROP (Commercial) | SERVICE (Procurement & Briefs) | OPERATIONS (Maintenance) | COMMUNITY & EXPERIENCE (Living Journeys).',
            badge: 'Architectural Peer Rank',
          },
          {
            name: 'CANONICAL SHARED PROVIDERS',
            role: 'Single Source of Truth',
            desc: 'DOCUMENTS/VAULT (Technical Archive & Evidence) • FIN01 (Financial Ledger & Payments) • BK01 (Capacity & Time) • COMMUNICATIONS • AUDIT.',
            badge: 'Single Canonical Truth',
          },
          {
            name: 'GOVERNED CROSS-CUTTING LAYERS',
            role: 'Integrity & Intelligence',
            desc: 'Controlled Migration & Provenance • Zero-Write Denial & Rollback Discipline • CLADORA Intelligence (Governed Orchestration).',
            badge: 'Integrity & Policy',
          },
        ],
        boundariesNote:
          'Inviolable architectural rule: FIN01 is the canonical financial provider (strictly decoupled from CORE and SERVICE). BK01 owns capacity and reservation truth (consumed by C&E and SERVICE). AIRPROP operates on shared property identity without creating parallel asset records.',
      },
      foundation: {
        badge: 'FAMILY 01 — FOUNDATION & IDENTITY',
        title: 'CORE Foundation: Workspaces, People & Contextual Mandates',
        desc: 'The platform foundation structures operational reality. A workspace represents a legal, operational, and compliance boundary—not merely a software tenant account. Authority is contextual, derived from verifiable legal mandates bounded in space and time.',
        points: [
          { title: 'Workspace-Scoped Isolation', desc: 'Architecture designed to enforce logical boundaries between distinct organizational entities.' },
          { title: 'Contextual Authority (Role != Authority)', desc: 'A role without an active, verified temporal mandate conveys zero state mutation rights.' },
          { title: 'Persistent Asset Identity', desc: 'The physical building endures as the persistent anchor across management transitions.' },
        ],
      },
      commercial: {
        badge: 'FAMILY 02 — COMMERCIAL LIFECYCLE',
        title: 'AIRPROP: Commercial & Real Estate Lifecycle Semantics',
        desc: 'AIRPROP is designed to structure commercial lifecycle semantics without creating duplicate property records: pre-sale reservation modeling, commercial inventory tracking, tenancy agreements, agency mandates, and the bridge to handover.',
        items: [
          { title: 'Pre-Sales & Lead Pipeline', desc: 'Tracking qualified inquiries, down payments, and structural customization briefs.' },
          { title: 'Commercial Inventory Allocation', desc: 'Connecting available, reserved, or leased spaces directly to canonical unit topologies.' },
          { title: 'Tenancy Agreements & Mandates', desc: 'Administering contractual lease terms and authorized property management mandates.' },
          { title: 'Seamless Handover Connection', desc: 'Transitioning commercial deal history cleanly into living operational building records.' },
        ],
      },
      operations: {
        badge: 'FAMILY 03 — OPERATIONS & SERVICE',
        title: 'SERVICE & OPERATIONS: From Service Intent to Field Execution',
        desc: 'SERVICE and OPERATIONS are designed to operate in lockstep: SERVICE structures request briefs and contractor coordination, while OPERATIONS is the canonical owner of technical equipment registries and work order execution.',
        serviceSide: {
          title: 'SERVICE (Intent & Coordination)',
          desc: 'Structured request briefs, side-by-side quote comparisons, work order issuance, and milestone delivery sign-offs. Financial transactions reference FIN01.',
          tags: ['Service Catalog', 'Quote Comparison', 'Service Orders', 'Milestone Delivery'],
        },
        opsSide: {
          title: 'OPERATIONS (Facility Maintenance)',
          desc: 'Registries for critical plant (elevators, HVAC, pumps), scheduled preventive maintenance plans, fault ticket triage, and on-site technician logs.',
          tags: ['Asset Registries', 'Preventive Schedules', 'Fault Ticketing', 'Field Execution Logs'],
        },
      },
      communityGov: {
        badge: 'FAMILY 04 — PEOPLE, COMMUNITY & GOVERNANCE',
        title: 'Community, Living Experience & Governance Communications',
        desc: 'Community & Experience (C&E) is an architectural peer domain dedicated to occupant daily life. Governance communications and decision logging provide operational stewardship.',
        ceSide: {
          title: 'Community & Experience (C&E)',
          desc: 'Occupant living journeys, spatial orientation guides, digital community notice boards, everyday service inquiries, and shared amenity access.',
        },
        commsSide: {
          title: 'Operational & Governance Communications',
          desc: 'Secure notification channels, operational notices, meeting agendas, and auditable records of collective decisions.',
        },
      },
      canonicalProviders: {
        badge: 'FAMILY 05 — CANONICAL PROVIDERS',
        title: 'FIN01, DOCUMENTS / VAULT & BK01: Decoupled Canonical Truth',
        desc: 'Three independent canonical subsystems provide transactional integrity across the platform, eliminating conflicting data models and duplicate application logic.',
        providers: [
          {
            code: 'FIN01',
            name: 'Canonical Financial Ledger',
            desc: 'Analytical double-entry ledgers, banking feed matching, statutory cost-sharing allocations, and payment receipts. Decoupled from CORE and SERVICE.',
            icon: DollarSign,
          },
          {
            code: 'DOCUMENTS',
            name: 'Technical Vault & Evidence',
            desc: 'The single source of truth for architectural blueprints, contracts, contractor quotes, building passports, and safe integrity labels.',
            icon: FileText,
          },
          {
            code: 'BK01',
            name: 'Capacity & Scheduling Engine',
            desc: 'Centralized availability engine for spatial facilities, shared amenities, and maintenance visit windows. Consumed by C&E and SERVICE.',
            icon: Calendar,
          },
        ],
      },
      trustMigration: {
        badge: 'FAMILY 06 — CONTINUITY, SECURITY & AUDIT',
        title: 'Governed Migration, Audit Event Trails & Zero-Write Denial',
        desc: 'Historical transitions and system security are governed by design. Data integrity is protected against unauthorized mutations through strict architectural invariants.',
        pillars: [
          {
            title: 'Governed Migration & Continuity',
            desc: 'Controlled transition pipeline: Source → Mapping → Transformation → Validation → Ingestion → Reconciliation → Provenance. Never raw, unverified data dumps.',
          },
          {
            title: 'Zero-Write Denial Principle',
            desc: 'When operational authority or verifiable legal mandates cannot be established, the architecture requires state mutation to be denied.',
          },
          {
            title: 'Append-Only Event Stream',
            desc: 'Chronological append-only event records across subsystems, preserving unbroken historical provenance for auditing and compliance.',
          },
          {
            title: 'Idempotency & Rollback Discipline',
            desc: 'Mutation flows are designed around idempotency and rollback requirements to reduce duplicate or inconsistent state transitions.',
          },
        ],
      },
      intelligence: {
        badge: 'FAMILY 07 — GOVERNED INTELLIGENCE',
        title: 'CLADORA Intelligence: Orchestration Subordinated to Human Authority',
        desc: 'AI assistance cannot independently create legal rights, redefine provider truth, or autonomously mutate canonical ledgers. Operational proposals strictly follow a 6-stage governed lifecycle.',
        steps: [
          { num: '01', name: 'Context', desc: 'Resolves physical assets, functional units, and active workspace boundaries.' },
          { num: '02', name: 'Intent', desc: 'Structures the explicit objective requested by the authorized user.' },
          { num: '03', name: 'Authority', desc: 'Verifies the user’s active mandate and spatial jurisdiction.' },
          { num: '04', name: 'Plan', desc: 'Constructs the proposed action plan and estimates operational impact.' },
          { num: '05', name: 'Action', desc: 'Executes mutations only upon explicit, authorized human confirmation.' },
          { num: '06', name: 'Receipt', desc: 'Emits an auditable event receipt recorded in the canonical event journal.' },
        ],
      },
      composition: {
        badge: 'COMPOSABLE ARCHITECTURE',
        title: 'Capability Composition: Configurability Without Code Forks',
        desc: 'Enterprises do not need distinct codebases for different property portfolios. CLADORA configures dynamically along orthogonal architectural dimensions:',
        dimensions: [
          { title: 'Property Profile', desc: 'Residential estates, commercial offices, retail centers, logistics parks, mixed-use, hospitality.' },
          { title: 'Operating Model', desc: 'Self-managed HOA, third-party facility manager, institutional portfolio investor.' },
          { title: 'Building DNA', desc: 'Historic masonry block, insulated panel building, high-rise tower, suburban business park.' },
          { title: 'Service Profile', desc: 'Technical facilities, janitorial services, physical security, concierge, landscaping.' },
          { title: 'Country Pack', desc: 'Jurisdiction-specific compliance schemas, statutory allocation rules, and ballot templates.' },
          { title: 'Enabled Domains', desc: 'Selective activation of AIRPROP, SERVICE, OPERATIONS, or C&E per operational need.' },
          { title: 'Authorized Roles', desc: 'Contextual mandates configured strictly to the operational perimeter of responsibility.' },
        ],
      },
      availability: {
        badge: 'AVAILABILITY GOVERNANCE',
        title: 'Capability Availability Framework',
        desc: 'CLADORA’s architecture is broader than any individual deployment. The availability of individual capabilities depends on configured domains, property context, country pack, integration scope, release status, and customer implementation scope.',
        note: 'To ensure stable, verified operations, capabilities are provisioned progressively based on validated jurisdictional and technical prerequisites.',
      },
      cta: {
        title: 'Deepen Your Architecture Understanding',
        desc: 'Explore the 4-tier decoupled system model, inspect the non-linear property lifecycle, or review platform security and trust specifications.',
        archLink: 'Deep System Architecture',
        trustLink: 'Trust & Governance Architecture',
        partnerLink: 'Start Partnership',
      },
    },
    fa: {
      breadcrumb: { home: 'صفحه اصلی', current: 'معماری قابلیت‌ها' },
      hero: {
        badge: 'معماری قابلیت‌های پلتفرم کلادورا',
        title: 'قابلیت‌هایی که از یک حقیقت مشترک سرچشمه می‌گیرند',
        subtitle:
          'قابلیت‌های پلتفرم کلادورا بر محور هویت پایدار ملک، مرزهای مستقل ورک‌اسپیس، اختیارات بر مبنای مجوز قانونی و متولیان اصلی داده‌ها بنا شده‌اند؛ نه برنامه‌های جزیره‌ای و جدا از هم.',
        ctaPrimary: 'مشاهدهٔ معماری پلتفرم',
        ctaSecondary: 'درخواست شروع همکاری',
      },
      visualModel: {
        badge: 'مدل مفهومی قابلیت‌ها',
        title: 'نقشهٔ ارتباطی قابلیت‌های پلتفرم کلادورا',
        subtitle:
          'هر قابلیت دارای یک متولی معتبر و منحصربه‌فرد است. هیچ دامنهٔ عملیاتی دفتر مالی موازی یا هویت جداگانه‌ای برای ملک ایجاد نمی‌کند.',
        tiers: [
          {
            name: 'بستر ملک و دارایی‌های فیزیکی',
            role: 'موضوع پایدار فیزیکی',
            desc: 'عرصه و پلاک ثبتی ← سازه ساختمان ← طبقات و زون‌ها ← واحدهای مستقل ← تجهیزات فنی و کنتورها.',
            badge: 'دنیای فیزیکی',
          },
          {
            name: 'زیرساخت CORE و اختیارات زمینه‌ای',
            role: 'مرزهای ورک‌اسپیس و حاکمیت داده‌ها',
            desc: 'CORE: شناسه منابع، ورک‌اسپیس‌ها، اعضا، نقش‌ها، روابط حقوقی، مجوزهای زمان‌دار و ضوابط مهاجرت داده‌ها.',
            badge: 'زمینه و مجوز',
          },
          {
            name: 'دامنه‌های متصل عملیاتی (موتورهای هم‌تراز)',
            role: 'گردش‌کارهای تخصصی اجرایی',
            desc: 'ایرپراپ (معاملات تجاری) | سرویس (اعلام نیاز و پیمانکاران) | عملیات فنی (نگهداری تاسیسات) | جامعه و تجربه (سکونت).',
            badge: 'جایگاه هم‌تراز معماری',
          },
          {
            name: 'ارائه‌دهندگان مرجع داده‌ها (CANONICAL PROVIDERS)',
            role: 'حقیقت واحد داده‌ها',
            desc: 'DOCUMENTS/VAULT (بایگانی مدارک فنی) • FIN01 (دفتر مالی و پرداخت) • BK01 (تقویم و ظرفیت) • مکاتبات • ممیزی.',
            badge: 'حقیقت واحد داده‌ها',
          },
          {
            name: 'لایه‌های حاکمیتی و نظارتی',
            role: 'یکپارچگی و هوشمندی',
            desc: 'مهاجرت و انتقال ساختاریافته • اصل عدم تغییر بدون مجوز (Zero-Write Denial) • هوش عملیاتی کلادورا (Orchestration).',
            badge: 'حاکمیت و ضوابط',
          },
        ],
        boundariesNote:
          'اصل قطعی معماری: FIN01 متولی کانونی امور مالی است (کاملاً تفکیک‌شده از CORE و SERVICE). BK01 متولی حقیقت تقویم و ظرفیت است (مورداستفاده در C&E و SERVICE). ایرپراپ بر بستر هویت مشترک دارایی عمل کرده و سوابق موازی ایجاد نمی‌کند.',
      },
      foundation: {
        badge: 'خانوادهٔ ۰۱ — زیرساخت و هویت',
        title: 'زیرساخت CORE: ورک‌اسپیس، افراد و مجوزهای زمان‌دار',
        desc: 'زیرساخت سیستم واقعیت‌های عملیاتی را شکل می‌دهد. ورک‌اسپیس یک مرز حقوقی، عملیاتی و امنیتی است؛ نه صرفاً یک حساب کاربری ساده. اختیار اجرایی همواره مبتنی بر مجوزی معتبر، دارای محدوده مکانی مشخص و مقید به زمان است.',
        points: [
          { title: 'الگوی تفکیک ورک‌اسپیس', desc: 'معماری طراحی‌شده برای اعمال مرزهای منطقی میان داده‌های سازمان‌ها و مجتمع‌های مختلف.' },
          { title: 'اختیارات زمینه‌ای (نقش != اختیار)', desc: 'یک نقش فاقد مجوز معتبر و زمان‌دار، هیچ‌گونه حقی برای تغییر داده‌ها ایجاد نمی‌کند.' },
          { title: 'هویت پایدار دارایی', desc: 'ملک فیزیکی لنگرگاه ماندگار کلیه سوابق باقی می‌ماند و با تغییر مدیران تغییر نمی‌کند.' },
        ],
      },
      commercial: {
        badge: 'خانوادهٔ ۰۲ — چرخهٔ تجاری ملک',
        title: 'AIRPROP: مفاهیم چرخهٔ تجاری و سرمایه‌گذاری املاک',
        desc: 'ایرپراپ برای ساختاردهی به منطق چرخه تجاری ملک بدون ایجاد پرونده‌های موازی طراحی شده است: مدل‌سازی پیش‌فروش، رزرو واحدها، قراردادهای اجاره، واگذاری مدیریت و انتقال به مرحله بهره‌برداری.',
        items: [
          { title: 'پیش‌فروش و مدیریت متقاضیان', desc: 'پیگیری فرصت‌های واجد شرایط، پیش‌پرداخت‌ها و مشخصات فنی انتخاب‌شده.' },
          { title: 'مدیریت موجودی فضاها', desc: 'تطبیق واحدهای آزاد، رزروشده یا اجاره‌داده‌شده با توپولوژی پایه در CORE.' },
          { title: 'قراردادهای اجاره و نمایندگی', desc: 'مدیریت شرایط قراردادهای اجاره و حدود اختیارات کارگزاری مدیریت ملک.' },
          { title: 'انتقال پیوسته به بهره‌برداری', desc: 'انتقال ساختاریافته تاریخچهٔ تجاری به پروندهٔ بهره‌برداری فعال ساختمان.' },
        ],
      },
      operations: {
        badge: 'خانوادهٔ ۰۳ — عملیات فنی و خدمات',
        title: 'سرویس و عملیات فنی: از اعلام نیاز تا اجرای میدانی',
        desc: 'دامنه‌های SERVICE و OPERATIONS برای عملکرد هماهنگ طراحی شده‌اند: سرویس ساختاردهی به درخواست‌ها و هماهنگی با پیمانکاران را هدایت می‌کند و عملیات فنی متولی رسمی ثبت تجهیزات و اجرای دستورکارهاست.',
        serviceSide: {
          title: 'سرویس (اعلام نیاز و هماهنگی)',
          desc: 'ثبت نیازهای فنی، استعلام و مقایسه پیشنهادها، صدور دستورکار و تایید نهایی کار انجام‌شده. رویدادهای مالی منحصراً در FIN01 ثبت می‌گردند.',
          tags: ['کاتالوگ خدمات', 'مقایسه پیشنهادها', 'دستورکار خدمات', 'تایید تحویل'],
        },
        opsSide: {
          title: 'عملیات فنی (نگهداری تأسیسات)',
          desc: 'شناسنامه تجهیزات مادر (آسانسورها، موتورخانه، پمپ‌ها)، برنامه‌ریزی سرویس‌های دوره‌ای، ارجاع تیکت‌های خرابی و گزارش‌های تکنسین‌ها.',
          tags: ['شناسنامه تجهیزات', 'برنامه سرویس', 'ارجاع تیکت‌ها', 'گزارش تکنسین'],
        },
      },
      communityGov: {
        badge: 'خانوادهٔ ۰۴ — جامعه، ساکنان و حاکمیت جمعی',
        title: 'جامعه، تجربه زیست و مکاتبات عملیاتی',
        desc: 'جامعه و تجربه (C&E) به عنوان یک دامنهٔ هم‌تراز، بر تسهیل زندگی روزمرهٔ ساکنان تمرکز دارد. مکاتبات عملیاتی و ثبت تصمیمات جمعی، شفافیت مدیریتی را تضمین می‌کنند.',
        ceSide: {
          title: 'جامعه و تجربه (C&E)',
          desc: 'مسیرهای تعاملی ساکنان، راهنمای فضاهای مشاع، تابلوی اعلانات دیجیتال، درخواست‌های روزمره و دسترسی به امکانات مشترک.',
        },
        commsSide: {
          title: 'مکاتبات عملیاتی و تصمیمات جمعی',
          desc: 'کانال‌های امن پیام‌رسانی، اطلاعیه‌های عملیاتی، دستور جلسات و ثبت مستند تصمیمات جمعی.',
        },
      },
      canonicalProviders: {
        badge: 'خانوادهٔ ۰۵ — ارائه‌دهندگان مرجع داده‌ها',
        title: 'FIN01، بایگانی اسناد و BK01: حقیقت کانونی مستقل',
        desc: 'سه زیرسیستم مرجع مستقل سلامت تراکنش‌ها را در کل پلتفرم تضمین می‌کنند و از بروز تداخل اطلاعات و کدهای موازی جلوگیری می‌نمایند.',
        providers: [
          {
            code: 'FIN01',
            name: 'دفتر مالی و حسابداری کانونی',
            desc: 'حسابداری دوبل تحلیلی، تطبیق تراکنش‌های بانکی، تسهیم قانونی شارژ و صدور قبوض. کاملاً تفکیک‌شده از CORE و SERVICE.',
            icon: DollarSign,
          },
          {
            code: 'DOCUMENTS',
            name: 'بایگانی و مدارک فنی',
            desc: 'مرجع رسمی نقشه‌های ساختمانی، قراردادها، ضمانت‌نامه‌ها، شناسنامه فنی ملک و برچسب‌های امنیتی اعتبارسنجی فایل‌ها.',
            icon: FileText,
          },
          {
            code: 'BK01',
            name: 'موتور تقویم، زمان و ظرفیت',
            desc: 'مرجع متمرکز برای رزرو فضاها، نوبت‌دهی خدمات و زمان‌بندی بازدیدهای فنی. مورداستفاده در بخش‌های C&E و SERVICE.',
            icon: Calendar,
          },
        ],
      },
      trustMigration: {
        badge: 'خانوادهٔ ۰۶ — پیوستگی، امنیت و ممیزی',
        title: 'مهاجرت ساختاریافته، لاگ ممیزی و اصل عدم تغییر بدون مجوز',
        desc: 'انتقال سوابق تاریخی و امنیت سیستم بر پایه اصول ساختاری هدایت می‌شوند. داده‌ها در برابر تغییرات غیرمجاز توسط موانع دقیق معماری محافظت می‌گردند.',
        pillars: [
          {
            title: 'مهاجرت داده‌ها و پیوستگی تاریخی',
            desc: 'فرآیند کنترل‌شدهٔ انتقال: مبدا ← نگاشت ← تبدیل ← اعتبارسنجی ← ثبت در سیستم ← تطبیق دفاتر ← حفظ اصالت سوابق. ورود داده‌های خام و بدون اعتبارسنجی ممنوع است.',
          },
          {
            title: 'اصل عدم تغییر بدون مجوز (Zero-Write Denial)',
            desc: 'هنگامی که حدود اختیارات یا مجوز قانونی قابل احراز نباشد، معماری سامانه الزام می‌کند که هرگونه درخواست تغییر داده‌ها رد شود.',
          },
          {
            title: 'ثبت ترتیبی و افزایشی رویدادها',
            desc: 'لاگ ترتیبی و افزایشی کلیه رویدادهای سیستمی جهت حفظ قابلیت ردیابی تاریخی برای اهداف نظارتی و ممیزی.',
          },
          {
            title: 'انضباط بازگشت‌پذیری و Idempotency',
            desc: 'طراحی گردش‌کارها بر اساس الزامات idempotență و Rollback جهت کاهش ریسک ایجاد تراکنش‌های تکراری یا وضعیت‌های متناقض.',
          },
        ],
      },
      intelligence: {
        badge: 'خانوادهٔ ۰۷ — هوشمندی مقید به سیاست‌ها',
        title: 'هوش عملیاتی کلادورا: هدایت مقید به نظارت و تایید انسان',
        desc: 'هوش مصنوعی هیچ حقی ایجاد نمی‌کند، حقیقت داده‌های مرجع را دور نمی‌زند و دسترسی مستقلی برای دستکاری دفاتر مالی ندارد. کلیه پیشنهادها در قالب چرخهٔ شش‌مرحله‌ای منضبط پردازش می‌شوند.',
        steps: [
          { num: '۰۱', name: 'زمینه (Context)', desc: 'شناسایی دارایی‌ها، واحدها و مرزهای ورک‌اسپیس فعال.' },
          { num: '۰۲', name: 'قصد (Intent)', desc: 'فرموله‌کردن هدف مشخص کاربر مجاز از درخواست.' },
          { num: '۰۳', name: 'اختیار (Authority)', desc: 'احراز اعتبار مجوز و محدودهٔ صلاحیت مکانی کاربر.' },
          { num: '۰۴', name: 'طرح (Plan)', desc: 'تدوین برنامهٔ اقدام پیشنهادی و برآورد اثرات عملیاتی.' },
          { num: '۰۵', name: 'اقدام (Action)', desc: 'اجرای دستور تنها پس از تایید صریح و آگاهانه کاربر مجاز.' },
          { num: '۰۶', name: 'سند ممیزی (Receipt)', desc: 'صدور رسید مستند و ثبت نهایی اقدام در لاگ ممیزی.' },
        ],
      },
      composition: {
        badge: 'معماری ترکیب‌پذیر',
        title: 'ترکیب‌پذیری قابلیت‌ها: انطباق بدون انشعاب کد',
        desc: 'سازمان‌ها برای انواع گوناگون املاک نیازی به سامانه‌های نرم‌افزاری مجزا ندارند؛ کلادورا از طریق ابعاد مستقل و ترکیب‌پذیر پیکربندی می‌شود:',
        dimensions: [
          { title: 'نوع کاربری ملک', desc: 'مسکونی، اداری، تجاری، لجستیک و صنعتی، چندمنظوره، اقامتی.' },
          { title: 'مدل بهره‌برداری', desc: 'اداره توسط مالکان، شرکت مدیریت پیمانکاری، سرمایه‌گذار و مالک عمده.' },
          { title: 'تیپولوژی سازه (DNA)', desc: 'بلوک‌های شهری، برج‌های بلندمرتبه، شهرک‌ها، پارک‌های تجاری.' },
          { title: 'پروفایل خدمات', desc: 'تأسیسات فنی، نظافت، حراست فیزیکی، تشریفات، فضای سبز.' },
          { title: 'پک کشوری (Country Pack)', desc: 'قوانین ملی، فرمول‌های قانونی شارژ، شابلون‌های صورت‌جلسات مجمع.' },
          { title: 'دامنه‌های فعال', desc: 'فعال‌سازی انتخابی ایرپراپ، سرویس، عملیات فنی یا C&E مطابق با نیاز.' },
          { title: 'نقش‌های مجاز', desc: 'مجوزهای زمان‌دار که دقیقاً منطبق بر محدوده مسئولیت هر کاربر تعریف می‌شوند.' },
        ],
      },
      availability: {
        badge: 'حاکمیت در دسترس بودن قابلیت‌ها',
        title: 'چارچوب در دسترس بودن قابلیت‌ها',
        desc: 'معماری کلادورا دامنه‌ای فراتر از هر پروژهٔ مستقل را در بر می‌گیرد. در دسترس بودن قابلیت‌های تفصیلی به دامنه‌های فعال‌شده، نوع دارایی، پک کشوری پیکربندی‌شده، دامنهٔ یکپارچه‌سازی و سطح استقرار در هر سازمان وابسته است.',
        note: 'برای اطمینان از عملکرد پایدار و بدون وقفه، قابلیت‌ها به صورت مرحله‌ای و پس از احراز پیش‌نیازهای فنی و قانونی فعال می‌گردند.',
      },
      cta: {
        title: 'آشنایی عمیق‌تر با ساختار معماری کلادورا',
        desc: 'مدل تفکیک‌شدهٔ چهارلایه، چرخهٔ عمر غیرخطی دارایی یا مشخصات امنیت و اعتماد سیستم را مطالعه فرمایید.',
        archLink: 'معماری تفصیلی سیستم',
        trustLink: 'معماری اعتماد و حاکمیت داده‌ها',
        partnerLink: 'درخواست شروع همکاری',
      },
    },
  }[lang] || {
    breadcrumb: { home: 'Home', current: 'Capabilities' },
    hero: { badge: '', title: '', subtitle: '', ctaPrimary: '', ctaSecondary: '' },
    visualModel: { badge: '', title: '', subtitle: '', tiers: [], boundariesNote: '' },
    foundation: { badge: '', title: '', desc: '', points: [] },
    commercial: { badge: '', title: '', desc: '', items: [] },
    operations: {
      badge: '',
      title: '',
      desc: '',
      serviceSide: { title: '', desc: '', tags: [] },
      opsSide: { title: '', desc: '', tags: [] },
    },
    communityGov: {
      badge: '',
      title: '',
      desc: '',
      ceSide: { title: '', desc: '' },
      commsSide: { title: '', desc: '' },
    },
    canonicalProviders: { badge: '', title: '', desc: '', providers: [] },
    trustMigration: { badge: '', title: '', desc: '', pillars: [] },
    intelligence: { badge: '', title: '', desc: '', steps: [] },
    composition: { badge: '', title: '', desc: '', dimensions: [] },
    availability: { badge: '', title: '', desc: '', note: '' },
    cta: { title: '', desc: '', archLink: '', trustLink: '', partnerLink: '' },
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
            <span className="text-[#102A43] font-bold">
              {content.breadcrumb.current}
            </span>
          </nav>

          <div className="max-w-4xl space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-xs font-bold text-[#0E9F8E]">
              <Cpu className="w-3.5 h-3.5" />
              <span>{content.hero.badge}</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-[#102A43] tracking-tight">
              {content.hero.title}
            </h1>
            <p className="text-base sm:text-lg text-[#52667A] leading-relaxed max-w-3xl">
              {content.hero.subtitle}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <Link
                href={`/${lang}/platform/architecture`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0E9F8E] text-white text-xs font-bold hover:bg-[#0C8778] transition shadow-card"
              >
                <span>{content.hero.ctaPrimary}</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </Link>
              <Link
                href={`/${lang}/contact`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-[#102A43] border border-[#D3DCE6] text-xs font-bold hover:bg-[#F6F9FC] transition shadow-card"
              >
                <span>{content.hero.ctaSecondary}</span>
              </Link>
            </div>
          </div>
        </section>

        {/* 02 ARCHITECTURE VISUAL MODEL */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.visualModel.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.visualModel.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.visualModel.subtitle}
            </p>
          </div>

          <div className="space-y-4">
            {content.visualModel.tiers.map((tier, idx) => (
              <div 
                key={idx}
                className="p-5 sm:p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#0E9F8E] tracking-wider uppercase">
                      {tier.role}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-[#102A43]">
                    {tier.name}
                  </h3>
                  <p className="text-xs text-[#52667A] leading-relaxed max-w-3xl">
                    {tier.desc}
                  </p>
                </div>
                <div className="shrink-0 self-start md:self-center">
                  <span className="inline-flex px-3 py-1 rounded-full text-[11px] font-bold bg-white text-[#102A43] border border-[#D3DCE6] shadow-xs">
                    {tier.badge}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-teal-50/70 border border-teal-100 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#0E9F8E] shrink-0 mt-0.5" />
            <p className="text-xs sm:text-sm text-[#0F3B37] leading-relaxed">
              {content.visualModel.boundariesNote}
            </p>
          </div>
        </section>

        {/* 03 SHARED FOUNDATION (CORE) */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.foundation.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.foundation.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.foundation.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {content.foundation.points.map((pt, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0E9F8E] flex items-center justify-center font-bold text-xs">
                  0{idx + 1}
                </div>
                <h3 className="text-sm font-bold text-[#102A43]">{pt.title}</h3>
                <p className="text-xs text-[#52667A] leading-relaxed">{pt.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 04 COMMERCIAL & TRANSACTION DOMAINS (AIRPROP) */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.commercial.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.commercial.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.commercial.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {content.commercial.items.map((it, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
                <Sparkles className="w-5 h-5 text-[#0E9F8E]" />
                <h3 className="text-sm font-bold text-[#102A43]">{it.title}</h3>
                <p className="text-xs text-[#52667A] leading-relaxed">{it.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 05 OPERATIONS & SERVICE DOMAINS (SERVICE, OPERATIONS) */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.operations.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.operations.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.operations.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {/* SERVICE */}
            <div className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center font-bold">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#102A43]">{content.operations.serviceSide.title}</h3>
                  <span className="text-[11px] text-[#0E9F8E] font-semibold uppercase">Peer Domain</span>
                </div>
              </div>
              <p className="text-xs text-[#52667A] leading-relaxed">
                {content.operations.serviceSide.desc}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {content.operations.serviceSide.tags.map((tg, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-[#D3DCE6] text-[#102A43]">
                    {tg}
                  </span>
                ))}
              </div>
            </div>

            {/* OPERATIONS */}
            <div className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center font-bold">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#102A43]">{content.operations.opsSide.title}</h3>
                  <span className="text-[11px] text-[#0E9F8E] font-semibold uppercase">Canonical Execution</span>
                </div>
              </div>
              <p className="text-xs text-[#52667A] leading-relaxed">
                {content.operations.opsSide.desc}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                {content.operations.opsSide.tags.map((tg, idx) => (
                  <span key={idx} className="px-2.5 py-1 rounded-md text-[11px] font-semibold bg-white border border-[#D3DCE6] text-[#102A43]">
                    {tg}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 06 PEOPLE / COMMUNITY / GOVERNANCE (C&E, COMMS) */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.communityGov.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.communityGov.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.communityGov.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0E9F8E] flex items-center justify-center font-bold text-xs">
                <Users className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-[#102A43]">{content.communityGov.ceSide.title}</h3>
              <p className="text-xs text-[#52667A] leading-relaxed">{content.communityGov.ceSide.desc}</p>
            </div>
            <div className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
              <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0E9F8E] flex items-center justify-center font-bold text-xs">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h3 className="text-base font-bold text-[#102A43]">{content.communityGov.commsSide.title}</h3>
              <p className="text-xs text-[#52667A] leading-relaxed">{content.communityGov.commsSide.desc}</p>
            </div>
          </div>
        </section>

        {/* 07 CANONICAL PROVIDERS (FIN01, DOCUMENTS, BK01) */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.canonicalProviders.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.canonicalProviders.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.canonicalProviders.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {content.canonicalProviders.providers.map((p, idx) => {
              const Icon = p.icon;
              return (
                <div key={idx} className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-50 text-[#0E9F8E] border border-teal-200">
                      {p.code}
                    </span>
                    <Icon className="w-5 h-5 text-[#52667A]" />
                  </div>
                  <h3 className="text-base font-bold text-[#102A43]">{p.name}</h3>
                  <p className="text-xs text-[#52667A] leading-relaxed">{p.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 08 MIGRATION, TRUST & AUDIT */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.trustMigration.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.trustMigration.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.trustMigration.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            {content.trustMigration.pillars.map((pil, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
                  <h3 className="text-sm font-bold text-[#102A43]">{pil.title}</h3>
                </div>
                <p className="text-xs text-[#52667A] leading-relaxed">{pil.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 09 INTELLIGENCE LAYER */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.intelligence.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.intelligence.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.intelligence.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {content.intelligence.steps.map((st) => (
              <div key={st.num} className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-1.5">
                <span className="text-xs font-bold font-mono text-[#0E9F8E]">ETAPA {st.num}</span>
                <h3 className="text-sm font-bold text-[#102A43]">{st.name}</h3>
                <p className="text-xs text-[#52667A] leading-relaxed">{st.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 10 CAPABILITY COMPOSITION */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.composition.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.composition.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.composition.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {content.composition.dimensions.map((dim, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-1">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#0E9F8E]" />
                  <h3 className="text-sm font-bold text-[#102A43]">{dim.title}</h3>
                </div>
                <p className="text-xs text-[#52667A] leading-relaxed">{dim.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 11 AVAILABILITY GOVERNANCE */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-4">
          <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
            {content.availability.badge}
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
            {content.availability.title}
          </h2>
          <p className="text-sm sm:text-base text-[#52667A] leading-relaxed max-w-4xl">
            {content.availability.desc}
          </p>
          <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] text-xs text-[#52667A] max-w-3xl">
            {content.availability.note}
          </div>
        </section>

        {/* 12 FINAL CTA */}
        <section className="bg-[#102A43] text-white rounded-3xl p-8 sm:p-12 shadow-elevated flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <h2 className="text-xl sm:text-2xl font-bold">{content.cta.title}</h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">{content.cta.desc}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
            <Link
              href={`/${lang}/platform/architecture`}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#0E9F8E] text-white text-xs font-bold hover:bg-[#0C8778] transition shadow-card flex items-center justify-center gap-2"
            >
              <span>{content.cta.archLink}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
            <Link
              href={`/${lang}/platform/trust`}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white/10 text-white border border-white/20 text-xs font-bold hover:bg-white/20 transition flex items-center justify-center gap-2"
            >
              <span>{content.cta.trustLink}</span>
            </Link>
            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-[#102A43] text-xs font-bold hover:bg-slate-100 transition flex items-center justify-center gap-2"
            >
              <span>{content.cta.partnerLink}</span>
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
