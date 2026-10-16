import { GuideArticleData } from './types';

export const CLUSTER_B_ARTICLES: Record<string, GuideArticleData> = {
  // 1. MENTENANTA-PREVENTIVA-CLADIRI
  'mentenanta-preventiva-cladiri': {
    id: 'CLUSTER-B-01',
    lang: 'ro',
    slug: 'mentenanta-preventiva-cladiri',
    contentApplicability: { kind: 'country', countryCode: 'RO' },
    title: 'Planul de Mentenanță Preventivă a Clădirilor: Etape, Grafice Obligatorii și Reducerea Costurilor de Avarie',
    seoTitle: 'Mentenanță Preventivă Clădiri: Ghid Tehnic și Grafice',
    description:
      'Ghid de mentenanță preventivă pentru clădiri: planificarea reviziilor tehnice obligatorii, frecvențe recomandate pe echipamente și reducerea costurilor de avarie.',
    category: 'Mentenanță & Operațiuni Tehnice',
    clusterId: 'cluster-b-operations',
    primaryQuery: 'mentenanță preventivă clădiri',
    supportingQueries: [
      'software mentenanță clădiri',
      'plan mentenanță preventivă bloc',
      'grafic revizii tehnice clădire',
      'costuri mentenanță preventivă vs corectivă'
    ],
    searchIntent: 'informational',
    publicationDate: '2026-10-15',
    datePublished: '2026-10-15',
    dateModified: '2026-10-15',
    author: 'Echipa de Cercetare & Arhitectură CLADORA',
    authorName: 'Echipa de Cercetare & Arhitectură CLADORA',
    authorUrl: '/ro/resources/autori/cladora-research',
    reviewedBy: 'Echipa Editorială & de Cercetare CLADORA',
    schemaType: 'Article',
    readTime: '13 min citire',
    pillarHref: '/ro/operations',
    disclaimer:
      'Acest ghid conține recomandări tehnico-metodologice pentru organizarea operațiunilor de mentenanță în clădiri. Nu înlocuiește normativele tehnice în vigoare, cărțile tehnice ale utilajelor sau prescripțiile producătorilor de echipamente.',
    directAnswer:
      'Mentenanța preventivă a clădirilor cuprinde totalitatea acțiunilor tehnice programate — inspecții vizuale, revizii periodice, calibrări, ungeri și înlocuiri preventive de consumabile — menite să mențină echipamentele în parametri optimi și să prevină avariile majore. Spre deosebire de intervențiile corective neplanificate, mentenanța preventivă prelungește durata de viață a instalațiilor, reduce semnificativ costurile totale de exploatare prin prevenirea avariilor majore și susține conformitatea cu normativele tehnice în vigoare.',
    sections: [
      {
        id: 'ce-este-mentenanta-preventiva',
        title: 'Ce Este Mentenanța Preventivă și Cum se Diferențiază de Intervenția la Avarie',
        content: [
          'În administrarea tradițională a imobilelor din România predomină modelul „reacției la avarie” (mentenanță reactivă): o instalație sau o piesă este reparată doar atunci când cedează, inundă subsolul sau lasă locatarii fără căldură în mijlocul iernii.',
          'Mentenanța preventivă (sau planificată) inversează această paradigmă: presupune executarea de inspecții regulate, testări funcționale și înlocuiri de componente consumabile conform unui calendar prestabilit, înainte ca defecțiunea să se producă.',
          'Din punct de vedere financiar, analiza costurilor pe durata de viață a clădirilor indică faptul că alocarea de resurse pentru un program riguros de mentenanță preventivă economisește sume considerabile cheltuite ulterior în intervenții de urgență, reparații capitale neprevăzute sau daune materiale provocate spațiilor private.',
        ],
      },
      {
        id: 'instalatii-critice-in-cladire',
        title: 'Instalațiile Critice dintr-o Clădire și Riscurile Asociate',
        content: [
          'Un plan de mentenanță preventivă vizează cu prioritate subsistemele a căror cedare periclitează siguranța sau confortul vital al ocupanților:',
          '1. Instalațiile de ridicat (ascensoare și platforme pentru persoane): necesită revizii lunare obligatorii și inspecții periodice ISCIR.',
          '2. Grupurile de pompare și hidroforul: pompe de apă rece menajeră, pompe de incendiu și bazine de retenție a apei potabile.',
          '3. Centralele termice și schimbătoarele de căldură: cazane, arzătoare pe gaz, vase de expansiune și circuite secundare de distribuție.',
          '4. Instalația electrică generală și tablourile de distribuție: verificări termografice ale conexiunilor și măsurători PRAM pentru împământare.',
          '5. Sistemele de securitate la incendiu: hidranți interiori/exteriori, detectoare de fum, trape de desfumare și iluminat de siguranță.',
          '6. Acoperișul, terasele și hidroizolațiile: curățarea sifoanelor pluviale și verificarea etanșeității membranelor bituminoase.',
        ],
      },
      {
        id: 'crearea-graficului-anual-de-revizii',
        title: 'Cum se Structurează un Grafic Anual de Revizii Tehnice',
        content: [
          'Graficul de mentenanță preventivă se organizează pe paliere de frecvență bine definite:',
          '• Zilnic / Săptămânal: inspecții vizuale rapide (presiuni în instalația sanitară, verificare funcționare iluminat comun, absență miros de gaz).',
          '• Lunar: revizia tehnică autorizată a ascensorului, verificarea funcționării pompelor de rezervă, testarea generatorului de avarie.',
          '• Trimestrial: curățarea filtrelor de aer și apă, gresarea lagărelor, testarea bateriilor sistemelor de alarmă la incendiu.',
          '• Semestrial: comutarea regimurilor de funcționare vară/iarnă, verificarea vanelor de izolare din subsol, verificarea etanșeității coloanelor de gaz.',
          '• Anual: verificarea metrologică a contoarelor de branșament, revizia tehnică ISCIR la centralele termice, buletinele de verificare PRAM.',
        ],
      },
      {
        id: 'tabel-comparativ-preventiv-vs-reactiv',
        title: 'Comparație Economică: Mentenanță Preventivă vs. Mentenanță Reactivă',
        content: [
          'Tabelul următor reflectă impactul operațional și financiar al celor două strategii pe durata unui ciclu de exploatare de 5 ani:',
        ],
      },
      {
        id: 'cerinte-legale-si-autorizari',
        title: 'Cadrul Legal Obligatoriu pentru Instalațiile Tehnice din România',
        content: [
          'Proprietarii și administratorii au obligații legale stricte prevăzute de legislația națională:',
          '• Legea nr. 64/2008 privind funcționarea în condiții de siguranță a instalațiilor sub presiune și a instalațiilor de ridicat: impune contractarea unui operator autorizat RSVTI și a unor companii licențiate ISCIR pentru ascensoare și cazane.',
          '• Normativul I7/2011 privind proiectarea și executarea instalațiilor electrice: impune verificarea periodică anuală a prizelor de pământ (buletine PRAM).',
          '• Legea nr. 307/2006 privind apărarea împotriva incendiilor: impune verificarea semestrială a rețelelor de hidranți și a stingătoarelor de incendiu.',
          'Neîndeplinirea acestor revizii obligatorii atrage amenzi substanțiale din partea autorităților de control și poate duce la refuzul companiilor de asigurări de a despăgubi daunele în caz de sinistru.',
        ],
      },
      {
        id: 'erori-frecvente-in-gestiunea-mentenantei',
        title: 'Erori Frecvente în Managementul Mentenanței',
        content: [
          'Principalele capcane întâlnite în administrarea tehnică:',
          '• Amânarea reviziei din motive de economii pe termen scurt, generând costuri considerabil mai mari la remedierea ulterioară a avariilor.',
          '• Semnarea formală a proceselor-verbale de revizie fără verificarea efectivă a parametrilor pe teren.',
          '• Lipsa unui registru centralizat de echipamente, ducând la pierderea certificatelor de garanție ale echipamentelor noi.',
          '• Încredințarea intervențiilor unor persoane neautorizate (meșteri de ocazie) în locul companiilor licențiate.',
        ],
      },
      {
        id: 'ce-trebuie-verificat-la-receptie',
        title: 'Checklist pentru Recepția Lucrărilor de Mentenanță Preventivă',
        content: [
          'La finalizarea fiecărei revizii planificate, persoana responsabilă de imobil trebuie să verifice:',
          '1. Existența fișei de service completate și semnate de tehnicianul autorizat al prestatorului.',
          '2. Consemnarea parametrilor măsurați (presiuni, tensiuni electrice, temperaturi de lucru, rezistențe de dispersie).',
          '3. Înregistrarea pieselor și consumabilelor înlocuite (filtre, garnituri, siguranțe, uleiuri).',
          '4. Actualizarea fișei activului în registrul digital de echipamente al clădirii.',
          '5. Efectuarea unei probe de funcționare asistată înainte de părăsirea amplasamentului de către echipa tehnică.',
        ],
      },
      {
        id: 'concluzii',
        title: 'Concluzii: Mentenanța Preventivă ca Garanție a Valorii Patrimoniului',
        content: [
          'Un plan de mentenanță preventivă bine articulat transformă clădirea dintr-o sursă perpetuă de urgențe într-un spațiu previzibil, confortabil și sigur pentru toți ocupanții săi.',
        ],
      },
    ],
    table: {
      caption: 'Analiză Comparativă: Mentenanță Preventivă Planificată vs. Mentenanță Reactivă',
      headers: ['Indicator de Performanță', 'Mentenanță Preventivă (Planificată)', 'Mentenanță Reactivă (La Avarie)'],
      rows: [
        ['Costuri directe totale', 'Previzibile, eșalonate conform bugetului aprobat', 'Imprevizibile, cu tarife substanțial mai mari pentru intervenții de urgență'],
        ['Durata de viață a echipamentelor', 'Optimizată pe întreaga durată de exploatare normată', 'Redusă prematur din cauza uzurii accentuate și a lipsei reviziilor la timp'],
        ['Timp de indisponibilitate a clădirii', 'Minim (intervenții programate în ore cu trafic scăzut)', 'Necesar mare (ore sau zile în așteptarea pieselor de schimb)'],
        ['Conformitate legală și siguranță', 'Completă (autorizații ISCIR și buletine PRAM la zi)', 'Expusă la sancțiuni contravenționale și riscuri tehnice'],
        ['Relația cu ocupanții și rezidenții', 'Grad ridicat de satisfacție și încredere în administrație', 'Frustrare cronică cauzată de întreruperi recurente ale utilităților'],
      ],
    },
    faqs: [
      {
        q: 'Cum se reflectă costul mentenanței preventive în lista de plată a asociației?',
        a: 'Contractele de mentenanță periodică (abonamentele de service) fac parte din cheltuielile comune de administrare și se repartizează lunar tuturor proprietarilor proporțional cu cota-parte indiviză de proprietate, conform Art. 85 din Legea 196/2018.',
      },
      {
        q: 'Cine răspunde dacă o centrală termică neautorizată ISCIR explodează într-un bloc?',
        a: 'Răspunderea revine deținătorului imobilului sau entității care administrează echipamentele, în colaborare cu personalul tehnic autorizat (cum ar fi operatorul RSVTI). Funcționarea echipamentelor fără autorizare valabilă sau neefectuarea verificărilor tehnice periodice obligatorii atrage sancțiuni contravenționale severe conform Legii nr. 64/2008, oprirea echipamentului din exploatare și răspundere legală agravată în cazul producerii de avarii sau accidente.',
      },
      {
        q: 'Poate o asociație de proprietari să efectueze reviziile cu personal propriu?',
        a: 'Doar dacă personalul respectiv deține atestatele și autorizațiile tehnice cerute de lege (de exemplu: electrician autorizat ANRE pentru tablouri electrice, tehnician autorizat ISCIR pentru ascensoare). În caz contrar, reviziile trebuie contractate obligatoriu cu societăți autorizate.',
      },
    ],
    legalSources: [
      {
        title: 'Legea nr. 64/2008 privind funcționarea instalațiilor sub presiune și de ridicat',
        reference: 'Prescripțiile tehnice ISCIR PT R1 și PT C9',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/89531',
      },
      {
        title: 'Legea nr. 307/2006 privind apărarea împotriva incendiilor',
        reference: 'Obligațiile administratorului de imobil privind instalațiile de securitate',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/73528',
      },
    ],
    bridge: {
      title: 'Modulul de Operațiuni Tehnice CLADORA',
      description:
        'Află cum arhitectura de operațiuni CLADORA este proiectată să susțină evidența reviziilor tehnice și planificarea structurată a mentenanței preventive.',
      buttonText: 'Explorează Modulul Operations',
      href: '/ro/operations',
    },
    relatedGuides: [
      {
        title: 'Gestionarea Intervențiilor Tehnice în Clădiri: De la Tichet la Ordinul de Lucru',
        slug: 'gestionare-interventii-tehnice-cladiri',
        lang: 'ro',
      },
      {
        title: 'Registrul Tehnic de Echipamente și Revizii în Clădiri: Fișa Activului și ISCIR',
        slug: 'registru-echipamente-revizii',
        lang: 'ro',
      },
      {
        title: 'Managementul Documentelor în Administrarea Proprietăților',
        slug: 'management-documente-proprietati',
        lang: 'ro',
      },
    ],
  },

  // 2. GESTIONARE-INTERVENTII-TEHNICE-CLADIRI
  'gestionare-interventii-tehnice-cladiri': {
    id: 'CLUSTER-B-02',
    lang: 'ro',
    slug: 'gestionare-interventii-tehnice-cladiri',
    contentApplicability: { kind: 'country', countryCode: 'RO' },
    title: 'Gestionarea Intervențiilor Tehnice în Clădiri: De la Tichetul de Avarie la Ordinul de Lucru Verificat',
    seoTitle: 'Gestionare Intervenții Tehnice Clădiri: Tichete & SLA',
    description:
      'Organizarea intervențiilor tehnice în clădiri: de la sesizarea locatarilor la comanda de lucru, prioritizarea avariilor și recepția cu confirmare de execuție.',
    category: 'Mentenanță & Operațiuni Tehnice',
    clusterId: 'cluster-b-operations',
    primaryQuery: 'gestionare intervenții tehnice clădiri',
    supportingQueries: [
      'sistem ticketing mentenanță',
      'ordine de lucru mentenanță',
      'triage avarii bloc',
      'flux gestionare intervenții tehnice'
    ],
    searchIntent: 'informational',
    publicationDate: '2026-10-15',
    datePublished: '2026-10-15',
    dateModified: '2026-10-15',
    author: 'Echipa de Cercetare & Arhitectură CLADORA',
    authorName: 'Echipa de Cercetare & Arhitectură CLADORA',
    authorUrl: '/ro/resources/autori/cladora-research',
    reviewedBy: 'Echipa Editorială & de Cercetare CLADORA',
    schemaType: 'Article',
    readTime: '12 min citire',
    pillarHref: '/ro/operations',
    disclaimer:
      'Materialul descrie fluxurile operaționale și standardele profesionale de dispecerizare a intervențiilor tehnice în condominii și clădiri de birouri. Nu reprezintă o garanție comercială privind timpii de intervenție contractuali ai prestatorilor externi.',
    directAnswer:
      'Gestionarea intervențiilor tehnice în clădiri este fluxul operațional prin care incidentele semnalate de rezidenți, administratori sau personalul tehnic sunt recepționate, clasificate după gravitate (triage), transformate în comenzi de lucru formale și soluționate de tehnicieni calificați. Un sistem structurat de intervenții elimină comunicarea haotică pe canale neauditate, impune timpi maximi de răspuns (SLA) și condiționează decontarea costurilor de existența unui proces-verbal de recepție cu dovezi fotografice.',
    sections: [
      {
        id: 'problema-comunicarii-fragmentate',
        title: 'Criza Comunicării Fragmentate în Rezolvarea Avariilor',
        content: [
          'În majoritatea clădirilor din România, raportarea unei probleme tehnice (o țeavă spartă în subsol, un lift blocat, o poartă de garaj defectă) urmează căi complet haotice:',
          'Locatarii sună administratorul la ore nepotrivite, trimit mesaje vocale pe grupuri informale de WhatsApp sau lasă bilețele lipite pe ușa administrației.',
          'Consecințele sunt dezastruoase: informațiile esențiale se pierd, nu există o evidență clară a priorităților, tehnicienii intervin fără un mandat precis privind costurile maxime aprobate, iar la final nimeni nu poate dovedi cine a aprobat lucrarea și dacă piesele menționate pe factură au fost într-adevăr înlocuite.',
        ],
      },
      {
        id: 'cele-4-etape-ale-fluxului-de-interventie',
        title: 'Cele 4 Etape ale Fluxului Standardizat de Intervenție',
        content: [
          'Un proces operațional matur transformă incidentul într-un flux de lucru digital trasabil în 4 pași:',
          'Etapa 1: Raportarea incidentului (Ticket Intake) — consemnarea datei, orei, amplasamentului exact (scară, etaj, echipament), descrierii defecțiunii și încărcarea obligatorie a cel puțin unei fotografii doveditoare.',
          'Etapa 2: Triage-ul operațional și aprobarea — administratorul sau dispecerul evaluează urgența, verifică dacă este vorba despre o proprietate comună sau o reparație privată și aprobă un plafon maxim de buget.',
          'Etapa 3: Emiterea Ordinului de Lucru (Work Order Dispatch) — generarea unei comenzi formale către prestatorul de service sau tehnicianul de tură, cu specificarea termenului maxim de remediere (SLA) și a instrucțiunilor de acces în clădire.',
          'Etapa 4: Execuția, recepția și decontarea — tehnicianul încarcă fotografiile cu remedierea efectuată, consemnează orele lucrate și piesele utilizate, iar reprezentantul asociației semnează recepția înainte de transmiterea facturii către plată.',
        ],
      },
      {
        id: 'matricea-de-prioritizare-si-sla',
        title: 'Matricea de Prioritizare a Incidentelor și Nivelurile SLA',
        content: [
          'Pentru a preveni tratarea egală a unei avarii majore de inundație cu un bec ars pe casa scării, incidentele se clasifică în 3 niveluri de prioritate:',
          '• Prioritate P1 (Critic / Urgență de Securitate): Incidente care periclitează viața, integritatea fizică a clădirii sau opresc utilitățile vitale (inundații masive, miros de gaz, incendiu, persoane blocate în lift). Timp de răspuns impus: sub 2 ore.',
          '• Prioritate P2 (Major / Afectare Funcțională): Defecțiuni care afectează confortul comun, dar fără risc iminent (lift oprit pe un tronson cu două ascensoare, interfon nefuncțional, hidrofor cu presiune scăzută). Timp de remediere: maximum 24 de ore.',
          '• Prioritate P3 (Normal / Rutină de Întreținere): Lucrări estetice sau remedieri planificate (reparații locale, înlocuire corpuri de iluminat, ajustare amortizoare uși), programate în funcție de orarul tehnic aprobat.',
        ],
      },
      {
        id: 'tabel-matrice-triage',
        title: 'Tabel: Matricea de Triage și Alocare a Responsabilităților',
        content: [
          'Tabelul de mai jos ilustrează aplicarea matricei de triage pe scenarii concrete din viața unui condominiu:',
        ],
      },
      {
        id: 'ordinul-de-lucru-ca-act-juridic',
        title: 'Ordinul de Lucru: Documentul care Protejează Asociația de Supracosturi',
        content: [
          'O comandă de lucru transmisă verbal este o invitație la litigii și facturi umflate. Un Ordin de Lucru (Work Order) complet trebuie să stipuleze contractual:',
          '1. Numărul unic de identificare legat de tichetul inițial de incident.',
          '2. Descrierea detaliată a sarcinii tehnice și a pieselor autorizate pentru înlocuire.',
          '3. Plafonul financiar maxim aprobat de comitet fără acord prealabil suplimentar.',
          '4. Obligația atașării raportului de service și a dovezilor foto „Înainte / După”.',
          '5. Clauza de garanție a lucrării (minimum 3 luni pentru manoperă și garanția legală a pieselor noi).',
        ],
      },
      {
        id: 'erori-frecvente-in-gestiunea-avariilor',
        title: 'Erori Frecvente în Gestionarea Reclamațiilor și Avariilor',
        content: [
          'Cele mai costisitoare greșeli operaționale includ:',
          '• Decontarea facturilor de reparații fără un proces-verbal de recepție semnat de administrator sau cenzor.',
          '• Lipsa de comunicare a stadiului către proprietarul care a semnalat problema, generând apeluri repetate și frustrare.',
          '• Intervenția asociației pe proprietăți private pe banii blocului, fără recuperarea ulterioară a costurilor de la proprietarul vinovat.',
          '• Lipsa arhivării istoricului de reparații pe fișa echipamentului, plătindu-se aceeași piesă defectată repetat în perioada de garanție.',
        ],
      },
      {
        id: 'ce-trebuie-verificat-la-inchiderea-tichetului',
        title: 'Checklist pentru Închiderea și Arhivarea Tichetului Tehnic',
        content: [
          'Înainte de a declara un tichet de intervenție rezolvat și de a autoriza plata:',
          '1. Comparați fotografiile dinainte de intervenție cu cele realizate după finalizarea lucrării.',
          '2. Verificați concordanța dintre numărul de ore facturate și timpul efectiv petrecut de echipă la fața locului.',
          '3. Confirmați cu proprietarul afectat sau cu vecinii din zonă că anomalia a dispărut complet.',
          '4. Arhivați factura, chitanța/OP-ul și devizul de lucrări în dosarul digital al lunii respective.',
        ],
      },
      {
        id: 'concluzii',
        title: 'Concluzii: Rigoarea Operațională Reduce Costurile și Tensiunile din Imobil',
        content: [
          'Trecerea la un sistem structurat de ticketing și gestionare a intervențiilor tehnice oferă liniște comitetului executiv, reduce facturile nejustificate ale prestatorilor și demonstrează proprietarilor că fondurile lor sunt cheltuite cu maximă responsabilitate.',
        ],
      },
    ],
    table: {
      caption: 'Matrice de Triage Operațional pentru Incidentele din Condominii',
      headers: ['Tip Incident Tehnic', 'Nivel Prioritate', 'Timp Răspuns (SLA)', 'Cine Intervine', 'Dovezi Obligatorii'],
      rows: [
        ['Ruptură coloană apă potabilă subsol', 'P1 (Critic)', 'Sub 2 ore', 'Instalator de urgență / Firma de mentenanță', 'Foto înainte/după + proces-verbal oprire apă'],
        ['Persoană blocată în ascensor', 'P1 (Critic)', 'Sub 45 minute', 'Firma licențiată de service ascensor', 'Fișă de deblocare semnată de pasager'],
        ['Defecțiune barieră acces parcare', 'P2 (Major)', 'Sub 24 ore', 'Firma de automatizări porți', 'Raport tehnic diagnoză + test funcțional'],
        ['Zgomot suspect la grupul de pompare', 'P2 (Major)', 'Sub 24 ore', 'Tehnician mentenanță instalații sanitare', 'Măsurători presiune + verificare lagăre'],
        ['Corp de iluminat ars pe casa scării', 'P3 (Normal)', 'Conform planificării curente', 'Personal de întreținere curentă', 'Confirmare vizuală schimbare tub LED'],
        ['Reglare arc amortizor ușă intrare', 'P3 (Normal)', 'Conform planificării curente', 'Administrator / Tehnician intern', 'Test închidere silențioasă amortizată'],
      ],
    },
    faqs: [
      {
        q: 'Cine plătește reparația dacă o țeavă din apartamentul unui vecin inundă tavanul altui proprietar?',
        a: 'Dacă ruptura s-a produs pe o conductă comună (coloană verticală sau până la primul robinet de separare), costul este suportat de asociația de proprietari din fondurile comune. Dacă avaria s-a produs pe instalația privată interioară a apartamentului, răspunderea civilă și costul reparației revin exclusiv proprietarului de la care provine scurgerea.',
      },
      {
        q: 'Are voie administratorul să aprobe o reparație urgentă fără acordul președintelui?',
        a: 'În cazuri de forță majoră sau avarii iminente (P1) care amenință integritatea clădirii, administratorul are obligația legală de a lua măsuri imediate pentru limitarea pagubelor, urmând să informeze de îndată președintele și comitetul executiv.',
      },
      {
        q: 'Cum pot urmări proprietarii dacă sesizarea lor a fost preluată?',
        a: 'Printr-o platformă digitală dedicată, proprietarul poate urmări transparent stadiul sesizării (înregistrare, alocare către echipa tehnică și recepție confirmată la remediere).',
      },
    ],
    legalSources: [
      {
        title: 'Legea nr. 196/2018 privind asociațiile de proprietari',
        reference: 'Art. 66 (Atribuțiile administratorului privind reparațiile și intervențiile urgente)',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/305357',
      },
      {
        title: 'Codul Civil Român',
        reference: 'Art. 1357 și următoarele (Răspunderea civilă delictuală pentru prejudicii aduse terților)',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/170664',
      },
    ],
    bridge: {
      title: 'Dispecerat Digital de Intervenții cu CLADORA',
      description:
        'Vezi cum arhitectura CLADORA este proiectată să conecteze sesizările cu comenzile de lucru și aprobările comitetului executiv într-un flux structurat.',
      buttonText: 'Află Mai Multe despre Modulul Operations',
      href: '/ro/operations',
    },
    relatedGuides: [
      {
        title: 'Planul de Mentenanță Preventivă a Clădirilor: Grafice și Standarde',
        slug: 'mentenanta-preventiva-cladiri',
        lang: 'ro',
      },
      {
        title: 'Registrul Tehnic de Echipamente și Revizii în Clădiri: Fișa Activului și ISCIR',
        slug: 'registru-echipamente-revizii',
        lang: 'ro',
      },
      {
        title: 'Managementul Documentelor în Administrarea Proprietăților',
        slug: 'management-documente-proprietati',
        lang: 'ro',
      },
    ],
  },

  // 3. REGISTRU-ECHIPAMENTE-REVIZII
  'registru-echipamente-revizii': {
    id: 'CLUSTER-B-03',
    lang: 'ro',
    slug: 'registru-echipamente-revizii',
    contentApplicability: { kind: 'country', countryCode: 'RO' },
    title: 'Registrul Tehnic de Echipamente și Revizii în Clădiri: Fișa Activului, Garanții și Conformitate ISCIR',
    seoTitle: 'Registru Echipamente și Revizii Clădiri: Ghid Tehnic',
    description:
      'Ghid pentru registrul tehnic de echipamente din clădiri: identificarea activelor, urmărirea reviziilor ISCIR, garanțiile pieselor și conformitatea legală.',
    category: 'Mentenanță & Echipamente Tehnice',
    clusterId: 'cluster-b-operations',
    primaryQuery: 'registru echipamente revizii',
    supportingQueries: [
      'software mentenanță clădiri',
      'fișă tehnică echipament clădire',
      'evidență revizii iscir bloc',
      'registru active tehnice imobil'
    ],
    searchIntent: 'informational',
    publicationDate: '2026-10-15',
    datePublished: '2026-10-15',
    dateModified: '2026-10-15',
    author: 'Echipa de Cercetare & Arhitectură CLADORA',
    authorName: 'Echipa de Cercetare & Arhitectură CLADORA',
    authorUrl: '/ro/resources/autori/cladora-research',
    reviewedBy: 'Echipa Editorială & de Cercetare CLADORA',
    schemaType: 'Article',
    readTime: '12 min citire',
    pillarHref: '/ro/operations',
    disclaimer:
      'Ghidul prezintă structura de date și cerințele metodologice pentru inventarierea și urmărirea echipamentelor tehnice dintr-o proprietate imobiliară. Nu înlocuiește prescripțiile tehnice de securitate stabilite de inspecțiile de stat (ISCIR, ISU, ANRE).',
    directAnswer:
      'Registrul de echipamente și revizii este inventarul tehnic centralizat care consemnează identitatea, caracteristicile constructive, amplasamentul, garanțiile și istoricul complet de intervenții pentru toate activele fizice dintr-o clădire. În conformitate cu normativele tehnice românești (inclusiv prescripțiile ISCIR și normele de securitate la incendiu), registrul atestă starea de funcționare a instalațiilor și previne pierderea garanțiilor sau operarea nesigură a utilajelor comune.',
    sections: [
      {
        id: 'necesitatea-unui-registru-tehnic',
        title: 'De la Hârtiile Rătăcite din Subsol la Registrul Digital de Echipamente',
        content: [
          'În majoritatea blocurilor vechi și chiar în multe ansambluri rezidențiale noi, informațiile despre echipamentele tehnice sunt inexistente sau dispersate:',
          'Facturile de cumpărare se află într-un dosar la contabilitate, manualele de utilizare s-au pierdut la predarea de la dezvoltator, iar datele despre data ultimei schimbări a rulmenților pompei de recirculare există doar în memoria instalatorului de cartier.',
          'Când acel tehnician pleacă sau când asociația schimbă firma de administrare, întreaga memorie tehnică a clădirii se prăbușește. Nimeni nu mai știe ce piese sunt în garanție, când expiră autorizația ISCIR la lift sau ce debit nominal are hidroforul.',
          'Registrul digital de echipamente rezolvă această problemă: fiecare utilaj din clădire primește o fișă de identitate digitală unică și permanentă.',
        ],
      },
      {
        id: 'ce-echipamente-se-inregistreaza',
        title: 'Ce Echipamente Tehnice Trebuie Înregistrate Obligatoriu',
        content: [
          'Un registru tehnic complet acoperă toate instalațiile comune din condominiu:',
          '1. Ascensoare de persoane și marfă: număr de fabricație, sarcină utilă, producător, data punerii în funcțiune, data expirării autorizației ISCIR.',
          '2. Instalații sanitare și de pompare: grupuri de hidrofor, pompe submersibile din căminele de colectare, vase de expansiune, vane automate.',
          '3. Instalații termice și de ventilație: cazane de încălzire, schimbătoare de căldură, exhaustoare de noxe din parcări subterane, perdele de aer cald.',
          '4. Instalații electrice: tablou general de distribuție (TGDF), baterii automate de condensatori, generator diesel de intervenție, UPS-uri.',
          '5. Instalații de securitate și acces: centrale de detecție incendiu, uși rezistente la foc, motoare de porți culisante, bariere de acces parcare.',
        ],
      },
      {
        id: 'anatomia-unei-fise-de-echipament',
        title: 'Anatomia unei Fișe Tehnice de Activ (Asset Logbook)',
        content: [
          'Pentru a avea valoare probatorie și operațională, fiecare fișă de echipament conține următoarele secțiuni de date:',
          '• Date de bază: Denumire activ, cod intern unic, categorie funcțională, locație exactă (ex: Subsol tehnic 2, Corp A).',
          '• Metadate constructive: Producător, model, număr de serie (serial number), an de fabricație, parametri nominali (putere kW, debit m³/h, tensiune V).',
          '• Statut contractual: Număr contract de mentenanță asociat, date de contact ale firmei de service, dată expirare garanție.',
          '• Istoric de intervenții: Jurnalul complet al tuturor reviziilor, pieselor înlocuite, ordinelor de lucru asociate și rapoartelor de service scanate.',
          '• Documentație anexată: Manualul tehnic în format PDF, schema electrică, autorizația de funcționare și declarația de conformitate CE.',
        ],
      },
      {
        id: 'tabel-exemplu-registru-echipamente',
        title: 'Exemplu Practic de Registru Tehnic al Clădirii',
        content: [
          'Tabelul de mai jos ilustrează modul de structurare a registrului pentru principalele echipamente comune ale unui imobil rezidențial:',
        ],
      },
      {
        id: 'conformitatea-cu-legislatia-si-iscir',
        title: 'Conformitatea cu Normativele ISCIR și Legislația Națională',
        content: [
          'Legislația din România impune cerințe severe pentru echipamentele din categoria celor cu risc deosebit în exploatare:',
          '• Legea nr. 64/2008: Obligă asociațiile de proprietari care dețin ascensoare sau centrale termice să desemneze un operator RSVTI (Responsabil cu Supravegherea și Verificarea Tehnică a Instalațiilor) atestat de ISCIR.',
          '• Prescripția Tehnică ISCIR PT R1: Prevede că revizia tehnică periodică la ascensoare se efectuează la intervale de maximum 2 ani de către inspectori autorizați, pe baza unui jurnal de service semnat lunar de firma de întreținere.',
          'Lipsa unui registru tehnic la zi în care să fie arhivate dovezile acestor verificări poate atrage oprirea din funcționare a echipamentului de către inspectori și aplicarea de sancțiuni contravenționale conform legislației specifice.',
        ],
      },
      {
        id: 'erori-frecvente-in-urmarirea-echipamentelor',
        title: 'Erori Frecvente în Gestiunea Activelor Tehnice',
        content: [
          'Printre deficiențele majore întâlnite în practică:',
          '• Pierderea certificatelor de garanție ale pompelor sau motoarelor noi, suportându-se din fondurile asociației reparații care ar fi fost acoperite de garanție.',
          '• Neconsemnarea orelor de funcționare ale generatoarelor sau compresoarelor, ducând la griparea utilajelor din lipsă de ulei.',
          '• Absența unui istoric al pieselor schimbate: plata repetată a aceleiași piese către prestatori fără a verifica dacă piesa anterioară se afla în garanția legală de conformitate.',
          '• Lipsa fotografiilor de pe plăcuțele de identificare ale utilajelor vechi, îngreunând comandarea pieselor de schimb compatibile.',
        ],
      },
      {
        id: 'ce-trebuie-verificat-la-predarea-unui-imobil',
        title: 'Checklist pentru Preluarea Echipamentelor de la Dezvoltator sau Fosta Administrație',
        content: [
          'La preluarea gestiunii unui imobil, comitetul și administratorul trebuie să verifice:',
          '1. Existența cărții tehnice a fiecărui utilaj și a declarațiilor de conformitate CE eliberate de producători.',
          '2. Procesele-verbale de probe în sarcină și de punere în funcțiune pentru centrale, pompe și ventilații.',
          '3. Autorizațiile de funcționare ISCIR valabile pentru toate ascensoarele din imobil.',
          '4. Certificatele de garanție în original și datele de expirare consemnate în procesul-verbal de predare-primire.',
          '5. Setul complet de chei de acces în tablourile electrice, stațiile de pompare și camerele tehnice ale utilajelor.',
        ],
      },
      {
        id: 'concluzii',
        title: 'Concluzii: Registrul Digital ca Barometru al Stării Patrimoniului',
        content: [
          'O clădire bine administrată are întotdeauna un registru tehnic impecabil. În momentul vânzării sau evaluării imobilului, istoricul verificabil al echipamentelor sale atestă seriozitatea asociației și sporește valoarea de piață a fiecărui apartament în parte.',
        ],
      },
    ],
    table: {
      caption: 'Model de Registru Tehnic Digital pentru Clădiri Rezidențiale și Mixte',
      headers: ['Cod Activ', 'Denumire Echipament & Model', 'Locație în Imobil', 'Serie Producător', 'Frecvență Revizie Legală', 'Status Autorizare / Garanție'],
      rows: [
        ['EQ-LIFT-01', 'Ascensor 8 persoane / Schindler 3300', 'Casa scării tronson A', 'CH-849204-2021', 'Lunar (Service) / 2 ani (ISCIR)', 'Autorizat ISCIR până la 14.08.2027'],
        ['EQ-PUMP-01', 'Grup hidrofor 3 pompe / Grundfos Hydro MPC', 'Subsol tehnic corp comun', 'GF-9842109-2022', 'Trimestrial', 'Garanție activă până la 10.11.2026'],
        ['EQ-HVAC-01', 'Centrală termică în condensație / Viessmann 200 kW', 'Centrală termică etaj tehnic', 'VS-7492019-2020', 'Anual (ISCIR)', 'Autorizat ISCIR până la 20.09.2026'],
        ['EQ-FIRE-01', 'Pompă de incendiu cu motor diesel / Wilo IL', 'Stație pompare incendiu S2', 'WL-5830219-2021', 'Semestrial', 'Verificare hidranți conformă ISU'],
        ['EQ-GATE-01', 'Motor barieră acces parcare / BFT Moovi 30', 'Rampa acces garaj exterior', 'BF-204918-2023', 'Semestrial', 'Garanție activă până la 15.03.2027'],
      ],
    },
    faqs: [
      {
        q: 'Unde trebuie păstrate fizic actele echipamentelor conform legii?',
        a: 'Actele originale ale echipamentelor (manuale, scheme tehnice, autorizații ISCIR) fac parte din Cartea Tehnică a Construcției și trebuie păstrate în siguranță la sediul asociației de proprietari sau în arhiva tehnică a imobilului, fiind accesibile organelor de control.',
      },
      {
        q: 'Cine are dreptul să solicite consultarea registrului de echipamente?',
        a: 'Orice proprietar membru al asociației are dreptul legal de a consulta registrul tehnic și dosarele de revizii ale proprietății comune, conform Art. 28 din Legea nr. 196/2018.',
      },
      {
        q: 'Dacă un utilaj nu mai are plăcuța de identificare, cum se înregistrează în sistem?',
        a: 'În registrul tehnic se consemnează lipsa seriei vizibile și se atașează fotografii de detaliu, caracteristicile constructive măsurate și copia facturii de achiziție, urmând ca la prima revizie tehnicianul autorizat să identifice modelul exact.',
      },
    ],
    legalSources: [
      {
        title: 'Legea nr. 64/2008 privind instalațiile sub presiune și de ridicat',
        reference: 'Obligațiile deținătorilor de instalații tehnice supuse regimului ISCIR',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/89531',
      },
      {
        title: 'H.G. nr. 273/1994 privind aprobarea Regulamentului de recepție a lucrărilor de construcții',
        reference: 'Componența Cărții Tehnice a Construcției și predarea utilajelor',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/4442',
      },
    ],
    bridge: {
      title: 'Registru Digital de Echipamente cu CLADORA',
      description:
        'Vezi cum este proiectată arhitectura de date CLADORA pentru a structura activele fizice, a asista urmărirea reviziilor tehnice și a păstra istoricul intervențiilor.',
      buttonText: 'Descoperă Modulul Operations',
      href: '/ro/operations',
    },
    relatedGuides: [
      {
        title: 'Planul de Mentenanță Preventivă a Clădirilor: Grafice și Standarde',
        slug: 'mentenanta-preventiva-cladiri',
        lang: 'ro',
      },
      {
        title: 'Gestionarea Intervențiilor Tehnice în Clădiri: De la Tichet la Ordinul de Lucru',
        slug: 'gestionare-interventii-tehnice-cladiri',
        lang: 'ro',
      },
      {
        title: 'Managementul Documentelor în Administrarea Proprietăților',
        slug: 'management-documente-proprietati',
        lang: 'ro',
      },
    ],
  },
};
