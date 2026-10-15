import type { Metadata } from 'next';
import { getRouteMetadata } from '@/config/routes-metadata';
import React from 'react';
import Link from 'next/link';
import { Language } from '@/types';
import { 
  Building, 
  TrendingUp, 
  Building2, 
  Layers, 
  Home, 
  FileCheck2, 
  ArrowRight, 
  ShieldCheck, 
  Compass, 
  Workflow, 
  Boxes, 
  Cpu, 
  GitBranch, 
  KeyRound, 
  Clock, 
  CheckCircle2, 
  Users 
} from 'lucide-react';
import { SharedActorModelSection } from '@/components/solutions/SharedActorModelSection';
import { DomainCompositionMatrix } from '@/components/solutions/DomainCompositionMatrix';
import { AvailabilityGovernanceSection } from '@/components/solutions/AvailabilityGovernanceSection';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/solutions', params.lang);
}

export default async function SolutionsHubPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        current: 'Arhitectura Soluțiilor',
      },
      hero: {
        badge: 'ARHITECTURA SOLUȚIILOR PE ROLURI & RELAȚII',
        title: 'O Singură Arhitectură de Platformă. Relații de Actori Diferite.',
        subtitle:
          'Un singur context imobiliar. Relații juridice și operaționale diferite. CLADORA nu creează șase produse software separate, ci compune spațiul de lucru și capabilitățile adecvate pentru fiecare participant autorizat.',
        ctaPrimary: 'Descoperă Audiențele Canonice',
        ctaSecondary: 'Arhitectura Platformei',
      },
      positioning: {
        badge: 'POZIȚIONARE CANONICĂ',
        title: 'Soluție ≠ Siloz de Produs',
        p1: 'În arhitectura CLADORA, soluțiile pentru Dezvoltatori, Proprietari, Asociații, Administratori, Rezidenți și Furnizori nu reprezintă baze de date paralele sau aplicații izolate. Ele sunt vederi compuse peste aceeași fundație unificată de proprietate și autoritate.',
        p2: 'O persoană sau o organizație poate participa în platformă prin multiple relații simultane: proprietar într-un imobil, membru de comitet în altul, chiriaș într-un spațiu de birouri și reprezentant tehnic pentru un prestator. Sistemul rezolvă contextul și mandatul înainte de a acorda autoritate.',
        points: [
          {
            title: 'Un Singur Adevăr de Proprietate',
            desc: 'Toate fluxurile se ancorează în identitatea persistentă a activului fizic gestionată în CORE.',
          },
          {
            title: 'Fără Registre Financiare Paralele',
            desc: 'Adevărul financiar aparține exclusiv furnizorului FIN01; nicio soluție nu deține un registru paralel.',
          },
          {
            title: 'Autoritate Derivată din Mandat',
            desc: 'Numele rolului nu conferă drepturi automate; autoritatea depinde de workspace, resursă, perimetru și timp.',
          },
        ],
      },
      audiencesSection: {
        badge: 'AUDIENȚELE CANONICE CLADORA',
        title: 'Cele 6 Contexte Canonice de Participare',
        subtitle:
          'Explorează modul în care aceeași arhitectură servește fiecare actor cheie din ecosistemul imobiliar.',
      },
      compositionSection: {
        badge: 'MODELUL DE COMPOZIȚIE',
        title: 'Cum Se Compun Soluțiile peste Furnizorii Canonici',
        p: 'Soluțiile CLADORA nu dețin date sursă. Ele compun vederi specializate consumând servicii de la furnizorii canonici independenți.',
        pillars: [
          {
            domain: 'CORE',
            role: 'Identitate imobil, delimitare workspace, relații contractuale și autoritate scopată.',
          },
          {
            domain: 'DOCUMENTS',
            role: 'Seif tehnic, cartea clădirii, dovezi fotografice și proveniență imuabilă a fișierelor.',
          },
          {
            domain: 'FIN01',
            role: 'Evidență financiară statutară și control analitic suplimentar, cote și reconciliere.',
          },
          {
            domain: 'AIRPROP',
            role: 'Marketing imobiliar, oportunități, antecontracte, gestiune chirii și mandate.',
          },
          {
            domain: 'SERVICE',
            role: 'Catalog de servicii, cereri structurate, devize comparative și comenzi.',
          },
          {
            domain: 'OPERATIONS',
            role: 'Registru echipamente, dispecerat tichete, comenzi de lucru și planuri preventive.',
          },
          {
            domain: 'COMMUNICATIONS',
            role: 'Avizier digital oficial, notificări auditate și evidența comunicărilor statutare.',
          },
          {
            domain: 'BK01',
            role: 'Disponibilitate, calendare de resurse și rezervări de spații comune.',
          },
          {
            domain: 'C&E',
            role: 'Compoziția experienței locative, ghiduri de clădire și interacțiune de proximitate.',
          },
          {
            domain: 'INTELLIGENCE',
            role: 'Orchestrare asistivă subordonată, ghidată de context și validată de autoritatea umană.',
          },
        ],
      },
      lifecycleSection: {
        badge: 'PARTICIPARE ÎN CICLUL DE VIAȚĂ',
        title: 'Implicarea Actorilor de-a Lungul Vieții Imobilului',
        subtitle:
          'Fiecare participant intervine în etape specifice ale existenței activului, păstrând continuitatea istorică și legală.',
        stages: [
          {
            step: '01',
            name: 'Proiect & Pre-vânzare',
            actors: 'Dezvoltatori, Cumpărători',
            desc: 'Definirea identității digitale, structura unităților și antecontracte în AIRPROP.',
          },
          {
            step: '02',
            name: 'Predare & Recepție',
            actors: 'Dezvoltatori, Asociații, Proprietari',
            desc: 'Protocol formal de predare-primire, transferul cărții tehnice în DOCUMENTS.',
          },
          {
            step: '03',
            name: 'Exploatare Activă',
            actors: 'Asociații, Administratori, Rezidenți',
            desc: 'Administrare curentă, repartizarea cotelor în FIN01, comunicări și avizier digital.',
          },
          {
            step: '04',
            name: 'Mentenanță & Lucrări',
            actors: 'Furnizori de Servicii, Administratori',
            desc: 'Tichete tehnice în OPERATIONS, comenzi de lucru, intervenții și recepție confirmată.',
          },
          {
            step: '05',
            name: 'Închiriere & Exploatare',
            actors: 'Proprietari, Chiriași, Manageri',
            desc: 'Separarea cheltuielilor de consum de fondurile proprietarului, continuitate contracte.',
          },
          {
            step: '06',
            name: 'Tranziție & Succesiune',
            actors: 'Noi Proprietari, Succesori, Administratori',
            desc: 'Transfer ordonat de responsabilitate și istoric operațional complet, fără pierderi de date.',
          },
        ],
      },
      crossConnections: {
        industries: {
          badge: 'CONEXIUNE CU INDUSTRIILE',
          title: 'Aceiași Actori, Tipologii Imobiliare Multiple',
          desc: 'Un administrator sau proprietar poate opera în medii rezidențiale, spații de birouri, parcuri logistice sau ansambluri cu destinație mixtă. Platforma compune regulile în funcție de tipologia clădirii fără a rescrie logica de bază.',
          link: 'Explorează Contextele de Industrie',
        },
        capabilities: {
          badge: 'CONEXIUNE CU CAPABILITĂȚILE',
          title: 'Ancorare Strictă în Furnizorii Canonici',
          desc: 'Soluțiile nu conțin cod duplicat de tranzacții sau gestiune de fișiere. Ele consumă direct din cele 14 familii de capabilități guvernate prin matricea arhitecturală de adevăr.',
          link: 'Explorează Arhitectura Capabilităților',
        },
        intelligence: {
          badge: 'CONEXIUNE CU INTELIGENȚA',
          title: 'Asistență Contextuală Subordonată',
          desc: 'CLADORA Intelligence oferă asistență adaptată rolului: sinteze de facturi pentru administratori, asistență foto la contoare pentru rezidenți sau devize structurate pentru prestatori — respectând întotdeauna autoritatea umană decizională.',
          link: 'Descoperă CLADORA Intelligence',
        },
      },
      cta: {
        title: 'Pregătit să structurezi operațiunile imobilului tău?',
        subtitle:
          'Stabilește un dialog tehnic cu echipa CLADORA pentru a discuta compoziția platformei pentru contextul tău specific.',
        primary: 'Inițiază Parteneriatul',
        secondary: 'Explorează Arhitectura',
      },
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        current: 'Solutions Architecture',
      },
      hero: {
        badge: 'SOLUTIONS ARCHITECTURE BY ROLE & RELATIONSHIP',
        title: 'One Platform Architecture. Different Actor Relationships.',
        subtitle:
          'One persistent property context. Diverse legal and operational relationships. CLADORA does not build six siloed software products; it composes the right workspace and capabilities for each authorized participant.',
        ctaPrimary: 'Explore Canonical Audiences',
        ctaSecondary: 'Platform Architecture',
      },
      positioning: {
        badge: 'CANONICAL POSITIONING',
        title: 'Solution != Product Silo',
        p1: 'In the CLADORA architecture, solutions for Developers, Property Owners, Associations, Property Managers, Residents, and Service Providers are not separate databases or isolated codebases. They are composed views over the shared foundation of property identity and verified authority.',
        p2: 'A single person or organization can participate in CLADORA across multiple relationships simultaneously: an owner in Building A, a board member in Building B, a tenant in Office Park C, and a contractor representative in Estate D. The platform resolves context and mandate before granting authority.',
        points: [
          {
            title: 'Single Property Truth',
            desc: 'All operational workflows anchor to the persistent physical asset identity managed in CORE.',
          },
          {
            title: 'No Parallel Financial Ledgers',
            desc: 'Financial truth belongs strictly to FIN01; no solution maintains a disconnected ledger.',
          },
          {
            title: 'Authority Derived from Mandate',
            desc: 'Persona labels never grant automatic rights; authority strictly derives from workspace, resource, scope, and time.',
          },
        ],
      },
      audiencesSection: {
        badge: 'CANONICAL AUDIENCES',
        title: 'The 6 Canonical Participant Contexts',
        subtitle:
          'Explore how the same platform architecture creates tailored workspaces for every key actor in the built environment.',
      },
      compositionSection: {
        badge: 'COMPOSITION MODEL',
        title: 'How Solutions Compose Over Canonical Providers',
        p: 'CLADORA Solution pages do not own raw business data. They compose specialized participant experiences by routing actions to independent, single-capability canonical providers.',
        pillars: [
          {
            domain: 'CORE',
            role: 'Asset identity, workspace boundaries, contractual relationships, and scoped authority.',
          },
          {
            domain: 'DOCUMENTS',
            role: 'Technical vaults, building logbooks, photographic evidence, and immutable provenance.',
          },
          {
            domain: 'FIN01',
            role: 'Statutory accounting records, supplemental double-entry ledger controls, and reconciliation.',
          },
          {
            domain: 'AIRPROP',
            role: 'Real estate showcase, pre-sales tracking, lease administration, and mandate handshakes.',
          },
          {
            domain: 'SERVICE',
            role: 'Service catalog, structured requests, side-by-side quote scopes, and order semantics.',
          },
          {
            domain: 'OPERATIONS',
            role: 'Equipment registries, ticket triage, work order dispatch, and preventative maintenance.',
          },
          {
            domain: 'COMMUNICATIONS',
            role: 'Official digital bulletin boards, auditable notices, and statutory communication journals.',
          },
          {
            domain: 'BK01',
            role: 'Resource schedules, availability rules, and shared facility reservation intents.',
          },
          {
            domain: 'C&E',
            role: 'Community experience composition, localized place guides, and residential journeys.',
          },
          {
            domain: 'INTELLIGENCE',
            role: 'Subordinate, context-aware assistive orchestration strictly governed by human policies.',
          },
        ],
      },
      lifecycleSection: {
        badge: 'LIFECYCLE PARTICIPATION',
        title: 'Participant Engagement Across the Asset Lifecycle',
        subtitle:
          'Every participant steps in during specific lifecycle phases, preserving operational and legal continuity throughout.',
        stages: [
          {
            step: '01',
            name: 'Plan & Pre-Sale',
            actors: 'Developers, Pre-Buyers',
            desc: 'Early digital identity definition, unit hierarchy, and commercial pre-sale agreements in AIRPROP.',
          },
          {
            step: '02',
            name: 'Handover & Onboarding',
            actors: 'Developers, Associations, Owners',
            desc: 'Formal digital handover protocol, transferring the technical blueprint vault into DOCUMENTS.',
          },
          {
            step: '03',
            name: 'Active Operations',
            actors: 'Associations, Managers, Residents',
            desc: 'Day-to-day administration, monthly charge allocation in FIN01, official notice board posts.',
          },
          {
            step: '04',
            name: 'Maintenance & Service',
            actors: 'Service Providers, Managers',
            desc: 'Issue ticketing in OPERATIONS, verified work orders, photographic completion sign-offs.',
          },
          {
            step: '05',
            name: 'Leasing & Occupancy',
            actors: 'Owners, Tenants, Managers',
            desc: 'Clear segregation between tenant utility consumption and owner capital reserve funds.',
          },
          {
            step: '06',
            name: 'Transfer & Succession',
            actors: 'New Owners, Successors, Operators',
            desc: 'Orderly transfer of administrative mandates and auditable records without data fragmentation.',
          },
        ],
      },
      crossConnections: {
        industries: {
          badge: 'INDUSTRIES CONNECTION',
          title: 'Same Actors, Multiple Property Typologies',
          desc: 'A property manager or owner may operate across residential blocks, commercial office towers, logistics parks, or mixed-use assets. The platform composes typology rules without rewriting underlying foundational models.',
          link: 'Explore Industries Architecture',
        },
        capabilities: {
          badge: 'CAPABILITIES CONNECTION',
          title: 'Anchored Directly to Canonical Truth Providers',
          desc: 'Solutions do not contain duplicate billing or document code. They route directly to the 14 capability families governed by the architectural truth matrix.',
          link: 'Explore Capabilities Architecture',
        },
        intelligence: {
          badge: 'INTELLIGENCE CONNECTION',
          title: 'Governed Subordinate Assistance',
          desc: 'CLADORA Intelligence delivers role-specific assistive features: invoice data extraction for managers, photo meter OCR for residents, and structured work-order drafting for contractors — always preserving human final authority.',
          link: 'Explore CLADORA Intelligence',
        },
      },
      cta: {
        title: 'Ready to structure your property operations?',
        subtitle:
          'Initiate an enterprise consultation with the CLADORA team to evaluate how platform architecture composes for your specific organization.',
        primary: 'Start Partnership',
        secondary: 'Explore Platform',
      },
    },
    fa: {
      breadcrumbs: {
        home: 'خانه',
        current: 'معماری راهکارها',
      },
      hero: {
        badge: 'معماری راهکارها بر اساس جایگاه و روابط حقوقی',
        title: 'یک معماری واحد. روابط حقوقی و عملیاتی گوناگون.',
        subtitle:
          'یک بستر پایدار ملکی. روابط حقوقی و نقش‌های عملیاتی متمایز. کلادورا شش محصول نرم‌افزاری مجزا ایجاد نمی‌کند؛ بلکه ورک‌اسپیس و قابلیت‌های منطبق با اختیارات هر مشارکت‌کننده را به صورت یکپارچه ترکیب می‌نماید.',
        ctaPrimary: 'مشاهده مخاطبان کانونی',
        ctaSecondary: 'معماری پلتفرم',
      },
      positioning: {
        badge: 'موضع‌گیری اصولی معماری',
        title: 'راهکار ≠ جزیرهٔ نرم‌افزاری جداگانه',
        p1: 'در معماری کلادورا، راهکارهای مربوط به سازندگان، مالکان، مجتمع‌ها، شرکت‌های مدیریت، ساکنان و ارائه‌دهندگان خدمات، سیستم‌های نرم‌افزاری مستقل یا پایگاه‌های داده مجزا نیستند؛ بلکه نماهای ترکیبی تخصصی بر روی داده‌های مشترک هویت دارایی و اختیارات تفویض‌شده هستند.',
        p2: 'یک فرد یا سازمان می‌تواند همزمان در چندین رابطه حقوقی با املاک مختلف مشارکت داشته باشد: مالک در مجتمع الف، عضو هیئت‌مدیره در ساختمان ب، مستأجر در یک واحد اداری ج و نماینده پیمانکار در مجتمع د. سیستم ابتدا جایگاه و مجوزها را اعتبارسنجی می‌کند و سپس اختیارات را اعمال می‌نماید.',
        points: [
          {
            title: 'حقیقت واحد ملک فیزیکی',
            desc: 'کلیه جریان‌های کاری به شناسه پایدار دارایی فیزیکی در متولی CORE متصل هستند.',
          },
          {
            title: 'عدم ایجاد دفاتر مالی موازی',
            desc: 'حقیقت اسناد مالی منحصراً متعلق به FIN01 است و هیچ راهکاری دفتر کل جداگانه تشکیل نمی‌دهد.',
          },
          {
            title: 'اختیارات بر پایه مجوز و مصوبه',
            desc: 'عناوین کاربری به خودی خود دسترسی ایجاد نمی‌کنند؛ اختیارات تابع ورک‌اسپیس، منبع، محدوده و زمان است.',
          },
        ],
      },
      audiencesSection: {
        badge: 'مخاطبان کانونی کلادورا',
        title: '۶ بستر کانونی مشارکت در پلتفرم',
        subtitle:
          'بررسی نمایید که چگونه یک معماری مشترک، تجربه کاری اختصاصی هر یک از بازیگران کلیدی حوزه املاک را شکل می‌دهد.',
      },
      compositionSection: {
        badge: 'مدل ترکیب معماری',
        title: 'نحوه ترکیب راهکارها بر روی ارائه‌دهندگان مرجع',
        p: 'صفحات راهکارها مالک داده‌های خام نیستند؛ بلکه با ارسال درخواست به متولیان اصلی داده‌ها، نماهای متناسب با هر نقش را فراهم می‌سازند.',
        pillars: [
          {
            domain: 'CORE',
            role: 'هویت پایدار ملک، مرزهای ایزوله ورک‌اسپیس، روابط قراردادی و اختیارات زمانی.',
          },
          {
            domain: 'DOCUMENTS',
            role: 'شناسنامه فنی، بایگانی نقشه‌ها، مدارک تصویری و اصالت غیرقابل‌تغییر فایل‌ها.',
          },
          {
            domain: 'FIN01',
            role: 'دفاتر مالی قانونی، ترازهای تحلیلی تکمیلی دوطرفه و تطبیق صورت‌حساب‌ها.',
          },
          {
            domain: 'AIRPROP',
            role: 'عرضه املاک، پیگیری پیش‌فروش، مدیریت قراردادهای اجاره و واگذاری مدیریت.',
          },
          {
            domain: 'SERVICE',
            role: 'کاتالوگ خدمات، ثبت ساختاریافته درخواست، مقایسه پیشنهادها و سفارش کار.',
          },
          {
            domain: 'OPERATIONS',
            role: 'شناسنامه تجهیزات، بررسی تیکت‌ها، صدور دستورکار فنی و برنامه‌های نگهداری.',
          },
          {
            domain: 'COMMUNICATIONS',
            role: 'تابلو اعلانات دیجیتال رسمی، اطلاعیه‌های ممیزی‌شده و ثبت سوابق ابلاغ قانونی.',
          },
          {
            domain: 'BK01',
            role: 'تقویم منابع، قواعد ظرفیت و ثبت درخواست رزرو فضاهای مشاع ساختمان.',
          },
          {
            domain: 'C&E',
            role: 'تجربه تعاملی سکونت، راهنمای محلی اماکن و جریان‌های مشارکتی بهره‌برداران.',
          },
          {
            domain: 'INTELLIGENCE',
            role: 'ارکستراسیون کمکی و مقید به حاکمیت تحت نظارت و تایید نهایی انسان.',
          },
        ],
      },
      lifecycleSection: {
        badge: 'مشارکت در چرخهٔ عمر ملک',
        title: 'حضور نقش‌ها در مراحل گوناگون حیات دارایی',
        subtitle:
          'هر مشارکت‌کننده در فازهای مشخصی از چرخه دارایی وارد عمل می‌شود و پیوستگی اسناد و سوابق حفظ می‌گردد.',
        stages: [
          {
            step: '۰۱',
            name: 'تعریف و پیش‌فروش',
            actors: 'سازندگان، پیش‌خریداران',
            desc: 'ثبت هویت دیجیتال پروژه، ساختار طبقات و واحدها و قراردادهای پیش‌فروش در AIRPROP.',
          },
          {
            step: '۰۲',
            name: 'تحویل و راه‌اندازی',
            actors: 'سازندگان، انجمن‌ها، مالکان',
            desc: 'صورت‌جلسه دیجیتال تحویل واحدها و انتقال شناسنامه فنی و نقشه‌ها به DOCUMENTS.',
          },
          {
            step: '۰۳',
            name: 'بهره‌برداری فعال',
            actors: 'انجمن‌های مالکان، مدیران، ساکنان',
            desc: 'مدیریت جاری ساختمان، تسهیم مستند هزینه‌ها در FIN01 و تابلوی اعلانات رسمی.',
          },
          {
            step: '۰۴',
            name: 'تعمیرات و خدمات',
            actors: 'پیمانکاران، مدیران مجتمع',
            desc: 'ارجاع تیکت‌ها در OPERATIONS، صدور دستورکارهای فنی و تایید تصویری انجام کار.',
          },
          {
            step: '۰۵',
            name: 'اجاره و سکونت',
            actors: 'مالکان، مستأجران، مدیران',
            desc: 'تفکیک دقیق شارژ مصرفی جاری مستأجر از اندوخته‌های سرمایه‌ای و عمرانی مالک.',
          },
          {
            step: '۰۶',
            name: 'انتقال و واگذاری',
            actors: 'مالکان جدید، جانشینان، مدیران',
            desc: 'انتقال منظم مسئولیت‌ها و دسترسی به تاریخچه حساب‌ها بدون گم‌شدن داده‌ها.',
          },
        ],
      },
      crossConnections: {
        industries: {
          badge: 'پیوند با صنایع',
          title: 'همان نقش‌ها، کاربری‌های گوناگون ساختمانی',
          desc: 'یک مدیر یا مالک ممکن است در املاک مسکونی، برج‌های اداری، پارک‌های لجستیک یا مجتمع‌های چندمنظوره فعالیت کند. پلتفرم قواعد متناسب با هر کاربری را بدون تغییر زیرساخت اصلی هماهنگ می‌سازد.',
          link: 'مشاهده معماری صنایع',
        },
        capabilities: {
          badge: 'پیوند با قابلیت‌ها',
          title: 'اتصال مستقیم به ارائه‌دهندگان مرجع داده‌ها',
          desc: 'راهکارها فاقد کدهای موازی محاسباتی یا پایگاه اسناد جداگانه هستند و مستقیماً از ۱۴ خانواده قابلیتی متکی بر ماتریس معماری بهره می‌برند.',
          link: 'مشاهده معماری قابلیت‌ها',
        },
        intelligence: {
          badge: 'پیوند با هوشمندی سیستم',
          title: 'دستیار کمکی و مقید به ضوابط حاکمیتی',
          desc: 'هوشمندی کلادورا کارکردهای کمکی را متناسب با جایگاه ارائه می‌دهد: استخراج داده‌های قبوض برای مدیران، قرائت کنتورها برای ساکنان و برآورد فنی برای پیمانکاران — با حفظ اختیار نهایی انسان.',
          link: 'بررسی معماری هوشمندی کلادورا',
        },
      },
      cta: {
        title: 'آماده ارتقای ساختار عملیاتی املاک خود هستید؟',
        subtitle:
          'برای ارزیابی نحوه ترکیب معماری پلتفرم متناسب با ساختار سازمانی و نوع املاک خود با تیم کلادورا گفتگو کنید.',
        primary: 'شروع همکاری',
        secondary: 'بررسی معماری پلتفرم',
      },
    },
  }[lang];

  const audienceCards = [
    {
      id: 'developers',
      title: lang === 'ro' ? 'Dezvoltatori & Constructori' : lang === 'fa' ? 'سازندگان و توسعه‌دهندگان' : 'Developers & Builders',
      desc: lang === 'ro'
        ? 'Identitate digitală din faza de proiect, antecontracte în AIRPROP, cartea tehnică în DOCUMENTS și tranziție ordonată către operare post-predare.'
        : lang === 'fa'
        ? 'ثبت هویت دیجیتال ملک از فاز اولیه، تمهیدات تجاری در AIRPROP، بایگانی اسناد در DOCUMENTS و انتقال منظم به مرحله بهره‌برداری پس از تحویل.'
        : 'Establish digital asset identity early, track commercial pre-sales in AIRPROP, secure the technical blueprint vault, and conduct orderly operational handover.',
      href: `/${lang}/solutions/developers`,
      icon: Building,
      accent: 'border-l-4 border-l-[#102A43] rtl:border-l-0 rtl:border-r-4 rtl:border-r-[#102A43]',
    },
    {
      id: 'property-owners',
      title: lang === 'ro' ? 'Proprietari & Portofolii' : lang === 'fa' ? 'مالکان و سبد دارایی‌ها' : 'Property Owners & Portfolios',
      desc: lang === 'ro'
        ? 'Vizibilitate consolidată asupra activelor deținute, contractelor de închiriere și cheltuielilor, fără crearea de baze de date paralele față de FIN01.'
        : lang === 'fa'
        ? 'پایش متمرکز بر املاک ملکی، قراردادهای اجاره و هزینه‌های عملیاتی با اتکا به مرجع حقیقت مالی FIN01 بدون ایجاد پایگاه‌های داده موازی.'
        : 'Consolidated visibility across owned properties, tenant leases, and operational costs, anchored directly to single-capability financial truth in FIN01.',
      href: `/${lang}/solutions/property-owners`,
      icon: TrendingUp,
      accent: 'border-l-4 border-l-[#0E9F8E] rtl:border-l-0 rtl:border-r-4 rtl:border-r-[#0E9F8E]',
    },
    {
      id: 'associations',
      title: lang === 'ro' ? 'Asociații de Proprietari' : lang === 'fa' ? 'انجمن‌های مالکان و مجتمع‌ها' : 'Residential Associations & HOAs',
      desc: lang === 'ro'
        ? 'Concepută pentru a susține fluxurile asociațiilor de proprietari în cadrul Legii 196/2018: repartizarea cotelor, avizier digital și transparență decizională.'
        : lang === 'fa'
        ? 'طراحی‌شده برای تسهیل فرآیندهای مجتمع‌های مسکونی منطبق با چارچوب‌های قانونی: تسهیم مستند هزینه‌ها، تابلو اعلانات دیجیتال و ثبت تصمیمات مجامع.'
        : 'Designed to support residential association workflows within the framework of Romanian Law 196/2018: expense allocation, digital notice board, and governance records.',
      href: `/${lang}/solutions/associations`,
      icon: Building2,
      accent: 'border-l-4 border-l-[#2F80ED] rtl:border-l-0 rtl:border-r-4 rtl:border-r-[#2F80ED]',
    },
    {
      id: 'property-managers',
      title: lang === 'ro' ? 'Companii de Administrare' : lang === 'fa' ? 'شرکت‌های مدیریت املاک' : 'Property Management Firms',
      desc: lang === 'ro'
        ? 'Consolă de operare pentru portofolii multi-proprietate: coordonarea echipelor delegate, dispecerat tichete, vizibilitate financiară și relația cu ocupanții.'
        : lang === 'fa'
        ? 'کنسول عملیاتی برای مدیریت چندین مجتمع: تفویض اختیارات به تیم، ارجاع تیکت‌های فنی، شفافیت مالی و مدیریت تعاملات با بهره‌برداران.'
        : 'Operating console for multi-property portfolios: team delegation across isolated workspaces, maintenance triage, financial visibility, and occupant communications.',
      href: `/${lang}/solutions/property-managers`,
      icon: Layers,
      accent: 'border-l-4 border-l-[#D99B26] rtl:border-l-0 rtl:border-r-4 rtl:border-r-[#D99B26]',
    },
    {
      id: 'residents',
      title: lang === 'ro' ? 'Rezidenți & Ocupanți' : lang === 'fa' ? 'ساکنان و بهره‌برداران' : 'Residents & Occupants',
      desc: lang === 'ro'
        ? 'Transparență autorizată asupra cotelor de întreținere, transmiterea indexurilor foto, semnalarea incidentelor tehnice și comunicare oficială.'
        : lang === 'fa'
        ? 'مشاهده شفاف فیش شارژ ماهانه، ثبت تصویری ارقام کنتورها، اعلام سریع درخواست‌های تعمیرات و دریافت اطلاعیه‌های رسمی ساختمان.'
        : 'Authorized transparency into maintenance charges, photo-assisted meter submission, issue ticketing, and verified community announcements.',
      href: `/${lang}/solutions/residents`,
      icon: Home,
      accent: 'border-l-4 border-l-[#0A6E62] rtl:border-l-0 rtl:border-r-4 rtl:border-r-[#0A6E62]',
    },
    {
      id: 'service-providers',
      title: lang === 'ro' ? 'Furnizori de Servicii' : lang === 'fa' ? 'ارائه‌دهندگان خدمات و پیمانکاران' : 'Service Providers & Vendors',
      desc: lang === 'ro'
        ? 'Coordonarea intervențiilor tehnice: comenzi de lucru autorizate prin OPERATIONS, devize clare în SERVICE, probe foto la recepție și decontare ordonată.'
        : lang === 'fa'
        ? 'هماهنگی دستورکارهای فنی از طریق OPERATIONS، برآورد شفاف هزینه در SERVICE، مستندسازی تصویری تحویل کار و ثبت منظم سوابق.'
        : 'Coordinate maintenance delivery: verified work orders via OPERATIONS, structured quote scope in SERVICE, photographic sign-off evidence, and auditable records.',
      href: `/${lang}/solutions/service-providers`,
      icon: FileCheck2,
      accent: 'border-l-4 border-l-[#627D98] rtl:border-l-0 rtl:border-r-4 rtl:border-r-[#627D98]',
    },
  ];

  return (
    <main className="min-h-screen pt-28 pb-20 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        
        {/* 01: BREADCRUMBS & HERO */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 text-xs text-[#52667A] font-medium">
            <Link href={`/${lang}`} className="hover:text-[#102A43] transition-colors">
              {content.breadcrumbs.home}
            </Link>
            <span>/</span>
            <span className="text-[#102A43] font-bold">
              {content.breadcrumbs.current}
            </span>
          </div>

          <div className="card-proptech p-8 sm:p-12 bg-white border-[#D3DCE6] space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#EAF8F5] text-xs font-bold text-[#0A6E62] border border-[#B2E5DF]">
              <ShieldCheck className="w-4 h-4 text-[#0E9F8E]" />
              <span>{content.hero.badge}</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-display font-extrabold text-[#102A43] tracking-tight max-w-4xl">
              {content.hero.title}
            </h1>

            <p className="text-base sm:text-lg text-[#52667A] max-w-3xl leading-relaxed">
              {content.hero.subtitle}
            </p>

            <div className="pt-2 flex flex-wrap gap-4">
              <a
                href="#audiences-grid"
                className="px-6 py-3.5 rounded-xl bg-[#0E9F8E] hover:bg-[#0C8778] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
              >
                <span>{content.hero.ctaPrimary}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </a>
              <Link
                href={`/${lang}/platform/architecture`}
                className="px-6 py-3.5 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#102A43] text-xs font-bold transition-all flex items-center gap-2"
              >
                <GitBranch className="w-4 h-4" />
                <span>{content.hero.ctaSecondary}</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 02: ONE PLATFORM — DIFFERENT RELATIONSHIPS (CORE POSITIONING) */}
        <section className="card-proptech p-8 sm:p-10 bg-white border-[#E2E8F0] space-y-8">
          <div className="max-w-3xl space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F0F4F8] text-xs font-bold text-[#334E68]">
              <Compass className="w-3.5 h-3.5 text-[#0E9F8E]" />
              <span>{content.positioning.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43] tracking-tight">
              {content.positioning.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.positioning.p1}
            </p>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.positioning.p2}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            {content.positioning.points.map((pt, i) => (
              <div key={i} className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#0E9F8E]" />
                  <h3 className="text-xs font-bold text-[#102A43]">{pt.title}</h3>
                </div>
                <p className="text-xs text-[#52667A] leading-relaxed">{pt.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 03: AUDIENCE GRID (THE 6 CANONICAL AUDIENCES) */}
        <section id="audiences-grid" className="space-y-8 scroll-mt-32">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF8F5] text-xs font-bold text-[#0A6E62]">
              <Users className="w-3.5 h-3.5 text-[#0E9F8E]" />
              <span>{content.audiencesSection.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43] tracking-tight">
              {content.audiencesSection.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.audiencesSection.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {audienceCards.map((aud) => {
              const Icon = aud.icon;
              return (
                <div
                  key={aud.id}
                  className={`card-proptech p-6 bg-white border-[#E2E8F0] ${aud.accent} flex flex-col justify-between space-y-6 hover:shadow-md transition-shadow`}
                >
                  <div className="space-y-4">
                    <div className="w-12 h-12 rounded-xl bg-[#F0F4F8] flex items-center justify-center text-[#102A43]">
                      <Icon className="w-6 h-6 text-[#0E9F8E]" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-base font-bold text-[#102A43]">
                        {aud.title}
                      </h3>
                      <p className="text-xs text-[#52667A] leading-relaxed">
                        {aud.desc}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#F0F4F8]">
                    <Link
                      href={aud.href}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0E9F8E] hover:text-[#0C8778] transition-colors"
                    >
                      <span>
                        {lang === 'ro'
                          ? 'Explorează Soluția'
                          : lang === 'fa'
                          ? 'مشاهده جزئیات راهکار'
                          : 'Explore Solution'}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 04 & 07: SHARED PROPERTY CONTEXT & AUTHORITY MODEL */}
        <SharedActorModelSection lang={lang} />

        {/* 05: HOW SOLUTIONS COMPOSE OVER CANONICAL PROVIDERS */}
        <section className="card-proptech p-8 sm:p-10 bg-white border-[#E2E8F0] space-y-8">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EAF8F5] text-xs font-bold text-[#0A6E62]">
              <Boxes className="w-3.5 h-3.5 text-[#0E9F8E]" />
              <span>{content.compositionSection.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43] tracking-tight">
              {content.compositionSection.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.compositionSection.p}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {content.compositionSection.pillars.map((pil, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
                <div className="inline-block px-2.5 py-0.5 rounded bg-[#102A43] text-white font-mono text-[10px] font-bold">
                  <bdi dir="ltr">{pil.domain}</bdi>
                </div>
                <p className="text-[11px] text-[#52667A] leading-relaxed">
                  {pil.role}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 06: DOMAINS ACROSS ACTORS MATRIX */}
        <DomainCompositionMatrix lang={lang} />

        {/* 08: LIFECYCLE PARTICIPATION */}
        <section className="card-proptech p-8 sm:p-10 bg-white border-[#E2E8F0] space-y-8">
          <div className="max-w-3xl space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F0F4F8] text-xs font-bold text-[#334E68]">
              <Clock className="w-3.5 h-3.5 text-[#0E9F8E]" />
              <span>{content.lifecycleSection.badge}</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-[#102A43] tracking-tight">
              {content.lifecycleSection.title}
            </h2>
            <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
              {content.lifecycleSection.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.lifecycleSection.stages.map((stg, i) => (
              <div key={i} className="p-5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-[#0E9F8E]">
                    {stg.step}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E2E8F0] text-[#334E68]">
                    {stg.actors}
                  </span>
                </div>
                <h3 className="text-xs font-bold text-[#102A43]">{stg.name}</h3>
                <p className="text-xs text-[#52667A] leading-relaxed">{stg.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 09, 10, 11: CROSS-CONNECTIONS (INDUSTRIES, CAPABILITIES, INTELLIGENCE) */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="card-proptech p-6 bg-white border-[#E2E8F0] flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-[#0A6E62] uppercase tracking-wider">
                {content.crossConnections.industries.badge}
              </div>
              <h3 className="text-sm font-bold text-[#102A43]">
                {content.crossConnections.industries.title}
              </h3>
              <p className="text-xs text-[#52667A] leading-relaxed">
                {content.crossConnections.industries.desc}
              </p>
            </div>
            <Link
              href={`/${lang}/industries`}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#0E9F8E] hover:text-[#0C8778] transition-colors"
            >
              <span>{content.crossConnections.industries.link}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
          </div>

          <div className="card-proptech p-6 bg-white border-[#E2E8F0] flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-[#0A6E62] uppercase tracking-wider">
                {content.crossConnections.capabilities.badge}
              </div>
              <h3 className="text-sm font-bold text-[#102A43]">
                {content.crossConnections.capabilities.title}
              </h3>
              <p className="text-xs text-[#52667A] leading-relaxed">
                {content.crossConnections.capabilities.desc}
              </p>
            </div>
            <Link
              href={`/${lang}/capabilities`}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#0E9F8E] hover:text-[#0C8778] transition-colors"
            >
              <span>{content.crossConnections.capabilities.link}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
          </div>

          <div className="card-proptech p-6 bg-white border-[#E2E8F0] flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="text-[10px] font-bold text-[#0A6E62] uppercase tracking-wider">
                {content.crossConnections.intelligence.badge}
              </div>
              <h3 className="text-sm font-bold text-[#102A43]">
                {content.crossConnections.intelligence.title}
              </h3>
              <p className="text-xs text-[#52667A] leading-relaxed">
                {content.crossConnections.intelligence.desc}
              </p>
            </div>
            <Link
              href={`/${lang}/ai`}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#0E9F8E] hover:text-[#0C8778] transition-colors"
            >
              <span>{content.crossConnections.intelligence.link}</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
          </div>
        </section>

        {/* 12: AVAILABILITY GOVERNANCE */}
        <AvailabilityGovernanceSection lang={lang} />

        {/* 13: FINAL CTA */}
        <section className="card-proptech p-8 sm:p-12 bg-white border-[#D3DCE6] text-center space-y-6">
          <h2 className="text-2xl sm:text-4xl font-display font-extrabold text-[#102A43]">
            {content.cta.title}
          </h2>
          <p className="text-xs sm:text-sm text-[#52667A] max-w-2xl mx-auto leading-relaxed">
            {content.cta.subtitle}
          </p>
          <div className="pt-2 flex flex-wrap justify-center gap-4">
            <Link
              href={`/${lang}/contact`}
              className="px-6 py-3.5 rounded-xl bg-[#0E9F8E] hover:bg-[#0C8778] text-white text-xs font-bold shadow-sm transition-all flex items-center gap-2"
            >
              <span>{content.cta.primary}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
            <Link
              href={`/${lang}/platform/architecture`}
              className="px-6 py-3.5 rounded-xl bg-[#F0F4F8] hover:bg-[#E2E8F0] text-[#102A43] text-xs font-bold transition-all"
            >
              {content.cta.secondary}
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
