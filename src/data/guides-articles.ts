import { Language } from '@/types';

export interface GuideArticleSection {
  id: string;
  title: string;
  content: string[];
  subsections?: Array<{
    title: string;
    content: string[];
  }>;
}

export interface GuideArticleFaq {
  q: string;
  a: string;
}

export interface GuideArticleTable {
  caption: string;
  headers: string[];
  rows: string[][];
}

export interface GuideArticleData {
  id: string;
  lang: Language;
  slug: string;
  title: string;
  seoTitle: string;
  description: string;
  category: string;
  publicationDate: string;
  author: string;
  schemaType: 'TechArticle' | 'Article';
  readTime: string;
  directAnswer: string;
  disclaimer?: string;
  sections: GuideArticleSection[];
  table?: GuideArticleTable;
  faqs: GuideArticleFaq[];
  bridge: {
    title: string;
    description: string;
    buttonText: string;
    href: string;
  };
  relatedGuides: Array<{
    title: string;
    slug: string;
    lang: Language;
  }>;
}

export const GUIDE_ARTICLES: Record<string, GuideArticleData> = {
  // TOPIC-01 (EN)
  'what-is-property-operating-platform': {
    id: 'TOPIC-01',
    lang: 'en',
    slug: 'what-is-property-operating-platform',
    title: 'What Is a Property Operating Platform?',
    seoTitle: 'What Is a Property Operating Platform? Architecture & Core Concepts',
    description:
      'An architectural guide explaining the Property Operating Platform category: solving real estate fragmentation across property identity, workspaces, relationships, authority, and canonical data truth.',
    category: 'Platform Architecture',
    publicationDate: '2026-10-15',
    author: 'CLADORA',
    schemaType: 'TechArticle',
    readTime: '9 min read',
    directAnswer:
      'A Property Operating Platform is an operational system of record and action for the built world. Unlike legacy property management software that functions primarily as a lease-accounting database, an operating platform establishes a persistent digital identity for the physical property, decodes complex multi-party actor relationships into governed workspaces, and coordinates specialized canonical domain providers across the complete building lifecycle.',
    sections: [
      {
        id: 'fragmentation-crisis',
        title: 'The Core Problem: Operational Fragmentation in Real Estate',
        content: [
          'For decades, property management software has mirrored the organizational boundaries of individual service vendors rather than the physical reality of the building. When an asset changes hands, transitions from development to occupancy, or appoints a new facility manager, its institutional memory is routinely shattered.',
          'In traditional environments, maintenance tickets reside in one standalone application, tenant communications occur in ad-hoc messaging tools, meter readings exist in spreadsheets, and financial entries are locked inside localized accounting software. When data is scattered across incompatible silos, property owners, managers, and occupants are forced to reconcile discrepancy manually.',
          'This fragmentation creates three severe operational penalties: first, high friction during stakeholder handovers; second, security and privacy exposures caused by unmanaged access permissions; and third, the absence of an auditable, continuous operational record for the physical property.',
        ],
      },
      {
        id: 'defining-operating-platform',
        title: 'Defining the Property Operating Platform Category',
        content: [
          'A Property Operating Platform (POP) resolves this structural challenge by reorganizing real estate technology around the asset itself. Rather than forcing the building to fit inside a single company’s billing ledger, the platform treats the physical asset as the foundational anchor of operational truth.',
          'An operating platform acts as a system of action. It does not simply log historical transactions; it governs how operational events are initiated, validated, executed, and archived. By enforcing clear interfaces between different domains of expertise, an operating platform allows multiple independent organizations—developers, landlords, homeowner associations, facility contractors, and residents—to collaborate within a single governed ecosystem.',
        ],
      },
      {
        id: 'architectural-hierarchy',
        title: 'The Conceptual Hierarchy: 6 Foundational Layers',
        content: [
          'CLADORA’s platform architecture model organizes property operations into six distinct, decoupled layers. Understanding the boundaries between these layers is essential for evaluating modern property systems:',
        ],
        subsections: [
          {
            title: '1. Property & Asset Identity: The Persistent Digital Anchor',
            content: [
              'The property (land parcel, building archetype, section, unit, or common infrastructure) exists independently of whoever owns, manages, or occupies it today. In an operating platform, the asset has a persistent, verifiable identity that survives corporate acquisitions, management turnover, and tenant rotations.',
            ],
          },
          {
            title: '2. Workspaces: Scoped Organizational Boundaries',
            content: [
              'A Workspace is the logical and administrative boundary of an organization. A property management firm, a condominium association, a development joint venture, or a corporate tenant each operates within its own dedicated workspace. Workspaces enforce contextual access boundaries so that operational data, private ledgers, and internal documents remain strictly separated.',
            ],
          },
          {
            title: '3. People and Organizations: Decoupled Identity',
            content: [
              'In real estate, human actors routinely participate in multiple contexts simultaneously. A single individual may be an owner in one residential building, a commercial tenant in another, and a board member in a third. An operating platform decouples natural persons from static roles, allowing seamless context switching without compromising data boundaries.',
            ],
          },
          {
            title: '4. Role != Relationship != Authority',
            content: [
              'Traditional software conflates identity with permissions using basic Role-Based Access Control (RBAC). An operating platform separates three concepts: Who is the person? What is their relationship to the asset (e.g., registered owner, tenant, contracted technician)? What temporal authority have they been granted to perform specific actions (e.g., approve invoices under €5,000 until December 31)?',
            ],
          },
          {
            title: '5. Canonical Domain Providers: Single Source of Truth',
            content: [
              'Rather than building a monolithic database where any feature can write to any table, an operating platform delegates domain responsibility to specialized canonical providers. In CLADORA’s architecture, FIN01 owns financial ledger truth, DOCUMENTS owns canonical document versions and provenance, SERVICE governs request intake, and OPERATIONS governs work-order execution.',
            ],
          },
          {
            title: '6. Lifecycle Continuity: From Blueprint to Operations',
            content: [
              'Buildings endure for decades, but software typically models them only during short operational intervals. An operating platform maintains continuity across phases: from pre-construction feasibility and unit cataloging (AIRPROP), through technical commissioning and tenant handover, to daily facility management and capital renewal.',
            ],
          },
        ],
      },
      {
        id: 'availability-governance',
        title: 'Availability Governance: Architecture vs. Runtime Capability',
        content: [
          'A key discipline in platform architecture is distinguishing conceptual capability boundaries from runtime release maturity. While an architecture model defines how systems interact, public capability claims must strictly reflect verified software functionality.',
          'In CLADORA, provider boundaries (such as CORE identity, FIN01 financial truth, and OPERATIONS maintenance dispatch) provide architectural structure. However, specific operational modules are activated and configured on an entitlement basis per workspace, ensuring that software claims always align with actual operational readiness.',
        ],
      },
    ],
    table: {
      caption: 'Structural Comparison: Legacy PMS vs. Property Operating Platform',
      headers: ['Dimension', 'Legacy Property Management Software', 'Property Operating Platform'],
      rows: [
        ['Primary Focus', 'Financial ledger, lease contracts, and rent collection', 'Complete physical asset operations, multi-stakeholder workflows, and event truth'],
        ['Core Data Anchor', 'Tenancy agreement / Lease record', 'Persistent Property / Physical Asset Identity'],
        ['Organizational Scope', 'Single company / Single portfolio database', 'Multi-tenant Workspaces with contextual boundary scoping'],
        ['Identity & Access', 'Static user roles (Admin, Landlord, Tenant)', 'Contextual separation: Person + Relationship + Temporal Authority'],
        ['System Architecture', 'Monolithic application with coupled database tables', 'Decoupled canonical domain providers (FIN01, OPERATIONS, DOCUMENTS)'],
        ['Lifecycle Scope', 'Active tenancy phase only', 'Full lifecycle: Development, Handover, Operations, Capital Renewal'],
        ['Integration Model', 'Custom point-to-point batch sync scripts', 'Event-driven, API-first interoperability layer'],
      ],
    },
    faqs: [
      {
        q: 'Is a Property Operating Platform the same as an Integrated Workplace Management System (IWMS)?',
        a: 'No. While both handle enterprise real estate, an IWMS is built primarily for corporate occupiers managing desk layouts, corporate lease obligations, and corporate facilities. A Property Operating Platform governs the operational interactions between owners, asset managers, third-party operators, condominium associations, and residential or commercial occupants.',
      },
      {
        q: 'Does an operating platform replace general ledger ERP systems?',
        a: 'Not necessarily. An operating platform maintains high-fidelity operational financial truth (such as sub-ledger allocations, meter consumption math, and work order costs) while seamlessly preparing verified ledger records for export or integration into statutory enterprise ERPs.',
      },
      {
        q: 'How does an operating platform handle legacy data migration?',
        a: 'Through structured migration provenance. Instead of blind database overwrites, legacy records are ingested through validation gates with preserved source system keys, verifiable mapping decisions, and audit trail checkpoints before operational cutover.',
      },
    ],
    bridge: {
      title: 'Explore the CLADORA Architecture',
      description:
        'Discover how CLADORA connects persistent property identity with scoped workspaces, authority governance, and canonical domain providers.',
      buttonText: 'Review Platform Architecture',
      href: '/en/platform/architecture',
    },
    relatedGuides: [
      {
        title: 'Property Management Software vs Property Operating Platform: Architecture & Data Governance',
        slug: 'property-management-software-vs-property-operating-platform',
        lang: 'en',
      },
    ],
  },

  // TOPIC-02 (RO)
  'asociatii-proprietari-legea-196-2018': {
    id: 'TOPIC-02',
    lang: 'ro',
    slug: 'asociatii-proprietari-legea-196-2018',
    title: 'Ghid Practic pentru Asociațiile de Proprietari: Context Operațional Legea 196/2018',
    seoTitle: 'Ghid Asociații de Proprietari: Context Operațional Legea 196/2018 | CLADORA',
    description:
      'Ghid operațional și metodologic pentru asociațiile de proprietari din România: structura de guvernanță, atribuții, repartizarea cheltuielilor și fondurile obligatorii conform Legii nr. 196/2018.',
    category: 'Administrare Imobile România',
    publicationDate: '2026-10-15',
    author: 'CLADORA',
    schemaType: 'Article',
    readTime: '11 min citire',
    disclaimer:
      'Materialul are caracter informativ și operațional și nu înlocuiește consultanța juridică, contabilă sau fiscală adaptată situației concrete a unei asociații de proprietari. CLADORA oferă suport tehnologic pentru fluxuri operaționale, fără a furniza certificări juridice sau consultanță de specialitate.',
    directAnswer:
      'Legea nr. 196/2018 privind înființarea, organizarea și funcționarea asociațiilor de proprietari și administrarea condominiilor stabilește cadrul legal obligatoriu pentru clădirile rezidențiale și mixte din România. Din perspectivă operațională, legea delimitează rolurile de guvernanță (Adunare Generală, Comitet Executiv, Președinte, Cenzor, Administrator), impune criterii stricte de repartizare a facturilor pe consumuri, persoane și cotă-parte indiviză și reglementează funcționarea fondurilor de rulment și de reparații.',
    sections: [
      {
        id: 'cadrul-legal-general',
        title: 'Cadrul General al Legii nr. 196/2018 și Conceptele Cheie',
        content: [
          'Adoptată pentru a aduce transparență, rigoare financiară și responsabilitate juridică în administrarea blocurilor și ansamblurilor rezidențiale, Legea nr. 196/2018 a înlocuit vechea Lege 230/2007, introducând cerințe profesionale mai stricte pentru administratori și proceduri clare de control pentru proprietari.',
          'Din punct de vedere tehnic, legea definește condominiul ca fiind imobilul format din proprietăți individuale (apartamente sau spații cu altă destinație) și proprietăți comune indivizibile (structură de rezistență, fațade, acoperiș, casa scării, subsol, instalații sanitare și termice comune).',
          'Asociația de proprietari este forma juridică de organizare și reprezentare a intereselor tuturor coproprietarilor, având ca scop principal exploatarea, întreținerea, repararea și consolidarea proprietății comune.',
        ],
      },
      {
        id: 'structura-guvernanta',
        title: 'Structura de Guvernanță: Atribuții și Responsabilități',
        content: [
          'Una dintre cele mai frecvente surse de litigii în asociații este confuzia dintre rolul deliberativ (cine decide), rolul executiv (cine implementează) și rolul de control (cine verifică). Legea 196/2018 instituie o separare clară a competențelor:',
        ],
        subsections: [
          {
            title: '1. Adunarea Generală a Proprietarilor',
            content: [
              'Este organul suprem de decizie al asociației, format din toți membrii asociați. Adoptă bugetul anual de venituri și cheltuieli (BVC), aprobă fondurile speciale de reparații și investiții, alege sau revocă președintele, membrii comitetului executiv și cenzorul. Hotărârile se adoptă în cvorumul legal prevăzut de lege.',
            ],
          },
          {
            title: '2. Comitetul Executiv și Președintele Asociației',
            content: [
              'Comitetul executiv acționează ca organ executiv între ședințele adunării generale, asigurând ducerea la îndeplinire a hotărârilor acesteia. Președintele asociației este reprezentantul legal al asociației în raporturile cu terții, autoritățile publice și instanțele de judecată și semnează actele oficiale, contractele și ordinele de plată.',
            ],
          },
          {
            title: '3. Cenzorul sau Comisia de Cenzori',
            content: [
              'Reprezintă organul intern de control financiar-contabil. Verifică lunar legalitatea încasărilor și plăților, exactitatea calculului listelor de plată, reconcilierea contului bancar și respectarea prevederilor din bugetul aprobat. Cenzorul întocmește rapoarte de audit intern pentru Adunarea Generală.',
            ],
          },
          {
            title: '4. Administratorul de Condominiu (Persoană Fizică sau Juridică)',
            content: [
              'Administratorul este mandatarul executiv contractat pentru gestiunea operațională și tehnică a clădirii. Conform legii, administratorul persoană fizică trebuie să dețină un atestat profesional eliberat de primărie și un certificat de calificare. Administratorul calculează listele de întreținere, transmite ordinele de lucru către prestatori și întocmește registrele contabile în partidă simplă.',
            ],
          },
        ],
      },
      {
        id: 'categorii-cheltuieli',
        title: 'Categoriile Legale de Cheltuieli în Asociația de Proprietari',
        content: [
          'Articolul 75 din Legea 196/2018 reglementează categoric modul de repartizare a costurilor condominiului. În conformitate cu art. 75 alin. (3), hotărârile adunărilor generale sau comitetelor executive care încalcă aceste criterii legale sunt nule de drept. Cele 6 categorii stabilite de lege sunt:',
          '1. Cheltuieli pe număr de persoane: utilități și servicii a căror mărime depinde de prezența efectivă a locatarilor (ex: salubrizare, energie electrică pentru iluminatul spațiilor comune și lift, consum de apă rece la paușal).',
          '2. Cheltuieli pe cotă-parte indiviză (suprafață utilă): cheltuielile legate de conservarea și întreținerea proprietății comune (ex: reparații fațadă, terasă, acoperiș, hidroizolație, curățenie, revizii lift, cheltuieli administrative, salarii personal).',
          '3. Cheltuieli pe consumuri individuale: facturi facturate pe baza contoarelor individuale de apartament sau a repartitoarelor de costuri legal instalate și verificate metrologic.',
          '4. Cheltuieli pe beneficiari: sume imputabile direct proprietarilor care solicită servicii particulare suplimentare prin asociație.',
          '5. Cheltuieli pe consumatori tehnici: consumul aferent echipamentelor tehnice din spațiile comune.',
          '6. Cheltuieli de altă natură: fonduri de judecată, cheltuieli bancare sau alte sume expres autorizate de adunarea generală.',
        ],
      },
      {
        id: 'regimul-fondurilor',
        title: 'Regimul Fondurilor Obligatorii: Rulment vs. Reparații',
        content: [
          'Legea nr. 196/2018 impune obligativitatea constituirii a două fonduri distincte, care nu se pot amesteca și nu pot fi folosite pentru alte destinații decât cele legale:',
          '• Fondul de rulment (Art. 71): Serveste drept capital de lucru pentru asigurarea plăților curente către furnizorii de utilități în avans față de data încasării cotelor de întreținere. Este calculat în mod uzual ca echivalent al cotei maxime de întreținere din lunile de iarnă și se restituie proprietarului în caz de înstrăinare a locuinței.',
          '• Fondul de reparații (Art. 72): Serveste exclusiv pentru finanțarea lucrărilor de reabilitare, consolidare, modernizare și reparații capitale ale părților comune. Plățile efectuate în fondul de reparații constituie patrimoniul asociației și nu se restituie proprietarului la vânzare, transmițându-se de drept noului proprietar.',
          'Toate sumele încasate trebuie păstrate într-un cont bancar unic deschis pe numele asociației de proprietari, fiind interzisă utilizarea conturilor personale ale administratorilor sau comitetului.',
        ],
      },
      {
        id: 'transparenta-termene',
        title: 'Transparență Financiară, Registre Obligatorii și Termene Legale',
        content: [
          'Listele de plată lunare trebuie afișate la avizier (fizic și, opțional, digital) în termen de cel mult 5 zile de la data primirii tuturor facturilor de utilități.',
          'Proprietarii au la dispoziție un termen de 30 de zile calendaristice de la afișare pentru achitarea cotelor fără penalități. Asociația poate aplica un sistem de penalizări de întârziere de până la 0,2% pe zi de întârziere, aprobat de Adunarea Generală, fără ca suma penalităților să depășească suma debitului de bază.',
          'Contestațiile privind listele de plată pot fi depuse în scris în termen de cel mult 10 zile calendaristice de la afișare, președintele asociației având obligația legală de a răspunde motivat în termen de 10 zile.',
        ],
      },
      {
        id: 'arhitectura-digitala',
        title: 'Cum Sprijină o Arhitectură Digitală Rigoarea Operațională',
        content: [
          'O platformă modernă de operare nu înlocuiește atribuțiile legale ale organelor de conducere ale asociației, dar elimină erorile manuale de calcul și oferă un canal de colaborare auditabil:',
          '• Permite proprietarilor să transmită online indexul apometrelor însoțit de fotografie de confirmare, prevenind suspiciunile de raportare greșită.',
          '• Automatizează aplicarea regulilor de repartizare legală (pe persoane, cotă-parte indiviză și contoare), eliminând calculele manuale eronate din tabele nesupravegheate.',
          '• Păstrează un istoric digital complet al facturilor, plăților, chitanțelor și proceselor-verbale, facilitând auditul lunar efectuat de cenzor și asigurând predarea fluidă a documentelor la schimbarea conducerii.',
        ],
      },
    ],
    table: {
      caption: 'Organele Asociației de Proprietari conform Legii 196/2018',
      headers: ['Organ / Rol', 'Componență', 'Atribuții Principale', 'Răspundere'],
      rows: [
        ['Adunarea Generală', 'Toți proprietarii membri ai asociației', 'Aprobă BVC, alege organele de conducere, decide fondurile de investiții', 'Suverană; hotărârile contrare legii sunt nule de drept'],
        ['Comitetul Executiv', 'Președintele și un număr impar de proprietari aleși', 'Implementează hotărârile AG, pregătește documentele de ședință, supraveghează furnizorii', 'Statutară și civilă pentru deciziile de gestiune'],
        ['Președintele', 'Proprietar membru ales de Adunarea Generală', 'Reprezintă asociația juridic, semnează contracte și ordine de plată, răspunde contestațiilor', 'Juridică, civilă și penală conform mandatului'],
        ['Cenzorul / Comisia', 'Persoană cu pregătire economică sau financiară', 'Auditează lunar registrele, verifică reconcilierea bancară, avizează dările de seamă', 'Profesională și civilă pentru rapoartele de control'],
        ['Administratorul', 'Persoană fizică atestată sau persoană juridică autorizată', 'Gestiune operațională, calcul liste, citiri contoare, întocmire registre în partidă simplă', 'Contractuală, civilă și penală pentru fondurile gestionate'],
      ],
    },
    faqs: [
      {
        q: 'Pot fi exceptate anumite apartamente de la cheltuielile pentru lift?',
        a: 'Conform art. 75 alin. (5) din Legea 196/2018, prin hotărârea adunării generale, pot fi exceptate de la plata consumului de energie electrică pentru funcționarea ascensorului persoanele care locuiesc în apartamente situate la subsol, demisol, parter, mezanin și etajul 1 (în clădirile fără mezanin). Totuși, cheltuielile de întreținere tehnică și reparații ale liftului rămân pe cotă-parte indiviză pentru toți proprietarii.',
      },
      {
        q: 'Ce se întâmplă dacă un proprietar nu plătește întreținerea?',
        a: 'Dacă debitul depășește termenul de scadență și perioada de grație (după 60 de zile de la afișare), asociația de proprietari poate înscrie o ipotecă legală în Cartea Funciară asupra apartamentului debitorului și poate acționa în judecată proprietarul restant pentru recuperarea sumelor datorate și a penalităților legale.',
      },
      {
        q: 'Are voie administratorul să țină banii asociației în contul său personal?',
        a: 'Nu. Legea nr. 196/2018 interzice explicit utilizarea conturilor personale. Asociația de proprietari este obligată să dețină un cont bancar curent unic deschis pe codul fiscal propriu, prin care se derulează toate plățile către furnizori și încasările.',
      },
    ],
    bridge: {
      title: 'Explorează Soluția CLADORA pentru Asociații',
      description:
        'Află cum arhitectura CLADORA sprijină asociațiile de proprietari din România cu evidență operațională clară, reconciliere și transparență decizională.',
      buttonText: 'Vezi Soluția pentru Asociații',
      href: '/ro/solutions/associations',
    },
    relatedGuides: [
      {
        title: 'Metodologia Repartizării Cheltuielilor și Administrării Fondurilor în Asociațiile de Proprietari',
        slug: 'repartizare-cheltuieli-asociatie-proprietari',
        lang: 'ro',
      },
    ],
  },

  // TOPIC-03 (EN)
  'property-management-software-vs-property-operating-platform': {
    id: 'TOPIC-03',
    lang: 'en',
    slug: 'property-management-software-vs-property-operating-platform',
    title: 'Property Management Software vs Property Operating Platform: Architecture & Data Governance',
    seoTitle: 'Property Management Software vs Operating Platform: Architectural Guide | CLADORA',
    description:
      'A technical comparison between traditional Property Management Software (PMS) and modern Property Operating Platforms: data modeling, multi-workspace governance, and canonical truth separation.',
    category: 'Comparative Architecture',
    publicationDate: '2026-10-15',
    author: 'CLADORA',
    schemaType: 'TechArticle',
    readTime: '10 min read',
    directAnswer:
      'Traditional Property Management Software (PMS) was engineered primarily around the financial lease contract and rent ledger, functioning as a system of record for accounting between a landlord and rent-paying tenants. In contrast, a Property Operating Platform is an event-driven system of action that separates the physical property identity, organizational workspaces, contextual relationships, and temporal authority, coordinating specialized canonical domain providers across the complete building lifecycle.',
    sections: [
      {
        id: 'evolution-context',
        title: 'The Generational Evolution of Real Estate Software',
        content: [
          'Over the last thirty years, real estate software evolved in three distinct waves. The first wave digitized accounting ledgers, replacing paper rent rolls with localized databases. The second wave migrated these databases to the cloud, introducing web portals for tenant rent payments and basic maintenance forms.',
          'However, second-wave cloud PMS products preserved an underlying architectural flaw: they remained monolithic accounting systems wrapped in web interfaces. In these systems, the tenant relationship, the lease document, and the financial invoice are tightly coupled into a single database table.',
          'As real estate assets grew more complex—encompassing mixed-use towers, shared community amenities, outsourced facility operations, and institutional compliance standards—the limits of monolithic PMS became apparent. The third wave is defined by the Property Operating Platform: an architecture that decouples physical assets, organizational workspaces, human identities, and domain capabilities into an interoperable operational fabric.',
        ],
      },
      {
        id: 'comparison-matrix',
        title: 'Comprehensive Comparison: Monolithic PMS vs. Operating Platform',
        content: [
          'To evaluate which software paradigm fits an organization’s operational requirements, consider the foundational differences in how data, identity, and authority are structured:',
        ],
      },
      {
        id: 'data-model-differences',
        title: 'Architectural Difference 1: The Core Data Model',
        content: [
          'In a traditional PMS, the primary entity is the Lease Agreement. If a unit is vacant, or during the pre-construction and handover phases, the software provides virtually no operational model. Furthermore, if a tenant moves between units, their historical records must often be duplicated or split.',
          'In a Property Operating Platform, the foundational entity is the Property/Asset. The physical geometry, space hierarchy, and equipment specifications persist indefinitely. Leases, occupancy periods, utility accounts, and maintenance histories attach to this persistent anchor as temporal records, preserving continuous provenance across decades of building life.',
        ],
      },
      {
        id: 'authority-governance',
        title: 'Architectural Difference 2: Contextual Workspaces & Governed Authority',
        content: [
          'Traditional software uses static Role-Based Access Control (RBAC). A user is assigned a fixed role—such as "Property Manager" or "Tenant"—which grants broad, indiscriminate read and write access across the entire company database.',
          'An operating platform enforces Contextual Authority Grants within Scoped Workspaces. Instead of global role flags, permissions are strictly contextual: Who is the person? Within which organizational workspace are they operating? What specific mandate do they hold? And what temporal or financial limits bound their actions?',
          'For example, an external HVAC contractor is given temporary, scoped authority within the Operations domain to update specific work orders, without ever gaining visibility into owner financial returns, lease values, or resident personal data.',
        ],
      },
      {
        id: 'modular-providers',
        title: 'Architectural Difference 3: Composable Domain Truth vs. Monolithic Bloat',
        content: [
          'In legacy PMS, when a software vendor adds facility work orders, tenant communications, or IoT integrations, they append new columns and procedures to their existing relational database. This monolithic coupling leads to database locking, fragile releases, and catastrophic data leakage between domains.',
          'CLADORA’s platform architecture addresses this by enforcing Canonical Domain Responsibility. Each domain is governed by a dedicated provider:',
          '• CORE: Owns persistent property identities, organizational workspaces, human person registries, and authority grants.',
          '• FIN01: Owns double-entry financial ledger records, transaction auditability, and journal balances, strictly separated from statutory legal filing.',
          '• DOCUMENTS: Owns canonical document versions, upload provenance, and evidentiary metadata.',
          '• OPERATIONS: Owns work-order execution, contractor dispatch, and preventive maintenance checklists.',
          '• SERVICE: Owns the request intake pipeline and service catalog semantics.',
          'This separation ensures that updates to maintenance workflows cannot corrupt financial balances, and accounting reconciliations never block daily facility operations.',
        ],
      },
      {
        id: 'evaluation-framework',
        title: 'When Does an Organization Need an Operating Platform?',
        content: [
          'A simple, single-owner portfolio with uniform residential leases and minimal turnover can often survive on basic rental bookkeeping software.',
          'However, an operating platform becomes indispensable when an organization experiences:',
          '1. Multi-stakeholder complexity: Mixed portfolios involving private owners, commercial tenants, condominium associations, and external facility management contractors.',
          '2. Stringent audit requirements: Institutional investors requiring transparent data provenance, tamper-evident audit trails, and strict separation of duties.',
          '3. High migration and integration needs: The requirement to connect legacy ERPs, smart meter systems, and third-party vendor platforms through clean API contracts without data corruption.',
        ],
      },
    ],
    table: {
      caption: 'Detailed Architectural Comparison: Traditional PMS vs. Property Operating Platform',
      headers: ['Capability Dimension', 'Traditional Property Management Software (PMS)', 'Property Operating Platform (POP)'],
      rows: [
        ['System Center of Gravity', 'Landlord rent roll and lease accounting ledger', 'Physical asset identity and multi-stakeholder operational workflows'],
        ['Multi-Tenant Isolation', 'Single database instance with tenant_id filters', 'Workspace-scoped organizational boundaries with strict context enforcement'],
        ['Permission Model', 'Coarse static RBAC (Admin, Manager, Resident)', 'Fine-grained contextual authority: Person + Workspace + Mandate + Limit'],
        ['Lifecycle Scope', 'Active tenant lease duration only', 'Asset design, presales (AIRPROP), commissioning, daily operations, capital renewal'],
        ['Document Governance', 'Basic file attachment table on unit or lease record', 'Dedicated DOCUMENTS provider with versioning, metadata trails, and provenance'],
        ['Financial Integrity', 'Single general ledger mixed with operational notes', 'FIN01 canonical financial truth separated from statutory accounting filings'],
        ['Maintenance & Service', 'Basic internal ticketing module', 'Decoupled SERVICE request semantics and OPERATIONS work-order execution'],
        ['Integration & Ecosystem', 'Closed proprietary database with limited batch webhooks', 'API-first event fabric with modular provider interfaces'],
      ],
    },
    faqs: [
      {
        q: 'Can a Property Operating Platform run alongside our existing accounting software?',
        a: 'Yes. An operating platform is designed to govern operational complexity (such as daily work orders, tenant interactions, and utility meter distributions) while providing clean, validated financial records that export directly into existing corporate accounting systems.',
      },
      {
        q: 'Why is separating Person, Relationship, and Authority so important in real estate?',
        a: 'Because people change roles frequently in property ecosystems. A board president may sell their unit and become a tenant, or an employee at a property management company may manage multiple client portfolios with different approval limits. Conflating identity with static permissions inevitably causes unauthorized data access or orphaned records.',
      },
      {
        q: 'Does adopting an operating platform require replacing all existing hardware and smart meters?',
        a: 'No. Because an operating platform operates as an open API fabric, it ingests telemetry from diverse smart meters, IoT building management systems, and OCR photo uploads without requiring proprietary hardware lock-in.',
      },
    ],
    bridge: {
      title: 'Explore the CLADORA Platform',
      description:
        'See how CLADORA unifies property identity, workspaces, and canonical providers into an operational platform for modern real estate portfolios.',
      buttonText: 'Discover Platform Capabilities',
      href: '/en/platform',
    },
    relatedGuides: [
      {
        title: 'What Is a Property Operating Platform?',
        slug: 'what-is-property-operating-platform',
        lang: 'en',
      },
    ],
  },

  // TOPIC-04 (RO)
  'repartizare-cheltuieli-asociatie-proprietari': {
    id: 'TOPIC-04',
    lang: 'ro',
    slug: 'repartizare-cheltuieli-asociatie-proprietari',
    title: 'Metodologia Repartizării Cheltuielilor și Administrării Fondurilor în Asociațiile de Proprietari',
    seoTitle: 'Repartizare Cheltuieli Asociații de Proprietari: Ghid Metodologic | CLADORA',
    description:
      'Ghid metodologic privind calculul listelor de plată în asociații: criterii legale pe persoane, cotă-parte indiviză și contoare, plus bune practici în administrarea fondurilor de rulment și reparații.',
    category: 'Metodologie Financiară & Operațională',
    publicationDate: '2026-10-15',
    author: 'CLADORA',
    schemaType: 'Article',
    readTime: '12 min citire',
    disclaimer:
      'Acest ghid oferă o perspectivă metodologică și operațională asupra calculului cheltuielilor comune și nu constituie consultanță contabilă sau juridică autorizată. Asociațiile de proprietari au obligația de a verifica repartizările conform normelor legale în vigoare și hotărârilor adunării generale.',
    directAnswer:
      'Repartizarea corectă a cheltuielilor într-o asociație de proprietari presupune decuplarea facturii brute emise de furnizor în cote individuale atribuibile fiecărui apartament, pe baza a patru criterii legale esențiale: cheltuieli pe număr de persoane (legate de prezența efectivă a locatarilor), cheltuieli pe cotă-parte indiviză (proporționale cu suprafața utilă), cheltuieli pe consumuri individuale (determinate prin contoare și apometre) și cheltuieli pe beneficiari. Aplicarea greșită a acestor baze de calcul constituie motiv de nulitate a cotelor afișate la avizier.',
    sections: [
      {
        id: 'principiul-decuplarii',
        title: 'Principiul Fundamental: Decuplarea Facturii Furnizorului de Cota Proprietarului',
        content: [
          'Una dintre cele mai mari erori metodologice întâlnite în gestiunea blocurilor este tratarea facturii unui furnizor (de exemplu, factura de apă, gaze sau salubritate) ca o sumă globală împărțită mecanic. În realitate, o singură factură de utilități poate include componente care se repartizează pe criterii total diferite.',
          'De exemplu, o factură unică de apă și canalizare include de regulă trei elemente distincte: consumul individual înregistrat de apometrele din apartamente, consumul comun (udat spații verzi, curățenie, pierderi pe coloane comune) și componenta de canalizare a apei meteorice (apă de ploaie).',
          'Conform legii, apa consumată în apartamente se repartizează pe consumuri individuale, în timp ce apa meteorică și întreținerea rețelelor comune se repartizează pe cotă-parte indiviză de proprietate, indiferent dacă proprietarul locuiește sau nu în imobil.',
        ],
      },
      {
        id: 'criteriile-majore-detaliate',
        title: 'Cele 4 Criterii Majore de Repartizare Detaliate',
        content: [
          'Legea nr. 196/2018 clasifică cheltuielile asociației în categorii precise. Înțelegerea formulelor de calcul previne litigiile și contestările lunare:',
        ],
        subsections: [
          {
            title: '1. Cheltuieli pe Număr de Persoane (Art. 82)',
            content: [
              'Se aplică serviciilor a căror utilizare este direct proporțională cu prezența umană în clădire: salubrizare (dacă operatorul facturează pe număr de locuitori), energia electrică pentru iluminatul casei scării și funcționarea liftului, consumul de apă rece la paușal (acolo unde nu există contoare individuale).',
              'Regulă de calcul: Suma totală a facturii se împarte la numărul total de persoane declarate în clădire în luna respectivă, rezultând costul per persoană, care se înmulțește apoi cu numărul de persoane înregistrate la fiecare apartament.',
              'Obligația locatarilor: Proprietarii au obligația legală de a anunța în scris comitetul executiv cu privire la orice schimbare a numărului de persoane care locuiesc mai mult de 15 zile într-o lună.',
            ],
          },
          {
            title: '2. Cheltuieli pe Cotă-Parte Indiviză / Suprafață Utilă (Art. 84–85)',
            content: [
              'Se aplică tuturor costurilor necesare pentru menținerea, conservarea, repararea și administrarea părților comune ale imobilului. Acestea includ: reparații de terasă, fațadă, acoperiș sau hidroizolație; reviziile periodice ale liftului și ale instalațiilor comune; serviciile de curățenie a spațiilor comune; salariile sau indemnizațiile personalului; cheltuielile administrative (facturi poștale, birotică, software).',
              'Regulă de calcul: Cota-parte indiviză reprezintă raportul procentual dintre suprafața utilă a apartamentului individual și suma totală a suprafețelor utile ale tuturor proprietăților din clădire. Niciun proprietar nu poate fi scutit de aceste cheltuieli pe motiv că nu folosește spațiile comune sau că locuiește în altă localitate.',
            ],
          },
          {
            title: '3. Cheltuieli pe Consumuri Individuale',
            content: [
              'Se aplică serviciilor contorizate individual: consumul de apă rece și caldă înregistrat de apometrele de apartament, consumul de energie electrică sau gaze contorizat individual și energia termică alocată prin repartitoare de costuri.',
              'Regulă de calcul: Se înmulțește diferența dintre indexul citit în luna curentă și indexul din luna precedentă cu tariful unitar al furnizorului. Diferențele dintre contorul general de branșament și suma apometrelor de apartament se repartizează conform metodologiei adoptate de Adunarea Generală.',
            ],
          },
          {
            title: '4. Cheltuieli pe Beneficiari',
            content: [
              'Reprezintă cheltuieli pentru servicii particulare gestionate prin intermediul asociației de care beneficiază doar anumiți proprietari (de exemplu: deblocarea unei coloane de canalizare provocată de un blocaj localizat, citirea specială a contoarelor la cerere, emiterea de documente personalizate).',
            ],
          },
        ],
      },
      {
        id: 'administrarea-fondurilor',
        title: 'Metodologia Gestionării Fondurilor: Rulment vs. Reparații',
        content: [
          'Pentru menținerea echilibrului financiar, asociația trebuie să separe strict fondurile operaționale de cele de investiții:',
          '• Fondul de rulment: Are rolul de a asigura lichiditatea asociației pentru plata la termen a facturilor înainte ca proprietarii să fi achitat întreținerea lunii precedente. Se dimensionează în general la nivelul celei mai mari cote de întreținere dintr-o lună de iarnă. La înstrăinarea apartamentului, fondul de rulment se regularizează și se restituie proprietarului inițial, noul proprietar fiind obligat să constituie propriul fond de rulment.',
          '• Fondul de reparații: Este destinat exclusiv lucrărilor de reparație, consolidare sau modernizare a proprietății comune (ex: hidroizolație acoperiș, înlocuire coloane de apă, schimbare tâmplărie comună, zugrăvit casa scării). Acest fond rămâne atașat de patrimoniul asociației și nu se restituie proprietarului la vânzare.',
        ],
      },
      {
        id: 'erori-comune',
        title: 'Erori Metodologice Frecvente în Întocmirea Listelor de Plată',
        content: [
          '1. Repartizarea reparațiilor de acoperiș sau fațadă pe număr de persoane: Această practică este complet ilegală conform art. 75 din Legea 196/2018 și atrage nulitatea listei de plată. Toate reparațiile proprietății comune se împart exclusiv pe cotă-parte indiviză.',
          '2. Reținerea banilor de fond de reparații pentru plata facturilor de utilități curente: Amestecarea fondurilor speciale constituie o încălcare a legislației financiar-contabile a asociației.',
          '3. Scutirea arbitrară a etajelor inferioare de la alte costuri decât energia liftului: Doar consumul de energie electrică al ascensorului poate face obiectul unei excepții aprobate de AG, în timp ce reviziile și mentenanța liftului rămân obligatorii pentru toți proprietarii.',
        ],
      },
      {
        id: 'modelul-cladora',
        title: 'Modelul Arhitectural CLADORA: Lanțul Decuplării Cheltuielilor',
        content: [
          'Pentru a preveni litigiile și a asigura transparența deplină a fiecărui leu din listă, arhitectura CLADORA decuplează calculul în etape logice verificate:',
          'Factură Sursă (Furnizor) → Reguli de Alocare (Legale & Votate) → Spațiu / Unitate → Relație Actor (Proprietar vs. Chiriaș) → Tranzacție Financiară (FIN01) → Dovadă / Încasare.',
          'Această structură garantează că fiecare sumă de pe lista de întreținere poate fi urmărită până la factura originală a furnizorului, eliminând calculele manuale opace.',
        ],
      },
    ],
    table: {
      caption: 'Matrice Metodologică de Repartizare a Cheltuielilor Comune',
      headers: ['Tip Cheltuială', 'Criteriu Legal Obligatoriu', 'Bază de Calcul', 'Cine Datorează Plata?'],
      rows: [
        ['Salubrizare (menajer)', 'Număr de persoane', 'Locatari efectivi declarați', 'Proprietar sau chiriaș (conform convenției)'],
        ['Energie electrică lift & scară', 'Număr de persoane (cu excepții permise)', 'Locatari efectivi (parterul poate fi scutit doar la lift prin vot AG)', 'Locatari'],
        ['Reparații terasă, fațadă, instalații', 'Cotă-parte indiviză', 'Suprafață utilă (mp)', 'Proprietarul apartamentului (fără excepții)'],
        ['Mentenanță & revizii periodice lift', 'Cotă-parte indiviză', 'Suprafață utilă (mp)', 'Proprietarul apartamentului'],
        ['Curățenie spații comune', 'Cotă-parte indiviză', 'Suprafață utilă (mp)', 'Proprietarul apartamentului'],
        ['Consum apă rece / caldă apartament', 'Consumuri individuale', 'Indecși apometre (mc consumați)', 'Locatari / Proprietar'],
        ['Pierderi / diferențe apă branșament', 'Conform deciziei Adunării Generale', 'Cotă-parte sau număr de persoane (conform statut/regulament)', 'Toți proprietarii'],
        ['Fond de Reparații', 'Cotă-parte indiviză', 'Suprafață utilă (mp)', 'Proprietarul apartamentului (nu se restituie)'],
        ['Fond de Rulment', 'Echivalent consumuri maxime', 'Cotă estimată pe unitate', 'Proprietarul apartamentului (se restituie la vânzare)'],
      ],
    },
    faqs: [
      {
        q: 'Cum se procedează dacă un proprietar nu transmite indexul la apometru?',
        a: 'În mod uzual, regulamentul condominiului sau hotărârea Adunării Generale stabilește aplicarea unui consum forfetar (de exemplu, 3–5 metri cubi de persoană) până la prima regularizare cu citire directă, pentru a preveni încărcarea nejustificată a restului proprietarilor.',
      },
      {
        q: 'Pot fi introduse cheltuieli neprevăzute în lista de plată fără aprobare?',
        a: 'Nu. Administratorul nu poate iniția plăți pentru lucrări majore fără aprobarea prealabilă a Comitetului Executiv sau a Adunării Generale, cu excepția urgențelor majore (avarii tehnice care amenință siguranța clădirii), caz în care se convoacă de urgență comitetul pentru constatare.',
      },
    ],
    bridge: {
      title: 'Explorează Gestiunea Operațională a Asociațiilor',
      description:
        'Vezi cum platforma CLADORA ajută administratorii și asociațiile să gestioneze transparent repartizările de cheltuieli, citirile de contoare și fondurile speciale.',
      buttonText: 'Află mai multe despre CLADORA pentru Asociații',
      href: '/ro/solutions/associations',
    },
    relatedGuides: [
      {
        title: 'Ghid Practic pentru Asociațiile de Proprietari: Context Operațional Legea 196/2018',
        slug: 'asociatii-proprietari-legea-196-2018',
        lang: 'ro',
      },
    ],
  },

  // TOPIC-05 (FA)
  'platform-modiriat-amlak': {
    id: 'TOPIC-05',
    lang: 'fa',
    slug: 'platform-modiriat-amlak',
    title: 'معماری پلتفرم مدیریت املاک و تفکیک داده‌ها',
    seoTitle: 'معماری پلتفرم مدیریت املاک و تفکیک داده‌ها | کلادورا',
    description:
      'راهنمای معماری پلتفرم عملیات و مدیریت املاک: بررسی ضرورت تفکیک هویت ملک، ورک‌اسپیس‌های سازمانی، نقش‌ها، اختیارات و ارائه‌دهندگان حقیقت داده در بهره‌برداری نوین ملکی.',
    category: 'معماری پلتفرم',
    publicationDate: '2026-10-15',
    author: 'کلادورا',
    schemaType: 'TechArticle',
    readTime: '۱۰ دقیقه مطالعه',
    directAnswer:
      'پلتفرم مدیریت و عملیات املاک (Property Operating Platform) یک زیرساخت نرم‌افزاری یکپارچه و مدرن است که با تفکیک هویت فیزیکی ملک از ساختارهای حقوقی، ورک‌اسپیس‌های سازمانی (Workspaces)، روابط اشخاص و سطوح تفویض اختیار، بستری امن برای اتصال داده‌های مالی، اسناد حقوقی، درخواست‌های خدمات و عملیات نگهداری در تمام چرخه حیات دارایی فراهم می‌آورد. این رویکرد ساختاری مانع از پراکندگی داده‌ها و خطاهای انسانی در مدیریت املاک می‌شود.',
    sections: [
      {
        id: 'fa-problem-fragmentation',
        title: 'چالش جزیره‌ای بودن داده‌ها در مدیریت مجتمع‌ها و املاک',
        content: [
          'در روش‌های سنتی مدیریت املاک و ساختمان‌ها، اطلاعات حیاتی هر دارایی به شکلی پراکنده در نرم‌افزارهای حسابداری محلی، فایل‌های اکسل، اسناد کاغذی در زونکن‌ها و پیام‌رسان‌های غیررسمی نگهداری می‌شوند. این پراکندگی موجب می‌شود با تغییر هیئت‌مدیره، خروج مدیر ساختمان یا جابه‌جایی شرکت‌های ارائه‌دهنده خدمات، تاریخچه فنی، مالی و حقوقی ملک به طور کامل از بین برود.',
          'پیامد این گسست اطلاعاتی شامل خطاهای مکرر در محاسبه شارژ و تسهیم هزینه‌ها، عدم امکان ممیزی اسناد و فاکتورها، تأخیر در رسیدگی به خرابی‌های تأسیساتی و نقض حریم خصوصی ساکنان و مالکان به دلیل دسترسی‌های نامحدود به سوابق شخصی است.',
        ],
      },
      {
        id: 'fa-platform-definition',
        title: 'پلتفرم عملیات املاک چیست و چه تفاوتی با نرم‌افزارهای سنتی دارد؟',
        content: [
          'یک پلتفرم عملیات املاک برخلاف نرم‌افزارهای تک‌منظوره که صرفاً وظیفه صدور قبض یا ثبت فایل‌های اجاره را بر عهده دارند، نقش «سامانه ثبت و اقدام عملیاتی» را برای ساختمان ایفا می‌کند.',
          'در این ساختار، ملک فیزیکی به عنوان کانون پایدار داده‌ها تعریف می‌شود و نهادهای ذی‌نفع (توسعه‌دهنده، مالکان، هیئت‌مدیره مجتمع، مستأجران و پیمانکاران نگهداری) در فضاهای کاری معین و با اختیارات شفاف به تعامل می‌پردازند.',
        ],
      },
      {
        id: 'fa-architectural-pillars',
        title: 'پنج ستون اصلی معماری تفکیک داده‌ها در کلادورا',
        content: [
          'مدل معماری پلتفرم کلادورا برای حفظ یکپارچگی و امنیت اطلاعات بر پنج مفهوم بنیادین استوار است:',
        ],
        subsections: [
          {
            title: '۱. هویت پایدار ملک و دارایی (Property Identity)',
            content: [
              'ملک (زمین، بلوک ساختمانی، واحد مسکونی یا تجاری، و فضاهای مشاعات) دارای یک هویت دیجیتال مستقل و پایدار است. مالکان یا مستأجران تغییر می‌کنند، اما شناسنامه فنی، سوابق مصرف انرژی، پرونده‌های تعمیراتی و تاریخچه کاربری در هسته سیستم برای همیشه به همان دارایی متصل باقی می‌مانند.',
            ],
          },
          {
            title: '۲. ورک‌اسپیس به عنوان مرز حاکمیت سازمانی (Workspace Boundaries)',
            content: [
              'هر سازمان یا نهاد مستقل (مانند شرکت مدیریت مجتمع، هیئت‌مدیره انجمن مالکان یا پیمانکار تأسیسات) دارای یک ورک‌اسپیس اختصاصی با مرزهای داده‌ای معین است. این مرزبندی تضمین می‌کند که دفاتر مالی محرمانه یک سازمان برای سایر فعالان قابل مشاهده نباشد.',
            ],
          },
          {
            title: '۳. تفکیک هویت شخص از حساب‌های کاربری',
            content: [
              'یک فرد حقیقی ممکن است در یک مجتمع مالک واحد باشد، در برجی دیگر مستأجر تجاری محسوب شود و در یک پروژه نقش بازرس مالی را داشته باشد. سیستم هویت کلادورا این نقش‌های چندگانه را بدون نیاز به ساخت حساب‌های کاربری متعدد و بدون تداخل دسترسی‌ها مدیریت می‌کند.',
            ],
          },
          {
            title: '۴. تفکیک «نقش»، «رابطه» و «اختیار» (Authority)',
            content: [
              'در نرم‌افزارهای قدیمی، دسترسی‌ها بر اساس نقش‌های کلی و نامحدود (مانند مدیر یا ساکن) اعطا می‌شود. در پلتفرم عملیاتی، این سه مفهوم از هم جدا هستند: هویت فرد چیست؟ رابطه او با ملک چگونه است (مالک رسمی، مستأجر، تکنسین معتمد)؟ و چه اختیار معین و زمان‌داری برای تصمیم‌گیری یا ثبت تأیید به او واگذار شده است؟',
            ],
          },
          {
            title: '۵. ارائه‌دهندگان مرجع حقیقت داده‌ها (Canonical Providers)',
            content: [
              'برای جلوگیری از ناهماهنگی در سیستم، هر دامنه تخصصی تنها یک مرجع حقیقت در معماری دارد: هسته مالی (FIN01) مسئول ثبت دفاتر و اعتبارسنجی ارقام است، سامانه اسناد (DOCUMENTS) مراجع و اصالت فایل‌ها را نگهداری می‌کند و بخش عملیات (OPERATIONS) چرخه انجام دستورکارها را پایش می‌نماید.',
            ],
          },
        ],
      },
      {
        id: 'fa-lifecycle-continuity',
        title: 'تداوم چرخه حیات: از تحویل پروژه تا بهره‌برداری روزمره',
        content: [
          'یکی از بزرگ‌ترین مزایای معماری پلتفرم، حفظ اطلاعات در مراحل گوناگون ساختمان است. اطلاعات فنی، دفترچه‌های ضمانت تجهیزات و نقشه‌های تاسیساتی که در زمان پیش‌فروش و تحویل واحدها ثبت شده‌اند، مستقیماً به بستر نگهداری روزمره و تعمیرات پیشگیرانه منتقل می‌شوند و نیاز به ورود مجدد اطلاعات را از بین می‌برند.',
        ],
      },
      {
        id: 'fa-security-governance',
        title: 'حاکمیت داده‌ها و امنیت دسترسی بدون ادعاهای اغراق‌آمیز',
        content: [
          'امنیت در پلتفرم کلادورا یک اصل معماری مبتنی بر کنترل‌های دسترسی چندلایه، ثبت ردپای رویدادها (Audit Logs) و تفکیک مسئولیت‌ها است. ما از کاربرد واژه‌های مطلق مانند «غیرقابل نفوذ» یا «سیستم صددرصد خودکار بدون دخالت انسان» پرهیز می‌کنیم، زیرا امنیت واقعی از ترکیب طراحی نرم‌افزاری مسئولانه با شیوه‌های صحیح مدیریتی انسان‌ها شکل می‌گیرد.',
        ],
      },
    ],
    table: {
      caption: 'مقایسه ساختاری: نرم‌افزارهای سنتی در برابر پلتفرم عملیات و مدیریت املاک',
      headers: ['شاخص مقایسه', 'نرم‌افزارهای سنتی مدیریت و شارژ', 'پلتفرم عملیات و مدیریت املاک (CLADORA)'],
      rows: [
        ['کانون تمرکز سیستم', 'ثبت ساده محاسبات شارژ و صدور قبض', 'یکپارچه‌سازی فرآیندهای مالی، فنی، اسناد و ارتباطات بر بستر ملک'],
        ['شناسه محوری داده‌ها', 'قرارداد اجاره یا دوره ماهیانه شارژ', 'شناسه پایدار و دیجیتال ملک و دارایی فیزیکی'],
        ['مدل دسترسی کاربران', 'نقش‌های کلی و صلب (ادمین، کاربر عادی)', 'تفکیک هویت شخص، رابطه ملکی و سطح اختیار دارای تاریخ انقضا'],
        ['مرزبندی سازمانی', 'پایگاه داده مشترک با تفکیک ضعیف سطوح', 'فضاهای کاری مستقل (Workspaces) با مرزهای مشخص دسترسی'],
        ['حفظ تاریخچه اسناد', 'پیوست ساده فایل بدون زنجیره اعتبار', 'سامانه متمرکز اسناد با ثبت نسخه، اصالت و پیشینه ثبت رویداد'],
        ['پوشش چرخه حیات', 'تنها دوران سکونت مستأجر جاری', 'از تحویل پروژه و پیش‌فروش تا بهره‌برداری، تعمیرات اساسی و نوسازی'],
      ],
    },
    faqs: [
      {
        q: 'آیا پلتفرم مدیریت املاک جایگزین نرم‌افزارهای حسابداری رسمی شرکت‌ها می‌شود؟',
        a: 'خیر. پلتفرم کلادورا حقیقت عملیاتی املاک (محاسبات مصرف کنتور، هزینه‌های پیمانکاران، فیش‌های واریزی و تفکیک سهم واحدها) را مدیریت کرده و خروجی‌های استاندارد مالی و دفاتر تحلیلی را برای استفاده در دفاتر قانونی حسابداران رسمی آماده می‌سازد.',
      },
      {
        q: 'آیا مستأجران امکان مشاهده اطلاعات مالی یا دارایی‌های شخصی مالک را دارند؟',
        a: 'خیر. معماری پلتفرم دسترسی مستأجر را دقیقاً به مصارف جاری و تیکت‌های تعمیراتی واحد خود محدود کرده و ارقام درآمدی، هزینه‌های سرمایه‌ای و دفاتر شخصی مالک کاملاً مجزا و محرمانه نگهداری می‌شوند.',
      },
    ],
    bridge: {
      title: 'آشنایی با معماری پلتفرم CLADORA',
      description:
        'ببینید چگونه مدل معماری کلادورا هویت املاک، ورک‌اسپیس‌های سازمانی و ارائه‌دهندگان مرجع را به سامانه‌ای یکپارچه متصل می‌کند.',
      buttonText: 'مشاهده مشخصات معماری پلتفرم',
      href: '/fa/platform/architecture',
    },
    relatedGuides: [],
  },
};

export function getGuideArticle(slug: string, lang: Language): GuideArticleData | undefined {
  const article = GUIDE_ARTICLES[slug];
  if (!article || article.lang !== lang) {
    return undefined;
  }
  return article;
}

export function getAllGuideArticles(): GuideArticleData[] {
  return Object.values(GUIDE_ARTICLES);
}

export function getGuideArticlesForLang(lang: Language): GuideArticleData[] {
  return Object.values(GUIDE_ARTICLES).filter((a) => a.lang === lang);
}
