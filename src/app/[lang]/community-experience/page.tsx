import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import {
  Users,
  Compass,
  ArrowRight,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  Sparkles,
  Wrench,
  CheckCircle2,
  MapPin,
  Clock,
  Briefcase,
  FileText,
  DollarSign,
  MessageSquare,
  Bot,
  Sliders,
  ChevronRight,
  UserCheck,
  AlertCircle,
  HelpCircle,
  Cpu,
  Store,
  Hotel,
  Factory,
  Warehouse,
  Car
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
  return getRouteMetadata('/community-experience', params.lang);
}

export default async function CommunityExperiencePage(props: {
  params: Promise<{ lang: Language }>;
}) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumb: { home: 'Acasă', current: 'Comunitate & Experiență' },
      hero: {
        badge: 'DOMENIUL PEER COMUNITATE & EXPERIENȚĂ (C&E)',
        title: 'Experiență Conectată la Contextul Proprietății',
        subtitle:
          'Domeniul Comunitate & Experiență (C&E) din CLADORA este proiectat să compună viața comunitară, ghidurile de spațiu, evenimentele și călătoriile contextuale în jurul aceleiași identități de proprietate, acelorași granițe de workspace și aceluiași model de autoritate utilizate în întreaga platformă.',
        ctaPrimary: 'Explorează Arhitectura de Experiență',
        ctaSecondary: 'Arhitectura Platformei',
      },
      peerDomain: {
        badge: 'RANG ARHITECTURAL EGAL',
        title: 'C&E ca Domeniu Peer Alături de AIRPROP, SERVICE & OPERAȚIUNI',
        desc: 'În arhitectura CLADORA, experiența ocupantului nu este un simplu modul secundar de tichete și nici o aplicație izolată de chat rezidențial. C&E se poziționează ca un domeniu de prim rang (Peer Domain), proiectat să compună interacțiunea umană pe baza adevărului furnizat de nucleul comun.',
        points: [
          {
            title: 'Nu este un Submodul de Mentenanță',
            desc: 'C&E nu este un apendice al modulului de intervenții tehnice. El guvernează modul în care oamenii percep și interacționează cu spațiul fizic.',
          },
          {
            title: 'Fără Baze de Date Duplicate',
            desc: 'C&E nu își inventează propriul registru financiar, propriul calendar izolat de rezervări sau o identitate paralelă de utilizator.',
          },
          {
            title: 'Consumator de Adevăr Canonic',
            desc: 'Orice interacțiune din C&E consumă identitatea din CORE, documentele din VAULT, capacitatea din BK01 și tranzacțiile din FIN01.',
          },
        ],
      },
      flowSection: {
        badge: 'MODELUL DE COMPOZIȚIE CONTEXTUALĂ',
        title: 'De la Contextul Proprietății la Compoziția Experienței',
        desc: 'Experiența utilizatorului nu este generată abstract, ci este derivată deterministic printr-un lanț arhitectural precis:',
        steps: [
          {
            num: '01',
            name: 'Persoană & Identitate',
            desc: 'Subiect verificat în CORE, cu acreditări unice și profil securizat.',
            icon: Users,
          },
          {
            num: '02',
            name: 'Relație Locativă',
            desc: 'Proprietar, chiriaș, oaspete, angajat, tehnician sau vizitator temporar.',
            icon: UserCheck,
          },
          {
            num: '03',
            name: 'Context Spațial',
            desc: 'Proprietate, clădire, nivel, unitate individuală și zone comune accesibile.',
            icon: MapPin,
          },
          {
            num: '04',
            name: 'Autoritate & Mandat',
            desc: 'Granițele de workspace, politicile de confidențialitate și mandatul temporal activ.',
            icon: ShieldCheck,
          },
          {
            num: '05',
            name: 'Compoziția Experienței (C&E)',
            desc: 'Sinteza ghidurilor relevante, avizierului, resurselor și fluxurilor disponibile.',
            icon: Compass,
          },
          {
            num: '06',
            name: 'Execuție Canonică',
            desc: 'Comenzile merg la SERVICE/OPS, rezervările la BK01, plățile la FIN01.',
            icon: CheckCircle2,
          },
        ],
      },
      communityLayer: {
        badge: 'STRATUL COMUNITAR',
        title: 'Spații Comunitare Delimitate & Participare Autorizată',
        desc: 'Interacțiunea socială și organizatorică este ancorată în structura fizică și administrativă a clădirii:',
        items: [
          {
            title: 'Context de Membru Verificat',
            desc: 'Accesul la viața comunitară este guvernat strict de calitatea de membru al workspace-ului.',
          },
          {
            title: 'Avizier Digital & Consultări',
            desc: 'Difuzarea transparentă a anunțurilor oficiale ale consiliului de administrație și inițiativelor comune.',
          },
          {
            title: 'Separare Bounded a Confidențialității',
            desc: 'Vecinii interacționează în limitele spațiilor comune, fără expunerea datelor private sau financiare.',
          },
          {
            title: 'Descoperirea Facilităților Partajate',
            desc: 'Prezentarea contextuală a regulamentelor interioare și orelor de liniște pentru fiecare zonă.',
          },
        ],
      },
      guidesSection: {
        badge: 'GHIDURI & CONTEXT DE LOC',
        title: 'Ghiduri de Proprietate, Informații de Sosire & Asistență Spațială',
        desc: 'C&E structurează documentația operațională pentru a fi utilă în momentul și locul potrivit:',
        items: [
          {
            title: 'Ghidul Tehnic al Spațiului',
            desc: 'Instrucțiuni de operare pentru termostate, panouri de siguranțe, interfon și contoare individuale.',
          },
          {
            title: 'Protocol de Sosire & Acces',
            desc: 'Informații de orientare pentru oaspeți, curieri și echipe de mutare (puncte de parcare, lifturi de marfă).',
          },
          {
            title: 'Regulamente & Conduită',
            desc: 'Arhivarea și afișarea transparentă a normelor stabilite de comunitate pentru spațiile partajate.',
          },
          {
            title: 'Puncte de Interes Local',
            desc: 'Recomandări contextuale privind serviciile de proximitate, colectarea selectivă și transportul public.',
          },
        ],
      },
      eventsSection: {
        badge: 'COORDONARE DE EVENIMENTE',
        title: 'Descoperirea Evenimentelor, Adunări & Intenție de Participare',
        desc: 'Modelul arhitectural pentru evenimentele de comunitate și deciziile colective:',
        items: [
          {
            title: 'Adunări Generale & Ședințe',
            desc: 'Calendarul convocărilor statutare, ordinea de zi și publicarea documentelor pregătitoare.',
          },
          {
            title: 'Inițiative Comunitare',
            desc: 'Acțiuni de ecologizare, amenajare peisagistică sau evenimente festive organizate de locatari.',
          },
          {
            title: 'Intenție de Prezență (RSVP)',
            desc: 'Înregistrarea intenției de participare pentru dimensionarea adecvată a capacității spațiului.',
          },
          {
            title: 'Verificarea Capacității prin BK01',
            desc: 'Evenimentele care ocupă un spațiu fizic consultă disponibilitatea canonică din motorul BK01.',
          },
        ],
      },
      journeysSection: {
        badge: 'ARHETIPURI DE CĂLĂTORIE',
        title: 'Compoziția Călătoriilor Contextuale în Mediul Construit',
        desc: 'C&E modelează experiența prin 6 arhetipuri fundamentale de călătorie (journey archetypes):',
        journeys: [
          {
            role: 'Călătoria Rezidentului',
            desc: 'Onboarding în clădire, configurarea utilităților, recepționarea avizierului, tichete de reparații și vot în adunare.',
            badge: 'Rezidențial',
          },
          {
            role: 'Călătoria Chiriașului Corporate',
            desc: 'Ghidul spațiului de birouri, programarea sălilor comune, accesul vizitatorilor și solicitări către FM.',
            badge: 'Workplace',
          },
          {
            role: 'Călătoria Vizitatorului',
            desc: 'Invitație digitală de acces, orientare în parcare, ghidare către destinație și acces temporar securizat.',
            badge: 'Acces Temporar',
          },
          {
            role: 'Călătoria Oaspetelui',
            desc: 'Procedură de check-in ghidată, asistență pentru facilitățile hotelului, rezervări de servicii și protocol de plecare.',
            badge: 'Ospitalitate',
          },
          {
            role: 'Călătoria Clientului Comercial',
            desc: 'Ghidul galeriilor comerciale, orientare către magazine, orar de funcționare și servicii pentru clienți.',
            badge: 'Retail',
          },
          {
            role: 'Călătoria Contractorului',
            desc: 'Instrucțiuni de securitate în șantier/clădire, recepționarea permisului de lucru și confirmarea intervenției.',
            badge: 'Operațional',
          },
        ],
      },
      boundariesSection: {
        badge: 'GRANIȚE CANONICE STRINGENTE',
        title: 'Separarea Clară a Responsabilităților: C&E vs. Furnizorii de Adevăr',
        desc: 'Pentru a preveni degradarea integrității datelor, rolul C&E este strict delimitat de cel al furnizorilor de adevăr canonic:',
        boundaries: [
          {
            domain: 'C&E vs. SERVICE',
            role: 'Experiență vs. Intenție de Achiziție',
            rule: 'C&E prezintă contextul sau catalogul de asistență; SERVICE este unicul proprietar al cererilor formale, comparării de oferte și comenzilor.',
            icon: Wrench,
          },
          {
            domain: 'C&E vs. BK01',
            role: 'Prezentare vs. Adevărul Capacității',
            rule: 'C&E afișează calendarul și facilitățile; BK01 deține în mod absolut disponibilitatea, cotele de capacitate și rezolvarea conflictelor.',
            icon: Calendar,
          },
          {
            domain: 'C&E vs. FIN01',
            role: 'Interacțiune vs. Adevărul Financiar',
            rule: 'C&E nu deține solduri, portofele electronice sau registre paralele. Orice plată sau cost este consemnat exclusiv în FIN01.',
            icon: DollarSign,
          },
          {
            domain: 'C&E vs. COMUNICAȚII',
            role: 'Context vs. Livrarea Mesajelor',
            rule: 'C&E decide oportunitatea notificării în călătorie; COMUNICAȚII guvernează dispecerizarea prin canale securizate și jurnalele de livrare.',
            icon: MessageSquare,
          },
        ],
      },
      presetsSection: {
        badge: 'PRESETURI DE EXPERIENȚĂ PE INDUSTRII',
        title: 'Calibrarea Experienței pentru Fiecare Context Imobiliar',
        desc: 'Un preset de experiență nu este un produs software separat, ci o compoziție specifică a domeniilor platformei:',
        presets: [
          {
            name: 'Experiență Rezidențială',
            desc: 'Ghidul condominiului, avizier digital, cotele de întreținere din FIN01, tichete de reparații și consultări comunitare.',
            icon: Building2,
          },
          {
            name: 'Experiență Workplace & Office',
            desc: 'Orientarea noilor angajați, rezervarea birourilor și sălilor prin BK01, acreditări de vizitator și solicitări către FM.',
            icon: Briefcase,
          },
          {
            name: 'Experiență Retail & Centre Comerciale',
            desc: 'Descoperirea brandurilor, ghidul facilităților pentru cumpărători și comunicarea operațională cu comercianții.',
            icon: Store,
          },
          {
            name: 'Experiență Ospitalitate & Serviced Living',
            desc: 'Ghid digital de cazare, orientare la sosire și rezervarea resurselor partajate (spa, conferințe) ancorate în BK01.',
            icon: Hotel,
          },
          {
            name: 'Context Muncitoresc Industrial',
            desc: 'Ghid de securitate a muncii, permise de acces, regulamente de perimetru și proceduri în caz de urgență tehnică.',
            icon: Factory,
          },
          {
            name: 'Context Operator Logistic',
            desc: 'Instrucțiuni de circulație în parc, protocol de acces la rampe, instruiri pentru șoferi și reguli de depozitare.',
            icon: Warehouse,
          },
          {
            name: 'Context Clienți Auto & Showroom',
            desc: 'Ghidul recepției service, asistență în zona de așteptare clienți și fluxul de informare privind stadiul mașinii.',
            icon: Car,
          },
          {
            name: 'Experiență Ansambluri Mixte (Mixed-Use)',
            desc: 'Compoziția supremă: tranziția fluidă între zona rezidențială, de birouri și retail pe baza rolului și autorității din CORE.',
            icon: Layers,
          },
        ],
      },
      intelligencePreview: {
        badge: 'PREVIZUALIZARE INTELIGENȚĂ ASISTIVĂ',
        title: 'Orchestrarea Asistivă în Călătoriile de Experiență',
        desc: 'Asistența inteligentă în cadrul C&E acționează strict ca un orchestrator subordonat deciziei umane, urmând fluxul canonic în 6 pași:',
        steps: [
          { title: '1. Context', desc: 'Identifică spațiul, proprietatea și identitatea verificată.' },
          { title: '2. Intenție', desc: 'Clarifică ce anume dorește să realizeze utilizatorul.' },
          { title: '3. Autoritate', desc: 'Confirmă mandatul legal înainte de a propune orice acțiune.' },
          { title: '4. Planificare', desc: 'Structurează acțiunea către furnizorul canonic adecvat.' },
          { title: '5. Execuție Canonică', desc: 'Operațiunea este validată de om și consemnată oficial.' },
          { title: '6. Notă de Audit', desc: 'Înregistrare cronologică permanentă a tuturor evenimentelor.' },
        ],
        note: 'AI nu acordă drepturi, nu efectuează plăți autonome și nu ocolește aprobările umane obligatorii.',
      },
      availability: {
        badge: 'TRANSPARENȚĂ & GUVERNANȚĂ OPERAȚIONALĂ',
        title: 'Maturitatea Arhitecturală a Domeniului de Experiență',
        desc: 'Prezentarea publică a domeniului Comunitate & Experiență descrie modelul arhitectural complet conceput pentru lumea construită. În practică, disponibilitatea fiecărei funcționalități este guvernată individual de stadiul de lansare al versiunii de produs și de perimetrul agreat în fiecare implementare.',
        points: [
          'Capabilitățile C&E sunt compuse modular în funcție de abonamentul și licența activă a workspace-ului.',
          'Funcționalitățile complexe (automatizări de evenimente, călătorii avansate de oaspeți sau integrări complexe de concierge) sunt etape țintă de arhitectură supuse calendarelor de lansare.',
          'Integritatea arhitecturală este garantată: nicio funcționalitate de experiență nu poate scrie date nesecurizate sau neautorizate în registrele canonice ale platformei.',
        ],
      },
      cta: {
        title: 'Proiectează Experiența Ocupanților din Portofoliul Tău Imobiliar',
        desc: 'Discută cu echipa de arhitectură CLADORA despre modul în care domeniul Comunitate & Experiență poate unifica interacțiunea rezidenților, chiriașilor și oaspeților.',
        primary: 'Explorează Arhitectura Platformei',
        secondary: 'Contactează Arhitecții',
      },
    },
    en: {
      breadcrumb: { home: 'Home', current: 'Community & Experience' },
      hero: {
        badge: 'COMMUNITY & EXPERIENCE (C&E) PEER DOMAIN',
        title: 'Experience Connected to the Property Context',
        subtitle:
          'CLADORA Community & Experience is designed to compose community, guides, events, and contextual journeys around the same property identity, workspace boundaries, and contextual authority used across the entire platform.',
        ctaPrimary: 'Explore Experience Architecture',
        ctaSecondary: 'Platform Architecture',
      },
      peerDomain: {
        badge: 'ARCHITECTURAL PEER STATUS',
        title: 'C&E as a Peer Domain Alongside AIRPROP, SERVICE & OPERATIONS',
        desc: 'In CLADORA’s platform design, occupant experience is neither a cosmetic add-on nor a subsidiary maintenance ticketing queue. C&E is architected as a first-class peer domain alongside commercial lifecycle (AIRPROP), procurement coordination (SERVICE), and technical maintenance (OPERATIONS).',
        points: [
          {
            title: 'Not a Maintenance Sub-Feature',
            desc: 'C&E is not a sub-branch of work-order dispatch. It governs how people understand, orient within, and interact with the physical built environment.',
          },
          {
            title: 'No Parallel Database Silos',
            desc: 'C&E rejects shadow ledgers, isolated booking silos, or disconnected resident profile databases.',
          },
          {
            title: 'Canonical Truth Consumer',
            desc: 'Every experience touchpoint consumes identity from CORE, files from VAULT, capacity truth from BK01, and financial events from FIN01.',
          },
        ],
      },
      flowSection: {
        badge: 'CONTEXTUAL COMPOSITION MODEL',
        title: 'How Property Reality Drives Experience Composition',
        desc: 'Occupant experience is never generated in an abstract vacuum. It is deterministically synthesized through an unbroken architectural chain:',
        steps: [
          {
            num: '01',
            name: 'Person & Identity',
            desc: 'Verified subject identity in CORE with hardened credentials.',
            icon: Users,
          },
          {
            num: '02',
            name: 'Occupancy Relationship',
            desc: 'Owner, residential tenant, workplace occupant, guest, or contractor.',
            icon: UserCheck,
          },
          {
            num: '03',
            name: 'Spatial Property Context',
            desc: 'Cadastral parcel, building body, floor, demarcation, and common facilities.',
            icon: MapPin,
          },
          {
            num: '04',
            name: 'Authority & Mandate',
            desc: 'Workspace boundaries, privacy scope, and active temporal mandates.',
            icon: ShieldCheck,
          },
          {
            num: '05',
            name: 'Experience Composition (C&E)',
            desc: 'Situational synthesis of guides, notice boards, events, and touchpoints.',
            icon: Compass,
          },
          {
            num: '06',
            name: 'Canonical Provider Truth',
            desc: 'Requests routed to SERVICE/OPS, bookings to BK01, ledgers to FIN01.',
            icon: CheckCircle2,
          },
        ],
      },
      communityLayer: {
        badge: 'COMMUNITY ARCHITECTURE',
        title: 'Bounded Community Spaces & Authorized Participation',
        desc: 'Occupant community interaction is architecturally anchored in verified physical and administrative boundaries:',
        items: [
          {
            title: 'Verified Member Context',
            desc: 'Participation in building spaces is strictly bounded by active workspace membership and verified roles.',
          },
          {
            title: 'Digital Notice Board & Consultations',
            desc: 'Official dissemination of board notices, building announcements, and statutory community polls.',
          },
          {
            title: 'Privacy-Bounded Isolation',
            desc: 'Neighbors interact within designated common spaces without exposing individual unit or financial records.',
          },
          {
            title: 'Shared Amenity Discovery',
            desc: 'Contextual presentation of house rules, shared hours, and usage guidance for communal facilities.',
          },
        ],
      },
      guidesSection: {
        badge: 'SPATIAL & OPERATIONAL GUIDANCE',
        title: 'Property Guides, Arrival Information & Place Context',
        desc: 'C&E structures operational guidance so information arrives exactly when and where it is needed:',
        items: [
          {
            title: 'Space & Equipment Guides',
            desc: 'Contextual operating guidance for heating thermostats, circuit panels, video intercoms, and submeters.',
          },
          {
            title: 'Arrival & Access Instructions',
            desc: 'Clear orientation protocols for guests, delivery partners, and moving crews (freight elevators, parking rules).',
          },
          {
            title: 'House Rules & Community Policies',
            desc: 'Transparent digital publication of community-approved quiet hours, pet policies, and shared terrace rules.',
          },
          {
            title: 'Localized Neighborhood Context',
            desc: 'Curated building-specific notes on municipal recycling schedules, local transit points, and utility contacts.',
          },
        ],
      },
      eventsSection: {
        badge: 'EVENT COORDINATION CONTEXT',
        title: 'Event Discovery, Community Context & Participation Intent',
        desc: 'The architectural model for collective gatherings and statutory assemblies:',
        items: [
          {
            title: 'General Meetings & Assemblies',
            desc: 'Formal publication of statutory convening notices, proposed agendas, and advance discussion materials.',
          },
          {
            title: 'Community Initiatives',
            desc: 'Resident-led garden cleanup days, building improvement workshops, and neighborhood seasonal gatherings.',
          },
          {
            title: 'Participation Intent (RSVP)',
            desc: 'Intent logging enabling managers to calibrate seating, digital quorum, or room capacity beforehand.',
          },
          {
            title: 'Capacity Checking via BK01',
            desc: 'Events occupying physical amenities verify capacity boundaries directly against canonical provider BK01.',
          },
        ],
      },
      journeysSection: {
        badge: 'JOURNEY COMPOSITION LAYER',
        title: 'Contextual Experience Archetypes Across the Built Environment',
        desc: 'C&E models interaction through 6 canonical experience archetypes across property typologies:',
        journeys: [
          {
            role: 'Resident Journey',
            desc: 'Move-in onboarding, utility meter baseline, quota review in FIN01, repair logging, and HOA voting.',
            badge: 'Residential',
          },
          {
            role: 'Workplace Tenant Journey',
            desc: 'Corporate employee orientation, desk/meeting room booking in BK01, visitor badges, and workplace service requests.',
            badge: 'Workplace',
          },
          {
            role: 'Visitor Journey',
            desc: 'Pre-registered digital pass, parking gate orientation, turnstile guidance, and time-bounded indoor navigation.',
            badge: 'Temporary Access',
          },
          {
            role: 'Guest Journey',
            desc: 'Arrival check-in guidance, digital room handbook, on-premise amenity reservations, and express departure.',
            badge: 'Hospitality',
          },
          {
            role: 'Retail Customer Journey',
            desc: 'Shopping center mall directory, customer lounge amenities, merchant promotions, and parking validation.',
            badge: 'Retail',
          },
          {
            role: 'Contractor Journey',
            desc: 'On-site technical orientation, digital safety briefing, hot-work permit check, and work-order completion sign-off.',
            badge: 'Operational',
          },
        ],
      },
      boundariesSection: {
        badge: 'CANONICAL BOUNDARY DISCIPLINE',
        title: 'Clear Ownership Separation: C&E vs. Canonical Providers of Truth',
        desc: 'To maintain enterprise transactional integrity, C&E’s boundary is strictly separated from canonical providers:',
        boundaries: [
          {
            domain: 'C&E vs. SERVICE',
            role: 'Experience Composition vs. Procurement Intent',
            rule: 'C&E surfaces service discovery; SERVICE owns formal requests, vendor quote comparison, and purchase orders.',
            icon: Wrench,
          },
          {
            domain: 'C&E vs. BK01',
            role: 'Presentation vs. Capacity Truth',
            rule: 'C&E presents amenity schedules; BK01 is the sole canonical authority for availability, thresholds, and conflict detection.',
            icon: Calendar,
          },
          {
            domain: 'C&E vs. FIN01',
            role: 'Interaction vs. Financial Truth',
            rule: 'C&E maintains no shadow wallets or point ledgers. Every monetary transaction is strictly recorded in FIN01.',
            icon: DollarSign,
          },
          {
            domain: 'C&E vs. COMMUNICATIONS',
            role: 'Context vs. Delivery Dispatch',
            rule: 'C&E identifies the contextual touchpoint; COMMUNICATIONS owns multi-channel delivery logs and statutory proof of notice.',
            icon: MessageSquare,
          },
        ],
      },
      presetsSection: {
        badge: 'INDUSTRY EXPERIENCE PRESETS',
        title: 'Calibrating Experience Across 8 Built-World Property Contexts',
        desc: 'An industry preset is not a separate codebase, but an architectural calibration of platform domains around asset realities:',
        presets: [
          {
            name: 'Residential Living Experience',
            desc: 'Condominium handbook, digital notice board, HOA maintenance dues from FIN01, resident repair tickets, and community votes.',
            icon: Building2,
          },
          {
            name: 'Workplace & Commercial Office',
            desc: 'Employee onboarding, desk and conference room reservation via BK01, guest pass dispatch, and facility work orders.',
            icon: Briefcase,
          },
          {
            name: 'Retail & Shopping Center Podiums',
            desc: 'Shopper directory, customer amenity guidance, merchant community communication, and public facility schedules.',
            icon: Store,
          },
          {
            name: 'Hospitality & Serviced Living',
            desc: 'Digital lodging handbook, arrival guidance, and shared leisure capacity reservation (spa, pool) anchored in BK01.',
            icon: Hotel,
          },
          {
            name: 'Industrial Workforce Orientation',
            desc: 'Site safety briefings, hazardous zone access instructions, perimeter rules, and technical contractor emergency protocols.',
            icon: Factory,
          },
          {
            name: 'Logistics Facility Orientation',
            desc: 'Yard circulation guidelines, loading dock check-in instructions, driver amenities, and warehouse safety protocols.',
            icon: Warehouse,
          },
          {
            name: 'Automotive Customer Journey',
            desc: 'Service center arrival instructions, customer lounge guidance, and live vehicle service status touchpoints.',
            icon: Car,
          },
          {
            name: 'Mixed-Use Integrated Experience',
            desc: 'The pinnacle of composition: seamless contextual transitions across residential, office, and retail tiers under CORE authority.',
            icon: Layers,
          },
        ],
      },
      intelligencePreview: {
        badge: 'ASSISTIVE INTELLIGENCE PREVIEW',
        title: 'Governed AI Orchestration Within Experience Journeys',
        desc: 'Assistive intelligence inside C&E operates strictly as an orchestrator subordinate to verified human authority, following a 6-step flow:',
        steps: [
          { title: '1. Context', desc: 'Identifies the physical space, property asset, and verified user.' },
          { title: '2. Intent', desc: 'Clarifies what the occupant or manager seeks to accomplish.' },
          { title: '3. Authority', desc: 'Confirms required mandates and workspace rights in CORE.' },
          { title: '4. Planning', desc: 'Constructs an operational proposal for the appropriate provider.' },
          { title: '5. Human Approval', desc: 'Action requires explicit confirmation by an authorized human.' },
          { title: '6. Immutable Receipt', desc: 'Permanent audit logging across system event records.' },
        ],
        note: 'AI never creates legal authority, executes autonomous financial transfers, or overrides mandatory human approvals.',
      },
      availability: {
        badge: 'TRANSPARENCY & DEPLOYMENT GOVERNANCE',
        title: 'Experience Architecture Maturity & Release Governance',
        desc: 'Our public presentation outlines the holistic architectural model of Community & Experience. In real-world enterprise deployments, capability availability is governed individually by product release status and customer implementation agreements.',
        points: [
          'C&E capabilities are modularly assembled based on active workspace subscription tiers and property DNA requirements.',
          'Advanced capabilities (such as automated guest journey coordination, retail marketplace integrations, or automated concierge workflows) represent target architectural designs subject to roadmap maturity.',
          'Architectural safety is absolute: no experience touchpoint can create unauthorized mutation states in canonical truth providers.',
        ],
      },
      cta: {
        title: 'Architect the Experience Layer for Your Real Estate Portfolio',
        desc: 'Connect with CLADORA platform architects to explore how the Community & Experience domain can unify interactions across your built-world assets.',
        primary: 'Explore Platform Architecture',
        secondary: 'Contact Platform Architects',
      },
    },
    fa: {
      breadcrumb: { home: 'خانه', current: 'جامعه و تجربه کاربری (C&E)' },
      hero: {
        badge: 'دامنهٔ هم‌ردهٔ جامعه و تجربه کاربری (C&E)',
        title: 'تجربهٔ کاربری متصل به بستر و بافت ملک',
        subtitle:
          'دامنهٔ جامعه و تجربه کاربری (C&E) در کلادورا طوری طراحی شده است که تعاملات جمعی، راهنمای اماکن، رویدادها و مسیرهای کاربری را بر پایه همان هویت پایدار ملک، تفکیک فضاهای کاری و حدود اختیارات سراسری پلتفرم ترکیب نماید.',
        ctaPrimary: 'بررسی معماری لایه تجربه کاربری',
        ctaSecondary: 'مشاهده معماری جامع پلتفرم',
      },
      peerDomain: {
        badge: 'جایگاه هم‌رده و مستقل در معماری',
        title: 'C&E به عنوان دامنهٔ هم‌رده در کنار AIRPROP، SERVICE و OPERATIONS',
        desc: 'در ساختار مهندسی کلادورا، تجربه کاربری یک افزونهٔ تزئینی یا صرفاً صف تیکت‌های نگهداری نیست. C&E به عنوان یک دامنهٔ هم‌رده و مستقل (Peer Domain) در کنار چرخه تجاری (AIRPROP)، هماهنگی خدمات (SERVICE) و عملیات فنی نگهداری (OPERATIONS) قرار دارد.',
        points: [
          {
            title: 'یک ماژول فرعی تعمیراتی نیست',
            desc: 'C&E شاخه‌ای از صدور دستورکار نیست، بلکه شیوه درک، جهت‌یابی و تعامل افراد با دارایی فیزیکی را سازمان‌دهی می‌کند.',
          },
          {
            title: 'نفی جزیره‌های اطلاعاتی موازی',
            desc: 'این دامنه هرگز دفاتر مالی جداگانه، دیتابیس رزرو مستقل یا پرونده‌های موازی کاربران ایجاد نمی‌کند.',
          },
          {
            title: 'مصرف‌کنندهٔ حقیقت واحد مرجع',
            desc: 'تمام نقاط تجربه کاربری، هویت را از CORE، اسناد را از VAULT، ظرفیت را از BK01 و تراکنش‌ها را از FIN01 دریافت می‌نمایند.',
          },
        ],
      },
      flowSection: {
        badge: 'مدل ترکیب‌پذیری زمینه‌محور',
        title: 'چگونگی زایش تجربه کاربری از بستر و حقیقت فیزیکی ملک',
        desc: 'تجربه کاربری هرگز در خلأ شکل نمی‌گیرد، بلکه از یک زنجیره معماری پیوسته و قطعی استخراج می‌گردد:',
        steps: [
          {
            num: '۰۱',
            name: 'فرد و هویت (Person)',
            desc: 'هویت تأییدشده فرد در CORE با لایه‌های امنیتی مستحکم.',
            icon: Users,
          },
          {
            num: '۰۲',
            name: 'رابطهٔ سکونتی (Relationship)',
            desc: 'مالک، مستأجر مسکونی، پرسنل اداری، مهمان یا تکنسین.',
            icon: UserCheck,
          },
          {
            num: '۰۳',
            name: 'بافت مکانی (Property Context)',
            desc: 'پلاک ثبتی، کالبد ساختمان، طبقه، واحد و مشاعات مجاز.',
            icon: MapPin,
          },
          {
            num: '۰۴',
            name: 'اختیارات و مأموریت (Authority)',
            desc: 'مرزهای ورک‌اسپیس، دامنه محرمانگی و مأموریت فعال زمانی.',
            icon: ShieldCheck,
          },
          {
            num: '۰۵',
            name: 'ترکیب تجربه کاربری (C&E)',
            desc: 'چینش هوشمند راهنماها، تابلوی اعلانات، رویدادها و خدمات.',
            icon: Compass,
          },
          {
            num: '۰۶',
            name: 'ارجاع به متولیان مرجع',
            desc: 'درخواست‌ها به SERVICE/OPS، رزرواسیون به BK01، اسناد به FIN01.',
            icon: CheckCircle2,
          },
        ],
      },
      communityLayer: {
        badge: 'لایه تعاملات جمعی',
        title: 'فضاهای اجتماعی مرزبندی‌شده و مشارکت مبتنی بر مجوز',
        desc: 'تعاملات اجتماعی و سازمانی بر بستر ساختار فیزیکی و اداری ساختمان هدایت می‌شوند:',
        items: [
          {
            title: 'عضویت اعتبارسنجی‌شده در ورک‌اسپیس',
            desc: 'حضور و تعامل در فضاهای هر ملک صرفاً به اعضای مجاز و دارای نقش فعال محدود می‌گردد.',
          },
          {
            title: 'تابلوی اعلانات دیجیتال و تصمیم‌گیری',
            desc: 'اطلاع‌رسانی رسمی هیئت‌مدیره، انتشار قوانین و رأی‌گیری‌های اساسنامه‌ای با شفافیت کامل.',
          },
          {
            title: 'حفظ حریم خصوصی و تفکیک مرزها',
            desc: 'همسایگان در فضاهای مشترک تعامل می‌کنند بدون آنکه سوابق مالی یا جزئیات واحدهایشان افشا گردد.',
          },
          {
            title: 'شناخت امکانات مشترک مجتمع',
            desc: 'ارائه ساعات استفاده، ضوابط بهره‌برداری و هشدارهای نگهداری برای امکانات رفاهی ساختمان.',
          },
        ],
      },
      guidesSection: {
        badge: 'راهنماها و بستر مکانی',
        title: 'راهنمای دارایی، پروتکل‌های ورود و راهنمایی محیطی',
        desc: 'دامنه C&E دستورالعمل‌های بهره‌برداری را در زمان و مکان مناسب به ساکنان و بهره‌برداران ارائه می‌دهد:',
        items: [
          {
            title: 'راهنمای فنی تجهیزات و واحد',
            desc: 'آموزش‌های کاربردی برای تنظیم ترموستات‌ها، جعبه فیوز، آیفون تصویری و کنتورهای تفکیکی.',
          },
          {
            title: 'پروتکل‌های ورود و دسترسی',
            desc: 'دستورالعمل‌های شفاف برای مراجعان، اسباب‌کشی، بسته‌های پستی و پارکینگ‌های مهمان.',
          },
          {
            title: 'قوانین و استانداردهای مجتمع',
            desc: 'دسترسی همیشگی به ساعات آرامش، ضوابط نگهداری حیوانات خانگی و استفاده از بام و حیاط.',
          },
          {
            title: 'اطلاعات محله و خدمات پیرامونی',
            desc: 'اطلاعات مدیریت پسماند تفکیکی، ایستگاه‌های حمل‌ونقل و شماره‌های اضطراری امدادی.',
          },
        ],
      },
      eventsSection: {
        badge: 'هماهنگی رویدادها و جلسات',
        title: 'اطلاع‌رسانی گردهمایی‌ها، مجامع عمومی و ثبت تمایل به حضور',
        desc: 'الگوی ساختاری برای برنامه‌های همگانی و جلسات رسمی تصمیم‌گیری:',
        items: [
          {
            title: 'مجامع عمومی و جلسات رسمی',
            desc: 'فراخوان رسمی جلسات قانونی، دستور کار مصوب و انتشار اسناد پیش از برگزاری مجمع.',
          },
          {
            title: 'پویش‌ها و گردهمایی‌های داخلی',
            desc: 'برنامه‌های درختکاری، بهسازی مشاعات و جشن‌های سالانه که توسط ساکنان هماهنگ می‌شوند.',
          },
          {
            title: 'اعلام تمایل به حضور (RSVP)',
            desc: 'امکان سنجش حدنصاب و تنظیم امکانات سالن اجتماعات بر اساس تعداد حاضران قطعی.',
          },
          {
            title: 'کنترل ظرفیت فضا از طریق BK01',
            desc: 'هر رویداد برای اشغال سالن یا روف‌گاردن، محدودیت‌های ظرفیت را مستقیماً از ارائه‌دهنده BK01 بررسی می‌کند.',
          },
        ],
      },
      journeysSection: {
        badge: 'لایه ترکیب مسیرهای کاربری',
        title: 'الگوهای شش‌گانه مسیرهای تعاملی در دنیای املاک',
        desc: 'دامنه C&E تجربه کاربری را از طریق ۶ الگوی مرجع در کاربری‌های گوناگون طراحی می‌نماید:',
        journeys: [
          {
            role: 'مسیر سکونت ساکن (Resident Journey)',
            desc: 'پذیرش در ساختمان، ثبت کنتور اولیه، بررسی هزینه‌ها در FIN01، ثبت تعمیرات و رأی در مجمع.',
            badge: 'مسکونی',
          },
          {
            role: 'مسیر پرسنل اداری (Workplace Tenant)',
            desc: 'ورود کارمند، رزرو اتاق جلسات در BK01، صدور بلیت مهمان و ارسال درخواست‌های پشتیبانی اداری.',
            badge: 'فضاهای کار',
          },
          {
            role: 'مسیر مراجع و مهمان (Visitor Journey)',
            desc: 'دریافت مجوز دیجیتال تردد، ورود به پارکینگ، عبور از گیت و هدایت طبقاتی در بازه زمانی معین.',
            badge: 'تردد موقت',
          },
          {
            role: 'مسیر مسافر هتل (Guest Journey)',
            desc: 'راهنمای پذیرش، کتابچه دیجیتال اتاق، رزرو امکانات استخر و اسپا در BK01 و خروج بدون معطلی.',
            badge: 'اقامتی',
          },
          {
            role: 'مسیر مشتری تجاری (Retail Customer)',
            desc: 'نقشه دیجیتال مرکز خرید، امکانات رفاهی خانواده، ساعات کاری اصناف و تخفیف پارکینگ.',
            badge: 'تجاری',
          },
          {
            role: 'مسیر تکنسین پیمانکار (Contractor)',
            desc: 'نکات ایمنی سایت، صدور مجوز کار گرم، دسترسی به موتورخانه و تأیید نهایی چک‌لیست پایان کار.',
            badge: 'عملیاتی',
          },
        ],
      },
      boundariesSection: {
        badge: 'انضباط مرزهای متولیان داده',
        title: 'تفکیک دقیق وظایف: C&E در برابر ارائه‌دهندگان مرجع حقیقت',
        desc: 'برای حفظ یکپارچگی سیستمی و جلوگیری از تداخل داده‌ها، اختیارات C&E کاملاً از متولیان مرجع تفکیک شده است:',
        boundaries: [
          {
            domain: 'C&E در برابر SERVICE',
            role: 'ترکیب تجربه در برابر قصد خرید خدمت',
            rule: 'دامنه C&E نیاز یا خدمات را نمایش می‌دهد؛ SERVICE متولی رسمی ثبت درخواست، مقایسه قیمت‌ها و سفارش کار است.',
            icon: Wrench,
          },
          {
            domain: 'C&E در برابر BK01',
            role: 'نمایش تقویم در برابر حقیقت ظرفیت',
            rule: 'دامنه C&E تقویم را به کاربر نشان می‌دهد؛ BK01 مرجع انحصاری کنترل ظرفیت، سانس‌ها و رفع تداخلات زمانی است.',
            icon: Calendar,
          },
          {
            domain: 'C&E در برابر FIN01',
            role: 'تعامل در برابر حقیقت مالی',
            rule: 'دامنه C&E هیچ کیف پول، امتیاز یا حسابی نگه نمی‌دارد. تمام رویدادهای مالی منحصراً در FIN01 ثبت می‌گردند.',
            icon: DollarSign,
          },
          {
            domain: 'C&E در برابر COMMUNICATIONS',
            role: 'موقعیت تعاملی در برابر ارسال پیام',
            rule: 'دامنه C&E موقعیت پیام در مسیر را تعیین می‌کند؛ COMMUNICATIONS متولی ارسال چندکاناله و ثبت اصالت تحویل است.',
            icon: MessageSquare,
          },
        ],
      },
      presetsSection: {
        badge: 'پیکربندی‌های تخصصی تجربه در صنایع',
        title: 'انطباق تجربه کاربری با بسترهای هشت‌گانه دنیای املاک',
        desc: 'پیکربندی صنعت، نرم‌افزاری جداگانه نیست؛ بلکه کالیبراسیون دامنه‌های پلتفرم متناسب با واقعیت فیزیکی دارایی است:',
        presets: [
          {
            name: 'تجربه زیست مسکونی',
            desc: 'کتابچه مجتمع، تابلوی اعلانات، ارقام شارژ از FIN01، ثبت درخواست خرابی و جلسات هیئت‌مدیره.',
            icon: Building2,
          },
          {
            name: 'تجربه اداری و فضاهای کار',
            desc: 'پذیرش کارکنان، رزرو اتاق کنفرانس از طریق BK01، صدور مجوز مراجعان و دستورکارهای پشتیبانی.',
            icon: Briefcase,
          },
          {
            name: 'تجربه مراکز تجاری و خرید',
            desc: 'راهنمای غرفه‌ها، خدمات رفاهی مراجعان، ارتباطات مالکان با اصناف و ساعات عمومی.',
            icon: Store,
          },
          {
            name: 'تجربه اقامتی و هتلداری',
            desc: 'کتابچه دیجیتال هتل، راهنمای پذیرش و تقویم رزرو امکانات رفاهی (اسپا، استخر) متصل به BK01.',
            icon: Hotel,
          },
          {
            name: 'بستر نیروی کار صنعتی',
            desc: 'دستورالعمل‌های ایمنی کارگاه، مجوزهای ورود، قوانین پیرامونی و مسیرهای اضطراری تأسیساتی.',
            icon: Factory,
          },
          {
            name: 'بستر اپراتورهای لجستیک',
            desc: 'قوانین تردد در محوطه، راهنمای استقرار در بارانداز، امکانات رانندگان و ضوابط ایمنی سوله.',
            icon: Warehouse,
          },
          {
            name: 'مسیر مشتریان مجتمع‌های خودرویی',
            desc: 'پروتکل‌های پذیرش خودرو، امکانات سالن انتظار مشتریان و هشدارهای مرحله‌ای فرایند سرویس.',
            icon: Car,
          },
          {
            name: 'تجربه پروژه‌های چندمنظوره (Mixed-Use)',
            desc: 'اوج ترکیب‌پذیری: جابجایی پیوسته میان بخش‌های مسکونی، اداری و تجاری بر پایه حدود اختیارات CORE.',
            icon: Layers,
          },
        ],
      },
      intelligencePreview: {
        badge: 'پیش‌نمایش هوش عملیاتی',
        title: 'ارکستراسیون تحت نظارت انسان در مسیرهای تعاملی',
        desc: 'هوش مصنوعی در دامنه C&E صرفاً به عنوان دستیار کمکی و تحت فرمان مأموریت‌های انسانی در یک فرآیند ۶ مرحله‌ای عمل می‌کند:',
        steps: [
          { title: '۱. بافت ملک (Context)', desc: 'شناسایی فضا، دارایی فیزیکی و هویت کاربر.' },
          { title: '۲. مقصود (Intent)', desc: 'شفاف‌سازی خواسته و هدف مورد نظر کاربر.' },
          { title: '۳. بررسی مأموریت (Authority)', desc: 'تأیید حدود اختیارات کاربر در هسته CORE.' },
          { title: '۴. برنامه‌ریزی (Plan)', desc: 'تدوین بسته پیشنهادی برای متولی اصلی داده‌ها.' },
          { title: '۵. تأیید انسانی (Approval)', desc: 'اجرا منوط به تأیید صریح شخص دارای صلاحیت است.' },
          { title: '۶. ثبت ردپا (Audit)', desc: 'ثبت دائمی و غیرقابل تغییر رویداد در سوابق ممیزی.' },
        ],
        note: 'هوش مصنوعی هرگز حق قانونی ایجاد نمی‌کند، پرداخت خودسرانه انجام نمی‌دهد و تأیید انسانی را دور نمی‌زند.',
      },
      availability: {
        badge: 'شفافیت حاکمیت و سطح بلوغ سامانه',
        title: 'بلوغ معماری دامنه تجربه و حاکمیت استقرار',
        desc: 'بخش حاضر معماری کلان دامنه جامعه و تجربه کاربری را ترسیم می‌نماید. در استقرارهای واقعی در سطح سازمان‌ها، میزان فعال‌سازی هر قابلیت به فاز انتشار محصول و قرارداد اجرایی هر پروژه وابسته است.',
        points: [
          'قابلیت‌های C&E بر اساس اشتراک فعال ورک‌اسپیس و کالبد فیزیکی ملک فعال‌سازی می‌شوند.',
          'ویژگی‌های پیشرفته (مانند اتوماسیون کامل پذیرش مهمان یا سیستم‌های خودکار کنسیرژ) در زمره برنامه‌های هدف معماری بوده و مشمول مراحل بعدی انتشار هستند.',
          'امنیت معماری قطعی است: هیچ فرایند تعاملی در C&E نمی‌تواند بدون احراز هویت در متولیان مرجع داده تغییری ایجاد کند.',
        ],
      },
      cta: {
        title: 'طراحی لایه تجربه کاربری برای سبد دارایی‌های ملکی شما',
        desc: 'با متخصصان معماری پلتفرم کلادورا درباره نحوه یکپارچه‌سازی تعاملات ساکنان، مستأجران و مراجعان بر بستر دارایی‌های فیزیکی گفتگو نمایید.',
        primary: 'مشاهده معماری پلتفرم',
        secondary: 'تماس با مهندسان پلتفرم',
      },
    },
  }[lang] || {
    breadcrumb: { home: 'Home', current: 'Community & Experience' },
    hero: { badge: '', title: '', subtitle: '', ctaPrimary: '', ctaSecondary: '' },
    peerDomain: { badge: '', title: '', desc: '', points: [] },
    flowSection: { badge: '', title: '', desc: '', steps: [] },
    communityLayer: { badge: '', title: '', desc: '', items: [] },
    guidesSection: { badge: '', title: '', desc: '', items: [] },
    eventsSection: { badge: '', title: '', desc: '', items: [] },
    journeysSection: { badge: '', title: '', desc: '', journeys: [] },
    boundariesSection: { badge: '', title: '', desc: '', boundaries: [] },
    presetsSection: { badge: '', title: '', desc: '', presets: [] },
    intelligencePreview: { badge: '', title: '', desc: '', steps: [], note: '' },
    availability: { badge: '', title: '', desc: '', points: [] },
    cta: { title: '', desc: '', primary: '', secondary: '' },
  };

  return (
    <main className="min-h-screen pt-32 pb-24 bg-[#F6F9FC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        
        {/* 01 HERO SECTION */}
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
              <Compass className="w-3.5 h-3.5" />
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
                href="#peer-domain"
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0E9F8E] text-white text-xs font-bold hover:bg-[#0C8778] transition shadow-card"
              >
                <span>{content.hero.ctaPrimary}</span>
                <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>
              <Link
                href={`/${lang}/platform/architecture`}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white border border-[#D3DCE6] text-[#102A43] text-xs font-bold hover:bg-[#F0F4F8] transition"
              >
                <span>{content.hero.ctaSecondary}</span>
              </Link>
            </div>
          </div>
        </section>

        {/* 02 PEER DOMAIN POSITIONING */}
        <section id="peer-domain" className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.peerDomain.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.peerDomain.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.peerDomain.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {content.peerDomain.points.map((pt, i) => (
              <div
                key={i}
                className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-3"
              >
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center font-bold">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-bold text-[#102A43]">{pt.title}</h3>
                <p className="text-xs text-[#52667A] leading-relaxed">{pt.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-100 flex items-center justify-between flex-wrap gap-4 text-xs">
            <div className="flex items-center gap-2 text-[#0E9F8E] font-medium">
              <span className="font-bold">Connected Peer Domains:</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-[#102A43]">AIRPROP</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-[#102A43]">SERVICE</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-[#102A43]">OPERATIONS</span>
              <span className="font-mono bg-teal-600 px-2 py-0.5 rounded text-white font-bold">C&amp;E</span>
            </div>
            <Link
              href={`/${lang}/capabilities`}
              className="font-bold text-[#0E9F8E] hover:underline inline-flex items-center gap-1"
            >
              <span>Explore Capability Matrix</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
          </div>
        </section>

        {/* 03 FROM PROPERTY CONTEXT TO EXPERIENCE FLOW */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.flowSection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.flowSection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.flowSection.desc}
            </p>
          </div>

          {/* Flow Visual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 pt-4">
            {content.flowSection.steps.map((st, idx) => {
              const Icon = st.icon;
              return (
                <div
                  key={idx}
                  className="relative p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono font-bold text-[#0E9F8E]">{st.num}</span>
                      <Icon className="w-4 h-4 text-[#52667A]" />
                    </div>
                    <h3 className="text-xs font-bold text-[#102A43] leading-snug">{st.name}</h3>
                    <p className="text-[11px] text-[#52667A] leading-relaxed">{st.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#D3DCE6] text-xs text-[#52667A] leading-relaxed">
            <strong className="text-[#102A43]">Architectural Principle:</strong> C&amp;E consumes verified relationships and property boundaries from <span className="font-mono text-[#102A43] font-semibold">CORE</span>, capacity truth from <span className="font-mono text-[#102A43] font-semibold">BK01</span>, document proofs from <span className="font-mono text-[#102A43] font-semibold">DOCUMENTS</span>, and financial balances from <span className="font-mono text-[#102A43] font-semibold">FIN01</span>. It never acts as a shadow database.
          </div>
        </section>

        {/* 04 COMMUNITY LAYER */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.communityLayer.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.communityLayer.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.communityLayer.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.communityLayer.items.map((it, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#0E9F8E]" />
                  <h3 className="text-sm font-bold text-[#102A43]">{it.title}</h3>
                </div>
                <p className="text-xs text-[#52667A] leading-relaxed ps-4">{it.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 05 GUIDES & PLACE CONTEXT */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.guidesSection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.guidesSection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.guidesSection.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.guidesSection.items.map((it, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2"
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0E9F8E]" />
                  <h3 className="text-sm font-bold text-[#102A43]">{it.title}</h3>
                </div>
                <p className="text-xs text-[#52667A] leading-relaxed ps-6">{it.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 06 EVENTS & PARTICIPATION */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.eventsSection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.eventsSection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.eventsSection.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.eventsSection.items.map((it, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#0E9F8E]" />
                  <h3 className="text-sm font-bold text-[#102A43]">{it.title}</h3>
                </div>
                <p className="text-xs text-[#52667A] leading-relaxed ps-6">{it.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 07 JOURNEY COMPOSITION */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.journeysSection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.journeysSection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.journeysSection.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.journeysSection.journeys.map((jn, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] flex flex-col justify-between space-y-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-teal-50 text-[#0E9F8E] border border-teal-200">
                      {jn.badge}
                    </span>
                    <Compass className="w-4 h-4 text-[#52667A]" />
                  </div>
                  <h3 className="text-sm font-bold text-[#102A43]">{jn.role}</h3>
                  <p className="text-xs text-[#52667A] leading-relaxed">{jn.desc}</p>
                </div>
                <div className="pt-2 border-t border-[#E2E8F0] text-[11px] text-[#0E9F8E] font-medium flex items-center gap-1">
                  <span>Architectural Archetype</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 08 CANONICAL BOUNDARY DISCIPLINE */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.boundariesSection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.boundariesSection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.boundariesSection.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.boundariesSection.boundaries.map((bd, idx) => {
              const Icon = bd.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center font-bold">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[#102A43]">{bd.domain}</h3>
                      <span className="text-[11px] text-[#0E9F8E] font-semibold">{bd.role}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#52667A] leading-relaxed">{bd.rule}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 09 EXPERIENCE PRESETS BY INDUSTRY */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.presetsSection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.presetsSection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.presetsSection.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {content.presetsSection.presets.map((pr, idx) => {
              const Icon = pr.icon;
              return (
                <div
                  key={idx}
                  className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0E9F8E] flex items-center justify-center">
                      <Icon className="w-4 h-4" />
                    </div>
                    <h3 className="text-xs font-bold text-[#102A43] leading-snug">{pr.name}</h3>
                    <p className="text-[11px] text-[#52667A] leading-relaxed">{pr.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-4 rounded-xl bg-[#F6F9FC] border border-[#D3DCE6] flex items-center justify-between flex-wrap gap-4 text-xs">
            <span className="text-[#52667A]">
              Connects directly with the 8 canonical contexts defined in Industries Architecture.
            </span>
            <Link
              href={`/${lang}/industries`}
              className="font-bold text-[#0E9F8E] hover:underline inline-flex items-center gap-1"
            >
              <span>View Industries Architecture</span>
              <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
            </Link>
          </div>
        </section>

        {/* 10 INTELLIGENCE PREVIEW */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.intelligencePreview.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.intelligencePreview.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.intelligencePreview.desc}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {content.intelligencePreview.steps.map((st, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-1.5"
              >
                <span className="text-[11px] font-bold text-[#0E9F8E]">{st.title}</span>
                <p className="text-[11px] text-[#52667A] leading-tight">{st.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{content.intelligencePreview.note}</span>
          </div>
        </section>

        {/* 11 AVAILABILITY & DEPLOYMENT GOVERNANCE */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-3">
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

          <div className="space-y-3 pt-2">
            {content.availability.points.map((pt, idx) => (
              <div key={idx} className="flex items-start gap-3 p-4 rounded-xl bg-[#F6F9FC] border border-[#E2E8F0] text-xs text-[#52667A] leading-relaxed">
                <CheckCircle2 className="w-4 h-4 text-[#0E9F8E] shrink-0 mt-0.5" />
                <span>{pt}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 12 FINAL CTA SECTION */}
        <section className="bg-gradient-to-br from-[#102A43] to-[#0A1A2A] rounded-3xl p-8 sm:p-14 text-white space-y-6 text-center">
          <div className="max-w-2xl mx-auto space-y-3">
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
              {content.cta.title}
            </h2>
            <p className="text-sm sm:text-base text-[#9FB3C8] leading-relaxed">
              {content.cta.desc}
            </p>
          </div>
          <div className="pt-4 flex flex-col sm:flex-row justify-center gap-3">
            <Link
              href={`/${lang}/platform/architecture`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-[#0E9F8E] text-white text-xs font-bold hover:bg-[#0C8778] transition shadow-card"
            >
              <span>{content.cta.primary}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
            <Link
              href={`/${lang}/contact`}
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition border border-white/10"
            >
              <span>{content.cta.secondary}</span>
            </Link>
          </div>
        </section>

      </div>
    </main>
  );
}
