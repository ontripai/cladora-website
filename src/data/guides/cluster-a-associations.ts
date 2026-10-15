import { GuideArticleData } from './types';

export const CLUSTER_A_ARTICLES: Record<string, GuideArticleData> = {
  // 1. ASOCIATII-PROPRIETARI-LEGEA-196-2018 (Original Approved Baseline)
  'asociatii-proprietari-legea-196-2018': {
    id: 'TOPIC-02',
    lang: 'ro',
    slug: 'asociatii-proprietari-legea-196-2018',
    title: 'Ghid Practic pentru Asociațiile de Proprietari: Context Operațional Legea 196/2018',
    seoTitle: 'Ghid Legea 196/2018: Asociații de Proprietari în Bloc',
    description:
      'Ghid explicativ privind funcționarea asociațiilor de proprietari conform Legii 196/2018: drepturi, atribuțiile comitetului executiv și repartizarea cotelor.',
    category: 'Administrare Asociații de Proprietari',
    clusterId: 'cluster-a-associations',
    primaryQuery: 'asociatii proprietari legea 196 2018',
    supportingQueries: [
      'legislatie asociatii de proprietari',
      'ghid legea 196 2018 asociatii',
      'atributii administrator bloc legea 196',
      'drepturi proprietari condominiu'
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
    readTime: '11 min citire',
    pillarHref: '/ro/solutions/associations',
    disclaimer:
      'Materialul are caracter informativ și operațional și nu înlocuiește consultanța juridică, contabilă sau fiscală adaptată situației concrete a unei asociații de proprietari. CLADORA oferă suport tehnologic pentru fluxuri operaționale, fără a furniza certificări juridice sau consultanță de specialitate.',
    directAnswer:
      'Legea nr. 196/2018 privind înființarea, organizarea și funcționarea asociațiilor de proprietari și administrarea condominiilor stabilește cadrul legal obligatoriu pentru clădirile rezidențiale și mixte din România. Din perspectivă operațională, legea delimitează rolurile de guvernanță (Adunare Generală, Comitet Executiv, Președinte, Cenzor, Administrator), impune criterii stricte de repartizare a facturilor pe consumuri, persoane și cotă-parte indiviză și reglementează funcționarea fondurilor de reparații și de rulment.',
    sections: [
      {
        id: 'cadrul-legal-general',
        title: 'Cadrul General al Legii nr. 196/2018 și Conceptele Cheie',
        content: [
          'Adoptată pentru a aduce transparență, rigoare financiară și responsabilitate juridică în administrarea blocurilor și ansamblurilor rezidențiale, Legea nr. 196/2018 reglementează regimul juridic al condominiilor din România.',
          'Din punct de vedere tehnic, legea definește condominiul ca fiind imobilul format din proprietăți individuale (apartamente sau spații cu altă destinație) și proprietăți comune indivizibile (structură de rezistență, fațade, acoperiș, casa scării, subsol, instalații sanitare și termice comune).',
          'Asociația de proprietari este forma juridică de organizare și reprezentare a intereselor tuturor coproprietarilor, având ca scop principal exploatarea, întreținerea, repararea și consolidarea proprietății comune.',
        ],
      },
      {
        id: 'structura-guvernanta',
        title: 'Structura de Guvernanță: Atribuții și Responsabilități',
        content: [
          'Legea 196/2018 instituie o distincție clară între competențele decizionale, executive și de control din cadrul asociației de proprietari:',
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
              'Reprezintă organul intern de control financiar-contabil. Verifică lunar legalitatea încasărilor și plăților, exactitatea calculului listelor de plată, reconcilierea contului bancar și respectarea prevederilor din bugetul aprobat. Cenzorul întocmește rapoarte de verificare pentru Adunarea Generală.',
            ],
          },
          {
            title: '4. Administratorul de Condominiu (Persoană Fizică sau Juridică)',
            content: [
              'Administratorul este mandatarul executiv contractat pentru gestiunea operațională și tehnică a clădirii. Conform legii, administratorul persoană fizică trebuie să dețină un atestat profesional eliberat de autoritatea administrației publice locale și un certificat de calificare. Administratorul calculează listele de întreținere, transmite comenzile de lucru către prestatori și întocmește registrele contabile în partidă simplă.',
            ],
          },
        ],
      },
      {
        id: 'categoriile-de-cheltuieli',
        title: 'Categoriile de Cheltuieli în Condominiu conform Legii 196/2018',
        content: [
          'Legea stabilește 6 categorii exprese de cheltuieli (Art. 75), fiecare având o cheie de repartizare obligatorie:',
          '1. Cheltuieli pe număr de persoane: servicii a căror utilizare este direct legată de numărul de ocupanți ai imobilului (energie electrică pentru spațiile comune și ascensoare, salubrizare, apă caldă și rece la paușal).',
          '2. Cheltuieli pe cotă-parte indiviză de proprietate: cheltuieli pentru întreținerea, repararea și administrarea părților comune (revizii ascensoare, curățenie, reparații de terasă, fațadă, instalații comune, onorarii personal, asigurări comune).',
          '3. Cheltuieli pe consumatori tehnici: costuri determinate de puterea instalată a echipamentelor comune sau de modificări aduse proprietăților individuale.',
          '4. Cheltuieli pe consumuri individuale: apă rece, apă caldă, gaze sau energie termică individualizate prin aparate de măsură omologate.',
          '5. Cheltuieli pe beneficiari: servicii solicitate individual sau de care beneficiază exclusiv un grup determinat de proprietari.',
          '6. Cheltuieli pentru fondurile asociației: fondul de rulment și fondul de reparații.',
        ],
      },
      {
        id: 'fondurile-obligatorii',
        title: 'Fondul de Rulment și Fondul de Reparații: Diferențe și Reguli',
        content: [
          'Legea 196/2018 impune obligativitatea constituirii a două fonduri financiare distincte, gestionate prin conturi bancare deschise pe numele asociației de proprietari:',
        ],
        subsections: [
          {
            title: 'Fondul de Rulment (Art. 72)',
            content: [
              'Are rolul de a asigura lichiditatea asociației pentru plata la timp a facturilor curente de utilități înainte de colectarea cotelor de la proprietari. Cuantumul său se determină pentru fiecare proprietar în parte, echivalent cu valoarea cheltuielilor maxime din luna de iarnă anterioară.',
              'Important: Fondul de rulment se restituie proprietarului în momentul înstrăinării apartamentului, după achitarea integrală a tuturor datoriilor restante către asociație.',
            ],
          },
          {
            title: 'Fondul de Reparații (Art. 71)',
            content: [
              'Este destinat exclusiv lucrărilor de reparație, consolidare, reabilitare termică și modernizare a proprietății comune. Se aprobă anual în Adunarea Generală și se calculează proporțional cu cota-parte indiviză de proprietate.',
              'Important: Sumele depuse în fondul de reparații nu se restituie la înstrăinarea proprietății, ci rămân atașate imobilului.',
            ],
          },
        ],
      },
      {
        id: 'transparenta-avizier',
        title: 'Transparența Financiară și Obligațiile de Afișare',
        content: [
          'Administratorul are obligația de a întocmi și afișa lista lunară de plată a cotelor de contribuție la avizierul asociației. Termenul legal pentru plata cotelor afișate este de maximum 30 de zile calendaristice de la data afișării, conform Art. 77 alin. (2) din Legea nr. 196/2018.',
          'Conform legii, penalitățile de întârziere se pot aplica numai după expirarea unui termen de grație de 30 de zile de la data scadenței și nu pot depăși 0,2% pentru fiecare zi de întârziere, valoarea totală a penalităților neputând depăși cuantumul debitului principal (Art. 77 alin. 1).',
          'Proprietarii au dreptul de a solicita explicații sau de a contesta calculul cotelor în scris către comitetul executiv. Depunerea unei contestații nu suspendă automat obligația de plată a cotelor afișate, eventualele erori constatate urmând a fi regularizate pe lista lunii următoare conform deciziei comitetului.',
        ],
      },
      {
        id: 'erori-frecvente',
        title: 'Erori Frecvente în Aplicarea Legii 196/2018',
        content: [
          'În practica administrării condominiilor apar recurent abateri metodologice care pot atrage contestarea deciziilor sau răspunderea administrativă a organelor de conducere:',
          '• Utilizarea fondului de reparații pentru achitarea facturilor curente de utilități (practică contrară destinației statutare a fondului).',
          '• Repartizarea cheltuielilor de curățenie sau a salariilor de administrare pe număr de persoane, în loc de cota-parte indiviză.',
          '• Aplicarea de penalități fără o hotărâre a Adunării Generale sau înainte de termenul legal de grație de 30 de zile.',
          '• Lipsa reconcilierii lunare între soldul din lista de plată și extrasul de cont bancar al asociației.',
        ],
      },
      {
        id: 'ce-trebuie-verificat',
        title: 'Ce Trebuie să Verifice Proprietarii și Cenzorii (Checklist)',
        content: [
          'Pentru o verificare eficientă a legalității operațiunilor dintr-o asociație de proprietari, se recomandă urmărirea următorului set de verificări:',
          '1. Existența deciziei Adunării Generale pentru nivelul fondului de reparații aprobat pe anul curent.',
          '2. Semnătura cenzorului pe lista lunară de plată înainte de afișarea acesteia la avizierul blocului.',
          '3. Corectitudinea suprafețelor utile și a cotelor-părți indivize utilizate în algoritmul de repartizare.',
          '4. Înregistrarea tuturor încasărilor în contul bancar dedicat al asociației, conform plafonului legal de casă.',
          '5. Respectarea termenelor de răspuns la sesizările și contestațiile scrise ale proprietarilor.',
        ],
      },
    ],
    table: {
      caption: 'Sinteza Rolurilor de Guvernanță conform Legii nr. 196/2018',
      headers: ['Organ / Rol', 'Tip Competență', 'Principalele Atribuții Legale', 'Răspundere'],
      rows: [
        ['Adunarea Generală', 'Decizională supremă', 'Aprobă bugetul (BVC), fondurile, alege/revocă comitetul și cenzorul', 'Colectivă (hotărâri opozabile tuturor)'],
        ['Președintele Asociației', 'Reprezentare legală', 'Reprezintă asociația, semnează contracte, convoacă adunarea', 'Personală și patrimonială'],
        ['Comitetul Executiv', 'Executivă colegială', 'Duconduce activitatea între adunări, avizează cheltuieli curente', 'Solidară pentru deciziile luate'],
        ['Cenzorul / Comisia', 'Control financiar', 'Verifică lunar registrele, balanța, listele și reconcilierea bancară', 'Profesională pentru rapoartele întocmite'],
        ['Administratorul', 'Gestiune operațională', 'Calculează listele de plată, gestionează reparațiile, ține evidența', 'Contractuală și materială'],
      ],
    },
    faqs: [
      {
        q: 'Este obligatorie deținerea unui atestat de administrator pentru a administra un bloc?',
        a: 'Da. Conform Legii nr. 196/2018, administratorul de condominiu persoană fizică trebuie să dețină un certificat de calificare profesională și un atestat eliberat de primarul unității administrativ-teritoriale unde se află imobilul.',
      },
      {
        q: 'Poate un proprietar să refuze plata fondului de reparații dacă nu este de acord cu lucrarea?',
        a: 'Nu. Dacă fondul de reparații a fost aprobat în mod legal prin hotărârea Adunării Generale a asociației de proprietari, plata cotei aferente este obligatorie pentru toți proprietarii din imobil.',
      },
      {
        q: 'Ce se întâmplă cu fondul de rulment dacă apartamentul se vinde?',
        a: 'Fondul de rulment se restituie proprietarului vânzător în baza unei cereri scrise, cu condiția ca acesta să fi achitat integral toate debitele curente și restante către asociația de proprietari.',
      },
    ],
    legalSources: [
      {
        title: 'Legea nr. 196/2018 privind înființarea, organizarea și funcționarea asociațiilor de proprietari',
        reference: 'Monitorul Oficial al României nr. 660 din 30 iulie 2018',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/305357',
      },
    ],
    bridge: {
      title: 'Soluția CLADORA pentru Asociații de Proprietari',
      description:
        'Află cum arhitectura CLADORA sprijină evidența financiară în partidă simplă și controlul analitic, respectând cerințele Legii 196/2018.',
      buttonText: 'Vezi Soluția pentru Asociații',
      href: '/ro/solutions/associations',
    },
    relatedGuides: [
      {
        title: 'Metodologia Repartizării Cheltuielilor în Asociațiile de Proprietari',
        slug: 'repartizare-cheltuieli-asociatie-proprietari',
        lang: 'ro',
      },
      {
        title: 'Program de Calcul Întreținere Bloc: Reguli Legale & Algoritmi Explicabili',
        slug: 'program-calcul-intretinere-bloc',
        lang: 'ro',
      },
    ],
  },

  // 2. REPARTIZARE-CHELTUIELI-ASOCIATIE-PROPRIETARI (Original Approved Baseline)
  'repartizare-cheltuieli-asociatie-proprietari': {
    id: 'TOPIC-04',
    lang: 'ro',
    slug: 'repartizare-cheltuieli-asociatie-proprietari',
    title: 'Metodologia Repartizării Cheltuielilor și Administrării Fondurilor în Asociațiile de Proprietari',
    seoTitle: 'Repartizare Cheltuieli în Asociații de Proprietari',
    description:
      'Criteriile legale de repartizare a cheltuielilor în asociații conform Legii 196/2018: calcul pe număr de persoane, cotă-parte indiviză și contoare de consum.',
    category: 'Metodologie Financiară & Operațională',
    clusterId: 'cluster-a-associations',
    primaryQuery: 'repartizare cheltuieli asociatie proprietari',
    supportingQueries: [
      'calcul cheltuieli intretinere bloc',
      'criterii repartizare utilitati legea 196',
      'repartizare apa rece pe persoane',
      'cheltuieli comune cota indiviza'
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
    pillarHref: '/ro/solutions/associations',
    disclaimer:
      'Acest ghid oferă o perspectivă metodologică și operațională asupra calculului cheltuielilor comune și nu constituie consultanță contabilă sau juridică autorizată. Asociațiile de proprietari au obligația de a verifica repartizările conform normelor legale în vigoare și hotărârilor adunării generale.',
    directAnswer:
      'Repartizarea corectă a cheltuielilor într-o asociație de proprietari presupune decuplarea facturii brute emise de furnizor în cote individuale atribuibile fiecărui apartament, pe baza a patru criterii legale esențiale: cheltuieli pe număr de persoane (servicii legate de prezența locatarilor), cheltuieli pe cotă-parte indiviză (proporționale cu cota din proprietatea comună), cheltuieli pe consumuri individuale (determinate prin contoare și apometre) și cheltuieli pe beneficiari. Utilizarea unui criteriu diferit de cel prevăzut de lege conduce la o repartizare neconformă.',
    sections: [
      {
        id: 'principiul-decuplarii',
        title: 'Principiul Fundamental: Decuplarea Facturii Furnizorului de Cota Proprietarului',
        content: [
          'Una dintre cele mai mari erori metodologice întâlnite în gestiunea blocurilor este tratarea facturii unui furnizor ca o sumă globală împărțită mecanic. În realitate, o singură factură de utilități poate include componente care se repartizează pe criterii distincte.',
          'De exemplu, o factură unică de apă și canalizare include de regulă trei elemente distincte: consumul individual înregistrat de apometrele din apartamente, consumul comun (udat spații verzi, curățenie, diferențe pe rețele comune) și componenta de canalizare a apei meteorice.',
          'Conform legii, apa consumată în apartamente se repartizează pe consumuri individuale, în timp ce apa meteorică și întreținerea rețelelor comune se repartizează proporțional cu cota-parte indiviză de proprietate, indiferent dacă proprietarul locuiește sau nu în imobil.',
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
              'Se aplică serviciilor a căror utilizare este direct legată de prezența persoanelor în clădire și care nu pot fi individualizate prin aparate de măsură: salubrizare (dacă operatorul facturează pe număr de locuitori), energia electrică pentru iluminatul casei scării și funcționarea liftului, consumul de apă rece la paușal (acolo unde nu există apometre).',
              'Regulă de calcul: Suma totală a facturii se împarte la numărul total de persoane declarate în clădire în luna respectivă, rezultând costul per persoană, care se înmulțește apoi cu numărul de persoane înregistrate la fiecare apartament.',
              'Obligația locatarilor: Proprietarii au obligația de a anunța în scris comitetul executiv cu privire la orice schimbare a numărului de persoane care locuiesc mai mult de 15 zile într-o lună (Art. 82 alin. 3 și 4 din Legea 196/2018).',
            ],
          },
          {
            title: '2. Cheltuieli pe Cotă-Parte Indiviză (Art. 84, Art. 85)',
            content: [
              'Se aplică tuturor costurilor necesare pentru menținerea, conservarea, repararea și administrarea părților comune ale imobilului. Acestea includ: reparații de terasă, fațadă, acoperiș sau hidroizolație; reviziile periodice ale liftului și ale instalațiilor comune; serviciile de curățenie a spațiilor comune; salariile sau indemnizațiile personalului; cheltuielile administrative.',
              'Regulă de calcul: Cota-parte indiviză reprezintă raportul dintre suprafața utilă a proprietății individuale și totalul suprafețelor utile din condominiu, reflectat în acordul de asociere. Niciun proprietar nu poate fi scutit de aceste cheltuieli pe motiv că nu folosește spațiile comune sau că locuiește temporar în altă parte.',
            ],
          },
          {
            title: '3. Cheltuieli pe Consumuri Individuale',
            content: [
              'Se aplică utilităților contorizate la nivel de apartament: apă rece, apă caldă menajeră, energie termică repartizată prin repartitoare de costuri, gaze naturale (în cazul branșamentelor individuale).',
              'Regulă de calcul: Consumul înregistrat (m³, kWh sau unități de consum) se înmulțește cu tariful unitar legal facturat de furnizor.',
              'Diferențele de consum: Dacă totalul apometrelor individuale nu coincide cu indexul contorului general de branșament, diferența se repartizează conform metodologiei adoptate de Adunarea Generală a proprietarilor (de regulă, proporțional cu consumul individual sau pe cotă-parte indiviză, conform regulamentului de condominiu).',
            ],
          },
          {
            title: '4. Cheltuieli pe Beneficiari',
            content: [
              'Se aplică serviciilor solicitate exclusiv de anumiți proprietari sau care deservesc doar o parte a imobilului (de exemplu: telecomenzi pentru bariera de acces la parcare, reparația unui interfon pe o singură scară sau cheltuieli cu servicii speciale solicitate punctual).',
            ],
          },
        ],
      },
      {
        id: 'circuitul-facturilor',
        title: 'Circuitul de Procesare a Facturilor de Utilități',
        content: [
          'Pentru a asigura o repartizare fără cusur, asociațiile moderne aplică un flux operațional în 4 etape:',
          '1. Preluarea și înregistrarea facturii: Înregistrarea datei de emitere, a termenului de scadență și a consumului total facturat în registrul de evidență a facturilor.',
          '2. Colectarea indexurilor individuale: Preluarea citirilor de la proprietari sau prin sisteme de telecitire la o dată fixă stabilită prin regulamentul intern.',
          '3. Rularea algoritmului de calcul: Descompunerea facturii pe cheile legale de repartizare și generarea proiectului de listă de plată.',
          '4. Verificarea cenzorului și avizarea: Cenzorul verifică egalitatea dintre suma totală a cotelor repartizate și totalul facturilor înregistrate, semnează lista și permite afișarea oficială.',
        ],
      },
      {
        id: 'erori-metodologice-frecvente',
        title: 'Erori Metodologice Frecvente în Repartizare',
        content: [
          'Practica arată că cele mai frecvente litigii între proprietari și asociații izvorăsc din:',
          '• Repartizarea salariilor administratorului sau ale femeii de serviciu pe număr de persoane, deși legea impune repartizarea pe cotă-parte indiviză.',
          '• Includerea apei meteorice la consumul de apă pe persoane, în loc de cota-parte indiviză.',
          '• Scutirea abuzivă a apartamentelor de la parter de la cheltuielile cu ascensorul fără o hotărâre a Adunării Generale în condițiile legii.',
          '• Neactualizarea numărului de persoane în termenul legal, generând distorsiuni în calculul costurilor pe locatar.',
        ],
      },
      {
        id: 'recomandari-cenzori',
        title: 'Recomandări pentru Cenzori și Membrii Comitetului',
        content: [
          'Pentru a preveni contestațiile și suspiciunile de calcul:',
          '• Păstrați fișele de calcul lunare pentru fiecare factură de utilități alături de factura originală.',
          '• Publicați pe lista de plată nu doar suma finală, ci și formula detaliată: preț unitar, index vechi, index nou, consum calculat.',
          '• Asigurați întocmirea și afișarea cu celeritate a listei lunare la avizierul asociației conform hotărârii adunării generale.',
          '• Efectuați reconcilierea bancară lunară între sumele încasate conform listelor și plățile efectuate către furnizori.',
        ],
      },
    ],
    table: {
      caption: 'Matricea Criteriilor de Repartizare a Cheltuielilor în Asociație',
      headers: ['Tip Cheltuială', 'Criteriu Legal Obligatoriu', 'Baza de Calcul', 'Temei Legea 196/2018'],
      rows: [
        ['Salubrizare (menajer)', 'Număr de persoane', 'Locatari declarați în apartament', 'Art. 82'],
        ['Energie electrică spații comune', 'Număr de persoane', 'Locatari declarați în condominiu', 'Art. 82'],
        ['Curățenie spații comune', 'Cotă-parte indiviză', 'Suprafața utilă a apartamentului', 'Art. 85'],
        ['Reparații terasă / fațadă', 'Cotă-parte indiviză', 'Suprafața utilă a apartamentului', 'Art. 85'],
        ['Revizie ascensor', 'Cotă-parte indiviză', 'Suprafața utilă a apartamentului', 'Art. 85'],
        ['Consum apă rece / caldă', 'Consumuri individuale', 'Diferență index apometru (m³)', 'Art. 83'],
        ['Apă meteorică', 'Cotă-parte indiviză', 'Suprafața utilă a apartamentului', 'Art. 85'],
        ['Salarii / indemnizații conducere', 'Cotă-parte indiviză', 'Suprafața utilă a apartamentului', 'Art. 85'],
      ],
    },
    faqs: [
      {
        q: 'Apartamentele de la parter sunt scutite de la plata cheltuielilor cu liftul?',
        a: 'Conform Legii nr. 196/2018, cheltuielile pentru funcționarea și întreținerea ascensorului se suportă de către toți proprietarii. Scutirea proprietarilor de la parter sau demisol se poate decide exclusiv prin hotărârea Adunării Generale a asociației de proprietari.',
      },
      {
        q: 'Cum se repartizează pierderile de apă sau diferența dintre apometre și contorul de branșament?',
        a: 'Diferența de apă rezultată între contorul general și suma apometrelor individuale se repartizează conform hotărârii Adunării Generale: fie proporțional cu consumul înregistrat de fiecare apartament, fie proporțional cu cota-parte indiviză de proprietate.',
      },
      {
        q: 'Ce se întâmplă dacă un proprietar nu transmite indexul apometrului la termen?',
        a: 'Regulamentul asociației de proprietari poate stabili aplicarea unui consum forfetar (paușal) stabilit prin hotărârea Adunării Generale, urmând ca regularizarea să se efectueze la următoarea citire verificată de reprezentanții asociației.',
      },
    ],
    legalSources: [
      {
        title: 'Legea nr. 196/2018 privind înființarea, organizarea și funcționarea asociațiilor de proprietari',
        reference: 'Art. 75 - 85 (Repartizarea cheltuielilor)',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/305357',
      },
    ],
    bridge: {
      title: 'Repartizare Precisă cu CLADORA',
      description:
        'Vezi cum pachetul operațional CLADORA automatizează descompunerea facturilor și calculele matematice conform Legii 196/2018.',
      buttonText: 'Află Mai Multe despre Platformă',
      href: '/ro/solutions/associations',
    },
    relatedGuides: [
      {
        title: 'Ghid Practic pentru Asociațiile de Proprietari: Context Operațional Legea 196/2018',
        slug: 'asociatii-proprietari-legea-196-2018',
        lang: 'ro',
      },
      {
        title: 'Program de Calcul Întreținere Bloc: Reguli Legale & Algoritmi Explicabili',
        slug: 'program-calcul-intretinere-bloc',
        lang: 'ro',
      },
    ],
  },

  // 3. PROGRAM-CALCUL-INTRETINERE-BLOC (New)
  'program-calcul-intretinere-bloc': {
    id: 'CLUSTER-A-01',
    lang: 'ro',
    slug: 'program-calcul-intretinere-bloc',
    title: 'Program de Calcul Întreținere Bloc: Reguli Legale, Algoritmi de Repartizare și Evitarea Erorilor de Calcul',
    seoTitle: 'Program Calcul Întreținere Bloc: Reguli și Algoritmi',
    description:
      'Cum funcționează un program de calcul pentru întreținerea la bloc: repartizarea legală a costurilor, verificarea cenzorilor și eliminarea erorilor lunare.',
    category: 'Administrare Asociații de Proprietari',
    clusterId: 'cluster-a-associations',
    primaryQuery: 'program calcul întreținere bloc',
    supportingQueries: [
      'software listă întreținere',
      'calcul cotă întreținere asociație',
      'algoritm repartizare cheltuieli bloc',
      'program administrare cheltuieli condominiu'
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
    pillarHref: '/ro/solutions/associations',
    disclaimer:
      'Acest articol are caracter pur informativ și metodologic privind funcționarea algoritmilor software de calcul pentru asociațiile de proprietari din România. Nu reprezintă consultanță juridică, fiscală sau de contabilitate autorizată.',
    directAnswer:
      'Un program de calcul pentru întreținerea blocului este un instrument operațional care transformă facturile de utilități și cheltuielile comune ale condominiului în liste lunare de plată transparente. Conform Legii nr. 196/2018, softul trebuie să aplice riguros cele 6 categorii legale de cheltuieli (pe persoane, pe cota-parte indiviză, pe consumatori tehnici, pe beneficiari, de reparații și de natură administrativă), asigurând o formulă matematică auditabilă pentru fiecare apartament.',
    sections: [
      {
        id: 'ce-este-program-calcul-intretinere',
        title: 'Rolul și Cerințele Fundamentale ale unui Program de Calcul de Întreținere',
        content: [
          'Calculul manual al cotelor de întreținere în tabele Excel nestructurate reprezintă principala sursă de erori umane, tensiuni între vecini și contestații în cadrul asociațiilor de proprietari din România.',
          'Un program de calcul pentru întreținerea blocului nu este doar o bază de date cu apartamente, ci un motor de reguli matematice și legale. Rolul său central este de a prelua facturile brute de la furnizorii de utilități (apă, salubrizare, energie termică, energie electrică pentru părțile comune, mentenanță ascensoare) și de a le distribui pe proprietăți individuale conform cheilor legale de repartizare impuse de Legea nr. 196/2018.',
          'Spre deosebire de soluțiile vechi instalate pe un singur calculator nesecurizat, un soft modern oferă trasabilitate completă: fiecare cifră introdusă, fiecare modificare de index și fiecare stornare rămân consemnate într-un jurnal de audit verificabil de cenzori.',
        ],
      },
      {
        id: 'categoriile-legale-cheltuieli',
        title: 'Cele 6 Categorii Legale de Cheltuieli Stabilite de Legea 196/2018',
        content: [
          'Un program de calcul conform trebuie să implementeze fără abatere clasificarea prevăzută la Art. 75 din Legea nr. 196/2018. Fiecărei categorii îi corespunde o formulă matematică specifică:',
          '1. Cheltuieli pe număr de persoane (Art. 82): Se aplică utilităților a căror intensitate de consum depinde direct de prezența fizică a locatarilor (ex: energia electrică pentru iluminatul spațiilor comune și funcționarea ascensorului, salubrizarea când este facturată pe persoană, apa rece la paușal). Formula: Valoarea facturii se împarte la totalul persoanelor înregistrate în imobil, iar cota unitară se înmulțește cu numărul de persoane din apartament.',
          '2. Cheltuieli pe cotă-parte indiviză de proprietate (Art. 85): Se aplică administrării, întreținerii și conservării proprietății comune (ex: salariul administratorului, indemnizația președintelui, contractul de service lift, curățenia scărilor, reparații de terasă sau instalații comune, apa meteorică). Formula: Cota-parte indiviză (raportul dintre suprafața utilă a apartamentului și totalul suprafețelor utile din bloc) înmulțită cu valoarea totală a cheltuielii.',
          '3. Cheltuieli pe consumuri individuale (Art. 83): Utilitățile măsurate direct prin apometre, repartitoare de costuri sau contoare de branșament individual (apă rece, apă caldă menajeră, încălzire contorizată). Formula: Index nou minus index vechi, multiplicat cu tariful legal al furnizorului.',
          '4. Cheltuieli pe consumatori tehnici: Costuri aferente unor echipamente care aduc beneficii specifice sau modificări de putere instalată solicitate de anumiți proprietari.',
          '5. Cheltuieli pe beneficiari: Servicii contractate exclusiv pentru anumiți proprietari (ex: telecomenzi de acces în garaj, chei suplimentare interfon).',
          '6. Cheltuieli pentru fondurile asociației: Fondul de rulment (constituit individual conform Art. 72) și fondul de reparații (calculat pe cotă-parte indiviză conform Art. 71).',
        ],
      },
      {
        id: 'algoritmi-repartizare-practici',
        title: 'Algoritmi Practici de Calcul: Repartizarea Pas cu Pas',
        content: [
          'Pentru a elimina suspiciunile de calcul, programul trebuie să parcurgă un algoritm etapizat și transparent:',
          'Pasul 1: Înregistrarea facturii furnizorului — se consemnează numărul facturii, emitentul, perioada de consum, data scadenței și valoarea totală brută.',
          'Pasul 2: Preluarea indexurilor individuale de apometre — softul calculează consumul individual înregistrat de fiecare unitate.',
          'Pasul 3: Calculul diferențelor de consum (la apă) — diferența dintre contorul general de branșament și suma apometrelor din apartamente se alocă conform regulamentului aprobat de Adunarea Generală (de regulă proporțional cu consumul individual sau pe cotă-parte indiviză).',
          'Pasul 4: Calculul cheltuielilor pe persoană — împărțirea facturilor de salubrizare și curent comun la numărul total de persoane declarate în luna respectivă.',
          'Pasul 5: Calculul cheltuielilor pe cota-parte indiviză — multiplicarea sumei cheltuielilor comune cu procentul exact de CPI al fiecărui apartament.',
          'Pasul 6: Generarea listei preliminare și reconcilierea de control: suma totală a cotelor repartizate pe toate apartamentele trebuie să fie matematic egală cu suma facturilor intrate în calcul.',
        ],
      },
      {
        id: 'tabel-comparativ-metode-calcul',
        title: 'Exemplu Practic de Calcul pe un Condominiu de 20 de Apartamente',
        content: [
          'Tabelul de mai jos ilustrează modul în care facturile unei luni tipice sunt descompuse algoritmic pentru două apartamente cu caracteristici diferite (Apartamentul 1: 2 persoane, 50 m² suprafață utilă, CPI 5%; Apartamentul 2: 4 persoane, 80 m² suprafață utilă, CPI 8%):',
        ],
      },
      {
        id: 'erori-frecvente-calcul',
        title: 'Erori Frecvente în Softurile Tradiționale de Calcul al Întreținerii',
        content: [
          'În practica administrării blocurilor din România, multe softuri legacy sau fișiere Excel prezintă vulnerabilități metodologice majore:',
          '• Amestecarea cheilor de repartizare: Calcularea salariului femeii de serviciu sau a administratorului pe număr de persoane în loc de cota-parte indiviză (încălcare directă a Art. 85 din Legea 196/2018).',
          '• Rotunjiri matematice eronate: Programele care rotunjesc zecimalele intermediar, generând la final o discrepanță de câțiva lei între totalul listei și totalul facturilor furnizorilor.',
          '• Modificări retroactive fără stornare: Softurile care permit editarea silențioasă a unei luni trecute fără a genera o notă de corecție transparentă pe lista lunii curente.',
          '• Calculul penalităților înainte de expirarea termenului de grație: Legea interzice aplicarea penalităților înainte de 30 de zile de la scadența legală a listei de plată.',
        ],
      },
      {
        id: 'ce-trebuie-verificat',
        title: 'Ce Trebuie să Verifice Cenzorii Înainte de Validarea Listei',
        content: [
          'Înainte ca lista de plată să fie semnată și afișată la avizier, comisia de cenzori trebuie să verifice următoarele puncte de control:',
          '1. Egalitatea absolută dintre totalul facturilor de utilități primite în luna respectivă și totalul sumelor repartizate pe coloanele listei de plată.',
          '2. Exactitatea numărului total de persoane luat în calcul (verificarea cererilor scrise de adăugare/scădere locatari depuse la asociație).',
          '3. Suma cotelor-părți indivize ale tuturor apartamentelor și spațiilor cu altă destinație din bloc (trebuie să fie exact 100%).',
          '4. Verificarea transferului soldurilor neachitate din luna precedentă pe coloana de restanțe, fără dublări sau omisiuni.',
          '5. Verificarea calculului penalităților: procentul aplicat nu poate depăși 0,2% pe zi, iar valoarea penalităților nu poate depăși debitul restant.',
        ],
      },
      {
        id: 'concluzii-bune-practici',
        title: 'Concluzii și Recomandări de Bune Practici',
        content: [
          'Alegerea unui program modern de calcul al întreținerii blocului protejează administratorul și comitetul executiv de riscuri juridice și contestații inutile.',
          'Transparența algoritmilor, explicabilitatea fiecărui rând de calcul pentru proprietar și posibilitatea cenzorului de a audita fiecare operațiune constituie standardul de aur în administrarea modernă a condominiilor din România.',
        ],
      },
    ],
    table: {
      caption: 'Exemplu Practic de Repartizare a Facturilor conform Legii 196/2018',
      headers: ['Tip Cheltuială / Factură', 'Total Factură Bloc', 'Criteriu Legal', 'Cota Ap. 1 (2 pers / 5% CPI)', 'Cota Ap. 2 (4 pers / 8% CPI)'],
      rows: [
        ['Energie electrică spații comune', '400 lei', 'Pe număr persoane (40 pers. total)', '20 lei (2 x 10 lei/pers)', '40 lei (4 x 10 lei/pers)'],
        ['Salubrizare menajeră', '800 lei', 'Pe număr persoane (40 pers. total)', '40 lei (2 x 20 lei/pers)', '80 lei (4 x 20 lei/pers)'],
        ['Curățenie spații comune', '1.000 lei', 'Pe cotă-parte indiviză (CPI)', '50 lei (1.000 x 5%)', '80 lei (1.000 x 8%)'],
        ['Revizie lunară ascensor', '600 lei', 'Pe cotă-parte indiviză (CPI)', '30 lei (600 x 5%)', '48 lei (600 x 8%)'],
        ['Salariu administrare bloc', '1.200 lei', 'Pe cotă-parte indiviză (CPI)', '60 lei (1.200 x 5%)', '96 lei (1.200 x 8%)'],
        ['Apă rece consumată (contoare)', '3.200 lei (400 m³)', 'Consum individual măsurat', '80 lei (10 m³ consumați)', '160 lei (20 m³ consumați)'],
        ['Diferență apă rece branșament', '200 lei (25 m³)', 'Repartizare conform hotărâre AG (CPI)', '10 lei (200 x 5%)', '16 lei (200 x 8%)'],
        ['Fond de reparații aprobat', '1.000 lei', 'Pe cotă-parte indiviză (CPI)', '50 lei (1.000 x 5%)', '80 lei (1.000 x 8%)'],
        ['Total cotă lunară repartizată', '8.400 lei', 'Suma formulelor specifice', '340 lei', '600 lei'],
      ],
    },
    faqs: [
      {
        q: 'Poate un program de calcul să modifice criteriile de repartizare stabilite de Legea 196/2018?',
        a: 'Nu. Criteriile de repartizare stabilite prin Legea nr. 196/2018 (pe persoane, pe cota-parte indiviză, pe contoare) sunt imperative. Niciun program de calcul și nicio hotărâre a adunării generale nu poate deroga de la normele de ordine publică ale legii.',
      },
      {
        q: 'Cum gestionează un program modern citirile transmise cu întârziere?',
        a: 'În cazul în care un proprietar nu transmite indexul apometrului în intervalul stabilit, programul permite atribuirea unui consum estimat (paușal) conform regulamentului intern al asociației, urmând ca la consemnarea citirii reale să se efectueze o regularizare matematică documentată.',
      },
      {
        q: 'Este permisă repartizarea cheltuielilor administrative pe număr de apartamente în mod egal?',
        a: 'Nu. Conform Legii nr. 196/2018, cheltuielile administrative (salarii, consumabile, comisioane bancare) se repartizează strict proporțional cu cota-parte indiviză de proprietate aferentă fiecărei proprietăți individuale, nu în mod egal pe apartament.',
      },
    ],
    legalSources: [
      {
        title: 'Legea nr. 196/2018 privind înființarea, organizarea și funcționarea asociațiilor de proprietari',
        reference: 'Art. 75 - 85 (Categoriile de cheltuieli și modul de repartizare)',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/305357',
      },
    ],
    bridge: {
      title: 'Descoperă Soluția CLADORA pentru Asociații de Proprietari',
      description:
        'Află cum arhitectura de calcul CLADORA este proiectată să susțină repartizarea corectă, auditabilă și structurată a cheltuielilor de bloc conform Legii 196/2018.',
      buttonText: 'Vezi Soluția pentru Asociații',
      href: '/ro/solutions/associations',
    },
    relatedGuides: [
      {
        title: 'Lista de Plată a Asociației de Proprietari: Structură, Termene și Afișare Legală',
        slug: 'lista-de-plata-asociatie-proprietari',
        lang: 'ro',
      },
      {
        title: 'Calculul Cotei-Părți Indivize în Condominiu: Suprafață Utilă și Formule',
        slug: 'cota-parte-indiviza-calcul',
        lang: 'ro',
      },
      {
        title: 'Metodologia Repartizării Cheltuielilor în Asociațiile de Proprietari',
        slug: 'repartizare-cheltuieli-asociatie-proprietari',
        lang: 'ro',
      },
    ],
  },

  // 4. LISTA-DE-PLATA-ASOCIATIE-PROPRIETARI (New)
  'lista-de-plata-asociatie-proprietari': {
    id: 'CLUSTER-A-02',
    lang: 'ro',
    slug: 'lista-de-plata-asociatie-proprietari',
    title: 'Lista de Plată a Asociației de Proprietari: Structură Obligatorie, Termene Legale de Afișare și Procedura de Contestare',
    seoTitle: 'Lista de Plată a Asociației de Proprietari: Reguli',
    description:
      'Elementele obligatorii ale listei de plată a cotelor de întreținere: termene legale de afișare, scadență, calculul penalităților și procedura de contestație.',
    category: 'Administrare Asociații de Proprietari',
    clusterId: 'cluster-a-associations',
    primaryQuery: 'listă de plată asociație proprietari',
    supportingQueries: [
      'avizier bloc cotă întreținere',
      'termen afișare listă întreținere',
      'contestare listă plată asociație',
      'elemente obligatorii cotă întreținere'
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
    pillarHref: '/ro/solutions/associations',
    disclaimer:
      'Acest ghid oferă clarificări operaționale și metodologice privind afișarea și contestarea listei de plată conform legislației din România. Nu reprezintă asistență juridică sau contabilă de specialitate.',
    directAnswer:
      'Lista de plată a asociației de proprietari este documentul oficial lunar prin care se aduc la cunoștința proprietarilor cotele de contribuție la cheltuielile condominiului. Conform Legii nr. 196/2018, lista se întocmește lunar și se afișează obligatoriu la avizierul asociației (în format fizic, putând fi pusă la dispoziție suplimentar și prin mijloace digitale), detaliind transparent fiecare tip de cheltuială, baza legală de calcul, restanțele și penalitățile aplicate.',
    sections: [
      {
        id: 'rolul-juridic-al-listei-de-plata',
        title: 'Valoarea Juridică și Probatorie a Listei Lunare de Plată',
        content: [
          'Lista de plată a cotelor de întreținere nu este o simplă notă informativă, ci un act financiar și operațional esențial al asociației de proprietari.',
          'În conformitate cu prevederile Legii nr. 196/2018 (Art. 77 - 80), lista de plată întocmită de administrator, verificată de cenzori și aprobată de comitetul executiv constituie actul financiar de bază al asociației. În cazul neachitării cotelor, recuperarea debitelor se realizează prin acțiune în justiție deschisă de asociație (Art. 80), lista de plată având valoare probatorie esențială în fața instanței pentru obținerea unui titlu executoriu.',
          'Din acest motiv, erorile formale de calcul, lipsa avizării comitetului sau nerespectarea criteriilor statutare pot slăbi forța probantă a documentului și pot conduce la contestarea cu succes a sumelor în fața instanțelor judecătorești.',
        ],
      },
      {
        id: 'elemente-obligatorii-conform-legii',
        title: 'Structura Minimală Obligatorie Impusă de Legea 196/2018',
        content: [
          'Legea impune un format transparent și verificabil pentru lista de plată afișată la avizier. Fiecare listă lunară trebuie să conțină obligatoriu următoarele elemente de identificare și calcul:',
          '1. Datele de identificare ale asociației: denumirea oficială, codul de identificare fiscală (CIF), adresa exactă a condominiului și contul bancar curent.',
          '2. Luna și anul de calcul la care se referă cotele repartizate.',
          '3. Data exactă a afișării la avizier și data scadenței plății.',
          '4. Identificarea fiecărui apartament: numărul apartamentului, numele proprietarului (cu respectarea normelor GDPR de protecție a datelor), numărul de persoane declarate și cota-parte indiviză.',
          '5. Coloane distincte pentru fiecare categorie de cheltuială: cheltuieli pe număr de persoane, cheltuieli pe cotă-parte indiviză, consumuri individuale (apometre apă rece/caldă), fond de reparații și fond de rulment.',
          '6. Coloane de regularizare și evidență: restanțe din lunile anterioare, penalități legal calculate, plăți efectuate în avans și totalul general de plată.',
          '7. Semnăturile autorizate: semnătura administratorului care a întocmit lista, semnătura cenzorului care a auditat calculul și semnătura președintelui asociației.',
        ],
      },
      {
        id: 'termene-legale-afisare-si-scadenta',
        title: 'Termene Legale de Afișare, Scadență și Perioada de Grație',
        content: [
          'Gestionarea termenelor este esențială pentru regularitatea procedurii de încasare:',
          '• Termenul de afișare și scadență: Administratorul întocmește lunar lista de plată conform facturilor primite. Termenul legal pentru plata cotelor este de maximum 30 de zile calendaristice de la data afișării la avizier (Art. 77 alin. 2 din Legea 196/2018).',
          '• Termenul de grație pentru penalități: Legea 196/2018 instituie un termen de grație obligatoriu de 30 de zile calendaristice calculate de la data scadenței plății (Art. 77 alin. 1). În acest interval nu se pot aplica penalități de întârziere.',
          '• Aplicarea penalităților: Penalitățile se pot percepe exclusiv după expirarea termenului de grație, în cuantumul stabilit prin hotărârea Adunării Generale (maximum 0,2% pentru fiecare zi de întârziere), fără ca suma totală a penalităților să poată depăși debitul principal restant (Art. 77 alin. 1).',
        ],
      },
      {
        id: 'tabel-calendar-ciclu-lunar',
        title: 'Calendarul Fluxului Lunar de Administrare și Afișare',
        content: [
          'Pentru o planificare previzibilă, asociațiile de proprietari urmăresc un ciclu operațional lunar standardizat:',
        ],
      },
      {
        id: 'procedura-de-contestare',
        title: 'Procedura Legală de Contestare a Listei de Plată',
        content: [
          'Orice proprietar care identifică o neconcordanță în calculul cotelor sale lunare are dreptul de a solicita clarificări sau de a contesta calculul:',
          '1. Formularea solicitării: Proprietarii pot solicita comitetului executiv sau președintelui clarificări și explicații scrise privind modul de calcul al cotelor afișate la avizier (Art. 28 din Legea 196/2018).',
          '2. Conținutul contestației: Trebuie să menționeze clar apartamentul, coloana contestată, suma considerată eronată și motivele concrete invocate (ex: număr incorect de persoane, index apometru preluat greșit).',
          '3. Răspunsul organelor de conducere: Comitetul executiv și administratorul analizează obiecțiile formulate și transmit proprietarului clarificările justificate în termen rezonabil (termenul general de răspuns la solicitările proprietarilor prevăzut de Art. 28 alin. 5 fiind de maximum 10 zile de la primire).',
          '4. Efectul asupra plății și rectificarea: Solicitarea de clarificări nu suspendă automat de drept plata cotelor. Dacă se constată o eroare de calcul, corecția se efectuează de îndată, iar diferența se regularizează pe lista de plată a lunii următoare.',
        ],
      },
      {
        id: 'erori-frecvente-afisare',
        title: 'Erori Comune la Întocmirea și Afișarea Listelor de Plată',
        content: [
          'Printre cele mai frecvente nereguli sancționate de cenzori sau instanțe se numără:',
          '• Afișarea listei fără viza de audit și semnătura cenzorului.',
          '• Aplicarea penalităților direct la scadență, ignorând termenul de grație legal de 30 de zile.',
          '• Comasarea tuturor fondurilor și cheltuielilor într-o rubrică generică „Diverse”, lipsind proprietarul de dreptul la informare detaliată.',
          '• Modificarea sumelor prin tăieturi cu pixul pe lista deja afișată, fără reemiterea documentului avizat.',
        ],
      },
      {
        id: 'ce-trebuie-verificat-avizier',
        title: 'Ce Trebuie să Verifice Proprietarii la Avizier (Checklist)',
        content: [
          'La fiecare început de lună, proprietarii sunt încurajați să verifice:',
          '1. Data afișării consemnată pe antetul listei (stabilește curgerea termenului de contestare și a scadenței).',
          '2. Numărul de persoane consemnat pentru apartamentul lor.',
          '3. Indexurile de apă rece și caldă preluate pe listă (comparate cu citirile reale trimise).',
          '4. Existența semnăturilor administratorului, cenzorului și președintelui.',
          '5. Defalcarea clară a fondului de reparații și a fondului de rulment.',
        ],
      },
      {
        id: 'concluzie',
        title: 'Transparența Avizierului ca Premisă a Încrederii în Asociație',
        content: [
          'O listă de plată clară, afișată la timp și calculată matematic pe baze legale transformă relația dintre administrație și vecini, reducând litigiile și crescând rata de încasare voluntară a cheltuielilor comune.',
        ],
      },
    ],
    table: {
      caption: 'Fluxul Calendaristic Lunar al Listei de Plată conform Legii 196/2018',
      headers: ['Etapă Operațională', 'Termen Legal / Recomandat', 'Responsabil', 'Bază Legală'],
      rows: [
        ['Citire indexuri individuale', 'Zilele 25-30 ale lunii de consum', 'Proprietari / Administrator', 'Regulament intern condominiu'],
        ['Primire facturi utilități', 'Zilele 1-10 ale lunii următoare', 'Furnizori servicii', 'Contracte de furnizare utilități'],
        ['Calcul preliminar listă', 'Zilele 10-12 ale lunii', 'Administrator de condominiu', 'Art. 66 Legea 196/2018'],
        ['Audit și semnare cenzor', 'Zilele 12-14 ale lunii', 'Comisia de cenzori', 'Art. 60 Legea 196/2018'],
        ['Afișare oficială la avizier', 'Lunar, după centralizarea facturilor', 'Administrator & Comitet Executiv', 'Art. 57, 66 Legea 196/2018'],
        ['Clarificări și contestații', 'Formulare scrisă către comitet', 'Proprietari / Comitet executiv', 'Art. 28 Legea 196/2018'],
        ['Scadența legală de plată', 'Maximum 30 de zile de la afișare', 'Toți proprietarii din bloc', 'Art. 77 alin. (2) Legea 196/2018'],
        ['Termen de grație fără penalități', '30 de zile de la data scadenței', 'Toți debitorii restanți', 'Art. 77 alin. (1) Legea 196/2018'],
      ],
    },
    faqs: [
      {
        q: 'Avizierul digital (aplicația mobilă) înlocuiește obligativitatea afișării fizice a listei la avizier?',
        a: 'Conform Legii nr. 196/2018, asociația poate utiliza mijloace electronice pentru comunicare, însă afișarea fizică a listei pe hârtie semnată la avizierul din scara blocului rămâne obligatorie, reprezentând modalitatea formală legală de notificare colectivă.',
      },
      {
        q: 'Are voie administratorul să publice CNP-ul sau numărul de telefon al proprietarilor pe lista de plată?',
        a: 'Nu. Publicarea datelor cu caracter personal excesive (precum CNP, serie de buletin sau număr de telefon) pe lista afișată public este strict interzisă de Regulamentul General privind Protecția Datelor (GDPR). Se publică doar numărul apartamentului și numele/inițiala proprietarului.',
      },
      {
        q: 'Dacă depun o contestație, sunt scutit de plata întreținerii până la primirea răspunsului?',
        a: 'Conform legii, depunerea unei contestații sau solicitări de lămurire nu suspendă de drept obligația de plată a cotelor afișate. Pentru a evita acumularea de penalități în cazul respingerii obiecțiilor, se recomandă achitarea sumelor stabilite, urmând ca eventualele rectificări aprobate de comitet să fie regularizate pe lista lunii următoare.',
      },
    ],
    legalSources: [
      {
        title: 'Legea nr. 196/2018 privind înființarea, organizarea și funcționarea asociațiilor de proprietari',
        reference: 'Art. 77 - 80 (Afișarea, plata și contestarea cotelor)',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/305357',
      },
    ],
    bridge: {
      title: 'Transparență Operațională cu CLADORA',
      description:
        'Află cum arhitectura CLADORA este proiectată să susțină afișarea transparentă și structurată a listelor de plată conform Legii 196/2018.',
      buttonText: 'Vezi Soluția pentru Asociații',
      href: '/ro/solutions/associations',
    },
    relatedGuides: [
      {
        title: 'Program de Calcul Întreținere Bloc: Reguli Legale & Algoritmi Explicabili',
        slug: 'program-calcul-intretinere-bloc',
        lang: 'ro',
      },
      {
        title: 'Fond de Rulment vs Fond de Reparații: Calcul, Scop și Restituire Legală',
        slug: 'fond-rulment-vs-fond-reparatii',
        lang: 'ro',
      },
      {
        title: 'Ghid Practic pentru Asociațiile de Proprietari: Context Operațional Legea 196/2018',
        slug: 'asociatii-proprietari-legea-196-2018',
        lang: 'ro',
      },
    ],
  },

  // 5. FOND-RULMENT-VS-FOND-REPARATII (New)
  'fond-rulment-vs-fond-reparatii': {
    id: 'CLUSTER-A-03',
    lang: 'ro',
    slug: 'fond-rulment-vs-fond-reparatii',
    title: 'Fond de Rulment vs. Fond de Reparații: Diferențe Legale, Mod de Calcul, Utilizare și Procedura de Restituire',
    seoTitle: 'Fond de Rulment vs Fond de Reparații: Diferențe Cheie',
    description:
      'Diferențele esențiale dintre fondul de rulment și fondul de reparații conform Legii 196/2018: mod de calcul, destinație legală și restituirea la înstrăinare.',
    category: 'Finanțe & Gestiune Asociații',
    clusterId: 'cluster-a-associations',
    primaryQuery: 'fond de rulment și fond de reparații',
    supportingQueries: [
      'restituire fond de rulment vânzare apartament',
      'calcul fond rulment legea 196',
      'utilizare fond reparații asociație',
      'diferența între fondul de rulment și fondul de reparații'
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
    pillarHref: '/ro/solutions/associations',
    disclaimer:
      'Acest material are caracter de informare metodologică și operațională cu privire la fondurile asociațiilor de proprietari din România. Nu constituie consultanță contabilă autorizată sau consultanță juridică personalizată.',
    directAnswer:
      'Deși ambele sunt fonduri obligatorii prevăzute de Legea nr. 196/2018, fondul de rulment și fondul de reparații au naturi juridice și destinații complet diferite. Fondul de rulment (Art. 72) este un avans financiar personalizat ce garantează plata la timp a utilităților curente și se restituie proprietarului la vânzarea apartamentului. Fondul de reparații (Art. 71) este dedicat exclusiv consolidării, reabilitării și întreținerii proprietății comune, fiind atașat imobilului și nerambursabil în caz de înstrăinare.',
    sections: [
      {
        id: 'scopul-celor-doua-fonduri',
        title: 'De Ce Impune Legea 196/2018 Două Fonduri Financiare Separate',
        content: [
          'O problemă cronică a asociațiilor de proprietari din România o reprezintă amestecarea fondurilor sau utilizarea banilor strânși pentru reparații în vederea achitării facturilor curente de gaz și apă.',
          'Legiuitorul a prevăzut expres în Legea nr. 196/2018 două instrumente financiare distincte cu regimuri juridice incompatibile:',
          '• Fondul de rulment este o garanție de lichiditate pentru cheltuieli curente.',
          '• Fondul de reparații este o rezervă de capital pentru investiții în părțile comune ale imobilului.',
          'Amestecarea acestor două fluxuri bănești este contrară destinațiilor legale stabilite prin Legea nr. 196/2018 (Art. 71 și 72) și constituie abatere financiar-contabilă sancționabilă contravențional conform legii.',
        ],
      },
      {
        id: 'fondul-de-rulment-art-72',
        title: 'Fondul de Rulment: Baza Legală (Art. 72), Dimensionare și Evidență',
        content: [
          'Conform Art. 72 din Legea 196/2018, fondul de rulment se constituie în scopul asigurării sumelor necesare pentru plăți curente ale asociației de proprietari:',
          '• Dimensionarea legală: Cuantumul fondului de rulment se stabilește astfel încât să poată acoperi cheltuielile curente ale condominiului la nivelul unei luni calendaristice cu costuri maxime (de regulă, luna de iarnă cu consum maxim de încălzire și apă caldă).',
          '• Criteriul de repartizare: Se calculează pentru fiecare apartament sau spațiu în parte, pe baza istoricului de consum al respectivei unități și a numărului de persoane.',
          '• Evidența contabilă analitică: În contabilitatea asociației, fondul de rulment se evidențiază pe fișa fiecărui proprietar, fiind o creanță a proprietarului asupra asociației.',
          '• Depunerea în cont bancar: Sumele încasate cu titlu de fond de rulment se depun obligatoriu în contul bancar al asociației de proprietari.',
        ],
      },
      {
        id: 'fondul-de-reparatii-art-71',
        title: 'Fondul de Reparații: Baza Legală (Art. 71), Destinații și Aprobare',
        content: [
          'Conform Art. 71 din Legea 196/2018, proprietarii sunt obligați să constituie un fond de reparații anual:',
          '• Aprobarea în Adunarea Generală: Cuantumul anual al fondului de reparații se aprobă obligatoriu prin hotărârea Adunării Generale a proprietarilor, odată cu Bugetul de Venituri și Cheltuieli (BVC).',
          '• Cheia de repartizare: Se calculează obligatoriu proporțional cu cota-parte indiviză de proprietate a fiecărui apartament (suprafața utilă). Este interzisă repartizarea fondului de reparații în mod egal pe apartamente sau pe număr de persoane.',
          '• Destinații permise: Reabilitare termică, reparația acoperișului sau terasei, modernizarea instalațiilor comune de apă, canalizare sau încălzire, consolidări structurale, înlocuirea ascensorului.',
          '• Caracter nerambursabil: Fondul de reparații este indisolubil legat de imobil; sumele vărsate nu se restituie proprietarului la vânzarea apartamentului, ci rămân asociației pentru conservarea valorii clădirii.',
        ],
      },
      {
        id: 'tabel-comparativ-fonduri',
        title: 'Tabel Comparativ: Fondul de Rulment vs. Fondul de Reparații',
        content: [
          'Diferențele juridice și contabile dintre cele două fonduri sunt sintetizate în tabelul de mai jos:',
        ],
      },
      {
        id: 'procedura-de-restituire-la-vanzare',
        title: 'Procedura Legală de Restituire a Fondului de Rulment la Înstrăinarea Imobilului',
        content: [
          'În momentul în care un proprietar își vinde apartamentul, se declanșează procedura legală de lichidare a obligațiilor financiare:',
          'Pasul 1: Emiterea adeverinței notariale de către asociație — conform Art. 33 din Legea 196/2018, asociația eliberează o adeverință care atestă situația datoriilor restante și a fondurilor constituite.',
          'Pasul 2: Stingerea datoriilor restante — dacă proprietarul vânzător are debite restante la întreținere, fondul de rulment se utilizează cu prioritate pentru stingerea acestora.',
          'Pasul 3: Restituirea soldului disponibil — dacă nu există debite, sau după stingerea acestora, administratorul restituie diferența proprietarului vânzător în baza unei cereri scrise și a procesului-verbal de predare a apartamentului.',
          'Alternativă contractuală: Vânzătorul și cumpărătorul pot conveni ca fondul de rulment să rămână în contul asociației, cumpărătorul achitând contravaloarea acestuia direct vânzătorului în fața notarului public.',
        ],
      },
      {
        id: 'erori-frecvente-in-gestiunea-fondurilor',
        title: 'Erori Frecvente în Administrarea Fondurilor Obligatorii',
        content: [
          'Practica cenzorilor evidențiază următoarele nereguli comune:',
          '• Folosirea banilor din fondul de reparații pentru achitarea facturilor de gaz sau salubrizare (încălcare gravă a destinației fondurilor).',
          '• Refuzul asociației de a restitui fondul de rulment proprietarului care a vândut, sub pretextul lipsei de lichidități în cont.',
          '• Calcularea fondului de reparații pe număr de persoane sau în sumă fixă egală per apartament, încălcând principiul cotei-părți indivize.',
          '• Păstrarea fondurilor în numerar în casierie, cu depășirea nejustificată a plafonului legal de casă.',
        ],
      },
      {
        id: 'ce-trebuie-verificat-in-bilant',
        title: 'Ce Trebuie să Verifice Cenzorii în Balanța Analitică a Fondurilor',
        content: [
          'Comisia de cenzori trebuie să auditeze lunar:',
          '1. Existența unor conturi bancare distincte sau a unei evidențe analitice fără echivoc pentru fiecare fond în parte.',
          '2. Reconcilierea perfectă dintre soldul scriptic al fondurilor din lista de plată și disponibilitățile bănești din extrasul de cont bancar.',
          '3. Documentele justificative (facturi, devize, procese-verbale de recepție) pentru orice retragere sau plată efectuată din fondul de reparații.',
          '4. Verificarea cererilor de restituire a fondului de rulment și a chitanțelor de plată către foștii proprietari.',
        ],
      },
      {
        id: 'concluzii',
        title: 'Concluzii: Separarea Strictă a Fluxurilor ca Garanție a Stabilității Blocului',
        content: [
          'Separarea fermă a fondului de rulment de fondul de reparații este o condiție indispensabilă pentru buna guvernanță a oricărui condominiu.',
          'Platformele moderne de operare oferă registre financiare sigure, blocând din design tentativele de transfer neautorizat între fonduri cu destinații incompatibile.',
        ],
      },
    ],
    table: {
      caption: 'Comparație Juridică și Financiară: Fond de Rulment vs. Fond de Reparații',
      headers: ['Criteriu de Comparație', 'Fondul de Rulment (Art. 72)', 'Fondul de Reparații (Art. 71)'],
      rows: [
        ['Scopul principal', 'Garantarea lichidității pentru plata facturilor curente de utilități', 'Consolidarea, modernizarea și repararea proprietății comune'],
        ['Aprobare formală', 'Stabilit de Comitet / prevăzut de lege pentru o lună maximă', 'Aprobat anual obligatoriu de Adunarea Generală a proprietarilor'],
        ['Criteriu de calcul', 'Personalizat pe apartament (istoric consum + persoane)', 'Strict pe cotă-parte indiviză de proprietate (suprafață utilă)'],
        ['Proprietarul sumelor', 'Aparține proprietarului unității (creanță a acestuia)', 'Aparține asociației / este atașat imobilului'],
        ['Restituire la vânzare', 'Se restituie vânzătorului (după scăderea datoriilor restante)', 'NU se restituie (rămâne în patrimoniul asociației)'],
        ['Cont bancar', 'Cont curent asociație / subcont operațional', 'Cont bancar dedicat / plasamente cu risc scăzut'],
        ['Utilizare permisă', 'Plata la timp a facturilor curente ale furnizorilor de utilități', 'Exclusiv lucrări tehnice de reparații și investiții comune'],
      ],
    },
    faqs: [
      {
        q: 'Poate comitetul executiv să mărească fondul de reparații fără Adunarea Generală?',
        a: 'Nu. Conform Legii nr. 196/2018, nivelul fondului de reparații și lista lucrărilor de investiții se pot stabili exclusiv prin hotărârea Adunării Generale a asociației de proprietari.',
      },
      {
        q: 'Ce se întâmplă dacă un proprietar refuză plata fondului de rulment?',
        a: 'Fondul de rulment este o obligație legală stabilită de lege. Neachitarea sa în termenele de scadență atrage aplicarea penalităților de întârziere și poate constitui temei pentru acționarea în judecată a proprietarului debitor.',
      },
      {
        q: 'Pot fi plătite reparațiile la lift din fondul de rulment?',
        a: 'Nu. Reviziile și reparațiile ascensorului fac parte din întreținerea proprietății comune și se finanțează din fondul de reparații (sau cheltuieli curente pe cotă-parte indiviză), fiind interzisă utilizarea fondului de rulment în acest scop.',
      },
    ],
    legalSources: [
      {
        title: 'Legea nr. 196/2018 privind înființarea, organizarea și funcționarea asociațiilor de proprietari',
        reference: 'Art. 71 (Fondul de reparații) și Art. 72 (Fondul de rulment)',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/305357',
      },
    ],
    bridge: {
      title: 'Evidență Financiară Fără Riscuri cu CLADORA',
      description:
        'Află cum arhitectura de guvernanță CLADORA este proiectată să mențină evidența distinctă a fondurilor și să susțină transparența financiară conform Legii 196/2018.',
      buttonText: 'Vezi Soluția pentru Asociații',
      href: '/ro/solutions/associations',
    },
    relatedGuides: [
      {
        title: 'Program de Calcul Întreținere Bloc: Reguli Legale & Algoritmi Explicabili',
        slug: 'program-calcul-intretinere-bloc',
        lang: 'ro',
      },
      {
        title: 'Ghid Practic pentru Asociațiile de Proprietari: Context Operațional Legea 196/2018',
        slug: 'asociatii-proprietari-legea-196-2018',
        lang: 'ro',
      },
      {
        title: 'Calculul Cotei-Părți Indivize în Condominiu: Suprafață Utilă și Formule',
        slug: 'cota-parte-indiviza-calcul',
        lang: 'ro',
      },
    ],
  },

  // 6. COTA-PARTE-INDIVIZA-CALCUL (New)
  'cota-parte-indiviza-calcul': {
    id: 'CLUSTER-A-04',
    lang: 'ro',
    slug: 'cota-parte-indiviza-calcul',
    title: 'Calculul Cotei-Părți Indivize în Condominiu: Suprafață Utilă, Formule Matematice și Impactul asupra Cheltuielilor Comune',
    seoTitle: 'Calcul Cotă-Parte Indiviză: Formule și Suprafață Utilă',
    description:
      'Ghid de calcul pentru cotă-parte indiviză de proprietate: formula matematică raportată la suprafața utilă, rolul cărții funciare și repartizarea pe cheltuieli.',
    category: 'Arhitectură & Administrare Bloc',
    clusterId: 'cluster-a-associations',
    primaryQuery: 'calcul cotă-parte indiviză',
    supportingQueries: [
      'formula cotă parte indiviză bloc',
      'suprafață utilă cotă indiviză',
      'cheltuieli pe cota parte indiviză',
      'carte tehnică cotă parte condominiu'
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
    readTime: '11 min citire',
    pillarHref: '/ro/solutions/associations',
    disclaimer:
      'Acest ghid oferă explicații metodologice și tehnice privind calculul cotelor-părți indivize în clădirile colective din România. Nu reprezintă consultanță cadastrală sau juridică de specialitate.',
    directAnswer:
      'Cota-parte indiviză reprezintă procentul sau fracția matematică din proprietatea comună a unui condominiu care revine fiecărui spațiu individual (apartament, boxă, loc de parcare). Conform Legii nr. 196/2018, aceasta se calculează strict ca raport între suprafața utilă a proprietății individuale și suma totală a suprafețelor utile ale tuturor proprietăților individuale din imobil, constituind baza legală pentru repartizarea cheltuielilor de reparații, asigurare și mentenanță.',
    sections: [
      {
        id: 'definitia-si-rolul-cotei-indivize',
        title: 'Ce Este Cota-Parte Indiviză și de Ce Este Esențială în Bloc',
        content: [
          'Într-un bloc de locuințe sau într-o clădire mixtă, niciun proprietar nu este stăpân exclusiv doar pe spațiul dintre pereții apartamentului său.',
          'Fiecare proprietar deține în mod obligatoriu și o cotă-parte forțată și perpetuă din proprietatea comună: fundația clădirii, structura de rezistență, acoperișul, terasa, fațadele, casa scării, holurile de acces, ascensoarele și rețelele tehnico-edilitare comune.',
          'Cota-parte indiviză (CPI) materializează această coproprietate sub forma unei mărimi numerice. Ea determină două aspecte majore: ponderea votului fiecărui membru în Adunarea Generală a proprietarilor și proporția în care acesta este obligat să participe la suportarea cheltuielilor comune ale imobilului.',
        ],
      },
      {
        id: 'formula-matematica-de-calcul',
        title: 'Formula Matematică Legală de Calcul',
        content: [
          'Conform definițiilor din Legea nr. 196/2018 și Legii cadastrului și a publicității imobiliare nr. 7/1996, cota-parte indiviză se determină pe baza suprafeței utile:',
          'Formula procentuală: CPI (%) = (Suprafața Utilă a Proprietății Individuale / Totalul Suprafețelor Utile din Condominiu) * 100',
          'Pentru precizie analitică, cota-parte indiviză se exprimă de regulă cu cel puțin două sau patru zecimale (de exemplu, 4,2582%), pentru a preveni erorile de rotunjire cumulată pe ansamblul blocului.',
          'Condiție imperativă de integritate: Suma tuturor cotelor-părți indivize atribuite tuturor proprietăților individuale (inclusiv spații comerciale de la parter, birouri, boxe sau parcări intabulate) trebuie să fie exact egală cu 100% (sau fracția 1/1).',
        ],
      },
      {
        id: 'surse-de-date-carte-funciara-cadastru',
        title: 'Unde se Găsesc Datele Oficiale: Contracte, Extras de Carte Funciară și Releveu',
        content: [
          'Pentru a evita disputele legate de metri pătrați, administratorul și comitetul nu trebuie să utilizeze măsurători aproximative cu ruleta, ci datele consemnate în actele de proprietate oficiale:',
          '1. Extrasul de Carte Funciară pentru proprietatea individuală: consemnează suprafața utilă intabulată și cota-parte indiviză atribuită apartamentului.',
          '2. Releveul cadastral al unității individuale: detaliază suprafețele fiecărei încăperi (camere, băi, bucătărie, holuri, cămări).',
          '3. Cartea Tehnică a Construcției și Foaia Colectivă a Cărții Funciare: atestă totalul suprafețelor utile din clădire și distribuția cotelor la momentul recepției imobilului.',
          'Atenție la balcoane și logii: Conform Legii locuinței nr. 114/1996, suprafața utilă nu include suprafața balcoanelor și a teraselor neacoperite, acestea fiind considerate anexe sau spații exterioare, cu excepția cazului în care prin proiectul tehnic autorizat s-a prevăzut altfel.',
        ],
      },
      {
        id: 'tabel-exemplu-calcul-bloc',
        title: 'Exemplu Practic de Calcul al Cotelor pe o Scară de Bloc',
        content: [
          'Tabelul următor ilustrează calculul riguros al cotelor-părți indivize pe un tronson de clădire cu o suprafață utilă totală de 1.000 m²:',
        ],
      },
      {
        id: 'ce-cheltuieli-se-repartizeaza-pe-cpi',
        title: 'Cheltuielile Repartizate Obligatoriu pe Cota-Parte Indiviză',
        content: [
          'Art. 85 din Legea 196/2018 enumeră cheltuielile suportate proporțional cu cota-parte indiviză:',
          '• Reparații de fațadă, terase, hidroizolații, subsoluri tehnice și acoperișuri.',
          '• Întreținerea și revizia periodică a ascensoarelor și a instalațiilor comune.',
          '• Salariile sau indemnizațiile administratorului, cenzorului, președintelui și personalului de curățenie.',
          '• Apa meteorică și canalizarea apelor pluviale.',
          '• Serviciile de deratizare, dezinsecție și dezinfecție a spațiilor comune.',
          '• Asigurarea obligatorie și facultativă a imobilului pentru părțile comune.',
          '• Constituirea fondului de reparații al asociației de proprietari.',
        ],
      },
      {
        id: 'erori-frecvente-in-practica',
        title: 'Erori Frecvente în Utilizarea Cotei-Părți Indivize',
        content: [
          'Abaterile metodologice frecvente care generează distorsiuni în calcul sunt:',
          '• Utilizarea suprafeței construite sau desfășurate în loc de suprafața utilă.',
          '• Omiterea spațiilor comerciale de la parter de la cheltuielile comune ale blocului.',
          '• Rotunjirea grosolană a cotelor, generând sume totale ale cotelor de 98% sau 102%.',
          '• Schimbarea cotelor prin decizia comitetului fără actualizarea cărții funciare colective.',
        ],
      },
      {
        id: 'ce-trebuie-verificat-in-evidente',
        title: 'Checklist pentru Auditul Registrului de Cote al Asociației',
        content: [
          'Se recomandă ca periodic comisia de cenzori să verifice:',
          '1. Concordanța dintre suprafețele utile din programul de calcul și extrasele CF ale proprietarilor.',
          '2. Faptul că suma tuturor cotelor din registrul imobilului este exact 100%.',
          '3. Verificarea apartamentelor care au efectuat recompartimentări autorizate sau alipiri de spații.',
          '4. Verificarea includerii boxelor și locurilor de parcare intabulate ca proprietăți individuale distincte.',
        ],
      },
      {
        id: 'concluzii',
        title: 'Concluzii: Justețea Matematică ca Bază a Bunei Vecinătăți',
        content: [
          'Cota-parte indiviză este ancorată în realitatea fizică și juridică a clădirii. O platformă software de încredere blochează devierile arbitrare și garantează că fiecare proprietar contribuie strict conform dreptului său de proprietate.',
        ],
      },
    ],
    table: {
      caption: 'Exemplu Matematic: Calculul Cotelor-Părți Indivize pe o Clădire Tipică',
      headers: ['Tip Unitate Individuală', 'Număr Unități', 'Suprafață Utilă Unitare (m²)', 'Suprafață Totală Categorie (m²)', 'Cotă-Parte Indiviză per Unitate (%)', 'Total Cotă Categorie (%)'],
      rows: [
        ['Apartamente 2 camere', '6', '50 m²', '300 m²', '5,0000%', '30,0000%'],
        ['Apartamente 3 camere', '5', '70 m²', '350 m²', '7,0000%', '35,0000%'],
        ['Apartamente 4 camere', '2', '100 m²', '200 m²', '10,0000%', '20,0000%'],
        ['Spațiu comercial parter', '1', '120 m²', '120 m²', '12,0000%', '12,0000%'],
        ['Boxe subsol intabulate', '6', '5 m²', '30 m²', '0,5000%', '3,0000%'],
        ['Total condominiu', '20 unități', '—', '1.000 m²', '—', '100,0000%'],
      ],
    },
    faqs: [
      {
        q: 'Dacă un proprietar își închide balconul, se modifică cota-parte indiviză?',
        a: 'Închiderea balconului nu modifică de drept suprafața utilă a locuinței definită conform Legii locuinței nr. 114/1996, decât dacă lucrarea a presupus extinderea spațiului util încălzit conform unei documentații cadastrale de actualizare recepționată de OCPI.',
      },
      {
        q: 'Spațiile comerciale de la parter care au intrare separată din stradă plătesc reparațiile la acoperiș?',
        a: 'Da. Terasa sau acoperișul constituie proprietate comună a întregului condominiu. Conform Legii 196/2018, toți proprietarii participă la întreținerea și repararea părților comune proporțional cu cota-parte indiviză, indiferent de amplasarea fizică a spațiului.',
      },
      {
        q: 'Cum se procedează dacă suma cotelor din contractele vechi nu dă 100%?',
        a: 'În cazul blocurilor vechi unde rotunjirile din anii 1970-1990 au generat discrepanțe, asociația poate contracta un expert topograf/cadastrist pentru refacerea foii colective a cărții funciare pe baza suprafețelor utile reale.',
      },
    ],
    legalSources: [
      {
        title: 'Legea nr. 196/2018 privind înființarea, organizarea și funcționarea asociațiilor de proprietari',
        reference: 'Art. 2 lit. h) (Definiția cotei-părți indivize) și Art. 85',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/305357',
      },
      {
        title: 'Legea cadastrului și a publicității imobiliare nr. 7/1996',
        reference: 'Normele tehnice de înscriere a condominiilor',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/11494',
      },
    ],
    bridge: {
      title: 'Arhitectură de Date Imobiliare cu CLADORA',
      description:
        'Află cum modelul de date CLADORA ancorează fiecare calcul în identitatea digitală a activului și în registrul exact de suprafețe.',
      buttonText: 'Vezi Soluția pentru Asociații',
      href: '/ro/solutions/associations',
    },
    relatedGuides: [
      {
        title: 'Program de Calcul Întreținere Bloc: Reguli Legale & Algoritmi Explicabili',
        slug: 'program-calcul-intretinere-bloc',
        lang: 'ro',
      },
      {
        title: 'Metodologia Repartizării Cheltuielilor în Asociațiile de Proprietari',
        slug: 'repartizare-cheltuieli-asociatie-proprietari',
        lang: 'ro',
      },
      {
        title: 'Fond de Rulment vs Fond de Reparații: Calcul, Scop și Restituire Legală',
        slug: 'fond-rulment-vs-fond-reparatii',
        lang: 'ro',
      },
    ],
  },

  // 7. MIGRARE-PROGRAM-ADMINISTRARE-BLOC (New)
  'migrare-program-administrare-bloc': {
    id: 'CLUSTER-A-05',
    lang: 'ro',
    slug: 'migrare-program-administrare-bloc',
    title: 'Ghid de Migrare între Programe de Administrare Bloc: Preluarea Soldurilor, Istoricului și Verificarea de Către Cenzori',
    seoTitle: 'Migrare Program Administrare Bloc: Preluare Solduri',
    description:
      'Ghid de procedură pentru migrarea între softuri de bloc: transferul securizat de solduri, reconcilierea extraselor bancare și auditul inițial al cenzorilor.',
    category: 'Tranziție Tehnologică & Operațiuni',
    clusterId: 'cluster-a-associations',
    primaryQuery: 'migrare program administrare bloc',
    supportingQueries: [
      'schimbare program administrare bloc',
      'import date administrator bloc',
      'preluare solduri asociatie proprietari',
      'audit tranzitie soft bloc'
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
    pillarHref: '/ro/solutions/associations',
    disclaimer:
      'Ghidul prezintă metodologia de transfer și securizare a datelor financiare și tehnice în procesul de tranziție software într-o asociație de proprietari. Nu constituie audit financiar autorizat sau consultanță juridică.',
    directAnswer:
      'Migrarea între programe de administrare a blocului este procesul operațional prin care asociația de proprietari transferă baza de date a locatarilor, istoricul financiar, soldurile de activ și pasiv și registrele tehnice către o soluție software modernă. Pentru a respecta Legea 196/2018, migrarea trebuie realizată la o dată de închidere lunară clară, validată printr-o balanță analitică reconciliată cu extrasul bancar și semnată de administrator și comisia de cenzori.',
    sections: [
      {
        id: 'motivele-unei-migrari-tehnologice',
        title: 'Motivele Schimbării Softului de Administrare a Blocului',
        content: [
          'Multe asociații de proprietari din România utilizează încă programe de calcul concepute în anii 2000, instalate local pe un singur calculator învechit din camera administrației, fără copii de siguranță automate și fără acces securizat pentru proprietari.',
          'Motivele principale care impun o migrare tehnologică sunt:',
          '1. Riscul pierderii ireversibile a datelor prin defectarea echipamentului fizic local.',
          '2. Vulnerabilități de securitate și nerespectarea normelor GDPR privind datele personale ale locatarilor.',
          '3. Imposibilitatea auditării de la distanță de către cenzori și lipsa accesului transparent al proprietarilor la avizierul digital.',
          '4. Dificultatea de adaptare la cerințele contabile și de raportare ale Legii nr. 196/2018.',
        ],
      },
      {
        id: 'etape-metodologice-de-migrare',
        title: 'Cele 5 Etape Metodologice ale unei Migrări Fără Erori',
        content: [
          'O migrare reușită necesită respectarea unei succesiuni riguroase:',
          'Etapa 1: Pregătirea și înghețarea datelor (Data Freeze) — alegerea unei date precise de încheiere (de regulă, ultima zi a lunii calendaristice) după închiderea completă a listei de plată a lunii precedente.',
          'Etapa 2: Extragerea și igienizarea datelor — exportul tabelelor de apartamente, număr de persoane, suprafețe utile, solduri de debitori/creditori și indexuri vechi de contoare.',
          'Etapa 3: Configurarea noului mediu de lucru — definirea condominiului, a scărilor, a structurii de apartamente și a cheilor exacte de repartizare.',
          'Etapa 4: Reconcilierea balanței de deschidere — introducerea soldurilor inițiale și verificarea egalității dintre activ și pasiv.',
          'Etapa 5: Auditul cenzorilor și prima emitere de liste — semnarea procesului-verbal de transfer și emiterea primei liste de plată în noul sistem.',
        ],
      },
      {
        id: 'preluarea-soldurilor-si-balanta',
        title: 'Preluarea Soldurilor Inițiale: Debite, Penalități, Avansuri și Fonduri',
        content: [
          'Punctul critic al oricărei migrări îl reprezintă preluarea soldurilor de deschidere:',
          '• Restanțe din întreținere: Fiecare apartament debitor trebuie preluat cu suma exactă restantă la data tranziției.',
          '• Penalități istorice: Penalitățile calculate conform legii se evidențiază separat de debitul principal de întreținere.',
          '• Plăți în avans: Sumele achitate de proprietari înainte de emiterea listelor se consemnează ca pasiv al asociației.',
          '• Fondul de rulment și fondul de reparații: Se transferă soldurile individuale exacte constituite de fiecare proprietar.',
          '• Datorii către furnizorii de utilități: Se preiau soldurile din facturile furnizorilor neachitate până la data de tăiere.',
          '• Disponibilități bănești: Soldul exact din extrasul de cont bancar și registrul de casă la data migrării.',
        ],
      },
      {
        id: 'tabel-matrice-reconciliere-migrare',
        title: 'Matricea de Reconciliere la Migrare: Balanța Închidere vs. Deschidere',
        content: [
          'Tabelul de mai jos reflectă modelul de reconciliere obligatoriu la trecerea dintr-un sistem în altul:',
        ],
      },
      {
        id: 'rolul-auditului-cenzorilor',
        title: 'Rolul Decisiv al Comisiei de Cenzori în Procesul de Migrare',
        content: [
          'Comisia de cenzori nu trebuie să asiste pasiv la migrare, ci este garantul integrității financiare:',
          '1. Cenzorii certifică prin semnătură balanța de închidere din vechiul sistem.',
          '2. Verifică extrasul de cont bancar la zi pentru confirmarea disponibilităților financiare reale.',
          '3. Verifică balanța de deschidere generată de noul program și certifică egalitatea matematică cu datele de închidere.',
          '4. Întocmesc un proces-verbal de audit al migrării, care se anexează la dosarul oficial al asociației de proprietari.',
        ],
      },
      {
        id: 'erori-frecvente-in-migrari',
        title: 'Capcane și Erori Frecvente în Tranziția între Programe',
        content: [
          'Cele mai mari pericole într-o migrare software:',
          '• Preluarea doar a soldului total restant fără separarea penalităților de debitul principal (afectează recuperarea în instanță).',
          '• Omiterea verificării registrelor de apometre, ducând la citiri eronate în prima lună.',
          '• Migrarea în mijlocul lunii fără o dată de referință clară, generând suprapuneri de facturi.',
          '• Necomunicarea transferului către proprietari, stârnind suspiciuni nefondate.',
        ],
      },
      {
        id: 'ce-trebuie-verificat-dupa-lansare',
        title: 'Ce Trebuie Verificat După Prima Lună de Utilizare a Noului Sistem',
        content: [
          'Checklist operațional pentru prima lună post-migrare:',
          '1. Compararea primei liste de plată emise în noul program cu lista lunii anterioare pentru depistarea discrepanțelor.',
          '2. Verificarea funcționării corecte a calculului penalităților pe soldurile istorice preluate.',
          '3. Confirmarea înregistrării corecte a încasărilor bancare pe fiecare apartament în parte.',
          '4. Soluționarea rapidă a eventualelor neclarități semnalate de proprietari la avizier.',
        ],
      },
      {
        id: 'concluzii',
        title: 'Concluzii: O Oportunitate de Resetare a Rigorii și Încrederii',
        content: [
          'Migrarea către o soluție software modernă nu este doar un upgrade tehnic, ci o ocazie rară de a curăța evidențele vechi, de a clarifica litigiile istorice și de a stabili un nivel superior de transparență în asociația de proprietari.',
        ],
      },
    ],
    table: {
      caption: 'Matrice de Reconciliere a Datelor la Migrarea Software (Exemplu Audit)',
      headers: ['Post Financiar / Entitate', 'Sold în Sistemul Vechi (lei)', 'Verificare Extras / Document (lei)', 'Sold Preluat în Sistemul Nou (lei)', 'Diferență Audit'],
      rows: [
        ['Disponibil în cont bancar curent', '45.280,50', '45.280,50 (Extras bancar)', '45.280,50', '0,00 lei (Conform)'],
        ['Disponibil în casierie (numerar)', '1.450,00', '1.450,00 (Registru de casă)', '1.450,00', '0,00 lei (Conform)'],
        ['Total debite restante întreținere', '18.320,00', '18.320,00 (Fișe debitori)', '18.320,00', '0,00 lei (Conform)'],
        ['Penalități de întârziere calculate', '2.840,00', '2.840,00 (Registru penalități)', '2.840,00', '0,00 lei (Conform)'],
        ['Fond de rulment constituit', '28.500,00', '28.500,00 (Fișe individuale)', '28.500,00', '0,00 lei (Conform)'],
        ['Fond de reparații acumulat', '32.140,50', '32.140,50 (Registru fond)', '32.140,50', '0,00 lei (Conform)'],
        ['Facturi furnizori neachitate', '7.250,00', '7.250,00 (Facturi fizice)', '7.250,00', '0,00 lei (Conform)'],
      ],
    },
    faqs: [
      {
        q: 'Cât timp durează în mod normal migrarea datelor unei asociații de proprietari?',
        a: 'În practica de operare, intervalul necesar pentru pregătirea, verificarea și importul structurat al datelor depinde direct de anvergura portofoliului și de claritatea evidențelor istorice, fiind considerabil redus atunci când balanțele contabile și extrasele bancare sunt deja reconciliate.',
      },
      {
        q: 'Se pot importa datele direct dintr-un fișier Excel?',
        a: 'Da. Soluțiile moderne oferă șabloane standardizate de import pentru apartamente, locatari, suprafețe și solduri inițiale, eliminând necesitatea introducerii manuale a datelor.',
      },
      {
        q: 'Ce se întâmplă cu istoricul de plată de peste 3 ani din sistemul vechi?',
        a: 'Arhiva extrasă din sistemul anterior se păstrează conform termenelor prevăzute de legislația contabilă în vigoare (Legea contabilității nr. 82/1991). În noul mediu operațional se preiau soldurile de deschidere și debitele aflate în termenul legal de prescripție extinctivă.',
      },
    ],
    legalSources: [
      {
        title: 'Legea nr. 196/2018 privind înființarea, organizarea și funcționarea asociațiilor de proprietari',
        reference: 'Art. 60 (Atribuțiile cenzorului) și Art. 66 (Evidența contabilă a administratorului)',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/305357',
      },
    ],
    bridge: {
      title: 'Migrare Securizată către Platforma CLADORA',
      description:
        'Echipa de arhitectură CLADORA oferă proceduri validate pentru transferul curat al bazelor de date ale asociațiilor de proprietari.',
      buttonText: 'Consultă Hub-ul de Migrare',
      href: '/ro/resources/migration-hub',
    },
    relatedGuides: [
      {
        title: 'Program de Calcul Întreținere Bloc: Reguli Legale & Algoritmi Explicabili',
        slug: 'program-calcul-intretinere-bloc',
        lang: 'ro',
      },
      {
        title: 'Lista de Plată a Asociației de Proprietari: Structură, Termene și Afișare Legală',
        slug: 'lista-de-plata-asociatie-proprietari',
        lang: 'ro',
      },
      {
        title: 'Ghid Practic pentru Asociațiile de Proprietari: Context Operațional Legea 196/2018',
        slug: 'asociatii-proprietari-legea-196-2018',
        lang: 'ro',
      },
    ],
  },
};
