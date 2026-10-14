import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Language } from '@/types';
import { getRouteMetadata } from '@/config/routes-metadata';
import {
  Bot,
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
  Sparkles,
  Lock,
  AlertTriangle,
  HelpCircle,
  Eye,
  Sliders,
  Scale,
  Cpu,
  FileCheck,
  Users,
  ChevronRight,
  ShieldAlert
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
  return getRouteMetadata('/ai', params.lang);
}

export default async function AIPage(props: { params: Promise<{ lang: Language }> }) {
  const params = await props.params;
  const { lang } = params;

  const content = {
    ro: {
      breadcrumb: { home: 'Acasă', current: 'CLADORA Intelligence' },
      hero: {
        badge: 'ARHITECTURA CLADORA INTELLIGENCE',
        title: 'Inteligență Care Înțelege Contextul Înainte de Orice Acțiune',
        subtitle:
          'CLADORA Intelligence este proiectată să clarifice contextul de proprietate, workspace, relație locativă și autoritate înainte de a propune sau coordona acțiuni prin furnizorii canonici ai platformei.',
        ctaPrimary: 'Explorează Arhitectura de Inteligență',
        ctaSecondary: 'Arhitectura Platformei',
      },
      positioning: {
        badge: 'POZIȚIONARE ARHITECTURALĂ',
        title: 'Un Strat Subordonat de Orchestrare, Nu un Furnizor Canonic de Adevăr',
        desc: 'În arhitectura CLADORA, inteligența artificială nu este un chatbot izolat și nici un agent autonom care ia decizii de capul său. Ea reprezintă un strat de asistență guvernată, strict subordonat nucleului de autoritate și deciziei umane.',
        pillars: [
          {
            title: 'Nu Deține Adevăr Canonic',
            desc: 'AI nu deține identitatea persoanelor, activele, registrele contabile, rezervările, contractele sau documentele legale. Toate acestea aparțin exclusiv furnizorilor canonici specializați.',
            icon: Lock,
          },
          {
            title: 'Fără Scrieri Directe în Baze de Date',
            desc: 'Sistemul de inteligență nu poate modifica în mod direct starea registrelor. Orice acțiune propusă este canalizată prin contracte stricte de API către furnizorii responsabili.',
            icon: ShieldCheck,
          },
          {
            title: 'Subordonare Față de Autoritate',
            desc: 'AI operează exclusiv în limitele mandatului stabilit în CORE. Când autoritatea nu poate fi dovedită cu certitudine, arhitectura impune respingerea oricărei mutații de date.',
            icon: Scale,
          },
        ],
      },
      flowSection: {
        badge: 'FLUXUL CANONIC DE ACȚIUNE',
        title: 'De la Contextul Spațial la Înregistrarea de Audit',
        desc: 'Fiecare interacțiune asistată de inteligență parcurge un lanț arhitectural determinist, conceput pentru a elimina erorile, acțiunile neautorizate și halucinațiile:',
        steps: [
          {
            num: '01',
            name: 'Context Resolver',
            desc: 'Identifică persoana, proprietatea fizică, nivelul de workspace, relația locativă și mandatul activ.',
            icon: MapPin,
          },
          {
            num: '02',
            name: 'Intent Router',
            desc: 'Analizează solicitarea operațională fără a acorda permisiuni implicite (Intenția nu înseamnă Autoritate).',
            icon: Compass,
          },
          {
            num: '03',
            name: 'Authority Gate',
            desc: 'Validează dreptul legal în CORE. Dacă autoritatea lipsește, se aplică principiul Zero-Write Denial.',
            icon: ShieldCheck,
          },
          {
            num: '04',
            name: 'Planner',
            desc: 'Construiește un plan operațional structurat, explicabil și verificabil pas cu pas.',
            icon: Sliders,
          },
          {
            num: '05',
            name: 'Policy & Human Review',
            desc: 'Acțiunile cu impact consecvent rămân supuse politicilor aplicabile de control și aprobării umane adecvate.',
            icon: UserCheck,
          },
          {
            num: '06',
            name: 'Canonical Provider',
            desc: 'Transmite acțiunea aprobată către contractul furnizorului specializat (FIN01, BK01, OPS, etc.).',
            icon: CheckCircle2,
          },
          {
            num: '07',
            name: 'Audit Receipt',
            desc: 'Consemnează chitanța de acțiune cu contextul deciziei și amprenta cronologică în jurnalul de audit.',
            icon: FileCheck,
          },
        ],
        railTitle: 'Furnizori Canonici Conectați:',
      },
      contextResolver: {
        badge: 'REZOLVAREA CONTEXTULUI',
        title: 'Identitatea Globală Nu Este Suficientă: Puterea Contextului Scopat',
        desc: 'În lumea imobiliară, aceeași persoană fizică poate avea roluri complet diferite: proprietar într-un apartament, chiriaș într-un birou corporativ și simplu vizitator într-un alt imobil. CLADORA Intelligence nu raționează niciodată dintr-o identitate globală abstractă, ci rezolvă cu precizie cele 7 dimensiuni contextuale:',
        dimensions: [
          { name: 'Persoană & Acreditare', desc: 'Identitate verificată în CORE cu sesiune activă.' },
          { name: 'Workspace de Apartenență', desc: 'Granița logică a organizației sau asociației.' },
          { name: 'Activ Fizic & Demarcație', desc: 'Imobilul, corpul de clădire, etajul și spațiul exact.' },
          { name: 'Relație Locativă', desc: 'Proprietar, chiriaș, administrator, tehnician sau oaspete.' },
          { name: 'Mandat Temporal', desc: 'Fereastra temporală și limitele de sumă acordate.' },
          { name: 'Country Pack', desc: 'Reglementările specifice jurisdicției (ex. România).' },
          { name: 'Domeniu de Competență', desc: 'AIRPROP, SERVICE, OPERAȚIUNI, C&E, FINANȚE.' },
        ],
      },
      intentRouter: {
        badge: 'DIRIJAREA INTENȚIEI',
        title: 'Clasificarea Scopului: Intenția Nu Echivalează cu Autoritatea',
        desc: 'Modulul de analiză a intenției interpretează limbajul natural sau semnalele evenimentelor fără a modifica date și fără a presupune că solicitarea este permisă:',
        categories: [
          { title: 'Interogare Informativă', desc: 'Întrebări privind ghidul clădirii, orele de liniște sau contactele de urgență.' },
          { title: 'Căutare de Documente', desc: 'Solicitarea fișelor tehnice, contractelor sau proceselor verbale din VAULT.' },
          { title: 'Cerere de Serviciu', desc: 'Inițierea unei solicitări de reparație, curățenie sau mentenanță către SERVICE.' },
          { title: 'Problemă Tehnică & Incident', desc: 'Semnalarea unei defecțiuni la instalații către domeniul OPERAȚIUNI.' },
          { title: 'Intenție de Rezervare', desc: 'Verificarea disponibilității spațiilor comune și transmiterea către BK01.' },
          { title: 'Clarificare Financiară', desc: 'Explicații privind cotele de întreținere sau facturile emise de FIN01.' },
        ],
        warning: 'Regulă Fundamentală: Intent Router nu acordă drepturi. Oricât de clară este dorința formulată, execuția depinde exclusiv de bariera de autoritate.',
      },
      authorityGate: {
        badge: 'BARIERA DE AUTORITATE & POLITICI',
        title: 'Verificarea Mandatului și Principiul Zero-Write Denial',
        desc: 'Înainte ca orice plan să fie propus sau executat, sistemul interoghează CORE pentru a verifica dacă utilizatorul deține dreptul legal de a efectua acea mutație în contextul spațial respectiv:',
        points: [
          {
            title: 'Principiul Zero-Write Denial',
            desc: 'Dacă autoritatea cerută nu poate fi stabilită cu certitudine matematică în CORE, arhitectura impune respingerea oricărei mutații de stare.',
          },
          {
            title: 'Filtrare pe Bază de Politici',
            desc: 'Dincolo de rolul utilizatorului, acțiunea este confruntată cu plafoanele financiare, regulile asociației și cerințele specifice din Country Pack.',
          },
          {
            title: 'Revizuire Umană Guvernată',
            desc: 'AI operează în cadrul limitelor de autoritate verificate. Acțiunile cu impact consecvent rămân supuse politicilor aplicabile de control și aprobării umane adecvate.',
          },
        ],
      },
      plannerSection: {
        badge: 'PLANIFICATORUL EXPLICABIL',
        title: 'Construcția Pas cu Pas a Planurilor Operaționale',
        desc: 'Planificatorul sintetizează pașii necesari fără a executa modificări premature. Un exemplu de plan structurat pentru o solicitare de încălzire:',
        steps: [
          { step: 'Pasul 1', action: 'Rezolvare Context', detail: 'Identifică apartamentul 4B, bloc A, și confirmă statutul de chiriaș activ.' },
          { step: 'Pasul 2', action: 'Verificare Mandat', detail: 'Confirmă că chiriașul are dreptul de a sesiza avarii la rețeaua termică internă.' },
          { step: 'Pasul 3', action: 'Colectare Date Tehnice', detail: 'Verifică modelul de termostat și istoricul intervențiilor recente din OPERATIONS.' },
          { step: 'Pasul 4', action: 'Structurare Propunere', detail: 'Formulează ordinul de intervenție și propune intervale optime de vizită tehnică.' },
          { step: 'Pasul 5', action: 'Aprobare Responsabil', detail: 'Prezintă planul chiriașului și administratorului de imobil pentru validare formală.' },
          { step: 'Pasul 6', action: 'Trimitere Canonică', detail: 'După semnare, comanda de lucru este înregistrată oficial în modulul OPERATIONS.' },
        ],
      },
      toolRouting: {
        badge: 'CONTRACTELE CU FURNIZORII CANONICI',
        title: 'Rutarea Instrumentelor Către Furnizorii de Adevăr',
        desc: 'Inteligența nu își creează propriile instrumente opace. Ea folosește exclusiv interfețele definite ale furnizorilor de adevăr ai platformei:',
        tools: [
          { provider: 'CORE', role: 'Identitate & Mandate', desc: 'Validarea rolurilor, workspace-urilor, relațiilor și a drepturilor de vot/semnare.' },
          { provider: 'DOCUMENTE (VAULT)', role: 'Gestiune Documentară', desc: 'Interogarea versiunilor canonice, contractelor arhivate și cărților tehnice.' },
          { provider: 'FIN01', role: 'Adevăr Financiar', desc: 'Citirea soldurilor, explicarea cotelor de cheltuieli și stadiului plăților.' },
          { provider: 'BK01', role: 'Capacitate & Rezervări', desc: 'Consultarea orarelor de disponibilitate și aplicarea regulilor de capacitate.' },
          { provider: 'SERVICE', role: 'Cereri & Ofertare', desc: 'Structurarea cererilor de asistență, catalog de servicii și cereri de ofertă.' },
          { provider: 'OPERAȚIUNI', role: 'Execuție Mentenanță', desc: 'Generarea ordinelor de lucru, ghiduri tehnice și atribuiri de echipă.' },
          { provider: 'COMUNICAȚII', role: 'Dispecerizare & Notificări', desc: 'Trimiterea notificărilor de sistem și evidența recepționării acestora.' },
          { provider: 'AIRPROP', role: 'Ciclu Comercial', desc: 'Sinteza oportunităților imobiliare, antecontracte și tranziții locative.' },
          { provider: 'C&E', role: 'Experiență de Comunitate', desc: 'Compoziția ghidurilor de primire, anunțurilor de avizier și evenimentelor.' },
        ],
      },
      recomVsAction: {
        badge: 'DELIMITARE CLARĂ',
        title: 'Recomandare Asistivă vs. Acțiune cu Mutație Canonică',
        desc: 'Pentru a garanta siguranța platformei, sistemul separă cu strictețe generarea de idei de execuția efectivă:',
        table: [
          {
            type: 'Recomandare Asistivă',
            nature: 'Fără Mutație de Date (Read-Only / Draft)',
            examples: 'Explicarea unei diferențe de calcul la întreținere, compararea a trei devize de reparație, propunerea unor intervale de timp libere.',
            approval: 'Nu necesită semnătură juridică; este o expunere pur informativă.',
          },
          {
            type: 'Acțiune Canonică',
            nature: 'Mutație de Stare în Sistem (Write Operation)',
            examples: 'Crearea comenzii de lucru în OPERATIONS, consemnarea plății în FIN01, emiterea rezervării oficiale în BK01.',
            approval: 'Supusă politicilor de control și aprobării umane adecvate a responsabilului desemnat.',
          },
        ],
      },
      dialogueMod: {
        badge: 'MODIFICARE CONVERSAȚIONALĂ',
        title: 'Ajustarea Conversațională a Planului Nu Ocolește Autoritatea',
        desc: 'Un utilizator poate rafina planul propus prin dialog simplu („Schimbă cu al doilea instalator”, „Amână pentru marți”, „Trimite doar administratorului”). La fiecare ajustare, sistemul re-evaluează automat contextul, autoritatea și politicile înainte de a propune noul pas.',
        rule: 'Nicio instrucțiune conversațională nu poate eluda verificarea de securitate din CORE.',
      },
      humanHandoff: {
        badge: 'ESCALADARE & SUPRAVEGHERE',
        title: 'Transferul Către Operatorul Uman în Caz de Incertitudine',
        desc: 'CLADORA Intelligence este proiectată să refuze ghicirea atunci când datele sunt incomplete sau contradictorii. În următoarele situații, sistemul transferă automat cazul către un operator uman:',
        triggers: [
          'Autoritate ambiguă sau suprapunere de mandate divergente în workspace.',
          'Lipsa corelării exacte între unitatea locativă și solicitant în cadastrul intern.',
          'Depășirea plafoanelor valorice stabilite prin politicile financiare ale imobilului.',
          'Solicitări ce ating sisteme critice de securitate a vieții (instalații de gaz, lifturi, incendiu).',
          'Dovezi documentare contradictorii sau lipsa actelor de proprietate doveditoare.',
        ],
      },
      explainability: {
        badge: 'TRANSPARENȚĂ DECIZIONALĂ',
        title: 'Explicabilitate Totală: Fără Decizii de Tip „Cutie Neagră”',
        desc: 'Fiecare propunere formulată de CLADORA Intelligence este capabilă să răspundă la șase întrebări esențiale de transparență:',
        questions: [
          { q: 'Ce a înțeles sistemul?', a: 'Sinteza exactă a solicitării extrase din dialog.' },
          { q: 'Ce proprietate și workspace sunt vizate?', a: 'Demarcația cadastrală și organizațională precisă.' },
          { q: 'Pe baza cărei relații locative?', a: 'Rolul activ (proprietar, chiriaș, etc.) identificat în CORE.' },
          { q: 'Ce acțiune specifică este propusă?', a: 'Comanda exactă ce urmează a fi trimisă furnizorului.' },
          { q: 'Cine deține responsabilitatea finală?', a: 'Numele furnizorului canonic (SERVICE, OPS, FIN01).' },
          { q: 'De ce a fost cerută aprobarea umană?', a: 'Politica sau plafonul specific care a impus validarea.' },
        ],
      },
      receiptSection: {
        badge: 'TRASABILITATE & AUDIT',
        title: 'Chitanțe de Acțiune Auditate și Jurnale Permanențe',
        desc: 'Fiecare acțiune executată prin intermediul asistenței inteligente generează o chitanță de audit consemnată în jurnalul de evenimente al platformei. Înregistrarea include contextul inițial, decizia de autoritate din CORE, aprobarea umană consemnată și răspunsul furnizorului canonic.',
      },
      safetySection: {
        badge: 'SIGURANȚĂ & GUVERNANȚĂ',
        title: 'Bariere Strict Impuse de Securitate și Conformitate',
        desc: 'Pentru a preveni abuzurile și riscurile operaționale, CLADORA aplică 5 reguli absolute de guvernanță:',
        rules: [
          {
            title: 'AI Nu Creează Drepturi Legale',
            desc: 'Inteligența nu poate acorda drept de proprietate, calitatea de membru, mandate de reprezentare sau privilegii de acces.',
            icon: ShieldAlert,
          },
          {
            title: 'AI Nu Ocolește Furnizorii Canonici',
            desc: 'Nu există baze de date paralele gestionate de AI. Toate operațiunile tranzacționează prin contractele canonice ale platformei.',
            icon: Lock,
          },
          {
            title: 'Excluderea Sistemelor Critice de Siguranță',
            desc: 'Platforma nu controlează autonom instalațiile de gaz, ascensoarele, alarmele de incendiu, tablourile de înaltă tensiune sau porțile automate.',
            icon: AlertTriangle,
          },
          {
            title: 'Neutralitate Tehnologică și de Model',
            desc: 'Arhitectura decuplează orchestrarea de un singur furnizor de LLM, permițând adoptarea modelelor optime fără captivitate tehnologică.',
            icon: Cpu,
          },
          {
            title: 'Minimizarea Datelor și Confidențialitate',
            desc: 'Datele sunt procesate strict în perimetrul workspace-ului autorizat, respectând principiile de minimizare a expunerii.',
            icon: Eye,
          },
        ],
      },
      journeys: {
        badge: 'EXEMPLE ILUSTRATIVE DE ARHITECTURĂ',
        title: 'Scenarii Ilustrative de Compoziție a Inteligenței',
        desc: 'Fluxurile de mai jos reprezintă compoziții conceptuale de arhitectură, ilustrând modul în care AI cooperează cu furnizorii canonici (nu sunt garanții de fluxuri universale live):',
        qualification: 'Notă: Aceste exemple reprezintă arhetipuri conceptuale de compoziție arhitecturală, nu fluxuri active universal în producție.',
        items: [
          {
            title: 'Scenariul A: Sesizarea Unei Avarii la Încălzire',
            role: 'Rezidențial / Chiriaș',
            flow: 'Context: Ap. 4B → Intenție: Avarie calorifer → Autoritate: CORE verifică dreptul chiriașului → Plan: Ghid verificare presiune + draft solicitare OPS → Revizuire: Chiriașul confirmă → Furnizor: Trimis la OPERATIONS → Chitanță: Nr. tichet consemnat în jurnal.',
          },
          {
            title: 'Scenariul B: Explicarea Variației Cotelor de Întreținere',
            role: 'Administrație / Manager Imobil',
            flow: 'Context: Asociația Parc Central → Intenție: De ce a crescut factura de apă rece? → Autoritate: CORE confirmă rolul de administrator → Plan: Interogare istoric contoare și tarife din FIN01 → Răspuns: Raport comparativ generat → Fără Mutații: Registrul rămâne neschimbat.',
          },
          {
            title: 'Scenariul C: Rezervarea Terasei Comune pentru Eveniment',
            role: 'Comunitate / Proprietar',
            flow: 'Context: Terasa Bloc B → Intenție: Rezervare sâmbătă seara → Autoritate: CORE confirmă statutul de proprietar fără restanțe → Plan: BK01 verifică orarul și orele de liniște → Revizuire: Proprietarul acceptă regulamentul → Furnizor: Rezervare înregistrată în BK01.',
          },
          {
            title: 'Scenariul D: Clarificarea Clauzei de Subînchiriere',
            role: 'Comercial / Chiriaș Birou',
            flow: 'Context: Clădirea Business Hub, Etaj 3 → Intenție: Poate spațiul fi subînchiriat parțial? → Autoritate: CORE validează mandatul directorului financiar → Plan: Extragere clauză din contractul din VAULT → Rezultat: Rezumat explicativ cu trimitere la textul canonic.',
          },
          {
            title: 'Scenariul E: Confirmarea Lucrărilor de Către Tehnician',
            role: 'Operațional / Contractor',
            flow: 'Context: Sala Tehnică Subsol → Intenție: Încheiere mentenanță pompe → Autoritate: CORE confirmă mandatul tehnicianului → Plan: Verificare checklist obligatoriu → Furnizor: Predare către inginerul șef în OPERATIONS → Chitanță: Înregistrare trasabilă.',
          },
        ],
      },
      domainsSection: {
        badge: 'INTEGRARE PE DOMENII',
        title: 'Cum Asistă Inteligența Fiecare Domeniu Canonic',
        desc: 'Fiecare domeniu al platformei CLADORA beneficiază de asistență contextuală fără a-și ceda autoritatea:',
        domains: [
          { name: 'AIRPROP', desc: 'Sintetizează oportunitățile comerciale, istoricul vizionărilor și pregătește documentația prealabilă de vânzare sau închiriere.' },
          { name: 'SERVICE', desc: 'Structurează cererile de asistență, traduce nevoile în cerințe tehnice clare și asistă la compararea ofertelor concurențiale.' },
          { name: 'OPERAȚIUNI', desc: 'Interpretează semnalările tehnice, corelează istoricul echipamentelor și pregătește instrucțiunile pentru echipele de teren.' },
          { name: 'C&E', desc: 'Structurează ghidurile de orientare, regulamentele de incintă și pregătește anunțurile comunitare pentru avizier.' },
          { name: 'FIN01', desc: 'Oferă asistență explicativă privind cotele de întreținere și reconcilierile de costuri, fără a efectua plăți sau scrieri autonome.' },
          { name: 'BK01', desc: 'Interpretează intenția de ocupare a spațiilor și pregătește solicitarea către motorul canonic de disponibilitate și cote.' },
          { name: 'DOCUMENTE', desc: 'Extrage informații relevante și rezumă clauzele din documentele oficiale din VAULT, fără a substitui actul canonic.' },
        ],
      },
      availability: {
        badge: 'TRANSPARENȚĂ & GUVERNANȚĂ',
        title: 'Maturitatea Arhitecturală a Domeniului de Inteligență',
        desc: 'Prezentarea de față descrie modelul arhitectural complet conceput pentru lumea construită. În implementările reale, activarea capabilităților de inteligență este guvernată individual de nivelul de maturitate al fiecărui modul și de licența fiecărui workspace:',
        points: [
          'Capabilitățile de inteligență sunt activate modular în funcție de pachetul contractat și de configurarea specifică a proprietății.',
          'Fluxurile complexe de asistență (precum automatizări extinse de concierge, predicții avansate sau integrări de marketplace) reprezintă etape țintă de arhitectură supuse calendarelor de lansare.',
          'Garanția de integritate rămâne absolută: nicio funcționalitate asistivă nu poate scrie date nesecurizate sau ocoli verificarea de autoritate din CORE.',
        ],
      },
      cta: {
        title: 'Proiectează Operațiuni Inteligente și Sigure pentru Portofoliul Tău',
        desc: 'Discută cu echipa de arhitectură CLADORA despre modul în care inteligența guvernată poate sprijini echipele operaționale fără a periclita integritatea registrelor.',
        primary: 'Explorează Arhitectura Platformei',
        secondary: 'Contactează Arhitecții',
      },
    },
    en: {
      breadcrumb: { home: 'Home', current: 'CLADORA Intelligence' },
      hero: {
        badge: 'CLADORA INTELLIGENCE ARCHITECTURE',
        title: 'AI That Understands Context Before It Acts',
        subtitle:
          'CLADORA Intelligence is designed to resolve property, workspace, relationship, and authority context before proposing or coordinating actions through the platform’s canonical providers.',
        ctaPrimary: 'Explore Intelligence Architecture',
        ctaSecondary: 'Platform Architecture',
      },
      positioning: {
        badge: 'ARCHITECTURAL POSITIONING',
        title: 'A Subordinate Orchestration Layer, Not a Canonical Truth Provider',
        desc: 'In CLADORA’s platform design, artificial intelligence is neither a generic chatbot nor an unconstrained autonomous agent. It represents a governed assistive layer strictly subordinate to platform authority and human decision-making.',
        pillars: [
          {
            title: 'Not a Truth Provider',
            desc: 'AI does not own people, asset records, general ledgers, room calendars, leases, or legal files. These belong strictly to designated canonical providers.',
            icon: Lock,
          },
          {
            title: 'Zero Direct Database Writes',
            desc: 'The intelligence system never mutates system state directly. Proposed actions are routed exclusively through strict provider API contracts.',
            icon: ShieldCheck,
          },
          {
            title: 'Subordinate to Authority',
            desc: 'AI operates exclusively within verified mandates established in CORE. When authority cannot be proven, the architecture requires mutation denial.',
            icon: Scale,
          },
        ],
      },
      flowSection: {
        badge: 'PRIMARY ARCHITECTURAL FLOW',
        title: 'From Spatial Context to Auditable Action Receipt',
        desc: 'Every assisted interaction follows a deterministic architectural chain designed to eliminate errors, unauthorized mutations, and operational hallucination:',
        steps: [
          {
            num: '01',
            name: 'Context Resolver',
            desc: 'Resolves person identity, physical property demarcation, workspace boundary, role, and active mandate.',
            icon: MapPin,
          },
          {
            num: '02',
            name: 'Intent Router',
            desc: 'Interprets operational purpose and inquiry without conferring permissions (Intent is not Authority).',
            icon: Compass,
          },
          {
            num: '03',
            name: 'Authority Gate',
            desc: 'Verifies rights in CORE. If authority cannot be proven, the architecture requires mutation denial.',
            icon: ShieldCheck,
          },
          {
            num: '04',
            name: 'Planner',
            desc: 'Constructs an explainable, structured action plan verified step by step prior to dispatch.',
            icon: Sliders,
          },
          {
            num: '05',
            name: 'Policy & Human Review',
            desc: 'Consequential actions remain subject to applicable policy controls and appropriate human approval.',
            icon: UserCheck,
          },
          {
            num: '06',
            name: 'Canonical Provider',
            desc: 'Dispatches approved mutation requests directly to the designated canonical provider contract (FIN01, BK01, OPS, etc.).',
            icon: CheckCircle2,
          },
          {
            num: '07',
            name: 'Audit Receipt',
            desc: 'Records auditable action receipts with operational timestamps and decision context in the event journal.',
            icon: FileCheck,
          },
        ],
        railTitle: 'Connected Canonical Providers:',
      },
      contextResolver: {
        badge: 'CONTEXT RESOLUTION',
        title: 'Global Identity Is Insufficient: The Power of Scoped Context',
        desc: 'In the real estate world, the same individual possesses distinct roles: an owner in one residential unit, an employee tenant in a commercial tower, and a temporary visitor in another asset. CLADORA Intelligence never reasons from an unscoped global identity alone; it deterministically resolves 7 contextual dimensions:',
        dimensions: [
          { name: 'Person & Credentials', desc: 'Verified subject identity in CORE with hardened session tokens.' },
          { name: 'Workspace Scope', desc: 'The organizational or community boundary isolating operational data.' },
          { name: 'Physical Asset & Demarcation', desc: 'Exact building body, floor, demarcation, and specific spatial unit.' },
          { name: 'Occupancy Relationship', desc: 'Owner, residential tenant, commercial occupant, technician, or guest.' },
          { name: 'Temporal Mandate', desc: 'Active delegation boundaries, fiscal signing limits, and time windows.' },
          { name: 'Country Pack', desc: 'Jurisdiction-specific legal rules, currencies, and statutory frameworks (e.g. Romania).' },
          { name: 'Domain Context', desc: 'Applicable operational domain: AIRPROP, SERVICE, OPERATIONS, C&E, FINANCES.' },
        ],
      },
      intentRouter: {
        badge: 'INTENT ROUTING',
        title: 'Interpreting Purpose: Intent Does Not Confer Authority',
        desc: 'The intent routing layer analyzes natural language inquiries and event triggers without mutating data and without assuming permission:',
        categories: [
          { title: 'Informational Inquiries', desc: 'Questions regarding property handbooks, quiet hours, or local municipal contacts.' },
          { title: 'Document Retrieval', desc: 'Requests for technical inspection sheets, signed lease contracts, or association bylaws.' },
          { title: 'Service Requests', desc: 'Initiating repair requests, cleaning tickets, or specialized service inquiries.' },
          { title: 'Technical Incidents', desc: 'Reporting equipment malfunctions, leaks, or electrical failures to OPERATIONS.' },
          { title: 'Booking Intent', desc: 'Checking availability for communal amenities and drafting reservations for BK01.' },
          { title: 'Financial Clarification', desc: 'Inquiries regarding monthly maintenance quotas, utility splits, or invoices.' },
        ],
        warning: 'Fundamental Rule: The Intent Router never grants authority. No matter how clearly intent is stated, execution is gated strictly by the Authority Gate.',
      },
      authorityGate: {
        badge: 'AUTHORITY & POLICY GATEWAY',
        title: 'Mandate Verification and the Zero-Write Denial Standard',
        desc: 'Before any plan is proposed or dispatched, the system interrogates CORE to verify whether the requester possesses the legal authority to execute the mutation in that specific property context:',
        points: [
          {
            title: 'Zero-Write Denial Standard',
            desc: 'If required authority cannot be established with certainty in CORE, the architecture requires mutation denial.',
          },
          {
            title: 'Policy-Based Control Filtering',
            desc: 'Beyond base roles, operations are checked against financial spending caps, multi-signature thresholds, and Country Pack rules.',
          },
          {
            title: 'Governed Human Approval',
            desc: 'AI operates within verified authority boundaries. Consequential actions remain subject to applicable policy controls and appropriate human approval.',
          },
        ],
      },
      plannerSection: {
        badge: 'EXPLAINABLE PLANNER',
        title: 'Step-by-Step Construction of Operational Proposals',
        desc: 'The planner constructs explainable execution steps without premature execution. An example of structured plan construction for a heating fault:',
        steps: [
          { step: 'Step 1', action: 'Context Resolution', detail: 'Identifies Unit 4B, Building A, and confirms active residential tenant status.' },
          { step: 'Step 2', action: 'Mandate Check', detail: 'Verifies tenant authority to report internal heating anomalies.' },
          { step: 'Step 3', action: 'Technical Context', detail: 'Inspects thermostat model and recent equipment history from OPERATIONS.' },
          { step: 'Step 4', action: 'Proposal Formulation', detail: 'Drafts technical work order and proposes optimal maintenance time windows.' },
          { step: 'Step 5', action: 'Designated Review', detail: 'Presents structured proposal to tenant and property manager for formal sign-off.' },
          { step: 'Step 6', action: 'Canonical Dispatch', detail: 'Upon authorized signature, dispatches work order to the canonical OPERATIONS provider.' },
        ],
      },
      toolRouting: {
        badge: 'CANONICAL PROVIDER CONTRACTS',
        title: 'Tool Routing Across Canonical Providers of Truth',
        desc: 'CLADORA Intelligence uses no proprietary database backdoors. It routes actions strictly through public provider contracts:',
        tools: [
          { provider: 'CORE', role: 'Identity & Authority', desc: 'Validates roles, workspace hierarchies, memberships, and voting/signing rights.' },
          { provider: 'DOCUMENTS (VAULT)', role: 'Document Truth', desc: 'Retrieves canonical versions, archived contracts, and building technical logbooks.' },
          { provider: 'FIN01', role: 'Financial Truth', desc: 'Queries financial balances, explains expense allocations, and reviews invoices.' },
          { provider: 'BK01', role: 'Capacity & Scheduling', desc: 'Checks schedule availability and applies capacity reservation rules.' },
          { provider: 'SERVICE', role: 'Service Semantics', desc: 'Structures service requests, catalog specifications, and competitive RFQs.' },
          { provider: 'OPERATIONS', role: 'Maintenance Execution', desc: 'Dispatches work orders, equipment instructions, and field technician tasks.' },
          { provider: 'COMMUNICATIONS', role: 'Message Dispatch', desc: 'Emits notifications and logs multi-channel delivery receipts.' },
          { provider: 'AIRPROP', role: 'Commercial Lifecycle', desc: 'Synthesizes sales inquiries, pre-sales contracts, and lease transitions.' },
          { provider: 'C&E', role: 'Experience Composition', desc: 'Assembles spatial handbooks, community notice boards, and arrival guidance.' },
        ],
      },
      recomVsAction: {
        badge: 'CLEAR BOUNDARIES',
        title: 'Assistive Recommendation vs. Canonical State Mutation',
        desc: 'To preserve enterprise safety, the architecture strictly distinguishes between informational output and transactional mutation:',
        table: [
          {
            type: 'Assistive Recommendation',
            nature: 'Zero State Mutation (Read-Only / Draft Proposal)',
            examples: 'Explaining a utility charge variance, comparing three contractor bids, proposing available reservation slots.',
            approval: 'Requires no legal signature; functions as purely advisory informational context.',
          },
          {
            type: 'Canonical Action',
            nature: 'System State Mutation (Write Operation)',
            examples: 'Creating an active work order in OPERATIONS, logging a payment in FIN01, confirming a reservation in BK01.',
            approval: 'Subject to applicable policy controls and appropriate human approval by designated authorizers.',
          },
        ],
      },
      dialogueMod: {
        badge: 'CONVERSATIONAL REFINEMENT',
        title: 'Conversational Plan Modification Respects Authority Boundaries',
        desc: 'A user may refine an operational proposal through conversational instructions (“Use the second provider instead”, “Reschedule for Tuesday”, “Notify only the manager”). With every instruction, the system re-evaluates context, authority, and policies before updating the proposed plan.',
        rule: 'No conversational phrasing can ever bypass security or authority verification in CORE.',
      },
      humanHandoff: {
        badge: 'ESCALATION & OVERSIGHT',
        title: 'Transparent Escalation to Human Operators Under Ambiguity',
        desc: 'CLADORA Intelligence rejects guessing when operational data is incomplete or ambiguous. In the following conditions, the system immediately escalates the case to a designated human operator:',
        triggers: [
          'Ambiguous authority or conflicting multi-role mandates in the active workspace.',
          'Missing cadastral or spatial demarcation linking requester to the physical asset.',
          'Financial transaction values exceeding established policy thresholds.',
          'Requests touching life-safety systems (natural gas, elevators, fire detection, high-voltage electrical).',
          'Conflicting documentary evidence or unverified ownership certificates.',
        ],
      },
      explainability: {
        badge: 'DECISIONAL TRANSPARENCY',
        title: 'Full Explainability: Zero Black-Box Automated Decisions',
        desc: 'Every proposal generated by CLADORA Intelligence answers six essential transparency questions:',
        questions: [
          { q: 'What did the system understand?', a: 'Exact synthesis of the user inquiry extracted from dialogue.' },
          { q: 'Which property and workspace are involved?', a: 'Precise cadastral demarcation and organizational scope.' },
          { q: 'Under what relationship is the action framed?', a: 'Active role (owner, tenant, etc.) verified in CORE.' },
          { q: 'What exact provider action is proposed?', a: 'Specific API payload intended for the canonical provider.' },
          { q: 'Which canonical provider would own it?', a: 'Designated authority (SERVICE, OPERATIONS, FIN01, BK01).' },
          { q: 'Why was human approval required?', a: 'Specific policy ceiling or risk threshold triggering the review.' },
        ],
      },
      receiptSection: {
        badge: 'TRACEABILITY & AUDIT',
        title: 'Auditable Action Receipts and Immutable Event Trails',
        desc: 'Every action coordinated through intelligence assistance generates an auditable action receipt recorded in the platform’s event journal. The receipt documents original context, CORE authority results, recorded human approvals, and provider execution outcomes.',
      },
      safetySection: {
        badge: 'SAFETY & GOVERNANCE',
        title: 'Strictly Enforced Architectural Safety Boundaries',
        desc: 'To prevent operational risk and overclaims, CLADORA enforces 5 non-negotiable governance principles:',
        rules: [
          {
            title: 'AI Does Not Create Rights',
            desc: 'Intelligence cannot create ownership, workspace membership, legal mandates, or financial allocations.',
            icon: ShieldAlert,
          },
          {
            title: 'AI Does Not Bypass Providers',
            desc: 'There are no shadow AI databases. All operations transact strictly through canonical provider contracts.',
            icon: Lock,
          },
          {
            title: 'Exclusion of Safety-Critical Control',
            desc: 'The platform does not autonomously operate natural gas valves, elevators, fire suppression, electrical gear, or hardware locks.',
            icon: AlertTriangle,
          },
          {
            title: 'Model & Vendor Neutrality',
            desc: 'The architecture decouples orchestration from any single LLM vendor, ensuring model agility without vendor lock-in.',
            icon: Cpu,
          },
          {
            title: 'Data Minimization & Privacy',
            desc: 'Information is processed strictly within authorized workspace boundaries adhering to privacy-by-design standards.',
            icon: Eye,
          },
        ],
      },
      journeys: {
        badge: 'ILLUSTRATIVE ARCHITECTURE EXAMPLES',
        title: 'Representative Intelligence Composition Scenarios',
        desc: 'The workflows below illustrate conceptual architectural compositions showing how AI coordinates with canonical providers (not universal runtime guarantees):',
        qualification: 'Notice: These examples represent illustrative architectural composition models, not universally released production workflows.',
        items: [
          {
            title: 'Scenario A: Resident Heating Malfunction Inquiry',
            role: 'Residential Living / Tenant',
            flow: 'Context: Unit 4B → Intent: Radiator leak reported → Authority: CORE verifies active tenancy → Plan: Diagnostic guidance + draft work order → Review: Tenant approves draft → Provider: Dispatched to OPERATIONS → Receipt: Work-order reference logged in audit trail.',
          },
          {
            title: 'Scenario B: Property Manager Maintenance Cost Inquiries',
            role: 'Commercial Operations / Manager',
            flow: 'Context: Central Tower HOA → Intent: Why did cold water costs spike? → Authority: CORE verifies manager mandate → Plan: Queries meter histories & tariffs from FIN01 → Output: Comparative variance report → Zero Mutation: General ledger remains untouched.',
          },
          {
            title: 'Scenario C: Communal Terrace Booking for Community Event',
            role: 'Community Experience / Owner',
            flow: 'Context: Rooftop Terrace Building B → Intent: Reserve for Saturday evening → Authority: CORE verifies owner status → Plan: BK01 checks schedule & quiet-hour rules → Review: Owner accepts house rules → Provider: Dispatched to BK01 for official reservation.',
          },
          {
            title: 'Scenario D: Subleasing Clause Clarification',
            role: 'Commercial Lease / Tenant CFO',
            flow: 'Context: Innovation Hub, 3rd Floor → Intent: Can we sublease 200 sqm? → Authority: CORE validates tenant signing mandate → Plan: Queries lease agreement in VAULT → Output: Explanatory summary citing relevant clauses without providing legal advice.',
          },
          {
            title: 'Scenario E: Field Contractor Completion Sign-Off',
            role: 'Operational Maintenance / Contractor',
            flow: 'Context: Basement Pump Station → Intent: Pump overhaul complete → Authority: CORE validates technician access pass → Plan: Verifies checklist completion → Provider: Dispatched to chief engineer in OPERATIONS → Receipt: Time-stamped sign-off logged.',
          },
        ],
      },
      domainsSection: {
        badge: 'DOMAIN ORCHESTRATION',
        title: 'How Intelligence Assists Each Platform Domain',
        desc: 'Every platform domain benefits from context-aware assistive orchestration without surrendering canonical ownership:',
        domains: [
          { name: 'AIRPROP', desc: 'Synthesizes inquiry histories, qualifies pre-sales prospects, and drafts commercial leasing proposals.' },
          { name: 'SERVICE', desc: 'Structures assistance requests, translates layperson descriptions into technical scopes, and compares bids.' },
          { name: 'OPERATIONS', desc: 'Interprets reported faults, correlates equipment maintenance histories, and prepares technician dispatches.' },
          { name: 'C&E', desc: 'Assembles contextual arrival handbooks, neighborhood guides, and drafts community announcements.' },
          { name: 'FIN01', desc: 'Explains maintenance cost allocations and variance trends without autonomous billing or balance mutations.' },
          { name: 'BK01', desc: 'Interprets amenity booking intents and routes schedule requests directly to BK01’s capacity engine.' },
          { name: 'DOCUMENTS', desc: 'Extracts relevant clauses and summarizes official documents in VAULT without substituting canonical files.' },
        ],
      },
      availability: {
        badge: 'TRANSPARENCY & GOVERNANCE',
        title: 'Architecture Maturity and Release Governance',
        desc: 'Our public documentation outlines the comprehensive architectural model of CLADORA Intelligence. In real-world enterprise deployments, capability availability is governed individually by product release roadmaps and customer implementation scope:',
        points: [
          'Intelligence capabilities are activated modularly based on active workspace tier and property configuration.',
          'Advanced autonomous capabilities (such as automated hospitality concierges, predictive maintenance, or automated marketplace purchasing) represent architectural design targets subject to release maturity.',
          'Architectural integrity is absolute: no assistive intelligence feature can write unverified state or bypass authority enforcement in CORE.',
        ],
      },
      cta: {
        title: 'Architect Governed, Context-Aware Intelligence for Your Assets',
        desc: 'Connect with CLADORA platform architects to explore how governed intelligence can assist operational teams while preserving transactional integrity.',
        primary: 'Explore Platform Architecture',
        secondary: 'Contact Platform Architects',
      },
    },
    fa: {
      breadcrumb: { home: 'خانه', current: 'هوش عملیاتی کلادورا (CLADORA Intelligence)' },
      hero: {
        badge: 'معماری هوش عملیاتی کلادورا',
        title: 'هوش مصنوعی با درک بافت و زمینه پیش از هر اقدام',
        subtitle:
          'دامنهٔ CLADORA Intelligence طوری طراحی شده است که بافت ملک، تفکیک ورک‌اسپیس، رابطهٔ سکونتی و حدود اختیارات را پیش از هرگونه پیشنهاد یا هماهنگی اقدام از طریق متولیان مرجع پلتفرم، احراز و تدقیق نماید.',
        ctaPrimary: 'بررسی معماری هوش عملیاتی',
        ctaSecondary: 'مشاهده معماری جامع پلتفرم',
      },
      positioning: {
        badge: 'جایگاه در معماری پلتفرم',
        title: 'یک لایهٔ ارکستراسیون کمکی و مقید، نه متولی مرجع حقیقت داده‌ها',
        desc: 'در ساختار مهندسی کلادورا، هوش مصنوعی یک چت‌بات منزوی یا یک عامل خودسر (Autonomous Agent) نیست. این سامانه لایه‌ای از هوشمندی کمکی و مقید است که کاملاً تحت فرمان اختیارات پلتفرم و تصمیم‌گیری نهایی انسان عمل می‌کند.',
        pillars: [
          {
            title: 'متولی مرجع حقیقت نیست',
            desc: 'هوش مصنوعی مالکیتی بر هویت افراد، اسناد ملکی، دفاتر کل مالی، تقویم رزروها، قراردادها یا فایل‌های حقوقی ندارد. این داده‌ها منحصراً متعلق به ارائه‌دهندگان مرجع هستند.',
            icon: Lock,
          },
          {
            title: 'نفی ثبت مستقیم در پایگاه داده',
            desc: 'سامانه هوشمندی هرگز وضعیت سیستم را مستقیماً تغییر نمی‌دهد. هر اقدام پیشنهادی صرفاً از طریق قراردادهای رسمی API به متولی مربوطه ارجاع می‌شود.',
            icon: ShieldCheck,
          },
          {
            title: 'پیروی قطعی از حدود اختیارات',
            desc: 'هوش مصنوعی منحصراً در چارچوب اختیارات احراز‌شده در CORE عمل می‌کند. در صورت عدم اثبات قطعی اختیارات، معماری هرگونه تغییر داده را رد می‌نماید.',
            icon: Scale,
          },
        ],
      },
      flowSection: {
        badge: 'جریان بنیادین معماری اقدام',
        title: 'از بافت مکانی تا صدور رسید ممیزی قابل ردیابی',
        desc: 'هر تعامل مبتنی بر هوش مصنوعی از یک زنجیرهٔ معماری قطعی عبور می‌کند که برای پیشگیری از خطا، تغییرات غیرمجاز و توهمات عملیاتی طراحی شده است:',
        steps: [
          {
            num: '۰۱',
            name: 'تحلیلگر بافت (Context Resolver)',
            desc: 'شناسایی هویت کاربر، محدودهٔ فیزیکی ملک، مرز ورک‌اسپیس، نقش سکونتی و مأموریت فعال.',
            icon: MapPin,
          },
          {
            num: '۰۲',
            name: 'هدایتگر قصد (Intent Router)',
            desc: 'تحلیل مقصود عملیاتی بدون اعطای مجوز پیش‌فرض (قصد کاربر به معنای داشتن اختیار نیست).',
            icon: Compass,
          },
          {
            num: '۰۳',
            name: 'بستار اختیار (Authority Gate)',
            desc: 'اعتبارسنجی حقوق در CORE. در صورت عدم احراز اختیار، اصل عدم تغییر بدون مجوز (Zero-Write) اعمال می‌شود.',
            icon: ShieldCheck,
          },
          {
            num: '۰۴',
            name: 'طراح اقدام (Planner)',
            desc: 'تدوین یک طرح اقدام شفاف، گام‌به‌گام و قابل ارزیابی پیش از ارسال به مرحله اجرا.',
            icon: Sliders,
          },
          {
            num: '۰۵',
            name: 'انطباق با خط‌مشی و نظارت انسانی',
            desc: 'اقدامات دارای پیامد، مشمول سازوکارهای کنترلی و تأیید انسانی متناسب باقی می‌مانند.',
            icon: UserCheck,
          },
          {
            num: '۰۶',
            name: 'متولی مرجع (Canonical Provider)',
            desc: 'ارسال درخواست تأییدشده مستقیماً به قرارداد متولی مرجع ذی‌ربط (FIN01، BK01، OPS و غیره).',
            icon: CheckCircle2,
          },
          {
            num: '۰۷',
            name: 'رسید ممیزی (Audit Receipt)',
            desc: 'ثبت رسید ممیزی با برچسب زمانی و بافت تصمیم در دفتر رویدادهای غیرقابل تغییر سیستم.',
            icon: FileCheck,
          },
        ],
        railTitle: 'متولیان مرجع متصل به سامانه:',
      },
      contextResolver: {
        badge: 'تحلیل و احراز بافت',
        title: 'ناکافی بودن هویت عمومی: قدرت تفکیک بافت و نقش‌ها',
        desc: 'در مدیریت املاک، یک شخص واحد می‌تواند نقش‌های گوناگونی ایفا کند: مالک یک واحد مسکونی، کارمند یک شرکت مستأجر در برج اداری، و یک مراجع موقت در ساختمانی دیگر. هوش عملیاتی کلادورا هرگز بر پایه یک هویت مجرد و سراسری تصمیم‌گیری نمی‌کند، بلکه هفت بُعد بافت را با دقت می‌سنجد:',
        dimensions: [
          { name: 'فرد و اعتبارسنجی', desc: 'هویت تأییدشده در هسته CORE با نشست‌های امنیتی معتبر.' },
          { name: 'دامنهٔ ورک‌اسپیس', desc: 'مرز منطقی تفکیک داده‌های سازمان یا مجتمع ساختمانی.' },
          { name: 'دارایی فیزیکی و فضا', desc: 'پلاک ثبتی، کالبد ساختمان، طبقه و واحد مسکونی یا اداری دقیق.' },
          { name: 'رابطهٔ سکونتی', desc: 'مالک، مستأجر مسکونی، بهره‌بردار تجاری، تکنسین یا مهمان.' },
          { name: 'مأموریت و حدود زمانی', desc: 'محدوده‌های تفویض اختیارات، سقف مبالغ مالی و بازه‌های مجاز زمانی.' },
          { name: 'بستهٔ کشوری (Country Pack)', desc: 'قوانین، ارز و چارچوب‌های حقوقی ویژه هر حوزه قضایی (مانند رومانی).' },
          { name: 'بافت دامنه عملیاتی', desc: 'دامنه عملیاتی مرتبط: AIRPROP، SERVICE، عملیات نگهداری، تعاملات یا مالی.' },
        ],
      },
      intentRouter: {
        badge: 'هدایت و درک مقصود',
        title: 'تحلیل مقصود کاربر: قصد هرگز اختیار قانونی ایجاد نمی‌کند',
        desc: 'لایه هدایت قصد، پیام‌های به زبان طبیعی یا هشدارهای رویداد را بدون تغییر در داده‌ها و بدون پیش‌فرض داشتن مجوز تحلیل می‌کند:',
        categories: [
          { title: 'درخواست‌های اطلاعاتی', desc: 'پرسش درباره کتابچه ساختمان، ساعات آرامش یا اطلاعات شهری پیرامونی.' },
          { title: 'بازیابی اسناد', desc: 'تقاضای مشاهده برگه مشخصات فنی، قراردادهای اجاره یا مصوبات مجمع در VAULT.' },
          { title: 'سفارش خدمات', desc: 'ثبت درخواست نظافت، باغبانی یا خدمات تخصصی در سامانه SERVICE.' },
          { title: 'گزارش خرابی و حادثه', desc: 'گزارش عیوب تأسیساتی، نشتی لوله‌ها یا مشکلات برقی به بخش OPERATIONS.' },
          { title: 'تقاضای رزرو امکانات', desc: 'بررسی سانس‌های خالی مشاعات ساختمان و تدوین پیش‌نویس برای BK01.' },
          { title: 'شفاف‌سازی مالی', desc: 'پرسش پیرامون اقلام شارژ ماهانه، تسهیم قبوض و فاکتورهای صادره از FIN01.' },
        ],
        warning: 'قاعده کلیدی: هدایتگر قصد هرگز صلاحیت ایجاد نمی‌کند. حتی اگر مقصود کاملاً شفاف باشد، اجرا منوط به بستار اختیارات است.',
      },
      authorityGate: {
        badge: 'بستار اختیار و خط‌مشی',
        title: 'اعتبارسنجی مأموریت و استاندارد عدم تغییر بدون مجوز (Zero-Write)',
        desc: 'پیش از آنکه هر طرحی تدوین یا به مرحله اجرا برسد، سیستم از هسته CORE استعلام می‌گیرد تا مطمئن شود متقاضی از لحاظ قانونی مجاز به انجام آن تغییر در آن بافت ملکی است:',
        points: [
          {
            title: 'اصل عدم تغییر بدون مجوز (Zero-Write)',
            desc: 'چنانچه اختیارات مورد نیاز با قطعیت در CORE احراز نشود، معماری مستلزم رد هرگونه تغییر در داده‌ها است.',
          },
          {
            title: 'پالایش مبتنی بر خط‌مشی‌ها',
            desc: 'فراتر از نقش کاربر، اقدامات با سقف مبالغ مالی، الزام به امضاهای چندگانه و مقررات بسته کشوری انطباق داده می‌شوند.',
          },
          {
            title: 'نظارت انسانی متناسب',
            desc: 'هوش مصنوعی در چارچوب مرزهای احراز‌شدهٔ اختیارات عمل می‌کند. اقدامات دارای پیامدهای حقوقی یا مالی، مشمول سازوکارهای کنترلی و تأیید انسانی متناسب باقی می‌مانند.',
          },
        ],
      },
      plannerSection: {
        badge: 'طراح اقدام شفاف',
        title: 'تدوین گام‌به‌گام بسته‌های پیشنهادی عملیاتی',
        desc: 'طراح اقدام گام‌های اجرایی را بدون هیچ‌گونه شتاب‌زدگی و قبل از اجرا به صورت شفاف می‌سازد. نمونه‌ای از تدوین برنامه برای خرابی سیستم گرمایش:',
        steps: [
          { step: 'گام ۱', action: 'احراز بافت ملک', detail: 'شناسایی واحد ۴B در بلوک A و تأیید وضعیت مستأجر فعال.' },
          { step: 'گام ۲', action: 'بررسی اختیار', detail: 'اعتبارسنجی صلاحیت مستأجر برای ثبت خرابی رادیاتورهای داخلی واحد.' },
          { step: 'گام ۳', action: 'بررسی سوابق فنی', detail: 'بررسی مدل ترموستات و سوابق تعمیرات قبلی ثبت‌شده در OPERATIONS.' },
          { step: 'گام ۴', action: 'تدوین پیشنهاد', detail: 'تنظیم پیش‌نویس دستورکار فنی و پیشنهاد بازه‌های زمانی بهینه برای بازدید تکنسین.' },
          { step: 'گام ۵', action: 'بررسی و تأیید مسئول', detail: 'ارائه طرح ساختاریافته به مستأجر و مدیر ساختمان جهت تأیید و امضای نهایی.' },
          { step: 'گام ۶', action: 'ارسال به مرجع داده', detail: 'پس از تأیید صریح، دستورکار رسماً در سامانه مرجع OPERATIONS ثبت می‌گردد.' },
        ],
      },
      toolRouting: {
        badge: 'قراردادهای متولیان مرجع داده',
        title: 'مسیردهی ابزارها صرفاً از طریق ارائه‌دهندگان مرجع حقیقت',
        desc: 'هوش عملیاتی کلادورا هیچ پایگاه داده مخفی یا مستقلی ندارد. این سامانه اقدامات را صرفاً از مجرای قراردادهای رسمی متولیان داده هدایت می‌کند:',
        tools: [
          { provider: 'CORE', role: 'هویت و حدود اختیارات', desc: 'اعتبارسنجی نقش‌ها، سلسله‌مراتب ورک‌اسپیس‌ها، عضویت و حق امضا.' },
          { provider: 'DOCUMENTS (VAULT)', role: 'اصالت اسناد', desc: 'بازیابی نسخه‌های مرجع، قراردادهای ثبت‌شده و شناسنامه فنی ساختمان.' },
          { provider: 'FIN01', role: 'حقیقت مالی', desc: 'استعلام مانده‌حساب‌ها، تشریح تسهیم هزینه‌ها و بازبینی فاکتورها بدون دخل‌وتصرف.' },
          { provider: 'BK01', role: 'ظرفیت و زمان‌بندی', desc: 'بررسی جدول سانس‌ها و اعمال قوانین ظرفیت برای رزرو فضاهای مشترک.' },
          { provider: 'SERVICE', role: 'خدمات و مناقصات', desc: 'ساختاردهی به سفارش‌های خدمات، استعلام قیمت‌ها و مقایسه پیشنهادات.' },
          { provider: 'OPERATIONS', role: 'عملیات نگهداری فنی', desc: 'صدور دستورکارهای فنی، چک‌لیست‌های تعمیرات و مأموریت‌های تکنسین‌ها.' },
          { provider: 'COMMUNICATIONS', role: 'ارسال پیام و اعلان', desc: 'ارسال اعلان‌ها و ثبت سوابق اصالت تحویل پیام در کانال‌های مختلف.' },
          { provider: 'AIRPROP', role: 'چرخه معاملات ملکی', desc: 'سنتز فرصت‌های تجاری، پرونده‌های پیش‌فروش و انتقال حقوق استیجاری.' },
          { provider: 'C&E', role: 'تجربه و تعاملات جمعی', desc: 'چینش راهنماهای محیطی، اعلانات تابلوی مجتمع و اطلاع‌رسانی گردهمایی‌ها.' },
        ],
      },
      recomVsAction: {
        badge: 'تفکیک ماهیتی دقیق',
        title: 'پیشنهاد مشورتی در برابر اقدام با تغییر داده‌ها',
        desc: 'برای تضمین امنیت در مقیاس سازمانی، سیستم تفاوت آشکاری میان گزارش‌های تحلیلی و ثبت تراکنش‌های قطعی قائل است:',
        table: [
          {
            type: 'پیشنهاد مشورتی (Recommendation)',
            nature: 'بدون تغییر داده (صرفاً خواندن / پیش‌نویس)',
            examples: 'تشریح علت اختلاف ارقام در قبض شارژ، مقایسه سه پیش‌فاکتور پیمانکاران، پیشنهاد سانس‌های خالی استخر.',
            approval: 'نیاز به امضای رسمی ندارد؛ صرفاً به عنوان یک بافت مشورتی ارائه می‌گردد.',
          },
          {
            type: 'اقدام قطعی (Action)',
            nature: 'ایجاد تغییر در وضعیت سیستم (عملیات نوشتن)',
            examples: 'ثبت نهایی دستورکار در OPERATIONS، اعمال تراکنش در FIN01، ثبت قطعی رزرو در BK01.',
            approval: 'منوط به سازوکارهای کنترلی و تأیید انسانی متناسب توسط کاربر دارای صلاحیت.',
          },
        ],
      },
      dialogueMod: {
        badge: 'تنظیم از طریق گفتگو',
        title: 'اصلاح مکالمه‌ای طرح اقدام هرگز مرزهای اختیار را دور نمی‌زند',
        desc: 'کاربر می‌تواند طرح اولیه را از طریق مکالمه تغییر دهد („پیمانکار دوم را انتخاب کن”، „موکول کن به سه‌شنبه”، „فقط به مدیر اطلاع بده”). با دریافت هر پیام، سیستم بافت، اختیارات و خط‌مشی‌ها را مجدداً ارزیابی کرده و سپس پیشنهاد اصلاح‌شده را ارائه می‌دهد.',
        rule: 'هیچ جمله‌بندی محاوره‌ای نمی‌تواند الزامات احراز صلاحیت در CORE را نادیده بگیرد.',
      },
      humanHandoff: {
        badge: 'ارجاع به اپراتور انسانی',
        title: 'انتقال شفاف پرونده به انسان در صورت وجود ابهام',
        desc: 'هوش عملیاتی کلادورا در شرایط فقدان داده یا تناقض، از حدس زدن پرهیز می‌کند. در موارد زیر، سیستم بلافاصله پرونده را به مسئول انسانی ذی‌صلاح ارجاع می‌دهد:',
        triggers: [
          'ابهام در اختیارات یا تداخل نقش‌های چندگانه در ورک‌اسپیس فعال.',
          'نبود انطباق دقیق میان مشخصات متقاضی و پلاک ثبتی یا واحد مورد نظر.',
          'فراتر رفتن ارقام مالی از سقف اختیارات تعیین‌شده در آیین‌نامه‌های مجتمع.',
          'درخواست‌های مرتبط با سیستم‌های حساس ایمنی جانی (شیرهای گاز، آسانسورها، سیستم اعلان حریق).',
          'تناقض در مدارک ارائه‌شده یا عدم احراز مالکیت معتبر.',
        ],
      },
      explainability: {
        badge: 'شفافیت تصمیم‌گیری',
        title: 'پاسخگویی و رفع ابهام: نفی تصمیم‌گیری در جعبه سیاه',
        desc: 'هر طرح پیشنهادی توسط سامانه هوشمند کلادورا قابلیت پاسخگویی به شش پرسش شفاف‌ساز را داراست:',
        questions: [
          { q: 'سیستم چه چیزی را فهمید؟', a: 'خلاصه دقیق خواسته استخراج‌شده از مکالمه کاربر.' },
          { q: 'کدام ملک و ورک‌اسپیس مخاطب هستند؟', a: 'محدوده ثبتی دقیق و سازمان مسئول پرونده.' },
          { q: 'بر مبنای کدام رابطهٔ سکونتی؟', a: 'نقش فعال (مالک، مستأجر و غيره) احراز‌شده در CORE.' },
          { q: 'دقیقاً چه اقدامی پیشنهاد شده است؟', a: 'دستور مشخصی که برای متولی مرجع تنظیم شده است.' },
          { q: 'کدام متولی اصلی مسئول اجرا خواهد بود؟', a: 'سامانه مرجع مربوطه (SERVICE، OPERATIONS، FIN01 و غیره).' },
          { q: 'چرا تأیید انسانی الزامی شد؟', a: 'سقف خط‌مشی یا قانون مشخصی که نظارت انسان را فعال کرده است.' },
        ],
      },
      receiptSection: {
        badge: 'ردیابی و ممیزی',
        title: 'رسیدهای ممیزی و دفاتر وقایع ثبت‌شده',
        desc: 'هر عملیاتی که با هماهنگی دستیار هوشمند انجام پذیرد، یک رسید ممیزی با ثبت بافت اولیه، اعتبارسنجی CORE، تأیید انسانی و پاسخ متولی مرجع در دفتر رویدادهای سیستم تولید می‌کند.',
      },
      safetySection: {
        badge: 'امنیت و حاکمیت داده‌ها',
        title: 'اصول پنج‌گانه غیرقابل مذاکره در مهندسی پلتفرم',
        desc: 'برای جلوگیری از ریسک‌های عملیاتی و ادعاهای نامعتبر، کلادورا ۵ قانون حاکمیتی قطعی را اعمال می‌نماید:',
        rules: [
          {
            title: 'هوش مصنوعی حق قانونی ایجاد نمی‌کند',
            desc: 'سامانه نمی‌تواند مالکیت، عضویت، وکالت یا امتیازات مالی خلق نماید.',
            icon: ShieldAlert,
          },
          {
            title: 'نفی دور زدن متولیان مرجع',
            desc: 'هیچ دیتابیس سایه یا پنهانی وجود ندارد؛ تمام رویدادها از مجرای قراردادهای مرجع انجام می‌شوند.',
            icon: Lock,
          },
          {
            title: 'عدم دخالت در سیستم‌های حساس حیاتی',
            desc: 'سامانه به‌صورت مستقل کنترلی بر شبکه گاز، آسانسورها، سیستم‌های اعلام و اطفای حریق یا تجهیزات برق فشارقوی ندارد.',
            icon: AlertTriangle,
          },
          {
            title: 'استقلال از مدل و ارائه‌دهنده',
            desc: 'معماری کلادورا وابسته به یک مدل زبانی خاص نیست و امکان به‌کارگیری مدل‌های بهینه را بدون وابستگی حفظ می‌کند.',
            icon: Cpu,
          },
          {
            title: 'حفظ حریم خصوصی و بهینگی داده‌ها',
            desc: 'داده‌ها صرفاً درون حریم ورک‌اسپیس مجاز پردازش شده و اصول کاهش حداکثری دسترسی به داده رعایت می‌شود.',
            icon: Eye,
          },
        ],
      },
      journeys: {
        badge: 'نمونه‌های تصویری ترکیب معماری',
        title: 'سناریوهای نمونه در تعامل هوش مصنوعی با متولیان مرجع',
        desc: 'سناریوهای زیر الگوهای مفهومی معماری برای نمایش هماهنگی هوش با متولیان داده هستند (بدون ادعای گارانتی سراسری در نسخه فعلی):',
        qualification: 'یادداشت: این نمونه‌ها الگوهای مفهومی ترکیب معماری هستند و به عنوان جریان‌های کاری عرضه‌شدهٔ سراسری در محیط عملیاتی تلقی نمی‌شوند.',
        items: [
          {
            title: 'سناریوی الف: گزارش خرابی رادیاتور توسط مستأجر',
            role: 'سکونت مسکونی / مستأجر',
            flow: 'بافت: واحد ۴B → مقصود: نشتی رادیاتور → اختیار: CORE حق ثبت خرابی مستأجر را تأیید می‌کند → طرح: راهنمای شیر فلکه + پیش‌نویس دستورکار → نظارت: تأیید مستأجر → متولی: ارجاع به OPERATIONS → رسید: شماره پیگیری در لاگ ثبت می‌شود.',
          },
          {
            title: 'سناریوی ب: تحلیل تغییرات هزینه شارژ توسط مدیر مجتمع',
            role: 'مدیریت مجتمع / مدیر ساختمان',
            flow: 'بافت: برج مرکزی → مقصود: دلیل افزایش قبض آب مصرفی مشاعات چیست؟ → اختیار: CORE نقش مدیر را تأیید می‌کند → طرح: استعلام قبوض و کنتورها از FIN01 → نتیجه: ارائه گزارش تحلیلی مقایسه‌ای → بدون تغییر: دفتر کل مالی دست‌نخورده باقی می‌ماند.',
          },
          {
            title: 'سناریوی ج: رزرو سالن اجتماعات برای گردهمایی',
            role: 'تعامل جمعی / مالک واحد',
            flow: 'بافت: روف‌گاردن بلوک B → مقصود: رزرو برای شنبه عصر → اختیار: CORE مالکیت بدون بدهی را تأیید می‌کند → طرح: BK01 ساعات و محدودیت صوتی را بررسی می‌کند → نظارت: پذیرش ضوابط توسط مالک → متولی: ثبت رسمی رزرو در تقویم BK01.',
          },
          {
            title: 'سناریوی د: شفاف‌سازی حقوقی بند اجاره‌نامه اداری',
            role: 'مستأجر تجاری / مدیر مالی شرکت',
            flow: 'بافت: برج نوآوری، طبقه ۳ → مقصود: آیا امکان واگذاری بخشی از فضا وجود دارد؟ → اختیار: CORE امضای مجاز مدیر را تأیید می‌کند → طرح: استخراج بند قرارداد از VAULT → نتیجه: ارائه خلاصه متن قرارداد با ذکر ماده قانونی (بدون مشاوره حقوقی).',
          },
          {
            title: 'سناریوی هـ: تأیید پایان عملیات توسط تکنسین فنی',
            role: 'نگهداری فنی / پیمانکار',
            flow: 'بافت: موتورخانه مرکزی → مقصود: پایان سرویس پمپ‌ها → اختیار: CORE مجوز کار تکنسین را اعتبارسنجی می‌کند → طرح: بررسی چک‌لیست الزامی → متولی: ارسال گزارش نهایی به مهندس ناظر در OPERATIONS → رسید: ثبت زمان‌دار پایان کار.',
          },
        ],
      },
      domainsSection: {
        badge: 'ارکستراسیون میان دامنه‌ها',
        title: 'چگونگی همراهی هوش مصنوعی با دامنه‌های هفت‌گانه',
        desc: 'هر یک از دامنه‌های پلتفرم از ارکستراسیون هوشمند با حفظ کامل اختیارات متولی داده بهره‌مند می‌شود:',
        domains: [
          { name: 'AIRPROP', desc: 'سنتز سوابق بازدیدها، طبقه‌بندی متقاضیان و آماده‌سازی بسته‌های مقدماتی پیش‌فروش یا اجاره.' },
          { name: 'SERVICE', desc: 'ساختاردهی به نیازهای خدماتی، ترجمه زبان محاوره‌ای به اصطلاحات فنی و مقایسه هوشمندانه پیشنهادات پیمانکاران.' },
          { name: 'OPERATIONS', desc: 'تفسیر گزارش‌های خرابی، ارتباط‌دهی با پیشینه تجهیزات و تنظیم دستورکار اعزام تکنسین‌ها.' },
          { name: 'C&E', desc: 'تنظیم کتابچه‌های راهنمای فضا، ضوابط محلی و تدوین پیش‌نویس اعلانات برای تابلوی اعلانات مجتمع.' },
          { name: 'FIN01', desc: 'تحلیل تسهیم هزینه‌های شارژ و دلایل نوسان قبوض بدون امکان پرداخت یا دستکاری در دفاتر مالی.' },
          { name: 'BK01', desc: 'درک قصد رزرواسیون و هدایت زمان‌بندی به موتور ارزیابی ظرفیت و سقف‌های BK01.' },
          { name: 'DOCUMENTS', desc: 'استخراج نکات کلیدی و تلخیص بندهای اسناد بایگانی‌شده در VAULT بدون جایگزینی با سند اصلی.' },
        ],
      },
      availability: {
        badge: 'شفافیت و حاکمیت استقرار',
        title: 'بلوغ معماری سامانه و مراحل عرضه',
        desc: 'مستندات حاضر معماری جامع CLADORA Intelligence را معرفی می‌نماید. در استقرارهای عملیاتی، دسترسی به قابلیت‌ها به نقشه راه عرضه نرم‌افزار و قرارداد سازمانی هر پروژه بستگی دارد:',
        points: [
          'قابلیت‌های هوشمند بر اساس سطح اشتراک فعال ورک‌اسپیس و کالبد ساختمانی ملک فعال‌سازی می‌شوند.',
          'ویژگی‌های پیشرفته (مانند سیستم‌های خودکار کنسیرژ، نگهداری پیش‌بینانه یا خریدهای خودکار) اهداف نقشه راه معماری هستند و مستلزم بلوغ نسخه‌های آینده می‌باشند.',
          'امنیت معماری قطعی است: هیچ قابلیت هوشمندی قادر به ثبت داده‌های احرازشده نبوده و نمی‌تواند استعلام اختیارات از CORE را نادیده بگیرد.',
        ],
      },
      cta: {
        title: 'طراحی هوش عملیاتی امن و مقید برای دارایی‌های ملکی شما',
        desc: 'با متخصصان معماری پلتفرم کلادورا درباره نحوه ارتقای بهره‌وری تیم‌های نگهداری با حفظ سلامت دفاتر رسمی گفتگو نمایید.',
        primary: 'مشاهده معماری جامع پلتفرم',
        secondary: 'تماس با مهندسان پلتفرم',
      },
    },
  }[lang] || {
    breadcrumb: { home: 'Home', current: 'CLADORA Intelligence' },
    hero: { badge: '', title: '', subtitle: '', ctaPrimary: '', ctaSecondary: '' },
    positioning: { badge: '', title: '', desc: '', pillars: [] },
    flowSection: { badge: '', title: '', desc: '', steps: [], railTitle: '' },
    contextResolver: { badge: '', title: '', desc: '', dimensions: [] },
    intentRouter: { badge: '', title: '', desc: '', categories: [], warning: '' },
    authorityGate: { badge: '', title: '', desc: '', points: [] },
    plannerSection: { badge: '', title: '', desc: '', steps: [] },
    toolRouting: { badge: '', title: '', desc: '', tools: [] },
    recomVsAction: { badge: '', title: '', desc: '', table: [] },
    dialogueMod: { badge: '', title: '', desc: '', rule: '' },
    humanHandoff: { badge: '', title: '', desc: '', triggers: [] },
    explainability: { badge: '', title: '', desc: '', questions: [] },
    receiptSection: { badge: '', title: '', desc: '' },
    safetySection: { badge: '', title: '', desc: '', rules: [] },
    journeys: { badge: '', title: '', desc: '', qualification: '', items: [] },
    domainsSection: { badge: '', title: '', desc: '', domains: [] },
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
              <Sparkles className="w-3.5 h-3.5" />
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
                href="#flow"
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

        {/* 02 ARCHITECTURAL POSITIONING */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.positioning.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.positioning.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.positioning.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {content.positioning.pillars.map((pil, idx) => {
              const Icon = pil.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center font-bold">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="text-sm font-bold text-[#102A43]">{pil.title}</h3>
                    <p className="text-xs text-[#52667A] leading-relaxed">{pil.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 03 PRIMARY ARCHITECTURAL FLOW */}
        <section id="flow" className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
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

          {/* 7-Step Horizontal Flow */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5 pt-2">
            {content.flowSection.steps.map((st, idx) => {
              const Icon = st.icon;
              return (
                <div
                  key={idx}
                  className="p-4 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] flex flex-col justify-between space-y-3 hover:border-teal-300 transition-colors"
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

          {/* Connected Providers Rail */}
          <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-100 flex items-center justify-between flex-wrap gap-3 text-xs">
            <div className="flex items-center gap-2 text-[#0E9F8E] flex-wrap">
              <span className="font-bold">{content.flowSection.railTitle}</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-[#102A43]">CORE</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-[#102A43]">DOCUMENTS</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-[#102A43]">FIN01</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-[#102A43]">BK01</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-[#102A43]">SERVICE</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-[#102A43]">OPERATIONS</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-[#102A43]">COMMUNICATIONS</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-[#102A43]">AIRPROP</span>
              <span className="font-mono bg-white px-2 py-0.5 rounded border border-teal-200 text-[#102A43]">C&amp;E</span>
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

        {/* 04 CONTEXT RESOLVER */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.contextResolver.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.contextResolver.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.contextResolver.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {content.contextResolver.dimensions.map((dim, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#0E9F8E]" />
                  <h3 className="text-xs font-bold text-[#102A43]">{dim.name}</h3>
                </div>
                <p className="text-[11px] text-[#52667A] leading-relaxed ps-4">{dim.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 05 INTENT ROUTER */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.intentRouter.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.intentRouter.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.intentRouter.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {content.intentRouter.categories.map((cat, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-[#0E9F8E]" />
                  <h3 className="text-xs font-bold text-[#102A43]">{cat.title}</h3>
                </div>
                <p className="text-[11px] text-[#52667A] leading-relaxed ps-6">{cat.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{content.intentRouter.warning}</span>
          </div>
        </section>

        {/* 06 AUTHORITY & POLICY GATEWAY */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.authorityGate.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.authorityGate.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.authorityGate.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {content.authorityGate.points.map((pt, idx) => (
              <div
                key={idx}
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
        </section>

        {/* 07 PLANNER */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.plannerSection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.plannerSection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.plannerSection.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {content.plannerSection.steps.map((st, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-50 text-[#0E9F8E] border border-teal-200">
                    {st.step}
                  </span>
                  <Sliders className="w-3.5 h-3.5 text-[#52667A]" />
                </div>
                <h3 className="text-xs font-bold text-[#102A43]">{st.action}</h3>
                <p className="text-[11px] text-[#52667A] leading-relaxed">{st.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 08 CANONICAL PROVIDER TOOLS */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.toolRouting.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.toolRouting.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.toolRouting.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {content.toolRouting.tools.map((tl, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#102A43] px-2 py-0.5 rounded bg-white border border-[#D3DCE6]">
                    {tl.provider}
                  </span>
                  <span className="text-[11px] font-semibold text-[#0E9F8E]">{tl.role}</span>
                </div>
                <p className="text-xs text-[#52667A] leading-relaxed">{tl.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 09 RECOMMENDATION VS ACTION */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.recomVsAction.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.recomVsAction.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.recomVsAction.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {content.recomVsAction.table.map((row, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-4 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-[#102A43]">{row.type}</h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-white text-[#0E9F8E] border border-teal-200">
                      {row.nature}
                    </span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-[#102A43] block mb-1">Exemple:</span>
                    <p className="text-xs text-[#52667A] leading-relaxed">{row.examples}</p>
                  </div>
                </div>
                <div className="pt-3 border-t border-[#E2E8F0] text-[11px] text-[#52667A]">
                  <strong className="text-[#102A43]">Guvernanță:</strong> {row.approval}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 10 CONVERSATIONAL MODIFICATION */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.dialogueMod.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.dialogueMod.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.dialogueMod.desc}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-teal-50/70 border border-teal-200 text-xs text-[#102A43] flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-[#0E9F8E] shrink-0" />
            <span className="font-medium">{content.dialogueMod.rule}</span>
          </div>
        </section>

        {/* 11 EXCEPTION & HUMAN HANDOFF */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.humanHandoff.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.humanHandoff.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.humanHandoff.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {content.humanHandoff.triggers.map((trig, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] flex items-start gap-3"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-[#52667A] leading-relaxed">{trig}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 12 EXPLAINABILITY FRAMEWORK */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.explainability.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.explainability.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.explainability.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {content.explainability.questions.map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-[#102A43]">
                  <Eye className="w-4 h-4 text-[#0E9F8E]" />
                  <span>{item.q}</span>
                </div>
                <p className="text-[11px] text-[#52667A] leading-relaxed ps-6">{item.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 13 AUDIT RECEIPTS & EVENT TRAILS */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-6">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.receiptSection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.receiptSection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.receiptSection.desc}
            </p>
          </div>
        </section>

        {/* 14 EXAMPLE INTELLIGENCE JOURNEYS */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.journeys.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.journeys.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.journeys.desc}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
            <span>{content.journeys.qualification}</span>
          </div>

          <div className="space-y-4">
            {content.journeys.items.map((jn, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2.5"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm font-bold text-[#102A43]">{jn.title}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-teal-50 text-[#0E9F8E] border border-teal-200">
                    {jn.role}
                  </span>
                </div>
                <p className="text-xs text-[#52667A] leading-relaxed font-mono bg-white p-3 rounded-xl border border-[#E2E8F0]">
                  {jn.flow}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 15 INTELLIGENCE ACROSS PLATFORM DOMAINS */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.domainsSection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.domainsSection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.domainsSection.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {content.domainsSection.domains.map((dm, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-2"
              >
                <span className="font-mono text-xs font-bold text-[#0E9F8E] px-2 py-0.5 rounded bg-teal-50 border border-teal-200 inline-block">
                  {dm.name}
                </span>
                <p className="text-xs text-[#52667A] leading-relaxed pt-1">{dm.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 16 SAFETY & GOVERNANCE BOUNDARIES */}
        <section className="bg-white rounded-3xl p-8 sm:p-12 border border-[#D3DCE6] shadow-card space-y-8">
          <div className="max-w-3xl space-y-3">
            <span className="text-xs font-bold text-[#0E9F8E] uppercase tracking-wider">
              {content.safetySection.badge}
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#102A43] tracking-tight">
              {content.safetySection.title}
            </h2>
            <p className="text-sm text-[#52667A] leading-relaxed">
              {content.safetySection.desc}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {content.safetySection.rules.map((rl, idx) => {
              const Icon = rl.icon;
              return (
                <div
                  key={idx}
                  className="p-6 rounded-2xl bg-[#F6F9FC] border border-[#E2E8F0] space-y-3"
                >
                  <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#0E9F8E] flex items-center justify-center font-bold">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-[#102A43]">{rl.title}</h3>
                  <p className="text-xs text-[#52667A] leading-relaxed">{rl.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* 17 AVAILABILITY & MATURITY GOVERNANCE */}
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

        {/* 18 FINAL CTA SECTION */}
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
