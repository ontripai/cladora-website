import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import { 
  Building, 
  Building2, 
  Store, 
  Hotel, 
  Factory, 
  Warehouse, 
  Car, 
  Layers, 
  ArrowRight, 
  ShieldCheck, 
  Compass, 
  CheckCircle2, 
  Sliders, 
  Cpu, 
  GitBranch, 
  Globe2, 
  Workflow, 
  Lock,
  FileText,
  DollarSign,
  Calendar,
  MessageSquare,
  Wrench,
  Users
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
  return getRouteMetadata('/industries', params.lang);
}

export default async function IndustriesPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumb: { home: 'Acasă', current: 'Arhitectura Industriilor' },
      hero: {
        badge: 'ARHITECTURA PE TIPURI DE PROPRIETĂȚI',
        title: 'O Singură Arhitectură de Platformă. Contexte Imobiliare Multiple.',
        subtitle:
          'CLADORA compune aceeași identitate a proprietății, granițe de workspace, autoritate contextuală și furnizori canonici în jurul unor modele operaționale, tipologii de clădiri și profile de servicii diferite.',
        ctaPrimary: 'Explorează Contextele Imobiliare',
        ctaSecondary: 'Arhitectura Platformei',
      },
      compositionVsForks: {
        badge: 'PRINCIPIU ARHITECTURAL CENTRAL',
        title: 'Compoziție Dinamică, Nu Fork-uri Verticale',
        desc: 'Arhitectura țintă a platformei CLADORA evită fork-urile de produs specifice fiecărei industrii. O proprietate comercială, un ansamblu rezidențial și un depozit logistic sunt modelate în jurul aceluiași model comun de date și autoritate.',
        points: [
          {
            title: 'Fără Silozuri de Cod',
            desc: 'Arhitectura publică de produs este concepută în jurul compoziției, nu a unor baze de cod separate pe industrii. Contextele partajează același model unificat de date și autoritate.',
          },
          {
            title: 'Preseturi de Industrie, Nu Produse Izolate',
            desc: 'Presetul poate configura terminologia, regulile de alocare și fluxurile relevante pentru fiecare context, fără a schimba deținătorul de adevăr canonic.',
          },
          {
            title: 'Continuitate în Timp',
            desc: 'Dacă o clădire își schimbă parțial destinația sau devine un spațiu mixt, datele istorice, documentele și jurnalele financiare își păstrează integritatea.',
          },
        ],
      },
      gridSection: {
        badge: 'CELE 8 CONTEXTE CANONICE',
        title: 'Contextele Imobiliare ale Lumii Construite',
        subtitle:
          'Arhitectura CLADORA este proiectată să acopere diversitatea operațională a mediului construit prin configurarea dinamică a domeniilor și furnizorilor de adevăr.',
      },
      dimensionsSection: {
        badge: 'DIMENSIUNI DE COMPOZIȚIE',
        title: 'Cum se Adaptează Platforma la Fiecare Clădire',
        desc: 'Configurația operațională a unui workspace nu este fixată prin cod rigid, ci este derivată din compunerea a șase dimensiuni fundamentale:',
        dimensions: [
          {
            name: '1. Profilul Proprietății (Property Profile)',
            desc: 'Stabilește categoria funcțională a imobilului: Rezidențial, Birouri, Retail, Ospitalitate, Industrial, Logistică, Auto sau Mixt.',
            icon: Building,
          },
          {
            name: '2. Modelul Operațional (Operating Model)',
            desc: 'Definește modul de guvernanță: Administrat direct de proprietar, administrat de un FM terț, condominiu cu asociație, campus sau campus multi-operator.',
            icon: Workflow,
          },
          {
            name: '3. ADN-ul Clădirii (Building DNA)',
            desc: 'Topologia fizică a activului: turn monobloc, ansamblu de vile, parc de afaceri, galerie comercială, hală industrială sau rețea multisite.',
            icon: Layers,
          },
          {
            name: '4. Profilul de Servicii (Service Profile)',
            desc: 'Setul de servicii coordonate: mentenanță tehnică, curățenie, pază, servicii de recepție, facilități de lucru sau servicii logistice.',
            icon: Wrench,
          },
          {
            name: '5. Pachetul Național (Country Pack)',
            desc: 'Regulile de localizare fiscală, valutară și nomenclatoarele locale. România constituie pachetul de bază inițial al platformei.',
            icon: Globe2,
          },
          {
            name: '6. Domenii & Furnizori Activați',
            desc: 'Activarea domeniilor specializate (AIRPROP, SERVICE, OPERAȚIUNI, C&E) conectate la furnizorii canonici de adevăr (FIN01, DOCUMENTS, BK01).',
            icon: Sliders,
          },
        ],
      },
      domainComposition: {
        badge: 'CONECTIVITATEA DOMENIILOR',
        title: 'Compoziția Domeniilor pe Contexte Operaționale',
        desc: 'Fiecare context imobiliar combină domeniile specializate în jurul aceleiași fundații CORE, fără a redefini granițele furnizorilor canonici. Aceste combinații ilustrează compoziția și relevanța arhitecturală; ele nu reprezintă pachete comerciale pre-instalate sau lansate universal:',
        examples: [
          {
            context: 'Rezidențial',
            formula: 'CORE + SERVICE + OPERAȚIUNI + C&E + Furnizori Canonici',
            desc: 'Accent pe experiența de locuire, avizier digital, cotele de proprietate, tichete de mentenanță și reconcilierea cotelor de întreținere.',
          },
          {
            context: 'Birouri & Workplace',
            formula: 'CORE + OPERAȚIUNI + SERVICE + C&E + Furnizori Canonici',
            desc: 'Gestiunea relației cu chiriașii corporate, mentenanța activelor mari (HVAC, ascensoare), controlul accesului vizitatorilor și facilități comune.',
          },
          {
            context: 'Retail & Galerii',
            formula: 'CORE + AIRPROP + OPERAȚIUNI + SERVICE + C&E + Furnizori Canonici',
            desc: 'Gestiunea contractelor de retail: repartizarea cheltuielilor comune (OPEX), mentenanța continuă a galeriilor și coordonarea comercianților.',
          },
          {
            context: 'Ospitalitate',
            formula: 'CORE + OPERAȚIUNI + SERVICE + C&E + BK01 + Furnizori',
            desc: 'Modelarea capacității de cazare, coordonarea rapidă a echipelor de intervenție tehnică și integrarea rezervărilor de spații comune.',
          },
          {
            context: 'Industrial & Producție',
            formula: 'CORE + OPERAȚIUNI + SERVICE + DOCUMENTS + Furnizori',
            desc: 'Context de facilități industriale: registrul echipamentelor tehnice grele, planuri de revizii preventive, evidența verificărilor ISCIR și documentația tehnică.',
          },
          {
            context: 'Logistică & Distribuție',
            formula: 'CORE + OPERAȚIUNI + SERVICE + BK01 + Furnizori',
            desc: 'Monitorizarea rampelor de încărcare, programarea accesului camioanelor, mentenanța infrastructurii perimetrale și alocarea utilităților de mare putere.',
          },
          {
            context: 'Auto & Showroom-uri',
            formula: 'CORE + SERVICE + OPERAȚIUNI + C&E + Furnizori',
            desc: 'Gestiunea spațiilor de expunere, ateliere de service, fluxuri de vizitatori și evidența documentelor tehnice ale facilității.',
          },
          {
            context: 'Ansambluri Mixte (Mixed-Use)',
            formula: 'CORE + Toate Domeniile + Zonare Multi-Workspace',
            desc: 'Compoziția supremă: coexistența zonelor rezidențiale, de birouri și comerciale pe aceeași identitate topologică fără duplicarea datelor.',
          },
        ],
      },
      matrixSection: {
        badge: 'MATRICEA DE RELEVANȚĂ',
        title: 'Matricea Relațională a Capabilităților pe Industrii',
        subtitle:
          'Această matrice indică gradul de relevanță arhitecturală a capabilităților în fiecare context. Ea reprezintă compunerea structurală și NU indică: disponibilitatea în producție, stadiul de lansare, licențierea activă sau starea de implementare.',
        legend: {
          core: 'Context de Bază (Esențial)',
          common: 'Context Comun (Frecvent)',
          optional: 'Opțional / Selectabil',
          dependent: 'Dependent de Proiect',
        },
      },
      mixedUseSection: {
        badge: 'ARHITECTURA DE REFERINȚĂ',
        title: 'Ansamblurile Mixte: Valoarea Arhitecturală a Compoziției',
        desc: 'Un ansamblu mixt modern integrează rezidențial la etajele superioare, birouri la nivelurile intermediare, retail la parter, parcări subterane și facilități comune. Tradițional, acest scenariu ar necesita 3–4 aplicații software separate, ducând la fracturi contabile și dispute operaționale.',
        challenge: 'Problema Tradițională: Patru sisteme diferite care nu știu cine deține adevărul despre clădire, cine plătește reparația hidroizolației terasei sau cum se repartizează consumul de energie electrică al centralei comune.',
        solution: 'Abordarea CLADORA: O singură identitate fizică a activului în CORE. Workspace-uri distincte pentru asociația rezidențială, chiriașii de birouri și operatorul de retail. Furnizorul canonic FIN01 este desemnat să guverneze adevărul financiar și regulile de alocare, BK01 este desemnat pentru evidența capacității partajate, iar OPERAȚIUNI deține execuția comenzilor de lucru pe activele tehnice comune.',
      },
      availability: {
        badge: 'GUVERNANȚĂ & TRANSPARENȚĂ A DISPONIBILITĂȚII',
        title: 'Transparență Operațională Asupra Stadiilor de Dezvoltare',
        desc: 'Prezentarea industriilor reflectă capacitatea arhitecturală a platformei CLADORA de a modela lumea construită. În prezent, sectorul Rezidențial constituie contextul principal de produs și implementare al CLADORA, disponibilitatea fiecărei capabilități fiind guvernată individual de stadiul de lansare și perimetrul asumat de implementare. Contextele de Birouri, Retail, Industrial, Logistică, Ospitalitate, Auto și Mixte reprezintă contexte arhitecturale suportate (arhitectura este definită conceptual pentru a le reprezenta) sau compoziții țintă, și NU garanții de asistență comercială în producție disponibilă imediat. Disponibilitatea comercială depinde de:',
        factors: [
          'Domeniile operaționale configurate și licențiate pentru workspace-ul respectiv',
          'Tipologia și complexitatea fizică a proprietății',
          'Pachetul de reglementare național (Country Pack) aplicabil',
          'Nivelul de integrare cu echipamentele și sistemele terțe existente',
          'Stadiul de lansare (release status) al fluxurilor specifice',
          'Acordul comercial și perimetrul asumat de implementare',
        ],
      },
      cta: {
        title: 'Discută Scenariul Tău Imobiliar cu Echipa de Arhitectură',
        desc: 'Descoperă cum poate fi configurată arhitectura CLADORA pentru specificul operațional al portofoliului tău de clădiri.',
        primary: 'Explorează Arhitectura Platformei',
        secondary: 'Solicită Parteneriat',
      },
    },
    en: {
      breadcrumb: { home: 'Home', current: 'Industries Architecture' },
      hero: {
        badge: 'BUILT-WORLD PROPERTY CONTEXTS',
        title: 'One Platform Architecture. Different Property Contexts.',
        subtitle:
          'CLADORA composes the same property identity, workspace boundaries, contextual authority, and canonical providers around different operating models, building types, and service environments.',
        ctaPrimary: 'Explore Industry Contexts',
        ctaSecondary: 'Platform Architecture',
      },
      compositionVsForks: {
        badge: 'CORE ARCHITECTURAL PRINCIPLE',
        title: 'Dynamic Composition, Not Vertical Forks',
        desc: 'CLADORA’s target platform architecture avoids industry-specific product forks. The platform is designed around a shared data and authority model rather than separate, isolated codebases for each commercial niche.',
        points: [
          {
            title: 'No Code Silos',
            desc: 'The public product architecture is designed around composition rather than separate industry codebases. All property contexts share the same property identity, workspace boundaries, and canonical truth providers.',
          },
          {
            title: 'Industry Presets, Not Forked Products',
            desc: 'An industry preset can define domain relevance, terminology, and allocation rules without altering canonical truth providers or creating vertical software forks.',
          },
          {
            title: 'Long-Term Property Continuity',
            desc: 'When a building evolves its usage, integrates retail, or becomes mixed-use, historical tenant records, technical files, and financial audit logs remain structurally continuous.',
          },
        ],
      },
      gridSection: {
        badge: 'THE 8 CANONICAL CONTEXTS',
        title: 'Built-World Property & Asset Contexts',
        subtitle:
          'CLADORA’s architecture is engineered to span the operational spectrum of real estate through the dynamic assembly of domains and canonical truth providers.',
      },
      dimensionsSection: {
        badge: 'COMPOSABLE DIMENSIONS',
        title: 'How the Platform Adapts to Any Real Estate Asset',
        desc: 'A workspace’s operational configuration is not hardcoded. It is deterministically assembled from six core architectural dimensions:',
        dimensions: [
          {
            name: '1. Property Profile',
            desc: 'Identifies functional estate typology: Residential, Office, Retail, Hospitality, Industrial, Logistics, Automotive, or Mixed-Use.',
            icon: Building,
          },
          {
            name: '2. Operating Model',
            desc: 'Defines stewardship structure: Owner-operated, Third-party FM managed, Condominium HOA, Corporate campus, or Multi-operator network.',
            icon: Workflow,
          },
          {
            name: '3. Building DNA',
            desc: 'Physical spatial hierarchy: High-rise tower, Gated villa estate, Commercial shopping mall, Industrial depot, or Multi-site network.',
            icon: Layers,
          },
          {
            name: '4. Service Profile',
            desc: 'Coordinated operational scopes: Facility FM, MEP preventive contracts, Concierge living, Workplace support, or Fleet management.',
            icon: Wrench,
          },
          {
            name: '5. Country Pack',
            desc: 'Statutory accounting rules, currency standards, and legal compliance. Romania serves as the baseline country pack.',
            icon: Globe2,
          },
          {
            name: '6. Enabled Domains & Providers',
            desc: 'Activation of specialized workflow domains (AIRPROP, SERVICE, OPERATIONS, C&E) tied to canonical truth providers (FIN01, DOCUMENTS, BK01).',
            icon: Sliders,
          },
        ],
      },
      domainComposition: {
        badge: 'DOMAIN CONNECTIVITY',
        title: 'Domain Composition by Operational Context',
        desc: 'Each property context orchestrates domain engines around the single CORE foundation without redefining canonical provider boundaries. These combinations illustrate architectural relevance and composition; they do not represent pre-packaged, currently released industry bundles:',
        examples: [
          {
            context: 'Residential',
            formula: 'CORE + SERVICE + OPERATIONS + C&E + Canonical Providers',
            desc: 'Living experience focus: digital notice boards, quota ownership ratios, tenant work orders, and statutory utility reconciliations.',
          },
          {
            context: 'Office & Workplace',
            formula: 'CORE + OPERATIONS + SERVICE + C&E + Canonical Providers',
            desc: 'Corporate tenant context: central plant MEP maintenance (chillers, lifts), visitor credentials, and shared meeting facility schedules.',
          },
          {
            context: 'Retail & Shopping Centers',
            formula: 'CORE + AIRPROP + OPERATIONS + SERVICE + C&E + Providers',
            desc: 'Commercial lease management: common area maintenance (CAM/OPEX) apportionments, continuous cleaning SLAs, and merchant coordination.',
          },
          {
            context: 'Hospitality',
            formula: 'CORE + OPERATIONS + SERVICE + C&E + BK01 + Providers',
            desc: 'Lodging context: capacity inventory modeling, high-velocity technical repair dispatch, and integration of shared amenity reservations.',
          },
          {
            context: 'Industrial & Manufacturing',
            formula: 'CORE + OPERATIONS + SERVICE + DOCUMENTS + Providers',
            desc: 'Production facility context: mechanical asset registers, preventive maintenance schedules, statutory compliance certifications, and technical archives.',
          },
          {
            context: 'Logistics & Warehousing',
            formula: 'CORE + OPERATIONS + SERVICE + BK01 + Providers',
            desc: 'Distribution context: loading dock availability windows, truck access scheduling, perimeter infrastructure upkeep, and power submetering.',
          },
          {
            context: 'Automotive & Dealerships',
            formula: 'CORE + SERVICE + OPERATIONS + C&E + Providers',
            desc: 'Automotive facility context: showroom and service bay maintenance, customer lounge amenities, vendor SLA tracking, and technical site documentation.',
          },
          {
            context: 'Mixed-Use Developments',
            formula: 'CORE + All Domains + Multi-Workspace Partitioning',
            desc: 'Reference architecture context: coexistence of residential, office, and retail tiers under one persistent estate identity.',
          },
        ],
      },
      matrixSection: {
        badge: 'RELEVANCE MATRIX',
        title: 'Architectural Relevance Matrix Across Industries',
        subtitle:
          'This matrix indicates architectural relevance only. It represents structural composition design, and does NOT indicate: runtime availability, release maturity, licensing availability, or production deployment.',
        legend: {
          core: 'Core Context (Essential)',
          common: 'Common Context (Frequent)',
          optional: 'Optional Context',
          dependent: 'Project-Dependent',
        },
      },
      mixedUseSection: {
        badge: 'REFERENCE ARCHITECTURE',
        title: 'Mixed-Use: Demonstrates the Architectural Value of Composition',
        desc: 'A modern mixed-use development features residential apartments on upper floors, corporate offices on mid-levels, ground-floor retail, underground parking, and shared technical plant. Historically, this required 3–4 disconnected software systems, resulting in accounting fragmentation and operational friction.',
        challenge: 'The Legacy Dilemma: Multiple separate databases with no single source of property truth, conflicting opinions on who funds roof repairs, and unresolvable utility disputes for central cooling plant.',
        solution: 'The Architectural Value: One persistent physical asset record in CORE. Autonomous workspaces for the HOA board, office tenant corporations, and retail operators. Canonical provider FIN01 is designated to own financial truth and allocation semantics, BK01 is designated to own shared capacity truth, and OPERATIONS is designated to own work-order execution across shared physical infrastructure.',
      },
      availability: {
        badge: 'AVAILABILITY & GOVERNANCE TRANSPARENCY',
        title: 'Operational Maturity & Deployment Governance',
        desc: 'Our public presentation explains how CLADORA’s architecture is engineered to govern the built environment. Residential is CLADORA’s current primary product and implementation context, with capability availability governed individually by release status and implementation scope. Office, Retail, Industrial, Logistics, Hospitality, Automotive, and Mixed-Use represent supported architectural contexts (meaning the architecture is defined to represent the context, not that production support is commercially available) or target configurations. Commercial availability depends upon:',
        factors: [
          'Configured and licensed operational domain subscriptions for the workspace',
          'Physical asset typology, scale, and mechanical complexity',
          'Applicable regional statutory framework (Country Pack)',
          'Ecosystem integration scope with on-site telemetry and third-party systems',
          'Deployment release maturity of specific workflow modules',
          'Customer implementation agreement and pilot governance scope',
        ],
      },
      cta: {
        title: 'Discuss Your Property Context With Platform Architects',
        desc: 'Discover how CLADORA’s composable architecture can be calibrated for your exact real estate portfolio operating model.',
        primary: 'Explore Platform Architecture',
        secondary: 'Start Partnership',
      },
    },
    fa: {
      breadcrumb: { home: 'خانه', current: 'معماری صنایع' },
      hero: {
        badge: 'بسترهای گوناگون در دنیای ساخت‌وساز',
        title: 'یک معماری واحد برای پلتفرم. بسترهای گوناگون برای انواع املاک.',
        subtitle:
          'کلادورا همان هویت پایدار ملک، تفکیک قطعی فضاهای کاری، اختیارات زمینه‌محور و ارائه‌دهندگان مرجع داده‌ها را متناسب با مدل‌های مختلف بهره‌برداری، کالبد فیزیکی و الزامات خدماتی ترکیب می‌کند.',
        ctaPrimary: 'مرور بسترهای تخصصی املاک',
        ctaSecondary: 'معماری جامع پلتفرم',
      },
      compositionVsForks: {
        badge: 'اصل بنیادین معماری',
        title: 'ترکیب‌پذیری پویا، نه تکه‌تکه کردن کدبیس پلتفرم',
        desc: 'معماری هدف پلتفرم کلادورا از ایجاد انشعاب‌های نرم‌افزاری اختصاصی برای هر صنعت پرهیز می‌کند. پلتفرم پیرامون یک مدل مشترک داده و مرزهای اختیارات طراحی شده است، نه کدبیس‌های جداگانه و پراکنده برای هر بخش از بازار املاک.',
        points: [
          {
            title: 'پایان دادن به جزیره‌های نرم‌افزاری',
            desc: 'معماری عمومی محصول بر اساس ترکیب‌پذیری پویا طراحی شده است نه کدبیس‌های جداگانه. تمام بسترهای املاک از هویت مشترک ملک، تفکیک فضاهای کاری و ارائه‌دهندگان مرجع داده‌ها بهره می‌برند.',
          },
          {
            title: 'پیکربندی اختصاصی، نه محصول منشعب‌شده',
            desc: 'یک پیکربندی صنعت می‌تواند ارتباط دامنه‌ها، اصطلاحات و فرمول‌های تسهیم هزینه را بدون تغییر متولیان مرجع داده‌ها یا ایجاد انشعاب‌های نرم‌افزاری تعریف نماید.',
          },
          {
            title: 'تداوم سوابق دارایی در گذر زمان',
            desc: 'اگر کاربری یک ساختمان تحول یابد، بخش تجاری به آن افزوده شود یا به مجموعه‌ای چندمنظوره تبدیل گردد، تمام سوابق تاریخی، اسناد و دفاتر مالی پیوستگی ساختاری خود را حفظ می‌نمایند.',
          },
        ],
      },
      gridSection: {
        badge: '۸ بستر مرجع املاک',
        title: 'بسترهای کالبدی و کارکردی املاک',
        subtitle:
          'معماری کلادورا طوری مهندسی شده است که طیف کامل املاک و مستغلات را از طریق ترکیب پویای دامنه‌ها و ارائه‌دهندگان مرجع داده‌ها پوشش دهد.',
      },
      dimensionsSection: {
        badge: 'مؤلفه‌های شش‌گانه ترکیب‌پذیری',
        title: 'چگونگی انطباق پلتفرم با ویژگی‌های هر ملک',
        desc: 'پیکربندی عملیاتی هر ورک‌اسپیس با کدهای ثابت و خشک تعریف نشده، بلکه از ترکیب قطعی شش مؤلفه اصلی حاصل می‌شود:',
        dimensions: [
          {
            name: '۱. بافت ملک (Property Profile)',
            desc: 'تعیین کاربری کالبدی: مسکونی، اداری، تجاری، اقامتی، صنعتی، لجستیک، خودرویی یا چندمنظوره.',
            icon: Building,
          },
          {
            name: '۲. مدل بهره‌برداری (Operating Model)',
            desc: 'ساختار حاکمیت: مالک‌بهره‌بردار، مدیریت پیمانکاری، هیئت‌مدیره مجتمع، پردیس یا شبکه چندبهره‌برداری.',
            icon: Workflow,
          },
          {
            name: '۳. کالبد فنی ساختمان (Building DNA)',
            desc: 'توپولوژی فیزیکی سازه: برج بلندمرتبه، شهرک ویلایی، مرکز تجاری، کارخانه، سوله یا شبکه چندشعبه‌ای.',
            icon: Layers,
          },
          {
            name: '۴. بسته خدماتی (Service Profile)',
            desc: 'طیف خدمات فنی: تأسیسات عمومی، نگهداری پیشگیرانه آسانسور و موتورخانه، خدمات رفاهی یا لجستیک.',
            icon: Wrench,
          },
          {
            name: '۵. بسته قوانین کشوری (Country Pack)',
            desc: 'استانداردهای حسابداری، ارزی و ضوابط قانونی محلی. رومانی بسته کشوری مرجع اولیه سیستم است.',
            icon: Globe2,
          },
          {
            name: '۶. دامنه‌ها و ارائه‌دهندگان فعال',
            desc: 'فعال‌سازی دامنه‌های عملیاتی (AIRPROP، SERVICE، OPERATIONS، C&E) متصل به ارائه‌دهندگان مرجع (FIN01، اسناد، BK01).',
            icon: Sliders,
          },
        ],
      },
      domainComposition: {
        badge: 'یکپارچگی دامنه‌ها',
        title: 'ترکیب دامنه‌های عملیاتی در بسترهای مختلف',
        desc: 'هر نوع کاربری املاک، موتورهای دامنه‌ها را بدون خدشه به استقلال ارائه‌دهندگان مرجع، بر بستر زیرساخت CORE هماهنگ می‌سازد. این ترکیب‌ها صرفاً برای نمایش ارتباط و انطباق‌پذیری معماری سیستم ارائه شده‌اند و به منزلهٔ بسته‌های نرم‌افزاری از پیش‌آماده یا منتشرشده در سطح تجاری نیستند:',
        examples: [
          {
            context: 'مسکونی',
            formula: 'CORE + SERVICE + OPERATIONS + C&E + ارائه‌دهندگان مرجع',
            desc: 'تمرکز بر کیفیت سکونت، تابلوی اعلانات دیجیتال، سهم‌الشارژ مالکان، دستورکارهای نگهداری و تسویه قبوض.',
          },
          {
            context: 'اداری و فضاهای کار',
            formula: 'CORE + OPERATIONS + SERVICE + C&E + ارائه‌دهندگان مرجع',
            desc: 'مدیریت ارتباط با مستأجران اداری، نگهداری تجهیزات سنگین (هواسازها، آسانسورها)، تردد مراجعان و اتاق‌های جلسات.',
          },
          {
            context: 'تجاری و مراکز خرید',
            formula: 'CORE + AIRPROP + OPERATIONS + SERVICE + C&E + ارائه‌دهندگان',
            desc: 'قراردادهای تجاری اجاره، تفکیک دقیق هزینه‌های مشاعات تجاری (OPEX)، نظافت مستمر و مدیریت غرفه‌داران.',
          },
          {
            context: 'اقامتی و هتلداری',
            formula: 'CORE + OPERATIONS + SERVICE + C&E + BK01 + ارائه‌دهندگان',
            desc: 'مدل‌سازی ظرفیت فضاها، ارجاع سریع دستورکارهای تعمیراتی و رزرو امکانات رفاهی مشترک.',
          },
          {
            context: 'صنعتی و کارخانجات',
            formula: 'CORE + OPERATIONS + SERVICE + DOCUMENTS + ارائه‌دهندگان',
            desc: 'شناسنامه ماشین‌آلات سنگین، برنامه‌های دقیق نگهداری پیشگیرانه، گواهی‌های ایمنی و بایگانی اسناد فنی.',
          },
          {
            context: 'لجستیک و انبارداری',
            formula: 'CORE + OPERATIONS + SERVICE + BK01 + ارائه‌دهندگان',
            desc: 'مدیریت اسکله‌های بارگیری، زمان‌بندی تردد کامیون‌ها، نگهداری محوطه و کنتورهای دیماند بالا.',
          },
          {
            context: 'املاک خودرویی و نمایشگاهی',
            formula: 'CORE + SERVICE + OPERATIONS + C&E + ارائه‌دهندگان',
            desc: 'مدیریت سالن‌های نمایش و تعمیرگاه‌ها، فضاهای رفاهی مشتریان، نظارت بر پیمانکاران و اسناد فنی محل.',
          },
          {
            context: 'مجموعه‌های چندمنظوره (Mixed-Use)',
            formula: 'CORE + تمام دامنه‌ها + تفکیک فضاهای کاری مجزا',
            desc: 'کامل‌ترین الگوی معماری: همزیستی بخش‌های مسکونی، اداری و تجاری بر پایه یک شناسنامه واحد ملکی.',
          },
        ],
      },
      matrixSection: {
        badge: 'ماتریس تناسب کارکردی',
        title: 'ماتریس تناسب قابلیت‌ها با انواع املاک',
        subtitle:
          'این جدول صرفاً بیانگر ارتباط و تناسب معماری قابلیت‌ها است و به هیچ عنوان نشان‌دهندهٔ در دسترس بودن عملیاتی در محیط زنده (Runtime)، سطح بلوغ انتشار، دسترسی تجاری یا استقرار نهایی در تولید نیست.',
        legend: {
          core: 'بستر بنیادین (ضروری)',
          common: 'بستر متداول (کاربرد بالا)',
          optional: 'اختیاری / مازاد',
          dependent: 'وابسته به ماهیت پروژه',
        },
      },
      mixedUseSection: {
        badge: 'معماری مرجع پلتفرم',
        title: 'مجتمع‌های چندمنظوره: ارزش معماری ترکیب‌پذیر در عمل',
        desc: 'یک پروژهٔ چندمنظوره مدرن شامل واحدهای مسکونی در طبقات بالا، دفاتر اداری در طبقات میانی، مراکز خرید در طبقات همکف، پارکینگ‌های زیرزمینی و تأسیسات مشترک است. در نرم‌افزارهای سنتی این وضعیت مستلزم ۳ یا ۴ نرم‌افزار ناهماهنگ و در نتیجه اختلافات مالی و عملیاتی شدید بود.',
        challenge: 'بحران سامانه‌های جزیره‌ای: چندین دیتابیس جداگانه که هیچ‌کدام مرجع نهایی حقیقت ملک نیستند، ابهام در پرداخت هزینه‌های بازسازی سقف و اختلافات بر سر تسهیم برق چیلر مرکزی.',
        solution: 'ارزش معماری ترکیب‌پذیر: یک شناسنامهٔ فیزیکی پایدار در CORE. فضاهای کاری مستقل برای انجمن مالکان، شرکت‌های مستأجر اداری و مدیریت مراکز خرید. ارائه‌دهندهٔ کانونی FIN01 برای مالکیت حقیقت مالی و منطق تسهیم هزینه‌ها، BK01 برای کنترل ظرفیت‌های اشتراکی و OPERATIONS برای مدیریت و اجرای دستورکارهای نگهداری بر روی دارایی‌های فنی مشترک تعیین شده‌اند.',
      },
      availability: {
        badge: 'شفافیت حاکمیت و سطح آمادگی سامانه',
        title: 'سطوح آمادگی عملیاتی و حاکمیت استقرار پلتفرم',
        desc: 'بخش صنایع نحوه انطباق معماری کلادورا را بر جهان املاک تشریح می‌کند. در حال حاضر، بخش مسکونی بستر اصلی محصول و استقرار پیاده‌سازی‌های کلادورا محسوب می‌شود و در دسترس بودن هر قابلیت، به تفکیک بر اساس مرحلهٔ انتشار و دامنهٔ اجرایی پروژه تعیین می‌گردد. بسترهای اداری، تجاری، صنعتی، لجستیک، هتلداری، خودرویی و چندمنظوره به عنوان بسترهای معمارانه پشتیبانی‌شده (به این معنا که معماری برای بازنمایی این بسترها تعریف شده است، نه اینکه پشتیبانی تجاری در محیط تولید هم‌اکنون به صورت عمومی در دسترس باشد) یا پیکربندی‌های هدف شناخته می‌شوند که استقرار واقعی آن‌ها به عوامل زیر وابسته است:',
        factors: [
          'دامنه‌های عملیاتی خریداری‌شده و دارای مجوز در هر ورک‌اسپیس',
          'نوع و پیچیدگی فیزیکی و تأسیساتی ملک',
          'بسته مقرراتی و استانداردهای قانونی کشور مربوطه (Country Pack)',
          'میزان اتصال به سامانه‌های هوشمند پایش و سیستم‌های نرم‌افزاری ثالث',
          'مرحلهٔ انتشار (Release Status) برای ماژول‌های فرآیندی مرتبط',
          'توافق‌نامه عملیاتی و محدوده تعیین‌شده در پروژه پیاده‌سازی',
        ],
      },
      cta: {
        title: 'بررسی بستر ملکی شما با مهندسان معماری سیستم',
        desc: 'چگونگی انطباق معماری منعطف کلادورا با ساختار عملیاتی و سبد دارایی‌های ملکی خود را بررسی نمایید.',
        primary: 'مشاهده معماری پلتفرم',
        secondary: 'درخواست همکاری و مشاوره',
      },
    },
  }[lang] || {
    breadcrumb: { home: 'Home', current: 'Industries' },
    hero: { badge: '', title: '', subtitle: '', ctaPrimary: '', ctaSecondary: '' },
    compositionVsForks: { badge: '', title: '', desc: '', points: [] },
    gridSection: { badge: '', title: '', subtitle: '' },
    dimensionsSection: { badge: '', title: '', desc: '', dimensions: [] },
    domainComposition: { badge: '', title: '', desc: '', examples: [] },
    matrixSection: { badge: '', title: '', subtitle: '', legend: { core: '', common: '', optional: '', dependent: '' } },
    mixedUseSection: { badge: '', title: '', desc: '', challenge: '', solution: '' },
    availability: { badge: '', title: '', desc: '', factors: [] },
    cta: { title: '', desc: '', primary: '', secondary: '' },
  };

  const industriesList = [
    {
      id: 'residential',
      name: lang === 'ro' ? 'Rezidențial' : lang === 'fa' ? 'مسکونی' : 'Residential',
      badge: lang === 'ro' ? 'Context Principal de Produs' : lang === 'fa' ? 'بستر اصلی محصول' : 'Primary Product Context',
      icon: Building,
      propertyContext:
        lang === 'ro'
          ? 'Blocuri de locuințe, condominii, asociații de proprietari, ansambluri rezidențiale și cartiere de vile.'
          : lang === 'fa'
          ? 'برج‌های مسکونی، مجتمع‌های آپارتمانی، شهرک‌های ویلایی و تعاونی‌های مسکن.'
          : 'Apartment buildings, condominiums, homeowners associations, multi-family portfolios, and gated villa communities.',
      operatingModel:
        lang === 'ro'
          ? 'Administrat de asociație (HOA), administrat de companie de property management (FM) sau proprietar unic.'
          : lang === 'fa'
          ? 'مدیریت هیئت‌مدیره مجتمع، شرکت مدیریت پیمانکاری یا مالک واحد اجاره‌داری.'
          : 'Association-managed (HOA), third-party professional FM, or single-owner rental portfolio.',
      relevantDomains: ['CORE', 'SERVICE', 'OPERATIONS', 'C&E', 'FIN01', 'DOCUMENTS'],
      concerns:
        lang === 'ro'
          ? 'Cote de întreținere explicabile, transparența avizierului digital, tichete de reparații casnice, arhivarea cărții tehnice și adunări de proprietari.'
          : lang === 'fa'
          ? 'تسهیم فرمول‌محور شارژ، تابلوی اعلانات، تیکت‌های تعمیراتی، ثبت سوابق مالکان و برگزاری جلسات مجمع.'
          : 'Explainable quota cost allocation, digital notice board transparency, tenant repair tickets, technical book archive, and resident meetings.',
    },
    {
      id: 'office',
      name: lang === 'ro' ? 'Birouri & Workplace' : lang === 'fa' ? 'اداری و دفاتر کار' : 'Office & Workplace',
      badge: lang === 'ro' ? 'Context Arhitectural Suportat' : lang === 'fa' ? 'بستر معمارانه پشتیبانی‌شده' : 'Supported Architectural Context',
      icon: Building2,
      propertyContext:
        lang === 'ro'
          ? 'Clădiri de birouri corporate, parcuri de afaceri, turnuri multi-tenant și spații flexibile de lucru.'
          : lang === 'fa'
          ? 'برج‌های اداری سازمانی، پارک‌های فناوری و کسب‌وکار، ساختمان‌های اداری چندمستأجره و فضاهای کار اشتراکی.'
          : 'Corporate office towers, business parks, multi-tenant commercial workplace assets, and corporate campus environments.',
      operatingModel:
        lang === 'ro'
          ? 'Administrator instituțional de active (Asset Manager), companie specializată de Facility Management.'
          : lang === 'fa'
          ? 'مدیریت دارایی سازمانی (Asset Management)، شرکت بهره‌برداری تخصصی تأسیسات (FM).'
          : 'Institutional Asset Management or specialized Commercial Facility Management.',
      relevantDomains: ['CORE', 'OPERATIONS', 'SERVICE', 'C&E', 'BK01', 'FIN01'],
      concerns:
        lang === 'ro'
          ? 'Separarea OPEX pe chiriași, revizii preventive pentru instalații HVAC și ascensoare, acces vizitatori și programarea sălilor de conferințe.'
          : lang === 'fa'
          ? 'تفکیک هزینه‌های جاری مشاعات اداری، نگهداری پیشگیرانه سرمایش/گرمایش، کنترل تردد مراجعان و رزرو فضاهای جلسات.'
          : 'Tenant OPEX apportionments, critical MEP preventive maintenance (HVAC, lifts), visitor credentials, and shared meeting amenity scheduling.',
    },
    {
      id: 'retail',
      name: lang === 'ro' ? 'Retail & Centre Comerciale' : lang === 'fa' ? 'تجاری و مراکز خرید' : 'Retail & Shopping Centers',
      badge: lang === 'ro' ? 'Context Arhitectural Suportat' : lang === 'fa' ? 'بستر معمارانه پشتیبانی‌شده' : 'Supported Architectural Context',
      icon: Store,
      propertyContext:
        lang === 'ro'
          ? 'Mall-uri, parcuri de retail (strip malls), galerii comerciale la parterul clădirilor și spații stradale.'
          : lang === 'fa'
          ? 'مراکز خرید بزرگ (Mall)، مجتمع‌های تجاری خطی، راسته بازارهای شهری و فضاهای تجاری همکف.'
          : 'Shopping centers, retail parks, urban retail podiums, commercial galleries, and multi-tenant high-street assets.',
      operatingModel:
        lang === 'ro'
          ? 'Operator comercial specializat, consorțiu de proprietari sau management de retail.'
          : lang === 'fa'
          ? 'شرکت مدیریت بهره‌برداری تجاری، کنسرسیوم مالکان یا شرکت سرپرستی مجتمع.'
          : 'Specialized retail management company, merchant consortium, or retail real estate operator.',
      relevantDomains: ['CORE', 'AIRPROP', 'OPERATIONS', 'SERVICE', 'C&E', 'FIN01'],
      concerns:
        lang === 'ro'
          ? 'Alocarea cotelor de cheltuieli comune (CAM/OPEX), contracte de închiriere cu chirii procentuale, mentenanța spațiilor publice și coordonarea furnizorilor.'
          : lang === 'fa'
          ? 'تسهیم هزینه‌های نگهداری فضاهای عمومی تجاری، قراردادهای اجاره با شروط متنوع، نظافت مستمر و هماهنگی با اصناف.'
          : 'Common Area Maintenance (CAM) reconciliations, commercial lease covenants, public footfall area maintenance, and tenant service coordination.',
    },
    {
      id: 'hospitality',
      name: lang === 'ro' ? 'Ospitalitate' : lang === 'fa' ? 'اقامتی و هتلداری' : 'Hospitality',
      badge: lang === 'ro' ? 'Compoziție Țintă de Industrie' : lang === 'fa' ? 'پیکربندی هدف صنعت' : 'Target Industry Composition',
      icon: Hotel,
      propertyContext:
        lang === 'ro'
          ? 'Hoteluri, aparthoteluri, reședințe cu servicii incluse (serviced apartments) și resorturi de vacanță.'
          : lang === 'fa'
          ? 'هتل‌ها، هتل‌آپارتمان‌ها، اقامتگاه‌های دارای خدمات هتلینگ و دهکده‌های اقامتی تفریحی.'
          : 'Hotels, serviced residences, aparthotels, hospitality lodging complexes, and mixed resort assets.',
      operatingModel:
        lang === 'ro'
          ? 'Operator hotelier de brand, franciză sau companie independentă de management hotelier.'
          : lang === 'fa'
          ? 'اپراتور زنجیره‌ای برند هتلی، فرنچایز یا شرکت مستقل مدیریت بهره‌برداری اقامتی.'
          : 'Hospitality brand operator, white-label hotel management company, or independent estate manager.',
      relevantDomains: ['CORE', 'OPERATIONS', 'SERVICE', 'C&E', 'BK01', 'DOCUMENTS'],
      concerns:
        lang === 'ro'
          ? 'Viteza de rezolvare a incidentelor tehnice din camere, mentenanța echipamentelor de bucătărie și spa, evidența activelor și rezervarea resurselor comune.'
          : lang === 'fa'
          ? 'سرعت بالا در رفع خرابی اتاق‌ها، نگهداری تجهیزات رستوران و استخر، شناسنامه دارایی‌ها و تقویم رزرو امکانات.'
          : 'Fast room maintenance dispatch, kitchen/spa equipment upkeep, technical asset lifecycle, and shared capacity reservation context.',
    },
    {
      id: 'industrial',
      name: lang === 'ro' ? 'Industrial & Producție' : lang === 'fa' ? 'صنعتی و کارخانجات' : 'Industrial',
      badge: lang === 'ro' ? 'Context Arhitectural Suportat' : lang === 'fa' ? 'بستر معمارانه پشتیبانی‌شده' : 'Supported Architectural Context',
      icon: Factory,
      propertyContext:
        lang === 'ro'
          ? 'Fabrici, facilități de producție ușoară, hale industriale și parcuri tehnologice.'
          : lang === 'fa'
          ? 'کارخانجات، سوله‌های تولیدی، کارگاه‌های صنعتی پیشرفته و شهرک‌های فناوری.'
          : 'Manufacturing plants, light industrial estates, production support facilities, and industrial campuses.',
      operatingModel:
        lang === 'ro'
          ? 'Proprietar-producător direct sau administrator de parc industrial.'
          : lang === 'fa'
          ? 'مالک-بهره‌بردار خط تولید یا شرکت شهرک‌های صنعتی.'
          : 'Owner-manufacturer enterprise or industrial park facility administration.',
      relevantDomains: ['CORE', 'OPERATIONS', 'SERVICE', 'DOCUMENTS', 'FIN01'],
      concerns:
        lang === 'ro'
          ? 'Preocupări reprezentative: evidența tehnică a echipamentelor, planuri preventive fără opriri neplanificate, permise de lucru pentru contractori și arhiva tehnică.'
          : lang === 'fa'
          ? 'دغدغه‌های نماینده: شناسنامه تجهیزات فنی، برنامه‌ریزی نگهداری پیشگیرانه، مجوزهای ایمنی کار پیمانکاران و اسناد فنی تأسیسات.'
          : 'Representative concerns: technical equipment registries, preventive maintenance planning, contractor safety permits, and technical documentation archives.',
    },
    {
      id: 'logistics',
      name: lang === 'ro' ? 'Logistică & Depozitare' : lang === 'fa' ? 'لجستیک و انبارداری' : 'Logistics',
      badge: lang === 'ro' ? 'Context Arhitectural Suportat' : lang === 'fa' ? 'بستر معمارانه پشتیبانی‌شده' : 'Supported Architectural Context',
      icon: Warehouse,
      propertyContext:
        lang === 'ro'
          ? 'Depozite de mare înălțime, centre de distribuție, hub-uri de cross-docking și parcuri logistice.'
          : lang === 'fa'
          ? 'انبارهای بزرگ طبقاتی، مراکز توزیع و پخش کالا، هاب‌های بارانداز و پردیس‌های لجستیکی.'
          : 'High-bay warehouses, regional distribution centers, cross-docking terminals, and multi-operator logistics estates.',
      operatingModel:
        lang === 'ro'
          ? 'Dezvoltator logistic instituțional (ex. CTP, WDP), operator 3PL sau fond de investiții imobiliare.'
          : lang === 'fa'
          ? 'توسعه‌دهنده پردیس‌های لجستیکی، شرکت‌های خدمات لجستیک طرف سوم (3PL) یا صندوق‌های املاک.'
          : 'Institutional logistics landlord, 3PL operator, or logistics infrastructure real estate fund.',
      relevantDomains: ['CORE', 'OPERATIONS', 'SERVICE', 'BK01', 'DOCUMENTS'],
      concerns:
        lang === 'ro'
          ? 'Preocupări reprezentative: ferestre de disponibilitate pentru rampe, programarea accesului camioanelor, întreținerea infrastructurii perimetrale și contorizarea utilităților de putere.'
          : lang === 'fa'
          ? 'دغدغه‌های نماینده: زمان‌بندی ظرفیت باراندازها، هماهنگی تردد کامیون‌ها، نگهداری کفسازی و پایش کنتورهای قدرت بالا.'
          : 'Representative concerns: loading dock availability windows, truck access scheduling, perimeter infrastructure upkeep, and high-demand power submetering.',
    },
    {
      id: 'automotive',
      name: lang === 'ro' ? 'Auto & Showroom-uri' : lang === 'fa' ? 'املاک خودرویی و نمایندگی‌ها' : 'Automotive',
      badge: lang === 'ro' ? 'Compoziție Țintă de Industrie' : lang === 'fa' ? 'پیکربندی هدف صنعت' : 'Target Industry Composition',
      icon: Car,
      propertyContext:
        lang === 'ro'
          ? 'Showroom-uri auto, ateliere de mecanică și vopsitorie, rețele de service și parcări structurate.'
          : lang === 'fa'
          ? 'نمایشگاه‌های خودرو، تعمیرگاه‌ها و سالن‌های خدمات فنی، نمایندگی‌ها و پارکینگ‌های تخصصی.'
          : 'Car dealerships, authorized service bays, multi-site automotive networks, and structured multi-level parking decks.',
      operatingModel:
        lang === 'ro'
          ? 'Grup de distribuție auto, francizor de rețea service sau operator de facilități auto.'
          : lang === 'fa'
          ? 'گروه بازرگانی خودرو، شبکه خدمات پس از فروش یا شرکت بهره‌بردار تأسیسات خودرویی.'
          : 'Automotive dealership group, brand network franchisee, or dedicated automotive estate operator.',
      relevantDomains: ['CORE', 'SERVICE', 'OPERATIONS', 'C&E', 'DOCUMENTS'],
      concerns:
        lang === 'ro'
          ? 'Mentenanța elevatoarelor auto și cabinelor de vopsit, gestiunea deșeurilor periculoase, experiența clienților în zona de așteptare și dosarul tehnic.'
          : lang === 'fa'
          ? 'نگهداری جک‌های تعمیرگاهی و اتاق‌های رنگ، مدیریت پسماندهای ویژه، رفاه سالن انتظار مشتریان و بایگانی استانداردهای فنی.'
          : 'Service bay lift and paint booth maintenance, environmental hazard records, customer lounge journey context, and building technical passport.',
    },
    {
      id: 'mixed-use',
      name: lang === 'ro' ? 'Ansambluri Mixte (Mixed-Use)' : lang === 'fa' ? 'مجتمع‌های چندمنظوره (Mixed-Use)' : 'Mixed-Use',
      badge: lang === 'ro' ? 'Arhitectură de Referință' : lang === 'fa' ? 'معماری مرجع پلتفرم' : 'Reference Architecture',
      icon: Layers,
      propertyContext:
        lang === 'ro'
          ? 'Proiecte multifuncționale integrând rezidențial, clădiri de birouri, galerii de retail, hotel și parcări comune.'
          : lang === 'fa'
          ? 'پروژه‌های کلان ترکیبی شامل برج‌های مسکونی، اداری، فروشگاه‌ها، هتل و پارکینگ‌های یکپارچه شهری.'
          : 'Integrated built environments blending residential condominiums, commercial workplace, retail podiums, hospitality, and shared parking.',
      operatingModel:
        lang === 'ro'
          ? 'Comitet de coordonare mixt, asociații multiple coordonate printr-un master-operator de infrastructură.'
          : lang === 'fa'
          ? 'کمیته هماهنگی مشترک، انجمن‌های چندگانه زیر نظر یک اپراتور ارشد مادر.'
          : 'Master estate operator, joint coordination committee, or multi-workspace consortium.',
      relevantDomains: ['CORE', 'AIRPROP', 'SERVICE', 'OPERATIONS', 'C&E', 'FIN01', 'BK01', 'DOCUMENTS'],
      concerns:
        lang === 'ro'
          ? 'Zonarea drepturilor de decizie, repartizarea pe chei de cost zonale și generale, separarea accesului rezidenți/public și mentenanța activelor comune.'
          : lang === 'fa'
          ? 'تفکیک حقوق تصمیم‌گیری، فرمول‌های چندمرحله‌ای تسهیم هزینه‌های کل و زون‌ها، مرزبندی تردد خصوصی و عمومی و نگهداری مشاعات کلان.'
          : 'Multi-workspace tenant partitioning, multi-tier CAM allocation formulas, private vs. public credential boundaries, and shared central plant MEP execution.',
    },
  ];

  const matrixData = [
    {
      family: lang === 'ro' ? 'Identitate Activ (CORE)' : lang === 'fa' ? 'هویت دارایی (CORE)' : 'Asset Identity (CORE)',
      ratings: {
        residential: 'core',
        office: 'core',
        retail: 'core',
        hospitality: 'core',
        industrial: 'core',
        logistics: 'core',
        automotive: 'core',
        'mixed-use': 'core',
      },
    },
    {
      family: lang === 'ro' ? 'Workspace & Izolare' : lang === 'fa' ? 'ورک‌اسپیس و تفکیک داده' : 'Workspace Isolation',
      ratings: {
        residential: 'core',
        office: 'core',
        retail: 'core',
        hospitality: 'core',
        industrial: 'core',
        logistics: 'core',
        automotive: 'core',
        'mixed-use': 'core',
      },
    },
    {
      family: lang === 'ro' ? 'Autoritate Contextuală' : lang === 'fa' ? 'اختیارات زمینه‌ای' : 'Contextual Authority',
      ratings: {
        residential: 'core',
        office: 'core',
        retail: 'core',
        hospitality: 'common',
        industrial: 'core',
        logistics: 'common',
        automotive: 'common',
        'mixed-use': 'core',
      },
    },
    {
      family: lang === 'ro' ? 'AIRPROP (Tranzacții/Leasing)' : lang === 'fa' ? 'ایرپراپ (معاملات و اجاره)' : 'AIRPROP (Commercial/Lease)',
      ratings: {
        residential: 'common',
        office: 'common',
        retail: 'core',
        hospitality: 'optional',
        industrial: 'optional',
        logistics: 'common',
        automotive: 'optional',
        'mixed-use': 'core',
      },
    },
    {
      family: lang === 'ro' ? 'SERVICE (Cereri & Devize)' : lang === 'fa' ? 'سرویس (استعلام و هماهنگی)' : 'SERVICE (Requests & Quotes)',
      ratings: {
        residential: 'core',
        office: 'core',
        retail: 'core',
        hospitality: 'core',
        industrial: 'core',
        logistics: 'core',
        automotive: 'core',
        'mixed-use': 'core',
      },
    },
    {
      family: lang === 'ro' ? 'OPERAȚIUNI (Mentenanță)' : lang === 'fa' ? 'عملیات (نگهداری فنی)' : 'OPERATIONS (Maintenance)',
      ratings: {
        residential: 'core',
        office: 'core',
        retail: 'core',
        hospitality: 'core',
        industrial: 'core',
        logistics: 'core',
        automotive: 'core',
        'mixed-use': 'core',
      },
    },
    {
      family: lang === 'ro' ? 'C&E (Comunitate & Rezidenți)' : lang === 'fa' ? 'جامعه و ساکنان (C&E)' : 'C&E (Occupant Experience)',
      ratings: {
        residential: 'core',
        office: 'common',
        retail: 'common',
        hospitality: 'core',
        industrial: 'optional',
        logistics: 'optional',
        automotive: 'common',
        'mixed-use': 'core',
      },
    },
    {
      family: lang === 'ro' ? 'DOCUMENTS (Arhivă & Seif)' : lang === 'fa' ? 'اسناد (بایگانی و مدارک)' : 'DOCUMENTS (Vault & Archive)',
      ratings: {
        residential: 'core',
        office: 'core',
        retail: 'core',
        hospitality: 'core',
        industrial: 'core',
        logistics: 'core',
        automotive: 'core',
        'mixed-use': 'core',
      },
    },
    {
      family: lang === 'ro' ? 'FIN01 (Registru Financiar)' : lang === 'fa' ? 'دفتر مالی (FIN01)' : 'FIN01 (Financial Truth)',
      ratings: {
        residential: 'core',
        office: 'core',
        retail: 'core',
        hospitality: 'dependent',
        industrial: 'dependent',
        logistics: 'common',
        automotive: 'dependent',
        'mixed-use': 'core',
      },
    },
    {
      family: lang === 'ro' ? 'BK01 (Capacitate & Timp)' : lang === 'fa' ? 'ظرفیت و تقویم (BK01)' : 'BK01 (Capacity & Booking)',
      ratings: {
        residential: 'common',
        office: 'core',
        retail: 'optional',
        hospitality: 'core',
        industrial: 'optional',
        logistics: 'core',
        automotive: 'optional',
        'mixed-use': 'core',
      },
    },
    {
      family: lang === 'ro' ? 'COMUNICAȚII & Decizii' : lang === 'fa' ? 'مکاتبات و تصمیمات' : 'COMMUNICATIONS & Notices',
      ratings: {
        residential: 'core',
        office: 'core',
        retail: 'common',
        hospitality: 'common',
        industrial: 'common',
        logistics: 'common',
        automotive: 'common',
        'mixed-use': 'core',
      },
    },
  ];

  const getRatingBadge = (rating: string) => {
    switch (rating) {
      case 'core':
        return (
          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-bold bg-teal-50 text-[#0E9F8E] border border-teal-200">
            {content.matrixSection.legend.core}
          </span>
        );
      case 'common':
        return (
          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-[#1E40AF] border border-blue-200">
            {content.matrixSection.legend.common}
          </span>
        );
      case 'optional':
        return (
          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-slate-50 text-[#52667A] border border-slate-200">
            {content.matrixSection.legend.optional}
          </span>
        );
      case 'dependent':
        return (
          <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-[#B45309] border border-amber-200">
            {content.matrixSection.legend.dependent}
          </span>
        );
      default:
        return null;
    }
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
              <Layers className="w-3.5 h-3.5" />
              <span>{content.hero.badge}</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-extrabold text-[#102A43] tracking-tight">
              {content.hero.title}
            </h1>
            <p className="text-base sm:text-lg text-[#52667A] leading-relaxed max-w-3xl">
              {content.hero.subtitle}
            </p>
            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <a
                href="#contexts"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0E9F8E] text-white text-xs font-bold hover:bg-[#0C8778] transition shadow-card"
              >
                <span>{content.hero.ctaPrimary}</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
              </a>
              <Link
                href={`/${lang}/platform/architecture`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white text-[#102A43] border border-[#D3DCE6] text-xs font-bold hover:bg-[#F6F9FC] transition shadow-card"
              >
                <span>{content.hero.ctaSecondary}</span>
              </Link>
            </div>
          </div>
        </section>

        {/* 02 COMPOSITION VS FORKS */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.compositionVsForks.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.compositionVsForks.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.compositionVsForks.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {content.compositionVsForks.points.map((pt, idx) => (
              <div key={idx} className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0E9F8E] flex items-center justify-center font-bold text-xs">
                  0{idx + 1}
                </div>
                <h3 className="text-base font-bold text-[#102A43]">{pt.title}</h3>
                <p className="text-xs text-[#52667A] leading-relaxed">{pt.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 03 INDUSTRY CONTEXT GRID (8 CANONICAL INDUSTRIES) */}
        <section id="contexts" className="space-y-8 scroll-mt-28">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.gridSection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.gridSection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.gridSection.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {industriesList.map((ind) => {
              const Icon = ind.icon;
              return (
                <div
                  key={ind.id}
                  className="bg-white rounded-2xl p-6 border border-[#D3DCE6] shadow-card hover:border-[#0E9F8E] transition flex flex-col justify-between space-y-5"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F6F9FC] text-[#52667A] border border-[#E2E8F0]">
                        {ind.badge}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-bold text-[#102A43]">{ind.name}</h3>
                      <p className="text-xs text-[#52667A] mt-1 leading-relaxed">
                        {ind.propertyContext}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#F0F4F8] space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E9F8E]">
                        {lang === 'ro' ? 'Model Operațional' : lang === 'fa' ? 'مدل بهره‌برداری' : 'Operating Model'}
                      </span>
                      <p className="text-[11px] text-[#334E68] leading-tight">
                        {ind.operatingModel}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[#F0F4F8] space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#0E9F8E]">
                        {lang === 'ro' ? 'Preocupări Reprezentative de Industrie' : lang === 'fa' ? 'دغدغه‌های عملیاتی این حوزه' : 'Representative Operational Concerns'}
                      </span>
                      <p className="text-[11px] text-[#52667A] leading-relaxed">
                        {ind.concerns}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[#F0F4F8]">
                    <div className="flex flex-wrap gap-1">
                      {ind.relevantDomains.map((dom) => (
                        <span
                          key={dom}
                          className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[#F6F9FC] text-[#102A43] border border-[#E2E8F0]"
                        >
                          {dom}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 04 COMPOSABLE DIMENSIONS */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.dimensionsSection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.dimensionsSection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.dimensionsSection.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.dimensionsSection.dimensions.map((dim, idx) => {
              const DimIcon = dim.icon;
              return (
                <div key={idx} className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center shrink-0">
                      <DimIcon className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm font-bold text-[#102A43]">{dim.name}</h3>
                  </div>
                  <p className="text-xs text-[#52667A] leading-relaxed">{dim.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 05 DOMAIN COMPOSITION EXAMPLES */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.domainComposition.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.domainComposition.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.domainComposition.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {content.domainComposition.examples.map((ex, idx) => (
              <div key={idx} className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <h3 className="text-sm font-bold text-[#102A43]">{ex.context}</h3>
                  <span className="text-[11px] font-mono text-[#0E9F8E] font-semibold">{ex.formula}</span>
                </div>
                <p className="text-xs text-[#52667A] leading-relaxed">{ex.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 06 INDUSTRY RELEVANCE MATRIX */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.matrixSection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.matrixSection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.matrixSection.subtitle}
            </p>
          </div>

          {/* Desktop Table View */}
          <div className="overflow-x-auto border border-[#E2E8F0] rounded-2xl">
            <table className="w-full text-xs text-left rtl:text-right border-collapse">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#102A43] font-bold">
                <tr>
                  <th scope="col" className="p-3.5 min-w-[180px]">
                    {lang === 'ro' ? 'Domeniu / Provider' : lang === 'fa' ? 'دامنه / ارائه‌دهنده' : 'Domain / Provider'}
                  </th>
                  <th scope="col" className="p-3.5 text-center min-w-[90px]">Residential</th>
                  <th scope="col" className="p-3.5 text-center min-w-[90px]">Office</th>
                  <th scope="col" className="p-3.5 text-center min-w-[90px]">Retail</th>
                  <th scope="col" className="p-3.5 text-center min-w-[90px]">Hospitality</th>
                  <th scope="col" className="p-3.5 text-center min-w-[90px]">Industrial</th>
                  <th scope="col" className="p-3.5 text-center min-w-[90px]">Logistics</th>
                  <th scope="col" className="p-3.5 text-center min-w-[90px]">Automotive</th>
                  <th scope="col" className="p-3.5 text-center min-w-[90px]">Mixed-Use</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {matrixData.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-[#F6F9FC] transition-colors">
                    <td className="p-3.5 font-bold text-[#102A43] whitespace-nowrap">
                      {row.family}
                    </td>
                    <td className="p-3.5 text-center">{getRatingBadge(row.ratings.residential)}</td>
                    <td className="p-3.5 text-center">{getRatingBadge(row.ratings.office)}</td>
                    <td className="p-3.5 text-center">{getRatingBadge(row.ratings.retail)}</td>
                    <td className="p-3.5 text-center">{getRatingBadge(row.ratings.hospitality)}</td>
                    <td className="p-3.5 text-center">{getRatingBadge(row.ratings.industrial)}</td>
                    <td className="p-3.5 text-center">{getRatingBadge(row.ratings.logistics)}</td>
                    <td className="p-3.5 text-center">{getRatingBadge(row.ratings.automotive)}</td>
                    <td className="p-3.5 text-center">{getRatingBadge(row.ratings['mixed-use'])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 pt-2 text-xs">
            <span className="font-bold text-[#102A43]">
              {lang === 'ro' ? 'Legendă Niveluri:' : lang === 'fa' ? 'راهنمای نشان‌ها:' : 'Relevance Legend:'}
            </span>
            {getRatingBadge('core')}
            {getRatingBadge('common')}
            {getRatingBadge('optional')}
            {getRatingBadge('dependent')}
          </div>
        </section>

        {/* 07 MIXED-USE REFERENCE ARCHITECTURE */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.mixedUseSection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.mixedUseSection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.mixedUseSection.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                {lang === 'ro' ? 'Capcana Silozurilor Tradiționale' : lang === 'fa' ? 'دام نرم‌افزارهای سنتی' : 'The Legacy Fragmentation Dilemma'}
              </span>
              <p className="text-xs text-amber-950 leading-relaxed">
                {content.mixedUseSection.challenge}
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-teal-50/60 border border-teal-200/80 space-y-3">
              <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
                {lang === 'ro' ? 'Modelul de Compoziție CLADORA' : lang === 'fa' ? 'الگوی یکپارچه کلادورا' : 'The CLADORA Composable Model'}
              </span>
              <p className="text-xs text-[#0F3B37] leading-relaxed">
                {content.mixedUseSection.solution}
              </p>
            </div>
          </div>
        </section>

        {/* 08 AVAILABILITY GOVERNANCE */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-2">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.availability.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.availability.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.availability.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {content.availability.factors.map((factor, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] flex items-start gap-3">
                <CheckCircle2 className="w-4 h-4 text-[#0E9F8E] shrink-0 mt-0.5" />
                <span className="text-xs text-[#334E68] leading-relaxed">{factor}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 09 FINAL CTA */}
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
              <span>{content.cta.primary}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
            <Link
              href={`/${lang}/contact`}
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-white text-[#102A43] text-xs font-bold hover:bg-slate-100 transition flex items-center justify-center gap-2"
            >
              <span>{content.cta.secondary}</span>
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
