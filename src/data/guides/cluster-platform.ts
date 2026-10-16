import { GuideArticleData } from './types';

export const CLUSTER_PLATFORM_ARTICLES: Record<string, GuideArticleData> = {
  // TOPIC-01 (EN)
  'what-is-property-operating-platform': {
    id: 'TOPIC-01',
    lang: 'en',
    slug: 'what-is-property-operating-platform',
    contentApplicability: { kind: 'global' },
    targetAudience: 'International property portfolio owners, enterprise facility directors, and proptech architects',
    title: 'What Is a Property Operating Platform?',
    seoTitle: 'What Is a Property Operating Platform? Architecture',
    description:
      'An architectural guide to the Property Operating Platform category: resolving real estate data fragmentation across property identity, workspaces, and authority.',
    category: 'Platform Architecture',
    clusterId: 'cluster-platform',
    primaryQuery: 'property operating platform',
    supportingQueries: [
      'property operations software',
      'real estate operating system',
      'building operating platform',
      'canonical real estate data model'
    ],
    searchIntent: 'informational',
    publicationDate: '2026-10-15',
    datePublished: '2026-10-15',
    dateModified: '2026-10-15',
    author: 'CLADORA Research & Architecture',
    authorName: 'CLADORA Research & Architecture',
    authorUrl: '/en/resources/autori/cladora-research',
    reviewedBy: 'CLADORA Editorial & Research Team',
    schemaType: 'TechArticle',
    readTime: '9 min read',
    pillarHref: '/en/platform',
    disclaimer:
      'This architectural guide analyzes the property operating platform category across multi-stakeholder real estate portfolios. It is jurisdiction-agnostic and does not substitute for local legal, statutory, or tax advisory. Requirements of the asset\'s location country must be verified independently with current sources and qualified professional review; this article does not announce an active Country Pack or production legal compliance.',
    directAnswer:
      'A Property Operating Platform can be understood as an operational system of record and action for physical buildings. Unlike legacy single-purpose property management tools that function primarily as rent-roll databases, an operating platform establishes a persistent digital identity for the physical property, decodes multi-party actor relationships into governed workspaces, and coordinates specialized canonical domain providers across the complete building lifecycle.',
    sections: [
      {
        id: 'fragmentation-crisis',
        title: 'The Core Problem: Operational Fragmentation in Real Estate',
        content: [
          'For decades, property management software has mirrored the organizational boundaries of individual service vendors rather than the physical reality of the building. When an asset changes hands, transitions from development to occupancy, or appoints a new facility manager, its institutional memory is routinely shattered.',
          'In traditional environments, maintenance tickets reside in one standalone application, tenant communications occur in ad-hoc messaging tools, meter readings exist in spreadsheets, and financial entries are locked inside localized accounting software. When data is scattered across incompatible silos, property owners, managers, and occupants are forced to reconcile discrepancies manually.',
          'This fragmentation creates operational friction during stakeholder handovers, raises security and privacy exposures caused by unmanaged access permissions, and results in the absence of a continuous, verifiable operational record for the physical property.',
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
              'A Workspace is the logical and administrative boundary of an organization. A property management firm, a condominium association, a development joint venture, or a corporate tenant each operates within its own dedicated workspace. Workspaces enforce contextual boundaries so that operational data, private ledgers, and internal documents remain strictly separated.',
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
              'In complex property operations, static role-only access models can become insufficient. An operating platform separates three distinct concepts: Who is the person? What is their relationship to the asset (e.g., registered owner, tenant, contracted technician)? What temporal authority have they been granted to perform specific actions (e.g., approve invoices under €5,000 until December 31)?',
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
        a: 'Not necessarily. An operating platform maintains high-fidelity operational financial truth (such as sub-ledger allocations, meter consumption math, and work order costs) while preparing verified ledger records for export or integration into statutory enterprise ERPs.',
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

  // TOPIC-03 (EN)
  'property-management-software-vs-property-operating-platform': {
    id: 'TOPIC-03',
    lang: 'en',
    slug: 'property-management-software-vs-property-operating-platform',
    contentApplicability: { kind: 'global' },
    targetAudience: 'Real estate software evaluators, asset managers, and IT systems integrators',
    title: 'Property Management Software vs Property Operating Platform: Architecture & Data Governance',
    seoTitle: 'PMS vs Property Operating Platform: Architectural Guide',
    description:
      'Architectural comparison between monolithic Property Management Software (PMS) and Property Operating Platforms: data modeling, workspaces, and domain truth.',
    category: 'Architecture Comparison',
    clusterId: 'cluster-platform',
    primaryQuery: 'property management software vs operating platform',
    supportingQueries: [
      'monolithic PMS vs operating platform',
      'real estate software architecture',
      'property operations platform comparison'
    ],
    searchIntent: 'informational',
    publicationDate: '2026-10-15',
    datePublished: '2026-10-15',
    dateModified: '2026-10-15',
    author: 'CLADORA Research & Architecture',
    authorName: 'CLADORA Research & Architecture',
    authorUrl: '/en/resources/autori/cladora-research',
    reviewedBy: 'CLADORA Editorial & Research Team',
    schemaType: 'TechArticle',
    readTime: '10 min read',
    pillarHref: '/en/platform',
    disclaimer:
      'This comparative guide analyzes system architecture, data models, and authority governance between legacy PMS and operating platforms. It does not replace independent technical diligence or legal contract review. Requirements of the asset\'s location country must be verified independently with current sources and qualified professional review; this article does not announce an active Country Pack or production legal compliance.',
    directAnswer:
      'Many traditional Property Management Software (PMS) products have historically centered on leases, property accounting, tenant administration, and related commercial records, functioning as a system of record for landlord-tenant ledgers. In contrast, a Property Operating Platform is an event-driven system of action that decouples physical property identity, organizational workspaces, contextual relationships, and temporal authority, coordinating specialized canonical domain providers across the complete building lifecycle.',
    sections: [
      {
        id: 'evolution-context',
        title: 'The Generational Evolution of Real Estate Software',
        content: [
          'Over the last thirty years, real estate software evolved in three distinct waves. The first wave digitized accounting ledgers, replacing paper rent rolls with localized databases. The second wave migrated these databases to the cloud, introducing web portals for tenant rent payments and basic maintenance forms.',
          'However, second-wave cloud PMS products preserved an underlying architectural pattern: they remained financial accounting systems wrapped in web interfaces. In these systems, the tenant relationship, the lease document, and the financial invoice are tightly coupled into a single database table.',
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
          'In many traditional PMS tools, the primary entity is the Lease Agreement. If a unit is vacant, or during the pre-construction and handover phases, the software provides virtually no operational model. Furthermore, if a tenant moves between units, their historical records must often be duplicated or split.',
          'In a Property Operating Platform, the foundational entity is the Property/Asset. The physical geometry, space hierarchy, and equipment specifications persist indefinitely. Leases, occupancy periods, utility accounts, and maintenance histories attach to this persistent anchor as temporal records, preserving continuous provenance across decades of building life.',
        ],
      },
      {
        id: 'authority-governance',
        title: 'Architectural Difference 2: Contextual Workspaces & Governed Authority',
        content: [
          'Traditional software often relies on static Role-Based Access Control (RBAC). A user is assigned a fixed role—such as "Property Manager" or "Tenant"—which grants broad, indiscriminate read and write access across the entire company database.',
          'An operating platform enforces Contextual Authority Grants within Scoped Workspaces. Instead of global role flags, permissions are strictly contextual: Who is the person? Within which organizational workspace are they operating? What specific mandate do they hold? And what temporal or financial limits bound their actions?',
          'For example, an external HVAC contractor is given temporary, scoped authority within the Operations domain to update specific work orders, without ever gaining visibility into owner financial returns, lease values, or resident personal data.',
        ],
      },
      {
        id: 'modular-providers',
        title: 'Architectural Difference 3: Composable Domain Truth vs. Monolithic Bloat',
        content: [
          'In legacy PMS, when a software vendor adds facility work orders, tenant communications, or IoT integrations, they append new columns and procedures to their existing relational database. This monolithic coupling leads to database locking, fragile releases, and data leakage between domains.',
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
          '2. Stringent audit requirements: Institutional investors requiring transparent data provenance, verifiable audit trails, and strict separation of duties.',
          '3. High migration and integration needs: The requirement to connect legacy ERPs, smart meter systems, and third-party vendor platforms through clean API contracts without data corruption.',
        ],
      },
    ],
    table: {
      caption: 'Detailed Architectural Comparison: Traditional PMS vs. Property Operating Platform',
      headers: ['Capability Dimension', 'Traditional Property Management Software (PMS)', 'Property Operating Platform (POP)'],
      rows: [
        ['System Center of Gravity', 'Landlord rent roll and lease accounting ledger', 'Physical asset identity and multi-stakeholder operational workflows'],
        ['Workspace & Boundary Scoping', 'Single database instance with tenant_id filters', 'Workspace-scoped organizational boundaries with strict context enforcement'],
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

  // TOPIC-05 (FA)
  'platform-modiriat-amlak': {
    id: 'TOPIC-05',
    lang: 'fa',
    slug: 'platform-modiriat-amlak',
    contentApplicability: { kind: 'global' },
    targetAudience: 'سرمایه‌گذاران، مدیران مجتمع‌ها و بهره‌برداران بین‌المللی املاک و دارایی‌های فیزیکی',
    title: 'پلتفرم عملیات و مدیریت املاک چیست؟ مبانی معماری، تفکیک سطوح و حاکمیت داده‌ها',
    seoTitle: 'پلتفرم عملیات و مدیریت املاک چیست؟ مبانی و معماری داده',
    description:
      'راهنمای جامع معماری پیرامون مفهوم پلتفرم عملیات املاک (Property Operating Platform): حل چالش پراکندگی داده‌ها، مرزبندی اختیارات سازمانی و مراجع مرجع حقیقت داده‌ها.',
    category: 'معماری و متدولوژی پلتفرم',
    clusterId: 'cluster-platform',
    primaryQuery: 'پلتفرم مدیریت املاک',
    supportingQueries: [
      'نرم افزار مدیریت ساختمان',
      'معماری نرم افزار املاک',
      'سامانه جامع املاک و مستغلات'
    ],
    searchIntent: 'informational',
    publicationDate: '2026-10-15',
    datePublished: '2026-10-15',
    dateModified: '2026-10-15',
    author: 'گروه پژوهش و معماری سیستم‌های کلادورا',
    authorName: 'گروه پژوهش و معماری سیستم‌های کلادورا',
    authorUrl: '/fa/resources/autori/cladora-research',
    reviewedBy: 'شورای پژوهش و ویرایش کلادورا',
    schemaType: 'TechArticle',
    readTime: '۱۱ دقیقه مطالعه',
    pillarHref: '/fa/platform',
    disclaimer:
      'این راهنما به تحلیل مبانی معماری، ساختار داده‌ها و حاکمیت اطلاعات در پلتفرم‌های عملیات املاک می‌پردازد و مستقل از موقعیت جغرافیایی ملک یا حوزه قضایی خاص تنظیم شده است. الزامات کشور محل ملک باید جداگانه با منابع جاری و بازبینی واجد صلاحیت تأیید شوند؛ این مقاله فعال‌بودن Country Pack یا انطباق حقوقی تولیدی را اعلام نمی‌کند.',
    directAnswer:
      'پلتفرم عملیات و مدیریت املاک (Property Operating Platform) یک سامانه یکپارچه مبتنی بر رویداد برای ثبت، پایش و اقدام در چرخه عمر ساختمان‌های فیزیکی است. برخلاف نرم‌افزارهای تک‌منظوره و سنتی که صرفاً به عنوان دفترچه ثبت مبالغ شارژ یا قراردادهای اجاره عمل می‌کنند، پلتفرم عملیاتی یک هویت دیجیتال پایدار برای ملک ایجاد کرده، تعاملات میان مالکان، مدیران و ساکنان را در فضاهای کاری (Workspaces) مجزا ساختاردهی نموده و ارائه‌دهندگان مرجع داده‌ها را در یک بستر هماهنگ می‌سازد.',
    sections: [
      {
        id: 'fa-fragmentation-problem',
        title: 'چالش اساسی: جزیره‌ای بودن فرآیندها در مدیریت املاک',
        content: [
          'برای دهه‌ها، ابزارهای نرم‌افزاری در صنعت املاک بر اساس مرزهای محدود شرکت‌های ارائه‌دهنده خدمات طراحی شده‌اند، نه بر اساس واقعیت پیوسته و فیزیکی ساختمان.',
          'در روش‌های سنتی، تیکت‌های تعمیراتی در پیام‌رسان‌ها ردوبدل می‌شوند، محاسبات مصرف انرژی در فایل‌های اکسل نگهداری شده، اسناد در پوشه‌های پراکنده بایگانی می‌شوند و داده‌های مالی در نرم‌افزارهای حسابداری محلی محبوس می‌مانند. با هر تغییر در مدیریت یا فروش واحدها، این تاریخچه پراکنده مخدوش شده و هزینه‌های گزافی به مالکان و مدیران تحمیل می‌گردد.',
          'پلتفرم عملیات املاک این گسست ساختاری را با قرار دادن خود «ملک فیزیکی» به عنوان هسته اصلی حقیقت داده‌ها برطرف می‌کند.',
        ],
      },
      {
        id: 'fa-core-architecture',
        title: 'سطوح شش‌گانه معماری در پلتفرم عملیات املاک',
        content: [
          'معماری کلادورا فرآیندهای پیچیده ساختمانی را به شش لایه مستقل و مرتبط تفکیک می‌کند:',
        ],
        subsections: [
          {
            title: '۱. هویت پایدار ملک (Property Identity)',
            content: [
              'ملک، ساختمان یا واحد فیزیکی هویتی مستقل از مالکان یا مستأجران مقطعی خود دارد. این هویت پایدار سوابق فنی، شناسنامه تجهیزات و نقشه‌ها را در طول دهه‌ها حفظ می‌کند.',
            ],
          },
          {
            title: '۲. فضاهای کاری مجزا (Scoped Workspaces)',
            content: [
              'فضای کاری مرز سازمانی و امنیتی سیستم است. هر مجتمع، شرکت مدیریت دارایی یا شرکت خدماتی در فضای اختصاصی خود فعالیت می‌کند تا محرمانگی داده‌ها حفظ گردد.',
            ],
          },
          {
            title: '۳. تفکیک شخص از نقش (Decoupled Person & Role)',
            content: [
              'در دنیای واقعی، یک فرد ممکن است هم‌زمان در یک ساختمان مالک، در ساختمانی دیگر مستأجر و در یک مجتمع عضو هیئت‌مدیره باشد. پلتفرم هویت انسانی را از نقش‌های مقطعی جدا می‌سازد.',
            ],
          },
          {
            title: '۴. رابطه، نقش و حدود اختیارات بافت‌محور',
            content: [
              'دسترسی‌ها بر اساس نقش‌های ثابت تعریف نمی‌شوند؛ بلکه رابطه فرد با ملک و سطح اختیارات زمان‌دار و دارای سقف مالی وی مبنای تایید عملیات است.',
            ],
          },
          {
            title: '۵. ارائه‌دهندگان مرجع حقیقت داده‌ها (Canonical Providers)',
            content: [
              'برای جلوگیری از ناهماهنگی در سیستم، هر دامنه تخصصی تنها یک مرجع اصلی داده در معماری دارد: هسته مالی (FIN01) مسئول ثبت دفاتر و اعتبارسنجی ارقام است، سامانه اسناد (DOCUMENTS) مراجع و اصالت فایل‌ها را نگهداری می‌کند و بخش عملیات (OPERATIONS) چرخه انجام دستورکارها را پایش می‌نماید.',
            ],
          },
        ],
      },
      {
        id: 'fa-lifecycle-continuity',
        title: 'تداوم چرخه حیات: از تحویل پروژه تا بهره‌برداری روزمره',
        content: [
          'یکی از مزایای معماری پلتفرم، حفظ اطلاعات در مراحل گوناگون ساختمان است. اطلاعات فنی، دفترچه‌های ضمانت تجهیزات و نقشه‌های تاسیساتی که در زمان پیش‌فروش و تحویل واحدها ثبت شده‌اند، مستقیماً به بستر نگهداری روزمره و تعمیرات پیشگیرانه منتقل می‌شوند و نیاز به ورود مجدد اطلاعات را از بین می‌برند.',
        ],
      },
      {
        id: 'fa-security-governance',
        title: 'حاکمیت داده‌ها و امنیت دسترسی بدون ادعاهای اغراق‌آمیز',
        content: [
          'امنیت در پلتفرم کلادورا یک اصل معماری مبتنی بر کنترل‌های دسترسی چندلایه، ثبت ردپای رویدادها (Audit Logs) و تفکیک مسئولیت‌ها است. ما از کاربرد واژه‌های مطلق پرهیز می‌کنیم، زیرا امنیت واقعی از ترکیب طراحی نرم‌افزاری مسئولانه با شیوه‌های صحیح مدیریتی انسان‌ها شکل می‌گیرد.',
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
        a: 'خیر. معماری پلتفرم دسترسی مستأجر را به مصارف جاری و تیکت‌های تعمیراتی واحد خود محدود کرده و ارقام درآمدی، هزینه‌های سرمایه‌ای و دفاتر شخصی مالک مجزا و محرمانه نگهداری می‌شوند.',
      },
    ],
    bridge: {
      title: 'آشنایی با معماری پلتفرم CLADORA',
      description:
        'ببینید چگونه مدل معماری کلادورا هویت املاک، فضاهای کاری (Workspaces) و ارائه‌دهندگان مرجع را به سامانه‌ای یکپارچه متصل می‌کند.',
      buttonText: 'مشاهده مشخصات معماری پلتفرم',
      href: '/fa/platform/architecture',
    },
    relatedGuides: [],
  },
};
