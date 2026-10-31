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
  Wrench,
  CheckCircle2,
  MapPin,
  Briefcase,
  FileText,
  DollarSign,
  MessageSquare,
  UserCheck,
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
        badge: 'DOMENIUL PEER COMUNITATE & EXPERIENȚĂ (CE)',
        title: 'Experiență Conectată la Contextul Proprietății',
        subtitle:
          'Domeniul Comunitate & Experiență (CE) din CLADORA este proiectat să compună viața comunitară, ghidurile de spațiu, evenimentele și călătoriile contextuale în jurul aceleiași identități de proprietate, acelorași granițe de workspace și aceluiași model de autoritate utilizate în întreaga platformă.',
        ctaPrimary: 'Explorează Arhitectura de Experiență',
        ctaSecondary: 'Arhitectura Platformei',
      },
      peerDomain: {
        badge: 'RANG ARHITECTURAL EGAL',
        title: 'CE ca Domeniu Peer Alături de AIRPROP, SERVICE & OPERAȚIUNI',
        desc: 'În arhitectura CLADORA, experiența ocupantului nu este un simplu modul secundar de tichete și nici o aplicație izolată de chat rezidențial. CE se poziționează ca un domeniu de prim rang (Peer Domain), proiectat să compună interacțiunea umană pe baza adevărului furnizat de nucleul comun.',
        points: [
          {
            title: 'Nu este un Submodul de Mentenanță',
            desc: 'CE nu este un apendice al modulului de intervenții tehnice. El guvernează modul în care oamenii percep și interacționează cu spațiul fizic.',
          },
          {
            title: 'Fără Baze de Date Duplicate',
            desc: 'CE nu își inventează propriul registru financiar, propriul calendar izolat de rezervări sau o identitate paralelă de utilizator.',
          },
          {
            title: 'Consumator de Adevăr Canonic',
            desc: 'Orice interacțiune din CE consumă identitatea din CORE, documentele din VAULT, capacitatea din BK01 și tranzacțiile din FIN01.',
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
            name: 'Compoziția Experienței (CE)',
            desc: 'Sinteza ghidurilor relevante, avizierului, resurselor și fluxurilor disponibile.',
            icon: Compass,
          },
          {
            num: '06',
            name: 'Execuție Canonică',
            desc: 'Comenzile merg la SERVICE/OPS, rezervările la BK01, tranzacțiile la FIN01.',
            icon: CheckCircle2,
          },
        ],
        principle:
          'Principiu Arhitectural: CE consumă relațiile verificate și granițele de proprietate din CORE (unde arhitectura impune respingerea oricărei mutații când autoritatea nu poate fi stabilită), adevărul de capacitate din BK01, contextul canonic de documente din DOCUMENTS și adevărul financiar din FIN01. CE nu acționează niciodată ca o bază de date paralelă.',
      },
      communityLayer: {
        badge: 'STRATUL COMUNITAR',
        title: 'Spații Comunitare Delimitate & Participare Autorizată',
        desc: 'Interacțiunea comunitară a ocupanților este ancorată arhitectural în granițe fizice și administrative verificate:',
        items: [
          {
            title: 'Context de Membru & Comunitate',
            desc: 'Cadrul arhitectural pentru interacțiunea în spațiile clădirii este delimitat pe baza calității de membru și a rolurilor din workspace.',
          },
          {
            title: 'Informații Comunitare & Context de Participare',
            desc: 'Modelul arhitectural pentru publicarea informărilor administrative, avizelor de clădire și inițiativelor structurate de consultare.',
          },
          {
            title: 'Delimitare de Confidențialitate & Izolare',
            desc: 'Interacțiunile în spațiile partajate desemnate sunt proiectate să protejeze granițele unităților private și evidențele financiare.',
          },
          {
            title: 'Reguli de Spațiu Partajat & Facilități',
            desc: 'Prezentarea contextuală a regulilor de spațiu comun, orarelor stabilite și ghidajului de utilizare pentru facilitățile colective.',
          },
        ],
      },
      guidesSection: {
        badge: 'GHIDURI & CONTEXT DE LOC',
        title: 'Ghiduri de Proprietate, Informații de Sosire & Asistență Spațială',
        desc: 'CE structurează documentația operațională pentru a fi utilă în momentul și locul potrivit (categorii ilustrative de ghiduri, neimplicând o bibliotecă live universală):',
        items: [
          {
            title: 'Ghidul Tehnic al Spațiului',
            desc: 'Exemple ilustrative: instrucțiuni de operare pentru termostate, panouri de siguranțe, interfon și contoare individuale.',
          },
          {
            title: 'Protocol de Sosire & Acces',
            desc: 'Exemple ilustrative: informații de orientare pentru oaspeți, curieri și echipe de mutare (puncte de parcare, lifturi de marfă).',
          },
          {
            title: 'Regulamente & Conduită',
            desc: 'Exemple ilustrative: prezentarea normelor de conviețuire stabilite de comunitate pentru spațiile partajate.',
          },
          {
            title: 'Puncte de Interes Local',
            desc: 'Exemple ilustrative: note contextuale privind serviciile de proximitate, colectarea selectivă și transportul public.',
          },
        ],
      },
      eventsSection: {
        badge: 'COORDONARE DE EVENIMENTE',
        title: 'Descoperirea Evenimentelor, Adunări & Intenție de Participare',
        desc: 'Modelul arhitectural pentru evenimentele de comunitate și adunări (model conceptual de compoziție, fără a implica vot statutar certificat sau ticketing comercial în producție):',
        items: [
          {
            title: 'Adunări Generale & Ședințe',
            desc: 'Calendarul orientativ al convocărilor, ordinea de zi propusă și consultarea materialelor de discuție.',
          },
          {
            title: 'Inițiative Comunitare',
            desc: 'Acțiuni de ecologizare, amenajare peisagistică sau evenimente festive propuse de locatari.',
          },
          {
            title: 'Intenție de Prezență (RSVP)',
            desc: 'Înregistrarea intenției de participare pentru dimensionarea adecvată a resurselor spațiului.',
          },
          {
            title: 'Verificarea Capacității prin BK01',
            desc: 'Evenimentele care ocupă un spațiu fizic consultă modelul de disponibilitate din motorul desemnat BK01.',
          },
        ],
      },
      journeysSection: {
        badge: 'ARHETIPURI DE CĂLĂTORIE',
        title: 'Compoziția Călătoriilor Contextuale în Mediul Construit',
        desc: 'CE modelează experiența prin 6 arhetipuri fundamentale de călătorie (journey archetypes):',
        qualification:
          'Notă de Calificare Arhitecturală: Punctele de contact de mai jos reprezintă compoziții și arhetipuri conceptuale de călătorie utilizate în modelarea arhitecturii, nu fluxuri de lucru lansate universal în producție.',
        journeys: [
          {
            role: 'Călătoria Rezidentului',
            desc: 'Exemple ilustrative de compoziție: onboarding la mutare, referință cote FIN01, solicitări de reparații și puncte de consultare asociativă unde sunt activate.',
            badge: 'Rezidențial',
          },
          {
            role: 'Călătoria Chiriașului Corporate',
            desc: 'Exemple ilustrative de compoziție: orientare corporativă, interogare disponibilitate săli prin BK01, ecusoane de vizitator și solicitări de asistență administrativă.',
            badge: 'Workplace',
          },
          {
            role: 'Călătoria Vizitatorului',
            desc: 'Exemple ilustrative de compoziție: pre-înregistrare invitație, orientare parcare, ghidaj acces turnichet și navigație interioară delimitată în timp.',
            badge: 'Acces Temporar',
          },
          {
            role: 'Călătoria Oaspetelui',
            desc: 'Exemple ilustrative de compoziție: asistență la sosire, ghid digital al camerei, solicitări de facilități partajate orientate către BK01 și ghidaj de plecare.',
            badge: 'Ospitalitate',
          },
          {
            role: 'Călătoria Clientului Comercial',
            desc: 'Exemple ilustrative de compoziție: orientare în centrul comercial, ghidul facilităților pentru clienți, informări de orar și puncte de validare parcare.',
            badge: 'Retail',
          },
          {
            role: 'Călătoria Contractorului',
            desc: 'Exemple ilustrative de compoziție: instructaj de securitate pe șantier/clădire, verificare permis de intervenție și confirmare direcționată a finalizării lucrării.',
            badge: 'Operațional',
          },
        ],
      },
      boundariesSection: {
        badge: 'GRANIȚE CANONICE STRINGENTE',
        title: 'Separarea Clară a Responsabilităților: CE vs. Furnizorii de Adevăr',
        desc: 'Pentru a preveni degradarea integrității datelor, rolul CE este strict delimitat de cel al furnizorilor de adevăr canonic:',
        boundaries: [
          {
            domain: 'CE vs. SERVICE',
            role: 'Compoziția Experienței vs. Semantica Comenzilor',
            rule: 'CE prezintă contextul sau catalogul de asistență; SERVICE este desemnat să dețină semantica cererilor și comenzilor de servicii, inclusiv etapele relevante de ofertare, comandă și acceptanță acolo unde sunt lansate în producție.',
            icon: Wrench,
          },
          {
            domain: 'CE vs. BK01',
            role: 'Prezentare vs. Adevărul Capacității',
            rule: 'CE prezintă calendarele sau facilitățile; BK01 este desemnat drept autoritatea canonică responsabilă pentru modelul de disponibilitate, pragurile de capacitate și detectarea conflictelor de rezervare. CE nu deține adevăr de rezervare.',
            icon: Calendar,
          },
          {
            domain: 'CE vs. FIN01',
            role: 'Interacțiune vs. Adevărul Financiar',
            rule: 'CE nu deține solduri, portofele electronice sau registre paralele. FIN01 este desemnat drept proprietarul canonic al adevărului financiar, tranzacțiilor și evidențelor contabile aplicabile.',
            icon: DollarSign,
          },
          {
            domain: 'CE vs. COMUNICAȚII',
            role: 'Punct de Contact vs. Livrarea Mesajelor',
            rule: 'CE identifică oportunitatea notificării în călătorie; COMUNICAȚII este desemnat să guverneze dispecerizarea mesajelor și jurnalele de livrare, conform capabilităților active de canal.',
            icon: MessageSquare,
          },
          {
            domain: 'CE vs. DOCUMENTE (VAULT)',
            role: 'Afișare Ghiduri vs. Proveniență & Evidențe',
            rule: 'CE prezintă ghiduri și regulamente în interfață; DOCUMENTE (VAULT) deține versiunile canonice, etichetele sigure, proveniența și contextul auditat al documentelor, fără a presupune proprietăți criptografice necertificate.',
            icon: FileText,
          },
          {
            domain: 'CE vs. OPERAȚIUNI',
            role: 'Interacțiune Ocupant vs. Execuție Mentenanță',
            rule: 'CE colectează cererea de asistență; OPERAȚIUNI este proprietarul canonic al execuției ordinelor de lucru, atribuirii tehnice și checklist-urilor de intervenție în funcție de maturitatea operațională.',
            icon: Briefcase,
          },
          {
            domain: 'CE vs. CORE',
            role: 'Experiență Locală vs. Autoritate & Identitate',
            rule: 'CE compune experiența în limitele rolului; CORE guvernează identitatea, apartenența la workspace și autoritatea, unde arhitectura impune respingerea mutațiilor când autoritatea nu poate fi stabilită.',
            icon: ShieldCheck,
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
            desc: 'Ghidul condominiului, avizier comunitar, consultare cote din FIN01, propuneri de mentenanță și consultări de asociație unde sunt activate.',
            icon: Building2,
          },
          {
            name: 'Experiență Workplace & Office',
            desc: 'Orientarea noilor angajați, rezervarea birourilor și sălilor prin BK01, acreditări de vizitator și solicitări către FM.',
            icon: Briefcase,
          },
          {
            name: 'Experiență Retail & Centre Comerciale',
            desc: 'Ghidul spațiilor comerciale, orientare facilități pentru cumpărători, orare de funcționare și comunicare operațională cu comercianții.',
            icon: Store,
          },
          {
            name: 'Experiență Ospitalitate & Serviced Living',
            desc: 'Ghid digital de cazare, orientare la sosire și solicitări de rezervare a resurselor partajate ancorate arhitectural în BK01.',
            icon: Hotel,
          },
          {
            name: 'Context Muncitoresc Industrial',
            desc: 'Instructaje de securitate a muncii, permise de acces în zone reglementate, reguli de perimetru și protocoale de urgență tehnică.',
            icon: Factory,
          },
          {
            name: 'Context Operator Logistic',
            desc: 'Ghid de circulație în incintă, instrucțiuni de sosire la rampă, facilități pentru șoferi și protocoale de siguranță.',
            icon: Warehouse,
          },
          {
            name: 'Context Clienți Auto & Showroom',
            desc: 'Ghidul recepției service, asistență în zona de așteptare clienți și puncte de informare privind stadiul vehiculului.',
            icon: Car,
          },
          {
            name: 'Experiență Ansambluri Mixte (Mixed-Use)',
            desc: 'Compoziția de arhitectură: tranziția fluidă între zona rezidențială, de birouri și retail pe baza unui model partajat de identitate a proprietății și resurselor sub autoritatea CORE.',
            icon: Layers,
          },
        ],
      },
      intelligencePreview: {
        badge: 'PREVIZUALIZARE INTELIGENȚĂ ASISTIVĂ',
        title: 'Orchestrarea Asistivă în Călătoriile de Experiență',
        desc: 'Asistența inteligentă în cadrul CE acționează strict ca un orchestrator subordonat deciziei umane, urmând fluxul canonic în 6 pași:',
        steps: [
          { title: '1. Context', desc: 'Identifică spațiul, proprietatea și identitatea verificată.' },
          { title: '2. Intenție', desc: 'Clarifică ce anume solicită utilizatorul în contextul spațial.' },
          { title: '3. Autoritate', desc: 'Confirmă mandatul și permisiunile de workspace în CORE.' },
          { title: '4. Planificare', desc: 'Structurează propunerea operațională către furnizorul canonic adecvat.' },
          { title: '5. Revizuire Umană & Politici', desc: 'Acțiunile cu impact consecvent rămân supuse politicilor aplicabile și aprobării umane adecvate.' },
          { title: '6. Înregistrare de Audit', desc: 'Jurnalizarea contextuală a evenimentelor în traseele de audit ale platformei.' },
        ],
        note: 'AI operează în cadrul limitelor de autoritate verificate. Acțiunile cu impact consecvent rămân supuse politicilor aplicabile de control și aprobării umane adecvate.',
      },
      availability: {
        badge: 'TRANSPARENȚĂ & GUVERNANȚĂ OPERAȚIONALĂ',
        title: 'Maturitatea Arhitecturală a Domeniului de Experiență',
        desc: 'Prezentarea publică a domeniului Comunitate & Experiență descrie modelul arhitectural complet conceput pentru lumea construită. În practică, disponibilitatea fiecărei funcționalități este guvernată individual de stadiul de lansare al versiunii de produs și de perimetrul agreat în fiecare implementare.',
        points: [
          'Capabilitățile CE sunt compuse modular în funcție de abonamentul activ al workspace-ului și profilul proprietății.',
          'Capabilitățile orientate spre viitor (precum directorul de membri, feed-ul social, mesageria directă, marketplace-ul, programele de loialitate, concierge-ul AI sau automatizările avansate pentru oaspeți și retail) constituie obiective de arhitectură supuse calendarelor de lansare, nu fluxuri active de producție.',
          'Integritatea arhitecturală este garantată: granițele la nivel de workspace sunt proiectate să prevină expunerea între contexte, iar arhitectura impune respingerea mutațiilor când autoritatea nu poate fi stabilită.',
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
        badge: 'COMMUNITY & EXPERIENCE (CE) PEER DOMAIN',
        title: 'Experience Connected to the Property Context',
        subtitle:
          'CLADORA Community & Experience is designed to compose community, guides, events, and contextual journeys around the same property identity, workspace boundaries, and contextual authority used across the entire platform.',
        ctaPrimary: 'Explore Experience Architecture',
        ctaSecondary: 'Platform Architecture',
      },
      peerDomain: {
        badge: 'ARCHITECTURAL PEER STATUS',
        title: 'CE as a Peer Domain Alongside AIRPROP, SERVICE & OPERATIONS',
        desc: 'In CLADORA’s platform design, occupant experience is neither a cosmetic add-on nor a subsidiary maintenance ticketing queue. CE is architected as a first-class peer domain alongside commercial lifecycle (AIRPROP), procurement coordination (SERVICE), and technical maintenance (OPERATIONS).',
        points: [
          {
            title: 'Not a Maintenance Sub-Feature',
            desc: 'CE is not a sub-branch of work-order dispatch. It governs how people understand, orient within, and interact with the physical built environment.',
          },
          {
            title: 'No Parallel Database Silos',
            desc: 'CE rejects shadow ledgers, isolated booking silos, or disconnected resident profile databases.',
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
            name: 'Experience Composition (CE)',
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
        principle:
          'Architectural Principle: CE consumes verified relationships and property boundaries from CORE (where architecture requires mutation denial when authority cannot be established), capacity truth from BK01, canonical document context from DOCUMENTS, and financial truth from FIN01. It never acts as a shadow database.',
      },
      communityLayer: {
        badge: 'COMMUNITY ARCHITECTURE',
        title: 'Bounded Community Spaces & Authorized Participation',
        desc: 'Occupant community interaction is architecturally anchored in verified physical and administrative boundaries:',
        items: [
          {
            title: 'Member & Community Context',
            desc: 'Participation framing within building spaces is architecturally bounded by workspace membership and contextual roles.',
          },
          {
            title: 'Community Information & Participation Context',
            desc: 'Architectural model for publishing administrative announcements, building notices, and structured community consultations.',
          },
          {
            title: 'Privacy-Bounded Isolation',
            desc: 'Interactions in designated shared spaces are designed to protect private unit boundaries and financial records.',
          },
          {
            title: 'Shared-Place Rules & Amenity Discovery',
            desc: 'Contextual presentation of shared-place rules, hours, and operational guidance for communal facilities.',
          },
        ],
      },
      guidesSection: {
        badge: 'SPATIAL & OPERATIONAL GUIDANCE',
        title: 'Property Guides, Arrival Information & Place Context',
        desc: 'CE structures operational guidance for contextual presentation (illustrative guidance categories, not an implied universal live library):',
        items: [
          {
            title: 'Space & Equipment Guides',
            desc: 'Illustrative examples: contextual operating guidance for heating thermostats, circuit panels, video intercoms, and submeters.',
          },
          {
            title: 'Arrival & Access Instructions',
            desc: 'Illustrative examples: clear orientation protocols for guests, delivery partners, and moving crews (freight elevators, parking rules).',
          },
          {
            title: 'House Rules & Community Policies',
            desc: 'Illustrative examples: digital publication of community-approved quiet hours, pet policies, and shared terrace rules.',
          },
          {
            title: 'Localized Neighborhood Context',
            desc: 'Illustrative examples: building-specific notes on municipal recycling schedules, local transit points, and utility contacts.',
          },
        ],
      },
      eventsSection: {
        badge: 'EVENT COORDINATION CONTEXT',
        title: 'Event Discovery, Community Context & Participation Intent',
        desc: 'The architectural model for collective gatherings and assemblies (conceptual composition model, without implying certified statutory voting or commercial ticketing):',
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
            desc: 'Events occupying physical amenities verify capacity boundaries directly against designated provider BK01.',
          },
        ],
      },
      journeysSection: {
        badge: 'JOURNEY COMPOSITION LAYER',
        title: 'Contextual Experience Archetypes Across the Built Environment',
        desc: 'CE models interaction through 6 canonical experience archetypes across property typologies:',
        qualification:
          'Architectural Qualification Notice: The touchpoints below represent conceptual journey archetypes and architectural composition examples, not universally released production workflows.',
        journeys: [
          {
            role: 'Resident Journey',
            desc: 'Illustrative composition touchpoints: move-in onboarding, utility meter baseline, FIN01 quota reference, repair requests, and association consultation touchpoints where activated.',
            badge: 'Residential',
          },
          {
            role: 'Workplace Tenant Journey',
            desc: 'Illustrative composition touchpoints: employee orientation, room availability checks via BK01, visitor pass touchpoints, and facility support requests.',
            badge: 'Workplace',
          },
          {
            role: 'Visitor Journey',
            desc: 'Illustrative composition touchpoints: pre-registered pass context, parking gate guidance, turnstile access directions, and time-bounded indoor orientation.',
            badge: 'Temporary Access',
          },
          {
            role: 'Guest Journey',
            desc: 'Illustrative composition touchpoints: arrival guidance, digital room handbook, leisure amenity requests routed to BK01, and departure orientation.',
            badge: 'Hospitality',
          },
          {
            role: 'Retail Customer Journey',
            desc: 'Illustrative composition touchpoints: shopping center directory orientation, customer amenity guidance, merchant hours, and parking validation touchpoints.',
            badge: 'Retail',
          },
          {
            role: 'Contractor Journey',
            desc: 'Illustrative composition touchpoints: on-site safety briefing, operational permit verification context, and work-order completion sign-off routing.',
            badge: 'Operational',
          },
        ],
      },
      boundariesSection: {
        badge: 'CANONICAL BOUNDARY DISCIPLINE',
        title: 'Clear Ownership Separation: CE vs. Canonical Providers of Truth',
        desc: 'To maintain enterprise transactional integrity, CE’s boundary is strictly separated from canonical providers:',
        boundaries: [
          {
            domain: 'CE vs. SERVICE',
            role: 'Experience Composition vs. Procurement Intent',
            rule: 'CE surfaces service discovery; SERVICE is designated to own service request and order semantics, including relevant quote, order, and acceptance stages where released.',
            icon: Wrench,
          },
          {
            domain: 'CE vs. BK01',
            role: 'Presentation vs. Capacity Truth',
            rule: 'CE presents amenity schedules; BK01 is designated as the canonical authority responsible for availability models, capacity thresholds, and reservation conflict detection. CE owns zero booking truth.',
            icon: Calendar,
          },
          {
            domain: 'CE vs. FIN01',
            role: 'Interaction vs. Financial Truth',
            rule: 'CE maintains no shadow wallets or point ledgers. FIN01 is designated to own financial truth, transactions, and applicable accounting records.',
            icon: DollarSign,
          },
          {
            domain: 'CE vs. COMMUNICATIONS',
            role: 'Context vs. Delivery Dispatch',
            rule: 'CE identifies contextual touchpoints; COMMUNICATIONS is designated to govern message dispatch and delivery logging, subject to active channel release capabilities.',
            icon: MessageSquare,
          },
          {
            domain: 'CE vs. DOCUMENTS (VAULT)',
            role: 'Guide Presentation vs. Document Provenance',
            rule: 'CE surfaces operational guides and policies; DOCUMENTS (VAULT) owns canonical document versions, safe labels, provenance, and auditable document context, without unverified cryptographic claims.',
            icon: FileText,
          },
          {
            domain: 'CE vs. OPERATIONS',
            role: 'Occupant Interaction vs. Work-Order Execution',
            rule: 'CE captures assistance requests; OPERATIONS is the canonical owner of work-order execution, technician dispatch, and maintenance checklists subject to release maturity.',
            icon: Briefcase,
          },
          {
            domain: 'CE vs. CORE',
            role: 'Local Experience vs. Authority & Identity',
            rule: 'CE composes experience within role limits; CORE governs identity, workspace membership, and authority, where architecture requires mutation denial when authority cannot be established.',
            icon: ShieldCheck,
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
            desc: 'Condominium handbook, community notice context, FIN01 dues reference, maintenance proposals, and association consultation touchpoints where activated.',
            icon: Building2,
          },
          {
            name: 'Workplace & Commercial Office',
            desc: 'Employee onboarding, desk and conference room reservation via BK01, guest pass dispatch, and facility work orders.',
            icon: Briefcase,
          },
          {
            name: 'Retail & Shopping Center Podiums',
            desc: 'Commercial mall orientation, customer amenity guidance, operating schedules, and merchant operational communication context.',
            icon: Store,
          },
          {
            name: 'Hospitality & Serviced Living',
            desc: 'Digital lodging handbook, arrival orientation, and shared amenity reservation requests architecturally routed to BK01.',
            icon: Hotel,
          },
          {
            name: 'Industrial Workforce Orientation',
            desc: 'Safety orientation context, regulated zone access guidelines, perimeter rules, and technical emergency protocols.',
            icon: Factory,
          },
          {
            name: 'Logistics Facility Orientation',
            desc: 'Yard circulation guidelines, loading dock arrival instructions, driver amenities, and facility safety protocols.',
            icon: Warehouse,
          },
          {
            name: 'Automotive Customer Journey',
            desc: 'Service reception orientation, customer lounge guidance, and vehicle service status notification touchpoints.',
            icon: Car,
          },
          {
            name: 'Mixed-Use Integrated Experience',
            desc: 'Architectural composition model: seamless contextual transitions across residential, office, and retail tiers under a shared canonical property/resource identity model and CORE authority.',
            icon: Layers,
          },
        ],
      },
      intelligencePreview: {
        badge: 'ASSISTIVE INTELLIGENCE PREVIEW',
        title: 'Governed AI Orchestration Within Experience Journeys',
        desc: 'Assistive intelligence inside CE operates strictly as an orchestrator subordinate to verified human authority, following a 6-step flow:',
        steps: [
          { title: '1. Context', desc: 'Identifies the physical space, property asset, and verified identity.' },
          { title: '2. Intent', desc: 'Clarifies what the occupant seeks to accomplish in context.' },
          { title: '3. Authority', desc: 'Confirms required mandates and workspace rights in CORE.' },
          { title: '4. Planning', desc: 'Constructs an operational proposal for the appropriate provider.' },
          { title: '5. Policy & Human Review', desc: 'Consequential actions remain subject to applicable policy controls and appropriate human approval.' },
          { title: '6. Audit Record', desc: 'Contextual event logging across platform audit trails.' },
        ],
        note: 'AI operates within verified authority boundaries. Consequential actions remain subject to applicable policy controls and appropriate human approval.',
      },
      availability: {
        badge: 'TRANSPARENCY & DEPLOYMENT GOVERNANCE',
        title: 'Experience Architecture Maturity & Release Governance',
        desc: 'Our public presentation outlines the holistic architectural model of Community & Experience. In real-world enterprise deployments, capability availability is governed individually by product release status and customer implementation agreements.',
        points: [
          'CE capabilities are modularly assembled based on active workspace subscription tiers and property DNA requirements.',
          'Target-heavy capabilities (such as member directories, social feeds, direct messaging, marketplace, loyalty programs, AI concierge, or advanced guest/retail experience automation) represent architectural design targets subject to release roadmaps, not live production workflows.',
          'Architectural integrity is maintained: workspace-scoped boundaries are designed to prevent cross-context exposure, and architecture requires mutation denial when authority cannot be established.',
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
      breadcrumb: { home: 'خانه', current: 'جامعه و تجربه کاربری (CE)' },
      hero: {
        badge: 'دامنهٔ هم‌ردهٔ جامعه و تجربه کاربری (CE)',
        title: 'تجربهٔ کاربری متصل به بستر و بافت ملک',
        subtitle:
          'دامنهٔ جامعه و تجربه کاربری (CE) در کلادورا طوری طراحی شده است که تعاملات جمعی، راهنمای اماکن، رویدادها و مسیرهای کاربری را بر پایه همان هویت پایدار ملک، تفکیک فضاهای کاری و حدود اختیارات سراسری پلتفرم ترکیب نماید.',
        ctaPrimary: 'بررسی معماری لایه تجربه کاربری',
        ctaSecondary: 'مشاهده معماری جامع پلتفرم',
      },
      peerDomain: {
        badge: 'جایگاه هم‌رده و مستقل در معماری',
        title: 'CE به عنوان دامنهٔ هم‌رده در کنار AIRPROP، SERVICE و OPERATIONS',
        desc: 'در ساختار مهندسی کلادورا، تجربه کاربری یک افزونهٔ تزئینی یا صرفاً صف تیکت‌های نگهداری نیست. CE به عنوان یک دامنهٔ هم‌رده و مستقل (Peer Domain) در کنار چرخه تجاری (AIRPROP)، هماهنگی خدمات (SERVICE) و عملیات فنی نگهداری (OPERATIONS) قرار دارد.',
        points: [
          {
            title: 'یک ماژول فرعی تعمیراتی نیست',
            desc: 'CE شاخه‌ای از صدور دستورکار نیست، بلکه شیوه درک، جهت‌یابی و تعامل افراد با دارایی فیزیکی را سازمان‌دهی می‌کند.',
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
            name: 'ترکیب تجربه کاربری (CE)',
            desc: 'چینش هوشمند راهنماها، تابلوی اعلانات، رویدادها و خدمات.',
            icon: Compass,
          },
          {
            num: '۰۶',
            name: 'ارجاع به متولیان مرجع',
            desc: 'درخواست‌ها به SERVICE/OPS، رزرواسیون به BK01، تراکنش‌ها به FIN01.',
            icon: CheckCircle2,
          },
        ],
        principle:
          'اصل بنیادین معماری: CE روابط تأییدشده و مرزهای دارایی را از CORE (که در آن معماری مستلزم رد هرگونه تغییر در صورت عدم احراز صلاحیت است)، حقیقت ظرفیت را از BK01، زمینه اسناد مرجع را از DOCUMENTS و حقیقت مالی را از FIN01 دریافت می‌نماید. CE هرگز به عنوان یک پایگاه داده موازی عمل نمی‌کند.',
      },
      communityLayer: {
        badge: 'لایه تعاملات جمعی',
        title: 'فضاهای اجتماعی مرزبندی‌شده و مشارکت مبتنی بر مجوز',
        desc: 'تعاملات اجتماعی و سازمانی بر بستر ساختار فیزیکی و اداری ساختمان هدایت می‌شوند:',
        items: [
          {
            title: 'بافت عضویت و تعاملات جمعی',
            desc: 'چارچوب معماری حضور در فضاهای هر ملک بر اساس عضویت در ورک‌اسپیس و نقش‌های مرتبط تعریف می‌شود.',
          },
          {
            title: 'اطلاعات جمعی و زمینهٔ مشارکت',
            desc: 'الگوی ساختاری انتشار اعلانات اداری، اطلاعیه‌های ساختمان و زمینه‌های مشورتی ساختاریافتهٔ جمعی.',
          },
          {
            title: 'تفکیک مرزها و حفظ حریم خصوصی',
            desc: 'معماری تعاملات در فضاهای مشترک به گونه‌ای است که سوابق محرمانه واحدها و داده‌های مالی محافظت شوند.',
          },
          {
            title: 'ضوابط فضاهای مشترک و شناخت امکانات',
            desc: 'ارائه ضوابط بهره‌برداری از فضاهای مشترک، ساعات آرامش و راهنمایی‌های عملیاتی استفاده از مشاعات.',
          },
        ],
      },
      guidesSection: {
        badge: 'راهنماها و بستر مکانی',
        title: 'راهنمای دارایی، پروتکل‌های ورود و راهنمایی محیطی',
        desc: 'دامنه CE ساختار راهنماهای بهره‌برداری را بر بستر مکانی تعریف می‌کند (نمونه‌های تصویری از دسته‌بندی راهنماها، بدون ادعای کتابخانهٔ فراگیر فعال):',
        items: [
          {
            title: 'راهنمای فنی تجهیزات و واحد',
            desc: 'نمونه‌های تصویری: آموزش‌های کاربردی برای تنظیم ترموستات‌ها، جعبه فیوز، آیفون تصویری و کنتورهای تفکیکی.',
          },
          {
            title: 'پروتکل‌های ورود و دسترسی',
            desc: 'نمونه‌های تصویری: پروتکل‌های شفاف برای مراجعان، اسباب‌کشی، بسته‌های پستی و پارکینگ‌های مهمان.',
          },
          {
            title: 'قوانین و استانداردهای مجتمع',
            desc: 'نمونه‌های تصویری: دسترسی به ضوابط مصوب جامعه، ساعات آرامش و استفاده از بام و حیاط مشترک.',
          },
          {
            title: 'اطلاعات محله و خدمات پیرامونی',
            desc: 'نمونه‌های تصویری: اطلاعات مدیریت پسماند تفکیکی، ایستگاه‌های حمل‌ونقل و شماره‌های اضطراری محلی.',
          },
        ],
      },
      eventsSection: {
        badge: 'هماهنگی رویدادها و جلسات',
        title: 'اطلاع‌رسانی گردهمایی‌ها، مجامع عمومی و ثبت تمایل به حضور',
        desc: 'الگوی ساختاری برای گردهمایی‌های جمعی و مجامع (الگوی مفهومی ترکیب معماری، بدون ادعای رأی‌گیری رسمی حقوقی یا بلیت‌فروشی تجاری):',
        items: [
          {
            title: 'مجامع عمومی و جلسات رسمی',
            desc: 'تقویم پیشنهادی جلسات، دستور کار مصوب و امکان مطالعه اسناد پیش از برگزاری مجمع.',
          },
          {
            title: 'پویش‌ها و گردهمایی‌های داخلی',
            desc: 'برنامه‌های درختکاری، بهسازی مشاعات و جشن‌های فصلی که توسط ساکنان هماهنگ می‌شوند.',
          },
          {
            title: 'اعلام تمایل به حضور (RSVP)',
            desc: 'ثبت تمایل به حضور جهت تنظیم امکانات سالن و تخمین حدنصاب پیش از برگزاری.',
          },
          {
            title: 'کنترل ظرفیت فضا از طریق BK01',
            desc: 'رویدادهایی که فضاهای فیزیکی را در بر می‌گیرند، الگوی ظرفیت را از طریق ارائه‌دهندهٔ تعیین‌شده BK01 ارزیابی می‌کنند.',
          },
        ],
      },
      journeysSection: {
        badge: 'لایه ترکیب مسیرهای کاربری',
        title: 'الگوهای شش‌گانه مسیرهای تعاملی در دنیای املاک',
        desc: 'دامنه CE تجربه کاربری را از طریق ۶ الگوی مرجع در کاربری‌های گوناگون طراحی می‌نماید:',
        qualification:
          'یادداشت انطباق معماری: نقاط تعاملی زیر الگوهای مفهومی مسیر کاربری و نمونه‌های ترکیب معماری هستند، نه جریان‌های کاری عرضه‌شدهٔ سراسری در محیط عملیاتی.',
        journeys: [
          {
            role: 'مسیر سکونت ساکن (Resident Journey)',
            desc: 'نمونه‌های تصویری ترکیب: پذیرش در ساختمان، ثبت کنتور مبنا، ارجاع سهم شارژ به FIN01، ثبت درخواست خرابی و زمینه‌های مشورتی در صورت فعال‌سازی.',
            badge: 'مسکونی',
          },
          {
            role: 'مسیر پرسنل اداری (Workplace Tenant)',
            desc: 'نمونه‌های تصویری ترکیب: ورود کارمند، بررسی ظرفیت اتاق جلسات از طریق BK01، مدیریت مراجعان و درخواست‌های پشتیبانی اداری.',
            badge: 'فضاهای کار',
          },
          {
            role: 'مسیر مراجع و مهمان (Visitor Journey)',
            desc: 'نمونه‌های تصویری ترکیب: بستر مجوز ثبت‌شده، راهنمای ورودی پارکینگ، هدایت گیت و جهت‌یابی طبقاتی در بازه زمانی معین.',
            badge: 'تردد موقت',
          },
          {
            role: 'مسیر مسافر هتل (Guest Journey)',
            desc: 'نمونه‌های تصویری ترکیب: راهنمای پذیرش، کتابچه دیجیتال اتاق، ثبت تقاضای امکانات رفاهی متصل به BK01 و پروتکل خروج.',
            badge: 'اقامتی',
          },
          {
            role: 'مسیر مشتری تجاری (Retail Customer)',
            desc: 'نمونه‌های تصویری ترکیب: جهت‌یابی نقشه تجاری، راهنمای امکانات مراجعان، ساعات فعالیت اصناف و اعتبارسنجی پارکینگ.',
            badge: 'تجاری',
          },
          {
            role: 'مسیر تکنسین پیمانکار (Contractor)',
            desc: 'نمونه‌های تصویری ترکیب: نکات ایمنی سایت، بستر بررسی مجوز کار فنی و هدایت تأییدیه پایان کار به سامانه عملیات.',
            badge: 'عملیاتی',
          },
        ],
      },
      boundariesSection: {
        badge: 'انضباط مرزهای متولیان داده',
        title: 'تفکیک دقیق وظایف: CE در برابر ارائه‌دهندگان مرجع حقیقت',
        desc: 'برای حفظ یکپارچگی سیستمی و جلوگیری از تداخل داده‌ها، اختیارات CE کاملاً از متولیان مرجع تفکیک شده است:',
        boundaries: [
          {
            domain: 'CE در برابر SERVICE',
            role: 'ترکیب تجربه در برابر قصد خرید خدمت',
            rule: 'دامنه CE بستر کشف خدمات را ارائه می‌دهد؛ SERVICE به عنوان متولی ساختاری مدیریت درخواست‌ها و سفارش‌های خدماتی تعیین شده و مراحل استعلام، سفارش و پذیرش را در صورت انتشار دربرمی‌گیرد.',
            icon: Wrench,
          },
          {
            domain: 'CE در برابر BK01',
            role: 'نمایش تقویم در برابر حقیقت ظرفیت',
            rule: 'دامنه CE تقویم و امکانات را نمایش می‌دهد؛ BK01 مرجع ساختاری تعیین‌شده برای الگوهای دسترسی، سقف ظرفیت‌ها و تشخیص تداخلات رزرواسیون است. CE هیچ حقیقتی از رزرواسیون در اختیار ندارد.',
            icon: Calendar,
          },
          {
            domain: 'CE در برابر FIN01',
            role: 'تعامل در برابر حقیقت مالی',
            rule: 'دامنه CE هیچ کیف پول، امتیاز یا دفاتر موازی نگهداری نمی‌کند. FIN01 به عنوان متولی مرجع حقیقت مالی، تراکنش‌ها و اسناد حسابداری مرتبط تعیین شده است.',
            icon: DollarSign,
          },
          {
            domain: 'CE در برابر COMMUNICATIONS',
            role: 'موقعیت تعاملی در برابر ارسال پیام',
            rule: 'دامنه CE نقطه تعاملی اعلان را مشخص می‌سازد؛ COMMUNICATIONS به عنوان متولی ارسال پیام‌ها و ثبت گزارش‌های تحویل متناسب با کانال‌های فعال تعیین شده است.',
            icon: MessageSquare,
          },
          {
            domain: 'CE در برابر DOCUMENTS (VAULT)',
            role: 'نمایش راهنماها در برابر اصالت اسناد',
            rule: 'دامنه CE راهنماها و ضوابط را نمایش می‌دهد؛ DOCUMENTS (VAULT) متولی نگهداری نسخه‌های مرجع، برچسب‌های امن، منشأ سند و بستر ممیزی اسناد بدون ادعاهای رمزنگاری‌نشده است.',
            icon: FileText,
          },
          {
            domain: 'CE در برابر OPERATIONS',
            role: 'تعامل بهره‌بردار در برابر اجرای عملیات نگهداری',
            rule: 'دامنه CE درخواست نیاز را دریافت می‌کند؛ OPERATIONS متولی اصلی صدور و اجرای دستورکارها، اعزام تکنسین و چک‌لیست‌های فنی متناسب با فاز انتشار است.',
            icon: Briefcase,
          },
          {
            domain: 'CE در برابر CORE',
            role: 'تجربه موضعی در برابر هویت و حدود اختیارات',
            rule: 'دامنه CE تجربه کاربری را در چارچوب نقش شکل می‌دهد؛ CORE حاکم بر هویت، عضویت ورک‌اسپیس و اختیارات است، جایی که معماری در صورت عدم احراز صلاحیت، هرگونه تغییر را رد می‌کند.',
            icon: ShieldCheck,
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
            desc: 'کتابچه مجتمع، بستر اعلانات جمعی، ارجاع ارقام شارژ به FIN01، ثبت درخواست خرابی و زمینه‌های مشورتی در صورت فعال‌سازی.',
            icon: Building2,
          },
          {
            name: 'تجربه اداری و فضاهای کار',
            desc: 'پذیرش کارکنان، رزرو اتاق کنفرانس از طریق BK01، صدور مجوز مراجعان و دستورکارهای پشتیبانی.',
            icon: Briefcase,
          },
          {
            name: 'تجربه مراکز تجاری و خرید',
            desc: 'جهت‌یابی فضاهای تجاری، راهنمای امکانات مراجعان، ساعات فعالیت و بستر ارتباطات عملیاتی با اصناف.',
            icon: Store,
          },
          {
            name: 'تجربه اقامتی و هتلداری',
            desc: 'کتابچه دیجیتال اقامتی، راهنمای پذیرش و هدایت درخواست رزرو امکانات مشترک به متولی BK01.',
            icon: Hotel,
          },
          {
            name: 'بستر نیروی کار صنعتی',
            desc: 'دستورالعمل‌های ایمنی کارگاه، راهنمای دسترسی به مناطق ویژه، قوانین پیرامونی و پروتکل‌های اضطراری تأسیساتی.',
            icon: Factory,
          },
          {
            name: 'بستر اپراتورهای لجستیک',
            desc: 'قوانین تردد در محوطه، راهنمای استقرار در بارانداز، امکانات رانندگان و ضوابط ایمنی سوله.',
            icon: Warehouse,
          },
          {
            name: 'مسیر مشتریان مجتمع‌های خودرویی',
            desc: 'پروتکل‌های پذیرش خودرو، امکانات سالن انتظار مشتریان و نقاط اطلاع‌رسانی وضعیت سرویس خودرو.',
            icon: Car,
          },
          {
            name: 'تجربه پروژه‌های چندمنظوره (Mixed-Use)',
            desc: 'الگوی ترکیب معماری: جابجایی پیوسته میان بخش‌های مسکونی، اداری و تجاری بر پایه مدل مشترک هویت دارایی و منابع تحت مرزهای اختیارات در CORE.',
            icon: Layers,
          },
        ],
      },
      intelligencePreview: {
        badge: 'پیش‌نمایش هوش عملیاتی',
        title: 'ارکستراسیون تحت نظارت انسان در مسیرهای تعاملی',
        desc: 'هوش مصنوعی در دامنه CE صرفاً به عنوان دستیار کمکی و تحت فرمان مأموریت‌های انسانی در یک فرآیند ۶ مرحله‌ای عمل می‌کند:',
        steps: [
          { title: '۱. بافت ملک (Context)', desc: 'شناسایی فضا، دارایی فیزیکی و هویت احراز‌شده.' },
          { title: '۲. مقصود (Intent)', desc: 'شفاف‌سازی خواسته و هدف کاربر در بافت مکانی.' },
          { title: '۳. بررسی مأموریت (Authority)', desc: 'تأیید حدود اختیارات و حقوق ورک‌اسپیس در CORE.' },
          { title: '۴. برنامه‌ریزی (Plan)', desc: 'تدوین بسته پیشنهادی برای متولی اصلی داده‌ها.' },
          { title: '۵. انطباق با خط‌مشی و نظارت انسانی', desc: 'اقدامات دارای پیامد، مشمول سازوکارهای کنترلی و تأیید انسانی متناسب باقی می‌مانند.' },
          { title: '۶. ثبت سوابق ممیزی', desc: 'ثبت سیستمی رویدادها در مسیرهای ممیزی پلتفرم.' },
        ],
        note: 'هوش مصنوعی در چارچوب مرزهای احراز‌شدهٔ اختیارات عمل می‌کند. اقدامات دارای پیامدهای حقوقی یا مالی، مشمول سازوکارهای کنترلی و تأیید انسانی متناسب باقی می‌مانند.',
      },
      availability: {
        badge: 'شفافیت حاکمیت و سطح بلوغ سامانه',
        title: 'بلوغ معماری دامنه تجربه و حاکمیت استقرار',
        desc: 'بخش حاضر معماری کلان دامنه جامعه و تجربه کاربری را ترسیم می‌نماید. در استقرارهای واقعی در سطح سازمان‌ها، میزان فعال‌سازی هر قابلیت به فاز انتشار محصول و قرارداد اجرایی هر پروژه وابسته است.',
        points: [
          'قابلیت‌های CE بر اساس سطح اشتراک فعال ورک‌اسپیس و ویژگی‌های ساختاری دارایی فعال‌سازی می‌شوند.',
          'قابلیت‌های هدف‌محور (نظیر دایرکتوری اعضا، فید اجتماعی، پیام‌رسانی مستقیم، بازارگاه، برنامه‌های وفاداری، کنسیرژ هوش مصنوعی یا اتوماسیون پیشرفته مهمان و تجاری) اهداف معماری در نقشه راه هستند و جریان‌های فعال در محیط عملیاتی تلقی نمی‌شوند.',
          'یکپارچگی معماری تضمین شده است: مرزهای تفکیک‌شدهٔ ورک‌اسپیس برای جلوگیری از افشای داده‌ها میان بسترها طراحی شده‌اند و معماری در صورت عدم احراز صلاحیت، هرگونه تغییر را رد می‌کند.',
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
    flowSection: { badge: '', title: '', desc: '', steps: [], principle: '' },
    communityLayer: { badge: '', title: '', desc: '', items: [] },
    guidesSection: { badge: '', title: '', desc: '', items: [] },
    eventsSection: { badge: '', title: '', desc: '', items: [] },
    journeysSection: { badge: '', title: '', desc: '', qualification: '', journeys: [] },
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
            {content.flowSection.principle}
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

          {/* Prominent Visible Qualification Before Journeys */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{content.journeysSection.qualification}</span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
