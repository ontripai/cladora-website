import { GuideArticleData } from './types';

export const CLUSTER_C_ARTICLES: Record<string, GuideArticleData> = {
  // 1. MANAGEMENT-DOCUMENTE-PROPRIETATI
  'management-documente-proprietati': {
    id: 'CLUSTER-C-01',
    lang: 'ro',
    slug: 'management-documente-proprietati',
    contentApplicability: { kind: 'country', countryCode: 'RO' },
    title: 'Managementul Documentelor în Administrarea Proprietăților: Carte Tehnică, Proveniență și Controlul Accesului',
    seoTitle: 'Management Documente Proprietăți: Ghid Arhivă și Acces',
    description:
      'Ghid de guvernanță a documentelor în administrarea imobilelor: cartea tehnică, contractele de furnizori, arhivarea legală și securitatea accesului pe roluri.',
    category: 'Property Management & Guvernanță',
    clusterId: 'cluster-c-property-managers',
    primaryQuery: 'management documente proprietăți',
    supportingQueries: [
      'property management software Romania',
      'software administrare proprietăți',
      'cartea tehnică a construcției digitală',
      'arhivă documente asociație de proprietari'
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
    pillarHref: '/ro/solutions/property-managers',
    disclaimer:
      'Acest ghid analizează cerințele metodologice și tehnologice pentru guvernanța documentelor imobiliare conform legislației românești. Nu constituie consultanță juridică, arhivistică sau notarială autorizată.',
    directAnswer:
      'Managementul documentelor în administrarea proprietăților este disciplina operațională prin care actele juridice, cartea tehnică a construcției, autorizațiile, contractele cu furnizorii și procesele-verbale ale asociației sunt arhivate, versionate și puse la dispoziția persoanelor îndreptățite pe bază de roluri de acces bine definite. O gestiune corectă garantează proveniența și integritatea probatorie a actelor, protejează asociația sau compania de administrare în caz de litigii și previne pierderea memoriei instituționale a clădirii.',
    sections: [
      {
        id: 'criza-documentelor-in-imobiliare',
        title: 'Criza Documentelor în Administrarea Proprietăților Imobiliare',
        content: [
          'În industria imobiliară din România, gestionarea documentelor reprezintă adesea cel mai vulnerabil punct operațional:',
          'Proiectele tehnice originale zac în cutii de carton prăfuite în subsoluri inundabile, contractele de utilități expirate sunt amestecate cu facturile curente, iar deciziile adunărilor generale sunt consemnate în caiete manuscrise fără copii de siguranță.',
          'Când o clădire își schimbă compania de property management sau când asociația alege un nou președinte, are loc frecvent o pierdere masivă de informație: se pierd planurile instalațiilor îngropate, garanțiile echipamentelor devin imposibil de localizat, iar reconstituirea arhivei consumă luni de zile și costuri juridice imense.',
          'O abordare modernă de property management necesită tratarea documentelor nu ca pe simple fișiere atașate, ci ca pe active probatorii fundamentale ale clădirii.',
        ],
      },
      {
        id: 'categorii-critice-de-documente',
        title: 'Cele 5 Categorii Vitale de Documente dintr-un Condominiu sau Portofoliu',
        content: [
          'Arhiva operațională a unui imobil trebuie structurată pe 5 piloni documentari riguroși:',
          '1. Cartea Tehnică a Construcției (conform H.G. nr. 273/1994): cuprinde proiectul de execuție, autorizația de construire, procesul-verbal de recepție la terminarea lucrărilor, procesul-verbal de recepție finală și jurnalul evenimentelor din exploatare.',
          '2. Actele constitutive și statutare: acordul de asociere, statutul asociației de proprietari, încheierea judecătorească de dobândire a personalității juridice și codul de identificare fiscală (CIF).',
          '3. Contractele comerciale și de servicii: contractele cu furnizorii de utilități (apă, gaz, energie electrică, salubrizare), contractele de mentenanță ascensor, deratizare, curățenie și asigurările de răspundere civilă.',
          '4. Documentele financiar-contabile (Legea contabilității nr. 82/1991): registrele jurnal, balanțele lunare de verificare, extrasele de cont bancar, statele de plată și dosarele lunare ale listelor de întreținere.',
          '5. Registrul Deciziilor și Proceselor-Verbale: procesele-verbale ale tuturor adunărilor generale, deciziile comitetului executiv, hotărârile judecătorești și corespondența oficială cu autoritățile publice.',
        ],
      },
      {
        id: 'provenienta-versiune-si-integritate',
        title: 'Delimitarea Arhitecturală: Stocare de Fișiere vs. Proveniență și Versiuni Verificabile',
        content: [
          'O greșeală frecventă a companiilor de administrare este confundarea unui simplu serviciu de stocare în cloud (precum Google Drive sau Dropbox) cu un sistem veritabil de guvernanță a documentelor:',
          'Într-un spațiu comun de stocare, orice utilizator cu drept de editare poate șterge accidental un fișier, poate suprascrie un contract fără a lăsa urme sau poate descărca baze de date confidențiale fără ca sistemul să consemneze acțiunea.',
          'În arhitectura CLADORA (domeniul DOCUMENTS), documentul imobiliar este guvernat prin trei principii de integritate:',
          '• Proveniență verificabilă (Provenance): fiecare document încărcat reține identitatea persoanei care l-a introdus, data și ora exactă, adresa IP și contextul organizațional (Workspace-ul căruia îi aparține).',
          '• Versionare auditabilă: editarea sau actualizarea unui document nu șterge versiunea inițială; sistemul creează o versiune nouă legată de cea veche, păstrând întregul istoric probatoriu pentru cenzori sau instanțe.',
          '• Control strict al drepturilor de acces: vizibilitatea unui document este condiționată de mandatul activ al utilizatorului (proprietarii văd doar hotărârile publice și facturile de utilități, comitetul vede dosarele de ofertare, iar datele cu caracter personal sunt izolate conform GDPR).',
        ],
      },
      {
        id: 'tabel-matrice-retentie-si-acces',
        title: 'Matricea de Retenție Legală și Nivelurile de Acces pe Documente',
        content: [
          'Tabelul de mai jos sintetizează termenele legale de păstrare și permisiunile de acces pentru principalele categorii de documente imobiliare din România:',
        ],
      },
      {
        id: 'controlul-accesului-si-gdpr',
        title: 'Protecția Datelor Personale (GDPR) în Arhiva Asociațiilor de Proprietari',
        content: [
          'Asociațiile de proprietari și companiile de administrare prelucrează date sensibile ale locatarilor: contracte de vânzare-cumpărare, extrase de carte funciară cu CNP, numere de telefon, adrese de e-mail și situații financiare privind restanțele.',
          'Conform Regulamentului (UE) 2016/679 (GDPR) și Legii nr. 190/2018:',
          '• Actele de proprietate și datele de identificare ale locatarilor trebuie păstrate în spații securizate cu acces restricționat exclusiv administratorului și președintelui.',
          '• Este interzisă partajarea publică a extraselor CF sau a contractelor de închiriere către alți membri ai asociației fără acordul expres al titularului.',
          '• La avizier se afișează doar datele strict necesare identificării cotei de plată (număr apartament, nume/inițială), fiind interzisă publicarea CNP-ului sau a datelor de contact.',
        ],
      },
      {
        id: 'erori-frecvente-in-arhivarea-imobiliara',
        title: 'Erori Frecvente în Arhivarea și Predarea Documentelor Imobiliare',
        content: [
          'Principalele abateri care generează litigii costisitoare:',
          '• Refuzul fostului administrator de a preda arhiva asociației la încetarea contractului (faptă ce constituie contravenție conform Art. 102 din Legea nr. 196/2018 și poate atrage răspunderea patrimonială).',
          '• Păstrarea facturilor de utilități doar în format fizic pe hârtie termică care se degradează și devine ilizibilă după 2 ani.',
          '• Lipsa unui proces-verbal detaliat de predare-primire a documentelor între administrațiile succesive.',
          '• Neînregistrarea modificărilor aduse cărții tehnice după efectuarea unor reparații majore (anvelopare, schimbare conducte).',
        ],
      },
      {
        id: 'ce-trebuie-verificat-la-audit-documentar',
        title: 'Checklist pentru Inventarierea și Auditul Documentar al unui Imobil',
        content: [
          'Pentru evaluarea sănătății juridice și operaționale a clădirii, se verifică:',
          '1. Existența volumului complet al Cărții Tehnice a Construcției și a autorizației de construire.',
          '2. Dosarul cu acordul de asociere, statutul actualizat și încheierea judecătorească a asociației.',
          '3. Contractele active cu toți furnizorii de utilități și actele adiționale de preț la zi.',
          '4. Registrul unic de procese-verbale ale Adunărilor Generale, numerotat și ștampilat.',
          '5. Dosarele lunare ale listelor de întreținere din ultimii 5 ani, însoțite de facturile furnizorilor și extrasele bancare.',
        ],
      },
      {
        id: 'concluzii',
        title: 'Concluzii: Memoria Instituțională ca Scut Juridic al Proprietății',
        content: [
          'Managementul riguros al documentelor protejează asociația de proprietari și administratorul profesionist de amenzi, procese pierdute și blocaje operaționale.',
          'O clădire cu o arhivă digitală completă, securizată și transparent auditabilă se bucură de încrederea proprietarilor și de o valoare superioară pe piața imobiliară.',
        ],
      },
    ],
    table: {
      caption: 'Matrice de Guvernanță Documentară: Termene Legale și Niveluri de Acces',
      headers: ['Categorie Document', 'Termen Legal de Păstrare', 'Cine Poate Vizualiza', 'Cine Poate Adăuga / Modifica', 'Temei Legal'],
      rows: [
        ['Cartea Tehnică a Construcției', 'Pe toată durata de existență a clădirii', 'Proprietari, Administrator, Organe de control', 'Proiectant, Diriginte de șantier, Constructor', 'H.G. nr. 273/1994'],
        ['Statutul & Acordul de Asociere', 'Permanent (pe durata existenței asociației)', 'Toți membrii asociației de proprietari', 'Adunarea Generală a proprietarilor', 'Legea nr. 196/2018'],
        ['Registre financiar-contabile (Balanțe, Jurnal)', '5 ani (calculat de la închiderea exercițiului)', 'Cenzori, Președinte, Administrator, Fisc', 'Administrator de condominiu atestat', 'Legea contabilității nr. 82/1991'],
        ['Documente justificative (Facturi utilități, Chitanțe)', '5 ani (calculat de la data închiderii exercițiului)', 'Proprietari (la cerere), Cenzori, Administrator', 'Administrator / Furnizor servicii', 'Legea nr. 82/1991 & OMFP 2634/2015'],
        ['Procese-verbale Adunare Generală', 'Permanent (în registrul special al asociației)', 'Toți proprietarii din condominiu', 'Secretarul adunării & Președintele', 'Art. 47 Legea nr. 196/2018'],
        ['Registrul locatarilor și date personale', 'Permanent / actualizat continuu la schimbări', 'Exclusiv Administratorul și Președintele', 'Administrator în baza declarațiilor scrise', 'GDPR & Legea nr. 196/2018'],
      ],
    },
    faqs: [
      {
        q: 'Au voie proprietarii să fotografieze facturile de utilități sau contractele asociației?',
        a: 'Da. Conform Art. 28 din Legea nr. 196/2018, orice proprietar are dreptul de a primi explicații privind calculul cotelor și de a consulta sau obține copii/fotografii de pe documentele asociației, cu respectarea normelor GDPR privind datele personale ale terților.',
      },
      {
        q: 'Au valoare juridică documentele scanate în cazul unui litigiu în instanță?',
        a: 'Documentele scanate pot servi drept mijloc de probă (început de dovadă scrisă sau copie), dar forța probantă deplină revine înscrisului original sau documentului electronic semnat cu semnătură electronică calificată (conform Regulamentului eIDAS și Legii nr. 455/2001). În cazul contestării în instanță, partea care invocă înscrisul poate fi obligată să prezinte exemplarul original.',
      },
      {
        q: 'Ce se întâmplă dacă fosta administrație a pierdut Cartea Tehnică a Construcției?',
        a: 'Asociația de proprietari are obligația legală de a întreprinde demersuri pentru reconstituirea Cărții Tehnice prin solicitarea duplicatelor de la direcția de urbanism a primăriei emitente a autorizației de construire, de la Inspectoratul de Stat în Construcții (ISC) sau de la proiectantul inițial.',
      },
    ],
    legalSources: [
      {
        title: 'H.G. nr. 273/1994 privind aprobarea Regulamentului de recepție a lucrărilor de construcții',
        reference: 'Obligațiile privind întocmirea și păstrarea Cărții Tehnice a Construcției',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/4442',
      },
      {
        title: 'Legea contabilității nr. 82/1991',
        reference: 'Normele de păstrare și arhivare a documentelor justificative financiar-contabile',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/1335',
      },
      {
        title: 'Legea nr. 196/2018 privind asociațiile de proprietari',
        reference: 'Art. 28 (Dreptul de acces la documentele asociației) și Art. 47 (Procesele-verbale)',
        accessDate: '2026-10-15',
        url: 'https://legislatie.just.ro/Public/DetaliiDocumentAfis/305357',
      },
    ],
    bridge: {
      title: 'Guvernanță Documentară Sigură cu CLADORA',
      description:
        'Vezi cum este proiectată arhitectura CLADORA (domeniul DOCUMENTS) pentru a susține stocarea structurată cu proveniență trasabilă, istoricul versiunilor și controlul accesului pe roluri.',
      buttonText: 'Vezi Soluția pentru Companii de Administrare',
      href: '/ro/solutions/property-managers',
    },
    relatedGuides: [
      {
        title: 'Ghid Practic pentru Asociațiile de Proprietari: Context Operațional Legea 196/2018',
        slug: 'asociatii-proprietari-legea-196-2018',
        lang: 'ro',
      },
      {
        title: 'Registrul Tehnic de Echipamente și Revizii în Clădiri: Fișa Activului și ISCIR',
        slug: 'registru-echipamente-revizii',
        lang: 'ro',
      },
      {
        title: 'Ghid de Migrare între Programe de Administrare Bloc: Preluarea Soldurilor',
        slug: 'migrare-program-administrare-bloc',
        lang: 'ro',
      },
    ],
  },
};
