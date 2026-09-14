# CLADORA-P2-MONTHLY-ACCOUNTANT-001A — Matrice de probe v1.0

**Instrucțiune:** coloanele „Referință probă”, „Rezultat expert” și „Constatare” se completează numai în timpul revizuirii independente. Starea inițială este `NEEVALUAT`.

| ID | Domeniu | Afirmație de verificat | Probă CLADORA planificată | Test independent | Rezultat expert | Referință probă / constatare |
| --- | --- | --- | --- | --- | --- | --- |
| `ACC-01` | Perioadă | există un singur ciclu lunar activ pentru imobil/perioadă | ciclu, perioadă și cheie de unicitate | inspectare identificatori și interval | `NEEVALUAT` | |
| `ACC-02` | Proveniență | fiecare cost/citire este legat de o sursă imuabilă | registru surse + SHA-256 | selectarea și urmărirea eșantionului | `NEEVALUAT` | |
| `ACC-03` | Furnizori | numai costurile aprobate intră în calcul | facturi și stări de aprobare | comparare surse incluse/excluse | `NEEVALUAT` | |
| `ACC-04` | Utilități | citirile și consumul sunt explicabile | index anterior/curent și consum | recalculare consum | `NEEVALUAT` | |
| `ACC-05` | Repartizare | baza și metoda sunt explicite | regulă, cote/suprafețe/consum | recalculare independentă | `NEEVALUAT` | |
| `ACC-06` | Rotunjire | diferențele de rotunjire sunt deterministe și totalul se păstrează | linii unități + total sursă | însumare la precizia RON | `NEEVALUAT` | |
| `ACC-07` | Listă lunară | totalurile individuale egalează totalul asociației | listă pe unități + sumar | reconciliere integrală | `NEEVALUAT` | |
| `ACC-08` | Confidențialitate | proprietarul vede numai datele unității autorizate | capturi/export minimizat | control câmpuri și acces | `NEEVALUAT` | |
| `ACC-09` | Creanțe | soldul creanțelor este explicabil | sold inițial + debit − alocări | recalculare eșantion și total | `NEEVALUAT` | |
| `ACC-10` | Plăți | plățile sunt direct către asociație, fără custodie CLADORA | instrucțiuni bancare și alocări | urmărire referință sintetică | `NEEVALUAT` | |
| `ACC-11` | Jurnal | fiecare notă contabilă este echilibrată | jurnal debit/credit | total debit = total credit | `NEEVALUAT` | |
| `ACC-12` | Balanță | rulajele și soldurile sunt coerente | balanță de verificare | verificare sold inițial/rulaj/sold final | `NEEVALUAT` | |
| `ACC-13` | Paritate | GL 4111 corespunde creanțelor și GL 419 plăților nealocate | raport de paritate | reconciliere înainte/după publicare | `NEEVALUAT` | |
| `ACC-14` | Fonduri | fondurile operaționale/reparații sunt distincte și trasabile | raport fonduri și jurnal | control clasificare și sold | `NEEVALUAT` | |
| `ACC-15` | Control dual | autorul nu își aprobă propria închidere | evenimente autor/revizori | comparare identități și AAL2 | `NEEVALUAT` | |
| `ACC-16` | Publicare | versiunea publicată este imuabilă | snapshot + hash | regenerare și comparare hash | `NEEVALUAT` | |
| `ACC-17` | Excepții | excepțiile blocante sunt rezolvate înainte de close | coadă excepții | verificare stare și probe rezoluție | `NEEVALUAT` | |
| `ACC-18` | Închidere | perioada închisă nu acceptă modificări retroactive | stare close + probe negative | tentativă controlată în mediu sintetic | `NEEVALUAT` | |
| `ACC-19` | Prezentare RO | terminologia, datele, moneda și semnele sunt clare | PDF/XLSX/CSV în română | revizuire profesională | `NEEVALUAT` | |
| `ACC-20` | Export | aceleași date produc rezultate deterministe și verificabile | manifest, artifact hash și exporturi | regenerare și comparare | `NEEVALUAT` | |
| `ACC-21` | Audit | aprobările și schimbările au urme atribuibile | audit trail | eșantion cronologic | `NEEVALUAT` | |
| `ACC-22` | Limită legală | afirmațiile produsului nu depășesc probele | texte și disclaimere | identificare afirmații nejustificate | `NEEVALUAT` | |

## Registrul constatărilor

| Finding ID | Criteriu | Severitate (`Critical/High/Medium/Low/Observation`) | Descriere | Impact contabil/operațional | Corecție solicitată | Proprietar | Termen | Stare |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | `OPEN` |

## Controlul completitudinii

- [ ] Toate criteriile `ACC-01`–`ACC-22` au rezultat și referință de probă.
- [ ] Toate recalculările independente sunt atașate sau referențiate.
- [ ] Nu există diferențe nereconciliate.
- [ ] Toate constatările au severitate și decizie explicită.
- [ ] Expertul a confirmat regimul contabil aplicabil și limitele opiniei.
- [ ] Formularul de acceptare indică aceeași versiune și același hash al pachetului.

