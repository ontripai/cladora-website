import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import { getSiteUrl } from '@/config/site';
import { HelpCircle, ArrowRight, Info, ChevronDown } from 'lucide-react';

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'ro' }, { lang: 'fa' }];
}

export async function generateMetadata(
  props: {
    params: Promise<{ lang: Language }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  return getRouteMetadata('/faq', params.lang);
}

export default async function FaqCanonicalPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumbs: {
        home: 'Acasă',
        current: 'Întrebări Frecvente (FAQ)',
      },
      hero: {
        badge: 'Întrebări Frecvente & Răspunsuri Arhitecturale',
        title: 'Întrebări Frecvente despre Funcționarea & Arhitectura CLADORA',
        subtitle:
          'Clarificări detaliate privind modelul de platformă, autoritatea contextuală, migrarea datelor, securitatea și disponibilitatea capabilităților.',
      },
      disclaimer: {
        title: 'Notă privind Răspunsurile & Statutul de Disponibilitate',
        text: 'Răspunsurile reflectă modelul arhitectural aprobat al platformei CLADORA. Disponibilitatea unei capabilități specifice într-un proiect depinde de stadiul de maturitate al lansării, pachetul contractat și domeniul de implementare agreat.',
      },
      groups: [
        {
          groupTitle: 'Platformă & Arhitectură',
          items: [
            {
              q: 'Ce este CLADORA și cum se diferențiază de un soft tradițional de administrare (PMS)?',
              a: 'CLADORA este o platformă unificată de operare a proprietăților, concepută pentru a menține continuitatea datelor pe întreg ciclul de viață al unui activ. Spre deosebire de aplicațiile PMS convenționale care acționează ca silozuri izolate, CLADORA separă identitatea fizică a proprietății de spațiile de lucru organizaționale și folosește furnizori canonici unici pentru adevărul financiar, documentar și operațional.',
            },
            {
              q: 'Ce înseamnă principiul „sursă unică de adevăr canonic” în cadrul platformei?',
              a: 'Înseamnă că un singur domeniu desemnat are autoritate de scriere și custodie pentru o categorie critică de date: FIN01 pentru tranzacții și solduri financiare, DOCUMENTS pentru versiuni probatorii de fișiere, BK01 pentru rezervări și CORE pentru identitate și autoritate. Această abordare este concepută pentru a reduce ambiguitatea de reconciliere și riscul de erori, păstrând claritatea proprietății asupra adevărului operațional.',
            },
          ],
        },
        {
          groupTitle: 'Workspace-uri & Autoritate',
          items: [
            {
              q: 'Care este diferența dintre o Proprietate, un Workspace și o Persoană?',
              a: 'Proprietatea este activul fizic persistent (terenul, clădirea, spațiile comune). Workspace-ul este granița de colaborare, securitate și guvernanță a unei organizații (asociație de proprietari, dezvoltator sau firmă de property management). Persoana este utilizatorul uman care primește un rol temporar și autoritate delimitată într-un Workspace specific pe baza unei relații juridice atestate.',
            },
            {
              q: 'Poate un utilizator să dețină roluri multiple în clădiri diferite fără amestecarea datelor?',
              a: 'Da. Arhitectura decuplează identitatea persoanei de permisiunile din fiecare workspace. Aceeași persoană poate fi proprietar într-un imobil, membru în comitetul altuia și chiriaș într-un al treilea, comutând contextele de lucru în siguranță, fără riscul scurgerii de date între spații.',
            },
          ],
        },
        {
          groupTitle: 'Capabilități & Maturitate',
          items: [
            {
              q: 'Sunt toate capabilitățile descrise disponibile instantaneu în orice implementare?',
              a: 'Nu. CLADORA aplică o guvernanță strictă a disponibilității: relevanța arhitecturală a unui domeniu definește unde se încadrează logic o funcție, însă disponibilitatea sa efectivă depinde de nivelul de maturitate al lansării și de domeniul specific de implementare contractat.',
            },
            {
              q: 'Cum gestionează platforma utilitățile și repartizarea consumurilor?',
              a: 'Arhitectura permite definirea contoarelor fizice asociate resurselor, colectarea indexurilor verificate și transmiterea datelor către FIN01 pentru calculul cotelor de consum conform regulilor configurate pentru fiecare imobil.',
            },
          ],
        },
        {
          groupTitle: 'Soluții pe Contexte de Actori',
          items: [
            {
              q: 'Reprezintă cele 6 Soluții produse software separate?',
              a: 'Nu. Cele 6 Soluții (Dezvoltatori, Proprietari, Asociații, Administratori, Rezidenți, Furnizori de Servicii) reprezintă perspective operaționale și compoziții diferite ale ACELEIAȘI arhitecturi unice, adaptate la relațiile juridice și nivelul de autoritate al fiecărui actor.',
            },
            {
              q: 'Ce grad de vizibilitate financiară primește un rezident sau un chiriaș?',
              a: 'Vizibilitatea este strict delimitată: rezidenții și chiriașii primesc acces autorizat doar la propriile cote de întreținere, consumuri de utilități și tichete de asistență. Evidențele patrimoniale private, jurnalele extinse ale proprietarilor sau datele financiare ale altor vecini sunt inaccesibile.',
            },
          ],
        },
        {
          groupTitle: 'Industrii & Tipologii de Imobile',
          items: [
            {
              q: 'Este CLADORA dedicată exclusiv blocurilor rezidențiale?',
              a: 'Nu. Deși asociațiile rezidențiale reprezintă un context important, arhitectura compozabilă a CLADORA acoperă 8 industrii construite: rezidențial, birouri, spații comerciale, ospitalitate, spații industriale, parcuri logistice, facilități auto și ansambluri cu funcțiuni mixte.',
            },
            {
              q: 'Ce este ADN-ul Clădirii (Building DNA)?',
              a: 'ADN-ul Clădirii este conceptul arhitectural care descrie tipologia fizică și tehnică a unui activ (turn, comunitate orizontală, mall, parc logistic). El dictează ce module și parametri operaționali sunt relevanți, evitând crearea de versiuni rigide de software pentru fiecare domeniu.',
            },
          ],
        },
        {
          groupTitle: 'Migrare & Tranziție de Date',
          items: [
            {
              q: 'Este procesul de migrare de la sisteme legacy complet automatizat?',
              a: 'Nu. CLADORA promovează o metodologie controlată, asistată de instrumente de import, în care fiecare pas (inventariere, mapare a unităților, corelarea soldurilor și validarea paralelă) include puncte de verificare umană autorizată. Nu pretindem reconciliere automată fără intervenție.',
            },
            {
              q: 'Ce înseamnă principiul „Zero-Write” în procesul de migrare?',
              a: 'Arhitectura de migrare este concepută pentru a refuza mutațiile de stare atunci când autoritatea necesară, validarea, maparea schemei sau starea de migrare nu pot fi stabilite cu certitudine.',
            },
          ],
        },
        {
          groupTitle: 'Securitate, Încredere & GDPR',
          items: [
            {
              q: 'Este CLADORA certificată oficial GDPR sau ISO?',
              a: 'CLADORA dispune de o arhitectură concepută în conformitate cu principiile GDPR de minimizare a datelor și guvernanță europeană. Platforma nu pretinde certificări formale externe ca etichetă comercială și prezintă cu transparență măsurile reale de securitate implementate.',
            },
            {
              q: 'Sunt bazele de date sau semnăturile „imcompatibile și tamper-proof”?',
              a: 'Evităm termenii absoluți precum „tamper-proof” sau garanții matematice infailibile. Platforma utilizează jurnale aditive de audit, protocoale standard de criptare și stocarea probatorie a documentelor în DOCUMENTS.',
            },
          ],
        },
        {
          groupTitle: 'Pachete de Țară & România (Legea 196/2018)',
          items: [
            {
              q: 'Asigură CLADORA conformitate legală automată cu Legea 196/2018?',
              a: 'CLADORA include un Pachet de Țară pentru România conceput să sprijine fluxurile de lucru ale asociațiilor de proprietari (liste de plată, fond de rulment, fond de reparații). Platforma oferă suport tehnic și operațional, dar nu substituie expertiza juridică sau responsabilitatea comitetului executiv.',
            },
            {
              q: 'Ce rol au documentele de adunare generală înregistrate în sistem?',
              a: 'Platforma permite organizarea convocatoarelor, a proceselor-verbale și a evidențelor decizionale în DOCUMENTS. Acestea constituie arhivă operațională și suport de transparență, neavând valoare de vot electronic calificat judiciar fără certificări acreditate specifice.',
            },
          ],
        },
        {
          groupTitle: 'CLADORA Intelligence & AI Guvernat',
          items: [
            {
              q: 'Poate inteligența artificială din CLADORA să execute plăți sau să modifice solduri autonom?',
              a: 'Nu. Conform standardului de guvernanță WP-09A, CLADORA Intelligence operează strict ca un nivel asistent subordonat și nu este desemnat ca scriitor canonic independent. Mutațiile financiare de consecință și acțiunile administrative sunt concepute să treacă prin furnizorul canonic responsabil, autoritatea verificată și controalele de politică sau aprobare umană aplicabile.',
            },
          ],
        },
        {
          groupTitle: 'Parteneriat & Implementare',
          items: [
            {
              q: 'Ce pași urmează după trimiterea formularului de parteneriat?',
              a: 'Trimiterea cererii inițiază o etapă de evaluare consultativă. Echipa noastră analizează specificul patrimoniului dumneavoastră, stabilește profilul de proprietate și vă contactează pentru a stabili planul de configurare și calendarul de tranziție.',
            },
          ],
        },
      ],
      cta: {
        title: 'Ai o întrebare tehnică specifică portofoliului tău?',
        subtitle:
          'Echipa noastră de arhitectură îți stă la dispoziție pentru detalii suplimentare și clarificări metodologice.',
        buttonText: 'Contactează Echipa Tehnică',
      },
    },
    en: {
      breadcrumbs: {
        home: 'Home',
        current: 'Frequently Asked Questions (FAQ)',
      },
      hero: {
        badge: 'Frequently Asked Questions & Architectural Clarifications',
        title: 'Frequently Asked Questions: Architecture, Workspaces & Operations',
        subtitle:
          'Authoritative answers covering platform architecture, contextual authority, data migration, security principles, and capability availability.',
      },
      disclaimer: {
        title: 'Notice on FAQ Answers & Capability Availability',
        text: 'The answers provided reflect CLADORA’s approved architectural model. The concrete availability of specific capabilities in any given deployment depends on release maturity, contracted edition tiers, and agreed implementation scope.',
      },
      groups: [
        {
          groupTitle: 'Platform & Architecture',
          items: [
            {
              q: 'What is CLADORA and how does it differ from traditional property management software (PMS)?',
              a: 'CLADORA is a unified property operating platform engineered to sustain data continuity throughout an asset’s lifecycle. Unlike fragmented PMS tools that operate as disconnected silos, CLADORA decouples enduring physical asset identity from organizational workspaces and relies on designated canonical truth providers for financial, evidentiary, and operational integrity.',
            },
            {
              q: 'What does the “single source of canonical truth” principle mean?',
              a: 'It establishes that exactly one designated domain holds sole write authority and custodial custody over critical operational records: FIN01 for financial ledgers, DOCUMENTS for evidentiary files, BK01 for reservations, and CORE for identity and authority boundaries. This is designed to reduce reconciliation ambiguity and error risk while preserving clear ownership of operational truth.',
            },
          ],
        },
        {
          groupTitle: 'Workspaces & Authority',
          items: [
            {
              q: 'What is the precise distinction between a Property, a Workspace, and a Person?',
              a: 'The Property is the enduring physical subject (land, building structures, common elements). The Workspace is the administrative and security boundary of an operating organization (HOA, developer, property management company). The Person is a persistent digital identity who holds time-bound, scoped operational authority within specific workspaces pursuant to verified legal relationships.',
            },
            {
              q: 'Can a single user operate multiple roles across different buildings without data cross-bleed?',
              a: 'Yes. CLADORA natively decouples human identity from workspace-specific credentials. A user can act as an owner in one building, an audit board member in a second, and a tenant in a third, transitioning contexts cleanly without leaking confidential records across boundary walls.',
            },
          ],
        },
        {
          groupTitle: 'Capabilities & Maturity',
          items: [
            {
              q: 'Are all architectural capabilities universally live across all deployments?',
              a: 'No. CLADORA enforces strict availability governance: architectural domain relevance defines where a capability logically belongs, but runtime availability is determined by formal release maturity and contractual implementation scope.',
            },
            {
              q: 'How does the platform handle submetering and utility allocations?',
              a: 'The architecture associates physical meters with spatial units, records verified meter readings, and routes consumption data to FIN01 to execute allocation formulas configured for the specific property archetype and local operating context.',
            },
          ],
        },
        {
          groupTitle: 'Solutions by Participant Context',
          items: [
            {
              q: 'Do the six canonical Solutions represent six disparate software products?',
              a: 'No. The six Solutions (Developers, Property Owners, Associations, Property Managers, Residents, Service Providers) represent tailored operational lenses over the SAME unified platform architecture, shaped by the legal standing and scoped authority of each participant.',
            },
            {
              q: 'What financial visibility does an occupant or tenant receive?',
              a: 'Visibility is strictly scoped: occupants receive authorized access only to their own operational utility allocations, assigned invoices, and maintenance tickets. Private landlord ledgers, reserve fund investments, and neighbor billing records remain strictly restricted.',
            },
          ],
        },
        {
          groupTitle: 'Industries & Property Typologies',
          items: [
            {
              q: 'Is CLADORA exclusively designed for multi-family residential buildings?',
              a: 'No. While residential associations represent an important operational baseline, CLADORA’s composable architecture covers 8 built-world property sectors: residential, workplace/office, retail, hospitality, industrial, logistics, automotive, and mixed-use environments.',
            },
            {
              q: 'What is Building DNA?',
              a: 'Building DNA is the architectural typology framework describing an asset’s physical and engineering characteristics (e.g., high-rise tower, horizontal villa community, logistics hub). It informs modular configuration without requiring separate software codebases.',
            },
          ],
        },
        {
          groupTitle: 'Data Migration & System Transition',
          items: [
            {
              q: 'Is legacy system migration completely automated without human involvement?',
              a: 'No. CLADORA promotes a disciplined, assisted migration methodology where intake, unit mapping, balance carryover, and shadow validation runs require explicit verification and sign-off by authorized administrators. We do not promise unsupervised automated reconciliation.',
            },
            {
              q: 'What is the “Zero-Write” migration principle?',
              a: 'The migration architecture is designed to deny mutations when required authority, validation, mapping, or migration state cannot be established, preserving integrity throughout data intake.',
            },
          ],
        },
        {
          groupTitle: 'Security, Trust & GDPR',
          items: [
            {
              q: 'Does CLADORA possess formal GDPR or ISO compliance certifications?',
              a: 'CLADORA is architecturally aligned with European GDPR principles such as data minimization, purpose limitation, and EU-oriented governance. We transparently document our technical controls rather than marketing unverified external badges.',
            },
            {
              q: 'Are databases or digital sign-offs described as mathematically immutable or tamper-proof?',
              a: 'No. We deliberately avoid absolute terminology such as “tamper-proof” or unqualified cryptographic guarantees. The platform uses append-oriented audit logs, standard encryption, and evidentiary tracking in DOCUMENTS.',
            },
          ],
        },
        {
          groupTitle: 'Country Packs & Romania (Law 196/2018)',
          items: [
            {
              q: 'Does CLADORA provide automated legal compliance with Romanian Law 196/2018?',
              a: 'CLADORA provides a Romanian Country Pack designed to support residential association workflows (monthly maintenance sheets, reserve funds, working capital). The platform provides operational support but does not replace legal counsel or statutory executive board responsibility.',
            },
            {
              q: 'What legal weight do general assembly records stored in the platform have?',
              a: 'Platform records in DOCUMENTS provide operational organization and transparent communication for assemblies. They do not constitute qualified electronic voting or judicial evidentiary filings without integration with accredited statutory trust services.',
            },
          ],
        },
        {
          groupTitle: 'CLADORA Intelligence & Governed AI',
          items: [
            {
              q: 'Can CLADORA Intelligence disburse funds or mutate balances autonomously?',
              a: 'No. Pursuant to the WP-09A AI governance standard, CLADORA Intelligence operates strictly as a subordinate assistive layer and is not designated as an independent canonical writer. Consequential financial mutations and administrative actions are designed to pass through the responsible canonical provider, verified authority, and applicable policy or human approval controls.',
            },
          ],
        },
        {
          groupTitle: 'Partnership & Onboarding',
          items: [
            {
              q: 'What occurs after submitting a partnership inquiry?',
              a: 'Submitting an inquiry initiates a structured consultation. Our solutions team reviews your portfolio requirements, configures your initial property profile, and coordinates a transition roadmap.',
            },
          ],
        },
      ],
      cta: {
        title: 'Have a specialized technical question about your assets?',
        subtitle:
          'Our architecture team is available to discuss specific implementation requirements and operational models.',
        buttonText: 'Contact Technical Specialists',
      },
    },
    fa: {
      breadcrumbs: {
        home: 'صفحه اصلی',
        current: 'پرسش‌های متداول (FAQ)',
      },
      hero: {
        badge: 'پرسش‌های متداول و شفاف‌سازی‌های معماری',
        title: 'پرسش‌های متداول: معماری پلتفرم، فضاهای کاری و عملیات املاک',
        subtitle:
          'پاسخ‌های دقیق و مستند پیرامون معماری یکپارچه، تفکیک اختیارات، انتقال سوابق، اصول امنیت و حدود دسترسی‌پذیری قابلیت‌ها.',
      },
      disclaimer: {
        title: 'یادداشت پیرامون پاسخ‌ها و سطوح دسترسی‌پذیری قابلیت‌ها',
        text: 'پاسخ‌های ارائه‌شده منعکس‌کننده مدل معماری تاییدشده کلادورا هستند. دسترسی‌پذیری عملیاتی یک قابلیت مشخص در هر پروژه به سطح بلوغ کد، بسته قراردادی و دامنه پیاده‌سازی توافق‌شده بستگی دارد.',
      },
      groups: [
        {
          groupTitle: 'پلتفرم و مبانی معماری',
          items: [
            {
              q: 'کلادورا چیست و چه تفاوتی با نرم‌افزارهای سنتی مدیریت املاک (PMS) دارد؟',
              a: 'کلادورا یک پلتفرم جامع عملیات املاک است که برای حفظ تداوم اطلاعات در تمام چرخه عمر دارایی طراحی شده است. بر خلاف نرم‌افزارهای سنتی که جزیره‌ای و ایزوله عمل می‌کنند، کلادورا هویت فیزیکی ملک را از فضاهای کاری سازمان‌ها تفکیک کرده و از متولیان مرجع واحد برای ثبت حقایق مالی، اسنادی و عملیاتی بهره می‌برد.',
            },
            {
              q: 'اصل «مرجعیت واحد داده‌ها (Canonical Truth)» در کلادورا به چه معناست؟',
              a: 'این اصل بیانگر آن است که برای هر دسته از اطلاعات حیاتی، تنها یک دامنه اختصاصی حق ثبت و تایید نهایی را داراست: FIN01 برای دفاتر و تراکنش‌های مالی، DOCUMENTS برای نسخه‌های رسمی اسناد، BK01 برای ظرفیت و تقویم‌ها، و CORE برای هویت و حدود اختیارات. این رویکرد به گونه‌ای طراحی شده تا ابهام در مغایرت‌گیری و ریسک بروز خطای محاسباتی را کاهش دهد و شفافیت مالکیت داده‌های عملیاتی را حفظ کند.',
            },
          ],
        },
        {
          groupTitle: 'فضاهای کاری و حدود اختیارات',
          items: [
            {
              q: 'تفاوت دقیق میان «ملک»، «Workspace» و «شخص» در چیست؟',
              a: 'ملک بستر فیزیکی و پایدار در دنیای واقعی است. فضای کاری (Workspace) مرز امنیتی، داده‌ای و مدیریتی یک سازمان است (مانند هیئت‌مدیره مجتمع یا شرکت مدیریت). شخص هویت دیجیتال کاربر است که بر اساس روابط حقوقی معتبر، اختیاراتی زمان‌دار و مشخص در فضاهای کاری دریافت می‌نماید.',
            },
            {
              q: 'آیا یک کاربر می‌تواند بدون تداخل اطلاعات، هم‌زمان نقش‌های گوناگونی در ساختمان‌های مختلف داشته باشد؟',
              a: 'بله. هویت شخص از دسترسی‌های مقطعی تفکیک شده است. یک حساب کاربری می‌تواند در یک ساختمان مالک، در ساختمانی دیگر عضو هیئت‌مدیره و در مجتمعی دیگر مستأجر باشد و بدون نشت اطلاعات، میان این محیط‌ها جابه‌جا شود.',
            },
          ],
        },
        {
          groupTitle: 'قابلیت‌ها و بلوغ عملکردی',
          items: [
            {
              q: 'آیا تمام قابلیت‌های تشریح‌شده در معماری، به صورت لحظه‌ای در همه پیاده‌سازی‌ها فعال هستند؟',
              a: 'خیر. کلادورا انضباط سخت‌گیرانه‌ای برای اعلام دسترسی‌پذیری دارد: تبیین معماری مشخص می‌کند که یک ویژگی منطقاً در کجا قرار می‌گیرد، اما فعال بودن اجرایی آن منوط به بلوغ انتشار در زمان اجرا و توافقات قراردادی هر پروژه است.',
            },
            {
              q: 'سامانه چگونه کارکرد کنتورها و تسهیم هزینه‌های انرژی را مدیریت می‌کند؟',
              a: 'معماری پلتفرم امکان انتساب کنتورها به واحدها، ثبت ارقام خوانده‌شده و انتقال داده‌ها به دامنه FIN01 را جهت محاسبه تسهیم شارژ بر اساس فرمول‌های تعیین‌شده برای ملک فراهم می‌آورد.',
            },
          ],
        },
        {
          groupTitle: 'راهکارها بر اساس جایگاه مخاطبان',
          items: [
            {
              q: 'آیا ۶ راهکار ارائه‌شده نشان‌دهنده ۶ محصول نرم‌افزاری مجزا هستند؟',
              a: 'خیر. این راهکارها (سازندگان، مالکان، انجمن‌ها، مدیران، ساکنان، پیمانکاران) ابعاد عملیاتی متناسب با همان پلتفرم یکپارچه هستند که بر مبنای جایگاه حقوقی و اختیارات هر گروه پیکربندی شده‌اند.',
            },
            {
              q: 'ساکن یا مستأجر چه سطحی از دسترسی به اطلاعات مالی را داراست؟',
              a: 'دسترسی‌ها کاملاً محدود و بافت‌محورند: ساکنان صرفاً هزینه‌های شارژ جاری، قبوض مربوط به دوره خود و تیکت‌های پشتیبانی را مشاهده می‌کنند و به دفاتر خصوصی مالکان، سرمایه‌گذاری‌های صندوق ذخیره یا ارقام سایر همسایگان دسترسی ندارند.',
            },
          ],
        },
        {
          groupTitle: 'صنایع و کاربری‌های ساختمانی',
          items: [
            {
              q: 'آیا کاربرد کلادورا منحصر به مجتمع‌های مسکونی است؟',
              a: 'خیر. هرچند مدیریت مسکونی بستر عملیاتی مهمی است، معماری ترکیب‌پذیر کلادورا ۸ بخش کاربری را پوشش می‌دهد: مسکونی، اداری، مراکز تجاری، اقامتی و هتلداری، صنعتی، لجستیک و انبارداری، خودرویی و مجموعه‌های چندمنظوره.',
            },
            {
              q: 'مفهوم «ساختار ساختمانی (Building DNA)» چیست؟',
              a: 'گونه‌شناسی فیزیکی و مشخصات فنی ملک (برج، شهرک ویلایی، مرکز خرید، انبار) است که ترکیب ماژول‌های فعال را مشخص می‌سازد و مانع از نیاز به بازنویسی نرم‌افزار برای هر نوع ملک می‌شود.',
            },
          ],
        },
        {
          groupTitle: 'مهاجرت و انتقال اطلاعات',
          items: [
            {
              q: 'آیا فرآیند انتقال داده‌ها از سیستم‌های قبلی به صورت تمام‌خودکار و بدون دخالت انسان انجام می‌شود؟',
              a: 'خیر. کلادورا بر متدولوژی کنترل‌شده و تحت نظارت تأکید دارد که طی آن فهرست‌برداری، تطبیق واحدها، انتقال مانده‌ها و اجرای موازی نیازمند بازبینی و تایید رسمی مدیران مجاز است. ادعای مغایرت‌گیری خودکار بدون بررسی مطرح نمی‌شود.',
            },
            {
              q: 'اصل «Zero-Write» در فرآیند مهاجرت داده‌ها به چه معناست؟',
              a: 'معماری مهاجرت داده‌ها به گونه‌ای طراحی شده است که در صورت عدم احراز اختیارات لازم، عدم امکان اعتبارسنجی، نقص در نگاشت ساختارها یا مشخص نبودن وضعیت مهاجرت، از اعمال جهش و تغییر وضعیت عملیاتی جلوگیری به عمل آورد.',
            },
          ],
        },
        {
          groupTitle: 'امنیت، حاکمیت داده و GDPR',
          items: [
            {
              q: 'آیا پلتفرم دارای گواهی‌نامه‌های رسمی نهادهای بیرونی است؟',
              a: 'معماری کلادورا منطبق بر اصول حفاظت از حریم خصوصی GDPR و استانداردهای اروپایی بنا نهاده شده است. ما به جای ادعای تبلیغاتی نشان‌های تجاری اثبات‌نشده، شفافیت فنی کنترل‌های خود را ارائه می‌دهیم.',
            },
            {
              q: 'آیا پایگاه داده یا مستندات ثبت‌شده دارای ادعای نفوذناپذیری مطلق (Tamper-Proof) هستند؟',
              a: 'خیر. ما از کاربرد اصطلاحات مطلق و غیرواقعی پرهیز می‌کنیم. سامانه متکی بر لاگ‌های ترتیبی ممیزی، رمزنگاری استاندارد و ثبت شواهد معتبر در دامنه DOCUMENTS است.',
            },
          ],
        },
        {
          groupTitle: 'بسته‌های کشوری و قوانین محلی',
          items: [
            {
              q: 'آیا پلتفرم انطباق قانونی خودکار را تضمین می‌نماید؟',
              a: 'بسته‌های کشوری کلادورا (نظیر بسته رومانی منطبق با قانون 196/2018) فرآیندهای کاری انجمن‌ها را تسهیل می‌نمایند، اما جایگزین مشاوره حقوقی رسمی یا مسئولیت‌های قانونی هیئت‌مدیره نخواهند بود.',
            },
            {
              q: 'اسناد مجامع عمومی ثبت‌شده در سامانه چه وضعیتی دارند؟',
              a: 'این اسناد در دامنه DOCUMENTS برای سازماندهی اداری و شفافیت اطلاع‌رسانی نگهداری می‌شوند و بدون اتصال به نهادهای رسمی امضای الکترونیک، جایگزین ابلاغیه‌های قضایی نیستند.',
            },
          ],
        },
        {
          groupTitle: 'هوش عملیاتی و هوش مصنوعی مقید',
          items: [
            {
              q: 'آیا هوش مصنوعی کلادورا می‌تواند به صورت خودمختار پرداخت‌ها را تایید کند؟',
              a: 'خیر. طبق استاندارد حاکمیت بر هوش مصنوعی (WP-09A)، هوش عملیاتی کلادورا منحصراً به عنوان لایه کمکی زیردست عمل می‌کند و به عنوان نویسنده مستقل حقیقت کانونی تعیین نشده است. اعمال تغییرات مالی بنیادین و تصمیمات اداری مهم به گونه‌ای طراحی شده‌اند که از طریق ارائه‌دهنده کانونی مسئول، اعتبارسنجی اختیارات و نظارت‌های خط‌مشی یا تایید انسانی صورت پذیرند.',
            },
          ],
        },
        {
          groupTitle: 'آغاز همکاری و استقرار',
          items: [
            {
              q: 'پس از ارسال فرم درخواست همکاری چه مراحلی طی می‌شود؟',
              a: 'ثبت فرم به منزله آغاز ارزیابی مشاوره‌ای است. کارشناسان ما مشخصات دارایی شما را بررسی کرده و برنامه زمان‌بندی و راهکار اجرایی مناسب را هماهنگ می‌نمایند.',
            },
          ],
        },
      ],
      cta: {
        title: 'سؤال فنی خاصی درباره املاک خود دارید؟',
        subtitle:
          'تیم فنی و معماری کلادورا آماده پاسخ‌گویی به ابهامات و ارائه جزئیات تکمیلی است.',
        buttonText: 'ارتباط با کارشناسان فنی',
      },
    },
  }[lang];

  // Build FAQPage Schema JSON-LD (strictly matching visible Q&A)
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: content.groups.flatMap((g) =>
      g.items.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.a,
        },
      }))
    ),
  };

  const baseUrl = getSiteUrl();

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: content.breadcrumbs.home,
        item: `${baseUrl}/${lang}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: content.breadcrumbs.current,
        item: `${baseUrl}/${lang}/faq`,
      },
    ],
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      {/* Schema.org FAQPage */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      {/* Schema.org BreadcrumbList */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-[#52667A]">
          <Link href={`/${lang}`} className="hover:text-[#102A43] transition-colors">
            {content.breadcrumbs.home}
          </Link>
          <span className="text-[#9FB3C8]">/</span>
          <span className="text-[#102A43] font-bold" aria-current="page">
            {content.breadcrumbs.current}
          </span>
        </nav>

        {/* Hero Section */}
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-50 border border-teal-200 text-[#0E9F8E] text-xs font-semibold">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{content.hero.badge}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-[#102A43] tracking-tight">
            {content.hero.title}
          </h1>
          <p className="text-base sm:text-lg text-[#52667A] leading-relaxed">
            {content.hero.subtitle}
          </p>
        </div>

        {/* Disclaimer Notice Box */}
        <div className="bg-white rounded-2xl p-6 border border-[#D3DCE6] shadow-sm flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-5 h-5" />
          </div>
          <div className="space-y-1 text-xs sm:text-sm">
            <div className="font-bold text-[#102A43]">{content.disclaimer.title}</div>
            <div className="text-[#52667A] leading-relaxed">{content.disclaimer.text}</div>
          </div>
        </div>

        {/* FAQ Groups */}
        <div className="space-y-10">
          {content.groups.map((group, groupIdx) => (
            <section key={groupIdx} className="space-y-4">
              <h2 className="text-xl sm:text-2xl font-bold text-[#102A43] border-b border-[#E2E8F0] pb-2">
                {group.groupTitle}
              </h2>
              <div className="space-y-3">
                {group.items.map((item, itemIdx) => (
                  <details
                    key={itemIdx}
                    className="group rounded-2xl border border-[#E2E8F0] bg-white p-5 transition-all open:border-[#B2E5DF] open:shadow-sm"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-4 font-bold text-sm sm:text-base text-[#102A43] list-none">
                      <span>{item.q}</span>
                      <ChevronDown className="w-5 h-5 text-[#627D98] shrink-0 transition-transform duration-200 group-open:rotate-180 group-open:text-[#0E9F8E]" />
                    </summary>
                    <div className="pt-4 text-xs sm:text-sm text-[#52667A] leading-relaxed border-t border-[#F0F4F8] mt-4">
                      {item.a}
                    </div>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        {/* Contact CTA Box */}
        <div className="bg-white rounded-2xl p-8 border border-[#D3DCE6] shadow-sm text-center max-w-2xl mx-auto space-y-4">
          <h3 className="text-xl font-bold text-[#102A43]">{content.cta.title}</h3>
          <p className="text-xs sm:text-sm text-[#52667A] leading-relaxed">
            {content.cta.subtitle}
          </p>
          <div className="pt-2">
            <Link
              href={`/${lang}/contact`}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-[#0E9F8E] hover:bg-[#0A7E71] rounded-xl transition-colors shadow-sm"
            >
              <span>{content.cta.buttonText}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
